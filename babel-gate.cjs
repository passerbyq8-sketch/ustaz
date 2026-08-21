const fs = require('fs');
const os = require('os');
const path = require('path');
const babel = require('@babel/core');

// The extracted block is a 900KB scratch artifact, not a deliverable. It used to land in the
// repo root, so every run of this gate dirtied the working tree -- which is the one thing the
// tree-clean checks are supposed to be able to trust. Nothing reads it back: the eight other
// mentions of the name across the tree are all babel/vm `filename:` labels.
const OUT_DIR = path.join(os.tmpdir(), 'ezik-gates');
const OUT_FILE = path.join(OUT_DIR, 'babel-block.jsx');

const html = fs.readFileSync('index.html', 'utf8');

// ITEM 32-b: the block is located in ONE place, tools/babel-block.cjs, and a missing anchor is
// a named error rather than a silent empty string. This gate does not fork on the runtime, so
// only the extraction moved; its transform below is unchanged.
const BB = require('./tools/babel-block.cjs');
let block;
try { block = BB.readBabelBlock({ file: 'index.html', html: html }); }
catch (e) { console.error(e.message); process.exit(2); }
const code = block.raw;
const lineOffset = block.lineOffset;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, code);
console.log('block written to: ' + OUT_FILE);

try {
  babel.transformSync(code, {
    presets: ['@babel/preset-react'],
    filename: 'babel-block.jsx',
    sourceType: 'script',          // mirror babel-standalone default (NOT module)
  });
  console.log('OK: Babel transform succeeded with sourceType=script (no error reproduced)');
} catch (e) {
  console.log('=== BABEL ERROR (sourceType=script) ===');
  console.log(e.message);
  if (e.loc) {
    const htmlLine = lineOffset + e.loc.line;
    console.log(`\nBlock-relative line: ${e.loc.line}, col ${e.loc.column}`);
    console.log(`HTML file line: ~${htmlLine}`);
    const blkLines = code.split('\n');
    const ctx = blkLines[e.loc.line - 1];
    console.log(`Offending line: ${ctx}`);
  }
  process.exit(1);
}

// Independently scan the block for import statements
console.log('\n=== IMPORT SCAN (block-relative + HTML line) ===');
const blkLines = code.split('\n');
let found = 0;
blkLines.forEach((l, i) => {
  if (/(^|[^.\w])import\b/.test(l)) {
    found++;
    console.log(`block L${i + 1} / html L${lineOffset + i + 1}: ${l.trim()}`);
  }
});
if (!found) {
  console.log('(no lines containing the word "import" in the babel block)');
} else {
  console.log(`FAIL: ${found} import-scan violation(s) in the babel block`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// ITEM 32. THE GENERATED BUNDLE IS EXACTLY WHAT THIS SOURCE BUILDS.
//
// WHY IT LIVES HERE AND NOT IN A GATE OF ITS OWN. A new entry in gates.json costs five coupled
// edits in this tree -- the roster, recon's hand-pinned GATES_EXPECTED, a .gitattributes pin,
// the git-add, and an exact-set contract inside guards/stored-deen-sub-suite.cjs that surfaces
// as an unrelated `takhrij` failure -- two of which sit in files another screen owns. This gate
// already cuts the same block out of index.html with the same helper and already transforms it,
// so the artefact built from that block is checked where the block is read. The gate count is a
// floor, not a ceiling: nothing is removed, two assertions are added.
//
// WHAT IT ASSERTS, AND WHY EACH HALF IS NEEDED.
//   1. REPRODUCIBLE: two builds in this run emit one digest. A build that read the clock, the
//      environment or a random source would pass a comparison against its own last output and
//      fail here.
//   2. CURRENT: the committed app.js equals a fresh build of today's source. This is the half
//      that catches the real defect -- JSX edited, bundle not rebuilt -- which would otherwise
//      ship a page whose behaviour no gate in this suite has ever run.
// Both are positive equalities over bytes that were read: neither is satisfied by an empty or
// missing file (an absent app.js is reported by name, not passed over).
// ---------------------------------------------------------------------------------------------
const BUILD = require('./tools/build-app.cjs');

const first = BUILD.check();
const second = BUILD.build();

console.log('\n=== ITEM 32: GENERATED BUNDLE ===');
console.log('built     ' + first.built.outBytes + ' bytes  ' + first.built.sha);
console.log('on disk   ' + first.onDiskBytes + ' bytes  ' + first.onDiskSha);

if (second.sha !== first.built.sha) {
  console.log('FAIL: two builds of the same source emitted different bytes ('
    + first.built.sha + ' then ' + second.sha + '). The build is not reproducible, so the file '
    + 'on disk cannot be evidence of anything.');
  process.exit(1);
}
console.log('OK: two builds in this run emitted identical bytes');

if (!first.ok) {
  console.log('FAIL: ' + first.reason);
  process.exit(1);
}
console.log('OK: app.js is byte-for-byte what the shipped JSX builds');
