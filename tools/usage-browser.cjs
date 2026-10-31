// Local Chromium integration: the usage endpoint is deliberately disconnected.
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function playwright() {
  for (const candidate of [process.env.EZIK_PLAYWRIGHT, 'playwright',
    'C:/Users/passe/projects/ustaz-check88/check88/node_modules/playwright'].filter(Boolean)) {
    try { return require(candidate); } catch {}
  }
  throw Error('Set EZIK_PLAYWRIGHT to an installed Playwright module');
}
const attempts = [], inboxReads = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/usage' || url.pathname === '/api/inbox') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (url.pathname === '/api/usage') { attempts.push(data); res.destroy(); return; }
      inboxReads.push(data);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, unread: 0, kind: data.kind, items: data.kind === 'usage'
        ? [{ section: 'mushaf', label: 'المصحف', opens: 17, devices: 4 }] : [] }));
    });
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') { res.writeHead(404); res.end(); return; }
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)];
    res.setHeader('Content-Type', type || 'application/octet-stream');
    res.end(data);
  });
});

async function waitForAttempt(section, offset = 0) {
  const deadline = Date.now() + 10000;
  while (!attempts.slice(offset).some(e => e.section === section)) {
    if (Date.now() > deadline) throw Error('Missing usage event: ' + section);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await playwright().chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await context.addInitScript(fetchOnly => {
      if (fetchOnly) Object.defineProperty(navigator, 'sendBeacon', { value: undefined });
      localStorage.setItem('child_profile', JSON.stringify({ name: 'TEST', age: 30, birthYear: 1996, pid: 'usage-test', gender: 'female' }));
      localStorage.setItem('ezik_ui_lang_v1', 'en');
      localStorage.setItem('ezik_ai_consent_v1', JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: 'usage-test' }));
      localStorage.setItem('ezik_auth_session_v1', JSON.stringify({ session: 'OWNER_TEST_ONLY', email: 'test@example.invalid' }));
      if (location.pathname === '/') sessionStorage.setItem('ezik_resume_section_v1', 'home');
    }, process.env.USAGE_FETCH_ONLY === '1');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('[data-ez110-tile], [data-ezik-home-module]'));
    const before = attempts.length;
    // Press a real section card while every telemetry request loses its connection.
    const card = page.locator('[data-ez110-tile="asmaa"] button.ez110-tile, button[data-ezik-home-module="asmaa"]').first();
    await card.click();
    await page.waitForFunction(() => !document.querySelector('[data-ez110-tile], [data-ezik-home-module]')
      && document.body.textContent.includes('beautiful names of Allah'));
    await waitForAttempt('asmaa', before);
    console.log('PASS: section card opens while /api/usage loses its connection');

    // Real widget/drawer routing shares the committed screen/layer hooks.
    const routes = ['home', 'chat', 'memorize', 'adhkar', 'arbaeen', 'mushaf', 'ayah-tafsir', 'fatwa', 'lessons',
      'articles', 'women', 'sunan-day', 'yahimmak', 'dima', 'prayer', 'compass', 'wirdi', 'tasbih', 'calc'];
    for (const route of routes) {
      const count = attempts.length;
      await page.evaluate(route => {
        window.dispatchEvent(new CustomEvent(SHELL_SCHED_CHANNEL, {
          detail: { channel: SHELL_SCHED_CHANNEL, v: SHELL_SCHED_VERSION, op: 'open', route }
        }));
      }, route);
      await waitForAttempt(route, count);
      assert.ok(attempts.slice(count).some(e => e.section === route), route + ' opens with the usage endpoint down');
    }
    console.log('PASS: all screen/layer widget routes are logged with the endpoint down');
    // Open the owner's real panel and exercise its range/day controls through the UI.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent(SHELL_SCHED_CHANNEL, {
      detail: { channel: SHELL_SCHED_CHANNEL, v: SHELL_SCHED_VERSION, op: 'open', route: 'chat' }
    })));
    const beforeCall = attempts.length;
    await page.getByRole('button', { name: 'Live voice call', exact: true }).click();
    await waitForAttempt('call', beforeCall);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent(SHELL_SCHED_CHANNEL, {
      detail: { channel: SHELL_SCHED_CHANNEL, v: SHELL_SCHED_VERSION, op: 'open', route: 'chat' }
    })));
    await page.locator('.ezc-rail button.ezc-icon').first().click();
    await page.getByRole('button', { name: 'Inbox — readers’ messages and replying to them', exact: true }).click();
    await page.getByRole('button', { name: 'Usage', exact: true }).click();
    await page.getByRole('cell', { name: '17', exact: true }).waitFor();
    assert.equal(await page.getByRole('columnheader').count(), 3);
    assert.equal(await page.getByRole('button', { name: 'Delete all', exact: true }).count(), 0);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/inbox') && r.request().postDataJSON().days === 7),
      page.getByRole('button', { name: 'Last 7 days', exact: true }).click()]);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/inbox') && r.request().postDataJSON().days === 30),
      page.getByRole('button', { name: 'Last 30 days', exact: true }).click()]);
    const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/inbox') && r.request().postDataJSON().day === day.replace(/-/g, '')),
      page.locator('input[type="date"]').fill(day)]);
    assert.ok(inboxReads.some(body => body.kind === 'usage' && body.days === 30));
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'ezik-usage-owner.png'), fullPage: true });
    console.log('PASS: owner usage table, UTC day, and 7/30-day controls');

    for (const [file, section] of Object.entries({ 'quest.html': 'treasure', 'quest-ghaws.html': 'ghaws',
      'quest-harb.html': 'harb', 'quest-test.html': 'test', 'quest-board.html': 'board',
      'hanna-laha/': 'hanna', 'library.html': 'library' })) {
      const count = attempts.length;
      await page.goto(origin + '/' + file, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.logSection === 'function');
      await waitForAttempt(section, count);
      await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 0);
      console.log('PASS: direct visit ' + file);
    }
    assert.ok(attempts.every(e => Object.keys(e).sort().join(',') === 'anon,section' && /^[a-f0-9]{32}$/.test(e.anon)));
    assert.equal(new Set(attempts.map(e => e.anon)).size, 1);
    assert.deepEqual(errors, []);
    console.log('PASS: real card/widget/call navigation, owner ranges/day/table, and all 7 standalone pages with /api/usage disconnected ('
      + (process.env.USAGE_FETCH_ONLY === '1' ? 'keepalive fetch' : 'Beacon') + ')');
    console.log('PASS: anonymous ID persists across pages; every request carries section + anon only');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
