#!/usr/bin/env node
/**
 * P6-V3 §٣ — THE SAME TURN, BOTH FLAGS, FIFTEEN PAIRS.
 *
 * THIS IS THE WITNESS THAT WAS MISSING IN V2. The two proofs that reported «2 provider calls
 * either way» were counting two DIFFERENT fixtures, and neither ran one turn with both flags.
 * This does: for each question and each repeat, `runFreeBrainTurn` is called twice against the
 * real provider with the real system prompt, once with STREAM_V1 off and once with it on, and
 * every number below is the difference between those two runs of the SAME turn.
 *
 * WHAT IS MEASURED
 *   provider calls        `out.modelCalls`
 *   input / output tokens summed over the turn's own round ledger
 *   completion            wall clock around `runFreeBrainTurn`
 *   first reader byte     the moment `onWriteUnit` ACCEPTS a unit. With the flag off nothing is
 *                         released early, so the reader's first byte is the completion — which is
 *                         exactly the comparison the phase is asking about.
 *
 * ORDER IS ALTERNATED. Nine pairs run off-then-on and six run on-then-off, so the prompt cache
 * cannot hand one arm a warm prefix and the other a cold one and be mistaken for the change.
 *
 * THREE THINGS THIS DOES NOT CLAIM
 *   1  The two arms do not produce the same text. They are two generations, so the comparison is
 *      «what did the turn cost», never «the same bytes arrived sooner».
 *   2  MODEL_STANDARD is Haiku in production and whatever `.env.local` names here. The STRUCTURE
 *      (call count, token counts) carries; the milliseconds are this model's milliseconds.
 *   3  First byte is loop time, not network time. The SSE layer and the client are below this
 *      measurement and are identical in both arms.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');

function readEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const at = line.indexOf('=');
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    if (!key || key.startsWith('#')) continue;
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

const sortNum = (values) => [...values].sort((a, b) => a - b);
const median = (values) => {
  const s = sortNum(values.filter(Number.isFinite));
  if (!s.length) return null;
  const middle = Math.floor(s.length / 2);
  return s.length % 2 ? s[middle] : Math.round((s[middle - 1] + s[middle]) / 2);
};
const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);

/** Three fiqh questions, five repeats each. The scope must be fiqh or the tool phase never runs. */
const QUESTIONS = [
  { id: 'wudu', text: 'ما حكم مسح الرأس في الوضوء، وهل يجزئ بعضه؟' },
  { id: 'zakat', text: 'هل تجب الزكاة في مال الطفل الصغير؟' },
  { id: 'safar', text: 'متى يجوز للمسافر الجمع بين الصلاتين؟' },
];
const REPEATS = 5;

function tokensOf(out) {
  const ledger = Array.isArray(out.roundLedger) ? out.roundLedger : [];
  return {
    inTokens: sum(ledger.map((row) => row.inTokens)),
    outTokens: sum(ledger.map((row) => row.outTokens)),
    cacheReadTokens: sum(ledger.map((row) => row.cacheReadTokens)),
    cacheWriteTokens: sum(ledger.map((row) => row.cacheWriteTokens)),
  };
}

async function runArm({ runFreeBrainTurn, system, question, model, maxTokens, streamOn, apiKey }) {
  const startedAt = Date.now();
  let firstReaderByteMs = null;
  const out = await runFreeBrainTurn({
    messages: [{ role: 'user', content: question }],
    system,
    model,
    maxTokens,
    usePremium: false,
    effort: '',
    band: 'adult',
    mode: 'standard',
    lexicalRoute: 'DEEN',
    providerUrl: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: undefined,
    dailyBudget: null,
    env: { ...process.env, STREAM_V1: streamOn ? 'on' : 'off' },
    onWriteUnit: () => {
      if (firstReaderByteMs === null) firstReaderByteMs = Date.now() - startedAt;
      return true;
    },
  });
  const completionMs = Date.now() - startedAt;
  return {
    completionMs,
    // Nothing is released early with the flag off, so the reader's first byte IS the completion.
    firstByteMs: firstReaderByteMs === null ? completionMs : firstReaderByteMs,
    releasedEarly: firstReaderByteMs !== null,
    modelCalls: out.modelCalls,
    rounds: out.rounds,
    chars: String(out.text || '').length,
    streamedThisTurn: out.streamedThisTurn === true,
    streamRoundEligible: out.streamRoundEligible === true,
    readerOwnsHead: out.readerOwnsHead === true,
    streamPrefixValid: out.streamPrefixValid !== false,
    ...tokensOf(out),
  };
}

async function main() {
  const outPath = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || '';
  const env = readEnvLocal();
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is absent');
  const model = process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5';

  const loop = await import(pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'loop.js')).href);
  const { buildSystemPrompt } = await import(pathToFileURL(path.join(ROOT, 'lib', 'system-prompt.js')).href);
  const { buildFreeBrainInstruction } = await import(
    pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'instructions.js')).href,
  );

  // The REAL prompt, built the way api/ask.js builds it: the static prefix carries the cache
  // marker and the per-request instruction is a separate uncached block behind it.
  const base = buildSystemPrompt('مقياس', 30, '', 'standard');
  const system = [
    { type: 'text', text: base, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildFreeBrainInstruction({ band: 'adult' }) },
  ];
  const maxTokens = loop.outputBudget(512);
  process.stdout.write(`MODEL=${model} SYSTEM_CHARS=${base.length} MAX_TOKENS=${maxTokens}\n`);

  const pairs = [];
  for (let repeat = 1; repeat <= REPEATS; repeat += 1) {
    for (const question of QUESTIONS) pairs.push({ ...question, repeat });
  }
  // `--pairs N` runs a short smoke of the SAME harness before the full fifteen are spent.
  const limitArg = process.argv.find((arg) => arg.startsWith("--pairs="));
  const limit = limitArg ? Number(limitArg.slice(8)) : pairs.length;
  const rows = [];
  for (let index = 0; index < Math.min(limit, pairs.length); index += 1) {
    const pair = pairs[index];
    // Nine off-first, six on-first.
    const offFirst = index < 9;
    const shared = {
      runFreeBrainTurn: loop.runFreeBrainTurn, system, question: pair.text, model, maxTokens, apiKey,
    };
    /* eslint-disable no-await-in-loop */
    const first = await runArm({ ...shared, streamOn: !offFirst });
    const second = await runArm({ ...shared, streamOn: offFirst });
    /* eslint-enable no-await-in-loop */
    const off = offFirst ? first : second;
    const on = offFirst ? second : first;
    rows.push({ ...pair, order: offFirst ? 'off-first' : 'on-first', off, on });
    process.stdout.write(
      `PAIR ${String(index + 1).padStart(2)} ${pair.id}/${pair.repeat} ${offFirst ? 'off-first' : 'on-first'}`
      + `  calls ${off.modelCalls}->${on.modelCalls}`
      + `  complete ${off.completionMs}->${on.completionMs}`
      + `  first ${off.firstByteMs}->${on.firstByteMs}`
      + `  streamed=${on.streamedThisTurn ? 'Y' : 'N'} eligible=${on.streamRoundEligible ? 'Y' : 'N'}\n`,
    );
  }

  const offs = rows.map((row) => row.off);
  const ons = rows.map((row) => row.on);
  const table = (key) => ({ off: median(offs.map((r) => r[key])), on: median(ons.map((r) => r[key])) });
  const totals = (key) => ({ off: sum(offs.map((r) => r[key])), on: sum(ons.map((r) => r[key])) });

  const calls = table('modelCalls');
  const complete = table('completionMs');
  const firstByte = table('firstByteMs');
  const inTok = totals('inTokens');
  const outTok = totals('outTokens');
  const cacheRead = totals('cacheReadTokens');

  const fasterOn = rows.filter((row) => row.on.completionMs < row.off.completionMs).length;
  const earlierOn = rows.filter((row) => row.on.firstByteMs < row.off.firstByteMs).length;
  const callsEqual = rows.filter((row) => row.on.modelCalls === row.off.modelCalls).length;
  const eligible = ons.filter((row) => row.streamRoundEligible).length;
  const streamed = ons.filter((row) => row.streamedThisTurn).length;
  const eligibleButSilent = ons.filter((row) => row.streamRoundEligible && !row.streamedThisTurn).length;
  const prefixViolations = ons.filter((row) => !row.streamPrefixValid).length;

  const line = (name, pair, unit = '') => process.stdout.write(
    `${name.padEnd(26)} off=${pair.off}${unit}  on=${pair.on}${unit}  `
    + `diff=${pair.on - pair.off >= 0 ? '+' : ''}${pair.on - pair.off}${unit}`
    + `${pair.off ? `  x${(pair.on / pair.off).toFixed(2)}` : ''}\n`,
  );

  process.stdout.write(`\nSAMPLE=${rows.length} pairs (${QUESTIONS.length} questions x ${REPEATS} repeats)\n`);
  line('PROVIDER_CALLS_MEDIAN', calls);
  line('TOTAL_INPUT_TOKENS', inTok);
  line('TOTAL_OUTPUT_TOKENS', outTok);
  line('COMPLETION_MS_MEDIAN', complete, 'ms');
  line('FIRST_READER_BYTE_MS_MED', firstByte, 'ms');
  line('TOTAL_CACHE_READ_TOKENS', cacheRead);
  process.stdout.write(
    `RAW_CALLS off=[${Math.min(...offs.map((r) => r.modelCalls))}..${Math.max(...offs.map((r) => r.modelCalls))}] `
    + `on=[${Math.min(...ons.map((r) => r.modelCalls))}..${Math.max(...ons.map((r) => r.modelCalls))}]\n`,
  );
  process.stdout.write(
    `RAW_COMPLETION off=[${Math.min(...offs.map((r) => r.completionMs))}..${Math.max(...offs.map((r) => r.completionMs))}] `
    + `on=[${Math.min(...ons.map((r) => r.completionMs))}..${Math.max(...ons.map((r) => r.completionMs))}]\n`,
  );
  process.stdout.write(`PAIRS_WITH_EQUAL_CALLS=${callsEqual}/${rows.length}\n`);
  process.stdout.write(`PAIRS_COMPLETED_FASTER_ON=${fasterOn}/${rows.length}\n`);
  process.stdout.write(`PAIRS_FIRST_BYTE_EARLIER_ON=${earlierOn}/${rows.length}\n`);
  process.stdout.write(`ELIGIBLE=${eligible}/${rows.length} STREAMED=${streamed}/${rows.length} `
    + `ELIGIBLE_BUT_SILENT=${eligibleButSilent}\n`);
  process.stdout.write(`EMITTED_NOT_A_PREFIX=${prefixViolations}\n`);

  // THE ACCEPTANCE CONDITION, STATED AS THE DIRECTIVE STATES IT.
  const passCalls = callsEqual === rows.length;
  const passCompletion = complete.on <= complete.off;
  const passFirstByte = firstByte.on < firstByte.off;
  process.stdout.write(
    `\nACCEPT_CALLS_EQUAL=${passCalls ? 'PASS' : 'FAIL'} `
    + `ACCEPT_COMPLETION_NOT_WORSE=${passCompletion ? 'PASS' : 'FAIL'} `
    + `ACCEPT_FIRST_BYTE_LOWER=${passFirstByte ? 'PASS' : 'FAIL'}\n`,
  );
  process.stdout.write(
    `PHASE_VERDICT=${passCalls && passCompletion && passFirstByte ? 'PASS' : 'FAIL'}\n`,
  );

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify({ model, systemChars: base.length, rows }, null, 2), 'utf8');
    process.stdout.write(`EVIDENCE=${outPath}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`TURN-PAIR-MEASURE: ERROR ${(error && error.stack) || error}\n`);
  process.exit(1);
});
