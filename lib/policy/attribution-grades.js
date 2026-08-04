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
  return gradeWithinCap(grade, provenanceCap(ctx));
}

/**
 * The same question asked against a cap that has ALREADY been computed.
 *
 * Every issue carries its own `provenance_cap`, so the consumer that has one should compare
 * against it rather than re-deriving from era and adapter and risking a different answer. A grade
 * outside the cap is not a weaker claim — it is no attribution at all.
 */
export function gradeWithinCap(grade, cap) {
  if (cap === NO_GRADE || cap === undefined || cap === null) return false;
  if (!GRADES.includes(grade)) return false;
  if (!GRADES.includes(cap)) return false;
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

  // QUOTE VERIFICATION IS CHECKED FIRST, and the order is load-bearing. A grade-C summary
  // confirming a wording rarely LOOKS like attribution — «نعم، هذا لفظه» names nobody and matches
  // no speech pattern — so if the grade-C branch below ran first it would return false and a
  // fabricated quotation would acquire a confirmation from a source that cannot give one.
  if (relation === 'QUOTE_VERIFICATION') return !canConfirmQuote(grade);

  // ABOUT_ENTITY: a page about him never becomes his speech.
  if (relation === 'ABOUT_ENTITY') return DIRECT_SPEECH.test(t);

  // C: a summary may report a position; it may not report speech.
  if (grade === 'C') return DIRECT_SPEECH.test(t);

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

// ── THE REAL CLASSIFIER ──────────────────────────────────────────────────────
//
// WHAT THIS REPLACES. The first implementation decided the grade with
// `provenanceCap === 'NONE' ? 'NONE' : (owned ? 'A' : 'C')`. Three things were wrong with it and
// each is a different kind of wrong:
//
//   * GRADE B WAS UNREACHABLE. Nothing could ever be B, so the whole middle of the ladder — a
//     bounded verbatim quotation with a book and a locator, which is how the historical record
//     is actually transmitted — collapsed into "a summary" and lost its ability to confirm a
//     wording.
//   * A HOSTNAME BECAME AN ATTRIBUTION. `owned` was true whenever the page's domain had the
//     scholar as its registered owner. But an official site publishes more than its scholar's
//     answers: a research-department article on binbaz.org.sa is not Ibn Baz speaking, and
//     grading it A is precisely the misattribution the engine exists to prevent.
//   * THE CAP WAS NEVER ENFORCED, only reported. A grade-C claim under a cap of B was refused
//     by the sentence TEMPLATE if the sentence happened to look like speech, and admitted
//     otherwise.
//
// ── WHAT DECIDES A GRADE NOW ─────────────────────────────────────────────────
// Facts about the source row and the extracted span, never the model's prose:
//
//   A  the answer unit is HIS — a registered primary adapter, the row's owner is the requested
//      authority, AND the page's own attribution type says this unit is his answer.
//   B  a historical scholar, quoted verbatim inside quotation marks, with a named book AND a
//      checkable locator (juzʾ/page, an (n/m) pair, or bāb + number).
//   C  an eligible summary — historical record only.
//   NONE otherwise, and always for a contemporary with no readable corpus.

// A locator someone could actually go and check.
const LOCATOR_PATTERNS = [
  /\(\s*[\d٠-٩]{1,4}\s*\/\s*[\d٠-٩]{1,5}\s*\)/u,          // (22/41)
  /ج\s*[\d٠-٩]{1,3}[\s،,]*ص\s*[\d٠-٩]{1,5}/u,              // ج ٢ ص ٤١
  /جزء\s*[\d٠-٩]{1,3}[\s،,]*صفحة\s*[\d٠-٩]{1,5}/u,
  /(?:رقم|حديث|أثر)\s*[\d٠-٩]{1,6}/u,                       // باب … حديث 1234
  /ص\s*[\d٠-٩]{2,5}/u,
];

// A named work, rather than "some book somewhere".
const BOOK_MARKERS = /(?:مجموع الفتاوى|فتح الباري|صحيح البخاري|صحيح مسلم|سنن أبي داود|سنن الترمذي|سنن النسائي|سنن ابن ماجه|مسند أحمد|زاد المعاد|إعلام الموقعين|المغني|المجموع|بدائع الصنائع|الأم|الموطأ|الفتاوى الكبرى|درء التعارض|منهاج السنة|اقتضاء الصراط|كتاب\s+[؀-ۿ]{3,})/u;

// A bounded verbatim run — the thing a wording can be confirmed against.
const QUOTED_RUN = /[«"“']([^»"”']{8,400})[»"”']/u;

export function detectLocator(text) {
  const t = String(text || '');
  for (const re of LOCATOR_PATTERNS) {
    const m = t.match(re);
    if (m) return m[0];
  }
  return '';
}

export function detectBook(text) {
  const m = String(text || '').match(BOOK_MARKERS);
  return m ? m[0] : '';
}

export function detectQuotedRun(text) {
  const m = String(text || '').match(QUOTED_RUN);
  return m ? m[1].trim() : '';
}

/**
 * CLASSIFY ONE PIECE OF EVIDENCE.
 *
 * @param {object} arg
 *   source        {ownerId, adapterId, attributionType, author}  — the ledger's source row
 *   evidenceText  the text of the span(s) the claim rests on
 *   policy        {era, requestedAuthorityId, hasPrimaryAdapter?}
 * @returns {{grade:'A'|'B'|'C'|'NONE', reason:string, locator:string, book:string, quoted:string}}
 */
export function classifyProvenance({ source, evidenceText, policy } = {}) {
  const s = source || {};
  const p = policy || {};
  const text = String(evidenceText || '');
  const era = p.era || 'unknown';
  const wanted = p.requestedAuthorityId || null;

  const out = (grade, reason, extra = {}) => Object.freeze({
    grade, reason, locator: '', book: '', quoted: '', ...extra,
  });

  // Nothing is being attributed to anybody: there is no grade to award.
  if (!wanted) return out(NO_GRADE, 'no_authority_requested');

  const hasPrimaryAdapter = p.hasPrimaryAdapter !== undefined
    ? !!p.hasPrimaryAdapter
    : (s.ownerId === wanted && !!s.adapterId && s.adapterId !== 'readability' && s.adapterId !== 'none');

  // ── A ── HIS OWN ANSWER UNIT, through a corpus we are registered to read.
  //
  // The domain is necessary and NOT sufficient. `attributionType` is what the adapter established
  // about THIS page: an `answer`/`fatwa` unit is his, an `article` by the site's research desk is
  // not, however official the host.
  const ownerMatches = s.ownerId === wanted;
  const unitIsHis = s.attributionType === 'answer' || s.attributionType === 'fatwa';
  if (ownerMatches && hasPrimaryAdapter && unitIsHis) {
    return out('A', 'primary_answer_unit');
  }

  // ── B ── A BOUNDED VERBATIM QUOTATION WITH A CHECKABLE PLACE, historical only.
  //
  // Contemporary scholars are excluded on purpose: a quotation of a living or recently-departed
  // scholar in somebody else's book is still a report about him, and his office is the thing that
  // publishes and corrects his positions. The historical record has no such office, and the
  // quoting literature IS its transmission channel.
  const quoted = detectQuotedRun(text);
  const book = detectBook(text);
  const locator = detectLocator(text);
  if (era === 'historical' && quoted && book && locator) {
    return out('B', 'verbatim_with_locator', { quoted, book, locator });
  }

  // ── C ── AN ELIGIBLE SUMMARY, and ONLY for the historical record.
  if (era === 'historical') return out('C', 'eligible_summary', { quoted, book, locator });

  // A contemporary who is not readable through his own corpus is not attributable at all. This is
  // the line that stops «قال الشيخ» arriving from a third-party page.
  return out(NO_GRADE, era === 'contemporary' ? 'contemporary_without_primary' : 'unknown_era');
}

/**
 * MAY THIS GRADE CONFIRM THAT THESE EXACT WORDS WERE SAID?
 *
 * Two conditions, and both are required. The GRADE must be one that can carry a wording at all,
 * and the wording must actually appear in the evidence — a grade-B page that quotes a different
 * sentence of his confirms nothing about this one. `canConfirmQuote` answers only the first.
 */
export function quoteConfirmable({ grade, quotedText, evidenceText } = {}) {
  if (!canConfirmQuote(grade)) return false;
  const needle = fold(String(quotedText || '')).replace(/\s+/g, ' ').trim();
  if (!needle) return false;
  return fold(String(evidenceText || '')).replace(/\s+/g, ' ').includes(needle);
}
