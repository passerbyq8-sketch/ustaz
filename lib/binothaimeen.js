// lib/binothaimeen.js
// THE OFFICIAL SITE OF SHAYKH MUHAMMAD IBN SALIH AL-'UTHAYMEEN, as a source adapter.
//
// WHY THIS FILE EXISTS. Before it, a question of the form "ما رأي الشيخ ابن عثيمين في كذا؟"
// had nowhere to go: binothaimeen.net is on no allow-list, so the retrieval layer could not
// reach a single word the Shaykh actually said. The model answered from memory, and memory
// produced a ruling that was the OPPOSITE of his published fatwa. A source the app cannot
// read is a source the app will invent.
//
// WHAT IT IS AND IS NOT.
//   * It is SERVER-ONLY. Nothing here is imported by the browser bundle, and no request
//     originates from a user's device.
//   * It uses NO key and NO credential. Both endpoints are public.
//   * It is NOT a crawler. It performs exactly two calls per question: one search, and one
//     fetch-by-id for the candidate that survived scoring. It never walks the library, never
//     follows links, and never downloads a corpus.
//   * It FAILS CLOSED. Timeout, non-200, unparseable payload, empty text, or a candidate that
//     does not actually answer the question all resolve to "no source" — never to a fallback
//     on the model's own memory. Returning nothing is the correct answer to "I could not
//     verify this."
//
// SNIPPET IS NOT EVIDENCE. The search endpoint returns a highlighted excerpt. That excerpt is
// used ONLY to rank candidates; the text that may ever be quoted or reasoned over is fetched
// separately by id from the lesson endpoint. A ruling must never rest on an ellipsis.

import { EZIK_USER_AGENT } from './user-agent.js';
import { compareDurations, durationAcceptable, durationTerms } from './duration.js';

const SEARCH_URL = 'https://shekhcp.binothaimeen.net/api/search-data';
const SHOW_URL = (id) =>
  `https://shekhapi.binothaimeen.net/lessons/audios/show/${encodeURIComponent(id)}/0/1`
  + '?getManySectionsWithAllParent=audio_library&getAllPaths=1';

export const BINOTHAIMEEN_HOST = 'binothaimeen.net';
export const IBN_UTHAYMEEN_SCHOLAR = 'محمد بن صالح العثيمين';
export const IBN_UTHAYMEEN_PUBLISHER = 'الموقع الرسمي للشيخ محمد بن صالح العثيمين';

// Short on purpose. This runs inside a request the reader is waiting on, and a slow source is
// indistinguishable from a missing one as far as the answer is concerned.
const SEARCH_TIMEOUT_MS = 7000;
const SHOW_TIMEOUT_MS = 9000;
// ONE retry, and only for a transport-level failure. A 4xx/5xx is an answer, not an accident.
const RETRIES = 1;
// MEASURED: the search endpoint returns matches in ascending id order, NOT by relevance, so a
// small page is an arbitrary slice of the matches rather than the best of them. The target fatwa
// sat at position 21 of 25 for its own keystone. Ask for a page wide enough to hold the answer.
const SEARCH_PAGE_SIZE = 50;

// ── Internal rate limiting ───────────────────────────────────────────────────
// The site is somebody else's, and it is a charity's. This module never issues two calls at
// once and never issues them faster than MIN_GAP_MS apart, process-wide. On a serverless
// runtime each instance holds its own queue, which bounds a single instance rather than the
// fleet — so the ceiling below is deliberately conservative.
const MIN_GAP_MS = 250;
let lastCallAt = 0;
let chain = Promise.resolve();
function scheduled(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCallAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  // Keep the chain alive even when a link rejects, or one failure would wedge every later call.
  chain = run.then(() => undefined, () => undefined);
  return run;
}

// ── Cache ────────────────────────────────────────────────────────────────────
// Keyed by query and by id, exactly as the brief requires. Bounded and time-limited: a warm
// lambda must not become an unbounded copy of the library, and a fatwa page corrected upstream
// must not be served stale for a day.
const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) { cache.delete(key); return undefined; }
  // refresh recency
  cache.delete(key); cache.set(key, hit);
  return hit.value;
}
function cacheSet(key, value) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

// Test seam, mirroring lib/daycap.js's __setRedisForTest. A warm module keeps its cache across
// calls by design; a test that simulates the site going down must be able to start from cold, or
// it measures the cache rather than the failure path. Not called by any shipped code path.
export function __clearCacheForTest() { cache.clear(); lastCallAt = 0; }

// ── HTML → text ──────────────────────────────────────────────────────────────
// The payload carries real markup (<p dir="rtl">, <br />, coloured <span>s) and the search
// result additionally wraps every matched word in <span class="highLigatedText">. Both must be
// gone before a single character reaches a prompt or a reader: a highlight span in an answer is
// raw markup leaking into scripture-adjacent text.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'",
  '&nbsp;': ' ', '&laquo;': '«', '&raquo;': '»', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
};
export function decodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp|laquo|raquo|hellip|mdash|ndash);/g, (m) => ENTITIES[m] || m)
    // numeric entities, decimal and hex, bounded to valid scalar values
    .replace(/&#(\d{1,7});/g, (m, d) => { const n = parseInt(d, 10); return (n > 0 && n <= 0x10FFFF) ? String.fromCodePoint(n) : m; })
    .replace(/&#[xX]([0-9a-fA-F]{1,6});/g, (m, h) => { const n = parseInt(h, 16); return (n > 0 && n <= 0x10FFFF) ? String.fromCodePoint(n) : m; });
}
export function htmlToText(html) {
  let t = String(html == null ? '' : html);
  // block boundaries become newlines BEFORE tags are removed, or paragraphs run together
  t = t.replace(/<\s*br\s*\/?>/gi, '\n')
       .replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
       .replace(/<\s*(p|div|li|tr|h[1-6])\b[^>]*>/gi, '\n');
  // script/style bodies are never content
  t = t.replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ');
  // every remaining tag, including the highlight spans the search endpoint injects
  t = t.replace(/<[^>]*>/g, '');
  t = decodeEntities(t);
  return t.replace(/ /g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
}

// ── Arabic normalisation, for scoring only ───────────────────────────────────
// Never applied to text that is shown or quoted: this exists so that "أسقطت" and "اسقطت"
// score as the same word. The displayed text keeps every letter it was published with.
// MEASURED, and the reason the correct fatwa was first rejected at overlap 0.38: Arabic
// punctuation lives INSIDE the Arabic Unicode block, so a "keep only Arabic" filter keeps the
// question mark and comma glued to the word before them. "...80 يوم؟" produced the token
// "يوم؟", which matches nothing and which the stop-word list could not catch either.
// Strip Arabic punctuation explicitly, before any keep-class runs.
const AR_PUNCT = /[؀-؅،؛؞؟٪-٭۔۝«»]/g;

export function normaliseAr(s) {
  return String(s == null ? '' : s)
    .replace(AR_PUNCT, ' ')
    .replace(/[ً-ٰٟـۖ-ۭ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/[^؀-ۿ0-9a-zA-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
const STOP = new Set(['في', 'من', 'على', 'عن', 'الي', 'ال', 'ما', 'هل', 'هو', 'هي', 'ان', 'او',
  'الذي', 'التي', 'كان', 'قد', 'مع', 'هذا', 'هذه', 'ذلك', 'رأي', 'راي', 'قول', 'حكم', 'الشيخ',
  'شيخ', 'يقول', 'قال', 'فتوي', 'فتوه', 'عند', 'كم', 'يوم', 'ايام', 'بعد', 'قبل', 'دون', 'و']);
// NORMALISED tokens, for SCORING only.
export function contentTokens(s) {
  return normaliseAr(s).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
}
// ORIGINAL-ORTHOGRAPHY content words, for the SEARCH TERM.
//
// MEASURED: sending normalised words to the endpoint is wrong. The library indexes the text as
// published — "أسقطت" with its hamza — so a normalised "اسقطت" matches a different, weaker set
// and the first version of this adapter came back with an unrelated lesson. Only the attribution
// wording and stop words are removed here; every surviving word keeps the letters it was typed
// with.
export function searchWords(s) {
  return String(s == null ? '' : s)
    .replace(AR_PUNCT, ' ')
    .replace(/[^؀-ۿa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 3 && !STOP.has(normaliseAr(w)));
}

// ── HTTP, with a timeout and exactly one retry ───────────────────────────────
//
// THE `io` GATE IS OPTIONAL AND ADDITIVE. Without it this function behaves exactly as it always
// has, which is what keeps the shipped attributed route byte-identical. With it — the ledger
// path supplies one — every REQUEST is checked before it starts:
//
//   io.allow()  reserve one unit of the caller's budget, or refuse. Called before each attempt,
//               so a RETRY is charged too: a retry is a request, and a budget that only counts
//               first attempts is a budget that can be doubled by a flaky host.
//   io.signal   the caller's deadline. Aborts an in-flight request rather than waiting for this
//               function's own per-request timeout, which knows nothing about the request's
//               overall remaining time.
//   io.fetchImpl  an alternative fetch. Its ONLY purpose is to let a test drive the real
//               search -> lesson -> httpJson path deterministically instead of injecting a
//               reader that bypasses this module entirely and proves nothing about it. Absent on
//               every shipped path, where the global fetch is used exactly as before.
//
// This is the single choke point for every network call this module makes — both the search POSTs
// and the lesson GETs go through it — which is why the gate lives here and not at nine call sites.
async function httpJson(url, init, timeoutMs, io) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    // RESERVED BEFORE THE SOCKET OPENS, never after the response comes back. Accounting that
    // happens on return cannot stop the request it is accounting for.
    if (io && typeof io.allow === 'function' && !io.allow()) {
      console.warn('[binothaimeen] budget/deadline refused a request before it started');
      return null;
    }
    if (io && io.signal && io.signal.aborted) return null;
    const ctl = new AbortController();
    // THE TIMER MUST OUTLIVE THE HEADERS. `fetch()` resolving means the response HEADERS have
    // arrived, not that the body has. Clearing the timeout there — as this did — left
    // `await r.text()` completely unguarded, so a server that sent headers and then stalled the
    // body ran past this timeout AND past the request's global deadline. The timer and the abort
    // listener now cover the whole exchange and are torn down in `finally`, on every path.
    let attemptTimedOut = false;
    const timer = setTimeout(() => { attemptTimedOut = true; ctl.abort(); }, timeoutMs);
    const onAbort = () => ctl.abort();
    if (io && io.signal) io.signal.addEventListener('abort', onAbort, { once: true });
    // Injectable ONLY through the caller's I/O context, which the shipped route does not pass.
    // Without it this is the global fetch, exactly as before.
    const doFetch = (io && typeof io.fetchImpl === 'function') ? io.fetchImpl : fetch;
    try {
      const r = await scheduled(() => doFetch(url, {
        ...init,
        signal: ctl.signal,
        headers: {
          'Accept': 'application/json',
          // D6أ: was a fourth, differently-spelled honest name. Honest but SEPARATE, which
          // costs an operator something real — three names from one app cannot be allowed,
          // throttled or blocked as one thing.
          'User-Agent': EZIK_USER_AGENT,
          ...(init && init.headers ? init.headers : {}),
        },
      }));
      // A status is an answer. Do not retry it — retrying a 404 or a 500 only doubles the load.
      if (!r.ok) { console.warn('[binothaimeen] HTTP', r.status, url.slice(0, 90)); return null; }
      const text = await r.text();          // STILL under the timer and the abort listener
      try { return JSON.parse(text); } catch { console.warn('[binothaimeen] non-JSON payload'); return null; }
    } catch (e) {
      lastErr = e;
      // TWO ABORTS THAT LOOK IDENTICAL AND ARE NOT. A caller-side abort is the REQUEST's deadline
      // — there is no time left, so a retry would spend another request on a request we have
      // already run out of time for. A per-attempt timeout is a slow hop, and the one declared
      // retry is allowed — and it is charged by io.allow() at the top of the next iteration,
      // before it starts.
      if (io && io.signal && io.signal.aborted && !attemptTimedOut) return null;
      if (attempt === RETRIES) break;
    } finally {
      clearTimeout(timer);
      if (io && io.signal) io.signal.removeEventListener('abort', onAbort);
    }
  }
  console.warn('[binothaimeen] transport failed:', lastErr && lastErr.message);
  return null;
}

// ── Search ───────────────────────────────────────────────────────────────────
// MEASURED against the live endpoint: mode 'exact' on a well-chosen phrase is precise (the
// target fatwa came back as the single result), while mode 'similar' is noisy — it answered 0
// for one phrase and 439 for another. So 'exact' runs first and 'similar' is a fallback, and
// neither is trusted beyond ranking.
async function searchOnce(term, mode, io) {
  const key = 'q:' + mode + ':' + term;
  // A CACHE HIT COSTS NO REQUEST, so it is not charged. The gate is inside httpJson precisely so
  // that only real network calls are counted.
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const json = await httpJson(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageSize: SEARCH_PAGE_SIZE, searchTerm: term, type: 'audios', page: 1, mode }),
  }, SEARCH_TIMEOUT_MS, io);
  const rows = (json && Array.isArray(json.data)) ? json.data : [];
  const out = rows
    .map((r) => ({
      id: typeof r.id === 'string' ? r.id : '',
      title: htmlToText((r.title && (r.title.ar || r.title)) || ''),
      snippet: htmlToText((r.content && (r.content.ar || r.content)) || ''),
      relevance: Number(r.relevance) || 0,
    }))
    .filter((r) => r.id && r.title);
  cacheSet(key, out);
  return out;
}

// ── Fetch the full published text by id ──────────────────────────────────────
// The lesson payload keeps the question-and-answer under objective.content.ar as HTML. This is
// the ONLY text this module lets anything else read.
export async function fetchLesson(id, io) {
  if (!id || typeof id !== 'string') return null;
  const key = 'id:' + id;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const json = await httpJson(SHOW_URL(id), { method: 'GET' }, SHOW_TIMEOUT_MS, io);
  const d = json && json.data;
  if (!d) { cacheSet(key, null); return null; }
  const title = htmlToText((d.title && (d.title.ar || d.title)) || '');
  const bodyHtml = (d.objective && d.objective.content && d.objective.content.ar) || '';
  const exactText = htmlToText(bodyHtml);
  if (!title || exactText.length < 40) { cacheSet(key, null); return null; }
  const out = {
    scholar: IBN_UTHAYMEEN_SCHOLAR,
    publisher: IBN_UTHAYMEEN_PUBLISHER,
    title,
    exactText,
    sourceId: id,
    canonicalUrl: buildCanonicalUrl(title, id),
    retrievedAt: new Date().toISOString(),
  };
  cacheSet(key, out);
  return out;
}

// The share URL the site itself uses for a lesson. The title segment is encoded because these
// titles are Arabic and contain spaces; 'البحث' is the site's own path segment.
export function buildCanonicalUrl(title, id) {
  return 'https://binothaimeen.net/ar/voice_library/lessonDetails/'
    + encodeURIComponent('البحث') + '/'
    + encodeURIComponent(String(title || '').slice(0, 120)) + '/'
    + encodeURIComponent(String(id || ''));
}

// ── Candidate scoring ────────────────────────────────────────────────────────
// A source is only a source if it actually answers THIS question. The score is the share of the
// question's content words that appear in the candidate's own title and published text, each word
// weighted by its length as a crude specificity proxy, and gated on the single most specific word
// being present at all.
//
// MEASURED, twice, and both measurements are why this file looks the way it does:
//   1. An unweighted count let an unrelated lesson on waswasah score 0.60, because a question
//      about miscarriage shares الصلاة and الصيام with half the library. Hence the weighting.
//   2. Weighting alone was still not enough. Against the LIVE endpoint the top-scoring candidate
//      for the original question was a two-hour transcript of كتاب النكاح, at overlap 1.00 — a
//      long enough document contains every word eventually. Overlap is therefore necessary and
//      NOT sufficient; isTargetedFatwa() below is the other half of the condition.
// MEASURED a third time, and this is why there is no longer a "the question's longest word must
// be present" gate here. It looked principled and it was arbitrary. In "المرأة التي أسقطت في
// الشهر الثاني" the longest word is المرأة, so the gate scored the correct fatwa at ZERO for not
// repeating a word that half the library uses. Worse, no keystone can survive paraphrase at all:
// a reader who asks about "ثمانين يوماً" is answered by a page that says "الشهر الثاني", and no
// string comparison bridges that. Deciding TOPICALITY is the ranker's job and refusing a WRONG
// ANSWER is lib/attribution.js's job; what is left here is a floor low enough not to reject a
// faithful source over vocabulary, paired with a substance requirement that a shared function
// word cannot satisfy.
export const MIN_OVERLAP = 0.28;
const MIN_SUBSTANTIVE = 5;           // a matched word this long is substance, not grammar

// LIGHT STEMMING, and the third measured reason this file changed shape. The page that finally
// answers "before eighty days" is titled «ضابط السقط الذي تترك المرأة لأجله الصلاة» and its text
// says «إذا سقط الجنين». The reader wrote «أسقطت». Same root, same subject, and a substring test
// scored it ZERO — so the correct fatwa was fetched, read, and thrown away over a prefix and a
// suffix. Stripping the handful of Arabic affixes that carry no topic ("ال", the form-IV alif,
// the feminine ت) closes that without any dictionary: «اسقطت» → «سقط» ← «السقط».
const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل'];
const SUFFIXES = ['هما', 'كما', 'هم', 'هن', 'كم', 'ها', 'وا', 'ات', 'ون', 'ين', 'ان', 'ت', 'ه', 'ي', 'ا'];
export function lightStem(word) {
  let w = String(word || '');
  for (const p of PREFIXES) if (w.length - p.length >= 3 && w.startsWith(p)) { w = w.slice(p.length); break; }
  // a form-IV / imperfect alif in front of a three-letter root: اسقط -> سقط
  if (w.length >= 4 && w[0] === 'ا') w = w.slice(1);
  for (const s of SUFFIXES) if (w.length - s.length >= 3 && w.endsWith(s)) { w = w.slice(0, -s.length); break; }
  return w;
}
// Does `hay` carry this token, allowing for the affixes above on EITHER side?
function carries(hay, token) {
  if (hay.includes(token)) return true;
  const stem = lightStem(token);
  return stem.length >= 3 && stem !== token && hay.includes(stem);
}
export function scoreCandidate(questionTokens, text) {
  const uniq = Array.from(new Set(questionTokens));
  if (!uniq.length) return 0;
  const hay = ' ' + normaliseAr(text) + ' ';
  let got = 0, total = 0;
  for (const t of uniq) {
    const w = t.length;              // length as a crude specificity weight
    total += w;
    if (carries(hay, t)) got += w;
  }
  return total ? got / total : 0;
}
// Both conditions, or no source. The floor alone is not enough on a short question: "فيمن أسقطت"
// carries only two words, so a page that happens to contain فيمن and nothing else would clear
// any fraction-based floor. Something of substance has to have matched.
export function acceptsCandidate(questionTokens, text) {
  const score = scoreCandidate(questionTokens, text);
  if (score < MIN_OVERLAP) return { ok: false, score };
  const hay = ' ' + normaliseAr(text) + ' ';
  const substantive = Array.from(new Set(questionTokens))
    .some((t) => t.length >= MIN_SUBSTANTIVE && carries(hay, t));
  return { ok: substantive, score };
}

// ── A lesson is not a fatwa ──────────────────────────────────────────────────
// The library holds two very different kinds of document under the same endpoint: short
// question-and-answer fatwas, and full transcripts of multi-hour teaching tapes. Only the first
// can ever be "the source for this ruling". A transcript may well contain the words of the
// question somewhere in ninety minutes of speech, but a sentence lifted out of it is not a fatwa
// on the asked matter, and this app must never present one as though it were.
//
// Two independent signals, because either alone can be fooled:
//   * the title of a taped lesson is a series entry — "كتاب النكاح (الشرح الثالث) - 17";
//   * the body of one opens with the site's own marker, التفريغ النصي للشريط رقم, and runs to
//     tens of thousands of characters.
const TRANSCRIPT_MARK = 'التفريغ النصي للشريط';
const MAX_FATWA_CHARS = 20000;
const SERIES_TITLE = /[-–—]\s*\d+\s*$/;
export function isLectureTitle(title) {
  return SERIES_TITLE.test(String(title || '').trim());
}
export function isTargetedFatwa(title, text) {
  if (isLectureTitle(title)) return false;
  const t = String(text || '');
  if (t.length > MAX_FATWA_CHARS) return false;
  if (normaliseAr(t).includes(normaliseAr(TRANSCRIPT_MARK))) return false;
  return true;
}

// ── Search terms ─────────────────────────────────────────────────────────────
// MEASURED, and this is the finding that mattered most: the endpoint does NOT sort by relevance.
// Its results come back in ascending id order, so pageSize:10 returns the ten lowest UUIDs that
// match — which is why the first version of this adapter kept meeting كتاب النكاح - 17 and never
// the fatwa it was looking for. The fix is in two parts: ask for a page large enough to contain
// the answer, and do the ranking here rather than trusting an order that carries no meaning.
//
// Terms are contiguous slices of the question in its own wording, longest first, searched in
// 'exact' mode — a phrase search is precise where 'similar' is an OR over words. The single most
// specific word is the last resort, and it is what gives the wide pool that ranking then narrows.
export function phraseTerms(cleaned) {
  const words = String(cleaned || '').split(/\s+/).filter(Boolean);
  const isContent = (w) => w.length >= 3 && !STOP.has(normaliseAr(w));
  const out = [];
  for (let size = Math.min(6, words.length); size >= 2; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const win = words.slice(i, i + size);
      if (!isContent(win[0]) || !isContent(win[size - 1])) continue;
      // at least two content words, or the phrase is mostly particles
      if (win.filter(isContent).length < 2) continue;
      const term = win.join(' ');
      if (!out.includes(term)) out.push(term);
    }
  }
  return out;
}

// ── The one entry point ──────────────────────────────────────────────────────
// Returns an ARRAY of unified source objects (0 or 1 today). Never throws: every failure path
// resolves to an empty array so the caller's "no source ⇒ no attributed ruling" rule is the only
// thing that decides the outcome.
//
// opts.excludeWords — words to strip from the query before it is used (the caller passes the
//   scholar's own name; see below for why that is not cosmetic).
// opts.rank — OPTIONAL async (question, candidates) => id|null. The caller may supply a smarter
//   ranker than string overlap; api/ask.js supplies one backed by a single cheap model call over
//   the candidate TITLES. It can only ever choose among pages the Shaykh's own site returned, and
//   whatever it chooses still has to clear every programmatic gate below. If it is absent, throws,
//   or picks something not in the pool, the deterministic ranking stands.
const MAX_SEARCHES = 6;
// A title this close to the question ends the search: nothing wider can beat it.
const STRONG_TITLE = 0.6;
const MAX_POOL = 14;
const MAX_FETCHES = 3;

export async function retrieveIbnUthaymeen(question, opts) {
  const o = opts || {};
  // OPTIONAL, AND ABSENT ON THE SHIPPED ROUTE. api/ask.js's attributed path passes no `io`, so
  // this module behaves exactly as it always has there. The ledger path passes one, and every
  // network call below — up to MAX_SEARCHES searches and MAX_FETCHES lesson reads, each with one
  // retry — is then reserved against the request's budget BEFORE it starts, and aborted on the
  // request's deadline rather than only on this module's own per-request timeout.
  const io = o.io || null;
  let q = String(question == null ? '' : question).trim();
  if (!q) return [];

  // THE SCHOLAR'S OWN NAME MUST COME OUT OF THE QUERY FIRST, and this is not cosmetic. A fatwa
  // page on his site does not contain the words "ابن عثيمين" — it contains the question and his
  // answer. Leaving the name in made it the longest, most "specific" token, so the keystone gate
  // rejected the CORRECT page for not mentioning him. Measured: the target fatwa scored 0 until
  // the name was stripped. The attribution wording goes with it for the same reason.
  const drop = ['الشيخ', 'شيخ', 'العلامة', 'الامام', 'الإمام', 'رحمه', 'الله', 'تعالى', 'فضيلة'];
  if (o.excludeWords) for (const w of o.excludeWords) if (w) drop.push(String(w));
  const dropNorm = new Set(drop.flatMap((w) => normaliseAr(w).split(' ')).filter(Boolean));
  q = q.split(/\s+/).filter((w) => !dropNorm.has(normaliseAr(w))).join(' ').trim();
  if (!q) return [];

  const tokens = contentTokens(q).filter((t) => !dropNorm.has(t));
  if (!tokens.length) return [];

  try {
    const words = searchWords(q).filter((w) => !dropNorm.has(normaliseAr(w)));
    if (!words.length) return [];
    // Phrases first, then single words longest-first.
    //
    // MEASURED, and the reason single words are all tried rather than just the longest one: the
    // longest word in "المرأة التي أسقطت في الشهر الثاني" is المرأة, which half the library
    // matches, while the word that actually finds the page is أسقطت. Length is a poor proxy for
    // rarity and there is no corpus frequency to appeal to here, so instead of betting on one
    // word the search spends its budget across the few that exist and lets ranking sort it out.
    const byLength = Array.from(new Set(words)).sort((a, b) => b.length - a.length);
    // A six-word exact phrase almost never matches; two to five words is where the precision is.
    const phrases = phraseTerms(q).filter((t) => t.split(' ').length <= 5).slice(0, 2);

    // THE PERIOD SEARCHES RUN FIRST, and they are the most precise instrument in this file.
    // MEASURED: the reader's «دون 80 يوم» implies the phrase «قبل الثمانين», and an exact search
    // for that on the Shaykh's site returns exactly ONE page — «ضابط السقط الذي تترك المرأة لأجله
    // الصلاة» — which is the page that names the eighty-day limit and gives the ruling together.
    // None of the reader's own words would ever have found it: her question says «أسقطت» and the
    // page says «سقط». The terms come from the NUMBER she gave, not from a model's suggestion.
    const durTerms = durationTerms(question);
    const terms = [];
    for (const t of [...durTerms, ...phrases, ...byLength]) if (t && !terms.includes(t)) terms.push(t);

    const seen = new Set();
    const pool = [];
    let strong = false;
    let done = 0;
    // HOW MANY SEARCHES THIS CALL MAY SPEND. Unbounded callers (the shipped attributed route)
    // get MAX_SEARCHES exactly as before. A budgeted caller passes a smaller number, because a
    // search phase that consumes the whole request budget starves the FETCH phase — and a
    // shortlist nobody can read is worth nothing. MEASURED: with a five-request ceiling and six
    // search terms, all five went to searches and the lesson GET never started, so the adapter
    // could never succeed inside the ceiling however good its shortlist was.
    const searchCap = (io && Number.isFinite(io.maxSearches))
      ? Math.max(1, Math.min(MAX_SEARCHES, io.maxSearches))
      : MAX_SEARCHES;
    for (const term of terms.slice(0, searchCap)) {
      const byPeriod = durTerms.includes(term);
      const rows = await searchOnce(term, 'exact', io);
      done++;
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        // Transcripts are dropped HERE, before ranking, so neither the ranker nor the scorer
        // ever gets the chance to prefer ninety minutes of tape over a fatwa.
        if (isLectureTitle(r.title)) continue;
        r.pre = scoreCandidate(tokens, r.title);
        // A page the site returned for an EXACT search on the reader's own period is known to
        // contain that period in its text. That is evidence no title score can supply, and it is
        // what earns the page a place in the fetch set even when its title shares not one word
        // with the question.
        r.byPeriod = byPeriod;
        if (r.pre >= STRONG_TITLE) strong = true;
        pool.push(r);
      }
      // Stop early only once every period search has run. A strong title match is a good sign,
      // but it is not worth skipping the one search that can name the reader's own limit.
      if (strong && done >= durTerms.length) break;
    }
    if (!pool.length) { console.warn('[binothaimeen] no candidates'); return []; }

    // Period hits sort ahead of title matches, then title score, then id for determinism.
    pool.sort((a, b) => (b.byPeriod ? 1 : 0) - (a.byPeriod ? 1 : 0) || b.pre - a.pre || a.id.localeCompare(b.id));
    const shortlist = pool.slice(0, MAX_POOL);

    // Ranking. The caller's ranker gets the first word; the overlap order is the fallback and the
    // tiebreak. Note what the ranker is NOT allowed to do: it does not supply text, does not
    // supply a ruling, and cannot introduce a page the site did not return.
    let ordered = shortlist;
    let picked;
    if (typeof o.rank === 'function') {
      try {
        picked = await o.rank(question, shortlist.map((c) => ({ id: c.id, title: c.title })));
      } catch (e) {
        console.warn('[binothaimeen] ranker failed:', e && e.message);
      }
    }
    // A RANKER MAY PROMOTE. IT MAY NOT VETO.
    //
    // An earlier version treated its "none of these" as a refusal, and MEASURED on production that
    // is exactly what it became: the ninety-day question met that veto while a page whose own text
    // draws the ninety-day line sat in the shortlist, already passing every deterministic gate.
    // A model glancing at titles is weaker evidence than a fetched text judged on the period it
    // rules about, so it does not get to overrule one. What it says here can move a candidate to
    // the front of the queue and nothing else.
    if (picked === null || picked === '') {
      console.warn('[binothaimeen] ranker promoted nothing; the deterministic order stands');
    }
    const hit = picked && shortlist.find((c) => c.id === picked);
    if (hit) ordered = [hit, ...shortlist.filter((c) => c !== hit)];
    // NOTE what is NOT here any more. An earlier version refused outright when the top two title
    // scores tied, because title overlap was the only discriminator it had and a tie really was a
    // coin flip. It is no longer the only one: the loop below fetches each candidate's published
    // text and separates them on the PERIOD they rule about, which is decisive where a title
    // score is not. Refusing before reading the texts threw away the answer to the very question
    // this feature exists for — MEASURED against production, where «دون 80 يوم» met that refusal
    // while the page naming the eighty-day limit sat unread in the shortlist. Ambiguity is still
    // a refusal, but it is decided AFTER the reading, at the bottom of this function.

    // THE RANKER IS NOT THE GUARANTEE, and this loop is where that is made true. Every surviving
    // candidate is fetched and judged on its FULL published text by rules no model touches, and
    // the winner is the one with the best PERIOD tier — not the one something picked first.
    //
    // The tiers are lib/duration.js's, and the order is the brief's:
    //   0. the source draws the same limit in the same direction as the question;
    //   1. the source's rule contains the reader's whole range;
    //   —. partial overlap and "no period at all" are not tiers. They are refusals.
    const judged = [];
    for (const c of ordered.slice(0, MAX_FETCHES)) {
      const lesson = await fetchLesson(c.id, io);
      if (!lesson) continue;
      if (!isTargetedFatwa(lesson.title, lesson.exactText)) {
        console.warn('[binothaimeen] not a targeted fatwa, rejected', c.id);
        continue;
      }
      const dur = compareDurations(question, lesson.title, lesson.exactText);
      if (!durationAcceptable(dur.verdict)) {
        // A page about the second month does not answer "before eighty days": it covers days
        // 31–60 of a question that runs from 0 to 79. Overlapping is not answering.
        console.warn('[binothaimeen] period ' + dur.verdict + ', rejected', c.id, JSON.stringify(dur.matched || ''));
        continue;
      }
      const verdict = acceptsCandidate(tokens, lesson.title + ' ' + lesson.exactText);
      if (!verdict.ok) {
        console.warn('[binothaimeen] candidate rejected, overlap', verdict.score.toFixed(2), c.id);
        continue;
      }
      judged.push({ lesson, tier: dur.tier, overlap: verdict.score, verdict: dur.verdict, pre: c.pre || 0 });
    }
    if (!judged.length) { console.warn('[binothaimeen] no candidate cleared the gates'); return []; }
    // Period tier first, then how much of the question the text carries, then how much of it the
    // TITLE carries — the title is the page's own statement of what it rules on, so it is the
    // last honest signal before there is nothing left to separate two candidates with.
    judged.sort((a, b) => a.tier - b.tier || b.overlap - a.overlap || b.pre - a.pre);
    // AMBIGUITY, decided here and not before: two pages that cleared every gate and are equal on
    // every measure this file has are genuinely indistinguishable, and picking one of them would
    // be a guess wearing a citation.
    const close = (x, y) => Math.abs(x - y) < 1e-9;
    if (judged.length > 1 && judged[0].tier === judged[1].tier
        && close(judged[0].overlap, judged[1].overlap) && close(judged[0].pre, judged[1].pre)) {
      console.warn('[binothaimeen] two candidates are indistinguishable, refusing');
      return [];
    }
    const win = judged[0];
    console.log('[binothaimeen] verified source', {
      id: win.lesson.sourceId, period: win.verdict, tier: win.tier, overlap: Number(win.overlap.toFixed(2)),
    });
    return [{ ...win.lesson, overlap: win.overlap, periodVerdict: win.verdict, periodTier: win.tier }];
  } catch (e) {
    // Belt and braces: the paths above already swallow their own failures.
    console.warn('[binothaimeen] adapter threw:', e && e.message);
    return [];
  }
}
