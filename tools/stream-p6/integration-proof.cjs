#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const ASK = path.join(ROOT, 'api', 'ask.js');
const WRITER = path.join(ROOT, 'lib', 'finalized-sse-writer.js');
const PROVIDER = 'https://provider.test/messages';

const SAFE_1 = 'هذه جملة عربية آمنة أولى.';
const SAFE_2 = 'وهذه جملة عربية آمنة ثانية.';
const SAFE_3 = 'وهذه جملة عربية آمنة ثالثة.';
const SAFE_4 = 'وهذه جملة عربية آمنة رابعة.';
const TERMINAL = [SAFE_1, SAFE_2, SAFE_3, SAFE_4].map((line) => `${line}\n`);

function replaceOnce(source, find, replacement) {
  const hits = source.split(find).length - 1;
  if (hits !== 1) throw new Error(`anchor found ${hits} times, expected 1`);
  return source.replace(find, replacement);
}

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

function sliceFunction(source, name) {
  const needles = [`export function ${name}(`, `const ${name} = `];
  const at = needles.map((needle) => source.indexOf(needle)).find((index) => index >= 0);
  if (at === undefined) throw new Error(`${name} not found`);
  let depth = 0;
  let opened = false;
  for (let index = at; index < source.length; index += 1) {
    if (source[index] === '{') { depth += 1; opened = true; }
    else if (source[index] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(at, index + 1);
    }
  }
  throw new Error(`${name} unbalanced`);
}

function apiDeliveryFactory(askSource, createFinalizedSseResponse) {
  const emitOnce = sliceFunction(askSource, 'emitOnce');
  const emitUnits = sliceFunction(askSource, 'emitUnits');
  const liveAt = askSource.indexOf('const liveFreeBrainUnits = (() => {');
  const emitAt = askSource.indexOf('const emitFreeBrain = ', liveAt);
  if (liveAt < 0 || emitAt < 0) throw new Error('live delivery statements not found');
  const liveStatement = askSource.slice(liveAt, emitAt).trim();
  const emitEnd = askSource.indexOf(';', emitAt);
  if (emitEnd < 0) throw new Error('emitFreeBrain terminator not found');
  const emitStatement = askSource.slice(emitAt, emitEnd + 1);

  // The source under test is evaluated with only the route-local values it closes over.
  // eslint-disable-next-line no-new-func
  const compile = new Function('scope', `
    const { res, finalizerContext, clearKeepAlive, seal } = scope;
    ${emitOnce};
    ${emitUnits};
    ${liveStatement}
    ${emitStatement}
    return { liveFreeBrainUnits, emitFreeBrain };
  `);

  return function makeDelivery() {
    const socket = {
      writes: [],
      ended: false,
      headersSent: true,
      setHeader() {},
      write(chunk) { this.writes.push(String(chunk)); return true; },
      end(...args) {
        this.ended = true;
        const callback = args.find((arg) => typeof arg === 'function');
        callback?.();
        return this;
      },
      on() {}, once() {}, removeListener() {},
      get events() {
        return this.writes.join('').split(/\r?\n/u).flatMap((line) => {
          if (!line.startsWith('data:')) return [];
          try { return [JSON.parse(line.slice(5).trim())]; } catch { return []; }
        });
      },
      get text() {
        return this.events
          .filter((event) => event?.type === 'content_block_delta'
            && event.delta?.type === 'text_delta')
          .map((event) => String(event.delta.text || '')).join('');
      },
    };
    const rejects = [];
    const wire = [];
    const finalizerContext = {
      fallbackText: 'رفض آمن', sourceCards: [], readerPrefix: '', readerSuffix: '',
      readerCards: [], readerCardPrefix: '', allowWireOwnedCards: true,
    };
    const res = createFinalizedSseResponse(socket, {
      finalize: ({ text }) => ({ ok: true, text }),
      context: () => finalizerContext,
      failureText: finalizerContext.fallbackText,
      onReject: (detail) => rejects.push(detail),
      onWireWrite: (detail) => wire.push(detail),
    });
    const exits = compile({
      res, finalizerContext, clearKeepAlive: () => {}, seal: (text) => String(text ?? ''),
    });
    return { ...exits, res, socket, rejects, wire, finalizerContext };
  };
}

function jsonPayload(text, stop = 'end_turn') {
  return {
    id: 'proof-message', type: 'message', role: 'assistant',
    content: text == null ? [] : [{ type: 'text', text }],
    stop_reason: stop,
    usage: {
      input_tokens: 101, output_tokens: 37,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    },
  };
}

function toolPayload({ text = '', name = 'unknown_tool', input = {}, id = 'tool-1' } = {}) {
  return {
    id: 'proof-tool', type: 'message', role: 'assistant', stop_reason: 'tool_use',
    content: [
      ...(text ? [{ type: 'text', text }] : []),
      { type: 'tool_use', id, name, input },
    ],
    usage: {
      input_tokens: 89, output_tokens: 23,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    },
  };
}

function sseBody(chunks, { fail = false, stop = 'end_turn', tool = null } = {}) {
  const events = [
    {
      type: 'message_start',
      message: {
        id: 'proof-stream', type: 'message', role: 'assistant', content: [],
        usage: {
          input_tokens: 113, output_tokens: 0,
          cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...chunks.map((text) => ({
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text },
    })),
  ];
  if (fail) events.push({ type: 'error', error: { type: 'proof_cut', message: 'cut' } });
  else {
    events.push({ type: 'content_block_stop', index: 0 });
    // V3 streams the TOOL-BEARING call, so the fixture has to be able to end one on a tool call.
    // The block is emitted the way the provider emits it — start, input deltas, stop — because
    // `callProviderStream` reassembles the input from those deltas and a shortcut here would test
    // a shape the provider never sends.
    if (tool) {
      events.push(
        {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'tool_use', id: tool.id || 'stream-tool-1', name: tool.name, input: {} },
        },
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: JSON.stringify(tool.input || {}) },
        },
        { type: 'content_block_stop', index: 1 },
      );
    }
    events.push(
      { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : stop }, usage: { output_tokens: 41 } },
      { type: 'message_stop' },
    );
  }
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

/** The same message an `sse` item carries, in the body shape the plain transport returns. */
function asJsonPayload(item) {
  const text = (item.chunks || []).join('');
  return {
    id: 'proof-stream', type: 'message', role: 'assistant',
    stop_reason: item.tool ? 'tool_use' : (item.stop || 'end_turn'),
    content: [
      ...(text ? [{ type: 'text', text }] : []),
      ...(item.tool ? [{
        type: 'tool_use',
        id: item.tool.id || 'stream-tool-1',
        name: item.tool.name,
        input: item.tool.input || {},
      }] : []),
    ],
    usage: {
      input_tokens: 113, output_tokens: 41,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    },
  };
}

async function withProvider(plan, requests, action) {
  const original = global.fetch;
  global.fetch = async (input, init = {}) => {
    if (String(input) !== PROVIDER) return new Response('offline in proof', { status: 503 });
    const item = plan.shift();
    if (!item) throw new Error('provider proof plan exhausted');
    const body = JSON.parse(String(init.body || '{}'));
    requests.push(body);
    if (item.kind === 'json') {
      if (body.stream === true) {
        const blocks = Array.isArray(item.payload?.content) ? item.payload.content : [];
        const text = blocks.filter((block) => block?.type === 'text')
          .map((block) => String(block.text || '')).join('');
        const tool = blocks.find((block) => block?.type === 'tool_use') || null;
        return new Response(sseBody(text ? [text] : [], {
          stop: item.payload?.stop_reason || 'end_turn',
          tool: tool ? { id: tool.id, name: tool.name, input: tool.input } : null,
        }), {
          status: 200, headers: { 'content-type': 'text/event-stream' },
        });
      }
      return new Response(JSON.stringify(item.payload), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (body.stream !== true) {
      assert.ok(!item.fail, 'a cut fixture has no unstreamed equivalent');
      return new Response(JSON.stringify(asJsonPayload(item)), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(sseBody(item.chunks, item), {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  };
  try { return await action(); } finally { global.fetch = original; }
}

async function quiet(action) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try { return await action(); } finally { Object.assign(console, saved); }
}

function commonOptions({ stream = true, lexicalRoute = 'GEN', band = 'adult' } = {}) {
  return {
    messages: [{ role: 'user', content: 'اختبار بنيوي محلي.' }],
    system: 'اختبار بنيوي محلي.',
    model: 'proof-model', maxTokens: 512, usePremium: false, effort: '',
    band, mode: 'standard', lexicalRoute,
    providerUrl: PROVIDER, headers: {}, signal: undefined, dailyBudget: null,
    env: { STREAM_V1: stream ? 'on' : 'off' },
  };
}

async function runCase(module, makeDelivery, plan, options = {}) {
  const delivery = makeDelivery();
  const requests = [];
  let callbacks = 0;
  const out = await quiet(() => withProvider(plan, requests, () => module.runFreeBrainTurn({
    ...commonOptions(options),
    onWriteUnit: (detail) => {
      callbacks += 1;
      return delivery.liveFreeBrainUnits.push(detail);
    },
  })));
  const early = {
    writes: delivery.socket.writes.length,
    text: delivery.socket.text,
    wire: delivery.wire.length,
  };
  await quiet(async () => { delivery.emitFreeBrain(out.text, out.readerUnits); });
  return { out, requests, callbacks, early, delivery, remaining: plan.length };
}

// ── V3 PLANS ────────────────────────────────────────────────────────────────
// The streamed call is the TOOL-BEARING one, so a plan whose first item is a plain JSON body is
// a plan describing V2. Each of these is stated twice over — once with the flag on and once with
// it off — and the call COUNT is compared between the two, because «no extra call» is the whole
// claim of this phase and a claim nobody counts is a claim nobody has.

/** The ordinary shape: nothing written yet, the first round writes the answer and stops. */
function streamedFinishPlan({ fail = false } = {}) {
  return [{ kind: 'sse', chunks: fail ? TERMINAL.slice(0, 3) : TERMINAL, fail }];
}

/**
 * The head case. Round one writes a TOOL ANNOUNCEMENT and calls a tool: the announcement is
 * dropped by `deliverableText` before any unit can form, so nothing reaches the reader, and the
 * round's prose still lands in `written`. Round two therefore finds a head and is withheld —
 * which is the same gate V2 applied once after the loop, applied here per round.
 */
function headPlan() {
  return [
    {
      kind: 'sse',
      chunks: ['سأبحث لك في فتاوى العلماء عن هذه المسألة تحديداً.\n'],
      tool: { name: 'unknown_tool', input: {} },
    },
    { kind: 'json', payload: jsonPayload('النص الحالي الذي أنهى جولة الأدوات.') },
  ];
}

// The recorded head shape is followed by a multi-unit answer.  A one-sentence synthetic answer
// has no releasable unit before close and therefore cannot distinguish a live head from a buffer.
function headStreamPlan() {
  const plan = headPlan();
  plan[1] = { kind: 'sse', chunks: TERMINAL };
  return plan;
}

function fiqhWithoutCardsPlan() {
  return [
    {
      kind: 'json',
      payload: toolPayload({
        text: `${SAFE_1}\n${SAFE_2}\n`, name: 'unknown_tool', input: {},
      }),
    },
    { kind: 'json', payload: jsonPayload(TERMINAL.join('')) },
  ];
}

function mixedWithoutCardsPlan() {
  const noHit = 'zzzz-no-result-stream-proof';
  return [
    {
      kind: 'json',
      payload: toolPayload({ name: 'search_fatawa', input: { query: noHit }, id: 'mixed-tool-1' }),
    },
    {
      kind: 'json',
      payload: toolPayload({ name: 'search_live', input: { query: noHit }, id: 'mixed-tool-2' }),
    },
    { kind: 'sse', chunks: TERMINAL },
  ];
}

/**
 * The pin case. Round one writes REAL answer prose — it survives the announcement filter, so the
 * reader accepts it — and then calls a tool. Round two restates it inside a longer answer, which
 * is exactly the shape `joinRoundTexts` deletes by containment. Without the pin the delivered
 * text no longer begins with what the reader was sent.
 */
const PIN_HEAD = 'الجمع للمسافر جائز عند الحاجة.\nوالقصر سنة مؤكدة في السفر.\nوهذا قول الجمهور.';
const PIN_FULL = `ومقدمة زائدة تتقدم على الجواب.\n${PIN_HEAD}\nوخاتمة زائدة تتلوه.`;
function pinPlan() {
  return [
    {
      kind: 'sse',
      chunks: PIN_HEAD.split('\n').map((line) => `${line}\n`),
      tool: { name: 'unknown_tool', input: {} },
    },
    { kind: 'json', payload: jsonPayload(PIN_FULL) },
  ];
}

/**
 * The citation case. A DEEN route with an empty table is a ruling with no cards, so round one is
 * withheld by the card test and runs unstreamed; the search fills the table, and round two — still
 * head-free, now with rows — is streamed. The retry that would replace those bytes is suppressed.
 */
function citationPlan() {
  return [
    {
      kind: 'json',
      payload: toolPayload({ name: 'search_sources', input: { query: 'الوضوء' } }),
    },
    { kind: 'sse', chunks: TERMINAL },
  ];
}

function terminalOracle(createSentenceStream, module, raw, domain = 'general') {
  const stream = createSentenceStream({
    evidence: [], domain, mode: 'standard',
    khilafFromOpinions: null, opinionCount: null, truncated: null, sources: [],
  });
  stream.push(module.stripCitations(module.deliverableText(raw)));
  return stream.end().text;
}

async function main() {
  const corpusPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!corpusPath) throw new Error('usage: integration-proof.cjs <corpus.json>');

  const liveSource = fs.readFileSync(LOOP, 'utf8');
  const baselineSource = execFileSync(
    'git', ['show', 'origin/main:lib/free-brain/loop.js'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const askSource = fs.readFileSync(ASK, 'utf8');
  const writerSource = fs.readFileSync(WRITER, 'utf8');
  const live = await importSource(liveSource, 'live');
  const baseline = await importSource(baselineSource, 'baseline');
  const { createFinalizedSseResponse } = await import(pathToFileURL(WRITER).href);
  const { createSentenceStream } = await import(
    pathToFileURL(path.join(ROOT, 'lib', 'sentence-stream.js')).href,
  );
  const makeDelivery = apiDeliveryFactory(askSource, createFinalizedSseResponse);
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  // The two semantic seams named by the directive remain byte-identical to the base object.
  check(sliceFunction(liveSource, 'joinRoundTexts') === sliceFunction(baselineSource, 'joinRoundTexts'),
    'joinRoundTexts changed');
  check(sliceFunction(liveSource, 'deliverableText') === sliceFunction(baselineSource, 'deliverableText'),
    'deliverableText changed');

  // P5's qualifying set is 151 records. On STREAM_V1=off, both loop revisions receive the same
  // provider object and must produce the same reader text and the same provider request bytes.
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const qualified = corpus.filter((record) => {
    const stream = createSentenceStream({
      evidence: [], domain: 'mixed', mode: 'standard', truncated: null, sources: [],
    });
    const released = stream.push(record.text);
    const closed = stream.end();
    const head = released.join('\n');
    return !closed.violations.length && head && closed.text.startsWith(head);
  });
  let flagOffSame = 0;
  await quiet(async () => {
    for (const record of qualified) {
      const payload = jsonPayload(record.text);
      const baseRequests = [];
      const liveRequests = [];
      let liveCallbacks = 0;
      const baseOut = await withProvider(
        [{ kind: 'json', payload }], baseRequests,
        () => baseline.runFreeBrainTurn(commonOptions({ stream: false })),
      );
      const liveOut = await withProvider(
        [{ kind: 'json', payload }], liveRequests,
        () => live.runFreeBrainTurn({
          ...commonOptions({ stream: false }),
          onWriteUnit: () => { liveCallbacks += 1; return true; },
        }),
      );
      const same = Buffer.from(liveOut.text).equals(Buffer.from(baseOut.text))
        && JSON.stringify(liveOut.readerUnits) === JSON.stringify(baseOut.readerUnits)
        && JSON.stringify(liveRequests) === JSON.stringify(baseRequests)
        && liveOut.modelCalls === baseOut.modelCalls
        && liveCallbacks === 0;
      if (same) flagOffSame += 1;
    }
  });
  check(qualified.length === 151, `flag-off qualifying corpus was ${qualified.length}, expected 151`);
  check(flagOffSame === qualified.length, `flag-off equivalence ${flagOffSame}/${qualified.length}`);

  // The order's safety claim is final delivery, not merely the flag-off fallback. Replay every
  // corpus answer as the same provider turn under both flags and compare the bytes after the real
  // loop and the real finalized writer have both run.
  let finalTextIdentical = 0;
  for (const record of corpus) {
    const chunks = String(record.text || '').match(/[\s\S]{1,31}/gu) || [];
    // eslint-disable-next-line no-await-in-loop
    const on = await runCase(live, makeDelivery, [{ kind: 'sse', chunks }], { stream: true });
    // eslint-disable-next-line no-await-in-loop
    const off = await runCase(live, makeDelivery, [{ kind: 'sse', chunks }], { stream: false });
    const same = Buffer.from(on.out.text).equals(Buffer.from(off.out.text))
      && Buffer.from(on.delivery.socket.text).equals(Buffer.from(off.delivery.socket.text))
      && Buffer.from(on.delivery.socket.text).equals(Buffer.from(on.out.text))
      && (!on.early.text || on.out.text.startsWith(on.early.text));
    if (same) finalTextIdentical += 1;
  }
  check(corpus.length === 160, `final-text corpus was ${corpus.length}, expected 160`);
  check(finalTextIdentical === corpus.length,
    `final text identical ${finalTextIdentical}/${corpus.length}`);

  const corpusChunkers = [
    (text) => [text],
    (text) => text.match(/[\s\S]{1,17}/gu) || [],
    (text) => text.split(/(?<=\n)/u),
  ];
  let corpusPrefixComparisons = 0;
  let corpusPrefixFailures = 0;
  for (const record of corpus) {
    for (const chunker of corpusChunkers) {
      let accepted = '';
      const stream = live.createTerminalUnitStream({
        domain: 'mixed', mode: 'standard', degraded: [],
        onUnit: ({ text }) => { accepted = text; return true; },
      });
      for (const chunk of chunker(record.text)) stream.push(chunk);
      const closed = stream.end();
      const oracle = terminalOracle(createSentenceStream, live, record.text, 'mixed');
      corpusPrefixComparisons += 1;
      if (!oracle.startsWith(accepted)
        || closed.violations.some((item) => item.kind === 'emitted-not-a-prefix')) {
        corpusPrefixFailures += 1;
      }
    }
  }
  check(corpusPrefixFailures === 0,
    `corpus emitted-not-prefix failures ${corpusPrefixFailures}/${corpusPrefixComparisons}`);

  // ── §٢ (V3) — THE CALL COUNT IS THE CLAIM, SO IT IS COUNTED ON EVERY FIXTURE ──
  // Each shape is run twice, flag on and flag off, and the number of provider requests must be
  // the SAME. V2 failed exactly here, by one call, and no downstream check noticed.
  const shapes = [
    ['finish', streamedFinishPlan, { lexicalRoute: 'GEN' }],
    ['head', headStreamPlan, { lexicalRoute: 'GEN' }],
    ['pin', pinPlan, { lexicalRoute: 'GEN' }],
    ['citation', citationPlan, { lexicalRoute: 'DEEN' }],
  ];
  const runs = {};
  for (const [name, plan, extra] of shapes) {
    // eslint-disable-next-line no-await-in-loop
    const on = await runCase(live, makeDelivery, plan(), { stream: true, ...extra });
    // eslint-disable-next-line no-await-in-loop
    const off = await runCase(live, makeDelivery, plan(), { stream: false, ...extra });
    runs[name] = { on, off };
    check(on.requests.length === off.requests.length,
      `${name}: streaming added ${on.requests.length - off.requests.length} provider call(s)`);
    check(on.remaining === 0 && off.remaining === 0, `${name}: provider plan was not consumed`);
    check(on.out.modelCalls === off.out.modelCalls,
      `${name}: modelCalls ${on.out.modelCalls} vs ${off.out.modelCalls}`);
    process.stdout.write(
      `SHAPE ${name.padEnd(9)} CALLS=${on.requests.length} (off ${off.requests.length}) `
      + `STREAMED=${on.out.streamedThisTurn === true ? 'YES' : 'NO'} `
      + `PINNED=${on.out.readerOwnsHead === true ? 'YES' : 'NO'}\n`,
    );
  }

  // THE ORDINARY TURN. One call, streamed, and the reader's early bytes survive to the end.
  const finish = runs.finish.on;
  check(finish.requests.length === 1, `finish turn made ${finish.requests.length} calls, expected 1`);
  check(finish.out.streamedThisTurn === true && finish.early.text, 'finish turn emitted no early unit');
  check(finish.out.streamPrefixValid === true && finish.out.text.startsWith(finish.early.text),
    'finish early text was not a final prefix');
  check(finish.delivery.socket.text === finish.out.text, 'finish reader text differed at flush');

  // PART A. Round one wrote an announcement that produces no reader unit. Round two continues the
  // same cumulative prefix, so the prior head is no longer a reason to withhold visible bytes.
  const headOn = runs.head.on;
  const headOff = runs.head.off;
  check(headOn.early.writes > 0 && headOn.callbacks > 0, 'head fixture released no bytes');
  check(!headOn.out.degraded.includes('stream_withheld:head_text'),
    'the removed head withhold still fired');
  check(headOn.out.streamPrefixValid === true && headOn.out.text.startsWith(headOn.early.text),
    'head fixture did not retain its emitted prefix');
  check(Buffer.from(headOn.delivery.socket.text).equals(Buffer.from(headOff.delivery.socket.text)),
    'head streaming changed final reader bytes');
  // `stream` is the one key that MUST differ — it is the transport. Everything else is the
  // conversation, and the conversation may not move because the transport did.
  const withoutTransport = (list) => JSON.stringify(list.map(({ stream, ...rest }) => rest));
  check(withoutTransport(headOn.requests) === withoutTransport(headOff.requests),
    'head gate changed provider requests');

  // THE PIN. The standing join deletes the streamed head by containment; the pin keeps it, and
  // the delivered text still begins with what the reader was sent.
  const pin = runs.pin.on;
  check(pin.out.readerOwnsHead === true, 'pin fixture did not mark the head as the reader\'s');
  check(pin.out.streamedThisTurn === true && pin.early.text, 'pin fixture streamed nothing');
  check(pin.out.streamPrefixValid === true && pin.out.text.startsWith(pin.early.text),
    'pin fixture did not retain the emitted prefix');
  check(pin.out.degraded.some((note) => note.startsWith('head_pin_kept:')),
    'the pin kept text and did not say how much');
  check(live.joinRoundTexts([PIN_HEAD, PIN_FULL]) !== live.joinRoundTextsHeadPinned([PIN_HEAD, PIN_FULL]),
    'the pinned join and the standing join agreed on the fixture the pin exists for');
  check(live.joinRoundTexts([PIN_HEAD, PIN_FULL]) === PIN_FULL,
    'the standing join no longer drops the contained head — the pin fixture proves nothing');

  // THE CITATION RETRY. Round one is withheld by the card test, round two streams, the retry is
  // suppressed rather than silently skipped.
  const citation = runs.citation.on;
  check(citation.out.evidence.length > 0, 'citation fixture produced no real evidence rows');
  check(citation.out.streamedThisTurn === true && citation.early.text, 'citation fixture did not stream');
  check(citation.out.degraded.some((note) => note.startsWith('stream_withheld:ruling_without_cards')),
    'the card test was not named on the withheld round');
  check(citation.out.degraded.includes('citation_retry:suppressed_on_stream'),
    'citation retry suppression was not explicit');

  // THE FIQH NEGATIVE. No evidence row ever arrives, so neither the progress head nor the answer
  // body may put one byte on the wire.
  const fiqhWithoutCards = await runCase(
    live, makeDelivery, fiqhWithoutCardsPlan(), { stream: true, lexicalRoute: 'DEEN' },
  );
  const fiqhStreamedWithoutCards = fiqhWithoutCards.early.writes > 0 ? 1 : 0;
  check(fiqhWithoutCards.out.evidence.length === 0, 'empty-evidence fiqh fixture gained evidence');
  check(fiqhStreamedWithoutCards === 0 && fiqhWithoutCards.callbacks === 0,
    'fiqh streamed without cards');
  check(fiqhWithoutCards.out.degraded.some((note) => note.startsWith('stream_withheld:ruling_without_cards')),
    'empty-evidence fiqh withhold was not named');

  // PART B BY CONSTRUCTION. General adult, general child, and mixed are all outside the literal
  // fiqh domain, so an empty evidence table is not a body-streaming hold for any of them.
  const childGeneral = await runCase(
    live, makeDelivery, streamedFinishPlan(), { stream: true, lexicalRoute: 'GEN', band: 'child' },
  );
  const mixedWithoutCards = await runCase(
    live, makeDelivery, mixedWithoutCardsPlan(), { stream: true, lexicalRoute: 'DEEN' },
  );
  check(childGeneral.out.domain === 'general' && childGeneral.early.writes > 0,
    'child general body did not stream');
  check(mixedWithoutCards.out.domain === 'mixed',
    `mixed fixture resolved as ${mixedWithoutCards.out.domain}`);
  check(mixedWithoutCards.out.evidence.length === 0,
    'mixed empty-card fixture gained evidence');
  check(mixedWithoutCards.early.writes > 0 && mixedWithoutCards.out.streamPrefixValid === true,
    'mixed body was withheld without cards');
  const nonFiqhBodyStreamed = [finish, childGeneral, mixedWithoutCards]
    .filter((item) => item.early.writes > 0).length;

  // THE CUT. The stream dies mid-round; the accepted prefix becomes the head, the tools-removed
  // write finishes the answer, and the reader's bytes are still the beginning of it.
  const cut = await runCase(live, makeDelivery, [
    { kind: 'sse', chunks: TERMINAL.slice(0, 3), fail: true },
    { kind: 'json', payload: jsonPayload('جواب مكتمل بعد انقطاع البث.') },
  ], { stream: true });
  check(cut.early.text, 'cut fixture released nothing to cut');
  check(cut.out.streamPrefixValid === true && cut.out.text.startsWith(cut.early.text),
    'cut turn replaced its accepted prefix');
  check(cut.out.readerOwnsHead === true, 'cut prefix was not pinned as the head');
  check(cut.out.degraded.includes('stream_cut:provider_error_tool_phase'),
    'the cut was not named');

  const protocolChunks = [
    `${SAFE_1}\n`, `${SAFE_2}\n`, '<output>\n',
    'حمولة محجوبة أولى.\n', 'حمولة محجوبة ثانية.\n', '</output>',
  ];
  const codeChunks = [
    `${SAFE_1}\n`, `${SAFE_2}\n`, 'value = maybe\n', 'call();\n',
    'حاجز عربي.\n', 'خاتمة عربية.\n',
  ];

  function terminalObservation(module, chunks, captureAt) {
    let accepted = '';
    let before = '';
    const stream = module.createTerminalUnitStream({
      domain: 'general', mode: 'standard', degraded: [],
      onUnit: ({ text }) => { accepted = text; return true; },
    });
    chunks.forEach((chunk, index) => {
      stream.push(chunk);
      if (index === captureAt) before = accepted;
    });
    const result = stream.end();
    const raw = chunks.join('');
    return {
      ...result, before, accepted,
      oracle: terminalOracle(createSentenceStream, module, raw),
    };
  }

  const protocol = terminalObservation(live, protocolChunks, 4);
  check(protocol.oracle.startsWith(protocol.acceptedPrefix), 'protocol stream was not an oracle prefix');
  check(!protocol.acceptedPrefix.includes('حمولة محجوبة'), 'protocol payload reached the reader');
  const code = terminalObservation(live, codeChunks, 3);
  check(code.oracle.startsWith(code.acceptedPrefix), 'code stream was not an oracle prefix');
  check(code.oracle.includes('value = maybe'), 'later code shape did not preserve its connected line');

  async function mutation(name, find, replacement, exercise) {
    let mutated;
    try {
      const source = replaceOnce(liveSource, find, replacement);
      mutated = await importSource(source, `mutant-${name}`);
    } catch (error) {
      return { name, status: 'BROKEN', detail: String(error?.message || error).slice(0, 100) };
    }
    try {
      return { name, status: (await exercise(mutated)) ? 'CAUGHT' : 'MISSED' };
    } catch (error) {
      return { name, status: 'CAUGHT', detail: `threw:${String(error?.message || error).slice(0, 80)}` };
    }
  }

  const mutations = [];
  mutations.push(await mutation(
    'revert-part-a-head-gate',
    'const roundStreamEligible = streaming.enabled && !turnUnitsClosed && !roundRulingWithoutCards;',
    'const roundStreamEligible = streaming.enabled && written.length === 0 && !turnUnitsClosed && !roundRulingWithoutCards;',
    async (module) => {
      const result = await runCase(module, makeDelivery, headStreamPlan(), { stream: true });
      return result.early.writes === 0 && headOn.early.writes > 0;
    },
  ));
  mutations.push(await mutation(
    'drop-head-pin',
    '      if (index === 0) return true;',
    '      if (index === -1) return true;',
    async (module) => {
      const result = await runCase(module, makeDelivery, pinPlan(), { stream: true });
      // The pin is what keeps the delivered text starting with the bytes the reader accepted.
      return result.out.streamPrefixValid !== true
        || !result.out.text.startsWith(result.early.text);
    },
  ));
  mutations.push(await mutation(
    'stream-past-the-card-test',
    "    const roundRulingWithoutCards = roundDomain === 'fiqh' && table.rows.length === 0;",
    '    const roundRulingWithoutCards = false;',
    async (module) => {
      const result = await runCase(
        module, makeDelivery, fiqhWithoutCardsPlan(), { stream: true, lexicalRoute: 'DEEN' },
      );
      return result.early.writes > 0;
    },
  ));
  mutations.push(await mutation(
    'open-citation-retry-after-stream',
    'const citationRetryGateOpen = !streamedThisTurn;',
    'const citationRetryGateOpen = true;',
    async (module) => {
      // The retry object is IN the plan, so an open gate is caught by the extra call it makes
      // and not by the plan running dry — a mutant that is caught by throwing proves nothing about
      // the rule it was supposed to break.
      const result = await runCase(
        module, makeDelivery,
        [...citationPlan(), { kind: 'json', payload: jsonPayload('جواب بديل موثق. [[1]]') }],
        { stream: true, lexicalRoute: 'DEEN' },
      );
      return result.requests.length === 3
        && (result.delivery.socket.text !== citation.delivery.socket.text
          || !result.out.text.startsWith(result.early.text));
    },
  ));
  mutations.push(await mutation(
    'remove-balanced-protocol-hold',
    'const openLeaf = unmatchedProtocolLeafAt(source.slice(0, cut));',
    'const openLeaf = -1;',
    async (module) => {
      const result = terminalObservation(module, protocolChunks, 4);
      return result.before.includes('حمولة محجوبة')
        || !result.oracle.startsWith(result.acceptedPrefix);
    },
  ));
  mutations.push(await mutation(
    'remove-later-code-shape-hold',
    'while (stableLines > 0 && codeShapeCanSpreadInto(completed[stableLines - 1])) {',
    'while (false && codeShapeCanSpreadInto(completed[stableLines - 1])) {',
    async (module) => {
      const result = terminalObservation(module, codeChunks, 3);
      return result.before !== code.before;
    },
  ));

  // Inverse control: this changes telemetry only. It must build, have no wire effect, and remain
  // MISSED; it is deliberately excluded from the required caught-mutant count.
  const inverse = await mutation(
    'inverse-telemetry-only',
    'cardWithholdNoted = true;',
    'cardWithholdNoted = true; // inverse telemetry-only',
    async (module) => {
      const result = await runCase(
        module, makeDelivery, fiqhWithoutCardsPlan(), { stream: true, lexicalRoute: 'DEEN' },
      );
      return result.delivery.socket.text !== fiqhWithoutCards.delivery.socket.text
        || result.requests.length !== fiqhWithoutCards.requests.length;
    },
  );
  for (const item of mutations) check(item.status === 'CAUGHT', `${item.name} was ${item.status}`);
  check(inverse.status === 'MISSED', `inverse control was ${inverse.status}, expected MISSED`);

  const allCases = [
    finish, headOn, headOff, pin, citation, fiqhWithoutCards, childGeneral, mixedWithoutCards, cut,
  ];
  const integratedPrefixFailures = allCases.filter((item) => item.out.streamPrefixValid === false
    || item.out.degraded.some((entry) => entry === 'stream_violation:emitted-not-a-prefix')
    || item.delivery.rejects.some((entry) => entry.reason === 'not-a-prefix')).length;
  const prefixFailures = integratedPrefixFailures + corpusPrefixFailures;
  check(prefixFailures === 0, `emitted-not-prefix failures: ${prefixFailures}`);
  check((writerSource.match(/target\.write\(/gu) || []).length === 1,
    'writer has a target.write bypass outside the central sink');
  check(allCases.every((item) => item.delivery.wire.length === item.delivery.socket.writes.length),
    'wire observer did not cover every target write');

  console.log(`FLAG_OFF_BYTE_IDENTICAL=${flagOffSame}/${qualified.length}`);
  console.log(`FINAL_TEXT_IDENTICAL=${finalTextIdentical}/${corpus.length}`);
  console.log(`FINISH_STREAMED=${finish.out.streamedThisTurn ? 'YES' : 'NO'} CALLS=${finish.requests.length}`);
  console.log(`HEAD_EARLY_WRITES=${headOn.early.writes} HEAD_CALLS=${headOn.requests.length}`);
  console.log(`PIN_KEPT=${pin.out.degraded.find((note) => note.startsWith('head_pin_kept:')) || 'none'}`);
  console.log(`CITE_RETRY_AFTER_STREAM=${citation.requests.length > 2 ? 'YES' : 'NO'} EVIDENCE=${citation.out.evidence.length}`);
  console.log(`CUT_PREFIX_VALID=${cut.early.text && cut.out.text.startsWith(cut.early.text) ? 'YES' : 'NO'}`);
  console.log(`EXTRA_CALLS_VS_FLAG_OFF=${shapes.reduce((sum, [name]) => sum + (runs[name].on.requests.length - runs[name].off.requests.length), 0)}`);
  console.log(`CORPUS_PREFIX_COMPARISONS=${corpusPrefixComparisons}`);
  console.log(`EMITTED_NOT_PREFIX=${prefixFailures}`);
  console.log(`FIQH_STREAMED_WITHOUT_CARDS=${fiqhStreamedWithoutCards}`);
  console.log(`NON_FIQH_BODY_STREAMED=${nonFiqhBodyStreamed}/3 CHILD_STREAMED=${childGeneral.early.writes > 0 ? 1 : 0}/1`);
  console.log(`PROTOCOL_PAYLOAD_EARLY=${protocol.acceptedPrefix.includes('حمولة محجوبة') ? 'YES' : 'NO'}`);
  console.log(`CODE_SHAPE_PRESERVED=${code.oracle.includes('value = maybe') ? 'YES' : 'NO'}`);
  for (const item of mutations) console.log(`MUTANT ${item.status.padEnd(7)} ${item.name}`);
  const orderedMutants = [mutations[0], mutations[2]];
  console.log(`MUTANTS_CAUGHT=${orderedMutants.filter((item) => item.status === 'CAUGHT').length}/2`);
  console.log(`INVERSE ${inverse.status.padEnd(7)} ${inverse.name} (excluded)`);
  console.log(`WRITER_TARGET_WRITE_SITES=${(writerSource.match(/target\.write\(/gu) || []).length}`);
  console.log(`GATE=${failures.length ? 'FAIL' : 'PASS'}`);
  for (const failure of failures) console.log(`FAIL ${failure}`);
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exit(1);
});
