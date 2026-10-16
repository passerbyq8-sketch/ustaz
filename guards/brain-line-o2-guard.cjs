// guards/brain-line-o2-guard.cjs -- ITEM O2 (32) -- 2026-10-15 brain-line
//
// THE STOP REASON AND THE AUTOMATIC CONTINUATION. Measured on 7ba44481 (side-brain-line-2026-10-15/items/32.md): an
// answer that hit max_tokens reached the reader cut, with `<incomplete/>` on the free brain and before writing, and with
// nothing at all on the legacy stream, whose stop_reason nobody read.
//
// What this guard holds (the order, O2):
//   (1) lib/continuation.js: max_tokens then end_turn -> one continuation, the body joined at its seam (a repeated
//       opening dropped); four max_tokens -> three continuations, then the stop stays max_tokens; a failed call stops;
//   (2) before writing (the real runBw2Turn, a fake writer): one continuation and no mark; three and the mark;
//   (3) the free brain (the real runFreeBrainTurn, a stubbed provider): the same;
//   (4) the legacy stream (the real relay into the real sealed writer): max_tokens -> continued, joined, no mark; still
//       cut after three -> the mark, and the stop and the count go to the answer's record;
//   (5) the wiring in api/ask.js for both legacy streams and the record.
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 300);
const CONTINUE = 'كمّل من آخر نقطة من غير إعادة ما سبق';
const MARK = '<incomplete/>';

(async () => {
  let C = null;
  try { C = await esm('lib/continuation.js'); } catch { C = null; }
  console.log('-- 1. the library');
  ok('lib/continuation.js exists with the order\'s message, three calls and 240 s', !!C && C.CONTINUE_MESSAGE === CONTINUE && C.MAX_CONTINUATIONS === 3 && C.CONTINUATION_BUDGET_MS === 240000);
  if (C) {
    const A = 'الصلاة في وقتها واجبة على كل مكلف، ومن أخرها بغير عذر أثم، ';
    const B = 'ومن أخرها بغير عذر أثم، وعليه التوبة والقضاء.';
    let calls = [];
    const one = await C.runContinuations({ firstStop: 'max_tokens', soFar: A, startedAt: Date.now(), emit: () => {},
      call: async ({ tail }) => { calls.push(tail); return { text: B, stop: 'end_turn' }; } });
    ok('max_tokens then end_turn: one continuation', one.continued === 1 && one.stop === 'end_turn', JSON.stringify({ c: one.continued, s: one.stop }));
    ok('...the history gets the text so far and the order\'s message', calls[0][0].role === 'assistant' && calls[0][0].content === A && calls[0][1].role === 'user' && calls[0][1].content === CONTINUE);
    ok('...joined at the seam, the repeated opening dropped once', one.text === A + 'وعليه التوبة والقضاء.', ascii(one.text));
    calls = [];
    const four = await C.runContinuations({ firstStop: 'max_tokens', soFar: A, startedAt: Date.now(), emit: () => {},
      call: async ({ n }) => { calls.push(n); return { text: ' جزء ' + n, stop: 'max_tokens' }; } });
    ok('four max_tokens: three continuations and the stop stays max_tokens', four.continued === 3 && four.stop === 'max_tokens' && calls.length === 3);
    const late = await C.runContinuations({ firstStop: 'max_tokens', soFar: A, startedAt: Date.now() - 240001, call: async () => ({ text: 'x', stop: 'end_turn' }) });
    ok('past 240 s of the answer: no continuation', late.continued === 0 && late.stop === 'max_tokens');
    const failed = await C.runContinuations({ firstStop: 'max_tokens', soFar: A, startedAt: Date.now(), call: async () => { throw new Error('529'); } });
    ok('a failed call stops, and the answer is still cut', failed.continued === 1 && failed.stop === 'max_tokens' && failed.text === A);
    const done = await C.runContinuations({ firstStop: 'end_turn', soFar: A, call: async () => ({ text: 'x', stop: 'end_turn' }) });
    ok('end_turn: nothing to continue', done.continued === 0);
  }

  console.log('-- 2. before writing');
  {
    const SSE = await esm('lib/finalized-sse-writer.js');
    const BW2 = await esm('lib/before-writing-v2.js');
    const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, headersSent: false,
      write(c) { this.headersSent = true; this.writes.push(String(c)); return true; }, end() { this.ended += 1; return this; },
      status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; }, flushHeaders() { this.headersSent = true; },
      once() { return this; }, on() { return this; }, removeListener() { return this; } });
    const framesOf = (writes) => writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
      .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
    const textOf = (t) => framesOf(t.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('');
    // The W6B3 fixture of guards/speed-pipes-guard.cjs (one encyclopedia row naming the Hanafis), with a second sentence.
    const Q = 'ما حكم إخراج زكاة المال عروضا بدل النقود؟ وما أقوال المذاهب فيها؟';
    const ROW = 'ذهب الحنفية إلى جواز إخراج القيمة في الزكاة. وذهب الجمهور إلى منع إخراج القيمة في الزكاة.';
    const rec = { id: 'E1', term: 'القيمة', part: 23, snippet: ROW, text: ROW };
    const P1 = 'ذهب الحنفية إلى جواز إخراج القيمة في الزكاة [[1]].';
    const P2 = '\nوذهب الجمهور إلى منع إخراج القيمة في الزكاة [[1]].';
    const turn = async (script) => {
      const t = target();
      const bodies = [];
      const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const out = await BW2.runBw2Turn({
        question: Q, messages: [{ role: 'user', content: Q }], wire: BW2.createBw2Wire(facade), continueWhenNotCovered: true,
        deps: {
          runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
          encyclopediaReady: () => true, warmEncyclopedia: () => true, ask: async () => '{"d":{"1":1}}',
          callWriter: async ({ body, onText }) => { const step = script(bodies.length); bodies.push(body); onText(step.text); return { stop_reason: step.stop, usage: {} }; },
        },
      });
      return { out, bodies, text: textOf(t) };
    };
    const a = await turn((i) => (i === 0 ? { text: P1, stop: 'max_tokens' } : { text: P2, stop: 'end_turn' }));
    ok('BW2: max_tokens then end_turn -> two writer calls, one continuation', a.bodies.length === 2 && a.out.telemetry.continuations === 1, JSON.stringify({ n: a.bodies.length, c: a.out.telemetry.continuations }));
    const tail = a.bodies[1] ? a.bodies[1].messages.slice(-2) : [];
    ok('BW2: the continuation carries the same system and the text so far, then the order\'s message',
      !!a.bodies[1] && a.bodies[1].system === a.bodies[0].system && tail.length === 2 && tail[0].role === 'assistant' && String(tail[0].content).includes('ذهب الحنفية') && tail[1].content === CONTINUE);
    ok('BW2: the body is joined and carries no mark', a.text.includes('ذهب الحنفية') && a.text.includes('وذهب الجمهور') && !a.text.includes(MARK), ascii(a.text));
    const b = await turn((i) => ({ text: i === 0 ? P1 : P2, stop: 'max_tokens' }));
    ok('BW2: four max_tokens -> three continuations, then the mark', b.bodies.length === 4 && b.out.telemetry.continuations === 3 && b.text.includes(MARK), JSON.stringify({ n: b.bodies.length, c: b.out.telemetry.continuations }));
  }

  console.log('-- 3. the free brain');
  {
    const loop = await esm('lib/free-brain/loop.js');
    const PROVIDER = 'https://stub.invalid/v1/messages';
    const BASE = { messages: [{ role: 'user', content: 'ما حكم الجمع للمسافر؟' }], system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
      mode: 'عادي', lexicalRoute: 'DEEN', providerUrl: PROVIDER, headers: {} };
    const drive = async (script) => {
      const realFetch = globalThis.fetch;
      const bodies = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        const body = JSON.parse(init && init.body ? init.body : '{}');
        const step = script(bodies.length); bodies.push(body);
        return { ok: true, status: 200, json: async () => step };
      };
      try { return { turn: await loop.runFreeBrainTurn({ ...BASE }), bodies }; } finally { globalThis.fetch = realFetch; }
    };
    const T1 = 'الجمع للمسافر جائز عند الحاجة في السفر الطويل،';
    const T2 = ' ومن أهل العلم من قيده بجد السير.';
    const a = await drive((i) => ({ stop_reason: i === 0 ? 'max_tokens' : 'end_turn', content: [{ type: 'text', text: i === 0 ? T1 : T2 }] }));
    ok('free brain: max_tokens then end_turn -> one continuation', a.bodies.length === 2 && a.turn.continuations === 1, JSON.stringify({ n: a.bodies.length, c: a.turn && a.turn.continuations }));
    const t2 = a.bodies[1] ? a.bodies[1].messages.slice(-2) : [];
    ok('free brain: same system, the text so far, then the order\'s message', !!a.bodies[1] && a.bodies[1].system === a.bodies[0].system
      && t2.length === 2 && t2[0].role === 'assistant' && String(t2[0].content).includes('الجمع للمسافر') && t2[1].content === CONTINUE);
    ok('free brain: joined, and not truncated', a.turn.truncated === false && String(a.turn.text).includes('جائز عند الحاجة') && String(a.turn.text).includes('بجد السير'), ascii(a.turn.text));
    const b = await drive(() => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: T1 }] }));
    ok('free brain: four max_tokens -> three continuations, still truncated (the mark follows in api/ask.js)', b.bodies.length === 4 && b.turn.continuations === 3 && b.turn.truncated === true,
      JSON.stringify({ n: b.bodies.length, c: b.turn && b.turn.continuations, t: b.turn && b.turn.truncated }));
  }

  console.log('-- 4. the legacy stream');
  if (C && typeof C.createContinuationRelay === 'function') {
    const SSE = await esm('lib/finalized-sse-writer.js');
    const ASK = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    const mark = (ASK.match(/const TRUNCATED_MARK = '([^']+)';/) || [])[1] || '';
    const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, headersSent: false,
      write(c) { this.headersSent = true; this.writes.push(String(c)); return true; }, end() { this.ended += 1; return this; },
      status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; }, flushHeaders() { this.headersSent = true; },
      once() { return this; }, on() { return this; }, removeListener() { return this; } });
    const ev = (e) => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n';
    const upstream = (text, stop) => [
      ev({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', content: [], model: 'x', stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } }),
      ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(0, 10) } }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(10) } }),
      ev({ type: 'content_block_stop', index: 0 }),
      ev({ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 9 } }),
      ev({ type: 'message_stop' }),
    ].join('');
    const legacy = async (script) => {
      const t = target();
      const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const stops = [];
      let n = 0;
      const relay = C.createContinuationRelay({
        write: (s) => facade.write(s), mark: mark.replace(/^\n/, ''), startedAt: Date.now(),
        continueWith: async (tail, push) => { const s = script(n++); push(s.text); return { stop: s.stop }; },
        onStop: (stop, continued) => stops.push([stop, continued]),
      });
      const bytes = Buffer.from(upstream('الحج ركن من أركان الإسلام الخمسة، ', 'max_tokens'), 'utf8');
      await relay.push(bytes.subarray(0, 37)); await relay.push(bytes.subarray(37));
      await relay.end();
      facade.end();
      const text = t.writes.join('').split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } })
        .filter((f) => f && f.type === 'content_block_delta').map((f) => f.delta.text).join('');
      return { text, stops, calls: n, ended: t.ended };
    };
    const a = await legacy(() => ({ text: 'فرضه الله على المستطيع مرة في العمر.', stop: 'end_turn' }));
    ok('legacy: max_tokens -> continued once, joined in the same block, no mark, through the real sealed writer',
      a.calls === 1 && a.text.includes('ركن من أركان') && a.text.includes('على المستطيع') && !a.text.includes(MARK) && a.ended === 1, ascii(JSON.stringify(a)));
    ok('legacy: the record is told end_turn after one continuation', JSON.stringify(a.stops) === JSON.stringify([['end_turn', 1]]));
    const b = await legacy(() => ({ text: ' جزء', stop: 'max_tokens' }));
    ok('legacy: still cut after three -> the mark is the block\'s last text, and the record is told', b.calls === 3 && b.text.endsWith(MARK) && JSON.stringify(b.stops) === JSON.stringify([['max_tokens', 3]]), ascii(JSON.stringify(b)));
  } else ok('legacy relay exists', false);

  console.log('-- 5. the wiring');
  const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  ok('both legacy streams relay through createContinuationRelay', (ask.match(/createContinuationRelay\(\{/g) || []).length === 2);
  ok('...with the mark, and the stop and the count to the record', (ask.match(/onStop: \(stop, continued\) => answerLog\.note\(\{ stop_reason: stop, continued, truncated: stop === 'max_tokens' \}\)/g) || []).length === 2);
  ok('the free brain\'s and before writing\'s counts reach the record', /continued: out\.continuations/.test(ask) && /continued: t\.continuations/.test(ask));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-o2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
