'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {runIapLua}=require('./iap-receipt-lua-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function feedback(mutate=s=>s, fault=false) {
 const data=new Map(), lists=new Map(), context=vm.createContext({process:{env:{}},Buffer,console:{warn(){},error(){}},Date});
 const store=(cmd,key,value,a)=>{
  if(cmd==='GET')return data.get(key)??null;
  if(cmd==='TYPE')return {ok:lists.has(key)?'list':data.has(key)?'string':'none'};
  if(cmd==='SET'){data.set(key,String(value));return 'OK';}
  if(cmd==='INCR'){const n=Number(data.get(key)||0)+1;data.set(key,n);return n;}
  if(cmd==='EXPIRE')return 1;
  if(cmd==='LPUSH'){if(fault)throw Error('synthetic storage failure');const l=lists.get(key)||[];l.unshift(value);lists.set(key,l);return l.length;}
  if(cmd==='LTRIM'){lists.set(key,(lists.get(key)||[]).slice(Number(value),Number(a)+1));return 'OK';}
  throw Error('unexpected Redis command '+cmd);
 };
 const redis={get:async k=>store('GET',k),incr:async k=>store('INCR',k),expire:async()=>1,lpush:async(k,v)=>store('LPUSH',k,v),ltrim:async(k,a,b)=>store('LTRIM',k,a,b),eval:async(s,k,a)=>runIapLua(mutate(s),k,a,store)};
 const fake=values=>new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});
 const route=new vm.SourceTextModule(fs.readFileSync(root+'/api/feedback.js','utf8'),{context});
 await route.link(async spec=>{
  if(spec.endsWith('/feedback-intake.js')){const m=new vm.SourceTextModule(fs.readFileSync(root+'/lib/feedback-intake.js','utf8'),{context});await m.link(()=>{throw Error('unexpected import');});return m;}
  if(spec==='node:crypto')return fake({default:crypto});
  if(spec==='@upstash/redis')return fake({Redis:class {constructor(){return redis;}}});
  if(spec.endsWith('/ratelimit.js'))return fake({applyCorsOrigin(){}});
  if(spec.endsWith('/daycap.js'))return fake({DEVICE_HEADER:'x-device',DAY_CAP_TTL_SECONDS:172800,kuwaitDayStamp:()=> '20261105',safeId:v=>v||''});
  if(spec.endsWith('/account.js'))return fake({sessionState:async()=>({state:'live',record:{accountKey:'account-synthetic'}})});
  if(spec.endsWith('.json'))return fake({default:{app_version:'test'}});
  throw Error('unexpected import '+spec);
 });await route.evaluate();
 const call=async()=>{const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};await route.namespace.default({method:'POST',headers:{'x-device':'device-synthetic'},body:{type:'suggestion',text:'synthetic message',session:'synthetic'}},res);return res;};
 return {call,data,lists};
}
test('SEC-039 concurrent feedback cannot exceed either daily cap',async()=>{
 const h=await feedback(),results=await Promise.all(Array.from({length:100},()=>h.call()));
 assert.equal(results.filter(r=>r.code===200).length,3);
 assert.equal(results.filter(r=>r.code===429).length,97);
 assert.equal(h.lists.get('feedback').length,3);
 for(const n of h.data.values())assert.equal(Number(n),3);
});
test('SEC-039 failed save is never reported as success or charged',async()=>{
 const h=await feedback(s=>s,true),r=await h.call();assert.equal(r.code,503);assert.equal(h.lists.size,0);assert.equal(h.data.size,0);
});
test('SEC-039 cap-removal mutation is detected by concurrent requests',async()=>{
 const h=await feedback(s=>s.replace('if device >= tonumber(ARGV[2]) or account >= tonumber(ARGV[3]) then return 0 end',''));
 const results=await Promise.all(Array.from({length:8},()=>h.call()));
 assert.equal(results.filter(r=>r.code===200).length,8,'mutation must actually remove admission');
 assert.throws(()=>assert.equal(h.lists.get('feedback').length,3));
});
