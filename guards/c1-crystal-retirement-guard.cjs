'use strict';
// UI-1: retire the Crystal choice, retaining the shared digit face for active identities.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const config=src.match(/const EZ110_PARTS = [^\n]+;/)[0];
const code=src.slice(src.indexOf('function ez110PartLit('),src.indexOf('function ez110SafeLit('));
function verify(conf){for(const owner of [false,true])for(const saved of ['e','b','c','d','']){
 const f=vm.runInNewContext(conf+'\n'+code+'\n({choices:ez110Choosable(),selected:ez110ReadIdentity()})',{EZ110_OWNER:owner,EZ110_OVERRIDE:null,EZ110_IDS:['b','c','d','e'],EZ110_IDENTITY_KEY:'identity',localStorage:{getItem:()=>saved}});
 assert.deepEqual(Array.from(f.choices),['b','c','d']);assert.equal(f.selected,['b','c','d'].includes(saved)?saved:'b','retired saved choice falls back');
}}
const mutant=config.replace("e: 'off'","e: 'owner'");
if(process.argv.includes('--mutant'))verify(mutant);
else{verify(config);assert.notEqual(mutant,config);assert.throws(()=>verify(mutant));
 const css=fs.readFileSync(path.join(root,'ez110/ez110.css'),'utf8');assert(/font-family:\s*'Ezik Digits'/.test(css));assert(css.includes('unicode-range: U+0660-0669, U+06F0-06F9;'));
 for(const id of ['b','c','d']){const line=css.split('\n').find(l=>l.startsWith('html:root[data-ez110="'+id+'"]'));assert(line&&line.includes("--ez110-font-ui:'Ezik Digits'"));}
 console.log('PASS UI-1: Crystal unavailable for guests/owner and saved selection falls back; active identities retain shared digit face; re-enable mutation rejected.');}
