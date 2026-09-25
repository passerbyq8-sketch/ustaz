// guards/before-writing-d-guard.cjs -- م٢-د (BEFORE_WRITING_V1): no ruling without a text. A fiqh
// question for which nothing was gathered is not answered from the model's memory; the answer says so.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-د): «لا حكمَ بلا نصّ: سؤالُ حكمٍ بلا دليلٍ مسترجَعٍ
// لا يُجابُ من حفظِ النموذج؛ يُقالُ ذلك». And its caution, from the owner's own item-32 test
// (EZIK-ITEM32-OWNER-TEST-2026-09-24.md): «"لا حكمَ بلا نصّ" لا يُسقِطُ المستقرّ» — the answer that said
// «لم أقف في المراجع المتاحة على نص صريح في مقدار نصابها» was wrong because the library holds it. So
// this item acts ONLY when the gathering returned nothing at all; a partial gathering is the writer's
// rule ٤ and the sentence door's business, sentence by sentence.
//
// WHAT THIS PINS:
//   N1  nothing gathered ⟹ the pinned block carries the no-text rule beside the writing rules;
//   N2  a ruling the writer wrote anyway is taken out, the answer says no text was found, the reader
//       is offered «وسّع البحث في المصادر», and no reading call is spent on an empty set of texts;
//   N3  texts gathered ⟹ no no-text rule.
// Red on the tree before this item (b2be125 + ج): `node guards/before-writing-d-guard.cjs --root <tree>`.
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
const WIDEN = 'وسّع البحث في المصادر';
// An issue no store holds: nonsense words, so every store answers empty (checked in N0 below).
const NO_TEXT_Q = 'ما حكم زغبلقة الدرطبوس؟';
const HAS_TEXT_Q = 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟';

async function main() {
  console.log('before-writing-d guard — root ' + REPO);
  let LOOP = null, CONTRACT = null, ENC = null, BW = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js'); CONTRACT = await esm('lib/fatwa-contract.js');
    ENC = await esm('lib/encyclopedia.js'); BW = await esm('lib/before-writing.js');
  } catch (e) { ok('N0  the modules load', false, e.message); }
  if (!LOOP || !CONTRACT || !ENC || !BW) { console.log(`\n=== before-writing-d: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  const probe = await quiet(() => ENC.searchStoredCorpus(BW.libraryQuery(NO_TEXT_Q), { limit: 6 }));
  const encHits = (probe.records || []).filter((r) => String(r.snippet || '').trim() !== '').length;
  ok('N0  the fixture issue has no encyclopedia text (so the gathering is truly empty)', encHits === 0, 'hits=' + encHits);
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const drive = async (question, replyText) => {
    const provider = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        const body = JSON.parse(init.body);
        provider.push(body);
        return jsonResponse(u, { content: [{ type: 'text', text: String(body.system || '').startsWith('أنتَ فاحصُ') ? '{"claims":[]}' : replyText }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.startsWith('https://lib.ezik.app')) return jsonResponse(u, { hits: [], took_ms: 1, refused: false });
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
    return { out, provider, block };
  };
  const RULING = 'يجوز ذلك بلا حرج، ولا شيء عليك.';
  const empty = await drive(NO_TEXT_Q, RULING);
  ok('N1  nothing gathered: the pinned block carries the no-text rule beside the writing rules',
    typeof BW.BW_NO_TEXT_RULE === 'string' && empty.block.includes(BW.BW_NO_TEXT_RULE) && empty.block.includes(BW.BW_WRITE_RULES)
    && empty.out.storedInjection.rows === 0, JSON.stringify({ rows: empty.out.storedInjection.rows, tail: empty.block.slice(-200) }));
  const text = String(empty.out.text || '');
  ok('N2  and a ruling written anyway is taken out, the answer says no text was found, the reader is offered the widening',
    !text.includes('يجوز ذلك') && text.includes('لم أقفْ على نصٍّ') && text.includes(WIDEN)
    && empty.provider.filter((b) => b.system === 'system').length === 1
    && !empty.provider.some((b) => String(b.system || '').startsWith('أنتَ فاحصُ')), JSON.stringify({ calls: empty.provider.length, text }));
  const full = await drive(HAS_TEXT_Q, 'لا ينقض خروج الدم الوضوء [[1]].');
  ok('N3  texts gathered: no no-text rule', full.out.storedInjection.rows > 0 && !full.block.includes(BW.BW_NO_TEXT_RULE || '\u0000'),
    JSON.stringify({ rows: full.out.storedInjection.rows }));
  console.log(`\n=== before-writing-d: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
