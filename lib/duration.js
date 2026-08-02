// lib/duration.js
// ARABIC PERIODS, READ AS RANGES OF DAYS.
//
// WHY THIS EXISTS. The first version of the attribution gate asked only "does the source mention
// time at all?" — and that is not a question worth asking. A reader who asks about ninety days is
// not answered by a page about the second month, however many days both of them talk about. In
// this subject the PERIOD IS THE RULING: the same blood is dam fasād before the human form is
// distinguishable and nifās after it, and the only thing separating those two answers is when.
//
// SO THE RULE IS INTERSECTION, NOT PRESENCE. A question fixes a range of days. A source fixes
// one or more. If none of the source's ranges overlaps the question's, the source is about
// somebody else's case and must be refused, even though it is a real page by the right scholar
// on the right subject.
//
// CONSERVATIVE ON PURPOSE. Everything here can only ever say "these two ranges provably do not
// meet". Where a phrase is unparseable it contributes nothing rather than a guess, and where the
// SOURCE states no period at all the caller — not this module — decides what that means. Nothing
// in this file infers a ruling; it only compares numbers.

// ── Numerals ─────────────────────────────────────────────────────────────────
// Arabic-Indic (٠١٢…) and Extended Arabic-Indic (۰۱۲…) alongside ASCII, because a reader typing
// on an Arabic keyboard produces the first and a reader on a Persian/Urdu layout the second.
const DIGIT_MAP = {};
for (let i = 0; i <= 9; i++) {
  DIGIT_MAP[String.fromCharCode(0x0660 + i)] = String(i);   // ٠-٩
  DIGIT_MAP[String.fromCharCode(0x06F0 + i)] = String(i);   // ۰-۹
}
export function westernDigits(s) {
  return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d]);
}

// Arabic punctuation lives INSIDE the Arabic Unicode block, so a "keep only Arabic and digits"
// filter keeps «؟» glued to the word before it. MEASURED here exactly as it was in
// lib/binothaimeen.js: "دون 80 يوم؟" produced the unit token «يوم؟», which is in no table, so the
// whole question parsed as fixing no period at all and the duration check silently never fired.
const AR_PUNCT = /[؀-؅،؛؞؟٪-٭۔۝«»]/g;

function norm(s) {
  return westernDigits(s)
    .replace(AR_PUNCT, ' ')
    .replace(/[ً-ْٰٟـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/[^؀-ۿ0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cardinals as words. Only what a fatwa or a reader actually writes; an unknown word simply
// does not parse, which is the safe outcome.
const CARDINALS = {
  'واحد': 1, 'واحده': 1, 'اثنين': 2, 'اثنان': 2, 'يومين': 2, 'شهرين': 2, 'اسبوعين': 2, 'سنتين': 2,
  'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4, 'خمس': 5, 'خمسه': 5, 'ست': 6, 'سته': 6,
  'سبع': 7, 'سبعه': 7, 'ثمان': 8, 'ثمانيه': 8, 'تسع': 9, 'تسعه': 9, 'عشر': 10, 'عشره': 10,
  'عشرين': 20, 'ثلاثين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70,
  'ثمانين': 80, 'تسعين': 90, 'مئه': 100, 'ماىه': 100, 'مايه': 100, 'مئتين': 200,
};
// Ordinals, for "الشهر الثاني" and its siblings.
const ORDINALS = {
  'الاول': 1, 'اول': 1, 'الثاني': 2, 'ثاني': 2, 'الثالث': 3, 'ثالث': 3, 'الرابع': 4, 'رابع': 4,
  'الخامس': 5, 'خامس': 5, 'السادس': 6, 'سادس': 6, 'السابع': 7, 'سابع': 7, 'الثامن': 8, 'ثامن': 8,
  'التاسع': 9, 'تاسع': 9, 'العاشر': 10, 'عاشر': 10,
};
// Days per unit. A month is 30 days here; nothing in this module turns on the difference between
// 30 and 29, because every comparison it makes is an overlap test with wide bands.
const UNIT_DAYS = {
  'يوم': 1, 'يوما': 1, 'ايام': 1, 'يومين': 1,
  'اسبوع': 7, 'اسابيع': 7, 'اسبوعا': 7, 'اسبوعين': 7,
  'شهر': 30, 'شهرا': 30, 'اشهر': 30, 'شهور': 30, 'شهرين': 30,
  'سنه': 365, 'سنوات': 365, 'سنين': 365, 'عام': 365, 'اعوام': 365, 'سنتين': 365,
};
// Words that are themselves a count AND a unit ("شهرين" = two months).
const DUAL = { 'يومين': 2, 'شهرين': 2, 'اسبوعين': 2, 'سنتين': 2 };

// Relations. Longest first, so "اقل من" is not read as the bare "من".
const RELATIONS = [
  { words: ['دون', 'اقل من', 'اصغر من', 'قبل', 'تحت'], kind: 'before' },
  { words: ['اكثر من', 'اكبر من', 'بعد', 'فوق', 'يزيد على', 'يزيد عن'], kind: 'after' },
  { words: ['خلال', 'اثناء', 'في', 'عند', 'ب'], kind: 'within' },
];

const INF = Number.POSITIVE_INFINITY;

// ── Parsing ──────────────────────────────────────────────────────────────────
// Returns an array of { lo, hi, text } day ranges, inclusive of lo and hi. An empty array means
// "this text fixes no period", which is a fact the caller may act on but this module will not.
export function parseRanges(text) {
  const t = norm(text);
  if (!t) return [];
  const words = t.split(' ');
  const out = [];

  const relationAt = (i) => {
    // look back up to three words for a relation word or phrase
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const one = words[i - back];
      const two = words.slice(i - back, i - back + 2).join(' ');
      for (const r of RELATIONS) {
        if (r.words.includes(two) || r.words.includes(one)) return r.kind;
      }
    }
    return 'within';
  };

  // The definite article is not part of the unit. "الشهر الثاني" and "شهرين" are the same noun
  // wearing different clothes, and a lookup table that misses the article silently parses nothing
  // at all — which is how the first version of this file read the target fatwa's own title as
  // fixing no period whatsoever.
  const bare = (x) => (x && x.length > 3 && x.slice(0, 2) === 'ال' ? x.slice(2) : x);

  for (let i = 0; i < words.length; i++) {
    const w = bare(words[i]);

    // 1. ORDINAL BAND: "الشهر الثاني" / "الاسبوع الثالث" -> the whole of that unit.
    const unitDays = UNIT_DAYS[w];
    if (unitDays && ORDINALS[words[i + 1]] !== undefined) {
      const n = ORDINALS[words[i + 1]];
      out.push({ lo: (n - 1) * unitDays + 1, hi: n * unitDays, text: w + ' ' + words[i + 1] });
      i++;
      continue;
    }

    // 2. A DUAL noun is its own count: "الشهرين", "شهرين".
    if (DUAL[w] !== undefined) {
      const days = UNIT_DAYS[w] * DUAL[w];
      const kind = relationAt(i);
      out.push(rangeFor(kind, days, w));
      continue;
    }

    // 3. COUNT + UNIT, the count in digits or in words.
    let count = null;
    if (/^\d{1,4}$/.test(w)) count = parseInt(w, 10);
    else if (CARDINALS[w] !== undefined) count = CARDINALS[w];
    if (count === null) continue;

    // the unit may be the next word, or the one after ("ثلاثة من الأشهر" is rare but cheap to allow)
    let unit = null, span = 1;
    for (let j = 1; j <= 2 && i + j < words.length; j++) {
      const u = bare(words[i + j]);
      if (UNIT_DAYS[u] !== undefined) { unit = u; span = j; break; }
    }
    if (!unit) continue;
    const days = count * UNIT_DAYS[unit];
    const kind = relationAt(i);
    out.push(rangeFor(kind, days, count + ' ' + unit));
    i += span;
  }
  return out;
}

function rangeFor(kind, days, text) {
  if (kind === 'before') return { lo: 0, hi: Math.max(0, days - 1), text };
  if (kind === 'after') return { lo: days + 1, hi: INF, text };
  // "within/at" is a point with a tolerance of the unit it was expressed in — a reader who says
  // "في الشهر الثاني" and one who says "بعد شهرين" are describing the same stretch of time, and
  // treating either as an exact day would refuse a source that is plainly about their case.
  return { lo: Math.max(0, days - 30), hi: days + 30, text };
}

export function overlaps(a, b) {
  return a.lo <= b.hi && b.lo <= a.hi;
}

// ── The one question this module answers ─────────────────────────────────────
// 'compatible'   — the periods provably meet, or the question fixes none
// 'incompatible' — both fix periods and none of them meet
// 'unknown'      — the question fixes a period and the source fixes none
//
// The caller decides what 'unknown' costs. On the attributed path it costs the answer, because a
// source that never says when cannot be shown to be about a reader who asked when.
// The source is read TITLE FIRST, and that is deliberate. On a fatwa page the title states the
// case being ruled on; the body may mention other periods in passing while answering it. The
// second-month fatwa remarks that form is usually distinguishable at three months — a true aside
// that must not turn the page into an answer for a reader asking about ninety days. So when the
// title fixes a period, the title is the case; the body is consulted only when it does not.
export function compareDurations(questionText, sourcePrimary, sourceFallback) {
  const q = parseRanges(questionText);
  if (!q.length) return { verdict: 'compatible', question: [], source: [] };
  let s = parseRanges(sourcePrimary);
  if (!s.length && sourceFallback) s = parseRanges(sourceFallback);
  if (!s.length) return { verdict: 'unknown', question: q, source: [] };
  for (const a of q) for (const b of s) if (overlaps(a, b)) return { verdict: 'compatible', question: q, source: s, matched: [a.text, b.text] };
  return { verdict: 'incompatible', question: q, source: s };
}
