// lib/retrieve.js
// Server-side live-fetch RAG. Ported from spike/rag-probe.mjs (proven).
// ESM to match api/chat.js's runtime style. Lives OUTSIDE api/ so Vercel does
// not route it as a serverless function; api/ask.js imports retrieve().
//
// Requires env: BRAVE_API_KEY
// Deps: linkedom, @mozilla/readability
//
// linkedom (not jsdom) because jsdom's html-encoding-sniffer transitively
// require()s an ESM-only dep (@exodus/bytes) that Vercel's runtime cannot load
// (FUNCTION_INVOCATION_FAILED). linkedom is pure-JS, serverless-native, and
// Readability parses its document just the same.

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

// Approved-domain allow-list — narrowed from the spike's broader set to the four
// vetted Islamic sources. Applied at query time via a Brave `site:` filter.
// Age-scoped source allow-lists (khilaf-policy §6).
// Under-18 is restricted to the two sources vetted clean AND appropriate for minors.
// 18+ gets the full vetted list. Anyone lying about age is out of scope by design
// (self-declared age governs, exactly like every other site/game — no age proof).
// dorar.net is on the MINOR list too: its material is editorially reviewed (hadith
// grading by named muhaddith, and a vetted fiqh encyclopedia), so it clears the same
// bar the other two minor sources clear. The age rules themselves are unchanged --
// this only widens WHICH vetted sites a minor's search may draw from.
export const SITES_MINOR = ['islamqa.info', 'binbaz.org.sa', 'dorar.net'];
// Under-18 Tier-2 FALLBACK - used ONLY when the primary (SITES_MINOR) returns
// nothing, i.e. contemporary matters that post-date Ibn Baz (crypto, banking).
// Kuwaiti official fatwa dept: issues ONE ruling (not a madhhab comparison), so a
// child still gets a single answer. Vetted server-side (Readability-clean SSR).
const SITES_MINOR_FALLBACK = ['eftaa.awqaf.gov.kw'];
export const SITES_ADULT = [
  // original four (vetted in RAG spike)
  'islamweb.net', 'binbaz.org.sa', 'alukah.net', 'islamqa.info',
  // added 2026-07-05 (probed: SSR, Readability-clean)
  'sh-albarrak.com', 'almosleh.com',
  'islamstory.com', 'al-badr.net', 'othmanalkhamees.com',
  // added 2026-07-10 (local server-side probe: clean SSR, Readability-extracted)
  'iifa-aifi.org', 'ferkous.com', 'tafsir.app',
  // added 2026-07-31 (local server-side probe with the production header set).
  //   dorar.net     -- hadith takhrij + grading, and the Durar fiqh encyclopedia.
  //   dr-mutlaq.com -- articles/research by Dr. Mutlaq al-Jasir; VIDEO post-type is
  //                    gated out below (a video page carries no usable written text).
  //   shamela.ws    -- reference LIBRARY, adult/detailed only, and ONLY a specific
  //                    book page (see shamelaBookRef): never the home page, never a
  //                    search-results page, never a category listing.
  'dorar.net', 'dr-mutlaq.com', 'shamela.ws',
];
// Build the Brave `site:` OR-filter from an EXPLICIT site list. retrieve() picks
// the list per age-tier; the fail-CLOSED age gate lives there (anything that is
// not band === 'adult' gets the minor tiers, never the adult list). The SAME list
// object drives BOTH this query filter AND the post-fetch host enforcement in
// runSearchPass, so query and enforcement can never drift within a pass.
function siteFilterFor(sites) {
  return sites.map((s) => 'site:' + s).join(' OR ');
}

// Per retrieve() call, cap how many Brave candidates we actually fetch+clean.
// Brave still returns a few candidates (maxResults) so we have fallbacks, but we
// only fetch the top FETCH_PER_CALL and keep the FIRST that comes back clean —
// the rest are ignored. With 2 tool queries this targets ~1 clean source per
// angle (~2 total) instead of ~6, cutting page fetches and latency. Tune here.
const FETCH_PER_CALL = 2;

function collapse(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function hostname(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return '?';
  }
}

// #5 allow-list host match: accept a host only if it EQUALS an approved domain
// or is a sub-domain of one (e.g. www.islamqa.info, ar.islamqa.info). Rejects
// different registrable domains and lookalikes ('evil-islamqa.info' does NOT end
// with '.islamqa.info'; 'islamqa.info.evil.com' ends with '.evil.com'), so a
// cross-domain redirect or a Brave soft-filter leak to an unvetted site is
// dropped. '?' (unparseable host) matches nothing => dropped (fail-closed).
function hostAllowed(host, sites) {
  const h = (host || '').toLowerCase();
  return sites.some((s) => {
    const d = s.toLowerCase();
    return h === d || h.endsWith('.' + d);
  });
}

// --- Sheikh Uthman al-Khamis (othmanalkhamees.com) sect-polemic gate ----------
// His site mixes general Islamic teaching with a dedicated sect-polemic/debate
// category. For a child-safe app (this source is 18+ only) we exclude that one
// category by reading the site's OWN badge on each lesson page, so the filter
// auto-tracks lessons they add. No hand-maintained ID list for the main case.
const KHAMEES_HOST = 'othmanalkhamees.com';
// Category text "firaq wa-madhahib wa-munazarat" (sects/schools/debates), kept as
// \u escapes ON PURPOSE: pure-ASCII source can never byte-reverse in an editor.
const KHAMEES_BLOCKED_CATEGORIES = [
  '\u0641\u0631\u0642 \u0648\u0645\u0630\u0627\u0647\u0628 \u0648\u0645\u0646\u0627\u0638\u0631\u0627\u062A',
];
// Supplemental: sect-sensitive lessons filed OUTSIDE that category, matched by
// /lesson/{id}. Starting set; extend if more surface in live testing.
const KHAMEES_BLOCKED_LESSON_IDS = new Set([345, 348]);

function stripMarks(s) {
  return (s || '').replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}
// Read the category from the site's own badge. Primary anchor: the badge <span>
// sits immediately before the favorite button (#favoriteBtn, on every lesson
// page). Fallback: an olive-styled pill whose text has no digit (i.e. the
// category label, not the "N lectures" counter).
function khameesCategory(doc) {
  const fav = doc.querySelector('#favoriteBtn');
  const prev = fav && fav.previousElementSibling;
  if (prev && prev.tagName === 'SPAN') {
    const t = collapse(stripMarks(prev.textContent));
    if (t) return t;
  }
  for (const el of doc.querySelectorAll('span[class*="text-olive-700"]')) {
    const t = collapse(stripMarks(el.textContent));
    if (t && t.length <= 40 && !/[0-9\u0660-\u0669]/.test(t)) return t;
  }
  return '';
}
function isKhameesBlocked(url, finalUrl, doc) {
  if (hostname(finalUrl) !== KHAMEES_HOST && hostname(url) !== KHAMEES_HOST) return false;
  const m = (finalUrl || url || '').match(/\/lesson\/(\d+)/);
  const id = m ? Number(m[1]) : null;
  if (id !== null && KHAMEES_BLOCKED_LESSON_IDS.has(id)) return true;
  const cat = khameesCategory(doc);
  return KHAMEES_BLOCKED_CATEGORIES.some((c) => cat.includes(c));
}

// --- tafsir.app multi-book aggregator: exclude specific books by URL slug ------
// tafsir.app aggregates ~50 tafsirs; every page URL is /{book}/{surah}/{ayah}.
// Drop excluded books by their first path-segment slug. Per source policy we
// exclude al-Kashshaf (Zamakhshari — mu'tazili) and al-Razi (Mafatih al-Ghayb —
// kalam/philosophical). Extend the Set to exclude more books if needed.
const TAFSIRAPP_BLOCKED_BOOKS = new Set(['kashaf', 'alrazi']);
function tafsirAppSlug(u) {
  try {
    const url = new URL(u);
    if (url.hostname !== 'tafsir.app' && url.hostname !== 'www.tafsir.app') return '';
    return (url.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
  } catch {
    return '';
  }
}
function isTafsirAppBookBlocked(url, finalUrl) {
  const slug = tafsirAppSlug(finalUrl) || tafsirAppSlug(url);
  return slug !== '' && TAFSIRAPP_BLOCKED_BOOKS.has(slug);
}

// Host test shared by the per-site gates below: is `u` on THIS domain (or a
// sub-domain of it)? Unparseable => false, so a gate can never fire on garbage.
function onHost(u, domain) {
  try {
    return hostAllowed(new URL(u).hostname, [domain]);
  } catch {
    return false;
  }
}

// --- dr-mutlaq.com: articles/research YES, video pages NO ---------------------
// The site is WordPress and files its ~730 video lessons under the All-in-One-Video-
// Gallery post type, so every video lives under /aiovg_videos/ — a stable, declared
// URL prefix (it is its own entry in the site's sitemap index). That prefix is the
// ONLY reliable discriminator: a video page's extracted text is not short, it is
// LONGER than an article's (~23k vs ~22k chars) because the raw-text fallback sweeps
// up the site chrome listing every other lesson. So a length threshold would happily
// accept a video page with no transcript at all; the path test will not.
const MUTLAQ_HOST = 'dr-mutlaq.com';
const MUTLAQ_BLOCKED_PREFIXES = ['/aiovg_videos', '/player-embed', '/user-videos'];
export function isMutlaqNonTextBlocked(url, finalUrl) {
  const target = finalUrl || url;
  if (!onHost(target, MUTLAQ_HOST)) return false;
  let path;
  try {
    path = decodeURIComponent(new URL(target).pathname).toLowerCase();
  } catch {
    try { path = new URL(target).pathname.toLowerCase(); } catch { return true; }
  }
  return MUTLAQ_BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

// --- shamela.ws: a SPECIFIC book page only ------------------------------------
// The Shamela library is a corpus, not a fatwa site, so "it exists in Shamela" proves
// nothing on its own. A citation is only meaningful when it points at an identifiable
// book AND an identifiable position in it, which on this site means /book/{id}/{page}.
// Everything else on the host — the home page, /search results, /category listings —
// is rejected outright. (A category page in particular WOULD sail past the generic
// 200-char text gate: one probed at ~182k characters.)
const SHAMELA_HOST = 'shamela.ws';
function shamelaBookRef(u) {
  let parts;
  try {
    parts = new URL(u).pathname.split('/').filter(Boolean);
  } catch {
    return null;
  }
  if (parts[0] !== 'book') return null;
  if (!/^\d+$/.test(parts[1] || '')) return null;              // /book/{id}
  if (parts[2] !== undefined && !/^\d+$/.test(parts[2])) return null;  // optional /{page}
  if (parts.length > 3) return null;
  return { bookId: parts[1], page: parts[2] || '' };
}
export function isShamelaNonBookBlocked(url, finalUrl) {
  const target = finalUrl || url;
  if (!onHost(target, SHAMELA_HOST)) return false;
  return shamelaBookRef(target) === null;
}

// Build the "book — author — position" label a Shamela card must carry, reading the
// page's OWN markup rather than guessing from the URL:
//   h1                     -> "كتاب صحيح مسلم - ت عبد الباقي"
//   .page-header "[...]"   -> the author shorthand, e.g. "[مسلم]"
//   <title> "ج1 - ص29"     -> volume/page position
// Returns '' when the book cannot be identified, which the caller treats as a reject:
// an unattributable Shamela page is exactly what the rule above forbids citing.
function shamelaLabel(doc) {
  const book = collapse(stripMarks(doc.querySelector('h1')?.textContent));
  if (!book) return '';
  const header = collapse(stripMarks(doc.querySelector('.page-header')?.textContent));
  const author = (header.match(/\[([^\]]{1,60})\]/) || [])[1] || '';
  const title = collapse(stripMarks(doc.title));
  const vol = (title.match(/\bج\s*\d+/) || [])[0] || '';
  const page = (title.match(/\bص\s*\d+/) || [])[0] || '';
  const pos = [vol, page].filter(Boolean).join(' ');
  return [book, collapse(author), pos].filter(Boolean).join(' — ');
}

// (1) Brave web search restricted to the approved domains via a site: filter.
async function searchWeb(query, num = 3, sites) {
  if (!process.env.BRAVE_API_KEY) {
    throw new Error('BRAVE_API_KEY missing');
  }
  const q = `${query} (${siteFilterFor(sites)})`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${num}`;
  const r = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.BRAVE_API_KEY,
    },
  });
  if (!r.ok) {
    console.warn(`[retrieve] Brave HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    return [];
  }
  const data = await r.json();
  const items = (data.web && data.web.results) || [];
  return items.map((x) => ({ title: x.title, link: x.url, snippet: x.description || '' }));
}

// (2) Fetch page + strip boilerplate via Readability. Own AbortController timeout.
export async function fetchAndClean(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let html = '';
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    // Read text even on non-2xx so we can see what actually came back.
    html = await res.text().catch(() => '');
  } finally {
    clearTimeout(timer);
  }

  const rawLen = html.length;
  const finalUrl = res.url;

  // Non-2xx: report the status; don't bother parsing.
  if (!res.ok) {
    return { title: '', text: '', rawLen, note: `fetch-failed HTTP ${res.status}`, finalUrl };
  }

  // Cloudflare / JS-challenge detector — skip Readability on a challenge page.
  const blocked =
    /Just a moment|Attention Required|cf-browser-verification|_cf_chl_opt|Enable JavaScript and cookies/i.test(
      html
    );
  if (blocked) {
    const { document: doc } = parseHTML(html);
    return {
      title: collapse(doc.title),
      text: '',
      rawLen,
      note: 'BLOCKED (cloudflare/js-challenge)',
      finalUrl,
    };
  }

  const { document: doc } = parseHTML(html);

  // al-Khamis polemic gate: drop the sect-polemic category via the site's badge.
  if (isKhameesBlocked(url, finalUrl, doc)) {
    return { title: collapse(doc.title), text: '', rawLen, note: 'BLOCKED (khamees-polemic)', finalUrl };
  }

  // tafsir.app book gate: drop excluded tafsir books (al-Kashshaf, al-Razi) by URL slug.
  if (isTafsirAppBookBlocked(url, finalUrl)) {
    return { title: collapse(doc.title), text: '', rawLen, note: 'BLOCKED (tafsir-book-excluded)', finalUrl };
  }

  // dr-mutlaq.com gate: a video page carries no written transcript, so it cannot back a
  // citation no matter how much chrome text it yields.
  if (isMutlaqNonTextBlocked(url, finalUrl)) {
    return { title: collapse(doc.title), text: '', rawLen, note: 'BLOCKED (mutlaq-video-no-transcript)', finalUrl };
  }

  // shamela.ws gate: only a specific /book/{id}/{page} page may be cited.
  if (isShamelaNonBookBlocked(url, finalUrl)) {
    return { title: collapse(doc.title), text: '', rawLen, note: 'BLOCKED (shamela-not-a-book-page)', finalUrl };
  }

  let title = collapse(doc.title);
  let text = '';
  let note = 'clean';
  let titleLocked = false;   // set when a per-site rule has already built the real label

  // shamela.ws: take the citation label and the passage from the page's own markup.
  // `.nass` is the book text itself, which is far cleaner than the raw-text fallback
  // Readability leaves us with on this template. No identifiable book => reject, so a
  // Shamela card can never say less than "book — author — position".
  if (onHost(finalUrl || url, SHAMELA_HOST)) {
    const label = shamelaLabel(doc);
    if (!label) {
      return { title, text: '', rawLen, note: 'BLOCKED (shamela-unidentifiable-book)', finalUrl };
    }
    const nass = collapse(stripMarks([...doc.querySelectorAll('.nass')].map((n) => n.textContent).join(' ')));
    if (nass.length >= 200) {
      return { title: label, text: nass, rawLen, note: 'clean (shamela-nass)', finalUrl };
    }
    title = label;   // fall through to the generic extraction, but keep the real label
    titleLocked = true;
  }

  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    if (article && collapse(article.textContent).length > 200) {
      if (!titleLocked) title = collapse(article.title) || title;
      text = collapse(article.textContent);
    } else {
      note = 'raw-fallback (needs per-site selector)';
      text = collapse(doc.body ? doc.body.textContent : '');
    }
  } catch (e) {
    note = 'raw-fallback (needs per-site selector)';
    text = collapse(doc.body ? doc.body.textContent : '');
  }

  return { title, text, rawLen, note, finalUrl };
}

const NO_SOURCE_TEXT =
  'لم يُعثر على مصدرٍ موثوقٍ في المواقع المعتمدة للإجابة عن هذا السؤال.';

// Public API. Brave-search the query, fetch+clean the top FETCH_PER_CALL hits in
// parallel (each with its own timeout), keep the FIRST clean one and stop, and
// format one tool_result string. Degrades to NO_SOURCE_TEXT (never fabricates)
// when nothing is usable.
async function runSearchPass(
  query,
  sites,
  { maxResults = 5, perFetchTimeoutMs = 8000, maxChars = 2500, band } = {}
) {
  let results = [];
  try {
    results = await searchWeb(query, maxResults, sites);
  } catch (e) {
    console.warn(`[retrieve] search failed: ${e.message}`);
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  if (results.length === 0) {
    console.warn('[retrieve] no Brave results');
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  // #5: the band's allow-list, enforced against every FINAL (post-redirect) host
  // below. Brave's site: filter is only a soft hint and redirect:'follow' can
  // land off-list, so this is the hard gate that keeps unvetted domains out of a
  // child's answer.
  const allowSites = sites;

  // Fetch+clean one wave of candidates in parallel and return the FIRST clean one
  // (at most one source per angle, unchanged). Sequential would blow the time budget;
  // each fetch owns its timeout.
  const tryWave = async (wave) => {
    const settled = await Promise.allSettled(
      wave.map((r) => fetchAndClean(r.link, perFetchTimeoutMs))
    );
    for (let i = 0; i < wave.length; i++) {
      const r = wave[i];
      const host = hostname(r.link);
      const outcome = settled[i];
      if (outcome.status !== 'fulfilled') {
        console.warn(`[retrieve] failed ${host} — ${r.link} (${outcome.reason && outcome.reason.message})`);
        continue;
      }
      const { title, text, note, finalUrl } = outcome.value;
      // #5 hard allow-list enforcement: drop anything whose FINAL host is off-list,
      // regardless of what Brave returned or where a redirect landed us.
      const finalHost = hostname(finalUrl);
      if (!hostAllowed(finalHost, allowSites)) {
        console.warn(`[retrieve] off-list ${finalHost} -- ${finalUrl} (band=${band || 'unknown'})`);
        continue;
      }
      if (/^BLOCKED/.test(note)) {
        console.warn(`[retrieve] blocked ${host} — ${finalUrl} (${note})`);
        continue;
      }
      if (/^fetch-failed/.test(note)) {
        console.warn(`[retrieve] failed ${host} — ${finalUrl} (${note})`);
        continue;
      }
      if (text.length < 200) {
        console.warn(`[retrieve] thin ${host} — ${finalUrl} (${text.length} chars)`);
        continue;
      }
      console.warn(`[retrieve] clean ${host} — ${finalUrl} (${text.length} chars, ${note})`);
      return { title: title || r.title || finalUrl, url: finalUrl, passage: text.slice(0, maxChars) };
    }
    return null;
  };

  // Wave 1 is the whole cost of the ordinary case: the top FETCH_PER_CALL candidates,
  // first clean one wins, done. Wave 2 exists because a per-site gate or an edge that
  // serves us a bot challenge (both now realistic — several vetted hosts sit behind
  // Cloudflare) can burn every slot in wave 1 and leave the angle empty. Without it,
  // two unusable candidates at the top of Brave's list would sink an otherwise
  // answerable question. It runs ONLY on a wholly empty wave 1 — i.e. only in the case
  // that returns NO_SOURCE_TEXT today — so no successful question pays for it.
  const kept = [];
  const first = await tryWave(results.slice(0, FETCH_PER_CALL));
  if (first) kept.push(first);
  else {
    const rest = results.slice(FETCH_PER_CALL, FETCH_PER_CALL * 2);
    if (rest.length) {
      console.warn(`[retrieve] wave 1 empty — trying ${rest.length} more candidate(s)`);
      const second = await tryWave(rest);
      if (second) kept.push(second);
    }
  }

  if (kept.length === 0) {
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  const divider = '\n' + '─'.repeat(40) + '\n';
  const text = kept
    .map((k, i) => `「المصدر ${i + 1}: ${k.title} — ${k.url}」\n${k.passage}`)
    .join(divider);

  return { text, sources: kept.map((k) => ({ title: k.title, url: k.url })) };
}

// Public API. Age-tiered search (khilaf-policy §3/§6). Adult: ONE pass over the
// full vetted list. Under-18 (fail-CLOSED - ANY band that is not 'adult'): a
// PRIMARY pass over the Ibn-Baz-aligned sources first, and ONLY if it returns
// nothing, ONE fallback pass over the contemporary source (eftaa). So a child
// gets a single consistent answer, and post-Ibn-Baz matters (crypto/banking) are
// answered instead of failing silent. The fallback runs at most once and only on
// an empty primary, so ordinary questions cost zero extra Brave calls.
export async function retrieve(query, opts = {}) {
  const tiers =
    opts.band === 'adult' ? [SITES_ADULT] : [SITES_MINOR, SITES_MINOR_FALLBACK];
  for (let t = 0; t < tiers.length; t++) {
    const pass = await runSearchPass(query, tiers[t], opts);
    if (pass.sources.length > 0) return pass; // first tier with a real source wins
  }
  return { text: NO_SOURCE_TEXT, sources: [] };
}
