'use strict';
// WHERE DOES رحلة الكنوز LET THE READER OUT, EXACTLY? The earlier pass answered
// "there is a way back" with a test that also matches the CHAT, because the chat
// draws suggestion cards carrying every module's name. So this asks it again with
// a test that can tell the shelf from the chat, and names every control it tried.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const SHOTS = path.join(OUT, 'shots-treasure');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  const out = { at: new Date().toISOString(), base, tried: [] };
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
    await R.installRoutes(ctx, 'rows', null, []);
    const page = await ctx.newPage();
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await page.locator('[data-ezik-home-module="treasure"]').first().click();
    await R.settle(page, 9000);
    await page.waitForTimeout(3000);
    out.url = page.url();
    const names = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      return Array.from(document.querySelectorAll('button,[role="button"],a[href]')).filter(vis)
        .map((el, i) => ({ i, tag: el.tagName.toLowerCase(),
          t: (el.innerText || '').trim().slice(0, 30),
          a: el.getAttribute('aria-label') || '' }));
    });
    out.controls = names;
    R.say('url', out.url, 'controls', names.length);
    // press each, one clean visit per candidate
    for (const n of names) {
      const label = n.a || n.t;
      if (!label) continue;
      let landed = 'unknown', url = '';
      try {
        await page.locator('button,[role="button"],a[href]').nth(n.i).click({ timeout: 5000 });
        await page.waitForTimeout(2200);
        const s = await R.sig(page);
        url = s.url;
        const inApp = !/quest\.html/.test(url);
        landed = inApp ? whereAmI(s.text, AR) : 'still-in-the-quest';
        out.tried.push({ label, tag: n.tag, landed, url: url.replace(base, '/'), inApp });
        R.say('  pressed', JSON.stringify(label.slice(0, 24)), '->', landed, inApp ? '(in the app)' : '');
        if (inApp) {
          await R.shot(page, SHOTS, 'treasure-exit-landed');
          out.exitFound = { label, landed };
          break;
        }
      } catch (e) {
        out.tried.push({ label, tag: n.tag, landed: 'would-not-take-a-press' });
        continue;
      }
    }
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
  fs.writeFileSync(path.join(OUT, 'treasure-exit.json'), JSON.stringify(out, null, 2));
  R.say('exitFound', JSON.stringify(out.exitFound || null));
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
