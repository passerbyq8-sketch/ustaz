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
/** Legacy export. Forward-only trimming never emits a middle-elision marker. */
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
 * Paragraph labels used only to keep a published speaker prompt with its answer. This is a
 * structural boundary list, not a language classifier: it does not decide what the text means.
 */
const SPEAKER_MARKS = /[ً-ْٰـ]/g;
const speakerFold = (s) => String(s || '').replace(SPEAKER_MARKS, '').trim();
const QUESTION_SPEAKER = /^(?:المقدم|السائل(?:ة)?|سؤال|س)\s*[:：]/u;
const ANSWER_SPEAKER = /^(?:الشيخ|المجيب|الجواب|ج)\s*[:：]/u;

function coherentUnits(paras) {
  const units = [];
  for (let i = 0; i < paras.length;) {
    const p = paras[i];
    if (!QUESTION_SPEAKER.test(speakerFold(p))) {
      units.push({ paragraphs: [p], complete: true });
      i++;
      continue;
    }

    // A prompt may have continuation paragraphs before the labelled reply. Carry through the
    // first answer label as one unit; with no reply label, the remainder is indivisible and cannot
    // be used as a truncated prefix.
    let answerAt = i + 1;
    while (answerAt < paras.length && !ANSWER_SPEAKER.test(speakerFold(paras[answerAt]))) answerAt++;
    if (answerAt >= paras.length) {
      units.push({ paragraphs: paras.slice(i), complete: false });
      break;
    }
    units.push({ paragraphs: paras.slice(i, answerAt + 1), complete: true });
    i = answerAt + 1;
  }
  return units;
}

const refusedTrim = (totalParagraphs, reason) => ({
  text: '', truncated: false, rejected: true, reason,
  keptParagraphs: 0, totalParagraphs,
});

/**
 * Trim a transferred answer to a HARD length without splicing its beginning to its ending.
 *
 * Only a forward prefix of complete paragraph/speaker units may survive. The disclosure tail is
 * budgeted here even though prepareTransfer appends it, so every successful public result is at
 * or below maxChars. If no complete first unit fits, refusal is safer than inventing a cut.
 *
 * @returns {{text:string, truncated:boolean, rejected:boolean, reason?:string,
 *            keptParagraphs:number, totalParagraphs:number}}
 */
export function trimToLength(answerRaw, maxChars = 2400) {
  const answer = String(answerRaw == null ? '' : answerRaw).trim();
  const paras = paragraphs(answer);
  const n = Number(maxChars);
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (!answer) {
    return { text: '', truncated: false, rejected: false, keptParagraphs: 0, totalParagraphs: 0 };
  }
  if (answer.length <= limit) {
    return {
      text: answer, truncated: false, rejected: false,
      keptParagraphs: paras.length, totalParagraphs: paras.length,
    };
  }

  const suffix = '\n\n' + TRUNCATION_TAIL;
  const prefixLimit = limit - suffix.length;
  if (prefixLimit <= 0) return refusedTrim(paras.length, 'limit-smaller-than-disclosure');

  const keptUnits = [];
  for (const unit of coherentUnits(paras)) {
    if (!unit.complete) break;
    const next = [...keptUnits.flatMap((item) => item.paragraphs), ...unit.paragraphs];
    if (next.join('\n\n').length > prefixLimit) break;
    keptUnits.push(unit);
  }

  // If the selected boundary bisects a frozen Qur'an/hadith run, retreat by whole speaker units.
  // Never carry the whole over-limit text as an exception: maxChars remains a hard contract.
  const normalized = paras.join('\n\n');
  let kept = keptUnits.flatMap((unit) => unit.paragraphs);
  while (keptUnits.length && cutSplitsQuotation(normalized, kept.join('\n\n').length)) {
    keptUnits.pop();
    kept = keptUnits.flatMap((unit) => unit.paragraphs);
  }
  if (!kept.length) return refusedTrim(paras.length, 'no-complete-unit-fits');

  return {
    text: kept.join('\n\n'),
    truncated: true,
    rejected: false,
    keptParagraphs: kept.length,
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
  if (t.rejected) {
    return {
      text: '', truncated: false, rejected: true,
      reason: t.reason, openingStripped,
    };
  }
  const text = t.truncated ? t.text + '\n\n' + TRUNCATION_TAIL : t.text;
  const n = Number(maxChars);
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (text.length > limit) {
    return {
      text: '', truncated: false, rejected: true,
      reason: 'prepared-text-exceeds-limit', openingStripped,
    };
  }
  return { text, truncated: t.truncated, rejected: false, openingStripped };
}
