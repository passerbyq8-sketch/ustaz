// THE FULL-FATWA ANSWER CONTRACT.
//
// A published fatwa is an argument, not a sentence. The answer path may let a model
// summarise that argument and identify the spans it relied on, but the model never
// reproduces, shortens, or rewrites the published text. The server carries a complete
// question/answer record and owns the reader-visible text block.

import { createHash } from 'node:crypto';
import { displayPolicyFor } from './source-registry.js';

// Technical normalisation only. Arabic letters, hamzas, marks, and word order remain
// untouched: a paraphrase must not pass as an exact source span.
export function normalizeForCompare(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

// A NUL separates question from answer so moving their boundary cannot preserve the hash.
// The escape is textual in this source file; keeping literal control bytes out of source also
// keeps ordinary diff/review tools able to inspect this security-sensitive module.
export function fullTextHash(question, answer) {
  return createHash('sha256')
    .update(normalizeForCompare(question), 'utf8')
    .update('\u0000', 'utf8')
    .update(normalizeForCompare(answer), 'utf8')
    .digest('hex');
}

// Structural cleanup only. Paragraph boundaries survive and there is deliberately no
// length argument: this function has no way to truncate a fatwa.
export function cleanStructural(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/<\/?source\b[^>]*>/giu, ' ')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

// Every completeness field is derived here. A caller may report upstream omission, but it
// cannot declare a partial pair complete.
export function buildFatwaRecord(input = {}) {
  const question = cleanStructural(input.question);
  const answer = cleanStructural(input.answer);
  const sourceKind = input.sourceKind === 'corpus' ? 'corpus' : 'live';
  const omittedChars = Math.max(0, Number(input.omittedChars) || 0);
  const truncated = omittedChars > 0 || input.truncated === true;
  const supportText = [question, answer].filter(Boolean).join('\n\n');
  return Object.freeze({
    id: String(input.id || ''),
    kind: input.kind || (sourceKind === 'corpus' ? 'fatwa_service' : 'live_page'),
    sourceKind,
    title: cleanStructural(input.title),
    url: String(input.url || ''),
    publisher: cleanStructural(input.publisher),
    authorityId: String(input.authorityId || ''),
    scholarId: String(input.scholarId || ''),
    directAttribution: !!input.directAttribution,
    contentMode: input.contentMode || 'written_fatwa',
    actualContentType: String(input.actualContentType || input.contentMode || 'written_fatwa'),
    question,
    answer,
    questionChars: question.length,
    answerChars: answer.length,
    fullTextHash: fullTextHash(question, answer),
    fullTextComplete: !!(question && answer) && !truncated,
    truncated,
    omittedChars,
    displayPolicy: displayPolicyFor(sourceKind, input.url),
    score: Number(input.score) || 0,
    supportText,
    passage: [
      question ? 'السؤال المنشور: ' + question : '',
      answer ? 'النص المنشور: ' + answer : '',
    ].filter(Boolean).join('\n\n'),
    localEntry: input.localEntry || null,
    liveSource: input.liveSource || null,
    raw: input.raw || null,
  });
}

// Only a complete written question/answer pair is eligible for the server-owned fatwa block.
// An automatic video transcript can remain ordinary evidence, but it is not relabelled as a
// written fatwa and never receives the heading «نص الفتوى».
export function recordUsableAsFatwa(record) {
  return !!(record
    && record.contentMode === 'written_fatwa'
    && record.fullTextComplete
    && !record.truncated
    && record.omittedChars === 0
    && record.question
    && record.answer);
}

// A span earns display by being present in the exact carried record.
export function findSpan(record, span) {
  const needle = normalizeForCompare(span);
  if (!needle || needle.length < 12) return -1;
  return normalizeForCompare(record && record.supportText || '').indexOf(needle);
}

export function verifySpan(record, span) {
  return findSpan(record, span) >= 0;
}

// Keep verified spans once and in source order. The returned drop count lets the caller
// re-derive a summary instead of quietly displaying a summary whose evidence disappeared.
export function orderedVerifiedSpans(record, spans) {
  const seen = new Set();
  const kept = [];
  let dropped = 0;
  for (const raw of Array.isArray(spans) ? spans : []) {
    const at = findSpan(record, raw);
    if (at < 0) {
      dropped++;
      continue;
    }
    const span = normalizeForCompare(raw);
    if (seen.has(span) || kept.some((item) => item.span.includes(span))) continue;
    seen.add(span);
    kept.push({ at, span });
  }
  const merged = kept.filter((item) =>
    !kept.some((other) => other !== item && other.span.includes(item.span)));
  merged.sort((a, b) => a.at - b.at);
  return { spans: merged.map((item) => item.span), dropped };
}

export const HEADING_SUMMARY = 'خلاصة الحكم';
export const HEADING_TEXT = 'نص الفتوى';
export const HEADING_SOURCE = 'المصدر';
export const READ_FULL_AT_SOURCE = 'اقرأ الفتوى كاملة في المصدر';

// Deterministic and copied from the record. There is no maximum-length parameter.
// Young readers receive no published-text block under either display policy.
export function serverOwnedBlock(record, spans = [], options = {}) {
  if (options.band === 'young' || !recordUsableAsFatwa(record)) return '';
  const lines = ['## ' + HEADING_TEXT, ''];
  if (record.displayPolicy === 'full') {
    lines.push('السؤال:', record.question, '', 'الجواب:', record.answer);
    return lines.join('\n');
  }
  const verified = orderedVerifiedSpans(record, spans).spans;
  if (!verified.length || !record.url) return '';
  for (const span of verified) lines.push('«' + span + '»', '');
  lines.push(READ_FULL_AT_SOURCE + ': ' + record.url);
  return lines.join('\n').replace(/\n{3,}/gu, '\n\n');
}

// Majority/tarjih vocabulary is evidence-sensitive. A model may report these claims only
// when a carrying source sentence says them.
export const MAJORITY_MARKERS = Object.freeze([
  'قول الجمهور', 'الجمهور', 'جمهور العلماء', 'جمهور أهل العلم',
  'أكثر أهل العلم', 'عامة أهل العلم', 'القول الراجح', 'الراجح',
  'الصحيح', 'الأقرب', 'المشهور', 'الإجماع', 'اتفق العلماء',
]);

export const KHILAF_MARKERS = Object.freeze([
  'قولان', 'اختلف', 'خلاف', 'ذهب الجمهور', 'وذهب', 'وقيل', 'والراجح',
  'والصحيح', 'أكثر أهل العلم', 'عامة أهل العلم', 'مذاهب', 'القول الثاني',
  'القول الأول', 'وذهب آخرون', 'على قولين',
]);

export function sentencesOf(value) {
  return String(value == null ? '' : value)
    .split(/(?<=[.!؟?؛])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function hasMajorityMarker(value) {
  const text = normalizeForCompare(value);
  return MAJORITY_MARKERS.some((marker) => text.includes(normalizeForCompare(marker)));
}

export function hasKhilafMarker(value) {
  return khilafMarkersIn(value).length > 0;
}

export function khilafMarkersIn(value) {
  const text = normalizeForCompare(value);
  return KHILAF_MARKERS
    .filter((marker) => text.includes(normalizeForCompare(marker)))
    .filter((marker, index, all) => all.indexOf(marker) === index);
}

// A source with two or more explicit disagreement markers requires two in the summary;
// a source with one requires one. This prevents a first-span fallback from erasing a
// documented second view while avoiding invented disagreement where none was published.
export function khilafCoverageRequired(records) {
  let found = 0;
  for (const record of Array.isArray(records) ? records : []) {
    if (!recordUsableAsFatwa(record)) continue;
    found = Math.max(found, khilafMarkersIn(record.answer).length);
  }
  return Math.min(2, found);
}

export function summaryCoversKhilaf(summary, records) {
  const required = khilafCoverageRequired(records);
  return required === 0 || khilafMarkersIn(summary).length >= required;
}

function wordsOf(value) {
  return normalizeForCompare(value)
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean);
}

// Return every unsupported majority/tarjih sentence. The caller may regenerate once, then
// must drop the whole summary rather than surgically delete the unsafe sentence.
export function unsupportedMajorityClaims(summary, records) {
  const cited = (Array.isArray(records) ? records : []).filter(recordUsableAsFatwa);
  const markerWords = new Set(MAJORITY_MARKERS.flatMap(wordsOf));
  const offending = [];
  for (const sentence of sentencesOf(summary)) {
    if (!hasMajorityMarker(sentence)) continue;
    const folded = normalizeForCompare(sentence);
    const markers = MAJORITY_MARKERS
      .filter((marker) => folded.includes(normalizeForCompare(marker)))
      .map(normalizeForCompare);
    const words = wordsOf(sentence).filter((word) => word.length >= 4 && !markerWords.has(word));
    const carried = cited.some((record) => {
      const source = sentencesOf(record.supportText);
      return source.some((current, at) => {
        if (!markers.some((marker) => normalizeForCompare(current).includes(marker))) return false;
        // THE WINDOW IS ±2 SENTENCES, AND THE WIDTH WAS MEASURED RATHER THAN GUESSED. A fatwa
        // argues across several sentences: 220120 names the jewellery, attributes the
        // prohibition to the jumhūr, then quotes al-Ikhtiyārāt permitting «بيع المصوغ» — three
        // sentences that are one thought. At ±1 a faithful summary of exactly that thought
        // scored 3/8 = 0.375 against the 0.4 floor and was rejected as unsupported, which would
        // have discarded a TRUE summary and rebuilt it for nothing. Widening restores the
        // sentences the muftī actually reasoned across.
        //
        // This cannot admit a forgery: a claim whose marker appears NOWHERE in the record fails
        // the marker test above, before any width or threshold is consulted.
        const context = normalizeForCompare(source.slice(Math.max(0, at - 2), at + 3).join(' '));
        if (!words.length) return true;
        const ratio = (text) => (text
          ? words.filter((word) => text.includes(word)).length / words.length
          : 0);
        // A REPORTED VIEW IS NOT AN ENDORSED ONE (§7). «قيل إنه يجوز … والصحيح خلافه» contains
        // both the rejected opinion and a tarjīḥ marker, so plain word overlap would happily
        // certify a summary that asserts the REJECTED side as «الصحيح» — the source's own words
        // used to prove the reverse of what it decided. Split the window at the rebuttal: what
        // precedes it is the view being knocked down, what follows is the one being affirmed.
        // If the claim resembles the rebutted side MORE than the affirmed side, this window does
        // not support it, whatever marker it happens to contain.
        const rebuttal = /خلافه|خلاف\s+ذلك|مردود|وهو\s+ضعيف|وهذا\s+ضعيف|والصواب\s+خلاف|لا\s+يصح\s+هذا/u
          .exec(context);
        if (rebuttal) {
          const rebutted = context.slice(0, rebuttal.index);
          const affirmed = context.slice(rebuttal.index + rebuttal[0].length);
          if (ratio(rebutted) > ratio(affirmed)) return false;
        }
        return ratio(context) >= 0.4;
      });
    });
    if (!carried) offending.push(sentence);
  }
  return offending;
}

export function tarjihIsAttributed(sentence) {
  const text = normalizeForCompare(sentence);
  return /(?:عند|قال|يرى|اختيار|مذهب)\s+(?:ال)?شيخ|عند\s+\S+/u.test(text);
}

export const __fullFatwaTest = Object.freeze({
  normalizeForCompare,
  fullTextHash,
  cleanStructural,
  buildFatwaRecord,
  recordUsableAsFatwa,
  findSpan,
  verifySpan,
  orderedVerifiedSpans,
  serverOwnedBlock,
  sentencesOf,
  hasMajorityMarker,
  hasKhilafMarker,
  khilafMarkersIn,
  khilafCoverageRequired,
  summaryCoversKhilaf,
  unsupportedMajorityClaims,
  tarjihIsAttributed,
});
