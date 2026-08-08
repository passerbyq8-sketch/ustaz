// lib/transfer/trim.js — MOVING A PUBLISHED ANSWER WITHOUT DAMAGING IT.
//
// ── THE MODEL IS NOT ON THIS PATH (قرار ١) ───────────────────────────────────
// Everything here is structural: fixed opening formulas, paragraph boundaries, and the offsets of
// quoted blocks. No model is asked to shorten anything, because a model asked to shorten a fatwa
// rewrites it, and a rewritten fatwa published under a scholar's name is the defect transfer mode
// exists to remove — reintroduced at the last step.
//
// ── AND NOTHING IS EVER CUT INSIDE A QUOTATION ───────────────────────────────
// An āyah cut in half is a misquotation of the Qur'an. A hadith cut in half can invert its
// meaning — «لا صلاة لمن لم يقرأ بفاتحة الكتاب» truncated after «لا صلاة» says something nobody
// said. So a quoted block is carried WHOLE or dropped WHOLE; there is no third option, and the
// boundary test runs before any length arithmetic.

import { containsFrozenRun } from '../frozen-text.js';

/** Appended when anything was removed for length. The reader is always told. */
export const TRUNCATION_TAIL = 'التتمةُ في المصدر';
/** Stands where the middle used to be. */
export const ELISION_MARK = '[… تفصيلُ الأدلةِ في المصدر …]';

// ── THE OPENING FORMULAS ─────────────────────────────────────────────────────
//
// A CLOSED LIST, NOT A HEURISTIC. قرار ١ says «بقائمةِ صيغٍ ثابتةٍ فقط», and the reason is that a
// heuristic here («drop the first sentence if it praises God») would eventually drop a first
// sentence that was part of the answer. These are the openings measured across the eight pages —
// the ḥamdala and its relatives — and nothing outside the list is touched.
//
// Matched on a length-preserving fold so «الحمدُ للهِ» and «الحمد لله» are one formula.
// `terminated: true` means the formula only counts as an OPENING when a sentence boundary follows
// it. MEASURED: «الحمد لله» bare is both a ḥamdala and the opening words of a real answer —
// «الحمد لله الذي جعل العقيقة سنة، وهي شاة عن الأنثى» is the ANSWER, and stripping it left the
// reader with a sentence beginning «الذي». The long formulas need no such guard: nothing but a
// ḥamdala ends «…وصحبه، أما بعد».
const OPENINGS = [
  { text: 'الحمد لله والصلاة والسلام على رسول الله وعلى اله وصحبه اما بعد' },
  { text: 'الحمد لله والصلاة والسلام على رسول الله وعلى اله وصحبه ومن اهتدى بهداه اما بعد' },
  { text: 'الحمد لله رب العالمين والصلاة والسلام على نبينا محمد وعلى اله وصحبه اجمعين اما بعد' },
  { text: 'الحمد لله والصلاة والسلام على نبينا محمد وعلى اله وصحبه اما بعد' },
  { text: 'الحمد لله وحده والصلاة والسلام على من لا نبي بعده اما بعد' },
  { text: 'الحمد لله وكفى والصلاة والسلام على عباده الذين اصطفى اما بعد' },
  { text: 'بسم الله الرحمن الرحيم الحمد لله رب العالمين اما بعد' },
  { text: 'الحمد لله', terminated: true },
];

const fold = (s) => String(s == null ? '' : s)
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Each folded letter maps back to the RAW forms that fold to it, so a formula written fully
// vocalised is matched by the same entry as one written bare.
const BACK = { 'ا': '[اأإآٱ]', 'ه': '[هة]', 'ي': '[يى]', 'و': '[وؤ]' };
const DIA = '[\\u064B-\\u0652\\u0670\\u0640]*';   // harakāt, dagger alif, tatweel

// A formula compiled to a regex anchored at the start: every letter may carry diacritics, and the
// gaps between words may be any run of whitespace or the punctuation these openings are written
// with. Built ONCE per formula at module load, not per call.
function compileOpening(folded, terminated) {
  const words = folded.split(' ').filter(Boolean);
  const pattern = words
    .map((w) => Array.from(w).map((ch) => (BACK[ch] || escapeRe(ch)) + DIA).join(''))
    .join('[\\s:،.؛ـ-]+');
  // A terminated formula must be followed by a sentence mark or the end of the text. Without
  // that, a bare ḥamdala swallows the first words of an answer that merely begins by praising God.
  const tail = terminated ? '\\s*[:،.؛!؟]+\\s*' : '[\\s:،.؛-]*';
  return new RegExp('^' + DIA + pattern + tail, 'u');
}
function escapeRe(ch) { return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// LONGEST FIRST. «الحمد لله» is a prefix of every other entry, so testing it first would leave
// «والصلاة والسلام … أما بعد» stranded at the top of the answer.
const COMPILED = OPENINGS
  .map((o) => ({ folded: fold(o.text), re: compileOpening(fold(o.text), o.terminated) }))
  .sort((a, b) => b.folded.length - a.folded.length);

/**
 * Remove a fixed opening formula, if the answer begins with one.
 *
 * MATCHED BY REGEX ON THE RAW STRING, not by folding and counting. The first version folded the
 * answer, found the formula's length in the FOLDED string, and then walked that many characters
 * into the RAW one — but `fold` also collapses whitespace, so the two lengths diverge the moment
 * a formula contains two spaces in a row. Measured: it cut «الحمد لله … أما بعد:» four characters
 * short and returned an answer beginning «ؤكدة عن المولود».
 */
export function stripOpening(answerRaw) {
  const answer = String(answerRaw == null ? '' : answerRaw).trim();
  if (!answer) return answer;
  for (const { re } of COMPILED) {
    const m = re.exec(answer);
    if (!m || !m[0]) continue;
    const rest = answer.slice(m[0].length).trim();
    // NEVER RETURN AN EMPTY ANSWER. A page whose whole body was the formula has no answer to
    // transfer, and handing back '' would look like a successful strip.
    return rest || answer;
  }
  return answer;
}

/** Paragraphs, in order. A published answer's own boundaries — never a re-wrap. */
export function paragraphs(text) {
  return String(text == null ? '' : text)
    .split(/\n\s*\n+|\r\n\s*\r\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Does a cut at `index` land inside a Qur'anic or hadith quotation?
 *
 * Asked of the WHOLE text, because a quotation's start may be several paragraphs above the cut.
 * lib/frozen-text.js already identifies these deterministically and reports offsets — it exists
 * for the takhrij lock, and this is the same question asked for a different reason.
 */
export function cutSplitsQuotation(text, index) {
  const run = containsFrozenRun(text);
  if (!run) return false;
  return index > run.start && index < run.end;
}

/**
 * Trim a transferred answer to length WITHOUT cutting a quotation.
 *
 * The shape قرار ١ specifies: the FIRST paragraph, the LAST paragraph, and the elision mark
 * between them when anything was dropped. Paragraphs are the unit because they are the author's
 * own boundaries; a character count would cut mid-sentence and a sentence count would cut
 * mid-argument.
 *
 * @returns {{text:string, truncated:boolean, keptParagraphs:number, totalParagraphs:number}}
 */
export function trimToLength(answerRaw, maxChars = 2400) {
  const answer = String(answerRaw == null ? '' : answerRaw).trim();
  const paras = paragraphs(answer);
  if (!answer) return { text: '', truncated: false, keptParagraphs: 0, totalParagraphs: 0 };
  if (answer.length <= maxChars || paras.length <= 2) {
    // A SINGLE LONG PARAGRAPH IS CARRIED WHOLE. There is no boundary inside it that is the
    // author's, so any cut would be ours — and a cut we invented is the thing this file refuses.
    return { text: answer, truncated: false, keptParagraphs: paras.length, totalParagraphs: paras.length };
  }
  const first = paras[0];
  const last = paras[paras.length - 1];
  // A QUOTATION SPANNING THE ELISION IS NOT ELIDED. If dropping the middle would cut a frozen run
  // that begins in the kept head or ends in the kept tail, the whole answer is carried instead.
  const headEnd = first.length;
  const tailStart = answer.lastIndexOf(last);
  if (cutSplitsQuotation(answer, headEnd) || (tailStart > 0 && cutSplitsQuotation(answer, tailStart))) {
    return { text: answer, truncated: false, keptParagraphs: paras.length, totalParagraphs: paras.length };
  }
  return {
    text: [first, ELISION_MARK, last].join('\n\n'),
    truncated: true,
    keptParagraphs: 2,
    totalParagraphs: paras.length,
  };
}

/**
 * The whole transfer transform: strip the opening, trim to length, tell the reader if anything
 * was removed.
 *
 * @returns {{text:string, truncated:boolean, openingStripped:boolean}}
 */
export function prepareTransfer(answerRaw, { maxChars = 2400 } = {}) {
  const original = String(answerRaw == null ? '' : answerRaw).trim();
  const stripped = stripOpening(original);
  const openingStripped = stripped !== original;
  const t = trimToLength(stripped, maxChars);
  const text = t.truncated ? t.text + '\n\n' + TRUNCATION_TAIL : t.text;
  return { text, truncated: t.truncated, openingStripped };
}
