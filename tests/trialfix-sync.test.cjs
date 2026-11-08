const test = require('node:test'), assert = require('node:assert/strict');
const { makeDevice, vm } = require('./trialfix-client-harness.cjs');
const run = (d, code) => vm.runInContext(code, d.ctx);
const plain = v => JSON.parse(JSON.stringify(v));
const profile = { pid: 'trial', name: '', birthYear: 2007, age: 19, birthYearProvided: false, gender: null };
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
  assert.equal(run(d,'ezikSyncCollect()["kv:profile"].birthYear'),1980,'pending device year is not uploaded as an edit');
  run(d,'ezikSyncChooseProfileYear(true)');
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYear,1980);
  apply({name:'Legacy',birthYear:1975});
  assert.equal(JSON.parse(d.local.getItem('child_profile')).birthYearProvided,false);
  d.local.removeItem('child_profile');
  assert.equal(apply({name:'Early',birthYear:1980}),false,'pre-onboarding record is not consumed');
  d.local.setItem('child_profile',JSON.stringify(profile));
  apply({name:'Cleared',birthYear:null,birthYearProvided:false});
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
  d.local.setItem('ezik_dima_v2',JSON.stringify(state));assert.throws(()=>run(d,'ezikSyncCollect()'),/sync-dima-day-too-large/);
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
