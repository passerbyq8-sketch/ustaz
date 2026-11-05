'use strict';
// Item 4 / D2: title above the selected ayah; the published body/filter remains byte-identical.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),{parseHTML}=require('linkedom'),parser=require('@babel/parser');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.jsx'),'utf8'),lab=fs.readFileSync(path.join(root,'mushaf-lab/app.js'),'utf8'),i18n=fs.readFileSync(path.join(root,'mushaf-lab/lab-i18n.js'),'utf8');
const nodes=parser.parse(app,{sourceType:'script',plugins:['jsx']}).program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]);
const val=name=>{const d=nodes.find(d=>d.id.name===name);assert(d);return vm.runInNewContext('('+app.slice(d.init.start,d.init.end)+')');};
const langs=val('EZ_LANGUAGE_TABLE'),dicts=val('EZ_I18N'),key='mushaf.waqfatTitle';
const start=lab.indexOf('  function renderAyahTab('),end=lab.indexOf('  function handleTabAction(',start);assert(start>=0&&end>start);const render=lab.slice(start,end);
const cut=i18n.indexOf("  var code = 'ar';");assert(cut>0);const lookup=i18n.slice(0,cut)+'})();';
function verify(renderer){for(const l of langs){
 const dict=dicts[l.code]||JSON.parse(fs.readFileSync(path.join(root,'lang',l.code+'.json'),'utf8'));assert(typeof dict[key]==='string'&&dict[key]&&!dict[key].includes('??'),l.code+' title key');
 const {document}=parseHTML('<html><body><div id="atBody"></div></body></html>'),calls=[];
 const scope={window:{},localStorage:{getItem:()=>l.code},document,$:id=>document.getElementById(id),META:{tafsirs:[{id:'source-id',kind:'waqfat',name:'Source book'}]},reflections:()=>[],isFav:()=>false,TAFSIR_BASES:['fixture'],esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),fillText:(...args)=>{calls.push(args);document.getElementById(args[0]).textContent='Selected ayah body';}};
 vm.runInNewContext(lookup,scope);vm.runInNewContext(renderer+'\nrenderAyahTab("2:255", "waqfat");',scope);
 const title=document.querySelector('[data-ezik-waqfat-title]'),body=document.getElementById('tf_w');assert(title,l.code+' heading renders');assert.equal(title.textContent,dict[key]);assert.equal(title.tagName,'H3');assert.equal(title.getAttribute('dir'),'auto');
 const nodes=Array.from(document.getElementById('atBody').querySelectorAll('*'));assert(nodes.indexOf(title)<nodes.indexOf(body),'title comes before body');assert.equal(body.textContent,'Selected ayah body');
 assert.deepEqual(calls.map(a=>[a[0],a[2],a[3],a[4],a[5]]),[['tf_w','source-id','2:255',true,true]],'same selected-ayah body request');
}}
const mutant=render.replace('data-ezik-waqfat-title','data-deleted-title');
if(process.argv.includes('--mutant'))verify(mutant);
else{verify(render);assert.notEqual(mutant,render);assert.throws(()=>verify(mutant));
 const protectedBody=lab.slice(lab.indexOf('  const WAQF_HEADS ='),lab.indexOf('  function showTrans('));
 assert.equal(crypto.createHash('sha256').update(protectedBody).digest('hex'),'8ff1b136a71ff6428431d23c7901a50f404ec32507080ab28f080a2c1c99bdbe','selected-ayah filtering, fetch and text rendering unchanged');
 assert.equal(dicts.ar[key],'\u0648\u0642\u0641\u0627\u062a');console.log('PASS item 4: actual lab title above selected ayah in all 24 languages including Oromo; dictionaries agree; body/filter hash unchanged; missing-title mutation rejected.');}
