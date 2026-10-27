import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

import { handleIapTestAdjust } from '../api/iap-test-adjust.js';
import { handleIapTrialStart } from '../api/iap-trial-start.js';
import { handleIapWebhook } from '../api/iap-webhook.js';
import {
  __resetIapStore,
  __setIapStoreForTest,
  consumeSession,
  FREE_SESSIONS_PER_GAME,
  IAP_GAME_IDS,
  IAP_PRODUCTS,
  readBalance,
  startTrial,
  testAdjustBalance,
  TRIAL_DAYS,
} from '../lib/iap/store.js';

const account = 'acct:v1:google:iap-g-v2';
const session = 's'.repeat(32);

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

function request(method, headers = {}, body) { return { method, headers, body }; }

class MemoryIapStore {
  values = new Map();
  ledger = [];

  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }

  async eval(script, keys, args) {
    const [balanceKey, transactionKey, ledgerKey, markerKey] = keys;
    if (script.includes("event='trial_started'")) {
      const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
      if (Number(balance.trialStartedAt) > 0) {
        return JSON.stringify({ ok: true, created: false, startedAt: Number(balance.trialStartedAt) });
      }
      const now = Number(args[0]);
      balance.trialStartedAt = now;
      this.values.set(balanceKey, JSON.stringify(balance));
      this.ledger.push({ id: 'trial-start:' + args[1], account: args[1], event: 'trial_started', time: now, creditsDelta: 0 });
      this.values.set(keys[1], JSON.stringify(this.ledger));
      return JSON.stringify({ ok: true, created: true, startedAt: now });
    }
    if (script.includes("event='test_adjust'")) {
      const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
      const creditsBefore = Number(balance.credits) || 0;
      if (args[0] !== '') balance.credits = Number(args[0]);
      if (args[1] === 'clear') balance.trialStartedAt = null;
      else if (args[1] !== '') balance.trialStartedAt = Number(args[1]);
      if (args[5] === 'clear') balance.subscriptionExpiresAt = null;
      this.values.set(balanceKey, JSON.stringify(balance));
      this.ledger.push({ id: args[4], account: args[3], event: 'test_adjust', time: Number(args[2]), creditsDelta: (Number(balance.credits) || 0) - creditsBefore, trialStartedAt: balance.trialStartedAt ?? null, clearPass: args[5] === 'clear', subscriptionExpiresAt: balance.subscriptionExpiresAt ?? null });
      this.values.set(keys[1], JSON.stringify(this.ledger));
      return JSON.stringify({ ok: true });
    }
    if (script.includes("local prior = redis.call('GET', KEYS[2])")) {
      const prior = this.values.get(transactionKey);
      if (prior) {
        const old = JSON.parse(prior);
        return old.gameId && old.gameId !== args[1] ? JSON.stringify({ ok: false, code: 'iap-session-conflict' }) : prior;
      }
      const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
      const now = Number(args[0]), started = Number(balance.trialStartedAt) || 0;
      const endsAt = started + Number(args[3]) * 86400000;
      let mode = '';
      if (started > 0 && now >= started && now <= endsAt + 1800000) mode = 'trial';
      else if ((Number(balance.subscriptionExpiresAt) || 0) > now) mode = 'subscription';
      else if ((Number(balance.credits) || 0) > 0) { mode = 'credit'; balance.credits -= 1; }
      else return JSON.stringify({ ok: false, code: 'iap-no-credit' });
      const result = { ok: true, mode, gameId: args[1], balance: { credits: Number(balance.credits) || 0, subscriptionExpiresAt: balance.subscriptionExpiresAt || null, freeUsedByGame: balance.freeUsedByGame || {} } };
      this.values.set(balanceKey, JSON.stringify(balance));
      this.values.set(transactionKey, JSON.stringify(result));
      return JSON.stringify(result);
    }
    assert.match(script, /local marker = redis\.call\('GET', KEYS\[4\]\)/);
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

test('trial starts once, keeps legacy free fields, and reports a server-clock seven-day window', async () => {
  const store = new MemoryIapStore();
  const startedAt = 1_800_000_000_000;
  __setIapStoreForTest(store);
  try {
    assert.equal(FREE_SESSIONS_PER_GAME, 0);
    assert.equal(TRIAL_DAYS, 7);
    assert.deepEqual(IAP_GAME_IDS, ['ghaws', 'harb', 'test', 'board', 'hanna']);
    assert.equal((await startTrial(account, startedAt)).created, true);
    assert.equal((await startTrial(account, startedAt + 4 * 86400000)).created, false);
    const balance = await readBalance(account, startedAt + 86400000);
    assert.equal(balance.trial.startedAt, startedAt);
    assert.equal(balance.trial.endsAt, startedAt + 7 * 86400000);
    assert.equal(balance.trial.active, true);
    assert.equal(balance.trial.daysLeft, 6);
    assert.deepEqual(balance.freeTotalPerGame, Object.fromEntries(IAP_GAME_IDS.map((id) => [id, 0])));
    assert.deepEqual(balance.freeRemainingByGame, Object.fromEntries(IAP_GAME_IDS.map((id) => [id, 0])));
    assert.equal(store.ledger.filter((row) => row.event === 'trial_started').length, 1);
  } finally { __resetIapStore(); }
});

test('trial consume is free through the 30-minute grace, then one stable credit is deducted at start', async () => {
  const store = new MemoryIapStore();
  const startedAt = 1_800_000_000_000;
  const endsAt = startedAt + 7 * 86400000;
  __setIapStoreForTest(store);
  try {
    await startTrial(account, startedAt);
    const inTrial = await consumeSession(account, 'trial-session-0000001', 'ghaws', 'automatic', startedAt + 1000);
    assert.equal(inTrial.mode, 'trial');
    assert.equal((await readBalance(account, startedAt + 1000)).credits, 0);
    const grace = await consumeSession(account, 'grace-session-000001', 'harb', 'automatic', endsAt + 1800000);
    assert.equal(grace.mode, 'trial');
    const beyondGrace = await consumeSession(account, 'beyond-grace-00001', 'board', 'automatic', endsAt + 1800001);
    assert.deepEqual(beyondGrace, { ok: false, code: 'iap-no-credit' });

    await testAdjustBalance(account, { credits: 2 }, endsAt + 1800002);
    const sessionId = 'credit-session-000001';
    const first = await consumeSession(account, sessionId, 'test', 'automatic', endsAt + 1800002);
    const retry = await consumeSession(account, sessionId, 'test', 'automatic', endsAt + 1800003);
    assert.equal(first.mode, 'credit');
    assert.equal(retry.mode, 'credit');
    assert.equal((await readBalance(account, endsAt + 1800003)).credits, 1);
  } finally { __resetIapStore(); }
});

test('trial-start API only creates trials for enforced accounts', async () => {
  let starts = 0;
  const dependencies = {
    sessionState: async () => ({ state: 'live', record: { accountKey: account } }),
    startTrial: async () => { starts += 1; return { created: true }; },
    readBalance: async () => ({ trial: { startedAt: 10, endsAt: 20, active: true, daysLeft: 7 } }),
    isIapEnforced: () => false,
  };
  const unenforced = responseDouble();
  await handleIapTrialStart(request('POST', { 'x-ezik-session': session }), unenforced, dependencies);
  assert.equal(unenforced.statusCode, 200);
  assert.equal(unenforced.body.trial, null);
  assert.equal(starts, 0);

  const enforced = responseDouble();
  await handleIapTrialStart(request('POST', { 'x-ezik-session': session }), enforced, { ...dependencies, isIapEnforced: () => true });
  assert.equal(enforced.statusCode, 200);
  assert.equal(enforced.body.enforced, true);
  assert.equal(starts, 1);
});

test('test adjustment is restricted to the listed signed-in caller and validates every field', async () => {
  let changed = 0;
  const adjustments = [];
  const dependencies = {
    sessionState: async () => ({ state: 'live', record: { accountKey: account } }),
    iapEnforcementMode: () => 'test',
    isIapEnforced: () => true,
    testAdjustBalance: async (who, adjustment) => { changed += 1; assert.equal(who, account); adjustments.push(adjustment); return { ok: true }; },
    readBalance: async () => ({ credits: 3, subscriptionExpiresAt: null, trial: null }),
  };
  for (const mode of ['off', 'all']) {
    const denied = responseDouble();
    await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: true }), denied, { ...dependencies, iapEnforcementMode: () => mode });
    assert.equal(denied.statusCode, 403);
  }
  const signedOut = responseDouble();
  await handleIapTestAdjust(request('POST', {}, { clearPass: true }), signedOut, dependencies);
  assert.equal(signedOut.statusCode, 403);
  const unlisted = responseDouble();
  await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: true }), unlisted, { ...dependencies, isIapEnforced: () => false });
  assert.equal(unlisted.statusCode, 403);
  const invalid = responseDouble();
  await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { credits: 21 }), invalid, dependencies);
  assert.equal(invalid.statusCode, 400);
  const invalidClearPass = responseDouble();
  await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: false }), invalidClearPass, dependencies);
  assert.equal(invalidClearPass.statusCode, 400);
  assert.equal(changed, 0);
  const allowed = responseDouble();
  await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: true }), allowed, dependencies);
  assert.equal(allowed.statusCode, 200);
  assert.equal(changed, 1);
  assert.deepEqual(adjustments, [{ clearPass: true }]);
  assert.equal(allowed.body.subscriptionExpiresAt, null);
});

test('test adjustment clears the listed caller pass and combines fields in one ledger event', async () => {
  const store = new MemoryIapStore();
  const now = Date.now() - 1000;
  __setIapStoreForTest(store);
  try {
    await testAdjustBalance(account, { credits: 8, trialDays: 0 }, now);
    const balanceKey = [...store.values.keys()].find((key) => key.endsWith(':balance'));
    const seeded = JSON.parse(store.values.get(balanceKey));
    seeded.subscriptionExpiresAt = now + 30 * 86400000;
    store.values.set(balanceKey, JSON.stringify(seeded));
    const beforeValues = new Map(store.values);
    const beforeLedgerCount = store.ledger.length;
    const dependencies = {
      sessionState: async () => ({ state: 'live', record: { accountKey: account } }),
      iapEnforcementMode: () => 'test',
      isIapEnforced: (who) => who === account,
    };

    for (const mode of ['off', 'all']) {
      const denied = responseDouble();
      await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: true }), denied, { ...dependencies, iapEnforcementMode: () => mode });
      assert.equal(denied.statusCode, 403);
      assert.deepEqual(store.values, beforeValues);
      assert.equal(store.ledger.length, beforeLedgerCount);
    }
    const signedOut = responseDouble();
    await handleIapTestAdjust(request('POST', {}, { clearPass: true }), signedOut, dependencies);
    assert.equal(signedOut.statusCode, 403);
    assert.deepEqual(store.values, beforeValues);
    assert.equal(store.ledger.length, beforeLedgerCount);

    const unlisted = responseDouble();
    await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: true }), unlisted, { ...dependencies, isIapEnforced: () => false });
    assert.equal(unlisted.statusCode, 403);
    assert.deepEqual(store.values, beforeValues);
    assert.equal(store.ledger.length, beforeLedgerCount);

    const allowed = responseDouble();
    await handleIapTestAdjust(request('POST', { 'x-ezik-session': session }, { clearPass: true, trialDays: 8, credits: 0 }), allowed, {
      ...dependencies,
      testAdjustBalance,
      readBalance,
    });
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.body.credits, 0);
    assert.equal(allowed.body.subscriptionExpiresAt, null);
    assert.equal(allowed.body.trial.active, false);
    const adjustedTrialStartedAt = allowed.body.trial.startedAt;
    assert.ok(Math.abs(adjustedTrialStartedAt - (Date.now() - 8 * 86400000)) < 10000);
    const balance = await readBalance(account, now);
    assert.equal(balance.subscriptionExpiresAt, null);
    assert.equal(balance.credits, 0);
    assert.equal(balance.trial.startedAt, adjustedTrialStartedAt);
    assert.equal(store.ledger.length, beforeLedgerCount + 1);
    const event = store.ledger.at(-1);
    assert.equal(event.account, account);
    assert.equal(event.event, 'test_adjust');
    assert.equal(event.creditsDelta, -8);
    assert.equal(event.trialStartedAt, adjustedTrialStartedAt);
    assert.equal(event.clearPass, true);
    assert.equal(event.subscriptionExpiresAt, null);
  } finally { __resetIapStore(); }
});

test('new non-renewing pass ids grant month/year access and their cancellation webhooks refund', async () => {
  assert.equal(IAP_PRODUCTS.ezik_pass_month_1.months, 1);
  assert.equal(IAP_PRODUCTS.ezik_pass_year_1.months, 12);
  assert.equal(IAP_PRODUCTS.ezik_month_1.months, 1);
  assert.equal(IAP_PRODUCTS.ezik_year_1.months, 12);
  assert.equal(IAP_PRODUCTS.ezik_pass_month_1.nonRenewing, true);
  const store = new MemoryIapStore();
  const hookKey = 'hook-key';
  const eventBase = { app_user_id: account, store: 'APP_STORE', transaction_id: 'new-pass-transaction', event_timestamp_ms: Date.now() };
  __setIapStoreForTest(store);
  const oldSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.REVENUECAT_WEBHOOK_SECRET = hookKey;
  try {
    for (const productId of ['ezik_pass_month_1', 'ezik_pass_year_1']) {
      const purchase = responseDouble();
      await handleIapWebhook(request('POST', { authorization: hookKey }, { event: { ...eventBase, type: 'NON_RENEWING_PURCHASE', product_id: productId, transaction_id: productId } }), purchase, { readJsonStrict: async () => ({ ok: true, value: { v: 1 } }) });
      assert.equal(purchase.statusCode, 200);
      assert.equal(purchase.body.status, 'applied');
      const refund = responseDouble();
      await handleIapWebhook(request('POST', { authorization: hookKey }, { event: { ...eventBase, type: 'CANCELLATION', product_id: productId, transaction_id: productId, cancel_reason: 'CUSTOMER_REQUEST', price: 1 } }), refund, { readJsonStrict: async () => ({ ok: true, value: { v: 1 } }) });
      assert.equal(refund.statusCode, 200);
      assert.equal(refund.body.status, 'applied');
    }
    assert.ok(store.ledger.some((row) => row.product === 'ezik_pass_month_1' && row.event === 'CANCELLATION'));
    assert.ok(store.ledger.some((row) => row.product === 'ezik_pass_year_1' && row.event === 'CANCELLATION'));
  } finally {
    if (oldSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SECRET;
    else process.env.REVENUECAT_WEBHOOK_SECRET = oldSecret;
    __resetIapStore();
  }
});

function makeBridge({ mode = 'all', accountSession = null, balance = {}, prices = null, pathname = '/quest.html', search = '', statusError = false, balanceError = false } = {}) {
  const sourcePromise = readFile(new URL('../hanna-laha/assets/iap-bridge-v1.js', import.meta.url), 'utf8');
  return sourcePromise.then((source) => {
    const { document } = parseHTML('<html><body></body></html>');
    document.readyState = 'complete';
    document.visibilityState = 'visible';
    const values = new Map(accountSession ? [['ezik_auth_session_v1', JSON.stringify(accountSession)]] : []);
    const localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
    const sessionValues = new Map();
    const sessionStorage = { getItem: (key) => sessionValues.get(key) || null, setItem: (key, value) => sessionValues.set(key, String(value)), removeItem: (key) => sessionValues.delete(key) };
    const listeners = new Map(), posted = [], state = { ...balance };
    const window = {
      location: { pathname, search, hash: '', href: '' },
      addEventListener(type, listener) { const set = listeners.get(type) || new Set(); set.add(listener); listeners.set(type, set); },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); },
      sessionStorage,
      ReactNativeWebView: prices ? { postMessage(raw) {
        const message = JSON.parse(raw); posted.push(message);
        let detail;
        if (message.type === 'iap.identify') detail = { v: 1, id: message.id, type: 'iap.identify.result', ok: true };
        else if (message.type === 'iap.prices') detail = { v: 1, id: message.id, type: 'iap.prices.result', ok: true, prices };
        else if (message.type === 'iap.buy') {
          if (message.productId === 'ezik_games_3') state.credits = (Number(state.credits) || 0) + 3;
          else state.subscriptionExpiresAt = Date.now() + 30 * 86400000;
          detail = { v: 1, id: message.id, type: 'iap.buy.result', status: 'purchased', productId: message.productId };
        }
        setTimeout(() => window.dispatchEvent({ type: 'ezik-iap', detail }), 0);
      } } : undefined,
      ezikIapPollPending: async () => true,
    };
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const element = originalCreateElement(tag);
      if (typeof element.focus !== 'function') element.focus = () => {};
      return element;
    };
    const calls = [];
    const fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/api/iap-status')) return statusError ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ mode }) };
      if (String(url).endsWith('/api/iap-balance')) return balanceError ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ appUserId: account, enforced: state.enforced !== false, credits: Number(state.credits) || 0, subscriptionExpiresAt: state.subscriptionExpiresAt || null, subscriptionActive: Number(state.subscriptionExpiresAt) > Date.now(), trial: state.trial ?? null }) };
      if (String(url).endsWith('/api/iap-trial-start')) { state.trial = { startedAt: Date.now(), endsAt: Date.now() + 7 * 86400000, active: true, daysLeft: 7 }; return { ok: true, status: 200, json: async () => ({ ok: true, enforced: true, created: true, trial: state.trial }) }; }
      if (String(url).endsWith('/api/iap-consume')) return { ok: true, status: 200, json: async () => ({ ok: true, mode: 'credit' }) };
      throw new Error('unexpected-fetch: ' + String(url));
    };
    vm.runInNewContext(source, { window, document, localStorage, sessionStorage, fetch, setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams, console, Date, Math });
    return { window, document, localStorage, sessionStorage, calls, posted, state };
  });
}

test('home purchase visibility requires a confirmed native iOS bridge and gates fallback and auto-open', async () => {
  async function homeState(options) {
    const bridge = await makeBridge(options);
    const updates = [];
    await bridge.window.ezikIapEnterHome((notice, applicable) => updates.push({ notice, applicable }));
    return { bridge, updates, applicable: updates.at(-1)?.applicable };
  }

  for (const options of [
    { mode: 'off' },
    { mode: 'off', accountSession: { session } },
    { mode: 'test' },
    { mode: 'test', accountSession: { session }, balance: { enforced: false } },
    { mode: 'test', accountSession: { session }, balanceError: true },
    { mode: 'all', statusError: true },
  ]) {
    const result = await homeState(options);
    assert.equal(result.applicable, false, JSON.stringify(options));
  }

  const listed = await homeState({ mode: 'test', accountSession: { session } });
  assert.equal(listed.applicable, false);
  assert.ok(listed.updates.some(({ notice }) => notice?.kind === 'trial'));
  const allSignedOut = await homeState({ mode: 'all' });
  assert.equal(allSignedOut.applicable, false);
  assert.equal(allSignedOut.updates.at(-1).notice.kind, 'sign-in');
  const allSignedIn = await homeState({ mode: 'all', accountSession: { session }, balance: { enforced: false } });
  assert.equal(allSignedIn.applicable, false);

  const [journey, fallback, fallbackScript] = await Promise.all([
    readFile(new URL('../quest-theme/journey.js', import.meta.url), 'utf8'),
    readFile(new URL('../quest.html', import.meta.url), 'utf8'),
    readFile(new URL('../quest-theme/iap-fallback.js', import.meta.url), 'utf8'),
  ]);
  const state = { homePurchasesApplicable: false, homeNotice: null };
  const buttonSource = journey.match(/function button\(label, action, className = 'j-btn', attrs = ''\) \{[\s\S]*?\n  \}/)[0];
  const makeButton = new Function('M', 'game', buttonSource + '; return button;')(state, 'hub');
  const homeSource = journey.match(/function home\(\) \{[\s\S]*?\n  \}/)[0];
  const markup = new Function('M', 'button', 'homeNoticeMarkup', 'names', 'Icons', homeSource + '; return home;')(state, makeButton, () => '', {}, { icon: () => '' });
  assert.doesNotMatch(markup(), /data-action="iap-purchase"/);
  state.homePurchasesApplicable = true;
  assert.match(markup(), /data-action="iap-purchase"/);
  const dismissal = journey.match(/else if \(action === 'dismiss-home-notice' && game === 'hub'\) \{ ([^}]*) \}/)[1];
  new Function('M', 'render', dismissal)(state, () => {});
  assert.equal(state.homeNotice, null);
  assert.match(markup(), /data-action="iap-purchase"/);

  const setterSource = journey.match(/function setHomeNotice\(notice, purchaseApplicable\) \{[\s\S]*?\n  \}/)[0];
  let opens = 0;
  const setNotice = new Function('M', 'IAP_EXPIRED_NOTICE_KEY', 'render', 'global', 'location', 'sessionStorage', setterSource + '; return setHomeNotice')(
    { homePurchasesApplicable: false, homeNotice: null }, 'notice-key', () => {},
    { ezikIapOpenPurchase: () => { opens += 1; } }, { search: '?iap_purchase=1' },
    { getItem: () => null, setItem: () => {} },
  );
  setNotice(null, false);
  assert.equal(opens, 0);
  setNotice(null, true);
  assert.equal(opens, 1);

  assert.match(fallback, /<a class="iap-purchase"[^>]*\shidden/);
  assert.match(fallback, /quest-theme\/iap-fallback\.js\?v=20261023-iapg5/);
  assert.match(fallbackScript, /window\.ezikIapEnterHome\(function \(_notice, applicable\)/);
  assert.match(fallbackScript, /link\.hidden = applicable !== true/);
  assert.match(fallbackScript, /status !== 'fallback'/);
});

test('first direct game entry discloses the week before starting it, and expired no-credit accounts are blocked', async () => {
  const off = await makeBridge({ mode: 'off' });
  assert.equal(await off.window.ezikIapCheckGameAccess('ghaws', () => {}, '/quest-ghaws.html'), true);
  assert.deepEqual(off.calls.map((call) => call.url), ['../api/iap-status']);

  const signedOutTest = await makeBridge({ mode: 'test' });
  assert.equal(await signedOutTest.window.ezikIapCheckGameAccess('test', () => {}, '/quest-test.html'), true);
  assert.equal(signedOutTest.document.querySelector('[role="dialog"]'), null);

  const firstEntry = await makeBridge({ mode: 'all', accountSession: { session } });
  let entered = 0;
  assert.equal(await firstEntry.window.ezikIapCheckGameAccess('board', () => { entered += 1; }, '/quest-board.html'), false);
  assert.match(firstEntry.document.body.textContent, /مجانية لك لمدة ٧ أيام/);
  assert.match(firstEntry.document.body.textContent, /بعد الأسبوع، يلزم اشتراك أسبوع أو شهر أو سنة/);
  assert.equal(firstEntry.calls.filter((call) => call.url.endsWith('/api/iap-trial-start')).length, 0);
  [...firstEntry.document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'ابدأ أسبوعك المجاني').click();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(entered, 1);
  assert.equal(firstEntry.calls.filter((call) => call.url.endsWith('/api/iap-trial-start')).length, 1);
  assert.equal(firstEntry.state.trial.active, true);
  assert.equal(firstEntry.document.querySelector('[role="dialog"]'), null);

  const unlistedTestAccount = await makeBridge({ mode: 'test', accountSession: { session }, balance: { enforced: false, trial: null, credits: 0 } });
  assert.equal(await unlistedTestAccount.window.ezikIapCheckGameAccess('harb', () => {}, '/quest-harb.html'), true);
  assert.equal(unlistedTestAccount.calls.some((call) => call.url.endsWith('/api/iap-trial-start')), false);

  const expired = await makeBridge({ mode: 'all', accountSession: { session }, balance: { trial: { startedAt: 10, endsAt: 20, active: false, daysLeft: 0 }, credits: 0 } });
  assert.equal(await expired.window.ezikIapCheckGameAccess('hanna', () => {}, '/hanna-laha/'), false);
  assert.match(expired.document.body.textContent, /انتهت تجربتك المجانية/);
  assert.deepEqual([...expired.document.querySelectorAll('[role="dialog"] button')].map((node) => node.textContent), ['اشتر لعبة', 'انضم لغرفة برمز']);
  assert.equal(expired.document.querySelector('.ezik-iap-row'), null);

  const expiredSingle = await makeBridge({ mode: 'all', accountSession: { session }, balance: { trial: { startedAt: 10, endsAt: 20, active: false, daysLeft: 0 }, credits: 0 } });
  assert.equal(await expiredSingle.window.ezikIapCheckGameAccess('ghaws', () => {}, '/quest-ghaws.html'), false);
  assert.deepEqual([...expiredSingle.document.querySelectorAll('[role="dialog"] button')].map((node) => node.textContent), ['اشتر لعبة']);
});

test('expired accounts are blocked from all five home tiles and direct game URLs in all mode', async () => {
  const routes = [
    ['ghaws', '/quest-ghaws.html'], ['harb', '/quest-harb.html'], ['test', '/quest-test.html'],
    ['board', '/quest-board.html'], ['hanna', '/hanna-laha/'],
  ];
  const balance = { trial: { startedAt: 10, endsAt: 20, active: false, daysLeft: 0 }, credits: 0 };
  for (const [gameId, route] of routes) {
    const tile = await makeBridge({ mode: 'all', accountSession: { session }, balance });
    const anchor = tile.document.createElement('a');
    anchor.setAttribute('href', route);
    tile.document.body.append(anchor);
    const click = tile.document.createEvent('Event');
    click.initEvent('click', true, true);
    anchor.dispatchEvent(click);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(click.defaultPrevented, true, gameId + ' tile must be intercepted');
    assert.match(tile.document.body.textContent, /انتهت تجربتك المجانية/);

    const direct = await makeBridge({ mode: 'all', accountSession: { session }, balance, pathname: route });
    assert.equal(await direct.window.ezikIapPageGate, false, gameId + ' direct URL must be blocked');
    assert.match(direct.document.body.textContent, /الرجاء الشراء للدخول/);
  }
});

test('off and signed-out test mode show no home notice or trial start', async () => {
  for (const mode of ['off', 'test']) {
    const bridge = await makeBridge({ mode });
    let notice;
    await bridge.window.ezikIapEnterHome((value) => { notice = value; });
    assert.equal(notice, null);
    assert.equal(bridge.calls.some((call) => call.url.endsWith('/api/iap-trial-start')), false);
  }
  const allSignedOut = await makeBridge({ mode: 'all' });
  let notice;
  await allSignedOut.window.ezikIapEnterHome((value) => { notice = value; });
  assert.equal(notice.kind, 'sign-in');
  assert.equal(allSignedOut.calls.some((call) => call.url.endsWith('/api/iap-trial-start')), false);

  const firstEntry = await makeBridge({ mode: 'all', accountSession: { session } });
  let firstNotice;
  await firstEntry.window.ezikIapEnterHome((value) => { firstNotice = value; });
  assert.equal(firstNotice.kind, 'trial');
  assert.equal(firstNotice.trial.active, true);
  assert.equal(firstNotice.trial.daysLeft, 7);
  assert.equal(firstEntry.calls.filter((call) => call.url.endsWith('/api/iap-trial-start')).length, 1);
});

test('all-mode signed-out join links bypass sign-in; every direct game page gets an entry gate', async () => {
  for (const [pathname, search] of [
    ['/hanna-laha/join', '?rooms=1'],
    ['/hanna-laha/j/1234', ''],
    ['/quest-board.html', '?board=1234'],
    ['/quest-harb.html', '?iap_join=1'],
  ]) {
    const bridge = await makeBridge({ mode: 'all', pathname, search });
    assert.equal(await bridge.window.ezikIapPageGate, true);
    assert.equal(bridge.document.querySelector('[role="dialog"]'), null);
    assert.deepEqual(bridge.calls, []);
  }
  const direct = await makeBridge({ mode: 'all', pathname: '/quest-test.html' });
  assert.equal(await direct.window.ezikIapPageGate, false);
  assert.ok(direct.document.querySelector('[role="dialog"] a[href="/?ezik_iap_signin=1"]'));
  const directFirstEntry = await makeBridge({ mode: 'all', accountSession: { session }, pathname: '/quest-ghaws.html' });
  assert.equal(await directFirstEntry.window.ezikIapPageGate, false);
  assert.match(directFirstEntry.document.body.textContent, /مجانية لك لمدة ٧ أيام/);
  assert.equal(directFirstEntry.calls.some((call) => call.url.endsWith('/api/iap-trial-start')), false);
  const journey = await readFile(new URL('../quest-theme/journey.js', import.meta.url), 'utf8');
  for (const game of ['ghaws', 'harb', 'test', 'board', 'hanna']) assert.ok(journey.includes("'" + game + "'"));
  assert.match(journey, /ezikIapPageGate/);
  assert.match(journey, /ezikIapCheckGameAccess/);
  assert.match(journey, /beginWithIap\(\)/);
});

test('credit confirmation occurs before local start, and product rows choose new then legacy ids by shell prices', async () => {
  const bridge = await makeBridge({ mode: 'all', accountSession: { session }, balance: { credits: 1, trial: { startedAt: 10, endsAt: 20, active: false, daysLeft: 0 } } });
  let started = 0;
  bridge.window.ezikIapStart(() => { started += 1; return true; }, 'local-id-1234567890', 'test', { cycle: '1' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(started, 0);
  assert.match(bridge.document.body.textContent, /سيُخصم من رصيدك جلسة واحدة/);
  [...bridge.document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'ابدأ').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(started, 1);
  assert.equal(bridge.calls.some((call) => call.url.endsWith('/api/iap-consume')), true);

  let releaseRoomStart;
  let roomStarted = 0;
  const room = await makeBridge({ mode: 'all', accountSession: { session }, balance: { credits: 1, trial: { startedAt: 10, endsAt: 20, active: false, daysLeft: 0 } } });
  room.window.ezikIapStart(() => { roomStarted += 1; return true; }, 'room-code', 'harb', {
    cycle: '1', waitForStart: () => ({ promise: new Promise((resolve) => { releaseRoomStart = resolve; }), cancel() {} }),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  [...room.document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'ابدأ').click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(roomStarted, 1);
  assert.equal(room.calls.some((call) => call.url.endsWith('/api/iap-consume')), false);
  releaseRoomStart();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(room.calls.some((call) => call.url.endsWith('/api/iap-consume')), true);

  for (const entitlement of [
    { trial: { startedAt: 10, endsAt: 20, active: true, daysLeft: 4 }, credits: 1 },
    { trial: { startedAt: 10, endsAt: 20, active: false, daysLeft: 0 }, credits: 0, subscriptionExpiresAt: Date.now() + 86400000 },
  ]) {
    const freeStart = await makeBridge({ mode: 'all', accountSession: { session }, balance: entitlement });
    let began = 0;
    freeStart.window.ezikIapStart(() => { began += 1; return true; }, 'free-session', 'ghaws');
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(began, 1);
    assert.equal(freeStart.document.querySelector('[role="dialog"]'), null);
  }

  for (const [prices, expected] of [
    [{ ezik_games_3: {}, ezik_pass_month_1: { priceString: '$1', price: 1, currencyCode: 'USD' }, ezik_pass_year_1: { priceString: '$2', price: 2, currencyCode: 'USD' } }, ['ezik_pass_month_1', 'ezik_pass_year_1']],
    [{ ezik_games_3: {}, ezik_month_1: { priceString: '$1', price: 1, currencyCode: 'USD' }, ezik_year_1: { priceString: '$2', price: 2, currencyCode: 'USD' } }, []],
  ]) {
    const purchase = await makeBridge({ mode: 'off', accountSession: { session }, balance: { credits: 0 }, prices });
    purchase.window.ezikIapOpenPurchase();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const rows = [...purchase.document.querySelectorAll('.ezik-iap-row')];
    for (const row of rows) {
      row.querySelector('input').value = '1';
      row.querySelector('button').click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const bought = purchase.posted.filter((message) => message.type === 'iap.buy').map((message) => message.productId);
    assert.deepEqual(bought, expected);
  }
  const webPanel = await makeBridge({ mode: 'off', accountSession: { session } });
  webPanel.window.ezikIapOpenPurchase();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(webPanel.document.querySelector('a[href^="https://apps.apple.com/"]'));
  assert.equal(webPanel.document.querySelector('.ezik-iap-row'), null);
  webPanel.document.querySelector('[role="dialog"] button').click();
});

test('purchase surfaces remain on the home page and the home has one visible purchase entry', async () => {
  const [home, journey, bridge, harb, board, hanna] = await Promise.all([
    readFile(new URL('../quest.html', import.meta.url), 'utf8'),
    readFile(new URL('../quest-theme/journey.js', import.meta.url), 'utf8'),
    readFile(new URL('../hanna-laha/assets/iap-bridge-v1.js', import.meta.url), 'utf8'),
    readFile(new URL('../quest-harb.html', import.meta.url), 'utf8'),
    readFile(new URL('../quest-board.html', import.meta.url), 'utf8'),
    readFile(new URL('../hanna-laha/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /ezikIapOpenPurchase/);
  assert.match(journey, /button\('اشتر لعبة', 'iap-purchase'/);
  assert.match(journey, /data-game-entry=/);
  assert.match(bridge, /function showProducts\(/);
  assert.match(bridge, /if \(active\) return;\s+initializePurchase\(\)/);
  for (const gamePage of [harb, board, hanna]) {
    assert.doesNotMatch(gamePage, /ezik-iap-row|خيارات الشراء|جلسة مجانية لكل لعبة/);
  }
  assert.match(bridge, /button\('اشتر لعبة', function \(\) \{ navigateToMainPurchase\(returnPath\); \}\)/);
});
