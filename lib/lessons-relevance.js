// lib/lessons-relevance.js — PROGRAM ORDER 2026-09-24, م٣-ز (FULL_ANSWER_V1): «دروسٌ ذاتُ صلة».
//
// THE OWNER'S ITEM: «لا دروسَ تحتَ السؤالِ العامّ، ولا يتكرّرُ الدرسُ نفسُه، وعتبةُ صلة». His witnesses:
// «الطلاق عبر رسائل الجوال» under a question about writing a CV, and one lesson title drawn three
// times under a page-number request. This REVERSES his ruling of 2026-09-09 («لا تغيّرْ فيه شيء…
// خلِّه مثلَ ما هو»), and the reversal is written into guards/lessons-brain-guard.cjs section C.
//
// MEASURED before it was built (program-2026-09-24/03-answer/measure/E-lessons.md): the strip's
// query is the ANSWER's first 400 characters, so the server never saw the question. The service's
// `score` tracks query length, not relevance, and is still read by nobody. Three filters, over the
// question the client now sends beside the query:
//   1. a question the lexical router calls GEN gets no lessons at all;
//   2. a lesson is kept only when its title shares an issue word with the question (question words,
//      frame words and clitics folded away; three letters at least);
//   3. one title is drawn once.
// On 23 witness lists: 69 rows drawn, 35 kept, 8 lists emptied. The measured cost: a book-quote
// request whose words are in no religious lexicon (A:318 «التصوير») routes GEN and loses real
// lessons. That is written, not hidden.
//
// PURE, AND IT IMPORTS ONLY THE ROUTER (which itself imports nothing). No console call: the question
// is never logged (gate telemetrytext).
import { classifyRoute, normalizeArabic, foldAffixes } from './route-classify.js';

// Question words, particles, pronouns, and the frame words every lesson title and every question
// carries. A token whose clitic-stripped form is here is not an issue word (the measured
// «فليس» and «لابن» defect).
const STOP_WORDS = [
  'ما', 'ماذا', 'من', 'متى', 'كيف', 'هل', 'لماذا', 'لم', 'كم', 'اين', 'اي', 'ايش', 'شلون', 'وش', 'شو', 'ليش',
  'في', 'على', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'هذي', 'التي', 'الذي', 'الذين', 'او', 'ثم',
  'لا', 'نعم', 'قد', 'كان', 'يكون', 'عند', 'بعد', 'قبل', 'كل', 'بعض', 'غير', 'بين', 'حتى', 'اذا', 'ان',
  'لي', 'له', 'لها', 'لك', 'لكم', 'لنا', 'انا', 'نحن', 'هو', 'هي', 'هم', 'ليس', 'لكن', 'اما', 'الا',
  'حكم', 'حديث', 'كتاب', 'باب', 'شرح', 'درس', 'جزء', 'صفحه', 'الصفحه', 'الاول', 'الثاني', 'سوال', 'جواب',
  'فتوي', 'ابن', 'ابو', 'ابي', 'عبد', 'الله', 'الشيخ', 'العلامه', 'الامام', 'قال', 'يقول', 'ارجو', 'ابغي',
  'ابي', 'ممكن', 'يجوز', 'تفسير', 'معني', 'انقل', 'نص', 'اريد', 'عايز', 'بدي', 'اشرح', 'لخص', 'مجلس',
  'المجلس', 'القسم', 'رقم', 'الحلقه', 'حلقه', 'مقطع', 'محاضره',
];
const STOP = new Set(STOP_WORDS.map((w) => normalizeArabic(w)));

function stripped(token) {
  const forms = foldAffixes(token);
  const prefixFree = token.replace(/^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/u, '');
  return { forms, prefixFree: prefixFree || token };
}

/** The issue words of a text: folded, clitic-free, three letters or more, no frame word. */
export function issueWords(text) {
  const out = new Set();
  const folded = normalizeArabic(String(text == null ? '' : text)).replace(/[0-9٠-٩]/gu, ' ');
  for (const raw of folded.split(/\s+/u)) {
    const token = raw.replace(/[^ء-ي]/gu, '');
    if (!token) continue;
    const { prefixFree } = stripped(token);
    if (STOP.has(token) || STOP.has(prefixFree)) continue;
    for (const form of [token, prefixFree]) if (form.length >= 3 && !STOP.has(form)) out.add(form);
  }
  return out;
}

/**
 * The hits a question may be shown, in the service's order. An absent or empty question returns
 * the list unchanged: an old client that sends none is served exactly as before.
 */
export function lessonsForQuestion(hits, questionText) {
  const list = Array.isArray(hits) ? hits : [];
  const question = String(questionText == null ? '' : questionText).trim();
  if (!question) return list;
  if (classifyRoute([{ role: 'user', content: question }]) === 'GEN') return [];
  const asked = issueWords(question);
  if (!asked.size) return [];
  const seen = new Set();
  const kept = [];
  for (const hit of list) {
    const title = String((hit && hit.title) || '');
    const key = normalizeArabic(title).replace(/\s+/gu, ' ').trim();
    if (!key || seen.has(key)) continue;
    if (![...issueWords(title)].some((word) => asked.has(word))) continue;
    seen.add(key);
    kept.push(hit);
  }
  return kept;
}
