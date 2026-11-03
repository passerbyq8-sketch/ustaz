import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { RERANK_CONSENT_VERSION } from '../lib/rerank/runtime.js';

// Observe the real releaser boundary without adding a production test hook.
// Baseline replay changes only the module/import locations, not assertions.
const entry = process.env.QAF_GAP_L_TURN_MODULE
  ? pathToFileURL(process.env.QAF_GAP_L_TURN_MODULE) : new URL('../lib/before-writing-v2.js', import.meta.url);
let source = await readFile(entry, 'utf8');
source = source.replace('createBw2Releaser, pinnedTextOf', 'createBw2Releaser as originalReleaser, pinnedTextOf')
  .replace(/from '(\.\.?\/[^']+)'/gu, (_match, spec) => `from '${new URL(spec, entry)}'`)
  + '\nconst createBw2Releaser = options => { globalThis[Symbol.for("qaf-gap-l-input")]?.(options); return originalReleaser(options); };\n';
const { runBw2Turn, renderPinnedEvidence } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('L2a: full turns have byte-identical judge, writer, pinned table and releaser evidence; scores affect only cards', async t => {
  process.env.COHERE_API_KEY = 'local-stub-key';
  t.after(() => { delete process.env.COHERE_API_KEY; delete globalThis[Symbol.for('qaf-gap-l-input')]; });
  const rows = Array.from({ length: 4 }, (_, i) => ({ ...ROW, title: 'candidate-' + i,
    recordId: 'candidate-' + i, url: ROW.url + '/' + i }));
  const inputs = [];
  globalThis[Symbol.for('qaf-gap-l-input')] = o => inputs.push(o);
  for (const question of ['ما شروط صحة الصلاة؟', 'ما حكم المسح على الجوربين؟']) {
    const run = on => turn({ run: runBw2Turn, question, rows,
      text: 'يجوز المسح على الجوربين إذا كانا صفيقين [[1]].',
      env: on ? { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' } : {},
      extra: { aiConsentVersion: RERANK_CONSENT_VERSION,
        cards: { buildSourceTag: row => ({ tag: '<source url="' + row.url + '">local-card</source>', url: row.url }) } },
      extraDeps: {
        searchFatwas: async () => ({ records: [] }), rerankStore: { evalScript: async () => 1 },
        // Ref 2 is dropped by the judge. Scores reverse the
        // original order and suppress ref 1's card, but must not change evidence.
        ask: async () => JSON.stringify({ d: { 1: 1, 2: 0, 3: 1, 4: 1 } }),
        rerankFetch: async () => new Response(JSON.stringify({ results: [
          { index: 1, relevance_score: .99 }, { index: 2, relevance_score: .95 },
          { index: 3, relevance_score: .9 }, { index: 0, relevance_score: .5 },
        ] }), { headers: { 'content-type': 'application/json' } }),
      } });
    const off = await run(false), on = await run(true);
    const [offInput, onInput] = inputs.splice(0);
    assert.equal(on.out.telemetry.rerank_used, 1);
    assert.equal(JSON.stringify(on.calls.judge), JSON.stringify(off.calls.judge));
    assert.equal(JSON.stringify(on.calls.writer), JSON.stringify(off.calls.writer));
    assert.equal(JSON.stringify(onInput.rows), JSON.stringify(offInput.rows));
    assert.equal(renderPinnedEvidence(onInput.rows), renderPinnedEvidence(offInput.rows));
    assert.ok(onInput.rows.every(row => !('rerankScore' in row) && !('rerankCardMin' in row)));
    assert.equal(on.out.telemetry.pinnedRows, 3);
    assert.equal(off.out.telemetry.cardsSent, 1);
    assert.equal(on.out.telemetry.cardsSent, 0);
    assert.equal(on.out.telemetry.unitsReleased, off.out.telemetry.unitsReleased);
    assert.equal(on.sent.replace(/\n?<source[^>]*>.*?<\/source>/gu, ''),
      off.sent.replace(/\n?<source[^>]*>.*?<\/source>/gu, ''));
  }
});
