'use strict';
// D19 / OTA-8: no-target UI is an action, independent of stored reading progress.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict'), React = require('react');
const BB = require('../tools/babel-block.cjs');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.jsx'), 'utf8');
const block = BB.readBabelBlock({ file: path.join(root, 'index.html') });
const start = source.indexOf('<button onClick={() => setPicker(true)}');
const jsx = source.slice(start, source.indexOf('</button>', start) + 9);
assert(start >= 0 && jsx.includes('wirdTarget'));
const prompt = '\u062d\u062f\u0651\u062f \u0648\u0631\u062f\u0643';
function verify(renderSource) {
  const code = BB.transformBabelBlock({ ...block, raw: 'globalThis.button = (' + renderSource + ');' }, { filename: 'wird.jsx', configFile: false, babelrc: false });
  function text(nodes) { let out = ''; React.Children.forEach(nodes, n => { out += React.isValidElement(n) ? text(n.props.children) : n == null ? '' : String(n); }); return out; }
  for (const wirdTarget of [0, 4]) for (const wirdDone of [0, 2, 17]) {
    let picker = false;
    const scope = { React, s: {}, wirdTarget, wirdDone, wirdPct: Math.min(100, Math.round(wirdDone / (wirdTarget || 1) * 100)), toArabicDigits: n => String(n).replace(/[0-9]/g, d => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'[d]), setPicker: v => { picker = v; } };
    vm.runInNewContext(code, scope);
    const label = text(scope.button);
    if (!wirdTarget) assert.equal(label, prompt, 'no-target action contains no progress count');
    else { assert(label.includes(scope.toArabicDigits(wirdDone) + ' / ' + scope.toArabicDigits(wirdTarget))); assert(!label.includes(prompt)); }
    scope.button.props.onClick();
    assert.equal(picker, true, 'same target picker action');
    assert.equal(scope.wirdDone, wirdDone, 'render leaves reading progress untouched');
    assert.equal(scope.wirdTarget, wirdTarget, 'render leaves target untouched');
  }
}
const mutant = jsx.replace(prompt, '\u0627\u0644\u064a\u0648\u0645 {toArabicDigits(wirdDone)} \u00b7 ' + prompt);
if (process.argv.includes('--mutant')) verify(mutant);
else { verify(jsx); assert.notEqual(mutant, jsx); assert.throws(() => verify(mutant)); console.log('PASS D19: zero/nonzero progress without a target shows only the action; explicit target and picker preserved; count mutation rejected.'); }
