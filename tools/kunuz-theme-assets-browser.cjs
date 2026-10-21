/* Owner addendum: persistent artwork/fonts, repeated returns, meaningful icons and fallback. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const { chromium } = require('../.vercel/theme-tools/node_modules/playwright');
const base = process.env.KUNUZ_PREVIEW_URL || 'http://127.0.0.1:52190';
const out = process.env.KUNUZ_FLASH_OUT || 'C:/Users/passe/projects/quest-review/sessions/kunuz-theme-shots-2026-10-20/flash';
const routes = { board: '/quest-board.html', test: '/quest-test.html', ghaws: '/quest-ghaws.html', harb: '/quest-harb.html', hanna: '/hanna-laha/' };
fs.mkdirSync(out, { recursive: true });
function watchAssets() {
  window.__surfaceProof = { violations: [], visibleFrames: 0, restores: [] };
  addEventListener('pageshow', e => window.__surfaceProof.restores.push({ persisted: e.persisted, at: performance.now() }));
  function frame() {
    const app = document.querySelector('.journey-app'), root = document.documentElement;
    if (app && !root.classList.contains('kunuz-theme-pending') && getComputedStyle(app).display !== 'none') {
      const images = [...app.querySelectorAll('img')].map(img => ({ src: img.getAttribute('src'), ready: img.complete && img.naturalWidth > 0 }));
      const fonts = [...document.fonts].filter(f => f.family === 'KunuzPlex').map(f => ({ weight: f.weight, status: f.status }));
      window.__surfaceProof.visibleFrames++;
      if (images.some(img => !img.ready || img.src.startsWith('blob:')) || fonts.length !== 2 || fonts.some(f => f.status !== 'loaded')) window.__surfaceProof.violations.push({ at: performance.now(), images, fonts });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
async function ready(page) {
  await page.waitForFunction(() => window.KunuzJourney?.state.ready && !document.documentElement.classList.contains('kunuz-theme-pending'), null, { timeout: 180000 });
  await page.waitForTimeout(160);
}
async function assets(page, name) {
  await ready(page);
  const state = await page.evaluate(() => ({ proof: window.__surfaceProof, images: [...document.querySelectorAll('.journey-app img')].map(img => ({ url: img.getAttribute('src'), width: img.naturalWidth, height: img.naturalHeight })), fonts: [...document.fonts].filter(f => f.family === 'KunuzPlex').map(f => ({ weight: f.weight, status: f.status })), bodyFont: getComputedStyle(document.body).fontFamily }));
  assert.deepEqual(state.proof.violations, [], name + ': incomplete asset became visible');
  assert.match(state.bodyFont, /KunuzPlex/); assert.equal(state.fonts.length, 2);
  assert.ok(state.fonts.every(f => f.status === 'loaded'));
  if (new URL(page.url()).pathname === '/quest.html') { assert.equal(state.images.length, 2); state.images.forEach(img => assert.ok(img.width > 0 && img.height > 0)); }
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: false });
  return { name, ...state };
}
async function sheet(browser, cards, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(base + '/quest.html'); await ready(page);
  await page.setContent('<style>@font-face{font-family:Plex;src:url("' + base + '/quest-theme/assets/regular.ttf?v=20261021-room1")}*{box-sizing:border-box}body{margin:0;padding:12px;background:#082c38;color:#fff8eb;font:16px Plex,Arial;display:grid;grid-template-columns:repeat(8,1fr);gap:10px;direction:rtl}.card{height:136px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#164755;border:1px solid #ffe6a34d;border-radius:16px;text-align:center;padding:7px;line-height:1.4}svg{width:76px;height:76px;flex:none}.name{padding-top:6px}</style>' + cards.map(c => '<div class="card">' + c.svg + '<div class="name">' + c.name + '</div></div>').join(''));
  await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); await page.close();
}
(async () => {
  const browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] }), record = { base, returns: [], fallback: [], errors: [], failedRequests: [] };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); await context.addInitScript(watchAssets);
  const page = await context.newPage();
  page.on('pageerror', e => record.errors.push(e.message)); page.on('requestfailed', r => record.failedRequests.push({ url: new URL(r.url()).pathname, error: r.failure()?.errorText }));
  try {
    await page.goto(base + '/quest.html'); record.returns.push(await assets(page, 'hub-assets-initial'));
    for (const mode of ['online-back', 'online-entry-back', 'offline-back']) {
      if (mode === 'offline-back') await context.setOffline(true);
      for (const [game, route] of Object.entries(routes)) {
        await page.goto(base + route); await ready(page);
        record.returns.push(await assets(page, game + '-fonts-' + mode));
        if (mode === 'online-entry-back') await page.locator('[data-action=back]').first().click();
        else { for (let tries = 0; new URL(page.url()).pathname !== '/quest.html' && tries < 5; tries++) await page.goBack(); }
        await page.waitForURL('**/quest.html');
        record.returns.push(await assets(page, 'hub-return-' + game + '-' + mode));
      }
    }
    await context.setOffline(false);
    // Corrupt each critical persistent response. The worker must reject its
    // bytes and restore the real network response before showing the hub.
    record.corruption = await page.evaluate(async () => {
      const name = (await indexedDB.databases()).find(db => db.name.startsWith('kunuz-treasure-assets-20261021-room1')).name;
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const keys = ['regular.ttf','bold.ttf','ocean-clean.webp','islands.webp'].map(name => '/quest-theme/assets/' + name + '?v=20261021-room1');
      await new Promise((resolve, reject) => { const tx = db.transaction('assets','readwrite'); for (const key of keys) tx.objectStore('assets').put({ body: new Uint8Array([0]).buffer, status: 200, headers: [['content-type','text/html']] }, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close(); return { database: name, keys };
    });
    await page.reload(); record.returns.push(await assets(page, 'hub-corrupt-cache-recovered'));
    await page.goto(base + routes.board); await ready(page);
    const cards = await page.evaluate(() => KunuzModel.categories().map(c => ({ slug: c.slug, name: c.name, svg: KunuzIcons.category(c.slug,c.index) })));
    assert.equal(cards.length, 70);
    const geometry = cards.map(c => c.svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/(?:g|p)\d+/g, 'gradient'));
    assert.equal(new Set(geometry).size, 70, 'main category silhouettes repeat');
    await sheet(browser, cards, 'category-icons-after');
    const old = { window: {} }; vm.createContext(old); vm.runInContext(fs.readFileSync(path.join(__dirname, '../.vercel/flash-v1/quest-theme/icons.js'), 'utf8'), old);
    await sheet(browser, cards.map((c,index) => ({ ...c, svg: old.window.KunuzIcons.category(c.slug,index) })), 'category-icons-before');
    for (const width of [360,390,430]) {
      await page.setViewportSize({ width, height: {360:800,390:844,430:932}[width] });
      await page.screenshot({ path: path.join(out, 'category-icons-picker-' + width + '.png'), fullPage: true });
    }
    record.icons = cards.map(c => ({ slug: c.slug, name: c.name })); record.distinctMainSilhouettes = new Set(geometry).size;
    assert.deepEqual(record.errors, []); assert.deepEqual(record.failedRequests, []);
    // A failed theme download must restore a usable native entry after 4s.
    for (const failure of ['script','stylesheet']) for (const [game, route] of Object.entries({ hub:'/quest.html', ...routes })) {
      const fallback = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await fallback.route(failure === 'script' ? '**/quest-theme/journey.js*' : '**/quest-theme/theme.css*', r => r.abort());
      const p = await fallback.newPage(), warnings = []; p.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
      await p.goto(base + route); await p.waitForFunction(() => window.KunuzThemeBoot?.status === 'fallback', null, { timeout: 10000 });
      if (game === 'ghaws') await p.locator('[data-go=cfg1]').click();
      if (game === 'harb') await p.locator('[data-go=cfg]').first().click();
      const target = game === 'hub' ? '.door' : game === 'hanna' ? '#root button' : game === 'harb' ? '#startWar' : game === 'ghaws' ? '#goDive' : '#startBtn';
      await p.locator(target).first().waitFor({ state: 'visible', timeout: 30000 });
      assert.ok(warnings.some(w => /4000ms/.test(w)));
      const native = await p.evaluate(() => ({ themed: document.body.classList.contains('ezik-treasure-theme'), apps: document.querySelectorAll('.journey-app').length, at: performance.now() }));
      assert.equal(native.themed, false); assert.equal(native.apps, 0);
      if (['board','test','ghaws','harb'].includes(game)) {
        await p.locator(game === 'test' ? '[data-q=all]' : '[data-q=rnd]').first().click();
        assert.equal(await p.locator(target).isEnabled(), true);
        await p.locator(target).click();
        await p.locator(game === 'board' || game === 'test' ? '#play' : game === 'ghaws' ? '#dive' : '#war').waitFor({state:'visible'});
      }
      await p.screenshot({ path: path.join(out, 'fallback-' + failure + '-' + game + '.png'), fullPage: false });
      record.fallback.push({ game, failure, logged: true, native }); await fallback.close();
    }
    console.log('PASS 15 hub returns; every page font; corrupted asset recovery; 70 distinct silhouettes; 12 playable script/CSS fallbacks');
  } catch (e) { record.failure = e.stack; await page.screenshot({ path: path.join(out,'asset-proof-failure.png') }).catch(() => {}); throw e; }
  finally { fs.writeFileSync(path.join(out, 'asset-and-icons-proof.json'), JSON.stringify(record, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
