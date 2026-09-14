'use strict';
// THE MUSHAF READING PAGE, LISTED IN FULL AND ASKED HOW A READER LEAVES IT.
// Everything is written to disk as it is measured, so a timeout later cannot
// take the earlier readings with it -- which is exactly what happened on the
// first attempt at this probe.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const SHOTS = path.join(OUT, 'shots-mushaf');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const BACK = AR['common.back'];
const FILE = path.join(OUT, 'mushaf-page.json');
const out = { at: new Date().toISOString(), back: BACK, steps: [] };
const save = () => fs.writeFileSync(FILE, JSON.stringify(out, null, 2));

const names = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  // EVERY pressable thing, and the hidden ones too -- a back control that exists
  // but is not visible is a different finding from one that does not exist.
  const all = Array.from(document.querySelectorAll('button,[role="button"],a[href],summary'));
  return all.map((el, i) => ({
    i, g: el.tagName.toLowerCase(), visible: vis(el),
    t: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 34),
    a: el.getAttribute('aria-label') || '',
    cls: String(el.className || '').slice(0, 40),
  }));
});

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  out.base = base;
  const browser = await R.chromium.launch(R.LAUNCH);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
    await R.installRoutes(ctx, 'rows', null, []);
    const page = await ctx.newPage();
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await page.locator('[data-ezik-home-module="mushaf"]').first().click();
    await R.settle(page, 9000); await page.waitForTimeout(2600);

    const idx = await names(page);
    out.index = {
      head: (await R.sig(page)).text.slice(0, 80),
      total: idx.length, visible: idx.filter((c) => c.visible).length,
      namedBackVisible: idx.filter((c) => c.visible && (c.a === BACK || c.t === BACK)).length,
    };
    await R.shot(page, SHOTS, 'mushaf-index'); save();
    R.say('index: visible', out.index.visible, 'namedBack', out.index.namedBackVisible);

    // open a JUZ row -- «الجزء ٢ / صفحة ٢٢» -- which is what act 2 presses
    const juz = idx.filter((c) => c.visible && /الجزء/.test(c.t))[1];
    out.openedRow = juz ? juz.t : null;
    if (juz) {
      await page.locator('button,[role="button"],a[href],summary').nth(juz.i).click({ timeout: 8000 });
      await R.settle(page, 9000); await page.waitForTimeout(3000);
    }
    const rd = await names(page);
    out.reading = {
      head: (await R.sig(page)).text.slice(0, 80),
      total: rd.length, visible: rd.filter((c) => c.visible).length,
      namedBackVisible: rd.filter((c) => c.visible && (c.a === BACK || c.t === BACK)).length,
      namedBackHidden: rd.filter((c) => !c.visible && (c.a === BACK || c.t === BACK)).length,
      controls: rd,
    };
    await R.shot(page, SHOTS, 'mushaf-reading'); save();
    R.say('reading: visible', out.reading.visible, 'namedBackVisible', out.reading.namedBackVisible,
      'namedBackHidden', out.reading.namedBackHidden);

    // press each visible control and see which returns to the index
    for (const c of rd.filter((x) => x.visible)) {
      const label = c.a || c.t;
      if (!label) continue;
      let where = 'unknown';
      try {
        await page.locator('button,[role="button"],a[href],summary').nth(c.i).click({ timeout: 5000 });
        await page.waitForTimeout(1900);
        const s = await R.sig(page);
        const onIndex = s.text.indexOf('الانتقال إلى جزء') >= 0;
        const onShelf = s.text.indexOf(AR['module.fatwa']) >= 0 && s.text.indexOf(AR['module.lessons']) >= 0;
        where = onIndex ? 'the mushaf index' : (onShelf ? 'the shelf or the chat' : 'still on the page');
        out.steps.push({ label, where, textLen: s.textLen });
        save();
        R.say('  pressed', JSON.stringify(label.slice(0, 22)), '->', where);
        if (onIndex) { out.wayOut = { label, to: 'the mushaf index' }; break; }
      } catch (e) { out.steps.push({ label, where: 'would-not-take-a-press' }); save(); }
    }

    // and the DEVICE back button, which is the other door every layer registers
    try {
      await page.goBack({ timeout: 9000 });
      await page.waitForTimeout(2200);
      const s = await R.sig(page);
      out.browserBack = s.text.indexOf('الانتقال إلى جزء') >= 0
        ? 'the mushaf index'
        : (s.text.indexOf(AR['module.fatwa']) >= 0 ? 'the shelf or the chat' : 'somewhere else');
    } catch (e) { out.browserBack = 'threw'; }
    save();
    R.say('browser back ->', out.browserBack);
  } catch (e) {
    out.fatal = String(e && e.message).slice(0, 200); save();
    R.say('CAUGHT', out.fatal);
  } finally { await browser.close(); srv.close(); save(); }
  R.say('WAY OUT:', JSON.stringify(out.wayOut || null), 'WROTE', FILE);
})();
