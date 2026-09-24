// guards/lib-nav-f-guard.cjs -- م٥ (LIB_NAV_V1): the «المكتبة» section on the client, and the book card
// under an answer that opens its page there.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٥): «… والبطاقةُ تحتَ الجواب تفتحُ صفحتَها إن كفتْ بياناتُها،
// وإلّا كُتِبَ ما ينقص». MEASURED before it was built (05-library/measure/B, D): no section existed; the
// book tag carried no book id, so no card could open anything; and BookCard's comment recorded the
// earlier design, «بطاقةُ إسنادٍ لا بابُ تصفُّح», which this item reverses behind the switch.
//
// WHAT THIS PINS (the shipped JSX, transformed and evaluated over linkedom with the vendored React):
//   F1  the server: with the switch on a library card carries bid/atom/vol/pg IN FRONT of the attributes
//       buildBookTag wrote, which stay byte for byte; a card that is no library book says bid="-";
//       api/ask.js picks that builder only under LIB_NAV_V1;
//   F2  the client parse: the four attributes, the numbers as numbers; a card without them has none;
//   F3  the card: folded, one button and no request; opened with an id and the section on, one status
//       request and a door that raises the open event with the card's place; no id → no request at all;
//       a child → no request; bid="-" → what is missing is written;
//   F4  the section from a card: the page asked with the reader's band and age; its atoms drawn; «التالي»
//       asks what follows the LAST atom shown; «السابق» asks the previous page; copy and share present;
//   F5  the section from the menu: sections → a section's books → a book (then its chapters) → a chapter's
//       page; the visible back walks one rung; a notice is said in the dictionary's words;
//   F6  App: the layer is one boolean with one history entry and a line in the ladder; the menu row is
//       drawn for an adult once a library card has been seen this session -- nothing is ever asked to
//       learn it (chat-ux-guard.cjs: the chat sends nothing while quoting and searching);
// Red on the tree before this item: `node guards/lib-nav-f-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
let failures = 0, checks = 0;
const say = console.log.bind(console);
function ok(name, cond, detail) {
  checks++;
  if (cond) { say('  PASS  ' + name); return true; }
  failures++;
  say('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 700) : ''));
  return false;
}
const done = () => { say(`\n=== lib-nav-f: ${checks - failures}/${checks} PASS ===`); process.exit(failures ? 1 : 0); };

// ── the client, booted once ─────────────────────────────────────────────────
let net = [];
let route = () => null;
function boot() {
  const { parseHTML } = require('linkedom');
  const BB = require(path.join(REPO, 'tools', 'babel-block.cjs'));
  const INDEX = path.join(REPO, 'index.html');
  const block = BB.readBabelBlock({ file: INDEX, html: fs.readFileSync(INDEX, 'utf8'), jsx: read('app.jsx') });
  const transformed = BB.transformBabelBlock(block, { retainLines: false, configFile: false, babelrc: false });
  const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
  const put = (k, v) => { try { window[k] = v; } catch (e) { /* getter-only */ } };
  for (const [k, v] of [['TextDecoder', TextDecoder], ['TextEncoder', TextEncoder], ['AbortController', AbortController], ['atob', atob]]) {
    try { if (!window[k]) put(k, v); } catch (e) {}
  }
  put('setTimeout', setTimeout); put('clearTimeout', clearTimeout); put('setInterval', setInterval); put('clearInterval', clearInterval);
  put('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  const store = new Map();
  put('localStorage', { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
  put('sessionStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  put('scrollTo', () => {});
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  const entries = [{}]; let at = 0;
  put('history', {
    get length() { return entries.length; }, get state() { return entries[at]; },
    pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
    replaceState: (st) => { entries[at] = st; },
    back: () => { if (at <= 0) return; at--; setTimeout(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0); },
  });
  put('fetch', (url, init) => {
    let body = null; try { body = JSON.parse(init && init.body || 'null'); } catch (e) { body = null; }
    net.push({ url: String(url), body });
    const reply = route(String(url), body);
    return Promise.resolve(reply
      ? { status: 200, ok: true, headers: { get: () => 'application/json' }, json: () => Promise.resolve(reply) }
      : { status: 500, ok: false, headers: { get: () => null }, json: () => Promise.resolve({}) });
  });
  if (!window.CustomEvent) {
    put('CustomEvent', function CustomEvent(type, init) { const e = new window.Event(type, init); e.detail = init && init.detail; return e; });
  }
  put('self', window); put('globalThis', window);
  global.window = window; global.document = window.document;
  try { Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true }); } catch (e) {}
  const ctx = vm.createContext(window);
  for (const file of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', file), 'utf8'), ctx, { filename: file });
  }
  vm.runInContext('var __realCreateRoot = ReactDOM.createRoot;'
    + ' ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.console.error = () => {};
  window.addEventListener('error', () => {});
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });
  vm.runInContext(`
    function __mount(el) {
      var host = document.createElement('div');
      document.body.appendChild(host);
      var root = __realCreateRoot(host);
      ReactDOM.flushSync(function () { root.render(el); });
      return { host: host, root: root };
    }
    function __press(el) {
      ReactDOM.flushSync(function () { el.dispatchEvent(new window.Event('click', { bubbles: true })); });
    }
    function __unmount(r) { ReactDOM.flushSync(function () { r.unmount(); }); }
    // The status answer is kept for the session by design; each scene here is a new session.
    function __resetLibStatus() { for (var k in ezikLibStatusAsked) delete ezikLibStatusAsked[k]; }
    function __resetSeen() { ezikLibrarySeen = false; }
    // What App does on a pop (its onPop): the entry is spent and the deepest layer closes. App itself
    // is not mounted here, so its resolver is stood in for by the two calls it makes for a layer.
    window.addEventListener('popstate', function () {
      ezikHistSpend();
      ReactDOM.flushSync(function () { ezikCloseDeepestLayer(); });
    });
  `, ctx);
  const grab = (expr) => { try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'lib-nav-f' }); } catch (e) { return undefined; } };
  return { window, ctx, grab };
}
const tick = async (n = 12) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 0)); };

async function main() {
  say('lib-nav-f guard — root ' + REPO);
  const jsx = read('app.jsx');
  const ask = read('api/ask.js');

  // ── F1 ────────────────────────────────────────────────────────────────────
  let A = null;
  try { A = await import(pathToFileURL(path.join(REPO, 'api/ask.js')).href); } catch (e) { A = null; }
  const row = { bookTitle: 'المجموع شرح المهذب', author: 'النووي', locator: 'ج١ · ص٢٧٥', text: 'قال الشافعي: أحب السواك.',
    recordId: 'lib:FC-003660:0275:001', subjectId: 'FC-003660', locatorSpan: { volume: '1', pageStart: '275', pageEnd: '275' } };
  const autoRow = { ...row, recordId: 'lib:FC-000530:0005:001', subjectId: 'FC-000530', locator: '', locatorSpan: { volume: '', pageStart: '', pageEnd: '' } };
  const encRow = { ...row, recordId: 'encyc:12', subjectId: '', locatorSpan: {} };
  const plain = A && A.buildBookTag ? A.buildBookTag(row).tag : '';
  const lib = A && A.buildLibraryBookTag ? A.buildLibraryBookTag(row).tag : '';
  ok('F1  the server: bid/atom/vol/pg in front, buildBookTag\'s attributes byte for byte; "-" for no library book; picked only under the switch',
    !!lib && plain.length > 0 && !/ bid=/.test(plain)
    && lib === plain.replace(/^<book/, '<book bid="FC-003660" atom="FC-003660:0275:001" vol="1" pg="275"')
    && A.buildLibraryBookTag(autoRow).tag.startsWith('<book bid="FC-000530" atom="FC-000530:0005:001" author=')
    && A.buildLibraryBookTag(encRow).tag.startsWith('<book bid="-" author=')
    && /pickBookCards\(out\.cited, MAX_SOURCES, libNavValue === 'on' \? buildLibraryBookTag : buildBookTag\)/.test(ask)
    && (ask.match(/buildLibraryBookTag\b/g) || []).length === 2,
    JSON.stringify({ plain: plain.slice(0, 120), lib: lib.slice(0, 160) }));

  if (!/function EzikLibrarySection\(/.test(jsx)) {
    ok('F0  the section exists in app.jsx', false);
    return done();
  }
  let B = null;
  try { B = boot(); } catch (e) { ok('F0  the client boots', false, e && e.stack); return done(); }
  const { window, grab } = B;
  const T = (k, v) => grab(`ezT(${JSON.stringify(k)}${v ? ', ' + JSON.stringify(v) : ''})`);
  const buttons = (host) => Array.prototype.slice.call(host.querySelectorAll('button'));
  const byText = (host, text) => buttons(host).find((b) => String(b.textContent || '').trim() === text);
  const press = (el) => grab('__press')(el);
  const libCalls = () => net.filter((c) => c.url === '/api/lib-nav');

  // ── F2 ────────────────────────────────────────────────────────────────────
  const matn = Buffer.from('قال الشافعي: أحب السواك.', 'utf8').toString('base64');
  const reply = (attrs) => 'جواب.\n\n<book' + attrs + ' author="النووي" ref="ج١ · ص٢٧٥" matn="' + matn + '">المجموع شرح المهذب</book>';
  const segOf = (text) => (grab('parseRichMessage')(text, 30).segments || []).find((s) => s && s.type === 'book');
  const withPlace = segOf(reply(' bid="FC-003660" atom="FC-003660:0275:001" vol="1" pg="275"'));
  const without = segOf(reply(''));
  ok('F2  the parse: bid, atom, and vol/pg as numbers; a card without them has none',
    withPlace && withPlace.bid === 'FC-003660' && withPlace.atom === 'FC-003660:0275:001' && withPlace.vol === 1 && withPlace.pg === 275
    && without && without.bid === '' && without.atom === '' && without.vol === null && without.pg === null && without.text === 'قال الشافعي: أحب السواك.',
    JSON.stringify({ withPlace, without }));

  // ── F3 ────────────────────────────────────────────────────────────────────
  const events = [];
  window.addEventListener('ezik-open-library', (e) => events.push(e.detail));
  const card = async (attrs, age, enabled) => {
    net = [];
    grab('__resetLibStatus')();
    route = (url, body) => (url === '/api/lib-nav' && body && body.op === 'status' ? { enabled } : null);
    const seg = segOf(reply(attrs));
    const kids = grab('ezikRenderSegments')([seg], { tashkeel: false, age });
    const { host } = grab('__mount')(grab('React').createElement(grab('React').Fragment, null, kids));
    await tick();
    const folded = { buttons: buttons(host).length, calls: libCalls().length };
    press(buttons(host)[0]);
    await tick();
    return { host, folded, calls: libCalls(), text: String(host.textContent || '') };
  };
  const on = await card(' bid="FC-003660" atom="FC-003660:0275:001" vol="1" pg="275"', 30, true);
  const door = byText(on.host, T('library.open'));
  if (door) press(door);
  await tick();
  const noId = await card('', 30, true);
  const child = await card(' bid="FC-003660" pg="275"', 9, true);
  const off = await card(' bid="FC-003660" pg="275"', 30, false);
  const notLib = await card(' bid="-"', 30, true);
  const noPage = await card(' bid="FC-003660"', 30, true);
  ok('F3  the card: folded, one button, no request; opened: one status request and a door with the card\'s place; no id, a child, the switch off → nothing; "-" and no page → what is missing is written',
    on.folded.buttons === 1 && on.folded.calls === 0 && on.calls.length === 1 && on.calls[0].body.op === 'status'
    && on.calls[0].body.band === 'adult' && on.calls[0].body.age === 30 && !!door
    && events.length === 1 && JSON.stringify(events[0]) === JSON.stringify({ bid: 'FC-003660', atom: 'FC-003660:0275:001', vol: 1, pg: 275 })
    && noId.calls.length === 0 && !noId.text.includes(T('library.open'))
    && child.calls.length === 0 && !child.text.includes(T('library.open'))
    && !off.text.includes(T('library.open'))
    && notLib.text.includes(T('library.notInLibrary')) && !notLib.text.includes(T('library.open'))
    && noPage.text.includes(T('library.open')) && noPage.text.includes(T('library.openNoPage')),
    JSON.stringify({ folded: on.folded, calls: on.calls.map((c) => c.body), events, noId: noId.calls.length, child: child.calls.length }));

  // ── F4 ────────────────────────────────────────────────────────────────────
  const A1 = { atom_id: 'FC-000002:0139:004', text: 'أول النص الطويل.', heading: 'كتاب الطهارة', volume: 1, page_start: 139, page_end: 140 };
  const A2 = { atom_id: 'FC-000002:0140:001', text: 'آخر النص.', heading: 'كتاب الطهارة', volume: 1, page_start: 140, page_end: 141 };
  const reading = { mode: 'pages', card: '📖 «تفسير مجاهد» · مجاهد بن جبر · ج1 · ص139–141', atoms: [A1, A2],
    next: { atom_id: 'FC-000002:0142:001', volume: 1, page: 142 }, prev: { atom_id: 'FC-000002:0138:001', volume: 1, page: 138 } };
  net = [];
  route = (url, body) => {
    if (url !== '/api/lib-nav' || !body) return null;
    if (body.op === 'page' && body.page === 140) return reading;
    if (body.op === 'next') return { ...reading, atoms: [{ ...A2, atom_id: 'FC-000002:0142:001', text: 'نص التالية.' }] };
    if (body.op === 'page' && body.page === 138) return { ...reading, atoms: [{ ...A1, atom_id: 'FC-000002:0138:001', text: 'نص السابقة.' }] };
    return null;
  };
  const R = grab('React');
  const sec = grab('__mount')(R.createElement(grab('EzikLibrarySection'), { target: { bid: 'FC-000002', atom: '', vol: 1, pg: 140 }, age: 30, onBack: () => {} }));
  await tick(20);
  const firstCall = libCalls()[0] && libCalls()[0].body;
  const t1 = String(sec.host.textContent || '');
  const nextBtn = byText(sec.host, T('library.next'));
  const hasCopy = buttons(sec.host).some((b) => /نسخ/.test(String(b.textContent || '')));
  const shareLabel = grab('EZIK_SHARE_LABEL');
  const hasShare = buttons(sec.host).some((b) => String(b.textContent || '').trim() === String(shareLabel));
  if (nextBtn) press(nextBtn);
  await tick(20);
  const nextCall = libCalls()[1] && libCalls()[1].body;
  const t2 = String(sec.host.textContent || '');
  const prevBtn = byText(sec.host, T('library.prev'));
  if (prevBtn) press(prevBtn);
  await tick(20);
  const prevCall = libCalls()[2] && libCalls()[2].body;
  ok('F4  from a card: the page asked with band and age; atoms drawn; «التالي» after the LAST atom; «السابق» the previous page; copy and share',
    firstCall && JSON.stringify(firstCall) === JSON.stringify({ op: 'page', page: 140, volume: 1, book_id: 'FC-000002', band: 'adult', age: 30 })
    && t1.includes('أول النص الطويل.') && t1.includes('آخر النص.') && t1.includes('ص139–141') && hasCopy && hasShare
    && nextCall && nextCall.op === 'next' && nextCall.atom_id === 'FC-000002:0140:001' && t2.includes('نص التالية.')
    && prevCall && prevCall.op === 'page' && prevCall.page === 138 && prevCall.volume === 1,
    JSON.stringify({ firstCall, nextCall, prevCall, hasCopy, hasShare, t1: t1.slice(0, 200) }));

  // ── F5 ────────────────────────────────────────────────────────────────────
  grab('__unmount')(sec.root);
  net = [];
  route = (url, body) => {
    if (url !== '/api/lib-nav' || !body) return null;
    if (body.op === 'shelf') return { sections: [{ id: 0, name: 'التفاسير', count: 2 }, { id: 3, name: 'متون الحديث', count: 1 }] };
    if (body.op === 'books') return { section: { id: 0, name: 'التفاسير' }, items: [{ id: 'FC-000002', title: 'تفسير مجاهد', author: 'مجاهد بن جبر' }], page: 1, pages: 1, total: 1 };
    if (body.op === 'book') return { book: { id: 'FC-000002', title: 'تفسير مجاهد', author: 'مجاهد بن جبر', mode: 'pages' } };
    if (body.op === 'toc') return { mode: 'pages', headings: [{ heading: 'سورة الفاتحة', atom_id: 'FC-000002:0001:001', volume: 1, page: 1, children: [] }] };
    if (body.op === 'page' && body.page === 1) return { notice: 'end' };
    return null;
  };
  const shelfView = grab('__mount')(R.createElement(grab('EzikLibrarySection'), { target: null, age: 30, onBack: () => {} }));
  await tick(20);
  const h = shelfView.host;
  const s1 = byText(h, 'التفاسير' + T('library.countBooks', { n: grab('ezikBrowseNum(2)') })) || buttons(h).find((b) => String(b.textContent).includes('التفاسير'));
  if (s1) press(s1);
  await tick(20);
  const b1 = buttons(h).find((b) => String(b.textContent).includes('تفسير مجاهد'));
  if (b1) press(b1);
  await tick(30);
  const chapter = buttons(h).find((b) => String(b.textContent).includes('سورة الفاتحة'));
  if (chapter) press(chapter);
  await tick(20);
  const ops = libCalls().map((c) => c.body.op);
  const endSaid = String(h.textContent || '').includes(T('library.end'));
  const backBtn = h.querySelector('.ezsh-nav button');
  if (backBtn) press(backBtn);
  await tick(30);
  const afterBack = libCalls().map((c) => c.body.op);
  ok('F5  from the menu: sections → books → a book and its chapters → a chapter\'s page; a notice said; the visible back walks ONE rung',
    JSON.stringify(ops) === JSON.stringify(['shelf', 'books', 'book', 'toc', 'page'])
    && libCalls()[1].body.section === 0 && libCalls()[1].body.page === 1
    && libCalls()[4].body.page === 1 && libCalls()[4].body.volume === 1 && libCalls()[4].body.book_id === 'FC-000002'
    && endSaid && JSON.stringify(afterBack.slice(5)) === JSON.stringify(['book', 'toc']),
    JSON.stringify({ ops, afterBack }));

  // ── F6 ────────────────────────────────────────────────────────────────────
  const app = jsx.slice(jsx.indexOf('const [sunanOpen, setSunanOpen]'));
  ok('F6  App: one boolean, one history entry, one ladder line; the menu row under the server\'s answer, learned from a library card and never asked',
    /const \[libraryOpen, setLibraryOpen\] = useState\(false\);/.test(app)
    && /useEzikBackLayer\(libraryOpen, \(\) => setLibraryOpen\(false\)\);/.test(app)
    && /if \(libraryOpen\) return <EzikLibrarySection target=\{libTarget\}/.test(app)
    && /\{libraryOn && deriveCaps\(profile \? profile\.age : 0\)\.band === 'adult' \? \(\s*<button onClick=\{\(\) => closeDrawerWith\(\(\) => \{ setLibTarget\(null\); setLibraryOpen\(true\); \}\)\}/.test(app)
    && /window\.addEventListener\(EZIK_LIB_SEEN_EVENT, seen\);\s*if \(ezikLibrarySeen\) setLibraryOn\(true\);/.test(app)
    && (jsx.match(/ezikLibraryEnabled\(/g) || []).length === 2
    && /function BookCard\([^)]*\) \{\s*const \[matnOpen, setMatnOpen\] = useState\(false\);[^\n]*\n[^\n]*\n\s*useEffect\(\(\) => \{ if \(EZIK_LIB_BOOK_ID_RE\.test\(String\(bid \|\| ''\)\)\) ezikMarkLibrarySeen\(\); \}, \[bid\]\);/.test(jsx)
    && !/screen === 'library'/.test(jsx),
    'app.jsx wiring');

  // ── F7 ────────────────────────────────────────────────────────────────────
  grab('__resetSeen')();
  const seenEvents = [];
  window.addEventListener('ezik-library-seen', () => seenEvents.push(1));
  net = [];
  const drawCard = async (attrs) => {
    const kids = grab('ezikRenderSegments')([segOf(reply(attrs))], { tashkeel: false, age: 30 });
    grab('__mount')(R.createElement(R.Fragment, null, kids));
    await tick();
  };
  await drawCard('');
  const afterPlain = seenEvents.length;
  await drawCard(' bid="FC-003660" pg="275"');
  await drawCard(' bid="FC-000002"');
  ok('F7  the signal: a card without a library id says nothing; the first card with one marks the section seen, once; nothing is asked',
    afterPlain === 0 && seenEvents.length === 1 && grab('ezikLibrarySeen') === true && libCalls().length === 0,
    JSON.stringify({ afterPlain, seen: seenEvents.length, calls: libCalls().length }));

  done();
}
main().catch((e) => { say('  FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
