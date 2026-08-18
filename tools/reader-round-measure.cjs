// ============================================================================
// §٤ (D): THE BROWSER ROUND — THE FOUR READERS, AND A CODE ANSWER, IN A REAL PAGE
// ============================================================================
//
// WHAT THIS IS FOR. Every assertion about the four readers and about the delivery filter lives in
// a guard that drives a MODULE. A module is not a screen, and «`<incomplete/>` لا تظهرُ نصًّا
// بحال» is a claim about a screen. So this drives the real `index.html` in a real headless Chrome,
// with a real render and a real DOM read, and asks the page itself.
//
// WHY IT IS NOT A GATE. It needs a browser and the network (the three CDN bundles the page loads
// under SRI), so it is a MEASUREMENT that is run and recorded, on the model of
// `tools/latin-line-measure.mjs`, and not an entry in `gates.json`.
//
// THE NETWORK IS TAKEN OUT ONCE AND THEN NEVER AGAIN. The CDN bundles are fetched to a cache on
// the first run and replayed to the page byte for byte through `Fetch.fulfillRequest`, so the
// `integrity=` attributes in index.html still validate and the page runs precisely its own code.
// Everything else — `/api/*` above all — is served from this file, so no turn of this measurement
// reaches a model, a deployment or a key.
//
//   node tools/reader-round-measure.cjs
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
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const PORT = 8987;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter((p) => fs.existsSync(p))[0];
const CDN_CACHE = path.join(os.tmpdir(), 'ezik-cdn-cache');

let pass = 0;
let fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass += 1; console.log('  PASS  ' + label); return true; }
  fail += 1;
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + String(detail).slice(0, 600)));
  return false;
};
// Every line this file prints is ASCII: an Arabic string on a Windows terminal is a mojibake
// report, not evidence. Arabic is compared INSIDE the page and reported as a verdict.
const shape = (s) => String(s === undefined || s === null ? '' : s)
  .replace(/[^\x20-\x7e\n]/g, '#').replace(/#+/g, '#');
// ...and when the VALUE matters rather than its shape — a label to be recognised — every
// non-ASCII code point is escaped instead, which is still ASCII on the wire.
const esc = (v) => Array.from(String(v === undefined || v === null ? '' : v))
  .map((c) => (c.codePointAt(0) < 128 ? c : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')))
  .join('');

// ── the two payloads the page is given ──────────────────────────────────────────────────────
// A: an answer the writing round did not finish, so api/ask.js appended the marker.
// WRITTEN WITHOUT HARAKAT ON PURPOSE. The page strips them before it paints, so a vocalised
// payload and an unvocalised screen never match, and the run then reports «the answer never
// arrived» about an answer that is plainly on the screen.
const ANSWER_INCOMPLETE = 'الجمع بين الصلاتين للمسافر جائز عند الحاجة، وقد ثبت ذلك عن النبي ﷺ.\n'
  + 'وأما مدته فتفصيلها أن المسافر إذا نوى الإقامة<incomplete/>';
// B: §٤'s fourth witness, re-run. The raw text is what a model writes when it is asked for a zakat
// function; what the page is served is what THIS TREE'S delivery filter makes of it, so the screen
// shows the real post-fix output and not a hand-written ideal of it.
const RAW_CODE_ANSWER = [
  'سأبحث لك في المسألة أوّلًا.',
  'نصابُ الزكاةِ في المالِ هو ما يعادلُ ٨٥ جرامًا من الذهب، والمقدارُ ربعُ العشر.',
  '',
  'function calculateZakat(amount) {',
  '  const nisab = 85 * 20; // مثال تقريبي بوحدات الذهب، يُحدَّد فعليًا بسعر السوق',
  '  if (amount < nisab) {',
  '    return 0;',
  '  }',
  '  const zakat = amount * 0.025;',
  '}',
  '// مثال على الاستخدام',
  'const money = 10000;',
  'const zakat = calculateZakat(money);',
  'console.log("زكاة المال المستحقة: " + zakat);',
  '',
  'وهذا حسابٌ تقريبيٌّ، والعبرةُ بسعرِ الذهبِ يومَ وجوبِ الزكاة.',
].join('\n');

// ── plumbing: a websocket and a CDP client, the same shape quest-ux-guard.cjs uses ───────────
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
      }, 90000);
    });
  }
  async evaluate(expression) {
    const r = await this.cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  }
}

// ── the CDN cache: fetched once, replayed byte for byte so SRI still validates ───────────────
const CDN_URLS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js',
];
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ezik-reader-round/1.0' } }, (res) => {
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

// ── the local origin: the repo, plus an /api that never leaves this process ──────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};
function sse(res, text) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' });
  // One delta per line keeps the streaming path honest — the page accumulates exactly the way it
  // does against the real endpoint, and a marker split across two chunks is a real case.
  for (const piece of String(text).split(/(?<=\n)/u)) {
    res.write('data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: piece } }) + '\n\n');
  }
  res.write('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
  res.end();
}
const API_LOG = [];
function serve(answers) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(String(req.url).split('?')[0]);
      if (url.startsWith('/api/')) {
        API_LOG.push(req.method + ' ' + url);
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => {
          if (url === '/api/ask' || url === '/api/chat' || url === '/api/chat-fast') {
            const asked = String(body);
            const which = asked.includes('CODE-WITNESS') ? 'code' : 'incomplete';
            sse(res, answers[which]);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{}');
        });
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

// ── the page ────────────────────────────────────────────────────────────────────────────────
// The AI-consent record, in the shape `hasValidAIConsent()` accepts. The version string is read
// off index.html rather than copied, so a bumped version fails here loudly instead of quietly
// sending the walk down the local-mode branch again.
const CONSENT_VERSION = (/^const EZ_AI_CONSENT_VERSION = '([^']+)';$/mu
  .exec(fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')) || [])[1];
const AI_CONSENT = JSON.stringify({ status: 'granted', version: CONSENT_VERSION, grantedBy: 'user', at: '2026-08-18T00:00:00.000Z' });
const PROFILE = JSON.stringify({
  name: 'خالد', gender: 'male', birthYear: 1990, age: 36, pid: 'reader-round-1',
});
async function openPage(cdn) {
  const userDir = path.join(os.tmpdir(), 'ezik-reader-round-' + Math.floor(Math.random() * 1e9));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + userDir,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--window-size=430,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
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
  await cdp.cmd('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
  const logs = [];
  ws.handlers.push(async (m) => {
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(m.params.exceptionDetails).slice(0, 240));
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    const body = cdn.get(request.url);
    try {
      if (body) {
        await cdp.cmd('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'text/javascript; charset=utf-8' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
          ],
          body: body.toString('base64'),
        });
      } else {
        // Anything else off-origin (fonts, analytics) is refused rather than allowed: the page
        // must run on its own code and this file's server, and nothing else.
        await cdp.cmd('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      }
    } catch (e) { /* the page went away mid-flight */ }
  });
  await cdp.cmd('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("child_profile", ' + JSON.stringify(PROFILE) + ');'
      + 'localStorage.setItem("ezik_ai_consent_v1", ' + JSON.stringify(AI_CONSENT) + ');}catch(e){}',
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

// Helpers injected into every page expression. They go INSIDE the expression's own function
// scope: evaluated at global scope, the second call redeclares `$` and throws before it runs.
const H = `
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const txt = (el) => String((el && (el.innerText || el.textContent)) || '');
  const byText = (sel, t) => $$(sel).filter((e) => txt(e).indexOf(t) !== -1)[0] || null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
`;

// ── ONE WAY IN, AND IT IS THE READER'S OWN ─────────────────────────────────────────────────
// The send button carries an SVG and no text, no aria-label and no form around it, so there is
// nothing to select it by. The textarea's own `onKeyDown` calls `sendMessage` on a bare Enter —
// which is the path a reader actually uses — so that is the one this drives.
//
// THE GATES BEFORE THE COMPOSER ARE WALKED AND NOT NAMED. The caveat screen and the AI-consent
// screen each carry one button to go on with, and naming either by its Arabic wording would put
// this file back in the business of matching phrases. It presses the last enabled button on the
// screen until a composer appears, and records what it pressed.
const ASK = (question, waitFor) => `(async () => {
  const QQ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const txt = (el) => String((el && (el.innerText || el.textContent)) || '');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = () => QQ('textarea').filter((t) => !t.disabled)[0] || null;

  const trail = [];
  for (let step = 0; step < 8 && !box(); step += 1) {
    const buttons = QQ('button').filter((b) => !b.disabled && txt(b).trim());
    trail.push({ step, buttons: buttons.map((b) => txt(b).trim().slice(0, 40)),
      screen: document.body.innerText.slice(0, 160) });
    if (!buttons.length) break;
    buttons[buttons.length - 1].scrollIntoView({ block: 'center' });
    await sleep(120);
    buttons[buttons.length - 1].click();
    await sleep(800);
  }
  const area = box();
  if (!area) return { error: 'no composer', trail, screen: document.body.innerText.slice(0, 700),
    buttons: QQ('button').map((b) => txt(b).trim().slice(0, 40)) };

  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(area, ${JSON.stringify(question)});
  area.dispatchEvent(new Event('input', { bubbles: true }));
  // React 18 batches, so the keydown handler's closure only carries the new value after a paint.
  await sleep(400);
  area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

  for (let i = 0; i < 150; i += 1) {
    await sleep(200);
    if (document.body.innerText.indexOf(${JSON.stringify(waitFor)}) !== -1) break;
  }
  return { text: document.body.innerText, trail };
})()`;
async function main() {
  if (!CHROME) { ok('a browser is available', false, 'Chrome not found'); return; }
  console.log('=== 0. THE PAYLOAD THE PAGE IS SERVED IS THIS TREE\'S OWN OUTPUT ===');
  const loop = await import(pathToFileURL(path.join(REPO, 'lib', 'free-brain', 'loop.js')).href);
  const notes = [];
  const deliveredCode = loop.deliverableText(RAW_CODE_ANSWER, notes);
  ok('the delivery filter dropped the announcement from the code answer',
    !deliveredCode.includes('سأبحث'), shape(deliveredCode));
  ok('...and kept every line of the function it was asked for',
    RAW_CODE_ANSWER.split('\n').filter((l) => l.trim() && !l.includes('سأبحث'))
      .every((l) => deliveredCode.split('\n').includes(l)),
    shape(deliveredCode));
  ok('...and named nothing as lost, because nothing was', notes.length === 0, JSON.stringify(notes));

  const cdn = await cdnCache();
  const srv = await serve({ incomplete: ANSWER_INCOMPLETE, code: deliveredCode });
  let page = null;
  try {
    page = await openPage(cdn);
    console.log('\n=== 1. THE PAGE BOOTED, ON ITS OWN CODE ===');
    ok('the AI-consent version was read out of index.html', typeof CONSENT_VERSION === 'string' && CONSENT_VERSION.length > 4,
      String(CONSENT_VERSION));
    ok('index.html rendered a first screen', await page.run('document.body.innerText.length > 20'),
      shape(await page.run('document.body.innerText.slice(0,200)')));
    if (process.env.EZIK_READER_DUMP) {
      console.log('--- screen ---' + shape(await page.run('document.body.innerText')));
      console.log('--- controls ---' + shape(await page.run('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll("button,textarea,input,[role=button]")).map(function(e){return e.tagName+":"+(e.getAttribute("aria-label")||"")+"|"+String(e.innerText||e.placeholder||"").slice(0,30)+(e.disabled?"[disabled]":"")}))')));
    }

    // ── walk to the chat and ask ────────────────────────────────────────────────────────────
    const askedIncomplete = await page.run(ASK('ما حكم الجمع بين الصلاتين للمسافر', 'الجمع بين الصلاتين'));
    if (askedIncomplete && askedIncomplete.error) {
      ok('the chat screen accepted a question', false, askedIncomplete.error);
      console.log('        trail   = ' + esc(JSON.stringify(askedIncomplete.trail)));
      console.log('        buttons = ' + esc(JSON.stringify(askedIncomplete.buttons)));
      console.log('        screen  = ' + esc(askedIncomplete.screen));
    } else {
      console.log('\n=== 2. THE FOUR READERS, AND THE MARKER THAT MUST NOT BE TEXT ===');
      const t = String(askedIncomplete.text || '');
      console.log('        api hits = ' + JSON.stringify(API_LOG));
      if (process.env.EZIK_READER_DUMP) console.log('        BODY = ' + esc(t.slice(0, 1200)));
      ok('the answer reached the screen', t.indexOf('الجمع بين الصلاتين') !== -1, shape(t.slice(0, 300)));
      // §٤: «<incomplete/> لا تظهرُ نصًّا بحال» — the whole document, not the bubble.
      ok('READER 1 (screen): `<incomplete/>` appears NOWHERE as text in the document',
        !/<\s*incomplete/i.test(t) && t.indexOf('incomplete') === -1, shape(t.slice(0, 400)));
      // ...and the badge that replaces it is there, in the reader's own language.
      const badge = await page.run(`(function(){${H}
        const el = $$('[role=status]').filter((e) => txt(e).indexOf('لم يكتمل') !== -1)[0];
        return el ? { found: true, len: txt(el).length } : { found: false };
      })()`);
      ok('...and the badge that replaces it IS rendered, with role=status', badge && badge.found === true,
        JSON.stringify(badge));

      const readers = await page.run(`(function(){${H}
        const src = ${JSON.stringify(ANSWER_INCOMPLETE)};
        const out = {};
        try { out.clipboard = ezikStripIncomplete(src); } catch (e) { out.clipboardError = String(e); }
        try { out.voice = formatForTTS(src); } catch (e) { out.voiceError = String(e); }
        try { out.log = formatForLog(src); } catch (e) { out.logError = String(e); }
        try { out.flag = ezikAnswerIncomplete(src); } catch (e) { out.flagError = String(e); }
        return out;
      })()`);
      const clean = (v) => typeof v === 'string' && !/incomplete|[<>]/i.test(v) && v.length > 20;
      ok('READER 2 (clipboard): the marker is stripped and no angle bracket is left',
        clean(readers.clipboard), shape(readers.clipboard));
      ok('READER 3 (voice): the marker is not spoken, and the sentence is',
        clean(readers.voice) && readers.voice.indexOf('الجمع') !== -1, shape(readers.voice));
      ok('READER 4 (parents\' log): the marker is gone and the prose is kept',
        clean(readers.log) && readers.log.indexOf('الجمع') !== -1, shape(readers.log));
      ok('...and the flag the badge is drawn from still reads TRUE on the raw text',
        readers.flag === true, JSON.stringify(readers.flag));
    }

    // ── §٤'s fourth witness, on the same page ───────────────────────────────────────────────
    console.log('\n=== 3. THE FOURTH WITNESS: A CODE ANSWER, RENDERED ===');
    const codeTurn = await page.run(ASK('CODE-WITNESS اكتب لي دالة تحسب الزكاة', 'calculateZakat'));
    const ct = String((codeTurn && codeTurn.text) || '');
    if (process.env.EZIK_READER_DUMP) console.log('        CODEBODY = ' + esc(ct));
    const NEEDED = ['function calculateZakat(amount) {', 'if (amount < nisab) {', 'return 0;',
      'const zakat = amount * 0.025;', 'const money = 10000;', 'const zakat = calculateZakat(money);'];
    const missing = NEEDED.filter((line) => ct.indexOf(line) === -1);
    ok('the code answer reached the screen', ct.indexOf('calculateZakat') !== -1, shape(ct.slice(0, 300)));
    ok('EVERY line of the function is on the screen — none was deleted on the way',
      missing.length === 0, JSON.stringify(missing));
    ok('...and what is on the screen parses as JavaScript', (() => {
      const start = ct.indexOf('function calculateZakat');
      const end = ct.indexOf('console.log');
      if (start < 0 || end < 0) return false;
      const block = ct.slice(start, ct.indexOf('\n', end) === -1 ? ct.length : ct.indexOf('\n', end) + 1);
      try { new Function(block); return true; } catch (e) { return false; }
    })(), shape(ct.slice(Math.max(0, ct.indexOf('function calculateZakat')), ct.indexOf('function calculateZakat') + 420)));
    ok('...and the announcement the model wrote before it did NOT reach the screen',
      ct.indexOf('سأبحث') === -1);
    ok('the page threw nothing while all of this ran', page.logs.length === 0, JSON.stringify(page.logs.slice(0, 3)));
  } catch (error) {
    ok('the browser round completed without exception', false, error && error.stack ? error.stack : String(error));
  } finally {
    if (page) await page.close();
    srv.close();
  }
  console.log('\nSUMMARY reader-round PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail === 0 ? 0 : 1);
}

main();
