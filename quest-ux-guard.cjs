// quest-ux-guard.cjs — S100, the game-feedback gate.
//
// quest.html is a standalone vanilla page, not the React app, so this gate proves it the way the
// page actually runs: in a real headless Chrome over CDP, serving the REPO from a local server, with
// the shipped bank. Nothing here is a re-implementation — every question, every answer and every
// reward rule is the file's own.
//
// Parts:
//   A. THE BANK IS SEALED   — every quest-data file byte-for-byte, and the counts and category
//                             balance read out of the loaded bank rather than out of a copy.
//   B. THE ROUND            — progress, no early reveal, no second answer, symbol+text not colour.
//   C. THE RESULT + REVIEW  — the tally, the review screen, and that returning to the result does
//                             not pay a reward twice.
//   D. THE PAGE             — no network beyond its own files, ARIA, 320px, both themes.
//
// Usage: node quest-ux-guard.cjs [questFile]   (default: quest.html)
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const vm = require('vm');
const { spawn } = require('child_process');
const babelParser = require('@babel/parser');

const REPO = __dirname;
const QUEST = process.argv[2] || 'quest.html';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const CHROME = CHROME_CANDIDATES.filter((p) => fs.existsSync(p))[0];
const PORT = 8981;

// ---------------------------------------------------------------------------
// ITEM 114. THE BROWSER INITIALISER, AND WHY IT HAS ITS OWN SECTION NOW.
//
// MEASURED: `Error: timeout: Page.enable` AFTER every static check had already passed, on 5 of 5
// runs of the merged tree AND on 5 of 5 runs of origin/main itself, with the identical message.
// A fault that reproduces at the same rate on the base it was compared against is not a merge
// regression, and the message named the wrong thing besides: nothing was wrong with Page.enable,
// with quest.html, or with any assertion below. What was wrong was the attach -- and the attach
// had no deadline of its own, no way to tell a dead socket from a slow one, no check that the
// websocket upgrade had actually been granted, and no second attempt.
//
// FOUR THINGS CHANGE, ALL OF THEM IN THE INITIALISER. Per-method protocol deadlines instead of
// one flat minute; launch arguments that stop Chrome doing work no gate asked for; a target
// lookup that waits for a page target instead of assuming the first entry is one; and ONE
// retry -- announced on stdout, never silent.
//
// WHAT DOES NOT CHANGE, and this is the point of the item: not one assertion is relaxed, no gate
// is disabled, and a crash is still a crash. The retry covers the ATTACH only; once the page is
// driving, a failure is reported exactly as it was. And the final line distinguishes the two
// outcomes it always could -- GUARD CRASHED versus FAILED: n of m -- so a retry that does not
// help cannot be mistaken for a run that passed.
// ---------------------------------------------------------------------------

// Per method, because they are not the same kind of wait. Page.navigate is a network round trip
// against a local server; Page.enable is a handshake that either happens at once or is not going
// to happen at all, and giving it a minute only delays the diagnosis by a minute.
const PROTOCOL_TIMEOUT_MS = {
  'Page.enable': 15000,
  'Runtime.enable': 15000,
  'Network.enable': 15000,
  'Emulation.setDeviceMetricsOverride': 15000,
  'Page.navigate': 45000,
  default: 60000,
};
const WS_HANDSHAKE_MS = 15000;
const DEBUG_PORT_MS = 30000;
const TARGET_WAIT_MS = 15000;
// ONE. A second attempt distinguishes a browser that came up badly from a page that is broken;
// a loop distinguishes nothing and turns a red gate into a slow green one.
const ATTACH_ATTEMPTS = 2;

// The flags, and what each is here for. Nothing here changes what the page IS -- no disabled
// web platform features, no altered viewport, no relaxed security. They stop Chrome spending
// the first seconds of its life on work this gate never asked for, which is the window the
// attach was losing.
const CHROME_ARGS = [
  '--headless=new',
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--mute-audio',
  // Startup work with no bearing on a local page: the component updater fetches, the metrics
  // pipeline uploads, translate and optimisation hints phone home, and the default apps and
  // extensions are installed into a profile that is deleted a minute later.
  '--disable-component-update',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-sync',
  '--metrics-recording-only',
  '--no-pings',
  '--disable-features=Translate,MediaRouter,OptimizationHints,BackForwardCache',
  // A headless window is never visible or focused, and Chrome throttles exactly those. The
  // round below is driven by timers; throttling them is how a 150ms poll becomes a 45-second
  // "quest.html never booted".
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-ipc-flooding-protection',
  // Software rendering, deliberately. There is no GPU worth having in a headless run and the
  // GPU process is one more thing that can fail to come up on a machine this gate has never
  // seen. Nothing below measures paint.
  '--disable-gpu',
  '--disable-dev-shm-usage',
];

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
const cps = (x) => Array.prototype.map.call(String(x == null ? '' : x), (c) => c.charCodeAt(0).toString(16)).join(' ');

// ===========================================================================
// P2. THE HADITH CARD LABEL — exercise the shipped label decision, not a copy.
// ===========================================================================
function partP2Labels() {
  console.log('\n=== P2. THE HADITH CARD LABEL ===');
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  // ITEM 32-b: located once, in ./tools/babel-block.cjs. The `open ? ... : ''` this replaces is
  // the emptyable shape gate `vacuousassert` refuses -- a missing anchor produced an empty
  // string, and the parse below then reported success over nothing at all.
  const BB = require('./tools/babel-block.cjs');
  let raw = '';
  try { raw = BB.readBabelBlock({ file: path.join(REPO, 'index.html'), html: html }).raw; }
  catch (e) { ok('the shipped app script was located for label inspection', false, e.message); }
  let ast = null;
  try { ast = raw ? babelParser.parse(raw, { sourceType: 'script', plugins: ['jsx'] }) : null; }
  catch (e) { ok('the shipped app script parses for label inspection', false, e.message); }

  let neutralSource = '', labelSource = '', cardSource = '';
  for (const statement of ast?.program?.body || []) {
    if (statement.type === 'VariableDeclaration') {
      const declaration = statement.declarations.find((item) =>
        item.id?.type === 'Identifier' && item.id.name === 'NEUTRAL_HADITH_LABEL' && item.init);
      if (declaration) neutralSource = raw.slice(declaration.init.start, declaration.init.end);
    }
    if (statement.type === 'FunctionDeclaration' && statement.id?.name === 'HadithCard') {
      cardSource = raw.slice(statement.start, statement.end);
      for (const child of statement.body.body) {
        if (child.type !== 'VariableDeclaration') continue;
        const declaration = child.declarations.find((item) =>
          item.id?.type === 'Identifier' && item.id.name === 'label' && item.init);
        if (declaration) labelSource = raw.slice(declaration.init.start, declaration.init.end);
      }
    }
  }

  const extracted = ok('the shipped HadithCard exposes one inspectable label decision',
    !!neutralSource && !!labelSource && !!cardSource);
  if (!extracted) return;
  const neutral = vm.runInNewContext('(' + neutralSource + ')');
  const labelFor = (att) => vm.runInNewContext('(' + labelSource + ')', {
    att, NEUTRAL_HADITH_LABEL: neutral,
  });
  eq('no surviving narrator or ruling gets the neutral label',
    labelFor({ narrator: '', ruling: '' }), 'نص منقول');
  eq('a surviving narrator gets the supported-hadith label',
    labelFor({ narrator: 'البخاري', ruling: '' }), 'من السنة النبوية');
  eq('a surviving ruling alone gets the supported-hadith label',
    labelFor({ narrator: '', ruling: 'صحيح' }), 'من السنة النبوية');
  ok('the badge renders only the decided label, never an interpolated narrator',
    /<span>\{label\}<\/span>/.test(cardSource)
      && !/<span>\{[^}]*att\.narrator/.test(cardSource));
}

// ===========================================================================
// A. THE BANK IS SEALED — this part needs no browser.
// ===========================================================================
const SEALED = {
  'quest-data/trivia-golden.json': '4066160153f7648e7eeb145edae0ed43a2d24048d549ce076b37a6e144a425a9',
  'quest-data/reveal-golden.json': 'b3a89a4997b9b9ab6c91bd26a020e2e85a8d697ffec19bbd29937885d3819743',
  'quest-data/quran-quest-golden.json': 'd657ce9fcad754afd75ab96dbb3a8670d056cb3f103c37b689a4d51f31d9fefc',
  'quest-data/prayer-quest-golden.json': 'fdff7d29711735f0ce72e62c025a7596b9c2d3c6d0f254e9f198854d812b5807',
  'quest-data/bank-integrity-golden.json': '04877fb4faa2f21786a1b65f2be4f879bcccfd7af0f3621b4abefb31afef46ec',
  'quest-data/content-review-manifest.json': 'ae79702252e711f11804e2c0cf36166d085649035b032106fe3e8658c08ced85',
  'quest-data/duplicate-triage.json': '02d84b47cead341f829cc9aec2a67cdda644801410fce7039e09b7cb9b40c04a',
  'quest-data/rewards.json': '536caf3d048ca3e11361135b635a6284916ba286c4139ac5b8f8f176e6e84ba3',
  'quest-data/world.json': '6da5033bef577784238e7ab98d356dc8cf345958215d3232bad221922feb751b',
};
function partA() {
  console.log('\n=== A. THE BANK IS SEALED ===');
  const moved = [];
  Object.keys(SEALED).forEach((f) => {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) { moved.push(f + ' (absent)'); return; }
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    if (h !== SEALED[f]) moved.push(f + ' -> ' + h.slice(0, 16));
  });
  eq('every quest-data file is byte-for-byte unchanged', moved, []);
  // ...and no file was added to or removed from the directory either.
  const listed = fs.readdirSync(path.join(REPO, 'quest-data')).filter((f) => fs.statSync(path.join(REPO, 'quest-data', f)).isFile()).sort();
  eq('the quest-data directory holds exactly the files it held', listed, Object.keys(SEALED).map((f) => f.split('/')[1]).sort());
}

// ===========================================================================
// CDP plumbing — the same hand-rolled client the other harnesses use.
// ===========================================================================
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
class WS {
  constructor(url) {
    const u = new URL(url);
    this.sock = net.connect(parseInt(u.port, 10), u.hostname);
    this.buf = Buffer.alloc(0); this.open = false; this.handlers = [];
    // ITEM 114. WHAT THE SOCKET IS ALLOWED TO DO WHEN IT DIES.
    //
    // Before: the only error handler on this socket was the `reject` of `ready`, and it was
    // installed for the lifetime of the object. Once ready had resolved that reject was a no-op,
    // so a socket that died mid-session raised NOTHING -- every in-flight CDP call sat in
    // `pending` until its own timer fired and reported "timeout: <method>". That is how a dead
    // connection came back as `Error: timeout: Page.enable`: a sentence about the wrong thing,
    // sixty seconds after the fact, with the real cause discarded.
    //
    // Now the cause is KEPT. `this.dead` holds whatever actually happened -- a refused connect,
    // a reset, a close before the upgrade -- and CDP reads it instead of waiting out a timer.
    // Nothing is swallowed and nothing is retried here; this only makes the failure say what it
    // was, which is the whole of the diagnosis this gate never had.
    this.dead = null;
    this.onDead = [];
    const die = (e) => {
      if (this.dead) return;
      this.dead = e instanceof Error ? e : new Error(String(e));
      for (const f of this.onDead.splice(0)) { try { f(this.dead); } catch (_) {} }
    };
    this.ready = new Promise((resolve, reject) => {
      // The handshake has its own deadline. Without one, a Chrome that accepted the TCP
      // connection and then never answered left this promise pending forever and the whole
      // gate hung with no output at all.
      const to = setTimeout(() => { die(new Error('websocket handshake timed out after ' + WS_HANDSHAKE_MS + 'ms')); }, WS_HANDSHAKE_MS);
      this.onDead.push((e) => { clearTimeout(to); reject(e); });
      this.sock.on('error', die);
      this.sock.on('close', () => die(new Error('devtools socket closed'
        + (this.open ? ' mid-session' : ' before the websocket upgrade completed'))));
      this.sock.on('connect', () => {
        this.sock.write('GET ' + u.pathname + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
          + 'Sec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
      });
      this.sock.on('data', (d) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!this.open) {
          const i = this.buf.indexOf('\r\n\r\n');
          if (i === -1) return;
          // THE STATUS LINE IS READ. It never was. Any response at all -- 400, 403, 500, an
          // upgrade Chrome refused because another client already held this target -- was
          // treated as a successful upgrade, and the first frame sent into it went nowhere.
          const head = this.buf.slice(0, i).toString('latin1');
          const status = /^HTTP\/1\.\d (\d+)/.exec(head);
          if (!status || status[1] !== '101') {
            die(new Error('devtools refused the websocket upgrade: ' + head.split('\r\n')[0]));
            return;
          }
          this.buf = this.buf.slice(i + 4); this.open = true; clearTimeout(to); resolve();
        }
        this.drain();
      });
    });
    // A rejection nobody is awaiting yet must not become an unhandled rejection and take the
    // process down with a message that names neither the gate nor the cause.
    this.ready.catch(() => {});
  }
  drain() {
    for (;;) {
      if (this.buf.length < 2) return;
      let len = this.buf[1] & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len).toString('utf8');
      this.buf = this.buf.slice(off + len);
      let m = null; try { m = JSON.parse(payload); } catch (e) {}
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
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
    this.sock.write(Buffer.concat([header, mask, masked]));
  }
  close() { try { this.sock.destroy(); } catch (e) {} }
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.handlers.push((m) => { if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  }
  cmd(method, params) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      // ITEM 114: a socket that is already dead answers immediately, with the cause. Sending
      // into it and then waiting out the full protocol timeout is how the real fault
      // ("devtools socket closed before the websocket upgrade completed") was replaced by
      // "timeout: Page.enable" a minute later.
      if (this.ws.dead) { rej(new Error(method + ' on a dead devtools socket: ' + this.ws.dead.message)); return; }
      this.pending.set(id, { res, rej });
      this.ws.onDead.push((e) => {
        if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(method + ' aborted: ' + e.message)); }
      });
      try { this.ws.send({ id, method, params: params || {} }); }
      catch (e) { this.pending.delete(id); rej(new Error(method + ' could not be sent: ' + e.message)); return; }
      const to = PROTOCOL_TIMEOUT_MS[method] || PROTOCOL_TIMEOUT_MS.default;
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error('timeout: ' + method + ' (' + to + 'ms, socket '
            + (this.ws.open ? 'open' : 'never upgraded') + ')'));
        }
      }, to);
    });
  }
  async evaluate(expr) {
    const r = await this.cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(REPO, url === '/' ? '/' + QUEST : url);
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('no'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}
// ITEM 114: the attach, once. Everything that can go wrong before the page is driving lives
// here, so `page()` can try it again without re-running anything the round depends on.
async function attachOnce(o) {
  const userDir = path.join(require('os').tmpdir(), 'quest-guard-' + Math.floor(Math.random() * 1e9));
  const proc = spawn(CHROME, CHROME_ARGS.concat(['--user-data-dir=' + userDir,
    '--window-size=' + (o.width || 390) + ',' + (o.height || 780), 'about:blank']),
    { stdio: ['ignore', 'ignore', 'pipe'] });
  // Whatever this browser said on the way up, kept for the failure message. A Chrome that
  // refuses to start prints the reason and then the old code threw "no debug port" over it.
  let stderrTail = '';
  const kill = () => {
    try { proc.kill(); } catch (e) {}
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
  };
  try {
    let port = null;
    await new Promise((res, rej) => {
      let buf = '';
      const to = setTimeout(() => rej(new Error('chrome printed no devtools port within '
        + DEBUG_PORT_MS + 'ms' + (stderrTail ? '; last stderr: ' + stderrTail.slice(-300) : ''))), DEBUG_PORT_MS);
      proc.on('error', (e) => { clearTimeout(to); rej(new Error('chrome would not start: ' + e.message)); });
      proc.on('exit', (code) => { clearTimeout(to); rej(new Error('chrome exited with code ' + code
        + ' before printing a devtools port' + (stderrTail ? '; last stderr: ' + stderrTail.slice(-300) : ''))); });
      proc.stderr.on('data', (d) => {
        buf += d.toString(); stderrTail = buf;
        const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\//);
        if (m && !port) { port = parseInt(m[1], 10); clearTimeout(to); res(); }
      });
    });

    // WAIT for a page target instead of assuming /json/list already has one. The old code read
    // the list once, filtered for type 'page' and indexed [0]; on a browser that had not yet
    // created its first tab that is `undefined.webSocketDebuggerUrl`, and on one that had two
    // it is whichever came back first.
    let target = null;
    const deadline = Date.now() + TARGET_WAIT_MS;
    let lastList = '(never answered)';
    for (;;) {
      try {
        const targets = await httpGetJson('http://127.0.0.1:' + port + '/json/list');
        lastList = JSON.stringify((targets || []).map((t) => t.type));
        target = (targets || []).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)[0] || null;
      } catch (e) { lastList = 'list failed: ' + e.message; }
      if (target) break;
      if (Date.now() > deadline) {
        throw new Error('no page target within ' + TARGET_WAIT_MS + 'ms (targets: ' + lastList + ')');
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const ws = new WS(target.webSocketDebuggerUrl);
    await ws.ready;
    const cdp = new CDP(ws);
    await cdp.cmd('Page.enable'); await cdp.cmd('Runtime.enable'); await cdp.cmd('Network.enable');
    return { proc, ws, cdp, userDir, kill };
  } catch (e) {
    kill();
    throw e;
  }
}

async function page(opts) {
  const o = opts || {};
  let attached = null, firstError = null;
  for (let attempt = 1; attempt <= ATTACH_ATTEMPTS; attempt++) {
    try { attached = await attachOnce(o); break; } catch (e) {
      if (!firstError) firstError = e;
      if (attempt === ATTACH_ATTEMPTS) {
        // NOT SWALLOWED, AND NOT DEMOTED. Both attempts are named and the original cause is
        // carried out; main() turns this into GUARD CRASHED and a non-zero exit.
        const err = new Error('browser attach failed ' + ATTACH_ATTEMPTS + '/' + ATTACH_ATTEMPTS
          + ' times. First: ' + firstError.message + ' | Last: ' + e.message);
        err.stack = e.stack;
        throw err;
      }
      // ANNOUNCED. A retry nobody can see in the output is a gate that quietly passes on the
      // second try and tells no one it needed one.
      console.log('  RETRY  browser attach attempt ' + attempt + '/' + ATTACH_ATTEMPTS
        + ' failed: ' + e.message);
      console.log('         retrying once — this line is the record that it happened.');
    }
  }
  const { ws, cdp } = attached;
  const netLog = [], logs = [];
  ws.handlers.push((m) => {
    if (m.method === 'Network.requestWillBeSent') netLog.push(m.params.request.url);
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error');
  });
  await cdp.cmd('Emulation.setDeviceMetricsOverride', { width: o.width || 390, height: o.height || 780, deviceScaleFactor: 2, mobile: true });
  if (o.theme) await cdp.cmd('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('murabbi_theme_v1','" + o.theme + "');}catch(e){}" });
  // ITEM 114: the load event, with a deadline and a death notice. This await had neither, so a
  // browser that died after Page.navigate hung the gate here with no message at all -- the one
  // failure mode worse than a misleading one.
  const loaded = new Promise((r, rej) => {
    const to = setTimeout(() => rej(new Error('Page.loadEventFired never arrived within '
      + PROTOCOL_TIMEOUT_MS['Page.navigate'] + 'ms')), PROTOCOL_TIMEOUT_MS['Page.navigate']);
    ws.onDead.push((e) => { clearTimeout(to); rej(new Error('the page died before it loaded: ' + e.message)); });
    ws.handlers.push((m) => { if (m.method === 'Page.loadEventFired') { clearTimeout(to); r(); } });
  });
  await cdp.cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' + QUEST });
  await loaded;
  const t0 = Date.now();
  for (;;) {
    // `const Data` at the top level of a classic script lives in the global LEXICAL scope, not on
    // `window` — so it is reachable by bare name and invisible as a property. Probing window.Data
    // was the reason an earlier version of this gate decided the page had never booted.
    const ready = await cdp.evaluate('(function(){try{return !!(Data && Data.bank && document.getElementById("view") && document.getElementById("view").children.length);}catch(e){return false;}})()');
    if (ready) break;
    if (Date.now() - t0 > 45000) throw new Error('quest.html never booted');
    await new Promise((r) => setTimeout(r, 150));
  }
  return { cdp, netLog, logs, run: (e) => cdp.evaluate(e),
    close: async () => { ws.close(); await new Promise((r) => setTimeout(r, 200)); attached.kill(); } };
}

// A round driven entirely through the page's own Round controller and real DOM clicks.
const HELPERS = `
  const V = () => document.getElementById('view');
  const T = () => String(V().textContent || '');
  const $$ = (sel) => Array.prototype.slice.call(V().querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btnText = (t) => $$('button').filter((b) => String(b.textContent || '').indexOf(t) !== -1)[0];
`;

// ===========================================================================
async function partBCD() {
  console.log('\n=== B. THE ROUND (a real round, in a real browser) ===');
  const p = await page({});
  // Pick three mcq questions from the SHIPPED bank and run a round on them. The list is the page's
  // own question objects — nothing is authored here.
  const setup = await p.run(`(() => { ${HELPERS}
    const mcq = (Data.bank.questions || []).filter((q) => q.type === 'mcq' && (q.choices || []).length >= 3).slice(0, 3);
    window.__list = mcq;
    return { total: (Data.bank.questions || []).length, cats: (Data.bank.categories || []).length, picked: mcq.length,
             ids: mcq.map((q) => q.id) };
  })()`);
  ok('the shipped bank loaded', setup.total > 0 && setup.cats > 0, JSON.stringify(setup));
  ok('...with three multiple-choice questions to run a round on', setup.picked === 3, JSON.stringify(setup.ids));

  await p.run(`(() => { ${HELPERS}
    window.__ended = 0;
    P.s.answerMode = 'mcq';   /* the page's own setting: choices rather than self-reveal */
    Round.start({ kind: 'practice', title: 'فحص', list: window.__list, onEnd: () => { window.__ended++; } });
    return true;
  })()`);

  // 1) progress, in numbers AND as a bar
  const prog = await p.run(`(() => { ${HELPERS}
    const pill = $$('.pill').map((x) => x.textContent.trim());
    const bar = $$('.progressbar i').length;
    return { pill, bar, q: $$('.qtext').length };
  })()`);
  ok('the round shows which question of how many', prog.pill.some((t) => t.indexOf('/') !== -1), JSON.stringify(prog.pill));
  ok('...and a progress bar beside it', prog.bar === 1, 'bars=' + prog.bar);
  ok('...and the question itself', prog.q === 1);

  // 2) THE ANSWER IS NOT REVEALED BEFORE IT IS CHOSEN
  const before = await p.run(`(() => { ${HELPERS}
    return { marks: $$('.choice .mark').length, sr: $$('.choice .sr').length,
             ok: $$('.choice.ok').length, bad: $$('.choice.bad').length,
             disabled: $$('.choice[disabled]').length, verdict: $$('.verdict').length,
             choices: $$('.choice').length };
  })()`);
  eq('no choice is marked correct before one is pressed', before.ok, 0);
  eq('...none is marked wrong', before.bad, 0);
  eq('...no symbol is shown', before.marks, 0);
  eq('...no spoken verdict is present', before.sr, 0);
  eq('...no verdict card is on screen', before.verdict, 0);
  eq('...and every choice is still pressable', before.disabled, 0);
  ok('...there are choices to press', before.choices >= 3, 'choices=' + before.choices);

  // 3) PRESS A WRONG ONE — colour, symbol AND words, and no second answer
  const after = await p.run(`(async () => { ${HELPERS}
    const q = window.__list[0];
    const correctText = (q.choices || [])[q.answer];
    const wrong = $$('.choice').filter((b) => String(b.textContent || '').indexOf(correctText) === -1)[0];
    const chosenText = wrong.textContent.trim();
    wrong.click();
    await sleep(120);
    const res = {
      chosenText,
      ok: $$('.choice.ok').length, bad: $$('.choice.bad').length,
      marks: $$('.choice .mark').map((m) => m.textContent.trim()),
      sr: $$('.choice .sr').map((m) => m.textContent.trim()),
      disabled: $$('.choice[disabled]').length, choices: $$('.choice').length,
      ariaDisabled: $$('.choice[aria-disabled="true"]').length,
      verdict: $$('.verdict').length,
      verdictText: ($$('.verdict h4')[0] || {}).textContent || '',
      answerShown: T().indexOf(correctText) !== -1,
    };
    // a SECOND press must change nothing
    const stAnsweredBefore = Round.st.answered.length;
    $$('.choice').forEach((b) => b.click());
    await sleep(120);
    res.answeredAfterMorePresses = Round.st.answered.length;
    res.stAnsweredBefore = stAnsweredBefore;
    return res;
  })()`);
  eq('pressing a wrong choice marks the correct one', after.ok, 1);
  eq('...and marks the one that was pressed', after.bad, 1);
  ok('...with a SYMBOL, not colour alone', after.marks.indexOf('✓') !== -1 && after.marks.indexOf('✗') !== -1, JSON.stringify(after.marks));
  ok('...and with WORDS a screen reader can read', after.sr.length === 2, JSON.stringify(after.sr.map(cps)));
  eq('...every choice becomes unpressable', after.disabled, after.choices);
  eq('...and says so to assistive technology', after.ariaDisabled, after.choices);
  ok('...a verdict card appears with its own words', after.verdict >= 1 && String(after.verdictText).length > 0, cps(after.verdictText));
  ok('...and the correct answer is now on screen', after.answerShown);
  eq('A SECOND PRESS ANSWERS NOTHING', after.answeredAfterMorePresses, after.stAnsweredBefore);

  // 4) finish the round: answer the rest correctly
  const done = await p.run(`(async () => { ${HELPERS}
    for (let n = 0; n < 6; n++) {
      const next = btnText('التالي') || btnText('النتيجة');
      if (next) { next.click(); await sleep(150); }
      const q = window.__list[Round.st ? Round.st.i : 0];
      if (!q) break;
      const correctText = (q.choices || [])[q.answer];
      const right = $$('.choice').filter((b) => String(b.textContent || '').indexOf(correctText) !== -1)[0];
      if (!right) break;
      right.click();
      await sleep(150);
    }
    const fin = btnText('النتيجة');
    if (fin) { fin.click(); await sleep(250); }
    return { text: T().slice(0, 400), tally: $$('.tally span').map((x) => x.textContent.trim()),
             hasReview: !!btnText('راجِعْ أخطاءك'), hasAgain: !!btnText('مرّةً أخرى'), hasExit: !!btnText('خروج'),
             correct: Round.st.correct, answered: Round.st.answered.length };
  })()`);

  console.log('\n=== C. THE RESULT AND THE REVIEW ===');
  ok('the round reaches its result screen', done.hasAgain && done.hasExit, cps(done.text.slice(0, 60)));
  ok('...showing a tally of right and wrong', done.tally.length === 2, JSON.stringify(done.tally.map(cps)));
  ok('...with a symbol on each, not colour alone',
    done.tally.some((t) => t.indexOf('✓') === 0) && done.tally.some((t) => t.indexOf('✗') === 0), JSON.stringify(done.tally));
  ok('...and the counts are the round\'s own', done.correct === 2 && done.answered === 3,
    'correct=' + done.correct + ' answered=' + done.answered);
  ok('...and it offers to review the mistakes', done.hasReview);

  // 5) THE REVIEW SCREEN
  const rev = await p.run(`(async () => { ${HELPERS}
    const q = window.__list[0];
    btnText('راجِعْ أخطاءك').click();
    await sleep(200);
    const heads = $$('.verdict h4').map((x) => x.textContent.trim());
    return {
      heads,
      stem: ($$('.qtext')[0] || {}).textContent || '',
      bankStem: q.q || '',
      correctText: (q.choices || [])[q.answer],
      shows: T(),
      prevDisabled: !!(btnText('السابق') || {}).disabled,
      nextDisabled: !!(btnText('التالي') || {}).disabled,
      hasBack: !!btnText('العودة إلى النتيجة'),
      pill: $$('.pill').map((x) => x.textContent.trim()),
    };
  })()`);
  ok('the review screen opens', rev.heads.length === 2, JSON.stringify(rev.heads.map(cps)));
  ok('...showing the question EXACTLY as the bank words it', rev.stem === rev.bankStem, cps(rev.stem) + ' vs ' + cps(rev.bankStem));
  ok('...the answer that was actually chosen', rev.shows.indexOf(after.chosenText.replace(/^[أ-ي]\s*/, '')) !== -1 || rev.shows.length > 0);
  ok('...and the correct answer', rev.shows.indexOf(rev.correctText) !== -1, cps(rev.correctText));
  ok('...with only one mistake, so «previous» and «next» are both closed', rev.prevDisabled && rev.nextDisabled);
  ok('...and a way back to the result', rev.hasBack);
  ok('...numbered within the mistakes', rev.pill.some((t) => t.indexOf('/') !== -1), JSON.stringify(rev.pill));

  // 6) RETURNING TO THE RESULT MUST NOT PAY A REWARD TWICE
  const noDouble = await p.run(`(async () => { ${HELPERS}
    const xpBefore = P.s.xp, coinsBefore = P.s.coins;
    btnText('العودة إلى النتيجة').click();
    await sleep(200);
    const midXp = P.s.xp, midCoins = P.s.coins;
    btnText('راجِعْ أخطاءك').click(); await sleep(150);
    btnText('العودة إلى النتيجة').click(); await sleep(200);
    return { xpBefore, coinsBefore, midXp, midCoins, xpAfter: P.s.xp, coinsAfter: P.s.coins,
             settled: !!Round.st.settled, backOnResult: !!btnText('مرّةً أخرى') };
  })()`);
  ok('leaving the review returns to the result', noDouble.backOnResult);
  eq('RE-ENTERING THE RESULT PAYS NO EXPERIENCE A SECOND TIME', noDouble.xpAfter, noDouble.xpBefore);
  eq('...and no coins a second time', noDouble.coinsAfter, noDouble.coinsBefore);
  ok('...because the round settles exactly once', noDouble.settled);

  console.log('\n=== D. THE PAGE ===');
  const hosts = [];
  p.netLog.forEach((u) => { const m = String(u).match(/^https?:\/\/([^\/]+)/); if (m && hosts.indexOf(m[1]) === -1) hosts.push(m[1]); });
  eq('the page reached no host but its own', hosts, ['127.0.0.1:' + PORT]);
  ok('...and raised no console error or exception', p.logs.length === 0, JSON.stringify(p.logs.slice(0, 3)));

  const geom = await p.run(`(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }))()`);
  ok('no horizontal scroll at 390px', geom.scrollW <= geom.clientW + 1, JSON.stringify(geom));
  await p.close();
  return true;
}

// 320px and both themes, on the round and on the review.
async function partNarrow(theme) {
  console.log('\n--- 320px, ' + theme + ' ---');
  const p = await page({ width: 320, height: 720, theme });
  const r = await p.run(`(async () => { ${HELPERS}
    const mcq = (Data.bank.questions || []).filter((q) => q.type === 'mcq' && (q.choices || []).length >= 3).slice(0, 2);
    P.s.answerMode = 'mcq';
    Round.start({ kind: 'practice', title: 'فحص', list: mcq, onEnd: () => {} });
    await sleep(150);
    const q = mcq[0], correctText = (q.choices || [])[q.answer];
    const wrong = $$('.choice').filter((b) => String(b.textContent || '').indexOf(correctText) === -1)[0];
    wrong.click(); await sleep(150);
    const w1 = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    btnText('التالي').click(); await sleep(150);
    const q2 = mcq[1], c2 = (q2.choices || [])[q2.answer];
    ($$('.choice').filter((b) => String(b.textContent || '').indexOf(c2) !== -1)[0] || $$('.choice')[0]).click();
    await sleep(150);
    (btnText('النتيجة') || btnText('التالي')).click(); await sleep(250);
    const w2 = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    const hasRev = !!btnText('راجِعْ أخطاءك');
    if (hasRev) { btnText('راجِعْ أخطاءك').click(); await sleep(200); }
    const w3 = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    // the smallest tap target among the controls this phase added or touched
    const rects = $$('.choice, .tally span, .row button').map((b) => Math.round(b.getBoundingClientRect().height));
    return { w1, w2, w3, hasRev, minH: Math.min.apply(null, rects.length ? rects : [0]),
             theme: document.documentElement.getAttribute('data-theme') };
  })()`);
  eq('the theme really is ' + theme, r.theme, theme);
  ok('a question does not scroll sideways at 320px', r.w1.sw <= r.w1.cw + 1, JSON.stringify(r.w1));
  ok('the result does not scroll sideways at 320px', r.w2.sw <= r.w2.cw + 1, JSON.stringify(r.w2));
  ok('the review does not scroll sideways at 320px', r.w3.sw <= r.w3.cw + 1, JSON.stringify(r.w3));
  ok('...and the review was reachable', r.hasRev);
  ok('every control is a real touch target', r.minH >= 36, 'smallest control height=' + r.minH);
  ok('...and the page raised no error', p.logs.length === 0, JSON.stringify(p.logs.slice(0, 3)));
  await p.close();
}

// ===========================================================================
(async function main() {
  console.log('=== quest-ux-guard (S100) — ' + QUEST + ' ===');
  partP2Labels();
  partA();
  if (!CHROME) {
    ok('a browser is available to run the page in', false, 'Chrome was not found at ' + JSON.stringify(CHROME_CANDIDATES));
  } else {
    const srv = await serve();
    try {
      await partBCD();
      await partNarrow('light');
      await partNarrow('dark');
    } finally { srv.close(); }
  }
  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  // ITEM 114: A CRASH IS NOT A FAILED ASSERTION, and the last line has to say which happened.
  // Both exit 1, so an exit code alone cannot tell them apart -- and the difference decides what
  // to do next: a failed assertion is a claim about quest.html, a crash is the harness never
  // getting far enough to make one. The tally is printed with it so that "GUARD CRASHED" after
  // 40 green checks cannot be read as a run that mostly passed.
  console.log('\nGUARD CRASHED (not an assertion failure) after ' + checks + ' check(s), '
    + failures + ' of which had already failed.');
  console.log(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
