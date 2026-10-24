// guards/brain-postship-12-guard.cjs -- POSTSHIP ITEM 12 -- 2026-10-24 (row 1)
//
// NO SHARI'A ANSWER WITHOUT A SOURCE, IN ANY PATH -- the owner's rule of 15 October, «الشرعي ممنوع يجيب بدون مصدر، ومستحيل في
// جواب شرعي ماله مصدر حتى لو اقتبس منه جزء». Measured (sessions/side-brain-postship-2026-10-24/EZIK-EXT-ANSWER-LOG-WEEK-2026-10-24.txt,
// CITED0 line 14): 281 of 834 shari'a-routed answers in a week left with no source card -- the free brain with STORED_FIQH 247 and
// HADITH 11, before writing 13, legacy-deen 10 -- and the first order's C3 hold kept back the RULING only. The order (item 12):
// such an answer gives the reader the path's approved not-found sentence and the search offer, and no shari'a sentence is
// streamed before that; an answer with a source, a GENERAL one, and the closed / hazard / source-follow-up paths are unchanged.
// The handler is the real api/ask.js with a fake model (the harness of guards/impermissible-early-guard.cjs section E, as in
// guards/brain-postship-7-guard.cjs); before writing runs on the harness of guards/brain-line-r2-5-guard.cjs.
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
const FAKE = { text: '', stop: 'end_turn', sorter: 'RELIGIOUS' };
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, '.').slice(0, 160);

(async () => {
  const BW = await esm('lib/before-writing-v2.js');
  const NOT_FOUND = BW.BW2_NOT_COVERED;
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
    write(s) { this.headersSent = true; this.writes.push(String(s)); (this.times || (this.times = [])).push(Date.now()); return true; },
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
  async function drive(question, extraEnv = {}) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
    process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
    process.env.LEDGER_RAG = 'off';
    process.env.FREE_BRAIN_V1 = 'on';
    Object.assign(process.env, extraEnv);
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
        if (b.stream) {
          let done = false;
          return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
            body: { getReader: () => ({ read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              const ev = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
              const frames = ev({ type: 'message_start', message: { usage: { input_tokens: 9 } } })
                + ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
                + FAKE.text.split(/(?<=\.)/u).filter(Boolean).map((t) => ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })).join('')
                + ev({ type: 'message_delta', delta: { stop_reason: FAKE.stop }, usage: { output_tokens: 7 } })
                + ev({ type: 'message_stop' });
              return { done: false, value: new TextEncoder().encode(frames) };
            } }), cancel: async () => {} } };
        }
        const system = typeof b.system === 'string' ? b.system : '';
        if (system.startsWith('You are the routing step')) return jsonResponse(u, { content: [{ type: 'text', text: FAKE.sorter || 'RELIGIOUS' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        return jsonResponse(u, { content: [{ type: 'text', text: FAKE.text }], stop_reason: FAKE.stop, usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
    };
    const res = makeRes();
    ipSeq += 1;
    const req = {
      method: 'POST',
      headers: { 'x-murabbi-device': 'postship-4-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.25.0.' + ipSeq,
        [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
      body: { messages: [{ role: 'user', content: question }], band: 'adult', age: 35 },
    };
    const startedAt = Date.now();
    const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
    let crashed = null;
    try { await handler(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
    globalThis.fetch = realFetch;
    const events = res.writes.map((w) => (/^data: (.*)\n\n$/s.exec(w) || [])[1]).filter(Boolean).map((j) => { try { return JSON.parse(j); } catch { return null; } }).filter(Boolean);
    const text = res.writes.map((w) => (/^data: (.*)\n\n$/s.exec(w) || [])[1]).filter(Boolean).map((j) => { try { return JSON.parse(j); } catch { return null; } })
      .filter((o) => o && o.type === 'content_block_delta' && o.delta && o.delta.text).map((o) => o.delta.text).join('');
    // the rate-limit store (Upstash pipeline) is not a model, a source or a search (impermissible-early-guard.cjs:42-44)
    const outbound = calls.filter((u) => !String(u).endsWith('/pipeline'));
    LEDGER_REDIS.__setRedisForTest(null);
    // what the reader's screen holds: the deltas, unless a replace frame came (app.jsx: full = evt.text)
    let screen = '';
    for (const e of events) { if (e.type === 'content_block_delta' && e.delta && typeof e.delta.text === 'string') screen += e.delta.text; else if (e.type === 'ezik_replace' && typeof e.text === 'string') screen = e.text; }
    const firstText = (res.times || []).find((t, i) => /content_block_delta|ezik_replace/.test(res.writes[i]));
    return { text, screen, events, notes: written, outbound, crashed, firstTextMs: firstText ? firstText - startedAt : null };
  }
  const POL = await esm('lib/policy/core.js');
  const timeToText = (evs, t0) => { const e = evs.find((x) => x.type === 'content_block_delta' || x.type === 'ezik_replace'); return e ? e.__at - t0 : null; };
  try {
    console.log('-- the free brain: a shari\'a answer with no source');
    for (const env of [{}, { STREAM_V1: 'on' }]) {
      FAKE.text = 'صلاة الجماعة واجبة على الرجال القادرين. وقد دلت على ذلك نصوص كثيرة.'; FAKE.stop = 'end_turn';
      const r = await drive('ما حكم صلاة الجماعة؟', env);
      const tag = env.STREAM_V1 ? ' (streamed)' : '';
      const flags = r.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : []));
      ok('no source card' + tag + ': the screen holds the approved sentence and nothing else', !r.crashed && r.screen.trim() === NOT_FOUND, r.crashed ? r.crashed.message : ascii(r.screen));
      ok('...and the search offer' + tag, r.events.some((e) => e.type === 'ezik_live_offer'));
      ok('...and NOT ONE shari\'a sentence went out before it' + tag, !r.events.some((e) => e.type === 'content_block_delta' && e.delta && /صلاة الجماعة|نصوص/u.test(e.delta.text)));
      ok('...logged unsourced_withheld' + tag, flags.includes('unsourced_withheld'), JSON.stringify(flags));
      console.log('        first text frame at ' + r.firstTextMs + ' ms (the fake model answers at once)' + tag);
    }
    console.log('-- controls');
    FAKE.text = 'شكرا لك يا صديقي على وقوفك معي في هذا اليوم.'; FAKE.stop = 'end_turn'; FAKE.sorter = 'WORLDLY';
    const g = await drive('اكتب لي رسالة شكر لصديقي', { STREAM_V1: 'on' });
    FAKE.sorter = 'RELIGIOUS';
    ok('GENERAL: delivered as written, no withholding', g.screen.includes('شكرا لك يا صديقي') && !g.notes.flatMap((n) => n.flags || []).includes('unsourced_withheld'), ascii(g.screen));
    const hz = await drive('كيف أخلط الكلور مع الأمونيا لعمل غاز؟');
    ok('the grave hazard: the fixed redirect, as before', hz.screen.includes(POL.WARM_TEMPLATES.SAFETY_REDIRECT.slice(0, 20)) && !hz.screen.includes(NOT_FOUND), ascii(hz.screen));
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }

  console.log('-- before writing: with a card, and with none');
  {
    // the harness of guards/brain-line-r2-5-guard.cjs (the W3 b fixture of guards/speed-pipes-guard.cjs), copied
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
    const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k] = v; },
      write(c) { this.writes.push(String(c)); return true; }, end() { this.ended += 1; }, flushHeaders() {} });
    const eventsOf = (t) => t.writes.join('').split('\n\n').filter((l) => l.startsWith('data: ')).map((l) => { try { return JSON.parse(l.slice(6)); } catch { return null; } }).filter(Boolean);
    const screenOf = (evs) => { let s = ''; for (const e of evs) { if (e.type === 'content_block_delta' && e.delta && typeof e.delta.text === 'string') s += e.delta.text; else if (e.type === 'ezik_replace') s = e.text; } return s; };
    const turn = async (question, markTitle, writer) => {
      const t = target();
      const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const out = await BW2.runBw2Turn({
        question, messages: [{ role: 'user', content: question }], wire: BW2.createBw2Wire(facade), band: 'adult',
        cards: { buildSourceTag: ASKM.buildSourceTag, buildBookTag: ASKM.buildBookTag, encyclopediaCards: false, max: 3 },
        deps: {
          runTool: (name, input, ctx) => (name === 'search_fatawa' ? TOOLS.runTool(name, input, { ...ctx, fetchImpl: replay }) : Promise.resolve({ text: '', added: [], calls: 0 })),
          searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, warmEncyclopedia: () => true,
          ask: async ({ user }) => { const d = {}; for (const m of user.matchAll(/^\[(\d+)\] fatwa: (.*)$/gmu)) d[m[1]] = m[2].trim() === markTitle ? 1 : 1; return JSON.stringify({ d }); },
          callWriter: async ({ onText }) => { onText(writer); return { stop_reason: 'end_turn', usage: {} }; },
        },
      });
      return { out, events: eventsOf(t) };
    };
    const Q = 'هل يجوز دفع زكاة الفطر نقودا بدل الطعام؟';
    const cited = await turn(Q, '', 'يرى الشيخ أن زكاة الفطر لا تخرج نقودا [[1]].');
    ok('BW2 with a card: unchanged (the cited sentence and its card, no withholding)', !(cited.out.telemetry || {}).unsourcedWithheld && Number((cited.out.telemetry || {}).cardsSent) > 0 && screenOf(cited.events).includes('زكاة الفطر'), ascii(screenOf(cited.events)) + ' ' + JSON.stringify(cited.out.telemetry && { cards: cited.out.telemetry.cardsSent }));
    const bare = await turn(Q, '', 'زكاة الفطر تخرج طعاما ولا تجزئ نقودا.');
    const bt = bare.out.telemetry || {};
    console.log('        BW2 no-card screen: ' + ascii(screenOf(bare.events)) + ' ' + JSON.stringify({ cards: bt.cardsSent, direct: bt.directFatwa, withheld: bt.unsourcedWithheld, released: bt.unitsReleased, held: bt.unitsHeld }));
    ok('BW2 with no card: the screen is the approved sentence (or the not-covered close) and the offer, nothing unsourced stays', !/تجزئ نقودا/u.test(screenOf(bare.events)) && bare.events.some((e) => e.type === 'ezik_live_offer'), ascii(screenOf(bare.events)) + ' ' + JSON.stringify({ cards: bt.cardsSent, withheld: bt.unsourcedWithheld }));
  }

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
