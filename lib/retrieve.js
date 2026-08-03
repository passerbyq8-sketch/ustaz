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
import { filterSitesForPurpose } from './source-registry.js';
import { classifyPurpose } from './source-purpose.js';
import { gateSourcePage, hasPageRules, pathRefusal } from './source-page-gates.js';
import { planQueries, measureQuery, isSendable } from './brave-query.js';

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
  // shamela.ws was added here on 2026-07-31 and REMOVED on 2026-08-01: the Brave API
  // never surfaced a citable /book/{id}/{page} page for it. An instrumented production
  // request measured 10 results with 0 citable candidates, and asking for the book path
  // with 20 results did not change the outcome. Every other link in that chain worked
  // (routing, filtering, fetching, book/author/position extraction), so this is an index
  // limitation rather than a defect -- but a source that can never produce a card is only
  // a detour, so the whole integration is gone rather than left dormant.
  'dorar.net', 'dr-mutlaq.com',
  // added 2026-08-03 (each probed live, server-side, with the production header set; the
  // measurements are recorded per-domain in lib/source-registry.js and the page-level rules
  // they made necessary in lib/source-page-gates.js).
  //
  // TWO OF THESE ARE NOT SIMPLY "MORE SITES", and the difference is the point of the change
  // that added them:
  //   * eftaa.awqaf.gov.kw is NOT new. It has been the under-18 fallback tier since before
  //     this line existed; what is new is that ADULTS can now reach it too. There is exactly
  //     one row for it in the registry and exactly one entry here -- widening a source's
  //     reach is not the same as adding it twice.
  //   * several of these carry a SCOPE. khaledalsabt.com is tafsir, khutabaa.com is
  //     khutbahs, salafcenter.org is creedal research, almunajjid.com is lessons and
  //     articles, and saleh.af.org.sa publishes its fatwas only as audio. None of them may
  //     back a ruling, and filterSitesForPurpose() below is what enforces that. This array
  //     stays the single list of WHAT MAY BE FETCHED; the registry decides WHAT FOR.
  //
  // shkhudheir.com was named for this batch and is DELIBERATELY ABSENT: probed 2026-08-03,
  // it is a parked domain serving a 114-byte redirect stub on every path. See the registry
  // row for the evidence. It is recorded there rather than here so that it cannot be
  // fetched, and so the gate can prove it is on no list.
  'eftaa.awqaf.gov.kw',
  'saleh.af.org.sa', 'khaledalsabt.com', 'ibn-jebreen.com', 'mostafaaladwy.com',
  'almunajjid.com', 'khutabaa.com', 'salafcenter.org',
  // added 2026-08-03, second batch. Both probed live and both scope-restricted.
  //
  // tafsir.net IS NOT tafsir.app. The two sit next to each other in this array and are two
  // different organisations: tafsir.app is «الباحث القرآني», an aggregator of ~50 classical
  // tafsir books; tafsir.net is «مركز تفسير للدراسات القرآنية», a research centre publishing
  // original studies by named researchers. Neither reprints the other. Adding the second is
  // therefore not a duplicate of the first, and source-registry-guard.cjs asserts that both
  // exist as independent rows so a later tidy-up cannot merge them.
  'tafsir.net',
  // al-abbaad.com is admitted for its single ARTICLE pages only; every catalogue path under
  // it is refused from the URL, and its recordings carry no transcript.
  'al-abbaad.com',
];
// The `site:` filter is no longer built here. lib/brave-query.js owns query ASSEMBLY and
// query MEASUREMENT together, on purpose: the defect that took adult retrieval down was a
// query built in one place and never measured in any, and two formulas in two files is how
// that comes back. retrieve() still picks the LIST per age-tier — the fail-CLOSED age gate
// is unchanged and lives in retrieve() below — and the same list object still drives both
// the query and the post-fetch host enforcement in runSearchPass, so query and enforcement
// cannot drift within a pass.

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

// (1) Brave web search restricted to the approved domains via a site: filter.
async function searchWeb(q, num = 3, label = '') {
  if (!process.env.BRAVE_API_KEY) {
    throw new Error('BRAVE_API_KEY missing');
  }
  // THE LAST GUARD BEFORE THE WIRE. planQueries() already builds to our own limit, but a
  // query is worth one more check at the point of sending: an over-long `q` is not a
  // degraded search, it is NO search, and the failure is silent at every layer above.
  const m = measureQuery(q);
  if (!isSendable(q)) {
    console.warn(`[retrieve] REFUSING over-long query ${label} (${m.chars} chars / ${m.words} words) -- not sent`);
    return [];
  }
  console.warn(`[retrieve] brave ${label} ${m.chars}c/${m.words}w`);
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

  let title = collapse(doc.title);
  let text = '';
  let note = 'clean';

  // dr-mutlaq.com: the citation must rest on the article's OWN text, never on chrome.
  if (onHost(finalUrl || url, MUTLAQ_HOST)) {
    const body = mutlaqBody(doc);
    if (body.length < MUTLAQ_MIN_TEXT) {
      return { title, text: '', rawLen, note: 'BLOCKED (mutlaq-no-extractable-text)', finalUrl };
    }
    return { title, text: body, rawLen, note: 'clean (mutlaq-entry-content)', finalUrl };
  }

  let byline = '';
  let usedReadability = false;
  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    if (article && collapse(article.textContent).length > 200) {
      title = collapse(article.title) || title;
      text = collapse(article.textContent);
      byline = collapse(article.byline || '');
      usedReadability = true;
    } else {
      note = 'raw-fallback (needs per-site selector)';
      text = collapse(doc.body ? doc.body.textContent : '');
    }
  } catch (e) {
    note = 'raw-fallback (needs per-site selector)';
    text = collapse(doc.body ? doc.body.textContent : '');
  }

  // PER-PAGE ADMISSION, for the hosts that declared rules (lib/source-page-gates.js).
  //
  // It runs LAST, on the extracted text, because that is the only point at which the two
  // questions it settles can be answered: is this page an ANSWER rather than a catalogue,
  // and WHO is it by. A host with no rules skips this entirely and returns exactly what it
  // returned before, which is what keeps every pre-existing source unchanged.
  if (hasPageRules(finalUrl || url)) {
    const gated = gateSourcePage({ url, finalUrl, doc, title, text, usedReadability, byline });
    if (!gated.ok) return { title, text: '', rawLen, note: gated.note, finalUrl };
    return {
      title: gated.title || title,
      text: gated.text,
      rawLen,
      note: note + ' (page-gated)',
      finalUrl,
      author: gated.author,
      attributionType: gated.attributionType,
    };
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
  { maxResults = 5, perFetchTimeoutMs = 8000, maxChars = 2500, band, maxWaves = 2, purpose } = {}
) {
  // ── BOUNDED QUERIES ────────────────────────────────────────────────────────
  // The allow-list is split into as many groups as it takes for EVERY request to sit under
  // our own limit, which is under the provider's. Nothing is dropped: the union of the
  // groups is the input list (brave-query-guard.cjs proves it), so a domain that does not
  // fit in group 1 is searched in group 2 rather than quietly disappearing.
  //
  // The groups are tried IN ORDER and the loop stops at the first verified source, so the
  // ordinary question costs exactly the one Brave call it costs today. Only a question that
  // group 1 cannot answer pays for group 2 — and before this, that question had no answer
  // at all, because the single over-long query was refused outright.
  const plan = planQueries(query, sites, { purpose });
  if (plan.shortened) {
    console.warn(`[retrieve] question shortened to fit the query budget: "${plan.question}"`);
  }
  if (!plan.groups.length) return { text: NO_SOURCE_TEXT, sources: [] };
  console.warn(`[retrieve] plan: ${plan.groups.length} group(s) — `
    + plan.groups.map((g) => `#${g.index}:${g.sites.length} sites ${g.chars}c/${g.words}w`).join(', '));

  // #5: the band's allow-list, enforced against every FINAL (post-redirect) host
  // below. Brave's site: filter is only a soft hint and redirect:'follow' can
  // land off-list, so this is the hard gate that keeps unvetted domains out of a
  // child's answer.
  const allowSites = sites;

  // Fetch+clean one wave of candidates in parallel and return the FIRST clean one
  // (at most one source per angle, unchanged). Sequential would blow the time budget;
  // each fetch owns its timeout.
  // A page fetched for group 1 is not fetched again for group 2. Brave can and does return
  // the same URL under two different site: filters, and paying for it twice would be the
  // "dozens of requests" this design is required not to become.
  const fetched = new Set();
  const seenKey = (u) => {
    try {
      const x = new URL(u);
      return x.hostname.toLowerCase().replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search;
    } catch { return String(u || ''); }
  };

  const tryWave = async (waveIn) => {
    // Skip candidates on a host we already know is refusing us: no fetch, no wait. This
    // is what keeps a blocked host from costing every later question its full timeout.
    const wave = waveIn.filter((r) => {
      if (isBreakerOpen(hostname(r.link))) {
        console.warn(`[retrieve] breaker-skip ${hostname(r.link)} — ${r.link}`);
        return false;
      }
      const k = seenKey(r.link);
      if (fetched.has(k)) {
        console.warn(`[retrieve] dup-skip ${hostname(r.link)} — already tried in an earlier group`);
        return false;
      }
      fetched.add(k);
      // A URL that is a section index or a media catalogue on its own site can be refused
      // from the URL alone, so it is refused BEFORE the fetch rather than after it. Costs
      // nothing, and it is the same rule the post-fetch gate applies, so the two cannot
      // disagree about what a listing is.
      const why = pathRefusal(r.link, '');
      if (why) {
        console.warn(`[retrieve] path-skip ${hostname(r.link)} — ${r.link} (${why})`);
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
      const { title, text, note, finalUrl, author, attributionType } = outcome.value;
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
      console.warn(`[retrieve] clean ${host} — ${finalUrl} (${text.length} chars, ${note}${author ? ', by ' + author : ''})`);
      return {
        title: title || r.title || finalUrl,
        url: finalUrl,
        passage: text.slice(0, maxChars),
        // Carried, never required. Only the page-gated hosts populate these; every existing
        // consumer reads title/url/passage and is unaffected by two extra keys. They exist
        // so that "who published this" travels WITH the page instead of being inferred from
        // the domain later, which is how a personal answer ends up wearing a committee's name.
        author: author || '',
        attributionType: attributionType || '',
      };
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
  for (const group of plan.groups) {
    let results = [];
    try {
      results = await searchWeb(group.q, maxResults, `group ${group.index}/${plan.groups.length} (${group.sites.length} sites)`);
    } catch (e) {
      // A transport failure on one group is not the end of the question: the next group is
      // a different request and may well succeed. What is NOT allowed is inventing a source
      // — an empty result set stays empty and the caller refuses to answer.
      console.warn(`[retrieve] search failed on group ${group.index}: ${e.message}`);
      continue;
    }
    if (results.length === 0) {
      console.warn(`[retrieve] no Brave results for group ${group.index}`);
      continue;
    }

    const first = await tryWave(results.slice(0, FETCH_PER_CALL));
    if (first) { kept.push(first); break; }        // early stop: the question is answered
    // Wave 2 exists because a per-site gate or a bot challenge can burn every slot in wave 1.
    // It runs on the LAST group only: while another group remains, a fresh set of domains is
    // a better use of the budget than more candidates from a filter that just came up empty.
    const isLast = group.index === plan.groups.length;
    if (maxWaves > 1 && isLast) {
      const rest = results.slice(FETCH_PER_CALL, FETCH_PER_CALL * 2);
      if (rest.length) {
        console.warn(`[retrieve] group ${group.index} wave 1 empty — trying ${rest.length} more candidate(s)`);
        const second = await tryWave(rest);
        if (second) { kept.push(second); break; }
      }
    }
    if (!isLast) console.warn(`[retrieve] group ${group.index} produced nothing — trying group ${group.index + 1}`);
  }

  if (kept.length === 0) {
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  const divider = '\n' + '─'.repeat(40) + '\n';
  const text = kept
    .map((k, i) => `「المصدر ${i + 1}: ${k.title} — ${k.url}」\n${k.passage}`)
    .join(divider);

  // `passage` is carried alongside title/url so a caller can check whether a page actually
  // SUPPORTS the claim it is about to be cited for, instead of trusting the fact that it came
  // back from an allow-listed host. Additive: every existing consumer reads title/url and is
  // unaffected. See lib/claim-gate.js — a card whose page never mentions the phrase the reader
  // asked about is a citation, not evidence.
  return {
    text,
    sources: kept.map((k) => ({
      title: k.title, url: k.url, passage: k.passage,
      author: k.author || '', attributionType: k.attributionType || '',
    })),
  };
}

// Per-domain tuning for the TARGETED pass only. Anything not listed here keeps the
// plain targeted behaviour, so the dorar.net and dr-mutlaq.com paths are untouched.
//
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
  const rawTiers =
    opts.band === 'adult' ? [SITES_ADULT] : [SITES_MINOR, SITES_MINOR_FALLBACK];

  // ── SCOPE ──────────────────────────────────────────────────────────────────
  // What KIND of question is this, and which of the band's sources are allowed to answer
  // that kind? A khutbah archive is a fine source for an exhortation and must never be the
  // evidence behind a ruling on divorce; a tafsir site answers what a verse means and not
  // what a reader must do. Before this, "on the allow-list" and "may answer this" were the
  // same sentence, and there was no way to admit a source for one and not the other.
  //
  // WHY THIS CANNOT DEGRADE WHAT ALREADY WORKED: every source that predates the registry
  // carries ALL_SCOPES, so for any purpose whatever, filtering removes none of them and
  // each tier is the array it was. Narrowing only ever applies to a source that was
  // admitted on the condition of being narrowed. source-registry-guard.cjs proves it.
  const purpose = classifyPurpose(query);
  const tiers = rawTiers.map((t) => filterSitesForPurpose(t, purpose));
  if (tiers.some((t, i) => t.length !== rawTiers[i].length)) {
    console.warn(`[retrieve] purpose=${purpose} narrowed the tier(s): `
      + rawTiers.map((t, i) => `${t.length}->${tiers[i].length}`).join(', '));
  }

  // ── targeted pass ──────────────────────────────────────────────────────────
  const intent = classifySourceIntent(query, { band: opts.band, depth: opts.depth });
  if (intent) {
    // The band's PRIMARY list is the authority. dr-mutlaq.com is absent from SITES_MINOR,
    // so a minor can never be routed to it however the query is worded. The list consulted
    // is the SCOPED one, so targeting can no more escape a scope rule than it can escape
    // the age band.
    const bandList = tiers[0];
    if (!bandList.includes(intent.domain)) {
      console.warn(`[retrieve] intent ${intent.domain} (${intent.reason}) not on band list — skipping`);
    } else if (isBreakerOpen(intent.domain)) {
      console.warn(`[retrieve] intent ${intent.domain} (${intent.reason}) breaker OPEN — straight to general search`);
    } else {
      console.warn(`[retrieve] targeted ${intent.domain} (${intent.reason})`);
      const targeted = await runSearchPass(query, [intent.domain], { ...opts, purpose, maxWaves: 1 });
      if (targeted.sources.length > 0) return targeted;
      console.warn(`[retrieve] targeted ${intent.domain} empty — falling back to general search`);
    }
  }

  // ── ordinary search (unchanged) ────────────────────────────────────────────
  for (let t = 0; t < tiers.length; t++) {
    const pass = await runSearchPass(query, tiers[t], { ...opts, purpose });
    if (pass.sources.length > 0) return pass; // first tier with a real source wins
  }
  return { text: NO_SOURCE_TEXT, sources: [] };
}
