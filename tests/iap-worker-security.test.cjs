'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {harness}=require('./security-auth-harness.cjs');
const secret=crypto.randomBytes(32).toString('hex');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
async function fixture(){
 const h=await harness();h.env.IAP_WORKER_SECRET=secret;h.env.IAP_ENFORCE='free';h.env.IAP_SIGNIN='all';
 const accounts=await h.load('lib/auth/account.js');
 const a=await accounts.upsertAccount({provider:'apple',sub:'worker-owner',email:'',emailVerified:false});
 const session=(await accounts.mintSession(a.key)).session;
 const route=await h.load('api/iap-worker.js');
 async function send(over={},signed=true){
  const body={v:1,aud:'ezik-games-worker-v1',action:'create',role:'host',gameId:'hanna',roomId:'a'.repeat(24),transitionId:'create',nonce:crypto.randomBytes(16).toString('hex'),issuedAt:h.now(),subject:'',session,...over};
  const signature=crypto.createHmac('sha256',secret).update('request-v1\n'+JSON.stringify(body)).digest('hex');
  const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}};
  await route.default({method:'POST',headers:{'x-ezik-worker-signature':signed?signature:'bad'},body},res);
  return res;
 }
 const balance='iap:v1:development:a:'+hash(a.key)+':balance';
 return {h,accounts,key:a.key,session,send,balance};
}
test('SEC-003 worker authority requires a signed server request, supported scope and recent nonce',async()=>{
 const f=await fixture();
 assert.equal((await f.send({},false)).statusCode,401);
 for(const over of [{aud:'other'},{gameId:'offline'},{issuedAt:f.h.now()-31000},{nonce:'x'},{action:'start',transitionId:'client-id'}]) assert.equal((await f.send(over)).statusCode,400);
 delete f.h.env.IAP_WORKER_SECRET;assert.equal((await f.send()).statusCode,503);
});
test('SEC-003 free-mode all, host and none are server policy; supplied invalid sessions never downgrade',async()=>{
 const f=await fixture();
 assert.equal((await f.send({session:''})).statusCode,401);
 f.h.env.IAP_SIGNIN='host';assert.equal((await f.send({session:'',action:'connect',role:'join',transitionId:'connect'})).statusCode,200);
 assert.equal((await f.send({session:''})).statusCode,401);
 delete f.h.env.IAP_SIGNIN;assert.equal((await f.send({session:''})).statusCode,200);
 assert.equal((await f.send({session:'invalid-session-0000'})).statusCode,401);
});
test('SEC-003 permission binds account, scope, nonce and a 30-second lifetime without disclosing session',async()=>{
 const f=await fixture(),r=await f.send();assert.equal(r.statusCode,200);
 const p=r.body.permission;assert.equal(p.expiresAt-p.issuedAt,30000);assert.match(p.subject,/^[a-f0-9]{64}$/);
 assert.equal(p.session,undefined);assert.equal(p.aud,'ezik-games-worker-v1');assert.equal(p.roomId,'a'.repeat(24));
 assert.equal(r.body.signature,crypto.createHmac('sha256',secret).update('permission-v1\n'+JSON.stringify(p)).digest('hex'));
 assert.equal((await f.send({subject:'b'.repeat(64)})).statusCode,403);
 assert.equal((await f.accounts.sessionState(f.session)).state,'live');
});
test('SEC-003 sales stay disabled while the server payment path rejects unpaid authoritative starts',async()=>{
 const f=await fixture();f.h.env.IAP_ENFORCE='all';
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,503);
 f.h.env.IAP_WORKER_SALES_VERSION='1';
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,402);
 assert.equal((await f.send({action:'connect',role:'join',transitionId:'connect'})).statusCode,200);
});
test('SEC-034 concurrent authoritative start retries debit once and cannot cross game or account',async()=>{
 const f=await fixture();f.h.env.IAP_ENFORCE='all';f.h.env.IAP_WORKER_SALES_VERSION='1';
 f.h.data.set(f.balance,{value:{credits:2},until:0});
 const over={action:'start',transitionId:'start:1'};
 const results=await Promise.all([f.send(over),f.send(over)]);
 assert.deepEqual(results.map(x=>x.statusCode),[200,200]);assert.equal(f.h.data.get(f.balance).value.credits,1);
 assert.equal(results[0].body.permission.receipt,results[1].body.permission.receipt);
 assert.equal((await f.send({...over,gameId:'board'})).statusCode,409);
 const other=await f.accounts.upsertAccount({provider:'apple',sub:'other-owner',email:'',emailVerified:false});
 const session=(await f.accounts.mintSession(other.key)).session;
 assert.equal((await f.send({...over,session})).statusCode,409);
 assert.equal((await f.send({...over,transitionId:'start:2'})).statusCode,200);
 assert.equal(f.h.data.get(f.balance).value.credits,0);
});
test('SEC-034 deletion and refund state deny the next start; an old receipt is not a new credit',async()=>{
 const f=await fixture();f.h.env.IAP_ENFORCE='all';f.h.env.IAP_WORKER_SALES_VERSION='1';
 f.h.data.set(f.balance,{value:{credits:1},until:0});
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,200);
 assert.equal((await f.send({action:'start',transitionId:'start:2'})).statusCode,402);
 await f.accounts.revokeSession(f.session);
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,401);
});
test('SEC-039 expired full receipts leave a durable spent marker and never charge again',async()=>{
 const f=await fixture();f.h.env.IAP_ENFORCE='all';f.h.env.IAP_WORKER_SALES_VERSION='1';
 f.h.data.set(f.balance,{value:{credits:2},until:0});
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,200);
 const full=[...f.h.data].find(([k])=>k.includes(':worker:receipt:'));
 const spent=[...f.h.data].find(([k])=>k.includes(':worker:spent:'));
 assert.equal(full[1].until-f.h.now(),30*86400000);assert.equal(spent[1].until,0);
 f.h.advance(30*86400000+1);
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,409);
 assert.equal(f.h.data.get(f.balance).value.credits,1);
});
test('SEC-003 store outage and deletion racing the authorization CAS fail closed',async()=>{
 const f=await fixture();f.h.faults.down=true;assert.equal((await f.send()).statusCode,503);f.h.faults.down=false;
 let removed=false;f.h.redis.beforeEval=async(script,keys)=>{if(!removed&&keys.includes(f.key)){removed=true;f.h.data.delete(f.key);}};
 assert.equal((await f.send()).statusCode,401);
});
test('SEC-034 a deletion at the debit boundary cannot issue permission or spend credit',async()=>{
 const f=await fixture();f.h.env.IAP_ENFORCE='all';f.h.env.IAP_WORKER_SALES_VERSION='1';
 f.h.data.set(f.balance,{value:{credits:2},until:0});
 let removed=false;f.h.redis.beforeEval=async(script,keys)=>{if(!removed&&keys.some(k=>k.includes(':worker:spent:'))){removed=true;f.h.data.delete(f.key);}};
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,401);
 assert.equal(f.h.data.get(f.balance).value.credits,2);
 assert.equal([...f.h.data.keys()].some(k=>k.includes(':worker:spent:')),false);
});
test('SEC-034 current pass/trial policy is server verified and refunded passes deny new transitions',async()=>{
 for(const type of ['pass','trial']){
  const f=await fixture();f.h.env.IAP_ENFORCE='all';f.h.env.IAP_WORKER_SALES_VERSION='1';
  f.h.data.set(f.balance,{value:{credits:0,...(type==='pass'?{subscriptionExpiresAt:f.h.now()+60000}:{trialStartedAt:f.h.now()})},until:0});
  const r=await f.send({action:'start',transitionId:'start:1'});assert.equal(r.statusCode,200);
  assert.equal(r.body.permission.mode,type==='pass'?'subscription':'trial');
  f.h.data.set(f.balance,{value:{credits:0,subscriptionExpiresAt:null,trialStartedAt:null},until:0});
  assert.equal((await f.send({action:'start',transitionId:'start:2'})).statusCode,402);
 }
});
test('SEC-020 worker permission uses the server-selected review ledger only',async()=>{
 const f=await fixture();f.h.env.IAP_ENFORCE='all';f.h.env.IAP_WORKER_SALES_VERSION='1';f.h.env.IAP_REVIEW_ACCOUNTS=f.key;
 f.h.data.set(f.balance,{value:{credits:9},until:0});
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,402);
 const review=f.balance.replace(':development:',':development:review:');f.h.data.set(review,{value:{credits:1},until:0});
 assert.equal((await f.send({action:'start',transitionId:'start:1'})).statusCode,200);
 assert.equal(f.h.data.get(review).value.credits,0);assert.equal(f.h.data.get(f.balance).value.credits,9);
});
