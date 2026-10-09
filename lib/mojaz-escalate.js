// lib/mojaz-escalate.js — WHEN A BRIEF TURN IS WRITTEN AGAIN ON THE STRONGER MODEL (MOJAZ_ESCALATE_V1).
//
// Pure: it decides, it does not call anything. api/ask.js and lib/before-writing-v2.js hold the
// calls and the one rule that comes before this file's: a turn that has already let any of its
// text go to the reader is not escalated, it is logged `[mojaz/escalate-skipped] { reason }`.
//
// Three reasons, no others:
//   no_content_after_guard   the guard dropped sentences and not one sentence of content is left.
//   fallback_reply           the answer IS the system's own last-resort sentence — one of the two
//                            constants lib/output-reviewer.js writes when nothing reliable survived
//                            (copied here, and guards/mojaz-guards-unit.cjs reads that file to
//                            prove the copy is still the same text).
//   deen_no_source           a DEEN-route answer that cites no source and carries no card.
//
// A turn is escalated at most once, and the stronger model's answer is delivered as it comes, under
// the same instructions and the same guard.

export const FALLBACK_REPLIES = Object.freeze([
  'لم يصلني نصٌّ ولا فهمٌ يمكن الاعتماد عليه في هذه الدورة.',
  'لم يصلني مصدرٌ مؤرّخ يمكن أن يثبت هذه المعلومة المتغيّرة في هذه الدورة.',
]);

const DIACRITICS_RE = /[ً-ٰٟـۖ-ۭ]/gu;
const fold = (text) => String(text == null ? '' : text)
  .replace(/<(verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship|book)\b[\s\S]*?(?:<\/\1\s*>|\/>)/giu, ' ')
  .replace(/<[^>]*>/gu, ' ')
  .replace(DIACRITICS_RE, '')
  .replace(/[أإآٱ]/gu, 'ا')
  .replace(/ى/gu, 'ي')
  .replace(/ة/gu, 'ه')
  .replace(/[\s.،,]+/gu, ' ')
  .trim();

const FOLDED_FALLBACKS = FALLBACK_REPLIES.map(fold);

/** True when the text is nothing but the system's last-resort sentence (cards and spacing aside). */
export function isFallbackReply(text) {
  const folded = fold(text);
  return folded !== '' && FOLDED_FALLBACKS.some((reply) => folded === reply);
}

/**
 * @param {object} o
 * @param {string} o.text            the answer as it stands (guarded)
 * @param {string} o.route           'DEEN' | 'GEN' | …
 * @param {number} o.citedCount      rows the answer cites
 * @param {number} o.cardCount       source cards it carries
 * @param {number} o.guardRemoved    sentences the guard dropped from it
 * @param {boolean} o.contentLeft    a sentence of content remains
 * @returns {string} the reason, or '' for no escalation
 */
export function escalationReason({ text, route, citedCount = 0, cardCount = 0, guardRemoved = 0, contentLeft = true } = {}) {
  if (guardRemoved > 0 && !contentLeft) return 'no_content_after_guard';
  if (isFallbackReply(text)) return 'fallback_reply';
  if (route === 'DEEN' && !(citedCount > 0) && !(cardCount > 0)) return 'deen_no_source';
  return '';
}
