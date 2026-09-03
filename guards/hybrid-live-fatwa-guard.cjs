// Offline integration and mutation battery for the ordinary religious answer path.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'lib', 'data', 'fiqh-search.json.gz');
const LIVENESS = path.join(ROOT, 'data', 'source-liveness.json');
const WORSHIP_DISPLAY = path.join(ROOT, 'worship-display.json');
const X021_FIXTURE = path.join(ROOT, 'guards', 'fixtures', 'honesty', 'x021-fatwa-telemetry.json');
const CORPUS_HASH = 'c094d1267110224794a123858d062d1ab068aa3735d7422887154c6dc1111993';
const LIVENESS_HASH = '75b88f5c092eea8ae5e4198a33203e99dd136e06581d8b69bf7dc1037322aa4d';
const WORSHIP_DISPLAY_HASH = '9b05584742fa701e76309a0b4ae68e44178a81876e417fd973c46bbadd4a3d8e';
const SALAH_ADULT_TEXT_HASH = '7687019965bf142259cdc7660af8c32a211cdb1455f5f479f2a40db8c5a0eba2';
// Re-cut in semantic round B after CLAIMS_AUDIT/د's production-smoke values were copied into the
// formerly-null production field. The seal is on the whole file, so it changes whenever the
// fixture does -- which is the point: no one edits this fixture without the seal saying so.
const X021_FIXTURE_HASH = 'af39f7a0c755f3275e491a815dee49a5790fae574181f8ab622f10686dc34b77';
const D2_CASE_QUESTIONS = Object.freeze([
  'كيف يصلي المريض الذي لا يستطيع القيام؟',
  'ما كيفية صلاة الخوف عند اشتداد القتال؟',
  'ما صفة صلاة الجنازة؟',
  'ما طريقة صلاة الاستخارة؟',
  'علمني ما يفعل المسبوق إذا أدرك الركعة الأخيرة من الصلاة.',
  'علميني الفرق بين غسل الجنابة وغسل الجمعة.',
  'اشرح لي متى ينتقض الوضوء.',
  'ما خطوات سجود السهو في الصلاة؟',
  'أخبرني عن عدد ركعات صلاة الوتر.',
  'في الصلاة، من شك، كم ركعة يبني عليها؟',
  'في صلاة الضحى، كم عدد ركعاتها؟',
  'ما هي شروط الصلاة؟',
  'ماهي سنن الوضوء؟',
  'ما هو وقت صلاة العصر؟',
  'ماهو الفرق بين الغسل والوضوء؟',
  'اعطني شروط التيمم عند فقد الماء.',
  'هات أدلة المسح على الخفين في الوضوء.',
  'اذكر لي مبطلات الصلاة.',
  'اريد معرفة ما يفعله من نسي ركعة من الصلاة.',
]);
let checks = 0, failures = 0;
function ok(name, condition, detail = '') {
  checks++;
  if (condition) console.log('  PASS  ' + name);
  else { failures++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));
}
const esm = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function contextFor(S, R, A, question, messages) {
  const thread = messages || [{ role: 'user', content: question }];
  const current = [{ role: 'user', content: question }];
  return S.resolveStoredContext(thread, {
    currentPlan: A.planAsk(current, { policyEnabled: true }),
    lexicalRoute: R.classifyRoute(thread),
  });
}

function fatwaEvidence(overrides = {}) {
  return {
    id: 'fatwa:binbaz:10965', kind: 'fatwa_service', title: 'بيان القول في جمع وقصر الصلاة',
    url: 'https://binbaz.org.sa/fatwas/10965/x', publisher: 'ابن باز',
    authorityId: 'ibn-baz', scholarId: 'binbaz', directAttribution: true,
    contentMode: 'written_fatwa',
    supportText: 'المسافر يباح له الجمع بين الصلاتين عند الحاجة، والأفضل للنازل ترك الجمع.',
    passage: 'المسافر يباح له الجمع بين الصلاتين عند الحاجة، والأفضل للنازل ترك الجمع.',
    score: 95, ...overrides,
  };
}

function liveResult(passage = 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.') {
  return { sources: [{
    title: 'الجمع بين الصلاتين للمسافر', url: 'https://islamweb.net/ar/fatwa/121485/x',
    passage, answerFormat: 'text',
  }] };
}

function markLive(diagnostics, result = liveResult()) {
  diagnostics.search.planned++;
  diagnostics.search.completed++;
  diagnostics.pages.attempted++;
  diagnostics.pages.completed++;
  return result;
}

function modelUsing(id, quote, sentence = quote) {
  return async () => JSON.stringify({ comparison: 'direct comparison completed', claims: [{
    evidence_id: id, support_quote: quote, claim: sentence, sentence,
  }] });
}
const verifyIds = (...ids) => async () => JSON.stringify({ supported_ids: ids });
const budget = { reserve: async () => ({ ok: true }), snapshot: () => ({ configured: true, limit: 7, reservedThisRequest: 1 }) };

function importableModule(source, directory) {
  return source.replace(/from\s+(['"])(\.\/[^'"]+)\1/gu, (_all, quote, specifier) =>
    `from ${quote}${pathToFileURL(path.resolve(directory, specifier)).href}${quote}`);
}

function importableLibModule(source) {
  return importableModule(source, path.join(ROOT, 'lib'));
}

async function moduleMutant(temp, relative, name, mutate) {
  const absolute = path.join(ROOT, relative);
  const original = fs.readFileSync(absolute, 'utf8');
  const ready = importableModule(original, path.dirname(absolute));
  const changed = mutate(ready);
  if (changed === ready) throw new Error(relative + ' mutation seam moved: ' + name);
  const file = path.join(temp, name + '.mjs');
  fs.writeFileSync(file, changed, 'utf8');
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

async function mutant(temp, name, mutate) {
  const original = fs.readFileSync(path.join(ROOT, 'lib', 'hybrid-deen.js'), 'utf8');
  const ready = importableLibModule(original);
  const changed = mutate(ready);
  if (changed === ready) throw new Error('hybrid mutation seam moved: ' + name);
  const file = path.join(temp, name + '.mjs');
  fs.writeFileSync(file, changed, 'utf8');
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

async function fatwaServiceMutant(temp, name, mutate) {
  const original = fs.readFileSync(path.join(ROOT, 'lib', 'fatwa-service.js'), 'utf8');
  const ready = importableLibModule(original);
  const changed = mutate(ready);
  if (changed === ready) throw new Error('fatwa-service mutation seam moved: ' + name);
  const file = path.join(temp, name + '.mjs');
  fs.writeFileSync(file, changed, 'utf8');
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

function recordedFatwaTransport(fixture, requests) {
  return async (input, init = {}) => {
    const url = input instanceof URL ? input : new URL(String(input));
    const payload = fixture.responses[url.pathname];
    requests.push({ method: String(init.method || 'GET'), pathname: url.pathname, search: url.search });
    if (!payload) throw new Error('unsealed-fatwa-path:' + url.pathname);
    const body = JSON.stringify(payload);
    return {
      ok: true,
      status: 200,
      url: url.href,
      headers: { get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return 'application/json; charset=utf-8';
        if (key === 'content-length') return String(Buffer.byteLength(body, 'utf8'));
        return null;
      } },
      text: async () => body,
    };
  };
}

function requestsFor(requests, pathname) {
  return requests.filter((entry) => entry.pathname === pathname);
}

async function runHybridGuard() {
  console.log('\n=== hybrid-live-fatwa — three paths, grounding, degradation and mutants ===');
  const corpusBefore = fs.readFileSync(CORPUS);
  const livenessBefore = fs.readFileSync(LIVENESS);
  const [H, S, R, A, BQ, FC, FSVC, RET, CLOSED, W, SW, CG, RT] = await Promise.all([
    esm('lib/hybrid-deen.js'), esm('lib/stored-deen.js'), esm('lib/route-classify.js'),
    esm('lib/ask-plan.js'), esm('lib/brave-query.js'), esm('lib/fatwa-contract.js'),
    esm('lib/fatwa-service.js'), esm('lib/retrieve.js'), esm('lib/closed-deen.js'),
    esm('lib/world-intent.js'), esm('lib/finalized-sse-writer.js'),
    esm('lib/policy/consistency-gate.js'),
    esm('lib/policy/referral-tail.js'),
  ]);
  const JOIN = 'ما حكم الجمع بين الصلاتين للمسافر؟';
  const BAZ = 'ما رأي ابن باز في الجمع بين الصلاتين للمسافر؟';
  const joinContext = contextFor(S, R, A, JOIN);
  const bazContext = contextFor(S, R, A, BAZ);

  console.log('\n--- ROUTER AND CURRENT TURN ---');
  for (const q of ['ما رأي أينشتاين في النسبية؟', 'ما الفرق بين الخرسانة المسلحة وسابقة الإجهاد؟']) {
    const c = contextFor(S, R, A, q);
    ok('router-first keeps GENERAL out of DEEN — ' + q, c.runtime === 'GENERAL');
  }
  ok('a precise attributed GENERAL position gets general live verification, never DEEN',
    W.classifyWorldIntent('ما رأي أينشتاين في النسبية؟').reason === 'ATTRIBUTED_POSITION'
      && W.classifyWorldIntent('ما الفرق بين الخرسانة المسلحة وسابقة الإجهاد؟').world === false);
  const sourcedEinstein = 'بحسب ويكيبيديا، يرى العالم أينشتاين أن النسبية تصف العلاقة بين المكان والزمان.';
  const unlicensedEinstein = CG.consistencyProblems(sourcedEinstein, {
    entity: 'أينشتاين', subjectEntity: 'أينشتاين', notDirectlyVerified: true,
    searchProven: true, identityVerified: true, allowSourcedPosition: true,
  });
  const licensedEinstein = CG.consistencyProblems(sourcedEinstein, {
    entity: 'أينشتاين', subjectEntity: 'أينشتاين', notDirectlyVerified: true,
    searchProven: true, identityVerified: true, allowSourcedPosition: true,
    licensedEntitySurfaces: ['أينشتاين'],
  });
  ok('a fetched full page licenses only the exact non-roster public figure surface',
    unlicensedEinstein.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED)
      && !licensedEinstein.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED)
      && !licensedEinstein.includes(CG.PROBLEM.POSITION_WITHOUT_EVIDENCE));
  const forgedGeneralCard = 'جواب عام آمن. <source site="evil.example" url="https://evil.example/x">مزور</source> تتمة.';
  eq('model-owned GENERAL source markup is removed while prose survives',
    SW.stripUnownedSourceCards(forgedGeneralCard), 'جواب عام آمن.  تتمة.');
  ok('MUTANT killed: leaving a model-owned GENERAL card would expose unverified markup',
    forgedGeneralCard.includes('<source') && !SW.stripUnownedSourceCards(forgedGeneralCard).includes('<source'));
  const generalWrites = [];
  const generalTarget = {
    headersSent: true,
    write(chunk, encoding, callback) {
      generalWrites.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
      if (typeof encoding === 'function') encoding(); else callback?.();
      return true;
    },
    end(callback) { callback?.(); }, once() {}, removeListener() {},
  };
  const generalWriter = SW.createFinalizedSseResponse(generalTarget, {
    failureText: 'SAFE-FAIL',
    context: ({ events }) => {
      const filter = R.createSourceFilter();
      let strippedWireText = '';
      for (const event of events) {
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
          strippedWireText += filter.push(event.delta.text);
        }
      }
      strippedWireText += filter.end();
      return { allowWireOwnedCards: false, stripUnownedSourceCards: true, strippedWireText };
    },
    finalize: ({ text }) => ({ ok: !text.includes('<source'), text }),
  });
  const generalFrame = (event) => `data: ${JSON.stringify(event)}\n\n`;
  generalWriter.write([
    { type: 'message_start', message: { role: 'assistant' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: forgedGeneralCard } },
    { type: 'content_block_stop', index: 0 }, { type: 'message_stop' },
  ].map(generalFrame).join(''));
  generalWriter.end();
  const generalVisible = generalWrites.join('').split(/\r?\n/u).filter((line) => line.startsWith('data:'))
    .map((line) => { try { return JSON.parse(line.slice(5)); } catch { return null; } })
    .filter((event) => event?.type === 'content_block_delta').map((event) => event.delta.text).join('');
  ok('central SSE writer preserves ordinary GENERAL prose while removing an unowned card',
    generalVisible === 'جواب عام آمن.  تتمة.' && !generalVisible.includes('SAFE-FAIL'));
  const thinkingWrites = [];
  const thinkingTarget = {
    headersSent: true,
    write(chunk, encoding, callback) {
      thinkingWrites.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
      if (typeof encoding === 'function') encoding(); else callback?.();
      return true;
    },
    end(callback) { callback?.(); }, once() {}, removeListener() {},
  };
  const thinkingWriter = SW.createFinalizedSseResponse(thinkingTarget, {
    failureText: 'SAFE-FAIL', finalize: ({ text }) => ({ ok: true, text }),
  });
  thinkingWriter.write([
    { type: 'message_start', message: { role: 'assistant' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hidden' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'signed' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'جواب هندسي مباشر.' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
    { type: 'message_delta', delta: {}, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ].map(generalFrame).join(''));
  thinkingWriter.end();
  const thinkingWire = thinkingWrites.join('');
  const thinkingVisible = thinkingWire.split(/\r?\n/u).filter((line) => line.startsWith('data:'))
    .map((line) => { try { return JSON.parse(line.slice(5)); } catch { return null; } })
    .filter((event) => event?.type === 'content_block_delta').map((event) => event.delta.text || '').join('');
  ok('adaptive-thinking lifecycle is accepted but hidden blocks never reach the reader',
    thinkingVisible === 'جواب هندسي مباشر.' && !thinkingWire.includes('thinking_delta')
      && !thinkingWire.includes('signature_delta') && !thinkingWire.includes('SAFE-FAIL'));
  const closedFixtures = [
    ['اكتب آية الكرسي كاملة', '<verse surah_num="2" ayah="255"></verse>'],
    ['ما صحة حديث إنما الأعمال بالنيات؟', '<hadith narrator="عمر بن الخطاب رضي الله عنه"'],
    ['أذكار الصباح', '<dhikr id="27"></dhikr>'],
    ['كيف أتوضأ؟', '<worship id="wudu"></worship>'],
  ];
  for (const [q, marker] of closedFixtures) {
    const c = contextFor(S, R, A, q);
    ok('closed specialised route bypasses hybrid — ' + q, c.runtime !== 'STORED_FIQH');
    const out = CLOSED.runClosedDeenTurn(c);
    ok('closed route is complete local output with zero retrieval — ' + q, out && out.text.includes(marker)
      && out.storedCorpusCalls === 0 && out.fatwaSearchCalls === 0
      && out.braveSearchCalls === 0 && out.livePageFetchCalls === 0
      && out.modelCallsForReligiousAnswer === 0 && !out.text.includes('<source'), JSON.stringify(out));
  }

  const worshipDisplayBuffer = fs.readFileSync(WORSHIP_DISPLAY);
  const worshipDisplay = JSON.parse(worshipDisplayBuffer.toString('utf8'));
  ok('D-2 frozen worship display bytes are unchanged',
    sha(worshipDisplayBuffer) === WORSHIP_DISPLAY_HASH);
  const localWorshipFixtures = [
    ['salah', 'كيف أصلي؟'],
    ['wudu', 'كيف أتوضأ؟'],
    ['ghusl', 'ما صفة الغسل؟'],
    ['tayammum', 'كيف أتيمم؟'],
  ];
  for (const [id, question] of localWorshipFixtures) {
    const context = contextFor(S, R, A, question);
    const out = CLOSED.runClosedDeenTurn(context);
    const rawTag = `<worship id="${id}"></worship>`;
    const adult = worshipDisplay.cells?.[id + ':adult']?.text || '';
    const young = worshipDisplay.cells?.[id + ':young']?.text || '';
    ok('D-2 general ' + id + ' description keeps the exact local routing token',
      context.runtime === 'LOCAL_WORSHIP' && out?.text === rawTag);
    ok('D-2 general ' + id + ' token resolves to non-empty frozen reader text in both bands',
      adult.length > rawTag.length && young.length > rawTag.length
        && [...adult].length !== 30 && [...young].length !== 30);
  }
  ok('D-2 generic prayer reaches today\'s adult description byte-for-byte',
    [...worshipDisplay.cells['salah:adult'].text].length === 2244
      && sha(Buffer.from(worshipDisplay.cells['salah:adult'].text, 'utf8')) === SALAH_ADULT_TEXT_HASH);

  const d2Rows = D2_CASE_QUESTIONS.map((question, index) => {
    const context = contextFor(S, R, A, question);
    const out = CLOSED.runClosedDeenTurn(context);
    return { id: index + 1, question, context, out };
  });
  for (const row of d2Rows) {
    ok('D-2 XC-10/' + String(row.id).padStart(2, '0') + ' continues to the ordinary brain path',
      RT.isFrozenWorshipQuestion(row.question) === false
        && row.context.runtime === 'STORED_FIQH' && row.out === null);
  }
  ok('D-2 all nineteen derived cases produce zero 30-character worship answers',
    d2Rows.every((row) => !row.out || [...row.out.text].length !== 30));
  const switched = contextFor(S, R, A, 'هل خالف ابن تيمية أهل السنة والجماعة؟', [
    { role: 'user', content: 'ما رأي ستيف جوبز في التصميم؟' }, { role: 'assistant', content: 'جواب.' },
    { role: 'user', content: 'هل خالف ابن تيمية أهل السنة والجماعة؟' },
  ]);
  ok('current-turn-wins: Steve Jobs does not enter current topic/query', switched.runtime === 'STORED_FIQH'
    && !JSON.stringify(switched).includes('ستيف جوبز') && switched.resolvedTopic.includes('ابن تيم'));
  ok('answerable sparse fiqh is routed to hybrid', contextFor(S, R, A, 'هل النقاب واجب؟').runtime === 'STORED_FIQH');
  ok('sparse named fiqh is routed to hybrid', contextFor(S, R, A, 'ما رأي ابن عثيمين فيمن أسقطت دون ثمانين يومًا؟').runtime === 'STORED_FIQH');

  console.log('\n--- ORDERED SOURCE TIERS AND USED-CARD LIFECYCLE ---');
  const f = fatwaEvidence();
  const events = [];
  const localEmpty = async () => {
    events.push('local:start');
    await Promise.resolve();
    events.push('local:end');
    return { storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] };
  };
  const integrated = await H.runHybridDeenTurn({
    context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: localEmpty,
    fatwaSearch: async () => { events.push('fatwa:start'); await Promise.resolve(); events.push('fatwa:end'); return {
      calls: 1, verification: { status: 'OK', scholars: 18, total: 73130, ibnBaz: 18479, failures: [] }, records: [f],
    }; },
    liveRetrieve: async (_q, opts) => { events.push('brave:start'); await Promise.resolve(); events.push('brave:end'); return markLive(opts.diagnostics); },
    generate: modelUsing(f.id, f.supportText), verify: verifyIds(f.id),
  });
  // OWNER ORDER 2026-08-15: the fatwa service leads. When it answers, the local encyclopedia
  // is not consulted at all — so storedCorpusCalls is 0 here, where it used to be 1. That is
  // the amendment working, not a regression: a published fatwa with a citable scholar and URL
  // outranks an unattributed encyclopedia paragraph, and there is no reason to fetch the
  // weaker source once the stronger one has spoken.
  ok('authored adapter unit: ordinary DEEN stops after the reported fatwa result',
    integrated.storedCorpusCalls === 0 && integrated.fatwaSearchCalls === 1
      && integrated.braveSearchCalls === 0 && integrated.livePageFetchCalls === 0,
    JSON.stringify(integrated));
  eq('source tiers run in strict fatwa -> local order and stop before Brave', events,
    ['fatwa:start', 'fatwa:end']);
  eq('only evidence used by a sentence receives a card', integrated.cards.map((card) => card.evidenceId), [f.id]);
  eq('used evidence is separately observable', integrated.validatedUsedEvidenceIds, [f.id]);
  ok('authored adapter unit: verification fields propagate structurally', integrated.fatwaValidation.status === 'OK'
    && integrated.fatwaValidation.scholars === 18 && integrated.fatwaValidation.total === 73130
    && integrated.fatwaValidation.ibnBaz === 18479);

  console.log('\n--- X-021 OBSERVED FATWA REQUEST TELEMETRY ---');
  const x021Bytes = fs.readFileSync(X021_FIXTURE);
  eq('X-021 offline response fixture has its full-file seal', sha(x021Bytes), X021_FIXTURE_HASH);
  const x021 = JSON.parse(x021Bytes.toString('utf8'));
  // MERGE ROUND: the service was reached on the deployed merge preview, so the honest statement is
  // no longer "blocked" but "observed, and it agrees". The assertion therefore checks the AGREEMENT
  // -- an observed response whose counts differ from the counts this fixture authored offline would
  // mean the offline accounting had drifted from the shipped service, which is the whole point of
  // measuring it. Semantic round B fills the production half from the sealed publish report.
  const x021seen = x021.externalEvidence.currentServiceResponse;
  ok('X-021 the current service was observed on a named deployment and agrees with the offline counts',
    x021.externalEvidence.status === 'OBSERVED_PREVIEW'
      && x021.externalEvidence.acceptanceGreen === true
      && x021seen !== null
      && /^dpl_[A-Za-z0-9]+$/.test(x021seen.deploymentId || '')
      && /^[0-9a-f]{40}$/.test(x021seen.deployedGitSha || '')
      && Array.isArray(x021seen.requests) && x021seen.requests.length > 0
      && x021seen.fatwaStatus === 'OK'
      && x021seen.scholars === x021.expected.scholars
      && x021seen.total === x021.expected.total
      && x021seen.ibnBaz === x021.expected.ibnBaz
      && x021seen.fatwaSearch === x021.expected.returnedSearchCalls);
  const x021Production = x021.externalEvidence.production;
  ok('X-021 the production publish smoke is recorded and agrees with the offline counts',
    x021Production !== null
      && x021Production.budgetEnvironment === 'production'
      && x021Production.fatwaStatus === 'OK'
      && x021Production.scholars === x021.expected.scholars
      && x021Production.total === x021.expected.total
      && x021Production.ibnBaz === x021.expected.ibnBaz
      && x021Production.deploymentId === 'dpl_7no8tbAGwnsVnde11xsmwzmJSeFH'
      && /48618485/u.test(x021.externalEvidence.productionReason || ''));
  eq('X-021 production shorthand matches CLAIMS_AUDIT/د',
    `${x021Production.scholars}/${x021Production.total}/${x021Production.ibnBaz} · ${x021Production.fatwaStatus}`,
    '18/73130/18479 · OK');
  ok('X-021 MUTANT KILLED: an observed response that disagrees with the offline counts cannot pass',
    !(x021seen.scholars === x021.expected.scholars && x021seen.total === x021.expected.total - 1));
  const telemetryContext = {
    currentQuestion: 'offline telemetry query',
    resolvedTopic: 'offline telemetry query',
  };
  const adapterRequests = [];
  const adapterResult = await FSVC.searchFatwas(telemetryContext, {
    fetchImpl: recordedFatwaTransport(x021, adapterRequests),
    force: true,
  });
  eq('X-021 production adapter drives the sealed verification and search paths',
    adapterRequests.map((entry) => entry.pathname),
    [...x021.expected.verificationRequestPaths, x021.expected.searchRequestPath]);
  ok('X-021 production adapter sends only GET requests',
    adapterRequests.every((entry) => entry.method === 'GET'));
  const observedAdapterSearches = requestsFor(adapterRequests, x021.expected.searchRequestPath).length;
  eq('X-021 adapter call metric equals observed search endpoint requests',
    adapterResult.calls, observedAdapterSearches);
  eq('X-021 adapter observed the independently declared search count',
    observedAdapterSearches, x021.expected.searchRequests);
  ok('X-021 real verification result carries the sealed contract totals',
    adapterResult.verification.status === 'OK'
      && adapterResult.verification.scholars === x021.expected.scholars
      && adapterResult.verification.total === x021.expected.total
      && adapterResult.verification.ibnBaz === x021.expected.ibnBaz);

  const coordinatorRequests = [];
  const coordinatorResult = await H.runHybridDeenTurn({
    context: telemetryContext,
    band: 'adult',
    depth: 'normal',
    dailyBudget: budget,
    fetchImpl: recordedFatwaTransport(x021, coordinatorRequests),
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    liveRetrieve: async () => ({ sources: [] }),
    generate: async () => { throw new Error('model memory disabled'); },
    verify: verifyIds(),
  });
  const observedCoordinatorSearches = requestsFor(coordinatorRequests, x021.expected.searchRequestPath).length;
  eq('X-021 cached verification leaves the coordinator one observed search request',
    coordinatorRequests.map((entry) => entry.pathname), [x021.expected.searchRequestPath]);
  ok('X-021 coordinator propagates the real adapter request count',
    coordinatorResult.outcome === 'NO_HYBRID_EVIDENCE'
      && coordinatorResult.fatwaSearchCalls === observedCoordinatorSearches
      && coordinatorResult.externalSourceAdapterCalls === observedCoordinatorSearches
      && observedCoordinatorSearches === x021.expected.returnedSearchCalls,
    JSON.stringify(coordinatorResult));

  const x021Temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-x021-mutants-'));
  try {
    const falseCountService = await fatwaServiceMutant(x021Temp, 'false-fatwa-count', (src) => src.replace(
      'calls: queries.length,', 'calls: queries.length + 1, // mutant: falsified telemetry'));
    const falseCountRequests = [];
    const falseCountResult = await falseCountService.searchFatwas(telemetryContext, {
      fetchImpl: recordedFatwaTransport(x021, falseCountRequests),
      force: true,
    });
    const falseCountObserved = requestsFor(falseCountRequests, x021.expected.searchRequestPath).length;
    ok('X-021 MUTANT 1 KILLED: a falsified returned count disagrees with observed search requests',
      falseCountObserved === x021.expected.searchRequests
        && falseCountResult.calls !== falseCountObserved);

    const bypassCoordinator = await mutant(x021Temp, 'fatwa-count-bypass', (src) => src.replace(
      'fatwaSearchCalls: Number(fatwaResult?.calls || 0),',
      'fatwaSearchCalls: 0, // mutant: coordinator propagation bypassed'));
    const bypassRequests = [];
    const bypassResult = await bypassCoordinator.runHybridDeenTurn({
      context: telemetryContext,
      band: 'adult',
      depth: 'normal',
      dailyBudget: budget,
      fetchImpl: recordedFatwaTransport(x021, bypassRequests),
      localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
      liveRetrieve: async () => ({ sources: [] }),
      generate: async () => { throw new Error('model memory disabled'); },
      verify: verifyIds(),
    });
    const bypassObserved = requestsFor(bypassRequests, x021.expected.searchRequestPath).length;
    ok('X-021 MUTANT 2 KILLED: bypassing coordinator propagation loses the observed count',
      bypassObserved === x021.expected.searchRequests
        && coordinatorResult.fatwaSearchCalls === bypassObserved
        && bypassResult.fatwaSearchCalls !== bypassObserved);
  } finally {
    fs.rmSync(x021Temp, { recursive: true, force: true });
  }

  const duplicateSupport = 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة. والجمع بين الصلاتين للمسافر رخصة عند الحاجة.';
  const duplicateEvidence = fatwaEvidence({ supportText: duplicateSupport, passage: duplicateSupport });
  const duplicateUse = await H.runHybridDeenTurn({
    context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [duplicateEvidence] }),
    liveRetrieve: async (_q, opts) => markLive(opts.diagnostics, { sources: [] }),
    generate: async () => JSON.stringify({ comparison: 'same source, two supported sentences', claims: [
      { evidence_id: duplicateEvidence.id, support_quote: 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.', claim: 'الجواز عند الحاجة', sentence: 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.' },
      { evidence_id: duplicateEvidence.id, support_quote: 'الجمع بين الصلاتين للمسافر رخصة عند الحاجة.', claim: 'الرخصة عند الحاجة', sentence: 'الجمع بين الصلاتين للمسافر رخصة عند الحاجة.' },
    ] }), verify: verifyIds(duplicateEvidence.id),
  });
  ok('two sentences from one evidence item produce one used id and one card',
    duplicateUse.validatedUsedEvidenceIds.length === 1 && duplicateUse.cards.length === 1,
    JSON.stringify({ used: duplicateUse.validatedUsedEvidenceIds, cards: duplicateUse.cards }));

  const namedEvents = [];
  await H.runHybridDeenTurn({
    context: bazContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: async () => ({ storedCorpusCalls: 0, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => { namedEvents.push('fatwa:start'); await Promise.resolve(); namedEvents.push('fatwa:end'); return { calls: 1, records: [f] }; },
    liveRetrieve: async (_q, opts) => { namedEvents.push('live:start'); namedEvents.push('live:end'); return markLive(opts.diagnostics, { sources: [] }); },
    generate: modelUsing(f.id, f.supportText), verify: verifyIds(f.id),
  });
  eq('named scholar uses the exact fatwa id and stops before paid live search', namedEvents,
    ['fatwa:start', 'fatwa:end']);

  console.log('\n--- DEGRADATION IS NOT CLARIFICATION ---');
  const common = {
    context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: (opts) => S.retrieveStoredFiqhEvidence(opts),
    generate: async () => { throw new Error('fixture synthesis unavailable'); },
    verify: async () => '{"supported_ids":[]}',
  };
  let closedBraveCalls = 0;
  const braveDown = await H.runHybridDeenTurn({ ...common,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    dailyBudget: { reserve: async () => ({ ok: false, reason: 'day_cap_reached' }),
      snapshot: () => ({ lastReason: 'day_cap_reached' }) },
    fatwaSearch: async () => ({ calls: 1, records: [f] }),
    liveRetrieve: async () => { closedBraveCalls++; throw new Error('Brave must stay closed'); },
  });
  ok('fatwa evidence answers while Brave is experimentally day-cap closed', braveDown.outcome === 'ANSWER'
    && closedBraveCalls === 0 && braveDown.braveSearchCalls === 0
    && !/وضح|حدد|NEEDS_QUALIFIER/u.test(braveDown.text));
  const fatwaDown = await H.runHybridDeenTurn({ ...common,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => { throw new Error('fatwa_offline'); },
    liveRetrieve: async (_q, opts) => markLive(opts.diagnostics),
  });
  ok('fatwa-only failure still answers from local/live evidence', fatwaDown.outcome === 'ANSWER'
    && fatwaDown.degraded.some((x) => x.startsWith('fatwa:')));
  let skippedRemoteCalls = 0;
  const bothDown = await H.runHybridDeenTurn({ ...common,
    fatwaSearch: async () => { skippedRemoteCalls++; throw new Error('fatwa_offline'); },
    liveRetrieve: async () => { skippedRemoteCalls++; throw new Error('429'); },
  });
  // OWNER ORDER 2026-08-15: the fatwa service is tried FIRST, so eligible local evidence can
  // no longer prevent it from being invoked — it is the tier above, not below. What local
  // evidence still prevents is the PAID tier. Hence exactly one skipped remote call (the
  // failed fatwa attempt) and zero Brave, where this used to assert zero of both.
  ok('eligible local evidence prevents the paid live path after the fatwa tier fails',
    bothDown.outcome === 'ANSWER'
    && bothDown.storedCorpusCalls === 1 && skippedRemoteCalls === 1
    && bothDown.braveSearchCalls === 0
    && bothDown.degraded.some((x) => x.startsWith('fatwa:'))
    && !/وضح|حدد|هل تقصد|NEEDS_QUALIFIER/u.test(bothDown.text), JSON.stringify(bothDown.degraded));
  const noReference = await H.runHybridDeenTurn({ context: contextFor(S, R, A, 'ما حكمه؟') });
  ok('empty reference states absence without a follow-up question', noReference.outcome === 'REFERENCE_ABSENT'
    && noReference.cards.length === 0 && !/[؟?]/u.test(noReference.text));

  console.log('\n--- RELEVANCE, ATTRIBUTION, TRANSCRIPT AND DISAGREEMENT ---');
  const miscarriage = contextFor(S, R, A, 'ما رأي ابن عثيمين فيمن أسقطت دون ثمانين يومًا؟');
  const unrelated = FSVC.__fatwaTest.normalizeRecord({
    id: 5700, uid: 'binothaimeen:5700', title: 'تفسير آيات من سورة العلق',
    scholar: { id: 'binothaimeen' }, source: { canonicalUrl: 'https://binothaimeen.net/content/5700' },
    content: { type: 'question_answer', question: 'ما تفسير سورة العلق؟', answer: 'ورد ذكر خلق الجنين.' },
  }, miscarriage);
  ok('an unrelated high result is rejected before the Evidence Pack', unrelated === null);
  const fridayCollision = FSVC.__fatwaTest.normalizeRecord({
    id: 1930, uid: 'salmajed:7144', title: 'حكم شهود الجمعة والجماعة للمسافر إذا كان نازلا في بلد',
    scholar: { id: 'salmajed' }, source: { canonicalUrl: 'https://salmajed.com/fatawa/getFatwaById/1930' },
    content: { type: 'question_answer', question: 'هل تلزم الجمعة المسافر النازل؟', answer: 'المسافر لا تلزمه الجمعة في هذه الصورة.' },
  }, joinContext);
  ok('whole-token relevance rejects الجمعة as evidence for الجمع بين الصلاتين', fridayCollision === null);
  const local = (await S.retrieveStoredFiqhEvidence({ context: joinContext })).accepted[0];
  const localPack = [{
    id: `local:${local.record.id}`, kind: 'local_encyclopedia', title: local.record.term,
    publisher: local.record.publisher, url: '', authorityId: '', directAttribution: false,
    contentMode: 'stored_fiqh_record', supportText: local.record.text, passage: local.record.text,
    score: 80, localEntry: local,
  }];
  const localQuote = H.__hybridTest.fallbackQuote(localPack[0], joinContext);
  const forgedAttribution = H.validateHybridClaims(JSON.stringify({ claims: [{
    evidence_id: localPack[0].id, support_quote: localQuote, claim: 'نسبة',
    sentence: 'قال ابن باز إن الجمع بين الصلاتين للمسافر جائز.',
  }] }), localPack, joinContext);
  ok('a scholar attribution without his direct evidence is rejected', forgedAttribution.valid.length === 0);

  const questionOnlyEvidence = {
    id: 'live:https://islamqa.info/ar/answers/fixture', kind: 'live_page',
    title: 'هل يجوز الجمع بين الصلاتين للمسافر؟', publisher: 'الإسلام سؤال وجواب',
    url: 'https://islamqa.info/ar/answers/fixture', authorityId: '', directAttribution: false,
    contentMode: 'written_page', score: 70,
    supportText: 'هل يجوز الجمع بين الصلاتين للمسافر؟ يجوز الجمع بين الصلاتين للمسافر عند الحاجة والمشقة في السفر.',
    passage: 'هل يجوز الجمع بين الصلاتين للمسافر؟ يجوز الجمع بين الصلاتين للمسافر عند الحاجة والمشقة في السفر.',
  };
  const questionOnlyClaim = H.validateHybridClaims(JSON.stringify({ claims: [{
    evidence_id: questionOnlyEvidence.id,
    support_quote: 'هل يجوز الجمع بين الصلاتين للمسافر؟',
    claim: 'سؤال مطابق', sentence: 'هل يجوز الجمع بين الصلاتين للمسافر؟',
  }] }), [questionOnlyEvidence], joinContext);
  const answerableFallback = H.__hybridTest.fallbackQuote(questionOnlyEvidence, joinContext);
  ok('MUTANT killed: a matching question heading cannot masquerade as an answer or earn a card',
    questionOnlyClaim.valid.length === 0 && !H.__hybridTest.isQuestionOnlyQuote(answerableFallback)
      && answerableFallback.includes('يجوز الجمع'));

  const veil = contextFor(S, R, A, 'هل النقاب واجب؟');
  const veilOpposition = H.__hybridTest.liveEvidence({ sources: [{
    title: 'حكم النقاب والأدلة في ستر الوجه',
    url: 'https://www.islamweb.net/ar/fatwa/8287/حكم-النقاب', answerFormat: 'text',
    passage: 'مذهب أبي حنيفة ومالك أن تغطية الوجه والكفين غير واجبة، بل مستحبة، وتجب عند خوف الفتنة.',
  }] }, veil);
  // §8 FIXTURE, NOT A BRANCH. veilStances() was a per-topic detector in runtime code and is
  // gone. What this now proves is the thing §8 actually requires: the GENERAL stance reader
  // reaches the veil case unaided. «غير واجبة» must read as a permission and not — via the
  // «واجب» inside it — as an obligation, which is the trap the hand-written detector existed
  // to dodge for this one topic and the general one dodges for every topic.
  ok('واجبة/واجب are one exact ruling family without reverting to substring relevance',
    veilOpposition.length === 1 && H.__hybridTest.stancesIn(veilOpposition[0].supportText).permit,
    JSON.stringify(veilOpposition));
  ok('§8: the general stance reader covers the veil case with no veil-specific code',
    H.__hybridTest.stancesIn('تغطية الوجه غير واجبة، بل مستحبة').permit === true
      && H.__hybridTest.stancesIn('تغطية الوجه غير واجبة، بل مستحبة').forbid === false
      && H.__hybridTest.stancesIn('ستر الوجه واجب على المرأة').forbid === true
      && H.__hybridTest.coversDisagreement(
        'النقاب واجب عند الجمهور، وذهب آخرون إلى أنه غير واجب') === true);
  // NON-MIRROR PAIR, because a boundary that only ever says «no» is indistinguishable from
  // deleting the word. «كبيرة» is the one member of the prohibition family that is a proper
  // substring of an unrelated prayer word, so it must FAIL inside «تكبيرة» and still FIRE on
  // its own — and a permission sentence that merely mentions the takbir must come back with
  // one stance, not the forged pair that made coversDisagreement() report a خلاف.
  ok('«تكبيرة» is not a كبيرة: the prohibition family does not match inside another stem',
    H.__hybridTest.stancesIn('تكبيرة الركوع').forbid === false,
    JSON.stringify(H.__hybridTest.stancesIn('تكبيرة الركوع')));
  ok('«كبيرة» still reads as a prohibition standing alone and behind the article',
    H.__hybridTest.stancesIn('هذه كبيرة من الكبائر').forbid === true
      && H.__hybridTest.stancesIn('حكم مرتكب الكبيرة').forbid === true);
  ok('a permission that names the takbir yields one stance, not a forged disagreement',
    H.__hybridTest.stancesIn('يجوز رفع اليدين مع تكبيرة الركوع').permit === true
      && H.__hybridTest.stancesIn('يجوز رفع اليدين مع تكبيرة الركوع').forbid === false
      && H.__hybridTest.coversDisagreement('يجوز رفع اليدين مع تكبيرة الركوع') === false);
  const transcript = FSVC.__fatwaTest.normalizeRecord({
    id: 1336, uid: 'aljasser:1336', title: 'أرى النقاب واجبًا وأمي تمنعني',
    scholar: { id: 'aljasser' }, source: { canonicalUrl: 'https://youtube.com/watch?v=fixture' },
    content: { type: 'auto_transcript_official_video', question: 'هل النقاب واجب؟', answer: 'النقاب واجب في هذه الصورة بحسب نص المقطع.' },
  }, veil);
  ok('Mutlaq result is normalized as transcript_official_video, never written_fatwa', transcript
    && transcript.contentMode === 'transcript_official_video' && transcript.actualContentType === 'auto_transcript_official_video');

  const viewA = { ...fatwaEvidence({ id: 'fatwa:aladawy:1', url: 'https://mostafaaladwy.com/fatwa/1/x',
    publisher: 'مصطفى العدوي', authorityId: 'mostafa-aladwy', supportText: 'النقاب واجب على المرأة.', passage: 'النقاب واجب على المرأة.', score: 90 }) };
  const viewB = { ...fatwaEvidence({ id: 'fatwa:meshhoor:2', url: 'https://meshhoor.com/fatwa/2',
    publisher: 'مشهور آل سلمان', authorityId: 'meshhoor-al-salman', supportText: 'النقاب ليس واجبًا عند قول معتبر، والمسألة خلافية.', passage: 'النقاب ليس واجبًا عند قول معتبر، والمسألة خلافية.', score: 89 }) };
  const veilLiveQueries = [];
  const conflict = await H.runHybridDeenTurn({
    context: veil, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [viewA, viewB] }),
    liveRetrieve: async (q, opts) => { veilLiveQueries.push(q); return markLive(opts.diagnostics, { sources: [] }); },
    generate: async () => JSON.stringify({ comparison: 'خلاف معتبر', claims: [
      { evidence_id: viewA.id, support_quote: viewA.supportText, claim: viewA.supportText, sentence: viewA.supportText },
      { evidence_id: viewB.id, support_quote: viewB.supportText, claim: viewB.supportText, sentence: viewB.supportText },
    ] }), verify: verifyIds(viewA.id, viewB.id),
  });
  ok('documented disagreement is surfaced with both real source cards', conflict.outcome === 'ANSWER'
    && conflict.text.includes('واجب') && conflict.text.includes('ليس واجبًا') && conflict.cards.length === 2);
  const conflictFallback = await H.runHybridDeenTurn({
    context: veil, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [viewA, viewB] }),
    liveRetrieve: async (_q, opts) => markLive(opts.diagnostics, { sources: [] }),
    generate: async () => JSON.stringify({ comparison: 'mutant: one side only', claims: [
      { evidence_id: viewA.id, support_quote: viewA.supportText, claim: viewA.supportText, sentence: viewA.supportText },
    ] }), verify: verifyIds(viewA.id),
  });
  ok('one-sided veil synthesis cannot erase disagreement already present in the Evidence Pack',
    conflictFallback.outcome === 'ANSWER' && conflictFallback.text.includes('واجب')
      && conflictFallback.text.includes('ليس واجبًا') && conflictFallback.cards.length === 2,
    JSON.stringify({ text: conflictFallback.text, cards: conflictFallback.cards }));

  const veilForms = [
    'النقاب', 'تغطية وجه المرأة', 'ستر وجه المرأة', 'كشف وجه المرأة',
    'حكم الوجه والكفين', 'هل النقاب واجب؟', 'حكم تغطية وجه المرأة',
  ];
  ok('all required face-veil phrasings resolve to one retrieval topic',
    veilForms.every((form) => S.canonicalStoredTopic(form) === 'هل النقاب واجب'));
  // §8 FIXTURE: the two-query veil expansion in fatwa-service.js is DELETED. It was a per-topic
  // branch — the only topic in the product that got a second, hand-written query — and this
  // assertion used to pin it. What replaces it is the general rule, proven twice below: the
  // service now sends the canonical topic and nothing bespoke, and the disagreement-seeking
  // expansion comes from liveQueries for ANY ruling question.
  eq('the fatwa service no longer special-cases the veil topic',
    FSVC.__fatwaTest.searchQueriesFor(veil), ['هل النقاب واجب']);
  ok('§8: the disagreement expansion is general — the veil case gets it with no veil code',
    H.__hybridTest.liveQueries(veil).length === 2
      && /خلاف/u.test(H.__hybridTest.liveQueries(veil)[1]));
  {
    // The proof that it generalises: a topic that never had a branch of its own, and never
    // would have got one, receives exactly the same treatment.
    const insurance = contextFor(S, R, A, 'ما حكم التأمين التجاري؟');
    ok('§8: a topic that never had a branch gets the same disagreement expansion',
      H.__hybridTest.liveQueries(insurance).length === 2
        && /خلاف/u.test(H.__hybridTest.liveQueries(insurance)[1]));
  }

  const publishedVeilDisagreement = fatwaEvidence({
    id: 'fatwa:aladawy:1054', title: 'هل النقاب واجب أم مستحب ؟',
    url: 'https://mostafaaladwy.com/fatwa/1054/x', publisher: 'مصطفى العدوي',
    authorityId: 'mostafa-aladwy', scholarId: 'aladawy',
    supportText: 'الشيخ: والله يا أختي النقاب في وجوبه قولان مشهوران للعلماء: القول الأول: وجوب تغطية الوجه، والثاني: جواز كشفه إذا لم تكن هناك فتنة. وأنا أختار القول الأول لإقامة الدليل عليه ألا وهو: أن النقاب يجب، فالنقاب واجب فيما أختاره، والله أعلم.',
    passage: 'الشيخ: والله يا أختي النقاب في وجوبه قولان مشهوران للعلماء: القول الأول: وجوب تغطية الوجه، والثاني: جواز كشفه إذا لم تكن هناك فتنة. وأنا أختار القول الأول لإقامة الدليل عليه ألا وهو: أن النقاب يجب، فالنقاب واجب فيما أختاره، والله أعلم.',
  });
  const closedBudget = {
    reserve: async () => ({ ok: false, reason: 'day_cap_reached' }),
    snapshot: () => ({ configured: true, environment: 'preview', lastReason: 'day_cap_reached' }),
  };
  for (const question of ['هل النقاب واجب؟', 'حكم تغطية وجه المرأة']) {
    const questionContext = contextFor(S, R, A, question);
    let liveCalls = 0;
    const result = await H.runHybridDeenTurn({
      context: questionContext, band: 'adult', depth: 'normal', dailyBudget: closedBudget,
      localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
      fatwaSearch: async () => ({
        calls: 2, queries: ['هل النقاب واجب؟', 'حكم تغطية وجه المرأة'],
        verification: { status: 'OK', scholars: 18, total: 73130, ibnBaz: 18479, failures: [] },
        records: [publishedVeilDisagreement],
      }),
      liveRetrieve: async () => { liveCalls++; throw new Error('Brave must remain closed'); },
      generate: async () => { throw new Error('model memory disabled'); },
      verify: async () => '{"supported_ids":[]}',
    });
    // fatwaSearchCalls stays 2 here: this case's `fatwaSearch` is a STUB that reports calls:2
    // of its own, so the number measures the fixture and not the deleted veil branch. The one
    // substantive change is the coverage helper — `coversDisagreement` is the general reader,
    // where this used to call the veil-specific `veilStances`.
    ok(question + ' returns documented disagreement from fatwa service with Brave closed',
      result.outcome === 'ANSWER' && result.fatwaSearchCalls === 2
        && result.fatwaValidation?.status === 'OK' && result.braveSearchCalls === 0 && liveCalls === 0
        && H.__hybridTest.coversDisagreement(result.text)
        && !/وضح|حدد|هل تقصد|NEEDS_QUALIFIER/u.test(result.text), JSON.stringify(result));
    eq(question + ' used evidence exactly equals its source cards',
      result.validatedUsedEvidenceIds, result.cards.map((card) => card.evidenceId));
    eq(question + ' uses only the qualifying published fatwa',
      result.validatedUsedEvidenceIds, ['fatwa:aladawy:1054']);
  }

  const goldContext = contextFor(S, R, A, 'ما حكم بيع الذهب بالتقسيط؟');
  const goldSupport = 'شراء الذهب بالتقسيط بعملة ورقية حرام ولا يجوز؛ لأن بيع الذهب بالنقد يشترط فيه التقابض في العقد قبل التفرق.';
  const goldEvidence = fatwaEvidence({
    id: 'fatwa:binothaimeen:9405', title: 'حكم شراء الذهب بالتقسيط',
    url: 'https://binothaimeen.net/ar/voice_library/lessonDetails/gold', publisher: 'ابن عثيمين',
    authorityId: 'ibn-uthaymeen', scholarId: 'binothaimeen', supportText: goldSupport, passage: goldSupport,
  });
  const goldClarity = await H.runHybridDeenTurn({
    context: goldContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [goldEvidence] }),
    liveRetrieve: async (_q, opts) => markLive(opts.diagnostics, { sources: [] }),
    generate: async () => JSON.stringify({ claims: [{
      evidence_id: goldEvidence.id,
      support_quote: 'لأن بيع الذهب بالنقد يشترط فيه التقابض في العقد قبل التفرق.',
      claim: 'التقابض شرط', sentence: 'التقابض شرط.',
    }] }), verify: verifyIds(goldEvidence.id),
  });
  ok('a ruling answer cannot stop at a reason while omitting the explicit ruling',
    goldClarity.outcome === 'ANSWER' && H.__hybridTest.statesRuling(goldClarity.text)
      && /حرام|لا يجوز/u.test(goldClarity.text), goldClarity.text);

  const broadJoinContext = contextFor(S, R, A, 'ما حكم الجمع بين الصلاتين؟');
  const broadJoinSupport = [
    'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.',
    'ويجوز الجمع بين الصلاتين بسبب المطر بشروطه.',
    'ويجوز للمريض الجمع بين الصلاتين إذا لحقته مشقة.',
  ].join(' ');
  const broadJoinEvidence = fatwaEvidence({ supportText: broadJoinSupport, passage: broadJoinSupport });
  const broadJoin = await H.runHybridDeenTurn({
    context: broadJoinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [broadJoinEvidence] }),
    liveRetrieve: async (_q, opts) => markLive(opts.diagnostics, { sources: [] }),
    generate: async () => JSON.stringify({ claims: [{
      evidence_id: broadJoinEvidence.id,
      support_quote: 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.',
      claim: 'يجوز للمسافر الجمع', sentence: 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.',
    }] }), verify: verifyIds(broadJoinEvidence.id),
  });
  ok('an unqualified common ruling covers multiple documented basic forms without clarification',
    broadJoin.outcome === 'ANSWER' && /مسافر/u.test(broadJoin.text) && /المطر/u.test(broadJoin.text)
      && !/وضح|حدد|هل تقصد|NEEDS_QUALIFIER/u.test(broadJoin.text) && broadJoin.cards.length === 1,
    JSON.stringify({ text: broadJoin.text, outcome: broadJoin.outcome, cards: broadJoin.cards,
      traveller: /مسافر/u.test(broadJoin.text), rain: /المطر/u.test(broadJoin.text),
      clarification: /وضح|حدد|هل تقصد|NEEDS_QUALIFIER/u.test(broadJoin.text) }));
  eq('qualified fatwa disagreement prevents every paid veil query', veilLiveQueries, []);

  console.log('\n--- BRAVE, HOST/FETCH AND SERVER-ONLY PROXY CONTRACTS ---');
  const planned = BQ.planQueries('سؤال '.repeat(200), RET.SITES_ADULT);
  ok('every Brave query is <=380 chars and <=45 words', planned.groups.length > 0 && planned.groups.every((g) => {
    const m = BQ.measureQuery(g.q); return m.chars <= 380 && m.words <= 45;
  }), JSON.stringify(planned.groups.map((g) => BQ.measureQuery(g.q))));
  const blockedLive = H.__hybridTest.liveEvidence({ sources: [{
    title: 'الجمع بين الصلاتين', url: 'https://al-badr.net/posts/1',
    passage: 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.', answerFormat: 'text',
  }] }, joinContext);
  const evilLive = H.__hybridTest.liveEvidence({ sources: [{
    title: 'الجمع بين الصلاتين', url: 'https://islamweb.net.evil.example/fatwa/1',
    passage: 'يجوز للمسافر الجمع بين الصلاتين عند الحاجة.', answerFormat: 'text',
  }] }, joinContext);
  ok('post-search evidence gate rejects deferred and look-alike domains', blockedLive.length === 0 && evilLive.length === 0);
  const retrieveSource = fs.readFileSync(path.join(ROOT, 'lib', 'retrieve.js'), 'utf8');
  const safeFetchSource = fs.readFileSync(path.join(ROOT, 'lib', 'ledger', 'safe-fetch.js'), 'utf8');
  ok('final redirect host is rechecked against the same allow-list', /hostAllowed\(finalHost, allowSites\)/u.test(retrieveSource));
  ok('live fetch enforces HTTPS/allow-list/DNS/manual redirects and bounded timeout',
    retrieveSource.includes('safeFetch(url, {') && retrieveSource.includes("u.protocol === 'https:'")
    && retrieveSource.includes('admitUrl: admittedPageUrl') && retrieveSource.includes('DEFAULT_FETCH_TIMEOUT_MS = 8000')
    && safeFetchSource.includes("redirect: 'manual'") && safeFetchSource.includes('checkHostAddresses')
    && safeFetchSource.includes('redirect-off-caller-scope'));
  ok('Brave Answers is absent; only Brave web search API is wired', retrieveSource.includes('api.search.brave.com/res/v1/web/search')
    && !/brave[^\n]{0,30}answers|api\.search\.brave\.com\/res\/v1\/answers/iu.test(retrieveSource));
  // ITEM 32: the browser contract ships in app.jsx now; index.html only loads the bundle built
  // from it. readShippedClient throws if the page ships no JSX it can find, so a missing source
  // is a named failure and never an empty string every assertion below would be satisfied by.
  const indexSource = require('../tools/babel-block.cjs').readShippedClient(path.join(ROOT, 'index.html'));
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  ok('fatwa browser contract is same-origin and contains no second-service URL', indexSource.includes("const EZIK_FATWA_API_BASE = ''")
    && !indexSource.includes('https://ezik-fatwas.vercel.app'));
  ok('the unchanged /api/v1/* UI contract rewrites to the server proxy', vercel.rewrites.some((r) =>
    r.source === '/api/v1/:path*' && r.destination === '/api/fatwa-proxy?path=:path*'));
  eq('fatwa pinned corpus contract', FC.fatwaContractTotals(), { scholars: 18, total: 73130, ibnBaz: 18479 });
  ok('fatwa service base is the one authorised origin', FC.FATWA_BASE === 'https://ezik-fatwas.vercel.app');

  console.log('\n--- TEXT/CALL PARITY AND NO-CLARIFICATION WIRING ---');
  ok('text and call both default to /api/ask', /endpoint = '\/api\/ask'/u.test(indexSource));
  ok('the client fast bypass is off', indexSource.includes('const FAST_CHANNEL_ENABLED = false;'));
  const askSource = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
  const engineSource = fs.readFileSync(path.join(ROOT, 'lib', 'ledger', 'engine.js'), 'utf8');
  ok('public ordinary DEEN dynamically invokes the hybrid coordinator', askSource.includes("await import('../lib/hybrid-deen.js')")
    && askSource.includes('if (toLedger)'));
  ok('router-first handler limits Ledger to unresolved HADITH after local closed answers',
    askSource.includes("runClosedDeenTurn(storedContext)")
    && askSource.includes("ledgerPath.path === 'ledger' && storedContext.runtime === 'HADITH'"));
  ok('GENERAL strips unowned model cards but keeps the answer, and attributed positions use world search',
    askSource.includes('stripUnownedSourceCards: finalizerContext.allowWireOwnedCards === false')
      && askSource.includes("worldIntent.reason === 'ATTRIBUTED_POSITION'"));
  ok('MUTANT killed: an attributed GENERAL position cannot fall through to model memory after a live miss',
    /if \(worldIntent\.reason === 'ATTRIBUTED_POSITION' && !worldPass\) \{[\s\S]{0,500}لن أنسب إليه قولًا من الذاكرة/u.test(askSource));
  ok('Ledger records a missing qualifier but does not early-return a follow-up', engineSource.includes('REJECTION.QUALIFIER_MISSING')
    && !engineSource.includes("return finish({ outcome: 'SAFE_REJECTION', text: followUpText(plan)"));

  console.log('\n--- MAJOR-GATE MUTANTS ---');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-hybrid-mutants-'));
  try {
    const mWorshipCapture = await moduleMutant(temp, 'lib/policy/referral-tail.js',
      'worship-case-recapture', (src) => src.replace(
        '  if (!GENERAL_WORSHIP_DESCRIPTION.test(shape)) return false; // GENERAL_WORSHIP_DESCRIPTION_GATE',
        '  if (false && !GENERAL_WORSHIP_DESCRIPTION.test(shape)) return false; // mutant: broad manner capture'));
    const recaptured = D2_CASE_QUESTIONS.filter((question) =>
      mWorshipCapture.isFrozenWorshipQuestion(question)).length;
    ok('D-2 MUTANT KILLED: the old broad manner condition recaptures all nineteen case questions',
      D2_CASE_QUESTIONS.every((question) => !RT.isFrozenWorshipQuestion(question))
        && recaptured === D2_CASE_QUESTIONS.length);

    const mEmptyWorship = await moduleMutant(temp, 'lib/closed-deen.js',
      'worship-empty-tag', (src) => src.replace(
        '<worship id="salah"></worship>', '<worship id="missing"></worship>'));
    const mutantTag = mEmptyWorship.__closedDeenTest.worshipAnswer('كيف أصلي؟')?.text || '';
    const mutantId = /<worship\s+id="([^"]+)"/u.exec(mutantTag)?.[1] || '';
    ok('D-2 MUTANT KILLED: a worship tag with no frozen content cannot pass as an answer',
      !!worshipDisplay.cells['salah:adult']?.text
        && !worshipDisplay.cells[mutantId + ':adult']?.text);

    const mCards = await mutant(temp, 'unused-card', (src) => src.replace(
      'const usedEvidence = [];',
      'const usedEvidence = pack.slice(0, MAX_CARDS); // mutant: cards for unused evidence',
    ));
    const unused = fatwaEvidence({
      id: 'fatwa:binbaz:unused', url: 'https://binbaz.org.sa/fatwas/unused/x',
      supportText: f.supportText + ' وهذه نتيجة ثانية لم يستخدمها الجواب.',
      passage: f.supportText + ' وهذه نتيجة ثانية لم يستخدمها الجواب.',
    });
    const mutantCards = await mCards.runHybridDeenTurn({
      context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
      localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
      fatwaSearch: async () => ({ calls: 1, records: [f, unused] }),
      liveRetrieve: async (_q, opts) => markLive(opts.diagnostics),
      generate: modelUsing(f.id, f.supportText), verify: verifyIds(f.id),
    });
    ok('MUTANT killed: unused Evidence Pack entries cannot gain cards', integrated.cards.length === 1 && mutantCards.cards.length > 1);

    const mRelevance = await mutant(temp, 'relevance', (src) => src.replace(
      'if (!relevance.accepted) continue;', 'if (false) continue; // mutant: relevance gate deleted'));
    const badPage = { sources: [{ title: 'موضوع آخر', url: 'https://islamweb.net/ar/fatwa/999',
      passage: 'هذه صفحة في موضوع مختلف تمامًا ولا تجيب سؤال المسافر.', answerFormat: 'text' }] };
    ok('MUTANT killed: deleting relevance admits an unrelated page', H.__hybridTest.liveEvidence(badPage, joinContext).length === 0
      && mRelevance.__hybridTest.liveEvidence(badPage, joinContext).length === 1);

    // ── ع-٧٣: THE ROLE IN THE PRAYER IS THE QUESTION, AND THE SCORE COULD NOT SEE IT ──
    //
    // MEASURED 3 September: a «منفرد» probe in front of a card titled «المأموم» was ACCEPTED at
    // score 28. The score is word overlap, and الصلاة / السهو / التكبيرة / الركوع are shared by
    // both roles — so the number was HIGH BECAUSE the two cases look alike, which is exactly
    // when the answer is wrong. The المأموم's sahw is borne by his imam; the المنفرد has no
    // imam. No threshold can express that, so this is a gate and not a number.
    //
    // NON-MIRROR PAIR, and the KEEP side is the one that costs something. A rule that only ever
    // says «no» is indistinguishable from dropping the class, and the declared risk here is
    // rejecting a GENERAL fatwa that covers both roles — so the general card, the card that
    // names both roles, and the same مأموم card in front of a question that named no role are
    // all pinned as keeps beside the one rejection.
    const roleCtx = (question) => ({ currentQuestion: question, resolvedTopic: '', resolvedScholar: null });
    const ROLE_Q = 'ما حكم سهو المنفرد في الصلاة إذا ترك تكبيرة الركوع؟';
    const ROLE_Q_NONE = 'ما حكم سجود السهو في الصلاة؟';
    const CARD_MAMUM = {
      title: 'سجود السهو للمأموم إذا ترك تكبيرة الركوع في الصلاة',
      text: 'المأموم إذا ترك تكبيرة الركوع في الصلاة فلا سهو عليه، وسهوه يحمله الإمام.',
    };
    const CARD_BOTH = {
      title: 'سجود السهو للمأموم والمنفرد في الصلاة',
      text: 'المنفرد يسجد لسهوه، والمأموم يحمله عنه الإمام في تكبيرة الركوع وغيرها.',
    };
    const CARD_GENERAL = {
      title: 'سجود السهو في الصلاة',
      text: 'من ترك تكبيرة الركوع في الصلاة سهوا فحكمه كذا، ولا تبطل صلاته.',
    };
    const rel = (card, question) => H.__hybridTest
      .evidenceRelevance(card.text, card.title, roleCtx(question));
    ok('ع-٧٣ a مأموم card is refused for a منفرد question, and the OLD SCORE alone no longer decides',
      rel(CARD_MAMUM, ROLE_Q).accepted === false && rel(CARD_MAMUM, ROLE_Q).score >= 28,
      JSON.stringify(rel(CARD_MAMUM, ROLE_Q)));
    ok('ع-٧٣ ...while a card naming BOTH roles is kept — a comparison is an answer',
      rel(CARD_BOTH, ROLE_Q).accepted === true, JSON.stringify(rel(CARD_BOTH, ROLE_Q)));
    ok('ع-٧٣ ...and a GENERAL fatwa that names no role at all is kept, which is the declared risk',
      rel(CARD_GENERAL, ROLE_Q).accepted === true, JSON.stringify(rel(CARD_GENERAL, ROLE_Q)));
    ok('ع-٧٣ ...and the same مأموم card is kept when the QUESTION named no role',
      rel(CARD_MAMUM, ROLE_Q_NONE).accepted === true, JSON.stringify(rel(CARD_MAMUM, ROLE_Q_NONE)));
    // ع-٦٩ (أ): AND THE SAME QUESTION IS ASKED AT ATTACHMENT. `evidenceRelevance` gates what
    // enters the ranking; `quoteAddressesTopic` gates what gets stuck to an answer, and a card
    // can reach the second without passing the first. Before this round nothing re-checked
    // relevance at the moment of attachment at all.
    const addresses = (card, question) => H.__hybridTest.quoteAddressesTopic(
      card.text, roleCtx(question), { kind: 'fatwa_service', title: card.title });
    ok('ع-٦٩ the attachment door asks the role question too, and answers it the same way',
      addresses(CARD_MAMUM, ROLE_Q) === false
        && addresses(CARD_BOTH, ROLE_Q) === true
        && addresses(CARD_GENERAL, ROLE_Q) === true
        && addresses(CARD_MAMUM, ROLE_Q_NONE) === true,
      JSON.stringify([addresses(CARD_MAMUM, ROLE_Q), addresses(CARD_BOTH, ROLE_Q),
        addresses(CARD_GENERAL, ROLE_Q), addresses(CARD_MAMUM, ROLE_Q_NONE)]));
    // THE HAMZA IS NOT DECORATION. `normalizeArabic` folds أ إ آ ٱ together, which would make
    // «إمام» (the man leading) and «أمام» (in front of) one token and hand this rule a role the
    // text never named. The unpointed «امام» must therefore resolve to NO ROLE.
    ok('ع-٧٣ «إمام» is a role and «أمام» is a preposition, and the bare «امام» is neither',
      JSON.stringify(H.__hybridTest.participantRoles('حكم الإمام في الصلاة')) === JSON.stringify(['imam'])
        && H.__hybridTest.participantRoles('وقف أمام الصف').length === 0
        && H.__hybridTest.participantRoles('امام').length === 0,
      JSON.stringify([H.__hybridTest.participantRoles('حكم الإمام في الصلاة'),
        H.__hybridTest.participantRoles('وقف أمام الصف'),
        H.__hybridTest.participantRoles('امام')]));
    // MUTANT: the role gate removed from the ranking door alone. It is the state that shipped,
    // and it kills the rejection while every keep above stays green.
    const mRole = await mutant(temp, 'role-gate', (src) => src.replace(
      '    accepted: overlapped && !roleConflict(context, title, text),',
      '    accepted: overlapped, // mutant: the role gate deleted'));
    ok('ع-٧٣ MUTANT killed: without the role gate the مأموم card is admitted on its score again',
      rel(CARD_MAMUM, ROLE_Q).accepted === false
        && mRole.__hybridTest.evidenceRelevance(CARD_MAMUM.text, CARD_MAMUM.title, roleCtx(ROLE_Q))
          .accepted === true);
    // MUTANT: the ASKED-role escape turned into a role COUNT, which is the plausible wrong
    // reading of «or it compares the two roles» — and «المأموم يحمله الإمام» names two roles.
    const mCount = await mutant(temp, 'role-count', (src) => src.replace(
      '  return !found.some((role) => asked.includes(role));',
      '  return found.length === 1; // mutant: a count instead of the asked role'));
    ok('ع-٧٣ MUTANT killed: counting roles instead of finding the asked one readmits the card',
      mCount.__hybridTest.evidenceRelevance(CARD_MAMUM.text, CARD_MAMUM.title, roleCtx(ROLE_Q))
        .accepted === true);

    // ── ع-٤٣: ONE AUTHORITY, AND EVERY CARD IS THE CARD OF A SURVIVING CLAIM ───────
    //
    // MEASURED 3 September: the used set was frozen from the FIRST accepted claims, and the
    // majority/tarjīḥ gate could then swap the whole validation object without rebuilding it —
    // a probe came back with a summary drawn from evidence B, a card for evidence A, and A’s
    // fatwa text underneath it. The three id lists a reader can compare — what the answer
    // claims, what it used, and what it shows — must be ONE list.
    //
    // NON-MIRROR PAIR: the retry that is ADOPTED and the retry the VERIFIER refuses. The second
    // is the half that could not happen before this round, because the majority regeneration
    // never reached the verifier at all — it was the one model output nobody checked.
    const CLAIM_A = fatwaEvidence({
      id: 'fatwa:aladawy:701', url: 'https://mostafaaladwy.com/fatwa/701/x',
      publisher: 'مصطفى العدوي', authorityId: 'mostafa-aladwy', scholarId: 'aladawy',
      supportText: 'الجمع بين الصلاتين للمسافر يجوز عند الحاجة، والأفضل للنازل ترك الجمع.',
      passage: 'الجمع بين الصلاتين للمسافر يجوز عند الحاجة، والأفضل للنازل ترك الجمع.', score: 95,
    });
    const CLAIM_B = fatwaEvidence({
      id: 'fatwa:binbaz:702', url: 'https://binbaz.org.sa/fatwas/702/x',
      title: 'الجمع بين الصلاتين في السفر',
      supportText: 'يجوز للمسافر الجمع بين الصلاتين في السفر عند الحاجة، وهذا هو الثابت في السنة.',
      passage: 'يجوز للمسافر الجمع بين الصلاتين في السفر عند الحاجة، وهذا هو الثابت في السنة.', score: 94,
    });
    // A majority phrase that appears in NEITHER record, so §7 must refuse the first summary.
    const FORGED_JUMHUR = 'الجمع بين الصلاتين للمسافر يجوز عند الحاجة عند جمهور أهل العلم.';
    const claimOn = (evidence, sentence) => JSON.stringify({
      comparison: 'x', claims: [{ evidence_id: evidence.id, support_quote: evidence.supportText,
        claim: evidence.supportText, sentence }],
    });
    const runSwap = (module_, verifier) => {
      let generated = 0;
      return module_.runHybridDeenTurn({
        context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
        localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
        fatwaSearch: async () => ({ calls: 1, records: [CLAIM_A, CLAIM_B] }),
        liveRetrieve: async (_q, opts) => markLive(opts.diagnostics, { sources: [] }),
        generate: async () => {
          generated++;
          return generated === 1 ? claimOn(CLAIM_A, FORGED_JUMHUR) : claimOn(CLAIM_B, CLAIM_B.supportText);
        },
        verify: verifier,
      });
    };
    const ids = (result) => JSON.stringify({
      claimed: result.validatedUsedEvidenceIds,
      used: result.usedEvidence.map((entry) => entry.id),
      shown: result.cards.map((card) => card.evidenceId),
    });
    const oneList = (result) => {
      const parsed = JSON.parse(ids(result));
      return JSON.stringify(parsed.claimed) === JSON.stringify(parsed.used)
        && JSON.stringify(parsed.claimed) === JSON.stringify(parsed.shown);
    };
    const swapped = await runSwap(H, verifyIds(CLAIM_A.id, CLAIM_B.id));
    ok('ع-٤٣ a majority regeneration that moves to B takes the card and the fatwa text with it',
      swapped.outcome === 'ANSWER'
        && JSON.stringify(swapped.validatedUsedEvidenceIds) === JSON.stringify([CLAIM_B.id])
        && swapped.text.includes(CLAIM_B.supportText) && !swapped.text.includes(CLAIM_A.supportText)
        && !swapped.text.includes('جمهور أهل العلم'),
      ids(swapped));
    ok('ع-٤٣ ...and what the answer claims, what it used and what it shows are ONE list',
      oneList(swapped), ids(swapped));
    // THE KEEP SIDE. The verifier refuses B, so the retry is NOT adopted, §7 falls to its
    // deterministic rebuild, and the identity must still hold over whatever survives.
    const refusedRetry = await runSwap(H, verifyIds(CLAIM_A.id));
    ok('ع-٤٣ every model regeneration now meets the verifier: a refused retry is not adopted',
      refusedRetry.outcome === 'ANSWER' && !refusedRetry.text.includes('جمهور أهل العلم')
        && (refusedRetry.degraded || []).some((entry) => entry.startsWith('majority-unsupported'))
        && oneList(refusedRetry), ids(refusedRetry) + JSON.stringify(refusedRetry.degraded));
    // THE VISIBLE REFUSAL IS THE MODULE CONSTANT, never a copy typed into this file.
    const nothingQualified = await H.runHybridDeenTurn({
      context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
      localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
      fatwaSearch: async () => ({ calls: 1, records: [] }),
      liveRetrieve: async (_q, opts) => markLive(opts.diagnostics, { sources: [] }),
      generate: modelUsing(CLAIM_A.id, CLAIM_A.supportText), verify: verifyIds(CLAIM_A.id),
    });
    ok('ع-٤٣ an empty pack refuses in the module’s own words and shows no card',
      nothingQualified.outcome === 'NO_HYBRID_EVIDENCE'
        && nothingQualified.text === H.NO_HYBRID_EVIDENCE
        && nothingQualified.cards.length === 0
        && nothingQualified.validatedUsedEvidenceIds.length === 0,
      JSON.stringify({ outcome: nothingQualified.outcome, cards: nothingQualified.cards.length }));
    // MUTANT: the claims move and the used set stays behind — the exact state that shipped.
    const mFrozenUsed = await mutant(temp, 'frozen-used-set', (src) => src.replace(
      '        final = retry;',
      '        final = { ...final, finalClaims: retry.finalClaims, summary: retry.summary };'));
    const frozen = await runSwap(mFrozenUsed, verifyIds(CLAIM_A.id, CLAIM_B.id));
    ok('ع-٤٣ MUTANT killed: freezing the used set again shows A’s card under B’s summary',
      oneList(swapped) && !oneList(frozen), ids(frozen));

    const mAttribution = await mutant(temp, 'attribution', (src) => src.replace(
      'if ((attributionLanguage || mentionsDifferentScholar(sentence, evidence)) && !evidence.directAttribution) continue;',
      '// mutant: direct-attribution gate deleted',
    ));
    ok('MUTANT killed: deleting direct attribution admits a forged scholar claim', forgedAttribution.valid.length === 0
      && mAttribution.validateHybridClaims(JSON.stringify({ claims: [{ evidence_id: localPack[0].id,
        support_quote: localQuote, claim: 'نسبة', sentence: 'قال ابن باز إن الجمع بين الصلاتين للمسافر جائز.' }] }), localPack, joinContext).valid.length === 1);

    const emptyLocal = async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] });
    const emptyLive = async (_q, opts) => markLive(opts.diagnostics, { sources: [] });
    const mFatwa = await mutant(temp, 'fatwa-path', (src) => src.replace(
      'fatwaResult = await doFatwa();', 'fatwaResult = null; // mutant: named fatwa path deleted'));
    const actualFatwaOnly = await H.runHybridDeenTurn({ context: bazContext, band: 'adult', dailyBudget: budget,
      localRetrieve: emptyLocal, fatwaSearch: async () => ({ calls: 1, records: [f] }), liveRetrieve: emptyLive,
      generate: modelUsing(f.id, f.supportText), verify: verifyIds(f.id) });
    const mutantFatwaOnly = await mFatwa.runHybridDeenTurn({ context: bazContext, band: 'adult', dailyBudget: budget,
      localRetrieve: emptyLocal, fatwaSearch: async () => ({ calls: 1, records: [f] }), liveRetrieve: emptyLive,
      generate: modelUsing(f.id, f.supportText), verify: verifyIds(f.id) });
    ok('MUTANT killed: deleting named fatwa search loses its only direct evidence', actualFatwaOnly.outcome === 'ANSWER'
      && mutantFatwaOnly.outcome === 'NO_HYBRID_EVIDENCE');

    const mLive = await mutant(temp, 'live-path', (src) => src.replace(
      `liveResult = mergeLiveResults(await Promise.all(
      queries.map((searchQuery) => doLive(searchQuery, scholar?.sourceDomain || ''))));`,
      'liveResult = { sources: [] }; // mutant: named Brave/fetch path deleted'));
    const emptyFatwa = async () => ({ calls: 1, records: [] });
    const actualLiveOnly = await H.runHybridDeenTurn({ context: bazContext, band: 'adult', dailyBudget: budget,
      localRetrieve: emptyLocal, fatwaSearch: emptyFatwa, liveRetrieve: async (_q, opts) => markLive(opts.diagnostics),
      generate: async () => { throw new Error('fallback'); }, verify: verifyIds() });
    const mutantLiveOnly = await mLive.runHybridDeenTurn({ context: bazContext, band: 'adult', dailyBudget: budget,
      localRetrieve: emptyLocal, fatwaSearch: emptyFatwa, liveRetrieve: async (_q, opts) => markLive(opts.diagnostics),
      generate: async () => { throw new Error('fallback'); }, verify: verifyIds() });
    ok('MUTANT killed: deleting Brave/fetch loses its only eligible live evidence', actualLiveOnly.outcome === 'ANSWER'
      && mutantLiveOnly.outcome === 'NO_HYBRID_EVIDENCE');

    const mLocal = await mutant(temp, 'local-path', (src) => src.replace(
      'try { localResult = await localFn({ context, answerabilityEvaluator: options.answerabilityEvaluator }); }',
      'try { localResult = null; /* mutant: local corpus path deleted */ }'));
    const actualLocalOnly = bothDown;
    const mutantLocalOnly = await mLocal.runHybridDeenTurn({ ...common,
      fatwaSearch: async () => { throw new Error('fatwa_offline'); },
      liveRetrieve: async (_q, opts) => { opts.diagnostics.search.failed++; throw new Error('429'); },
    });
    ok('MUTANT killed: deleting local corpus loses the remote-failure fallback', actualLocalOnly.outcome === 'ANSWER'
      && mutantLocalOnly.outcome === 'NO_HYBRID_EVIDENCE');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  console.log('\n--- IMMUTABLE DATA ---');
  const corpusAfter = fs.readFileSync(CORPUS);
  const livenessAfter = fs.readFileSync(LIVENESS);
  eq('LOCAL_CORPUS=3045 before', JSON.parse(zlib.gunzipSync(corpusBefore)).length, 3045);
  eq('LOCAL_CORPUS=3045 after', JSON.parse(zlib.gunzipSync(corpusAfter)).length, 3045);
  eq('local corpus fingerprint before', sha(corpusBefore), CORPUS_HASH);
  eq('local corpus fingerprint after', sha(corpusAfter), CORPUS_HASH);
  eq('source liveness data fingerprint before', sha(livenessBefore), LIVENESS_HASH);
  eq('source liveness data fingerprint after', sha(livenessAfter), LIVENESS_HASH);
  ok('SOURCE_DATA_FILES_CHANGED=0', corpusBefore.equals(corpusAfter) && livenessBefore.equals(livenessAfter));
  ok('FATWA_DATA_FILES_CHANGED=0 (no local fatwa dataset exists)', !fs.existsSync(path.join(ROOT, 'fatwa-data')));

  console.log(`\n=== hybrid-live-fatwa: ${checks - failures}/${checks} — ${failures ? 'FAIL' : 'PASS'} ===`);
  return { checks, failures };
}

module.exports = { runHybridGuard };
if (require.main === module) runHybridGuard().then((r) => { process.exitCode = r.failures ? 1 : 0; })
  .catch((error) => { console.error(error && error.stack || error); process.exitCode = 1; });
