// guards/speed-integration-guard.cjs -- SPEED ITEM 17: THE TWO HALVES SPEAK TO EACH OTHER.
//
// speedbw2 proves the server half against a fake socket; speedclient proves the client half against
// hand-written frames. Neither ever saw the other. This guard joins them with no network and no model:
//
//   the REAL client (the speed-client harness: the shipped Babel block, local React UMDs, linkedom, the
//   mounted application, real clicks) runs in a forked child. Every POST it makes to /api/ask crosses
//   IPC to this process, where the REAL api/ask.js handler answers it with one fake globalThis.fetch (a
//   fake fatwa service and a fake model, as speedbw2 T9 does). The handler's socket writes go back
//   unchanged, and the child feeds them to the client's SSE reader ONE WRITE AT A TIME, painting and
//   reading the DOM after each. So the body the server sees is the body the client built, and the bytes
//   the client parses are the bytes the server wrote.
//
//   I1 a sourced fiqh answer: the reading-bar labels appear in the order the server sent the status
//      frames, the first answer text removes the bar, and no status frame arrives after it
//   I2 the same answer: every card appears in place while streaming, and after completion the text and
//      letters on screen are the accumulated deltas, cards in the same positions (DOM unchanged)
//   I3 an empty table (the judge keeps no row), with BW2_CONTINUE=off: the not-covered sentence and one
//      live-offer button; pressing it sends the same question with liveSearch: true, and the handler routes
//      that request to the free-brain path with its first round forced to search_sources. By default (I3f,
//      SPEED PIPES fix 3) the same empty table goes there by itself: no sentence, no offer, no button
//   I4 a question outside BW2's scope (general): today's wire and today's rendering. The wire equals the
//      one BEFORE_WRITING_V2=off produces AND the one production's tree (af3e995) produced for the same
//      request body; the completed DOM equals production's client on those bytes. Both baselines were
//      recorded from production's tree into guards/fixtures-speed-integration-general.json.
//
// The empty table of I3 is "the judge keeps none", not "no candidates": the stored encyclopedia is a
// local fuzzy index and returns candidates for any ruling question, so a zero-candidate table cannot be
// made deterministically offline. BW2 treats both the same way (speedbw2 T6a/T6b).
//
// Usage: node guards/speed-integration-guard.cjs [index.html] [--root DIR] [--case I1] [--mutants]
//        node guards/speed-integration-guard.cjs --record-baseline DIR   (DIR = a checkout of production)
// Output is ASCII; no question text, nor anything derived from it, is printed.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const HERE_REPO = path.resolve(__dirname, '..');
const PROD_HEAD = 'af3e995f866a30ebea4b194ad2dece05584f87e9';
const FIXTURE = path.join(__dirname, 'fixtures-speed-integration-general.json');
const ascii = (s) => String(s).replace(/[^\x20-\x7e\n]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const say = (s) => console.log(ascii(s));
const sha = (s) => require('crypto').createHash('sha256').update(String(s), 'utf8').digest('hex');

// -- fixtures (Arabic written as escapes: this file stays ASCII) -------------------------------
const Q_MASAH = '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628\u061f';
const Q_GENERAL = '\u0643\u064a\u0641 \u0623\u062a\u0639\u0644\u0645\u061f';
const RULING = '\u064a\u062c\u0648\u0632 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628 \u0625\u0630\u0627 \u0644\u0628\u0633\u0647\u0627 \u0639\u0644\u0649 \u0637\u0647\u0627\u0631\u0629';
const TERM = '\u0648\u0645\u062f\u062a\u0647 \u064a\u0648\u0645 \u0648\u0644\u064a\u0644\u0629 \u0644\u0644\u0645\u0642\u064a\u0645 \u0648\u062b\u0644\u0627\u062b\u0629 \u0623\u064a\u0627\u0645 \u0628\u0644\u064a\u0627\u0644\u064a\u0647\u0627 \u0644\u0644\u0645\u0633\u0627\u0641\u0631';
const GENERAL_REPLY = '\u0627\u0628\u062f\u0623 \u0628\u0627\u0644\u0642\u0644\u064a\u0644 \u0627\u0644\u062f\u0627\u0626\u0645.';
const URL_1 = 'https://binbaz.org.sa/fatwas/1234';
const URL_2 = 'https://binothaimeen.net/content/1235';
const REC_1 = {
  uid: 'binbaz:1234', id: 1234, scholar: { id: 'binbaz' }, source: { url: URL_1 },
  title: '\u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628',
  content: { type: 'question_answer', question: Q_MASAH, answer: RULING + '\u060c ' + TERM + '. ' + RULING + '\u060c ' + TERM + '.' },
};
const REC_2 = {
  uid: 'binothaimeen:1235', id: 1235, scholar: { id: 'binothaimeen' }, source: { url: URL_2 },
  title: '\u0645\u062f\u0629 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628',
  content: { type: 'question_answer', question: Q_MASAH, answer: TERM + '. ' + TERM + '. ' + RULING + '.' },
};
// The writer's two units: [[1]] is REC_1 and [[2]] is REC_2 (fatwa rows lead the pinned table).
const WRITER_SOURCED = [RULING + ' [[1]].', '\n\n' + TERM + ' [[2]].'];
// The seven reading labels, and the found-count suffix, exactly as the client's own guard pins them.
const LABELS = {
  retrieve: '\u064a\u0628\u062d\u062b \u0641\u064a \u0645\u0635\u0627\u062f\u0631 \u0639\u0632\u0643\u2026',
  fatwa: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0627\u0644\u0641\u062a\u0627\u0648\u0649\u2026',
  library: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0643\u062a\u0628 \u0627\u0644\u0634\u0627\u0645\u0644\u0629\u2026',
  encyclopedia: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629\u2026',
  lessons: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0627\u0644\u062f\u0631\u0648\u0633\u2026',
  judge: '\u064a\u062e\u062a\u0627\u0631 \u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u062a\u064a \u062a\u062c\u064a\u0628 \u0639\u0646 \u0627\u0644\u0645\u0633\u0623\u0644\u0629\u2026',
  write: '\u064a\u0643\u062a\u0628 \u0627\u0644\u062c\u0648\u0627\u0628\u2026',
};
const FOUND = ' \u0648\u062c\u062f ';
const HIT_STAGES = ['fatwa', 'library', 'encyclopedia', 'lessons'];
const arabicDigits = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
const labelFor = (f) => LABELS[f.stage] + (HIT_STAGES.includes(f.stage) && f.hits > 0 ? FOUND + arabicDigits(f.hits) : '');
const OFFER_LABEL = '\u0627\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0622\u0646';

const framesOf = (writes) => writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
  .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
const frameOfWrite = (w) => { const f = framesOf([w]); return f.length === 1 ? f[0] : null; };
const deltaText = (f) => (f && f.type === 'content_block_delta' && f.delta && typeof f.delta.text === 'string' ? f.delta.text : null);

// =====================================================================================================
// THE SERVER SIDE (parent process): the real handler, one fake fetch.
// =====================================================================================================
async function makeServer(root) {
  const esm = (rel) => import(pathToFileURL(path.join(root, rel)).href);
  const ASK = await esm('api/ask.js');
  const FC = await esm('lib/fatwa-contract.js');
  const LEDGER_REDIS = await esm('lib/ledger/redis.js');
  const DAYCAP = await esm('lib/daycap.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const LEGACY = await esm('lib/legacy-policy-flag.js');
  let notCovered = null;
  try { notCovered = (await esm('lib/before-writing-v2.js')).BW2_NOT_COVERED; } catch { notCovered = null; }
  const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN',
    'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG',
    'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS',
    'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE'];
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const realFetch = globalThis.fetch;
  const json = (url, o, status = 200) => ({
    ok: status >= 200 && status < 300, status, url: String(url),
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => o, text: async () => JSON.stringify(o),
  });
  const sse = (pieces) => {
    const parts = ['data: ' + JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 9 } } }) + '\n\n',
      'data: ' + JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + '\n\n'];
    for (const text of pieces) parts.push('data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) + '\n\n');
    parts.push('data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } }) + '\n\n');
    parts.push('data: {"type":"message_stop"}\n\n');
    let i = 0;
    return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
      body: { getReader: () => ({ read: async () => (i < parts.length ? { done: false, value: new TextEncoder().encode(parts[i++]) } : { done: true, value: undefined }) }), cancel: async () => {} } };
  };
  let ipSeq = 0;
  // scenario: { records, judgeKeep, writer, env }
  async function drive(body, headers, scenario) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
    process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
    process.env.LEDGER_RAG = 'off';
    process.env.FREE_BRAIN_V1 = 'on';
    Object.assign(process.env, scenario.env || {});
    LEDGER_REDIS.__setRedisForTest(null);
    FLAG.__resetFlagCacheForTest();
    LEGACY.__resetLegacyFlagCacheForTest();
    DAYCAP.__setRedisForTest({
      async mget(...keys) { return keys.map(() => null); },
      async sismember() { return 0; },
      pipeline() { const ops = []; return { incr() { ops.push(() => 1); }, expire() { ops.push(() => 1); }, async exec() { return ops.map((f) => f()); } }; },
    });
    const model = [];
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith(FC.FATWA_BASE + '/api/v1/')) {
        const p = new URL(u).pathname;
        if (p === '/api/v1/health') return json(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, counts: { scholars: FC.FATWA_SCHOLARS.length } });
        if (p === '/api/v1/scholars') return json(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, scholars: FC.FATWA_SCHOLARS.map((e) => ({ id: e.id, snapshot: { records: e.count } })) });
        const records = scenario.records || [];
        return json(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, results: records, pagination: { total: records.length } });
      }
      if (u.includes('api.anthropic.com')) {
        const b = JSON.parse(init.body);
        model.push(b);
        if (b.stream) return sse(scenario.writer || [GENERAL_REPLY]);
        if (!b.tools) {
          const keep = scenario.judgeKeep === false ? 0 : 1;
          return json(u, { content: [{ type: 'text', text: JSON.stringify({ d: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), keep])) }) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        return json(u, { content: [{ type: 'text', text: GENERAL_REPLY }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      if (u.includes('api.search.brave.com')) return json(u, { web: { results: [] } });
      return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
    };
    const res = {
      writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; },
      flushHeaders() { this.headersSent = true; },
      write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
      end() { this.ended += 1; this.headersSent = true; return this; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
      once() { return this; }, on() { return this; }, removeListener() { return this; },
    };
    ipSeq += 1;
    const req = { method: 'POST', headers: { ...headers, 'x-real-ip': '10.19.0.' + ipSeq }, body: JSON.parse(JSON.stringify(body)) };
    const logs = [];
    const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = (...a) => { logs.push(a); };
    console.warn = () => {}; console.error = () => {}; console.info = () => {};
    let crashed = null;
    try { await ASK.default(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); globalThis.fetch = realFetch; }
    const logOf = (tag) => (logs.find((a) => a[0] === tag) || [])[1] || null;
    return { writes: res.writes, status: res.statusCode, jsonBody: res.jsonBody || null, ended: res.ended, model, logOf, crashed: crashed && String(crashed.stack || crashed) };
  }
  const restore = () => {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  };
  return { drive, restore, notCovered };
}

// =====================================================================================================
// THE CLIENT SIDE (forked child): the real application, fed the handler's writes one at a time.
// =====================================================================================================
async function clientMain(html, only) {
  const clientRoot = path.resolve(path.dirname(html));
  const harnessPath = fs.existsSync(path.join(clientRoot, 'guards', 'speed-client-guard.cjs'))
    ? path.join(clientRoot, 'guards', 'speed-client-guard.cjs') : path.join(HERE_REPO, 'guards', 'speed-client-guard.cjs');
  const { boot } = require(harnessPath);
  let seq = 0;
  const waiting = new Map();
  process.on('message', (m) => { if (m && m.type === 'reply' && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
  const serve = (scenario, request) => new Promise((resolve) => {
    seq += 1; waiting.set(seq, resolve);
    process.send({ type: 'serve', id: seq, scenario, body: request.body, headers: request.headers });
  });
  const report = (rec) => process.send({ type: 'result', ...rec });
  // Feed one write per step; snapshot after each.
  async function replay(c, stream, writes) {
    const steps = [];
    for (const w of writes) {
      stream.bytes(Buffer.from(w, 'utf8'));
      await c.paint();
      const ans = c.answer();
      steps.push({ frame: frameOfWrite(w), reading: c.reading() ? c.reading().textContent : null,
        html: ans ? ans.innerHTML : '', text: ans ? ans.textContent : '', offers: c.offers().length });
    }
    stream.end();
    await c.wait(() => c.all('.ezc-acts').length === c.requests.length, 'completed turn');
    await c.paint();
    return steps;
  }
  const stored = (c) => Object.entries(c.data).filter(([k]) => k.startsWith('ezik_chat_v1_')).map(([, v]) => JSON.parse(v)).flat();
  const cases = {
    async I1I2(c) {
      const st = await c.ask(Q_MASAH);
      const r = await serve('sourced', c.requests.at(-1));
      const steps = await replay(c, st, r.writes);
      const ans = c.answer();
      const last = steps.filter((s) => s.frame && deltaText(s.frame) !== null).at(-1);
      const assistant = stored(c).filter((m) => m && m.role === 'assistant').at(-1);
      return { steps, finalHtml: ans.innerHTML, finalText: ans.textContent, lastDeltaHtml: last ? last.html : null,
        storedContent: assistant ? assistant.content : null, server: r.meta };
    },
    async I3(c) {
      const st = await c.ask(Q_MASAH);
      const r = await serve('empty', c.requests.at(-1));
      const steps = await replay(c, st, r.writes);
      const offers = c.offers();
      const out = { steps, offerCount: offers.length, offerLabel: offers[0] ? offers[0].textContent : null,
        offerDisabled: offers[0] ? !!offers[0].disabled : null, finalText: c.answer().textContent, server: r.meta };
      if (offers.length === 1) {
        const before = c.requests.length;
        offers[0].dispatchEvent(new c.window.Event('click', { bubbles: true }));
        await c.wait(() => c.requests.length === before + 1, 'live search request');
        const first = c.requests[before - 1], next = c.requests[before];
        out.firstBody = first.body; out.nextBody = next.body;
        const r2 = await serve('live', next);
        out.live = r2.meta;
        await replay(c, c.streams.at(-1), r2.writes);
      }
      return out;
    },
    async I4(c) {
      const st = await c.ask(Q_GENERAL);
      const r = await serve('general', c.requests.at(-1));
      await replay(c, st, r.writes);
      return { finalHtml: c.answer().innerHTML, body: c.requests.at(-1).body, server: r.meta };
    },
  };
  const want = only === 'I1' || only === 'I2' ? 'I1I2' : only;
  for (const [id, run] of Object.entries(cases)) {
    if (want && want !== id) continue;
    for (const tashkeel of (id === 'I4' ? [true, false] : [true])) {
      let c = null;
      try {
        c = await boot(html, { tashkeel });
        report({ id, tashkeel, ok: true, data: await run(c) });
      } catch (e) {
        report({ id, tashkeel, ok: false, error: String(e && e.stack || e) });
      } finally { if (c) try { c.close(); } catch {} }
    }
  }
  process.send({ type: 'done' });
}

// Fork the client on `html`; answer its POSTs with `server`, per scenario.
function runClient(html, only, server, scenarios) {
  return new Promise((resolve, reject) => {
    const child = cp.fork(__filename, ['--client-run', html].concat(only ? ['--case', only] : []), { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const results = [];
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('client child timed out: ' + ascii(out.slice(-2000)))); }, 240000);
    child.on('message', async (m) => {
      if (m.type === 'serve') {
        const sc = scenarios[m.scenario];
        const r = await server.drive(m.body, m.headers, sc.server);
        const meta = sc.meta ? sc.meta(r) : {};
        sc.seen = (sc.seen || []).concat([{ body: m.body, headers: m.headers, result: r }]);
        child.send({ type: 'reply', id: m.id, writes: r.writes, meta });
      } else if (m.type === 'result') results.push(m);
    });
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, results, out }); });
  });
}

const SCENARIOS = () => ({
  sourced: { server: { records: [REC_1, REC_2], writer: WRITER_SOURCED } },
  // The offer's chain (I3a-I3e) is what a reader gets with BW2_CONTINUE=off; by default (I3f) the same empty
  // table goes on to today's path by itself and no offer is made (SPEED PIPES fix 3).
  empty: { server: { records: [], judgeKeep: false, writer: WRITER_SOURCED, env: { BW2_CONTINUE: 'off' } } },
  continued: { server: { records: [], judgeKeep: false, writer: WRITER_SOURCED } },
  live: { server: { records: [], writer: WRITER_SOURCED } },
  general: { server: { records: [] } },
});

// =====================================================================================================
// THE CHECKS (parent)
// =====================================================================================================
async function main(args) {
  const rootIdx = args.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : HERE_REPO;
  const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
  const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--root', '--case', '--record-baseline'].includes(args[i - 1])));
  const html = positional[0] ? path.resolve(root, positional[0]) : path.join(root, 'index.html');
  let fails = 0, passes = 0;
  const ok = (name, cond, detail) => {
    if (cond) { passes += 1; say('  PASS ' + name); } else { fails += 1; say('  FAIL ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : '')); }
  };
  const server = await makeServer(root);
  try {
    const scenarios = SCENARIOS();
    const run = await runClient(html, only, server, scenarios);
    const byId = (id, t = true) => run.results.find((r) => r.id === id && r.tashkeel === t);
    for (const r of run.results) if (!r.ok) ok('client case ' + r.id + ' ran (tashkeel ' + r.tashkeel + ')', false, ascii(r.error));
    if (run.code !== 0) ok('client child exited cleanly', false, ascii(run.out.slice(-1500)));

    // ---------------------------------------------------------------- I1 + I2
    if (!only || only === 'I1' || only === 'I2') {
      const r = byId('I1I2');
      const seen = (scenarios.sourced.seen || [])[0];
      const s = seen && seen.result;
      const frames = s ? framesOf(s.writes) : [];
      const firstText = frames.findIndex((f) => (deltaText(f) || '').length > 0);
      const statusFrames = frames.filter((f) => f.type === 'ezik_status');
      const fb = s && s.logOf('[free-brain]');
      const pre = s && !s.crashed && fb && fb.bw2 === true && statusFrames.length >= 4 && firstText > 0;
      if (!only || only === 'I1') {
        ok('I1 precondition: the handler took BW2 for the client\'s own request and sent status frames before text', pre,
          ascii(JSON.stringify({ fb, crashed: s && s.crashed, types: frames.map((f) => f.type + (f.stage ? ':' + f.stage : '')) })));
        const steps = r && r.ok ? r.data.steps : [];
        const shown = steps.filter((st) => st.frame && st.frame.type === 'ezik_status').map((st) => st.reading);
        const expected = statusFrames.map(labelFor);
        ok('I1a the reading bar shows each status label, in the order the server sent the status frames',
          shown.length === expected.length && shown.length > 0 && shown.every((t, i) => t === expected[i]),
          ascii(JSON.stringify({ shown, expected })));
        const firstTextStep = steps.findIndex((st) => st.frame && (deltaText(st.frame) || '').length > 0);
        ok('I1b the first answer text removes the bar (and it stays removed to the end)',
          firstTextStep > 0 && steps[firstTextStep - 1].reading !== null && steps.slice(firstTextStep).every((st) => st.reading === null),
          ascii(JSON.stringify(steps.map((st) => [st.frame && st.frame.type, st.reading !== null]))));
        ok('I1c no status frame arrives after the first answer text',
          firstText > 0 && !frames.slice(firstText).some((f) => f.type === 'ezik_status'),
          ascii(JSON.stringify(frames.map((f) => f.type))));
      }
      if (!only || only === 'I2') {
        const d = r && r.ok ? r.data : null;
        const deltas = frames.map(deltaText).filter((t) => t !== null);
        const joined = deltas.join('');
        const cardSteps = d ? d.steps.filter((st) => /<source /.test(deltaText(st.frame) || '')) : [];
        ok('I2 precondition: the server sent two whole page cards, each in its own delta, between the prose units',
          pre && deltas.length === 4 && /^\n<source [^>]*url="https:\/\/binbaz\.org\.sa\/fatwas\/1234"[^>]*>[^<]*<\/source>$/.test(deltas[1])
          && /^\n<source [^>]*url="https:\/\/binothaimeen\.net\/content\/1235"[^>]*>[^<]*<\/source>$/.test(deltas[3])
          && deltas[0].includes(RULING) && deltas[2].includes(TERM), ascii(JSON.stringify(deltas)));
        const inPlace = cardSteps.length === 2 && cardSteps.every((st, i) => {
          const url = i === 0 ? URL_1 : URL_2, prose = i === 0 ? RULING : TERM;
          const a = st.html.indexOf(prose), b = st.html.indexOf('href="' + url + '"');
          const later = i === 0 ? st.html.indexOf(TERM) : -1;
          return a >= 0 && b > a && later === -1;
        });
        ok('I2a each card appears during streaming, the moment its delta arrives, right after the unit that cited it',
          inPlace, ascii(JSON.stringify(cardSteps.map((st) => st.text))));
        const afterSecondProse = d ? d.steps.find((st) => (deltaText(st.frame) || '').includes(TERM)) : null;
        ok('I2b the first card stays between the two prose units while the second streams in',
          !!afterSecondProse && afterSecondProse.html.indexOf(RULING) < afterSecondProse.html.indexOf('href="' + URL_1 + '"')
          && afterSecondProse.html.indexOf('href="' + URL_1 + '"') < afterSecondProse.html.indexOf(TERM));
        ok('I2c after completion the answer DOM is the streamed DOM: same letters, same cards, same positions',
          !!d && d.lastDeltaHtml !== null && d.finalHtml === d.lastDeltaHtml,
          d && ascii(JSON.stringify({ streamedSha: sha(d.lastDeltaHtml), finalSha: sha(d.finalHtml) })));
        ok('I2d the stored answer is exactly the accumulated deltas, byte for byte',
          !!d && d.storedContent === joined, ascii(JSON.stringify({ stored: d && d.storedContent && sha(d.storedContent), deltas: sha(joined) })));
        const prose = deltas.filter((t) => !t.includes('<source'));
        ok('I2e every letter of every prose delta is on screen, in order',
          !!d && prose.length === 2 && prose.every((t) => d.finalText.includes(t.trim()))
          && d.finalText.indexOf(prose[0].trim()) < d.finalText.indexOf(prose[1].trim()));
      }
    }

    // ---------------------------------------------------------------- I3
    if (!only || only === 'I3') {
      const r = byId('I3');
      const d = r && r.ok ? r.data : null;
      const s = ((scenarios.empty.seen || [])[0] || {}).result;
      const frames = s ? framesOf(s.writes) : [];
      const deltas = frames.map(deltaText).filter((t) => t !== null);
      const NC = server.notCovered;
      ok('I3a the server answered an empty table with exactly the not-covered sentence, then ezik_live_offer, and no writer call',
        !!s && !s.crashed && !!NC && deltas.join('').trim() === NC && frames.findIndex((f) => f.type === 'ezik_live_offer') > frames.findIndex((f) => deltaText(f) === deltas.at(-1))
        && !s.model.some((b) => b.stream), ascii(JSON.stringify(frames.map((f) => f.type))));
      ok('I3b the client shows the not-covered sentence and exactly one live-offer button, enabled once the turn ends',
        !!d && d.finalText.includes(NC) && d.offerCount === 1 && d.offerLabel === OFFER_LABEL && d.offerDisabled === false,
        d && ascii(JSON.stringify({ offerCount: d.offerCount, offerDisabled: d.offerDisabled })));
      const nb = d && d.nextBody, fb0 = d && d.firstBody;
      ok('I3c pressing it sends the same question as a new turn with liveSearch: true (and the first request carried none)',
        !!nb && nb.liveSearch === true && !Object.prototype.hasOwnProperty.call(fb0, 'liveSearch')
        && nb.messages.at(-1).role === 'user' && nb.messages.at(-1).content === fb0.messages.at(-1).content);
      const live = ((scenarios.live.seen || [])[0] || {}).result;
      const lf = live && live.logOf('[free-brain]');
      ok('I3d the handler routes that exact body to the free-brain path, not BW2',
        !!live && !live.crashed && lf && lf.liveSearch === true && lf.bw2 === false && !live.logOf('[bw2]')
        && !framesOf(live.writes).some((f) => f.type === 'ezik_status'), ascii(JSON.stringify(lf)));
      const m0 = live && live.model[0];
      ok('I3e ...with its first provider round forced to search_sources',
        !!m0 && m0.tool_choice && m0.tool_choice.type === 'tool' && m0.tool_choice.name === 'search_sources',
        ascii(JSON.stringify(m0 && m0.tool_choice)));
      // I3f: the default. The same first request, the same empty table, the switch unset.
      const firstSeen = (scenarios.empty.seen || [])[0];
      const cont = firstSeen ? await server.drive(firstSeen.body, firstSeen.headers, scenarios.continued.server) : null;
      const cf = cont ? framesOf(cont.writes) : [];
      const ct = cont ? cf.map(deltaText).filter((t) => t !== null).join('') : '';
      const cb = cont && cont.logOf('[bw2]');
      const st = cf.filter((f) => f.type === 'ezik_status').map((f) => f.stage);
      const c0 = cont && cont.model.find((b) => b.tools);
      ok('I3f by default the empty table goes on to the old path by itself: no not-covered sentence, no offer, its first round forced to search_sources, the reading line back on "searching"',
        !!cont && !cont.crashed && cb && cb.continued === 'judge_none' && !cf.some((f) => f.type === 'ezik_live_offer')
        && !ct.includes(NC) && ct.length > 0 && st.at(-1) === 'retrieve' && !!c0 && c0.tool_choice && c0.tool_choice.name === 'search_sources',
        ascii(JSON.stringify({ cont: cb && cb.continued, st, frames: cf.map((f) => f.type) })));
    }

    // ---------------------------------------------------------------- I4
    if (!only || only === 'I4') {
      const base = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
      const seen = scenarios.general.seen || [];
      const s = (seen[0] || {}).result;
      const fb = s && s.logOf('[free-brain]');
      const frames = s ? framesOf(s.writes) : [];
      ok('I4a a general question stays off BW2: no [bw2] record, no ezik_* frame',
        !!s && !s.crashed && fb && fb.bw2 === false && !s.logOf('[bw2]') && !frames.some((f) => /^ezik_/.test(f.type)),
        ascii(JSON.stringify(fb)));
      const off = s ? await server.drive(seen[0].body, seen[0].headers, { ...SCENARIOS().general.server, env: { BEFORE_WRITING_V2: 'off' } }) : null;
      ok('I4b its wire is byte-identical to the wire with BEFORE_WRITING_V2=off',
        !!off && off.writes.join('') === s.writes.join(''), ascii(JSON.stringify({ on: s && sha(s.writes.join('')), off: off && sha(off.writes.join('')) })));
      ok('I4c the client\'s request body equals production\'s for the same question',
        !!seen[0] && JSON.stringify(seen[0].body) === JSON.stringify(base.body), ascii(JSON.stringify({ now: seen[0] && sha(JSON.stringify(seen[0].body)), prod: sha(JSON.stringify(base.body)) })));
      ok('I4d its wire is byte-identical to production\'s wire for that body (' + PROD_HEAD.slice(0, 7) + ')',
        !!s && base.head === PROD_HEAD && sha(s.writes.join('')) === base.wireSha256 && s.writes.length === base.writes,
        ascii(JSON.stringify({ now: s && sha(s.writes.join('')), prod: base.wireSha256 })));
      for (const t of [true, false]) {
        const r = byId('I4', t);
        ok('I4e the completed rendering equals production\'s client on those bytes (tashkeel ' + (t ? 'on' : 'off') + ')',
          !!r && r.ok && sha(r.data.finalHtml) === base.views[String(t)], ascii(JSON.stringify({ now: r && r.ok && sha(r.data.finalHtml), prod: base.views[String(t)] })));
      }
    }
  } finally { server.restore(); }
  say('SUMMARY speed-integration PASS=' + passes + ' FAIL=' + fails);
  return fails ? 1 : 0;
}

// Record I4's production baseline from a checkout of production (DIR must hold PROD_HEAD's tree).
async function recordBaseline(prodRoot) {
  const server = await makeServer(prodRoot);
  try {
    const scenarios = SCENARIOS();
    const run = await runClient(path.join(prodRoot, 'index.html'), 'I4', server, scenarios);
    const s = (scenarios.general.seen || [])[0];
    const views = {};
    for (const t of [true, false]) {
      const r = run.results.find((x) => x.id === 'I4' && x.tashkeel === t);
      if (!r || !r.ok) throw new Error('baseline client failed: ' + ascii(r ? r.error : run.out.slice(-1500)));
      views[String(t)] = sha(r.data.finalHtml);
    }
    const f = frameOfWrite;
    const types = s.result.writes.map((w) => (f(w) || {}).type || 'comment');
    const out = { head: PROD_HEAD, note: 'I4 baseline: production tree, real handler + real client, general question, recorded by --record-baseline',
      body: s.body, writes: s.result.writes.length, frameTypes: types, wireSha256: sha(s.result.writes.join('')), views };
    fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 2) + '\n');
    say('baseline written: ' + FIXTURE + ' wire ' + out.wireSha256 + ' writes ' + out.writes);
  } finally { server.restore(); }
  return 0;
}

// Mutations: each breaks one invariant in a scratch copy of the tree; the guard must exit 1 on that case.
const MUTANTS = [
  { id: 'I1', file: 'lib/before-writing-v2.js', before: "type: 'ezik_status'", after: "type: 'ezik_stage'", count: 2,
    what: 'the server renames its status frame type (the client no longer understands it)' },
  { id: 'I2', file: 'lib/bw2-units.js', before: 'if (!cards || !fresh.length) return;', after: 'if (!cards || !fresh.length || true) return;',
    what: 'the server stops sending cards in place' },
  { id: 'I3', file: 'lib/free-brain/flag.js', before: null, what: 'the handler no longer reads liveSearch: true' },
  { id: 'I4', file: 'lib/free-brain/flag.js', before: null, what: 'BW2 takes GENERAL questions too' },
];
function mutateSource(m, src) {
  if (m.before) {
    if (src.split(m.before).length - 1 !== (m.count || 1)) throw new Error(m.id + ' anchor count wrong in ' + m.file);
    return src.split(m.before).join(m.after);
  }
  if (m.id === 'I3') {
    const re = /(export function readLiveSearch\([^)]*\)\s*\{)/;
    if (!re.test(src)) throw new Error('I3 anchor');
    return src.replace(re, '$1 return false;');
  }
  if (m.id === 'I4') {
    const re = /(BEFORE_WRITING_V2_RUNTIMES\s*=\s*(?:Object\.freeze\()?\[)/;
    if (!re.test(src)) throw new Error('I4 anchor');
    return src.replace(re, "$1'GENERAL', ");
  }
  throw new Error('no mutation for ' + m.id);
}
function mutants() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-speed-integration-mutants-'));
  say('Mutation scratch: ' + scratch);
  const tree = path.join(scratch, 'tree');
  const skip = new Set(['.git', 'node_modules', '_superseded']);
  fs.cpSync(HERE_REPO, tree, { recursive: true, filter: (src) => !skip.has(path.basename(src)) || path.dirname(src) !== HERE_REPO });
  const nm = path.join(tree, 'node_modules');
  fs.symlinkSync(path.join(HERE_REPO, 'node_modules'), nm, 'junction');
  let failed = 0;
  try {
    for (const m of MUTANTS) {
      const file = path.join(tree, m.file);
      const original = fs.readFileSync(file, 'utf8');
      const mutated = mutateSource(m, original);
      if (mutated === original) throw new Error(m.id + ' mutation did not apply');
      fs.writeFileSync(file, mutated);
      try {
        if (fs.readFileSync(file, 'utf8') === original) throw new Error(m.id + ' mutation not on disk');
        const r = cp.spawnSync(process.execPath, [path.join(tree, 'guards', 'speed-integration-guard.cjs'), '--root', tree, '--case', m.id],
          { cwd: tree, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
        fs.writeFileSync(path.join(scratch, m.id + '.txt'), ascii((r.stdout || '') + (r.stderr || '')));
        const failedCase = new RegExp('FAIL ' + m.id + '[a-z ]').test(r.stdout || '');
        if (r.status === 1 && failedCase) say('  PASS mutation ' + m.id + ': ' + m.what + ' -> exit 1, ' + ((r.stdout || '').match(new RegExp('FAIL ' + m.id + '[a-z]?', 'g')) || []).join(','));
        else { failed += 1; say('  FAIL mutation ' + m.id + ': exit ' + r.status + ' (' + m.what + ')'); }
      } finally { fs.writeFileSync(file, original); }
    }
  } finally {
    try { fs.unlinkSync(nm); } catch { try { fs.rmdirSync(nm); } catch {} }
    fs.rmSync(tree, { recursive: true, force: true });
  }
  say('mutations: ' + MUTANTS.length + ' run, ' + failed + ' survived; evidence ' + scratch);
  return failed ? 1 : 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--client-run') {
    clientMain(path.resolve(args[1]), args.includes('--case') ? args[args.indexOf('--case') + 1] : null)
      .then(() => process.exit(0), (e) => { say(String(e && e.stack || e)); process.exit(1); });
  } else if (args[0] === '--record-baseline') {
    recordBaseline(path.resolve(args[1])).then((c) => process.exit(c), (e) => { say(String(e && e.stack || e)); process.exit(1); });
  } else {
    main(args).then((code) => {
      if (!code && args.includes('--mutants')) code = mutants();
      process.exit(code);
    }, (e) => { say('FAIL guard crashed: ' + String(e && e.stack || e)); process.exit(1); });
  }
}
