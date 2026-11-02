import test from 'node:test';
import assert from 'node:assert/strict';
import { createReranker, rerank } from '../lib/rerank/index.js';
const rows = [{ id: 'a', text: 'partial', title: 'A' }, { id: 'b', text: 'direct', title: 'B' }, { id: 'c', text: 'unrelated', title: 'C' }];

test('local ONNX pairs query/passages, loads once, scores and stably orders topK offline', async () => {
  const config = {};
  let loads = 0;
  const runtime = { env: {},
    AutoTokenizer: { from_pretrained: async (model, opts) => { config.opts = opts; loads += 1;
      return (queries, opts) => { assert.ok(queries.every((q) => q === 'question')); return { pairs: opts.text_pair }; }; } },
    AutoModelForSequenceClassification: { from_pretrained: async () => async ({ pairs }) => ({ logits: { dims: [pairs.length, 1],
      data: Float32Array.from(pairs.map((p) => p.includes('direct') ? 3 : p.includes('partial') ? 0 : -3)) } }) },
  };
  const run = createReranker({ provider: 'local-onnx', modelPath: '/local/model', env: {}, loadRuntime: async () => runtime });
  assert.deepEqual((await run('question', rows, { topK: 2 })).map((r) => r.id), ['b', 'a']);
  await run('question', rows);
  assert.equal(loads, 1);
  assert.equal(runtime.env.allowRemoteModels, false);
  assert.equal(config.opts.local_files_only, true);
});

test('pointwise scores are bounded, requests run in a bounded pool, and IDs stay input-owned', async () => {
  let active = 0, peak = 0;
  const run = createReranker({ provider: 'anthropic-pointwise', env: { ANTHROPIC_API_KEY: 'local-stub-key', RERANK_CONCURRENCY: '2' },
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      peak = Math.max(peak, ++active);
      const body = JSON.parse(init.body), input = JSON.parse(body.messages[0].content);
      await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1;
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ score: input.passage === 'direct' ? 10 : input.passage === 'partial' ? 5 : 0 }) }] }) };
    } });
  assert.deepEqual(await run('question', rows, { topK: 2 }), [{ id: 'b', score: 10 }, { id: 'a', score: 5 }]);
  assert.equal(peak, 2);
  const invalid = createReranker({ provider: 'anthropic-pointwise', env: { ANTHROPIC_API_KEY: 'local-stub-key' },
    fetchImpl: async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"score":99}' }] }) }) });
  await assert.rejects(invalid('question', rows), /RERANK_SCORE_INVALID/);
});

test('no implicit provider, credential fallback, duplicate IDs, or invented scores', async () => {
  await assert.rejects(rerank('question', rows), /RERANK_PROVIDER_REQUIRED/);
  const run = createReranker({ provider: 'anthropic-pointwise', env: {}, fetchImpl: () => assert.fail('no credentials') });
  await assert.rejects(run('question', rows), /ANTHROPIC_API_KEY_MISSING/);
  await assert.rejects(run('question', [rows[0], rows[0]]), /RERANK_IDS_INVALID/);
  await assert.rejects(run('question', Array.from({ length: 51 }, (_, i) => ({ id: String(i), text: 'text' }))), /RERANK_CANDIDATES_LIMIT/);
});
