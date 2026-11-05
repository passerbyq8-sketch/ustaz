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
const ast = require('@babel/parser').parse(source, {sourceType:'script', plugins:['jsx']});
const decl = ast.program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(d=>d.id.name==='EZ_I18N');
const dicts = vm.runInNewContext('(' + source.slice(decl.init.start,decl.init.end) + ')');
const langs = ['ar','en','fa','fr','id','ur','bn','tr','ha','ms','sw','ru','zh','es','pt','de','hi','so','ps','ku','uz','am','ta','om'];
for(const lang of langs)if(!dicts[lang])dicts[lang]=JSON.parse(fs.readFileSync(path.join(root,'lang',lang+'.json'),'utf8'));
function verify(renderSource) {
  const code = BB.transformBabelBlock({ ...block, raw: 'globalThis.button = (' + renderSource + ');' }, { filename: 'wird.jsx', configFile: false, babelrc: false });
  function text(nodes) { let out = ''; React.Children.forEach(nodes, n => { out += React.isValidElement(n) ? text(n.props.children) : n == null ? '' : String(n); }); return out; }
  for (const lang of langs) for (const wirdTarget of [0, 4]) for (const wirdDone of [0, 2, 17]) {
    let picker = false;
    const scope = { React, s: {}, wirdTarget, wirdDone, wirdPct: Math.min(100, Math.round(wirdDone / (wirdTarget || 1) * 100)), toArabicDigits: n => String(n).replace(/[0-9]/g, d => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'[d]), setPicker: v => { picker = v; } };
    scope.ezT = key => dicts[lang][key];
    const prompt = scope.ezT('x.643').replace(/^[\s\u00b7]+/, '');
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
const mutant = jsx.replace("{ezT('x.643')", "{toArabicDigits(wirdDone) + ezT('x.643')");
if (process.argv.includes('--mutant')) verify(mutant);
else { verify(jsx); assert.notEqual(mutant, jsx); assert.throws(() => verify(mutant)); console.log('PASS D19: 24 localized actions; zero/nonzero progress without a target shows only the action; explicit target and picker preserved; count mutation rejected.'); }
