# مِنصّةُ القياسِ — مصدرُها كاملًا

> **لماذا هي وثيقةٌ لا ملفّاتٍ قابلةً للتشغيلِ في مكانِها.** `recon-audit.cjs` يمنعُ تعقُّبَ أيِّ ملفٍّ
> يطابقُ `^fix-.*.cjs$` — ومجلَّدُ أوراقِنا اسمُه `FIX-88`، فكلُّ `.cjs` تحتَه يقعُ في المنع.
> والعقدُ أنّ `recon` يخرجُ بـ`FAIL=0`، فلا يُضعَفُ حارسٌ من أجلِ راحةِ التسليم.
> فالمصدرُ هنا بنصِّه: انسخْ كلَّ كتلةٍ إلى ملفٍّ باسمِها **خارجَ هذا المجلَّد** وشغّلْها كما هي.

**وكيفَ تُعادُ القياسات:**

```
node measure.cjs   <tree> <label> <outdir>              # الحالاتُ الأربعُ لكلِّ قسم
node extras.cjs    <tree> <label> <outdir> <cases>      # الانقطاع، البحث، الزرّ، التحديث…
node batchb.cjs    <tree> <label> <outdir> [b1,b2,b3]   # بنودُ الدفعةِ الثانية
node live2.cjs     https://ezik.app/ live <outdir>      # زمنُ الانتظارِ على الحيّ
node shelf.cjs     <tree> <outdir>                      # مقاساتُ مداخلِ الرفّ
```

و`rig.cjs` هو الأساس: الخادمُ الساكن، واعتراضُ `/api`، وقراءةُ العربيِّ من `app.jsx` للشجرةِ المقيسة.
---

## `b1.cjs`

```js
'use strict';
// BATCH B, ITEM 1 -- the mushaf trap that the item-14 repair opened.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE ONE-SHOT MARK: which section THIS BOOT restored ------------------
one(
`function ezikResumeScreen() {
  const id = ezikReadResume();
  if (!id) return 'chat';
  if (EZIK_RESUME_SCREENS[id]) return EZIK_RESUME_SCREENS[id];
  return 'home';   // a layer: whoever owns it opens it on its own first render
}`,
`function ezikResumeScreen() {
  const id = ezikReadResume();
  if (!id) return 'chat';
  if (EZIK_RESUME_SCREENS[id]) return EZIK_RESUME_SCREENS[id];
  return 'home';   // a layer: whoever owns it opens it on its own first render
}

// ============================================================
// BATCH B, ITEM 1 -- WHICH SECTION *THIS BOOT* RESTORED, AND IT IS SPENT ONCE
// ============================================================
// WHAT THIS EXISTS FOR, AND IT IS A TRAP THE ITEM-14 REPAIR OPENED ITSELF. That repair
// made a reload come back to the section the reader was standing in. In المصحف that
// means the READING PAGE, because item 87 re-opens the page the reader left -- and the
// reading page carries exactly two controls, «ضع العلامة» and «السور», neither of them
// a way to the shelf. MEASURED on the bench, both sizes: the reload lands on the very
// page («النساء · صفحة ١٠٢», head for head), and the shelf then costs TWO presses --
// «السور» to the index, «رجوع» to the shelf. Before the repair the reader was thrown to
// the chat, which was wrong differently; a reader must not be given a screen he needs
// two presses and a guess to leave.
//
// THE LIGHTER OF THE TWO REMEDIES, AND WHY THIS ONE. The alternative is to add an exit
// to the reading page -- a control on a surface the owner deliberately left with two,
// visible to every reader on every visit, to solve a case that only arises after a
// reload. This one changes nothing a reader sees when he walks into المصحف from the
// shelf: item 87 still opens him where he left off, byte for byte. It changes only
// where a RELOAD lands him -- the index instead of the page -- and the index carries
// «رجوع», so the shelf is one press away. His place is not lost either: the index draws
// the resume row at its top, which is the row item 87 kept for exactly this.
//
// AND IT IS SPENT ONCE, BY THE SECTION IT NAMES. A bare "this boot was a resume" flag
// would be consumed by whichever section mounted first and could then suppress the
// mushaf's ordinary auto-open later in the same run. This holds the id, hands it to
// that one section, and clears itself in the same breath.
let EZIK_RESUME_ENTERED = '';
function ezikResumeMarkEntered(id) { EZIK_RESUME_ENTERED = ezikResumeKnown(id) ? String(id) : ''; }
function ezikResumeTakeEntered(id) {
  if (!id || EZIK_RESUME_ENTERED !== id) return false;
  EZIK_RESUME_ENTERED = '';
  return true;
}`,
  'mark');

// -- 2. THE BOOT SETS IT ------------------------------------------------------
one(
  "        setScreen(ezikResumeScreen());   // D85: a returning profile also lands on the chat",
  "        // BATCH B, ITEM 1: the boot names the section it is restoring, so that section --\n"
  + "        // and only it -- can tell a reload apart from an ordinary walk-in.\n"
  + "        ezikResumeMarkEntered(ezikReadResume());\n"
  + "        setScreen(ezikResumeScreen());   // D85: a returning profile also lands on the chat",
  'boot');

// -- 3. AND THE MUSHAF READS IT ONCE -----------------------------------------
one(
`  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (autoResumedRef.current) return;
    autoResumedRef.current = true;
    const lp = readMushafLastPage();
    if (!lp) return;
    setOpenAt(lp);
    setSelected(lp.s);
  }, []);`,
`  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (autoResumedRef.current) return;
    autoResumedRef.current = true;
    // BATCH B, ITEM 1 -- A RELOAD LANDS ON THE INDEX, A WALK-IN STILL LANDS ON THE PAGE.
    // The reading page has no way to the shelf (two controls, «ضع العلامة» and «السور»,
    // and «السور» only reaches the index), so a reader returned to it by a RELOAD is two
    // presses from the shelf with nothing on the screen saying so. Entering المصحف from
    // the shelf is a choice and keeps item 87's promise untouched; being put back by a
    // reload is not, so that one case stops on the index -- which carries «رجوع» -- with
    // the resume row item 87 kept sitting at the top of it.
    if (ezikResumeTakeEntered('mushaf')) return;
    const lp = readMushafLastPage();
    if (!lp) return;
    setOpenAt(lp);
    setSelected(lp.s);
  }, []);`,
  'mushaf');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `batchb.cjs`

```js
'use strict';
// ---------------------------------------------------------------------------
// THE SECOND BATCH'S BENCH. Three items, measured the same way the first batch
// was: the repaired tree served locally, /api intercepted, one fresh context per
// case, and every Arabic string read out of the tree's own app.jsx.
//
//   node batchb.cjs <tree> <label> <outdir> [cases]
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const LABEL = process.argv[3] || 'run';
const OUT = path.resolve(process.argv[4] || path.join(__dirname, 'out'));
const ONLY = (process.argv[5] || '').split(',').filter(Boolean);
const SHOTS = path.join(OUT, 'shots-b-' + LABEL);
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const FILE = path.join(OUT, 'batchb-' + LABEL + '.json');
const out = { at: new Date().toISOString(), tree: TREE, label: LABEL, cases: [] };
const save = () => fs.writeFileSync(FILE, JSON.stringify(out, null, 2));
const want = (n) => !ONLY.length || ONLY.indexOf(n) >= 0;

// THE SHELF, named by a marker the chat cannot fake: the chat draws every module's
// name AND its subtitle on its suggestion cards, so the subtitles are the tell.
const onShelf = (t) => t.indexOf(AR['module.fatwa']) >= 0 && t.indexOf(AR['module.lessons']) >= 0
  && t.indexOf(AR['module.mushaf']) >= 0 && t.indexOf(AR['module.fatwa.sub']) < 0;

async function ctxOf(browser, seedChats) {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'ar',
    serviceWorkers: 'block', deviceScaleFactor: 1,
  });
  await R.installRoutes(c, 'rows', null, []);
  if (seedChats) {
    // SEEDED IN THE APPLICATION'S OWN SHAPE, read out of app.jsx rather than guessed:
    // the index key, the per-thread prefix, and the fields each row and body carries.
    await c.addInitScript(seedChats);
  }
  return c;
}

// ---- ITEM 1: the mushaf trap ----------------------------------------------
async function mushafTrap(browser, base) {
  const rec = { item: 1, id: 'mushaf-refresh-trap' };
  const ctx = await ctxOf(browser);
  const page = await ctx.newPage();
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await page.locator('[data-ezik-home-module="mushaf"]').first().click();
    await R.settle(page, 9000); await page.waitForTimeout(2600);
    // open a page, so the reader is "in the middle of the section"
    const rows = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      return Array.from(document.querySelectorAll('button')).filter(vis)
        .map((el, i) => ({ i, t: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) }));
    });
    const juz = rows.filter((r) => /الجزء/.test(r.t))[2];
    rec.opened = juz ? juz.t : null;
    if (juz) { await page.locator('button').nth(juz.i).click({ timeout: 8000 }); await R.settle(page, 9000); await page.waitForTimeout(2600); }
    const before = await R.sig(page);
    rec.beforeHead = before.text.slice(0, 70);
    rec.beforeIsReadingPage = !/الانتقال إلى جزء/.test(before.text);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
    await R.settle(page, 9000); await page.waitForTimeout(3200);
    const after = await R.sig(page);
    rec.afterHead = after.text.slice(0, 70);
    rec.afterWhere = whereAmI(after.text, AR);
    rec.landedOnChat = rec.afterWhere === 'chat';
    rec.afterIsIndex = /الانتقال إلى جزء/.test(after.text);
    rec.afterIsReadingPage = !rec.afterIsIndex && !rec.landedOnChat;
    rec.stillInMushaf = rec.afterIsIndex || rec.afterIsReadingPage;
    rec.shot = await R.shot(page, SHOTS, LABEL + '-b1-after-reload');
    // COUNT THE PRESSES TO THE SHELF from wherever the reload put him.
    let presses = 0, reached = false; rec.route = [];
    for (let step = 0; step < 4 && !reached; step++) {
      const b = page.getByRole('button', { name: AR['common.back'] });
      let label = null;
      if (await b.count()) { label = AR['common.back']; await b.first().click({ timeout: 5000 }); }
      else {
        const cs = await page.evaluate(() => {
          const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
          return Array.from(document.querySelectorAll('button')).filter(vis)
            .map((el, i) => ({ i, t: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24) }));
        });
        const up = cs.filter((c) => c.t && c.t.length <= 12)[0];
        if (!up) break;
        label = up.t; await page.locator('button').nth(up.i).click({ timeout: 5000 });
      }
      presses += 1; rec.route.push(label);
      await page.waitForTimeout(2000);
      if (onShelf((await R.sig(page)).text)) reached = true;
    }
    rec.pressesToShelf = reached ? presses : -1;
  } catch (e) { rec.error = String(e && e.message).slice(0, 180); }
  await ctx.close(); out.cases.push(rec); save();
  R.say(' B1 mushaf: afterIsIndex=' + rec.afterIsIndex + ' isReadingPage=' + rec.afterIsReadingPage
    + ' chat=' + rec.landedOnChat + ' pressesToShelf=' + rec.pressesToShelf
    + ' route=' + JSON.stringify((rec.route || []).length));
}

// ---- ITEM 2: the adhkar must open on the whole index -----------------------
async function adhkarDoor(browser, base) {
  const rec = { item: 2, id: 'adhkar-front-door' };
  const ctx = await ctxOf(browser);
  const page = await ctx.newPage();
  try {
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await page.locator('[data-ezik-home-module="adhkar"]').first().click();
    await R.settle(page, 9000); await page.waitForTimeout(3000);
    const s = await R.sig(page);
    rec.head = s.text.slice(0, 160);
    rec.textLen = s.textLen;
    rec.controls = s.controls;
    // THE INDEX IS THE SCREEN THAT LISTS MANY GROUPS. A group's reader shows ONE
    // group's counter («٠ من ٢١») and its first dhikr; the index shows a row per
    // group. So the two are told apart by how many group rows are on the screen,
    // read from the store's own category titles rather than guessed at.
    rec.groupRowsVisible = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      return Array.from(document.querySelectorAll('button')).filter(vis)
        .filter((el) => /\d|٠|١|٢|٣|٤|٥|٦|٧|٨|٩/.test(el.innerText || '')).length;
    });
    rec.looksLikeReader = /\d+\s*\/\s*\d+|٠ من|١ \/ /.test(s.text.slice(0, 120));
    rec.openedOnAGroup = rec.looksLikeReader;
    rec.shot = await R.shot(page, SHOTS, LABEL + '-b2-adhkar-door');
  } catch (e) { rec.error = String(e && e.message).slice(0, 180); }
  await ctx.close(); out.cases.push(rec); save();
  R.say(' B2 adhkar: openedOnAGroup=' + rec.openedOnAGroup + ' controls=' + rec.controls
    + ' head=' + JSON.stringify((rec.head || '').slice(0, 40)));
}

// ---- ITEM 3: an old conversation, opened from the home ---------------------
async function oldChat(browser, base, from, keys) {
  const rec = { item: 3, id: 'old-chat-from-' + from };
  const ctx = await ctxOf(browser);
  const page = await ctx.newPage();
  try {
    // THE SEED IS PLANTED AFTER THE PROFILE EXISTS, NOT BEFORE IT. ezikListChats
    // filters the index by the profile key, and that key is the profile's own pid --
    // which does not exist until the first run has minted it. Seeding before the boot
    // would write rows under a pk nobody has, the drawer would draw none of them, and
    // the measurement would be of an empty list rather than of the defect.
    await R.enter(page, AR, D.lit, base);
    rec.pk = await page.evaluate((a) => {
      let pk = 'anon';
      try {
        const p = JSON.parse(localStorage.getItem('child_profile') || 'null');
        if (p && typeof p.pid === 'string' && p.pid) pk = p.pid;
      } catch (e) {}
      const now = Date.now();
      const rows = [
        { id: 'seed_a', pk: pk, title: 'BENCH-CHAT-ALPHA', pinned: false, at: now - 90000 },
        { id: 'seed_b', pk: pk, title: 'BENCH-CHAT-BETA', pinned: false, at: now - 40000 },
      ];
      localStorage.setItem(a.idxKey, JSON.stringify(rows));
      localStorage.setItem(a.prefix + 'seed_a', JSON.stringify(
        [{ role: 'user', content: 'BENCH-Q-ALPHA' }, { role: 'assistant', content: 'BENCH-A-ALPHA' }]));
      localStorage.setItem(a.prefix + 'seed_b', JSON.stringify(
        [{ role: 'user', content: 'BENCH-Q-BETA' }, { role: 'assistant', content: 'BENCH-A-BETA' }]));
      return pk;
    }, keys);
    // and a reload, so the app reads the index it has just been given
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
    await R.settle(page, 9000); await page.waitForTimeout(2600);
    if (from === 'home') await R.toHome(page, AR);
    const start = await R.sig(page);
    rec.startWhere = whereAmI(start.text, AR);
    // open the side menu -- it carries two names, and both are tried
    let opened = false;
    for (const k of ['navigation.openMenu', 'navigation.menu']) {
      const m = page.getByRole('button', { name: AR[k], exact: true });
      if (await m.count()) { await m.first().click(); opened = true; break; }
    }
    rec.menuOpened = opened;
    await page.waitForTimeout(1600);
    const drawer = await R.sig(page);
    rec.rowSeen = drawer.text.indexOf('BENCH-CHAT-ALPHA') >= 0;
    rec.shot = await R.shot(page, SHOTS, LABEL + '-b3-' + from + '-drawer');
    if (rec.rowSeen) {
      await page.getByRole('button', { name: /BENCH-CHAT-ALPHA/ }).first().click({ timeout: 6000 });
      await page.waitForTimeout(2600);
    }
    const after = await R.sig(page);
    rec.afterWhere = whereAmI(after.text, AR);
    rec.afterHead = after.text.slice(0, 110);
    // THE ONLY PROOF THAT MATTERS: is the conversation's own body on the screen?
    rec.bodyOnScreen = after.text.indexOf('BENCH-A-ALPHA') >= 0;
    rec.stillOnShelf = onShelf(after.text);
    rec.shot2 = await R.shot(page, SHOTS, LABEL + '-b3-' + from + '-after');
  } catch (e) { rec.error = String(e && e.message).slice(0, 180); }
  await ctx.close(); out.cases.push(rec); save();
  R.say(' B3 from=' + from + ' rowSeen=' + rec.rowSeen + ' bodyOnScreen=' + rec.bodyOnScreen
    + ' where=' + rec.afterWhere + ' stillOnShelf=' + rec.stillOnShelf);
}

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  R.say('TREE', TREE, 'LABEL', LABEL, 'PORT', port);
  // the store's own names, read out of the tree under test
  const src = fs.readFileSync(path.join(TREE, 'app.jsx'), 'utf8');
  const idxKey = (/const EZIK_CHATS_KEY = '([^']+)'/.exec(src) || [])[1];
  const prefix = (/const EZIK_CHAT_PREFIX = '([^']+)'/.exec(src) || [])[1];
  out.storeKeys = { idxKey, prefix };
  R.say('store keys:', idxKey, prefix);

  const browser = await R.chromium.launch(R.LAUNCH);
  try {
    if (want('b1')) await mushafTrap(browser, base);
    if (want('b2')) await adhkarDoor(browser, base);
    if (want('b3')) { await oldChat(browser, base, 'home', { idxKey, prefix }); await oldChat(browser, base, 'chat', { idxKey, prefix }); }
  } finally { await browser.close(); srv.close(); save(); }
  R.say('WROTE', FILE);
})();
```

## `dict.cjs`

```js
'use strict';
// The Arabic dictionary read out of ONE tree's app.jsx. No Arabic is typed in the rig.
const fs = require('fs');

function dictOf(appjsxPath) {
  const src = fs.readFileSync(appjsxPath, 'utf8');
  const at = src.indexOf('const EZ_I18N = {');
  if (at < 0) throw new Error('EZ_I18N not found');
  const open = src.indexOf('{', at);
  let depth = 0, i = open, inS = null, esc = false;
  const BS = String.fromCharCode(92);
  for (; i < src.length; i++) {
    const c = src[i];
    if (inS) {
      if (esc) { esc = false; continue; }
      if (c === BS) { esc = true; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; }
  }
  // eslint-disable-next-line no-eval
  const obj = eval('(' + src.slice(open, i + 1) + ')');
  const lit = {};
  const re = /const\s+(EZ_AIC_AGREE|EZ_AIC_DECLINE)\s*=\s*(['"])([\s\S]*?)\2/g;
  let m;
  while ((m = re.exec(src))) lit[m[1]] = m[3];
  return { ar: obj.ar, en: obj.en, lit: lit };
}

// Reverse lookup: which dictionary keys appear inside a run of live text.
function keysIn(ar, text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const out = [];
  for (const k of Object.keys(ar)) {
    const v = String(ar[k] || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 4 && t.indexOf(v) >= 0) out.push(k);
  }
  return out;
}

module.exports = { dictOf, keysIn };
```

## `extras.cjs`

```js
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
```

## `fix1.cjs`

```js
'use strict';
// DEFECT 5 + 6 -- the two sections that told the reader the network had died
// while it was up. Splice by ASCII anchors; the Arabic is written here as the
// only place it is typed, and the file is written back as UTF-8 with LF.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE TWO NEW LINES IN THE DICTIONARY, on the shape of their sisters ----
one(
  "    'articles.error': 'تعذَّر جلبُ ما في هذا القسم. تحقَّقْ من الاتصال ثمّ أعِدِ المحاولة.',\n",
  "    'articles.error': 'تعذَّر جلبُ ما في هذا القسم. تحقَّقْ من الاتصال ثمّ أعِدِ المحاولة.',\n"
  + "    'articles.throttled': 'تجاوزتَ حدَّ الطلبات. انتظرْ قليلاً ثمّ أعِدِ المحاولة.',\n",
  'ar-articles.error');

one(
  "    'articles.error': 'This section could not be loaded. Check the connection, then try again.',\n",
  "    'articles.error': 'This section could not be loaded. Check the connection, then try again.',\n"
  + "    'articles.throttled': 'Too many requests just now. Wait a moment, then try again.',\n",
  'en-articles.error');

// -- 2. THE FOURTH STATE ------------------------------------------------------
one(
  "const EZIK_ART_FAILED = 'failed';\n",
  "const EZIK_ART_FAILED = 'failed';\n"
  + "// DEFECT 5 + 6 (item 88) -- A FIFTH WORD, BECAUSE THERE ARE FIVE OUTCOMES AND NOT FOUR.\n"
  + "// MEASURED, on a bench that forces each answer in turn: /api/articles-list replied 429 to\n"
  + "// 48 of this round's requests, and every one of them reached the reader as «تعذَّر جلبُ ما في\n"
  + "// هذا القسم. تحقَّقْ من الاتصال» -- a sentence about his connection, printed while his\n"
  + "// connection was up. He then checked a network that was never the matter and pressed a\n"
  + "// retry that could only earn him another 429.\n"
  + "//\n"
  + "// A THROTTLE IS NOT AN OUTAGE AND IS NOT AN EMPTY SHELF. It is the server saying «not so\n"
  + "// fast», it passes on its own, and the only useful thing a reader can do about it is wait --\n"
  + "// which is a different instruction from «check your connection» and needs its own sentence.\n"
  + "// So the status code is carried out of the fetch instead of being flattened at the door,\n"
  + "// and no code is dressed as another one anywhere below.\n"
  + "const EZIK_ART_THROTTLED = 'throttled';\n",
  'state-const');

// -- 3. THE FETCH KEEPS THE REASON -------------------------------------------
one(
`async function ezikArticlesFetchList(section, signal) {
  try {
    const url = EZIK_ART_LIST_ROUTE + '?section=' + encodeURIComponent(section)
      + '&limit=' + EZIK_ART_LIMIT;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    if (response.status !== 200) return { ok: false, rows: [] };
    const payload = await response.json();
    if (!payload || payload.ok !== true) return { ok: false, rows: [] };
    return { ok: true, rows: ezikArticleRows(payload.items) };
  } catch (e) {
    return { ok: false, rows: [] };
  }
}`,
`async function ezikArticlesFetchList(section, signal) {
  try {
    const url = EZIK_ART_LIST_ROUTE + '?section=' + encodeURIComponent(section)
      + '&limit=' + EZIK_ART_LIMIT;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    // DEFECT 5 + 6 (item 88): 429 IS CARRIED OUT UNDER ITS OWN NAME. It is the one status this
    // screen can say something USEFUL about that the outage line does not say, so it is the one
    // that is separated. Every other status, an unreadable body, a cut connection and the
    // timeout stay one bucket, because a reader has one thing to do about all of them.
    if (response.status === 429) return { ok: false, why: 'throttled', rows: [] };
    if (response.status !== 200) return { ok: false, why: 'failed', rows: [] };
    const payload = await response.json();
    if (!payload || payload.ok !== true) return { ok: false, why: 'failed', rows: [] };
    return { ok: true, why: '', rows: ezikArticleRows(payload.items) };
  } catch (e) {
    return { ok: false, why: 'failed', rows: [] };
  }
}`,
  'fetch-list');

// -- 4. THE SCREEN READS IT ---------------------------------------------------
one(
  "      if (!outcome.ok) { setRows([]); setState(EZIK_ART_FAILED); return; }",
  "      // DEFECT 5 + 6 (item 88): the reason chooses the sentence, and nothing else does.\n"
  + "      if (!outcome.ok) {\n"
  + "        setRows([]);\n"
  + "        setState(outcome.why === 'throttled' ? EZIK_ART_THROTTLED : EZIK_ART_FAILED);\n"
  + "        return;\n"
  + "      }",
  'load-branch');

// -- 5. AND SAYS IT -----------------------------------------------------------
one(
`      {/* STATE 4 of 4: the section has published writing in it. Newest first -- and that order is
          the STORE'S, read off a sorted index, never re-sorted here. */}`,
`      {/* DEFECT 5 + 6 (item 88) -- THE THROTTLE, IN ITS OWN WORDS. Not the outage line, which
          sends the reader to look at a connection that is working, and emphatically not the
          empty state, which would tell him the section holds nothing when nobody knows yet what
          it holds. The retry button stays, because waiting and pressing again IS the remedy
          here -- it is the only one of the three failure readings where it is. */}
      {state === EZIK_ART_THROTTLED ? (
        <div role="alert" style={s.artError}>
          <span>{ezT('articles.throttled')}</span>
          <button type="button" className="ezhome-focus" style={s.artRetry}
            onClick={load}>{ezT('common.retry')}</button>
        </div>
      ) : null}

      {/* STATE 4 of 4: the section has published writing in it. Newest first -- and that order is
          the STORE'S, read off a sorted index, never re-sorted here. */}`,
  'render-state');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'bytes', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `fix2.cjs`

```js
'use strict';
// DEFECT 4 -- the complaint door that carried the reader off the screen without
// telling him what became of his message.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE REFUSAL SPEAKS, AND THE HAND-OFF IS A SEPARATE ACT ---------------
one(
`  const divertToSignIn = () => {
    writeFbDraft({ type, text, contact, wants: EZIK_FB_WANTS_SIGNIN });
    setBusy(false);
    setErr(ezT('feedback.signInRequired'));
    if (typeof onSignIn === 'function') onSignIn();
  };`,
`  // DEFECT 4 (item 88) -- THE LINE IS SAID, AND THE SCREEN DOES NOT MOVE.
  //
  // WHAT WAS MEASURED. Seventy-six characters were typed into the one visible field and
  // «إرسال» was pressed. The panel set feedback.signInRequired on the line above and then
  // called onSignIn() ON THE SAME TICK -- which pops this panel's history entry and opens
  // الإعدادات. React never painted a frame carrying the sentence: the reader watched his
  // complaint screen turn into a settings screen and was told nothing at all about his
  // message. Not one of the six outcome lines this panel owns reached the glass, and the
  // draft it had just saved was invisible from where he now stood.
  //
  // SO THE TWO ACTS ARE SPLIT. This one is the REFUSAL: it keeps what he wrote, says why
  // it was refused, and leaves him looking at his own words. The «تسجيل الدخول» button
  // below -- which this panel already draws the moment "err" is set -- is the HAND-OFF, and
  // it is his press and not ours. Nothing about the draft changes: both routes write it
  // through the same function, so either way the text survives the trip.
  const refuseForSignIn = () => {
    writeFbDraft({ type, text, contact, wants: EZIK_FB_WANTS_SIGNIN });
    setBusy(false);
    setErr(ezT('feedback.signInRequired'));
  };

  // THE HAND-OFF, and the only thing in this file that leaves the panel. It is wired to the
  // button the reader presses after reading the line above, and to nothing else.
  const divertToSignIn = () => {
    writeFbDraft({ type, text, contact, wants: EZIK_FB_WANTS_SIGNIN });
    setBusy(false);
    if (typeof onSignIn === 'function') onSignIn();
  };`,
  'divert');

// -- 2. THE TWO REFUSAL PATHS TAKE THE SPEAKING ONE --------------------------
one(
    "    if (!held || typeof held.session !== 'string' || !held.session) { divertToSignIn(); return; }",
    "    if (!held || typeof held.session !== 'string' || !held.session) { refuseForSignIn(); return; }",
  'client-check');

one(
    "    if (res && res.status === 401) { divertToSignIn(); return; }",
    "    if (res && res.status === 401) { refuseForSignIn(); return; }",
  'server-401');

// -- 3. AND THE SENT MESSAGE IS ANNOUNCED WHERE HE IS LOOKING ----------------
// `done` already replaces the form with feedback.thanks, so the success path had a line;
// what it did not have was a live region a reader who cannot see the screen would be told
// about. artNote carries role="status" already -- verified at its other call sites -- so
// this is left exactly as it is rather than changed for the sake of changing something.

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `fix3.cjs`

```js
'use strict';
// DEFECT 13 -- the greeting that ended on a vocative particle with nobody after it.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE WHOLE GREETING, for a reader the app has no name for -------------
// It sits beside home.hello and is written in the same escaped form, because the
// block it joins is ASCII on purpose: «مرحباً بك» -- a complete sentence with no
// vocative in it, not «مرحباً يا» with the name lopped off.
one(
  "    'home.hello': '\\u{0645}\\u{0631}\\u{062D}\\u{0628}\\u{0627}\\u{064B} \\u{064A}\\u{0627}',\n",
  "    'home.hello': '\\u{0645}\\u{0631}\\u{062D}\\u{0628}\\u{0627}\\u{064B} \\u{064A}\\u{0627}',\n"
  + "    'home.helloNoName': '\\u{0645}\\u{0631}\\u{062D}\\u{0628}\\u{0627}\\u{064B} \\u{0628}\\u{0643}',\n",
  'ar-home.hello');

one(
  "    'home.hello': 'Welcome,',\n",
  "    'home.hello': 'Welcome,',\n"
  + "    'home.helloNoName': 'Welcome',\n",
  'en-home.hello');

// -- 2. THE IDENTIFIER, beside its sister and re-bound with it ---------------
one(
  'let EZH_HELLO = ezT("home.hello");                            // "welcome, O"\n',
  'let EZH_HELLO = ezT("home.hello");                            // "welcome, O"\n'
  + '// DEFECT 13 (item 88): the whole greeting, for a reader with no stored name. EZH_HELLO ends\n'
  + '// on a VOCATIVE PARTICLE and is only ever half a sentence: it needs a name after it, and a\n'
  + '// guest has none. Measured on the shelf: the line read «مرحباً يا» and the tail after it was\n'
  + '// empty -- the app addressing somebody and then not saying who. This one stands alone.\n'
  + 'let EZH_HELLO_NO_NAME = ezT("home.helloNoName");              // "welcome" -- no vocative\n',
  'let-EZH_HELLO');

one(
  '    EZH_HELLO = ezT("home.hello");\n',
  '    EZH_HELLO = ezT("home.hello");\n'
  + '    EZH_HELLO_NO_NAME = ezT("home.helloNoName");\n',
  'relabel');

// -- 3. AND THE LINE ITSELF ---------------------------------------------------
one(
  '        <h1 style={s.ezistName}>{EZH_HELLO} {name}</h1>',
  '        {/* DEFECT 13 (item 88): a vocative is never drawn bare. With a name the greeting is\n'
  + '            what it always was, character for character; without one it is the whole-sentence\n'
  + '            key beside it rather than a half sentence with a space where a person should be. */}\n'
  + '        <h1 style={s.ezistName}>{name ? <>{EZH_HELLO} {name}</> : EZH_HELLO_NO_NAME}</h1>',
  'jsx-line');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `fix4.cjs`

```js
'use strict';
// DEFECT 12 -- the adhkar opens on one group and the chest names the group and
// not the section, so the reader cannot tell where he is standing.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE SECTION'S NAME ABOVE THE GROUP'S ---------------------------------
one(
`          <span className="ezia-brand">
            <span className="ezia-brand-arch" aria-hidden="true" />
            <span style={s.eziaReadTitle}>{v.cat.title}</span>
          </span>`,
`          {/* DEFECT 12 (item 88) -- THE SECTION IS NAMED ABOVE THE GROUP.
              MEASURED: pressing «الأذكار» on the shelf lands on a chest that reads «أذكار
              المساء», because adhkarTimeDoor opens the group that belongs to the hour. That is
              the owner's behaviour and it is NOT changed here -- neither the group that opens
              nor the order of any group moved. What was missing is that the reader had no way
              to tell, from the top of the screen, that «أذكار المساء» is a group INSIDE الأذكار
              rather than the whole of what he pressed.
              So the section's name stands over the group's, in the smaller, dimmer weight the
              rest of this shell uses for a label above a title. The name is read from
              module.adhkar -- the very key the shelf tile draws -- so the tile and the chest
              cannot come to disagree, and no second Arabic string was authored for it. */}
          <span className="ezia-brand">
            <span className="ezia-brand-arch" aria-hidden="true" />
            <span style={s.eziaReadStack}>
              <span style={s.eziaReadSection}>{ezT('module.adhkar')}</span>
              <span style={s.eziaReadTitle}>{v.cat.title}</span>
            </span>
          </span>`,
  'brand');

// -- 2. THE TWO STYLE KEYS, beside the one they wrap -------------------------
one(
  "  eziaReadHead: { display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 },\n",
  "  // DEFECT 12 (item 88): the section's name over the group's, in one column inside the brand.\n"
  + "  // .ezia-brand is an inline-flex ROW that centres its children, so a column child stacks the\n"
  + "  // two lines without any rule in the sheet moving. minWidth 0 is what lets the title below\n"
  + "  // keep its ellipsis inside a flex parent.\n"
  + "  eziaReadStack: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, lineHeight: 1.15 },\n"
  + "  eziaReadSection: { fontSize: 11, fontWeight: 700, color: 'var(--a3-muted)', whiteSpace: 'nowrap' },\n"
  + "  eziaReadHead: { display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 },\n",
  'styles');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `fix5.cjs`

```js
'use strict';
// DEFECT 14 -- a refresh in the middle of a section throws the reader into the chat.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE RECORD ------------------------------------------------------------
one(
  'const EZIK_ART_LIST_ROUTE = ',
`// ============================================================
// DEFECT 14 (item 88) -- A REFRESH COMES BACK TO THE SECTION, AND THE FIRST OPENING
// STILL LANDS ON THE CHAT
// ============================================================
// WHAT WAS MEASURED. A section was opened from the shelf, the page was refreshed, and the
// reader landed on the CHAT -- in 16 of the check round's 24 readings, and again here on a
// local bench in all six sections tried (المقالات، الأذكار، الفتاوى، الدروس، المصحف، ركن
// النساء). Item 87 lost its open phase the same way. The boot effect answers setScreen('chat')
// for every returning profile, and nothing anywhere remembered that the reader was standing
// somewhere else when the page went away.
//
// WHY sessionStorage AND NOT localStorage, AND IT IS THE WHOLE DESIGN. The owner's ruling is
// that the chat REMAINS the first thing the app opens on, and that only a refresh restores the
// place. Those are exactly the two halves of a session store: it survives a reload of the same
// tab and it does not exist in a new one. So «فتحٌ أوّل» and «تحديث» are told apart by the
// browser itself rather than by a flag this file would have to set, clear and get right.
// A locked or full store degrades to «no memory», which is the behaviour that shipped.
//
// WHAT IS RECORDED IS A SHELF ID AND NOTHING ELSE. Not a screen name -- several of these
// sections are LAYERS and own no "screen" value, which is why the check round found the defect
// in الأسماء and «من الاستيقاظ إلى النوم» as well as in the routed ones. The id is the one the
// shelf array already carries, so the twelve tiles are covered by construction and a thirteenth
// is covered the day it is added. Nothing about scroll position, nothing about what was open
// INSIDE the section, and nothing that could name the reader.
const EZIK_RESUME_KEY = 'ezik_resume_section_v1';

// THE THREE TABLES ARE THE WHOLE ROUTING, and an id in none of them is not recorded at all.
// رحلة الكنوز is deliberately absent: it is a page navigation to /quest.html, and a refresh
// there is the browser reloading quest.html -- there is nothing for this file to restore, and
// recording it would send a reader who had merely walked back to the shelf somewhere he was
// not standing.
const EZIK_RESUME_SCREENS = {
  memorize: 'memorize', adhkar: 'adhkar', arbaeen: 'arbaeen',
  mushaf: 'mushaf', fatwa: 'fatwa', lessons: 'lessons',
};
const EZIK_RESUME_APP_LAYERS = { asmaa: 1, 'sunan-day': 1 };
const EZIK_RESUME_HOME_LAYERS = { articles: 1, women: 1, prayer: 1 };
function ezikResumeKnown(id) {
  return !!(EZIK_RESUME_SCREENS[id] || EZIK_RESUME_APP_LAYERS[id] || EZIK_RESUME_HOME_LAYERS[id]);
}
function ezikWriteResume(id) {
  if (!ezikResumeKnown(id)) return;
  try { sessionStorage.setItem(EZIK_RESUME_KEY, String(id)); } catch (e) {}
}
function ezikReadResume() {
  try {
    const v = sessionStorage.getItem(EZIK_RESUME_KEY);
    return (typeof v === 'string' && ezikResumeKnown(v)) ? v : '';
  } catch (e) { return ''; }
}
function ezikClearResume() {
  try { sessionStorage.removeItem(EZIK_RESUME_KEY); } catch (e) {}
}
// WHERE THE BOOT SHOULD LAND. '' means nothing was recorded, and the answer is the chat --
// byte for byte the destination that shipped.
function ezikResumeScreen() {
  const id = ezikReadResume();
  if (!id) return 'chat';
  if (EZIK_RESUME_SCREENS[id]) return EZIK_RESUME_SCREENS[id];
  return 'home';   // a layer: whoever owns it opens it on its own first render
}

const EZIK_ART_LIST_ROUTE = `,
  'record');

// -- 2. THE ONE WRITER: the shelf tile ---------------------------------------
one(
`    <button type="button" className={'ezhome-focus ezist-' + (feature ? 'feature' : 'mod ezist-mod-' + m.id)}
      onClick={m.onClick} data-ezik-home-module={m.id}`,
`    <button type="button" className={'ezhome-focus ezist-' + (feature ? 'feature' : 'mod ezist-mod-' + m.id)}
      /* DEFECT 14 (item 88): THE ONE PLACE THE READER'S PLACE IS RECORDED. It is here and not
         in the twelve handlers because here there is one press, one id and one line -- and
         because a tile added tomorrow is recorded without anybody remembering to. The tile's
         own handler is called exactly as before, on the same press, and nothing about what it
         does changed. */
      onClick={() => { ezikWriteResume(m.id); if (m.onClick) m.onClick(); }} data-ezik-home-module={m.id}`,
  'writer');

// -- 3. THE APP: the boot destination, and its own two layers ----------------
one(
  "        setScreen('chat');   // D85: a returning profile also lands on the chat",
  "        // DEFECT 14 (item 88): 'chat' unless THIS TAB was standing somewhere when it\n"
  + "        // reloaded. A new tab has no session record, so the first opening of the app is\n"
  + "        // the chat exactly as D85 wrote it; ezikResumeScreen() answers 'chat' for it.\n"
  + "        setScreen(ezikResumeScreen());   // D85: a returning profile also lands on the chat",
  'boot');

one(
  '  const [asmaaOpen, setAsmaaOpen] = useState(false);',
  "  // DEFECT 14 (item 88): the two layers App owns that are shelf sections read the resume\n"
  + "  // record in their LAZY INITIALISER rather than from an effect, so the layer is open on the\n"
  + "  // very first render and no frame of the home is painted underneath it on the way.\n"
  + "  const [asmaaOpen, setAsmaaOpen] = useState(() => ezikReadResume() === 'asmaa');",
  'asmaa');

one(
  '  const [sunanOpen, setSunanOpen] = useState(false);',
  "  const [sunanOpen, setSunanOpen] = useState(() => ezikReadResume() === 'sunan-day');",
  'sunan');

// -- 4. THE HOME OWNER: its own three, and the one place the record is forgotten
one(
  '  const [artSection, setArtSection] = useState(null);',
  "  // DEFECT 14 (item 88): restored in the lazy initialiser, for the reason written beside the\n"
  + "  // two App layers -- the section is open on the first render, not one paint later.\n"
  + "  const [artSection, setArtSection] = useState(() => {\n"
  + "    const id = ezikReadResume();\n"
  + "    return (id === 'articles' || id === 'women') ? id : null;\n"
  + "  });",
  'artSection');

one(
  '  const [prayerOpen, setPrayerOpen] = useState(false);',
  "  const [prayerOpen, setPrayerOpen] = useState(() => ezikReadResume() === 'prayer');",
  'prayerOpen');

// -- 5. AND THE ONE PLACE IT IS FORGOTTEN -------------------------------------
// The bare shelf is the only screen in the application on which the reader is standing
// nowhere in particular, and this component is the only thing that draws it. So the record
// dies exactly there and nowhere else: no closer has to remember to clear it, and no closer
// can clear it early. Every layer App owns returns BEFORE <Home>, so this effect does not run
// at all while الأسماء or «من الاستيقاظ إلى النوم» is open -- which is what keeps a second
// refresh inside them working.

one(
  '  useEzikBackLayer(calcOpen, () => setCalcOpen(false));',
  "  useEzikBackLayer(calcOpen, () => setCalcOpen(false));\n"
  + "  // DEFECT 14 (item 88) -- WHERE THE RECORD DIES, and it is one place.\n"
  + "  // The reader is standing nowhere in particular exactly when this component has no layer of\n"
  + "  // its own open, which is when it draws the bare shelf; every layer App owns returns before\n"
  + "  // <Home> is reached, so this effect does not run at all while one of those is up and a\n"
  + "  // second refresh inside الأسماء still comes back to it. On the first commit after a\n"
  + "  // restore the layer is ALREADY open -- it was set in a lazy initialiser, not an effect --\n"
  + "  // so this cannot clear the record out from under the very restore that just happened.\n"
  + "  useEffect(() => {\n"
  + "    if (artSection || prayerOpen || compassOpen || tasbihOpen || tasbihLogOpen || calcOpen || wirdPickOpen) return;\n"
  + "    ezikClearResume();\n"
  + "  }, [artSection, prayerOpen, compassOpen, tasbihOpen, tasbihLogOpen, calcOpen, wirdPickOpen]);",
  'clear');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `fix6.cjs`

```js
'use strict';
// DEFECT 14, THE TWO GUARDS IT OWES. The record the repair adds is a key this
// application writes, so "delete all my data" must take it and the roster that
// holds that button to account must name it; and the boot's destination is pinned
// by theme-coverage-guard N10, whose CLAIM is untouched but whose spelling is not.
const fs = require('fs');
const REPO = 'C:/Users/passe/projects/ustaz-fix88/';
let n = 0;
function edit(file, find, replace, label) {
  const p = REPO + file;
  let s = fs.readFileSync(p, 'utf8');
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error(label + ': anchor occurs ' + c + ' times in ' + file);
  fs.writeFileSync(p, s.replace(find, replace), 'utf8');
  n += 1;
}

// -- 1. THE BUTTON TAKES IT ---------------------------------------------------
edit('app.jsx',
  "      try { localStorage.removeItem(EZC_GOLD_PRICE_KEY); } catch (e) {}\n",
  "      try { localStorage.removeItem(EZC_GOLD_PRICE_KEY); } catch (e) {}\n"
  + "      // DEFECT 14 (item 88) -- AND THE PLACE THIS TAB WAS STANDING IN, on the owner's standing\n"
  + "      // rule that every key this app writes is erased by «delete all my data». It is the only\n"
  + "      // one of these that lives in sessionStorage rather than localStorage, and it holds one\n"
  + "      // shelf id for the life of one tab -- but leaving it would return the device to half a\n"
  + "      // first open: no profile, no session, and then a refresh that walks the next reader\n"
  + "      // straight into the section the last one was reading. It is entered in\n"
  + "      // tools/delete-truth-measure.cjs in this same commit, which is the roster that holds\n"
  + "      // this line to account.\n"
  + "      ezikClearResume();\n",
  'resetAll');

// -- 2. THE ROSTER NAMES IT ---------------------------------------------------
edit('tools/delete-truth-measure.cjs',
  "  { lit: 'directConvoLocked' },\n",
  "  { lit: 'directConvoLocked' },\n"
  + "  // ITEM 88, DEFECT 14 -- THE PLACE THIS TAB WAS STANDING IN. It is entered HERE and not in\n"
  + "  // MUST_GO_NEW by that list's own rule, exactly as the tasbih's two keys are: MUST_GO_NEW\n"
  + "  // maps an erasure to a CLAUSE of delete.html, and that page names this in neither language,\n"
  + "  // so an entry there would be a false citation. What makes it lawful here is that the button\n"
  + "  // erases it and is asserted to keep erasing it.\n"
  + "  //\n"
  + "  // IT IS THE ONLY KEY ON EITHER LIST THAT LIVES IN sessionStorage, and it holds one shelf id\n"
  + "  // for the life of one tab. It goes anyway, on the owner's standing rule that every device\n"
  + "  // key this app writes is erased -- and for the reason ENTRY_CHOICE_KEY goes: left behind, a\n"
  + "  // refresh after the button would walk whoever has the device next straight into the section\n"
  + "  // the last reader was in, which is half a first open rather than a fresh one.\n"
  + "  { c: 'EZIK_RESUME_KEY' },\n",
  'roster');

// -- 3. THE BOOT GUARD, SAME CLAIM, CURRENT SPELLING --------------------------
edit('theme-coverage-guard.cjs',
  `ok('N10: the boot lands on an EMPTY thread and opens no saved conversation',
  /chatIdRef\\.current = null;\\s*\\r?\\n\\s*setChatId\\(null\\);\\s*\\r?\\n\\s*setMessages\\(\\[\\]\\);\\s*\\r?\\n\\s*setChatList\\(ezikListChats\\(ezikProfileKey\\(p\\)\\)\\);\\s*\\r?\\n\\s*setScreen\\('chat'\\);/.test(html));`,
  `// ITEM 88, DEFECT 14 -- THE CLAIM IS UNCHANGED AND THE SPELLING IS NOT. The four statements
// this line exists to protect -- no chat id, no chat id in state, an EMPTY message list, and the
// saved index loaded WITHOUT opening anything out of it -- are asserted exactly as before, in the
// same order, with nothing between them. What moved is the fifth line, the DESTINATION, and it
// moved on the owner's own ruling: a refresh in the middle of a section must come back to the
// section. So the destination is now an expression, and this asserts the expression BY NAME --
// ezikResumeScreen() and nothing else -- rather than accepting any expression at all. The two
// halves of that ruling are held by the case below, which is what keeps this one honest: a first
// opening still lands on the chat, and ezikResumeScreen is the only thing that decides.
ok('N10: the boot lands on an EMPTY thread and opens no saved conversation',
  /chatIdRef\\.current = null;\\s*\\r?\\n\\s*setChatId\\(null\\);\\s*\\r?\\n\\s*setMessages\\(\\[\\]\\);\\s*\\r?\\n\\s*setChatList\\(ezikListChats\\(ezikProfileKey\\(p\\)\\)\\);(?:\\s*\\r?\\n\\s*\\/\\/[^\\n]*)*\\s*\\r?\\n\\s*setScreen\\(ezikResumeScreen\\(\\)\\);/.test(html));
// ITEM 88, DEFECT 14 -- AND THE CHAT IS STILL WHERE THE APP OPENS. The destination above is an
// expression now, so the thing worth pinning is what that expression answers when this tab has
// never been used: 'chat', by a branch that is the FIRST thing in the function and takes no
// other path. A session store is what tells a first opening from a refresh, so a record read
// out of localStorage -- which outlives the tab -- would break the ruling silently; that is
// pinned too. And the record is a shelf id, never a screen name pulled from the reader.
ok('N10: ...and a tab that has never been used still opens on the chat',
  /function ezikResumeScreen\\(\\) \\{\\s*\\r?\\n\\s*const id = ezikReadResume\\(\\);\\s*\\r?\\n\\s*if \\(!id\\) return 'chat';/.test(html));
ok('N10: ...and the place is remembered for the TAB, never for the device',
  /sessionStorage\\.setItem\\(EZIK_RESUME_KEY,/.test(html)
  && /sessionStorage\\.getItem\\(EZIK_RESUME_KEY\\)/.test(html)
  && html.indexOf('localStorage.getItem(EZIK_RESUME_KEY') === -1
  && html.indexOf('localStorage.setItem(EZIK_RESUME_KEY') === -1);`,
  'N10');

console.log('edits applied:', n);
```

## `fix7.cjs`

```js
'use strict';
// CORRECTING fix6 AGAINST THE HOUSE'S OWN CONVENTION.
//  * app.jsx reaches the session store as `window.sessionStorage` everywhere -- both existing
//    session keys do -- and tools/delete-truth-measure.cjs lifts resetAll with `window` faked
//    and nothing else, so a BARE `sessionStorage` is a name its harness cannot supply.
//  * a session key is not rostered in MUST_GO_*; those lists are about the DEVICE store, and a
//    key that never reaches localStorage would pass them vacuously. Its two siblings are excused
//    in NOT_A_STORAGE_KEY, in writing, with the sweep named. This one joins them.
const fs = require('fs');
const REPO = 'C:/Users/passe/projects/ustaz-fix88/';
let n = 0;
function edit(file, find, replace, label, times) {
  const p = REPO + file;
  const s = fs.readFileSync(p, 'utf8');
  const c = s.split(find).length - 1;
  if (c !== (times || 1)) throw new Error(label + ': anchor occurs ' + c + ' times in ' + file);
  fs.writeFileSync(p, s.split(find).join(replace), 'utf8');
  n += 1;
}

// -- 1. THE HOUSE'S SPELLING --------------------------------------------------
edit('app.jsx',
  '  try { sessionStorage.setItem(EZIK_RESUME_KEY, String(id)); } catch (e) {}',
  '  try { window.sessionStorage.setItem(EZIK_RESUME_KEY, String(id)); } catch (e) {}',
  'setItem');
edit('app.jsx',
  '    const v = sessionStorage.getItem(EZIK_RESUME_KEY);',
  '    const v = window.sessionStorage.getItem(EZIK_RESUME_KEY);',
  'getItem');
edit('app.jsx',
  '  try { sessionStorage.removeItem(EZIK_RESUME_KEY); } catch (e) {}',
  '  try { window.sessionStorage.removeItem(EZIK_RESUME_KEY); } catch (e) {}',
  'removeItem');

// -- 2. THE ROSTER ENTRY BECOMES AN EXCUSE, WHICH IS WHAT IT ALWAYS WAS -------
edit('tools/delete-truth-measure.cjs',
  "  // ITEM 88, DEFECT 14 -- THE PLACE THIS TAB WAS STANDING IN. It is entered HERE and not in\n"
  + "  // MUST_GO_NEW by that list's own rule, exactly as the tasbih's two keys are: MUST_GO_NEW\n"
  + "  // maps an erasure to a CLAUSE of delete.html, and that page names this in neither language,\n"
  + "  // so an entry there would be a false citation. What makes it lawful here is that the button\n"
  + "  // erases it and is asserted to keep erasing it.\n"
  + "  //\n"
  + "  // IT IS THE ONLY KEY ON EITHER LIST THAT LIVES IN sessionStorage, and it holds one shelf id\n"
  + "  // for the life of one tab. It goes anyway, on the owner's standing rule that every device\n"
  + "  // key this app writes is erased -- and for the reason ENTRY_CHOICE_KEY goes: left behind, a\n"
  + "  // refresh after the button would walk whoever has the device next straight into the section\n"
  + "  // the last reader was in, which is half a first open rather than a fresh one.\n"
  + "  { c: 'EZIK_RESUME_KEY' },\n",
  '',
  'unroster');

edit('tools/delete-truth-measure.cjs',
  "  EZIK_FB_DRAFT_KEY: 'a key into sessionStorage",
  "  // ITEM 88, DEFECT 14. THE THIRD KEY IN THIS STORE, EXCUSED ON THE SAME TERMS AS THE TWO ABOVE\n"
  + "  // IT, AND THE CASE BELOW HOLDS THIS SENTENCE TO ACCOUNT THE SAME WAY: it fails the moment\n"
  + "  // this literal is handed to localStorage anywhere in app.jsx.\n"
  + "  //\n"
  + "  // WHAT IT HOLDS. One shelf id -- 'fatwa', 'adhkar', 'articles' and nine others -- so that a\n"
  + "  // reader who refreshes the page in the middle of a section comes back to that section\n"
  + "  // instead of being thrown into the chat. Nothing about the reader is in it, nothing about\n"
  + "  // what he read there, and no position inside it.\n"
  + "  //\n"
  + "  // WHY sessionStorage IS NOT A CONVENIENCE HERE BUT THE WHOLE MECHANISM. The owner's ruling\n"
  + "  // has two halves: a refresh restores the place, and the FIRST opening of the app still lands\n"
  + "  // on the chat. Those are exactly the two properties of a session store -- it survives a\n"
  + "  // reload of the same tab and does not exist in a new one -- so the browser tells the two\n"
  + "  // cases apart and app.jsx never has to set, clear and get right a flag of its own. In\n"
  + "  // localStorage the second half of the ruling would be silently false.\n"
  + "  //\n"
  + "  // AND resetAll() SWEEPS IT, beside the two above: a device whose data has been deleted must\n"
  + "  // not walk whoever has it next into the section the last reader was in.\n"
  + "  EZIK_RESUME_KEY: 'a key into sessionStorage -- one browser tab, gone when the tab closes --'\n"
  + "    + ' and never handed to localStorage. It holds one shelf id so that a refresh comes back to'\n"
  + "    + ' the section, the store\\u2019s own lifetime is what keeps a FIRST opening on the chat, and'\n"
  + "    + ' resetAll() sweeps it from sessionStorage too',\n"
  + "  EZIK_FB_DRAFT_KEY: 'a key into sessionStorage",
  'excuse');

// -- 3. AND THE GUARD PINS THE HOUSE'S SPELLING ------------------------------
edit('theme-coverage-guard.cjs',
  "  /sessionStorage\\.setItem\\(EZIK_RESUME_KEY,/.test(html)\n"
  + "  && /sessionStorage\\.getItem\\(EZIK_RESUME_KEY\\)/.test(html)",
  "  /window\\.sessionStorage\\.setItem\\(EZIK_RESUME_KEY,/.test(html)\n"
  + "  && /window\\.sessionStorage\\.getItem\\(EZIK_RESUME_KEY\\)/.test(html)",
  'guard-spelling');

console.log('edits applied:', n);
```

## `item87-intact.cjs`

```js
'use strict';
// BATCH B, ITEM 1 -- THE HALF THAT MUST NOT CHANGE. The repair may only alter where a
// RELOAD lands. Walking into المصحف from the shelf must still open the page the reader
// left, which is item 87's promise, so that is measured on its own.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const SHOTS = path.join(OUT, 'shots-item87');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const out = { at: new Date().toISOString() };
const FILE = path.join(OUT, 'item87-intact.json');

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
    await R.installRoutes(ctx, 'rows', null, []);
    const page = await ctx.newPage();
    await R.enter(page, AR, D.lit, base);
    await R.toHome(page, AR);
    await page.locator('[data-ezik-home-module="mushaf"]').first().click();
    await R.settle(page, 9000); await page.waitForTimeout(2600);
    const rows = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      return Array.from(document.querySelectorAll('button')).filter(vis)
        .map((el, i) => ({ i, t: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) }));
    });
    const juz = rows.filter((r) => /الجزء/.test(r.t))[2];
    await page.locator('button').nth(juz.i).click({ timeout: 8000 });
    await R.settle(page, 9000); await page.waitForTimeout(2600);
    out.readingHead = (await R.sig(page)).text.slice(0, 60);
    await R.shot(page, SHOTS, 'i87-reading');

    // OUT to the shelf, then IN again from the shelf -- the ordinary walk-in.
    // THE READING PAGE HAS NO «رجوع», so the generic walk-home cannot leave it: its way
    // up is «السور», and that is pressed first. This is the very asymmetry item 1 is about.
    const up = page.getByRole("button", { name: "السور", exact: true });
    if (await up.count()) { await up.first().click(); await page.waitForTimeout(2000); }
    await R.toHome(page, AR);
    await page.locator('[data-ezik-home-module="mushaf"]').first().click();
    await R.settle(page, 9000); await page.waitForTimeout(2800);
    const again = await R.sig(page);
    out.walkInHead = again.text.slice(0, 60);
    out.walkInIsIndex = /الانتقال إلى جزء/.test(again.text);
    out.walkInResumedThePage = out.walkInHead.slice(0, 30) === out.readingHead.slice(0, 30);
    await R.shot(page, SHOTS, 'i87-walkin');
    R.say('readingHead =', JSON.stringify(out.readingHead.slice(0, 30)));
    R.say('walkInHead  =', JSON.stringify(out.walkInHead.slice(0, 30)));
    R.say('walkInResumedThePage =', out.walkInResumedThePage, ' walkInIsIndex =', out.walkInIsIndex);
    await ctx.close();
  } catch (e) { out.error = String(e && e.message).slice(0, 200); R.say('ERR', out.error); }
  finally { await browser.close(); srv.close(); fs.writeFileSync(FILE, JSON.stringify(out, null, 2)); }
  R.say('WROTE', FILE);
})();
```

## `live.cjs`

```js
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
```

## `live2.cjs`

```js
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
```

## `measure.cjs`

```js
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
```

## `mushaf-page2.cjs`

```js
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
```

## `probe.cjs`

```js
'use strict';
// A one-shot look at the home shelf, to learn the accessible names before anything is measured.
const R = require('./rig.cjs');
const path = require('path');

(async () => {
  const tree = process.argv[2];
  const { srv, port } = await R.serve(tree);
  const base = 'http://127.0.0.1:' + port + '/';
  R.say('PORT', port, 'ROOT', tree);
  const d = R.dictOf(path.join(tree, 'app.jsx'));
  const browser = await R.chromium.launch(R.LAUNCH);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'ar',
    serviceWorkers: 'block', deviceScaleFactor: 1,
  });
  const seen = [];
  await R.installRoutes(ctx, 'rows', null, seen);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') R.say('CONSOLE-ERR', m.text().slice(0, 160)); });
  page.on('pageerror', (e) => R.say('PAGE-ERR', String(e && e.message).slice(0, 200)));
  await R.enter(page, d.ar, d.lit, base);
  let s = await R.sig(page);
  R.say('after-enter textLen=', s.textLen, 'controls=', s.controls, 'url=', s.url);
  R.say('TEXT-HEAD:', JSON.stringify(s.text.slice(0, 300)));
  const home = await R.toHome(page, d.ar);
  R.say('toHome=', home);
  s = await R.sig(page);
  R.say('names:');
  for (const n of s.names) R.say('  [' + n.g + '] t=' + JSON.stringify(n.t) + ' a=' + JSON.stringify(n.a));
  R.say('routes seen:', JSON.stringify(seen.map((x) => x.name)));
  await browser.close();
  srv.close();
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
```

## `refresh-deep.cjs`

```js
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
```

## `repin.cjs`

```js
'use strict';
// THE APP.JS BYTE PIN LIVES IN THREE PLACES, and a build that moves the bundle
// leaves all three stating the old number -- which is exactly what B12 and B14
// of quest-bank-integrity-guard.cjs exist to catch. This re-cuts all three from
// the file on disk and refuses to write if it cannot find each one exactly once.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/Users/passe/projects/ustaz-fix88';

const appBytes = fs.statSync(path.join(REPO, 'app.js')).size;

function edit(file, find, replace, label) {
  const p = path.join(REPO, file);
  const s = fs.readFileSync(p, 'utf8');
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error(label + ': anchor found ' + c + ' times in ' + file);
  const out = s.replace(find, replace);
  if (out === s) throw new Error(label + ': nothing changed');
  fs.writeFileSync(p, out, 'utf8');
  return true;
}

function currentPin() {
  const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
  const m = /\+ app\.js (\d+) \+/.exec(sw);
  if (!m) throw new Error('cannot read the current app.js pin out of sw.js prose');
  return parseInt(m[1], 10);
}
function currentCore() {
  const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
  const m = /^const CORE_BYTES = (\d+);$/m.exec(sw);
  if (!m) throw new Error('cannot read CORE_BYTES out of sw.js');
  return parseInt(m[1], 10);
}

const oldPin = currentPin();
const oldCore = currentCore();
if (oldPin === appBytes) {
  console.log('already pinned at ' + appBytes + ' -- nothing to do');
  process.exit(0);
}
const delta = appBytes - oldPin;
const newCore = oldCore + delta;

edit('sw.js', '+ app.js ' + oldPin + ' +', '+ app.js ' + appBytes + ' +', 'sw prose');
edit('sw.js', 'const CORE_BYTES = ' + oldCore + ';', 'const CORE_BYTES = ' + newCore + ';', 'CORE_BYTES');
edit('quest-bank-integrity-guard.cjs',
  '{ n: ' + oldPin + ", of: 'app.js' },", '{ n: ' + appBytes + ", of: 'app.js' },", 'guard mirror');

console.log('app.js ' + oldPin + ' -> ' + appBytes + ' (' + (delta >= 0 ? '+' : '') + delta + ')');
console.log('CORE_BYTES ' + oldCore + ' -> ' + newCore);
```

## `reseal.cjs`

```js
'use strict';
// RE-CUT THE sw.js SEAL, and refuse to do it on a tree that is not measured at CR = 0,
// which is the rule written above the seal itself. The note is appended to the re-cut
// history newest-first, exactly where the two notes above it sit.
const fs = require('fs');
const crypto = require('crypto');
const REPO = 'C:/Users/passe/projects/ustaz-fix88/';
const G = REPO + 'quest-bank-integrity-guard.cjs';

const note = process.argv[2];
if (!note) { console.error('usage: node reseal.cjs "<the history note, one paragraph>"'); process.exit(2); }

const sw = fs.readFileSync(REPO + 'sw.js');
let cr = 0; for (const b of sw) if (b === 13) cr += 1;
if (cr !== 0) { console.error('sw.js carries ' + cr + ' CR -- the seal may only be cut at CR = 0'); process.exit(1); }
const hash = crypto.createHash('sha256').update(sw).digest('hex');

let s = fs.readFileSync(G, 'utf8');
const m = /^(\s*)'sw\.js': '([0-9a-f]{64})',$/m.exec(s);
if (!m) { console.error('cannot find the sw.js seal line'); process.exit(1); }
const old = m[2];
if (old === hash) { console.log('sw.js seal already current: ' + hash); process.exit(0); }

// The note goes ABOVE the seal line, at the head of the newest-first history.
const wrapped = note.split('\n').map((l, i) => (i === 0
  ? '  //   ' + l
  : '//                    ' + l)).join('\n');
s = s.replace(m[0], wrapped + '\n' + m[0].replace(old, hash));
fs.writeFileSync(G, s, 'utf8');
console.log('sw.js seal ' + old.slice(0, 12) + '... -> ' + hash.slice(0, 12) + '...  (bytes ' + sw.length + ', CR 0)');
```

## `resume.cjs`

```js
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
```

## `rig.cjs`

```js
'use strict';
// ---------------------------------------------------------------------------
// THE BENCH. It serves ONE working tree over a local static server, opens it in
// headless msedge, and INTERCEPTS every /api/** call so the four outcomes the
// order names can be forced: 429 throttle, 503/dead connection, 200 with an
// empty list, and 200 with real rows. Nothing here talks to the live site and
// nothing here calls a paid route.
//
// ASCII on the terminal. Arabic goes into the JSON this writes.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/passe/projects/ustaz-check88/check88/node_modules/playwright');
const { dictOf, keysIn } = require('./dict.cjs');

const LAUNCH = { headless: true, channel: 'msedge' };
const asc = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7e]/g, '.');
const say = (...a) => console.log(a.map(asc).join(' '));

// -- the static server --------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};
function serve(rootIn) {
  const root = require('path').resolve(rootIn);
  return new Promise((res) => {
    const srv = http.createServer((req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const f = path.join(root, p.replace(/^[/]+/, ''));
      if (!f.startsWith(root)) { rq.writeHead(403); return rq.end('no'); }
      fs.readFile(f, (e, buf) => {
        if (e) { rq.writeHead(404, { 'Content-Type': 'text/plain' }); return rq.end('404'); }
        rq.writeHead(200, {
          'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        rq.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

// -- the faked answers --------------------------------------------------------
// One table. Every route the four sections under repair reach is here, with the
// body shape its own client whitelist expects, so "rows" really draws rows.
const ROWS = {
  'articles-list': {
    ok: true,
    items: [
      { slug: 'rig-a', kind: 'article', title: 'RIG-ONE', publishedAt: '2026-09-01T00:00:00.000Z' },
      { slug: 'rig-b', kind: 'qa', title: 'RIG-TWO', publishedAt: '2026-09-02T00:00:00.000Z' },
    ],
  },
  'lessons-browse': {
    ok: true,
    rows: [{ scholar_id: 'RIG-SCHOLAR', count: 7 }],
    pages: 1, total: 7,
  },
  'scholars': { ok: true, scholars: [{ id: 'binbaz', shortName: 'RIG-SH' }] },
  'fatwas-browse': {
    ok: true,
    results: [{
      uid: 'rig-1', title: 'RIG-FATWA',
      scholar: { id: 'binbaz', shortName: 'RIG-SH' },
      content: { question: 'RIG-Q', answer: 'RIG-A' },
      audio: { available: false }, source: { url: 'https://example.invalid/rig' },
    }],
    pagination: { page: 1, total: 1, totalPages: 1, hasPrevious: false, hasNext: false },
  },
};
const EMPTY = {
  'articles-list': { ok: true, items: [] },
  'lessons-browse': { ok: true, rows: [], pages: 1, total: 0 },
  'scholars': { ok: true, scholars: [] },
  'fatwas-browse': { ok: true, results: [], pagination: { page: 1, total: 0, totalPages: 0, hasPrevious: false, hasNext: false } },
};
function routeName(url) {
  if (url.indexOf('/api/articles-list') >= 0) return 'articles-list';
  if (url.indexOf('/api/lessons-browse') >= 0) return 'lessons-browse';
  if (url.indexOf('/api/lessons-search') >= 0) return 'lessons-search';
  if (url.indexOf('/api/v1/scholars') >= 0) return 'scholars';
  if (url.indexOf('/api/v1/fatwas/browse') >= 0) return 'fatwas-browse';
  if (url.indexOf('/api/feedback') >= 0) return 'feedback';
  return 'other';
}

// mode: '429' | '503' | 'abort' | 'empty' | 'rows'
// `only` limits the mode to one route name; everything else answers 'rows'.
async function installRoutes(ctx, mode, only, seen) {
  await ctx.route('**/api/**', async (route) => {
    const url = route.request().url();
    const name = routeName(url);
    if (seen) seen.push({ name, url: url.slice(0, 160), t: Date.now() });
    const m = (!only || only.indexOf(name) >= 0) ? mode : 'rows';
    if (m === 'abort') return route.abort('connectionfailed');
    if (m === '429') {
      return route.fulfill({ status: 429, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'rate_limited' } }) });
    }
    if (m === '503') {
      return route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'unavailable' } }) });
    }
    const table = (m === 'empty') ? EMPTY : ROWS;
    const body = table[name];
    if (!body) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

// -- reading the screen -------------------------------------------------------
const SIG = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const ctrls = Array.from(document.querySelectorAll('button,[role="button"],a[href],input,select,textarea,summary')).filter(vis);
  const t = (document.body && document.body.innerText) || '';
  return {
    url: location.href,
    textLen: t.length,
    text: t,
    controls: ctrls.length,
    live: Array.from(document.querySelectorAll('[role="alert"],[role="status"]')).filter(vis)
      .map((e) => ({ role: e.getAttribute('role'), text: (e.innerText || '').trim().slice(0, 400) })),
    names: ctrls.slice(0, 90).map((el) => ({
      t: (el.innerText || el.value || '').trim().slice(0, 60),
      a: el.getAttribute('aria-label') || '',
      g: el.tagName.toLowerCase(),
      h: el.getAttribute('href') || '',
      tg: el.getAttribute('target') || '',
    })),
  };
};

async function sig(page) { return page.evaluate(SIG); }

let seq = 0;
async function shot(page, shots, name) {
  seq += 1;
  const f = String(seq).padStart(3, '0') + '-' + String(name).replace(/[^A-Za-z0-9_.-]/g, '-') + '.png';
  try { await page.screenshot({ path: path.join(shots, f), timeout: 20000 }); } catch (e) { return null; }
  return f;
}

async function settle(page, ms) {
  try { await page.waitForLoadState('networkidle', { timeout: ms || 6000 }); } catch (e) {}
  await page.waitForTimeout(600);
}

// -- the way in ---------------------------------------------------------------
async function enter(page, ar, lit, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 8000);
  await page.waitForTimeout(1200);
  const g = page.getByRole('button', { name: ar['entry.guest'], exact: true });
  if (await g.count()) { await g.first().click(); await settle(page, 8000); await page.waitForTimeout(1500); }
  const a = page.getByRole('button', { name: lit.EZ_AIC_AGREE, exact: true });
  if (await a.count()) { await a.first().click(); await settle(page, 8000); await page.waitForTimeout(1800); }
}

async function toHome(page, ar) {
  for (let i = 0; i < 5; i++) {
    const n = await page.getByRole('button', { name: ar['module.mushaf'], exact: true }).count();
    if (n) return true;
    const h = page.getByRole('button', { name: ar['navigation.home'] });
    if (await h.count()) { await h.first().click(); await page.waitForTimeout(1400); continue; }
    const b = page.getByRole('button', { name: ar['common.back'] });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(1200); continue; }
    return false;
  }
  return false;
}

module.exports = {
  chromium, LAUNCH, serve, installRoutes, sig, shot, settle, enter, toHome,
  dictOf, keysIn, asc, say, SIG, ROWS, EMPTY, routeName,
};
```

## `serve.cjs`

```js
'use strict';
// ---------------------------------------------------------------------------
// THE PLATFORM THE CHECK TOOL IS POINTED AT. It serves the repaired working tree
// AND answers the read-only /api routes the sections fetch when they open.
//
// WHY IT MUST ANSWER THEM AT ALL, AND WHY 404 IS THE WRONG DEFAULT. The tool's
// cut-network round judges a message TRUE or FALSE by comparing the section with
// the network up against the same section with it cut. A server that 404s every
// call makes those two states IDENTICAL -- the outage line appears in both -- so
// every fetching section would be published as printing a FALSE line, which is an
// artefact of the bench and not a fact about the application. Answering 200 with
// well-formed rows is what makes "connected" mean connected, exactly as the live
// site does, and it is the same faking the order authorises for this platform.
//
// NOTHING PAID IS ANSWERED. /api/ask is not in this table and is refused with 501
// rather than stubbed, so a round that tried to spend would fail loudly instead of
// being quietly fed an invented answer.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('C:/Users/passe/projects/ustaz-fix88');
const PORT = parseInt(process.argv[2] || '0', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

// The bodies each client whitelist expects, so "rows" really draws rows.
const ARTICLES = {
  ok: true,
  items: [
    { slug: 'bench-a', kind: 'article', title: 'BENCH-ONE', publishedAt: '2026-09-01T00:00:00.000Z' },
    { slug: 'bench-b', kind: 'qa', title: 'BENCH-TWO', publishedAt: '2026-09-02T00:00:00.000Z' },
  ],
};
const LESSONS_BROWSE = { ok: true, rows: [{ scholar_id: 'BENCH-SCHOLAR', count: 7 }], pages: 1, total: 7 };
const LESSONS_SEARCH = { ok: true, results: [] };
const SCHOLARS = { ok: true, scholars: [{ id: 'binbaz', shortName: 'BENCH-SH' }] };
const FATWAS = {
  ok: true,
  results: [{
    uid: 'bench-1', title: 'BENCH-FATWA',
    scholar: { id: 'binbaz', shortName: 'BENCH-SH' },
    content: { question: 'BENCH-Q', answer: 'BENCH-A' },
    audio: { available: false }, source: { url: 'https://example.invalid/bench' },
  }],
  pagination: { page: 1, total: 1, totalPages: 1, hasPrevious: false, hasNext: false },
};

function apiBody(p) {
  if (p.indexOf('/api/articles-list') === 0) return ARTICLES;
  if (p.indexOf('/api/lessons-browse') === 0) return LESSONS_BROWSE;
  if (p.indexOf('/api/lessons-search') === 0) return LESSONS_SEARCH;
  if (p.indexOf('/api/v1/scholars') === 0) return SCHOLARS;
  if (p.indexOf('/api/v1/fatwas/browse') === 0) return FATWAS;
  if (p.indexOf('/api/articles-admin') === 0) return { ok: false, error: 'not-a-writer' };
  if (p.indexOf('/api/feedback') === 0) return { ok: true };
  return null;
}

const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) {
    if (/^\/api\/ask(\/|$)/.test(p)) {
      res.writeHead(501, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'the bench does not answer the paid route' }));
    }
    const body = apiBody(p);
    // THE REQUEST BODY IS DRAINED FIRST, ALWAYS. Several of these routes are POSTs, and a
    // socket left half-read is a request the client sees hang rather than answer -- which
    // on this bench would read as a slow server and quietly poison every timing beside it.
    // resume() drains a GET's empty body just as well as a POST's, so there is one path.
    req.resume();
    req.on('end', () => {
      if (!body) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end('{"ok":false}');
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(body));
    });
    return undefined;
  }
  const rel = (p === '/' || p === '') ? '/index.html' : p;
  const f = path.join(ROOT, rel.replace(/^[/]+/, ''));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  return fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    return res.end(buf);
  });
});

srv.listen(PORT, '127.0.0.1', () => console.log('PORT=' + srv.address().port + ' ROOT=' + ROOT));
```

## `shelf.cjs`

```js
'use strict';
// ORDER §4-و -- WHAT IS NOT REPAIRED THIS TRIP, MEASURED SO THE DESIGN WORK AFTER
// IT IS ONE STEP AND NOT A SEARCH. For every tile on the shelf, at both sizes: the
// box, the ink inside it, the ratio between them, and how many drawn marks (svg or
// img) the tile actually contains. No icon is invented and no identity is touched.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-shelf');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  const out = { at: new Date().toISOString(), tree: TREE, viewports: [] };
  try {
    for (const vp of [{ tag: 'm390', w: 390, h: 844 }, { tag: 't820', w: 820, h: 1180 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ar', serviceWorkers: 'block' });
      await R.installRoutes(ctx, 'rows', null, []);
      const page = await ctx.newPage();
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const tiles = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[data-ezik-home-module]'));
        // The tallest run of glyphs inside the tile: the label's own line box, which is
        // what "the ink" means -- not the tile's padding and not its whole content box.
        const inkOf = (el) => {
          let top = Infinity, bot = -Infinity, found = false;
          const walk = (node) => {
            if (node.nodeType === 3) {
              const t = String(node.nodeValue || '').trim();
              if (!t) return;
              const r = document.createRange();
              r.selectNodeContents(node);
              const b = r.getBoundingClientRect();
              if (b.height > 0) { top = Math.min(top, b.top); bot = Math.max(bot, b.bottom); found = true; }
              return;
            }
            for (const c of node.childNodes) walk(c);
          };
          walk(el);
          return found ? Math.round((bot - top) * 100) / 100 : 0;
        };
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          const ink = inkOf(el);
          const cs = getComputedStyle(el);
          return {
            id: el.getAttribute('data-ezik-home-module'),
            label: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
            boxW: Math.round(r.width), boxH: Math.round(r.height),
            inkH: ink,
            ratio: ink > 0 ? Math.round((r.height / ink) * 100) / 100 : null,
            marks: el.querySelectorAll('svg,img,picture,canvas').length,
            fontSize: cs.fontSize,
            className: String(el.className || '').slice(0, 60),
          };
        });
      });
      const shot = await R.shot(page, SHOTS, 'shelf-' + vp.tag);
      out.viewports.push({ tag: vp.tag, count: tiles.length, tiles, shot });
      R.say('--', vp.tag, 'tiles=' + tiles.length);
      for (const t of tiles) {
        R.say('   ', String(t.id).padEnd(11), 'box=' + t.boxW + 'x' + t.boxH,
          'ink=' + t.inkH, 'ratio=' + t.ratio, 'marks=' + t.marks, 'font=' + t.fontSize);
      }
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  const f = path.join(OUT, 'shelf.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  R.say('WROTE', f);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
```

## `tool-treasure.cjs`

```js
'use strict';
// Drive the TOOL'S OWN back search against the treasure section, in the state the
// sweep actually reaches it in -- ten controls pressed first, so a round is running
// and the exit door asks its question. This is the case the last run got wrong.
process.env.EZIK_CHECK_TREE = 'C:/Users/passe/projects/ustaz-fix88';
process.env.EZIK_CHECK_TARGET = process.argv[2];
const T = 'C:/Users/passe/projects/ustaz-check88/check88/src/';
const E = require(T + 'engine.js');
const N = require(T + 'names.js');
const NAV = require(T + 'nav.js');
const SWEEP = require(T + 'sweep.js');

(async () => {
  E.say('TARGET', E.TARGET);
  const br = await E.launch();
  const S = await E.newSession(br, { viewport: E.VIEWPORTS[0], label: 'probe' });
  await NAV.enter(S.page, S.ev);
  await NAV.toHome(S.page, S.ev);
  const want = (process.argv[3] || 'treasure').split(',');
  const out = [];
  for (const id of want) {
    const sec = N.inv().sections.filter((x) => x.id === id)[0];
    if (!sec) { E.say('no such section', id); continue; }
    const n = out.length;
    await SWEEP.sweepSection(S.page, S.ev, sec, E.VIEWPORTS[0], out);
    const r = out[n];
    const b = (r.acts.back && r.acts.back.app) || {};
    E.say('--', id, 'opened=' + r.opened,
      'named=' + b.controlPresent, 'way=' + b.wayBackExists,
      'lands=' + JSON.stringify(b.wayBackLandsOn), 'by=' + JSON.stringify(b.wayBackNamed));
    E.say('   searched=', JSON.stringify(((r.acts.back && r.acts.back.searched) || []).map((x) => x.name + '->' + x.landed)));
    E.say('   titleOnScreen=' + (r.acts.open||{}).titleOnScreen, 'exact=' + (r.acts.open||{}).titleOnScreenExact);
    await NAV.toHome(S.page, S.ev);
  }
  await S.ctx.close();
  await br.close();
})().catch((e) => { E.say('FATAL', String(e && e.stack || e)); process.exit(1); });
```

## `treasure-exit.cjs`

```js
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
```

## `where.cjs`

```js
'use strict';
// WHICH SCREEN AM I ON? Named by a thing only that screen carries, so a section
// that happens to mention another section's name cannot be mistaken for it.
//
// MEASURED TRAP: the CHAT draws suggestion cards that carry every module's name
// AND its subtitle (`module.*.sub`). A "is the shelf on screen" test built from
// module names alone answers yes on the chat -- which is exactly the screen the
// refresh defect lands on, so that test would have called the defect fixed.
// The shelf draws names with NO subtitles; the chat draws the subtitles and a
// composer placeholder. So: the composer names the chat, and the shelf is named
// by module names WITHOUT the subtitle beside them.
function whereAmI(text, AR) {
  const t = String(text || '');
  const hasComposer = AR['chat.placeholder'] && t.indexOf(AR['chat.placeholder']) >= 0;
  const subs = ['module.fatwa.sub', 'module.mushaf.sub', 'module.treasure.sub']
    .filter((k) => AR[k] && t.indexOf(AR[k]) >= 0).length;
  const names = ['module.fatwa', 'module.mushaf', 'module.lessons', 'module.adhkar']
    .filter((k) => AR[k] && t.indexOf(AR[k]) >= 0).length;
  if (subs >= 2) return 'chat';
  if (hasComposer) return 'chat';
  if (names >= 3) return 'shelf';
  return 'other';
}
module.exports = { whereAmI };
```
