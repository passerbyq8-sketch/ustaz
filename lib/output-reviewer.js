// lib/output-reviewer.js — the pure, last-mile answer reviewer.
//
// This module deliberately knows nothing about HTTP, stores, models, routing, or request state.
// Its whole world is the proposed text and the evidence from THIS call. That boundary is what
// makes an attribution from an older turn, a model memory, or a similarly-named scholar useless
// as a licence for the sentence currently being reviewed.

const TAGS = Object.freeze({
  ATTRIBUTION_REMOVED: '【فهمٌ لا نصٌّ منقول】',
  FIQH_UNSOURCED: '【فهمٌ لا فتوى】',
  GENERAL_STABLE: '【معرفةٌ مستقرة غير منقولة】',
});

const LAST_RESORT = 'لم يصلني نصٌّ ولا فهمٌ يمكن الاعتماد عليه في هذه الدورة.';
const DYNAMIC_UNSOURCED = 'لم يصلني مصدرٌ مؤرّخ يمكن أن يثبت هذه المعلومة المتغيّرة في هذه الدورة.';
const KHILAF_TAIL = ' وتُراجَع المسألة مع أهل العلم لظهور الخلاف فيها.';

// ── THE AUTHORITY REGISTRY — DERIVED FROM THE APPLICATION'S OWN SOURCES ─────
//
// WHAT IT REPLACED, AND WHY THAT MATTERED. The first version of this list was five rows written
// from general knowledge: ابن باز, ابن عثيمين, الإسلام سؤال وجواب, دار الإفتاء المصرية, وزارة
// الأوقاف الكويتية. Measured against the shelf this application actually searches, that list was
// wrong in both directions at once:
//
//   * TOO SMALL. lib/fatwa-contract.js holds EIGHTEEN scholars summing to 73,130 published
//     fatwas. Thirteen of them — سليمان الماجد at 17,875 records, عبدالرحمن البراك at 10,740, مشهور
//     آل سلمان, صالح الفوزان, المنجد, ابن جبرين and the rest — had no rule here at all. Every
//     answer that correctly cited one of them had the attribution STRIPPED as unsourced. The
//     reviewer's safe-failure mode was firing on the majority of this application's own corpus.
//   * PARTLY INVENTED. `dar-alifta.org` appears NOWHERE else in this repository: not in
//     lib/fatwa-contract.js, not in lib/source-registry.js, not in any fixture. It was knowledge
//     about the world rather than a fact about this application, and a registry that licenses a
//     host the app never fetches is licensing something it cannot check. Removed.
//     `awqaf.gov.kw` was the same shape of error a level down: the app's measured domain is the
//     narrower `eftaa.awqaf.gov.kw`, and the wider one would have licensed any Kuwaiti ministry
//     host. Narrowed to what is measured.
//
// HOW THESE ROWS ARE PRODUCED. Mechanically, from two files in this tree, by one rule each:
//
//   lib/fatwa-contract.js  FATWA_SCHOLARS — every row. `canonical` is its `name`; `aliases` are
//     its `name`, its `formalName` and its declared `aliases`; `hosts` are its `sourceDomain`,
//     plus any lib/source-registry.js SCHOLAR_SITES domain whose aliases name the same person,
//     plus the multi-host allowance lib/fatwa-service.js `expectedHost` states for مطلق الجاسر;
//     `ids` are its `id:` and `canonicalId:` prefixes.
//   lib/source-registry.js SOURCES — every ACTIVE row whose `kind` is 'fatwa-portal' or
//     'official-fatwa'. Institutions publish fatwas under their own name, not a person's.
//
// IT IS INLINED RATHER THAN IMPORTED, ON PURPOSE. This module is pure by contract — no I/O, no
// ambient state, no imports — and its guards prove that by copying the file alone into a temp
// directory and executing it there. An import would break that harness and would trade a checked
// property for a convenience. The cost of inlining is drift, and drift is what
// guards/attribution-on-output-guard.cjs re-derives and compares on every run: change a scholar's
// domain in lib/fatwa-contract.js without regenerating this table and that gate goes red.
//
// TWO CANONICALS CARRY A CORRECTED NAME AND KEEP THE OLD ONE IN `aliases`. lib/fatwa-contract.js
// states why; what matters here is that dropping the superseded name would strip the attribution
// off every real fatwa the service still publishes under it — «سعد الماجد» and «النجدي الأثري»
// are what its `shortName` returns today, so both must keep licensing their own host.
//
// A NAME WITHOUT A RULE STILL LOSES ITS ATTRIBUTION. That has not changed and must not: matching
// the person while not matching the source is the incident this reviewer exists to prevent.
const AUTHORITY_SOURCES = Object.freeze([
  Object.freeze({
    canonical: 'ابن باز',
    aliases: Object.freeze(['ابن باز', 'بن باز', 'عبدالعزيز بن باز', 'عبد العزيز بن باز']),
    hosts: Object.freeze(['binbaz.org.sa']),
    ids: Object.freeze(['binbaz:', 'ibn-baz:']),
  }),
  Object.freeze({
    canonical: 'عبدالرحمن البراك',
    aliases: Object.freeze(['عبدالرحمن البراك', 'البراك', 'عبد الرحمن البراك']),
    hosts: Object.freeze(['sh-albarrak.com']),
    ids: Object.freeze(['albarrak:', 'al-barrak:']),
  }),
  Object.freeze({
    canonical: 'مشهور آل سلمان',
    aliases: Object.freeze(['مشهور آل سلمان', 'مشهور ال سلمان', 'مشهور بن حسن', 'مشهور حسن']),
    hosts: Object.freeze(['meshhoor.com']),
    ids: Object.freeze(['meshhoor:', 'meshhoor-al-salman:']),
  }),
  Object.freeze({
    canonical: 'سعد الخثلان',
    aliases: Object.freeze(['سعد الخثلان', 'الخثلان']),
    hosts: Object.freeze(['saadalkhathlan.com']),
    ids: Object.freeze(['alkhathlan:', 'saad-al-khathlan:']),
  }),
  Object.freeze({
    canonical: 'مصطفى العدوي',
    aliases: Object.freeze(['مصطفى العدوي', 'مصطفي العدوي', 'العدوي']),
    hosts: Object.freeze(['mostafaaladwy.com']),
    ids: Object.freeze(['aladawy:', 'mostafa-aladwy:']),
  }),
  Object.freeze({
    canonical: 'خالد المصلح',
    aliases: Object.freeze(['خالد المصلح', 'المصلح']),
    hosts: Object.freeze(['almosleh.com']),
    ids: Object.freeze(['almosleh:', 'al-mosleh:']),
  }),
  Object.freeze({
    canonical: 'المفتي عبدالعزيز آل الشيخ',
    aliases: Object.freeze(['المفتي عبدالعزيز آل الشيخ', 'عبدالعزيز ال الشيخ', 'عبد العزيز ال الشيخ', 'المفتي ال الشيخ']),
    hosts: Object.freeze(['af.org.sa']),
    ids: Object.freeze(['almufti:', 'abdulaziz-al-sheikh:']),
  }),
  Object.freeze({
    canonical: 'عثمان الخميس',
    aliases: Object.freeze(['عثمان الخميس', 'الخميس']),
    hosts: Object.freeze(['othmanalkhamees.com']),
    ids: Object.freeze(['othmanalkhamees:', 'othman-alkhamees:']),
  }),
  Object.freeze({
    canonical: 'محمد الحمود النجدي',
    aliases: Object.freeze(['محمد الحمود النجدي', 'محمد النجدي', 'الحمود النجدي', 'عبدالله النجدي الاثري', 'عبد الله النجدي الاثري', 'النجدي الاثري']),
    hosts: Object.freeze(['al-athary.net']),
    ids: Object.freeze(['alathary:', 'al-najdi-al-athary:']),
  }),
  Object.freeze({
    canonical: 'عبدالعزيز الراجحي',
    aliases: Object.freeze(['عبدالعزيز الراجحي', 'عبد العزيز الراجحي', 'الراجحي']),
    hosts: Object.freeze(['shrajhi.com.sa']),
    ids: Object.freeze(['shrajhi:', 'abdulaziz-al-rajhi:']),
  }),
  Object.freeze({
    canonical: 'الإفتاء الكويتية',
    aliases: Object.freeze(['الإفتاء الكويتية', 'اداره الافتاء الكويتيه', 'الافتاء الكويتيه']),
    hosts: Object.freeze(['eftaa.awqaf.gov.kw']),
    ids: Object.freeze(['kuwait_eftaa:', 'eftaa-committee-kw:']),
  }),
  Object.freeze({
    canonical: 'عبدالكريم الخضير',
    aliases: Object.freeze(['عبدالكريم الخضير', 'عبد الكريم الخضير', 'الخضير']),
    hosts: Object.freeze(['af.org.sa']),
    ids: Object.freeze(['alkhudair:', 'al-khudayr:']),
  }),
  Object.freeze({
    canonical: 'صالح الفوزان',
    aliases: Object.freeze(['صالح الفوزان', 'الفوزان']),
    hosts: Object.freeze(['af.org.sa']),
    ids: Object.freeze(['alfawzan:', 'al-fawzan:']),
  }),
  Object.freeze({
    canonical: 'ابن جبرين',
    aliases: Object.freeze(['ابن جبرين', 'بن جبرين', 'عبدالله بن جبرين', 'عبد الله بن جبرين']),
    hosts: Object.freeze(['fatwn.ibn-jebreen.com', 'ibn-jebreen.com']),
    ids: Object.freeze(['ibnjebreen:', 'ibn-jebreen:']),
  }),
  Object.freeze({
    canonical: 'سليمان الماجد',
    aliases: Object.freeze(['سليمان الماجد', 'سليمان بن عبدالله الماجد', 'سليمان بن عبد الله الماجد', 'سعد الماجد', 'الماجد']),
    hosts: Object.freeze(['salmajed.com']),
    ids: Object.freeze(['salmajed:', 'saad-al-majed:']),
  }),
  Object.freeze({
    canonical: 'ابن عثيمين',
    aliases: Object.freeze(['ابن عثيمين', 'محمد بن صالح العثيمين', 'بن عثيمين', 'العثيمين']),
    hosts: Object.freeze(['binothaimeen.net']),
    ids: Object.freeze(['binothaimeen:', 'ibn-uthaymeen:']),
  }),
  Object.freeze({
    canonical: 'محمد صالح المنجد',
    aliases: Object.freeze(['محمد صالح المنجد', 'محمد المنجد', 'المنجد']),
    hosts: Object.freeze(['islamqa.info', 'almunajjid.com']),
    ids: Object.freeze(['almunajjid:']),
  }),
  Object.freeze({
    canonical: 'مطلق الجاسر',
    aliases: Object.freeze(['مطلق الجاسر', 'مطلق جاسر', 'الجاسر']),
    hosts: Object.freeze(['youtube.com', 'youtu.be', 'dr-mutlaq.com']),
    ids: Object.freeze(['aljasser:', 'mutlaq-aljasir:']),
  }),
  Object.freeze({
    canonical: 'إسلام ويب',
    aliases: Object.freeze(['إسلام ويب']),
    hosts: Object.freeze(['islamweb.net']),
    ids: Object.freeze(['islamweb:']),
  }),
  Object.freeze({
    canonical: 'الإسلام سؤال وجواب',
    aliases: Object.freeze(['الإسلام سؤال وجواب']),
    hosts: Object.freeze(['islamqa.info']),
    ids: Object.freeze(['islamqa:']),
  }),
  Object.freeze({
    canonical: 'إدارة الإفتاء - وزارة الأوقاف الكويتية',
    aliases: Object.freeze(['إدارة الإفتاء - وزارة الأوقاف الكويتية']),
    hosts: Object.freeze(['eftaa.awqaf.gov.kw']),
    ids: Object.freeze(['eftaa-kw:']),
  }),
]);

/** Exposed so a guard can re-derive the table from its two sources and compare, row for row. */
export const REVIEW_AUTHORITY_SOURCES = AUTHORITY_SOURCES;

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const HONORIFICS = /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?:فضيلة|سماحة|الشيخ|الإمام|العلامة|الدكتور)(?![\p{Script=Arabic}\p{M}])/gu;
const TOKEN_STOP = new Set([
  'في', 'من', 'إلى', 'على', 'عن', 'أن', 'إن', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك',
  'قال', 'ذكر', 'يرى', 'أفتى', 'بحسب', 'عند', 'وقد', 'كما', 'ثم', 'مع', 'ولا', 'لا',
]);

const FIQH_MARKERS = /(?:حكم|يجوز|لا\s+يجوز|جائز|حلال|حرام|واجب|فرض|سنّة|سنة|مكروه|الصلاة|الصيام|الوضوء|الزكاة|فتوى|شرع|أهل\s+العلم|الراجح|الجمهور|النبي|رسول|الله)/u;
// Source excerpts need an explicit disagreement construction. Standalone preference/majority
// words are deliberately absent: the deposited excerpts use them for ordinary ruling prose too.
// This expression runs only on normalizeArabic(...) output, hence the normalized alef/ta forms.
export const KHILAF_SOURCE_MARKERS = /(?:(?:\u0641\u064a(?:\s+\u0647\u0630\u0647)?\s+\u0627\u0644\u0645\u0633\u0627\u0644\u0647|\u0641\u064a\u0647\u0627?|\u062d\u0648\u0644\u0647\u0627?)\s+\u062e\u0644\u0627\u0641|\u062e\u0644\u0627\u0641\s+(?:\u0628\u064a\u0646|\u0644\u062f\u064a)\s+(?:\u0627\u0647\u0644\s+\u0627\u0644\u0639\u0644\u0645|\u0627\u0644\u0639\u0644\u0645\u0627\u0621|\u0627\u0644\u0641\u0642\u0647\u0627\u0621)|(?:\u0645\u0633\u0627\u0644\u0647|\u0627\u0635\u0644)\s+\u062e\u0644\u0627\u0641\u064a\u0647|\u0645\u0648\u0636\u0639\s+\u062e\u0644\u0627\u0641|\u0627\u062e\u062a\u0644\u0641(?:\u0648\u0627)?(?:\s+\u0641\u064a\u0647\u0627?)?\s+(?:\u0627\u0647\u0644\s+\u0627\u0644\u0639\u0644\u0645|\u0627\u0644\u0639\u0644\u0645\u0627\u0621|\u0627\u0644\u0641\u0642\u0647\u0627\u0621)|(?:\u0627\u0644)?\u0642\u0648\u0644(?:\u0627\u0646|\u064a\u0646)|(?:\u0641\u064a\s+(?:\u0647\u0630\u0647\s+)?\u0627\u0644\u0645\u0633\u0627\u0644\u0647|(?:\u0644\u0627\u0647\u0644\s+\u0627\u0644\u0639\u0644\u0645|\u0644\u0644\u0639\u0644\u0645\u0627\u0621|\u0644\u0644\u0641\u0642\u0647\u0627\u0621))\s+\u0627\u0642\u0648\u0627\u0644|\u0627\u0642\u0648\u0627\u0644\s+(?:\u0627\u062e\u0631\u064a|\u0645\u062a\u0639\u062f\u062f\u0647|\u0645\u0634\u0647\u0648\u0631\u0647))/u;
// Model prose keeps the vocabulary shipped at d0907cb, while source excerpts keep the
// independently calibrated constructions above. The two definite nouns also admit their
// construct-state spelling without «ال»: «راجح القولين» and «جمهور الفقهاء». The bounded export
// below remains responsible for accepting an attached conjunction and rejecting every other
// attached Arabic letter.
const RAW_KHILAF_PROSE_MARKERS = /(?:خلاف|اختلف|قولان|أقوال|(?:ال)?راجح|(?:ال)?جمهور|بعض\s+أهل\s+العلم)/u; // KHILAF_IDAFA_OPTIONAL_ARTICLE
export const KHILAF_PROSE_MARKERS = new RegExp(
  `(?<![\\p{Script=Arabic}\\p{M}])(?:[وف])?(?:${RAW_KHILAF_PROSE_MARKERS.source})(?![\\p{Script=Arabic}\\p{M}])`,
  RAW_KHILAF_PROSE_MARKERS.flags,
);
// ── A VARIABLE CLAIM IS A CLAIM ABOUT NOW, AND IT IS TWO THINGS AT ONCE (§١) ─
//
// WHAT THIS USED TO BE, AND WHAT IT COST. One flat alternation of seventeen markers, ANY ONE of
// which was enough to declare a sentence a claim about the changing world and REPLACE it — the
// whole sentence, deleted, and DYNAMIC_UNSOURCED put in its place. On the owner's twenty-question
// battery that fired eight times, twice inside one worked equation and four times inside another,
// so a reader watching «٢س + ٥٠ = ٥٥» being solved read «لم يصلني مصدرٌ مؤرّخ…» between the lines
// of the solution.
//
// MEASURED, over all eighty answers of that battery (tools/reviewer-dynamic-measure.mjs): the old
// alternation fires on FOURTEEN sentences, and not one of the fourteen is a variable claim. Every
// hit, named by the marker that produced it:
//
//   أحدث   ×٣  «إن كان قد أحدثَ ثمّ توضّأ ومسحَ وهو مقيمٌ» — the VERB «broke his ablution»,
//              written with the same letters as the elative «latest». All three are inside one
//              ruling on wiping over the khuff.
//   الآن   ×٤  «مَنْ كَانَ فِي المَرْكَزِ الأَخِيرِ صَارَ الآنَ خَلْفَكَ» in a race riddle, and
//              «وهو حيٌّ الآن» about ʿĪsā — a discourse adverb, and a creedal constant.
//   سعر    ×٣  «فسعر الدلاغ إذن دينار ونصف الدينار» — the unknown of a two-equation word problem.
//   اليوم  ×٢  «عليه قضاء ذلك اليوم كاملًا» — «that day» of a broken fast, not «today».
//   أخبار  ×١  «وهذه الصفة ثبتت في الأخبار الصحيحة عن النبيّ» — transmitted reports, not news.
//   أسعار  ×١  «مسألة حسابية لا علاقة لها بأسعار حقيقية» — a sentence that says, in so many
//              words, that it is NOT about real prices.
//
// Fourteen fires and fourteen false. That is not a rule with a bug in it; it is a rule measuring
// the wrong thing.
//
// WHAT IT MEASURES NOW. The remedy this rule reaches for is a DATED source, so the only claim it
// may reach is one a date could settle — and a claim a date can settle is a claim pinned to a
// time. The trigger is therefore the conjunction of the two halves the old list already contained
// and never told apart:
//
//   DYNAMIC_WHEN   the claim is asserted about the present — «اليوم», «الآن», «حاليًا», «أحدث»,
//                  «آخر خبر», «هذا الأسبوع».
//   DYNAMIC_WHAT   the thing claimed is one that changes — a price, a rate, a temperature, a
//                  result, a count, the news.
//
// NOT ONE MARKER WAS ADDED, AND THAT IS CHECKABLE. The union of the two patterns below is exactly
// the alternation it replaces, so every sentence the new rule fires on is one the old rule fired
// on too: this is a narrowing and can be proved to be one. guards/domain-contract-guard.cjs holds
// the old alternation verbatim and asserts the containment over the measured corpus.
//
// All fourteen die because each carried one half and never the other. The witness that must NOT
// die carries both — «درجة الحرارة اليوم في الكويت ٣٨ مئوية» — and still fires.
const DYNAMIC_WHEN = /(?:اليوم|الآن|حالي[ًاا]?|أحدث|آخر\s+(?:خبر|الأخبار|سعر|نتيجة)|هذا\s+(?:الأسبوع|الشهر|العام))/u;
const DYNAMIC_WHAT = /(?:طقس|درجة\s+الحرارة|سعر|أسعار|نتيجة|أخبار|خبر\s+عاجل|بورصة|سهم|سعر\s+الصرف|عدد\s+الإصابات)/u;

// ── AND IT NEVER REACHES A CALCULATION (§١) ─────────────────────────────────
// «ضيِّقْ كاشفَ الادّعاءِ المتغيّرِ حتى لا يبلغَ حسابًا ولا استدلالًا ولا حقيقةً ثابتة». The
// conjunction above already keeps this rule off a deduction and off a stable fact: neither is
// pinned to now, which is why «تجاوزُ الأخيرِ محال» and «وهو حيٌّ الآن» are both out of its reach.
// A worked sum is the one shape that can carry both halves at once — «سعر الجوتي اليوم = س + ٥٠»
// is a price, today, and an equation — and it is exactly the shape the owner read a refusal
// driven through. So it is excluded, and excluded STRUCTURALLY: by what the sentence contains, a
// digit standing next to an arithmetic operator or the Arabic algebraic unknown standing before
// one. Never by a list of words, because a list of words is how this rule broke in the first place.
//
// AND THE HYPHEN IS NOT AN OPERATOR UNTIL IT IS SPACED. `[0-9]\s*-` looks like subtraction and is
// «2026-08-16» far more often. A date is the one thing this rule most needs to keep reaching, so
// a bare hyphen touching a digit exempts nothing; only a hyphen with air on both sides of it,
// between two numbers, is a subtraction. `=` needs no such care: it does not occur in Arabic
// prose at all, and where it does occur the sentence is a calculation by that fact alone.
const CALCULATION_RE = /=|[0-9٠-٩]\s*[×÷]|[×÷]\s*[0-9٠-٩]|[0-9٠-٩]\s*\+\s*[0-9٠-٩]|[0-9٠-٩]\s+[-−–*/]\s+[0-9٠-٩]|(?<![\p{Script=Arabic}\p{M}])(?:[وف])?[سص]\s*[+\-−–×÷*/]/u;

/**
 * §١'s whole test, in one place, so a guard can name the property it checks rather than infer it.
 * @returns {boolean} true only for a claim about a changing world that a dated source could settle.
 */
function isVariableClaim(sentence) {
  if (CALCULATION_RE.test(sentence)) return false;
  return DYNAMIC_WHEN.test(sentence) && DYNAMIC_WHAT.test(sentence);
}
// ── ONE WRITER, AND THIS IS HOW IT IS PROVED (§٥/١) ─────────────────────────
// This pattern used to spell all three tags out a second time, by hand, a hundred and ninety
// lines below the frozen constant that defines them. Nothing kept the two copies in step, and the
// drift would have been silent in the worst direction: change a tag in TAGS and not here, and
// `tag()` can no longer recognise its own mark, so every already-tagged sentence is tagged AGAIN
// on the next pass. It is derived from TAGS now, and TAGS is therefore the only place in this
// repository where the text of a review tag is written. The only other occurrences anywhere in
// the tree are guard assertions and fixtures, which READ the tag rather than emit it.
const VISIBLE_TAG = new RegExp(Object.values(TAGS).map(escapeRegex).join('|'), 'u');

// ── A TAG IS THE SAME TAG WHEN IT IS SPELLED WITH DIFFERENT HARAKAT (M1+M2 night 3, task 4) ──
//
// `VISIBLE_TAG` above is an exact-string alternation, so the sentence mark written with one
// haraka more or less than the frozen constant is invisible to it and the answer receives a
// SECOND mark saying the same thing. Measured by the P2 packet: a variant tashkeel form of the
// sentence mark escaped de-duplication entirely.
//
// The comparison is therefore made on the diacritic-stripped text, through ARABIC_DIACRITICS —
// the normalization this module already owns. No second normalizer is introduced: strip, then
// compare, and every reader of a tag below goes through these three functions.
function withoutMarks(value) {
  return String(value ?? '').replace(ARABIC_DIACRITICS, '');
}
/** Every tag of the vocabulary this text carries, in any spelling variant. */
function tagsCarriedBy(value) {
  const plain = withoutMarks(value);
  return Object.values(TAGS).filter((visibleTag) => plain.includes(withoutMarks(visibleTag)));
}
/** True when this text already carries THIS tag, however it is vowelled. */
function carriesTag(value, visibleTag) {
  return withoutMarks(value).includes(withoutMarks(visibleTag));
}

// ── WHAT IS ANSWER PROSE, AND WHAT ONLY LOOKS LIKE IT (§٥/٢) ────────────────
// MEASURED at this function's own doorstep, not guessed from the shape of a line. Four real
// answers to the owner's four questions were captured as they arrived here
// (tools/reviewer-scope-capture.mjs). What arrives is ONE flat string; its structure is carried
// inline, in the card markup the client parses back out — index.html's EZIK_CARD_TAG_RE lists
// exactly the ten names below. Those four answers split into 48 segments, and 27 of them were not
// answer prose at all — 21 sentences of answer carried 47 stamps between them:
//
//   * `<suggestions>` blocks — in 4 answers of 4. Their items are the chips under the reply
//     («ماذا لو خلعت الدلاغ؟»). A chip is the reader's NEXT QUESTION; marking it «understanding,
//     not fatwa» says a question is an unsourced ruling.
//   * `<hadith>` blocks — in 2 of 4, one of them the very narration the owner reported seeing
//     tagged: «لَا يَنْصَرِفْ حَتَّى يَسْمَعَ صَوْتًا أَوْ يَجِدَ رِيحًا». Transmitted text marked
//     as understanding-rather-than-text is the plainest form of the defect.
//   * `<steps title="…">` — the attribute is a heading («ما تفعله عند نسيان التشهد الأول») and
//     the items under it are instructions inside a card body.
//   * The bare markup lines themselves. `<suggestions>` alone on its line was a segment; it is a
//     non-empty string, so it was tagged, and the client then strips the markup — leaving a line
//     that is the tag and nothing else. That is the owner's third witness and it had no other
//     cause.
//
// AND THIS IS WHERE THE TWO SPELLINGS CAME FROM. index.html:9152 states the rule plainly: the
// tashkeel toggle applies `stripTashkeelOutsideQuran` to `seg.type==='text'` and to NOTHING else,
// because card bodies are drawn verbatim. So a tag appended to a `<hadith>` line keeps its tanwīn
// while the same tag on prose loses it. Two spellings in one answer, from one frozen constant.
// The owner's fourth witness is not a second writer — it is this defect seen through the toggle,
// and it dies when the tag stops landing inside card bodies.
const CARD_TAG_NAMES = 'verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship';
const CARD_TAG_RE = new RegExp('<(/?)(?:' + CARD_TAG_NAMES + ')\\b[^>]*>', 'iu');
const CARD_NAME_RE = /^<\/?\s*([a-z]+)/iu;
// Scripture between the ornate parentheses is the client's own boundary for «leave this
// byte-for-byte» (index.html:3073). The reviewer honours the same one, and honours it for a whole
// segment: a sentence that quotes an ayah inline is still a sentence carrying quoted scripture,
// and stamping it is the first witness again in a different costume.
const QURAN_SPAN_RE = /\uFD3F[\s\S]*?\uFD3E/u;
// A markdown heading announces a section; it asserts nothing. Neither does a segment with no
// letter and no digit in it — a stray `**`, a rule, a lone bullet the split left behind. Both are
// decided by WHAT THE SEGMENT IS, never by how long it is or what it happens to say.
const MD_HEADING_RE = /^#{1,6}\s+\S/u;
const NO_CONTENT_RE = /^[^\p{L}\p{N}]*$/u;

// ── THE NOTICE, ONCE PER ANSWER (§٥/٣) ──────────────────────────────────────
// The rule does not change: a ruling with no source in hand is still DELIVERED, and still
// delivered marked. What changes is that the mark is a notice about the answer instead of a seal
// stamped on every sentence of it. Ninety-six stamps on one reply (measured on the platform,
// 12:46:07Z) told the reader nothing ninety-five of them had not already told him.
//
// Each notice carries its tag exactly once, read from TAGS, and carries a sentence with it — so
// no line in a reviewed answer is ever the bare tag.
const NOTICES = Object.freeze({
  FIQH_UNSOURCED: TAGS.FIQH_UNSOURCED
    + ' ما تقدّم فهمٌ مبنيٌّ على ما بين يديّ في هذه الدورة، لا فتوى مُسنَدةٌ إلى مفتٍ بعينِه.',
  GENERAL_STABLE: TAGS.GENERAL_STABLE
    + ' ما تقدّم معرفةٌ عامّةٌ مستقرّة، لا نصٌّ منقولٌ عن مصدرٍ بعينِه.',
});

function normalizeArabic(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[٠-٩۰-۹]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) % 10))
    .replace(/[إأآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ـ/gu, '')
    .replace(HONORIFICS, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function tokens(value) {
  return normalizeArabic(value).split(' ').filter((token) => token.length > 1 && !TOKEN_STOP.has(token));
}

function evidenceField(item, names) {
  for (const name of names) {
    if (typeof item?.[name] === 'string' && item[name].trim()) return item[name].trim();
  }
  return '';
}

function evidenceView(item, index) {
  const url = evidenceField(item, ['url', 'link', 'href']);
  const id = evidenceField(item, ['id', 'identifier']);
  return {
    raw: item,
    index,
    id: id || url || `evidence-${index + 1}`,
    title: evidenceField(item, ['title', 'heading']),
    url,
    identifier: id,
    scholar: evidenceField(item, ['scholar', 'authority', 'entity', 'body', 'publisher']),
    snippet: evidenceField(item, ['snippet', 'excerpt', 'passage', 'text']),
    date: evidenceField(item, ['date', 'publishedAt', 'published_at', 'retrievedAt', 'retrieved_at']),
    // ع-٥٥ — THE TWO FIELDS THE BOOK BRANCH BELOW NEEDS, AND NOTHING DERIVED FROM ANYTHING ELSE.
    // Every other line here reads a LIST of names because the same fact reaches this reviewer
    // under several spellings. These two read ONE name each, deliberately: `author` must not
    // fall back to `publisher`. The two hold the same string in today's book row
    // (lib/free-brain/tools.js:447 and :456) and no contract keeps them equal, so a fallback
    // list would quietly let a publisher's name license an attribution to a man.
    kind: evidenceField(item, ['kind']),
    author: evidenceField(item, ['author']),
  };
}

// ── ع-٤٩/§٣-٤: WAS A BOOK IN THIS TURN'S HANDS? ────────────────────────────
//
// «معرفةٌ مستقرة غير منقولة» says, about the whole answer, that nothing was quoted into it. When a
// library atom is among the evidence the answer rested on, that footer is false in the reader's
// own reply: the material WAS transmitted, from a named book by a named author, and a chip saying
// so is drawn beneath the very sentence the footer denies.
//
// THE TEST IS THE ROW'S OWN IDENTITY AND NOTHING ELSE. `lib/lib-service.js` stamps every library
// record `lib:<atom_id>`, and `lib/free-brain/loop.js` carries that id across as the evidence id —
// so this reads a field the evidence already has rather than inferring a kind from a snippet.
// A book row is the only thing in this application that identifies itself this way.
//
// IT SUPPRESSES ONE FOOTER AND CHANGES NOTHING ELSE. Not one sentence's own verdict moves: the
// per-sentence annotations, the fiqh footer and the khilaf tail are all untouched, so this cannot
// turn an unsourced ruling into a sourced one.
const LIB_EVIDENCE_ID = /^lib:/;
const sawBookEvidence = (sources) => (sources || [])
  .some((source) => LIB_EVIDENCE_ID.test(String((source && source.id) || '')));

// ── WHOLE WORDS, NOT RAW SUBSTRINGS ─────────────────────────────────────────
// MEASURED the moment the registry grew from five rows to twenty-one: «عبدالعزيز الراجحي»
// resolved to «المفتي عبدالعزيز آل الشيخ», so a genuine al-Rajhi fatwa on his own domain lost its
// attribution — the one false strip in an otherwise clean 18/18.
//
// The chain is worth writing down because neither half is obviously wrong on its own.
// `normalizeArabic` strips «الشيخ» as an honorific, which is right for «قال الشيخ ابن باز» and
// wrong for «آل الشيخ», where it is half of a family name: the alias folds to «عبدالعزيز ال».
// Raw `includes` then found that inside «عبدالعزيز الراجحي», because «الراجحي» begins with «ال».
//
// Whole-word containment is the idiom this codebase already uses for exactly this hazard —
// `containsWhole` in lib/fatwa-contract.js and `containsWords` in lib/source-registry.js, both
// written so «العباد» matches «عبدالمحسن العباد» and not «العبادات». Same rule, same reason.
function containsWholeWords(haystack, needle) {
  if (!haystack || !needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

function authorityRule(name) {
  const wanted = normalizeArabic(name);
  if (!wanted) return null;
  return AUTHORITY_SOURCES.find((rule) => rule.aliases.some((alias) => {
    const candidate = normalizeArabic(alias);
    return candidate === wanted
      || containsWholeWords(candidate, wanted)
      || containsWholeWords(wanted, candidate);
  })) || null;
}

function sameAuthority(claimed, evidenceScholar) {
  const a = normalizeArabic(claimed);
  const b = normalizeArabic(evidenceScholar);
  if (!a || !b) return false;
  const rule = authorityRule(claimed);
  if (rule) return rule.aliases.some((alias) => normalizeArabic(alias) === b);
  return a === b;
}

function officialSourceFor(claimed, evidence) {
  const rule = authorityRule(claimed);
  if (!rule) return false;
  let host = '';
  try {
    const parsed = new URL(evidence.url);
    if (parsed.protocol !== 'https:') return false;
    host = parsed.hostname.toLowerCase().replace(/^www\./u, '');
  } catch { /* identifier */ }
  const hostMatches = rule.hosts.some((allowed) => host === allowed || host.endsWith('.' + allowed));
  const id = evidence.identifier.toLowerCase();
  const idMatches = rule.ids.some((prefix) => id.startsWith(prefix));
  return hostMatches || idMatches;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function aliasPattern(alias) {
  const marks = '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]*';
  return Array.from(alias).map((char) => {
    if (/\s/u.test(char)) return '\\s+';
    if (char === 'ا') return '[اأإآٱ]' + marks;
    if (char === 'ي') return '[يى]' + marks;
    return escapeRegex(char) + marks;
  }).join('');
}

function stanceSet(value) {
  let body = ` ${normalizeArabic(value)} `;
  const found = new Set();
  const take = (pattern, stance) => {
    if (pattern.test(body)) found.add(stance);
    pattern.lastIndex = 0;
    body = body.replace(pattern, ' ');
  };
  // Negated forms go first so «غير جائز» cannot also count as an affirmative «جائز».
  take(/(?:لا يجوز|غير جائز|ليس جائزا|حرام|يحرم|تحريم|حظر|منع)/gu, 'forbidden');
  take(/(?:لا يجب|غير واجب|ليس واجبا|عدم وجوب)/gu, 'not-obligatory');
  take(/(?:جائز|يجوز|جواز|مباح|اباحه|اباح)/gu, 'allowed');
  take(/(?:واجب|يجب|وجوب|فرض)/gu, 'obligatory');
  take(/(?:مكروه|كراهه)/gu, 'disliked');
  take(/(?:مستحب|استحباب|مندوب)/gu, 'recommended');
  return found;
}

function numericFacts(value) {
  return [...new Set(tokens(value).filter((token) => /^\d+$/u.test(token)))];
}

function supportsSentence(sentence, evidence) {
  const claimTokens = [...new Set(tokens(sentence))];
  // A topical title is not the page's ruling. When a snippet exists it must carry the overlap;
  // only an evidence shape with no excerpt at all may fall back to its title.
  const sourceTokens = new Set(tokens(evidence.snippet || evidence.title));
  if (!claimTokens.length || !sourceTokens.size) return false;
  const overlap = claimTokens.filter((token) => sourceTokens.has(token)).length;
  if (overlap < Math.min(2, claimTokens.length)) return false;
  const sourceText = evidence.snippet || evidence.title;
  if (!numericFacts(sentence).every((fact) => numericFacts(sourceText).includes(fact))) return false;
  const claimStances = stanceSet(sentence);
  const sourceStances = stanceSet(sourceText);
  if (claimStances.size && ![...claimStances].some((stance) => sourceStances.has(stance))) return false;
  return true;
}

function khilafExcerpt(evidence) {
  return evidence.snippet; // KHILAF_EXCERPT_ONLY
}

function sourceDeclaresKhilaf(evidence) {
  const excerpt = khilafExcerpt(evidence);
  return Boolean(excerpt && KHILAF_SOURCE_MARKERS.test(normalizeArabic(excerpt)));
}

function sourceSupportsKhilaf(sentence, evidence) {
  return supportsSentence(sentence, evidence) && sourceDeclaresKhilaf(evidence);
}

function modelProseDeclaresKhilaf(sentence) {
  const withoutDiacritics = String(sentence ?? '').replace(ARABIC_DIACRITICS, '');
  return KHILAF_PROSE_MARKERS.test(withoutDiacritics); // MODEL_PROSE_KHILAF_BROAD_BOUNDED
}

function khilafTriggerFor(khilafFromSource, khilafFromOpinions, khilafFromModelProse) {
  if (khilafFromSource && khilafFromOpinions === true) return 'both';
  if (khilafFromSource) return 'source';
  if (khilafFromOpinions === true) return 'opinions';
  if (khilafFromModelProse) return 'prose';
  return null;
}

// The frame ends at a connector or punctuation. Capturing the frame separately lets us remove the
// attribution without performing surgery on the claim that follows it.
//
// ── ع-٧٤/أ · THE CUE-FIRST NAME IS BOUNDED IN WORDS, AND STOPS ON A VERB ────
//
// THE DEFECT, MEASURED ON THE OWNER'S OWN SENTENCE. The first two patterns read the CUE first,
// so everything after «قال» is a candidate name, and the class ran on for up to 55 characters
// across spaces until it found a «،». On:
//
//   «قال ابن باز يحرم حلق اللحية، لأنه استئصال للحية ومخالفة للسنة»
//
// it captured «ابن باز يحرم حلق اللحية» — the RULING swallowed into the name. Cutting that frame
// left «لأنه استئصال…», a causal clause with nothing in front of it, so removalBreaksSentence
// refused the removal and the whole credit stayed in front of the reader, merely marked. The
// door was never wrong; it was being asked about the wrong span.
//
// SO THE NAME TAKES AT MOST FIVE FURTHER WORDS, LAZILY, AND NO WORD MAY BE A STOP VERB. The stop
// list is the seven cue verbs plus the seven ruling verbs a name can never contain — «يحرم» is
// the one that mattered here. With the name bounded to «ابن باز», the remainder opens on its own
// ruling verb, nothing breaks, and the name goes while the ruling stays.
//
// AND PATTERN 1 MAY ALSO END IMMEDIATELY BEFORE A STOP VERB, not only at «:» or «،». Without
// that, narrowing the class merely makes the pattern FAIL on this shape, and a name no registry
// knows — «قال محمد الفلاني يحرم حلق اللحية…» — reaches the reader whole with no capture at all.
// Measured both ways: with the terminator, that sentence loses its credit like every other.
//
// The other five patterns keep the old class: their right-hand side is already anchored on a
// ruling word or on the verb itself, so there is nothing for a name to run into.
//
// ── ع-٧٤/ب · THE SEVENTH MAY ALSO END ON THE CLAIM ITSELF ───────────────────
//
// MEASURED: «ابن قدامة فقال الأمر في هذا واسع» — a name, a verb joined to its فاء, and then the
// claim, with neither a colon nor «إن/أن/بأن» between them — matched no pattern at all. What
// happened next depended on who he was, and both outcomes were wrong. A REGISTERED name fell to
// the AUTHORITY_SOURCES fallback below, which cuts the bare name and leaves «فقال الأمر في هذا
// واسع» — a verb with nobody in front of it. An unregistered one lost nothing: the credit reached
// the reader whole, with the answer-level notice standing in for a judgement never made.
//
// So the seventh gains a third way to end, beside the connector and the punctuation: the claim
// beginning on an Arabic letter. The frame still closes AFTER the verb, so the delivered sentence
// starts on «الأمر في هذا واسع» and the verb goes with the name it belonged to.
//
// ITS NAME CLASS IS DELIBERATELY NOT NARROWED WITH THE OTHER TWO. That was tried and measured:
// a bounded class truncates «الشيخ محمد بن صالح العثيمين رحمه الله فصل» to its last few words,
// the removal then breaks the sentence, and A2 flips back from removed to marked. Here the verb
// alternation is what bounds the name, and it does the job the word bound does over there.
const ATTRIBUTION_PATTERNS = Object.freeze([
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>(?:قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}]*(?:\s+(?!(?:يحرم|يجوز|يجب|يكره|يستحب|يصح|يبطل|قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)(?![\p{Script=Arabic}\p{M}]))[\p{Script=Arabic}][\p{Script=Arabic}\p{M}]*){0,5}?))\s+(?<connector>إن|أن|بأن)\s+/u,
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>(?:قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}]*(?:\s+(?!(?:يحرم|يجوز|يجب|يكره|يستحب|يصح|يبطل|قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)(?![\p{Script=Arabic}\p{M}]))[\p{Script=Arabic}][\p{Script=Arabic}\p{M}]*){0,5}?))(?:\s*[:،]\s*|\s+(?=(?:يحرم|يجوز|يجب|يكره|يستحب|يصح|يبطل|قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)(?![\p{Script=Arabic}\p{M}])))/u,
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>(?:بحسب|عند)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}\s]{1,55}?))\s*[:،]\s*/u,
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>وفق(?:ًا|ا)?\s+ل(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}\s]{1,55}?))\s*[:،]\s*/u,
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>(?:قول|رأي|فتوى)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}\s]{1,55}?))\s+(?<connector>إن|أن|بأن)\s+/u,
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>(?:يرى|ذهب)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}\s]{1,55}?))\s+(?=(?:جواز|وجوب|حرمة|تحريم|منع|استحباب|كراهة)(?![\p{Script=Arabic}\p{M}]))/u,
  /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?<frame>(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\p{M}\s]{1,55}?)\s+(?:[وف])?(?:ق\p{M}*ا\p{M}*ل\p{M}*|ذ\p{M}*ك\p{M}*ر\p{M}*|أ\p{M}*ف\p{M}*ت\p{M}*ى\p{M}*|أ\p{M}*ج\p{M}*ا\p{M}*ب\p{M}*|ي\p{M}*ر\p{M}*ى\p{M}*|ت\p{M}*ق\p{M}*و\p{M}*ل\p{M}*|ق\p{M}*ا\p{M}*ل\p{M}*ت\p{M}*))(?:\s+(?<connector>إن|أن|بأن)\s+|\s*[:،]\s*|\s+(?=[\p{Script=Arabic}]))/u,
]);

// ── «عندَ» IS TWO DIFFERENT WORDS, AND THE DIFFERENCE IS WHAT FOLLOWS IT (§٢/١)
//
// «عندَ الحنفيّةِ كذا» credits somebody. «عندَ الوضوءِ كذا» says WHEN. The particle is the same
// particle; only what follows it decides, and the third frame above read the particle alone. That
// is not a hypothetical: guards/tag-honesty-guard.cjs carried «…لأن العبرة بحاله عند المسح: وقد
// مسح وهو مقيم…» as a witness of a REMOVED attribution — a plain Arabic adverbial, «at the time of
// wiping», classified as a credit to a scholar named «المسح» and cut out of the sentence. The
// defect was registered a round ago and shipped anyway; this is where it is measured instead.
//
// SO THE AMBIGUOUS PARTICLES MUST POINT AT A PERSON, AND THE UNAMBIGUOUS ONES NEED NOT. «قال فلانٌ
// إنّ…» is a credit whoever فلان is — that is why a name with no rule in the registry still loses
// its attribution, and none of that is softened here. «عند X» earns the same treatment only when X
// reads as a specific person: a name the registry knows, a name carrying a title, or a name built
// on the particles Arabic personal names are built on.
//
// A SCHOOL IS NOT A MAN, AND THIS REPOSITORY ALREADY SAYS SO. lib/policy/entities.js:103 states it
// for the router in the same words — «عند الحنابلة» asks what a madhhab holds, and the answer is a
// body of transmitted doctrine, not one person's fatwa, «so it may never take a person-attribution
// template and may never be routed to somebody's official site». A madhhab therefore fails the
// person test on purpose and not by accident: there is no official source that could ever license
// it, so classifying it as a person-credit would mean stripping it from every sentence it ever
// appears in. It is carried whole, and the answer-level notice is what tells the reader it is
// understanding rather than a sourced fatwa. Asserted, not left to chance, in tag-honesty-guard.
const AMBIGUOUS_PARTICLE_RE = /^(?:عند|بحسب)\s/u;
const PERSON_TITLE_RE = /(?:فضيلة|سماحة|الشيخ|الإمام|العلامة|الدكتور|المفتي)\s/u;
const PERSON_NAME_RE = /(?:^|\s)(?:ابن|بن|أبو|أبي|أبا|آل)\s|^عبد/u;

function framePointsAtAPerson(frame, claimed) {
  if (!AMBIGUOUS_PARTICLE_RE.test(String(frame ?? ''))) return true;
  if (PERSON_TITLE_RE.test(String(frame ?? ''))) return true;
  if (PERSON_NAME_RE.test(claimed)) return true;
  return Boolean(authorityRule(claimed));
}

// ── THE PROPHET, PEACE BE UPON HIM, IS NOT A SCHOLAR CREDIT (M1 night 2, task 1) ──
//
// MEASURED 2026-09-02: «أن النبي صلى الله عليه وسلم قال: «إنما الأعمال بالنيات»» was captured by the
// name-first pattern as a credit to a scholar named «أن النبي صلى الله عليه وسلم», no evidence in the
// bag licensed him, and the ascription was cut — the reader received the matn alone, stamped as the
// machine's own understanding. That is a false statement about revealed text.
//
// A frame that names the Prophet is therefore never a removable credit: the pattern loop skips it
// exactly as it skips an adverbial «عند الوضوء», and the sentence is carried whole. It is NOT routed
// to the marked branch either — that branch stamps the same «فهمٌ لا نصٌّ منقول» on the sentence,
// which is the very claim this rule exists to prevent. A scholar's credit in the same sentence
// («وقال ابن باز: إن النبي ﷺ قال…») is still judged: only the frame that names him is exempt.
// The spellings are matched as whole words after the diacritics are stripped, with the joined
// particles و/ف/ب/ك allowed in front. Whether the sentence then carries an answer-level notice
// belongs to the takhrij contract, which this rule does not touch.
const PROPHET_FRAME_RE = /(?<![\p{Script=Arabic}\p{M}])(?:[وفبك])?(?:النبي|الرسول|رسول\s+الله|محمد\s+صلى\s+الله\s+عليه\s+وسلم|صلى\s+الله\s+عليه\s+وسلم|عليه\s+الصلاة\s+والسلام|صلعم|ﷺ)(?![\p{Script=Arabic}\p{M}])/u;

function frameNamesTheProphet(frame) {
  return PROPHET_FRAME_RE.test(String(frame ?? '').replace(ARABIC_DIACRITICS, ''));
}

function detectAttribution(sentence) {
  for (const pattern of ATTRIBUTION_PATTERNS) {
    const match = pattern.exec(sentence);
    if (!match?.groups?.name) continue;
    const claimed = match.groups.name.trim();
    if (!claimed) continue;
    if (!framePointsAtAPerson(match.groups.frame, claimed)) continue;
    if (frameNamesTheProphet(match.groups.frame)) continue; // never a removable credit
    return { claimed, start: match.index, end: match.index + match[0].length, frame: match.groups.frame };
  }

  // Conservative fallback for authorities whose official source relationship is known. A model
  // can express the same attribution without one of the tidy frames above («حكم ابن باز هو…»،
  // «ابن باز يحرّم…»). Keeping the name merely because the syntax changed would defeat the rule.
  const aliases = AUTHORITY_SOURCES.flatMap((rule) => rule.aliases.map((alias) => ({ rule, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { rule, alias } of aliases) {
    const match = new RegExp(`(?<![\\p{L}\\p{N}])${aliasPattern(alias)}(?![\\p{L}\\p{N}])`, 'u').exec(sentence);
    if (!match) continue;
    const before = sentence.slice(0, match.index);
    const after = sentence.slice(match.index + match[0].length);
    const beforeCue = /(?:قال|ذكر|نقل|أفتى|يرى|عند|بحسب|قول|رأي|فتوى|حكم|وفق(?:ًا|ا)?\s+ل)\s*$/u.exec(before);
    const afterCue = /^\s*(?::|،|(?:إن|أن|بأن|يرى|يقول|قال|أفتى|يفتي|يحرّم|يحرم|حرّم|حرم|يجيز|أجاز|حكم|رأيه|فتواه)(?=\s|$|[،.!؟]))/u.test(after);
    if (!beforeCue && !afterCue) continue;
    let end = match.index + match[0].length;
    const connector = sentence.slice(end).match(/^\s*(?:(?:يرى|يقول|قال|أفتى|يفتي)\s+)?(?:إن|أن|بأن)\s+|^\s*[:،]\s*/u);
    if (connector) end += connector[0].length;
    return {
      claimed: rule.canonical,
      start: beforeCue ? beforeCue.index : match.index,
      end,
      frame: sentence.slice(beforeCue ? beforeCue.index : match.index, end),
    };
  }
  return null;
}

// Split the answer into runs that are prose and runs that are card material, in order. A card
// block is its opening tag, everything inside it, and its closing tag — one verbatim run, so the
// sentence splitter never sees the inside of a card at all.
//
// A TRUNCATED CARD HAS NO CLOSING TAG, and the stream truncates often enough that index.html
// carries a whole fallback for it. An opening tag with no partner therefore takes the REST of the
// answer as card material. That is the safe direction: the cost of being wrong is a few prose
// sentences going unmarked at the very end of a truncated reply, against the cost the other way,
// which is the tag landing inside a hadith.
function splitStructure(text) {
  let rest = String(text ?? '').replace(/\r\n?/gu, '\n');
  const runs = [];
  while (rest) {
    const opener = CARD_TAG_RE.exec(rest);
    if (!opener) { runs.push({ kind: 'prose', text: rest }); break; }
    if (opener.index > 0) runs.push({ kind: 'prose', text: rest.slice(0, opener.index) });
    // A closing tag with nothing open before it is markup and nothing else. It is not prose and
    // it is not a block; it is passed through on its own.
    if (opener[1] === '/') {
      runs.push({ kind: 'card', text: opener[0] });
      rest = rest.slice(opener.index + opener[0].length);
      continue;
    }
    const name = (CARD_NAME_RE.exec(opener[0]) || [, ''])[1];
    const after = rest.slice(opener.index + opener[0].length);
    const closer = name ? new RegExp('</' + name + '\\s*>', 'iu').exec(after) : null;
    if (closer) {
      runs.push({ kind: 'card', text: opener[0] + after.slice(0, closer.index + closer[0].length) });
      rest = after.slice(closer.index + closer[0].length);
    } else {
      runs.push({ kind: 'card', text: rest.slice(opener.index) });
      break;
    }
  }
  return runs;
}

const SENTENCE_STOP_RE = /[.!؟]/u;
const ARABIC_SCRIPT_CHAR_RE = /\p{Script=Arabic}/u;

/** Split prose only at a boundary where no supported quotation is open. */
function sentenceParts(text) {
  const value = String(text ?? '');
  const parts = [];
  const quoteState = { ascii: false, guillemet: 0, curly: 0 };
  let start = 0;
  let inMarkup = false;

  const pushPart = (end) => {
    const part = value.slice(start, end).trim();
    if (part) parts.push(part);
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '<') { inMarkup = true; continue; }
    if (inMarkup) {
      if (char === '>') inMarkup = false;
      continue;
    }

    updateQuoteChar(char, quoteState);
    if (hasOpenQuote(quoteState)) continue; // QUOTE_AWARE_SENTENCE_BOUNDARY

    if (char === '\n') {
      pushPart(index);
      start = index + 1;
      continue;
    }
    if (!SENTENCE_STOP_RE.test(char)) continue;

    const next = value[index + 1] || '';
    if (next && /\s/u.test(next)) {
      pushPart(index + 1);
      let nextIndex = index + 1;
      while (nextIndex < value.length && /\s/u.test(value[nextIndex])) nextIndex += 1;
      start = nextIndex;
      index = nextIndex - 1;
    } else if (ARABIC_SCRIPT_CHAR_RE.test(next)) {
      pushPart(index + 1);
      start = index + 1;
    }
  }

  pushPart(value.length);
  return parts;
}

/** A prose segment that still asserts nothing: a heading, a quoted ayah, an empty bit of markup. */
function assertsNothing(part) {
  return MD_HEADING_RE.test(part) || NO_CONTENT_RE.test(part) || QURAN_SPAN_RE.test(part);
}

function sentenceDomain(sentence, overall) {
  if (overall !== 'mixed') return overall;
  return FIQH_MARKERS.test(sentence) ? 'fiqh' : 'general';
}

function sentenceTagInsertionIndex(value) {
  const quoteState = { ascii: false, guillemet: 0, curly: 0 };
  let safeAt = -1;
  let inMarkup = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '<') { inMarkup = true; continue; }
    if (inMarkup) {
      if (char === '>') inMarkup = false;
      continue;
    }
    updateQuoteChar(char, quoteState);
    if (SENTENCE_STOP_RE.test(char) && !hasOpenQuote(quoteState)) safeAt = index + 1;
  }

  // An unclosed quotation has no later safe slot in this part. Keeping the tag at the part end is
  // deliberate: losing an honesty mark is worse than the explicit last-position fallback.
  if (hasOpenQuote(quoteState)) return value.length; // KEEP_TAG_AT_UNCLOSED_PART_END
  if (safeAt >= 0) {
    const tail = value.slice(safeAt);
    if (!tail || /^[\u00BB\u201D"]+$/u.test(tail)) return safeAt;
  }
  return value.length;
}

// ── ONE TAG, ONCE, PER ANSWER (M1+M2 night 3, task 4 — the owner’s ruling (a)) ──
//
// `shipped` is the set of tags this ANSWER has already put in front of the reader. It was the
// missing half: the check below saw one sentence at a time, so four sentences that each lost a
// credit shipped four copies of the same mark (measured: 2, and 4). The set is owned by the
// caller — one per reviewAnswer call, one per stream — and it is consulted BEFORE the mark is
// written, never by editing text afterwards. That is what lets the streaming path obey the
// same rule as the batch path without withdrawing one character the reader already holds.
//
// A tag the MODEL wrote into its own prose is recorded in the same set, so the reviewer never
// adds a second copy of something the reader can already see (ruling (c), and idempotency).
//
// THE LEDGER HOLDS THE SENTENCE-LEVEL MARK AND NOTHING ELSE, AND THAT IS DELIBERATE. The two
// answer-level notices are de-duplicated where they are written — answerNotices() reads the
// whole of `output` before adding either. A ledger that ALSO swallowed a repeat of an
// answer-level tag here would silently absorb the one defect this repository has already
// fought and still mutates for: a writer that stamps «this is understanding, not a fatwa» onto
// every sentence of an answer. That flood must stay visible to the mutant in
// guards/tag-honesty-guard.cjs, so it is not de-duplicated away at the sentence level.
//
// EACH REVIEW BINDS ITS OWN `tag`. The two callers below declare
//     const tag = (sentence, visibleTag) => tagWithLedger(sentence, visibleTag, shippedTags);
// so every call site keeps reading `tag(part, TAGS.ATTRIBUTION_REMOVED)` — the shape three
// mutation guards splice, and the shape that cannot accidentally be called with no ledger.
const SENTENCE_LEVEL_TAGS = new Set([TAGS.ATTRIBUTION_REMOVED]);
function tagWithLedger(sentence, visibleTag, shipped) {
  const carried = tagsCarriedBy(sentence);
  if (carried.length) {
    for (const seen of carried) if (SENTENCE_LEVEL_TAGS.has(seen)) shipped.add(seen);
    return sentence;
  }
  if (SENTENCE_LEVEL_TAGS.has(visibleTag) && shipped.has(visibleTag)) return sentence;
  const value = sentence.trim();
  const insertionAt = sentenceTagInsertionIndex(value);
  if (insertionAt < 0) return value;
  if (SENTENCE_LEVEL_TAGS.has(visibleTag)) shipped.add(visibleTag);
  return `${value.slice(0, insertionAt)} ${visibleTag}${value.slice(insertionAt)}`;
}

const COMPLETE_CARD_BLOCK_RE = /^<([a-z][\w-]*)\b[^>]*>[\s\S]*<\/\1\s*>$/iu;

function updateQuoteChar(char, state) {
  if (char === '«') state.guillemet += 1;
  else if (char === '»') state.guillemet = Math.max(0, state.guillemet - 1);
  else if (char === '“') state.curly += 1;
  else if (char === '”') state.curly = Math.max(0, state.curly - 1);
  else if (char === '"') state.ascii = !state.ascii;
}

function updateQuoteState(value, state) {
  const visible = String(value ?? '').replace(/<[^>]*>/gu, '');
  for (const char of visible) updateQuoteChar(char, state);
}

function hasOpenQuote(state) {
  return state.ascii || state.guillemet > 0 || state.curly > 0;
}

/** Last boundary where answer-level notes cannot split prose, a quotation, or a structural block. */
function noticeInsertionIndex(chunks) {
  const quoteState = { ascii: false, guillemet: 0, curly: 0 };
  let safeAt = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    updateQuoteState(chunk, quoteState);
    if (hasOpenQuote(quoteState)) continue;
    const prose = String(chunk).replace(VISIBLE_TAG, '').trim();
    if (COMPLETE_CARD_BLOCK_RE.test(chunk) || CLOSED_SENTENCE_RE.test(prose)) safeAt = index + 1;
  }
  return safeAt;
}

// ── NOTHING IS EVER PUT INTO THE MIDDLE OF A SENTENCE (§٣) ─────────────────
//
// WHAT THIS FUNCTION USED TO DO, AND WHAT IT COST. It rebuilt the sentence as
// `<before> ‹hedge›: <claim>`, where the hedge was a fixed Arabic phrase meaning «the general
// understanding from what is available». When the attribution frame sat at the HEAD of the
// sentence that reads as a replacement OF the frame and is defensible. When it sat in the
// MIDDLE — which is where it sits whenever the model states a claim, credits it, and carries on
// — `before` was non-empty and the phrase was driven straight through the spine of a connected
// Arabic sentence. Two witnesses, both the owner's, both from the live preview:
//
//   ١٥  «كفارةُ الشهرينِ … في نهارِ رمضانَ تحديدًا ‹hedge›: لا في مطلقِ الأكلِ والشربِ المتعمّد»
//   ١٩  «لأن العبرة بحاله ‹hedge›: وقد مسح وهو مقيم، فتُحسب مدته على أساس الإقامة»
//
// THE RULE §٣ SETS. A mark or a replacement goes at the END of the sentence, or it does not go.
// So the hedge is GONE rather than moved: the sentence is stitched back across the hole the
// attribution left, and `tag()` appends 【فهمٌ لا نصٌّ منقول】 after the full stop. That mark
// already carries everything the deleted phrase carried — this is understanding, not transmitted
// text — and it carries it somewhere Arabic can survive it. The phrase therefore exists nowhere
// in this module any more, which is what guards/tag-honesty-guard.cjs asserts.
//
// THE `ب` STRIP STAYS. An attribution ending on «ذهب فلانٌ إلى» leaves «بجواز…» behind, and that
// preposition belonged to the frame that was removed, not to the claim that survived it.
// ── THE PRAYER BELONGS TO THE NAME, SO IT LEAVES WITH THE NAME (§٢/٢) ───────
// «فتوى ابن باز رحمه الله: فقد نصّ…» — cut the name and «رحمه الله» is left standing in the
// sentence with nobody to be mercy upon. It is part of the credit, not part of the claim.
const NAME_HONORIFIC_TAIL = /^\s*(?:[وف])?(?:رحمه(?:م|ما|ا)?\s+الله(?:\s+تعالى)?|رضي\s+الله\s+عن(?:هما|هم|ها|ه)|حفظه\s+الله|عليه\s+السلام)/u;

// ── A REMOVAL THAT LEAVES A HOLE IS NOT A REMOVAL (§٢/٢) ────────────────────
//
// THE WITNESS, from the owner's question ١٢ on the live preview, printed whole in the report:
//
//   in   «يجوز لها ذلك، وهذا مصرَّحٌ به في فتوى ابن باز رحمه الله: فقد نصّ على أنّ كونَ المرأةِ…»
//   out  «يجوز لها ذلك، وهذا مصرَّحٌ به في رحمه الله: فقد نصّ على أنّ كونَ المرأةِ…»
//
// «مصرَّحٌ به في» governs a noun that is no longer there. The sentence the reader received is not
// Arabic. Removing the credit was right; leaving the preposition holding nothing was the damage,
// and no amount of tuning the frame patterns prevents the general case — a name can be the object
// of any word in the language.
//
// SO THE SEAM IS CHECKED, AND WHEN IT WOULD BREAK, NOTHING IS CUT. §٢ names both outcomes as
// acceptable and only one as forbidden: «إن نُزِعَ اسمٌ فالجملةُ الباقيةُ جملةٌ عربيّةٌ تامّةٌ
// تُقرأ — أو لا يُنزَعُ الاسمُ وتُوسَمُ الجملةُ كما هي. مخرَجٌ مكسورٌ ليس حراسة.» The second
// outcome is what this takes: the sentence is delivered exactly as written and carries
// 【فهمٌ لا نصٌّ منقول】, which is true of it either way — this is understanding, not transmitted
// text — and the verdict records `kept-unsupported-attribution-marked` so the count of credits
// left standing is readable rather than hidden inside the count of credits removed.
//
// TWO SHAPES OF BREAK, both read off the stitched halves and neither guessed:
//   * the head ends on a word that was governing the name («…مصرَّحٌ به في»);
//   * the claim opens on what was hanging off the name («رحمه الله…», «الذي…»).
const DANGLING_HEAD_RE = /(?<![\p{Script=Arabic}\p{M}])(?:[وف])?(?:في|على|إلى|عن|من|مع|لدى|عند|بحسب|قول|رأي|فتوى|حكم|بين|نحو|حول|لدن)$/u;
const DANGLING_CLAIM_RE = /^(?:[وف])?(?:رحمه|رحمهم|رحمها|رحمهما|رضي|حفظه|تعالى|عليه\s+السلام|الذي|التي|الذين|اللذين)(?![\p{Script=Arabic}\p{M}])/u;
const CLOSED_CLAUSE_RE = /[.!؟،؛][\s"'»”)]*$/u;
const CLOSED_SENTENCE_RE = /[.!؟][\s"'»”)]*$/u;
// Particles a delivered remainder cannot open on (the fifth door, M1 night 2, task 2). Matched
// as whole words on the diacritic-stripped claim. «إن» must never be added here.
// M1+M2 night 3, task 1: the same particles carried by a JOINED «و» or «ف». Arabic writes both
// letters attached to the word after them, so «ولأنه» is one token and the bare-form list above
// never saw it: the owner's remainder still shipped headless. The list is built from ONE base
// array so a bare form and its two joined twins can never drift apart, and so that nothing is
// added except a joined twin of a form already ruled dependent — a bare «ذلك» or «قد» is NOT
// on the list, and an optional-prefix regex would have quietly put them there.
// [RED] «إن» is not in the base array, so «وإن» and «فإن» are not generated either. Each of
// the three heads a complete conditional sentence (A-81/a); adding any would undo 5047d92.
const DEPENDENT_OPENING_BASE = [
  'لأن', 'لأنه', 'لأنها', 'لأنهم', 'لكون', 'إذ', 'حيث',
  'بل', 'ثم', 'فقد', 'وذلك', 'مما', 'لكن', 'لكنه',
];
const DEPENDENT_OPENING_RE = new RegExp(
  '^(?:' + DEPENDENT_OPENING_BASE.flatMap((p) => [p, 'و' + p, 'ف' + p]).join('|') + ')(?![\\p{Script=Arabic}\\p{M}])',
  'u',
);

/** The two halves the credit sat between, cleaned exactly once so both readers of them agree. */
function attributionParts(sentence, attribution) {
  const before = sentence.slice(0, attribution.start).trim();
  // The suffix exactly as written, before any particle is taken off it. `claim` below is the
  // judge's copy; this one is the reader's, and generalizeAttribution rebuilds from it (A-81/a).
  const rawClaim = sentence.slice(attribution.end);
  const claim = sentence.slice(attribution.end).trim()
    .replace(NAME_HONORIFIC_TAIL, '')
    .replace(/^[\s:،؛]+/u, '')
    .replace(/^(?:إن|أن|بأن)\s+/u, '')
    .replace(/^ب(?=جواز|وجوب|حرمة|تحريم|منع|استحباب|كراهة)/u, '');
  // A trailing connector or comma is what the removed frame hung off, so it leaves with the
  // frame instead of being left behind to collide with the claim that follows. The connector
  // must be a WHOLE WORD: «و» and «ف» are written joined to the word after them in Arabic, so a
  // bare-letter alternation here would amputate the last letter of «قالوا» and of «الخوف».
  // The reader's own comma is NOT the frame's, so it stays: «…تحديدًا، لا في مطلقِ الأكل» is the
  // sentence he wrote minus the credit, and «…تحديدًا لا في مطلقِ الأكل» is a second edit nobody
  // asked for. Only the colon the frame ended on, and the whitespace, go with it.
  const head = before
    .replace(/(?:^|\s)(?:ثم|كما|أمّا|أما|وأمّا|وأما|فأمّا|فأما)(?=[\s،؛:]*$)/u, '')
    .replace(/[\s:]+$/u, '')
    .trim();
  return { before, head, claim, rawClaim };
}

/** True when cutting the credit out would hand the reader a sentence that is not Arabic. */
function removalBreaksSentence(sentence, attribution) {
  const { before, head, claim } = attributionParts(sentence, attribution);
  if (!before && !claim) return false;
  const plainHead = head.replace(ARABIC_DIACRITICS, '');
  const plainClaim = claim.replace(ARABIC_DIACRITICS, '');
  if (head && DANGLING_HEAD_RE.test(plainHead)) return true;
  if (claim && DANGLING_CLAIM_RE.test(plainClaim)) return true;
  // A trailing credit can be removed only after a complete sentence. A comma-final fragment is
  // not an answer, and appending the honesty mark there merely makes the truncation visible.
  if (before && !claim) return !CLOSED_SENTENCE_RE.test(before);
  // In the middle, both surviving halves need an independently closed seam. Without punctuation
  // the frame may be the predicate or semantic subject that makes the following clause readable.
  if (head && claim && !CLOSED_CLAUSE_RE.test(head)) return true;
  // THE FIFTH DOOR (M1 night 2, task 2). The owner's sighting: «قال ابن باز يحرم حلق اللحية، لأنه
  // استئصال للحية…» passed the four doors above — no dangling head, no dangling claim, a comma
  // seam — and the reader received «لأنه استئصال للحية…», a causal clause with nothing before it.
  // A remainder that opens on a particle that cannot begin a sentence is not a sentence, so the
  // credit is kept and the sentence marked. «إن» is deliberately NOT on that list: after a colon
  // it heads a complete conditional sentence (A-81/a), and this door must not undo that.
  if (claim && DEPENDENT_OPENING_RE.test(plainClaim)) return true;
  return false;
}

// ── THE JUDGE AND THE READER DO NOT READ THE SAME «إن» (A-81/a) ──
//
// `claim` in attributionParts strips «إن», «أن» and «بأن» so DANGLING_CLAIM_RE can be anchored on
// the first real word. That text belongs to removalBreaksSentence and stays byte for byte. But
// «إن» is not only a subordinator: after a colon it is the conditional that HEADS the quoted
// sentence — «فقال: إن صامه لسبب … فلا بأس به» — and handing the reader the remainder without it
// leaves a bare verb with no head (measured: delivered text began «صامه لسبب»). So the reader's
// copy is rebuilt here from the untouched suffix with only «أن» / «بأن» removed — the two a
// sentence cannot stand on — and «إن» survives into the delivered text. The judge never sees
// this text; the removal decision is made on `claim` exactly as before.
const READER_CLAIM_PARTICLE_RE = /^(?:أن|بأن)\s+/u;
function readerClaim(rawClaim) {
  return String(rawClaim ?? '').trim()
    .replace(NAME_HONORIFIC_TAIL, '')
    .replace(/^[\s:،؛]+/u, '')
    .replace(READER_CLAIM_PARTICLE_RE, '')
    .replace(/^ب(?=جواز|وجوب|حرمة|تحريم|منع|استحباب|كراهة)/u, '');
}

function generalizeAttribution(sentence, attribution) {
  const { before, head, claim: judged, rawClaim } = attributionParts(sentence, attribution);
  if (!before && !judged) return '';
  if (!judged) return head || before;
  // The reader's text. Shadows the judge's `claim` deliberately: from here down, `claim` is
  // what is delivered, and the seam the guards pin (`${head} ${claim}`) reads the reader's copy.
  const claim = readerClaim(rawClaim);
  if (!head) return claim;
  return `${head} ${claim}`;
}

// ── THE LADDER, AND IT DECIDES EXACTLY ONE PAIR (M1+M2 night 3, task 4 — ruling (b)) ──
//
// The two answer-level notices were two independent `if`s over two independent booleans, so a
// `mixed` answer shipped both — «this is understanding, not a fatwa» directly above «this is
// settled knowledge, nothing was quoted» — which contradict each other. Three rungs, and only
// the bottom two are the ladder’s business:
//
//   1  the sentence mark      sentence-level   NEVER silenced by anything
//   2  the fiqh disclaimer    answer-level     survives against rung 3
//   3  the stable-knowledge   answer-level     yields to either disclaimer
//      assertion
//
// [RED] RUNG 1 IS NOT ON THE LADDER. It is the only signal that says WHICH sentence lost its
// credit, and no footer can carry that, so rung 2 standing beside it is by design and this
// function never removes it. Rung 3 yields to rung 1 for a different reason: rung 3 asserts of
// the WHOLE answer that nothing was quoted into it, and a sentence carrying rung 1 says
// something was — a credit was taken off it. The two cannot both be true of one answer.
//
// And nothing is added that the text already carries, in any spelling (ruling (c)). `output`
// is read rather than the ledger, because at this point it holds every chunk the reader will
// get, the model’s own echoes included. The khilaf tail is NOT a rung and is not decided here.
function answerNotices({ output, sawFiqhUnsourced, sawGeneralStable, noBookEvidence }) {
  const notices = [];
  const already = (visibleTag) => output.some((chunk) => carriesTag(chunk, visibleTag));
  const disclaimerAlready = already(TAGS.FIQH_UNSOURCED);
  if (sawFiqhUnsourced && !disclaimerAlready) notices.push(NOTICES.FIQH_UNSOURCED);
  // Rung 3 yields to a disclaimer this reviewer is about to write, to one the text already
  // carries, and to any sentence mark anywhere in the answer.
  const disclaimerStands = sawFiqhUnsourced || disclaimerAlready || already(TAGS.ATTRIBUTION_REMOVED);
  if (sawGeneralStable && noBookEvidence && !disclaimerStands && !already(TAGS.GENERAL_STABLE)) {
    notices.push(NOTICES.GENERAL_STABLE);
  }
  return notices;
}

function sourceTail(evidence) {
  const label = evidence.title || evidence.scholar || evidence.id;
  return `المصدر: ${label} — ${evidence.url} — ${evidence.date}`;
}

function dynamicEvidenceFor(sentence, evidence) {
  return evidence.find((item) => {
    if (!item.url || !item.date || !supportsSentence(sentence, item)) return false;
    try { return new URL(item.url).protocol === 'https:'; } catch { return false; }
  }) || null;
}

// ── ع-٥٥ — THE SECOND LICENCE: A BOOK WHOSE AUTHOR IS THE MAN NAMED ────────────
//
// WHAT WAS MEASURED, AND WHY THIS BRANCH HAD TO EXIST. `officialSourceFor` opens with
// `if (!rule) return false`, and `attributedEvidenceFor` joined its three conditions with `&&`.
// So the ONLY name this reviewer could license was one of the twenty-one rows of the registry
// above — every one of them a living scholar with a fatwa portal. A sentence reading
// «قال ابن قدامة المقدسي» with his own page of المغني among this turn's evidence lost the
// attribution, because ابن قدامة has no portal and never will. That strip was not a safety
// margin: it was the reviewer deleting a credit the evidence in its own hands proved.
//
// THE RULE, WHOLE. A sentence that names a man keeps his name when a page in THIS turn's hands
// bears that name — either a fatwa of his on his own domain (the branch above, untouched), or
// an atom of a book he wrote (this one). Anything else still has the name taken off it.
//
// WHY ALL FOUR CONDITIONS, AND WHY NOT ONE OF THEM FEWER:
//
//   * `kind` — a library atom and nothing else. `author` is a field any row shape could grow,
//     and a live web result carrying a byline is not a book that man wrote.
//   * A NON-EMPTY author after normalisation. An atom whose author the service did not send
//     normalises to '', and '' must match nothing at all: `containsWholeWords` on an empty
//     needle and an equality against '' are both doors that would license every name there is.
//   * THE NAME, matched exactly the way `authorityRule` matches an alias — normalise both
//     sides, then equality or whole-word containment in either direction. «ابن قدامة» has to
//     reach «ابن قدامة المقدسي» while «الراجحي» must not reach «آل الشيخ». Same hazard as
//     the registry's, so the same idiom rather than a second one written from scratch.
//   * `supportsSentence` — UNCHANGED and unrelaxed. The author's name proves the man wrote the
//     book; only the overlap proves this sentence is what the page actually holds.
//
// AND A FLOOR THE REGISTRY BRANCH DOES NOT NEED. That branch is bounded by twenty-one rows
// written by hand. This one is bounded by whatever a shelf of books happens to be authored by,
// which is an open set. A one-word claim — «قال أحمد» — whole-word-matches أحمد بن حنبل,
// أحمد شاكر and every other أحمد on the shelf, so one word licenses nothing here.
//
// WHY THE KIND IS A LITERAL AND NOT AN IMPORT. This module is PURE BY CONTRACT: its mutant
// harness (guards/output-reviewer-mutant-lib.cjs) copies THIS FILE ALONE into a temp directory
// and imports it, so a single relative specifier makes every mutant twin fail to resolve —
// measured, ERR_MODULE_NOT_FOUND — and seven guards assert `mutant.loaded`. The literal is
// therefore declared here and PINNED: guards/lib-book-contract-guard.cjs section F reads it out
// of this file and out of lib/free-brain/loop.js and fails if the two ever differ.
const LIB_BOOK_KIND = 'lib_book';

function bookAuthorEvidenceFor(sentence, attribution, evidence) {
  const claimed = normalizeArabic(attribution.claimed);
  if (claimed.split(' ').filter(Boolean).length < 2) return null;   // ONE_WORD_LICENSES_NOTHING
  return evidence.find((item) => {
    if (item.kind !== LIB_BOOK_KIND) return false;
    const author = normalizeArabic(item.author);
    if (!author) return false;
    const named = author === claimed
      || containsWholeWords(author, claimed)
      || containsWholeWords(claimed, author);
    return named && supportsSentence(sentence, item);
  }) || null;
}

function attributedEvidenceFor(sentence, attribution, evidence) {
  // ع-٥٥ — TWO LICENCES, IN THIS ORDER, AND THE FIRST IS BYTE-FOR-BYTE WHAT IT WAS.
  //
  // Every name the registry branch keeps today is still kept and every name it strips today is
  // still stripped: the book branch is only ever consulted after it has already declined, so it
  // can ADD a licence and can never withdraw one.
  //
  // WHY THE FIRST BRANCH KEEPS ITS OWN `|| null` INSTEAD OF FALLING INTO A SHARED ONE. That exact
  // line -- `\n    && supportsSentence(sentence, item)) || null;` -- is the mutation seam
  // guards/attribution-on-output-guard.cjs:179 cuts to prove a matching name on a matching domain
  // still cannot license the OPPOSITE ruling. Folding the two branches into one `return` moved
  // that seam and turned a live mutant into `mutation seam moved`, which is a guard that has
  // stopped testing rather than a guard that passed. Measured, then written this way on purpose.
  //
  // AND IT IS ONE EDIT, NOT TWO. Both call sites -- the text path at the reviewAnswer loop and
  // the streaming path in createReviewStream -- call exactly
  // `attributedEvidenceFor(part, attribution, sources)`, so the second licence reaches both from
  // here and the two paths cannot drift apart.
  const official = evidence.find((item) => sameAuthority(attribution.claimed, item.scholar)
    && officialSourceFor(attribution.claimed, item)
    && supportsSentence(sentence, item)) || null;
  return official || bookAuthorEvidenceFor(sentence, attribution, evidence) || null;
}

function actionRecord(index, domain, action, input, output, extra = {}) {
  return Object.freeze({ sentence: index + 1, domain, action, input, output, ...extra });
}

const DESTRUCTIVE_ACTIONS = new Set([
  'removed-unsupported-attribution',
  'replaced-unsupported-dynamic-claim',
  'last-resort-no-reliable-text',
]);

function auditExcerpt(value) {
  return Array.from(String(value ?? '')).slice(0, 200).join('');
}

const CONTRADICTION_TOPIC_STOP = new Set([
  'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'هو', 'هي', 'كان', 'كانت', 'يكون', 'تكون',
  'فقد', 'وقد', 'لكن', 'لان', 'اما', 'انما', 'عليه', 'عليها', 'فيه', 'فيها', 'منه', 'منها',
  'صحيح', 'صحيحه', 'باطل', 'باطله', 'يجوز', 'جائز', 'الجواز', 'بالجواز', 'ممنوع',
  'المنع', 'بالمنع', 'ينتقض', 'يجب', 'واجب', 'ركعتان', 'ركعتين', 'ركعه', 'واحده',
  'صاع', 'نصف', 'عليه', 'السلام', 'قال', 'قول', 'راي', 'مذهب', 'عند', 'غير', 'لم',
]);

const POLARITY_PAIRS = Object.freeze([
  Object.freeze({
    key: 'validity',
    positive: Object.freeze(['صحيح', 'صحيحه']),
    negative: Object.freeze(['باطل', 'باطله']),
  }),
  Object.freeze({
    key: 'permission',
    positive: Object.freeze(['يجوز', 'جائز', 'الجواز', 'بالجواز']),
    negative: Object.freeze(['لا يجوز', 'ممنوع', 'المنع', 'بالمنع']),
  }),
  Object.freeze({
    key: 'nullification',
    positive: Object.freeze(['ينتقض']),
    negative: Object.freeze(['لا ينتقض']),
  }),
  Object.freeze({
    key: 'obligation',
    positive: Object.freeze(['يجب', 'واجب']),
    negative: Object.freeze(['لا يجب']),
  }),
]);

const CONDITION_MARKER_RE = /(?:^|\s)(?:ان|اذا|ما\s+لم|ما\s+دمت|الا|غير\s+ان|لمن)(?:\s|$)/u;
const QUALIFIER_NEGATION_RE = /(?:^|\s)(?:لم|غير)(?:\s|$)/u;

function contradictionWord(value) {
  return String(value ?? '')
    .replace(/^[وف](?=[\p{Script=Arabic}\p{M}]{3})/u, '')
    .replace(/^(?:بال|كال|لل)(?=[\p{Script=Arabic}\p{M}]{3})/u, '')
    .replace(/^ال(?=[\p{Script=Arabic}\p{M}]{3})/u, '');
}

function contradictionWords(value) {
  return normalizeArabic(value).split(' ')
    .map(contradictionWord)
    .filter((word) => word.length > 2 && !CONTRADICTION_TOPIC_STOP.has(word));
}

function containsPhrase(value, phrase) {
  return (` ${value} `).includes(` ${phrase} `);
}

function polarityClaim(part) {
  const normalized = normalizeArabic(part.text);
  for (const pair of POLARITY_PAIRS) {
    let positiveText = ` ${normalized} `;
    for (const phrase of pair.negative.filter((item) => item.startsWith('لا '))) {
      positiveText = positiveText.replaceAll(` ${phrase} `, ' ');
    }
    const positive = pair.positive.some((phrase) => containsPhrase(positiveText.trim(), phrase));
    const negative = pair.negative.some((phrase) => containsPhrase(normalized, phrase));
    const negatedPositive = pair.positive.some((phrase) => containsPhrase(normalized, `غير ${phrase}`));
    if (positive === negative || negatedPositive) continue;
    return { ...part, key: pair.key, side: positive ? 'positive' : 'negative' };
  }
  return null;
}

function speakerFor(value) {
  const normalized = normalizeArabic(value);
  const match = /(?:^|\s)(?:قال|قول|راي|مذهب)\s+(.+?)\s+(?:بالجواز|بالمنع|يجوز|لا\s+يجوز|صحيح|باطل|ينتقض|لا\s+ينتقض|يجب|لا\s+يجب)(?:\s|$)/u.exec(normalized);
  return match ? contradictionWords(match[1]).join(' ') : null;
}

function circumstanceView(value) {
  const words = new Set(contradictionWords(value));
  const hasAny = (items) => items.some((item) => words.has(item));
  return Object.freeze({
    travel: hasAny(['سفر', 'مسافر']) ? 'travel' : hasAny(['اقامه', 'مقيم']) ? 'residence' : null,
    intent: hasAny(['عمد', 'عمدا', 'عامد']) ? 'intentional'
      : hasAny(['نسيان', 'ناسيا', 'ناسي']) ? 'forgetful' : null,
  });
}

function qualifierView(value) {
  const normalized = normalizeArabic(value);
  return {
    marked: CONDITION_MARKER_RE.test(normalized),
    negated: QUALIFIER_NEGATION_RE.test(normalized),
    words: new Set(contradictionWords(normalized)),
    speaker: speakerFor(normalized),
    circumstance: circumstanceView(normalized),
  };
}

function differentiatedCase(first, later) { // CONTRADICTION_DIFFERENTIATION_REQUIRED
  const a = qualifierView(first.scope);
  const b = qualifierView(later.scope);
  if (a.speaker || b.speaker) {
    if (!a.speaker || !b.speaker || a.speaker !== b.speaker) return true;
  }
  if (a.circumstance.travel && b.circumstance.travel
      && a.circumstance.travel !== b.circumstance.travel) return true;
  if (a.circumstance.intent && b.circumstance.intent
      && a.circumstance.intent !== b.circumstance.intent) return true;
  if (a.negated !== b.negated) return true;
  if (a.marked || b.marked) {
    if (!a.marked || !b.marked) return true;
    const overlap = [...a.words].some((word) => b.words.has(word));
    if (!overlap) return true;
  }
  return false;
}

function sameContradictionTopic(first, later) {
  if (later.at === first.at + 1) return true;
  const a = new Set(contradictionWords(first.scope));
  return contradictionWords(later.scope).some((word) => a.has(word));
}

function splitContradictionClauses(sentence) {
  const value = String(sentence ?? '');
  const clauses = [];
  const quoteState = { ascii: false, guillemet: 0, curly: 0 };
  let start = 0;
  const push = (end) => {
    const text = value.slice(start, end).trim();
    if (text) clauses.push(text);
  };
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    updateQuoteChar(char, quoteState);
    if (hasOpenQuote(quoteState) || !/[،؛·]/u.test(char)) continue;
    push(index + 1);
    start = index + 1;
  }
  push(value.length);
  return clauses;
}

function contradictionParts(value) {
  const parts = [];
  for (const run of splitStructure(value)) {
    if (run.kind === 'card') continue;
    for (const sentence of sentenceParts(run.text)) {
      if (assertsNothing(sentence)) continue;
      const clauses = splitContradictionClauses(sentence);
      for (let index = 0; index < clauses.length; index += 1) {
        const text = clauses[index];
        const previous = clauses[index - 1] || '';
        const scope = previous && CONDITION_MARKER_RE.test(normalizeArabic(previous))
          ? `${previous} ${text}` : text;
        parts.push(Object.freeze({ text, scope, at: parts.length + 1 }));
      }
    }
  }
  return parts;
}

function contradictionFinding(shape, first, later) {
  return Object.freeze({
    detected: true,
    shape,
    first: auditExcerpt(first.text),
    later: auditExcerpt(later.text),
    at: Object.freeze([first.at, later.at]),
  });
}

function polarityContradiction(parts) {
  const claims = [];
  for (const part of parts) {
    const claim = polarityClaim(part);
    if (!claim) continue;
    for (const first of claims) {
      if (first.key !== claim.key || first.side === claim.side) continue;
      if (!sameContradictionTopic(first, claim)) continue;
      if (differentiatedCase(first, claim)) continue;
      return contradictionFinding('polarity', first, claim);
    }
    claims.push(claim);
  }
  return null;
}

function namedAnswerClaim(part) {
  const normalized = normalizeArabic(part.text);
  const match = /^(?:(?:اما|بل)\s+)?((?:[\p{Script=Arabic}]{2,})(?:\s+(?:(?:ابن|بن|بنت)\s+)?[\p{Script=Arabic}]{2,}){0,2})\s+عليه\s+السلام(?:\s|$)/u.exec(normalized);
  if (!match) return null;
  return { ...part, name: match[1], head: match[1].split(' ')[0] };
}

function namedAnswerContradiction(parts) {
  const claims = [];
  for (const part of parts) {
    const claim = namedAnswerClaim(part);
    if (!claim) continue;
    for (const first of claims) {
      if (first.at > 3 || first.head === claim.head
          || first.name.startsWith(claim.name) || claim.name.startsWith(first.name)) continue;
      if (differentiatedCase(first, claim)) continue;
      return contradictionFinding('named-answer', first, claim);
    }
    claims.push(claim);
  }
  return null;
}

const NO_SELF_CONTRADICTION = Object.freeze({
  detected: false, shape: null, first: null, later: null, at: null,
});

// TWO MEASURED SHAPES, NOT THREE — and the third is struck on the deposited bytes, not on taste.
// The corrected measurement removed question prose from the former 230 mixed blocks, leaving 140
// answer blocks from EZIK-BATTERY-ANSWERS-2026-08-17.txt and
// EZIK-XRAY-CC-ANSWERS-2026-08-17.txt, then added all eleven fenced answers from
// EZIK-SET2-FIQH-FOR-OWNER-2026-08-16.md. Across those 151 ANSWERS, `quantity` has one genuine hit
// and three false positives. The genuine hit is set2 preview/2/Q12: it opens with «ركعتين، لا
// ركعة واحدة» and closes with «ركعة واحدة فقط، لا ركعتين». Its three lies are two coherent
// «two, not one» answers (xray Q12/turn 1 and set2 preview/1/Q12), plus battery Q18, where
// «وهذه ركعةٌ واحدة» describes one part and «فالحاصل: ركعتان» describes the total.
// Three lies exceed one hit, so the owner's numeric rule keeps the shape retired.
//
// The real positive is deposited as measurement evidence even though the retired detector must
// report false. The negative witness `b3a-xray-q12-turn-1-negation-not-quantity` is also kept, and
// the reviewermatrix mutant `contradiction-quantity-reintroduced` puts the shape back verbatim and
// dies on that false witness.
//
// CONTRADICTION_TOPIC_STOP keeps its ركعة/صاع words on purpose: sameContradictionTopic reads them
// for the two SURVIVING shapes, so pulling them out would ride an unmeasured change to polarity on
// the back of a measured retirement.
function detectSelfContradiction(value) {
  const parts = contradictionParts(value);
  const findings = [
    polarityContradiction(parts),
    namedAnswerContradiction(parts), // TWO_MEASURED_SHAPES_ONLY
  ].filter(Boolean);
  if (!findings.length) return NO_SELF_CONTRADICTION;
  findings.sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]
    || ['polarity', 'named-answer'].indexOf(a.shape)
      - ['polarity', 'named-answer'].indexOf(b.shape));
  return findings[0];
}

/**
 * Review one proposed answer without I/O or ambient state.
 *
 * @param {{text: string, evidence: Array<object>, domain: 'fiqh'|'general'|'mixed', mode: string,
 *   khilafFromOpinions?: boolean|null, opinionCount?: number|null,
 *   truncated?: boolean|null}} input
 * @returns {{text: string, annotations: Array<object>, verdict: object}}
 */
export function reviewAnswer({
  text, evidence, domain, mode, khilafFromOpinions, opinionCount, truncated,
} = {}) {
  if (!['fiqh', 'general', 'mixed'].includes(domain)) {
    throw new TypeError('reviewAnswer domain must be fiqh, general, or mixed');
  }

  const sources = Array.isArray(evidence) ? evidence.map(evidenceView) : [];
  const normalizedKhilafFromOpinions = khilafFromOpinions === true
    ? true : khilafFromOpinions === false ? false : null; // PRESERVE_ABSENT_OPINIONS
  const normalizedOpinionCount = Number.isInteger(opinionCount) && opinionCount >= 0
    ? opinionCount : null;
  const suppressAnswerFooter = truncated === true; // TRUNCATION_IS_STRICTLY_TRUE
  const annotations = [];
  const output = [];
  // The ordinal counts REVIEWED SENTENCES, so an annotation's `sentence` still names the nth thing
  // this reviewer judged. Card material and headings are carried, not judged, and do not consume a
  // number — a verdict that counted them would be reporting work it did not do.
  let ordinal = 0;
  let sawFiqhUnsourced = false;
  let sawGeneralStable = false;
  let khilafFromSource = false;
  let khilafFromModelProse = false;
  // The tags this answer has already put in front of the reader, and the writer bound to them.
  const shippedTags = new Set();
  const tag = (sentence, visibleTag) => tagWithLedger(sentence, visibleTag, shippedTags);

  for (const run of splitStructure(text)) {
    if (run.kind === 'card') {
      if (run.text.trim()) output.push(run.text.trim());
      continue;
    }
    for (const part of sentenceParts(run.text)) {
      if (assertsNothing(part)) { output.push(part); continue; }
      const scopedDomain = sentenceDomain(part, domain);

      if (scopedDomain === 'fiqh') {
        if (!khilafFromModelProse && modelProseDeclaresKhilaf(part)) {
          khilafFromModelProse = true;
        }
        if (!khilafFromSource && sources.some((source) => sourceSupportsKhilaf(part, source))) {
          khilafFromSource = true; // SOURCE_KHILAF_ONLY
        }
        const attribution = detectAttribution(part);
        if (attribution) {
          const matched = attributedEvidenceFor(part, attribution, sources);
          if (matched) {
            output.push(part);
            annotations.push(actionRecord(ordinal, scopedDomain, 'kept-sourced-attribution', part, part, {
              claimedAuthority: attribution.claimed,
              evidenceId: matched.id,
              source: matched.url || matched.identifier,
            }));
            ordinal += 1;
            continue;
          }

          // §٢/٢ — CHECKED BEFORE ANYTHING IS CUT. A credit whose removal would leave the
          // sentence holding a preposition with no object is left where it is, and the sentence
          // is marked instead. The mark says exactly what is true of it: understanding, not
          // transmitted text.
          if (removalBreaksSentence(part, attribution)) {
            const marked = tag(part, TAGS.ATTRIBUTION_REMOVED);
            output.push(marked);
            annotations.push(actionRecord(ordinal, scopedDomain, 'kept-unsupported-attribution-marked', part, marked, {
              claimedAuthority: attribution.claimed,
            }));
            ordinal += 1;
            continue;
          }

          const generalized = generalizeAttribution(part, attribution);
          // THE LINE-LEVEL MARK SURVIVES HERE, AND ONLY HERE. «فهمٌ لا نصٌّ منقول» on a claim that
          // named a scholar this turn's evidence does not support distinguishes that sentence from
          // every other sentence in the answer: something was taken OFF it. It is rare — one in
          // ninety-seven on the measured flood — and it is the one mark a reader cannot recover
          // from a notice at the bottom, because the notice could not say WHICH sentence lost its
          // attribution. §٥/٣ leaves it exactly where it is.
          const reviewed = generalized ? tag(generalized, TAGS.ATTRIBUTION_REMOVED) : '';
          if (reviewed) {
            output.push(reviewed);
            annotations.push(actionRecord(ordinal, scopedDomain, 'removed-unsupported-attribution', part, reviewed, {
              claimedAuthority: attribution.claimed,
            }));
            ordinal += 1;
            continue;
          }
        }

        // THE RULING IS STILL DELIVERED, AND STILL DELIVERED MARKED — the mark is now the answer's,
        // not the sentence's. Explicit disagreement prose is only the weakest answer-level signal:
        // source and opinion evidence retain naming priority, and every signal shares one tail.
        let reviewed = part;
        output.push(reviewed);
        annotations.push(actionRecord(ordinal, scopedDomain, 'tagged-fiqh-understanding', part, reviewed));
        // (d) IDEMPOTENCY. A part that ARRIVES already carrying the sentence mark has been
        // reviewed once already — by an earlier pass, or by the model echoing it. That mark is
        // the stronger statement about this sentence, so raising the answer-level rung-2 flag
        // for it would write a footer the first pass did not. Measured: without this line the
        // reviewer was not idempotent on ANY shape — every pass added one more tag, unbounded.
        if (!carriesTag(part, TAGS.ATTRIBUTION_REMOVED)) sawFiqhUnsourced = true;
        ordinal += 1;
        continue;
      }

      if (isVariableClaim(part)) {
        const matched = dynamicEvidenceFor(part, sources);
        if (matched) {
          const tail = sourceTail(matched);
          const reviewed = part.includes(matched.url) && part.includes(matched.date)
            ? part : `${part}\n${tail}`;
          output.push(reviewed);
          annotations.push(actionRecord(ordinal, scopedDomain, 'kept-dynamic-with-dated-source', part, reviewed, {
            evidenceId: matched.id, source: matched.url, date: matched.date,
          }));
        } else {
          output.push(DYNAMIC_UNSOURCED);
          annotations.push(actionRecord(ordinal, scopedDomain, 'replaced-unsupported-dynamic-claim', part, DYNAMIC_UNSOURCED));
        }
        ordinal += 1;
        continue;
      }

      // The same treatment for the same reason: «معرفةٌ مستقرة غير منقولة» stamped on every
      // sentence of a general answer is the identical flood measured on the platform at 13:26:22Z,
      // seven stamps deep, and it distinguishes nothing between one sentence and the next.
      output.push(part);
      annotations.push(actionRecord(ordinal, scopedDomain, 'tagged-stable-general-knowledge', part, part));
      sawGeneralStable = true;
      ordinal += 1;
    }
  }

  const notices = [];
  const khilafTrigger = khilafTriggerFor(
    khilafFromSource, normalizedKhilafFromOpinions, khilafFromModelProse,
  );
  if (!suppressAnswerFooter) {
    if (khilafTrigger && !output.some((chunk) => chunk.includes(KHILAF_TAIL.trim()))) {
      notices.push(KHILAF_TAIL.trim());
    }
    // ع-٤٩/§٣-٤ — never when a book was quoted into this answer. See sawBookEvidence.
    notices.push(...answerNotices({
      output, sawFiqhUnsourced, sawGeneralStable, noBookEvidence: !sawBookEvidence(sources),
    }));
  }
  if (notices.length) output.splice(noticeInsertionIndex(output), 0, ...notices);

  // REVIEWER_INVARIANT_NON_EMPTY: a non-empty proposal may be shortened, but never annihilated.
  // Empty input also receives the explicit last rung, so every caller gets a usable string.
  const reviewedText = output.join('\n').trim() || LAST_RESORT;
  if (!output.length) {
    annotations.push(actionRecord(0, domain, 'last-resort-no-reliable-text', String(text ?? ''), reviewedText));
  }

  const counts = {};
  for (const item of annotations) counts[item.action] = (counts[item.action] || 0) + 1;
  const selfContradiction = detectSelfContradiction(reviewedText);
  const verdict = Object.freeze({
    version: 'freebrain-b-v1',
    domain,
    mode: String(mode ?? ''),
    sentences: annotations.map((item) => Object.freeze({
      sentence: item.sentence,
      domain: item.domain,
      action: item.action,
      evidenceId: item.evidenceId || null,
      ...(DESTRUCTIVE_ACTIONS.has(item.action) ? {
        before: auditExcerpt(item.input),
        after: auditExcerpt(item.output),
      } : {}),
    })),
    counts: Object.freeze(counts),
    usedLastResort: reviewedText === LAST_RESORT,
    khilafFromSource,
    khilafFromOpinions: normalizedKhilafFromOpinions,
    khilafFromModelProse,
    opinionCount: normalizedOpinionCount,
    khilafTrigger,
    answerFooterSuppressedReason: suppressAnswerFooter ? 'truncated' : null,
    selfContradiction, // SELF_CONTRADICTION_FIELD_ALWAYS_PRESENT
  });

  return { text: reviewedText, annotations: Object.freeze(annotations), verdict };
}

// ── THE TWO LEVELS (§٢) ──────────────────────────────────────────────────────
//
// `reviewAnswer` above is unchanged and stays the oracle: it sees the whole answer,
// and tools/stream-p1/equivalence-proof.cjs compares this against it byte for byte.
// Nothing below is permitted to disagree with it.
//
// THE LOCAL LEVEL reviews a sentence the moment that sentence is complete, and only
// then is the sentence handed onward. What went out is therefore never taken back.
// THE GLOBAL LEVEL runs once, after the last sentence, and it may only APPEND: the
// disagreement tail and the two answer-level notices. If the closing block ever
// wants to put a notice BEHIND text already sent, that is not settled quietly —
// `violations` records it, and the caller is expected to refuse to stream, per §٥/١.
//
// WHY UNITS, AND WHY THE LAST ONE IS ALWAYS HELD. The reviewer's own splitters are
// re-run over everything received so far, so segmentation cannot drift from the
// oracle's. Every unit but the final one is settled: a boundary the splitters have
// already committed to cannot move when more text arrives. The final unit can still
// grow — a full stop is not a sentence end until the next character proves it, and a
// quotation still open suppresses every boundary inside it — so it is held until
// `end()`. That is §٢'s «جملةٌ ناقصةٌ لا تُبَثُّ أبدًا», enforced by the structure
// rather than promised by a comment.

function reviewUnits(value) {
  const units = [];
  for (const run of splitStructure(value)) {
    if (run.kind === 'card') { units.push({ kind: 'card', text: run.text }); continue; }
    for (const part of sentenceParts(run.text)) units.push({ kind: 'prose', text: part });
  }
  return units;
}

/**
 * Review one answer as it is written, sentence by sentence.
 *
 * `push` returns the chunks that are ready to go on the wire, already reviewed.
 * `end` returns the last held sentence, the answer-level notices, and the same
 * `{text, annotations, verdict}` shape `reviewAnswer` returns.
 *
 * @param {{evidence?: Array<object>, domain: 'fiqh'|'general'|'mixed', mode?: string,
 *   khilafFromOpinions?: boolean|null, opinionCount?: number|null,
 *   truncated?: boolean|null}} input
 */
export function createReviewStream({
  evidence, domain, mode, khilafFromOpinions, opinionCount, truncated, onUnit,
} = {}) {
  if (!['fiqh', 'general', 'mixed'].includes(domain)) {
    throw new TypeError('createReviewStream domain must be fiqh, general, or mixed');
  }

  const sources = Array.isArray(evidence) ? evidence.map(evidenceView) : [];
  const normalizedKhilafFromOpinions = khilafFromOpinions === true
    ? true : khilafFromOpinions === false ? false : null;
  const normalizedOpinionCount = Number.isInteger(opinionCount) && opinionCount >= 0
    ? opinionCount : null;
  const suppressAnswerFooter = truncated === true;

  const annotations = [];
  const output = [];
  const settled = [];
  const violations = [];
  let buffer = '';
  let ordinal = 0;
  let closed = false;
  let sawFiqhUnsourced = false;
  let sawGeneralStable = false;
  let khilafFromSource = false;
  let khilafFromModelProse = false;
  // The tags this stream has already SENT, and the writer bound to them. Consulted at each
  // tag() call and at footer assembly, so de-duplication happens before emission and no
  // character the reader already holds is ever withdrawn.
  const shippedTags = new Set();
  const tag = (sentence, visibleTag) => tagWithLedger(sentence, visibleTag, shippedTags);

  // ── §١/ب — IS THIS UNIT'S ATTRIBUTION VERDICT SETTLED BY THE EVIDENCE IN HAND? ──
  //
  // Every evidence test below is a `find`/`some` over `sources`, and `sources` only ever
  // GROWS as an answer is written: rows enter it in first-citation order and none is ever
  // removed. So each test is monotone — a row arriving later can turn «no match» into «a
  // match», and can never do the reverse, and the row a `find` settles on cannot be
  // displaced by one appended after it.
  //
  // THAT MONOTONICITY IS THE WHOLE PREDICATE. A unit whose attribution is MATCHED is
  // decided for good. A unit whose attribution is detected and NOT matched is not decided
  // at all: the next row may support it, and then this sentence keeps a name that the
  // evidence in hand would have stripped. `mark()` says exactly that and nothing more —
  // it does not change one character of what this function emits, and the whole-text
  // oracle is untouched by it.
  //
  // AND THE UNMATCHED CASE IS MARKED ONCE, ABOVE ITS THREE OUTCOMES, so the branch where
  // generalisation comes back empty and the sentence falls through to
  // `tagged-fiqh-understanding` is covered with the two that tag it. That fall-through
  // emits the same characters either way, but its ANNOTATION would still change under a
  // later row, and `باب النسبة` is judged by the verdict and not only by the bytes.
  /** The local level. One unit in, the chunks it produces out. */
  const reviewUnitInner = (unit, mark) => {
    const produced = [];
    const emit = (chunk) => { produced.push(chunk); output.push(chunk); };

    if (unit.kind === 'card') {
      if (unit.text.trim()) emit(unit.text.trim());
      return produced;
    }

    const part = unit.text;
    if (assertsNothing(part)) { emit(part); return produced; }
    const scopedDomain = sentenceDomain(part, domain);

    if (scopedDomain === 'fiqh') {
      if (!khilafFromModelProse && modelProseDeclaresKhilaf(part)) khilafFromModelProse = true;
      if (!khilafFromSource && sources.some((source) => sourceSupportsKhilaf(part, source))) {
        khilafFromSource = true;
      }
      const attribution = detectAttribution(part);
      if (attribution) {
        const matched = attributedEvidenceFor(part, attribution, sources);
        if (!matched) mark();
        if (matched) {
          emit(part);
          annotations.push(actionRecord(ordinal, scopedDomain, 'kept-sourced-attribution', part, part, {
            claimedAuthority: attribution.claimed,
            evidenceId: matched.id,
            source: matched.url || matched.identifier,
          }));
          ordinal += 1;
          return produced;
        }
        if (removalBreaksSentence(part, attribution)) {
          const marked = tag(part, TAGS.ATTRIBUTION_REMOVED);
          emit(marked);
          annotations.push(actionRecord(ordinal, scopedDomain, 'kept-unsupported-attribution-marked', part, marked, {
            claimedAuthority: attribution.claimed,
          }));
          ordinal += 1;
          return produced;
        }
        const generalized = generalizeAttribution(part, attribution);
        const reviewed = generalized ? tag(generalized, TAGS.ATTRIBUTION_REMOVED) : '';
        if (reviewed) {
          emit(reviewed);
          annotations.push(actionRecord(ordinal, scopedDomain, 'removed-unsupported-attribution', part, reviewed, {
            claimedAuthority: attribution.claimed,
          }));
          ordinal += 1;
          return produced;
        }
      }
      emit(part);
      annotations.push(actionRecord(ordinal, scopedDomain, 'tagged-fiqh-understanding', part, part));
      // (d) IDEMPOTENCY — the same rule as the batch path. See the note there.
      if (!carriesTag(part, TAGS.ATTRIBUTION_REMOVED)) sawFiqhUnsourced = true;
      ordinal += 1;
      return produced;
    }

    if (isVariableClaim(part)) {
      const matched = dynamicEvidenceFor(part, sources);
      if (!matched) mark();
      if (matched) {
        const tail = sourceTail(matched);
        const reviewed = part.includes(matched.url) && part.includes(matched.date)
          ? part : `${part}\n${tail}`;
        emit(reviewed);
        annotations.push(actionRecord(ordinal, scopedDomain, 'kept-dynamic-with-dated-source', part, reviewed, {
          evidenceId: matched.id, source: matched.url, date: matched.date,
        }));
      } else {
        emit(DYNAMIC_UNSOURCED);
        annotations.push(actionRecord(ordinal, scopedDomain, 'replaced-unsupported-dynamic-claim', part, DYNAMIC_UNSOURCED));
      }
      ordinal += 1;
      return produced;
    }

    emit(part);
    annotations.push(actionRecord(ordinal, scopedDomain, 'tagged-stable-general-knowledge', part, part));
    sawGeneralStable = true;
    ordinal += 1;
    return produced;
  };

  /**
   * The reporter. `settled` travels beside the chunks rather than inside them, because a
   * caller that inferred it from the emitted text would be reading a fingerprint — and the
   * one thing this file's §٠ forbids is deciding attribution by a fingerprint.
   */
  const reviewUnit = (unit) => {
    let unitSettled = true;
    const produced = reviewUnitInner(unit, () => { unitSettled = false; });
    if (onUnit) onUnit({ kind: unit.kind, text: unit.text, settled: unitSettled, produced });
    return produced;
  };

  /** Review every unit up to `limit`, after proving the settled ones did not move. */
  const advance = (limit) => {
    const units = reviewUnits(buffer);
    for (let index = 0; index < settled.length; index += 1) {
      const current = units[index];
      if (!current || current.kind !== settled[index].kind || current.text !== settled[index].text) {
        // A settled unit moved under us. Sending it was a mistake that cannot be
        // undone, so it is named here rather than papered over.
        violations.push({
          kind: 'settled-unit-changed',
          at: index,
          was: settled[index].text,
          now: current ? current.text : null,
        });
      }
    }
    const ready = [];
    for (let index = settled.length; index < Math.min(limit, units.length); index += 1) {
      ready.push(...reviewUnit(units[index]));
      settled.push(units[index]);
    }
    return ready;
  };

  return {
    /** Feed the next piece of the model's text. Returns reviewed chunks ready to send. */
    push(chunk) {
      if (closed) throw new Error('createReviewStream: push after end');
      buffer += String(chunk ?? '');
      // The last unit is never settled: only text that follows can prove where it ends.
      return advance(reviewUnits(buffer).length - 1);
    },

    /** No more text is coming. Returns the held sentence, then the global level's appendix. */
    end() {
      if (closed) throw new Error('createReviewStream: end called twice');
      closed = true;
      const tail = advance(Number.POSITIVE_INFINITY);

      const emittedCount = output.length;
      const notices = [];
      const khilafTrigger = khilafTriggerFor(
        khilafFromSource, normalizedKhilafFromOpinions, khilafFromModelProse,
      );
      if (!suppressAnswerFooter) {
        if (khilafTrigger && !output.some((chunk) => chunk.includes(KHILAF_TAIL.trim()))) {
          notices.push(KHILAF_TAIL.trim());
        }
        // ع-٤٩/§٣-٤ — the same assembler the batch path uses, so the two cannot answer
        // differently. Every input it reads is known before a notice is written.
        notices.push(...answerNotices({
          output, sawFiqhUnsourced, sawGeneralStable, noBookEvidence: !sawBookEvidence(sources),
        }));
      }
      if (notices.length) {
        const at = noticeInsertionIndex(output);
        if (at < emittedCount) {
          // §٥/١. The notice belongs behind text the reader already has. Nothing is
          // withdrawn: the violation is reported, and the caller must not stream.
          violations.push({ kind: 'notice-behind-emitted', at, emitted: emittedCount });
        }
        output.splice(at, 0, ...notices);
      }

      const reviewedText = output.join('\n').trim() || LAST_RESORT;
      if (!output.length) {
        annotations.push(actionRecord(0, domain, 'last-resort-no-reliable-text', buffer, reviewedText));
      }

      const counts = {};
      for (const item of annotations) counts[item.action] = (counts[item.action] || 0) + 1;
      const selfContradiction = detectSelfContradiction(reviewedText);
      const verdict = Object.freeze({
        version: 'freebrain-b-v1',
        domain,
        mode: String(mode ?? ''),
        sentences: annotations.map((item) => Object.freeze({
          sentence: item.sentence,
          domain: item.domain,
          action: item.action,
          evidenceId: item.evidenceId || null,
          ...(DESTRUCTIVE_ACTIONS.has(item.action) ? {
            before: auditExcerpt(item.input),
            after: auditExcerpt(item.output),
          } : {}),
        })),
        counts: Object.freeze(counts),
        usedLastResort: reviewedText === LAST_RESORT,
        khilafFromSource,
        khilafFromOpinions: normalizedKhilafFromOpinions,
        khilafFromModelProse,
        opinionCount: normalizedOpinionCount,
        khilafTrigger,
        answerFooterSuppressedReason: suppressAnswerFooter ? 'truncated' : null,
        selfContradiction,
      });

      return {
        tail,
        notices,
        text: reviewedText,
        annotations: Object.freeze(annotations),
        verdict,
        violations,
      };
    },
  };
}

export const REVIEW_TAGS = TAGS;
export const REVIEW_LAST_RESORT = LAST_RESORT;
export const REVIEW_DYNAMIC_UNSOURCED = DYNAMIC_UNSOURCED;
