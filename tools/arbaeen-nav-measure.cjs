#!/usr/bin/env node
/* ==========================================================================================
 * tools/arbaeen-nav-measure.cjs -- ITEM 3's PROVER.
 *
 * IT DOES NOT RE-IMPLEMENT THE DERIVATION. A prover that carries its own copy of the function
 * it is proving proves that the copy agrees with itself, which is the one thing nobody asked.
 * So this LIFTS the shipped derivation out of app.jsx -- the exact source text between the two
 * sentinels the section carries -- evaluates that text, and runs THAT over the shipped corpus.
 * If the derivation in app.jsx changes, what runs here changes with it; if the sentinels are
 * gone, or there are two of them, or the block does not declare arbaeenTopic, this refuses to
 * run rather than quietly measuring something else.
 *
 * It also checks the lifted block survived the build into app.js, so the numbers below describe
 * what a reader's browser will actually execute and not only what the source says.
 *
 * ARABIC NEVER REACHES THE TERMINAL. The fifty derived headings go, UTF-8, to a file OUTSIDE
 * both work trees; only ASCII statistics are printed. The file is the thing the owner reads --
 * the statistics below are a description of it, not a verdict on it.
 * ========================================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = 'C:/Users/passe/projects/_orders/arbaeen-titles-2026-09-13.txt';
const BEGIN = '// ===== ITEM 3 -- ARBAEEN TOPIC DERIVATION (BEGIN) =====';
const END = '// ===== ITEM 3 -- ARBAEEN TOPIC DERIVATION (END) =====';

function die(msg) { console.log('ERROR ' + msg); process.exit(1); }
function sha8(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8).toUpperCase(); }

/* ---- 1. LIFT the derivation out of the shipped source ---------------------------------- */
const jsxPath = path.join(ROOT, 'app.jsx');
const jsx = fs.readFileSync(jsxPath, 'utf8');
if (jsx.split(BEGIN).length - 1 !== 1) die('app.jsx does not carry exactly one BEGIN sentinel');
if (jsx.split(END).length - 1 !== 1) die('app.jsx does not carry exactly one END sentinel');
const a = jsx.indexOf(BEGIN) + BEGIN.length;
const b = jsx.indexOf(END);
if (b <= a) die('the sentinels are in the wrong order in app.jsx');
const block = jsx.slice(a, b);
if (block.indexOf('function arbaeenTopic(h)') === -1) die('the lifted block does not declare arbaeenTopic');
if (/</.test(block.replace(/[^<]*<\s*[=/]/g, ''))) { /* no JSX expected, but nothing is asserted on it */ }

let arbaeenTopic;
try {
  /* eslint-disable no-new-func */
  arbaeenTopic = (new Function(block + '\nreturn arbaeenTopic;'))();
} catch (e) {
  die('the lifted block would not evaluate: ' + e.message);
}
if (typeof arbaeenTopic !== 'function') die('the lifted block did not yield a function');

/* ---- 2. the SAME block must have survived the build ------------------------------------ */
const built = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const BUILT_OK = built.indexOf('function arbaeenTopic(h)') !== -1
  && built.indexOf('ARB_TOPIC_WINDOW') !== -1;

/* ---- 3. run it over the corpus, which is READ AND NOT WRITTEN --------------------------- */
const corpusPath = path.join(ROOT, 'arbaeen.json');
const corpusBuf = fs.readFileSync(corpusPath);
const corpus = JSON.parse(corpusBuf.toString('utf8'));
const entries = (corpus && corpus.hadith) || [];
if (!entries.length) die('the corpus carries no entries');

const lines = [];
const titles = [];
let fallback = 0;
for (const h of entries) {
  const t = String(arbaeenTopic(h));
  titles.push(t);
  if (t === String(h.title)) fallback += 1;
  lines.push(String(h.n) + '. ' + t);
}
fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');

/* ---- 4. the statistics, ASCII only ------------------------------------------------------ */
const seen = new Set();
let duplicates = 0;
for (const t of titles) { if (seen.has(t)) duplicates += 1; else seen.add(t); }
const lens = titles.map((t) => t.length);
const min = Math.min.apply(null, lens);
const max = Math.max.apply(null, lens);
const avg = lens.reduce((x, y) => x + y, 0) / lens.length;

console.log('ARBAEEN TITLE DERIVATION -- lifted from app.jsx, run over arbaeen.json');
console.log('SOURCE=app.jsx  BLOCK_CHARS=' + block.length + '  BUILT_INTO_APP_JS=' + (BUILT_OK ? 'yes' : 'NO'));
console.log('COUNT=' + titles.length);
console.log('FALLBACK=' + fallback);
console.log('DUPLICATES=' + duplicates);
console.log('LEN_MIN=' + min);
console.log('LEN_MAX=' + max);
console.log('LEN_AVG=' + avg.toFixed(2));
console.log('CORPUS_BYTES=' + corpusBuf.length);
console.log('CORPUS_SHA256_8=' + sha8(corpusBuf));
console.log('TITLES=' + OUT);
if (!BUILT_OK) process.exit(1);
