/* hafs-map-guard.cjs -- TENTH GATE. The correspondence gate.
 *
 * Proves that every word the mushaf SVG layer would DRAW is the same word as the golden
 * text in quran-uthmani.json -- at letter level. This is the publish precondition for the
 * mushaf display track: a drawing that shows a letter which did not come from the golden
 * text is the worst failure a mushaf can have, because it is silent and convincing.
 *
 * OFFLINE. No network. Reads three files, writes none. It is a verifier, not a fixer.
 *
 * DISCIPLINE (same law as quran-guard.cjs): this file contains ZERO literal Arabic.
 * Every Arabic character here and in every failure message is a \uXXXX escape. A guard
 * that prints raw Arabic to a Windows terminal LIES about what it found -- bidi reorders
 * the line. Codepoints are the only left-to-right-honest form.
 *
 * EXCEPTIONS ARE NAMED BY IDENTITY, NEVER BY COUNT OR TOLERANCE. There is no threshold
 * anywhere in this file. A third residual is a FAIL, by construction.
 *
 * USAGE
 *   node hafs-map-guard.cjs
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// PINNED EXPECTATIONS. Every one of these was measured by directive 70 and
// re-derived independently by directive 71 before being written here.
// ---------------------------------------------------------------------------
const MAP_FILE = 'data/mushaf-hafs-map.json';
const MAP_SHA256 = '1ba8e45a073b7d78863939201813d5a65aa2630fb87029f08c1bfd0b68c2d49c';
const SOURCE_COMMIT = 'ae5786ab08597f8123575dec4e774f1eca195e0f';
const MD_WORD_COUNT = 91451;
const REDUCED_COUNT = 77432;
const AYAH_TOTAL = 6236;
const AYAH_AGREE = 6235;
const POSITIONS = 77425;
const MATCHES = 77424;

// EXCEPTION 1 -- the SVG carries ONE md-word where mushaf-layout.json carries TWO slots.
// Page 262, line 08. mushaf-layout.json is FROZEN and is not edited; the join lives here.
const EXCEPTION_1_AYAH = '15:7';

// EXCEPTION 2 -- the single letter-level residual. A hamza ENCODING FORM, not a different
// letter: ours carries the combining U+0654 ARABIC HAMZA ABOVE, theirs the standalone
// letter U+0621 ARABIC LETTER HAMZA. Named by identity, pinned by position AND by both
// codepoint sequences, so a different word appearing at this position still fails.
const EXCEPTION_2_POS = '2:72:4';
const EXCEPTION_2_OURS =
  '\u0641\u064E\u0671\u062F\u0651\u064E\u0670\u0631\u064E\u0670\u0654\u0652\u062A\u064F\u0645\u0652';
const EXCEPTION_2_THEIRS =
  '\u0641\u064E\u0671\u062F\u0651\u064E\u0670\u0631\u064E\u0670\u0621\u06E1\u062A\u064F\u0645\u06E1';

// ---------------------------------------------------------------------------
// The three-rung ladder and the letter skeleton. OWNER'S DECISION -- do not widen.
//   rung 1  NFC normalize
//   rung 2  strip U+0640 TATWEEL   (typographic elongation, not a letter)
//   rung 3  map U+06E1 -> U+0652   (small high dotless head of khah -> sukun)
// ---------------------------------------------------------------------------
const TATWEEL = '\u0640';
const LETTER_RE = /[\u0621-\u064A\u0671-\u06D5]/;

const ladder = (s) => String(s).normalize('NFC')
  .split(TATWEEL).join('')
  .split('\u06E1').join('\u0652');

// skeleton: letters only, all diacritics and marks removed, U+0640 excluded from the
// letter class. Then the orthographic identity folds -- alef forms, alef-maksura, and
// hamza seats. These are IDENTITY MAPPINGS between spellings of the same letter, not
// tolerances: each is a fixed character-to-character rule with no count attached.
const FOLD = {
  '\u0649': '\u064A',   // alef maksura   -> ya
  '\u0623': '\u0627',   // alef + hamza above -> alef
  '\u0625': '\u0627',   // alef + hamza below -> alef
  '\u0622': '\u0627',   // alef + madda       -> alef
  '\u0671': '\u0627',   // alef wasla         -> alef
  '\u0626': '\u064A',   // ya  seat           -> ya
  '\u0624': '\u0648',   // waw seat           -> waw
};
const skeleton = (s) => [...ladder(s)]
  .filter((c) => LETTER_RE.test(c) && c !== TATWEEL)
  .map((c) => FOLD[c] || c)
  .join('');

// a token is an annotation mark, not a word, if it contains no Arabic letter.
// Applied identically to BOTH sides -- symmetric by construction.
const isMarkOnly = (t) => String(t).trim().length > 0 && !LETTER_RE.test(String(t).trim());

const cp = (s) => [...String(s)]
  .map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// ---------------------------------------------------------------------------
// gate 4's rasm normalizer, reproduced EXACTLY so the golden is re-derived the same way
// and no second source of truth is invented. Any drift here fails against the golden.
// ---------------------------------------------------------------------------
const G_FOLD = {
  0x06CC: 0x064A, 0x0649: 0x064A, 0x06A9: 0x0643, 0x06AA: 0x0643,
  0x06BE: 0x0647, 0x06C0: 0x0629, 0x06D5: 0x0647, 0x0671: 0x0627, 0x0622: 0x0627,
};
const G_DROP = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06F0-\u06FF\u0640\u0621\u08D3-\u08FF\s\u200B-\u200F\uFEFF\u00A0]/g;
const rasm = (s) => [...String(s).normalize('NFD').replace(G_DROP, '')]
  .map((c) => { const n = c.codePointAt(0); return G_FOLD[n] ? String.fromCodePoint(G_FOLD[n]) : c; })
  .join('');

// ---------------------------------------------------------------------------
let hard = 0;
const fail = (m) => { hard++; console.log('  HARD  ' + m); };
const ok = (m) => console.log('  ok    ' + m);

function read(file) {
  if (!fs.existsSync(file)) { console.error('ABORT: not found: ' + file); process.exit(2); }
  return fs.readFileSync(file);
}

console.log('=== hafs-map-guard: mushaf correspondence gate ===');

// 1 -------------------------------------------------------------- map integrity
const mapRaw = read(MAP_FILE);
const mapSha = crypto.createHash('sha256').update(mapRaw).digest('hex');
if (mapSha !== MAP_SHA256) {
  fail('MAP SHA-256 CHANGED -- the correspondence map is not the attested artifact');
  console.log('        pinned : ' + MAP_SHA256);
  console.log('        file   : ' + mapSha);
} else ok('map sha256 intact  ' + mapSha);

let MAP;
try { MAP = JSON.parse(mapRaw.toString('utf8')); }
catch (e) { console.error('ABORT: ' + MAP_FILE + ' is not valid JSON: ' + e.message); process.exit(2); }

const H = MAP._header || {};
if (H.source_commit !== SOURCE_COMMIT) {
  fail('map source_commit: ' + H.source_commit + ' != pinned ' + SOURCE_COMMIT);
} else ok('map source_commit = ' + SOURCE_COMMIT);
if (MAP.words.length !== MD_WORD_COUNT) {
  fail('md-word count: ' + MAP.words.length + ' != expected ' + MD_WORD_COUNT);
} else ok('md-word count = ' + MD_WORD_COUNT);
if (H.md_word_count !== MAP.words.length) {
  fail('map header md_word_count ' + H.md_word_count + ' disagrees with actual rows ' + MAP.words.length);
} else ok('map header agrees with its own rows');

// 2 ------------------------------------------- golden, re-derived as gate 4 derives it
const uthRaw = read('quran-uthmani.json');
const GOLD = JSON.parse(read('quran-golden.json').toString('utf8'));
const Q = JSON.parse(uthRaw.toString('utf8'));

const byteSha = crypto.createHash('sha256').update(uthRaw).digest('hex');
const sortedKeys = Object.keys(Q).slice().sort((x, y) => {
  const [a, b] = x.split(':').map(Number), [c, d] = y.split(':').map(Number);
  return a - c || b - d;
});
const rh = crypto.createHash('sha256');
for (const k of sortedKeys) rh.update(k + '|' + rasm(Q[k]) + '\n');
const rasmSha = rh.digest('hex');

if (byteSha !== GOLD.byteSha256) {
  fail('quran-uthmani.json byte hash != golden -- refusing to compare against unattested text');
  console.log('        golden : ' + GOLD.byteSha256);
  console.log('        file   : ' + byteSha);
} else ok('golden byte hash intact (gate 4 basis)');
if (rasmSha !== GOLD.rasmSha256) {
  fail('quran-uthmani.json rasm fingerprint != golden -- LETTERS DIFFER');
  console.log('        golden : ' + GOLD.rasmSha256);
  console.log('        file   : ' + rasmSha);
} else ok('golden rasm fingerprint intact (gate 4 basis)');
if (Object.keys(Q).length !== AYAH_TOTAL) {
  fail('ayah count ' + Object.keys(Q).length + ' != ' + AYAH_TOTAL);
} else ok('ayah count = ' + AYAH_TOTAL);

// 3 --------------------------------------------- structure + the two declared reductions
// word_index_in_ayah must be exactly 1..n in document order for every ayah. This is what
// catches a word whose POSITION was altered while its text stayed correct.
const byAyahAll = new Map();
for (const r of MAP.words) {
  const k = r[1] + ':' + r[2];
  if (!byAyahAll.has(k)) byAyahAll.set(k, []);
  byAyahAll.get(k).push(r);
}
let idxBad = 0;
const idxBadList = [];
for (const [k, arr] of byAyahAll) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][3] !== i + 1) {
      idxBad++;
      if (idxBadList.length < 10) idxBadList.push(k + ' slot ' + (i + 1) + ' carries word_index ' + arr[i][3]);
      break;
    }
  }
}
if (idxBad) {
  fail('word_index_in_ayah is not 1..n in document order for ' + idxBad + ' ayah(s)');
  for (const b of idxBadList) console.log('        ' + b);
} else ok('word_index_in_ayah contiguous 1..n in all ' + byAyahAll.size + ' ayahs');

let pageBad = 0, prevPage = 0;
for (const r of MAP.words) { if (r[0] < prevPage) pageBad++; prevPage = r[0]; }
if (pageBad) fail('page order is not non-decreasing (' + pageBad + ' regressions)');
else ok('page order non-decreasing');

// the two declared reductions: mark-only tokens, and data-waw-alatf joins
let reduced = 0;
for (const r of MAP.words) if (!r[5] && !r[6]) reduced++;
if (reduced !== REDUCED_COUNT) {
  fail('reduced word count ' + reduced + ' != expected ' + REDUCED_COUNT);
} else ok('reduced word count = ' + REDUCED_COUNT);

// the map's own is_mark_only flags must agree with the rule, recomputed from the text
let flagBad = 0;
const flagBadList = [];
for (const r of MAP.words) {
  if (isMarkOnly(r[7]) !== !!r[5]) {
    flagBad++;
    if (flagBadList.length < 10) flagBadList.push(r[1] + ':' + r[2] + ':' + r[3] + ' flag=' + r[5] + ' text=' + cp(r[7]));
  }
}
if (flagBad) {
  fail('is_mark_only flag disagrees with the rule at ' + flagBad + ' position(s)');
  for (const b of flagBadList) console.log('        ' + b);
} else ok('is_mark_only flags agree with the rule at all ' + MAP.words.length + ' positions');

// 4 ------------------------------------------------------- tokenize and align by ayah
const theirs = new Map();
for (const [k, arr] of byAyahAll) {
  const toks = [];
  let pend = '', pendPage = null;
  for (const r of arr) {
    if (r[4] !== 0) continue;                 // juz-star / sajda-mehrab are not words
    if (r[5]) continue;                       // mark-only token
    if (r[6]) { pend += r[7]; if (pendPage === null) pendPage = r[0]; continue; }  // waw joins forward
    toks.push({ text: pend + r[7], page: pendPage === null ? r[0] : pendPage });
    pend = ''; pendPage = null;
  }
  if (pend) toks.push({ text: pend, page: pendPage });
  theirs.set(k, toks);
}
const ours = new Map();
for (const k of Object.keys(Q)) {
  ours.set(k, String(Q[k]).split(/\s+/).filter(Boolean).filter((t) => !isMarkOnly(t)));
}

const diffAyahs = [];
for (const k of new Set([...ours.keys(), ...theirs.keys()])) {
  const o = (ours.get(k) || []).length, t = (theirs.get(k) || []).length;
  if (o !== t) diffAyahs.push({ k, ours: o, theirs: t });
}
const agree = AYAH_TOTAL - diffAyahs.length;
if (agree !== AYAH_AGREE) {
  fail('ayah agreement ' + agree + ' / ' + AYAH_TOTAL + ' != expected ' + AYAH_AGREE + ' / ' + AYAH_TOTAL);
  for (const d of diffAyahs.slice(0, 20)) console.log('        ' + d.k + '  ours=' + d.ours + ' theirs=' + d.theirs);
} else ok('ayah agreement = ' + AYAH_AGREE + ' / ' + AYAH_TOTAL);

// the sole disagreeing ayah must be EXCEPTION 1, by name
if (diffAyahs.length !== 1 || diffAyahs[0].k !== EXCEPTION_1_AYAH) {
  fail('the sole disagreeing ayah must be ' + EXCEPTION_1_AYAH + ' (exception 1), by name');
  for (const d of diffAyahs) console.log('        got ' + d.k + '  ours=' + d.ours + ' theirs=' + d.theirs);
} else ok('exception 1 is ' + EXCEPTION_1_AYAH + ' and is the only ayah disagreement');

// 5/6 ------------------------------------------- letter-skeleton comparison, every position
let positions = 0, matches = 0;
const mismatches = [];
for (const [k, arr] of theirs) {
  const o = ours.get(k) || [];
  if (o.length !== arr.length) continue;      // exception 1, handled by name above
  for (let i = 0; i < arr.length; i++) {
    positions++;
    if (skeleton(o[i]) === skeleton(arr[i].text)) matches++;
    else mismatches.push({ pos: k + ':' + (i + 1), page: arr[i].page, ours: o[i], theirs: arr[i].text });
  }
}
if (positions !== POSITIONS) fail('total positions ' + positions + ' != expected ' + POSITIONS);
else ok('total positions = ' + POSITIONS);
if (matches !== MATCHES) fail('matches ' + matches + ' != expected ' + MATCHES);
else ok('matches = ' + MATCHES);

// 7 --------------------------------- the single mismatch must BE exception 2, by identity
if (mismatches.length !== 1) {
  fail('expected exactly one letter-level residual (exception 2); got ' + mismatches.length);
} else {
  const m = mismatches[0];
  if (m.pos !== EXCEPTION_2_POS) {
    fail('the single residual is at ' + m.pos + ', not the named exception ' + EXCEPTION_2_POS);
  } else if (m.ours !== EXCEPTION_2_OURS || m.theirs !== EXCEPTION_2_THEIRS) {
    fail('residual is at the named position ' + EXCEPTION_2_POS + ' but its TEXT is not the named form');
  } else {
    ok('exception 2 is ' + EXCEPTION_2_POS + ' and matches the pinned form exactly');
  }
}

// every mismatch printed with BOTH sides, as codepoints, never as Arabic
if (mismatches.length && hard) {
  console.log('\n  --- every letter-level residual, both sides ---');
  for (const m of mismatches.slice(0, 50)) {
    console.log('    ' + m.pos + '  page ' + m.page);
    console.log('       ours       : ' + cp(m.ours));
    console.log('       theirs     : ' + cp(m.theirs));
    console.log('       ours  skel : ' + cp(skeleton(m.ours)));
    console.log('       theirs skel: ' + cp(skeleton(m.theirs)));
  }
  if (mismatches.length > 50) console.log('    ... ' + (mismatches.length - 50) + ' more suppressed');
}

console.log('\nhard=' + hard + ' soft=0');
console.log(hard === 0
  ? '=== PASS: every drawn word matches the golden text at letter level. ==='
  : '=== FAIL: DO NOT COMMIT. The mushaf drawing and the golden text disagree. ===');
process.exit(hard === 0 ? 0 : 1);
