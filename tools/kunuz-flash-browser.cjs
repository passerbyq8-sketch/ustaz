/* First-paint filmstrips on real Chromium. Each run owns an ephemeral local server. */
'use strict';
const cli=(key,fallback)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)||fallback;
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const zlib = require('node:zlib'), assert = require('node:assert/strict');
const { chromium } = require('../.vercel/theme-tools/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = cli('out', process.env.KUNUZ_FLASH_OUT || 'C:/Users/passe/projects/quest-review/sessions/kunuz-theme-shots-2026-10-20/flash');
const phase = process.argv.includes('--before') ? 'before' : 'after';
const snapshot = path.join(root, '.vercel/flash-v1');
const pages = { hub: '/quest.html', test: '/quest-test.html', board: '/quest-board.html', ghaws: '/quest-ghaws.html', harb: '/quest-harb.html', hanna: '/hanna-laha/' };
const mutable = [...Object.values(pages).map(p => p.endsWith('/') ? p + 'index.html' : p), '/quest-sw.js', '/quest-theme/theme.css', '/quest-theme/journey.js', '/quest-theme/model.js', '/quest-theme/icons.js', '/quest-theme/motion-kit.js', '/quest-theme/history.js', '/hanna-laha/assets/iap-bridge-v1.js'];
fs.mkdirSync(out, { recursive: true });
if (phase === 'before') for (const file of mutable) {
  const target = path.join(snapshot, file); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
let build = 'v2';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let name = decodeURIComponent(url.pathname);
  if (name === '/api/iap-status') { res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({mode:'test'})); return; }
  if (name.startsWith('/hanna-laha/') && !path.extname(name)) name = '/hanna-laha/index.html';
  if (name === '/hanna-laha') name = '/hanna-laha/index.html';
  if (!/^\/(?:quest(?:[\w.-]*|-(?:theme|data)\/[\w./-]+)|hanna-laha\/[\w./-]+|iap-pending\.js|icon\.svg)$/.test(name) || name.includes('..')) { res.writeHead(404).end(); return; }
  const saved = path.join(snapshot, name), file = (build === 'v1' || phase === 'before') && fs.existsSync(saved) ? saved : path.join(root, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  let body = fs.readFileSync(file);
  if (name.endsWith('.html')) body = Buffer.from(body.toString().replace(/<head>/i, '<head><meta name="kunuz-test-build" content="' + build + '">'));
  if (name === '/quest-theme/journey.js') body = Buffer.concat([body, Buffer.from('\nwindow.__kunuzAssetBuild = "' + build + '";\n')]);
  if (name === '/quest-sw.js') body = Buffer.concat([body, Buffer.from('\n// Capture build ' + build + '\n')]);
  const headers = { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': /\.html$|quest-sw\.js$/.test(name) ? 'no-cache' : 'public, max-age=31536000', 'Service-Worker-Allowed': '/' };
  if (/\.(html|js|css)$/.test(name)) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
  res.writeHead(200, { ...headers, 'Content-Length': body.length }); res.end(body);
});
function monitor() {
  const proof = window.__flashProof = { samples: [], paints: [], assetViolations: [] };
  new PerformanceObserver(list => { for (const entry of list.getEntries()) proof.paints.push({ name: entry.name, startTime: entry.startTime }); }).observe({ type: 'paint', buffered: true });
  let last = -100;
  function sample(now) {
    if (now - last >= 40) {
      const visible = el => { const css = getComputedStyle(el), box = el.getBoundingClientRect(); return css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) !== 0 && box.width > 0 && box.height > 0; };
      const body = document.body, app = document.querySelector('.journey-app');
      if (app && visible(app) && !document.documentElement.classList.contains('kunuz-theme-pending')) {
        const badImages = [...app.querySelectorAll('img')].filter(img => !img.complete || !img.naturalWidth || img.src.startsWith('blob:')).map(img => img.getAttribute('src'));
        const fonts = [...document.fonts].filter(face => face.family === 'KunuzPlex');
        if (badImages.length || fonts.length !== 2 || fonts.some(face => face.status !== 'loaded')) proof.assetViolations.push({ at: now, badImages, fonts: fonts.map(face => ({ weight: face.weight, status: face.status })) });
      }
      proof.samples.push({ at: now, pending: document.documentElement.classList.contains('kunuz-theme-pending'), themed: body?.classList.contains('ezik-treasure-theme') || false, mounted: !!app?.querySelector('main') && !document.documentElement.classList.contains('kunuz-theme-pending'), legacy: body ? [...body.children].filter(el => !el.matches('script,style,link,.journey-app,.kunuz-theme-shell') && visible(el)).map(el => el.id || el.className || el.tagName) : [], htmlBuild: document.querySelector('meta[name=kunuz-test-build]')?.content, assetBuild: window.__kunuzAssetBuild, background: body ? getComputedStyle(body).backgroundColor : '', boot: window.KunuzThemeBoot?.status });
      last = now;
    }
    if (proof.samples.length < 6000) requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
async function ready(page) {
  await page.waitForFunction(() => window.KunuzJourney?.state.ready, null, { timeout: 180000 });
}
async function throttle(cdp, enabled) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: enabled ? 4 : 1 });
  // Chromium DevTools Fast 3G preset: 150ms RTT, 1.6Mbps down, 750Kbps up.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: enabled ? 150 : 0, downloadThroughput: enabled ? 1.6 * 1024 * 1024 / 8 : -1, uploadThroughput: enabled ? 750 * 1024 / 8 : -1, connectionType: enabled ? 'cellular3g' : 'none' });
}
async function strip(browser, record, frames) {
  if (!frames.length) return;
  const wanted = [0, record.firstPaint, record.firstPaint + 50, record.firstPaint + 150, record.firstPaint + 350, record.mountedAt, record.mountedAt + 150, record.mountedAt + 500];
  const selected = [...new Set(wanted.map(at => frames.reduce((best, f) => Math.abs(f.at - at) < Math.abs(best.at - at) ? f : best, frames[0])))];
  const page = await browser.newPage({ viewport: { width: selected.length * 195, height: 456 } });
  await page.setContent('<body style="margin:0;background:#082c38;color:#ffe6a3;font:14px Arial;display:flex">' + selected.map(f => '<div style="width:195px;flex:none;text-align:center"><div style="height:34px;padding-top:8px;box-sizing:border-box">' + record.name + ' · ' + Math.round(f.at) + ' ms</div><img style="width:195px;height:422px" src="data:image/png;base64,' + fs.readFileSync(f.path).toString('base64') + '"></div>').join(''));
  await page.screenshot({ path: path.join(out, record.name + '-strip.png') }); await page.close();
}
async function capture(browser, context, route, name, base) {
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  const raw = [], errors = [], failures = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => failures.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
  await cdp.send('Network.enable'); await throttle(cdp, true);
  // A fresh about:blank target can precede its first compositor surface.
  let initial;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { initial = await cdp.send('Page.captureScreenshot', { format: 'png' }); break; }
    catch (error) { if (attempt === 4) throw error; await page.waitForTimeout(100); }
  }
  cdp.on('Page.screencastFrame', event => {
    raw.push({ stamp: event.metadata.timestamp * 1000, data: event.data });
    cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
  await page.goto(base + route, { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction(() => document.querySelector('.journey-app main') && window.__kunuzAssetBuild && !document.documentElement.classList.contains('kunuz-theme-pending'), null, { timeout: 180000 });
  await page.waitForTimeout(650);
  const proof = await page.evaluate(() => ({ ...window.__flashProof, origin: performance.timeOrigin, mountedAt: window.__flashProof.samples.find(s => s.mounted)?.at, firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || performance.getEntriesByType('paint')[0]?.startTime }));
  await cdp.send('Page.stopScreencast');
  const frames = [], folder = path.join(out, name); fs.mkdirSync(folder, { recursive: true });
  const available = raw.map(f => ({ ...f, at: f.stamp - proof.origin })).filter(f => f.at >= 0).sort((a, b) => a.at - b.at);
  assert.ok(available.length, name + ': no screencast frames');
  const end = proof.mountedAt + 500;
  for (let at = 0; at <= end; at += 50) {
    // Screencast emits on changed paints. Hold the latest real frame at each 50ms tick.
    const frame = available.filter(f => f.at <= at).at(-1) || { at: -1, data: initial.data };
    const file = path.join(folder, String(at).padStart(6, '0') + '.png'); fs.writeFileSync(file, Buffer.from(frame.data, 'base64'));
    frames.push({ at, sourceAt: frame.at, path: file });
  }
  for (let i = 0; i < available.length; i++) fs.writeFileSync(path.join(folder, 'paint-' + String(i).padStart(4, '0') + '.png'), Buffer.from(available[i].data, 'base64'));
  const record = { name, route, build, width: 390, height: 844, cpu: 4, network: 'Fast 3G (150ms, 1.6Mbps/750Kbps)', firstPaint: proof.firstPaint, mountedAt: proof.mountedAt, rawPaints: available.length, sampledFrames: frames.length, sampling: '50ms sample-and-hold of real CDP screencast paints; raw paints also saved', errors, failuresAtMount: failures.slice(), ...proof };
  record.rawFrameTimes = available.map((frame,index) => ({ at: frame.at, file: 'paint-' + String(index).padStart(4, '0') + '.png' }));
  record.frameSamples = frames.map(frame => ({ at: frame.at, sourceAt: frame.sourceAt, file: path.basename(frame.path) }));
  record.legacySamples = proof.samples.filter(s => s.legacy.length);
  record.firstPaintState = proof.samples.find(s => s.at >= proof.firstPaint);
  record.htmlBuild = await page.locator('meta[name=kunuz-test-build]').getAttribute('content');
  record.assetBuild = await page.evaluate(() => window.__kunuzAssetBuild);
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(record, null, 2));
  await strip(browser, record, frames);
  if (phase === 'after') {
    assert.equal(record.legacySamples.length, 0, name + ': legacy UI became visible');
    assert.equal(record.htmlBuild, 'v2', name + ': stale HTML'); assert.equal(record.assetBuild, 'v2', name + ': stale JS');
    assert.ok(record.firstPaintState?.pending || record.firstPaintState?.themed, name + ': first paint lacked theme');
    assert.deepEqual(errors, [], name + ': browser errors');
    assert.deepEqual(record.assetViolations, [], name + ': missing pictures/fonts in visible frame');
  }
  console.log('CAPTURE ' + name + ' paint=' + Math.round(record.firstPaint) + 'ms mount=' + Math.round(record.mountedAt) + 'ms legacy=' + record.legacySamples.length);
  await throttle(cdp, false); await ready(page);
  await page.waitForFunction(() => window.KunuzJourney.diagnostics.offlineReady, null, { timeout: 180000 });
  await page.close(); return record;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  if (process.argv.includes('--serve')) { console.log(base); return; }
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [game, route] of Object.entries(pages)) {
      if (process.env.KUNUZ_FLASH_GAME && game !== process.env.KUNUZ_FLASH_GAME) continue;
      build = 'v2';
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); await context.addInitScript(monitor);
      results.push(await capture(browser, context, route, phase + '-' + game + '-cold', base));
      results.push(await capture(browser, context, route, phase + '-' + game + '-warm', base)); await context.close();
      build = 'v1';
      const update = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); await update.addInitScript(monitor);
      const seed = await update.newPage(); await seed.goto(base + route); await ready(seed);
      await seed.waitForFunction(() => window.KunuzJourney.diagnostics.offlineReady, null, { timeout: 180000 });
      if (phase === 'after') await seed.evaluate(async () => { await caches.open('kunuz-treasure-obsolete-proof'); await caches.open('ezik-retained-proof'); });
      await seed.close();
      build = 'v2';
      results.push(await capture(browser, update, route, phase + '-' + game + '-update', base));
      if (phase === 'after') {
        const page = await update.newPage(); await page.goto(base + route); await ready(page);
        const registrations = await page.evaluate(async () => { const all = await navigator.serviceWorker.getRegistrations(); await Promise.all(all.map(r => r.update())); return all.length; });
        const currentVersion = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root,'quest-sw.js'),'utf8'))[1];
        const previousVersion = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(snapshot,'quest-sw.js'),'utf8'))[1];
        await page.waitForFunction(async ({currentVersion,previousVersion}) => {
          const registrations = await navigator.serviceWorker.getRegistrations(), databases = (await indexedDB.databases()).map(db => db.name), names = await caches.keys();
          return registrations.every(r => r.active?.state === 'activated' && !r.installing && !r.waiting) && databases.includes('kunuz-treasure-assets-' + currentVersion) && (currentVersion === previousVersion || !databases.includes('kunuz-treasure-assets-' + previousVersion)) && !names.includes('kunuz-treasure-obsolete-proof');
        }, {currentVersion,previousVersion}, { timeout: 180000 });
        const cleanup = await page.evaluate(async () => ({ databases: (await indexedDB.databases()).map(db => db.name), caches: await caches.keys() }));
        if (previousVersion !== currentVersion) assert.ok(!cleanup.databases.includes('kunuz-treasure-assets-' + previousVersion), 'old asset database survived activation');
        assert.ok(!cleanup.caches.includes('kunuz-treasure-obsolete-proof'), 'old Kunuz cache survived activation');
        assert.ok(cleanup.caches.includes('ezik-retained-proof'), 'unrelated cache was deleted');
        await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });
        await update.setOffline(true); await page.reload(); await ready(page);
        assert.equal(await page.locator('meta[name=kunuz-test-build]').getAttribute('content'), 'v2');
        assert.equal(await page.evaluate(() => window.__kunuzAssetBuild), 'v2');
        await page.screenshot({ path: path.join(out, 'after-' + game + '-offline.png') });
        results.push({ name: 'after-' + game + '-offline', registrations, ready: true, build: 'v2', cacheStorageCleared: true, cleanup });
        await page.close();
      }
      await update.close();
      fs.writeFileSync(path.join(out, phase + '-summary.json'), JSON.stringify(results, null, 2));
    }
  } catch (e) { fs.writeFileSync(path.join(out, phase + '-failure.txt'), e.stack); throw e; }
  finally { fs.writeFileSync(path.join(out, phase + '-summary.json'), JSON.stringify(results, null, 2)); await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
