import test from 'node:test';
import assert from 'node:assert/strict';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { rerankPools, RERANK_CONSENT_VERSION, RERANK_CARD_MIN } from '../lib/rerank/runtime.js';
import { canShowRerankCard } from '../lib/rerank/card.js';

const localStubKey = 'local-stub-key';
const enabled = { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' };
const question = 'هل يجوز إخراج زكاة المال طعامًا أو عروضًا بدل النقد؟ وما أقوال المذاهب الأربعة في ذلك؟';
const relevant = new Set([0, 1, 2, 12, 16, 22, 27, 33]);
const rows = Array.from({ length: 36 }, (_, i) => ({
  kind: i < 23 ? 'lib_book' : i < 29 ? 'fatwa' : i < 33 ? 'encyclopedia' : 'lesson',
  title: 'candidate-' + i, bookTitle: 'candidate-' + i, recordId: 'candidate-' + i,
  url: 'https://source.invalid/' + i, text: 'يجوز إخراج زكاة المال عروضا للمصلحة. candidate-' + i,
}));
function stubKey(t) {
  process.env.COHERE_API_KEY = localStubKey;
  t.after(() => { delete process.env.COHERE_API_KEY; });
}
function rankStub(received, scores = (doc) => {
  const i = Number(doc.match(/candidate-(\d+)/)[1]);
  return i < 3 ? 0.9 - i * 0.05 : 0.6 - i * 0.005;
}) {
  return async (_url, init) => {
    const body = JSON.parse(init.body); received.push(body);
    return new Response(JSON.stringify({ results: body.documents.map((doc, index) => ({ index, relevance_score: scores(doc, index) }))
      .sort((a, b) => b.relevance_score - a.relevance_score).slice(0, body.top_n),
    meta: { billed_units: { input_tokens: 2000 } } }), { headers: { 'content-type': 'application/json' } });
  };
}
function q02Fixture(on, received, judged) {
  let libraryAt = 0;
  return { question, text: 'باب البحث واسع.', env: on ? enabled : {},
    extra: { libFlagValue: 'on', libToken: localStubKey, lessonsToken: localStubKey,
      ...(on ? { aiConsentVersion: RERANK_CONSENT_VERSION } : {}) },
    extraDeps: {
      ask: async (body) => {
        judged.push(body);
        return JSON.stringify({ d: Object.fromEntries([...body.user.matchAll(/^\[(\d+)\] [^\n]*candidate-(\d+)/gmu)]
          .map((m) => [m[1], relevant.has(Number(m[2])) ? 1 : 0])) });
      },
      searchFatwas: async () => ({ records: [] }),
      rerankFetch: rankStub(received), rerankStore: { evalScript: async () => 1 },
      searchStoredCorpus: async (_q, opts) => ({ records: opts.limit === 50 ? [] : rows.slice(29, 33).map((r) => ({ ...r, snippet: r.text })) }),
      encyclopediaRow: (r) => r,
      runTool: async (name, _input, ctx) => {
        let found = [];
        if (name === 'search_fatawa') found = rows.slice(23, 29);
        if (name === 'search_lessons') found = rows.slice(33);
        if (name === 'search_library' && ctx.resultCap !== 30) {
          found = rows.slice(libraryAt, Math.min(23, libraryAt + ctx.resultCap)); libraryAt += found.length;
        }
        return { text: '', added: found.map((r) => ctx.table.add({ ...r })), calls: 1 };
      },
    },
  };
}

test('I F1: Q02 retains all 36 judge candidates and all eight kept passages with only three above the card boundary', async (t) => {
  stubKey(t);
  const received = [], judged = [];
  const off = await turn(q02Fixture(false, received, judged));
  const on = await turn(q02Fixture(true, received, judged));
  for (const r of [off, on]) {
    assert.deepEqual(['library', 'fatwa', 'encyclopedia', 'lessons'].map((k) => r.out.telemetry[k + 'Hits']), [23, 6, 4, 3]);
    assert.equal(r.out.telemetry.judgeKept, 8); assert.equal(r.out.telemetry.pinnedRows, 8);
    const writer = JSON.stringify(r.calls.writer[0]);
    for (const id of relevant) assert.ok(writer.includes('candidate-' + id));
  }
  assert.equal(on.out.telemetry.rerank_used, 1);
  assert.ok(judged.every((body) => (body.user.match(/^\[\d+\] /gmu) || []).length === 36));
  assert.equal(received.length, 1); assert.equal(received[0].top_n, 36);
});

test('I F1: reranking preserves legacy passages displaced by expanded rows, including rows past provider cap', async (t) => {
  stubKey(t);
  const received = [];
  const pool = Array.from({ length: 63 }, (_, i) => ({ ...ROW, recordId: String(i), url: ROW.url + '/' + i, text: 'candidate-' + i }));
  const out = await rerankPools({ pools: [{ question, rows: pool }], env: enabled,
    consentVersion: RERANK_CONSENT_VERSION, fetchImpl: rankStub(received), store: { evalScript: async () => 1 } });
  assert.equal(out.ok, true); assert.equal(out.pools[0].rows.length, 63);
  assert.equal(received[0].documents.length, 50); assert.equal(received[0].top_n, 50);
  assert.equal(out.pools[0].rows.filter(canShowRerankCard).length, 3);
  assert.ok(out.pools[0].rows.slice(50).every((r) => r.rerankCardMin === RERANK_CARD_MIN && !canShowRerankCard(r)));
});

test('I F1: expanded same-URL text never replaces the original passage and every original reaches the judge', async (t) => {
  stubKey(t);
  const received = [], original = { ...ROW, text: 'original-passage', fullText: 'original-passage' };
  const r = await turn({ rows: [original], env: enabled, extra: { aiConsentVersion: RERANK_CONSENT_VERSION },
    extraDeps: { rerankFetch: rankStub(received, () => 0.9), rerankStore: { evalScript: async () => 1 },
      searchFatwas: async () => ({ records: [{ ...ROW, id: ROW.recordId, question: 'expanded', answer: 'different-expanded-passage' }] }) } });
  assert.equal(r.out.telemetry.rerank_used, 1);
  assert.ok(r.calls.judge[0].user.includes('original-passage'));
  assert.ok(!r.calls.judge[0].user.includes('different-expanded-passage'));
});
