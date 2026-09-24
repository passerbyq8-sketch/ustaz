// guards/lib-nav-e-guard.cjs -- م٥ (LIB_NAV_V1): the «المكتبة» section's server — the shelf, reading a book,
// and the one proxy the client reaches.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٥): «قسمٌ جديدٌ اسمُه «المكتبة»: تصفّحُ الكتبِ بأقسامِها
// ومؤلّفيها · أبوابُ الكتاب · القراءةُ صفحةً صفحةً بالتالي والسابق · البحثُ داخلَ الكتاب · النسخُ والمشاركة.
// قواعدُ النقلِ نفسُها.» MEASURED before it was built (05-library/measure/A–D): no section existed; the
// catalogue has no section column and its rows are pinned at six fields; the navigation routes sit on the
// preview instance only; and no gate would notice a library door that served a child, a withheld book, or
// a modern book page by page.
//
// WHAT THIS PINS (the real api/lib-nav.js handler, driven with one fake globalThis.fetch):
//   E1  the shelf: the sections file is aligned with the catalogue; every open book is on exactly one
//       section's pages and no withheld book is on any list, author list, title search or book lookup;
//   E2  the switch: off → `status` { enabled:false } and every other op 404, nothing asked upstream;
//   E3  who: on, an absent or child band → { enabled:false } and 404; an adult → enabled; a body that
//       claims adult with a child's age is a child;
//   E4  refusals that never reach the service: a modern or auto book's page, a withheld book (404, like an
//       unknown one), a bad id, another book's atom, GET, an unknown op;
//   E5  a heritage page by its number in Arabic-Indic digits: one POST /page to the configured preview
//       origin with the bearer; every atom whole; the card's REAL range; an envelope naming another book
//       is not shown;
//   E6  «التالي»: one POST /next {atom_id, unit:'page'}; the supplied atom never shown again; the end said;
//   E7  a chapter of an auto-numbered book, INCLUSIVE of its first atom (asked from the atom before it);
//       no page number anywhere; where the atom before is unreachable, `lead_missing` says so;
//   E8  a search inside a book goes through the one /search door narrowed to that book; a hit of another
//       book is dropped; a modern book gives ONE paragraph, no atom to open, no page to turn;
//   E9  the log: reason codes only, never the reader's search words; the door rows: api/lib-nav.js holds
//       no origin, no navCall( and no searchLibrary(.
// Red on the tree before this item: `node guards/lib-nav-e-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lib-quote.json'), 'utf8'));
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
  return false;
}
const PREVIEW = 'https://lib-preview.ezik.app';
const LIB_SEARCH = 'https://lib.ezik.app/search';
const TOKEN = 'tk-nav-5';
const ADULT = { band: 'adult', age: 30 };
const atom = (id, s, e, text, extra = {}) => ({
  atom_id: id, text, heading_path: ['كتاب الطهارة'], matn_spans: [], volume: 1,
  page_start: s, page_end: e, page_citable: true, numbering: 'print', ...extra,
});
const envelope = (bookId, atoms, extra = {}) => ({
  book_id: bookId, title: 't', author: 'a', volume: 1, page: atoms[0] ? atoms[0].page_start : null, page_citable: true,
  numbering: 'print', atoms, text: atoms.map((a) => a.text).join('\n'), next: null, prev: null, ...extra,
});
const jsonRes = (url, status, obj) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
  text: async () => JSON.stringify(obj), json: async () => obj,
});

async function main() {
  console.log('lib-nav-e guard — root ' + REPO);
  let S = null, H = null, CAT = null, SEC = null;
  try {
    S = await esm('lib/lib-shelf.js');
    SEC = await esm('lib/data/lib-sections.js');
    CAT = (await esm('lib/data/lib-catalog.js')).LIB_CATALOG;
    H = (await esm('api/lib-nav.js')).default;
  } catch (e) { ok('E0  the modules load', false, e.message); }
  if (!S || !H || !CAT || !SEC) {
    ok('E0  lib/lib-shelf.js, lib/data/lib-sections.js and api/lib-nav.js exist', false);
    console.log(`\n=== lib-nav-e: ${checks - failures}/${checks} PASS ===`); process.exit(1);
  }

  // ── E1 ────────────────────────────────────────────────────────────────────
  const blocked = new Set(CAT.filter((r) => r[5] === 1).map((r) => r[0]));
  const open = CAT.length - blocked.size;
  const seen = new Map();
  for (const s of S.shelf()) {
    for (let p = 1, pages = 1; p <= pages; p += 1) {
      const got = S.sectionBooks(s.id, p);
      pages = got.pages;
      for (const b of got.items) seen.set(b.id, (seen.get(b.id) || 0) + 1);
    }
  }
  const blockedAuthor = CAT.find((r) => r[0] === 'FC-004561')[2];
  const authorsEverywhere = S.shelf().flatMap((s) => S.sectionAuthors(s.id).authors.map((a) => a.name));
  ok('E1  the shelf: aligned; every open book once; no withheld book on any list, author list, search or lookup',
    S.sectionsAligned() === true && SEC.LIB_SECTION_OF.length === CAT.length && SEC.LIB_SECTIONS.length >= 30
    && seen.size === open && [...seen.values()].every((n) => n === 1) && ![...seen.keys()].some((id) => blocked.has(id))
    && S.shelf().reduce((n, s) => n + s.count, 0) === open
    && S.authorBooks(blockedAuthor).total === CAT.filter((r) => r[2] === blockedAuthor && r[5] !== 1).length
    && (CAT.some((r) => r[2] === blockedAuthor && r[5] !== 1) || !authorsEverywhere.includes(blockedAuthor))
    && !S.findBooks('مجلة الأستاذ').items.some((b) => b.id === 'FC-006906')
    && S.shelfBook('FC-006906') === null && S.shelfBook('FC-004561') === null && S.shelfBook('FC-000002').title === 'تفسير مجاهد'
    && S.findBooks('تفسير مجاهد').items.some((b) => b.id === 'FC-000002') && S.findBooks('x') === null,
    JSON.stringify({ seen: seen.size, open, sections: S.shelf().length }));

  // ── the driver ────────────────────────────────────────────────────────────
  const realFetch = globalThis.fetch;
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  async function drive(body, { env = {}, route = () => null, method = 'POST' } = {}) {
    const keys = ['LIB_NAV_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN', 'LIB_NAV_URL'];
    const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    const want = { LIB_NAV_V1: 'on', SHAMELA_BRAIN: 'on', SEARCH_API_TOKEN: TOKEN, LIB_NAV_URL: PREVIEW, ...env };
    for (const k of keys) { if (want[k] === undefined) delete process.env[k]; else process.env[k] = want[k]; }
    const calls = [];
    const logs = [];
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      let sent = null; try { sent = JSON.parse(init && init.body || 'null'); } catch { sent = null; }
      calls.push({ url: u, body: sent, auth: init && init.headers && (init.headers.authorization || init.headers.Authorization) });
      const r = route(u, sent, calls.length);
      if (!r) return jsonRes(u, 404, { error: { code: 'not_found', message: 'x' } });
      return jsonRes(r.url || u, r.status || 200, r.payload);
    };
    const res = { code: 0, body: null, headers: {},
      status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; } };
    const cap = (...a) => logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
    console.log = cap; console.warn = cap; console.error = cap; console.info = cap;
    let crashed = null;
    try { await H({ method, headers: {}, body }, res); } catch (e) { crashed = e; } finally {
      Object.assign(console, saved);
      globalThis.fetch = realFetch;
      for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
    }
    return { code: res.code, body: res.body, calls, logs, crashed, headers: res.headers };
  }

  // ── E2 ────────────────────────────────────────────────────────────────────
  const offStatus = await drive({ op: 'status', ...ADULT }, { env: { LIB_NAV_V1: undefined } });
  const offShelf = await drive({ op: 'shelf', ...ADULT }, { env: { LIB_NAV_V1: 'off' } });
  const offPage = await drive({ op: 'page', book_id: 'FC-000002', page: 1, ...ADULT }, { env: { LIB_NAV_V1: 'off' } });
  const noToken = await drive({ op: 'status', ...ADULT }, { env: { SEARCH_API_TOKEN: undefined } });
  ok('E2  the switch off: status { enabled:false }, every other op 404, nothing asked upstream',
    offStatus.code === 200 && offStatus.body.enabled === false && offShelf.code === 404 && offPage.code === 404
    && noToken.body.enabled === false
    && [offStatus, offShelf, offPage, noToken].every((r) => r.calls.length === 0 && !r.crashed),
    JSON.stringify([offStatus.body, offShelf.code, offPage.code]));

  // ── E3 ────────────────────────────────────────────────────────────────────
  const anon = await drive({ op: 'status' });
  const child = await drive({ op: 'status', band: 'young', age: 9 });
  const liar = await drive({ op: 'status', band: 'adult', age: 7 });
  const childShelf = await drive({ op: 'shelf', band: 'young', age: 9 });
  const adult = await drive({ op: 'status', ...ADULT });
  const adultShelf = await drive({ op: 'shelf', ...ADULT });
  ok('E3  who: an absent or child band is not served (a child\'s age beats an adult claim); an adult is',
    anon.body.enabled === false && child.body.enabled === false && liar.body.enabled === false && childShelf.code === 404
    && adult.body.enabled === true && adultShelf.code === 200 && Array.isArray(adultShelf.body.sections)
    && adultShelf.body.sections.length === S.shelf().length && adultShelf.headers['cache-control'] === 'private, no-store'
    && [anon, child, liar, childShelf, adult, adultShelf].every((r) => r.calls.length === 0 && !r.crashed),
    JSON.stringify([anon.body, child.body, liar.body, adult.body]));

  // ── E4 ────────────────────────────────────────────────────────────────────
  const modernPage = await drive({ op: 'page', book_id: 'FC-000095', page: 3, ...ADULT });
  const autoPage = await drive({ op: 'page', book_id: 'FC-000530', page: 3, ...ADULT });
  const modernNext = await drive({ op: 'next', book_id: 'FC-000095', atom_id: 'FC-000095:0003:001', ...ADULT });
  const withheld = await drive({ op: 'toc', book_id: 'FC-004561', ...ADULT });
  const withheldBook = await drive({ op: 'book', book_id: 'FC-006906', ...ADULT });
  const badId = await drive({ op: 'toc', book_id: 'FC-2', ...ADULT });
  const foreign = await drive({ op: 'next', book_id: 'FC-000002', atom_id: 'FC-004561:0001:001', ...ADULT });
  const get = await drive({ op: 'shelf', ...ADULT }, { method: 'GET' });
  const unknownOp = await drive({ op: 'raw', ...ADULT });
  ok('E4  refused without a call: a modern or auto page, a modern «next», a withheld book, a bad id, another book\'s atom, GET, an unknown op',
    modernPage.code === 200 && modernPage.body.notice === 'not_pages' && autoPage.body.notice === 'not_pages'
    && modernNext.body.notice === 'not_pages'
    && withheld.code === 404 && withheldBook.code === 404 && badId.code === 400 && foreign.code === 400
    && get.code === 405 && unknownOp.code === 400
    && [modernPage, autoPage, modernNext, withheld, withheldBook, badId, foreign, get, unknownOp].every((r) => r.calls.length === 0 && !r.crashed),
    JSON.stringify([modernPage.body, autoPage.body, withheld.code, withheldBook.code, badId.code, foreign.code, get.code, unknownOp.code]));

  // ── E5 ────────────────────────────────────────────────────────────────────
  const A1 = atom('FC-000002:0139:004', 139, 140, 'قال مجاهد في قوله تعالى: أول النص الطويل.');
  const A2 = atom('FC-000002:0140:001', 140, 141, 'وقال في الآية الأخرى: آخر النص.');
  const pageEnv = envelope('FC-000002', [A1, A2], { next: { book_id: 'FC-000002', volume: 1, page: 142, atom_id: 'FC-000002:0142:001' },
    prev: { book_id: 'FC-000002', volume: 1, page: 138, atom_id: 'FC-000002:0138:001' } });
  const pageRun = await drive({ op: 'page', book_id: 'FC-000002', page: '١٤٠', volume: '١', ...ADULT },
    { route: (u) => (u === PREVIEW + '/page' ? { payload: pageEnv } : null) });
  const pb = pageRun.body || {};
  const otherBook = await drive({ op: 'page', book_id: 'FC-000002', page: 140, ...ADULT },
    { route: (u) => (u === PREVIEW + '/page' ? { payload: { ...pageEnv, book_id: 'FC-004561' } } : null) });
  ok('E5  a heritage page: one POST /page to the preview origin, the bearer, whole atoms, the REAL range; another book\'s envelope is not shown',
    pageRun.code === 200 && pageRun.calls.length === 1 && pageRun.calls[0].url === PREVIEW + '/page'
    && JSON.stringify(pageRun.calls[0].body) === JSON.stringify({ book_id: 'FC-000002', page: 140, volume: 1 })
    && pageRun.calls[0].auth === 'Bearer ' + TOKEN
    && pb.mode === 'pages' && Array.isArray(pb.atoms) && pb.atoms.length === 2
    && pb.atoms[0].text === A1.text && pb.atoms[1].text === A2.text
    && /ص139–141/.test(pb.card) && !/ص140(?!–)/.test(pb.card.replace('ص139–141', ''))
    && pb.next && pb.next.page === 142 && pb.prev && pb.prev.page === 138
    && otherBook.code === 502 && !JSON.stringify(otherBook.body).includes('النص'),
    JSON.stringify({ code: pageRun.code, body: pb, calls: pageRun.calls.map((c) => c.url), other: otherBook.code }));

  // ── E6 ────────────────────────────────────────────────────────────────────
  const B1 = atom('FC-000002:0142:001', 142, 142, 'نص الصفحة التالية.');
  const nextRun = await drive({ op: 'next', book_id: 'FC-000002', atom_id: 'FC-000002:0140:001', ...ADULT },
    { route: (u) => (u === PREVIEW + '/next' ? { payload: envelope('FC-000002', [A2, B1]) } : null) });
  const endRun = await drive({ op: 'next', book_id: 'FC-000002', atom_id: 'FC-000002:0142:001', ...ADULT },
    { route: (u) => (u === PREVIEW + '/next' ? { payload: envelope('FC-000002', []) } : null) });
  ok('E6  «التالي»: one POST /next unit=page; the supplied atom never again; the end said',
    nextRun.code === 200 && nextRun.calls.length === 1
    && JSON.stringify(nextRun.calls[0].body) === JSON.stringify({ atom_id: 'FC-000002:0140:001', unit: 'page' })
    && nextRun.body.atoms.length === 1 && nextRun.body.atoms[0].atom_id === 'FC-000002:0142:001'
    && endRun.code === 200 && endRun.body.notice === 'end',
    JSON.stringify({ next: nextRun.body, end: endRun.body }));

  // ── E7 ────────────────────────────────────────────────────────────────────
  const auto = (id, text) => ({ atom_id: id, text, heading_path: ['باب القبائل'], matn_spans: [], volume: 1,
    page_start: Number(id.split(':')[1]), page_end: Number(id.split(':')[1]), page_citable: false, numbering: 'auto' });
  const P0 = auto('FC-000530:0004:002', 'آخر الباب السابق.');
  const H0 = auto('FC-000530:0005:001', 'أول الباب: نصه.');
  const H1 = auto('FC-000530:0005:002', 'تتمة الباب.');
  const autoEnv = (atoms, prev) => ({ ...envelope('FC-000530', atoms), numbering: 'auto', page: null, page_citable: false, prev });
  const chapter = await drive({ op: 'at', book_id: 'FC-000530', atom_id: H0.atom_id, ...ADULT }, {
    route: (u, b) => {
      if (u !== PREVIEW + '/next') return null;
      if (b.atom_id === H0.atom_id && b.unit === 'atom') return { payload: autoEnv([H1], { book_id: 'FC-000530', volume: 1, page: null, atom_id: P0.atom_id }) };
      if (b.atom_id === P0.atom_id && b.unit === 'page') return { payload: autoEnv([H0, H1], null) };
      return null;
    } });
  const cb = chapter.body || {};
  const lonely = await drive({ op: 'at', book_id: 'FC-000530', atom_id: H0.atom_id, ...ADULT }, {
    route: (u, b) => {
      if (u !== PREVIEW + '/next') return null;
      if (b.unit === 'atom') return { payload: autoEnv([H1], null) };
      if (b.atom_id === H0.atom_id && b.unit === 'page') return { payload: autoEnv([H1], null) };
      return null;
    } });
  const printed = JSON.stringify(cb);
  ok('E7  an auto-numbered chapter from its FIRST atom (asked from the atom before it); no page number; unreachable → lead_missing',
    chapter.code === 200 && cb.mode === 'chapters' && cb.atoms.length === 2 && cb.atoms[0].atom_id === H0.atom_id
    && cb.atoms.every((a) => a.page_start === null && a.page_end === null && a.volume === null)
    && !/ص\d|ج\d/.test(cb.card) && cb.card.includes('باب القبائل') && !cb.lead_missing
    && !/"page":\d/.test(printed)
    && lonely.code === 200 && lonely.body.lead_missing === true && lonely.body.atoms[0].atom_id === H1.atom_id,
    JSON.stringify({ chapter: cb, calls: chapter.calls.map((c) => c.body), lonely: lonely.body }));

  // ── E8 ────────────────────────────────────────────────────────────────────
  const fatwa = FIX.atoms.fatwa_print;
  const modern = FIX.atoms.modern_print;
  const stranger = { ...modern.response.hits[0], subject_id: 'FC-000095', atom_id: 'FC-000095:0001:001' };
  const fatwaRun = await drive({ op: 'find', book_id: fatwa.book_id, q: 'زكاة الغنم', ...ADULT }, {
    route: (u) => (u === LIB_SEARCH ? { payload: { ...fatwa.response, hits: [...fatwa.response.hits, stranger] } } : null) });
  const modernRun = await drive({ op: 'find', book_id: modern.book_id, q: modern.q, ...ADULT }, {
    route: (u) => (u === LIB_SEARCH ? { payload: modern.response } : null) });
  const fb = fatwaRun.body || {};
  const mb = modernRun.body || {};
  const sentFilter = fatwaRun.calls[0] && fatwaRun.calls[0].body && fatwaRun.calls[0].body.filters;
  ok('E8  a search inside a book: the one /search door, narrowed to it; another book\'s hit dropped; a modern book gives ONE paragraph and nothing to open',
    fatwaRun.code === 200 && fatwaRun.calls.length >= 1 && fatwaRun.calls.every((c) => c.url === LIB_SEARCH)
    && sentFilter && JSON.stringify(sentFilter.book_ids) === JSON.stringify([fatwa.book_id])
    && Array.isArray(fb.hits) && fb.hits.length === 3 && fb.hits.every((h) => h.atom_id && h.atom_id.startsWith(fatwa.book_id + ':'))
    && fb.hits[0].page === 50 && fb.hits[0].volume === 25
    && modernRun.code === 200 && mb.mode === 'paragraph' && mb.hits.length === 1 && mb.hits[0].atom_id === null
    && mb.hits[0].page === null && mb.hits[0].text.length <= 720 && mb.hits[0].text.length > 0,
    JSON.stringify({ f: fb.hits && fb.hits.map((h) => h.atom_id), m: mb, calls: fatwaRun.calls.map((c) => c.url) }));

  // ── E9 ────────────────────────────────────────────────────────────────────
  const words = 'كلمة البحث السرية';
  const failRun = await drive({ op: 'find', book_id: fatwa.book_id, q: words, ...ADULT }, { route: () => ({ status: 500, payload: { error: { code: 'boom' } } }) });
  const api = read('api/lib-nav.js');
  ok('E9  the log carries reason codes, never the search words; api/lib-nav.js holds no origin, navCall( or searchLibrary(',
    failRun.code === 502 && JSON.stringify(failRun.body) === '{"error":"unavailable"}'
    && failRun.logs.length >= 1 && !failRun.logs.join('\n').includes(words) && failRun.logs.some((l) => l.includes('[lib-nav]'))
    && api && !/https?:\/\//.test(api) && !api.includes('navCall(') && !api.includes('searchLibrary('),
    JSON.stringify({ code: failRun.code, logs: failRun.logs }));

  console.log(`\n=== lib-nav-e: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
