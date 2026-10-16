// guards/brain-line-o3a-guard.cjs -- ITEM O3a (132) -- 2026-10-15 brain-line
//
// THE STATUS, THE SILENCE TIMER AND THE COUNTERS. Measured on 7ba44481 (side-brain-line-2026-10-15/items/132.md): only
// before writing sent `ezik_status`; every other path was silent until its first word.
//
// What this guard holds (the order, O3a):
//   (1) a fake clock: `working` frames at 5 s and 10 s (with ms), and none after the first text;
//   (2) a path that names no stage still sends one status before its first text; a JSON reply gets no frame;
//   (3) every engine names its stages: the free brain (retrieve on a tool round, write, continue), before writing
//       (continue after text, the only stage allowed there), the legacy routes (retrieve, write, and continue from
//       their relays), all through the one status installed on the answer's response in api/ask.js;
//   (4) the counters (first byte, the longest gap, the sentence stream's) reach the answer's record (O1).
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
const sseRes = (type = 'text/event-stream') => ({ writes: [], headers: { 'content-type': type },
  getHeader(k) { return this.headers[String(k).toLowerCase()]; }, write(c) { this.writes.push(String(c)); return true; }, end() { this.ended = true; } });
const frames = (res) => res.writes.join('').split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => JSON.parse(f.slice(6)));
const text = (t) => 'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n';

(async () => {
  let ST = null;
  try { ST = await esm('lib/answer-status.js'); } catch { ST = null; }
  console.log('-- 1. the silence timer, on a fake clock');
  ok('lib/answer-status.js: 5 s, and the order\'s stages', !!ST && ST.SILENCE_STATUS_MS === 5000
    && ['retrieve', 'judge', 'write', 'continue', 'translate', 'working'].every((s) => ST.ANSWER_STAGES.includes(s)));
  if (ST) {
    let t = 0; let tick = null;
    const res = sseRes();
    ST.installAnswerStatus(res, { now: () => t, setTimer: (fn) => { tick = fn; return 1; }, clearTimer: () => { tick = null; } });
    t = 5000; tick && tick();
    t = 10000; tick && tick();
    const before = frames(res);
    ok('working at 5 s and at 10 s, each with its ms', before.length === 2 && before.every((f) => f.type === 'ezik_status' && f.stage === 'working') && before[0].ms === 5000 && before[1].ms === 10000, JSON.stringify(before));
    res.write(text('أوّل كلمة'));
    t = 15000; tick && tick();
    const after = frames(res);
    ok('...and nothing after the first text (the timer is cancelled)', after.length === 3 && after[2].type === 'content_block_delta' && tick === null, JSON.stringify(after.map((f) => f.type + ':' + (f.stage || ''))));

    console.log('-- 2. one status before the text, on a path that names none; none on a JSON reply');
    const quiet = sseRes();
    ST.installAnswerStatus(quiet, { setTimer: () => 1, clearTimer: () => {} });
    quiet.write(text('جواب'));
    const qf = frames(quiet);
    ok('a write status goes out just before the first text', qf.length === 2 && qf[0].type === 'ezik_status' && qf[0].stage === 'write' && qf[1].type === 'content_block_delta', JSON.stringify(qf));
    const named = sseRes();
    const api = ST.installAnswerStatus(named, { setTimer: () => 1, clearTimer: () => {} });
    api.status('retrieve');
    named.write(text('جواب'));
    ok('...not when the path named its own stage', JSON.stringify(frames(named).map((f) => f.stage || f.type)) === JSON.stringify(['retrieve', 'content_block_delta']));
    ok('after the text only continue is sent', api.status('write') === false && api.status('continue') === true);
    let jt = 0; let jtick = null;
    const json = sseRes('application/json');
    ST.installAnswerStatus(json, { now: () => jt, setTimer: (fn) => { jtick = fn; return 1; }, clearTimer: () => {} });
    jt = 5000; jtick && jtick();
    ok('a JSON reply never receives a frame', json.writes.length === 0);
  }

  console.log('-- 3. every engine names its stages');
  {
    const loop = await esm('lib/free-brain/loop.js');
    const realFetch = globalThis.fetch;
    const stages = [];
    let n = 0;
    globalThis.fetch = async (input) => {
      const step = n++ === 0
        ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_fatawa', input: { query: 'الجمع للمسافر' } }] }
        : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'الجمع للمسافر جائز عند الحاجة.' }] };
      if (!String(input?.url || input).startsWith('https://stub.invalid/')) throw new Error('offline');
      return { ok: true, status: 200, json: async () => step };
    };
    try {
      await loop.runFreeBrainTurn({ messages: [{ role: 'user', content: 'ما حكم الجمع للمسافر؟' }], system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
        mode: 'عادي', lexicalRoute: 'DEEN', providerUrl: 'https://stub.invalid/v1/messages', headers: {}, onStage: (s) => stages.push(s) });
    } catch { /* the stages are what is measured */ } finally { globalThis.fetch = realFetch; }
    ok('the free brain: retrieve on its tool round, then write', stages[0] === 'retrieve' && stages.includes('write') && stages.indexOf('write') > 0, JSON.stringify(stages));
  }
  const BW2 = await esm('lib/before-writing-v2.js');
  ok('before writing: continue is a stage, the only one its wire sends after text', BW2.BW2_STAGES.includes('continue'));
  {
    const res = { writes: [], write(c) { this.writes.push(String(c)); return true; }, armEarlyRelease() { return true; } };
    const wire = BW2.createBw2Wire(res);
    wire.delta('نص');
    ok('...the wire refuses write after text and sends continue', wire.status('write') === false && wire.status('continue') === true);
  }
  const bwSrc = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
  ok('...and its continuation announces itself', /onStart: \(\) => wire\.status\('continue'\)/.test(bwSrc));
  const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  ok('api/ask.js installs the status on the answer\'s response, first thing', /return withAnswerLog\(req, res, async \(\) => \{\n {2}\/\/ ITEM O3a[^\n]*\n(?: {2}\/\/[^\n]*\n)* {2}const answerStatus = installAnswerStatus\(res\);/.test(ask));
  ok('the free brain is handed it', /onStage: \(stage\) => answerStatus\.status\(stage\)/.test(ask));
  ok('the legacy DEEN route: retrieve before its search, write before round 2', /answerStatus\.status\('retrieve'\);\n\s+\/\/ ── ROUND 1 \(DEEN\)/.test(ask) && /answerStatus\.status\('write'\);\n\s+\/\/ ── ROUND 2: streamed/.test(ask));
  ok('the legacy GEN route: write before its stream', /answerStatus\.status\('write'\);\n\s+const genRequest = \{/.test(ask));
  ok('both legacy relays announce a continuation', (ask.match(/onStart: \(\) => answerStatus\.status\('continue'\)/g) || []).length === 2);

  console.log('-- 4. the counters reach the record');
  const AL = fs.readFileSync(path.join(REPO, 'lib/answer-log.js'), 'utf8');
  ok('first_byte_ms, max_gap_ms and status_events are measured on the stream; the sentence stream\'s counters are noted',
    /first_byte_ms/.test(AL) && /max_gap_ms/.test(AL) && /status_events/.test(AL) && /held: out\.streamCounts \|\| \{\}/.test(ask));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-o3a: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
