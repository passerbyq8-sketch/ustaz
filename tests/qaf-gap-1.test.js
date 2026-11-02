import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewAnswer, sentenceIntegrity, createReviewStream } from '../lib/output-reviewer.js';
import { createBw2Releaser } from '../lib/bw2-units.js';

const review = (text, rest = {}) => reviewAnswer({ text, evidence: [], domain: 'fiqh', ...rest });
async function release(text, rest = {}) {
  const wire = [];
  const r = createBw2Releaser({ emit: (delta) => { wire.push(delta); return true; }, ...rest });
  for (const chunk of text.match(/[\s\S]{1,7}/gu) || []) r.push(chunk);
  const out = await r.end();
  assert.equal(out.text, wire.join(''));
  return out;
}

test('unmeasured duty pair stays retired, and salutations supply no duty', () => {
  assert.equal(review('الرجل عليه قضاء الصوم. لا قضاء عليه.').verdict.selfContradiction.detected, false);
  assert.equal(review('الرجل عليه قضاء الصوم. لا كفارة عليه.').verdict.selfContradiction.detected, false);
  assert.equal(review('محمد عليه السلام. لا كفارة عليه.').verdict.selfContradiction.detected, false);
});

test('questions and repeated questions supply no permission claim', () => {
  for (const text of ['هل يجوز إخراج زكاة الفطر نقدا؟ لا يجوز إخراج زكاة الفطر نقدا.',
    'السؤال: هل يجوز إخراج زكاة الفطر نقدا. لا يجوز إخراج زكاة الفطر نقدا.']) {
    assert.equal(review(text).verdict.selfContradiction.detected, false);
  }
  assert.equal(review('يجوز إخراج زكاة الفطر نقدا. لا يجوز إخراج زكاة الفطر نقدا.').verdict.selfContradiction.detected, true);
  assert.equal(review('ولا يجوز إخراجها نقدا. لا يجوز إخراج القيمة.').verdict.selfContradiction.detected, false);
  assert.equal(review('لا يجوز دفع النقد في زكاة الفطر. زكاة الفطر مستثنى من هذا الجواز.').verdict.selfContradiction.detected, false);
});

test('validity with sin and invalidity are checked while conditions stay distinct', () => {
  assert.equal(review('طوافها صحيح مع الإثم. طوافها باطل.').verdict.selfContradiction.detected, true);
  assert.equal(review('إذا تطهرت فطوافها صحيح. إذا لم تتطهر فطوافها باطل.').verdict.selfContradiction.detected, false);
});

test('a later contradictory unit is held without rewriting released text', async () => {
  const first = 'طوافها صحيح مع الإثم.';
  const out = await release(first + ' طوافها باطل. باب البحث واسع.');
  assert.equal(out.holds.self_contradiction, 1);
  assert.ok(out.text.startsWith(first));
  assert.ok(!out.text.includes('طوافها باطل'));
  assert.ok(out.text.includes('باب البحث واسع'));
});

test('an open report waits for its answer across sentence and delta boundaries', async () => {
  const text = 'سئل رجل عن الصوم. فأجاب بأن الصوم واجب.';
  assert.equal(sentenceIntegrity(text).detected, false);
  assert.equal((await release(text)).holds.incomplete_sentence || 0, 0);
  const out = await release('سئل رجل عن الصوم. وقت الصوم نهار رمضان.');
  assert.equal(out.holds.incomplete_sentence, 1);
  assert.ok(!out.text.includes('سئل رجل'));
  assert.ok(out.text.includes('وقت الصوم'));
  assert.equal((await release('سئل رجل عن الصوم.')).holds.incomplete_sentence, 1);
});

test('the saved cut-quotation marker is held', async () => {
  const text = '(والنص المنقول هنا مقطوع عند هذا الحد).';
  assert.equal(review(text).verdict.sentenceIntegrity.findings[0].rule, 'truncated-quotation');
  assert.equal((await release(text)).holds.incomplete_sentence, 1);
});

test('the question supplies pronoun context, and an explicit subject supplies its own', async () => {
  const question = 'من نذر صوم شهر معين ثم مرض: هل يقضي؟';
  const text = 'فإذا شفي الله مريضها وجب عليها أن توفي بالنذر.';
  assert.equal(review(text, { question }).verdict.sentenceIntegrity.findings[0].rule, 'answer-gender-mismatch');
  assert.equal((await release(text, { question })).holds.answer_gender_mismatch, 1);
  assert.equal(sentenceIntegrity('امرأة نذرت الصوم فوجب عليها الوفاء.', { question }).detected, false);
});

test('stream and whole-answer integrity verdicts agree', () => {
  const text = 'سئل رجل عن الصوم. باب آخر.';
  const options = { domain: 'fiqh', evidence: [], question: 'ما حكم الصوم؟' };
  const stream = createReviewStream(options);
  for (const char of text) stream.push(char);
  assert.deepEqual(stream.end().verdict.sentenceIntegrity, reviewAnswer({ ...options, text }).verdict.sentenceIntegrity);
});
