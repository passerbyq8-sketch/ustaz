// guards/lib108-integration-guard.cjs -- ITEM 108 (ORDER-108C): the library page inside Ezik.
//
// WHAT THIS PINS, each against the shipped source and never a re-typed copy of it:
//   A. library.html's deep links: ?book=FC-xxxxxx&vol=V&page=P and ?book=FC-xxxxxx&seq=N parse,
//      anything malformed parses to nothing, and the API base is lib.ezik.app off localhost only.
//   B. «delete all my data»: resetAll calls ezikClearLibrary, which removes every ezlib_ key, the
//      IndexedDB database ezik-library-v1 and the pending «ask Ezik» question -- and nothing else.
//   C. the source link: api/ask.js buildBookTag carries the book's library id and the page-gated
//      volume/page; the client's own expressions read them back; ezikLibraryHref turns them into
//      /library.html?book=..&vol=..&page=..; and library.html's parser reads that link back to
//      the same book, volume and page. One chain, end to end, plus the cases that must draw none.
//   D. «ask Ezik»: library.html and app.jsx name the same sessionStorage slot, and the chat takes
//      the question once.
// Each helper is cut out of app.jsx by @babel/parser and evaluated verbatim; every check that a
// thing is ABSENT is paired with a mutant or a positive twin so it cannot pass over nothing.
//
// Usage: node guards/lib108-integration-guard.cjs     Exit: 0 when every check holds.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));

let checks = 0, failures = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const html = read('library.html');
const app = read('app.jsx');
const ast = parser.parse(app, { sourceType: 'script', plugins: ['jsx'] });
const text = (n) => app.slice(n.start, n.end);
function topFunction(name) {
  for (const n of ast.program.body) {
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) return text(n);
  }
  throw new Error('app.jsx no longer declares function ' + name + '() at the top level');
}
function topConst(name) {
  for (const n of ast.program.body) {
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) if (d.id && d.id.name === name) return n.kind + ' ' + text(d) + ';';
  }
  throw new Error('app.jsx no longer declares ' + name + ' at the top level');
}

// The library page's pure core, exactly as the page runs it.
const coreSrc = (html.match(/<script id="ezlib-core">([\s\S]*?)<\/script>/) || [])[1];
if (!coreSrc) throw new Error('library.html has no ezlib-core script');
const coreCtx = { Math, Date, JSON, Map, Promise, String, Number, Array, Object, Error, Infinity };
coreCtx.globalThis = coreCtx;
vm.runInNewContext(coreSrc, coreCtx);
const parseDeepLink = coreCtx.EzLibCore && coreCtx.EzLibCore.parseDeepLink;
const plain = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  // ==========================================================================================
  section('A. LIBRARY.HTML: DEEP LINKS AND THE API BASE');
  // ==========================================================================================
  ok('A1  EzLibCore exports parseDeepLink', typeof parseDeepLink === 'function');
  eq('A2  ?book&vol&page names a printed page', plain(parseDeepLink('?book=FC-000002&vol=1&page=10')),
    { book: 'FC-000002', vol: 1, page: 10, seq: null });
  eq('A3  ?book&page without a volume keeps the page, vol null', plain(parseDeepLink('?book=FC-000645&page=7')),
    { book: 'FC-000645', vol: null, page: 7, seq: null });
  eq('A4  ?book&seq names a page by sequence', plain(parseDeepLink('?book=FC-000002&seq=5')),
    { book: 'FC-000002', vol: null, page: null, seq: 5 });
  eq('A5  seq wins over page when both are given', plain(parseDeepLink('?book=FC-000002&seq=3&page=9')),
    { book: 'FC-000002', vol: null, page: null, seq: 3 });
  eq('A6  ?book alone opens the book', plain(parseDeepLink('?book=FC-000002')),
    { book: 'FC-000002', vol: null, page: null, seq: null });
  eq('A7  a page that is not a number is dropped, not guessed', plain(parseDeepLink('?book=FC-000002&page=abc&vol=2')),
    { book: 'FC-000002', vol: null, page: null, seq: null });
  eq('A8  a book id of the wrong shape is no deep link', parseDeepLink('?book=FC-2&page=1'), null);
  eq('A9  no book, no deep link', parseDeepLink('?page=3&vol=1'), null);
  eq('A10 an empty query is no deep link', parseDeepLink(''), null);
  eq('A11 other parameters are ignored', plain(parseDeepLink('?api=http://x&book=FC-000123&page=4')),
    { book: 'FC-000123', vol: null, page: 4, seq: null });
  eq('A12 page 0 is not a page', plain(parseDeepLink('?book=FC-000002&page=0')),
    { book: 'FC-000002', vol: null, page: null, seq: null });

  const apiLine = (html.match(/var API = (\(location\.hostname[^;]*);/) || [])[1];
  ok('A13 the page decides its API base from the host', !!apiLine, 'no `var API = (location.hostname ...` line');
  const apiFor = (hostname) => vm.runInNewContext(apiLine || "'NO-LINE'", { location: { hostname } });
  eq('A14 on ezik.app the catalogue is lib.ezik.app', apiFor('ezik.app'), 'https://lib.ezik.app');
  eq('A15 on the branch preview too', apiFor('ustaz-git-lib108-integration-musaed-s-projects1.vercel.app'), 'https://lib.ezik.app');
  eq('A16 on localhost it stays same-origin', apiFor('localhost'), '');
  eq('A17 on 127.0.0.1 it stays same-origin', apiFor('127.0.0.1'), '');
  ok('A18 the page reads the deep link before its first route()',
    /var link = C\.parseDeepLink\(location\.search\);[\s\S]*document\.title = T\('app_title'\);\s*route\(\);/.test(html));
  ok('A19 a page link resolves through the locate endpoint',
    html.indexOf("api('books/' + enc + '/locate?page=' + link.page") !== -1);

  // ==========================================================================================
  section('B. DELETE ALL MY DATA ALSO ERASES THE LIBRARY');
  // ==========================================================================================
  const clearSrc = [topConst('EZIK_ASK_PREFILL_SLOT'), topConst('EZLIB_STORE_PREFIX'), topConst('EZLIB_NOTES_DB'),
    topConst('EZIK_RESUME_THREAD_SLOT'), topFunction('ezikClearResumeThread'), topFunction('ezikClearLibrary')].join('\n');
  function fakeStore(seed) {
    const m = new Map(Object.entries(seed));
    return {
      get length() { return m.size; },
      key: (i) => { const a = Array.from(m.keys()); return i >= 0 && i < a.length ? a[i] : null; },
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: (k) => { m.delete(k); },
      keys: () => Array.from(m.keys()).sort(),
    };
  }
  function runClear(src) {
    const local = fakeStore({ ezlib_mode_v1: '"night"', ezlib_reader_v1: '{}', ezlib_pos_v1: '{}', ezlib_spread_v1: 'true',
      child_profile: '{}', murabbi_theme_v1: 'dark', ezlibrary_other: 'x' });
    const session = fakeStore({ ezik_ask_prefill_v1: 'q', ezik_resume_section_v1: 'home' });
    const deleted = [];
    const win = { sessionStorage: session, indexedDB: { deleteDatabase: (n) => { deleted.push(n); return {}; } } };
    vm.runInNewContext(src + '\nezikClearLibrary();', { window: win, localStorage: local });
    return { local: local.keys(), session: session.keys(), deleted };
  }
  const r = runClear(clearSrc);
  eq('B1  every ezlib_ key goes, and every other key stays', r.local, ['child_profile', 'ezlibrary_other', 'murabbi_theme_v1']);
  eq('B2  the notes database ezik-library-v1 is deleted', r.deleted, ['ezik-library-v1']);
  eq('B3  the pending «ask Ezik» question goes, the resume key is not this function’s', r.session, ['ezik_resume_section_v1']);
  const mutant = runClear(clearSrc.replace("'ezlib_'", "'ezlib-'"));
  ok('B4  MUTANT KILLED: a wrong prefix leaves the library keys behind', mutant.local.indexOf('ezlib_pos_v1') !== -1
    && JSON.stringify(mutant.local) !== JSON.stringify(r.local), JSON.stringify(mutant.local));
  // No indexedDB at all (private mode, old WebView): the function still returns.
  let threw = null;
  try { vm.runInNewContext(clearSrc + '\nezikClearLibrary();', { window: { sessionStorage: fakeStore({}) }, localStorage: fakeStore({ ezlib_x: '1' }) }); }
  catch (e) { threw = e; }
  eq('B5  with no IndexedDB it does not throw', threw && String(threw), null);
  const resetStart = app.indexOf('const resetAll = () => {');
  const resetEnd = app.indexOf('\n  };\n', resetStart);
  ok('B6  resetAll calls ezikClearLibrary()', resetStart !== -1 && resetEnd > resetStart
    && app.slice(resetStart, resetEnd).indexOf('ezikClearLibrary();') !== -1);
  ok('B7  ...behind the same confirm as every other erase', resetStart !== -1
    && app.slice(resetStart, resetStart + 200).indexOf('confirm(') !== -1);
  ok('B8  the page’s own names are the ones Ezik erases',
    html.indexOf("indexedDB.open('ezik-library-v1'") !== -1 && html.indexOf("K_MODE = 'ezlib_mode_v1'") !== -1);

  // ==========================================================================================
  section('C. A LIBRARY SOURCE OPENS THE BOOK AT ITS PAGE');
  // ==========================================================================================
  const ask = await import(pathToFileURL(path.join(REPO, 'api', 'ask.js')).href);
  const row = (over) => Object.assign({
    bookTitle: 'صحيح البخاري', author: 'البخاري', locator: 'ج1 · ص7-9', recordId: 'lib:FC-000645:0044:001',
    subjectId: 'FC-000645', locatorSpan: { volume: '1', pageStart: '7', pageEnd: '9' }, text: 'إنما الأعمال بالنيات', matnCut: false,
  }, over || {});
  const tag = String((ask.buildBookTag(row()) || {}).tag || 'NO-TAG');
  ok('C1  the card carries the book’s library id, volume and first page',
    tag.indexOf(' book="FC-000645"') !== -1 && tag.indexOf(' vol="1"') !== -1 && tag.indexOf(' page="7"') !== -1, tag.slice(0, 160));
  ok('C2  ...and still no link and no host on the card itself',
    tag !== 'NO-TAG' && !/https?:/.test(tag) && !/url=/.test(tag) && !/href=/.test(tag), tag.slice(0, 160));
  ok('C3  ...and the title between the tags is the book’s title, untouched', /<book[^>]*>صحيح البخاري<\/book>$/.test(tag), tag.slice(-60));
  const tagNoPage = String((ask.buildBookTag(row({ locatorSpan: { volume: '', pageStart: '', pageEnd: '' }, locator: '' })) || {}).tag || 'NO-TAG');
  ok('C4  a page the server did not call citable yields the id alone',
    tagNoPage.indexOf(' book="FC-000645"') !== -1 && !/ (vol|page)="/.test(tagNoPage), tagNoPage.slice(0, 160));
  const tagOtherId = String((ask.buildBookTag(row({ subjectId: 'taharah' })) || {}).tag || 'NO-TAG');
  ok('C5  an id that is not FC- and six digits yields no place attribute at all',
    tagOtherId !== 'NO-TAG' && tagOtherId.indexOf('<book') === 0 && !/ (book|vol|page)="/.test(tagOtherId), tagOtherId.slice(0, 160));

  // The client's own expressions, cut out of app.jsx.
  const placeLines = (app.match(/      const placeStr = [^\n]*\n      const bookIdMatch = [^\n]*\n      const volMatch = [^\n]*\n      const pageMatch = [^\n]*\n/) || [])[0];
  ok('C6  app.jsx reads book/vol/page with the matn removed first', !!placeLines);
  const hrefSrc = topFunction('ezikLibraryHref');
  const clientPlace = (t) => {
    const attrsStr = (t.match(/^<book([^>]*)>/) || [])[1] || '';
    return vm.runInNewContext(hrefSrc + '\n' + (placeLines || '') +
      '\n({ bookId: bookIdMatch ? bookIdMatch[1] : "", vol: volMatch ? volMatch[1] : "", page: pageMatch ? pageMatch[1] : "",' +
      ' href: ezikLibraryHref(bookIdMatch ? bookIdMatch[1] : "", volMatch ? volMatch[1] : "", pageMatch ? pageMatch[1] : "") })',
    { attrsStr });
  };
  const got = plain(clientPlace(tag));
  eq('C7  the client reads the server’s card back to id, volume and page', { bookId: got.bookId, vol: got.vol, page: got.page },
    { bookId: 'FC-000645', vol: '1', page: '7' });
  eq('C8  ...and links to the library page at that place', got.href, '/library.html?book=FC-000645&vol=1&page=7');
  eq('C9  ...which the library page reads back to the same book and page',
    plain(parseDeepLink(got.href.slice(got.href.indexOf('?')))), { book: 'FC-000645', vol: 1, page: 7, seq: null });
  eq('C10 a card without a citable page links to the book', plain(clientPlace(tagNoPage)).href, '/library.html?book=FC-000645');
  eq('C11 a card with no library id draws no link', plain(clientPlace(tagOtherId)).href, '');
  // base64 of a passage can never be read as a place: a matn that ENDS in `page=` is still the matn.
  const trap = '<book author="x" matn="QUJD/page=" cut="1">كتاب</book>';
  eq('C12 base64 in the matn is never read as a place', plain(clientPlace(trap)).href, '');
  eq('C13 a saved answer from before this item (no attributes) draws no link',
    plain(clientPlace('<book author="ابن قدامة" ref="ج1 · ص2">المغني</book>')).href, '');
  const hrefOnly = (b, v, p) => vm.runInNewContext(hrefSrc + '\nezikLibraryHref(b, v, p)', { b, v, p });
  eq('C14 a volume without a page is not sent', hrefOnly('FC-000001', '3', ''), '/library.html?book=FC-000001');
  eq('C15 an id with anything after it is refused', hrefOnly('FC-000001"><script>', '1', '2'), '');
  ok('C16 BookCard draws the link under the chip when there is one',
    app.indexOf('{libHref ? <BookLibraryLink bookId={bookId} vol={vol} page={page} /> : null}') !== -1
    && app.indexOf('<BookLibraryLink bookId={bookId} vol={vol} page={page} />') !== -1);
  ok('C17 the renderer hands BookCard the three new fields',
    app.indexOf('bookId={seg.bookId} vol={seg.vol} page={seg.page}') !== -1);

  // ==========================================================================================
  section('D. ASK EZIK: THE QUESTION WAITS IN THE COMPOSER, NOT SENT');
  // ==========================================================================================
  const slot = (topConst('EZIK_ASK_PREFILL_SLOT').match(/'([^']+)'/) || [])[1];
  ok('D1  library.html writes the slot app.jsx reads', !!slot && html.indexOf("sessionStorage.setItem('" + slot + "', q)") !== -1, slot);
  ok('D2  ...and sets the hook the library’s button calls', html.indexOf('window.EzikLibrary.askEzik = function (query)') !== -1);
  ok('D3  ...and the question never rides in a URL', /location\.href = '\/';\n  \};/.test(html));
  const takeSrc = topConst('EZIK_ASK_PREFILL_SLOT') + '\n' + topFunction('ezikTakeAskPrefill');
  const session = fakeStore({ [slot || 'x']: '  ما حكم كذا؟  ' });
  const takes = vm.runInNewContext(takeSrc + '\n[ezikTakeAskPrefill(), ezikTakeAskPrefill()]', { window: { sessionStorage: session } });
  eq('D4  the chat takes the question once, trimmed', plain(takes), ['ما حكم كذا؟', '']);
  const effect = app.indexOf('const prefillScreen = screen;');
  ok('D5  the chat effect opens a fresh thread and fills the composer without sending',
    effect !== -1 && /if \(prefillScreen !== 'chat'\) return;\s*const q = ezikTakeAskPrefill\(\);\s*if \(!q\) return;\s*newChat\(\);\s*setInput\(q\);\s*\}, \[prefillScreen\]\);/
      .test(app.slice(effect, effect + 400)));

  // ==========================================================================================
  section('E. THE SECTION ENTRY');
  // ==========================================================================================
  const dictAr = (app.match(/'module\.library': '([^']+)'/) || [])[1] || '';
  eq('E1  the section is named exactly the order’s word', Array.from(dictAr).map((c) => c.codePointAt(0).toString(16)),
    ['627', '644', '645', '643', '62a', '628', '629']);
  ok('E2  the shelf carries it after the lessons, opening /library.html',
    /\{ id: 'lessons', [^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*\{ id: 'library',  label: EZH_LIBRARY,  icon: EZH_ICON_LIBRARY,  onClick: v\.onOpenLibrary,/.test(app)
    && app.indexOf("onOpenLibrary: () => { window.location.href = '/library.html'; },") !== -1);
  ok('E3  the library’s home has a way back to Ezik', html.indexOf("bar.insertBefore(el('button', { class: 'ibtn', 'aria-label': T('back'), text: '→', on: { click: backToEzik } })") !== -1
    && /function backToEzik\(\) \{\s*try \{\s*if \(!sessionStorage\.getItem\('ezik_resume_thread_v1'\)\) sessionStorage\.setItem\('ezik_resume_section_v1', 'home'\);\s*\} catch \(e\) \{\}\s*location\.href = '\/';/.test(html));
  ok('E4  the old library sub-line is gone for good', app.indexOf('EZIST_SUB_LIBRARY') === -1 && app.indexOf('EZIST_SUB_ASMAA') !== -1);
  ok('E5  the catalogue host is named in library.html and never in app.jsx',
    html.indexOf('https://lib.ezik.app') !== -1 && app.indexOf('lib.ezik.app') === -1);

  // ==========================================================================================
  section('F. BACK FROM THE LIBRARY REOPENS THE SAME CONVERSATION (ORDER-108D D2)');
  // ==========================================================================================
  // Every behaviour below is a function of its SOURCE, so each mutant runs through the very
  // same function as the real code and must come out different.
  const bootSrc = [topConst('EZIK_RESUME_KEY'), topConst('EZIK_ASK_PREFILL_SLOT'), topConst('EZIK_RESUME_THREAD_SLOT'),
    topFunction('ezikNoteResumeThread'), topFunction('ezikClearResumeThread'), topFunction('ezikLibraryLinkClick'),
    topFunction('ezikOnPageShow'), topFunction('ezikBootIntentPick'), topFunction('ezikTakeBootIntent')].join('\n');
  const SLOT_P = 'ezik_ask_prefill_v1', SLOT_S = 'ezik_resume_section_v1', SLOT_T = 'ezik_resume_thread_v1';
  // One boot: the seeded session, the conversations that still exist -> what won, what is left.
  function boot(src, seed, existing) {
    const session = fakeStore(seed);
    const out = vm.runInNewContext(src + '\nezikTakeBootIntent((id) => ex.indexOf(id) !== -1)',
      { window: { sessionStorage: session }, ex: existing || [] });
    return { kind: out.kind, thread: out.thread, left: session.keys() };
  }
  function priorityTable(src) {
    return [
      boot(src, { [SLOT_P]: 'q', [SLOT_S]: 'home', [SLOT_T]: 'c1' }, ['c1']),
      boot(src, { [SLOT_S]: 'home', [SLOT_T]: 'c1' }, ['c1']),
      boot(src, { [SLOT_T]: 'c1' }, ['c1']),
      boot(src, { [SLOT_T]: 'gone' }, ['c1']),
      boot(src, { [SLOT_S]: 'memorize', [SLOT_T]: 'c1' }, ['c1']),
      boot(src, {}, ['c1']),
    ].map((b) => b.kind + ':' + b.thread);
  }
  const PRIORITY = ['prefill:', 'home:', 'thread:c1', ':', 'thread:c1', ':'];
  eq('F1  priority: the question, then the sections, then the conversation that still exists',
    priorityTable(bootSrc), PRIORITY);
  const mPrio = bootSrc.replace("  if (prefill) return 'prefill';\n  if (section === 'home') return 'home';",
    "  if (section === 'home') return 'home';\n  if (prefill) return 'prefill';");
  ok('F2  MUTANT KILLED: the sections put before the question', mPrio !== bootSrc
    && JSON.stringify(priorityTable(mPrio)) !== JSON.stringify(PRIORITY));
  const mExists = bootSrc.replace('if (thread && threadExists(thread))', 'if (thread)');
  ok('F3  MUTANT KILLED: a deleted conversation reopened', mExists !== bootSrc
    && JSON.stringify(priorityTable(mExists)) !== JSON.stringify(PRIORITY));

  function clearingTable(src) {
    return [
      boot(src, { [SLOT_P]: 'q', [SLOT_S]: 'home', [SLOT_T]: 'c1' }, ['c1']).left,
      boot(src, { [SLOT_S]: 'home', [SLOT_T]: 'c1', [SLOT_P]: '  ' }, ['c1']).left,
      boot(src, { [SLOT_S]: 'memorize', [SLOT_T]: 'c1' }, ['c1']).left,
      boot(src, { [SLOT_S]: 'memorize', [SLOT_T]: 'gone' }, ['c1']).left,
    ];
  }
  const CLEARING = [[SLOT_P], [SLOT_S], [], [SLOT_S]];
  eq('F4  clearing: the winner stays for its owner, every other key goes, the thread note always',
    clearingTable(bootSrc), CLEARING);
  const mClear = bootSrc.replace('    ss.removeItem(EZIK_RESUME_THREAD_SLOT);\n    if (kind', '    if (kind');
  ok('F5  MUTANT KILLED: the thread note survives the boot', mClear !== bootSrc
    && JSON.stringify(clearingTable(mClear)) !== JSON.stringify(CLEARING));
  const mClear2 = bootSrc.replace("if (kind === 'prefill' || kind === 'thread') ss.removeItem(EZIK_RESUME_KEY);", '');
  ok('F6  MUTANT KILLED: the losing section record left behind', mClear2 !== bootSrc
    && JSON.stringify(clearingTable(mClear2)) !== JSON.stringify(CLEARING));

  // The tap: only a book-source link notes the thread, and it spends a stale section record.
  function tap(src, isLink, chatId) {
    const session = fakeStore({ [SLOT_S]: 'memorize' });
    const target = { closest: (sel) => (isLink && sel === 'a[data-ezik-library-link]' ? {} : null) };
    vm.runInNewContext(src + '\nezikLibraryLinkClick(target, chatId)', { window: { sessionStorage: session }, target, chatId });
    return session.keys().map((k) => k + '=' + session.getItem(k));
  }
  eq('F7  a tap on a book-source link notes the open conversation', tap(bootSrc, true, 'c7'), [SLOT_T + '=c7']);
  eq('F8  ...any other tap notes nothing', tap(bootSrc, false, 'c7'), [SLOT_S + '=memorize']);
  eq('F9  ...and a chat with no id yet notes nothing', tap(bootSrc, true, null), [SLOT_S + '=memorize']);
  // A plain link (closest('a') finds it, the source-link selector does not) must note nothing.
  function tapPlainLink(src) {
    const session = fakeStore({});
    const target = { closest: (sel) => (sel === 'a' ? {} : null) };
    vm.runInNewContext(src + '\nezikLibraryLinkClick(target, "c7")', { window: { sessionStorage: session }, target });
    return session.keys();
  }
  eq('F10 a tap on any other link notes nothing', tapPlainLink(bootSrc), []);
  const mTap = bootSrc.replace("closest('a[data-ezik-library-link]')", "closest('a')");
  ok('F10b MUTANT KILLED: every link notes the thread', mTap !== bootSrc && tapPlainLink(mTap).length === 1);
  ok('F11 the source link carries the attribute the tap looks for',
    app.indexOf('<a href={href} style={s.sourceChip} data-ezik-library-link="1">') !== -1);

  // The back-forward cache.
  function show(src, persisted) {
    const session = fakeStore({ [SLOT_T]: 'c1' });
    vm.runInNewContext(src + '\nezikOnPageShow({ persisted: p })', { window: { sessionStorage: session }, p: persisted });
    return session.keys();
  }
  eq('F12 a back-forward-cache restore spends the note', show(bootSrc, true), []);
  eq('F13 ...an ordinary page show does not', show(bootSrc, false), [SLOT_T]);
  const mShow = bootSrc.replace('if (e && e.persisted) ezikClearResumeThread();', 'if (e) ezikClearResumeThread();');
  ok('F14 MUTANT KILLED: every page show spends the note', mShow !== bootSrc && show(mShow, false).length === 0);

  // The library home's back button.
  const backSrc = (html.match(/  function backToEzik\(\) \{[\s\S]*?\n  \}\n/) || [])[0] || '';
  function back(src, seed) {
    const session = fakeStore(seed);
    const loc = { href: '/library.html' };
    vm.runInNewContext(src + '\nbackToEzik();', { sessionStorage: session, location: loc });
    return { href: loc.href, left: session.keys().map((k) => k + '=' + session.getItem(k)) };
  }
  eq('F15 back with no conversation noted: the sections, as before', back(backSrc, {}),
    { href: '/', left: [SLOT_S + '=home'] });
  eq('F16 back with a conversation noted: "/" and no resume = home, so the conversation reopens',
    back(backSrc, { [SLOT_T]: 'c1' }), { href: '/', left: [SLOT_T + '=c1'] });
  const mBack = backSrc.replace("if (!sessionStorage.getItem('ezik_resume_thread_v1')) ", '');
  ok('F17 MUTANT KILLED: the back button always writes home', mBack !== backSrc
    && JSON.stringify(back(mBack, { [SLOT_T]: 'c1' }).left) !== JSON.stringify([SLOT_T + '=c1']));

  // «Delete all my data».
  const clearAllSrc = clearSrc;   // section B's cut already carries the thread slot and its eraser
  function eraseAll(src) {
    const session = fakeStore({ [SLOT_T]: 'c1', [SLOT_S]: 'home' });
    vm.runInNewContext(src + '\nezikClearLibrary();', { window: { sessionStorage: session, indexedDB: { deleteDatabase: () => ({}) } }, localStorage: fakeStore({}) });
    return session.keys();
  }
  eq('F18 delete-all erases the thread note', eraseAll(clearAllSrc), [SLOT_S]);
  const mErase = clearAllSrc.replace('  ezikClearResumeThread();\n  try {\n    const idb', '  try {\n    const idb');
  ok('F19 MUTANT KILLED: delete-all leaves the thread note', mErase !== clearAllSrc && eraseAll(mErase).indexOf(SLOT_T) !== -1);

  // The wiring in App, where a unit test cannot reach.
  ok('F20 the boot takes the intents and reopens the conversation that won',
    /const bootIntent = ezikTakeBootIntent\(\(id\) => ezikListChats\(ezikProfileKey\(p\)\)\.some\(\(r\) => r\.id === id\)\);\s*ezikResumeMarkEntered\(ezikReadResume\(\)\);\s*if \(bootIntent\.kind === 'thread'\) openSavedChat\(bootIntent\.thread\);\s*else setScreen\(ezikResumeScreen\(\)\);/.test(app));
  ok('F21 App listens for the tap in the capture phase and for the page show',
    app.indexOf("const onLibraryLink = (e) => ezikLibraryLinkClick(e && e.target, chatIdRef.current);") !== -1
    && app.indexOf("document.addEventListener('click', onLibraryLink, true);") !== -1
    && app.indexOf("window.addEventListener('pageshow', ezikOnPageShow);") !== -1);
  ok('F22 library.html and app.jsx name the same thread slot',
    (topConst('EZIK_RESUME_THREAD_SLOT').match(/'([^']+)'/) || [])[1] === SLOT_T && html.indexOf("'" + SLOT_T + "'") !== -1);

  console.log('\n=== lib108-integration: ' + (checks - failures) + '/' + checks + ' checks, ' + failures + ' failure(s) ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('  FAIL  the guard itself threw: ' + (e && e.stack || e)); process.exit(1); });
