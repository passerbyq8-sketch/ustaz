'use strict';
// D20 / OTA-11: the optional question belongs after entry/sign-in, once only.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict'), React = require('react');
const BB = require('../tools/babel-block.cjs'), root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.jsx'), 'utf8');
const begin = src.lastIndexOf('{ez110.id', src.indexOf('<Ez110GenderCard onPick='));
const jsx = src.slice(begin + 1, src.indexOf(') : null}', begin) + 8);
const block = BB.readBabelBlock({file: path.join(root, 'index.html')});
function verify(expression) {
  const code = BB.transformBabelBlock({...block, raw:'globalThis.card = (' + expression + ');'}, {filename:'gender.jsx', configFile:false, babelrc:false});
  function fixture(overrides = {}) {
    let asked = false, saved = [], tick = 0;
    const profile = {name:'Test', birthYear:1996, age:30, gender:null};
    const scope = {React, ez110:{id:'b'}, messages:[], streamingText:null, ez110FirstTick:0, profile,
      ez110GenderWritable:()=>true, ez110GenderAsked:()=>asked, EZ110_ENTRY_RUN:false,
      ez110SignedInThisRun:()=>false, Ez110GenderCard:()=>null,
      ez110MarkGenderAsked:()=>{asked=true;}, ez110SaveGender:g=>saved.push(g), setEz110FirstTick:f=>{tick=f(tick);}, ...overrides};
    const render = () => { vm.runInNewContext(code, scope); return scope.card; };
    return {render, scope, get asked(){return asked;}, get saved(){return saved;}, get tick(){return tick;}, profile};
  }
  for (const override of [{EZ110_ENTRY_RUN:true}, {ez110SignedInThisRun:()=>true}, {profile:{gender:'male'}}, {messages:[{}]}, {streamingText:''}, {ez110GenderWritable:()=>false}]) assert.equal(fixture(override).render(), null);
  for (const choice of [null, 'male', 'female']) {
    const f = fixture(), before = JSON.stringify(f.profile), card = f.render();
    assert(React.isValidElement(card), 'second eligible opening offers optional question');
    card.props.onPick(choice);
    assert(f.asked, 'choice or Later marks asked');
    assert.equal(f.tick,1,'dismisses in this render');
    assert.deepEqual(f.saved, choice ? [choice] : [], 'Later does not write a gender');
    assert.equal(JSON.stringify(f.profile),before,'name, year and age are not rewritten by the card');
    assert.equal(f.render(),null,'no repeat after selection or deferral');
  }
}
const mutant = jsx.replace('!EZ110_ENTRY_RUN', 'true');
if (process.argv.includes('--mutant')) verify(mutant);
else {verify(jsx); assert.notEqual(mutant,jsx); assert.throws(()=>verify(mutant)); assert(src.includes('data-ez110-gender="later" onClick={() => onPick(null)}')); console.log('PASS D20: six suppressed states, second opening, both answers and optional Later, immediate/once-only dismissal; entry mutation rejected.');}
