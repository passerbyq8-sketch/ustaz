'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {harness}=require('./security-auth-harness.cjs');
const {runIapLua}=require('./iap-receipt-lua-fixture.cjs');
async function fixture(){
 const h=await harness(),store=await h.load('lib/iap/store.js');
 const account='acct:v1:apple:receipt-fixture',base='iap:v1:development:a:'+crypto.createHash('sha256').update(account).digest('hex')+':';
 h.data.set(base+'balance',{value:{credits:3},until:0});
 h.redis.eval=async(script,keys,args)=>runIapLua(script,keys,args,(op,key,value,ex,ttl)=>{
  if(h.faults.down)throw Error('synthetic outage');
  const held=h.data.get(key);if(held&&held.until&&held.until<=h.now())h.data.delete(key);
  if(op==='GET')return h.data.has(key)?JSON.stringify(h.data.get(key).value):null;
  if(op==='SET'){h.data.set(key,{value:JSON.parse(value),until:ex==='EX'?h.now()+Number(ttl)*1000:0});return 'OK';}
  throw Error('unexpected command '+op);
 });
 const sessionId='retention-session-000000';
 const key=base+'session:'+crypto.createHash('sha256').update(sessionId).digest('hex');
 const consume=(game='hanna')=>store.consumeSession(account,sessionId,game,'automatic',h.now());
 return{h,base,key,consume};
}
test('SEC-039 full consume receipts expire after 30 days; the permanent spent marker prevents recharging',async()=>{
 const f=await fixture(),first=await f.consume();assert.equal(first.ok,true);assert.equal(f.h.data.get(f.base+'balance').value.credits,2);
 assert.equal(f.h.data.get(f.key).until-f.h.now(),30*86400000);
 const marker=[...f.h.data].find(([k])=>k.includes(':spent:'));assert.ok(marker);assert.equal(marker[1].until,0);
 f.h.advance(30*86400000+1);const old=await f.consume();assert.equal(old.ok,true);assert.equal(old.compacted,true);assert.equal(old.balance,undefined);
 assert.equal(f.h.data.get(f.base+'balance').value.credits,2);assert.equal((await f.consume('board')).code,'iap-session-conflict');
});
test('SEC-039 retry retains the exact original full receipt without extending its retention',async()=>{
 const f=await fixture(),first=await f.consume(),until=f.h.data.get(f.key).until;f.h.advance(2000);
 assert.equal(JSON.stringify(await f.consume()),JSON.stringify(first));assert.equal(f.h.data.get(f.key).until,until);
 assert.equal(f.h.data.get(f.base+'balance').value.credits,2);
});
test('SEC-039 legacy receipts compact on access without a debit and retain their game binding',async()=>{
 const f=await fixture();const old={ok:true,gameId:'board',mode:'subscription',balance:{credits:8}};
 f.h.data.set(f.key,{value:old,until:0});assert.equal((await f.consume()).code,'iap-session-conflict');
 assert.equal(JSON.stringify(await f.consume('board')),JSON.stringify(old));assert.equal(f.h.data.get(f.key).until-f.h.now(),30*86400000);
 f.h.advance(30*86400000+1);assert.equal((await f.consume('board')).mode,'subscription');
 assert.equal(f.h.data.get(f.base+'balance').value.credits,3);
});
test('SEC-039 concurrent fresh retries spend once; unavailable reads never become fresh receipts',async()=>{
 const f=await fixture();const r=await Promise.all([f.consume(),f.consume()]);assert.equal(r.every(x=>x.ok),true);
 assert.equal(f.h.data.get(f.base+'balance').value.credits,2);f.h.faults.down=true;
 await assert.rejects(f.consume(),/unavailable/);f.h.faults.down=false;assert.equal((await f.consume()).ok,true);
});
