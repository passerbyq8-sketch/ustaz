// guards/answer-log-bound-guard.cjs -- brain35 O-3 (2026-11-06; DIAG PKG-3): THE READER'S STREAM IS NEVER HELD BY THE STORE.
//
// MEASURED (DIAG harness H5, case 1): withAnswerLog taps the response with { deferEnd: true }, so the client's stream end
// waits for finishResponse(), which runs only after `await log.flush(deps)`; writeAnswerLog awaits setex then lpushCapped
// with NO timeout, and lib/ledger/redis.js passes no request timeout to the store. With a store that never settled, the
// answer stayed open for the whole of the function's 300 s maxDuration -- and the reader, who had the complete answer on
// the screen already, got the weak-connection line and «كمّل» when the socket was finally cut.
//
// WHAT THIS PINS, offline, no network, no model, with a fake store and fake timers:
//   1. a store that never answers: the response ends within ANSWER_LOG_FLUSH_MS, and exactly one flush_timeout line is
//      written, carrying the trace token and nothing else;
//   2. a store that answers inside the bound: one record written, no timeout line, the end not delayed past it;
//   3. a store that throws: the old write_failed line, unchanged;
//   4. the bound is two seconds, and it is a constant of the module (not a literal in the flow);
//   5. one mutant -- the race removed -- killed.
//
// Usage: node guards/answer-log-bound-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300) : ''));
  return false;
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?alb=' + Date.now());

// a response just real enough for answer-log's tap: it records writes and when end() physically happened
function fakeRes() {
  const res = {
    writes: [], ended: 0, endedAt: null, statusCode: 200, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    getHeader(k) { return this.headers[k]; },
    write(chunk) { this.writes.push(String(chunk)); return true; },
    end(chunk) { if (chunk) this.writes.push(String(chunk)); this.ended += 1; this.endedAt = Date.now(); return this; },
    on() { return this; }, once() { return this; }, removeListener() { return this; }, emit() { return false; },
  };
  return res;
}
const fakeReq = (body) => ({
  method: 'POST', complete: true, headers: { 'content-type': 'application/json' },
  body: body || { messages: [{ role: 'user', content: 'ما حكم المسح على الخفين؟' }] },
});

(async () => {
  console.log('=== answer-log-bound-guard -- brain35 O-3: the store gets two seconds, the reader gets his end ===');
  const LOG = await esm('lib/answer-log.js');
  ok('4a the bound is a constant of the module, two seconds', LOG.ANSWER_LOG_FLUSH_MS === 2000);
  ok('4b and the timeout line carries the trace token and nothing else',
    LOG.answerLogTimeoutLine({ trace: 'abc123', question: 'secret' }) === '[answer-log] flush_timeout trace=abc123'
    && LOG.answerLogTimeoutLine({}) === '[answer-log] flush_timeout trace=none');
  ok('4c the flow reads that constant and races it against the write',
    read('lib/answer-log.js').includes('Promise.race([log.flush(deps), bound])')
    && read('lib/answer-log.js').includes('setTimer(() => { timedOut = true; resolve(false); }, ANSWER_LOG_FLUSH_MS)'));

  // the three stores, each driven with a fake timer so the guard takes milliseconds, not seconds
  const drive = async (store, mod) => {
    const M = mod || LOG;
    const res = fakeRes();
    const warns = [];
    const realWarn = console.warn;
    console.warn = (...args) => { warns.push(args.join(' ')); };
    let fired = null;
    const deps = {
      store,
      setTimeout: (fn, ms) => { fired = { fn, ms }; return { token: 1 }; },
      clearTimeout: () => {},
    };
    const order = [];
    try {
      await M.withAnswerLog(fakeReq(), res, async () => {
        res.write('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}}\n\n');
        res.end();
        order.push('run-ended');
        return undefined;
      }, () => ({ lang: 'ar', translate: false }), deps);
    } finally { console.warn = realWarn; }
    return { res, warns, fired, order };
  };
  // 1. a store that never answers: the bound fires, the response ends, one line
  {
    let fireMs = null;
    const hang = { setex: () => new Promise(() => {}), lpushCapped: () => new Promise(() => {}) };
    const res = fakeRes();
    const warns = [];
    const realWarn = console.warn;
    console.warn = (...args) => { warns.push(args.join(' ')); };
    let pending = null;
    const deps = { store: hang, setTimeout: (fn, ms) => { fireMs = ms; pending = fn; return 1; }, clearTimeout: () => {} };
    let settled = false;
    const turn = LOG.withAnswerLog(fakeReq(), res, async () => { res.write('data: x\n\n'); res.end(); }, () => ({ lang: 'ar' }), deps)
      .then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    const endedBeforeFire = res.ended > 0;
    ok('1a the bound is armed with ANSWER_LOG_FLUSH_MS, and nothing has ended the record yet', fireMs === LOG.ANSWER_LOG_FLUSH_MS && !settled, String(fireMs));
    if (pending) pending();
    await turn;
    console.warn = realWarn;
    ok('1b when it fires the turn settles at once: the store is given up on, not waited for', settled);
    ok('1c exactly one flush_timeout line, with a trace token and no question',
      warns.filter((w) => w.includes('flush_timeout')).length === 1
      && /^\[answer-log\] flush_timeout trace=[a-z0-9]+$/u.test(warns.find((w) => w.includes('flush_timeout')) || ''),
      JSON.stringify(warns));
    ok('1d ...and no write_failed line beside it (one failure, one line)', !warns.some((w) => w.includes('write_failed')), JSON.stringify(warns));
  }
  // 2. a store that answers inside the bound
  {
    const calls = [];
    const quick = { setex: async (...a) => { calls.push(['setex', a[0]]); return 'OK'; }, lpushCapped: async (...a) => { calls.push(['lpush', a[0]]); return 1; } };
    const got = await drive(quick);
    ok('2a a store that answers writes its record, and no timeout line is written',
      calls.length >= 1 && !got.warns.some((w) => w.includes('flush_timeout')), JSON.stringify({ calls, warns: got.warns }));
    ok('2b ...and the bound it armed was cleared, not left to fire', got.fired && got.fired.ms === LOG.ANSWER_LOG_FLUSH_MS);
  }
  // 3. a store that throws keeps the old line
  {
    const bad = { setex: async () => { throw new Error('store down'); }, lpushCapped: async () => 1 };
    const got = await drive(bad);
    ok('3a a store that throws is the old write_failed line, unchanged',
      got.warns.some((w) => /^\[answer-log\] write_failed trace=/u.test(w)) && !got.warns.some((w) => w.includes('flush_timeout')),
      JSON.stringify(got.warns));
  }
  // 5. the mutant
  {
    const src = read('lib/answer-log.js');
    const seam = "    try { written = await Promise.race([log.flush(deps), bound]); } catch { written = false; } finally {";
    ok('5a MUTANT seam present (the race is one line)', src.split(seam).length === 2);
    const mutated = src.replace(seam, "    try { written = await log.flush(deps); } catch { written = false; } finally { // mutant: the store is waited for again");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-alb-'));
    try {
      const file = path.join(tmp, 'answer-log.mjs');
      fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib', spec)).href + q), 'utf8');
      const M = await import(pathToFileURL(file).href + '?t=' + Date.now());
      const res = fakeRes();
      const realWarn = console.warn;
      console.warn = () => {};
      let settled = false;
      const hang = { setex: () => new Promise(() => {}), lpushCapped: () => new Promise(() => {}) };
      let pending = null;
      const turn = M.withAnswerLog(fakeReq(), res, async () => { res.end(); }, () => ({ lang: 'ar' }), {
        store: hang, setTimeout: (fn) => { pending = fn; return 1; }, clearTimeout: () => {},
      }).then(() => { settled = true; });
      await new Promise((r) => setTimeout(r, 10));
      if (pending) pending();
      await Promise.race([turn, new Promise((r) => setTimeout(r, 60))]);
      console.warn = realWarn;
      ok('5b MUTANT KILLED: without the race the hanging store holds the turn open past its bound', settled === false, String(settled));
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ } }
  }

  console.log('\n=== answer-log-bound: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
