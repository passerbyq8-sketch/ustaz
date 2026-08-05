// lib/world-intent.js
// IS THIS QUESTION ABOUT THE WORLD AS IT IS TODAY? — deterministic, pure, no I/O, no model.
//
// WHY IT EXISTS. The general route (lib/route-classify.js -> 'GEN') runs with NO tools, so a
// question about the news had nothing to be answered from except the model's training
// cut-off, and it was answered with an apology for that. This decides, on the wording alone
// and identically every time, whether a GEN turn is the kind of question a LIVE search can
// answer — and lib/retrieve.js's retrieveWorld() then searches the world source list.
//
// IT IS NOT A ROUTER, AND IT NEVER SEES A RELIGIOUS QUESTION.
// ---------------------------------------------------------
// classifyRoute() runs first and sends anything religious to DEEN, which is sourced from the
// approved Islamic sites and never reaches this file. That alone is the guarantee. But a
// guarantee that lives in the caller is a guarantee a refactor can move, so rule 1 below
// re-asserts it here with the SAME predicate the router uses: a message that names a
// religious subject is refused outright, whatever else it says. «ما آخر أخبار المسجد الأقصى؟»
// therefore does not become a world search through the word «أخبار» — isReligiousText() sees
// «مسجد» and the answer is REFUSED_RELIGIOUS.
//
// THE BIAS IS THE OPPOSITE OF source-purpose.js's, and deliberately so. There, doubt resolves
// towards `fatwa` because the cost of under-restricting a religious source is high. Here,
// doubt resolves towards NOT searching: a false positive spends a live search on a question
// that did not need one and then answers it from news pages, which is worse than the ordinary
// answer it would otherwise have got. So every trigger below is a NEWS word, a RECENCY frame,
// or a recent YEAR — never a bare topic, and never a bare question word.

import { normalizeArabic, stripFormulas, isReligiousText } from './route-classify.js';

export const WORLD_REASONS = Object.freeze({
  REFUSED_RELIGIOUS: 'REFUSED_RELIGIOUS',
  NEWS_PHRASE: 'NEWS_PHRASE',
  NEWS_TERM: 'NEWS_TERM',
  RECENT_YEAR: 'RECENT_YEAR',
  RECENCY_FRAME: 'RECENCY_FRAME',
  EXPLICIT_SEARCH: 'EXPLICIT_SEARCH',
  NONE: 'NONE',
});

const N = (arr) => arr.map((s) => normalizeArabic(s)).filter(Boolean);

// Same prefix/suffix folding the router uses, so «الأخبار» matches «أخبار» and «تطوّراتها»
// matches «تطورات». Kept local because route-classify.js does not export it.
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

// ── (a) NEWS TERMS ───────────────────────────────────────────────────────────
// Single words whose presence, on their own, means the reader is asking about events rather
// than about a settled fact.
//
// «حدث» IS DELIBERATELY ABSENT in its singular form. In fiqh it is the word for ritual
// impurity («الحدث الأصغر»، «رفع الحدثين»), and although rule 1 already refuses anything
// religious, a trigger that collides with a fiqh term is a trigger that will be misread the
// first time the router's vocabulary is edited. The plural news sense always arrives inside a
// frame — «الأحداث الجارية» — which is listed as a phrase below instead.
const NEWS_TERMS = N([
  'اخبار', 'خبر', 'اخباريه', 'عاجل', 'تطورات', 'مستجدات', 'تحديثات',
  'انتخابات', 'استفتاء شعبي', 'هدنه', 'قمه', 'مظاهرات', 'احتجاجات', 'اضراب',
  'زلزال', 'اعصار', 'فيضان', 'وباء', 'جائحه',
  'بورصه', 'مؤشرات', 'تضخم', 'عقوبات',
  'مباراه', 'بطوله', 'اولمبياد',
]);

// ── (b) NEWS FRAMES ──────────────────────────────────────────────────────────
// Multi-word shapes. These carry the recency on their own and need nothing beside them.
const NEWS_PHRASES = N([
  'اخر الاخبار', 'اخر الاحداث', 'اخر التطورات', 'اخر المستجدات', 'اخر التحديثات',
  'احدث الاخبار', 'احدث التطورات', 'احدث المستجدات', 'اخر تطورات', 'احدث تطورات',
  'اخر ما توصل', 'اخر ما وصل', 'اخر ما جد', 'اخر تحديث',
  'ماذا يحدث', 'ماذا يجري', 'ما الذي يحدث', 'ما الذي يجري', 'شنو يصير', 'وش يصير',
  'الاحداث الجاريه', 'احداث جاريه', 'الوضع الحالي', 'الوضع الان', 'الوضع الراهن',
  'ما الجديد', 'ما جديد', 'هل هناك جديد', 'اخبار اليوم', 'نشره الاخبار',
  'وقف اطلاق النار', 'سعر الصرف', 'سعر الذهب', 'اسعار النفط', 'سعر البترول',
  'كاس العالم', 'دوري ابطال', 'الدوري الانجليزي', 'الدوري الاسباني',
]);

// ── (c) THE RECENCY FRAME ────────────────────────────────────────────────────
// A "latest/newest" head AND a "now/today" marker in the same message. Either alone is far
// too weak — «آخر مرة صليت فيها» and «كم الساعة الآن» are not news questions — but together
// they are unambiguously a request for the current state of something.
const RECENCY_HEADS = N(['اخر', 'احدث', 'اجدد', 'الجديد', 'جديد', 'مستجد', 'الاخيره', 'الاخير']);
const RECENCY_MARKERS = N([
  'اليوم', 'الان', 'حاليا', 'الحالي', 'الحاليه', 'مؤخرا', 'امس', 'الراهن', 'الراهنه',
  'هذا الاسبوع', 'هذا الشهر', 'هذا العام', 'هذه السنه', 'هذه الايام', 'في الوقت الحالي',
  'حتي الان', 'لحد الان', 'لغايه الان',
]);

// ── (d) A YEAR THIS APP CANNOT KNOW FROM MEMORY ──────────────────────────────
// Both digit sets, because a reader types «٢٠٢٦» as readily as «2026». The floor is 2024 for
// one reason only: it is the published training cut-off the model kept apologising about, so
// a question naming that year or a later one is by definition a question memory cannot answer.
const RECENT_YEAR = /(?:^|[^\d٠-٩])(?:20(?:2[4-9]|3\d)|٢٠(?:٢[٤-٩]|٣[٠-٩]))(?:[^\d٠-٩]|$)/;

// ── (e) THE READER ASKED FOR A SEARCH OUTRIGHT ───────────────────────────────
const EXPLICIT_SEARCH = N([
  'ابحث في الانترنت', 'ابحث على الانترنت', 'ابحث بالانترنت', 'ابحث في الشبكه',
  'ابحث لي عن', 'ابحث عن اخبار', 'دور لي على', 'شوف لي اخر',
]);

const hitPhrase = (padded, phrases) => phrases.find((p) => padded.includes(' ' + p + ' ')) || '';
const hitWord = (words, list) => list.find((w) => words.has(w)) || '';

/**
 * @param {string} raw the reader's message
 * @returns {{world:boolean, reason:string, matched:string}}
 *          `world` is the only field the request path acts on; the other two exist so a log
 *          line and a test can say WHY without re-deriving it.
 */
export function classifyWorldIntent(raw) {
  const cleaned = stripFormulas(normalizeArabic(raw));
  if (!cleaned) return { world: false, reason: WORLD_REASONS.NONE, matched: '' };

  // RULE 1, AND IT OVERRIDES EVERYTHING BELOW IT. A message that names a religious subject is
  // not a world question no matter how many news words ride along with it.
  if (isReligiousText(raw)) {
    return { world: false, reason: WORLD_REASONS.REFUSED_RELIGIOUS, matched: '' };
  }

  const padded = ' ' + cleaned + ' ';
  const words = new Set();
  for (const tok of cleaned.split(' ')) {
    if (!tok) continue;
    for (const f of foldForms(tok)) words.add(f);
  }

  let m = hitPhrase(padded, EXPLICIT_SEARCH);
  if (m) return { world: true, reason: WORLD_REASONS.EXPLICIT_SEARCH, matched: m };

  m = hitPhrase(padded, NEWS_PHRASES);
  if (m) return { world: true, reason: WORLD_REASONS.NEWS_PHRASE, matched: m };

  m = hitWord(words, NEWS_TERMS);
  if (m) return { world: true, reason: WORLD_REASONS.NEWS_TERM, matched: m };

  // The year test runs on the ORIGINAL text: normalizeArabic() keeps digits, but reading the
  // raw string too means a year glued to punctuation («في 2026،») is still seen.
  if (RECENT_YEAR.test(String(raw == null ? '' : raw)) || RECENT_YEAR.test(cleaned)) {
    return { world: true, reason: WORLD_REASONS.RECENT_YEAR, matched: 'year' };
  }

  const head = hitWord(words, RECENCY_HEADS);
  const marker = hitWord(words, RECENCY_MARKERS) || hitPhrase(padded, RECENCY_MARKERS);
  if (head && marker) {
    return { world: true, reason: WORLD_REASONS.RECENCY_FRAME, matched: head + ' + ' + marker };
  }

  return { world: false, reason: WORLD_REASONS.NONE, matched: '' };
}

/** Convenience for the request path, which only ever needs the boolean. */
export function needsWorldSearch(raw) {
  return classifyWorldIntent(raw).world;
}
