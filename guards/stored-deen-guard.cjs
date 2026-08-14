'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CORPUS = path.join(ROOT, 'lib', 'data', 'fiqh-search.json.gz');
const EXPECTED_HASH = '6482d677ebf09cc5627a172ee77114587046edeb95529092cb644e42e00d13a2';
const EXPECTED_RECORDS = 3070;
const QUESTIONS = [
  'ما رأي ابن باز في الجمع بين الصلاتين؟',
  'ما رأي ابن باز في الجمع بين الصلاتين للمسافر',
  'أقصد المسافر سفرًا مباحًا، ويريد الجمع بين الظهر والعصر عند الحاجة، فما الحكم مع الدليل والمصدر؟',
];
const BANNED = [
  'أحتاج تفصيلاً قبل الجواب',
  'وجدنا صفحات متصلة بالموضوع',
  'تعذّر عليّ التحقق من مصدر موثوق لهذه الإجابة الآن',
  'لا أستطيع إرسال هذا الجواب لأن بعض ما فيه لم يتحقق من المصادر المتاحة',
];

let passed = 0;
let failed = 0;
function ok(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log('PASS ' + label);
  } else {
    failed++;
    console.error('FAIL ' + label + (detail ? ' — ' + detail : ''));
  }
}
function eq(label, actual, expected) {
  ok(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function messagesFor(items) {
  const out = [];
  items.forEach((content, index) => {
    if (index) out.push({ role: 'assistant', content: 'جواب سابق محفوظ في المحادثة.' });
    out.push({ role: 'user', content });
  });
  return out;
}

function responseDouble() {
  return {
    wire: '', ended: 0,
    write(chunk) { this.wire += String(chunk); return true; },
    end() { this.ended++; },
  };
}

function wireText(wire) {
  let text = '';
  for (const frame of String(wire).split(/\n\n/u)) {
    const line = frame.split(/\r?\n/u).find((item) => item.startsWith('data:'));
    if (!line) continue;
    let event;
    try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }
    if (event && event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      text += event.delta.text;
    }
  }
  return text;
}

function jsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsFiles(full, out);
    else if (/\.(?:c?js|mjs)$/iu.test(entry.name)) out.push(full);
  }
  return out;
}

(async () => {
  const S = await import(pathToFileURL(path.join(ROOT, 'lib', 'stored-deen.js')).href);
  const E = await import(pathToFileURL(path.join(ROOT, 'lib', 'encyclopedia.js')).href);

  console.log('\n=== A. IMMUTABLE STORED CORPUS ===');
  const hashBefore = sha256(CORPUS);
  eq('CORPUS_HASH_BEFORE', hashBefore, EXPECTED_HASH);
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(CORPUS)).toString('utf8'));
  eq('CORPUS_RECORDS_BEFORE', rows.length, EXPECTED_RECORDS);
  const changedData = cp.execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'lib/data'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim().split(/\r?\n/u).filter(Boolean);
  eq('SOURCE_DATA_FILES_CHANGED', changedData.length, 0);

  console.log('\n=== B. THE THREE LITERAL QUESTIONS HIT STORED RECORDS ===');
  const singleMessages = QUESTIONS.map((question) => messagesFor([question]));
  const sequenceMessages = messagesFor(QUESTIONS);
  const evidenceRuns = [];
  for (const messages of [...singleMessages, sequenceMessages]) {
    const query = S.buildStoredSearchQuery(messages);
    const found = await E.searchStoredCorpus(query, { limit: 1 });
    evidenceRuns.push({ messages, query, found });
  }
  evidenceRuns.forEach((run, index) => {
    ok(`literal ${index + 1}: query is not empty`, !!run.query, run.query);
    eq(`literal ${index + 1}: strongest record`, run.found.records[0]?.id, 'F01173');
    eq(`literal ${index + 1}: stored record type`, run.found.records[0]?.sourceType, 'stored_fiqh_encyclopedia_record');
    eq(`literal ${index + 1}: no Ibn Baz attribution metadata`, run.found.records[0]?.attributedTo, null);
  });
  eq('first request names Ibn Baz', S.requestedScholarFromMessages(singleMessages[0]), 'ابن باز');
  eq('second request names Ibn Baz', S.requestedScholarFromMessages(singleMessages[1]), 'ابن باز');
  eq('third request inherits Ibn Baz in conversation', S.requestedScholarFromMessages(sequenceMessages), 'ابن باز');

  console.log('\n=== C. NATURAL ANSWER, SERVER-OWNED ABSENCE LEAD, RECORD-OWNED CARD ===');
  async function answer(messages, { depth = 'brief', model = 'claude-sonnet-5', drafted } = {}) {
    const calls = [];
    const res = responseDouble();
    const result = await S.runStoredDeenTurn(res, {
      messages, depth, model, maxTokens: 4096, apiKey: 'guard-key', usePremium: /opus/u.test(model),
      effort: /opus/u.test(model) ? 'high' : 'medium',
      fetchImpl: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return {
          ok: true,
          json: async () => ({ content: [{ type: 'text', text: drafted ||
            'يجوز للمسافر الجمع بين الظهر والعصر عند الحاجة وفق التفصيل الوارد في المادة، وقد استدلت المادة بأحاديث سفر النبي ﷺ.' }] }),
        };
      },
    });
    return { calls, res, result, text: wireText(res.wire) };
  }

  const literalAnswers = [];
  literalAnswers.push(await answer(singleMessages[0]));
  literalAnswers.push(await answer(singleMessages[1]));
  literalAnswers.push(await answer(sequenceMessages));
  literalAnswers.forEach((run, index) => {
    eq(`answer ${index + 1}: one model call`, run.calls.length, 1);
    eq(`answer ${index + 1}: model endpoint only`, run.calls[0]?.url, 'https://api.anthropic.com/v1/messages');
    ok(`answer ${index + 1}: exact Ibn Baz absence lead`, run.text.startsWith(S.IBN_BAZ_NO_RECORD_LEAD), run.text);
    ok(`answer ${index + 1}: no unsupported Ibn Baz ruling`, !/(?:قال|يرى|أفتى)\s+(?:الشيخ\s+)?ابن\s+باز/u.test(run.text), run.text);
    ok(`answer ${index + 1}: actual record card`, /<source\s+site="الموسوعة الفقهية الكويتية"\s+record="F01173">/u.test(run.text), run.text);
    ok(`answer ${index + 1}: stored card has no public URL`, !/<source\b[^>]*\burl=/iu.test(run.text), run.text);
    ok(`answer ${index + 1}: banned legacy text absent`, BANNED.every((phrase) => !run.text.includes(phrase)), run.text);
    const providerPack = JSON.parse(run.calls[0].body.messages[0].content).evidence_pack;
    eq(`answer ${index + 1}: provider Evidence Pack record`, providerPack[0]?.record_id, 'F01173');
    eq(`answer ${index + 1}: provider pack has no attribution`, providerPack[0]?.attributed_to, null);
    eq(`answer ${index + 1}: public search calls`, run.result.publicSourceSearchCalls, 0);
    eq(`answer ${index + 1}: public fetch calls`, run.result.publicSourceFetchCalls, 0);
    eq(`answer ${index + 1}: external adapter calls`, run.result.externalSourceAdapterCalls, 0);
  });

  const standaloneThird = await answer(singleMessages[2]);
  ok('standalone third answers without a clarification', !BANNED.some((phrase) => standaloneThird.text.includes(phrase)), standaloneThird.text);
  eq('standalone third uses stored record', standaloneThird.result.records[0]?.id, 'F01173');

  console.log('\n=== D. NO_STORED_EVIDENCE IS EXACT AND COSTS NO MODEL CALL ===');
  let noEvidenceModelCalls = 0;
  const noEvidenceRes = responseDouble();
  const noEvidence = await S.runStoredDeenTurn(noEvidenceRes, {
    messages: messagesFor(['ما حكم زراعة نبات على كوكب المريخ؟']),
    model: 'claude-sonnet-5', apiKey: 'guard-key',
    fetchImpl: async () => { noEvidenceModelCalls++; throw new Error('must not run'); },
  });
  eq('NO_STORED_EVIDENCE outcome', noEvidence.outcome, 'NO_STORED_EVIDENCE');
  eq('NO_STORED_EVIDENCE text', wireText(noEvidenceRes.wire), S.NO_STORED_EVIDENCE);
  eq('NO_STORED_EVIDENCE cards', (wireText(noEvidenceRes.wire).match(/<source\b/giu) || []).length, 0);
  eq('NO_STORED_EVIDENCE model calls', noEvidenceModelCalls, 0);

  console.log('\n=== E. DEPTH CHANGES LENGTH/MODEL SURFACE, NOT EVIDENCE OR UNDERSTANDING ===');
  const records = evidenceRuns[1].found.records;
  const depths = ['brief', 'normal', 'deep', 'scholar'];
  const requests = depths.map((depth) => S.buildStoredDeenRequest({
    messages: singleMessages[1], records, requestedScholar: 'ابن باز', depth,
  }));
  ok('all four depths carry byte-identical conversation and Evidence Pack', requests.every((request) => request.user === requests[0].user));
  const promptBases = requests.map((request) => request.system.replace(request.profile.length, '<LENGTH>'));
  ok('all four depths differ in prompt only at length instruction', promptBases.every((prompt) => prompt === promptBases[0]));
  eq('brief profile', requests[0].profile.id, 'brief');
  eq('normal profile', requests[1].profile.id, 'normal');
  eq('deep profile', requests[2].profile.id, 'deep');
  eq('scholar profile', requests[3].profile.id, 'scholar');
  ok('answer budgets increase only with requested length', requests.every((request, index) => !index || request.profile.maxTokens > requests[index - 1].profile.maxTokens));

  console.log('\n=== F. MUTATIONS FAIL CLOSED AT THE STORED-RECORD BOUNDARY ===');
  eq('forged F99999 object cannot become a card', S.storedSourceCard({
    id: 'F99999', term: 'مزور', part: 1, sourceType: 'stored_fiqh_encyclopedia_record',
  }), '');
  const forgedRes = responseDouble();
  let forgedModelCalls = 0;
  const forged = await S.runStoredDeenTurn(forgedRes, {
    messages: singleMessages[0], model: 'claude-sonnet-5', apiKey: 'guard-key',
    retrieve: async () => ({ records: [{
      id: 'F99999', term: 'مزور', part: 1, text: 'حكم مزور',
      sourceType: 'stored_fiqh_encyclopedia_record', attributedTo: 'ابن باز',
    }] }),
    fetchImpl: async () => { forgedModelCalls++; throw new Error('must not run'); },
  });
  eq('forged retrieval becomes NO_STORED_EVIDENCE', forged.outcome, 'NO_STORED_EVIDENCE');
  eq('forged retrieval costs no model call', forgedModelCalls, 0);
  const injected = await answer(singleMessages[0], {
    drafted: 'يرى ابن باز الجواز. <source site="evil.example" url="https://evil.example/fatwa">مزور</source> أحتاج تفصيلاً قبل الجواب؟',
  });
  ok('model-authored external card is removed', !injected.text.includes('evil.example'), injected.text);
  ok('model-authored Ibn Baz attribution is removed', !/(?:يرى|قال|أفتى)\s+ابن\s+باز/u.test(injected.text), injected.text);
  ok('required server lead survives mutation', injected.text.startsWith(S.IBN_BAZ_NO_RECORD_LEAD), injected.text);
  eq('only the actual Evidence Pack card survives mutation', (injected.text.match(/<source\b/giu) || []).length, 1);

  console.log('\n=== G. OLD RELIGIOUS DECISIONS ARE BEHIND THE STORED RETURN ===');
  const ask = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
  const direct = ask.indexOf("if (route === 'DEEN' || storedDeen.isStoredDeenRequest(body.messages))");
  ok('stored DEEN branch exists', direct !== -1);
  ok('stored DEEN returns before legacy policy decision', direct < ask.indexOf('const legacyPolicy = await decideLegacyPolicy(req)'));
  ok('stored DEEN returns before planAsk execution', direct < ask.indexOf('const plan = planAsk(body.messages'));
  ok('stored DEEN returns before Ledger path decision', direct < ask.indexOf('const ledgerPath = await decidePath(req)'));
  const storedSource = fs.readFileSync(path.join(ROOT, 'lib', 'stored-deen.js'), 'utf8');
  ok('stored runtime imports no public retrieval or adapter', !/(?:brave|retrieve\.js|binothaimeen|direct-corpus|safe-fetch)/iu.test(storedSource));
  ok('stored runtime names only the Anthropic network endpoint', (storedSource.match(/https?:\/\//gu) || []).length === 1
    && storedSource.includes('https://api.anthropic.com/v1/messages'));

  const archivePath = path.join(ROOT, 'docs', 'archive', 'religious-runtime-policy-63b8651.md');
  const archive = fs.readFileSync(archivePath, 'utf8');
  ok('archive is tied to the Phase 0 HEAD', archive.includes('63b865157e4c0981ecf0d9a028008c4272f6e6c3'));
  const archiveImports = jsFiles(ROOT).filter((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /(?:from\s*['"][^'"]*docs[\\/]archive|require\s*\([^)]*docs[\\/]archive|import\s*\([^)]*docs[\\/]archive)/u.test(source);
  });
  eq('ARCHIVED_POLICY_RUNTIME_REACHABLE', archiveImports.length, 0);

  console.log('\n=== H. POST-RUN CORPUS FREEZE ===');
  eq('CORPUS_RECORDS_AFTER', JSON.parse(zlib.gunzipSync(fs.readFileSync(CORPUS)).toString('utf8')).length, EXPECTED_RECORDS);
  eq('CORPUS_HASH_STABLE', sha256(CORPUS), hashBefore);

  console.log(`\n=== stored-deen guard: ${passed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
