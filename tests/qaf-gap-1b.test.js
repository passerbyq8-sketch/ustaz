import test from 'node:test';
import assert from 'node:assert/strict';
import { hadithGradeConsistency, reviewAnswer, createReviewStream } from '../lib/output-reviewer.js';
import { createBw2Releaser } from '../lib/bw2-units.js';
const question = 'ما صحة حديث «من قرأ سورة الواقعة كل ليلة لم تصبه فاقة أبدا»؟';

test('different grades require different named speakers for the same matn', () => {
  assert.equal(hadithGradeConsistency('الحكم عليه في السلسلة الضعيفة: موضوع. هذا حديث ضعيف.', { question }).detected, true);
  assert.equal(hadithGradeConsistency('قال الألباني: هذا حديث صحيح. قال ابن باز: هذا حديث ضعيف.', { question }).detected, false);
  assert.equal(hadithGradeConsistency('قال الألباني: هذا حديث صحيح وقال ابن باز: هذا حديث ضعيف.', { question }).detected, false);
  assert.equal(hadithGradeConsistency('هذا حديث صحيح. هذا حديث ليس ضعيف.', { question }).detected, false);
  assert.equal(hadithGradeConsistency('قال ابن باز: هذا حديث صحيح. قال ابن باز: هذا حديث ضعيف.', { question }).detected, true);
  assert.equal(hadithGradeConsistency('هذا حديث ضعيف. هذا حديث ضعيف.', { question }).detected, false);
  assert.equal(hadithGradeConsistency('هذا حديث ضعيف. هذا حديث صحيح.').detected, false);
  assert.equal(hadithGradeConsistency('حديث «الأعمال بالنيات ولكل امرئ ما نوى» صحيح. حديث «من قرأ سورة الواقعة كل ليلة» ضعيف.').detected, false);
});

test('a conflicting second grade is held before it reaches the wire', async () => {
  const r = createBw2Releaser({ question, aboveText: '', emit: () => true,
    leadLine: 'الحكم عليه في السلسلة الضعيفة: موضوع.' });
  // Released context is the real releaser's text, including its server-owned head.
  r.push('باب البحث واسع. هذا حديث ضعيف.');
  const out = await r.end();
  assert.equal(out.holds.grade_conflict, 1);
  assert.ok(!out.text.includes('هذا حديث ضعيف'));
});

test('whole and streamed review expose the same grade verdict', () => {
  const text = 'هذا حديث موضوع. هذا حديث ضعيف.';
  const opts = { question, domain: 'fiqh', evidence: [] };
  const stream = createReviewStream(opts); stream.push(text);
  assert.deepEqual(stream.end().verdict.gradeConsistency, reviewAnswer({ ...opts, text }).verdict.gradeConsistency);
});
