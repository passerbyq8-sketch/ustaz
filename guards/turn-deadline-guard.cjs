// guards/turn-deadline-guard.cjs -- brain35 O-3 (2026-11-06; DIAG WEAK-CONNECTION): A TURN ENDS BEFORE THE PLATFORM CUTS IT.
//
// MEASURED: the only bound on a whole turn was the function's own maxDuration (300 s, vercel.json). A slow tool phase
// followed by a slow writing round reached it, the socket was cut mid-answer, and the reader -- who had read most of the
// answer -- was shown the weak-connection line and «كمّل» instead of the answer the turn had already built.
//
// WHAT THIS PINS, offline, no network, no model (a fake provider and fake tools):
//   1. the deadline is four minutes, a constant of the loop, overridable by TURN_DEADLINE_MS for a test;
//   2. a turn whose tool phase runs past the deadline leaves the round loop at the next boundary, makes NO further
//      provider call, and is marked truncated -- so api/ask.js appends the bare «<incomplete/>» mark;
//   3. ...and it says why in its own record: deadline_turn:<ms> and deadline_turn_no_write;
//   4. a turn inside the deadline is untouched: it writes, and it is not marked truncated;
//   5. api/ask.js hands the deadline down from the request's own start, and the mark it appends is the bare one;
//   6. one mutant -- the deadline test removed -- killed.
//
// Usage: node guards/turn-deadline-guard.cjs
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
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 400) : ''));
  return false;
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?td=' + Date.now());

// A provider that answers one tool round slowly, then would write. Every call is counted, so a call made after the
// deadline is visible as a count, not as a guess.
function fakeProvider({ slowMs, calls }) {
  return async (url, init) => {
    const body = JSON.parse(String(init && init.body) || '{}');
    calls.push({ at: Date.now(), tools: Array.isArray(body.tools) ? body.tools.length : 0, stream: body.stream === true });
    if (slowMs) await new Promise((r) => setTimeout(r, slowMs));
    // a tool call on the first round, prose afterwards
    const asked = JSON.stringify(body.messages || '').includes('tool_result');
    if (!asked) {
      return {
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          id: 'msg', type: 'message', role: 'assistant', model: 'fake', stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'tu-1', name: 'search_fatawa', input: { query: 'المسح على الخفين' } }],
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
        text: async () => '',
      };
    }
    return {
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'msg2', type: 'message', role: 'assistant', model: 'fake', stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'المسح على الخفين جائز بشرطه.' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
      text: async () => '',
    };
  };
}

// callProvider calls the global fetch directly (fetchImpl is the TOOLS' transport), so the provider is stubbed there.
async function runTurn(LOOP_OR_MOD, opts, calls) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeProvider({ slowMs: 0, calls });
  try { return await LOOP_OR_MOD.runFreeBrainTurn(opts); } finally { globalThis.fetch = realFetch; }
}

(async () => {
  console.log('=== turn-deadline-guard -- brain35 O-3: the turn stops at its own deadline, with an answer ===');
  const LOOP = await esm('lib/free-brain/loop.js');

  // 1. the constant and its override
  ok('1a the deadline is four minutes, a constant of the loop', LOOP.TURN_DEADLINE_MS === 240000);
  ok('1b TURN_DEADLINE_MS overrides it for a test, and a junk value does not',
    LOOP.turnDeadlineMs({ TURN_DEADLINE_MS: '3000' }) === 3000 && LOOP.turnDeadlineMs({ TURN_DEADLINE_MS: 'soon' }) === 240000
    && LOOP.turnDeadlineMs({}) === 240000);

  // 2+3. a turn whose clock is already past the deadline makes no provider call at all
  {
    const calls = [];
    const out = await runTurn(LOOP, {
      messages: [{ role: 'user', content: 'ما حكم المسح على الخفين؟' }],
      system: 'SYSTEM', model: 'fake-model', maxTokens: 1024, band: 'adult', mode: 'brief',
      providerUrl: 'https://provider.invalid/v1/messages', headers: {},
      // the turn began five minutes ago: its deadline passed before this call
      turnDeadlineMs: 3000, turnStartedAt: Date.now() - 300000,
    }, calls);
    ok('2a a turn already past its deadline makes NO provider call', calls.length === 0, JSON.stringify(calls));
    ok('2b ...and it is marked cut, so api/ask.js appends the mark', out && out.truncated === true, JSON.stringify({ truncated: out && out.truncated }));
    const degraded = (out && out.degraded) || [];
    ok('3a ...and it says why, with the elapsed time and the write it did not make',
      degraded.some((d) => /^deadline_turn:\d+ms$/u.test(String(d))) && degraded.includes('deadline_turn_no_write'),
      JSON.stringify(degraded));
    ok('3b the turn still returns an answer shape the caller can deliver (text, degraded, no crash)',
      !!out && typeof out.text === 'string' && Array.isArray(out.degraded), JSON.stringify(Object.keys(out || {})));
  }

  // 4. a turn inside the deadline is untouched
  {
    const calls = [];
    const out = await runTurn(LOOP, {
      messages: [{ role: 'user', content: 'ما حكم المسح على الخفين؟' }],
      system: 'SYSTEM', model: 'fake-model', maxTokens: 1024, band: 'adult', mode: 'brief',
      providerUrl: 'https://provider.invalid/v1/messages', headers: {},
      turnDeadlineMs: 240000, turnStartedAt: Date.now(),
    }, calls);
    ok('4a a turn inside its deadline calls the provider and is not marked cut by the deadline',
      calls.length >= 1 && out && out.truncated !== true
      && !((out.degraded || []).some((d) => String(d).startsWith('deadline_turn'))),
      JSON.stringify({ calls: calls.length, truncated: out && out.truncated, degraded: out && out.degraded }));
  }

  // 5. the handler's half
  {
    const ask = read('api/ask.js');
    ok('5a api/ask.js hands the deadline down, measured from the request\'s own start',
      ask.includes('turnDeadlineMs: turnDeadlineMs(process.env),') && ask.includes('turnStartedAt: requestStartedAt,')
      && /turnDeadlineMs, \/\/ ITEM O-3/u.test(ask));
    ok('5b the mark it appends for a cut answer is the bare one, on its own line',
      ask.includes("const TRUNCATED_MARK = '\\n<incomplete/>';")
      && ask.includes("readerText + (out.truncated === true ? TRUNCATED_MARK : '')"));
    ok('5c and the platform\'s own limit is still above it (300 s in vercel.json, 240 s here)',
      JSON.parse(read('vercel.json')).functions['api/ask.js'].maxDuration === 300 && LOOP.TURN_DEADLINE_MS < 300000);
  }

  // 6. the mutant
  {
    const src = read('lib/free-brain/loop.js');
    const seam = "    if (turnDeadlineReached()) {";
    ok('6a MUTANT seam present (the deadline test is one line)', src.split(seam).length === 2);
    const mutated = src.replace(seam, "    if (false) { // mutant: the turn's deadline is never read");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-td-'));
    try {
      const file = path.join(tmp, 'loop.mjs');
      fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib', 'free-brain', spec)).href + q), 'utf8');
      const M = await import(pathToFileURL(file).href + '?t=' + Date.now());
      const calls = [];
      const out = await runTurn(M, {
        messages: [{ role: 'user', content: 'ما حكم المسح على الخفين؟' }],
        system: 'SYSTEM', model: 'fake-model', maxTokens: 1024, band: 'adult', mode: 'brief',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {},
        turnDeadlineMs: 3000, turnStartedAt: Date.now() - 300000,
      }, calls);
      ok('6b MUTANT KILLED: without the test a turn five minutes past its deadline still calls the provider',
        calls.length >= 1 && !(out && out.truncated === true), JSON.stringify({ calls: calls.length, truncated: out && out.truncated }));
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ } }
  }

  console.log('\n=== turn-deadline: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
