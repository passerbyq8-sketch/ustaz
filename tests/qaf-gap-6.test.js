import test from 'node:test';
import assert from 'node:assert/strict';
import { prewriteTakhrij } from '../lib/before-writing-v2.js';
import { TAKHRIJ_LADDER_IDS } from '../lib/takhrij-ladder.js';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';

const matn = 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى';
const question = 'اشرح حديث «' + matn + '»';
test('the HADITH ladder runs beside retrieval and its tagged passage reaches the first writer request', async () => {
  const trace = [];
  const start = performance.now();
  const r = await turn({ question, extra: { runtime: 'HADITH', takhrijWired: true },
    extraDeps: {
      runTool: async (name, input, ctx) => {
        const ladder = name === 'search_library' && ctx.bookIds === TAKHRIJ_LADDER_IDS;
        trace.push([ladder ? 'ladder-start' : 'retrieve-start', performance.now() - start]);
        await new Promise((resolve) => setTimeout(resolve, ladder ? 20 : 10));
        trace.push([ladder ? 'ladder-end' : 'retrieve-end', performance.now() - start]);
        const rows = ladder ? [{ kind: 'lib_book', title: 'صحيح البخاري', subjectId: TAKHRIJ_LADDER_IDS[0],
          recordId: 'local-stub-atom', text: 'قال رسول الله صلى الله عليه وسلم: «' + matn + '».' }]
          : name === 'search_fatawa' ? [ROW] : [];
        return { added: rows.map((row) => ctx.table.add({ ...row })) };
      },
    } });
  assert.ok(r.calls.writer.length > 0);
  const content = r.calls.writer[0].messages.at(-1).content;
  const pinned = Array.isArray(content) ? content.map((c) => c.text || '').join('\n') : content;
  assert.ok(pinned.includes('[التخريج قبل الكتابة]'));
  assert.ok(pinned.includes(matn));
  assert.ok(trace.find((e) => e[0] === 'ladder-start')[1] < trace.find((e) => e[0] === 'retrieve-end')[1]);
  console.log('QAF_GAP6_LOCAL_STUB ' + JSON.stringify({ trace, writerCalls: r.calls.writer.length }));
});

test('a stuck ladder is bounded by retrieval budget and receives cancellation', async () => {
  let lookupSignal;
  const started = performance.now();
  const r = await prewriteTakhrij({ question, includeRows: true, gradeHeadWanted: false,
    budgetMs: 20, env: {}, deps: { runnerLookup: (_, ctx) => { lookupSignal = ctx.signal; return () => new Promise(() => {}); } } });
  assert.equal(r.timedOut, true);
  assert.deepEqual(r.rows, []);
  assert.equal(lookupSignal.aborted, true);
  assert.ok(performance.now() - started < 250);
});

test('the existing takhrij flag remains the boundary of prewriting lookup', async () => {
  await turn({ question, extra: { runtime: 'HADITH', takhrijWired: false },
    extraDeps: { runnerLookup: () => { assert.fail('disabled lookup'); } } });
});

test('the grading head and prewriting rows share the same first ladder lookup', async () => {
  let calls = 0;
  const r = await prewriteTakhrij({ question, includeRows: true, gradeHeadWanted: true,
    budgetMs: 100, env: {}, deps: {
      runnerLookup: () => async () => { calls += 1; return []; },
      gradingHeadForQuestion: async ({ lookup }) => { await lookup([matn], { bookIds: TAKHRIJ_LADDER_IDS }); return { head: 'local stub head' }; },
    } });
  assert.equal(calls, 1);
  assert.equal(r.gradeHead.head, 'local stub head');
});
