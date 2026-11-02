import test from 'node:test';
import assert from 'node:assert/strict';
import { writerBudget } from '../lib/before-writing-v2.js';
import { storedAnswerProfile } from '../lib/stored-deen.js';
import { MAX_CONTINUATIONS } from '../lib/continuation.js';
import { turn } from '../tools/qaf-gap/turn-harness.mjs';

test('each profile ceiling reaches the actual BW2 writer request', async () => {
  for (const mode of ['brief', 'normal', 'deep', 'scholar']) {
    const r = await turn({ mode });
    assert.equal(r.calls.writer.length, 1);
    assert.equal(r.calls.writer[0].max_tokens, storedAnswerProfile(mode).maxTokens);
  }
  assert.equal(writerBudget('constructor', {}), 1500);
  assert.equal(writerBudget('brief', { BW2_WRITER_MAX_TOKENS: 'bad' }), 900);
  assert.equal((await turn({ env: { BW2_WRITER_MAX_TOKENS: '1234' } })).calls.writer[0].max_tokens, 1234);
});

test('max_tokens still continues, stopping after at most three more calls', async () => {
  const one = await turn({ stop: (n) => n === 1 ? 'max_tokens' : 'end_turn' });
  assert.equal(one.calls.writer.length, 2);
  const capped = await turn({ stop: 'max_tokens' });
  assert.equal(MAX_CONTINUATIONS, 3);
  assert.equal(capped.calls.writer.length, 4);
  assert.ok(capped.calls.writer.every((body) => body.max_tokens === 900));
});
