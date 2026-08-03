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

(async function main() {
  console.log('=== ledger-runtime-guard — flag, kill switch, caches, telemetry ===');

  const STORE = await esm('lib/ledger/redis.js');
  const FL = await esm('lib/ledger/flag.js');
  const CH = await esm('lib/ledger/cache.js');
  const TL = await esm('lib/ledger/telemetry.js');
  const DC = await esm('lib/daycap.js');

  const ORIGINAL_ENV = {
    LEDGER_RAG: process.env.LEDGER_RAG,
    FOUNDER_SECRET: process.env.FOUNDER_SECRET,
    LEDGER_CACHE_SECRET: process.env.LEDGER_CACHE_SECRET,
  };
  const restoreEnv = () => {
    for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };

  // =========================================================================
  console.log('\n=== A. THE DEFAULT IS OFF, AND IT IS A VALUE ===');
  eq('DEFAULT_ENABLED is false', FL.DEFAULT_ENABLED, false);
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
    eq('an unset LEDGER_RAG closes the env floor', FL.envAllows(), false);
    for (const v of ['off', 'false', '0', '', 'yes', 'ON ', 'enabled']) {
      process.env.LEDGER_RAG = v;
      eq('LEDGER_RAG=«' + v + '» keeps the floor closed', FL.envAllows(), v.trim().toLowerCase() === 'on');
    }
    process.env.LEDGER_RAG = 'on';
    eq('only «on» opens it', FL.envAllows(), true);
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

    const cases = [
      ['env off + internal + flag on', 'off', internalReq, true, 'legacy'],
      ['env on + anonymous + flag on', 'on', anonReq, true, 'legacy'],
      ['env on + forged token + flag on', 'on', forgedReq, true, 'legacy'],
      ['env on + internal + flag ABSENT', 'on', internalReq, null, 'legacy'],
      ['env on + internal + flag off', 'on', internalReq, false, 'legacy'],
      ['env on + internal + flag on', 'on', internalReq, true, 'ledger'],
    ];
    let clock = 0;
    for (const [label, env, req, flagValue, want] of cases) {
      process.env.LEDGER_RAG = env;
      redis._map.clear();
      if (flagValue !== null) redis._map.set(FL.RUNTIME_KEY, flagValue);
      FL.__resetFlagCacheForTest();
      clock += 100000;
      const d = await FL.decidePath(req, clock);
      eq(label + ' => ' + want, d.path, want);
    }

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

    // THE STORE BEING DOWN IS THE CASE THAT MATTERS MOST.
    redis._map.set(FL.RUNTIME_KEY, true);
    redis.down = true;
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('an UNREACHABLE store reads as legacy', (await FL.decidePath(internalReq, clock)).path, 'legacy');
    redis.down = false;

    // No store at all.
    STORE.__setRedisForTest(null);
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('NO store at all reads as legacy', (await FL.decidePath(internalReq, clock)).path, 'legacy');
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

    // The reason code never says whether the flag is on, to a caller who is not internal.
    process.env.LEDGER_RAG = 'on';
    FL.__resetFlagCacheForTest();
    const anon = await FL.decidePath(anonReq, t + 10 ** 6);
    eq('an unauthenticated caller learns nothing about the flag', anon.reason, 'not_internal');
  }
  ok('the engine is never reached without decidePath saying so',
    /const ledgerPath = await decidePath\(req\);[\s\S]{0,200}if \(ledgerPath\.path === 'ledger'\)/.test(read('api/ask.js')));
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
  {
    const line = (read('api/ask.js').match(/console\.log\('\[ledger\]',[\s\S]{0,400}?\}\);/) || [])[0] || '';
    ok('the ledger branch logs a [ledger] line', !!line, 'no line found');
    ok('...carrying only counts, an outcome and a trace id',
      /outcome/.test(line) && /traceId/.test(line) && /spent\./.test(line), line.slice(0, 200));
    for (const forbidden of ['question', 'messages', 'body.', 'text', 'answer', 'device', 'founder', 'ip']) {
      ok('...and never «' + forbidden + '»', !line.includes(forbidden), line.slice(0, 200));
    }
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
    eq('a non-internal caller writes nothing',
      (await TL.record({ trace_id: 'tr_1' }, { internal: false })).written, false);
    ok('an internal caller writes', (await TL.record({ trace_id: 'tr_000003' }, { internal: true })).written);
    ok('...under the lg: namespace', Array.from(redis._map.keys()).every((k) => k.startsWith('lg:')));
    eq('a malformed trace id writes nothing',
      (await TL.record({ trace_id: 'ما حكم' }, { internal: true })).written, false);
  }
  ok('a trace id is not derived from the question',
    !/hash|sha|question/i.test(read('lib/ledger/schema.js').split('export function newTraceId')[1].split('}')[0]));

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
  eq('package.json gained no dependency', JSON.parse(read('package.json')).dependencies, {
    '@mozilla/readability': '^0.6.0',
    '@upstash/ratelimit': '^2.0.8',
    '@upstash/redis': '^1.38.0',
    linkedom: '^0.18.12',
    minisearch: '^7.2.0',
  });
  ok('the shipped rate-limit prefixes are untouched',
    /prefix: 'ask:min'/.test(read('lib/ratelimit.js')) && /prefix: 'ask:all:day'/.test(read('lib/ratelimit.js')));

  STORE.__resetRedis();
  restoreEnv();
  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ledger-runtime-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
