'use strict';
// RE-CUT THE sw.js SEAL, and refuse to do it on a tree that is not measured at CR = 0,
// which is the rule written above the seal itself. The note is appended to the re-cut
// history newest-first, exactly where the two notes above it sit.
const fs = require('fs');
const crypto = require('crypto');
const REPO = 'C:/Users/passe/projects/ustaz-fix88/';
const G = REPO + 'quest-bank-integrity-guard.cjs';

const note = process.argv[2];
if (!note) { console.error('usage: node reseal.cjs "<the history note, one paragraph>"'); process.exit(2); }

const sw = fs.readFileSync(REPO + 'sw.js');
let cr = 0; for (const b of sw) if (b === 13) cr += 1;
if (cr !== 0) { console.error('sw.js carries ' + cr + ' CR -- the seal may only be cut at CR = 0'); process.exit(1); }
const hash = crypto.createHash('sha256').update(sw).digest('hex');

let s = fs.readFileSync(G, 'utf8');
const m = /^(\s*)'sw\.js': '([0-9a-f]{64})',$/m.exec(s);
if (!m) { console.error('cannot find the sw.js seal line'); process.exit(1); }
const old = m[2];
if (old === hash) { console.log('sw.js seal already current: ' + hash); process.exit(0); }

// The note goes ABOVE the seal line, at the head of the newest-first history.
const wrapped = note.split('\n').map((l, i) => (i === 0
  ? '  //   ' + l
  : '//                    ' + l)).join('\n');
s = s.replace(m[0], wrapped + '\n' + m[0].replace(old, hash));
fs.writeFileSync(G, s, 'utf8');
console.log('sw.js seal ' + old.slice(0, 12) + '... -> ' + hash.slice(0, 12) + '...  (bytes ' + sw.length + ', CR 0)');
