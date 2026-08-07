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
import { gateSourcePage, hasPageRules, pathRefusal, declaredMinText, pageKind } from './source-page-gates.js';
import { planQueries, measureQuery, isSendable } from './brave-query.js';
// DOES THIS PAGE ANSWER THIS QUESTION? The check that stood between "clean page" and "source" and
// did not exist. See lib/page-match.js for the measured incident it comes from.
import { matchPage, pivotTerms } from './page-match.js';
// THE LEDGER'S DEFENCE, ON THE SHIPPED PATH. Not a second copy of the delimiters and not a
// second marker list — the same module the engine wraps its evidence with, so the two paths
// cannot drift into disagreeing about what "untrusted" looks like.
import { wrapUntrusted, injectionMarkersIn } from './ledger/segment.js';
import { createHash } from 'node:crypto';

// ── THE READER'S WORDS DO NOT GO IN THE LOG ──────────────────────────────────
// The app tells the child that what he reports is not recorded, so the ordinary
// question must not be recorded either. Two lines here used to print the question
// itself (and the pivot words lifted straight out of it) to make the shortener
// diagnosable. The diagnosis needed the SHAPE, never the text: a length, a count,
// and something stable to correlate two lines of one request by.
//
// The fingerprint is a truncated SHA-256. It is one-way, it is not a search key
// for anything we store, and it is short enough to be useless as an identifier
// outside the few log lines of a single request — but equal for the same question,
// which is the whole operational value.
function qFingerprint(s) {
  return createHash('sha256').update(String(s || ''), 'utf8').digest('hex').slice(0, 8);
}

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
// ── WIDENED 2026-08-05, BY AN EXPLICIT DECISION OF THE PROJECT'S OWNER ───────
//
// WHAT THIS CHANGES AND WHAT IT CANNOT. It changes WHICH VETTED PAGES A CHILD'S SEARCH MAY DRAW
// FROM. It changes nothing about what is said to a child: the khilaf policy, the age floor in
// lib/policy/age.js, and the worship lock are all downstream of retrieval and are untouched. A
// child's answer is still one ruling, still age-screened sentence by sentence, still refused
// outright on the topics that must be refused. Only the shelf is bigger.
//
// The eight are the sources already vetted for the adult list whose material is editorially
// reviewed and appropriate — the two originals plus the two big fatwa portals, the Alukah article
// network, the international fiqh academy, the Islamic-history site, and two scholars' own fatwa
// corpora. Every one of them is measured `live-cites` in data/source-liveness.json.
//
// dorar.net IS NAMED IN THE BRIEF AND IS ABSENT, conditionally and for a measured reason: it was
// to be included «إن أُحيي في الخطوة ٥», and it was not revived. Measured the same day, it answers
// HTTP 403 to every server-side request on every path tried, including its own documented
// /dorar_api.json. A list entry that cannot answer is not coverage; it is a guaranteed dead fetch
// on a child's question. The evidence is kept as a `status: 'deferred'` row in
// lib/source-registry.js, so admitting it the day access is granted is a one-line change.
export const SITES_MINOR = [
  'islamqa.info', 'binbaz.org.sa',
  'islamweb.net', 'alukah.net', 'iifa-aifi.org', 'islamstory.com',
  'ibn-jebreen.com', 'almosleh.com',
];
// Under-18 Tier-2 FALLBACK - used ONLY when the primary (SITES_MINOR) returns
// nothing, i.e. contemporary matters that post-date Ibn Baz (crypto, banking).
// Kuwaiti official fatwa dept: issues ONE ruling (not a madhhab comparison), so a
// child still gets a single answer. Vetted server-side (Readability-clean SSR).
// EXPORTED so the ledger path can be given the same list. It was module-private, and the
// consequence was not a style problem: api/ask.js could only hand the engine `SITES_MINOR`, so a
// child on the ledger path searched three domains where a child on the legacy path searched four
// — and the missing one is precisely the source that covers what Ibn Baz did not live to see.
export const SITES_MINOR_FALLBACK = ['eftaa.awqaf.gov.kw'];
export const SITES_ADULT = [
  // original four (vetted in RAG spike)
  'islamweb.net', 'binbaz.org.sa', 'alukah.net', 'islamqa.info',
  // added 2026-07-05 (probed: SSR, Readability-clean)
  'sh-albarrak.com', 'almosleh.com',
  'islamstory.com', 'al-badr.net', 'othmanalkhamees.com',
  // added 2026-07-10 (local server-side probe: clean SSR, Readability-extracted)
  // ferkous.APP since 2026-08-05: ferkous.com answers 302 to the new domain on every path, and the
  // redirect lands on HTTP, which buildSourceTag and canonical.js both refuse. tafsir.app is
  // DEFERRED the same day — 200, ~150 KB, empty <body>, zero extractable characters. Both
  // decisions and their measurements are recorded as rows in lib/source-registry.js.
  'iifa-aifi.org', 'ferkous.app',
  // added 2026-07-31 (local server-side probe with the production header set).
  //   dorar.net     -- hadith takhrij + grading, and the Durar fiqh encyclopedia.
  //   dr-mutlaq.com -- articles/research by Dr. Mutlaq al-Jasir; VIDEO post-type is
  //                    gated out below (a video page carries no usable written text).
  // dorar.net was added here on 2026-07-31 and DEFERRED on 2026-08-05: measured HTTP 403 for
  // server-side clients on every path tried, INCLUDING its own documented /dorar_api.json. It is
  // off this list and off SITES_MINOR; the evidence lives in its registry row.
  // shamela.ws was added here on 2026-07-31 and REMOVED on 2026-08-01: the Brave API
  // never surfaced a citable /book/{id}/{page} page for it. An instrumented production
  // request measured 10 results with 0 citable candidates, and asking for the book path
  // with 20 results did not change the outcome. Every other link in that chain worked
  // (routing, filtering, fetching, book/author/position extraction), so this is an index
  // limitation rather than a defect -- but a source that can never produce a card is only
  // a detour, so the whole integration is gone rather than left dormant.
  'dr-mutlaq.com',
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

// ── THE WORLD SOURCE REGISTRY (P0, 2026-08-05) ───────────────────────────────
//
// WHAT THIS LIST IS FOR, AND WHAT IT MUST NEVER TOUCH.
// ----------------------------------------------------
// The app could not answer «ما آخر أخبار غزة اليوم؟». Not because the question was refused —
// because the general route runs with NO tools at all, so the model had nothing but its own
// training cut-off to answer from, and it apologised for it. That is a retrieval hole, not a
// policy: nothing about a news question needs a fatwa source, and nothing about it needs a
// refusal either.
//
// So this is a SECOND, WHOLLY SEPARATE allow-list, reached only by retrieveWorld() below. It
// is not a tier, it is not appended to a band, and retrieve() has no way to reach it:
//
//   * retrieve() still builds `rawTiers` from the age bands ONLY, and opts.onlySites can only
//     ever NARROW those tiers — so no wording of any question can widen a religious search
//     onto a news site;
//   * every domain here carries `scopes: []` in lib/source-registry.js, so
//     sourceAllowsPurpose(d, 'fatwa'|'tafsir'|'hadith'|'general') is FALSE for all four. A
//     news page can therefore never be admitted as evidence for a religious purpose even if a
//     future edit did merge the lists;
//   * the two lists are DISJOINT, and worldListOverlap() below states that as a value a test
//     can assert rather than a promise a comment makes.
//
// MEASURED 2026-08-05, each through this file's own fetchAndClean() with the production
// header set. Only what actually came back clean is on the list:
//   ar.wikipedia.org      /wiki/غزة              -> 71,938 clean chars (Readability)
//   aljazeera.net         /news/2026/8/5/…       -> 1,433 clean chars
//   bbc.com               /arabic/articles/c1e…  -> 4,720 clean chars
//   skynewsarabia.com     /middle-east/1884498-… -> 1,403 clean chars
//
// alarabiya.net IS NAMED IN THE BRIEF AND IS DELIBERATELY ABSENT. Measured the same day, it
// answers a server-side client with HTTP 403 and a Cloudflare «تم رفض الوصول» page on EVERY
// path tried — /, /arab-and-world/, /aswaq/ and even /sitemap.xml. It does not merely rank
// badly; it never returns a byte of article text, so it can produce no card and would cost
// every news question a doomed request plus a tripped circuit breaker. The evidence is kept
// as a `status: 'blocked'` row in lib/source-registry.js rather than deleted, so the decision
// survives, so the gate can PROVE it is on no list, and so re-admitting it the day access is
// granted is a one-line change.
//
// bbc.com, NOT bbc.com/arabic, and that is not a widening. The `site:` filter and the host
// allow-list are both registrable-domain machinery, so a path cannot be expressed here. It is
// expressed where paths belong — lib/source-page-gates.js — which refuses every bbc.com path
// outside /arabic/articles/{id}, before the fetch as well as after it. MEASURED: bbc.com/news
// (the ENGLISH front page) extracts 7,718 clean characters, so without that rule it would
// have been a citable "source". With it, the page is refused from the URL alone.
export const SITES_GENERAL = [
  'ar.wikipedia.org', 'aljazeera.net', 'bbc.com', 'skynewsarabia.com',
];

// The invariant the separation rests on, as a computed value rather than a claim: no domain
// may sit on both a religious list and the world list. Returns the offending domains, or [].
export function worldListOverlap() {
  const sharia = new Set([...SITES_ADULT, ...SITES_MINOR, ...SITES_MINOR_FALLBACK]
    .map((d) => String(d).toLowerCase()));
  return SITES_GENERAL.filter((d) => sharia.has(String(d).toLowerCase()));
}
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

// The admission floor for a host that declares NONE of its own. Exported and named so that the
// number is a stated default rather than a literal buried in a comparison — the shape that let it
// silently override lib/source-page-gates.js's per-host declarations. See the floor test in
// tryWave(), where a declared minText takes precedence over this in BOTH directions.
export const GENERIC_MIN_TEXT = 200;

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

// The world path's own empty answer. Deliberately a DIFFERENT sentence: NO_SOURCE_TEXT says
// "the approved religious sites had nothing", which is both untrue and misleading about a
// search that never went near them.
const NO_WORLD_SOURCE_TEXT =
  'لم يُعثر على مادّةٍ حديثةٍ في المصادر الإخباريّة والعامّة المعتمدة عن هذا السؤال.';

// Public API. Brave-search the query, fetch+clean the top FETCH_PER_CALL hits in
// parallel (each with its own timeout), keep the FIRST clean one and stop, and
// format one tool_result string. Degrades to NO_SOURCE_TEXT (never fabricates)
// when nothing is usable.
// ── A KHUTBAH IS NOT A FATWA, AND IT IS STILL A CANDIDATE ────────────────────
//
// In a RULING question, a page whose own path says it is a fatwa is tried before a page whose own
// path says it is a sermon, a lesson or a lecture. Three things this is careful not to be:
//
//   * it EXCLUDES NOTHING. The sermon keeps its place in the pool and is fetched when the rulings
//     ahead of it come back empty or gated. A ruling that exists only in a khutbah is still
//     reachable, which a filter would have cost;
//   * it is a PAGE lever, not a domain one. Every domain filter above is untouched: a site is
//     admitted or not for entirely separate reasons, and this only reorders what it returned;
//   * an OPAQUE path earns nothing and loses nothing. «?p=123» keeps its ordinary weight rather
//     than being guessed at in either direction.
//
// STABLE, so two pages of the same kind keep the provider's own ranking — which is the only
// evidence available about which of them is the better answer.
// THE TITLE IS READ AS THE PATH IS READ. The «حادثة العدة» page's path is «/sharia/0/NNNN/» —
// opaque, so the path earned it nothing — while its title said «(خطبة)» in as many words, in the
// search result, before the fetch. pageKind() reads both, path first.
export function orderRulingCandidates(results) {
  const list = Array.isArray(results) ? results : [];
  const RANK = { fatwa: 0, '': 1, khutbah: 2 };
  return list
    .map((r, i) => ({ r, i, rank: RANK[pageKind(r && r.link, r && r.title)] ?? 1 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.r);
}

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
    const before = measureQuery(query);
    const after = measureQuery(plan.question);
    console.warn('[retrieve] question shortened to fit the query budget: '
      + `${before.chars}c/${before.words}w -> ${after.chars}c/${after.words}w `
      + `(q=${qFingerprint(query)})`);
  }
  if (!plan.groups.length) {
    // Not a failed search — a search that was never made. That is a different thing than
    // «the provider returned nothing», and before this line it looked exactly like it.
    console.warn(`[retrieve] no query plan — the planner produced 0 group(s) for ${sites.length} site(s); nothing was searched`);
    return { text: NO_SOURCE_TEXT, sources: [] };
  }
  console.warn(`[retrieve] plan: ${plan.groups.length} group(s) — `
    + plan.groups.map((g) => `#${g.index}:${g.sites.length} sites ${g.chars}c/${g.words}w`).join(', '));

  // ── THE MEASURE IS TAKEN ON THE QUERY THAT WAS ACTUALLY SENT ───────────────
  // planQueries() shortens a question that will not fit the provider's ceiling, so `query` and
  // `plan.question` are not always the same string. Scoring a returned page against words that
  // never travelled in the search marks it down for failing to answer something nobody asked —
  // the page did answer the query it was found by.
  //
  // The ḥāl rule is deliberately NOT moved with it: matchPage still receives the reader's own
  // `question`, so «تكاسلًا» keeps refusing a page about «جهلًا» whether or not the shortener
  // kept the word. Coverage is a measurement and belongs to the sent query; the ḥāl rule is a
  // refusal and belongs to what was asked.
  const sentTerms = pivotTerms(plan.question).terms;
  if (plan.shortened) {
    console.warn(`[retrieve] match terms taken from the SENT query: ${sentTerms.length} term(s) `
      + `(q=${qFingerprint(query)})`);
  }

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
    // The best UNSURE candidate seen in this wave, kept only as a fallback: a page the
    // deterministic check could neither confirm nor refuse is still better than no answer, and
    // still worse than a page that plainly answers.
    let unsure = null;
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
      // ── THE FLOOR: A HOST'S OWN DECLARATION BEATS THE GENERIC DEFAULT ──────
      // GENERIC_MIN_TEXT is what a host that declared nothing is held to. It is NOT a ceiling
      // above a floor a host set for itself. MEASURED: mostafaaladwy.com declares `minText: 20`
      // because its fatwas really are that short — /fatwa/49996 extracts to 110 characters of
      // genuine question-and-answer — and it cleared its own gate in lib/source-page-gates.js only
      // to be thrown away here by a flat 200. The declaration bought nothing, and the site looked
      // like a broken extractor when the extractor was working perfectly.
      //
      // It cuts both ways, which is what makes it a floor rather than a licence: tafsir.net
      // declares 2,500, and that keeps refusing the PDF-viewer stubs a 200 would have admitted.
      const declared = declaredMinText(finalUrl || r.link);
      const floor = declared === null ? GENERIC_MIN_TEXT : declared;
      if (text.length < floor) {
        console.warn(`[retrieve] thin ${host} — ${finalUrl} (${text.length} chars < ${floor}${declared === null ? '' : ' declared'})`);
        continue;
      }
      // ── DOES THIS PAGE ANSWER THIS QUESTION? ────────────────────────────────
      // Everything above this line asked about the SITE, the URL or the extraction. None of them
      // is about the question, which is why islamweb /fatwa/239878 — a ruling on leaving a
      // condition of the prayer «جهلًا» — became the evidence behind an answer about abandoning
      // the prayer «تكاسلًا». A rejected page is SKIPPED and the next candidate is taken; the
      // refusal only comes when the candidates are exhausted, and it still says a search was made.
      const m = matchPage({ question: query, terms: sentTerms, title, text });
      if (m.verdict === 'reject') {
        console.warn(`[retrieve] mismatch ${host} — ${finalUrl} (${m.reason}) — trying the next candidate`);
        continue;
      }
      console.warn(`[retrieve] clean ${host} — ${finalUrl} (${text.length} chars, ${note}, match=${m.verdict}${author ? ', by ' + author : ''})`);
      const candidate = {
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
      // A CONFIRMED MATCH ENDS THE WAVE; an UNSURE one is held. This is the second half of the
      // instability fix: "first clean page wins" made the source a lottery over whatever the
      // provider ranked first that second, so the same question gave three different answers.
      // Preferring a confirmed match — and falling back to the first unsure one in wave order,
      // deterministically — makes the same question reach the same page.
      if (m.verdict === 'match') return candidate;
      if (!unsure) unsure = candidate;
    }
    return unsure;
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

    // ── FATWA PAGES BEFORE SERMON PAGES, IN A RULING QUESTION ──────────────
    //
    // BEFORE THE SLICE, or it changes nothing: only the first FETCH_PER_CALL candidates are ever
    // fetched, so a sermon sitting in the provider's top three keeps its slot unless the ordering
    // happens first. Nothing is dropped — the sermon simply queues behind the rulings and is
    // fetched when they come back empty or gated.
    const ranked = purpose === 'fatwa' ? orderRulingCandidates(results) : results;
    const first = await tryWave(ranked.slice(0, FETCH_PER_CALL));
    if (first) { kept.push(first); break; }        // early stop: the question is answered
    // Wave 2 exists because a per-site gate or a bot challenge can burn every slot in wave 1.
    // It runs on the LAST group only: while another group remains, a fresh set of domains is
    // a better use of the budget than more candidates from a filter that just came up empty.
    const isLast = group.index === plan.groups.length;
    if (maxWaves > 1 && isLast) {
      const rest = ranked.slice(FETCH_PER_CALL, FETCH_PER_CALL * 2);
      if (rest.length) {
        console.warn(`[retrieve] group ${group.index} wave 1 empty — trying ${rest.length} more candidate(s)`);
        const second = await tryWave(rest);
        if (second) { kept.push(second); break; }
      }
    }
    if (!isLast) console.warn(`[retrieve] group ${group.index} produced nothing — trying group ${group.index + 1}`);
  }

  if (kept.length === 0) {
    // The search WAS made and every candidate it produced was refused above — each with its
    // own named line. This is the closing line that says so, so a reader of the log never has
    // to infer an empty result from the absence of a success.
    console.warn(`[retrieve] exhausted — ${plan.groups.length} group(s) searched, no candidate survived`);
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  // ── THE PAGE IS DATA, NOT INSTRUCTIONS ─────────────────────────────────────
  //
  // WHAT THIS USED TO BE, AND WHY IT WAS A HOLE. This line handed the model the raw page text
  // with the title and the URL sitting in the instruction body, unfenced:
  //
  //     `「المصدر ${i + 1}: ${k.title} — ${k.url}」\n${k.passage}`
  //
  // That string becomes a tool_result (api/ask.js) and, on the world pass, the BODY of a user
  // message whose real instructions come after it (buildWorldSearchInstruction). So a page that
  // said «تجاهل التعليمات السابقة» was speaking in the same voice as the app — and so was its
  // TITLE, which an attacker controls completely and which sat outside any fence. The ledger has
  // had the defence since it shipped (lib/ledger/segment.js); the path that actually serves
  // readers did not.
  //
  // Now every page — title, URL and text together — goes INSIDE one wrapper that says, in the
  // model's own language, that what follows is quoted data and that any sentence in it which
  // looks like an order is part of the data. Nothing about a retrieved page is left in the
  // instruction voice. The divider between pages is ours and stays outside.
  //
  // COUNTED, NEVER ACTED ON — exactly as the ledger counts them (schema.js
  // `injection_markers_seen`). We do not drop the page: a page can say «تجاهل ما سبق» innocently,
  // and a silent drop is a retrieval failure nobody can see. It is fenced, and it is logged.
  const divider = '\n' + '─'.repeat(40) + '\n';
  const injectionMarkers = [];
  const text = kept
    .map((k, i) => {
      // The title and the URL are attacker-controlled too, so they are scanned as well as fenced.
      injectionMarkers.push(...injectionMarkersIn(`${k.title}\n${k.url}\n${k.passage}`));
      return wrapUntrusted(`「المصدر ${i + 1}: ${k.title} — ${k.url}」\n${k.passage}`);
    })
    .join(divider);
  if (injectionMarkers.length) {
    console.warn(`[retrieve] injection markers seen: ${injectionMarkers.length} ` +
      `(${[...new Set(injectionMarkers)].join(', ')}) — fenced, not obeyed, not dropped`);
  }

  // `passage` is carried alongside title/url so a caller can check whether a page actually
  // SUPPORTS the claim it is about to be cited for, instead of trusting the fact that it came
  // back from an allow-listed host. Additive: every existing consumer reads title/url and is
  // unaffected. See lib/claim-gate.js — a card whose page never mentions the phrase the reader
  // asked about is a citation, not evidence.
  return {
    text,
    // Additive, like `passage` before it: the empty-source returns above keep their exact shape
    // (two guards assert it literally), so a caller reads this as `(r.injectionMarkers || [])`.
    injectionMarkers,
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
  let rawTiers =
    opts.band === 'adult' ? [SITES_ADULT] : [SITES_MINOR, SITES_MINOR_FALLBACK];

  // ── opts.onlySites — a search NARROWED to named domains ────────────────────
  // Used when the reader asked for a specific scholar's own position: look in his own site
  // before anywhere else. It can only ever NARROW, never widen — every entry must already be
  // on this band's list, so a scoped search cannot reach a domain the age gate excludes, and
  // an entry that is not on the list is dropped rather than honoured. If nothing survives,
  // the scoped search is abandoned and the caller sees no source, which is the correct
  // outcome: silence, not a page from somebody else's site wearing his name.
  if (Array.isArray(opts.onlySites) && opts.onlySites.length) {
    const want = opts.onlySites.map((d) => String(d || '').toLowerCase());
    rawTiers = rawTiers
      .map((t) => t.filter((d) => want.includes(d)))
      .filter((t) => t.length);
    if (!rawTiers.length) {
      console.warn(`[retrieve] scoped search for ${want.join(',')} — not on this band's list`);
      return { text: NO_SOURCE_TEXT, sources: [] };
    }
  }

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

  // ── opts.preferDomain — A DOMAIN AT THE FRONT OF THE SEARCH, NOT A CAGE ────
  //
  // WHAT THIS REPLACES, AND WHY. A question naming a scholar used to take a path of its own: the
  // search was LOCKED to his registered domain with `onlySites`, and when his own site had nothing
  // on the issue the pass returned silence — so the reader lost the ruling because of whose name
  // he had put in front of it. «ما رأي فلان في كذا» is a question about the ISSUE with a
  // preference attached, and this is the preference.
  //
  // IT CANNOT WIDEN ANYTHING. The domain is honoured only if it is already on this band's SCOPED
  // list, exactly like `intent` below — so no wording of any question can reach a domain the age
  // gate or the purpose filter excludes, and an unrecognised value is ignored rather than obeyed.
  // What it may do is reorder, and what it may never do is stop the ordinary search from running.
  //
  // WHAT MAKES IT SAFE TO PREFER RATHER THAN LOCK: the lock used to be the only thing guaranteeing
  // a page belonged to the man it was drafted for. That guarantee now comes from the page itself
  // (lib/policy/source-attribution.js), which is a better place for it — a page on his domain that
  // reproduces somebody else's fatwa was never his either, and the lock could not tell.
  const prefer = String(opts.preferDomain || '').toLowerCase().replace(/^www\./, '');
  if (prefer) {
    if (!tiers[0].includes(prefer)) {
      console.warn(`[retrieve] preferred ${prefer} not on this band's scoped list — ignoring the preference`);
    } else if (isBreakerOpen(prefer)) {
      console.warn(`[retrieve] preferred ${prefer} breaker OPEN — straight to the ordinary search`);
    } else {
      console.warn(`[retrieve] preferred ${prefer} — searching it first`);
      const first = await runSearchPass(query, [prefer], { ...opts, purpose, maxWaves: 1 });
      if (first.sources.length > 0) return first;
      console.warn(`[retrieve] preferred ${prefer} empty — carrying on down the band's list`);
    }
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

/**
 * LIVE WORLD RETRIEVAL — the news/current-affairs counterpart of retrieve(), over
 * SITES_GENERAL and nothing else.
 *
 * WHY IT IS A SEPARATE FUNCTION RATHER THAN A FLAG ON retrieve(). retrieve() is where the
 * age bands, the purpose scoping, the scholar targeting and the onlySites narrowing all live,
 * and every one of them exists to decide WHICH RELIGIOUS SOURCES a question may reach. A
 * `world: true` option threaded through that would put the one list that must never be
 * religious inside the machinery whose whole job is religious selection — and would put the
 * separation at the mercy of every future edit to a shared code path. A separate entry point
 * cannot be reached by any wording of any question; it is reached only by the caller
 * deciding, deterministically and before the call, that this is a world question.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *   * no age tiers — SITES_GENERAL is one list, and there is no second one to fall back to;
 *   * no purpose classification — `purpose` is undefined, so rankForPurpose() is the identity
 *     and no religious scope rule is consulted, because none of these sources has one;
 *   * no source-intent targeting — lib/source-intent.js maps questions to SCHOLARS' sites and
 *     has nothing to say here.
 *
 * WHAT IT KEEPS, unchanged, because it is the same runSearchPass():
 *   the bounded query planner, the hard post-redirect host allow-list, the per-page URL and
 *   text gates, the circuit breaker, the duplicate skip and the 200-character floor. A world
 *   source clears exactly the same bar a religious source clears.
 *
 * @returns {{text:string, sources:Array}} — an EMPTY sources array when nothing was usable.
 *          The caller must treat that as "no live material", never as an answer.
 */
export async function retrieveWorld(query, opts = {}) {
  const conflicts = worldListOverlap();
  if (conflicts.length) {
    // Fail CLOSED and loudly. A domain on both lists means the separation this function is
    // built around has already been broken, and searching anyway would be searching a
    // religious source under news rules.
    console.error(`[retrieve/world] REFUSING: ${conflicts.join(', ')} sit on BOTH a religious list and the world list`);
    return { text: NO_WORLD_SOURCE_TEXT, sources: [] };
  }
  console.warn(`[retrieve/world] world search over ${SITES_GENERAL.length} general sources`);
  const pass = await runSearchPass(query, SITES_GENERAL, {
    ...opts,
    // Stated rather than inherited: a purpose is a RELIGIOUS classification, and passing one
    // here would order the world list by a table that knows nothing about it.
    purpose: undefined,
    onlySites: undefined,
    band: 'world',
  });
  if (!pass.sources.length) {
    console.warn(`[retrieve/world] nothing survived — the world pass over ${SITES_GENERAL.length} general source(s) kept no page`);
    return { text: NO_WORLD_SOURCE_TEXT, sources: [] };
  }
  return pass;
}
