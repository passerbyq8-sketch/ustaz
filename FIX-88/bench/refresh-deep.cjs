'use strict';
// THE FOUR REFRESH READINGS THE TOOL STILL FLAGS: memorize and mushaf, both sizes.
// The tool says the reload lands on «an unnamed view». That is a statement about
// what it can NAME, not about where the reader is -- so this asks the only question
// that matters: after the reload, is the reader back in the SAME SECTION, on the
// SAME SCREEN he was on, and how many presses does the shelf then cost him?
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const SHOTS = path.join(OUT, 'shots-refreshdeep');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const FILE = path.join(OUT, 'refresh-deep.json');
const out = { at: new Date().toISOString(), cases: [] };
const save = () => fs.writeFileSync(FILE, JSON.stringify(out, null, 2));

const onShelf = (t) => t.indexOf(AR['module.fatwa']) >= 0 && t.indexOf(AR['module.lessons']) >= 0
  && t.indexOf(AR['module.mushaf']) >= 0 && t.indexOf(AR['module.fatwa.sub']) < 0;

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  try {
    for (const vp of [{ tag: 'm390', w: 390, h: 844 }, { tag: 't820', w: 820, h: 1180 }]) {
      for (const id of ['memorize', 'mushaf']) {
        const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ar', serviceWorkers: 'block' });
        await R.installRoutes(ctx, 'rows', null, []);
        const page = await ctx.newPage();
        const rec = { id, vp: vp.tag };
        try {
          await R.enter(page, AR, D.lit, base);
          await R.toHome(page, AR);
          await page.locator('[data-ezik-home-module="' + id + '"]').first().click();
          await R.settle(page, 9000); await page.waitForTimeout(2600);
          // GO ONE LEVEL DEEP, which is what "in the middle of the section" means and
          // what the sweep's own act 2 leaves behind.
          const rows = await page.evaluate(() => {
            const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
            return Array.from(document.querySelectorAll('button')).filter(vis)
              .map((el, i) => ({ i, t: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
                a: el.getAttribute('aria-label') || '' }));
          });
          const deep = rows.filter((r) => r.t.length > 2 && r.a !== AR['common.back'])[6] || rows[3];
          rec.opened = deep ? deep.t : null;
          if (deep) {
            await page.locator('button').nth(deep.i).click({ timeout: 8000 });
            await R.settle(page, 9000); await page.waitForTimeout(2600);
          }
          const before = await R.sig(page);
          rec.beforeHead = before.text.slice(0, 90);
          rec.beforeWhere = whereAmI(before.text, AR);
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
          await R.settle(page, 9000); await page.waitForTimeout(3200);
          const after = await R.sig(page);
          rec.afterHead = after.text.slice(0, 90);
          rec.afterWhere = whereAmI(after.text, AR);
          rec.landedOnChat = rec.afterWhere === 'chat';
          rec.sameScreen = after.text.slice(0, 50) === before.text.slice(0, 50);
          rec.inSection = after.text.indexOf(AR['module.' + id]) >= 0 || rec.sameScreen;
          rec.shot = await R.shot(page, SHOTS, 'rd-' + id + '-' + vp.tag);
          // AND HOW MANY PRESSES TO THE SHELF FROM WHERE THE RELOAD PUT HIM.
          let presses = 0; let reached = false;
          for (let step = 0; step < 4 && !reached; step++) {
            const b = page.getByRole('button', { name: AR['common.back'] });
            let clicked = false;
            if (await b.count()) { await b.first().click({ timeout: 5000 }); clicked = true; }
            else {
              const cands = await page.evaluate(() => {
                const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
                return Array.from(document.querySelectorAll('button')).filter(vis)
                  .map((el, i) => ({ i, t: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24) }));
              });
              const up = cands.filter((c) => c.t && c.t.length <= 12)[0];
              if (!up) break;
              await page.locator('button').nth(up.i).click({ timeout: 5000 }); clicked = true;
              rec.usedControl = (rec.usedControl || []).concat([up.t]);
            }
            if (!clicked) break;
            presses += 1;
            await page.waitForTimeout(2000);
            const s = await R.sig(page);
            if (onShelf(s.text)) reached = true;
          }
          rec.pressesToShelf = reached ? presses : -1;
        } catch (e) { rec.error = String(e && e.message).slice(0, 160); }
        out.cases.push(rec); save();
        R.say(' ', id, vp.tag, 'before=' + rec.beforeWhere, 'after=' + rec.afterWhere,
          'sameScreen=' + rec.sameScreen, 'chat=' + rec.landedOnChat,
          'pressesToShelf=' + rec.pressesToShelf);
        await ctx.close();
      }
    }
  } finally { await browser.close(); srv.close(); save(); }
  R.say('WROTE', FILE);
})();
