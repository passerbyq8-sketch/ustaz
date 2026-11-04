import test from 'node:test';
import assert from 'node:assert/strict';
import { maxMerge } from '../lib/sync/merge.js';

test('own prototype-named keys are data and never change the result prototype', () => {
  const incoming = JSON.parse('{"__proto__":{"canary":1},"constructor":7,"toString":8}');
  for (const newer of [true, false]) {
    for (const [a, b] of [[{}, incoming], [incoming, {}]]) {
      const out = maxMerge(a, b, newer);
      assert.ok(Object.hasOwn(out, '__proto__'));
      assert.equal(Object.getPrototypeOf(out), Object.prototype);
      assert.equal(out.canary, undefined);
      assert.equal(out.constructor, 7);
      assert.equal(out.toString, 8);
      assert.equal({}.canary, undefined);
    }
  }
});
test('inherited values cannot override an own counter key, including nested keys', () => {
  const old = Object.create({ points: 10000 });
  const incoming = { points: 3, nested: JSON.parse('{"__proto__":{"n":2}}') };
  const out = maxMerge(old, incoming, false);
  assert.equal(out.points, 3);
  const nested = maxMerge({ nested: {} }, incoming, false);
  assert.ok(Object.hasOwn(nested.nested, '__proto__'));
  assert.equal(nested.nested.n, undefined);
});
test('ordinary numeric maxima, array unions and timestamp precedence remain unchanged', () => {
  assert.deepEqual(maxMerge({ score: 9, inner: { n: 1 }, list: [1, 2], text: 'old' }, { score: 4, inner: { n: 7 }, list: [2, 3], text: 'new' }, true), { score: 9, inner: { n: 7 }, list: [1, 2, 3], text: 'new' });
  assert.equal(maxMerge('old', 'new', false), 'old');
});
