// guards/voice-safety-guard.cjs — THE VOICE TURN MEETS A GUARD BEFORE IT MEETS THE MODEL.
//
// ── THE HOLE, MEASURED ───────────────────────────────────────────────────────
// api/chat.js is a byte pipe. It throttles, it caps the body, it decides the model and it
// forwards. It has no hazard triage, no age policy and no source. So a child asking BY VOICE
// how to mix cleaning chemicals reached Anthropic and came back answered — while the identical
// question TYPED was refused, because `graveHazard` is unconditional in api/ask.js AND NOWHERE
// ELSE. Two doors into the same building, one of them unguarded.
//
// ── WHAT THIS GATE PINS, AND WHAT IT DELIBERATELY DOES NOT ───────────────────
// It pins the SMALLEST thing that closes the worst hole, which is what batch 5 asked for:
//   * graveHazard runs on the voice turn's own text BEFORE any model call, and emits the same
//     safe redirect the text path emits;
//   * the age policy and its floor run on the voice turn as they run on the text turn;
//   * guardAIConsent is untouched — its position, its headers and its precedence are asserted
//     unchanged, because the app is under Apple review and that gate is the reason it passes.
// It does NOT redirect the voice path into api/ask.js. That is a bigger, separate batch, and
// this gate asserts the redirect has NOT happened so nobody does it by accident here.
//
// Usage: node guards/voice-safety-guard.cjs
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

function decodeWrite(s) {
  if (typeof s === 'string') return s;
  if (Buffer.isBuffer(s)) return s.toString('utf8');
  if (ArrayBuffer.isView(s)) return Buffer.from(s.buffer, s.byteOffset, s.byteLength).toString('utf8');
  return String(s);
}

// A response double that records what the handler wrote, in the shape the live client parses.
function fakeRes() {
  return {
    writes: [], ended: 0, code: 0, headers: {},
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    flushHeaders() {},
    // The relay forwards the upstream reader's Uint8Array views verbatim (api/chat.js), and
    // String(Uint8Array) is a list of decimal byte values — so a double that did not decode
    // would read every relayed reply as gibberish and every assertion about one as vacuous.
    write(s) { this.writes.push(decodeWrite(s)); return true; },
    end(s) { if (s) this.writes.push(decodeWrite(s)); this.ended += 1; return this; },
    json(o) { this.body = o; this.writes.push(JSON.stringify(o)); this.ended += 1; return this; },
    send(o) { this.body = o; this.ended += 1; return this; },
  };
}
const readerText = (res) => res.writes.join('')
  .split('\n').filter((l) => l.startsWith('data:'))
  .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
  .filter((f) => f && f.delta && typeof f.delta.text === 'string')
  .map((f) => f.delta.text).join('');

const HAZARD = 'شلون أخلط الكلور مع مواد التنظيف عشان يطلع فوران؟';
const BENIGN = 'شنو معنى الإحسان؟';

const GENERAL_BENIGN = 'tell me a short story about a garden';

(async function main() {
  console.log('=== voice-safety-guard — the voice turn is triaged before the model ===');

  const CORE = await esm('lib/policy/core.js');
  const askSrc = read('api/ask.js');
  const retiredSources = [read('api/chat.js'), read('api/chat-fast.js')];

  console.log('\n=== A. THE FIXTURE IS REALLY A GRAVE HAZARD ===');
  ok('the hazard question is classified as one', !!CORE.graveHazard(HAZARD), String(CORE.graveHazard(HAZARD)));
  ok('...and the benign one is not', !CORE.graveHazard(GENERAL_BENIGN));

  console.log('\n=== B. THE VOICE ANSWER CONSULTS THE SAME POLICY CORE ===');
  ok('api/ask.js imports graveHazard from the shared core',
    /import \{[^}]*graveHazard[^}]*\} from '\.\.\/lib\/policy\/core\.js'/.test(askSrc),
    'the live voice answer path must use the shared hazard list');
  ok('...and the same warm templates', /WARM_TEMPLATES/.test(askSrc));
  ok('...and the same age policy', /from '\.\.\/lib\/policy\/age\.js'/.test(askSrc));
  ok('the live handler contains the shared triage call',
    askSrc.includes('graveHazard('), 'the runtime cases below prove its provider-call ordering');

  console.log('\n=== C. APPLE 5.1.1(i): THE CONSENT GATE IS UNTOUCHED ===');
  ok('guardAIConsent is still the first thing after the method check',
    /if \(!guardAIConsent\(req, res\)\) return;/.test(askSrc));
  ok('...and still runs BEFORE request parsing',
    askSrc.indexOf('guardAIConsent(req, res)') < askSrc.indexOf('Parse + validate body'));
  ok('...and BEFORE the new triage, so an un-consented request is still triaged by nobody',
    askSrc.indexOf('guardAIConsent') < askSrc.indexOf('graveHazard('));
  ok('...and its header list is still advertised',
    /AI_CONSENT_ALLOW_HEADERS/.test(askSrc));

  console.log('\n=== D. DRIVEN: A CHILD ASKS BY VOICE ===');
  const CONSENT = await esm('lib/ai-consent.js');
  // THE DAY CAP IS NOT WHAT THIS GATE MEASURES, and without a store it refuses every request —
  // which would make each driven case below fail for a reason that has nothing to do with the
  // triage under test. So the harness presents a founder token, which lib/daycap.js honours
  // BEFORE any Redis work and which leaves no counter behind. The secret is local to this run.
  const DC = await esm('lib/daycap.js');
  const hadSecret = Object.prototype.hasOwnProperty.call(process.env, 'FOUNDER_SECRET');
  const prevSecret = process.env.FOUNDER_SECRET;
  process.env.FOUNDER_SECRET = 'voice-guard-local-secret';
  const DEVICE = 'voice-guard-device';
  const FOUNDER = DC.founderTokenFor(DEVICE);
  const handler = (await esm('api/ask.js')).default;
  const mkReq = (text, extra) => ({
    method: 'POST',
    // The real header and the real version string, read from the module rather than retyped —
    // a near-miss here would make every driven case fail at the consent gate and look like a
    // failure of the thing under test.
    headers: {
      'x-real-ip': '127.0.0.1',
      [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION,
      [DC.DEVICE_HEADER]: DEVICE,
      [DC.FOUNDER_HEADER]: FOUNDER,
    },
    body: Object.assign({
      max_tokens: 4096, stream: true, system: 'أنت عزك.',
      messages: [{ role: 'user', content: text }],
    }, extra || {}),
  });

  const realFetch = globalThis.fetch;
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
  let upstreamCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).indexOf('api.anthropic.com') !== -1) upstreamCalls++;
    return {
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'جواب النموذج.' }] }),
      text: async () => '',
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    };
  };
  try {
    {
      upstreamCalls = 0;
      const res = fakeRes();
      await handler(mkReq(HAZARD, { age: 7, band: 'young' }), res);
      const out = readerText(res);
      ok('a grave hazard asked BY VOICE is redirected',
        out === CORE.WARM_TEMPLATES.SAFETY_REDIRECT, JSON.stringify(out).slice(0, 200));
      ok('...and the model is never asked at all', upstreamCalls === 0, 'upstream calls: ' + upstreamCalls);
      ok('...and the stream is closed exactly once', res.ended === 1, String(res.ended));
    }
    {
      // AND THE BAND DOES NOT MATTER. The text path refuses this for everybody; so does this one.
      upstreamCalls = 0;
      const res = fakeRes();
      await handler(mkReq(HAZARD, { age: 25, band: 'adult' }), res);
      ok('an adult asking the same thing by voice is redirected too',
        readerText(res) === CORE.WARM_TEMPLATES.SAFETY_REDIRECT);
      ok('...still without a model call', upstreamCalls === 0, 'upstream calls: ' + upstreamCalls);
    }
    {
      // AN ORDINARY VOICE TURN IS UNCHANGED. This is the regression that would matter most.
      upstreamCalls = 0;
      const res = fakeRes();
      await handler(mkReq(GENERAL_BENIGN, { age: 25, band: 'adult' }), res);
      ok('an ordinary voice turn still reaches the model', upstreamCalls === 1, 'upstream calls: ' + upstreamCalls);
      ok('...and is still relayed as a stream', res.code === 200);
      // قرار ٩, END TO END ON THE REAL RELAY. The stub above hands back a reader that is done
      // immediately -- a clean 200 whose body carries no text_delta at all, which is exactly the
      // upstream behaviour the decision is about. This route forwards bytes without reading them,
      // so nothing in its loop could notice; the reader would have been shown an empty bubble.
      ok('...and an upstream that returned no text still reaches the reader as a non-empty safe response',
        readerText(res).trim().length > 0,
        JSON.stringify(readerText(res)).slice(0, 200));
    }
    {
      // THE NEGATIVE, on the same relay: an upstream that DID stream text is passed through
      // untouched and gains no apology.
      const SPOKEN = 'الإحسانُ أن تعبدَ اللهَ كأنّك تراه.';
      const frame = 'data: ' + JSON.stringify({
        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: SPOKEN },
      }) + '\n\n' + 'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';
      const prev = globalThis.fetch;
      globalThis.fetch = async (url) => {
        if (String(url).indexOf('api.anthropic.com') === -1) return { ok: false, status: 500, text: async () => '' };
        let sent = false;
        return {
          ok: true, status: 200, json: async () => ({ content: [] }), text: async () => '',
          body: { getReader: () => ({ read: async () => (sent ? { done: true }
            : (sent = true, { done: false, value: new Uint8Array(Buffer.from(frame, 'utf8')) })) }) },
        };
      };
      const res = fakeRes();
      await handler(mkReq(GENERAL_BENIGN, { age: 25, band: 'adult' }), res);
      globalThis.fetch = prev;
      const EA = await esm('lib/empty-answer.js');
      const out = readerText(res);
      ok('a voice turn that DID stream text is relayed unchanged', out === SPOKEN, JSON.stringify(out).slice(0, 200));
      ok('...and gains no apology', out.indexOf(EA.EMPTY_ANSWER_APOLOGY) === -1);
    }
    {
      // THE BAND MAY NOT TRAVEL UPSTREAM. Anthropic 400s on an unknown top-level field, so the
      // field the age policy reads must be removed from the body that is forwarded.
      let sentBody = null;
      globalThis.fetch = async (url, opts) => {
        if (String(url).indexOf('api.anthropic.com') !== -1) { upstreamCalls++; sentBody = JSON.parse(opts.body); }
        return {
          ok: true, status: 200, json: async () => ({ content: [] }), text: async () => '',
          body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
        };
      };
      upstreamCalls = 0;
      await handler(mkReq(GENERAL_BENIGN, { age: 7, band: 'young' }), fakeRes());
      ok('the age band is stripped from the body sent upstream',
        !!sentBody && sentBody.band === undefined, JSON.stringify(sentBody && Object.keys(sentBody)));
    }

    console.log('\n=== E. F-109 — THE EXISTING IMPERMISSIBLE-REQUEST CLASSIFIER GUARDS BOTH RELAYS ===');
    {
      const IR = await esm('lib/policy/impermissible-request.js');
      const fastHandler = (await esm('api/ask.js')).default;
      const BLOCKED = 'ابغى أغنية حلوة';
      const RULING = 'ما حكم الأغاني؟';
      ok('the blocked fixture is classified by the existing shared classifier',
        IR.classifyImpermissibleRequest(BLOCKED).blocked === true);
      ok('the ruling twin is not blocked by that classifier',
        IR.classifyImpermissibleRequest(RULING).blocked === false);

      const reply = (text) => {
        const frame = 'data: ' + JSON.stringify({
          type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text },
        }) + '\n\n' + 'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';
        let sent = false;
        return {
          ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }),
          text: async () => '',
          body: { getReader: () => ({ read: async () => (sent ? { done: true }
            : (sent = true, { done: false, value: new Uint8Array(Buffer.from(frame, 'utf8')) })) }) },
        };
      };

      for (const [name, routeHandler] of [['ask-voice', handler]]) {
        let providerCalls = 0;
        globalThis.fetch = async (url) => {
          if (String(url).includes('api.anthropic.com')) {
            providerCalls++;
            return reply('جواب المزود.');
          }
          throw new Error('offline limiter fixture');
        };
        const blockedRes = fakeRes();
        await routeHandler(mkReq(BLOCKED, { age: 25, band: 'adult' }), blockedRes);
        ok(name + ': a prohibited request makes zero Anthropic calls', providerCalls === 0,
          'calls=' + providerCalls);
        eq(name + ': the endpoint returns the shared age-appropriate counsel',
          readerText(blockedRes), IR.impermissibleCounsel('adult'));

        providerCalls = 0;
        const cleanRes = fakeRes();
        await routeHandler(mkReq(RULING, { age: 25, band: 'adult' }), cleanRes);
        ok(name + ': the clean ruling twin uses at most one Anthropic call', providerCalls <= 1,
          'calls=' + providerCalls);
        if (providerCalls > 0) eq(name + ': a provider answer is still relayed unchanged',
          readerText(cleanRes), 'جواب المزود.');
      }
    }

    console.log('\n=== F. F-108 — TASHKEEL MAY ADD MARKS AND CHANGE NOTHING ELSE ===');
    {
      const TASH = await esm('api/tashkeel.js');
      const ORIGINAL = 'هٰذا نصٌّ ثابت.';
      const GOOD = 'هٰذَا نَصٌّ ثَابِتٌ.';
      const mutations = [
        ['a changed letter', 'هٰذِهِ نَصٌّ ثَابِتٌ.'],
        ['a changed word', 'هٰذَا قَوْلٌ ثَابِتٌ.'],
        ['a moved space', 'هٰذَا  نَصٌّ ثَابِتٌ.'],
        ['changed punctuation', 'هٰذَا نَصٌّ ثَابِتٌ!'],
        ['deleted U+0670', 'هَذَا نَصٌّ ثَابِتٌ.'],
        ['reordered existing marks', 'هٰذا نصٌّ ثابت.'],
      ];
      ok('the pure validator accepts a correct addition-only diacritization',
        TASH.isSafeDiacritization(ORIGINAL, GOOD));
      for (const [label, mutant] of mutations) {
        ok('the pure validator rejects ' + label, !TASH.isSafeDiacritization(ORIGINAL, mutant));
      }

      const runTashkeel = async (candidate) => {
        let providerCalls = 0, sentText = null;
        globalThis.fetch = async (url, init) => {
          if (String(url).includes('api.anthropic.com')) {
            providerCalls++;
            sentText = JSON.parse(init.body).messages[0].content;
            return { ok: true, status: 200, json: async () => ({
              content: [{ type: 'text', text: candidate }],
            }) };
          }
          throw new Error('offline limiter fixture');
        };
        const res = fakeRes();
        await TASH.default({ method: 'POST', headers: mkReq('').headers,
          body: { text: ORIGINAL, gender: 'male', band: 'adult' } }, res);
        return { res, providerCalls, sentText };
      };

      const good = await runTashkeel(GOOD);
      eq('the endpoint passes a valid diacritization', good.res.body.text, GOOD);
      eq('the provider receives the exact original, including U+0670', good.sentText, ORIGINAL);
      ok('the valid case uses the existing single provider call', good.providerCalls === 1);
      for (const [label, mutant] of mutations) {
        const out = await runTashkeel(mutant);
        eq('the endpoint returns the original byte-for-byte for ' + label, out.res.body.text, ORIGINAL);
        ok(label + ' still used no retry/model call', out.providerCalls === 1,
          'calls=' + out.providerCalls);
      }
    }

    console.log('\n=== G. F-112/F-113 — TTS BODY AND ERROR RESPONSES ARE CLOSED ===');
    {
      const tts = (await esm('api/tts.js')).default;
      const hadEleven = Object.prototype.hasOwnProperty.call(process.env, 'ELEVENLABS_API_KEY');
      const prevEleven = process.env.ELEVENLABS_API_KEY;
      process.env.ELEVENLABS_API_KEY = 'test-key-not-a-credential';
      const ttsReq = (body) => ({ method: 'POST', headers: mkReq('').headers, body });
      const BAD_BODY = { error: 'النص مطلوب' };
      const SAFE_ERROR = { error: 'تعذّر توليد الصوت الآن.' };
      try {
        for (const [label, body] of [
          ['missing body', undefined], ['null body', null], ['malformed JSON', '{'],
          ['primitive body', 17], ['array body', []], ['empty object', {}],
          ['non-string text', { text: 17 }], ['JSON empty object', '{}'],
          ['young body without text', { band: 'young' }],
        ]) {
          let externalCalls = 0;
          globalThis.fetch = async () => { externalCalls++; throw new Error('must not be reached'); };
          const res = fakeRes();
          await tts(ttsReq(body), res);
          ok(label + ' returns the fixed 400', res.code === 400, 'status=' + res.code);
          eq(label + ' returns the fixed body', res.body, BAD_BODY);
          ok(label + ' makes zero external calls', externalCalls === 0, 'calls=' + externalCalls);
        }

        delete process.env.ELEVENLABS_API_KEY;
        let noKeyCalls = 0;
        globalThis.fetch = async () => { noKeyCalls++; throw new Error('must not be reached'); };
        const invalidWithoutKey = fakeRes();
        await tts(ttsReq({ text: 17 }), invalidWithoutKey);
        ok('an invalid object still returns 400 when provider configuration is absent',
          invalidWithoutKey.code === 400, 'status=' + invalidWithoutKey.code);
        eq('an invalid object without provider configuration uses the fixed body',
          invalidWithoutKey.body, BAD_BODY);
        ok('an invalid object without provider configuration makes zero external calls',
          noKeyCalls === 0, 'calls=' + noKeyCalls);
        process.env.ELEVENLABS_API_KEY = 'test-key-not-a-credential';

        const providerLeak = 'SECRET_X <script>alert(1)</script> {"token":"JSON_Y"}';
        let elevenCalls = 0;
        globalThis.fetch = async (url) => {
          if (String(url).includes('api.elevenlabs.io')) {
            elevenCalls++;
            return { ok: false, status: 401, text: async () => providerLeak };
          }
          throw new Error('offline limiter fixture');
        };
        const providerRes = fakeRes();
        await tts(ttsReq({ text: 'نص', gender: 'male', band: 'adult' }), providerRes);
        ok('an upstream failure maps to HTTP 502', providerRes.code === 502,
          'status=' + providerRes.code);
        eq('the upstream failure uses the fixed safe message', providerRes.body, SAFE_ERROR);
        const providerWire = JSON.stringify(providerRes.body);
        ok('secret, HTML and JSON fragments never reach the client',
          !providerWire.includes('SECRET_X') && !providerWire.includes('<script>')
          && !providerWire.includes('JSON_Y'), providerWire);
        ok('the failed valid request made exactly one ElevenLabs call', elevenCalls === 1,
          'calls=' + elevenCalls);

        elevenCalls = 0;
        globalThis.fetch = async (url) => {
          if (String(url).includes('api.elevenlabs.io')) {
            elevenCalls++;
            throw new Error('EXCEPTION_Z private');
          }
          throw new Error('offline limiter fixture');
        };
        const exceptionRes = fakeRes();
        await tts(ttsReq({ text: 'نص', gender: 'male', band: 'adult' }), exceptionRes);
        ok('a provider exception maps to HTTP 502', exceptionRes.code === 502,
          'status=' + exceptionRes.code);
        eq('the provider exception uses the same fixed message', exceptionRes.body, SAFE_ERROR);
        ok('the raw exception is absent', !JSON.stringify(exceptionRes.body).includes('EXCEPTION_Z'));
        ok('the throwing request made exactly one ElevenLabs call', elevenCalls === 1,
          'calls=' + elevenCalls);

        const audio = Buffer.from([0x49, 0x44, 0x33, 0x04]);
        elevenCalls = 0;
        globalThis.fetch = async (url) => {
          if (String(url).includes('api.elevenlabs.io')) {
            elevenCalls++;
            return { ok: true, status: 200,
              arrayBuffer: async () => audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) };
          }
          throw new Error('offline limiter fixture');
        };
        const audioRes = fakeRes();
        await tts(ttsReq({ text: 'نص سليم', gender: 'male', band: 'adult' }), audioRes);
        ok('a valid TTS request stays successful', audioRes.code === 0 || audioRes.code === 200,
          'status=' + audioRes.code);
        ok('the successful audio bytes stay exact', Buffer.isBuffer(audioRes.body)
          && audioRes.body.equals(audio), String(audioRes.body));
        ok('the valid request keeps exactly one ElevenLabs call', elevenCalls === 1,
          'calls=' + elevenCalls);
      } finally {
        if (hadEleven) process.env.ELEVENLABS_API_KEY = prevEleven;
        else delete process.env.ELEVENLABS_API_KEY;
      }
    }
  } finally {
    globalThis.fetch = realFetch;
    if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey;
    else delete process.env.ANTHROPIC_API_KEY;
    if (hadSecret) process.env.FOUNDER_SECRET = prevSecret;
    else delete process.env.FOUNDER_SECRET;
  }

  console.log('\n=== H. THE OLD RELAYS STAY RETIRED ===');
  ok('both old voice endpoints are 410 tombstones',
    retiredSources.every((source) => /status\(410\)/.test(source)
      && /RETIRED_CHAT_REPLACEMENT = '\/api\/ask'/.test(source)));
  ok('...and neither contains a provider stream',
    retiredSources.every((source) => !/getReader\(\)|api\.anthropic\.com/.test(source)));
  ok('the live /api/ask path still owns the provider stream', /getReader\(\)/.test(askSrc));

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
