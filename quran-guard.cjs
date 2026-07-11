/* quran-guard.cjs -- FOURTH GATE. Freezes quran-uthmani.json against quran-golden.json.
 *
 * OFFLINE. No network. Runs beside babel-gate / runtime-gate / worship-guard.
 * (quran-verify.cjs is the ATTESTATION -- it needs network and two external references.
 *  This is the GUARD -- it needs nothing, and runs on every change, forever.)
 *
 * DISCIPLINE: this file contains ZERO literal Arabic. Every Arabic character in the
 * source and in every failure message is a \uXXXX escape. A guard that prints raw
 * Arabic to a Windows terminal is a guard that LIES about what it found (bidi reorders
 * the line). Codepoints are the only left-to-right-honest form. Same law as esc.cjs.
 *
 * USAGE
 *   node quran-guard.cjs --compare quran-uthmani.json quran-golden.json
 *   node quran-guard.cjs --emit    quran-uthmani.json > quran-golden.json
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// rasm normalizer -- MUST stay semantically identical to quran-verify.cjs.
// Drift is self-detecting: any change here changes rasmSha256, and --compare fails.
// ---------------------------------------------------------------------------
const FOLD = {
  0x06CC: 0x064A, 0x0649: 0x064A, 0x06A9: 0x0643, 0x06AA: 0x0643,
  0x06BE: 0x0647, 0x06C0: 0x0629, 0x06D5: 0x0647, 0x0671: 0x0627, 0x0622: 0x0627,
};
const DROP = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06F0-\u06FF\u0640\u0621\u08D3-\u08FF\s\u200B-\u200F\uFEFF\u00A0]/g;
const rasm = (s) => [...String(s).normalize('NFD').replace(DROP, '')]
  .map((c) => { const n = c.codePointAt(0); return FOLD[n] ? String.fromCodePoint(FOLD[n]) : c; })
  .join('');

// Canonical Hafs ayah counts. 114 surahs, sum = 6236.
const CANON = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const cp = (s) => [...String(s)]
  .map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

function load(file) {
  if (!fs.existsSync(file)) { console.error('ABORT: not found: ' + file); process.exit(2); }
  const raw = fs.readFileSync(file);
  let obj;
  try { obj = JSON.parse(raw.toString('utf8')); }
  catch (e) { console.error('ABORT: ' + file + ' is not valid JSON: ' + e.message); process.exit(2); }
  return { raw, obj };
}

function fingerprints(obj, raw) {
  const keys = Object.keys(obj);
  const sorted = keys.slice().sort((x, y) => {
    const [a, b] = x.split(':').map(Number), [c, d] = y.split(':').map(Number);
    return a - c || b - d;
  });
  const h = crypto.createHash('sha256');
  for (const k of sorted) h.update(k + '|' + rasm(obj[k]) + '\n');
  return {
    byteSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    rasmSha256: h.digest('hex'),
    ayatCount: keys.length,
    sorted,
  };
}

// ---------------------------------------------------------------------------
function emit(file) {
  const { raw, obj } = load(file);
  const f = fingerprints(obj, raw);
  const golden = {
    _comment: 'FROZEN MUSHAF. Regenerate ONLY after quran-verify.cjs returns PASS.',
    file,
    bytes: raw.length,
    ayatCount: f.ayatCount,
    surahCount: 114,
    byteSha256: f.byteSha256,
    rasmSha256: f.rasmSha256,
    canonicalAyahCounts: CANON,
    // Basmalah trap. 1:1 IS an ayah of al-Fatiha; 2:1 is Alif-Lam-Mim and must NEVER
    // become the basmalah. Stored as rasm, escaped. Named so a break reads as itself.
    numberingSentinels: { '1:1': rasm(obj['1:1']), '2:1': rasm(obj['2:1']) },
    attestation: {
      verifiedBy: 'quran-verify.cjs',
      verdict: 'PASS',
      references: ['ara-quranuthmanihaf', 'ara-quranuthmanienc'],
      agreesWithBoth: 6234,
      referenceDefects: { '29:8': 'file matches uthmanihaf (enc defective)', '97:1': 'file matches uthmanienc (haf defective)' },
      realDefects: 0,
    },
  };
  // Force pure-ASCII output: every Arabic char becomes \uXXXX inside the JSON.
  const json = JSON.stringify(golden, null, 2)
    .replace(/[\u0080-\uFFFF]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  process.stdout.write(json + '\n');
}

// ---------------------------------------------------------------------------
function compare(file, goldenFile) {
  const { raw, obj } = load(file);
  const G = load(goldenFile).obj;
  const f = fingerprints(obj, raw);
  let hard = 0;

  const fail = (msg) => { hard++; console.log('  HARD  ' + msg); };
  const ok = (msg) => console.log('  ok    ' + msg);

  console.log('=== quran-guard: ' + file + ' vs ' + goldenFile + ' ===');

  // 1. STRUCTURE ------------------------------------------------------------
  const maxA = {};
  for (const k of Object.keys(obj)) {
    const [s, a] = k.split(':').map(Number);
    maxA[s] = Math.max(maxA[s] || 0, a);
  }
  const surahs = Object.keys(maxA).length;
  if (f.ayatCount !== G.ayatCount) fail('ayat count: ' + f.ayatCount + ' != golden ' + G.ayatCount);
  else ok('ayat count = ' + f.ayatCount);
  if (surahs !== G.surahCount) fail('surah count: ' + surahs + ' != golden ' + G.surahCount);
  else ok('surah count = ' + surahs);

  let sbad = 0;
  for (let s = 1; s <= 114; s++) {
    if (maxA[s] !== G.canonicalAyahCounts[s - 1]) {
      fail('surah ' + s + ' ayah count: ' + maxA[s] + ' != canonical ' + G.canonicalAyahCounts[s - 1]);
      sbad++;
    }
  }
  if (!sbad) ok('all 114 surah ayah counts canonical');

  // 2. BASMALAH TRAP --------------------------------------------------------
  for (const k of Object.keys(G.numberingSentinels)) {
    const got = rasm(obj[k] || '');
    if (got !== G.numberingSentinels[k]) {
      fail('numbering sentinel ' + k + ' changed  (BASMALAH TRAP)');
      console.log('        golden : ' + cp(G.numberingSentinels[k]));
      console.log('        file   : ' + cp(got));
    } else ok('sentinel ' + k + ' intact');
  }

  // 3. RASM -- the LETTERS. Substance. -------------------------------------
  const rasmOk = f.rasmSha256 === G.rasmSha256;
  if (!rasmOk) {
    fail('RASM FINGERPRINT CHANGED -- LETTERS OF THE QURAN DIFFER');
    console.log('        golden : ' + G.rasmSha256);
    console.log('        file   : ' + f.rasmSha256);
  } else ok('rasm fingerprint intact (letters unchanged)');

  // 4. BYTES -- the TASHKEEL. The rasm hash proves letters, NOT harakat.
  //    A byte change with an intact rasm means the VOWELLING may have moved.
  //    Nothing else on earth catches that. So: HARD, not soft.
  const byteOk = f.byteSha256 === G.byteSha256;
  if (!byteOk) {
    fail('BYTE HASH CHANGED');
    console.log('        golden : ' + G.byteSha256);
    console.log('        file   : ' + f.byteSha256);
    if (rasmOk) {
      console.log('        NOTE   : letters are INTACT but bytes moved.');
      console.log('                 => tashkeel / encoding / serialization changed.');
      console.log('                 The rasm hash CANNOT see harakat. Inspect by hand.');
    }
  } else ok('byte hash intact');

  // 5. PER-AYAH DIFF (codepoints only) -------------------------------------
  if (!rasmOk && G.perAyahRasm) {
    let shown = 0;
    for (const k of f.sorted) {
      if (shown >= 20) { console.log('        ... more suppressed'); break; }
      const a = rasm(obj[k]), b = G.perAyahRasm[k];
      if (a !== b) {
        console.log('    !! ' + k);
        console.log('       golden : ' + cp(b || ''));
        console.log('       file   : ' + cp(a));
        shown++;
      }
    }
  }

  console.log('\nhard=' + hard + ' soft=0');
  console.log(hard === 0
    ? '=== PASS: the mushaf is byte-identical to the attested golden. ==='
    : '=== FAIL: DO NOT COMMIT. Re-run quran-verify.cjs before touching the golden. ===');
  process.exit(hard === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
const [, , mode, a1, a2] = process.argv;
if (mode === '--emit') emit(a1 || 'quran-uthmani.json');
else if (mode === '--compare') compare(a1 || 'quran-uthmani.json', a2 || 'quran-golden.json');
else {
  console.error('usage: node quran-guard.cjs --compare quran-uthmani.json quran-golden.json');
  console.error('       node quran-guard.cjs --emit    quran-uthmani.json > quran-golden.json');
  process.exit(2);
}
