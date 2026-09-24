// guards/lib-nav-b-guard.cjs -- م٤-ب (LIB_NAV_V1): «كمّل» after a quotation gives what follows it, never an
// atom twice; a modern book is said to be one paragraph.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٤-ب): «كمّل»: ما بعدَ آخرِ نقلٍ في المحادثة — المقطعُ أو
// الصفحةُ التالية — للتراثِ والفتاوى؛ والمعاصرُ يُقالُ فيه إنّه فقرةٌ واحدة. MEASURED before it was built
// (04-quote/measure/B-continue.md): the quote reply carried no ids and the server kept no state, so the
// button's sentence went to the model with the quotation in front of it and nothing to stop it
// "continuing" the book from memory.
//
// WHAT THIS PINS:
//   K1  the cursor: an EMPTY book chip (no title, author, ref, matn or cut — the attributes the client
//       draws), read only from the assistant turn right before the reader's message, and taken out of
//       every assistant turn; the same array back when there is none;
//   K2  «كمّل»: the button's frozen sentence byte for byte (read off app.jsx) and the short forms; not a
//       longer message that merely starts with the word;
//   K3  a heritage page: ONE POST /next {atom_id, unit:'page'}; the supplied atom never shown again; the
//       card's real range; the new cursor at the last atom shown;
//   K4  a cut atom: its printed page re-read, and the rest of THAT atom given before anything else;
//   K5  auto → unit 'atom'; modern → said, no call; withheld → refused, no call; an unknown book → not
//       ours; the end of the book → said; a cursor whose answer names another book → not quoted;
//   K6  api/ask.js: the cursor is read and every marker stripped right after the history is validated,
//       before routing reads it; «كمّل» is tried before a page; the marker rides on every quotation only
//       with the switch on; the quote seat's text is what it was.
// Red on the tree before this item: `node guards/lib-nav-b-guard.cjs --root <tree>`.
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
const atom = (id, s, e, text, extra = {}) => ({
  atom_id: id, text, heading_path: ['كتاب الصلاة'], matn_spans: [], volume: 1,
  page_start: s, page_end: e, page_citable: true, numbering: 'print', ...extra,
});
const jsonRes = (url, status, obj) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
  text: async () => JSON.stringify(obj), json: async () => obj,
});

async function main() {
  console.log('lib-nav-b guard — root ' + REPO);
  let C = null, N = null;
  try { C = await esm('lib/quote-cursor.js'); N = await esm('lib/lib-nav.js'); } catch (e) { ok('K0  the modules load', false, e.message); }
  if (!C || !N || typeof N.answerContinue !== 'function') {
    ok('K0  lib/quote-cursor.js and answerContinue exist', false);
    console.log(`\n=== lib-nav-b: ${checks - failures}/${checks} PASS ===`); process.exit(1);
  }

  // ── K1 ────────────────────────────────────────────────────────────────────
  const marker = C.cursorMarker({ bid: 'FC-003592', at: 'FC-003592:0140:003' });
  const quoteReply = '📖 «بداية المجتهد» · ابن رشد · ج1 · ص140\n\n> نص.' + marker;
  const history = [
    { role: 'user', content: 'انقل لي الصفحة ١٤٠' }, { role: 'assistant', content: quoteReply },
    { role: 'user', content: 'كمّل' },
  ];
  const old = [{ role: 'user', content: 'س' }, { role: 'assistant', content: quoteReply }, { role: 'user', content: 'سؤال آخر' },
    { role: 'assistant', content: 'جواب' }, { role: 'user', content: 'كمّل' }];
  const stripped = C.stripCursorMarkers(history);
  const clean = [{ role: 'user', content: 'a' }];
  ok('K1  an empty chip, read only from the turn right before, taken out of every assistant turn',
    marker === '\n<book bid="FC-003592" at="FC-003592:0140:003"></book>'
    && !/title=|author=|ref=|matn=|cut=/.test(marker) && />\s*<\/book>$/.test(marker) && !/>[^<\s][^<]*<\/book>/.test(marker)
    && JSON.stringify(C.readCursor(history)) === JSON.stringify({ bid: 'FC-003592', at: 'FC-003592:0140:003' })
    && C.readCursor(old) === null
    && stripped !== history && stripped[1].content === '📖 «بداية المجتهد» · ابن رشد · ج1 · ص140\n\n> نص.'
    && C.stripCursorMarkers(clean) === clean
    && C.cursorMarker({ bid: 'bad"id', at: 'x' }) === '',
    JSON.stringify({ marker, read: C.readCursor(history) }));

  // ── K2 ────────────────────────────────────────────────────────────────────
  const app = read('app.jsx');
  const frozen = (/key: 'continue', label: ezT\('chat\.qa\.continue'\),\s*prompt: '([^']+)'/.exec(app) || [])[1] || '';
  ok('K2  the button\'s frozen sentence byte for byte, and the short forms; not a longer message',
    frozen !== '' && C.CONTINUE_PROMPT === frozen && C.isContinueRequest(frozen)
    && ['كمّل', 'كمل', 'أكمل', 'تابع', 'وبعدين', 'الصفحة التالية', 'كمّل النص', 'كمل لو سمحت'].every((t) => C.isContinueRequest(t))
    && !C.isContinueRequest('كمّل لي قصة عن الصحابة') && !C.isContinueRequest('ما حكم التكملة؟'),
    JSON.stringify({ frozen }));

  // ── the fake service ──────────────────────────────────────────────────────
  const calls = [];
  const serve = (routes) => async (url, init) => {
    const u = new URL(String(url));
    const body = JSON.parse(init.body);
    calls.push({ origin: u.origin, path: u.pathname, body });
    const r = routes[u.pathname];
    const out = typeof r === 'function' ? r(body) : r;
    return jsonRes(url, out ? out.status : 404, out ? out.body : { error: { code: 'x', message: '' } });
  };
  const DEPS = (routes) => ({ flagValue: 'on', token: 'tk-guard-nav', baseUrl: 'https://lib-preview.ezik.app', fetchImpl: serve(routes) });
  const nextPage = { book_id: 'FC-003592', title: 't', author: 'a', volume: 1, page: 141, page_citable: true, numbering: 'print',
    atoms: [atom('FC-003592:0140:003', 140, 141, 'مكرر'), atom('FC-003592:0141:001', 141, 141, 'تتمة الصفحة.'), atom('FC-003592:0142:001', 142, 142, 'الصفحة التالية.')] };
  nextPage.text = nextPage.atoms.map((x) => x.text).join('\n');

  // ── K3 ────────────────────────────────────────────────────────────────────
  calls.length = 0;
  const k3 = await N.answerContinue({ bid: 'FC-003592', at: 'FC-003592:0140:003' }, DEPS({ '/next': { status: 200, body: nextPage } }));
  ok('K3  one POST /next unit=page; the supplied atom not shown again; the real range; the new cursor',
    k3 && k3.outcome === 'continue_quoted' && calls.length === 1 && calls[0].path === '/next'
    && JSON.stringify(calls[0].body) === JSON.stringify({ atom_id: 'FC-003592:0140:003', unit: 'page' })
    && !k3.text.includes('مكرر') && k3.text.startsWith('📖 «بداية المجتهد ونهاية المقتصد» · ابن رشد الحفيد · ج1 · ص141–142')
    && k3.cursor && k3.cursor.at === 'FC-003592:0142:001',
    JSON.stringify({ k3, calls }));

  // ── K4 a cut atom ─────────────────────────────────────────────────────────
  calls.length = 0;
  const full = 'أوّلُ الذرّة التي قُطعت عند السقف، ' + 'ثمّ بقيّتُها التي لم تُعرَض بعد.';
  const shown = 'أوّلُ الذرّة التي قُطعت عند السقف، ';
  const pageAgain = { book_id: 'FC-003592', title: 't', author: 'a', volume: 1, page: 140, page_citable: true, numbering: 'print',
    atoms: [atom('FC-003592:0140:002', 140, 140, full)] };
  pageAgain.text = full;
  const k4 = await N.answerContinue({ bid: 'FC-003592', at: 'FC-003592:0140:002', from: shown.length, v: 1, p: 140 },
    DEPS({ '/page': { status: 200, body: pageAgain } }));
  ok('K4  a cut atom: its printed page re-read, and the rest of THAT atom first',
    k4 && k4.outcome === 'continue_rest' && calls.length === 1 && calls[0].path === '/page'
    && k4.text.endsWith('> ثمّ بقيّتُها التي لم تُعرَض بعد.') && !k4.text.includes('أوّلُ الذرّة')
    && k4.cursor && k4.cursor.at === 'FC-003592:0140:002' && k4.cursor.from === undefined,
    JSON.stringify({ k4, calls }));

  // ── K5 ────────────────────────────────────────────────────────────────────
  calls.length = 0;
  const auto = await N.answerContinue({ bid: 'FC-004553', at: 'FC-004553:0001:001' },
    DEPS({ '/next': { status: 200, body: { book_id: 'FC-004553', title: 't', author: 'a', volume: 1, page: null, page_citable: false, numbering: 'auto',
      atoms: [atom('FC-004553:0002:001', 2, 2, 'الفتوى التالية.', { page_citable: false, numbering: 'auto', heading_path: ['باب الطهارة'] })], text: 'الفتوى التالية.' } } }));
  const autoCall = calls[0] && calls[0].body;
  calls.length = 0;
  const modern = await N.answerContinue({ bid: 'FC-003794', at: 'FC-003794:0030:002' }, DEPS({}));
  const blocked = await N.answerContinue({ bid: 'FC-006906', at: 'FC-006906:0001:001' }, DEPS({}));
  const noCalls = calls.length;
  const unknown = await N.answerContinue({ bid: 'FC-999999', at: 'FC-999999:1:1' }, DEPS({}));
  const end = await N.answerContinue({ bid: 'FC-003592', at: 'FC-003592:9999:001' },
    DEPS({ '/next': { status: 200, body: { book_id: 'FC-003592', atoms: [], text: '', next: null } } }));
  const forged = await N.answerContinue({ bid: 'FC-003592', at: 'FC-003794:0030:002' },
    DEPS({ '/next': { status: 200, body: { ...nextPage, book_id: 'FC-003794' } } }));
  ok('K5  auto → unit atom; modern and withheld → no call; unknown → not ours; the end → said; another book → not quoted',
    auto && auto.outcome === 'continue_quoted' && autoCall && autoCall.unit === 'atom' && auto.text.includes('باب الطهارة')
    && modern && modern.outcome === 'continue_modern' && modern.text.includes('فقرةٌ واحدة')
    && blocked && blocked.outcome === 'continue_blocked' && noCalls === 0
    && unknown === null && end && end.outcome === 'continue_end'
    && forged && forged.outcome === 'continue_unavailable',
    JSON.stringify({ auto: auto && auto.outcome, autoCall, modern: modern && modern.outcome, end: end && end.outcome, forged: forged && forged.outcome }));

  // ── K6 wiring ─────────────────────────────────────────────────────────────
  const ask = read('api/ask.js');
  const at = (s) => ask.indexOf(s);
  const readAt = at('const quoteCursor = readCursor(body.messages);');
  const stripAt = at('body.messages = stripCursorMarkers(body.messages);');
  const Q = await esm('lib/lib-quote.js');
  const quoteSrc = read('lib/lib-quote.js');
  ok('K6  read and stripped right after validation and before routing; «كمّل» before a page; the marker only with the switch',
    readAt > at('body.messages = messages;') && stripAt > readAt && stripAt < at('const route = classifyRoute(body.messages);')
    && at('libNav.answerContinue(quoteCursor, navDeps)') > 0 && at('libNav.answerContinue(quoteCursor, navDeps)') < at('libNav.answerPageRequest(currentQuestionText, navDeps)')
    && at("if (libNavValue === 'on' && quoted.cursor) quoted.text += cursorMarker(quoted.cursor);") > 0
    && at("if (libNavValue === 'on' && quoted.cursor) quoted.text += cursorMarker(quoted.cursor);") < at('return libQuote.writeQuoteReply(res, quoted.text);')
    && /cursor: quoteCursorOf\(atom\)/.test(quoteSrc) && typeof Q.answerQuoteRequest === 'function',
    JSON.stringify({ readAt, stripAt }));

  // ── K7 one door ───────────────────────────────────────────────────────────
  // The owner's «باب واحد» (route ب, 19 September) applied to the navigation door, as libbook A7 applies
  // it to searchLibrary: `navCall(` is called from lib/lib-nav.js alone, and no other file names the
  // navigation origin.
  const sites = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'guards'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:js|jsx|cjs|mjs)$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        if (/\bnavCall\s*\(/.test(src) || /lib-preview\.ezik\.app/.test(src)) sites.push(path.relative(REPO, full).replace(/\\/g, '/'));
      }
    }
  };
  walk(REPO);
  ok('K7  one door: navCall( and the navigation origin live in lib/lib-nav.js alone',
    JSON.stringify(sites) === JSON.stringify(['lib/lib-nav.js']), JSON.stringify(sites));

  console.log(`\n=== lib-nav-b: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== lib-nav-b: crashed ==='); process.exit(1); });
