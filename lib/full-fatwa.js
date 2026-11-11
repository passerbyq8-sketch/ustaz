// THE FULL-FATWA ANSWER CONTRACT.
//
// A published fatwa is an argument, not a sentence. The answer path may let a model
// summarise that argument and identify the spans it relied on, but the model never
// reproduces, shortens, or rewrites the published text. The server carries a complete
// question/answer record and owns the reader-visible text block.

import { cleanFatwaText } from './fatwa-text.js';
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
// ITEM T1 (141) -- 2026-10-15 brain-line: the served text of every field passes lib/fatwa-text.js first (proven symbols,
// presentation forms, controls, empty brackets); the stores are not touched.
export function buildFatwaRecord(input = {}) {
  const question = cleanStructural(cleanFatwaText(input.question));
  const answer = cleanStructural(cleanFatwaText(input.answer));
  const sourceKind = input.sourceKind === 'corpus' ? 'corpus' : 'live';
  const omittedChars = Math.max(0, Number(input.omittedChars) || 0);
  const truncated = omittedChars > 0 || input.truncated === true;
  const supportText = [question, answer].filter(Boolean).join('\n\n');
  return Object.freeze({
    id: String(input.id || ''),
    kind: input.kind || (sourceKind === 'corpus' ? 'fatwa_service' : 'live_page'),
    sourceKind,
    title: cleanStructural(cleanFatwaText(input.title)),
    url: String(input.url || ''),
    publisher: cleanStructural(cleanFatwaText(input.publisher)),
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
    && (record.answer || printedFatwaPair(record).answer)); // ITEM 35-D2 R13 (a) (brain35-2 F10): judged after the «فأجاب …:» split
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

// POSTSHIP ITEM 2 -- 2026-10-24 (row 3): some stored records carry their own headings. binothaimeen 6971's
// question field reads «… الجواب: …» and its answer field opens «السؤال: … الجواب:», so the block printed the
// fatwa twice and «الجواب:» three times; 8884 of 126269 blocks printed «الجواب:» more than once. The stores are
// not touched: the printed pair is normalised here. What the question field holds before an «الجواب:» heading
// is the question; the rest of it is printed in the answer only when the answer does not already carry it. An
// answer that opens «السؤال: … الجواب:» drops that repeated opening, and every remaining «الجواب:» heading in it
// is taken out -- the block prints «السؤال:» once and «الجواب:» once, and the answer's own words are unchanged.
const ANSWER_HEADING_RE = /(?:ال)?جـ?ـ?واب\s*[:：]/u;
const ANSWER_HEADINGS_RE = /[^\S\n]*(?:ال)?جـ?ـ?واب\s*[:：][^\S\n]*/gu;
const QUESTION_HEADING_RE = /^\s*(?:ال)?سؤال\s*[:：]\s*/u;
const QUESTION_OPENING_RE = /^\s*(?:ال)?سؤال\s*[:：][\s\S]*?(?:ال)?جـ?ـ?واب\s*[:：]/u;
// ITEM 35-D2 R13 (a) (brain35-2 F10, 2026-11-07): a record whose whole sheet sits in ONE field («السائل م س يقول … فأجاب رحمه
// الله تعالى: …») is split on the mufti's answering formula -- «فأجاب [رحمه الله (تعالى) | فضيلته | سماحته | الشيخ]:»,
// «فأجابه:», «فالجواب:», «ج:» -- when the answer field is empty and the question carries it; at a word's start, so «ج:»
// inside a word never splits. A record with both fields is untouched. The title floor (lib/fatwa-title.js) is not changed.
const FA_AJABA_RE = /(?:^|\s)(?:فأجاب(?:\s+(?:رحمه\s+الله(?:\s+تعالى)?|فضيلته|سماحته|الشيخ))?|فأجابه|فالجواب|ج)\s*[:：]\s*/u;
const compareText = (value) => normalizeForCompare(value).replace(/[ً-ْـ]/gu, '');

function withoutAnswerHeadings(value) {
  return String(value)
    .replace(ANSWER_HEADINGS_RE, ' ')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export function printedFatwaPair(record) {
  let question = String(record && record.question || '').replace(QUESTION_HEADING_RE, '');
  let answer = String(record && record.answer || '');
  let carried = '';
  // ITEM 35-D2 R13 (a) (brain35-2 F10): the one-field sheet, split on the answering formula (the answer empty, the question carrying it)
  if (!answer.trim()) {
    const formula = FA_AJABA_RE.exec(question);
    if (formula && question.slice(0, formula.index).trim() && question.slice(formula.index + formula[0].length).trim()) {
      answer = question.slice(formula.index + formula[0].length).trim();
      question = question.slice(0, formula.index).trim();
    }
  }
  const heading = ANSWER_HEADING_RE.exec(question);
  if (heading) {
    const before = question.slice(0, heading.index).trim();
    const after = question.slice(heading.index + heading[0].length).trim();
    if (before) {
      question = before;
      if (after && !compareText(answer).includes(compareText(withoutAnswerHeadings(after)).slice(0, 60))) carried = after;
    }
  }
  if (QUESTION_OPENING_RE.test(answer)) answer = answer.replace(QUESTION_OPENING_RE, '');
  answer = withoutAnswerHeadings((carried ? carried + '\n\n' : '') + answer);
  question = withoutAnswerHeadings(question);
  return { question, answer };
}

// POSTSHIP ITEM 9 -- 2026-10-24: measured 189 of 1299 brief answers over 6000 characters in a week (p90 6835, the longest
// 16958), six of the ten longest on the sources path, because the fatwa's text is served whole (T1, «١٤١»). The owner's
// decision: the brief answer shows an excerpt and the full text on demand («النص الكامل»), as «١٤١» keeps it available.
export const BRIEF_FATWA_MAX = 600;
export const FATWA_FULL_LABEL = 'النص الكامل';
// ── ITEM B-1 (brain35, 2026-11-06; DIAG 35.2; the owner's decision, contract section 5: «في الموجز يطلع مقطع جواب كامل أول،
// والسؤال والجواب الأصلي ورا التوسيع») ───────────────────────────────────────────────────────────────────────────────
// The brief block gave the question and the answer ONE 600-character budget, so a long reader's letter left nothing of the
// mufti: measured on the delivered blocks, Q01, Q04 and Q28 showed ZERO answer characters (H2). The answer now gets the
// budget and the original question and answer ride, byte for byte, inside the «النص الكامل» expansion.
// AND A RECORD WITH NOTHING TO SAY OPENS NO ANSWER: «والله ما أذكر، ما أدري» was a complete, usable fatwa by every test
// this file had (Q22), so it opened the answer as the mufti's word. An answer under MIN_ANSWER_WORDS words, or one that is
// only a form of «ما أدري / لا أذكر / لا أعلم / الله أعلم», is no answer: no block, and the row stays evidence.
export const MIN_ANSWER_WORDS = 12;
export const BRIEF_ANSWER_HEAD = 'الجواب (مختصرًا):';
const NO_ANSWER_FORMS = /^(?:[وف]?الله\s+أعلم|[وف]?ما\s+أدري|[وف]?لا\s+أدري|[وف]?ما\s+أذكر|[وف]?لا\s+أذكر|[وف]?لا\s+أعلم|[وف]?ما\s+أعلم)$/u;
/** Does this record's printed answer say anything? (B-1: the test the direct-row selection and the brief block share.) */
export function substantiveFatwaAnswer(record) {
  if (!record) return false;
  const answer = String(printedFatwaPair(record).answer || '').trim();
  if (!answer) return false;
  const bare = answer.replace(/[.،؛:!؟«»"']/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (!bare) return false;
  const words = bare.split(' ').filter(Boolean);
  if (words.length < MIN_ANSWER_WORDS) return false;
  // every clause of it one of the forms above («والله ما أذكر، ما أدري»)
  const clauses = answer.split(/[،.؛\n]+/u).map((c) => c.trim()).filter(Boolean);
  if (clauses.length && clauses.every((c) => NO_ANSWER_FORMS.test(c.replace(/\s+/gu, ' ').trim()))) return false;
  return true;
}
export function briefExcerpt(text, max) {
  const room = String(text).slice(0, Math.max(1, max - 1));
  let cut = -1;
  for (const m of room.matchAll(/[.؟!؛](?=\s|$)|\n/gu)) cut = m.index + m[0].length;
  // BRAIN-A C4 (iii) (2026-11-11; R14; report BRAIN-XRAY section 6, the decision of 8 November): THE CUT MAY FALL ON A COMMA. A
  // transcribed radio answer has few full stops: MEASURED on binbaz:13610 (the witness P4), one sentence end in the room, at 327
  // of 568 characters, one character before the sentence that answers the reader. When the last sentence end leaves more than a
  // third of the room unused, the cut moves to the last comma after it (the comma itself left out; the «…» says the text goes on).
  // With no sentence end past the first third the cut was already the last space (the whole room) and stays so: the comma takes the
  // cut only where the cut was a sentence end, so no excerpt is ever shorter than it was.
  if (cut < Math.ceil(room.length * 2 / 3)) {
    // (two edges MEASURED by the refuting helper, HELPER-REFUTATION section 4: a comma one word after the sentence end moved the cut
    // to «… . ثم…», and a comma inside «…» or ﴿…﴾ ended the excerpt inside an open quotation. The comma takes the cut only when it
    // adds at least a sixth of the room past the sentence end and no quotation is open before it.)
    let comma = -1;
    const closed = (s) => (s.match(/«/gu) || []).length === (s.match(/»/gu) || []).length && (s.match(/﴿/gu) || []).length === (s.match(/﴾/gu) || []).length;
    for (const m of room.matchAll(/،(?=\s|$)/gu)) if (m.index - cut >= Math.floor(max / 6) && closed(room.slice(0, m.index))) comma = m.index;
    if (comma > cut && cut >= Math.floor(max / 3)) cut = comma;
  }
  if (cut < Math.floor(max / 3)) { const sp = room.lastIndexOf(' '); cut = sp > 0 ? sp : room.length; }
  return room.slice(0, cut).replace(/\s+$/u, '');
}

// ITEM 35-D4 C5 (a) (brain35-5 Z6, 2026-11-08): the opening formulas a brief excerpt skips (closed list; the full text keeps
// them): a speaker label at the head («ج :», «الشيخ:», «الجواب:»), the returned greeting, the basmala, the hamdala, the
// salutation (with its «وعلى آله وصحبه …» clause), «أما بعد / وبعد». MEASURED (DIAG4 H5, preview Q12 / Q19): the brief block
// opened on «وعليكم السلام ورحمة الله وبركاته.» and on «الحمد لله رب العالمين، والصلاة والسلام …».
// ITEM 35 (brain35-5e G1a, 2026-11-09; DIAG6 G1): THE FORMULA LIST TAKES THE FORMS THE LIVE CARDS CARRY. MEASURED (DIAG6
// G1-brief-preamble, preview Q12 / Q18): the skip is a prefix match that stops at the first form not on the list, so «الحمد لله،
// وصلى الله وسلم على …» lost its hamdala and the card opened on «وصلى الله وسلم …» (3 of 171 stored answers; 0 on the base). Four
// alternatives in the list's own style: «رب العالمين» standing alone (the hamdala's continuation after a comma or a format
// character); «و?صلى الله» + optional «وسلم» / «وبارك» + «على …» to the next stop (80 at most); «و?من» + «اهتدى / تبعهم / والاه /
// سار على / استن» + « …» to the next stop (60 at most); up to three words between «والسلام» and «على» («الأتمان الأكملان»). In this
// skip only, the format characters U+200B-U+200F, U+2060 and U+FEFF count as whitespace; «النص الكامل» keeps every byte.
const EXCERPT_FORMAT_CHARS = String.fromCodePoint(0x200B) + '-' + String.fromCodePoint(0x200F, 0x2060, 0xFEFF);
const EW = String.raw`[\s${EXCERPT_FORMAT_CHARS}]`;
const EWORD = String.raw`[^\s${EXCERPT_FORMAT_CHARS}.،؛]`;
// BRAIN-A C4 (i) (2026-11-11; R14): THE SKIP READS TEXT WRITTEN WITH VOWEL MARKS. The list below is written in bare letters and was
// applied to the stored text as it is, so a formula written with its marks matched nothing: MEASURED (BRAIN-XRAY SMALL-S3,
// witness stores) 84 of 86 al-Mosleh answers and 82 of 82 Ferkous answers that open on a formula kept it at the head of the brief
// excerpt. Every Arabic letter of the list now takes the marks that may follow it (the harakat U+064B-U+065F, the superscript alef
// U+0670, the tatweel U+0640); a letter the list makes optional stays optional with its marks. The text itself is not changed.
const EXCERPT_MARKS_OPT = '[' + String.fromCodePoint(0x064B) + '-' + String.fromCodePoint(0x065F, 0x0670, 0x0640) + ']*';
const EXCERPT_LETTER_RE = new RegExp('([' + String.fromCodePoint(0x0621) + '-' + String.fromCodePoint(0x064A) + '])([?*+{])?', 'gu');
const excerptLetterWithMarks = (_all, letter, quantifier) => (quantifier ? '(?:' + letter + EXCERPT_MARKS_OPT + ')' + quantifier : letter + EXCERPT_MARKS_OPT);
const EXCERPT_PREAMBLE_RE = new RegExp(String.raw`^(?:${EW}*(?:ج|الشيخ|الجواب)${EW}*[:：]${EW}*)?(?:(?:و?عليكم${EW}+السلام(?:${EW}+ورحمة${EW}+الله(?:${EW}+وبركاته)?)?|بسم${EW}+الله${EW}+الرحمن${EW}+الرحيم|الحمد${EW}+لله(?:${EW}+رب${EW}+العالمين)?|رب${EW}+العالمين|و?صلى${EW}+الله(?:${EW}+و(?:سلم|بارك)){0,2}${EW}+على[^.،؛]{0,80}|و?من${EW}+(?:اهتدى|تبعهم|والاه|سار${EW}+على|استن)[^.،؛]{0,60}|و?(?:أصلي|نصلي)${EW}+و(?:أسلم|نسلم)${EW}+على[^.،؛]{0,80}|و?الصلاة${EW}+والسلام(?:${EW}+(?!على${EW})${EWORD}+){0,3}${EW}+على[^.،؛]{0,80}|و?على${EW}+آله[^.،؛:]{0,60}|أما${EW}+بعد|وبعد)${EW}*[،.:؛]*${EW}*\.*${EW}*)+`.replace(EXCERPT_LETTER_RE, excerptLetterWithMarks), 'u');
// ITEM 35-D4 C5 (b) (brain35-5 Z6): the speaker turns a brief excerpt stops before (closed list): the presenter, the announcer,
// the interviewer, the questioner, a second question. The mufti's own «الشيخ:» after such a turn is part of the exchange and
// stops with it. MEASURED (DIAG4 H5, preview Q14): the block closed on «المقدم: جزاكم الله خيرا.».
const EXCERPT_SPEAKER_TURN_RE = /(?:^|\n|\s)(?:المقدم|المذيع|المحاور|السائل|السؤال|س)\s*[:：]/u;
// ITEM 35-D4 (brain35-5d F-D4, 2026-11-09; DIAG5 D4): A CLOSED-LIST LEADING SPEAKER LABEL IS SKIPPED ON ITS OWN. MEASURED (DIAG5 H4,
// preview Q9): the brief card opened «الشيخ: قدم الله سبحانه وتعالى الصبر …» -- the label group above is optional and a FORMULA must
// follow it, so a label followed by content was kept: 20 of 171 stored bodies (10 «الشيخ:», 7 «ج:», 3 other) still opened on a label.
// A leading label from the CLOSED list «الشيخ», «ج», «س» (then «:» or «：», spaces optional) now goes before the preamble skip, content
// or formula after it. No generic word-plus-colon skip: the postship-2 record binothaimeen:6971 opens on «السؤال:» (outside the list)
// and its block stays the whole answer (guard postship9). The formula skip and the speaker-turn stop are unchanged.
const EXCERPT_LABEL_RE = /^\s*(?:الشيخ|ج|س)\s*[:：]\s*/u;
// ITEM 35-D6 (brain35-5d F-D6b, 2026-11-09; DIAG5 D6): A BARE «[n]» IS DROPPED FROM THE BRIEF EXCERPT ONLY. MEASURED (DIAG5 H4 §5,
// preview Q4 / Q10 / Q13): 15 of 171 stored answers carry an inline «[n]» reference whose footnote text the store does not hold
// («وفق الله الجميع[1].»), and in none of them does the «[n]» recur at a line head as a footnote; the brief card showed a bare «[1]».
// A marker whose footnote line is not in the answer (no line starts with the same «[n]») goes out of the brief BODY, with the space
// before it when one would be left doubled; a marker whose footnote line IS in the answer stays; the «النص الكامل» expansion keeps
// every byte, as does every other tier.
const FOOTNOTE_MARKER_RE = /\[(\d+)\]/gu;
const footnoteLineIn = (answer, n) => new RegExp('(?:^|\\n)\\s*\\[' + n + '\\]\\s*\\S', 'u').test(String(answer || ''));
export function dropBareFootnoteMarkers(body, answer = body) {
  const text = String(body || '');
  let out = '';
  let last = 0;
  for (const m of text.matchAll(FOOTNOTE_MARKER_RE)) {
    if (footnoteLineIn(answer, m[1])) continue;
    let from = m.index;
    const to = m.index + m[0].length;
    if (from > 0 && text[from - 1] === ' ' && (to === text.length || text[to] === ' ')) from -= 1; // never two spaces, never a trailing one
    out += text.slice(last, from);
    last = to;
  }
  return out + text.slice(last);
}
// ITEM 35 (brain35-5e G1b, 2026-11-09; DIAG6 G1, Claude's addition): A BRIEF CARD NEVER OPENS ON A FORMULA FRAGMENT. The skip above
// is a closed list and stops at the first form it does not know; whatever it consumed is gone. When the body it leaves opens -- tested
// on a copy with diacritics, tatweel and the format characters removed -- on a fragment head of this closed list, the brief body falls
// back to the answer with the label skip only and NO formula skip: the whole formula at the head (the base's shape), never half of it.
// A body that does not open on a fragment head is byte-identical to G1a's.
// brain35-5f G1b (order FIX5F): the list also takes the invocation tails an unpunctuated transcribed lesson leaves past the
// 80-character bound (FIX5E FOUND 1, aljasser:287 / :439): «يوم الدين» «إلى يوم الدين» «وعنا معهم» «برحمتك» «يا أرحم الراحمين» «أجمعين» «تسليما كثيرا» «وصحبه» «وأصحابه».
const FRAGMENT_FOLD_RE = new RegExp('[' + String.fromCodePoint(0x064B) + '-' + String.fromCodePoint(0x065F, 0x0670, 0x0640, 0x200B) + '-'
  + String.fromCodePoint(0x200F, 0x2060, 0xFEFF) + ']', 'gu');
const foldForFragmentHead = (s) => String(s || '').replace(FRAGMENT_FOLD_RE, '').replace(/\s+/gu, ' ').trim();
const BRIEF_FRAGMENT_HEAD_RE = /^(?:رب العالمين|وصلى الله|صلى الله|والصلاة والسلام|والسلام على|وسلام على|وعلى آله|ومن اهتدى|ومن تبعهم|ومن والاه|الأتمان|الأكملان|يوم الدين|إلى يوم الدين|وعنا معهم|برحمتك|يا أرحم الراحمين|أجمعين|تسليما كثيرا|وصحبه|وأصحابه)(?![ء-ي])/u;
/** The answer's BODY for the brief excerpt: the opening formulas skipped, stopped before a speaker turn, bare «[n]» markers dropped. The expansion keeps every byte. */
export function briefAnswerBody(answer) {
  let body = String(answer || '').replace(EXCERPT_PREAMBLE_RE, '').trim();
  // ITEM 35-D4 (brain35-5d F-D4): a closed-list label the preamble skip left (no formula after it) goes, then any formula after it.
  body = body.replace(EXCERPT_LABEL_RE, '').replace(EXCERPT_PREAMBLE_RE, '').trim();
  // ITEM 35 (brain35-5e G1b): a body the skips left on a formula fragment falls back to the label skip only (the whole formula).
  if (BRIEF_FRAGMENT_HEAD_RE.test(foldForFragmentHead(body))) body = String(answer || '').replace(EXCERPT_LABEL_RE, '').trim();
  const turn = EXCERPT_SPEAKER_TURN_RE.exec(body);
  if (turn && turn.index > 0) body = body.slice(0, turn.index).trim();
  body = dropBareFootnoteMarkers(body, String(answer || ''));
  return body;
}
// BRAIN-A C4 (ii) (2026-11-11; R14): THE UNDER-FLOOR FALLBACK KEEPS THE FORMULA OUT. A body under MIN_ANSWER_WORDS fell back to the
// WHOLE answer, label and formula included: MEASURED (BRAIN-XRAY SMALL-S3 sample, salmajed:5660) «ج: وعليكم السلام ورحمة الله
// وبركاته .. يُستحب حضور الأضحية عند ذبحها، ولا يجب. والله أعلم.». It falls back to this: the answer after the label and the
// formula skip, with only the speaker-turn stop undone (a one-line radio answer is still an answer, and so is the exchange
// after it); nothing left after the skip, the whole answer as before. Written apart from briefAnswerBody, whose lines are seams.
export function briefAnswerHead(answer) {
  const whole = String(answer || '');
  let head = whole.replace(EXCERPT_PREAMBLE_RE, '').trim().replace(EXCERPT_LABEL_RE, '').replace(EXCERPT_PREAMBLE_RE, '').trim();
  if (BRIEF_FRAGMENT_HEAD_RE.test(foldForFragmentHead(head)) === true) head = whole.replace(EXCERPT_LABEL_RE, '').trim();
  return dropBareFootnoteMarkers(head, whole);
}

// Deterministic and copied from the record. There is no maximum-length parameter.
// Young readers receive no published-text block under either display policy.
export function serverOwnedBlock(record, spans = [], options = {}) {
  if (options.band === 'young' || !recordUsableAsFatwa(record)) return '';
  const lines = ['## ' + HEADING_TEXT, ''];
  if (record.displayPolicy === 'full') {
    let printed = printedFatwaPair(record); // brain35-5 Z6: rebound in the brief branch to the answer's body (the expansion keeps every byte)
    lines.push('السؤال:', printed.question, '', 'الجواب:', printed.answer);
    const whole = lines.join('\n');
    // POSTSHIP ITEM 9 -- 2026-10-24: in the BRIEF answer only, the block is an excerpt to a sentence's end within
    // BRIEF_FATWA_MAX characters, closed by «…», and the whole block rides beside it for the «النص الكامل» button
    // (app.jsx FatwaFullText), letter for letter what is served today. The detailed and student depths are untouched.
    // ITEM B-1 (brain35, 2026-11-06): in the brief answer the ANSWER gets the excerpt budget; the question rides only
    // inside the expansion, whose bytes are the whole block as it always was. A record with nothing to say gets no block.
    if (options.brief === true) {
      if (!substantiveFatwaAnswer(record)) return '';
      // ITEM 35-D2 R8 (brain35-2 F8, 2026-11-07): ONE shape for the brief tier whatever the record's length. MEASURED (DIAG2
      // R8, P5 / P9; four of the sixteen DIAG-1 direct blocks): a block of 600 characters or fewer kept the old question-first
      // shape here. Now: the answer first, cut to the budget with «…» only when the ANSWER exceeds it, and the whole block
      // (question and answer as they always were) inside the «النص الكامل» expansion.
      const head = '## ' + HEADING_TEXT + '\n\n' + BRIEF_ANSWER_HEAD + '\n';
      const budget = Math.max(1, BRIEF_FATWA_MAX - head.length);
      // ITEM 35-D4 C5 (brain35-5 Z6, 2026-11-08): the excerpt is the answer's BODY -- the opening formulas skipped, stopped before a
      // speaker turn (briefAnswerBody); a body under the floor falls back to the whole answer (a one-line radio answer is still an
      // answer). `whole` above (the expansion) keeps every byte; `printed` is rebound so the two sealed lines below read the body.
      const trimmed = briefAnswerBody(printed.answer);
      // BRAIN-A C4 (ii): under the floor, the answer without its label and formula (briefAnswerHead); nothing left of it, the whole answer
      printed = { ...printed, answer: trimmed.split(/\s+/u).filter(Boolean).length >= MIN_ANSWER_WORDS ? trimmed : (briefAnswerHead(printed.answer) || printed.answer) };
      const cut = printed.answer.length > budget; // ITEM 35-D2 R8 (brain35-2 F8): the answer alone against the budget
      const answerOnly = cut ? briefExcerpt(printed.answer, budget) : printed.answer;
      return head + answerOnly + (cut ? '…' : '') + '\n' + '<fatwafull matn="' + Buffer.from(whole, 'utf8').toString('base64') + '">' + FATWA_FULL_LABEL + '</fatwafull>';
    }
    return whole;
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
