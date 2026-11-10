// lib/question-terms.js -- ITEM 35-D2 R7 (brain35-2 F6, 2026-11-07): THE ISSUE'S OWN WORDS, AS A LEAF.
//
// Moved out of lib/before-writing-v2.js byte for byte (the block «THE ISSUE'S OWN WORDS (R, verbatim)»: FRAME_WORDS, the
// honorific formulas, issueWords, issueTerms; and the parts valve's stemWord). WHY A FILE OF ITS OWN: the khilaf tail's view
// count (lib/output-reviewer.js releasedViewsIn) now reads the question's issue terms to drop a party whose every clause is on
// a side point (DIAG2 R7, P13), and the reviewer cannot import lib/before-writing-v2.js: that module imports the reviewer.
// This file reads nothing but normalizeArabic, so either side imports it without a cycle. Pure; no state.
import { normalizeArabic } from './route-classify.js';

// -- THE ISSUE'S OWN WORDS (R, verbatim) -----------------------------------------------------------
const FRAME_WORDS = new Set([
  'ما', 'ماذا', 'هل', 'كيف', 'متي', 'اين', 'لماذا', 'لم', 'من', 'كم', 'اي', 'وهل', 'فهل', 'او', 'ام', 'و',
  'حكم', 'الحكم', 'يجوز', 'لا', 'جائز', 'حلال', 'حرام', 'شرعا', 'الشرع', 'الشرعي', 'الاسلام',
  'في', 'علي', 'عن', 'الي', 'الى', 'مع', 'عند', 'بين', 'بعد', 'قبل', 'حتي', 'ثم', 'اذا', 'ان', 'انا', 'انه',
  'انها', 'كان', 'كانت', 'يكون', 'تكون', 'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'هو', 'هي', 'هم',
  'وانا', 'عندي', 'لي', 'لنا', 'اريد', 'ابي', 'ابغي', 'ودي', 'ابغى', 'اذكر', 'اشرح', 'بين', 'وضح', 'فصل',
  'اعطني', 'قل', 'قول', 'اقوال', 'رأي', 'راي', 'المذاهب', 'المذهب', 'مذاهب', 'الاربعه', 'الاربع', 'الائمه',
  'العلماء', 'الفقهاء', 'اهل', 'العلم', 'حسب', 'بالتفصيل', 'تفصيل', 'كامله', 'كامل', 'باختصار', 'مع',
  'الدليل', 'بالدليل', 'دليل', 'ادله', 'بادلتها', 'والخلاف', 'الخلاف', 'والراجح', 'الراجح', 'مسأله',
  'مساله', 'المسأله', 'المساله', 'سؤال', 'سوال', 'يا', 'شيخ', 'الشيخ', 'لو', 'سمحت', 'جزاك', 'الله',
  'خيرا', 'خير', 'بس', 'شنو', 'شلون', 'وش', 'ايش', 'يعني', 'فيه', 'فيها', 'به', 'بها', 'له', 'لها',
  'ذكر', 'كل', 'احكام', 'الاحكام', 'صفات', 'صفه', 'كيفيه', 'اقوال', 'الاقوال', 'بادلته', 'بادلتها',
  'ادلتها', 'ادلته', 'كامله', 'تفصيلا', 'مفصلا', 'انقله', 'بحروفه', 'نص', 'كلام',
  // PIPES fix 1: the interrogative written as one word («ماهي صفات…»), the name joiner «بن», and
  // «تعالى» after the Name. MEASURED (EZIK-SPEED-PIPES-REPORT §3): «ماهي» is rarer in the index than
  // the issue's own words, so the library ANDed «ماهي» with «الخوف» and returned pages that answer
  // nothing, the madhhab books returned none, and the fatwa store (which ANDs every word) none.
  'ماهي', 'ماهو', 'بن', 'تعالي',
  // PIPES2 fix 2: «مثل» / «مثلا» ("such as") introduce an example of the issue, not the issue. MEASURED (round 7,
  // question 5, «ما حكم تداول العملات المشفرة مثل البتكوين؟»): the word made the fatwa store AND «المشفرة مثل
  // البتكوين» (0 fatwas) and brought the encyclopedia's articles «مثل» and «مثليات».
  'مثل', 'مثلا',
]);
// PIPES fix 1: the honorific formulas are the reader's courtesy, not the issue. Removed as whole
// phrases on the folded question, so «صلى» (prayed) and «رحمة» (mercy) stay issue words elsewhere.
const HONORIFICS = /(?:^| )(?:صلي الله عليه (?:واله )?وسلم|عليه (?:الصلاه و)?السلام|عليهم السلام|رضي الله (?:تعالي )?عن(?:ه|ها|هما|هم)|عز وجل|جل وعلا|(?:سبحانه|تبارك) وتعالي)(?= |$)/gu;
// A frame word with a conjunction or a preposition welded on («وحكم», «لمذاهب», «بالتفصيل») is still
// the frame: the one letter is dropped and the rest asked again.
export const WELDED = /^[وفلب]/u;
const isFrame = (token) => FRAME_WORDS.has(token)
  || (WELDED.test(token) && (FRAME_WORDS.has(token.slice(1)) || FRAME_WORDS.has('ال' + token.slice(1))));
// PIPES fix 2: every issue word in two spellings -- `folded` (normalizeArabic, what the frame list, the
// library, the encyclopedia and the judge's windows compare) and `surface` (the reader's own letters with
// the diacritics, tatweel and punctuation taken off, which is what the fatwa store needs; see fatwaQueries).
// The folded tokens are exactly normalizeArabic(question).split(' '), so issueTerms is what it was.
export function issueWords(question) {
  const surface = String(question || '').replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ').split(/\s+/u)
    .map((word) => [...word].filter((c) => normalizeArabic(c) !== '').join('')).filter(Boolean);
  const folded = surface.map((word) => normalizeArabic(word));
  const joined = folded.join(' ');
  const starts = [];
  folded.reduce((at, word) => { starts.push(at); return at + word.length + 1; }, 0);
  const honorific = new Set();
  for (const m of joined.matchAll(HONORIFICS)) {
    const from = m.index + (m[0].startsWith(' ') ? 1 : 0);
    starts.forEach((at, i) => { if (at >= from && at < m.index + m[0].length) honorific.add(i); });
  }
  const out = [];
  folded.forEach((token, i) => {
    if (honorific.has(i) || token.length < 2 || isFrame(token) || /^[0-9]+$/u.test(token)) return;
    if (!out.some((w) => w.folded === token)) out.push({ folded: token, surface: surface[i] });
  });
  return out;
}
export function issueTerms(question) {
  return issueWords(question).map((w) => w.folded);
}
// the parts valve's stem (lib/before-writing-v2.js partSentenceWanted) and the khilaf subject test's: a conjunction or a
// preposition welded on, then the article or «ل», taken off a folded word.
export const stemWord = (w) => w.replace(/^[وفب](?=...)/u, '').replace(/^(?:لل|ال|ل)(?=..)/u, '');
// ITEM 35-D2 R7 (brain35-2 F6; owner: yes): the question's subject for the khilaf view count (lib/output-reviewer.js
// releasedViewsIn): the stemmed issue terms as a Set, or null -- the filter off -- when fewer than two (a generic question,
// «ما الحكم؟», would match nothing and silence every view).
export function subjectTermsOf(question) {
  const terms = new Set(issueTerms(String(question || '')).map(stemWord));
  return terms.size < 2 ? null : terms;
}
