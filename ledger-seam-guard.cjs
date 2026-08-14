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
  const { MAX_ACCEPTED_RECORDS: DIRECT_MAX_RECORDS } = await esm('lib/ledger/direct-corpus.js');
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
    const start = askCode.indexOf("if (ledgerPath.path === 'ledger' && storedContext.runtime === 'HADITH') {");
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
  const savedEnv = { LEDGER_RAG: process.env.LEDGER_RAG, FOUNDER_SECRET: process.env.FOUNDER_SECRET, LEDGER_CACHE_SECRET: process.env.LEDGER_CACHE_SECRET,
    MODEL_STANDARD: process.env.MODEL_STANDARD, MODEL_PREMIUM: process.env.MODEL_PREMIUM, MODEL: process.env.MODEL };
  process.env.FOUNDER_SECRET = 'seam-secret';
  process.env.MODEL_STANDARD = 'seam-standard';
  process.env.MODEL_PREMIUM = 'seam-premium';
  process.env.MODEL = 'seam-legacy';
  delete process.env.LEDGER_CACHE_SECRET;
  SF.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }]);

  const DEVICE = 'seamdevice123456';
  const internalReq = { headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': DC.founderTokenFor(DEVICE) } };
  const anonReq = { headers: {} };

  const LONG = ' وهذا مبسوط في كتب أهل العلم مع بيان الأدلة والتفصيل الوافي في المسألة.'.repeat(6);
  const HANDLER_SEAM_Q = 'ما صحة حديث المسلم من سلم المسلمون من لسانه ويده؟';
  const PAGES = {
    'https://islamqa.info/ar/answers/9001/x':
      '<html><head><title>ص</title></head><body><article><p>السؤال: ما حكم بيع الذهب بالتقسيط؟</p>'
      + '<p>الجواب: الحمد لله. بيع الذهب بالتقسيط لا يجوز لعدم التقابض.' + LONG + '</p></article></body></html>',
    'https://islamqa.info/ar/answers/9002/hadith':
      '<html><head><title>حديث المسلم من سلم المسلمون من لسانه ويده</title></head><body><article><p>السؤال: '
      + HANDLER_SEAM_Q + '</p><p>الجواب: حديث المسلم من سلم المسلمون من لسانه ويده حديث صحيح.'
      + LONG + '</p></article></body></html>',
  };
  const RESULTS = [{ url: 'https://islamqa.info/ar/answers/9001/x', title: 'بيع الذهب بالتقسيط', snippet: '' }];
  const HANDLER_RESULTS = [{ url: 'https://islamqa.info/ar/answers/9002/hadith', title: 'حديث المسلم من سلم المسلمون من لسانه ويده', snippet: '' }];

  // The planner double reads the question it was ACTUALLY given, so a mutilated question shows
  // up as a wrong plan rather than as a silently different search.
  const seen = { questions: [], modelCalls: 0, engineCalls: 0 };
  let a1SentenceText = null;
  let a1EvidenceText = null;
  let forceSafeRejectionPlan = false;
  const SAFE_Q = '\u0645\u0627 \u0631\u0623\u064a \u0627\u0628\u0646 \u0628\u0627\u0632 \u0641\u064a \u0627\u0644\u062c\u0645\u0639 \u0628\u064a\u0646 \u0627\u0644\u0635\u0644\u0627\u062a\u064a\u0646\u061f';
  const SAFE_QUALIFIER = '\u0647\u0644 \u0627\u0644\u062d\u0643\u0645 \u0648\u0627\u062c\u0628\u061f';
  const SAFE_PLAN = {
    issues: [{
      issue_id: 'iss_1', intent: 'scholar_opinion', requested_authority_id: 'ibn-baz',
      protected_entities: ['traveller'], core_terms: ['prayer shortening'], context_vars: [],
      exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
    }],
    missing_qualifiers: [SAFE_QUALIFIER], confidence: 'high',
  };
  function modelReply(body) {
    const u = body.messages[0].content;
    seen.modelCalls++;
    // RE-PINNED ON THE STRONGER KEY, ASSERTION KEPT. This stub used to recognise the planner call by
    // one sentence of its prose. Batch 5 step 7 rewrote that prose -- the printed template was itself
    // an INVALID plan, so every live request died at PLAN_INVALID after one model call and never
    // searched -- and the stub stopped recognising the call it exists to answer. `"issue_id"` is the
    // field the planner asks for and no other prompt in the engine mentions, so it identifies the
    // call by what the call IS rather than by how it happens to be worded.
    if (u.includes('"issue_id"')) {
      const q = u.split('\n')[1];
      seen.questions.push(q);
      if (forceSafeRejectionPlan) {
        return { content: [{ type: 'text', text: JSON.stringify(SAFE_PLAN) }], usage: { output_tokens: 50 } };
      }
      if (/المسلمون|لسانه|يده/.test(q)) {
        return { content: [{ type: 'text', text: JSON.stringify({
          issues: [{
            issue_id: 'iss_1', intent: 'hadith_grading', requested_authority_id: null,
            protected_entities: ['المسلمون'], core_terms: ['لسانه', 'يده'], context_vars: [],
            exact_user_phrases: ['المسلم من سلم المسلمون من لسانه ويده'], required_slots: ['hadith_grading'], dependencies: [], temporal_scope: 'unknown',
          }],
          missing_qualifiers: [], confidence: 'high',
        }) }], usage: { output_tokens: 50 } };
      }
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
      const matches = Array.from(u.matchAll(/\[([^\]\s]+#u\d+s\d+)\]\s*([^\n]*)/g));
      const handlerHadith = u.includes(HANDLER_SEAM_Q);
      const m = handlerHadith
        ? (matches.find((item) => item[2].includes('الجواب:')) || matches[0])
        : matches[0];
      if (!m) return { content: [{ type: 'text', text: '{"claims":[]}' }], usage: {} };
      return { content: [{ type: 'text', text: JSON.stringify({ claims: [{
        claim_id: 'c1', text: m[2].slice(0, 100), slot: handlerHadith ? 'hadith_grading' : 'ruling', span_ids: [m[1]],
        components: [
          { component_id: 'k1', kind: 'subject', text: handlerHadith ? 'حديث المسلم من سلم المسلمون من لسانه ويده' : 'بيع الذهب بالتقسيط', span_ids: [m[1]] },
          { component_id: 'k2', kind: 'ruling', text: handlerHadith ? 'حديث صحيح' : m[2].slice(0, 60), span_ids: [m[1]] },
        ],
      }] }) }], usage: {} };
    }
    if (u.includes('تحقَّقْ من كلِّ ادّعاءٍ')) {
      const ids = Array.from(u.matchAll(/### ادّعاء (\S+)/g)).map((x) => x[1]);
      return { content: [{ type: 'text', text: JSON.stringify({ verdicts: ids.map((id) => ({ claim_id: id, verdict: 'PASS', unsupported_components: [] })) }) }], usage: {} };
    }
    if (u.includes('اكتبِ الجوابَ جملةً جملة')) {
      const ids = Array.from(u.matchAll(/^- \((\S+)\)/gm)).map((x) => x[1]);
      return { content: [{ type: 'text', text: JSON.stringify({ sentences: ids.map((id, i) => ({ sentence_id: 's' + (i + 1), text: a1SentenceText || '\u062c\u0645\u0644\u0629 \u0645\u0648\u062b\u0642\u0629.', claim_ids: [id] })) }) }], usage: {} };
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
    const body = PAGES[u.split('?')[0]];
    if (body === undefined) return { ok: false, status: 404, headers: { get: () => 'text/html' }, body: null, text: async () => '' };
    const pageBody = a1EvidenceText ? body.replace('</article>', '<p>' + a1EvidenceText + '</p></article>') : body;
    return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) }, body: null, text: async () => pageBody };
  };
  const search = async () => RESULTS.map((result) => a1EvidenceText ? { ...result, url: result.url + '?a1=green' } : { ...result });
  // The REAL card builder from api/ask.js, so the wire grammar under test is the shipped one.
  const askMod = await esm('api/ask.js');
  const A1FINAL = await esm('lib/finalize-reader-text.js');
  const A1SSE = await esm('lib/finalized-sse-writer.js');

  const runSeam = async (question, over = {}) => {
    const target = fakeRes();
    target.preFinalizerWrites = 0;
    target.preFinalizerEnds = 0;
    const rawWrite = target.write.bind(target);
    const rawEnd = target.end.bind(target);
    target.write = (...args) => {
      const raw = String(args[0] == null ? '' : args[0]);
      if (raw.trim() && !raw.trimStart().startsWith(':') && !target[A1SSE.FINALIZATION_COMPLETE]) {
        target.preFinalizerWrites++;
      }
      return rawWrite(...args);
    };
    target.end = (...args) => {
      if (!target[A1SSE.FINALIZATION_COMPLETE]) target.preFinalizerEnds++;
      return rawEnd(...args);
    };
    const ownedCards = [];
    const registeredSources = [];
    const buildOwnedCard = (input) => {
      const card = askMod.buildSourceTag(input);
      if (card) ownedCards.push(card);
      return card;
    };
    const res = over.finalized ? A1SSE.createFinalizedSseResponse(target, {
      context: () => ({ sources: registeredSources, sourceCards: ownedCards }),
      finalize: (input) => { target.finalizerInput = input; return A1FINAL.finalizeReaderText(input); },
    }) : target;
    seen.questions = []; seen.modelCalls = 0;
    let t = 0;
    const out = await SEAM.runLedgerTurn(res, Object.assign({
      dailyBudgetMode: 'fixture',
      messages: user(question),
      band: 'adult',
      bandSites: SP.searchableDomains(),
      buildSourceTag: buildOwnedCard,
      registerFinalizerSources: (pages) => registeredSources.push(...pages),
      search, fetchImpl, adapterFetchImpl: fetchImpl,
      now: () => (t += 5),
      startedAt: 0,
    }, over));
    return { res: target, out, ownedCards, registeredSources };
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
    const unsafe = '\u062c\u0648\u0627\u0628 \u0622\u0645\u0646. \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.';
    a1SentenceText = unsafe;
    const negative = await runSeam('\u0645\u0627 \u062d\u0643\u0645 \u0628\u064a\u0639 \u0627\u0644\u0630\u0647\u0628 \u0628\u0627\u0644\u062a\u0642\u0633\u064a\u0637\u061f', { finalized: true });
    const negativeFrames = negative.res.frames();
    const negativeText = negativeFrames.filter((frame) => frame.delta).map((frame) => frame.delta.text).join('');
    ok('F-010 Ledger negative uses runLedgerTurn behind the finalized response', negative.out.outcome === 'FULL' && negativeText.startsWith('\u062c\u0648\u0627\u0628 \u0622\u0645\u0646.') && !negative.res.body.includes('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a'), negativeText);
    ok('F-010 Ledger negative registers real card-backing evidence before finalization', negative.registeredSources.length === 1 && negative.res.finalizerInput && negative.res.finalizerInput.sources === negative.registeredSources && negative.res.preFinalizerWrites === 0 && negative.res.preFinalizerEnds === 0);
    ok('F-010 Ledger negative has one terminal message_stop', negativeFrames.filter((frame) => frame.type === 'message_stop').length === 1 && negativeFrames.at(-1).type === 'message_stop');

    const supported = unsafe;
    a1SentenceText = supported;
    a1EvidenceText = supported;
    const green = await runSeam('\u0645\u0627 \u062d\u0643\u0645 \u0628\u064a\u0639 \u0627\u0644\u0630\u0647\u0628 \u0628\u0627\u0644\u062a\u0642\u0633\u064a\u0637\u061f', { finalized: true });
    const greenFrames = green.res.frames();
    const greenText = greenFrames.filter((frame) => frame.delta).map((frame) => frame.delta.text).join('');
    const expectedCardSuffix = green.ownedCards.map((card) => card.tag).join('\n');
    ok('F-010 Ledger green preserves supported text and owned cards byte-for-byte in order', greenText === supported + '\n' + expectedCardSuffix, JSON.stringify({ greenText, input: green.res.finalizerInput }));
    ok('F-010 Ledger green context comes only from the seam callback before target.end', green.registeredSources.length === 1 && green.registeredSources[0].passage.includes(supported) && green.res.preFinalizerWrites === 0 && green.res.preFinalizerEnds === 0);
    ok('F-010 Ledger green has one terminal message_stop', greenFrames.filter((frame) => frame.type === 'message_stop').length === 1 && greenFrames.at(-1).type === 'message_stop');
    a1SentenceText = null;
    a1EvidenceText = null;
  }
  {
    // The actual /api/ask handler takes the Ledger path. All provider/store dependencies are
    // local doubles; the finalizer context can only be populated by runLedgerTurn's callback.
    const handlerEnv = Object.fromEntries(['LEDGER_RAG', 'RFC_V05_MODE', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET']
      .map((key) => [key, process.env[key]]));
    process.env.LEDGER_RAG = 'true';
    process.env.RFC_V05_MODE = 'public';
    process.env.ANTHROPIC_API_KEY = 'a1-ledger-handler';
    process.env.BRAVE_API_KEY = 'a1-ledger-handler';
    process.env.FOUNDER_SECRET = 'a1-ledger-handler-secret';
    const storeClient = {
      async get() { return null; }, async set() { return 'OK'; }, async setex() { return 'OK'; },
      async eval() { return [1, 1]; }, async incr() { return 1; }, async expire() { return 1; },
    };
    STORE.__setRedisForTest(storeClient);
    FL.__resetFlagCacheForTest();
    const capCounts = new Map();
    DC.__setRedisForTest({
      async sismember() { return 0; },
      async mget(...keys) { return keys.map((key) => capCounts.get(key) || null); },
      pipeline() { const ops = []; return {
        incr(key) { ops.push(() => { const n = (Number(capCounts.get(key)) || 0) + 1; capCounts.set(key, n); return n; }); },
        expire() { ops.push(() => 1); }, async exec() { return ops.map((op) => op()); },
      }; },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      if (u.includes('api.anthropic.com')) {
        const payload = modelReply(JSON.parse(init.body || '{}'));
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload, text: async () => JSON.stringify(payload) };
      }
      if (u.includes('api.search.brave.com')) {
        const fixtures = /المسلمون|لسانه|يده/.test(decodeURIComponent(u)) ? HANDLER_RESULTS : RESULTS;
        const results = fixtures.map((result) => a1EvidenceText ? { ...result, url: result.url + '?a1=handler-green' } : { ...result });
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ web: { results: results.map((result) => ({ ...result, description: result.snippet })) } }) };
      }
      return fetchImpl(u, init);
    };
    const device = 'a1ledgerhandler01';
    const founder = DC.founderTokenFor(device);
    const handlerRequest = () => ({
      method: 'POST',
      headers: { 'x-murabbi-device': device, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' },
      body: { band: 'adult', age: 30, messages: user(HANDLER_SEAM_Q) },
    });
    const handlerResponse = () => {
      const target = fakeRes();
      target.headersSent = false;
      target.preFinalizerWrites = 0;
      target.preFinalizerEnds = 0;
      target.json = function json(value) { this.jsonBody = value; this.ended++; return this; };
      const rawWrite = target.write.bind(target);
      const rawEnd = target.end.bind(target);
      target.write = function write(...args) {
        const raw = String(args[0] == null ? '' : args[0]);
        if (raw.trim() && !raw.trimStart().startsWith(':') && !this[A1SSE.FINALIZATION_COMPLETE]) {
          this.preFinalizerWrites++;
        }
        return rawWrite(...args);
      };
      target.end = function end(...args) { if (!this[A1SSE.FINALIZATION_COMPLETE]) this.preFinalizerEnds++; return rawEnd(...args); };
      return target;
    };
    try {
      const unsafe = '\u062c\u0648\u0627\u0628 \u0622\u0645\u0646. \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.';
      a1SentenceText = unsafe; a1EvidenceText = null;
      const negativeRes = handlerResponse();
      await askMod.default(handlerRequest(), negativeRes);
      const negativeText = negativeRes.frames().filter((frame) => frame.delta).map((frame) => frame.delta.text).join('');
      const negativeContext = negativeRes[A1SSE.FINALIZATION_CONTEXT];
      ok('F-010 handler Ledger negative removes only unsupported takhrij', negativeText.startsWith('\u062c\u0648\u0627\u0628 \u0622\u0645\u0646.') && !negativeRes.body.includes('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a'));
      ok('F-010 handler Ledger negative receives seam evidence before target.end', negativeContext && negativeContext.sources.length === 1 && negativeRes.preFinalizerWrites === 0 && negativeRes.preFinalizerEnds === 0);

      a1SentenceText = unsafe; a1EvidenceText = unsafe;
      const greenRes = handlerResponse();
      await askMod.default(handlerRequest(), greenRes);
      const greenFrames = greenRes.frames();
      const greenText = greenFrames.filter((frame) => frame.delta).map((frame) => frame.delta.text).join('');
      const greenContext = greenRes[A1SSE.FINALIZATION_CONTEXT];
      const card = askMod.buildSourceTag({
        url: HANDLER_RESULTS[0].url + '?a1=handler-green', title: HANDLER_RESULTS[0].title,
      }).tag;
      const partialNote = 'وجدنا مواد تتناول المسألة، لكن لم يثبت منها ما يكفي لإسناد هذا الجزء إسنادًا صريحًا.';
      const expectedHadithGreen = unsafe + '\n\n' + partialNote + '\n' + card;
      ok('F-010 handler Ledger green preserves evidence-backed text, typed partial note and card byte-for-byte',
        greenText === expectedHadithGreen,
        JSON.stringify({ expected: expectedHadithGreen, actual: greenText }));
      ok('F-010 handler Ledger green callback fills context before first end', greenContext && greenContext.sources.length === 1 && greenContext.sources[0].passage.includes(unsafe) && greenRes.preFinalizerWrites === 0 && greenRes.preFinalizerEnds === 0 && greenFrames.filter((frame) => frame.type === 'message_stop').length === 1);

      const trusted = await runSeam(SAFE_Q, {
        plannerOverride: SAFE_PLAN,
        search: async () => { throw new Error('safe rejection must not search'); },
      });
      ok('a missing qualifier is telemetry, never a reader follow-up',
        trusted.out.outcome === 'SAFE_REJECTION'
          && !trusted.out.text.includes(SAFE_QUALIFIER)
          && !/NEEDS_QUALIFIER|وضح سؤالك|حدد المقصود/u.test(trusted.out.text));

      const runTrustedHandler = async (depth) => {
        forceSafeRejectionPlan = true;
        seen.modelCalls = 0;
        const target = handlerResponse();
        const req = handlerRequest();
        req.body = { band: 'adult', age: 30, depth, messages: user(HANDLER_SEAM_Q) };
        let tier = null;
        const originalLog = console.log;
        console.log = (label, value, ...rest) => {
          if (label === '[tier]' && value && typeof value === 'object') tier = { ...value };
          originalLog(label, value, ...rest);
        };
        try { await askMod.default(req, target); } finally { console.log = originalLog; }
        const frames = target.frames();
        return {
          target, frames, calls: seen.modelCalls, tier,
          text: frames.filter((frame) => frame.delta).map((frame) => frame.delta.text).join(''),
          context: target[A1SSE.FINALIZATION_CONTEXT],
        };
      };
      const detailed = await runTrustedHandler('deep');
      const student = await runTrustedHandler('scholar');
      for (const [label, run] of [['Detailed', detailed], ['Student', student]]) {
        eq(label + ' server-owned no-evidence text survives byte-exact', run.text, trusted.out.text);
        ok(label + ' no-evidence response is typed as a non-answer only by the server outcome',
          run.context && run.context.kind === 'safe_rejection');
        ok(label + ' trusted follow-up closes once with one stop and no fabricated card',
          run.target.ended === 1 && run.frames.filter((frame) => frame.type === 'message_stop').length === 1
            && !run.text.includes('<source'));
        eq(label + ' reaches no final reader-answer call (only the auxiliary planner)', run.calls, 1);
        ok(label + ' keeps server-authorized Premium routing',
          run.tier && run.tier.founderUnlocked === true && run.tier.usePremium === true
            && run.tier.model === 'seam-premium');
      }

      seen.modelCalls = 0;
      const deniedRes = handlerResponse();
      const deniedReq = handlerRequest();
      delete deniedReq.headers['x-murabbi-founder'];
      deniedReq.body = {
        band: 'adult', age: 30, depth: 'scholar', tier: 'premium', premium: true, student: true,
        outcome: 'SAFE_REJECTION', kind: 'safe_rejection', messages: user(SAFE_Q),
      };
      let deniedTier = null;
      const originalLog = console.log;
      console.log = (label, value, ...rest) => {
        if (label === '[tier]' && value && typeof value === 'object') deniedTier = { ...value };
        originalLog(label, value, ...rest);
      };
      try { await askMod.default(deniedReq, deniedRes); } finally { console.log = originalLog; }
      ok('unauthorized forged scholar fields keep Standard routing',
        deniedTier && deniedTier.founderUnlocked === false && deniedTier.usePremium === false
          && deniedTier.model === 'seam-standard');

      for (const malformed of [undefined, null, '', 'safe_rejection', 'PARTIAL', 'FULL',
        ' SAFE_REJECTION ', {}, [], 1, true]) {
        eq('unknown/malformed outcome remains an answer', askMod.ledgerFinalizerKind(malformed), 'answer');
      }
      eq('only exact SAFE_REJECTION maps to non-answer',
        askMod.ledgerFinalizerKind('SAFE_REJECTION'), 'safe_rejection');

      const unsourced = A1FINAL.finalizeReaderText({
        kind: askMod.ledgerFinalizerKind('PARTIAL'),
        text: '\u0647\u0630\u0627 \u0648\u0627\u062c\u0628.',
        fallbackText: A1FINAL.FINALIZER_REFUSAL,
        consistencyContext: { pageTexts: [] },
      });
      ok('PARTIAL unsourced ruling remains an answer and is blocked by the finalizer',
        !unsourced.ok && unsourced.text === A1FINAL.FINALIZER_REFUSAL
          && unsourced.problems.includes('RULING_WITHOUT_SOURCE'));
      const documented = '\u0647\u0630\u0627 \u0648\u0627\u062c\u0628.';
      const full = A1FINAL.finalizeReaderText({
        kind: askMod.ledgerFinalizerKind('FULL'), text: documented,
        consistencyContext: { pageTexts: [documented] },
      });
      ok('FULL documented answer still traverses and passes the finalizer',
        full.ok && full.text === documented);

      forceSafeRejectionPlan = false;
      a1SentenceText = unsafe; a1EvidenceText = null;
      const forgedRes = handlerResponse();
      const forgedReq = handlerRequest();
      Object.assign(forgedReq.body, {
        outcome: 'SAFE_REJECTION', ledgerOutcome: 'SAFE_REJECTION', kind: 'safe_rejection',
      });
      await askMod.default(forgedReq, forgedRes);
      const forgedContext = forgedRes[A1SSE.FINALIZATION_CONTEXT];
      ok('forged client outcome cannot obtain the non-answer path',
        forgedContext && forgedContext.kind === 'answer');
    } finally {
      globalThis.fetch = originalFetch;
      a1SentenceText = null; a1EvidenceText = null; forceSafeRejectionPlan = false;
      for (const [key, value] of Object.entries(handlerEnv)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      FL.__resetFlagCacheForTest();
    }
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
  console.log('\n=== C2. THE KEEPALIVE COVERS THE SILENCE IT EXISTS TO COVER ===');
  //
  // api/ask.js opens an SSE keepalive because the answer path is byte-silent for tens of seconds
  // and mobile carriers reset an idle socket at about thirty. The ledger path is silent for the
  // same reason and for as long — up to its full 25-second budget. The first version of this seam
  // had the handler stop the keepalive BEFORE calling it, removing the protection for exactly the
  // interval it exists to cover.
  {
    // A real interval and a real (short) delay, so the ordering being tested is the ordering that
    // actually happens rather than one a fake timer was told to produce.
    const res = fakeRes();
    let ticks = 0;
    const timer = setInterval(() => { ticks++; res.write(': keepalive\n\n'); }, 10);
    const clearKeepAlive = () => clearInterval(timer);
    let t = 0;
    const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
      messages: user('ما حكم بيع الذهب بالتقسيط؟'),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      now: () => (t += 5), startedAt: 0,
      fetchImpl,
      // A search that takes a while, standing in for the engine's real byte-silent phase.
      search: async () => { await new Promise((r) => setTimeout(r, 120)); return RESULTS.slice(); },
      beforeFirstOutput: clearKeepAlive,
    });
    clearInterval(timer);
    ok('keepalive frames were emitted DURING the engine\'s silent phase', ticks >= 3, 'ticks=' + ticks);

    const body = res.body;
    const firstContent = body.indexOf('content_block_delta');
    const lastKeepalive = body.lastIndexOf(': keepalive');
    ok('...and every one of them precedes the first content event',
      lastKeepalive !== -1 && lastKeepalive < firstContent,
      'lastKeepalive=' + lastKeepalive + ' firstContent=' + firstContent);
    const stopAt = body.indexOf('message_stop');
    ok('...none after message_stop', lastKeepalive < stopAt);
    eq('...the stream ends exactly once', res.ended, 1);
    eq('...and nothing is written after end()', res.endedAfterWrite, false);
    eq('...the outcome is a real answer', out.outcome, 'FULL');

    // THE EXACT CLOSING ORDER the client parses.
    const frames = res.frames();
    const kinds = frames.map((f) => f.type);
    eq('the last two events are a text delta then message_stop',
      kinds.slice(-2), ['content_block_delta', 'message_stop']);
    const text = frames.filter((f) => f.delta).map((f) => f.delta.text).join('');
    ok('the source card is the tail of the answer text', /<\/source>\s*$/.test(text.trim()));
  }
  {
    // A SAFE REJECTION KEEPS THE SAME LIFECYCLE, including stopping the keepalive.
    const res = fakeRes();
    let ticks = 0;
    const timer = setInterval(() => { ticks++; res.write(': keepalive\n\n'); }, 10);
    let t = 0;
    const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
      messages: user('ما حكم بيع الذهب بالتقسيط؟'),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      now: () => (t += 5), startedAt: 0, fetchImpl,
      search: async () => { await new Promise((r) => setTimeout(r, 60)); return []; },
      beforeFirstOutput: () => clearInterval(timer),
    });
    clearInterval(timer);
    eq('a refusal is still a safe rejection', out.outcome, 'SAFE_REJECTION');
    ok('...with keepalive during the wait', ticks >= 2, 'ticks=' + ticks);
    ok('...and none after the first content event',
      res.body.lastIndexOf(': keepalive') < res.body.indexOf('content_block_delta'));
    eq('...ended exactly once', res.ended, 1);
  }
  {
    // A hook that throws must not cost the reader the answer.
    const res = fakeRes();
    let t = 0;
    const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
      messages: user('ما حكم بيع الذهب بالتقسيط؟'),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      now: () => (t += 5), startedAt: 0, search, fetchImpl,
      beforeFirstOutput: () => { throw new Error('hook exploded'); },
    });
    eq('a throwing beforeFirstOutput hook does not lose the answer', out.outcome, 'FULL');
    eq('...and the stream still ends once', res.ended, 1);
  }
  ok('the handler passes clearKeepAlive as the hook rather than calling it early',
    /beforeFirstOutput: clearKeepAlive/.test(askCode));
  ok('...and no longer clears it before the engine runs',
    (() => {
      const b = (askCode.match(/if \(ledgerPath\.path === 'ledger'\)[\s\S]*?\n    \}/) || [''])[0];
      const bare = b.indexOf('clearKeepAlive();');
      return bare === -1;
    })(), 'clearKeepAlive() is still called directly inside the branch');
  ok('the legacy routes still clear it themselves, unchanged',
    (askCode.match(/clearKeepAlive\(\);/g) || []).length >= 5);

  // =========================================================================
  console.log('\n=== D. THE PUBLIC PATH, AND THE BRAKES THAT SURVIVED IT ===');
  {
    const redis = { down: false, slow: 0, _m: new Map(),
      async get(k) { if (this.down) throw new Error('ECONNREFUSED'); if (this.slow) await new Promise((r) => setTimeout(r, this.slow)); return this._m.has(k) ? this._m.get(k) : null; },
      async set(k, v) { if (this.down) throw new Error('x'); this._m.set(k, v); return 'OK'; } };
    STORE.__setRedisForTest(redis);
    let clock = 0;
    // THE MODE IS WRITTEN IN EVERY CASE. Since the public go-live an UNSET RFC_V05_MODE reads as
    // 'public', so a case that left it alone would be testing the public arm while claiming to
    // test another — which is exactly how this section started failing when the default flipped.
    const decide = async (env, mode, req, flagValue) => {
      // A ceiling is present in all of these: they are about the floor, the mode, the credential
      // and the kill switch. The ceiling's own behaviour is asserted in ledger-runtime-guard.
      process.env.DAILY_SEARCH_BUDGET = '500';
      process.env.LEDGER_RAG = env;
      process.env.RFC_V05_MODE = mode;
      redis._m.clear();
      if (flagValue !== null) redis._m.set(FL.RUNTIME_KEY, flagValue);
      FL.__resetFlagCacheForTest();
      clock += 100000;
      return (await FL.decidePath(req, clock)).path;
    };
    // The go-live: a reader with no credential at all takes the engine.
    eq('PUBLIC + anonymous => ledger', await decide('on', 'public', anonReq, null), 'ledger');
    eq('PUBLIC + internal => ledger', await decide('on', 'public', internalReq, null), 'ledger');
    // ...and every brake still stops it.
    eq('the env floor closed beats a public mode', await decide('off', 'public', internalReq, true), 'legacy');
    eq('...and beats a public anonymous read too', await decide('off', 'public', anonReq, true), 'legacy');
    eq('mode off beats an open floor', await decide('on', 'off', internalReq, true), 'legacy');
    eq('mode internal still refuses a stranger', await decide('on', 'internal', anonReq, true), 'legacy');
    eq('mode internal still admits a tester', await decide('on', 'internal', internalReq, true), 'ledger');
    eq('a stored «off» is the kill switch, and it stops the public path',
      await decide('on', 'public', anonReq, false), 'legacy');
    // THE ENV FLOOR ALONE CANNOT BE OVERRIDDEN BY REDIS, and Redis alone cannot open the floor.
    eq('Redis cannot open a closed env floor', await decide('off', 'public', internalReq, true), 'legacy');

    // A STORE THAT CANNOT BE READ NO LONGER TAKES THE PATH DOWN, and the inversion is deliberate.
    // The store used to have to AFFIRM the flag, so failing to read it meant legacy. Since the
    // go-live the environment affirms and the store only ever brakes — so an outage in the
    // braking component must not cut every reader off. `LEDGER_RAG=off` is the brake that needs
    // no store at all, and it is asserted above.
    process.env.LEDGER_RAG = 'on';
    process.env.RFC_V05_MODE = 'public';
    redis.down = true;
    FL.__resetFlagCacheForTest();
    clock += 100000;
    eq('an ERRORING store leaves the environment in charge', (await FL.decidePath(internalReq, clock)).path, 'ledger');
    redis.down = false;

    // A SLOW STORE MUST NOT HANG THE REQUEST. The read is still bounded — that property is
    // untouched by the go-live and is the reason the timeout constant exists.
    redis.slow = 5000;
    redis._m.set(FL.RUNTIME_KEY, true);
    FL.__resetFlagCacheForTest();
    clock += 100000;
    const t0 = Date.now();
    const slowPath = (await FL.decidePath(internalReq, clock)).path;
    const elapsed = Date.now() - t0;
    eq('a SLOW store does not stop the path either', slowPath, 'ledger');
    ok('...and the read is STILL bounded well under a second', elapsed < 2000, elapsed + 'ms');
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
    // An anonymous request with the floor OPEN now takes the public path, and it reads the store
    // EXACTLY ONCE — the kill-switch check — rather than not at all. That one bounded read is the
    // price of keeping an instant stop button after the go-live, and it is cached for FLAG_TTL_MS,
    // so a warm instance does not pay it per request.
    process.env.LEDGER_RAG = 'on';
    process.env.RFC_V05_MODE = 'public';
    FL.__resetFlagCacheForTest();
    reads = 0;
    clock += 100000;
    eq('an anonymous caller now decides ledger', (await FL.decidePath(anonReq, clock)).path, 'ledger');
    eq('...having read the store once, for the kill switch only', reads, 1);
    eq('...and a second decision inside the TTL reads nothing more',
      (await FL.decidePath(anonReq, clock + 1)).path && reads, 1);
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
      dailyBudgetMode: 'fixture',
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
  console.log('\n=== G. THE DIRECT ADAPTER\'S REAL I/O IS RESERVED BEFORE IT HAPPENS ===');
  //
  // MEASURED in lib/binothaimeen.js: retrieveIbnUthaymeen is NOT one request returning a set. It
  // makes up to MAX_SEARCHES (6) search POSTs plus up to MAX_FETCHES (3) lesson GETs — nine
  // logical calls, each with one retry — through the single choke point httpJson(). So counting
  // the DOCUMENTS IT RETURNED proves nothing: nine round-trips can return one document, and a
  // tally taken after the reader returns cannot stop a request the reader already made.
  const DIRECT_ISSUE = {
    issues: [{
      issue_id: 'iss_1', intent: 'scholar_opinion', requested_authority_id: 'ibn-uthaymeen',
      protected_entities: ['أسقطت'], core_terms: ['ثمانين يوما'], context_vars: [],
      exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
    }],
    missing_qualifiers: [], confidence: 'high',
  };
  const DIRECT_Q = 'ما رأي الشيخ ابن عثيمين فيمن أسقطت قبل ثمانين يومًا؟';
  const doc = (i) => ({
    canonicalUrl: 'https://binothaimeen.net/content/' + (1000 + i),
    title: 'فتوى ' + i, scholar: 'محمد بن صالح العثيمين',
    exactText: 'إذا أسقطت المرأة قبل ثمانين يوما فليس دمها دم نفاس فتصلي وتصوم.' + LONG,
  });
  const runDirect = async (reader, over = {}) => {
    const res = fakeRes();
    let t = 0;
    const out = await SEAM.runLedgerTurn(res, Object.assign({
      dailyBudgetMode: 'fixture',
      messages: user(DIRECT_Q),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      now: () => (t += 5), startedAt: 0,
      search: async () => [], fetchImpl,
      directReader: reader,
      plannerOverride: DIRECT_ISSUE,
    }, over));
    return { res, out, snap: out.budget.snapshot() };
  };

  {
    // 1. A PER-REQUEST reader. `networkCalls` is incremented when a request STARTS, and each
    //    start must be permitted by the gate first. The sixth must never begin.
    let started = 0;
    let refused = 0;
    const reader = async (q, issue, io) => {
      const out = [];
      for (let i = 0; i < 9; i++) {
        if (!io.allow()) { refused++; break; }      // the gate, consulted BEFORE the request
        started++;                                   // the request "starts" here
        out.push(doc(i));
      }
      return out;
    };
    const { out, snap } = await runDirect(reader);
    eq('a direct read costs NO provider call', snap.spent.braveCalls, 0);
    ok('requests actually started', started >= 1, String(started));
    eq('...and never more than MAX_PAGES_FETCHED', started, BG.MAX_PAGES_FETCHED);
    ok('...the sixth was refused BEFORE it started', refused >= 1, 'refused=' + refused);
    eq('...every started request was charged', snap.spent.pagesFetched, started);
    eq('...with no budget breach', snap.breaches.length, 0);
    ok('...and the records admitted for extraction are separately capped',
      out.ledger.sources.size <= DIRECT_MAX_RECORDS,
      out.ledger.sources.size + ' > ' + DIRECT_MAX_RECORDS);
  }
  {
    // 2. ONE request returning twenty records. The network cost is one; the ACCEPTED records are
    //    bounded separately, because twenty segmented documents would blow the token budget.
    let requests = 0;
    const reader = async (q, issue, io) => {
      if (!io.allow()) return [];
      requests++;
      return Array.from({ length: 20 }, (_, i) => doc(i));
    };
    const { out, snap } = await runDirect(reader);
    eq('one bulk response costs exactly one network call', requests, 1);
    eq('...charged once', snap.spent.pagesFetched, 1);
    ok('...and the accepted records are capped',
      out.ledger.sources.size <= DIRECT_MAX_RECORDS,
      'accepted=' + out.ledger.sources.size);
    ok('...far below the twenty offered', out.ledger.sources.size < 20);
  }
  {
    // 3. A reader that NEVER settles. The engine must exit on its deadline, not wait it out.
    //    The fake clock jumps past the budget so the test finishes immediately.
    const res = fakeRes();
    const started = Date.now();
    // A REAL but tiny deadline. The reader never settles, so the only thing that can end this is
    // the deadline itself — and it must do so in tens of milliseconds, not twenty-five seconds.
    const budget = new BG.Budget({ timeoutMs: 60 });
    const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
      messages: user(DIRECT_Q),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      startedAt: 0,
      search: async () => [], fetchImpl,
      directReader: () => new Promise(() => {}),
      plannerOverride: DIRECT_ISSUE,
      budget,
    });
    const elapsed = Date.now() - started;
    eq('a never-resolving reader still produces a safe rejection', out.outcome, 'SAFE_REJECTION');
    ok('...within a bounded wall-clock time', elapsed < 5000, elapsed + 'ms');
    eq('...ending the stream exactly once', res.ended, 1);
    ok('...and it never fell back to a general search',
      out.budget.snapshot().spent.braveCalls === 0);
    ok('...recording the timeout honestly',
      out.ledger.rejections.some((r) => /timeout|budget|deadline/.test(r.code + r.detail)),
      JSON.stringify(out.ledger.rejections));
  }
  {
    // 4. A reader that THROWS. No Brave fallback, no general source, no attributed claim.
    const { out, snap } = await runDirect(async () => { throw new Error('adapter exploded'); });
    eq('a throwing adapter produces a safe rejection', out.outcome, 'SAFE_REJECTION');
    eq('...with ZERO provider calls', snap.spent.braveCalls, 0);
    eq('...and no source at all', out.ledger.sources.size, 0);
    eq('...and no verified claim', out.ledger.verifiedClaims().length, 0);
    ok('...and nothing attributed to him', !/ابن عثيمين/.test(out.text), out.text);
  }
  {
    // 5. The budget is SHARED. Pages already spent by an earlier issue leave the direct read
    //    only the remainder, and it stops there.
    let started = 0;
    const reader = async (q, issue, io) => {
      const out = [];
      for (let i = 0; i < 9; i++) { if (!io.allow()) break; started++; out.push(doc(i)); }
      return out;
    };
    const res = fakeRes();
    let t = 0;
    const budget = new BG.Budget({ now: () => (t += 5), startedAt: 0 });
    budget.spend('pagesFetched', 3, 'earlier-issue');    // an earlier issue already read three
    const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
      messages: user(DIRECT_Q),
      band: 'adult', bandSites: SP.searchableDomains(),
      buildSourceTag: askMod.buildSourceTag,
      now: () => t, startedAt: 0, search: async () => [], fetchImpl,
      directReader: reader, plannerOverride: DIRECT_ISSUE, budget,
    });
    eq('the direct read uses only the REMAINING budget', started, BG.MAX_PAGES_FETCHED - 3);
    eq('...and the total never exceeds the ceiling',
      out.budget.snapshot().spent.pagesFetched, BG.MAX_PAGES_FETCHED);
    eq('...with no breach', out.budget.snapshot().breaches.length, 0);
  }
  {
    // 6. THE DEADLINE IS CHECKED BEFORE THE READER IS CALLED AT ALL.
    // With the deadline already expired, the previous version took an `await call` branch with no
    // timeout guarding it — a never-settling reader hung the request indefinitely, which is the
    // exact opposite of what a deadline is for.
    const DC = await esm('lib/ledger/direct-corpus.js');
    const issue = {
      issueId: 'iss_1', intent: 'scholar_opinion', requestedAuthorityId: 'ibn-uthaymeen',
      protectedEntities: ['أسقطت'], coreTerms: [], contextVars: [], exactUserPhrases: [],
      requiredSlots: [], dependencies: [], temporalScope: 'unknown',
    };
    let t = 0;
    const budget = new BG.Budget({ now: () => t, startedAt: 0 });
    t = BG.GLOBAL_TIMEOUT_MS + 5000;                       // already long gone
    eq('the budget really is expired', budget.remainingMs(), 0);

    let readerCalled = 0;
    const started = Date.now();
    const r = await Promise.race([
      DC.readDirectCorpus('ibn-uthaymeen', issue, {
        budget, reader: async () => { readerCalled++; return new Promise(() => {}); },
      }),
      new Promise((res) => setTimeout(() => res('HUNG'), 1500)),
    ]);
    ok('an expired deadline does not hang the request', r !== 'HUNG', 'it hung');
    eq('...the reader is never called', readerCalled, 0);
    eq('...and the module reports it', r === 'HUNG' ? null : r.readerCalled, 0);
    eq('...as a timeout', r === 'HUNG' ? null : r.timedOut, true);
    eq('...with no pages', r === 'HUNG' ? null : r.pages.length, 0);
    ok('...and it returns promptly', Date.now() - started < 1000, (Date.now() - started) + 'ms');
  }
  {
    // 7. A SUCCESSFUL reader leaves no timer running and triggers no late abort.
    const DC = await esm('lib/ledger/direct-corpus.js');
    const issue = {
      issueId: 'iss_1', intent: 'scholar_opinion', requestedAuthorityId: 'ibn-uthaymeen',
      protectedEntities: ['أسقطت'], coreTerms: [], contextVars: [], exactUserPhrases: [],
      requiredSlots: [], dependencies: [], temporalScope: 'unknown',
    };
    const budget = new BG.Budget({ timeoutMs: 300 });
    let abortedLate = false;
    const r = await DC.readDirectCorpus('ibn-uthaymeen', issue, {
      budget,
      reader: async (q, iss, io) => {
        io.signal.addEventListener('abort', () => { abortedLate = true; });
        io.allow();
        return [doc(1)];
      },
    });
    eq('a successful read returns its page', r.pages.length, 1);
    eq('...and reports the reader was called', r.readerCalled, 1);
    eq('...and did not time out', r.timedOut, false);
    // If the timer were left running it would fire after the budget elapsed and abort.
    await new Promise((res) => setTimeout(res, 400));
    eq('...no late abort fires after success', abortedLate, false);
  }

  // =========================================================================
  console.log('\n=== G2. httpJson GUARDS THE BODY, NOT ONLY THE HEADERS ===');
  //
  // `fetch()` resolving means the HEADERS arrived. The previous version cleared the timeout and
  // detached the abort listener there, leaving `await r.text()` unguarded — so a server that sent
  // headers and then stalled the body ran past this module's timeout AND past the request's
  // global deadline.
  {
    const BT = await esm('lib/binothaimeen.js');
    const SEARCH_HOST = 'shekhcp.binothaimeen.net';
    const okJson = (obj) => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(obj),
    });

    // (a) headers arrive, body never resolves -> the attempt aborts instead of hanging.
    {
      BT.__clearCacheForTest();
      let bodyReads = 0;
      // A REQUEST DEADLINE, as the ledger path always supplies. Without it the adapter is
      // entitled to spend its own per-request timeout on every term — which is the shipped
      // behaviour and is why the deadline exists.
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 150);
      const started = Date.now();
      const io = {
        allow: () => true,
        signal: controller.signal,
        fetchImpl: async (url, init) => ({
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          text: () => new Promise((resolve, reject) => {
            bodyReads++;
            // Only an abort can end this — which is the whole point: the body is still guarded.
            init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          }),
        }),
      };
      const out = await BT.retrieveIbnUthaymeen('أسقطت قبل ثمانين يوما', { io });
      const elapsed = Date.now() - started;
      eq('a stalled BODY yields no source rather than hanging', out.length, 0);
      ok('...the body read was actually attempted', bodyReads >= 1, String(bodyReads));
      ok('...and the deadline ended it promptly', elapsed < 3000, elapsed + 'ms');
      ok('...proving the abort listener still covers the body',
        elapsed < 7000, 'a per-attempt timeout alone would have taken 7s+');
    }

    // (b) a body that completes inside the timeout succeeds.
    {
      BT.__clearCacheForTest();
      let calls = 0;
      const io = {
        allow: () => true,
        fetchImpl: async (url) => {
          calls++;
          if (String(url).includes(SEARCH_HOST)) {
            return okJson({ data: [{ id: 'L1', title: { ar: 'ضابط السقط الذي تترك المرأة لأجله الصلاة' }, content: { ar: '' }, relevance: 1 }] });
          }
          return okJson({ data: null });
        },
      };
      await BT.retrieveIbnUthaymeen('أسقطت قبل ثمانين يوما', { io });
      ok('a completing body is read normally', calls >= 1, String(calls));
    }

    // (c) the CALLER's signal aborts during the body -> no retry.
    {
      BT.__clearCacheForTest();
      const controller = new AbortController();
      let attempts = 0;
      const io = {
        allow: () => true,
        signal: controller.signal,
        fetchImpl: async (url, init) => {
          attempts++;
          return {
            ok: true, status: 200,
            headers: { get: () => 'application/json' },
            text: () => new Promise((resolve, reject) => {
              setTimeout(() => controller.abort(), 5);
              init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
            }),
          };
        },
      };
      const out = await BT.retrieveIbnUthaymeen('أسقطت قبل ثمانين يوما', { io });
      eq('a caller-side abort during the body yields nothing', out.length, 0);
      // One search term is attempted; the abort must not double it into a retry.
      ok('...and is NOT retried', attempts <= 1, 'attempts=' + attempts);
    }

    // (d) every retry is reserved before it starts.
    {
      BT.__clearCacheForTest();
      let allowed = 0;
      let attempts = 0;
      const io = {
        allow: () => { allowed++; return allowed <= 2; },
        fetchImpl: async () => { attempts++; throw Object.assign(new Error('boom'), { name: 'TypeError' }); },
      };
      await BT.retrieveIbnUthaymeen('أسقطت قبل ثمانين يوما', { io });
      ok('every attempt asked permission first', allowed >= attempts, allowed + ' asks vs ' + attempts + ' attempts');
      ok('...and none started without it', attempts <= 2, 'attempts=' + attempts);
      ok('...so a refused permission really does stop the request', allowed > attempts,
        'the gate refused after 2 and no third attempt ran');
    }
    ok('the timer and listener are torn down in a finally block',
      /\} finally \{\s*clearTimeout\(timer\);/.test(code('lib/binothaimeen.js')));
    ok('...and the body is read while still under the timer',
      (() => {
        const b = code('lib/binothaimeen.js');
        const seg = b.slice(b.indexOf('async function httpJson'), b.indexOf('async function searchOnce'));
        return seg.indexOf('await r.text()') < seg.indexOf('clearTimeout(timer)');
      })());
  }

  // =========================================================================
  console.log('\n=== G3. THE REAL ADAPTER, END TO END, INSIDE THE CEILING ===');
  //
  // Every direct test above injects a `directReader` and therefore proves nothing about
  // retrieveIbnUthaymeen -> searchOnce -> fetchLesson -> httpJson. This drives that real chain
  // with a mock transport and requires it to SUCCEED inside the five-request ceiling.
  {
    const BT = await esm('lib/binothaimeen.js');
    const FATWA = 'السؤال: امرأة أسقطت قبل ثمانين يوما فماذا يلزمها؟ الجواب: إذا أسقطت المرأة قبل '
      + 'ثمانين يوما فليس دمها دم نفاس، لأن الجنين لم يتبين فيه خلق إنسان. وعلى هذا فإنها تصلي ولا '
      + 'تدع الصلاة لأجل هذا الدم. وكذلك تصوم ولا تفطر من أجله. وإنما هو دم فساد ينطبق عليه حكم '
      + 'الاستحاضة. فتتوضأ لكل صلاة ثم تصلي على حالها. والله أعلم.';
    const makeTransport = (opts = {}) => {
      const seen = { search: 0, lesson: 0, urls: [] };
      const impl = async (url) => {
        const u = String(url);
        seen.urls.push(u);
        if (u.includes('shekhcp.binothaimeen.net')) {
          seen.search++;
          return {
            ok: true, status: 200, headers: { get: () => 'application/json' },
            text: async () => JSON.stringify({ data: [
              { id: 'L1', title: { ar: 'ضابط السقط الذي تترك المرأة لأجله الصلاة' }, content: { ar: 'حكم دم السقط' }, relevance: 9 },
            ] }),
          };
        }
        seen.lesson++;
        if (opts.lessonShouldNotHappen) throw new Error('lesson request must never start');
        return {
          ok: true, status: 200, headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ data: {
            title: { ar: 'ضابط السقط الذي تترك المرأة لأجله الصلاة' },
            objective: { content: { ar: FATWA } },
          } }),
        };
      };
      return { impl, seen };
    };

    // Success inside the ceiling.
    {
      BT.__clearCacheForTest();
      const { impl, seen } = makeTransport();
      const res = fakeRes();
      let t = 0;
      const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
        messages: user('ما رأي الشيخ ابن عثيمين فيمن أسقطت قبل ثمانين يومًا؟ وهل تصلي وتصوم؟'),
        band: 'adult', bandSites: SP.searchableDomains(),
        buildSourceTag: askMod.buildSourceTag,
        now: () => (t += 5), startedAt: 0,
        search: async () => [], fetchImpl,
        adapterFetchImpl: impl,               // the REAL adapter, a mock transport
        plannerOverride: DIRECT_ISSUE,
      });
      const snap = out.budget.snapshot();
      ok('the REAL adapter path was used', seen.search >= 1, JSON.stringify(seen));
      ok('...and the lesson page was actually fetched', seen.lesson >= 1, JSON.stringify(seen));
      ok('...network calls are within the ceiling',
        snap.spent.pagesFetched > 0 && snap.spent.pagesFetched <= BG.MAX_PAGES_FETCHED,
        String(snap.spent.pagesFetched));
      eq('...every call was reserved before it started', snap.spent.pagesFetched, seen.search + seen.lesson);
      eq('...with zero provider calls', snap.spent.braveCalls, 0);
      eq('...and no budget breach', snap.breaches.length, 0);
      eq('...exactly one accepted source', out.ledger.sources.size, 1);
      ok('...on his own domain',
        Array.from(out.ledger.sources.values()).every((s) => s.host === 'binothaimeen.net'),
        JSON.stringify(Array.from(out.ledger.sources.values()).map((s) => s.host)));
      eq('...and exactly one card', out.cards.length, 1);
      eq('...from his domain', out.cards[0].host, 'binothaimeen.net');
    }

    // The budget runs out after the searches and BEFORE the lesson GET.
    {
      BT.__clearCacheForTest();
      const { impl, seen } = makeTransport({ lessonShouldNotHappen: true });
      const res = fakeRes();
      let t = 0;
      const budget = new BG.Budget({ now: () => (t += 5), startedAt: 0 });
      budget.spend('pagesFetched', BG.MAX_PAGES_FETCHED - 1, 'earlier-issue');   // one unit left
      const out = await SEAM.runLedgerTurn(res, {
      dailyBudgetMode: 'fixture',
        messages: user('ما رأي الشيخ ابن عثيمين فيمن أسقطت قبل ثمانين يومًا؟'),
        band: 'adult', bandSites: SP.searchableDomains(),
        buildSourceTag: askMod.buildSourceTag,
        startedAt: 0, search: async () => [], fetchImpl,
        adapterFetchImpl: impl, plannerOverride: DIRECT_ISSUE, budget,
      });
      eq('the one remaining unit went to the search', seen.search, 1);
      eq('...and the lesson request NEVER started', seen.lesson, 0);
      eq('...the outcome is a safe rejection', out.outcome, 'SAFE_REJECTION');
      eq('...with no provider fallback', out.budget.snapshot().spent.braveCalls, 0);
      eq('...no source', out.ledger.sources.size, 0);
      eq('...and no breach', out.budget.snapshot().breaches.length, 0);
      ok('...and nothing attributed to him', !/ابن عثيمين/.test(out.text), out.text);
    }
  }

  // The gate lives INSIDE the adapter's request path, which is the only place it can stop a
  // request rather than count one.
  {
    const bt = code('lib/binothaimeen.js');
    ok('httpJson consults the gate before each attempt', /if \(io && typeof io\.allow === 'function' && !io\.allow\(\)\)/.test(bt));
    ok('...and it is inside the retry loop, so a retry is charged too',
      bt.indexOf('for (let attempt') < bt.indexOf('io.allow()'));
    ok('...and an abort signal is honoured', /io\.signal/.test(bt));
    ok('both the search POST and the lesson GET pass it through',
      /SEARCH_TIMEOUT_MS, io\)/.test(bt) && /SHOW_TIMEOUT_MS, io\)/.test(bt));
    // The shipped attributed route passes no external Ledger gate. F-163 now gives that invocation
    // its own local per-request cap; it does not borrow a global counter or activate Ledger.
    // Checked as an object KEY (`io:`) rather than a substring — "attribution" contains the
    // letters "io", and the first version of this assertion matched that.
    ok('the SHIPPED attributed route passes no gate, so legacy is unchanged',
      !/\bio\s*:/.test(code('api/ask.js')));
    ok('...while the ledger path does pass one',
      /\{ io \}/.test(code('lib/ledger/direct-corpus.js')));
    ok('...and the adapter defaults to an isolated governing cap when none is given',
      /let localAttempts = 0;/.test(bt)
      && /const localIo = \{/.test(bt)
      && /MAX_PAGES_FETCHED - RESERVE_FOR_FETCH/.test(bt)
      && /const io = o\.io \|\| localIo;/.test(bt));
  }

  // =========================================================================
  console.log('\n=== K. SERVER-OWNED MODEL TIER — REAL HANDLER, PLANNER, RETRY AND CONCURRENCY ===');
  {
    const { AsyncLocalStorage } = require('node:async_hooks');
    const requestScope = new AsyncLocalStorage();
    const ROUTE_PLAN = await esm('lib/ledger/planner.js');
    const STANDARD = 'planner-standard-sentinel';
    const PREMIUM = 'planner-premium-sentinel';
    const LEGACY = 'planner-legacy-sentinel';
    const routeKeys = ['LEDGER_RAG', 'RFC_V05_MODE', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY',
      'FOUNDER_SECRET', 'MODEL_STANDARD', 'MODEL_PREMIUM', 'MODEL', 'DAILY_SEARCH_BUDGET'];
    const routeSaved = routeKeys.map((key) => [key,
      Object.prototype.hasOwnProperty.call(process.env, key), process.env[key]]);
    const realFetch = globalThis.fetch;
    const realSpend = BG.Budget.prototype.spend;
    const realLog = console.log;
    const modelCalls = [];
    const purposeEvents = [];
    const tierByRequest = new Map();
    const configs = new Map();
    const queryCounts = new Map();
    const unknownFetches = [];
    const barrierArrivals = new Set();
    let releaseBarrier;
    const barrier = new Promise((resolve) => { releaseBarrier = resolve; });

    process.env.LEDGER_RAG = 'true';
    process.env.RFC_V05_MODE = 'public';
    process.env.ANTHROPIC_API_KEY = 'planner-routing-anthropic-stub';
    process.env.BRAVE_API_KEY = 'planner-routing-brave-stub';
    process.env.FOUNDER_SECRET = 'planner-routing-founder-secret';
    process.env.MODEL_STANDARD = STANDARD;
    process.env.MODEL_PREMIUM = PREMIUM;
    process.env.MODEL = LEGACY;
    process.env.DAILY_SEARCH_BUDGET = '500';

    const ledgerStore = new Map();
    STORE.__setRedisForTest({
      async get(key) { return ledgerStore.has(key) ? ledgerStore.get(key) : null; },
      async set(key, value) { ledgerStore.set(key, value); return 'OK'; },
      async setex(key, _ttl, value) { ledgerStore.set(key, value); return 'OK'; },
      async eval() { return [1, 1]; }, async incr() { return 1; }, async expire() { return 1; },
    });
    const capCounts = new Map();
    DC.__setRedisForTest({
      async sismember() { return 0; },
      async mget(...keys) { return keys.map((key) => capCounts.get(key) || null); },
      pipeline() {
        const ops = [];
        return {
          incr(key) { ops.push(() => { const n = (Number(capCounts.get(key)) || 0) + 1; capCounts.set(key, n); return n; }); return this; },
          expire() { ops.push(() => 1); return this; },
          async exec() { return ops.map((op) => op()); },
        };
      },
    });
    FL.__resetFlagCacheForTest();

    const FULL_Q = 'ما حكم بيع الذهب بالتقسيط؟';
    const FULL_PLAN = {
      issues: [{
        issue_id: 'iss_1', intent: 'hadith_grading', requested_authority_id: null,
        protected_entities: ['المسلمون'], core_terms: ['لسانه', 'يده'], context_vars: [],
        exact_user_phrases: ['المسلم من سلم المسلمون من لسانه ويده'], required_slots: ['hadith_grading'], dependencies: [], temporal_scope: 'unknown',
      }],
      missing_qualifiers: [], confidence: 'high',
    };
    BG.Budget.prototype.spend = function observedSpend(kind, n, purpose) {
      const requestId = requestScope.getStore();
      if (requestId && kind === 'modelCalls') purposeEvents.push({ requestId, purpose });
      return realSpend.call(this, kind, n, purpose);
    };
    console.log = (label, value, ...rest) => {
      const requestId = requestScope.getStore();
      if (requestId && label === '[tier]' && value && typeof value === 'object') {
        tierByRequest.set(requestId, { ...value });
      }
      realLog(label, value, ...rest);
    };
    globalThis.fetch = async (url, init = {}) => {
      const requestId = requestScope.getStore() || 'no-request';
      const target = String(url);
      if (target === '/pipeline' && init && init.method === 'POST') {
        return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      if (target.includes('api.anthropic.com')) {
        const body = JSON.parse(init.body || '{}');
        const requestPurposes = purposeEvents.filter((event) => event.requestId === requestId);
        const purpose = requestPurposes.length ? requestPurposes[requestPurposes.length - 1].purpose : '';
        const prompt = String(((((body.messages || [])[0] || {}).content) || ''));
        const call = { requestId, purpose, model: body.model, planner: purpose === 'query_ir', prompt };
        modelCalls.push(call);
        const config = configs.get(requestId) || {};
        let text;
        if (purpose === 'query_ir') {
          const queryCount = (queryCounts.get(requestId) || 0) + 1;
          queryCounts.set(requestId, queryCount);
          if (config.concurrent && queryCount === 1) {
            barrierArrivals.add(requestId);
            if (barrierArrivals.size === 2) releaseBarrier();
            await barrier;
          }
          text = config.retry && queryCount === 1
            ? '{}'
            : JSON.stringify(config.safe ? SAFE_PLAN : FULL_PLAN);
        } else {
          const payload = modelReply(body);
          return { ok: true, status: 200, headers: { get: () => 'application/json' },
            json: async () => payload, text: async () => JSON.stringify(payload) };
        }
        const payload = { content: [{ type: 'text', text }], usage: { output_tokens: 20 } };
        return { ok: true, status: 200, headers: { get: () => 'application/json' },
          json: async () => payload, text: async () => JSON.stringify(payload) };
      }
      if (target.includes('api.search.brave.com')) {
        const fixtures = /المسلمون|لسانه|يده/.test(decodeURIComponent(target)) ? HANDLER_RESULTS : RESULTS;
        const payload = { web: { results: fixtures.map((result) => ({
          ...result, description: result.snippet,
        })) } };
        return { ok: true, status: 200, headers: { get: () => 'application/json' },
          json: async () => payload, text: async () => JSON.stringify(payload) };
      }
      if (Object.prototype.hasOwnProperty.call(PAGES, target.split('?')[0])) return fetchImpl(target, init);
      unknownFetches.push({ requestId, target });
      throw new Error('routing fixture blocked non-stub fetch: ' + target.slice(0, 100));
    };

    let requestNumber = 0;
    const makeRequest = (spec) => {
      requestNumber++;
      const device = 'plannerroutingdevice' + String(requestNumber).padStart(3, '0');
      const headers = {
        'x-murabbi-device': device,
        'x-ezik-ai-consent': '2026-08-06-1',
      };
      if (spec.authorized) headers['x-murabbi-founder'] = DC.founderTokenFor(device);
      const body = {
        band: 'adult', age: 30, depth: spec.depth,
        messages: user(HANDLER_SEAM_Q),
      };
      if (spec.forged) Object.assign(body, {
        depth: 'scholar', premium: true, student: true, tier: 'premium',
        plannerTier: 'premium', usePremium: true, model: 'claude-opus-5',
        founderUnlocked: true, outcome: 'SAFE_REJECTION', kind: 'safe_rejection',
      });
      return { method: 'POST', headers, body };
    };
    const makeResponse = () => {
      const target = fakeRes();
      target.headersSent = false;
      target.json = function json(value) { this.jsonBody = value; this.ended++; return this; };
      return target;
    };
    const runCase = async (spec) => {
      configs.set(spec.id, spec);
      const response = makeResponse();
      const request = makeRequest(spec);
      await requestScope.run(spec.id, () => askMod.default(request, response));
      const calls = modelCalls.filter((call) => call.requestId === spec.id);
      const frames = response.frames();
      return {
        ...spec, request, response, calls, frames,
        purposes: purposeEvents.filter((event) => event.requestId === spec.id),
        tier: tierByRequest.get(spec.id),
        text: frames.filter((frame) => frame.delta).map((frame) => frame.delta.text).join(''),
        context: response[A1SSE.FINALIZATION_CONTEXT],
      };
    };

    try {
      ok('routing matrix uses distinct Standard, Premium and legacy sentinels',
        new Set([STANDARD, PREMIUM, LEGACY]).size === 3);
      const fullSpecs = [
        { id: 'CASE_1_STANDARD_BRIEF', authorized: false, depth: 'brief', expectedPremium: false },
        { id: 'CASE_2_UNAUTHORIZED_DEEP', authorized: false, depth: 'deep', expectedPremium: false },
        { id: 'CASE_3_FORGED_SCHOLAR', authorized: false, depth: 'scholar', forged: true, expectedPremium: false },
        { id: 'CASE_4_AUTHORIZED_BRIEF', authorized: true, depth: 'brief', expectedPremium: false },
        { id: 'CASE_5_AUTHORIZED_DEEP', authorized: true, depth: 'deep', expectedPremium: true },
        { id: 'CASE_6_AUTHORIZED_SCHOLAR', authorized: true, depth: 'scholar', expectedPremium: true },
      ];
      const fullRuns = [];
      for (const spec of fullSpecs) fullRuns.push(await runCase(spec));
      for (const run of fullRuns) {
        const expectedModel = run.expectedPremium ? PREMIUM : STANDARD;
        ok(run.id + ' real handler authorization owns usePremium', run.tier
          && run.tier.founderUnlocked === run.authorized && run.tier.usePremium === run.expectedPremium,
        JSON.stringify(run.tier));
        ok(run.id + ' correlates every provider call to a named Ledger purpose', run.calls.length >= 2
          && run.calls.every((call) => call.purpose)
          && run.calls.filter((call) => call.purpose === 'query_ir').length === 1,
        JSON.stringify(run.calls));
        ok(run.id + ' keeps every Ledger call on its request-local model',
          run.calls.every((call) => call.model === expectedModel), JSON.stringify(run.calls));
        eq(run.id + ' reaches exactly one reader-answer drafting call',
          run.calls.filter((call) => call.purpose === 'drafting').length, 1);
        eq(run.id + ' Premium body count matches entitlement',
          run.calls.filter((call) => call.model === PREMIUM).length,
          run.expectedPremium ? run.calls.length : 0);
        ok(run.id + ' stays on the answer path and closes once', run.context
          && run.context.kind === 'answer' && run.response.ended === 1
          && run.frames.filter((frame) => frame.type === 'message_stop').length === 1);
      }
      const forgedFull = fullRuns.find((run) => run.id === 'CASE_3_FORGED_SCHOLAR');
      ok('CASE_3 forged client outcome cannot obtain safe_rejection or Premium', forgedFull
        && forgedFull.context && forgedFull.context.kind === 'answer'
        && forgedFull.calls.every((call) => call.model === STANDARD));

      const safeSpecs = [
        { id: 'CASE_8_SAFE_REJECTION_STANDARD', authorized: false, depth: 'brief', safe: true, expectedPremium: false },
        { id: 'CASE_9_SAFE_REJECTION_DEEP', authorized: true, depth: 'deep', safe: true, expectedPremium: true },
        { id: 'CASE_9_SAFE_REJECTION_SCHOLAR', authorized: true, depth: 'scholar', safe: true, expectedPremium: true },
      ];
      const safeRuns = [];
      for (const spec of safeSpecs) safeRuns.push(await runCase(spec));
      for (const run of safeRuns) {
        const expectedModel = run.expectedPremium ? PREMIUM : STANDARD;
        eq(run.id + ' has exactly one query_ir call',
          run.calls.map((call) => call.purpose), ['query_ir']);
        eq(run.id + ' planner uses the server-owned model', run.calls[0] && run.calls[0].model, expectedModel);
        eq(run.id + ' has zero reader-answer calls',
          run.calls.filter((call) => call.purpose === 'drafting').length, 0);
        ok(run.id + ' never turns a missing qualifier into a follow-up', run.context
          && run.context.kind === 'safe_rejection'
          && !run.text.includes(SAFE_QUALIFIER)
          && !/NEEDS_QUALIFIER|وضح سؤالك|حدد المقصود/u.test(run.text), run.text);
        ok(run.id + ' closes once without a fabricated source', run.response.ended === 1
          && run.frames.filter((frame) => frame.type === 'message_stop').length === 1
          && !run.text.includes('<source'));
      }

      const malformed = [
        ['missing', undefined, 'missing'], ['undefined', undefined], ['null', null],
        ['false', false], ['true', true], ['zero', 0], ['one', 1], ['empty', ''],
        ['unknown', 'unknown'], ['wrong-case', 'PREMIUM'], ['object', {}], ['array', []],
        ['inherited-premium', 'premium', 'inherited'],
        ['inherited-premium-getter', undefined, 'inherited-getter'],
      ];
      for (const [label, value, mode = 'own'] of malformed) {
        const bodies = [];
        const directFetch = async (_url, init) => {
          bodies.push(JSON.parse(init.body));
          const payload = { content: [{ type: 'text', text: '{}' }] };
          return { ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) };
        };
        const base = { budget: new BG.Budget({ now: () => 1770000000000 }), fetchImpl: directFetch };
        let options = base;
        if (mode === 'own') options = { ...base, tier: value };
        if (mode === 'inherited') options = Object.assign(Object.create({ tier: value }), base);
        if (mode === 'inherited-getter') {
          const proto = {};
          Object.defineProperty(proto, 'tier', {
            enumerable: true,
            get() { throw new Error('planner inherited tier getter must not run'); },
          });
          options = Object.assign(Object.create(proto), base);
        }
        await ROUTE_PLAN.planQuestion(FULL_Q, options);
        eq('CASE_7 ' + label + ' keeps initial-plus-repair count', bodies.length, 2);
        ok('CASE_7 ' + label + ' fails closed across initial and repair',
          bodies.every((body) => body.model === STANDARD), JSON.stringify(bodies.map((body) => body.model)));
      }

      const runSeamTierBoundary = async ({ id, mode, value, expectedModel }) => {
        const spec = { id, safe: true, retry: true };
        configs.set(id, spec);
        const response = makeResponse();
        let finalOutcome = null;
        const base = {
          dailyBudgetMode: 'fixture', messages: user(SAFE_Q),
          band: 'adult', audienceBand: 'adult', bandSites: SP.searchableDomains(),
          search: async () => { throw new Error('safe plan must not search'); },
          fetchImpl: globalThis.fetch, adapterFetchImpl: globalThis.fetch,
          buildSourceTag: askMod.buildSourceTag,
          registerFinalizerOutcome: (outcome) => { finalOutcome = outcome; },
          now: () => 1770000000000, startedAt: 1770000000000,
        };
        let options = base;
        if (mode === 'own') options = { ...base, tier: value };
        if (mode === 'inherited') options = Object.assign(Object.create({ tier: value }), base);
        if (mode === 'inherited-getter') {
          const proto = {};
          Object.defineProperty(proto, 'tier', {
            enumerable: true,
            get() { throw new Error('seam inherited tier getter must not run'); },
          });
          options = Object.assign(Object.create(proto), base);
        }
        const out = await requestScope.run(id, () => SEAM.runLedgerTurn(response, options));
        const calls = modelCalls.filter((call) => call.requestId === id);
        eq(id + ' drives initial and repair through the real seam',
          calls.map((call) => call.purpose), ['query_ir', 'query_ir']);
        eq(id + ' keeps both seam-routed bodies on the expected local model',
          calls.map((call) => call.model), [expectedModel, expectedModel]);
        ok(id + ' remains a typed SAFE_REJECTION with one close and no source',
          out.outcome === 'SAFE_REJECTION' && finalOutcome === 'SAFE_REJECTION'
            && response.ended === 1
            && response.frames().filter((frame) => frame.type === 'message_stop').length === 1
            && !response.body.includes('<source'));
      };
      await runSeamTierBoundary({
        id: 'CASE_7_SEAM_INHERITED_PREMIUM', mode: 'inherited', value: 'premium', expectedModel: STANDARD,
      });
      await runSeamTierBoundary({
        id: 'CASE_7_SEAM_INHERITED_GETTER_PREMIUM', mode: 'inherited-getter', expectedModel: STANDARD,
      });
      await runSeamTierBoundary({
        id: 'CASE_7_SEAM_MISSING', mode: 'missing', expectedModel: STANDARD,
      });
      await runSeamTierBoundary({
        id: 'CASE_7_SEAM_MALFORMED', mode: 'own', value: {}, expectedModel: STANDARD,
      });
      await runSeamTierBoundary({
        id: 'CASE_7_SEAM_OWN_STANDARD', mode: 'own', value: 'standard', expectedModel: STANDARD,
      });
      await runSeamTierBoundary({
        id: 'CASE_7_SEAM_OWN_PREMIUM', mode: 'own', value: 'premium', expectedModel: PREMIUM,
      });

      const concurrentSpecs = [
        { id: 'CASE_11_CONCURRENT_STANDARD', authorized: false, depth: 'brief', safe: true,
          retry: true, concurrent: true, expectedPremium: false },
        { id: 'CASE_11_CONCURRENT_PREMIUM', authorized: true, depth: 'deep', safe: true,
          retry: true, concurrent: true, expectedPremium: true },
      ];
      const concurrentRuns = await Promise.all(concurrentSpecs.map((spec) => runCase(spec)));
      eq('CASE_11 deterministic barrier observed both requests before release',
        Array.from(barrierArrivals).sort(), concurrentSpecs.map((spec) => spec.id).sort());
      for (const run of concurrentRuns) {
        const expectedModel = run.expectedPremium ? PREMIUM : STANDARD;
        eq(run.id + ' keeps two query_ir attempts through repair',
          run.calls.map((call) => call.purpose), ['query_ir', 'query_ir']);
        eq(run.id + ' keeps one model across the retry',
          run.calls.map((call) => call.model), [expectedModel, expectedModel]);
        ok(run.id + ' retains its own authorization with no cross-request leak', run.tier
          && run.tier.usePremium === run.expectedPremium
          && run.context && run.context.kind === 'safe_rejection');
        eq(run.id + ' reaches no reader-answer during retry-safe-rejection',
          run.calls.filter((call) => call.purpose === 'drafting').length, 0);
      }

      const partial = A1FINAL.finalizeReaderText({
        kind: askMod.ledgerFinalizerKind('PARTIAL'), text: 'هذا واجب.',
        fallbackText: A1FINAL.FINALIZER_REFUSAL, consistencyContext: { pageTexts: [] },
      });
      const documented = 'هذا واجب.';
      const full = A1FINAL.finalizeReaderText({
        kind: askMod.ledgerFinalizerKind('FULL'), text: documented,
        consistencyContext: { pageTexts: [documented] },
      });
      ok('CASE_10 PARTIAL unsourced ruling remains blocked',
        !partial.ok && partial.problems.includes('RULING_WITHOUT_SOURCE'));
      ok('CASE_10 documented FULL remains an answer and passes', full.ok && full.text === documented);
      eq('CASE_10 unknown outcome remains an answer', askMod.ledgerFinalizerKind('UNKNOWN'), 'answer');
      eq('routing matrix attempted no live or unstubbed network', unknownFetches, []);
    } finally {
      globalThis.fetch = realFetch;
      BG.Budget.prototype.spend = realSpend;
      console.log = realLog;
      for (const [key, had, value] of routeSaved) {
        if (had) process.env[key] = value; else delete process.env[key];
      }
      FL.__resetFlagCacheForTest();
    }
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
