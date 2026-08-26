// guards/adhkar-twins-guard.cjs -- EACH DUPLICATED ADHKAR DATA FILE IS ONE FILE, OR IT IS A BUG.
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
// -- THE SECOND PAIR ---------------------------------------------------------
// adhkar-split-27.json is duplicated for exactly the reason adhkar.json is, and it is the same
// bug waiting in the same place: the root copy is what the browser fetches and precaches, the
// lib/data copy is the authored original the owner approved, and nothing was comparing them. It
// carries a WORDING decision -- six adhkar of the morning are said differently in the evening --
// so a byte that drifts between the two copies is a reader being shown a text the owner did not
// approve, with no gate saying a word.
//
// This guard is WIDENED, not replaced: the adhkar.json pair is still measured first, with the
// same checks in the same order, and the second pair is measured after it by the same code. No
// new gate is registered -- gates.json still names this one script, and the roster is still 99.
//
// Usage: node guards/adhkar-twins-guard.cjs
//        node guards/adhkar-twins-guard.cjs <pathA> <pathB>   (the negative test points it at
//        two scratch copies; with no args it always measures the real pairs below)
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

// The real pairs. Overridable ONLY from argv so the mandatory negative test can prove this
// guard actually falls over on a changed byte; gates.json passes no args. An argv override
// names ONE pair and measures only it -- unchanged behaviour, because that is what the negative
// test drives.
const DEFAULT_PAIRS = [
  ['adhkar.json', 'lib/data/adhkar.json'],
  ['adhkar-split-27.json', 'lib/data/adhkar-split-27.json'],
];
const argv = process.argv.slice(2);
const PAIRS = argv.length === 2 ? [argv] : DEFAULT_PAIRS;
const resolve = (p) => (path.isAbsolute(p) ? p : path.join(REPO, p));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

console.log('=== adhkar-twins-guard -- the shipped copy and the server copy are the same bytes ===');
if (argv.length === 2) console.log('  (argv override -- measuring ' + argv[0] + ' vs ' + argv[1] + ')');

// FAIL-CLOSED ON THE ROSTER ITSELF. A pair list that lost an entry would measure less and still
// say PASS, which is the exact shape of silence this guard exists to end.
ok('every duplicated adhkar data file is on the roster',
  argv.length === 2 || PAIRS.length === 2, 'pairs measured: ' + PAIRS.length);

let diverged = 0;
for (const pair of PAIRS) {
  const seen = [];
  for (const rel of pair) {
    const abs = resolve(rel);
    // FAIL-CLOSED: a missing copy is not "nothing to compare", it is the split itself.
    if (!ok('copy exists: ' + rel, fs.existsSync(abs), abs)) { seen.push(null); continue; }
    const buf = fs.readFileSync(abs);
    seen.push({ rel, abs, bytes: buf.length, sha: sha256(buf) });
  }

  if (seen.some((x) => x === null)) { diverged++; continue; }

  const [A, B] = seen;
  const identical = A.sha === B.sha;
  ok('the two ' + pair[0] + ' copies are byte-identical', identical);

  // Both paths and the fingerprint(s) are printed on BOTH outcomes -- a PASS that does not say
  // WHAT it measured is a PASS nobody can check against a later run.
  if (identical) {
    console.log('        sha256 ' + A.sha);
    console.log('        bytes  ' + A.bytes);
    console.log('        ' + A.rel);
    console.log('        ' + B.rel);
  } else {
    diverged++;
    console.log('        THE TWO COPIES HAVE DIVERGED -- decide which is right, then make the other match.');
    console.log('        ' + A.rel + '\n          sha256 ' + A.sha + '  bytes ' + A.bytes);
    console.log('        ' + B.rel + '\n          sha256 ' + B.sha + '  bytes ' + B.bytes);
  }
}

console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' -- FAIL ===' : ' -- PASS ==='));
process.exit(failures ? 1 : 0);
