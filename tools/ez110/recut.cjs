// ITEM 110 -- re-cut the bank guard's pins after app.js changes size (order of E-guards §7):
//   1. the app.js size in sw.js's CORE prose table and in the guard's SW_PROSE mirror
//   2. node tools/core-bytes.cjs --write (CORE_BYTES)
//   3. a dated line in the guard's seal history
//   4. LAST: SEALED['sw.js'] = sha256(sw.js) at CR = 0
// usage: node tools/ez110/recut.cjs "<why, one line ASCII>"
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const P = (f) => path.join(ROOT, f);
const why = (process.argv[2] || 'item 110 rebuild').replace(/[^\x20-\x7e]/g, '?');
const appBytes = fs.statSync(P('app.js')).size;
const idxBytes = fs.statSync(P('index.html')).size;
let sw = fs.readFileSync(P('sw.js'), 'utf8');
let g = fs.readFileSync(P('quest-bank-integrity-guard.cjs'), 'utf8');
const mApp = sw.match(/\+ app\.js (\d+) \+/); if (!mApp) throw new Error('sw.js table line not found');
const mIdx = sw.match(/\(index\.html\) (\d+) \+/); if (!mIdx) throw new Error('sw.js index line not found');
const oldApp = Number(mApp[1]), oldIdx = Number(mIdx[1]);
sw = sw.replace(`+ app.js ${oldApp} +`, `+ app.js ${appBytes} +`).replace(`(index.html) ${oldIdx} +`, `(index.html) ${idxBytes} +`);
const gApp = `{ n: ${oldApp}, of: 'app.js' }`, gIdx = `{ n: ${oldIdx}, of: 'index.html' }`;
if (g.split(gApp).length !== 2) throw new Error('guard app.js mirror not found once');
g = g.replace(gApp, `{ n: ${appBytes}, of: 'app.js' }`);
if (oldIdx !== idxBytes) { if (g.split(gIdx).length !== 2) throw new Error('guard index mirror'); g = g.replace(gIdx, `{ n: ${idxBytes}, of: 'index.html' }`); }
fs.writeFileSync(P('sw.js'), sw);
cp.execFileSync(process.execPath, [P('tools/core-bytes.cjs'), '--write'], { cwd: ROOT, stdio: 'pipe' });
sw = fs.readFileSync(P('sw.js'));
const cr = sw.filter((b) => b === 13).length; if (cr) throw new Error('sw.js has CR ' + cr);
const core = (sw.toString().match(/const CORE_BYTES = (\d+);/) || [])[1];
const appSha = crypto.createHash('sha256').update(fs.readFileSync(P('app.js'))).digest('hex');
const day = '2026-10-10';
const hist = `  //   ${day} -- ITEM 110 (${why}): app.js ${oldApp} -> ${appBytes} bytes, sha256 ${appSha.slice(0, 8)}..${appSha.slice(-4)}; index.html ${idxBytes}.\n//                    node tools/core-bytes.cjs --write: CORE_BYTES ${core}. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js ${sw.length} bytes).\n`;
const sealRe = /  'sw\.js': '[0-9a-f]{64}',\n\};/;
if (!sealRe.test(g)) throw new Error('seal line not found');
const swSha = crypto.createHash('sha256').update(sw).digest('hex');
g = g.replace(sealRe, hist + `  'sw.js': '${swSha}',\n};`);
fs.writeFileSync(P('quest-bank-integrity-guard.cjs'), g);
console.log(`RECUT app.js ${oldApp}->${appBytes} index ${oldIdx}->${idxBytes} CORE_BYTES=${core} seal=${swSha.slice(0, 8)}`);
