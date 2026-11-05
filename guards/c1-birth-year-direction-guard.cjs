'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),BB=require('../tools/babel-block.cjs');
const source=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const block=BB.readBabelBlock({file:path.join(root,'index.html')});
const input=source.match(/<input value=\{pfYear\}[\s\S]*?\/>/);assert(input,'actual birth-year input');
const welcome=source.match(/welcomeInput: (\{[^\n]+\}),/);assert(welcome,'actual shared input style');
const style=vm.runInNewContext('('+welcome[1]+')');
const codes=['ar','en','fr','ur','id','tr','ha','ms','sw','ru','zh','es','pt','de','hi','so','uz','am','ta','om','fa','ps','ku','bn'];
const dir=Object.fromEntries(codes.map(c=>[c,['ar','fa','ur','ps','ku'].includes(c)?'rtl':'ltr']));
function render(text,lang){let value='';const scope={React:{createElement:(type,props)=>({type,props})},s:{welcomeInput:style},EZ_LANG:lang,EZ_LANG_DIR:dir,pfYear:'1996',ezT:k=>k,setPfYear:v=>{value=v;},setPfMsg:()=>{}};
 vm.runInNewContext(BB.transformBabelBlock({...block,raw:'globalThis.input = ('+text+');'},{filename:'birth-year-fixture.jsx',configFile:false,babelrc:false}),scope);
 return {element:scope.input,changed:()=>value};}
function check(text){for(const lang of codes){const r=render(text,lang),p=r.element.props;assert.equal(r.element.type,'input');assert.equal(p.style.direction,dir[lang],lang+' direction');assert.equal(p.value,'1996');assert.equal(p.inputMode,'numeric');assert.equal(p.pattern,'[0-9]*');assert.equal(p.maxLength,4);p.onChange({target:{value:'2000'}});assert.equal(r.changed(),'2000');}}
check(input[0]);
const mutant=input[0].replace(/style=\{EZ_LANG_DIR\[EZ_LANG\] === 'ltr' \? \{ \.\.\.s.welcomeInput, direction: 'ltr' \} : s.welcomeInput\}/,'style={s.welcomeInput}');
assert.notEqual(mutant,input[0],'direction mutant applied');assert.throws(()=>check(mutant));
console.log('D11 PASS: actual input rendered in all 24 interface directions; input behavior retained; forced-RTL mutant rejected.');
