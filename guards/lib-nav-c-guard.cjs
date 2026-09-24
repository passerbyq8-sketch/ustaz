// guards/lib-nav-c-guard.cjs -- م٤-ج (LIB_NAV_V1): «اشرح» after a quotation reaches the model with the
// quotation in front of it and is not quoted again; «… ثمّ لخّصه» in one message gives the quotation, then
// the summary. Driven through the REAL api/ask.js handler, offline.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٤-ج): «اشرح كذا» بعدَ النقل: يمرُّ على النموذجِ والنصُّ المنقولُ
// أمامَه — تحقّقْ أنّ كتلةَ النقلِ تصلُ في سجلِّ المحادثةِ المرسَل · و«ثمّ لخّصه» في الرسالةِ نفسِها: النقلُ ثمّ
// الخلاصة. MEASURED before it was built (04-quote/measure/C-explain.md): the quotation already reached the
// model byte for byte; but «اشرح لي نص كلام النووي …» was captured and quoted again, «… ثم لخّصه» was
// answered with the quotation alone, and the seal cut the book's own «رواه البخاري ومسلم» from the
// explanation because the quotation was not a page read in that request.
//
// WHAT THIS PINS (every row on the real handler, the provider and both library origins stubbed):
//   X1  «انقل … ثم لخّصه»: the reader reads the quotation, then the summary; ONE provider call whose last
//       three messages are the question, the quotation (no marker) and the summary request; the book's
//       own «رواه البخاري ومسلم» repeated in the summary survives the seal;
//   X2  the switch off: the quotation alone and no provider call, as before;
//   X3  «اشرح …» right after a quotation: not quoted again; ONE provider call with the quotation in its
//       history, marker stripped; the quotation re-read from its printed page at the navigation origin;
//       the book's own credit in the explanation survives the seal;
//   X4  the switch off: the same message is quoted again (the measured trap), and no marker reaches a
//       model on any row;
//   X5  the readers on their own: the explain verbs, the tail, the quotation's place.
// Red on the tree before this item: `node guards/lib-nav-c-guard.cjs --root <tree>`.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
const say = console.log.bind(console);
function ok(name, cond, detail) {
  checks++;
  if (cond) { say('  PASS  ' + name); return true; }
  failures++;
  say('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 700) : ''));
  return false;
}
const ENV_KEYS = ['ANTHROPIC_API_KEY', 'FOUNDER_SECRET', 'FREE_BRAIN_V1', 'TAKHRIJ_V1', 'STREAM_V1', 'SHAMELA_BRAIN',
  'SEARCH_API_TOKEN', 'LIB_QUOTE_V1', 'DEPTH_FREE_TRIAL', 'LEDGER_RAG', 'RFC_V05_MODE', 'LIB_NAV_V1', 'LIB_NAV_URL',
  'BRAVE_API_KEY', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'BEFORE_WRITING_V1', 'FULL_ANSWER_V1', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'FATWA_SERVICE_URL'];

async function main() {
  console.log('lib-nav-c guard — root ' + REPO);
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const quiet = {};
  for (const m of ['log', 'warn', 'info', 'error']) { quiet[m] = console[m]; }
  const realFetch = globalThis.fetch;
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, {
      ANTHROPIC_API_KEY: 'offline-dummy-key', FOUNDER_SECRET: 'nav-c-guard-secret', FREE_BRAIN_V1: 'on', TAKHRIJ_V1: 'on',
      STREAM_V1: 'off', SHAMELA_BRAIN: 'on', SEARCH_API_TOKEN: 'tk-fixture-nav-c', LIB_QUOTE_V1: 'on', DEPTH_FREE_TRIAL: 'on',
      LEDGER_RAG: 'off', RFC_V05_MODE: 'off', LIB_NAV_URL: 'https://lib-preview.ezik.app',
    });
    let C = null;
    try { C = await esm('lib/quote-cursor.js'); } catch { C = null; }
    const DC = await esm('lib/daycap.js');
    const STORE = await esm('lib/ledger/redis.js');
    const CONSENT = await esm('lib/ai-consent.js');
    const counts = new Map();
    DC.__setRedisForTest({
      async mget(...keys) { return keys.map((k) => (counts.has(k) ? counts.get(k) : null)); },
      async sismember() { return 0; },
      pipeline() { const ops = []; return { incr(k) { ops.push(() => { const n = (Number(counts.get(k)) || 0) + 1; counts.set(k, n); return n; }); }, expire() { ops.push(() => 1); }, async exec() { return ops.map((f) => f()); } }; },
    });
    STORE.__setRedisForTest({ async get() { return null; }, async set() { return 'OK'; }, async incr() { return 1; }, async expire() { return 1; }, async sismember() { return 0; }, async eval() { return [1, 1, 1, 0]; } });

    const ATOM_TEXT = 'قال الشافعي: أحب السواك في كل حال إلا للصائم بعد الزوال. والأصل فيه حديث «لخلوف فم الصائم أطيب عند الله من ريح المسك»، رواه البخاري ومسلم.';
    const HIT = { atom_id: 'FC-003660:0275:001', subject_id: 'FC-003660', book_title: 'المجموع شرح المهذب', author: 'النووي',
      heading_path: ['باب السواك'], heading_kind: 'chapter', volume: 1, page_start: 275, page_end: 275, page_citable: true,
      numbering: 'print', hadith_no: null, matn_spans: [], matn_chars: 0, text: ATOM_TEXT, truncated: false, score: 9 };
    const SEARCH = { index_version: 'fixture', took_ms: 1, queue_ms: 0, candidates_examined: 1, candidates_truncated: false,
      refused: false, refused_reason: null, degraded_reason: null, hits_dropped: 0, hits: [HIT] };
    const PAGE = { book_id: 'FC-003660', title: 'المجموع شرح المهذب', author: 'النووي', volume: 1, page: 275, page_citable: true,
      numbering: 'print', atoms: [{ ...HIT }], text: ATOM_TEXT, next: null, prev: null };
    const SUMMARY = 'خلاصة النص: يُكرَه السواك للصائم بعد الزوال عند الشافعي، رواه البخاري ومسلم.';
    let providerCalls = [];
    let navCalls = [];
    let searchCalls = 0;
    const json = (u, obj) => {
      const s = JSON.stringify(obj);
      return { ok: true, status: 200, url: u, redirected: false,
        headers: { get: (k) => (/content-type/i.test(k) ? 'application/json' : (/content-length/i.test(k) ? String(Buffer.byteLength(s)) : null)) },
        text: async () => s, json: async () => JSON.parse(s) };
    };
    globalThis.fetch = async (input, init = {}) => {
      const u = String(input && input.url ? input.url : input);
      if (u.startsWith('https://api.anthropic.com')) {
        const b = JSON.parse(String(init.body || '{}'));
        providerCalls.push(b);
        const payload = { id: 'msg_fixture', type: 'message', role: 'assistant', model: b.model,
          content: [{ type: 'text', text: SUMMARY }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
        return json(u, payload);
      }
      if (u.startsWith('https://lib.ezik.app/search')) { searchCalls += 1; return json(u, SEARCH); }
      if (u.startsWith('https://lib-preview.ezik.app/')) {
        navCalls.push({ path: new URL(u).pathname, body: JSON.parse(String(init.body || '{}')) });
        return json(u, PAGE);
      }
      throw new Error('offline: ' + u.slice(0, 60));
    };
    for (const m of ['log', 'warn', 'info', 'error']) console[m] = () => {};
    const ask = await esm('api/ask.js');
    const drive = async (messages) => {
      providerCalls = []; navCalls = []; searchCalls = 0;
      const res = {
        writes: [], statusCode: 200, headersSent: false,
        status(c) { this.statusCode = c; return this; }, setHeader() { return this; },
        flushHeaders() { this.headersSent = true; }, write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
        end() { return this; }, json(o) { this.jsonBody = o; return this; }, on() { return this; }, once() { return this; },
      };
      const req = {
        method: 'POST', on() { return this; }, once() { return this; },
        headers: { 'content-type': 'application/json', 'x-murabbi-device': 'nav-c-guard-device',
          'x-murabbi-founder': DC.founderTokenFor('nav-c-guard-device'), [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION,
          origin: 'https://ezik.app' },
        body: { max_tokens: 4096, stream: true, name: '', age: 30, gender: null, mode: 'chat', band: 'adult', messages },
      };
      await ask.default(req, res);
      const reader = res.writes.join('').split('\n\n').map((f) => f.split('\n').find((l) => l.startsWith('data:'))).filter(Boolean)
        .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
        .filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta').map((e) => e.delta.text).join('');
      return { reader, providerCalls, navCalls, searchCalls };
    };
    const noMarker = (calls) => calls.every((b) => !JSON.stringify(b.messages || []).includes('<book bid='));
    const Q_TAIL = 'انقل لي نص كلام النووي في المجموع شرح المهذب عن السواك للصائم بعد الزوال، ثم لخّصه لي';

    // ── X1 ──────────────────────────────────────────────────────────────────
    process.env.LIB_NAV_V1 = 'on';
    const x1 = await drive([{ role: 'user', content: Q_TAIL }]);
    const m1 = x1.providerCalls[0] ? x1.providerCalls[0].messages : [];
    const last3 = m1.slice(-3);
    ok('X1  «… ثم لخّصه»: the quotation, then the summary; one call on [question, quotation, request]; the credit kept',
      x1.reader.startsWith('📖 «المجموع شرح المهذب» · النووي · ج1 · ص275\n\n> قال الشافعي')
      && x1.reader.indexOf('رواه البخاري ومسلم.') < x1.reader.indexOf('خلاصة النص')
      && x1.reader.includes('خلاصة النص: يُكرَه السواك للصائم بعد الزوال عند الشافعي، رواه البخاري ومسلم.')
      && x1.providerCalls.length === 1 && last3.length === 3 && last3[0].role === 'user'
      && last3[1].role === 'assistant' && typeof last3[1].content === 'string' && last3[1].content.startsWith('📖 «المجموع')
      && !last3[1].content.includes('<book') && last3[2].role === 'user' && JSON.stringify(last3[2].content).includes('لخّصِ النصَّ المنقولَ'),
      JSON.stringify({ reader: x1.reader.slice(0, 400), calls: x1.providerCalls.length, roles: m1.map((m) => m.role) }));

    // ── X2 ──────────────────────────────────────────────────────────────────
    delete process.env.LIB_NAV_V1;
    const x2 = await drive([{ role: 'user', content: Q_TAIL }]);
    ok('X2  the switch off: the quotation alone, no provider call',
      x2.reader.startsWith('📖 «المجموع شرح المهذب»') && !x2.reader.includes('خلاصة النص') && x2.providerCalls.length === 0,
      JSON.stringify({ reader: x2.reader.slice(0, 200), calls: x2.providerCalls.length }));

    // ── X3 ──────────────────────────────────────────────────────────────────
    const quoteReply = '📖 «المجموع شرح المهذب» · النووي · ج1 · ص275\n\n> ' + ATOM_TEXT + '\n<book bid="FC-003660" at="FC-003660:0275:001"></book>';
    const EXPLAIN = 'اشرح لي نص كلام النووي في المجموع عن السواك للصائم';
    const hist = [{ role: 'user', content: 'انقل لي نص كلام النووي في المجموع شرح المهذب عن السواك للصائم بعد الزوال' },
      { role: 'assistant', content: quoteReply }, { role: 'user', content: EXPLAIN }];
    process.env.LIB_NAV_V1 = 'on';
    const x3 = await drive(hist);
    const h3 = x3.providerCalls[0] ? x3.providerCalls[0].messages : [];
    ok('X3  «اشرح …» after a quotation: not quoted again; the quotation in the model\'s history; re-read at its page; the credit kept',
      !x3.reader.startsWith('📖') && x3.searchCalls === 0 && x3.providerCalls.length === 1
      && h3.some((m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('📖 «المجموع') && !m.content.includes('<book'))
      && x3.navCalls.length === 1 && x3.navCalls[0].path === '/page'
      && JSON.stringify(x3.navCalls[0].body) === JSON.stringify({ book_id: 'FC-003660', page: 275, volume: 1 })
      && x3.reader.includes('رواه البخاري ومسلم.'),
      JSON.stringify({ reader: x3.reader.slice(0, 300), calls: x3.providerCalls.length, nav: x3.navCalls, search: x3.searchCalls }));

    // ── X4 ──────────────────────────────────────────────────────────────────
    delete process.env.LIB_NAV_V1;
    const x4 = await drive(hist);
    ok('X4  the switch off: quoted again (the measured trap); no marker reached a model on any row',
      x4.reader.startsWith('📖') && x4.providerCalls.length === 0
      && noMarker(x1.providerCalls) && noMarker(x3.providerCalls),
      JSON.stringify({ reader: x4.reader.slice(0, 120), calls: x4.providerCalls.length }));

    // ── X5 ──────────────────────────────────────────────────────────────────
    ok('X5  the readers: the explain verbs, the tail, the quotation\'s place',
      !!C && typeof C.explainsPreviousQuote === 'function'
      && C.explainsPreviousQuote('اشرح لي هذا الكلام') && C.explainsPreviousQuote('لخّصه') && C.explainsPreviousQuote('وضّحه لي')
      && !C.explainsPreviousQuote('بين المغرب والعشاء ماذا أصلي') && !C.explainsPreviousQuote('ما حكم السواك؟')
      && C.quoteTail(Q_TAIL) === 'summarise' && C.quoteTail('انقل لي … ثم اشرحه') === 'explain' && C.quoteTail('انقل لي نص كلامه') === null
      && JSON.stringify(C.quotedPlace(quoteReply.split('\n<book')[0]) && { v: C.quotedPlace(quoteReply).volume, p: C.quotedPlace(quoteReply).page })
        === JSON.stringify({ v: 1, p: 275 }));
  } finally {
    globalThis.fetch = realFetch;
    for (const m of Object.keys(quiet)) console[m] = quiet[m];
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  console.log(`\n=== lib-nav-c: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== lib-nav-c: crashed ==='); process.exit(1); });
