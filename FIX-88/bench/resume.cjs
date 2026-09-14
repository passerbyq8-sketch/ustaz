'use strict';
// DEFECT 14, THE OTHER THREE HALVES. Restoring the section is only correct if the
// three things it must NOT change are still true:
//   1. a FIRST opening (a tab that has never been used) lands on the chat;
//   2. a reader who walked back out to the shelf and refreshes lands on the CHAT
//      again -- the record is forgotten where he is standing nowhere;
//   3. the two layers App owns (الأسماء and «من الاستيقاظ إلى النوم») restore too,
//      because they are shelf sections with no `screen` value of their own.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const LABEL = process.argv[3] || 'run';
const OUT = path.resolve(process.argv[4] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-' + LABEL + '-r');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const shelfRow = (page, id) => page.locator('[data-ezik-home-module="' + id + '"]');

async function session(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'ar',
    serviceWorkers: 'block', deviceScaleFactor: 1,
  });
  await R.installRoutes(ctx, 'rows', null, []);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(String(m.text()).slice(0, 160)); });
  page.on('pageerror', (e) => errs.push('PAGEERR ' + String(e && e.message).slice(0, 160)));
  return { ctx, page, errs };
}

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  R.say('TREE', TREE, 'LABEL', LABEL, 'PORT', port);
  const browser = await R.chromium.launch(R.LAUNCH);
  const results = [];
  try {
    // 1 -- A FIRST OPENING. A fresh context is a fresh tab: no session record exists.
    {
      const { ctx, page, errs } = await session(browser);
      const rec = { id: 'first-open' };
      await R.enter(page, AR, D.lit, base);
      await page.waitForTimeout(2200);
      const s = await R.sig(page);
      rec.where = whereAmI(s.text, AR);
      rec.head = s.text.slice(0, 120);
      rec.landsOnChat = rec.where === 'chat';
      rec.shot = await R.shot(page, SHOTS, LABEL + '-first-open');
      rec.consoleErrors = errs.slice(0, 4);
      await ctx.close(); results.push(rec);
      R.say('  first-open where=' + rec.where + ' landsOnChat=' + rec.landsOnChat);
    }

    // 2 -- WALKED BACK OUT, THEN REFRESHED. The record must be gone.
    {
      const { ctx, page, errs } = await session(browser);
      const rec = { id: 'walked-out-then-refresh' };
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await shelfRow(page, 'articles').first().click();
      await R.settle(page, 8000); await page.waitForTimeout(2200);
      rec.inSection = (await R.sig(page)).text.slice(0, 60);
      // out again, by the app's own back
      const b = page.getByRole('button', { name: AR['common.back'] });
      rec.backControls = await b.count();
      if (rec.backControls) { await b.first().click(); await page.waitForTimeout(2000); }
      const onShelf = await R.sig(page);
      rec.afterBack = whereAmI(onShelf.text, AR);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
      await R.settle(page, 8000); await page.waitForTimeout(2800);
      const after = await R.sig(page);
      rec.afterRefresh = whereAmI(after.text, AR);
      rec.head = after.text.slice(0, 120);
      rec.forgotten = rec.afterRefresh === 'chat';
      rec.shot = await R.shot(page, SHOTS, LABEL + '-walked-out');
      rec.consoleErrors = errs.slice(0, 4);
      await ctx.close(); results.push(rec);
      R.say('  walked-out afterBack=' + rec.afterBack + ' afterRefresh=' + rec.afterRefresh
        + ' forgotten=' + rec.forgotten);
    }

    // 3 -- THE TWO LAYERS App OWNS.
    for (const id of ['asmaa', 'sunan-day']) {
      const { ctx, page, errs } = await session(browser);
      const rec = { id: 'layer-' + id };
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const row = shelfRow(page, id);
      rec.rowFound = await row.count();
      if (rec.rowFound) {
        await row.first().click();
        await R.settle(page, 8000); await page.waitForTimeout(2400);
        const before = await R.sig(page);
        rec.beforeHead = before.text.slice(0, 100);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
        await R.settle(page, 8000); await page.waitForTimeout(2800);
        const after = await R.sig(page);
        rec.afterHead = after.text.slice(0, 100);
        rec.afterWhere = whereAmI(after.text, AR);
        rec.restored = after.text.slice(0, 50) === before.text.slice(0, 50);
        rec.shot = await R.shot(page, SHOTS, LABEL + '-layer-' + id);
      }
      rec.consoleErrors = errs.slice(0, 4);
      await ctx.close(); results.push(rec);
      R.say('  layer-' + id + ' restored=' + rec.restored + ' where=' + rec.afterWhere);
    }

    // 4 -- TWO REFRESHES IN A ROW inside a section: the record survives the first.
    {
      const { ctx, page, errs } = await session(browser);
      const rec = { id: 'refresh-twice' };
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await shelfRow(page, 'lessons').first().click();
      await R.settle(page, 8000); await page.waitForTimeout(2200);
      const before = await R.sig(page);
      for (let i = 0; i < 2; i++) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
        await R.settle(page, 8000); await page.waitForTimeout(2800);
      }
      const after = await R.sig(page);
      rec.beforeHead = before.text.slice(0, 90);
      rec.afterHead = after.text.slice(0, 90);
      rec.stillThere = after.text.slice(0, 50) === before.text.slice(0, 50);
      rec.shot = await R.shot(page, SHOTS, LABEL + '-refresh-twice');
      rec.consoleErrors = errs.slice(0, 4);
      await ctx.close(); results.push(rec);
      R.say('  refresh-twice stillThere=' + rec.stillThere);
    }
  } finally {
    await browser.close();
    srv.close();
  }
  const file = path.join(OUT, 'resume-' + LABEL + '.json');
  fs.writeFileSync(file, JSON.stringify({ tree: TREE, label: LABEL, at: new Date().toISOString(), results }, null, 2));
  R.say('WROTE', file, 'cases=' + results.length);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
