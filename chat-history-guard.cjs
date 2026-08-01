// chat-history-guard.cjs — S92, the saved-conversations gate.
//
// It proves the feature the same way runtime-gate proves the mount: by RUNNING the shipped code.
// The text/babel block is extracted from index.html, transformed with the page's own pinned Babel
// major, and evaluated inside a linkedom window against a localStorage stub this file controls —
// so the functions under test are literally the ones the browser runs, not a copy of them.
//
// Three parts, and each answers one of the things that had to be true:
//   A. THE STORE   — the empty chat is never filed, the first question files one, a reload returns
//                    it verbatim (source cards included), pinning orders it first, deleting removes
//                    it, and one profile can never read another's.
//   B. THE BOOT    — an app opened with a profile AND a stored history lands on an EMPTY thread,
//                    and the one legacy thread is migrated rather than restored.
//   C. THE WIRING  — read off index.html: one and only one «محادثة جديدة» entry, the menu
//                    registered as a back layer, and the back resolver asking the layer registry
//                    on root screens too, which is what makes the device button close it first.
//
// ONE LIVE CONTEXT AT A TIME — this is a hard rule, not a style choice. linkedom's window is a
// Proxy, and creating a second one makes an EARLIER vm context resolve bare `localStorage` to the
// NEWER window's stub (measured: context A reads store B the moment B exists). A test that kept
// using an old handle would then assert against the wrong store and pass while proving nothing.
// So every group builds its context, finishes with it, and never touches it again — and stale()
// below turns a slip back into a visible failure instead of a silent false pass.
//
// Usage: node chat-history-guard.cjs [htmlFile]   (default: index.html)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(htmlFile, 'utf8');

let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
// Cross-realm values come back from the vm as foreign objects; compare them as plain data.
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Extract + transform, exactly as runtime-gate does (same pinned-major rule).
// ---------------------------------------------------------------------------
const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const m = openRe.exec(html);
if (!m) { console.error('No text/babel script block found in ' + htmlFile); process.exit(2); }
const rawCode = html.slice(m.index + m[0].length, html.indexOf('</script>', m.index + m[0].length));

const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8;
const jsxRuntime = babelMajor >= 8 ? 'automatic' : 'classic';

let transformed;
try {
  transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    sourceType: 'script',
    retainLines: true,
  }).code;
} catch (e) {
  console.log('TRANSFORM ERROR (should have been caught by babel-gate):\n' + e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A localStorage we can seed, read back and starve. `quota` is the byte ceiling
// the stub refuses to write past — a real store's QuotaExceededError, which a
// thread carrying a photo genuinely reaches.
// ---------------------------------------------------------------------------
function makeStore(seed) {
  const data = Object.assign({}, seed || {});
  const size = () => { let t = 0; for (const k in data) t += k.length + data[k].length; return t; };
  const store = {
    quota: Infinity,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => {
      const prev = Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      data[k] = String(v);
      if (size() > store.quota) {
        if (prev === null) delete data[k]; else data[k] = prev;
        const err = new Error('QuotaExceededError'); err.name = 'QuotaExceededError'; throw err;
      }
    },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k in data) delete data[k]; },
    _size: size,
    _dump: () => plain(data),
    _keys: () => Object.keys(data),
  };
  return store;
}

let liveGen = 0;
// `mount` is off by default: evaluating the block ends in ReactDOM.createRoot().render(), and a
// store test has no use for a mounted app — only part B does. Stubbing the root keeps every other
// group down to the module scope it actually exercises.
function buildContext(seed, mount) {
  const gen = ++liveGen;
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.window = window.window || window;
  window.globalThis = window.globalThis || window;
  window.matchMedia = window.matchMedia || function () {
    return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.scrollTo = window.scrollTo || function () {};
  // linkedom has no layout, so no element carries scrollIntoView — the chat's scroll-to-bottom
  // effect calls it on every message change and would throw before a single assertion ran.
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  // linkedom exposes crypto as a getter-only property; the app only wants getRandomValues.
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  const store = makeStore(seed);
  window.localStorage = store;
  window.alert = function () {};
  window.confirm = function () { return true; };
  // A real back/forward stack, so the device back button can actually be pressed in part B.
  // pushState/replaceState/back are the three the app uses, and back() fires popstate on a later
  // task exactly as a browser does — which is what the menu's closer is timed against.
  try {
    const entries = [{}];
    let at = 0;
    window.history = {
      get length() { return entries.length; },
      get state() { return entries[at]; },
      pushState: (s) => { entries.splice(at + 1); entries.push(s); at = entries.length - 1; },
      replaceState: (s) => { entries[at] = s; },
      back: () => {
        if (at <= 0) return;
        at--;
        setTimeout(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0);
      },
      _depth: () => at,
    };
  } catch (e) { /* getter-only in this DOM: the back-button group reports itself skipped */ }
  global.navigator = window.navigator;
  global.window = window;
  global.document = window.document;

  const ctx = vm.createContext(window);
  const loadUMD = (file) => vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', file), 'utf8'), ctx, { filename: file });
  loadUMD('react.umd.js');
  loadUMD('react-dom.umd.js');
  if (!window.React || !window.ReactDOM) { console.log('FAIL: React/ReactDOM globals did not load.'); process.exit(1); }
  if (!mount) vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);

  let caught = null;
  window.addEventListener('error', (ev) => { caught = ev.error || ev.message; });
  window.console.error = () => {};

  try {
    vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });
  } catch (e) {
    console.log('RUNTIME ERROR evaluating the app block:\n' + String(e && e.stack ? e.stack : e));
    process.exit(1);
  }
  // Top-level `const`/`function` from a vm script live in the context's global lexical scope, so a
  // later script in the SAME context can see them. This is how the shipped helpers are reached.
  const rawApi = vm.runInContext(
    '({ save: ezikSaveChat, index: ezikReadChatIndex, list: ezikListChats, read: ezikReadChatMessages,' +
    '   del: ezikDeleteChat, pin: ezikToggleChatPin, clear: ezikClearAllChats, migrate: ezikMigrateLegacyThread,' +
    '   title: ezikChatTitle, pkey: ezikProfileKey, mint: ezikMintId, text: ezikMessageText,' +
    '   transcript: ezikProfileTranscript,' +
    '   PREFIX: EZIK_CHAT_PREFIX, INDEX_KEY: EZIK_CHATS_KEY, MAX: EZIK_CHATS_MAX, TITLE_MAX: EZIK_CHAT_TITLE_MAX })',
    ctx, { filename: 'chat-history-guard-api' });

  // The tripwire for the one-live-context rule described at the top of this file.
  const stale = () => { throw new Error('chat-history-guard: context ' + gen + ' was used after context ' + liveGen + ' replaced it'); };
  const api = {};
  Object.keys(rawApi).forEach((k) => {
    const v = rawApi[k];
    api[k] = (typeof v === 'function')
      ? function () { if (gen !== liveGen) stale(); return v.apply(null, arguments); }
      : v;
  });
  const guardedStore = {};
  Object.keys(store).forEach((k) => {
    const v = store[k];
    guardedStore[k] = (typeof v === 'function')
      ? function () { if (gen !== liveGen) stale(); return v.apply(store, arguments); }
      : v;
  });
  guardedStore.setQuota = (n) => { if (gen !== liveGen) stale(); store.quota = n; };

  return { window, ctx, store: guardedStore, api, err: () => caught };
}

// ===========================================================================
// PART A — the store
// ===========================================================================
console.log('\n=== A. THE STORE (the shipped functions, run for real) ===');

// --- A1: what gets filed, what it is called, and what comes back -----------
let snapshotAfterA1 = null;
let a1 = { id: null, thread: null, pk: 'profile-A' };
{
  const { store, api } = buildContext({});
  const PA = a1.pk;

  ok('an empty thread files nothing', api.save(null, [], PA) === null);
  ok('a greeting-only thread files nothing (no question in it)',
    api.save(null, [{ role: 'assistant', content: 'السلام عليكم' }], PA) === null);
  ok('a null thread files nothing', api.save(null, null, PA) === null);
  eq('...and the index is still empty after all three', api.index().length, 0);
  eq('...and the store holds no conversation key at all',
    store._keys().filter((k) => k.indexOf('ezik_chat') === 0).length, 0);

  const q1 = 'ما حكم صيام يوم عرفة لغير الحاج؟';
  const id1 = api.save(null, [
    { role: 'assistant', content: 'السلام عليكم' },
    { role: 'user', content: q1 },
  ], PA);
  ok('the first question files a conversation', typeof id1 === 'string' && !!id1);
  eq('...one row in the index', api.index().length, 1);
  eq('...titled from the first QUESTION, not from the greeting', api.index()[0].title, q1);
  eq('...filed under the asking profile', api.index()[0].pk, PA);
  eq('...and not pinned by default', api.index()[0].pinned, false);

  const longQ = 'أريد أن أعرف كيف أرتب وقتي بين الدراسة وحفظ القرآن الكريم في الإجازة الصيفية';
  const idLong = api.save(null, [{ role: 'user', content: longQ }], PA);
  const tLong = api.index().filter((r) => r.id === idLong)[0].title;
  ok('a long title is cut to the limit', tLong.length <= api.TITLE_MAX + 1, 'got ' + tLong.length + ': ' + tLong);
  ok('...and is marked as cut', tLong.slice(-1) === '…', tLong);
  ok('...and never ends mid-word', longQ.indexOf(tLong.slice(0, -1).trim()) === 0, tLong);

  const reply = 'صيامُ يوم عرفة لغير الحاج سنّةٌ مؤكّدة.';
  const id1b = api.save(id1, [
    { role: 'assistant', content: 'السلام عليكم' },
    { role: 'user', content: q1 },
    { role: 'assistant', content: reply },
  ], PA);
  eq('a later turn keeps the same conversation id', id1b, id1);
  eq('...and does not add a second row', api.index().length, 2);
  eq('...and does not rename the conversation', api.index().filter((r) => r.id === id1)[0].title, q1);

  // RESTORE, VERBATIM, WITH THE SOURCE CARDS. A card is rendered from the reply TEXT (SourceCard
  // parses it at render time), so the proof that cards survive a reload is that the stored reply
  // comes back byte-identical, markers and all — and that an attachment turn keeps its block.
  const cardReply = reply + '\n[[source:binbaz|https://binbaz.org.sa/fatwas/1234|صيام عرفة]]\n' +
                            '[[source:islamqa|https://islamqa.info/ar/answers/5678|فضل يوم عرفة]]';
  const attachTurn = {
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgoAAAANS' } },
      { type: 'text', text: 'اشرح لي هذا' },
    ],
    timestamp: '2026-07-30T10:00:00.000Z',
  };
  const richThread = [
    { role: 'user', content: q1, timestamp: '2026-07-30T09:59:00.000Z' },
    { role: 'assistant', content: cardReply, timestamp: '2026-07-30T09:59:20.000Z' },
    attachTurn,
  ];
  api.save(id1, richThread, PA);
  const restored = api.read(id1);
  eq('the thread is stored verbatim', plain(restored), richThread);
  ok('...including BOTH source-card markers in the reply',
    (restored[1].content.match(/\[\[source:/g) || []).length === 2);
  ok('...and the attachment block with its data', restored[2].content[0].source.data === 'iVBORw0KGgoAAAANS');
  ok('...and every timestamp', restored[2].timestamp === attachTurn.timestamp);
  eq('an attachment turn is titled by its TEXT part, never by its base64',
    api.title([attachTurn]), 'اشرح لي هذا');

  a1.id = id1;
  a1.thread = richThread;
  snapshotAfterA1 = store._dump();
}

// --- A2: closing the app and coming back -----------------------------------
// Nothing is held in memory: a BRAND NEW app, reading the store the last one left behind, must
// see the same history. That is what "close the app and open it again" is.
{
  console.log('\n--- closing the app and opening it again ---');
  const { api } = buildContext(snapshotAfterA1);
  eq('the conversations are still there', api.list(a1.pk).length, 2);
  eq('...and the open one still has its title', api.list(a1.pk).filter((r) => r.id === a1.id).length, 1);
  eq('...and its messages, source cards and attachment included', plain(api.read(a1.id)), a1.thread);
}

// --- A3: pinning, deleting, and profile isolation ---------------------------
{
  console.log('\n--- pinning, deleting, isolation ---');
  const { store, api } = buildContext({});
  const PA = 'profile-A';
  const PB = 'profile-B';

  const idOld = api.save(null, [{ role: 'user', content: 'سؤال قديم' }], PA);
  const idMid = api.save(null, [{ role: 'user', content: 'سؤال أوسط' }], PA);
  const idNew = api.save(null, [{ role: 'user', content: 'سؤال جديد' }], PA);
  eq('unpinned, the newest conversation is first', api.list(PA)[0].id, idNew);

  api.pin(idOld);
  eq('pinning is stored', api.index().filter((r) => r.id === idOld)[0].pinned, true);
  eq('a pinned conversation is shown FIRST, ahead of newer ones', api.list(PA)[0].id, idOld);
  eq('...and the rest keep most-recent order behind it',
    api.list(PA).slice(1).map((r) => r.id), [idNew, idMid]);
  api.pin(idMid);
  eq('two pinned conversations both sit ahead of the unpinned one',
    api.list(PA).map((r) => r.id).indexOf(idNew), 2);
  api.pin(idOld);
  eq('unpinning is stored', api.index().filter((r) => r.id === idOld)[0].pinned, false);
  eq('...and it drops back into the recent order', api.list(PA).map((r) => r.id), [idMid, idNew, idOld]);

  api.del(idNew);
  eq('deleting removes the row', api.list(PA).map((r) => r.id), [idMid, idOld]);
  eq('...and the body with it', store.getItem(api.PREFIX + idNew), null);
  eq('...and leaves the others readable', plain(api.read(idOld)), [{ role: 'user', content: 'سؤال قديم' }]);
  api.del(idMid);
  eq('deleting a PINNED conversation works too', api.list(PA).map((r) => r.id), [idOld]);

  const idB = api.save(null, [{ role: 'user', content: 'سؤال يخص الملف الثاني' }], PB);
  eq('a second profile sees ONLY its own conversation', api.list(PB).map((r) => r.id), [idB]);
  eq('...and the first profile never sees it', api.list(PA).map((r) => r.id), [idOld]);
  ok('...and no list can contain a foreign row',
    api.list(PA).every((r) => r.pk === PA) && api.list(PB).every((r) => r.pk === PB));
  eq('a profile with no id is its own bucket, not everyone\'s', api.pkey(null), 'anon');
  eq('...and the profile key is the STORED pid, never anything derived from a name',
    api.pkey({ name: 'x', birthYear: 2017, pid: 'pid-9' }), 'pid-9');
  eq('...so two profiles that share a name still separate',
    api.pkey({ name: 'أحمد', pid: 'a' }) === api.pkey({ name: 'أحمد', pid: 'b' }), false);

  const bodyKeys = () => store._keys().filter((k) => k.indexOf(api.PREFIX) === 0);
  ok('bodies exist before the reset', bodyKeys().length > 0);
  api.clear();
  eq('«حذف كل البيانات» removes the index', store.getItem(api.INDEX_KEY), null);
  eq('...and every stored body', bodyKeys().length, 0);
  eq('...so every profile\'s menu is empty', api.list(PA).length + api.list(PB).length, 0);
}

// --- A4: the one legacy thread ----------------------------------------------
{
  console.log('\n--- the single legacy thread ---');
  const legacy = [
    { role: 'user', content: 'سؤالي القديم قبل التحديث' },
    { role: 'assistant', content: 'جواب قديم' },
  ];
  const { store, api } = buildContext({ messages: JSON.stringify(legacy) });
  api.migrate('P1');
  eq('the old single thread becomes a saved conversation', api.list('P1').length, 1);
  eq('...titled from its own first question', api.list('P1')[0].title, 'سؤالي القديم قبل التحديث');
  eq('...with its messages intact', plain(api.read(api.list('P1')[0].id)), legacy);
  eq('...and the legacy key is consumed', store.getItem('messages'), null);
  api.migrate('P1');
  eq('the migration cannot run twice', api.list('P1').length, 1);
}
{
  const { store, api } = buildContext({ messages: JSON.stringify([{ role: 'assistant', content: 'مرحبا' }]) });
  api.migrate('P1');
  eq('a legacy thread with no question files nothing', api.list('P1').length, 0);
  eq('...but the key still goes', store.getItem('messages'), null);
}

// --- A5: the parents' log ----------------------------------------------------
// The chat opens empty now, so the parental dashboard can no longer read the thread on screen —
// it reads the SAVED conversations. It must still show everything the child said, in the order
// they were said, and still nothing another profile said. Seeded with explicit timestamps so the
// ordering is decided by the data and not by how fast the test happens to run.
{
  console.log('\n--- the parents\' log ---');
  const { api } = buildContext({
    ezik_chats_v1: JSON.stringify([
      { id: 'B2', pk: 'PA', title: 'الأحدث', pinned: false, at: 3000 },
      { id: 'B1', pk: 'PA', title: 'الأقدم', pinned: true, at: 1000 },
      { id: 'BX', pk: 'PB', title: 'ملف آخر', pinned: false, at: 2000 },
    ]),
    ezik_chat_v1_B1: JSON.stringify([{ role: 'user', content: 'س١' }, { role: 'assistant', content: 'ج١' }]),
    ezik_chat_v1_B2: JSON.stringify([{ role: 'user', content: 'س٢' }, { role: 'assistant', content: 'ج٢' }]),
    ezik_chat_v1_BX: JSON.stringify([{ role: 'user', content: 'سرّ الملف الآخر' }]),
  });
  eq('the log is every conversation of that profile, oldest first, whatever the menu order is',
    api.transcript('PA').map((m) => m.content), ['س١', 'ج١', 'س٢', 'ج٢']);
  eq('...and pinning, which reorders the MENU, does not reorder the LOG',
    api.list('PA').map((r) => r.id), ['B1', 'B2']);
  eq('...it never contains another profile\'s messages',
    api.transcript('PB').map((m) => m.content), ['سرّ الملف الآخر']);
  eq('...and an unknown profile has an empty log', api.transcript('nobody').length, 0);
}

// --- A6: a full store --------------------------------------------------------
{
  console.log('\n--- a full store ---');
  const { store, api } = buildContext({});
  const body = (n) => [{ role: 'user', content: 'س'.repeat(n) }];
  const idKeep = api.save(null, body(300), 'P1');
  api.pin(idKeep);
  const idDrop = api.save(null, body(300), 'P1');
  // Room for one more body only if an existing one goes: the new thread is bigger than the space
  // left, and smaller than the space left plus the unpinned body sitting in the way.
  store.setQuota(store._size() + 400);
  const idNew = api.save(null, body(600), 'P1');
  ok('a conversation still files when the store is full', typeof idNew === 'string' && !!idNew);
  ok('...and its messages are readable', api.read(idNew).length === 1);
  ok('...the PINNED conversation is never the one evicted', store.getItem(api.PREFIX + idKeep) !== null);
  eq('...an unpinned older one is', store.getItem(api.PREFIX + idDrop), null);
  ok('...and the index never lists a body that is gone',
    api.index().every((r) => store.getItem(api.PREFIX + r.id) !== null),
    JSON.stringify(api.index().map((r) => r.id)));

  // And when even evicting everything unpinned is not enough, the chat carries on UNSAVED rather
  // than filing a row whose body was never written.
  const before = api.index().length;
  store.setQuota(store._size() + 10);
  eq('a store too full for any eviction to help files nothing', api.save(null, body(4000), 'P1'), null);
  eq('...and leaves the index exactly as it was', api.index().length, before);
}

// ===========================================================================
// PART B — the boot
// ===========================================================================
console.log('\n=== B. THE BOOT (the real app, mounted) ===');
const savedQuestion = 'سؤالٌ محفوظٌ من جلسةٍ سابقة';
const legacyQuestion = 'سؤالٌ كان مفتوحاً وقت التحديث';
const bootDone = new Promise((resolve) => {
  const profile = { name: 'سلمى', age: 9, gender: 'female', birthYear: 2017, pid: 'PID-SALMA', createdAt: '2026-01-01T00:00:00.000Z' };
  const seed = {
    child_profile: JSON.stringify(profile),
    disclosureAck: '1',
    ezik_chats_v1: JSON.stringify([{ id: 'C1', pk: 'PID-SALMA', title: savedQuestion, pinned: false, at: 1000 }]),
    ezik_chat_v1_C1: JSON.stringify([{ role: 'user', content: savedQuestion }, { role: 'assistant', content: 'جوابٌ محفوظ' }]),
    messages: JSON.stringify([{ role: 'user', content: legacyQuestion }, { role: 'assistant', content: 'جوابٌ قديم' }]),
  };
  const { window, store, api, err } = buildContext(seed, true);
  setTimeout(() => {
    const e = err();
    if (e) { ok('the app mounts with a stored profile and a stored history', false, String(e && e.stack ? e.stack : e)); return resolve(); }
    const root = window.document.getElementById('root');
    const txt = root ? String(root.textContent || '') : '';
    ok('the app mounts with a stored profile and a stored history', !!root && root.childNodes.length > 0);
    ok('...and lands on the chat', txt.indexOf('عزك ذكاءٌ اصطناعيّ') !== -1, txt.slice(0, 200));
    // The seeded store contains exactly four message texts. NONE of them may reach the screen —
    // that is the whole of "the app opens on a new, empty chat", stated so that restoring any
    // conversation, by any route, trips it.
    const seeded = [savedQuestion, 'جوابٌ محفوظ', legacyQuestion, 'جوابٌ قديم'];
    const leaked = seeded.filter((t) => txt.indexOf(t) !== -1);
    ok('the thread it opens is EMPTY — no stored message reaches the screen',
      leaked.length === 0, 'leaked: ' + JSON.stringify(leaked));
    eq('the boot migrates the legacy key away', store.getItem('messages'), null);
    eq('...into this profile\'s history, beside what was already there', api.list('PID-SALMA').length, 2);
    ok('...and files NOTHING for the empty thread it opened on',
      api.index().every((r) => r.title !== 'محادثة'), JSON.stringify(api.index().map((r) => r.title)));
    eq('another profile\'s menu is empty on the very same device', api.list('SOMEONE-ELSE').length, 0);
    driveTheMenu(window, store, api).then(resolve, (e) => {
      ok('driving the menu', false, String(e && e.stack ? e.stack : e));
      resolve();
    });
  }, 400);
});

// --- the menu, driven by real clicks ---------------------------------------
// Everything above reads the markup or calls the store directly. This part PRESSES the thing: it
// opens the menu the way a child does, reads the rows React actually rendered, deletes one through
// its confirmation, and then presses the device back button. A render error inside the menu, a row
// that never draws, a confirm that deletes without asking or a back press that walks out of the
// app instead of closing the menu all surface here and nowhere else.
function tick(ms) { return new Promise((r) => setTimeout(r, ms || 40)); }
async function driveTheMenu(window, store, api) {
  console.log('\n--- the menu, driven by real clicks ---');
  const doc = window.document;
  const root = doc.getElementById('root');
  const all = (sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  const byLabel = (label) => all('button').filter((b) => b.getAttribute('aria-label') === label)[0];
  const byText = (t) => all('button').filter((b) => String(b.textContent || '').trim() === t)[0];
  const click = async (el) => {
    if (!el) throw new Error('nothing to click');
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
  };
  const text = () => String(root.textContent || '');

  const opener = byLabel('فتح القائمة الجانبية');
  if (!ok('the menu button is on the chat header', !!opener)) return;
  await click(opener);

  // The seeded conversation and the migrated legacy one — both must be listed, by title.
  ok('the menu opens and lists the saved conversations',
    text().indexOf(savedQuestion) !== -1 && text().indexOf(legacyQuestion) !== -1, text().slice(0, 400));
  ok('...with «محادثة جديدة» still there, exactly once',
    (text().split('محادثة جديدة').length - 1) === 1, text().slice(0, 400));

  // Pinning reorders the menu, live.
  const titlesNow = () => all('span').map((sp) => String(sp.textContent || '').trim())
    .filter((t) => t === savedQuestion || t === legacyQuestion);
  const orderBefore = titlesNow();
  const pinButtons = all('button').filter((b) => b.getAttribute('aria-label') === 'تثبيت');
  eq('every row offers a pin', pinButtons.length, 2);
  await click(pinButtons[pinButtons.length - 1]);   // pin the LAST row
  const orderAfter = titlesNow();
  ok('pinning moves that conversation to the top of the menu, immediately',
    orderAfter[0] === orderBefore[orderBefore.length - 1] && orderAfter[0] !== orderBefore[0],
    'before ' + JSON.stringify(orderBefore) + ' after ' + JSON.stringify(orderAfter));
  ok('...and the row now offers to UNPIN', all('button').some((b) => b.getAttribute('aria-label') === 'إلغاء التثبيت'));

  // Deleting asks first, and cancelling really cancels.
  const indexBefore = api.index().length;
  await click(all('button').filter((b) => b.getAttribute('aria-label') === 'حذف')[0]);
  ok('pressing delete asks for confirmation instead of deleting', text().indexOf('حذف هذه المحادثة؟') !== -1);
  eq('...and nothing is deleted yet', api.index().length, indexBefore);
  await click(byText('إلغاء'));
  ok('cancelling puts the row back', text().indexOf('حذف هذه المحادثة؟') === -1);
  eq('...with the conversation intact', api.index().length, indexBefore);

  await click(all('button').filter((b) => b.getAttribute('aria-label') === 'حذف')[0]);
  await click(byText('حذف'));
  eq('confirming deletes exactly one conversation', api.index().length, indexBefore - 1);
  ok('...and its row leaves the menu', text().indexOf(savedQuestion) === -1 || text().indexOf(legacyQuestion) === -1);
  ok('...and the menu stays open', text().indexOf('محادثة جديدة') !== -1);

  // THE DEVICE BACK BUTTON. It must close the menu — and only the menu.
  if (typeof window.history._depth !== 'function') {
    ok('the device back button closes the menu first', false, 'no history stub available in this DOM');
    return;
  }
  ok('the open menu owns a history entry (so a press cannot leave the app)', window.history._depth() > 0);
  window.history.back();
  await tick(80);
  ok('the device back button CLOSES THE MENU', text().indexOf('محادثة جديدة') === -1, text().slice(0, 300));
  ok('...and stays on the chat', text().indexOf('عزك ذكاءٌ اصطناعيّ') !== -1);
  eq('...and spends exactly the entry the menu took', window.history._depth(), 0);

  // Opening a conversation puts its messages — and its source cards — back on the screen.
  await click(byLabel('فتح القائمة الجانبية'));
  const remaining = api.index()[0];
  const row = all('button').filter((b) => String(b.textContent || '').trim() === remaining.title)[0];
  if (!ok('the surviving conversation is still listed', !!row)) return;
  await click(row);
  await tick(60);
  ok('opening it closes the menu', text().indexOf('محادثة جديدة') === -1);
  const restored = api.read(remaining.id);
  const firstUser = restored.filter((mm) => mm.role === 'user')[0];
  ok('...and puts its messages back on the screen',
    text().indexOf(String(firstUser.content)) !== -1, text().slice(0, 400));
}

// ===========================================================================
// PART C — the wiring, read off index.html
// ===========================================================================
function partC() {
  console.log('\n=== C. THE WIRING (index.html) ===');
  const countIn = (hay, needle) => (hay.split(needle).length - 1);

  // The page writes its UI strings as \uXXXX escapes (the convention every menu entry already
  // followed), so the text searches below run against a decoded view — they then match whichever
  // form a future edit happens to leave behind, rather than silently finding nothing.
  const decoded = html.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  const drawerStart = decoded.indexOf('{drawerOpen && (');
  const drawerEnd = decoded.indexOf('{reportFor &&', drawerStart);
  if (!ok('the side menu markup is where it was', drawerStart !== -1 && drawerEnd > drawerStart)) return;
  // Comments are not menu entries: strip the JSX comment blocks before counting, or a comment
  // that merely NAMES an entry would read as a second copy of it.
  const drawer = decoded.slice(drawerStart, drawerEnd).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  // NO DUPLICATE MENU. The history is added UNDER the existing entries and repeats none of them.
  eq('exactly one «محادثة جديدة» entry in the menu', countIn(drawer, 'محادثة جديدة'), 1);
  eq('exactly one «القائمة» entry in the menu', countIn(drawer, "'القائمة'"), 1);
  eq('exactly one «المحادثات» history section', countIn(drawer, "'المحادثات'"), 1);
  eq('the menu itself is rendered once in the whole page', countIn(html, '{drawerOpen && ('), 1);
  eq('...and the history list is mapped once', countIn(html, 'chatList.map('), 1);

  // Every row carries the three actions, and delete asks first.
  ok('a row opens its conversation', drawer.indexOf('openSavedChat(c.id)') !== -1);
  ok('a row pins/unpins', drawer.indexOf('pinSavedChat(c.id)') !== -1);
  ok('a row asks before deleting', drawer.indexOf('setChatPendingDelete(c.id)') !== -1);
  ok('...and only deletes on the confirm', drawer.indexOf('deleteSavedChat(c.id)') !== -1);
  ok('...with a visible confirmation', drawer.indexOf('حذف هذه المحادثة؟') !== -1);
  ok('...that can be cancelled', drawer.indexOf('setChatPendingDelete(null)') !== -1);

  // THE DEVICE BACK BUTTON CLOSES THE MENU FIRST. Three things make that true, and each is
  // asserted, because any one of them alone is not enough: the menu must OWN a history entry
  // (the chat is a root screen and owns none of its own), the resolver must ASK the registry on
  // root screens, and every visible way out must SPEND that entry.
  ok('the menu is registered as a back layer, so it owns a history entry while open',
    /useEzikBackLayer\(drawerOpen,/.test(html));
  ok('the back resolver asks the layer registry on ROOT screens too (the chat is a root)',
    /const resolveEzikBack = \(viaPop\) => \{[\s\S]{0,1200}?if \(closeEzikNested\(\)\) \{/.test(html));
  ok('...and the old !rooted guard in front of it is gone',
    !/if \(!rooted && closeEzikNested\(\)\)/.test(html));
  ok('every way out of the menu spends that entry (closeDrawerWith)',
    html.indexOf('const closeDrawerWith = (fn) =>') !== -1);
  eq('...and no menu control closes it behind the resolver\'s back',
    countIn(drawer, 'setDrawerOpen(false)'), 0);
  ok('a half-asked delete does not survive the menu closing',
    /useEzikBackLayer\(drawerOpen, \(\) => \{[\s\S]{0,400}?setChatPendingDelete\(null\);/.test(html));

  // THE BOOT AND THE EXPLICIT ENTRY BOTH START EMPTY.
  ok('the boot no longer restores the legacy thread into the chat',
    !/const msgs = localStorage\.getItem\('messages'\);\s*\r?\n\s*if \(msgs\) setMessages/.test(html));
  ok('...it migrates it instead', html.indexOf('ezikMigrateLegacyThread(ezikProfileKey(p))') !== -1);
  ok('the explicit entry into the chat starts a new one',
    html.indexOf("onOpenChat={() => { newChat(); setScreen('chat'); }}") !== -1);
  ok('the autosave files on the QUESTION, not only after the reply',
    /setMessages\(updated\);[\s\S]{0,600}?saveMessages\(updated\);/.test(html));
  ok('persistence is on in production', /const PERSIST_CONVERSATION = true;/.test(html));
  ok('«حذف كل البيانات» clears the history too', html.indexOf('ezikClearAllChats();') !== -1);
  ok('deleting the OPEN conversation empties the thread',
    /if \(chatIdRef\.current === id\) resetThread\(\);/.test(html));
  ok('the parental dashboard reads the SAVED history, not the thread that happens to be open',
    /<ParentDashboard profile=\{profile\} messages=\{ezikProfileTranscript\(ezikProfileKey\(profileRef\.current\)\)\}/.test(html));

  // OUT OF BOUNDS — the things the brief said not to touch.
  eq('no theme variable was added or removed (two palettes, twelve names each)',
    (html.match(/--(?:red|ink|muted|line|tint|white|page|black|on-accent|accent-fill|red-deep|red-soft)\s*:/g) || []).length, 24);
  ok('the saved rows use existing variables only — no literal colour',
    !/drawer(?:Chat|Confirm|Section)[A-Za-z]*: \{[^}]*#[0-9a-fA-F]{3}/.test(html));
}

bootDone.then(() => {
  partC();
  console.log('\n' + (failures ? 'FAIL' : 'OK') + ': ' + (checks - failures) + '/' + checks + ' checks passed.');
  process.exit(failures ? 1 : 0);
});
