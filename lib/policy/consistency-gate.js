// lib/policy/consistency-gate.js
// ONE ANSWER UNIT MAY NOT BOTH CREDIT A MAN AND DISCLAIM HAVING FOUND HIM.
//
// ── THE FAILURE THIS EXISTS TO MAKE IMPOSSIBLE, MEASURED ON THE LIVE SERVICE ─
// «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟» was answered with: his position
// stated as fact, a quotation attributed to مجموع الفتاوى, the majority view, his view called
// weak, a recommendation to make up the prayer — and then, in the same reply:
//
//   «لم أقف على نصٍّ مباشرٍ للشيخ ابن تيميه»
//
// Both halves cannot be true. Either the text was found, in which case the disclaimer is false,
// or it was not, in which case the quotation and the attribution are unsupported. The reader has
// no way to tell which half to believe, and the half that reads as authoritative is the wrong one.
//
// ── WHY A PROMPT INSTRUCTION WAS NOT ENOUGH ─────────────────────────────────
// api/ask.js already TELLS the model, in as many words, not to attribute anything to him when his
// text was not found. The model attributed anyway. An instruction is a request; this is a gate.
//
// ── AND WHY A NEGATION NEEDS PROOF OF SEARCH ────────────────────────────────
// A historical scholar has no official domain and no adapter, so the attributed route never ran a
// search for him at all — and then said «لم أقف على نصٍّ مباشرٍ له». That is a claim about work
// that was never done. «I did not find» and «I did not look» are different statements, and only
// the first one may be made after actually looking.
//
// THIS MODULE DECIDES NOTHING ABOUT RELIGION. It reads a draft and reports which of these
// invariants it broke. What to do about that is the caller's, and in api/ask.js it is to drop the
// draft whole rather than edit it down.

import { fold, ROSTER } from './entities.js';

/** A positive attribution of speech: «قال فلان», «يقول الشيخ», «صرّح ابن تيمية». */
const SPEECH_VERBS = 'قال|يقول|صرح|نص|قرر|كتب|روي عنه';
/** A positive attribution of a POSITION, which is weaker than speech and still an attribution. */
const POSITION_VERBS = 'يري|راي|ذهب|اختار|رجح|افتي|يفتي|مذهب|اجاز|منع|حرم|اوجب';

const TITLES = 'الشيخ|العلامه|الامام|الدكتور|الفقيه|المفتي|العالم|شيخ الاسلام|شيخ';

/** Every registered person, longest form first so a longer name is not eaten by a shorter one. */
function entityNameAlternation(extraNames = []) {
  const names = [...new Set([
    ...ROSTER.filter((e) => e.targetType === 'person').flatMap((e) => [...e.aliases, fold(e.display)]),
    ...extraNames.map((n) => fold(n)),
  ].filter(Boolean))].sort((a, b) => b.length - a.length);
  return names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

export const PROBLEM = Object.freeze({
  /** Speech credited to the entity while his text was not verified. */
  SPEECH_WITHOUT_EVIDENCE: 'SPEECH_WITHOUT_EVIDENCE',
  /** A position credited to the entity while his text was not verified. */
  POSITION_WITHOUT_EVIDENCE: 'POSITION_WITHOUT_EVIDENCE',
  /** A direct quotation in a sentence that names him, at a grade that cannot carry one. */
  QUOTE_WITHOUT_EVIDENCE: 'QUOTE_WITHOUT_EVIDENCE',
  /** «لم أقف» when no search was ever run for that slot. */
  NEGATION_WITHOUT_SEARCH: 'NEGATION_WITHOUT_SEARCH',
});

/** Arabic quotation marks and the ASCII pair a normal keyboard produces. */
const QUOTED = /[«"']([^«»"']{12,})[»"']/u;

/**
 * WHAT THIS DRAFT CLAIMS THAT ITS EVIDENCE DOES NOT SUPPORT.
 *
 * @param {string} text          the drafted reply, before the reader sees any of it
 * @param {object} ctx
 *   entity            string — the surface the reader named, added to the roster alternation
 *   notDirectlyVerified boolean — no text OF HIS was verified for THIS issue
 *   searchProven      boolean — a search actually ran for his own corpus
 *   allowSourcedPosition boolean — a grade-C transmission («ذكر المصدر أن رأيه…») is permitted
 * @returns {string[]} problem codes; empty means the draft may be sent
 */
export function consistencyProblems(text, ctx = {}) {
  const t = fold(text || '');
  if (!t) return [];
  const problems = [];
  const names = entityNameAlternation(ctx.entity ? [ctx.entity] : []);
  const who = '(?:' + TITLES + (names ? '|' + names : '') + ')';

  if (ctx.notDirectlyVerified) {
    // SPEECH is never allowed without a verified text of his — not even as a sourced transmission,
    // because «ذكر المصدر أن ابن تيمية قال» still asserts a wording nobody verified.
    // BOTH WORD ORDERS. Arabic puts the subject before the verb too — «ابن تيمية قال» is the same
    // claim as «قال ابن تيمية», and a checker that only knows one of them is a checker the model
    // walks straight past. lib/policy/entities.js records the same lesson for its own frames.
    if (new RegExp('(?:' + SPEECH_VERBS + ')\\s*' + who, 'u').test(t)
      || new RegExp(who + '\\s*(?:' + SPEECH_VERBS + ')', 'u').test(t)) {
      problems.push(PROBLEM.SPEECH_WITHOUT_EVIDENCE);
    }
    // A POSITION may be transmitted at grade C — «ذكر موقع إسلام ويب أن ابن تيمية يرى…» — but only
    // when the caller says a sourced transmission is on the table AND the sentence actually names
    // the source it is transmitting from. A bare «يرى ابن تيمية» is the app's own assertion.
    //
    // WHEN THE CALLER SUPPLIES THE PUBLISHERS IT ACTUALLY FETCHED, naming one of them is required
    // rather than merely encouraged: «ذكر بعض المواقع» is a transmission frame with nobody in it,
    // and a reader cannot check a source that was never named. This is what lets an encyclopedic
    // search REPORT a historical scholar's position instead of refusing to say anything about him
    // — which was the whole complaint: the app apologised where a documented transmission existed.
    const positional = new RegExp('(?:' + POSITION_VERBS + ')\\s*' + who, 'u').test(t)
      || new RegExp(who + '\\s*(?:' + POSITION_VERBS + ')', 'u').test(t);
    const transmitted = ctx.allowSourcedPosition && hasTransmissionFrame(t) && namesAPublisher(t, ctx);
    if (positional && !transmitted) {
      problems.push(PROBLEM.POSITION_WITHOUT_EVIDENCE);
    }
    // A QUOTATION is the strongest claim of all and needs a verified span. Only flagged when the
    // draft also names him, so quoting a Qur'anic verse or a hadith is untouched.
    if (QUOTED.test(t) && (names ? new RegExp(names, 'u').test(t) : false)) {
      problems.push(PROBLEM.QUOTE_WITHOUT_EVIDENCE);
    }
  }

  // «لم أقف» / «لم أجد» is a statement about work that was done. Without a search it is false.
  if (!ctx.searchProven && /لم اقف|لم اجد|لم اعثر|لا يوجد نص/u.test(t)) {
    problems.push(PROBLEM.NEGATION_WITHOUT_SEARCH);
  }
  return problems;
}

/** Does the sentence credit a SOURCE with the transmission, rather than asserting it outright? */
function hasTransmissionFrame(foldedText) {
  return /ذكر|نقل|ينقل|اورد|حكي|جاء في|ورد في|بحسب|وفق|افاد|وثق|منشور/u.test(foldedText);
}

/**
 * Is the intermediate source NAMED, so the reader can go and check it?
 *
 * When the caller passes no publisher list there is nothing to check against and a transmission
 * frame alone has to do. When it passes the publishers it actually fetched, one of them must
 * appear: a frame with no name in it — «ذكر بعض المواقع» — cites nothing.
 */
function namesAPublisher(foldedText, ctx) {
  const list = (ctx.transmissionPublishers || []).map((p) => fold(String(p || ''))).filter(Boolean);
  if (!list.length) return true;
  return list.some((p) => foldedText.includes(p));
}

/**
 * THE REPLACEMENT WHEN THE DRAFT IS DROPPED.
 *
 * It states exactly what is and is not available, makes no religious claim, and does NOT say we
 * found nothing of his — because in this branch nothing of his was searched.
 */
// IT MAKES NO CLAIM ABOUT WHAT EXISTS. It says what this reply may not do, which is a fact about
// us. Saying «لم أقف على نصٍّ له» here would be the very negation-without-search this module
// refuses, and a replacement that breaks the rule it enforces is not a replacement.
export const NO_ATTRIBUTION_AVAILABLE =
  'لا أنسبُ إلى هذا العالِم قولًا في هذه المسألة ما لم أتحقّقْ من نصٍّ له فيها، ولم يتحقّقْ لي ذلك في هذا الجواب. '
  + 'وأستطيع أن أعرض لك حكمَ المسألة نفسِها من مصادرها الموثَّقة، أو أنقلَ ما تذكره المصادرُ عن رأيه منسوبًا إليها لا إليه — فاختر ما تريد.';

/** The wording when the ceiling, not the evidence, is what stopped the search. */
export const SEARCH_NOT_COMPLETED =
  'تعذّر استكمالُ البحث ضمن الحدود التشغيلية لخدمة عزك، فلم أستوفِ هذه المسألة بحثًا. '
  + 'أعِدْ سؤالي عنها لاحقًا.';
