// ============================================================================
// STREAM-P4 §٣ — THE TWO CLIENT ITEMS, IN A REAL PAGE, WITH THE TEXT ARRIVING
// ============================================================================
//
// WHAT THIS IS FOR. §٣/١ is a claim about where a question SITS while an answer is being
// written, and §٣/٢ is a claim about what a key DOES on a particular kind of device. Neither
// can be asked of a module. So this drives the real `index.html` in a real headless Chrome,
// against a server in this process, and asks the page.
//
// AND THE ANSWER ARRIVES OVER TIME, WHICH IS THE WHOLE POINT. §٣ says the two items are to be
// checked «بالبثِّ مفتوحًا محلّيًّا» — with streaming open — because testing a scroll rule on an
// answer that lands in one frame tests nothing: there is no «while it is being written» to be
// in. The SSE below therefore sends one delta at a time with a real delay between them, and the
// pin is measured DURING that, not after it.
//
// THIS IS NOT §٢. The stream here is the ordinary chat stream this client has always consumed;
// it is not sentence-level delivery and it does not touch the reviewer, the lock or STREAM_V1.
// §٣ is explicit that these two items «لا يمسّانِ مخًّا ولا فاحصًا ولا قفلًا».
//
// WHY IT IS NOT A GATE. It needs a browser, on the model of tools/reader-round-measure.cjs,
// whose CDP plumbing, CDN replay and consent seeding this file follows deliberately rather than
// inventing a second way to do the same thing. It is a MEASUREMENT that is run and recorded.
//
//   node tools/stream-p1/ask-pin-and-enter-measure.cjs
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
const PORT = 8991;
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
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + String(detail).slice(0, 700)));
  return false;
};
// Every line this file prints is ASCII: Arabic on a Windows terminal is a mojibake report, not
// evidence. Arabic is compared INSIDE the page and reported as a verdict.
const esc = (v) => Array.from(String(v === undefined || v === null ? '' : v))
  .map((c) => (c.codePointAt(0) < 128 ? c : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')))
  .join('');

// ── the two answers ─────────────────────────────────────────────────────────────────────────
// LONG: taller than the viewport several times over, so «the question is at the top» and «the
// view did not chase the last character» are different positions and the test can tell them
// apart. SHORT: one line, so the only way its question reaches the top is the bottom spacer.
const LONG = Array.from({ length: 40 }, (_, i) =>
  'السطر رقم ' + (i + 1) + ' من الجواب الطويل، وفيه كلام كافٍ ليأخذ ارتفاعًا حقيقيًّا على الشاشة.')
  .join('\n');
const SHORT = ['نعم، يجوز ذلك.', 'وهذا قول أكثر أهل العلم.', 'والله أعلم.'].join('\n');
const Q1 = 'السؤال الأول عن الجواب الطويل';
const Q2 = 'السؤال الثاني في الصفحة نفسها';
const Q3 = 'السؤال الثالث عن الجواب القصير';

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

const CDN_URLS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js',
];
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ezik-ask-pin/1.0' } }, (res) => {
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
};

// ── THE STREAM, WITH TIME IN IT ─────────────────────────────────────────────────────────────
// One line per delta, and a real pause between them. The pauses are what make «while the answer
// is being written» a state this measurement can actually stand in and take a reading from.
const DELTA_MS = 55;
// The short answer is paced slower on purpose: three deltas at the fast rate would be gone in a
// sixth of a second, and «the spacer existed while the turn was live» would be untestable.
const SHORT_DELTA_MS = 420;
function sseSlow(res, text, everyMs) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' });
  const pieces = String(text).split(/(?<=\n)/u);
  let i = 0;
  const tick = () => {
    if (i >= pieces.length) {
      res.write('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
      res.end();
      return;
    }
    res.write('data: ' + JSON.stringify({
      type: 'content_block_delta', delta: { type: 'text_delta', text: pieces[i] },
    }) + '\n\n');
    i += 1;
    setTimeout(tick, everyMs || DELTA_MS);
  };
  setTimeout(tick, everyMs || DELTA_MS);
}
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(String(req.url).split('?')[0]);
      if (url.startsWith('/api/')) {
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => {
          if (url === '/api/ask' || url === '/api/chat' || url === '/api/chat-fast') {
            const short = String(body).includes(Q3);
            sseSlow(res, short ? SHORT : LONG, short ? SHORT_DELTA_MS : DELTA_MS);
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

const CONSENT_VERSION = (/^const EZ_AI_CONSENT_VERSION = '([^']+)';$/mu
  .exec(fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')) || [])[1];
const AI_CONSENT = JSON.stringify({ status: 'granted', version: CONSENT_VERSION, grantedBy: 'user', at: '2026-08-18T00:00:00.000Z' });
const PROFILE = JSON.stringify({ name: 'خالد', gender: 'male', birthYear: 1990, age: 36, pid: 'ask-pin-1' });

async function openPage(cdn) {
  const userDir = path.join(os.tmpdir(), 'ezik-ask-pin-' + Math.floor(Math.random() * 1e9));
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
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      const ex = d.exception || {};
      // React's production build throws a minified error whose TEXT is just "Uncaught"; the real
      // message is on the exception object. Both are kept, because one of them is always empty.
      logs.push('EXCEPTION ' + String(d.text || '')
        + ' :: ' + String(ex.description || ex.value || '').slice(0, 400));
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

// ── in-page helpers, injected inside each expression's own scope ────────────────────────────
const H = `
  const QQ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const txt = (el) => String((el && (el.innerText || el.textContent)) || '');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = () => QQ('textarea').filter((t) => !t.disabled)[0] || null;
  const anyBox = () => QQ('textarea')[0] || null;
  // The composer is DISABLED for the whole of a turn, so every probe that follows a send has to
  // wait for it rather than assume it. Returning null here instead of throwing is what lets the
  // caller report WHICH state it was stuck in.
  const waitBox = async (ms) => {
    const t0 = Date.now();
    for (;;) {
      const t = box();
      if (t) return t;
      if (Date.now() - t0 > (ms || 40000)) return null;
      await sleep(150);
    }
  };
  const stuck = () => ({ error: 'composer never re-enabled',
    textareas: QQ('textarea').length,
    disabled: anyBox() ? !!anyBox().disabled : 'none',
    screen: document.body.innerText.slice(-220) });
  const area = () => document.querySelector('.ezc-scroll');
  const anchor = () => document.querySelector('[data-ezik-ask-pin]');
  const pad = () => document.querySelector('[data-ezik-ask-pad]');
  // Where the pinned question sits, relative to the top of the scroller. 0 means «at the top».
  const pinOffset = () => {
    const a = anchor(); const el = area();
    if (!a || !el) return null;
    return Math.round(a.getBoundingClientRect().top - el.getBoundingClientRect().top);
  };
  // NULL WHEN THE QUESTION IS MEANINGLESS. A container whose content does not overflow is at
  // its own bottom by arithmetic, always, and reading that as «the view jumped to the bottom»
  // would convict the pin of the one thing it is there to prevent, on a screen with nothing to
  // scroll. Only an overflowing container can answer this.
  const atBottom = () => {
    const el = area();
    if (!el) return null;
    if (el.scrollHeight - el.clientHeight < 4) return null;
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < 4;
  };
  const setValue = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
`;

// Walk the caveat / consent screens the same way tools/reader-round-measure.cjs does: press the
// last enabled button until a composer appears, naming nothing in Arabic.
const REACH_COMPOSER = `(async () => {${H}
  const trail = [];
  for (let step = 0; step < 8 && !box(); step += 1) {
    const buttons = QQ('button').filter((b) => !b.disabled && txt(b).trim());
    trail.push({ step, buttons: buttons.map((b) => txt(b).trim().slice(0, 30)) });
    if (!buttons.length) break;
    buttons[buttons.length - 1].click();
    await sleep(700);
  }
  return { composer: !!box(), trail };
})()`;

/** Type a question and send it with the SEND BUTTON, which works on every device. */
const SEND_BY_BUTTON = (q) => `(async () => {${H}
  const t = await waitBox(60000);
  if (!t) return stuck();
  setValue(t, ${JSON.stringify(q)});
  await sleep(350);
  // THE SEND BUTTON IS THE TEXTAREA'S OWN SIBLING, and it is found that way rather than by
  // scanning the page for a button with an icon and no label. MEASURED, and it cost a run: the
  // tool row underneath carries the mic and the live-call buttons, which are also icon-only and
  // come LATER in the document, so "the last icon button" pressed CALL and walked the whole
  // measurement off the chat screen — after which the scroller did not exist and every reading
  // in the section below came back null.
  const send = t.parentElement ? t.parentElement.querySelector('button') : null;
  if (!send) return { error: 'no send button beside the composer' };
  if (send.disabled) return { error: 'send button is disabled', value: t.value.length };
  send.click();
  return { sent: true };
})()`;

async function main() {
  if (!CHROME) { ok('a browser is available', false, 'Chrome not found'); return; }
  const cdn = await cdnCache();
  const srv = await serve();
  const page = await openPage(cdn);
  try {
    const reached = await page.run(REACH_COMPOSER);
    if (!ok('the composer is reachable', reached && reached.composer, JSON.stringify(reached))) return;

    // ══ §٣/٢ — WHAT `Enter` DOES ═════════════════════════════════════════════
    console.log('\n=== §٣/٢ — Enter, by input type and by composition state ===');

    const enterProbe = await page.run(`(async () => {${H}
      const t = box();
      const before = () => QQ('.ezc-turn, [class*="messageBubble"]').length;
      const out = {};

      // The opening state is the media query's, and headless Chrome reports a fine pointer,
      // which is exactly a keyboard. This is also the state tools/reader-round-measure.cjs
      // depends on, so it is recorded rather than assumed.
      out.hintAtRest = t.getAttribute('enterkeyhint');

      // (1) KEYBOARD + bare Enter -> sends.
      setValue(t, 'اختبار لوحة المفاتيح');
      await sleep(300);
      const n1 = document.body.innerText.length;
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(700);
      out.keyboardEnterSent = t.value === '' && document.body.innerText.length !== n1;
      // let that turn finish so the next probes start clean
      for (let i = 0; i < 100 && box() === null; i += 1) await sleep(200);
      for (let i = 0; i < 120; i += 1) { await sleep(200); if (box() && !box().disabled) break; }
      return out;
    })()`);
    if (page.logs.length) console.log('  PAGE EXCEPTIONS after the first send:\n    ' + esc(page.logs.join('\n    ')));
    ok('keyboard: a bare Enter sends', enterProbe.keyboardEnterSent === true, JSON.stringify(enterProbe));
    ok('keyboard: the key is labelled "send"', enterProbe.hintAtRest === 'send', JSON.stringify(enterProbe));

    // wait for the long answer to finish before the next probes
    await page.run(`(async () => {${H}
      for (let i = 0; i < 200; i += 1) { await sleep(200); const t = box(); if (t && !t.disabled) return true; }
      return false;
    })()`);

    const enterProbe2 = await page.run(`(async () => {${H}
      const t = await waitBox(60000);
      if (!t) return stuck();
      const out = {};

      // (2) Shift+Enter never sends.
      setValue(t, 'اختبار شفت');
      await sleep(250);
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
      await sleep(500);
      out.shiftEnterHeld = t.value === 'اختبار شفت';

      // (3) Enter while an IME is composing never sends — by the native flag...
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
      await sleep(500);
      out.imeFlagHeld = t.value === 'اختبار شفت';

      // ...and by the composition events, for the browsers that do not set the flag.
      t.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      await sleep(120);
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(500);
      out.compositionHeld = t.value === 'اختبار شفت';
      t.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      await sleep(120);

      // (4) TOUCH: a pointerdown of type touch, then Enter -> newline, never a send.
      t.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true }));
      await sleep(300);
      out.hintAfterTouch = t.getAttribute('enterkeyhint');
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(600);
      out.touchEnterHeld = t.value === 'اختبار شفت';

      // ...and the same field goes back to sending once a MOUSE touches it, so a hybrid device
      // follows what the reader is actually using.
      t.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true, cancelable: true }));
      await sleep(300);
      out.hintAfterMouse = t.getAttribute('enterkeyhint');

      setValue(t, '');
      await sleep(200);
      return out;
    })()`);
    ok('Shift+Enter is a newline, not a send', enterProbe2.shiftEnterHeld === true, JSON.stringify(enterProbe2));
    ok('Enter during IME composition does not send (native isComposing)', enterProbe2.imeFlagHeld === true, JSON.stringify(enterProbe2));
    ok('Enter during IME composition does not send (compositionstart)', enterProbe2.compositionHeld === true, JSON.stringify(enterProbe2));
    ok('touch: Enter does not send', enterProbe2.touchEnterHeld === true, JSON.stringify(enterProbe2));
    ok('touch: the key stops promising "send"', enterProbe2.hintAfterTouch === 'enter', JSON.stringify(enterProbe2));
    ok('a mouse on the same field restores sending', enterProbe2.hintAfterMouse === 'send', JSON.stringify(enterProbe2));

    // ══ §٣/١ — WHERE THE QUESTION SITS WHILE THE ANSWER IS WRITTEN ═══════════
    console.log('\n=== §٣/١ — the question at the top, sampled DURING the stream ===');

    const sent1 = await page.run(SEND_BY_BUTTON(Q1));
    if (!ok('the first question was sent by the send button', sent1 && sent1.sent === true, JSON.stringify(sent1))) return;
    const during = await page.run(`(async () => {${H}
      const samples = [];
      const geom = [];
      for (let i = 0; i < 26; i += 1) {
        await sleep(120);
        const el0 = area();
        samples.push({ off: pinOffset(), bottom: atBottom(), pad: pad() ? pad().offsetHeight : 0,
          len: (el0 ? el0.scrollHeight : 0),
          st: (el0 ? el0.scrollTop : 0),
          maxScroll: (el0 ? el0.scrollHeight - el0.clientHeight : 0) });
        // The raw numbers the pin itself works from, so a disagreement between what it computed
        // and what the screen shows can be read off rather than reasoned about.
        const el = area(); const a = anchor();
        if (el && a && geom.length < 8) {
          const anchorTop = Math.round(a.getBoundingClientRect().top - el.getBoundingClientRect().top) + el.scrollTop;
          geom.push({ ch: el.clientHeight, sh: el.scrollHeight, st: el.scrollTop, anchorTop,
            pinned: el.className.indexOf('ezc-askpinned') !== -1,
            maxScroll: el.scrollHeight - el.clientHeight });
        }
      }
      return { samples, geom, anchorSeen: !!anchor() };
    })()`);
    const live = during.samples.filter((s) => s.off !== null);
    ok('the pin anchor exists while the answer is being written', live.length > 0,
      JSON.stringify(during.samples.slice(0, 5)));
    const grew = live.length > 1 && live[live.length - 1].len > live[0].len;
    ok('...and the answer really was still growing during those samples', grew,
      'first=' + (live[0] || {}).len + ' last=' + (live[live.length - 1] || {}).len);
    console.log('  GEOMETRY (first samples, for the record)  ' + JSON.stringify(during.geom.slice(0, 4)));
    const maxOff = live.reduce((m, s) => Math.max(m, Math.abs(s.off)), 0);
    ok('the question stays at the top of the scroller throughout (|offset| <= 4px)', live.length > 0 && maxOff <= 4,
      'max |offset| = ' + maxOff + '  samples=' + JSON.stringify(live.map((s) => s.off)));
    // ── «لا قفزَ تلقائيًّا إلى الأسفل أثناءَ الكتابة», STATED SO THAT IT CAN FAIL ──
    //
    // The first attempt at this asserted «the scroller is never at its own bottom», and that is
    // NOT the claim. While the pin holds, the spacer deliberately provides exactly one viewport
    // of room below the question and no more — so being at the end of the scrollable range and
    // having the question at the top are THE SAME POSITION, and the naive test convicts the pin
    // of the very thing it is preventing.
    //
    // The claim is that the view stops following the last written character. It becomes testable
    // the moment the answer grows past the room the spacer made: from then on there IS more
    // below, and a view that chased the text would sit at the bottom while a pinned one does not.
    // So the samples where that is true are selected, and it is an error for there to be none.
    const decisive = live.filter((s) => s.maxScroll - s.st > 4);
    ok('the answer outgrew the room, so "did the view follow it?" is a real question',
      decisive.length > 0, JSON.stringify(live.map((s) => s.maxScroll - s.st)));
    ok('there is no automatic jump to the bottom while writing',
      decisive.length > 0 && decisive.every((s) => s.bottom === false),
      JSON.stringify(decisive.map((s) => ({ below: s.maxScroll - s.st, bottom: s.bottom }))));

    // the turn ends: the room is given back
    const after = await page.run(`(async () => {${H}
      for (let i = 0; i < 200; i += 1) { await sleep(200); const t = box(); if (t && !t.disabled) break; }
      await sleep(600);
      return { pad: pad() ? pad().offsetHeight : 0, anchor: !!anchor() };
    })()`);
    ok('the bottom spacer is folded away when the turn ends', after.pad === 0, JSON.stringify(after));
    ok('...and the pin is disarmed with it', after.anchor === false, JSON.stringify(after));

    // ── the reader's own hand wins ──
    console.log('\n=== §٣/١ — the reader scrolls, and the pin lets go ===');
    const sent2 = await page.run(SEND_BY_BUTTON(Q2));
    ok('the second question was sent by the send button', sent2 && sent2.sent === true, JSON.stringify(sent2));
    const yielded = await page.run(`(async () => {${H}
      // let the pin take hold first
      for (let i = 0; i < 20 && pinOffset() === null; i += 1) await sleep(100);
      await sleep(300);
      const before = pinOffset();
      const el = area();
      // THE READER DRAGS THE TRANSCRIPT UPWARD, and the direction matters. While the pin holds,
      // the spacer leaves exactly one viewport below the question, so the scroller is already at
      // the end of its range and a downward drag is clamped to nothing — the first version of
      // this pushed DOWN by 240 and measured a movement of 0, which reads as «the pin refused to
      // let go» and was in fact «there was nowhere to go». Scrolling up is always available.
      el.scrollTop = Math.max(0, el.scrollTop - 240);
      await sleep(500);
      const moved = pinOffset();
      // ...and it must STAY moved as more of the answer arrives
      const later = [];
      for (let i = 0; i < 8; i += 1) { await sleep(150); later.push(pinOffset()); }
      return { before, moved, later };
    })()`);
    ok('a reader scroll moves the question off the top', yielded.moved !== null && yielded.moved > 100,
      JSON.stringify(yielded));
    ok('...and nothing drags it back while the answer keeps arriving',
      yielded.later.length > 0 && yielded.later.every((v) => v !== null && v > 100), JSON.stringify(yielded));

    await page.run(`(async () => {${H}
      for (let i = 0; i < 200; i += 1) { await sleep(200); const t = box(); if (t && !t.disabled) break; }
      return true;
    })()`);

    // ── a SHORT answer still carries its question to the top ──
    console.log('\n=== §٣/١ — a short answer, where only the spacer can do it ===');
    const sent3 = await page.run(SEND_BY_BUTTON(Q3));
    ok('the short question was sent by the send button', sent3 && sent3.sent === true, JSON.stringify(sent3));
    const shortRun = await page.run(`(async () => {${H}
      const samples = [];
      for (let i = 0; i < 40; i += 1) {
        await sleep(60);
        samples.push({ off: pinOffset(), pad: pad() ? pad().offsetHeight : 0 });
      }
      for (let i = 0; i < 200; i += 1) { await sleep(200); const t = box(); if (t && !t.disabled) break; }
      await sleep(600);
      return { samples, padAfter: pad() ? pad().offsetHeight : 0 };
    })()`);
    const sLive = shortRun.samples.filter((s) => s.off !== null);
    ok('the short answer got a spacer while its turn was live',
      sLive.some((s) => s.pad > 0), JSON.stringify(shortRun.samples));
    ok('...and its question reached the top all the same',
      sLive.length > 0 && sLive.every((s) => Math.abs(s.off) <= 4), JSON.stringify(sLive));
    ok('...and the spacer was folded away at the end', shortRun.padAfter === 0, JSON.stringify(shortRun));

    ok('the page threw no exceptions during the run', page.logs.length === 0, esc(page.logs.join(' | ')));
  } finally {
    await page.close();
    srv.close();
  }
  console.log('\nRESULT  pass ' + pass + '  fail ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
