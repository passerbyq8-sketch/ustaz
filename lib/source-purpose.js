// lib/source-purpose.js
// WHAT KIND OF QUESTION IS THIS? — deterministic, pure, no I/O, no model call.
//
// It answers one question so that lib/source-registry.js can answer another. This file says
// "this query is asking for a RULING", and the registry says "these sources may not supply
// one". Together they are what stops a khutbah archive from being the evidence behind
// "divorce pronounced in anger does not count".
//
// IT IS NOT A ROUTER. lib/route-classify.js decides DEEN vs GEN and is untouched. This
// decides only which SUBSET of an already-approved list a search may draw from, and only
// for sources that declared a restriction. A query whose purpose comes out 'general' — the
// default — reaches exactly the list it reaches today.
//
// BIASED TOWARDS 'fatwa', ON PURPOSE. The cost of the two mistakes is not symmetric. Calling
// a general question 'fatwa' loses a khutbah page from the candidate pool and the answer
// comes from one of the fifteen unrestricted sources instead: nothing breaks. Calling a
// ruling question 'general' lets a restricted source back a ruling it was admitted on the
// condition of never backing. So the ruling vocabulary below is deliberately generous, it is
// tested first, and anything that names a ruling word IS a fatwa question even when it also
// names a verse.

import { normalizeArabic } from './route-classify.js';

const N = (arr) => arr.map((s) => normalizeArabic(s)).filter(Boolean);

// Fold a token the way route-classify.js folds its own vocabulary, so a glued article or
// pronoun cannot make a trigger silently miss ("الحكم" must match "حكم").
const PREFIXES = /^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/;
const SUFFIXES = ['هما', 'هم', 'هن', 'كم', 'ها', 'ات', 'ين', 'ون', 'نا', 'ه', 'ي', 'ك'];
function foldForms(tok) {
  const out = new Set([tok]);
  const bare = tok.replace(PREFIXES, '');
  if (bare && bare !== tok) out.add(bare);
  for (const base of [...out]) {
    for (const suf of SUFFIXES) {
      if (base.length > suf.length + 2 && base.endsWith(suf)) out.add(base.slice(0, -suf.length));
    }
  }
  return out;
}
function lex(text) {
  const t = normalizeArabic(text);
  const w = new Set();
  for (const tok of t.split(' ')) if (tok) for (const f of foldForms(tok)) w.add(f);
  return { p: ' ' + t + ' ', w, empty: !t };
}
const hit = (padded, words, phrases) =>
  phrases.some((p) => (p.includes(' ') ? padded.includes(' ' + p + ' ') : words.has(p)));

// ── FATWA ────────────────────────────────────────────────────────────────────
// Three families, any one of which is enough:
//   1. the question ASKS FOR A VERDICT in so many words;
//   2. it names a verdict CATEGORY (حلال، حرام، مكروه، صحيح، باطل، …);
//   3. it names an act of worship, a family matter or a transaction whose whole point is
//      that it has a ruling — the "نازلة" surface the brief keeps naming.
const FATWA_ASKS = N([
  'ما حكم', 'ماحكم', 'ما الحكم', 'حكم', 'احكام', 'الحكم الشرعي', 'ما هو حكم', 'وش حكم',
  'شنو حكم', 'ايش حكم', 'هل يجوز', 'هل يحرم', 'هل يحل', 'هل تجوز', 'هل يصح', 'هل يبطل',
  'هل يلزم', 'هل يجب', 'هل علي', 'يجوز', 'تجوز', 'جائز', 'فتوي', 'فتاوي', 'استفتاء',
  'افتوني', 'ماذا افعل', 'ماذا يلزمني', 'هل اثم', 'هل علي اثم', 'كفاره', 'يترتب علي',
]);
const FATWA_VERDICTS = N([
  'حلال', 'حرام', 'محرم', 'مكروه', 'مستحب', 'مباح', 'مندوب', 'فرض', 'واجب', 'سنه',
  'باطل', 'صحيح شرعا', 'لا يجوز', 'بدعه', 'معصيه', 'اثم', 'ذنب', 'مشروع',
]);
const FATWA_TOPICS = N([
  // عبادات
  'وضوء', 'غسل', 'تيمم', 'طهاره', 'نجاسه', 'جنابه', 'حيض', 'نفاس', 'استحاضه',
  'صلاه', 'صيام', 'صوم', 'افطار', 'قضاء', 'زكاه', 'نصاب', 'حج', 'عمره', 'احرام', 'اضحيه',
  'عقيقه', 'اعتكاف', 'سجود السهو', 'جمع الصلاه', 'قصر الصلاه',
  // THE VERB FORMS, and they are not decoration. A reader does not write «صلاة»; she writes
  // «فهل تصلي؟». The noun list alone read «امرأة أسقطت في الشهر الثاني فهل تصلي؟» — the exact
  // family of question this whole safety layer was built around — as a GENERAL question, and
  // a general question may draw on the scope-restricted sources. The prefix folder does not
  // strip the imperfect ت/ي/أ/ن, so each form has to be named.
  'تصلي', 'يصلي', 'اصلي', 'نصلي', 'تصوم', 'يصوم', 'اصوم', 'نصوم', 'تقضي', 'يقضي', 'اقضي',
  'تفطر', 'يفطر', 'افطر', 'تغتسل', 'يغتسل', 'اغتسل', 'تتوضا', 'يتوضا', 'اتوضا',
  'اسقطت', 'سقط الجنين', 'اجهاض', 'الاسقاط', 'تحرم', 'يحرم علي',
  // أسرة
  'طلاق', 'خلع', 'نكاح', 'زواج', 'مهر', 'عده', 'رضاع', 'حضانه', 'نفقه', 'ميراث', 'ورث',
  'محرم', 'عقد القران',
  // «خطبة» IS NOT HERE, and the omission is deliberate. Betrothal (خِطبة) and the Friday
  // sermon (خُطبة) are the same string once diacritics are folded, so listing it read
  // «خطبة عن بر الوالدين» — a request for a SERMON — as a ruling question, and the scope
  // filter then dropped the khutbah archive that is the one right source for it. An actual
  // betrothal question always arrives with a ruling word or another family term beside it
  // (حكم، يجوز، نكاح، محرم), each of which is already listed, so nothing is lost.
  // معاملات ونوازل
  'ربا', 'فوائد بنكيه', 'قرض', 'تامين', 'اسهم', 'عمله رقميه', 'بيتكوين', 'كريبتو',
  'رهن', 'بيع', 'شراء', 'اجاره', 'شركه', 'وقف', 'وصيه', 'دين',
]);

// ── HADITH ───────────────────────────────────────────────────────────────────
// Authentication / grading / takhrij. Kept aligned with lib/source-intent.js's dorar
// vocabulary — the two files answer different questions about the same signal, and a term
// that means "grade this hadith" there means "this is a hadith question" here.
const HADITH_TERMS = N([
  'تخريج', 'خرجه', 'من اخرجه', 'من رواه', 'درجه الحديث', 'صحه الحديث', 'اسناد', 'سند',
  'المحدث', 'الالباني', 'ابن حجر', 'الذهبي', 'الدارقطني', 'متواتر', 'موضوع', 'مرسل',
  'موقوف', 'مرفوع', 'شاذ', 'منكر', 'معلول', 'الجرح والتعديل', 'الرواه', 'راوي',
  'هل يصح حديث', 'صحه حديث', 'حديث ضعيف', 'حديث صحيح', 'حديث موضوع',
]);

// ── TAFSIR ───────────────────────────────────────────────────────────────────
const TAFSIR_TERMS = N([
  'تفسير', 'معني ايه', 'معني الايه', 'معني قوله تعالي', 'قوله تعالي', 'قال تعالي',
  'سبب نزول', 'اسباب النزول', 'تدبر', 'مقاصد السوره', 'المراد بقوله', 'ما معني قوله',
  'اعراب الايه', 'مكيه ام مدنيه',
]);

/**
 * @param {string} query
 * @returns {'fatwa'|'tafsir'|'hadith'|'general'}
 */
export function classifyPurpose(query) {
  const { p, w, empty } = lex(query);
  if (empty) return 'general';

  // Ruling first, and it wins outright. "ما حكم قراءة سورة الكهف يوم الجمعة" names a sura
  // and is still a ruling question, and the source that may answer it is a fatwa source.
  if (hit(p, w, FATWA_ASKS) || hit(p, w, FATWA_VERDICTS) || hit(p, w, FATWA_TOPICS)) return 'fatwa';

  if (hit(p, w, HADITH_TERMS)) return 'hadith';
  if (hit(p, w, TAFSIR_TERMS)) return 'tafsir';
  return 'general';
}

// Convenience for callers that hold the whole conversation: the purpose of the LAST user
// turn, which is the turn the answer is about.
export function purposeOfLastUserTurn(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== 'user') continue;
    const c = m.content;
    const text = typeof c === 'string' ? c
      : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join(' ') : '';
    return classifyPurpose(text);
  }
  return 'general';
}
