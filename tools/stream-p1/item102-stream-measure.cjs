// ============================================================================
// ITEM 102 — HOW THE ANSWER IS PAINTED, AND WHERE THE PAGE SITS WHILE IT IS
// ============================================================================
//
// WHAT THIS IS FOR. The owner reported two things about a live preview: the answer arrives in
// slabs rather than characters, and the view drops to the end of the answer when the turn
// finishes. Neither is a claim about a module; both are claims about PIXELS OVER TIME. So this
// drives the real `index.html` in a real headless Chrome and records, frame by frame, what a
// reader would actually have seen.
//
// IT MEASURES, IT DOES NOT ASSERT. There is no pass/fail here. It prints numbers and writes a
// JSON record, because §4/١ of the order requires a measurement to exist BEFORE any code is read
// for a cause.
//
// THE STREAM SOURCE IS EXPLICIT, ALWAYS. Every run names its source in the output and in the
// JSON, because a number from a replayed stream and a number from the live preview are not the
// same evidence:
//
//   --source=local     every /api/* call is served by importing the REAL api/*.js into this
//                      process, with .env.local loaded. `vercel dev` cannot be used: the project's
//                      DEVELOPMENT scope sets every sensitive value to the empty string and that
//                      beats .env.local. This is the same handler the deployment runs.
//   --source=preview   every /api/* call is proxied to the preview origin, which is where
//                      STREAM_V1=on lives. The proxy records each SSE event's arrival time and
//                      text length as it passes through — that is §4/٢, the raw reference,
//                      taken at the only place that sees exactly what the browser saw.
//   --source=replay    a timeline RECORDED by an earlier --source=preview run is re-emitted
//                      with its original inter-event delays. The text and the timing are the
//                      preview's; nothing is invented. This is what makes calibration
//                      repeatable, because the same arrival pattern can be played at two
//                      different client constants.
//   --source=synthetic LAST RESORT AND LABELLED AS SUCH in every line it prints. Made-up text on
//                      a made-up clock. A number from here is not evidence about Ezik.
//
// THE CLIENT CONSTANTS CAN BE OVERRIDDEN WITHOUT EDITING THE FILE, for calibration only:
//   --reveal-ms=N --reveal-divisor=N --reveal-min-step=N --reveal-max-step=N
// These patch the three constants in the SERVED copy of app.js in memory. The file on disk is
// never touched. A run with no override serves app.js byte for byte and says so.
//
//   node tools/stream-p1/item102-stream-measure.cjs --source=preview --q=1 --label=base
//
'use strict';

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const PORT = 8994;
const OUT_DIR = path.join(REPO, '..', 'ustaz-102-orders', 'measure');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter((p) => fs.existsSync(p))[0];
const CDN_CACHE = path.join(os.tmpdir(), 'ezik-cdn-cache');

const PREVIEW = 'https://ustaz-evvkdgi0e-musaed-s-projects1.vercel.app';
// A LOCAL `vercel dev`, which is the source the owner opened up when the preview turned out to be
// unreachable behind Deployment Protection. Same repo, same handler, same STREAM_V1 -- and unlike
// the preview it can be re-measured after a fix, which the order could not assume.
const LOCAL = 'http://localhost:3000';
// The secret is read from a file OUTSIDE the repo, or from the environment. It is never printed,
// never written into the repo, and never put in the JSON record.
const BYPASS_FILE = path.join(REPO, '..', 'ustaz-102-orders', '.bypass');

// ── args ────────────────────────────────────────────────────────────────────────────────────
const ARG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/u.exec(a);
  if (m) ARG[m[1]] = m[2] === undefined ? 'true' : m[2];
}
const SOURCE = ARG.source || 'preview';
const LABEL = ARG.label || 'run';
const QN = parseInt(ARG.q || '1', 10);
const REPLAY_FILE = ARG.replay || '';
const SAMPLE_AFTER_MS = parseInt(ARG['after-ms'] || '2500', 10);
const OVERRIDE = {
  ms: ARG['reveal-ms'] ? parseInt(ARG['reveal-ms'], 10) : null,
  div: ARG['reveal-divisor'] ? parseInt(ARG['reveal-divisor'], 10) : null,
  min: ARG['reveal-min-step'] ? parseInt(ARG['reveal-min-step'], 10) : null,
  max: ARG['reveal-max-step'] ? parseInt(ARG['reveal-max-step'], 10) : null,
};

// ── §7 of the order: the four questions, verbatim ───────────────────────────────────────────
const QUESTIONS = [
  'ما حكم الجمع بين الصلاتين للمسافر، ومتى يبدأ حكم السفر ومتى ينتهي؟',
  'ما درجة حديث «من غشنا فليس منا»؟ ومن أخرجه؟',
  'هل يجوز للمرأة السفر بلا محرم لأداء العمرة؟',
  'اذكر لي وصف عبادة النبي صلى الله عليه وسلم في قيام الليل مع الدليل.',
];

// Every line this file prints is ASCII: Arabic on a Windows terminal is a mojibake report, not
// evidence.
const esc = (v) => Array.from(String(v === undefined || v === null ? '' : v))
  .map((c) => (c.codePointAt(0) < 128 ? c : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')))
  .join('');
const log = (...a) => console.log(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

function readBypass() {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return process.env.VERCEL_AUTOMATION_BYPASS_SECRET.trim();
  if (fs.existsSync(BYPASS_FILE)) {
    const raw = fs.readFileSync(BYPASS_FILE, 'utf8').trim();
    const m = /([A-Za-z0-9]{16,})\s*$/u.exec(raw.split(/\r?\n/u).filter(Boolean).pop() || '');
    return m ? m[1] : raw;
  }
  return null;
}

// ── CDP plumbing, followed from tools/stream-p1/ask-pin-and-enter-measure.cjs ────────────────
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
class WS {
  constructor(url) {
    const u = new URL(url);
    this.sock = net.connect(parseInt(u.port, 10), u.hostname);
    this.buf = Buffer.alloc(0); this.open = false; this.handlers = [];
    this.ready = new Promise((resolve, reject) => {
      this.sock.on('error', reject);
      this.sock.on('connect', () => {
        this.sock.write('GET ' + u.pathname + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\n'
          + 'Connection: Upgrade\r\nSec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64')
          + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
      });
      this.sock.on('data', (d) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!this.open) {
          const i = this.buf.indexOf('\r\n\r\n');
          if (i === -1) return;
          this.buf = this.buf.slice(i + 4); this.open = true; resolve();
        }
        this.drain();
      });
    });
  }
  drain() {
    for (;;) {
      if (this.buf.length < 2) return;
      let len = this.buf[1] & 0x7f; let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len).toString('utf8');
      this.buf = this.buf.slice(off + len);
      let m = null; try { m = JSON.parse(payload); } catch (e) { m = null; }
      if (m) this.handlers.forEach((h) => h(m));
    }
  }
  send(obj) {
    const data = Buffer.from(JSON.stringify(obj), 'utf8');
    const mask = crypto.randomBytes(4);
    let header;
    if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
    else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
    const masked = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 1) masked[i] = data[i] ^ mask[i % 4];
    this.sock.write(Buffer.concat([header, mask, masked]));
  }
  close() { try { this.sock.destroy(); } catch (e) { /* already gone */ } }
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.handlers.push((m) => {
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
      }
    });
  }
  cmd(method, params) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send({ id, method, params: params || {} });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout: ' + method)); }
      }, 600000);
    });
  }
  async evaluate(expression) {
    const r = await this.cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  }
}

const CDN_URLS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js',
];
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ezik-102-measure/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve(fetchOnce(new URL(res.headers.location, url).href)); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(url + ' -> ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
async function cdnCache() {
  fs.mkdirSync(CDN_CACHE, { recursive: true });
  const out = new Map();
  for (const url of CDN_URLS) {
    const file = path.join(CDN_CACHE, crypto.createHash('sha256').update(url).digest('hex').slice(0, 16) + '.js');
    if (!fs.existsSync(file)) fs.writeFileSync(file, await fetchOnce(url));
    out.set(url, fs.readFileSync(file));
  }
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

// ── THE SERVED app.js, AND THE ONLY THING THIS TOOL IS ALLOWED TO CHANGE ABOUT IT ───────────
// The three reveal constants are patched IN MEMORY so a calibration sweep does not have to
// rebuild and re-commit the client for every candidate value. The patch is exact-string and it
// THROWS if the string is not there, because silently serving the unpatched file would report a
// candidate's number as the baseline's and be worse than no measurement at all.
function servedAppJs() {
  const raw = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
  const applied = [];
  let out = raw;
  // THE BUILT FORM IS NOT THE SOURCE FORM. app.jsx writes `const EZIK_REVEAL_MS = 28;` and Babel
  // emits `const EZIK_REVEAL_MS=28,EZIK_REVEAL_DIVISOR=8,...` -- one declaration, no spaces, no
  // semicolon between them. A pattern anchored on `const NAME = N;` matches nothing, and because
  // it threw rather than silently serving the unpatched file, that cost one run and not a whole
  // sweep of wrong numbers. The names are unique in the bundle, so the assignment alone is enough.
  // AND «did the text change?» IS NOT «was the constant found?». Asking for the value the file
  // already has is the most ordinary request in a sweep -- it is the control point -- and it
  // produces an identical string. The first version read that as «the constant is missing» and
  // threw, losing the one run whose number the others are compared against. The match itself is
  // the test.
  const patch = (name, value) => {
    if (value === null || value === undefined) return;
    const re = new RegExp('\\b(' + name + ')(\\s*=\\s*)(\\d+)\\b', 'u');
    if (!re.test(out)) throw new Error('could not find ' + name + ' in app.js');
    out = out.replace(re, (m0, a, eq, old) => { applied.push(name + ': ' + old + ' -> ' + value); return a + eq + value; });
  };
  patch('EZIK_REVEAL_MS', OVERRIDE.ms);
  patch('EZIK_REVEAL_DIVISOR', OVERRIDE.div);
  patch('EZIK_REVEAL_MIN_STEP', OVERRIDE.min);
  patch('EZIK_REVEAL_MAX_STEP', OVERRIDE.max);
  return { body: out, applied, patched: out !== raw };
}

// ── THE STREAM SOURCE ───────────────────────────────────────────────────────────────────────
// Whatever the source, the SAME recorder runs over it: one entry per SSE `data:` line, with the
// time it left this process for the browser and the length of the text it carried. That is the
// raw reference the order asks for in §4/٢, and it is taken here rather than in the page because
// the page only ever sees the accumulated string, never the events.
// ── THE REAL HANDLER, IN THIS PROCESS ───────────────────────────────────────────────────────
// `vercel dev` was tried first and it cannot be used here: the project's DEVELOPMENT environment
// has every sensitive variable set to the empty string — Vercel does not return a Sensitive value
// on `env pull`, and an explicitly-empty project value WINS over `.env.local`. MEASURED: a dev
// server started after the key was put in `.env.local` still answered
// `500 {"error":"ANTHROPIC_API_KEY غير مضبوط"}`, which is api/ask.js:733.
//
// So the handler is imported and called directly. It is an ordinary Node `(req, res)` ESM default
// export, and this is the SAME file the deployment runs, reading the SAME lib/ and the SAME flags.
// Two small things Vercel adds around it have to be added here too, and nothing else:
//   · `req.body`, which the platform parses before the handler sees it (api/ask.js:739);
//   · `res.status()` and `res.json()`, the two Express-shaped helpers it uses.
function loadDotEnvLocal() {
  // Values are never printed, never logged and never put in a JSON record. Only the NAMES of the
  // variables that were actually applied are reported, and only counted.
  const file = path.join(REPO, '.env.local');
  const applied = [];
  if (!fs.existsSync(file)) return { applied, missing: true };
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const i = line.indexOf('=');
    if (i <= 0 || line.trim().startsWith('#')) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v.length > 1 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
    // An empty value is not a value. Leaving those unset is what lets the code default apply,
    // and the report says which of them that was.
    if (!v) continue;
    if (process.env[k]) continue;
    process.env[k] = v;
    applied.push(k);
  }
  return { applied, missing: false };
}

// ── THE COUNTER STORE, AND ONLY THE COUNTER STORE ───────────────────────────────────────────
// `checkDayCap` (lib/daycap.js:340-370) always reaches Redis and FAILS CLOSED when it cannot,
// which is deliberate and correct — and it means an un-stubbed local run is answered `429
// cap-unavailable` before a single token is generated. MEASURED on the first real run:
// «[daycap] store unreachable, fail-CLOSED» and an /api/ask that took 8.6s to say no.
//
// So a minimal Upstash-REST server is stood up in this process. It counts requests and holds a
// revocation set that is always empty. IT TOUCHES NOTHING ABOUT THE ANSWER: no prompt, no model
// call, no reviewer, no lock, no sentence unit passes through it. The per-IP limiter in
// lib/ratelimit.js is left alone on purpose — it fails OPEN by design, so it needs no help and
// stubbing it would be stubbing something that was already working.
//
// Commands the day cap actually issues, and nothing more: MGET, SISMEMBER, and a pipeline of
// INCR/EXPIRE. Anything else answers null, which is what an empty store would say.
function kvStub() {
  const store = new Map();
  const run = (cmd) => {
    const op = String(cmd[0] || '').toLowerCase();
    if (op === 'mget') return cmd.slice(1).map((k) => (store.has(k) ? store.get(k) : null));
    if (op === 'get') return store.has(cmd[1]) ? store.get(cmd[1]) : null;
    if (op === 'incr') { const n = (Number(store.get(cmd[1])) || 0) + 1; store.set(cmd[1], n); return n; }
    if (op === 'expire') return 1;
    if (op === 'sismember') return 0;
    if (op === 'set') { store.set(cmd[1], cmd[2]); return 'OK'; }
    return null;
  };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (d) => chunks.push(d));
      req.on('end', () => {
        let payload = null;
        try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); } catch (e) { payload = null; }
        const pipeline = String(req.url).indexOf('/pipeline') !== -1 || String(req.url).indexOf('/multi-exec') !== -1;
        const out = pipeline
          ? (Array.isArray(payload) ? payload : []).map((c) => ({ result: run(c) }))
          : { result: run(Array.isArray(payload) ? payload : []) };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

// EVERY MODEL CALL GOES THROUGH THE GLOBAL fetch, so wrapping it once is the whole picture of a
// turn's round structure — how many writing rounds there were, how long each took, and where the
// wall-clock between «sent» and «first character» actually went. Nothing is altered: the original
// is called and its result returned untouched. The URLs are printed, never the bodies.
let FETCH_LOG = null;
function armFetchLog(t0) {
  FETCH_LOG = [];
  const f0 = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(typeof url === 'string' ? url : (url && url.url) || url);
    if (u.indexOf('127.0.0.1') !== -1) return f0(url, opts);
    const at = Date.now() - t0;
    const t = Date.now();
    const host = (() => { try { return new URL(u).host + new URL(u).pathname; } catch (e) { return u.slice(0, 60); } })();
    try {
      const r = await f0(url, opts);
      FETCH_LOG.push({ at, ms: Date.now() - t, status: r.status, url: host });
      return r;
    } catch (e) {
      FETCH_LOG.push({ at, ms: Date.now() - t, error: String((e && e.message) || e).slice(0, 120), url: host });
      throw e;
    }
  };
}

const HANDLERS = new Map();
async function callRealHandler(req, res, url, body, rec, notes) {
  const name = url.replace(/^\/api\//u, '').replace(/[^a-z0-9-]/giu, '');
  const file = path.join(REPO, 'api', name + '.js');
  if (!fs.existsSync(file)) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let mod = HANDLERS.get(file);
  if (!mod) {
    mod = await import('file://' + file.replace(/\\/gu, '/'));
    HANDLERS.set(file, mod);
  }
  // ── EMULATING THE PLATFORM, AND THE ONE PLACE IT MATTERS ────────────────────────────────────
  // api/ask.js:1540 does `bindUpstreamToClient(res, req.signal)` and its own comment at :671 says
  // «IncomingMessage does not reliably expose req.signal». ON NODE v24 IT DOES, AND ITS MEANING IS
  // NOT «the reader went away» — it is bound to the REQUEST STREAM, so it aborts the moment the
  // body has been read, which is before the handler has done anything.
  //
  // MEASURED on node v24.18.0: a bare POST to a bare http server reports `signal.aborted === false`
  // inside `req.on('end')` and `true` fifty milliseconds later. Behind a real socket the effect on
  // api/ask.js is total: every upstream fetch fails in 1-2ms with «This operation was aborted», the
  // writing loop records `[free-brain/round-ledger] []` — zero rounds — and the request then hangs.
  // That is a HARNESS artifact, not the deployment: package.json pins `"node": "22.x"`, Vercel's
  // bridge builds its own request object, and the owner does get answers from the preview.
  //
  // So the platform is emulated by NOT handing the handler a stream-bound signal, which is exactly
  // the world its own comment describes. `res.once('close')` is untouched and still cancels the
  // upstream if the reader really does go away. Nothing in api/ or lib/ is modified.
  Object.defineProperty(req, 'signal', { value: undefined, configurable: true });
  try { req.body = body ? JSON.parse(body) : {}; } catch (e) { req.body = body; }
  // WHAT THE APP ACTUALLY SENT, recorded by SHAPE and never by content. The reader's question is
  // never logged anywhere in this repository (gate `telemetrytext`) and it is not logged here
  // either: only the field names, the message count, and the header names.
  if (req.body && typeof req.body === 'object') {
    notes.push({
      url, bodyKeys: Object.keys(req.body).sort(),
      messages: Array.isArray(req.body.messages) ? req.body.messages.length : null,
      roles: Array.isArray(req.body.messages) ? req.body.messages.map((m) => (m && m.role) || '?') : null,
      headerKeys: Object.keys(req.headers).filter((h) => h.indexOf('x-') === 0 || h === 'accept-language').sort(),
    });
    log('REQUEST SHAPE ' + JSON.stringify(notes[notes.length - 1]));
  }
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(o));
    return res;
  };
  // THE RAW REFERENCE IS TAKEN HERE, at the instant the handler hands each frame to the socket —
  // which is earlier than any point a proxy could observe and earlier than anything the browser
  // can see. That is what makes «the painting trails the arrival by N ms» a floor and not a guess.
  const isStream = name === 'ask' || name === 'chat' || name === 'chat-fast';
  if (isStream) {
    const write0 = res.write.bind(res);
    res.write = (chunk, ...rest) => {
      const s = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      for (const line of s.split('\n')) {
        if (!line.startsWith('data:')) continue;
        let obj = null;
        try { obj = JSON.parse(line.slice(5).trim()); } catch (e) { obj = null; }
        if (!obj) continue;
        rec.mark(obj.type || 'unknown', (obj.delta && obj.delta.text) || obj.text || '');
      }
      return write0(chunk, ...rest);
    };
  }
  const started = Date.now();
  res.on('finish', () => notes.push({ url, status: res.statusCode, ms: Date.now() - started, via: 'in-process handler' }));
  try {
    await mod.default(req, res);
  } catch (e) {
    notes.push({ url, error: String((e && e.message) || e).slice(0, 300) });
    try { if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); } res.end(JSON.stringify({ error: 'handler threw' })); } catch (e2) { /* gone */ }
  }
}

// ONE CLOCK FOR BOTH HALVES OF THE MEASUREMENT. The first version started the recorder's clock at
// its FIRST EVENT, while the page starts its own at the send -- so "the painting trails the arrival
// by N ms" was arithmetic between two different zeros, and it produced 20032ms for a run whose real
// answer was "the last slab painted in the same frame it arrived". reset() is called at the send
// and is the only thing that sets the origin; an event that arrives before it is impossible,
// because the request that produces it has not been made.
function makeRecorder() {
  const events = [];
  let t0 = null;
  return {
    events,
    mark(kind, text, extra) {
      const now = Date.now();
      if (t0 === null) t0 = now;
      events.push(Object.assign({ t: now - t0, kind, len: text ? String(text).length : 0, text: text ? String(text) : '' }, extra || {}));
    },
    reset() { events.length = 0; t0 = Date.now(); },
  };
}

function proxyUpstream(req, res, url, body, ctx, rec, notes) {
  const target = new URL(url, ctx.origin);
  const secure = target.protocol === 'https:';
  const headers = {
    'content-type': req.headers['content-type'] || 'application/json',
    'user-agent': req.headers['user-agent'] || 'ezik-102-measure/1.0',
    accept: req.headers.accept || '*/*',
  };
  // Only a protected origin needs the bypass, and only then is it sent. A local `vercel dev` has
  // no protection to bypass and must never be handed a secret it has no use for.
  if (ctx.bypass) headers['x-vercel-protection-bypass'] = ctx.bypass;
  // The app's own gates live behind these; they are forwarded verbatim rather than invented.
  for (const h of ['x-ezik-ai-consent', 'x-murabbi-device', 'x-ezik-founder', 'x-ezik-lang', 'accept-language']) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }
  const started = Date.now();
  const agent = secure ? https : http;
  const preq = agent.request({
    protocol: target.protocol, hostname: target.hostname,
    port: target.port || (secure ? 443 : 80),
    path: target.pathname + target.search,
    method: req.method, headers,
  }, (pres) => {
    notes.push({ url: target.pathname, status: pres.statusCode, vercelId: String(pres.headers['x-vercel-id'] || ''), ms: Date.now() - started });
    res.writeHead(pres.statusCode, {
      'Content-Type': pres.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    let carry = '';
    pres.on('data', (chunk) => {
      // Recorded BEFORE it is forwarded, so the recorded time is never later than the browser's.
      if (target.pathname === '/api/ask' || target.pathname === '/api/chat' || target.pathname === '/api/chat-fast') {
        carry += chunk.toString('utf8');
        let i;
        while ((i = carry.indexOf('\n\n')) !== -1) {
          const frame = carry.slice(0, i); carry = carry.slice(i + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            let obj = null;
            try { obj = JSON.parse(line.slice(5).trim()); } catch (e) { obj = null; }
            if (!obj) { rec.mark('raw', line, {}); continue; }
            const kind = obj.type || 'unknown';
            const text = (obj.delta && obj.delta.text) || obj.text || '';
            rec.mark(kind, text, {});
          }
        }
      }
      res.write(chunk);
    });
    pres.on('end', () => { rec.mark('http_end', ''); res.end(); });
  });
  preq.on('error', (e) => {
    notes.push({ url: target.pathname, error: String(e && e.message) });
    try { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'proxy', detail: String(e && e.message) })); } catch (e2) { /* gone */ }
  });
  if (body) preq.write(body);
  preq.end();
}

function emitReplay(res, timeline, rec) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' });
  let i = 0;
  const startedAt = Date.now();
  const tick = () => {
    if (i >= timeline.length) { rec.mark('http_end', ''); res.end(); return; }
    const ev = timeline[i];
    const payload = ev.kind === 'content_block_delta'
      ? { type: 'content_block_delta', delta: { type: 'text_delta', text: ev.text } }
      : { type: ev.kind };
    rec.mark(ev.kind, ev.text || '', {});
    res.write('data: ' + JSON.stringify(payload) + '\n\n');
    i += 1;
    if (i >= timeline.length) { setTimeout(tick, 5); return; }
    const wait = Math.max(0, timeline[i].t - (Date.now() - startedAt));
    setTimeout(tick, wait);
  };
  const first = Math.max(0, timeline.length ? timeline[0].t : 0);
  setTimeout(tick, first);
}

const SYNTH = Array.from({ length: 26 }, (_, i) =>
  'هذه جملة اصطناعية رقم ' + (i + 1) + ' وهي ليست جوابا من عزك، وانما نص موضوع لقياس الرسم وحده.')
  .join(' ');

function serve(ctx) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(String(req.url).split('?')[0]);
      if (url.startsWith('/api/')) {
        const chunks = [];
        req.on('data', (d) => chunks.push(d));
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (ctx.source === 'local') { callRealHandler(req, res, url, body, ctx.rec, ctx.notes); return; }
          if (ctx.source === 'preview') { proxyUpstream(req, res, req.url, body, ctx, ctx.rec, ctx.notes); return; }
          if (url === '/api/ask' || url === '/api/chat' || url === '/api/chat-fast') {
            if (ctx.source === 'replay') { emitReplay(res, ctx.timeline, ctx.rec); return; }
            // synthetic: one sentence-sized unit every 300ms, five of them in an opening slab.
            const parts = SYNTH.split(/(?<=\.)\s+/u);
            const tl = parts.map((p, k) => ({ t: k < 5 ? 1800 : 1800 + (k - 4) * 320, kind: 'content_block_delta', text: p + ' ' }));
            tl.push({ t: (tl[tl.length - 1] || { t: 0 }).t + 200, kind: 'message_stop', text: '' });
            emitReplay(res, tl, ctx.rec);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
        });
        return;
      }
      if (url === '/app.js') {
        res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
        res.end(ctx.appJs);
        return;
      }
      const file = path.join(REPO, url === '/' ? '/index.html' : url);
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('no'); return; }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(buf);
      });
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

// The version string MOVED out of index.html into app.jsx. It is read from the file rather than
// remembered, because a bumped string does not fail loudly — it silently declines the consent and
// the run walks into the consent wall instead of the chat.
const CONSENT_VERSION = (/^const EZ_AI_CONSENT_VERSION = '([^']+)';$/mu
  .exec(fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8')) || [])[1];
if (!CONSENT_VERSION) { console.log('FATAL  could not read EZ_AI_CONSENT_VERSION from app.jsx'); process.exit(2); }
// THE RECORD ANSWERS FOR A PROFILE, NOT A DEVICE (app.jsx:3348-3363). A seeded record with no
// `pid` reads back as null, `aiConsentAnswered()` is false, and the run meets the consent wall
// with a version string that was perfectly correct. The pid must equal `child_profile.pid`.
const PROFILE_PID = 'item102-measure';
const AI_CONSENT = JSON.stringify({ status: 'granted', version: CONSENT_VERSION, pid: PROFILE_PID, grantedBy: 'user', at: '2026-09-16T00:00:00.000Z' });
// An ADULT reader, because §7's questions are adult questions and the band decides the answer's
// shape. `depthMode` is left at its own default, which is 'brief' — الموجز — and the run asserts
// that rather than clicking the toggle.
const PROFILE = JSON.stringify({ name: 'خالد', gender: 'male', birthYear: 1990, age: 36, pid: PROFILE_PID });

// ── THE RECORDER THAT LIVES IN THE PAGE ─────────────────────────────────────────────────────
// Installed before any document script runs, so it is armed before the app boots and cannot
// miss the opening of a turn.
//
// ONE requestAnimationFrame LOOP, because a frame is the unit the reader actually experiences:
// two changes inside one frame are one thing seen, and a change that lands between frames is not
// seen until the next one. Sampling on a timer would report writes; sampling on a frame reports
// SIGHTINGS.
const RECORDER = `
(function () {
  var S = { on: false, t0: 0, frames: [], heads: [], notes: [], raf: 0, lastLen: -1 };
  function scroller() { return document.querySelector('.ezc-scroll'); }
  function anchorEl() { return document.querySelector('[data-ezik-ask-pin]'); }
  function padEl() { return document.querySelector('[data-ezik-ask-pad]'); }
  // The live bubble is the LAST assistant turn in the scroller. While a turn is in flight that is
  // the streaming preview; the moment it completes, the same position holds the committed reply,
  // which is exactly what the reader sees in that spot and therefore what should be counted.
  function liveBubble() {
    var el = scroller(); if (!el) return null;
    var t = el.querySelectorAll('.ezc-turn.is-ai');
    return t.length ? t[t.length - 1] : null;
  }
  // THE QUESTION ITSELF, AND IT OUTLIVES THE PIN. The data-ezik-ask-pin marker is mounted only
  // while pinnedAskIndex is set, so the instant the turn ends it is gone — and «where did the view
  // go when the turn ended?» is precisely the question that cannot be asked of an element that
  // left at the same moment. The reader's own question bubble stays in the transcript forever, so
  // its distance from the top of the scroller is the one reading that spans the whole run.
  function questionEl() {
    var el = scroller(); if (!el) return null;
    var u = el.querySelectorAll('.ezc-turn.is-user');
    return u.length ? u[u.length - 1] : null;
  }
  // ── EVERYTHING BELOW THE READER'S QUESTION ──────────────────────────────────────────────────
  // MEASURED and it changes the instrument: on a turn where the server releases nothing early,
  // the streaming preview bubble never holds a single character of the answer. The
  // whole reply lands in the COMMITTED bubble, which carries no class of its own -- app.jsx:18903
  // is the only site of the class in the file. An instrument that watched only the preview
  // reported «0 paint updates» for a turn in which the reader plainly saw 369 characters appear.
  //
  // So what is counted is what the reader looks at: every element after the last question bubble.
  // That spans the preview AND the committed reply and needs to know which is which no more than
  // the reader does.
  function answerArea() {
    var el = scroller(); if (!el) return [];
    var kids = Array.prototype.slice.call(el.children);
    var lastQ = -1;
    for (var i = 0; i < kids.length; i += 1) {
      if (kids[i].className && String(kids[i].className).indexOf('is-user') !== -1) lastQ = i;
    }
    return kids.slice(lastQ + 1);
  }
  function areaText() {
    var out = '';
    var k = answerArea();
    for (var i = 0; i < k.length; i += 1) out += k[i].textContent || '';
    return out;
  }
  function painted() {
    var b = liveBubble(); if (!b) return '';
    // The three animated dots and the waiting hint occupy the same box before any answer text
    // exists. They are recorded as text like anything else and separated afterwards by their
    // head, rather than being guessed at here.
    return b.textContent || '';
  }
  function frame() {
    if (!S.on) return;
    S.raf = requestAnimationFrame(frame);
    var now = performance.now() - S.t0;
    var el = scroller();
    var a = anchorEl();
    var p = padEl();
    var txt = painted();
    var area = areaText();
    var off = null;
    var qoff = null;
    if (el) {
      var top = el.getBoundingClientRect().top;
      if (a) off = Math.round(a.getBoundingClientRect().top - top);
      var q = questionEl();
      if (q) qoff = Math.round(q.getBoundingClientRect().top - top);
    }
    S.frames.push([
      Math.round(now),
      el ? Math.round(el.scrollTop) : -1,
      el ? Math.round(el.scrollHeight) : -1,
      el ? Math.round(el.clientHeight) : -1,
      off === null ? -99999 : off,
      p ? Math.round(p.offsetHeight) : 0,
      (el && el.className.indexOf('ezc-askpinned') !== -1) ? 1 : 0,
      area.length,
      qoff === null ? -99999 : qoff,
      txt.length
    ]);
    if (area.length !== S.lastLen) {
      // IS THIS THE ANSWER, OR IS IT STILL THE WAITING STATE? The ternary at app.jsx:18905 is
      // exclusive: either the markdown of the arrived text, or the dots — and the dots branch and
      // the waiting-hint branch BOTH end in exactly three U+25CF. The answer branch contains none.
      // So the presence of a single bullet is a complete and exact discriminator, and it needs to
      // know nothing about what the hint says in any language.
      var isAnswer = area.length > 0 && area.indexOf('●') === -1;
      S.heads.push([Math.round(now), area.length, area.slice(0, 14), area.slice(-10), isAnswer ? 1 : 0, txt.length]);
      S.lastLen = area.length;
    }
  }
  window.__EZ102 = {
    start: function () {
      S.on = true; S.t0 = performance.now(); S.frames = []; S.heads = []; S.lastLen = -1;
      S.raf = requestAnimationFrame(frame);
      return true;
    },
    stop: function () { S.on = false; try { cancelAnimationFrame(S.raf); } catch (e) {} return S.frames.length; },
    dump: function () { return { frames: S.frames, heads: S.heads, notes: S.notes }; },
    note: function (n) { S.notes.push([Math.round(performance.now() - S.t0), n]); },
  };
})();
`;

// A BACKTICK INSIDE THE IN-PAGE SOURCE ENDS THE TEMPLATE LITERAL AND TURNS THE REST OF THE
// COMMENT INTO CODE. `node --check` passes it happily -- the failure is a ReferenceError at
// require time -- and it cost four real, paid-for answers before it was noticed. So it is checked
// here, where the cost is zero.
for (const [name, src] of [['RECORDER', RECORDER]]) {
  if (src.indexOf(String.fromCharCode(96)) !== -1) throw new Error(name + ' contains a backtick');
}

async function openPage(cdn) {
  const userDir = path.join(os.tmpdir(), 'ezik-102-' + Math.floor(Math.random() * 1e9));
  // 430x932 is the phone the item's own history was measured on (app.jsx:16072), so the numbers
  // here and the numbers in that comment are about the same screen.
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + userDir,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--window-size=430,932', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let port = null;
  await new Promise((res, rej) => {
    let buf = '';
    const to = setTimeout(() => rej(new Error('no debug port')), 30000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\//u);
      if (m && !port) { port = parseInt(m[1], 10); clearTimeout(to); res(); }
    });
  });
  const targets = await httpGetJson('http://127.0.0.1:' + port + '/json/list');
  const ws = new WS(targets.filter((t) => t.type === 'page')[0].webSocketDebuggerUrl);
  await ws.ready;
  const cdp = new CDP(ws);
  await cdp.cmd('Page.enable');
  await cdp.cmd('Runtime.enable');
  // ── THE TRAP THAT SILENTLY MEASURES THE WRONG PATH ──────────────────────────────────────────
  // HEADLESS CHROME ANSWERS `(prefers-reduced-motion: reduce)` WITH `true` BY DEFAULT. app.jsx:15160
  // hands the whole arrived text to the state setter and never starts the ticker when that is so,
  // by design — «a reader who has asked for less movement is not asking for a typewriter». So a
  // measurement taken in an un-emulated headless browser is a measurement of the queue being
  // SKIPPED, and it reports one paint per delta with a perfectly straight face. MEASURED: 24 paint
  // updates for 26 deltas, mean 80.7 characters, which is exactly the arrival pattern and not the
  // queue's output at all.
  //
  // So the ordinary reader's preference is emulated, and it is also READ BACK below and recorded,
  // because an emulation that silently failed would put the run straight back in the same hole.
  await cdp.cmd('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await cdp.cmd('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
  const logs = [];
  ws.handlers.push(async (m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      const ex = d.exception || {};
      logs.push('EXCEPTION ' + String(d.text || '') + ' :: ' + String(ex.description || ex.value || '').slice(0, 300));
    }
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    const body = cdn.get(request.url);
    try {
      if (body) {
        await cdp.cmd('Fetch.fulfillRequest', {
          requestId, responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'text/javascript; charset=utf-8' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
          ],
          body: body.toString('base64'),
        });
      } else {
        await cdp.cmd('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      }
    } catch (e) { /* the page went away mid-flight */ }
  });
  await cdp.cmd('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("child_profile", ' + JSON.stringify(PROFILE) + ');'
      + 'localStorage.setItem("ezik_ai_consent_v1", ' + JSON.stringify(AI_CONSENT) + ');}catch(e){}\n' + RECORDER,
  });
  const loaded = new Promise((r) => { ws.handlers.push((m) => { if (m.method === 'Page.loadEventFired') r(); }); });
  await cdp.cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' });
  await loaded;
  const started = Date.now();
  for (;;) {
    const ready = await cdp.evaluate('(function(){try{return document.querySelectorAll("button,textarea,input").length > 0;}catch(e){return false;}})()');
    if (ready) break;
    if (Date.now() - started > 60000) throw new Error('index.html never booted');
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    cdp, logs,
    run: (e) => cdp.evaluate(e),
    close: async () => {
      ws.close(); proc.kill();
      await new Promise((r) => setTimeout(r, 300));
      try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { /* windows */ }
    },
  };
}

const H = `
  const QQ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const txt = (el) => String((el && (el.innerText || el.textContent)) || '');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = () => QQ('textarea').filter((t) => !t.disabled)[0] || null;
  const setValue = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
`;

// A NAMED WALK, NOT «press the last enabled button». The generic walk was tried and it is a trap
// here: the consent screen's LAST button is «استخدام عزك دون الذكاء الاصطناعي», which puts the app
// in local mode, and from there the walk wanders into the prayer sheet and there is no composer on
// it. With the profile and the consent seeded there is nothing to press but the caveat, and the
// only button this presses is the one whose own text says so.
const REACH_COMPOSER = `(async () => {${H}
  const trail = [];
  const WANTED = ['فهمت', 'حسنًا', 'حسنا', 'متابعة'];
  for (let step = 0; step < 10 && !box(); step += 1) {
    const buttons = QQ('button').filter((b) => !b.disabled && txt(b).trim());
    trail.push({ step, buttons: buttons.map((b) => txt(b).trim().slice(0, 24)) });
    const hit = buttons.filter((b) => WANTED.indexOf(txt(b).trim()) !== -1)[0];
    if (!hit) break;
    hit.click();
    await sleep(600);
  }
  return { composer: !!box(), trail };
})()`;

// ── analysis, in Node, over the raw frame table ─────────────────────────────────────────────
function analyse(dump, rec) {
  const F = dump.frames;
  const heads = dump.heads;
  // WHICH HEADS ARE ANSWER TEXT. Before any answer exists the same box holds three dots, and
  // sometimes a waiting hint. Both are separated from the answer by a DROP in length: the
  // ternary in app.jsx:18905 REPLACES that node with the markdown one, so the first answer
  // sighting is the first head after the last decrease, and the dots/hint are whatever came
  // before it. Nothing here needs to know what the hint says.
  //
  // AND THE RUN IS TRIMMED AT BOTH ENDS. The preview bubble is RETIRED when the turn completes —
  // `.ezc-turn.is-ai` exists for the stream and for nothing else (app.jsx:18903 is its only site),
  // so the last head of every run is a drop to zero. That drop is the most useful marker in the
  // table and the worst possible choice of «where the answer started», which is what taking the
  // last decrease over the untrimmed array picked.
  let last = heads.length;
  while (last > 0 && heads[last - 1][1] === 0) last -= 1;
  const previewRetiredMs = last < heads.length ? heads[last][0] : null;
  const answer = heads.slice(0, last).filter((h) => h[4] === 1);
  const waitHeads = heads.slice(0, last).filter((h) => h[4] !== 1);
  const firstCharMs = answer.length ? answer[0][0] : null;
  const steps = [];
  for (let i = 1; i < answer.length; i += 1) steps.push({ t: answer[i][0], add: answer[i][1] - answer[i - 1][1], gap: answer[i][0] - answer[i - 1][0] });
  const positive = steps.filter((s) => s.add > 0);
  const adds = positive.map((s) => s.add);
  const gaps = positive.map((s) => s.gap);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

  // ── THE PIN ─────────────────────────────────────────────────────────────────────────────
  // Three different facts, and they are NOT the same:
  //   · pinned CLASS — keyed on pinnedAskIndex, so it survives the breaker (app.jsx:18832).
  //   · the SPACER — collapses to 0 when the breaker fires AND when the turn ends.
  //   · the OFFSET — where the question actually sits. This is the one the reader sees.
  const withAnchor = F.filter((f) => f[4] !== -99999);
  const lastFrame = F.length ? F[F.length - 1] : null;
  const classDropIdx = F.findIndex((f, i) => i > 0 && F[i - 1][6] === 1 && f[6] === 0);
  const padDropIdx = F.findIndex((f, i) => i > 0 && F[i - 1][5] > 0 && f[5] === 0);
  const answerEndMs = answer.length ? answer[answer.length - 1][0] : null;
  const offsets = withAnchor.map((f) => f[4]);
  const maxAbsOff = offsets.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  // Where the view ENDED UP: the distance from the bottom of the scroll range in the last frame.
  const endBelow = lastFrame ? (lastFrame[2] - lastFrame[1] - lastFrame[3]) : null;

  // ── THE QUESTION, MEASURED ACROSS THE WHOLE RUN ────────────────────────────────────────────
  // This is the owner's own sentence turned into a number: «الشاشه تكون ثابته على رأس السؤال».
  // Frame 8 is the reader's question bubble, which outlives the pin, so the reading spans the
  // turn AND the seconds after it.
  const withQ = F.filter((f) => f[8] !== -99999);
  const qEnd = withQ.length ? withQ[withQ.length - 1][8] : null;
  // The MOVE at the end of the turn: where the question was in the last frame that still had the
  // pin anchor, against where it is in the last frame of the run.
  const lastPinnedFrame = withAnchor.length ? withAnchor[withAnchor.length - 1] : null;
  const qAtPinLoss = lastPinnedFrame ? lastPinnedFrame[8] : null;
  const qDriftAtEnd = (qAtPinLoss !== null && qAtPinLoss !== -99999 && qEnd !== null) ? qEnd - qAtPinLoss : null;
  // And the WORST it got while the answer was still arriving, which is defect ب's other half.
  const qDuring = withQ.filter((f) => answerEndMs === null || f[0] <= answerEndMs).map((f) => f[8]);
  const qMaxDuring = qDuring.length ? Math.max(...qDuring.map((v) => Math.abs(v))) : null;

  const rawDeltas = rec.events.filter((e) => e.kind === 'content_block_delta');
  const rawGaps = [];
  for (let i = 1; i < rawDeltas.length; i += 1) rawGaps.push(rawDeltas[i].t - rawDeltas[i - 1].t);

  return {
    frames: F.length,
    fps: F.length > 1 ? Math.round((F.length - 1) * 1000 / (F[F.length - 1][0] - F[0][0])) : null,
    firstCharMs,
    paintUpdates: positive.length,
    charsTotal: answer.length ? answer[answer.length - 1][1] : 0,
    previewCharsMax: heads.reduce((m, h) => Math.max(m, h[5] || 0), 0),
    previewEverPainted: heads.some((h) => (h[5] || 0) > 3),
    waitStateUpdates: waitHeads.length,
    addMean: adds.length ? Math.round(sum(adds) / adds.length * 10) / 10 : null,
    addMedian: pct(adds, 0.5),
    addP90: pct(adds, 0.9),
    addMax: adds.length ? Math.max(...adds) : null,
    gapMean: gaps.length ? Math.round(sum(gaps) / gaps.length) : null,
    gapMedian: pct(gaps, 0.5),
    gapP90: pct(gaps, 0.9),
    gapMax: gaps.length ? Math.max(...gaps) : null,
    // «a jump the eye reads as a flash»: how much of the answer arrived in updates of 40+ chars.
    bigUpdateShare: adds.length ? Math.round(sum(adds.filter((a) => a >= 40)) / sum(adds) * 100) : null,
    answerEndMs,
    paintTrailMs: answerEndMs !== null && rawDeltas.length ? answerEndMs - rawDeltas[rawDeltas.length - 1].t : null,
    previewRetiredMs,
    questionOffsetMaxDuring: qMaxDuring,
    questionOffsetAtPinLoss: qAtPinLoss,
    questionOffsetAtEnd: qEnd,
    questionDriftAtEnd: qDriftAtEnd,
    pinClassDropMs: classDropIdx > 0 ? F[classDropIdx][0] : null,
    padDropMs: padDropIdx > 0 ? F[padDropIdx][0] : null,
    padDropBeforeAnswerEnd: (padDropIdx > 0 && answerEndMs !== null) ? F[padDropIdx][0] < answerEndMs - 200 : null,
    anchorFrames: withAnchor.length,
    maxAbsOffsetDuring: maxAbsOff,
    offsetAtEnd: lastFrame ? (lastFrame[4] === -99999 ? 'anchor gone' : lastFrame[4]) : null,
    scrollTopEnd: lastFrame ? lastFrame[1] : null,
    scrollTopMax: F.length ? Math.max(...F.map((f) => f[1])) : null,
    belowAtEnd: endBelow,
    atBottomAtEnd: endBelow !== null ? endBelow < 4 : null,
    rawDeltaCount: rawDeltas.length,
    rawFirstDeltaMs: rawDeltas.length ? rawDeltas[0].t : null,
    rawLastDeltaMs: rawDeltas.length ? rawDeltas[rawDeltas.length - 1].t : null,
    rawLenMean: rawDeltas.length ? Math.round(sum(rawDeltas.map((d) => d.len)) / rawDeltas.length) : null,
    rawLenMax: rawDeltas.length ? Math.max(...rawDeltas.map((d) => d.len)) : null,
    rawGapMax: rawGaps.length ? Math.max(...rawGaps) : null,
    rawGapMedian: pct(rawGaps, 0.5),
  };
}

async function main() {
  if (!CHROME) { log('FATAL  no Chrome'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const envInfo = SOURCE === 'local' ? loadDotEnvLocal() : { applied: [], missing: true };
  let kv = null;
  if (SOURCE === 'local' && !process.env.KV_REST_API_URL) {
    kv = await kvStub();
    process.env.KV_REST_API_URL = 'http://127.0.0.1:' + kv.port;
    process.env.KV_REST_API_TOKEN = 'item102-local-stub';
    envInfo.kvStubbed = true;
  }
  const app = servedAppJs();
  const ctx = {
    source: SOURCE, appJs: app.body, rec: makeRecorder(), notes: [], timeline: [],
    origin: ARG.origin || (SOURCE === 'local' ? LOCAL : PREVIEW),
    bypass: SOURCE === 'preview' ? readBypass() : null,
  };
  if (SOURCE === 'preview' && !ctx.bypass) {
    log('FATAL  --source=preview needs the Vercel protection-bypass secret.');
    log('       Put it in ' + BYPASS_FILE + ' (outside the repo) or in $VERCEL_AUTOMATION_BYPASS_SECRET.');
    process.exit(2);
  }
  if (SOURCE === 'replay') {
    if (!REPLAY_FILE || !fs.existsSync(REPLAY_FILE)) { log('FATAL  --replay=<recorded.json> is required'); process.exit(2); }
    const rf = JSON.parse(fs.readFileSync(REPLAY_FILE, 'utf8'));
    ctx.timeline = rf.timeline || [];
    if (!ctx.timeline.length) { log('FATAL  the replay file has no timeline'); process.exit(2); }
  }

  log('SOURCE        ' + SOURCE + (SOURCE === 'synthetic' ? '   *** SYNTHETIC — NOT EVIDENCE ABOUT EZIK ***' : ''));
  if (SOURCE === 'preview') log('ORIGIN        ' + ctx.origin);
  if (SOURCE === 'local') {
    log('ORIGIN        api/*.js imported into THIS process');
    log('ENV           ' + envInfo.applied.length + ' non-empty names applied from .env.local');
    log('              flags: STREAM_V1=' + (process.env.STREAM_V1 || '(unset -> code default)')
      + '  FREE_BRAIN_V1=' + (process.env.FREE_BRAIN_V1 || '(unset -> code default)')
      + '  LEDGER_RAG=' + (process.env.LEDGER_RAG || '(unset)')
      + '  DAY_CAP=' + (process.env.DAY_CAP || '(unset)')
      + '  KV=' + (envInfo.kvStubbed ? 'LOCAL COUNTER STUB (answer untouched)' : (process.env.KV_REST_API_URL ? 'configured' : 'UNSET')));
  }
  log('LABEL         ' + LABEL);
  log('QUESTION      #' + QN + '  ' + esc(QUESTIONS[QN - 1]));
  log('APP.JS        ' + (app.patched ? 'PATCHED IN MEMORY  ' + app.applied.join('  ') : 'served byte for byte from disk'));
  log('CONSENT       ' + CONSENT_VERSION);

  const cdn = await cdnCache();
  const srv = await serve(ctx);
  const page = await openPage(cdn);
  let out = null;
  try {
    const reached = await page.run(REACH_COMPOSER);
    if (!reached || !reached.composer) { log('FATAL  composer unreachable ' + JSON.stringify(reached)); return; }

    // §7 is «in الموجز». depthMode's own default is 'brief'; that is ASSERTED here rather than
    // achieved by clicking, because a click that lands on the wrong control would silently
    // measure the detailed mode and call it brief.
    const depth = await page.run(`(function(){${H}
      const b = QQ('button').filter((x) => x.getAttribute('aria-label'));
      const lab = b.map((x) => x.getAttribute('aria-label'));
      return {
        labels: lab.slice(0, 40),
        reduceMedia: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
        motionAttr: document.documentElement.getAttribute('data-ez-motion'),
      };
    })()`);
    // ── §7: THE DEPTH IS ASSERTED, AND SWITCHED ONLY ON REQUEST ─────────────────────────────
    // `depthMode` starts at 'brief' (app.jsx:14868), so الموجز needs no click -- but «it is the
    // default» is a claim about source, and what the run needs is the state of the control on the
    // screen in front of it. The pill carries its own current mode as its aria-label, so the mode
    // can be read rather than assumed, and --depth=detailed presses that same pill exactly once
    // and reads it back. A run that cannot confirm the mode does not measure it.
    const DEPTH_BRIEF = 'موجز';            // موجز
    const DEPTH_DETAILED = 'مفصّل';   // مفصّل
    const wantDetailed = (ARG.depth || 'brief') === 'detailed';
    const depthNow = await page.run(`(async () => {${H}
      const pill = () => QQ('button').filter((b) => b.getAttribute('aria-label') === ${JSON.stringify(DEPTH_BRIEF)}
        || b.getAttribute('aria-label') === ${JSON.stringify(DEPTH_DETAILED)})[0] || null;
      const p = pill();
      if (!p) return { mode: null };
      if (${wantDetailed ? 'true' : 'false'} && p.getAttribute('aria-label') === ${JSON.stringify(DEPTH_BRIEF)}) {
        p.click();
        await sleep(400);
      }
      const q = pill();
      return { mode: q ? q.getAttribute('aria-label') : null };
    })()`);
    const depthMode = depthNow && depthNow.mode === DEPTH_DETAILED ? 'detailed'
      : (depthNow && depthNow.mode === DEPTH_BRIEF ? 'brief' : 'UNREADABLE');
    log('DEPTH         ' + depthMode + (depthMode === (wantDetailed ? 'detailed' : 'brief') ? '  (as asked)' : '   *** NOT THE MODE THIS RUN ASKED FOR ***'));
    if (depthMode !== (wantDetailed ? 'detailed' : 'brief')) { log('FATAL  the depth control does not read back as requested'); return; }

    const reduced = depth.reduceMedia || depth.motionAttr === 'reduce';
    log('REDUCED MOTION  media=' + depth.reduceMedia + '  html[data-ez-motion]=' + depth.motionAttr
      + (reduced ? '   *** THE REVEAL QUEUE IS BYPASSED — THIS RUN MEASURES ARRIVAL, NOT PAINTING ***' : '   (the queue is live)'));

    // THE TWO CLOCKS ARE STARTED WITHIN ONE ROUND TRIP OF EACH OTHER. Typing into the composer and
    // waiting for React to flush takes ~400ms, so resetting the recorder BEFORE all of that put its
    // zero most of half a second ahead of the page's. The field is filled first, and only then are
    // both clocks started and the button pressed -- one CDP round trip apart, which is the residual
    // tolerance on every arrival-versus-paint number in this file.
    const filled = await page.run(`(async () => {${H}
      const t = box();
      if (!t) return { error: 'no composer' };
      setValue(t, ${JSON.stringify(QUESTIONS[QN - 1])});
      await sleep(400);
      return { filled: t.value.length };
    })()`);
    if (!filled || !filled.filled) { log('FATAL  could not fill the composer ' + JSON.stringify(filled)); return; }
    ctx.rec.reset();
    if (SOURCE === 'local') armFetchLog(Date.now());
    const sent = await page.run(`(async () => {${H}
      // THE SEND BUTTON IS NO LONGER THE TEXTAREA'S SIBLING. Item 05-F moved it out of the field
      // row into its own control row (app.jsx:19113), so the older tool's
      // t.parentElement.querySelector of a button now finds nothing at all. Send is the FIRST
      // button of the tool row: the source order is documented there as send, mic, call, which
      // is also the order the eye reads right-to-left.
      const bar = document.querySelector('.ez-hit');
      const send = bar ? bar.querySelector('button') : null;
      if (!send) return { error: 'no send button' };
      if (send.disabled) return { error: 'send disabled' };
      window.__EZ102.start();
      send.click();
      return { sent: true };
    })()`);
    if (!sent || !sent.sent) { log('FATAL  send failed ' + JSON.stringify(sent)); return; }
    log('SENT          waiting for the turn to finish...');

    // Wait for the turn to end (composer re-enabled), then keep recording for a further
    // SAMPLE_AFTER_MS — §4/١ asks where the view sits TWO SECONDS AFTER the end, and that is a
    // different number from where it sat at the end.
    // POLLED FROM NODE, IN SHORT CALLS. A single long-running in-page await races the CDP command
    // timeout, and when they are set to the same number the run dies with `timeout:
    // Runtime.evaluate` and throws away a real, complete, paid-for answer. MEASURED once, at
    // exactly the 180s boundary. Each probe below is a few milliseconds and the waiting is done
    // here, where no timeout is watching.
    const waitStarted = Date.now();
    let endedMs = null;
    for (;;) {
      const free = await page.run('(function(){try{var t=Array.prototype.slice.call(document.querySelectorAll("textarea")).filter(function(x){return !x.disabled;})[0];return !!t;}catch(e){return false;}})()');
      if (free) { endedMs = Date.now() - waitStarted; await page.run('window.__EZ102.note("turn-end")'); break; }
      if (Date.now() - waitStarted > 600000) { await page.run('window.__EZ102.note("timeout")'); break; }
      await new Promise((r) => setTimeout(r, 250));
    }
    const done = { endedMs };
    await new Promise((r) => setTimeout(r, SAMPLE_AFTER_MS));
    await page.run('window.__EZ102.stop()');
    const dump = await page.run('window.__EZ102.dump()');

    const a = analyse(dump, ctx.rec);
    out = {
      meta: {
        label: LABEL, source: SOURCE, question: QN, questionText: QUESTIONS[QN - 1],
        at: new Date().toISOString(), head: null,
        appJsPatched: app.patched, appJsPatches: app.applied,
        revealMs: OVERRIDE.ms, revealDivisor: OVERRIDE.div, revealMinStep: OVERRIDE.min, revealMaxStep: OVERRIDE.max,
        turnEndedAfterMs: done.endedMs, sampledAfterEndMs: SAMPLE_AFTER_MS,
        viewport: '430x932', depthLabels: (depth && depth.labels) || [],
        reducedMotion: reduced, reduceMedia: depth.reduceMedia, motionAttr: depth.motionAttr,
        depthMode,
        envNamesApplied: envInfo.applied, kvStubbed: !!envInfo.kvStubbed, envUnset: ['FREE_BRAIN_V1','STREAM_V1','LEDGER_RAG','DAY_CAP','KV_REST_API_URL','MODEL_STANDARD','BRAVE_API_KEY'].filter((k) => !process.env[k]),
      },
      summary: a,
      httpNotes: ctx.notes,
      outboundCalls: FETCH_LOG || [],
      // The recorded arrival pattern, kept in a shape --source=replay can re-emit.
      timeline: ctx.rec.events.map((e) => ({ t: e.t, kind: e.kind, len: e.len })),
      frames: dump.frames,
      heads: dump.heads.map((h) => [h[0], h[1], esc(h[2]), esc(h[3]), h[4], h[5]]),
      pageExceptions: page.logs,
    };
    // The replayable timeline needs the TEXT, and only a preview run has it. It is written to a
    // sibling file so the measurement record itself stays small and free of answer prose.
    if (SOURCE === 'preview' || SOURCE === 'local') {
      fs.writeFileSync(path.join(OUT_DIR, LABEL + '-q' + QN + '-timeline.json'),
        JSON.stringify({ meta: out.meta, timeline: ctx.rec.events }, null, 1));
    }
    log('');
    log('--- PAINT ---------------------------------------------------------');
    log('  frames sampled            ' + a.frames + '   (~' + a.fps + ' fps)');
    log('  first PAINTED character   ' + a.firstCharMs + ' ms after send');
    log('  paint updates             ' + a.paintUpdates);
    log('  chars painted, total      ' + a.charsTotal);
    log('  the LIVE preview bubble    ' + (a.previewEverPainted ? 'painted up to ' + a.previewCharsMax + ' chars' : 'NEVER held one character of the answer'));
    log('  chars per update  mean    ' + a.addMean + '   median ' + a.addMedian + '   p90 ' + a.addP90 + '   MAX ' + a.addMax);
    log('  gap between updates ms    mean ' + a.gapMean + '   median ' + a.gapMedian + '   p90 ' + a.gapP90 + '   MAX ' + a.gapMax);
    log('  share of the answer arriving in updates of 40+ chars   ' + a.bigUpdateShare + '%');
    log('  last paint                ' + a.answerEndMs + ' ms   (trailing the last delta by ' + a.paintTrailMs + ' ms)');
    log('--- RAW ARRIVAL (server side of the same run) ---------------------');
    log('  text_delta events         ' + a.rawDeltaCount);
    log('  first / last delta ms     ' + a.rawFirstDeltaMs + ' / ' + a.rawLastDeltaMs);
    log('  delta length  mean/max    ' + a.rawLenMean + ' / ' + a.rawLenMax);
    log('  delta gap  median/max ms  ' + a.rawGapMedian + ' / ' + a.rawGapMax);
    log('--- THE PAGE ------------------------------------------------------');
    log('  frames with the anchor    ' + a.anchorFrames);
    log('  max |pin anchor offset|   ' + a.maxAbsOffsetDuring + ' px  (0 = pinned at the top)');
    log('  THE QUESTION BUBBLE, px from the top of the scroller:');
    log('    worst while writing     ' + a.questionOffsetMaxDuring);
    log('    at the last pinned frame' + '  ' + a.questionOffsetAtPinLoss);
    log('    at the end of the run   ' + a.questionOffsetAtEnd);
    log('    >>> DRIFT AT THE END    ' + a.questionDriftAtEnd + ' px');
    log('  preview bubble retired at ' + a.previewRetiredMs + ' ms');
    log('  spacer collapsed at       ' + a.padDropMs + ' ms' + (a.padDropBeforeAnswerEnd ? '   *** BEFORE the answer finished ***' : ''));
    log('  pinned class dropped at   ' + a.pinClassDropMs + ' ms');
    log('  offset ' + SAMPLE_AFTER_MS + 'ms after the end  ' + a.offsetAtEnd);
    log('  scrollTop end / max       ' + a.scrollTopEnd + ' / ' + a.scrollTopMax);
    log('  px below the view at end  ' + a.belowAtEnd + '   at the bottom? ' + a.atBottomAtEnd);
    log('--- OUTBOUND (what the handler called, and when) -------------------');
    for (const n of (FETCH_LOG || [])) log('  +' + String(n.at).padStart(6) + 'ms  ' + String(n.ms).padStart(6) + 'ms  ' + (n.status || n.error) + '  ' + n.url);
    log('--- HTTP ----------------------------------------------------------');
    for (const n of ctx.notes) log('  ' + JSON.stringify(n));
    if (page.logs.length) log('--- PAGE EXCEPTIONS ---\n  ' + esc(page.logs.join('\n  ')));
  } finally {
    await page.close();
    srv.close();
    if (kv) kv.srv.close();
  }
  if (out) {
    const file = path.join(OUT_DIR, LABEL + '-q' + QN + '.json');
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    log('');
    log('WROTE  ' + file);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
