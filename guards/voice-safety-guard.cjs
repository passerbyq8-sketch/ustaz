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
    json(o) { this.writes.push(JSON.stringify(o)); this.ended += 1; return this; },
  };
}
const readerText = (res) => res.writes.join('')
  .split('\n').filter((l) => l.startsWith('data:'))
  .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
  .filter((f) => f && f.delta && typeof f.delta.text === 'string')
  .map((f) => f.delta.text).join('');

const HAZARD = 'شلون أخلط الكلور مع مواد التنظيف عشان يطلع فوران؟';
const BENIGN = 'شنو معنى الإحسان؟';

(async function main() {
  console.log('=== voice-safety-guard — the voice turn is triaged before the model ===');

  const CORE = await esm('lib/policy/core.js');
  const chatSrc = read('api/chat.js');

  console.log('\n=== A. THE FIXTURE IS REALLY A GRAVE HAZARD ===');
  ok('the hazard question is classified as one', !!CORE.graveHazard(HAZARD), String(CORE.graveHazard(HAZARD)));
  ok('...and the benign one is not', !CORE.graveHazard(BENIGN));

  console.log('\n=== B. THE VOICE RELAY CONSULTS THE SAME POLICY CORE ===');
  ok('api/chat.js imports graveHazard from the shared core',
    /import \{[^}]*graveHazard[^}]*\} from '\.\.\/lib\/policy\/core\.js'/.test(chatSrc),
    'a second hazard list in the relay is a second list that can disagree');
  ok('...and the same warm templates', /WARM_TEMPLATES/.test(chatSrc));
  ok('...and the same age policy', /from '\.\.\/lib\/policy\/age\.js'/.test(chatSrc));
  ok('the triage sits BEFORE the upstream call',
    chatSrc.indexOf('graveHazard(') < chatSrc.indexOf('api.anthropic.com'),
    'a redirect after the call has already paid for the answer it is refusing');

  console.log('\n=== C. APPLE 5.1.1(i): THE CONSENT GATE IS UNTOUCHED ===');
  ok('guardAIConsent is still the first thing after the method check',
    /if \(!guardAIConsent\(req, res\)\) return;/.test(chatSrc));
  ok('...and still runs BEFORE the throttle',
    chatSrc.indexOf('guardAIConsent(req, res)') < chatSrc.indexOf('checkChatLimit(ip)'));
  ok('...and BEFORE the new triage, so an un-consented request is still triaged by nobody',
    chatSrc.indexOf('guardAIConsent') < chatSrc.indexOf('graveHazard('));
  ok('...and its header list is still advertised',
    /AI_CONSENT_ALLOW_HEADERS/.test(chatSrc));

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
  const handler = (await esm('api/chat.js')).default;
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
      await handler(mkReq(HAZARD, { band: 'young' }), res);
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
      await handler(mkReq(HAZARD), res);
      ok('an adult asking the same thing by voice is redirected too',
        readerText(res) === CORE.WARM_TEMPLATES.SAFETY_REDIRECT);
      ok('...still without a model call', upstreamCalls === 0, 'upstream calls: ' + upstreamCalls);
    }
    {
      // AN ORDINARY VOICE TURN IS UNCHANGED. This is the regression that would matter most.
      upstreamCalls = 0;
      const res = fakeRes();
      await handler(mkReq(BENIGN), res);
      ok('an ordinary voice turn still reaches the model', upstreamCalls === 1, 'upstream calls: ' + upstreamCalls);
      ok('...and is still relayed as a stream', res.code === 200);
      // قرار ٩, END TO END ON THE REAL RELAY. The stub above hands back a reader that is done
      // immediately -- a clean 200 whose body carries no text_delta at all, which is exactly the
      // upstream behaviour the decision is about. This route forwards bytes without reading them,
      // so nothing in its loop could notice; the reader would have been shown an empty bubble.
      const EA = await esm('lib/empty-answer.js');
      ok('...and an upstream that streamed NOTHING reaches the reader as the apology, not silence',
        readerText(res) === EA.EMPTY_ANSWER_APOLOGY,
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
      await handler(mkReq(BENIGN), res);
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
      await handler(mkReq(BENIGN, { band: 'young' }), fakeRes());
      ok('the age band is stripped from the body sent upstream',
        !!sentBody && sentBody.band === undefined, JSON.stringify(sentBody && Object.keys(sentBody)));
    }
  } finally {
    globalThis.fetch = realFetch;
    if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey;
    else delete process.env.ANTHROPIC_API_KEY;
    if (hadSecret) process.env.FOUNDER_SECRET = prevSecret;
    else delete process.env.FOUNDER_SECRET;
  }

  console.log('\n=== E. WHAT THIS BATCH DELIBERATELY DID NOT DO ===');
  ok('the voice path is NOT redirected into api/ask.js',
    !/from '\.\/ask\.js'|require\('\.\/ask/.test(chatSrc),
    'that is a larger batch of its own; this gate exists so it is not done by accident here');
  ok('...and the relay still streams the ordinary turn rather than buffering everything',
    /getReader\(\)/.test(chatSrc));

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
