'use strict';
// THE APP.JS BYTE PIN LIVES IN THREE PLACES, and a build that moves the bundle
// leaves all three stating the old number -- which is exactly what B12 and B14
// of quest-bank-integrity-guard.cjs exist to catch. This re-cuts all three from
// the file on disk and refuses to write if it cannot find each one exactly once.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/Users/passe/projects/ustaz-fix88';

const appBytes = fs.statSync(path.join(REPO, 'app.js')).size;

function edit(file, find, replace, label) {
  const p = path.join(REPO, file);
  const s = fs.readFileSync(p, 'utf8');
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error(label + ': anchor found ' + c + ' times in ' + file);
  const out = s.replace(find, replace);
  if (out === s) throw new Error(label + ': nothing changed');
  fs.writeFileSync(p, out, 'utf8');
  return true;
}

function currentPin() {
  const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
  const m = /\+ app\.js (\d+) \+/.exec(sw);
  if (!m) throw new Error('cannot read the current app.js pin out of sw.js prose');
  return parseInt(m[1], 10);
}
function currentCore() {
  const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
  const m = /^const CORE_BYTES = (\d+);$/m.exec(sw);
  if (!m) throw new Error('cannot read CORE_BYTES out of sw.js');
  return parseInt(m[1], 10);
}

const oldPin = currentPin();
const oldCore = currentCore();
if (oldPin === appBytes) {
  console.log('already pinned at ' + appBytes + ' -- nothing to do');
  process.exit(0);
}
const delta = appBytes - oldPin;
const newCore = oldCore + delta;

edit('sw.js', '+ app.js ' + oldPin + ' +', '+ app.js ' + appBytes + ' +', 'sw prose');
edit('sw.js', 'const CORE_BYTES = ' + oldCore + ';', 'const CORE_BYTES = ' + newCore + ';', 'CORE_BYTES');
edit('quest-bank-integrity-guard.cjs',
  '{ n: ' + oldPin + ", of: 'app.js' },", '{ n: ' + appBytes + ", of: 'app.js' },", 'guard mirror');

console.log('app.js ' + oldPin + ' -> ' + appBytes + ' (' + (delta >= 0 ? '+' : '') + delta + ')');
console.log('CORE_BYTES ' + oldCore + ' -> ' + newCore);
