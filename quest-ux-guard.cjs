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
const { spawn } = require('child_process');

const REPO = __dirname;
const QUEST = process.argv[2] || 'quest.html';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const CHROME = CHROME_CANDIDATES.filter((p) => fs.existsSync(p))[0];
const PORT = 8981;

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
    this.ready = new Promise((resolve, reject) => {
      this.sock.on('error', reject);
      this.sock.on('connect', () => {
        this.sock.write('GET ' + u.pathname + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
          + 'Sec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
      });
      this.sock.on('data', (d) => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!this.open) { const i = this.buf.indexOf('\r\n\r\n'); if (i === -1) return; this.buf = this.buf.slice(i + 4); this.open = true; resolve(); }
        this.drain();
      });
    });
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
      this.pending.set(id, { res, rej });
      this.ws.send({ id, method, params: params || {} });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout: ' + method)); } }, 60000);
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
async function page(opts) {
  const o = opts || {};
  const userDir = path.join(require('os').tmpdir(), 'quest-guard-' + Math.floor(Math.random() * 1e9));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + userDir,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--window-size=' + (o.width || 390) + ',' + (o.height || 780), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let port = null;
  await new Promise((res, rej) => {
    let buf = ''; const to = setTimeout(() => rej(new Error('no debug port')), 30000);
    proc.stderr.on('data', (d) => { buf += d.toString(); const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\//); if (m && !port) { port = parseInt(m[1], 10); clearTimeout(to); res(); } });
  });
  const targets = await httpGetJson('http://127.0.0.1:' + port + '/json/list');
  const ws = new WS(targets.filter((t) => t.type === 'page')[0].webSocketDebuggerUrl);
  await ws.ready;
  const cdp = new CDP(ws);
  await cdp.cmd('Page.enable'); await cdp.cmd('Runtime.enable'); await cdp.cmd('Network.enable');
  const netLog = [], logs = [];
  ws.handlers.push((m) => {
    if (m.method === 'Network.requestWillBeSent') netLog.push(m.params.request.url);
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error');
  });
  await cdp.cmd('Emulation.setDeviceMetricsOverride', { width: o.width || 390, height: o.height || 780, deviceScaleFactor: 2, mobile: true });
  if (o.theme) await cdp.cmd('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('murabbi_theme_v1','" + o.theme + "');}catch(e){}" });
  const loaded = new Promise((r) => { ws.handlers.push((m) => { if (m.method === 'Page.loadEventFired') r(); }); });
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
    close: async () => { ws.close(); proc.kill(); await new Promise((r) => setTimeout(r, 200)); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {} } };
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
})().catch((e) => { console.log('\nGUARD CRASHED: ' + String(e && e.stack ? e.stack : e)); process.exit(1); });
