'use strict';
// ORDER §4-ب-١ -- THE SAME TWO NUMBERS ON THE LIVE SITE.
// Two plain read-only GETs, three readings each, median reported. NOTHING here
// touches /api/ask, and no paid route is called: these are the two list routes
// الفتاوى and الدروس already fetch the moment they open.
//
// AND THE WHOLE OPEN, END TO END, in the real browser against the live site --
// which is what the reader actually waits for, and which the local bench cannot
// give because the local bench has no server behind it.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-live');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const LIVE = 'https://ezik.app/';
const D = R.dictOf('C:/Users/passe/projects/ustaz-fix88/app.jsx');
const AR = D.ar;
const shelfRow = (page, id) => page.locator('[data-ezik-home-module="' + id + '"]');
const median = (xs) => {
  const a = xs.filter((n) => typeof n === 'number' && n >= 0).sort((x, y) => x - y);
  if (!a.length) return -1;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

const ROUTES = [
  ['fatwas-browse', '/api/v1/fatwas/browse?scholar=all&page=1&limit=20&view=full'],
  ['lessons-browse', '/api/lessons-browse'],
];

(async () => {
  const browser = await R.chromium.launch(R.LAUNCH);
  const out = { at: new Date().toISOString(), target: LIVE, wire: [], open: [] };
  try {
    // -- THE WIRE, on its own -------------------------------------------------
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
    for (const [name, p] of ROUTES) {
      const times = [], statuses = [], sizes = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        try {
          const res = name === 'lessons-browse'
            ? await ctx.request.post(LIVE.replace(/\/$/, '') + p, {
              data: { level: 'scholars' }, timeout: 45000,
              headers: { 'Content-Type': 'application/json' },
            })
            : await ctx.request.get(LIVE.replace(/\/$/, '') + p, {
              timeout: 45000, headers: { Accept: 'application/json' },
            });
          const body = await res.body();
          times.push(Date.now() - t0);
          statuses.push(res.status());
          sizes.push(body.length);
        } catch (e) {
          times.push(-1); statuses.push(0); sizes.push(0);
        }
        await new Promise((r) => setTimeout(r, 900));
      }
      out.wire.push({ name, path: p, ms: times, medianMs: median(times), statuses, sizes });
      R.say('  wire', name, 'ms=' + JSON.stringify(times), 'median=' + median(times),
        'status=' + JSON.stringify(statuses));
    }
    await ctx.close();

    // -- THE WHOLE OPEN, in a browser, against the live site ------------------
    for (const id of ['fatwa', 'lessons']) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
        const page = await c.newPage();
        try {
          await R.enter(page, AR, D.lit, LIVE);
          await R.toHome(page, AR);
          const home = await R.sig(page);
          const row = shelfRow(page, id);
          if (!(await row.count())) { runs.push({ err: 'no-shelf-row' }); await c.close(); continue; }
          await row.first().click();
          const seen = await page.evaluate(async (a) => {
            const read = () => (document.body && document.body.innerText) || '';
            const t0 = performance.now();
            let leftHome = -1, body = -1, loader = -1, loaderText = '';
            const floorLen = a.homeLen;
            while (performance.now() - t0 < 30000) {
              const now = read();
              if (leftHome < 0 && now !== a.home) leftHome = Math.round(performance.now() - t0);
              if (leftHome >= 0) {
                const waiting = a.wait.some((w) => now.indexOf(w) >= 0);
                const live = document.querySelectorAll('[role="status"],[aria-busy="true"],[role="progressbar"]').length > 0;
                if (loader < 0 && (waiting || live)) {
                  loader = Math.round(performance.now() - t0);
                  loaderText = now.replace(/\s+/g, ' ').slice(0, 160);
                }
                // THE BODY HAS ARRIVED when the screen is no longer saying it is
                // waiting AND is no longer the bare shell. On the live site there
                // is no planted marker to look for, so the test is: no waiting
                // sentence on screen, and a live region count of zero.
                if (body < 0 && !waiting && !live && now.length > 40) {
                  body = Math.round(performance.now() - t0);
                }
              }
              if (body >= 0 && loader >= 0) break;
              await new Promise((r) => requestAnimationFrame(r));
            }
            return { leftHome, body, loader, loaderText, len: read().length };
          }, {
            home: home.text, homeLen: home.textLen,
            wait: Object.keys(AR).filter((k) => /(^|\.)(loading|browseLoading|searching)$/i.test(k))
              .map((k) => AR[k]).filter(Boolean),
          });
          await page.waitForTimeout(800);
          seen.shot = await R.shot(page, SHOTS, 'live-' + id + '-' + i);
          runs.push(seen);
        } catch (e) { runs.push({ err: String(e && e.message).slice(0, 160) }); }
        await c.close();
      }
      const rec = {
        section: id, runs,
        medianBodyMs: median(runs.map((r) => r.body)),
        medianLoaderMs: median(runs.map((r) => r.loader)),
        loaderEverShown: runs.some((r) => r.loader >= 0),
      };
      out.open.push(rec);
      R.say('  open', id, 'bodyMs=' + JSON.stringify(runs.map((r) => r.body)),
        'median=' + rec.medianBodyMs, 'loaderShown=' + rec.loaderEverShown);
    }
  } finally { await browser.close(); }
  const f = path.join(OUT, 'live.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  R.say('WROTE', f);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
