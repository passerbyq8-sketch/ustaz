import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { trackIapLifecycle } from './iap-lifecycle-fixture.js';
import * as iapStore from '../lib/iap/store.js';

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

const canShowIapPurchaseEntry = (...args) => iapStore.canShowIapPurchaseEntry(...args);

const accountA = 'acct:v1:google:rollout-a';
const accountB = 'acct:v1:apple:rollout-b';

async function withEnv(values, operation) {
  const keys = ['VERCEL_ENV', 'IAP_REVIEW_ACCOUNTS', 'IAP_ENFORCE', 'IAP_SIGNIN', 'IAP_TEST_ACCOUNTS', 'IAP_ENTRY_ACCOUNTS', 'REVENUECAT_WEBHOOK_SECRET'];
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
  const listeners = new Map();
  window.addEventListener = (type, fn) => { const set = listeners.get(type) || new Set(); set.add(fn); listeners.set(type, set); };
  window.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
  window.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
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
  trackIapLifecycle(window, document);
  vm.runInNewContext(source, { window, document, localStorage, fetch, setTimeout, clearTimeout });
  window.ezikIapStart(() => { starts += 1; }, 'room-1', 'hanna');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { document, calls, starts };
}

async function runFreeSignInGate(signin, scenario, entrypoint, lockedPage = false) {
  const source = await readFile(new URL('../hanna-laha/assets/iap-bridge-v1.js', import.meta.url), 'utf8');
  const { document } = parseHTML('<html><body></body></html>');
  const windowListeners = new Map();
  const window = {
    location: { pathname: '/quest-ghaws.html', search: '', hash: '', href: '' },
    addEventListener(type, fn) { const set = windowListeners.get(type) || new Set(); set.add(fn); windowListeners.set(type, set); },
    removeEventListener(type, fn) { windowListeners.get(type)?.delete(fn); },
    dispatchEvent(event) { for (const fn of windowListeners.get(event.type) || []) fn(event); },
  };
  const initialStorage = {};
  const session = ['no-session', 'no-session-resume'].includes(scenario) ? '' : 's'.repeat(32);
  if (session) initialStorage.ezik_auth_session_v1 = JSON.stringify({ session });
  const offline = scenario === 'offline';
  if (offline) {
    initialStorage.ezik_iap_verified_mode_v1 = JSON.stringify({
      schema: 1, mode: 'free', signin, verifiedAt: Date.now(),
    });
  }
  const localStorage = memoryStorage(initialStorage);
  const sessionStorage = memoryStorage();
  const calls = [];
  const noop = () => {};
  const navigator = { onLine: !offline };
  let allowed = 0;
  let starts = 0;
  document.readyState = 'loading';
  document.visibilityState = 'visible';
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    if (typeof element.focus !== 'function') element.focus = noop;
    return element;
  };
  const statusBody = signin === 'none' ? { mode: 'free' }
    : { mode: 'free', signin: signin === 'invalid' ? 'other' : signin };
  const fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/api/iap-status')) {
      return { ok: true, status: 200, json: async () => statusBody };
    }
    if (String(url).endsWith('/api/iap-balance')) {
      if (scenario === '401') return { ok: false, status: 401, json: async () => ({}) };
      if (scenario === 'server-failure') throw new Error('balance-unavailable');
      return {
        ok: true,
        status: 200,
        json: async () => ({ appUserId: accountB, enforced: false, purchaseEntry: false, credits: 0 }),
      };
    }
    throw new Error('unexpected-fetch');
  };
  trackIapLifecycle(window, document);
  vm.runInNewContext(source, { window, document, localStorage, sessionStorage, fetch, navigator, setTimeout, clearTimeout });
  if (entrypoint === 'access') {
    await window.ezikIapCheckGameAccess('ghaws', () => { allowed += 1; }, '/quest-ghaws.html', { lockedPage });
  } else {
    window.ezikIapStart(() => { starts += 1; }, 'room-1', 'hanna');
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  let dialogSeenBeforeResume = false;
  if (scenario === 'no-session-resume' && ['all', 'host'].includes(signin)) {
    dialogSeenBeforeResume = !!document.querySelector('[role="dialog"]');
    localStorage.setItem('ezik_auth_session_v1', JSON.stringify({ session: 'signed-in-after-dialog' }));
    await window.dispatchEvent({ type: 'storage', key: 'ezik_auth_session_v1' });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dialog = document.querySelector('[role="dialog"]');
  return {
    calls, allowed, starts, dialog, dialogSeenBeforeResume,
    dialogTitle: dialog?.querySelector('h2')?.textContent || '',
    dialogCopy: dialog?.querySelector('.ezik-iap-copy')?.textContent || '',
    dialogLine: dialog?.querySelector('.ezik-iap-content p')?.textContent || '',
    returnButton: dialog?.querySelector('.ezik-iap-content button.ezik-iap-button-secondary')?.textContent || '',
    dialogText: dialog?.textContent || '',
    signInLink: dialog?.querySelector('a[href="/?ezik_iap_signin=1"]') || null,
    closeButton: dialog?.querySelector('.ezik-iap-header button') || null,
    windowListeners,
    verifiedMode: localStorage.getItem('ezik_iap_verified_mode_v1'),
  };
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

test('rollout mode defaults to off and preserves the existing test/all decisions', async () => {
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
  await withEnv({ IAP_ENFORCE: 'free', IAP_TEST_ACCOUNTS: accountA }, async () => {
    assert.equal(iapEnforcementMode(), 'free');
    assert.equal(isIapEnforced(accountA), false);
    assert.equal(isIapEnforced(accountB), false);
  });
  await withEnv({ IAP_ENFORCE: 'garbage', IAP_TEST_ACCOUNTS: accountA }, async () => {
    assert.equal(iapEnforcementMode(), 'off');
    assert.equal(isIapEnforced(accountA), false);
  });
});

test('launch decision guard: free entry is owner-list-only, removable, and leaves today test enforcement unchanged', async () => {
  const owner = 'acct:v1:google:102115118171853528569';
  const appReview = 'acct:v1:google:108003346546807022640';
  assert.equal(typeof iapStore.canShowIapPurchaseEntry, 'function', 'server must expose the free-entry decision');
  assert.doesNotMatch(await readFile(new URL('../lib/iap/store.js', import.meta.url), 'utf8'), /acct:v1:google:102115118171853528569/);

  await withEnv({ IAP_ENFORCE: 'free', IAP_ENTRY_ACCOUNTS: owner }, async () => {
    assert.equal(iapEnforcementMode(), 'free');
    for (const account of [owner, accountA, accountB, '']) {
      assert.equal(isIapEnforced(account), false, account + ': no free-week trial or game lock');
      assert.equal(canShowIapPurchaseEntry(account), account === owner, account + ': entry is owner-only');
    }
    for (const account of [owner, accountA]) {
      const res = responseDouble();
      await handleIapBalance(request('GET', { 'x-ezik-session': 's'.repeat(32) }), res, {
        sessionState: async () => ({ state: 'live', record: { accountKey: account } }),
        readBalance: async () => ({ credits: 0, subscriptionExpiresAt: null, trial: { active: false } }),
        isIapEnforced,
      });
      assert.equal(res.body.enforced, false, account + ': server leaves games unlocked');
      assert.equal(res.body.trial, null, account + ': free state does not expose or start a week');
      assert.equal(res.body.purchaseEntry, account === owner, account + ': authenticated balance carries only its own entry decision');
    }
  });

  await withEnv({ IAP_ENFORCE: 'free', IAP_ENTRY_ACCOUNTS: '' }, async () => {
    assert.equal(canShowIapPurchaseEntry(owner), false, 'empty list removes the owner entry');
    assert.equal(canShowIapPurchaseEntry(accountA), false, 'empty list hides the entry from every other account');
  });
  await withEnv({ IAP_ENFORCE: 'free' }, async () => {
    assert.equal(canShowIapPurchaseEntry(owner), false, 'absent list removes the owner entry');
  });

  await withEnv({ IAP_ENFORCE: 'test', IAP_TEST_ACCOUNTS: `${owner},${appReview}` }, async () => {
    assert.equal(iapEnforcementMode(), 'test');
    assert.equal(isIapEnforced(owner), true, 'today owner remains test-enforced');
    assert.equal(isIapEnforced(appReview), true, 'today review account remains test-enforced');
    assert.equal(isIapEnforced(accountA), false, 'today unlisted account remains unenforced');
    assert.equal(canShowIapPurchaseEntry(owner), false, 'new entry env does not alter today legacy entry behavior');
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

test('purchase webhook credits an account while enforcement is off or free', async () => {
  const webhookFixture = ['rollout', 'test', 'secret'].join('-');
  for (const [mode, transactionId] of [['off', 'rollout-off-purchase-1'], ['free', 'rollout-free-purchase-1']]) {
    await withEnv({ VERCEL_ENV: 'production', IAP_ENFORCE: mode, REVENUECAT_WEBHOOK_SECRET: webhookFixture }, async () => {
      assert.equal(isIapEnforced(accountA), false);
      const store = new MemoryIapStore();
      __setIapStoreForTest(store);
      try {
        const res = responseDouble();
        await handleIapWebhook(request('POST', { authorization: webhookFixture }, {
          event: {
            type: 'NON_RENEWING_PURCHASE', environment: 'PRODUCTION',
            product_id: 'ezik_games_3',
            app_user_id: accountA,
            store: 'APP_STORE',
            transaction_id: transactionId,
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
  }
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

test('public IAP status exposes only exact free-mode sign-in rules', async () => {
  for (const configuredMode of [undefined, 'test', 'all', 'free']) {
    for (const configuredSignIn of [undefined, 'all', 'host', 'other']) {
      const env = {};
      if (configuredMode !== undefined) env.IAP_ENFORCE = configuredMode;
      if (configuredSignIn !== undefined) env.IAP_SIGNIN = configuredSignIn;
      await withEnv(env, async () => {
        const res = responseDouble();
        iapStatus(request('GET'), res);
        const mode = ['test', 'all', 'free'].includes(configuredMode) ? configuredMode : 'off';
        const signin = mode === 'free' && ['all', 'host'].includes(configuredSignIn) ? configuredSignIn : null;
        const expected = signin ? { mode, signin } : { mode };
        assert.equal(res.statusCode, 200);
        assert.equal(JSON.stringify(res.body), JSON.stringify(expected), `mode=${configuredMode} signin=${configuredSignIn}`);
      });
    }
  }
});

test('free sign-in bridge gates allow only the configured account checks and preserve none calls', async () => {
  const scenarios = ['no-session', 'valid-session', '401', 'server-failure', 'offline', 'no-session-resume'];
  const expectedTitle = "تسجيل الدخول";
  const expectedCopy = "ألعاب كنوز المعرفة مجانية للجميع، ويلزم تسجيل الدخول إلى حساب عزك قبل اللعب.";
  const expectedLine = "سجّل الدخول، ثم ارجع إلى هذه الصفحة للمتابعة.";
  for (const entrypoint of ['access', 'start']) {
    for (const signin of ['all', 'host', 'none']) {
      for (const scenario of scenarios) {
        const result = await runFreeSignInGate(signin, scenario, entrypoint);
        const gated = signin !== 'none';
        const needsDialog = gated && ['no-session', '401'].includes(scenario);
        const shouldCallBalance = gated && !['no-session', 'offline'].includes(scenario);
        const expectedCalls = scenario === 'offline' ? [] : ['../api/iap-status'];
        if (shouldCallBalance) expectedCalls.push('../api/iap-balance');
        assert.deepEqual(result.calls, expectedCalls, `${entrypoint} rule=${signin} scenario=${scenario}`);
        assert.equal(result.allowed, entrypoint === 'access' && !needsDialog ? 1 : 0, `${entrypoint} rule=${signin} scenario=${scenario}`);
        assert.equal(result.starts, entrypoint === 'start' && !needsDialog ? 1 : 0, `${entrypoint} rule=${signin} scenario=${scenario}`);
        if (needsDialog) {
          assert.ok(result.dialog, `${entrypoint} rule=${signin} scenario=${scenario} dialog`);
          assert.equal(result.dialogTitle, expectedTitle);
          assert.equal(result.dialogCopy, expectedCopy);
          assert.equal(result.dialogLine, expectedLine);
          assert.ok(result.signInLink);
          assert.ok(result.closeButton, 'unlocked page keeps its close button');
          assert.doesNotMatch(result.dialogText, /purchase|trial|week/i);
        } else {
          assert.equal(result.dialog, null, `${entrypoint} rule=${signin} scenario=${scenario} dialog`);
        }
        if (gated && scenario === 'no-session-resume') assert.equal(result.dialogSeenBeforeResume, true);
        if (scenario !== 'offline') {
          const verified = JSON.parse(result.verifiedMode);
          assert.equal(verified.mode, 'free');
          assert.equal(verified.signin, signin);
        }
      }
    }
  }
  for (const scenario of ['no-session', 'offline']) {
    const invalid = await runFreeSignInGate('invalid', scenario, 'access');
    assert.equal(invalid.allowed, 1);
    assert.equal(invalid.dialog, null);
    assert.deepEqual(invalid.calls, scenario === 'offline' ? [] : ['../api/iap-status']);
  }
});

test('all five sign-in strings render without outer guillemets', async () => {
  const opening = String.fromCharCode(0x00ab);
  const closing = String.fromCharCode(0x00bb);
  const assertUnwrapped = (value, label) => {
    assert.equal(value.startsWith(opening), false, `${label} starts with an opening guillemet`);
    assert.equal(value.endsWith(closing), false, `${label} ends with a closing guillemet`);
  };
  const unlocked = await runFreeSignInGate('all', 'no-session', 'access');
  assertUnwrapped(unlocked.dialogTitle, 'dialog title');
  assertUnwrapped(unlocked.dialogCopy, 'dialog copy');
  assertUnwrapped(unlocked.dialogLine, 'dialog line');

  const locked = await runFreeSignInGate('all', 'no-session', 'access', true);
  assert.equal(locked.closeButton, null);
  assertUnwrapped(locked.returnButton, 'locked-page return button');

  const journey = await readFile(new URL('../quest-theme/journey.js', import.meta.url), 'utf8');
  const markupSource = journey.match(/function homeNoticeMarkup\(\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(markupSource);
  const renderNotice = new Function('M', 'esc', 'ar', 'button', `${markupSource}; return homeNoticeMarkup;`)(
    { homeNotice: { kind: 'signin-required' } }, String, String, (label) => `<button>${label}</button>`,
  );
  const { document } = parseHTML(renderNotice());
  const notice = document.querySelector('.j-note')?.textContent || '';
  assertUnwrapped(notice, 'home notice');
});

test('web owner skips sign-in and choice UI when off or when their balance is unenforced', async () => {
  const off = await runIapBridge('off');
  assert.equal(off.starts, 1);
  assert.equal(off.document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(off.calls, ['../api/iap-status']);

  const signedOutTest = await runIapBridge('test');
  assert.equal(signedOutTest.starts, 1);
  assert.equal(signedOutTest.document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(signedOutTest.calls, ['../api/iap-status']);

  const signedOutAll = await runIapBridge('all');
  assert.equal(signedOutAll.starts, 0);
  assert.ok(signedOutAll.document.querySelector('a[href="/?ezik_iap_signin=1"]'));

  const nonListedTest = await runIapBridge('test', { session: 's'.repeat(32) });
  assert.equal(nonListedTest.starts, 1);
  assert.equal(nonListedTest.document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(nonListedTest.calls, ['../api/iap-status', '../api/iap-balance']);
});
