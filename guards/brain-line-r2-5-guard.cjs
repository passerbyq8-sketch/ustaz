// guards/brain-line-r2-5-guard.cjs -- ITEM r2-5 -- 2026-10-17 brain-line R2
//
// THE FATWA TEXT IS NOT PRINTED TWICE. Measured on the preview of fa778c0e (sessions/side-brain-fix-2026-10-15/
// EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt lines 178-181, E2 «ماذا قال النووي في المجموع عن حكم مس المصحف للمحدث؟»):
// one card (binothaimeen.net) and "the same question and answer are printed again after a second «الجواب:»". The path
// that does it (case a of the order): before writing shows the stored fatwa above the writer (lib/before-writing-v2.js,
// W3 b, serverOwnedBlock), and the writer then copies its question and answer into its own prose; the releaser's repeat
// check compared a unit only with what the releaser itself had sent, never with the block shown above it.
//
// What this guard holds (the R2 order, item 5), on the real runBw2Turn with the stored replies of guards/
// fixtures-speed-wasl-fatwas.json (the W3 b harness of guards/speed-pipes-guard.cjs):
//   (1) a writer that copies the shown fatwa (its question, «الجواب:», its answer) -> «الجواب:» once, the card kept;
//   (2) a writer that explains in its own words is untouched;
//   (3) case b, lib/hybrid-deen.js: two records carrying one text -> one block; two different fatwas -> two blocks (E3,
//       report lines 191-200, is one block and other scholars' prose -- not broken).
'use strict';
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 400);

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  const TOOLS = await esm('lib/free-brain/tools.js');
  const SSE = await esm('lib/finalized-sse-writer.js');
  const ASKM = await esm('api/ask.js');
  const STORE = require('./fixtures-speed-wasl-fatwas.json');
  const replay = async (u) => {
    const e = STORE[String(u)];
    if (!e) return { ok: false, status: 404, url: String(u), headers: { get: () => 'application/json' }, text: async () => '{}', json: async () => ({}) };
    return { ok: true, status: e.status, url: String(u), redirected: false, headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? e.ct : null) }, text: async () => e.body, json: async () => JSON.parse(e.body) };
  };
  const storeRecord = (host, id) => {
    for (const e of Object.values(STORE)) {
      let j = null; try { j = JSON.parse(e.body); } catch { continue; }
      for (const r of (j && j.results) || []) if (String(r.id) === String(id) && String(r.source && r.source.url || '').includes(host)) return r;
    }
    return null;
  };
  const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k] = v; },
    write(c) { this.writes.push(String(c)); return true; }, end() { this.ended += 1; }, flushHeaders() {} });
  const textOf = (t) => t.writes.join('').split('\n\n').filter((l) => l.startsWith('data: ')).map((l) => { try { return JSON.parse(l.slice(6)); } catch { return null; } })
    .filter((f) => f && f.type === 'content_block_delta').map((f) => f.delta.text).join('');
  const turn = async (question, markTitle, writer) => {
    const t = target();
    const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
    const out = await BW2.runBw2Turn({
      question, messages: [{ role: 'user', content: question }], wire: BW2.createBw2Wire(facade), band: 'adult',
      cards: { buildSourceTag: ASKM.buildSourceTag, buildBookTag: ASKM.buildBookTag, encyclopediaCards: false, max: 3 },
      deps: {
        runTool: (name, input, ctx) => (name === 'search_fatawa' ? TOOLS.runTool(name, input, { ...ctx, fetchImpl: replay }) : Promise.resolve({ text: '', added: [], calls: 0 })),
        searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, warmEncyclopedia: () => true,
        ask: async ({ user }) => { const d = {}; for (const m of user.matchAll(/^\[(\d+)\] fatwa: (.*)$/gmu)) d[m[1]] = m[2].trim() === markTitle ? 2 : 1; return JSON.stringify({ d }); },
        callWriter: async ({ onText }) => { onText(writer); return { stop_reason: 'end_turn', usage: {} }; },
      },
    });
    return { out, text: textOf(t) };
  };
  // the W3 b case of guards/speed-pipes-guard.cjs («fitr»: binbaz 5348)
  const Q = 'هل يجوز دفع زكاة الفطر نقودا بدل الطعام؟';
  const TITLE = 'حكم إخراج زكاة الفطر نقوداً';
  const rec = storeRecord('binbaz.org.sa', 5348);
  ok('the stored record of the W3 b fixture is there', !!rec && !!rec.content && !!rec.content.question && !!rec.content.answer);
  if (rec) {
    const copied = 'وقد سئل الشيخ عن ذلك.\n\nالسؤال: ' + rec.content.question + '\n\nالجواب: ' + rec.content.answer + ' [[1]]';
    console.log('-- 1. the writer copies the fatwa shown above it');
    const r = await turn(Q, TITLE, copied);
    const answers = (r.text.match(/الجواب:/gu) || []).length;
    ok('the stored fatwa opens the answer (the block is shown)', r.out.telemetry.directFatwa === true && r.text.startsWith('## نص الفتوى'), ascii(r.text.slice(0, 80)));
    ok('al-jawab: once in the answer (it was twice)', answers === 1, String(answers));
    ok('...and the page card stays', r.text.includes('https://binbaz.org.sa/fatwas/5348'));
    console.log('-- 2. the writer explains in its own words');
    const own = await turn(Q, TITLE, 'يرى الشيخ أن زكاة الفطر لا تخرج نقودا، وإنما تخرج طعاما كما فرضها النبي صلى الله عليه وسلم [[1]].');
    ok('an explanation in the writer\'s own words is released as it was', own.text.includes('يرى الشيخ أن زكاة الفطر لا تخرج نقودا') && (own.text.match(/الجواب:/gu) || []).length === 1, ascii(own.text.slice(-160)));
  }
  console.log('-- 3. two records, one text (case b) / two fatwas');
  const HD = await esm('lib/hybrid-deen.js');
  const dedupe = typeof HD.distinctFatwaBlocks === 'function' ? HD.distinctFatwaBlocks : (blocks) => blocks;
  const B1 = '## نص الفتوى — ابن باز: حكم كذا\n\nالسؤال: ما حكم كذا؟\nالجواب: الحمد لله، حكمه كذا.';
  const B1b = '## نص الفتوى — ابن باز: حكم كذا (2)\n\nالسؤال:  ما حكم كذا ؟\nالجواب: الحمد لله، حكمه كذا .';
  const B2 = '## نص الفتوى — البراك: حكم كذا\n\nالسؤال: ما حكم كذا؟\nالجواب: ما له أصل.';
  ok('two blocks of one text (by normalization) -> the first alone', JSON.stringify(dedupe([B1, B1b])) === JSON.stringify([B1]));
  ok('two different fatwas -> two blocks', dedupe([B1, B2]).length === 2);
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-5: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
