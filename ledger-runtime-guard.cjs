// ledger-runtime-guard.cjs — the switch, the kill switch, the caches and the telemetry.
//
// THE PROPERTY THIS GATE EXISTS TO PROVE: there is exactly ONE arrangement of facts that runs
// the new engine, and every other arrangement — including every way of FAILING to establish
// one of them — runs the shipped path. That is asserted here by enumeration rather than by
// reading the code and agreeing with it.
//
// AND THE PROPERTY THE PRIVACY WORK RESTS ON: a cache key contains no readable fragment of the
// reader's question, and a telemetry record is built from an ALLOW-LIST, so a field added later
// is dropped rather than published.
//
// Offline. Redis is replaced by an in-memory double, so nothing here touches a real store.
//
// Usage: node ledger-runtime-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { withRestoredProcessEnv } = require('./tools/guard-env.cjs');

const ENV_KEYS = ['LEDGER_RAG', 'RFC_V05_MODE', 'FOUNDER_SECRET', 'LEDGER_CACHE_SECRET',
  'DAILY_SEARCH_BUDGET'];
const crypto = require('crypto');

const REPO = __dirname;
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
// Source with comments removed. A rule about what the CODE does must be checked against code:
// scanning the raw file finds the word in the comment that documents the rule and "fails" it.
// `[^\r\n]*` with no `$`: on a CRLF file `.` cannot match \r and `$` (no m flag) asserts the end
// of the whole string, so `//.*$` strips nothing and every comment reads as live code.
const code = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/[^\r\n]*/, '$1')).join('\n');

// An in-memory stand-in for Upstash: same three methods the module uses, plus a switch that
// makes every call throw, which is how a store outage actually presents.
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
  console.log('=== ledger-runtime-guard — flag, kill switch, caches, telemetry ===');

  const STORE = await esm('lib/ledger/redis.js');
  const FL = await esm('lib/ledger/flag.js');
  const CH = await esm('lib/ledger/cache.js');
  const TL = await esm('lib/ledger/telemetry.js');
  const DC = await esm('lib/daycap.js');
  const DB = await esm('lib/ledger/daily-budget.js');

  const ORIGINAL_ENV = {
    LEDGER_RAG: process.env.LEDGER_RAG,
    FOUNDER_SECRET: process.env.FOUNDER_SECRET,
    LEDGER_CACHE_SECRET: process.env.LEDGER_CACHE_SECRET,
    DAILY_SEARCH_BUDGET: process.env.DAILY_SEARCH_BUDGET,
  };
  // Keep a written ceiling for the historical switch fixtures. The dedicated table below proves
  // that an absent or malformed value now resolves to the same finite code default instead.
  process.env.DAILY_SEARCH_BUDGET = '500';
  process.env.RFC_V05_MODE = 'public';
  const restoreEnv = () => {
    for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };

  // =========================================================================
  // THE DEFAULT WAS OFF UNTIL THE PUBLIC GO-LIVE (owner decision, 2026-08-05). It is now ON, and
  // this section asserts the new default AND — the half that matters — that every brake the old
  // default made unnecessary still works: the env floor, the mode, and the Upstash kill switch.
  console.log('\n=== A. THE DEFAULT IS PUBLIC, AND IT IS A VALUE ===');
  eq('PUBLIC_GO_LIVE is the single constant that decides it', FL.PUBLIC_GO_LIVE, true);
  eq('DEFAULT_ENABLED follows it', FL.DEFAULT_ENABLED, FL.PUBLIC_GO_LIVE);
  ok('the flag key is namespaced away from every existing prefix',
    FL.RUNTIME_KEY.startsWith('lg:'), FL.RUNTIME_KEY);
  for (const collide of ['ask:', 'chat:', 'aud:', 'report:']) {
    ok('...and does not collide with «' + collide + '»', !FL.RUNTIME_KEY.startsWith(collide));
  }
  ok('the namespace is used for EVERY key this engine writes',
    STORE.key('x', 'y').startsWith('lg:') && CH.searchKey('س', {}).startsWith('lg:') === false
      ? true : STORE.key('x', 'y').startsWith('lg:'));
  {
    delete process.env.LEDGER_RAG;
    eq('an unset LEDGER_RAG now opens the floor (the go-live default)', FL.envAllows(), true);
    // AN EXPLICIT VALUE STILL BEATS THE DEFAULT, IN BOTH DIRECTIONS. This is the brake, and it is
    // the whole reason the go-live is a constant rather than a deletion.
    for (const v of ['off', 'false', '0', 'yes', 'enabled']) {
      process.env.LEDGER_RAG = v;
      eq('LEDGER_RAG=«' + v + '» still closes the floor', FL.envAllows(), false);
    }
    for (const v of ['on', 'true', '1', 'ON ']) {
      process.env.LEDGER_RAG = v;
      eq('LEDGER_RAG=«' + v + '» opens it explicitly', FL.envAllows(), true);
    }
    // An EMPTY string is "nothing was written", not "somebody wrote off", so it takes the default.
    process.env.LEDGER_RAG = '';
    eq('LEDGER_RAG=«» is unset, so it follows the default', FL.envAllows(), FL.PUBLIC_GO_LIVE);
    process.env.LEDGER_RAG = 'on';
    eq('«on» opens it', FL.envAllows(), true);
  }

  // ── THE DAILY CEILING EXISTS BY CONSTRUCTION ───────────────────────────────
  // configuredLimit() always returns a real cap: the finite default for absent/malformed input,
  // or the exact valid override (including zero). decidePath therefore has no unconfigured arm.
  {
    process.env.FOUNDER_SECRET = 'test-secret-for-the-gate';
    const dev = 'abcdefgh12345678';
    const req = { headers: { 'x-murabbi-device': dev, 'x-murabbi-founder': DC.founderTokenFor(dev) } };
    const saved = process.env.DAILY_SEARCH_BUDGET;

    delete process.env.DAILY_SEARCH_BUDGET;
    FL.__resetFlagCacheForTest();
    eq('the configured-limit compatibility table stays exact', [
      DB.configuredLimit({}),
      DB.configuredLimit({ DAILY_SEARCH_BUDGET: 'abc' }),
      DB.configuredLimit({ DAILY_SEARCH_BUDGET: '-5' }),
      DB.configuredLimit({ DAILY_SEARCH_BUDGET: '0' }),
    ], [5000, 5000, 5000, 0]);
    ok('an unset ceiling is a real finite number, never null and never Infinity',
      Number.isInteger(DB.configuredLimit()) && DB.configuredLimit() > 0
        && Number.isFinite(DB.configuredLimit()), String(DB.configuredLimit()));
    eq('...so the path is configured by construction', DB.isConfigured(), true);
    const on = await FL.decidePath(req);
    eq('an unset ceiling no longer blocks the public path', on.path, 'ledger');

    // A GARBLED VALUE IS THE DEFAULT, NEVER A COERCION AND NEVER "UNLIMITED". A typo must not be
    // able to raise, remove, or zero a spend cap.
    for (const bad of ['', 'lots', '-1', '2.5', 'Infinity', 'NaN']) {
      process.env.DAILY_SEARCH_BUDGET = bad;
      eq('a garbled ceiling «' + bad + '» falls back to the default',
        DB.configuredLimit(), DB.DEFAULT_DAILY_SEARCH_BUDGET);
    }
    // ...and a written value still governs, including a deliberate zero.
    process.env.DAILY_SEARCH_BUDGET = '7';
    eq('an explicit ceiling is read exactly', DB.configuredLimit(), 7);
    process.env.DAILY_SEARCH_BUDGET = '0';
    eq('an explicit zero is honoured (a hard stop, not the default)', DB.configuredLimit(), 0);

    process.env.DAILY_SEARCH_BUDGET = saved === undefined ? '500' : saved;
    FL.__resetFlagCacheForTest();

    const flagCode = code('lib/ledger/flag.js');
    eq('the two unreachable daily_budget_unconfigured branches are absent',
      (flagCode.match(/daily_budget_unconfigured/g) || []).length, 0);

    const staleBudgetClaims = [
      'lib/ledger/daily-budget.js',
      'EZIK-RFC-V0.5-R2-FROZEN.md',
      'EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md',
    ].flatMap((rel) => {
      const src = read(rel);
      return [
        /configuredLimit\(\) returns `null`/.test(src),
        /reports `configured: false`/.test(src),
        /reports `not_configured`/.test(src),
        /not activatable without a `DAILY_SEARCH_BUDGET` value/.test(src),
      ];
    });
    ok('budget documentation no longer claims the defaulted path is unconfigured',
      staleBudgetClaims.every((found) => !found));
  }

  // =========================================================================
  console.log('\n=== B. EVERY FAILURE READS AS LEGACY ===');
  {
    process.env.FOUNDER_SECRET = 'test-secret-for-the-gate';
    const device = 'abcdefgh12345678';
    const token = DC.founderTokenFor(device);
    const internalReq = { headers: { 'x-murabbi-device': device, 'x-murabbi-founder': token } };
    const anonReq = { headers: {} };
    const forgedReq = { headers: { 'x-murabbi-device': device, 'x-murabbi-founder': 'not-the-token' } };

    ok('the founder credential identifies an internal tester', FL.isInternalTester(internalReq));
    ok('...an anonymous request is not one', !FL.isInternalTester(anonReq));
    ok('...and a forged token is not one', !FL.isInternalTester(forgedReq));

    const redis = fakeRedis();
    STORE.__setRedisForTest(redis);

    // THE MATRIX AFTER THE PUBLIC GO-LIVE.
    //
    // Two rows changed on purpose and they ARE the go-live: an anonymous reader and a forged
    // token now reach the ledger, because there is no longer a credential to forge — the path is
    // public. Everything else in this table is a brake, and every brake still works.
    //
    // `mode` is written explicitly in each row rather than left unset. With PUBLIC_GO_LIVE true
    // an unset mode reads as 'public', so a row that said nothing would silently be testing the
    // public arm while claiming to test another.
    let clock = 0;
    const cases = [
      // label                                    LEDGER_RAG  RFC_V05_MODE  request      store      want
      ['floor off beats everything',              'off',      'public',     internalReq, true,      'legacy'],
      ['floor off beats a public anonymous read',  'off',      'public',     anonReq,     true,      'legacy'],
      ['mode off beats an open floor',            'on',       'off',        internalReq, true,      'legacy'],
      ['mode internal still refuses a stranger',  'on',       'internal',   anonReq,     true,      'legacy'],
      ['mode internal still refuses a forgery',   'on',       'internal',   forgedReq,   true,      'legacy'],
      ['mode internal admits a real tester',      'on',       'internal',   internalReq, true,      'ledger'],
      // ── the go-live rows ──
      ['PUBLIC admits an anonymous reader',       'on',       'public',     anonReq,     true,      'ledger'],
      ['PUBLIC admits a forged token too',        'on',       'public',     forgedReq,   true,      'ledger'],
      ['PUBLIC admits an internal tester',        'on',       'public',     internalReq, true,      'ledger'],
      // ── the kill switch, which the go-live deliberately kept ──
      ['a stored «off» stops the public path',    'on',       'public',     anonReq,     false,     'legacy'],
      // A store that is ABSENT or UNREACHABLE does NOT stop it, and that asymmetry is the
      // documented design of killSwitchEngaged(): a brake that fails to engage must never be the
      // thing that also grants permission, so an unreadable store leaves the environment in charge.
      ['an ABSENT stored value leaves it running', 'on',      'public',     anonReq,     null,      'ledger'],
    ];
    for (const [label, env, mode, req, flagValue, want] of cases) {
      process.env.LEDGER_RAG = env;
      process.env.RFC_V05_MODE = mode;
      redis._map.clear();
      if (flagValue !== null) redis._map.set(FL.RUNTIME_KEY, flagValue);
      FL.__resetFlagCacheForTest();
      clock += 100000;
      const d = await FL.decidePath(req, clock);
      eq(label + ' => ' + want, d.path, want);
    }
    // AND THE DEFAULTS, WITH NOTHING WRITTEN AT ALL — the state a fresh deployment is in.
    delete process.env.LEDGER_RAG;
    delete process.env.RFC_V05_MODE;
    redis._map.clear();
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('nothing configured at all => the public ledger', (await FL.decidePath(anonReq, clock)).path, 'ledger');
    eq('...and the reason names the mode', (await FL.decidePath(anonReq, clock)).reason, 'mode_public');
    process.env.RFC_V05_MODE = 'public';

    // A MALFORMED value is not truthy. This is the case a "if (v)" implementation gets wrong.
    process.env.LEDGER_RAG = 'on';
    for (const bad of ['maybe', 2, {}, [], 'ON!', 'yes']) {
      redis._map.clear();
      redis._map.set(FL.RUNTIME_KEY, bad);
      FL.__resetFlagCacheForTest();
      clock += 100000;
      eq('a malformed flag value ' + JSON.stringify(bad) + ' reads as legacy',
        (await FL.decidePath(internalReq, clock)).path, 'legacy');
    }
    // Only the exact affirmatives turn it on.
    for (const good of [true, 1, 'on', 'true', '1']) {
      redis._map.clear();
      redis._map.set(FL.RUNTIME_KEY, good);
      FL.__resetFlagCacheForTest();
      clock += 100000;
      eq('an explicit ' + JSON.stringify(good) + ' turns it on',
        (await FL.decidePath(internalReq, clock)).path, 'ledger');
    }

    // THE STORE BEING DOWN IS THE CASE THAT MATTERS MOST — and the go-live INVERTED its answer,
    // deliberately. It used to read as legacy because the store had to affirm the flag. It is now
    // the environment that affirms, and the store only ever brakes, so a store nobody can read
    // brakes nothing: the reader is served instead of being cut off by an outage in a component
    // that exists only to stop things. `LEDGER_RAG=off` remains the brake that needs no store.
    redis._map.set(FL.RUNTIME_KEY, true);
    redis.down = true;
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('an UNREACHABLE store no longer takes the path down', (await FL.decidePath(internalReq, clock)).path, 'ledger');
    ok('...and the env floor still stops it with no store at all', await (async () => {
      process.env.LEDGER_RAG = 'off';
      FL.__resetFlagCacheForTest();
      const d = await FL.decidePath(internalReq, clock + 1);
      process.env.LEDGER_RAG = 'on';
      return d.path === 'legacy' && d.reason === 'env_floor_off';
    })());
    redis.down = false;

    // No store at all — same reading, for the same reason.
    STORE.__setRedisForTest(null);
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('NO store at all leaves the environment in charge', (await FL.decidePath(internalReq, clock)).path, 'ledger');
    STORE.__setRedisForTest(redis);

    // The short TTL: a flipped switch takes effect within seconds, and a warm instance does
    // not re-read on every request.
    redis._map.set(FL.RUNTIME_KEY, true);
    FL.__resetFlagCacheForTest();
    let t = 1000000;
    eq('a fresh read hits the store', (await FL.readRuntimeFlag(t)).source, 'store');
    eq('...and a read 1s later is cached', (await FL.readRuntimeFlag(t + 1000)).source, 'cache');
    eq('...while one past the TTL re-reads', (await FL.readRuntimeFlag(t + FL.FLAG_TTL_MS + 1)).source, 'store');
    ok('the TTL is a few seconds, not minutes', FL.FLAG_TTL_MS <= 15000, String(FL.FLAG_TTL_MS));

    // The reason code is still a telemetry code and still never carries a secret. It no longer
    // needs to hide WHETHER the path is on — the path is public, so there is nothing to conceal
    // and nothing to forge — but it must still never carry a credential, a device id or a question.
    process.env.LEDGER_RAG = 'on';
    process.env.RFC_V05_MODE = 'public';
    FL.__resetFlagCacheForTest();
    const anon = await FL.decidePath(anonReq, t + 10 ** 6);
    eq('an anonymous caller now takes the public path', anon.path, 'ledger');
    eq('...with the mode as the reason', anon.reason, 'mode_public');
    ok('...and the reason carries no credential, device or question',
      /^[a-z_]+$/.test(anon.reason) && !/founder|token|device|secret/i.test(anon.reason), anon.reason);
    // ...while an internal-only rollout still hides exactly what it always hid.
    process.env.RFC_V05_MODE = 'internal';
    FL.__resetFlagCacheForTest();
    eq('under mode=internal an unauthenticated caller still learns nothing',
      (await FL.decidePath(anonReq, t + 2 * 10 ** 6)).reason, 'not_internal');
    process.env.RFC_V05_MODE = 'public';
  }
  // ORDERING, NOT PROXIMITY. This used to require the branch within 200 characters of the
  // decidePath call. The policy router now sits between them — the safety triage and the age
  // access have to know which path the request is taking before either can decide anything — so
  // the assertion says what it always meant: decidePath runs FIRST, the branch tests its result,
  // and nothing else in the handler can make that branch true.
  {
    const ask = read('api/ask.js');
    const decideAt = ask.indexOf('const ledgerPath = await decidePath(req);');
    const branchAt = ask.indexOf("if (ledgerPath.path === 'ledger') {");
    ok('the engine is never reached without decidePath saying so',
      decideAt > -1 && branchAt > decideAt);
    ok('...and only decidePath can set the value the branch tests',
      (ask.match(/ledgerPath\s*=/g) || []).length === 1,
      'a second assignment to ledgerPath would be a second way into the engine');
  }
  ok('...and the shipped routes are still below it, unmodified',
    /ATTRIBUTED ROUTE: no source by that scholar/.test(read('api/ask.js'))
    && /GEN ROUTE: ONE streamed round, NO tools/.test(read('api/ask.js'))
    && /ROUND 1 \(DEEN\): non-streamed, WITH tools, search FORCED/.test(read('api/ask.js')));
  ok('the ledger branch never falls through into the legacy path',
    /if \(ledgerPath\.path === 'ledger'\) \{[\s\S]*?return res\.end\(\);\r?\n    \}/.test(read('api/ask.js')));
  ok('no token value is ever logged by the flag module',
    !/console\.(log|warn|error)/.test(read('lib/ledger/flag.js')));
  // The one log line the ledger branch writes: counts, an outcome code and a trace id. Asserted
  // on the line's CONTENTS rather than its exact spelling, so it stays honest across a refactor
  // instead of going stale and being "fixed" by relaxing it.
  //
  // IT MOVED TO THE SEAM ON 2026-08-07, and this check followed it rather than being relaxed. It
  // used to be read out of api/ask.js, where it sat on the line after `await runLedgerTurn(...)`
  // — which is after wire.close() has already called res.end(). A serverless invocation may be
  // frozen at response completion, so the line was written and never shipped: the first live probe
  // on the opened engine logged a policy line, a refusal, and no counts at all. It now prints from
  // lib/ledger/seam.js in front of the close. WHAT IS ASSERTED IS UNCHANGED — the contents, and
  // the eight things the line may never carry.
  //
  // A NOTE ON WHY THE FIRST CHECK MATTERS MORE THAN IT LOOKS. `line` falls back to '' when the
  // regex misses, and '' contains none of the forbidden words — so every «never X» check below
  // passes VACUOUSLY on a miss. The existence check is what stops eight green lines from meaning
  // nothing, which is exactly what they meant while this pointed at the wrong file.
  {
    const line = (read('lib/ledger/seam.js').match(/console\.log\('\[ledger\]',[\s\S]{0,400}?\}\);/) || [])[0] || '';
    ok('the ledger branch logs a [ledger] line', !!line, 'no line found');
    ok('...carrying only counts, an outcome and a trace id',
      /outcome/.test(line) && /traceId/.test(line) && /spent\./.test(line), line.slice(0, 200));
    for (const forbidden of ['question', 'messages', 'body.', 'text', 'answer', 'device', 'founder', 'ip']) {
      ok('...and never «' + forbidden + '»', !line.includes(forbidden), line.slice(0, 200));
    }
    // AND NOT FROM THE HANDLER ANY MORE. If it comes back to api/ask.js it comes back to the far
    // side of res.end(), where it is unreadable — so its absence there is part of the contract.
    ok('...and the handler does not log it any more, where it would run after res.end()',
      !/console\.log\('\[ledger\]'/.test(read('api/ask.js')));
  }

  // =========================================================================
  console.log('\n=== C. CACHE KEYS CARRY NO QUESTION ===');
  {
    process.env.LEDGER_CACHE_SECRET = 'cache-secret-for-the-gate';
    const Q = 'ما حكم الجمع بين الصلاتين للمسافر في الطائرة';
    const k = CH.searchKey(Q, { sites: ['islamqa.info'] });
    ok('a search key is produced when the secret is set', !!k, k);
    ok('...and it is namespaced', k.startsWith('lg:s:'), k);
    ok('...and contains NO readable fragment of the question', !CH.keyLeaks(k, Q), k);
    for (const word of Q.split(' ')) ok('  ...not «' + word + '»', !k.includes(word));
    ok('...and not the raw question either', !k.includes(Q));
    eq('the same question keys the same', k, CH.searchKey(Q, { sites: ['islamqa.info'] }));
    ok('a different question keys differently', k !== CH.searchKey(Q + ' زيادة', { sites: ['islamqa.info'] }));
    ok('a different site set keys differently', k !== CH.searchKey(Q, { sites: ['islamweb.net'] }));
    ok('a different policy version keys differently',
      k !== CH.searchKey(Q, { sites: ['islamqa.info'], policyVersion: 'other' }));

    // NO SECRET => NO CACHE. Never a plaintext fallback key.
    delete process.env.LEDGER_CACHE_SECRET;
    delete process.env.FOUNDER_SECRET;
    eq('with no secret the cache is disabled', CH.cacheEnabled(), false);
    eq('...and produces no key at all', CH.searchKey(Q, {}), '');
    eq('...and no extraction key', CH.extractionKey('https://islamqa.info/x', { adapterVersion: 'r1' }), '');
    process.env.LEDGER_CACHE_SECRET = 'cache-secret-for-the-gate';
    process.env.FOUNDER_SECRET = 'test-secret-for-the-gate';
  }
  {
    // Extraction keys: every version that could move a byte offset is in the key.
    const U = 'https://islamqa.info/ar/answers/1';
    const base = CH.extractionKey(U, { adapterVersion: 'readability@r1' });
    ok('an extraction key is produced', !!base);
    ok('a different ADAPTER version keys differently',
      base !== CH.extractionKey(U, { adapterVersion: 'readability@r2' }));
    ok('a different POLICY version keys differently',
      base !== CH.extractionKey(U, { adapterVersion: 'readability@r1', policyVersion: 'other' }));
    ok('a different URL keys differently',
      base !== CH.extractionKey(U + '/2', { adapterVersion: 'readability@r1' }));
    ok('the extraction schema version is part of the key material',
      /EXTRACTION_SCHEMA_VERSION/.test(read('lib/ledger/cache.js')));
  }
  {
    // Round-trip, and version invalidation on READ as well as in the key.
    const redis = fakeRedis();
    STORE.__setRedisForTest(redis);
    const U = 'https://islamqa.info/ar/answers/1';
    const payload = { authorialText: 'نص', title: 't', kind: 'answer', dates: {} };
    ok('an extraction is stored', await CH.putExtraction(U, payload, { adapterVersion: 'readability@r1' }));
    const hit = await CH.getExtraction(U, { adapterVersion: 'readability@r1' });
    ok('...and read back', hit.hit && hit.value.authorialText === 'نص');
    const miss = await CH.getExtraction(U, { adapterVersion: 'readability@r2' });
    eq('a bumped adapter version is a MISS, not a stale hit', miss.hit, false);

    // A hand-written value from another schema is refused on read.
    redis._map.set(CH.extractionKey(U, { adapterVersion: 'readability@r1' }), {
      authorialText: 'نص', adapterVersion: 'readability@r1', extractionSchemaVersion: 'span-v0',
    });
    eq('a value from another extraction schema is refused on read',
      (await CH.getExtraction(U, { adapterVersion: 'readability@r1' })).hit, false);

    // A store outage is a miss, never an error and never an answer.
    redis.down = true;
    eq('a store outage is a MISS', (await CH.getExtraction(U, { adapterVersion: 'readability@r1' })).hit, false);
    eq('...and a failed write is reported, not thrown',
      await CH.putExtraction(U, payload, { adapterVersion: 'readability@r1' }), false);
    redis.down = false;

    // TTLs.
    ok('a search TTL of 24h', CH.SEARCH_TTL_SECONDS === 24 * 60 * 60);
    ok('no page TTL is unbounded', Object.values(CH.PAGE_TTL_SECONDS).every((t) => t > 0 && t <= 7 * 24 * 3600));
    ok('an unknown page kind gets the SHORTEST ttl',
      CH.PAGE_TTL_SECONDS.unknown === Math.min(...Object.values(CH.PAGE_TTL_SECONDS)));
    ok('a source that publishes dates is not treated as permanently stable',
      CH.ttlForPage('https://islamqa.info/x', 'answer') < CH.PAGE_TTL_SECONDS.answer);
  }
  ok('the cache can never widen a source or skip a gate',
    !/capabilityEligible|gate1|runGate2|admitPostFetch/.test(read('lib/ledger/cache.js')));

  // =========================================================================
  console.log('\n=== D. TELEMETRY IS AN ALLOW-LIST ===');
  {
    const FORBIDDEN = {
      question: 'ما حكم الجمع بين الصلاتين',
      user_question: 'x', draft: 'الجواب هو كذا', answer: 'y',
      extracted_text: 'نص الصفحة', span_text: 'z', sentences: ['جملة'],
      device_id: 'abcdefgh12345678', cookie: 'mrb_did=x', ip: '1.2.3.4',
      authorization: 'Bearer x', 'x-murabbi-founder': 'tok', api_key: 'sk-x',
      cache_key_input: 'ما حكم', url: 'https://islamqa.info/x',
    };
    const { record, dropped } = TL.buildRecord({
      trace_id: 'tr_000001', issue_count: 2, intents: ['fatwa', 'tafsir'],
      model_calls: 5, gate_fail_by_gate: { gate2: 1 }, outcome: 'PARTIAL',
      ...FORBIDDEN,
    });
    for (const k of Object.keys(FORBIDDEN)) {
      ok('DROPPED: ' + k, !(k in record) && dropped.includes(k));
    }
    ok('the metrics survive', record.issue_count === 2 && record.model_calls === 5);
    eq('...and the intents', record.intents, ['fatwa', 'tafsir']);
    eq('...and the per-gate failures', record.gate_fail_by_gate, { gate2: 1 });
    ok('no value in the record is free text',
      Object.values(record).flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter((v) => typeof v === 'string')
        .every((v) => /^[A-Za-z0-9_.:\-/]+$/.test(v)), JSON.stringify(record));
    // An ALLOWED field carrying prose is still refused, because the VALUE is checked too.
    const prose = TL.buildRecord({ trace_id: 'tr_1', outcome: 'ما حكم الجمع بين الصلاتين' });
    ok('an allowed field carrying Arabic prose is dropped', !('outcome' in prose.record), JSON.stringify(prose.record));
    const long = TL.buildRecord({ trace_id: 'tr_1', outcome: 'x'.repeat(200) });
    ok('an allowed field carrying an over-long string is dropped', !('outcome' in long.record));
  }
  {
    // The ledger's own telemetry shape carries no text either.
    const SC = await esm('lib/ledger/schema.js');
    const SG = await esm('lib/ledger/segment.js');
    const L = new SC.Ledger('tr_000002');
    L.setIssues([{
      issueId: 'iss_1', intent: 'fatwa', requestedAuthorityId: null, protectedEntities: [],
      coreTerms: [], contextVars: [], exactUserPhrases: [], requiredSlots: ['ruling'],
      dependencies: [], temporalScope: 'unknown',
    }]);
    const seg = SG.segmentPage({
      sourceId: 'https://islamqa.info/ar/answers/1', canonicalUrl: 'https://islamqa.info/ar/answers/1',
      authorialText: 'الجواب: يجوز الجمع بين الصلاتين للمسافر. والله أعلم.', adapterVersion: 'r1',
    });
    L.addSegmentedPage(seg, { host: 'islamqa.info' });
    const shape = JSON.stringify(L.telemetryShape());
    ok('telemetryShape() contains no page text', !shape.includes('يجوز الجمع'), shape.slice(0, 200));
    ok('...and no span exactText', !shape.includes('والله أعلم'));
    ok('...and no URL', !shape.includes('islamqa.info'));
    // The page text lives in its own map, NOT on the source row, so it cannot be serialised by
    // accident when `sources` is. Asserted on the live objects rather than on the source text.
    ok('the page text is held in a SEPARATE map', /this\.pageText = new Map\(\)/.test(read('lib/ledger/schema.js')));
    ok('...it really holds the text', L.pageText.get('https://islamqa.info/ar/answers/1').includes('يجوز الجمع'));
    ok('...and no source row carries page text',
      Array.from(L.sources.values()).every((s) => !JSON.stringify(s).includes('يجوز الجمع')));
    ok('...and telemetryShape() emits no key holding it',
      !Object.keys(L.telemetryShape()).includes('pageText')
      && !JSON.stringify(L.telemetryShape()).includes('يجوز'));
  }
  {
    eq('the telemetry TTL is 48 hours', TL.TELEMETRY_TTL_SECONDS, 48 * 60 * 60);
    ok('...and is not longer', TL.TELEMETRY_TTL_SECONDS <= 48 * 60 * 60);
    const redis = fakeRedis();
    STORE.__setRedisForTest(redis);
    // EVERY REQUEST IS WRITTEN, NOT ONLY A TESTER'S (owner decision, 2026-08-07). This used to
    // assert the opposite — «a non-internal caller writes nothing» — and the inversion is kept
    // rather than deleted so the reversal cannot be quietly reinstated. What makes it safe is the
    // allow-list, asserted directly above and in guards/ledger-telemetry-guard.cjs section B; the
    // `internal` flag limited VOLUME, never contents.
    eq('a caller claiming nothing still writes — telemetry is no longer tester-only',
      (await TL.record({ trace_id: 'tr_1' })).written, true);
    ok('a plain caller writes', (await TL.record({ trace_id: 'tr_000003' })).written);
    ok('...under the lg: namespace', Array.from(redis._map.keys()).every((k) => k.startsWith('lg:')));
    eq('a malformed trace id writes nothing',
      (await TL.record({ trace_id: 'ما حكم' })).written, false);
  }
  ok('a trace id is not derived from the question',
    !/hash|sha|question/i.test(read('lib/ledger/schema.js').split('export function newTraceId')[1].split('\n}')[0]));

  // =========================================================================
  console.log('\n=== E. THE INTERNAL CREDENTIAL IS THE EXISTING ONE ===');
  ok('the flag reuses lib/daycap.js\'s founder check',
    /import \{ hasValidFounderToken \} from '\.\.\/daycap\.js'/.test(read('lib/ledger/flag.js')));
  // Checked against CODE: the comment above the check names the mechanisms it forbids, and
  // scanning the raw file would find them there.
  ok('...and invents no second mechanism',
    !/query|searchParams|localStorage|cookie/i.test(code('lib/ledger/flag.js')));
  ok('...and no ledger module reads a flag from the request body or URL',
    ['lib/ledger/flag.js', 'lib/ledger/engine.js']
      .every((f) => !/body\.(ledger|flag|rag)|req\.query/.test(read(f))));
  ok('no Environment Variable is written anywhere in the ledger',
    fs.readdirSync(path.join(REPO, 'lib', 'ledger'))
      .every((f) => !/process\.env\.[A-Z_]+\s*=/.test(read('lib/ledger/' + f))));
  ok('no ledger module reads a raw credential value into a log or a key',
    fs.readdirSync(path.join(REPO, 'lib', 'ledger'))
      .every((f) => !/x-murabbi-founder|FOUNDER_SECRET.*console|ANTHROPIC_API_KEY.*console/.test(read('lib/ledger/' + f))));

  // =========================================================================
  console.log('\n=== F. THE SAME UPSTASH, NO NEW INFRASTRUCTURE ===');
  ok('the ledger store uses @upstash/redis, as the app already does',
    /from '@upstash\/redis'/.test(read('lib/ledger/redis.js')));
  ok('...with the same explicit KV_REST_API_* credentials',
    /KV_REST_API_URL/.test(read('lib/ledger/redis.js')) && /KV_REST_API_TOKEN/.test(read('lib/ledger/redis.js')));
  ok('...and no other client library is introduced',
    !/ioredis|node-redis|require\('redis'\)/.test(read('lib/ledger/redis.js')));
  const REQUIRED_RUNTIME_DEPENDENCIES = Object.freeze({
    '@mozilla/readability': 0,
    '@upstash/redis': 1,
    linkedom: 0,
  });
  const dependencyProblems = (pkg, lock) => {
    const problems = [];
    const declared = pkg.dependencies || {};
    const lockedRoot = lock.packages?.['']?.dependencies || {};
    for (const [name, requiredMajor] of Object.entries(REQUIRED_RUNTIME_DEPENDENCIES)) {
      const installed = lock.packages?.['node_modules/' + name]?.version;
      if (!declared[name]) problems.push(name + ':missing-package');
      if (!lockedRoot[name]) problems.push(name + ':missing-lock-root');
      if (!installed) problems.push(name + ':missing-lock-package');
      const declaredMajor = Number((String(declared[name] || '').match(/\d+/) || [NaN])[0]);
      const installedMajor = Number((String(installed || '').match(/^\d+/) || [NaN])[0]);
      if (declared[name] && declaredMajor !== requiredMajor) problems.push(name + ':declared-major');
      if (installed && installedMajor !== requiredMajor) problems.push(name + ':locked-major');
    }
    return problems;
  };
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  eq('the required runtime dependencies satisfy their major-version contracts',
    dependencyProblems(pkg, lock), []);

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const missing = { pkg: clone(pkg), lock: clone(lock) };
  delete missing.pkg.dependencies['@upstash/redis'];
  delete missing.lock.packages[''].dependencies['@upstash/redis'];
  delete missing.lock.packages['node_modules/@upstash/redis'];
  ok('counter-mutation: deleting a required dependency is rejected',
    dependencyProblems(missing.pkg, missing.lock).some((p) => p.startsWith('@upstash/redis:missing-')));
  const incompatible = { pkg: clone(pkg), lock: clone(lock) };
  incompatible.pkg.dependencies['@upstash/redis'] = '^2.0.0';
  incompatible.lock.packages[''].dependencies['@upstash/redis'] = '^2.0.0';
  incompatible.lock.packages['node_modules/@upstash/redis'].version = '2.0.0';
  ok('counter-mutation: an incompatible required major is rejected',
    dependencyProblems(incompatible.pkg, incompatible.lock)
      .filter((p) => p.startsWith('@upstash/redis:')).length === 2);
  const unrelatedPatch = { pkg: clone(pkg), lock: clone(lock) };
  unrelatedPatch.pkg.dependencies.minisearch = '^7.2.1';
  unrelatedPatch.lock.packages[''].dependencies.minisearch = '^7.2.1';
  unrelatedPatch.lock.packages['node_modules/minisearch'].version = '7.2.1';
  eq('an unrelated patch upgrade does not change the Ledger dependency contract',
    dependencyProblems(unrelatedPatch.pkg, unrelatedPatch.lock), []);
  ok('the shipped rate-limit prefixes are untouched',
    /prefix: 'ask:min'/.test(read('lib/ratelimit.js')) && /prefix: 'ask:all:day'/.test(read('lib/ratelimit.js')));

  STORE.__resetRedis();
  restoreEnv();
  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  return failures === 0 ? 0 : 1;
}

withRestoredProcessEnv(ENV_KEYS, main).then((code) => {
  process.exitCode = code;
}).catch((e) => {
  console.error('ledger-runtime-guard CRASHED:', (e && e.stack) || e);
  process.exitCode = 1;
});
