// guards/adhkar-twins-guard.cjs -- THE TWO adhkar.json COPIES ARE ONE FILE OR THEY ARE A BUG.
//
// -- WHY THIS GATE EXISTS ----------------------------------------------------
// adhkar.json exists TWICE in this tree, deliberately:
//
//   adhkar.json           the root copy. This is the one that SHIPS -- the client fetches it
//                         at runtime, and .vercelignore is explicit that it must never be
//                         excluded.
//   lib/data/adhkar.json  the server-side copy, read by the Node side. .vercelignore EXCLUDES
//                         this one from the deployment precisely because the root copy is what
//                         the browser gets.
//
// Two copies of one number is one number waiting to drift -- lib/ratelimit.js says exactly
// this, and names the duplicated adhkar.json as the thing that taught it. Nothing in the tree
// was checking the two copies still agree. A dhikr corrected in one copy and not the other is
// a silent split: the client shows one text, the server reasons about another, and no gate
// says a word.
//
// -- WHAT THIS GATE DOES AND DOES NOT DO -------------------------------------
// It COMPARES. It does not repair, delete, regenerate or normalise either copy -- a guard that
// edits the tree destroys the tree-clean signal the other gates rely on, and picking a winner
// between two religious texts is not a decision a gate gets to make. On a mismatch it prints
// both fingerprints and both paths and fails; a human decides which copy is right.
//
// The comparison is over RAW BYTES, not parsed JSON. A CR injected by core.autocrlf, a BOM, or
// a re-indent are all real divergence between what the browser fetches and what the server
// reads, and a parse-then-compare would call them equal. Both paths are pinned `text eol=lf`
// in .gitattributes for the same reason.
//
// Usage: node guards/adhkar-twins-guard.cjs
//        node guards/adhkar-twins-guard.cjs <pathA> <pathB>   (the negative test points it at
//        two scratch copies; with no args it always measures the real pair below)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// The real pair. Overridable ONLY from argv so the mandatory negative test can prove this
// guard actually falls over on a changed byte; gates.json passes no args.
const DEFAULT_PAIR = ['adhkar.json', 'lib/data/adhkar.json'];
const argv = process.argv.slice(2);
const PAIR = argv.length === 2 ? argv : DEFAULT_PAIR;
const resolve = (p) => (path.isAbsolute(p) ? p : path.join(REPO, p));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

console.log('=== adhkar-twins-guard -- the shipped copy and the server copy are the same bytes ===');
if (PAIR !== DEFAULT_PAIR) console.log('  (argv override -- measuring ' + PAIR[0] + ' vs ' + PAIR[1] + ')');

const seen = [];
for (const rel of PAIR) {
  const abs = resolve(rel);
  // FAIL-CLOSED: a missing copy is not "nothing to compare", it is the split itself.
  if (!ok('copy exists: ' + rel, fs.existsSync(abs), abs)) { seen.push(null); continue; }
  const buf = fs.readFileSync(abs);
  seen.push({ rel, abs, bytes: buf.length, sha: sha256(buf) });
}

if (seen.some((s) => s === null)) {
  console.log('\n=== ' + (checks - failures) + '/' + checks + ' -- FAIL ===');
  process.exit(1);
}

const [A, B] = seen;
const identical = A.sha === B.sha;
ok('the two adhkar.json copies are byte-identical', identical);

// Both paths and the fingerprint(s) are printed on BOTH outcomes -- a PASS that does not say
// WHAT it measured is a PASS nobody can check against a later run.
if (identical) {
  console.log('        sha256 ' + A.sha);
  console.log('        bytes  ' + A.bytes);
  console.log('        ' + A.rel);
  console.log('        ' + B.rel);
} else {
  console.log('        THE TWO COPIES HAVE DIVERGED -- decide which is right, then make the other match.');
  console.log('        ' + A.rel + '\n          sha256 ' + A.sha + '  bytes ' + A.bytes);
  console.log('        ' + B.rel + '\n          sha256 ' + B.sha + '  bytes ' + B.bytes);
}

console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' -- FAIL ===' : ' -- PASS ==='));
process.exit(failures ? 1 : 0);
