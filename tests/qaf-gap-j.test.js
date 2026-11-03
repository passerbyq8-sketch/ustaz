import test from 'node:test';
import assert from 'node:assert/strict';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { rerankPools, RERANK_CONSENT_VERSION, RERANK_CARD_MIN, RESERVE } from '../lib/rerank/runtime.js';
import { canShowRerankCard } from '../lib/rerank/card.js';

const localStubKey = 'local-stub-key';
const enabled = { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' };
const q02 = 'هل يجوز إخراج زكاة المال طعامًا أو عروضًا بدل النقد؟ وما أقوال المذاهب الأربعة في ذلك؟';
const hadith = 'ما درجة حديث «إنما الأعمال بالنيات»؟ ومن رواه؟';
const conditions = 'ما شروط صحة الصلاة؟';
const compound = 'عندي سؤالان: ما حكم المسح على الجوربين؟ وما حكم زكاة الذهب؟';
function key(t) {
  process.env.COHERE_API_KEY = localStubKey;
  t.after(() => { delete process.env.COHERE_API_KEY; });
}
function response(body) {
  return new Response(JSON.stringify({ results: body.documents.map((_, index) => ({ index, relevance_score: .95 - index / 1000 }))
    .reverse().slice(0, body.top_n) }), { headers: { 'content-type': 'application/json' } });
}
function fixture(question, counts, on, received = [], overrides = {}) {
  const rows = counts.flatMap(([kind, count]) => Array.from({ length: count }, (_, i) => ({ ...ROW, kind,
    title: kind + '-' + i, bookTitle: kind + '-' + i, recordId: kind + '-' + i,
    url: 'https://source.invalid/' + kind + '/' + i, text: 'original-passage-' + kind + '-' + i })));
  let at = 0;
  return { question, env: on ? enabled : {},
    extra: { libFlagValue: 'on', libToken: localStubKey, lessonsToken: localStubKey, aiConsentVersion: RERANK_CONSENT_VERSION },
    extraDeps: {
      rerankFetch: async (_u, init) => { const b = JSON.parse(init.body); received.push(b); return response(b); },
      rerankStore: { evalScript: async () => 1 },
      searchFatwas: async () => ({ records: rows.filter(r => r.kind === 'fatwa').map(r => ({ ...r, id: r.recordId, question: 'expanded', answer: 'expanded-passage-' + r.recordId })) }),
      searchStoredCorpus: async (_q, opts) => ({ records: opts.limit === 50 ? [] : rows.filter(r => r.kind === 'encyclopedia').map(r => ({ ...r, snippet: r.text })) }),
      encyclopediaRow: r => r,
      runTool: async (name, _input, ctx) => {
        let found = [];
        if (name === 'search_fatawa') found = rows.filter(r => r.kind === 'fatwa');
        if (name === 'search_lessons') found = rows.filter(r => r.kind === 'lesson');
        if (name === 'search_library' && ctx.resultCap !== 30) {
          const lib = rows.filter(r => r.kind === 'lib_book'); found = lib.slice(at, at + ctx.resultCap); at += found.length;
        }
        return { text: '', added: found.map(r => ctx.table.add({ ...r })), calls: 1 };
      }, ...overrides,
    },
  };
}

test('J2: Q02, HADITH and conditions retain every original passage with the bd21873a request contract', async t => {
  key(t);
  for (const [question, counts] of [
    [q02, [['lib_book', 23], ['fatwa', 6], ['encyclopedia', 4], ['lesson', 3]]],
    [hadith, [['lib_book', 7], ['fatwa', 6], ['encyclopedia', 4], ['lesson', 3]]],
    [conditions, [['lib_book', 7], ['lesson', 3]]],
  ]) {
    const received = [];
    const off = await turn(fixture(question, counts, false));
    const on = await turn(fixture(question, counts, true, received));
    assert.equal(on.out.telemetry.rerank_used, 1);
    assert.equal(on.out.telemetry.pinnedRows, off.out.telemetry.pinnedRows);
    const listing = r => [...r.calls.judge[0].user.matchAll(/^original-passage-[^\n]+/gm)].map(m => m[0]);
    assert.deepEqual(listing(on).sort(), listing(off).sort());
    assert.equal(new Set(listing(on)).size, listing(off).length);
    // Different expanded text at the same URL cannot replace original evidence
    // or lend its score to an original passage the provider did not score.
    assert.ok(!on.calls.judge[0].user.includes('expanded-passage-'));
    const count = counts.reduce((n, [, c]) => n + c, 0);
    const fatwas = counts.find(([kind]) => kind === 'fatwa')?.[1] || 0;
    const expected = [
      ...Array.from({ length: fatwas }, (_, i) => 'expanded\nexpanded-passage-fatwa-' + i),
      ...['encyclopedia', 'lib_book', 'lesson'].flatMap(kind => Array.from({ length: counts.find(([k]) => k === kind)?.[1] || 0 }, (_, i) => 'original-passage-' + kind + '-' + i)),
    ];
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { model: 'rerank-v5.0-fast', query: question, documents: expected.slice(0, 50), top_n: Math.min(10, count) });
  }
});

test('J2: scored subset precedes all remaining evidence in original order, including beyond 50 and same-URL passages', async t => {
  key(t);
  const rows = Array.from({ length: 63 }, (_, i) => ({ ...ROW, url: ROW.url + '/' + i, text: 'passage-' + i }));
  rows[1].url = rows[0].url; // distinct original text at the same URL remains evidence
  const received = [];
  const r = await rerankPools({ pools: [{ question: q02, rows }], env: enabled, consentVersion: RERANK_CONSENT_VERSION,
    store: { evalScript: async () => 1 }, fetchImpl: async (_u, init) => { const b = JSON.parse(init.body); received.push(b); return response(b); } });
  assert.equal(r.ok, true);
  assert.equal(received[0].top_n, 10);
  // Transport sorts the returned ten by score. Unreturned rows stay unscored.
  const scored = Array.from({ length: 10 }, (_, i) => 40 + i);
  const expected = [...scored, ...rows.map((_, i) => i).filter(i => !scored.includes(i))];
  assert.deepEqual(r.pools[0].rows.map(r => r.text), expected.map(i => rows[i].text));
  // K2 supersedes J's score-required card rule for the 53 unreturned rows.
  assert.equal(r.pools[0].rows.filter(canShowRerankCard).length, 63);
  assert.ok(r.pools[0].rows.slice(10).every(r => r.rerankScore === undefined && r.rerankCardMin === RERANK_CARD_MIN));
});

test('J2/J3: conservative success and every fallback retain original judge order and issue scope', async t => {
  key(t);
  const successBodies = [];
  for (const question of [q02, compound]) {
    const rows = Array.from({ length: 15 }, (_, i) => ({ ...ROW, title: 'row-' + i, recordId: 'r' + i, url: ROW.url + '/' + i, text: ROW.text + ' passage-' + i }));
    const global = { ...ROW, kind: 'encyclopedia', title: 'global-only', url: 'https://source.invalid/global', snippet: ROW.text };
    const baseDeps = {
      searchFatwas: async () => ({ records: [] }),
      searchStoredCorpus: async (_q, o) => ({ records: o.limit === 6 ? [global] : [] }), encyclopediaRow: r => r,
      rerankFetch: async (_u, init) => { const b = JSON.parse(init.body); successBodies.push(b); return response(b); },
      rerankStore: { evalScript: async () => 1 },
    };
    const baseline = await turn({ question, rows, extraDeps: baseDeps });
    const scenarios = [
      ['consent', 1, { consent: '' }], ['missing key', 2, { missing: true }],
      ['training', 7, { env: { COHERE_NO_TRAINING_CONFIRMED: '' } }],
      ['cap', 4, { store: async () => 0 }], ['reserve missing', 5, { store: async () => null }],
      ['reserve throws', 5, { store: async () => { throw new Error('local store failure'); } }],
      ['reserve times out', 3, { store: async () => new Promise(() => {}) }],
      ['minimum', 6, { env: { RERANK_CARD_MIN: 'invalid' } }],
      ['HTTP', 6, { fetch: async () => new Response('', { status: 400 }) }],
      ['one failed sibling', 6, { fetch: async (_u, init) => { const b = JSON.parse(init.body); return b.query.includes('الذهب') ? response(b) : new Response('', { status: 400 }); } }],
      ['transport', 6, { fetch: async () => { throw new TypeError('local transport failure'); } }],
      ['JSON', 6, { fetch: async () => new Response('{', { headers: { 'content-type': 'application/json' } }) }],
      ['response indices', 6, { fetch: async () => new Response(JSON.stringify({ results: [{ index: 999, relevance_score: .9 }] }), { headers: { 'content-type': 'application/json' } }) }],
      ['settle throws', 5, { billed: true, store: async script => { if (script !== RESERVE) throw new Error('local settlement failure'); return 1; } }],
      ['settle missing', 5, { billed: true, store: async script => script === RESERVE ? 1 : null }],
      ['settle times out', 3, { billed: true, store: async script => script === RESERVE ? 1 : new Promise(() => {}) }],
      ['provider timeout', 3, { fetch: async (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) }],
    ];
    for (const [name, code, scenario] of scenarios) {
      if (scenario.missing) delete process.env.COHERE_API_KEY; else process.env.COHERE_API_KEY = localStubKey;
      const fetched = scenario.billed ? async (_u, init) => { const b = JSON.parse(init.body); const r = await response(b).json(); r.meta = { billed_units: { input_tokens: 100 } }; return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } }); } : scenario.fetch;
      const r = await turn({ question, rows, env: { ...enabled, ...scenario.env },
        extra: { aiConsentVersion: scenario.consent ?? RERANK_CONSENT_VERSION },
        extraDeps: { ...baseDeps, ...(fetched ? { rerankFetch: fetched } : {}), ...(scenario.store ? { rerankStore: { evalScript: scenario.store } } : {}) } });
      assert.equal(r.out.telemetry.rerank_fallback_code, code, name);
      assert.equal(r.out.telemetry.rerank_used, 0, name);
      assert.equal(r.out.telemetry.rerank_errors, code === 6 ? 1 : 0, name);
      assert.equal(r.out.telemetry.rerank_timeouts, code === 3 ? 1 : 0, name);
      assert.equal(r.calls.judge[0].user, baseline.calls.judge[0].user, name);
      assert.equal(r.out.telemetry.emptyParts, baseline.out.telemetry.emptyParts, name);
      assert.deepEqual(r.calls.writer, baseline.calls.writer, name);
    }
    process.env.COHERE_API_KEY = localStubKey;
    const success = await turn({ question, rows, env: enabled, extra: { aiConsentVersion: RERANK_CONSENT_VERSION }, extraDeps: baseDeps });
    assert.equal(success.out.telemetry.rerank_used, 1);
    assert.ok(success.out.telemetry.pinnedRows >= baseline.out.telemetry.pinnedRows);
    assert.equal((success.calls.judge[0].user.match(/global-only/g) || []).length, 1);
  }
  assert.ok(successBodies.length > 0);
  assert.ok(successBodies.every(b => b.top_n === Math.min(10, b.documents.length)));
  const bulk = [];
  await turn(fixture(q02, [['lib_book', 23], ['fatwa', 6], ['encyclopedia', 4], ['lesson', 3]], true, bulk));
  assert.equal(bulk[0].top_n, 10);
});

test('J4: every code-6 exit emits one bounded diagnostic without request text, credentials or transport details', async t => {
  key(t);
  const lines = [], previous = console.warn;
  console.warn = (...args) => lines.push(args);
  t.after(() => { console.warn = previous; });
  const question = 'PRIVATEQUERY', rows = [{ ...ROW, text: 'PRIVATEDOCUMENT' }];
  const options = { pools: [{ question, rows }], env: enabled, consentVersion: RERANK_CONSENT_VERSION,
    store: { evalScript: async () => 1 } };
  const malformed = async () => new Response('{', { headers: { 'content-type': 'application/json' } });
  const scenarios = [
    [{ fetchImpl: async () => new Response(JSON.stringify({ message: 'Provider rejected: PRIVATEQUERY PRIVATEDOCUMENT Bearer ' + localStubKey + '\r\nعربي ' + 'z'.repeat(200) }), { status: 422 }) }, 422, 1, 'CohereRerankError'],
    [{ fetchImpl: malformed }, 200, 1, 'CohereRerankError'],
    [{ fetchImpl: async () => ({ ok: false, status: 401, text: async () => { throw new Error('unreadable response'); } }) }, 401, 1, 'CohereRerankError'],
    [{ fetchImpl: async () => { throw new TypeError('PRIVATEQUERY transport detail ' + localStubKey); } }, undefined, 1, 'CohereRerankError'],
    [{ env: { ...enabled, RERANK_CARD_MIN: 'invalid' } }, undefined, 0, 'Error'],
    [{ pools: null }, undefined, 0, 'TypeError'],
    [{ pools: [{ question, rows: [{ text: { toString() { throw new TypeError('PRIVATEDOCUMENT'); } } }] }] }, undefined, 1, 'TypeError'],
    [{ pools: [{ question, rows: [{ text: 'plain', get url() { throw new RangeError('PRIVATEDOCUMENT'); } }] }],
      fetchImpl: async (_u, init) => response(JSON.parse(init.body)) }, 200, 1, 'RangeError'],
    [{ pools: [{ question, rows }, { question, rows }], fetchImpl: async () => new Response('', { status: 503 }) }, 503, 1, 'CohereRerankError'],
  ];
  for (const [extra, status, count, errorName] of scenarios) {
    lines.length = 0;
    const r = await rerankPools({ ...options, ...extra });
    assert.equal(r.telemetry.rerank_fallback_code, 6);
    assert.equal(lines.length, 1);
    const [tag, payload] = lines[0];
    assert.equal(tag, '[rerank]');
    assert.equal(payload.status, status); assert.equal(payload.errorName, errorName);
    assert.equal(payload.candidates, count); assert.equal(payload.count, count);
    assert.equal(payload.rerank_fallback_code, 6);
    assert.equal(payload.rerank_units, r.telemetry.rerank_units);
    assert.equal(payload.rerank_ms, r.telemetry.rerank_ms);
    assert.ok(Object.keys(payload).every(k => ['rerank_fallback_code', 'status', 'errorName', 'candidates', 'count', 'rerank_units', 'rerank_ms', 'error'].includes(k)));
    assert.ok(!/PRIVATEQUERY|PRIVATEDOCUMENT|local-stub-key|transport detail/.test(JSON.stringify(payload)));
    if (payload.error) { assert.ok(/^[\x20-\x7e]{1,120}$/.test(payload.error)); assert.ok(payload.error.startsWith('Provider rejected:')); }
  }
});
