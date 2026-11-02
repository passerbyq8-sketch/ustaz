import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { rerankPools, RERANK_DAILY_CAP, RERANK_CARD_MIN, RERANK_CONSENT_VERSION, RESERVE } from '../lib/rerank/runtime.js';
import { createCohereReranker } from '../lib/rerank/cohere.js';
import { createBw2Releaser } from '../lib/bw2-units.js';
import { gatherRerankPools } from '../lib/bw2-rerank.js';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';

const localStubKey = 'local-stub-key';
const env = { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' };
const consentVersion = RERANK_CONSENT_VERSION;
const rows = Array.from({ length: 15 }, (_, i) => ({ ...ROW, title: 'row-' + i, url: ROW.url + '/' + i, recordId: String(i),
  name: 'private-name', age: 42, account: 'private-account', device: 'private-device', identity: 'private-identity' }));
function store() {
  const counts = new Map(), calls = [];
  return { counts, calls, async evalScript(script, keys, args) {
    calls.push({ script, keys, args });
    const used = counts.get(keys[0]) || 0;
    if (script === RESERVE) { if (used + args[0] > args[1]) return 0; counts.set(keys[0], used + args[0]); }
    else counts.set(keys[0], used + args[0]);
    return 1;
  } };
}
async function fixture(t, handler) {
  const previous = process.env.COHERE_API_KEY;
  process.env.COHERE_API_KEY = localStubKey;
  t.after(() => { if (previous === undefined) delete process.env.COHERE_API_KEY; else process.env.COHERE_API_KEY = previous; });
  let received = [], calls = 0;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body); received.push(parsed);
    if (handler) return handler(parsed, res);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ results: parsed.documents.map((_, i) => ({ index: i, relevance_score: (i + 1) / parsed.documents.length }))
      .reverse().slice(0, parsed.top_n), meta: { billed_units: { input_tokens: 1234 } } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const fetchImpl = (url, init) => { assert.equal(url, 'https://api.cohere.com/v2/rerank'); calls++; return fetch('http://127.0.0.1:' + server.address().port, init); };
  return { fetchImpl, received, calls: () => calls };
}
const opts = (f, extra = {}) => ({ pools: [{ question: 'plain question', rows }], env, consentVersion,
  remainingMs: 1200, fetchImpl: f.fetchImpl, store: store(), ...extra });

test('local HTTP reranks top ten, counts literal tokens, and transmits only query and passage texts', async (t) => {
  const f = await fixture(t), db = store();
  const r = await rerankPools(opts(f, { store: db }));
  assert.equal(r.ok, true); assert.equal(r.telemetry.rerank_used, 1); assert.equal(r.telemetry.rerank_units, 1234);
  assert.equal(r.pools[0].rows.length, 10); assert.equal(r.pools[0].rows[0].recordId, '14');
  assert.equal(r.pools[0].rows[0].rerankScore, 10); assert.equal(r.pools[0].rows[0].rerankCardMin, RERANK_CARD_MIN);
  assert.deepEqual(Object.keys(f.received[0]).sort(), ['documents','model','query','top_n']);
  assert.equal(f.received[0].model, 'rerank-v5.0-fast'); assert.equal(f.received[0].top_n, 10);
  assert.equal(/private-|identity|account|age|device/.test(JSON.stringify(f.received)), false);
  assert.equal([...db.counts.values()][0], 1234); assert.equal(db.calls[0].args[1], RERANK_DAILY_CAP);
  assert.match(db.calls[0].keys[0], /^ezik:rerank-budget:v1:\d{4}-\d{2}-\d{2}$/);
  assert.ok(db.calls[0].args[2] > Date.now() / 1000);
  assert.equal(RERANK_DAILY_CAP * 0.02 / 1e6, 4);
});

test('off, no consent, stale consent, missing key, cap and unavailable KV never reach Cohere', async (t) => {
  const f = await fixture(t);
  for (const [extra, code] of [[{ env: {} },0], [{ consentVersion: '' },1], [{ consentVersion: '2026-08-06-1' },1],
    [{ env: { RERANK_V1: 'on' } },7],
    [{ env: { ...env, RERANK_DAILY_CAP: '0' } },4], [{ store: { evalScript: async () => null } },5], [{ store: { evalScript: async () => { throw Error('kv'); } } },5]]) {
    const r = await rerankPools(opts(f, extra)); assert.equal(r.ok, false); assert.equal(r.telemetry.rerank_fallback_code, code);
  }
  delete process.env.COHERE_API_KEY;
  assert.equal((await rerankPools(opts(f))).telemetry.rerank_fallback_code, 2);
  assert.equal(f.calls(), 0);
});

test('timeout uses remaining retrieval budget and is distinct from HTTP errors; reservations remain charged', async (t) => {
  const f = await fixture(t, () => {}), db = store(), started = Date.now();
  const r = await rerankPools(opts(f, { remainingMs: 40, store: db }));
  assert.equal(r.telemetry.rerank_fallback_code, 3); assert.equal(r.telemetry.rerank_timeouts, 1); assert.equal(r.telemetry.rerank_errors, 0);
  assert.ok(Date.now() - started < 500); assert.equal([...db.counts.values()][0], rows.length * 65536);
  const err = await fixture(t, (_, res) => { res.writeHead(401); res.end(); });
  const failed = await rerankPools(opts(err));
  assert.equal(failed.telemetry.rerank_errors, 1); assert.equal(failed.telemetry.rerank_timeouts, 0);
});

test('missing billing uses conservative two-window reservation; malformed billing remains invalid', async (t) => {
  const f = await fixture(t, (body, res) => { res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ results: body.documents.map((_, index) => ({ index, relevance_score: 0.8 })).slice(0, body.top_n) })); });
  const db = store(), r = await rerankPools(opts(f, { store: db }));
  assert.equal(r.ok, true); assert.equal(r.telemetry.rerank_units, rows.length * 65536);
  assert.equal(db.calls.length, 1);
  const ranking = await createCohereReranker({ fetchImpl: f.fetchImpl })('plain question', rows.map((r) => ({ ...r, id: r.recordId })), { topK: 10 });
  assert.equal(ranking.meta.billed_units, null);
});

test('concurrent reservations enforce the spend cap before transport', async (t) => {
  const f = await fixture(t), db = store();
  const options = opts(f, { store: db, env: { ...env, RERANK_DAILY_CAP: String(rows.length * 65536) } });
  const answers = await Promise.all(Array.from({ length: 8 }, () => rerankPools(options)));
  assert.equal(answers.filter((r) => r.ok).length, 1); assert.equal(f.calls(), 1);
});

test('preview and production share one daily spend cap in the same KV store', async (t) => {
  const f = await fixture(t, (_, res) => { res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }], meta: { billed_units: { input_tokens: 65536 } } })); });
  const db = store();
  const options = opts(f, { store: db, pools: [{ question: 'plain question', rows: rows.slice(0, 1) }] });
  const preview = await rerankPools({ ...options, env: { ...env, VERCEL_ENV: 'preview', RERANK_DAILY_CAP: '65536' } });
  const production = await rerankPools({ ...options, env: { ...env, VERCEL_ENV: 'production', RERANK_DAILY_CAP: '65536' } });
  assert.equal(preview.ok, true); assert.equal(production.ok, false);
  assert.equal(production.telemetry.rerank_fallback_code, 4); assert.equal(f.calls(), 1);
});

test('expanded retrieval asks tolerant fatwas up to 50 and library within its existing 30-row ceiling, per part', async () => {
  const asked = [], parts = [{ text: 'first issue' }, { text: 'second issue' }];
  const pools = await gatherRerankPools({ question: 'whole', parts, queryFor: String, budgetMs: 200, band: 'adult', libFlagValue: 'on', libToken: localStubKey,
    deps: { searchFatwas: async (ctx, options) => { asked.push({ ctx, options }); return { records: [{ id: ctx.currentQuestion, title: 'fatwa', question: ctx.currentQuestion, answer: 'answer' }] }; },
      searchStoredCorpus: async () => ({ records: [] }), runTool: async (_, input, ctx) => { assert.equal(ctx.resultCap, 30); ctx.table.add({ kind: 'lib_book', recordId: 'lib-' + input.query, text: 'passage' }); } } });
  assert.deepEqual(asked.map((a) => a.ctx.currentQuestion), parts.map((p) => p.text));
  assert.ok(asked.every((a) => a.options.rerankPool === true)); assert.equal(pools.length, 2);
  assert.ok(pools.every((p, i) => p.rows.length === 2 && p.rows.every((r) => r.qpart === i)));
});

test('real BW2 linkage gives reordered top ten to the unchanged judge, with identity excluded', async (t) => {
  const f = await fixture(t);
  const r = await turn({ rows, env: { ...env, BW2_RETRIEVAL_MS: '1200' }, extra: { aiConsentVersion: consentVersion, requestedIdentity: { name: 'private-name' } },
    extraDeps: { searchFatwas: async () => ({ records: rows.map((r) => ({ ...r, id: r.recordId, question: 'question', answer: r.text })) }), rerankFetch: f.fetchImpl, rerankStore: store() } });
  assert.equal(r.out.telemetry.rerank_used, 1); assert.equal(f.calls(), 1);
  assert.equal(r.out.telemetry.pinnedRows, 10);
  assert.ok(r.calls.judge[0].user.indexOf('row-9') < r.calls.judge[0].user.indexOf('row-8'));
  assert.equal(JSON.stringify(f.received).includes('private-'), false);
});

test('actual card emitter suppresses the measured X boundary and emits only a score above it', async () => {
  const buildSourceTag = (row) => ({ tag: '<source>local-card</source>', url: row.url });
  for (const [score, expected] of [[RERANK_CARD_MIN,0], [RERANK_CARD_MIN + 1e-8,1]]) {
    const row = { ...ROW, ref: 1, rerankScore: score, rerankCardMin: RERANK_CARD_MIN };
    const r = createBw2Releaser({ rows: [row], emit: () => true, cards: { buildSourceTag, max: 3 } });
    r.push('يجوز المسح على الجوربين إذا كانا صفيقين [[1]].');
    assert.equal((await r.end()).cardsSent, expected);
  }
});

test('real BW2 fallback preserves the exact old response for cap, missing consent and key', async (t) => {
  const f = await fixture(t), baseline = await turn();
  for (const extra of [{ aiConsentVersion: '' }, { aiConsentVersion: consentVersion }]) {
    const r = await turn({ env: { ...env, RERANK_DAILY_CAP: '0' }, extra,
      extraDeps: { searchFatwas: async () => ({ records: [] }), rerankFetch: f.fetchImpl, rerankStore: store() } });
    assert.equal(r.sent, baseline.sent); assert.equal(r.calls.writer.length, 1);
  }
  assert.equal(f.calls(), 0);
});

test('each issue is sent separately and keeps its own ordered top ten through the real BW2 judge', async (t) => {
  const f = await fixture(t);
  const question = 'عندي سؤالان: ما حكم المسح على الجوربين؟ وما حكم زكاة الذهب؟';
  const r = await turn({ question, rows, env: { ...env, BW2_RETRIEVAL_MS: '1200' }, extra: { aiConsentVersion: consentVersion },
    extraDeps: { searchFatwas: async (ctx) => ({ records: rows.map((row) => ({ ...row, id: ctx.currentQuestion + row.recordId,
      url: row.url + encodeURIComponent(ctx.currentQuestion), question: ctx.currentQuestion, answer: row.text })) }),
      rerankFetch: f.fetchImpl, rerankStore: store() } });
  assert.equal(r.out.telemetry.rerank_used, 1); assert.equal(f.calls(), 2);
  assert.ok(f.received.every((body) => body.query !== question && body.top_n === 10));
  assert.equal(new Set(f.received.map((body) => body.query)).size, 2);
  assert.equal(r.out.telemetry.pinnedRows, 20);
});

test('real BW2 preserves the response on timeout, HTTP failure, missing key and KV failure', async (t) => {
  const baseline = await turn();
  const f = await fixture(t, (_, res) => { res.writeHead(500); res.end(); });
  const options = { env: { ...env, BW2_RETRIEVAL_MS: '200' }, extra: { aiConsentVersion: consentVersion },
    extraDeps: { searchFatwas: async () => ({ records: [] }), rerankFetch: f.fetchImpl, rerankStore: store() } };
  const error = await turn(options);
  assert.equal(error.sent, baseline.sent); assert.equal(error.out.telemetry.rerank_fallback_code, 6);
  const timeout = await fixture(t, () => {});
  const timed = await turn({ ...options, extraDeps: { ...options.extraDeps, rerankFetch: timeout.fetchImpl } });
  assert.equal(timed.sent, baseline.sent); assert.equal(timed.out.telemetry.rerank_timeouts, 1);
  const kv = await turn({ ...options, extraDeps: { ...options.extraDeps, rerankStore: { evalScript: async () => null } } });
  assert.equal(kv.sent, baseline.sent); assert.equal(kv.out.telemetry.rerank_fallback_code, 5);
  delete process.env.COHERE_API_KEY;
  const missing = await turn(options);
  assert.equal(missing.sent, baseline.sent); assert.equal(missing.out.telemetry.rerank_fallback_code, 2);
});
