// Local Chromium test of the owner's control panel at phone width. Every figure below is test data
// that exists only in this file. Screenshots go to PANEL_SHOTS when it is set.
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const shots = process.env.PANEL_SHOTS || '';
function playwright() {
  for (const candidate of [process.env.EZIK_PLAYWRIGHT, 'playwright',
    'C:/Users/passe/projects/ustaz-check88/check88/node_modules/playwright'].filter(Boolean)) {
    try { return require(candidate); } catch {}
  }
  throw Error('Set EZIK_PLAYWRIGHT to an installed Playwright module');
}
const types = ['complaint', 'suggestion', 'bug'];
const feedback = Array.from({ length: 24 }, (_, i) => ({ id: 'f' + i, state: i < 3 ? 'new' : i < 6 ? 'read' : 'answered', hasSender: i !== 5,
  type: types[i % 3], reason: '', text: 'TEST message ' + i + ' '.repeat(2) + 'x'.repeat(i * 20), contact: '', ts: '2026-11-02T08:00:00Z', appv: 'ezik-v132', source: '' }));
const reports = Array.from({ length: 4 }, (_, i) => ({ id: 'r' + i, state: i < 2 ? 'new' : 'read', hasSender: false, type: '',
  reason: ['wrong_info', 'wrong_ruling', 'inappropriate', 'other'][i], text: i === 3 ? '' : 'TEST note', contact: '', ts: '2026-11-02T08:00:00Z', appv: 'ezik-v132',
  source: i === 2 ? 'ghaws-question' : 'chat', userHead: 'TEST question ' + i, aiHead: i === 2 ? '' : 'TEST answer '.repeat(30), band: 'adult', mode: 'chat' }));
const answers = Array.from({ length: 30 }, (_, i) => ({ trace: 't' + i, at: Date.UTC(2026, 10, 2, 20, 60 - i), route: i % 3 ? 'DEEN' : 'GEN', path: ['bw2', 'free-brain', 'stored'][i % 3],
  depth: i % 2 ? 'deep' : 'brief', status: i === 4 ? 'open' : 'ended', flags: i % 7 === 0 ? ['refusal_fallback'] : [], cited: i % 4, first_byte_ms: 900 + i * 40, q_words: 5 + i, out_chars: 300 }));
const sections = [['home', 'TEST home', 90, 40], ['chat', 'TEST chat', 70, 33], ['treasure', 'TEST treasure', 40, 20], ['dima', 'TEST dima', 22, 11], ['ayah-tafsir', 'TEST hidden tafsir', 19, 9],
  ...Array.from({ length: 10 }, (_, i) => ['s' + i, 'TEST section ' + i, 15 - i, 8])];
const board = { since: '20261101', active: 142, activeBefore: 120, opens: 300, opensBefore: 280, d1: { cohort: 80, returned: 30 }, d1Before: { cohort: 70, returned: 25 }, d7: null, d7Before: null,
  trend: Array.from({ length: 30 }, (_, i) => ({ day: '202610' + String(i + 1).padStart(2, '0'), devices: 40 + ((i * 37) % 60) })),
  paths: Array.from({ length: 7 }, (_, i) => ({ from: 'TEST from ' + i, to: 'TEST to ' + i, n: 50 - i })),
  hours: Array.from({ length: 24 }, (_, h) => (h * 7) % 20), stays: [{ label: 'TEST chat', n: 20, mean: 200, median: 120 }],
  platforms: { a: 62, i: 31, w: 7 }, versions: [{ v: 'ezik-v132', n: 80 }], notif: { on: 58, of: 100 } };
const usage = { ok: true, kind: 'usage', approximate: true, board, games: [{ section: 'ghaws', label: 'TEST game', opens: 4 }],
  items: sections.map(([section, label, opens, devices]) => ({ section, label, opens, devices })) };
const chat = { ok: true, kind: 'usage-chat', read: 100, noFind: 9, noSource: 11, faults: 2, firstMs: 1200, slowMs: 3000, top: [{ k: 'DEEN', n: 60 }] };
const reads = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/inbox') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const d = JSON.parse(body || '{}');
      reads.push(d);
      res.setHeader('Content-Type', 'application/json');
      const send = (o) => res.end(JSON.stringify(Object.assign({ ok: true }, o)));
      if (d.action === 'mine') return send({ unseen: 0, items: [] });
      if (d.action === 'read') {
        const row = feedback.concat(reports).find(r => r.id === d.id);
        row.state = row.state === 'new' ? 'read' : row.state;
        return send({ item: { ...row, from: 'test@example.invalid', user: 'TEST full question', ai: 'TEST full answer' }, reply: null });
      }
      if (d.action === 'reply') return send({ id: d.id, reply: { text: d.text, at: '' }, state: 'answered' });
      if (d.action === 'delete') {
        const list = d.kind === 'reports' ? reports : feedback;
        const n = d.all ? list.length : d.ids.length;
        if (d.all) list.length = 0; else d.ids.forEach(id => list.splice(list.findIndex(r => r.id === id), 1));
        return send({ kind: d.kind, deleted: n, unread: 0 });
      }
      if (d.kind === 'overview') return send({ kind: 'overview', day: '20261102', usage, chat, chatBefore: { ...chat, noFind: 5 }, unread: { feedback: 3, reports: 2 } });
      if (d.kind === 'usage') return send(usage);
      if (d.kind === 'usage-chat') return send(chat);
      if (d.kind === 'answers') return send({ kind: 'answers', window: 200, total: answers.length, items: answers });
      const list = d.kind === 'reports' ? reports : feedback;
      return send({ kind: d.kind, window: 200, unread: list.filter(r => r.state === 'new').length, total: list.length, stored: list.length, items: list.slice(0, d.limit === undefined ? 200 : d.limit) });
    });
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') { res.writeHead(404); res.end(); return; }
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await playwright().chromium.launch({ headless: true, args: ['--mute-audio'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block', reducedMotion: process.env.PANEL_REDUCED ? 'reduce' : 'no-preference' });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('child_profile', JSON.stringify({ name: 'TEST', age: 30, birthYear: 1996, pid: 'panel-test', gender: 'female' }));
      localStorage.setItem('ezik_ai_consent_v1', JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: 'panel-test' }));
      localStorage.setItem('ezik_auth_session_v1', JSON.stringify({ session: 'OWNER_TEST_ONLY', email: 'test@example.invalid' }));
      if (location.pathname === '/') sessionStorage.setItem('ezik_resume_section_v1', 'home');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: false }); };
    // The whole page, not only the screen: the scroller is stretched for one picture.
    const longShot = async (name) => {
      if (!shots) return;
      const h = await page.evaluate(() => document.querySelector('.ezcp-scroll').scrollHeight + 200);
      await page.setViewportSize({ width: 390, height: Math.min(h, 3600) });
      await page.waitForTimeout(150);
      await shot(name);
      await page.setViewportSize({ width: 390, height: 844 });
    };
    const fit = async (where) => {
      const bad = await page.evaluate(() => {
        const out = [];
        if (document.documentElement.scrollWidth > innerWidth) out.push('page wider than screen ' + document.documentElement.scrollWidth);
        for (const el of document.querySelectorAll('.ezcp button, .ezcp a, .ezcp input, .ezcp select, .ezcp summary')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || getComputedStyle(el).position === 'fixed') continue;
          const small = el.type === 'checkbox' ? false : (r.height < 44 || r.width < 44);
          if (small) out.push((el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
          if (el.tagName === 'BUTTON' && !(el.textContent.trim() || el.getAttribute('aria-label'))) out.push('unnamed button');
        }
        return out;
      });
      assert.deepEqual(bad, [], where);
    };
    const nav = (n) => page.locator('.ezcp-nav button').nth(n);
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('[data-ez110-tile], [data-ezik-home-module]'));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent(SHELL_SCHED_CHANNEL, {
      detail: { channel: SHELL_SCHED_CHANNEL, v: SHELL_SCHED_VERSION, op: 'open', route: 'chat' } })));
    await page.locator('.ezc-rail button.ezc-icon').first().click();
    await page.locator('button[aria-label^="لوحة التحكم"]').click();

    await page.locator('.ezcp-hero .ezcp-num').waitFor();
    assert.equal(await page.locator('.ezcp-hero .ezcp-num').textContent(), '142');
    assert.equal(reads.filter(r => r.kind === 'overview').length, 1);
    assert.equal(await page.getByText('TEST hidden tafsir').count(), 0);
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.ezcp')).backgroundColor === 'rgb(12, 24, 27)'));
    assert.equal(await page.locator('.ezcp-row').count(), 3, 'three rows need attention');
    await fit('overview'); await longShot('1-overview');
    console.log('PASS: overview opens on one read, with real rows only');

    await nav(1).click();
    await page.locator('.ezcp-msg').first().waitFor();
    assert.equal(await page.locator('.ezcp-msg').count(), 20, 'the first page');
    await page.locator('.ezcp-more').click();
    assert.equal(await page.locator('.ezcp-msg').count(), 24);
    await page.locator('.ezcp-chip-btn').nth(3).click();
    assert.equal(await page.locator('.ezcp-msg').count(), 8, 'faults only');
    await page.locator('.ezcp-chip-btn').nth(0).click();
    await fit('messages'); await longShot('2-messages');
    console.log('PASS: messages, paging and filters');

    await page.locator('.ezcp-msg-main').first().click();
    await page.locator('.ezcp-gold').waitFor();
    await page.locator('.ezcp-quick button').first().click();
    assert.ok((await page.locator('.ezcp textarea').inputValue()).length > 0);
    await fit('thread'); await longShot('3-thread');
    await page.locator('.ezcp-gold').click();
    await page.waitForFunction(() => !document.querySelector('.ezcp textarea') || document.querySelector('.ezcp textarea').value === '');
    assert.equal(reads.filter(r => r.action === 'reply').length, 1);
    await page.locator('.ezcp-btn.is-danger').click();
    await page.locator('[role="alertdialog"]').waitFor();
    assert.equal(reads.filter(r => r.action === 'delete').length, 0, 'nothing is erased before the question');
    await page.locator('[role="alertdialog"] button').nth(1).click();
    await page.locator('.ezcp-head .ezcp-icon').first().click();
    await page.locator('.ezcp-msg').first().waitFor();
    console.log('PASS: a message opens, is answered, and asks before erasing');

    await page.locator('.ezcp-act').first().click();
    await page.locator('.ezcp-msg input').first().check();
    await page.locator('.ezcp-wrap .ezcp-act.is-danger').click();
    await page.locator('[role="alertdialog"]').waitFor();
    await page.locator('[role="alertdialog"] button').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.ezcp-msg').length > 0 && !document.querySelector('[role="alertdialog"]'));
    assert.deepEqual(reads.filter(r => r.action === 'delete').map(r => r.ids && r.ids.length), [1]);
    await page.locator('.ezcp-head .ezcp-act.is-danger').click();
    await page.locator('[role="alertdialog"]').waitFor();
    assert.match(await page.locator('[role="alertdialog"]').textContent(), /23/);
    await page.locator('[role="alertdialog"] button').nth(1).click();
    console.log('PASS: select and erase, and erase-all names its number first');

    await nav(2).click();
    await page.locator('.ezcp-rep').first().waitFor();
    assert.equal(await page.locator('.ezcp-fade').count(), 3);
    await fit('reports'); await longShot('4-reports');
    const readsBefore = reads.filter(r => r.action === 'read').length;
    await page.locator('.ezcp-rep .ezcp-btn').first().click();
    await page.waitForFunction((n) => document.querySelectorAll('.ezcp-tag.is-new').length === n, 1);
    assert.equal(reads.filter(r => r.action === 'read').length, readsBefore + 1);
    await page.locator('.ezcp-chip-btn').nth(2).click();
    assert.equal(await page.locator('.ezcp-rep').count(), 1);
    await page.locator('.ezcp-chip-btn').nth(0).click();
    await page.locator('.ezcp-rep').first().locator('.ezcp-btn').last().click();
    await page.getByText('TEST full answer').waitFor();
    assert.equal(await page.locator('.ezcp textarea').count(), 0, 'a report has no reply box');
    await fit('report opened');
    await nav(3).click();
    console.log('PASS: reports: excerpt, review mark, source filter, opened report without a reply box');

    await page.locator('.ezub-big').first().waitFor();
    assert.equal(reads.filter(r => r.kind === 'usage').length, 0, 'today comes from the overview read');
    assert.equal(await page.getByText('TEST hidden tafsir', { exact: true }).count(), 0, 'hidden from the section lists');
    await fit('usage'); await longShot('5-usage');
    const period = async (n, days) => {
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/inbox') && r.request().postDataJSON().days === days),
        page.locator('.ezub-bar button').nth(n).click()]);
      await page.locator('.ezub-big').first().waitFor();
      assert.ok(await page.locator('.ezub-kpis').isVisible(), 'the page is not cleared');
    };
    await period(1, 7);
    await period(2, 30);
    await page.locator('details.ezub-card summary').click();
    await page.getByRole('cell', { name: 'TEST section 9', exact: true }).waitFor();
    assert.equal(await page.getByRole('cell', { name: 'TEST hidden tafsir', exact: true }).count(), 0);
    await page.locator('details.ezub-card summary').click();
    console.log('PASS: usage: period key, collapsed table, tafsir hidden');

    await nav(4).click();
    await page.locator('.ezcp-ans').first().waitFor();
    await fit('answers'); await longShot('6-answers');
    await nav(0).click();
    await page.locator('.ezcp-hero .ezcp-num').waitFor();
    assert.equal(reads.filter(r => r.kind === 'overview').length, 1, 'coming back does not read again');
    assert.deepEqual(errors, []);
    console.log('PASS: answers, and the five tabs walked with no page error');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
