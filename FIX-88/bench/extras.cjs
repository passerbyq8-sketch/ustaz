'use strict';
// ---------------------------------------------------------------------------
// THE SECOND BENCH PASS -- everything the first pass could not answer, and the
// cases whose first answer turned out to be measured wrongly.
//
//   node extras.cjs <tree> <label> <outdir>
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const LABEL = process.argv[3] || 'run';
const OUT = path.resolve(process.argv[4] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-' + LABEL + '-x');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const shelfRow = (page, id) => page.locator('[data-ezik-home-module="' + id + '"]');
const NL = String.fromCharCode(10);

// The app's own waiting sentences, by key name, never typed here.
const WAIT = Object.keys(AR)
  .filter((k) => /(^|\.)(loading|browseLoading|searching|sending)$/i.test(k))
  .map((k) => String(AR[k] || '').trim()).filter(Boolean);

function outcomeKeysIn(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const hit = [];
  for (const k of Object.keys(AR)) {
    const v = String(AR[k] || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 4 && t.indexOf(v) >= 0) hit.push(k);
  }
  return hit;
}

async function session(browser, mode, only, delayMs) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'ar',
    serviceWorkers: 'block', deviceScaleFactor: 1,
  });
  const seen = [];
  if (delayMs) {
    await ctx.route('**/api/**', async (route) => {
      const nm = R.routeName(route.request().url());
      seen.push({ name: nm });
      await new Promise((r) => setTimeout(r, delayMs));
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(R.ROWS[nm] || { ok: true }) });
    });
  } else {
    await R.installRoutes(ctx, mode, only, seen);
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(String(m.text()).slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('PAGEERR ' + String(e && e.message).slice(0, 200)));
  return { ctx, page, seen, errs };
}

// -- 1. OPEN LATENCY ----------------------------------------------------------
// "The body arrived" is the moment a string ONLY THE FETCHED ROWS carry is on
// the screen -- not a character count (the fatwa screen's whole body is 96
// characters) and not "the screen changed", which the shell title satisfies at
// once. The waiting indicator is only counted after the screen has LEFT the home,
// because the home draws live regions of its own.
const MARK = { fatwa: 'RIG-FATWA', lessons: 'RIG-SCHOLAR', articles: 'RIG-ONE', women: 'RIG-ONE' };

async function latency(browser, base, id, delayMs, results) {
  const { ctx, page, errs } = await session(browser, 'rows', null, delayMs);
  const rec = { family: 'latency2', section: id, delayMs: delayMs };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    const home = await R.sig(page);
    const b = shelfRow(page, id);
    if (!(await b.count())) { rec.error = 'no-shelf-row'; }
    else {
      await b.first().click();
      const seen = await page.evaluate(async (a) => {
        const read = () => (document.body && document.body.innerText) || '';
        const t0 = performance.now();
        let leftHome = -1, body = -1, loader = -1, loaderText = '', framesBeforeLoader = 0;
        while (performance.now() - t0 < 30000) {
          const now = read();
          if (leftHome < 0 && now !== a.home) leftHome = Math.round(performance.now() - t0);
          if (leftHome >= 0) {
            const waiting = a.wait.some((w) => now.indexOf(w) >= 0);
            const live = document.querySelectorAll('[role="status"],[aria-busy="true"],[role="progressbar"]').length > 0;
            if (loader < 0 && (waiting || live)) {
              loader = Math.round(performance.now() - t0);
              loaderText = now.replace(/\s+/g, ' ').slice(0, 220);
            }
            if (loader < 0) framesBeforeLoader += 1;
            if (body < 0 && now.indexOf(a.mark) >= 0) body = Math.round(performance.now() - t0);
          }
          if (body >= 0) break;
          await new Promise((r) => requestAnimationFrame(r));
        }
        return { leftHome, body, loader, loaderText, framesBeforeLoader };
      }, { home: home.text, wait: WAIT, mark: MARK[id] });
      Object.assign(rec, seen);
      rec.stillScreen = seen.loader < 0;
      await page.waitForTimeout(500);
      rec.shot = await R.shot(page, SHOTS, LABEL + '-lat-' + id + '-' + delayMs);
    }
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  lat', id, 'delay=' + delayMs, 'leftHome=' + rec.leftHome, 'body=' + rec.body,
    'loader=' + rec.loader, 'still=' + rec.stillScreen);
}

// -- 2. A CUT CONNECTION, which is not a 503 ---------------------------------
async function abortCase(browser, base, id, routes, results) {
  const { ctx, page, errs } = await session(browser, 'abort', routes, 0);
  const rec = { family: 'abort', section: id };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    const b = shelfRow(page, id);
    if (!(await b.count())) { rec.error = 'no-shelf-row'; }
    else {
      await b.first().click();
      await R.settle(page, 8000);
      await page.waitForTimeout(2800);
      const s = await R.sig(page);
      rec.textLen = s.textLen;
      rec.text = s.text.slice(0, 400);
      rec.live = s.live;
      rec.keys = outcomeKeysIn(s.text);
      rec.spoke = rec.keys.some((k) => /\.(error|throttled|browseError)$/.test(k));
      rec.shot = await R.shot(page, SHOTS, LABEL + '-abort-' + id);
    }
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  abort', id, 'spoke=' + rec.spoke, 'keys=' + JSON.stringify(rec.keys || []), 'len=' + rec.textLen);
}

// -- 3. THE LESSONS SEARCH TAB, a second failing path in the same section -----
async function lessonsSearch(browser, base, mode, results) {
  const { ctx, page, errs } = await session(browser, mode, ['lessons-search'], 0);
  const rec = { family: 'lessons-search', mode: mode };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await shelfRow(page, 'lessons').first().click();
    await R.settle(page, 8000);
    await page.waitForTimeout(2000);
    // THE TABS CARRY role="tab", not the implicit button role, so a button query finds
    // nothing -- which reads exactly like a missing tab. Both roles are tried.
    let tab = page.getByRole('tab', { name: AR['lessons.tabSearch'], exact: true });
    if (!(await tab.count())) tab = page.getByRole('button', { name: AR['lessons.tabSearch'], exact: true });
    rec.tabFound = await tab.count();
    if (rec.tabFound) { await tab.first().click(); await page.waitForTimeout(1400); }
    const box = page.locator('input[type="text"], input:not([type]), input[type="search"]');
    rec.inputs = await box.count();
    if (rec.inputs) { await box.first().fill('RIGQUERY'); await page.waitForTimeout(300); }
    const go = page.getByRole('button', { name: AR['lessons.searchButton'], exact: true });
    rec.buttons = await go.count();
    if (rec.buttons) { await go.first().click(); await page.waitForTimeout(2800); }
    const s = await R.sig(page);
    rec.textLen = s.textLen;
    rec.live = s.live;
    rec.keys = outcomeKeysIn(s.text);
    rec.spoke = rec.keys.indexOf('lessons.error') >= 0 || rec.keys.indexOf('lessons.empty') >= 0;
    rec.shot = await R.shot(page, SHOTS, LABEL + '-lsearch-' + mode);
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  lessons-search', mode, 'spoke=' + rec.spoke, 'keys=' + JSON.stringify(rec.keys || []));
}

// -- 4. THE FATWA CARD'S SOURCE CONTROL, WITH THE CARD ACTUALLY OPEN ----------
// The browse list draws COLLAPSED rows; the card carrying the source control is
// rendered only inside an expanded one. Looking for it on the list finds nothing,
// which is not the same finding as "it does nothing".
async function fatwaSource(browser, base, results) {
  const { ctx, page, errs } = await session(browser, 'rows', null, 0);
  const rec = { family: 'one2', id: 'fatwa-source' };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await shelfRow(page, 'fatwa').first().click();
    await R.settle(page, 8000);
    await page.waitForTimeout(2400);
    const row = page.getByRole('button', { name: /RIG-FATWA/ });
    rec.rowFound = await row.count();
    if (rec.rowFound) { await row.first().click(); await page.waitForTimeout(1800); }
    const s = await R.sig(page);
    const hit = s.names.filter((n) => n.t === AR['fatwa.source'] || n.a === AR['fatwa.source']);
    rec.present = hit.length;
    rec.shape = hit[0] || null;
    if (hit.length) {
      const before = await R.sig(page);
      let newPage = null;
      const waitNew = ctx.waitForEvent('page', { timeout: 5000 }).then((x) => { newPage = x; }).catch(() => {});
      try {
        await page.getByRole('link', { name: AR['fatwa.source'], exact: true }).first().click({ timeout: 6000 });
      } catch (e) { rec.clickErr = String(e && e.message).split(NL)[0].slice(0, 140); }
      await waitNew;
      await page.waitForTimeout(1600);
      const after = await R.sig(page);
      rec.sameTabChanged = (before.textLen !== after.textLen) || (before.url !== after.url)
        || (before.controls !== after.controls);
      rec.newTabOpened = !!newPage;
      rec.newTabUrl = newPage ? String(newPage.url()).slice(0, 140) : '';
      if (newPage) { try { await newPage.close(); } catch (e) {} }
    }
    rec.shot = await R.shot(page, SHOTS, LABEL + '-fatwa-source-open');
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  fatwa.source present=' + rec.present + ' tag=' + JSON.stringify(rec.shape && rec.shape.g)
    + ' target=' + JSON.stringify(rec.shape && rec.shape.tg)
    + ' sameTabChanged=' + rec.sameTabChanged + ' newTab=' + rec.newTabOpened);
}

// -- 5. WHERE A REFRESH LANDS -------------------------------------------------
async function refreshCase(browser, base, id, results) {
  const { ctx, page, errs } = await session(browser, 'rows', null, 0);
  const rec = { family: 'refresh2', section: id };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await shelfRow(page, id).first().click();
    await R.settle(page, 8000);
    await page.waitForTimeout(2400);
    const before = await R.sig(page);
    rec.beforeHead = before.text.slice(0, 160);
    rec.beforeWhere = whereAmI(before.text, AR);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
    await R.settle(page, 8000);
    await page.waitForTimeout(3000);
    const after = await R.sig(page);
    rec.afterHead = after.text.slice(0, 160);
    rec.afterWhere = whereAmI(after.text, AR);
    // RESTORED means the very same section is on the screen again, judged by the
    // head of its own body rather than by a screen name -- a section is not a
    // screen name in this app, several of them are layers.
    rec.restored = after.text.slice(0, 60) === before.text.slice(0, 60);
    rec.shot = await R.shot(page, SHOTS, LABEL + '-refresh-' + id);
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  refresh', id, 'before=' + rec.beforeWhere, 'after=' + rec.afterWhere, 'restored=' + rec.restored);
}

// -- 6. THE MUSHAF'S BACK CONTROL, TOP LEVEL AND AFTER A PAGE WAS OPENED ------
async function mushafBack(browser, base, results) {
  const { ctx, page, errs } = await session(browser, 'rows', null, 0);
  const rec = { family: 'one2', id: 'mushaf-back' };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await shelfRow(page, 'mushaf').first().click();
    await R.settle(page, 8000);
    await page.waitForTimeout(2800);
    const top = await R.sig(page);
    const isBack = (x) => x.a === AR['common.back'] || x.t === AR['common.back'];
    rec.topBackCount = top.names.filter(isBack).length;
    rec.topHead = top.text.slice(0, 120);
    const rows = top.names.filter((x) => x.g === 'button' && (x.t || '').length > 1 && !isBack(x));
    rec.rowsAvailable = rows.length;
    if (rows.length) {
      try {
        await page.getByRole('button', { name: rows[0].t, exact: true }).first().click({ timeout: 6000 });
        await page.waitForTimeout(2600);
      } catch (e) { rec.openErr = String(e && e.message).split(NL)[0].slice(0, 120); }
    }
    const inside = await R.sig(page);
    rec.insideBackCount = inside.names.filter(isBack).length;
    rec.insideHead = inside.text.slice(0, 120);
    await R.toHome(page, AR);
    await shelfRow(page, 'mushaf').first().click();
    await R.settle(page, 8000);
    await page.waitForTimeout(2800);
    const again = await R.sig(page);
    rec.reenterBackCount = again.names.filter(isBack).length;
    rec.reenterHead = again.text.slice(0, 120);
    rec.shot = await R.shot(page, SHOTS, LABEL + '-mushaf-reenter');
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  mushaf-back top=' + rec.topBackCount + ' inside=' + rec.insideBackCount
    + ' reenter=' + rec.reenterBackCount);
}

// -- 7. THE OVERLAPPING PAIRS IN THE TREASURE, BY NAME AND BY BOX -------------
async function treasureOverlap(browser, base, results) {
  const { ctx, page, errs } = await session(browser, 'rows', null, 0);
  const rec = { family: 'one2', id: 'treasure-overlap' };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await shelfRow(page, 'treasure').first().click();
    await R.settle(page, 9000);
    await page.waitForTimeout(3200);
    rec.url = page.url();
    rec.pairs = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const els = Array.from(document.querySelectorAll('button,[role="button"],a[href],input,select,textarea,summary')).filter(vis);
      const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const name = (el) => ((el.getAttribute('aria-label') || el.innerText || el.value || '').trim().slice(0, 40));
      const out = [];
      for (let i = 0; i < els.length && i < 80; i++) {
        for (let j = i + 1; j < els.length && j < 80; j++) {
          const a = els[i], b = els[j];
          if (a.contains(b) || b.contains(a)) continue;
          const A = box(a), B = box(b);
          const ox = Math.min(A[2], B[2]) - Math.max(A[0], B[0]);
          const oy = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
          if (ox > 6 && oy > 6) {
            // WHICH ONE THE FINGER ACTUALLY HITS, in the middle of the overlap.
            const cx = (Math.max(A[0], B[0]) + Math.min(A[2], B[2])) / 2;
            const cy = (Math.max(A[1], B[1]) + Math.min(A[3], B[3])) / 2;
            const at = document.elementFromPoint(cx, cy);
            out.push({
              a: name(a), b: name(b), aBox: A.map(Math.round), bBox: B.map(Math.round),
              overlap: [Math.round(ox), Math.round(oy)],
              hitIsA: at === a || a.contains(at), hitIsB: at === b || b.contains(at),
              hitName: at ? name(at) : '',
              // does either one lose ALL of itself under the other?
              aBuried: ox >= (A[2] - A[0]) - 2 && oy >= (A[3] - A[1]) - 2,
              bBuried: ox >= (B[2] - B[0]) - 2 && oy >= (B[3] - B[1]) - 2,
            });
          }
        }
      }
      return out;
    });
    rec.count = rec.pairs.length;
    rec.anyBuried = rec.pairs.some((p) => p.aBuried || p.bBuried);
    rec.anyUnreachable = rec.pairs.some((p) => !p.hitIsA && !p.hitIsB);
    rec.shot = await R.shot(page, SHOTS, LABEL + '-treasure-overlap');
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  treasure-overlap pairs=' + rec.count + ' buried=' + rec.anyBuried
    + ' unreachable=' + rec.anyUnreachable);
}

// -- 8. THE COMPLAINT DOOR, EVERY ANSWER THE SERVER CAN GIVE ------------------
async function feedbackCase(browser, base, mode, results) {
  const { ctx, page, errs } = await session(browser, mode, ['feedback'], 0);
  const rec = { family: 'feedback', mode: mode };
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    const menu = page.getByRole('button', { name: AR['navigation.menu'], exact: true });
    if (await menu.count()) { await menu.first().click(); await page.waitForTimeout(1500); }
    for (const nm of [AR['menu.feedbackAria'], AR['menu.feedback']]) {
      if (!nm) continue;
      const d = page.getByRole('button', { name: nm, exact: true });
      if (await d.count()) { await d.first().click(); break; }
    }
    await page.waitForTimeout(1900);
    const ta = page.locator('textarea');
    rec.textareas = await ta.count();
    if (rec.textareas) await ta.first().fill('RIG-FEEDBACK-0123456789-0123456789-0123456789-0123456789-0123456789-0123');
    await page.waitForTimeout(400);
    const before = await R.sig(page);
    rec.beforeHead = before.text.slice(0, 120);
    const send = page.getByRole('button', { name: AR['feedback.send'], exact: true });
    rec.sendButtons = await send.count();
    if (rec.sendButtons) { await send.first().click(); await page.waitForTimeout(2600); }
    const after = await R.sig(page);
    rec.afterHead = after.text.slice(0, 240);
    rec.live = after.live;
    const six = ['feedback.thanks', 'feedback.signInRequired', 'feedback.capped',
      'feedback.failed', 'feedback.empty', 'feedback.noChat'];
    rec.outcomeLines = six.filter((k) => AR[k] && after.text.indexOf(AR[k]) >= 0);
    rec.signInGoShown = !!(AR['feedback.signInGo'] && after.text.indexOf(AR['feedback.signInGo']) >= 0);
    rec.stillOnDoor = !!(AR['feedback.typeLabel'] && after.text.indexOf(AR['feedback.typeLabel']) >= 0);
    rec.screenChanged = before.text !== after.text;
    rec.shot = await R.shot(page, SHOTS, LABEL + '-feedback-' + mode);
    rec.consoleErrors = errs.slice(0, 4);
  } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
  await ctx.close();
  results.push(rec);
  R.say('  feedback', mode, 'lines=' + JSON.stringify(rec.outcomeLines || []),
    'stillOnDoor=' + rec.stillOnDoor, 'signInGo=' + rec.signInGoShown);
}

// -- 9. THE GREETING AND THE ADHKAR CHEST -------------------------------------
async function greetingAndAdhkar(browser, base, results) {
  {
    const { ctx, page } = await session(browser, 'rows', null, 0);
    const rec = { family: 'one2', id: 'greeting' };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const g = await page.evaluate((a) => {
        const t = (document.body && document.body.innerText) || '';
        const at = t.indexOf(a.hello);
        if (at < 0) return { found: false, line: '', tail: '' };
        const nl = t.indexOf(a.nl, at);
        const line = t.slice(at, nl < 0 ? t.length : nl);
        return { found: true, line: line, tail: line.slice(a.hello.length).trim() };
      }, { hello: AR['home.hello'], nl: NL });
      Object.assign(rec, g);
      rec.tailEmpty = g.found && g.tail.length === 0;
      // WAS THE VOCATIVE REPLACED? measured by the presence of the whole-greeting
      // key, which does not exist until the repair adds it.
      rec.plainGreetingShown = !!(AR['home.helloNoName']
        && ((await R.sig(page)).text.indexOf(AR['home.helloNoName']) >= 0));
      rec.shot = await R.shot(page, SHOTS, LABEL + '-greeting');
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  greeting found=' + rec.found + ' tailEmpty=' + rec.tailEmpty
      + ' plainShown=' + rec.plainGreetingShown + ' line=' + JSON.stringify(rec.line));
  }
  {
    const { ctx, page } = await session(browser, 'rows', null, 0);
    const rec = { family: 'one2', id: 'adhkar-head' };
    try {
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await shelfRow(page, 'adhkar').first().click();
      await R.settle(page, 8000);
      await page.waitForTimeout(3000);
      const s = await R.sig(page);
      rec.head = s.text.slice(0, 240);
      rec.sectionNameInHead = s.text.slice(0, 240).indexOf(AR['module.adhkar']) >= 0;
      rec.shot = await R.shot(page, SHOTS, LABEL + '-adhkar-head');
    } catch (e) { rec.error = String(e && e.message).slice(0, 200); }
    await ctx.close(); results.push(rec);
    R.say('  adhkar-head nameInHead=' + rec.sectionNameInHead
      + ' head=' + JSON.stringify((rec.head || '').slice(0, 46)));
  }
}

(async () => {
  const only = (process.argv[5] || '').split(',').filter(Boolean);
  const want = (n) => !only.length || only.indexOf(n) >= 0;
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  R.say('TREE', TREE, 'LABEL', LABEL, 'PORT', port);
  const browser = await R.chromium.launch(R.LAUNCH);
  const results = [];
  try {
    if (want('latency')) {
      R.say('-- open latency: a server 1500ms slow, three readings --');
      for (const id of ['fatwa', 'lessons']) {
        for (let i = 0; i < 3; i++) await latency(browser, base, id, 1500, results);
      }
      R.say('-- open latency: a server as fast as it can be (the client cost alone) --');
      for (const id of ['fatwa', 'lessons']) {
        for (let i = 0; i < 3; i++) await latency(browser, base, id, 1, results);
      }
    }
    if (want('abort')) {
      R.say('-- a cut connection --');
      for (const [id, routes] of [['articles', ['articles-list']], ['women', ['articles-list']],
        ['lessons', ['lessons-browse', 'lessons-search']], ['fatwa', ['fatwas-browse', 'scholars']]]) {
        await abortCase(browser, base, id, routes, results);
      }
    }
    if (want('lsearch')) {
      R.say('-- the lessons search tab --');
      for (const m of ['429', '503', 'abort', 'empty']) await lessonsSearch(browser, base, m, results);
    }
    if (want('fatwasource')) { R.say('-- the fatwa source control --'); await fatwaSource(browser, base, results); }
    if (want('refresh')) {
      R.say('-- a refresh in the middle of a section --');
      for (const id of ['articles', 'adhkar', 'fatwa', 'lessons', 'mushaf', 'women']) {
        await refreshCase(browser, base, id, results);
      }
    }
    if (want('mushafback')) { R.say('-- the mushaf back control --'); await mushafBack(browser, base, results); }
    if (want('treasure')) { R.say('-- the treasure overlaps --'); await treasureOverlap(browser, base, results); }
    if (want('feedback')) {
      R.say('-- the complaint door --');
      for (const m of ['rows', '429', '503', 'abort']) await feedbackCase(browser, base, m, results);
    }
    if (want('greeting')) { R.say('-- the greeting and the adhkar chest --'); await greetingAndAdhkar(browser, base, results); }
  } finally {
    await browser.close();
    srv.close();
  }
  const file = path.join(OUT, 'extras-' + LABEL + '.json');
  fs.writeFileSync(file, JSON.stringify({ tree: TREE, label: LABEL, at: new Date().toISOString(), results }, null, 2));
  R.say('WROTE', file, 'cases=' + results.length);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
