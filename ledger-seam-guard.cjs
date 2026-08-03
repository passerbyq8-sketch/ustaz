// ledger-seam-guard.cjs — the SEAM: what actually reaches the engine from a real request, what
// the client actually receives back, and the deadline that covers both.
//
// WHY THIS GATE EXISTS, AND WHY THE OTHER FIVE DID NOT COVER IT.
// ledger-fixtures-guard.cjs calls runEngine() directly. That proves the engine; it proves
// nothing about the thing api/ask.js does around it. Three separate defects lived in exactly
// that gap and were invisible to five green gates:
//
//   * the engine's question was taken from `plan.attribution.question` — a field of the LEGACY
//     attribution classifier, the same classifier the previous report itself measured
//     mis-reading the verb «ذهب». The value happened to be identical today, which is precisely
//     what makes it dangerous: a coupling with no test is a coupling nobody will notice
//     changing.
//   * the extraction cache was read with `adapterVersion: undefined`, so the specified
//     invalidation rule was neither exercised nor exercisable.
//   * `decidePath()` ran BEFORE any clock started, so a slow Upstash read was unbounded and sat
//     outside the 25-second budget it was supposed to be inside.
//
// SO THIS GATE DRIVES THE SEAM ITSELF — the same function api/ask.js calls, with req/res
// doubles — rather than matching a regex against the handler's source. A regex proves a branch
// was typed. It cannot prove what the branch does.
//
// Offline and deterministic: provider, pages, DNS, model and clock are all doubles.
//
// Usage: node ledger-seam-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

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
// Source with comments removed, so a rule about what the CODE does is checked against code and
// not against the comment that documents the rule.
//
// NOTE THE `[^\r\n]*` AND THE ABSENT `$`. api/ask.js is CRLF-pinned in .gitattributes, so every
// line here still ends with \r. `.` does not match \r, and `$` without the m flag asserts the
// end of the STRING — so `//.*$` matched nothing at all on a CRLF file and every comment
// survived. That is exactly how this helper's first version reported a comment as live code.
const code = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/[^\r\n]*/, '$1')).join('\n');

// ── a response double that records the wire exactly ─────────────────────────
function fakeRes() {
  return {
    statusCode: 0, headers: {}, chunks: [], ended: 0, endedAfterWrite: false,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    flushHeaders() {},
    write(s) { if (this.ended) this.endedAfterWrite = true; this.chunks.push(String(s)); return true; },
    end() { this.ended++; },
    get body() { return this.chunks.join(''); },
    frames() {
      return this.body.split('\n\n').filter((b) => b.includes('data:')).map((b) => {
        let d = '';
        for (const line of b.split('\n')) { const l = line.trim(); if (l.startsWith('data:')) d += l.slice(5).trim(); }
        try { return JSON.parse(d); } catch { return null; }
      }).filter(Boolean);
    },
  };
}

const user = (t) => [{ role: 'user', content: t }];

(async function main() {
  console.log('=== ledger-seam-guard — the real seam, the real wire, and the real deadline ===');

  // The seam module is the thing under test. Its ABSENCE is a failure, not a crash.
  let SEAM = null;
  try { SEAM = await esm('lib/ledger/seam.js'); } catch (e) { SEAM = null; }
  if (!ok('lib/ledger/seam.js exists — the handler and this gate must share one code path',
    !!SEAM, 'the handler builds the engine call inline, so nothing can test it')) {
    console.log('\nFAILED: ' + failures + ' of ' + checks + ' checks failed.');
    process.exit(1);
  }

  const BG = await esm('lib/ledger/budgets.js');
  const SP = await esm('lib/ledger/source-policy.js');
  const SF = await esm('lib/ledger/safe-fetch.js');
  const CH = await esm('lib/ledger/cache.js');
  const STORE = await esm('lib/ledger/redis.js');
  const FL = await esm('lib/ledger/flag.js');
  const DC = await esm('lib/daycap.js');
  const EN = await esm('lib/ledger/engine.js');
  const ask = read('api/ask.js');
  const askCode = code('api/ask.js');

  // =========================================================================
  console.log('\n=== A. THE QUESTION THAT REACHES THE ENGINE IS THE READER\'S OWN ===');
  //
  // The engine must be given the reader's words, validated for TYPE and LENGTH and normalised
  // safely — and nothing else. Not a field of the attribution classifier, not a topic with a
  // presumed name cut out of it, not a re-framed paraphrase.
  // The LEDGER BRANCH ONLY. `plan` is still used by the legacy routes below and must be — this
  // change is not allowed to touch them — so an assertion scanning the whole handler would be
  // asserting something false about the shipped path rather than something true about the new
  // one. The branch body is sliced out by brace-matching from its own `if`.
  const ledgerBranch = (() => {
    const start = askCode.indexOf("if (ledgerPath.path === 'ledger') {");
    if (start === -1) return '';
    let depth = 0;
    for (let i = askCode.indexOf('{', start); i < askCode.length; i++) {
      if (askCode[i] === '{') depth++;
      else if (askCode[i] === '}') { depth--; if (depth === 0) return askCode.slice(start, i + 1); }
    }
    return '';
  })();
  ok('the ledger branch was located for inspection', ledgerBranch.length > 100, String(ledgerBranch.length));
  ok('api/ask.js does NOT take the engine\'s question from the legacy attribution plan',
    !/plan\./.test(ledgerBranch),
    'the legacy classifier still feeds the new path:\n        '
      + (ledgerBranch.match(/.*plan\..*/g) || []).join('\n        '));
  ok('...and passes the raw messages instead',
    /messages:\s*body\.messages/.test(ledgerBranch), ledgerBranch.slice(0, 200));
  ok('...while the LEGACY routes still use the plan, untouched',
    /plan\.attributionMode/.test(askCode) && /plan\.hasDirectAdapter/.test(askCode));
  ok('the handler delegates to the shared seam rather than building the call inline',
    /runLedgerTurn/.test(askCode));

  {
    const R = SEAM.rawQuestion;
    // The three questions from the brief, byte-for-byte.
    for (const q of ['ذهب إلى المسجد فهل يصح؟', 'ما حكم بيع الذهب بالتقسيط؟',
      'ما رأي ابن باز في الجمع بين الصلاتين؟']) {
      const r = R(user(q));
      eq('«' + q + '» arrives verbatim', r.question, q);
      eq('...and is accepted', r.ok, true);
    }
    // Content blocks.
    eq('an array of text blocks is joined',
      R([{ role: 'user', content: [{ type: 'text', text: 'ما حكم' }, { type: 'text', text: 'الجمع؟' }] }]).question,
      'ما حكم الجمع؟');
    ok('a non-text block is ignored, not stringified',
      R([{ role: 'user', content: [{ type: 'image', source: {} }, { type: 'text', text: 'سؤال' }] }]).question === 'سؤال');
    // The LAST user turn, not an earlier one.
    eq('only the last user turn is read',
      R([{ role: 'user', content: 'قديم' }, { role: 'assistant', content: 'x' }, { role: 'user', content: 'جديد' }]).question,
      'جديد');
    // Refusals.
    for (const [label, msgs] of [
      ['no messages', []], ['not an array', null],
      ['no user turn', [{ role: 'assistant', content: 'x' }]],
      ['empty text', user('   ')],
      ['a non-string content', [{ role: 'user', content: 42 }]],
    ]) {
      eq('refuses: ' + label, R(msgs).ok, false);
    }
    // Neutral normalisation only.
    eq('whitespace runs collapse', R(user('ما   حكم\t\tالجمع؟')).question, 'ما حكم الجمع؟');
    eq('surrounding whitespace is trimmed', R(user('  سؤال  ')).question, 'سؤال');
    ok('C0 control characters are removed', !/[ -]/.test(R(user('سؤال ما')).question));
    ok('Arabic is never altered by normalisation',
      R(user('أإآىةؤئ الذهب')).question === 'أإآىةؤئ الذهب',
      R(user('أإآىةؤئ الذهب')).question);
    ok('diacritics survive', R(user('فَوَيْلٌ لِلْمُصَلِّينَ')).question === 'فَوَيْلٌ لِلْمُصَلِّينَ');
    {
      const long = 'ط'.repeat(SEAM.MAX_QUESTION_CHARS + 500);
      const r = R(user(long));
      ok('an over-long question is capped, not refused', r.ok && r.question.length === SEAM.MAX_QUESTION_CHARS,
        String(r.question.length));
      eq('...and says so', r.truncated, true);
    }
    // THE POINT OF THE WHOLE SECTION: no name is ever cut out.
    const verb = R(user('ذهب إلى المسجد فهل يصح؟')).question;
    ok('the verb «ذهب» question keeps every word', verb.includes('ذهب') && verb.includes('المسجد') && verb.includes('يصح'), verb);
    const named = R(user('ما رأي ابن باز في الجمع بين الصلاتين؟')).question;
    ok('a named-scholar question keeps the name', named.includes('ابن باز'), named);
    ok('...and keeps the framing the legacy planner would strip', named.includes('ما رأي'), named);
  }

  // =========================================================================
  console.log('\n=== B. THE SEAM, DRIVEN END TO END WITH req/res DOUBLES ===');

  process.env.ANTHROPIC_API_KEY = 'stub-for-gate';
  const savedEnv = { LEDGER_RAG: process.env.LEDGER_RAG, FOUNDER_SECRET: process.env.FOUNDER_SECRET, LEDGER_CACHE_SECRET: process.env.LEDGER_CACHE_SECRET };
  process.env.FOUNDER_SECRET = 'seam-secret';
  delete process.env.LEDGER_CACHE_SECRET;
  SF.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }]);

  const DEVICE = 'seamdevice123456';
  const internalReq = { headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': DC.founderTokenFor(DEVICE) } };
  const anonReq = { headers: {} };

  const LONG = ' وهذا مبسوط في كتب أهل العلم مع بيان الأدلة والتفصيل الوافي في المسألة.'.repeat(6);
  const PAGES = {
    'https://islamqa.info/ar/answers/9001/x':
      '<html><head><title>ص</title></head><body><article><p>السؤال: ما حكم بيع الذهب بالتقسيط؟</p>'
      + '<p>الجواب: الحمد لله. بيع الذهب بالتقسيط لا يجوز لعدم التقابض.' + LONG + '</p></article></body></html>',
  };
  const RESULTS = [{ url: 'https://islamqa.info/ar/answers/9001/x', title: 'بيع الذهب بالتقسيط', snippet: '' }];

  // The planner double reads the question it was ACTUALLY given, so a mutilated question shows
  // up as a wrong plan rather than as a silently different search.
  const seen = { questions: [], modelCalls: 0, engineCalls: 0 };
  function modelReply(body) {
    const u = body.messages[0].content;
    seen.modelCalls++;
    if (u.includes('صِفْه بهذا الشكلِ حرفيًّا')) {
      const q = u.split('\n')[1];
      seen.questions.push(q);
      const authority = /ابن باز/.test(q) ? 'ibn-baz' : null;
      return { content: [{ type: 'text', text: JSON.stringify({
        issues: [{
          issue_id: 'iss_1', intent: authority ? 'scholar_opinion' : 'fatwa',
          requested_authority_id: authority,
          protected_entities: ['بيع الذهب'], core_terms: ['التقسيط'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
        }],
        missing_qualifiers: [], confidence: 'high',
      }) }], usage: { output_tokens: 50 } };
    }
    if (u.includes('استخرِجِ الادّعاءاتِ الذرّيّة')) {
      const m = u.match(/\[([^\]\s]+#u\d+s\d+)\]\s*([^\n]*)/);
      if (!m) return { content: [{ type: 'text', text: '{"claims":[]}' }], usage: {} };
      return { content: [{ type: 'text', text: JSON.stringify({ claims: [{
        claim_id: 'c1', text: m[2].slice(0, 100), slot: 'ruling', span_ids: [m[1]],
        components: [
          { component_id: 'k1', kind: 'subject', text: 'بيع الذهب بالتقسيط', span_ids: [m[1]] },
          { component_id: 'k2', kind: 'ruling', text: m[2].slice(0, 60), span_ids: [m[1]] },
        ],
      }] }) }], usage: {} };
    }
    if (u.includes('تحقَّقْ من كلِّ ادّعاءٍ')) {
      const ids = Array.from(u.matchAll(/### ادّعاء (\S+)/g)).map((x) => x[1]);
      return { content: [{ type: 'text', text: JSON.stringify({ verdicts: ids.map((id) => ({ claim_id: id, verdict: 'PASS', unsupported_components: [] })) }) }], usage: {} };
    }
    if (u.includes('اكتبِ الجوابَ جملةً جملة')) {
      const ids = Array.from(u.matchAll(/^- \((\S+)\)/gm)).map((x) => x[1]);
      return { content: [{ type: 'text', text: JSON.stringify({ sentences: ids.map((id, i) => ({ sentence_id: 's' + (i + 1), text: 'جملة موثقة.', claim_ids: [id] })) }) }], usage: {} };
    }
    if (u.includes('افحصْ كلَّ جملةٍ على حِدَة')) {
      const ids = Array.from(u.matchAll(/### جملة (\S+)/g)).map((x) => x[1]);
      return { content: [{ type: 'text', text: JSON.stringify({ verdicts: ids.map((id) => ({ sentence_id: id, verdict: 'PASS', added: [] })) }) }], usage: {} };
    }
    throw new Error('unexpected prompt');
  }
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.includes('api.anthropic.com')) {
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => modelReply(JSON.parse(init.body)) };
    }
    const body = PAGES[u];
    if (body === undefined) return { ok: false, status: 404, headers: { get: () => 'text/html' }, body: null, text: async () => '' };
    return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) }, body: null, text: async () => body };
  };
  const search = async () => RESULTS.slice();
  // The REAL card builder from api/ask.js, so the wire grammar under test is the shipped one.
  const askMod = await esm('api/ask.js');

  const runSeam = async (question, over = {}) => {
    const res = fakeRes();
    seen.questions = []; seen.modelCalls = 0;
    let t = 0;
    const out = await SEAM.runLedgerTurn(res, Object.assign({
      messages: user(question),
      band: 'adult',
      bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      search, fetchImpl,
      now: () => (t += 5),
      startedAt: 0,
    }, over));
    return { res, out };
  };

  {
    // 1. The verb «ذهب» reaches the engine whole and is NOT read as an attribution.
    const { out } = await runSeam('ذهب إلى المسجد فهل يصح؟');
    eq('the verb question reaches the planner verbatim', seen.questions[0], 'ذهب إلى المسجد فهل يصح؟');
    eq('...and produces NO requested authority', out.ledger.issues[0].requestedAuthorityId, null);
    ok('...and is not intent scholar_opinion', out.ledger.issues[0].intent !== 'scholar_opinion',
      out.ledger.issues[0].intent);
  }
  {
    const { out } = await runSeam('ما حكم بيع الذهب بالتقسيط؟');
    eq('the gold question reaches the planner verbatim', seen.questions[0], 'ما حكم بيع الذهب بالتقسيط؟');
    eq('...routed as fatwa', out.ledger.issues[0].intent, 'fatwa');
    eq('...with no authority', out.ledger.issues[0].requestedAuthorityId, null);
  }
  {
    const { out } = await runSeam('ما رأي ابن باز في الجمع بين الصلاتين؟');
    eq('the Ibn Baz question reaches the planner verbatim', seen.questions[0], 'ما رأي ابن باز في الجمع بين الصلاتين؟');
    eq('...routed as scholar_opinion', out.ledger.issues[0].intent, 'scholar_opinion');
    eq('...for the REGISTERED owner id', out.ledger.issues[0].requestedAuthorityId, 'ibn-baz');
    eq('...which the policy knows', SP.authorityIdForScholarName('ابن باز'), 'ibn-baz');
  }

  // =========================================================================
  console.log('\n=== C. THE SSE CONTRACT THE LIVE CLIENT PARSES ===');
  {
    const { res, out } = await runSeam('ما حكم بيع الذهب بالتقسيط؟');
    const frames = res.frames();
    ok('the stream produced frames', frames.length >= 2, String(frames.length));
    ok('every frame before the last is a text delta',
      frames.slice(0, -1).every((f) => f.type === 'content_block_delta' && f.delta && f.delta.type === 'text_delta'),
      JSON.stringify(frames.map((f) => f.type)));
    eq('the LAST frame is message_stop', frames[frames.length - 1].type, 'message_stop');
    eq('message_stop appears exactly once', frames.filter((f) => f.type === 'message_stop').length, 1);
    eq('the stream is ended exactly once', res.ended, 1);
    eq('nothing is written after end()', res.endedAfterWrite, false);
    // The card grammar is the client's, and it is produced by the shipped builder.
    const text = frames.filter((f) => f.delta).map((f) => f.delta.text).join('');
    ok('a source card is present and well-formed',
      /<source site="[^"]+" url="https:\/\/[^"]+">[^<]*<\/source>/.test(text), text.slice(-200));
    ok('the card is the LAST thing in the reply', /<\/source>\s*$/.test(text.trim()));
    // NO INTERNAL IDENTIFIER EVER REACHES THE READER.
    for (const bad of [out.ledger.traceId, 'claim', 'span', 'gate1', 'gate2', 'gate3', 'iss_1', 'answer_unit']) {
      ok('the reader never sees «' + bad + '»', !text.includes(bad), text.slice(0, 160));
    }
    ok('...nor a rejection reason code', !/no_sufficient_direct_evidence|_adapter|budget_exhausted/.test(text));
  }
  {
    // A SAFE REFUSAL IS STILL A WELL-FORMED STREAM, and still ends once.
    const { res, out } = await runSeam('ما حكم بيع الذهب بالتقسيط؟', { search: async () => [] });
    eq('a refusal still ends the stream once', res.ended, 1);
    eq('...with a message_stop', res.frames().filter((f) => f.type === 'message_stop').length, 1);
    eq('...and the outcome is a safe rejection', out.outcome, 'SAFE_REJECTION');
    const text = res.frames().filter((f) => f.delta).map((f) => f.delta.text).join('');
    ok('...carrying no card', !/<source/.test(text));
    ok('...and no ruling', !/يجوز|لا يجوز|حرام|حلال/.test(text), text);
  }
  {
    // AN ENGINE THAT THROWS MUST NOT FALL THROUGH INTO THE LEGACY PATH MID-REQUEST, and must
    // not write after the stream is closed.
    const { res, out } = await runSeam('ما حكم بيع الذهب بالتقسيط؟', {
      search: async () => { throw new Error('provider exploded'); },
      fetchImpl: async (u, init) => {
        if (String(u).includes('api.anthropic.com')) throw new Error('model exploded');
        throw new Error('page exploded');
      },
    });
    eq('an exploding engine still ends the stream once', res.ended, 1);
    eq('...exactly one message_stop', res.frames().filter((f) => f.type === 'message_stop').length, 1);
    eq('...nothing written after end()', res.endedAfterWrite, false);
    eq('...and it reports a refusal rather than deferring to legacy', out.outcome, 'SAFE_REJECTION');
    ok('...and never signals the caller to run the legacy path', out.fellBackToLegacy !== true);
  }

  // =========================================================================
  console.log('\n=== D. ONE ARRANGEMENT ENTERS THE LEDGER; EVERY OTHER RUNS LEGACY ===');
  {
    const redis = { down: false, slow: 0, _m: new Map(),
      async get(k) { if (this.down) throw new Error('ECONNREFUSED'); if (this.slow) await new Promise((r) => setTimeout(r, this.slow)); return this._m.has(k) ? this._m.get(k) : null; },
      async set(k, v) { if (this.down) throw new Error('x'); this._m.set(k, v); return 'OK'; } };
    STORE.__setRedisForTest(redis);
    let clock = 0;
    const decide = async (env, req, flagValue) => {
      process.env.LEDGER_RAG = env;
      redis._m.clear();
      if (flagValue !== null) redis._m.set(FL.RUNTIME_KEY, flagValue);
      FL.__resetFlagCacheForTest();
      clock += 100000;
      return (await FL.decidePath(req, clock)).path;
    };
    eq('env off + internal + flag on => legacy', await decide('off', internalReq, true), 'legacy');
    eq('env on + anonymous + flag on => legacy', await decide('on', anonReq, true), 'legacy');
    eq('env on + internal + flag absent => legacy', await decide('on', internalReq, null), 'legacy');
    eq('env on + internal + flag off => legacy', await decide('on', internalReq, false), 'legacy');
    eq('ONLY env on + internal + flag on => ledger', await decide('on', internalReq, true), 'ledger');
    // THE ENV FLOOR ALONE CANNOT BE OVERRIDDEN BY REDIS, and Redis alone cannot open the floor.
    eq('Redis cannot open a closed env floor', await decide('off', internalReq, true), 'legacy');

    redis.down = true;
    FL.__resetFlagCacheForTest();
    process.env.LEDGER_RAG = 'on';
    clock += 100000;
    eq('an ERRORING store reads as legacy', (await FL.decidePath(internalReq, clock)).path, 'legacy');
    redis.down = false;

    // A SLOW STORE MUST NOT HANG THE REQUEST. The read is bounded and fails closed.
    redis.slow = 5000;
    redis._m.set(FL.RUNTIME_KEY, true);
    FL.__resetFlagCacheForTest();
    clock += 100000;
    const t0 = Date.now();
    const slowPath = (await FL.decidePath(internalReq, clock)).path;
    const elapsed = Date.now() - t0;
    eq('a SLOW store reads as legacy', slowPath, 'legacy');
    ok('...and the read is bounded well under a second', elapsed < 2000, elapsed + 'ms');
    ok('...by a declared timeout constant', typeof FL.FLAG_READ_TIMEOUT_MS === 'number' && FL.FLAG_READ_TIMEOUT_MS <= 1500,
      String(FL.FLAG_READ_TIMEOUT_MS));
    redis.slow = 0;

    // A LEGACY REQUEST PAYS NOTHING. With the env floor closed, decidePath must not touch the
    // store at all — not a read, not a connection, not a timer. This is the case that runs for
    // every real user today, so its cost is the one that actually matters.
    let reads = 0;
    STORE.__setRedisForTest({ async get(k) { reads++; return null; }, async set() { return 'OK'; } });
    process.env.LEDGER_RAG = 'off';
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('with the env floor closed the decision is legacy', (await FL.decidePath(internalReq, clock)).path, 'legacy');
    eq('...and the store was never read', reads, 0);
    // An anonymous request with the floor OPEN must also not read the store: an unauthenticated
    // caller cannot be allowed to make us do work, and must not learn the flag's state either.
    process.env.LEDGER_RAG = 'on';
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('an anonymous caller decides legacy', (await FL.decidePath(anonReq, clock)).path, 'legacy');
    eq('...without reading the store', reads, 0);
    STORE.__resetRedis();
  }
  ok('the handler calls decidePath BEFORE any engine import',
    askCode.indexOf('decidePath(') < askCode.indexOf("import('../lib/ledger/seam.js')")
    || askCode.indexOf('decidePath(') < askCode.indexOf('runLedgerTurn'));
  ok('the engine and the seam are imported LAZILY, inside the branch',
    /await import\('\.\.\/lib\/ledger\/seam\.js'\)/.test(askCode));
  ok('...so a legacy request loads neither linkedom nor Readability through this branch',
    !/^import .*ledger\/(engine|page|seam)\.js/m.test(askCode));

  // =========================================================================
  console.log('\n=== E. THE DEADLINE COVERS THE SWITCH, NOT ONLY THE ENGINE ===');
  {
    // The budget starts when the REQUEST decided to try the ledger, not when runEngine begins.
    // A fake clock proves the exit is bounded without waiting 25 real seconds.
    let t = 0;
    const b = new BG.Budget({ now: () => t, startedAt: 0 });
    eq('a budget can be told when the request really started', b.startedAt, 0);
    t = 24000;
    ok('at 24s there is still time', b.remainingMs() > 0);
    t = 25001;
    ok('past the global timeout nothing is affordable', b.deadlineReached() && !b.canAfford('braveCalls'));
  }
  {
    // NO MODEL CALL IS STARTED WITH LESS THAN 2s LEFT. Starting one guarantees a timeout that
    // costs the request its whole remaining budget and returns nothing.
    ok('a minimum-time-for-a-model-call constant exists',
      typeof BG.MIN_MS_FOR_MODEL_CALL === 'number' && BG.MIN_MS_FOR_MODEL_CALL >= 2000,
      String(BG.MIN_MS_FOR_MODEL_CALL));
    let t = 0;
    const b = new BG.Budget({ now: () => t, startedAt: 0 });
    ok('with the full budget a model call is affordable', b.canAffordModelCall(100));
    t = BG.GLOBAL_TIMEOUT_MS - 1500;                 // 1.5s left
    ok('with 1.5s left it is NOT', !b.canAffordModelCall(100), String(b.remainingMs()));
    ok('...though the call COUNT still allows it', b.canAfford('modelCalls'));
  }
  {
    // A never-resolving dependency must not hold the request: the engine exits on its deadline.
    let t = 0;
    const never = () => new Promise(() => {});
    const res = fakeRes();
    const out = await SEAM.runLedgerTurn(res, {
      messages: user('ما حكم بيع الذهب بالتقسيط؟'),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      // The clock jumps past the deadline on its second reading, so the scheduler refuses.
      now: () => { t += 20000; return t; },
      startedAt: 0,
      search: never,
      fetchImpl: never,
    });
    eq('a hung dependency still ends the stream once', res.ended, 1);
    eq('...and produces a safe refusal', out.outcome, 'SAFE_REJECTION');
    ok('...having spent no model call past the deadline', out.budget.snapshot().spent.modelCalls <= 1,
      String(out.budget.snapshot().spent.modelCalls));
    ok('...and recorded the exhaustion honestly',
      out.ledger.rejections.some((r) => /budget|deadline|model_call_failed/.test(r.code + r.detail)),
      JSON.stringify(out.ledger.rejections));
  }
  ok('the engine accepts an externally-started budget so the switch is inside the deadline',
    /opts\.budget|startedAt/.test(code('lib/ledger/engine.js')));

  // =========================================================================
  console.log('\n=== F. EXTRACTION CACHE INVALIDATES ON adapter_version ===');
  {
    process.env.LEDGER_CACHE_SECRET = 'seam-cache-secret';
    const redis = { _m: new Map(), async get(k) { return this._m.has(k) ? this._m.get(k) : null; }, async set(k, v) { this._m.set(k, v); return 'OK'; } };
    STORE.__setRedisForTest(redis);
    const U = 'https://islamqa.info/ar/answers/9001/x';
    const payload = { authorialText: 'نص الجواب', title: 't', kind: 'answer', dates: {} };

    ok('put(v1) writes', await CH.putExtraction(U, payload, { adapterVersion: 'readability@r1' }));
    eq('get(v1) HITS', (await CH.getExtraction(U, { adapterVersion: 'readability@r1' })).hit, true);
    eq('get(v2) MISSES', (await CH.getExtraction(U, { adapterVersion: 'readability@r2' })).hit, false);
    eq('get(unknown) MISSES', (await CH.getExtraction(U, { adapterVersion: undefined })).hit, false);
    eq('get(no opts) MISSES', (await CH.getExtraction(U)).hit, false);
    // AND THE KEY ITSELF DIFFERS, so a stale value is not merely rejected on read — it is not
    // even addressed.
    ok('the v1 and v2 keys are different addresses',
      CH.extractionKey(U, { adapterVersion: 'readability@r1' })
      !== CH.extractionKey(U, { adapterVersion: 'readability@r2' }));

    // THE ENGINE MUST PASS THE REAL VERSION. Proven by behaviour, not by reading the source:
    // prime the cache under the version the policy declares, then run and require a HIT.
    const expected = SP.expectedAdapterVersion(U);
    ok('the policy can state the expected adapter version for a URL', !!expected, String(expected));
    await CH.putExtraction(U, {
      authorialText: 'السؤال: ما حكم بيع الذهب بالتقسيط؟\n\nالجواب: لا يجوز لعدم التقابض.' + LONG,
      title: 'مخبأ', kind: 'answer', dates: {},
    }, { adapterVersion: expected });

    let fetched = 0;
    const countingFetch = async (u, init) => {
      if (String(u).includes('api.anthropic.com')) return fetchImpl(u, init);
      fetched++;
      return fetchImpl(u, init);
    };
    const { out } = await runSeam('ما حكم بيع الذهب بالتقسيط؟', { fetchImpl: countingFetch });
    ok('the engine HIT the cache primed under the policy\'s version', out.cacheHits >= 1,
      'cacheHits=' + out.cacheHits + ' pageFetches=' + fetched);
    eq('...so the page was never fetched', fetched, 0);
    ok('...and the cached title proves it came from the cache',
      Array.from(out.ledger.sources.values()).some((s) => s.title === 'مخبأ'),
      JSON.stringify(Array.from(out.ledger.sources.values()).map((s) => s.title)));

    // Bump the version: the same request must now MISS and fetch.
    redis._m.clear();
    await CH.putExtraction(U, { authorialText: 'قديم', title: 'قديم', kind: 'answer', dates: {} },
      { adapterVersion: 'stale@v0' });
    fetched = 0;
    const r2 = await runSeam('ما حكم بيع الذهب بالتقسيط؟', { fetchImpl: countingFetch });
    ok('a cache entry written under another adapter version is NOT used', fetched >= 1, 'fetched=' + fetched);
    ok('...and the stale title never reaches the ledger',
      !Array.from(r2.out.ledger.sources.values()).some((s) => s.title === 'قديم'));

    ok('the engine never passes an undefined adapter version',
      !/getExtraction\([^)]*adapterVersion:\s*undefined/.test(code('lib/ledger/engine.js')));
    STORE.__resetRedis();
    delete process.env.LEDGER_CACHE_SECRET;
  }

  // =========================================================================
  console.log('\n=== G. A DIRECT ADAPTER READ IS A FETCH AND IS BUDGETED ===');
  {
    const DIRECT = 'https://binothaimeen.net/content/';
    const many = (n) => Array.from({ length: n }, (_, i) => ({
      canonicalUrl: DIRECT + (1000 + i),
      title: 'فتوى ' + i,
      scholar: 'محمد بن صالح العثيمين',
      exactText: 'إذا أسقطت المرأة قبل ثمانين يوما فليس دمها دم نفاس فتصلي وتصوم.' + LONG,
    }));
    let asked = 0;
    const reader = async () => { asked++; return many(9); };
    let t = 0;
    const res = fakeRes();
    const out = await SEAM.runLedgerTurn(res, {
      messages: user('ما رأي الشيخ ابن عثيمين فيمن أسقطت قبل ثمانين يومًا؟'),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      now: () => (t += 5), startedAt: 0,
      search: async () => [], fetchImpl,
      directReader: reader,
      // A planner double that asks for HIS opinion, one issue.
      plannerOverride: {
        issues: [{
          issue_id: 'iss_1', intent: 'scholar_opinion', requested_authority_id: 'ibn-uthaymeen',
          protected_entities: ['أسقطت'], core_terms: ['ثمانين يوما'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
        }],
        missing_qualifiers: [], confidence: 'high',
      },
    });
    const snap = out.budget.snapshot();
    eq('a direct corpus read costs NO provider call', snap.spent.braveCalls, 0);
    ok('...but every document read IS charged as a fetch', snap.spent.pagesFetched >= 1,
      String(snap.spent.pagesFetched));
    ok('...and never exceeds MAX_PAGES_FETCHED', snap.spent.pagesFetched <= BG.MAX_PAGES_FETCHED,
      snap.spent.pagesFetched + ' > ' + BG.MAX_PAGES_FETCHED);
    eq('...with no budget breach', snap.breaches.length, 0);
    ok('...so a nine-document corpus is truncated at the ceiling, not consumed whole',
      out.ledger.sources.size <= BG.MAX_PAGES_FETCHED, String(out.ledger.sources.size));
  }

  SF.__resetResolver();
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ledger-seam-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
