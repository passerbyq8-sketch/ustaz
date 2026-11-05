'use strict';
// D17: execute the pre-React catcher, without assuming that app.js can boot.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const match=html.match(/<script id="ezik-diagnostic-catcher">([\s\S]*?)<\/script>/);assert(match);
const langs=['ar','en','fa','fr','id','ur','bn','tr','ha','ms','sw','ru','zh','es','pt','de','hi','so','ps','ku','uz','am','ta','om'];
function wordsMatchDictionaries(){
 const app=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
 const ast=require('@babel/parser').parse(app,{sourceType:'script',plugins:['jsx']});
 const decl=ast.program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(d=>d.id.name==='EZ_I18N');
 assert(decl);const dicts=vm.runInNewContext('('+app.slice(decl.init.start,decl.init.end)+')');
 const table=JSON.parse(match[1].match(/var diagnosticWords = (\{[^\n]+\});/)[1]);
 assert.deepEqual(Object.keys(table),langs);
 for(const lang of langs){const d=dicts[lang]||JSON.parse(fs.readFileSync(path.join(root,'lang',lang+'.json'),'utf8'));assert.deepEqual(table[lang].slice(1),['errors.generic','panel.details','common.copy','common.retry'].map(k=>d[k]),lang+' matches existing translations');}
}
function verify(source){
 for(const lang of langs){
  const {document}=parseHTML('<!doctype html><html><body><main>Usable app</main></body></html>');
  document.documentElement.setAttribute('lang',lang);
  const bus={},copies=[];let reload=0;
  const w={document,localStorage:{getItem:()=>{throw Error('catcher must use the already initialized document language');}},navigator:{userAgent:'fixture',clipboard:{writeText:t=>{copies.push(t);return Promise.resolve();}}},location:{reload:()=>{reload++;}},addEventListener:(t,f)=>{bus[t]=f;}};w.window=w;
  vm.runInNewContext(source,w);
  for(const tag of ['script','link','img','audio'])bus.error({target:document.createElement(tag)});
  assert.equal(document.querySelectorAll('[role="alert"]').length,0,'resource failures remain record-only');
  bus.error({target:w,message:'Fixture private stack',filename:'app.js',error:new Error('Fixture private stack')});
  const panel=document.querySelector('[data-ezik-diagnostic]');assert(panel,'reader recovery surface');
  assert.equal(panel.getAttribute('dir'),['ar','fa','ur','ps','ku'].includes(lang)?'rtl':'ltr');
  const details=panel.querySelector('[data-diag-details]'),toggle=panel.querySelector('[data-diag-toggle]');
  assert(details.hidden,'details hidden initially');assert.equal(toggle.getAttribute('aria-expanded'),'false');
  const message=panel.querySelector('[data-diag-message]').textContent;
  assert(message && !message.includes('Fixture private stack'),'short localized reader message');
  assert(!panel.style.cssText.includes('inset:0'),'not a fullscreen blocking overlay');
  assert.equal(panel.querySelectorAll('button').length,3);
  toggle.onclick();assert.equal(details.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
  panel.querySelector('[data-diag-copy]').onclick();assert(copies[0].includes('Fixture private stack'),'details remain copyable');
  toggle.onclick();assert(details.hidden);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  panel.querySelector('[data-diag-reload]').onclick();assert.equal(reload,1);
  bus.unhandledrejection({target:w,reason:new Error('Later rejection')});
  for(let n=0;n<30;n++)bus.error({target:w,message:'bounded '+n});
  assert.equal(w.__ezikDiag.count(),20,'capture remains bounded');assert.equal(document.querySelectorAll('[role="alert"]').length,1);
  assert(w.__ezikDiag.text().includes('Fixture private stack'),'earliest errors retained');
 }
}
const mutant=match[1].replace('details.hidden = true;', 'details.hidden = false;');
if(process.argv.includes('--mutant'))verify(mutant);
else{verify(match[1]);wordsMatchDictionaries();assert.notEqual(mutant,match[1]);assert.throws(()=>verify(mutant));console.log('PASS D17: 24 languages; pre-React resource/thrown/rejected errors; collapsed details, copy, retry and bounded capture; exposed-details mutation rejected.');}
