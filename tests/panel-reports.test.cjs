'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {runIapLua}=require('./iap-receipt-lua-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function setup(full=false,mutate=s=>s,fault=false){
 const lists=new Map([['reports',full?Array.from({length:5000},(_,i)=>'genuine-'+i):['genuine-0']]]),data=new Map();
 const call=(cmd,k,v,a)=>{if(fault)throw Error('synthetic failure');
  if(cmd==='GET')return data.get(k)??null;
  if(cmd==='SET'){data.set(k,v);return 'OK';}
  if(cmd==='LLEN')return (lists.get(k)||[]).length;
  if(cmd==='LPUSH'){const l=lists.get(k)||[];l.unshift(v);lists.set(k,l);return l.length;}
  if(cmd==='LTRIM'){lists.set(k,(lists.get(k)||[]).slice(Number(v),Number(a)+1));return 'OK';}
  if(cmd==='EXPIRE')return 1;throw Error(cmd);
 };
 const redis={lpush:async(k,v)=>call('LPUSH',k,v),ltrim:async(k,a,b)=>call('LTRIM',k,a,b),eval:async(s,k,a)=>runIapLua(mutate(s),k,a,call)};
 const context=vm.createContext({process:{env:{}},Buffer,Date,console:{error(){}}});
 const fake=o=>new vm.SyntheticModule(Object.keys(o),function(){for(const[k,v]of Object.entries(o))this.setExport(k,v);},{context});
 const route=new vm.SourceTextModule(fs.readFileSync(root+'/api/report.js','utf8'),{context});
 await route.link(async spec=>{
  if(spec.endsWith('/report-intake.js')){const m=new vm.SourceTextModule(fs.readFileSync(root+'/lib/report-intake.js','utf8'),{context});await m.link(()=>fake({default:crypto}));return m;}
  if(spec==='@upstash/redis')return fake({Redis:class{constructor(){return redis;}}});
  if(spec.endsWith('/ratelimit.js'))return fake({applyCorsOrigin(){},checkReportLimit:async()=>({ok:true})});
  if(spec.endsWith('/attempts.js'))return fake({clientAddress:()=> 'synthetic-origin'});
  throw Error(spec);
 });await route.evaluate();
 return {lists,async send(note='synthetic report') {const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};await route.namespace.default({method:'POST',headers:{},body:{reason:'other',note}},res);return res;}};
}
test('SEC-017 a full protected inbox preserves every genuine report and refuses overflow truthfully',async()=>{
 const h=await setup(true);assert.equal((await h.send()).code,503);assert.equal(h.lists.get('reports').length,5000);assert(h.lists.get('reports').includes('genuine-4999'));
});
test('SEC-017 duplicate floods are quarantined without evicting genuine reports',async()=>{
 const h=await setup();assert.equal((await h.send()).code,200);
 for(let i=0;i<250;i++)assert.equal((await h.send()).code,429);
 assert.equal(h.lists.get('reports').length,2);assert(h.lists.get('reports').includes('genuine-0'));
 assert.equal(h.lists.get('reports:quarantine').length,200);
 assert(!JSON.stringify(h.lists.get('reports:quarantine')).includes('synthetic report'));
});
test('SEC-017 storage faults never return success',async()=>{const h=await setup(false,s=>s,true);assert.equal((await h.send()).code,503);});
test('SEC-017 removing the capacity check breaks protected retention',async()=>{
 const h=await setup(true,s=>s.replace('if size >= tonumber(ARGV[3]) then return -1 end',''));
 assert.equal((await h.send()).code,200);assert.throws(()=>assert.equal(h.lists.get('reports').length,5000));
});
