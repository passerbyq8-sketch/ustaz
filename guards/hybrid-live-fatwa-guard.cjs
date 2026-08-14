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
const CORPUS_HASH = '6482d677ebf09cc5627a172ee77114587046edeb95529092cb644e42e00d13a2';
const LIVENESS_HASH = '75b88f5c092eea8ae5e4198a33203e99dd136e06581d8b69bf7dc1037322aa4d';
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

function importableHybrid(source) {
  const lib = path.join(ROOT, 'lib');
  return source.replace(/from\s+(['"])(\.\/[^'"]+)\1/gu, (_all, quote, specifier) =>
    `from ${quote}${pathToFileURL(path.resolve(lib, specifier)).href}${quote}`);
}

async function mutant(temp, name, mutate) {
  const original = fs.readFileSync(path.join(ROOT, 'lib', 'hybrid-deen.js'), 'utf8');
  const ready = importableHybrid(original);
  const changed = mutate(ready);
  if (changed === ready) throw new Error('hybrid mutation seam moved: ' + name);
  const file = path.join(temp, name + '.mjs');
  fs.writeFileSync(file, changed, 'utf8');
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

async function runHybridGuard() {
  console.log('\n=== hybrid-live-fatwa — three paths, grounding, degradation and mutants ===');
  const corpusBefore = fs.readFileSync(CORPUS);
  const livenessBefore = fs.readFileSync(LIVENESS);
  const [H, S, R, A, BQ, FC, FSVC, RET, CLOSED, W, SW, CG] = await Promise.all([
    esm('lib/hybrid-deen.js'), esm('lib/stored-deen.js'), esm('lib/route-classify.js'),
    esm('lib/ask-plan.js'), esm('lib/brave-query.js'), esm('lib/fatwa-contract.js'),
    esm('lib/fatwa-service.js'), esm('lib/retrieve.js'), esm('lib/closed-deen.js'),
    esm('lib/world-intent.js'), esm('lib/finalized-sse-writer.js'),
    esm('lib/policy/consistency-gate.js'),
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
  const switched = contextFor(S, R, A, 'هل خالف ابن تيمية أهل السنة والجماعة؟', [
    { role: 'user', content: 'ما رأي ستيف جوبز في التصميم؟' }, { role: 'assistant', content: 'جواب.' },
    { role: 'user', content: 'هل خالف ابن تيمية أهل السنة والجماعة؟' },
  ]);
  ok('current-turn-wins: Steve Jobs does not enter current topic/query', switched.runtime === 'STORED_FIQH'
    && !JSON.stringify(switched).includes('ستيف جوبز') && switched.resolvedTopic.includes('ابن تيم'));
  ok('answerable sparse fiqh is routed to hybrid', contextFor(S, R, A, 'هل النقاب واجب؟').runtime === 'STORED_FIQH');
  ok('sparse named fiqh is routed to hybrid', contextFor(S, R, A, 'ما رأي ابن عثيمين فيمن أسقطت دون ثمانين يومًا؟').runtime === 'STORED_FIQH');

  console.log('\n--- THREE INDEPENDENT PATHS AND USED-CARD LIFECYCLE ---');
  const f = fatwaEvidence();
  const events = [];
  const localReal = (opts) => { events.push('local:start'); return S.retrieveStoredFiqhEvidence(opts).then((x) => { events.push('local:end'); return x; }); };
  const integrated = await H.runHybridDeenTurn({
    context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: localReal,
    fatwaSearch: async () => { events.push('fatwa:start'); await Promise.resolve(); events.push('fatwa:end'); return {
      calls: 1, verification: { status: 'OK', scholars: 18, total: 73130, ibnBaz: 18479, failures: [] }, records: [f],
    }; },
    liveRetrieve: async (_q, opts) => { events.push('brave:start'); await Promise.resolve(); events.push('brave:end'); return markLive(opts.diagnostics); },
    generate: modelUsing(f.id, f.supportText), verify: verifyIds(f.id),
  });
  ok('ordinary DEEN invokes local + fatwa + Brave/fetch', integrated.storedCorpusCalls === 1
    && integrated.fatwaSearchCalls === 1 && integrated.braveSearchCalls === 1
    && integrated.livePageFetchCalls === 1, JSON.stringify(integrated));
  ok('unnamed independent paths start in parallel', ['local:start', 'fatwa:start', 'brave:start']
    .every((event) => events.indexOf(event) >= 0 && events.indexOf(event) < Math.min(
      ...['local:end', 'fatwa:end', 'brave:end'].map((end) => events.indexOf(end))
    )), JSON.stringify(events));
  eq('only evidence used by a sentence receives a card', integrated.cards.map((card) => card.evidenceId), [f.id]);
  eq('used evidence is separately observable', integrated.validatedUsedEvidenceIds, [f.id]);
  ok('fatwa health totals travel into telemetry', integrated.fatwaValidation.status === 'OK'
    && integrated.fatwaValidation.scholars === 18 && integrated.fatwaValidation.total === 73130
    && integrated.fatwaValidation.ibnBaz === 18479);

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
  ok('named scholar uses exact fatwa id before official live preference', namedEvents.indexOf('fatwa:end') < namedEvents.indexOf('live:start'), JSON.stringify(namedEvents));

  console.log('\n--- DEGRADATION IS NOT CLARIFICATION ---');
  const common = {
    context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
    localRetrieve: (opts) => S.retrieveStoredFiqhEvidence(opts),
    generate: async () => { throw new Error('fixture synthesis unavailable'); },
    verify: async () => '{"supported_ids":[]}',
  };
  const braveDown = await H.runHybridDeenTurn({ ...common,
    fatwaSearch: async () => ({ calls: 1, records: [f] }),
    liveRetrieve: async (_q, opts) => { opts.diagnostics.search.failed++; throw new Error('429'); },
  });
  ok('Brave-only failure still answers from eligible evidence', braveDown.outcome === 'ANSWER'
    && braveDown.degraded.some((x) => x.startsWith('brave:')) && !/وضح|حدد|NEEDS_QUALIFIER/u.test(braveDown.text));
  const fatwaDown = await H.runHybridDeenTurn({ ...common,
    fatwaSearch: async () => { throw new Error('fatwa_offline'); },
    liveRetrieve: async (_q, opts) => markLive(opts.diagnostics),
  });
  ok('fatwa-only failure still answers from local/live evidence', fatwaDown.outcome === 'ANSWER'
    && fatwaDown.degraded.some((x) => x.startsWith('fatwa:')));
  const bothDown = await H.runHybridDeenTurn({ ...common,
    fatwaSearch: async () => { throw new Error('fatwa_offline'); },
    liveRetrieve: async (_q, opts) => { opts.diagnostics.search.failed++; throw new Error('429'); },
  });
  ok('both remote failures still answer when local evidence remains', bothDown.outcome === 'ANSWER'
    && bothDown.storedCorpusCalls === 1 && !/وضح|حدد|هل تقصد|NEEDS_QUALIFIER/u.test(bothDown.text));
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
  ok('واجبة/واجب are one exact ruling family without reverting to substring relevance',
    veilOpposition.length === 1 && H.__hybridTest.veilStances(veilOpposition[0].supportText).nonDuty,
    JSON.stringify(veilOpposition));
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
  ok('the live veil query explicitly searches the documented disagreement within Brave limits',
    veilLiveQueries.length === 2 && veilLiveQueries.some((query) => query.includes('فرض أم مستحب') && query.includes('ليس بواجب'))
      && veilLiveQueries.every((query) => BQ.measureQuery(query).chars <= 380
        && BQ.measureQuery(query).words <= 45),
    JSON.stringify(veilLiveQueries));

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
  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
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
  ok('Ledger records a missing qualifier but does not early-return a follow-up', engineSource.includes('REJECTION.QUALIFIER_MISSING')
    && !engineSource.includes("return finish({ outcome: 'SAFE_REJECTION', text: followUpText(plan)"));

  console.log('\n--- MAJOR-GATE MUTANTS ---');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-hybrid-mutants-'));
  try {
    const mCards = await mutant(temp, 'unused-card', (src) => src.replace(
      'const usedEvidence = [];',
      'const usedEvidence = pack.slice(0, MAX_CARDS); // mutant: cards for unused evidence',
    ));
    const mutantCards = await mCards.runHybridDeenTurn({
      context: joinContext, band: 'adult', depth: 'normal', dailyBudget: budget,
      localRetrieve: (opts) => S.retrieveStoredFiqhEvidence(opts),
      fatwaSearch: async () => ({ calls: 1, records: [f] }),
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
      queries.map((searchQuery) => doLive(searchQuery, scholar.sourceDomain))));`,
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
      'const localPromise = Promise.resolve().then(() => localFn({ context, answerabilityEvaluator: options.answerabilityEvaluator }));',
      'const localPromise = Promise.resolve(null); // mutant: local corpus path deleted'));
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
  eq('LOCAL_CORPUS=3070 before', JSON.parse(zlib.gunzipSync(corpusBefore)).length, 3070);
  eq('LOCAL_CORPUS=3070 after', JSON.parse(zlib.gunzipSync(corpusAfter)).length, 3070);
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
