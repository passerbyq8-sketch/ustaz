// SEC-020: deliberately red regression retained under C2 ORDER 1.
// Do not register as a passing gate or weaken these assertions. The implementation
// awaits the owner's Apple App Review / Google licensed-tester policy and the
// redacted provider configuration requested by P5. No live service is contacted.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { handleIapWebhook } from '../api/iap-webhook.js';

function response() {
  return { statusCode: 0, status(code) { this.statusCode = code; return this; },
    setHeader() {}, json(body) { this.body = body; return this; } };
}

async function fixture(run) {
  const names = ['VERCEL_ENV', 'REVENUECAT_WEBHOOK_SECRET', 'IAP_ENFORCE'];
  const before = names.map(name => process.env[name]);
  process.env.VERCEL_ENV = 'production';
  process.env.REVENUECAT_WEBHOOK_SECRET = crypto.randomBytes(24).toString('hex');
  const calls = { reads: 0, mutations: 0 };
  const event = { type: 'NON_RENEWING_PURCHASE', environment: 'PRODUCTION',
    product_id: 'ezik_games_3', app_user_id: 'acct:v1:google:environment-fixture',
    store: 'APP_STORE', transaction_id: 'environment-fixture', event_timestamp_ms: Date.now() };
  const send = async (changes = {}, authenticated = true) => {
    const res = response();
    await handleIapWebhook({ method: 'POST', headers: authenticated
      ? { authorization: process.env.REVENUECAT_WEBHOOK_SECRET } : {},
    body: { event: { ...event, ...changes } } }, res, {
      readJsonStrict: async () => { calls.reads++; return { ok: true, value: { v: 1 } }; },
      applyTransactionEvent: async () => { calls.mutations++; return { ok: true, status: 'applied' }; },
    });
    return res;
  };
  try { await run({ calls, send }); }
  finally { names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; }); }
}

test('SEC-020 production purchases retain off/free bookkeeping', async () => {
  for (const mode of ['off', 'free']) await fixture(async ({ calls, send }) => {
    process.env.IAP_ENFORCE = mode;
    assert.equal((await send()).statusCode, 200);
    assert.deepEqual(calls, { reads: 1, mutations: 1 });
  });
});

test('SEC-020 missing authentication and TEST health checks never reach account or ledger', async () => {
  for (const environment of ['PRODUCTION', 'SANDBOX', undefined]) await fixture(async ({ calls, send }) => {
    assert.equal((await send({ environment }, false)).statusCode, 401);
    assert.equal((await send({ environment, type: 'TEST' })).statusCode, 200);
    assert.deepEqual(calls, { reads: 0, mutations: 0 });
  });
});

for (const type of ['NON_RENEWING_PURCHASE', 'CANCELLATION', 'REFUND_REVERSED']) {
  test('SEC-020 production drops sandbox ' + type + ' before all account/ledger access', async () => {
    await fixture(async ({ calls, send }) => {
      const r = await send({ type, environment: 'SANDBOX' });
      assert.equal(r.statusCode, 200);
      assert.deepEqual(calls, { reads: 0, mutations: 0 });
      assert.equal(r.body.status, 'ignored-environment');
    });
  });
}

for (const [label, environment] of [['missing', undefined], ['empty', ''], ['lowercase', 'production'],
  ['array', ['PRODUCTION']], ['object', {}], ['unknown', 'UNKNOWN']]) {
  test('SEC-020 ' + label + ' environment never reaches account or ledger', async () => {
    await fixture(async ({ calls, send }) => {
      await send({ environment });
      assert.deepEqual(calls, { reads: 0, mutations: 0 });
      // The deterministic invalid-event response still needs the owner contract.
    });
  });
}

test('SEC-020 preview cannot process production money events by default', async () => {
  await fixture(async ({ calls, send }) => {
    process.env.VERCEL_ENV = 'preview';
    await send();
    assert.deepEqual(calls, { reads: 0, mutations: 0 });
  });
});
