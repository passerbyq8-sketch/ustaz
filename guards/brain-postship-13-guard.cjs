// guards/brain-postship-13-guard.cjs -- POSTSHIP FIX2 ITEM 1 -- 2026-10-25 (completes POSTSHIP item 4)
//
// THE SUPPORT REPLY FOR THE READER WHO DOES NOT WRITE ARABIC. Measured on the preview: in the English interface
// "Where can I send feedback about the Ezik app?" got a general model answer with no address, and the app under
// another name. Read in the code: api/ask.js translates the reader's question into Arabic IN PLACE
// (req.__langTranslateQuestion -> lib/lang/question.js translateQuestionInPlace), and the support matcher then read
// only the Arabic, whose forms («ملاحظاتي», «اقتراحي», «دعم عزك», «فريق عزك») it did not know.
// The order (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-FIX2-DIRECTIVE-2026-10-25.md, item 1):
//   (a) the reader's text AS WRITTEN, before the translation, is read too, and the Arabic after it; either opens it;
//       what reaches the sorter and the model is not changed;
//   (b) the Arabic matcher takes plural and possessive forms of problem / suggestion / note, «رأيي» (not «رأي»),
//       «دعم» in construct with عزك / التطبيق, and the team addressed («فريق عزك» · «المطورين» · «أصحاب التطبيق» ·
//       «القائمين على التطبيق»);
//   (c) still narrow: the ten of item 4 that do not open it, and five more, do not.
// The pairs below are the order's own, copied: the reader's question, and what the FAKE translator returns. The fake
// translator is the model seat of the real path: the handler's fetch is a stub that answers the translation system
// prompt with the paired Arabic, so the question goes through languageGate -> translateQuestionInPlace -> api/ask.js
// exactly as on the preview, and no model is reachable.
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
// [reader's question, its interface language, the fake translator's Arabic (null: Arabic, no translation)]
const OPEN = [
  ['Where can I send feedback about the Ezik app?', 'en', 'أين يمكنني إرسال ملاحظاتي حول تطبيق عزك؟'],
  ['I have a suggestion for the app, who do I send it to?', 'en', 'لدي اقتراح للتطبيق، لمن أرسله؟'],
  ['How can I reach the team behind Ezik?', 'en', 'كيف يمكنني التواصل مع فريق عزك؟'],
  ['Is there an email to send my notes about the app?', 'en', 'هل يوجد بريد إلكتروني لإرسال ملاحظاتي حول التطبيق؟'],
  ['I found a mistake in Ezik, where do I report it?', 'en', 'وجدت خطأ في عزك، أين أبلغ عنه؟'],
  ['چطور با پشتیبانی عزک تماس بگیرم؟', 'fa', 'كيف أتواصل مع دعم عزك؟'],
  ['پیشنهادم را برای برنامه کجا بفرستم؟', 'fa', 'أين أرسل اقتراحي للبرنامج؟'],
  ['عزک کی سپورٹ سے کیسے رابطہ کروں؟', 'ur', 'كيف أتواصل مع دعم عزك؟'],
  ['ایپ کے بارے میں اپنی رائے کہاں بھیجوں؟', 'ur', 'أين أرسل رأيي حول التطبيق؟'],
  ['ابي ارسل ملاحظاتي على التطبيق لمن؟', 'ar', null],
];
const CLOSED_NEW = [
  ['How can I give feedback to my child without hurting him?', 'en', 'كيف أعطي ملاحظاتي لطفلي دون أن أجرحه؟'],
  ['I want to send my suggestion to the mosque committee, how should I phrase it?', 'en', 'أريد أن أرسل اقتراحي إلى لجنة المسجد، كيف أصيغه؟'],
  ['ما رأي الشيخ ابن باز في دعم الجمعيات الخيرية؟', 'ar', null],
  ['أين أرسل زكاة مالي؟', 'ar', null],
  ['ما حكم إرسال ملاحظات للمدير بدون علمه؟', 'ar', null],
];
// the ten of POSTSHIP item 4 that do not open it (guards/brain-postship-4-guard.cjs CLOSED), copied
const CLOSED_OLD = [
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
const TRANSLATOR_HEAD = 'You are a translation engine inside an Islamic question-and-answer app.';

(async () => {
  const SC = await esm('lib/policy/support-contact.js');
  const FX = await esm('lib/lang/fixed.js');
  const f = SC.isSupportContactRequest;

  console.log('-- 1. the Arabic matcher (b): each Arabic the translator returns opens it on its own');
  for (const [q, , ar] of OPEN) ok('opens: ' + asc(ar || q), f(ar || q) === true);
  console.log('-- 2. still narrow (c): the five new and the ten of item 4, as written and as translated');
  for (const [q, , ar] of CLOSED_NEW) { ok('stays closed: ' + asc(q), f(q) === false); if (ar) ok('stays closed: ' + asc(ar), f(ar) === false); }
  for (const q of CLOSED_OLD) ok('stays closed (item 4): ' + asc(q), f(q) === false);
  ok('«رأي» alone does not open it, «رأيي» with a where-word and the app does', f('ما رأي التطبيق أين؟') === false && f('أين أرسل رأيي حول التطبيق؟') === true);

  console.log('-- 3. the real path (a): languageGate -> the fake translator -> api/ask.js, no model');
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
      headers: { 'x-murabbi-device': 'postship-13-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.25.13.' + ipSeq,
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
  try {
    for (const [q, lang, ar] of OPEN) {
      const a = await drive(q, lang, ar);
      const tag = asc(q).slice(0, 60);
      const want = lang === 'ar' ? SC.SUPPORT_CONTACT_TEXT : FX.fixedRendition(lang, SC.SUPPORT_CONTACT_TEXT);
      if (ar) ok(tag + ' ... the question went through the fake translator', a.translated.length === 1, String(a.translated.length));
      ok(tag + ' -> the fixed support text in the reader\'s language, the address letter for letter',
        !a.crashed && !!want && a.text === want && a.text.includes('\n' + EMAIL), a.crashed ? a.crashed.message : asc(a.text.slice(0, 140)));
      ok(tag + ' ... no model, no sorter, no search', a.outbound.length === 0, a.outbound.join(' '));
      const flags = a.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : []));
      ok(tag + ' ... logged canned with support_contact', Object.assign({}, ...a.notes).path === 'canned' && flags.includes('support_contact'), JSON.stringify(flags));
    }
    for (const [q, lang, ar] of CLOSED_NEW) {
      const a = await drive(q, lang, ar);
      const tag = asc(q).slice(0, 60);
      ok(tag + ' -> no support text, the turn goes on to the model', !a.crashed && !a.text.includes(EMAIL) && a.outbound.length > 0, a.crashed ? a.crashed.message : asc(a.text.slice(0, 120)));
      // (a): what reaches the sorter and the model is the Arabic the translator returned, as before
      if (ar) ok(tag + ' ... the model reads the translated Arabic, not the reader\'s own text',
        a.modelSaw.length > 0 && a.modelSaw.every((m) => m.includes(ar.replace(/[؟?]$/u, '').slice(0, 12)) && !m.includes(q.slice(0, 20))), String(a.modelSaw.length));
    }
    // (a) on its own: a translation whose Arabic the matcher does not take («تعليقي» is none of its words); the
    // reader's own English still opens it, because the text as written is read too
    const LOOSE = 'أين أكتب تعليقي عن عزك؟';
    ok('(a) the loose translation alone does not open it', f(LOOSE) === false);
    const l = await drive(OPEN[0][0], 'en', LOOSE);
    ok('(a) ' + asc(OPEN[0][0]) + ' with a loose translation -> still the fixed support text, no model',
      !l.crashed && l.text === FX.fixedRendition('en', SC.SUPPORT_CONTACT_TEXT) && l.outbound.length === 0, l.crashed ? l.crashed.message : asc(l.text.slice(0, 120)));
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
