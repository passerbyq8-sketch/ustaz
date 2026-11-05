'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('34.3 health and budget endpoints refuse non-owners including viewers',async()=>{
 const {harness}=require('./security-auth-harness.cjs'),h=await harness(),account=await h.load('lib/auth/account.js');
 const a=await account.upsertAccount({provider:'google',sub:'health-reader',email:'health@synthetic.invalid',emailVerified:true}),s=await account.mintSession(a.key);
 for(const action of ['read','limit','ack'])assert.equal((await h.post('api/panel-health.js',{session:s.session,action,usd:10,id:'20261106:noFind'})).statusCode,401);
 await (await h.load('lib/panel-access.js')).setPanelViewer(a.key,true,{role:'owner',accountKey:'synthetic-owner'});
 assert.equal((await h.post('api/panel-health.js',{session:s.session,action:'read'})).statusCode,401);
 h.env.EZIK_OWNER_ACCOUNTS=account.emailDigest('health@synthetic.invalid');
 assert.equal((await h.post('api/panel-health.js',{session:s.session,action:'limit',usd:10})).statusCode,200);
 const bad=await h.post('api/panel-health.js',{session:s.session,action:'limit',usd:-1});assert.equal(bad.statusCode,400);assert.equal(bad.body.ok,false);
});
test('34.3 sampled rises require volume, absolute and relative thresholds; spend warnings use daily setting',async()=>{
 const {evaluateAlerts}=await import('../lib/panel-health.js');
 const prior={read:100,noFind:5,faults:2},today={read:100,noFind:25,faults:15};
 assert.deepEqual(evaluateAlerts(today,prior,null,10),['noFind','faults']);
 assert.deepEqual(evaluateAlerts({...today,read:10},prior,null,10),[]);
 assert.deepEqual(evaluateAlerts(today,today,null,10),[]);
 for(const [spent,want] of [[7.99,[]],[8,['spend80']],[9.49,['spend80']],[9.5,['spend95']]])assert.deepEqual(evaluateAlerts({}, {},spent,10),want);
 assert.deepEqual(evaluateAlerts({}, {},8,20),[]);
 const s=fs.readFileSync('lib/panel-health.js','utf8'),start=s.indexOf('export function evaluateAlerts'),end=s.indexOf('\nexport async',start);
 const mutant=s.slice(start,end).replace('export function','function').replace('today.read >= 20 && before.read >= 20','true');
 const fn=vm.runInNewContext(mutant+';evaluateAlerts');assert.notEqual(fn({...today,read:10},prior,null,10).length,0);
});
test('34.3 owner health keeps private alerts durable until acknowledged and cost unavailable',async()=>{
 const p=await import('../lib/panel-health.js'),data=new Map(),store={get:async k=>data.get(k)??null,set:async(k,v,o)=>{if(o?.nx&&data.has(k))return null;data.set(k,v);return 'OK';}};
 const read=async b=>b.days===7?{read:100,noFind:1,faults:1}:{read:100,noFind:40,faults:25};
 const a=await p.readPanelHealth(store,{read,now:new Date('2026-11-06T00:01:00Z')});assert.equal(a.limitUsd,10);assert.equal(a.day,'20261106');assert.equal(a.alerts.length,2);assert.equal(a.costUsd,null);assert.equal(a.costAvailable,false);
 const b=await p.readPanelHealth(store,{read,now:new Date('2026-11-06T12:00:00Z')});assert.equal(data.size,2);assert.equal(b.alerts[0].acknowledged,false);
 await p.acknowledgeAlert(store,a.alerts[0].id);assert.equal((await p.readPanelHealth(store,{read,now:new Date('2026-11-06T12:00:00Z')})).alerts[0].acknowledged,true);
 assert.equal(await p.saveDailyLimit(store,0),false);assert.equal(await p.saveDailyLimit(store,12.34),true);
});
