// probe-dob-06.cjs
// READ-ONLY diagnostic for Al-Murabbi Session 06 / Commit 2 (DOB option A).
// Scans index.html, counts anchors, prints context, writes probe-dob-output.txt.
// Makes NO changes to any file. Pure ASCII source. Run from the repo root.

'use strict';
const fs = require('fs');

const FILE = 'index.html';
const OUT = 'probe-dob-output.txt';
const MAXLINE = 240;

if (!fs.existsSync(FILE)) {
  console.error('ABORT: ' + FILE + ' not found. Run this from the repo root.');
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf8');
const hasCRLF = raw.indexOf('\r\n') !== -1;
const src = raw.replace(/\r\n/g, '\n');
const lines = src.split('\n');

const report = [];
function w(s) { report.push(s); }

function clip(s) {
  if (s.length <= MAXLINE) return s;
  return s.slice(0, MAXLINE) + ' ...[cut ' + (s.length - MAXLINE) + ' chars]';
}

const SPECS = [
  // [title, regex, contextLines, maxShownMatches]
  ['function Onboarding', /function\s+Onboarding\b/, 2, 3],
  ['function AdultGate (commit-1 sanity)', /function\s+AdultGate\b/, 1, 3],
  ['requestStart (commit-1 funnel)', /requestStart/, 2, 12],
  ['adultAgeValid (commit-1 anchor)', /adultAgeValid/, 1, 6],
  ['onStart= (prop wiring / App handler)', /onStart\s*=/, 8, 6],
  ['onStart( calls', /onStart\s*\(/, 2, 12],
  ['child_profile', /child_profile/, 5, 15],
  ['localStorage', /localStorage/, 2, 25],
  ['JSON.parse (load sites)', /JSON\.parse/, 2, 15],
  ['setProfile (state setter)', /setProfile/, 3, 12],
  ['deriveCaps', /deriveCaps/, 4, 12],
  ['buildSystemPrompt', /buildSystemPrompt/, 3, 10],
  ['ageNum (inside prompt builder)', /ageNum/, 2, 15],
  ['age: property writes', /\bage\s*:/, 2, 25],
  ['.age property reads', /\.age\b/, 1, 40],
  ['birthYear (expect 0 before patch)', /birthYear/, 2, 10],
  ['getFullYear (existing uses)', /getFullYear/, 1, 10]
];

function scan(rx) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (rx.test(lines[i])) hits.push(i);
  }
  return hits;
}

w('PROBE dob-06 (read-only)  date: ' + new Date().toISOString());
w('file: ' + FILE + '  bytes: ' + Buffer.byteLength(raw, 'utf8') +
  '  lines: ' + lines.length + '  contains-CRLF: ' + hasCRLF);
w('');

const counts = [];
const results = [];
for (const spec of SPECS) {
  const hits = scan(spec[1]);
  counts.push([spec[0], hits.length]);
  results.push([spec, hits]);
}

w('=== COUNTS ===');
for (const c of counts) w('  ' + String(c[1]).padStart(3, ' ') + '  ' + c[0]);
w('');

for (const pair of results) {
  const spec = pair[0], hits = pair[1];
  const title = spec[0], ctx = spec[2], cap = spec[3];
  w('=== ' + title + '  [' + hits.length + ' match(es)' +
    (hits.length > cap ? ', showing first ' + cap : '') + '] ===');
  for (const i of hits.slice(0, cap)) {
    const a = Math.max(0, i - ctx);
    const b = Math.min(lines.length - 1, i + ctx);
    for (let j = a; j <= b; j++) {
      w((j === i ? '>> ' : '   ') + String(j + 1).padStart(5, ' ') + '  ' + clip(lines[j]));
    }
    w('   -----');
  }
  w('');
}

fs.writeFileSync(OUT, report.join('\n'), 'utf8');

console.log('PROBE done (read-only, nothing modified).');
console.log('Counts:');
for (const c of counts) console.log('  ' + String(c[1]).padStart(3, ' ') + '  ' + c[0]);
console.log('WROTE ' + OUT + '  (' + report.length + ' report lines)');