// Explicit F1 measurement only. Never imported by production API entries.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createReranker } from '../../lib/rerank/index.js';
import { precisionAt10 } from './item-7-benchmark.mjs';
import { median, p90, thresholdFor } from './item-8-benchmark.mjs';

export const rule = 'Choose the lowest measured nine-question dollar cost among complete models with median precision@10 >= 0.8 and B2 >= 0.9; break equal costs by lower p90 latency. If no model reaches 0.8, choose the best reaching 0.7 with NEEDS_OWNER; if none reaches 0.7, FAILED and stop. Rejected API names are excluded. RERANK_CARD_MIN is the highest X score on the production 0..10 scale; only strictly greater scores show cards.';
const sha = (data) => createHash('sha256').update(data).digest('hex');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const check = (ok, message) => { if (!ok) throw new Error(message); };
const source1 = 'https://www.usagepricing.com/blueprint/activity/cohere-2026-10-23-rerank-5-per-token-pricing';
export const prices = [
  { model: 'rerank-v5.0-fast', unit: 'tokens', usdPerUnit: 0.02 / 1e6, displayedRate: '$0.02 / million tokens', source: source1, capturedAt: '2026-10-23', predecessor: 'rerank-v4.0-fast' },
  { model: 'rerank-v5.0-pro', unit: 'tokens', usdPerUnit: 0.05 / 1e6, displayedRate: '$0.05 / million tokens', source: source1, capturedAt: '2026-10-23', predecessor: 'rerank-v4.0-pro' },
  { model: 'rerank-v4.0-fast', unit: 'search_units', usdPerUnit: 2 / 1000, displayedRate: '$2.00 / 1000 search units', source: source1, capturedAt: '2026-10-16' },
  { model: 'rerank-v4.0-pro', unit: 'search_units', usdPerUnit: 2.5 / 1000, displayedRate: '$2.50 / 1000 search units', source: source1, capturedAt: '2026-10-16' },
  { model: 'rerank-v3.5', unit: 'search_units', usdPerUnit: 0.002, displayedRate: '$0.002 / search unit', source: 'https://aws.amazon.com/marketplace/pp/prodview-6q7el2wk6xcmo', note: 'Cohere seller; Bedrock version, not Cohere current price table' },
].map((p) => ({ ...p, readAt: '2026-11-02', evidence: 'Owner-supplied directive F; no pricing website visited' }));

export function costFor(result, all) {
  const price = prices.find((p) => p.model === result.model);
  let upperBound = false;
  const rows = result.rows.map((row) => {
    const billed = row.billed_units ?? (price.unit === 'search_units' ? { search_units: row.search_units } : null);
    const tokenKeys = ['input_tokens', 'output_tokens'];
    const units = price.unit === 'tokens' && billed?.tokens === undefined && tokenKeys.some((k) => billed?.[k] !== undefined)
      ? tokenKeys.reduce((sum, k) => sum + (billed[k] ?? 0), 0) : billed?.[price.unit];
    if (Number.isSafeInteger(units) && units >= 0) return { id: row.id, units, unit: price.unit, usd: units * price.usdPerUnit, upperBound: false };
    check(price.predecessor, 'MISSING_BILLING_WITHOUT_PREDECESSOR');
    upperBound = true;
    const predecessor = all.find((r) => r.model === price.predecessor);
    const old = predecessor.rows.find((r) => r.id === row.id);
    const oldPrice = prices.find((p) => p.model === price.predecessor);
    check(Number.isSafeInteger(old.search_units), 'MISSING_PREDECESSOR_BILLING');
    return { id: row.id, units: old.search_units, unit: 'search_units', usd: old.search_units * oldPrice.usdPerUnit,
      upperBound: true, reason: 'Expected token billing absent or different; directive F predecessor bound', predecessor: price.predecessor };
  });
  return { usd: rows.reduce((s, r) => s + r.usd, 0), upperBound, rows };
}
export function select(results) {
  const complete = results.filter((r) => r.rows.length === 9 && r.rows.every((q) => q.ranking && Number.isFinite(q.precisionAt10)));
  const eligible = complete.filter((r) => r.medianPrecisionAt10 >= 0.8 && r.rows.find((q) => q.id === 'b2').precisionAt10 >= 0.9)
    .sort((a, b) => a.cost.usd - b.cost.usd || a.p90Ms - b.p90Ms);
  let winner = eligible[0], status = 'PASS';
  if (!winner) {
    if (complete.some((r) => r.medianPrecisionAt10 >= 0.8)) return { status: 'FAILED', model: null, card_min: null, reason: 'B2 floor not met' };
    winner = complete.filter((r) => r.medianPrecisionAt10 >= 0.7).sort((a, b) => b.medianPrecisionAt10 - a.medianPrecisionAt10 || a.p90Ms - b.p90Ms)[0];
    status = winner ? 'NEEDS_OWNER' : 'FAILED';
  }
  return { status, model: winner?.model ?? null, card_min: winner?.threshold ?? null,
    raw_relevance_score: winner ? Math.max(...winner.rows.flatMap((r) => r.ranking).filter((r) => r.score === winner.threshold).map((r) => r.relevance_score ?? r.score / 10)) : null,
    scale: 'production score = raw relevance_score * 10', costUsd: winner?.cost.usd ?? null };
}

// The immutable D provider requires search_units. F explicitly requires continuing
// when billing changes. Validate the numeric evidence intercepted from the same
// response offline; never synthesize billing or repeat a paid call.
export function finalizeSaved(proofDirectory) {
  const file = 'tools/qaf-gap/item-8-measurement.json';
  const output = read(file), ledger = read(path.join(proofDirectory, 'f-live-call-ledger.json'));
  const pool = read('node_modules/.cache/qaf-gap/item-7-candidates.json');
  check(ledger.calls === 18 && ledger.attempts.length === 18, 'EXACT_18_REQUIRED');
  for (const result of output.results.filter((r) => r.model.startsWith('rerank-v5.'))) {
    for (const row of result.rows) {
      const a = ledger.attempts.find((a) => a.model === result.model && a.questionId === row.id);
      const q = pool.questions.find((q) => q.id === row.id);
      if (a.httpStatus !== 200 || !Array.isArray(a.results)) continue;
      check(a.results.length === 50 && new Set(a.results.map((r) => r.index)).size === 50, 'INVALID_RESULT_COUNT');
      check(a.results.every((r) => Number.isInteger(r.index) && r.index >= 0 && r.index < 50 && Number.isFinite(r.relevance_score) && r.relevance_score >= 0 && r.relevance_score <= 1), 'INVALID_SCORES');
      const ranking = a.results.map((r) => ({ id: q.candidates[r.index].id, score: r.relevance_score * 10, relevance_score: r.relevance_score, index: r.index }))
        .sort((a, b) => b.score - a.score || a.index - b.index).map(({ index, ...r }) => r);
      Object.assign(row, { status: 'PASS', providerOutcome: row.error ?? 'PASS',
        observationNote: 'Exact live scores independently validated offline; unchanged D provider rejected input_tokens billing because it requires search_units.',
        ms: row.ms ?? row.failureMs, billed_units: a.billed_units, precisionAt10: precisionAt10(q.candidates, ranking), ranking });
      delete row.error;
    }
    const complete = result.rows.every((r) => r.ranking);
    Object.assign(result, { medianPrecisionAt10: complete ? median(result.rows.map((r) => r.precisionAt10)) : null,
      medianMs: complete ? median(result.rows.map((r) => r.ms)) : null, p90Ms: complete ? p90(result.rows.map((r) => r.ms)) : null,
      availability: complete ? 'LIVE_SCORES_OFFLINE_VALIDATED' : 'EXCLUDED_INCOMPLETE' }, complete ? thresholdFor(result.rows, pool.questions) : { threshold: null });
  }
  for (const r of output.results) r.cost = costFor(r, output.results);
  output.selection = select(output.results); output.status = output.selection.status;
  output.f.billingNote = 'v5 literal input_tokens are token billing at owner rate; all fields preserved. No billing invented. D provider unchanged; numeric live scores verified offline after its legacy search_units check rejected token billing.';
  output.f.apiCalls = ledger.calls;
  fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
  return output;
}

export async function benchmark(archiveRoot, proofDirectory) {
  check(process.versions.node.split('.')[0] === '22' && !!process.env.COHERE_API_KEY?.trim(), 'NODE22_AND_KEY_REQUIRED');
  const file = 'tools/qaf-gap/item-8-measurement.json';
  const output = read(file);
  check(output.results.length === 3 && output.apiCalls === 27, 'ORIGINAL_E_ONLY');
  const eLedger = read(path.join(proofDirectory, 'e-live-call-ledger.json'));
  const candidateFile = 'node_modules/.cache/qaf-gap/item-7-candidates.json';
  check(sha(fs.readFileSync(candidateFile)) === output.candidates.sha256, 'POOL_CHANGED');
  check(sha(fs.readFileSync('tools/qaf-gap/item-7-labels.json')) === output.candidates.labelsSha256, 'LABELS_CHANGED');
  const previous = read('tools/qaf-gap/item-7-measurement.json');
  check(sha(fs.readFileSync('lib/data/fiqh-search.json.gz')) === previous.sourceIndexSha256, 'INDEX_CHANGED');
  for (const input of previous.inputs) check(sha(fs.readFileSync(path.join(archiveRoot, 'sessions/side-qaf-live-2026-11-02/retrieval', input.file))) === input.sha256, 'ARCHIVE_CHANGED');
  const pool = read(candidateFile);
  check(pool.questions.length === 9 && pool.questions.every((q) => q.candidates.length === 50), 'POOL_NOT_450');
  const ledgerPath = path.join(proofDirectory, 'f-live-call-ledger.json');
  check(!fs.existsSync(ledgerPath), 'NO_AUTOMATIC_REPLAY');
  const report = fs.readFileSync(path.join(proofDirectory, 'EZIK-QAF-GAP-REPORT-F-2026-11-02.md'), 'utf8');
  check(report.includes(rule), 'RULE_NOT_RECORDED');
  fs.writeFileSync(path.join(proofDirectory, 'f-rule-before-calls.json'), JSON.stringify({ rule, reportSha256: sha(report), recordedAt: new Date().toISOString(), calls: 0 }, null, 2) + '\n');
  const ledger = { calls: 0, cap: 20, planned: 18, attempts: [] };
  const saveLedger = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  const save = () => fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
  const network = globalThis.fetch;
  let attempt;
  const fetchImpl = async (url, init) => {
    check(String(url) === 'https://api.cohere.com/v2/rerank' && init.method === 'POST' && init.redirect === 'error', 'NETWORK_FORBIDDEN');
    const body = JSON.parse(init.body);
    check(Object.keys(body).sort().join(',') === 'documents,model,query,top_n' && body.top_n === 50, 'BODY_CHANGED');
    const questionId = pool.questions.find((q) => q.question === body.query)?.id;
    check(questionId && ![...eLedger.attempts, ...ledger.attempts].some((r) => r.model === body.model && r.questionId === questionId), 'DUPLICATE_PAIR');
    check(ledger.calls < 20, 'CALL_CAP');
    attempt = { number: ++ledger.calls, model: body.model, questionId, startedAt: new Date().toISOString() };
    ledger.attempts.push(attempt); saveLedger();
    const response = await network(url, init);
    attempt.httpStatus = response.status;
    // Capture only the exact billing object and numeric ranking evidence. Never headers/vendor errors.
    if (response.ok) {
      const payload = await response.clone().json();
      attempt.billed_units = payload?.meta?.billed_units ?? null;
      attempt.results = payload?.results?.map(({ index, relevance_score }) => ({ index, relevance_score })) ?? null;
    }
    saveLedger();
    return response;
  };
  output.f = { rule, apiCallLimit: 20, plannedCalls: 18, timeoutMs: 15000, providerUnmodifiedSha256: sha(fs.readFileSync('lib/rerank/cohere.js')) };
  output.pricing = { readAt: '2026-11-02', authority: 'Owner directive F', table: prices,
    additionalSources: ['https://docs.cohere.com/changelog/rerank-v5.md', 'https://docs.cohere.com/docs/rerank.md'] };
  for (const model of ['rerank-v5.0-fast', 'rerank-v5.0-pro']) {
    const run = createReranker({ provider: 'cohere', model, timeoutMs: 15000, fetchImpl });
    const result = { model, rows: [] }; output.results.push(result);
    for (const q of pool.questions) {
      const started = performance.now();
      try {
        const ranking = await run(q.question, q.candidates, { topK: 50 });
        const raw = new Map(attempt.results.map((r) => [q.candidates[r.index].id, r.relevance_score]));
        result.rows.push({ id: q.id, status: 'PASS', ms: performance.now() - started, billed_units: attempt.billed_units,
          search_units: ranking.meta.billed_units.search_units, precisionAt10: precisionAt10(q.candidates, ranking),
          ranking: ranking.map((r) => ({ ...r, relevance_score: raw.get(r.id) })) });
      } catch (error) {
        const code = /^(missing_key|timeout|http_\d{3}|bad_response)$/.test(error.code) ? error.code : 'bad_response';
        result.rows.push({ id: q.id, status: 'FAIL', error: code, ms: null, failureMs: performance.now() - started,
          billed_units: attempt?.billed_units ?? null, precisionAt10: null, ranking: null });
      }
      attempt.outcome = result.rows.at(-1).status; saveLedger(); save();
      console.log(JSON.stringify({ model, ...result.rows.at(-1), ranking: undefined }));
    }
    const complete = result.rows.every((r) => r.ranking);
    Object.assign(result, { medianPrecisionAt10: complete ? median(result.rows.map((r) => r.precisionAt10)) : null,
      medianMs: complete ? median(result.rows.map((r) => r.ms)) : null, p90Ms: complete ? p90(result.rows.map((r) => r.ms)) : null,
      availability: complete ? 'LIVE_VALIDATED' : 'EXCLUDED_INCOMPLETE' }, complete ? thresholdFor(result.rows, pool.questions) : { threshold: null });
  }
  for (const r of output.results) r.cost = costFor(r, output.results);
  output.f.apiCalls = ledger.calls;
  output.selection = select(output.results); output.status = output.selection.status;
  output.reason = rule; save();
  console.log(JSON.stringify({ selection: output.selection, calls: ledger.calls, models: output.results.map((r) => ({ model: r.model, cost: r.cost.usd, upperBound: r.cost.upperBound, median: r.medianPrecisionAt10, p90: r.p90Ms })) }));
  return output;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = process.argv[2] === '--finalize-saved' ? finalizeSaved(process.argv[3]) : await benchmark(process.argv[2], process.argv[3]); console.log(JSON.stringify(result.selection)); process.exitCode = result.status === 'FAILED' ? 2 : 0; }
  catch { console.error('F1_STOP: local precondition or evidence failure; inspect proofs without replaying calls.'); process.exitCode = 1; }
}
