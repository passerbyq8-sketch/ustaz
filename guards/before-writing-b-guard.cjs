// guards/before-writing-b-guard.cjs -- م٢-ب (BEFORE_WRITING_V1): ONE writing round from the pinned
// evidence, no tool rounds and no live search awaited; when the texts do not suffice the answer says
// so and the reader is offered «وسّع البحث في المصادر».
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ب): «جولةُ نموذجٍ واحدة تكتبُ من الدليلِ المثبَّت؛
// والبحثُ الحيُّ لا يُنتظَر: إن لم يكفِ الدليلُ قالَ الجوابُ ذلك صراحةً، وعرضَ توسيعَ البحثِ خيارًا يطلبُه
// القارئ». MEASURED before it was built: the owner's two «طالب علم» answers of 24 September spent six
// near-silent tool rounds (textChars 0-81) and then wrote everything in the tools-removed write
// (program-2026-09-24/01-item32/prod-log-extract.txt) — the pinned evidence makes those rounds idle.
//
// WHAT THIS PINS:
//   D1  a before-writing fiqh turn makes exactly ONE provider call, with no `tools`, carrying the
//       pinned texts AND the writing rules, and names it `before_writing:single_write`;
//   D2  that call is the non-streamed write: its finish state is the answer's (`deliveredStop`);
//   D3  an answer that says it found no text carries the «وسّع البحث في المصادر» chip — as the first
//       item of its own <suggestions>, or in a block of its own — and an answer that did not say so
//       carries none;
//   D4  withWidenOffer on its own: nothing gathered ⟹ the chip; never twice;
//   D5  the switch off: the tool loop runs as before (the first call offers tools), and no chip.
// Red on the tree before this item (0d670d0): `node guards/before-writing-b-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
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
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 400) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}
const WIDEN = 'وسّع البحث في المصادر';
const T7 = 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟';
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => {
    const k = String(h).toLowerCase();
    if (k === 'content-type') return 'application/json';
    if (k === 'content-length') return String(Buffer.byteLength(JSON.stringify(obj), 'utf8'));
    return null;
  } },
  json: async () => obj, text: async () => JSON.stringify(obj),
});

async function main() {
  console.log('before-writing-b guard — root ' + REPO);
  let LOOP = null, CONTRACT = null, ENC = null, BW = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    CONTRACT = await esm('lib/fatwa-contract.js');
    ENC = await esm('lib/encyclopedia.js');
    BW = await esm('lib/before-writing.js');
  } catch (e) { ok('D0  the modules load', false, e.message); }
  if (!LOOP || !CONTRACT || !ENC || !BW) { console.log(`\n=== before-writing-b: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  await quiet(() => ENC.searchStoredCorpus('الوضوء', { limit: 1 }));
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const fatwaRecord = {
    id: 'g-1', uid: 'binbaz:g-1', scholar: { id: 'binbaz' }, source: { url: 'https://binbaz.org.sa/fatwas/9999/g' },
    title: 'حكم خروج الدم الكثير من البدن هل ينقض الوضوء',
    content: { type: 'question_answer', question: 'هل خروج الدم الكثير من غير السبيلين ينقض الوضوء؟',
      answer: 'خروج الدم من غير السبيلين لا ينقض الوضوء على الصحيح وإن كثر.' },
  };
  const drive = async (question, extra, replyText, stop = 'end_turn') => {
    const provider = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        provider.push(JSON.parse(init.body));
        return jsonResponse(u, { content: [{ type: 'text', text: replyText }], stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } });
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
        return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [fatwaRecord], pagination: { total: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn(Object.assign({
        messages: [{ role: 'user', content: question }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
      }, extra)));
    } finally { globalThis.fetch = realFetch; }
    return { out, provider };
  };
  const BWON = { beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' } };
  const CITED = 'لا ينقض الوضوء بخروج الدم من غير السبيلين عند ابن باز [[1]].';
  const NOTFOUND = 'لم أقف على نص في حكم الدم الكثير خاصة.\n<suggestions>\n- هل ينقض القيء الوضوء؟\n</suggestions>';

  const one = await drive(T7, BWON, CITED);
  // M2-ج adds ONE reading call after the write (the sentence-level door, on the fast model); what this
  // item pins is that there is ONE WRITING call, so the reader's calls are set aside by their system.
  const writes = one.provider.filter((b) => !String(b.system || "").startsWith("أنتَ فاحصُ أمانةٍ فقهيّة"));
  const call = writes[0] || {};
  const lastUser = [...(call.messages || [])].reverse().find((m) => m.role === 'user');
  const blockText = lastUser && Array.isArray(lastUser.content) ? lastUser.content.slice(1).map((b) => b.text || '').join('\n') : '';
  ok('D1  one WRITING call, with no tools, carrying the pinned texts and the writing rules',
    writes.length === 1 && !('tools' in call) && blockText.includes(BW.BW_WRITE_RULES || '\u0000')
    && (one.out.degraded || []).includes('before_writing:single_write'),
    JSON.stringify({ writes: writes.length, calls: one.provider.length, tools: 'tools' in call, degraded: one.out && one.out.degraded }));
  ok('D2  that call is the non-streamed write, and its finish state is the answer\'s',
    call.stream === false && one.out.deliveredStop === 'end_turn' && one.out.truncated === false,
    JSON.stringify({ stream: call.stream, deliveredStop: one.out.deliveredStop }));
  ok('D3a an answer that cites its text and says nothing is missing carries no widen chip',
    !String(one.out.text || '').includes(WIDEN), one.out.text);
  const nf = await drive(T7, BWON, NOTFOUND);
  const nfText = String(nf.out.text || '');
  const sugg = /<suggestions>([\s\S]*?)<\/suggestions>/u.exec(nfText);
  ok('D3b an answer that says it found no text carries the chip, first in its own <suggestions>',
    !!sugg && sugg[1].trim().split('\n')[0].replace(/^-\s*/u, '').trim() === WIDEN
    && (nfText.match(new RegExp(WIDEN, 'gu')) || []).length === 1, nfText);
  ok('D4  withWidenOffer: nothing gathered ⟹ a chip block of its own; and never twice',
    typeof BW.withWidenOffer === 'function'
    && BW.withWidenOffer('جواب.', 0).includes('<suggestions>\n- ' + WIDEN + '\n</suggestions>')
    && BW.withWidenOffer(BW.withWidenOffer('جواب.', 0), 0) === BW.withWidenOffer('جواب.', 0)
    && BW.withWidenOffer('جواب [[1]].', 3) === 'جواب [[1]].');
  const off = await drive(T7, {}, CITED);
  ok('D5  the switch off: the first call offers the tools as before, and no chip is added',
    off.provider.length >= 1 && Array.isArray(off.provider[0].tools) && off.provider[0].tools.length > 0
    && !String(off.out.text || '').includes(WIDEN), JSON.stringify({ calls: off.provider.length }));

  console.log(`\n=== before-writing-b: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
