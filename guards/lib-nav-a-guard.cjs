// guards/lib-nav-a-guard.cjs -- م٤-أ (LIB_NAV_V1): a book's page by its number, from the navigation routes.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٤-أ): the whole page for heritage and fatwa books (all its
// atoms, in order), one paragraph with attribution for a modern book, «no print pages» and the chapters
// for an auto-numbered one, a refusal for a withheld one, and Arabic and Hindi numerals the same. His
// decision of the same day: a quoted page may start before or end after the page asked for, and the
// card shows the REAL range from the first and last atoms. MEASURED before it was built
// (04-quote/measure/A-page.md): the detector threw the page and the volume away and every page request
// was refused.
//
// WHAT THIS PINS:
//   V1  the reading: page and volume in three digit systems, ordinals to 25, «رقم», «ج١ ص١٤٠» after the
//       title, «١/١٤٠», a number in words asks for digits;
//   V2  which book: one edition, editions of one work, no book, a withheld book, several works;
//   V3  the door: only the two allow-listed origins, the switch, the token, no redirect, and the error
//       body read for its code;
//   V4  the owner's page: ONE POST /page at the preview origin with book_id, volume and page; the card
//       carries the real range of the atoms (ص139–141), never the page asked for; every atom whole;
//   V5  the classes: modern → one paragraph with that atom's own range; auto → no /page, the chapters;
//       numbering_unavailable, volume_required and page_not_found → their sentences; a withheld book →
//       no call;
//   V6  trust: an answer for another book, or whose text disagrees with its atoms, is not quoted;
//   V7  api/ask.js reads the switch once, and the block sits before the quote seat with its gate and
//       its two protections; lib/lib-nav.js reads no environment;
//   V8  the switch off: the quote seat's page answer is what it was.
// Red on the tree before this item: `node guards/lib-nav-a-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
  return false;
}
const W16 = 'انقل لي نص الصفحة ١٤٠ من الجزء الأول من كتاب بداية المجتهد لابن رشد';
const atom = (id, s, e, text, extra = {}) => ({
  atom_id: id, text, heading_path: ['كتاب الصلاة', 'باب القنوت'], matn_spans: [], volume: 1,
  page_start: s, page_end: e, page_citable: true, numbering: 'print', ...extra,
});
const jsonRes = (url, status, obj, headers = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => { const k = String(h).toLowerCase(); if (k === 'content-type') return 'application/json'; return headers[k] || null; } },
  text: async () => JSON.stringify(obj), json: async () => obj,
});

async function main() {
  console.log('lib-nav-a guard — root ' + REPO);
  let N = null;
  try { N = await esm('lib/lib-nav.js'); } catch (e) { ok('V0  lib/lib-nav.js loads', false, e.message); }
  const Q = await esm('lib/lib-quote.js');
  if (!N) { console.log(`\n=== lib-nav-a: ${checks - failures}/${checks} PASS ===`); process.exit(1); }

  // ── V1 ────────────────────────────────────────────────────────────────────
  const p = (s) => N.parsePageAsk(s) || {};
  const a = p(W16);
  ok('V1  page and volume in three digit systems, ordinals, «رقم», after the title, «١/١٤٠»; words ask for digits',
    a.page === 140 && a.volume === 1 && a.titleWords.join(' ') === 'بدايه المجتهد لابن رشد'
    && p(W16.replace('١٤٠', '140')).page === 140 && p(W16.replace('١٤٠', '۱۴۰')).page === 140
    && p('انقل لي من بداية المجتهد ج١ ص١٤٠').page === 140 && p('انقل لي من بداية المجتهد ج١ ص١٤٠').volume === 1
    && p('انقل لي الصفحة رقم ١٤٠ من بداية المجتهد').page === 140
    && p('انقل لي بداية المجتهد ١/١٤٠').volume === 1 && p('انقل لي بداية المجتهد ١/١٤٠').page === 140
    && p('نص صفحة ٥٠ من الجزء الخامس والعشرين من مجموع الفتاوى').volume === 25
    && p('نص صفحة ٥٠ من المجلد الثاني من مجموع الفتاوى').volume === 2
    && p('انقل لي الصفحة الخمسين من كتاب المغني').needDigits === true
    && N.parsePageAsk('ما حكم صلاة الضحى؟') === null,
    JSON.stringify(a));

  // ── V2 ────────────────────────────────────────────────────────────────────
  const plan = (s) => N.planPage(N.parsePageAsk(s)) || {};
  ok('V2  one edition, editions of one work, no book, a withheld book, several works',
    plan(W16).outcome === 'page' && plan(W16).book.id === 'FC-003592'
    && plan('انقل لي نص الصفحة ١٠ من كتاب تفسير ابن كثير').outcome === 'editions'
    && plan('انقل لي نص الصفحة ١٠ من كتاب الغواصين في البحار').outcome === 'no_book'
    && plan('انقل لي نص الصفحة ١٠ من كتاب مجلة الأستاذ').outcome === 'blocked'
    && plan('انقل لي نص الصفحة ٥ من كتاب فتاوى نور على الدرب').outcome === 'ask_which'
    && plan('انقل لي الصفحة الخمسين من كتاب المغني').outcome === 'need_digits');

  // ── a fake navigation service ─────────────────────────────────────────────
  const calls = [];
  const serve = (routes) => async (url, init) => {
    const u = new URL(String(url));
    const body = JSON.parse(init.body);
    calls.push({ origin: u.origin, path: u.pathname, body, auth: init.headers.authorization, redirect: init.redirect });
    const r = routes[u.pathname];
    const out = typeof r === 'function' ? r(body) : r;
    return jsonRes(url, out ? out.status : 404, out ? out.body : { error: { code: 'not_here', message: '' } }, out && out.headers);
  };
  const DEPS = (routes) => ({ flagValue: 'on', token: 'tk-guard-nav', baseUrl: 'https://lib-preview.ezik.app', fetchImpl: serve(routes) });
  const page140 = {
    book_id: 'FC-003592', title: 'بداية المجتهد ونهاية المقتصد', author: 'ابن رشد الحفيد', volume: 1, page: 140,
    page_citable: true, numbering: 'print',
    atoms: [atom('FC-003592:0140:001', 139, 140, 'آخرُ المسألةِ السابقة.'), atom('FC-003592:0140:002', 140, 140, 'القنوتُ في الصبح.'),
      atom('FC-003592:0140:003', 140, 141, 'وأمّا القنوتُ في الوتر.')],
    next: null, prev: null,
  };
  page140.text = page140.atoms.map((x) => x.text).join('\n');

  // ── V3 the door ───────────────────────────────────────────────────────────
  calls.length = 0;
  const refusedOrigin = await N.navCall('page', { book_id: 'x', page: 1 }, { ...DEPS({}), baseUrl: 'https://evil.example' });
  const flagOff = await N.navCall('page', { book_id: 'x', page: 1 }, { ...DEPS({}), flagValue: 'off' });
  const noToken = await N.navCall('page', { book_id: 'x', page: 1 }, { ...DEPS({}), token: '' });
  const coded = await N.navCall('page', { book_id: 'x', page: 1 }, DEPS({ '/page': { status: 409, body: { error: { code: 'numbering_auto', message: 'atom_id=FC-1:1:1.' } } } }));
  ok('V3  only the allow-listed origins, the switch, the token; the error body is read for its code',
    N.navOrigin('https://evil.example') === null && N.navOrigin('https://lib-preview.ezik.app') === 'https://lib-preview.ezik.app'
    && N.navOrigin('') === 'https://lib.ezik.app' && refusedOrigin.reason === 'nav_origin_refused'
    && flagOff.reason === 'nav_flag_off' && noToken.reason === 'nav_token_missing'
    && coded.ok === false && coded.status === 409 && coded.code === 'numbering_auto'
    && calls.length === 1 && calls[0].redirect === 'error',
    JSON.stringify({ refusedOrigin, flagOff, coded, calls: calls.length }));

  // ── V4 the owner's page ───────────────────────────────────────────────────
  calls.length = 0;
  const r4 = await N.answerPageRequest(W16, DEPS({ '/page': { status: 200, body: page140 } }));
  const card = String(r4 && r4.text || '').split('\n')[0];
  ok('V4  one POST /page at the preview origin; the card carries the atoms\' real range, every atom whole',
    r4 && r4.outcome === 'page_quoted' && calls.length === 1 && calls[0].origin === 'https://lib-preview.ezik.app'
    && calls[0].path === '/page' && calls[0].auth === 'Bearer tk-guard-nav'
    && JSON.stringify(calls[0].body) === JSON.stringify({ book_id: 'FC-003592', page: 140, volume: 1 })
    && card === '📖 «بداية المجتهد ونهاية المقتصد» · ابن رشد الحفيد · ج1 · ص139–141'
    && r4.text.endsWith('> آخرُ المسألةِ السابقة.\n> القنوتُ في الصبح.\n> وأمّا القنوتُ في الوتر.')
    && r4.cursor && r4.cursor.bid === 'FC-003592' && r4.cursor.at === 'FC-003592:0140:003',
    JSON.stringify({ r4, calls }));

  // ── V5 the classes ────────────────────────────────────────────────────────
  calls.length = 0;
  const modernPage = {
    book_id: 'FC-003794', title: 'الشرح الممتع', author: 'ابن عثيمين', volume: 1, page: 30, page_citable: true, numbering: 'print',
    atoms: [atom('FC-003794:0030:001', 29, 30, 'فقرةٌ قبلها.'), atom('FC-003794:0030:002', 30, 31, 'الفقرةُ الأولى من الصفحة.\nوالفقرةُ الثانية.')],
  };
  modernPage.text = modernPage.atoms.map((x) => x.text).join('\n');
  const modern = await N.answerPageRequest('انقل لي نص الصفحة ٣٠ من الشرح الممتع', DEPS({ '/page': { status: 200, body: modernPage } }));
  const autoCalls = [];
  const auto = await N.answerPageRequest('انقل لي نص الصفحة ٥ من كتاب فتاوى نور على الدرب للعثيمين', {
    ...DEPS({}), fetchImpl: async (url, init) => { autoCalls.push(new URL(String(url)).pathname); return jsonRes(url, 200, { book_id: 'FC-004553', title: 't', author: 'a', headings: [{ heading: 'كتاب الطهارة', level: 1, children: [] }, { heading: 'كتاب الصلاة', level: 1, children: [] }] }); },
  });
  const unnumbered = await N.answerPageRequest(W16, DEPS({
    '/page': { status: 409, body: { error: { code: 'numbering_unavailable', message: '' } } },
    '/toc': { status: 200, body: { book_id: 'FC-003592', headings: [{ heading: 'كتاب الطهارة', level: 1, children: [] }] } },
  }));
  const volReq = await N.answerPageRequest('انقل لي نص الصفحة ١٤٠ من كتاب بداية المجتهد', DEPS({ '/page': { status: 400, body: { error: { code: 'volume_required', message: '' } } } }));
  const notFound = await N.answerPageRequest('انقل لي نص الصفحة ٩٩٩ من الجزء الثاني من كتاب بداية المجتهد', DEPS({ '/page': { status: 404, body: { error: { code: 'page_not_found', message: '' } } } }));
  calls.length = 0;
  const blocked = await N.answerPageRequest('انقل لي نص الصفحة ١٠ من كتاب مجلة الأستاذ', DEPS({}));
  ok('V5  modern → one paragraph with its atom\'s own range; auto → chapters, no /page; the three errors; withheld → no call',
    modern && modern.outcome === 'page_quoted' && modern.text === '📖 «الشرح الممتع على زاد المستقنع» · ابن عثيمين · ج1 · ص30–31\n\n> الفقرةُ الأولى من الصفحة.'
    && auto && auto.outcome === 'page_auto' && JSON.stringify(autoCalls) === JSON.stringify(['/toc']) && auto.text.includes('- كتاب الطهارة')
    && unnumbered && unnumbered.outcome === 'page_unnumbered' && unnumbered.text.includes('ترقيمَ طبعةٍ')
    && volReq && volReq.outcome === 'page_volume_required' && notFound && notFound.outcome === 'page_not_found'
    && blocked && blocked.outcome === 'page_blocked' && calls.length === 0,
    JSON.stringify({ modern, auto, autoCalls, unnumbered: unnumbered && unnumbered.outcome, volReq: volReq && volReq.outcome, notFound: notFound && notFound.outcome }));

  // ── V6 trust ──────────────────────────────────────────────────────────────
  const other = await N.answerPageRequest(W16, DEPS({ '/page': { status: 200, body: { ...page140, book_id: 'FC-003593' } } }));
  const lying = await N.answerPageRequest(W16, DEPS({ '/page': { status: 200, body: { ...page140, text: 'نصٌّ آخر' } } }));
  ok('V6  an answer for another book, or whose text disagrees with its atoms, is not quoted',
    other && other.outcome === 'page_unavailable' && lying && lying.outcome === 'page_unavailable');

  // ── V7 wiring ─────────────────────────────────────────────────────────────
  const ask = read('api/ask.js');
  const navAt = ask.indexOf("if (libNavValue === 'on' && libQuoteValue === 'on' && band === 'adult' && libFlagValue === 'on' && libToken !== ''");
  const quoteAt = ask.indexOf("if (libQuoteValue === 'on' && band === 'adult' && libFlagValue === 'on' && libToken !== '') {");
  const block = navAt > 0 ? ask.slice(navAt, quoteAt) : '';
  const ENV_READ = /process\.env\s*[.[]|import\.meta\.env/;
  ok('V7  the switch is read once in api/ask.js; the block sits before the quote seat with its gate and protections',
    (ask.match(/process\.env\.LIB_NAV_V1/g) || []).length === 1
    && /const libNavValue = String\(process\.env\.LIB_NAV_V1 \|\| ''\)\.trim\(\)\.toLowerCase\(\);/.test(ask)
    && navAt > 0 && quoteAt > navAt && block.includes('!graveHazard(currentQuestionText)') && block.includes(".outcome !== 'REFER_ADULT'")
    && block.includes('libNav.answerPageRequest(currentQuestionText') && !ENV_READ.test(read('lib/lib-nav.js')),
    JSON.stringify({ navAt, quoteAt }));

  // ── V8 the switch off ─────────────────────────────────────────────────────
  const off = await Q.answerQuoteRequest(Q.detectQuoteRequest(W16), {});
  ok('V8  the switch off: the quote seat answers a page request as it did',
    off && off.outcome === 'page_request' && off.text.includes('لا أستطيع أن أنقل لك صفحة بعينها برقمها'));

  console.log(`\n=== lib-nav-a: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== lib-nav-a: crashed ==='); process.exit(1); });
