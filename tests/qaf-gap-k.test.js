import test from 'node:test';
import assert from 'node:assert/strict';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { RERANK_CONSENT_VERSION, RESERVE } from '../lib/rerank/runtime.js';
import { TAKHRIJ_LADDER_IDS } from '../lib/takhrij-ladder.js';

const localStubKey = 'local-stub-key';
const enabled = { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' };
// Saved AB-J ordinary hits: fatwa, encyclopedia, library, lessons. Expanded
// identities were not logged: use 30 distinct library + 4 encyclopedia per issue
// to expose the recorded excess (including Q10's >=32), without claiming replay.
const shapes = [
  ['ما حكم الجمع بين صلاتي الظهر والعصر للمقيم بسبب البرد الشديد أو الوحل؟', [4, 4, 7, 3]],
  ['هل يجوز إخراج زكاة المال طعامًا أو عروضًا بدل النقد؟ وما أقوال المذاهب الأربعة في ذلك؟', [6, 4, 23, 3]],
  ['ما حكم قضاء الصيام الذي تركه المسلم عمدًا سنوات ثم تاب؟', [5, 4, 4, 3]],
  ['ما درجة حديث «اطلبوا العلم ولو بالصين»؟ ومن خرّجه؟', [4, 4, 6, 3]],
  ['هل حديث «النظافة من الإيمان» صحيح؟', [5, 4, 5, 3]],
  ['ما صحة حديث «من قرأ سورة يس في ليلة أصبح مغفورًا له»؟', [5, 4, 7, 3]],
  ['رجل أحرم بالحج ثم قبّل زوجته بشهوة قبل التحلل الأول: ماذا يلزمه؟ وهل يختلف الحكم إن كان ناسيًا؟', [4, 4, 7, 3]],
  ['امرأة نفست قبل طواف الإفاضة ولم تستطع البقاء في مكة حتى تطهر: ما حكم حجها وما الذي يلزمها عند المذاهب؟', [3, 4, 15, 3]],
  ['من نذر أن يصوم يوم الاثنين من كل أسبوع ثم سافر في أحدها ولم يصم: هل يقضي؟ وهل عليه كفارة؟', [6, 4, 7, 3]],
  ['ما معنى قوله تعالى «لا يكلف الله نفسًا إلا وسعها»؟', [6, 4, 8, 3]],
  ['ما شروط صحة الصلاة؟', [4, 4, 7, 3]],
  ['من هم العشرة المبشرون بالجنة؟', [2, 4, 7, 3]],
];
function stubKey(t) {
  process.env.COHERE_API_KEY = localStubKey;
  t.after(() => { delete process.env.COHERE_API_KEY; });
}
function response(body, billed = false) {
  return new Response(JSON.stringify({ results: body.documents.map((_, index) => ({ index, relevance_score: .99 - index / 1000 }))
    .slice(0, body.top_n), ...(billed ? { meta: { billed_units: { input_tokens: 100 } } } : {}) }),
  { headers: { 'content-type': 'application/json' } });
}
function fixture([question, counts], on, received = [], overrides = {}) {
  const kinds = ['fatwa', 'encyclopedia', 'lib_book', 'lesson'];
  const rows = counts.flatMap((n, k) => Array.from({ length: n }, (_, i) => ({ ...ROW, kind: kinds[k],
    title: kinds[k] + '-' + i, bookTitle: kinds[k] + '-' + i, recordId: k + '-' + i,
    url: 'https://source.invalid/' + k + '/' + i, text: 'original-passage-' + k + '-' + i })));
  const expanded = Array.from({ length: 34 }, (_, i) => ({ ...ROW, kind: i < 30 ? 'lib_book' : 'encyclopedia',
    title: 'expanded-' + i, url: 'https://source.invalid/expanded/' + i, text: 'expanded-passage-' + i }));
  let at = 0;
  return { question, text: 'باب البحث واسع.', env: on ? enabled : {},
    extra: { libFlagValue: 'on', libToken: localStubKey, lessonsToken: localStubKey, aiConsentVersion: RERANK_CONSENT_VERSION },
    extraDeps: {
      searchFatwas: async () => ({ records: [] }),
      searchStoredCorpus: async (_q, o) => ({ records: (o.limit === 50 ? expanded.slice(30) : rows.filter(r => r.kind === 'encyclopedia'))
        .map(r => ({ ...r, snippet: r.text })) }), encyclopediaRow: r => r,
      rerankStore: { evalScript: async () => 1 },
      rerankFetch: async (_u, init) => { const b = JSON.parse(init.body); received.push(b); return response(b); },
      runTool: async (name, _input, ctx) => {
        let found = [];
        if (name === 'search_fatawa') found = rows.filter(r => r.kind === 'fatwa');
        if (name === 'search_lessons') found = rows.filter(r => r.kind === 'lesson');
        if (name === 'search_library') {
          if (ctx.resultCap === 30) found = expanded.slice(0, 30);
          else { const lib = rows.filter(r => r.kind === 'lib_book'); found = lib.slice(at, at + ctx.resultCap); at += found.length; }
        }
        return { added: found.map(r => ctx.table.add({ ...r })), text: '', calls: 1 };
      }, ...overrides,
    },
  };
}

test('K2 membership: all 12 AB shapes judge exactly flag-off rows while provider-only rows stay on the wire', async t => {
  stubKey(t);
  for (const [index, shape] of shapes.entries()) {
    const received = [], off = await turn(fixture(shape, false)), on = await turn(fixture(shape, true, received));
    assert.equal(on.out.telemetry.rerank_used, 1);
    assert.equal(on.calls.judge[0].user, off.calls.judge[0].user, 'Q' + (index + 1));
    assert.equal(on.calls.judge[0].maxTokens, off.calls.judge[0].maxTokens);
    assert.equal(on.out.telemetry.pinnedRows, off.out.telemetry.pinnedRows);
    assert.ok(!JSON.stringify(on.calls.writer).includes('expanded-passage-'));
    assert.ok(received.some(b => b.documents.some(d => d.startsWith('expanded-passage-'))));
    assert.ok(received.every(b => b.documents.length <= 50 && b.top_n === Math.min(10, b.documents.length)));
  }
  // Flag-off prewriting evidence can itself exceed the wire cap. Keep it whole,
  // and preserve the same first passage when original rows share a URL.
  const originals = Array.from({ length: 63 }, (_, i) => ({ ...ROW, kind: 'lib_book', subjectId: TAKHRIJ_LADDER_IDS[0],
    recordId: 'prewrite-' + i, url: 'https://source.invalid/prewrite/' + i, text: 'prewrite-original-' + i }));
  originals[1].url = originals[0].url;
  const options = on => ({ env: on ? enabled : {}, extra: { takhrijWired: true, runtime: 'HADITH', aiConsentVersion: RERANK_CONSENT_VERSION },
    text: 'باب البحث واسع.', extraDeps: {
      runnerLookup: runTool => async () => { await runTool('prewrite'); return []; },
      runTool: async (name, _input, ctx) => ({ text: '', calls: 1,
        added: name === 'prewrite' ? originals : name === 'search_fatawa' ? [ctx.table.add({ ...ROW })] : [] }),
      searchFatwas: async () => ({ records: [] }),
      rerankStore: { evalScript: async () => 1 },
      rerankFetch: async (_u, init) => response(JSON.parse(init.body)),
    } });
  const off = await turn(options(false)), on = await turn(options(true));
  assert.equal(on.calls.judge[0].user, off.calls.judge[0].user);
  assert.equal(on.out.telemetry.pinnedRows, 64);
  assert.equal(off.out.telemetry.pinnedRows, 64);
  assert.ok(JSON.stringify(on.calls.writer).includes('prewrite-original-62'));
  assert.deepEqual(JSON.stringify(on.calls.writer).match(/prewrite-original-\d+/g).sort(),
    JSON.stringify(off.calls.writer).match(/prewrite-original-\d+/g).sort());
});

test('K2 concurrency: judge is issued while provider response is pending, then both writer and releaser use the same sorted kept refs', async t => {
  stubKey(t);
  let judgeIssued = false, providerPending = false, release;
  const pending = new Promise(resolve => { release = resolve; });
  const rows = Array.from({ length: 3 }, (_, i) => ({ ...ROW, title: 'candidate-' + i, url: ROW.url + '/' + i }));
  const running = turn({ rows, env: enabled, extra: { aiConsentVersion: RERANK_CONSENT_VERSION,
    cards: { buildSourceTag: row => ({ tag: '<source url="' + row.url + '">card-' + row.title + '</source>', url: row.url }) } },
    text: 'يجوز المسح على الجوربين إذا كانا صفيقين [[1]].',
    extraDeps: {
      searchFatwas: async () => ({ records: [] }), rerankStore: { evalScript: async () => 1 },
      ask: async () => { judgeIssued = true; return JSON.stringify({ d: { 1: 1, 2: 0, 3: 1 } }); },
      rerankFetch: async (_u, init) => { providerPending = true; await pending;
        assert.equal(judgeIssued, true, 'judge must not await the provider');
        const b = JSON.parse(init.body); return new Response(JSON.stringify({ results: [
          { index: 1, relevance_score: .99 }, { index: 2, relevance_score: .95 }, { index: 0, relevance_score: .8 },
        ].slice(0, b.top_n) }), { headers: { 'content-type': 'application/json' } }); },
    } });
  // A bounded event-loop barrier observes issuance without a wall-clock race.
  for (let i = 0; i < 30 && !providerPending; i++) await new Promise(resolve => setImmediate(resolve));
  try { assert.equal(providerPending, true); assert.equal(judgeIssued, true); }
  finally { release(); }
  const r = await running, writer = JSON.stringify(r.calls.writer[0]);
  assert.ok(writer.indexOf('candidate-2') < writer.indexOf('candidate-0'));
  assert.ok(!writer.includes('candidate-1'));
  assert.ok(r.sent.includes('card-candidate-2'), r.sent);
  assert.ok(!r.sent.includes('card-candidate-0'));
  assert.equal(r.out.telemetry.pinnedRows, 2);
  // A scored dropped row cannot pin itself; the unscored tail keeps judge order.
  const mixed = await turn({ rows: [...rows, { ...ROW, title: 'candidate-3', url: ROW.url + '/3' }],
    env: enabled, extra: { aiConsentVersion: RERANK_CONSENT_VERSION }, text: 'باب البحث واسع.',
    extraDeps: {
      searchFatwas: async () => ({ records: Array.from({ length: 8 }, (_, i) => ({ id: 'extra-' + i,
        title: 'extra-' + i, url: 'https://source.invalid/extra/' + i, answer: 'provider-only-' + i })) }),
      rerankStore: { evalScript: async () => 1 },
      ask: async () => JSON.stringify({ d: { 1: 1, 2: 0, 3: 1, 4: 1 } }),
      rerankFetch: async () => new Response(JSON.stringify({ results: [
        ...Array.from({ length: 8 }, (_, index) => ({ index, relevance_score: .8 })),
        { index: 9, relevance_score: .99 }, { index: 10, relevance_score: .95 },
      ] }), { headers: { 'content-type': 'application/json' } }),
    } });
  const body = JSON.stringify(mixed.calls.writer[0]);
  assert.ok(body.indexOf('candidate-2') < body.indexOf('candidate-0'));
  assert.ok(body.indexOf('candidate-0') < body.indexOf('candidate-3'));
  assert.ok(!body.includes('candidate-1') && !body.includes('provider-only-'));
});

test('K2 fallback: all 12 shapes retain byte-identical judge/writer input and closed codes across J3 paths', async t => {
  stubKey(t);
  const scenarios = [
    ['consent', 1, { consent: '' }], ['key', 2, { missing: true }],
    ['training', 7, { env: { COHERE_NO_TRAINING_CONFIRMED: '' } }],
    ['cap', 4, { store: async () => 0 }], ['reserve null', 5, { store: async () => null }],
    ['reserve throw', 5, { store: async () => { throw new Error('local store'); } }],
    ['reserve deadline', 3, { store: async () => new Promise(() => {}) }],
    ['minimum', 6, { env: { RERANK_CARD_MIN: 'invalid' } }],
    ['HTTP', 6, { fetch: async () => new Response('', { status: 400 }) }],
    ['transport', 6, { fetch: async () => { throw new TypeError('local transport'); } }],
    ['JSON', 6, { fetch: async () => new Response('{', { headers: { 'content-type': 'application/json' } }) }],
    ['indices', 6, { fetch: async () => new Response(JSON.stringify({ results: [{ index: 999, relevance_score: .9 }] }), { headers: { 'content-type': 'application/json' } }) }],
    ['one sibling', 6, { fetch: async (_u, init) => { const b = JSON.parse(init.body); return b.query.includes('ناسي') || b.query.includes('كفارة') ? response(b) : new Response('', { status: 400 }); } }],
    ['settle throw', 5, { billed: true, store: async script => { if (script !== RESERVE) throw new Error('local settle'); return 1; } }],
    ['settle null', 5, { billed: true, store: async script => script === RESERVE ? 1 : null }],
    ['settle deadline', 3, { billed: true, store: async script => script === RESERVE ? 1 : new Promise(() => {}) }],
    ['provider deadline', 3, { fetch: async (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('local abort')), { once: true })) }],
  ];
  for (const shape of shapes) {
    process.env.COHERE_API_KEY = localStubKey;
    const off = await turn(fixture(shape, false));
    for (const [name, code, s] of scenarios) {
      if (s.missing) delete process.env.COHERE_API_KEY; else process.env.COHERE_API_KEY = localStubKey;
      const f = fixture(shape, true, [], {
        ...(s.store ? { rerankStore: { evalScript: s.store } } : {}),
        ...(s.billed ? { rerankFetch: async (_u, init) => response(JSON.parse(init.body), true) } : s.fetch ? { rerankFetch: s.fetch } : {}),
      });
      f.env = { ...f.env, ...s.env }; f.extra.aiConsentVersion = s.consent ?? RERANK_CONSENT_VERSION;
      const on = await turn(f);
      assert.equal(on.out.telemetry.rerank_fallback_code, code, name);
      assert.equal(on.out.telemetry.rerank_used, 0, name);
      assert.equal(on.out.telemetry.rerank_errors, code === 6 ? 1 : 0, name);
      assert.equal(on.out.telemetry.rerank_timeouts, code === 3 ? 1 : 0, name);
      assert.equal(on.calls.judge[0].user, off.calls.judge[0].user, name);
      assert.deepEqual(on.calls.writer, off.calls.writer, name);
      assert.equal(on.out.telemetry.emptyParts, off.out.telemetry.emptyParts, name);
    }
  }
  // This success control makes the regression fail on the original b206007f;
  // the fallback property itself already held there, as recorded in J.
  process.env.COHERE_API_KEY = localStubKey;
  const off = await turn(fixture(shapes[0], false)), on = await turn(fixture(shapes[0], true));
  assert.equal(on.calls.judge[0].user, off.calls.judge[0].user);
});
