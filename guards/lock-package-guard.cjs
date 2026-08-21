// guards/lock-package-guard.cjs — THE THREE LOCKS, DRIVEN.
//
// This gate does not read the lock code and agree with it. It RUNS it: every assertion below
// drives a real handler or a real verifier with a store double and reads what came back. A
// grep-based gate on a security boundary proves that a line exists, which is not the same
// claim as "the boundary holds", and the difference is the whole reason this file is long.
//
// ── WHAT IT PINS ─────────────────────────────────────────────────────────────
//   D13  the unlock attempt limiter now has THREE dimensions (device, IP, global), each judged
//        before any of them is incremented, so an exhausted dimension cannot spend the others.
//   D12  the parent code is verified ON THE SERVER, with scrypt + a random salt +
//        timingSafeEqual, and the browser keeps nothing that can be compared against.
//   D06  the founder token carries an expiry and a nonce, both covered by the HMAC; an expired
//        one is refused, a revoked nonce is refused, and a sound one passes.
//
// Every case has a NEGATIVE twin. "Accepted" is only worth asserting next to a "refused", or
// the gate cannot tell a working verifier from one that says yes to everything.
//
// Usage: node guards/lock-package-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const fileUrl = (rel) => 'file://' + path.join(REPO, rel).replace(/\\/g, '/');
const dataUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');

// Mutation seam for F-115. A supplied attempts module lives OUTSIDE the repository; the real
// unlock and parent handlers are loaded unchanged except that their one limiter import points to
// it. All other local imports still resolve to the repository, and Redis remains the local seam.
async function lockModules() {
  const at = process.argv.indexOf('--attempts-source');
  if (at < 0) return { UNLOCK: await esm('api/unlock.js'), PC: await esm('api/parent-code.js') };
  let attemptsSource = fs.readFileSync(path.resolve(process.argv[at + 1]), 'utf8');
  // The causal mutant is the pre-F-115 module itself: its old noteAttempt performed the
  // read/check/write during the handler's precheck. Adapt only its export names in memory so the
  // new handlers can drive that exact old mechanism without writing a mutant into this tree.
  if (!/export async function checkAttempts\s*\(/.test(attemptsSource)
      && /export async function noteAttempt\s*\(/.test(attemptsSource)) {
    attemptsSource = attemptsSource
      .replace('export async function noteAttempt(', 'export async function checkAttempts(')
      .concat('\nexport async function noteFailedAttempt() { return {}; }\n');
  }
  attemptsSource = attemptsSource.replace("'./daycap.js'", `'${fileUrl('lib/daycap.js')}'`);
  const attemptsUrl = dataUrl(attemptsSource);
  const load = async (rel) => {
    let source = read(rel)
      .replace("import { Redis } from '@upstash/redis';", 'const Redis = class LocalRedis {};')
      .replace("'../lib/daycap.js'", `'${fileUrl('lib/daycap.js')}'`)
      .replace("'../lib/ratelimit.js'", `'${fileUrl('lib/ratelimit.js')}'`)
      .replace("'../lib/attempts.js'", `'${attemptsUrl}'`);
    return import(dataUrl(source));
  };
  return { UNLOCK: await load('api/unlock.js'), PC: await load('api/parent-code.js') };
}

// Loads the real report handler while replacing only infrastructure imports. The request and
// throttle control flow stay intact, but this gate can never open a Redis connection.
async function reportHandlerWithLocalStubs() {
  const stubName = '__USTAZ_LOCK_REPORT_STUBS__';
  const sourceArg = process.argv.indexOf('--report-source');
  const reportSource = sourceArg >= 0 ? fs.readFileSync(path.resolve(process.argv[sourceArg + 1]), 'utf8') : read('api/report.js');
  const source = reportSource
    .replace("import { Redis } from '@upstash/redis';", `const Redis = globalThis.${stubName}.Redis;`)
    .replace(
      "import { checkReportLimit, applyCorsOrigin } from '../lib/ratelimit.js';",
      `const { checkReportLimit, applyCorsOrigin } = globalThis.${stubName};`
    )
    .replace(
      "import { clientAddress } from '../lib/attempts.js';",
      `const { clientAddress } = globalThis.${stubName};`
    );
  globalThis[stubName] = {
    Redis: class LocalRedis {},
    checkReportLimit: (...args) => globalThis[stubName].limit(...args),
    applyCorsOrigin: () => false,
    clientAddress: (...args) => globalThis[stubName].address(...args),
    limit: async () => ({ ok: false }),
    address: () => null,
  };
  const url = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
  return {
    module: await import(url),
    stubs: globalThis[stubName],
    cleanup: () => { delete globalThis[stubName]; },
  };
}

// ── A STORE DOUBLE ───────────────────────────────────────────────────────────
// An in-memory map with exactly the surface the lock code uses. `boom` makes every call throw,
// which is how the fail-CLOSED branches are reached without unplugging anything real.
function fakeRedis(seed) {
  const m = new Map(Object.entries(seed || {}));
  const sets = new Map();
  const self = {
    boom: false,
    map: m,
    sets,
    _guard() { if (self.boom) throw new Error('store double: forced transport failure'); },
    async get(k) { self._guard(); return m.has(k) ? m.get(k) : null; },
    async set(k, v) { self._guard(); m.set(k, v); return 'OK'; },
    async del(k) { self._guard(); m.delete(k); return 1; },
    async mget(...keys) { self._guard(); return keys.map((k) => (m.has(k) ? m.get(k) : null)); },
    async eval(_script, keys, args) {
      self._guard();
      const count = Number(args[0]);
      if (!Number.isInteger(count) || count !== keys.length) return [-1, 0];
      const ceilings = args.slice(1, count + 1).map(Number);
      const values = keys.map((k) => {
        const raw = m.has(k) ? m.get(k) : 0;
        if (raw === null || raw === undefined || raw === '') return 0;
        const n = typeof raw === 'number' ? raw : Number(String(raw));
        return Number.isFinite(n) ? n : NaN;
      });
      if (values.some((n) => !Number.isFinite(n)) || ceilings.some((n) => !Number.isFinite(n))) {
        return [-1, 0];
      }
      const spent = values.findIndex((n, i) => n >= ceilings[i]);
      if (spent >= 0) return [0, spent + 1];
      for (let i = 0; i < keys.length; i++) m.set(keys[i], values[i] + 1);
      return [1, 0];
    },
    async sadd(k, v) { self._guard(); if (!sets.has(k)) sets.set(k, new Set()); sets.get(k).add(String(v)); return 1; },
    async sismember(k, v) { self._guard(); return sets.has(k) && sets.get(k).has(String(v)) ? 1 : 0; },
    pipeline() {
      const ops = [];
      const p = {
        incr(k) { ops.push(['incr', k]); return p; },
        expire(k, s) { ops.push(['expire', k, s]); return p; },
        set(k, v) { ops.push(['set', k, v]); return p; },
        async exec() {
          self._guard();
          const out = [];
          for (const [op, k, v] of ops) {
            if (op === 'incr') { const n = Number(m.get(k) || 0) + 1; m.set(k, n); out.push(n); }
            else if (op === 'set') { m.set(k, v); out.push('OK'); }
            else out.push(1);
          }
          return out;
        },
      };
      return p;
    },
  };
  return self;
}

function fakeRes() {
  return {
    code: 0, body: null, headers: {}, ended: 0,
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    json(o) { this.body = o; this.ended += 1; return this; },
    end() { this.ended += 1; return this; },
  };
}

// Restores every env var this gate touches, whether it existed before or not.
function envSandbox(vars) {
  const prev = new Map();
  for (const k of Object.keys(vars)) {
    prev.set(k, [Object.prototype.hasOwnProperty.call(process.env, k), process.env[k]]);
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return () => {
    for (const [k, [had, v]] of prev) {
      if (had) process.env[k] = v; else delete process.env[k];
    }
  };
}

(async function main() {
  console.log('=== lock-package-guard — D13 + D12 + D06, driven not grepped ===');

  const DC = await esm('lib/daycap.js');
  const { UNLOCK, PC } = await lockModules();
  const unlock = UNLOCK.default;

  const DAY = DC.kuwaitDayStamp();
  const PIN = '246813';
  const DEVICE = 'lockguard-device-aaaa';
  const IP_A = '203.0.113.7';
  const IP_B = '198.51.100.9';
  const dig = (ip) => crypto.createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 32);
  const kDev = (d) => `ul:v1:d:${d}:${DAY}`;
  const kIp = (ip) => `ul:v1:ip:${dig(ip)}:${DAY}`;
  const kAll = `ul:v1:all:${DAY}`;

  // GENERATED, never written down. A plausible-looking string here is a string the repository's
  // own secret scanner has to decide about, and it decides against -- rightly, because it cannot
  // tell a test fixture from the real thing. Drawing it at run time removes the question.
  const restoreEnv = envSandbox({
    UNLOCK_PIN: PIN,
    FOUNDER_SECRET: crypto.randomBytes(16).toString('hex'),
  });

  try {
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n=== A. D13 — the unlock limiter has three dimensions ===');
    // ══════════════════════════════════════════════════════════════════════════

    // Drives one POST against a fresh store double and hands back both the response and the
    // store, so every assertion can read the COUNTERS as well as the status.
    const postWithStore = async (store, opts) => {
      const o = opts || {};
      if (o.boom) store.boom = true;
      UNLOCK.__setRedisForTest(store);
      const headers = Object.assign({}, o.headers);
      if (o.ip !== null && !('x-forwarded-for' in headers)) headers['x-forwarded-for'] = o.ip || IP_A;
      const req = { method: 'POST', headers, body: Object.assign({ pin: PIN, deviceId: DEVICE }, o.body || {}) };
      const res = fakeRes();
      await unlock(req, res);
      return { res, store };
    };
    const post = async (opts) => postWithStore(fakeRedis((opts || {}).seed), opts);

    {
      const { res, store } = await post({});
      ok('A1: a fresh device on a fresh address unlocks',
        res.code === 200 && !!res.body && typeof res.body.token === 'string',
        'code=' + res.code + ' body=' + JSON.stringify(res.body));
      ok('A1: ...and success leaves all three failed-attempt counters untouched',
        store.map.get(kDev(DEVICE)) === undefined && store.map.get(kIp(IP_A)) === undefined && store.map.get(kAll) === undefined,
        'dev=' + store.map.get(kDev(DEVICE)) + ' ip=' + store.map.get(kIp(IP_A)) + ' all=' + store.map.get(kAll));
      ok('A1: ...and success stores neither the address nor its digest',
        ![...store.map.keys()].some((k) => k.indexOf(dig(IP_A)) !== -1 || k.indexOf(IP_A) !== -1),
        [...store.map.keys()].join(' | '));
    }

    {
      // THE CASE D13 EXISTS FOR. The address has spent its ten; the device is brand new, which
      // is exactly what an attacker minting device ids looks like.
      const seed = {}; seed[kIp(IP_A)] = 10; seed[kAll] = 12;
      const { res, store } = await post({ seed, body: { deviceId: 'lockguard-fresh-device-1' } });
      ok('A2: an exhausted ADDRESS is refused even with a brand-new device id',
        res.code === 429 && res.body && res.body.error === 'unlock-locked',
        'code=' + res.code + ' body=' + JSON.stringify(res.body));
      ok('A2: ...and the GLOBAL counter was not touched by the refusal',
        store.map.get(kAll) === 12, 'all=' + store.map.get(kAll));
      ok('A2: ...nor was a counter minted for the fresh device',
        store.map.get(kDev('lockguard-fresh-device-1')) === undefined,
        String(store.map.get(kDev('lockguard-fresh-device-1'))));
      ok('A2: ...and the address counter did not grow past its own ceiling either',
        store.map.get(kIp(IP_A)) === 10, String(store.map.get(kIp(IP_A))));
    }

    {
      // The twin of A2: the limit is per address, not a global switch the first grinder flips.
      const seed = {}; seed[kIp(IP_A)] = 10; seed[kAll] = 12;
      const { res } = await post({ seed, ip: IP_B, body: { deviceId: 'lockguard-other-device' } });
      ok('A3: a DIFFERENT address is unaffected and still unlocks',
        res.code === 200 && !!res.body && typeof res.body.token === 'string',
        'code=' + res.code + ' body=' + JSON.stringify(res.body));
    }

    {
      const seed = {}; seed[kDev(DEVICE)] = 5;
      const { res, store } = await post({ seed });
      ok('A4: the DEVICE dimension still refuses at its own ceiling',
        res.code === 429 && res.body && res.body.error === 'unlock-locked', 'code=' + res.code);
      ok('A4: ...without spending the address allowance',
        store.map.get(kIp(IP_A)) === undefined, String(store.map.get(kIp(IP_A))));
    }

    {
      const seed = {}; seed[kAll] = 50;
      const { res } = await post({ seed, ip: IP_B, body: { deviceId: 'lockguard-yet-another' } });
      ok('A5: the GLOBAL ceiling is still the last resort and still refuses',
        res.code === 429 && res.body && res.body.error === 'unlock-locked', 'code=' + res.code);
    }

    {
      // No address header at all. The dimension is absent, not fatal -- but the other two must
      // still be protected by the device and global ceilings when a failure occurs. A success is
      // free under F-115, so it must not mint either failed-attempt counter.
      const store = fakeRedis({});
      UNLOCK.__setRedisForTest(store);
      const res = fakeRes();
      await unlock({ method: 'POST', headers: {}, body: { pin: PIN, deviceId: DEVICE } }, res);
      ok('A6: a request with NO address header still unlocks',
        res.code === 200 && !!res.body && res.body.token, 'code=' + res.code);
      ok('A6: ...and success leaves the device and global failed-attempt counters untouched',
        store.map.get(kDev(DEVICE)) === undefined && store.map.get(kAll) === undefined,
        'dev=' + store.map.get(kDev(DEVICE)) + ' all=' + store.map.get(kAll));
      ok('A6: ...and no address counter was invented for it',
        ![...store.map.keys()].some((k) => k.startsWith('ul:v1:ip:')),
        [...store.map.keys()].join(' | '));
    }

    {
      // A counter that EXISTS and will not parse is not a zero.
      const seed = {}; seed[kIp(IP_A)] = 'not-a-number';
      const { res } = await post({ seed });
      ok('A7: an unreadable ADDRESS counter fails CLOSED, not open',
        res.code === 429 && res.body && res.body.error === 'unlock-unavailable',
        'code=' + res.code + ' body=' + JSON.stringify(res.body));
    }

    {
      // The right PIN, after the address is spent. The compare must never be reached.
      const seed = {}; seed[kIp(IP_A)] = 10;
      const { res } = await post({ seed });
      ok('A8: the CORRECT pin is still refused once the address is spent',
        res.code === 429 && res.body && res.body.error === 'unlock-locked'
        && !(res.body && res.body.token),
        'code=' + res.code + ' body=' + JSON.stringify(res.body));
    }

    {
      // A wrong PIN on a fresh address is a refusal, not a lockout -- the ordinary case still
      // has to behave, or the three assertions above would pass on a handler that refuses all.
      const { res } = await post({ body: { pin: '999999' } });
      ok('A9: a WRONG pin is refused as a wrong pin, not as a lockout',
        res.code === 401 && res.body && res.body.error === 'unlock-refused', 'code=' + res.code);
    }

    ok('A10: lib/daycap.js still reads no address of any kind',
      !/x-forwarded-for|x-real-ip|ipDigest/.test(read('lib/daycap.js')),
      'the day cap must never bucket children by a shared exit address');

    ok('A11: the limiter is imported, not re-implemented, by both endpoints',
      /from '\.\.\/lib\/attempts\.js'/.test(read('api/unlock.js'))
      && /from '\.\.\/lib\/attempts\.js'/.test(read('api/parent-code.js')));

    // F-118. Drive /api/report itself and capture the exact key handed to its limiter. A 429
    // deliberately stops before the report store, so this test persists nothing and uses no
    // network. ipDigest() is the canonical edge-address contract used by the secret limiters.
    console.log('\n=== A12. F-118 — report address follows the canonical edge contract ===');
    const ATTEMPTS = await esm('lib/attempts.js');
    const reportHarness = await reportHandlerWithLocalStubs();
    try {
      reportHarness.stubs.address = (...args) => ATTEMPTS.clientAddress(...args);
      const report = reportHarness.module.default;
      const cases = [
        ['both headers prefer forwarded', { 'x-forwarded-for': ' 203.0.113.11, 10.0.0.4 ', 'x-real-ip': '198.51.100.91' }, '203.0.113.11'],
        ['forwarded list takes its first member', { 'x-forwarded-for': ' 203.0.113.12 , 10.0.0.5' }, '203.0.113.12'],
        ['forwarded-only is accepted', { 'x-forwarded-for': ' 203.0.113.13 ' }, '203.0.113.13'],
        ['real-only is the fallback', { 'x-real-ip': ' 198.51.100.92 ' }, '198.51.100.92'],
        ['missing headers use the shared throttle fallback', {}, 'unknown'],
      ];
      const observed = [];
      for (const [name, headers, expected] of cases) {
        const keys = [];
        reportHarness.stubs.limit = async (key) => { keys.push(key); return { ok: false }; };
        const res = fakeRes();
        await report({ method: 'POST', headers, body: { reason: 'wrong_info' } }, res);
        observed.push({ name, headers, expected, keys, code: res.code });
        ok('A12: ' + name, keys.length === 1 && keys[0] === expected && res.code === 429,
          JSON.stringify({ keys, expected, code: res.code }));
      }
      ok('A12: every concrete report key hashes to the same attempts bucket',
        observed.every(({ headers, keys }) => {
          const canonical = ATTEMPTS.ipDigest({ headers });
          return keys[0] === 'unknown' ? canonical === null : dig(keys[0]) === canonical;
        }), JSON.stringify(observed));
    } finally {
      reportHarness.cleanup();
    }

    // F-115. The allowance describes FAILED credential guesses, not successful openings. These
    // requests share one store so the handler's actual check/consume lifecycle is observable.
    console.log('\n=== A13. F-115 — only failed unlock guesses consume allowance ===');
    {
      const store = fakeRedis({});
      const responses = [];
      for (let i = 0; i < 6; i++) responses.push((await postWithStore(store, {})).res);
      ok('A13: six correct PINs all succeed without consuming failed-attempt allowance',
        responses.every((res) => res.code === 200 && res.body && res.body.token)
        && store.map.get(kDev(DEVICE)) === undefined
        && store.map.get(kIp(IP_A)) === undefined
        && store.map.get(kAll) === undefined,
        JSON.stringify({ codes: responses.map((res) => res.code), dev: store.map.get(kDev(DEVICE)), ip: store.map.get(kIp(IP_A)), all: store.map.get(kAll) }));
    }
    {
      const store = fakeRedis({});
      const responses = [];
      for (let i = 0; i < 6; i++) {
        responses.push((await postWithStore(store, { body: { pin: '999999' } })).res);
      }
      ok('A13: five wrong PINs spend the allowance and the sixth is locked',
        responses.slice(0, 5).every((res) => res.code === 401 && res.body && res.body.error === 'unlock-refused')
        && responses[5].code === 429 && responses[5].body && responses[5].body.error === 'unlock-locked'
        && store.map.get(kDev(DEVICE)) === 5 && store.map.get(kIp(IP_A)) === 5 && store.map.get(kAll) === 5
        && [...store.map.keys()].some((k) => k.indexOf(dig(IP_A)) !== -1)
        && ![...store.map.keys()].some((k) => k.indexOf(IP_A) !== -1),
        JSON.stringify({ codes: responses.map((res) => res.code), dev: store.map.get(kDev(DEVICE)), ip: store.map.get(kIp(IP_A)), all: store.map.get(kAll) }));
    }
    {
      const store = fakeRedis({});
      await postWithStore(store, { body: { pin: '999999' } });
      await postWithStore(store, { body: { pin: '999999' } });
      const success = (await postWithStore(store, {})).res;
      ok('A13: a later success neither spends nor clears earlier failures',
        success.code === 200 && store.map.get(kDev(DEVICE)) === 2
        && store.map.get(kIp(IP_A)) === 2 && store.map.get(kAll) === 2,
        JSON.stringify({ code: success.code, dev: store.map.get(kDev(DEVICE)), ip: store.map.get(kIp(IP_A)), all: store.map.get(kAll) }));
    }
    {
      const seed = {}; seed[kDev(DEVICE)] = 4;
      const store = fakeRedis(seed);
      const responses = await Promise.all([
        postWithStore(store, { body: { pin: '999999' } }),
        postWithStore(store, { body: { pin: '999999' } }),
      ]);
      const codes = responses.map(({ res }) => res.code).sort((a, b) => a - b);
      ok('A13: concurrent failures atomically stop at the fifth failure',
        codes[0] === 401 && codes[1] === 429 && store.map.get(kDev(DEVICE)) === 5
        && store.map.get(kIp(IP_A)) === 1 && store.map.get(kAll) === 1,
        JSON.stringify({ codes, dev: store.map.get(kDev(DEVICE)), ip: store.map.get(kIp(IP_A)), all: store.map.get(kAll) }));
    }

    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n=== B. D12 — the parent code is judged on the SERVER ===');
    // ══════════════════════════════════════════════════════════════════════════

    const parent = PC.default;
    const PDEV = 'lockguard-parent-device';
    const CODE = '4821';
    const sha256hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
    const pcRec = (d) => `pc:v1:rec:${d}`;
    const pcDev = (d) => `pc:v1:d:${d}:${DAY}`;
    const pcIp = (ip) => `pc:v1:ip:${dig(ip)}:${DAY}`;

    // One POST, its own store double, and the store handed back so counters and records can both
    // be read. Note BOTH seams are stubbed -- the endpoint's client and, through it, the limiter's,
    // because lib/attempts.js is passed the caller's client rather than building its own.
    const pcPostWithStore = async (store, opts) => {
      const o = opts || {};
      if (o.boom) store.boom = true;
      PC.__setRedisForTest(store);
      const headers = {};
      if (o.ip !== null) headers['x-forwarded-for'] = o.ip || IP_A;
      const req = { method: 'POST', headers, body: Object.assign({ deviceId: PDEV }, o.body || {}) };
      const res = fakeRes();
      await parent(req, res);
      return { res, store };
    };
    const pcPost = async (opts) => pcPostWithStore(fakeRedis((opts || {}).seed), opts);

    {
      const { res } = await pcPost({ body: { action: 'status' } });
      ok('B1: a device with no record reports hasCode:false',
        res.code === 200 && res.body && res.body.hasCode === false, JSON.stringify(res.body));
    }
    {
      // The probe runs every time the gate screen opens. If it cost an attempt, opening the
      // screen five times would lock a parent out of their own panel with nothing typed.
      const { store } = await pcPost({ body: { action: 'status' } });
      ok('B1: ...and asking costs NO attempt on either dimension',
        store.map.get(pcDev(PDEV)) === undefined && store.map.get(pcIp(IP_A)) === undefined,
        'dev=' + store.map.get(pcDev(PDEV)) + ' ip=' + store.map.get(pcIp(IP_A)));
    }

    let liveRecord = null;
    {
      const { res, store } = await pcPost({ body: { action: 'set', pin: CODE } });
      ok('B2: a first code is accepted for a device that has none',
        res.code === 200 && res.body && res.body.ok === true, JSON.stringify(res.body));
      liveRecord = store.map.get(pcRec(PDEV));
      const parsed = liveRecord ? JSON.parse(liveRecord) : null;
      // The salt and the digest are pinned one line below to be EXACTLY 32 and 64 random hex
      // characters, so a substring search across them measures arithmetic, not storage: a
      // four-digit code lands inside 96 random hex chars about once in 718 runs (measured over
      // 500,000 draws), and that -- not a code change -- is what turned this gate red. The leak
      // this assertion came to catch is the code kept AS DATA, so it is looked for where such a
      // value would land: everywhere in the record except those two proven-random fields.
      const carrier = parsed
        ? String(liveRecord).split(parsed.salt).join('').split(parsed.hash).join('')
        : String(liveRecord);
      ok('B2: ...stored as scrypt over a RANDOM salt, never as the code and never as its sha256',
        !!parsed && parsed.alg === 'scrypt'
        && /^[0-9a-f]{32}$/.test(parsed.salt) && /^[0-9a-f]{64}$/.test(parsed.hash)
        && parsed.hash !== sha256hex(CODE)
        && carrier.indexOf(CODE) === -1,
        String(liveRecord));
    }
    {
      // Two devices, same code, must not produce the same digest -- that is what the salt buys,
      // and it is the difference between a stolen dump being a lookup table and being useless.
      const { store } = await pcPost({ body: { action: 'set', pin: CODE, deviceId: 'lockguard-parent-two' } });
      const otherRecord = store.map.get(pcRec('lockguard-parent-two'));
      const other = JSON.parse(otherRecord);
      ok('B2: ...and the SAME code on another device yields a different digest',
        other.hash !== JSON.parse(liveRecord).hash && other.salt !== JSON.parse(liveRecord).salt);
      // Closes the single hole the narrowing above opens: a salt or a digest DERIVED from the
      // code would hide it inside the two fields that search now skips. Derivation is systematic
      // -- it marks EVERY record -- while a hex collision is a 1-in-718 coin flip, so both
      // records carrying the code at once is a certainty under a leak and 1 in ~515,000 by luck.
      ok('B2: ...and the code is never inside BOTH records at once (a leak is systematic, a collision is not)',
        !(String(liveRecord).indexOf(CODE) !== -1 && String(otherRecord).indexOf(CODE) !== -1),
        'live=' + String(liveRecord) + '  other=' + String(otherRecord));
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const { res } = await pcPost({ seed, body: { action: 'verify', pin: CODE } });
      ok('B3: the RIGHT code opens the panel', res.code === 200 && res.body && res.body.ok === true,
        JSON.stringify(res.body));
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const { res } = await pcPost({ seed, body: { action: 'verify', pin: '9999' } });
      ok('B3: ...and a WRONG code is refused',
        res.code === 401 && res.body && res.body.error === 'parent-refused', 'code=' + res.code);
    }
    {
      // Sending the digest the browser used to hold does NOT open a device that has a record.
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const { res } = await pcPost({ seed, body: { action: 'verify', pin: '9999', legacyHash: sha256hex('9999') } });
      ok('B3: ...and a self-supplied legacy digest cannot override an EXISTING record',
        res.code === 401 && res.body && res.body.error === 'parent-refused', 'code=' + res.code);
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const { res, store } = await pcPost({ seed, body: { action: 'set', pin: '1234' } });
      ok('B4: SET never overwrites an existing code',
        res.code === 401 && res.body && res.body.error === 'parent-refused'
        && store.map.get(pcRec(PDEV)) === liveRecord, 'code=' + res.code);
    }
    {
      const { res } = await pcPost({ body: { action: 'set', pin: '12' } });
      ok('B4: ...and the four-digit floor is re-checked on the server',
        res.code === 400 && res.body && res.body.error === 'parent-weak', 'code=' + res.code);
    }
    {
      // THE MIGRATION. A device with no record, holding the digest the old client stored.
      const { res, store } = await pcPost({
        body: { action: 'verify', pin: CODE, legacyHash: sha256hex(CODE), deviceId: 'lockguard-legacy-device' },
      });
      ok('B5: a legacy holder is enrolled SILENTLY by typing the code they already had',
        res.code === 200 && res.body && res.body.ok === true && res.body.migrated === true,
        JSON.stringify(res.body));
      const rec = store.map.get(pcRec('lockguard-legacy-device'));
      const parsed = rec ? JSON.parse(rec) : null;
      ok('B5: ...and what lands in the store is scrypt, NOT the sha256 that was sent',
        !!parsed && parsed.alg === 'scrypt' && parsed.hash !== sha256hex(CODE),
        String(rec));
    }
    {
      const { res, store } = await pcPost({
        body: { action: 'verify', pin: '7777', legacyHash: sha256hex(CODE), deviceId: 'lockguard-legacy-two' },
      });
      ok('B5: ...but a code that does NOT match the held digest enrols nothing',
        res.code === 401 && res.body && res.body.error === 'parent-refused'
        && store.map.get(pcRec('lockguard-legacy-two')) === undefined, 'code=' + res.code);
    }
    {
      const { res } = await pcPost({ body: { action: 'verify', pin: CODE, deviceId: 'lockguard-no-record' } });
      ok('B5: ...and a device with neither a record nor a digest is refused, never admitted',
        res.code === 401 && res.body && res.body.error === 'parent-refused', 'code=' + res.code);
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord; seed[pcIp(IP_A)] = 10;
      const { res } = await pcPost({ seed, body: { action: 'verify', pin: CODE } });
      ok('B6: the verify path is subject to the ADDRESS dimension',
        res.code === 429 && res.body && res.body.error === 'parent-locked', 'code=' + res.code);
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord; seed[pcDev(PDEV)] = 5;
      const { res } = await pcPost({ seed, body: { action: 'verify', pin: CODE } });
      ok('B6: ...and to the DEVICE dimension',
        res.code === 429 && res.body && res.body.error === 'parent-locked', 'code=' + res.code);
    }
    {
      // No app-wide ceiling on this secret, deliberately: it is per-device, so a global one
      // would let a single grinder lock every parent in the app out of their own panel.
      const seed = {}; seed[pcRec(PDEV)] = liveRecord; seed['pc:v1:all:' + DAY] = 9999;
      const { res } = await pcPost({ seed, body: { action: 'verify', pin: CODE } });
      ok('B6: ...but NOT to any app-wide ceiling',
        res.code === 200 && res.body && res.body.ok === true, 'code=' + res.code);
    }
    {
      const { res } = await pcPost({ boom: true, body: { action: 'verify', pin: CODE } });
      ok('B7: an unreachable store fails CLOSED on verify',
        res.code === 429 && res.body && res.body.error === 'parent-unavailable', 'code=' + res.code);
    }
    {
      const { res } = await pcPost({ boom: true, body: { action: 'status' } });
      ok('B7: ...and on status, so the browser never falls into CREATE mode on an outage',
        res.code === 429 && res.body && res.body.error === 'parent-unavailable', 'code=' + res.code);
    }
    {
      const { res } = await pcPost({ body: { action: 'verify', pin: CODE, deviceId: 'no' } });
      ok('B7: ...and an unusable device id gets the ordinary refusal',
        res.code === 401 && res.body && res.body.error === 'parent-refused', 'code=' + res.code);
    }

    console.log('\n=== B9. F-115 — parent-code uses the same failed-only atomic contract ===');
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const store = fakeRedis(seed);
      const responses = [];
      for (let i = 0; i < 6; i++) {
        responses.push((await pcPostWithStore(store, { body: { action: 'verify', pin: CODE } })).res);
      }
      ok('B9: six correct parent codes all succeed without consuming failed-attempt allowance',
        responses.every((res) => res.code === 200 && res.body && res.body.ok === true)
        && store.map.get(pcDev(PDEV)) === undefined && store.map.get(pcIp(IP_A)) === undefined,
        JSON.stringify({ codes: responses.map((res) => res.code), dev: store.map.get(pcDev(PDEV)), ip: store.map.get(pcIp(IP_A)) }));
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const store = fakeRedis(seed);
      const responses = [];
      for (let i = 0; i < 6; i++) {
        responses.push((await pcPostWithStore(store, { body: { action: 'verify', pin: '9999' } })).res);
      }
      ok('B9: five wrong parent codes spend the allowance and the sixth is locked',
        responses.slice(0, 5).every((res) => res.code === 401 && res.body && res.body.error === 'parent-refused')
        && responses[5].code === 429 && responses[5].body && responses[5].body.error === 'parent-locked'
        && store.map.get(pcDev(PDEV)) === 5 && store.map.get(pcIp(IP_A)) === 5,
        JSON.stringify({ codes: responses.map((res) => res.code), dev: store.map.get(pcDev(PDEV)), ip: store.map.get(pcIp(IP_A)) }));
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord;
      const store = fakeRedis(seed);
      await pcPostWithStore(store, { body: { action: 'verify', pin: '9999' } });
      await pcPostWithStore(store, { body: { action: 'verify', pin: '9999' } });
      const success = (await pcPostWithStore(store, { body: { action: 'verify', pin: CODE } })).res;
      ok('B9: a later parent-code success neither spends nor clears earlier failures',
        success.code === 200 && store.map.get(pcDev(PDEV)) === 2 && store.map.get(pcIp(IP_A)) === 2,
        JSON.stringify({ code: success.code, dev: store.map.get(pcDev(PDEV)), ip: store.map.get(pcIp(IP_A)) }));
    }
    {
      const seed = {}; seed[pcRec(PDEV)] = liveRecord; seed[pcDev(PDEV)] = 4;
      const store = fakeRedis(seed);
      const responses = await Promise.all([
        pcPostWithStore(store, { body: { action: 'verify', pin: '9999' } }),
        pcPostWithStore(store, { body: { action: 'verify', pin: '9999' } }),
      ]);
      const codes = responses.map(({ res }) => res.code).sort((a, b) => a - b);
      ok('B9: concurrent parent-code failures atomically stop at the fifth failure',
        codes[0] === 401 && codes[1] === 429 && store.map.get(pcDev(PDEV)) === 5
        && store.map.get(pcIp(IP_A)) === 1,
        JSON.stringify({ codes, dev: store.map.get(pcDev(PDEV)), ip: store.map.get(pcIp(IP_A)) }));
    }

    // ── the browser half ──────────────────────────────────────────────────────
    const html = read('index.html');
    // The end marker also appears ABOVE ParentGate (the spend gate's own comment block), so the
    // search for it must start from the component, not from the top of the file.
    const pgAt = html.indexOf('function ParentGate({');
    const pg = html.slice(pgAt, html.indexOf('\n// قفل الإنفاق', pgAt));
    ok('B8: the browser no longer compares anything for the parent code',
      !/hashPin/.test(pg) && !/localStorage\.setItem\(\s*LEGACY_PIN_HASH_KEY/.test(html),
      'ParentGate must hold no verifier and write no digest');
    ok('B8: ...and the old key is READ once as a migration seed, then removed',
      /const LEGACY_PIN_HASH_KEY = 'parent_pin_hash';/.test(html)
      && /localStorage\.removeItem\(LEGACY_PIN_HASH_KEY\)/.test(html)
      && !/localStorage\.setItem\('parent_pin_hash'|setItem\(LEGACY_PIN_HASH_KEY/.test(html));
    ok('B8: ...ParentGate reaches the server for status, verify and set',
      /action: 'status'/.test(pg) && /action: 'verify'/.test(pg) && /action: 'set'/.test(pg)
      && /parentCodeCall/.test(pg));
    ok('B8: ...and an unknown status falls CLOSED to the verify form',
      /serverHas !== false/.test(pg),
      'anything other than a clear "no code here" must not offer the create form');
    ok('B8: the spend gate still owns hashPin, untouched',
      /if \(\(await hashPin\(code\)\) === SPEND_GATE_SHA256\) \{ onUnlock\(\); return; \}/.test(html));

    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n=== C. D06 — the founder token has an age and a name ===');
    // ══════════════════════════════════════════════════════════════════════════

    const FDEV = 'lockguard-founder-device';
    const NOW = Date.now();
    const sound = DC.founderTokenFor(FDEV);

    ok('C1: a freshly issued token carries a version, an expiry and a nonce',
      typeof sound === 'string' && sound.split('.').length === 4 && sound.split('.')[0] === 'v2',
      String(sound));
    {
      const exp = Number(sound.split('.')[1]) * 1000;
      const days = Math.round((exp - NOW) / 86400000);
      ok('C1: ...and the expiry is ninety days out, from the module constant',
        days === 90 && DC.FOUNDER_TOKEN_TTL_SECONDS === 90 * 24 * 60 * 60, 'days=' + days);
    }
    ok('C1: ...and two tokens for the SAME device differ, so each is separately revocable',
      DC.founderTokenFor(FDEV) !== DC.founderTokenFor(FDEV));
    ok('C2: a sound token verifies', DC.verifyFounder(FDEV, sound));
    ok('C2: ...for that device ONLY',
      !DC.verifyFounder('lockguard-other-founder-dev', sound));

    {
      const expired = DC.founderTokenFor(FDEV, { ttlSeconds: -60 });
      ok('C3: an EXPIRED token is refused', !DC.verifyFounder(FDEV, expired), String(expired));
      // ...and it was sound a moment before it expired, so C3 is measuring the expiry and not
      // some unrelated malformation.
      ok('C3: ...though the identical token verified before its expiry',
        DC.verifyFounder(FDEV, expired, Date.now() - 120000));
    }
    {
      // The three fields are all under the MAC: editing any one of them breaks it.
      const [, exp, nonce, mac] = sound.split('.');
      const pushedOut = ['v2', String(Number(exp) + 86400000), nonce, mac].join('.');
      const swappedNonce = ['v2', exp, 'AAAAAAAAAAAAAAAA', mac].join('.');
      ok('C4: an expiry pushed out by the holder breaks the MAC',
        !DC.verifyFounder(FDEV, pushedOut));
      ok('C4: ...and so does swapping in a different nonce',
        !DC.verifyFounder(FDEV, swappedNonce));
    }
    {
      // THE MIGRATION COST, ASSERTED. A v1 token is the bare HMAC over the device id, which is
      // exactly what shipped before D06. It must now be refused -- it has no expiry to honour
      // and no name to revoke, which is the whole defect being closed.
      const v1 = crypto.createHmac('sha256', process.env.FOUNDER_SECRET).update(FDEV).digest('base64url');
      ok('C5: a V1 token (bare HMAC, no expiry, no nonce) is refused after this deploy',
        !DC.verifyFounder(FDEV, v1), v1);
      ok('C5: ...and api/unlock.js issues the v2 shape, so re-entering the PIN is the whole remedy',
        /founderTokenFor\(deviceId\)/.test(read('api/unlock.js')));
    }

    // ── revocation ────────────────────────────────────────────────────────────
    {
      const store = fakeRedis({});
      DC.__setRedisForTest(store);
      try {
        const nonce = DC.founderTokenNonce(sound);
        ok('C6: the token names itself, readably, without the secret',
          nonce === sound.split('.')[2] && /^[A-Za-z0-9_-]{1,64}$/.test(nonce), String(nonce));

        const req = { headers: { [DC.DEVICE_HEADER]: FDEV, [DC.FOUNDER_HEADER]: sound } };
        ok('C6: an unrevoked token passes the full check',
          (await DC.hasUnrevokedFounderToken(req)) === true);

        // THE OWNER'S ENTIRE PROCEDURE: one member added to one set.
        await store.sadd(DC.FOUNDER_REVOKED_KEY, nonce);
        ok('C7: adding the nonce to the revocation set refuses THAT token',
          (await DC.hasUnrevokedFounderToken(req)) === false);
        ok('C7: ...without rotating the secret -- a DIFFERENT token still passes',
          (await DC.hasUnrevokedFounderToken({
            headers: { [DC.DEVICE_HEADER]: FDEV, [DC.FOUNDER_HEADER]: DC.founderTokenFor(FDEV) },
          })) === true);
        ok('C7: ...and the day-cap bypass honours the revocation too',
          (await DC.checkDayCap({ deviceId: FDEV, founderToken: sound })).reason !== 'founder');

        // A configured store we cannot READ is not an empty list.
        store.boom = true;
        ok('C8: a CONFIGURED but unreachable revocation list fails CLOSED',
          (await DC.hasUnrevokedFounderToken({
            headers: { [DC.DEVICE_HEADER]: FDEV, [DC.FOUNDER_HEADER]: DC.founderTokenFor(FDEV) },
          })) === false);
      } finally {
        DC.__setRedisForTest(null);
      }
    }
    {
      // No store credentials at all: there is no list, there never was, and nothing is on it.
      // Answering "revoked" here would silently strip the bypass in every environment without
      // KV for a reason that has nothing to do with any token.
      const restoreKv = envSandbox({ KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined });
      try {
        ok('C8: ...but an UNCONFIGURED store means nothing was ever revoked',
          (await DC.hasUnrevokedFounderToken({
            headers: { [DC.DEVICE_HEADER]: FDEV, [DC.FOUNDER_HEADER]: DC.founderTokenFor(FDEV) },
          })) === true);
      } finally { restoreKv(); }
    }

    // ── where the two checks are wired ───────────────────────────────────────
    ok('C9: the three PRIVILEGE sites take the full check',
      /await hasUnrevokedFounderToken\(req\)/.test(read('api/ask.js'))
      && /await hasUnrevokedFounderToken\(req\)/.test(read('api/unlock.js'))
      && /!\(await isFounderTokenRevoked\(founderToken\)\)/.test(read('lib/daycap.js')),
      'the tier lock, the PIN change and the day-cap bypass');
    ok('C9: ...and the two ROUTING sites stay synchronous, keeping the expiry',
      /return hasValidFounderToken\(req\);/.test(read('lib/ledger/flag.js'))
      && /return hasValidFounderToken\(req\);/.test(read('lib/legacy-policy-flag.js')),
      'isInternalTester decides which engine runs; it grants nothing, so it takes the sync check');
    {
      // The browser half: it cannot verify a signature without the secret, and does not pretend
      // to -- but a dead token must send the reader to the PIN screen rather than down a path
      // the server refuses in silence.
      const alive = html.slice(html.indexOf('const founderTokenAlive'), html.indexOf('const storeFounderToken'));
      ok('C10: the browser treats a V1 or EXPIRED token as no token',
        /p\.length !== 4 \|\| p\[0\] !== 'v2'/.test(alive) && /exp \* 1000 > Date\.now\(\)/.test(alive));
      ok('C10: ...and both the gate and the outgoing header use that SAME test',
        /return founderTokenAlive\(localStorage\.getItem\(FOUNDER_TOKEN_KEY\)\)/.test(html)
        && /if \(founderTokenAlive\(t\)\) h\['x-murabbi-founder'\] = t;/.test(html));
    }

  } finally {
    try { (await esm('api/parent-code.js')).__setRedisForTest(null); } catch (e) {}
    UNLOCK.__setRedisForTest(null);
    restoreEnv();
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
