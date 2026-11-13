// guards/provider-failure-guard.cjs -- ORDER A2 item 8 (EZIK-ORDER-BRAIN-A2-2026-11-11; the owner's decision of 11 November):
// A PROVIDER FAILURE IS TOLD HONESTLY.
//
// MEASURED on the preview capture of 11 November: for about forty seconds the model provider answered every call with HTTP
// 400; five turns lost every call they made and each reader was sent «لم أجد في مصادر عزك نصا يجيب عن هذه المسألة بعينها.» with
// the offer to search the web. What is proved here, on the branch's REAL handler with a provider stub (no network):
//   P  lib/provider-call.js alone: the one retry (429, 500, 529, a failed connection; never a 400, never another status,
//      never an aborted call), the provider's closed error word kept and never its message
//   H  the handler with a stub that answers 400, 429, or cannot connect: the reader gets the apology the code already
//      holds, neither the not-found sentence nor the offer; every failed call is logged as `call:status:type`; the answer
//      log carries the one closed flag; nothing religious is delivered; with the reading switch on and off
//   R  a call refused once and answered on the second try is the healthy turn
//   T  WITH A HEALTHY STUB THE TURN IS THE TURN OF BEFORE: every frame, the text, every call and every console line equal
//      what the handler of commit 06ee8909 (the commit before this cure) produced for the same questions, recorded in
//      fixtures/provider-healthy-turns.json by this file's own `--record` mode run on that commit's tree
//
// Usage: node guards/provider-failure-guard.cjs
//        node guards/provider-failure-guard.cjs --record <tree> <out.json>   (writes the fixture from another tree)
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const crypto = require('crypto');

const RECORD = process.argv[2] === '--record';
// (PROVIDER_FAILURE_GUARD_TREE: another tree's handler under this file's rows -- how the rows were shown red on the commit before the cure)
const REPO = RECORD ? path.resolve(process.argv[3]) : (process.env.PROVIDER_FAILURE_GUARD_TREE ? path.resolve(process.env.PROVIDER_FAILURE_GUARD_TREE) : path.join(__dirname, '..'));
const HERE = path.join(__dirname, '..');
const FIXTURE = path.join(HERE, 'fixtures', 'provider-healthy-turns.json');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let checks = 0;
let failures = 0;
const ascii = (value) => String(value).replace(/[^\x20-\x7e]/g, '~').slice(0, 500);
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail === undefined ? '' : ' | ' + ascii(typeof detail === 'string' ? detail : JSON.stringify(detail))));
  return false;
}
const sha = (text) => crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);

(async () => {
  const EXPECTED = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'request-plan-expected.json'), 'utf8'));
  const byId = Object.fromEntries(EXPECTED.items.map((item) => [item.id, item]));
  const ASKSRC = fs.readFileSync(path.join(REPO, 'api', 'ask.js'), 'utf8');
  let PC = null;
  try { PC = await esm('lib/provider-call.js'); } catch { PC = null; }

  // ------------------------------------------------------------------------------------------------ P
  const emptyInAsk = /const FREE_BRAIN_EMPTY = '([^']+)';/u.exec(ASKSRC);
  const LOST_TEXT = PC ? PC.PROVIDER_LOST_TEXT : (emptyInAsk ? emptyInAsk[1] : '');
  const LOST_FLAG = PC ? PC.PROVIDER_LOST_FLAG : 'provider_lost';
  if (!RECORD && !PC) ok('P0 lib/provider-call.js exists in this tree', false);
  if (!RECORD && PC) {
    console.log('\n=== P. THE CALL ITSELF (lib/provider-call.js) ===');
    const empty = emptyInAsk;
    ok('P1 the sentence for a lost turn is the apology api/ask.js already holds (FREE_BRAIN_EMPTY), letter for letter',
      !!empty && PC.PROVIDER_LOST_TEXT === empty[1], empty && [PC.PROVIDER_LOST_TEXT.length, empty[1].length]);
    ok('P2a the provider\'s error type is its closed word', PC.providerErrorType('{"type":"error","error":{"type":"invalid_request_error","message":"m"}}') === 'invalid_request_error');
    ok('P2b a type that is not a closed word is not kept (a sentence, capitals, a long string, no JSON)',
      PC.providerErrorType('{"error":{"type":"Your credit balance is too low"}}') === '' && PC.providerErrorType('{"error":{"type":"RATE"}}') === ''
      && PC.providerErrorType('{"error":{"type":"' + 'a'.repeat(60) + '"}}') === '' && PC.providerErrorType('not json') === '' && PC.providerErrorType('{"error":"x"}') === '');
    ok('P2c the provider\'s MESSAGE is never in what is kept',
      !JSON.stringify(PC.providerFailureOf(PC.providerError('plan_http_400', { status: 400, providerType: 'invalid_request_error' }))).includes('message'));
    ok('P3 an error that is not the provider\'s gives no failure record (a guard\'s own stub, a parse error)',
      PC.providerFailureOf(new Error('boom')) === null && PC.providerFailureOf(null) === null && PC.providerFailureOf(new SyntaxError('Unexpected token')) === null);
    ok('P4 the token of a failed call is call:status:type',
      PC.providerFailureToken('judge', { status: 529, type: 'overloaded_error' }) === 'judge:529:overloaded_error' && PC.providerFailureToken('writer', { status: 0, type: 'connection' }) === 'writer:0:connection');

    PC.__setProviderRetryPauseForTest(0);
    const realFetch = globalThis.fetch;
    const reply = (status, type) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null },
      text: async () => JSON.stringify({ type: 'error', error: { type, message: 'the reader wrote: SECRET-WORDS' } }), json: async () => ({ fine: true }) });
    const run = async (script, options = {}, init = {}) => {
      let n = 0;
      globalThis.fetch = async () => { const step = script[Math.min(n, script.length - 1)]; n += 1; if (step === 'throw') throw new TypeError('fetch failed'); return reply(step[0], step[1]); };
      let out = null; let thrown = null;
      try { out = await PC.providerFetch('https://provider.invalid/v1/messages', { method: 'POST', headers: {}, body: '{}', ...init }, options); } catch (e) { thrown = e; }
      globalThis.fetch = realFetch;
      return { n, out, thrown };
    };
    const r400 = await run([[400, 'invalid_request_error']]);
    ok('P5a a 400 is asked ONCE and comes back with its status and its closed error word', r400.n === 1 && r400.out.ok === false && r400.out.status === 400 && r400.out.providerType === 'invalid_request_error', r400.n);
    ok('P5b the caller can still read the body it read before', (await r400.out.text()).includes('invalid_request_error'));
    for (const [status, type] of [[429, 'rate_limit_error'], [500, 'api_error'], [529, 'overloaded_error']]) {
      const r = await run([[status, type]]);
      ok('P6 a ' + status + ' is asked twice, and still refused comes back as ' + status, r.n === 2 && r.out.status === status && r.out.providerType === type, r.n);
    }
    for (const status of [401, 403, 404, 413, 502, 503]) {
      const r = await run([[status, 'x_error']]);
      ok('P7 a ' + status + ' is asked once (only 429, 500 and 529 are tried again)', r.n === 1 && r.out.status === status, r.n);
    }
    const rNet = await run(['throw']);
    ok('P8a a call that cannot connect is asked twice, then rejects marked `connection`', rNet.n === 2 && !!rNet.thrown && same(PC.providerFailureOf(rNet.thrown), { status: 0, type: 'connection' }), rNet.n);
    const rHeal = await run([[429, 'rate_limit_error'], [200, '']]);
    ok('P8b refused once, answered on the second try: the answer', rHeal.n === 2 && rHeal.out.ok === true && rHeal.thrown === null, rHeal.n);
    const rHealNet = await run(['throw', [200, '']]);
    ok('P8c could not connect once, answered on the second try: the answer', rHealNet.n === 2 && rHealNet.out.ok === true, rHealNet.n);
    const rOff = await run([[529, 'overloaded_error']], { retry: false });
    ok('P9a where the caller forbids it (text of the turn already on the page) nothing is asked twice', rOff.n === 1 && rOff.out.status === 529, rOff.n);
    const aborted = new AbortController(); aborted.abort();
    const rAb = await run([[429, 'rate_limit_error']], {}, { signal: aborted.signal });
    ok('P9b an aborted call is not asked again', rAb.n === 1, rAb.n);
    const rAbNet = await run(['throw'], {}, { signal: aborted.signal });
    ok('P9c a call that threw because it was aborted is not asked again and is not marked a connection failure', rAbNet.n === 1 && PC.providerFailureOf(rAbNet.thrown) === null, rAbNet.n);
    ok('P10 the statuses tried again are exactly 429, 500, 529', same([...PC.PROVIDER_RETRY_STATUSES], [429, 500, 529]));
    // an error that carries a status of its own is somebody's report, not a connection that failed: passed on as it is, once
    let nOwn = 0;
    globalThis.fetch = async () => { nOwn += 1; throw Object.assign(new Error('upstream 529'), { status: 529 }); };
    let own = null;
    try { await PC.providerFetch('https://provider.invalid/v1/messages', { method: 'POST', headers: {}, body: '{}' }); } catch (e) { own = e; }
    globalThis.fetch = realFetch;
    ok('P11 a rejection that carries its own status is asked once, keeps that status and is not marked a connection failure',
      nOwn === 1 && !!own && own.status === 529 && own.providerType === undefined, [nOwn, own && own.status, own && own.providerType]);
    {
      // the page fills while the first try is in flight: the caller's function is asked when the second try is decided
      let page = '';
      let n = 0;
      globalThis.fetch = async () => { n += 1; page = 'a card'; return reply(429, 'rate_limit_error'); };
      const filled = await PC.providerFetch('https://provider.invalid/v1/messages', { method: 'POST', headers: {}, body: '{}' }, { retry: () => !page });
      const nFilled = n;
      n = 0;
      globalThis.fetch = async () => { n += 1; return reply(429, 'rate_limit_error'); };
      await PC.providerFetch('https://provider.invalid/v1/messages', { method: 'POST', headers: {}, body: '{}' }, { retry: () => true });
      globalThis.fetch = realFetch;
      ok('P9d [after the second helper] the caller may hand a function, asked when the second try is decided: a page that filled while the first try was in flight forbids the second; a page still empty allows it',
        nFilled === 1 && filled.status === 429 && n === 2, [nFilled, n]);
    }
    ok('P13 [after the second helper] a body that cannot be read: dropped mid-way it is a lost connection; arrived whole and not JSON it is the word body; an aborted read is neither, and an error that carries its own status keeps it',
      same(PC.providerFailureOf(PC.providerBodyLost(new TypeError('terminated'))), { status: 0, type: 'connection' })
      && same(PC.providerFailureOf(PC.providerBodyLost(new SyntaxError('Unexpected token <'))), { status: 0, type: 'body' })
      && PC.providerFailureOf(PC.providerBodyLost(new TypeError('terminated'), { aborted: true })) === null
      && PC.providerFailureOf(PC.providerBodyLost(new SyntaxError('Unexpected token <'), { aborted: true })) === null
      && same(PC.providerFailureOf(PC.providerBodyLost(Object.assign(new Error('x'), { status: 529 }))), { status: 529, type: '' }));
    ok('P12 what a module is handed instead of importing: the fetch, the error, the reader of the error',
      PC.PROVIDER_CALLS.fetch === PC.providerFetch && PC.PROVIDER_CALLS.error === PC.providerError && PC.PROVIDER_CALLS.failureOf === PC.providerFailureOf);
  }

  // ------------------------------------------------------------------------------------------------ the handler
  const RPMOD = await esm('lib/request-plan.js');
  const FS = await esm('lib/front-sorter.js');
  const BW = await esm('lib/before-writing-v2.js');
  const ASKMOD = await esm('api/ask.js');
  const FC = await esm('lib/fatwa-contract.js');
  const LEDGER_REDIS = await esm('lib/ledger/redis.js');
  const DAYCAP = await esm('lib/daycap.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const LEGACY = await esm('lib/legacy-policy-flag.js');
  const CONSENT = await esm('lib/ai-consent.js');
  try { const ENCYC = await esm('lib/encyclopedia.js'); for (let i = 0; i < 40 && !ENCYC.encyclopediaReady(); i += 1) { try { await ENCYC.warmEncyclopedia(); } catch { /* cold for every turn */ } } } catch { /* no module */ }
  const handler = ASKMOD.default;
  const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN', 'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1',
    'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG', 'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS', 'BW_FAST_MODEL',
    'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE', 'FRONT_SORTER_V1', 'REQUEST_PLAN_V1', 'REQUEST_PLAN_MODEL', 'MODEL_STANDARD', 'MODEL'];
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const realFetch = globalThis.fetch;
  const capCounts = new Map();
  const installDayCapStore = () => {
    capCounts.clear();
    DAYCAP.__setRedisForTest({
      async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
      async sismember() { return 0; },
      pipeline() { const ops = []; return { incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); }, expire() { ops.push(() => 1); }, async exec() { return ops.map((f) => f()); } }; },
    });
  };
  const jsonResponse = (url, o, status = 200) => ({
    ok: status >= 200 && status < 300, status, url: String(url),
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => o, text: async () => JSON.stringify(o),
  });
  const WRITER_TEXT = byId.B21.ideal.parts[0].name + '.'; // a short Arabic sentence with no citation (the fixture's own words)
  const ERR = { 400: 'invalid_request_error', 429: 'rate_limit_error', 500: 'api_error', 529: 'overloaded_error' };
  const KEY = 'guard-not-a-real-key';
  const kindOf = (b) => (b.system === RPMOD.REQUEST_PLAN_SYSTEM ? 'reading' : (b.system === FS.FRONT_SORTER_SYSTEM ? 'sorter' : (b.system === BW.BW2_JUDGE_SYSTEM ? 'judge' : (b.stream ? 'stream' : (b.tools ? 'round' : 'write')))));
  let seq = 0;
  /**
   * One turn through the real handler. `provider(kind, nthOfKind)` says what the provider does for that call:
   *   'ok' | a status (400, 429, 500, 529) | 'throw' (the connection fails) | 'drop' (the reply's headers arrive, its body cannot
   *   be read) | 'stream_error' (a stream that writes its first sentence and ends on the provider's error event)
   * `streamStop(nth)` is the reason a healthy stream stops (default end_turn).
   */
  async function drive(messages, { provider = () => 'ok', plan = '', sorter = 'RELIGIOUS', env = {}, device = null, streamStop = () => 'end_turn', roundStop = () => 'end_turn', writerText = WRITER_TEXT } = {}) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.ANTHROPIC_API_KEY = KEY;
    process.env.BRAVE_API_KEY = KEY;
    process.env.LEDGER_RAG = 'off';
    process.env.FREE_BRAIN_V1 = 'on';
    Object.assign(process.env, env);
    LEDGER_REDIS.__setRedisForTest(null);
    FLAG.__resetFlagCacheForTest();
    LEGACY.__resetLegacyFlagCacheForTest();
    installDayCapStore();
    if (PC) PC.__setProviderRetryPauseForTest(0);
    const asked = {};   // kind -> how many times the provider was asked
    const calls = [];
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (!/^https?:/.test(u)) return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
      if (u.startsWith(FC.FATWA_BASE)) {
        const pathname = new URL(u).pathname;
        if (init && init.method === 'GET' && ['/api/v1/health', '/api/v1/scholars'].includes(pathname)) return jsonResponse(u, {}, 503);
        calls.push('fatwa ' + ((init && init.method) || 'GET') + ' ' + u.slice(FC.FATWA_BASE.length) + ' ' + sha(init && init.body));
        return jsonResponse(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, results: [], scholars: [], pagination: { total: 0 }, counts: { scholars: 0 } });
      }
      if (u.includes('api.anthropic.com')) {
        const b = JSON.parse(init.body);
        const kind = kindOf(b);
        asked[kind] = (asked[kind] || 0) + 1;
        calls.push('model ' + kind + ' ' + sha(init.body));
        const does = provider(kind, asked[kind]);
        if (does === 'throw') throw new TypeError('fetch failed');
        if (does === 'drop') {
          const terminated = async () => { throw new TypeError('terminated'); };
          if (b.stream) return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: terminated, body: { getReader: () => ({ read: terminated }), cancel: async () => {} } };
          return { ok: true, status: 200, url: u, headers: { get: () => 'application/json' }, text: terminated, json: terminated };
        }
        if (does === 'notjson') {
          // a 200 whose body arrives whole and is not JSON (a gateway's page); as a stream, one chunk that is no event
          const page = '<html>gateway</html>';
          if (b.stream) { let sent = false; return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => page, body: { getReader: () => ({ read: async () => { if (sent) return { done: true, value: undefined }; sent = true; return { done: false, value: new TextEncoder().encode(page) }; } }), cancel: async () => {} } }; }
          return { ok: true, status: 200, url: u, headers: { get: () => 'text/html' }, text: async () => page, json: async () => JSON.parse(page) };
        }
        if (does !== 'ok' && does !== 'stream_error') return jsonResponse(u, { type: 'error', error: { type: ERR[does] || 'api_error', message: 'the request said: ' + String(init.body).slice(0, 200) } }, does);
        if (kind === 'reading') return jsonResponse(u, { content: [{ type: 'text', text: plan || 'I cannot.' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        if (kind === 'sorter') return jsonResponse(u, { content: [{ type: 'text', text: sorter }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        if (b.stream) {
          let done = false;
          return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
            body: { getReader: () => ({ read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              const frames = 'data: ' + JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 9 } } }) + '\n\n'
                + 'data: ' + JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + '\n\n'
                + 'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: writerText } }) + '\n\n'
                + (does === 'stream_error'
                  ? 'data: ' + JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'the request said: ' + String(init.body).slice(0, 200) } }) + '\n\n'
                  : 'data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: streamStop(asked[kind]) }, usage: { output_tokens: 7 } }) + '\n\n'
                    + 'data: {"type":"message_stop"}\n\n');
              return { done: false, value: new TextEncoder().encode(frames) };
            } }), cancel: async () => {} } };
        }
        if (!b.tools) return jsonResponse(u, { content: [{ type: 'text', text: JSON.stringify({ d: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 1])) }) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        return jsonResponse(u, { content: [{ type: 'text', text: WRITER_TEXT }], stop_reason: roundStop(asked[kind]), usage: { input_tokens: 1, output_tokens: 1 } });
      }
      calls.push('other ' + ((init && init.method) || 'GET') + ' ' + u.split('?')[0] + ' ' + sha(u + '|' + ((init && init.body) || '')));
      if (u.includes('api.search.brave.com')) return jsonResponse(u, { web: { results: [] } });
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
    seq += 1;
    const req = {
      method: 'POST',
      headers: { 'x-murabbi-device': device || ('provider-failure-guard-' + String(seq).padStart(4, '0')), 'x-real-ip': '10.63.0.' + (device ? 1 : seq),
        [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
      body: { messages, band: 'adult', age: 35 },
    };
    const logs = [];
    const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    const capture = (level) => (...a) => { logs.push([level, ...a]); };
    console.log = capture('log'); console.warn = capture('warn'); console.error = capture('error'); console.info = capture('info');
    let crashed = '';
    try { await handler(req, res); } catch (e) { crashed = String(e && e.message || e); } finally { Object.assign(console, keep); }
    globalThis.fetch = realFetch;
    const frames = res.writes.join('').split('\n\n').map((block) => block.split('\n').find((l) => l.startsWith('data: '))).filter(Boolean)
      .map((line) => { try { return JSON.parse(line.slice(6)); } catch { return null; } }).filter(Boolean);
    let text = '';
    for (const f of frames) { if (f.type === 'content_block_delta' && f.delta) text += f.delta.text || ''; if (f.type === 'ezik_replace') text = String(f.text || ''); }
    // the answer log's record of this turn, as the handler's own wrapper built it (lib/answer-log.js withAnswerLog sets req.__answerLog)
    const logged = req.__answerLog && typeof req.__answerLog.record === 'function' ? req.__answerLog.record() : null;
    const flags = logged && Array.isArray(logged.flags) ? logged.flags : [];
    const providerLines = logs.filter((a) => a[1] === '[provider]').map((a) => a[2]);
    return { crashed, status: res.statusCode, frames, text, calls, asked, logs, flags, providerLines, offer: frames.some((f) => f.type === 'ezik_live_offer') };
  }
  const user = (q) => [{ role: 'user', content: q }];

  // ------------------------------------------------------------------------------------------------ T (and --record)
  // what of a turn is compared: every frame, the text, every call (who was asked what, by the body's hash), every console line.
  // Durations and instants are measured values: every number under a key that names a time is written as 0, and a run of
  // source-status frames is compared as a set (the order in which the sources report varies between two runs of one tree).
  const TIME_KEY = /(?:^ms$|Ms$|_ms$|^elapsed|At$|[dD]uration$|[lL]atency$|^ttf|^t$)/;
  const sourceStage = (f) => f && f.type === 'ezik_status' && BW.BW2_SOURCES.includes(f.stage);
  const asSets = (frames) => {
    const out = [];
    for (let i = 0; i < frames.length;) {
      if (!sourceStage(frames[i])) { out.push(frames[i]); i += 1; continue; }
      let j = i;
      while (j < frames.length && sourceStage(frames[j])) j += 1;
      out.push(...frames.slice(i, j).sort((a, b) => String(a.stage).localeCompare(String(b.stage))));
      i = j;
    }
    return out;
  };
  const plainText = (s) => {
    const t = String(s).trim();
    if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) { try { return JSON.stringify(walk(JSON.parse(t))); } catch { /* a sentence */ } }
    return String(s).replace(/trace=[0-9a-f]+/g, 'trace=#').replace(/\b\d+(?:\.\d+)?ms\b/g, '#ms').replace(/(_ms:)\d+/g, '$1#');
  };
  const walk = (v) => {
    if (typeof v === 'string') return plainText(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (typeof x === 'number' && TIME_KEY.test(k)) ? 0 : walk(x)]));
    return v;
  };
  const plain = (v) => (v instanceof Error ? 'Error: ' + plainText(String(v.message)) : walk(v));
  const record = (turn) => ({ crashed: turn.crashed, status: turn.status, frames: asSets(walk(turn.frames)), text: turn.text, calls: [...turn.calls].sort(), logs: turn.logs.map((entry) => entry.map(plain)) });
  // the questions: three of the expected-plan fixture, each once as a religious turn and once as a worldly one, the switch off
  const HEALTHY = [['B21', 'RELIGIOUS'], ['B21', 'WORLDLY'], ['P9', 'RELIGIOUS'], ['P9', 'WORLDLY'], ['B1', 'RELIGIOUS'], ['M2', 'RELIGIOUS']];
  const healthyTurn = async ([id, sorter]) => {
    const item = byId[id];
    const messages = [...item.prev.flatMap((p) => [{ role: 'user', content: p }, { role: 'assistant', content: byId.B22.ideal.parts[0].name + '.' }]), { role: 'user', content: item.q }];
    return record(await drive(messages, { sorter, env: { REQUEST_PLAN_V1: 'off' }, device: 'provider-failure-guard-healthy-' + id + '-' + sorter }));
  };
  if (RECORD) {
    const out = { note: 'The healthy-provider turns of the handler of the tree named by `tree`, the reading switch off; written by guards/provider-failure-guard.cjs --record. Durations are zeroed.', tree: path.basename(REPO), turns: {} };
    for (const pair of HEALTHY) out.turns[pair.join('/')] = await healthyTurn(pair);
    fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 1) + '\n', 'utf8');
    console.log('recorded ' + Object.keys(out.turns).length + ' turns from ' + REPO + ' sha256=' + crypto.createHash('sha256').update(JSON.stringify(out.turns)).digest('hex'));
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    process.exit(0);
  }

  console.log('\n=== T. WITH A HEALTHY PROVIDER THE TURN IS THE TURN OF BEFORE (commit 06ee8909, recorded) ===');
  {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    for (const pair of HEALTHY) {
      const name = pair.join('/');
      const now = await healthyTurn(pair);
      const then = fixture.turns[name];
      const diff = !then ? ['no recorded turn'] : ['crashed', 'status', 'frames', 'text', 'calls', 'logs'].filter((k) => JSON.stringify(now[k]) !== JSON.stringify(then[k]));
      ok('T ' + name + ': frames, text, calls and console lines equal the recorded turn', diff.length === 0 && now.crashed === '', diff.join(','));
    }
    ok('T0 the recorded turns are not empty shells (each has frames, a text and at least one model call)',
      Object.values(fixture.turns).every((t) => t.frames.length > 3 && t.text.length > 0 && t.calls.some((c) => c.startsWith('model '))));
  }

  // ------------------------------------------------------------------------------------------------ H
  console.log('\n=== H. THE HANDLER WHEN THE PROVIDER REFUSES EVERY CALL ===');
  const NOT_FOUND = BW.BW2_NOT_COVERED;
  const TOKEN = /^[a-z_]+:\d+:[a-z0-9_]*$/;
  // (the line's two fields are names the telemetry guard has already reviewed: `degraded`, a list of closed codes, and `outcome`)
  const allTokens = (turn) => turn.providerLines.flatMap((line) => (line && Array.isArray(line.degraded) ? line.degraded : []));
  const lostSaid = (turn) => turn.providerLines.some((line) => line && line.outcome === 'lost');
  const leak = (turn, question) => {
    const said = JSON.stringify(turn.providerLines);
    return said.includes(KEY) || said.includes(question.slice(0, 12)) || said.includes('the request said') || said.includes('message');
  };
  for (const [label, does, type, times] of [['400', 400, 'invalid_request_error', 1], ['429', 429, 'rate_limit_error', 2], ['a failed connection', 'throw', 'connection', 2]]) {
    for (const [config, env, readingAsked] of [['the reading on', {}, true], ['the reading switch off', { REQUEST_PLAN_V1: 'off' }, false]]) {
      const q = byId.B21.q;
      const turn = await drive(user(q), { provider: () => does, env });
      const status = does === 'throw' ? 0 : does;
      const tokens = allTokens(turn);
      const want = [...(readingAsked ? ['reading'] : []), 'sorter', 'judge', 'round', 'write'].map((call) => call + ':' + status + ':' + type);
      ok('H ' + label + ', ' + config + ': the reader gets the apology and nothing else', turn.crashed === '' && turn.text === LOST_TEXT, turn.text);
      ok('H ' + label + ', ' + config + ': neither the not-found sentence nor the offer to search', !turn.text.includes(NOT_FOUND) && !turn.offer);
      ok('H ' + label + ', ' + config + ': every call was asked ' + times + ' time(s)' + (times === 1 ? ' (a 400 is never tried again)' : ' (tried once more)'),
        Object.values(turn.asked).every((n) => n === times) && (turn.asked.reading || 0) === (readingAsked ? times : 0) && turn.asked.judge === times && turn.asked.round === times && turn.asked.write === times, turn.asked);
      ok('H ' + label + ', ' + config + ': each failed call is logged as call:status:type', want.every((w) => tokens.includes(w)) && tokens.every((t) => TOKEN.test(t)), tokens);
      ok('H ' + label + ', ' + config + ': the log says the turn was lost, and the answer log carries the one closed flag', lostSaid(turn) && turn.flags.includes(LOST_FLAG), turn.flags);
      ok('H ' + label + ', ' + config + ': neither the key, nor the reader\'s words, nor the provider\'s message is in those lines', !leak(turn, q));
    }
  }
  {
    // the before-writing path must close the turn itself (nothing to hand on to): the same sentence, from that path
    const q = byId.B21.q;
    const turn = await drive(user(q), { provider: () => 400, env: { BW2_CONTINUE: 'off', REQUEST_PLAN_V1: 'off' } });
    ok('H2a hand-over off, 400: the before-writing path itself ends on the apology, with no not-found sentence and no offer',
      turn.crashed === '' && turn.text === LOST_TEXT && !turn.offer && !(turn.asked.round || turn.asked.write), [turn.text, turn.asked]);
    ok('H2b hand-over off, 400: the flag, and the judge\'s failed call logged', turn.flags.includes(LOST_FLAG) && allTokens(turn).includes('judge:400:invalid_request_error'), [turn.flags, allTokens(turn)]);
    // a part the server served (the fixed card) stays; the apology stands where the absence of the writer's part would
    const b19 = byId.B19;
    const served = await drive(user(b19.q), { plan: JSON.stringify(b19.ideal), provider: (kind) => (kind === 'reading' ? 'ok' : 400) });
    const card = '<worship id="tayammum"></worship>';
    ok('H3 a question with a served part, the provider refusing the rest: the card stays, then the apology; no absence line, no offer',
      served.crashed === '' && served.text.includes(card) && served.text.trim().endsWith(LOST_TEXT) && !served.text.includes('لم أقف') && !served.text.includes(NOT_FOUND) && !served.offer
      && served.flags.includes(LOST_FLAG), served.text);
  }

  console.log('\n=== R. REFUSED ONCE, ANSWERED ON THE SECOND TRY ===');
  {
    const q = byId.B21.q;
    const healthy = await drive(user(q), { env: { REQUEST_PLAN_V1: 'off' } });
    for (const [label, first] of [['429', 429], ['529', 529], ['a failed connection', 'throw']]) {
      const turn = await drive(user(q), { provider: (kind, nth) => (nth === 1 ? first : 'ok'), env: { REQUEST_PLAN_V1: 'off' } });
      ok('R ' + label + ' on the first try of every call: the reader gets the healthy turn\'s text and frames',
        turn.crashed === '' && turn.text === healthy.text && same(turn.frames.map((f) => f.type + ':' + (f.stage || '')), healthy.frames.map((f) => f.type + ':' + (f.stage || ''))), turn.text);
      ok('R ' + label + ': no lost turn, no flag, and each call was asked exactly twice', !lostSaid(turn) && !turn.flags.includes(LOST_FLAG) && Object.values(turn.asked).every((n) => n === 2), turn.asked);
    }
    // a 400 on the before-writing path's own calls, a healthy older path: a model answered, so the turn is not lost
    const partial = await drive(user(q), { provider: (kind) => (kind === 'judge' || kind === 'stream' ? 400 : 'ok'), env: { REQUEST_PLAN_V1: 'off' } });
    ok('R2 the judge refused (400) and the older path healthy: not a lost turn (no apology, no flag); the judge\'s failure is still logged',
      partial.crashed === '' && partial.text !== LOST_TEXT && !partial.flags.includes(LOST_FLAG) && allTokens(partial).includes('judge:400:invalid_request_error'), [partial.text, allTokens(partial)]);
  }

  console.log('\n=== D. AFTER THE REFUTING HELPER: A BODY THAT DROPS, AN ERROR AFTER THE FIRST SENTENCE, A CARD ALREADY OUT ===');
  {
    const q = byId.B21.q;
    const b19 = byId.B19;
    const card = '<worship id="tayammum"></worship>';
    // every model call's reply loses its body after the headers
    const dropped = await drive(user(q), { provider: () => 'drop' });
    ok('D1 every call\'s body dropped after its headers: the reader gets the apology and nothing else, no offer, the flag; each call is logged as a lost connection',
      dropped.crashed === '' && dropped.text === LOST_TEXT && !dropped.offer && dropped.flags.includes(LOST_FLAG) && lostSaid(dropped)
      && ['reading', 'sorter', 'judge', 'round', 'write'].every((call) => allTokens(dropped).includes(call + ':0:connection')) && !leak(dropped, q), [dropped.text, allTokens(dropped)]);
    // the before-writing writer's stream drops while it is read
    const alone = await drive(user(q), { provider: (kind) => (kind === 'stream' ? 'drop' : 'ok'), env: { BW2_CONTINUE: 'off', REQUEST_PLAN_V1: 'off' } });
    ok('D2 the writer\'s stream drops while it is read (hand-over off): the apology, not the sentence that no text was found, and no offer',
      alone.crashed === '' && alone.text === LOST_TEXT && !alone.text.includes(NOT_FOUND) && !alone.offer && alone.flags.includes(LOST_FLAG) && allTokens(alone).includes('writer:0:connection'), [alone.text, allTokens(alone)]);
    const served = await drive(user(b19.q), { plan: JSON.stringify(b19.ideal), provider: (kind) => (kind === 'stream' ? 'drop' : 'ok') });
    ok('D3 the same beside a card the server served: the card stays, then the apology; no line that no text was found, no offer',
      served.crashed === '' && served.text.includes(card) && served.text.trim().endsWith(LOST_TEXT) && !served.text.includes('لم أقف') && !served.text.includes(NOT_FOUND) && !served.offer
      && served.flags.includes(LOST_FLAG) && allTokens(served).includes('writer:0:connection'), [served.text, allTokens(served)]);
    // the writer releases a sentence with no source, then the provider's stream ends on its error event
    const cutShort = await drive(user(q), { provider: (kind) => (kind === 'stream' ? 'stream_error' : 'ok'), env: { BW2_CONTINUE: 'off', REQUEST_PLAN_V1: 'off' } });
    ok('D4 the writer wrote a sentence with no source and its stream then ended on the provider\'s error: the sentence is withdrawn and the reader gets the apology -- lost to the provider, not unsourced; no offer; the provider\'s own word is logged, never its message',
      cutShort.crashed === '' && cutShort.text === LOST_TEXT && !cutShort.offer && cutShort.flags.includes(LOST_FLAG) && !cutShort.flags.includes('unsourced_withheld')
      && allTokens(cutShort).includes('writer:0:overloaded_error') && !leak(cutShort, q), [cutShort.text, cutShort.flags, allTokens(cutShort)]);
    // nothing is tried again once something is on the reader's page
    const judgeOut = await drive(user(b19.q), { plan: JSON.stringify(b19.ideal), provider: (kind, nth) => (kind === 'judge' && nth === 1 ? 429 : 'ok') });
    const writerOut = await drive(user(b19.q), { plan: JSON.stringify(b19.ideal), provider: (kind, nth) => (kind === 'stream' && nth === 1 ? 429 : 'ok') });
    ok('D5 a card of the server\'s is already on the reader\'s page: the judge, refused with 429, is NOT tried again, and neither is the writer (with nothing out they are: rows R); the card stays and the apology follows it',
      judgeOut.crashed === '' && judgeOut.text.includes(card) && judgeOut.asked.judge === 1 && judgeOut.text.trim().endsWith(LOST_TEXT) && allTokens(judgeOut).includes('judge:429:rate_limit_error')
      && writerOut.crashed === '' && writerOut.text.includes(card) && writerOut.asked.judge === 1 && writerOut.asked.stream === 1 && writerOut.text.trim().endsWith(LOST_TEXT)
      && allTokens(writerOut).includes('writer:429:rate_limit_error'), [judgeOut.asked, writerOut.asked, allTokens(writerOut)]);
    // a continuation the provider refuses
    const more = await drive(user(q), { provider: (kind, nth) => (kind === 'stream' && nth === 2 ? 529 : 'ok'), streamStop: (nth) => (nth === 1 ? 'max_tokens' : 'end_turn'), env: { BW2_CONTINUE: 'off', REQUEST_PLAN_V1: 'off' } });
    ok('D6 [after the second helper] the writer stopped on its budget with nothing sourced released, and the call that continues it was refused (529): that call is logged, and the turn is lost to the provider -- the apology, not the sentence that no text was found, and no offer (where sourced text is already out the answer stands, cut: requestplan L23)',
      more.crashed === '' && more.asked.stream === 2 && allTokens(more).includes('writer:529:overloaded_error') && more.text === LOST_TEXT && !more.offer
      && more.flags.includes(LOST_FLAG) && !more.flags.includes('unsourced_withheld'), [more.asked, allTokens(more), more.flags, more.text]);
    // the judge's body drops, everything else healthy
    const judge = await drive(user(q), { provider: (kind) => (kind === 'judge' ? 'drop' : 'ok'), env: { REQUEST_PLAN_V1: 'off' } });
    ok('D7 the judge\'s reply loses its body, the rest healthy: logged as the judge\'s lost connection, not a lost turn',
      judge.crashed === '' && judge.text !== LOST_TEXT && !judge.flags.includes(LOST_FLAG) && allTokens(judge).includes('judge:0:connection'), [judge.text, allTokens(judge)]);

    // -- after the SECOND refuting helper
    // a 200 whose body is not JSON, on every call
    const pages = [await drive(user(q), { provider: () => 'notjson' }), await drive(user(q), { provider: () => 'notjson', env: { REQUEST_PLAN_V1: 'off' } }),
      await drive(user(q), { provider: () => 'notjson', env: { REQUEST_PLAN_V1: 'off', BW2_CONTINUE: 'off' } })];
    ok('D8 [after the second helper] every call answered 200 with a body that is not JSON (a gateway\'s page): the apology on every path -- the reading on, off, and the hand-over off -- with the flag, and each failed call logged under the word body',
      pages.every((t) => t.crashed === '' && t.text === LOST_TEXT && !t.offer && t.flags.includes(LOST_FLAG) && lostSaid(t) && allTokens(t).length > 0 && allTokens(t).every((tok) => /:0:body$/.test(tok)) && !leak(t, q)),
      pages.map((t) => [t.text === LOST_TEXT, t.flags.includes(LOST_FLAG), allTokens(t)]));
    // the older path, a partial failure: its round refused, its closing write answering
    const partialOld = await drive(user(q), { provider: (kind) => (kind === 'write' || kind === 'sorter' ? 'ok' : 400), env: { REQUEST_PLAN_V1: 'off' } });
    ok('D9 [after the second helper] the older path: the round refused (400) and the closing write answering is NOT a lost turn -- no apology, no flag; the refused calls are logged',
      partialOld.crashed === '' && !partialOld.text.includes(LOST_TEXT) && !partialOld.flags.includes(LOST_FLAG) && !lostSaid(partialOld)
      && allTokens(partialOld).includes('round:400:invalid_request_error') && allTokens(partialOld).includes('judge:400:invalid_request_error'), [partialOld.text, partialOld.flags, allTokens(partialOld)]);
    // the older path: its round stops on its budget and the call that continues it is refused
    const olderMore = await drive(user(q), { provider: (kind) => (kind === 'judge' || kind === 'stream' ? 400 : (kind === 'write' ? 529 : 'ok')), roundStop: (nth) => (nth === 1 ? 'max_tokens' : 'end_turn'), env: { REQUEST_PLAN_V1: 'off' } });
    ok('D10 [after the second helper] the older path: a round stopped by its budget, the call that continues it refused (529): that call leaves its token, and it is asked ONCE (a continuation is never tried again)',
      olderMore.crashed === '' && allTokens(olderMore).includes('write:529:overloaded_error') && olderMore.asked.write === 1 && olderMore.asked.round === 1, [olderMore.asked, allTokens(olderMore)]);
    // the before-writing path: the judge refused, the writer asked, and it answers that the texts do not cover the question
    const judgeOnly = await drive(user(q), { provider: (kind) => (kind === 'judge' ? 400 : 'ok'), writerText: '@@EZIK_NOT_COVERED@@', env: { BW2_CONTINUE: 'off', REQUEST_PLAN_V1: 'off' } });
    ok('D11 [after the second helper] the before-writing path: a judge the provider refused keeps no row, and the path ends there -- the writer is NOT asked (so "the judge failed and the writer answered" is no state of a turn); with the hand-over off that is a lost turn: the apology, the flag, the judge\'s token',
      judgeOnly.crashed === '' && !judgeOnly.asked.stream && judgeOnly.text === LOST_TEXT && !judgeOnly.offer && judgeOnly.flags.includes(LOST_FLAG)
      && allTokens(judgeOnly).includes('judge:400:invalid_request_error'), [judgeOnly.asked, judgeOnly.text, judgeOnly.flags, allTokens(judgeOnly)]);
    // (the older path's own rule for a second try -- none once its stream is the reader's or the turn's time is spent -- has no row:
    // see BRAIN-A2-evidence/tools/patch-provider-guard-d14.cjs for what was tried)
    // ORDER BATTERY2 (2026-11-14), re-cut of D12 and D13. They held what became of a worldly part's own call when the provider refused
    // it. The handler no longer has the server make that call: a worldly part beside another part is a plan it does not apply
    // (lib/request-plan.js planNotApplied, worldly_beside_other). There is no such failure to tell; what the rows hold now is
    // that the call is not made and the reader is sent the switch-off turn's text. (The call's own token is still written by
    // the turn's code for whoever hands it such a part: lib/before-writing-v2.js.)
    // a worldly part beside a ruling
    const mixedQ ='كم عدد سكان إندونيسيا؟ وما حكم السفر إلى إندونيسيا للسياحة؟';
    const mixedPlan = JSON.stringify({ followup: false, parts: [{ q: 'كم عدد سكان إندونيسيا؟', kind: 'worldly', name: 'عدد سكان إندونيسيا' }, { q: 'ما حكم السفر إلى إندونيسيا للسياحة؟', kind: 'ruling', name: 'حكم السفر إلى إندونيسيا للسياحة' }] });
    const worldly = await drive(user(mixedQ), { plan: mixedPlan, provider: (kind, nth) => (kind === 'write' && nth === 1 ? 400 : 'ok') });
    const worldlyOff = await drive(user(mixedQ), { provider: (kind, nth) => (kind === 'write' && nth === 1 ? 400 : 'ok'), env: { REQUEST_PLAN_V1: 'off' } });
    ok('D12 [after the second helper; BATTERY2 re-cut] a worldly part beside a ruling: no call is made for the worldly part (nothing of it to refuse, no token of it), and the reader is sent the text of the switch-off turn',
      worldly.crashed === '' && worldlyOff.crashed === '' && !allTokens(worldly).some((t) => String(t).startsWith('worldly:')) && (worldly.asked.write || 0) === (worldlyOff.asked.write || 0)
      && worldly.text === worldlyOff.text && worldly.text.length > 8, [worldly.asked, worldlyOff.asked, allTokens(worldly)]);
    // a card, a worldly part and a written part
    const tripleQ = 'ما صفة الوضوء؟ وكم عدد سكان إندونيسيا؟ وما نواقض الوضوء؟';
    const triplePlan = JSON.stringify({ followup: false, parts: [{ q: 'ما صفة الوضوء؟', kind: 'manner', act: 'wudu', name: 'صفة الوضوء' },
      { q: 'كم عدد سكان إندونيسيا؟', kind: 'worldly', name: 'عدد سكان إندونيسيا' }, { q: 'ما نواقض الوضوء؟', kind: 'definition', name: 'نواقض الوضوء' }] });
    const cardThenWorldly = await drive(user(tripleQ), { plan: triplePlan, provider: (kind, nth) => (kind === 'write' && nth === 1 ? 429 : 'ok') });
    const cardThenWorldlyOff = await drive(user(tripleQ), { provider: (kind, nth) => (kind === 'write' && nth === 1 ? 429 : 'ok'), env: { REQUEST_PLAN_V1: 'off' } });
    ok('D13 [after the second helper; BATTERY2 re-cut] a card, a worldly part and a written part: the plan is not applied, so no call is made for the worldly part (no token of it) and the reader is sent the text of the switch-off turn',
      cardThenWorldly.crashed === '' && cardThenWorldlyOff.crashed === '' && !allTokens(cardThenWorldly).some((t) => String(t).startsWith('worldly:')) && (cardThenWorldly.asked.write || 0) === (cardThenWorldlyOff.asked.write || 0)
      && cardThenWorldly.text === cardThenWorldlyOff.text && cardThenWorldly.text.length > 8, [cardThenWorldly.asked, cardThenWorldlyOff.asked, allTokens(cardThenWorldly), cardThenWorldly.text.includes('<worship')]);
  }

  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  if (PC) PC.__setProviderRetryPauseForTest(null);
  console.log('\n' + (failures ? 'FAILED' : 'PASSED') + ': ' + (checks - failures) + '/' + checks + ' checks');
  process.exit(failures ? 1 : 0);

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
})().catch((error) => { console.error('GUARD THREW: ' + (error && error.stack ? error.stack : String(error))); process.exit(1); });
