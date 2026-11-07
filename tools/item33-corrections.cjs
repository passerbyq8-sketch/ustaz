'use strict';
// Approved item 33 corrections. Shared by the existing builders and content checks.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const record=require('./item33-corrections.json');
function at(data,keys){return keys.reduce((o,k)=>o?.[k],data);}
function apply(file,data){
 for(const p of record.patches.filter(p=>p.file===file)){
  let keys=p.path;
  // Translation source branches can order their entries differently.
  if(keys[0]==='items'&&Array.isArray(data.items)){
   const i=data.items.findIndex(i=>i.id===p.old?.id||i.id===p.new?.id);
   if(i<0&&p.remove)continue;
   assert(i>=0,file+' missing corrected entry');keys=['items',i];
  }
  const parent=at(data,keys.slice(0,-1)),key=keys.at(-1),value=parent[key];
  if(p.remove){
   if(value===undefined)continue;
   assert.deepEqual(value,p.old,file+' removal source changed');
   if(Array.isArray(parent))parent.splice(+key,1);else delete parent[key];
  }else{
   if(keys[0]==='keys'&&p.old===undefined){
    // Keep the same insertion order whether the builder or this layer re-keyed it.
    delete parent[key];parent[key]=JSON.parse(JSON.stringify(p.new));continue;
   }
   if(JSON.stringify(value)===JSON.stringify(p.new))continue;
   // The core translation builder already uses the new Arabic hash when rebuilding room keys.
   const rekey=keys[0]==='keys'&&p.old===undefined;
   if(!rekey)assert.deepEqual(value,p.old,file+' correction source changed');
   parent[key]=JSON.parse(JSON.stringify(p.new));
  }
 }
 if(file.startsWith('lang/content/')&&file.includes('/packs/')&&data.source_sha8){
  const source=path.resolve(__dirname,'..','quest-data',path.basename(file).replace(/\.json$/,'.js'));
  data.source_sha8=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0,8);
 }
 if(file==='lang/content/dima-inventory-v1.json')data.sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../dima/dima-v1.json'))).digest('hex');
 if(file.startsWith('lang/content/')&&file.endsWith('/core.json')&&data.source_sha8)data.source_sha8=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../quest-data/kunuz-bank-3147.js'))).digest('hex').slice(0,8);
 return data;
}
function assertCurrent(root){
 const get=file=>{const s=fs.readFileSync(path.join(root,file),'utf8');if(file.endsWith('.json'))return JSON.parse(s);let d;if(file.includes('3147')){const box={};vm.runInNewContext(s.replace('var DATA','this.DATA'),box);d=JSON.parse(JSON.stringify(box.DATA));}else vm.runInNewContext(s,{KZV:{register:o=>d=JSON.parse(JSON.stringify(o))}});return d;};
 for(const file of new Set(record.patches.map(p=>p.file))){const data=get(file);const before=JSON.stringify(data);assert.equal(JSON.stringify(apply(file,data)),before,file+' corrected content regressed');}
}
module.exports={apply,assertCurrent};
