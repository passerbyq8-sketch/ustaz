// guards/rfc-v05r2-mode-guard.cjs — the three-mode rollout switch: off / internal / public.
//
// WHY THIS GATE EXISTS. The switch these two paths shipped behind needed a value written into
// Upstash, and that value has never been written.
//
// A CLAIM STAMPED «MEASURED» STOOD HERE AND WAS FALSE (corrected 2026-08-07). It read: «every
// secret in this project reads back empty because they are stored write-only, so that value
// cannot be written at all». It was copied from lib/ledger/flag.js, which had not measured it
// either. Measured on 2026-08-07 against the live store: PING -> PONG, DBSIZE -> 66, and
// `lg:flag:ledger_rag_enabled` -> null alongside live `lg:t:*` / `lg:dsb:*` records. Reads work.
// The runtime value is ABSENT, not unreadable, and whether this project can WRITE it was never
// attempted and remains unmeasured. See lib/ledger/flag.js for the full correction.
//
// THE ENUMERATION BELOW IS UNAFFECTED, and so is the owner's decision that the ENVIRONMENT
// carries the activation authority while the store is an optional brake — that was a decision of
// 2026-08-05, not an inference from the false sentence.
//
// That is a change to the thing that decides who sees a different answer, so it is asserted here
// by ENUMERATION rather than by reading the code and agreeing with it:
//
//   off       nobody
//   internal  a server-verified internal tester, and nobody else
//   public    every reader
//   unset     PUBLIC, since the go-live of 2026-08-05 (lib/ledger/flag.js PUBLIC_GO_LIVE). It used
//             to mean the credential+store rollout; that arm still exists in the source and is
//             what flipping the constant back restores, which section I asserts structurally
//             because a constant no runtime can change cannot be asserted any other way.
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
const { withRestoredProcessEnv } = require('../tools/guard-env.cjs');

const ENV_KEYS = ['LEDGER_RAG', 'RFC_V05_LEGACY_POLICY', 'RFC_V05_MODE',
  'VERCEL_ENV', 'SEARCH_BUDGET_GLOBAL_PRODUCTION', 'SEARCH_BUDGET_GLOBAL_PREVIEW',
  'SEARCH_BUDGET_GLOBAL_DEVELOPMENT', 'SEARCH_BUDGET_PER_CALLER', 'FOUNDER_SECRET'];

const REPO = path.join(__dirname, '..');
const sourceArg = (name) => {
  const at = process.argv.indexOf(name);
  return at >= 0 && process.argv[at + 1] ? path.resolve(process.argv[at + 1]) : null;
};
const DOC_SOURCES = new Map([
  ['EZIK-RFC-V0.5-R2-FROZEN.md', sourceArg('--frozen-source')],
  ['EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md', sourceArg('--report-source')],
]);
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
const read = (rel) => fs.readFileSync(DOC_SOURCES.get(rel) || path.join(REPO, rel), 'utf8');
function f198Truth(rel) {
  const match = read(rel).match(/<!-- F198_CURRENT_TRUTH_BEGIN -->\s*```text\s*([\s\S]*?)\s*```\s*<!-- F198_CURRENT_TRUTH_END -->/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf('=');
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

function fakeRedis() {
  const m = new Map();
  return {
    down: false,
    async get(k) { if (this.down) throw new Error('ECONNREFUSED'); return m.has(k) ? m.get(k) : null; },
    async set(k, v) { if (this.down) throw new Error('ECONNREFUSED'); m.set(k, v); return 'OK'; },
    _map: m,
  };
}

async function main() {
  console.log('=== rfc-v05r2-mode-guard — off / internal / public ===');

  const FL = await esm('lib/ledger/flag.js');
  const DB = await esm('lib/ledger/daily-budget.js');
  const LP = await esm('lib/legacy-policy-flag.js');
  const STORE = await esm('lib/ledger/redis.js');
  const DC = await esm('lib/daycap.js');

  const ORIGINAL = {
    LEDGER_RAG: process.env.LEDGER_RAG,
    RFC_V05_LEGACY_POLICY: process.env.RFC_V05_LEGACY_POLICY,
    RFC_V05_MODE: process.env.RFC_V05_MODE,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SEARCH_BUDGET_GLOBAL_PREVIEW: process.env.SEARCH_BUDGET_GLOBAL_PREVIEW,
    SEARCH_BUDGET_PER_CALLER: process.env.SEARCH_BUDGET_PER_CALLER,
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
    for (const k of ['LEDGER_RAG', 'RFC_V05_LEGACY_POLICY', 'RFC_V05_MODE', 'VERCEL_ENV',
      'SEARCH_BUDGET_GLOBAL_PRODUCTION', 'SEARCH_BUDGET_GLOBAL_PREVIEW',
      'SEARCH_BUDGET_GLOBAL_DEVELOPMENT', 'SEARCH_BUDGET_PER_CALLER']) delete process.env[k];
    for (const [k, v] of Object.entries(o)) process.env[k] = v;
  };
  const FLOORS = {
    LEDGER_RAG: 'on', RFC_V05_LEGACY_POLICY: 'on', VERCEL_ENV: 'preview',
    SEARCH_BUDGET_GLOBAL_PREVIEW: '40', SEARCH_BUDGET_PER_CALLER: '20',
  };

  // =========================================================================
  console.log('\n=== A. THE MODE VALUE ITSELF ===');
  {
    setEnv({});
    // SINCE THE PUBLIC GO-LIVE an unset mode reads as «public» rather than «unset». The three
    // written values are untouched, and an unrecognised one is still «off» — a typo must never be
    // an activation, and that property is what the loop below still proves.
    eq('an unset mode follows PUBLIC_GO_LIVE', FL.envMode(), FL.PUBLIC_GO_LIVE ? 'public' : 'unset');
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
    // THE FLOOR IS NOW WRITTEN, NOT ABSENT. Before the go-live an unset LEDGER_RAG was itself the
    // closed floor, so «no floor» and «floor off» were the same test. They are different now: an
    // unset floor is OPEN, and only an explicit `off` closes it. That explicit `off` is the brake
    // the go-live promised to keep, so it is what this section asserts.
    setEnv({ ...FLOORS, LEDGER_RAG: 'off', RFC_V05_MODE: 'public' });
    let t = fresh();
    eq('public with the ledger floor CLOSED => legacy', (await FL.decidePath(anonReq, t)).path, 'legacy');
    t = fresh();
    eq('...and the reason is the floor', (await FL.decidePath(anonReq, t)).reason, 'env_floor_off');
    t = fresh();
    eq('...and it closes for an internal tester just the same',
      (await FL.decidePath(internalReq, t)).path, 'legacy');
    // The POLICY floor is a separate env var and is unchanged by the go-live: it is still off
    // unless RFC_V05_LEGACY_POLICY says otherwise.
    setEnv({
      LEDGER_RAG: 'on', VERCEL_ENV: 'preview', SEARCH_BUDGET_GLOBAL_PREVIEW: '40',
      SEARCH_BUDGET_PER_CALLER: '20', RFC_V05_MODE: 'public',
    });
    t = fresh();
    eq('public with NO policy floor => repairs off', (await LP.decideLegacyPolicy(anonReq, t)).enabled, false);
  }

  // =========================================================================
  console.log('\n=== F. THE DAY CEILING EXISTS BY CONSTRUCTION ===');
  {
    // RFC v0.5-R2 §9's promise — the path never runs without a ceiling — is kept by the budget
    // constructor, not by an unreachable decidePath branch. What the go-live changed is where it
    // comes from when nobody wrote one: it used to come from nowhere, which made an unconfigured
    // budget the thing
    // that switched the whole feature off. For a public path that is a trap, not a safeguard, so
    // there is a code default and the promise is kept by construction instead.
    //
    // So the assertions invert: rather than "no ceiling => legacy", the claim is now "there is
    // always a ceiling, it is a real finite number, a typo can never remove it, and a written
    // value still governs".
    redis._map.clear();
    setEnv({ LEDGER_RAG: 'on', RFC_V05_LEGACY_POLICY: 'on', RFC_V05_MODE: 'public',
      VERCEL_ENV: 'preview', SEARCH_BUDGET_PER_CALLER: '20' });
    eq('an unwritten v2 global ceiling is unconfigured, never unlimited', DB.configuredLimit(), null);
    eq('...so paid search is fail-closed until the global cap is configured', DB.isConfigured(), false);
    let t = fresh();
    eq('retrieval routing stays public while paid transport remains capped downstream',
      (await FL.decidePath(anonReq, t)).path, 'ledger');
    for (const bad of ['', 'lots', '-1', '2.5', 'Infinity']) {
      setEnv({ LEDGER_RAG: 'on', RFC_V05_MODE: 'public', VERCEL_ENV: 'preview',
        SEARCH_BUDGET_GLOBAL_PREVIEW: bad, SEARCH_BUDGET_PER_CALLER: '20' });
      eq('a garbled ceiling «' + bad + '» fails closed', DB.configuredLimit(), null);
    }
    setEnv({ LEDGER_RAG: 'on', RFC_V05_MODE: 'public', VERCEL_ENV: 'preview',
      SEARCH_BUDGET_GLOBAL_PREVIEW: '40', SEARCH_BUDGET_PER_CALLER: '20' });
    eq('a written environment ceiling governs', DB.configuredLimit(), 40);
    setEnv({ LEDGER_RAG: 'on', RFC_V05_MODE: 'public', VERCEL_ENV: 'preview',
      SEARCH_BUDGET_GLOBAL_PREVIEW: '0', SEARCH_BUDGET_PER_CALLER: '20' });
    eq('an explicit zero is honoured, not overwritten by the default', DB.configuredLimit(), 0);
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
  console.log('\n=== I. WITH NO MODE SET, THE PATH IS PUBLIC — AND THE ROLLBACK IS INTACT ===');
  {
    // WHAT AN UNCONFIGURED DEPLOYMENT DOES. This is the state a fresh production environment is
    // in: no mode, no floor, no ceiling, nothing in the store. Before the go-live it meant OFF;
    // it now means the engine, for everybody, which is the whole point of the change.
    setEnv({});
    redis._map.clear();
    let t = fresh();
    eq('nothing set at all + anonymous => ledger', (await FL.decidePath(anonReq, t)).path, 'ledger');
    t = fresh();
    eq('...and the reason names the mode', (await FL.decidePath(anonReq, t)).reason, 'mode_public');
    t = fresh();
    eq('nothing set at all + internal => ledger', (await FL.decidePath(internalReq, t)).path, 'ledger');
    // ...and an unreachable store does not take it down, because the store only ever brakes now.
    redis.down = true;
    t = fresh();
    eq('...and a store that is DOWN leaves the environment in charge',
      (await FL.decidePath(anonReq, t)).path, 'ledger');
    redis.down = false;

    // THE ROLLBACK IS ONE CONSTANT, AND IT IS STILL WIRED. `mode === 'unset'` is unreachable
    // while PUBLIC_GO_LIVE is true, so it cannot be driven here — but it is the arm that comes
    // back if the constant is flipped, and an arm nobody checks is an arm that quietly rots. So
    // it is asserted on the SOURCE: the credential and store-value tests are still there, in that
    // order, under a branch guarded by an unset mode.
    const flagSrc = read('lib/ledger/flag.js');
    ok('the shipped rollout arm still exists for `unset`',
      /if \(mode !== 'unset'\)[\s\S]*?if \(!isInternalTester\(req\)\) return \{ path: 'legacy', reason: 'not_internal' \}/.test(flagSrc));
    ok('...and the dead unconfigured-budget arm is not between credential and store',
      /reason: 'not_internal' \}[\s\S]{0,500}?readRuntimeFlag\(now\)/.test(flagSrc)
      && !/daily_budget_unconfigured/.test(flagSrc));
    ok('...and flipping PUBLIC_GO_LIVE back to false is what restores it',
      /if \(v === ''\) return PUBLIC_GO_LIVE;/.test(flagSrc)
      && /if \(raw === ''\) return PUBLIC_GO_LIVE \? 'public' : 'unset';/.test(flagSrc));
    ok('...and the constant is a single declared boolean, not a computed expression',
      /export const PUBLIC_GO_LIVE = (true|false);/.test(flagSrc));
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

  // =========================================================================
  console.log('\n=== K. F-198 — DOCUMENTATION FOLLOWS THE EXECUTED TRUTH TABLE ===');
  {
    setEnv({});
    redis._map.clear();
    const t = fresh();
    const ledgerDecision = await FL.decidePath(anonReq, t);
    const legacyDecision = await LP.decideLegacyPolicy(anonReq, fresh());
    const flagSource = read('lib/ledger/flag.js');
    const modeLine = flagSource.match(/if \(raw === 'off' \|\| raw === 'internal' \|\| raw === 'public'\) return raw;/);
    const acceptedModes = modeLine ? Array.from(modeLine[0].matchAll(/'([^']+)'/g), (m) => m[1]) : [];
    ok('F-198: accepted RFC_V05_MODE values are derived and executable',
      acceptedModes.length > 0 && acceptedModes.every((mode) => {
        process.env.RFC_V05_MODE = mode;
        return FL.envMode() === mode;
      }), JSON.stringify(acceptedModes));
    setEnv({});

    const askSource = read('api/ask.js');
    const correctionsRuntime = /planAsk\(body\.messages, \{ policyEnabled: true \}\)/.test(askSource)
      && /policyEnabled: legacyPolicy\.enabled, flag: legacyPolicy\.reason/.test(askSource)
      ? 'unconditional' : 'flag-gated';
    const vercelSource = read('vercel.json');
    const trackedRolloutEnv = /RFC_V05_MODE|LEDGER_RAG|RFC_V05_LEGACY_POLICY/.test(vercelSource)
      ? 'present' : 'absent';
    const expected = {
      PUBLIC_GO_LIVE: String(FL.PUBLIC_GO_LIVE),
      LEDGER_DEFAULT_ENABLED: String(FL.DEFAULT_ENABLED),
      RFC_V05_MODE_ACCEPTED: acceptedModes.join(','),
      RFC_V05_MODE_UNSET: FL.envMode(),
      RFC_V05_MODE_UNKNOWN: (() => { process.env.RFC_V05_MODE = 'not-a-mode'; const v = FL.envMode(); delete process.env.RFC_V05_MODE; return v; })(),
      LEDGER_RAG_UNSET_ALLOWS: String(FL.envAllows()),
      DECIDE_PATH_UNSET_ANON: ledgerDecision.path + ':' + ledgerDecision.reason,
      LEGACY_POLICY_DEFAULT_ENABLED: String(LP.DEFAULT_ENABLED),
      RFC_V05_LEGACY_POLICY_UNSET_ALLOWS: String(LP.envAllows()),
      DECIDE_LEGACY_POLICY_UNSET_ANON: String(legacyDecision.enabled) + ':' + legacyDecision.reason,
      LEGACY_REPAIRS_RUNTIME: correctionsRuntime,
      TRACKED_DEPLOYMENT_ROLLOUT_ENV: trackedRolloutEnv,
      DEPLOYMENT_SNAPSHOT: 'UNMEASURED_OFFLINE',
    };
    for (const rel of ['EZIK-RFC-V0.5-R2-FROZEN.md', 'EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md']) {
      const truth = f198Truth(rel);
      ok('F-198: ' + rel + ' carries a machine-checked current truth block', !!truth,
        'missing F198_CURRENT_TRUTH block');
      if (!truth) continue;
      for (const [key, value] of Object.entries(expected)) {
        eq('F-198: ' + rel + ' documents ' + key, truth[key], value);
      }
      eq('F-198: ' + rel + ' distinguishes default code from deployment evidence',
        truth.DEFAULT_CODE_VS_DEPLOYMENT,
        'code-default-is-measured;effective-deployment-is-not');
      eq('F-198: ' + rel + ' labels the old rollout record historical',
        truth.OLD_ROLLOUT_SNAPSHOT, 'HISTORICAL_ONLY');
    }
  }

  restore();
  STORE.__resetRedis();
  console.log('\n' + (failures ? 'FAIL ' : 'PASS ') + (checks - failures) + '/' + checks);
  return failures ? 1 : 0;
}

withRestoredProcessEnv(ENV_KEYS, main).then((code) => {
  process.exitCode = code;
}).catch((e) => { console.error(e); process.exitCode = 1; });
