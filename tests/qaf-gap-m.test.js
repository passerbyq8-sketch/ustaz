import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { createBw2Diagnostic, diagnosticFrames } from '../lib/bw2-diagnostic.js';

// Offline baseline replay relocates imports only, with the same tests/fixtures.
const base = process.env.QAF_GAP_M_SOURCE ? pathToFileURL(process.env.QAF_GAP_M_SOURCE + '/') : null;
const entry = base ? new URL('lib_before-writing-v2.js.mjs', base) : new URL('../lib/before-writing-v2.js', import.meta.url);
const finalizerEntry = base ? new URL('lib_finalized-sse-writer.js.mjs', base) : new URL('../lib/finalized-sse-writer.js', import.meta.url);
const apiEntry = base ? new URL('api_ask.js.mjs', base) : new URL('../api/ask.js', import.meta.url);
const { runBw2Turn, createBw2Wire } = await import(entry);
const { createFinalizedSseResponse } = await import(finalizerEntry);
const apiSource = await readFile(apiEntry, 'utf8');
const logExpression = apiSource.match(/console\.log\('\[bw2\]', (\{[\s\S]*?\n        \})\);/u)[1];
const logRecord = new Function('t', 'currentRuntime', 'answerFrame', 'return ' + logExpression);
const hash = (s) => createHash('sha256').update(s).digest('hex');
const held = 'قال ابن باز: يجوز الجمع بين الظهر والعصر بسبب البرد الشديد [[1]].';
const plain = 'يجوز المسح على الجوربين إذا كانا صفيقين [[1]].';
const specs = [
  { tag: 'Q01-shape', n: 7, chars: 8343, text: held, question: 'ما حكم الجمع بين صلاتي الظهر والعصر للمقيم بسبب البرد الشديد أو الوحل؟' },
  { tag: 'Q04-shape', n: 14, chars: 14949, text: held, question: 'ما درجة حديث «اطلبوا العلم ولو بالصين»؟ ومن خرّجه؟' },
  { tag: 'dependent', text: held + '\nوكذلك قال: يجوز ذلك [[1]].', unrelated: true },
  { tag: 'dependent-opening', text: 'قال النبي ﷺ: «من كذب علي متعمدا فليتبوأ مقعده من النار» [[1]].\nتبحث هذه المسألة في دلالة الحديث [[1]].', unrelated: true },
  { tag: 'marker', text: '@@EZIK_NOT_COVERED@@\nraw suffix \ud83d\ude00' },
  { tag: 'released', text: plain },
  { tag: 'continuation', text: plain, continuation: true },
  { tag: 'refusal', text: plain, stop: 'refusal' },
  { tag: 'no-rows', text: '', n: 0 },
  { tag: 'judge-none', text: '', judge: 0 },
  { tag: 'judge-missing', text: plain, missing: true },
  { tag: 'ranked', text: plain, ranked: true },
  { tag: 'takhrij', text: 'قال النبي ﷺ: «إنما الأعمال بالنيات» [[1]].', takhrij: true },
];
const modes = [
  { tag: 'preview-off', env: 'preview' }, { tag: 'preview-on', env: 'preview', header: '1' },
  { tag: 'production-on', env: 'production', header: '1' }, { tag: 'unset-on', header: '1' },
];
const records = [];
const decode = (sse) => sse.split('\n\n').filter(Boolean).map((raw) => ({ raw,
  name: raw.split('\n').find((l) => l.startsWith('event:'))?.slice(6).trim(),
  data: JSON.parse(raw.split('\n').find((l) => l.startsWith('data:')).slice(5)) }));
const withoutDiag = (sse) => sse.split('\n\n').filter((s) => !s.startsWith('event: bw2diag\n')).join('\n\n');
function captureOf(sse) {
  const frames = decode(sse).filter((e) => e.name === 'bw2diag');
  assert.ok(frames.length, 'diagnostic channel must be present');
  frames.forEach((e, i) => { assert.equal(e.data.seq, i + 1); assert.equal(e.data.of, frames.length); });
  return JSON.parse(frames.map((e) => e.data.piece).join(''));
}

async function run(spec, mode) {
  if (mode.env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = mode.env;
  const question = spec.question || 'ما حكم المسح على الجوربين؟';
  const req = { headers: { 'x-vercel-id': 'region::worker::local-' + spec.tag, ...(mode.header === undefined ? {} : { 'x-ezik-diag': mode.header }) } };
  const diagnostic = createBw2Diagnostic(req, { question, consent: '2026-11-02-1', requestStartedAt: 1000 });
  let sse = '', isBw2 = true;
  const target = new EventEmitter();
  target.write = (s) => { sse += s; return true; };
  target.end = (callback) => callback?.();
  const res = createFinalizedSseResponse(target, { finalize: ({ text }) => ({ ok: true, text }),
    context: () => ({ allowWireOwnedCards: true, lessonRows: isBw2 ? [{ kind: 'lesson', title: 'local lesson', url: 'https://source.invalid/lesson' }] : [] }) });
  if (diagnostic) res.setBw2Diagnostic?.(diagnostic);
  const n = spec.n ?? 1;
  const rows = Array.from({ length: n }, (_, i) => spec.chars ? {
    kind: i < 4 ? 'fatwa' : n === 14 && i < 8 ? 'encyclopedia' : 'lib_book', title: 'local-evidence-' + i,
    url: 'https://source.invalid/' + i, publisher: 'مصدر محلي', recordId: String(i),
    text: 'بحث مستقل في أحكام الطهارة. '.padEnd(Math.floor(spec.chars / n) + (i < spec.chars % n ? 1 : 0), 'ب'),
  } : { ...ROW, ...(spec.takhrij ? { text: 'قال النبي صلى الله عليه وسلم: إنما الأعمال بالنيات. رواه البخاري.' } : {}), ...(spec.unrelated ? { publisher: 'مصدر محلي', text: 'بحث مستقل في أحكام الطهارة.' } : {}) });
  let libAt = 0, writerAt = 0;
  const calls = { writer: [], judge: [], tools: [], takhrij: [], rerank: [] };
  const result = await turn({ run: runBw2Turn, question, text: spec.text,
    env: { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' },
    extra: { diagnostic, wire: createBw2Wire(res), requestStartedAt: 1000,
      aiConsentVersion: spec.ranked ? '2026-11-02-1' : '2026-08-06-1',
      libFlagValue: spec.chars || spec.takhrij ? 'on' : '', libToken: 'local-stub-key',
      takhrijWired: !!spec.takhrij, continueWhenNotCovered: true, runtime: 'STORED_FIQH',
      cards: { buildSourceTag: (row) => ({ tag: '<source>local-card</source>', url: row.url }) } },
    extraDeps: {
      now: () => 1000,
      searchStoredCorpus: async () => ({ records: rows.filter((r) => r.kind === 'encyclopedia').map((r) => ({ ...r, snippet: r.text })) }),
      encyclopediaRow: (r) => r, searchFatwas: async () => ({ records: [] }),
      runTool: async (name, input, ctx) => {
        calls.tools.push({ name, input }); let found = [];
        if (name === 'search_fatawa') found = rows.filter((r) => r.kind === 'fatwa');
        if (name === 'search_library') { const lib = rows.filter((r) => r.kind === 'lib_book'); found = lib.slice(libAt, libAt + ctx.resultCap); libAt += found.length; }
        return { text: '', added: found.map((r) => ctx.table.add({ ...r })), calls: 1 };
      },
      ask: async (body) => { calls.judge.push(body); const count = (body.user.match(/^\[\d+\] /gmu) || []).length;
        return JSON.stringify({ d: spec.missing ? {} : Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, spec.judge ?? 1])) }); },
      callWriter: async ({ body, onText }) => {
        calls.writer.push(body); writerAt++;
        for (const chunk of (writerAt === 1 ? spec.text : '\nمدة المسح يوم وليلة للمقيم [[1]].').match(/[\s\S]{1,17}/gu) || []) onText(chunk);
        return { stop_reason: spec.continuation && writerAt === 1 ? 'max_tokens' : spec.stop || 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } };
      },
      applyTakhrij: async (text, options) => { calls.takhrij.push(text); await options.lookup(['إنما الأعمال بالنيات']); return { text, entries: [] }; },
      runnerLookup: () => async (matns) => { calls.takhrij.push(matns); return []; },
      rerankStore: { evalScript: async () => 1 },
      rerankFetch: async (_url, init) => { calls.rerank.push(JSON.parse(init.body)); return new Response(JSON.stringify({ results: [{ index: 0, relevance_score: .9 }] }), { headers: { 'content-type': 'application/json' } }); },
    } });
  if (result.out.continued) {
    isBw2 = false;
    for (const evt of [
      { type: 'message_start', message: { role: 'assistant', content: [] } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'لم أجد جوابا في المصادر.' } },
      { type: 'content_block_stop', index: 0 }, { type: 'ezik_live_offer' }, { type: 'message_stop' },
    ]) res.write('data: ' + JSON.stringify(evt) + '\n\n');
    res.end();
  }
  const log = '[bw2] ' + JSON.stringify(logRecord(result.out.telemetry, 'STORED_FIQH', 'sharia'));
  return { sse, log, calls, diagnostic, result };
}

test('M3: offline BW2 response/log neutrality, completeness and channel', async (t) => {
  const oldEnv = process.env.VERCEL_ENV, oldNow = Date.now;
  Date.now = () => 1000;
  process.env.COHERE_API_KEY = 'local-stub-key';
  t.after(() => { Date.now = oldNow; delete process.env.COHERE_API_KEY; if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv; });
  let golden = null;
  if (!process.env.QAF_GAP_M_WRITE_BASELINE) golden = JSON.parse(await readFile(new URL('./fixtures/qaf-gap-m-baseline.json', import.meta.url), 'utf8'));
  const generated = {};
  for (const spec of specs) {
    const outputs = [];
    for (const mode of modes) outputs.push(await run(spec, mode));
    const [off, on, production, unset] = outputs;
    generated[spec.tag] = { response: hash(off.sse), log: hash(off.log), calls: hash(JSON.stringify(off.calls)) };
    await t.test('neutrality ' + spec.tag, () => {
      for (const [i, output] of outputs.entries()) {
        assert.equal(withoutDiag(output.sse), off.sse, modes[i].tag + ' response bytes');
        assert.equal(output.log, off.log, modes[i].tag + ' [bw2] bytes');
        assert.deepEqual(output.calls, off.calls, modes[i].tag + ' calls');
      }
      assert.equal(production.diagnostic, null); assert.equal(unset.diagnostic, null); assert.equal(off.diagnostic, null);
      assert.equal(Object.keys(JSON.parse(off.log.slice(6))).length, 79);
      if (golden) assert.deepEqual(generated[spec.tag], golden[spec.tag], 'e9165f60 exact response, log and calls');
    });
    if (!process.env.QAF_GAP_M_WRITE_BASELINE) {
      await t.test('channel ' + spec.tag, () => {
        const frames = decode(on.sse), first = frames.findIndex((e) => e.name === 'bw2diag');
        assert.ok(first >= 0, 'bw2diag exists');
        assert.equal(frames.at(-1).data.type, 'message_stop');
        assert.ok(frames.slice(first, -1).every((e) => e.name === 'bw2diag'), 'diagnostics contiguous immediately before end');
        for (const frame of frames.filter((e) => e.name === 'bw2diag')) assert.ok(Buffer.byteLength('data: ' + JSON.stringify(frame.data)) <= 16000);
        assert.deepEqual(captureOf(on.sse), on.diagnostic.capture, 'lossless reassembly');
      });
      await t.test('completeness ' + spec.tag, () => {
        const c = captureOf(on.sse);
        assert.deepEqual(c.errors, [], 'observation has no internal errors');
        assert.equal(c.requestId, 'local-' + spec.tag); assert.equal(c.question, spec.question || 'ما حكم المسح على الجوربين؟');
        assert.equal(c.writers.length, on.calls.writer.length);
        c.writers.forEach((w, i) => {
          assert.equal(w.bodySha256, hash(JSON.stringify(on.calls.writer[i])));
          assert.equal(w.model, on.calls.writer[i].model);
          assert.equal(w.raw, w.chunks.join('')); assert.ok(w.startedAt !== null && w.endedAt !== null);
        });
        if (c.writers.length) assert.ok(JSON.stringify(on.calls.writer[0].messages).includes(JSON.stringify(c.pinned.value.text).slice(1, -1)));
        if (spec.chars) {
          assert.equal(c.candidates.length, spec.n);
          assert.equal(c.pinned.value.rows.reduce((sum, r) => sum + r.text.length, 0), spec.chars);
          assert.equal(c.pinned.value.sha256, hash(c.pinned.value.text));
          assert.equal(c.ending.value.continued, 'none_released');
          const u = c.units.find((u) => u.status === 'held'); assert.equal(u.text, held);
          const check = u.checks.find((s) => s.rule === 'reviewer-attribution' && s.result === 'hold');
          assert.equal(check.reason, 'heldUnsupportedAttribution'); assert.equal(check.detail.found, false);
          assert.ok(check.detail.phrase.includes('باز')); assert.deepEqual(check.detail.searched, [1]);
          assert.ok(u.checks.findIndex((s) => s.rule === 'self-contradiction') < u.checks.indexOf(check));
          assert.equal(c.ending.value.legacy.value.notFound, true); assert.equal(c.ending.value.legacy.value.liveOffer, true);
        }
        if (spec.tag.startsWith('dependent')) {
          const dependent = c.units.find((u) => /^heldDependent/u.test(u.statusReason || ''));
          assert.ok(dependent); assert.ok(dependent.dependencyId);
          assert.equal(dependent.statusReason, spec.tag === 'dependent-opening' ? 'heldDependentOpening' : 'heldDependentOnHeld');
          assert.equal(c.units.find((u) => u.id === dependent.dependencyId).status, 'held');
        }
        if (spec.tag === 'marker') { assert.equal(c.writers[0].raw, spec.text); assert.equal(c.writers[0].markers[0].offset, 0); assert.equal(c.ending.value.continued, 'marker'); }
        if (spec.ranked) { assert.equal(c.rerank_used, 1); assert.equal(c.candidates[0].rerankScore, 9); }
        if (spec.takhrij) { assert.ok(c.takhrij.length > 0); assert.ok(c.units.some((u) => u.checks.some((s) => s.rule === 'takhrij-lock'))); }
      });
    }
    const diagEvents = decode(on.sse).filter((e) => e.name === 'bw2diag');
    records.push({ tag: spec.tag, responseBytes: Buffer.byteLength(on.sse), events: diagEvents.length,
      captureBytes: diagEvents.length ? Buffer.byteLength(diagEvents.map((e) => e.data.piece).join('')) : 0 });
    if (process.env.QAF_GAP_M_OUT) {
      await mkdir(process.env.QAF_GAP_M_OUT, { recursive: true });
      await writeFile(process.env.QAF_GAP_M_OUT + '/' + spec.tag + '.sse.txt', on.sse);
      if (spec.tag === 'released') await writeFile(process.env.QAF_GAP_M_OUT + '/no-capture.sse.txt', off.sse);
    }
  }
  if (process.env.QAF_GAP_M_WRITE_BASELINE) {
    assert.ok(base, 'baseline generation requires original source');
    await mkdir(new URL('./fixtures/', import.meta.url), { recursive: true });
    await writeFile(new URL('./fixtures/qaf-gap-m-baseline.json', import.meta.url), JSON.stringify(generated, null, 2) + '\n');
  }
  if (process.env.QAF_GAP_M_OUT) await writeFile(process.env.QAF_GAP_M_OUT + '/sizes.json', JSON.stringify(records, null, 2) + '\n');
});

test('M3: gate is exact and production constructs nothing', () => {
  const old = process.env.VERCEL_ENV;
  try {
    for (const env of [undefined, '', 'production', 'Preview', 'preview ']) {
      if (env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = env;
      // Accessing capture inputs would throw: the gate must return before any build.
      assert.equal(createBw2Diagnostic({ get headers() { throw new Error('off gate read'); } }), null);
    }
    process.env.VERCEL_ENV = 'preview';
    for (const header of [undefined, '', '0', 'true', '01', '1 ', 1, ['1']]) assert.equal(createBw2Diagnostic({ headers: { 'x-ezik-diag': header } }), null);
  } finally { if (old === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = old; }
});

test('M3: escaped Arabic and supplementary characters round-trip within byte limit', () => {
  const capture = { requestId: 'rid', text: ('العربية😀\\"\n').repeat(6000) };
  const frames = diagnosticFrames(capture);
  assert.ok(frames.length > 10);
  for (const frame of frames) {
    const line = frame.split('\n')[1]; assert.ok(Buffer.byteLength(line) <= 16000);
    const part = JSON.parse(line.slice(6)).piece;
    assert.ok(!/[\uD800-\uDBFF]$/u.test(part)); assert.ok(!/^[\uDC00-\uDFFF]/u.test(part));
  }
  assert.deepEqual(captureOf(frames.join('')), capture);
});
