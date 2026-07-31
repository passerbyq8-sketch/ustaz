#!/usr/bin/env node
'use strict';
// call-mode-guard.cjs  --  GATE 11: the voice-call path stays usable and stays HONEST.
//
// Three regressions this gate exists to prevent, all measured live:
//
//   1. api/chat.js sent `output_config.effort`. /v1/messages does not accept that field,
//      so ONE env var (CALL_EFFORT) turned every call turn into an upstream 400.
//   2. index.html refused to build the call screen when window.SpeechRecognition was
//      absent -- even though the LIVE path (CALL_STT_CLOUD) records with MediaRecorder
//      and transcribes in api/stt.js, and never touches SpeechRecognition at all.
//   3. Every failure on that path was SILENT: a denied microphone and a dead /api/stt
//      both ended in an empty catch + a re-opened mic, and the 400 above reached the
//      child as "لم أفهم سؤالك" -- blaming them for a request the model never read.
//
// CHECK A  api/chat.js + api/chat-fast.js, EXECUTED: the handler is actually invoked with
//          CALL_EFFORT set AND a client-supplied output_config, and the bytes it puts on
//          the wire are inspected. This is behaviour, not a grep for a comment.
// CHECK B  index.html message maps, EXECUTED: the three message functions are extracted
//          from the page and run, so a message that goes blank or collapses into another
//          fails here rather than on a child's screen.
// CHECK C  index.html structure: the invariants that cannot be executed outside a browser
//          (SR gating, no-silent-restart, the call-screen banner) are asserted on source.
//
// Arabic needles live as string literals but are NEVER printed. All console output is
// ASCII (ids/labels only), safe for a Windows terminal.
//
// Exit 0 = all pass  |  1 = a real regression  |  2 = could not run (structural).
//
// Usage:  node call-mode-guard.cjs [indexFile]     default: index.html

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const indexFile = process.argv[2] || 'index.html';

let P = 0, F = 0;
const FAILS = [];
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; FAILS.push(m); console.log('  [FAIL] ' + m); };
const info = (m) => console.log('  [INFO] ' + m);
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };
const abort = (m) => { console.error('ABORT: ' + m); process.exit(2); };

console.log('call-mode-guard: gate 11 (voice call -- reachable path, honest failures)');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Slice a brace-balanced body starting at the first `{` at/after `from`. The regions this
// gate extracts contain no braces inside string literals, so plain counting is exact.
function braceSlice(src, from) {
  const start = src.indexOf('{', from);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

// Extract `<header> ... }` as runnable source, e.g. extract(src, 'const sttErrorMessage = (status) => ')
function extractDecl(src, header) {
  const at = src.indexOf(header);
  if (at === -1) return null;
  const body = braceSlice(src, at + header.length - 1);
  return body === null ? null : (header + body);
}

// ===========================================================================
// CHECK A -- the relays, EXECUTED
// ===========================================================================
async function checkRelays() {
  const chatSrc = read('api/chat.js');
  const fastSrc = read('api/chat-fast.js');
  if (chatSrc === null) abort('cannot read api/chat.js');
  if (fastSrc === null) abort('cannot read api/chat-fast.js');

  // A0: the env gate itself must be GONE, not merely defaulted off. A file that still reads
  // CALL_EFFORT is one Vercel env var away from the 400 this gate exists to prevent.
  // Match the READ, not the word: the file names CALL_EFFORT in the comment that explains why
  // it must never come back, and a guard that fails on its own tombstone teaches nothing.
  if (/process\.env\.CALL_EFFORT/.test(chatSrc)) fail('A0 api/chat.js still reads process.env.CALL_EFFORT (the env gate must be removed, not defaulted off)');
  else pass('A0 api/chat.js no longer reads process.env.CALL_EFFORT');

  // A1: no assignment of output_config anywhere in either relay (a delete is not an assignment).
  for (const [name, src] of [['api/chat.js', chatSrc], ['api/chat-fast.js', fastSrc]]) {
    if (/output_config\s*[:=][^=]/.test(src.replace(/delete\s+parsed\.output_config\s*;/g, ''))) {
      fail('A1 ' + name + ' assigns output_config somewhere');
    } else pass('A1 ' + name + ' never assigns output_config');
  }

  // ---- executed: run the real handlers and read the bytes they put on the wire ----
  const { founderTokenFor } = await import(pathToUrl('lib/daycap.js'));

  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  process.env.FOUNDER_SECRET = 'call-mode-guard-secret';
  process.env.CALL_EFFORT = 'high';   // the exact setting that broke production
  process.env.MODEL_STANDARD = 'claude-sonnet-5';
  process.env.MODEL_FAST = 'claude-haiku-4-5-20251001';
  delete process.env.CALL_THINKING;

  const DEVICE = 'callmodeguarddevice01';
  const founder = founderTokenFor(DEVICE); // founder short-circuits the day cap BEFORE any Redis

  const realFetch = global.fetch;
  let sent = null;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.indexOf('api.anthropic.com') !== -1) {
      sent = JSON.parse((opts && opts.body) || '{}');
      return new Response(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }
    // Anything else is the Upstash throttle. It FAILS OPEN by contract, so refusing it here
    // exercises the same path a Redis outage would -- and keeps this gate offline.
    throw new Error('offline (call-mode-guard)');
  };

  const mkRes = () => {
    const r = {
      statusCode: 0, headers: {}, chunks: [], ended: false,
      status(c) { r.statusCode = c; return r; },
      setHeader(k, v) { r.headers[String(k).toLowerCase()] = v; return r; },
      getHeader(k) { return r.headers[String(k).toLowerCase()]; },
      get headersSent() { return r.chunks.length > 0 || r.ended; },
      flushHeaders() {},
      write(c) { r.chunks.push(Buffer.from(c)); return true; },
      end(c) { if (c) r.chunks.push(Buffer.from(c)); r.ended = true; return r; },
      json(o) { r.chunks.push(Buffer.from(JSON.stringify(o))); r.ended = true; return r; },
    };
    return r;
  };

  const mkReq = (extra) => ({
    method: 'POST',
    headers: {
      'x-real-ip': '127.0.0.1',
      'x-murabbi-device': DEVICE,
      'x-murabbi-founder': founder,
    },
    // A client that ASKS for the unsupported field: the relay must strip it, not forward it.
    body: Object.assign({
      max_tokens: 4096,
      stream: true,
      system: 'guard probe',
      messages: [{ role: 'user', content: 'probe' }],
      output_config: { effort: 'high' },
      model: 'claude-opus-5',
    }, extra || {}),
  });

  try {
    for (const [name, mod] of [['api/chat.js', 'api/chat.js'], ['api/chat-fast.js', 'api/chat-fast.js']]) {
      sent = null;
      const handler = (await import(pathToUrl(mod))).default;
      const res = mkRes();
      await handler(mkReq(), res);

      if (sent === null) {
        fail('A2 ' + name + ' never reached the upstream call (status ' + res.statusCode +
             ', body ' + Buffer.concat(res.chunks).toString('utf8').slice(0, 160) + ')');
        continue;
      }
      if (res.statusCode === 200) pass('A2 ' + name + ' relayed a 200');
      else fail('A2 ' + name + ' answered ' + res.statusCode + ' on a clean turn');

      // THE assertion this gate is for.
      if ('output_config' in sent) fail('A3 ' + name + ' PUT output_config ON THE WIRE: ' + JSON.stringify(sent.output_config));
      else pass('A3 ' + name + ' sent NO output_config (CALL_EFFORT=high and a client-supplied one were both ignored)');
      if (sent.effort !== undefined) fail('A3 ' + name + ' sent a bare top-level effort field');
      else pass('A3 ' + name + ' sent no bare effort field');

      // Standing invariants that share this transform -- if one breaks, the same edit broke it.
      if (name === 'api/chat.js' && sent.model === 'claude-sonnet-5') pass('A4 api/chat.js still forces the STANDARD model server-side');
      else if (name === 'api/chat.js') fail('A4 api/chat.js model = ' + sent.model + ' (client sent claude-opus-5; the server must overrule it)');
      if (name === 'api/chat-fast.js' && sent.model === 'claude-haiku-4-5-20251001') pass('A4 api/chat-fast.js still forces the FAST model server-side');
      else if (name === 'api/chat-fast.js') fail('A4 api/chat-fast.js model = ' + sent.model);
      if (Array.isArray(sent.system) && sent.system[0] && sent.system[0].cache_control) pass('A5 ' + name + ' still wraps the system prompt in an ephemeral cache block');
      else fail('A5 ' + name + ' lost the ephemeral system-prompt cache block');
    }
  } finally {
    global.fetch = realFetch;
  }
}

function pathToUrl(rel) {
  return require('url').pathToFileURL(path.resolve(process.cwd(), rel)).href;
}

// ===========================================================================
// CHECK B -- the client message maps, EXECUTED
// ===========================================================================
function checkMessages(html) {
  const sandbox = {};

  const friendly = extractDecl(html, 'const FRIENDLY_ERRORS = ');
  const stt = extractDecl(html, 'const sttErrorMessage = (status) => ');
  const mic = extractDecl(html, 'const micErrorMessage = (e) => ');
  if (!friendly) { fail('B0 FRIENDLY_ERRORS not found in ' + indexFile); return; }
  if (!stt) { fail('B0 sttErrorMessage not found in ' + indexFile + ' (the /api/stt failure map is gone)'); return; }
  if (!mic) { fail('B0 micErrorMessage not found in ' + indexFile + ' (the microphone failure map is gone)'); return; }
  pass('B0 all three message maps found and extractable');

  try {
    // eslint-disable-next-line no-new-func
    const run = new Function(friendly + '\n' + stt + '\n' + mic + '\n' +
      'return { FRIENDLY_ERRORS, sttErrorMessage, micErrorMessage };');
    Object.assign(sandbox, run());
  } catch (e) {
    fail('B0 extracted message maps do not evaluate: ' + e.message);
    return;
  }

  const FE = sandbox.FRIENDLY_ERRORS;
  const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 8;

  // B1: the technical bucket exists, in both genders, and is NOT the "I did not understand
  // your question" line. That line is the whole bug: it blames the child for our 400.
  if (FE && FE.technical && nonEmpty(FE.technical.male) && nonEmpty(FE.technical.female)) {
    pass('B1 FRIENDLY_ERRORS.technical present for both genders');
    if (FE.technical.male !== FE.general.male && FE.technical.female !== FE.general.female) {
      pass('B1 technical wording is DISTINCT from the general "did not understand" wording');
    } else fail('B1 technical wording is identical to general -- the HTTP failure still blames the child');
  } else fail('B1 FRIENDLY_ERRORS.technical missing or incomplete');

  // B2: every /api/stt status maps to its own actionable sentence.
  const STATUSES = [400, 403, 413, 429, 500, 503];
  const seen = new Map();
  let sttOk = true;
  for (const s of STATUSES) {
    const m = sandbox.sttErrorMessage(s);
    if (!nonEmpty(m)) { fail('B2 sttErrorMessage(' + s + ') is empty -- a silent failure by another name'); sttOk = false; continue; }
    seen.set(s, m);
  }
  if (sttOk) pass('B2 sttErrorMessage returns a real sentence for ' + STATUSES.join('/'));
  if (seen.get(429) && seen.get(500) && seen.get(429) !== seen.get(500)) pass('B2 a rate limit and an outage do not read the same');
  else fail('B2 sttErrorMessage(429) and sttErrorMessage(500) are indistinguishable');

  // B3: a DENIED microphone must name the permission -- it is the only failure the user can fix.
  const denied = sandbox.micErrorMessage({ name: 'NotAllowedError' });
  const generic = sandbox.micErrorMessage({ name: 'WhateverError' });
  const missing = sandbox.micErrorMessage({ name: 'NotFoundError' });
  if (nonEmpty(denied) && nonEmpty(generic) && nonEmpty(missing)) pass('B3 micErrorMessage answers denied/absent/unknown with real sentences');
  else fail('B3 micErrorMessage returned an empty message for one of denied/absent/unknown');
  if (denied !== generic && denied !== missing) pass('B3 a DENIED permission is distinguishable from a broken/absent device');
  else fail('B3 a denied permission reads the same as a missing device -- the user cannot act on it');
  // The denial message must tell the user where to go. Needle is a bare word, never printed.
  if (denied.indexOf('إعدادات') !== -1) pass('B3 the denial message points at the settings screen');
  else fail('B3 the denial message does not tell the user where to grant the permission');
}

// ===========================================================================
// CHECK C -- structure that cannot be executed outside a browser
// ===========================================================================
function checkStructure(html) {
  // C1: the cloud path is the LIVE path. If that flag ever goes false the SR gating below
  // is allowed to be strict again -- so state the assumption instead of assuming it.
  if (/const CALL_STT_CLOUD = true;/.test(html)) pass('C1 CALL_STT_CLOUD is on (cloud STT is the live path)');
  else { fail('C1 CALL_STT_CLOUD is not `true` -- re-derive this gate before shipping'); return; }

  // C2: the call screen must NOT be refused for a missing SpeechRecognition while the cloud
  // path is live. This is the check that was killing the whole feature on Android WebView.
  if (/if \(!SR && !CALL_STT_CLOUD\) \{/.test(html)) pass('C2 the SR bail-out is conditioned on !CALL_STT_CLOUD');
  else fail('C2 the call effect still bails on a missing SpeechRecognition regardless of CALL_STT_CLOUD');
  if (/const rec = SR \? new SR\(\) : null;/.test(html)) pass('C2 the recognizer is constructed only when an engine exists');
  else fail('C2 `new SR()` is not guarded -- the call effect throws on engines without Web Speech');

  // C3: a getUserMedia rejection must SPEAK. The old body was `catch (e) { ...setCallState('idle'); }`.
  const startAt = html.indexOf('const startCloudListening = async () => {');
  if (startAt === -1) { fail('C3 startCloudListening not found'); }
  else {
    const body = braceSlice(html, startAt);
    if (body && /catch \(e\) \{[\s\S]*showCallError\(micErrorMessage\(e\)\)/.test(body)) {
      pass('C3 a microphone failure raises a named error instead of falling silent');
    } else fail('C3 startCloudListening still swallows its microphone failure');
    if (body && /stopCloudAll\(\);/.test(body)) pass('C3 a failed start releases the half-opened capture');
    else fail('C3 a failed start leaks the capture graph');
  }

  // C4: a FAILED /api/stt must not be answered by re-opening the microphone. That loop is
  // what made a dead vendor key look like a call that listened forever and answered nothing.
  const stopAt = html.indexOf('const stopCloudTurn = async () => {');
  if (stopAt === -1) { fail('C4 stopCloudTurn not found'); }
  else {
    const body = braceSlice(html, stopAt);
    if (!body) fail('C4 stopCloudTurn body unreadable');
    else {
      if (/sttError = sttErrorMessage\(r\.status\)/.test(body)) pass('C4 a non-OK /api/stt is turned into a message');
      else fail('C4 a non-OK /api/stt is still discarded');
      // Read the failure branch as a BLOCK, not by regex distance. index.html is CRLF-pinned,
      // so any lookahead written against a bare \n silently scans past the closing brace and
      // "finds" the legitimate restart that lives further down. Brace-count instead.
      const errAt = body.indexOf('if (sttError) {');
      const errBranch = errAt === -1 ? null : braceSlice(body, errAt);
      if (!errBranch) fail('C4 the sttError branch not found');
      else {
        if (/showCallError\(sttError\);/.test(errBranch) && /return;/.test(errBranch)) pass('C4 an STT failure ends the turn with a visible error');
        else fail('C4 an STT failure does not end the turn with a visible error');
        // The ONE legitimate restart is the silence path below -- never this one.
        if (/startCloudListening\(/.test(errBranch)) fail('C4 the STT-failure branch still re-opens the microphone');
        else pass('C4 the STT-failure branch does NOT re-open the microphone');
        if (/setCallState\('idle'\)/.test(errBranch)) pass('C4 the STT-failure branch returns the call to idle');
        else fail('C4 the STT-failure branch leaves the call stuck mid-state');
      }
      if (/if \(!text\) \{ startCloudListening\(\); return; \}/.test(body)) pass('C4 genuine silence (OK + empty text) still keeps listening');
      else fail('C4 the genuine-silence path no longer keeps listening');
      // An empty catch on this path is exactly the regression. Reject it by shape.
      if (/catch \(e\) \{\s*\}/.test(body)) fail('C4 stopCloudTurn contains an empty catch block');
      else pass('C4 stopCloudTurn has no empty catch block');
    }
  }

  // C5: a technical HTTP status must not answer with the "did not understand" line.
  if (/return getFriendlyError\('technical', p\.gender\);/.test(html)) pass('C5 the non-2xx fallback answers with the technical wording');
  else fail('C5 the non-2xx fallback does not use the technical wording');
  const okAt = html.indexOf('if (!response.ok) {');
  if (okAt !== -1) {
    const body = braceSlice(html, okAt);
    if (body && /getFriendlyError\('general'/.test(body)) fail('C5 the !response.ok branch STILL falls back to the general "did not understand" line');
    else pass('C5 the !response.ok branch never falls back to the general "did not understand" line');
  } else fail('C5 the !response.ok branch not found');

  // C6: an error raised during a call has to be rendered ON the call screen. It used to be
  // rendered only in the chat view -- written to a screen nobody was looking at.
  if (/<CallScreen[^>]*error=\{voiceError\}/.test(html)) pass('C6 the call screen receives voiceError');
  else fail('C6 the call screen is not given voiceError');
  if (/function CallScreen\(\{[^}]*\berror\b[^}]*\}\)/.test(html)) pass('C6 CallScreen accepts an error prop');
  else fail('C6 CallScreen does not accept an error prop');
  if (/\{error \? <div style=\{s\.callErrorBanner\}/.test(html)) pass('C6 CallScreen renders the error banner');
  else fail('C6 CallScreen does not render an error banner');
  if (/callErrorBanner: \{/.test(html)) pass('C6 callErrorBanner style exists');
  else fail('C6 callErrorBanner style missing');
}

// ===========================================================================
(async () => {
  const html = read(indexFile);
  if (html === null) abort('cannot read ' + indexFile);
  info(indexFile + ' = ' + html.length + ' chars');

  console.log('  -- CHECK A: relays (executed) --');
  await checkRelays();
  console.log('  -- CHECK B: message maps (executed) --');
  checkMessages(html);
  console.log('  -- CHECK C: call-path structure --');
  checkStructure(html);

  console.log('  SUMMARY   PASS=' + P + '   FAIL=' + F);
  if (F > 0) {
    console.log('  -- FAILURES (call mode regressed) --');
    FAILS.forEach((m) => console.log('    * ' + m));
    process.exit(1);
  }
  console.log('  OK: call mode reachable without SpeechRecognition, no unsupported field on the wire, no silent failure.');
  process.exit(0);
})().catch((e) => {
  console.error('ABORT: ' + (e && e.stack ? e.stack : e));
  process.exit(2);
});
