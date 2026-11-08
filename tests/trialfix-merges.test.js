import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecord } from '../lib/sync/merge.js';
import { mergeDima, mergeMemorizer } from '../lib/sync/trialfix-progress.js';
test('trialfix-d5-d10 concurrent fields and atomic legacy year provenance', () => {
  const a={u:20,val:{name:'A',gender:'female',birthYear:2000,birthYearProvided:true,_fields:{name:20,gender:1,year:1}}};
  const b={u:30,val:{name:'old',gender:'male',birthYear:2000,birthYearProvided:true,_fields:{name:1,gender:30,year:1}}};
  const merged=mergeRecord('kv:profile',a,b).val;
  assert.equal(merged.name,'A');assert.equal(merged.gender,'male');assert.equal(merged.birthYearProvided,true);
  const legacy=mergeRecord('kv:profile',a,{u:40,val:{name:'legacy',birthYear:2015}}).val;
  assert.equal(legacy.birthYear,2015);assert.equal(legacy.birthYearProvided,false);
});
test('trialfix-d11 earliest start, civil days, snapshot conflicts, max taps and tombstones', () => {
  const a={startDate:'2026-11-03',log:{'2026-11-04':{l:true,taps:7}},presented:{'2026-11-04':{civilDate:'2026-11-04',index:2,packId:'ordinary'}}};
  const b={startDate:'2026-11-01',log:{'2026-11-04':{q:true,taps:5}},presented:{'2026-11-04':{civilDate:'2026-11-04',index:4,packId:'seasonal'}}};
  const merged=mergeDima(a,b);assert.equal(merged.startDate,'2026-11-01');assert.equal(merged.log['2026-11-04'].taps,7);
  assert.ok(merged.log['2026-11-04'].l&&merged.log['2026-11-04'].q);assert.equal(merged.conflicts['2026-11-04'].length,1);
  assert.deepEqual(mergeDima(b,a),merged);assert.deepEqual(mergeDima(merged,b),merged);
  assert.equal(mergeRecord('ctr:dima.0.start',{u:10,del:true},{u:100,val:a}).del,true);
});
test('trialfix-d12b interval union and distinct paused runs survive idempotent merge', () => {
  assert.deepEqual(mergeMemorizer('held',{'1':[[1,3],[7,8]]},{'1':[[3,7]]},true),{'1':[[1,8]]});
  const a={id:'one',at:1},b={id:'two',at:2};const merged=mergeMemorizer('run',a,b,true);
  assert.equal(merged.runs.length,2);assert.equal(merged.active.id,'two');assert.deepEqual(mergeMemorizer('run',merged,b,true),merged);
});
