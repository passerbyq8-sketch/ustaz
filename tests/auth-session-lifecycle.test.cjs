'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./security-auth-harness.cjs');
async function fixture(role = 'ordinary') {
  const h = await harness();
  const account = await h.load('lib/auth/account.js');
  const roles = await h.load('lib/articles/roles.js');
  const input = { provider: 'google', sub: 'synthetic-user', email: 'synthetic@example.invalid', emailVerified: true };
  const a = await account.upsertAccount(input);
  const one = await account.mintSession(a.key), two = await account.mintSession(a.key);
  if (role === 'stored-editor') await h.redis.set('role:v1:' + a.key, { role: 'editor', sections: ['articles'], grantedBy: 'synthetic', grantedAt: 'synthetic' });
  if (role === 'env-editor') h.env.EZIK_EDITOR_ACCOUNTS = account.emailDigest(input.email);
  if (role === 'env-owner') h.env.EZIK_OWNER_ACCOUNTS = account.emailDigest(input.email);
  return { h, account, roles, input, key: a.key, one: one.session, two: two.session };
}
for (const role of ['ordinary', 'stored-editor', 'env-editor', 'env-owner']) {
  test('delete revokes the old second session: ' + role, async () => {
    const f = await fixture(role);
    assert.equal((await f.account.deleteAccount(f.key, f.one)).ok, true);
    assert.equal(await f.account.touchSession(f.two), null);
    assert.equal((await f.roles.roleFor(f.key)).role, 'none');
  });
  test('same-subject recreation never revives sessions or stored grants: ' + role, async () => {
    const f = await fixture(role);
    await f.account.deleteAccount(f.key, f.one);
    await f.account.upsertAccount(f.input);
    assert.equal((await f.account.sessionState(f.two)).state, 'dead');
    assert.equal((await f.roles.roleFor(f.key)).role, role === 'env-owner' ? 'owner' : role === 'env-editor' ? 'editor' : 'none');
  });
}
test('a sliding read in flight cannot resurrect a revoked session', async () => {
  const f = await fixture();
  let pause, release;
  const paused = new Promise(resolve => { pause = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  const original = f.h.redis.set;
  f.h.redis.set = async (key, ...args) => {
    if (key === 'sess:v1:' + f.two) { pause(); await resume; }
    return original(key, ...args);
  };
  f.h.redis.beforeEval = async (_script, keys) => {
    if (keys.includes('sess:v1:' + f.two)) { f.h.redis.beforeEval = null; pause(); await resume; }
  };
  const sliding = f.account.touchSession(f.two);
  await paused;
  await f.account.revokeSession(f.two);
  release(); await sliding;
  assert.equal((await f.account.sessionState(f.two)).state, 'dead');
});
for (const [file, body] of [
  ['api/feedback.js', { type: 'suggestion', text: 'synthetic' }],
  ['api/inbox.js', { action: 'mine' }],
  ['api/inbox.js', { action: 'seen' }],
  ['api/inbox.js', { action: 'list', kind: 'feedback' }],
]) test('outage is 503: ' + file + ' ' + (body.action || 'post'), async () => {
  const f = await fixture(); f.h.faults.down = true;
  assert.equal((await f.h.post(file, { ...body, session: f.two })).statusCode, 503);
});
test('legacy sessions retain the 400-day sliding lifetime', async () => {
  const f = await fixture();
  const held = f.h.data.get('sess:v1:' + f.two);
  delete held.value.generation;
  f.h.advance(300 * 86400000);
  const state = await f.account.sessionState(f.two);
  assert.equal(state.state, 'live');
  assert.equal(state.record.expiresAt - f.h.now(), 400 * 86400000);
});

test('exact schemas, durable generations and legacy grants survive only their original account', async () => {
  const f = await fixture('stored-editor');
  assert.equal((await f.roles.roleFor(f.key)).role, 'editor');
  const session = f.h.data.get('sess:v1:' + f.two).value;
  assert.deepEqual(Object.keys(session).sort(), ['accountKey', 'createdAt', 'expiresAt', 'generation']);
  const oldGrant = structuredClone(f.h.data.get('role:v1:' + f.key));
  assert.equal((await f.account.deleteAccount(f.key, f.one)).ok, true);
  const gen = f.h.data.get('auth:generation:v1:' + f.key);
  assert.equal(gen.until, 0);
  assert.deepEqual(Object.keys(gen.value).sort(), ['id', 'v']);
  await f.account.upsertAccount(f.input);
  f.h.data.set('role:v1:' + f.key, oldGrant);
  assert.equal((await f.roles.roleFor(f.key)).role, 'none');
  const granted = await f.roles.grantRole(f.key, ['articles'], { role: 'owner', accountKey: 'synthetic-owner' });
  assert.equal(granted.ok, true);
  assert.deepEqual(Object.keys(f.h.data.get('role:v1:' + f.key).value).sort(), ['generation', 'grantedAt', 'grantedBy', 'role', 'sections']);
  assert.equal((await f.roles.roleFor(f.key)).role, 'editor');
  assert.equal((await f.account.mintSession(f.key, 'legacy')).ok, false, 'pre-deletion ticket cannot mint in new generation');
  const fresh = await f.account.mintSession(f.key);
  assert.equal((await f.account.sessionState(fresh.session)).state, 'live');
  assert.equal((await f.account.sessionState(f.two)).state, 'dead');
});

for (const op of ['mint', 'slide', 'upsert', 'grant', 'index']) test('delete/recreate wins over in-flight ' + op, async () => {
  const f = await fixture();
  let pause, release;
  const paused = new Promise(r => { pause = r; }), resume = new Promise(r => { release = r; });
  f.h.redis.beforeEval = async () => { f.h.redis.beforeEval = null; pause(); await resume; };
  const operation = op === 'mint' ? f.account.mintSession(f.key)
    : op === 'slide' ? f.account.sessionState(f.two)
    : op === 'upsert' ? f.account.upsertAccount(f.input)
    : op === 'index' ? f.account.indexVerifiedEmail(f.input.email, true, f.key)
    : f.roles.grantRole(f.key, ['articles'], { role: 'owner', accountKey: 'synthetic-owner' });
  await paused;
  assert.equal((await f.account.deleteAccount(f.key, f.one)).ok, true);
  assert.equal((await f.account.upsertAccount(f.input)).ok, true);
  release(); const result = await operation;
  if (op === 'slide') assert.equal(result.state, 'dead');
  else if (op === 'index') assert.equal(result.written, false);
  else assert.equal(result.ok, false);
  assert.equal((await f.roles.roleFor(f.key)).role, 'none');
  assert.equal((await f.account.sessionState(f.two)).state, 'dead');
});

test('write failures and contention stay unknown, recover without logging out a session', async () => {
  const f = await fixture();
  const before = structuredClone(f.h.data);
  f.h.faults.set = true;
  assert.equal((await f.account.sessionState(f.two)).state, 'unknown');
  assert.equal((await f.account.mintSession(f.key)).ok, false);
  assert.equal((await f.account.deleteAccount(f.key, f.one)).ok, false);
  assert.deepEqual(f.h.data, before);
  for (const file of ['api/feedback.js', 'api/inbox.js', 'api/auth-delete.js', 'api/roles-admin.js', 'api/articles-admin.js']) {
    const body = { session: f.two, action: file.includes('articles') ? 'create' : file.includes('roles') ? 'grant' : 'mine', type: 'suggestion', text: 'synthetic' };
    assert.equal((await f.h.post(file, body)).statusCode, 503, file);
  }
  f.h.faults.set = false;
  assert.equal((await f.account.sessionState(f.two)).state, 'live');
  const evalOriginal = f.h.redis.eval;
  f.h.redis.eval = async () => 'RETRY';
  assert.equal((await f.account.sessionState(f.two)).state, 'unknown');
  f.h.redis.eval = evalOriginal;
  assert.equal((await f.account.sessionState(f.two)).state, 'live');
});

test('Lua comparisons, expiry and no-write predicates execute the script itself', async () => {
  const f = await fixture(), store = await f.h.load('lib/auth/store.js');
  const prior = await store.authSnapshot(f.key);
  const stale = { ...prior, raw: 'wrong', next: { injected: true } };
  assert.equal(await store.authCompareWrite([stale]), 'RETRY');
  assert.equal(f.h.data.get(f.key).value.injected, undefined);
  // Interpreter mutations prove it does not simply recognize an operation name.
  const { runAuthLua } = require('./auth-lua-fixture.cjs');
  let value = 'old';
  const fake = { get: () => value, set: (_k, v) => { value = v; return 'OK'; }, del: () => { value = null; return 1; } };
  assert.equal(runAuthLua(store.AUTH_CAS_SCRIPT, ['key'], ['wrong', 'new', '0'], fake), 'RETRY');
  assert.equal(value, 'old');
  const noCompare = store.AUTH_CAS_SCRIPT.replace("if current ~= ARGV[i] then return 'RETRY' end", '');
  assert.equal(runAuthLua(noCompare, ['key'], ['wrong', 'new', '0'], fake), 'OK');
  assert.equal(value, 'new');
  runAuthLua(store.AUTH_CAS_SCRIPT, ['key'], ['new', '~', '0'], fake);
  assert.equal(value, null);
  f.h.advance(401 * 86400000);
  assert.equal((await f.account.sessionState(f.two)).state, 'dead');
});
