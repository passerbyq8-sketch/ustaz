#!/usr/bin/env node
/* ============================================================================
 * layout-guard.cjs  --  GATE 5 of 5.  Al-Murabbi / 14.2 "al-Mushaf al-Musaffah"
 *
 * WHAT IT GUARDS
 *   mushaf-layout.json : 604 pages of Madani line-breaks, expressed ONLY as word
 *                        positions ("S:A:W"). No text. No glyphs. No surah names.
 *                        No ayah numbers. Typographic boundary facts, nothing else.
 *
 * WHY IT NEEDS NO GOLDEN FILE
 *   quran-guard.cjs compares the mushaf against quran-golden.json.
 *   layout-guard.cjs has no golden file BECAUSE THE QURAN *IS* ITS GOLDEN.
 *   The whole proof is: every ayah's slot-count in the layout must equal that
 *   ayah's word-count in quran-uthmani.json. 6236 out of 6236. Nothing else can
 *   stand in for that. A golden file here would only re-freeze a derived number.
 *
 * WHY IT PINS THE QURAN'S SHA
 *   The binding was proven against ONE mushaf. If quran-uthmani.json ever
 *   changes, the binding is no longer proven -- it is merely assumed. So this
 *   guard refuses to certify anything until the mushaf is the one it was proven
 *   against. Change the mushaf -> re-run quran-verify.cjs -> re-emit the layout.
 *
 * OUTPUT IS PURE ASCII.  A guard that prints raw Arabic to a Windows terminal is
 * a guard that lies (rule Q1). Failures print ayah keys and U+XXXX code points.
 *
 * NETWORK: NONE. Runs offline. Safe in CI, safe in a pre-commit hook.
 *
 * USAGE
 *   node layout-guard.cjs
 *   node layout-guard.cjs --compare <quran-uthmani.json> <mushaf-layout.json>
 *
 * EXIT 0 = PASS.  EXIT 1 = FAIL.
 * ==========================================================================*/

'use strict';
const fs = require('fs');
const crypto = require('crypto');

/* --------------------------------------------------------------------------
 * FROZEN ANCHORS
 * ------------------------------------------------------------------------ */

// Byte-sha of the mushaf this layout was PROVEN against. Do not edit casually.
const QURAN_SHA =
  'd4fd1a1507f70a4261789eaec8380750cd0f65f4d641f6df2ef6334b18c6877b';

// Byte-sha of the layout asset as emitted and proven. Catches a silent swap.
const LAYOUT_SHA =
  '52aaafeafdfd2993d8c54b78211fbf2399bc24ae9627892cd38597e87400e90f';

const N_PAGES = 604;
const N_AYAT = 6236;
const N_SURAHS = 114;
const N_SLOTS = 77429;
const N_LINES = 9040;

/* THE FOUR TYPOGRAPHIC LIGATURES.
 * These are NOT defects. The Madani layout prints two words inside a single
 * boxed slot, and the source data says so itself (the slot's own text carries
 * both words separated by a space). So for exactly these four ayat -- and ONLY
 * these four -- the Quran has one word MORE than the layout has slots.
 *
 * This table is a CEILING, not a licence. If a fifth ayah ever needs to be in
 * it, this guard fires and you go look at why. That is the entire point.
 */
const LIGATURES = {
  '2:181': 1, //  BA'DA MAA   -> one slot
  '8:6': 1, //  BA'DA MAA   -> one slot
  '13:37': 1, //  BA'DA MAA   -> one slot
  '37:130': 1, //  IL YAASEEN  -> one slot
};

/* --------------------------------------------------------------------------
 * THE WORD COUNTER  --  the single rule the whole proof rests on
 *
 *   A WORD is a whitespace-token that contains at least one ARABIC LETTER.
 *
 * A standalone waqf mark is NOT a word. Neither is the rub'-el-hizb sign, nor
 * the sajdah sign. They are marks; the layout attaches them to the preceding
 * word and never gives them a slot of their own.
 *
 * The naive split(/\s+/) counts them as words. It produces 2721 FALSE
 * mismatches out of 6236. That number is the reason this function exists and
 * the reason it is spelled out here instead of being inlined somewhere clever.
 * ------------------------------------------------------------------------ */
function isArabicLetter(cp) {
  return (
    (cp >= 0x0621 && cp <= 0x063a) || // hamza .. ghain
    (cp >= 0x0641 && cp <= 0x064a) || // feh .. yeh   (0x0640 tatweel excluded)
    (cp >= 0x0671 && cp <= 0x06d3) // alef wasla and extended letters
  );
  // Deliberately EXCLUDED, because they are marks and not letters:
  //   U+064B..U+0652  harakat        U+0670  superscript alef
  //   U+06D6..U+06DC  waqf marks     U+06DD  end of ayah
  //   U+06DE          rub el hizb    U+06E9  sajdah
  //   U+08D3..U+08FF  Arabic Extended-A marks
}

function countWords(ayahText) {
  let n = 0;
  for (const token of ayahText.split(/\s+/)) {
    if (!token) continue;
    for (const ch of token) {
      if (isArabicLetter(ch.codePointAt(0))) {
        n++;
        break;
      }
    }
  }
  return n;
}

/* --------------------------------------------------------------------------
 * PLUMBING
 * ------------------------------------------------------------------------ */
const argv = process.argv.slice(2);
let quranPath = 'quran-uthmani.json';
let layoutPath = 'mushaf-layout.json';
if (argv[0] === '--compare') {
  if (argv[1]) quranPath = argv[1];
  if (argv[2]) layoutPath = argv[2];
}

const failures = [];
const notes = [];
function fail(code, detail) {
  failures.push(code + (detail ? '  ' + detail : ''));
}
function head(s) {
  console.log('\n' + s);
  console.log('-'.repeat(s.length));
}

/* --------------------------------------------------------------------------
 * 0. LOAD + PIN
 * ------------------------------------------------------------------------ */
head('layout-guard.cjs  --  GATE 5  --  mushaf line-break binding');

let quranBuf, layoutBuf;
try {
  quranBuf = fs.readFileSync(quranPath);
} catch (e) {
  console.log('FATAL  cannot read ' + quranPath);
  process.exit(1);
}
try {
  layoutBuf = fs.readFileSync(layoutPath);
} catch (e) {
  console.log('FATAL  cannot read ' + layoutPath);
  process.exit(1);
}

const quranSha = crypto.createHash('sha256').update(quranBuf).digest('hex');
const layoutSha = crypto.createHash('sha256').update(layoutBuf).digest('hex');

console.log('quran  : ' + quranPath);
console.log('         bytes ' + quranBuf.length + '  sha256 ' + quranSha);
console.log('layout : ' + layoutPath);
console.log('         bytes ' + layoutBuf.length + '  sha256 ' + layoutSha);

if (quranSha !== QURAN_SHA) {
  fail(
    'QURAN_CHANGED',
    'the mushaf is NOT the one this binding was proven against.\n' +
      '                 expected ' +
      QURAN_SHA +
      '\n' +
      '                 got      ' +
      quranSha +
      '\n' +
      '                 -> the 6236/6236 binding is now ASSUMED, not PROVEN.\n' +
      '                 -> run quran-verify.cjs, then re-emit the layout, then re-pin.'
  );
}
if (layoutSha !== LAYOUT_SHA) {
  fail(
    'LAYOUT_SWAPPED',
    'expected ' + LAYOUT_SHA + '\n                 got      ' + layoutSha
  );
}

let quran, layout;
try {
  quran = JSON.parse(quranBuf.toString('utf8'));
} catch (e) {
  console.log('\nFATAL  quran is not valid JSON');
  process.exit(1);
}
try {
  layout = JSON.parse(layoutBuf.toString('utf8'));
} catch (e) {
  console.log('\nFATAL  layout is not valid JSON');
  process.exit(1);
}

/* --------------------------------------------------------------------------
 * 1. THE LAYOUT CARRIES NO SCRIPTURE
 *    The asset must be facts about boundaries. If a single Arabic codepoint
 *    ever appears in it, then somebody put Quranic text in an UNGUARDED file,
 *    and quran-guard.cjs cannot see it. That is the one thing we will not have.
 * ------------------------------------------------------------------------ */
head('1. the layout carries no scripture');
{
  const s = layoutBuf.toString('utf8');
  let leak = 0,
    firstAt = -1,
    firstCp = 0;
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    if ((cp >= 0x0600 && cp <= 0x08ff) || (cp >= 0xfb50 && cp <= 0xfeff)) {
      leak++;
      if (firstAt < 0) {
        firstAt = i;
        firstCp = cp;
      }
    }
  }
  if (leak === 0) {
    console.log('   OK   0 Arabic / presentation-form codepoints. Positions only.');
  } else {
    fail(
      'SCRIPTURE_LEAK',
      leak +
        ' Arabic codepoints in the layout asset; first is U+' +
        firstCp.toString(16).toUpperCase().padStart(4, '0') +
        ' at byte-offset ' +
        firstAt
    );
  }
}

/* --------------------------------------------------------------------------
 * 2. SHAPE
 * ------------------------------------------------------------------------ */
head('2. shape');
if (!Array.isArray(layout.p)) {
  console.log('FATAL  layout.p is not an array');
  process.exit(1);
}
if (layout.p.length !== N_PAGES)
  fail('PAGE_COUNT', 'expected ' + N_PAGES + ', got ' + layout.p.length);

let lineTotal = 0;
let slotTotal = 0;
for (let i = 0; i < layout.p.length; i++) {
  const pg = layout.p[i];
  if (pg.n !== i + 1) {
    fail('PAGE_ORDER', 'slot ' + i + ' carries page number ' + pg.n);
    break;
  }
  if (!Array.isArray(pg.l)) {
    fail('PAGE_SHAPE', 'page ' + pg.n + ' has no line array');
    continue;
  }
  for (let j = 0; j < pg.l.length; j++) {
    const ln = pg.l[j];
    lineTotal++;
    if (ln.n !== j + 1)
      fail('LINE_ORDER', 'page ' + pg.n + ' line-slot ' + j + ' carries n=' + ln.n);
    if (ln.t !== 'h' && ln.t !== 'b' && ln.t !== 't')
      fail('LINE_TYPE', 'page ' + pg.n + ' line ' + ln.n + ' type=' + ln.t);
    if (ln.t === 't') {
      if (!Array.isArray(ln.w) || ln.w.length === 0)
        fail('EMPTY_TEXT_LINE', 'page ' + pg.n + ' line ' + ln.n);
      else slotTotal += ln.w.length;
    } else if (ln.w !== undefined) {
      fail('CHROME_HAS_WORDS', 'page ' + pg.n + ' line ' + ln.n + ' type=' + ln.t);
    }
  }
}
if (lineTotal !== N_LINES) fail('LINE_COUNT', 'expected ' + N_LINES + ', got ' + lineTotal);
if (slotTotal !== N_SLOTS) fail('SLOT_COUNT', 'expected ' + N_SLOTS + ', got ' + slotTotal);
if (layout.words !== slotTotal)
  fail('SELF_INCONSISTENT', 'header says words=' + layout.words + ', actual ' + slotTotal);
console.log('   pages ' + layout.p.length + '   lines ' + lineTotal + '   word slots ' + slotTotal);

/* --------------------------------------------------------------------------
 * 3. EVERY LOCATION IS WELL-FORMED AND POINTS AT A REAL AYAH
 * ------------------------------------------------------------------------ */
head('3. locations');
const slotsOf = new Map(); // "S:A" -> Set of word indices
const flat = []; // every location, in page/line order
let malformed = 0,
  orphan = 0;

for (const pg of layout.p) {
  for (const ln of pg.l || []) {
    if (ln.t !== 't') continue;
    for (const loc of ln.w) {
      const m = /^(\d+):(\d+):(\d+)$/.exec(loc);
      if (!m) {
        if (malformed++ < 5) fail('MALFORMED_LOCATION', JSON.stringify(loc));
        continue;
      }
      const s = +m[1],
        a = +m[2],
        w = +m[3];
      const key = s + ':' + a;
      if (s < 1 || s > N_SURAHS || a < 1 || w < 1 || !(key in quran)) {
        if (orphan++ < 5)
          fail('ORPHAN_LOCATION', loc + ' points at an ayah that is not in the mushaf');
        continue;
      }
      if (!slotsOf.has(key)) slotsOf.set(key, new Set());
      const set = slotsOf.get(key);
      if (set.has(w)) fail('DUPLICATE_SLOT', loc);
      set.add(w);
      flat.push([s, a, w, loc]);
    }
  }
}
console.log('   malformed ' + malformed + '   orphan ' + orphan + '   distinct ayat ' + slotsOf.size);
if (malformed > 5) console.log('   (' + (malformed - 5) + ' further malformed suppressed)');
if (orphan > 5) console.log('   (' + (orphan - 5) + ' further orphans suppressed)');

/* --------------------------------------------------------------------------
 * 4. WORD INDICES ARE 1..N WITH NO GAP, AND THE WHOLE MUSHAF IS IN ORDER
 * ------------------------------------------------------------------------ */
head('4. contiguity and order');
let gapped = 0;
for (const [key, set] of slotsOf) {
  const arr = [...set].sort((x, y) => x - y);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== i + 1) {
      if (gapped++ < 5)
        fail('WORD_INDEX_GAP', key + ' expects index ' + (i + 1) + ' but the layout has ' + arr[i]);
      break;
    }
  }
}
let disordered = 0;
{
  let ps = 0,
    pa = 0,
    pw = 0;
  for (const [s, a, w, loc] of flat) {
    const forward = s > ps || (s === ps && (a > pa || (a === pa && w > pw)));
    if (!forward) {
      if (disordered++ < 5)
        fail('OUT_OF_ORDER', loc + ' follows ' + ps + ':' + pa + ':' + pw + ' in the page stream');
    }
    ps = s;
    pa = a;
    pw = w;
  }
}
console.log('   ayat with a gap in 1..N : ' + gapped);
console.log('   slots out of Quranic order across all 604 pages : ' + disordered);

/* --------------------------------------------------------------------------
 * 5. THE BINDING.  6236 / 6236.  THIS IS THE WHOLE GUARD.
 * ------------------------------------------------------------------------ */
head('5. THE BINDING  --  layout slots vs mushaf words, ayah by ayah');
const quranKeys = Object.keys(quran);
if (quranKeys.length !== N_AYAT)
  fail('AYAH_COUNT', 'the mushaf has ' + quranKeys.length + ' ayat, expected ' + N_AYAT);

let exact = 0;
let byLigature = 0;
const broken = [];
const missing = [];
const seenLigature = new Set();

for (const key of quranKeys) {
  if (!slotsOf.has(key)) {
    missing.push(key);
    continue;
  }
  const words = countWords(quran[key]);
  const slots = slotsOf.get(key).size;
  const delta = words - slots;

  if (delta === 0) {
    if (key in LIGATURES)
      fail('STALE_LIGATURE', key + ' is in the ligature table but now binds 1:1 -- remove it');
    exact++;
  } else if (key in LIGATURES && delta === LIGATURES[key]) {
    byLigature++;
    seenLigature.add(key);
  } else {
    broken.push([key, words, slots, delta]);
  }
}

console.log('   exact 1:1 ...................... ' + exact);
console.log('   known typographic ligature ..... ' + byLigature + '   ' + JSON.stringify([...seenLigature]));
console.log('   BROKEN ......................... ' + broken.length);
console.log('   MISSING FROM LAYOUT ............ ' + missing.length);
console.log('   -----------------------------------------');
console.log('   TOTAL .......................... ' + (exact + byLigature + broken.length + missing.length) + ' / ' + N_AYAT);

for (const [key, words, slots, delta] of broken.slice(0, 12)) {
  fail(
    'BINDING_BROKEN',
    key + '  mushaf words=' + words + '  layout slots=' + slots + '  delta=' + (delta > 0 ? '+' : '') + delta
  );
}
if (broken.length > 12) console.log('   (' + (broken.length - 12) + ' further broken ayat suppressed)');
for (const key of missing.slice(0, 12)) fail('AYAH_NOT_IN_LAYOUT', key);
if (missing.length > 12) console.log('   (' + (missing.length - 12) + ' further missing ayat suppressed)');

for (const key of Object.keys(LIGATURES)) {
  if (!seenLigature.has(key) && !broken.some((b) => b[0] === key) && !missing.includes(key))
    fail('LIGATURE_UNVERIFIED', key + ' was never reached');
}

if (exact + byLigature !== N_AYAT) {
  notes.push(
    'The binding does NOT close. ' +
      (exact + byLigature) +
      ' of ' +
      N_AYAT +
      ' ayat bind. Do not ship a mushaf reader on a layout that does not bind.'
  );
}

/* --------------------------------------------------------------------------
 * VERDICT
 * ------------------------------------------------------------------------ */
console.log('');
console.log('='.repeat(72));
if (failures.length === 0) {
  console.log('PASS   6236 / 6236 bound.  ' + exact + ' exact + ' + byLigature + ' ligature.  0 broken, 0 missing.');
  console.log('       The layout is a faithful set of boundary facts over the guarded mushaf.');
  console.log('='.repeat(72));
  process.exit(0);
} else {
  console.log('FAIL   ' + failures.length + ' finding(s):');
  console.log('');
  for (const f of failures) console.log('  * ' + f);
  for (const n of notes) console.log('\n  !! ' + n);
  console.log('='.repeat(72));
  process.exit(1);
}
