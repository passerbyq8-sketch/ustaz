import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildFatwaRecord } from '../lib/full-fatwa.js';
import { directExitEnabled, BW2_DIRECT_EXPAND } from '../lib/before-writing-v2.js';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';

const question = 'ما حكم المسح على الجوربين؟';
const record = buildFatwaRecord({ question, answer: ROW.text, sourceKind: 'corpus',
  contentMode: 'written_fatwa', title: ROW.title, url: ROW.url, publisher: ROW.publisher });
const opts = { question, rows: [{ ...ROW, fatwaRecord: record }], judge: 2, text: 'باب البحث واسع.' };

test('the default/off direct stream is byte-identical to the pre-item recorded stream', async () => {
  assert.equal(directExitEnabled({}), false);
  const a = await turn(opts);
  const b = await turn({ ...opts, env: { BW2_DIRECT_EXIT: 'off' } });
  assert.equal(a.sent, b.sent);
  assert.equal(a.out.telemetry.directFatwa, true);
  assert.equal(a.calls.writer.length, 1);
  assert.equal(createHash('sha256').update(a.sent).digest('hex'), 'f477cf303cff1d874bd625d83cceaf9c8204f74820551b2f475a138b8ebd3418');
});

test('enabled direct exit ends after the exact fatwa and expansion line, with zero writer calls', async () => {
  const r = await turn({ ...opts, env: { BW2_DIRECT_EXIT: 'on' } });
  assert.equal(r.out.telemetry.directFatwa, true);
  assert.equal(r.calls.writer.length, 0);
  assert.ok(r.sent.includes(record.answer));
  assert.ok(r.sent.endsWith(BW2_DIRECT_EXPAND + '\n'));
  assert.ok(!r.sent.includes(opts.text));
  assert.equal(r.events.filter((e) => e.type === 'offer').length, 1);
  assert.equal(r.events.at(-1).type, 'finish');
});
