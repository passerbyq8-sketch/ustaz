// guards/ledger-telemetry-guard.cjs — lib/ledger/telemetry.js, and the engine that is supposed
// to be feeding it.
//
// WHY THIS GATE EXISTS. telemetry.js shipped complete, careful and UNREACHED BY ANY REQUEST: six
// exports, a hand-written allow-list, a 48-hour TTL, and no importer in lib/ or api/ at all.
// ledger-runtime-guard.cjs did unit-test it against synthetic shapes — so the allow-list was not
// literally untried — but nothing in the SHIPPED path ever handed it a real request, so the one
// promise that mattered, «every ledger request leaves a trace», was false and no gate could say so.
// A module can be well tested and still be dead, and the suite could not tell the two apart.
//
// SINCE 2026-08-07 IT IS WRITTEN FOR EVERY REQUEST, not only an internal tester's (owner
// decision): the group test cannot count a request nobody can observe. Section D asserts that
// removal as a removal, and section I covers the collision the opening exposed.
//
// SO THE CENTRAL CHECK HERE IS A NEGATIVE ONE. Section C runs the engine and demands a trace come
// back. Delete the wiring from lib/ledger/engine.js and section C fails; that is the whole point,
// and it is why the check is driven rather than grepped. Section B is the other half of the same
// idea from the other end: the allow-list is handed the ten things the module's own header
// forbids by name, and every one of them must land in `dropped`.
//
// WHAT MUST NOT CHANGE. Telemetry may never cost a reader an answer, and may never delay one.
// Section E proves the answer is byte-identical with the store reachable and unreachable, and
// section F proves the write happens after the socket is closed rather than before the first byte.
//
// SECTION F NOW PINS TWO ORDERINGS, IN OPPOSITE DIRECTIONS (2026-08-07). The telemetry STORE write
// stays after res.end(); the `[ledger]` COUNTS line moved in front of it. The line used to be
// logged from api/ask.js on the line after `await runLedgerTurn(...)` — after res.end() — and a
// serverless invocation may be frozen at response completion, so it was written and never shipped.
// The first live probe on the opened engine returned a refusal with no counts line anywhere in the
// log, which is a missing instrument reading exactly like a healthy one. Section G proves the two
// FAILING exits kept their line through the move, and section I proves it did not stay behind in
// the handler.
//
// Offline and deterministic. No network, no model, no key, no live Redis.
//
// Usage: node guards/ledger-telemetry-guard.cjs
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

// The planner's example, taken by brace depth rather than by the prose around it — the same
// method ledger-contract-guard.cjs uses, for the same reason.
const templateOf = (p) => {
  const a = String(p || '').indexOf('{');
  if (a === -1) return '';
  let d = 0;
  for (let i = a; i < p.length; i++) {
    if (p[i] === '{') d++;
    else if (p[i] === '}') { d--; if (d === 0) return p.slice(a, i + 1); }
  }
  return '';
};

// A store double that RECORDS rather than stores, so a test can assert the key, the TTL and the
// value the engine's telemetry actually tried to write.
function recordingRedis() {
  const writes = [];
  return {
    writes,
    async set(k, v, o) { writes.push({ key: k, value: v, ex: o && o.ex }); return 'OK'; },
    async get() { return null; },
    async incr() { return 1; },
    async expire() { return 1; },
    async eval() { return null; },
  };
}

(async function main() {
  console.log('=== ledger-telemetry-guard — the metrics record, and the engine that feeds it ===');

  const T = await esm('lib/ledger/telemetry.js');
  const STORE = await esm('lib/ledger/redis.js');
  const SCHEMA = await esm('lib/ledger/schema.js');

  // =========================================================================
  console.log('\n=== A. THE SIX EXPORTS, MEASURED RATHER THAN ASSUMED ===');
  {
    for (const n of ['TELEMETRY_TTL_SECONDS', 'TELEMETRY_SCHEMA_VERSION', 'ALLOWED_FIELDS',
      'buildRecord', 'fromLedger', 'record']) {
      ok('exports ' + n, T[n] !== undefined);
    }
    eq('the TTL is 48 hours to the second', T.TELEMETRY_TTL_SECONDS, 48 * 60 * 60);
    ok('...and it is a CEILING the header promises, not a suggestion',
      T.TELEMETRY_TTL_SECONDS <= 48 * 60 * 60);
    eq('the schema version is the one a reader of the store would key off',
      T.TELEMETRY_SCHEMA_VERSION, 'lg-telem-v1');
    ok('ALLOWED_FIELDS is frozen — an allow-list a caller can push onto is not one',
      Object.isFrozen(T.ALLOWED_FIELDS));
    ok('...and every ledger field the engine feeds it is on the list',
      ['trace_id', 'states', 'outcome', 'flag_state', 'latency_by_stage', 'rejection_codes']
        .every((f) => T.ALLOWED_FIELDS.includes(f)));
  }

  // =========================================================================
  // THE NEGATIVE HALF OF THE ALLOW-LIST. Each of these is named in telemetry.js's own header as
  // something that may never be retained. The list is written out in full rather than sampled:
  // the header makes ten promises, so ten things are offered and ten must be refused.
  console.log('\n=== B. THE TEN FORBIDDEN THINGS ARE REFUSED BY NAME ===');
  {
    const forbidden = {
      question: 'ما حكم صيام يوم عرفة لغير الحاج؟',
      page_text: 'the full extracted authorial text of some fetched page',
      exact_text: 'the exact span a claim was cut from',
      draft: 'the drafted answer before Gate 3 saw it',
      surviving_sentence: 'a sentence that survived Gate 3',
      device_id: 'dev_8f3a1c',
      cookie: 'sid=abc123',
      ip: '203.0.113.7',
      header: 'authorization: Bearer x',
      // Deliberately SHORT and obviously fake. The value is irrelevant to the assertion — the
      // field is refused on its KEY, not its contents — and a longer literal trips recon-audit's
      // generic-secret scanner, which is a rule worth keeping sharper than this fixture.
      token: 'tok_fake',
      cache_key_input: 'the query a cache key was built from',
    };
    const { record, dropped } = T.buildRecord(forbidden);
    for (const k of Object.keys(forbidden)) {
      ok('drops ' + k, dropped.includes(k) && !(k in record));
    }
    eq('...and the record it produced carries the schema stamp and NOTHING else',
      Object.keys(record), ['schema']);

    // The subtler failure: a field that IS on the allow-list, carrying prose. `outcome` is a code,
    // so a sentence in it must be refused by the VALUE check even though the KEY was welcome.
    const prose = T.buildRecord({ outcome: 'we could not find evidence for this question' });
    ok('an allowed KEY carrying prose is still refused',
      prose.dropped.includes('outcome') && !('outcome' in prose.record));
    const nonAscii = T.buildRecord({ outcome: 'رفض' });
    ok('...and so is an allowed key carrying non-ASCII',
      nonAscii.dropped.includes('outcome'));
    const nested = T.buildRecord({ latency_by_stage: { plan: { hidden: 'text here' } } });
    ok('...and a second level of nesting, where free text hides',
      JSON.stringify(nested.record.latency_by_stage) === '{}');
    const good = T.buildRecord({ outcome: 'SAFE_REJECTION', latency_by_stage: { plan: 12 } });
    ok('a well-formed record still passes — the list refuses, it does not reject everything',
      good.dropped.length === 0 && good.record.outcome === 'SAFE_REJECTION'
        && good.record.latency_by_stage.plan === 12);
  }

  // =========================================================================
  // THE CHECK THIS WHOLE GATE EXISTS FOR. Not "is telemetry.js correct" — it always was — but
  // "does anything CALL it". Driven, because a regex proves a line was typed.
  console.log('\n=== C. THE ENGINE RUNS AND A TRACE COMES BACK ===');
  let engineRecord = null;
  {
    const ENG = await esm('lib/ledger/engine.js');
    const DB = await esm('lib/ledger/daily-budget.js');
    const PLAN = await esm('lib/ledger/planner.js');
    const Q = 'ما حكم صيام يوم عرفة لغير الحاج؟';
    const tpl = templateOf(PLAN.buildPlannerPrompt(Q));
    const stubFetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: tpl }] }),
      text: async () => JSON.stringify({ content: [{ type: 'text', text: tpl }] }),
    });
    // callModel() refuses with `no-key` before it reaches fetchImpl, so a fake key is set for the
    // drive and removed after. Nothing leaves the machine: every call in this block is the stub.
    const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
    let out;
    try {
      out = await ENG.runEngine(Q, {
        band: 'adult', audienceBand: 'adult', bandSites: ['islamqa.info'],
        fetchImpl: stubFetch, search: async () => [],
        flagState: 'mode_public',
        dailyBudget: new DB.DailySearchBudget({ limit: 100, now: () => 1770000000000, store: DB.fakeStore() }),
      });
    } finally {
      if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey;
      else delete process.env.ANTHROPIC_API_KEY;
    }

    ok('runEngine() returns the `telemetry` its own JSDoc has always promised',
      out.telemetry !== undefined && out.telemetry !== null,
      'telemetry=' + JSON.stringify(out.telemetry));
    ok('...as { record, dropped }, so a caller can see what was REFUSED and not just what was kept',
      out.telemetry && out.telemetry.record && Array.isArray(out.telemetry.dropped));
    engineRecord = out.telemetry && out.telemetry.record;
    ok('the record is stamped with the schema version', engineRecord.schema === T.TELEMETRY_SCHEMA_VERSION);
    ok('...and carries the trace id the ledger ran under',
      engineRecord.trace_id === out.ledger.traceId,
      'record=' + engineRecord.trace_id + ' ledger=' + out.ledger.traceId);
    ok('...and the state machine it actually walked',
      Array.isArray(engineRecord.states) && engineRecord.states.includes('ANALYZE_QUERY_IR')
        && engineRecord.states.includes('DONE'));
    ok('...and the outcome the READER got, not an intermediate one',
      engineRecord.outcome === out.outcome, 'record=' + engineRecord.outcome + ' out=' + out.outcome);
    ok('...and the rollout arm it was routed down', engineRecord.flag_state === 'mode_public');
    ok('...and the source policy version that governed it',
      typeof engineRecord.source_policy_version === 'string' && engineRecord.source_policy_version.length > 0);
    ok('...and where the milliseconds went', typeof engineRecord.latency_by_stage === 'object');
    ok('...and why it refused', Array.isArray(engineRecord.rejection_codes));

    // NOTHING WAS SILENTLY REFUSED. A non-empty `dropped` on an ordinary engine run would mean the
    // engine is feeding a shape the allow-list does not recognise — the metric would be quietly
    // missing rather than loudly wrong, which is the harder failure to notice.
    eq('an ordinary engine run has NOTHING dropped — engine and allow-list agree', out.telemetry.dropped, []);

    // THE NEGATIVE CONTROL. A ledger that never ran the engine produces a shape with no states and
    // no outcome, which is what makes the assertions above meaningful rather than tautological.
    // A fresh Ledger is ALREADY in ANALYZE_QUERY_IR — the constructor seeds the first state — so
    // "has states" is not the discriminator. Reaching DONE is: only a run that walked the machine
    // gets there, which is what makes the assertions above evidence rather than restatement.
    const virgin = new SCHEMA.Ledger('tr_000000');
    const bare = T.fromLedger(virgin, {});
    eq('a ledger that never ran is still sitting on its first state',
      bare.record.states, ['ANALYZE_QUERY_IR']);
    ok('...and never reaches DONE — so DONE above proves the engine actually ran',
      !bare.record.states.includes('DONE') && engineRecord.states.includes('DONE'));
    ok('...and its outcome is UNKNOWN rather than a borrowed one', bare.record.outcome === 'UNKNOWN');
  }

  // =========================================================================
  // C2. THE REFUSAL NAMES THE FIELD, AND THE NAME SURVIVES THE ALLOW-LIST
  //
  // WHY THIS SECTION EXISTS. On 2026-08-07 every ledger request on the opened engine came back
  // PLAN_INVALID with `model:1, brave:0` — and the stored record said
  // `rejection_codes: ["query_plan_failed_schema_validation"]` and NOTHING else. The engine was
  // building the broken field's name at lib/ledger/engine.js and handing it to reject(), and
  // telemetryShape() published `rejections.map(r => r.code)` — so the name was built and dropped
  // one layer later. The detail is prose and the allow-list refuses prose, correctly; the fix is
  // a BARE-IDENTIFIER channel beside the code, and this section is what stops it rotting back.
  console.log('\n=== C2. rejection_codes NAMES THE FIELD, IN TOKENS A STORE MAY KEEP ===');
  {
    const IR = await esm('lib/ledger/query-ir.js');
    ok('query-ir publishes a CLOSED set of field tokens', Object.isFrozen(IR.IR_FIELDS)
      && IR.IR_FIELDS.includes('intent') && IR.IR_FIELDS.includes('unknown_field'));

    // 1. THE HAPPY CASE: a code plus a field, in one keepable token.
    const led = new SCHEMA.Ledger('tr_000c02');
    led.reject(SCHEMA.REJECTION.PLAN_INVALID, 'schema; issue[0] intent is not one of fatwa|…',
      null, ['intent', 'temporal_scope']);
    const shape = led.telemetryShape();
    eq('the ledger publishes code:field, one entry per field', shape.rejection_codes,
      ['query_plan_failed_schema_validation:intent',
        'query_plan_failed_schema_validation:temporal_scope']);
    const built = T.buildRecord({ rejection_codes: shape.rejection_codes });
    eq('...and the allow-list keeps them verbatim — no widening was needed to carry a field name',
      built.record.rejection_codes, shape.rejection_codes);
    eq('...and dropped nothing', built.dropped, []);

    // 2. THE PROSE THE DETAIL CARRIES IS STILL NEVER PUBLISHED. `detail` holds the reader-free
    //    sentence for a log; if it ever leaked into the codes, the store would hold free text.
    ok('the prose detail reaches no published field',
      JSON.stringify(shape).indexOf('issue[0] intent is not one of') === -1);

    // 3. THE CHANNEL IS CONSTRAINED AT THE LEDGER, NOT BY CALLER DISCIPLINE. This is the field a
    //    future caller would widen with one String(e.message), so it refuses anything that is
    //    not a short bare identifier — including the reader's own words.
    const dirty = new SCHEMA.Ledger('tr_000c03');
    dirty.reject(SCHEMA.REJECTION.PLAN_INVALID, '', null,
      ['ما حكم صيام يوم عرفة لغير الحاج؟', 'has a space', 'UPPER', 'x'.repeat(64), 'intent']);
    eq('reject() keeps ONLY bare identifiers — Arabic, spaces, capitals and over-long are dropped',
      dirty.telemetryShape().rejection_codes, ['query_plan_failed_schema_validation:intent']);

    // 4. AND AN INVENTED KEY REPORTS ITS CLASS, NEVER ITSELF. The key is a string the model
    //    wrote; publishing it would put model-authored text in the store through the one door
    //    that was opened to close a diagnosis gap.
    const v = IR.validateQueryPlan({
      issues: [{
        issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
        protected_entities: ['بيع الذهب'], core_terms: ['التقسيط'], context_vars: [],
        exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
      }],
      missing_qualifiers: [], confidence: 'high',
      // Batch 5, cause 3, verbatim: the key a model adds INSIDE the object while obeying
      // «no text outside it».
      reasoning: 'لأنّ السؤال عن حكم بيع الذهب بالتقسيط',
    }, 'ما حكم بيع الذهب بالتقسيط؟');
    eq('an invented key is reported as a CLASS, not as the key', v.problemFields, ['unknown_field']);
    ok('...and neither the key nor its value appears in any token',
      !v.problemFields.some((f) => /reasoning|لأنّ/.test(f)));

    // 5. THE LENGTH INVARIANT, ASSERTED RATHER THAN HOPED FOR. sanitizeValue() drops a string
    //    over 64 chars SILENTLY — a code:field pair that outgrew the bound would vanish from the
    //    record and look exactly like a request that never failed.
    const longest = IR.IR_FIELDS.reduce((a, b) => (b.length > a.length ? b : a));
    ok('every code:field this ledger can emit fits inside the allow-list value bound',
      (SCHEMA.REJECTION.PLAN_INVALID + ':' + longest).length <= 64,
      SCHEMA.REJECTION.PLAN_INVALID + ':' + longest);
  }

  // =========================================================================
  console.log('\n=== D. record() — WHAT IT WRITES, AND THE TWO THINGS IT REFUSES ===');
  {
    // ── THE GATE THAT WAS REMOVED, ASSERTED AS REMOVED ────────────────────
    //
    // record() used to refuse unless the caller passed `internal: true`. As of 2026-08-07 it
    // writes for every request (owner decision): the group test cannot count a request nobody can
    // observe. The check is kept — inverted — rather than deleted, because "this used to refuse
    // and must now not" is exactly the kind of reversal that gets silently reinstated later.
    const fake0 = recordingRedis();
    STORE.__setRedisForTest(fake0);
    const noClaim = await T.record(engineRecord);
    ok('a caller claiming nothing at all still writes', noClaim.written === true, JSON.stringify(noClaim));
    const legacyArg = await T.record(engineRecord, { internal: false });
    ok('...and an explicit internal:false is not a refusal either — the argument is dead',
      legacyArg.written === true, JSON.stringify(legacyArg));
    ok('no code path can answer "not-internal" any more',
      noClaim.reason !== 'not-internal' && legacyArg.reason !== 'not-internal'
        && !/not-internal/.test(read('lib/ledger/telemetry.js')));
    STORE.__resetRedis();

    // WHAT SURVIVED THE OPENING. The allow-list is now the ONLY thing keeping a reader's words out
    // of this store, so it is re-asserted HERE, against the record an opened write actually
    // carries, and not only against the synthetic shapes of section B.
    ok('the record an opened write carries still holds no question and no page text',
      !/[؀-ۿ]/.test(JSON.stringify(engineRecord)),
      JSON.stringify(engineRecord).slice(0, 200));

    // BAD TRACE ID. The key is built from it, so an unvalidated one is a key injection.
    for (const bad of [undefined, '', 'ab', 'x'.repeat(49), 'has space', 'lg:colon']) {
      const r = await T.record({ ...engineRecord, trace_id: bad });
      ok('refuses trace id ' + JSON.stringify(bad), r.written === false && r.reason === 'bad-trace-id');
    }

    // STORE UNREACHABLE. An outage is an answer, not an exception.
    STORE.__setRedisForTest(null);
    const down = await T.record(engineRecord);
    eq('an unreachable store is reported, not thrown',
      down, { written: false, reason: 'store-unavailable' });

    // THE WRITE ITSELF.
    const fake = recordingRedis();
    STORE.__setRedisForTest(fake);
    const up = await T.record(engineRecord);
    ok('a good trace id writes', up.written === true, JSON.stringify(up));
    eq('exactly one write', fake.writes.length, 1);
    const w = fake.writes[0];
    ok('the key is namespaced lg: like every other key this engine writes',
      w.key.startsWith('lg:'), w.key);
    eq('...under the telemetry prefix, keyed by trace id',
      w.key, 'lg:t:' + engineRecord.trace_id);
    eq('...with the 48-hour TTL, so the store is not a record of anything',
      w.ex, T.TELEMETRY_TTL_SECONDS);
    ok('...and the value is the record, carrying no question and no page text',
      JSON.stringify(w.value).indexOf('حكم') === -1 && w.value.schema === T.TELEMETRY_SCHEMA_VERSION);
    STORE.__resetRedis();
  }

  // =========================================================================
  // TELEMETRY MAY NOT COST A READER AN ANSWER. The strongest form of that is: run the same
  // question twice, once with a store and once with none, and demand the reply be identical.
  console.log('\n=== E. ZERO BEHAVIOUR CHANGE, PROVED BY RUNNING IT BOTH WAYS ===');
  {
    const SEAM = await esm('lib/ledger/seam.js');
    const DB = await esm('lib/ledger/daily-budget.js');
    const PLAN = await esm('lib/ledger/planner.js');
    const Q = 'ما حكم صيام يوم عرفة لغير الحاج؟';
    const tpl = templateOf(PLAN.buildPlannerPrompt(Q));
    const stubFetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: tpl }] }),
      text: async () => JSON.stringify({ content: [{ type: 'text', text: tpl }] }),
    });
    const fakeRes = () => {
      const frames = [];
      return { frames, write(s) { frames.push(s); }, end() { frames.push('<<END>>'); } };
    };
    const drive = async () => {
      const res = fakeRes();
      const out = await SEAM.runLedgerTurn(res, {
        messages: [{ role: 'user', content: Q }],
        band: 'adult', audienceBand: 'adult', bandSites: ['islamqa.info'],
        fetchImpl: stubFetch, search: async () => [],
        flagState: 'mode_public',
        traceId: 'tr_fixed01',
        dailyBudget: new DB.DailySearchBudget({ limit: 100, now: () => 1770000000000, store: DB.fakeStore() }),
      });
      return { res, out };
    };

    const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
    let withStore, withoutStore, fake;
    try {
      fake = recordingRedis();
      STORE.__setRedisForTest(fake);
      withStore = await drive();
      STORE.__setRedisForTest(null);
      withoutStore = await drive();
    } finally {
      STORE.__resetRedis();
      if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey;
      else delete process.env.ANTHROPIC_API_KEY;
    }

    eq('the answer text is byte-identical with a store and without one',
      withoutStore.out.text, withStore.out.text);
    eq('...and so is the outcome', withoutStore.out.outcome, withStore.out.outcome);
    eq('...and so is every byte written to the socket',
      withoutStore.res.frames, withStore.res.frames);
    ok('the store WAS reachable in the first run, so the comparison meant something',
      fake.writes.length === 1, 'writes=' + fake.writes.length);
    ok('...and the unreachable run reported the failure rather than hiding it',
      withoutStore.out.telemetryWritten.written === false
        && withoutStore.out.telemetryWritten.reason === 'store-unavailable',
      JSON.stringify(withoutStore.out.telemetryWritten));
  }

  // =========================================================================
  // A WRITE IN FRONT OF THE FIRST BYTE IS A LATENCY CHANGE, which is a behaviour change the owner
  // ruled out. The ordering is asserted rather than trusted to the reading of the source.
  //
  // ── AND THE OTHER HALF, SINCE 2026-08-07: THE COUNTS LINE GOES THE OTHER WAY ──
  //
  // The `[ledger]` stdout line and the telemetry STORE write are pinned to OPPOSITE sides of
  // res.end(), and both sides are load-bearing:
  //
  //   store write  — AFTER close. It is a network round trip; in front of the reader's bytes it
  //                  is a latency change.
  //   counts line  — BEFORE close. It used to be logged from api/ask.js after the await, i.e.
  //                  after res.end(); the platform may freeze the invocation at response
  //                  completion, so the line was written and never shipped. The first live probe
  //                  on the opened engine produced a refusal and NO counts line at all, which is
  //                  how a missing instrument was mistaken for a working one.
  //
  // Both are DRIVEN onto one timeline — console.log is patched, not grepped — because a source
  // reading proves only which line was typed first, and the failure being fixed was a line that
  // was typed in the right order and still never arrived.
  console.log('\n=== F. THE WRITE HAPPENS AFTER THE READER, THE COUNTS LINE BEFORE THE CLOSE ===');
  {
    const SEAM = await esm('lib/ledger/seam.js');
    const DB = await esm('lib/ledger/daily-budget.js');
    const PLAN = await esm('lib/ledger/planner.js');
    const Q = 'ما حكم صيام يوم عرفة لغير الحاج؟';
    const tpl = templateOf(PLAN.buildPlannerPrompt(Q));
    const stubFetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: tpl }] }),
      text: async () => JSON.stringify({ content: [{ type: 'text', text: tpl }] }),
    });
    // ONE timeline, both kinds of event on it, so "after" is a fact about order and not a claim
    // about which file a line appears in.
    const timeline = [];
    const res = {
      write() { timeline.push('socket:write'); },
      end() { timeline.push('socket:end'); },
    };
    const spy = recordingRedis();
    const origSet = spy.set.bind(spy);
    spy.set = async (k, v, o) => { timeline.push('store:write'); return origSet(k, v, o); };

    // THE STDOUT LINE IS AN EVENT ON THE SAME TIMELINE. Captured by patching console.log, so
    // "before the close" is a fact about when it ran and not about where it appears in a file.
    const counts = [];
    const origLog = console.log;
    console.log = function (...a) {
      if (a[0] === '[ledger]' && a[1] && typeof a[1] === 'object') {
        timeline.push('stdout:counts');
        counts.push(a[1]);
        return; // swallowed, so the guard's own PASS/FAIL output stays readable
      }
      return origLog.apply(console, a);
    };

    const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
    try {
      STORE.__setRedisForTest(spy);
      await SEAM.runLedgerTurn(res, {
        messages: [{ role: 'user', content: Q }],
        band: 'adult', audienceBand: 'adult', bandSites: ['islamqa.info'],
        fetchImpl: stubFetch, search: async () => [],
        flagState: 'mode_public', traceId: 'tr_order1',
        dailyBudget: new DB.DailySearchBudget({ limit: 100, now: () => 1770000000000, store: DB.fakeStore() }),
      });
    } finally {
      console.log = origLog;
      STORE.__resetRedis();
      if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey;
      else delete process.env.ANTHROPIC_API_KEY;
    }
    const firstStore = timeline.indexOf('store:write');
    const socketEnd = timeline.indexOf('socket:end');
    const countsAt = timeline.indexOf('stdout:counts');
    ok('the store was written at all', firstStore !== -1, JSON.stringify(timeline));
    ok('the socket was closed at all', socketEnd !== -1, JSON.stringify(timeline));
    ok('NO store write happens before the socket is closed',
      firstStore > socketEnd, JSON.stringify(timeline));

    // ── THE COUNTS LINE, PINNED TO THE OTHER SIDE ─────────────────────────────
    ok('the counts line was printed at all', countsAt !== -1, JSON.stringify(timeline));
    ok('...exactly once, so no exit double-logs a request',
      counts.length === 1, 'counts=' + counts.length + ' ' + JSON.stringify(timeline));
    ok('the counts line prints BEFORE the socket is closed — logged after res.end() it is '
      + 'written and never shipped, which is the defect this ordering exists to prevent',
      countsAt !== -1 && countsAt < socketEnd, JSON.stringify(timeline));
    ok('...and therefore before the store write as well, which stays behind the close',
      countsAt !== -1 && countsAt < firstStore, JSON.stringify(timeline));
    // NOT TAUTOLOGICAL. If every event landed at the same index the three checks above would all
    // hold vacuously; the timeline must actually contain the close and the write after the line.
    ok('...and the timeline really does continue past it — close and store write both follow',
      socketEnd > countsAt && firstStore > countsAt && socketEnd !== firstStore,
      JSON.stringify(timeline));

    // WHAT THE LINE CARRIES. The reason this instrument exists is to answer "was Brave called",
    // so a line that prints on time and carries undefined counters is no better than no line.
    const c = counts[0] || {};
    eq('the counts line carries exactly the six fields, in order',
      Object.keys(c), ['trace', 'outcome', 'model', 'brave', 'fetch', 'ms']);
    ok('...with real numbers in the three spend counters and the clock, not undefined',
      [c.model, c.brave, c.fetch, c.ms].every((n) => typeof n === 'number'), JSON.stringify(c));
    ok('...and the trace id this request actually ran under', c.trace === 'tr_order1', JSON.stringify(c));
    ok('...and the outcome the reader got', typeof c.outcome === 'string' && c.outcome.length > 0,
      JSON.stringify(c));
    // COUNTS AND CODES ONLY — the same promise the telemetry record makes, made again here,
    // because stdout is a second place a question could leak into.
    ok('...and no question, no answer and no Arabic of any kind',
      !/[؀-ۿ]/.test(JSON.stringify(c)), JSON.stringify(c));
  }

  // =========================================================================
  // THE THREE EXITS. A metrics store that only hears about the requests that WORKED is a store
  // that will report a healthy engine on the day it breaks.
  //
  // AND THEY ARE COUNTED TOO. The counts line used to be logged from api/ask.js after the await,
  // which covered all three exits as a side effect of where it sat. Moving it into the seam made
  // that coverage a CHOICE, and the wrong choice — logging only the successful exit — would have
  // silently dropped the counts for exactly the requests a counts line gets read for. So each
  // failing exit is driven and its line is caught off stdout, on the same timeline as its close.
  console.log('\n=== G. THE FAILING EXITS ARE TRACED, AND COUNTED, TOO ===');
  {
    const SEAM = await esm('lib/ledger/seam.js');
    // One timeline per drive: the close is an event on it, so "the line came before the close"
    // is checkable at the failing exits and not only at the successful one.
    let timeline = [];
    const fakeRes = () => ({ write() {}, end() { timeline.push('socket:end'); } });

    const counts = [];
    const origLog = console.log;
    const patch = () => {
      console.log = function (...a) {
        if (a[0] === '[ledger]' && a[1] && typeof a[1] === 'object') {
          timeline.push('stdout:counts');
          counts.push(a[1]);
          return;
        }
        return origLog.apply(console, a);
      };
    };

    const spy1 = recordingRedis();
    STORE.__setRedisForTest(spy1);
    let noQ, noQTimeline;
    patch();
    try {
      noQ = await SEAM.runLedgerTurn(fakeRes(), {
        messages: [], traceId: 'tr_noq001', flagState: 'mode_public',
        dailyBudgetMode: 'fixture',
      });
    } finally { console.log = origLog; noQTimeline = timeline; timeline = []; }
    ok('a turn with no readable question still leaves a trace',
      spy1.writes.length === 1, 'writes=' + spy1.writes.length);
    ok('...naming what happened', spy1.writes.length === 1 && spy1.writes[0].value.outcome === 'NO_QUESTION',
      JSON.stringify(spy1.writes[0] && spy1.writes[0].value));
    ok('...and NOT carrying the reason string, which the allow-list has no field for',
      noQ.reason === 'no-user-turn' && !('reason' in (spy1.writes[0] || {}).value));
    eq('...and it is COUNTED on stdout as well, before its close',
      noQTimeline, ['stdout:counts', 'socket:end']);
    ok('...with a null trace, because this exit never reached the engine and has no ledger',
      counts.length === 1 && counts[0].trace === null && counts[0].outcome === 'SAFE_REJECTION',
      JSON.stringify(counts[0]));

    const spy2 = recordingRedis();
    STORE.__setRedisForTest(spy2);
    let threwTimeline;
    patch();
    try {
      await SEAM.runLedgerTurn(fakeRes(), {
        messages: [{ role: 'user', content: 'س' }],
        traceId: 'tr_throw1', flagState: 'mode_public',
        dailyBudgetMode: 'fixture',
        // No `search` — the engine calls opts.search() and throws, which is the case being traced.
        search: null,
        plannerOverride: { issues: 'not-an-array' },
        fetchImpl: () => { throw new Error('should not be reached'); },
      });
    } finally { console.log = origLog; threwTimeline = timeline; timeline = []; }
    ok('an engine that throws, or refuses, still leaves a trace',
      spy2.writes.length === 1, 'writes=' + spy2.writes.length);
    eq('...and it is COUNTED on stdout as well, before its close',
      threwTimeline, ['stdout:counts', 'socket:end']);

    // ── THE SEAM'S catch, DRIVEN RATHER THAN ASSUMED ──────────────────────────
    //
    // The drive above does NOT reach it. Measured, not guessed: a malformed planner override makes
    // the engine REFUSE and return normally, and even a `search` that throws is caught inside the
    // engine and billed as a spent Brave call. Its assertion has always said "throws, OR refuses"
    // for that reason. So the third exit needs a fault the engine cannot absorb: an override whose
    // very first property read throws. Offline, deterministic, no network and no key.
    const spy3 = recordingRedis();
    STORE.__setRedisForTest(spy3);
    let catchTimeline;
    patch();
    let threwOut;
    try {
      threwOut = await SEAM.runLedgerTurn(fakeRes(), {
        messages: [{ role: 'user', content: 'س' }],
        traceId: 'tr_throw2', flagState: 'mode_public', dailyBudgetMode: 'fixture',
        plannerOverride: new Proxy({}, { get() { throw new Error('forced engine throw'); } }),
      });
    } finally { console.log = origLog; catchTimeline = timeline; timeline = []; }
    ok('the seam\'s catch was REALLY entered, so this exit is exercised and not merely described',
      threwOut.threw === true, JSON.stringify({ threw: threwOut.threw, outcome: threwOut.outcome }));
    eq('...and that exit is COUNTED on stdout too, before its close',
      catchTimeline, ['stdout:counts', 'socket:end']);
    ok('...with a null trace and zero spend, because nothing was ever called',
      counts[2] && counts[2].trace === null && counts[2].model === 0
        && counts[2].brave === 0 && counts[2].fetch === 0, JSON.stringify(counts[2]));
    eq('every exit logs exactly one counts line — three here, one in section F', counts.length, 3);
    STORE.__resetRedis();
  }

  // =========================================================================
  console.log('\n=== H. DORMANT WHILE RFC_V05_MODE=off ===');
  {
    const FLAG = await esm('lib/ledger/flag.js');
    const had = Object.prototype.hasOwnProperty.call(process.env, 'RFC_V05_MODE');
    const prev = process.env.RFC_V05_MODE;
    try {
      process.env.RFC_V05_MODE = 'off';
      const d = await FLAG.decidePath({ headers: {} });
      ok('with the mode off the request never reaches the ledger path',
        d.path === 'legacy' && d.reason === 'mode_off', JSON.stringify(d));
    } finally {
      if (had) process.env.RFC_V05_MODE = prev; else delete process.env.RFC_V05_MODE;
    }
    ok('...and the engine — the only thing that builds a record — is imported lazily, inside that '
      + 'branch, so nothing telemetry touches loads on the legacy path',
      /await import\('\.\.\/lib\/ledger\/seam\.js'\)/.test(read('api/ask.js')));
    // IMPORTS, not mentions. The first version of this check counted the string 'telemetry.js'
    // anywhere in the file and was tripped by a COMMENT explaining the wiring — a gate that
    // punishes documenting the thing it guards is a gate that will get the comment deleted.
    ok('...and telemetry.js is reached only through the engine and the seam, never imported by a handler',
      !/import[\s\S]{0,80}telemetry\.js/.test(read('api/ask.js')));
  }

  // =========================================================================
  // =========================================================================
  // THE COLLISION THE OPENING EXPOSED. The record is keyed `lg:t:<trace_id>`, and the trace id was
  // a module-level counter — so it restarted at zero in every serverless instance and EVERY
  // instance's first request was `tr_000001`. That was survivable while only internal testers
  // wrote; at full volume each instance's first request silently overwrites every other's, and the
  // group test counts keys rather than requests. An overwrite looks exactly like a request that
  // never arrived, which is why this needs a gate and not a comment.
  console.log('\n=== I. TRACE IDS ARE UNIQUE ACROSS INSTANCES, NOT JUST WITHIN ONE ===');
  {
    // Two module instances, which is what two cold serverless starts are.
    const A = await esm('lib/ledger/schema.js');
    const B = await esm('lib/ledger/schema.js?instance=2');
    const a = [A.newTraceId(), A.newTraceId(), A.newTraceId()];
    const b = [B.newTraceId(), B.newTraceId(), B.newTraceId()];
    ok('two fresh instances do not produce the same first id',
      a[0] !== b[0], 'A=' + a[0] + ' B=' + b[0]);
    ok('...nor the same sequence at all',
      a.every((x) => !b.includes(x)), 'A=' + JSON.stringify(a) + ' B=' + JSON.stringify(b));
    ok('ids are still unique WITHIN an instance', new Set(a).size === a.length);

    // The id is the key, so it must survive record()'s validator and store.key() untouched.
    for (const id of a) {
      ok('the generated id passes record()\'s own validator: ' + id,
        /^[A-Za-z0-9_-]{3,48}$/.test(id));
    }
    const fake = recordingRedis();
    STORE.__setRedisForTest(fake);
    await T.record({ trace_id: a[0], outcome: 'FULL' });
    eq('...and reaches the store as its own key', fake.writes[0].key, 'lg:t:' + a[0]);
    STORE.__resetRedis();

    // STILL NOT A CLOCK AND STILL NOT A HASH. The original contract on this id is that it carries
    // nothing about the reader or the question; entropy must not have quietly become a timestamp.
    const src = read('lib/ledger/schema.js').split('export function newTraceId')[1].split('\n}')[0];
    ok('newTraceId derives nothing from the question or a hash',
      !/hash|sha|question/i.test(src), src.slice(0, 160));
    ok('...and is not a clock', !/Date\.now|getTime|new Date/.test(src), src.slice(0, 160));

    // The seeded form is what fixtures and guards pin, and it must stay byte-stable.
    eq('a seeded id is still fully deterministic', A.newTraceId(42), 'tr_000042');
    eq('...and identical across instances', B.newTraceId(42), A.newTraceId(42));
  }

  // =========================================================================
  console.log('\n=== I. WIRING ===');
  {
    ok('gates.json lists this guard', /ledger-telemetry-guard\.cjs/.test(read('gates.json')));
    ok('the engine imports telemetry', /from '\.\/telemetry\.js'/.test(read('lib/ledger/engine.js')));
    ok('the seam imports telemetry', /from '\.\/telemetry\.js'/.test(read('lib/ledger/seam.js')));
    // The engine may BUILD but must never WRITE — that is what keeps the store off the answer path.
    ok('the engine never calls record() — building is pure, writing is the seam\'s job',
      !/telemetry\.record\(|\brecord\(rec/.test(read('lib/ledger/engine.js')));
    // THE REMOVED THREADING, ASSERTED GONE FROM EVERY LAYER. Leaving a dead `internalTester` opt
    // in the handler would read, to the next person, as a gate that still governs something.
    // CODE, not mentions — `internalTester:` as a property or `.internalTester` as a read. Matching
    // the bare word would fail on the COMMENTS that explain the removal, which is the same trap
    // that caught the earlier «telemetry.js is never imported by a handler» check: a gate that
    // punishes documenting the thing it guards is a gate that gets the documentation deleted.
    ok('no layer still threads an internal-tester decision through to telemetry',
      !/internalTester\s*[:.]/.test(read('api/ask.js'))
      && !/internalTester\s*[:.]/.test(read('lib/ledger/seam.js'))
      && !/\breturn\s*\{\s*written:\s*false,\s*reason:\s*'not-internal'/.test(read('lib/ledger/telemetry.js')));
    ok('...and the rollout arm, from decidePath\'s own reason code rather than a second derivation',
      /flagState: ledgerPath\.reason/.test(read('api/ask.js')));

    // ── THE COUNTS LINE IS NOT IN THE HANDLER ANY MORE ────────────────────────
    //
    // A SOURCE CHECK, deliberately, and the one place one is the right instrument: the defect was
    // not that the line misbehaved but that it was in a file where everything after the await runs
    // after res.end(). Driving api/ask.js is not possible offline — it needs a key, a limiter, a
    // day cap and a live socket — so the position is pinned by absence instead. If it comes back,
    // this fails, and section F's timeline would not notice because the seam's own line still
    // prints on time.
    ok('the counts line is GONE from api/ask.js, where everything after the await runs post-res.end()',
      !/console\.log\(\s*'\[ledger\]'/.test(read('api/ask.js')));
    ok('...and the handler no longer reaches into the return value for a budget snapshot either',
      !/out\.budget\.snapshot\(\)/.test(read('api/ask.js')));
    ok('...it is the seam that prints it now', /console\.log\(\s*'\[ledger\]'/.test(read('lib/ledger/seam.js')));
    // ONE STATEMENT, THREE CALL SITES. Two copies of this line drifting apart is how the failing
    // exits end up reporting a different shape from the successful one.
    ok('...from exactly one console.log, through one helper called at each exit',
      (read('lib/ledger/seam.js').match(/console\.log\(\s*'\[ledger\]'/g) || []).length === 1
      && (read('lib/ledger/seam.js').match(/\blogCounts\(/g) || []).length === 4);
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ledger-telemetry-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
