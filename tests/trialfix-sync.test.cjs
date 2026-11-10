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
  const got=JSON.parse(first);assert.equal(got.startDate,'2026-10-31');assert.equal(got.log['2026-11-03'].taps,7);assert.equal(got.notify.on,false);assert.deepEqual(got.presented['2026-11-03'],snap);
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
