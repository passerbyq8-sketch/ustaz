#!/usr/bin/env node
/**
 * STREAM-P3 §٥ — THE THREE CUTS, WHICH PHASE TWO NAMED AND DID NOT TEST.
 *
 * From the phase-two report's «ما لم يُفحَص», item 2: `callProviderStream` was never run
 * under a cut. The three shapes named there are the three shapes here.
 *
 *   NETWORK BREAK     the body's reader rejects part-way through
 *   SIGNAL ABORTED    the caller's AbortController fires mid-stream
 *   NO message_stop   the body simply ends, with no error anywhere
 *
 * ── WHAT IS BEING ASSERTED, AND WHY IT IS NOT «IT SHOULD NOT CRASH» ─────────────────
 * §٥'s rule is that a cut answer STAYS CUT, is ANNOUNCED as cut, and that nothing already
 * delivered is withdrawn. Those are three separate claims and they fail in different
 * places, so each is checked where it lives:
 *
 *   DELIVERED   every text delta that arrived before the cut reached `onText`, in order,
 *               once each. This is the text a reader already has.
 *   ANNOUNCED   a cut is distinguishable from a finish. The two throwing shapes announce
 *               themselves by throwing. The silent one does not throw, and the only thing
 *               that separates it from a completed answer is `stop_reason` being null —
 *               which is why lib/free-brain/loop.js now reads exactly that.
 *   NOT WITHDRAWN  a cut never un-delivers: `onText` is not called again, and the
 *               reconstructed payload never contradicts what was already handed over.
 *
 * ── AND ONE THING THIS GATE RECORDS RATHER THAN REPAIRS ─────────────────────────────
 * On the two THROWING shapes the partial text is lost to the caller: `callProviderStream`
 * throws and the text it already handed to `onText` is not carried out on the error. The
 * reader has those bytes; the turn does not. §٦/١ still holds — the writer's own prefix
 * check refuses to send a refusal on top of what went out — but the turn ends up shipping
 * less than the reader was shown. That is measured below under `partialLostToCaller` and
 * named in the report; it is not repaired here, because proving such a repair needs a
 * turn-level harness this repository does not have.
 */
'use strict';

const path = require('path');
const url = require('url');

const LOOP = path.join(__dirname, '..', '..', 'lib', 'free-brain', 'loop.js');

const encoder = new TextEncoder();
const frame = (event) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

const HEAD = [
  { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
];
const PIECES = ['الحمد لله. ', 'هذا جوابٌ قصير. ', 'وفيه جملةٌ ثالثة. '];
const TAIL = [
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 12 } },
  { type: 'message_stop' },
];

/**
 * A body whose reader yields the given frames and then does whatever `after` says.
 * Deliberately a hand-built ReadableStream and not a mock of `getReader`: the function
 * under test reads the real interface, decoder and all.
 */
function bodyOf(events, { breakAfter = null, endAfter = null } = {}) {
  let index = 0;
  return {
    getReader() {
      return {
        async read() {
          if (breakAfter !== null && index === breakAfter) throw new Error('socket hang up');
          if (endAfter !== null && index === endAfter) return { value: undefined, done: true };
          if (index >= events.length) return { value: undefined, done: true };
          const value = frame(events[index]);
          index += 1;
          return { value, done: false };
        },
      };
    },
  };
}

function textEvents() {
  return [...HEAD, ...PIECES.map((text) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }))];
}

async function run(callProviderStream, { events, readerOptions, abortAt = null }) {
  const controller = new AbortController();
  const delivered = [];
  let stubbedIndex = 0;
  const body = bodyOf(events, readerOptions);
  const realReader = body.getReader();
  const wrapped = {
    getReader: () => ({
      async read() {
        if (abortAt !== null && stubbedIndex === abortAt) {
          controller.abort();
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          throw error;
        }
        stubbedIndex += 1;
        return realReader.read();
      },
    }),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, body: abortAt === null ? body : wrapped });
  let payload = null;
  let threw = null;
  try {
    payload = await callProviderStream({
      providerUrl: 'https://example.invalid/v1/messages',
      headers: {},
      signal: controller.signal,
      body: { model: 'x', messages: [] },
      onText: (text) => delivered.push(text),
    });
  } catch (error) {
    threw = error;
  } finally {
    globalThis.fetch = originalFetch;
  }
  return { payload, threw, delivered };
}

async function main() {
  const { callProviderStream, truncatedFrom } = await import(url.pathToFileURL(LOOP).href);

  const cases = [];

  // A COMPLETE STREAM, as the control. Without it the three cuts prove nothing: a
  // function that always threw would «pass» every cut case below.
  {
    const r = await run(callProviderStream, { events: [...textEvents(), ...TAIL] });
    cases.push({
      name: 'control-complete-stream',
      delivered: r.delivered.join(''),
      threw: r.threw ? String(r.threw.message) : null,
      stopReason: r.payload ? (r.payload.stop_reason ?? null) : null,
      expect: {
        deliveredAll: true, threw: false, stopReason: 'end_turn', truncated: false,
      },
    });
  }

  // 1. NETWORK BREAK after two of the three text deltas.
  {
    const r = await run(callProviderStream, {
      events: textEvents(), readerOptions: { breakAfter: HEAD.length + 2 },
    });
    cases.push({
      name: 'network-break-mid-stream',
      delivered: r.delivered.join(''),
      threw: r.threw ? String(r.threw.message) : null,
      stopReason: r.payload ? (r.payload.stop_reason ?? null) : null,
      expect: { deliveredPrefix: PIECES.slice(0, 2).join(''), threw: true, noPayload: true },
    });
  }

  // 2. SIGNAL ABORTED after two of the three text deltas.
  {
    const r = await run(callProviderStream, {
      events: textEvents(), abortAt: HEAD.length + 2,
    });
    cases.push({
      name: 'signal-aborted-mid-stream',
      delivered: r.delivered.join(''),
      threw: r.threw ? String(r.threw.name || r.threw.message) : null,
      stopReason: r.payload ? (r.payload.stop_reason ?? null) : null,
      expect: { deliveredPrefix: PIECES.slice(0, 2).join(''), threw: true, noPayload: true },
    });
  }

  // 3. THE SILENT ONE. The body ends with no error and no message_stop.
  {
    const r = await run(callProviderStream, {
      events: textEvents(), readerOptions: { endAfter: HEAD.length + 2 },
    });
    cases.push({
      name: 'stream-ends-without-message-stop',
      delivered: r.delivered.join(''),
      threw: r.threw ? String(r.threw.message) : null,
      stopReason: r.payload ? (r.payload.stop_reason ?? null) : null,
      payloadText: r.payload ? (r.payload.content[0] && r.payload.content[0].text) || '' : null,
      expect: { deliveredPrefix: PIECES.slice(0, 2).join(''), threw: false, stopReason: null },
    });
  }

  let pass = true;
  const rows = [];
  for (const c of cases) {
    const e = c.expect;
    let ok = true;
    if (e.deliveredAll && c.delivered !== PIECES.join('')) ok = false;
    if (e.deliveredPrefix !== undefined && c.delivered !== e.deliveredPrefix) ok = false;
    if (e.threw === true && !c.threw) ok = false;
    if (e.threw === false && c.threw) ok = false;
    if (e.noPayload && c.stopReason !== null) ok = false;
    if (e.stopReason !== undefined && c.stopReason !== e.stopReason) ok = false;
    if (e.truncated !== undefined && truncatedFrom(c.stopReason) !== e.truncated) ok = false;
    // A cut never un-delivers: the reconstructed text, when there is one, must begin with
    // exactly what onText already handed over.
    if (c.payloadText !== undefined && c.payloadText !== null && c.payloadText !== c.delivered) ok = false;
    if (!ok) pass = false;
    rows.push({ ...c, ok });
  }

  console.log('THE THREE CUTS ON callProviderStream, plus a complete stream as control');
  console.log('');
  for (const r of rows) {
    console.log('  ' + (r.ok ? 'OK   ' : 'FAIL ') + r.name.padEnd(34));
    console.log('        delivered to onText : ' + JSON.stringify(r.delivered));
    console.log('        threw               : ' + (r.threw === null ? 'no' : r.threw));
    console.log('        stop_reason         : ' + JSON.stringify(r.stopReason)
      + '   truncatedFrom -> ' + JSON.stringify(truncatedFrom(r.stopReason)));
  }

  // ── WHAT THE CALLER LOSES ──────────────────────────────────────────────────
  const lost = rows.filter((r) => r.threw && r.delivered.length > 0);
  console.log('');
  console.log('partialLostToCaller: ' + lost.length + ' of ' + rows.length + ' shapes throw AFTER');
  console.log('  handing text to onText, and carry none of it out on the error. The reader has');
  console.log('  those bytes; the turn does not. Measured, named, and not repaired here.');
  for (const r of lost) console.log('    ' + r.name + ' -> ' + r.delivered.length + ' characters');

  // ── THE SILENT CUT IS THE ONE THE LOOP HAD TO LEARN TO SEE ─────────────────
  const silent = rows.find((r) => r.name === 'stream-ends-without-message-stop');
  const control = rows.find((r) => r.name === 'control-complete-stream');
  const distinguishable = silent.stopReason === null && control.stopReason === 'end_turn';
  console.log('');
  console.log('announced: a silent cut is distinguishable from a finish by stop_reason alone: '
    + (distinguishable ? 'YES' : 'NO'));
  console.log('  cut  -> ' + JSON.stringify(silent.stopReason)
    + '   finish -> ' + JSON.stringify(control.stopReason));
  console.log('  lib/free-brain/loop.js reads exactly this and rewrites the finish to');
  console.log('  "stream_cut", so truncatedFrom returns true and the answer footer is suppressed.');
  if (!distinguishable) pass = false;

  console.log('');
  console.log(pass ? 'GATE PASS' : 'GATE FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
