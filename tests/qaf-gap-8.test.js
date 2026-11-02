import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createReranker } from '../lib/rerank/index.js';
import { CohereRerankError } from '../lib/rerank/cohere.js';

const localStubKey = 'local-stub-key';
const candidates = [
  { id: 'a', text: 'partial passage', account: 'must-stay-local' },
  { id: 'b', text: 'direct passage', name: 'must-stay-local' },
  { id: 'c', snippet: 'unrelated passage', device: 'must-stay-local' },
];
const valid = () => ({ results: [{ index: 1, relevance_score: 0.95 }, { index: 0, relevance_score: 0.4 }, { index: 2, relevance_score: 0 }],
  meta: { billed_units: { search_units: 2 } } });

async function fixture(t, handler) {
  const original = process.env.COHERE_API_KEY;
  process.env.COHERE_API_KEY = localStubKey;
  t.after(() => { if (original === undefined) delete process.env.COHERE_API_KEY; else process.env.COHERE_API_KEY = original; });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  let calls = 0;
  const fetchImpl = (url, init) => {
    assert.equal(url, 'https://api.cohere.com/v2/rerank');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.authorization === 'Bearer ' + localStubKey, true);
    calls += 1;
    return fetch('http://127.0.0.1:' + server.address().port, init);
  };
  return { run: (options = {}) => createReranker({ provider: 'cohere', fetchImpl, ...options }), calls: () => calls };
}
const send = (res, payload) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error instanceof CohereRerankError && error.code === code && error.message === 'RERANK_COHERE_' + code);

test('Cohere local HTTP: ordering, 0..10 scores, actual billing, and text-only request contract', async (t) => {
  let received;
  const f = await fixture(t, async (req, res) => {
    assert.equal(req.method, 'POST');
    let text = ''; for await (const chunk of req) text += chunk;
    received = JSON.parse(text);
    send(res, valid());
  });
  const ranking = await f.run({ model: 'rerank-v4.0-fast' })('question text', candidates);
  assert.deepEqual(ranking, [{ id: 'b', score: 9.5 }, { id: 'a', score: 4 }, { id: 'c', score: 0 }]);
  assert.equal(ranking.meta.billed_units.search_units, 2);
  assert.deepEqual(received, { model: 'rerank-v4.0-fast', query: 'question text', documents: ['partial passage', 'direct passage', 'unrelated passage'], top_n: 3 });
  assert.equal(JSON.stringify(received).includes('must-stay-local'), false);
  assert.equal(f.calls(), 1);
});

test('Cohere local HTTP: topK sends top_n and maps only server-returned indices', async (t) => {
  const f = await fixture(t, (req, res) => { const payload = valid(); payload.results = payload.results.slice(0, 1); send(res, payload); });
  const ranking = await f.run()('question', candidates, { topK: 1 });
  assert.deepEqual(ranking, [{ id: 'b', score: 9.5 }]);
});

test('Cohere local HTTP: timeout aborts fetch and also covers slow JSON response bodies', async (t) => {
  const f = await fixture(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' }); res.write('{');
  });
  const started = performance.now();
  await rejectsCode(f.run({ timeoutMs: 80 })('question', candidates), 'timeout');
  assert.ok(performance.now() - started < 1000);
});

test('Cohere local HTTP: 401 and model rejection have sanitized classified errors', async (t) => {
  for (const status of [401, 404, 429, 500]) {
    await t.test(String(status), async (t) => {
      const f = await fixture(t, (req, res) => { res.writeHead(status); res.end('untrusted provider error'); });
      await rejectsCode(f.run()('question', candidates), 'http_' + status);
    });
  }
});

test('Cohere local HTTP: malformed JSON and non-JSON content fail closed', async (t) => {
  for (const type of ['application/json', 'text/html']) {
    await t.test(type, async (t) => {
      const f = await fixture(t, (req, res) => { res.writeHead(200, { 'content-type': type }); res.end('broken JSON'); });
      await rejectsCode(f.run()('question', candidates), 'bad_response');
    });
  }
});

test('Cohere local HTTP: strict response validation rejects missing, duplicate and invalid scores/units/indices', async (t) => {
  const mutations = [
    (p) => { delete p.results; }, (p) => { p.results.pop(); },
    (p) => { p.results[1].index = 1; }, (p) => { p.results[0].index = 3; },
    (p) => { p.results[0].index = -1; }, (p) => { p.results[0].index = 0.5; },
    (p) => { p.results[0].relevance_score = 1.01; }, (p) => { p.results[0].relevance_score = -0.01; },
    (p) => { p.results[0].relevance_score = '0.9'; }, (p) => { p.results[0] = null; },
    (p) => { delete p.meta; }, (p) => { p.meta.billed_units.search_units = -1; },
    (p) => { p.meta.billed_units.search_units = 0.5; }, (p) => { p.meta.billed_units.search_units = '1'; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    await t.test(String(index), async (t) => {
      const f = await fixture(t, (req, res) => { const payload = valid(); mutate(payload); send(res, payload); });
      await rejectsCode(f.run()('question', candidates), 'bad_response');
    });
  }
});

test('Cohere uses only the process key, rejects >50 candidates before HTTP, and never invents scores', async (t) => {
  const f = await fixture(t, () => assert.fail('no HTTP expected'));
  delete process.env.COHERE_API_KEY;
  const run = f.run({ env: { COHERE_API_KEY: localStubKey } });
  await rejectsCode(run('question', candidates), 'missing_key');
  process.env.COHERE_API_KEY = localStubKey;
  await assert.rejects(run('question', Array.from({ length: 51 }, (_, i) => ({ id: String(i), text: 'text' }))), /RERANK_CANDIDATES_LIMIT/);
  await assert.rejects(run('question', [candidates[0], candidates[0]]), /RERANK_IDS_INVALID/);
  await assert.rejects(run('question', [{ id: 'a', text: {} }]), /RERANK_PASSAGE_REQUIRED/);
  const empty = await run('question', []);
  assert.deepEqual(empty, []);
  assert.equal(empty.meta.billed_units.search_units, 0);
  assert.equal(f.calls(), 0);
});

test('Cohere sanitizes transport exceptions instead of exposing their messages or causes', async (t) => {
  const f = await fixture(t, () => assert.fail('no HTTP expected'));
  const run = f.run({ fetchImpl: async () => { throw new Error('untrusted transport details'); } });
  await rejectsCode(run('question', candidates), 'bad_response');
});
