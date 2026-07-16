#!/usr/bin/env node
'use strict';
// classifier-guard.cjs  --  GATE 9: DEEN/GEN fast-channel classifier (call path).
//
// The classifier logic is fail-CLOSED and sound; this guard FREEZES that so it
// cannot silently erode. It does NOT change behaviour -- it asserts the safety
// scaffolding is still present in index.html's __classifyFast region.
//
// Four layers guarded:
//   C1  classifier system-prompt safety net (identity + doubt->DEEN + feelings/safety->DEEN)
//   C2  the four fail-closed branches (every failure path returns 'DEEN')
//   C3  GEN routing is gated to mode === 'call' (cannot leak into text chat)
//   C4  GEN prompt keeps its two deflections (religious -> al-Murabbi, safety -> trusted adult)
//
// Arabic needles are literals but NEVER printed; all output is ASCII (ق1).
// Harakat + tatweel stripped both sides so rewording/vowels do not false-fail.
// Exit 0 = all pass | 1 = drift / missing invariant | 2 = could not run (structural).
//
// Usage:  node classifier-guard.cjs [indexFile]     (default: index.html in cwd)

const fs = require('fs');

const indexFile = (process.argv[2] && !process.argv[2].startsWith('-')) ? process.argv[2] : 'index.html';

let P = 0, F = 0;
const FAILS = [];
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; FAILS.push(m); console.log('  [FAIL] ' + m); };
const info = (m) => console.log('  [INFO] ' + m);
const strip = (s) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g, '');

console.log('classifier-guard: gate 9 (DEEN/GEN fast-channel classifier)');

const src = (() => { try { return fs.readFileSync(indexFile, 'utf8'); } catch (e) { return null; } })();
if (src === null) { console.error('ABORT: cannot read ' + indexFile); process.exit(2); }

// ---- bound the classifier region: __classifyFast .. the else-branch buildSystemPrompt ----
const START = 'const __classifyFast = async ()';
const END   = 'buildSystemPrompt(p.name, p.age, p.gender, mode)';
const cnt = (h, n) => h.split(n).length - 1;
if (cnt(src, START) !== 1) { console.error('ABORT: classifier START anchor not unique (' + cnt(src, START) + ')'); process.exit(2); }
if (cnt(src, END) !== 1)   { console.error('ABORT: classifier END anchor not unique (' + cnt(src, END) + ')'); process.exit(2); }
const a = src.indexOf(START), b = src.indexOf(END);
if (a === -1 || b === -1 || a >= b) { console.error('ABORT: classifier region not found in order'); process.exit(2); }
const region = src.slice(a, b);
const R = strip(region);
info(indexFile + ' classifier region = ' + region.length + ' bytes (__classifyFast .. GEN branch)');

// ---- ASCII invariants: fail-closed branches (C2) + call-gate (C3) ----
const CODE = [
  ['C2 failclosed-empty',     "if (!__curText) return 'DEEN'"],
  ['C2 failclosed-network',   "if (!__resp.ok || !__resp.body) return 'DEEN'"],
  ['C2 failclosed-only-GEN',  "=== 'GEN') ? 'GEN' : 'DEEN'"],
  ['C2 failclosed-exception', "catch (__e) { return 'DEEN'; }"],
  ['C3 gen-gated-to-call',    "mode === 'call' && (await __classifyFast())"],
];
for (const [id, needle] of CODE) {
  if (region.includes(needle)) pass(id);
  else fail(id + '  (fail-closed / call-gate invariant gone)');
}

// ---- Arabic invariants: classifier prompt safety net (C1) + GEN deflections (C4) ----
const AR = [
  ['C1 classifier-identity',        'مصنف مسارات'],
  ['C1 doubt-to-DEEN',              'أدنى شك'],
  ['C1 feelings-safety-to-DEEN',    'مشاعر الطفل'],
  ['C4 gen-defers-religious',       'تركه للمربي'],
  ['C4 gen-defers-safety',          'شخصا كبيرا'],
];
for (const [id, needle] of AR) {
  if (R.includes(strip(needle))) pass(id);
  else fail(id + '  (classifier/GEN safety phrase gone)');
}

// ---- summary ----
console.log('  SUMMARY   PASS=' + P + '   FAIL=' + F);
if (F > 0) {
  console.log('  -- FAILURES (classifier drift) --');
  FAILS.forEach((m) => console.log('    * ' + m));
  process.exit(1);
}
console.log('  OK: DEEN/GEN classifier safety scaffolding intact.');
process.exit(0);
