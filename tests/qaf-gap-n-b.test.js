import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { captures, replay, projection, assertSafety } from '../tools/qaf-gap/n-replay.mjs';
import { askedHadithOf, pinnedRowsCarryAskedMatn } from '../lib/bw2-units.js';

test('N2(b): actual pinned asked-matn evidence opens all seven M handovers', async () => {
  const results = [];
  for (const c of captures) {
    const after = await replay(c);
    assertSafety(c, after);
    if (c.tag.startsWith('Q04') && c.ending.value.continued === 'none_released') {
      assert.ok(after.summary.substantive > 0, c.tag + ': exact asked matn is in captured writer rows');
      assert.equal(after.capture.ending.value.continued, '', c.tag + ': evidence opens the gate');
    }
    results.push({ tag: c.tag, before: projection(c), after: projection(after.capture), releaseOrder: after.releaseOrder });
  }
  if (process.env.QAF_GAP_N_OUTPUT) await writeFile(process.env.QAF_GAP_N_OUTPUT, JSON.stringify(results, null, 2) + '\n');
});

test('N2(b): containment uses one full writer-visible passage and the asked words', () => {
  const c = captures.find((c) => c.tag === 'Q04-01-O');
  const matn = askedHadithOf(c.question);
  assert.equal(pinnedRowsCarryAskedMatn(c.pinned.value.releaserRows, matn), true);
  const unrelated = captures.find((c) => c.tag === 'Q01-02-O').pinned.value.releaserRows;
  assert.equal(pinnedRowsCarryAskedMatn(unrelated, matn), false, 'a different captured topic is insufficient');
  assert.equal(pinnedRowsCarryAskedMatn(unrelated, ''), false, 'empty question matn is insufficient');
  // Deliberate negative controls derived from the captured matn, not live evidence.
  assert.equal(pinnedRowsCarryAskedMatn([{ title: matn, text: unrelated[0].writerText }], matn), false, 'metadata cannot open the gate');
  assert.equal(pinnedRowsCarryAskedMatn([{ writerText: 'نص آخر', fullText: matn }], matn), false, 'hidden text cannot open the gate');
  const words = matn.split(' ');
  assert.equal(pinnedRowsCarryAskedMatn([{ text: words.slice(0, 2).join(' ') }, { text: words.slice(2).join(' ') }], matn), false, 'no cross-row assembly');
  assert.equal(pinnedRowsCarryAskedMatn([{ text: matn.replace('اطلبوا', 'اِطْلُبُوا').replace('العلم', 'الـعِلْم') }], matn), true, 'harakat/tatweel normalization');
  assert.equal(pinnedRowsCarryAskedMatn([{ text: 'أ إ آ ٱ ؤ ئ ى ی ة' }], 'ا ا ا ا ء ء ي ي ه'), true, 'same normalization as the M extractor');
});
