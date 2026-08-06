// lib/duration.js
// ARABIC PERIODS, READ AS RANGES OF DAYS — AND COMPARED BY COVERAGE, NOT BY OVERLAP.
//
// WHY THIS FILE EXISTS. The first version of the attribution gate asked only "does the source
// mention time at all?", and that is not a question worth asking: a reader asking about ninety
// days is not answered by a page about the second month however many days both of them mention.
//
// WHY IT WAS REWRITTEN. The second version asked "do the two periods overlap?", and overlap is
// still not enough — it is the error this file now exists to prevent. «دون ثمانين يومًا» is a
// WIDER range than «الشهر الثاني»: the second month is days 31–60, and a woman who miscarried on
// day 20 or day 75 is inside her question and outside that page. A page that answers PART of a
// question is not a source for the question; presenting it as one silently generalises a ruling
// past what its author said. So the test is CONTAINMENT: every day the reader asked about must be
// a day the source speaks to. Anything less refuses.
//
// THREE THINGS ARE RANKED, in this order, and none of them is a model's opinion:
//   1. THE SAME LIMIT, THE SAME WAY. The reader asks "before eighty"; the source says «قبل
//      الثمانين». Same boundary, same direction — nothing beats this.
//   2. FULL COVERAGE. The source's rule contains the reader's whole range, even if it draws its
//      line somewhere else («قبل تمام أربعة أشهر» contains "before eighty days").
//   3. NOTHING ELSE. Partial overlap is refused, and a source that fixes no period at all while
//      the reader fixed one is refused.
//
// CONSERVATIVE THROUGHOUT. An unparseable phrase contributes nothing rather than a guess, and a
// boundary day the source does not settle outright is refused rather than assumed. Nothing here
// infers a ruling; it only compares numbers.

// ── Numerals ─────────────────────────────────────────────────────────────────
// Arabic-Indic (٠١٢…) and Extended Arabic-Indic (۰۱۲…) alongside ASCII, because a reader typing
// on an Arabic keyboard produces the first and one on a Persian/Urdu layout the second.
const DIGIT_MAP = {};
for (let i = 0; i <= 9; i++) {
  DIGIT_MAP[String.fromCharCode(0x0660 + i)] = String(i);   // ٠-٩
  DIGIT_MAP[String.fromCharCode(0x06F0 + i)] = String(i);   // ۰-۹
}
export function westernDigits(s) {
  return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d]);
}

// Arabic punctuation lives INSIDE the Arabic Unicode block, so a "keep only Arabic and digits"
// filter keeps «؟» glued to the word before it. MEASURED: "دون 80 يوم؟" produced the unit token
// «يوم؟», which is in no table, so the whole question parsed as fixing no period at all and the
// duration check silently never fired.
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

// Cardinals as words. Only what a fatwa or a reader actually writes; an unknown word does not
// parse, which is the safe outcome.
// EXPORTED because lib/policy/consistency-gate.js reads the SAME table to spot an arithmetically
// false comparison in a draft. Two number tables in two files are two answers to «what is
// ثمانين», and the one that is wrong is always the one nobody is looking at.
export const CARDINALS = {
  'واحد': 1, 'واحده': 1, 'اثنين': 2, 'اثنان': 2, 'يومين': 2, 'شهرين': 2, 'اسبوعين': 2, 'سنتين': 2,
  'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4, 'خمس': 5, 'خمسه': 5, 'ست': 6, 'سته': 6,
  'سبع': 7, 'سبعه': 7, 'ثمان': 8, 'ثمانيه': 8, 'تسع': 9, 'تسعه': 9, 'عشر': 10, 'عشره': 10,
  'عشرين': 20, 'ثلاثين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70,
  'ثمانين': 80, 'تسعين': 90, 'مىه': 100, 'مايه': 100, 'مىتين': 200,
};
// Ordinals, for "الشهر الثاني" and its siblings.
const ORDINALS = {
  'الاول': 1, 'اول': 1, 'الثاني': 2, 'ثاني': 2, 'الثالث': 3, 'ثالث': 3, 'الرابع': 4, 'رابع': 4,
  'الخامس': 5, 'خامس': 5, 'السادس': 6, 'سادس': 6, 'السابع': 7, 'سابع': 7, 'الثامن': 8, 'ثامن': 8,
  'التاسع': 9, 'تاسع': 9, 'العاشر': 10, 'عاشر': 10,
};
// Days per unit. A month is 30 days here; no comparison this module makes turns on 29 vs 30.
const UNIT_DAYS = {
  'يوم': 1, 'يوما': 1, 'ايام': 1, 'يومين': 1,
  'اسبوع': 7, 'اسابيع': 7, 'اسبوعا': 7, 'اسبوعين': 7,
  'شهر': 30, 'شهرا': 30, 'اشهر': 30, 'شهور': 30, 'شهرين': 30,
  'سنه': 365, 'سنوات': 365, 'سنين': 365, 'عام': 365, 'اعوام': 365, 'سنتين': 365,
};
// Words that are themselves a count AND a unit ("شهرين" = two months).
const DUAL = { 'يومين': 2, 'شهرين': 2, 'اسبوعين': 2, 'سنتين': 2 };

// Directions. 'from' is separate from 'after' on purpose: «من ثمانين يومًا فما فوق» INCLUDES day
// eighty and «بعد ثمانين يومًا» does not, and day eighty is exactly the day this whole gate is
// arguing about.
const BEFORE = ['دون', 'اقل من', 'اصغر من', 'قبل', 'تحت', 'قبل تمام', 'لم يبلغ', 'ما دون'];
const AFTER = ['بعد', 'اكثر من', 'اكبر من', 'فوق', 'يزيد على', 'يزيد عن', 'تجاوز', 'بلغ'];
const FROM = ['من'];                    // only when followed later by «فما فوق» / «فاكثر»
const FROM_TAIL = ['فما فوق', 'فاكثر', 'فما زاد', 'وما فوق', 'وما زاد'];

const INF = Number.POSITIVE_INFINITY;

// ── Parsing ──────────────────────────────────────────────────────────────────
// Returns [{ lo, hi, boundary, direction, text }]. Empty means "this text fixes no period",
// which is a fact the caller may act on but this module will not.
export function parseRanges(text) {
  const t = norm(text);
  if (!t) return [];
  const words = t.split(' ');
  const out = [];

  // The definite article is not part of the unit: «الشهر الثاني» and «شهرين» are the same noun in
  // different clothes, and a table that misses the article parses nothing at all.
  const bare = (x) => (x && x.length > 3 && x.slice(0, 2) === 'ال' ? x.slice(2) : x);

  // DOMINANT UNIT. A text that has said "eighty days" once may then say «قبل الثمانين» with no
  // unit at all, and that bare definite cardinal is the single most important phrase on the page
  // this gate was rewritten for. It inherits the unit the text itself established; where the text
  // established none, it is skipped rather than guessed.
  let dominant = null;
  for (let i = 0; i < words.length; i++) {
    const u = bare(words[i]);
    if (UNIT_DAYS[u] !== undefined && !DUAL[u]) { dominant = u; break; }
  }

  const directionAt = (i) => {
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const one = words[i - back];
      const two = words.slice(i - back, i - back + 2).join(' ');
      if (BEFORE.includes(two) || BEFORE.includes(one)) return 'before';
      if (AFTER.includes(two) || AFTER.includes(one)) return 'after';
      if (FROM.includes(one)) {
        const tail = words.slice(i + 1, i + 5).join(' ');
        if (FROM_TAIL.some((f) => tail.indexOf(f) === 0 || tail.indexOf(' ' + f) !== -1 || tail.startsWith(f))) return 'from';
      }
    }
    return 'at';
  };

  for (let i = 0; i < words.length; i++) {
    const w = bare(words[i]);

    // 1. ORDINAL BAND: «الشهر الثاني» -> the whole of that unit.
    const unitDays = UNIT_DAYS[w];
    if (unitDays && ORDINALS[words[i + 1]] !== undefined) {
      const n = ORDINALS[words[i + 1]];
      out.push({ lo: (n - 1) * unitDays + 1, hi: n * unitDays, boundary: null, direction: 'band', text: w + ' ' + words[i + 1] });
      i++;
      continue;
    }

    // 2. A DUAL noun is its own count: «الشهرين», «شهرين».
    if (DUAL[w] !== undefined) {
      out.push(rangeFor(directionAt(i), UNIT_DAYS[w] * DUAL[w], w));
      continue;
    }

    // 3. COUNT + UNIT, the count in digits or in words.
    let count = null;
    if (/^\d{1,4}$/.test(w)) count = parseInt(w, 10);
    else if (CARDINALS[w] !== undefined) count = CARDINALS[w];
    if (count === null) continue;

    // The unit must FOLLOW IMMEDIATELY. Allowing a gap once read «قبل الثمانين وثلاثة أشهر» as
    // "eighty MONTHS", which is 2400 days and pure nonsense.
    let unit = null;
    const next = bare(words[i + 1]);
    if (UNIT_DAYS[next] !== undefined) unit = next;

    if (!unit) {
      // A BARE DEFINITE CARDINAL with a direction — «قبل الثمانين». It only counts when the text
      // has already named a unit of its own, and it borrows that.
      const isDefinite = words[i].slice(0, 2) === 'ال';
      const dir = directionAt(i);
      if (isDefinite && dominant && dir !== 'at') {
        out.push(rangeFor(dir, count * UNIT_DAYS[dominant], words[i]));
      }
      continue;
    }
    out.push(rangeFor(directionAt(i), count * UNIT_DAYS[unit], count + ' ' + unit));
    i += 1;
  }
  return out;
}

function rangeFor(direction, days, text) {
  if (direction === 'before') return { lo: 0, hi: Math.max(0, days - 1), boundary: days, direction, text };
  if (direction === 'after') return { lo: days + 1, hi: INF, boundary: days, direction, text };
  if (direction === 'from') return { lo: days, hi: INF, boundary: days, direction, text };
  // A bare period with no direction is a POINT, not a neighbourhood. An earlier version gave it
  // ±30 days of slack, which is a third of a pregnancy and turned every passing mention into
  // coverage of everything nearby.
  return { lo: days, hi: days, boundary: days, direction: 'at', text };
}

export function overlaps(a, b) { return a.lo <= b.hi && b.lo <= a.hi; }
export function contains(outer, inner) { return outer.lo <= inner.lo && inner.hi <= outer.hi; }

// Union of everything a text says about time, merged. Ranges that touch or overlap are joined,
// because «قبل الثمانين» next to «من ثمانين فما فوق» really does cover every day there is.
export function coverage(text) {
  const rs = parseRanges(text).slice().sort((a, b) => a.lo - b.lo);
  const out = [];
  for (const r of rs) {
    const last = out[out.length - 1];
    if (last && r.lo <= last.hi + 1) last.hi = Math.max(last.hi, r.hi);
    else out.push({ lo: r.lo, hi: r.hi });
  }
  return out;
}
export function coversRange(cov, q) {
  return cov.some((c) => c.lo <= q.lo && q.hi <= c.hi);
}

// ── Search terms the QUESTION's own period implies ───────────────────────────
// MEASURED, and this is what finally reached the right page: a search for «قبل الثمانين» on the
// Shaykh's site returns exactly ONE document — «ضابط السقط الذي تترك المرأة لأجله الصلاة» — and
// it is the page that states the eighty-day limit and the ruling together. The reader never typed
// those words; her question said «دون 80 يوم». The terms below are derived from the number she
// gave, not from anything a model suggested.
const WORD_FOR = {
  10: 'العشرة', 20: 'العشرين', 30: 'الثلاثين', 40: 'الأربعين', 50: 'الخمسين', 60: 'الستين',
  70: 'السبعين', 80: 'الثمانين', 90: 'التسعين', 100: 'المائة', 120: 'المائة والعشرين',
};
const BARE_WORD_FOR = {
  40: 'أربعين', 50: 'خمسين', 60: 'ستين', 70: 'سبعين', 80: 'ثمانين', 90: 'تسعين', 120: 'مائة وعشرين',
};
// A POINT IN DAYS IS ALSO A MONTH, and on this site that is how the fatwas are titled. A reader
// who says "fifty days" is asking about the second month whether she uses the word or not, so the
// ordinal month containing her day is derived and searched for by name. It is a search term, not
// a finding: whatever comes back still has to COVER her day before it may be used.
const MONTH_WORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];

export function durationTerms(questionText) {
  const out = [];
  for (const r of parseRanges(questionText)) {
    if (r.direction === 'band') { out.push(r.text.replace(/^شهر /, 'الشهر ')); continue; }
    const d = r.boundary;
    if (!d) continue;
    const defWord = WORD_FOR[d];
    const bareWord = BARE_WORD_FOR[d];
    if (r.direction === 'before') {
      if (defWord) out.push('قبل ' + defWord);
      if (bareWord) out.push('قبل ' + bareWord + ' يوماً');
      if (defWord) out.push('دون ' + defWord);
    } else if (r.direction === 'after' || r.direction === 'from') {
      if (defWord) out.push('بعد ' + defWord);
      if (bareWord) out.push('بعد ' + bareWord + ' يوماً');
    } else {
      // a bare point: the month that contains it, then the day itself
      const m = Math.ceil(d / 30);
      if (m >= 1 && m < MONTH_WORD.length) out.push('الشهر ' + MONTH_WORD[m]);
    }
    if (bareWord) out.push(bareWord + ' يوماً');
  }
  return Array.from(new Set(out)).slice(0, 5);
}

// ── The one question this module answers ─────────────────────────────────────
// verdict:
//   'no-question-period' — the reader fixed no period; this module has nothing to say
//   'exact-boundary'     — the source draws THE SAME line in THE SAME direction  (tier 0)
//   'covered'            — the source's rule contains the reader's whole range   (tier 1)
//   'partial'            — they meet but the source does not cover her           (REFUSE)
//   'unknown'            — the source fixes no period at all                     (REFUSE)
//
// Title and body are read TOGETHER here, unlike the overlap version. Coverage is a claim about
// what the page RULES, and a page's rule is as often in its answer as in its heading; requiring
// containment is already strict enough that reading the whole page cannot let a wrong one in.
export function compareDurations(questionText, sourcePrimary, sourceFallback) {
  const q = parseRanges(questionText);
  if (!q.length) return { verdict: 'no-question-period', tier: 2, question: [], source: [] };

  const whole = String(sourcePrimary || '') + ' \n ' + String(sourceFallback || '');
  const s = parseRanges(whole);
  if (!s.length) return { verdict: 'unknown', tier: 9, question: q, source: [] };
  const cov = coverage(whole);

  // TIER 0 — the same limit, drawn the same way.
  for (const a of q) {
    for (const b of s) {
      if (a.boundary && b.boundary === a.boundary && sameDirection(a.direction, b.direction)) {
        return { verdict: 'exact-boundary', tier: 0, question: q, source: s, matched: [a.text, b.text] };
      }
    }
  }
  // TIER 1 — every day she asked about is a day the source speaks to.
  if (q.every((a) => coversRange(cov, a))) {
    return { verdict: 'covered', tier: 1, question: q, source: s, coverage: cov };
  }
  // Anything else. Overlap without containment is the failure this rewrite exists to name.
  const touching = q.some((a) => s.some((b) => overlaps(a, b)));
  return { verdict: touching ? 'partial' : 'unknown', tier: 9, question: q, source: s, coverage: cov };
}

function sameDirection(a, b) {
  if (a === b) return true;
  // "after eighty" and "from eighty upwards" draw the same line for a reader asking about what
  // comes later; they differ only on the boundary day itself, which tier 1 then has to cover.
  return (a === 'after' && b === 'from') || (a === 'from' && b === 'after');
}

// Is this source acceptable at all for this question?
export function durationAcceptable(verdict) {
  return verdict === 'no-question-period' || verdict === 'exact-boundary' || verdict === 'covered';
}
