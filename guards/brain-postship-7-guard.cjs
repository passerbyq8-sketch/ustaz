// guards/brain-postship-7-guard.cjs -- POSTSHIP ITEM 7 -- 2026-10-24
//
// THE MODEL'S REFUSAL: THE APPROVED «لم أجد» SENTENCE AND THE SEARCH OFFER. Measured (sessions/side-brain-postship-2026-10-24/
// EZIK-EXT-ANSWER-LOG-WEEK-2026-10-24.txt, STOP REASONS line 21 and rows 139-163): 24 answers ended stop_reason refusal in a week,
// all on the free brain, all marked truncated, 9 of them showing the reader a 70-character text. Located (fix/item-7.md): that text
// is lib/output-reviewer.js LAST_RESORT «لم يصلني نصٌّ ولا فهمٌ يمكن الاعتماد عليه في هذه الدورة.» plus the truncation mark
// "\n<incomplete/>" -- what an empty refused round leaves; a refusal after some prose left that prose cut, with the mark.
// The order (item 7): whenever the model ends in refusal, the reader gets the path's approved «لم أجد» sentence and the search
// offer (ezik_live_offer), nothing of the cut text stays, and the answer log carries refusal_fallback. Three places: before the first
// sentence, in the middle of the answer, and after text already on the screen (streamed; the client's ezik_replace).
// The handler is the real api/ask.js; the model is a fake (the harness of guards/impermissible-early-guard.cjs section E).
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
const FAKE = { text: '', stop: 'end_turn' };
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
        if (system.startsWith('You are the routing step')) return jsonResponse(u, { content: [{ type: 'text', text: 'RELIGIOUS' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
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
    return { text, screen, events, notes: written, outbound, crashed };
  }
  const Q = 'ما حكم صلاة الجماعة؟';
  const CASES = [
    ['refusal before the first sentence', '', 'refusal', {}],
    ['refusal in the middle of the answer', 'صلاة الجماعة في المسجد واجبة على الرجال القادرين، ودليل ذلك', 'refusal', {}],
    ['refusal after text already on the screen (streamed)', 'صلاة الجماعة واجبة على الرجال. وقد دلت على ذلك أحاديث كثيرة. ومنها', 'refusal', { STREAM_V1: 'on' }],
  ];
  try {
    for (const [label, text, stop, env] of CASES) {
      FAKE.text = text; FAKE.stop = stop;
      const r = await drive(Q, env);
      console.log('-- ' + label);
      const flags = r.notes.flatMap((n) => (Array.isArray(n.flags) ? n.flags : []));
      ok(label + ': the screen holds the approved sentence and nothing else', !r.crashed && r.screen.trim() === NOT_FOUND, r.crashed ? r.crashed.message : ascii(r.screen));
      ok(label + ': the search offer goes with it', r.events.some((e) => e.type === 'ezik_live_offer'));
      ok(label + ': nothing of the cut text and no incomplete mark', !/<incomplete/u.test(r.screen) && (!text || !r.screen.includes(text.slice(0, 12))));
      ok(label + ': not the last-resort line', !r.screen.includes('لم يصلني نصٌّ'));
      ok(label + ': logged refusal_fallback', flags.includes('refusal_fallback'), JSON.stringify(flags));
    }
    console.log('-- controls');
    FAKE.text = 'شكرا لك يا صديقي على وقوفك معي في هذا اليوم.'; FAKE.stop = 'end_turn';
    const c = await drive('اكتب لي رسالة شكر لصديقي');
    ok('a general answer ending end_turn is delivered as written', c.screen.includes('شكرا لك يا صديقي') && !c.screen.includes(NOT_FOUND), ascii(c.screen));
    ok('...and carries no refusal_fallback', !c.notes.flatMap((n) => n.flags || []).includes('refusal_fallback'));
    FAKE.text = 'شكرا لك يا صديقي على'; FAKE.stop = 'refusal';
    const d = await drive('اكتب لي رسالة شكر لصديقي');
    ok('a general answer ending in refusal also gets the sentence and the offer', d.screen.trim() === NOT_FOUND && d.events.some((e) => e.type === 'ezik_live_offer'), ascii(d.screen));
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  console.log('-- before writing: the stored fatwa and its card went out, then the writer refused (after the cards)');
  {
    // the harness of guards/brain-line-r2-5-guard.cjs (the W3 b fixture of guards/speed-pipes-guard.cjs), copied; the writer's stop varies
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
    const turn = async (question, markTitle, writer, stop) => {
      const t = target();
      const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const out = await BW2.runBw2Turn({
        question, messages: [{ role: 'user', content: question }], wire: BW2.createBw2Wire(facade), band: 'adult',
        cards: { buildSourceTag: ASKM.buildSourceTag, buildBookTag: ASKM.buildBookTag, encyclopediaCards: false, max: 3 },
        deps: {
          runTool: (name, input, ctx) => (name === 'search_fatawa' ? TOOLS.runTool(name, input, { ...ctx, fetchImpl: replay }) : Promise.resolve({ text: '', added: [], calls: 0 })),
          searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, warmEncyclopedia: () => true,
          ask: async ({ user }) => { const d = {}; for (const m of user.matchAll(/^\[(\d+)\] fatwa: (.*)$/gmu)) d[m[1]] = m[2].trim() === markTitle ? 2 : 1; return JSON.stringify({ d }); },
          callWriter: async ({ onText }) => { onText(writer); return { stop_reason: stop, usage: {} }; },
        },
      });
      return { out, events: eventsOf(t) };
    };
    const Q = 'هل يجوز دفع زكاة الفطر نقودا بدل الطعام؟';
    const TITLE = 'حكم إخراج زكاة الفطر نقوداً';
    const writer = 'يرى الشيخ أن زكاة الفطر لا تخرج نقودا [[1]]. وإنما تخرج طعاما كما';
    const r = await turn(Q, TITLE, writer, 'refusal');
    ok('BW2: something had gone out before the refusal (the block and the card)', r.events.some((e) => e.type === 'content_block_delta'));
    ok('BW2: the screen then holds the approved sentence and nothing else', screenOf(r.events).trim() === NOT_FOUND, ascii(screenOf(r.events)));
    ok('BW2: the search offer goes with it', r.events.some((e) => e.type === 'ezik_live_offer'));
    ok('BW2: the record says refusal_fallback', r.out && r.out.telemetry && r.out.telemetry.refusalFallback === true);
    const c = await turn(Q, TITLE, writer.replace(' كما', '.'), 'end_turn');
    ok('BW2 control: an end_turn writer is not replaced', !c.events.some((e) => e.type === 'ezik_replace') && !(c.out && c.out.telemetry && c.out.telemetry.refusalFallback));
  }
  const app = require('fs').readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  ok('the client replaces the text it holds on ezik_replace', /evt\.type === 'ezik_replace'\)\s*\{[\s\S]{0,400}?full = typeof evt\.text === 'string' \? evt\.text : ''/u.test(app));
  const W = await esm('lib/finalized-sse-writer.js');
  ok('the finalized writer passes ezik_replace through', W.PASS_THROUGH_EVENT_TYPES.includes('ezik_replace'));

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
