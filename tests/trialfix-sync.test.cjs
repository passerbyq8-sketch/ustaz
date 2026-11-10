const test = require('node:test'), assert = require('node:assert/strict');
const { makeDevice, vm } = require('./trialfix-client-harness.cjs');
const run = (d, code) => vm.runInContext(code, d.ctx);
const plain = v => JSON.parse(JSON.stringify(v));
const profile = { pid: 'trial', name: '', birthYear: 2007, age: 19, birthYearProvided: false, gender: null };
// ORDER T2: C4's independent fixtures, asserting the repaired outcomes.
const auditProfile = {pid:'audit',name:'Device',gender:'male',birthYear:2015,age:11,birthYearProvided:true};
const auditDevice = () => makeDevice({child_profile:JSON.stringify(auditProfile)},'audit-t2');
const applyRecord = (d,id,val,u=20) => run(d,`ezikSyncApply(${JSON.stringify(id)},${JSON.stringify({u,val})})`);
const validRun = (id,at) => ({id,at,seed:at+1,i:1,segs:[[1,1,1,7]],cfg:{},st:{shown:5,ok:4,errs:[],ayat:[1,2,3,4,5],ms:1000}});
test('trialfix-t2b index zero reloads, resumes and survives sharded sync and retirement',async()=>{
  const source=require('fs').readFileSync(require('path').join(__dirname,'../app.jsx'),'utf8');
  const resume=source.match(/  const resume = \(r\) => \{[^\n]+/)[0];
  const zero={...validRun('zero',20),i:0,st:{shown:0,ok:0,errs:[],ayat:[],ms:0}};
  const first=device();run(first,'mem86RunWrite('+JSON.stringify(zero)+')');
  const reloaded=device({ezik_mem_run_v1:first.local.getItem('ezik_mem_run_v1')});
  const assertResume=d=>{
    run(d,'__mem86Counts=new Array(115).fill(7)');
    assert.equal(run(d,'mem86RunRead().i'),0);
    const resumed=plain(run(d,'(()=>{let active,stage,saved;const setRun=v=>active=v,setStage=v=>stage=v,setSaved=v=>saved=v;'+resume+' resume(mem86RunRead());return {active,stage,saved};})()'));
    assert.equal(resumed.active.id,'zero');assert.equal(resumed.active.i,0);assert.equal(resumed.active.temp,false);
    assert.equal(resumed.stage,'count');assert.equal(resumed.saved,null);
  };
  assertResume(reloaded);
  const service=await import('../lib/sync/service.js'),store=await import('../lib/sync/store.js');
  store.__setSyncStoreForTest(require('../guards/sync-fake-store.cjs').makeStore());
  const env={SYNC_ENC_KEY:'11'.repeat(32),VERCEL_ENV:'preview'},account='t2b-zero';
  const records=plain(run(reloaded,'ezikSyncCollect()'));
  const shard=Object.entries(records).find(([id,v])=>id.startsWith('ctr:mem.run.')&&v.runs.some(r=>r.id==='zero'));
  assert.ok(shard);assert.equal(shard[1].runs[0].i,0);
  await service.push(account,Object.entries(records).map(([id,val])=>({id,rec:{u:20,val}})),env);
  const restored=device();
  for(const c of (await service.pull(account,0,env)).changes)applyRecord(restored,c.id,c.rec.val,c.rec.u);
  assertResume(restored);
  for(const action of ['discard','finish']) {
    const d=device({ezik_mem_run_v1:restored.local.getItem('ezik_mem_run_v1')});
    run(d,action==='discard'?'mem86RunWrite(null)':'mem86RunWrite(null,'+JSON.stringify(zero)+')');
    const retired=plain(run(d,'ezikSyncCollect()'));
    const retirement=Object.entries(retired).find(([id,v])=>id.startsWith('ctr:mem.run.')&&v.retired.includes('zero'));
    assert.ok(retirement,action);
    await service.push(account,[{id:retirement[0],rec:{u:30,val:retirement[1]}}],env);
    await service.push(account,[{id:shard[0],rec:{u:999,val:shard[1]}}],env);
    const echo=device();
    for(const c of (await service.pull(account,0,env)).changes)applyRecord(echo,c.id,c.rec.val,c.rec.u);
    run(echo,'__mem86Counts=new Array(115).fill(7)');assert.equal(run(echo,'mem86RunRead()'),null,action);
    assert.equal(Object.values((await service.exportAll(account,env)).records).flatMap(v=>v.runs||[]).some(r=>r.id==='zero'),false);
  }
});
test('trialfix-t2b index validation rejects negative fractional oversized missing and nonnumeric values',()=>{
  const d=device();run(d,'__mem86Counts=new Array(115).fill(7)');
  for(const i of [-1,0.5,10000,undefined,null,'0']) {
    d.local.setItem('ezik_mem_run_v1',JSON.stringify({...validRun('invalid',20),i}));
    assert.equal(run(d,'mem86RunRead()'),null,String(i));
  }
  for(const i of [0,1,9999]) {
    d.local.setItem('ezik_mem_run_v1',JSON.stringify({...validRun('valid',20),i}));
    assert.equal(run(d,'mem86RunRead().i'),i);
  }
});
function cycleFixture(d,changes=[]) {
  run(d,`readAuthSession=()=>({session:'A'});ezikSyncStatus=async()=>true;ezikSyncLibCollect=async()=>{};ezikSyncLibSnapshot=()=>({});ezikSyncArmNext=()=>{};var auditUploads=[];
    ezikSyncCall=async b=>b.action==='pull'?{ok:true,data:{cursor:1,changes:${JSON.stringify(changes)}}}:(auditUploads.push(...b.changes),{ok:true,data:{results:b.changes}});`);
}
test('trialfix-t2-f1 new-client-null-account-year preserves device year, age and provenance',()=>{
  for(const val of [{name:'Account'},{birthYear:null},{birthYear:'1980'},{birthYear:1980.5}]) {
    const d=auditDevice();applyRecord(d,'kv:profile',val);
    const p=JSON.parse(d.local.getItem('child_profile'));
    assert.deepEqual([p.birthYear,p.age,p.birthYearProvided],[2015,11,true]);
  }
  const d=auditDevice();applyRecord(d,'kv:profile',{birthYear:new Date().getFullYear()-19,birthYearProvided:false,_fields:{year:50}});
  const p=JSON.parse(d.local.getItem('child_profile'));assert.equal(p.age,19);assert.equal(p.birthYearProvided,false);
});
test('trialfix-t2-f2 conflicting-year-drops-saved-name and gender survive pull and upload',async()=>{
  const d=auditDevice();
  cycleFixture(d,[{id:'kv:profile',rec:{u:20,val:{name:'OLD ACCOUNT NAME',gender:'male',birthYear:1980,birthYearProvided:true,_fields:{name:1,gender:1,year:20}}}}]);
  run(d,"var st=ezikSyncReadState();st.acct='A';st.shadow['kv:profile']=ezikSyncHash(JSON.stringify(ezikSyncCollect()['kv:profile']));ezikSyncWriteState(st)");
  d.local.setItem('child_profile',JSON.stringify({...auditProfile,name:'LOCAL SAVED EDIT',gender:'female',syncFields:{name:100,gender:101,year:1}}));
  assert.equal(await run(d,'ezikSyncCycle()'),'ok');
  const p=JSON.parse(d.local.getItem('child_profile')),v=plain(run(d,"ezikSyncCollect()['kv:profile']"));
  assert.equal(p.name,'LOCAL SAVED EDIT');assert.equal(p.gender,'female');assert.equal(v._fields.name,100);assert.equal(v._fields.gender,101);assert.equal(v._fields.year,1);assert.equal(v.birthYear,2015);
  assert.equal(run(d,"auditUploads.find(c=>c.id==='kv:profile').rec.val.name"),'LOCAL SAVED EDIT');
});
test('trialfix-t2-f3 resolved-remotely-conflict-still-pending clears and choices use latest account',()=>{
  const d=auditDevice();run(d,"readAuthSession=()=>({session:'A'})");
  applyRecord(d,'kv:profile',{name:'Old',birthYear:1980,birthYearProvided:true},2);
  applyRecord(d,'kv:profile',{name:'Latest',birthYear:2015,birthYearProvided:true},3);
  assert.equal(run(d,'ezikSyncProfileConflict()'),null);
  const v=plain(run(d,"ezikSyncCollect()['kv:profile']"));assert.equal(v.name,'Latest');assert.equal(v.birthYear,2015);
  applyRecord(d,'kv:profile',{birthYear:1980,birthYearProvided:true},4);
  applyRecord(d,'kv:profile',{birthYear:1990,birthYearProvided:true},5);
  assert.equal(run(d,'ezikSyncProfileConflict().account.birthYear'),1990);
  run(d,'ezikSyncChooseProfileYear(true)');assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYear,1990);
  applyRecord(d,'kv:profile',{birthYear:1980,birthYearProvided:true},6);
  applyRecord(d,'kv:profile',{name:'Legacy'},7);assert.equal(run(d,'ezikSyncProfileConflict()'),null);
});
test('trialfix-t2-f4 legacy-completed-day-reindexed freezes before earlier start, including deferred migration',()=>{
  const fs=require('fs'),data=fs.readFileSync(require('path').join(__dirname,'../dima/dima-v1.json'),'utf8');
  for(const preMigrate of [false,true]) {
    const d=auditDevice();d.local.setItem('ezik_dima_v1',JSON.stringify({startDate:'2026-11-03',log:{'2026-11-04':{l:1,q:1,j:1,taps:3}},notify:{on:false,slot:'fajr30'},notifySeen:true}));
    const incoming={schema:2,startDate:'2026-11-01',log:{},presented:{}};
    if(!preMigrate){assert.equal(applyRecord(d,'ctr:dima.0.start',incoming),false);assert.equal(d.local.getItem('ezik_dima_v2'),null);}
    run(d,'__dimaData='+data);if(preMigrate)run(d,'dimaReadStore()');
    applyRecord(d,'ctr:dima.0.start',incoming);
    const after=plain(run(d,"dimaResolveForDate(dimaReadStore(),dimaDateFromKey('2026-11-04'))"));
    assert.equal(after.index,2);assert.equal(after.dayId,'dima.regular.002');
    assert.equal(JSON.parse(d.local.getItem('ezik_dima_v2')).startDate,'2026-11-01');
  }
});
test('trialfix-t2-f5 dima-delete-all-stale-reconnect rejects old generation and accepts fresh progress',async()=>{
  const service=await import('../lib/sync/service.js'),store=await import('../lib/sync/store.js');
  store.__setSyncStoreForTest(require('../guards/sync-fake-store.cjs').makeStore());
  const env={SYNC_ENC_KEY:'11'.repeat(32),VERCEL_ENV:'preview'},account='t2-wipe';
  const val={schema:2,startDate:'2026-11-01',log:{},presented:{}};
  await service.push(account,[{id:'kv:dima_epoch',rec:{u:1,val:'0'}},{id:'ctr:dima.0.start',rec:{u:1,val}}],env);
  const before=await service.pull(account,0,env);await service.wipeAll(account,env);
  await service.push(account,[{id:'ctr:dima.0.start',rec:{u:1,val}}],env);
  const exported=await service.exportAll(account,env);assert.equal(Object.keys(exported.records).some(id=>id.startsWith('ctr:dima.')),false);
  const pulled=await service.pull(account,before.cursor,env),epoch=pulled.changes.find(c=>c.id==='kv:dima_epoch');assert.ok(epoch);assert(Number(epoch.rec.val)>0);
  await service.push(account,[{id:'kv:dima_epoch',rec:{u:Date.now()+999,del:true,val:null}}],env);
  assert.equal((await service.exportAll(account,env)).records['kv:dima_epoch'],epoch.rec.val,'a stale epoch deletion cannot remove the boundary');
  const d=auditDevice();applyRecord(d,'kv:dima_epoch',epoch.rec.val);d.local.setItem('ezik_dima_v2',JSON.stringify({...val,startDate:'2026-11-09',notify:{on:false,slot:'fajr30'},notifySeen:true}));
  const fresh=plain(run(d,'ezikSyncCollect()'));
  await service.push(account,Object.entries(fresh).map(([id,val])=>({id,rec:{u:Date.now(),val}})),env);
  assert.equal((await service.exportAll(account,env)).records['ctr:dima.'+epoch.rec.val+'.start'].startDate,'2026-11-09');
  const returning=auditDevice();returning.local.setItem('ezik_dima_epoch_v1',String(Number(epoch.rec.val)+1));
  cycleFixture(returning,[epoch]);assert.equal(await run(returning,'ezikSyncCycle()'),'ok');
  assert.equal(run(returning,"auditUploads.find(c=>c.id==='kv:dima_epoch').rec.val"),String(Number(epoch.rec.val)+1),'a newer local reset boundary reaches the account');
  await service.eraseForAccountDelete(account,env);assert.equal((await service.pull(account,0,env)).changes.length,0);
});
test('trialfix-t2-f6 valid-discarded-paused-run-resurrected and finished run stay retired after stale upload',async()=>{
  const {mergeRecord}=await import('../lib/sync/merge.js');
  const service=await import('../lib/sync/service.js'),store=await import('../lib/sync/store.js');
  store.__setSyncStoreForTest(require('../guards/sync-fake-store.cjs').makeStore());
  const env={SYNC_ENC_KEY:'11'.repeat(32),VERCEL_ENV:'preview'};
  for(const action of ['discard','finish']) {
    const d=auditDevice();run(d,'__mem86Counts=new Array(115).fill(7)');
    const pair={runs:[validRun('a',10),validRun('b',20)]};applyRecord(d,'ctr:mem.run',pair);
    assert.equal(run(d,'mem86RunRead().id'),'b');
    if(action==='discard') run(d,'mem86RunWrite(null)');
    else {
      const source=require('fs').readFileSync(require('path').join(__dirname,'../app.jsx'),'utf8');
      const start=source.indexOf('  const finish = (r) => {'),end=source.indexOf('  const pause = () => {',start);
      run(d,'(()=>{const elapsed=()=>1000,t0={current:0},counts=new Array(115).fill(7),setRun=()=>{},setResult=()=>{},setStage=()=>{},setQs=()=>{};'+source.slice(start,end)+'finish('+JSON.stringify({...validRun('b',20),temp:true})+');})()');
    }
    assert.equal(run(d,'mem86RunRead()'),null,action);
    const records=plain(run(d,'ezikSyncCollect()')),retirement=Object.entries(records).find(([id,v])=>id.startsWith('ctr:mem.run.')&&v.retired.includes('b'));assert.ok(retirement);
    const merged=mergeRecord(retirement[0],{u:30,val:retirement[1]},{u:999,val:{runs:[validRun('b',20)]}});
    await service.push(action,[{id:'ctr:mem.run',rec:{u:20,val:pair}}],env);
    await service.push(action,[{id:retirement[0],rec:{u:30,val:retirement[1]}}],env);
    await service.push(action,[{id:'ctr:mem.run',rec:{u:999,val:pair}}],env);
    const exported=(await service.exportAll(action,env)).records;
    assert.equal(Object.values(exported).flatMap(v=>v.runs||[]).some(r=>r.id==='b'),false,action+' server retirement');
    assert.equal(Object.values(exported).flatMap(v=>v.runs||[]).filter(r=>r.id==='a').length,1);
    applyRecord(d,'ctr:mem.run',pair);applyRecord(d,retirement[0],merged.val);
    assert.equal(run(d,'mem86RunRead().id'),'a');assert.deepEqual(JSON.parse(d.local.getItem('ezik_mem_runs_v1')).map(r=>r.id),['a']);
  }
  const other=auditDevice();run(other,'__mem86Counts=new Array(115).fill(7)');
  run(other,'var auditScheduled=0;ezikSyncSoon=()=>{auditScheduled++};ezikSyncWatching=false;ezikSyncWatch();');
  other.local.setItem('ezik_mem_run_v1',JSON.stringify(validRun('a',10)));
  run(other,'mem86RunWrite(null,'+JSON.stringify(validRun('b',20))+')');
  assert.equal(run(other,'mem86RunRead().id'),'a','finishing another run keeps a genuinely paused active run');
  assert.ok(run(other,'auditScheduled > 0'),'the storage watcher schedules retirement sync');
});
test('trialfix-t2-f7 valid-paused-runs-stop-entire-sync shards 14 runs and isolates oversized records',async()=>{
  const d=auditDevice();
  const many={runs:Array.from({length:14},(_,i)=>({...validRun('run'+i,i),segs:[[1,1,114,6]],st:{shown:999,ok:999,errs:Array(300).fill('2:255:4'),ayat:Array.from({length:2000},(_,j)=>j+1),ms:1000}}))};
  assert.equal(Buffer.byteLength(JSON.stringify(many)),168233);
  applyRecord(d,'ctr:mem.run',many);d.local.setItem('ezik_110_font_v1','cairo');
  d.local.setItem('ezik_mem_held_v1',JSON.stringify({'1':[[1,3]]}));
  d.local.setItem('ezik_dima_v2',JSON.stringify({schema:2,startDate:'2026-11-01',log:{},presented:{},notify:{on:false,slot:'fajr30'},notifySeen:true}));
  let records=plain(run(d,'ezikSyncCollect()'));assert.equal(Object.keys(records).filter(id=>id.startsWith('ctr:mem.run.')).length,14);
  for(const val of Object.values(records))assert(Buffer.byteLength(JSON.stringify(val))<150*1024);
  cycleFixture(d);assert.equal(await run(d,'ezikSyncCycle()'),'ok');
  assert.ok(run(d,"auditUploads.some(c=>c.id==='kv:profile')"));assert.ok(run(d,"auditUploads.some(c=>c.id==='kv:ezik_110_font_v1')"));
  assert.ok(run(d,"auditUploads.some(c=>c.id==='ctr:dima.0.start')"));assert.ok(run(d,"auditUploads.some(c=>c.id==='ctr:mem.held.1')"));
  applyRecord(d,'ctr:mem.run',{runs:[{...validRun('huge',50),extra:'x'.repeat(200000)}]});
  let errors=[];d.window.addEventListener('ezik:sync:record-error',e=>errors.push(e.detail));
  records=plain(run(d,'ezikSyncCollect()'));assert.equal(Object.keys(records).filter(id=>id.startsWith('ctr:mem.run.')).length,14);assert.ok(errors.some(e=>e.reason==='size'));
  d.local.setItem('ezik_110_font_v1','noto');assert.equal(await run(d,'ezikSyncCycle()'),'ok');assert.equal(run(d,"auditUploads.filter(c=>c.id==='kv:ezik_110_font_v1').at(-1).rec.val"),'noto');
  const service=await import('../lib/sync/service.js'),store=await import('../lib/sync/store.js');store.__setSyncStoreForTest(require('../guards/sync-fake-store.cjs').makeStore());
  const env={SYNC_ENC_KEY:'11'.repeat(32),VERCEL_ENV:'preview'};
  const result=await service.push('runs',[{id:'ctr:mem.run',rec:{u:100,val:many}},{id:'kv:ezik_110_font_v1',rec:{u:1,val:'cairo'}}],env);
  assert.equal(result.results.filter(r=>r.id.startsWith('ctr:mem.run.')).length,14);
  for(const r of result.results){assert.ok(!r.refused);assert(Buffer.byteLength(JSON.stringify(r.rec))<150*1024);}
  const isolated=await service.push('runs',[{id:'ctr:mem.run.toobig',rec:{u:101,val:{runs:[{...validRun('toobig',50),extra:'x'.repeat(300000)}]}}},{id:'kv:ezik_110_font_v1',rec:{u:102,val:'noto'}}],env);
  assert.equal(isolated.results[0].refused,'size');assert.equal(isolated.results[1].rec.val,'noto');
});
function device(seed={}) { return makeDevice({ child_profile: JSON.stringify(profile), ...seed }, 'trialfix'); }
test('trialfix-d5-d10 profile hydration, missing local, legacy provenance, conflicts and explicit choice', () => {
  const d = device();
  run(d, "readAuthSession = () => ({ session: 'account-A' });");
  const apply = val => run(d, `ezikSyncApply('kv:profile', {u:10,val:${JSON.stringify(val)}})`);
  apply({ name:'Restored',gender:'female',birthYear:1990,birthYearProvided:true });
  assert.equal(JSON.parse(d.local.getItem('child_profile')).name,'Restored');
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYearProvided,true);
  apply({ name:'Account',gender:'male',birthYear:1980,birthYearProvided:true });
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYear,1990);
  assert.ok(run(d,'ezikSyncProfileConflict()'));
  assert.equal(run(d,'ezikSyncCollect()["kv:profile"].birthYear'),1990,'collection retains the pending device pair without advancing its year timestamp');
  run(d,'ezikSyncChooseProfileYear(true)');
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYear,1980);
  // A newer legacy write still normalizes missing provenance to false; an older write now loses.
  apply({name:'Legacy',birthYear:1975,_fields:{year:Date.now()+1000}});
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYearProvided,false);
  d.local.removeItem('child_profile');
  assert.equal(apply({name:'Early',birthYear:1980}),false,'pre-onboarding record is not consumed');
  d.local.setItem('child_profile',JSON.stringify(profile));
  apply({name:'Cleared',birthYear:new Date().getFullYear()-19,birthYearProvided:false});
  assert.equal(JSON.parse(d.local.getItem('child_profile')).age,19);
  run(d,"ezikSyncSignOutWipe()");
  assert.equal(JSON.parse(d.local.getItem('child_profile')).name,'');
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYearProvided,false);
});
test('trialfix-d11 reinstall, frozen days, local notifications, idempotence, reset epoch and malformed v2', () => {
  const d=device();
  const snap={civilDate:'2026-11-03',index:4,packId:'season',dayId:'day4',version:1,snapshot:{lisan:{text:'l'},qalb:{text:'q'},jawarih:{text:'j'}}};
  const progress={schema:2,startDate:'2026-10-31',log:{'2026-11-03':{l:true,q:true,j:false,taps:7}},presented:{'2026-11-03':snap}};
  d.local.setItem('ezik_dima_v2', JSON.stringify({...progress,startDate:null,log:{},presented:{},notify:{on:false,slot:'fajr30'},notifySeen:true}));
  const code=`ezikSyncApply('ctr:dima.0.2026-11-03',{u:1,val:${JSON.stringify(progress)}})`;
  run(d,code);const first=d.local.getItem('ezik_dima_v2');run(d,code);assert.equal(d.local.getItem('ezik_dima_v2'),first);
  const got=JSON.parse(first);assert.equal(got.startDate,'2026-10-31');assert.equal(got.log['2026-11-03'].taps,7);assert.deepEqual([got.log['2026-11-03'].l,got.log['2026-11-03'].q,got.log['2026-11-03'].j],[1,1,0],'ORDER T4: a true mark is applied as 1');assert.equal(got.notify.on,false);assert.deepEqual(got.presented['2026-11-03'],snap);
  const collect=plain(run(d,'ezikSyncCollect()'));assert.ok(collect['ctr:dima.0.2026-11-03']);assert.equal(JSON.stringify(collect).includes('notify'),false);
  run(d,"ezikSyncApply('kv:dima_epoch',{u:20,val:'20'})");run(d,code);
  assert.equal(JSON.parse(d.local.getItem('ezik_dima_v2')).startDate,null,'old generation cannot resurrect');
  d.local.setItem('ezik_dima_v2','bad-json');assert.doesNotThrow(()=>run(d,'ezikSyncCollect()'));
  d.local.setItem('ezik_dima_epoch_v1','9000000000000');
  d.local.setItem('ezik_dima_v2',JSON.stringify(progress));
  run(d,'ezikSyncSoon = () => {}; ezikSyncWatching = false; ezikSyncWatch();');
  d.local.removeItem('ezik_dima_v2');
  assert.equal(d.local.getItem('ezik_dima_epoch_v1'),'9000000000001','a reset advances even beyond a previously imported fast-clock generation');
});
test('trialfix-d12a settings apply refreshes consumers and captures last explicit edit', () => {
  const d=device(); let events=0;d.window.addEventListener('ezik:settings:applied',()=>events++);
  for (const [key,val] of [['murabbi_theme_v1','dark'],['ezik_110_font_v1','noto'],['ezik_110_digits_v1','latn'],['ezik_enter_sends_v1','on']]) {
    run(d,`ezikSyncApply('kv:${key}',{u:1,val:${JSON.stringify(val)}})`);assert.equal(d.local.getItem(key),val);
  }
  assert.equal(d.window.document.documentElement.getAttribute('data-theme'),'dark');assert.equal(events,4);
  run(d,'ezikSyncWatching = false; ezikSyncWatch();');
  d.local.setItem('ezik_110_font_v1','cairo');
  const pending=plain(run(d,'ezikSyncReadState().pend["kv:ezik_110_font_v1"]'));
  assert.equal(pending.explicit,true);assert.ok(pending.u>0);
  d.local.removeItem('ezik_110_font_v1');
  assert.ok(run(d,'ezikSyncReadState().pend["kv:ezik_110_font_v1"].removed'));
});
test('trialfix-d12b memorizer reinstall, intervals, stable legacy IDs, paused runs and repeat sync', () => {
  const d=device();
  run(d,"ezikSyncApply('ctr:mem.held.1',{u:1,val:{'1':[[1,3]]}})");
  run(d,"ezikSyncApply('ctr:mem.held.1',{u:2,val:{'1':[[2,5]]}})");
  assert.deepEqual(JSON.parse(d.local.getItem('ezik_mem_held_v1')),{'1':[[1,5]]});
  d.local.setItem('ezik_mem_tests_v1',JSON.stringify([{t:10,shown:5,ok:4}]));
  assert.deepEqual(plain(run(d,'ezikSyncCollect()')),plain(run(d,'ezikSyncCollect()')));
  const legacyId=run(d,'mem86TestsRead()[0].id');
  run(d,"mem86TestsPut({t:10,shown:5,ok:4,errs:[],sur:[1]})");
  assert.equal(run(d,'mem86TestsRead().length'),1);assert.equal(run(d,'mem86TestsRead()[0].id'),legacyId);
  run(d,"mem86TestsPut({id:'distinct-test',t:10,shown:5,ok:4,errs:[],sur:[1]})");
  assert.equal(run(d,'mem86TestsRead().length'),2,'distinct stable IDs survive even with equal timestamps');
  run(d,"ezikSyncApply('ctr:mem.run',{u:1,val:{runs:[{id:'a',at:10},{id:'b',at:20}]}})");
  assert.equal(JSON.parse(d.local.getItem('ezik_mem_run_v1')).id,'b');
  assert.equal(JSON.parse(d.local.getItem('ezik_mem_runs_v1')).length,2);
});
test('trialfix-d5-d10 pull before onboarding is replayed; switched account and offline pull cannot hydrate', async () => {
  const d=device();d.local.removeItem('child_profile');
  run(d, `
    var trialAccount = 'A', trialPull = 0, trialMode = 'normal';
    readAuthSession = () => ({session: trialAccount});
    ezikSyncStatus = async () => true;
    ezikSyncLibCollect = async () => {};
    ezikSyncLibSnapshot = () => ({});
    ezikSyncArmNext = () => {};
    ezikSyncCall = async body => {
      if (trialMode === 'offline') throw Error('offline');
      if (body.action === 'pull') {
        if (trialMode === 'switch') trialAccount = 'B';
        return {ok:true,data:{cursor:1,changes:trialPull++ ? [] : [{id:'kv:profile',rec:{u:1,val:{name:'Account A',gender:'female',birthYear:1990,birthYearProvided:true}}}]}};
      }
      return {ok:true,data:{results:body.changes}};
    };
  `);
  assert.equal(await run(d,'ezikSyncCycle()'),'ok');
  assert.ok(run(d,'ezikSyncReadState().deferred["kv:profile"]'));
  d.local.setItem('child_profile',JSON.stringify(profile));
  assert.equal(await run(d,'ezikSyncCycle()'),'ok');
  assert.equal(JSON.parse(d.local.getItem('child_profile')).name,'Account A');
  assert.equal(run(d,'Object.keys(ezikSyncReadState().deferred).length'),0);
  run(d,"trialMode = 'switch'; trialPull = 0;");
  const before=d.local.getItem('child_profile');
  assert.equal(await run(d,'ezikSyncCycle()'),'account-changed');assert.equal(d.local.getItem('child_profile'),before);
  run(d,"trialMode = 'offline';");assert.equal(await run(d,'ezikSyncCycle()'),'error');assert.equal(d.local.getItem('child_profile'),before);
});
test('trialfix-d11 large multi-day history is split below the record cap and oversized days fail explicitly',()=>{
  const d=device(),log={};
  for(let i=0;i<900;i++){const day=new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10);log[day]={l:true,q:false,j:true,taps:i,laterAt:100};}
  d.local.setItem('ezik_dima_v2',JSON.stringify({schema:2,startDate:'2024-01-01',log,presented:{},notify:{on:false,slot:'fajr30'},notifySeen:true}));
  const records=plain(run(d,'ezikSyncCollect()'));assert.equal(Object.keys(records).filter(k=>k.startsWith('ctr:dima.')).length,901);
  assert.deepEqual([records['ctr:dima.0.2024-01-01'].log['2024-01-01'].l,records['ctr:dima.0.2024-01-01'].log['2024-01-01'].q,records['ctr:dima.0.2024-01-01'].log['2024-01-01'].j],[1,0,1],'ORDER T4: collected true marks go up as 1');
  for(const [id,value] of Object.entries(records))assert(Buffer.byteLength(JSON.stringify(value))<200*1024,id);
  const state=JSON.parse(d.local.getItem('ezik_dima_v2'));
  state.presented['2024-01-01']={civilDate:'2024-01-01',index:1,packId:'p',dayId:'d',version:1,snapshot:{lisan:{text:'x'.repeat(300000)},qalb:{text:'q'},jawarih:{text:'j'}}};
  d.local.setItem('ezik_dima_v2',JSON.stringify(state));assert.doesNotThrow(()=>run(d,'ezikSyncCollect()'));
  assert.equal(run(d,"ezikSyncRecordErrors['ctr:dima.0.2024-01-01']"),'size');
  assert.equal(Object.keys(plain(run(d,'ezikSyncCollect()'))).filter(k=>k.startsWith('ctr:dima.')).length,900);
});
test('trialfix-d12a a setting edited during pull or push is not overwritten by the older response', async()=>{
  const d=device();
  run(d, `
    readAuthSession = () => ({session:'race-account'});
    ezikSyncStatus = async () => true; ezikSyncLibCollect = async () => {};
    ezikSyncLibSnapshot = () => ({}); ezikSyncArmNext = () => {};
    ezikSyncWatching = false; ezikSyncWatch();
    ezikSyncCall = async body => {
      if (body.action === 'pull') {
        localStorage.setItem('ezik_110_font_v1','cairo');
        return {ok:true,data:{cursor:1,changes:[{id:'kv:ezik_110_font_v1',rec:{u:1,val:'noto'}}]}};
      }
      localStorage.setItem('ezik_110_font_v1','tajawal');
      return {ok:true,data:{results:body.changes}};
    };
  `);
  assert.equal(await run(d,'ezikSyncCycle()'),'ok');
  assert.equal(d.local.getItem('ezik_110_font_v1'),'tajawal');
  assert.equal(run(d,'ezikSyncReadState().pend["kv:ezik_110_font_v1"].explicit'),true);
  run(d,'ezikSyncHalted = true; clearTimeout(ezikSyncSoonTimer);');
});

// ORDER T3: C4's expanded scenarios run through the shipped callbacks and store script.
test('trialfix-t3-f1 saved-entered-year-versus-older-default-pair',async()=>{
  const d=makeDevice({child_profile:JSON.stringify({...auditProfile,name:'Local',syncFields:{name:5,gender:5,year:100}})},'year-clear');
  cycleFixture(d,[{id:'kv:profile',rec:{u:20,val:{name:'Remote',gender:'male',birthYear:2007,birthYearProvided:false,_fields:{name:20,gender:5,year:1}}}}]);
  run(d,"var st=ezikSyncReadState();st.acct='A';st.shadow['kv:profile']='old';st.pend['kv:profile']={u:100,explicit:true};ezikSyncWriteState(st)");
  assert.equal(await run(d,'ezikSyncCycle()'),'ok');
  const p=JSON.parse(d.local.getItem('child_profile'));
  assert.deepEqual([p.birthYear,p.age,p.birthYearProvided,p.syncFields.year,p.name],[2015,11,true,100,'Remote']);
  const uploaded=plain(run(d,"auditUploads.find(c=>c.id==='kv:profile').rec.val"));
  assert.deepEqual([uploaded.birthYear,uploaded.birthYearProvided,uploaded._fields.year,uploaded.name],[2015,true,100,'Remote']);
});
test('trialfix-t3-f2 F5-torn-read-concurrent-epoch and CAS contention',async()=>{
  const S=await import('../lib/sync/service.js'),T=await import('../lib/sync/store.js'),C=await import('../lib/sync/crypto.js');
  const env={VERCEL_ENV:'preview',SYNC_ENC_KEY:'11'.repeat(32)},keys=C.loadKeys(env);
  for(const interleaving of ['torn-read','before-CAS']) {
    const b=require('../guards/sync-fake-store.cjs').makeStore();T.__setSyncStoreForTest(b);
    const a='t3-'+interleaving,space=T.spaceIdOf(a),ks=T.keysOf('preview',space),newer=Date.now()+60000;
    await S.push(a,[{id:'kv:dima_epoch',rec:{u:1,val:'0'}}],env);
    const write=()=>T.casWrite('preview',space,'kv:dima_epoch',1,C.seal(keys,'preview',space,'kv:dima_epoch',{u:newer,del:false,val:String(newer)}));
    let armed=true,inject,wipes=0;const get=b.hgetall.bind(b),evaluate=b.eval.bind(b);
    b.hgetall=async k=>{
      if(interleaving==='torn-read'&&armed&&k===ks.r){const snapshot=await get(k);armed=false;inject=write();return snapshot;}
      if(k===ks.m){await Promise.resolve();if(inject)await inject;}
      return get(k);
    };
    b.eval=async(script,ks,args)=>{
      if(script.includes('-- sync-wipe-progress-v1')){wipes++;if(interleaving==='before-CAS'&&armed){armed=false;await write();}}
      return evaluate(script,ks,args);
    };
    await S.wipeAll(a,env);assert.equal(armed,false);assert.equal(wipes,2,'invalid snapshot retries');
    const after=(await S.exportAll(a,env)).records;
    assert.equal(Number(after['kv:dima_epoch']),newer+1);
    const stale='ctr:dima.'+newer+'.start',fresh='ctr:dima.'+(newer+1)+'.start';
    const val={schema:2,startDate:'2026-11-01',log:{},presented:{}};
    const pushed=await S.push(a,[{id:stale,rec:{u:1,val}}],env);
    assert.equal(pushed.results[0].rec.del,true);assert.equal((await S.exportAll(a,env)).records[stale],undefined);
    await S.push(a,[{id:fresh,rec:{u:2,val}}],env);assert.equal((await S.exportAll(a,env)).records[fresh].startDate,val.startDate);
  }
});
test('trialfix-t3-f3 F6-extra-real-begin-persist-finish and legacy seed resume',()=>{
  const source=require('fs').readFileSync(require('path').join(__dirname,'../app.jsx'),'utf8');
  const persist=source.match(/  const persist = \(r, ms\) => \{[^\n]+/)[0];
  const begin=source.slice(source.indexOf('  const begin = (segs, cfg) => {'),source.indexOf('  const resume = (r) => {'));
  const resume=source.match(/  const resume = \(r\) => \{[^\n]+/)[0];
  const finish=source.slice(source.indexOf('  const finish = (r) => {'),source.indexOf('  const pause = () => {',source.indexOf('  const finish = (r) => {')));
  for(const mode of ['begin','seed-resume','idless-resume','seed-discard']) {
    const d=auditDevice();run(d,'__mem86Counts=new Array(115).fill(7)');
    const legacy={...validRun('42',10),seed:42,i:0};if(mode==='idless-resume')delete legacy.id;
    if(mode!=='begin')d.local.setItem('ezik_mem_run_v1',JSON.stringify(legacy));
    const got=plain(run(d,'(()=>{let active;const prefs={},temp=false,setRun=v=>active=v,setResult=()=>{},setStage=()=>{},setSaved=()=>{},setQs=()=>{},elapsed=()=>0,t0={current:0},counts=new Array(115).fill(7);'+persist+begin+resume+finish+
      (mode==='begin'?'begin([[1,1,1,7]],{});':'resume(mem86RunRead());persist(active,0);')+
      'const before=mem86RunRead(),runtimeId=active.id;active.st.shown=1;active.st.ok=1;active.st.ayat=[1];'+(mode==='seed-discard'?'mem86RunWrite(null);':'finish(active);')+
      'return {runtimeId,storedId:before.id,after:mem86RunRead(),retired:JSON.parse(localStorage.getItem("ezik_mem_retired_v1")),collected:ezikSyncCollect()};})()'));
    assert.equal(got.runtimeId,got.storedId,mode);assert.equal(got.after,null,mode);assert.ok(got.retired.includes(got.storedId));
    assert.equal(Object.values(got.collected).flatMap(v=>v.runs||[]).some(r=>r.id===got.storedId),false,mode);
    applyRecord(d,'ctr:mem.run',{runs:[{...legacy,id:got.storedId}]},999);
    assert.equal(run(d,'mem86RunRead()'),null,'stale echo stays retired');
  }
});
// ORDER T3D (T2-F5): both privacy copies state the one encrypted boundary record that delete-all keeps.
test('trialfix-t3d-t2f5 privacy copies say what delete-all keeps',()=>{
  const fsT3d=require('fs'),pathT3d=require('path');
  const keptAr="\u00ab\u062d\u0630\u0641 \u0643\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a\u00bb \u064a\u0645\u0633\u062d\u0647\u0627 \u0645\u0646 \u062c\u0647\u0627\u0632\u0643 \u0648\u0645\u0646 \u062d\u0633\u0627\u0628\u0643 \u0641\u0648\u0631\u064b\u0627\u060c \u0648\u064a\u0628\u0642\u0649 \u062d\u0633\u0627\u0628\u064f\u0643 \u0641\u0627\u0631\u063a\u064b\u0627 \u0645\u0646\u0647\u0627\u060c \u0625\u0644\u0651\u0627 \u0631\u0642\u0645\u064b\u0627 \u062a\u0642\u0646\u064a\u064b\u0651\u0627 \u0645\u0634\u0641\u0651\u0631\u064b\u0627 \u0644\u0627 \u0645\u062d\u062a\u0648\u0649 \u0641\u064a\u0647\u060c \u0645\u0639 \u0639\u062f\u0651\u0627\u062f\u0627\u062a\u0650 \u0645\u0632\u0627\u0645\u0646\u062a\u0650\u0647\u060c \u064a\u0645\u0646\u0639\u064f \u0623\u064a\u064e\u0651 \u062c\u0647\u0627\u0632\u064d \u0642\u062f\u064a\u0645\u064d \u0645\u0646 \u0625\u0631\u062c\u0627\u0639\u0650 \u062a\u0642\u062f\u0651\u0645\u0650 \u00ab\u062f\u064a\u0645\u0629\u00bb \u0627\u0644\u0645\u062d\u0630\u0648\u0641.";
  const keptEn="\"Delete all data\" erases it from your device and from your account at once; your account stays empty of it, except for an encrypted technical number with no content (and its sync counters), which stops any old device from bringing back deleted Dima progress.";
  const emptyAr="\u00ab\u062d\u0630\u0641 \u0643\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a\u00bb \u064a\u0645\u0633\u062d\u0647\u0627 \u0645\u0646 \u062c\u0647\u0627\u0632\u0643 \u0648\u0645\u0646 \u062d\u0633\u0627\u0628\u0643 \u0641\u0648\u0631\u064b\u0627\u060c \u0648\u064a\u0628\u0642\u0649 \u062d\u0633\u0627\u0628\u064f\u0643 \u0641\u0627\u0631\u063a\u064b\u0627.";
  const emptyEn="\"Delete all data\" erases it from your device and from your account at once; your account stays, empty.";
  for(const rel of ['privacy.html','lib/sync/privacy-page.js']){
    const shown=fsT3d.readFileSync(pathT3d.join(__dirname,'..',rel),'utf8').replace(/<\/?strong>/g,'');
    const seen=s=>shown.split(s).length-1;
    assert.equal(seen(keptAr),1,rel+' arabic boundary sentence');
    assert.equal(seen(keptEn),1,rel+' english boundary sentence');
    assert.equal(seen(emptyAr),0,rel+' old arabic empty-account promise');
    assert.equal(seen(emptyEn),0,rel+' old english empty-account promise');
  }
});

// ORDER T4: Dima's drop marks, the guest start and the birth-year field, on the real roads (diagnosis D3's harness).
const T4 = require('./trialfix-t4-harness.cjs');
const t4Git = rev => require('child_process').execFileSync('git', ['show', rev + ':app.js'], { cwd: T4.REPO, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
const T4_V144 = '80957904', T4_V146 = '24992d446c5018e1cd5189cd8076575111678d81';
const T4_MIN = 60000, T4_DAY = 86400000;
const t4Owner = () => JSON.stringify({ name: 'Owner', age: 40, gender: 'male', birthYear: 1986, birthYearProvided: true, pid: 'pid-old', createdAt: '2026-10-01T00:00:00.000Z' });
const t4Flags = log => Object.values(log || {}).flatMap(d => [d.l, d.q, d.j]);
let t4Seq = 0;
let t4V144Text = null; const t4V144App = () => (t4V144Text ||= t4Git(T4_V144));
/** A fresh install of the same account: three moments (at once, after one cycle, after a restart). */
async function t4Fresh(w, account, o = {}) {
  if (o.gapMs) w.clock.now += o.gapMs;
  const dev = w.open({ name: 'fresh', storage: w.fakeLocal({ mrb_device_v1: 'fresh-' + (++t4Seq) }) });
  await w.advance(dev, 3000);
  if (o.guestStart) { await w.openDima(dev); w.begin(dev); w.mark(dev, 0); await w.advance(dev, 5000); }
  w.signIn(dev, account); w.onboard(dev);
  await w.advance(dev, 5000);
  const out = { atOnce: w.view(dev) };
  await w.advance(dev, 125000);
  out.afterCycle = w.view(dev);
  if (o.openDima) { await w.openDima(dev); await w.advance(dev, 5000); out.afterOpen = w.view(dev); }
  out.v2 = w.readJSON(dev, 'ezik_dima_v2');
  w.kill(dev);
  const again = w.open({ name: 'restart', storage: dev.local });
  await w.advance(again, 5000);
  out.afterRestart = w.view(again);
  out.storage = dev.local;
  w.kill(again);
  return out;
}
async function t4V144Phase(w, account) {
  const p = w.open({ name: 'v144', app: t4V144App(), storage: w.fakeLocal({ mrb_device_v1: 'old-' + (++t4Seq), child_profile: t4Owner() }) });
  w.signIn(p, account); await w.advance(p, 10000);
  await w.openDima(p); w.begin(p); w.mark(p, 0); await w.advance(p, 10000);
  w.kill(p);
  return p.local;
}
async function t4Update(w, storage, stayMs, o = {}) {
  const p = w.open({ name: 'updated', storage });
  await w.advance(p, 3000);
  if (o.openDima) { await w.openDima(p); await w.advance(p, 1000); }
  for (const t of o.moreDrops || []) { w.mark(p, t); await w.advance(p, 700); }
  const before = w.view(p);
  await w.advance(p, stayMs);
  const after = w.view(p);
  w.kill(p);
  return { before, after };
}
const t4Moments = (f, keys = ['atOnce', 'afterCycle', 'afterRestart']) => keys.map(k => [k, f[k]]);

test('trialfix-t4-c1-own-drop-survives-watcher-push-and-echo', async () => {
  const w = await T4.world();
  try {
    const p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'own', child_profile: t4Owner() }) });
    w.signIn(p, 't4-own'); await w.advance(p, 10000);
    assert.ok(w.run(p, 'ezikSyncWatching'), 'the watcher is installed by the open server');
    await w.openDima(p); w.begin(p);
    const t0 = w.clock.now; w.mark(p, 0);
    assert.equal(w.view(p).todayDrops, 1, 'at once');
    await w.advance(p, 3000);
    const key = w.view(p).todayKey;
    const push = p.requests.find(r => r.t >= t0 && r.action === 'push' && r.ids.includes('ctr:dima.0.' + key));
    assert.ok(push, 'the watcher pushed the day record (and its echo was applied)');
    assert.equal(w.view(p).todayDrops, 1, 'after the push echo');
    await w.advance(p, 10000);
    assert.equal(w.view(p).todayDrops, 1, 'after 10 seconds');
    assert.equal(w.readJSON(p, 'ezik_dima_v2').log[key].l, 1, 'the stored mark stays the contract number');
    const acct = (await w.account('t4-own')).find(c => c.id === 'ctr:dima.0.' + key);
    assert.deepEqual([acct.rec.val.log[key].l, acct.rec.val.log[key].q], [1, 0], 'the account holds 0|1');
  } finally { w.restore(); }
});

test('trialfix-t4-c1-journeys-J1-J2-J3-J6-J7-fresh-install', async () => {
  const w = await T4.world();
  try {
    // J1: one drop on v144 (no Dima sync), the update, a stay, then the reinstall.
    for (const stay of [T4_MIN, 10 * T4_MIN]) {
      const account = 't4-J1-' + stay;
      const updated = await t4Update(w, await t4V144Phase(w, account), stay);
      assert.equal(updated.after.todayDrops, 1, 'J1 the old phone keeps its drop after the update and its first sync');
      const f = await t4Fresh(w, account);
      for (const [m, v] of t4Moments(f)) { assert.equal(v.todayDrops, 1, 'J1 ' + m); assert.equal(v.days[v.todayKey], 1, 'J1 day ' + m); }
      assert.ok(t4Flags(f.v2.log).every(x => x === 0 || x === 1), 'J1 fresh install stores 0|1');
    }
    // J2: a second drop on the updated build.
    {
      const account = 't4-J2';
      const updated = await t4Update(w, await t4V144Phase(w, account), 10 * T4_MIN, { openDima: true, moreDrops: [1] });
      assert.deepEqual([updated.before.todayDrops, updated.after.todayDrops], [2, 2], 'J2 the old phone keeps both drops');
      const f = await t4Fresh(w, account);
      for (const [m, v] of t4Moments(f)) assert.equal(v.todayDrops, 2, 'J2 ' + m);
    }
    // J3: three drops on the new build only, in front and in the background, 10 s before the wipe.
    for (const bg of [false, true]) {
      const account = 't4-J3-' + bg;
      const p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'j3-' + bg, child_profile: t4Owner() }) });
      w.signIn(p, account); await w.advance(p, 10000);
      await w.openDima(p); w.begin(p); w.mark(p, 0); w.mark(p, 1); w.mark(p, 2);
      if (bg) { p.visible = false; w.fire(p, 'visibilitychange', 'document'); w.fire(p, 'pagehide'); }
      await w.advance(p, 10000);
      assert.equal(w.view(p).todayDrops, 3, 'J3 the old phone after its push echo');
      w.kill(p);
      const f = await t4Fresh(w, account);
      for (const [m, v] of t4Moments(f)) assert.equal(v.todayDrops, 3, 'J3 ' + (bg ? 'background ' : 'front ') + m);
    }
    // J6: two days of drops; the fresh install opens Dima on day two.
    {
      const account = 't4-J6';
      const p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'j6', child_profile: t4Owner() }) });
      w.signIn(p, account); await w.advance(p, 10000);
      await w.openDima(p); w.begin(p); w.mark(p, 0); w.mark(p, 1); w.mark(p, 2);
      await w.advance(p, 2 * T4_MIN);
      const day1 = w.view(p).todayKey;
      await w.advance(p, T4_DAY);
      await w.openDima(p); w.mark(p, 0); w.mark(p, 1);
      await w.advance(p, 2 * T4_MIN);
      w.kill(p);
      const f = await t4Fresh(w, account, { openDima: true });
      for (const [m, v] of t4Moments(f, ['atOnce', 'afterCycle', 'afterOpen', 'afterRestart'])) {
        assert.equal(v.titleIndex, 2, 'J6 day two ' + m); assert.equal(v.todayDrops, 2, 'J6 today ' + m);
        assert.equal(v.days[day1], 3, 'J6 yesterday ' + m); assert.deepEqual(v.plants.slice(0, 2), [2, 3], 'J6 plants ' + m);
      }
    }
    // J7: the owner's calendar: one drop on v144, the update, the reinstall two days later.
    {
      const account = 't4-J7';
      await t4Update(w, await t4V144Phase(w, account), 10 * T4_MIN);
      const f = await t4Fresh(w, account, { gapMs: 2 * T4_DAY, openDima: true });
      for (const [m, v] of t4Moments(f, ['atOnce', 'afterCycle', 'afterOpen', 'afterRestart'])) {
        assert.equal(v.titleIndex, 3, 'J7 day three ' + m); assert.equal(v.todayDrops, 0, 'J7 no drop yet today ' + m);
        assert.deepEqual(v.plants.slice(0, 3), [0, 0, 1], 'J7 the first day plant is filled ' + m);
      }
    }
  } finally { w.restore(); }
});

test('trialfix-t4-c1-stored-true-reads-done-on-screen-banner-and-reminders', async () => {
  const w = await T4.world();
  try {
    const day = '2026-11-08';
    const seed = flags => w.fakeLocal({ mrb_device_v1: 'true-' + (++t4Seq), child_profile: t4Owner(),
      ezik_dima_v2: JSON.stringify({ schema: 2, startDate: day, log: { [day]: { ...flags, taps: 1 } }, presented: {}, notify: { on: true, slot: 'fajr30' }, notifySeen: true }) });
    const seen = {};
    for (const [label, flags] of [['true', { l: true, q: true, j: false }], ['one', { l: 1, q: 1, j: 0 }], ['allTrue', { l: true, q: true, j: true }]]) {
      const p = w.open({ storage: seed(flags) });
      await w.advance(p, 3000);
      let el = await w.render(p, 'DimaHomeCard', { name: '' });
      const banner = el.querySelectorAll('.dimaHomeProgressDrop.is-filled').length, bannerDone = !!el.querySelector('.dimaHomeDoneBadge');
      w.unmount(p);
      await w.openDima(p);
      el = await w.render(p, 'EzikDimaSection', {});
      const screen = { done: el.querySelectorAll('.dimaTab.is-done').length, complete: !!el.querySelector('.dimaStatus.is-done') };
      w.unmount(p);
      const items = plain(w.run(p, 'ezikDimaAlertItems(new Date())')).map(i => i.id + '@' + i.at);
      seen[label] = { banner, bannerDone, screen, items };
      w.kill(p);
    }
    assert.equal(seen.true.banner, 2, 'home banner counts true marks'); assert.deepEqual(seen.true.screen, { done: 2, complete: false }, 'screen pills');
    assert.equal(seen.true.bannerDone, false); assert.equal(seen.allTrue.bannerDone, true, 'home banner completes on three true marks'); assert.equal(seen.allTrue.screen.complete, true, 'three true marks complete the day');
    assert.ok(seen.one.items.length > 0, 'the reminders are computed for this store');
    assert.deepEqual(seen.true, seen.one, 'a stored true reads exactly as a stored 1');
  } finally { w.restore(); }
});

test('trialfix-t4-c1-merge-outputs-only-0-1-and-both-copies-agree', async () => {
  const server = await import('../lib/sync/trialfix-progress.js');
  const source = require('fs').readFileSync(require('path').join(__dirname, '../app.jsx'), 'utf8');
  const lib = require('fs').readFileSync(require('path').join(__dirname, '../lib/sync/trialfix-progress.js'), 'utf8');
  const body = (s, k) => { const i = s.indexOf(k); return s.slice(i, s.indexOf('\n}\n', i) + 2); };
  assert.equal(body(source, 'function mergeDima('), body(lib, 'export function mergeDima(').replace('export ', ''), 'the client copy is the server function');
  const w = await T4.world();
  try {
    const p = w.open({});
    const values = [true, false, 1, 0, undefined, null, '1', 2];
    const on = v => v === 1 || v === true;
    for (const x of values) for (const y of values) {
      const a = { startDate: '2026-11-01', log: { '2026-11-02': { l: x, q: y, j: x, taps: 1 } } }, b = { log: { '2026-11-02': { l: y, q: x } } };
      const s = server.mergeDima(a, b), c = plain(w.run(p, 'EZIK_PROGRESS.mergeDima(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ')'));
      const day = s.log['2026-11-02'];
      for (const f of ['l', 'q', 'j']) assert.ok(day[f] === 0 || day[f] === 1, 'flag ' + f + ' is 0|1');
      assert.equal(day.l, on(x) || on(y) ? 1 : 0); assert.equal(day.q, on(y) || on(x) ? 1 : 0); assert.equal(day.j, on(x) ? 1 : 0);
      if (x !== undefined && y !== undefined) assert.deepEqual(c, plain(s), 'client and server agree');
    }
    const merged = server.mergeDima({ log: { '2026-11-02': { l: true, q: false, j: true } } }, {});
    assert.deepEqual([merged.log['2026-11-02'].l, merged.log['2026-11-02'].q, merged.log['2026-11-02'].j], [1, 0, 1], 'true inputs become 1');
    assert.deepEqual(server.mergeDima(merged, merged), merged, 'idempotent');
  } finally { w.restore(); }
});

// T4-F1: linkedom shares window expandos between windows, so only one page is ever alive here.
// Each device closes before the other opens, and reopens on its own storage (`x.local`).
test('trialfix-t4-c1-two-devices-each-drop-counts-on-both', async () => {
  const w = await T4.world();
  try {
    const account = 't4-two';
    // the flags as stored in one device's own storage object, read without the page
    const own = (local) => { const s = JSON.parse(local.getItem('ezik_dima_v2') || 'null'); const d = s && s.log && Object.values(s.log)[0]; return d ? [d.l, d.q, d.j] : null; };
    const pulls = (page) => page.requests.filter(r => r.action === 'pull').length;
    const a = w.open({ name: 'a', storage: w.fakeLocal({ mrb_device_v1: 'two-a', child_profile: t4Owner() }) });
    assert.throws(() => w.open({ name: 'b-too-early' }), /one live page/, 'the harness refuses a second live page');
    w.signIn(a, account); await w.advance(a, 10000);
    await w.openDima(a); w.begin(a); w.mark(a, 0); await w.advance(a, 10000);
    assert.equal(w.view(a).todayDrops, 1, 'device a counts its own drop');
    assert.deepEqual(own(a.local), [1, 0, 0], 'device a stores its own drop');
    w.kill(a);
    const b = w.open({ name: 'b', storage: w.fakeLocal({ mrb_device_v1: 'two-b', child_profile: t4Owner() }) });
    assert.notEqual(b.local, a.local, 'two storages');
    w.signIn(b, account); await w.advance(b, 10000);
    assert.equal(w.view(b).todayDrops, 1, 'device b sees the drop made on device a');
    await w.openDima(b); w.mark(b, 1); await w.advance(b, 10000);
    assert.equal(w.view(b).todayDrops, 2, 'device b counts both');
    assert.deepEqual(own(b.local), [1, 1, 0], 'device b stores both');
    assert.deepEqual(own(a.local), [1, 0, 0], 'device a, closed, has not been written by device b');
    w.kill(b);
    // each device again, alone, on its own storage, for three cycles
    for (const [label, dev] of [['a', a], ['b', b]]) {
      const again = w.open({ name: label + '-again', storage: dev.local });
      await w.advance(again, 10000);
      assert.ok(pulls(again) >= 1, 'device ' + label + ' pulled with its own requests');
      for (let cycle = 0; cycle <= 3; cycle++) {
        assert.equal(w.view(again).todayDrops, 2, 'device ' + label + ' counts both, cycle ' + cycle);
        assert.deepEqual(own(dev.local), [1, 1, 0], 'device ' + label + ' stores both in its own storage, cycle ' + cycle);
        if (cycle < 3) await w.advance(again, 130000);
      }
      assert.ok(pulls(again) >= 3, 'device ' + label + ' kept pulling across cycles');
      w.kill(again);
    }
  } finally { w.restore(); }
});

// ORDER T4 (D13-C2): Dima's start pressed as a guest, then an account whose start is earlier.
const t4Agree = (v, label) => { assert.equal(v.contentIndex, v.titleIndex, label + ': content follows the title'); assert.equal(v.frozenIndex, v.titleIndex, label + ': today is frozen on the merged start'); };
async function t4ScreenCard(w, p) {
  await w.openDima(p);
  const el = await w.render(p, 'EzikDimaSection', {});
  const card = el.querySelector('.dimaCard');
  const got = { index: Number(card.getAttribute('data-dima-index')), day: card.getAttribute('data-dima-day') };
  w.unmount(p);
  return got;
}
async function t4AccountDay(w, account, key) { return (await w.account(account)).find(c => c.id === 'ctr:dima.0.' + key).rec.val; }
/** D3's P3: the account starts on one phone; two days later a fresh install presses start as a guest, then signs in. */
async function t4GuestAfterAccount(w, account, o = {}) {
  const old = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'acct-' + (++t4Seq), child_profile: t4Owner() }) });
  w.signIn(old, account); await w.advance(old, 10000); await w.openDima(old); w.begin(old); w.mark(old, 0); await w.advance(old, 60000); w.kill(old);
  w.clock.now += (o.gapDays ?? 2) * T4_DAY;
  const f = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'guest-' + (++t4Seq) }) });
  await w.advance(f, 3000); await w.openDima(f); w.begin(f); w.mark(f, 0); await w.advance(f, 3000);
  return f;
}

test('trialfix-t4-c2-guest-start-then-earlier-account-P3-today-follows-merged-start', async () => {
  const w = await T4.world();
  try {
    const account = 't4-p3';
    const f = await t4GuestAfterAccount(w, account);
    const guest = w.view(f);
    assert.deepEqual([guest.titleIndex, guest.frozenIndex, guest.todayDrops], [1, 1, 1], 'the guest froze day one');
    const before = w.readJSON(f, 'ezik_dima_v2');
    w.signIn(f, account); w.onboard(f);
    await w.advance(f, 2000);
    const atOnce = w.view(f);
    assert.equal(atOnce.startDate < guest.startDate, true, 'the earliest start wins');
    assert.equal(atOnce.titleIndex, 3); t4Agree(atOnce, 'at once'); assert.equal(atOnce.todayDrops, 1, 'today drops unchanged at once');
    assert.deepEqual(w.readJSON(f, 'ezik_dima_v2').log[guest.todayKey], before.log[guest.todayKey], 'the drop record is untouched');
    await w.advance(f, 10000);
    const echo = w.view(f); t4Agree(echo, 'after the push echo'); assert.equal(echo.todayDrops, 1);
    const held = await t4AccountDay(w, account, guest.todayKey);
    assert.equal(held.presented[guest.todayKey].index, 3, 'the account holds the new snapshot');
    assert.equal(held.presented[guest.todayKey].replaces, T4.plain(w.run(f, 'EZIK_PROGRESS.snapshotId(' + JSON.stringify(before.presented[guest.todayKey]) + ')')), 'it names the exact snapshot it replaced');
    assert.deepEqual(held.conflicts || {}, {}, 'the replaced snapshot is retired, not kept as a conflict');
    await w.advance(f, 130000);
    t4Agree(w.view(f), 'after one cycle');
    assert.deepEqual(await t4ScreenCard(w, f), { index: 3, day: w.view(f).contentDayId }, 'the screen card shows day three');
    w.kill(f);
    const again = w.open({ storage: f.local }); await w.advance(again, 5000); await w.openDima(again);
    const restart = w.view(again); t4Agree(restart, 'after a restart'); assert.equal(restart.todayDrops, 1);
    await w.advance(again, 130000); t4Agree(w.view(again), 'restart plus a cycle'); w.kill(again);
    const second = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'second-' + (++t4Seq), child_profile: t4Owner() }) });
    w.signIn(second, account); await w.advance(second, 10000); await w.openDima(second); await w.advance(second, 5000);
    const sv = w.view(second); t4Agree(sv, 'second device'); assert.equal(sv.todayDrops, 1);
    assert.deepEqual(w.readJSON(second, 'ezik_dima_v2').presented[guest.todayKey], restart && w.readJSON(again, 'ezik_dima_v2').presented[guest.todayKey], 'two devices end on the same snapshot');
    w.kill(second);
    const fresh = await t4Fresh(w, account, { openDima: true });
    for (const [m, v] of t4Moments(fresh, ['atOnce', 'afterCycle', 'afterOpen'])) { assert.equal(v.titleIndex, 3, 'fresh ' + m); assert.equal(v.frozenIndex, 3, 'fresh ' + m); }
    assert.equal(fresh.afterOpen.contentIndex, 3, 'fresh install content');
  } finally { w.restore(); }
});

test('trialfix-t4-c2-J7-J4-guestStart-gap2d-title-and-content-agree', async () => {
  const w = await T4.world();
  try {
    const account = 't4-J7-guest';
    await t4Update(w, await t4V144Phase(w, account), 10 * T4_MIN);
    const f = await t4Fresh(w, account, { gapMs: 2 * T4_DAY, guestStart: true, openDima: true });
    for (const [m, v] of t4Moments(f, ['atOnce', 'afterCycle', 'afterOpen', 'afterRestart'])) {
      assert.equal(v.titleIndex, 3, 'J7/J4 title ' + m); assert.equal(v.frozenIndex, 3, 'J7/J4 frozen ' + m);
      assert.equal(v.todayDrops, 1, 'J7/J4 the guest drop stays ' + m); assert.deepEqual(v.plants.slice(0, 3), [1, 0, 1], 'J7/J4 plants ' + m);
    }
    assert.equal(f.afterOpen.contentIndex, 3, 'J7/J4 content');
  } finally { w.restore(); }
});

test('trialfix-t4-c2-past-days-frozen-under-the-guest-start-keep-their-snapshots', async () => {
  const w = await T4.world();
  try {
    const account = 't4-past';
    const f = await t4GuestAfterAccount(w, account, { gapDays: 3 });
    const day1 = w.view(f).todayKey;
    await w.advance(f, T4_DAY); await w.openDima(f); w.mark(f, 0); w.mark(f, 1); w.mark(f, 2);
    const day2 = w.view(f).todayKey;
    await w.advance(f, T4_DAY); await w.openDima(f);
    const today = w.view(f);
    assert.deepEqual([today.titleIndex, today.frozenIndex], [3, 3], 'guest day three');
    const before = w.readJSON(f, 'ezik_dima_v2');
    w.signIn(f, account); w.onboard(f); await w.advance(f, 15000);
    const after = w.readJSON(f, 'ezik_dima_v2'), v = w.view(f);
    assert.equal(v.titleIndex, 6); t4Agree(v, 'today');
    for (const k of [day1, day2]) {
      assert.deepEqual(after.presented[k], before.presented[k], 'past day ' + k + ' keeps its snapshot');
      assert.deepEqual(after.log[k], before.log[k], 'past day ' + k + ' keeps its drops');
      assert.deepEqual((await t4AccountDay(w, account, k)).presented[k], before.presented[k], 'the account keeps ' + k);
    }
    assert.deepEqual([after.presented[day1].index, after.presented[day2].index], [1, 2], 'past days stay frozen under the guest start');
  } finally { w.restore(); }
});

test('trialfix-t4-c2-guest-start-on-the-account-start-day-changes-nothing', async () => {
  const w = await T4.world();
  try {
    const account = 't4-same';
    const f = await t4GuestAfterAccount(w, account, { gapDays: 0 });
    const before = w.readJSON(f, 'ezik_dima_v2'), key = w.view(f).todayKey;
    w.signIn(f, account); w.onboard(f); await w.advance(f, 15000);
    const after = w.readJSON(f, 'ezik_dima_v2');
    assert.equal(after.startDate, before.startDate);
    assert.equal(after.replacing, undefined, 'no replacement is waiting');
    assert.equal(after.presented[key].replaces, undefined, 'no snapshot names a replacement');
    assert.equal(after.presented[key].dayId, before.presented[key].dayId);
    assert.equal(w.view(f).titleIndex, 1); t4Agree(w.view(f), 'same day');
  } finally { w.restore(); }
});

test('trialfix-t4-c2-merge-honours-only-the-exact-replacement', async () => {
  const P = await import('../lib/sync/trialfix-progress.js');
  const snap = (i, extra) => ({ civilDate: '2026-11-10', index: i, packId: 'p', dayId: 'd' + i, version: 1, snapshot: { lisan: { text: 'l' + i }, qalb: { text: 'q' }, jawarih: { text: 'j' } }, ...extra });
  const old = snap(1), fresh = snap(3, { replaces: P.snapshotId(snap(1)) }), stranger = snap(3, { replaces: P.snapshotId(snap(2)) });
  const past = { civilDate: '2026-11-09', index: 1, packId: 'p', dayId: 'past', version: 1, snapshot: {} };
  const a = { startDate: '2026-11-10', log: { '2026-11-10': { l: 1 } }, presented: { '2026-11-10': old, '2026-11-09': past } };
  const b = { startDate: '2026-11-08', log: {}, presented: { '2026-11-10': fresh } };
  const m = P.mergeDima(a, b);
  assert.deepEqual(m.presented['2026-11-10'], fresh); assert.equal(m.conflicts['2026-11-10'], undefined, 'the named snapshot is retired');
  assert.deepEqual(m.presented['2026-11-09'], past, 'another day is untouched');
  assert.deepEqual(P.mergeDima(b, a), m, 'commutative'); assert.deepEqual(P.mergeDima(m, a), m, 'a stale old snapshot cannot come back'); assert.deepEqual(P.mergeDima(m, m), m, 'idempotent');
  const s = P.mergeDima(a, { presented: { '2026-11-10': stranger } });
  assert.equal([s.presented['2026-11-10'], ...(s.conflicts['2026-11-10'] || [])].length, 2, 'a replacement of another snapshot retires nothing');
  assert.notEqual(P.snapshotId(snap(1)), P.snapshotId(snap(1, { index: 2 })));
  assert.equal(P.snapshotId({ b: 1, a: [2] }), P.snapshotId({ a: [2], b: 1 }), 'key order does not change the identity');
  const source = require('fs').readFileSync(require('path').join(__dirname, '../app.jsx'), 'utf8'), lib = require('fs').readFileSync(require('path').join(__dirname, '../lib/sync/trialfix-progress.js'), 'utf8');
  const body = (x, k) => { const i = x.indexOf(k); return x.slice(i, x.indexOf('\n}\n', i) + 2); };
  assert.equal(body(source, 'function snapshotId('), body(lib, 'export function snapshotId(').replace('export ', ''), 'the client copy is the server function');
});

test('trialfix-t4-c2-v146-client-reads-the-replacement-record', async () => {
  const w = await T4.world();
  try {
    const account = 't4-v146';
    const f = await t4GuestAfterAccount(w, account);
    const key = w.view(f).todayKey, oldSnap = w.readJSON(f, 'ezik_dima_v2').presented[key];
    w.signIn(f, account); w.onboard(f); await w.advance(f, 15000); w.kill(f);
    const v146 = t4Git(T4_V146);
    const d = w.open({ app: v146, storage: w.fakeLocal({ mrb_device_v1: 'v146-' + (++t4Seq), child_profile: t4Owner() }) });
    w.signIn(d, account); await w.advance(d, 10000); await w.openDima(d); await w.advance(d, 5000);
    const stored = w.readJSON(d, 'ezik_dima_v2');
    assert.equal(stored.presented[key].index, 3); assert.equal(typeof stored.presented[key].replaces, 'string');
    assert.equal(w.run(d, 'dimaV2Valid(' + JSON.stringify(stored) + ')'), true, 'the v146 store validator accepts the record');
    assert.equal(w.run(d, '(dimaResetSession(), dimaReadStore(), __dimaStoreError)'), '', 'v146 reports no corrupt store');
    const v = w.view(d); assert.deepEqual([v.titleIndex, v.contentIndex, v.frozenIndex], [3, 3, 3], 'v146 shows the replacement');
    // a v146 device that still holds the old snapshot pushes it again: the account keeps the replacement
    await w.service.push(account, [{ id: 'ctr:dima.0.' + key, rec: { u: w.clock.now + 9999, val: { schema: 2, startDate: null, log: {}, presented: { [key]: oldSnap }, conflicts: {} } } }], w.ENV);
    const held = await t4AccountDay(w, account, key);
    assert.equal(held.presented[key].index, 3); assert.deepEqual(held.conflicts || {}, {}, 'later syncs never switch today back');
  } finally { w.restore(); }
});

// ORDER T4 (D14): the birth-year field in Settings, rendered with the real SettingsSheet and App's own writers.
function t4SettingsHost(w, p) {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../app.jsx'), 'utf8');
  const cut = (from, to) => { const a = src.indexOf(from); assert.ok(a >= 0, 'anchor ' + from); const b = src.indexOf(to, a) + to.length; return src.slice(a, b); };
  const save = cut('  const saveProfileFields = (', '\n  };\n');
  const gender = cut('  const ez110SaveGender = (g) => {', '\n  };\n');
  const live = cut('  useEffect(() => {\n    const clearSignedOutProfile', "  }, []);\n");
  w.run(p, 'globalThis.T4Host = function T4Host(props) {\n' +
    '  const [profile, setProfile] = useState(props.initial);\n  const profileRef = useRef(props.initial), voiceProfileRef = { current: null };\n' +
    save + gender + live +
    '  globalThis.__t4Host = { saveGender: ez110SaveGender, profile: () => profileRef.current };\n' +
    "  return React.createElement(SettingsSheet, { theme: 'light', onTheme() {}, onBack() {}, onOpenControl() {}, a11y: EZIK_A11Y_DEFAULTS, onA11y() {}, onA11yReset() {}, aiConsent: false, aiConsentBy: null, onWithdrawAI() {}, onReviewAI() {}, profile, onSaveProfile: saveProfileFields });\n};");
}
async function t4Settings(w, p, initial) {
  // the sheet's sign-in row reads the page address; linkedom's bare window has none
  if (!p.window.location) p.window.location = { href: 'https://ezik.app/', origin: 'https://ezik.app', protocol: 'https:', host: 'ezik.app', hostname: 'ezik.app', pathname: '/', search: '', hash: '' };
  t4SettingsHost(w, p);
  const el = await w.render(p, 'T4Host', { initial });
  const label = w.run(p, "ezT('onboarding.birthYear')"), saveLabel = w.run(p, "ezT('settings.profileSave')");
  const year = () => [...el.querySelectorAll('input')].find(i => i.getAttribute('placeholder') === label);
  const flush = () => w.advance(p, 200);
  return {
    year, placeholder: label,
    async type(v) {
      // the native value setter (below React's tracker on the node), then the input event React listens to
      const i = year(); let o = Object.getPrototypeOf(i), d = null; while (o && !(d = Object.getOwnPropertyDescriptor(o, 'value'))) o = Object.getPrototypeOf(o);
      assert.ok(d && d.set, 'a native value setter'); d.set.call(i, v); i.dispatchEvent(new p.window.Event('input', { bubbles: true })); await flush();
      assert.equal(year().value, v, 'the field took the typed text');
    },
    async save() { [...el.querySelectorAll('button')].find(b => b.textContent === saveLabel).click(); await flush(); },
    async male() { el.querySelector('button[role="radio"]').click(); await flush(); },
    stored: () => { const x = JSON.parse(p.local.getItem('child_profile')); return [x.birthYear, x.age, x.birthYearProvided]; },
    flush,
  };
}
const t4FirstRun = () => { const y = new Date().getFullYear(); return { name: '', age: 19, gender: null, birthYear: y - 19, birthYearProvided: false, pid: 'pid-d14', createdAt: '2026-11-01T00:00:00.000Z' }; };

test('trialfix-t4-d14-first-run-default-shows-an-empty-field-and-saves-unchanged', async () => {
  const w = await T4.world();
  try {
    const first = t4FirstRun();
    const p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'd14-a', child_profile: JSON.stringify(first) }) });
    await w.advance(p, 3000);
    const s = await t4Settings(w, p, first);
    assert.ok(s.year(), 'the birth-year field is on the sheet');
    assert.equal(s.year().value, '', 'the default year is not shown'); assert.ok(s.placeholder.length > 0, 'its existing placeholder shows');
    assert.equal(String(first.birthYear), '2007', 'the 2026 default the owner saw');
    await s.save();
    assert.deepEqual(s.stored(), [first.birthYear, 19, false], 'saving with the field empty keeps the default pair, not entered');
    await s.male(); await s.save();
    assert.deepEqual(s.stored(), [first.birthYear, 19, false], 'a gender change does not turn the default into an entered year');
    assert.equal(s.year().value, '');
    w.run(p, '__t4Host.saveGender("female")'); await s.flush();
    assert.deepEqual(s.stored(), [first.birthYear, 19, false], 'the home gender writer keeps the provenance');
    assert.equal(s.year().value, '', 'still empty after the reseed');
    await s.type('1990'); await s.save();
    assert.deepEqual(s.stored(), [1990, new Date().getFullYear() - 1990, true], 'typing sets an entered year');
    assert.equal(s.year().value, '1990', 'a typed year shows');
  } finally { w.restore(); }
});

test('trialfix-t4-d14-typed-year-shows-and-legacy-unentered-year-is-kept', async () => {
  const w = await T4.world();
  try {
    const typed = { ...t4FirstRun(), name: 'R', birthYear: 1990, age: 36, birthYearProvided: true };
    let p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'd14-b', child_profile: JSON.stringify(typed) }) });
    await w.advance(p, 3000);
    let s = await t4Settings(w, p, typed);
    assert.equal(s.year().value, '1990', 'a typed year shows');
    w.kill(p);
    const legacy = { ...t4FirstRun(), birthYear: 2015, age: 11, birthYearProvided: false };
    p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'd14-c', child_profile: JSON.stringify(legacy) }) });
    await w.advance(p, 3000);
    s = await t4Settings(w, p, legacy);
    assert.equal(s.year().value, '', 'a year never entered is not shown');
    await s.save();
    assert.deepEqual(s.stored(), [2015, 11, false], 'an untouched empty field keeps the stored pair (no reset to the adult default)');
    await s.type('2015'); await s.type(''); await s.save();
    assert.deepEqual(s.stored(), [new Date().getFullYear() - 19, 19, false], 'clearing a typed field still declines, as before');
  } finally { w.restore(); }
});

test('trialfix-t4-d14-after-sign-out-and-after-sign-in-to-an-unentered-account', async () => {
  const w = await T4.world();
  try {
    for (const provided of [true, false]) {
      const prof = { ...t4FirstRun(), name: 'Me', gender: 'male', birthYear: provided ? 1990 : 2007, age: provided ? 36 : 19, birthYearProvided: provided };
      const p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'd14-out-' + provided, child_profile: JSON.stringify(prof) }) });
      await w.advance(p, 3000);
      const s = await t4Settings(w, p, prof);
      w.run(p, 'ezikSyncSignOutWipe()'); await s.flush();
      assert.equal(s.year().value, provided ? '1990' : '', 'after a sign-out the field shows only a typed kept year');
      w.kill(p);
    }
    const account = 't4-d14-acct';
    await w.service.push(account, [{ id: 'kv:profile', rec: { u: 10, val: { name: 'Account', gender: 'female', birthYear: 2007, birthYearProvided: false, _fields: { name: 10, gender: 10, year: 10 } } } }], w.ENV);
    const first = t4FirstRun();
    const p = w.open({ storage: w.fakeLocal({ mrb_device_v1: 'd14-in', child_profile: JSON.stringify(first) }) });
    await w.advance(p, 3000);
    const s = await t4Settings(w, p, first);
    w.signIn(p, account); await w.advance(p, 8000);
    assert.equal(w.run(p, '__t4Host.profile().name'), 'Account', 'the sign-in hydrated the profile through the real road');
    assert.equal(s.year().value, '', 'an account whose year was never entered shows an empty field');
  } finally { w.restore(); }
});
