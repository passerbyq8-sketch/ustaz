#!/usr/bin/env node
/**
 * P6-V3 §١ — THE TOOLS-REMOVED WRITE, WITH THE FLAG OFF, COMPARED TO `origin/main`.
 *
 * WHY THIS EXISTS. The 151-record corpus proves flag-off equivalence over turns that
 * FINISH IN THE TOOL LOOP: every record is one `end_turn` payload carrying text, so
 * `finished` is true, `needsTerminalWrite` is false, and the tools-removed write is
 * never entered. The whole fallback path was therefore outside the equivalence claim,
 * and a defect reported against `deliveredStop` on that path could be neither confirmed
 * nor refuted by the battery that was standing.
 *
 * WHAT IT DRIVES. The four ways the tool loop can end WITHOUT prose — the only four
 * ways the tools-removed write is reached:
 *
 *   E2  rounds ceiling          MAX_TOOL_ROUNDS consecutive `tool_use` payloads
 *   E3  tool-phase deadline     the wall clock crosses before a round is started
 *   E5  provider failure        a tool round's call throws
 *   E4  non-tool, no text       `end_turn` with no text block
 *
 * Each is driven twice: once where the tools-removed write returns `end_turn`, and once
 * where it returns `max_tokens`. The second sub-case is what makes the check
 * DISCRIMINATING — it is the only way `deliveredStop` and `truncated` differ between
 * «the write's state was adopted» and «the tool phase's stale state was kept».
 *
 * WHAT IS COMPARED. The working tree's loop against `origin/main`'s loop, given the
 * same provider objects, with `STREAM_V1` off:
 *
 *   deliveredStop   the raw finish state
 *   truncated       true | false | null, the field the reviewer and the footer read
 *   text            the reader's bytes, compared as BYTES
 *   modelCalls      an extra provider call is a difference even when the text matches
 *   requests        the provider request bodies, in order
 *
 * A GATE THAT CANNOT FAIL PROVES NOTHING. `--selftest` re-runs the comparison against
 * mutated copies of the working tree's loop. Each mutation is verified to have changed
 * the source before its copy is run. Two mutants must be CAUGHT; one control witness
 * must NOT be — it changes a streaming-only line, which flag-off execution never
 * reaches, so a gate that fails it is a gate failing everything.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const PROVIDER = 'https://provider.test/messages';
const BASELINE_REF = 'origin/main';

const MAX_TOOL_ROUNDS = 6;

function absoluteImports(source) {
  const base = path.dirname(LOOP);
  return source.replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/gu, (whole, quote, spec) => {
    const href = pathToFileURL(path.resolve(base, spec)).href;
    return `from ${quote}${href}${quote}`;
  });
}

async function importSource(source, label) {
  const code = absoluteImports(source);
  const href = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${label}`;
  return import(href);
}

function replaceOnce(source, find, replacement) {
  const hits = source.split(find).length - 1;
  if (hits !== 1) throw new Error(`anchor found ${hits} times, expected 1: ${find.slice(0, 60)}`);
  const out = source.replace(find, replacement);
  // VERIFY THE MUTATION LANDED. A mutant that quietly did not apply reports a false PASS.
  if (out === source) throw new Error(`mutation did not change the source: ${find.slice(0, 60)}`);
  return out;
}

function jsonPayload(text, stop = 'end_turn') {
  return {
    id: 'fallback-message', type: 'message', role: 'assistant',
    content: text == null ? [] : [{ type: 'text', text }],
    stop_reason: stop,
    usage: {
      input_tokens: 101, output_tokens: 37,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    },
  };
}

function toolPayload(id) {
  return {
    id: 'fallback-tool', type: 'message', role: 'assistant', stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id, name: 'unknown_tool', input: {} }],
    usage: {
      input_tokens: 89, output_tokens: 23,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    },
  };
}

const TERMINAL_TEXT = 'هذه جملة عربية آمنة أولى. وهذه جملة عربية آمنة ثانية.';

async function withProvider(plan, requests, action) {
  const original = global.fetch;
  const queue = plan.slice();
  global.fetch = async (input, init = {}) => {
    if (String(input) !== PROVIDER) return new Response('offline in proof', { status: 503 });
    const item = queue.shift();
    if (!item) throw new Error('provider plan exhausted');
    requests.push(JSON.parse(String(init.body || '{}')));
    if (item.delayMs) await new Promise((resolve) => setTimeout(resolve, item.delayMs));
    if (item.kind === 'error') {
      return new Response(JSON.stringify({ error: 'upstream down' }), {
        status: item.status || 500, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(item.payload), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  try { return await action(); } finally { global.fetch = original; }
}

async function quiet(action) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await action(); } finally { Object.assign(console, saved); }
}

function options() {
  return {
    messages: [{ role: 'user', content: 'اختبار بنيوي محلي.' }],
    system: 'اختبار بنيوي محلي.',
    model: 'proof-model', maxTokens: 512, usePremium: false, effort: '',
    band: 'adult', mode: 'standard', lexicalRoute: 'GEN',
    providerUrl: PROVIDER, headers: {}, signal: undefined, dailyBudget: null,
    // THE FLAG IS OFF. That is the whole claim under test.
    env: { STREAM_V1: 'off' },
  };
}

/**
 * The four exits. `phaseMs` is set through process.env because `toolPhaseMs()` is called
 * with no argument inside the turn — the option object does not reach it, and pretending
 * otherwise would make the deadline case silently take the rounds-ceiling path instead.
 */
function exits(terminalStop) {
  const terminal = { kind: 'json', payload: jsonPayload(TERMINAL_TEXT, terminalStop) };
  return [
    {
      name: `E2:rounds_exhausted/${terminalStop}`,
      plan: [
        ...Array.from({ length: MAX_TOOL_ROUNDS }, (unused, index) => (
          { kind: 'json', payload: toolPayload(`tool-${index + 1}`) }
        )),
        terminal,
      ],
    },
    {
      name: `E3:deadline_tool_phase/${terminalStop}`,
      phaseMs: '1',
      plan: [
        { kind: 'json', payload: toolPayload('tool-1'), delayMs: 12 },
        terminal,
      ],
    },
    {
      name: `E5:provider_error_tool_phase/${terminalStop}`,
      plan: [{ kind: 'error', status: 500 }, terminal],
    },
    {
      name: `E4:non_tool_no_text/${terminalStop}`,
      plan: [{ kind: 'json', payload: jsonPayload(null, 'end_turn') }, terminal],
    },
  ];
}

async function runOne(module, exit) {
  const requests = [];
  const savedPhase = process.env.FREE_BRAIN_TOOL_PHASE_MS;
  if (exit.phaseMs) process.env.FREE_BRAIN_TOOL_PHASE_MS = exit.phaseMs;
  try {
    const out = await quiet(() => withProvider(exit.plan, requests, () => (
      module.runFreeBrainTurn(options())
    )));
    return {
      deliveredStop: out.deliveredStop === undefined ? null : out.deliveredStop,
      truncated: out.truncated === undefined ? null : out.truncated,
      textHex: Buffer.from(String(out.text ?? '')).toString('hex'),
      text: String(out.text ?? ''),
      modelCalls: out.modelCalls,
      readerUnits: Array.isArray(out.readerUnits) ? out.readerUnits.length : 0,
      requests: JSON.stringify(requests),
    };
  } finally {
    if (exit.phaseMs) {
      if (savedPhase === undefined) delete process.env.FREE_BRAIN_TOOL_PHASE_MS;
      else process.env.FREE_BRAIN_TOOL_PHASE_MS = savedPhase;
    }
  }
}

const FIELDS = ['deliveredStop', 'truncated', 'textHex', 'modelCalls', 'requests'];

async function compare(live, baseline, { verbose = false } = {}) {
  const differences = [];
  let cases = 0;
  for (const terminalStop of ['end_turn', 'max_tokens']) {
    for (const exit of exits(terminalStop)) {
      cases += 1;
      const liveOut = await runOne(live, exit);
      const baseOut = await runOne(baseline, exit);
      for (const field of FIELDS) {
        if (liveOut[field] !== baseOut[field]) {
          differences.push(
            `${exit.name}  ${field}: live=${String(liveOut[field]).slice(0, 90)} `
            + `main=${String(baseOut[field]).slice(0, 90)}`,
          );
        }
      }
      // Flag off releases nothing to the reader mid-turn. Asserted, not assumed.
      if (liveOut.readerUnits !== 0) {
        differences.push(`${exit.name}  readerUnits: live released ${liveOut.readerUnits} with the flag off`);
      }
      if (verbose) {
        process.stdout.write(
          `  ${exit.name.padEnd(38)} stop=${String(liveOut.deliveredStop).padEnd(11)} `
          + `truncated=${String(liveOut.truncated).padEnd(5)} calls=${liveOut.modelCalls} `
          + `bytes=${Buffer.byteLength(liveOut.text)}\n`,
        );
      }
    }
  }
  return { cases, differences };
}

const MUTANTS = [
  {
    name: 'reguard-delivered-stop',
    claim: 'the tools-removed write adopts its own stop_reason when the flag is off',
    caught: true,
    find: '      if (writeText || !terminalWriteAdded) deliveredStop = payload.stop_reason ?? null;',
    replace: '      if (writeText && terminalWriteAdded) deliveredStop = payload.stop_reason ?? null;',
  },
  {
    name: 'drop-delivered-stop',
    claim: 'the update is present at all on the fallback path',
    caught: true,
    find: '      if (writeText || !terminalWriteAdded) deliveredStop = payload.stop_reason ?? null;',
    replace: '      if (false) deliveredStop = payload.stop_reason ?? null;',
  },
  {
    // REVERSE CONTROL. A streaming-only line, unreachable with the flag off. The gate must
    // still PASS — a gate that fails this is failing on the copy, not on the claim.
    name: 'control-stream-only-line',
    claim: 'CONTROL — a streaming-only branch does not move a flag-off byte',
    caught: false,
    find: "    ctx.degraded.push('stream_withheld:head_text');",
    replace: "    ctx.degraded.push('stream_withheld:head_text_control_witness');",
  },
];

async function main() {
  const selftest = process.argv.includes('--selftest');
  const verbose = process.argv.includes('--verbose');

  const liveSource = fs.readFileSync(LOOP, 'utf8');
  const baselineSource = execFileSync(
    'git', ['show', `${BASELINE_REF}:lib/free-brain/loop.js`],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const live = await importSource(liveSource, 'live');
  const baseline = await importSource(baselineSource, 'baseline');

  process.stdout.write(`TERMINAL-FALLBACK-PARITY  live=working-tree  baseline=${BASELINE_REF}\n`);
  const { cases, differences } = await compare(live, baseline, { verbose });
  process.stdout.write(`  cases=${cases}  differences=${differences.length}\n`);
  for (const line of differences) process.stdout.write(`  DIFF  ${line}\n`);

  let selftestFailures = 0;
  if (selftest) {
    process.stdout.write('SELFTEST\n');
    for (const mutant of MUTANTS) {
      const mutated = await importSource(
        replaceOnce(liveSource, mutant.find, mutant.replace), `mutant-${mutant.name}`,
      );
      const result = await compare(mutated, baseline);
      const wasCaught = result.differences.length > 0;
      const ok = wasCaught === mutant.caught;
      if (!ok) selftestFailures += 1;
      process.stdout.write(
        `  ${ok ? 'OK  ' : 'FAIL'}  ${mutant.name.padEnd(26)} `
        + `expected=${mutant.caught ? 'caught' : 'not-caught'} `
        + `got=${wasCaught ? `caught(${result.differences.length})` : 'not-caught'}  — ${mutant.claim}\n`,
      );
      if (!ok && wasCaught) {
        for (const line of result.differences.slice(0, 3)) process.stdout.write(`         ${line}\n`);
      }
    }
  }

  const failed = differences.length > 0 || selftestFailures > 0;
  process.stdout.write(
    `TERMINAL-FALLBACK-PARITY: ${failed ? 'FAIL' : 'PASS'} `
    + `cases=${cases} differences=${differences.length} selftest_failures=${selftestFailures}\n`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`TERMINAL-FALLBACK-PARITY: ERROR ${(error && error.stack) || error}\n`);
  process.exit(2);
});
