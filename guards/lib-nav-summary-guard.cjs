// guards/lib-nav-summary-guard.cjs -- ب٤ (order B, LIB_NAV_V1): «كمّل» after «… ثمّ لخّصه» (D41). The «quote then
// summary» reply carries the pointer as the quote reply carries it, so «كمّل» after it continues the book from
// the last quoted atom, with no atom twice.
//
// MEASURED on c00e8f5 (program-2026-09-24/09-order-b/b4/measure/B4-MEASURE.md): the summary reply's prefix was
// composed as bareQuote(pendingQuote.text) in api/ask.js, which drops the chip, so «كمّل» went to the model and
// the book was never read again. Modelled on guards/lib-nav-c-guard.cjs (same env, same offline stubs, same
// drive); the preview origin also serves /next from a small fixture, so the continuation can be read.
//
//   X6a  «… ثم لخّصه»: the reply carries EXACTLY ONE cursor chip, and it names the quoted atom (the last atom of
//        the quotation); no provider call ever carries a chip.
//   X6b  and it stands where a plain quotation's stands: the reply opens with the plain quote reply for the same
//        request, byte for byte, chip included, then a blank line and the summary.
//   X6c  «كمّل» after that reply: ONE POST /next {atom_id: the quoted atom, unit: 'page'}, no provider call, a
//        quotation that opens with the card, and the quoted atom's text is not in it (never an atom twice).
//   X6d  the switch off: no chip, and «كمّل» goes to the model as before.
// Red on the tree before this item: `node guards/lib-nav-summary-guard.cjs --root <tree>`.
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

async function main() {
  say('lib-nav-summary guard — root ' + REPO);
  for (const k of ['BRAVE_API_KEY', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'BEFORE_WRITING_V1', 'FULL_ANSWER_V1', 'KV_REST_API_URL',
    'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'FATWA_SERVICE_URL', 'LIB_NAV_V1']) delete process.env[k];
  Object.assign(process.env, {
    FREE_BRAIN_V1: 'on', TAKHRIJ_V1: 'on', STREAM_V1: 'off', SHAMELA_BRAIN: 'on', LIB_QUOTE_V1: 'on', DEPTH_FREE_TRIAL: 'on',
    LEDGER_RAG: 'off', RFC_V05_MODE: 'off', LIB_NAV_URL: 'https://lib-preview.ezik.app',
  });
  process.env.ANTHROPIC_API_KEY = 'offline-dummy';
  process.env.FOUNDER_SECRET = 'x6-offline';
  process.env.SEARCH_API_TOKEN = 'tk-x6-offline';
  const C = await esm('lib/quote-cursor.js');
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
  const at = (id, s, e, text) => ({ atom_id: id, text, heading_path: ['باب السواك'], matn_spans: [], volume: 1, page_start: s, page_end: e, page_citable: true, numbering: 'print' });
  const HIT = { ...at('FC-003660:0275:001', 275, 275, ATOM_TEXT), subject_id: 'FC-003660', book_title: 'المجموع شرح المهذب', author: 'النووي',
    heading_kind: 'chapter', hadith_no: null, matn_chars: 0, truncated: false, score: 9 };
  const SEARCH = { index_version: 'fixture', took_ms: 1, queue_ms: 0, candidates_examined: 1, candidates_truncated: false,
    refused: false, refused_reason: null, degraded_reason: null, hits_dropped: 0, hits: [HIT] };
  const NEXT_ATOMS = [at('FC-003660:0275:002', 275, 276, 'وقال أصحابنا: ولا يكره قبل الزوال.'), at('FC-003660:0276:001', 276, 276, 'فرع: إذا استاك الصائم بعد الزوال لم يفطر.')];
  const NEXT = { book_id: 'FC-003660', title: 'المجموع شرح المهذب', author: 'النووي', volume: 1, page: 275, page_citable: true, numbering: 'print',
    atoms: NEXT_ATOMS, text: NEXT_ATOMS.map((a) => a.text).join('\n'), next: null, prev: null };
  const SUMMARY = 'خلاصة النص: يُكرَه السواك للصائم بعد الزوال عند الشافعي، رواه البخاري ومسلم.';
  const FROM_MODEL = 'تتمة من النموذج.';
  let providerCalls = [], navCalls = [];
  const json = (u, obj) => { const s = JSON.stringify(obj); return { ok: true, status: 200, url: u, redirected: false,
    headers: { get: (k) => (/content-type/i.test(k) ? 'application/json' : (/content-length/i.test(k) ? String(Buffer.byteLength(s)) : null)) },
    text: async () => s, json: async () => JSON.parse(s) }; };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const u = String(input && input.url ? input.url : input);
    if (u.startsWith('https://api.anthropic.com')) {
      const b = JSON.parse(String(init.body || '{}'));
      providerCalls.push(b);
      const last = b.messages[b.messages.length - 1];
      const text = JSON.stringify(last.content).includes('لخّصِ النصَّ') ? SUMMARY : FROM_MODEL;
      return json(u, { id: 'm', type: 'message', role: 'assistant', model: b.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
    }
    if (u.startsWith('https://lib.ezik.app/search')) return json(u, SEARCH);
    if (u.startsWith('https://lib-preview.ezik.app/')) {
      const route = new URL(u).pathname;
      navCalls.push({ route, body: JSON.parse(String(init.body || '{}')) });
      if (route === '/next') return json(u, NEXT);
      return { ok: false, status: 404, url: u, headers: { get: (k) => (/content-type/i.test(k) ? 'application/json' : null) }, text: async () => '{"error":{"code":"page_not_found","message":""}}' };
    }
    throw new Error('offline: ' + u.slice(0, 60));
  };
  const quiet = {};
  for (const m of ['log', 'warn', 'info', 'error']) { quiet[m] = console[m]; console[m] = () => {}; }
  try {
    const ask = await esm('api/ask.js');
    const drive = async (messages) => {
      providerCalls = []; navCalls = [];
      const res = { writes: [], statusCode: 200, headersSent: false,
        status(c) { this.statusCode = c; return this; }, setHeader() { return this; },
        flushHeaders() { this.headersSent = true; }, write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
        end() { return this; }, json(o) { this.jsonBody = o; return this; }, on() { return this; }, once() { return this; } };
      const req = { method: 'POST', on() { return this; }, once() { return this; },
        headers: { 'content-type': 'application/json', 'x-murabbi-device': 'x6-device', 'x-murabbi-founder': DC.founderTokenFor('x6-device'),
          [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION, origin: 'https://ezik.app' },
        body: { max_tokens: 4096, stream: true, name: '', age: 30, gender: null, mode: 'chat', band: 'adult', messages } };
      await ask.default(req, res);
      const reader = res.writes.join('').split('\n\n').map((f) => f.split('\n').find((l) => l.startsWith('data:'))).filter(Boolean)
        .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
        .filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta').map((e) => e.delta.text).join('');
      return { reader, providerCalls: providerCalls.slice(), navCalls: navCalls.slice() };
    };
    const CHIP_RE = /\n?<book bid="[^"]+" at="[^"]+"(?: from="\d+" v="\d+" p="\d+")?><\/book>/g;
    const Q = 'انقل لي نص كلام النووي في المجموع شرح المهذب عن السواك للصائم بعد الزوال';
    const Q_TAIL = Q + '، ثم لخّصه لي';

    process.env.LIB_NAV_V1 = 'on';
    const plain = await drive([{ role: 'user', content: Q }]);                 // the plain quote reply, for X6b
    const t1 = await drive([{ role: 'user', content: Q_TAIL }]);
    const chips = t1.reader.match(CHIP_RE) || [];
    const cursor = C.readCursor([{ role: 'user', content: Q_TAIL }, { role: 'assistant', content: t1.reader }, { role: 'user', content: C.CONTINUE_PROMPT }]);
    ok('X6a  «… ثم لخّصه»: exactly one chip, naming the quoted atom; no provider call carries a chip',
      chips.length === 1 && !!cursor && cursor.bid === 'FC-003660' && cursor.at === 'FC-003660:0275:001'
      && t1.reader.includes(SUMMARY) && t1.providerCalls.length === 1
      && t1.providerCalls.every((b) => !JSON.stringify(b.messages).includes('<book bid=')),
      JSON.stringify({ chips, cursor, reader: t1.reader.slice(-200) }));
    ok('X6b  and it stands where a plain quotation\'s stands: the reply opens with the plain quote reply, chip included',
      /<book bid=/.test(plain.reader) && t1.reader.startsWith(plain.reader + '\n\n'),
      JSON.stringify({ plainTail: plain.reader.slice(-80), head: t1.reader.slice(0, plain.reader.length + 4).slice(-90) }));
    const t2 = await drive([{ role: 'user', content: Q_TAIL }, { role: 'assistant', content: t1.reader }, { role: 'user', content: C.CONTINUE_PROMPT }]);
    ok('X6c  «كمّل» after it: one /next from the quoted atom, no provider call, and that atom not shown again',
      t2.navCalls.length === 1 && t2.navCalls[0].route === '/next'
      && JSON.stringify(t2.navCalls[0].body) === JSON.stringify({ atom_id: 'FC-003660:0275:001', unit: 'page' })
      && t2.providerCalls.length === 0 && t2.reader.startsWith('\u{1F4D6} «المجموع شرح المهذب»')
      && !t2.reader.includes('قال الشافعي') && t2.reader.includes('وقال أصحابنا'),
      JSON.stringify({ nav: t2.navCalls, calls: t2.providerCalls.length, reader: t2.reader.slice(0, 200) }));

    delete process.env.LIB_NAV_V1;
    const off1 = await drive([{ role: 'user', content: Q_TAIL }]);
    const off2 = await drive([{ role: 'user', content: Q_TAIL }, { role: 'assistant', content: off1.reader }, { role: 'user', content: C.CONTINUE_PROMPT }]);
    ok('X6d  the switch off: no chip, and «كمّل» goes to the model as before',
      !/<book bid=/.test(off1.reader) && off1.providerCalls.length === 0 && off2.navCalls.length === 0 && off2.providerCalls.length === 1,
      JSON.stringify({ off1: off1.reader.slice(-80), off2calls: off2.providerCalls.length, off2nav: off2.navCalls.length }));
  } finally {
    globalThis.fetch = realFetch;
    for (const m of Object.keys(quiet)) console[m] = quiet[m];
  }
  console.log(`\n=== lib-nav-summary: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
