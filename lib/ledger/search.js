// lib/ledger/search.js
// THE PROVIDER ADAPTER. One function, and the last measurement before the wire.
//
// It re-measures `q` even though lib/ledger/query-build.js already built to the bound. That is
// not belt-and-braces for its own sake: the defect this whole engine was specified around was a
// query built in one place and measured in none, and the failure was SILENT at every layer
// above — an over-long query is not a degraded search, it is no search, and it comes back as an
// ordinary empty result set that reads as "nothing was found".
//
// A snippet returned here is a POSITION HINT and never evidence. It reaches
// lib/ledger/rank.js's ordering and stops there; no snippet text is ever segmented, quoted,
// verified or shown.

import { SEARCH_TIMEOUT_MS } from './budgets.js';
import { measureQuery } from './budgets.js';
import { isSendable } from './query-build.js';
import { BUDGET_REASON } from './daily-budget.js';

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * @returns {Promise<Array<{url:string,title:string,snippet:string}>>}
 * An empty array for every failure. A search that fails is a search that found nothing, and
 * the engine's answer to finding nothing is already correct.
 */
export async function braveSearch(q, sites, opts = {}) {
  if (!process.env.BRAVE_API_KEY) return [];
  if (!isSendable(q)) {
    const m = measureQuery(q);
    console.warn('[ledger] REFUSING over-long query (' + m.chars + 'c/' + m.words + 'w) — not sent');
    return [];
  }
  if (opts.dailyBudget && typeof opts.dailyBudget.reserve === 'function') {
    let reservation = null;
    try { reservation = await opts.dailyBudget.reserve(); } catch { reservation = null; }
    if (!reservation || !reservation.ok) {
      const error = new Error(reservation?.reason || BUDGET_REASON.STORE);
      error.reason = reservation?.reason || BUDGET_REASON.STORE;
      throw error;
    }
  // Silence is not an opt-out: every sendable provider call reserves, unless a non-runtime
  // harness names the exceptional mode explicitly and records its reason at that call site.
  } else if (opts.allowUnmetered !== true) {
    const error = new Error(BUDGET_REASON.STORE);
    error.reason = BUDGET_REASON.STORE;
    throw error;
  }
  const doFetch = opts.fetchImpl || globalThis.fetch;
  const count = Math.min(Math.max(opts.count || 5, 1), 10);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || SEARCH_TIMEOUT_MS);
  try {
    const res = await doFetch(BRAVE_URL + '?q=' + encodeURIComponent(q) + '&count=' + count, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_API_KEY,
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn('[ledger] search HTTP ' + res.status);
      return [];
    }
    const data = await res.json();
    const items = (data && data.web && data.web.results) || [];
    return items
      .filter((x) => x && typeof x.url === 'string')
      .map((x) => ({ url: x.url, title: String(x.title || ''), snippet: String(x.description || '') }));
  } catch (e) {
    clearTimeout(timer);
    console.warn('[ledger] search failed:', e && e.message ? e.message.slice(0, 80) : 'unknown');
    return [];
  }
}

/**
 * THE LIVE CONTRACT TEST for `site:A OR site:B`.
 *
 * A mocked provider proves we BUILT the OR form; it cannot prove the provider HONOURS it. This
 * runs the two forms against the real endpoint and reports whether the OR results actually stay
 * inside the named domains. It is not a Git gate — it needs a key and a network, and a gate that
 * depends on either is a gate that goes red for reasons unrelated to the code.
 *
 * @returns {Promise<{ran:boolean, orHonoured?:boolean, detail:string}>}
 */
export async function probeOrContract(sites, question, opts = {}) {
  if (!process.env.BRAVE_API_KEY) return { ran: false, detail: 'VOID: no BRAVE_API_KEY' };
  const two = sites.slice(0, 2);
  if (two.length < 2) return { ran: false, detail: 'VOID: needs two domains' };
  const q = question + ' (site:' + two[0] + ' OR site:' + two[1] + ')';
  const results = await braveSearch(q, two, opts);
  if (!results.length) return { ran: true, orHonoured: false, detail: 'OR form returned zero results' };
  const inside = results.filter((r) => {
    try {
      const h = new URL(r.url).hostname.toLowerCase().replace(/^www\./, '');
      return two.some((d) => h === d || h.endsWith('.' + d));
    } catch { return false; }
  });
  return {
    ran: true,
    orHonoured: inside.length === results.length,
    detail: inside.length + '/' + results.length + ' results inside the named domains',
  };
}
