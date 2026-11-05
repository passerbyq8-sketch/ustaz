'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./security-auth-harness.cjs');
const CS = 'initiating_client_state';
const TOKEN = 'https://oauth2.googleapis.com/token';
const KEYS = 'https://www.googleapis.com/oauth2/v3/certs';
const plain = value => JSON.parse(JSON.stringify(value));
async function call(h, file, query = {}, { method = 'GET', body = {} } = {}) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = plain(v); return this; }, end() { return this; } };
  await (await h.load(file)).default({ method, query, body, headers: { host: 'untrusted.invalid', 'x-forwarded-host': 'untrusted.invalid' } }, res);
  return res;
}
async function setup(flag) {
  if (arguments.length === 0) flag = '1';
  const h = await harness(); h.env.AUTH_PROOF_VERSION = flag;
  h.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client'; h.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test';
  h.env.APPLE_OAUTH_CLIENT_ID = 'apple-web'; h.env.APPLE_OAUTH_CLIENT_SECRET = 'test';
  return h;
}
function completed(res, error, { web = false, state = CS } = {}) {
  assert.equal(res.statusCode, 302);
  assert.equal(res.body, undefined);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  const url = new URL(res.headers.location);
  assert.equal(url.href.split('?')[0], web ? 'https://ezik.app/' : 'ezik://auth/return');
  assert.deepEqual([...url.searchParams.keys()].sort(), state ? ['error', 'state'] : ['error']);
  assert.equal(url.searchParams.get('error'), error);
  assert.equal(url.searchParams.get('state'), state || null);
}
async function begin(h, { provider = 'google', web = false, reauth = false } = {}) {
  const a = await h.load('lib/auth/account.js');
  const account = await a.upsertAccount({ provider, sub: 'original-user', email: '', emailVerified: false });
  const active = await a.mintSession(account.key);
  const challenge = await h.post('api/auth-challenge.js', { proofVersion: 1, provider, transport: 'redirect', ...(reauth ? { purpose: 'reauth', session: active.session, action: 'account-delete' } : {}) });
  assert.equal(challenge.statusCode, 200);
  const b = challenge.body;
  const start = await call(h, 'api/auth-start.js', { provider, pv: '1', challenge: b.challenge, cs: CS, ...(web ? { web: '1' } : {}) });
  assert.equal(start.statusCode, 302);
  const url = new URL(start.headers.location), state = url.searchParams.get('state');
  h.http.idToken = h.sign({ iss: provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com', aud: provider === 'google' ? 'test-client' : 'apple-web', nonce: url.searchParams.get('nonce'), sub: 'original-user' });
  return { b, state, nonce: url.searchParams.get('nonce'), session: active.session, account: account.key };
}
const startCases = [
  { name: 'legacy client needs proof', code: 'auth-proof-required', status: 428, query: {} },
  { name: 'unknown provider', code: 'auth-provider-unknown', status: 400, query: { provider: 'untrusted-provider' }, provider: 'untrusted-provider' },
  { name: 'provider configuration missing', code: 'auth-provider-unconfigured', status: 503, query: {}, change: h => { delete h.env.GOOGLE_OAUTH_CLIENT_SECRET; }, provider: 'google' },
  { name: 'bad version', code: 'auth-proof-version', status: 400, query: { pv: '2' }, proof: true },
  { name: 'missing challenge', code: 'auth-challenge-invalid', status: 400, query: { pv: '1' }, proof: true },
  { name: 'missing version', code: 'auth-proof-version', status: 400, query: { challenge: 'a'.repeat(43) }, proof: true },
  { name: 'unknown challenge', code: 'auth-challenge-invalid', status: 400, query: { pv: '1', challenge: 'a'.repeat(43) }, proof: true },
  { name: 'challenge store outage', code: 'auth-proof-unavailable', status: 503, query: { pv: '1', challenge: 'a'.repeat(43) }, change: h => { h.faults.eval = true; }, proof: true },
  { name: 'admission refusal', code: 'auth-rate-limited', status: 429, query: {}, change: h => { h.faults.rate = true; } },
];
for (const row of startCases) {
  test('SEC-008 ON start completes ' + row.name + ' for shell and web without side effects', async () => {
    for (const web of [false, true]) {
      const h = await setup(); if (row.change) row.change(h);
      const res = await call(h, 'api/auth-start.js', { provider: 'google', cs: CS, ...row.query, ...(web ? { web: '1' } : {}), returnUrl: 'https://untrusted.invalid/', error: 'private-provider-text' });
      completed(res, row.code, { web });
      assert.equal(h.data.size, 0); assert.equal(h.http.calls.length, 0); assert.equal(h.logs.length, 0);
    }
  });
}
test('SEC-008 OFF keeps every existing early error body status and cache header unchanged', async () => {
  for (const flag of [undefined, '', '0', '2', 'true']) {
    for (const row of startCases.filter(r => r.status !== 428)) {
      const h = await setup(flag); if (row.change) row.change(h);
      const res = await call(h, 'api/auth-start.js', { provider: 'google', cs: CS, ...row.query });
      assert.equal(res.statusCode, row.status, row.name);
      assert.deepEqual(res.body, { ok: false, error: row.code, ...(row.provider !== undefined ? { provider: row.provider } : {}), ...(row.proof ? { proofVersion: 1, recovery: 'restart-auth-challenge' } : {}) });
      assert.deepEqual(res.headers, row.proof ? { 'cache-control': 'private, no-store' } : {});
    }
  }
});
test('SEC-008 OFF old redirect client retains provider start and OAuth-state schema', async () => {
  const h = await setup('0');
  const res = await call(h, 'api/auth-start.js', { provider: 'google', cs: CS, web: '1', device: 'synthetic-device' });
  const url = new URL(res.headers.location);
  assert.equal(res.statusCode, 302); assert.equal(url.origin, 'https://accounts.google.com');
  const record = (await h.load('lib/auth/store.js')).readJson('auth:state:v1:' + url.searchParams.get('state'));
  assert.deepEqual(Object.keys(await record).sort(), ['clientState', 'codeVerifier', 'createdAt', 'deviceId', 'nonce', 'provider', 'v', 'web']);
});
test('SEC-008 ON start needs a scalar safe cs for completion; method errors remain JSON', async () => {
  for (const cs of [undefined, '', 'bad state', 'a'.repeat(129), [CS], [CS, 'other']]) {
    const h = await setup(), res = await call(h, 'api/auth-start.js', { provider: 'google', cs });
    assert.equal(res.statusCode, 428); assert.equal(res.body.error, 'auth-proof-required');
    assert.equal(res.headers.location, undefined);
  }
  const h = await setup();
  assert.equal((await call(h, 'api/auth-start.js', { cs: CS }, { method: 'OPTIONS' })).statusCode, 204);
  const badMethod = await call(h, 'api/auth-start.js', { cs: CS }, { method: 'POST' });
  assert.equal(badMethod.statusCode, 405); assert.deepEqual(badMethod.body, { ok: false, error: 'method-not-allowed' });
});
test('SEC-008 ON start completes consumed expired and mismatched challenges and state-write outage; fresh recovery works', async () => {
  for (const kind of ['consumed', 'expired', 'provider', 'transport', 'state-write']) {
    const h = await setup();
    const issue = await h.post('api/auth-challenge.js', { proofVersion: 1, provider: kind === 'provider' || kind === 'transport' ? 'apple' : 'google', transport: kind === 'transport' ? 'native' : 'redirect' });
    const query = { provider: kind === 'transport' ? 'apple' : 'google', cs: CS, pv: '1', challenge: issue.body.challenge };
    if (kind === 'consumed') await call(h, 'api/auth-start.js', query);
    if (kind === 'expired') h.advance(600001);
    if (kind === 'state-write') h.faults.set = true;
    completed(await call(h, 'api/auth-start.js', query), kind === 'state-write' ? 'auth-store-unavailable' : 'auth-challenge-invalid');
    h.faults.set = false;
    const fresh = await begin(h);
    assert.ok(fresh.state); assert.notEqual(fresh.b.challenge, issue.body.challenge);
  }
  const h = await setup('0'); h.faults.set = true;
  const legacy = await call(h, 'api/auth-start.js', { provider: 'google', cs: CS });
  assert.equal(legacy.statusCode, 503); assert.deepEqual(legacy.body, { ok: false, error: 'auth-store-unavailable' });
  assert.deepEqual(legacy.headers, {});
});

const response = (status, body) => ({ ok: status === 200, status, json: async () => body });
const callbackCases = [
  { name: 'denial', code: 'auth-provider-denied', query: { error: 'secret-provider-error' } },
  { name: 'missing code', code: 'auth-code-missing', query: { code: '' } },
  { name: 'expired challenge', code: 'auth-challenge-invalid', change: (h, f) => { h.data.get('auth:state:v1:' + f.state).value.proof.expiresAt = h.now(); } },
  { name: 'missing provider config', code: 'auth-provider-unconfigured', change: h => { delete h.env.GOOGLE_OAUTH_CLIENT_SECRET; } },
  { name: 'unknown recorded provider', code: 'auth-provider-unknown', change: (h, f) => { h.data.get('auth:state:v1:' + f.state).value.provider = 'unknown'; } },
  { name: 'token outage', code: 'auth-token-unreachable', change: h => h.http.responses.set(TOKEN, Error('private outage text')) },
  { name: 'token refusal', code: 'auth-token-refused', change: h => h.http.responses.set(TOKEN, response(400, {})) },
  { name: 'token invalid JSON', code: 'auth-token-unreadable', change: h => h.http.responses.set(TOKEN, { ok: true, status: 200, json: async () => { throw Error('bad JSON'); } }) },
  { name: 'token missing assertion', code: 'auth-token-no-id-token', change: h => h.http.responses.set(TOKEN, response(200, {})) },
  { name: 'JWKS outage', code: 'auth-jwks-unreachable', change: h => h.http.responses.set(KEYS, Error('private JWKS outage')) },
  { name: 'JWKS refusal', code: 'auth-jwks-refused', change: h => h.http.responses.set(KEYS, response(503, {})) },
  { name: 'JWKS invalid JSON', code: 'auth-jwks-unreadable', change: h => h.http.responses.set(KEYS, { ok: true, status: 200, json: async () => { throw Error('bad JSON'); } }) },
  { name: 'JWKS empty', code: 'auth-jwks-empty', change: h => h.http.responses.set(KEYS, response(200, { keys: [] })) },
  { name: 'invalid assertion', code: 'auth-idtoken-malformed', change: h => { h.http.idToken = 'malformed'; } },
  { name: 'unapproved algorithm', code: 'auth-idtoken-alg', change: h => { const parts = h.http.idToken.split('.'); parts[0] = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'); h.http.idToken = parts.join('.'); } },
  { name: 'unknown signing key', code: 'auth-idtoken-unknown-key', change: h => { const parts = h.http.idToken.split('.'); parts[0] = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'unknown' })).toString('base64url'); h.http.idToken = parts.join('.'); } },
  { name: 'invalid signature', code: 'auth-idtoken-signature', change: h => { const parts = h.http.idToken.split('.'); parts[2] = Buffer.alloc(256).toString('base64url'); h.http.idToken = parts.join('.'); } },
  { name: 'wrong issuer', code: 'auth-idtoken-issuer', change: (h, f) => { h.http.idToken = h.sign({ iss: 'untrusted', aud: 'test-client', nonce: f.nonce }); } },
  { name: 'wrong audience', code: 'auth-idtoken-audience', change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'untrusted', nonce: f.nonce }); } },
  { name: 'expired assertion', code: 'auth-idtoken-expired', change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: f.nonce, exp: Math.floor(h.now() / 1000) }); } },
  { name: 'future assertion', code: 'auth-idtoken-issued-ahead', change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: f.nonce, iat: Math.floor(h.now() / 1000) + 121 }); } },
  { name: 'missing subject', code: 'auth-idtoken-no-subject', change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: f.nonce, sub: '' }); } },
  { name: 'wrong nonce', code: 'auth-idtoken-nonce', change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: 'wrong', sub: 'original-user' }); } },
  { name: 'stale reauth assertion', code: 'auth-idtoken-not-recent', reauth: true, change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: f.nonce, sub: 'original-user', iat: Math.floor(h.now() / 1000) - 600 }); } },
  { name: 'wrong reauth account', code: 'auth-reauth-invalid', reauth: true, change: (h, f) => { h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: f.nonce, sub: 'different-user' }); } },
  { name: 'account write outage', code: 'auth-account-unwritable', change: h => { h.redis.beforeEval = async (script) => { if (script.includes('auth-cas-v1')) throw Error('account write unavailable'); }; } },
  { name: 'ticket write outage', code: 'auth-store-unavailable', reauth: true, change: h => { h.faults.set = true; } },
  { name: 'admission refusal', code: 'auth-rate-limited', onlyOn: true, change: h => { h.faults.rate = true; } },
];
for (const row of callbackCases) {
  test('SEC-008 callback completes ' + row.name + ' with initiating cs and preserves the original session', async () => {
    for (const flag of row.onlyOn ? ['1'] : ['0', '1']) {
      for (const web of [false, true]) {
        const h = await setup(flag), flow = await begin(h, { web, reauth: row.reauth });
        if (row.change) row.change(h, flow);
        const query = { state: flow.state, code: 'synthetic-code', ...row.query, cs: 'untrusted-state', web: web ? '0' : '1' };
        completed(await call(h, 'api/auth-return.js', query), row.code, { web });
        assert.equal(h.data.has('auth:state:v1:' + flow.state), false);
        assert.equal([...h.data.keys()].filter(k => k.startsWith('auth:ticket:')).length, 0);
        h.faults.set = false; h.faults.rate = false; h.redis.beforeEval = null;
        assert.equal((await (await h.load('lib/auth/account.js')).sessionState(flow.session)).state, 'live');
        assert.equal(h.logs.length, 0);
        if (row.onlyOn) assert.equal(h.http.calls.length, 0);
      }
    }
  });
}
test('SEC-008 missing lost expired replayed and unavailable callback state never claims an initiating cs', async () => {
  for (const kind of ['missing', 'unknown', 'expired', 'replayed', 'unavailable']) {
    const h = await setup(), flow = await begin(h, { web: true });
    let state = flow.state;
    if (kind === 'missing') state = undefined;
    if (kind === 'unknown') state = 'foreign-state';
    if (kind === 'expired') h.advance(600001);
    if (kind === 'replayed') await call(h, 'api/auth-return.js', { state, error: 'denied' });
    if (kind === 'unavailable') h.faults.eval = true;
    completed(await call(h, 'api/auth-return.js', { state, error: 'provider-text', cs: CS, web: '1' }), kind === 'missing' ? 'auth-state-missing' : kind === 'unavailable' ? 'auth-store-unavailable' : 'auth-state-invalid', { state: state || null });
    h.faults.eval = false;
    assert.equal((await (await h.load('lib/auth/account.js')).sessionState(flow.session)).state, 'live');
  }
});
test('SEC-008 OFF callback outage denial and rate-limit responses preserve legacy behavior exactly', async () => {
  for (const flag of [undefined, '', '0', '2', 'true']) {
    const h = await setup(flag), flow = await begin(h);
    h.faults.rate = true;
    const rate = await call(h, 'api/auth-return.js', { state: flow.state, code: 'synthetic-code' });
    assert.equal(rate.statusCode, 429); assert.deepEqual(rate.body, { ok: false, error: 'auth-rate-limited' }); assert.deepEqual(rate.headers, {});
    assert.equal(h.data.has('auth:state:v1:' + flow.state), true);
    h.faults.rate = false; h.faults.eval = true;
    completed(await call(h, 'api/auth-return.js', { state: flow.state, code: 'code' }), 'auth-state-invalid', { state: flow.state });
    completed(await call(h, 'api/auth-return.js', { state: flow.state, error: 'private' }), 'auth-provider-denied', { state: flow.state });
  }
});
test('SEC-008 callback supports only GET POST and OPTIONS without consuming state on unsupported methods', async () => {
  const h = await setup(), flow = await begin(h);
  const options = await call(h, 'api/auth-return.js', {}, { method: 'OPTIONS' });
  assert.equal(options.statusCode, 204); assert.equal(options.headers['access-control-allow-methods'], 'GET, POST, OPTIONS');
  const wrong = await call(h, 'api/auth-return.js', { state: flow.state }, { method: 'PUT' });
  assert.equal(wrong.statusCode, 405); assert.deepEqual(wrong.body, { ok: false, error: 'method-not-allowed' });
  assert.equal(h.data.has('auth:state:v1:' + flow.state), true);
});
test('SEC-008 Apple form POST denial and success preserve correlation and bound exchange', async () => {
  for (const flag of ['0', '1']) {
    for (const denied of [false, true]) {
      const h = await setup(flag), flow = await begin(h, { provider: 'apple' });
      const body = new URLSearchParams({ state: flow.state, ...(denied ? { error: 'private' } : { code: 'synthetic-code' }) }).toString();
      const res = await call(h, 'api/auth-return.js', { state: 'untrusted-query-state' }, { method: 'POST', body });
      if (denied) completed(res, 'auth-provider-denied');
      else {
        const url = new URL(res.headers.location);
        assert.equal(url.searchParams.get('state'), CS);
        const exchanged = await h.post('api/auth-exchange.js', { ticket: url.searchParams.get('ticket'), proofVersion: 1, proof: flow.b.proof });
        assert.equal(exchanged.statusCode, 200); assert.equal(exchanged.body.provider, 'apple');
      }
    }
  }
});
test('SEC-008 ON failed callback can recover with a new challenge and assertion without revoking a valid session', async () => {
  const h = await setup(), flow = await begin(h, { reauth: true });
  completed(await call(h, 'api/auth-return.js', { state: flow.state, error: 'denied' }), 'auth-provider-denied');
  const b = (await h.post('api/auth-challenge.js', { proofVersion: 1, provider: 'google', transport: 'redirect', purpose: 'reauth', session: flow.session, action: 'account-delete' })).body;
  const start = await call(h, 'api/auth-start.js', { provider: 'google', pv: '1', challenge: b.challenge, cs: CS });
  const url = new URL(start.headers.location);
  h.http.idToken = h.sign({ iss: 'https://accounts.google.com', aud: 'test-client', nonce: url.searchParams.get('nonce'), sub: 'original-user' });
  const returned = await call(h, 'api/auth-return.js', { state: url.searchParams.get('state'), code: 'synthetic-code' });
  const ticket = new URL(returned.headers.location).searchParams.get('ticket');
  const exchanged = await h.post('api/auth-exchange.js', { ticket, proofVersion: 1, proof: b.proof, session: flow.session });
  assert.equal(exchanged.statusCode, 200); assert.ok(exchanged.body.reauthProof); assert.equal(exchanged.body.session, undefined);
  assert.equal((await (await h.load('lib/auth/account.js')).sessionState(flow.session)).state, 'live');
  assert.notEqual(b.challenge, flow.b.challenge);
});
