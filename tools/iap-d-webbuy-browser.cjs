'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const playwrightModule = process.env.KUNUZ_PLAYWRIGHT_MODULE || process.env.EZIK_PLAYWRIGHT
  || 'C:/Users/passe/projects/ustaz-check88/check88/node_modules/playwright';
const { chromium } = require(playwrightModule);

const root = path.resolve(__dirname, '..');
const evidencePath = process.env.IAP_D_EVIDENCE || path.join(os.tmpdir(), 'iap-d-webbuy-browser.json');
const record = { checks: [], pageErrors: [], outsideRequestsBlocked: [] };
let balance = {
  appUserId: 'iap-d-browser-account', credits: 0, subscriptionExpiresAt: null,
  freeTotalPerGame: { harb: 3, board: 3, hanna: 3 },
  freeUsedByGame: { harb: 0, board: 0, hanna: 0 },
  freeRemainingByGame: { harb: 3, board: 3, hanna: 3 },
};

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.wav': 'audio/wav',
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file;
  try {
    file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  } catch (error) { res.writeHead(400); res.end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

function check(name, actual) {
  assert.equal(actual, true, name);
  record.checks.push(name);
}

async function routeContext(context, base) {
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      record.outsideRequestsBlocked.push(url.origin);
      return route.abort();
    }
    if (url.pathname === '/api/iap-balance') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(balance) });
    }
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    }
    return route.continue();
  });
  await context.routeWebSocket('**/*', socket => socket.close());
}

async function run() {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const base = 'http://127.0.0.1:' + address.port;
    browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await routeContext(context, base);
    const owner = await context.newPage();
    owner.on('pageerror', error => record.pageErrors.push(error.message));
    await owner.goto(base + '/quest-harb.html');
    await owner.waitForFunction(() => window.KunuzJourney?.state.ready, null, { timeout: 60000 });
    await owner.waitForFunction(() => !document.documentElement.classList.contains('kunuz-theme-pending'), null, { timeout: 10000 });
    await owner.waitForFunction(() => typeof window.ezikIapStart === 'function', null, { timeout: 30000 });

    await owner.evaluate(() => window.ezikIapStart(() => { window.__ownerStarted = true; }, '0042', 'harb'));
    await owner.locator('.ezik-iap-card').waitFor();
    check('Signed-out online owner is sent to the sign-in prompt before the start choice',
      (await owner.locator('.ezik-iap-card').innerText()).includes('تسجيل الدخول'));
    const signInPopupPromise = owner.waitForEvent('popup');
    await owner.locator('.ezik-iap-card a[href="/?ezik_iap_signin=1"]').click();
    const signInPage = await signInPopupPromise;
    await signInPage.waitForLoadState('domcontentloaded');
    await signInPage.waitForFunction(() => !location.search.includes('ezik_iap_signin=1'), null, { timeout: 30000 });
    await signInPage.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button =>
      /تسجيل الدخول بحساب Google|Sign in with Google/.test(button.textContent || '')), null, { timeout: 30000 });
    check('Sign-in link opens the existing account Settings screen',
      /تسجيل الدخول بحساب Google|Sign in with Google/.test(await signInPage.locator('body').innerText()));

    await signInPage.evaluate(() => localStorage.setItem('ezik_auth_session_v1', JSON.stringify({
      session: 'iap-d-browser-session', email: 'owner@example.com', name: 'Browser Owner', provider: 'google',
    })));
    await owner.locator('.ezik-iap-choice-grid').waitFor({ timeout: 10000 });
    check('The owner returns automatically to the start choice after the account session is written', true);
    check('The start choice identifies the account holding the balance',
      (await owner.locator('.ezik-iap-copy').innerText()).includes('Browser Owner'));

    await owner.locator('.ezik-iap-choice').filter({ hasText: 'اشتري الآن' }).click();
    await owner.getByRole('heading', { name: 'الشراء من تطبيق عزك' }).waitFor();
    const storeLinks = await owner.locator('.ezik-iap-store-button').evaluateAll(nodes => nodes.map(node => node.href));
    check('No-bridge panel links to the required App Store and Google Play destinations',
      storeLinks.length === 2
      && storeLinks.includes('https://apps.apple.com/app/id6797100518')
      && storeLinks.includes('https://play.google.com/store/apps/details?id=app.almurabbi.tutor'));
    check('No-bridge panel displays the signed-in account',
      (await owner.locator('.ezik-iap-card').innerText()).includes('Browser Owner'));
    await owner.getByRole('button', { name: 'تحديث الرصيد' }).click();
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-status')?.textContent.includes('لم يظهر رصيد جديد بعد'));
    check('Refresh keeps the no-bridge panel open when no credit or subscription exists',
      await owner.getByRole('heading', { name: 'الشراء من تطبيق عزك' }).count() === 1);

    balance = { ...balance, credits: 2 };
    await owner.evaluate(() => window.dispatchEvent(new Event('focus')));
    await owner.locator('.ezik-iap-choice-grid').waitFor({ timeout: 10000 });
    check('Returning focus refreshes the balance and returns to the start choice when credit appears', true);

    await owner.evaluate(() => {
      window.ReactNativeWebView = { postMessage(raw) {
        const request = JSON.parse(raw);
        const result = request.type === 'iap.identify'
          ? { ok: true }
          : { ok: true, prices: {
            ezik_games_3: { price: 1.99, priceString: '$1.99', currencyCode: 'USD' },
            ezik_month_1: { price: 2.99, priceString: '$2.99', currencyCode: 'USD' },
            ezik_year_1: { price: 19.99, priceString: '$19.99', currencyCode: 'USD' },
          } };
        setTimeout(() => window.dispatchEvent(new CustomEvent('ezik-iap', { detail: {
          v: 1, id: request.id, type: request.type + '.result', ...result,
        } })), 0);
      } };
    });
    await owner.locator('.ezik-iap-choice').filter({ hasText: 'اشتري الآن' }).click();
    await owner.locator('.ezik-iap-row').first().waitFor();
    check('A responding bridge opens the existing purchase rows directly', await owner.locator('.ezik-iap-row').count() === 3);
    check('Native purchase screen identifies the account holding the balance',
      (await owner.locator('.ezik-iap-copy').innerText()).includes('Browser Owner'));

    await owner.getByRole('button', { name: 'إغلاق' }).click();
    await owner.evaluate(() => window.ezikIapStart(() => { window.__ownerStarted = true; }, '0043', 'harb'));
    await owner.locator('.ezik-iap-choice-grid').waitFor();
    await owner.evaluate(() => {
      const nativeTimer = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => nativeTimer(callback, delay === 15000 ? 0 : delay, ...args);
      window.ReactNativeWebView = { postMessage() {} };
    });
    await owner.locator('.ezik-iap-choice').filter({ hasText: 'اشتري الآن' }).click();
    await owner.getByRole('heading', { name: 'الشراء من تطبيق عزك' }).waitFor();
    check('A bridge that does not answer iap.identify in time falls back to the same browser panel', true);

    const joinContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await routeContext(joinContext, base);
    const joiner = await joinContext.newPage();
    joiner.on('pageerror', error => record.pageErrors.push(error.message));
    await joiner.goto(base + '/hanna-laha/join/');
    await joiner.waitForTimeout(1500);
    check('Hanna joiner sees no sign-in, purchase, or start-choice modal',
      await joiner.locator('.ezik-iap-backdrop').count() === 0
      && await joiner.evaluate(() => typeof window.__ezikIapStartGame === 'undefined'));

    check('Browser regression produced no page runtime errors', record.pageErrors.length === 0);
    record.base = base;
    fs.writeFileSync(evidencePath, JSON.stringify(record, null, 2));
    console.log('IAP-D BROWSER PASS checks=' + record.checks.length + ' evidence=' + evidencePath);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  record.failure = error.stack || error.message;
  try { fs.writeFileSync(evidencePath, JSON.stringify(record, null, 2)); } catch (writeError) {}
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
