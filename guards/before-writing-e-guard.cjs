// guards/before-writing-e-guard.cjs -- م٢-هـ (BEFORE_WRITING_V1): «حسب المذاهب» — each madhhab from
// its own retrieved text, with its reference; a madhhab with no text is said to have none.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-هـ) and its fixture: Sheikh Nayef al-Ajmi's
// «اذكر لي صفات صلاة الخوف حسب لمذاهب الاربعة» in «موجز» came back with no source card and four wrong
// madhhab procedures (the program order's own description; the text is not saved, decision D5).
// MEASURED (02-brain/measure/F): every madhhab book is in the library with print pages; one call over
// several books is taken over by one of them; the reader's frame («المذاهب») zeroes the books.
//
// WHAT THIS PINS:
//   H1  the madhhab question is recognised (with the sheikh's own spelling «لمذاهب»), a plain fiqh
//       question is not;
//   H2  driven: one library call per madhhab, each narrowed to ITS book (بدائع · الدردير/الدسوقي ·
//       المجموع · المغني), beside the comparative call; every book row is labelled with its madhhab;
//   H3  the madhhab rule rides with the texts, and a madhhab whose book returned nothing is NAMED;
//   H4  a plain fiqh question makes no madhhab calls;
//   H5  the sentence door takes a madhhab book's own text as that madhhab's text (and only that one's).
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json'
    : String(h).toLowerCase() === 'content-length' ? String(Buffer.byteLength(JSON.stringify(obj), 'utf8')) : null) },
  json: async () => obj, text: async () => JSON.stringify(obj),
});
const SHEIKH = 'اذكر لي صفات صلاة الخوف حسب لمذاهب الاربعة';
const BOOKS = { 'FC-003532': ['بدائع الصنائع', 'الكاساني', 'hanafi'], 'FC-003623': ['الشرح الكبير للدردير وحاشية الدسوقي', 'الدسوقي', 'maliki'],
  'FC-003660': ['المجموع شرح المهذب', 'النووي', 'shafii'], 'FC-003727': ['المغني', 'المقدسي، موفق الدين', 'hanbali'] };
const hit = (id, text, n = 1) => ({ atom_id: `${id}:0100:00${n}`, subject_id: id, book_title: BOOKS[id] ? BOOKS[id][0] : 'كتاب', author: BOOKS[id] ? BOOKS[id][1] : 'مؤلف',
  heading_path: ['باب صلاة الخوف'], heading_kind: 'section', volume: 1, page_start: 240 + n, page_end: 240 + n, page_citable: true, numbering: 'print',
  text, truncated: false, score: 10 });

async function main() {
  console.log('before-writing-e guard — root ' + REPO);
  let BW = null, LOOP = null, CONTRACT = null, ENC = null, RR = null;
  try {
    BW = await esm('lib/before-writing.js'); LOOP = await esm('lib/free-brain/loop.js');
    CONTRACT = await esm('lib/fatwa-contract.js'); ENC = await esm('lib/encyclopedia.js'); RR = await esm('lib/ruling-review.js');
  } catch (e) { ok('H0  the modules load', false, e.message); }
  if (!BW || !LOOP || !CONTRACT || !ENC) { console.log(`\n=== before-writing-e: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  const isQ = typeof BW.isMadhhabQuestion === 'function' ? BW.isMadhhabQuestion : () => null;
  ok('H1  the madhhab question is recognised — the sheikh\'s own spelling, «الأئمة الأربعة», two madhhabs named — a plain question is not',
    isQ(SHEIKH) === true && isQ('ما حكم القنوت في الفجر عند الأئمة الأربعة؟') === true
    && isQ('ما قول الحنفية والشافعية في مس المرأة؟') === true && isQ('تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟') === false);

  await quiet(() => ENC.searchStoredCorpus('الصلاة', { limit: 1 }));
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const drive = async (question) => {
    const lib = [];
    const provider = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        const body = JSON.parse(init.body);
        provider.push(body);
        return jsonResponse(u, { content: [{ type: 'text', text: String(body.system || '').startsWith('أنتَ فاحصُ') ? '{"claims":[]}' : 'جواب [[1]].' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    const fetchImpl = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://lib.ezik.app')) {
        const body = JSON.parse(init && init.body || '{}');
        lib.push(body);
        const ids = (body.filters && body.filters.book_ids) || [];
        // The Maliki book returns nothing: its madhhab must then be NAMED as having no text.
        if (ids.length === 1 && ids[0] === 'FC-003623') return jsonResponse(u, { hits: [], took_ms: 1, refused: false });
        if (ids.length === 1) return jsonResponse(u, { hits: [hit(ids[0], `باب صلاة الخوف من كتاب ${BOOKS[ids[0]][0]}: وصفتها عند أصحابنا كذا وكذا.`)], took_ms: 1, refused: false });
        return jsonResponse(u, { hits: [hit('FC-003592', 'بداية المجتهد: اختلفوا في صفة صلاة الخوف.')], took_ms: 1, refused: false });
      }
      if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
        const p = new URL(u).pathname;
        if (p === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
        if (p === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
        return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [], pagination: { total: 0 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: question }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' },
      }));
    } finally { globalThis.fetch = real; }
    const first = provider.find((b) => b.system === 'system') || provider[0] || {};
    const lastUser = [...(first.messages || [])].reverse().find((m) => m.role === 'user');
    const block = lastUser && Array.isArray(lastUser.content) ? lastUser.content.slice(1).map((b) => b.text || '').join('\n') : '';
    return { out, lib, block };
  };
  const sheikh = await drive(SHEIKH);
  const singles = sheikh.lib.filter((b) => b.filters && Array.isArray(b.filters.book_ids) && b.filters.book_ids.length === 1).map((b) => b.filters.book_ids[0]);
  ok('H2a one library call per madhhab, each narrowed to its own book, beside the comparative call',
    ['FC-003532', 'FC-003623', 'FC-003660', 'FC-003727'].every((id) => singles.includes(id))
    && sheikh.lib.some((b) => JSON.stringify(b.filters && b.filters.book_ids) === JSON.stringify(['FC-003910', 'FC-003592'])),
    JSON.stringify(sheikh.lib.map((b) => b.filters && b.filters.book_ids)));
  ok('H2b every madhhab book row is pinned labelled with its madhhab',
    sheikh.block.includes('من كتب الحنفية') && sheikh.block.includes('من كتب الشافعية') && sheikh.block.includes('من كتب الحنابلة'),
    sheikh.block.slice(0, 600));
  ok('H3  the madhhab rule rides with the texts, and the madhhab whose book returned nothing is NAMED',
    typeof BW.BW_MADHHAB_RULE === 'string' && sheikh.block.includes(BW.BW_MADHHAB_RULE)
    && /لم يُجمَعْ نصٌّ من كتبِ مذهبِ: المالكية\./u.test(sheikh.block), sheikh.block.slice(-400));
  const plain = await drive('تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟');
  ok('H4  a plain fiqh question makes no madhhab calls', !plain.lib.some((b) => b.filters && Array.isArray(b.filters.book_ids) && b.filters.book_ids.length === 1),
    JSON.stringify(plain.lib.map((b) => b.filters && b.filters.book_ids)));
  if (RR) {
    const hanbaliRow = { kind: 'lib_book', ref: 1, subjectId: 'FC-003727', bookTitle: 'المغني', fullText: 'فإذا جلس للتشهد قاموا فأتموا الصلاة والإمام ينتظرهم فإذا لحقوه سلم بهم وهذا اختيار أبي عبد الله.' };
    const hanafiRow = { kind: 'lib_book', ref: 2, subjectId: 'FC-003532', bookTitle: 'بدائع الصنائع', fullText: 'فإذا سلم الإمام ذهبت الطائفة إلى وجه العدو وجاء الأولون فأتموا صلاتهم وحدانا.' };
    const claim = 'وعند الحنابلة يجلس الإمام في التشهد والطائفة تتم ثم يسلم بهم.';
    const ask = (row, quote) => async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row, quote }] });
    const own = await RR.reviewRulings({ text: claim, rows: [hanbaliRow, hanafiRow], ask: ask(1, 'قاموا فأتموا الصلاة والإمام ينتظرهم فإذا لحقوه سلم بهم') });
    const other = await RR.reviewRulings({ text: claim, rows: [hanbaliRow, hanafiRow], ask: ask(2, 'ذهبت الطائفة إلى وجه العدو وجاء الأولون فأتموا صلاتهم') });
    ok('H5  the sentence door takes the Hanbali book\'s own text as the Hanbalis\' text, and not the Hanafi book\'s',
      own.record.supported === 1 && own.text === claim && other.record.supported === 0 && other.text !== claim,
      JSON.stringify({ own: own.record, other: other.record }));
  } else {
    ok('H5  the sentence door takes a madhhab book\'s own text as that madhhab\'s text', false, 'lib/ruling-review.js missing');
  }
  console.log(`\n=== before-writing-e: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
