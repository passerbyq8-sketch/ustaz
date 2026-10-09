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

// ── THE HYBRID: the writer from the sources only (MOJAZ_SCOPE=bw2) ───────────────────────────────
// The before-writing path holds the writer's units until it has finished, then asks this file whether
// what would be released is an answer. Pure, like the rest of this file.

/**
 * The lowest prose length (characters, markup / source cards / citation marks / blank runs out) a held answer may have
 * and still be released. CALIBRATED on the 2026-10-09 (b) battery: the highest value at which all fourteen sound
 * before-writing answers without a stored fatwa pass and question 23 (the truncated one) fails -- the table is in
 * EZIK-HAIKU55-HYBRID-REPORT-2026-10-09.md.
 */
export const BW2_MIN_PROSE_CHARS = 317;

const CARD_TAG_RE = /<(verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship|book)\b[\s\S]*?(?:<\/\1\s*>|\/>)/giu;
const CARD_OPEN_RE = /<(?:source|book)\b/giu;
const FATWA_BLOCK_RE = /(?:^|\n)##\s*نص الفتوى/u;

/** Characters of prose: card markup, other tags, citation marks and extra whitespace taken out. */
export function proseLength(text) {
  return String(text == null ? '' : text)
    .replace(CARD_TAG_RE, ' ')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\[\[\s*\d+\s*\]\]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim().length;
}

/** Source cards (`<source …>` / `<book …>`) a text carries. */
export function sourceCardCount(text) {
  return (String(text == null ? '' : text).match(CARD_OPEN_RE) || []).length;
}

/** True when the text carries the stored fatwa's own block. */
export function hasFatwaBlock(text) {
  return FATWA_BLOCK_RE.test(String(text == null ? '' : text));
}

/**
 * Why the before-writing writer's held answer is not released as it stands, or ''.
 * @param {object} o
 * @param {string} o.text          what the releaser would let go (the writer's units, cards included)
 * @param {number} o.released      units it would release
 * @param {number} o.guardDropped  sentences the guard took out of the writer's text
 * @param {boolean} o.hasBlock     the stored fatwa already stands above the writer
 * @param {boolean} o.markerSeen   the writer said "no source covers this": the not-covered path owns that, not this file
 * @param {number} [o.minProse]
 */
export function bw2HoldReason({ text, released = 0, guardDropped = 0, hasBlock = false, markerSeen = false, minProse = BW2_MIN_PROSE_CHARS } = {}) {
  if (markerSeen) return '';
  if (released === 0) return guardDropped > 0 ? 'no_content_after_guard' : '';
  if (isFallbackReply(text)) return 'fallback_reply';
  if (hasBlock) return '';
  if (sourceCardCount(text) === 0 && !hasFatwaBlock(text)) return 'no_source_card';
  if (proseLength(text) < minProse) return 'short_prose';
  return '';
}
