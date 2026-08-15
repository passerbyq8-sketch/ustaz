// guards/live-search-disclosure-guard.cjs — the line the reader gets when we could not look.
//
// WHAT THIS GUARDS. The live-world path is a fall-through by design: no key, no results, a blocked
// host, a page with no encodable card, an empty draft, a throw — every one leaves `worldPass` null
// and the request continues into the ordinary GEN route. That is correct, and api/ask.js records
// why. What was wrong is what the READER was told: «كم سعر صرف الدولار مقابل الدينار؟» with a
// failed search produced a confident answer out of the model's memory, in a voice indistinguishable
// from a live quote, with nothing saying that nothing had been looked up. Measured live by the
// owner.
//
// THE TWO CHECKS THAT MATTER ARE BOTH NEGATIVE, and they pull in opposite directions:
//   * section C drives a WORLD question whose search returns nothing and demands the line OPEN the
//     answer — remove the write from api/ask.js and it fails;
//   * section D drives an ORDINARY question and demands the line be ABSENT — widen the condition
//     to fire on every general answer and it fails.
// A gate with only the first would be passed by `writeText(NOTICE)` with no condition at all.
//
// Offline and deterministic. No network, no live model, no live Redis. The Anthropic key is a
// fake set for the duration of the drive: every HTTP call in this file is a stub.
//
// Usage: node guards/live-search-disclosure-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

(async function main() {
  console.log('=== live-search-disclosure-guard — what the reader is told when we could not look ===');

  const D = await esm('lib/policy/live-search-disclosure.js');
  const W = await esm('lib/world-intent.js');

  // =========================================================================
  console.log('\n=== A. THE SENTENCE ===');
  {
    const S = D.NO_LIVE_RESULTS_DISCLOSURE;
    ok('it exists and is a non-empty string', typeof S === 'string' && S.trim().length > 0);
    ok('it is ONE line — the answer opens with a line, not a paragraph',
      !S.includes('\n'), JSON.stringify(S));
    ok('it is Arabic', /[؀-ۿ]/.test(S));
    ok('it says no live results were found',
      /لم أعثرْ|لم أعثر/.test(S) && /نتائجِ بحثٍ|نتائج بحث/.test(S), S);
    ok('...and that what follows is general knowledge that may be out of date',
      /عامّةٌ|عامة/.test(S) && /محدَّثة|محدثة/.test(S), S);
    // It introduces an answer; it must not withdraw it. Same rule as referral-tail.js.
    ok('it does not apologise for, or retract, the answer it introduces',
      !/آسف|أعتذر|لا أستطيع|لا يمكنني/.test(S), S);
  }

  // =========================================================================
  // BOTH DIRECTIONS OF THE DECISION, without a handler, a socket or a model.
  console.log('\n=== B. liveSearchNotice() — THE FOUR COMBINATIONS ===');
  {
    eq('world wanted, nothing live  -> the line',
      D.liveSearchNotice({ worldWanted: true, answeredFromLive: false }), D.NO_LIVE_RESULTS_DISCLOSURE);
    eq('world wanted, answered live -> nothing',
      D.liveSearchNotice({ worldWanted: true, answeredFromLive: true }), '');
    eq('no world wanted, nothing live -> nothing',
      D.liveSearchNotice({ worldWanted: false, answeredFromLive: false }), '');
    eq('no world wanted, answered live -> nothing',
      D.liveSearchNotice({ worldWanted: false, answeredFromLive: true }), '');
    eq('called with nothing at all -> nothing, not a crash', D.liveSearchNotice(), '');
    ok('it returns a string in every case, never null — a caller may concatenate it blind',
      [undefined, {}, { worldWanted: true }, { worldWanted: false }]
        .every((a) => typeof D.liveSearchNotice(a) === 'string'));
  }

  // =========================================================================
  // THE DRIVEN CASES. One harness, three questions, one difference between them.
  const DEVICE = 'dev-lsd-000001';
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');

  // ── THE ENV MUST BE SET BEFORE THE TOKEN IS MINTED ────────────────────────
  // founderTokenFor() signs with FOUNDER_SECRET, so minting first produces a token the handler
  // cannot verify — and guardDayCap() then fails CLOSED on an unreachable store and answers 429
  // before a single line of the route under test runs. A valid founder token is what skips the
  // cap (lib/daycap.js: `reason: 'founder'`), which is why this ordering is load-bearing and not
  // housekeeping.
  const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevLedger = process.env.LEDGER_RAG;
  const prevMode = process.env.RFC_V05_MODE;
  const prevSecret = process.env.FOUNDER_SECRET;
  const prevBrave = process.env.BRAVE_API_KEY;
  process.env.FOUNDER_SECRET = 'test-secret-for-the-live-search-gate';
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
  process.env.BRAVE_API_KEY = 'test-brave-not-a-credential';
  // The ledger path would intercept before GEN; this gate is about the GEN fall-through.
  process.env.LEDGER_RAG = 'off';
  process.env.RFC_V05_MODE = 'off';
  STORE.__setRedisForTest(null);

  const founder = DC.founderTokenFor(DEVICE);

  const makeRes = () => ({
    writes: [], ended: 0,
    status() { return this; }, setHeader() { return this; }, flushHeaders() {},
    write(s) { this.writes.push(String(s)); return true; },
    end() { this.ended += 1; return this; },
    json(o) { this.jsonBody = o; this.ended += 1; return this; },
  });
  const makeReq = (text) => ({
    method: 'POST',
    headers: {
      'x-murabbi-device': DEVICE,
      'x-murabbi-founder': founder,
      'x-ezik-ai-consent': '2026-08-06-1',
    },
    body: { system: 'أنت عزك', age: 25, band: 'adult', messages: [{ role: 'user', content: text }] },
  });
  // SPLIT ON THE FRAME SEPARATOR, NOT ON «data: ». Splitting on the prefix leaves the NEXT frame's
  // `event:` line glued to the end of the previous frame's JSON, so JSON.parse throws and the
  // delta is silently dropped — which reads exactly like a handler that emitted nothing. That cost
  // a debugging pass here; the handler had been writing the draft correctly the whole time.
  const readerText = (res) => res.writes.join('')
    .split('\n\n').filter((f) => f.trim())
    .map((f) => {
      const line = f.split('\n').find((l) => l.trim().startsWith('data:'));
      if (!line) return null;
      try { return JSON.parse(line.trim().slice(5).trim()); } catch { return null; }
    })
    .filter((p) => p && p.type === 'content_block_delta')
    .map((p) => p.delta.text).join('');
  const jsonRes = (o) => ({
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => o, text: async () => JSON.stringify(o),
  });

  const MODEL_DRAFT = 'سعرُ الصرفِ يتغيّرُ بين حينٍ وآخر، ويُرجَعُ فيه إلى الجهةِ الرسميّة.';

  // `braveResults` is the ONLY difference between the firing and non-firing world drives.
  const drive = async (question, { braveResults = [] } = {}) => {
    const state = { prompts: [], streamed: 0 };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('api.anthropic.com')) {
        const b = JSON.parse(init.body);
        const last = b.messages[b.messages.length - 1];
        const txt = typeof last.content === 'string' ? last.content : '';
        state.prompts.push(JSON.stringify(b.system || '') + '\n' + txt);
        // The route classifier round: short, and asks for one of two words.
        if (/GEN|DEEN/.test(txt) && txt.length < 400) {
          return jsonRes({ content: [{ type: 'text', text: 'GEN' }], stop_reason: 'end_turn' });
        }
        if (b.stream) {
          state.streamed += 1;
          const frames = [
            'event: content_block_delta\ndata: ' + JSON.stringify({
              type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: MODEL_DRAFT },
            }) + '\n\n',
            'event: message_stop\ndata: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
          ];
          let i = 0;
          return {
            ok: true, status: 200,
            headers: { get: () => 'text/event-stream' },
            body: {
              getReader: () => ({
                read: async () => (i < frames.length
                  ? { done: false, value: new TextEncoder().encode(frames[i++]) }
                  : { done: true, value: undefined }),
                releaseLock() {}, cancel: async () => {},
              }),
            },
          };
        }
        return jsonRes({ content: [{ type: 'text', text: MODEL_DRAFT }], stop_reason: 'end_turn' });
      }
      if (u.includes('api.search.brave.com')) return jsonRes({ web: { results: braveResults } });
      return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
    };
    try {
      const res = makeRes();
      await (await esm('api/ask.js')).default(makeReq(question), res);
      return { text: readerText(res), res, state };
    } finally {
      globalThis.fetch = realFetch;
    }
  };

  const NOTICE = D.NO_LIVE_RESULTS_DISCLOSURE;
  let world, plain;
  try {
    // ── C. THE FIRING CASE ────────────────────────────────────────────────
    const Q_WORLD = 'كم سعر صرف الدولار مقابل الدينار؟';
    world = await drive(Q_WORLD, { braveResults: [] });

    console.log('\n=== C. A WORLD QUESTION WITH NO USABLE LIVE RESULTS ===');
    ok('the fixture really is a world question',
      W.classifyWorldIntent(Q_WORLD).world === true,
      JSON.stringify(W.classifyWorldIntent(Q_WORLD)));
    ok("the reader got an answer at all", world.text.trim().length > 0, world.text.slice(0, 120));
    ok('the answer contains the disclosure', world.text.includes(NOTICE), world.text.slice(0, 240));
    ok('...and OPENS with it — it is the first thing the reader reads',
      world.text.trimStart().startsWith(NOTICE), JSON.stringify(world.text.slice(0, 160)));
    eq('...exactly once', world.text.split(NOTICE).length - 1, 1);
    ok('...and the model\'s own answer still follows it',
      world.text.includes(MODEL_DRAFT), world.text.slice(0, 240));
    ok('the answer was streamed, so the line went out ahead of the model\'s bytes',
      world.state.streamed === 1, 'streamed=' + world.state.streamed);

    // SERVER-OWNED. A line the model is asked to write is a line the model can decline to write.
    ok('the disclosure was never asked of the model — it is a server write',
      world.state.prompts.every((p) => !p.includes(NOTICE)));

    // ── D. THE NON-FIRING CASE ────────────────────────────────────────────
    const Q_PLAIN = 'كيف أنظم وقتي في المذاكرة؟';
    plain = await drive(Q_PLAIN, { braveResults: [] });

    console.log('\n=== D. AN ORDINARY QUESTION GETS NO LINE ===');
    ok('the fixture really is NOT a world question',
      W.classifyWorldIntent(Q_PLAIN).world === false,
      JSON.stringify(W.classifyWorldIntent(Q_PLAIN)));
    ok("the reader got an answer", plain.text.trim().length > 0, plain.text.slice(0, 120));
    ok('NO disclosure anywhere in it', !plain.text.includes(NOTICE), plain.text.slice(0, 240));
    ok('...not even a fragment of it',
      !/لم أعثرْ على نتائجِ بحثٍ حيّة/.test(plain.text), plain.text.slice(0, 240));
    ok('the ordinary answer is otherwise untouched',
      plain.text.trim() === MODEL_DRAFT.trim(), JSON.stringify(plain.text));
  } finally {
    if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey; else delete process.env.ANTHROPIC_API_KEY;
    if (prevLedger === undefined) delete process.env.LEDGER_RAG; else process.env.LEDGER_RAG = prevLedger;
    if (prevMode === undefined) delete process.env.RFC_V05_MODE; else process.env.RFC_V05_MODE = prevMode;
    if (prevSecret === undefined) delete process.env.FOUNDER_SECRET; else process.env.FOUNDER_SECRET = prevSecret;
    if (prevBrave === undefined) delete process.env.BRAVE_API_KEY; else process.env.BRAVE_API_KEY = prevBrave;
    STORE.__resetRedis();
  }

  // =========================================================================
  console.log('\n=== E. WIRING ===');
  {
    const ASK = read('api/ask.js');
    ok('gates.json lists this guard', /live-search-disclosure-guard\.cjs/.test(read('gates.json')));
    ok('api/ask.js imports the module', /from '\.\.\/lib\/policy\/live-search-disclosure\.js'/.test(ASK));
    ok('the notice is decided by worldIntent.world, not by a second copy of the classifier',
      /liveSearchNotice\(\{[\s\S]{0,80}worldWanted: worldIntent\.world/.test(ASK));
    const prefixAt = ASK.indexOf("finalizerContext.readerPrefix = [presenceLead, liveNotice].filter(Boolean).join('\\n\\n')");
    const readLoopAt = ASK.indexOf('while (true) {', prefixAt);
    ok('the notice is server-owned finalizer context before upstream replay',
      prefixAt >= 0 && readLoopAt > prefixAt,
      'the notice must be composed by the finalizer, never written as an early delta');
    ok('the sentence itself lives in the policy module, not inlined in the handler',
      !ASK.includes(D.NO_LIVE_RESULTS_DISCLOSURE));
  }

  // =========================================================================
  console.log('\n=== F. F-116 — BOTH SPOKEN ANSWER RELAYS CARRY THE SAME DISCLOSURE ===');
  {
    const askVoice = (await esm('api/ask.js')).default;
    const retiredChat = (await esm('api/chat.js')).default;
    const retiredFast = (await esm('api/chat-fast.js')).default;
    const voiceSources = [read('api/chat.js'), read('api/chat-fast.js')];
    ok('both former voice relays are explicit /api/ask tombstones',
      voiceSources.every((s) => /status\(410\)/.test(s)
        && /RETIRED_CHAT_REPLACEMENT = '\/api\/ask'/.test(s)));
    ok('neither retired relay contains a second live-search policy',
      voiceSources.every((s) => !/liveSearchNotice|classifyWorldIntent/.test(s)));
    ok('neither retired relay inlines the disclosure sentence', voiceSources.every((s) => !s.includes(NOTICE)));

    const oldSecret = process.env.FOUNDER_SECRET;
    const oldKey = process.env.ANTHROPIC_API_KEY;
    const realFetch = globalThis.fetch;
    process.env.FOUNDER_SECRET = 'voice-live-search-local-secret';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
    const voiceDevice = 'voice-live-search-device';
    const voiceFounder = DC.founderTokenFor(voiceDevice);
    const VOICE_DRAFT = 'جواب المزود كما وصل.';
    const UPSTREAM_WIRE = 'data: ' + JSON.stringify({
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: VOICE_DRAFT },
    }) + '\n\n' + 'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';
    const decode = (v) => {
      if (typeof v === 'string') return v;
      if (Buffer.isBuffer(v)) return v.toString('utf8');
      if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('utf8');
      return String(v);
    };
    const voiceRes = () => ({
      code: 0, statusCode: 200, headers: {}, writes: [], ended: 0,
      status(c) { this.code = c; this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[k] = v; return this; }, flushHeaders() {},
      write(v) { this.writes.push(decode(v)); return true; },
      end(v) { if (v !== undefined) this.writes.push(decode(v)); this.ended++; return this; },
      json(v) { this.jsonBody = v; this.ended++; return this; },
    });
    const voiceReq = (question, extra = {}) => ({
      method: 'POST',
      headers: {
        'x-real-ip': '127.0.0.1', 'x-murabbi-device': voiceDevice,
        'x-murabbi-founder': voiceFounder, 'x-ezik-ai-consent': '2026-08-06-1',
      },
      body: Object.assign({
        max_tokens: 4096, stream: true, system: 'ignored by the server', age: 25, band: 'adult',
        messages: [{ role: 'user', content: question }],
      }, extra),
    });
    const voiceText = (res) => readerText(res);
    const driveVoice = async (route, question, extra) => {
      let anthropicCalls = 0, sentBody = null;
      globalThis.fetch = async (url, init) => {
        if (!String(url).includes('api.anthropic.com')) throw new Error('offline limiter fixture');
        anthropicCalls++;
        sentBody = JSON.parse(init.body);
        let sent = false;
        return {
          ok: true, status: 200, text: async () => '',
          json: async () => ({ content: [{ type: 'text', text: VOICE_DRAFT }] }),
          body: { getReader: () => ({ read: async () => (sent ? { done: true }
            : (sent = true, { done: false, value: new Uint8Array(Buffer.from(UPSTREAM_WIRE, 'utf8')) })) }) },
        };
      };
      const res = voiceRes();
      await route(voiceReq(question, extra), res);
      return { res, raw: res.writes.join(''), text: voiceText(res), anthropicCalls, sentBody };
    };

    try {
      const Q_WORLD = 'كم سعر صرف الدولار مقابل الدينار؟';
      const Q_PLAIN = 'كيف أنظم وقتي في المذاكرة؟';
      for (const [name, route] of [['ask-voice', askVoice]]) {
        const live = await driveVoice(route, Q_WORLD);
        ok(name + ': a live-world voice turn keeps one provider call', live.anthropicCalls === 1,
          'calls=' + live.anthropicCalls);
        ok(name + ': the spoken output opens with the shared disclosure',
          live.text.startsWith(NOTICE + '\n\n'), JSON.stringify(live.text));
        eq(name + ': the shared disclosure occurs exactly once', live.text.split(NOTICE).length - 1, 1);
        ok(name + ': the model draft follows the disclosure', live.text.endsWith(VOICE_DRAFT),
          JSON.stringify(live.text));
        ok(name + ': the disclosure was not put in the model prompt',
          !JSON.stringify(live.sentBody).includes(NOTICE));

        const plainVoice = await driveVoice(route, Q_PLAIN);
        ok(name + ': a non-live voice turn keeps one provider call', plainVoice.anthropicCalls === 1,
          'calls=' + plainVoice.anthropicCalls);
        eq(name + ': a non-live voice response preserves the provider text after central finalization',
          plainVoice.text, VOICE_DRAFT);

        const childLive = await driveVoice(route, Q_WORLD, { age: 7, band: 'young' });
        ok(name + ': the child floor still uses one provider call', childLive.anthropicCalls === 1,
          'calls=' + childLive.anthropicCalls);
        ok(name + ': the child safety floor returns non-empty counsel before any disclosure contract',
          childLive.text.trim().length > 0, JSON.stringify(childLive.text));
      }

      for (const [name, route] of [['chat', retiredChat], ['chat-fast', retiredFast]]) {
        const retired = await driveVoice(route, Q_WORLD, { max_tokens: 8 });
        ok(name + ' remains retired without a provider call',
          retired.res.statusCode === 410 && retired.anthropicCalls === 0,
          'status=' + retired.res.statusCode + ' calls=' + retired.anthropicCalls);
        eq(name + ' points stale callers to /api/ask', retired.res.jsonBody?.replacement, '/api/ask');
      }
    } finally {
      globalThis.fetch = realFetch;
      if (oldSecret === undefined) delete process.env.FOUNDER_SECRET;
      else process.env.FOUNDER_SECRET = oldSecret;
      if (oldKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = oldKey;
    }
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('live-search-disclosure-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
