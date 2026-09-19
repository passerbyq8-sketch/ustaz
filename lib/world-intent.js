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
import { liveWorldV2Enabled } from './live-world-v2.js';

export const WORLD_REASONS = Object.freeze({
  REFUSED_RELIGIOUS: 'REFUSED_RELIGIOUS',
  NEWS_PHRASE: 'NEWS_PHRASE',
  NEWS_TERM: 'NEWS_TERM',
  WEATHER: 'WEATHER',
  MARKET_PRICE: 'MARKET_PRICE',
  // ── THE TWO REASONS ADDED 2026-09-19, BOTH BEHIND LIVE_WORLD_V2 ────────────
  // They are DECLARED unconditionally and RETURNED conditionally. A reason name that appears
  // and disappears with an environment variable is a reason a log reader cannot look up, and
  // guards/source-honesty-guard.cjs:560 asserts that every reason the classifier can return is
  // declared here — an assertion that would become flag-dependent if the declaration moved.
  FX_RATE: 'FX_RATE',
  CLOCK_DATE: 'CLOCK_DATE',
  RECENT_YEAR: 'RECENT_YEAR',
  RECENCY_FRAME: 'RECENCY_FRAME',
  EXPLICIT_SEARCH: 'EXPLICIT_SEARCH',
  ATTRIBUTED_POSITION: 'ATTRIBUTED_POSITION',
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
  // «مباراه» folds to itself and NOT to «مباريات» — foldForms strips the «ات» suffix and leaves
  // «مباري», which is neither. Measured: «ما نتائج مباريات أمس؟» was NONE while «مباراة الأمس»
  // was WORLD. The plural is written out rather than the folder taught a broken-plural rule.
  'مباراه', 'مباريات', 'بطوله', 'اولمبياد',
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
  'نتيجه المباراه', 'نتائج المباريات', 'ترتيب الدوري', 'جدول الترتيب', 'من فاز في المباراه',
]);

// ── (b2) THE SUBJECT CARRIES THE RECENCY BY ITSELF ───────────────────────────
//
// THE MEASUREMENT THAT PUT THESE HERE. Run on 2026-08-07 through classifyWorldIntent() itself,
// seven of the owner's thirteen sample questions fell to NONE — «كم درجة الحرارة اليوم في
// الكويت؟»، «شنو الطقس اليوم؟»، «هل تمطر بكرة؟»، «كم سعر صرف الدولار مقابل الدينار؟»، «كم سعر
// الدولار اليوم؟»، «كم سعر برميل النفط؟» — while «كم سعر الذهب اليوم؟» passed. The reason was
// not the classifier's structure: the lists carried «سعر الصرف» as a literal, which does not
// occur inside «سعر صرف الدولار»، and «اسعار النفط», which does not occur inside «سعر برميل
// النفط»; and weather was on no list at all. So this is vocabulary work, and it is done as
// vocabulary rather than by loosening the shapes above.
//
// AND IT IS A THIRD KIND OF TRIGGER, NOT A WIDER SECOND ONE. The file's rule is that a trigger
// must be a NEWS word, a RECENCY frame or a recent YEAR, never a bare topic — because a bare
// topic spends a live search on a question that did not need one. These earn their place by
// being the case that rule was drawn around: a subject whose ANSWER IS A DIFFERENT NUMBER
// TOMORROW. «ما عاصمة الكويت؟» has one answer forever and memory holds it; «كم درجة الحرارة في
// الكويت؟» has no answer memory can ever hold, so a search is not a luxury here, it is the only
// way to be right. The lists stay closed and short for exactly that reason: a subject joins one
// only if its value genuinely moves.

// WEATHER, WHERE THE WORD CAN MEAN NOTHING ELSE.
// «حراره» IS DELIBERATELY ABSENT as a bare word, and this is the same care NEWS_TERMS takes with
// «حدث». lib/policy/core.js lists «حراره» under SYMPTOM_WORDS: «عندي حرارة» is a child's health
// question, and a weather trigger that fired on it would take a health question — the one class
// with its own referral policy — onto a news search. The definite phrase «درجة الحرارة» is how
// the sky is asked about and «حرارته/حرارة» undefined is how a body is, so the phrase list below
// carries the weather sense and the bare word triggers nothing.
const WEATHER_TERMS = N([
  'طقس', 'ارصاد', 'تمطر', 'ستمطر', 'يمطر', 'امطار', 'ثلوج',
]);
const WEATHER_PHRASES = N([
  'درجه الحراره', 'درجات الحراره', 'حاله الجو', 'حاله الطقس', 'الجو اليوم',
  'موجه حر', 'موجه حاره', 'العواصف الترابيه', 'توقعات الطقس', 'نشره الطقس',
]);

// A PRICE, AND IT IS A CONJUNCTION — the discipline lib/policy/core.js's hazard rules are under,
// for the same reason. A bare «سعر» is not a live-world trigger: «كم سعر الأضحية؟» and «كم قيمة
// زكاة الفطر؟» are religious questions that rule 1 already refuses, and «بكم اشتريت سيارتك؟» is
// a question no search answers. What makes a price a LIVE fact is the THING priced — a currency,
// a metal, a barrel, an index — because those are quoted afresh every day and nothing else here
// is. So a head AND a traded thing, or neither counts.
//
// «بكم» folds to «كم» as well as itself, and only the literal «بكم» is listed — hitWord matches a
// list entry against the folded forms OF THE TEXT, so a bare «كم» in the question never satisfies
// this head. That is the difference between a price question and every «كم» question there is.
const PRICE_HEADS = N(['سعر', 'اسعار', 'بكم', 'قيمه', 'تسعيره', 'سعره']);
const TRADED_THINGS = N([
  'دولار', 'دينار', 'يورو', 'جنيه', 'ريال', 'درهم', 'ليره', 'عمله', 'عملات', 'صرف',
  'ذهب', 'فضه', 'نفط', 'بترول', 'برميل', 'بنزين', 'ديزل',
  'بيتكوين', 'سهم', 'اسهم', 'بورصه', 'مؤشر',
]);

// ── (b3) A CURRENCY AGAINST A CURRENCY — A PRICE QUESTION WITH NO PRICE HEAD ─
// LIVE_WORLD_V2 ONLY. With the flag off not one line below is reachable.
//
// THE MEASURED GAP. «كم يساوي الدولار مقابل الدينار الكويتي اليوم؟» and «كم يساوي اليورو مقابل
// الريال السعودي؟» — the owner's A01 and B09 — both returned NONE. The (b2) price rule could not
// see them and was right not to: it requires a PRICE HEAD («سعر»/«بكم»/«قيمة») beside the traded
// thing, and neither question contains one. A reader asking how much one currency is worth in
// another does not say «سعر» at all; they say «كم يساوي» or just name the two currencies. So the
// shape that carries an exchange-rate question is not the shape that carries a price question,
// and widening PRICE_HEADS to reach it would have swallowed every «كم» question in the language.
//
// IT IS A THIRD TRIGGER OF THE (b2) KIND, held to the (b2) standard: the answer is a different
// number tomorrow, and no memory can hold it. It is NOT a bare topic — naming one currency once
// is not enough, for the reason the whole file is built on (doubt resolves towards not
// searching). «عندي مئة دينار، كم أشتري بها؟» names a currency and is not an exchange-rate
// question, and it does not fire here.
//
// TWO WAYS IN, AND BOTH REQUIRE MORE THAN A CURRENCY:
//   * TWO DIFFERENT currencies in one turn — the question is a conversion by construction;
//   * ONE currency AND an explicit conversion word — «صرف», «تحويل», «يساوي», «يعادل», «مقابل».
// «مقابل» earns its place only in this second role: it is meaningless as a trigger on its own
// and unambiguous beside a currency name.
const FX_CURRENCIES = N([
  'دولار', 'دينار', 'يورو', 'جنيه', 'ريال', 'درهم', 'ليره', 'شيكل', 'ين', 'يوان',
  'روبيه', 'فرنك', 'كرونه', 'روبل', 'بيتكوين',
]);
const FX_CONVERSION_HEADS = N([
  'صرف', 'تحويل', 'حول', 'احول', 'يساوي', 'تساوي', 'يعادل', 'تعادل', 'مقابل', 'بكم',
]);

// ── (b4) THE CLOCK AND THE CALENDAR — AND THEY ARE NOT A SEARCH ──────────────
// LIVE_WORLD_V2 ONLY.
//
// THE MEASURED GAP, AND WHY IT IS THE ODD ONE OUT. «كم تاريخ اليوم؟» (A04) and «أي يوم في
// الأسبوع اليوم؟» (B12) returned NONE, and the answer the reader got was «٢٠٢٥» — the model's
// training year, stated as today's date. That is the same class of failure the rest of this file
// exists for: a question whose answer is different tomorrow, answered from weights.
//
// BUT IT IS THE ONE SUCH QUESTION THAT MUST NEVER REACH A SEARCH, and that is why it returns
// `world: false`. The server already knows the answer exactly — lib/daycap.js's kuwaitDayStamp()
// computes the Kuwait date by arithmetic, with no network and no timezone library — so spending
// a unit of the day's search allowance to read the date off a web page would be slower, less
// reliable and wrong more often than the clock this process is already running on. The reason
// exists to be NAMED in a log line and to be answerable from the date block on the system
// prompt (lib/today-line.js), not to open a retrieval.
//
// THE PHRASES ARE DELIBERATELY NARROW. A bare «اليوم» is the commonest word in a recency marker
// and a bare «يوم» opens «ما هو اليوم العالمي للغة العربية؟», which is a settled fact and not a
// clock question. Every entry therefore pairs a time noun with the frame that asks for its
// current value, and this block is checked LAST, so nothing that already fires can be taken by it.
const CLOCK_PHRASES = N([
  'تاريخ اليوم', 'التاريخ اليوم', 'كم تاريخ', 'ما التاريخ', 'ما هو التاريخ',
  'شنو التاريخ', 'وش التاريخ', 'ايش التاريخ', 'التاريخ الهجري', 'التاريخ الميلادي',
  'اي يوم اليوم', 'اي يوم هذا', 'اي يوم في الاسبوع', 'يوم الاسبوع',
  'شنو اليوم', 'وش اليوم', 'ايش اليوم',
  'كم الساعه', 'الساعه كم', 'شنو الساعه', 'وش الساعه', 'ايش الساعه',
  'كم الوقت', 'كم صار الوقت', 'الوقت الان',
  'في اي شهر نحن', 'اي شهر نحن', 'في اي سنه نحن', 'اي سنه نحن', 'في اي عام نحن', 'اي عام نحن',
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

  // A request for a named person's position is a precision-sensitive factual
  // attribution even when it is timeless. Search this narrow shape so the
  // general model never has to invent the attribution from memory. «ما رأيك»
  // (the reader asking the assistant) does not match because a third-party
  // surface must sit between the frame and «في/عن».
  if (/^(?:ما\s+(?:هو\s+)?(?:راي|قول)|ماذا\s+(?:قال|يقول))\s+.{2,80}\s+(?:في|عن)\s+.+$/u.test(cleaned)) {
    return { world: true, reason: WORLD_REASONS.ATTRIBUTED_POSITION, matched: 'named-position' };
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

  m = hitPhrase(padded, WEATHER_PHRASES) || hitWord(words, WEATHER_TERMS);
  if (m) return { world: true, reason: WORLD_REASONS.WEATHER, matched: m };

  // Both halves, or nothing. The matched string names both so a log line says which pair fired.
  const priceHead = hitWord(words, PRICE_HEADS);
  const priced = hitWord(words, TRADED_THINGS);
  if (priceHead && priced) {
    return { world: true, reason: WORLD_REASONS.MARKET_PRICE, matched: priceHead + ' + ' + priced };
  }

  // FX SITS IMMEDIATELY BELOW MARKET_PRICE AND NOWHERE ELSE. They are siblings — both are a
  // quoted number that moves every day — and the order between them is what keeps «كم سعر الذهب
  // بالدينار؟» a MARKET_PRICE, as it is today, instead of being reclassified by the currency it
  // happens to be quoted in. Everything above this line is likewise untouched: a question that
  // fires as news, weather or an explicit search never reaches here.
  if (liveWorldV2Enabled()) {
    const currencies = FX_CURRENCIES.filter((c) => words.has(c));
    const fxHead = hitWord(words, FX_CONVERSION_HEADS);
    if (currencies.length >= 2 || (currencies.length === 1 && fxHead)) {
      return {
        world: true,
        reason: WORLD_REASONS.FX_RATE,
        matched: currencies.length >= 2
          ? currencies[0] + ' + ' + currencies[1]
          : fxHead + ' + ' + currencies[0],
      };
    }
  }

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

  // THE CLOCK IS CHECKED LAST, ON PURPOSE. Placed anywhere higher it would take questions that
  // already have a correct answer — «ما آخر أخبار اليوم؟» is news and must stay news. Sitting
  // here it can only ever change a verdict that is currently NONE, which is precisely the set
  // it was added for, and `world: false` means it opens no search even so.
  if (liveWorldV2Enabled()) {
    const clock = hitPhrase(padded, CLOCK_PHRASES);
    if (clock) return { world: false, reason: WORLD_REASONS.CLOCK_DATE, matched: clock };
  }

  return { world: false, reason: WORLD_REASONS.NONE, matched: '' };
}

/** Convenience for the request path, which only ever needs the boolean. */
export function needsWorldSearch(raw) {
  return classifyWorldIntent(raw).world;
}

// ── IS THE ANSWER TO THIS QUESTION A NUMBER THAT MOVES? (LIVE_WORLD_V2) ──────
//
// ONE NAME FOR A RULE THAT USED TO HAVE ONE CALLER AND NOW HAS THREE. api/ask.js's world branch
// decides it as `LIVE_QUANTITY || LIVE_QUANTITY_FX` — WEATHER, MARKET_PRICE, FX_RATE — and those
// two lines STAY EXACTLY AS THEY ARE: the first is pinned character for character by
// guards/source-honesty-guard.cjs (check F4) and the second by the kill-switch gate, and editing a
// pinned line to share it would make both pins useless. So the rule is NAMED here, in the module
// that owns the reasons, and every caller written after those lines reads it from here instead of
// restating it. That is the difference between one rule with three readers and three word lists.
//
// THE THREE REASONS AND NO OTHERS:
//   * WEATHER and MARKET_PRICE — a temperature and a price, quoted afresh every day.
//   * FX_RATE — the same kind of fact, added 2026-09-19 and behind the same switch.
// NEWS IS NOT ONE OF THEM. «ما آخر أخبار غزة» wants pages, not a figure, and holding a news
// answer to «a number with a source and a date beside it» would delete ordinary reporting.
// CLOCK_DATE is not one either: it is answered from the server's own clock and opens no search.
//
// AND IT IS FALSE WITH THE FLAG OFF, whatever the question, so a caller that sits behind it is a
// caller that does nothing at all today.
/**
 * @param {string} raw the reader's message, or the search phrase a tool was called with
 * @returns {boolean} true only for the three live-quantity classes, and only under the switch
 */
export function asksLiveNumber(raw) {
  if (!liveWorldV2Enabled()) return false;
  const { reason } = classifyWorldIntent(raw);
  return reason === WORLD_REASONS.WEATHER
    || reason === WORLD_REASONS.MARKET_PRICE
    || reason === WORLD_REASONS.FX_RATE;
}
