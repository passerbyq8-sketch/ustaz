'use strict';
// node --experimental-vm-modules --no-warnings --test tests/auth-native-replay.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { harness } = require('./security-auth-harness.cjs');
const route = 'api/auth-native.js';
const login = (h, token) => h.post(route, { provider: 'apple', identityToken: token, rawNonce: h.nonce });
const sessions = h => [...h.data.keys()].filter(key => key.startsWith('sess:v1:'));

test('one signed token can mint only one session, including concurrent redemptions', async () => {
  const h = await harness(), token = h.sign();
  await h.load(route);
  const results = await Promise.all([login(h, token), login(h, token)]);
  assert.equal(results.filter(r => r.statusCode === 200).length, 1);
  assert.equal(results.filter(r => r.statusCode === 409).length, 1);
  assert.equal((await login(h, token)).statusCode, 409);
  assert.equal(sessions(h).length, 1);
  const account = await h.load('lib/auth/account.js');
  assert.equal((await account.sessionState(results.find(r => r.statusCode === 200).body.session)).state, 'live');
});

test('a replay marker failure returns 503 before any account or session write', async () => {
  const h = await harness();
  const original = h.redis.set;
  h.redis.set = async (key, ...args) => {
    if (key.startsWith('auth:')) throw Error('synthetic outage');
    return original(key, ...args);
  };
  assert.equal((await login(h, h.sign())).statusCode, 503);
  assert.equal([...h.data.keys()].filter(key => key.startsWith('acct:') || key.startsWith('sess:')).length, 0);
});

test('alternate base64 spelling of the same signature cannot bypass replay tracking', async () => {
  const h = await harness(), token = h.sign();
  assert.equal((await login(h, token)).statusCode, 200);
  assert.equal((await login(h, token + '=')).statusCode, 409);
  assert.equal(sessions(h).length, 1);
});

test('the digest marker lasts through token expiry and a fresh provider token still works', async () => {
  const h = await harness(), token = h.sign();
  assert.equal((await login(h, token)).statusCode, 200);
  const marker = h.operations.find(op => op.opts.nx && op.key.startsWith('auth:'));
  assert.ok(marker, 'atomic replay marker missing');
  assert.ok(marker.opts.ex >= 600 && marker.opts.ex <= 601);
  assert.match(marker.key, /^auth:native-used:v1:[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify([...h.data.entries()]).includes(token));
  h.advance(599000);
  assert.equal((await login(h, token)).statusCode, 409);
  assert.equal((await login(h, h.sign())).statusCode, 200);
  h.advance(2000);
  assert.equal((await login(h, token)).statusCode, 401);
});

test('issuer, audience, nonce, signature and expiry failures never reserve or mint', async () => {
  for (const claims of [{ iss: 'https://invalid.example' }, { aud: 'invalid' }, { nonce: 'invalid' }, { exp: 0 }]) {
    const h = await harness();
    assert.equal((await login(h, h.sign(claims))).statusCode, 401);
    assert.equal(h.operations.filter(op => op.opts.nx).length, 0);
    assert.equal(sessions(h).length, 0);
  }
  const h = await harness();
  const foreign = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.equal((await login(h, h.sign({}, foreign.privateKey))).statusCode, 401);
  assert.equal(sessions(h).length, 0);
  assert.equal(h.logs.length, 0);
});
