// lib/ledger/direct-corpus.js
// READING A SCHOLAR'S OWN CORPUS DIRECTLY, WHERE ONE EXISTS.
//
// TWO SHAPES OF "HIS OWN SITE", AND THEY ARE NOT THE SAME MECHANISM:
//
//   * A SEARCHABLE DOMAIN — binbaz.org.sa. It is on the allow-list, the provider indexes it,
//     and asking for his position is an ordinary scoped search of one domain. Nothing special
//     is needed and this module returns null for it, which tells the engine to search.
//
//   * AN ADAPTER-ONLY CORPUS — binothaimeen.net. It has never been in the `site:` filter and
//     must not be: lib/binothaimeen.js reads it through the site's own endpoints, ranks
//     candidates against the question, and applies its own acceptance threshold. A Brave search
//     is neither necessary nor permitted here, so the engine calls THIS instead of planning
//     batches, and the request costs no provider call at all.
//
// WHAT IS NOT DELEGATED. The adapter decides WHICH of his pages is about the question. It does
// not decide what he ruled and it does not get to skip a gate: whatever it returns is segmented,
// span-addressed, extracted and verified exactly like a page that came from a search. The only
// thing this module changes is where the bytes came from.

import { primaryOpinionAdapter, policyFor, capabilityEligible } from './source-policy.js';
import { capabilityForIntent } from './capability.js';
import { segmentPage } from './segment.js';

// How many RECORDS may be admitted for extraction, whatever they cost to obtain. Separate from
// the request budget on purpose: one response can carry twenty records, which costs one
// round-trip and would still blow the model's input budget if all twenty were segmented.
export const MAX_ACCEPTED_RECORDS = 3;

// Units held back from the SEARCH phase so the READ phase can happen. One is enough: the adapter
// needs a single lesson GET to turn its best candidate into citable text, and without this the
// searches consume the ceiling and the request ends with a shortlist nobody read.
export const RESERVE_FOR_FETCH = 1;

/**
 * Is this authority read through an adapter rather than through a search?
 * @returns {{domain:string, adapterId:string, adapterVersion:string}|null}
 */
export function adapterOnlyCorpusFor(authorityId) {
  const a = primaryOpinionAdapter(authorityId);
  if (!a) return null;
  const row = policyFor(a.domain);
  if (!row || row.searchable) return null;         // searchable => the ordinary scoped search
  return a;
}

// ── CONSULTING AN ADAPTED CORPUS ON A QUESTION THAT NAMES NOBODY ─────────────
//
// THE MEASURED HOLE. binothaimeen.net is the highest-rated primary-opinion source in the whole
// policy table (98) and it has a working adapter — and because it is `searchable: false`, it was
// consulted ONLY when a reader named Ibn Uthaymeen. Every ordinary fiqh question in the app's
// history went past the richest corpus it owns without touching it. «حكم السفر للسياحة لدول غير
// مسلمة» has a documented answer of his; a reader who did not know to ask for him by name could
// never reach it.
//
// WHAT THIS IS AND IS NOT.
//   * It is an INDEPENDENT consultation, not a list entry. `searchable: false` is untouched, no
//     `site:` filter gains a domain, and no band list changes. The corpus is READ, exactly as it
//     is for a named request; it is never SEARCHED.
//   * Its output joins the candidate pool and competes under the same rules as any other page —
//     the URL and page gates, the post-fetch admission, the question-match check, and the
//     provenance ceiling. It gets no shortcut for being ours.
//   * It is never a default answer. A corpus that returns nothing, or whose pages fail a gate,
//     changes the reply by exactly nothing.
//
// THE CAPABILITY CHECK IS PART OF THE DECISION, NOT AN AFTERTHOUGHT. binothaimeen.net declares
// caps for `fatwa` and `general_article` only. Consulting it for a tafsir or hadith question would
// spend network units on pages that admitPostFetch is then obliged to refuse — so the eligibility
// question is asked BEFORE the I/O rather than after it. Widening that would mean relaxing a
// restriction in lib/ledger/source-policy.js, which that file forbids and this does not do.
const ADAPTED_CORPORA = Object.freeze(['ibn-uthaymeen']);
export const CONSULT_INTENTS = Object.freeze(['fatwa', 'tafsir', 'hadith', 'hadith_explanation']);

/**
 * Which adapted corpus, if any, should be consulted alongside the ordinary search for this issue?
 *
 * @returns {{authorityId:string, domain:string, adapterId:string, adapterVersion:string}|null}
 */
export function adaptedCorpusConsultFor(issue) {
  if (!issue) return null;
  // A NAMED SCHOLAR IS A DIFFERENT PATH ENTIRELY. When the reader asks for somebody's position,
  // the engine already routes to his corpus or caps the attribution; adding a second man's corpus
  // to that question would be answering about the wrong person.
  if (issue.requestedAuthorityId) return null;
  if (!CONSULT_INTENTS.includes(issue.intent)) return null;
  const capability = capabilityForIntent(issue.intent);
  for (const authorityId of ADAPTED_CORPORA) {
    const a = adapterOnlyCorpusFor(authorityId);
    if (!a) continue;
    if (!capabilityEligible(a.domain, capability)) continue;
    return { authorityId, ...a };
  }
  return null;
}

/**
 * Read the corpus. Returns page-shaped objects ready for the same segmentation every other
 * page goes through.
 *
 * ── THE BUDGET IS RESERVED BEFORE THE I/O, NOT AFTER THE RESULT ─────────────
 * MEASURED, in lib/binothaimeen.js: `retrieveIbnUthaymeen` is NOT one request returning a set.
 * It makes up to MAX_SEARCHES (6) search POSTs and up to MAX_FETCHES (3) lesson GETs — nine
 * logical network calls, each with one retry — all through the single choke point `httpJson`.
 *
 * So counting the DOCUMENTS IT RETURNED, as the first version of this file did, was wrong twice
 * over: it under-counted (nine requests could be charged as one document) and it could not
 * prevent anything, because a tally taken after the reader returns cannot stop a request the
 * reader has already made. A reader that returns one document may have cost nine round-trips.
 *
 * The fix is a gate INSIDE the adapter's request path. `io.allow()` reserves one unit of the
 * request's budget before each socket opens and refuses when there is none left, so the sixth
 * request is never started rather than started and discarded. `io.signal` is the request's
 * deadline, so a hung adapter is aborted instead of being waited out.
 *
 * @param {string} authorityId
 * @param {object} issue
 * @param {object} opts  { reader, budget, purpose } — reader is injected so the guard can drive
 *                       this without a network; budget is the request's, shared with the
 *                       searched path so one ceiling governs both.
 * @returns {Promise<{pages:Array, networkCalls:number, timedOut:boolean, threw:boolean}>}
 */
export async function readDirectCorpus(authorityId, issue, opts = {}) {
  const empty = { pages: [], networkCalls: 0, timedOut: false, threw: false, readerCalled: 0 };
  const adapter = adapterOnlyCorpusFor(authorityId);
  if (!adapter) return empty;

  const reader = opts.reader || DEFAULT_READERS[authorityId];
  if (!reader) return empty;

  // THE ADAPTER GETS THE READER'S OWN QUESTION. Reassembling one out of the IR's term lists
  // drops the words that are not "terms" — and in this corpus those words are the ruling.
  // MEASURED: the term bag for «ما رأي الشيخ ابن عثيمين فيمن أسقطت قبل ثمانين يومًا؟» came out
  // as «أسقطت ثمانين يوما», which lib/duration.js parses as AT eighty days. The Shaykh's page
  // rules on BEFORE eighty days, so the adapter's duration gate correctly refused its own
  // correct page: the question it was given no longer contained «قبل».
  //
  // Same failure as feeding the engine `plan.attribution.question` — a downstream component
  // handed a derived string instead of what the reader wrote.
  const question = String(opts.question || '').trim() || [
    ...issue.protectedEntities, ...issue.exactUserPhrases, ...issue.coreTerms, ...issue.contextVars,
  ].join(' ').trim();

  const budget = opts.budget || null;

  // ── the gate the adapter's own request path consults ──
  // allow() is called by lib/binothaimeen.js's httpJson BEFORE each socket opens, including
  // before a retry. It reserves a unit or refuses; there is no path where a request starts and
  // is charged afterwards.
  let networkCalls = 0;
  const controller = new AbortController();
  // RESERVE CAPACITY FOR THE FETCH PHASE. The adapter searches first and reads pages second; if
  // the search phase is allowed to spend the whole ceiling, the read phase never happens and the
  // adapter cannot succeed at all. So it is told how many searches it may afford, keeping at
  // least one unit back for the page it is searching FOR.
  const freeUnits = budget
    ? Math.max(0, budget.limits.pagesFetched - budget.spent.pagesFetched)
    : Infinity;
  const searchAllowance = freeUnits === Infinity ? undefined : Math.max(1, freeUnits - RESERVE_FOR_FETCH);

  const io = {
    // Passed straight through to the adapter's request path so a test can drive the REAL
    // search -> lesson -> httpJson chain. Undefined on every shipped path.
    fetchImpl: opts.fetchImpl,
    maxSearches: searchAllowance,
    allow() {
      if (budget) {
        if (budget.deadlineReached()) return false;
        if (!budget.canAfford('pagesFetched')) return false;
        budget.spend('pagesFetched', 1, opts.purpose || 'direct');
      }
      networkCalls++;
      return true;
    },
    signal: controller.signal,
  };

  // ── THE DEADLINE IS CHECKED BEFORE THE READER IS CALLED AT ALL ──
  // The previous version computed `remaining` and then wrote `remaining > 0 ? race : await call`.
  // With the deadline ALREADY EXPIRED that took the `await call` branch — invoking the adapter
  // with no timeout guarding it whatsoever. MEASURED: a never-settling reader hung the request
  // indefinitely, which is the precise opposite of what a deadline is for.
  const remaining = budget ? budget.remainingMs() : Infinity;
  if (remaining <= 0) {
    return { ...empty, timedOut: true, readerCalled: 0 };
  }

  let timedOut = false;
  let timer = null;
  let readerCalled = 0;
  let raw;
  try {
    readerCalled = 1;
    const call = reader(question, issue, io);
    if (remaining === Infinity) {
      raw = await call;
    } else {
      // ONE timer, resolved or rejected by whichever happens first, and cleared in `finally` so
      // nothing is left running after a successful read. Deliberately NOT unref'd: this timer is
      // the only thing that can settle the promise being awaited, and an unref'd timer does not
      // keep the event loop alive — the process could exit before it ever fired.
      raw = await new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();          // stop the adapter's in-flight requests, do not just walk away
          resolve(null);
        }, remaining);
        call.then(resolve, reject);
      });
    }
  } catch {
    // A THROWING ADAPTER IS A REFUSAL, NEVER A REASON TO SEARCH GENERALLY. Falling back to a
    // general search here would answer "what does this man hold" from somebody else's page,
    // which is the one thing this whole path exists to prevent.
    controller.abort();
    return { ...empty, networkCalls, readerCalled, threw: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (timedOut) return { ...empty, networkCalls, readerCalled, timedOut: true };
  const list = Array.isArray(raw) ? raw : [];

  const out = [];
  for (const r of list) {
    // A record ACCEPTED for extraction is bounded too, separately from the request count: a
    // single response carrying twenty records would otherwise blow the token budget even though
    // it cost one round-trip.
    if (out.length >= MAX_ACCEPTED_RECORDS) break;
    const canonicalUrl = String(r.canonicalUrl || r.url || '');
    const text = String(r.exactText || r.authorialText || '');
    if (!canonicalUrl || !text) continue;
    // A page from an adapter is still checked against the policy: an adapter that started
    // returning URLs from somewhere else must not be believed because it is ours.
    const row = policyFor(canonicalUrl);
    if (!row || row.health !== 'enabled' || row.domain !== adapter.domain) continue;
    const page = {
      sourceId: canonicalUrl,
      url: canonicalUrl,
      canonicalUrl,
      canonicalBasis: 'fetched',
      host: adapter.domain,
      ownerId: authorityId,
      title: String(r.title || ''),
      authorialText: text,
      author: String(r.scholar || ''),
      attributionType: 'scholar-primary',
      kind: 'answer',
      dates: r.dates || {},
      media: { audio: 0, video: 0, pdf: 0, any: 0 },
      hasTranscript: true,
      adapterVersion: adapter.adapterId + '@' + adapter.adapterVersion,
    };
    const segmented = segmentPage(page);
    out.push({ page: { ...page, answerUnits: segmented.answerUnits }, segmented });
  }
  return { pages: out, networkCalls, timedOut: false, threw: false, readerCalled };
}

// The production readers. Lazily imported so a request that never asks about Ibn Uthaymeen does
// not load his adapter.
const DEFAULT_READERS = {
  'ibn-uthaymeen': async (question, issue, io) => {
    const { retrieveIbnUthaymeen } = await import('../binothaimeen.js');
    // `io` is what makes every one of the adapter's up-to-nine network calls reserve budget
    // before it starts. Without it the adapter behaves exactly as it does on the shipped
    // attributed route, which is why the shipped route passes none.
    return retrieveIbnUthaymeen(question, { io });
  },
};
