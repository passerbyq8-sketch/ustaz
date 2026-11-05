// guards/security-admission-guard.cjs -- THE ADMISSION ORDER. /api/ask validates the body, throttles
// the address, counts the identity, and only THEN asks the global window; the audio routes draw
// their own family each, consult the per-IP pair before the global, and tell a refused caller
// when to come back; the day cap counts before it judges.
//
// THE MEASURED PROBLEM, 5 November 2026 (BRAIN36 diagnosis, REPORT-BRAIN36-DIAG-2026-11-05.md):
//   * /api/ask ran the limiter -- all three windows in one Promise.all -- BEFORE it parsed the
//     body, so POST {} with the public consent header charged the global day window of every
//     reader and was refused only afterwards (HARNESS-2 P1: three EVALSHAs, then 400). 20,000
//     empty posts from one address, at any rate, and the app was down until midnight UTC.
//   * a request the minute window refused, or the day cap refused afterwards, had already
//     charged the global (HARNESS-1 A2: GLOBAL_CHARGED=true; HARNESS-2 P5).
//   * api/stt.js drew the tts family, so a flood of recordings silenced playback (HARNESS-1 B7).
//   * a refused audio window answered 429 with no Retry-After; the audio routes read the address
//     from x-forwarded-for first while /api/ask read x-real-ip first.
//   * the day cap read, compared, then incremented: fifty parallel requests at a cap of ten were
//     all served (HARNESS-3 S2).
//
// WHAT THIS PINS (the fix, EZIK-ORDER-BRAIN36-FIX-2026-11-05.md, units U1 and U2):
//   1. the four shape refusals of /api/ask (no messages array, empty messages, invalid JSON,
//      invalid messages; an empty body is the first of them) answer 400 with the header
//      X-Murabbi-Refused: shape and issue ZERO limiter EVALSHAs;
//   2. a request the per-IP minute or day window refuses issues no ask:all:day EVALSHA;
//   3. the identity-required and day-cap-reached exits issue no ask:all:day EVALSHA;
//   4. an admitted request issues exactly ask:min, ask:day (not on a preview), then ask:all:day
//      AFTER the day cap counted it, in that order; a global refusal refunds the day cap;
//   5. /api/stt consumes aud:stt:* (80/900/1000) and never aud:tts:*;
//   6. a refused per-IP audio window issues no aud:*:all:day EVALSHA;
//   7. a 429 from /api/tts, /api/stt and /api/tashkeel carries Retry-After >= 1, and the three
//      routes read the address as /api/ask does (x-real-ip first);
//   8. fifty concurrent checkDayCap calls at a cap of ten for one identity allow exactly ten
//      and leave the counter at ten.
//   Each row has a mutant: a string replacement of the fixed line, loaded from a temp twin of
//   the source with its imports made absolute, that must turn the row red.
//
// HOW IT IS PROVED: the REAL modules are driven with one fake `globalThis.fetch` at the Upstash
// REST boundary (the technique of guards/preview-daycap-guard.cjs), which records every command
// in order and answers EVALSHA with `[remaining, limit]`, MGET/INCR/DECR from an in-memory
// counter map, and everything else with a harmless value; any other fetch is a vendor and is
// refused or thrown. Every per-IP identifier is unique per drive (the client caches a denied
// identifier until its window resets) and the one row that lets the global window REFUSE in the
// shipped module runs last, because that refusal is cached in-process until the next UTC midnight.
// Only limiter EVALSHAs are counted: the answer-log write is outside this guard's scope.
//
// Usage: node guards/security-admission-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- environment: no founder, the default cap, a production deployment -----------------------
process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || 'https://security-admission-guard.invalid';
process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || 'guard-not-a-real-token';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'guard-not-a-credential';
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'guard-not-a-credential';
delete process.env.FOUNDER_SECRET;
process.env.DAY_CAP = '10';
process.env.VERCEL_ENV = 'production';
process.env.VERCEL_URL = 'security-admission-guard.vercel.app';
const PREVIEW = { VERCEL_ENV: 'preview', VERCEL_URL: 'security-admission-preview.vercel.app' };

// ---- the fetch stub at the Upstash REST boundary ----------------------------------------------
let calls = [];                 // { kind:'upstash', cmd, key, tokens } | { kind:'vendor', url }
let refuse = () => false;       // (key) => should this window refuse?
let vendorThrows = false;
const counters = new Map();     // the day cap's counters, by key
const realFetch = globalThis.fetch;
function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(process.env.KV_REST_API_URL)) {
      let cmds = [];
      try { cmds = JSON.parse(String(init && init.body || '[]')); } catch { cmds = []; }
      const single = cmds.length && !Array.isArray(cmds[0]);
      if (single) cmds = [cmds];
      const out = cmds.map((c) => {
        const cmd = String(c[0]).toUpperCase();
        if (cmd === 'EVALSHA' || cmd === 'EVAL') {
          const key = String(c[3] || '');
          const tokens = Number(c[6]) || 1;
          calls.push({ kind: 'upstash', cmd, key, tokens });
          return { result: refuse(key) ? [-1, tokens] : [tokens - 1, tokens] };
        }
        const key = String(c[1] || '');
        calls.push({ kind: 'upstash', cmd, key });
        if (cmd === 'MGET') return { result: c.slice(1).map((k) => (counters.has(k) ? counters.get(k) : null)) };
        if (cmd === 'INCR') { counters.set(key, (counters.get(key) || 0) + 1); return { result: counters.get(key) }; }
        if (cmd === 'DECR') { counters.set(key, (counters.get(key) || 0) - 1); return { result: counters.get(key) }; }
        if (cmd === 'EXPIRE') return { result: 1 };
        if (cmd === 'SISMEMBER') return { result: 0 };
        if (cmd === 'SET' || cmd === 'LTRIM') return { result: 'OK' };
        if (cmd === 'LPUSH') return { result: 1 };
        return { result: null };
      });
      const body = single ? out[0] : out;
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) };
    }
    calls.push({ kind: 'vendor', url: u });
    if (vendorThrows) throw new Error('security-admission-guard: vendor unreachable');
    return { ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => 'guard vendor refusal', arrayBuffer: async () => new ArrayBuffer(0), body: null };
  };
}

function fakeRes() {
  const r = new EventEmitter();
  Object.assign(r, {
    code: 0, headers: {}, writes: [], body: undefined, ended: 0, headersSent: false, writableEnded: false, finished: false,
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    flushHeaders() { this.headersSent = true; },
    write(s) { this.headersSent = true; this.writes.push(Buffer.isBuffer(s) ? s.toString('utf8') : String(s)); return true; },
    end(s) { if (s) this.write(s); this.ended++; this.writableEnded = true; this.finished = true; this.emit('finish'); this.emit('close'); return this; },
    json(o) { this.body = o; this.writes.push(JSON.stringify(o)); return this.end(); },
    send(o) { this.body = o; return this.end(); },
  });
  return r;
}
const prefixOf = (k) => k.replace(/:(?:[0-9.]+|all|unknown):[0-9]+$/, '');
const isEval = (c) => c.kind === 'upstash' && (c.cmd === 'EVALSHA' || c.cmd === 'EVAL');
const evals = () => calls.filter(isEval).map((c) => prefixOf(c.key));
const evalTokens = () => calls.filter(isEval).map((c) => c.tokens);
const vendors = () => calls.filter((c) => c.kind === 'vendor');
const orderLine = () => calls.map((c) => c.kind === 'upstash' ? (isEval(c) ? 'EVALSHA ' + prefixOf(c.key) : c.cmd + (c.key.startsWith('dc:v1:') ? '(daycap)' : '')) : 'VENDOR').join(' > ');
const sseText = (res) => res.writes.join('').split('\n').filter((l) => l.startsWith('data:')).map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } }).filter((f) => f && f.delta && typeof f.delta.text === 'string').map((f) => f.delta.text).join('');
let ipSeq = 0; const ip = () => '203.0.113.' + (1 + (ipSeq++ % 250)) + (ipSeq > 250 ? '.' + Math.floor(ipSeq / 250) : '');
let devSeq = 0; const device = () => 'dev-admission-guard-' + String(++devSeq).padStart(4, '0');
const ENV_KEYS = ['VERCEL_ENV', 'VERCEL_URL'];
function withEnv(env, fn) {
  const saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return Promise.resolve().then(fn).finally(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
}

// A twin of a source file in a temp directory, with its relative and @upstash imports made
// absolute so it loads the REAL siblings. The mutants below are twins with one line replaced.
const absImports = (rel, s) => {
  const dir = path.dirname(path.join(REPO, rel));
  const abs = (spec) => pathToFileURL(path.resolve(dir, spec)).href;
  return s
    .replace(/(from\s*')(\.\.?\/[^']+)(')/g, (_m, a, spec, c) => a + abs(spec) + c)
    .replace(/(import\(')(\.\.?\/[^']+)('\))/g, (_m, a, spec, c) => a + abs(spec) + c)
    .split("from '@upstash/ratelimit'").join("from '" + pathToFileURL(path.join(REPO, 'node_modules/@upstash/ratelimit/dist/index.js')).href + "'")
    .split("from '@upstash/redis'").join("from '" + pathToFileURL(path.join(REPO, 'node_modules/@upstash/redis/nodejs.mjs')).href + "'");
};

(async () => {
  const askSrc = read('api/ask.js');
  const rlSrc = read('lib/ratelimit.js');
  const dcSrc = read('lib/daycap.js');
  const sttSrc = read('api/stt.js');
  const ttsSrc = read('api/tts.js');
  const tkSrc = read('api/tashkeel.js');

  // ---- A. source pins ------------------------------------------------------------------------
  console.log('--- A. the seats, in the source ---');
  const at = (s) => askSrc.indexOf(s);
  const validatedAt = at('body.messages = messages;');
  const seatAt = at('const { ok } = await checkAskLimit(ip);');
  const capAt = at('const cap = await guardDayCap(req, res);');
  const globalAt = at('const global = await checkAskGlobal();');
  const parseAt = at("body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;");
  ok('A1 /api/ask: body parse < messages validated < per-IP throttle < day cap < global window',
    parseAt !== -1 && validatedAt !== -1 && seatAt !== -1 && capAt !== -1 && globalAt !== -1
    && parseAt < validatedAt && validatedAt < seatAt && seatAt < capAt && capAt < globalAt,
    JSON.stringify({ parseAt, validatedAt, seatAt, capAt, globalAt }));
  ok('A2 the global refusal refunds the day cap, then answers the throttle message',
    /const global = await checkAskGlobal\(\);\s*\n\s*if \(!global\.ok\) \{\s*\n\s*await refundDayCap\(cap\);\s*\n\s*return sendThrottleMessage\(\);/.test(askSrc));
  ok('A3 the three shape sites (four refusals) set X-Murabbi-Refused: shape before the 400',
    (askSrc.match(/res\.setHeader\('X-Murabbi-Refused', 'shape'\)/g) || []).length === 3
    && /res\.setHeader\('X-Murabbi-Refused', 'shape'\);\s*\n\s*return res\.status\(400\)\.json\(\{ error: 'Invalid JSON body' \}\);/.test(askSrc)
    && /res\.setHeader\('X-Murabbi-Refused', 'shape'\);\s*\n\s*return res\.status\(400\)\.json\(\{ error: 'messages array required' \}\);/.test(askSrc)
    && /res\.setHeader\('X-Murabbi-Refused', 'shape'\); return res\.status\(400\)\.json\(\{ error: 'invalid messages' \}\);/.test(askSrc));
  const askLimitBody = rlSrc.slice(rlSrc.indexOf('export async function checkAskLimit('), rlSrc.indexOf('export async function checkAskGlobal('));
  ok('A4 lib/ratelimit.js: checkAskLimit never names the global window; checkAskGlobal is its only reader',
    askLimitBody.length > 0 && !/ASK_WINDOWS\.all/.test(askLimitBody)
    && rlSrc.split("ASK_WINDOWS.all.limit('all')").length - 1 === 1);
  ok('A5 lib/ratelimit.js: the stt family exists with its own global of 1,000; tts and tk keep theirs',
    /const AUDIO_GLOBAL_DAY_STT = 1000;/.test(rlSrc) && /const AUDIO_GLOBAL_DAY = 4000;/.test(rlSrc)
    && /stt: makeAudioWindows\('stt', AUDIO_GLOBAL_DAY_STT\),/.test(rlSrc)
    && /tts: makeAudioWindows\('tts'\),/.test(rlSrc) && /tashkeel: makeAudioWindows\('tk'\),/.test(rlSrc));
  ok('A6 api/stt.js draws the stt family', /checkAudioLimit\(ip, 'stt'\)/.test(sttSrc) && !/checkAudioLimit\(ip, 'tts'\)/.test(sttSrc));
  const IP_EXPR = "const ip = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';";
  ok('A7 the three audio routes read the address with ONE expression, x-real-ip first, as /api/ask does',
    [sttSrc, ttsSrc, tkSrc].every((s) => s.split(IP_EXPR).length - 1 === 1 && !/x-forwarded-for'\] \|\| ''\)\.split\(','\)\[0\]\.trim\(\) \|\| req\.headers\['x-real-ip'\]/.test(s))
    && /req\.headers\['x-real-ip'\]\s*\n\s*\|\| \(req\.headers\['x-forwarded-for'\] \|\| ''\)\.split\(','\)\[0\]\.trim\(\)\s*\n\s*\|\| 'unknown';/.test(askSrc));
  const RETRY = /if \(typeof rl\.reset === 'number' && Number\.isFinite\(rl\.reset\)\) \{\s*\n\s*res\.setHeader\('Retry-After', String\(Math\.max\(1, Math\.ceil\(\(rl\.reset - Date\.now\(\)\) \/ 1000\)\)\)\);\s*\n\s*\}\s*\n\s*return res\.status\(429\)/;
  ok('A8 the three audio routes set Retry-After from the verdict\'s reset before their 429', [sttSrc, ttsSrc, tkSrc].every((s) => RETRY.test(s)));
  const dcBody = dcSrc.slice(dcSrc.indexOf('export async function checkDayCap('), dcSrc.indexOf('export async function refundDayCap('));
  ok('A9 lib/daycap.js checkDayCap counts (INCR) before it judges, DECRs on a refusal, and reads no MGET',
    dcBody.indexOf('p.incr(k); p.expire(k, DAY_CAP_TTL_SECONDS);') !== -1
    && dcBody.indexOf('p.incr(k); p.expire(k, DAY_CAP_TTL_SECONDS);') < dcBody.indexOf('if (after > limit) {')
    && dcBody.indexOf('if (after > limit) {') < dcBody.indexOf('q.decr(k);')
    && !/\.mget\(/.test(dcBody) && /reason: 'day-cap-reached'/.test(dcBody));

  // ---- B. the shipped modules, driven ---------------------------------------------------------
  installFetch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-security-admission-mut-'));
  try {
    const ASK = (await esm('api/ask.js')).default;
    const RL = await esm('lib/ratelimit.js');
    const DC = await esm('lib/daycap.js');
    const AC = await esm('lib/ai-consent.js');
    const LM = await esm('lib/limit-message.js');
    const TTS = (await esm('api/tts.js')).default;
    const STT = (await esm('api/stt.js')).default;
    const TK = (await esm('api/tashkeel.js')).default;
    const CONSENT = AC.AI_CONSENT_VERSION;
    const deviceKey = (dev) => 'dc:v1:d:' + dev + ':' + DC.kuwaitDayStamp();

    // One drive of a route handler: a POST with the consent header and a unique address.
    const drive = async (handler, body, headers = {}, opts = {}) => {
      calls = []; refuse = opts.refuse || (() => false); vendorThrows = !!opts.vendorThrows;
      const res = fakeRes();
      const req = { method: 'POST', headers: { [AC.AI_CONSENT_HEADER]: CONSENT, 'x-real-ip': ip(), 'content-type': 'application/json', ...headers }, body };
      let timedOut = false;
      const run = handler(req, res).catch((e) => { res.threw = e && e.message; });
      if (opts.timeoutMs) await Promise.race([run, new Promise((r) => setTimeout(() => { timedOut = true; r(); }, opts.timeoutMs))]); else await run;
      vendorThrows = false;
      return { res, status: res.code, body: res.body, sse: sseText(res), evals: evals(), tokens: evalTokens(), order: orderLine(), vendor: vendors().length, header: res.headers['x-murabbi-refused'], retryAfter: res.headers['retry-after'], timedOut, calls: calls.slice() };
    };
    const ONE = () => ({ messages: [{ role: 'user', content: 'x' }] });

    // The rows, as functions of the module under test, so a mutant twin is driven by the same code.
    const rows = {
      // 1. the four shapes (and the empty body): 400, the header, zero limiter EVALSHAs.
      async shape(ask) {
        const bad = [];
        const cases = [['{}', {}, 'messages array required'], ['{messages:[]}', { messages: [] }, 'messages array required'],
          ['"{"', '{', 'Invalid JSON body'], ['{messages:[{role:user}]}', { messages: [{ role: 'user' }] }, 'invalid messages'], ['(empty body)', undefined, 'messages array required']];
        for (const [label, body, error] of cases) {
          const r = await drive(ask, body);
          if (!(r.status === 400 && r.body && r.body.error === error && r.header === 'shape' && r.evals.length === 0)) bad.push(label + ' -> ' + JSON.stringify({ status: r.status, body: r.body, header: r.header, evals: r.evals }));
        }
        return bad;
      },
      // 2. a per-IP refusal: no global EVALSHA, no day-cap count, the throttle message.
      async perIpRefused(ask, which) {
        const r = await drive(ask, ONE(), { [DC.DEVICE_HEADER]: device() }, { refuse: (k) => k.startsWith(which === 'min' ? 'ask:min' : 'ask:day') });
        const fine = r.status === 200 && r.sse === LM.ASK_LIMIT_MESSAGE && !r.evals.includes('ask:all:day') && r.evals.every((p) => p === 'ask:min' || p === 'ask:day') && !r.calls.some((c) => c.cmd === 'INCR');
        return fine ? [] : [which + ' refused -> ' + JSON.stringify({ status: r.status, evals: r.evals, order: r.order })];
      },
      // 3. the identity-required and day-cap-reached exits: no global EVALSHA.
      async identityRequired(ask) {
        const r = await drive(ask, ONE());
        const fine = r.status === 429 && r.body && r.body.error === 'identity-required' && !r.evals.includes('ask:all:day') && same(r.evals, ['ask:min', 'ask:day']);
        return fine ? [] : ['identity-required -> ' + JSON.stringify({ status: r.status, body: r.body, evals: r.evals })];
      },
      async dayCapReached(ask) {
        const dev = device(); counters.set(deviceKey(dev), DC.dayCapLimit());
        const r = await drive(ask, ONE(), { [DC.DEVICE_HEADER]: dev });
        const after = counters.get(deviceKey(dev));
        const fine = r.status === 200 && r.sse === DC.dayCapMessage('day-cap-reached') && !r.evals.includes('ask:all:day') && same(r.evals, ['ask:min', 'ask:day']) && after === DC.dayCapLimit();
        return fine ? [] : ['day-cap-reached -> ' + JSON.stringify({ status: r.status, sse: r.sse.slice(0, 40), evals: r.evals, counterAfter: after })];
      },
      // 4a. on a preview the day window is not asked (the minute window still is).
      async previewMinute(ask) {
        const r = await withEnv(PREVIEW, () => drive(ask, ONE(), { [DC.DEVICE_HEADER]: device() }, { refuse: (k) => k.startsWith('ask:min') }));
        return same(r.evals, ['ask:min']) && r.status === 200 ? [] : ['preview minute refused -> ' + JSON.stringify({ status: r.status, evals: r.evals })];
      },
      // 4b. an admitted request: ask:min, ask:day, the day cap's INCR, then ask:all:day, then the vendor.
      async admitted(ask) {
        const dev = device();
        const r = await drive(ask, { messages: [{ role: 'user', content: 'ما حكم صلاة الجمعة للمسافر؟' }] }, { [DC.DEVICE_HEADER]: dev }, { vendorThrows: true, timeoutMs: 90000 });
        const idx = (pred) => r.calls.findIndex(pred);
        const iDay = idx((c) => isEval(c) && prefixOf(c.key) === 'ask:day');
        const iIncr = idx((c) => c.cmd === 'INCR' && c.key.startsWith('dc:v1:'));
        const iAll = idx((c) => isEval(c) && prefixOf(c.key) === 'ask:all:day');
        const iVendor = idx((c) => c.kind === 'vendor');
        const fine = !r.timedOut && same(r.evals, ['ask:min', 'ask:day', 'ask:all:day']) && iDay < iIncr && iIncr < iAll && iVendor > iAll && counters.get(deviceKey(dev)) === 1;
        return fine ? [] : ['admitted -> ' + JSON.stringify({ timedOut: r.timedOut, evals: r.evals, iDay, iIncr, iAll, iVendor, counter: counters.get(deviceKey(dev)), order: r.order.slice(0, 300) })];
      },
      // 4c. LAST for the shipped module: the global window refuses an admitted request -> the day cap
      // is refunded and the throttle message answers.
      async globalRefused(ask) {
        const dev = device();
        const r = await drive(ask, ONE(), { [DC.DEVICE_HEADER]: dev }, { refuse: (k) => k.startsWith('ask:all:day') });
        const after = counters.get(deviceKey(dev));
        const fine = r.status === 200 && r.sse === LM.ASK_LIMIT_MESSAGE && r.vendor === 0 && after === 0 && r.calls.some((c) => c.cmd === 'DECR');
        return fine ? [] : ['global refused -> ' + JSON.stringify({ status: r.status, sse: r.sse.slice(0, 40), evals: r.evals, vendor: r.vendor, counterAfter: after, order: r.order.slice(0, 300) })];
      },
      // 5. stt draws aud:stt:* at 80/900/1000 and never aud:tts:*.
      async sttFamily(stt) {
        const r = await drive(stt, { audio: 'AA==' });
        const fine = same(r.evals, ['aud:stt:ip:min', 'aud:stt:ip:day', 'aud:stt:all:day']) && same(r.tokens, [80, 900, 1000]) && !r.evals.some((p) => p.startsWith('aud:tts:'));
        return fine ? [] : ['stt family -> ' + JSON.stringify({ evals: r.evals, tokens: r.tokens })];
      },
      // 6 + 7. a refused per-IP audio window: no global EVALSHA, 429, Retry-After >= 1.
      async audioRefused(handler, body, family) {
        const r = await drive(handler, body, {}, { refuse: (k) => /:ip:min:/.test(k) });
        const ra = Number(r.retryAfter);
        const fine = r.status === 429 && r.vendor === 0 && !r.evals.some((p) => p.endsWith(':all:day')) && r.evals.every((p) => p.startsWith('aud:' + family + ':ip:')) && Number.isInteger(ra) && ra >= 1;
        return fine ? [] : [family + ' refused -> ' + JSON.stringify({ status: r.status, evals: r.evals, retryAfter: r.retryAfter, vendor: r.vendor })];
      },
      // 7b. the address: x-real-ip wins over x-forwarded-for.
      async address(tts) {
        const r = await drive(tts, { text: '.' }, { 'x-real-ip': '192.0.2.77', 'x-forwarded-for': '198.51.100.5, 10.0.0.1' });
        const minKey = r.calls.find((c) => isEval(c) && c.key.startsWith('aud:tts:ip:min'));
        return minKey && minKey.key.includes(':192.0.2.77:') ? [] : ['address -> ' + (minKey ? minKey.key : '(no per-IP key)')];
      },
      // the limiter, directly: a refused per-IP window names itself, carries reset, and stops.
      async limiterDirect(rl) {
        const bad = [];
        calls = []; refuse = (k) => k.startsWith('ask:min');
        let v = await rl.checkAskLimit(ip());
        if (!(v.ok === false && v.window === 'min' && !evals().includes('ask:all:day'))) bad.push('checkAskLimit minute -> ' + JSON.stringify({ v, evals: evals() }));
        calls = []; refuse = (k) => k.startsWith('ask:day');
        v = await rl.checkAskLimit(ip());
        if (!(v.ok === false && v.window === 'day' && !evals().includes('ask:all:day'))) bad.push('checkAskLimit day -> ' + JSON.stringify({ v, evals: evals() }));
        calls = []; refuse = (k) => k.startsWith('aud:stt:ip:day');
        v = await rl.checkAudioLimit(ip(), 'stt');
        if (!(v.ok === false && v.window === 'day' && Number.isFinite(v.reset) && same(evals(), ['aud:stt:ip:min', 'aud:stt:ip:day']))) bad.push('checkAudioLimit(stt) day -> ' + JSON.stringify({ v, evals: evals() }));
        calls = []; refuse = () => false;
        v = await rl.checkAudioLimit(ip(), 'stt');
        if (!(v.ok === true && same(evals(), ['aud:stt:ip:min', 'aud:stt:ip:day', 'aud:stt:all:day']) && same(evalTokens(), [80, 900, 1000]))) bad.push('checkAudioLimit(stt) allowed -> ' + JSON.stringify({ v, evals: evals(), tokens: evalTokens() }));
        return bad;
      },
      // 8. the day cap under concurrency, with a ticking in-memory store.
      async concurrency(dc) {
        const tick = () => new Promise((r) => setImmediate(r));
        const store = () => {
          const m = new Map(); let ops = 0;
          return {
            async mget(...keys) { ops++; await tick(); return keys.map((k) => (m.has(k) ? m.get(k) : null)); },
            pipeline() {
              const q = [];
              const p = {
                incr(k) { q.push(() => { const v = (m.get(k) || 0) + 1; m.set(k, v); return v; }); return p; },
                expire() { q.push(() => 1); return p; },
                decr(k) { q.push(() => { const v = (m.get(k) || 0) - 1; m.set(k, v); return v; }); return p; },
                async exec() { ops++; await tick(); return q.map((f) => f()); },
              };
              return p;
            },
            max() { return Math.max(0, ...m.values()); }, ops: () => ops,
          };
        };
        const bad = [];
        const id = { deviceId: 'dev-admission-concurrency-01', cookieId: 'cookie-admission-concurrency-01' };
        let s = store(); dc.__setRedisForTest(s);
        const parallel = await Promise.all(Array.from({ length: 50 }, () => dc.checkDayCap(id)));
        const allowed = parallel.filter((v) => v.allowed).length;
        if (!(allowed === 10 && s.max() === 10 && parallel.filter((v) => v.reason === 'day-cap-reached').length === 40)) bad.push('50 concurrent -> ' + JSON.stringify({ allowed, counter: s.max() }));
        s = store(); dc.__setRedisForTest(s);
        const seq = []; for (let i = 0; i < 50; i++) seq.push(await dc.checkDayCap(id));
        if (!(seq.filter((v) => v.allowed).length === 10 && s.max() === 10 && seq.slice(0, 10).every((v, i) => v.remaining === 9 - i))) bad.push('50 sequential -> ' + JSON.stringify({ allowed: seq.filter((v) => v.allowed).length, counter: s.max() }));
        s = store(); dc.__setRedisForTest(s);
        const founderShaped = { allowed: true, remaining: null, reason: 'founder' };
        if (!((await dc.refundDayCap(founderShaped)) === false && s.ops() === 0)) bad.push('refund of the founder bypass object touched the store');
        dc.__setRedisForTest(null);
        return bad;
      },
    };

    console.log('--- B. /api/ask, driven ---');
    let bad = await rows.shape(ASK);
    ok('B1 POST {} / {messages:[]} / "{" / invalid messages / empty body: 400, X-Murabbi-Refused: shape, ZERO limiter EVALSHAs (5 cases)', bad.length === 0, bad.join(' | '));
    bad = [...await rows.perIpRefused(ASK, 'min'), ...await rows.perIpRefused(ASK, 'day')];
    ok('B2 a request the minute or the day window refuses issues no ask:all:day EVALSHA and counts no identity', bad.length === 0, bad.join(' | '));
    bad = await rows.identityRequired(ASK);
    ok('B3 the identity-required exit issues no ask:all:day EVALSHA', bad.length === 0, bad.join(' | '));
    bad = await rows.dayCapReached(ASK);
    ok('B3b the day-cap-reached exit issues no ask:all:day EVALSHA and leaves the counter at the limit', bad.length === 0, bad.join(' | '));
    bad = await rows.previewMinute(ASK);
    ok('B4a on a preview deployment the day window is not asked', bad.length === 0, bad.join(' | '));
    bad = await rows.admitted(ASK);
    ok('B4b an admitted request issues exactly ask:min, ask:day, then ask:all:day after the day cap counted it, then reaches the vendor', bad.length === 0, bad.join(' | '));

    console.log('--- C. the audio routes and the limiter, driven ---');
    bad = await rows.sttFamily(STT);
    ok('C1 /api/stt consumes aud:stt:* at 80/900/1000 and never aud:tts:*', bad.length === 0, bad.join(' | '));
    bad = [...await rows.audioRefused(TTS, { text: '.' }, 'tts'), ...await rows.audioRefused(STT, { audio: 'AA==' }, 'stt'), ...await rows.audioRefused(TK, { text: 'a' }, 'tk')];
    ok('C2 a refused per-IP audio window issues no aud:*:all:day EVALSHA, and the 429 of tts, stt and tashkeel carries Retry-After >= 1', bad.length === 0, bad.join(' | '));
    bad = await rows.address(TTS);
    ok('C3 the audio routes read x-real-ip first', bad.length === 0, bad.join(' | '));
    bad = await rows.limiterDirect(RL);
    ok('C4 lib/ratelimit.js: a refused per-IP window names itself and carries reset; the global is not consulted; the stt family is its own', bad.length === 0, bad.join(' | '));

    console.log('--- D. the day cap under concurrency ---');
    bad = await rows.concurrency(DC);
    ok('D1 fifty concurrent checkDayCap at a cap of ten allow exactly ten and leave the counter at ten; sequential unchanged; the founder bypass object refunds nothing', bad.length === 0, bad.join(' | '));

    // ---- E. mutants ----------------------------------------------------------------------------
    console.log('--- E. mutants (each must turn its row red) ---');
    const twin = async (rel, name, from, to) => {
      const src = read(rel);
      const n = src.split(from).length - 1;
      if (n !== 1) { ok('M precondition: ' + name + ' finds its seam once in ' + rel, false, 'found ' + n); return null; }
      const file = path.join(dir, name.replace(/[^a-z0-9]+/gi, '-') + path.extname(rel).replace('.js', '.mjs'));
      fs.writeFileSync(file, absImports(rel, src.split(from).join(to)), 'utf8');
      return import(pathToFileURL(file).href + '?m=' + encodeURIComponent(name));
    };
    const killed = async (name, rel, from, to, row) => {
      const m = await twin(rel, name, from, to);
      if (!m) return;
      const bad = await row(m);
      ok('M KILLED: ' + name, bad.length > 0, 'the mutant survived: the row stayed green');
    };
    // api/ask.js twins (they import the REAL lib modules, so they share the limiter's cache).
    await killed('ask: the shape header is dropped', 'api/ask.js',
      "res.setHeader('X-Murabbi-Refused', 'shape');\n    return res.status(400).json({ error: 'messages array required' });",
      "return res.status(400).json({ error: 'messages array required' });",
      async (m) => rows.shape(m.default));
    await killed('ask: the throttle is back above the body parse', 'api/ask.js',
      '  const apiKey = process.env.ANTHROPIC_API_KEY;\n',
      "  await checkAskLimit(req.headers['x-real-ip'] || 'unknown');\n  const apiKey = process.env.ANTHROPIC_API_KEY;\n",
      async (m) => rows.shape(m.default));
    await killed('ask: a per-IP refusal still asks the global', 'api/ask.js',
      '  if (!ok) { return sendThrottleMessage(); }',
      '  if (!ok) { await checkAskGlobal(); return sendThrottleMessage(); }',
      async (m) => rows.perIpRefused(m.default, 'min'));
    await killed('ask: the global is asked before the day cap', 'api/ask.js',
      '  const cap = await guardDayCap(req, res);\n',
      '  await checkAskGlobal();\n  const cap = await guardDayCap(req, res);\n',
      async (m) => [...await rows.identityRequired(m.default), ...await rows.dayCapReached(m.default)]);
    await killed('ask: the global is asked before the day cap (the admitted order)', 'api/ask.js',
      '  const cap = await guardDayCap(req, res);\n',
      '  await checkAskGlobal();\n  const cap = await guardDayCap(req, res);\n',
      async (m) => rows.admitted(m.default));
    // lib/ratelimit.js twins, driven directly.
    await killed('ratelimit: the global window is back inside checkAskLimit', 'lib/ratelimit.js',
      "skipDay ? Promise.resolve({ success: true }) : ASK_WINDOWS.day.limit(ip),\n    ]);",
      "skipDay ? Promise.resolve({ success: true }) : ASK_WINDOWS.day.limit(ip),\n      ASK_WINDOWS.all.limit('all'),\n    ]);",
      async (m) => rows.limiterDirect(m));
    await killed('ratelimit: the stt family shares the tts global', 'lib/ratelimit.js',
      "stt: makeAudioWindows('stt', AUDIO_GLOBAL_DAY_STT),", "stt: makeAudioWindows('stt'),",
      async (m) => rows.limiterDirect(m));
    await killed('ratelimit: a refused per-IP audio window still asks the global', 'lib/ratelimit.js',
      "    const perIp = refusedWindow([['min', m], ['day', d]]);\n    if (perIp) return perIp;\n    const g = await W.all.limit('all');",
      "    const g = await W.all.limit('all');\n    const perIp = refusedWindow([['min', m], ['day', d]]);\n    if (perIp) return perIp;",
      async (m) => rows.limiterDirect(m));
    await killed('ratelimit: the refusal drops its reset', 'lib/ratelimit.js',
      'return reset === undefined ? { ok: false, window } : { ok: false, window, reset };',
      'return { ok: false, window };',
      async (m) => rows.limiterDirect(m));
    // api/stt.js and api/tts.js twins.
    await killed('stt: the recording draws the tts family again', 'api/stt.js',
      "checkAudioLimit(ip, 'stt')", "checkAudioLimit(ip, 'tts')",
      async (m) => rows.sttFamily(m.default));
    await killed('tts: the 429 carries no Retry-After', 'api/tts.js',
      "res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))));", 'void rl.reset;',
      async (m) => rows.audioRefused(m.default, { text: '.' }, 'tts'));
    await killed('stt: the 429 carries no Retry-After', 'api/stt.js',
      "res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))));", 'void rl.reset;',
      async (m) => rows.audioRefused(m.default, { audio: 'AA==' }, 'stt'));
    await killed('tashkeel: the 429 carries no Retry-After', 'api/tashkeel.js',
      "res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))));", 'void rl.reset;',
      async (m) => rows.audioRefused(m.default, { text: 'a' }, 'tk'));
    await killed('tts: the address reads x-forwarded-for first again', 'api/tts.js',
      IP_EXPR, "const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';",
      async (m) => rows.address(m.default));
    // lib/daycap.js twins, driven directly with their own fake store.
    await killed('daycap: the judgement after the count is gone', 'lib/daycap.js',
      'if (after > limit) {', 'if (false) {',
      async (m) => rows.concurrency(m));
    await killed('daycap: the refund on a refusal is gone', 'lib/daycap.js',
      'for (const k of keys) q.decr(k);', 'for (const k of keys) void k;',
      async (m) => rows.concurrency(m));

    // ---- LAST: the shipped module, the global window refusing (cached in-process afterwards) ----
    console.log('--- B, last ---');
    bad = await rows.globalRefused(ASK);
    ok('B4c the global window refuses an admitted request: the day cap is refunded and the throttle message answers, no vendor', bad.length === 0, bad.join(' | '));
    await killed('ask: the global refusal does not refund the day cap', 'api/ask.js',
      '    await refundDayCap(cap);\n    return sendThrottleMessage();',
      '    return sendThrottleMessage();',
      async (m) => rows.globalRefused(m.default));
  } finally {
    globalThis.fetch = realFetch;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp only */ }
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL' : '  PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
