// prebuild-jsx.cjs — item 32-a. MEASURE the in-browser JSX transform. Wire NOTHING.
//
// WHAT IS MEASURED, AND WHY IT MATTERS. index.html ships one `<script type="text/babel">` block
// and three render-blocking CDN tags above it, one of which is @babel/standalone. Every full load
// downloads ~3 MB of compiler and then transpiles the whole block IN THE READER'S BROWSER before
// a single component renders. A warm cache saves the TRANSFER and not one millisecond of the
// TRANSFORM: the bytes are cached, the work is not.
//
// THE SHARP EDGE OF THIS ITEM. It produces a tool, a proof and an inventory, and it CONNECTS
// NOTHING:
//   * zero bytes of index.html -- the compiled output is never referenced from the page;
//   * zero change to the three blocking tags;
//   * zero change to .vercelignore;
//   * zero entries added to sw.js's CORE.
// The output is written to a path OUTSIDE the repository and is never committed, deliberately:
// index.html is being edited on another screen right now, so any committed build artefact would
// be born stale and would then be tested instead of what ships.
//
// AND THE REAL PRICE OF THE ITEM IS AN INVENTORY, NOT A PATCH. Fourteen guards in this tree do
// not merely read index.html -- they EXTRACT the text/babel block and transform it themselves,
// and eight of those decide `runtime: classic|automatic` by parsing the major version out of the
// @babel/standalone CDN URL. Remove the CDN tag without rewriting all of them and the gates go on
// transforming a block the page no longer transforms, with a runtime choice derived from a URL
// that is no longer there: a build that tests something other than what it ships. That coupling,
// not the transform cost, is why item 32 has sat in the queue. `--inventory` prints it.
//
// USAGE
//   node tools/prebuild-jsx.cjs                  extract, transform, write, and print the numbers
//   node tools/prebuild-jsx.cjs --inventory      print only the coupled-guard inventory
//   node tools/prebuild-jsx.cjs --out <path>     write the compiled output somewhere else
//   node tools/prebuild-jsx.cjs --repeat <n>     transform n times and report the median
//   node tools/prebuild-jsx.cjs --compare-standalone
//                                                ALSO fetch the exact @babel/standalone the page
//                                                pins, run it over the same block, and say
//                                                whether the two outputs are byte-identical.
//                                                This is the ONLY mode that touches the network.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const INDEX = 'index.html';
const OUT_DIR = path.join(os.tmpdir(), 'ezik-prebuild-jsx');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

// ---------------------------------------------------------------------------
// READING. Nothing below writes into the repository, and this function is the only place that
// touches index.html at all -- by reading it, with the same regex pair the fourteen guards use,
// so that what is measured here is what they measure.
// ---------------------------------------------------------------------------
function readBlock() {
  const html = fs.readFileSync(path.join(REPO, INDEX), 'utf8');
  const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
  const mOpen = openRe.exec(html);
  if (!mOpen) throw new Error('no <script type="text/babel"> block in ' + INDEX);
  const from = mOpen.index + mOpen[0].length;
  const to = html.indexOf('</script>', from);
  if (to === -1) throw new Error('the text/babel block in ' + INDEX + ' is never closed');
  const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
  const verMatch = babelSrc.match(/@babel\/standalone@([\d.]+)/);
  return {
    html: html,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    raw: html.slice(from, to),
    rawBytes: Buffer.byteLength(html.slice(from, to), 'utf8'),
    openTag: mOpen[0],
    babelSrc: babelSrc,
    // The FULL version, not just the major. The guards keep only the major because that is all
    // their runtime fork needs; a byte comparison needs the exact release the page pins.
    babelVersion: verMatch ? verMatch[1] : null,
    babelMajor: verMatch ? parseInt(verMatch[1], 10) : null,
  };
}

// The runtime choice, derived exactly as every coupled guard derives it: from the CDN URL. This
// is reproduced rather than hard-coded so that the tool's answer moves when theirs would.
function runtimeFor(major) { return (major === null ? 8 : major) >= 8 ? 'automatic' : 'classic'; }

function transform(raw, runtime) {
  const babel = require(path.join(REPO, 'node_modules', '@babel', 'core'));
  const started = process.hrtime.bigint();
  const out = babel.transformSync(raw, {
    presets: [[path.join(REPO, 'node_modules', '@babel', 'preset-react'), { runtime: runtime }]],
    filename: 'babel-block.jsx',
    sourceType: 'script',
    retainLines: true,
  }).code;
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { code: out, ms: ms };
}

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ---------------------------------------------------------------------------
// THE INVENTORY. Every file that extracts the text/babel block, and every file that decides how
// to transform it by reading the CDN URL. Printed with path and line, because the point of it is
// that somebody doing item 32 for real has to open each one.
// ---------------------------------------------------------------------------
const SCAN_EXT = /\.(cjs|mjs|js)$/;
function walk(rel, out) {
  let entries;
  try { entries = fs.readdirSync(path.join(REPO, rel), { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(r, out); }
    else if (SCAN_EXT.test(e.name)) out.push(r);
  }
  return out;
}
function inventory() {
  const files = walk('', []);
  const extractors = [];
  const cdnInferrers = [];
  const cdnMentions = [];
  for (const f of files) {
    if (f === 'tools/prebuild-jsx.cjs') continue;   // this file talks about the pattern, it is not one
    let src;
    try { src = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { continue; }
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const at = f + ':' + (i + 1);
      // (1) extraction: the open-tag regex the block is cut with. Comments mentioning the block
      //     are not coupling, so the pattern is the REGEX, not the phrase.
      if (/type=\["'\]?\\?["']?text\\?\/babel/.test(line) || /text\\\/babel/.test(line)) {
        extractors.push({ at: at, line: line.trim() });
      }
      // (2) inference: the major version parsed out of the CDN URL and turned into a decision.
      if (/@babel\\\/standalone@\(\\d/.test(line) || /standalone@\(\[\\d/.test(line)) {
        cdnInferrers.push({ at: at, line: line.trim() });
      } else if (/@babel\\\/standalone/.test(line) || /@babel\/standalone/.test(line)) {
        cdnMentions.push({ at: at, line: line.trim() });
      }
    }
  }
  return { extractors, cdnInferrers, cdnMentions, scanned: files.length };
}

function printInventory(inv) {
  console.log('=== THE PRICE OF UNWIRING: what is coupled to the text/babel block ===');
  console.log('(' + inv.scanned + ' .cjs/.mjs/.js files scanned, node_modules excluded)');
  const group = (title, why, rows) => {
    console.log('\n-- ' + title + ' -- ' + rows.length + ' site(s)');
    console.log('   ' + why);
    const byFile = {};
    for (const r of rows) {
      const f = r.at.split(':')[0];
      (byFile[f] = byFile[f] || []).push(r.at.split(':')[1]);
    }
    for (const f of Object.keys(byFile).sort()) {
      console.log('   ' + f + '  line(s) ' + byFile[f].join(', '));
    }
  };
  group('A. EXTRACTS the text/babel block',
    'These cut the block out of index.html with their own regex and transform it themselves.\n'
    + '   A prebuilt bundle that replaced the block would leave every one of them reading a\n'
    + '   tag that is no longer there -- or, worse, still there and no longer what ships.',
    inv.extractors);
  group('B. INFERS the transform from the CDN URL',
    'These parse the major version out of the @babel/standalone src and choose\n'
    + '   runtime: classic | automatic from it. Remove the tag and the fallback takes over\n'
    + '   silently -- the gates keep passing while transforming with the OTHER runtime.',
    inv.cdnInferrers);
  group('C. MENTIONS the CDN host or the standalone package otherwise',
    'Host allow-lists, SRI expectations and prose. Not a transform decision, but every\n'
    + '   one is a line that has to move when the tag does.',
    inv.cdnMentions);
}

// ---------------------------------------------------------------------------
// THE OPTIONAL NETWORK STEP. The only thing in this file that leaves the machine.
// ---------------------------------------------------------------------------
function fetchStandalone(version) {
  const cache = path.join(OUT_DIR, 'babel-standalone-' + version + '.js');
  if (fs.existsSync(cache)) return Promise.resolve({ path: cache, from: 'cache', body: fs.readFileSync(cache, 'utf8') });
  const url = 'https://cdn.jsdelivr.net/npm/@babel/standalone@' + version + '/babel.min.js';
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(url + ' answered ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(cache, body);
        resolve({ path: cache, from: url, body: body.toString('utf8') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timed out fetching ' + url)); });
  });
}

// Run the browser's own compiler over the same block, in a sandbox with no network, no
// filesystem and no require -- the same technique the service-worker guard uses.
function transformWithStandalone(bundleSource, raw, runtime) {
  const sandbox = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  sandbox.self = sandbox; sandbox.window = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(bundleSource, ctx, { filename: 'babel-standalone.js' });
  ctx.__raw = raw; ctx.__runtime = runtime;
  const started = process.hrtime.bigint();
  const code = vm.runInContext(
    'Babel.transform(__raw, { presets: [["react", { runtime: __runtime }]],'
    + ' filename: "babel-block.jsx", sourceType: "script", retainLines: true }).code', ctx);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { code: code, ms: ms, version: vm.runInContext('Babel.version', ctx) };
}

// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const arg = (name, dflt) => { const i = argv.indexOf(name); return i === -1 ? dflt : argv[i + 1]; };
  const inv = inventory();

  if (argv.includes('--inventory')) { printInventory(inv); return 0; }

  const b = readBlock();
  const runtime = runtimeFor(b.babelMajor);
  const repeat = Math.max(1, parseInt(arg('--repeat', '5'), 10) || 5);
  const outPath = arg('--out', path.join(OUT_DIR, 'babel-block.compiled.js'));

  console.log('=== the block, as it is read out of ' + INDEX + ' ===');
  console.log('index.html                ' + b.htmlBytes + ' bytes (' + kb(b.htmlBytes) + ')');
  console.log('text/babel block          ' + b.rawBytes + ' bytes (' + kb(b.rawBytes) + '), '
    + Math.round((b.rawBytes / b.htmlBytes) * 100) + '% of the document');
  console.log('open tag                  ' + b.openTag);
  console.log('babel CDN src             ' + (b.babelSrc || '(none found)'));
  console.log('version pinned in the URL ' + (b.babelVersion || '(none)')
    + '  -> runtime: ' + runtime + '  (major ' + b.babelMajor + ', the fork 8 guards reproduce)');

  const runs = [];
  let built = null;
  for (let i = 0; i < repeat; i++) { built = transform(b.raw, runtime); runs.push(built.ms); }
  const outBytes = Buffer.byteLength(built.code, 'utf8');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, built.code);

  console.log('\n=== the transform, with the LOCAL compiler ===');
  const localVersion = require(path.join(REPO, 'node_modules', '@babel', 'core', 'package.json')).version;
  console.log('@babel/core (local)       ' + localVersion);
  console.log('output                    ' + outBytes + ' bytes (' + kb(outBytes) + '), '
    + (outBytes > b.rawBytes ? '+' : '') + (outBytes - b.rawBytes) + ' vs the source block');
  console.log('sha256                    ' + sha256(built.code));
  console.log('transform time            median ' + median(runs).toFixed(1) + ' ms over ' + repeat
    + ' run(s)  [' + runs.map((x) => x.toFixed(1)).join(', ') + ']');
  console.log('written to                ' + outPath);
  console.log('                          (outside the repository, and NEVER committed: index.html');
  console.log('                           is being edited elsewhere, so a committed artefact');
  console.log('                           would be born stale and then tested instead of shipped)');

  // THE VERSION CONFLICT, STATED WHETHER OR NOT IT IS RESOLVED.
  console.log('\n=== the version conflict ===');
  console.log('package.json declares     @babel/core ' + localVersion + ' (devDependency)');
  console.log('the browser is served     @babel/standalone ' + (b.babelVersion || '(unknown)') + ' from the CDN tag');
  console.log('so the tool above ran     ' + localVersion + ' with runtime "' + runtime
    + '", chosen from the URL major');
  const both = transform(b.raw, runtime === 'automatic' ? 'classic' : 'automatic');
  console.log('the fork is real          the other runtime gives '
    + Buffer.byteLength(both.code, 'utf8') + ' bytes / ' + sha256(both.code).slice(0, 16)
    + ' -- a ' + (Buffer.byteLength(both.code, 'utf8') - outBytes) + '-byte difference, so a guard');
  console.log('                          that loses the URL loses a real decision, not a formality');

  if (!argv.includes('--compare-standalone')) {
    console.log('\nbyte equality with the browser\'s own compiler: NOT MEASURED in this run.');
    console.log('@babel/standalone is not a dependency of this repository and is not on disk.');
    console.log('Run with --compare-standalone to fetch the exact pinned release and settle it.');
  } else {
    if (!b.babelVersion) {
      console.log('\nbyte equality: CANNOT BE MEASURED -- no @babel/standalone version in the CDN URL.');
    } else {
      try {
        const bundle = await fetchStandalone(b.babelVersion);
        const browser = transformWithStandalone(bundle.body, b.raw, runtime);
        const browserBytes = Buffer.byteLength(browser.code, 'utf8');
        console.log('\n=== the transform, with the BROWSER\'s own compiler ===');
        console.log('source                    ' + bundle.from);
        console.log('bundle                    ' + Buffer.byteLength(bundle.body, 'utf8') + ' bytes ('
          + kb(Buffer.byteLength(bundle.body, 'utf8')) + '), downloaded before the first render');
        console.log('Babel.version reported    ' + browser.version);
        console.log('output                    ' + browserBytes + ' bytes');
        console.log('sha256                    ' + sha256(browser.code));
        console.log('transform time            ' + browser.ms.toFixed(1) + ' ms (one run, in a vm)');
        const same = browser.code === built.code;
        console.log('\nIDENTICAL: ' + (same ? 'YES -- the two compilers agree byte for byte'
          : 'NO -- the outputs differ by ' + Math.abs(browserBytes - outBytes) + ' bytes.'));
        if (!same) {
          // Say WHERE, not just that. A diff nobody can locate is a claim, not a measurement.
          const a = built.code, c = browser.code;
          let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
          console.log('first divergence at byte ' + i + ':');
          console.log('  local      ...' + JSON.stringify(a.slice(Math.max(0, i - 40), i + 60)));
          console.log('  standalone ...' + JSON.stringify(c.slice(Math.max(0, i - 40), i + 60)));
        }
      } catch (e) {
        console.log('\nbyte equality: NOT MEASURED -- ' + e.message);
        console.log('(no network, or the CDN refused. This is a measurement that failed, not a');
        console.log(' result: nothing here may be read as "the outputs match".)');
      }
    }
  }

  console.log('');
  printInventory(inv);
  return 0;
}

module.exports = { readBlock, runtimeFor, transform, inventory };

if (require.main === module) {
  main().then((c) => process.exit(c), (e) => { console.error('prebuild-jsx: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
}
