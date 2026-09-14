'use strict';
// The Arabic dictionary read out of ONE tree's app.jsx. No Arabic is typed in the rig.
const fs = require('fs');

function dictOf(appjsxPath) {
  const src = fs.readFileSync(appjsxPath, 'utf8');
  const at = src.indexOf('const EZ_I18N = {');
  if (at < 0) throw new Error('EZ_I18N not found');
  const open = src.indexOf('{', at);
  let depth = 0, i = open, inS = null, esc = false;
  const BS = String.fromCharCode(92);
  for (; i < src.length; i++) {
    const c = src[i];
    if (inS) {
      if (esc) { esc = false; continue; }
      if (c === BS) { esc = true; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; }
  }
  // eslint-disable-next-line no-eval
  const obj = eval('(' + src.slice(open, i + 1) + ')');
  const lit = {};
  const re = /const\s+(EZ_AIC_AGREE|EZ_AIC_DECLINE)\s*=\s*(['"])([\s\S]*?)\2/g;
  let m;
  while ((m = re.exec(src))) lit[m[1]] = m[3];
  return { ar: obj.ar, en: obj.en, lit: lit };
}

// Reverse lookup: which dictionary keys appear inside a run of live text.
function keysIn(ar, text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const out = [];
  for (const k of Object.keys(ar)) {
    const v = String(ar[k] || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 4 && t.indexOf(v) >= 0) out.push(k);
  }
  return out;
}

module.exports = { dictOf, keysIn };
