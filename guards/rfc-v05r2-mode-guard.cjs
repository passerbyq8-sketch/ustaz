// guards/rfc-v05r2-mode-guard.cjs — the three-mode rollout switch: off / internal / public.
//
// WHY THIS GATE EXISTS. The switch these two paths shipped behind needed a value written into
// Upstash. MEASURED, not assumed: every secret in this project reads back empty because they are
// stored write-only, so that value cannot be written at all — the internal rollout the switch was
// designed for is unreachable rather than merely unset. The owner's decision is that the
// ENVIRONMENT carries the activation authority and the store becomes an optional brake.
//
// That is a change to the thing that decides who sees a different answer, so it is asserted here
// by ENUMERATION rather than by reading the code and agreeing with it:
//
//   off       nobody
//   internal  a server-verified internal tester, and nobody else
//   public    every reader
//   unset     the shipped model, unchanged — credential + store value + ceiling
//   garbage   off, because a typo must never be an activation
//
// AND THE FLOOR STILL GOVERNS. A mode alone activates nothing; without its env floor every mode
// reads as the shipped path. Two deliberate acts, not one.
//
// Offline. Redis is replaced by an in-memory double, so nothing here touches a real store.
//
// Usage: node guards/rfc-v05r2-mode-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

function fakeRedis() {
  const m = new Map();
  return {
    down: false,
    async get(k) { if (this.down) throw new Error('ECONNREFUSED'); return m.has(k) ? m.get(k) : null; },
    async set(k, v) { if (this.down) throw new Error('ECONNREFUSED'); m.set(k, v); return 'OK'; },
    _map: m,
  };
}

(async function main() {
  console.log('=== rfc-v05r2-mode-guard — off / internal / public ===');

  const FL = await esm('lib/ledger/flag.js');
  const LP = await esm('lib/legacy-policy-flag.js');
  const STORE = await esm('lib/ledger/redis.js');
  const DC = await esm('lib/daycap.js');

  const ORIGINAL = {
    LEDGER_RAG: process.env.LEDGER_RAG,
    RFC_V05_LEGACY_POLICY: process.env.RFC_V05_LEGACY_POLICY,
    RFC_V05_MODE: process.env.RFC_V05_MODE,
    DAILY_SEARCH_BUDGET: process.env.DAILY_SEARCH_BUDGET,
    FOUNDER_SECRET: process.env.FOUNDER_SECRET,
  };
  const restore = () => {
    for (const [k, v] of Object.entries(ORIGINAL)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };

  process.env.FOUNDER_SECRET = 'test-secret-for-the-mode-gate';
  const device = 'abcdefgh12345678';
  const internalReq = { headers: { 'x-murabbi-device': device, 'x-murabbi-founder': DC.founderTokenFor(device) } };
  const anonReq = { headers: {} };
  const forgedReq = { headers: { 'x-murabbi-device': device, 'x-murabbi-founder': 'not-the-token' } };

  const redis = fakeRedis();
  STORE.__setRedisForTest(redis);

  let clock = 0;
  // Every decision is taken past the flag's in-memory TTL and with both caches reset, so no
  // assertion below can be reading a value another assertion left behind.
  const fresh = () => { clock += 100000; FL.__resetFlagCacheForTest(); LP.__resetLegacyFlagCacheForTest(); return clock; };
  const setEnv = (o) => {
    for (const k of ['LEDGER_RAG', 'RFC_V05_LEGACY_POLICY', 'RFC_V05_MODE', 'DAILY_SEARCH_BUDGET']) delete process.env[k];
    for (const [k, v] of Object.entries(o)) process.env[k] = v;
  };
  const FLOORS = { LEDGER_RAG: 'on', RFC_V05_LEGACY_POLICY: 'on', DAILY_SEARCH_BUDGET: '20' };

  // =========================================================================
  console.log('\n=== A. THE MODE VALUE ITSELF ===');
  {
    setEnv({});
    eq('an unset mode is «unset», not «public»', FL.envMode(), 'unset');
    for (const [v, want] of [['off', 'off'], ['internal', 'internal'], ['public', 'public'],
      ['OFF', 'off'], ['Internal', 'internal'], ['  public  ', 'public']]) {
      process.env.RFC_V05_MODE = v;
      eq('«' + v + '» reads as ' + want, FL.envMode(), want);
    }
    for (const bad of ['on', 'true', '1', 'yes', 'publik', 'internal-ish', 'PUBLIC!', '2']) {
      process.env.RFC_V05_MODE = bad;
      eq('an unrecognised mode «' + bad + '» is off', FL.envMode(), 'off');
    }
    ok('both switches read ONE definition of the mode', FL.envMode === LP.envMode);
  }

  // =========================================================================
  console.log('\n=== B. off — NOBODY ===');
  {
    setEnv({ ...FLOORS, RFC_V05_MODE: 'off' });
    redis._map.clear();
    for (const [label, req] of [['anonymous', anonReq], ['internal tester', internalReq]]) {
      let t = fresh();
      eq('mode=off, ' + label + ' => legacy', (await FL.decidePath(req, t)).path, 'legacy');
      t = fresh();
      eq('mode=off, ' + label + ' => policy repairs off', (await LP.decideLegacyPolicy(req, t)).enabled, false);
    }
    let t = fresh();
    eq('...and the reason names the mode', (await FL.decidePath(anonReq, t)).reason, 'mode_off');
  }

  // =========================================================================
  console.log('\n=== C. internal — THE VERIFIED TESTER, AND NOBODY ELSE ===');
  {
    setEnv({ ...FLOORS, RFC_V05_MODE: 'internal' });
    redis._map.clear();
    let t = fresh();
    eq('internal + anonymous => legacy', (await FL.decidePath(anonReq, t)).path, 'legacy');
    t = fresh();
    eq('...and the reason is the credential', (await FL.decidePath(anonReq, t)).reason, 'not_internal');
    t = fresh();
    eq('internal + FORGED token => legacy', (await FL.decidePath(forgedReq, t)).path, 'legacy');
    t = fresh();
    eq('internal + founder credential => ledger', (await FL.decidePath(internalReq, t)).path, 'ledger');
    t = fresh();
    eq('...and the reason names the mode', (await FL.decidePath(internalReq, t)).reason, 'mode_internal');

    t = fresh();
    eq('internal + anonymous => policy repairs off', (await LP.decideLegacyPolicy(anonReq, t)).enabled, false);
    t = fresh();
    eq('internal + founder => policy repairs on', (await LP.decideLegacyPolicy(internalReq, t)).enabled, true);
  }

  // =========================================================================
  console.log('\n=== D. public — EVERY READER ===');
  {
    setEnv({ ...FLOORS, RFC_V05_MODE: 'public' });
    redis._map.clear();
    let t = fresh();
    eq('public + anonymous => ledger', (await FL.decidePath(anonReq, t)).path, 'ledger');
    t = fresh();
    eq('...and the reason names the mode', (await FL.decidePath(anonReq, t)).reason, 'mode_public');
    t = fresh();
    eq('public + anonymous => policy repairs on', (await LP.decideLegacyPolicy(anonReq, t)).enabled, true);
    t = fresh();
    eq('public + forged token is still just a reader => ledger', (await FL.decidePath(forgedReq, t)).path, 'ledger');
  }

  // =========================================================================
  console.log('\n=== E. THE FLOOR STILL GOVERNS — A MODE ALONE ACTIVATES NOTHING ===');
  {
    redis._map.clear();
    setEnv({ RFC_V05_MODE: 'public', DAILY_SEARCH_BUDGET: '20' });
    let t = fresh();
    eq('public with NO ledger floor => legacy', (await FL.decidePath(anonReq, t)).path, 'legacy');
    t = fresh();
    eq('...and the reason is the floor', (await FL.decidePath(anonReq, t)).reason, 'env_floor_off');
    t = fresh();
    eq('public with NO policy floor => repairs off', (await LP.decideLegacyPolicy(anonReq, t)).enabled, false);
  }

  // =========================================================================
  console.log('\n=== F. THE DAY CEILING IS STILL A PRECONDITION OF THE LEDGER ===');
  {
    redis._map.clear();
    setEnv({ LEDGER_RAG: 'on', RFC_V05_LEGACY_POLICY: 'on', RFC_V05_MODE: 'public' });
    let t = fresh();
    eq('public with no ceiling => legacy', (await FL.decidePath(anonReq, t)).path, 'legacy');
    t = fresh();
    eq('...and the reason names the budget', (await FL.decidePath(anonReq, t)).reason, 'daily_budget_unconfigured');
    for (const bad of ['', 'lots', '-1', '2.5']) {
      setEnv({ LEDGER_RAG: 'on', RFC_V05_MODE: 'public', DAILY_SEARCH_BUDGET: bad });
      t = fresh();
      eq('a garbled ceiling «' + bad + '» is not a ceiling', (await FL.decidePath(anonReq, t)).path, 'legacy');
    }
  }

  // =========================================================================
  console.log('\n=== G. THE KILL SWITCH — AN INSTANT RETURN TO THE SHIPPED PATH ===');
  {
    setEnv({ ...FLOORS, RFC_V05_MODE: 'public' });
    // Running, then killed by one written value, with no deploy in between.
    redis._map.clear();
    let t = fresh();
    eq('before the kill, public reaches the ledger', (await FL.decidePath(anonReq, t)).path, 'ledger');

    for (const stop of ['off', 'false', '0', false, 0]) {
      redis._map.clear();
      redis._map.set(FL.RUNTIME_KEY, stop);
      t = fresh();
      eq('an explicit ' + JSON.stringify(stop) + ' in the store kills the ledger',
        (await FL.decidePath(anonReq, t)).path, 'legacy');
      t = fresh();
      eq('...and kills the policy repairs too', (await LP.decideLegacyPolicy(anonReq, t)).enabled, false);
    }
    redis._map.clear();
    redis._map.set(FL.RUNTIME_KEY, 'off');
    t = fresh();
    eq('...and the reason names the kill switch', (await FL.decidePath(anonReq, t)).reason, 'kill_switch');

    // A value nobody defined is an instruction somebody wrote. It stops rather than runs.
    for (const junk of ['maybe', 2, {}, 'ON!']) {
      redis._map.clear();
      redis._map.set(FL.RUNTIME_KEY, junk);
      t = fresh();
      eq('a malformed store value ' + JSON.stringify(junk) + ' stops the path',
        (await FL.decidePath(anonReq, t)).path, 'legacy');
    }

    // An affirmative value is the store agreeing, not the store activating.
    for (const go of [true, 1, 'on', 'true', '1']) {
      redis._map.clear();
      redis._map.set(FL.RUNTIME_KEY, go);
      t = fresh();
      eq('an affirmative ' + JSON.stringify(go) + ' leaves the path running',
        (await FL.decidePath(anonReq, t)).path, 'ledger');
    }
  }

  // =========================================================================
  console.log('\n=== H. AN UNREACHABLE STORE DOES NOT BLOCK — THE ENV IS THE AUTHORITY ===');
  {
    // The owner's decision, recorded as a test so it is a property rather than a comment: the
    // brake may fail to engage, and when it does the environment still governs. The store cannot
    // grant permission, so a store that is down cannot withhold one either.
    setEnv({ ...FLOORS, RFC_V05_MODE: 'public' });
    redis._map.clear();
    redis.down = true;
    let t = fresh();
    eq('mode=public with the store DOWN => still ledger', (await FL.decidePath(anonReq, t)).path, 'ledger');
    t = fresh();
    eq('...and the policy repairs stay on', (await LP.decideLegacyPolicy(anonReq, t)).enabled, true);
    redis.down = false;

    STORE.__setRedisForTest(null);
    t = fresh();
    eq('NO store configured at all => mode still governs', (await FL.decidePath(anonReq, t)).path, 'ledger');
    STORE.__setRedisForTest(redis);

    // ── THE CACHE MUST NOT INVENT A KILL ───────────────────────────────────
    // A cache hit reports source 'cache', which says only that the value was read recently and
    // NOTHING about whether the store ever answered. Deciding the brake on `source` meant an
    // unreachable store ran on its first read and stopped on every read for the next few seconds:
    // a brake that grabs on its own, which is worse than no brake because it looks like one. The
    // decision is made on `origin`, and these read WITHIN the TTL on purpose.
    STORE.__setRedisForTest(null);
    FL.__resetFlagCacheForTest();
    const t0 = 5_000_000;
    eq('an unreachable store reads as unavailable', (await FL.readRuntimeFlag(t0)).source, 'unavailable');
    eq('...and a read inside the TTL is a cache hit', (await FL.readRuntimeFlag(t0 + 100)).source, 'cache');
    eq('...whose ORIGIN still says unavailable', (await FL.readRuntimeFlag(t0 + 200)).origin, 'unavailable');
    eq('...so the brake stays off on the fresh read', await FL.killSwitchEngaged(t0 + 300), false);
    eq('...and stays off on the cached read', await FL.killSwitchEngaged(t0 + 400), false);
    eq('...and the path is still the ledger', (await FL.decidePath(anonReq, t0 + 500)).path, 'ledger');

    // The same for an ABSENT key, which is the actual production state.
    STORE.__setRedisForTest(redis);
    redis._map.clear();
    FL.__resetFlagCacheForTest();
    const t1 = 6_000_000;
    eq('an absent key reads as absent', (await FL.readRuntimeFlag(t1)).source, 'absent');
    eq('...its cached read keeps origin absent', (await FL.readRuntimeFlag(t1 + 100)).origin, 'absent');
    eq('...and repeated decisions inside the TTL all reach the ledger',
      [(await FL.decidePath(anonReq, t1 + 200)).path, (await FL.decidePath(anonReq, t1 + 300)).path,
        (await FL.decidePath(anonReq, t1 + 400)).path].join(','), 'ledger,ledger,ledger');
    eq('...and the policy repairs stay on across cached reads',
      [(await LP.decideLegacyPolicy(anonReq, t1 + 500)).enabled,
        (await LP.decideLegacyPolicy(anonReq, t1 + 600)).enabled].join(','), 'true,true');

    // And an EXPLICIT off must still kill through the cache.
    redis._map.set(FL.RUNTIME_KEY, 'off');
    FL.__resetFlagCacheForTest();
    const t2 = 7_000_000;
    eq('an explicit off kills on the fresh read', (await FL.decidePath(anonReq, t2)).reason, 'kill_switch');
    eq('...and stays killed on the cached read', (await FL.decidePath(anonReq, t2 + 100)).reason, 'kill_switch');
    redis._map.clear();
  }

  // =========================================================================
  console.log('\n=== I. WITH NO MODE SET, THE SHIPPED MODEL IS UNCHANGED ===');
  {
    // This is the arm production runs on today, and the one that keeps every earlier gate honest:
    // credential AND a store value AND a ceiling, with every failure reading as legacy.
    setEnv({ ...FLOORS });
    redis._map.clear();
    let t = fresh();
    eq('unset + anonymous => legacy', (await FL.decidePath(anonReq, t)).path, 'legacy');
    t = fresh();
    eq('unset + internal + NO store value => legacy', (await FL.decidePath(internalReq, t)).path, 'legacy');
    redis._map.set(FL.RUNTIME_KEY, true);
    t = fresh();
    eq('unset + internal + store value on => ledger', (await FL.decidePath(internalReq, t)).path, 'ledger');
    redis.down = true;
    t = fresh();
    eq('unset + internal + store DOWN => legacy (the shipped fail-off)',
      (await FL.decidePath(internalReq, t)).path, 'legacy');
    redis.down = false;
  }

  // =========================================================================
  console.log('\n=== J. THE MODE IS NOT SOMETHING A READER CAN SEND ===');
  {
    ok('neither switch reads a mode off the request',
      !/body\.(mode|rfc|ledger|flag)|req\.query|searchParams/.test(read('lib/ledger/flag.js'))
      && !/body\.(mode|rfc|ledger|flag)|req\.query|searchParams/.test(read('lib/legacy-policy-flag.js')));
    ok('the founder check is still the ONLY identity either switch trusts',
      /hasValidFounderToken/.test(read('lib/ledger/flag.js'))
      && /hasValidFounderToken/.test(read('lib/legacy-policy-flag.js')));
    ok('neither switch writes an environment variable',
      !/process\.env\.[A-Z_]+\s*=[^=]/.test(read('lib/ledger/flag.js'))
      && !/process\.env\.[A-Z_]+\s*=[^=]/.test(read('lib/legacy-policy-flag.js')));
    ok('no secret value is logged by either switch',
      !/console\.(log|warn|error)/.test(read('lib/ledger/flag.js'))
      && !/console\.(log|warn|error)/.test(read('lib/legacy-policy-flag.js')));
  }

  restore();
  STORE.__resetRedis();
  console.log('\n' + (failures ? 'FAIL ' : 'PASS ') + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
