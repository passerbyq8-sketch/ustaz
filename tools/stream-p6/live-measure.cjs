#!/usr/bin/env node
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

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const p90 = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.9) - 1] : null;
};

function fakeSocket() {
  const chunks = [];
  return {
    chunks,
    headersSent: true,
    setHeader() {},
    write(chunk) { chunks.push(String(chunk)); return true; },
    end(...args) {
      const callback = args.find((arg) => typeof arg === 'function');
      callback?.();
      return this;
    },
    on() {}, once() {}, removeListener() {},
    get text() {
      return chunks.join('').split(/\r?\n/u).flatMap((line) => {
        if (!line.startsWith('data:')) return [];
        try { return [JSON.parse(line.slice(5).trim())]; } catch { return []; }
      }).filter((event) => event?.type === 'content_block_delta'
        && event.delta?.type === 'text_delta')
        .map((event) => String(event.delta.text || '')).join('');
    },
  };
}

function frame(response, event) {
  return response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function makeWriter(createFinalizedSseResponse, startedAt) {
  const socket = fakeSocket();
  let firstWireMs = null;
  const rejects = [];
  const response = createFinalizedSseResponse(socket, {
    finalize: ({ text }) => ({ ok: true, text }),
    context: () => ({
      fallbackText: 'safe refusal', sourceCards: [], readerPrefix: '', readerSuffix: '',
      readerCards: [], readerCardPrefix: '', allowWireOwnedCards: true,
    }),
    failureText: 'safe refusal',
    onReject: (detail) => rejects.push(detail),
    onWireWrite: () => { if (firstWireMs === null) firstWireMs = Date.now() - startedAt; },
  });
  return { response, socket, rejects, firstWire: () => firstWireMs };
}

function openMessage(response) {
  frame(response, {
    type: 'message_start',
    message: { id: 'server-finalized', type: 'message', role: 'assistant', content: [] },
  });
  frame(response, {
    type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' },
  });
}

function closeMessage(response) {
  frame(response, { type: 'content_block_stop', index: 0 });
  frame(response, { type: 'message_stop' });
  response.end();
}

async function measureOne({
  apiKey, model, system, question, callProviderStream, createTerminalUnitStream,
  createFinalizedSseResponse, maxTokens,
}) {
  const startedAt = Date.now();
  const current = makeWriter(createFinalizedSseResponse, startedAt);
  let opened = false;
  let approved = '';
  let sent = '';
  let firstTokenMs = null;
  let units = 0;
  const stream = createTerminalUnitStream({
    domain: 'mixed', mode: 'standard', degraded: [],
    onUnit: ({ piece, text }) => {
      if (!opened) {
        if (!current.response.armEarlyRelease(() => approved)) return false;
        openMessage(current.response);
        opened = true;
      }
      approved = text;
      frame(current.response, {
        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece },
      });
      sent = text;
      units += 1;
      return true;
    },
  });

  const payload = await callProviderStream({
    providerUrl: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: question }],
    },
    onText: (delta) => {
      if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
      stream.push(delta);
    },
  });
  const terminal = stream.end();
  const terminalCallMs = Date.now() - startedAt;

  if (opened) {
    if (!terminal.finalText.startsWith(sent)) throw new Error('live prefix diverged from terminal final text');
    const remainder = terminal.finalText.slice(sent.length);
    if (remainder) frame(current.response, {
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: remainder },
    });
    closeMessage(current.response);
  } else {
    openMessage(current.response);
    if (terminal.finalText) frame(current.response, {
      type: 'content_block_delta', index: 0,
      delta: { type: 'text_delta', text: terminal.finalText },
    });
    closeMessage(current.response);
  }

  // The former path receives the same approved text only after the provider has closed.
  const former = makeWriter(createFinalizedSseResponse, startedAt);
  openMessage(former.response);
  if (terminal.finalText) frame(former.response, {
    type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text: terminal.finalText },
  });
  closeMessage(former.response);

  if (current.socket.text !== terminal.finalText || former.socket.text !== terminal.finalText) {
    throw new Error('writer changed the approved text');
  }
  const emittedNotPrefix = !terminal.finalText.startsWith(terminal.acceptedPrefix)
    || terminal.violations.some((item) => item.kind === 'emitted-not-a-prefix');
  if (current.rejects.length || former.rejects.length || emittedNotPrefix) {
    const currentReasons = current.rejects.map((item) => `${item.stage}:${item.reason}`).join(',') || 'none';
    const formerReasons = former.rejects.map((item) => `${item.stage}:${item.reason}`).join(',') || 'none';
    const streamReasons = terminal.violations.map((item) => item.kind || 'unknown').join(',') || 'none';
    throw new Error(`rejected current=${currentReasons} former=${formerReasons} stream=${streamReasons}`);
  }
  return {
    firstTokenMs,
    readerBeforeMs: former.firstWire(),
    readerAfterMs: current.firstWire(),
    terminalCallMs,
    units,
    chars: terminal.finalText.length,
    inputTokens: payload?.usage?.input_tokens ?? null,
    outputTokens: payload?.usage?.output_tokens ?? null,
    cacheWriteTokens: payload?.usage?.cache_creation_input_tokens ?? null,
    cacheReadTokens: payload?.usage?.cache_read_input_tokens ?? null,
    advisoryViolations: terminal.violations
      .filter((item) => item.kind !== 'emitted-not-a-prefix').length,
  };
}

function metric(rows, key) {
  const values = rows.map((row) => row[key]).filter(Number.isFinite);
  return { median: Math.round(median(values)), p90: Math.round(p90(values)) };
}

async function main() {
  const specPath = process.argv[2];
  const outPath = process.argv[3];
  if (!specPath) throw new Error('usage: live-measure.cjs <questions.json> [out.json]');
  const env = readEnvLocal();
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is absent');
  const model = env.MODEL_STANDARD || env.MODEL || 'claude-sonnet-5';
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const loop = await import(pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'loop.js')).href);
  const { createFinalizedSseResponse } = await import(
    pathToFileURL(path.join(ROOT, 'lib', 'finalized-sse-writer.js')).href,
  );

  const rows = [];
  const maxTokens = loop.outputBudget(512);
  for (let index = 0; index < spec.questions.length; index += 1) {
    const row = await measureOne({
      apiKey, model, system: spec.system, question: spec.questions[index].text,
      callProviderStream: loop.callProviderStream,
      createTerminalUnitStream: loop.createTerminalUnitStream,
      createFinalizedSseResponse,
      maxTokens,
    });
    rows.push({ index: index + 1, ...row });
    console.log(
      `RUN=${index + 1} CALL_MS=${row.terminalCallMs} BEFORE_MS=${row.readerBeforeMs}`
      + ` AFTER_MS=${row.readerAfterMs} IN=${row.inputTokens} OUT=${row.outputTokens}`,
    );
  }

  const summary = {
    sample: rows.length,
    maxTokens,
    terminalCallMs: metric(rows, 'terminalCallMs'),
    readerBeforeMs: metric(rows, 'readerBeforeMs'),
    readerAfterMs: metric(rows, 'readerAfterMs'),
    inputTokens: metric(rows, 'inputTokens'),
    outputTokens: metric(rows, 'outputTokens'),
    cacheWriteTokens: metric(rows, 'cacheWriteTokens'),
    cacheReadTokens: metric(rows, 'cacheReadTokens'),
    totalInputTokens: rows.reduce((sum, row) => sum + (row.inputTokens || 0), 0),
    totalOutputTokens: rows.reduce((sum, row) => sum + (row.outputTokens || 0), 0),
    advisoryViolations: rows.reduce((sum, row) => sum + row.advisoryViolations, 0),
    emittedNotPrefix: 0,
  };
  console.log(`SAMPLE=${summary.sample}`);
  console.log(`MAX_TOKENS=${summary.maxTokens}`);
  console.log(`TERMINAL_CALL_MS_MEDIAN=${summary.terminalCallMs.median} P90=${summary.terminalCallMs.p90}`);
  console.log(`READER_BEFORE_MS_MEDIAN=${summary.readerBeforeMs.median} P90=${summary.readerBeforeMs.p90}`);
  console.log(`READER_AFTER_MS_MEDIAN=${summary.readerAfterMs.median} P90=${summary.readerAfterMs.p90}`);
  console.log(`INPUT_TOKENS_MEDIAN=${summary.inputTokens.median} P90=${summary.inputTokens.p90}`);
  console.log(`OUTPUT_TOKENS_MEDIAN=${summary.outputTokens.median} P90=${summary.outputTokens.p90}`);
  console.log(`TOTAL_INPUT_TOKENS=${summary.totalInputTokens} TOTAL_OUTPUT_TOKENS=${summary.totalOutputTokens}`);
  console.log(`ADVISORY_VIOLATIONS=${summary.advisoryViolations}`);
  console.log('EMITTED_NOT_PREFIX=0');
  if (outPath) fs.writeFileSync(outPath, JSON.stringify({ model, rows, summary }, null, 2), 'utf8');
}

main().catch((error) => {
  console.error(`MEASURE_ERROR=${String(error?.message || error).slice(0, 160)}`);
  process.exit(1);
});
