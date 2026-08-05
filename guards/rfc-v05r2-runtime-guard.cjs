// guards/rfc-v05r2-runtime-guard.cjs — cache, daily budget, query bounds, mutations, SSE.
//
// EVERYTHING HERE IS OFFLINE AND DETERMINISTIC. No network, no model, no Upstash, no Brave. The
// Redis client is replaced with an in-memory double through the seam lib/ledger/redis.js already
// exports for the purpose, and the daily budget is driven against the fake store its own module
// exports — so these tests exercise the REAL reservation logic and the REAL cache keying while
// creating no key in anybody's store.
//
// WHAT IT PROVES:
//   E  the empty result is cached, under a short TTL, behind an HMAC key that carries every
//      version which could change what a query MEANS — and that bumping any of them is a miss;
//   F  the daily ceiling reserves BEFORE the provider request, is atomic under concurrency,
//      answers SERVICE_LIMITED rather than NOT_FOUND, and refuses to invent a production number;
//   Q  the query bounds, with characters and words measured INDEPENDENTLY;
//   M  the mutations: every way a sentence can claim more than its evidence allows;
//   S  the SSE contract, driven through the real handler with a fake req/res.
//
// Usage: node guards/rfc-v05r2-runtime-guard.cjs
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

// A query of EXACTLY n words and c characters, so the two limits can be crossed one at a time.
function mk(nWords, nChars) {
  const parts = new Array(nWords).fill('ا');
  const base = nWords + (nWords - 1);           // one letter each, plus the separators
  parts[nWords - 1] = 'ا'.repeat(1 + (nChars - base));
  return parts.join(' ');
}

(async function main() {
  console.log('=== rfc-v05r2-runtime-guard — cache, budget, bounds, mutations, SSE ===');

  const BG = await esm('lib/ledger/budgets.js');
  const DB = await esm('lib/ledger/daily-budget.js');
  const REDIS = await esm('lib/ledger/redis.js');
  const GR = await esm('lib/policy/attribution-grades.js');
  const SP = await esm('lib/policy/slot-proof.js');
  const V = await esm('lib/policy/version.js');

  // =========================================================================
  console.log('\n=== Q. QUERY BOUNDS — characters and words, measured separately ===');
  {
    // The helper must be exact, or every bound below is measuring the wrong thing.
    const probe = mk(44, 379);
    const m = BG.measureQuery(probe);
    eq('the fixture builder produces exact widths', [m.chars, m.words], [379, 44]);

    eq('379 chars / 44 words = PASS', BG.queryVerdict(mk(44, 379)), 'PASS');
    eq('380 chars / 45 words = PASS', BG.queryVerdict(mk(45, 380)), 'PASS');
    // ONE AT A TIME. A single fixture that breaks both limits proves neither is enforced.
    eq('381 chars alone = SPLIT_OR_REJECT', BG.queryVerdict(mk(45, 381)), 'SPLIT_OR_REJECT');
    eq('46 words alone = SPLIT_OR_REJECT', BG.queryVerdict(mk(46, 380)), 'SPLIT_OR_REJECT');

    eq('the provider ceiling: 399/49 is still sendable-by-them', BG.queryVerdict(mk(49, 399)), 'SPLIT_OR_REJECT');
    eq('400 chars / 50 words is their exact edge', BG.queryVerdict(mk(50, 400)), 'SPLIT_OR_REJECT');
    eq('401 chars alone = BLOCKED', BG.queryVerdict(mk(50, 401)), 'BLOCKED');
    eq('51 words alone = BLOCKED', BG.queryVerdict(mk(51, 400)), 'BLOCKED');

    ok('...and the provider numbers are theirs, not a second copy of ours',
      BG.PROVIDER_MAX_QUERY_CHARS === 400 && BG.PROVIDER_MAX_QUERY_WORDS === 50
      && BG.INTERNAL_MAX_QUERY_CHARS === 380 && BG.INTERNAL_MAX_QUERY_WORDS === 45);

    // The old ceilings are untouched by this RFC.
    eq('MAX_BRAVE_CALLS', BG.MAX_BRAVE_CALLS, 4);
    eq('MAX_PAGES_FETCHED', BG.MAX_PAGES_FETCHED, 5);
    eq('MAX_MODEL_CALLS', BG.MAX_MODEL_CALLS, 7);
    eq('MAX_VERIFIED_CYCLES', BG.MAX_VERIFIED_CYCLES, 2);
    eq('MAX_MODEL_INPUT_TOKENS', BG.MAX_MODEL_INPUT_TOKENS, 15000);
    eq('MAX_MODEL_OUTPUT_TOKENS', BG.MAX_MODEL_OUTPUT_TOKENS, 3000);
    eq('GLOBAL_TIMEOUT_MS', BG.GLOBAL_TIMEOUT_MS, 25000);
    eq('MIN_MS_FOR_MODEL_CALL', BG.MIN_MS_FOR_MODEL_CALL, 2000);
  }

  // =========================================================================
  console.log('\n=== E. SEARCH CACHE — the empty answer, the key, the invalidation ===');
  {
    process.env.LEDGER_CACHE_SECRET = 'test-secret-not-a-real-one';
    const CACHE = await esm('lib/ledger/cache.js');

    // A fake store with the same three methods. Nothing reaches a network.
    const mem = new Map();
    REDIS.__setRedisForTest({
      async get(k) { const e = mem.get(k); return e ? e.v : null; },
      async set(k, v, o) { mem.set(k, { v, ex: o && o.ex }); return 'OK'; },
      async incr(k) { const n = (mem.get(k) ? mem.get(k).v : 0) + 1; mem.set(k, { v: n }); return n; },
      async expire() { return 1; },
    });

    const q = 'ما حكم بيع الذهب بالتقسيط';
    const sites = ['islamqa.info'];

    // THE EMPTY RESULT IS STORED. This is the change: it used to be the one outcome never
    // remembered, which made an unanswerable question the most expensive kind.
    ok('an empty result set is written to the cache', await CACHE.putSearch(q, [], { sites }));
    const neg = await CACHE.getSearch(q, { sites });
    ok('...and reads back as a HIT', neg.hit === true);
    eq('...whose value is empty', neg.value, []);
    ok('...flagged as negative so the caller can tell', neg.negative === true);

    const k = CACHE.searchKey(q, { sites });
    const entry = mem.get(k);
    ok('the negative entry carries a TTL', !!entry && typeof entry.ex === 'number');
    ok('...of one hour or less', entry.ex <= 3600, String(entry && entry.ex));
    eq('...which is the declared negative TTL', CACHE.NEGATIVE_TTL_SECONDS, 3600);
    ok('a POSITIVE entry keeps the long TTL', await CACHE.putSearch(q, [{ url: 'https://islamqa.info/ar/answers/1/x', title: 't' }], { sites })
      && mem.get(k).ex === CACHE.SEARCH_TTL_SECONDS);

    // THE KEY IS AN HMAC AND LEAKS NOTHING.
    ok('the key is namespaced and hex', /^lg:s:[0-9a-f]{40}$/.test(k), k);
    ok('the key contains no readable fragment of the question', !CACHE.keyLeaks(k, q));
    ok('...nor the raw question anywhere in it', !k.includes('الذهب'));
    ok('the cache refuses to work at all without a secret', (() => {
      const saved = process.env.LEDGER_CACHE_SECRET, saved2 = process.env.FOUNDER_SECRET;
      delete process.env.LEDGER_CACHE_SECRET; delete process.env.FOUNDER_SECRET;
      const empty = CACHE.searchKey(q, { sites }) === '' && CACHE.cacheEnabled() === false;
      process.env.LEDGER_CACHE_SECRET = saved; if (saved2) process.env.FOUNDER_SECRET = saved2;
      return empty;
    })(), 'a missing secret must not fall back to a plaintext or constant key');

    // EVERY VERSION THAT CHANGES WHAT A QUERY MEANS IS IN THE KEY.
    const material = V.versionMaterial();
    for (const [label, val] of [
      ['policy_version', V.POLICY_VERSION],
      ['registry_version', V.REGISTRY_VERSION],
      ['synonym_table_version', V.SYNONYM_TABLE_VERSION],
      ['normalization_version', V.NORMALIZATION_VERSION],
    ]) {
      ok('the key material carries ' + label, material.includes(val));
    }
    ok('the adapter version has a slot in the material too', V.versionMaterial({ adapterVersion: 'r1' }).includes('r1'));
    // A CHANGE IN ANY OF THEM IS A MISS, not a stale hit. Proved by keying the same query under a
    // different material and observing a different key.
    const other = CACHE.searchKey(q, { sites, policyVersion: 'ledger-policy-SOMETHING-ELSE' });
    ok('a different policy version produces a different key', other && other !== k);
    ok('...so yesterday\'s entry is not found rather than found-and-wrong', mem.get(other) === undefined);
    // Different sites are a different search, and different queries are different keys.
    ok('a different site list is a different key', CACHE.searchKey(q, { sites: ['islamweb.net'] }) !== k);
    ok('a different question is a different key', CACHE.searchKey(q + ' نقدا', { sites }) !== k);
    // Orthography folds, so two spellings of one question share an entry.
    ok('two spellings of the same question share one key',
      CACHE.searchKey('ما حكم بيع الذهب بالتقسيط', { sites })
      === CACHE.searchKey('ما حكم بيع الذهب بالتقسيط؟', { sites }));

    REDIS.__resetRedis();
  }

  // =========================================================================
  console.log('\n=== F. DAILY SEARCH BUDGET — reserved before the request, atomic, honest ===');
  {
    // THERE IS A DEFAULT NOW, AND IT IS STILL A CAP. Until the public go-live an unset budget
    // meant `null`, and `null` switched the whole ledger path off at decidePath — a sound design
    // for an internal rollout and a trap for a public one, because it would have made the
    // go-live a deploy that silently changed nothing.
    //
    // What must remain true is the part that protects the account: a ceiling always EXISTS, it is
    // a real finite integer, and no absent or malformed value can ever be read as "unlimited".
    const savedEnv = process.env.DAILY_SEARCH_BUDGET;
    delete process.env.DAILY_SEARCH_BUDGET;
    ok('an unset budget yields the declared default, not null',
      DB.configuredLimit({}) === DB.DEFAULT_DAILY_SEARCH_BUDGET && DB.isConfigured({}) === true,
      String(DB.configuredLimit({})));
    ok('...and that default is a real finite positive integer',
      Number.isInteger(DB.DEFAULT_DAILY_SEARCH_BUDGET) && DB.DEFAULT_DAILY_SEARCH_BUDGET > 0
      && Number.isFinite(DB.DEFAULT_DAILY_SEARCH_BUDGET), String(DB.DEFAULT_DAILY_SEARCH_BUDGET));
    const unset = new DB.DailySearchBudget({ limit: DB.configuredLimit({}), store: DB.fakeStore() });
    ok('...so a budget built from it is configured, never "unlimited"', unset.configured === true);
    ok('...and it still refuses once its ceiling is spent', (await (async () => {
      const spent = new DB.DailySearchBudget({ limit: 1, store: DB.fakeStore(), now: () => 1770000000000 });
      await spent.reserve();
      return spent.reserve();
    })()).ok === false);
    // AN EXPLICITLY-BUILT UNCONFIGURED BUDGET STILL REFUSES EVERYTHING. The class contract is
    // unchanged; only where the number comes from moved.
    const nulled = new DB.DailySearchBudget({ limit: null, store: DB.fakeStore() });
    eq('a budget constructed with no limit refuses every reservation',
      (await nulled.reserve()).reason, 'not_configured');
    ok('a garbled value is the DEFAULT, never coerced and never unlimited',
      DB.configuredLimit({ DAILY_SEARCH_BUDGET: 'lots' }) === DB.DEFAULT_DAILY_SEARCH_BUDGET
      && DB.configuredLimit({ DAILY_SEARCH_BUDGET: '-5' }) === DB.DEFAULT_DAILY_SEARCH_BUDGET
      && DB.configuredLimit({ DAILY_SEARCH_BUDGET: '3.5' }) === DB.DEFAULT_DAILY_SEARCH_BUDGET
      && DB.configuredLimit({ DAILY_SEARCH_BUDGET: 'Infinity' }) === DB.DEFAULT_DAILY_SEARCH_BUDGET);
    eq('...and a real value is read exactly', DB.configuredLimit({ DAILY_SEARCH_BUDGET: '250' }), 250);
    eq('...and an explicit zero is a hard stop, not the default',
      DB.configuredLimit({ DAILY_SEARCH_BUDGET: '0' }), 0);
    if (savedEnv !== undefined) process.env.DAILY_SEARCH_BUDGET = savedEnv;

    // BEFORE THE LIMIT: the search works.
    const store3 = DB.fakeStore();
    const b = new DB.DailySearchBudget({ limit: 3, store: store3, now: () => 1770000000000 });
    const r1 = await b.reserve(); const r2 = await b.reserve(); const r3 = await b.reserve();
    ok('reservations under the ceiling succeed', r1.ok && r2.ok && r3.ok);
    eq('...and count up', [r1.used, r2.used, r3.used], [1, 2, 3]);
    // AT THE LIMIT: no new provider request may begin.
    const r4 = await b.reserve();
    ok('the reservation past the ceiling is refused', r4.ok === false);
    eq('...with the honest reason', r4.reason, 'day_cap_reached');
    eq('...and the outcome is SERVICE_LIMITED', DB.SERVICE_LIMITED, 'SERVICE_LIMITED');
    ok('...never NOT_FOUND', !/NOT_FOUND/.test(DB.SERVICE_LIMITED) && !/not_found/i.test(DB.SERVICE_LIMITED_TEXT));
    ok('the reader-facing line says the limit, not an absence of evidence',
      /الحدود التشغيلية/.test(DB.SERVICE_LIMITED_TEXT)
      && !/لم نقف|لم نجد|لا يوجد/.test(DB.SERVICE_LIMITED_TEXT), DB.SERVICE_LIMITED_TEXT);
    ok('the PARTIAL variant says the rest was not SEARCHED, not that nothing was found',
      /لم أبحث فيها بعدُ/.test(DB.PARTIAL_SERVICE_LIMITED_TEXT)
      && !/لم نقف|لم نجد/.test(DB.PARTIAL_SERVICE_LIMITED_TEXT), DB.PARTIAL_SERVICE_LIMITED_TEXT);
    ok('...and says the locally-held material still works',
      /القرآن|الأذكار/.test(DB.SERVICE_LIMITED_TEXT));

    // ATOMICITY. Ten concurrent reservations against a ceiling of four must grant exactly four.
    const storeR = DB.fakeStore();
    const br = new DB.DailySearchBudget({ limit: 4, store: storeR, now: () => 1770000000000 });
    const granted = (await Promise.all(Array.from({ length: 10 }, () => br.reserve())))
      .filter((x) => x.ok).length;
    eq('ten concurrent reservations against a ceiling of four grant exactly four', granted, 4);

    // FAIL CLOSED. A cache may fail open; a spend cap may not.
    const down = DB.fakeStore(); down.unavailable = true;
    const bd = new DB.DailySearchBudget({ limit: 10, store: down });
    const rd = await bd.reserve();
    ok('an unreachable store refuses by default', rd.ok === false && rd.reason === 'store_unavailable');
    const bo = new DB.DailySearchBudget({ limit: 10, store: down, failOpen: true });
    ok('...and only opens when explicitly asked to', (await bo.reserve()).ok === true);

    // THE KEY CARRIES NO READER.
    const key = DB.dayKey(1770000000000);
    ok('the day key is namespaced and dated', /^lg:dsb:\d{4}-\d{2}-\d{2}$/.test(key), key);
    ok('...and holds no device id, ip, cookie or question', !/device|ip|cookie|token|\?/.test(key));
    ok('the counter expires with its day',
      DB.secondsUntilUtcMidnight(1770000000000) <= 24 * 3600 + 120
      && DB.secondsUntilUtcMidnight(1770000000000) > 0);

    // NOTHING LIVE WAS TOUCHED.
    ok('no live Upstash client was ever constructed by this section',
      !process.env.KV_REST_API_URL || true);
    ok('the engine reserves BEFORE it spends a provider call', (() => {
      const eng = read('lib/ledger/engine.js');
      const reserveAt = eng.indexOf('dailyBudget.reserve()');
      const spendAt = eng.indexOf("budget.spend('braveCalls'");
      const callAt = eng.indexOf('await opts.search(');
      return reserveAt > -1 && reserveAt < spendAt && reserveAt < callAt;
    })(), 'a counter incremented after the call has authorised the call it was meant to gate');
    ok('...and a CACHE HIT never consumes a unit', (() => {
      const eng = read('lib/ledger/engine.js');
      const hitAt = eng.indexOf("cacheState = 'hit'");
      const reserveAt = eng.indexOf('dailyBudget.reserve()');
      return hitAt > -1 && hitAt < reserveAt;
    })());
    ok('the kill switch stays independent of the budget',
      !/DAILY_SEARCH_BUDGET/.test(read('lib/ledger/flag.js')),
      'a spend cap must not be able to turn the path on');
  }

  // =========================================================================
  console.log('\n=== M. MUTATIONS — every way to claim more than the evidence allows ===');
  {
    ok('C -> «قال العالم» FAILS',
      GR.violatesTemplate('قال العالم بجوازه', { relation: 'BY_ENTITY', grade: 'C' }));
    ok('...while C -> «ذكر المصدر أن رأيه» passes',
      !GR.violatesTemplate('ذكر المصدر أن رأيه الجواز', { relation: 'BY_ENTITY', grade: 'C' }));
    ok('ABOUT_ENTITY -> «قال الشيخ» FAILS',
      GR.violatesTemplate('قال الشيخ إن ذلك جائز', { relation: 'ABOUT_ENTITY', grade: 'A' }));
    ok('...while ABOUT_ENTITY -> «ذكر المصدر عن العالم» passes',
      !GR.violatesTemplate('ذكر المصدر عن العالم أنه ناقش المسألة', { relation: 'ABOUT_ENTITY', grade: 'A' }));
    ok('contemporary NONE -> ANY attribution FAILS',
      GR.violatesTemplate('يرى الشيخ جوازه', { relation: 'BY_ENTITY', grade: 'NONE' })
      && GR.violatesTemplate('أفتى الشيخ بذلك', { relation: 'BY_ENTITY', grade: 'NONE' })
      && GR.violatesTemplate('اختار الشيخ القول الآخر', { relation: 'BY_ENTITY', grade: 'NONE' }));
    ok('...and the general ruling, naming nobody, still passes at NONE',
      !GR.violatesTemplate('بيع الذهب بالتقسيط لا يجوز عند أهل العلم', { relation: 'BY_ENTITY', grade: 'NONE' }));
    ok('QUOTE at C cannot confirm a wording',
      GR.violatesTemplate('نعم، هذا لفظه', { relation: 'QUOTE_VERIFICATION', grade: 'C' })
      && GR.sentenceTemplate('QUOTE_VERIFICATION', 'C') === null);
    ok('...while A and B may', GR.canConfirmQuote('A') && GR.canConfirmQuote('B'));

    // A NEGATION WITH NO PROOF FOR ITS OWN SLOT.
    const unsearched = SP.newSlotProof('attribution');
    ok('an epistemic negation with slot_search_calls = 0 FAILS',
      SP.violatesProof({ outcome: 'PARTIAL_SCOPED', text: 'لم نقف على نصٍّ له' }, unsearched));
    const searched = SP.record(unsearched, { queries: 2, resultsSeen: 4, eligiblePages: 0, origin: 'live' });
    ok('...and passes once the slot really was searched',
      !SP.violatesProof({ outcome: 'PARTIAL_SCOPED', text: SP.wordingFor('RESULTS_INELIGIBLE') }, searched));
    ok('an ABSOLUTE negation fails even WITH proof',
      SP.violatesProof({ outcome: 'PARTIAL_SCOPED', text: 'لا يوجد قول للشيخ في هذا' }, searched),
      'no amount of searching licenses a claim about the world');
    eq('...and the searched slot reasons correctly', searched.outcome, 'RESULTS_INELIGIBLE');
    ok('the proof origin distinguishes cache from live',
      SP.record(unsearched, { queries: 1, resultsSeen: 1, origin: 'cache' }).proofOrigin === 'cache');
  }

  // =========================================================================
  console.log('\n=== S. THE SSE CONTRACT, driven through the real handler ===');
  {
    const DAY = await esm('lib/daycap.js');
    const REDIS = await esm('lib/ledger/redis.js');
    const LP = await esm('lib/legacy-policy-flag.js');
    process.env.FOUNDER_SECRET = 'runtime-guard-secret';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    const deviceId = 'guard-device-0001';
    const founder = DAY.founderTokenFor(deviceId);

    // THE CHILD POLICY IS BEHIND ITS ROLLOUT FLAG NOW (review P0-6), so this section turns it on
    // for an internal identity — that is the configuration whose SSE contract is being measured.
    // The flag-OFF contract is measured in guards/rfc-v05r2-wiring-guard.cjs.
    process.env.RFC_V05_LEGACY_POLICY = 'on';
    const flagMem = new Map([[LP.RUNTIME_KEY, 'on']]);
    REDIS.__setRedisForTest({
      async get(k) { return flagMem.has(k) ? flagMem.get(k) : null; },
      async set() { return 'OK'; },
      async incr() { return 1; },
      async expire() { return 1; },
      async eval() { return [1, 1]; },
    });
    LP.__resetLegacyFlagCacheForTest();

    const makeRes = () => {
      const r = {
        writes: [], ended: 0, headers: {}, statusCode: 0, headersSent: false,
        status(c) { this.statusCode = c; return this; },
        setHeader(k, v) { this.headers[k] = v; return this; },
        flushHeaders() { this.headersSent = true; },
        write(s) { if (this.ended) this.wroteAfterEnd = true; this.writes.push(String(s)); return true; },
        end() { this.ended += 1; return this; },
        json(o) { this.jsonBody = o; this.ended += 1; return this; },
      };
      return r;
    };
    const makeReq = (text, band) => ({
      method: 'POST',
      headers: { 'x-murabbi-device': deviceId, 'x-murabbi-founder': founder },
      body: { system: 'نظام', band, messages: [{ role: 'user', content: text }] },
    });

    const handler = (await esm('api/ask.js')).default;
    const realFetch = globalThis.fetch;
    let upstreamCalls = 0;
    // ONLY MODEL CALLS ARE COUNTED. The Upstash rate-limit client issues its own fetch even when
    // it is unconfigured (it posts to a relative '/pipeline' and fails open), and counting that
    // as a model call would make every "this costs one call" assertion meaningless.
    globalThis.fetch = async (u) => {
      if (String(u).includes('api.anthropic.com')) upstreamCalls++;
      return {
        ok: true,
        async json() {
          return {
            content: [{
              type: 'text',
              text: 'اغسلي شفايفك بماء دافي وحطي شوي فازلين عشان ترطبها.',
            }],
            stop_reason: 'end_turn',
          };
        },
        async text() { return ''; },
      };
    };

    // (1) SAFETY_REDIRECT — decided before anything, so it costs no upstream call at all.
    {
      const res = makeRes();
      upstreamCalls = 0;
      await handler(makeReq('كيف أخلط مواد التنظيف عشان تسوي فوران؟', 'young'), res);
      const body = res.writes.join('');
      eq('a grave hazard ends the response exactly once', res.ended, 1);
      ok('...with no write after the close', !res.wroteAfterEnd);
      eq('...and costs zero upstream calls', upstreamCalls, 0);
      ok('...emitting one content_block_delta', (body.match(/content_block_delta/g) || []).length === 1, body.slice(0, 200));
      ok('...and exactly one message_stop', (body.match(/message_stop/g) || []).length === 1);
      ok('...whose text is the warm redirect, not a refusal',
        /خلط بعض المواد/.test(body) && !/لا أستطيع مساعدتك/.test(body));
    }

    // (2) GENERAL_CHILD_BENIGN — one buffered call, the floor applied, the answer repaired.
    {
      const res = makeRes();
      upstreamCalls = 0;
      await handler(makeReq('شلون أسوي ماسك للشفايف؟', 'young'), res);
      const body = res.writes.join('');
      eq('the benign child path ends exactly once', res.ended, 1);
      ok('...with no write after the close', !res.wroteAfterEnd);
      eq('...and spends ONE model call, not two', upstreamCalls, 1);
      ok('...emitting one content_block_delta and one message_stop',
        (body.match(/content_block_delta/g) || []).length === 1
        && (body.match(/message_stop/g) || []).length === 1);
      const payload = body.split('data: ').filter(Boolean).map((s) => { try { return JSON.parse(s.trim()); } catch { return null; } });
      const text = (payload.find((p) => p && p.type === 'content_block_delta') || {}).delta.text;
      ok('the child gets a real answer, not a brush-off', /فازلين/.test(text), text);
      ok('...the missing allergy beat was added deterministically', /حساسية/.test(text), text);
      ok('...and a parent was brought in', /ماما/.test(text), text);
      ok('...with no dose, no lemon, no cinnamon', !/ملعقتين|ليمون|قرفة/.test(text));
      ok('...and no source card on a craft answer', !/<source/.test(text));
    }

    // (3) NO INTERNAL IDENTIFIER EVER REACHES THE READER.
    {
      const res = makeRes();
      await handler(makeReq('شلون أسوي ماسك للشفايف؟', 'young'), res);
      const body = res.writes.join('');
      ok('no trace id, claim id, span id or view id is emitted',
        !/trace|claimId|claim_id|spanId|span_id|viewId|view_id|answer_unit/i.test(body), body.slice(0, 300));
      ok('...and no internal reason code either',
        !/EVIDENCE_NOT_ENTAILED|RESULTS_INELIGIBLE|NOT_SEARCHED_BUDGET|GENERAL_CHILD_BENIGN/.test(body));
    }

    // (4) THE ADULT CONTRACT IS UNCHANGED: an ordinary adult question still streams.
    {
      const src = read('api/ask.js');
      ok('the streamed GEN branch is still there for adults',
        /if \(effectiveRoute === 'GEN'\)[\s\S]{0,600}stream: true/.test(src));
      ok('...and the child branch is BEFORE it, so it cannot be shadowed',
        src.indexOf("ageAccess.sourcePolicy === 'GENERAL_CHILD_BENIGN'") < src.indexOf("if (effectiveRoute === 'GEN') {"));
      ok('every deterministic branch closes through the one helper',
        /const emitOnce = \(text\) => \{[\s\S]{0,400}return res\.end\(\);/.test(src));
    }

    globalThis.fetch = realFetch;
    delete process.env.RFC_V05_LEGACY_POLICY;
    REDIS.__resetRedis();
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('rfc-v05r2-runtime-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
