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
const evidencePath = process.env.IAP_F_EVIDENCE || path.join(os.tmpdir(), 'iap-f-consume-timing-browser.json');
const record = { consumeCalls: [], checks: [], pageErrors: [] };
const balance = {
  appUserId: 'iap-f-browser-account', credits: 0, subscriptionExpiresAt: null,
  freeTotalPerGame: { harb: 3, board: 3, hanna: 3 },
  freeUsedByGame: { harb: 0, board: 0, hanna: 0 },
  freeRemainingByGame: { harb: 3, board: 3, hanna: 3 },
};
const consumed = new Set();
let rejectNextFree = false;
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.wav': 'audio/wav',
};

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/iap-f-fixture') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><html lang="ar"><head><meta charset="utf-8"><link rel="stylesheet" href="/hanna-laha/assets/iap-bridge-v1.css"><script src="/iap-pending.js"></script><script src="/hanna-laha/assets/iap-bridge-v1.js"></script></head><body></body></html>');
    return;
  }
  if (url.pathname === '/api/iap-status') return sendJson(res, 200, { mode: 'test' });
  if (url.pathname === '/api/iap-balance') return sendJson(res, 200, JSON.parse(JSON.stringify(balance)));
  if (url.pathname === '/api/iap-consume' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const value = JSON.parse(body || '{}');
      record.consumeCalls.push(value);
      const key = value.gameId + ':' + value.sessionId;
      if (value.intent === 'free' && rejectNextFree) {
        rejectNextFree = false;
        return sendJson(res, 409, { ok: false, error: 'iap-free-unavailable' });
      }
      if (!consumed.has(key)) {
        consumed.add(key);
        const game = value.gameId;
        if (value.intent === 'free' && balance.freeRemainingByGame[game] > 0) {
          balance.freeUsedByGame[game] += 1;
          balance.freeRemainingByGame[game] -= 1;
        } else if (value.intent === 'credit' && balance.credits > 0) balance.credits -= 1;
        else return sendJson(res, 409, { ok: false, error: 'iap-free-unavailable' });
      }
      sendJson(res, 200, { ok: true, duplicate: record.consumeCalls.filter(call => call.sessionId === value.sessionId && call.gameId === value.gameId).length > 1, balance: JSON.parse(JSON.stringify(balance)) });
    });
    return;
  }
  if (url.pathname === '/__test/add-purchase' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      balance.credits += Number(JSON.parse(body || '{}').credits) || 0;
      sendJson(res, 200, { ok: true });
    });
    return;
  }
  if (url.pathname === '/__test/reject-next-free' && req.method === 'POST') {
    rejectNextFree = true;
    return sendJson(res, 200, { ok: true });
  }

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

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function installRoundHarness(page) {
  await page.evaluate(() => {
    localStorage.setItem('ezik_auth_session_v1', JSON.stringify({ session: 'iap-f-browser-session', email: 'owner@example.com', name: 'Browser Owner', provider: 'google' }));
    window.__startCount = 0;
    window.__signalRound = null;
    window.__roomIdentity = 'board-room-instance-1';
    window.__openRoundChoice = function (cycle) {
      window.__signalRound = null;
      window.ezikIapStart(function () { window.__startCount += 1; }, '0042', 'board', {
        roomInstanceId: window.__roomIdentity,
        cycle: String(cycle),
        waitForStart: function () {
          var resolvePromise, rejectPromise;
          var promise = new Promise(function (resolve, reject) { resolvePromise = resolve; rejectPromise = reject; });
          window.__signalRound = function () { resolvePromise({ phase: 'board', gameNumber: Number(cycle) }); };
          return { promise: promise, cancel: function () { rejectPromise(new Error('test-cancelled')); } };
        },
      });
    };
  });
}

async function chooseFreeAndStart(page, cycle) {
  await page.evaluate(value => window.__openRoundChoice(value), cycle);
  await page.locator('.ezik-iap-choice-grid').waitFor({ timeout: 5000 });
  await page.locator('.ezik-iap-choice').first().click();
  await page.waitForFunction(() => typeof window.__signalRound === 'function', null, { timeout: 3000 });
}

async function run() {
  let browser;
  try {
    const harb = fs.readFileSync(path.join(root, 'quest-harb.html'), 'utf8');
    const journey = fs.readFileSync(path.join(root, 'quest-theme/journey.js'), 'utf8');
    const board = fs.readFileSync(path.join(root, 'quest-theme/board-rooms.js'), 'utf8');
    const hanna = fs.readFileSync(path.join(root, 'hanna-laha/assets/HostRoomScreen-iap-v1.js'), 'utf8');
    check('Harb waits for a non-lobby worker snapshot from the owner room start action',
      harb.includes('window.ezikIapStart(function(){rmSend({t:"start"})},RM.code,"harb",{cycle:"1",roomInstanceId:RM.roomId,waitForStart:waitForWarStart})')
      && harb.includes('if(!s||s.stage==="lobby")return;'));
    check('Harb room creation no longer triggers the IAP bridge from the setup start click',
      journey.includes("if (game === 'harb' && s.room) {\n      enterRoom(false);")
      && !journey.includes("ezikIapStart(() => enterRoom(false)"));
    check('Board consumes only after an active phase arrives for the expected gameNumber',
      board.includes("if (!['board', 'question'].includes(snapshot.phase)) return;")
      && board.includes('waiter.targetGameNumber === Number(snapshot.gameNumber)'));
    check('Board keys a room session by its server roomId and advances the cycle for rematches',
      board.includes('roomInstanceId: S.session.roomId || s.roomId')
      && board.includes("const cycle = (Number(s.gameNumber) || 0) + 1"));
    check('Hanna waits for the active game phase marker rendered from its room snapshot',
      hanna.includes('function waitForHannaStart()')
      && hanna.includes("'[data-testid=\"phase\"]'")
      && hanna.includes("waitForStart:waitForHannaStart"));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const base = 'http://127.0.0.1:' + address.port;
    browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.routeWebSocket('**/*', socket => socket.close());
    const owner = await context.newPage();
    owner.on('pageerror', error => record.pageErrors.push(error.message));
    await owner.goto(base + '/iap-f-fixture');
    await installRoundHarness(owner);

    await owner.evaluate(() => window.__openRoundChoice(1));
    await owner.locator('.ezik-iap-choice-grid').waitFor({ timeout: 5000 });
    check('The start choice displays the current balance',
      await owner.locator('.ezik-iap-balance').count() === 1
      && (await owner.locator('.ezik-iap-balance').innerText()).length > 0);
    await owner.locator('.ezik-iap-choice').first().click();
    await owner.waitForFunction(() => typeof window.__signalRound === 'function', null, { timeout: 3000 });
    await wait(150);
    check('Leaving before the active round signal sends no consume request', record.consumeCalls.length === 0);
    await owner.goto(base + '/iap-f-fixture?returned=1');
    await installRoundHarness(owner);
    await chooseFreeAndStart(owner, 1);
    await owner.evaluate(() => window.__signalRound());
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-backdrop') === null, null, { timeout: 5000 });
    check('Returning to the same room and round consumes only when its active signal arrives', record.consumeCalls.length === 1 && balance.freeUsedByGame.board === 1);

    await chooseFreeAndStart(owner, 1);
    await owner.evaluate(() => window.__signalRound());
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-backdrop') === null, null, { timeout: 5000 });
    check('A retry for the same round reuses the same sessionId and the idempotent consume applies once', record.consumeCalls.length === 2 && record.consumeCalls[0].sessionId === record.consumeCalls[1].sessionId && balance.freeUsedByGame.board === 1);

    await chooseFreeAndStart(owner, 2);
    await owner.evaluate(() => window.__signalRound());
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-backdrop') === null, null, { timeout: 5000 });
    check('A new rematch cycle gets its own sessionId and consumes once', record.consumeCalls.length === 3 && record.consumeCalls[2].sessionId !== record.consumeCalls[1].sessionId && balance.freeUsedByGame.board === 2);

    await owner.evaluate(() => { window.__roomIdentity = 'board-room-instance-2'; });
    await chooseFreeAndStart(owner, 1);
    await owner.evaluate(() => window.__signalRound());
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-backdrop') === null, null, { timeout: 5000 });
    check('A new room instance gets a fresh sessionId even when its displayed code is reused',
      record.consumeCalls.length === 4 && record.consumeCalls[3].sessionId !== record.consumeCalls[0].sessionId && balance.freeUsedByGame.board === 3);

    await owner.evaluate(() => {
      var originalSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = function (callback, delay) {
        var args = Array.prototype.slice.call(arguments, 2);
        return originalSetTimeout.apply(window, [callback, [1000, 2000, 4000, 6000, 7000].includes(delay) ? 100 : delay].concat(args));
      };
      window.ReactNativeWebView = { postMessage: function (raw) {
        var request = JSON.parse(raw);
        var result = request.type === 'iap.identify' ? { ok: true } : request.type === 'iap.prices' ? { ok: true, prices: {
          ezik_games_3: { price: 1.99, priceString: '$1.99', currencyCode: 'USD' },
          ezik_month_1: { price: 2.99, priceString: '$2.99', currencyCode: 'USD' },
          ezik_year_1: { price: 19.99, priceString: '$19.99', currencyCode: 'USD' },
        } } : { status: 'purchased', productId: request.productId };
        setTimeout(function () { window.dispatchEvent(new CustomEvent('ezik-iap', { detail: { v: 1, id: request.id, type: request.type + '.result', ...result } })); }, 0);
      } };
      window.__openRoundChoice(3);
    });
    await owner.locator('.ezik-iap-choice-grid').waitFor({ timeout: 5000 });
    await owner.locator('.ezik-iap-choice').filter({ hasText: 'اشتري الآن' }).click();
    await owner.locator('.ezik-iap-row').first().waitFor({ timeout: 5000 });
    const firstRow = owner.locator('.ezik-iap-row').first();
    await firstRow.locator('input').fill('2');
    await firstRow.getByRole('button', { name: 'شراء' }).click();
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-row .ezik-iap-status')?.textContent.includes('تمت ١ من ٢'), null, { timeout: 5000 });
    check('The purchase screen shows unit progress for a multi-unit purchase', true);
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-row .ezik-iap-status')?.textContent.includes('تم استلام الدفع، سيظهر الرصيد خلال لحظات.'), null, { timeout: 5000 });
    check('Each purchased unit is confirmed and delayed balance is explained on the purchase screen',
      (await firstRow.locator('.ezik-iap-status').innerText()).includes('تم الشراء ✓ — أُضيف ٣ جلسات')
      && (await firstRow.locator('.ezik-iap-status').innerText()).includes('تمت ٢ من ٢')
      && (await firstRow.locator('.ezik-iap-status').innerText()).includes('تم استلام الدفع، سيظهر الرصيد خلال لحظات.'));
    check('The balance remains visible on the purchase screen while the endpoint is still pending',
      (await owner.locator('.ezik-iap-balance').innerText()).includes('رصيدك: ٠ جلسة')
      && await owner.getByRole('heading', { name: 'خيارات الشراء' }).count() === 1);
    await owner.evaluate(async () => {
      await fetch('/__test/add-purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credits: 6 }) });
    });
    await owner.waitForFunction(() => document.querySelector('.ezik-iap-balance')?.textContent.includes('رصيدك: ٦ جلسة'), null, { timeout: 7000 });
    check('Balance polling updates the same purchase screen as soon as the endpoint reflects the purchase',
      await owner.getByRole('heading', { name: 'خيارات الشراء' }).count() === 1
      && await owner.locator('.ezik-iap-backdrop').count() === 1);
    await owner.locator('.ezik-iap-header button').click();
    await owner.evaluate(() => window.__openRoundChoice(3));
    await owner.locator('.ezik-iap-choice-grid').waitFor({ timeout: 5000 });
    check('With free sessions exhausted, the credit action states that it uses the balance',
      await owner.locator('.ezik-iap-choice').evaluateAll(nodes =>
        nodes.filter(node => node.textContent.includes('يُخصم من رصيدك')).length === 1));
    await owner.locator('.ezik-iap-header button').click();
    await owner.evaluate(async () => {
      await fetch('/__test/reject-next-free', { method: 'POST' });
      window.ezikIapStart(function () {}, '0042', 'harb', {
        cycle: '1', waitForStart: function () { return Promise.resolve({ stage: 'active' }); },
      });
    });
    await owner.locator('.ezik-iap-choice-grid').waitFor({ timeout: 5000 });
    await owner.locator('.ezik-iap-choice').first().click();
    await owner.getByRole('heading', { name: 'تعذّر إكمال العملية' }).waitFor({ timeout: 5000 });
    check('An explicit free choice rejected by the server never falls through to the available credit',
      record.consumeCalls.length === 5 && record.consumeCalls[4].intent === 'free'
      && balance.credits === 6 && balance.freeUsedByGame.harb === 0);
    check('Browser regression produced no page runtime errors', record.pageErrors.length === 0);
    record.balance = JSON.parse(JSON.stringify(balance));
    fs.writeFileSync(evidencePath, JSON.stringify(record, null, 2));
    console.log('IAP-F BROWSER PASS checks=' + record.checks.length + ' evidence=' + evidencePath);
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
