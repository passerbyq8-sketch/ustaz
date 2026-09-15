# مِنصّةُ الدفعةِ الثانية — مصدرُها كاملًا

> بالشرطِ نفسِه الذي في `bench/BENCH-SOURCES.md`: `recon` يمنعُ تعقُّبَ `.cjs` تحتَ مجلَّدٍ اسمُه يبدأُ بـ`fix-`،
> فالمصدرُ وثيقةٌ. انسخْ كلَّ كتلةٍ إلى ملفٍّ باسمِها **خارجَ هذا المجلَّد** بجانبِ `rig.cjs` و`where.cjs` وشغّلْها.

```
node batchb.cjs <tree> <label> <outdir> [b1,b2,b3]   # البنودُ الثلاثة
node item87-intact.cjs <tree> <outdir>              # وعدُ البندِ ٨٧ بعدَ إصلاحِ البند ١
node b2-defect12.cjs   <tree> <outdir>              # إصلاحُ ١٢ وترتيبُ المجموعات
node b3-after-back.cjs <tree> <outdir>              # الرجوعُ والاستعادةُ والفتحُ الأوّل
node b3-ladder.cjs     <tree> <outdir> <tag>        # سُلَّمُ الرجوعِ كاملًا
```

و`b1.cjs`/`b2.cjs`/`b3.cjs` هي سكربتاتُ الإصلاحِ التي طبَّقَتِ التغييراتِ على `app.jsx`.

---

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

## `b2.cjs`

```js
'use strict';
// BATCH B, ITEM 2 -- the adhkar must open on the whole index, by the owner's words.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;

// The whole clock-door block: its comment head, its ref and its effect. It is replaced by
// the record of its removal -- the file's own habit for a decision that is reversed.
const from = s.indexOf('  // THE CLOCK\'S FIRST DOOR, and it is opened ONCE.');
if (from < 0) throw new Error('clock-door comment not found');
const marker = '  }, [db]);\n';
const to = s.indexOf(marker, from);
if (to < 0) throw new Error('clock-door effect end not found');
const block = s.slice(from, to + marker.length);
if (block.indexOf('adhkarTimeDoor(db.categories)') < 0) throw new Error('wrong block cut');
if (block.length > 2400) throw new Error('block suspiciously long: ' + block.length);

const replacement = [
  '  // BATCH B, ITEM 2 -- THE CLOCK\'S DOOR IS GONE FROM THIS ENTRANCE, BY THE OWNER\'S WORDS:',
  '  // «الأذكارُ المفترضُ يفتحُ مباشرةً على جميعِ الأذكار».',
  '  //',
  '  // WHAT STOOD HERE. A ref and an effect that, on the first pass which saw a real store,',
  '  // called adhkarTimeDoor(db.categories) and opened the group belonging to the hour --',
  '  // so pressing «الأذكار» on the shelf landed the reader inside «أذكار المساء» and never',
  '  // on the catalogue. MEASURED on the bench before this: the door opened on a GROUP, its',
  '  // reader\'s own counter on the screen, at both sizes.',
  '  //',
  '  // IT IS REMOVED RATHER THAN GATED, and that is the order\'s own instruction: the function',
  '  // that picks the hour\'s group «لا تُستدعى من هذا الباب». A flag left behind is a second',
  '  // answer to a question that now has one, and the next reader of this file would have to',
  '  // work out which arm ships.',
  '  //',
  '  // WHAT IS NOT TOUCHED. Nothing else opens a group by the clock, so no other entrance',
  '  // changes: the home card, a notification and any direct link still open the group they',
  '  // name, because none of them came through here. The catalogue\'s ORDER is untouched --',
  '  // it is the store\'s own, mapped once, and nothing here sorted it. No group is marked,',
  '  // suggested or promoted: the order forbids inventing a distinction and none is added.',
  '  // And item 88 defect 12 still stands -- the section\'s name is drawn above the group\'s',
  '  // name in the reader, which is what a reader now sees only after he chooses a group.',
  '  //',
  '  // adhkarTimeDoor ITSELF IS LEFT DECLARED AND UNCALLED, on this file\'s own habit: a',
  '  // function with no reader is a smaller change than a deleted one, and it is the single',
  '  // place the hour-to-group rule is written down should the owner want that door again.',
  '',
].join('\n');

s = s.slice(0, from) + replacement + s.slice(to + marker.length);
fs.writeFileSync(P, s, 'utf8');
console.log('removed', block.length, 'chars; chars', before.length, '->', s.length);
console.log('adhkarTimeDoor callers left:', (s.match(/adhkarTimeDoor\(/g) || []).length, '(1 = the declaration only)');
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
```

## `b3.cjs`

```js
'use strict';
// BATCH B, ITEM 3 -- an old conversation opens from wherever the reader was standing.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;

const find = `  const openSavedChat = (id) => {
    try { abortRef.current?.abort(); } catch (e) {}
    abortRef.current = null;
    cancelAudio();
    chatIdRef.current = id;`;

const replace = `  // BATCH B, ITEM 3 -- AND IT NOW GOES TO THE CHAT, WHICH IS THE WHOLE REPAIR.
  //
  // THE OWNER'S WORDS: «لمّا أكونُ في الرئيسيّةِ وهي صفحةُ الأقسام، وأضغطُ القائمةَ الجانبيّةَ
  // وأروحُ حقّ سؤالٍ سألتُه عزك من قبل — ما يودّيني لها أبدًا. لازم أضغطُ محادثةً جديدةً بعدين
  // أروحُ للمحادثةِ اللي أبي».
  //
  // WHAT WAS MEASURED, with two conversations seeded in the store's own shape. From the CHAT the
  // row worked: the conversation's own body was on the screen afterwards. From the HOME the row
  // was seen and pressed, and the reader stayed on the shelf with that body nowhere -- the same
  // press, the opposite outcome, which is exactly the difference that names the defect.
  //
  // AND THE CAUSE IS THE LINE THAT WAS NEVER HERE. Everything below selects the conversation --
  // the id, the messages, the scroll pins, the folded replies -- and NOTHING moved the screen.
  // On the chat that is invisible, because the screen is already the chat and the new messages
  // simply appear. On the home the state changed under a screen that does not draw it, so the
  // application had faithfully opened a conversation the reader could not see. Pressing «محادثة
  // جديدة» first worked only because startChatFromMenu carries a setScreen('chat') of its own --
  // which is the tell, and the reason the owner had found that workaround.
  //
  // ONE LINE, AND IT IS PUT WHERE EVERY DOOR PASSES. The drawer's row, the drawer's search
  // result and the favourites sheet all reach a saved conversation through this function, so a
  // navigation added here needs no call site to change -- and three guards pin those call sites
  // byte for byte (chat-history-guard on the row, chat-ux-guard on both closeDrawerWith forms,
  // theme-coverage on openFavoriteChat's whole body), which a second argument would have broken.
  //
  // IT DOES NOT FIGHT THE HISTORY. closeDrawerWith spends the menu's own entry FIRST and runs
  // this afterwards, so the screen set here is the last word on the drawer's path. On the
  // favourites path openFavoriteChat calls goEzikBack() immediately after this returns, and that
  // pop resolves the destination as it always did -- so that sheet behaves exactly as it does
  // today, which is measured rather than assumed.
  //
  // NOTHING IS CLEARED AND NO NEW CONVERSATION IS OPENED: resetThread and newChat are untouched,
  // and «محادثة جديدة» keeps its own route, character for character.
  const openSavedChat = (id) => {
    try { abortRef.current?.abort(); } catch (e) {}
    abortRef.current = null;
    cancelAudio();
    setScreen('chat');
    chatIdRef.current = id;`;

const c = s.split(find).length - 1;
if (c !== 1) throw new Error('anchor occurs ' + c + ' times');
s = s.replace(find, replace);
fs.writeFileSync(P, s, 'utf8');
console.log('applied; chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
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

## `b2-defect12.cjs`

```js
'use strict';
// BATCH B, ITEM 2, THE CLAUSE THAT MUST STILL HOLD (§2-5): defect 12's repair stays.
// The reader now reaches a group only by CHOOSING it from the catalogue -- so this walks
// that way in and checks the section's name is still drawn above the group's name.
// It also records the catalogue's group order, because §2-3 forbids changing it.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const SHOTS = path.join(OUT, 'shots-b2d12');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const out = { at: new Date().toISOString() };
const FILE = path.join(OUT, 'b2-defect12.json');

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
    await page.locator('[data-ezik-home-module="adhkar"]').first().click();
    await R.settle(page, 9000); await page.waitForTimeout(3000);
    const cat = await R.sig(page);
    out.catalogueHead = cat.text.slice(0, 220);
    // THE ORDER OF THE GROUPS, as the catalogue draws them, so §2-3 can be checked.
    out.groupOrder = cat.text.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
    await R.shot(page, SHOTS, 'b2-catalogue');

    // choose a group -- the evening one, which is the group the clock used to force
    const target = 'أذكار المساء';
    const btn = page.getByRole('button', { name: new RegExp(target) });
    out.groupFound = await btn.count();
    if (out.groupFound) { await btn.first().click({ timeout: 8000 }); await page.waitForTimeout(2600); }
    const rd = await R.sig(page);
    out.readerHead = rd.text.slice(0, 140);
    out.sectionNameAbove = rd.text.slice(0, 60).indexOf(AR['module.adhkar']) >= 0;
    out.groupNameShown = rd.text.slice(0, 90).indexOf(target) >= 0;
    out.sectionBeforeGroup = out.sectionNameAbove && out.groupNameShown
      && rd.text.indexOf(AR['module.adhkar']) < rd.text.indexOf(target);
    await R.shot(page, SHOTS, 'b2-reader');
    R.say('catalogue order:', JSON.stringify(out.groupOrder.length) + ' rows');
    R.say('sectionNameAbove =', out.sectionNameAbove, ' groupNameShown =', out.groupNameShown,
      ' sectionBeforeGroup =', out.sectionBeforeGroup);
    await ctx.close();
  } catch (e) { out.error = String(e && e.message).slice(0, 200); R.say('ERR', out.error); }
  finally { await browser.close(); srv.close(); fs.writeFileSync(FILE, JSON.stringify(out, null, 2)); }
  R.say('WROTE', FILE);
})();
```

## `b3-after-back.cjs`

```js
'use strict';
// BATCH B, ITEM 3 -- THE TWO CLAUSES THAT MUST SURVIVE (§3-ب-٤ and §3-ب-٥):
//   * the back button after opening an old conversation returns the reader to where he
//     was, and does NOT jump out of the application;
//   * the item-14 restore still works.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const SHOTS = path.join(OUT, 'shots-b3back');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const src = fs.readFileSync(path.join(TREE, 'app.jsx'), 'utf8');
const idxKey = (/const EZIK_CHATS_KEY = '([^']+)'/.exec(src) || [])[1];
const prefix = (/const EZIK_CHAT_PREFIX = '([^']+)'/.exec(src) || [])[1];
const out = { at: new Date().toISOString(), idxKey, prefix, cases: [] };
const FILE = path.join(OUT, 'b3-after-back.json');
const save = () => fs.writeFileSync(FILE, JSON.stringify(out, null, 2));
const onShelf = (t) => t.indexOf(AR['module.fatwa']) >= 0 && t.indexOf(AR['module.lessons']) >= 0
  && t.indexOf(AR['module.mushaf']) >= 0 && t.indexOf(AR['module.fatwa.sub']) < 0;

async function seed(page, keys) {
  return page.evaluate((a) => {
    let pk = 'anon';
    try {
      const p = JSON.parse(localStorage.getItem('child_profile') || 'null');
      if (p && typeof p.pid === 'string' && p.pid) pk = p.pid;
    } catch (e) {}
    const now = Date.now();
    localStorage.setItem(a.idxKey, JSON.stringify([
      { id: 'seed_a', pk: pk, title: 'BENCH-CHAT-ALPHA', pinned: false, at: now - 90000 },
    ]));
    localStorage.setItem(a.prefix + 'seed_a', JSON.stringify(
      [{ role: 'user', content: 'BENCH-Q-ALPHA' }, { role: 'assistant', content: 'BENCH-A-ALPHA' }]));
    return pk;
  }, keys);
}

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  try {
    // -- 1. the back route after opening an old conversation FROM THE HOME ----
    {
      const rec = { id: 'back-after-open-from-home' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
      await R.installRoutes(ctx, 'rows', null, []);
      const page = await ctx.newPage();
      await R.enter(page, AR, D.lit, base);
      await seed(page, { idxKey, prefix });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
      await R.settle(page, 9000); await page.waitForTimeout(2600);
      await R.toHome(page, AR);
      rec.startedOnShelf = onShelf((await R.sig(page)).text);
      for (const k of ['navigation.openMenu', 'navigation.menu']) {
        const m = page.getByRole('button', { name: AR[k], exact: true });
        if (await m.count()) { await m.first().click(); break; }
      }
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: /BENCH-CHAT-ALPHA/ }).first().click({ timeout: 6000 });
      await page.waitForTimeout(2600);
      const inChat = await R.sig(page);
      rec.bodyOnScreen = inChat.text.indexOf('BENCH-A-ALPHA') >= 0;
      rec.shot = await R.shot(page, SHOTS, 'b3-in-chat');
      // NOW THE BACK, by the browser's own button, which is the one that can leave the app
      await page.goBack({ timeout: 9000 });
      await page.waitForTimeout(2600);
      const back = await R.sig(page);
      rec.afterBackWhere = whereAmI(back.text, AR);
      rec.afterBackOnShelf = onShelf(back.text);
      rec.leftTheApp = back.url.indexOf(base) !== 0 || back.textLen < 20;
      rec.afterBackHead = back.text.slice(0, 90);
      rec.shot2 = await R.shot(page, SHOTS, 'b3-after-back');
      out.cases.push(rec); save();
      R.say(' back-from-home: body=' + rec.bodyOnScreen + ' afterBack=' + rec.afterBackWhere
        + ' onShelf=' + rec.afterBackOnShelf + ' leftTheApp=' + rec.leftTheApp);
      await ctx.close();
    }

    // -- 2. item 14 still restores ------------------------------------------
    {
      const rec = { id: 'item14-still-restores' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
      await R.installRoutes(ctx, 'rows', null, []);
      const page = await ctx.newPage();
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      await page.locator('[data-ezik-home-module="lessons"]').first().click();
      await R.settle(page, 9000); await page.waitForTimeout(2400);
      const before = await R.sig(page);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
      await R.settle(page, 9000); await page.waitForTimeout(3000);
      const after = await R.sig(page);
      rec.restored = after.text.slice(0, 50) === before.text.slice(0, 50);
      rec.afterWhere = whereAmI(after.text, AR);
      rec.shot = await R.shot(page, SHOTS, 'b3-item14');
      out.cases.push(rec); save();
      R.say(' item14: restored=' + rec.restored + ' where=' + rec.afterWhere);
      await ctx.close();
    }

    // -- 3. and a FIRST opening still lands on the chat ----------------------
    {
      const rec = { id: 'first-open-still-chat' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
      await R.installRoutes(ctx, 'rows', null, []);
      const page = await ctx.newPage();
      await R.enter(page, AR, D.lit, base);
      await page.waitForTimeout(2200);
      const s = await R.sig(page);
      rec.where = whereAmI(s.text, AR);
      rec.landsOnChat = rec.where === 'chat';
      rec.shot = await R.shot(page, SHOTS, 'b3-first-open');
      out.cases.push(rec); save();
      R.say(' first-open: where=' + rec.where + ' landsOnChat=' + rec.landsOnChat);
      await ctx.close();
    }
  } catch (e) { out.error = String(e && e.message).slice(0, 200); R.say('ERR', out.error); }
  finally { await browser.close(); srv.close(); save(); }
  R.say('WROTE', FILE);
})();
```

## `b3-ladder.cjs`

```js
'use strict';
// BATCH B, ITEM 3, §3-ب-٤ IN FULL. The clause is that the back after opening an old
// conversation returns the reader to where he was and does not jump out of the app.
// One press was not enough to characterise it, so this walks the whole ladder: open
// the conversation from the HOME, then press back up to three times, recording where
// each press lands. Run against both builds, the difference is the only thing that can
// be laid at this repair's door.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');
const { whereAmI } = require('./where.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const TAG = process.argv[4] || 'x';
const SHOTS = path.join(OUT, 'shots-b3ladder-' + TAG);
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;
const src = fs.readFileSync(path.join(TREE, 'app.jsx'), 'utf8');
const idxKey = (/const EZIK_CHATS_KEY = '([^']+)'/.exec(src) || [])[1];
const prefix = (/const EZIK_CHAT_PREFIX = '([^']+)'/.exec(src) || [])[1];
const out = { at: new Date().toISOString(), tag: TAG, tree: TREE, steps: [] };
const FILE = path.join(OUT, 'b3-ladder-' + TAG + '.json');
const onShelf = (t) => t.indexOf(AR['module.fatwa']) >= 0 && t.indexOf(AR['module.lessons']) >= 0
  && t.indexOf(AR['module.mushaf']) >= 0 && t.indexOf(AR['module.fatwa.sub']) < 0;
const place = (s) => (onShelf(s.text) ? 'the shelf'
  : (s.text.indexOf('BENCH-A-ALPHA') >= 0 ? 'the conversation' : whereAmI(s.text, AR)));

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', serviceWorkers: 'block' });
    await R.installRoutes(ctx, 'rows', null, []);
    const page = await ctx.newPage();
    await R.enter(page, AR, D.lit, base);
    await page.evaluate((a) => {
      let pk = 'anon';
      try {
        const p = JSON.parse(localStorage.getItem('child_profile') || 'null');
        if (p && typeof p.pid === 'string' && p.pid) pk = p.pid;
      } catch (e) {}
      localStorage.setItem(a.idxKey, JSON.stringify([
        { id: 'seed_a', pk: pk, title: 'BENCH-CHAT-ALPHA', pinned: false, at: Date.now() - 90000 }]));
      localStorage.setItem(a.prefix + 'seed_a', JSON.stringify(
        [{ role: 'user', content: 'BENCH-Q-ALPHA' }, { role: 'assistant', content: 'BENCH-A-ALPHA' }]));
    }, { idxKey, prefix });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
    await R.settle(page, 9000); await page.waitForTimeout(2600);
    await R.toHome(page, AR);
    out.start = place(await R.sig(page));
    for (const k of ['navigation.openMenu', 'navigation.menu']) {
      const m = page.getByRole('button', { name: AR[k], exact: true });
      if (await m.count()) { await m.first().click(); break; }
    }
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /BENCH-CHAT-ALPHA/ }).first().click({ timeout: 6000 });
    await page.waitForTimeout(2600);
    out.afterPress = place(await R.sig(page));
    await R.shot(page, SHOTS, 'ladder-' + TAG + '-0');
    for (let i = 1; i <= 3; i++) {
      let threw = false;
      try { await page.goBack({ timeout: 9000 }); } catch (e) { threw = true; }
      await page.waitForTimeout(2400);
      const s = await R.sig(page);
      const step = { press: i, landed: place(s), url: s.url.replace(base, '/'), threw,
        leftTheApp: s.url.indexOf(base) !== 0 || s.textLen < 20 };
      out.steps.push(step);
      await R.shot(page, SHOTS, 'ladder-' + TAG + '-' + i);
      R.say('  press ' + i + ' -> ' + step.landed + (step.leftTheApp ? ' [LEFT THE APP]' : ''));
      if (step.leftTheApp) break;
    }
    R.say('start=' + out.start + ' afterPress=' + out.afterPress);
    await ctx.close();
  } catch (e) { out.error = String(e && e.message).slice(0, 200); R.say('ERR', out.error); }
  finally { await browser.close(); srv.close(); fs.writeFileSync(FILE, JSON.stringify(out, null, 2)); }
  R.say('WROTE', FILE);
})();
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
