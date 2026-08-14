#!/usr/bin/env node
'use strict';
// call-mode-guard.cjs  --  GATE 11: the voice-call path stays usable and stays HONEST.
//
// Three regressions this gate exists to prevent, all measured live:
//
//   1. api/chat.js sent `output_config.effort`. /v1/messages does not accept that field,
//      so ONE env var (CALL_EFFORT) turned every call turn into an upstream 400.
//   2. index.html refused to build the call screen when window.SpeechRecognition was
//      absent -- even though the LIVE path (CALL_STT_CLOUD) records with MediaRecorder
//      and transcribes in api/stt.js, and never touches SpeechRecognition at all.
//   3. Every failure on that path was SILENT: a denied microphone and a dead /api/stt
//      both ended in an empty catch + a re-opened mic, and the 400 above reached the
//      child as "لم أفهم سؤالك" -- blaming them for a request the model never read.
//
// CHECK A  api/chat.js + api/chat-fast.js, EXECUTED: the handler is actually invoked with
//          CALL_EFFORT set AND a client-supplied output_config, and the bytes it puts on
//          the wire are inspected. This is behaviour, not a grep for a comment.
// CHECK B  index.html message maps, EXECUTED: the three message functions are extracted
//          from the page and run, so a message that goes blank or collapses into another
//          fails here rather than on a child's screen.
// CHECK C  index.html structure: the invariants that cannot be executed outside a browser
//          (SR gating, no-silent-restart, the call-screen banner) are asserted on source.
//
// Arabic needles live as string literals but are NEVER printed. All console output is
// ASCII (ids/labels only), safe for a Windows terminal.
//
// Exit 0 = all pass  |  1 = a real regression  |  2 = could not run (structural).
//
// Usage:  node call-mode-guard.cjs [indexFile]     default: index.html

const fs = require('fs');
const path = require('path');

const indexFile = process.argv[2] || 'index.html';

let P = 0, F = 0;
const FAILS = [];
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; FAILS.push(m); console.log('  [FAIL] ' + m); };
const info = (m) => console.log('  [INFO] ' + m);
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };
const abort = (m) => { console.error('ABORT: ' + m); process.exit(2); };

console.log('call-mode-guard: gate 11 (voice call -- reachable path, honest failures)');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Slice a brace-balanced body starting at the first `{` at/after `from`. The regions this
// gate extracts contain no braces inside string literals, so plain counting is exact.
function braceSlice(src, from) {
  const start = src.indexOf('{', from);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

// Extract `<header> ... }` as runnable source, e.g. extract(src, 'const sttErrorMessage = (status) => ')
function extractDecl(src, header) {
  const at = src.indexOf(header);
  if (at === -1) return null;
  const body = braceSlice(src, at + header.length - 1);
  return body === null ? null : (header + body);
}

// ===========================================================================
// CHECK A -- the relays, EXECUTED
// ===========================================================================
async function checkRelays() {
  const chatSrc = read('api/chat.js');
  const fastSrc = read('api/chat-fast.js');
  if (chatSrc === null) abort('cannot read api/chat.js');
  if (fastSrc === null) abort('cannot read api/chat-fast.js');

  // A0: the env gate itself must be GONE, not merely defaulted off. A file that still reads
  // CALL_EFFORT is one Vercel env var away from the 400 this gate exists to prevent.
  // Match the READ, not the word: the file names CALL_EFFORT in the comment that explains why
  // it must never come back, and a guard that fails on its own tombstone teaches nothing.
  if (/process\.env\.CALL_EFFORT/.test(chatSrc)) fail('A0 api/chat.js still reads process.env.CALL_EFFORT (the env gate must be removed, not defaulted off)');
  else pass('A0 api/chat.js no longer reads process.env.CALL_EFFORT');

  // A1: no assignment of output_config anywhere in either relay (a delete is not an assignment).
  for (const [name, src] of [['api/chat.js', chatSrc], ['api/chat-fast.js', fastSrc]]) {
    if (/output_config\s*[:=][^=]/.test(src.replace(/delete\s+parsed\.output_config\s*;/g, ''))) {
      fail('A1 ' + name + ' assigns output_config somewhere');
    } else pass('A1 ' + name + ' never assigns output_config');
  }

  // ---- executed: run the real handlers and read the bytes they put on the wire ----
  const { founderTokenFor } = await import(pathToUrl('lib/daycap.js'));
  const { CLASSIFIER_SYSTEM_PROMPT, buildFastGenPrompt } = await import(pathToUrl('lib/system-prompt.js'));

  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  process.env.FOUNDER_SECRET = 'call-mode-guard-secret';
  process.env.CALL_EFFORT = 'high';   // the exact setting that broke production
  // Exercise the shipped defaults. Setting the expected ids in the harness would let a stale
  // hardcoded fallback pass forever and would make the model-switch mutations below invisible.
  delete process.env.MODEL;
  delete process.env.MODEL_STANDARD;
  delete process.env.MODEL_FAST;
  delete process.env.TASHKEEL_MODEL;
  process.env.CALL_THINKING = 'disabled';

  const DEVICE = 'callmodeguarddevice01';
  const founder = founderTokenFor(DEVICE); // founder short-circuits the day cap BEFORE any Redis

  const realFetch = global.fetch;
  let sent = null;
  let anthropicCalls = 0;
  let upstreamToken = 'ok';
  const tokenWire = (token) =>
    'data: ' + JSON.stringify({
      type: 'content_block_delta', index: 0,
      delta: { type: 'text_delta', text: token },
    }) + '\n\ndata: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';
  global.fetch = async (url, opts) => {
    const u = String(url);
    // Exact deterministic fail-open contract for the Upstash transport. Returning HTTP 500
    // avoids transport retries while never falling through to native network.
    if (u === '/pipeline' && opts && opts.method === 'POST') {
      return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('api.anthropic.com') !== -1) {
      anthropicCalls++;
      sent = JSON.parse((opts && opts.body) || '{}');
      if (sent.stream === undefined) {
        return new Response(JSON.stringify({
          content: [{ type: 'text', text: 'نَصّ' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(tokenWire(upstreamToken),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    // Anything else is the Upstash throttle. It FAILS OPEN by contract, so refusing it here
    // exercises the same path a Redis outage would -- and keeps this gate offline.
    throw new Error('offline (call-mode-guard)');
  };

  const mkRes = () => {
    const r = {
      statusCode: 0, headers: {}, chunks: [], ended: false,
      status(c) { r.statusCode = c; return r; },
      setHeader(k, v) { r.headers[String(k).toLowerCase()] = v; return r; },
      getHeader(k) { return r.headers[String(k).toLowerCase()]; },
      get headersSent() { return r.chunks.length > 0 || r.ended; },
      flushHeaders() {},
      write(c) { r.chunks.push(Buffer.from(c)); return true; },
      end(c) { if (c) r.chunks.push(Buffer.from(c)); r.ended = true; return r; },
      json(o) { r.chunks.push(Buffer.from(JSON.stringify(o))); r.ended = true; return r; },
    };
    return r;
  };

  const mkReq = (extra) => ({
    method: 'POST',
    headers: {
      'x-real-ip': '127.0.0.1',
      'x-murabbi-device': DEVICE,
      'x-murabbi-founder': founder,
      // A CONSENTED client. The AI-consent gate (lib/ai-consent.js) refuses every relay 403
      // without this, so a probe of the relay's BEHAVIOUR has to present what a real, consented
      // client presents. The refusal itself is proved separately, in tools/ai-consent-probe.cjs.
      'x-ezik-ai-consent': '2026-08-06-1',
    },
    // A client that ASKS for the unsupported field: the relay must strip it, not forward it.
    body: Object.assign({
      max_tokens: 4096,
      stream: false,
      system: 'guard probe',
      messages: [{ role: 'user', content: 'probe' }],
      name: 'guard',
      age: 30,
      gender: 'male',
      mode: 'normal',
      band: 'adult',
      output_config: { effort: 'high' },
      model: 'claude-opus-5',
      temperature: 0.25,
      top_p: 0.75,
      top_k: 4,
      thinking: { type: 'enabled', budget_tokens: 1024 },
      tools: [{ name: 'client_tool', input_schema: { type: 'object' } }],
      tool_choice: { type: 'any' },
      metadata: { user_id: 'client-owned' },
      stop_sequences: ['CLIENT_STOP'],
      unknown_provider_canary: true,
    }, extra || {}),
  });

  try {
    for (const [name, mod] of [['api/chat.js', 'api/chat.js'], ['api/chat-fast.js', 'api/chat-fast.js']]) {
      sent = null;
      const handler = (await import(pathToUrl(mod))).default;
      const res = mkRes();
      await handler(mkReq(), res);

      if (sent === null) {
        fail('A2 ' + name + ' never reached the upstream call (status ' + res.statusCode +
             ', body ' + Buffer.concat(res.chunks).toString('utf8').slice(0, 160) + ')');
        continue;
      }
      if (res.statusCode === 200) pass('A2 ' + name + ' relayed a 200');
      else fail('A2 ' + name + ' answered ' + res.statusCode + ' on a clean turn');

      // THE assertion this gate is for.
      if ('output_config' in sent) fail('A3 ' + name + ' PUT output_config ON THE WIRE: ' + JSON.stringify(sent.output_config));
      else pass('A3 ' + name + ' sent NO output_config (CALL_EFFORT=high and a client-supplied one were both ignored)');
      if (sent.effort !== undefined) fail('A3 ' + name + ' sent a bare top-level effort field');
      else pass('A3 ' + name + ' sent no bare effort field');
      const relayKeys = Object.keys(sent).sort().join(',');
      if (relayKeys === 'max_tokens,messages,model,stream,system' && sent.stream === true
          && sent.thinking === undefined) {
        pass('A3 ' + name + ' sends only the server-owned ordinary-answer envelope');
      } else fail('A3 ' + name + ' provider keys/stream = ' + relayKeys + '/' + sent.stream);

      // Standing invariants that share this transform -- if one breaks, the same edit broke it.
      if (name === 'api/chat.js' && sent.model === 'claude-sonnet-5') pass('A4 api/chat.js still forces the STANDARD model server-side');
      else if (name === 'api/chat.js') fail('A4 api/chat.js model = ' + sent.model + ' (client sent claude-opus-5; the server must overrule it)');
      if (name === 'api/chat-fast.js' && sent.model === 'claude-sonnet-5') pass('A4 api/chat-fast.js sends its answer role on Sonnet 5');
      else if (name === 'api/chat-fast.js') fail('A4 api/chat-fast.js user-visible answer model = ' + sent.model);
      if (Array.isArray(sent.system) && sent.system[0] && sent.system[0].cache_control) pass('A5 ' + name + ' still wraps the system prompt in an ephemeral cache block');
      else fail('A5 ' + name + ' lost the ephemeral system-prompt cache block');
    }

    // The shipped endpoint still carries two semantic roles, but both use the same server-owned
    // STANDARD resolver. max_tokens is temporarily the compatibility signal for prompt and
    // answer-only policy treatment; it never selects a model tier.
    const fastHandler = (await import(pathToUrl('api/chat-fast.js'))).default;
    const promptText = (body) => Array.isArray(body && body.system)
      ? body.system.map((b) => (b && b.text) || '').join('') : String((body && body.system) || '');
    const responseText = (res) => Buffer.concat(res.chunks).toString('utf8');
    const runFast = async ({ maxTokens, omitMaxTokens = false, token = 'GEN', body = {}, founderHeader = true } = {}) => {
      sent = null;
      anthropicCalls = 0;
      upstreamToken = token;
      const req = mkReq(Object.assign({}, body, { max_tokens: maxTokens }));
      if (omitMaxTokens) delete req.body.max_tokens;
      if (!founderHeader) {
        delete req.headers['x-murabbi-founder'];
        delete req.headers['x-murabbi-device'];
      }
      const res = mkRes();
      await fastHandler(req, res);
      return { sent, calls: anthropicCalls, res, text: responseText(res) };
    };
    const chatHandler = (await import(pathToUrl('api/chat.js'))).default;
    const runChat = async ({ maxTokens, omitMaxTokens = false, token = 'answer', body = {} } = {}) => {
      sent = null;
      anthropicCalls = 0;
      upstreamToken = token;
      const req = mkReq(Object.assign({}, body, { max_tokens: maxTokens }));
      if (omitMaxTokens) delete req.body.max_tokens;
      const res = mkRes();
      await chatHandler(req, res);
      return { sent, calls: anthropicCalls, res, text: responseText(res) };
    };

    process.env.MODEL_STANDARD = 'call-mode-standard-sentinel';
    process.env.MODEL = 'call-mode-legacy-sentinel';
    process.env.MODEL_FAST = 'call-mode-fast-sentinel';
    process.env.MODEL_PREMIUM = 'call-mode-premium-sentinel';
    try {
      for (const token of ['GEN', 'DEEN']) {
        const result = await runFast({
          maxTokens: 8, token, founderHeader: false,
          body: {
            band: 'young', age: 9,
            messages: [{ role: 'user', content: 'school fact for 2026' }],
          },
        });
        if (result.sent && result.sent.model === 'call-mode-standard-sentinel'
            && result.sent.max_tokens === 8
            && promptText(result.sent) === CLASSIFIER_SYSTEM_PROMPT
            && JSON.stringify(result.sent.thinking) === JSON.stringify({ type: 'disabled' })
            && Object.keys(result.sent).sort().join(',') === 'max_tokens,messages,model,stream,system,thinking') {
          pass('A6 exact numeric 8 keeps the classifier prompt and STANDARD model');
        } else fail('A6 exact numeric 8 changed classifier role or model');
        if (result.calls === 1 && result.text === tokenWire(token)
            && result.sent && result.sent.stream === true
            && !result.res.__emptyAnswerGuarded) {
          pass('A6 classifier ' + token + ' stays raw with one provider call and no answer rewriting');
        } else fail('A6 classifier ' + token + ' response contract changed');
      }

      const answerCases = [
        ['numeric-7', 7, false], ['numeric-9', 9, false], ['numeric-4096', 4096, false],
        ['huge', 64000, false],
        ['missing', undefined, true], ['zero', 0, false], ['null', null, false],
        ['false', false, false], ['empty-string', '', false], ['whitespace', '   ', false],
        ['string-8', '8', false], ['string-0', '0', false], ['negative', -1, false],
        ['nan', NaN, false], ['infinity', Infinity, false], ['negative-infinity', -Infinity, false],
        ['decimal', 1.5, false], ['true', true, false],
        ['array-8', [8], false], ['empty-array', [], false], ['object', {}, false],
      ];
      for (const [label, maxTokens, omitMaxTokens] of answerCases) {
        const result = await runFast({
          maxTokens, omitMaxTokens, token: 'answer', body: { band: 'adult', age: 30 },
        });
        const expectedBudget = !omitMaxTokens && typeof maxTokens === 'number'
          && Number.isFinite(maxTokens) && Number.isInteger(maxTokens) && maxTokens > 0
          ? Math.min(maxTokens, 4096) : 4096;
        if (result.sent && result.sent.model === 'call-mode-standard-sentinel'
            && result.sent.max_tokens === expectedBudget
            && promptText(result.sent) === buildFastGenPrompt(30)
            && result.sent.thinking === undefined
            && Object.keys(result.sent).sort().join(',') === 'max_tokens,messages,model,stream,system'
            && result.res.__emptyAnswerGuarded === true) {
          pass('A6 noncanonical ' + label + ' remains an answer on STANDARD');
        } else fail('A6 noncanonical ' + label + ' gained classifier role or changed model');
        if (result.calls !== 1 || result.text !== tokenWire('answer')) {
          fail('A6 noncanonical ' + label + ' changed answer call count or relay shape (calls='
            + result.calls + ', bytes=' + Buffer.byteLength(result.text) + ')');
        } else pass('A6 noncanonical ' + label + ' preserves one answer provider call and relay shape');
      }

      for (const [label, maxTokens, omitMaxTokens] of [...answerCases, ['numeric-8', 8, false]]) {
        const result = await runChat({ maxTokens, omitMaxTokens });
        const expectedBudget = !omitMaxTokens && typeof maxTokens === 'number'
          && Number.isFinite(maxTokens) && Number.isInteger(maxTokens) && maxTokens > 0
          ? Math.min(maxTokens, 4096) : 4096;
        if (result.sent && result.sent.model === 'call-mode-standard-sentinel'
            && result.sent.max_tokens === expectedBudget && Number.isInteger(result.sent.max_tokens)
            && result.sent.max_tokens > 0 && result.sent.thinking === undefined
            && Object.keys(result.sent).sort().join(',') === 'max_tokens,messages,model,stream,system'
            && result.calls === 1 && result.text === tokenWire('answer')) {
          pass('A6 chat token ' + label + ' is a positive bounded STANDARD answer');
        } else fail('A6 chat token ' + label + ' leaked an invalid budget, role, or envelope');
      }

      const validHistories = [
        [{ role: 'user', content: 'probe' }],
        [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'probe' },
        ],
        [{
          role: 'user', ignored: 'strip-me', content: [
            { type: 'image', ignored: true, source: {
              type: 'base64', media_type: 'image/png', data: 'YWJj', ignored: true,
            } },
            { type: 'text', text: 'probe', ignored: true },
          ],
        }],
      ];
      for (const [index, messages] of validHistories.entries()) {
        for (const [label, run] of [
          ['chat-fast', () => runFast({ maxTokens: 4096, token: 'answer', body: { messages } })],
          ['chat', () => runChat({ maxTokens: 4096, body: { messages } })],
        ]) {
          const result = await run();
          const cleanMessages = result.sent && result.sent.messages;
          const noUnknownNested = cleanMessages && !JSON.stringify(cleanMessages).includes('ignored');
          if (result.calls === 1 && Array.isArray(cleanMessages)
              && cleanMessages[cleanMessages.length - 1].role === 'user' && noUnknownNested) {
            pass('A6 ' + label + ' accepts valid user-ending history ' + index + ' and strips nested unknowns');
          } else fail('A6 ' + label + ' rejected or leaked valid history ' + index);
        }
      }

      const invalidHistories = [
        [],
        [{ role: 'system', content: 'probe' }],
        [{ role: 'tool', content: 'probe' }],
        [null],
        [{ role: 'user', content: 7 }],
        [{ role: 'user', content: {} }],
        [{ role: 'user', content: [{ type: 'tool_use', name: 'x' }] }],
        [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'prefill' }],
        [{ role: 'assistant', content: 'prefill' }],
      ];
      for (const [index, messages] of invalidHistories.entries()) {
        for (const [label, run] of [
          ['chat-fast', () => runFast({ maxTokens: 4096, token: 'answer', body: { messages } })],
          ['chat', () => runChat({ maxTokens: 4096, body: { messages } })],
        ]) {
          const result = await run();
          if (result.calls === 0 && result.sent === null && result.res.statusCode === 400) {
            pass('A6 ' + label + ' rejects invalid/prefill history ' + index + ' before provider');
          } else fail('A6 ' + label + ' relayed invalid/prefill history ' + index);
        }
      }

      const forged = await runFast({
        maxTokens: 8,
        body: {
          model: 'client-forged-model', role: 'premium', tier: 'premium', mode: 'deep',
          classifier: false, premium: true, depth: 'deep',
        },
      });
      if (forged.sent && forged.sent.model === 'call-mode-standard-sentinel'
          && promptText(forged.sent) === CLASSIFIER_SYSTEM_PROMPT) {
        pass('A6 forged role/tier/mode/classifier/premium/depth fields cannot change model or role');
      } else fail('A6 forged client fields changed provider model or classifier prompt');

      for (const [label, value] of [['zero', 0], ['null', null], ['false', false], ['empty-string', '']]) {
        const cappedAnswer = await runFast({ maxTokens: value, founderHeader: false });
        if (cappedAnswer.calls === 0 && cappedAnswer.res.statusCode === 429
            && cappedAnswer.res.__emptyAnswerGuarded === true) {
          pass('A6 noncanonical ' + label + ' executes answer-only cap and makes zero provider calls');
        } else fail('A6 noncanonical ' + label + ' bypassed answer-only policy');
      }

      delete process.env.MODEL_STANDARD;
      const legacy = await runFast({ maxTokens: 8 });
      delete process.env.MODEL;
      const fallback = await runFast({ maxTokens: 4096 });
      if (legacy.sent && legacy.sent.model === 'call-mode-legacy-sentinel'
          && fallback.sent && fallback.sent.model === 'claude-sonnet-5') {
        pass('A6 STANDARD resolver precedence remains MODEL_STANDARD -> MODEL -> Sonnet 5');
      } else fail('A6 STANDARD resolver precedence changed');
    } finally {
      delete process.env.MODEL_STANDARD;
      delete process.env.MODEL;
      delete process.env.MODEL_FAST;
      delete process.env.MODEL_PREMIUM;
    }

    if (!/process\.env\.MODEL_FAST|process\.env\.MODEL_PREMIUM/.test(fastSrc)) {
      pass('A6 api/chat-fast.js has no FAST or PREMIUM environment resolver');
    } else fail('A6 api/chat-fast.js still reads a FAST or PREMIUM model variable');
    const rolePredicates = fastSrc.match(/requestedMaxTokens === CLASSIFIER_MAX_TOKENS/g) || [];
    if (rolePredicates.length === 1
        && !/Number\([^\n]*max_tokens[^\n]*\)\s*(?:<=|===)\s*CLASSIFIER_MAX_TOKENS/.test(fastSrc)
        && !/(?:parsed|outgoingBody)[^\n]*max_tokens[^\n]*(?:<=|===)\s*CLASSIFIER_MAX_TOKENS/.test(fastSrc)) {
      pass('A6 role is computed once from the original exact numeric 8 without coercion or recomputation');
    } else fail('A6 role predicate is duplicated, coercive, or based on sanitized max_tokens');

    // Tashkeel is an internal pronunciation transform, not an authored user answer. Capture the
    // request body built by the real handler and pin its existing, deliberately separate Haiku id.
    sent = null;
    const tashkeel = (await import(pathToUrl('api/tashkeel.js'))).default;
    const tashkeelRes = mkRes();
    await tashkeel({
      method: 'POST', headers: mkReq().headers,
      body: { text: 'نص', gender: 'male', band: 'adult' },
    }, tashkeelRes);
    if (sent && sent.model === 'claude-haiku-4-5') {
      pass('A7 api/tashkeel.js keeps its unchanged Haiku id');
    } else fail('A7 api/tashkeel.js model = ' + (sent && sent.model));
  } finally {
    global.fetch = realFetch;
  }
}

function pathToUrl(rel) {
  return require('url').pathToFileURL(path.resolve(process.cwd(), rel)).href;
}

// ===========================================================================
// CHECK D -- the complete model map, EXECUTED at the provider boundary
// ===========================================================================
async function checkModelRouting() {
  const SONNET = 'claude-sonnet-5';
  const OPUS = 'claude-opus-5';
  const HAIKU = 'claude-haiku-4-5-20251001';
  const STANDARD_SENTINEL = 'call-mode-ask-standard-sentinel';
  const PREMIUM_SENTINEL = 'call-mode-ask-premium-sentinel';
  const envKeys = [
    'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET',
    'MODEL', 'MODEL_STANDARD', 'MODEL_PREMIUM', 'MODEL_FAST', 'TASHKEEL_MODEL',
    'LEDGER_RAG', 'RFC_V05_MODE', 'DAILY_SEARCH_BUDGET',
    'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  ];
  const saved = envKeys.map((k) => [k, Object.prototype.hasOwnProperty.call(process.env, k), process.env[k]]);
  const realFetch = global.fetch;

  const DAY = await import(pathToUrl('lib/daycap.js'));
  const CONSENT = await import(pathToUrl('lib/ai-consent.js'));
  const LEDGER_REDIS = await import(pathToUrl('lib/ledger/redis.js'));
  const FLAG = await import(pathToUrl('lib/ledger/flag.js'));

  for (const k of ['MODEL', 'MODEL_STANDARD', 'MODEL_PREMIUM', 'MODEL_FAST', 'TASHKEEL_MODEL',
    'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  process.env.BRAVE_API_KEY = 'test-brave-not-real';
  process.env.FOUNDER_SECRET = 'model-routing-guard-secret';
  process.env.DAILY_SEARCH_BUDGET = '1000';
  process.env.MODEL_STANDARD = STANDARD_SENTINEL;
  process.env.MODEL_PREMIUM = PREMIUM_SENTINEL;
  process.env.MODEL = 'call-mode-ask-legacy-sentinel';
  process.env.MODEL_FAST = 'call-mode-ask-fast-sentinel';

  const DEVICE = 'modelroutingguarddevice01';
  const capCounts = new Map();
  DAY.__setRedisForTest({
    async sismember() { return 0; },
    async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
    pipeline() {
      const ops = [];
      return {
        incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); return this; },
        expire() { ops.push(() => 1); return this; },
        async exec() { return ops.map((f) => f()); },
      };
    },
  });

  const ledgerStore = new Map();
  ledgerStore.set(FLAG.RUNTIME_KEY, 'on');
  LEDGER_REDIS.__setRedisForTest({
    async get(k) { return ledgerStore.has(k) ? ledgerStore.get(k) : null; },
    async set(k, v, o) { ledgerStore.set(k, v); if (o && o.ex) ledgerStore.set(k + ':ex', o.ex); return 'OK'; },
    async incr(k) { const n = (Number(ledgerStore.get(k)) || 0) + 1; ledgerStore.set(k, n); return n; },
    async expire(k, s) { ledgerStore.set(k + ':ex', s); return 1; },
    async eval(_script, keys, args) {
      const k = keys[0];
      const used = (Number(ledgerStore.get(k)) || 0) + 1;
      ledgerStore.set(k, used);
      if (used === 1) ledgerStore.set(k + ':ex', Number(args[1]));
      return [used, used <= Number(args[0]) ? 1 : 0];
    },
  });

  const modelBodies = [];
  let transportMode = 'legacy-gen';
  const PLAN = {
    issues: [{
      issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
      protected_entities: ['قتل النمل'], core_terms: ['حكم'], context_vars: [],
      exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
    }],
    missing_qualifiers: [], confidence: 'high',
  };
  const PAGE_URL = 'https://islamqa.info/ar/answers/9101/x';
  const PAGE_HTML = '<html lang="ar"><head><title>حكم قتل النمل</title></head><body><article>'
    + '<h1>حكم قتل النمل</h1>'
    + '<p>الحكم في هذه المسألة أن الأصل عدم قتل النمل من غير حاجة، ويدفع ضرره بالوسيلة الأخف.</p>'
    + '<p>وإن حصل منه ضرر ظاهر ولم يمكن دفعه بغير القتل جاز دفع الضرر بقدره من غير تعد.</p>'
    + '<p>وهذا التفصيل يجمع بين الرفق بالحيوان ودفع الضرر، ولا يتجاوز الحاجة التي وقعت.</p>'
    + '<p>وينبغي ابتداء استعمال الوسائل التي تمنع دخولها وترفع الطعام عنها قبل الانتقال إلى غير ذلك.</p>'
    + '</article></body></html>';

  const jsonResponse = (payload) => ({
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => payload, text: async () => JSON.stringify(payload),
  });
  const streamResponse = (answer = 'ok') => {
    const wire = 'data: ' + JSON.stringify({
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: answer },
    }) + '\n\ndata: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';
    let sent = false;
    return {
      ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
      body: { getReader: () => ({
        read: async () => (sent ? { done: true, value: undefined }
          : (sent = true, { done: false, value: new Uint8Array(Buffer.from(wire, 'utf8')) })),
        releaseLock() {}, cancel: async () => {},
      }) },
    };
  };
  const htmlResponse = (url) => ({
    ok: true, status: 200, url,
    headers: { get: (h) => {
      const k = String(h).toLowerCase();
      if (k === 'content-type') return 'text/html; charset=utf-8';
      if (k === 'content-length') return String(Buffer.byteLength(PAGE_HTML, 'utf8'));
      return null;
    } },
    text: async () => PAGE_HTML, arrayBuffer: async () => Buffer.from(PAGE_HTML, 'utf8'),
  });

  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u === '/pipeline' && opts && opts.method === 'POST') {
      return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('api.anthropic.com')) {
      const body = JSON.parse((opts && opts.body) || '{}');
      modelBodies.push(body);
      if (transportMode === 'ranker' && body.max_tokens === 16) {
        return jsonResponse({ content: [{ type: 'text', text: '1' }], stop_reason: 'end_turn' });
      }
      if (transportMode === 'legacy-tool' && Array.isArray(body.tools)) {
        return jsonResponse({
          content: [{ type: 'tool_use', id: 'tool_guard_1', name: 'search_islamic_sources', input: { query: 'الوضوء' } }],
          stop_reason: 'tool_use', usage: { output_tokens: 10 },
        });
      }
      if (transportMode === 'ledger') {
        const user = String((((body.messages || [])[0] || {}).content) || '');
        const reply = user.includes('"issue_id"') ? PLAN : { claims: [] };
        return jsonResponse({ content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { output_tokens: 20 } });
      }
      return body.stream ? streamResponse() : jsonResponse({ content: [{ type: 'text', text: 'ok' }] });
    }
    if (u.includes('api.search.brave.com')) {
      return jsonResponse({ web: { results: transportMode === 'ledger'
        ? [{ url: PAGE_URL, title: 'حكم قتل النمل', description: '' }] : [] } });
    }
    if (transportMode === 'ranker' && u === 'https://shekhcp.binothaimeen.net/api/search-data'
        && opts && opts.method === 'POST') {
      return jsonResponse({ data: [
        { id: 'rank-1', title: { ar: 'حكم الوضوء' }, content: { ar: 'حكم الوضوء' } },
        { id: 'rank-2', title: { ar: 'صفة الوضوء' }, content: { ar: 'صفة الوضوء' } },
      ] });
    }
    if (transportMode === 'ranker'
        && u.startsWith('https://shekhapi.binothaimeen.net/lessons/audios/show/rank-')) {
      const first = u.includes('/rank-1/');
      return jsonResponse({ data: {
        title: { ar: first ? 'حكم الوضوء' : 'صفة الوضوء' },
        objective: { content: { ar: '<p>الوضوء عبادة معلومة، وهذا نص منشور يشرح حكم الوضوء وصفته وشروطه شرحا واضحا.</p>' } },
      } });
    }
    if (u.split('#')[0] === PAGE_URL) return htmlResponse(u);
    // The rate-limit clients are intentionally offline. Their production contract is fail-open;
    // no other unexpected host is allowed to masquerade as a provider fixture.
    throw new Error('offline model-routing fixture: ' + u.slice(0, 80));
  };

  const mkRes = () => {
    const r = {
      statusCode: 200, headers: {}, chunks: [], ended: false,
      status(c) { r.statusCode = c; return r; },
      setHeader(k, v) { r.headers[String(k).toLowerCase()] = v; return r; },
      getHeader(k) { return r.headers[String(k).toLowerCase()]; },
      get headersSent() { return r.chunks.length > 0 || r.ended; },
      flushHeaders() {},
      write(c) { r.chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); return true; },
      end(c) { if (c) r.chunks.push(Buffer.from(c)); r.ended = true; return r; },
      json(o) { r.chunks.push(Buffer.from(JSON.stringify(o))); r.ended = true; return r; },
      on() { return r; }, once() { return r; }, removeListener() { return r; },
    };
    return r;
  };
  let requestNo = 0;
  const mkReq = ({ question, age = 25, band = 'adult', extra = {}, authorized = false }) => {
    requestNo++;
    const headers = {
      'content-type': 'application/json', 'x-real-ip': '127.0.0.1',
      [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION,
      [DAY.DEVICE_HEADER]: DEVICE + String(requestNo).padStart(2, '0'),
    };
    // A founder token is bound to its device id. Mint after the per-request suffix is known.
    if (authorized) headers[DAY.FOUNDER_HEADER] = DAY.founderTokenFor(headers[DAY.DEVICE_HEADER]);
    return {
      method: 'POST', headers,
      body: Object.assign({
        max_tokens: 256, stream: true, name: 'guard', age, gender: 'male', mode: 'chat', band,
        messages: [{ role: 'user', content: question }],
      }, extra),
      socket: { remoteAddress: '127.0.0.1' }, on() {},
    };
  };
  const systemText = (body) => Array.isArray(body && body.system)
    ? body.system.map((b) => (b && b.text) || '').join('') : String((body && body.system) || '');
  const firstModel = (bodies) => bodies[0] && bodies[0].model;
  const isPlanner = (body) => String(((((body || {}).messages || [])[0] || {}).content) || '').includes('"issue_id"');

  try {
    const ASK = await import(pathToUrl('api/ask.js'));
    const STORED = await import(pathToUrl('lib/stored-deen.js'));
    const handler = ASK.default;
    const askSource = read('api/ask.js') || '';
    if (/const STANDARD_MODEL\s*=\s*process\.env\.MODEL_STANDARD\s*\|\|\s*process\.env\.MODEL\s*\|\|\s*'claude-sonnet-5'/.test(askSource)
        && /process\.env\.MODEL_PREMIUM\s*\|\|\s*process\.env\.MODEL\s*\|\|\s*'claude-opus-5'/.test(askSource)) {
      pass('D0 ask role resolvers retain dedicated -> legacy -> exact Model-5 fallback precedence');
    } else fail('D0 ask standard/premium resolver precedence changed');
    const drive = async (request, mode) => {
      transportMode = mode;
      modelBodies.length = 0;
      if (mode === 'ledger') {
        process.env.LEDGER_RAG = 'on';
        process.env.RFC_V05_MODE = 'public';
        ledgerStore.set(FLAG.RUNTIME_KEY, 'on');
      } else {
        process.env.LEDGER_RAG = 'off';
        process.env.RFC_V05_MODE = 'off';
      }
      FLAG.__resetFlagCacheForTest();
      const res = mkRes();
      await handler(request, res);
      return { bodies: modelBodies.slice(), res };
    };

    const ordinary = await drive(mkReq({
      question: 'كم يساوي اثنان زائد اثنان؟', extra: {
        depth: 'brief', model: 'client-model-canary', system: 'client-system-canary',
        temperature: 0.2, top_p: 0.8, top_k: 3,
        thinking: { type: 'enabled', budget_tokens: 1024 },
        tools: [{ name: 'client_tool' }], tool_choice: { type: 'any' },
        metadata: { user_id: 'client' }, stop_sequences: ['CLIENT_STOP'],
        unknown_provider_canary: true,
      },
    }), 'legacy-gen');
    if (firstModel(ordinary.bodies) === STANDARD_SENTINEL) pass('D1 ordinary/default/brief answer sends the STANDARD resolver');
    else fail('D1 ordinary/default/brief model = ' + firstModel(ordinary.bodies));
    const ordinaryKeys = Object.keys(ordinary.bodies[0] || {}).sort().join(',');
    if (ordinaryKeys === 'max_tokens,messages,model,stream,system'
        && ordinary.bodies[0].thinking === undefined) {
      pass('D1 ask ordinary envelope contains only server-owned provider keys');
    } else fail('D1 ask ordinary provider keys = ' + ordinaryKeys);

    const strictBudget = (value, missing = false) => !missing && typeof value === 'number'
      && Number.isFinite(value) && Number.isInteger(value) && value > 0
      ? Math.min(value, 4096) : 4096;
    const askTokenCases = [
      ['negative', -1, false], ['zero', 0, false], ['nan', NaN, false],
      ['infinity', Infinity, false], ['negative-infinity', -Infinity, false],
      ['decimal', 1.5, false], ['string', '8', false], ['null', null, false],
      ['missing', undefined, true], ['numeric-8', 8, false], ['numeric-9', 9, false],
      ['huge', 64000, false],
    ];
    for (const [label, value, missing] of askTokenCases) {
      const request = mkReq({ question: 'What is two plus two?' });
      if (missing) delete request.body.max_tokens;
      else request.body.max_tokens = value;
      const out = await drive(request, 'legacy-gen');
      const provider = out.bodies[0];
      if (out.bodies.length === 1 && provider && provider.max_tokens === strictBudget(value, missing)
          && Number.isInteger(provider.max_tokens) && provider.max_tokens > 0
          && provider.max_tokens <= 4096 && provider.model === STANDARD_SENTINEL
          && provider.thinking === undefined) {
        pass('D1 ask token ' + label + ' is a positive bounded STANDARD answer');
      } else fail('D1 ask token ' + label + ' leaked an invalid budget or envelope');
    }

    const askValidHistories = [
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'What is two plus two?' },
      ],
      [{
        role: 'user', ignored: true, content: [
          { type: 'document', ignored: true, source: {
            type: 'base64', media_type: 'application/pdf', data: 'YWJj', ignored: true,
          } },
          { type: 'text', text: 'What is two plus two?', ignored: true },
        ],
      }],
    ];
    for (const [index, messages] of askValidHistories.entries()) {
      const out = await drive(mkReq({ question: 'unused', extra: { messages } }), 'legacy-gen');
      const upstreamMessages = out.bodies[0] && out.bodies[0].messages;
      if (out.bodies.length === 1 && Array.isArray(upstreamMessages)
          && upstreamMessages[upstreamMessages.length - 1].role === 'user'
          && !JSON.stringify(upstreamMessages).includes('ignored')) {
        pass('D1 ask accepts valid user-ending history ' + index + ' and strips nested unknowns');
      } else fail('D1 ask rejected or leaked valid history ' + index);
    }

    const askInvalidHistories = [
      [], [{ role: 'system', content: 'probe' }], [{ role: 'tool', content: 'probe' }],
      [null], [{ role: 'user', content: 7 }], [{ role: 'user', content: {} }],
      [{ role: 'user', content: [{ type: 'tool_use', name: 'x' }] }],
      [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'prefill' }],
      [{ role: 'assistant', content: 'prefill' }],
    ];
    for (const [index, messages] of askInvalidHistories.entries()) {
      const out = await drive(mkReq({ question: 'unused', extra: { messages } }), 'legacy-gen');
      if (out.bodies.length === 0 && out.res.statusCode === 400) {
        pass('D1 ask rejects invalid/prefill history ' + index + ' before provider');
      } else fail('D1 ask relayed invalid/prefill history ' + index);
    }

    const deep = await drive(mkReq({
      question: 'كم يساوي اثنان زائد اثنان؟', extra: { depth: 'deep' }, authorized: true,
    }), 'legacy-gen');
    if (firstModel(deep.bodies) === PREMIUM_SENTINEL) pass('D2 authorized founder deep sends the PREMIUM resolver');
    else fail('D2 authorized founder deep model = ' + firstModel(deep.bodies));

    const forged = [
      ['deep', { depth: 'deep' }],
      ['scholar', { depth: 'scholar' }],
      ['premium', { tier: 'premium' }],
      ['combined-student', {
        depth: 'scholar', tier: 'premium', premium: true, student: true,
        model: PREMIUM_SENTINEL, role: 'premium', mode: 'scholar',
      }],
    ];
    for (const [label, extra] of forged) {
      const out = await drive(mkReq({
        question: 'كم يساوي اثنان زائد اثنان؟', extra,
      }), 'legacy-gen');
      if (firstModel(out.bodies) === STANDARD_SENTINEL) pass('D3 forged ' + label + ' stays on the STANDARD resolver');
      else fail('D3 forged ' + label + ' model = ' + firstModel(out.bodies));
      if (!systemText(out.bodies[0]).includes(ASK.buildDepthInstruction('scholar'))) {
        pass('D3 forged ' + label + ' gets no scholar capability');
      } else fail('D3 forged ' + label + ' reached the scholar instruction');
    }

    // Observe the real lazy encyclopedia read. A founder token alone is insufficient: the
    // current age policy must also resolve the request to adult before that module is touched.
    const moduleBuiltin = require('module');
    const realReadFileSync = fs.readFileSync;
    let encyclopediaReads = 0;
    fs.readFileSync = function guardedRead(file, ...args) {
      if (/fiqh-search\.json\.gz$/i.test(String(file))) encyclopediaReads++;
      return realReadFileSync.call(fs, file, ...args);
    };
    moduleBuiltin.syncBuiltinESMExports();
    try {
      const youngScholar = await drive(mkReq({
        question: 'ما حكم الوضوء؟', age: 12, band: 'adult',
        extra: { depth: 'scholar' }, authorized: true,
      }), 'legacy-tool');
      if (firstModel(youngScholar.bodies) === STANDARD_SENTINEL) pass('D4 under-age scholar request stays on the STANDARD resolver');
      else fail('D4 under-age scholar model = ' + firstModel(youngScholar.bodies));
      const storedScholarInstruction = STORED.storedAnswerProfile('scholar').length;
      if (youngScholar.bodies.length > 0
          && youngScholar.bodies.every((body) => body.model === STANDARD_SENTINEL)
          && youngScholar.bodies.every((body) => !systemText(body).includes(storedScholarInstruction))
          && encyclopediaReads > 0) {
        pass('D4 under-age scholar request shares stored evidence but opens no scholar capability');
      } else fail('D4 under-age stored/model policy drifted (encyclopedia reads=' + encyclopediaReads + ')');

      const adultScholar = await drive(mkReq({
        question: 'ما حكم الوضوء؟', age: 25, band: 'adult',
        extra: { depth: 'scholar' }, authorized: true,
      }), 'legacy-tool');
      if (firstModel(adultScholar.bodies) === PREMIUM_SENTINEL) pass('D5 authorized adult scholar sends the PREMIUM resolver');
      else fail('D5 authorized adult scholar model = ' + firstModel(adultScholar.bodies));
      if (adultScholar.bodies.length > 0
          && adultScholar.bodies.every((body) => body.model === PREMIUM_SENTINEL)
          && adultScholar.bodies.some((body) => systemText(body).includes(storedScholarInstruction))
          && encyclopediaReads > 0) {
        pass('D5 authorized adult scholar keeps the scholar stored profile and shared evidence policy');
      } else fail('D5 adult scholar capability missing (encyclopedia reads=' + encyclopediaReads + ')');

      const ranked = await drive(mkReq({
        question: 'هل أفتى الشيخ محمد بن صالح العثيمين بأن من أسقطت قبل ثمانين يوما تترك الصلاة؟ — شرح حديث',
        age: 25, band: 'adult',
      }), 'ranker');
      const rankBodies = ranked.bodies.filter((body) => body.max_tokens === 16);
      if (rankBodies.length === 1
          && rankBodies[0].model === STANDARD_SENTINEL
          && rankBodies[0].stream === false
          && JSON.stringify(rankBodies[0].thinking) === JSON.stringify({ type: 'disabled' })
          && Object.keys(rankBodies[0]).sort().join(',')
            === 'max_tokens,messages,model,stream,system,thinking') {
        pass('D5 attributed-title ranker uses one minimal 16-token STANDARD envelope with thinking disabled');
      } else fail('D5 title-ranker envelope = ' + JSON.stringify(rankBodies.map((b) => Object.keys(b).sort())));
    } finally {
      fs.readFileSync = realReadFileSync;
      moduleBuiltin.syncBuiltinESMExports();
    }

    // Drive the public Ledger path through api/ask.js. D6 deliberately has no founder header:
    // its forged depth/tier fields must leave EVERY provider body on the server-owned Standard
    // channel, including the planner. D7 below keeps the authorized positive controls unchanged.
    const driveLedger = async (extra, authorized) => {
      const request = mkReq({
        // Ordinary GENERAL questions are router-first and cannot enter Ledger.  Use an
        // unregistered hadith-grading turn so this resolver test still drives the real
        // post-router Ledger seam (the intentions hadith is handled by the local registry).
        question: 'ما صحة حديث النهي عن قتل النمل؟', age: 25, band: 'adult', extra, authorized,
      });
      return { ...(await drive(request, 'ledger')), request };
    };
    let d6Tier = null;
    const d6OriginalLog = console.log;
    console.log = (label, value, ...rest) => {
      if (label === '[tier]' && value && typeof value === 'object') d6Tier = { ...value };
      d6OriginalLog(label, value, ...rest);
    };
    let ledgerStandard;
    try {
      ledgerStandard = await driveLedger({ depth: 'scholar', tier: 'premium' }, false);
    } finally {
      console.log = d6OriginalLog;
    }
    const standardPlans = ledgerStandard.bodies.filter(isPlanner);
    const standardStages = ledgerStandard.bodies.filter((b) => !isPlanner(b));
    if (!Object.prototype.hasOwnProperty.call(ledgerStandard.request.headers, DAY.FOUNDER_HEADER)) {
      pass('D6 enters through api/ask with the forged request still unauthenticated');
    } else fail('D6 fixture unexpectedly carries a founder credential');
    if (d6Tier && d6Tier.founderUnlocked === false && d6Tier.usePremium === false) {
      pass('D6 real handler authorization keeps the forged request Standard');
    } else fail('D6 handler tier decision = ' + JSON.stringify(d6Tier));
    if (standardPlans.length && standardPlans.every((b) => b.model === STANDARD_SENTINEL)) pass('D6 Ledger planner inherits the server-owned STANDARD resolver');
    else fail('D6 Ledger planner models = ' + JSON.stringify(standardPlans.map((b) => b.model)));
    if (standardStages.length && standardStages.every((b) => b.model === STANDARD_SENTINEL)) {
      pass('D6 forged Ledger premium/depth stays on standard Sonnet stages');
    } else fail('D6 forged Ledger downstream models = ' + JSON.stringify(standardStages.map((b) => b.model)));
    if (ledgerStandard.bodies.length === 2
        && ledgerStandard.bodies.every((body) => body.model === STANDARD_SENTINEL)) {
      pass('D6 every provider body for the forged request is Standard');
    } else fail('D6 provider bodies = ' + JSON.stringify(ledgerStandard.bodies.map((b) => b.model)));
    if (ledgerStandard.bodies.filter((body) => body.model === PREMIUM_SENTINEL).length === 0) {
      pass('D6 forged request has zero Premium bodies, including planner repair/retry');
    } else fail('D6 forged request reached Premium');

    for (const depth of ['deep', 'scholar']) {
      const premium = await driveLedger({ depth }, true);
      const plans = premium.bodies.filter(isPlanner);
      const stages = premium.bodies.filter((b) => !isPlanner(b));
      if (plans.length && plans.every((b) => b.model === PREMIUM_SENTINEL)) pass('D7 Ledger ' + depth + ' planner uses the PREMIUM resolver');
      else fail('D7 Ledger ' + depth + ' planner models = ' + JSON.stringify(plans.map((b) => b.model)));
      if (stages.length && stages.every((b) => b.model === PREMIUM_SENTINEL)) pass('D7 authorized Ledger ' + depth + ' stages use the PREMIUM resolver');
      else fail('D7 authorized Ledger ' + depth + ' downstream models = ' + JSON.stringify(stages.map((b) => b.model)));
    }

    // Pin the resolver itself through the same callModel function every Ledger stage invokes.
    // This is not a string inspection: fetchImpl records the body immediately before the request.
    const MODEL = await import(pathToUrl('lib/ledger/model.js'));
    const BUDGET = await import(pathToUrl('lib/ledger/budgets.js'));
    const direct = [];
    const directFetch = async (_url, init) => {
      direct.push(JSON.parse(init.body));
      return jsonResponse({ content: [{ type: 'text', text: '{}' }], usage: { output_tokens: 1 } });
    };
    let tick = 1770000000000;
    await MODEL.callModel({
      system: 's', user: 'u', purpose: 'guard-standard', tier: 'standard', fetchImpl: directFetch,
      budget: new BUDGET.Budget({ now: () => ++tick }),
    });
    await MODEL.callModel({
      system: 's', user: 'u', purpose: 'guard-premium', tier: 'premium', fetchImpl: directFetch,
      budget: new BUDGET.Budget({ now: () => ++tick }),
    });
    if (direct[0] && direct[0].model === STANDARD_SENTINEL) pass('D8 Ledger standard resolver uses MODEL_STANDARD');
    else fail('D8 Ledger standard resolver model = ' + (direct[0] && direct[0].model));
    if (direct[1] && direct[1].model === PREMIUM_SENTINEL) pass('D8 Ledger premium resolver uses MODEL_PREMIUM');
    else fail('D8 Ledger premium resolver model = ' + (direct[1] && direct[1].model));
    if (direct.length === 2 && direct.every((body) =>
      Object.keys(body).sort().join(',') === 'max_tokens,messages,model,stream,system'
      && Number.isInteger(body.max_tokens) && body.max_tokens > 0 && body.max_tokens <= 3000
      && body.stream === false && body.thinking === undefined
      && Array.isArray(body.messages) && body.messages.length === 1
      && body.messages[0].role === 'user')) {
      pass('D8 Ledger envelopes stay minimal with positive server-owned budgets and no thinking');
    } else fail('D8 Ledger envelope keys or budgets changed');
    if (HAIKU === 'claude-haiku-4-5-20251001') pass('D9 fast-model control id stayed byte-exact');
  } finally {
    global.fetch = realFetch;
    DAY.__setRedisForTest(null);
    LEDGER_REDIS.__resetRedis();
    FLAG.__resetFlagCacheForTest();
    for (const [k, had, v] of saved) { if (had) process.env[k] = v; else delete process.env[k]; }
  }
}

// ===========================================================================
// CHECK B -- the client message maps, EXECUTED
// ===========================================================================
function checkMessages(html) {
  const sandbox = {};

  const friendly = extractDecl(html, 'const FRIENDLY_ERRORS = ');
  const stt = extractDecl(html, 'const sttErrorMessage = (status) => ');
  const mic = extractDecl(html, 'const micErrorMessage = (e) => ');
  if (!friendly) { fail('B0 FRIENDLY_ERRORS not found in ' + indexFile); return; }
  if (!stt) { fail('B0 sttErrorMessage not found in ' + indexFile + ' (the /api/stt failure map is gone)'); return; }
  if (!mic) { fail('B0 micErrorMessage not found in ' + indexFile + ' (the microphone failure map is gone)'); return; }
  pass('B0 all three message maps found and extractable');

  try {
    // eslint-disable-next-line no-new-func
    const run = new Function(friendly + '\n' + stt + '\n' + mic + '\n' +
      'return { FRIENDLY_ERRORS, sttErrorMessage, micErrorMessage };');
    Object.assign(sandbox, run());
  } catch (e) {
    fail('B0 extracted message maps do not evaluate: ' + e.message);
    return;
  }

  const FE = sandbox.FRIENDLY_ERRORS;
  const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 8;

  // B1: the technical bucket exists, in both genders, and is NOT the "I did not understand
  // your question" line. That line is the whole bug: it blames the child for our 400.
  if (FE && FE.technical && nonEmpty(FE.technical.male) && nonEmpty(FE.technical.female)) {
    pass('B1 FRIENDLY_ERRORS.technical present for both genders');
    if (FE.technical.male !== FE.general.male && FE.technical.female !== FE.general.female) {
      pass('B1 technical wording is DISTINCT from the general "did not understand" wording');
    } else fail('B1 technical wording is identical to general -- the HTTP failure still blames the child');
  } else fail('B1 FRIENDLY_ERRORS.technical missing or incomplete');

  // B2: every /api/stt status maps to its own actionable sentence.
  const STATUSES = [400, 403, 413, 429, 500, 503];
  const seen = new Map();
  let sttOk = true;
  for (const s of STATUSES) {
    const m = sandbox.sttErrorMessage(s);
    if (!nonEmpty(m)) { fail('B2 sttErrorMessage(' + s + ') is empty -- a silent failure by another name'); sttOk = false; continue; }
    seen.set(s, m);
  }
  if (sttOk) pass('B2 sttErrorMessage returns a real sentence for ' + STATUSES.join('/'));
  if (seen.get(429) && seen.get(500) && seen.get(429) !== seen.get(500)) pass('B2 a rate limit and an outage do not read the same');
  else fail('B2 sttErrorMessage(429) and sttErrorMessage(500) are indistinguishable');

  // B3: a DENIED microphone must name the permission -- it is the only failure the user can fix.
  const denied = sandbox.micErrorMessage({ name: 'NotAllowedError' });
  const generic = sandbox.micErrorMessage({ name: 'WhateverError' });
  const missing = sandbox.micErrorMessage({ name: 'NotFoundError' });
  if (nonEmpty(denied) && nonEmpty(generic) && nonEmpty(missing)) pass('B3 micErrorMessage answers denied/absent/unknown with real sentences');
  else fail('B3 micErrorMessage returned an empty message for one of denied/absent/unknown');
  if (denied !== generic && denied !== missing) pass('B3 a DENIED permission is distinguishable from a broken/absent device');
  else fail('B3 a denied permission reads the same as a missing device -- the user cannot act on it');
  // The denial message must tell the user where to go. Needle is a bare word, never printed.
  if (denied.indexOf('إعدادات') !== -1) pass('B3 the denial message points at the settings screen');
  else fail('B3 the denial message does not tell the user where to grant the permission');
}

// ===========================================================================
// CHECK C -- structure that cannot be executed outside a browser
// ===========================================================================
function checkStructure(html) {
  // C1: the cloud path is the LIVE path. If that flag ever goes false the SR gating below
  // is allowed to be strict again -- so state the assumption instead of assuming it.
  if (/const CALL_STT_CLOUD = true;/.test(html)) pass('C1 CALL_STT_CLOUD is on (cloud STT is the live path)');
  else { fail('C1 CALL_STT_CLOUD is not `true` -- re-derive this gate before shipping'); return; }

  // C2: the call screen must NOT be refused for a missing SpeechRecognition while the cloud
  // path is live. This is the check that was killing the whole feature on Android WebView.
  if (/if \(!SR && !CALL_STT_CLOUD\) \{/.test(html)) pass('C2 the SR bail-out is conditioned on !CALL_STT_CLOUD');
  else fail('C2 the call effect still bails on a missing SpeechRecognition regardless of CALL_STT_CLOUD');
  // The same invariant, through the shared factory: ezNewRecognition() returns NULL rather than
  // throwing when the browser has no engine -- and also when AI consent is absent, which is the
  // Apple 5.1.1(i) barrier. `rec` being null is the case the call effect already handles, so the
  // no-engine path and the no-consent path land on the one branch that was always correct.
  if (/const rec = ezNewRecognition\(\);/.test(html)) pass('C2 the recognizer is constructed only when an engine exists');
  else fail('C2 the recognizer is not built through ezNewRecognition -- the call effect can throw on engines without Web Speech');
  if (/const ezNewRecognition = \(\) => \{[\s\S]{0,400}?const SR = ezSpeechEngine\(\);\s*\r?\n\s*if \(!SR\) return null;/.test(html)) pass('C2 ...and that factory returns null instead of throwing when there is no engine');
  else fail('C2 the factory does not fail soft on a missing engine');
  if (/const ezNewRecognition = \(\) => \{\s*\r?\n\s*if \(!hasValidAIConsent\(\)\) return null;/.test(html)) pass('C2 ...and returns null before constructing anything when consent is absent');
  else fail('C2 the factory can construct a recognizer without AI consent');

  // C3: a getUserMedia rejection must SPEAK. The old body was `catch (e) { ...setCallState('idle'); }`.
  const startAt = html.indexOf('const startCloudListening = async () => {');
  if (startAt === -1) { fail('C3 startCloudListening not found'); }
  else {
    const body = braceSlice(html, startAt);
    if (body && /catch \(e\) \{[\s\S]*showCallError\(micErrorMessage\(e\)\)/.test(body)) {
      pass('C3 a microphone failure raises a named error instead of falling silent');
    } else fail('C3 startCloudListening still swallows its microphone failure');
    if (body && /stopCloudAll\(\);/.test(body)) pass('C3 a failed start releases the half-opened capture');
    else fail('C3 a failed start leaks the capture graph');
  }

  // C4: a FAILED /api/stt must not be answered by re-opening the microphone. That loop is
  // what made a dead vendor key look like a call that listened forever and answered nothing.
  const stopAt = html.indexOf('const stopCloudTurn = async () => {');
  if (stopAt === -1) { fail('C4 stopCloudTurn not found'); }
  else {
    const body = braceSlice(html, stopAt);
    if (!body) fail('C4 stopCloudTurn body unreadable');
    else {
      if (/sttError = sttErrorMessage\(r\.status\)/.test(body)) pass('C4 a non-OK /api/stt is turned into a message');
      else fail('C4 a non-OK /api/stt is still discarded');
      // Read the failure branch as a BLOCK, not by regex distance. index.html is CRLF-pinned,
      // so any lookahead written against a bare \n silently scans past the closing brace and
      // "finds" the legitimate restart that lives further down. Brace-count instead.
      const errAt = body.indexOf('if (sttError) {');
      const errBranch = errAt === -1 ? null : braceSlice(body, errAt);
      if (!errBranch) fail('C4 the sttError branch not found');
      else {
        if (/showCallError\(sttError\);/.test(errBranch) && /return;/.test(errBranch)) pass('C4 an STT failure ends the turn with a visible error');
        else fail('C4 an STT failure does not end the turn with a visible error');
        // The ONE legitimate restart is the silence path below -- never this one.
        if (/startCloudListening\(/.test(errBranch)) fail('C4 the STT-failure branch still re-opens the microphone');
        else pass('C4 the STT-failure branch does NOT re-open the microphone');
        if (/setCallState\('idle'\)/.test(errBranch)) pass('C4 the STT-failure branch returns the call to idle');
        else fail('C4 the STT-failure branch leaves the call stuck mid-state');
      }
      if (/if \(!text\) \{ startCloudListening\(\); return; \}/.test(body)) pass('C4 genuine silence (OK + empty text) still keeps listening');
      else fail('C4 the genuine-silence path no longer keeps listening');
      // An empty catch on this path is exactly the regression. Reject it by shape.
      if (/catch \(e\) \{\s*\}/.test(body)) fail('C4 stopCloudTurn contains an empty catch block');
      else pass('C4 stopCloudTurn has no empty catch block');
    }
  }

  // C5: a technical HTTP status must not answer with the "did not understand" line.
  if (/return getFriendlyError\('technical', p\.gender\);/.test(html)) pass('C5 the non-2xx fallback answers with the technical wording');
  else fail('C5 the non-2xx fallback does not use the technical wording');
  const okAt = html.indexOf('if (!response.ok) {');
  if (okAt !== -1) {
    const body = braceSlice(html, okAt);
    if (body && /getFriendlyError\('general'/.test(body)) fail('C5 the !response.ok branch STILL falls back to the general "did not understand" line');
    else pass('C5 the !response.ok branch never falls back to the general "did not understand" line');
  } else fail('C5 the !response.ok branch not found');

  // C6: an error raised during a call has to be rendered ON the call screen. It used to be
  // rendered only in the chat view -- written to a screen nobody was looking at.
  if (/<CallScreen[^>]*error=\{voiceError\}/.test(html)) pass('C6 the call screen receives voiceError');
  else fail('C6 the call screen is not given voiceError');
  if (/function CallScreen\(\{[^}]*\berror\b[^}]*\}\)/.test(html)) pass('C6 CallScreen accepts an error prop');
  else fail('C6 CallScreen does not accept an error prop');
  if (/\{error \? <div style=\{s\.callErrorBanner\}/.test(html)) pass('C6 CallScreen renders the error banner');
  else fail('C6 CallScreen does not render an error banner');
  if (/callErrorBanner: \{/.test(html)) pass('C6 callErrorBanner style exists');
  else fail('C6 callErrorBanner style missing');
}

// ===========================================================================
(async () => {
  const html = read(indexFile);
  if (html === null) abort('cannot read ' + indexFile);
  info(indexFile + ' = ' + html.length + ' chars');

  console.log('  -- CHECK A: relays (executed) --');
  await checkRelays();
  console.log('  -- CHECK B: message maps (executed) --');
  checkMessages(html);
  console.log('  -- CHECK C: call-path structure --');
  checkStructure(html);
  console.log('  -- CHECK D: complete model routing (executed) --');
  await checkModelRouting();

  console.log('  SUMMARY   PASS=' + P + '   FAIL=' + F);
  if (F > 0) {
    console.log('  -- FAILURES (call mode regressed) --');
    FAILS.forEach((m) => console.log('    * ' + m));
    process.exit(1);
  }
  console.log('  OK: call mode reachable without SpeechRecognition, no unsupported field on the wire, no silent failure.');
  process.exit(0);
})().catch((e) => {
  console.error('ABORT: ' + (e && e.stack ? e.stack : e));
  process.exit(2);
});
