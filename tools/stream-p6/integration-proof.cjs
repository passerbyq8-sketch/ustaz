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

function sseBody(chunks, { fail = false, stop = 'end_turn' } = {}) {
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
  else events.push(
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 41 } },
    { type: 'message_stop' },
  );
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
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
      assert.equal(body.stream, false, 'non-stream fixture reached with stream enabled');
      return new Response(JSON.stringify(item.payload), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    assert.equal(body.stream, true, 'stream fixture reached without stream enabled');
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

function commonOptions({ stream = true, lexicalRoute = 'GEN' } = {}) {
  return {
    messages: [{ role: 'user', content: 'اختبار بنيوي محلي.' }],
    system: 'اختبار بنيوي محلي.',
    model: 'proof-model', maxTokens: 512, usePremium: false, effort: '',
    band: 'adult', mode: 'standard', lexicalRoute,
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

function noHeadPlan({ fail = false } = {}) {
  return [
    { kind: 'json', payload: jsonPayload('مسودة أولية مكتملة.') },
    { kind: 'sse', chunks: fail ? TERMINAL.slice(0, 3) : TERMINAL, fail },
  ];
}

function headPlan(extra = false) {
  const plan = [
    { kind: 'json', payload: toolPayload({ text: 'نص سابق من جولة الأدوات.' }) },
    { kind: 'json', payload: jsonPayload('النص الحالي الذي أنهى جولة الأدوات.') },
  ];
  if (extra) plan.push({ kind: 'sse', chunks: TERMINAL });
  return plan;
}

function citationPlan(withRetry = false) {
  const plan = [
    {
      kind: 'json',
      payload: toolPayload({ name: 'search_sources', input: { query: 'الوضوء' } }),
    },
    { kind: 'json', payload: jsonPayload('مسودة فقهية أولية بلا إحالة.') },
    { kind: 'sse', chunks: TERMINAL },
  ];
  if (withRetry) plan.push({ kind: 'json', payload: jsonPayload('جواب بديل موثق. [[1]]') });
  return plan;
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
    'git', ['show', 'perf/stream-p1:lib/free-brain/loop.js'],
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

  const noHead = await runCase(live, makeDelivery, noHeadPlan(), { stream: true });
  check(noHead.out.terminalWriteAdded === true, 'no-head turn did not add terminal write');
  check(noHead.out.streamedThisTurn === true && noHead.early.text, 'no-head turn emitted no early unit');
  check(noHead.out.streamPrefixValid === true && noHead.out.text.startsWith(noHead.early.text),
    'no-head early text was not a final prefix');
  check(noHead.requests.length === 2 && noHead.remaining === 0, 'no-head provider call count changed');
  check(noHead.delivery.socket.text === noHead.out.text, 'no-head reader text differed at flush');

  const headOn = await runCase(live, makeDelivery, headPlan(), { stream: true });
  const headOff = await runCase(live, makeDelivery, headPlan(), { stream: false });
  check(headOn.early.writes === 0 && headOn.callbacks === 0, 'head gate released current bytes');
  check(headOn.requests.length === 2 && headOn.out.terminalWriteAdded === false,
    'head gate added a terminal call');
  check(Buffer.from(headOn.delivery.socket.text).equals(Buffer.from(headOff.delivery.socket.text)),
    'head gate changed reader bytes');
  check(JSON.stringify(headOn.requests) === JSON.stringify(headOff.requests),
    'head gate changed provider requests');

  const citation = await runCase(
    live, makeDelivery, citationPlan(), { stream: true, lexicalRoute: 'DEEN' },
  );
  check(citation.out.evidence.length > 0, 'citation fixture produced no real evidence rows');
  check(citation.out.streamedThisTurn === true && citation.early.text, 'citation fixture did not stream');
  check(citation.requests.length === 3 && citation.remaining === 0, 'citation retry ran after reader bytes');
  check(citation.out.degraded.includes('citation_retry:suppressed_on_stream'),
    'citation retry suppression was not explicit');

  const cut = await runCase(live, makeDelivery, noHeadPlan({ fail: true }), { stream: true });
  check(cut.early.text && noHead.out.text.startsWith(cut.early.text),
    'cut reader bytes were not a valid prefix of the complete answer');
  check(cut.out.streamPrefixValid === true && cut.out.text.startsWith(cut.early.text),
    'cut turn replaced its accepted prefix');

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
    'remove-head-gate',
    'const headFreeBeforeTerminal = finished ? headFreeAtFinish : written.length === 0;',
    'const headFreeBeforeTerminal = true;',
    async (module) => {
      const result = await runCase(module, makeDelivery, headPlan(true), { stream: true });
      return result.early.writes > 0 || result.requests.length !== headOn.requests.length
        || result.delivery.socket.text !== headOn.delivery.socket.text;
    },
  ));
  mutations.push(await mutation(
    'open-citation-retry-after-stream',
    'const citationRetryGateOpen = !streamedThisTurn;',
    'const citationRetryGateOpen = true;',
    async (module) => {
      const result = await runCase(
        module, makeDelivery, citationPlan(true), { stream: true, lexicalRoute: 'DEEN' },
      );
      return result.requests.length === 4
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
    "ctx.degraded.push('stream_withheld:head_text');",
    "ctx.degraded.push('stream_withheld:head_text:inverse');",
    async (module) => {
      const result = await runCase(module, makeDelivery, headPlan(), { stream: true });
      return result.delivery.socket.text !== headOn.delivery.socket.text
        || result.requests.length !== headOn.requests.length;
    },
  );
  for (const item of mutations) check(item.status === 'CAUGHT', `${item.name} was ${item.status}`);
  check(inverse.status === 'MISSED', `inverse control was ${inverse.status}, expected MISSED`);

  const allCases = [noHead, headOn, headOff, citation, cut];
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
  console.log(`NO_HEAD_STREAMED=${noHead.out.streamedThisTurn ? 'YES' : 'NO'} CALLS=${noHead.requests.length}`);
  console.log(`HEAD_EARLY_WRITES=${headOn.early.writes} HEAD_CALLS=${headOn.requests.length}`);
  console.log(`CITE_RETRY_AFTER_STREAM=${citation.requests.length > 3 ? 'YES' : 'NO'} EVIDENCE=${citation.out.evidence.length}`);
  console.log(`CUT_PREFIX_VALID=${cut.early.text && noHead.out.text.startsWith(cut.early.text) ? 'YES' : 'NO'}`);
  console.log(`CORPUS_PREFIX_COMPARISONS=${corpusPrefixComparisons}`);
  console.log(`EMITTED_NOT_PREFIX=${prefixFailures}`);
  console.log(`PROTOCOL_PAYLOAD_EARLY=${protocol.acceptedPrefix.includes('حمولة محجوبة') ? 'YES' : 'NO'}`);
  console.log(`CODE_SHAPE_PRESERVED=${code.oracle.includes('value = maybe') ? 'YES' : 'NO'}`);
  for (const item of mutations) console.log(`MUTANT ${item.status.padEnd(7)} ${item.name}`);
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
