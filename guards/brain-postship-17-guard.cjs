// guards/brain-postship-17-guard.cjs -- POSTSHIP FIX3 ITEM 2 -- 2026-10-25 (completes POSTSHIP FIX2 item 1)
//
// THE SUPPORT REPLY FOR THE READER WHO WRITES PERSIAN OR URDU. Measured on the preview: in the Persian interface
// «پیشنهادم درباره برنامه عزک را برای چه کسی بفرستم؟» got a model answer saying "send it to the app's support team",
// with no address (English passed). Read in the code (lib/policy/support-contact.js at c6f08a53): `fold` did not take
// the Persian / Urdu letters to their Arabic counterparts («عزک» with the Persian kaf is not «عزك», «ی» is not «ي»);
// AR_APP wanted «التطبيق» / «البرنامج» with the article; and nothing read the Persian or Urdu text itself, so the
// answer hung on the real translator's wording -- kinder in FIX2's fake translations than on the preview.
// The order (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-FIX3-DIRECTIVE-2026-10-25.md, item 2):
//   (a) fold takes the Persian and Urdu letters to their Arabic counterparts, kaf and yaa first;
//   (b) «تطبيق» / «برنامج» without the article count when Ezik's name follows; the name in Latin letters counts too;
//   (c) a Persian matcher and an Urdu matcher on the reader's own text, as narrow as the two that stand: a contact word
//       with the support desk, or a problem / suggestion about the app with where / to whom / send;
//   (d) still narrow: what does not open it today does not.
// Acceptance through the real path: the FAKE translator (the handler's fetch stub answering the translation system
// prompt, as in guards/brain-postship-13-guard.cjs) returns NEUTRAL Arabic with no key word, so the matcher on the
// reader's own text opens it alone; then the witness with three realistic Arabic translations.
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
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '.');
// what the fake translator returns for the questions that must open it: Arabic with no word any matcher reads
const NEUTRAL = 'عندي سؤال عن هذا الأمر.';
// the order's own lists, copied
const WITNESS = 'پیشنهادم درباره برنامه عزک را برای چه کسی بفرستم؟';
const OPEN = [
  [WITNESS, 'fa'],
  ['چطور با پشتیبانی عزک تماس بگیرم؟', 'fa'],
  ['ایمیل پشتیبانی برنامه عزک چیست؟', 'fa'],
  ['یک مشکل در اپلیکیشن عزک پیدا کردم، به کجا گزارش بدهم؟', 'fa'],
  ['عزک کی سپورٹ سے کیسے رابطہ کروں؟', 'ur'],
  ['عزک ایپ کے بارے میں اپنی تجویز کہاں بھیجوں؟', 'ur'],
  ['عزک ایپ میں مسئلہ ہے، کس کو بتاؤں؟', 'ur'],
];
const WITNESS_ARABIC = [
  'لمن أرسل اقتراحي حول برنامج عزک؟',
  'إلى من أرسل اقتراحي بشأن تطبيق عزك؟',
  'لمن يجب أن أرسل اقتراحاتي حول تطبيق Ezik؟',
];
// the order's three that must not open it, with the Arabic a real translator would give
const CLOSED = [
  ['چطور از پدر و مادرم حمایت کنم؟', 'fa', 'كيف أدعم والديّ؟'],
  ['چگونه به فقرا کمک کنم؟', 'fa', 'كيف أساعد الفقراء؟'],
  ['میں اپنے دوست کو مشورہ کیسے دوں؟', 'ur', 'كيف أنصح صديقي؟'],
];
const EMAIL = 'Passerbyq8@gmail.com';
const TRANSLATOR_HEAD = 'You are a translation engine inside an Islamic question-and-answer app.';

(async () => {
  const SC = await esm('lib/policy/support-contact.js');
  const FX = await esm('lib/lang/fixed.js');
  const f = SC.isSupportContactRequest;

  console.log('-- 1. the matchers alone');
  ok('(c) the neutral translation opens nothing', f(NEUTRAL) === false);
  for (const [q] of OPEN) ok('(c) opens on the reader\'s own text: ' + asc(q).slice(0, 50), f(q) === true);
  for (const ar of WITNESS_ARABIC) ok('(a)(b) opens on the Arabic: ' + asc(ar), f(ar) === true);
  for (const [q, , ar] of CLOSED) { ok('(d) stays closed: ' + asc(q).slice(0, 50), f(q) === false); ok('(d) stays closed as translated: ' + asc(ar), f(ar) === false); }
  ok('(a) fold: the Persian kaf and yaa are the Arabic ones («عزک» opens what «عزك» opens)', f('مشكله في تطبيق عزک لمن ارسلها') === true && f('مشكله في تطبيق عزك لمن ارسلها') === true);
  ok('(b) the bare noun alone is not the app (no name after it)', f('لمن أرسل اقتراحي حول برنامج؟') === false && f('لمن أرسل اقتراحي حول تطبيق؟') === false);
  ok('(c) «پشتیبانی» without a contact or channel word does not open it', f('چطور از پدر و مادرم پشتیبانی کنم؟') === false);
  ok('(c) «سپورٹ» without a contact or channel word does not open it', f('میں اپنے والدین کو سپورٹ کیسے کروں؟') === false);
  ok('(c) a suggestion with a where-word but no app does not open it (fa)', f('پیشنهادم را برای مسجد کجا بفرستم؟') === false);
  ok('(c) a problem with a where-word but no app does not open it (ur)', f('میرے گھر میں مسئلہ ہے، کس کو بتاؤں؟') === false);
  // (d) more of what a Persian or Urdu reader asks every day, closed before this item and closed after it
  for (const q of [
    'حکم نماز مسافر چیست؟', 'آیا خواندن قرآن بدون وضو اشکال دارد؟', 'کی روزه قضا را بگیرم؟', 'مشکل من با همسرم را به چه کسی بگویم؟',
    'برنامه روزانه برای حفظ قرآن را کجا پیدا کنم؟', 'چطور از خانواده ام پشتیبانی کنم؟', 'عزک چیست؟', 'شماره تماس مسجد را از کجا پیدا کنم؟',
    'میں نماز کیسے پڑھوں؟', 'عزک کیا ہے؟', 'زکوٰۃ کس کو دوں؟', 'اپنے بھائی کی سپورٹ کیسے کروں؟', 'میرے کاروبار میں مسئلہ ہے، کیا کروں؟',
  ]) ok('(d) stays closed: ' + asc(q).slice(0, 50), f(q) === false);

  console.log('-- 2. the real path: languageGate -> the fake translator -> api/ask.js, no model');
  // The harness of guards/brain-postship-13-guard.cjs section 3, copied (lines 83-189 there).
  const ASKMOD = await esm('api/ask.js');
  const FC = await esm('lib/fatwa-contract.js');
  const LEDGER_REDIS = await esm('lib/ledger/redis.js');
  const DAYCAP = await esm('lib/daycap.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const LEGACY = await esm('lib/legacy-policy-flag.js');
  const CONSENT = await esm('lib/ai-consent.js');
  const handler = ASKMOD.default;
  // The harness of guards/brain-postship-4-guard.cjs section 4 (itself from impermissible-early-guard.cjs section E), copied;
  // the fetch stub also answers the translator's system prompt, and the request declares its interface language.
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
    end(s) { if (s) this.writes.push(String(s)); this.ended += 1; this.headersSent = true; return this; },
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
  async function drive(question, lang, arabic) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
    process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
    process.env.LEDGER_RAG = 'off';
    process.env.FREE_BRAIN_V1 = 'on';
    const written = [];
    LEDGER_REDIS.__setRedisForTest({
      async get() { return null; }, async set(k, v) { if (String(k).startsWith('al:v1:') && !String(k).startsWith('al:v1:d:')) written.push(JSON.parse(v)); return 'OK'; },
      async lpush() { return 1; }, async ltrim() { return 'OK'; }, async expire() { return 1; }, async incr() { return 1; }, async lrange() { return []; }, async eval() { return null; },
    });
    FLAG.__resetFlagCacheForTest();
    LEGACY.__resetLegacyFlagCacheForTest();
    installDayCapStore();
    const calls = []; const translated = []; const modelSaw = [];
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('api.anthropic.com')) {
        const b = JSON.parse(init.body);
        const system = typeof b.system === 'string' ? b.system : '';
        if (system.startsWith(TRANSLATOR_HEAD)) {
          translated.push(b.messages[0].content);
          const n = JSON.parse(b.messages[0].content).length;
          return jsonResponse(u, { content: [{ type: 'text', text: JSON.stringify(Array(n).fill(arabic)) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        calls.push(u);
        // the answer's own translation (lib/lang/model.js answerSystemOf) reads the reply, not the question
        if (!system.startsWith('You translate answers')) modelSaw.push(JSON.stringify(b.messages || []));
        if (system.startsWith('You are the routing step')) return jsonResponse(u, { content: [{ type: 'text', text: 'RELIGIOUS' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        return jsonResponse(u, { content: [{ type: 'text', text: WRITER_TEXT }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      calls.push(u);
      if (u.startsWith(FC.FATWA_BASE)) return jsonResponse(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, results: [], scholars: [], pagination: { total: 0 }, counts: { scholars: 0 } });
      return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
    };
    const res = makeRes();
    ipSeq += 1;
    const req = {
      method: 'POST',
      headers: { 'x-murabbi-device': 'postship-17-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.25.17.' + ipSeq,
        'x-ezik-lang': lang, [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
      on() { return this; },
      body: { messages: [{ role: 'user', content: question }], band: 'adult', age: 35 },
    };
    const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
    let crashed = null;
    try { await handler(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
    globalThis.fetch = realFetch;
    const text = res.writes.join('').split('\n\n').map((w) => (/^data: (.*)$/s.exec(w) || [])[1]).filter(Boolean).map((j) => { try { return JSON.parse(j); } catch { return null; } })
      .filter((o) => o && o.type === 'content_block_delta' && o.delta && o.delta.text).map((o) => o.delta.text).join('');
    const outbound = calls.filter((u) => !String(u).endsWith('/pipeline'));
    LEDGER_REDIS.__setRedisForTest(null);
    return { text, notes: written, outbound, translated, modelSaw, crashed };
  }
  const opens = async (q, lang, ar, tag) => {
    const a = await drive(q, lang, ar);
    const want = FX.fixedRendition(lang, SC.SUPPORT_CONTACT_TEXT);
    ok(tag + ' ... the question went through the fake translator', a.translated.length === 1, String(a.translated.length));
    ok(tag + ' -> the fixed support text in the reader\'s language, the address letter for letter',
      !a.crashed && !!want && a.text === want && a.text.includes('\n' + EMAIL), a.crashed ? a.crashed.message : asc(a.text.slice(0, 140)));
    ok(tag + ' ... no model, no sorter, no search', a.outbound.length === 0, a.outbound.join(' '));
    const flags = a.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : []));
    ok(tag + ' ... logged canned with support_contact', Object.assign({}, ...a.notes).path === 'canned' && flags.includes('support_contact'), JSON.stringify(flags));
  };
  try {
    for (const [q, lang] of OPEN) await opens(q, lang, NEUTRAL, '[neutral] ' + asc(q).slice(0, 50));
    for (const ar of WITNESS_ARABIC) await opens(WITNESS, 'fa', ar, '[witness as ' + asc(ar).slice(0, 30) + ']');
    for (const [q, lang, ar] of CLOSED) {
      const a = await drive(q, lang, ar);
      const tag = asc(q).slice(0, 50);
      ok(tag + ' -> no support text, the turn goes on to the model', !a.crashed && !a.text.includes(EMAIL) && a.outbound.length > 0, a.crashed ? a.crashed.message : asc(a.text.slice(0, 120)));
      ok(tag + ' ... the model reads the translated Arabic, not the reader\'s own text',
        a.modelSaw.length > 0 && a.modelSaw.every((m) => m.includes(ar.replace(/[؟?]$/u, '').slice(0, 8)) && !m.includes(q.slice(0, 12))), String(a.modelSaw.length));
    }
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
