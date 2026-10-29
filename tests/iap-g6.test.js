import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

import { handleIapBalance } from '../api/iap-balance.js';
import { handleIapWebhook } from '../api/iap-webhook.js';
import {
  __resetIapStore,
  __setIapStoreForTest,
  applyTransactionEvent,
  IAP_PRODUCTS,
  readBalance,
} from '../lib/iap/store.js';

const account = 'acct:v1:google:iap-g6';
const session = 'g'.repeat(32);
const DAY = 24 * 60 * 60 * 1000;

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

class MemoryIapStore {
  values = new Map();
  ledger = [];

  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }

  async eval(script, keys, args) {
    const [balanceKey, transactionKey, ledgerKey, markerKey] = keys;
    assert.match(script, /local marker = redis\.call\('GET', KEYS\[4\]\)/);
    if (this.values.has(markerKey)) return 'DUPLICATE';
    const currentTransaction = this.values.get(transactionKey) || '';
    if (currentTransaction !== args[0]) return 'RETRY';
    const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
    if ((Number(balance.credits) || 0) !== Number(args[1])) return 'RETRY';
    if ((Number(balance.subscriptionExpiresAt) || 0) !== Number(args[2])) return 'RETRY';
    const gameIds = JSON.parse(args[3]);
    const usage = balance.freeUsedByGame || {};
    for (let i = 0; i < gameIds.length; i += 1) {
      if ((Number(usage[gameIds[i]]) || 0) !== Number(args[5 + i])) return 'RETRY';
    }
    this.values.set(balanceKey, args[5 + gameIds.length]);
    this.values.set(transactionKey, args[6 + gameIds.length]);
    this.values.set(markerKey, '1');
    this.ledger.push(JSON.parse(args[7 + gameIds.length]));
    this.values.set(ledgerKey, JSON.stringify(this.ledger));
    return 'APPLIED';
  }
}

function makeBridge({
  mode = 'all', accountSession = { session }, balance = {}, prices = null,
  pathname = '/quest.html', search = '',
} = {}) {
  return readFile(new URL('../hanna-laha/assets/iap-bridge-v1.js', import.meta.url), 'utf8').then((source) => {
    const { document } = parseHTML('<html><body></body></html>');
    document.readyState = 'complete';
    document.visibilityState = 'visible';
    const storage = new Map(accountSession ? [['ezik_auth_session_v1', JSON.stringify(accountSession)]] : []);
    const localStorage = {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    };
    const listeners = new Map();
    const posted = [];
    const state = { enforced: true, ...balance };
    const window = {
      location: { pathname, search, hash: '', href: '' },
      addEventListener(type, listener) {
        const set = listeners.get(type) || new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); },
      sessionStorage: {
        getItem: (key) => null,
        setItem: () => {},
        removeItem: () => {},
      },
      ezikIapPollPending: async () => true,
    };
    if (prices) {
      window.ReactNativeWebView = {
        postMessage(raw) {
          const message = JSON.parse(raw);
          posted.push(message);
          let detail;
          if (message.type === 'iap.identify') {
            detail = { v: 1, id: message.id, type: 'iap.identify.result', ok: true };
          } else if (message.type === 'iap.prices') {
            detail = { v: 1, id: message.id, type: 'iap.prices.result', ok: true, prices };
          } else if (message.type === 'iap.buy') {
            const duration = message.productId === 'ezik_pass_week_1' ? 7 * DAY
              : message.productId === 'ezik_pass_year_1' ? 365 * DAY : 30 * DAY;
            state.subscriptionExpiresAt = Date.now() + duration;
            detail = { v: 1, id: message.id, type: 'iap.buy.result', status: 'purchased', productId: message.productId };
          }
          setTimeout(() => window.dispatchEvent({ type: 'ezik-iap', detail }), 0);
        },
      };
    }
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const element = originalCreateElement(tag);
      if (typeof element.focus !== 'function') element.focus = () => {};
      return element;
    };
    const calls = [];
    const fetch = async (url) => {
      const value = String(url);
      calls.push(value);
      if (value.endsWith('/api/iap-status')) {
        return { ok: true, status: 200, json: async () => ({ mode }) };
      }
      if (value.endsWith('/api/iap-balance')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            appUserId: account,
            enforced: state.enforced !== false,
            purchaseEntry: state.purchaseEntry === true,
            credits: Number(state.credits) || 0,
            subscriptionExpiresAt: state.subscriptionExpiresAt || null,
            subscriptionActive: Number(state.subscriptionExpiresAt) > Date.now(),
            trial: state.trial ?? null,
          }),
        };
      }
      if (value.endsWith('/api/iap-trial-start')) {
        state.trial = { startedAt: Date.now(), endsAt: Date.now() + 7 * DAY, active: true, daysLeft: 7 };
        return { ok: true, status: 200, json: async () => ({ ok: true, enforced: true, created: true, trial: state.trial }) };
      }
      if (value.endsWith('/api/iap-consume')) {
        return { ok: true, status: 200, json: async () => ({ ok: true, mode: 'credit' }) };
      }
      throw new Error('unexpected-fetch: ' + value);
    };
    vm.runInNewContext(source, {
      window, document, localStorage, sessionStorage: window.sessionStorage, fetch,
      setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams, console, Date, Math,
    });
    return { window, document, calls, posted, state };
  });
}

test('week pass grants seven days, extends an active pass, refunds seven days, and keeps a past expiry', async () => {
  assert.equal(IAP_PRODUCTS.ezik_pass_week_1.days, 7);
  assert.equal(IAP_PRODUCTS.ezik_pass_week_1.nonRenewing, true);
  assert.equal(IAP_PRODUCTS.ezik_pass_month_1.months, 1);
  assert.equal(IAP_PRODUCTS.ezik_pass_year_1.months, 12);
  assert.equal(IAP_PRODUCTS.ezik_games_3.credits, 3);
  assert.equal(IAP_PRODUCTS.ezik_month_1.months, 1);
  assert.equal(IAP_PRODUCTS.ezik_year_1.months, 12);

  const store = new MemoryIapStore();
  const secret = 'g6-test-key';
  const priorSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  __setIapStoreForTest(store);
  process.env.REVENUECAT_WEBHOOK_SECRET = secret;
  try {
    await applyTransactionEvent({
      accountKey: account, store: 'APP_STORE', transactionId: 'baseline-month',
      productId: 'ezik_pass_month_1', action: 'purchase', eventType: 'NON_RENEWING_PURCHASE', time: Date.now(),
    });
    const beforeWeek = await readBalance(account);
    const event = {
      app_user_id: account, store: 'APP_STORE', transaction_id: 'week-pass-transaction',
      product_id: 'ezik_pass_week_1', event_timestamp_ms: Date.now(),
    };
    const purchase = responseDouble();
    await handleIapWebhook({
      method: 'POST', headers: { authorization: secret },
      body: { event: { ...event, type: 'NON_RENEWING_PURCHASE' } },
    }, purchase, { readJsonStrict: async () => ({ ok: true, value: { version: 1 } }) });
    assert.equal(purchase.statusCode, 200);
    assert.equal(purchase.body.status, 'applied');
    const afterWeek = await readBalance(account);
    assert.equal(afterWeek.subscriptionExpiresAt, beforeWeek.subscriptionExpiresAt + 7 * DAY);

    const refund = responseDouble();
    await handleIapWebhook({
      method: 'POST', headers: { authorization: secret },
      body: { event: { ...event, type: 'CANCELLATION', cancel_reason: 'CUSTOMER_REQUEST', price: 1 } },
    }, refund, { readJsonStrict: async () => ({ ok: true, value: { version: 1 } }) });
    assert.equal(refund.statusCode, 200);
    assert.equal(refund.body.status, 'applied');
    const afterRefund = await readBalance(account);
    assert.ok(Math.abs(afterRefund.subscriptionExpiresAt - beforeWeek.subscriptionExpiresAt) < 1000);
    assert.ok(store.ledger.some((row) => row.product === 'ezik_pass_week_1' && row.event === 'CANCELLATION'));

    const pastBalance = await readBalance(account, afterRefund.subscriptionExpiresAt + 1);
    assert.equal(pastBalance.subscriptionExpiresAt, afterRefund.subscriptionExpiresAt);
    const pastExpiry = Date.now() - DAY;
    const balanceResponse = responseDouble();
    await handleIapBalance({ method: 'GET', headers: { 'x-ezik-session': session } }, balanceResponse, {
      sessionState: async () => ({ state: 'live', record: { accountKey: account } }),
      readBalance: async () => ({ credits: 0, subscriptionExpiresAt: pastExpiry, trial: null }),
      isIapEnforced: () => true,
    });
    assert.equal(balanceResponse.statusCode, 200);
    assert.equal(balanceResponse.body.subscriptionExpiresAt, pastExpiry);
    assert.equal(balanceResponse.body.subscriptionActive, false);
  } finally {
    if (priorSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SECRET;
    else process.env.REVENUECAT_WEBHOOK_SECRET = priorSecret;
    __resetIapStore();
  }
});

test('purchase rows use returned pass prices only, preserve ordering, and support the old shell reply', async () => {
  const oldShellPrices = {
    ezik_games_3: { priceString: '$5.99', price: 5.99, currencyCode: 'USD' },
    ezik_pass_month_1: { priceString: '$12.99', price: 12.99, currencyCode: 'USD' },
    ezik_pass_year_1: { priceString: '$35.99', price: 35.99, currencyCode: 'USD' },
  };
  const oldShell = await makeBridge({ mode: 'off', prices: oldShellPrices, balance: { credits: 0 } });
  oldShell.window.ezikIapOpenPurchase();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const request = oldShell.posted.find((message) => message.type === 'iap.prices');
  assert.deepEqual(request.productIds, ['ezik_pass_week_1', 'ezik_pass_month_1', 'ezik_pass_year_1']);
  const oldRows = [...oldShell.document.querySelectorAll('.ezik-iap-row')];
  assert.deepEqual(oldRows.map((row) => row.querySelector('h3').textContent), [
    'شهر لعب غير محدود', 'سنة لعب غير محدودة',
  ]);
  assert.doesNotMatch(oldShell.document.body.textContent, /ثلاث جلسات لعب/);
  assert.match(oldShell.document.body.textContent, /لا يوجد اشتراك/);
  assert.doesNotMatch(oldShell.document.body.textContent, /رصيدك:/);
  oldShell.document.querySelector('.ezik-iap-header button').click();

  const allPrices = {
    ezik_pass_week_1: { priceString: '$7.99', price: 7.99, currencyCode: 'USD' },
    ezik_pass_month_1: { priceString: '$12.99', price: 12.99, currencyCode: 'USD' },
    ezik_pass_year_1: { priceString: '$35.99', price: 35.99, currencyCode: 'USD' },
    ezik_games_3: { priceString: '$5.99', price: 5.99, currencyCode: 'USD' },
  };
  const allRows = await makeBridge({
    mode: 'off', prices: allPrices,
    balance: { credits: 2, subscriptionExpiresAt: Date.now() + DAY },
  });
  allRows.window.ezikIapOpenPurchase();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const rows = [...allRows.document.querySelectorAll('.ezik-iap-row')];
  assert.deepEqual(rows.map((row) => row.querySelector('h3').textContent), [
    'أسبوع لعب غير محدود', 'شهر لعب غير محدود', 'سنة لعب غير محدودة',
  ]);
  assert.match(allRows.document.body.textContent, /اشتراكك حتى/);
  assert.match(allRows.document.body.textContent, /رصيدك: ٢ جلسة/);
  allRows.document.querySelector('.ezik-iap-header button').click();

  const noReturnedWeekPrice = await makeBridge({
    mode: 'off', prices: { ...allPrices, ezik_pass_week_1: {} }, balance: { credits: 0 },
  });
  noReturnedWeekPrice.window.ezikIapOpenPurchase();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(
    [...noReturnedWeekPrice.document.querySelectorAll('.ezik-iap-row h3')].map((node) => node.textContent),
    ['شهر لعب غير محدود', 'سنة لعب غير محدودة'],
  );
  noReturnedWeekPrice.document.querySelector('.ezik-iap-header button').click();
});

test('active passes hide the home notice, and closing a completed purchase refreshes it away', async () => {
  const active = await makeBridge({
    mode: 'all', balance: { trial: { active: true, daysLeft: 4 }, subscriptionExpiresAt: Date.now() + DAY },
  });
  const activeUpdates = [];
  await active.window.ezikIapEnterHome((notice) => activeUpdates.push(notice));
  assert.equal(activeUpdates.at(-1), null);
  assert.equal(active.calls.some((url) => url.endsWith('/api/iap-trial-start')), false);

  const prices = {
    ezik_pass_week_1: { priceString: '$7.99', price: 7.99, currencyCode: 'USD' },
    ezik_pass_month_1: { priceString: '$12.99', price: 12.99, currencyCode: 'USD' },
    ezik_pass_year_1: { priceString: '$35.99', price: 35.99, currencyCode: 'USD' },
  };
  const home = await makeBridge({
    mode: 'all', prices,
    balance: { credits: 0, trial: { startedAt: 1, endsAt: 2, active: false, daysLeft: 0 } },
  });
  const updates = [];
  await home.window.ezikIapEnterHome((notice, applicable) => updates.push({ notice, applicable }));
  assert.equal(updates.at(-1).notice.kind, 'trial');
  assert.equal(updates.at(-1).notice.trial.active, false);
  home.window.ezikIapOpenPurchase();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const weekRow = home.document.querySelector('.ezik-iap-row');
  weekRow.querySelector('input').value = '1';
  weekRow.querySelector('button').click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.ok(home.state.subscriptionExpiresAt > Date.now());
  const readsBeforeClose = home.calls.filter((url) => url.endsWith('/api/iap-balance')).length;
  home.document.querySelector('.ezik-iap-header button').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(home.calls.filter((url) => url.endsWith('/api/iap-balance')).length, readsBeforeClose + 1);
  assert.equal(updates.at(-1).notice, null);
});

test('free mode unlocks games and room starts without a trial, balance prompt, or consume request', async () => {
  const visitor = await makeBridge({ mode: 'free', accountSession: null, balance: { enforced: false } });
  let allowed = 0;
  assert.equal(await visitor.window.ezikIapCheckGameAccess('ghaws', () => { allowed += 1; }, '/quest-ghaws.html'), true);
  assert.equal(allowed, 1);
  assert.equal(visitor.document.querySelector('[role="dialog"]'), null);

  let started = 0;
  visitor.window.ezikIapStart(() => { started += 1; return true; }, 'free-room', 'harb');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(started, 1);
  assert.equal(visitor.calls.filter((url) => url.endsWith('/api/iap-trial-start')).length, 0);
  assert.equal(visitor.calls.filter((url) => url.endsWith('/api/iap-consume')).length, 0);
  assert.equal(visitor.document.querySelector('[role="dialog"]'), null);

  const prices = {
    ezik_pass_week_1: { price: 1, currencyCode: 'USD' },
    ezik_pass_month_1: { price: 2, currencyCode: 'USD' },
    ezik_pass_year_1: { price: 3, currencyCode: 'USD' },
  };
  const owner = await makeBridge({ mode: 'free', balance: { enforced: false, purchaseEntry: true }, prices });
  const homeUpdates = [];
  await owner.window.ezikIapEnterHome((notice, applicable) => homeUpdates.push({ notice, applicable }));
  assert.deepEqual(homeUpdates.at(-1), { notice: null, applicable: true });
  assert.equal(owner.calls.filter((url) => url.endsWith('/api/iap-trial-start')).length, 0);
});

test('expired pass and free-week notices and locks keep their distinct wording and once-per-session rule', async () => {
  const journey = await readFile(new URL('../quest-theme/journey.js', import.meta.url), 'utf8');
  const vercelignore = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  assert.match(vercelignore, /^\/tests\/\*\.test\.js$/m);
  const markupSource = journey.match(/function homeNoticeMarkup\(\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(markupSource);
  const renderNotice = (notice) => new Function(
    'M', 'esc', 'ar', 'button', `${markupSource}; return homeNoticeMarkup;`,
  )({ homeNotice: notice }, String, (value) => String(value).replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]), () => '')();
  assert.match(renderNotice({ kind: 'pass-expired' }), /انتهى اشتراكك في ألعاب كنوز المعرفة\. الأسعار تحت زر «اشتر لعبة»\./);
  assert.match(renderNotice({ kind: 'expired' }), /انتهى أسبوعك المجاني للألعاب\. الأسعار تحت زر «اشتر لعبة»\./);
  assert.match(renderNotice({ kind: 'trial', trial: { daysLeft: 4, active: true } }), /متبقّي ٤ أيام\./);
  assert.match(renderNotice({ kind: 'trial', trial: { daysLeft: 4, active: true } }), /يلزم اشتراك أسبوع أو شهر أو سنة لدخول أي لعبة/);

  const setterSource = journey.match(/function setHomeNotice\(notice, purchaseApplicable\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(setterSource);
  const stored = new Map();
  const state = { homeNotice: null, homePurchasesApplicable: false };
  const setNotice = new Function(
    'M', 'IAP_EXPIRED_NOTICE_KEY', 'render', 'global', 'location', 'sessionStorage',
    `${setterSource}; return setHomeNotice;`,
  )(state, 'expired-notice', () => {}, {}, { search: '' }, {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, String(value)),
  });
  setNotice({ kind: 'pass-expired' }, true);
  assert.equal(state.homeNotice.kind, 'pass-expired');
  setNotice({ kind: 'pass-expired' }, true);
  assert.equal(state.homeNotice, null);

  const expiredHome = await makeBridge({
    mode: 'all', balance: { credits: 0, subscriptionExpiresAt: Date.now() - DAY, trial: null },
  });
  const homeUpdates = [];
  await expiredHome.window.ezikIapEnterHome((notice) => homeUpdates.push(notice));
  assert.equal(homeUpdates.at(-1).kind, 'pass-expired');
  assert.equal(expiredHome.calls.some((url) => url.endsWith('/api/iap-trial-start')), false);

  const past = Date.now() - DAY;
  const expiredPass = await makeBridge({
    mode: 'all', pathname: '/quest.html',
    balance: { credits: 0, subscriptionExpiresAt: past, trial: null },
  });
  assert.equal(await expiredPass.window.ezikIapCheckGameAccess('ghaws', () => {}, '/quest-ghaws.html'), false);
  assert.match(expiredPass.document.body.textContent, /انتهى اشتراكك — الرجاء الشراء للدخول/);

  const expiredTrial = await makeBridge({
    mode: 'all', pathname: '/quest.html',
    balance: { credits: 0, trial: { startedAt: 1, endsAt: 2, active: false, daysLeft: 0 } },
  });
  assert.equal(await expiredTrial.window.ezikIapCheckGameAccess('ghaws', () => {}, '/quest-ghaws.html'), false);
  assert.match(expiredTrial.document.body.textContent, /انتهت تجربتك المجانية — الرجاء الشراء للدخول/);
});

test('all five games stay locked without trial, pass, or credits; passes enter freely and credits still confirm', async () => {
  const routes = [
    ['ghaws', '/quest-ghaws.html'], ['harb', '/quest-harb.html'], ['test', '/quest-test.html'],
    ['board', '/quest-board.html'], ['hanna', '/hanna-laha/'],
  ];
  for (const [gameId, route] of routes) {
    const locked = await makeBridge({
      mode: 'all', pathname: '/quest.html',
      balance: { credits: 0, trial: { startedAt: 1, endsAt: 2, active: false, daysLeft: 0 } },
    });
    assert.equal(await locked.window.ezikIapCheckGameAccess(gameId, () => {}, route), false, gameId);
  }

  const pass = await makeBridge({
    mode: 'all', pathname: '/quest.html',
    balance: { credits: 0, subscriptionExpiresAt: Date.now() + DAY, trial: null },
  });
  let entered = 0;
  assert.equal(await pass.window.ezikIapCheckGameAccess('ghaws', () => { entered += 1; }, '/quest-ghaws.html'), true);
  assert.equal(entered, 1);
  assert.equal(pass.document.querySelector('[role="dialog"]'), null);

  const credit = await makeBridge({
    mode: 'all', pathname: '/quest.html',
    balance: { credits: 1, trial: { startedAt: 1, endsAt: 2, active: false, daysLeft: 0 } },
  });
  assert.equal(await credit.window.ezikIapCheckGameAccess('ghaws', () => {}, '/quest-ghaws.html'), true);
  credit.window.ezikIapStart(() => true, 'credit-session-123456', 'ghaws');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(credit.document.body.textContent, /سيُخصم من رصيدك جلسة واحدة/);
});
