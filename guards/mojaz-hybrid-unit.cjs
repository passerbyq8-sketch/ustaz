'use strict';
// guards/mojaz-hybrid-unit.cjs -- the hybrid (MOJAZ_SCOPE=bw2): the before-writing writer's units are held for one look,
// and a turn that is not an answer is written again on MODEL_ESCALATE before the reader has a byte of it.
//
//   node guards/mojaz-hybrid-unit.cjs
//
// No network, no model, no environment: the sources, the judge and the writer are fakes handed in through `deps`,
// the wire is a recorder. Arabic is written as escapes so the file stays ASCII.
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(root, rel)).href);
let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => { if (cond) { pass += 1; return; } fail += 1; console.log('FAIL', label, detail); };

const IBN_BAZ = 'ابن باز';
const Q = 'ما حكم المسح على الجوارب؟';
const RULING = 'يجوز المسح على الجوارب إذا لبسها على طهارة';
const TERM = 'ومدته يوم وليلة للمقيم وثلاثة أيام بلياليها للمسافر';
const ROW = {
  kind: 'fatwa', title: 'حكم المسح على الجوارب', url: 'https://binbaz.org.sa/fatwas/1234',
  publisher: IBN_BAZ, scholarId: 'binbaz', recordId: '1234',
  text: 'السؤال: ' + Q + ' الجواب: ' + RULING + '، ' + TERM + '.',
  passage: 'السؤال: ' + Q + '\nالجواب: ' + RULING + '، ' + TERM + '.',
};
const GOOD = RULING + ' [[1]].\n' + TERM + ' [[1]].';
const GREET = 'السلام عليكم ورحمة الله وبركاته، تفضل يا مستخدم.';
const TOOL_TALK = 'أكمل الآن بالجواب، ولم أستدعِ أداةً جديدة، فالنتائج التي بين يديّ تكفي للمسألة.';

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  const E = await esm('lib/mojaz-escalate.js');
  const G = await esm('lib/mojaz-guards.js');
  const M = await esm('lib/mojaz.js');
  const ASK = await esm('api/ask.js');

  // -- the pure parts ---------------------------------------------------------
  const tag = '<source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/1234">t</source>';
  const long = 'x '.repeat(200);
  ok(E.BW2_MIN_PROSE_CHARS === 317, 'the calibrated threshold is the one the report prints');
  ok(E.proseLength(`${long} [[1]]\n${tag}`) === E.proseLength(long), 'prose length leaves the card and the citation out');
  ok(E.sourceCardCount(`a${tag}b${tag}`) === 2 && E.sourceCardCount('a') === 0, 'source cards are counted');
  const base = { text: long + tag, released: 3, guardDropped: 0, hasBlock: false, markerSeen: false };
  ok(E.bw2HoldReason(base) === '', 'a card and enough prose is released as it is');
  ok(E.bw2HoldReason({ ...base, text: long }) === 'no_source_card', 'no card, no stored block: written again');
  ok(E.bw2HoldReason({ ...base, text: 'short ' + tag }) === 'short_prose', 'a card but prose under the threshold: written again');
  ok(E.bw2HoldReason({ ...base, text: '## نص الفتوى\n' + long }) === '', 'the stored fatwa block counts as the source');
  ok(E.bw2HoldReason({ ...base, text: 'short', hasBlock: true }) === '', 'a stored fatwa above the writer stands for the card and the length');
  ok(E.bw2HoldReason({ ...base, text: '', released: 0, guardDropped: 2 }) === 'no_content_after_guard', 'nothing left after the guard');
  ok(E.bw2HoldReason({ ...base, text: '', released: 0, guardDropped: 0 }) === '', 'nothing released and nothing dropped is the existing not-covered path');
  ok(E.bw2HoldReason({ ...base, text: '', released: 0, guardDropped: 2, markerSeen: true }) === '', 'the writer marker belongs to the not-covered path');
  ok(E.bw2HoldReason({ ...base, text: E.FALLBACK_REPLIES[0], hasBlock: true }) === 'fallback_reply', 'the last-resort sentence is written again, stored fatwa or not');

  // tool talk is a guard kind only when asked for
  const kindsOf = (text, opts) => G.guardMojaz(text, opts).removed.map((r) => r.kind);
  ok(JSON.stringify(kindsOf(TOOL_TALK + '\n' + RULING + '.', { sourceCount: 1 })) === '[]', 'tool talk stays when the scope key is absent (the old guard, unchanged)');
  ok(JSON.stringify(kindsOf(TOOL_TALK + '\n' + RULING + '.', { sourceCount: 1, toolTalk: true })) === '["tool_talk"]', 'tool talk is dropped whole under the scope key');
  ok(G.guardMojaz(TOOL_TALK + '\n' + RULING + '.', { toolTalk: true }).text === RULING + '.', 'the sentence after it is untouched');
  ok(G.createUnitGuard({ toolTalk: true }).check(TOOL_TALK, 1).removed.length === 1 && G.createUnitGuard({}).check(TOOL_TALK, 1).removed.length === 0, 'the unit guard reads the same switch');

  // the two new keys
  const f0 = M.mojazFlags({});
  ok(f0.writerModel === '' && f0.scopeBw2 === false, 'both new keys are off when unset');
  const f1 = M.mojazFlags({ MOJAZ_WRITER_MODEL: ' claude-haiku-5-5 ', MOJAZ_SCOPE: 'BW2' });
  ok(f1.writerModel === 'claude-haiku-5-5' && f1.scopeBw2 === true, 'the writer model is trimmed and the scope reads bw2');
  ok(M.mojazFlags({ MOJAZ_SCOPE: 'all' }).scopeBw2 === false, 'any other scope is the old scope');

  // -- the turn, with fakes ---------------------------------------------------
  const cards = { buildSourceTag: ASK.buildSourceTag, buildBookTag: ASK.buildBookTag, encyclopediaCards: false, max: 3 };
  const run = async ({ writers, mojaz, question = Q }) => {
    const pieces = [];
    let sent = '';
    const wire = {
      status() { return true; }, liveOffer() { return true; }, finish() {}, opened: false, dead: false,
      delta(piece) { pieces.push(String(piece)); sent += String(piece); this.opened = true; return true; },
      get sent() { return sent; },
    };
    const bodies = [];
    let n = 0;
    const deps = {
      runTool: (name, input, ctx) => Promise.resolve({ text: '', added: name === 'search_fatawa' ? [ctx.table.add({ ...ROW })] : [], calls: 1 }),
      searchStoredCorpus: async () => ({ records: [] }),
      warmEncyclopedia: async () => true, encyclopediaReady: () => true,
      ask: async ({ user }) => JSON.stringify({ d: Object.fromEntries(Array.from({ length: (user.match(/^\[\d+\] /gmu) || []).length }, (_, i) => [String(i + 1), 1])) }),
      callWriter: async ({ body, onText }) => {
        bodies.push({ model: body.model, system: body.system, max_tokens: body.max_tokens });
        const text = writers[Math.min(n, writers.length - 1)];
        n += 1;
        for (let i = 0; i < text.length; i += 13) onText(text.slice(i, i + 13));
        return { usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'end_turn', content: [] };
      },
      runnerLookup: () => async () => [],
    };
    const out = await BW2.runBw2Turn({
      question, messages: [{ role: 'user', content: question }], mode: 'brief', band: 'adult', system: 'PROD-SYSTEM', model: 'writer-haiku', maxTokens: 4096,
      providerUrl: 'https://api.anthropic.invalid/v1/messages', headers: {}, cards, wire, requestStartedAt: Date.now(),
      env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400' }, deps, mojaz,
    });
    return { out, pieces, sent, bodies };
  };
  const logs = { hold: [], escalate: [], usage: [] };
  const hybrid = (extra = {}) => ({
    hold: true, escalateModel: 'sonnet-x', escalateSystem: 'PROD-SYSTEM', outputCap: 1024, minProse: 60,
    newUnitGuard: () => G.createUnitGuard({ question: Q, sourceCount: 0, toolTalk: true }),
    onDrop: () => {}, onHold: (e) => logs.hold.push(e), onEscalate: (e) => logs.escalate.push(e), onUsage: (e) => logs.usage.push(e), ...extra,
  });
  const reset = () => { logs.hold.length = 0; logs.escalate.length = 0; logs.usage.length = 0; };

  // 1. no mojaz at all: today's path, the writer's body untouched
  reset();
  const plain = await run({ writers: [GOOD], mojaz: null });
  ok(plain.bodies.length === 1 && plain.bodies[0].model === 'writer-haiku' && plain.bodies[0].max_tokens > 1024 && plain.sent.includes(RULING), 'no mojaz: one writer call, the budget as it was', JSON.stringify(plain.bodies));

  // 2. hold, a good answer: one call, the same pieces the live path released
  reset();
  const good = await run({ writers: [GOOD], mojaz: hybrid() });
  ok(good.bodies.length === 1 && good.bodies[0].model === 'writer-haiku' && logs.escalate.length === 0, 'hold, good answer: no escalation, one call', JSON.stringify(logs));
  ok(JSON.stringify(good.pieces) === JSON.stringify(plain.pieces), 'hold, good answer: the released pieces are the live path\'s, byte for byte and in order', JSON.stringify([good.pieces, plain.pieces]));
  ok(logs.hold.length === 1 && logs.hold[0].reason === '' && logs.hold[0].cards >= 1, 'hold, good answer: the look is logged with no reason', JSON.stringify(logs.hold));

  // 3. hold, a short answer with no card: written again by the stronger model under the production system
  reset();
  const SHORT = 'جواب قصير جدا.';
  const redo = await run({ writers: [SHORT, GOOD], mojaz: hybrid() });
  ok(redo.bodies.length === 2 && redo.bodies[1].model === 'sonnet-x' && redo.bodies[1].system === 'PROD-SYSTEM' && redo.bodies[1].max_tokens === plain.bodies[0].max_tokens && redo.bodies[0].max_tokens === 1024, 'escalated: the second call is the stronger model, production system, production budget', JSON.stringify(redo.bodies));
  ok(!redo.sent.includes(SHORT) && redo.sent.includes(RULING), 'escalated: nothing of the first writer reached the reader, the second\'s answer did', redo.sent);
  ok(logs.escalate.length === 1 && logs.escalate[0].path === 'bw2' && logs.escalate[0].fromModel === 'writer-haiku' && logs.escalate[0].toModel === 'sonnet-x' && typeof logs.escalate[0].reason === 'string' && logs.escalate[0].reason !== '', 'escalated: the line carries reason, path, from and to', JSON.stringify(logs.escalate));
  ok(redo.out.telemetry.writerCalls === 2 && redo.out.telemetry.writerModel === 'sonnet-x', 'escalated: telemetry says two calls and whose');

  // 4. the guard takes the whole answer (a greeting): nothing left, written again
  reset();
  const gr = await run({ writers: [GREET, GOOD], mojaz: hybrid() });
  ok(gr.bodies.length === 2 && logs.escalate[0] && logs.escalate[0].reason === 'no_content_after_guard' && gr.sent.includes(RULING) && !gr.sent.includes('تفضل'), 'greeting-only writer: escalated, and the greeting never went out', JSON.stringify(logs.escalate));

  // 5. tool talk is dropped before release, the rest is released, no escalation
  reset();
  const tt = await run({ writers: [TOOL_TALK + '\n' + GOOD], mojaz: hybrid() });
  ok(tt.bodies.length === 1 && !tt.sent.includes('أداة') && tt.sent.includes(RULING), 'tool talk dropped, the answer released', tt.sent);

  // 6. a second failure is released as it is: one escalation at most
  reset();
  const twice = await run({ writers: [SHORT, SHORT], mojaz: hybrid() });
  ok(twice.bodies.length === 2 && logs.escalate.length === 1, 'at most one escalation');

  // 7. hold without an escalation model: looked at, never rewritten
  reset();
  const noModel = await run({ writers: [SHORT], mojaz: hybrid({ escalateModel: '' }) });
  ok(noModel.bodies.length === 1 && logs.escalate.length === 0, 'no model to escalate to: released as it is');

  // 8. the marker: the not-covered path, no escalation
  reset();
  const marker = await run({ writers: ['@@EZIK_NOT_COVERED@@'], mojaz: hybrid() });
  ok(marker.bodies.length === 1 && logs.escalate.length === 0, 'the writer\'s not-covered marker is not escalated');

  // 9. the hooks without hold: the older rule only, and no hold look
  reset();
  const unheld = await run({ writers: [SHORT], mojaz: hybrid({ hold: false }) });
  ok(unheld.bodies.length === 1 && logs.hold.length === 0 && logs.escalate.length === 0, 'without hold the short answer is released as in (b)');

  console.log(`mojaz-hybrid-unit: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.log('FAIL (threw)', error && error.stack || error); process.exit(1); });
