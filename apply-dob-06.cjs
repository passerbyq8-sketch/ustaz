// apply-dob-06.cjs
// Al-Murabbi Session 06 / Commit 2 -- DOB option A.
// Edits index.html in exactly TWO places:
//   (1) startChat: also derive + store birthYear (authoritative datum) on the profile object.
//   (2) boot load: one-shot migration for legacy profiles (age -> birthYear) + refresh the
//       derived age from birthYear on every boot, so accounts grow automatically.
// Nothing else is touched: deriveCaps / buildSystemPrompt / all p.age readers / api/* / worship
// stay byte-identical. Pure ASCII source (payload comments are English), strict count checks,
// idempotent (safe to run twice). Rollback if ever needed: git restore index.html
// Run from the repo root:  node apply-dob-06.cjs

'use strict';
const fs = require('fs');

const FILE = 'index.html';

function abort(msg) { console.error('ABORT: ' + msg + ' -- nothing was written.'); process.exit(1); }
function countOf(hay, needle) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

if (!fs.existsSync(FILE)) abort(FILE + ' not found. Run from the repo root.');
const src = fs.readFileSync(FILE, 'utf8');

// EOL policy: repo file is LF (probe 2026-07-08 confirmed). A CRLF file would make the
// multi-line anchor fail silently, so we stop loudly instead of guessing.
if (src.indexOf('\r') !== -1) abort('CRLF/CR detected in ' + FILE + '. Expected pure LF. Report this back before applying.');

// Idempotency: birthYear must not exist anywhere before the patch (probe counted 0).
if (src.indexOf('birthYear') !== -1) {
  console.log('ALREADY APPLIED: birthYear present in ' + FILE + '. Nothing to do.');
  process.exit(0);
}

// ---------- Edit 1: startChat (creation) ----------
const OLD_A = '    const p = { name, age, gender, createdAt: new Date().toISOString() };';
const NEW_A = [
  '    // Session 06 / Commit 2 (DOB, option A): birthYear is the authoritative stored datum.',
  '    // age stays on the object as a DERIVED value (approx, +/- 1y: month unknown) and is',
  '    // recomputed from birthYear on every boot load, so accounts grow automatically.',
  '    const birthYear = new Date().getFullYear() - (parseInt(age, 10) || 0);',
  '    const p = { name, age, gender, birthYear, createdAt: new Date().toISOString() };'
].join('\n');

// ---------- Edit 2: boot load (migration + refresh) ----------
const OLD_B = [
  '        const p = JSON.parse(profileData);',
  '        profileRef.current = p;'
].join('\n');
const NEW_B = [
  '        const p = JSON.parse(profileData);',
  '        // Session 06 / Commit 2 (DOB) -- one-shot migration: legacy profiles carry age only.',
  '        // Derive birthYear from it once and persist, so nobody loses their band or re-onboards.',
  '        if (p && p.birthYear == null && p.age != null) {',
  '          p.birthYear = new Date().getFullYear() - (parseInt(p.age, 10) || 0);',
  '          try { localStorage.setItem(\'child_profile\', JSON.stringify(p)); } catch (e) {}',
  '        }',
  '        // DOB refresh: age is DERIVED from birthYear on every boot (approx, +/- 1y accepted),',
  '        // so the stored account ages automatically; deriveCaps/buildSystemPrompt keep reading p.age.',
  '        if (p && p.birthYear != null) {',
  '          const derivedAge = new Date().getFullYear() - (parseInt(p.birthYear, 10) || 0);',
  '          if (derivedAge >= 0 && derivedAge <= 120) p.age = derivedAge;',
  '        }',
  '        profileRef.current = p;'
].join('\n');

// ---------- Strict pre-checks (counts must be exact or we stop) ----------
const cA = countOf(src, OLD_A);
const cB = countOf(src, OLD_B);
if (cA !== 1) abort('anchor A (startChat profile line) count = ' + cA + ', expected exactly 1.');
if (cB !== 1) abort('anchor B (boot load pair) count = ' + cB + ', expected exactly 1.');

// ---------- Apply ----------
let out = src.replace(OLD_A, NEW_A);
out = out.replace(OLD_B, NEW_B);

// ---------- Post-checks (self-computed, no manual arithmetic) ----------
const expected = countOf(NEW_A, 'birthYear') + countOf(NEW_B, 'birthYear');
const got = countOf(out, 'birthYear');
if (got !== expected) abort('post-check failed: birthYear count = ' + got + ', expected ' + expected + '.');
if (countOf(out, OLD_A) !== 0) abort('post-check failed: anchor A still present.');
if (countOf(out, OLD_B) !== 0) abort('post-check failed: anchor B still present.');

fs.writeFileSync(FILE, out, 'utf8');

console.log('APPLIED: DOB commit-2 patch written to ' + FILE + '.');
console.log('  edit 1 (startChat creation)  : 1 site');
console.log('  edit 2 (boot migrate+refresh): 1 site');
console.log('  birthYear occurrences now    : ' + got + ' (expected ' + expected + ')');

// Info only: current persistence flag (affects WHICH paths are live-testable today, not the patch).
const lines = out.split('\n');
let flagLine = null;
for (const L of lines) { if (L.indexOf('PERSIST_CONVERSATION =') !== -1) { flagLine = L.trim(); break; } }
console.log('  info: ' + (flagLine ? flagLine : 'PERSIST_CONVERSATION definition not found'));
console.log('Next: node babel-gate.cjs  then  node runtime-gate.cjs  (worship untouched -> no worship-guard needed).');