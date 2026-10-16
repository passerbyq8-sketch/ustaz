// guards/brain-line-z2-guard.cjs -- ITEM Z2 (128) -- 2026-10-15 brain-line
//
// THE POSITION IN THE ARTICLE. Measured on 7ba44481 (side-brain-line-2026-10-15/side/128-position.md, 128-input-side.md):
// an encyclopedia row reached the writer as the first 1200 characters of its article -- for «مسافة القصر» (F01656) an
// opening with 4 issue-word hits -- while atom #4 of the same article in the library (FC-003910, «شروط السفر > أن يبلغ
// المسافة المحددة شرعا») carries 14.
//
// What this guard holds (the order, Z2): for each encyclopedia row the judge keeps, the library is asked inside FC-003910
// with the issue's words and the term (up to 3 atoms x 1200 characters); the writer is given the atoms that meet the
// question more than the opening, in place of it; in every mode; and with the library closed, the opening as today.
// Fixture: fixtures/brain-line/z2-atoms.json -- atoms #4, #5, #6 copied verbatim (source lines in the file) by the session
// tool tools/z2-extract.mjs from C:/EZIK-LIB/atoms/32-098/FC-003910.jsonl; the record is F01656 of lib/data/fiqh-search.json.gz;
// the question «مسافة القصر» is the witness of side/128-position.md, line 3.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 300);

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  const SSE = await esm('lib/finalized-sse-writer.js');
  const FX = JSON.parse(fs.readFileSync(path.join(REPO, 'fixtures/brain-line/z2-atoms.json'), 'utf8'));
  const index = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(REPO, 'lib/data/fiqh-search.json.gz'))).toString());
  const record = index.find((r) => r.id === 'F01656');
  const Q = 'مسافة القصر';
  ok('the fixture: atom #4 carries 14 issue-word hits, the opening 4 (as measured)', FX.atoms[0].index === 4 && FX.atoms[0].hits === 14 && FX.snippetHits === 4 && !!record);
  const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, headersSent: false,
    write(c) { this.headersSent = true; this.writes.push(String(c)); return true; }, end() { this.ended += 1; return this; },
    status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; }, flushHeaders() { this.headersSent = true; },
    once() { return this; }, on() { return this; }, removeListener() { return this; } });
  const turn = async ({ libOn, mode }) => {
    const asked = [];
    const runTool = async (name, input, own) => {
      const ids = Array.isArray(own && own.bookIds) ? own.bookIds : [];
      if (name === 'search_library') asked.push({ query: String(input && input.query || ''), ids });
      // The library holds the article's atoms; it answers only a search confined to FC-003910 alone.
      if (name === 'search_library' && ids.length === 1 && ids[0] === 'FC-003910') {
        FX.atoms.slice().reverse().forEach((a, i) => own.table.add({ kind: 'library', title: 'الموسوعة الفقهية الكويتية', bookId: 'FC-003910', recordId: 'A' + a.index, text: a.text, fullText: a.text }));
      }
      return { text: '', calls: 1 };
    };
    const bodies = [];
    const t = target();
    const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
    await BW2.runBw2Turn({
      question: Q, messages: [{ role: 'user', content: Q }], wire: BW2.createBw2Wire(facade), mode,
      libFlagValue: libOn ? 'on' : '', libToken: libOn ? 't' : '',
      deps: {
        runTool, searchStoredCorpus: async () => ({ records: [record] }), encyclopediaReady: () => true, warmEncyclopedia: () => true,
        ask: async () => '{"d":{"1":1}}',
        callWriter: async ({ body, onText }) => { bodies.push(body); onText('مسافة القصر عند الجمهور أربعة برد [[1]].'); return { stop_reason: 'end_turn', usage: {} }; },
      },
    });
    const pinned = bodies[0] ? JSON.stringify(bodies[0].messages) : '';
    return { pinned, asked };
  };
  const atom4 = FX.atoms[0].text.slice(0, 80);
  const opening = String(record.snippet).replace(/\s+/g, ' ').slice(0, 60);
  const inPinned = (pinned, slice) => JSON.parse(pinned || '[]').flatMap((m) => (Array.isArray(m.content) ? m.content : [{ text: m.content }])).some((c) => String(c.text || '').replace(/\s+/g, ' ').includes(slice.replace(/\s+/g, ' ')));
  for (const mode of ['عادي', 'deep']) {
    const on = await turn({ libOn: true, mode });
    ok(mode + ': the library is asked inside FC-003910 alone, with the term and the issue', on.asked.some((a) => a.ids.length === 1 && a.ids[0] === 'FC-003910' && a.query.includes('مسافه') && a.query.includes('القصر')), ascii(JSON.stringify(on.asked)));
    ok(mode + ': the writer is given the atom with 14 hits, not the opening with 4', inPinned(on.pinned, atom4) && !inPinned(on.pinned, opening), ascii(on.pinned.slice(-500)));
  }
  const off = await turn({ libOn: false, mode: 'عادي' });
  ok('library closed: the opening, as today', inPinned(off.pinned, opening) && !inPinned(off.pinned, atom4), ascii(off.pinned.slice(-400)));
  ok('the choice rule: atoms only when they meet the question more than the opening', typeof BW2.chooseEncyclopediaPosition === 'function'
    && BW2.chooseEncyclopediaPosition('نص لا صلة له', [{ text: 'نص آخر لا صلة له' }], Q) === null
    && typeof BW2.chooseEncyclopediaPosition(record.snippet, FX.atoms.map((a) => ({ text: a.text })), Q) === 'string');
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-z2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
