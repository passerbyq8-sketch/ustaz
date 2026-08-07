// lib/ledger/query-build.js
// THE CODE BUILDS THE SEARCH. THE MODEL NEVER DOES.
//
// The IR says WHAT matters — the entity nobody may drop, the terms the ruling turns on, the
// context that narrows it. This file turns that into `q` strings, measures them the way the
// provider measures them, and packs the eligible domains into as few requests as the bounds
// allow. No string the model wrote is ever sent verbatim as a query.
//
// ── THE PRIORITY, AND WHY IT IS NOT NEGOTIABLE ───────────────────────────────
//   1. protected_entities  — the scholar, the body, the thing being ruled on. Dropping one
//      does not shorten the question, it CHANGES it: «ما رأي ابن باز في الجمع» without «ابن
//      باز» is a different question with a different right answer.
//   2. core_terms          — the decisive fiqh vocabulary.
//   3. context_vars        — the circumstances.
//   4. fillers             — and nothing else is ever dropped.
//
// If the protected terms alone will not fit under the bound together with one domain, the
// issue is REFUSED or returned for a follow-up. It is never trimmed into a question the reader
// did not ask. That is the whole difference between shortening and mutilating.
//
// ── WHY BOTH `site:A OR site:B` AND A SINGLE-SITE FALLBACK EXIST ─────────────
// The OR form is what makes a 24-domain list affordable, and it is what the shipped path
// already uses. But a unit test with a mocked provider proves only that WE built the string,
// never that the provider honours it — so the form is behind a contract flag, the fallback to
// one query per domain is implemented and tested, and the live contract test that would decide
// between them is reported separately and is VOID until it is actually run.

import {
  INTERNAL_MAX_QUERY_CHARS, INTERNAL_MAX_QUERY_WORDS,
  measureQuery, withinInternalBounds, withinProviderBounds,
} from './budgets.js';
import { capabilityForIntent } from './capability.js';
import { eligibleSites } from './source-policy.js';

// ── the two site-filter forms ────────────────────────────────────────────────
export const FILTER_FORMS = Object.freeze(['or', 'single']);

// The form the engine uses until a LIVE contract test says otherwise. Changing this is a
// one-word change and the fallback is already exercised by the gate.
export const DEFAULT_FILTER_FORM = 'or';

export function siteFilter(sites, form = DEFAULT_FILTER_FORM) {
  const list = (sites || []).filter(Boolean);
  if (!list.length) return '';
  if (form === 'single') {
    if (list.length !== 1) throw new Error('single-site form takes exactly one domain');
    return 'site:' + list[0];
  }
  return list.map((s) => 'site:' + s).join(' OR ');
}

export function assembleQuery(terms, sites, form = DEFAULT_FILTER_FORM) {
  const body = (terms || []).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const f = siteFilter(sites, form);
  if (!f) return body;
  return body ? body + ' (' + f + ')' : '(' + f + ')';
}

// ── term selection ───────────────────────────────────────────────────────────
// A filler is a word that carries no discrimination: the request wrapper, the vocative, the
// politeness. Deliberately SHORT and deliberately not a stemmer — the failure mode of an
// aggressive stop-list in this app is deleting «دون», «قبل», «يوم», each of which has been the
// whole question at some point.
const FILLERS = new Set([
  'ما', 'وما', 'هل', 'وهل', 'من', 'عن', 'في', 'على', 'إلى', 'الى', 'أن', 'ان', 'أنه', 'انه',
  'هذا', 'هذه', 'ذلك', 'تلك', 'لي', 'لك', 'له', 'لها', 'يا', 'أريد', 'اريد', 'أرجو', 'ارجو',
  'أفتوني', 'افتوني', 'فضيلتكم', 'شيخنا', 'رجاء', 'رجاءً', 'لو', 'سمحت', 'من فضلك',
  'جزاكم', 'الله', 'خيرا', 'خيرًا', 'وشكرا', 'شكرا',
]);

function isFiller(tok) {
  const bare = String(tok || '').replace(/[^؀-ۿ0-9a-zA-Z]/g, '');
  return !bare || FILLERS.has(bare);
}

/**
 * THE READER'S OWN SUBSTANTIVE WORDS, with nothing added.
 *
 * WHO ASKS FOR THIS, AND WHY IT LIVES HERE. lib/ledger/planner.js's deterministic fallback needs
 * terms for a plan no model produced — the last arm of «a refusal without a search is
 * structurally impossible». It does not invent them: it takes the reader's sentence and removes
 * the words that carry no discrimination, which is a judgement this file already owns in
 * FILLERS. Putting the extractor anywhere else would mean a second stop-list, and two stop-lists
 * are one waiting to disagree.
 *
 * DELIBERATELY NOT A STEMMER AND NOT A RE-ORDERING. Tokens keep the reader's spelling and the
 * reader's order, bounded only by what the IR will accept, so the query built from them is the
 * question that was asked and not a paraphrase of it.
 */
export function substantiveTerms(text, { maxTerms = 12, maxChars = 60 } = {}) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || '').split(/\s+/)) {
    // ARABIC PUNCTUATION IS PUNCTUATION. `؟` `،` `؛` `۔` live INSIDE the Arabic block, so the
    // letters-and-digits class used elsewhere in this file keeps them — and «الحاج؟» is a term
    // that matches nothing. Measured on the first drive of the deterministic floor: six of six
    // questions ended in a term with a question mark welded to it.
    const tok = raw.replace(/^[،-؟۔«»"'()[\]{}.,:;!?_\-]+/, '')
      .replace(/[،-؟۔«»"'()[\]{}.,:;!?_\-]+$/, '')
      .replace(/^[^؀-ۿ0-9a-zA-Z]+|[^؀-ۿ0-9a-zA-Z]+$/g, '');
    if (!tok || tok.length > maxChars || isFiller(tok) || seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
    if (out.length >= maxTerms) break;
  }
  return out;
}

/**
 * The terms for one issue, in the order the packer is allowed to drop them (last first).
 * Returns { protectedTerms, optionalTerms } — the split IS the policy.
 */
export function termsForIssue(issue) {
  const seen = new Set();
  const uniq = (arr) => (arr || []).filter((t) => {
    const k = String(t).trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Exact phrases the reader wrote are protected too: they are the thing being asked about.
  const protectedTerms = uniq([...issue.protectedEntities, ...issue.exactUserPhrases]);
  const optionalTerms = uniq([...issue.coreTerms, ...issue.contextVars])
    .filter((t) => !t.split(/\s+/).every(isFiller));
  return { protectedTerms, optionalTerms };
}

// ── packing ──────────────────────────────────────────────────────────────────
/**
 * Pack `sites` into groups such that every assembled query is inside the INTERNAL bound.
 * Returns null when even ONE site will not fit alongside the protected terms — the caller must
 * then refuse or ask, never shorten past the protected set.
 */
function packSites(terms, sites, form) {
  if (form === 'single') {
    // One request per domain. Every one still has to fit, which for a single `site:` token it
    // will unless the protected terms alone are over the bound — and that is checked first.
    for (const s of sites) if (!withinInternalBounds(assembleQuery(terms, [s], 'single'))) return null;
    return sites.map((s) => [s]);
  }
  const groups = [];
  let current = [];
  for (const site of sites) {
    const candidate = current.concat(site);
    if (withinInternalBounds(assembleQuery(terms, candidate, form))) { current = candidate; continue; }
    if (current.length) groups.push(current);
    if (!withinInternalBounds(assembleQuery(terms, [site], form))) return null;
    current = [site];
  }
  if (current.length) groups.push(current);
  return groups;
}

export const MAX_GROUPS_PER_ISSUE = 3;

/**
 * PLAN THE BATCHES FOR ONE ISSUE.
 *
 * @returns {{
 *   ok:boolean, reason?:string, issueId:string, capability:string,
 *   terms:string[], droppedTerms:string[], form:string,
 *   batches:Array<{index:number, sites:string[], q:string, chars:number, words:number}>
 * }}
 *
 * `ok:false` is a REFUSAL of this issue, never a silently degraded search. Two shapes:
 *   * no_eligible_source        — nothing vetted may back this capability. Costs zero requests.
 *   * protected_terms_too_long  — the terms that may not be dropped do not fit. Ask, do not cut.
 */
export function planIssueBatches(issue, bandSites, opts = {}) {
  const form = FILTER_FORMS.includes(opts.form) ? opts.form : DEFAULT_FILTER_FORM;
  const capability = capabilityForIntent(issue.intent);
  const maxGroups = opts.maxGroups || MAX_GROUPS_PER_ISSUE;

  const sites = opts.onlySites
    ? eligibleSites(opts.onlySites.filter((d) => bandSites.includes(d)), capability)
    : eligibleSites(bandSites, capability);

  const base = {
    issueId: issue.issueId, capability, form,
    terms: [], droppedTerms: [], batches: [],
  };

  if (!sites.length) {
    return { ...base, ok: false, reason: 'no_eligible_source' };
  }

  const { protectedTerms, optionalTerms } = termsForIssue(issue);

  // THE FLOOR, CHECKED FIRST. Size the protected terms against the LONGEST domain, so a plan
  // that fits here fits in every group.
  const longest = sites.reduce((a, b) => (b.length > a.length ? b : a), sites[0]);
  if (!withinInternalBounds(assembleQuery(protectedTerms, [longest], form === 'single' ? 'single' : 'or'))) {
    return { ...base, ok: false, reason: 'protected_terms_too_long', terms: protectedTerms.slice() };
  }

  // Then add optional terms while everything still fits, and record what did not make it.
  let terms = protectedTerms.slice();
  const dropped = [];
  for (const t of optionalTerms) {
    const candidate = terms.concat(t);
    if (withinInternalBounds(assembleQuery(candidate, [longest], form === 'single' ? 'single' : 'or'))) {
      terms = candidate;
    } else {
      dropped.push(t);
    }
  }

  // Then the REQUEST budget: too many groups is too many round-trips, so optional terms give
  // ground until the plan fits. Protected terms never do.
  let groups = packSites(terms, sites, form);
  while (groups && groups.length > maxGroups && terms.length > protectedTerms.length) {
    dropped.push(terms.pop());
    groups = packSites(terms, sites, form);
  }
  if (!groups) return { ...base, ok: false, reason: 'protected_terms_too_long', terms: terms.slice() };

  const batches = groups.slice(0, maxGroups).map((g, i) => {
    const q = assembleQuery(terms, g, form);
    const m = measureQuery(q);
    return { index: i + 1, sites: g.slice(), q, chars: m.chars, words: m.words };
  });
  const covered = new Set(batches.flatMap((b) => b.sites));

  return {
    ...base,
    ok: true,
    terms: terms.slice(),
    droppedTerms: dropped.slice(),
    batches,
    // NOT A SILENT CAP. When maxGroups truncates the plan, the domains that fell off the end
    // are named so telemetry and the report can say what was not searched.
    uncoveredSites: sites.filter((d) => !covered.has(d)),
  };
}

/** Last check before the wire. Refusing costs one search; sending costs every question. */
export function isSendable(q) {
  return withinProviderBounds(q) && withinInternalBounds(q);
}

/** Exported for the boundary matrix: the exact numbers a test asserts against. */
export const BOUNDS = Object.freeze({
  INTERNAL_MAX_QUERY_CHARS, INTERNAL_MAX_QUERY_WORDS,
});
