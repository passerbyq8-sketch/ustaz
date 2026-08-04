// lib/policy/attribution-grades.js
// HOW STRONGLY IS THIS ATTRIBUTED, AND WHAT SENTENCE IS THAT STRENGTH ALLOWED TO WRITE?
//
// ── THREE GRADES, AND THEY ARE NOT DEGREES OF CONFIDENCE ─────────────────────
//   A  primary or direct, or a qualified text, WITH a locator      -> «قال العالم في...»
//   B  an exact quotation, with book and locator, bounded          -> «نُقل عنه في...»
//   C  a summary in an eligible source                             -> «ذكر المصدر كذا أن رأيه...»
//
// The grade is a fact about the EVIDENCE, not a feeling about the claim. And each grade owns one
// sentence shape, because the whole misattribution class this engine exists to prevent is a
// grade-C fact wearing a grade-A sentence: a third-party summary saying "he permits it" becomes
// «قال الشيخ فلان: يجوز», and the reader has no way to see the difference.
//
// ── THE CONTEMPORARY RULE, AND WHY IT IS ABSOLUTE ────────────────────────────
// A contemporary scholar with no registered primary corpus caps at NONE. Not C — NONE. A living
// or recently-departed scholar's position is a thing his office publishes and corrects; a summary
// of it on somebody else's site is a report about him, and reporting it as his word is how a man
// gets a fatwa attributed to him that he never issued. Grade C exists for the historical record,
// where the summarising literature IS the transmission channel and has been for centuries.
//
// WHAT THIS DOES NOT DO. It never blocks the SEARCH. RFC v0.5-R2 §6 is explicit: the search runs,
// a primary source may still be found, and only the ATTRIBUTION is capped. The failure this
// replaces refused the whole question before a provider call because of a name.

import { fold } from './entities.js';
import { POLICY_VERSION } from './version.js';

export { POLICY_VERSION };

export const GRADES = Object.freeze(['A', 'B', 'C']);
export const NO_GRADE = 'NONE';

/**
 * THE WEAKEST GRADE THIS ENTITY MAY BE ATTRIBUTED AT.
 *
 * @returns 'A'|'B'|'C'|'NONE'
 *   'NONE' — nothing may be attributed to him at all.
 *   'B'    — a contemporary with a registered corpus: A and B are readable, C is not.
 *   'C'    — the historical record, where an eligible summary is a legitimate channel.
 */
export function provenanceCap({ era, hasPrimaryAdapter } = {}) {
  if (era === 'contemporary') return hasPrimaryAdapter ? 'B' : NO_GRADE;
  if (era === 'historical') return 'C';
  // An entity whose era nobody declared is not a licence to attribute. Unknown is not historical.
  return hasPrimaryAdapter ? 'B' : NO_GRADE;
}

const RANK = Object.freeze({ A: 3, B: 2, C: 1 });

/** May a claim at `grade` be attributed to an entity with this era/adapter situation? */
export function gradeAllowed(grade, ctx = {}) {
  const cap = provenanceCap(ctx);
  if (cap === NO_GRADE) return false;
  if (!GRADES.includes(grade)) return false;
  return RANK[grade] >= RANK[cap];
}

/**
 * MAY THIS GRADE CONFIRM THAT THESE EXACT WORDS WERE SAID?
 *
 * A summary can establish that a man held a view and still not establish that he phrased it this
 * way. Confirming a wording from a summary is how a fabricated quotation acquires a citation.
 */
export function canConfirmQuote(grade) {
  return grade === 'A' || grade === 'B';
}

// ── the sentence shapes ──────────────────────────────────────────────────────
const TEMPLATES = Object.freeze({
  BY_ENTITY: Object.freeze({
    A: 'قال العالم في...',
    B: 'نُقل عنه في...',
    C: 'ذكر المصدر كذا أن رأيه...',
  }),
  // A CLAIM ABOUT A MAN IS NOT A CLAIM BY HIM, at any grade. Even a grade-A page about him
  // establishes what the PAGE says about him, never what he said.
  ABOUT_ENTITY: Object.freeze({
    A: 'ذكر المصدر عن العالم...',
    B: 'ذكر المصدر عن العالم...',
    C: 'ذكر المصدر عن العالم...',
  }),
  QUOTE_VERIFICATION: Object.freeze({
    A: 'ثبت هذا اللفظ عنه في...',
    B: 'ورد هذا اللفظ منقولًا عنه في...',
    C: null,                                   // a summary may not confirm a wording
  }),
  BY_MADHHAB: Object.freeze({
    A: 'المشهور في المذهب...',
    B: 'نُقل عن المذهب...',
    C: 'ذكر المصدر أن المذهب...',
  }),
});

/** The one sentence shape this relation and grade may take, or null when none may. */
export function sentenceTemplate(relation, grade) {
  if (grade === NO_GRADE) return null;
  const row = TEMPLATES[relation];
  if (!row) return null;
  return row[grade] || null;
}

// ── the violation check ──────────────────────────────────────────────────────
//
// WHAT COUNTS AS ATTRIBUTING. A verb of holding/saying/choosing, aimed at a PERSON — an honorific,
// or «العالم». Deliberately not «أهل العلم» or «العلماء»: «لا يجوز عند أهل العلم» is a statement
// about the scholarly consensus of a source, names nobody, and attributing nothing to anybody is
// exactly what it does.
const ATTRIBUTING = new RegExp(
  '(?:قال|يقول|ذكر|افتي|رجح|اختار|يري|راي|ذهب|نص|قرر|صرح|اجاز|منع)\\s*'
  + '(?:الشيخ|الشيخ|العلامه|الامام|الدكتور|الفقيه|المفتي|العالم|شيخ)',
  'u',
);
// The grade-A shape specifically: his own speech, reported directly.
const DIRECT_SPEECH = new RegExp(
  '(?:قال|يقول|صرح|نص)\\s*(?:الشيخ|العلامه|الامام|الدكتور|العالم|شيخ)',
  'u',
);

/**
 * Does this sentence claim more than its evidence allows?
 *
 * @param {string} text     the drafted sentence
 * @param {{relation:string, grade:string}} ctx
 * @returns {boolean} true when the sentence must be dropped
 */
export function violatesTemplate(text, { relation, grade } = {}) {
  const t = fold(text);
  if (!t) return false;
  const attributes = ATTRIBUTING.test(t);

  // NONE: nothing may be attributed, in any wording.
  if (grade === NO_GRADE || !GRADES.includes(grade)) return attributes;

  // ABOUT_ENTITY: a page about him never becomes his speech.
  if (relation === 'ABOUT_ENTITY') return DIRECT_SPEECH.test(t);

  // C: a summary may report a position; it may not report speech.
  if (grade === 'C') return DIRECT_SPEECH.test(t);

  // QUOTE_VERIFICATION at C is already null-templated; catch a confirmation anyway.
  if (relation === 'QUOTE_VERIFICATION' && !canConfirmQuote(grade)) return true;

  return false;
}

/**
 * The grade a piece of evidence earns, from facts about the page rather than from its prose.
 *
 * @param {{ownedByEntity:boolean, hasLocator:boolean, exactQuotation:boolean, eligible:boolean}} ev
 */
export function gradeFor(ev = {}) {
  if (!ev.eligible) return NO_GRADE;
  if (ev.ownedByEntity && ev.hasLocator) return 'A';
  if (ev.exactQuotation && ev.hasLocator) return 'B';
  return 'C';
}
