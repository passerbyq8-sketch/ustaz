// core-bytes.cjs — the CORE_BYTES constant in sw.js, derived instead of remembered.
//
// WHY THIS FILE EXISTS. sw.js declares `const CORE_BYTES = <n>` and uses it as the pre-check a
// full disk is measured against: install refuses to start writing when the free space is below
// CORE_BYTES + half again. The number is the byte sum of the files the CORE array names — and it
// was cut BY HAND, so it went stale on every single commit that touched any of them.
//
// That is not a hypothetical. Merge round (b) of 2026-08-21 stopped on exactly this: the branch
// declared 1634924, the merged tree weighed 1644371, and the 9447-byte difference was index.html
// growing on the other side of the merge. Nothing was wrong with either branch. The constant was
// simply a hand-copied measurement of seven files that two people were editing.
//
// SO THE LIST IS READ FROM sw.js ITSELF. Not from a second list kept here — a second list is the
// same defect one layer up, and it drifts the first time somebody adds an entry to CORE and not
// to the copy. This parses the `const CORE = [...]` array out of the worker's own source, maps
// each entry to the file it names on disk, and sums what it finds.
//
// WHAT THIS TOOL DOES NOT DO. It does not stop the constant from going stale — running a tool is
// a human discipline, and human discipline is not a deploy mechanism. The thing that actually
// holds is the assertion in quest-bank-integrity-guard.cjs, which re-derives this sum on every
// gate run and FAILS on any deviation in either direction. This tool exists so that repairing
// that failure is one command rather than seven `stat` calls and an addition.
//
// USAGE
//   node tools/core-bytes.cjs           print the table and the sum; exit 1 if sw.js disagrees
//   node tools/core-bytes.cjs --write   the same, and rewrite CORE_BYTES in sw.js when it differs
//   node tools/core-bytes.cjs --json    machine-readable, for a caller that wants the numbers
//
// It writes nothing anywhere unless --write is passed, and then it writes exactly one integer in
// exactly one file. In particular it NEVER touches CACHE / SW_CACHE: the store name is a ship
// decision that belongs to whoever cuts the release, not to an arithmetic tool.
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SW_FILE = 'sw.js';

// '/' is the app shell, which Vercel serves byte-identically from index.html. Every other CORE
// entry is a same-origin path that names a file at the repository root. Kept as an explicit map
// rather than a strip-the-slash rule so that an entry nobody anticipated fails LOUDLY here
// instead of being silently measured as zero.
const URL_TO_FILE = { '/': 'index.html' };
function fileFor(url) {
  if (Object.prototype.hasOwnProperty.call(URL_TO_FILE, url)) return URL_TO_FILE[url];
  if (url.startsWith('/') && url.indexOf('..') === -1) return url.slice(1);
  return null;
}

// The CORE array, out of the worker's own source. Comments inside the array are stripped before
// the string literals are collected, because CORE carries prose between its entries and a naive
// scan would pick up a path quoted in a sentence.
function parseCore(src) {
  const at = src.indexOf('const CORE = [');
  if (at === -1) throw new Error(SW_FILE + ' declares no `const CORE = [` array');
  const open = src.indexOf('[', at);
  const close = src.indexOf('];', open);
  if (close === -1) throw new Error(SW_FILE + ': the CORE array is never closed');
  const body = src.slice(open + 1, close).replace(/\/\/[^\n]*/g, '');
  const urls = [];
  for (const m of body.matchAll(/'([^']*)'|"([^"]*)"/g)) urls.push(m[1] !== undefined ? m[1] : m[2]);
  if (!urls.length) throw new Error(SW_FILE + ': the CORE array holds no entries');
  return urls;
}

function declaredCoreBytes(src) {
  const m = src.match(/CORE_BYTES\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// The whole measurement, as data. Exported so a guard can assert on it without shelling out.
function measure(repo) {
  const root = repo || REPO;
  const src = fs.readFileSync(path.join(root, SW_FILE), 'utf8');
  const urls = parseCore(src);
  const rows = urls.map((url) => {
    const file = fileFor(url);
    const abs = file === null ? null : path.join(root, file);
    const exists = abs !== null && fs.existsSync(abs);
    return { url, file, exists, bytes: exists ? fs.statSync(abs).size : null };
  });
  const missing = rows.filter((r) => !r.exists);
  const total = rows.reduce((n, r) => n + (r.bytes || 0), 0);
  return { rows, missing, total, declared: declaredCoreBytes(src) };
}

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function lpad(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const asJson = argv.includes('--json');

  let m;
  try { m = measure(REPO); } catch (e) {
    console.error('core-bytes: ' + e.message);
    process.exit(2);
  }

  if (asJson) {
    console.log(JSON.stringify(m, null, 2));
    process.exit(m.missing.length || m.declared !== m.total ? 1 : 0);
  }

  console.log('=== CORE, as sw.js names it and as the disk answers ===');
  console.log(pad('CORE entry', 26) + pad('file on disk', 26) + lpad('bytes', 10));
  console.log('-'.repeat(62));
  for (const r of m.rows) {
    console.log(pad(r.url, 26) + pad(r.file === null ? '(unmappable)' : r.file, 26)
      + lpad(r.exists ? r.bytes : 'ABSENT', 10));
  }
  console.log('-'.repeat(62));
  console.log(pad('TOTAL', 52) + lpad(m.total, 10));
  console.log('');

  if (m.missing.length) {
    console.error('core-bytes: CORE names ' + m.missing.map((r) => r.url).join(', ')
      + ', which is not on disk. The sum below is missing those files, so it must not be written.');
    process.exit(1);
  }

  console.log('declared in ' + SW_FILE + ':  ' + (m.declared === null ? '(none)' : m.declared));
  console.log('measured on disk:   ' + m.total);

  if (m.declared === m.total) {
    console.log('MATCH — CORE_BYTES is true of the files it describes.');
    process.exit(0);
  }

  if (!write) {
    console.error('DRIFT — CORE_BYTES is ' + m.declared + ' and CORE weighs ' + m.total
      + ' (' + (m.total - m.declared > 0 ? '+' : '') + (m.total - m.declared) + ').');
    console.error('Run `node tools/core-bytes.cjs --write` and re-cut the sw.js seal in the SAME commit.');
    process.exit(1);
  }

  const swPath = path.join(REPO, SW_FILE);
  const before = fs.readFileSync(swPath, 'utf8');
  const after = before.replace(/(CORE_BYTES\s*=\s*)(\d+)/, '$1' + m.total);
  if (after === before) {
    console.error('core-bytes: --write changed nothing. Refusing to report a repair that did not happen.');
    process.exit(1);
  }
  fs.writeFileSync(swPath, after);
  console.log('WROTE  CORE_BYTES  ' + m.declared + ' -> ' + m.total);
  console.log('Re-cut the sw.js digest in quest-bank-integrity-guard.cjs in THIS commit, or');
  console.log('bankintegrity will fail with "sw.js MOVED" instead of with anything useful.');
  process.exit(0);
}

module.exports = { measure, parseCore, declaredCoreBytes, fileFor, URL_TO_FILE };

if (require.main === module) main();
