'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runPanelLua}=require('./panel-lua-fixture.cjs');
const root=path.resolve(__dirname,'..');
// Read the actual script template, substituting only its declared numeric constant.
function script(){const s=fs.readFileSync(root+'/lib/usage.js','utf8');return s.match(/export const WRITE_USAGE_SCRIPT = `([\s\S]*?)`;/)[1].replace(/\$\{USAGE_DAILY_EVENT_CAP\}/g,'50000');}
function exercise(source,side=false){
 const intake='lg:usage:intake:20261105',data=new Map([[intake,49990]]),sets=new Map(),expiries=new Set();
 const store=(cmd,k,v)=>{
  if(cmd==='GET')return data.get(k)??null;
  if(cmd==='INCR'){const n=Number(data.get(k)||0)+1;data.set(k,n);return n;}
  if(cmd==='EXPIRE'){expiries.add(k);return 1;}
  if(cmd==='PFADD'||cmd==='SADD'){const s=sets.get(k)||new Set();s.add(v);sets.set(k,s);return 1;}
  if(cmd==='HINCRBY')return 1;
  throw Error('unexpected Redis command '+cmd);
 };
 const results=[];for(let i=0;i<100;i++)results.push(runPanelLua(source,side?['opens','hll',intake]:['opens','hll','stats','active',intake],[i.toString(16).padStart(32,'0'),34560000,691200,...(side?[]:['h:0'])],store));
 return {accepted:results.filter(n=>n>0).length,distinct:sets.get('hll').size,discarded:data.get(intake+':discarded'),expiries};
}
test('SEC-010 rotating synthetic IDs cannot grow usage storage beyond daily admission',()=>{
 for(const side of [false,true]){const r=exercise(script(),side);assert.equal(r.accepted,10);assert.equal(r.distinct,10);assert.equal(r.discarded,90);assert(r.expiries.has('lg:usage:intake:20261105:discarded'));}
});
test('SEC-010 admission-removal mutation fails the bounded-cardinality assertion',()=>{
 const original=script(),mutant=original.replace(/-- INTAKE-BOUND START[\s\S]*?-- INTAKE-BOUND END/,'');
 assert.notEqual(mutant,original);const r=exercise(mutant);assert.equal(r.accepted,100);assert.throws(()=>assert.equal(r.distinct,10));
});
