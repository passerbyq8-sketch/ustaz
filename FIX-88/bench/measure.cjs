'use strict';
// ---------------------------------------------------------------------------
// THE MEASUREMENT. One tree in, one JSON out. Every case below is a case the
// order names, and each runs in its OWN browser context so no localStorage,
// no memoised module state and no history from the case before it can leak in.
//
//   node measure.cjs <tree> <label> <outdir>
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TREE = path.resolve(process.argv[2]);
const LABEL = process.argv[3] || 'run';
const OUT = path.resolve(process.argv[4] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-' + LABEL);
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;

// Which dictionary keys are visible on the screen right now, restricted to the
// ones that WORD AN OUTCOME. Naming a key is how "which sentence appeared" is
// recorded without typing Arabic into this file.
const OUTCOME_KEYS = Object.keys(AR).filter((k) => (
  /\.(error|Error|failed|Failed|empty|Empty|emptyTitle|emptyBody|retry|throttled|Throttled|offline|Offline)$/.test(k)
  || /^common\.(retry|loading)$/.test(k)
  || /^feedback\.(thanks|capped|failed|empty|noChat|signInRequired|signInGo)$/.test(k)
  || /^(articles|lessons|fatwa|asmaa)\./.test(k)
));

function outcomeKeysIn(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const hit = [];
  for (const k of OUTCOME_KEYS) {
    const v = String(AR[k] || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 4 && t.indexOf(v) >= 0) hit.push(k);
  }
  return hit;
}

const VPS = [{ tag: 'm390', width: 390, height: 844 }];

async function session(browser, mode, only, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, locale: 'ar',
    serviceWorkers: 'block', deviceScaleFactor: 1,
  });
  const seen = [];
  await R.installRoutes(ctx, mode, only, seen);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(String(m.text()).slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('PAGEERR ' + String(e && e.message).slice(0, 200)));
  return { ctx, page, seen, errs };
}

// THE SHELF ROW IS FOUND BY ITS OWN ATTRIBUTE, not by its label. MEASURED reason:
// a section that holds something unseen grows a marked dot whose aria-label joins the
// button's accessible name, so an exact name match finds nothing in exactly the case
// where rows arrived -- which is the case the whole rig exists to draw.
function shelfRow(page, id) { return page.locator('[data-ezik-home-module="' + id + '"]'); }

async function openShelf(page, key, id) {
  const b = shelfRow(page, id);
  const n = await b.count();
  if (!n) return { opened: false, why: 'no-shelf-row' };
  await b.first().click();
  await R.settle(page, 8000);
  await page.waitForTimeout(1600);
  return { opened: true };
}

// ---- CASE FAMILY 1: the four faked outcomes, per section -------------------
async function fourCases(browser, base, sectionKey, sectionId, routes, results) {
  for (const mode of ['429', '503', 'empty', 'rows']) {
    const vp = VPS[0];
    const { ctx, page, seen, errs } = await session(browser, mode, routes, vp);
    const rec = { family: 'four', section: sectionId, mode: mode, vp: vp.tag };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const op = await openShelf(page, sectionKey, sectionId);
      rec.opened = op.opened;
      if (op.opened) {
        await page.waitForTimeout(2200);
        const s = await R.sig(page);
        rec.textLen = s.textLen;
        rec.text = s.text.slice(0, 900);
        rec.controls = s.controls;
        rec.live = s.live;
        rec.keys = outcomeKeysIn(s.text);
        rec.shot = await R.shot(page, SHOTS, LABEL + '-' + sectionId + '-' + mode);
      }
      rec.routes = seen.map((x) => x.name);
      rec.consoleErrors = errs.slice(0, 6);
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close();
    results.push(rec);
    R.say('  ', sectionId, mode, 'keys=' + JSON.stringify(rec.keys || []), 'len=' + rec.textLen);
  }
}

// ---- CASE FAMILY 2: how long until real body text after the tap ------------
// Real body = the section's text grew past the shell's own chrome AND is not
// only a loading line. Measured by polling innerText every 60ms from the click.
const LATENCY_PROBE = (chromeLen) => {
  // placed in page context by evaluate
  return 0;
};

async function openLatency(browser, base, sectionKey, sectionId, mode, routes, results, delayMs) {
  const vp = VPS[0];
  const { ctx, page, seen, errs } = await session(browser, mode, routes, null || vp);
  if (delayMs) {
    // A server that is slow rather than broken: the same rows, later.
    await ctx.unroute('**/api/**');
    await ctx.route('**/api/**', async (route) => {
      const nm = R.routeName(route.request().url());
      seen.push({ name: nm });
      await new Promise((r) => setTimeout(r, delayMs));
      const body = R.ROWS[nm];
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(body || { ok: true }) });
    });
  }
  const rec = { family: 'latency', section: sectionId, mode: mode, delayMs: delayMs || 0 };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    const before = await R.sig(page);
    const b = shelfRow(page, sectionId);
    if (!(await b.count())) { rec.error = 'no-shelf-row'; }
    else {
      const t0 = Date.now();
      await b.first().click();
      // poll: first frame whose text differs from home AND whose length exceeds
      // the bare shell, plus whether a loading indicator was ever on screen.
      const poll = await page.evaluate(async (args) => {
        const t = () => (document.body && document.body.innerText) || '';
        const homeText = args.homeText;
        const loadWords = args.loadWords;
        const started = performance.now();
        let firstBody = -1, sawLoader = -1, loaderText = '';
        let lastLen = 0;
        while (performance.now() - started < 25000) {
          const now = t();
          const left = now !== homeText;
          if (left) {
            const hasLoader = loadWords.some((w) => w && now.indexOf(w) >= 0);
            const spinner = document.querySelectorAll('[role="status"]').length > 0;
            if (sawLoader < 0 && (hasLoader || spinner)) {
              sawLoader = Math.round(performance.now() - started);
              loaderText = now.slice(0, 200);
            }
            // real body = the screen holds substantially more than the shell and
            // is no longer only the loading line
            if (firstBody < 0 && now.length > args.floor && !hasLoader) {
              firstBody = Math.round(performance.now() - started);
            }
            lastLen = now.length;
          }
          if (firstBody >= 0 && sawLoader >= 0) break;
          await new Promise((r) => requestAnimationFrame(r));
        }
        return { firstBody, sawLoader, loaderText, lastLen };
      }, {
        homeText: before.text,
        loadWords: [AR['common.loading'], AR['lessons.browseLoading'], AR['lessons.loading'], AR['fatwa.loading']].filter(Boolean),
        floor: 200,
      });
      rec.msFirstBody = poll.firstBody;
      rec.msLoaderSeen = poll.sawLoader;
      rec.loaderText = poll.loaderText;
      rec.wallMs = Date.now() - t0;
      await page.waitForTimeout(1200);
      const s = await R.sig(page);
      rec.textLen = s.textLen;
      rec.live = s.live;
      rec.shot = await R.shot(page, SHOTS, LABEL + '-lat-' + sectionId + '-' + (delayMs || 0));
    }
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  lat', sectionId, 'delay=' + (delayMs || 0), 'firstBody=' + rec.msFirstBody, 'loader=' + rec.msLoaderSeen);
}

// ---- CASE FAMILY 3: the one-off measurements -------------------------------
async function oneOffs(browser, base, results) {
  // 3a. THE GREETING with no stored name.
  {
    const { ctx, page, errs } = await session(browser, 'rows', null, VPS[0]);
    const rec = { family: 'one', id: 'greeting' };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const g = await page.evaluate((hello) => {
        const t = (document.body && document.body.innerText) || '';
        const at = t.indexOf(hello);
        if (at < 0) return { found: false, line: '', tail: '' };
        const line = t.slice(at, t.indexOf('\n', at) < 0 ? t.length : t.indexOf('\n', at));
        return { found: true, line: line, tail: line.slice(hello.length).trim() };
      }, AR['home.hello']);
      rec.helloFound = g.found;
      rec.helloLine = g.line;
      rec.tail = g.tail;
      rec.tailEmpty = g.found && g.tail.length === 0;
      rec.shot = await R.shot(page, SHOTS, LABEL + '-greeting');
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  greeting found=' + rec.helloFound + ' tailEmpty=' + rec.tailEmpty + ' tailLen=' + (rec.tail || '').length);
  }

  // 3b. THE FATWA SOURCE CONTROL. What is it, and does pressing it do anything
  //     the page it is on can see? A new tab is a thing the page cannot see.
  {
    const { ctx, page, errs } = await session(browser, 'rows', null, VPS[0]);
    const rec = { family: 'one', id: 'fatwa-source' };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await openShelf(page, 'module.fatwa', 'fatwa');
      await page.waitForTimeout(2500);
      const s = await R.sig(page);
      const hit = s.names.filter((n) => n.t === AR['fatwa.source'] || n.a === AR['fatwa.source']);
      rec.present = hit.length;
      rec.shape = hit[0] || null;
      if (hit.length) {
        const before = await R.sig(page);
        let newPage = null;
        const p = ctx.waitForEvent('page', { timeout: 4000 }).then((x) => { newPage = x; }).catch(() => {});
        try {
          await page.getByRole('link', { name: AR['fatwa.source'], exact: true }).first()
            .click({ timeout: 5000 });
        } catch (e) { rec.clickErr = String(e && e.message).split('\n')[0].slice(0, 140); }
        await p;
        await page.waitForTimeout(1500);
        const after = await R.sig(page);
        rec.sameTabChanged = (before.textLen !== after.textLen) || (before.url !== after.url)
          || (before.controls !== after.controls);
        rec.newTabOpened = !!newPage;
        rec.newTabUrl = newPage ? String(newPage.url()).slice(0, 140) : '';
        if (newPage) { try { await newPage.close(); } catch (e) {} }
      }
      rec.shot = await R.shot(page, SHOTS, LABEL + '-fatwa-source');
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  fatwa.source present=' + rec.present + ' sameTabChanged=' + rec.sameTabChanged + ' newTab=' + rec.newTabOpened);
  }

  // 3c. A BACK ROUTE OUT OF mushaf AND treasure -- BY ANY NAME. Every visible
  //     control on the top level is listed, and each is tried until one lands
  //     on the shelf. `common.back` is not privileged here.
  for (const [key, id] of [['module.mushaf', 'mushaf'], ['module.treasure', 'treasure']]) {
    const { ctx, page, errs } = await session(browser, 'rows', null, VPS[0]);
    const rec = { family: 'one', id: 'back-' + id };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const homeSig = await R.sig(page);
      await openShelf(page, key, id);
      await page.waitForTimeout(2500);
      const s = await R.sig(page);
      rec.url = s.url;
      rec.controlNames = s.names.map((n) => ({ t: n.t, a: n.a, g: n.g }));
      rec.commonBackCount = s.names.filter((n) => n.t === AR['common.back'] || n.a === AR['common.back']).length;
      rec.shot = await R.shot(page, SHOTS, LABEL + '-' + id + '-top');
      // try every control, one fresh visit each, and see which returns to the shelf
      const landed = [];
      for (let i = 0; i < rec.controlNames.length && i < 14; i++) {
        const nm = rec.controlNames[i];
        const label = nm.a || nm.t;
        if (!label) continue;
        try {
          const loc = page.getByRole(nm.g === 'a' ? 'link' : 'button', { name: label, exact: true });
          if (!(await loc.count())) continue;
          await loc.first().click({ timeout: 4000 });
          await page.waitForTimeout(1800);
          const now = await R.sig(page);
          const onShelf = now.text.indexOf(AR['module.mushaf']) >= 0
            && now.text.indexOf(AR['module.fatwa']) >= 0;
          landed.push({ label: label, onShelf: onShelf, url: now.url.slice(0, 90) });
          if (onShelf) break;
          // put it back for the next candidate
          await R.toHome(page, AR);
          await openShelf(page, key, id);
          await page.waitForTimeout(1800);
        } catch (e) { /* a control that would not take a press is not a back route */ }
      }
      rec.tried = landed;
      rec.hasBackRoute = landed.some((x) => x.onShelf);
      rec.backRouteName = (landed.filter((x) => x.onShelf)[0] || {}).label || '';
      // and the browser's own back
      try {
        await R.toHome(page, AR);
        await openShelf(page, key, id);
        await page.waitForTimeout(1800);
        await page.goBack({ timeout: 8000 });
        await page.waitForTimeout(1800);
        const now = await R.sig(page);
        rec.browserBackToShelf = now.text.indexOf(AR['module.mushaf']) >= 0
          && now.text.indexOf(AR['module.fatwa']) >= 0;
      } catch (e) { rec.browserBackToShelf = false; }
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  back-' + id + ' commonBack=' + rec.commonBackCount + ' hasRoute=' + rec.hasBackRoute
      + ' browserBack=' + rec.browserBackToShelf);
  }

  // 3d. THE ADHKAR CHEST. Which title stands at the top of what the section opens on.
  {
    const { ctx, page, errs } = await session(browser, 'rows', null, VPS[0]);
    const rec = { family: 'one', id: 'adhkar-head' };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await openShelf(page, 'module.adhkar', 'adhkar');
      await page.waitForTimeout(2600);
      const s = await R.sig(page);
      rec.head = s.text.slice(0, 200);
      rec.sectionNameInHead = s.text.slice(0, 200).indexOf(AR['module.adhkar']) >= 0;
      rec.shot = await R.shot(page, SHOTS, LABEL + '-adhkar-head');
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  adhkar-head sectionNameInHead=' + rec.sectionNameInHead);
  }

  // 3e. A REFRESH IN THE MIDDLE OF A SECTION. Where does it land?
  for (const [key, id] of [['module.articles', 'articles'], ['module.adhkar', 'adhkar'],
    ['module.fatwa', 'fatwa'], ['module.lessons', 'lessons']]) {
    const { ctx, page, errs } = await session(browser, 'rows', null, VPS[0]);
    const rec = { family: 'one', id: 'refresh-' + id };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await openShelf(page, key, id);
      await page.waitForTimeout(2200);
      const before = await R.sig(page);
      rec.beforeHead = before.text.slice(0, 120);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
      await R.settle(page, 8000);
      await page.waitForTimeout(2600);
      const after = await R.sig(page);
      rec.afterHead = after.text.slice(0, 120);
      // the chat is named by its own composer placeholder; the section by its title
      rec.backInSection = after.text.indexOf(AR[key]) >= 0
        && after.text.indexOf(AR['module.mushaf']) < 0;
      rec.onShelf = after.text.indexOf(AR['module.mushaf']) >= 0 && after.text.indexOf(AR['module.fatwa']) >= 0;
      rec.shot = await R.shot(page, SHOTS, LABEL + '-refresh-' + id);
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  refresh-' + id + ' backInSection=' + rec.backInSection + ' onShelf=' + rec.onShelf);
  }

  // 3f. THE COMPLAINT DOOR. A reader with no account writes and presses send.
  {
    const { ctx, page, errs } = await session(browser, 'rows', null, VPS[0]);
    const rec = { family: 'one', id: 'feedback-signedout' };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      // open the side menu, then the complaint door
      const menu = page.getByRole('button', { name: AR['navigation.menu'], exact: true });
      rec.menuButtons = await menu.count();
      if (rec.menuButtons) { await menu.first().click(); await page.waitForTimeout(1400); }
      const fb = page.getByRole('button', { name: AR['menu.feedbackAria'] || AR['menu.feedback'], exact: true });
      rec.doorFound = await fb.count();
      if (!rec.doorFound) {
        const fb2 = page.getByRole('button', { name: AR['menu.feedback'], exact: true });
        rec.doorFound = await fb2.count();
        if (rec.doorFound) await fb2.first().click();
      } else { await fb.first().click(); }
      await page.waitForTimeout(1800);
      const ta = page.locator('textarea');
      rec.textareas = await ta.count();
      if (rec.textareas) {
        await ta.first().fill('RIG-FEEDBACK-TEXT-0123456789-0123456789-0123456789-0123456789-0123456789');
        await page.waitForTimeout(400);
      }
      const beforeSend = await R.sig(page);
      rec.beforeHead = beforeSend.text.slice(0, 120);
      rec.shot = await R.shot(page, SHOTS, LABEL + '-feedback-before');
      const send = page.getByRole('button', { name: AR['feedback.send'], exact: true });
      rec.sendButtons = await send.count();
      if (rec.sendButtons) { await send.first().click(); await page.waitForTimeout(2200); }
      const after = await R.sig(page);
      rec.afterHead = after.text.slice(0, 200);
      rec.keys = outcomeKeysIn(after.text);
      rec.screenChanged = beforeSend.text !== after.text;
      rec.stillOnFeedback = after.text.indexOf(AR['feedback.send']) >= 0;
      rec.live = after.live;
      rec.shot2 = await R.shot(page, SHOTS, LABEL + '-feedback-after');
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  feedback keys=' + JSON.stringify(rec.keys || []) + ' stillOnDoor=' + rec.stillOnFeedback);
  }
}

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  R.say('TREE', TREE);
  R.say('LABEL', LABEL, 'PORT', port);
  const browser = await R.chromium.launch(R.LAUNCH);
  const results = [];
  try {
    R.say('-- four outcomes --');
    await fourCases(browser, base, 'module.articles', 'articles', ['articles-list'], results);
    await fourCases(browser, base, 'module.women', 'women', ['articles-list'], results);
    await fourCases(browser, base, 'module.lessons', 'lessons', ['lessons-browse', 'lessons-search'], results);
    await fourCases(browser, base, 'module.fatwa', 'fatwa', ['fatwas-browse', 'scholars'], results);
    R.say('-- open latency --');
    for (const [k, id] of [['module.fatwa', 'fatwa'], ['module.lessons', 'lessons']]) {
      for (let i = 0; i < 3; i++) await openLatency(browser, base, k, id, 'rows', null, results, 1500);
    }
    R.say('-- one-offs --');
    await oneOffs(browser, base, results);
  } finally {
    await browser.close();
    srv.close();
  }
  const file = path.join(OUT, 'measure-' + LABEL + '.json');
  fs.writeFileSync(file, JSON.stringify({ tree: TREE, label: LABEL, at: new Date().toISOString(), results }, null, 2));
  R.say('WROTE', file, 'cases=' + results.length);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
