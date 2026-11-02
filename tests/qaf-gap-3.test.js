import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CONTINUATIONS } from '../lib/continuation.js';
import { turn } from '../tools/qaf-gap/turn-harness.mjs';

// cf4d4f70 passed the caller's 6144 through outputBudget for every mode.
// BW2_WRITER_MAX_TOKENS must have no effect on the provider request.
test('all four BW2 writer modes retain the cf4d4f70 request ceiling', async () => {
  for (const mode of ['brief', 'normal', 'deep', 'scholar']) {
    for (const override of [undefined, '900', '1234', 'bad']) {
      const env = override === undefined ? {} : { BW2_WRITER_MAX_TOKENS: override };
      const r = await turn({ mode, env });
      assert.equal(r.calls.writer.length, 1);
      assert.equal(r.calls.writer[0].max_tokens, 6144, `${mode}: ${override}`);
    }
  }
});

test('max_tokens still continues, stopping after at most three more calls', async () => {
  const one = await turn({ stop: (n) => n === 1 ? 'max_tokens' : 'end_turn' });
  assert.equal(one.calls.writer.length, 2);
  const capped = await turn({ stop: 'max_tokens' });
  assert.equal(MAX_CONTINUATIONS, 3);
  assert.equal(capped.calls.writer.length, 4);
  assert.ok(capped.calls.writer.every((body) => body.max_tokens === 6144));
});
