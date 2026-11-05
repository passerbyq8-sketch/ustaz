'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./security-auth-harness.cjs');
async function fixture(role=false) {
 const h=await harness(),account=await h.load('lib/auth/account.js');
 const a=await account.upsertAccount({provider:'apple',sub:'reauth-user',email:'reauth-owner',emailVerified:true});
 const one=await account.mintSession(a.key),two=await account.mintSession(a.key);
 if(role)h.env.EZIK_OWNER_ACCOUNTS=account.emailDigest('reauth-owner');
 return {h,account,key:a.key,one:one.session,two:two.session};
}
const begin=(f,action='account-delete',target)=>f.h.post('api/auth-challenge.js',{proofVersion:1,provider:'apple',transport:'native',purpose:'reauth',session:f.one,action,target});
async function finish(f,b,claims={}) {
 return f.h.post('api/auth-native.js',{provider:'apple',proofVersion:1,challenge:b.challenge,proof:b.proof,rawNonce:b.nonce,identityToken:f.h.sign({sub:'reauth-user',nonce:b.nonce,...claims}),session:f.one});
}
async function proof(f,action,target) {const b=await begin(f,action,target);assert.equal(b.statusCode,200);const done=await finish(f,b.body);assert.equal(done.statusCode,200);return done.body;}
test('SEC-013 switch-on sensitive actions demand recent proof and leave valid sessions intact',async()=>{
 const f=await fixture(true);f.h.env.AUTH_PROOF_VERSION='1';
 const deletion=await f.h.post('api/auth-delete.js',{session:f.one});assert.equal(deletion.statusCode,428);
 assert.equal(f.h.effects.erase,0);
 assert.equal((await f.h.post('api/roles-admin.js',{session:f.one,action:'grant',accountKey:f.key,sections:['articles']})).statusCode,428);
 assert.equal((await f.account.sessionState(f.one)).state,'live');assert.equal((await f.account.sessionState(f.two)).state,'live');
});
test('SEC-013 switch-off old clients keep the exact delete and roles behavior',async()=>{
 const f=await fixture(true);
 assert.equal((await f.h.post('api/roles-admin.js',{session:f.one,action:'grant',accountKey:f.key,sections:['articles']})).statusCode,200);
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one})).statusCode,200);
});
test('SEC-013 native recent provider proof authorizes one account deletion without minting another session',async()=>{
 for(const flag of [undefined,'1']) {
  const f=await fixture();f.h.env.AUTH_PROOF_VERSION=flag;
  const p=await proof(f);assert.equal(p.proofVersion,1);assert.equal(p.session,undefined);assert.equal(p.expiresAt-f.h.now(),300000);
  assert.equal(f.h.effects.weld,0);
  assert.equal([...f.h.data.keys()].filter(k=>k.startsWith('sess:v1:')).length,2);
  assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:p.reauthProof})).statusCode,200);
  assert.equal((await f.account.sessionState(f.two)).state,'dead');
 }
});
test('SEC-013 proof is scoped to the action, target and exact initiating session',async()=>{
 const f=await fixture(true);f.h.env.AUTH_PROOF_VERSION='1';
 const target=await f.account.upsertAccount({provider:'apple',sub:'target',email:'',emailVerified:false});
 const p=await proof(f,'roles-grant',{accountKey:target.key,sections:['articles']});
 const grant={session:f.one,action:'grant',accountKey:target.key,sections:['articles'],proofVersion:1,reauthProof:p.reauthProof};
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:p.reauthProof})).statusCode,403);
 assert.equal((await f.h.post('api/roles-admin.js',{...grant,accountKey:f.key})).statusCode,403);
 assert.equal((await f.h.post('api/roles-admin.js',{...grant,session:f.two})).statusCode,403);
 assert.equal((await f.h.post('api/roles-admin.js',{...grant,sections:['other']})).statusCode,403);
 assert.equal((await f.h.post('api/roles-admin.js',grant)).statusCode,200);
 assert.equal((await f.h.post('api/roles-admin.js',grant)).statusCode,403);
});
test('SEC-013 concurrent replay permits only one privileged mutation',async()=>{
 const f=await fixture(true);f.h.env.AUTH_PROOF_VERSION='1';
 const target=await f.account.upsertAccount({provider:'apple',sub:'target',email:'',emailVerified:false});
 const p=await proof(f,'roles-grant',{accountKey:target.key,sections:['articles']});
 const body={session:f.one,action:'grant',accountKey:target.key,sections:['articles'],proofVersion:1,reauthProof:p.reauthProof};
 await f.h.load('api/roles-admin.js');
 const r=await Promise.all([f.h.post('api/roles-admin.js',body),f.h.post('api/roles-admin.js',body)]);
 assert.equal(r.filter(x=>x.statusCode===200).length,1);assert.equal(r.filter(x=>x.statusCode===403).length,1);
});
test('SEC-013 expired proof/challenge recovers through a fresh provider flow while the session stays live',async()=>{
 const f=await fixture();f.h.env.AUTH_PROOF_VERSION='1';
 const p=await proof(f);f.h.advance(300001);
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:p.reauthProof})).statusCode,403);
 assert.equal((await f.account.sessionState(f.one)).state,'live');
 const stale=await begin(f);f.h.advance(600001);assert.equal((await finish(f,stale.body)).statusCode,400);
 assert.equal((await f.account.sessionState(f.one)).state,'live');
 const recovered=await proof(f);
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:recovered.reauthProof})).statusCode,200);
});
test('SEC-013 wrong account, old or missing issued-at claims and fabricated nonce cannot reauthenticate',async()=>{
 for(const claims of [{sub:'other-user'},{iat:1},{iat:undefined},{nonce:'unrelated'}]) {
  const f=await fixture();const b=await begin(f);assert.equal(b.statusCode,200);
  const done=await finish(f,b.body,claims);assert.equal(done.statusCode,403);
  assert.equal(done.body.reauthProof,undefined);assert.equal((await f.account.sessionState(f.one)).state,'live');
 }
});
test('SEC-013 wrong provider and unknown actions cannot prepare a sensitive-operation challenge',async()=>{
 const f=await fixture();
 assert.equal((await f.h.post('api/auth-challenge.js',{proofVersion:1,provider:'google',transport:'redirect',purpose:'reauth',session:f.one,action:'account-delete'})).statusCode,403);
 assert.equal((await begin(f,'unknown')).statusCode,400);
});
test('SEC-013 outages are truthful and recovery never requires signing out',async()=>{
 const f=await fixture();f.h.env.AUTH_PROOF_VERSION='1';
 f.h.faults.down=true;assert.equal((await begin(f)).statusCode,503);f.h.faults.down=false;
 const p=await proof(f);
 f.h.faults.eval=true;
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:p.reauthProof})).statusCode,503);
 f.h.faults.eval=false;assert.equal((await f.account.sessionState(f.one)).state,'live');
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:p.reauthProof})).statusCode,200);
});
test('SEC-013 deletion/recreation invalidates prepared challenges and already-issued proof',async()=>{
 const f=await fixture();const b=await begin(f),p=await proof(f);
 await f.account.deleteAccount(f.key,f.two);
 await f.account.upsertAccount({provider:'apple',sub:'reauth-user',email:'reauth-owner',emailVerified:true});
 const fresh=await f.account.mintSession(f.key);f.one=fresh.session;
 assert.equal((await finish(f,b.body)).statusCode,403);
 f.h.env.AUTH_PROOF_VERSION='1';
 assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:p.reauthProof})).statusCode,403);
 assert.equal((await f.account.sessionState(f.one)).state,'live');
});
async function call(h,file,query) {
 const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}};
 await (await h.load(file)).default({method:'GET',query,headers:{'x-murabbi-device':'synthetic-device'}},res);return res;
}
async function webStart(f) {
 f.h.env.APPLE_OAUTH_CLIENT_ID='test-client';f.h.env.APPLE_OAUTH_CLIENT_SECRET='test';
 const b=await f.h.post('api/auth-challenge.js',{proofVersion:1,provider:'apple',transport:'redirect',purpose:'reauth',session:f.one,action:'account-delete'});
 assert.equal(b.statusCode,200);
 const start=await call(f.h,'api/auth-start.js',{provider:'apple',pv:'1',challenge:b.body.challenge,web:'1',cs:'reauth-cs'});
 assert.equal(start.statusCode,302);return {b:b.body,u:new URL(start.headers.location)};
}
test('SEC-013 browser callback and exchange produce only recent scoped proof, preserving the session',async()=>{
 for(const flag of [undefined,'1']) {
  const f=await fixture();f.h.env.AUTH_PROOF_VERSION=flag;
  const {b,u}=await webStart(f);
  f.h.http.idToken=f.h.sign({sub:'reauth-user',aud:'test-client',nonce:u.searchParams.get('nonce')});
  const returned=await call(f.h,'api/auth-return.js',{state:u.searchParams.get('state'),code:'test-code'});
  const handoff=new URL(returned.headers.location);assert.equal(handoff.searchParams.get('state'),'reauth-cs');
  assert.ok(!returned.headers.location.includes(b.proof));
  const exchanged=await f.h.post('api/auth-exchange.js',{ticket:handoff.searchParams.get('ticket'),proofVersion:1,proof:b.proof,session:f.one});
  assert.equal(exchanged.statusCode,200);assert.equal(exchanged.body.session,undefined);assert.ok(exchanged.body.reauthProof);
  assert.equal(f.h.effects.weld,0);
  assert.equal((await f.account.sessionState(f.one)).state,'live');
  assert.equal((await f.h.post('api/auth-delete.js',{session:f.one,proofVersion:1,reauthProof:exchanged.body.reauthProof})).statusCode,200);
 }
});
test('SEC-013 cancellation and wrong-account browser callbacks recover without deleting or replacing sessions',async()=>{
 const f=await fixture();f.h.env.AUTH_PROOF_VERSION='1';
 let start=await webStart(f);
 const denied=await call(f.h,'api/auth-return.js',{state:start.u.searchParams.get('state'),error:'access_denied'});
 assert.equal(new URL(denied.headers.location).searchParams.get('error'),'auth-provider-denied');
 start=await webStart(f);
 f.h.http.idToken=f.h.sign({sub:'other-user',aud:'test-client',nonce:start.u.searchParams.get('nonce')});
 const wrong=await call(f.h,'api/auth-return.js',{state:start.u.searchParams.get('state'),code:'test-code'});
 assert.equal(new URL(wrong.headers.location).searchParams.get('error'),'auth-reauth-invalid');
 assert.equal(f.h.data.has('acct:v1:apple:other-user'),false);
 assert.equal((await f.account.sessionState(f.one)).state,'live');assert.equal((await f.account.sessionState(f.two)).state,'live');
 const p=await proof(f);assert.ok(p.reauthProof);
});
test('SEC-013 revoke requires its own scoped proof and preserves environment root grants',async()=>{
 const f=await fixture(true);f.h.env.AUTH_PROOF_VERSION='1';
 const target=await f.account.upsertAccount({provider:'apple',sub:'target',email:'',emailVerified:false});
 const roles=await f.h.load('lib/articles/roles.js');await roles.grantRole(target.key,['articles'],{role:'owner',accountKey:f.key});
 const p=await proof(f,'roles-revoke',{accountKey:target.key});
 assert.equal((await f.h.post('api/roles-admin.js',{session:f.one,action:'revoke',accountKey:target.key,proofVersion:1,reauthProof:p.reauthProof})).statusCode,200);
 assert.equal((await roles.roleFor(target.key)).role,'none');assert.equal((await roles.roleFor(f.key)).role,'owner');
});
test('SEC-013 account revocation racing proof consumption wins before a privileged mutation',async()=>{
 const f=await fixture(true);f.h.env.AUTH_PROOF_VERSION='1';
 const target=await f.account.upsertAccount({provider:'apple',sub:'target',email:'',emailVerified:false});
 const p=await proof(f,'roles-grant',{accountKey:target.key,sections:['articles']});
 let pause,release;const paused=new Promise(r=>pause=r),resume=new Promise(r=>release=r);
 f.h.redis.beforeEval=async(_script,keys)=>{if(keys.some(k=>k.startsWith('auth:reauth:v1:'))){f.h.redis.beforeEval=null;pause();await resume;}};
 const grant=f.h.post('api/roles-admin.js',{session:f.one,action:'grant',accountKey:target.key,sections:['articles'],proofVersion:1,reauthProof:p.reauthProof});
 let timer;
 try {
  await Promise.race([paused,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('proof consume was not reached')),1000);})]);
  await f.account.deleteAccount(f.key,f.two);
 } finally {clearTimeout(timer);release();}
 assert.equal((await grant).statusCode,403);
 assert.equal((await (await f.h.load('lib/articles/roles.js')).roleFor(target.key)).role,'none');
});
test('SEC-013 a proof-store outage denies the mutation and its recovered retry succeeds once',async()=>{
 const f=await fixture(true);f.h.env.AUTH_PROOF_VERSION='1';
 const target=await f.account.upsertAccount({provider:'apple',sub:'target',email:'',emailVerified:false});
 const p=await proof(f,'roles-grant',{accountKey:target.key,sections:['articles']});
 const body={session:f.one,action:'grant',accountKey:target.key,sections:['articles'],proofVersion:1,reauthProof:p.reauthProof};
 const original=f.h.redis.eval;f.h.redis.eval=async(script,keys,args)=>{if(keys.some(k=>k.startsWith('auth:reauth:v1:')))throw Error('synthetic outage');return original(script,keys,args);};
 assert.equal((await f.h.post('api/roles-admin.js',body)).statusCode,503);
 f.h.redis.eval=original;
 assert.equal((await f.account.sessionState(f.one)).state,'live');
 assert.equal((await f.h.post('api/roles-admin.js',body)).statusCode,200);
});
test('SEC-013 failed sensitive operation requires fresh proof on retry and never logs out the account',async()=>{
 const f=await fixture();f.h.env.AUTH_PROOF_VERSION='1';const p=await proof(f);
 const body={session:f.one,proofVersion:1,reauthProof:p.reauthProof};f.h.faults.erase=true;
 assert.equal((await f.h.post('api/auth-delete.js',body)).statusCode,503);
 assert.equal((await f.account.sessionState(f.one)).state,'live');f.h.faults.erase=false;
 assert.equal((await f.h.post('api/auth-delete.js',body)).statusCode,403);
 const fresh=await proof(f);
 assert.equal((await f.h.post('api/auth-delete.js',{...body,reauthProof:fresh.reauthProof})).statusCode,200);
});
