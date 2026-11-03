import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { captures, replay, projection, assertSafety } from '../tools/qaf-gap/n-replay.mjs';

test('N1: all 30 actual M captures reproduce exactly on 514e9fda', async () => {
  for (const c of captures) {
    const before = await replay(c, { baseline: true });
    assert.deepEqual(projection(before.capture), projection(c), c.tag);
    assert.deepEqual(before.capture.units.map((u) => u.checks.filter((x) => x.rule === 'reviewer').map((x) => x.detail)),
      c.units.map((u) => u.checks.filter((x) => x.rule === 'reviewer').map((x) => x.detail)), c.tag + ': fixed captured reviewer results');
  }
});

test('N2(a): real late proof releases earlier gate-only units in writer order', async () => {
  const results = [];
  for (const c of captures) {
    const after = await replay(c);
    assertSafety(c, after);
    if (c.tag === 'Q04-13-O') {
      for (const id of ['u4', 'u5', 'u8', 'u10']) assert.ok(after.releaseOrder.includes(id), c.tag + '/' + id + ': a later proof must resume this gate-only unit');
      assert.ok(after.releaseOrder.indexOf('u10') < after.releaseOrder.indexOf('u13'), 'pending units precede the opener');
    }
    results.push({ tag: c.tag, before: projection(c), after: projection(after.capture), releaseOrder: after.releaseOrder });
  }
  if (process.env.QAF_GAP_N_OUTPUT) await writeFile(process.env.QAF_GAP_N_OUTPUT, JSON.stringify(results, null, 2) + '\n');
});
