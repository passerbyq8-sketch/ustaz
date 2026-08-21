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
