// Explicit live measurement only; never imported by an API entry. Run with Node 22:
// node tools/qaf-gap/item-8-benchmark.mjs <archive-root> <proof-directory>
// A persistent call ledger prevents reruns from silently exceeding the 40-call cap.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createReranker } from '../../lib/rerank/index.js';
import { precisionAt10 } from './item-7-benchmark.mjs';

export const selectionRule = 'Choose the cheapest model with median precision@10 >= 0.8 and B2 precision@10 at least the lexical baseline. Break equal-cost ties by lower measured p90 latency. If none reaches 0.8, choose the best model reaching 0.7 and mark NEEDS_OWNER. If none reaches 0.7, mark FAILED and stop; do not execute later steps. Use the unchanged 450 candidates and committed R/P/X labels. Rejected API model names are recorded and excluded. No price or model result will be invented. Maximum calls: 40; model calls planned: 27 (nine questions for each of three models). Threshold: highest score among X candidates; only strictly greater scores can show a card.';
const models = ['rerank-v3.5', 'rerank-v4.0-fast', 'rerank-v4.0-pro'];
const sha = (data) => createHash('sha256').update(data).digest('hex');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const check = (condition, code) => { if (!condition) throw new Error(code); };
export function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null;
}
export function p90(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.ceil(0.9 * v.length) - 1] : null;
}
export function thresholdFor(rows, questions) {
  const scored = rows.flatMap((q) => q.ranking.map((r) => ({ ...r,
    label: questions.find((a) => a.id === q.id).candidates.find((a) => a.id === r.id).label })));
  const threshold = Math.max(...scored.filter((r) => r.label === 'X').map((r) => r.score));
  const above = scored.filter((r) => r.score > threshold);
  return { threshold, rule: 'Strictly greater than the highest X score',
    above: Object.fromEntries(['R', 'P', 'X'].map((label) => [label, above.filter((r) => r.label === label).length])),
    knownX: ['ezik:b3#4', 'ezik:b3#5', 'ezik:c1#3'].map((id) => {
      const row = scored.find((r) => r.id === id);
      return { id, score: row?.score ?? null, suppressed: !!row && row.score <= threshold };
    }) };
}
export function selectModel(results, lexicalB2) {
  const complete = results.filter((r) => r.rows.length === 9 && r.rows.every((q) => q.ranking && Number.isFinite(q.precisionAt10)));
  const eligible = complete.filter((r) => r.medianPrecisionAt10 >= 0.8
    && r.rows.find((q) => q.id === 'b2').precisionAt10 >= lexicalB2);
  if (eligible.length) {
    // Prices must be evidence-backed, never inferred from model names or billing units.
    if (eligible.some((r) => !Number.isFinite(r.price?.usdPer1000SearchUnits))) {
      return { status: 'PRICE_REQUIRED', model: null, card_min: null,
        reason: 'Quality qualifies; documented model prices are required to apply the unchanged cheapest-model rule.' };
    }
    eligible.sort((a, b) => a.price.usdPer1000SearchUnits - b.price.usdPer1000SearchUnits || a.p90Ms - b.p90Ms);
    return { status: 'PASS', model: eligible[0].model, card_min: eligible[0].threshold,
      reason: 'Cheapest complete model with median >= 0.8 and B2 >= lexical; equal cost uses lower p90 latency.' };
  }
  if (complete.some((r) => r.medianPrecisionAt10 >= 0.8)) {
    return { status: 'FAILED', model: null, card_min: null, reason: 'No model meets the mandatory B2 lexical floor.' };
  }
  const best = complete.filter((r) => r.medianPrecisionAt10 >= 0.7)
    .sort((a, b) => b.medianPrecisionAt10 - a.medianPrecisionAt10 || a.p90Ms - b.p90Ms)[0];
  return best ? { status: 'NEEDS_OWNER', model: best.model, card_min: best.threshold,
    reason: 'No complete model reaches 0.8; best median reaches 0.7.' }
    : { status: 'FAILED', model: null, card_min: null,
      reason: complete.length ? 'No complete model reaches median precision@10 0.7.' : 'No complete live model measurement is available.' };
}

// Apply documented prices to the saved live observations without another API call.
export function applyPrices(pricesFile, proofDirectory) {
  const prices = read(pricesFile);
  check(typeof prices.source === 'string' && prices.source.trim(), 'DOCUMENTED_PRICE_SOURCE_REQUIRED');
  const output = read('tools/qaf-gap/item-8-measurement.json');
  check(output.completed && output.apiCalls <= 40 && output.selectionRule === selectionRule, 'COMPLETE_ORIGINAL_MEASUREMENT_REQUIRED');
  for (const result of output.results) {
    const rate = prices.usdPer1000SearchUnits?.[result.model];
    check(Number.isFinite(rate) && rate >= 0, 'DOCUMENTED_PRICE_REQUIRED');
    result.price = { usdPer1000SearchUnits: rate, source: prices.source };
    result.observedCostUsd = result.search_units * rate / 1000;
  }
  output.selection = selectModel(output.results, output.baselines[0].rows.find((r) => r.id === 'b2').precisionAt10);
  output.status = output.selection.status;
  output.reason = output.selection.reason;
  output.priceEvidenceSha256 = sha(fs.readFileSync(pricesFile));
  fs.writeFileSync('tools/qaf-gap/item-8-measurement.json', JSON.stringify(output, null, 2) + '\n');
  const proofPath = path.join(proofDirectory, 'e-step1-live-proof.json');
  const proof = read(proofPath);
  Object.assign(proof, { status: output.status, selection: output.selection,
    measurementSha256: sha(fs.readFileSync('tools/qaf-gap/item-8-measurement.json')),
    priceEvidenceSha256: output.priceEvidenceSha256, models: output.results.map(({ rows, ...r }) => r) });
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n');
  return output;
}

export async function benchmark(archiveRoot, proofDirectory) {
  check(process.versions.node.split('.')[0] === '22', 'NODE_22_REQUIRED');
  check(!!process.env.COHERE_API_KEY?.trim(), 'KEY_NOT_PRESENT');
  check(archiveRoot && proofDirectory, 'ARCHIVE_AND_PROOF_DIRECTORY_REQUIRED');
  const previous = read('tools/qaf-gap/item-7-measurement.json');
  const candidatesFile = 'node_modules/.cache/qaf-gap/item-7-candidates.json';
  const candidateBytes = fs.readFileSync(candidatesFile);
  check(sha(candidateBytes) === '50eaf669240c275dc2439f93b05371750f8b2fdf2146e2cf3b93952a4d6404fc', 'ORIGINAL_450_POOL_CHANGED');
  check(sha(fs.readFileSync('tools/qaf-gap/item-7-measurement.json')) === '385bb8a6f6655f4932036ba8938f859d4986843cab19c36522085ecec219f65d', 'ITEM_7_MEASUREMENT_CHANGED');
  check(sha(fs.readFileSync('tools/qaf-gap/item-7-labels.json')) === previous.labelsSha256, 'LABELS_CHANGED');
  check(sha(fs.readFileSync('lib/data/fiqh-search.json.gz')) === previous.sourceIndexSha256, 'SOURCE_INDEX_CHANGED');
  for (const input of previous.inputs) {
    check(sha(fs.readFileSync(path.join(archiveRoot, 'sessions/side-qaf-live-2026-11-02/retrieval', input.file))) === input.sha256, 'ARCHIVED_INPUT_CHANGED');
  }
  const pool = JSON.parse(candidateBytes);
  const onnx = previous.results.find((r) => r.provider === 'local-onnx');
  check(pool.questions.length === 9 && pool.questions.every((q) => q.candidates.length === 50), 'POOL_NOT_450');
  for (const q of pool.questions) {
    const ids = new Set(onnx.rows.find((r) => r.id === q.id).ranking.map((r) => r.id));
    check(ids.size === 50 && q.candidates.every((r) => ids.has(r.id) && ['R', 'P', 'X'].includes(r.label)), 'IDS_OR_LABELS_CHANGED');
    check(precisionAt10(q.candidates) === previous.lexical.find((r) => r.id === q.id).precisionAt10, 'LEXICAL_BASELINE_CHANGED');
  }
  const proofDir = path.resolve(proofDirectory);
  fs.mkdirSync(proofDir, { recursive: true });
  const ledgerPath = path.join(proofDir, 'e-live-call-ledger.json');
  const ledger = fs.existsSync(ledgerPath) ? read(ledgerPath) : { calls: 0, attempts: [] };
  // Refuse automatic replay. A partial run remains evidence for deliberate review.
  check(ledger.calls === 0, 'LIVE_RUN_ALREADY_ATTEMPTED_NO_AUTOMATIC_REPLAY');
  check(ledger.calls + models.length * pool.questions.length <= 40, 'CALL_LIMIT');
  const report = fs.readFileSync(path.join(proofDir, 'EZIK-QAF-GAP-REPORT-E-2026-11-02.md'), 'utf8');
  check(report.includes(selectionRule), 'SELECTION_RULE_NOT_RECORDED_BEFORE_CALLS');
  fs.writeFileSync(path.join(proofDir, 'e-selection-rule-before-calls.json'), JSON.stringify({ selectionRule,
    reportSha256: sha(report), recordedAt: new Date().toISOString(), calls: ledger.calls }, null, 2) + '\n');
  const lexicalRows = pool.questions.map((q) => ({ id: q.id, precisionAt10: precisionAt10(q.candidates), ms: null, search_units: 0,
    ranking: q.candidates.map((r) => ({ id: r.id, score: r.lexicalScore })) }));
  const onnxRows = onnx.rows.map((r) => ({ ...r, search_units: 0 }));
  const baselines = [
    { provider: 'lexical', rows: lexicalRows, medianPrecisionAt10: median(lexicalRows.map((r) => r.precisionAt10)),
      medianMs: null, p90Ms: null, latencyNote: 'Not measured in item 7; no synthetic zero.', ...thresholdFor(lexicalRows, pool.questions) },
    { provider: 'local-onnx', rows: onnxRows, medianPrecisionAt10: onnx.medianPrecisionAt10, medianMs: onnx.medianMs,
      p90Ms: p90(onnxRows.map((r) => r.ms)), latencyNote: 'Unchanged item-7 measurements from this device.', ...thresholdFor(onnxRows, pool.questions) },
  ];
  const output = { status: 'IN_PROGRESS', completed: false, selectionRule,
    selectionRuleRecordedBeforeCalls: 'EZIK-QAF-GAP-REPORT-D-2026-11-02.md, Step 4; report E before live calls',
    apiCalls: 0, apiCallLimit: 40, billedSearchUnits: 0, timeoutMs: 15000,
    quantileMethod: 'p90 nearest rank: ceil(0.90 * n); median arithmetic midpoint',
    candidates: { questions: 9, count: 450, perQuestion: 50, sha256: sha(candidateBytes), labelsSha256: previous.labelsSha256,
      sourceIndexSha256: previous.sourceIndexSha256, archivedInputsVerified: previous.inputs.length, limitations: previous.limitation },
    baselines, results: [] };
  const save = () => fs.writeFileSync('tools/qaf-gap/item-8-measurement.json', JSON.stringify(output, null, 2) + '\n');
  const network = globalThis.fetch;
  const fetchImpl = async (url, init) => {
    check(String(url) === 'https://api.cohere.com/v2/rerank' && init.method === 'POST' && init.redirect === 'error', 'NETWORK_FORBIDDEN');
    check(ledger.calls < 40, 'CALL_LIMIT');
    ledger.calls += 1;
    const body = JSON.parse(init.body);
    ledger.attempts.push({ number: ledger.calls, model: body.model, questionId: pool.questions.find((q) => q.question === body.query)?.id,
      startedAt: new Date().toISOString() });
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
    return network(url, init);
  };
  for (const model of models) {
    const run = createReranker({ provider: 'cohere', model, timeoutMs: output.timeoutMs, fetchImpl });
    const result = { model, rows: [], price: null };
    output.results.push(result);
    for (const q of pool.questions) {
      const started = performance.now();
      try {
        const ranking = await run(q.question, q.candidates, { topK: 50 });
        result.rows.push({ id: q.id, status: 'PASS', ms: performance.now() - started, search_units: ranking.meta.billed_units.search_units,
          precisionAt10: precisionAt10(q.candidates, ranking), ranking });
      } catch (error) {
        // Never serialize a transport exception, headers, request, or vendor body.
        const code = /^(missing_key|timeout|http_\d{3}|bad_response)$/.test(error.code) ? error.code : 'bad_response';
        result.rows.push({ id: q.id, status: 'FAIL', error: code, ms: null, failureMs: performance.now() - started,
          search_units: null, precisionAt10: null, ranking: null });
      }
      output.apiCalls = ledger.calls;
      output.billedSearchUnits = output.results.flatMap((r) => r.rows).reduce((sum, r) => sum + (r.search_units ?? 0), 0);
      save();
      console.log(JSON.stringify({ model, ...result.rows.at(-1), ranking: undefined }));
    }
    const complete = result.rows.every((q) => q.ranking);
    result.medianPrecisionAt10 = complete ? median(result.rows.map((q) => q.precisionAt10)) : null;
    result.medianMs = complete ? median(result.rows.map((q) => q.ms)) : null;
    result.p90Ms = complete ? p90(result.rows.map((q) => q.ms)) : null;
    result.search_units = result.rows.reduce((sum, q) => sum + (q.search_units ?? 0), 0);
    result.availability = complete ? 'LIVE_VALIDATED' : [...new Set(result.rows.filter((q) => q.error).map((q) => q.error))].join(',');
    Object.assign(result, complete ? thresholdFor(result.rows, pool.questions) : { threshold: null, above: null, knownX: null });
    save();
  }
  output.completed = output.results.every((r) => r.rows.every((q) => q.ranking));
  output.billingComplete = output.completed;
  output.billingNote = output.billingComplete ? 'Actual response search_units summed; no estimates.'
    : 'Sum of observed response units only; unsuccessful calls have unknown billing, never an invented zero.';
  output.selection = selectModel(output.results, lexicalRows.find((q) => q.id === 'b2').precisionAt10);
  output.status = output.selection.status;
  output.reason = output.selection.reason;
  save();
  fs.writeFileSync(path.join(proofDir, 'e-step1-live-proof.json'), JSON.stringify({ status: output.status, selection: output.selection,
    apiCalls: ledger.calls, billedSearchUnits: output.billedSearchUnits, billingComplete: output.billingComplete,
    measurementSha256: sha(fs.readFileSync('tools/qaf-gap/item-8-measurement.json')), candidates: output.candidates,
    models: output.results.map(({ rows, ...r }) => r) }, null, 2) + '\n');
  console.log(JSON.stringify({ status: output.status, selection: output.selection, calls: ledger.calls, units: output.billedSearchUnits }));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = process.argv[2] === '--select'
      ? applyPrices(process.argv[3], process.argv[4]) : await benchmark(process.argv[2], process.argv[3]);
    if (process.argv[2] === '--select') console.log(JSON.stringify(result.selection));
    process.exitCode = result.status === 'FAILED' ? 2 : result.status === 'PRICE_REQUIRED' ? 3 : 0;
  } catch {
    // Preconditions are deliberately summarized without an exception object.
    console.error('BENCHMARK_STOP: precondition or local evidence write failed; inspect local proofs.');
    process.exitCode = 1;
  }
}
