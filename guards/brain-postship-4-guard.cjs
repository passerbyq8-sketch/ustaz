// guards/brain-postship-4-guard.cjs -- POSTSHIP ITEM 4 -- 2026-10-24 (row 11)
//
// THE SUPPORT REPLY CARRIES THE OWNER'S E-MAIL. The owner's order of 18 October: whoever asks Ezik how to reach
// support is answered with his e-mail. The order (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-FIX-
// DIRECTIVE-2026-10-24.md, item 4): a fixed answer with no model, from the mechanism that serves the fixed answers
// today, rendered for the open languages, the address letter for letter, no source card, logged on its fixed path
// with the flag `support_contact`; and a precise matcher -- «الدعم» also means backing and charity.
//
// The twenty questions are the order's own (item 4, "تفتحه" / "لا تفتحه"), copied. The handler half drives the real
// api/ask.js with no model reachable: fetch is replaced by a stub that COUNTS calls, so a model call would show.
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
const OPEN = [
  'كيف أتواصل مع الدعم؟',
  'ابي اكلم الدعم الفني',
  'وين ارسل مشكلة صارت معي في التطبيق؟',
  'ما هو إيميل الدعم الفني لعزك؟',
  'عندي اقتراح للتطبيق لمن ارسله؟',
  'كيف أبلغ عن خطأ في عزك؟',
  'How do I contact support?',
  'What is the support email?',
  'I want to report a bug in the app',
  'Who can I talk to about a problem with Ezik?',
];
const CLOSED = [
  'كيف أدعم الفقراء في رمضان؟',
  'ما حكم دعم الظالم؟',
  'هل يجوز دعم الجمعيات الخيرية من الزكاة؟',
  'دعم الدولة للمزارعين حلال؟',
  'ما فضل دعم طالب العلم؟',
  'أريد أن أدعم أخي في دراسته فكيف؟',
  'How can I support my parents?',
  'Is it allowed to support a charity with zakat?',
  'What is the ruling on supporting oppressors?',
  'How do I support someone grieving?',
];
const EMAIL = 'Passerbyq8@gmail.com';
const AR_LINE = 'للتواصلِ مع دعمِ عزك، راسِلْنا على البريد:';

(async () => {
  let SC = null;
  try { SC = await esm('lib/policy/support-contact.js'); } catch (e) { SC = null; }
  ok('the support module exists', !!SC);
  console.log('-- 1. the matcher: the order\'s ten that open it, and ten that do not');
  const f = SC && typeof SC.isSupportContactRequest === 'function' ? SC.isSupportContactRequest : () => false;
  for (const q of OPEN) ok('opens: ' + q.replace(/[^\x20-\x7e]/g, '.'), f(q) === true);
  for (const q of CLOSED) ok('stays closed: ' + q.replace(/[^\x20-\x7e]/g, '.'), f(q) === false);

  console.log('-- 2. the text');
  const text = SC ? SC.SUPPORT_CONTACT_TEXT : '';
  ok('the Arabic line is the order\'s, then the address on its own line', text === AR_LINE + '\n' + EMAIL, JSON.stringify(text).replace(/[^\x20-\x7e]/g, '.'));
  ok('no source card in it', !/<\s*(source|book)\b/u.test(String(text)));

  console.log('-- 3. the open languages, by lookup (lib/lang/fixed.js)');
  const FX = await esm('lib/lang/fixed.js');
  const LANGS = ['en', 'fr', 'fa', 'id', 'ur', 'bn', 'tr', 'ha', 'ms', 'sw', 'ru', 'zh', 'es', 'pt', 'de', 'hi', 'so', 'ps', 'ku', 'uz', 'am', 'ta', 'om'];
  const porn = (await esm('lib/policy/porn-request.js')).PORN_REFUSAL_TEXT;
  const covered = LANGS.filter((l) => FX.fixedRendition(l, porn));
  ok('the fixed table still covers its languages', covered.length === LANGS.length, covered.length + '/' + LANGS.length);
  const rendered = LANGS.map((l) => [l, FX.fixedRendition(l, text)]);
  const missing = rendered.filter(([, r]) => !r).map(([l]) => l);
  ok('every open language has a rendition of the support text', !missing.length, 'missing ' + missing.join(','));
  const noMail = rendered.filter(([, r]) => r && !r.includes('\n' + EMAIL)).map(([l]) => l);
  ok('every rendition carries the address letter for letter on its own line', !noMail.length, noMail.join(','));

  console.log('-- 4. the handler: no model, no card, the canned path and the flag');
  // The harness of guards/impermissible-early-guard.cjs section E (drive(), the day-cap store, the fake model), copied.
  const ASKMOD = await esm('api/ask.js');
  const LOG = await esm('lib/answer-log.js');
  const FC = await esm('lib/fatwa-contract.js');
  const LEDGER_REDIS = await esm('lib/ledger/redis.js');
  const DAYCAP = await esm('lib/daycap.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const LEGACY = await esm('lib/legacy-policy-flag.js');
  const CONSENT = await esm('lib/ai-consent.js');
  const handler = ASKMOD.default;
  const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN',
    'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG',
    'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS',
    'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE', 'FRONT_SORTER_V1', 'IMPERMISSIBLE_EARLY_V1'];
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const realFetch = globalThis.fetch;
  const capCounts = new Map();
  const installDayCapStore = () => {
    capCounts.clear();
    DAYCAP.__setRedisForTest({
      async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
      async sismember() { return 0; },
      pipeline() {
        const ops = [];
        return {
          incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
          expire() { ops.push(() => 1); },
          async exec() { return ops.map((fn) => fn()); },
        };
      },
    });
  };
  const makeRes = () => ({
    writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    flushHeaders() { this.headersSent = true; },
    write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
    end() { this.ended += 1; this.headersSent = true; return this; },
    json(o) { this.jsonBody = o; this.ended += 1; return this; },
    once() { return this; }, on() { return this; }, removeListener() { return this; },
  });
  const jsonResponse = (url, o, status = 200) => ({
    ok: status >= 200 && status < 300, status, url: String(url),
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => o, text: async () => JSON.stringify(o),
  });
  const WRITER_TEXT = 'WRITER-ANSWER-FROM-THE-FAKE-MODEL';
  let ipSeq = 0;
  async function drive(question, opts = {}) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
    process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
    process.env.LEDGER_RAG = 'off';
    process.env.FREE_BRAIN_V1 = 'on';
    for (const [k, v] of Object.entries(opts.env || {})) process.env[k] = v; // brain35-ship J2: the entry's switches
    // the answer log's record is read where it lands: an in-memory store behind lib/ledger/redis.js's own test seam
    const written = [];
    LEDGER_REDIS.__setRedisForTest({
      async get() { return null; }, async set(k, v) { if (String(k).startsWith('al:v1:') && !String(k).startsWith('al:v1:d:')) written.push(JSON.parse(v)); return 'OK'; },
      async lpush() { return 1; }, async ltrim() { return 'OK'; }, async expire() { return 1; }, async incr() { return 1; }, async lrange() { return []; }, async eval() { return null; },
    });
    FLAG.__resetFlagCacheForTest();
    LEGACY.__resetLegacyFlagCacheForTest();
    installDayCapStore();
    const calls = [];
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      calls.push(u);
      if (u.startsWith(FC.FATWA_BASE)) return jsonResponse(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, results: [], scholars: [], pagination: { total: 0 }, counts: { scholars: 0 } });
      if (u.includes('api.anthropic.com')) {
        const b = JSON.parse(init.body);
        const system = typeof b.system === 'string' ? b.system : '';
        if (system.startsWith('You are the routing step')) return jsonResponse(u, { content: [{ type: 'text', text: 'RELIGIOUS' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        return jsonResponse(u, { content: [{ type: 'text', text: WRITER_TEXT }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
    };
    const res = makeRes();
    ipSeq += 1;
    const req = {
      method: 'POST',
      headers: { 'x-murabbi-device': 'postship-4-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.25.0.' + ipSeq,
        [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
      body: { messages: opts.messages || [{ role: 'user', content: question }], band: 'adult', age: 35, ...(opts.body || {}) },
    };
    const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
    let crashed = null;
    try { await (opts.handler || handler)(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
    globalThis.fetch = realFetch;
    const text = res.writes.map((w) => (/^data: (.*)\n\n$/s.exec(w) || [])[1]).filter(Boolean).map((j) => { try { return JSON.parse(j); } catch { return null; } })
      .filter((o) => o && o.type === 'content_block_delta' && o.delta && o.delta.text).map((o) => o.delta.text).join('');
    // the rate-limit store (Upstash pipeline) is not a model, a source or a search (impermissible-early-guard.cjs:42-44)
    const outbound = calls.filter((u) => !String(u).endsWith('/pipeline'));
    LEDGER_REDIS.__setRedisForTest(null);
    return { text, notes: written, outbound, crashed };
  }
  try {
    for (const q of [OPEN[0], OPEN[6]]) {
      const a = await drive(q);
      const tag = q.replace(/[^\x20-\x7e]/g, '.');
      ok(tag + ' -> the fixed text', !a.crashed && a.text.includes(AR_LINE) && a.text.includes(EMAIL), a.crashed ? a.crashed.message : a.text.slice(0, 120).replace(/[^\x20-\x7e]/g, '.'));
      ok(tag + ' ... with zero outbound calls (no model, no sorter, no search)', a.outbound.length === 0, a.outbound.join(' '));
      ok(tag + ' ... and no source card', !/<\s*(source|book)\b/u.test(a.text));
      const merged = Object.assign({}, ...a.notes);
      const flags = a.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : []));
      ok(tag + ' ... logged on the canned path', merged.path === 'canned', String(merged.path));
      ok(tag + ' ... with the flag support_contact', flags.includes('support_contact'), JSON.stringify(flags));
      ok(tag + ' ... and the flag survives the log\'s own sanitiser', (LOG.sanitizeRecord({ path: 'canned', flags }).flags || []).includes('support_contact'));
    }
    const b = await drive(CLOSED[1]);
    ok('«ما حكم دعم الظالم؟» does not get the support text (it goes on to the model)', !b.text.includes(EMAIL) && b.outbound.length > 0);

    // ---------------- brain35-ship J2 (2026-11-10; the owner): A QUESTION ABOUT THE JA'FARI SCHOOL GETS ONE SENTENCE AND NOTHING ELSE,
    // on every entry that turns a reader question into an answer: api/ask.js on the BW2 and the legacy routes, the brief and the detailed
    // tiers, every age band and call mode. The deny reuses this handler's fixed-reply mechanism: decided beside the support address,
    // logged on the canned path with its flag, written as one text delta and message_stop. The rows are the J2 order's own
    // (EZIK-ORDER-BRAIN35-J2-2026-11-10.md, GUARD), copied by BRAIN35-J2-evidence/extract-rows.cjs.
    const J2 = { DENY: ['\u0645\u0627 \u062d\u0643\u0645 \u0632\u0648\u0627\u062c \u0627\u0644\u0645\u062a\u0639\u0629 \u0639\u0646\u062f \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0645\u0627 \u0631\u0623\u064a \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a \u0641\u064a \u0627\u0644\u062c\u0645\u0639 \u0628\u064a\u0646 \u0627\u0644\u0635\u0644\u0627\u062a\u064a\u0646\u061f', '\u0645\u0627 \u0647\u0648 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u062d\u062f\u062b\u0646\u064a \u0639\u0646 \u0627\u0644\u0625\u0645\u0627\u0645\u064a\u0629 \u0627\u0644\u0627\u062b\u0646\u064a \u0639\u0634\u0631\u064a\u0629', '\u0645\u0627 \u0627\u0644\u0641\u0631\u0642 \u0628\u064a\u0646 \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629 \u0648\u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629 \u0641\u064a \u0627\u0644\u0648\u0636\u0648\u0621\u061f', '\u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0647\u0644 \u0627\u0644\u062c\u0639\u0641\u0631\u064a \u0645\u0633\u0644\u0645\u061f', '\u0645\u0627 \u0645\u0648\u0642\u0641 \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629 \u0645\u0646 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0627\u0644\u0639\u0645\u0644 \u0628\u0627\u0644\u0641\u0642\u0647 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0643\u064a\u0641 \u064a\u0635\u0644\u064a \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0644\u0639\u0646 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0645\u0627 \u0642\u0648\u0644 \u0639\u0644\u0645\u0627\u0621 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629 \u0641\u064a \u0627\u0644\u062e\u0645\u0633\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0627\u0644\u0623\u062e\u0630 \u0628\u0641\u062a\u0648\u0649 \u0645\u0631\u062c\u0639 \u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0645\u062a\u0639\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0625\u0645\u0627\u0645 \u062c\u0639\u0641\u0631\u064a \u0639\u0646\u062f \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0632\u0648\u0627\u062c \u0645\u0646 \u062c\u0639\u0641\u0631\u064a\u0629 \u0639\u0646\u062f \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0645\u0627 \u0642\u0648\u0644 \u0627\u0644\u0625\u0645\u0627\u0645\u064a\u0629 \u0641\u064a \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062e\u0641\u064a\u0646\u061f', '\u0642\u0627\u0644\u062a \u0627\u0644\u0627\u0645\u0627\u0645\u064a\u0629 \u0628\u062c\u0648\u0627\u0632 \u0627\u0644\u062c\u0645\u0639 \u0641\u0647\u0644 \u064a\u0635\u062d\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0634\u064a\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645\u064a\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0631\u062c\u0644 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u062c\u0639\u0641\u0631\u064a \u064a\u0633\u0628 \u0627\u0644\u0635\u062d\u0627\u0628\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0623\u062e\u0630 \u0639\u0646 \u0639\u0627\u0644\u0645 \u062c\u0639\u0641\u0631\u064a\u061f', '\u0647\u0644 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a \u0645\u0646 \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0645\u0639\u062a\u0628\u0631\u0629\u061f', '\u0623\u062e\u0628\u0631\u0646\u064a \u0639\u0646 \u0639\u0627\u0644\u0645 \u062c\u0639\u0641\u0631\u064a \u0645\u0634\u0647\u0648\u0631', '\u0645\u062a\u0649 \u0638\u0647\u0631 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f'],
        SUNNI: ['\u0647\u0644 \u062a\u062c\u0648\u0632 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0625\u0645\u0627\u0645 \u062c\u0639\u0641\u0631\u064a\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0644\u0644\u0645\u0631\u0623\u0629 \u0623\u0646 \u062a\u062a\u0632\u0648\u062c \u0631\u062c\u0644\u0627 \u062c\u0639\u0641\u0631\u064a\u0627\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0627\u0644\u0625\u0645\u0627\u0645 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0627\u0644\u0632\u0648\u0627\u062c \u0645\u0646 \u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0623\u0643\u0644 \u0630\u0628\u064a\u062d\u0629 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0623\u0646 \u0623\u062a\u0632\u0648\u062c \u062c\u0639\u0641\u0631\u064a\u0627\u061f', '\u062e\u0637\u0628\u0646\u064a \u0634\u0627\u0628 \u064a\u062a\u0628\u0639 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a \u0641\u0647\u0644 \u064a\u062c\u0648\u0632 \u0644\u064a \u0627\u0644\u0632\u0648\u0627\u062c \u0645\u0646\u0647\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0623\u062a\u0628\u0627\u0639 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u0642\u0648\u0644 \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0641\u064a \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0625\u0645\u0627\u0645 \u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0632\u0648\u0627\u062c \u0645\u0646 \u062c\u0639\u0641\u0631\u064a\u0629 \u0639\u0646\u062f \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629\u061f', '\u062c\u0627\u0631\u064a \u062c\u0639\u0641\u0631\u064a \u0641\u0647\u0644 \u0623\u0631\u062f \u0639\u0644\u064a\u0647 \u0627\u0644\u0633\u0644\u0627\u0645\u061f', '\u0632\u0648\u062c\u064a \u0645\u0646 \u0627\u0644\u0634\u064a\u0639\u0629 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629 \u0641\u0647\u0644 \u0646\u0643\u0627\u062d\u064a \u0635\u062d\u064a\u062d\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0635\u0644\u0627\u0629 \u0641\u064a \u0645\u0633\u0627\u062c\u062f \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0647\u0644 \u062a\u062c\u0648\u0632 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0625\u0645\u0627\u0645 \u062c\u0639\u0641\u0631\u0649\u061f', '\u062a\u0642\u062f\u0645 \u0644\u062e\u0637\u0628\u062a\u064a \u0623\u062d\u062f \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629 \u0641\u0645\u0627 \u0627\u0644\u062d\u0643\u0645\u061f', '\u0645\u0627 \u0631\u0623\u064a \u0627\u0628\u0646 \u0628\u0627\u0632 \u0641\u064a \u0627\u0644\u0632\u0648\u0627\u062c \u0645\u0646 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', '\u0632\u0645\u064a\u0644\u064a \u0641\u064a \u0627\u0644\u0639\u0645\u0644 \u0631\u062c\u0644 \u0625\u0645\u0627\u0645\u064a \u0641\u0647\u0644 \u064a\u062c\u0648\u0632 \u0623\u0646 \u0622\u0643\u0644 \u0645\u0646 \u0637\u0639\u0627\u0645\u0647\u061f', '\u0623\u0646\u0627 \u062c\u0639\u0641\u0631\u064a \u0648\u0623\u0631\u064a\u062f \u0623\u0646 \u0623\u0639\u0631\u0641 \u0635\u0641\u0629 \u0627\u0644\u0648\u0636\u0648\u0621 \u0639\u0646\u062f \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629', '\u0643\u064a\u0641 \u0623\u062f\u0639\u0648 \u062c\u0639\u0641\u0631\u064a\u0627 \u0625\u0644\u0649 \u0627\u0644\u0633\u0646\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0625\u0645\u0627\u0645\u0629 \u0627\u0644\u062c\u0639\u0641\u0631\u064a \u0641\u064a \u0627\u0644\u0635\u0644\u0627\u0629\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0623\u0646 \u0623\u0635\u0644\u064a \u062e\u0644\u0641 \u0645\u0646 \u064a\u062a\u0628\u0639 \u0627\u0644\u0645\u0630\u0647\u0628 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0647\u0644 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0627\u0644\u062c\u0639\u0641\u0631\u064a \u0635\u062d\u064a\u062d\u0629\u061f', '\u0627\u0645\u0631\u0623\u0629 \u0645\u0646 \u0627\u0644\u0637\u0627\u0626\u0641\u0629 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629 \u0623\u0633\u0644\u0645 \u0632\u0648\u062c\u0647\u0627 \u0641\u0647\u0644 \u062a\u062d\u0644 \u0644\u0647\u061f'],
        NOT_BANNED: ['\u0645\u0646 \u0647\u0648 \u062c\u0639\u0641\u0631 \u0627\u0644\u0635\u0627\u062f\u0642\u061f', '\u0645\u0627 \u0641\u0636\u0644 \u062c\u0639\u0641\u0631 \u0628\u0646 \u0623\u0628\u064a \u0637\u0627\u0644\u0628\u061f', '\u0645\u0627 \u0645\u0639\u0646\u0649 \u0642\u0648\u0644 \u0623\u0628\u064a \u062c\u0639\u0641\u0631 \u0627\u0644\u0637\u062d\u0627\u0648\u064a \u0641\u064a \u0627\u0644\u0639\u0642\u064a\u062f\u0629\u061f', '\u0645\u0627 \u062f\u0631\u062c\u0629 \u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0627\u0644\u062c\u0639\u0641\u064a\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0625\u0645\u0627\u0645\u0629 \u0641\u064a \u0627\u0644\u0635\u0644\u0627\u0629\u061f', '\u0645\u0627 \u0641\u0636\u0644 \u0627\u0644\u0635\u0644\u0627\u0629 \u0641\u064a \u0627\u0644\u0635\u0641\u0648\u0641 \u0627\u0644\u0623\u0645\u0627\u0645\u064a\u0629\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u062a\u0642\u0648\u064a\u0645 \u0627\u0644\u0623\u0633\u0646\u0627\u0646 \u0627\u0644\u0627\u0645\u0627\u0645\u064a\u0629\u061f', '\u0647\u0644 \u064a\u062c\u0648\u0632 \u0623\u0643\u0644 \u0627\u0644\u0623\u0631\u062c\u0644 \u0627\u0644\u0623\u0645\u0627\u0645\u064a\u0629 \u0645\u0646 \u0627\u0644\u0630\u0628\u064a\u062d\u0629\u061f', '\u0625\u0645\u0627\u0645\u064a \u064a\u0637\u064a\u0644 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0647\u0644 \u0623\u0635\u0644\u064a \u062e\u0644\u0641\u0647\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0635\u0644\u0627\u0629 \u062e\u0644\u0641 \u0625\u0645\u0627\u0645\u064a \u0625\u0630\u0627 \u0643\u0627\u0646 \u064a\u0644\u062d\u0646 \u0641\u064a \u0627\u0644\u0641\u0627\u062a\u062d\u0629\u061f', '\u0645\u0627 \u0631\u0623\u064a\u0643\u0645 \u0641\u064a \u0643\u062a\u0628 \u0627\u0644\u0634\u064a\u062e \u0635\u0627\u0644\u062d \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u062f\u0631\u062c\u0629 \u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u062f\u0627\u0648\u062f \u0628\u0646 \u0627\u0644\u0642\u0627\u0633\u0645 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u061f', '\u0645\u0627 \u062d\u0643\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u062c\u0645\u0639\u0629 \u062e\u0644\u0641 \u0625\u0645\u0627\u0645 \u0634\u0627\u0641\u0639\u064a\u061f'],
        BANNED_FORMS: ['\u062c\u0639\u0641\u0631\u0649', '\u062c\u0639\u0641\u0631\u06cc', '\u062c\u0639\u0641\u0631\u064a\u0647', '\u0642\u0627\u0644\u062a \u0627\u0644\u0627\u0645\u0627\u0645\u064a\u0629', '\u0648\u0627\u0644\u0627\u0645\u0627\u0645\u064a\u0629', '\u0627\u0644\u0634\u064a\u0639\u0629 \u0627\u0644\u0627\u0645\u0627\u0645\u064a\u0629', '\u0631\u062c\u0644 \u0625\u0645\u0627\u0645\u064a', '\u0627\u0644\u0625\u0645\u0627\u0645\u064a'],
        NEUTRAL_Q: '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062c\u0645\u0639 \u0628\u064a\u0646 \u0627\u0644\u0635\u0644\u0627\u062a\u064a\u0646 \u0641\u064a \u0627\u0644\u062d\u0636\u0631\u061f', SENTENCE: '\u0647\u0630\u0627 \u0627\u0644\u0645\u0630\u0647\u0628 \u0644\u064a\u0633 \u0645\u0646 \u0645\u0630\u0627\u0647\u0628 \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629 \u0648\u0627\u0644\u062c\u0645\u0627\u0639\u0629\u060c \u0648\u0639\u0632\u0643 \u0644\u0627 \u064a\u0646\u0642\u0644 \u0639\u0646\u0647 \u0634\u064a\u0626\u064b\u0627. \u0648\u0625\u0646 \u0643\u0627\u0646 \u0633\u0624\u0627\u0644\u0643 \u0639\u0646 \u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0646\u0641\u0633\u0647\u0627\u060c \u0641\u0627\u0633\u0623\u0644 \u0639\u0646\u0647\u0627 \u0648\u064a\u062c\u064a\u0628\u0643 \u0639\u0632\u0643 \u0645\u0646 \u0643\u0644\u0627\u0645 \u0639\u0644\u0645\u0627\u0621 \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629.', CONSTANT: '\u0644\u0627 \u062a\u0630\u0643\u0631\u0650 \u0627\u0644\u0645\u0630\u0647\u0628\u064e \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u064e\u0651 (\u0627\u0644\u0625\u0645\u0627\u0645\u064a\u0651\u0629) \u0641\u064a \u0627\u0644\u062c\u0648\u0627\u0628\u0650 \u0628\u062d\u0627\u0644\u064d: \u0644\u0627 \u0642\u0648\u0644\u064b\u0627 \u0644\u0647 \u0648\u0644\u0627 \u0646\u0641\u064a\u064b\u0627 \u0639\u0646\u0647\u060c \u0648\u0644\u0627 \u062a\u0642\u0644\u0652 \u0641\u064a\u0647 \u00ab\u0644\u0645 \u0623\u0642\u0641\u00bb\u060c \u0648\u0644\u0627 \u062a\u0639\u0637\u0650 \u0639\u0646\u0647 \u0645\u0639\u0644\u0648\u0645\u0629. \u0641\u0625\u0646 \u0633\u0623\u0644 \u0627\u0644\u0633\u0627\u0626\u0644\u064f \u0639\u0646 \u062d\u0643\u0645\u064d \u0639\u0646\u062f \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629 \u0641\u064a\u0647 \u0630\u0643\u0631\u064f \u0623\u062a\u0628\u0627\u0639\u0650\u0647\u060c \u0641\u0623\u062c\u0628\u0652 \u0645\u0646 \u0643\u0644\u0627\u0645\u0650 \u0639\u0644\u0645\u0627\u0621\u0650 \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629 \u0641\u064a \u0627\u0644\u0646\u0635\u0648\u0635\u0650 \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629\u0650 \u0647\u0646\u0627 \u062f\u0648\u0646 \u0623\u0646 \u062a\u0633\u0645\u0651\u064a\u064e \u0627\u0644\u0645\u0630\u0647\u0628\u064e.', SUNNI_UNIT: '\u0632\u0648\u0627\u062c \u0627\u0644\u0645\u0633\u0644\u0645\u0629 \u0645\u0646 \u0631\u062c\u0644 \u062c\u0639\u0641\u0631\u064a \u0645\u0633\u0623\u0644\u0629 \u0627\u062e\u062a\u0644\u0641 \u0641\u064a\u0647\u0627 \u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u0645\u0639\u0627\u0635\u0631\u0648\u0646.' };
    const ENTRIES_J2 = {
      E1: { label: 'BW2 brief adult', env: { BEFORE_WRITING_V2: 'on' }, body: { depth: 'brief' } },
      E2: { label: 'BW2 detailed (deep) adult', env: { BEFORE_WRITING_V2: 'on' }, body: { depth: 'deep' } },
      E3: { label: 'legacy free brain (BW2 off)', env: { BEFORE_WRITING_V2: 'off' }, body: {} },
      E4: { label: 'legacy, free brain off', env: { BEFORE_WRITING_V2: 'off', FREE_BRAIN_V1: 'off' }, body: {} },
      E5: { label: 'BW2 young', env: { BEFORE_WRITING_V2: 'on' }, body: { band: 'young', age: 9 } },
      E6: { label: 'BW2 teen', env: { BEFORE_WRITING_V2: 'on' }, body: { band: 'teen', age: 15 } },
      E7: { label: 'call mode adult', env: { BEFORE_WRITING_V2: 'on' }, body: { mode: 'call' } },
    };
    const deniedJ2 = (a) => !a.crashed && a.text === J2.SENTENCE && a.outbound.length === 0 && !/<\s*(source|book)\b/u.test(a.text)
      && Object.assign({}, ...a.notes).path === 'canned' && a.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : [])).includes('school_denied');
    const normalJ2 = (a) => !a.crashed && a.text !== J2.SENTENCE && a.outbound.length > 0 && !a.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : [])).includes('school_denied');
    for (const [eid, entry] of Object.entries(ENTRIES_J2)) {
      const deny = []; for (const q of J2.DENY) deny.push(deniedJ2(await drive(q, entry)));
      ok('J2-' + eid + ' (' + entry.label + ') every DENY row -> THE SENTENCE byte for byte, zero model and retrieval calls, no card, no footer, logged canned with school_denied', deny.every(Boolean), 'missed ' + deny.map((x, i) => (x ? 0 : i + 1)).filter(Boolean).join(','));
      const sunni = []; for (const q of J2.SUNNI) sunni.push(normalJ2(await drive(q, entry)));
      ok('J2-' + eid + ' (' + entry.label + ') every SUNNI RULING row -> the normal path (outbound calls made), no deny', sunni.every(Boolean), 'denied ' + sunni.map((x, i) => (x ? 0 : i + 1)).filter(Boolean).join(','));
      const plain = []; for (const q of J2.NOT_BANNED) plain.push(normalJ2(await drive(q, entry)));
      ok('J2-' + eid + ' (' + entry.label + ') every NOT BANNED row -> the normal path, no deny', plain.every(Boolean), 'denied ' + plain.map((x, i) => (x ? 0 : i + 1)).filter(Boolean).join(','));
    }
    {
      // the stored path's standalone form of a follow-up: SYNTHETIC «وماذا عنها؟» carried onto DENY#1 (lib/stored-deen.js resolveStoredContext)
      const follow = '\u0648\u0645\u0627\u0630\u0627 \u0639\u0646\u0647\u0627\u061f';
      const a = await drive(follow, { ...ENTRIES_J2.E1, messages: [{ role: 'user', content: J2.DENY[0] }, { role: 'assistant', content: J2.SENTENCE }, { role: 'user', content: follow }] });
      ok('J2-F a follow-up the stored path carries onto a DENY question -> THE SENTENCE, zero model and retrieval calls (its standalone form is classified too, before every call)', !a.crashed && a.text === J2.SENTENCE && a.outbound.length === 0, a.crashed ? a.crashed.message : a.text.slice(0, 80).replace(/[^\x20-\x7e]/g, '.'));
    }
    {
      // the deny never takes the place of a fixed reply the server gives first: SYNTHETIC first-person self-harm («أريد أن أنتحر»,
      // brain-line-b2's form) followed by DENY#7 -> the self-harm support text stands
      const CORE_J2 = await esm('lib/policy/core.js');
      const a = await drive('\u0623\u0631\u064a\u062f \u0623\u0646 \u0623\u0646\u062a\u062d\u0631\u060c \u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062c\u0639\u0641\u0631\u064a\u0629\u061f', ENTRIES_J2.E1);
      ok('J2-H a self-harm question that also names the school -> the self-harm support text, not THE SENTENCE (the fixed reply given first stands)', !a.crashed && a.text === CORE_J2.WARM_TEMPLATES.SELFHARM_SUPPORT && a.text !== J2.SENTENCE, a.text.slice(0, 60).replace(/[^\x20-\x7e]/g, '.'));
    }
    {
      // the mutant: the deny seat removed (a twin of api/ask.js beside it)
      const fs = require('fs');
      const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
      const seat = '  if (schoolDenied) {\n    answerLog.note({ path: \'canned\', flags: [\'school_denied\'] });\n    logRoute({ impermissible: \'none\' });\n    return sendSynthesizedText(res, BANNED_SCHOOL_DENY_TEXT);\n  }\n';
      ok('J2 deny-branch mutant seam present once', askSrc.split(seat).length === 2);
      const tmp = path.join(REPO, 'api', '.mut-j2-ask-' + process.pid + '.mjs');
      fs.writeFileSync(tmp, askSrc.split(seat).join(''));
      let MA = null;
      try { MA = await import('file://' + tmp.replace(/\\/g, '/') + '?m=' + Date.now()); } catch (e) { MA = null; } finally { fs.rmSync(tmp, { force: true }); }
      const m = MA ? await drive(J2.DENY[0], { ...ENTRIES_J2.E1, handler: MA.default }) : null;
      ok('J2 MUTANT KILLED: with the deny branch removed DENY#1 is answered by the normal path (the DENY rows red)', !!m && m.text !== J2.SENTENCE && m.outbound.length > 0, m ? m.text.slice(0, 60).replace(/[^\x20-\x7e]/g, '.') : 'no module');
    }
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
