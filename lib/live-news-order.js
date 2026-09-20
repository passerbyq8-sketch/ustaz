// lib/live-news-order.js — ON A GENERAL NEWS QUESTION, THE OUTLETS WE VETTED COME FIRST.
//
// ── WHAT WAS MEASURED, AND IT IS NOT A BUG IN THE SEARCH ────────────────────
// The owner asked the preview for «أهمُّ الأخبار». What came back cited `akher.news`,
// `youm7.com` and `tunisie-telegraph.com` — Egypt's gold price and Tunisia's weather — and not
// one of the four outlets this application actually admits (الجزيرة · بي بي سي · سكاي نيوز عربية
// · ويكيبيديا). Every one of those three pages is a real page that really answers a real search;
// none of them is what «أهمُّ أخبارِ العالم» means.
//
// ── SO THIS ORDERS AND DOES NOT FILTER, AND THAT IS THE WHOLE DESIGN ───────
// «لا تحذفْ غيرَها ولا تمنعْه — رتِّبْ فقط.» A filter here would be a second admission rule
// competing with lib/ledger/source-policy.js, and it would answer «لا أجد» on the day the four
// outlets are all slow. A sort answers with what the search found, in the order that puts the
// vetted outlet at the top of the page and the rest behind it. Nothing is dropped, nothing is
// refused, and a turn on which none of the four returned anything is byte for byte what it was.
//
// ── IT IS A STABLE SORT, AND THAT MATTERS MORE THAN IT LOOKS ───────────────
// Inside each of the two groups the provider's own ranking survives untouched. An unstable sort
// here would make the same question return a different first source on two runs, which is the
// instability lib/retrieve.js's «a confirmed match ends the wave» rule was written to end.
//
// ── THE LIST IS THE REGISTRY'S, NEVER A SECOND ONE ─────────────────────────
// `domainsForWorld()` is the same function lib/retrieve.js derives SITES_GENERAL from, and it is
// already behind the switch (a `world-v2` row is admitted only when LIVE_WORLD_V2 is on). So a
// fifth admitted outlet is ordered first the day its row lands, with no table here to update.
//
// ── AND IT IS BEHIND THE SWITCH, IN THIS FILE RATHER THAN AT THE CALL SITE ──
// lib/free-brain/tools.js reaches every flagged behaviour through the module that owns it and
// tests no environment of its own — guards/live-world-v2-killswitch-guard.cjs says so in as many
// words and checks the second half by reading the file. Putting the test here keeps that true:
// with the switch off this function returns its own argument, the same array object, so the tool
// layer's rows are in the provider's order exactly as they were before this file existed.
//
// NO I/O, NO MODEL CALL, NO STATE.

import { liveWorldV2Enabled } from './live-world-v2.js';
import { domainsForWorld } from './source-registry.js';

// ── WHICH QUESTIONS THIS IS FOR ──────────────────────────────────────────────
// The owner's words are «في سؤالِ الخبرِ العامِّ (NEWS_TERM وما يشبهُه)», and what resembles it in
// lib/world-intent.js is exactly one other reason: NEWS_PHRASE, which is the same class reached
// by a frame («آخرُ الأخبار») instead of by a word («أخبار»). The list stops there on purpose. A
// WEATHER or a MARKET_PRICE question is not a news question, and pushing the general news desks
// above the page that actually carries the figure would answer a price question with a headline.
const NEWS_REASONS = new Set(['NEWS_TERM', 'NEWS_PHRASE']);

/** The host a retrieved row belongs to, from whichever of the two shapes carries it. */
function hostOf(row) {
  const declared = String((row && row.host) || '').toLowerCase().replace(/^www\./u, '');
  if (declared) return declared;
  try { return new URL(String((row && row.url) || '')).hostname.toLowerCase().replace(/^www\./u, ''); }
  catch { return ''; }
}

/**
 * Put the admitted world outlets at the front of a general-news result set.
 *
 * @param {Array<object>} sources  the rows the live search returned, in the provider's order
 * @param {object} o
 *   reason  the classifier's reason for this query (lib/world-intent.js's own vocabulary)
 * @returns {Array<object>} the same rows; the SAME array when nothing applies
 */
export function orderNewsSourcesFirst(sources, { reason = '' } = {}) {
  if (!liveWorldV2Enabled()) return sources;
  if (!Array.isArray(sources) || sources.length < 2) return sources;
  if (!NEWS_REASONS.has(String(reason))) return sources;
  const admitted = new Set(domainsForWorld().map((d) => String(d).toLowerCase()));
  if (!admitted.size) return sources;
  const ours = [];
  const rest = [];
  for (const row of sources) (admitted.has(hostOf(row)) ? ours : rest).push(row);
  // Nothing to do, and saying so by returning the input rather than a shuffled copy of it: a
  // turn where the vetted outlets returned nothing, or returned everything, must be untouched.
  if (!ours.length || !rest.length) return sources;
  return [...ours, ...rest];
}
