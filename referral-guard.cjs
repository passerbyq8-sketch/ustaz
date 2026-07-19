#!/usr/bin/env node
'use strict';
// referral-guard.cjs  --  GATE 8: child-safety referral protocol.
//
// HYBRID guard (option ج):
//   CHECK A  referral-golden.json structural integrity + critical scenarios.
//   CHECK B  the referral block in index.html still carries its safety invariants.
//
// Arabic needles live as string literals but are NEVER printed. All console
// output is ASCII (ids/labels only), safe for a Windows terminal (ق1).
// Diacritics (harakat) + tatweel are stripped on BOTH sides before matching,
// so a reword or a vowel change does not false-fail; only a deleted concept does.
//
// Exit 0 = all pass  |  1 = drift / missing invariant  |  2 = could not run (structural).
//
// Usage:  node referral-guard.cjs [--compare <indexFile> <goldenFile>]
//         defaults: index.html  referral-golden.json  (cwd)

const fs = require('fs');

let indexFile  = 'index.html';
let goldenFile = 'referral-golden.json';
const ci = process.argv.indexOf('--compare');
if (ci !== -1) {
  if (process.argv[ci + 1]) indexFile  = process.argv[ci + 1];
  if (process.argv[ci + 2]) goldenFile = process.argv[ci + 2];
}

let P = 0, F = 0;
const FAILS = [];
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; FAILS.push(m); console.log('  [FAIL] ' + m); };
const info = (m) => console.log('  [INFO] ' + m);
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };

// strip Arabic combining marks (harakat, superscript alef, Quranic annotation) + tatweel
const strip = (s) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g, '');

console.log('referral-guard: gate 8 (child-safety referral protocol)');

// ===================== CHECK A -- golden integrity =====================
const rawG = read(goldenFile);
if (rawG === null) { console.error('ABORT: cannot read ' + goldenFile); process.exit(2); }
let golden;
try { golden = JSON.parse(rawG); } catch (e) { console.error('ABORT: ' + goldenFile + ' invalid JSON: ' + e.message); process.exit(2); }

const cases = (golden && Array.isArray(golden.cases)) ? golden.cases : null;
if (!cases) { console.error('ABORT: ' + goldenFile + ' has no cases[] array'); process.exit(2); }
info(goldenFile + ' cases = ' + cases.length);

// Lock on the referral case roster: deleting a case must not pass silently at zero.
// Deliberately bump this when the golden set legitimately changes (mirrors recon-audit REFERRAL_CASES_EXPECTED).
const REFERRAL_CASES_EXPECTED = 9;
if (cases.length === REFERRAL_CASES_EXPECTED) pass('A case count = ' + REFERRAL_CASES_EXPECTED);
else fail('A case count = ' + cases.length + ' (expected exactly ' + REFERRAL_CASES_EXPECTED + ' -- update REFERRAL_CASES_EXPECTED deliberately)');

const BANDS = new Set(['young', 'teen', 'adult']);
let malformed = 0;
for (const c of cases) {
  const ok = c && typeof c.id === 'string'
    && BANDS.has(c.band)
    && typeof c.category === 'string'
    && typeof c.input === 'string'
    && typeof c.expect_refer === 'boolean'
    && Array.isArray(c.expect) && c.expect.length > 0;
  if (!ok) { malformed++; fail('A malformed case: ' + (c && c.id ? c.id : '(no id)')); }
}
if (malformed === 0) pass('A all ' + cases.length + ' cases well-formed (id/band/category/input/expect_refer/expect)');

// both directions of the protocol must be represented (refer AND do-not-refer control)
if (cases.some(c => c.expect_refer === true))  pass('A refer direction present (expect_refer=true)');
else fail('A no expect_refer=true case');
if (cases.some(c => c.expect_refer === false)) pass('A control direction present (expect_refer=false)');
else fail('A no expect_refer=false control');

// critical scenarios keyed by SEMANTICS (category/band), not fragile ids
const CRIT = [
  ['self-harm-teen',        (c) => c.category === 'distress_harm' && c.band === 'teen'],
  ['distress-young',        (c) => c.category === 'distress_harm' && c.band === 'young'],
  ['adult-distress-nofam',  (c) => c.category === 'distress_harm' && c.band === 'adult'],
  ['worship-excluded-ctrl', (c) => c.category === 'control_worship_excluded'],
];
for (const [label, pred] of CRIT) {
  if (cases.some(pred)) pass('A critical scenario present: ' + label);
  else fail('A critical scenario MISSING: ' + label);
}

// ===================== CHECK B -- index.html invariants =====================
const rawH = read(indexFile);
if (rawH === null) { console.error('ABORT: cannot read ' + indexFile); process.exit(2); }
const lines = rawH.split('\n');

const START = strip('بروتوكول الإحالة'); // stable protocol name
const RULE  = '\u2550';                    // the ═══ section divider

let startIdx = -1, startHits = 0;
for (let i = 0; i < lines.length; i++) {
  if (strip(lines[i]).includes(START)) { startHits++; if (startIdx === -1) startIdx = i; }
}
if (startIdx === -1)  { console.error('ABORT: referral block header not found in ' + indexFile); process.exit(2); }
if (startHits !== 1)  { console.error('ABORT: referral header ambiguous (' + startHits + ' matches)'); process.exit(2); }

let endIdx = lines.length;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (lines[i].includes(RULE)) { endIdx = i; break; }
}
const block = strip(lines.slice(startIdx, endIdx).join('\n'));
info(indexFile + ' referral block = lines ' + (startIdx + 1) + '..' + endIdx + ' (' + (endIdx - startIdx) + ' lines)');

// safety invariants: ASCII id -> bare Arabic needle(s), any-of. Compared post-strip.
const INV = [
  ['reassure-first',      ['طمأن']],
  ['trusted-adult',       ['يثق فيه']],
  ['no-risk-assessment',  ['تقييم خطر']],
  ['no-diagnosis',        ['تشخص', 'تشخيص']],
  ['adult-to-specialist', ['مختص']],
  ['worship-excluded',    ['أعمدة العبادة']],
  ['self-harm-covered',   ['إيذاء نفسه']],
];
for (const [id, needles] of INV) {
  if (needles.some((n) => block.includes(strip(n)))) pass('B invariant present: ' + id);
  else fail('B invariant MISSING: ' + id);
}

// ===================== SUMMARY =====================
console.log('  SUMMARY   PASS=' + P + '   FAIL=' + F);
if (F > 0) {
  console.log('  -- FAILURES (referral protocol drift) --');
  FAILS.forEach((m) => console.log('    * ' + m));
  process.exit(1);
}
console.log('  OK: referral protocol intact (golden integrity + index.html invariants).');
process.exit(0);
