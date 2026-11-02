import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { select, costFor } from '../tools/qaf-gap/item-8-v5-benchmark.mjs';
import { passesRerankCardMin } from '../lib/rerank/card.js';
const fixture = (model, cost, latency, accuracy = 0.8, b2 = 0.9) => ({ model, cost: { usd: cost }, p90Ms: latency,
  medianPrecisionAt10: accuracy, threshold: 4, rows: ['a1','a2','a3','b1','b2','b3','c1','c2','c3'].map((id) => ({ id,
    ranking: [{ score: 4, relevance_score: 0.4 }], precisionAt10: id === 'b2' ? b2 : accuracy })) });
test('selection compares measured dollar totals, B2 floor and p90 on equal costs', () => {
  assert.equal(select([fixture('cheap', 0.01, 900), fixture('fast', 0.01, 400), fixture('badB2', 0.001, 100, 0.9, 0.8)]).model, 'fast');
  assert.equal(select([fixture('fallback', 1, 100, 0.7)]).status, 'NEEDS_OWNER');
  assert.equal(select([fixture('failed', 1, 100, 0.6)]).status, 'FAILED');
});
test('token billing uses owner rate; mismatched billing uses same-question predecessor bound', () => {
  const old = { model: 'rerank-v4.0-fast', rows: [{ id: 'a1', search_units: 2 }] };
  assert.equal(costFor({ model: 'rerank-v5.0-fast', rows: [{ id: 'a1', billed_units: { tokens: 1000 } }] }, [old]).usd, 0.00002);
  const bound = costFor({ model: 'rerank-v5.0-fast', rows: [{ id: 'a1', billed_units: { search_units: 2 } }] }, [old]);
  assert.equal(bound.usd, 0.004); assert.equal(bound.upperBound, true);
});
test('production score boundary suppresses equality and displays a score strictly above it', () => {
  const m = JSON.parse(fs.readFileSync('tools/qaf-gap/item-8-measurement.json', 'utf8'));
  const minimum = m.selection.card_min ?? 4;
  assert.equal(passesRerankCardMin(minimum, minimum), false);
  assert.equal(passesRerankCardMin(minimum + 1e-10, minimum), true);
  assert.equal(passesRerankCardMin(NaN, minimum), false);
  if (m.selection.model) assert.equal(m.selection.raw_relevance_score * 10, minimum);
});
