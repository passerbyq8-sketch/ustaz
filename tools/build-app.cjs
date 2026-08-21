// build-app.cjs -- item 32, commit one. ONE source in the repository generates what ships.
//
// WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT DO YET.
// It reads the shipped JSX through tools/babel-block.cjs -- the one place item 32-b left for
// cutting that block and settling its runtime -- transforms it with the @babel/core in
// node_modules, and writes ONE file, app.js, at the repository root.
//
// At this commit NOTHING references app.js. index.html still loads @babel/standalone from the
// CDN and still transforms the block in the reader's browser, byte for byte as before. That is
// the point: one variable per commit. This commit adds a generated artefact and a check that it
// is reproducible; the next one unwires the CDN.
//
// WHY THE SOURCE IS NORMALISED TO LF BEFORE THE TRANSFORM, AND WHY THAT IS NOT COSMETIC.
// index.html is CRLF-pinned (.gitattributes). The BROWSER never sees those CR: the HTML parser's
// input stream preprocessing replaces every CRLF and every lone CR with a single LF before the
// tokeniser -- so @babel/standalone in the page compiles LF source. A build that fed Babel the
// raw CRLF bytes would emit an app.js that differs from what the page produces today.
// MEASURED, on this block, at the commit that wrote this file: the CRLF input emits 919025 bytes
// carrying 22 CR, the LF-normalised input emits 919003 bytes carrying 0 -- a 22-byte difference,
// and all 22 sit inside preserved block comments (five in one JSDoc header, one in a note). So
// the difference is not behavioural here; it is normalised anyway because reproducing the
// browser is the whole claim this file makes, and because a CR inside a generated file is what
// makes a seal hold on one machine and break on the next (defect 40, .gitattributes).
//
// DETERMINISM IS THE CONTRACT. Two runs must emit identical bytes. Nothing here reads the clock,
// the environment, a random source or the network; the banner carries no timestamp for exactly
// that reason. `--prove` runs the transform twice in one process and prints both digests.
//
// USAGE
//   node tools/build-app.cjs              build and write app.js
//   node tools/build-app.cjs --check      rebuild in memory and compare with the committed
//                                         app.js; exit 1 on any difference (npm run verify:build)
//   node tools/build-app.cjs --prove      build twice, print both sha256, exit 1 if they differ
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const OUT_REL = 'app.js';
const OUT = path.join(REPO, OUT_REL);
const BB = require('./babel-block.cjs');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// The banner is part of the emitted bytes, so it must be as stable as they are: no date, no
// version, no path, nothing that moves when nothing moved.
const BANNER = [
  '// GENERATED FILE -- DO NOT EDIT, AND DO NOT PATCH A BUG HERE.',
  '// Source: the shipped JSX, located by tools/babel-block.cjs. Rebuild: npm run build.',
  '// Verified by `npm run verify:build` and by the gate `babel`, which regenerate this file',
  '// and fail on any difference. An edit made here is overwritten by the next build and is',
  '// reported as a difference by the gate before that.',
  '',
].join('\n');

/**
 * Build the shipped bundle in memory.
 * @returns {{code:string, block:object, sourceBytes:number, outBytes:number, sha:string,
 *            crStripped:number, ms:number}}
 */
function build() {
  const block = BB.readBabelBlock();
  // CRLF -> LF, then any surviving lone CR -> LF: exactly the two substitutions the HTML input
  // stream makes before the browser's tokeniser sees a character.
  const normalised = block.raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const crStripped = block.raw.length - normalised.length;
  const started = process.hrtime.bigint();
  // The transform runs through the same helper every coupled guard uses, with the runtime the
  // page's own pinned Babel settles on -- so what is emitted here is what they measure.
  // retainLines is OFF: it exists to map a stack back to an HTML line for a guard, and the
  // browser's transform does not use it. configFile/babelrc are OFF so a stray .babelrc
  // anywhere above this checkout cannot change what ships.
  const code = BB.transformBabelBlock({
    raw: normalised, runtime: block.runtime,
  }, { retainLines: false, configFile: false, babelrc: false });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const out = BANNER + code + '\n';
  return {
    code: out,
    block: block,
    sourceBytes: Buffer.byteLength(normalised, 'utf8'),
    outBytes: Buffer.byteLength(out, 'utf8'),
    sha: sha256(Buffer.from(out, 'utf8')),
    crStripped: crStripped,
    ms: ms,
  };
}

/**
 * Rebuild and compare against the file on disk.
 * @returns {{ok:boolean, reason:string, built:object, onDiskBytes:number, onDiskSha:string}}
 */
function check() {
  const built = build();
  let disk;
  try { disk = fs.readFileSync(OUT); }
  catch (e) {
    return { ok: false, reason: OUT_REL + ' is not on disk: ' + e.message, built: built,
      onDiskBytes: -1, onDiskSha: '(absent)' };
  }
  const wanted = Buffer.from(built.code, 'utf8');
  if (disk.equals(wanted)) {
    return { ok: true, reason: 'identical', built: built,
      onDiskBytes: disk.length, onDiskSha: sha256(disk) };
  }
  // Name the difference rather than merely reporting one. A line-ending drift and a stale build
  // are different defects with different repairs, and a bare "differs" sends the next reader
  // looking for the wrong one.
  const diskCr = (disk.toString('latin1').match(/\r/g) || []).length;
  const detail = diskCr > 0
    ? 'the committed ' + OUT_REL + ' carries ' + diskCr + ' CR and a fresh build carries none: '
      + 'the checkout rewrote its line endings. Pin it in .gitattributes.'
    : 'the committed ' + OUT_REL + ' is ' + disk.length + ' bytes (' + sha256(disk) + ') and a '
      + 'fresh build is ' + wanted.length + ' bytes (' + built.sha + '): the JSX moved and the '
      + 'bundle was not rebuilt. Run `npm run build` and commit the result.';
  return { ok: false, reason: detail, built: built,
    onDiskBytes: disk.length, onDiskSha: sha256(disk) };
}

module.exports = { build, check, OUT: OUT, OUT_REL: OUT_REL, BANNER: BANNER };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.indexOf(f) !== -1;

  if (has('--prove')) {
    const a = build();
    const b = build();
    console.log('source (LF-normalised)   ' + a.sourceBytes + ' bytes');
    console.log('runtime                  ' + a.block.runtime);
    console.log('EMIT_SHA_RUN1            ' + a.sha);
    console.log('EMIT_SHA_RUN2            ' + b.sha);
    console.log('EMIT_BYTES               ' + a.outBytes + ' / ' + b.outBytes);
    if (a.sha !== b.sha) { console.log('FAIL: two runs of the same build emitted different bytes'); process.exit(1); }
    console.log('OK: two runs emitted identical bytes');
    process.exit(0);
  }

  if (has('--check')) {
    const r = check();
    console.log('built     ' + r.built.outBytes + ' bytes  ' + r.built.sha);
    console.log('on disk   ' + r.onDiskBytes + ' bytes  ' + r.onDiskSha);
    if (!r.ok) { console.log('FAIL: ' + r.reason); process.exit(1); }
    console.log('OK: ' + OUT_REL + ' is exactly what this source builds');
    process.exit(0);
  }

  const r = build();
  fs.writeFileSync(OUT, r.code);
  console.log('source (LF-normalised)   ' + r.sourceBytes + ' bytes  (CR removed: ' + r.crStripped + ')');
  console.log('runtime                  ' + r.block.runtime
    + '  (preset-react, sourceType=script)');
  console.log('wrote                    ' + OUT_REL + '  ' + r.outBytes + ' bytes  in '
    + r.ms.toFixed(0) + 'ms');
  console.log('sha256                   ' + r.sha);
}
