// WCAG 2.x contrast for every pair in tokens110 PAIRS, each identity, each mode. Writes markdown.
// usage: node contrast.cjs [out.md]   exit 1 if any pair fails its threshold.
'use strict';
const fs = require('fs');
const { ID, PAIRS } = require('./tokens.cjs');
function lum(hex) {
  const h = hex.replace('#', ''); const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const l = c.map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const rows = []; let fails = 0;
for (const id of Object.keys(ID)) for (const mode of ['light', 'dark']) {
  const T = ID[id][mode];
  for (const [fg, bg, kind] of PAIRS) {
    if (!/^#[0-9A-F]{6}$/i.test(T[fg] || '') || !/^#[0-9A-F]{6}$/i.test(T[bg] || '')) continue;
    const r = ratio(T[fg], T[bg]); const need = kind === 'text' ? 4.5 : 3;
    const ok = r >= need; if (!ok) fails++;
    rows.push(`| ${id} | ${mode} | ${fg} ${T[fg]} | ${bg} ${T[bg]} | ${kind} | ${r.toFixed(2)} | ${need} | ${ok ? 'PASS' : 'FAIL'} |`);
  }
}
const md = '| id | mode | fg | bg | kind | ratio | need | verdict |\n|---|---|---|---|---|---|---|---|\n' + rows.join('\n') + '\n';
if (process.argv[2]) fs.writeFileSync(process.argv[2], md);
console.log('pairs=' + rows.length + ' fails=' + fails);
rows.filter(r => /FAIL/.test(r)).forEach(r => console.log(r));
process.exit(fails ? 1 : 0);
