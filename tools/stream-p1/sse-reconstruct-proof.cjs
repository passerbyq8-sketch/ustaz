#!/usr/bin/env node
/**
 * STREAM-P2 §٢ — THE GATE ON ح‑١: THE STREAMED CALL REBUILDS THE SAME PAYLOAD.
 *
 * `callProviderStream` claims that the object it assembles from the provider's
 * event stream is the object `callProvider` would have returned. Everything
 * downstream — textOf, ledgerRow, deliveredStop — reads that object, so if the
 * claim is wrong the loop is wrong in ways no reader-facing test would name.
 *
 * The claim is checked here without a network: a recorded non-streaming payload is
 * TAKEN APART into the event sequence the provider would have sent for it, that
 * sequence is fed to the real `callProviderStream` through a stub `fetch`, and the
 * rebuilt object is compared to the original with a deep byte comparison of its
 * JSON. The cases cover the shapes this loop actually sees: prose, prose plus a
 * tool call, thinking, a tool call with empty arguments, and every stop_reason the
 * loop branches on.
 *
 * The stream is also delivered in adversarial chunkings — one byte at a time, and
 * split mid-frame — because an SSE reader that only works when frames arrive whole
 * is a reader that works until it doesn't.
 *
 * `--selftest` breaks the reader on purpose and demands each break is caught.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const LIB = path.join(__dirname, '..', '..', 'lib');
const SRC = path.join(LIB, 'free-brain', 'loop.js');

const MUTANTS = [
  {
    name: 'drop-partial-frame-buffering',
    claim: 'a frame split across two chunks is not parsed half-read',
    find: "    let cut = buffer.indexOf('\\n\\n');",
    replace: "    let cut = buffer.length ? buffer.length : -1;",
  },
  {
    name: 'lose-tool-input',
    claim: 'a tool call\'s streamed arguments are reassembled into .input',
    find: '          else {\n            try { block.input = JSON.parse(raw); } catch { block.input = block.input ?? {}; }\n          }',
    replace: '          else { block.input = block.input ?? {}; }',
  },
  {
    name: 'drop-message-delta',
    claim: 'stop_reason and the output token count arrive on message_delta',
    find: "      case 'message_delta':",
    replace: "      case 'message_delta_disabled':",
  },
  {
    name: 'text-delta-not-accumulated',
    claim: 'text deltas concatenate rather than replace',
    find: "          block.text = String(block.text || '') + String(delta.text || '');",
    replace: "          block.text = String(delta.text || '');",
  },
];

/** Take a finished payload apart into the events the provider would have sent. */
function toEvents(payload) {
  const events = [];
  const usage = payload.usage || {};
  events.push({
    type: 'message_start',
    message: {
      id: payload.id,
      type: payload.type,
      role: payload.role,
      model: payload.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: usage.input_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        output_tokens: 0,
      },
    },
  });

  (payload.content || []).forEach((block, index) => {
    if (block.type === 'text') {
      events.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      // Split the text into several deltas, the way a real stream would.
      for (const piece of String(block.text).match(/[\s\S]{1,7}/gu) || []) {
        events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } });
      }
    } else if (block.type === 'thinking') {
      events.push({ type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '' } });
      for (const piece of String(block.thinking).match(/[\s\S]{1,7}/gu) || []) {
        events.push({ type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: piece } });
      }
      if (block.signature) {
        events.push({ type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: block.signature } });
      }
    } else if (block.type === 'tool_use') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
      });
      const json = JSON.stringify(block.input || {});
      // An empty argument object arrives as NO deltas at all — the provider sends
      // `{}` as nothing, not as the two characters.
      if (json !== '{}') {
        for (const piece of json.match(/[\s\S]{1,5}/gu) || []) {
          events.push({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: piece } });
        }
      }
    }
    events.push({ type: 'content_block_stop', index });
  });

  events.push({
    type: 'message_delta',
    delta: { stop_reason: payload.stop_reason, stop_sequence: payload.stop_sequence ?? null },
    usage: { output_tokens: usage.output_tokens },
  });
  events.push({ type: 'message_stop' });
  return events;
}

function toWire(events) {
  let wire = '';
  for (const event of events) {
    wire += `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    if (event.type === 'message_start') wire += ': ping\n\n'; // keepalive comment
  }
  return wire;
}

/** A `fetch` that replays the wire in the given chunk sizes. */
function stubFetch(wire, chunker) {
  const bytes = Buffer.from(wire, 'utf8');
  const chunks = chunker(bytes);
  return async () => ({
    ok: true,
    body: {
      getReader() {
        let i = 0;
        return {
          async read() {
            if (i >= chunks.length) return { done: true, value: undefined };
            const value = chunks[i];
            i += 1;
            return { done: false, value };
          },
        };
      },
    },
  });
}

const CHUNKERS = {
  whole: (b) => [b],
  byte: (b) => Array.from(b, (x) => Buffer.from([x])),
  size13: (b) => { const out = []; for (let i = 0; i < b.length; i += 13) out.push(b.subarray(i, i + 13)); return out; },
  size64: (b) => { const out = []; for (let i = 0; i < b.length; i += 64) out.push(b.subarray(i, i + 64)); return out; },
};

/** The payload shapes this loop actually receives. */
function cases() {
  const usage = {
    input_tokens: 4211, output_tokens: 318,
    cache_creation_input_tokens: 0, cache_read_input_tokens: 3072,
  };
  const base = { id: 'msg_01', type: 'message', role: 'assistant', model: 'test-model', usage };
  return [
    {
      name: 'prose-end-turn',
      payload: { ...base, stop_reason: 'end_turn', content: [{ type: 'text', text: 'A finished answer, in several deltas.' }] },
    },
    {
      name: 'prose-max-tokens',
      payload: { ...base, stop_reason: 'max_tokens', content: [{ type: 'text', text: 'An answer cut off mid-' }] },
    },
    {
      name: 'tool-use',
      payload: {
        ...base,
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Looking that up.' },
          { type: 'tool_use', id: 'toolu_01', name: 'search_islamic_sources', input: { query: 'a query with "quotes" and \\ backslashes' } },
        ],
      },
    },
    {
      name: 'tool-use-empty-input',
      payload: {
        ...base,
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'toolu_02', name: 'noop', input: {} }],
      },
    },
    {
      name: 'thinking-then-prose',
      payload: {
        ...base,
        stop_reason: 'end_turn',
        content: [
          { type: 'thinking', thinking: 'Reasoning that the reader never sees.', signature: 'sig_abc' },
          { type: 'text', text: 'The answer itself.' },
        ],
      },
    },
    {
      name: 'no-text-block',
      payload: { ...base, stop_reason: 'end_turn', content: [] },
    },
  ];
}

/** Only the fields the loop reads downstream. Ordering is normalised, not ignored. */
function comparable(payload) {
  return JSON.stringify({
    content: (payload.content || []).map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking, signature: b.signature ?? null };
      if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      return b;
    }),
    stop_reason: payload.stop_reason ?? null,
    usage: {
      input_tokens: payload.usage?.input_tokens ?? null,
      output_tokens: payload.usage?.output_tokens ?? null,
      cache_creation_input_tokens: payload.usage?.cache_creation_input_tokens ?? null,
      cache_read_input_tokens: payload.usage?.cache_read_input_tokens ?? null,
    },
  });
}

function mutatedCopy(mutant) {
  const dir = path.join(os.tmpdir(), 'ezik-stream-p2-sse');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(LIB)) {
    const from = path.join(LIB, name);
    if (fs.statSync(from).isDirectory()) fs.cpSync(from, path.join(dir, name), { recursive: true });
    else fs.copyFileSync(from, path.join(dir, name));
  }
  const target = path.join(dir, 'free-brain', 'loop.js');
  const source = fs.readFileSync(SRC, 'utf8');
  const hits = source.split(mutant.find).length - 1;
  if (hits !== 1) throw new Error(`mutant ${mutant.name}: anchor found ${hits} times, expected 1`);
  const mutated = source.replace(mutant.find, mutant.replace);
  if (mutated === source) throw new Error(`mutant ${mutant.name}: source unchanged`);
  fs.writeFileSync(target, mutated, 'utf8');
  return target;
}

async function runProof(moduleHref, quiet) {
  const mod = await import(moduleHref);
  const { callProviderStream } = mod;
  if (typeof callProviderStream !== 'function') {
    throw new Error('callProviderStream is not exported — nothing to prove');
  }

  const results = [];
  let comparisons = 0;
  let matched = 0;
  let textSeen = 0;
  let textMatched = 0;

  for (const testCase of cases()) {
    const wire = toWire(toEvents(testCase.payload));
    const expectedText = (testCase.payload.content || [])
      .filter((b) => b.type === 'text').map((b) => b.text).join('');

    for (const [chunkName, chunker] of Object.entries(CHUNKERS)) {
      comparisons += 1;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = stubFetch(wire, chunker);
      let rebuilt;
      let streamedText = '';
      try {
        // eslint-disable-next-line no-await-in-loop
        rebuilt = await callProviderStream({
          providerUrl: 'https://example.invalid/v1/messages',
          headers: {},
          signal: undefined,
          body: { model: 'test-model', messages: [] },
          onText: (piece) => { streamedText += piece; },
        });
      } finally {
        globalThis.fetch = originalFetch;
      }

      const payloadOk = comparable(rebuilt) === comparable(testCase.payload);
      const textOk = streamedText === expectedText;
      textSeen += 1;
      if (textOk) textMatched += 1;
      if (payloadOk && textOk) matched += 1;
      else if (results.length < 20) {
        results.push({
          case: testCase.name,
          chunker: chunkName,
          failing: !payloadOk ? 'payload' : 'onText',
          expected: !payloadOk ? comparable(testCase.payload).slice(0, 200) : expectedText.slice(0, 200),
          got: !payloadOk ? comparable(rebuilt).slice(0, 200) : streamedText.slice(0, 200),
        });
      }
    }
  }

  const report = {
    comparisons, matched, mismatched: comparisons - matched, textSeen, textMatched, diffs: results,
  };
  report.pass = report.mismatched === 0;
  if (quiet) return report;

  console.log('CASES        ' + cases().length + '  (prose, truncation, tool use, empty args, thinking, no text)');
  console.log('CHUNKINGS    ' + Object.keys(CHUNKERS).join(', '));
  console.log('COMPARISONS  ' + comparisons);
  console.log('MATCHED      ' + matched + ' / ' + comparisons);
  console.log('onText       ' + textMatched + ' / ' + textSeen + ' delivered the exact reader text');
  if (results.length) {
    console.log('\nDIFFERENCES:');
    for (const d of results) {
      console.log('  ' + d.case + ' [' + d.chunker + '] failing=' + d.failing);
      console.log('    expected: ' + d.expected);
      console.log('    got     : ' + d.got);
    }
  }
  return report;
}

async function main() {
  const selftest = process.argv.includes('--selftest');
  const report = await runProof(url.pathToFileURL(SRC).href, false);
  console.log('\n' + (report.pass ? 'GATE PASS' : 'GATE FAIL'));

  let selftestOk = true;
  if (selftest) {
    console.log('\nSELFTEST — each mutant must be caught:');
    for (const mutant of MUTANTS) {
      let caught;
      let detail;
      try {
        const file = mutatedCopy(mutant);
        const r = await runProof(url.pathToFileURL(file).href + '?v=' + mutant.name, true);
        caught = !r.pass;
        detail = 'mismatched ' + r.mismatched + '/' + r.comparisons;
      } catch (e) {
        caught = true;
        detail = 'threw: ' + String(e.message || e).slice(0, 70);
      }
      if (!caught) selftestOk = false;
      console.log('  ' + (caught ? 'CAUGHT ' : 'MISSED ') + mutant.name.padEnd(30) + detail
        + '\n           claim: ' + mutant.claim);
    }
    console.log('\nSELFTEST ' + (selftestOk ? 'PASS' : 'FAIL') + ' — ' + MUTANTS.length + ' mutants');
  }

  process.exit(report.pass && selftestOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
