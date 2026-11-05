'use strict';
// B10: execute the real worker fetch and warm handlers against persisted responses.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('sw.js'), app=read('app.jsx'), clone=x=>JSON.parse(JSON.stringify(x));
const packPath='/dima/pack-regular-002.json',manifestPath='/dima/pack-manifest-v1.json';
const bodies=new Map([manifestPath,packPath,'/dima/pack-ramadan-001.json','/dima/pack-dhul-hijjah-001.json','/dima/pack-white-days-001.json'].map(p=>[p,read(p.slice(1))]));
const parse=p=>JSON.parse(bodies.get(p));
function worker(code,stored=new Map(),network=new Map(bodies),quota=false){
 const listeners={},calls=[],key=r=>new URL(typeof r==='string'?r:r.url,'https://fixture.test').pathname;
 const fetcher=async req=>{const p=key(req);calls.push(p);const b=network.get(p);if(b instanceof Error)throw b;return new Response(b===undefined?'other':typeof b==='string'?b:JSON.stringify(b),{status:200});};
 const cache={match:async r=>stored.has(key(r))?new Response(stored.get(key(r))):undefined,
  put:async(r,response)=>{if(quota){const e=new Error('full');e.name='QuotaExceededError';throw e;}stored.set(key(r),await response.text());},
  add:async r=>cache.put(r,await fetcher(r)),keys:async()=>[...stored.keys()].map(p=>new Request('https://fixture.test'+p))};
 const caches={open:async()=>cache,match:r=>cache.match(r),keys:async()=>['ezik-v137'],delete:async()=>{throw Error('must not delete current cache');}};
 const self={location:{origin:'https://fixture.test'},addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim:async()=>{},matchAll:async()=>[]},skipWaiting:async()=>{}};
 const scope={self,caches,fetch:fetcher,Response,Request,URL,Headers,console:{warn:()=>{},log:()=>{}},navigator:{},setTimeout:()=>0,clearTimeout:()=>{}};
 vm.runInNewContext(code,scope,{filename:'sw.js'});
 return {stored,network,calls,async get(p){let pending;const waits=[];listeners.fetch({request:new Request('https://fixture.test'+p),respondWith:v=>pending=v,waitUntil:v=>waits.push(v)});assert(pending,'worker owns Dima request');const result=await pending;await Promise.all(waits);return result;},
  async warm(){const waits=[];listeners.message({data:{ezik:'warm'},waitUntil:v=>waits.push(v)});await Promise.all(waits);},failures:self.ezikPrecacheFailures};
}
function helper(text,name){const ast=require('@babel/parser').parse(text,{sourceType:'script',plugins:['jsx']});const n=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return text.slice(n.start,n.end).replace(/\r\n/g,'\n');}
async function verify(code,mirror=true){
 if(mirror)for(const name of ['dimaObject','dimaPackValid'])assert.equal(helper(code,name),helper(app,name),'worker/app pack validation parity');
 let cases=0;
 for(const [p,body]of bodies){const w=worker(code),r=await w.get(p);assert.equal(r.status,200);assert.equal(await r.text(),body);assert.equal(w.stored.get(p),body);cases++;}
 const future=clone(parse(packPath));future.id='dima-regular-003';future.startDay=61;
 future.days=future.days.map((day,i)=>JSON.parse(JSON.stringify(day).replaceAll('dima.regular.'+String(i+31).padStart(3,'0'),'dima.regular.'+String(i+61).padStart(3,'0'))));future.days.forEach((d,i)=>d.position=i+61);
 const next='/dima/pack-regular-003.json';const fw=worker(code);fw.network.set(next,future);assert.equal((await fw.get(next)).status,200);assert(fw.stored.has(next));cases++;
 const fm=parse(manifestPath);fm.regular.push({id:future.id,version:future.version,path:next,firstDay:61,lastDay:90});const mw=worker(code);mw.network.set(manifestPath,fm);assert.equal((await mw.get(manifestPath)).status,200);cases++;
 const badPacks=['{','null',JSON.stringify({...parse(packPath),days:parse(packPath).days.slice(1)}),JSON.stringify({...parse(packPath),id:'wrong'}),JSON.stringify({...parse(packPath),version:0}),JSON.stringify({...parse(packPath),sourceBase:{path:'wrong',sha256:'wrong'}})];
 const badDrop=parse(packPath);delete badDrop.days[0].qalb.action;badPacks.push(JSON.stringify(badDrop));
 const badManifests=['{',JSON.stringify({...parse(manifestPath),regular:[parse(manifestPath).regular[0],{...parse(manifestPath).regular[1],firstDay:32}]}),JSON.stringify({...parse(manifestPath),seasonal:[]}),JSON.stringify({...parse(manifestPath),labels:{}})];
 for(const [p,badList]of [[packPath,badPacks],[manifestPath,badManifests]])for(const bad of badList){
  const cold=worker(code);cold.network.set(p,bad);assert.equal((await cold.get(p)).status,0,'invalid cold response fails');assert(!cold.stored.has(p),'invalid body never cached');
  const good=bodies.get(p),store=new Map([[p,good]]),warm=worker(code,store);warm.network.set(p,bad);assert.equal(await(await warm.get(p)).text(),good);assert.equal(store.get(p),good,'bad refresh preserves complete revision');
  const restarted=worker(code,store);restarted.network.set(p,new Error('offline'));assert.equal(await(await restarted.get(p)).text(),good,'new worker offline retains last valid revision');cases++;
 }
 const broken=worker(code,new Map([[packPath,'{']]));broken.network.set(packPath,new Error('offline'));assert.equal((await broken.get(packPath)).status,0,'invalid old cache not served');cases++;
 const idle=worker(code);await idle.warm();for(const[p,b]of bodies)assert.equal(idle.stored.get(p),b);cases++;
 const badIdle=worker(code);badIdle.network.set(packPath,'{');await badIdle.warm();assert(!badIdle.stored.has(packPath));assert(badIdle.failures.some(e=>e.url===packPath));cases++;
 const repair=worker(code,new Map([[packPath,'{']]));await repair.warm();assert.equal(repair.stored.get(packPath),bodies.get(packPath));cases++;
 const keep=worker(code,new Map([[packPath,bodies.get(packPath)]]));keep.network.set(packPath,'{');await keep.warm();assert.equal(keep.stored.get(packPath),bodies.get(packPath));assert(!keep.calls.includes(packPath),'idle skips a valid cached pack');cases++;
 const good=bodies.get(packPath),full=worker(code,new Map([[packPath,good]]),new Map(bodies),true);const changed=parse(packPath);changed.days[0].qalb.note+=' fixture';full.network.set(packPath,changed);assert.equal(await(await full.get(packPath)).text(),good);assert.equal(full.stored.get(packPath),good,'quota failure leaves old valid body');cases++;
 const evidencePath='/dima/pack-source-evidence-v1.json',evidence=worker(code);evidence.network.set(evidencePath,'{"evidence":true}');assert.equal((await evidence.get(evidencePath)).status,200,'source evidence keeps the ordinary JSON policy');cases++;
 return cases;
}
const bypass=source.replace('return swDimaValid(path, JSON.parse(await response.clone().text()));','return true;');
const idleBypass=source.replace('return swDimaPath(u) ? swDimaAdd(cache, u) : cache.add(u);','return cache.add(u);');
const broadPath=source.replace(helper(source,'swDimaPath'),'function swDimaPath(path) { return path.startsWith("/dima/pack-"); }');
async function main(){
 assert.notEqual(bypass,source);assert.notEqual(idleBypass,source);
 if(process.argv.includes('--mutant'))return verify(bypass,false);
 if(process.argv.includes('--mutant-idle'))return verify(idleBypass);
 if(process.argv.includes('--mutant-path'))return verify(broadPath);
 const cases=await verify(source);await assert.rejects(()=>verify(bypass,false));await assert.rejects(()=>verify(idleBypass));await assert.rejects(()=>verify(broadPath));
 console.log('PASS B10 offline: '+cases+' runtime/warm/persistence fixtures; app/worker validation parity; future pack; malformed/partial/ID/version/source/schema failures; restart offline and quota retention; unrelated JSON policy; three mutants rejected.');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
