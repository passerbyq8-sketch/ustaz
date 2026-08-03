// lib/brave-query.js
// EVERY BRAVE QUERY THIS APP SENDS IS BUILT HERE, AND NONE OF THEM CAN BE TOO LONG.
//
// THE DEFECT THIS FILE EXISTS TO MAKE IMPOSSIBLE, measured on production 2026-08-03:
// the adult allow-list grew from 14 domains to 24, and the `site:` filter grew with it.
//
//     14 domains -> q = 341 characters, 36 words   -> Brave answers
//     24 domains -> q = 576 characters, 56 words   -> Brave rejects
//
// Brave's documented ceiling is 400 characters and 50 words. Crossing it did not degrade
// the search, it ABOLISHED it: every adult question that needed a source came back with
// «تعذّر عليّ التحقق من مصدر موثوق», while children — whose list is three domains and whose
// query stayed short — were unaffected, and so was the Ibn Uthaymeen adapter, which does not
// use Brave at all. Twenty-five green gates said nothing, because not one of them measured
// the thing the provider actually refuses.
//
// SO THE RULE IS NOT "KEEP THE LIST SHORT". The list is allowed to grow; the QUERY is what
// must stay bounded. planQueries() splits the allow-list into as many groups as it takes for
// every single request to sit under our own limit, which is deliberately below Brave's:
//
//     provider hard limit : 400 chars / 50 words   (never reached)
//     our safe limit      : 380 chars / 45 words   (what we actually build to)
//
// The margin is not superstition. `q` is percent-encoded and the count that matters is the
// one the provider applies to the decoded string, so a measurement taken anywhere but on the
// final assembled value is the wrong measurement — and a 20-character cushion absorbs a
// domain being added to the list without anyone re-deriving the arithmetic.
//
// NOTHING IS DROPPED. A domain that does not fit in group 1 goes in group 2; it is never
// silently discarded, and brave-query-guard.cjs proves that the union of the groups is
// exactly the input list, for every purpose and for every question it is given.

import { rankForPurpose } from './source-registry.js';

// ── the two ceilings ─────────────────────────────────────────────────────────
export const HARD_MAX_CHARS = 400;   // the provider's. We must never reach it.
export const HARD_MAX_WORDS = 50;
export const SAFE_MAX_CHARS = 380;   // ours. What planQueries() actually builds to.
export const SAFE_MAX_WORDS = 45;

// Words the way a whitespace-splitting counter sees them — which is what the provider's
// word limit is about. `site:islamqa.info` is one word; so is `OR`.
export function measureQuery(q) {
  const s = String(q == null ? '' : q);
  return { chars: s.length, words: s.split(/\s+/).filter(Boolean).length };
}
export function withinSafe(q) {
  const m = measureQuery(q);
  return m.chars <= SAFE_MAX_CHARS && m.words <= SAFE_MAX_WORDS;
}
export function withinHard(q) {
  const m = measureQuery(q);
  return m.chars <= HARD_MAX_CHARS && m.words <= HARD_MAX_WORDS;
}

// The one place the query string is assembled. retrieve.js used to build this inline; it
// does not any more, so there is no second formula that could disagree with the measurement.
export function siteFilter(sites) {
  return (sites || []).map((s) => 'site:' + s).join(' OR ');
}
export function buildQuery(question, sites) {
  const q = String(question == null ? '' : question).trim();
  const f = siteFilter(sites);
  if (!f) return q;
  return q + ' (' + f + ')';
}

// ── shortening an over-long question ─────────────────────────────────────────
// A question long enough to crowd out the site filter has to give ground, and HOW it gives
// ground is not a detail:
//
//   * whole words only. Cutting a string at character N lands in the middle of an Arabic
//     word and produces a token that matches nothing;
//   * numbers and time units are the LAST thing to go. In this app a period is frequently
//     the ruling itself — «دون 80 يوم» is the whole question — so a shortener that trimmed
//     the tail would silently delete the very thing being asked about. Tokens carrying a
//     digit, or a unit of time, are held back and dropped only when nothing else is left.
//
// Deliberately NOT lib/binothaimeen.js's searchWords(): that function's stop-list contains
// «يوم», «ايام», «قبل», «بعد» and «دون» — exactly the words a duration question is made of.
// It is the right tool for ranking a scholar's corpus and the wrong one here.
const AR_DIGITS = /[0-9٠-٩]/;
const TIME_UNITS = ['يوم', 'يوما', 'يومًا', 'أيام', 'ايام', 'شهر', 'شهرا', 'أشهر', 'اشهر',
  'سنة', 'سنه', 'سنوات', 'أسبوع', 'اسبوع', 'أسابيع', 'اسابيع', 'ساعة', 'ساعه', 'ركعة', 'ركعه'];
function isEssential(tok) {
  if (AR_DIGITS.test(tok)) return true;
  const bare = tok.replace(/[^؀-ۿ0-9a-zA-Z]/g, '');
  return TIME_UNITS.includes(bare);
}

/**
 * Trim `question` by whole words until `buildQuery(question, sites)` fits the safe limit.
 * Non-essential words go first, from the end; essential ones (numbers, time units) are kept
 * as long as possible. Returns the question unchanged when it already fits.
 */
export function shortenQuestion(question, sites) {
  const sitesArr = Array.isArray(sites) ? sites : [];
  let toks = String(question == null ? '' : question).trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return '';
  const fits = (t) => withinSafe(buildQuery(t.join(' '), sitesArr));
  if (fits(toks)) return toks.join(' ');

  // pass 1 — drop non-essential words from the end
  for (let i = toks.length - 1; i >= 0 && !fits(toks); i--) {
    if (!isEssential(toks[i])) toks.splice(i, 1);
  }
  // pass 2 — nothing but essentials left and it still does not fit: drop from the end.
  while (toks.length > 1 && !fits(toks)) toks.pop();
  return toks.join(' ');
}

/**
 * THE ENTRY POINT. Split `sites` into as few groups as possible such that every group's
 * query is within the SAFE limit.
 *
 * @param {string} question
 * @param {string[]} sites            the band's allow-list, already scope-filtered
 * @param {{purpose?:string}} opts    purpose orders the sites; it never removes any
 * @returns {{question:string, shortened:boolean, groups:Array<{index:number, sites:string[], q:string, chars:number, words:number}>}}
 */
// How many search requests one angle may cost in the worst case. THIS IS A NETWORK BUDGET,
// not a formatting preference: the question text is repeated in EVERY group's query, so a
// long question does not merely shorten itself — it crowds out sites and multiplies the
// number of requests. MEASURED while building this: a 230-character question left room for
// about five domains per group, which turned one search into five. The question is therefore
// shortened until the plan fits this budget, and the shortening is the same whole-word,
// duration-preserving one described above.
export const MAX_GROUPS_TARGET = 3;
const MIN_QUESTION_TOKENS = 4;

function pack(q, ordered) {
  const groups = [];
  let current = [];
  for (const site of ordered) {
    const candidate = current.concat(site);
    if (withinSafe(buildQuery(q, candidate))) { current = candidate; continue; }
    if (current.length) groups.push(current);
    // A single site that still does not fit cannot be helped by another group; it goes in
    // one of its own, and the invariant in the gate catches it if even that is over.
    current = [site];
  }
  if (current.length) groups.push(current);
  return groups;
}

export function planQueries(question, sites, opts = {}) {
  const all = (Array.isArray(sites) ? sites : []).filter(Boolean);
  // ORDER, NOT SELECTION. The sources a purpose is really about go into group 1, so the
  // common case answers on the first request and the second is never made. Nothing is
  // removed here — scope filtering already happened, and every domain still lands in a group.
  const ordered = rankForPurpose(all, opts.purpose);
  const original = String(question == null ? '' : question).trim();

  // First, the hard floor: the question must leave room for at least ONE site or no group
  // could ever be formed. Size that against the LONGEST domain so it holds for every group.
  const longest = ordered.reduce((a, b) => (b.length > a.length ? b : a), ordered[0] || '');
  let q0 = shortenQuestion(original, longest ? [longest] : []);
  let groups = pack(q0, ordered);

  // Then the budget: keep trimming whole words until the plan costs at most MAX_GROUPS_TARGET
  // requests, or until the question has given all it can. Non-essential words go first, so a
  // number and its unit are the last things standing.
  while (groups.length > MAX_GROUPS_TARGET) {
    const toks = q0.split(/\s+/).filter(Boolean);
    if (toks.length <= MIN_QUESTION_TOKENS) break;
    let cut = -1;
    for (let i = toks.length - 1; i >= 0; i--) if (!isEssential(toks[i])) { cut = i; break; }
    if (cut === -1) cut = toks.length - 1;          // only essentials left: drop the last one
    toks.splice(cut, 1);
    q0 = toks.join(' ');
    groups = pack(q0, ordered);
  }

  return {
    question: q0,
    shortened: q0 !== original,
    groups: groups.map((g, i) => {
      const q = buildQuery(q0, g);
      const m = measureQuery(q);
      return { index: i + 1, sites: g, q, chars: m.chars, words: m.words };
    }),
  };
}

// A last, cheap assertion for the request path: refuse to send anything over the provider's
// ceiling even if a future edit breaks the planner. Returning false costs one angle its
// search; sending it costs every adult question its source, which is what happened.
export function isSendable(q) {
  return withinHard(q);
}
