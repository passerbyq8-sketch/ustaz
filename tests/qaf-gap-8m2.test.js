import test from 'node:test';
import assert from 'node:assert/strict';
import { median, p90, thresholdFor, selectModel } from '../tools/qaf-gap/item-8-benchmark.mjs';

const measured = (model, accuracy, b2, price, latency = 500) => ({ model, medianPrecisionAt10: accuracy, p90Ms: latency,
  threshold: 4, price: price === null ? null : { usdPer1000SearchUnits: price },
  rows: ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'].map((id) => ({ id,
    precisionAt10: id === 'b2' ? b2 : accuracy, ranking: [{ id: 'fixture', score: 8 }] })) });

test('live selection honors cost, B2 floor, then measured p90, without guessing prices', () => {
  const costly = measured('costly', 0.9, 0.9, 5);
  const cheap = measured('cheap', 0.8, 0.9, 2);
  const faster = measured('faster', 0.8, 0.9, 2, 400);
  const regressesB2 = measured('regression', 0.9, 0.8, 1);
  assert.equal(selectModel([costly, cheap, faster, regressesB2], 0.9).model, 'faster');
  assert.equal(selectModel([measured('unknown-price', 0.8, 0.9, null)], 0.9).status, 'PRICE_REQUIRED');
  assert.equal(selectModel([regressesB2], 0.9).status, 'FAILED');
});

test('live selection keeps the predeclared 0.7 fallback and fails below it or on incomplete measurements', () => {
  assert.equal(selectModel([measured('fallback', 0.7, 0.8, null)], 0.9).status, 'NEEDS_OWNER');
  assert.equal(selectModel([measured('below', 0.6, 0.9, 1)], 0.9).status, 'FAILED');
  const partial = measured('partial', 0.9, 1, 1);
  partial.rows[0].ranking = null;
  assert.equal(selectModel([partial], 0.9).status, 'FAILED');
});

test('measurement quantiles and strict highest-X cutoff retain ties below the display boundary', () => {
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(p90([1, 2, 3, 4, 5, 6, 7, 8, 9]), 9);
  const candidates = [
    { id: 'ezik:b3#4', label: 'X' }, { id: 'ezik:b3#5', label: 'X' }, { id: 'ezik:c1#3', label: 'X' },
    { id: 'tie', label: 'R' }, { id: 'direct', label: 'R' }, { id: 'partial', label: 'P' },
  ];
  const ranking = candidates.map((r, i) => ({ id: r.id, score: [2, 4, 3, 4, 5, 6][i] }));
  const result = thresholdFor([{ id: 'fixture', ranking }], [{ id: 'fixture', candidates }]);
  assert.equal(result.threshold, 4);
  assert.deepEqual(result.above, { R: 1, P: 1, X: 0 });
  assert.ok(result.knownX.every((r) => r.suppressed));
});
