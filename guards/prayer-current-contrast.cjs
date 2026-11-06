'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const { ID } = require('../tools/ez110/tokens.cjs');
function verify(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selector = 'html[data-ez110][data-theme="dark"] .ez110-prow.is-now';
  const rules = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const row = rules.find(m => m[1].trim() === selector);
  assert(row, 'dark current prayer row override');
  assert(/background:\s*var\(--vt-soft\)/.test(row[2]), 'current row uses dark soft background');
  assert(/color:\s*var\(--vt-ink\)/.test(row[2]), 'current row uses paired ink');
  const lum = hex => hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
  for (const [id, tokens] of Object.entries(ID)) {
    const a=lum(tokens.dark.soft), b=lum(tokens.dark.ink);
    assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5, id+' dark current row contrast');
  }
}
const css=fs.readFileSync(path.join(root,'ez110/ez110.css'),'utf8');
verify(css);
assert.throws(() => verify(css.replace(/html\[data-ez110\]\[data-theme="dark"\] \.ez110-prow\.is-now\s*\{[^}]+\}/g,'')), /dark current prayer row override/, 'removing the fix must fail');
console.log('PASS prayer current row palette contrast and removal mutation');
