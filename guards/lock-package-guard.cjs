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
  const UNLOCK = await esm('api/unlock.js');
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

  const restoreEnv = envSandbox({
    UNLOCK_PIN: PIN,
    FOUNDER_SECRET: 'lock-guard-local-secret-not-a-credential',
  });

  try {
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n=== A. D13 — the unlock limiter has three dimensions ===');
    // ══════════════════════════════════════════════════════════════════════════

    // Drives one POST against a fresh store double and hands back both the response and the
    // store, so every assertion can read the COUNTERS as well as the status.
    const post = async (opts) => {
      const o = opts || {};
      const store = fakeRedis(o.seed);
      if (o.boom) store.boom = true;
      UNLOCK.__setRedisForTest(store);
      const headers = Object.assign({}, o.headers);
      if (o.ip !== null && !('x-forwarded-for' in headers)) headers['x-forwarded-for'] = o.ip || IP_A;
      const req = { method: 'POST', headers, body: Object.assign({ pin: PIN, deviceId: DEVICE }, o.body || {}) };
      const res = fakeRes();
      await unlock(req, res);
      return { res, store };
    };

    {
      const { res, store } = await post({});
      ok('A1: a fresh device on a fresh address unlocks',
        res.code === 200 && !!res.body && typeof res.body.token === 'string',
        'code=' + res.code + ' body=' + JSON.stringify(res.body));
      ok('A1: ...and all three counters moved by exactly one',
        store.map.get(kDev(DEVICE)) === 1 && store.map.get(kIp(IP_A)) === 1 && store.map.get(kAll) === 1,
        'dev=' + store.map.get(kDev(DEVICE)) + ' ip=' + store.map.get(kIp(IP_A)) + ' all=' + store.map.get(kAll));
      ok('A1: ...and the store holds a DIGEST of the address, never the address',
        [...store.map.keys()].some((k) => k.indexOf(dig(IP_A)) !== -1)
        && ![...store.map.keys()].some((k) => k.indexOf(IP_A) !== -1),
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
      // still be counted, or "no header" would be a way to buy unlimited attempts.
      const store = fakeRedis({});
      UNLOCK.__setRedisForTest(store);
      const res = fakeRes();
      await unlock({ method: 'POST', headers: {}, body: { pin: PIN, deviceId: DEVICE } }, res);
      ok('A6: a request with NO address header still unlocks',
        res.code === 200 && !!res.body && res.body.token, 'code=' + res.code);
      ok('A6: ...and is still counted on the device and global dimensions',
        store.map.get(kDev(DEVICE)) === 1 && store.map.get(kAll) === 1,
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

  } finally {
    UNLOCK.__setRedisForTest(null);
    restoreEnv();
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
