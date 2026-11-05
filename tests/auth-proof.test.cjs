'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { harness } = require('./security-auth-harness.cjs');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const secret = () => crypto.randomBytes(32).toString('base64url');
async function call(h, file, { method = 'POST', body = {}, query = {}, headers = {} } = {}) {
  const route = (await h.load(file)).default;
  const res = { statusCode: 0, headers: {}, setHeader(k,v) { this.headers[k.toLowerCase()] = v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; }, end() { return this; } };
  await route({method,body,query,headers:{'x-murabbi-device':'synthetic-device',...headers}},res);
  return res;
}
async function ticket(h, binding) {
  const a = await h.load('lib/auth/account.js'), s = await h.load('lib/auth/store.js');
  const account = await a.upsertAccount({provider:'google',sub:'proof-user',email:'',emailVerified:false});
  const id = secret();
  await s.writeJson(s.ticketKey(id), {v:1,accountKey:account.key,generation:account.generation,deviceId:'',createdAt:h.now(),...(binding ? {proof:binding} : {})},60);
  return id;
}
test('SEC-008 a server-bound ticket cannot be exchanged with missing or wrong proof, even while enforcement is off', async () => {
  for (const proof of [undefined, secret()]) {
    const h=await harness(), valid=secret();
    const id=await ticket(h,{v:1,digest:digest(valid),expiresAt:h.now()+600000,purpose:'signin'});
    const r=await h.post('api/auth-exchange.js',{ticket:id,proofVersion:1,proof});
    assert.equal(r.statusCode,403);
    assert.equal([...h.data.keys()].filter(k=>k.startsWith('sess:v1:')).length,0);
  }
});
test('SEC-008 exact server switch rejects legacy tickets without invalidating existing sessions', async () => {
  const h=await harness(), id=await ticket(h), a=await h.load('lib/auth/account.js');
  const active=await a.mintSession('acct:v1:google:proof-user');
  h.env.AUTH_PROOF_VERSION='1';
  assert.equal((await h.post('api/auth-exchange.js',{ticket:id})).statusCode,428);
  assert.equal((await a.sessionState(active.session)).state,'live');
});
test('SEC-008 absent and unsupported switches preserve old clients and the 400-day sliding lifetime', async () => {
  for (const flag of [undefined,'0','true','2']) {
    const h=await harness(); if(flag!==undefined)h.env.AUTH_PROOF_VERSION=flag;
    const r=await h.post('api/auth-exchange.js',{ticket:await ticket(h)});
    assert.equal(r.statusCode,200);
    assert.deepEqual(Object.keys(r.body).sort(),['email','ok','provider','session']);
    h.advance(300*86400000);
    const state=await (await h.load('lib/auth/account.js')).sessionState(r.body.session);
    assert.equal(state.state,'live'); assert.equal(state.record.expiresAt-h.now(),400*86400000);
  }
});
test('SEC-008 correct proof is single-use, including concurrent exchange and explicit expiry', async () => {
  for(const flag of [undefined,'1']) {
    const h=await harness();h.env.AUTH_PROOF_VERSION=flag;
    const proof=secret(), binding={v:1,digest:digest(proof),expiresAt:h.now()+600000,purpose:'signin'};
    const id=await ticket(h,binding);await h.load('api/auth-exchange.js');
    const result=await Promise.all([h.post('api/auth-exchange.js',{ticket:id,proofVersion:1,proof}),h.post('api/auth-exchange.js',{ticket:id,proofVersion:1,proof})]);
    assert.equal(result.filter(r=>r.statusCode===200).length,1);
    assert.equal(result.filter(r=>r.statusCode===400).length,1);
    const expired=await ticket(h,{...binding,expiresAt:h.now()-1});
    assert.equal((await h.post('api/auth-exchange.js',{ticket:expired,proofVersion:1,proof})).statusCode,403);
    const id2=await ticket(h,binding);h.advance(60001);
    assert.equal((await h.post('api/auth-exchange.js',{ticket:id2,proofVersion:1,proof})).statusCode,400);
  }
});
test('SEC-008 challenge is unpredictable, stored as a digest, and consumed once before redirect', async () => {
  const h=await harness();h.env.GOOGLE_OAUTH_CLIENT_ID='test-client';h.env.GOOGLE_OAUTH_CLIENT_SECRET='test';
  const issue=()=>h.post('api/auth-challenge.js',{proofVersion:1,provider:'google',transport:'redirect'});
  const one=await issue(),two=await issue();assert.equal(one.statusCode,200);assert.equal(two.statusCode,200);
  assert.match(one.body.proof,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(one.body.proof,two.body.proof);assert.notEqual(one.body.challenge,two.body.challenge);
  assert.ok(!JSON.stringify([...h.data]).includes(one.body.proof));
  const start=()=>call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'1',challenge:one.body.challenge,web:'1',cs:'client-state'}});
  const result=await start();assert.equal(result.statusCode,302);
  assert.ok(!result.headers.location.includes(one.body.proof));
  assert.equal((await start()).statusCode,400);
  const state=new URL(result.headers.location).searchParams.get('state');
  const record=await (await h.load('lib/auth/store.js')).readJson('auth:state:v1:'+state);
  assert.equal(record.proof.digest,digest(one.body.proof));assert.equal(record.web,true);
  h.advance(600001);
  assert.equal((await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'1',challenge:two.body.challenge}})).statusCode,400);
});
test('SEC-008 issuance and challenge read outages are 503; recovery creates a fresh flow', async () => {
  const h=await harness();h.env.GOOGLE_OAUTH_CLIENT_ID='test-client';h.env.GOOGLE_OAUTH_CLIENT_SECRET='test';
  h.faults.set=true;
  assert.equal((await h.post('api/auth-challenge.js',{proofVersion:1,provider:'google',transport:'redirect'})).statusCode,503);
  h.faults.set=false;
  const issued=await h.post('api/auth-challenge.js',{proofVersion:1,provider:'google',transport:'redirect'});
  h.faults.eval=true;
  assert.equal((await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'1',challenge:issued.body.challenge}})).statusCode,503);
  h.faults.eval=false;
  assert.equal((await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'1',challenge:issued.body.challenge}})).statusCode,302);
});
test('SEC-008 native opt-in uses the server nonce; old native clients work only while the switch is off', async () => {
  for(const flag of [undefined,'1']) {
    const h=await harness();h.env.AUTH_PROOF_VERSION=flag;
    const old=await h.post('api/auth-native.js',{provider:'apple',identityToken:h.sign(),rawNonce:h.nonce});
    assert.equal(old.statusCode,flag==='1'?428:200);
    const issued=await h.post('api/auth-challenge.js',{proofVersion:1,provider:'apple',transport:'native'});
    assert.equal(issued.statusCode,200);
    const b=issued.body;
    const body={provider:'apple',identityToken:h.sign({nonce:b.nonce}),rawNonce:b.nonce,proofVersion:1,challenge:b.challenge,proof:b.proof};
    assert.equal((await h.post('api/auth-native.js',body)).statusCode,200);
    assert.equal((await h.post('api/auth-native.js',body)).statusCode,400);
  }
});
test('SEC-008 real redirect callback preserves the secret binding and never includes proof in a URL', async () => {
  for(const flag of [undefined,'1']) {
    const h=await harness();h.env.AUTH_PROOF_VERSION=flag;
    h.env.GOOGLE_OAUTH_CLIENT_ID='test-client';h.env.GOOGLE_OAUTH_CLIENT_SECRET='test';
    const issued=await h.post('api/auth-challenge.js',{proofVersion:1,provider:'google',transport:'redirect'});
    const b=issued.body;
    const start=await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'1',challenge:b.challenge,web:'1',cs:'client-state'}});
    const u=new URL(start.headers.location);
    h.http.idToken=h.sign({iss:'https://accounts.google.com',aud:'test-client',nonce:u.searchParams.get('nonce')});
    const returned=await call(h,'api/auth-return.js',{method:'GET',query:{state:u.searchParams.get('state'),code:'test-code'}});
    const handoff=new URL(returned.headers.location);assert.equal(handoff.origin,'https://ezik.app');
    assert.equal(handoff.searchParams.get('state'),'client-state');assert.ok(handoff.searchParams.get('ticket'));
    assert.ok(!returned.headers.location.includes(b.proof));
    assert.ok(!JSON.stringify([...h.data]).includes(b.proof));
    assert.equal((await h.post('api/auth-exchange.js',{ticket:handoff.searchParams.get('ticket'),proofVersion:1,proof:b.proof})).statusCode,200);
    assert.equal(h.http.calls.length,2);assert.equal(h.logs.length,0);
  }
});
test('SEC-008 switch-on start requires proof setup; wrong provider/transport/version cannot start a flow', async () => {
  const h=await harness();h.env.GOOGLE_OAUTH_CLIENT_ID='test-client';h.env.GOOGLE_OAUTH_CLIENT_SECRET='test';h.env.AUTH_PROOF_VERSION='1';
  assert.equal((await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google'}})).statusCode,428);
  assert.equal((await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'2',challenge:secret()}})).statusCode,400);
  const wrong=await h.post('api/auth-challenge.js',{proofVersion:1,provider:'apple',transport:'native'});
  assert.equal((await call(h,'api/auth-start.js',{method:'GET',query:{provider:'google',pv:'1',challenge:wrong.body.challenge}})).statusCode,400);
  for(const body of [{proofVersion:2,provider:'google',transport:'redirect'}, {proofVersion:1,provider:'constructor',transport:'redirect'}, {proofVersion:1,provider:'google',transport:'native'}]) {
    assert.equal((await h.post('api/auth-challenge.js',body)).statusCode,400);
  }
});
test('SEC-008 bad native proof or provider nonce never mints, and the initiating client can restart', async () => {
  const h=await harness();
  for(const wrong of ['proof','nonce']) {
    const b=(await h.post('api/auth-challenge.js',{proofVersion:1,provider:'apple',transport:'native'})).body;
    const nonce=wrong==='nonce'?secret():b.nonce;
    assert.equal((await h.post('api/auth-native.js',{provider:'apple',proofVersion:1,challenge:b.challenge,proof:wrong==='proof'?secret():b.proof,rawNonce:nonce,identityToken:h.sign({nonce})})).statusCode,403);
  }
  assert.equal([...h.data.keys()].filter(k=>k.startsWith('sess:v1:')).length,0);
  const b=(await h.post('api/auth-challenge.js',{proofVersion:1,provider:'apple',transport:'native'})).body;
  assert.equal((await h.post('api/auth-native.js',{provider:'apple',proofVersion:1,challenge:b.challenge,proof:b.proof,rawNonce:b.nonce,identityToken:h.sign({nonce:b.nonce})})).statusCode,200);
});
