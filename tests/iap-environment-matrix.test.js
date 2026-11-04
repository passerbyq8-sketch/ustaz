import assert from 'node:assert/strict';
import test from 'node:test';
import { handleIapWebhook } from '../api/iap-webhook.js';
import { handleIapBalance } from '../api/iap-balance.js';
import { handleIapConsume } from '../api/iap-consume.js';
import { handleIapTrialStart } from '../api/iap-trial-start.js';
import { handleIapTestAdjust } from '../api/iap-test-adjust.js';
import { __setIapStoreForTest, __resetIapStore, readBalance } from '../lib/iap/store.js';
import { MemoryIapStore } from './iap-memory-store.js';

const account = 'acct:v1:google:review-fixture';
const other = 'acct:v1:apple:ordinary-fixture';
const secret = 'local-webhook-fixture';
function response() {
  return { statusCode: 0, status(n) { this.statusCode = n; return this; },
    setHeader() {}, json(b) { this.body = b; return this; } };
}
async function fixture(run) {
  const names = ['VERCEL_ENV', 'REVENUECAT_WEBHOOK_SECRET', 'IAP_REVIEW_ACCOUNTS', 'IAP_ENFORCE', 'IAP_TEST_ACCOUNTS'];
  const before = names.map(n => process.env[n]);
  process.env.VERCEL_ENV = 'production';
  process.env.REVENUECAT_WEBHOOK_SECRET = secret;
  delete process.env.IAP_REVIEW_ACCOUNTS;
  process.env.IAP_ENFORCE = 'all';
  const store = new MemoryIapStore();
  __setIapStoreForTest(store);
  let reads = 0;
  const send = async (change = {}, options = {}) => {
    const res = response();
    await handleIapWebhook({ method: 'POST', headers: { authorization: secret, ...options.headers },
      body: options.body ?? { event: { type: 'NON_RENEWING_PURCHASE', environment: 'PRODUCTION',
        product_id: 'ezik_games_3', app_user_id: account, store: 'APP_STORE', transaction_id: 'same-transaction',
        event_timestamp_ms: Date.now(), ...change } } }, res, {
      readJsonStrict: async () => { reads++; return options.account ?? { ok: true, value: { v: 1 } }; },
    });
    return res;
  };
  const route = async (handler, body = {}, who = account) => {
    const res = response();
    await handler({ method: handler === handleIapBalance ? 'GET' : 'POST',
      headers: { 'x-ezik-session': 'x'.repeat(32) }, body, query: { namespace: 'live' } }, res,
    { sessionState: async () => ({ state: 'live', record: { accountKey: who } }) });
    return res;
  };
  try { await run({ store, send, route, reads: () => reads }); }
  finally { __resetIapStore(); names.forEach((n, i) => { if (before[i] === undefined) delete process.env[n]; else process.env[n] = before[i]; }); }
}

test('matrix: repeated/concurrent production deliveries grant once; off/free refunds still apply', async () => {
  for (const mode of ['off', 'free']) await fixture(async ({ store, send }) => {
    process.env.IAP_ENFORCE = mode;
    const deliveries = await Promise.all(Array.from({ length: 12 }, () => send()));
    assert.equal(deliveries.filter(r => r.body.status === 'applied').length, 1);
    assert.equal(deliveries.filter(r => r.body.status === 'duplicate').length, 11);
    assert.equal((await send()).body.status, 'duplicate');
    assert.equal((await readBalance(account)).credits, 3);
    assert.equal(store.ledger.length, 1);
    await send({ type: 'CANCELLATION' });
    assert.equal((await readBalance(account)).credits, 0);
    await send({ type: 'REFUND_REVERSED' });
    assert.equal((await readBalance(account)).credits, 3);
  });
});

test('matrix: allowlisted sandbox is isolated from production, dedupe and client selectors', async () => {
  await fixture(async ({ store, send, route, reads }) => {
    const denied = await send({ environment: 'SANDBOX', namespace: 'live', review: true });
    assert.equal(denied.body.status, 'ignored-environment');
    assert.equal(reads(), 0); assert.equal(store.values.size, 0);
    process.env.IAP_REVIEW_ACCOUNTS = ' ' + account + ' ';
    for (const storeName of ['APP_STORE', 'PLAY_STORE']) {
      const e = { environment: 'SANDBOX', store: storeName, namespace: 'live' };
      const results = await Promise.all([send(e), send(e), send(e)]);
      assert.equal(results.filter(r => r.body.status === 'applied').length, 1);
      assert.equal((await send({ store: storeName })).body.status, 'applied');
    }
    assert.equal((await route(handleIapBalance)).body.credits, 6);
    const production = new Map([...store.values].filter(([k]) => k.startsWith('iap:v1:production:') && !k.includes(':review:')));
    assert.ok(production.size > 0);
    assert.ok([...store.values.keys()].some(k => k.startsWith('iap:v1:production:review:')));
    assert.equal((await send({ app_user_id: other, environment: 'SANDBOX' })).body.status, 'ignored-environment');
    const consumed = await route(handleIapConsume, { sessionId: 'review-consume-123456', gameId: 'hanna', namespace: 'live' });
    assert.equal(consumed.body.mode, 'credit');
    assert.equal((await readBalance(account)).credits, 5);
    process.env.IAP_ENFORCE = 'test'; process.env.IAP_TEST_ACCOUNTS = account;
    assert.equal((await route(handleIapTestAdjust, { credits: 4 })).statusCode, 200);
    assert.equal((await route(handleIapTrialStart)).statusCode, 200);
    for (const [k, v] of production) assert.equal(store.values.get(k), v, k);
    delete process.env.IAP_REVIEW_ACCOUNTS;
    assert.equal((await route(handleIapBalance)).body.credits, 6, 'removal reveals unchanged ordinary balance');
    assert.equal((await route(handleIapTestAdjust, { credits: 20 })).statusCode, 400);
    assert.equal((await readBalance(account)).credits, 6);
    assert.equal((await send({ environment: 'SANDBOX', type: 'CANCELLATION' })).body.status, 'ignored-environment');
    assert.equal((await send({ environment: 'SANDBOX', type: 'REFUND_REVERSED' })).body.status, 'ignored-environment');
  });
});

test('matrix: explicitly authorized preview sandbox never writes production and refuses production', async () => {
  await fixture(async ({ store, send, reads }) => {
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await send({ environment: 'SANDBOX' })).body.status, 'ignored-environment');
    process.env.IAP_REVIEW_ACCOUNTS = account;
    assert.equal((await send()).body.status, 'ignored-environment');
    assert.equal(reads(), 0);
    assert.equal((await send({ environment: 'SANDBOX' })).body.status, 'applied');
    assert.ok([...store.values.keys()].every(k => k.startsWith('iap:v1:preview:review:')));
    assert.equal((await readBalance(account)).credits, 3);
    process.env.VERCEL_ENV = 'production';
    assert.equal((await readBalance(account)).credits, 0);
    delete process.env.IAP_REVIEW_ACCOUNTS;
    assert.equal((await readBalance(account)).credits, 0);
  });
});

test('matrix: authentication, malformed/unknown events and store outages make no grants', async () => {
  await fixture(async ({ store, send, reads }) => {
    for (const environment of ['PRODUCTION', 'SANDBOX', null, 'production']) {
      assert.equal((await send({ environment }, { headers: { authorization: 'wrong' } })).statusCode, 401);
    }
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    assert.equal((await send()).statusCode, 503);
    process.env.REVENUECAT_WEBHOOK_SECRET = secret;
    for (const body of [{}, { event: [] }, { event: null }, '{', { event: { type: 'x'.repeat(65536) } }]) {
      assert.equal((await send({}, { body })).statusCode, 400);
    }
    assert.equal(reads(), 0);
    for (const environment of [undefined, '', 'production', [], {}, 'UNKNOWN']) {
      assert.equal((await send({ environment })).body.error, 'iap-webhook-environment');
    }
    assert.equal((await send({ type: 'TEST', environment: undefined })).body.status, 'test');
    assert.equal((await send({ product_id: 'unknown' })).body.status, 'ignored');
    assert.equal((await send({ type: 'UNKNOWN' })).body.status, 'ignored');
    assert.equal((await send({ app_user_id: 'arbitrary' })).body.status, 'ignored');
    assert.equal(reads(), 0);
    assert.equal((await send({}, { account: { ok: true, value: null } })).body.status, 'unknown-account');
    assert.equal((await send({}, { account: { ok: false } })).statusCode, 503);
    for (const fields of [{ store: {} }, { store: 'x' }, { transaction_id: '' }, { transaction_id: [] }, { transaction_id: 'x'.repeat(257) }]) {
      assert.equal((await send(fields)).statusCode, 400);
    }
    assert.equal(store.values.size, 0);
  });
});

test('matrix: every refund/reversal delivery order preserves one net purchase for credits and passes', async () => {
  const orders = ['PRV', 'PVR', 'RPV', 'RVP', 'VPR', 'VRP'];
  const types = { P: 'NON_RENEWING_PURCHASE', R: 'CANCELLATION', V: 'REFUND_REVERSED' };
  for (const product of ['ezik_games_3', 'ezik_pass_week_1']) {
    for (const environment of ['PRODUCTION', 'SANDBOX']) for (const order of orders) {
      await fixture(async ({ store, send }) => {
        if (environment === 'SANDBOX') process.env.IAP_REVIEW_ACCOUNTS = account;
        for (const action of order) {
          const e = { type: types[action], product_id: product, environment };
          assert.equal((await send(e)).body.status, 'applied');
          assert.equal((await send(e)).body.status, 'duplicate');
        }
        const balance = await readBalance(account);
        assert.equal(store.ledger.length, 3);
        if (product === 'ezik_games_3') assert.equal(balance.credits, 3, order);
        else assert.ok(Math.abs(balance.subscriptionExpiresAt - Date.now() - 7 * 86400000) < 2000, order);
        if (environment === 'SANDBOX') {
          delete process.env.IAP_REVIEW_ACCOUNTS;
          assert.equal((await readBalance(account)).credits, 0);
          assert.equal((await readBalance(account)).subscriptionExpiresAt, null);
        }
      });
    }
  }
});
