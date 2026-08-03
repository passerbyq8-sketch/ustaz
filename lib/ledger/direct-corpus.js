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

import { primaryOpinionAdapter, policyFor } from './source-policy.js';
import { segmentPage } from './segment.js';

// How many RECORDS may be admitted for extraction, whatever they cost to obtain. Separate from
// the request budget on purpose: one response can carry twenty records, which costs one
// round-trip and would still blow the model's input budget if all twenty were segmented.
export const MAX_ACCEPTED_RECORDS = 3;

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
  const empty = { pages: [], networkCalls: 0, timedOut: false, threw: false };
  const adapter = adapterOnlyCorpusFor(authorityId);
  if (!adapter) return empty;

  const reader = opts.reader || DEFAULT_READERS[authorityId];
  if (!reader) return empty;

  const question = [
    ...issue.protectedEntities, ...issue.exactUserPhrases, ...issue.coreTerms, ...issue.contextVars,
  ].join(' ').trim();

  const budget = opts.budget || null;

  // ── the gate the adapter's own request path consults ──
  // allow() is called by lib/binothaimeen.js's httpJson BEFORE each socket opens, including
  // before a retry. It reserves a unit or refuses; there is no path where a request starts and
  // is charged afterwards.
  let networkCalls = 0;
  const controller = new AbortController();
  const io = {
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

  // THE DEADLINE COVERS THE READER ITSELF, not merely the stages after it returns. A reader that
  // never settles would otherwise hold the request open past every budget the engine enforces.
  const remaining = budget ? budget.remainingMs() : 0;
  let timedOut = false;
  let raw;
  try {
    const call = reader(question, issue, io);
    raw = remaining > 0
      ? await Promise.race([
        call,
        new Promise((resolve) => {
          const t = setTimeout(() => { timedOut = true; controller.abort(); resolve(null); }, remaining);
          if (t && typeof t.unref === 'function') t.unref();
        }),
      ])
      : await call;
  } catch {
    // A THROWING ADAPTER IS A REFUSAL, NEVER A REASON TO SEARCH GENERALLY. Falling back to a
    // general search here would answer "what does this man hold" from somebody else's page,
    // which is the one thing this whole path exists to prevent.
    controller.abort();
    return { ...empty, networkCalls, threw: true };
  }
  if (timedOut) return { ...empty, networkCalls, timedOut: true };
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
  return { pages: out, networkCalls, timedOut: false, threw: false };
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
