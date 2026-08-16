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
//     fatwas. Thirteen of them — سعد الماجد at 17,875 records, عبدالرحمن البراك at 10,740, مشهور
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
    canonical: 'النجدي الأثري',
    aliases: Object.freeze(['النجدي الأثري', 'عبدالله النجدي الاثري', 'عبد الله النجدي الاثري', 'النجدي الاثري']),
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
    canonical: 'سعد الماجد',
    aliases: Object.freeze(['سعد الماجد', 'الماجد']),
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
const HONORIFICS = /(?:^|\s)(?:فضيلة|سماحة|الشيخ|الإمام|العلامة|الدكتور)(?=\s|$)/gu;
const TOKEN_STOP = new Set([
  'في', 'من', 'إلى', 'على', 'عن', 'أن', 'إن', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك',
  'قال', 'ذكر', 'يرى', 'أفتى', 'بحسب', 'عند', 'وقد', 'كما', 'ثم', 'مع', 'ولا', 'لا',
]);

const FIQH_MARKERS = /(?:حكم|يجوز|لا\s+يجوز|جائز|حلال|حرام|واجب|فرض|سنّة|سنة|مكروه|الصلاة|الصيام|الوضوء|الزكاة|فتوى|شرع|أهل\s+العلم|الراجح|الجمهور|النبي|رسول|الله)/u;
const KHILAF_MARKERS = /(?:خلاف|اختلف|قولان|أقوال|الراجح|الجمهور|بعض\s+أهل\s+العلم)/u;
const DYNAMIC_MARKERS = /(?:اليوم|الآن|حالي[ًاا]?|أحدث|آخر\s+(?:خبر|الأخبار|سعر|نتيجة)|طقس|درجة\s+الحرارة|سعر|أسعار|نتيجة|أخبار|خبر\s+عاجل|بورصة|سهم|سعر\s+الصرف|عدد\s+الإصابات|هذا\s+(?:الأسبوع|الشهر|العام))/u;
const VISIBLE_TAG = /【(?:فهمٌ لا نصٌّ منقول|فهمٌ لا فتوى|معرفةٌ مستقرة غير منقولة)】/u;

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
  };
}

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

// The frame ends at a connector or punctuation. Capturing the frame separately lets us remove the
// attribution without performing surgery on the claim that follows it.
const ATTRIBUTION_PATTERNS = Object.freeze([
  /(?:^|[\s،؛])(?<frame>(?:قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?))\s+(?<connector>إن|أن|بأن)\s+/u,
  /(?:^|[\s،؛])(?<frame>(?:قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?))\s*[:،]\s*/u,
  /(?:^|[\s،؛])(?<frame>(?:بحسب|عند)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?))\s*[:،]\s*/u,
  /(?:^|[\s،؛])(?<frame>وفق(?:ًا|ا)?\s+ل(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?))\s*[:،]\s*/u,
  /(?:^|[\s،؛])(?<frame>(?:قول|رأي|فتوى)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?))\s+(?<connector>إن|أن|بأن)\s+/u,
  /(?:^|[\s،؛])(?<frame>(?:يرى|ذهب)\s+(?:(?:فضيلة|سماحة)\s+)?(?:(?:الشيخ|الإمام|العلامة|الدكتور)\s+)?(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?))\s+(?=(?:جواز|وجوب|حرمة|تحريم|منع|استحباب|كراهة)(?=\s|$|[،.!؟]))/u,
  /(?:^|[\s،؛])(?<frame>(?<name>[\p{Script=Arabic}][\p{Script=Arabic}\s]{1,55}?)\s+(?:قال|يرى|ذكر|أفتى))\s+(?<connector>إن|أن|بأن)\s+/u,
]);

function detectAttribution(sentence) {
  for (const pattern of ATTRIBUTION_PATTERNS) {
    const match = pattern.exec(sentence);
    if (!match?.groups?.name) continue;
    const claimed = match.groups.name.trim();
    if (!claimed) continue;
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

function sentenceParts(text) {
  return String(text ?? '').replace(/\r\n?/gu, '\n').split(/(?<=[.!؟])\s+|\n+/u)
    .map((part) => part.trim()).filter(Boolean);
}

function sentenceDomain(sentence, overall) {
  if (overall !== 'mixed') return overall;
  return FIQH_MARKERS.test(sentence) ? 'fiqh' : 'general';
}

function tag(sentence, visibleTag) {
  if (VISIBLE_TAG.test(sentence)) return sentence;
  return `${sentence.trim()} ${visibleTag}`;
}

function generalizeAttribution(sentence, attribution) {
  const before = sentence.slice(0, attribution.start).trim();
  const claim = sentence.slice(attribution.end).trim();
  const usable = (claim || before).replace(/^ب(?=جواز|وجوب|حرمة|تحريم|منع|استحباب|كراهة)/u, '');
  if (!usable) return '';
  const prefix = before ? `${before} ` : '';
  return `${prefix}الفهمُ العامُّ من المعطياتِ المتاحة: ${usable}`.trim();
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

function attributedEvidenceFor(sentence, attribution, evidence) {
  return evidence.find((item) => sameAuthority(attribution.claimed, item.scholar)
    && officialSourceFor(attribution.claimed, item)
    && supportsSentence(sentence, item)) || null;
}

function actionRecord(index, domain, action, input, output, extra = {}) {
  return Object.freeze({ sentence: index + 1, domain, action, input, output, ...extra });
}

/**
 * Review one proposed answer without I/O or ambient state.
 *
 * @param {{text: string, evidence: Array<object>, domain: 'fiqh'|'general'|'mixed', mode: string}} input
 * @returns {{text: string, annotations: Array<object>, verdict: object}}
 */
export function reviewAnswer({ text, evidence, domain, mode } = {}) {
  if (!['fiqh', 'general', 'mixed'].includes(domain)) {
    throw new TypeError('reviewAnswer domain must be fiqh, general, or mixed');
  }

  const sources = Array.isArray(evidence) ? evidence.map(evidenceView) : [];
  const parts = sentenceParts(text);
  const annotations = [];
  const output = [];

  for (const [index, sentence] of parts.entries()) {
    const scopedDomain = sentenceDomain(sentence, domain);
    if (scopedDomain === 'fiqh') {
      const attribution = detectAttribution(sentence);
      if (attribution) {
        const matched = attributedEvidenceFor(sentence, attribution, sources);
        if (matched) {
          output.push(sentence);
          annotations.push(actionRecord(index, scopedDomain, 'kept-sourced-attribution', sentence, sentence, {
            claimedAuthority: attribution.claimed,
            evidenceId: matched.id,
            source: matched.url || matched.identifier,
          }));
          continue;
        }

        const generalized = generalizeAttribution(sentence, attribution);
        const reviewed = generalized ? tag(generalized, TAGS.ATTRIBUTION_REMOVED) : '';
        if (reviewed) {
          output.push(reviewed);
          annotations.push(actionRecord(index, scopedDomain, 'removed-unsupported-attribution', sentence, reviewed, {
            claimedAuthority: attribution.claimed,
          }));
          continue;
        }
      }

      let reviewed = tag(sentence, TAGS.FIQH_UNSOURCED);
      if (KHILAF_MARKERS.test(sentence) && !reviewed.includes('تُراجَع المسألة مع أهل العلم')) {
        reviewed += KHILAF_TAIL;
      }
      output.push(reviewed);
      annotations.push(actionRecord(index, scopedDomain, 'tagged-fiqh-understanding', sentence, reviewed));
      continue;
    }

    if (DYNAMIC_MARKERS.test(sentence)) {
      const matched = dynamicEvidenceFor(sentence, sources);
      if (matched) {
        const tail = sourceTail(matched);
        const reviewed = sentence.includes(matched.url) && sentence.includes(matched.date)
          ? sentence : `${sentence}\n${tail}`;
        output.push(reviewed);
        annotations.push(actionRecord(index, scopedDomain, 'kept-dynamic-with-dated-source', sentence, reviewed, {
          evidenceId: matched.id, source: matched.url, date: matched.date,
        }));
      } else {
        output.push(DYNAMIC_UNSOURCED);
        annotations.push(actionRecord(index, scopedDomain, 'replaced-unsupported-dynamic-claim', sentence, DYNAMIC_UNSOURCED));
      }
      continue;
    }

    const reviewed = tag(sentence, TAGS.GENERAL_STABLE);
    output.push(reviewed);
    annotations.push(actionRecord(index, scopedDomain, 'tagged-stable-general-knowledge', sentence, reviewed));
  }

  // REVIEWER_INVARIANT_NON_EMPTY: a non-empty proposal may be shortened, but never annihilated.
  // Empty input also receives the explicit last rung, so every caller gets a usable string.
  const reviewedText = output.join('\n').trim() || LAST_RESORT;
  if (!output.length) {
    annotations.push(actionRecord(0, domain, 'last-resort-no-reliable-text', String(text ?? ''), reviewedText));
  }

  const counts = {};
  for (const item of annotations) counts[item.action] = (counts[item.action] || 0) + 1;
  const verdict = Object.freeze({
    version: 'freebrain-b-v1',
    domain,
    mode: String(mode ?? ''),
    sentences: annotations.map((item) => Object.freeze({
      sentence: item.sentence,
      domain: item.domain,
      action: item.action,
      evidenceId: item.evidenceId || null,
    })),
    counts: Object.freeze(counts),
    usedLastResort: reviewedText === LAST_RESORT,
  });

  return { text: reviewedText, annotations: Object.freeze(annotations), verdict };
}

export const REVIEW_TAGS = TAGS;
export const REVIEW_LAST_RESORT = LAST_RESORT;
export const REVIEW_DYNAMIC_UNSOURCED = DYNAMIC_UNSOURCED;
