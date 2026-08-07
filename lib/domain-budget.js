// lib/domain-budget.js
// HOW LONG IS THIS PARTICULAR HOST ALLOWED TO TAKE? Directive 7.
//
// Every fetch on the live path shares one number: perFetchTimeoutMs, 8000ms (lib/retrieve.js),
// mirrored by FETCH_TIMEOUT_MS in lib/ledger/budgets.js. One number for thirty-one hosts is a
// reasonable default and a poor description of any of them, and until 2026-08-07 nobody had
// ever recorded how long a single one actually takes — so any change to it would have been
// tuning by feel. tools/source-liveness.cjs now records a response time per domain, and this
// file holds the only two conclusions those numbers actually support.
//
// THE RULE THIS FILE IS UNDER: nothing here is a guess. A host gets an entry when it has been
// MEASURED, the measurement is written next to it, and the entry follows from the measurement.
// An empty map is the correct state for a host nobody has measured.

// ── islamweb.net: MEASURED, AND COMFORTABLY INSIDE THE BUDGET ────────────────
// Nine samples on 2026-08-07 across three different fatwa pages, through the production
// pipeline (fetch + Readability, the same work the budget is spent on):
//
//     521, 541, 547, 568, 570, 1028, 1084, 1125 ms      worst observed 1125ms
//
// That is about a seventh of the 8000ms it is currently allowed. So the answer to "does
// islamweb fit the request budget?" is yes, with room, and the `degraded` branch below does not
// apply to it.
//
// It gets a TIGHTER timeout, not a looser one, and the direction is the point. A host measured
// to answer in about half a second has no legitimate reason to take eight, so when it does, the
// request is not slow — it is stuck, and eight seconds of a reader's wait are being spent on a
// fetch that will not arrive. 3000ms is 2.7x the worst sample: far outside normal variance,
// far inside the shared default.
export const ISLAMWEB_FETCH_TIMEOUT_MS = 3000;

// ── islamstory.com: MEASURED OUTSIDE ITS BUDGET, AND STILL GIVEN A NUMBER ────
// The same seven samples recorded under DEGRADED below, in the order they were taken on
// 2026-08-07:
//
//     4452, 11582, 20000, 20000, 20000, 20000, 20000 ms     (20000 = ABORTED at the probe ceiling)
//
// THE NUMBER IS DERIVED DIFFERENTLY FROM islamweb's, because the measurement is a different
// shape and the same arithmetic would lie. islamweb is a fast host that could only ever be
// STUCK at eight seconds, so its allowance is a multiple of its worst sample. This host has no
// worst sample worth multiplying: five of seven never arrived at all, and 2.7x its best would be
// 12020ms — half again the budget it is already measured to miss.
//
// So the number comes from where the samples actually FELL. Inside the 8000ms budget exactly ONE
// of the seven ever arrived, at 4452ms. The window from 4452ms to 8000ms is measured EMPTY: not
// one sample landed in it, so not one answer was ever bought with those 3.5 seconds. 5000ms
// keeps the whole of the region that has ever produced a page — with 548ms of headroom over the
// only success — and gives up a window in which nothing was ever observed to arrive.
//
// WHY IT IS A TIGHTENING AND NOT A REMOVAL. The host is on SITES_MINOR, so its slow tail is paid
// for out of a child's question: at 8000ms a failing fetch costs eight seconds of a child's wait
// and returns nothing. Failing fast at 5000 gives three of those seconds back to the search
// that will actually answer — the pass carries on down the list either way. The host is removed
// from no list, and nothing below decides that for anyone.
export const ISLAMSTORY_FETCH_TIMEOUT_MS = 5000;

// Registrable host -> milliseconds. Consulted by lib/retrieve.js; absent means "use the shared
// default", which is the state of every host but the two below.
export const DOMAIN_FETCH_TIMEOUT_MS = Object.freeze({
  'islamweb.net': ISLAMWEB_FETCH_TIMEOUT_MS,
  'islamstory.com': ISLAMSTORY_FETCH_TIMEOUT_MS,
});

// ── DEGRADED: A LABEL, AND DELIBERATELY NOTHING ELSE ─────────────────────────
// A host here has been measured to fall outside the budget it is given. The entry changes NO
// behaviour: it removes the host from no list, filters nothing, and is read by no request path.
// It exists so that a measurement nobody has decided about yet is written down instead of
// remembered, and so the decision — which is the owner's — is made against numbers.
//
// Removing a source is not a call this file gets to make. Recording that one no longer answers
// in time is.
//
// AND THE LABEL IS STILL INERT AFTER islamstory GOT A TIMEOUT. The timeout is an entry in
// DOMAIN_FETCH_TIMEOUT_MS above, written out by hand and read by lib/retrieve.js like any other;
// it is NOT derived from this table, and no code path reads DEGRADED to decide anything. That
// separation is the point: if `isDegraded()` had quietly started shortening timeouts, then every
// future measurement written down here would silently change behaviour, and recording a fact
// would stop being free. A measurement is written here; a decision is written above it.
export const DEGRADED = Object.freeze({
  'islamstory.com': Object.freeze({
    measuredAt: '2026-08-07',
    // In order, all on the same probe URL and within about twenty minutes:
    samples: Object.freeze([4452, 11582, 20000, 20000, 20000, 20000, 20000]),
    budgetMs: 8000,
    note:
      'Two samples inside the day\'s liveness runs came back in 4452ms and 11582ms — the second '
      + 'already past the 8000ms per-fetch budget. Five consecutive samples immediately after '
      + 'ABORTED at the 20000ms probe ceiling. The host is on SITES_MINOR, so the cost of the '
      + 'slow tail is paid by a child\'s question: the fetch is aborted before it arrives and '
      + 'those seconds buy nothing. Acted on 2026-08-07 by ISLAMSTORY_FETCH_TIMEOUT_MS above — '
      + 'the wait was cut from 8000ms to 5000ms, which is a tightening and not a removal.',
    // Said plainly because the difference matters to the decision and cannot be settled from
    // here: roughly eight requests were made to this host inside twenty minutes while
    // measuring. A host that throttles a repeat caller and a host that is simply slow look
    // identical from outside, and no number available here separates them. A single probe on a
    // later day, from a cold start, is what would.
    caveat:
      'NOT ESTABLISHED: whether this is the host\'s own variance or a response to our own '
      + 'repeated probing during the measurement window.',
  }),
});

const registrable = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

/** The registrable host of a URL, or '' if it will not parse. */
export function hostOfUrl(url) {
  try { return registrable(new URL(String(url)).hostname); } catch (e) { return ''; }
}

/**
 * The timeout this URL's host should get, in ms.
 * @param {string} url
 * @param {number} defaultMs the caller's shared budget
 * @returns {number} the host's measured allowance, or the caller's default unchanged
 */
export function fetchTimeoutFor(url, defaultMs) {
  const host = hostOfUrl(url);
  const own = DOMAIN_FETCH_TIMEOUT_MS[host];
  return Number.isFinite(own) ? own : defaultMs;
}

/** Has this host been measured outside its budget? A label for a report, never a filter. */
export function isDegraded(host) {
  return Object.prototype.hasOwnProperty.call(DEGRADED, registrable(host));
}
