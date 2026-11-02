import test from 'node:test';
import assert from 'node:assert/strict';
import { gradingHead, gradingHeadForQuestion, GRADING_HEAD_LAFZ_NOT_PROVED, GRADING_HEAD_NOT_PROVED } from '../lib/takhrij.js';
import { AGREED_UPON, NOT_RAISED, NO_RULING } from '../lib/takhrij-ladder.js';
import { turn } from '../tools/qaf-gap/turn-harness.mjs';

const question = 'ما درجة حديث «اختلاف أمتي رحمة»؟';
const row = { kind: 'fatwa', title: 'نص محفوظ', publisher: 'ابن باز',
  url: 'https://binbaz.org.sa/fatwas/1234', recordId: '1234', text: 'هذا نص محفوظ في المكتبة.' };
const supported = 'هذا نص محفوظ في المكتبة [[1]].';
const uncited = 'يجوز العمل بهذا الحديث.';
const entry = (parenthetical, extra = {}) => ({ parenthetical, ...extra });
const heads = [
  ['lafz-not-proved', GRADING_HEAD_LAFZ_NOT_PROVED],
  ['not-proved', GRADING_HEAD_NOT_PROVED],
  ['not-raised', gradingHead(question, [entry(NOT_RAISED, { ruledBy: 'السلسلة الضعيفة', grade: 'موضوع' })])],
  ['agreed-upon', gradingHead(question, [entry(AGREED_UPON)])],
  ['bukhari', gradingHead(question, [entry('البخاري')])],
  ['muslim', gradingHead(question, [entry('مسلم')])],
  ['no-ruling', gradingHead(question, [entry('أبو داود · ' + NO_RULING)])],
  ['graded', gradingHead(question, [entry('أبو داود · صحيح', { ruledBy: 'السلسلة الصحيحة' })])],
  ['split', gradingHead(question, [{ silent: true, rulingsByBook: [
    { word: 'صحيح', by: 'السلسلة الصحيحة' }, { word: 'ضعيف', by: 'السلسلة الضعيفة' },
  ] }])],
];

for (const [name, head] of heads) {
  test(`server ${name} head bypasses holds and remains after an uncited writer unit is held`, async () => {
    assert.ok(head);
    const r = await turn({ question, rows: [row], text: supported + '\n\n' + uncited,
      env: { TAKHRIJ_V1: 'on' }, extra: { runtime: 'HADITH', takhrijWired: true },
      extraDeps: {
        gradingHeadForQuestion: async () => ({ head }),
        runnerLookup: () => async () => [],
        applyTakhrij: async (text) => ({ text, entries: [] }),
      } });
    assert.equal(r.calls.writer.length, 1);
    assert.equal(r.out.telemetry.heldUncitedRuling, 1);
    assert.equal(r.out.telemetry.unitsReleased, 1);
    assert.ok(r.sent.startsWith(head + '\n\n'));
    assert.ok(r.sent.includes('هذا نص محفوظ في المكتبة'));
    assert.ok(!r.sent.includes(uncited));
    assert.equal(r.events.filter((e) => e.type === 'replace').length, 0);
    assert.equal(r.sent.split(head).length - 1, 1);
    const delta = r.events.find((e) => e.type === 'delta');
    assert.ok(delta.text.startsWith(head + '\n\n'));
  });
}

test('the real grading-head computation supplies B1 through an empty local lookup', async () => {
  let lookups = 0;
  const r = await turn({ question, rows: [row], text: supported + '\n\n' + uncited,
    env: { TAKHRIJ_V1: 'on' }, extra: { runtime: 'HADITH', takhrijWired: true },
    extraDeps: {
      gradingHeadForQuestion,
      runnerLookup: () => async () => { lookups += 1; return []; },
      applyTakhrij: async (text) => ({ text, entries: [] }),
    } });
  assert.ok(lookups > 0);
  assert.ok(r.sent.startsWith(GRADING_HEAD_LAFZ_NOT_PROVED + '\n\n'));
  assert.equal(r.out.telemetry.heldUncitedRuling, 1);
  assert.ok(!r.sent.includes(uncited));
});

test('the same uncited words from the writer receive no text-based exemption', async () => {
  const r = await turn({ question, rows: [row], text: supported + '\n\n' + GRADING_HEAD_LAFZ_NOT_PROVED,
    extra: { runtime: 'HADITH', takhrijWired: false } });
  assert.equal(r.out.telemetry.heldUncitedRuling, 1);
  assert.ok(!r.sent.includes(GRADING_HEAD_LAFZ_NOT_PROVED));
});
