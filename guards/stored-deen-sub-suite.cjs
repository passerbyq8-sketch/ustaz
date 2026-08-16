'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { EventEmitter } = require('events');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CORPUS = path.join(ROOT, 'lib', 'data', 'fiqh-search.json.gz');
const EXPECTED_HASH = '6482d677ebf09cc5627a172ee77114587046edeb95529092cb644e42e00d13a2';
const EXPECTED_RECORDS = 3070;
const NO_EVIDENCE = 'لا يوجد في المصادر المخزنة لدي الآن نص كافٍ للإجابة عن هذا السؤال.';
const EXPECTED_GATES = JSON.parse(fs.readFileSync(path.join(ROOT, 'gates.json'), 'utf8')).map((gate) => gate.name);

const GENERAL = [
  'ما رأي أينشتاين في النسبية؟',
  'ما رأي ستيف جوبز في التصميم؟',
  'ما الفرق بين الخرسانة المسلحة وسابقة الإجهاد؟',
  'اكتب قصة خيالية عن مدينة المعرفة',
];
const JOIN = 'ما حكم الجمع بين الصلاتين للمسافر؟';
const BAZ_JOIN = 'ما رأي ابن باز في الجمع بين الصلاتين للمسافر؟';
const CONTINUATION = 'أقصد المسافر سفرًا مباحًا، ويريد الجمع بين الظهر والعصر عند الحاجة، فما الحكم مع الدليل والمصدر؟';
const STANCE = 'هل خالف ابن تيمية أهل السنة والجماعة؟';
const GOLD = 'ما حكم بيع الذهب بالتقسيط؟';
const AMBIGUOUS_SUPPORTED = 'ما رأي خالد المصلح خالد السبت في الجمع بين الصلاتين للمسافر؟';

let checks = 0;
let failures = 0;
function ok(label, condition, detail = '') {
  checks++;
  if (condition) process.stdout.write('  PASS  ' + label + '\n');
  else {
    failures++;
    process.stderr.write('  FAIL  ' + label + (detail ? '\n        ' + detail : '') + '\n');
  }
}
function eq(label, actual, expected) {
  ok(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function sha(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function esm(rel) {
  return import(pathToFileURL(path.join(ROOT, rel)).href);
}
function currentPlan(A, question) {
  return A.planAsk([{ role: 'user', content: question }], { policyEnabled: true });
}
function contextFor(S, R, A, question, messages = null) {
  const thread = messages || [{ role: 'user', content: question }];
  return S.resolveStoredContext(thread, {
    currentPlan: currentPlan(A, question),
    lexicalRoute: R.classifyRoute(thread),
  });
}
function exactSentence(text, needle, max = 760) {
  const source = String(text || '');
  let start = source.indexOf(needle);
  if (start < 0) start = 0;
  let end = source.indexOf('.', start);
  if (end < start + 30 || end - start > max) end = Math.min(source.length, start + max);
  return source.slice(start, end < source.length ? end + 1 : end).trim();
}
function joinQuote(record, question = JOIN) {
  const text = String(record && record.text || '');
  if (/مسافر|سفر/u.test(question)) {
    const direct = exactSentence(text, 'وقد اتفق القائلون بجواز الجمع بسبب السفر علي انه يجوز الجمع للمسافر بين الصلاتين');
    if (direct) return direct;
  }
  return exactSentence(text, 'والمراد بجمع الصلوات عند الفقهاء');
}
function claimDraft(pack, question, sentence) {
  const record = pack[0];
  const quote = joinQuote({ text: record.stored_text }, question);
  return JSON.stringify({ claims: [{
    record_id: record.record_id,
    support_quote: quote,
    sentence: sentence == null ? quote : sentence,
  }] });
}

function sseFrames(text) {
  return [
    { type: 'message_start', message: { id: 'stored-suite', type: 'message', role: 'assistant', content: [] } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
  ].map((event) => `data: ${JSON.stringify(event)}\n\n`);
}
function readerFor(frames) {
  const chunks = frames.map((frame) => Buffer.from(frame, 'utf8'));
  let index = 0;
  return {
    async read() { return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true }; },
    releaseLock() {},
    async cancel() { index = chunks.length; },
  };
}
function visibleText(raw) {
  return String(raw || '').split(/\r?\n\r?\n/u).filter(Boolean)
    .map((frame) => frame.split(/\r?\n/u).find((line) => line.startsWith('data:')))
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line.slice(5).trim()); } catch { return null; } })
    .filter((event) => event && event.type === 'content_block_delta' && event.delta?.type === 'text_delta')
    .map((event) => event.delta.text).join('');
}
function recordCards(text) {
  return [...String(text || '').matchAll(/<source\b[^>]*\brecord="([^"]+)"/giu)].map((match) => match[1]);
}

class Response extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
    this.ended = 0;
    this.statusCode = 0;
    this.headersSent = false;
    this.writableEnded = false;
  }
  status(code) { this.statusCode = code; return this; }
  setHeader() { this.headersSent = true; return this; }
  flushHeaders() { this.headersSent = true; }
  write(chunk, encoding, callback) {
    this.writes.push(String(chunk));
    if (typeof encoding === 'function') encoding();
    if (typeof callback === 'function') callback();
    return true;
  }
  end(chunk, encoding, callback) {
    if (typeof chunk === 'function') { callback = chunk; chunk = undefined; }
    else if (typeof encoding === 'function') callback = encoding;
    if (chunk != null) this.writes.push(String(chunk));
    if (!this.writableEnded) { this.writableEnded = true; this.ended++; }
    if (typeof callback === 'function') callback();
    return this;
  }
  json(value) { this.jsonBody = value; return this.end(); }
}

async function createHandlerHarness(DAY, handler) {
  let requestNo = 0;
  let fetchState = null;
  const cap = new Map();
  DAY.__setRedisForTest({
    async mget(...keys) { return keys.map((key) => cap.get(key) || null); },
    async sismember() { return 0; },
    pipeline() {
      const ops = [];
      return {
        incr(key) { ops.push(() => { const n = (Number(cap.get(key)) || 0) + 1; cap.set(key, n); return n; }); return this; },
        expire() { ops.push(() => 1); return this; },
        async exec() { return ops.map((op) => op()); },
      };
    },
  });

  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const install = (state) => {
    fetchState = state;
    globalThis.fetch = async (url, init = {}) => {
      const target = String(url);
      state.fetchTargets.push(target);
      if (!target.includes('api.anthropic.com')) throw new Error('offline external call: ' + target);
      const body = JSON.parse(init.body || '{}');
      state.providerRequests.push(body);
      let payload = null;
      if (body.messages && body.messages[0] && typeof body.messages[0].content === 'string') {
        try { payload = JSON.parse(body.messages[0].content); } catch {}
      }
      if (payload && Array.isArray(payload.evidence_pack)) {
        state.religiousModelCalls++;
        const drafted = state.modelDraft
          ? state.modelDraft(payload, body)
          : claimDraft(payload.evidence_pack, payload.current_question);
        return {
          ok: true, status: 200, headers: { get: () => 'application/json' },
          async json() { return { content: [{ type: 'text', text: drafted }], stop_reason: 'end_turn' }; },
          async text() { return ''; },
        };
      }
      if (body.stream) {
        const frames = sseFrames(state.generalDraft || 'إجابة عامة طبيعية.');
        return {
          ok: true, status: 200, headers: { get: () => 'text/event-stream' },
          body: { getReader: () => readerFor(frames) }, async text() { return ''; },
        };
      }
      if (body.tools) {
        return {
          ok: true, status: 200, headers: { get: () => 'application/json' },
          async json() {
            return { content: [{ type: 'tool_use', id: 'offline', name: 'search_islamic_sources', input: { query: state.question } }], stop_reason: 'tool_use' };
          },
          async text() { return ''; },
        };
      }
      return {
        ok: true, status: 200, headers: { get: () => 'application/json' },
        async json() { return { content: [{ type: 'text', text: 'GEN' }], stop_reason: 'end_turn' }; },
        async text() { return ''; },
      };
    };
    console.log = (...args) => {
      state.logs.push(args);
      if (args[0] === '[route]') state.routeLogs.push(args[1]);
      if (args[0] === '[stored-deen]') state.storedLogs.push(args[1]);
      if (args[0] === '[tier]') state.tierLogs.push(args[1]);
    };
    console.warn = (...args) => { state.warns.push(args); };
  };

  const drive = async ({ question, messages, depth, founder = true, modelDraft, generalDraft }) => {
    requestNo++;
    cap.clear();
    const state = {
      question, modelDraft, generalDraft, logs: [], warns: [], routeLogs: [], storedLogs: [], tierLogs: [],
      providerRequests: [], fetchTargets: [], religiousModelCalls: 0,
    };
    install(state);
    const device = `stored-suite-${requestNo}-device`;
    const req = new EventEmitter();
    req.method = 'POST';
    req.signal = new AbortController().signal;
    req.headers = {
      'x-murabbi-device': device,
      'x-ezik-ai-consent': '2026-08-06-1',
      ...(founder ? { 'x-murabbi-founder': DAY.founderTokenFor(device) } : {}),
    };
    req.body = {
      age: 25,
      band: 'adult',
      depth,
      messages: messages || [{ role: 'user', content: question }],
    };
    const res = new Response();
    await handler(req, res);
    state.text = visibleText(res.writes.join(''));
    state.cards = recordCards(state.text);
    state.res = res;
    state.route = state.routeLogs.at(-1) || null;
    state.stored = state.storedLogs.at(-1) || null;
    state.tier = state.tierLogs.at(-1) || null;
    return state;
  };
  const restore = () => {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.warn = originalWarn;
    fetchState = null;
  };
  return { drive, restore };
}

function importableStoredSource(source) {
  const lib = path.join(ROOT, 'lib');
  return source.replace(/from\s+(['"])(\.\/[^'"]+)\1/gu, (_all, quote, specifier) => {
    const url = pathToFileURL(path.resolve(lib, specifier)).href;
    return `from ${quote}${url}${quote}`;
  });
}

async function storedMutant(temp, name, mutate) {
  const original = fs.readFileSync(path.join(ROOT, 'lib', 'stored-deen.js'), 'utf8');
  const changed = mutate(importableStoredSource(original));
  if (changed === importableStoredSource(original)) throw new Error('mutation seam moved: ' + name);
  const file = path.join(temp, `stored-${name}.mjs`);
  fs.writeFileSync(file, changed, 'utf8');
  return import(pathToFileURL(file).href + `?v=${Date.now()}-${name}`);
}

async function routeMutant(temp, name, mutate) {
  const original = fs.readFileSync(path.join(ROOT, 'lib', 'route-classify.js'), 'utf8');
  const changed = mutate(original);
  if (changed === original) throw new Error('route mutation seam moved: ' + name);
  const file = path.join(temp, `route-${name}.mjs`);
  fs.writeFileSync(file, changed, 'utf8');
  return import(pathToFileURL(file).href + `?v=${Date.now()}-${name}`);
}

async function runSuite() {
  console.log('\n=== stored-DEEN sub-suite — domain, context, evidence and output safety ===');
  const beforeBuffer = fs.readFileSync(CORPUS);
  const beforeRecords = JSON.parse(zlib.gunzipSync(beforeBuffer).toString('utf8'));
  eq('CORPUS_RECORDS_BEFORE', beforeRecords.length, EXPECTED_RECORDS);
  eq('CORPUS_SHA256_BEFORE', sha(beforeBuffer), EXPECTED_HASH);

  const [S, R, A, E, DAY] = await Promise.all([
    esm('lib/stored-deen.js'), esm('lib/route-classify.js'), esm('lib/ask-plan.js'),
    esm('lib/encyclopedia.js'), esm('lib/daycap.js'),
  ]);

  console.log('\n--- A. DOMAIN FIRST ---');
  for (const question of GENERAL) {
    const ctx = contextFor(S, R, A, question);
    eq('GENERAL route — ' + question, R.classifyRoute([{ role: 'user', content: question }]), 'GEN');
    eq('GENERAL runtime — ' + question, ctx.runtime, 'GENERAL');
  }
  eq('stored fiqh route is religious because of its topic', contextFor(S, R, A, JOIN).runtime, 'STORED_FIQH');
  eq('named stored fiqh route is religious because of its topic', contextFor(S, R, A, BAZ_JOIN).runtime, 'STORED_FIQH');
  eq('Quran wins before generic fiqh', contextFor(S, R, A, 'اكتب آية الكرسي كاملة').runtime, 'LOCAL_QURAN');
  eq('hadith/takhrij wins before generic fiqh', contextFor(S, R, A, 'ما صحة حديث إنما الأعمال بالنيات؟').runtime, 'HADITH');
  eq('adhkar wins before generic fiqh', contextFor(S, R, A, 'أذكار الصباح').runtime, 'LOCAL_ADHKAR');

  console.log('\n--- B. CURRENT TURN CONTEXT ---');
  const carryThread = [
    { role: 'user', content: 'ما رأي ابن باز في الجمع بين الصلاتين؟' },
    { role: 'assistant', content: 'جواب سابق.' },
    { role: 'user', content: CONTINUATION },
  ];
  const carried = contextFor(S, R, A, CONTINUATION, carryThread);
  ok('direct explicit continuation may carry the preceding scholar', carried.carried && carried.resolvedScholar?.display === 'ابن باز');
  const standalone = contextFor(S, R, A, CONTINUATION);
  ok('the same turn standalone invents no scholar', !standalone.resolvedScholar && !standalone.carried);
  const switched = contextFor(S, R, A, STANCE, [
    { role: 'user', content: GENERAL[1] },
    { role: 'assistant', content: 'جواب عام.' },
    { role: 'user', content: STANCE },
  ]);
  ok('current person wins after a general topic switch', switched.resolvedScholar?.display === 'ابن تيمية' && !switched.carried);
  ok('old person is absent from the new query/topic', !JSON.stringify({
    scholar: switched.resolvedScholar, topic: switched.resolvedTopic, query: S.buildStoredSearchQuery(switched),
  }).includes('ستيف جوبز'));
  const goldSwitch = contextFor(S, R, A, GOLD, [
    { role: 'user', content: JOIN }, { role: 'assistant', content: 'جواب سابق.' }, { role: 'user', content: GOLD },
  ]);
  ok('fresh religious topic carries neither person nor prayer topic', !goldSwitch.carried
    && !S.buildStoredSearchQuery(goldSwitch).includes('جمع') && !S.buildStoredSearchQuery(goldSwitch).includes('مسافر'));
  const caseThread = [
    { role: 'user', content: 'ما رأي ابن باز في الجمع بين الصلاتين؟' },
    { role: 'assistant', content: 'جواب سابق.' },
    { role: 'user', content: 'في حالة المسافر الذي يحتاج الجمع؟' },
  ];
  const caseCarry = contextFor(S, R, A, 'في حالة المسافر الذي يحتاج الجمع؟', caseThread);
  ok('direct connected «في حالة…» may carry only the preceding scholar',
    caseCarry.carried && caseCarry.resolvedScholar?.display === 'ابن باز');

  console.log('\n--- C. RELEVANCE BEFORE ANSWER ---');
  async function recordBy(query, id) {
    const found = await E.searchStoredCorpus(query, { limit: 40 });
    return found.records.find((record) => record.id === id);
  }
  const joinRecord = await recordBy('الجمع الصلاتين المسافر الظهر العصر', 'F01173');
  const kinRecord = await recordBy('النسبية', 'F00042');
  const designRecord = await recordBy('التصميم', 'F02020');
  const disagreementRecord = await recordBy('اختلاف ابن تيمية أهل السنة والجماعة', 'F00137');
  const travelerRecord = await recordBy('جمع الصلاة المسافر الظهر العصر', 'F01852');
  ok('incident fixtures are authentic marked corpus records', [joinRecord, kinRecord, designRecord, disagreementRecord, travelerRecord].every(E.isStoredCorpusRecord));
  const ambiguousContext = contextFor(S, R, A, AMBIGUOUS_SUPPORTED);
  let ambiguousRetrievalCalls = 0;
  let ambiguousModelCalls = 0;
  const ambiguous = await S.runStoredFiqhTurn({
    context: ambiguousContext,
    retrieve: async () => { ambiguousRetrievalCalls++; return { records: [joinRecord] }; },
    generate: async () => { ambiguousModelCalls++; return '{}'; },
  });
  ok('two current people fail closed before retrieval/model without choosing either',
    ambiguousContext.ambiguousScholar === true && !ambiguousContext.resolvedScholar
      && ambiguous.outcome === 'NO_STORED_EVIDENCE' && ambiguous.text === NO_EVIDENCE
      && ambiguousRetrievalCalls === 0 && ambiguousModelCalls === 0
      && ambiguous.storedCorpusCalls === 0 && ambiguous.cards.length === 0);
  eq('relevant traveler-collection record is accepted by the general contract', S.assessStoredCandidate(joinRecord, contextFor(S, R, A, JOIN)).status, 'ACCEPT');
  eq('single incidental body word is not Einstein evidence', S.assessStoredCandidate(kinRecord, {
    ...contextFor(S, R, A, GENERAL[0]), resolvedDomain: 'DEEN', runtime: 'STORED_FIQH',
  }).status, 'REJECT');
  eq('single incidental body word is not design evidence', S.assessStoredCandidate(designRecord, {
    ...contextFor(S, R, A, GENERAL[1]), resolvedDomain: 'DEEN', runtime: 'STORED_FIQH',
  }).status, 'REJECT');
  eq('personal stance needs matching attributedTo in the same record', S.assessStoredCandidate(disagreementRecord, switched).status, 'REJECT');
  ok('top result is not automatically evidence', S.assessStoredCandidate(kinRecord, {
    ...contextFor(S, R, A, GENERAL[0]), resolvedDomain: 'DEEN', runtime: 'STORED_FIQH',
  }).reason !== 'TITLE_AND_LOCAL_TOPIC');

  const supportedContext = contextFor(S, R, A, BAZ_JOIN);
  const supported = await S.runStoredFiqhTurn({
    context: supportedContext,
    depth: 'normal',
    retrieve: async () => ({ records: [joinRecord], recordCount: EXPECTED_RECORDS }),
    generate: async (request) => claimDraft(request.payload.evidence_pack, request.payload.current_question),
  });
  ok('supported record produces an answer and its used-record card', supported.outcome === 'ANSWER'
    && supported.validatedUsedRecordIds.join(',') === 'F01173'
    && supported.cards.length === 1 && supported.cards[0].recordId === 'F01173');
  ok('general evidence is not attributed to the requested scholar', supported.text.startsWith('لا يوجد في مصادري المخزنة نص منسوب لابن باز')
    && !supported.text.includes('قال ابن باز'));
  ok('accepted Evidence Pack and used records are separately reported', supported.evidencePackIds.join(',') === 'F01173'
    && supported.validatedUsedRecordIds.join(',') === 'F01173');

  const answerabilityFalse = await S.runStoredFiqhTurn({
    context: contextFor(S, R, A, JOIN),
    retrieve: async () => ({ records: [travelerRecord], recordCount: EXPECTED_RECORDS }),
    answerabilityEvaluator: async () => ({ answerable: false, support_spans: [joinQuote(travelerRecord)] }),
    generate: async () => { throw new Error('answer model must not run'); },
  });
  ok('answerable=false is a silent no-evidence result', answerabilityFalse.outcome === 'NO_STORED_EVIDENCE'
    && answerabilityFalse.text === NO_EVIDENCE && answerabilityFalse.cards.length === 0
    && answerabilityFalse.modelCallsForReligiousAnswer === 0);
  const forged = await S.runStoredFiqhTurn({
    context: contextFor(S, R, A, JOIN),
    retrieve: async () => ({ records: [{ ...joinRecord }], recordCount: EXPECTED_RECORDS }),
    generate: async () => { throw new Error('forged record must be discarded'); },
  });
  ok('a forged record cannot enter the Evidence Pack or a card', forged.evidencePackIds.length === 0 && forged.cards.length === 0);

  console.log('\n--- D. EVIDENCE → CLAIM → SENTENCE ---');
  async function groundedCase(label, draftFor, predicate) {
    const out = await S.runStoredFiqhTurn({
      context: supportedContext,
      depth: 'normal',
      retrieve: async () => ({ records: [joinRecord], recordCount: EXPECTED_RECORDS }),
      generate: async (request) => draftFor(request.payload.evidence_pack, request.payload.current_question),
    });
    ok(label, predicate(out), JSON.stringify({ outcome: out.outcome, text: out.text, cards: out.cards }));
    return out;
  }
  await groundedCase('supported exact control remains natural', (pack, question) => claimDraft(pack, question),
    (out) => out.outcome === 'ANSWER' && out.text.includes('جاء في مادة') && out.cards.length === 1);
  await groundedCase('unsupported consensus sentence is rejected/rebuilt from evidence only', (pack, question) => claimDraft(pack, question, 'أجمع العلماء على وجوبه.'),
    (out) => out.outcome === 'ANSWER' && !out.text.includes('أجمع العلماء على وجوبه') && out.rejectedDraftSentences.length === 1);
  await groundedCase('mismatched scholar attribution is rejected', (pack, question) => claimDraft(pack, question, 'قال ابن باز: يجوز الجمع.'),
    (out) => out.outcome === 'ANSWER' && !out.text.includes('قال ابن باز'));
  await groundedCase('unsupported takhrij/narrator/grade is rejected', (pack, question) => claimDraft(pack, question, 'يجوز الجمع للمسافر، رواه البخاري ومسلم وصححه فلان.'),
    (out) => out.outcome === 'ANSWER' && !out.text.includes('رواه البخاري') && !out.text.includes('صححه'));
  await groundedCase('model-created source tag and URL are rejected', (pack, question) => claimDraft(pack, question, 'الحكم ثابت <source site="x">x</source> https://example.test/x'),
    (out) => out.outcome === 'ANSWER' && !out.text.includes('<source site="x"') && !out.text.includes('https://'));
  await groundedCase('record outside accepted pack is rejected', (pack) => JSON.stringify({ claims: [{ record_id: 'F99999', support_quote: 'الجمع بين الصلاتين للمسافر جائز', sentence: 'حكم' }] }),
    (out) => out.outcome === 'NO_STORED_EVIDENCE' && out.cards.length === 0);
  await groundedCase('forged support quote is rejected', (pack) => JSON.stringify({ claims: [{ record_id: pack[0].record_id, support_quote: 'الجمع بين الصلاتين للمسافر واجب بإجماع العلماء', sentence: 'حكم' }] }),
    (out) => out.outcome === 'NO_STORED_EVIDENCE' && out.cards.length === 0);
  await groundedCase('model saying the material is unrelated never becomes reader prose/card', () => 'المادة المسترجعة نفسها غير مرتبطة بالسؤال.',
    (out) => out.outcome === 'NO_STORED_EVIDENCE' && out.text === NO_EVIDENCE && out.cards.length === 0);

  console.log('\n--- E. REAL HANDLER, ROUTING/CONTEXT/MODES/SECURITY ---');
  process.env.ANTHROPIC_API_KEY = 'stored-suite-local-provider';
  process.env.FOUNDER_SECRET = 'stored-suite-founder-secret';
  process.env.RFC_V05_MODE = 'off';
  process.env.LEDGER_RAG = 'off';
  delete process.env.BRAVE_API_KEY;
  delete process.env.MODEL_STANDARD;
  delete process.env.MODEL_PREMIUM;
  const handler = (await esm('api/ask.js')).default;
  const harness = await createHandlerHarness(DAY, handler);
  try {
    for (const question of GENERAL) {
      const result = await harness.drive({ question });
      ok('real handler keeps general/creative question out of stored DEEN — ' + question,
        result.route?.route === 'GEN' && !result.stored && result.cards.length === 0
          && result.text !== NO_EVIDENCE && result.res.ended === 1,
        JSON.stringify({ route: result.route, stored: result.stored, text: result.text }));
    }

    const handlerSupported = await harness.drive({ question: JOIN });
    ok('real handler proves route/query/evidence/used/card for supported fiqh', handlerSupported.stored?.route === 'STORED_FIQH'
      && handlerSupported.stored.corpusCalls === 1
      && handlerSupported.stored.evidence.join(',') === 'F01173'
      && handlerSupported.stored.used.join(',') === 'F01173'
      && handlerSupported.cards.join(',') === 'F01173'
      && handlerSupported.res.ended === 1, JSON.stringify(handlerSupported.stored));
    ok('stored provider payload has only current resolved fields and accepted pack', (() => {
      const request = handlerSupported.providerRequests.find((body) => {
        try { return Array.isArray(JSON.parse(body.messages?.[0]?.content || '').evidence_pack); } catch { return false; }
      });
      if (!request) return false;
      const payload = JSON.parse(request.messages[0].content);
      return JSON.stringify(Object.keys(payload).sort()) === JSON.stringify([
        'current_question', 'evidence_pack', 'resolved_domain', 'resolved_scholar', 'resolved_topic',
      ].sort()) && payload.current_question === JOIN;
    })());

    const contextThread = [
      { role: 'user', content: GENERAL[1] }, { role: 'assistant', content: 'جواب عام.' }, { role: 'user', content: STANCE },
    ];
    for (let repeat = 0; repeat < 2; repeat++) {
      const thread = repeat ? [...contextThread, { role: 'assistant', content: NO_EVIDENCE }, { role: 'user', content: STANCE }] : contextThread;
      const result = await harness.drive({ question: STANCE, messages: thread });
      const exposed = JSON.stringify({ route: result.route, stored: result.stored, text: result.text,
        prompts: result.providerRequests, cards: result.cards });
      ok('real handler current scholar wins and stale general person is absent — repeat ' + (repeat + 1),
        result.stored?.resolvedScholar === 'ابن تيمية' && !exposed.includes('ستيف جوبز')
          && result.stored.evidence.length === 0 && result.stored.used.length === 0
          && result.stored.model === 0 && result.cards.length === 0 && result.text === NO_EVIDENCE,
        exposed);
    }

    const carry = await harness.drive({ question: CONTINUATION, messages: carryThread });
    ok('real handler carries preceding scholar only for direct explicit continuation', carry.stored?.resolvedScholar === 'ابن باز'
      && carry.stored.evidence.join(',') === 'F01173' && carry.text.includes('نص منسوب لابن باز')
      && !carry.text.includes('قال ابن باز') && carry.cards.join(',') === 'F01173');
    const alone = await harness.drive({ question: CONTINUATION });
    ok('real handler standalone continuation invents no scholar', alone.stored?.resolvedScholar === null
      && !alone.text.includes('ابن باز'));

    const ambiguousHandler = await harness.drive({ question: AMBIGUOUS_SUPPORTED });
    ok('real handler does not select a person or interrogate on current-turn ambiguity',
      ambiguousHandler.stored?.corpusCalls === 0 && ambiguousHandler.stored?.model === 0
        && ambiguousHandler.stored?.resolvedScholar === null && ambiguousHandler.cards.length === 0
        && ambiguousHandler.text === NO_EVIDENCE && !/أكثر من عالِم|خالد المصلح|خالد السبت/u.test(ambiguousHandler.text));

    const topicThread = [{ role: 'user', content: JOIN }, { role: 'assistant', content: 'جواب.' }, { role: 'user', content: GOLD }];
    const topicSwitch = await harness.drive({ question: GOLD, messages: topicThread, modelDraft: () => 'لا علاقة للمادة بالسؤال.' });
    ok('real handler topic switch carries no traveler record/topic/card', !String(topicSwitch.stored?.query || '').includes('جمع')
      && !(topicSwitch.stored?.evidence || []).includes('F01173') && !topicSwitch.cards.includes('F01173'));

    for (const question of ['اكتب آية الكرسي كاملة', 'ما صحة حديث إنما الأعمال بالنيات؟', 'أذكار الصباح']) {
      const special = await harness.drive({ question });
      ok('real handler specialised sacred path is not swallowed by stored fiqh — ' + question,
        !special.stored && special.cards.length === 0 && !special.text.includes('مادة جَمْعُ'),
        JSON.stringify({ stored: special.stored, text: special.text }));
    }

    const modeRows = [];
    for (const depth of ['brief', 'normal', 'deep', 'scholar']) {
      const hit = await harness.drive({ question: JOIN, depth });
      const miss = await harness.drive({ question: STANCE, depth });
      modeRows.push({ depth, hit, miss });
      ok('mode supported/no-evidence contracts are grounded — ' + depth, hit.stored?.evidence.join(',') === 'F01173'
        && hit.stored.used.join(',') === 'F01173' && hit.cards.join(',') === 'F01173'
        && miss.stored?.evidence.length === 0 && miss.stored.model === 0 && miss.cards.length === 0);
    }
    ok('all modes share query/evidence/relevance policy', new Set(modeRows.map((row) => JSON.stringify({
      query: row.hit.stored.query, evidence: row.hit.stored.evidence,
    }))).size === 1);
    ok('standard modes retain Sonnet and authorised premium modes retain Opus',
      modeRows[0].hit.tier.model === 'claude-sonnet-5' && modeRows[1].hit.tier.model === 'claude-sonnet-5'
      && modeRows[2].hit.tier.model === 'claude-opus-5' && modeRows[3].hit.tier.model === 'claude-opus-5');
    const forgedPremium = await harness.drive({ question: JOIN, depth: 'scholar', founder: false });
    ok('forged premium remains blocked server-side', forgedPremium.tier.usePremium === false
      && forgedPremium.tier.model === 'claude-sonnet-5');
    const storedRows = [handlerSupported, carry, alone, ...modeRows.flatMap((row) => [row.hit, row.miss])];
    const publicSourceTargets = storedRows.flatMap((row) => row.fetchTargets)
      .filter((target) => !String(target).includes('api.anthropic.com') && String(target) !== '/pipeline');
    const storedNetworkMetrics = storedRows.map((row) => ({
      publicSearch: row.stored?.publicSearch,
      publicFetch: row.stored?.publicFetch,
      adapters: row.stored?.adapters,
    }));
    ok('explicit LEDGER_RAG=off brake keeps the local fallback network-free', storedNetworkMetrics
      .every((metrics) => metrics.publicSearch === 0 && metrics.publicFetch === 0 && metrics.adapters === 0)
        && publicSourceTargets.length === 0,
    JSON.stringify({ publicSourceTargets, storedNetworkMetrics }));
  } finally {
    harness.restore();
  }

  console.log('\n--- F. REQUIRED MUTANTS ---');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-stored-mutants-'));
  try {
    const m1 = await storedMutant(temp, 'named-person-domain', (source) => source.replace(
      "const plannedReligious = !!(plan && ['fatwa', 'tafsir', 'hadith'].includes(plan.purpose));",
      "if (/^(?:ما\\s+(?:هو\\s+)?(?:راي|قول))/u.test(folded)) return 'STORED_FIQH';\n  const plannedReligious = !!(plan && ['fatwa', 'tafsir', 'hadith'].includes(plan.purpose));",
    ));
    ok('MUTANT 1 KILLED: generic named-person cannot force DEEN', m1.classifyReligiousRuntime(GENERAL[0], currentPlan(A, GENERAL[0]), 'GEN') !== 'GENERAL');

    const m2 = await routeMutant(temp, 'scan-old-turns', (source) => source.replace(
      "const previous = users[users.length - 2];\n    if (previous && isReligiousText(textOf(previous))) return 'DEEN';",
      "for (const previous of users.slice(0, -1)) if (isReligiousText(textOf(previous))) return 'DEEN';",
    ));
    const oldScanThread = [{ role: 'user', content: JOIN }, { role: 'user', content: GENERAL[2] }, { role: 'user', content: 'طيب' }];
    ok('MUTANT 2 KILLED: scanning older user turns revives stale DEEN', R.classifyRoute(oldScanThread) === 'GEN' && m2.classifyRoute(oldScanThread) === 'DEEN');

    const m3 = await storedMutant(temp, 'previous-person-wins', (source) => source.replace(
      'let resolvedScholar = currentPerson;',
      "let resolvedScholar = previousQuestion ? personFromPlan(planAsk([{ role: 'user', content: previousQuestion }], { policyEnabled: true })) : currentPerson;",
    ));
    const personThread = [{ role: 'user', content: GENERAL[1] }, { role: 'user', content: STANCE }];
    const m3ctx = m3.resolveStoredContext(personThread, { currentPlan: currentPlan(A, STANCE), lexicalRoute: 'DEEN' });
    ok('MUTANT 3 KILLED: previous person cannot override current person', m3ctx.resolvedScholar?.display !== switched.resolvedScholar?.display);

    const m4 = await storedMutant(temp, 'raw-history-prompt', (source) => source.replace(
      'payload: {\n      current_question: context.currentQuestion,',
      'payload: {\n      raw_history: context.rawHistory,\n      current_question: context.currentQuestion,',
    ));
    const historyProbe = { ...supportedContext, rawHistory: GENERAL[1] };
    const cleanPayload = S.buildStoredAnswerRequest(historyProbe, [{ record: joinRecord }], 'normal').payload;
    const dirtyPayload = m4.buildStoredAnswerRequest(historyProbe, [{ record: joinRecord }], 'normal').payload;
    ok('MUTANT 4 KILLED: raw history cannot enter evidence prompt', !JSON.stringify(cleanPayload).includes(GENERAL[1]) && JSON.stringify(dirtyPayload).includes(GENERAL[1]));

    const m5 = await storedMutant(temp, 'accept-top-one', (source) => source.replace(
      "if (relevance.status === 'ACCEPT') accepted.push({ record, relevance, answerabilitySpans: [] });",
      "if (accepted.length === 0 || relevance.status === 'ACCEPT') accepted.push({ record, relevance, answerabilitySpans: [] });",
    ));
    const falseContext = { ...contextFor(S, R, A, GENERAL[0]), resolvedDomain: 'DEEN', runtime: 'STORED_FIQH' };
    const m5out = await m5.runStoredFiqhTurn({ context: falseContext, retrieve: async () => ({ records: [kinRecord] }), generate: async () => 'unrelated' });
    ok('MUTANT 5 KILLED: always-accept-top-1 creates a false Evidence Pack', m5out.evidencePackIds.length === 1);

    const m6 = await storedMutant(temp, 'append-first-card', (source) => source.replace(
      'if (!record || !used.has(record.id) || !isStoredCorpusRecord(record)) continue;',
      'if (!record || !isStoredCorpusRecord(record)) continue;',
    ));
    const originalCards = S.storedSourceCards([{ record: joinRecord }, { record: travelerRecord }], [joinRecord.id]);
    const mutantCards = m6.storedSourceCards([{ record: joinRecord }, { record: travelerRecord }], [joinRecord.id]);
    ok('MUTANT 6 KILLED: first accepted record cannot be appended unless used', originalCards.length === 1 && mutantCards.length === 2);

    const m7 = await storedMutant(temp, 'card-on-unanswerable', (source) => source.replace(
      'verdict && verdict.answerable === true && Array.isArray(verdict.support_spans)',
      'verdict && verdict.answerable === false && Array.isArray(verdict.support_spans)',
    ));
    const borderlineQuote = exactSentence(travelerRecord.text, 'خصائص السفر:');
    const m7out = await m7.runStoredFiqhTurn({
      context: contextFor(S, R, A, JOIN), retrieve: async () => ({ records: [travelerRecord] }),
      answerabilityEvaluator: async () => ({ answerable: false, support_spans: [borderlineQuote] }),
      generate: async () => 'unrelated',
    });
    ok('MUTANT 7 KILLED: answerable=false cannot admit evidence/card lifecycle', m7out.evidencePackIds.length === 1);

    const m8 = await storedMutant(temp, 'model-source-url', (source) => source.replace(
      "const body = validation.valid.map((claim) => sentenceFromSupport(claim.record, claim.quote)).join('\\n\\n');",
      "const body = lastRaw + '\\n\\n' + validation.valid.map((claim) => sentenceFromSupport(claim.record, claim.quote)).join('\\n\\n');",
    ));
    const sourceDraft = (pack, question) => claimDraft(pack, question, 'https://forged.example/source');
    const m8out = await m8.runStoredFiqhTurn({ context: supportedContext, retrieve: async () => ({ records: [joinRecord] }), generate: async (request) => sourceDraft(request.payload.evidence_pack, request.payload.current_question) });
    ok('MUTANT 8 KILLED: model-created source/URL reaches reader only under mutant', m8out.text.includes('https://forged.example'));

    const m9 = await storedMutant(temp, 'bypass-grounding', (source) => source.replace(
      'const quote = exactSupport(entry.record, claim.support_quote);',
      "const quote = String(claim.support_quote || '').trim();",
    ));
    const forgedQuote = 'الجمع بين الصلاتين للمسافر واجب بإجماع العلماء';
    const m9out = await m9.runStoredFiqhTurn({ context: contextFor(S, R, A, JOIN), retrieve: async () => ({ records: [joinRecord] }), generate: async () => JSON.stringify({ claims: [{ record_id: joinRecord.id, support_quote: forgedQuote, sentence: '' }] }) });
    ok('MUTANT 9 KILLED: bypassing claim grounding emits forged support', m9out.text.includes(forgedQuote));

    const m10 = await storedMutant(temp, 'unsupported-takhrij', (source) => source
      .replace('valid.push({ record: entry.record, quote, draftRejected: badDraft });', 'valid.push({ record: entry.record, quote, draftRejected: badDraft, draftSentence: String(claim.sentence || \'\') });')
      .replace("const body = validation.valid.map((claim) => sentenceFromSupport(claim.record, claim.quote)).join('\\n\\n');", "const body = validation.valid.map((claim) => claim.draftSentence || sentenceFromSupport(claim.record, claim.quote)).join('\\n\\n');"));
    const badTakhrijDraft = (pack, question) => claimDraft(pack, question, 'يجوز الجمع للمسافر. رواه البخاري ومسلم وصححه فلان.');
    const m10out = await m10.runStoredFiqhTurn({ context: supportedContext, retrieve: async () => ({ records: [joinRecord] }), generate: async (request) => badTakhrijDraft(request.payload.evidence_pack, request.payload.current_question) });
    ok('MUTANT 10 KILLED: unsupported takhrij appears only when grounding output is bypassed', m10out.text.includes('رواه البخاري ومسلم'));

    function exactGateSet(names) { return JSON.stringify(names) === JSON.stringify(EXPECTED_GATES) && names.length === 81; }
    ok('ORIGINAL_GATE_SET_MATCH', exactGateSet(EXPECTED_GATES));
    ok('MUTANT 11 KILLED: deleting namepresence breaks the exact 81-name contract', !exactGateSet(EXPECTED_GATES.filter((name) => name !== 'namepresence')));
    ok('MUTANT 12 KILLED: deleting guardhonesty breaks the exact 81-name contract', !exactGateSet(EXPECTED_GATES.filter((name) => name !== 'guardhonesty')));

    const m13 = await storedMutant(temp, 'fiqh-before-special', (source) => source.replace(
      "if (QURAN_REQUEST.test(folded)) return 'LOCAL_QURAN';",
      "if (lexicalRoute === 'DEEN') return 'STORED_FIQH';\n  if (QURAN_REQUEST.test(folded)) return 'LOCAL_QURAN';",
    ));
    ok('MUTANT 13 KILLED: generic fiqh before Quran/hadith/adhkar changes specialised policy', [
      'اكتب آية الكرسي كاملة', 'ما صحة حديث إنما الأعمال بالنيات؟', 'أذكار الصباح',
    ].every((question) => m13.classifyReligiousRuntime(question, currentPlan(A, question), 'DEEN') === 'STORED_FIQH'));

    const m14 = await storedMutant(temp, 'public-fallthrough', (source) => source.replace(
      'export async function runStoredFiqhTurn(options = {}) {',
      'export async function runStoredFiqhTurn(options = {}) {\n  await options.publicSearch?.();\n  await options.publicFetch?.();\n  await options.externalAdapter?.();',
    ));
    const publicCounts = { search: 0, fetch: 0, adapter: 0 };
    await m14.runStoredFiqhTurn({ context: contextFor(S, R, A, STANCE), retrieve: async () => ({ records: [] }),
      publicSearch: async () => { publicCounts.search++; }, publicFetch: async () => { publicCounts.fetch++; }, externalAdapter: async () => { publicCounts.adapter++; } });
    ok('MUTANT 14 KILLED: the explicit local brake cannot acquire public I/O', JSON.stringify(publicCounts) === JSON.stringify({ search: 1, fetch: 1, adapter: 1 }));

    const m15 = await storedMutant(temp, 'mode-evidence-policy', (source) => source.replace(
      'const accepted = selection.accepted.slice(0, MAX_EVIDENCE_RECORDS);',
      "const accepted = options.depth === 'scholar' ? selection.accepted.slice(1, MAX_EVIDENCE_RECORDS) : selection.accepted.slice(0, MAX_EVIDENCE_RECORDS);",
    ));
    const duplicated = async () => ({ records: [joinRecord, joinRecord] });
    const m15brief = await m15.runStoredFiqhTurn({ context: contextFor(S, R, A, JOIN), depth: 'brief', retrieve: duplicated, generate: async () => 'unrelated' });
    const m15scholar = await m15.runStoredFiqhTurn({ context: contextFor(S, R, A, JOIN), depth: 'scholar', retrieve: duplicated, generate: async () => 'unrelated' });
    ok('MUTANT 15 KILLED: mode-specific evidence policy breaks parity', JSON.stringify(m15brief.evidencePackIds) !== JSON.stringify(m15scholar.evidencePackIds));

    const corpusClone = JSON.parse(JSON.stringify(beforeRecords));
    corpusClone.push({ id: 'MUTANT', part: 0, term: 'mutant', search: 'mutant', snippet: 'mutant' });
    const cloneBuffer = Buffer.from(JSON.stringify(corpusClone), 'utf8');
    ok('MUTANT 16 KILLED: altering a corpus clone breaks count/hash', corpusClone.length !== EXPECTED_RECORDS && sha(cloneBuffer) !== EXPECTED_HASH);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  console.log('\n--- F2. PUBLIC HYBRID CONTRACT ---');
  const hybrid = await require('./hybrid-live-fatwa-guard.cjs').runHybridGuard();
  ok('public DEEN hybrid sub-suite and its major-gate mutants are green', hybrid.failures === 0,
    JSON.stringify(hybrid));

  console.log('\n--- G. POST-RUN FREEZE ---');
  const afterBuffer = fs.readFileSync(CORPUS);
  eq('CORPUS_RECORDS_AFTER', JSON.parse(zlib.gunzipSync(afterBuffer).toString('utf8')).length, EXPECTED_RECORDS);
  eq('CORPUS_SHA256_AFTER', sha(afterBuffer), EXPECTED_HASH);
  ok('SOURCE_DATA_FILES_CHANGED=0', beforeBuffer.equals(afterBuffer));

  console.log(`\n=== stored-DEEN sub-suite: ${checks - failures}/${checks} — ${failures ? 'FAIL' : 'PASS'} ===`);
  return { checks, failures };
}

module.exports = { runStoredDeenSubSuite: runSuite };

if (require.main === module) {
  runSuite().then(({ failures: count }) => { process.exitCode = count ? 1 : 0; })
    .catch((error) => { console.error(error && error.stack || error); process.exitCode = 1; });
}
