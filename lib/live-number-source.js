// lib/live-number-source.js
// A LIVE NUMBER REACHES THE READER WITH A SOURCE AND A DATE BESIDE IT, OR IT DOES NOT REACH THEM.
//
// ── WHY THIS IS A GUARD AND NOT AN INSTRUCTION ──────────────────────────────
// api/ask.js's buildWorldSearchInstruction() already ASKS the model for exactly this: «الرقمُ
// والتاريخُ والنتيجةُ تُنقَلُ من نصِّ النتائجِ أعلاه حرفيًّا… واذكرِ الموقعَ الذي أخذتَ منه». It has
// asked since the open path shipped. And the measured production answer to «كم سعر صرف الدولار
// مقابل الدينار؟» was a number out of an encyclopedia with no date and no attribution. An
// instruction is a request; the model may decline it, soften it, or comply in the first sentence
// and not the third. This module is the part that does not depend on the model agreeing.
//
// ── THE GOVERNING RULE, IN THE OWNER'S WORDS ────────────────────────────────
// «لا رقمَ حيٌّ ولا خبرٌ حيٌّ يُطبَعُ بلا مصدرٍ وتاريخٍ ظاهرَينِ للقارئ.»
// And the enforcement he chose, also in his words: «رقمٌ لا يحملُ مصدرًا يُحذَفُ. لا يُترَكُ
// بتخفيفٍ ولا بتحفُّظٍ ولا بعبارةِ «تقريبًا».» So the action here is DELETION of the sentence, not
// a hedge appended to it. A hedged number is still a number the reader will quote.
//
// ── WHAT A "LIVE NUMBER" IS, AND WHAT IT DELIBERATELY IS NOT ────────────────
// A price, an exchange rate, a percentage, a temperature, an index level, a barrel, a gram — the
// class §٥ names: «سعرٍ أو صرفٍ أو كمّيّةٍ متحرّكة». A number whose value is DIFFERENT TOMORROW.
// It is NOT every numeral: «الركعات أربع», «المادة ١٢», «ثلاثة أسباب» are settled facts, and a
// rule that deleted them would be a rule about arithmetic rather than about recency. The marker
// has to sit beside the digits — a currency, a unit, a percent sign — or the sentence is left
// alone. Under-reaching here is the safe direction: an unmarked number is not the failure this
// was built for.
//
// ── THE RELATIVE DATE ───────────────────────────────────────────────────────
// «أمسِ الثلاثاء», «منذ يومَين», «هذا الأسبوع» are refused on their own, by the owner's decision,
// and for a reason this path makes concrete: a snippet's «أمس» is yesterday relative to a page
// whose own date we may not have, so the reader resolves it against THEIR today and gets a
// different day. The remedy is NOT to compute the absolute date here and write it in — that
// would be inventing a date, which is the sibling of inventing a number. The sentence goes.
//
// ── SENTENCES, NOT THE WHOLE ANSWER ─────────────────────────────────────────
// The unit of removal is the sentence, so a sourced paragraph does not lose its good sentences
// to one bad one. When everything goes, the caller — never this module — writes the server-owned
// «لم أجد» line from lib/policy/live-search-disclosure.js. There is exactly one such sentence in
// this repository and a second one competing with it is the defect that file was written against.
//
// ── AND A SENTENCE DOES NOT GO ALONE WHEN ANOTHER ONE PROMISED IT (2026-09-20) ──
// Measured on the preview, the exchange-rate question: five sentences were removed, `emptied`
// was false, and what the reader was handed was «تفاوتَتِ الأرقامُ قليلًا بينَ المواقعِ، وهذا
// طبيعيٌّ…» and then nothing at all. That is worse than «لم أجد», because it is a promise with
// no delivery — the reader waits for figures that were deleted three milliseconds earlier. The
// second pass below takes the promise with the promised. See THE LEAD-IN, in (g).
//
// ── AND WE DO NOT SEND THE READER SOMEWHERE ELSE (2026-09-20) ───────────────
// The same three preview answers offered XE.com, Kitco.com, Investing, Oilprice and Google as
// places to go and get what this product could not. The owner's ruling is flat: «عزك لا يدلُّ
// قارئَه على خدمةٍ أخرى ليأخذَ منها ما عجزَ هو عنه». The instruction is a request, so the lock is
// here, beside the one for the undated number. See (f).
//
// NO I/O, NO MODEL CALL, NO STATE.

// The registry is the one place a domain has a canonical Arabic name. Reading it here means a
// new admitted source is attributable the day its row lands, with no second table to update.
// It also answers the OTHER question this module now asks — whether a site named in a sentence
// is one of ours at all — so the referral rule in (f) needs no second list of "allowed" hosts.
import { findSource } from './source-registry.js';
// THE ONE DEFINITION OF "THIS LINE ENDS IN A COLON" IN THE PRODUCT, borrowed rather than
// restated. lib/colon-preamble.js is detector D1 itself, adopted byte for byte from the module
// that measured it, and lib/finalize-reader-text.js's own dangling-lead-in repair asks the same
// file the same question. A second colon class here is how two rules come to disagree.
import { COLON_RE } from './colon-preamble.js';

// ── digits ───────────────────────────────────────────────────────────────────
const DIGIT = '[0-9٠-٩]';

// ── (a) THE MARKERS THAT MAKE A NUMBER A LIVE ONE ────────────────────────────
// Each is a unit or a head that only attaches to a quantity that is re-quoted.
//
// EVERY LIST IN THIS FILE IS MATCHED WITH ARABIC WORD BOUNDARIES, NOT AS A SUBSTRING, AND THAT
// IS NOT A STYLISTIC CHOICE. Measured while building this: «طن» matched inside «المنطقة», so
// «اندلع حريق في المنطقة الصناعية ٣» became a sentence quoting a live quantity and was deleted.
// JavaScript's `\b` is defined on [A-Za-z0-9_] and cannot see an Arabic boundary at all — the
// measurement recorded in lib/policy/impermissible-request.js about «فلم» is the same trap — so
// the boundary is spelled out as "start-or-non-letter", with the proclitics Arabic glues on.
const LIVE_UNITS = [
  // currency and money
  'دولار', 'دينار', 'يورو', 'جنيه', 'ريال', 'درهم', 'ليره', 'شيكل', 'يوان',
  'روبيه', 'فرنك', 'كرونه', 'روبل', 'فلس', 'فلسا', 'هلله', 'سنت', 'بيتكوين',
  // metals, energy, and the units they are quoted in
  'برميل', 'جرام', 'غرام', 'اوقيه', 'اونصه', 'جالون', 'لتر',
  // markets
  'نقطه', 'مؤشر', 'سهم', 'اسهم',
  // weather
  'درجه', 'درجات', 'مئويه', 'فهرنهايت',
  // the bare heads, which only count beside digits anyway
  'سعر', 'اسعار', 'سعره', 'صرف', 'قيمته', 'يساوي', 'تساوي', 'يعادل',
];
const PERCENT = /[%٪]/;

// ── (b) WHAT COUNTS AS A DATE THE READER CAN SEE ─────────────────────────────
// A YEAR is the floor: a four-digit year in either digit set. Below that, a day-and-month with
// the month NAMED — both the Levantine/Gulf سبتمبر set and the Iraqi/Levantine تشرين set, because
// a news snippet uses whichever its publisher uses. A bare «١٢/٩» is deliberately NOT a date
// here: without a year it is ambiguous by two centuries and by day/month order.
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس',
  'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر',
  'كانون', 'شباط', 'اذار', 'نيسان', 'ايار', 'حزيران', 'تموز', 'اب',
  'ايلول', 'تشرين',
  // the hijri months, for a source that dates itself that way
  'محرم', 'صفر', 'ربيع الاول', 'ربيع الاخر', 'جمادي', 'رجب', 'شعبان', 'رمضان', 'شوال',
  'ذو القعده', 'ذو الحجه',
];
const YEAR = new RegExp(`(?:^|[^${DIGIT.slice(1, -1)}])(?:1[34]\\d{2}|20\\d{2}|[١٤]٠?\\d{2}|٢٠\\d{2})`, 'u');
const NUMERIC_DATE = new RegExp(`${DIGIT}{1,4}[./-]${DIGIT}{1,2}[./-]${DIGIT}{2,4}`, 'u');

// ── (c) THE RELATIVE DATES THAT MAY NOT STAND ALONE ──────────────────────────
// «اليوم» AND «الليلة» ARE DELIBERATELY ABSENT, and this is a measured decision rather than an
// oversight. The owner's three examples are «أمسِ الثلاثاء», «منذ يومَين», «هذا الأسبوع» — all of
// them POINT AWAY from now, and all of them resolve to a different day depending on when the
// reader reads. «اليوم» is not that word: it is the commonest adverb in the language («خمس
// صلوات في اليوم والليلة»), and listing it deleted settled prose that named no event at all.
// Nothing is lost by its absence either — a sentence that says «سعر اليوم» carries a live number
// and is already held to source-and-date by the rule above.
const RELATIVE_DATES = [
  'امس', 'البارحه', 'اول امس', 'غدا', 'بكره', 'بعد غد',
  'هذا الاسبوع', 'الاسبوع الماضي', 'الاسبوع الحالي', 'الاسبوع المنصرم',
  'هذا الشهر', 'الشهر الماضي', 'الشهر الحالي', 'هذه السنه', 'السنه الماضيه', 'العام الماضي',
  'منذ يومين', 'منذ يوم', 'منذ ايام', 'منذ ساعات', 'منذ اسبوع', 'منذ شهر',
  'قبل يومين', 'قبل ايام', 'قبل ساعات', 'قبل قليل', 'مؤخرا',
];

// ── (d) WHAT COUNTS AS A SOURCE THE READER CAN SEE ───────────────────────────
// TWO WAYS, AND THE SECOND IS THE ONE THAT MATTERS. An ATTRIBUTION FRAME («بحسب…», «وفق…»,
// «أعلن…») is accepted because that is the shape the instruction asks for and the shape a reader
// reads as attribution. But a frame with nothing real behind it is a frame, so the caller also
// hands over the hosts and titles of the pages that were actually retrieved, and naming one of
// those is accepted on its own — «بنك الكويت المركزي» with no «بحسب» in front of it is still a
// source named in a sentence.
const ATTRIBUTION_FRAMES = [
  'بحسب', 'وفق', 'وفقا', 'وفقًا', 'حسب', 'نقلا عن', 'نقلًا عن', 'استنادا الى', 'استنادًا إلى',
  'ذكرت', 'ذكر موقع', 'افادت', 'أفادت', 'اعلن', 'أعلن', 'اعلنت', 'أعلنت', 'نشرت', 'نشر موقع',
  'كما ورد في', 'في نتيجه من', 'في نتيجةٍ من', 'بيانات', 'بحسب ما ظهر',
];

const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// Fold just enough to compare vocabulary: the four alef forms, ya/alef-maqsura, ta-marbuta and
// tatweel. Deliberately NOT lib/route-classify.js's normalizeArabic(), which also strips every
// punctuation mark — and this module has to see «%», «.» and «/» to recognise a date or a rate.
function fold(s) {
  return String(s == null ? '' : s)
    .replace(/[ً-ْٰ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * The host and publisher vocabulary a sentence may name to count as attributed.
 * Built from the pages that were ACTUALLY retrieved for this answer, never from a static list:
 * a source that was not fetched is not a source this answer may claim.
 */
export function sourceVocabulary(sources = []) {
  const out = new Set();
  for (const s of Array.isArray(sources) ? sources : []) {
    const host = String((s && s.host) || '').toLowerCase().replace(/^www\./, '');
    if (host) {
      out.add(host);
      // the registrable label on its own — a reader sees «الجزيرة», not «aljazeera.net», and the
      // model writes what the reader sees.
      const label = host.split('.')[0];
      if (label && label.length >= 3) out.add(label);
      // THE PUBLISHER'S ARABIC NAME, FROM THE REGISTRY AND NOT FROM THE PAGE. lib/source-registry.js
      // already holds one canonical name per admitted domain («بنك الكويت المركزي», «الجزيرة نت»),
      // and that is what a model writes when it attributes in Arabic. Taking it from the page
      // TITLE instead does not work and was measured not working: a title is a whole headline
      // («بنك الكويت المركزي: أسعار صرف العملات العالمية»), and looking for the whole headline
      // inside a sentence finds nothing.
      const row = findSource(host);
      if (row && row.name) out.add(fold(row.name));
    }
    // A page title still contributes its LEADING segment, for a host with no registry row —
    // an open-search result can come from anywhere, and the part before the first colon or dash
    // is the publisher far more often than not.
    const title = collapse(s && s.title);
    if (title) {
      const lead = title.split(/[:–—|»-]/)[0].trim();
      if (lead.length >= 4 && lead.length <= 40) out.add(fold(lead));
    }
  }
  return out;
}

// THE BOUNDARY MATCHER. A phrase counts when it stands as its own word (or words), optionally
// carrying one of the proclitics Arabic glues to the front of a noun, and optionally followed by
// the ordinary noun endings. `\b` is useless here — see the note above LIVE_UNITS.
const PROCLITIC = '(?:و|ف|ب|ل|ك|ال|وال|فال|بال|كال|لل|ولل|بال)?';
const SUFFIX = '(?:ات|ين|ون|ها|هم|ان|ه|ا|ي)?';
const boundaryRe = new Map();
function phraseRe(phrase) {
  let re = boundaryRe.get(phrase);
  if (!re) {
    const esc = fold(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    re = new RegExp(`(?:^|[^\\p{L}])${PROCLITIC}${esc}${SUFFIX}(?:[^\\p{L}]|$)`, 'u');
    boundaryRe.set(phrase, re);
  }
  return re;
}
const hasAny = (folded, list) => list.some((w) => phraseRe(w).test(folded));

/** Does this sentence quote a number whose value moves? */
export function carriesLiveNumber(sentence) {
  const f = fold(sentence);
  if (!new RegExp(DIGIT, 'u').test(f)) return false;
  if (PERCENT.test(f)) return true;
  return hasAny(f, LIVE_UNITS);
}

/** Does this sentence show the reader an absolute date? */
export function carriesAbsoluteDate(sentence) {
  const f = fold(sentence);
  if (NUMERIC_DATE.test(f)) return true;
  if (YEAR.test(f)) return true;
  return hasAny(f, MONTHS_AR) && new RegExp(DIGIT, 'u').test(f);
}

/** Does this sentence lean on a date the reader cannot resolve? */
export function carriesRelativeDate(sentence) {
  return hasAny(fold(sentence), RELATIVE_DATES);
}

/** Does this sentence show the reader where the fact came from? */
export function carriesSource(sentence, vocabulary) {
  const f = fold(sentence);
  if (hasAny(f, ATTRIBUTION_FRAMES)) return true;
  for (const v of vocabulary) if (v && f.includes(v)) return true;
  return false;
}

// ── (e) MARKUP IS NOT PROSE, AND A SOURCE CARD IS NOT A REFERRAL ─────────────
//
// «وميِّزْ بينَ هذا وبينَ بطاقةِ مصدرٍ استشهدَ بها — تلك تبقى، فهي دليلُنا لا إحالةُ عجز.»
//
// A card is a `<source site="…" url="…">` line the SERVER built out of a page it actually
// fetched. Every one of its properties that this module reacts to — a host, a Latin name, a
// date, a figure — is there BECAUSE it is evidence, so a rule written for the model's prose
// would delete the very thing that backs the prose. On both live seats the cards are appended
// AFTER this function returns (api/ask.js's `wOut + '\n' + worldCards…` and the finalizer's
// `readerCards`), so in production no card should ever reach this text at all. The test is here
// anyway, because "should never arrive" is the kind of claim that stops being true quietly, and
// a card deleted by a referral rule would be a far louder defect than one left alone.
//
// The tag names are lib/output-reviewer.js:320's `CARD_TAG_NAMES`, restated with the citation
// exactly as lib/colon-preamble.js:34 restates them, and for the same reason: that module
// imports nothing and must go on importing nothing.
const CARD_TAG_NAMES = 'verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship';
const CARD_OPEN_RE = new RegExp('^\\s*<\\s*/?\\s*(?:' + CARD_TAG_NAMES + ')\\b', 'iu');

/** Is this "sentence" a card the server built, rather than a sentence the model wrote? */
export function isCardLine(sentence) {
  return CARD_OPEN_RE.test(String(sentence == null ? '' : sentence));
}

// ── (f) A PLACE WE SEND THE READER IS NOT A SOURCE WE CITED ──────────────────
//
// MEASURED on the preview, 2026-09-20, in three separate answers: «XE.com», «Kitco.com»,
// «Investing», «Oilprice», «Google» — each offered to the reader as somewhere to go and fetch
// the figure that had just been deleted from under him. The ruling is closed: «هذا ممنوعٌ منعًا
// باتًّا. عزك لا يدلُّ قارئَه على خدمةٍ أخرى ليأخذَ منها ما عجزَ هو عنه.»
//
// TWO THINGS HAVE TO BE TRUE TOGETHER, and the conjunction is the whole safety of this rule:
//
//   1. THE SENTENCE NAMES SOMETHING THAT IS NOT OURS. Not a static blacklist of competitors —
//      those are infinite and a list of five would be evaded by the sixth. The question asked is
//      the one this module already answers twice: is this name among the pages THIS ANSWER
//      retrieved (`sourceVocabulary`), or among the sites the product itself admits
//      (`findSource`)? A "no" to both is by definition somewhere else.
//   2. IT IS OFFERED AS A DESTINATION. A referral frame («يمكنك…», «راجعْ…», «ابحثْ في…») or the
//      bare noun of a destination («موقع», «تطبيق», «منصّة»). Without this half the rule would
//      also delete «بحسب XE.com بلغ السعر…» — which is a DIFFERENT defect (an attribution to a
//      page we never fetched) and is not the one §٣ rules on. Fixing that one here, silently,
//      under this name, is how a rule comes to do something nobody reviewed.
//
// AND THE ALLOWED ALTERNATIVE COSTS NOTHING TO KEEP. «ولكَ أن تدلَّ على الجهةِ الرسميّةِ صاحبةِ
// الرقمِ إن كانتْ في قوائمِنا» — بنك الكويت المركزي for an exchange rate. That body has a registry
// row, so `findSource('cbk.gov.kw')` answers for it and test (1) is already false: the sentence
// survives with no exception written for it.
const REFERRAL_FRAMES = [
  'يمكنك', 'يمكنكم', 'بإمكانك', 'بامكانك', 'عليك ان تراجع', 'ننصحك', 'انصحك',
  'راجع', 'زر', 'تصفح', 'تابع', 'اطلع', 'ادخل', 'استخدم', 'استعمل', 'حمل', 'ابحث', 'انظر',
  'للاطلاع', 'للتحقق', 'لمعرفه', 'للمتابعه', 'تجد', 'ستجد', 'تجدها', 'ستجده', 'متوفر', 'متاح',
  'الرجوع الى', 'بالرجوع الى', 'العوده الى', 'توجه الى',
];
const DESTINATION_NOUNS = [
  'موقع', 'مواقع', 'تطبيق', 'تطبيقات', 'منصه', 'منصات', 'خدمه', 'خدمات',
  'محرك البحث', 'محركات البحث', 'بوابه',
];
// The Latin names measured in the three answers, plus the search engines a referral reaches for
// first. A name here is a shortcut, not the rule: anything domain-shaped is caught by the
// domain test beside it, and everything is still subject to the two conditions above.
const KNOWN_LATIN_SERVICES = new Set([
  'xe', 'kitco', 'investing', 'oilprice', 'google', 'yahoo', 'bing', 'tradingview',
  'bloomberg', 'coinmarketcap', 'binance', 'yandex', 'forexfactory',
]);
// …and the same handful as an Arabic reader writes them. «إكس إي» and «أويل برايس» are here for
// the same reason the Latin set is: the model writes the name in the script it is answering in.
const KNOWN_SERVICES_AR = [
  'جوجل', 'قوقل', 'غوغل', 'ياهو', 'بينج', 'بينغ', 'كيتكو', 'انفستنج', 'اويل برايس',
  'تريدنج فيو', 'بلومبرج', 'بلومبيرغ', 'اكس اي',
];
const LATIN_RUN = /[A-Za-z][A-Za-z0-9.&_-]*/g;
const DOMAIN_SHAPED = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/**
 * The names in this sentence that belong to neither this answer's pages nor the product's own
 * registry. Exported so the gate can ask the question directly instead of inferring it from a
 * deletion.
 */
export function externalServicesIn(sentence, vocabulary = new Set()) {
  const raw = String(sentence == null ? '' : sentence);
  const found = [];
  for (const run of raw.match(LATIN_RUN) || []) {
    const token = run.replace(/[.&_-]+$/, '').toLowerCase();
    if (!token) continue;
    const label = token.split('.')[0];
    const domainish = DOMAIN_SHAPED.test(token) && /\.[a-z]{2,6}$/.test(token);
    if (!domainish && !KNOWN_LATIN_SERVICES.has(token)) continue;
    // OURS, BY EITHER ROUTE: a page this answer actually retrieved, or a site the product admits.
    if (vocabulary.has(token) || vocabulary.has(label)) continue;
    if (findSource(token)) continue;
    found.push(token);
  }
  const f = fold(raw);
  for (const name of KNOWN_SERVICES_AR) {
    if (phraseRe(name).test(f) && !found.includes(name)) found.push(name);
  }
  return found;
}

/** Is this sentence pointing the reader at somebody else's service? */
export function offersExternalService(sentence, vocabulary = new Set()) {
  if (!externalServicesIn(sentence, vocabulary).length) return false;
  const f = fold(sentence);
  return hasAny(f, REFERRAL_FRAMES) || hasAny(f, DESTINATION_NOUNS);
}

// ── (g) THE LEAD-IN GOES WITH WHAT IT LED INTO ───────────────────────────────
//
// «متى حذفَ العقدُ جملةً أو أكثر، فكلُّ جملةٍ قبلَها كانَ معناها التمهيدَ لها تذهبُ معها، حتّى لا
// يبقى وعدٌ بلا مضمون.»
//
// ── WHY THE RULE IS WRITTEN HERE AND NOT CALLED FROM THE FINALIZER ──
// lib/finalize-reader-text.js owns AA-85 and exports its problem code, and the order is explicit
// that its logic is to be CALLED where it stands and neither copied nor edited. It cannot be
// called: `dropDanglingLeadIn` is module-private, and what it does is not what is needed here.
// It works on LINES and only on the NARROW half of D1 — a preamble that is the CLOSING block,
// with nothing whatever behind it in the whole reply — because at that seat the cut happened
// upstream and it has no before-and-after to reason from. Here we have exactly that: this
// function made the cut itself and knows which sentence went and where. So the shared part is
// borrowed at its source — `COLON_RE` from lib/colon-preamble.js, the one colon class in the
// product, which is also the class the finalizer's repair asks about — and the part that is
// this module's own is the three shapes below.
//
// ── THE THREE SHAPES, WHICH ARE THE OWNER'S THREE ──
//   1. it ends in a colon                      «وهذه أسعارُ اليومِ:»
//   2. it speaks OF the figures and gives none «تفاوتَتِ الأرقامُ قليلًا بينَ المواقع»
//   3. it points forward                       «وفيما يلي التفصيل»
//
// SHAPE 2 CARRIES THE ONE DISCRIMINATOR THE OTHER TWO DO NOT NEED, and it is what keeps this
// rule from eating the answer around it: a sentence that merely MENTIONS prices while carrying
// its own source, its own date or its own digits is not a promise — it is a statement, and the
// measured paragraph «بحسب الجزيرة نت في ١٨ سبتمبر ٢٠٢٦، ارتفعت أسعار النفط.» is exactly that.
// It names «أسعار» and it stands whole. Shapes 1 and 3 need no such test: a line that ends in a
// colon, or says «فيما يلي», has promised something regardless of what else it carries.
//
// AND IT READS THE TEXT AS IT STANDS. The DECISION is taken over the folded reading, because
// that is the only way «الأرقامُ» and «الارقام» are one word; the CUT is made on the original
// entry, byte for byte, and every list is matched with the Arabic boundary of `phraseRe` — not
// `\b`, which is the trap this file has measured twice («طن» inside «المنطقة»).
const LEAD_IN_FORWARD = [
  // «التالي» ALONE IS NOT HERE, AND THAT IS MEASURED, NOT AN OVERSIGHT: the proclitic «بـ» that
  // phraseRe rightly allows turns it into «بالتالي» — «therefore» — which introduces nothing and
  // sits in front of a conclusion in every other Arabic paragraph. «على النحو التالي» carries the
  // same sense with none of the collision.
  // AND «على النحو التالي» IS NOT HERE EITHER, for a reason that is about this repository and
  // not about Arabic: section G of guards/live-number-source-guard.cjs reads this file's own
  // strings and refuses every hedge word in it, «نحو» among them, so that a softening phrase can
  // never be introduced here by hand. «كالتالي» and «كالآتي» carry the same sense and collide
  // with nothing.
  'كما يلي', 'فيما يلي', 'كالاتي', 'كالتالي', 'الاتي', 'ادناه', 'اليك', 'اليكم',
  'وهذه هي', 'وهذا ما وجدته', 'اما التفاصيل',
];
const LEAD_IN_SUBJECTS = [
  'ارقام', 'اسعار', 'سعر', 'رقم', 'بيانات', 'تفاصيل', 'معطيات', 'نتائج', 'تقديرات', 'احصاءات',
];

/**
 * Was this sentence's whole meaning to introduce the one after it?
 * Exported so the gate can drive the question without inferring it from a deletion.
 */
export function introducesWhatFollows(sentence, vocabulary = new Set()) {
  const line = collapse(sentence);
  if (!line) return false;
  if (COLON_RE.test(line)) return true;
  const f = fold(line);
  if (hasAny(f, LEAD_IN_FORWARD)) return true;
  if (!hasAny(f, LEAD_IN_SUBJECTS)) return false;
  // …and it has nothing of its own. A figure, a date or an attribution makes it a statement.
  if (new RegExp(DIGIT, 'u').test(f)) return false;
  if (carriesAbsoluteDate(line)) return false;
  if (carriesSource(line, vocabulary)) return false;
  return true;
}

// Sentence boundaries. Newlines split too, because a bulleted answer has one fact per line and
// no full stop anywhere — splitting on «.»/«؟»/«!» alone would treat a whole list as one
// sentence and delete every good line in it along with the bad one.
//
// AND A FULL STOP WITH NO SPACE AFTER IT IS NOT A FULL STOP. Two measured failures of the first
// version of this module, both of the same shape:
//   * «بلغ سعر الصرف 307.350 فلسًا» split into «…307.» and «350 فلسًا». The first half was kept
//     and the second deleted, so the enforcement SHOWED THE READER «307.» — it created a wrong
//     number, which is the precise harm it exists to prevent;
//   * «نشرت cbk.gov.kw جدول…» split inside the host name, and the fragment that carried the
//     attribution was severed from the fragment that carried the figure, so a properly
//     attributed sentence was deleted for being unattributed.
// The rule that fixes both is the one a sentence actually obeys: a full stop ends a sentence
// when white space or the end of the text follows it. A dot glued to the next character is
// inside a number, a host or an abbreviation.
function splitSentences(text) {
  const src = String(text == null ? '' : text);
  const parts = [];
  let buf = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    buf += ch;
    const next = src[i + 1];
    const endsHere = ch === '\n'
      || ((ch === '.' || ch === '؟' || ch === '?' || ch === '!' || ch === '؛')
        && (next === undefined || /[\s)\]»"'،]/u.test(next)));
    if (endsHere) { parts.push(buf); buf = ''; }
  }
  if (buf) parts.push(buf);
  return parts;
}

/**
 * THE CONTRACT.
 *
 * @param {string} text        the model's draft, after the source tags have been stripped
 * @param {object} o
 *   sources  the pages this answer was actually built from ({host, title} each)
 * @returns {{text:string, removed:Array<{sentence:string, why:string}>, emptied:boolean}}
 *   `emptied` is true when the draft had content and none of it survived — the caller then uses
 *   lib/policy/live-search-disclosure.js's sentence, and writes no wording of its own.
 */
export function enforceLiveNumberSourcing(text, { sources = [] } = {}) {
  const draft = String(text == null ? '' : text);
  if (!draft.trim()) return { text: draft, removed: [], emptied: false };

  const vocabulary = sourceVocabulary(sources);
  const entries = splitSentences(draft).map((raw) => ({ raw, dropped: false, why: '' }));

  // ── PASS ONE · EACH SENTENCE ANSWERS FOR ITSELF ───────────────────────────
  for (const entry of entries) {
    const sentence = entry.raw;
    if (!sentence.trim()) continue;
    // A card is the server's own evidence, not the model's prose. See (e).
    if (isCardLine(sentence)) continue;

    // FIRST, because a sentence that sends the reader elsewhere goes whatever else is in it, and
    // because the reason recorded should be the one that decided the deletion.
    if (offersExternalService(sentence, vocabulary)) {
      entry.dropped = true;
      entry.why = 'external-service-referral';
      continue;
    }

    if (carriesLiveNumber(sentence)) {
      const sourced = carriesSource(sentence, vocabulary);
      const dated = carriesAbsoluteDate(sentence);
      if (!sourced || !dated) {
        entry.dropped = true;
        entry.why = !sourced && !dated ? 'live-number-without-source-or-date'
          : !sourced ? 'live-number-without-source' : 'live-number-without-date';
        continue;
      }
    }

    // The relative-date rule is checked on EVERY sentence, not only numeric ones: «اندلع الحريق
    // أمس» is a live claim with an unresolvable date in it, and it is the «خبرٌ حيّ» half of the
    // governing rule.
    if (carriesRelativeDate(sentence) && !carriesAbsoluteDate(sentence)) {
      entry.dropped = true;
      entry.why = 'relative-date-without-absolute';
    }
  }

  // ── PASS TWO · AND NO PROMISE OUTLIVES WHAT IT PROMISED ───────────────────
  // Walking BACKWARDS from each deletion: over blank lines (a promise and its content are often
  // separated by one), over sentences already gone (so the lead-in of a whole RUN of deletions
  // is found, not only of its first sentence), and stopping at the first surviving sentence that
  // is not a lead-in. When one IS removed the walk continues, because a lead-in can itself have
  // been led into — «وهذا ما وجدته:» under «الأرقامُ تختلفُ بينَ المواقع» is two promises deep.
  for (let i = 0; i < entries.length; i += 1) {
    if (!entries[i].dropped) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      const before = entries[j];
      if (!before.raw.trim()) continue;
      if (before.dropped) continue;
      if (isCardLine(before.raw)) break;
      if (!introducesWhatFollows(before.raw, vocabulary)) break;
      before.dropped = true;
      before.why = 'lead-in-to-a-removed-sentence';
    }
  }

  const removed = entries.filter((e) => e.dropped)
    .map((e) => ({ sentence: collapse(e.raw), why: e.why }));
  const out = entries.filter((e) => !e.dropped).map((e) => e.raw).join('')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: out, removed, emptied: out.length === 0 };
}
