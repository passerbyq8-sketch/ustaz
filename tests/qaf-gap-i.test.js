import test from 'node:test';
import assert from 'node:assert/strict';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { rerankPools, RERANK_CONSENT_VERSION, RERANK_CARD_MIN } from '../lib/rerank/runtime.js';
import { canShowRerankCard } from '../lib/rerank/card.js';
import { createBw2Releaser } from '../lib/bw2-units.js';

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
  assert.equal(received.length, 1); assert.equal(received[0].top_n, 10);
});

test('I F1: reranking preserves legacy passages displaced by expanded rows, including rows past provider cap', async (t) => {
  stubKey(t);
  const received = [];
  const pool = Array.from({ length: 63 }, (_, i) => ({ ...ROW, recordId: String(i), url: ROW.url + '/' + i, text: 'candidate-' + i }));
  const out = await rerankPools({ pools: [{ question, rows: pool }], env: enabled,
    consentVersion: RERANK_CONSENT_VERSION, fetchImpl: rankStub(received), store: { evalScript: async () => 1 } });
  assert.equal(out.ok, true); assert.equal(out.pools[0].rows.length, 63);
  assert.equal(received[0].documents.length, 50); assert.equal(received[0].top_n, 10);
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

test('I F1: an unassigned global row is kept once without inventing coverage of every question part', async (t) => {
  stubKey(t);
  const received = [], question = 'عندي سؤالان: ما حكم المسح على الجوربين؟ وما حكم زكاة الذهب؟';
  const global = { ...ROW, kind: 'encyclopedia', recordId: 'global', snippet: ROW.text };
  const r = await turn({ question, env: enabled, extra: { aiConsentVersion: RERANK_CONSENT_VERSION },
    extraDeps: { rerankFetch: rankStub(received, () => 0.9), rerankStore: { evalScript: async () => 1 },
      runTool: async () => ({ added: [], text: '', calls: 1 }),
      searchFatwas: async () => ({ records: [] }), encyclopediaRow: (row) => row,
      searchStoredCorpus: async (_q, opts) => ({ records: opts.limit === 6 ? [global] : [] }) } });
  assert.equal(r.out.telemetry.parts, 2);
  assert.equal(r.out.telemetry.pinnedRows, 1);
  assert.equal(r.out.telemetry.emptyParts, 2);
  assert.equal((r.calls.judge[0].user.match(/^\[\d+\] /gmu) || []).length, 1);
});

const q03 = 'ما حكم قضاء الصيام الذي تركه المسلم عمدًا سنوات ثم تاب؟';
async function q03Release(first, later) {
  const evidence = [
    { ...ROW, ref: 1, publisher: 'ابن عثيمين', url: 'https://binothaimeen.net/fatwa/1', text: first },
    { ...ROW, ref: 2, url: 'https://binbaz.org.sa/fatwas/2', text: later },
  ];
  const emitted = [];
  const r = createBw2Releaser({ rows: evidence, question: q03, emit: (part) => { emitted.push(part); return true; } });
  r.push(first + ' [[1]].\n\n');
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(emitted.join('').includes(first)); // The first view streams before the second arrives.
  r.push(later + ' [[2]].');
  const out = await r.end();
  assert.equal(out.held, 0); assert.ok(out.text.includes(first));
  assert.ok(out.text.includes(later.replace(/^القول الثاني:\s*/u, '')));
  return out;
}

test('I F6 duty: retain and explicitly frame writer no-make-up then attributed make-up with feeding', async () => {
  const out = await q03Release('الصحيح أنه لا قضاء للصيام المتروك عمدا', 'قال ابن باز: عليه القضاء مع الإطعام');
  assert.match(out.text, /قول آخر[^\n]*يخالف/u);
  assert.ok(out.text.indexOf('قول آخر') > out.text.indexOf('لا قضاء'));
});

test('I F6 duty: reverse direction is framed, while existing two-view framing is retained once', async () => {
  const reverse = await q03Release('من ترك الصيام عمدا يلزمه القضاء', 'قال ابن باز: ليس عليه قضاء للصيام المتروك عمدا');
  assert.match(reverse.text, /قول آخر[^\n]*يخالف/u);
  const framed = await q03Release('في حكم القضاء بعد التوبة قولان: القول الأول لا يلزمه القضاء', 'القول الثاني: قال ابن باز عليه القضاء مع الإطعام');
  assert.ok(!framed.text.includes('قول آخر'));
});

test('I F6 duty: opposing clauses within a single streamed sentence are explicitly framed', async () => {
  const sentence = 'الصحيح أنه لا قضاء للصيام المتروك عمدا، وقال ابن باز: عليه القضاء مع الإطعام';
  const row = { ...ROW, ref: 1, text: sentence };
  const r = createBw2Releaser({ rows: [row], question: q03, emit: () => true });
  r.push(sentence + ' [[1]].');
  const out = await r.end();
  assert.equal(out.held, 0); assert.ok(out.text.includes(sentence));
  assert.match(out.text, /خلاف[^\n]*وجوب القضاء/u);
});

const q06 = 'ما صحة حديث «من قرأ سورة يس في ليلة أصبح مغفورًا له»؟';
async function q06Release(first, later, laterRow = true) {
  const evidence = [
    { kind: 'lib_book', ref: 1, recordId: 'lib:1', author: 'ابن كثير', publisher: 'ابن كثير',
      bookTitle: 'تفسير القرآن العظيم', title: 'تفسير القرآن العظيم', text: first },
    ...(laterRow ? [{ kind: 'lib_book', ref: 2, recordId: 'lib:2', author: 'اللجنة الدائمة للبحوث العلمية والإفتاء',
      publisher: 'اللجنة الدائمة للبحوث العلمية والإفتاء', bookTitle: 'فتاوى اللجنة الدائمة', title: 'فتاوى اللجنة الدائمة', text: later }] : []),
  ];
  const r = createBw2Releaser({ rows: evidence, question: q06, emit: () => true });
  r.push(first + ' [[1]].\n\n' + later + ' [[2]].');
  return r.end();
}

test('I F6 grade: good isnad and very weak for the same hadith retain both attributions with an explicit frame', async () => {
  const first = 'قال ابن كثير: إسناده جيد', later = 'قالت اللجنة الدائمة: هذا حديث ضعيف جدا';
  const out = await q06Release(first, later);
  assert.equal(out.held, 0); assert.ok(out.text.includes(first)); assert.ok(out.text.includes(later));
  assert.match(out.text, /اختلف[^\n]*الحكم على هذا الحديث/u);
});

test('I F6 grade: quoted good-isnad wording is also framed against an attributed weak grade', async () => {
  const first = 'قال ابن كثير: «إسناده جيد»', later = 'قالت اللجنة الدائمة: هذا حديث ضعيف جدا';
  const out = await q06Release(first, later);
  assert.equal(out.held, 0); assert.ok(out.text.includes(first)); assert.ok(out.text.includes(later));
  assert.match(out.text, /اختلف[^\n]*الحكم على هذا الحديث/u);
});

test('I F6 grade: existing disagreement is not repeated, and framing cannot rescue an unsupported authority', async () => {
  const first = 'قال ابن كثير: إسناده جيد', later = 'واختلف العلماء في الحكم على هذا الحديث، فقالت اللجنة الدائمة: هذا حديث ضعيف جدا';
  const out = await q06Release(first, later);
  assert.equal(out.held, 0); assert.equal(out.text.match(/اختلف/gu)?.length, 1);
  const unsupported = await q06Release(first, 'قالت اللجنة الدائمة: هذا حديث ضعيف جدا', false);
  assert.ok(unsupported.held > 0); assert.ok(!unsupported.text.includes('ضعيف جدا'));
});
