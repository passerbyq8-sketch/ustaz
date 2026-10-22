import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

import { handleIapBalance } from '../api/iap-balance.js';
import { handleIapConsume } from '../api/iap-consume.js';
import { handleIapWebhook } from '../api/iap-webhook.js';
import iapStatus from '../api/iap-status.js';
import {
  __resetIapStore,
  __setIapStoreForTest,
  iapEnforcementMode,
  isIapEnforced,
  readBalance,
} from '../lib/iap/store.js';

const accountA = 'acct:v1:google:rollout-a';
const accountB = 'acct:v1:apple:rollout-b';

async function withEnv(values, operation) {
  const keys = ['IAP_ENFORCE', 'IAP_TEST_ACCOUNTS', 'REVENUECAT_WEBHOOK_SECRET'];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  try {
    return await operation();
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

function responseDouble() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; return this; },
  };
}

function request(method, headers = {}, body) {
  return { method, headers, body };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

async function runIapBridge(mode, accountSession = null) {
  const source = await readFile(new URL('../hanna-laha/assets/iap-bridge-v1.js', import.meta.url), 'utf8');
  const { document } = parseHTML('<html><body></body></html>');
  const window = {};
  const localStorage = memoryStorage(accountSession
    ? { ezik_auth_session_v1: JSON.stringify(accountSession) } : {});
  const sessionStorage = memoryStorage();
  const calls = [];
  let starts = 0;
  const noop = () => {};
  window.addEventListener = noop;
  window.removeEventListener = noop;
  window.sessionStorage = sessionStorage;
  document.visibilityState = 'visible';
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    if (typeof element.focus !== 'function') element.focus = noop;
    return element;
  };
  const fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/api/iap-status')) return { ok: true, status: 200, json: async () => ({ mode }) };
    if (String(url).endsWith('/api/iap-balance')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ appUserId: accountB, enforced: false, credits: 0, subscriptionExpiresAt: null }),
      };
    }
    throw new Error('unexpected-fetch');
  };
  vm.runInNewContext(source, { window, document, localStorage, fetch, setTimeout, clearTimeout });
  window.ezikIapStart(() => { starts += 1; }, 'room-1', 'hanna');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { document, calls, starts };
}

class MemoryIapStore {
  values = new Map();
  ledger = [];

  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }

  async eval(script, keys, args) {
    assert.match(script, /local marker = redis\.call\('GET', KEYS\[4\]\)/);
    const [balanceKey, transactionKey, ledgerKey, markerKey] = keys;
    if (this.values.has(markerKey)) return 'DUPLICATE';
    const currentTransaction = this.values.get(transactionKey) || '';
    if (currentTransaction !== args[0]) return 'RETRY';

    const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
    const credits = Number(balance.credits) || 0;
    const expiry = Number(balance.subscriptionExpiresAt) || 0;
    if (credits !== Number(args[1]) || expiry !== Number(args[2])) return 'RETRY';
    const gameIds = JSON.parse(args[3]);
    const usage = balance.freeUsedByGame || {};
    for (let i = 0; i < gameIds.length; i += 1) {
      const used = Number(usage[gameIds[i]]) || 0;
      if (used !== Number(args[5 + i])) return 'RETRY';
    }

    this.values.set(balanceKey, args[5 + gameIds.length]);
    this.values.set(transactionKey, args[6 + gameIds.length]);
    this.values.set(markerKey, '1');
    this.ledger.push(JSON.parse(args[7 + gameIds.length]));
    this.values.set(ledgerKey, JSON.stringify(this.ledger));
    return 'APPLIED';
  }
}

test('rollout mode defaults to off and honors only the three exact values', async () => {
  await withEnv({}, async () => {
    assert.equal(iapEnforcementMode(), 'off');
    assert.equal(isIapEnforced(accountA), false);
  });
  await withEnv({ IAP_ENFORCE: 'off', IAP_TEST_ACCOUNTS: accountA }, async () => {
    assert.equal(iapEnforcementMode(), 'off');
    assert.equal(isIapEnforced(accountA), false);
    assert.equal(isIapEnforced(accountB), false);
  });
  await withEnv({ IAP_ENFORCE: 'test', IAP_TEST_ACCOUNTS: ` ${accountA} , ${accountB} ` }, async () => {
    assert.equal(iapEnforcementMode(), 'test');
    assert.equal(isIapEnforced(accountA), true);
    assert.equal(isIapEnforced(accountB), true);
    assert.equal(isIapEnforced('acct:v1:google:other'), false);
  });
  await withEnv({ IAP_ENFORCE: 'all', IAP_TEST_ACCOUNTS: '' }, async () => {
    assert.equal(iapEnforcementMode(), 'all');
    assert.equal(isIapEnforced(accountA), true);
    assert.equal(isIapEnforced(accountB), true);
  });
  await withEnv({ IAP_ENFORCE: 'garbage', IAP_TEST_ACCOUNTS: accountA }, async () => {
    assert.equal(iapEnforcementMode(), 'off');
    assert.equal(isIapEnforced(accountA), false);
  });
});

test('unenforced consume succeeds without calling the deduction store and signed-out callers stay unauthorized', async () => {
  await withEnv({ IAP_ENFORCE: 'off' }, async () => {
    let consumeCalls = 0;
    const dependencies = {
      sessionState: async () => ({ state: 'live', record: { accountKey: accountA } }),
      consumeSession: async () => { consumeCalls += 1; throw new Error('must not deduct'); },
      isIapEnforced,
    };
    const req = request('POST', { 'x-ezik-session': 's'.repeat(32) }, {
      sessionId: 'session-id-1234567890', gameId: 'hanna', intent: 'free',
    });
    const res = responseDouble();
    await handleIapConsume(req, res, dependencies);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mode: 'unenforced' });
    assert.equal(consumeCalls, 0);

    const signedOut = responseDouble();
    await handleIapConsume(request('POST', {}, req.body), signedOut, dependencies);
    assert.equal(signedOut.statusCode, 401);
    assert.deepEqual(signedOut.body, { ok: false, error: 'iap-session-required' });
  });
});

test('balance marks listed and unlisted test accounts', async () => {
  await withEnv({ IAP_ENFORCE: 'test', IAP_TEST_ACCOUNTS: accountA }, async () => {
    for (const [accountKey, expected] of [[accountA, true], [accountB, false]]) {
      const res = responseDouble();
      await handleIapBalance(request('GET', { 'x-ezik-session': 's'.repeat(32) }), res, {
        sessionState: async () => ({ state: 'live', record: { accountKey } }),
        readBalance: async () => ({ credits: 0, subscriptionExpiresAt: null }),
        isIapEnforced,
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.enforced, expected);
      assert.equal(res.body.appUserId, accountKey);
    }
  });
});

test('purchase webhook credits an account while enforcement is off', async () => {
  await withEnv({ IAP_ENFORCE: 'off', REVENUECAT_WEBHOOK_SECRET: 'rollout-test-secret' }, async () => {
    assert.equal(isIapEnforced(accountA), false);
    const store = new MemoryIapStore();
    __setIapStoreForTest(store);
    try {
      const res = responseDouble();
      await handleIapWebhook(request('POST', { authorization: 'rollout-test-secret' }, {
        event: {
          type: 'NON_RENEWING_PURCHASE',
          product_id: 'ezik_games_3',
          app_user_id: accountA,
          store: 'APP_STORE',
          transaction_id: 'rollout-off-purchase-1',
          event_timestamp_ms: Date.now(),
        },
      }), res, {
        readJsonStrict: async (key) => {
          assert.equal(key, accountA);
          return { ok: true, value: { v: 1 } };
        },
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { ok: true, status: 'applied' });
      assert.equal((await readBalance(accountA)).credits, 3);
      assert.equal(store.ledger.length, 1);
      assert.equal(store.ledger[0].creditsDelta, 3);
    } finally {
      __resetIapStore();
    }
  });
});

test('public IAP status contains only the mode and reveals no account ids', async () => {
  await withEnv({ IAP_ENFORCE: 'test', IAP_TEST_ACCOUNTS: `${accountA},${accountB}` }, async () => {
    const res = responseDouble();
    iapStatus(request('GET'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { mode: 'test' });
    assert.equal(Object.keys(res.body).join(','), 'mode');
    assert.doesNotMatch(JSON.stringify(res.body), /rollout-a|rollout-b/);
    assert.match(res.headers['cache-control'], /max-age=30/);
  });
});

test('web owner skips sign-in and choice UI when off or when their balance is unenforced', async () => {
  const off = await runIapBridge('off');
  assert.equal(off.starts, 1);
  assert.equal(off.document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(off.calls, ['../api/iap-status']);

  const signedOutTest = await runIapBridge('test');
  assert.equal(signedOutTest.starts, 0);
  assert.ok(signedOutTest.document.querySelector('[role="dialog"]'));
  assert.ok(signedOutTest.document.querySelector('a[href="/?ezik_iap_signin=1"]'));

  const nonListedTest = await runIapBridge('test', { session: 's'.repeat(32) });
  assert.equal(nonListedTest.starts, 1);
  assert.equal(nonListedTest.document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(nonListedTest.calls, ['../api/iap-status', '../api/iap-balance']);
});
