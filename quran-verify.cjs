/* quran-verify.cjs — letter-level attestation of quran-uthmani.json
 * Compares the bundled mushaf against TWO independently-sourced Uthmani texts.
 * Reads only. Writes nothing. Requires network (Node 18+ global fetch).
 */
'use strict';
const fs = require('fs'), crypto = require('crypto');
const FILE = process.argv[2] || 'quran-uthmani.json';

const REFS = {
  uthmanihaf: 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranuthmanihaf.json',
  uthmanienc: 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranuthmanienc.json',
};

// --- rasm normalizer (validated: encoding-agnostic across both references) ---
const FOLD = { 0x06CC:0x064A, 0x0649:0x064A, 0x06A9:0x0643, 0x06AA:0x0643,
               0x06BE:0x0647, 0x06C0:0x0629, 0x06D5:0x0647, 0x0671:0x0627, 0x0622:0x0627 };
const DROP = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۭ۰-ۿـء࣓-ࣿ\s​-‏﻿ ]/g;
const rasm = (s) => [...s.normalize('NFD').replace(DROP, '')]
  .map(c => { const n = c.codePointAt(0); return FOLD[n] ? String.fromCodePoint(FOLD[n]) : c; }).join('');

// canonical Hafs ayah counts, 114 surahs, sum = 6236
const CANON = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

(async () => {
  if (!fs.existsSync(FILE)) { console.error('ABORT: not found: ' + FILE); process.exit(1); }
  const raw = fs.readFileSync(FILE);
  const MINE = JSON.parse(raw.toString('utf8'));

  console.log('=== 1. STRUCTURE ===');
  const keys = Object.keys(MINE);
  const maxA = {};
  for (const k of keys) { const [s, a] = k.split(':').map(Number); maxA[s] = Math.max(maxA[s] || 0, a); }
  let sbad = 0;
  for (let s = 1; s <= 114; s++) if (maxA[s] !== CANON[s-1]) { console.log('  MISMATCH surah ' + s + ': file=' + maxA[s] + ' canonical=' + CANON[s-1]); sbad++; }
  console.log('  ayat: ' + keys.length + ' (expect 6236) | surahs: ' + Object.keys(maxA).length + ' (expect 114) | surah-count mismatches: ' + sbad);
  console.log('  numbering convention -> 2:1 = ' + JSON.stringify(MINE['2:1']) + '   (must be Alif-Lam-Mim, NOT the basmalah)');

  console.log('\n=== 2. FETCH REFERENCES ===');
  const R = {};
  for (const [n, url] of Object.entries(REFS)) {
    const res = await fetch(url);
    if (!res.ok) { console.error('ABORT: fetch failed for ' + n + ' (HTTP ' + res.status + ')'); process.exit(1); }
    const j = await res.json();
    R[n] = {};
    for (const a of j.quran) R[n][a.chapter + ':' + a.verse] = a.text;
    console.log('  ' + n.padEnd(12) + ' ayat = ' + Object.keys(R[n]).length);
  }

  console.log('\n=== 3. LETTER-LEVEL (RASM) COMPARISON ===');
  let clean = 0; const split = [], fail = [];
  for (const k of keys) {
    const m = rasm(MINE[k] || ''), a = rasm(R.uthmanihaf[k] || ''), b = rasm(R.uthmanienc[k] || '');
    if (m === a && m === b) { clean++; continue; }
    if (m === a || m === b) { split.push({ k, matched: m === a ? 'uthmanihaf' : 'uthmanienc' }); continue; }
    fail.push(k);
  }
  console.log('  agrees with BOTH references     : ' + clean + ' / ' + keys.length);
  console.log('  references disagree, file matches one : ' + split.length + '   (expected: 2 -> 29:8 and 97:1, the two known edition defects)');
  for (const s of split) console.log('      ' + s.k.padEnd(8) + ' file matches ' + s.matched);
  console.log('  agrees with NEITHER  (REAL DEFECTS)   : ' + fail.length);
  for (const k of fail.slice(0, 20)) {
    console.log('    !! ' + k);
    console.log('       file : ' + rasm(MINE[k]));
    console.log('       haf  : ' + rasm(R.uthmanihaf[k] || ''));
    console.log('       enc  : ' + rasm(R.uthmanienc[k] || ''));
  }
  if (fail.length > 20) console.log('    ... and ' + (fail.length - 20) + ' more');

  console.log('\n=== 4. FINGERPRINTS (for quran-golden.json) ===');
  console.log('  file sha256 (raw bytes) : ' + crypto.createHash('sha256').update(raw).digest('hex'));
  const h = crypto.createHash('sha256');
  const sorted = keys.slice().sort((x, y) => { const [a,b]=x.split(':').map(Number), [c,d]=y.split(':').map(Number); return a-c || b-d; });
  for (const k of sorted) h.update(k + '|' + rasm(MINE[k]) + '\n');
  console.log('  rasm fingerprint        : ' + h.digest('hex'));

  const pass = sbad === 0 && keys.length === 6236 && fail.length === 0;
  console.log('\n=== VERDICT: ' + (pass ? 'PASS — every letter of all 6236 ayat is attested against at least one independent Uthmani source, and the structure is canonical.' : 'FAIL — see above.') + ' ===');
  process.exit(pass ? 0 : 1);
})();
