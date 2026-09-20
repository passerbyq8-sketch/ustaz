// tools/ask-sequence-probe.cjs — DOES THE SECOND QUESTION IN A FAST PAIR COLLAPSE?
//
// ── THE MEASUREMENT THIS ANSWERS ────────────────────────────────────────────
// Twice on the preview the reader was handed «تعذَّر توليدُ الجوابِ الآن…» and the platform log
// carried twenty `info` entries and not one `warn` or `error`. Both times it was the SECOND
// question of a fast pair (الروبل بعد الين · القمح بعد الدرهم) and both times the same question
// answered normally when it was sent again on its own. That is a hypothesis about SEQUENCE, and a
// hypothesis is not a finding: this file drives the real api/ask.js handler in-process, twice,
// with no gap between the two requests, and reads what the second reader would have seen.
//
// ── WHY IN-PROCESS AND NOT AGAINST THE DEPLOYMENT ───────────────────────────
// A live pair costs two model calls, two Brave calls and a day-cap write, and it cannot be
// repeated enough times to tell a collapse from a coincidence. Every outbound call here is a
// stub: no key, no provider, no deployment, no store. What is REAL is the handler, the free-brain
// loop, the finalizer, the empty-answer wrapper and the departure signal — which is the whole of
// the machinery a collapse could be hiding in.
//
// ── THE FOUR SHAPES ─────────────────────────────────────────────────────────
//   S4  a single request on its own, as the control
//   S1  two requests, strictly one after the other, with no delay at all
//   S2  two requests OVERLAPPING — the second starts before the first has ended
//   S3  the same overlap, and then the FIRST reader leaves (the `close` event) mid-flight
//   S5  the second request as it REALLY arrives — carrying the first question and its answer in
//       `messages`, which is the only thing a second-in-pair turn has that a lone one does not
//   S6  the second request with `req.signal` aborting the instant its body is complete, which is
//       the node-24 shape deriveReaderDepartureSignal() exists to discriminate
//
// It is a MEASUREMENT, not a gate: it is not in gates.json, it asserts nothing, and it prints
// what it saw.
//
//   node tools/ask-sequence-probe.cjs
//
'use strict';

const path = require('path');

const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

// Every line printed here is ASCII: an Arabic string on a Windows console is mojibake, not
// evidence. Arabic is compared inside the process and reported as a verdict.
const esc = (v) => Array.from(String(v === undefined || v === null ? '' : v))
  .map((c) => (c.codePointAt(0) < 128 ? c : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')))
  .join('');

const DEVICE = 'dev-seqprobe-01';

function makeRes() {
  const listeners = new Map();
  return {
    writes: [], ended: 0, statusCode: 0, headers: {}, destroyed: false,
    writableEnded: false, closed: false,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = String(v); return this; },
    flushHeaders() {},
    write(s) {
      this.writes.push(typeof s === 'string' ? s
        : Buffer.from(s.buffer || s, s.byteOffset || 0, s.byteLength || s.length).toString('utf8'));
      return true;
    },
    // Node semantics, because the writer calls `end(callback)`: a function argument is the
    // completion callback and not a final chunk. A double that writes it as a chunk both
    // corrupts the body and hangs the writer, which then never records the end at all.
    end(...args) {
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      if (args[0]) this.write(args[0]);
      this.ended += 1; this.writableEnded = true; this.closed = true;
      if (cb) setImmediate(cb);
      return this;
    },
    json(o) { this.jsonBody = o; this.ended += 1; return this; },
    once(ev, fn) { listeners.set(ev, [...(listeners.get(ev) || []), fn]); return this; },
    on(ev, fn) { return this.once(ev, fn); },
    removeListener() { return this; },
    emit(ev) { for (const fn of listeners.get(ev) || []) { try { fn(); } catch { /* a listener may not break the probe */ } } },
  };
}

const readerText = (res) => res.writes.join('')
  .split('\n\n').filter((f) => f.trim())
  .map((f) => {
    const line = f.split('\n').find((l) => l.trim().startsWith('data:'));
    if (!line) return null;
    try { return JSON.parse(line.trim().slice(5).trim()); } catch { return null; }
  })
  .filter((p) => p && p.type === 'content_block_delta' && p.delta && p.delta.type === 'text_delta')
  .map((p) => p.delta.text).join('');

const jsonRes = (o) => ({
  ok: true, status: 200,
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => o, text: async () => JSON.stringify(o),
});

// ── THE STUB PROVIDER ────────────────────────────────────────────────────────
// One model answer, written the way a live-number answer that PASSES the print contract is
// written: the source and the absolute date inside the same sentence as the figure.
const DRAFT = 'بحسبِ الجزيرةِ نت في ٢٠ سبتمبر ٢٠٢٦: بلغَ سعرُ صرفِ الروبلِ الروسيِّ ٠٫٢٧ فلسًا كويتيًّا.';
// The positive control's draft: markup and nothing else, the shape of loop.js's L8.
const SILENT_DRAFT = '<hadith>لا وضوء لمن لم يذكر اسم الله عليه</hadith>';

function installStubFetch(state) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('api.anthropic.com')) {
      state.modelCalls += 1;
      // ── THE POSITIVE CONTROL ────────────────────────────────────────────
      // A probe that only ever shows green proves that it cannot see, not that nothing is wrong.
      // With `state.silent` set, the provider returns a well-formed 200 with NO text block —
      // which is the E4 shape lib/free-brain/tools.js measured when adaptive thinking spent the
      // whole output budget — and the collapse this file is hunting is produced on demand.
      // A round with NO TEXT BLOCK is not enough on its own — the reviewer's last rung returns an
      // explicit Arabic sentence for an empty proposal, which is why lib/free-brain/loop.js:49
      // calls FREE_BRAIN_EMPTY unreachable. The shape that DOES reach it is the loop's own L8:
      // prose that is nothing but card markup, which the delivery filter empties on purpose,
      // because «لا نثرَ ألبتّة» is no answer rather than a short one.
      if (state.silent) {
        return jsonRes({
          content: [{ type: 'text', text: SILENT_DRAFT }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 20 },
        });
      }
      let b = {};
      try { b = JSON.parse(init.body); } catch { b = {}; }
      const list = Array.isArray(b.messages) ? b.messages : [];
      const last = list[list.length - 1];
      const txt = last && typeof last.content === 'string' ? last.content : '';
      if (/GEN|DEEN/.test(txt) && txt.length < 400) {
        return jsonRes({ content: [{ type: 'text', text: 'GEN' }], stop_reason: 'end_turn' });
      }
      return jsonRes({
        content: [{ type: 'text', text: DRAFT }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      });
    }
    if (u.includes('api.search.brave.com')) {
      state.braveCalls += 1;
      return jsonRes({ web: { results: [] } });
    }
    return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
  };
  return () => { globalThis.fetch = real; };
}

(async function main() {
  console.log('=== ask-sequence-probe — does the second of a fast pair collapse? ===');

  const prev = {};
  for (const k of ['ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET', 'LEDGER_RAG',
    'RFC_V05_MODE', 'FREE_BRAIN_V1', 'LIVE_WORLD_V2', 'STREAM_V1']) prev[k] = process.env[k];
  process.env.FOUNDER_SECRET = 'probe-secret-not-a-credential';
  process.env.ANTHROPIC_API_KEY = 'probe-key-not-a-credential';
  process.env.BRAVE_API_KEY = 'probe-brave-not-a-credential';
  process.env.LEDGER_RAG = 'off';
  process.env.RFC_V05_MODE = 'off';
  process.env.FREE_BRAIN_V1 = 'on';
  process.env.STREAM_V1 = 'off';

  // The flag's NAME comes from the module that owns it rather than being spelt a second time
  // here — lib/live-world-v2.js exports it for exactly this, and
  // guards/live-world-v2-killswitch-guard.cjs counts the files that spell it.
  const { LIVE_WORLD_V2_FLAG } = await esm('lib/live-world-v2.js');
  process.env[LIVE_WORLD_V2_FLAG] = 'on';
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');
  STORE.__setRedisForTest(null);
  const founder = DC.founderTokenFor(DEVICE);
  const EA = await esm('lib/empty-answer.js');
  const APOLOGY = EA.EMPTY_ANSWER_APOLOGY;
  const handler = (await esm('api/ask.js')).default;

  const makeReq = (textOrTurns, opts = {}) => {
    const messages = Array.isArray(textOrTurns)
      ? textOrTurns
      : [{ role: 'user', content: textOrTurns }];
    const req = {
      method: 'POST', complete: true,
      headers: {
        'x-murabbi-device': DEVICE,
        'x-murabbi-founder': founder,
        'x-ezik-ai-consent': '2026-08-06-1',
      },
      body: { system: 'أنت عزك', age: 25, band: 'adult', messages },
    };
    // The node-24 shape: `req.signal` is tied to the request STREAM, so it aborts as soon as the
    // body has been read — on a response that is still live. Already aborted at entry is the
    // worst case of it, and it is the one a fast second request is likeliest to arrive in.
    if (opts.signalAborted) {
      const c = new AbortController();
      c.abort();
      req.signal = c.signal;
    }
    return req;
  };
  // The writer queues its frames, so a response can still be finishing when the handler's promise
  // resolves. Reading before the queue drains measures the probe, not the handler.
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  const state = { modelCalls: 0, braveCalls: 0, silent: false };
  const restore = installStubFetch(state);

  const verdict = (label, res) => {
    const text = readerText(res);
    const apologised = text.includes(APOLOGY);
    console.log('  ' + label
      + '  chars=' + String(text.length).padStart(4, ' ')
      + '  ended=' + res.ended
      + '  status=' + res.statusCode
      + '  APOLOGY=' + (apologised ? 'YES' : 'no ')
      + '  head=' + esc(text.slice(0, 48)));
    return { text, apologised };
  };

  const Q1 = 'كم سعر صرف الين الياباني مقابل الدينار اليوم؟';
  const Q2 = 'كم سعر صرف الروبل الروسي مقابل الدينار اليوم؟';

  try {
    console.log('\n--- S4 · the control: one request on its own ---');
    { const r = makeRes(); await handler(makeReq(Q2), r); await settle(); verdict('single   ', r); }

    console.log('\n--- S1 · two requests, strictly back to back, no gap ---');
    {
      const a = makeRes(); await handler(makeReq(Q1), a); await settle(); verdict('first    ', a);
      const b = makeRes(); await handler(makeReq(Q2), b); await settle(); verdict('second   ', b);
    }

    console.log('\n--- S2 · two requests OVERLAPPING in one process ---');
    {
      const a = makeRes(); const b = makeRes();
      const pa = handler(makeReq(Q1), a);
      const pb = handler(makeReq(Q2), b);
      await Promise.all([pa, pb]); await settle();
      verdict('first    ', a); verdict('second   ', b);
    }

    console.log('\n--- S3 · overlapping, and the FIRST reader leaves mid-flight ---');
    {
      const a = makeRes(); const b = makeRes();
      const pa = handler(makeReq(Q1), a);
      const pb = handler(makeReq(Q2), b);
      a.closed = true; a.emit('close');
      await Promise.all([pa, pb]); await settle();
      verdict('first    ', a); verdict('second   ', b);
    }

    console.log('\n--- S5 · the second as it really arrives: the pair inside `messages` ---');
    {
      const a = makeRes(); await handler(makeReq(Q1), a); await settle(); verdict('first    ', a);
      const b = makeRes();
      await handler(makeReq([
        { role: 'user', content: Q1 },
        { role: 'assistant', content: readerText(a) },
        { role: 'user', content: Q2 },
      ]), b);
      await settle();
      verdict('second   ', b);
    }

    console.log('\n--- S6 · the second with req.signal already aborted (finished body) ---');
    {
      const a = makeRes(); await handler(makeReq(Q1), a); await settle(); verdict('first    ', a);
      const b = makeRes();
      await handler(makeReq(Q2, { signalAborted: true }), b);
      await settle();
      verdict('second   ', b);
    }

    console.log('\n--- S7 · the positive control: a provider round with no text block at all ---');
    console.log('    (the [free-brain/empty] line below is the record §١ asked for)');
    {
      state.silent = true;
      const r = makeRes();
      await handler(makeReq(Q2), r);
      await settle();
      verdict('silent   ', r);
      state.silent = false;
    }

    console.log('\n  model calls=' + state.modelCalls + '  brave calls=' + state.braveCalls);
  } finally {
    restore();
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
    }
  }
}()).catch((e) => { console.error('PROBE THREW:', e); process.exit(1); });
