// P0 paid-search budget guard. Entirely offline: Redis and Brave are deterministic doubles.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
let checks = 0;
let failures = 0;

function ok(name, condition, detail = '') {
  checks += 1;
  if (condition) console.log('  PASS  ' + name);
  else {
    failures += 1;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  }
}

function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));
}

(async () => {
  console.log('\n=== search-budget-p0 — environment, caller fairness, atomicity and privacy ===');
  const [DB, RL, RTO, SEARCH] = await Promise.all([
    esm('lib/ledger/daily-budget.js'), esm('lib/ratelimit.js'), esm('lib/retrieve.js'),
    esm('lib/ledger/search.js'),
  ]);

  const now = Date.UTC(2026, 7, 15, 12, 0, 0);
  const shared = DB.fakeStore();
  const prodEnv = {
    VERCEL_ENV: 'production', SEARCH_BUDGET_GLOBAL_PRODUCTION: '100',
    SEARCH_BUDGET_GLOBAL_PREVIEW: '40', SEARCH_BUDGET_PER_CALLER: '20',
  };
  const previewEnv = { ...prodEnv, VERCEL_ENV: 'preview' };
  eq('production global cap comes only from its environment variable', DB.configuredGlobalLimit(prodEnv), 100);
  eq('preview global cap comes only from its environment variable', DB.configuredGlobalLimit(previewEnv), 40);
  eq('per-caller cap is environment-configurable', DB.configuredCallerLimit(prodEnv), 20);
  ok('the obsolete single cap cannot configure v2',
    DB.configuredLimit({ VERCEL_ENV: 'production', DAILY_SEARCH_BUDGET: '20' }) === null);

  const prod = new DB.DailySearchBudget({
    env: prodEnv, store: shared, now: () => now, callerDigests: ['caller_A_digest_0001'],
  });
  const preview = new DB.DailySearchBudget({
    env: previewEnv, store: shared, now: () => now, callerDigests: ['caller_A_digest_0001'],
  });
  await prod.reserve();
  await Promise.all([preview.reserve(), preview.reserve(), preview.reserve()]);
  eq('Preview reservations do not change the Production counter',
    shared.map.get(DB.dayKey(now, 'production')), 1);
  eq('Preview has its own counter', shared.map.get(DB.dayKey(now, 'preview')), 3);
  ok('the two keys are distinct v2 environment namespaces',
    DB.dayKey(now, 'production') === 'ezik:search-budget:v2:production:2026-08-15'
      && DB.dayKey(now, 'preview') === 'ezik:search-budget:v2:preview:2026-08-15');

  const fairnessStore = DB.fakeStore();
  const callerA = new DB.DailySearchBudget({
    globalLimit: 100, callerLimit: 20, environment: 'production', store: fairnessStore,
    now: () => now, callerDigests: ['caller_A_digest_0001'],
  });
  const aResults = await Promise.all(Array.from({ length: 21 }, () => callerA.reserve()));
  eq('one caller cannot consume the global allowance', aResults.filter((x) => x.ok).length, 20);
  eq('the blocked caller gets the dedicated telemetry reason', aResults[20].reason, 'caller_cap_reached');
  eq('a caller refusal does not increment the global counter',
    fairnessStore.map.get(DB.dayKey(now, 'production')), 20);

  const callerB = new DB.DailySearchBudget({
    globalLimit: 100, callerLimit: 20, environment: 'production', store: fairnessStore,
    now: () => now, callerDigests: ['caller_B_digest_0002'],
  });
  const bResults = await Promise.all(Array.from({ length: 20 }, () => callerB.reserve()));
  eq('a second caller has an independent share while global capacity remains',
    bResults.filter((x) => x.ok).length, 20);
  eq('both callers together charged the global counter honestly',
    fairnessStore.map.get(DB.dayKey(now, 'production')), 40);

  const atomicStore = DB.fakeStore();
  const atomic = new DB.DailySearchBudget({
    globalLimit: 40, callerLimit: 100, environment: 'preview', store: atomicStore,
    now: () => now, callerDigests: ['atomic_caller_digest_03'],
  });
  const atomicResults = await Promise.all(Array.from({ length: 200 }, () => atomic.reserve()));
  eq('concurrent reservations grant no more than the global cap',
    atomicResults.filter((x) => x.ok).length, 40);
  eq('the stored global counter never overshoots', atomicStore.map.get(DB.dayKey(now, 'preview')), 40);
  eq('the global exhaustion telemetry reason is exact',
    atomicResults.find((x) => !x.ok)?.reason, 'day_cap_reached');

  const callerAtomicStore = DB.fakeStore();
  const callerAtomic = new DB.DailySearchBudget({
    globalLimit: 100, callerLimit: 20, environment: 'production', store: callerAtomicStore,
    now: () => now, callerDigests: ['atomic_caller_digest_04'],
  });
  const callerAtomicResults = await Promise.all(Array.from({ length: 100 }, () => callerAtomic.reserve()));
  eq('concurrent reservations grant no more than the caller cap',
    callerAtomicResults.filter((x) => x.ok).length, 20);
  eq('the caller counter never overshoots',
    callerAtomicStore.map.get(DB.callerKey(now, 'atomic_caller_digest_04', 'production')), 20);

  let clock = Date.UTC(2026, 7, 15, 23, 59, 59, 500);
  const ttlStore = DB.fakeStore();
  const ttlBudget = new DB.DailySearchBudget({
    globalLimit: 100, callerLimit: 20, environment: 'production', store: ttlStore,
    now: () => clock, callerDigests: ['ttl_caller_digest_0005'],
  });
  const oldKey = DB.dayKey(clock, 'production');
  await ttlBudget.reserve();
  eq('new counters expire at exact UTC midnight', ttlStore.map.get(oldKey + ':expireAt'),
    Date.UTC(2026, 7, 16, 0, 0, 0) / 1000);
  clock = Date.UTC(2026, 7, 16, 0, 0, 0, 1);
  const reset = await ttlBudget.reserve();
  ok('the next UTC day uses a fresh key and resets usage',
    DB.dayKey(clock, 'production') !== oldKey && reset.ok && reset.used === 1);

  const identityEnv = { SEARCH_BUDGET_IDENTITY_SECRET: 'offline-search-budget-secret' };
  const rawAccount = 'owner-account-raw@example.test';
  const rawDevice = 'device_RAW_12345678';
  const rawCookie = 'cookie_RAW_12345678';
  const accountDigests = RL.searchBudgetCallerDigests({
    auth: { accountId: rawAccount },
    headers: { 'x-murabbi-device': rawDevice, cookie: 'mrb_did=' + rawCookie },
  }, identityEnv);
  const deviceDigests = RL.searchBudgetCallerDigests({
    headers: { 'x-murabbi-device': rawDevice, cookie: 'mrb_did=' + rawCookie },
  }, identityEnv);
  eq('an authenticated account is charged first instead of device dimensions', accountDigests.length, 1);
  eq('an anonymous device uses both protected existing dimensions', deviceDigests.length, 2);
  ok('all charging identities are irreversible HMAC digests',
    [...accountDigests, ...deviceDigests].every((x) => /^[A-Za-z0-9_-]{43}$/u.test(x)));
  const privacyBudget = new DB.DailySearchBudget({
    globalLimit: 100, callerLimit: 20, environment: 'production', store: DB.fakeStore(),
    now: () => now, callerDigests: deviceDigests,
  });
  const privacyMaterial = JSON.stringify({
    keys: deviceDigests.map((digest) => DB.callerKey(now, digest, 'production')),
    telemetry: privacyBudget.snapshot(),
  });
  ok('raw account, device and cookie identifiers appear in neither Redis keys nor telemetry',
    ![rawAccount, rawDevice, rawCookie].some((raw) => privacyMaterial.includes(raw)), privacyMaterial);
  ok('telemetry exposes counts but not even the HMAC digest values',
    deviceDigests.every((digest) => !JSON.stringify(privacyBudget.snapshot()).includes(digest)));

  const unavailableStore = DB.fakeStore();
  unavailableStore.unavailable = true;
  const unavailable = new DB.DailySearchBudget({
    globalLimit: 100, callerLimit: 20, environment: 'production', store: unavailableStore,
    now: () => now, callerDigests: ['store_down_digest_0006'], failOpen: true,
  });
  const unavailableResult = await unavailable.reserve();
  eq('an unavailable budget store has its own telemetry reason',
    unavailableResult.reason, 'budget_store_unavailable');
  ok('Upstash failure remains fail-closed even if a caller asks to open it', unavailableResult.ok === false);

  const savedKey = process.env.BRAVE_API_KEY;
  const savedFetch = globalThis.fetch;
  let reserveCalls = 0;
  let providerCalls = 0;
  const countedBudget = { reserve: async () => { reserveCalls += 1; return { ok: true }; } };
  try {
    delete process.env.BRAVE_API_KEY;
    globalThis.fetch = async () => { providerCalls += 1; throw new Error('network forbidden'); };
    await RTO.retrieveOpenWorld('weather today', { band: 'adult', dailyBudget: countedBudget });
    eq('a missing provider key consumes no budget unit', [reserveCalls, providerCalls], [0, 0]);

    process.env.BRAVE_API_KEY = 'offline-brave-key';
    await RTO.retrieveOpenWorld('x'.repeat(500), { band: 'adult', dailyBudget: countedBudget });
    eq('a locally rejected query consumes no budget unit', [reserveCalls, providerCalls], [0, 0]);

    let nakedReason = '';
    let nakedProviderCalls = 0;
    try {
      await SEARCH.braveSearch('bounded naked adapter query', ['islamqa.info'], {
        fetchImpl: async () => {
          nakedProviderCalls += 1;
          throw new Error('unmetered transport must not run');
        },
      });
    } catch (error) {
      nakedReason = error && (error.reason || error.message);
    }
    eq('a bare provider-adapter call throws before its injected transport',
      [nakedReason, nakedProviderCalls], ['budget_store_unavailable', 0]);

    let explicitProviderCalls = 0;
    // This deterministic adapter fixture has no daily store and no real wire; the named opt-out
    // exists only to prove that an intentionally unmetered caller cannot be confused with silence.
    await SEARCH.braveSearch('bounded explicit fixture query', ['islamqa.info'], {
      allowUnmetered: true,
      fetchImpl: async () => {
        explicitProviderCalls += 1;
        return { ok: true, status: 200, json: async () => ({ web: { results: [] } }) };
      },
    });
    eq('the named unmetered escape hatch remains explicit and offline', explicitProviderCalls, 1);

    globalThis.fetch = async () => {
      providerCalls += 1;
      return { ok: true, status: 200, json: async () => ({ web: { results: [] } }) };
    };
    await RTO.retrieveOpenWorld('weather today', { band: 'adult', dailyBudget: countedBudget });
    eq('one reserved unit corresponds to one actual Brave transport attempt',
      [reserveCalls, providerCalls], [1, 1]);

    let blockedTransport = 0;
    const blocked = await RTO.retrieveWorld('latest economic news', {
      dailyBudget: { reserve: async () => ({ ok: false, reason: 'budget_store_unavailable' }) },
      transport: async () => { blockedTransport += 1; throw new Error('must not run'); },
    });
    ok('store failure blocks transport and remains explicit in retrieval telemetry',
      blockedTransport === 0 && blocked.diagnostics.outcome === DB.SERVICE_LIMITED
        && blocked.diagnostics.reasons.includes('budget_store_unavailable'),
      JSON.stringify(blocked.diagnostics));
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.BRAVE_API_KEY;
    else process.env.BRAVE_API_KEY = savedKey;
  }

  ok('the atomic script contains no deletion or reset of old keys',
    !/\b(?:DEL|UNLINK|FLUSHDB|FLUSHALL)\b/iu.test(DB.RESERVE_SCRIPT));
  const forbidden = spawnSync('git', [
    'status', '--porcelain', '--', 'quest.html', 'quest-data',
    'lib/data/fiqh-search.json.gz', 'data/source-liveness.json',
  ], { cwd: ROOT, encoding: 'utf8' });
  ok('Quest, corpus and source-data files are byte-untouched by this change',
    forbidden.status === 0 && String(forbidden.stdout || '').trim() === '',
    String(forbidden.stdout || forbidden.stderr || '').trim());
  const source = fs.readFileSync(path.join(ROOT, 'lib/ledger/daily-budget.js'), 'utf8');
  ok('no numeric global or caller cap is hard-coded in budget logic',
    !/DEFAULT_DAILY_SEARCH_BUDGET|=\s*(?:100|40|20)\b/u.test(source));

  console.log('\n=== ' + (checks - failures) + '/' + checks
    + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
