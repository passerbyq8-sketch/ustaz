'use strict';
// ORDER §4-ب-١, SECOND CUT. The first pass could not time الفتاوى, and the reason
// is worth recording: that screen keeps a PERMANENT [role="status"] region -- the
// same element carries «يُحمِّل…» while it waits and «الفتاوى مرتبة أبجديًّا — N فتوى»
// when it is done -- so "no live region on screen" is never true there and a
// predicate built on it waits forever.
//
// SO THE WAIT IS TIMED BY THE WAITING SENTENCE ITSELF: from the press to the first
// frame in which the app's own waiting line is no longer on the screen, having
// been on it. That is exactly the interval the reader spends looking at «يُحمِّل»,
// it needs no planted marker, and it works identically on both sections and on
// both the live site and the bench.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TARGET = process.argv[2] || 'https://ezik.app/';
const LABEL = process.argv[3] || 'live';
const OUT = path.resolve(process.argv[4] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-' + LABEL + '-w');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf('C:/Users/passe/projects/ustaz-fix88/app.jsx');
const AR = D.ar;
const WAIT = Object.keys(AR).filter((k) => /(^|\.)(loading|browseLoading|searching)$/i.test(k))
  .map((k) => AR[k]).filter(Boolean);
const shelfRow = (page, id) => page.locator('[data-ezik-home-module="' + id + '"]');
const median = (xs) => {
  const a = xs.filter((n) => typeof n === 'number' && n >= 0).sort((x, y) => x - y);
  if (!a.length) return -1;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

(async () => {
  const local = !/^https:\/\/ezik\.app/.test(TARGET);
  let srv = null, base = TARGET;
  if (local && !/^https?:\/\//.test(TARGET)) {
    const s = await R.serve(TARGET);
    srv = s.srv; base = 'http://127.0.0.1:' + s.port + '/';
  }
  R.say('TARGET', base, 'LABEL', LABEL);
  const browser = await R.chromium.launch(R.LAUNCH);
  const out = { at: new Date().toISOString(), target: base, sections: [] };
  try {
    for (const id of ['fatwa', 'lessons']) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
        const page = await c.newPage();
        try {
          await R.enter(page, AR, D.lit, base);
          await R.toHome(page, AR);
          const home = await R.sig(page);
          const row = shelfRow(page, id);
          if (!(await row.count())) { runs.push({ err: 'no-shelf-row' }); await c.close(); continue; }
          await row.first().click();
          const seen = await page.evaluate(async (a) => {
            const read = () => (document.body && document.body.innerText) || '';
            const t0 = performance.now();
            let left = -1, waitStart = -1, waitEnd = -1, waitText = '';
            let sawWaiting = false;
            while (performance.now() - t0 < 30000) {
              const now = read();
              if (left < 0 && now !== a.home) left = Math.round(performance.now() - t0);
              if (left >= 0) {
                const w = a.wait.filter((x) => now.indexOf(x) >= 0);
                if (w.length) {
                  sawWaiting = true;
                  if (waitStart < 0) { waitStart = Math.round(performance.now() - t0); waitText = w[0]; }
                } else if (sawWaiting && waitEnd < 0) {
                  waitEnd = Math.round(performance.now() - t0);
                  break;
                }
              }
              await new Promise((r) => requestAnimationFrame(r));
            }
            return { left, waitStart, waitEnd, waitText, sawWaiting, len: read().length,
              head: read().replace(/\s+/g, ' ').slice(0, 160) };
          }, { home: home.text, wait: WAIT });
          await page.waitForTimeout(700);
          seen.shot = await R.shot(page, SHOTS, LABEL + '-' + id + '-' + i);
          runs.push(seen);
        } catch (e) { runs.push({ err: String(e && e.message).slice(0, 160) }); }
        await c.close();
      }
      const rec = {
        section: id, runs,
        medianBodyMs: median(runs.map((r) => r.waitEnd)),
        medianWaitShownMs: median(runs.map((r) => r.waitStart)),
        loaderShownEveryTime: runs.every((r) => r.sawWaiting === true),
      };
      out.sections.push(rec);
      R.say('  ', id, 'waitEnd=' + JSON.stringify(runs.map((r) => r.waitEnd)),
        'median=' + rec.medianBodyMs, 'loaderEveryTime=' + rec.loaderShownEveryTime);
    }
  } finally { await browser.close(); if (srv) srv.close(); }
  const f = path.join(OUT, 'wait-' + LABEL + '.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  R.say('WROTE', f);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
