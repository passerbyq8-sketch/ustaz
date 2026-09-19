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
// NO I/O, NO MODEL CALL, NO STATE.

// The registry is the one place a domain has a canonical Arabic name. Reading it here means a
// new admitted source is attributable the day its row lands, with no second table to update.
import { findSource } from './source-registry.js';

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
  const removed = [];
  const kept = [];

  for (const sentence of splitSentences(draft)) {
    if (!sentence.trim()) { kept.push(sentence); continue; }

    if (carriesLiveNumber(sentence)) {
      const sourced = carriesSource(sentence, vocabulary);
      const dated = carriesAbsoluteDate(sentence);
      if (!sourced || !dated) {
        removed.push({
          sentence: collapse(sentence),
          why: !sourced && !dated ? 'live-number-without-source-or-date'
            : !sourced ? 'live-number-without-source' : 'live-number-without-date',
        });
        continue;
      }
    }

    // The relative-date rule is checked on EVERY sentence, not only numeric ones: «اندلع الحريق
    // أمس» is a live claim with an unresolvable date in it, and it is the «خبرٌ حيّ» half of the
    // governing rule.
    if (carriesRelativeDate(sentence) && !carriesAbsoluteDate(sentence)) {
      removed.push({ sentence: collapse(sentence), why: 'relative-date-without-absolute' });
      continue;
    }

    kept.push(sentence);
  }

  const out = kept.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: out, removed, emptied: out.length === 0 };
}
