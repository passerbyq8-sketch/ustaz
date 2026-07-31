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
import { classifySourceIntent } from './source-intent.js';

// ── HOST CIRCUIT BREAKER ─────────────────────────────────────────────────────
// Some vetted hosts sit behind an edge that answers a server-side fetch with a bot
// challenge (dorar.net returns HTTP 403 + a Cloudflare interstitial on every path,
// including its documented JSON API). Without a breaker, EVERY hadith question re-pays
// the same guaranteed failure before falling back.
//
// MEASURED, so the value is not oversold: dorar REFUSES FAST (~65-245ms), it does not
// hang, so the saving is not a rescued timeout. What the breaker actually removes per
// later question is the whole targeted detour -- the site-scoped Brave call AND the
// doomed fetch -- which is the larger cost of the two and is pure dead time for the
// reader. A host that fails by TIMING OUT instead would save the full perFetchTimeoutMs,
// which is the case this also protects against.
//
// The first failure of that shape trips a short in-memory breaker for the host: for the
// next BREAKER_TTL_MS we skip it instantly and go straight to the ordinary search. It is
// per-instance and deliberately NOT persisted: Fluid Compute reuses a warm instance
// across requests so it does its job, while a cold instance re-probes on its own, which
// is what makes the block self-heal the moment access is granted. Nothing is cached
// except the FAILURE, so this can never serve stale CONTENT.
const BREAKER_TTL_MS = 10 * 60 * 1000;
const hostBreaker = new Map();   // registrable host -> epoch ms until which it stays open

function breakerKey(host) {
  return (host || '').toLowerCase().replace(/^www\./, '');
}
export function isBreakerOpen(host, now = Date.now()) {
  const until = hostBreaker.get(breakerKey(host));
  if (until === undefined) return false;
  if (until <= now) { hostBreaker.delete(breakerKey(host)); return false; }
  return true;
}
export function tripBreaker(host, why, now = Date.now()) {
  const k = breakerKey(host);
  if (!k) return;
  hostBreaker.set(k, now + BREAKER_TTL_MS);
  console.warn(`[retrieve] circuit-breaker OPEN for ${k} (${why}) for ${BREAKER_TTL_MS / 60000}min`);
}
// Test seam only — never called by the request path.
export function resetBreakers() { hostBreaker.clear(); }

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
// Plain `site:domain`, never a path-scoped `site:domain/path`. A path-scoped operator
// verifiably works on Brave's WEB UI but could not be shown to work on the SEARCH API,
// and when the API does not honour it the pass gets zero results and bails -- which is
// how the targeted Shamela pass kept failing fast with no fetch at all. Narrowing to a
// sub-path is the candidate filter's job (it runs on URLs we already hold and cannot
// misfire), not the query's.
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
//
// A SECOND problem on this host, found by walking its own post-sitemap once (70 posts,
// 2026-08-01): only 15 of them carry real HTML body text. The rest render a PDF-embed
// viewer or a download button, so their visible article body is a few dozen characters
// like "عدد المشاهدات: 977 No related posts." -- yet the whole PAGE still yields ~22k
// characters of navigation chrome, which sails past the generic 200-char gate. Citing
// one of those is citing a page whose actual content nobody read. So for this host the
// passage must come from .entry-content with the boilerplate removed, and must clear
// MUTLAQ_MIN_TEXT on its own; a PDF-embed page is rejected exactly like a video page.
const MUTLAQ_HOST = 'dr-mutlaq.com';
const MUTLAQ_BLOCKED_PREFIXES = ['/aiovg_videos', '/player-embed', '/user-videos'];
const MUTLAQ_MIN_TEXT = 400;
// View counter, "no related posts", the PDF-viewer chrome and leftover shortcodes. These
// are the strings that made an empty page look full.
function mutlaqBody(doc) {
  const ec = doc.querySelector('.entry-content');
  if (!ec) return '';
  return collapse(
    stripMarks(ec.textContent)
      .replace(/عدد المشاهدات:\s*[\d٠-٩٫٬,.\s]*/g, ' ')
      .replace(/No related posts\./gi, ' ')
      .replace(/Loading\.\.\.[\s\S]*?Open in new tab/gi, ' ')
      .replace(/Taking too long\?\s*Reload document/gi, ' ')
      .replace(/تحميل\s*\[[^\]]*\]/g, ' ')
      .replace(/\[su_[^\]]*\]/g, ' ')
  );
}
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

// PRE-FETCH candidate test for the targeted Shamela pass. Stricter than the gate above
// in one decisive way: it requires the PAGE segment, i.e. /book/{bookId}/{page} and not
// merely /book/{bookId}.
//
// Why this exists at all. `site:shamela.ws` matches every path on the host, and the
// pages Brave ranks highest are exactly the ones that are useless as a citation: the
// home page, /category listings (one probed at ~182k characters of link text, so it
// looks content-rich to any ranker) and a book's own index page. Those were being taken
// as the top two hits and consuming BOTH fetch slots, only to be rejected after the
// fetch -- so the targeted pass "failed" without ever having looked at a real book page.
// Filtering candidates BEFORE they are split into waves is what fixes that: a slot is
// only ever spent on a URL that could actually become a card.
export function isShamelaBookPageUrl(u) {
  if (!onHost(u, SHAMELA_HOST)) return false;
  const ref = shamelaBookRef(u);
  return !!(ref && ref.page);
}

// Build the "book — author — position" label a Shamela card must carry, reading the
// page's OWN markup rather than guessing from the URL:
//   h1                     -> "كتاب صحيح مسلم - ت عبد الباقي"
//   .page-header "[...]"   -> the author shorthand, e.g. "[مسلم]"
//   <title> "ج1 - ص29"     -> volume/page position
// Returns '' when the book cannot be identified, which the caller treats as a reject:
// an unattributable Shamela page is exactly what the rule above forbids citing.
// NOTE ON THE BOUNDARIES: `\b` cannot be used here. JS `\b` is defined against [A-Za-z0-9_],
// so Arabic letters count as NON-word characters and `\bج` can only match when the previous
// character is ASCII-alphanumeric -- i.e. essentially never in an Arabic title. An earlier
// revision used `\bج\s*\d+` and silently produced position-less labels. Anchor on
// start-or-whitespace instead.
const VOL_RE = /(?:^|\s)(ج\s*\d+)/;
const PAGE_RE = /(?:^|\s)(ص\s*\d+)/;
function shamelaLabel(doc, finalUrl) {
  const book = collapse(stripMarks(doc.querySelector('h1')?.textContent));
  if (!book) return '';
  const header = collapse(stripMarks(doc.querySelector('.page-header')?.textContent));
  const author = collapse((header.match(/\[([^\]]{1,60})\]/) || [])[1] || '');
  const title = collapse(stripMarks(doc.title));
  const vol = (title.match(VOL_RE) || [])[1] || '';
  let page = (title.match(PAGE_RE) || [])[1] || '';
  // Fall back to the page number in the URL itself, which is always present on a page
  // that passed shamelaBookRef, so a citation is never left without a position.
  if (!page) {
    const ref = shamelaBookRef(finalUrl || '');
    if (ref && ref.page) page = 'ص' + ref.page;
  }
  const pos = [vol, page].filter(Boolean).join(' ');
  // The brief: book, author AND position are all required; an unattributable or
  // unlocatable page is refused rather than cited vaguely.
  if (!author || !pos) return '';
  return `${book} — ${author} — ${pos}`;
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

  // Non-2xx: report the status; don't bother parsing. A 403/429/503 is the signature of
  // an edge refusing server-side clients rather than a missing page, so it trips the
  // breaker and spares every later question the same wait.
  if (!res.ok) {
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      tripBreaker(hostname(finalUrl) || hostname(url), `HTTP ${res.status}`);
    }
    return { title: '', text: '', rawLen, note: `fetch-failed HTTP ${res.status}`, finalUrl };
  }

  // Cloudflare / JS-challenge detector — skip Readability on a challenge page.
  const blocked =
    /Just a moment|Attention Required|cf-browser-verification|_cf_chl_opt|Enable JavaScript and cookies/i.test(
      html
    );
  if (blocked) {
    const { document: doc } = parseHTML(html);
    tripBreaker(hostname(finalUrl) || hostname(url), 'cloudflare/js-challenge');
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
    const label = shamelaLabel(doc, finalUrl || url);
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

  // dr-mutlaq.com: the citation must rest on the article's OWN text, never on chrome.
  if (onHost(finalUrl || url, MUTLAQ_HOST)) {
    const body = mutlaqBody(doc);
    if (body.length < MUTLAQ_MIN_TEXT) {
      return { title, text: '', rawLen, note: 'BLOCKED (mutlaq-no-extractable-text)', finalUrl };
    }
    return { title, text: body, rawLen, note: 'clean (mutlaq-entry-content)', finalUrl };
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
  // maxWaves: the targeted pass runs ONE wave only. Its whole job is to be fast and then
  // get out of the way -- if the specialised source does not answer immediately, the
  // ordinary search is about to run anyway, so a second wave there would be pure delay.
  // candidateFilter: set only by a targeted pass that knows the shape of a citable URL on
  // its host. Defaults to off, so every ordinary pass is unchanged.
  {
    maxResults = 5, perFetchTimeoutMs = 8000, maxChars = 2500, band, maxWaves = 2,
    candidateFilter = null,
  } = {}
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

  // Drop non-citable URLs BEFORE the wave split, so an index or category page can never
  // occupy a fetch slot. Costs nothing: it is a string test on results we already have,
  // and it never triggers another Brave call. If it empties the list the pass returns at
  // once and the caller falls back to the general search -- which is strictly faster than
  // the old behaviour of fetching two doomed pages first.
  if (candidateFilter) {
    const before = results.length;
    results = results.filter((r) => candidateFilter(r.link));
    console.warn(`[retrieve] candidate-filter kept ${results.length}/${before} for ${sites.join(',')}`);
    if (results.length === 0) {
      console.warn('[retrieve] no citable candidates after filter');
      return { text: NO_SOURCE_TEXT, sources: [] };
    }
  }

  // #5: the band's allow-list, enforced against every FINAL (post-redirect) host
  // below. Brave's site: filter is only a soft hint and redirect:'follow' can
  // land off-list, so this is the hard gate that keeps unvetted domains out of a
  // child's answer.
  const allowSites = sites;

  // Fetch+clean one wave of candidates in parallel and return the FIRST clean one
  // (at most one source per angle, unchanged). Sequential would blow the time budget;
  // each fetch owns its timeout.
  const tryWave = async (waveIn) => {
    // Skip candidates on a host we already know is refusing us: no fetch, no wait. This
    // is what keeps a blocked host from costing every later question its full timeout.
    const wave = waveIn.filter((r) => {
      if (isBreakerOpen(hostname(r.link))) {
        console.warn(`[retrieve] breaker-skip ${hostname(r.link)} — ${r.link}`);
        return false;
      }
      return true;
    });
    if (wave.length === 0) return null;
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
  else if (maxWaves > 1) {
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

// Per-domain tuning for the TARGETED pass only. Anything not listed here keeps the
// plain targeted behaviour, so the dorar.net and dr-mutlaq.com paths are untouched.
//
// shamela.ws: ask for more candidates, then keep only real book PAGES.
//   * 10 results (still ONE Brave request -- `count` is a page size, not a call count)
//     so that a citable /book/{id}/{page} URL is likely to be in the list at all. A
//     probe of a plain `site:shamela.ws` query returned 6 such URLs among 17 hits, mixed
//     in with the home page, /search, /authors and book index pages;
//   * the filter is the guarantee: a non-citable URL cannot reach a fetch slot, so the
//     two slots are spent on pages that could actually become a card.
// No path-scoped `site:` operator -- see siteFilterFor for why that was removed.
// The fetch fan-out is NOT widened: FETCH_PER_CALL is still 2 per wave and the targeted
// pass still runs a single wave, so at most two pages are ever fetched.
const TARGETED_TUNING = {
  'shamela.ws': {
    maxResults: 10,
    candidateFilter: isShamelaBookPageUrl,
  },
};

// Public API. Age-tiered search (khilaf-policy §3/§6). Adult: ONE pass over the
// full vetted list. Under-18 (fail-CLOSED - ANY band that is not 'adult'): a
// PRIMARY pass over the Ibn-Baz-aligned sources first, and ONLY if it returns
// nothing, ONE fallback pass over the contemporary source (eftaa). So a child
// gets a single consistent answer, and post-Ibn-Baz matters (crypto/banking) are
// answered instead of failing silent. The fallback runs at most once and only on
// an empty primary, so ordinary questions cost zero extra Brave calls.
//
// TARGETED FIRST (2026-08-01). Before the ordinary search, a small deterministic
// classifier (lib/source-intent.js) asks whether this query is the kind of question ONE
// vetted source is specifically the right place to look. If so we run a single
// site-scoped Brave search against that domain and, if it yields a usable page, use it.
// The general search never runs in that case, so a targeted hit costs the SAME one Brave
// call an ordinary question costs today.
//
// The guarantees that make this safe to add:
//   * a query matching nothing -- the common case -- takes the untouched path below and
//     pays nothing: no extra classifier I/O (it is pure), no extra call;
//   * the targeted domain must ALREADY be on this band's own allow-list, so targeting can
//     never widen what a child may see, only reorder what is searched first;
//   * at most ONE extra Brave call per angle, and only when the targeted pass fails;
//   * a host whose breaker is open is skipped before the Brave call, not after the fetch,
//     so a blocked source costs nothing at all rather than a timeout;
//   * the ordinary search below is byte-for-byte what it was, so any failure of the
//     targeted pass -- empty, blocked, gated, off-list -- degrades to today's behaviour.
export async function retrieve(query, opts = {}) {
  const tiers =
    opts.band === 'adult' ? [SITES_ADULT] : [SITES_MINOR, SITES_MINOR_FALLBACK];

  // ── targeted pass ──────────────────────────────────────────────────────────
  const intent = classifySourceIntent(query, {
    band: opts.band, depth: opts.depth, userText: opts.userText,
  });
  if (intent) {
    // The band's PRIMARY list is the authority. dr-mutlaq/shamela are absent from
    // SITES_MINOR, so a minor can never be routed to them however the query is worded.
    const bandList = tiers[0];
    if (!bandList.includes(intent.domain)) {
      console.warn(`[retrieve] intent ${intent.domain} (${intent.reason}) not on band list — skipping`);
    } else if (isBreakerOpen(intent.domain)) {
      console.warn(`[retrieve] intent ${intent.domain} (${intent.reason}) breaker OPEN — straight to general search`);
    } else {
      console.warn(`[retrieve] targeted ${intent.domain} (${intent.reason})`);
      const targeted = await runSearchPass(query, [intent.domain], {
        ...opts, maxWaves: 1, ...(TARGETED_TUNING[intent.domain] || {}),
      });
      if (targeted.sources.length > 0) return targeted;
      console.warn(`[retrieve] targeted ${intent.domain} empty — falling back to general search`);
    }
  }

  // ── ordinary search (unchanged) ────────────────────────────────────────────
  for (let t = 0; t < tiers.length; t++) {
    const pass = await runSearchPass(query, tiers[t], opts);
    if (pass.sources.length > 0) return pass; // first tier with a real source wins
  }
  return { text: NO_SOURCE_TEXT, sources: [] };
}
