// SPEED item 17: offline DOM/transport guard, using the chat-ux/markdown harness
// convention: the shipped Babel block, local React UMDs, linkedom, and real clicks.
// No fetch in this process reaches a network. Timers owned by the reading hint and
// reveal queue are advanced explicitly; the production callbacks are not replaced.
// Usage: node guards/speed-client-guard.cjs [index.html] [--case U1] [--mutants]
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const cp = require('child_process');
const assert = require('assert/strict');
const { parseHTML } = require('linkedom');
const BB = require('../tools/babel-block.cjs');
const REPO = path.resolve(__dirname, '..');
const native = { setTimeout, clearTimeout, setInterval, clearInterval };
const baseConsole = { ...console };
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const say = (s) => console.log(ascii(s));
const tick = () => new Promise((resolve) => native.setTimeout(resolve, 15));
const plain = (x) => JSON.parse(JSON.stringify(x));
const PROFILE = { name: '\u0633\u0644\u0645\u0649', age: 30, gender: 'female', birthYear: 1996, pid: 'SPEED-CLIENT', createdAt: '2026-01-01T00:00:00.000Z' };
const QUESTION = '\u0643\u064a\u0641 \u0623\u062a\u0639\u0644\u0645\u061f';
const DIACRITICS = '\u0627\u0644\u0639\u0650\u0644\u0652\u0645\u064f \u0646\u064f\u0648\u0631\u064c.';
const LABELS = {
  retrieve: '\u064a\u0628\u062d\u062b \u0641\u064a \u0645\u0635\u0627\u062f\u0631 \u0639\u0632\u0643\u2026',
  fatwa: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0627\u0644\u0641\u062a\u0627\u0648\u0649\u2026',
  library: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0643\u062a\u0628 \u0627\u0644\u0634\u0627\u0645\u0644\u0629\u2026',
  encyclopedia: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629\u2026',
  lessons: '\u064a\u0642\u0631\u0623 \u0641\u064a \u0627\u0644\u062f\u0631\u0648\u0633\u2026',
  judge: '\u064a\u062e\u062a\u0627\u0631 \u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u062a\u064a \u062a\u062c\u064a\u0628 \u0639\u0646 \u0627\u0644\u0645\u0633\u0623\u0644\u0629\u2026',
  write: '\u064a\u0643\u062a\u0628 \u0627\u0644\u062c\u0648\u0627\u0628\u2026',
};
const OFFER_LABEL = '\u0627\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0622\u0646';
const FOUND_12 = ' \u0648\u062c\u062f \u0661\u0662';
const DELTA = (text) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
const frame = (evt) => Buffer.from('data: ' + JSON.stringify(evt) + '\n\n', 'utf8');
const FALLBACK = '\u064a\u064f\u062d\u0636\u0650\u0651\u0631\u064f \u0627\u0644\u062c\u0648\u0627\u0628\u064e\u2026';
const OLD_REPLY = DIACRITICS + '\n\n**Legacy emphasis**\nsecond line\n\n'
  + '<steps title="Legacy steps">One\nTwo</steps>\n'
  + '<hadith narrator="" ruling="">Legacy quotation</hadith>\n'
  + '<book author="Legacy author" ref="1/2">Legacy book</book>\n'
  + '<source site="Legacy source" url="https://example.invalid/source">Legacy citation</source>';

function streamQueue() {
  const queue = [];
  let pending = null;
  const deliver = (v) => { if (pending) { const take = pending; pending = null; take(v); } else queue.push(v); };
  return {
    bytes: (value) => deliver({ done: false, value }),
    send(evt) { this.bytes(frame(evt)); },
    end() { deliver({ done: true }); },
    response: { ok: true, status: 200, headers: { get: () => null }, body: { getReader: () => ({
      read: () => queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve) => { pending = resolve; }),
    }) } },
  };
}

async function boot(htmlFile, { tashkeel = true, reduced = false, seed = {} } = {}) {
  const block = BB.readBabelBlock({ file: htmlFile });
  const transformed = BB.transformBabelBlock(block);
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div><div id="fixture"></div></body></html>');
  window.self = window;
  window.window = window;
  window.globalThis = window;
  window.matchMedia = (q) => ({ matches: reduced && /prefers-reduced-motion/.test(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  window.alert = () => {};
  window.confirm = () => true;
  window.TextDecoder = TextDecoder;
  window.TextEncoder = TextEncoder;
  window.AbortController = AbortController;
  const data = {
    child_profile: JSON.stringify(PROFILE), disclosureAck: '1', tashkeel_v1: tashkeel ? '1' : '0',
    ezik_ai_consent_v1: JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: PROFILE.pid, grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' }),
    ...seed,
  };
  window.localStorage = {
    getItem: (k) => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null,
    setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; },
  };
  const reveal = new Map(), hints = new Map(), timers = new Set();
  window.setTimeout = (fn, ms, ...args) => {
    if (ms === 4000) { const id = {}; hints.set(id, () => fn(...args)); return id; }
    const id = native.setTimeout(fn, ms, ...args); timers.add(id); return id;
  };
  window.clearTimeout = (id) => { hints.delete(id); native.clearTimeout(id); };
  window.setInterval = (fn, ms, ...args) => {
    if (ms === 28) { const id = {}; reveal.set(id, () => fn(...args)); return id; }
    const id = native.setInterval(fn, ms, ...args); timers.add(id); return id;
  };
  window.clearInterval = (id) => { reveal.delete(id); native.clearInterval(id); };
  const requests = [], streams = [], network = [], errors = [];
  window.fetch = async (url, opts = {}) => {
    network.push(String(url));
    if (String(url) === '/api/ask') {
      const stream = streamQueue(); streams.push(stream);
      requests.push({ body: JSON.parse(opts.body), headers: plain(opts.headers), credentials: opts.credentials, method: opts.method });
      return stream.response;
    }
    return { ok: false, status: 0, headers: { get: () => null }, text: async () => '', json: async () => ({}) };
  };
  window.console = { ...baseConsole, error: (...a) => errors.push(a.map(String).join(' ')) };
  window.addEventListener('error', (ev) => errors.push(String(ev.error || ev.message)));
  Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
  global.window = window;
  global.document = window.document;
  const ctx = vm.createContext(window);
  for (const f of ['react.umd.js', 'react-dom.umd.js']) vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  const grab = (expr) => vm.runInContext('(' + expr + ')', ctx);
  let root;
  const createRoot = window.ReactDOM.createRoot;
  window.ReactDOM.createRoot = function (...args) { const r = createRoot.apply(this, args); if (!root) root = r; return r; };
  vm.runInContext(transformed, ctx, { filename: 'speed-client-app.jsx' });
  const doc = window.document;
  const all = (sel) => Array.from(doc.querySelectorAll(sel));
  const byLabel = (label) => all('button').find((b) => b.getAttribute('aria-label') === label);
  const c = {
    window, ctx, grab, all, byLabel, requests, streams, data, network,
    answer: () => all('.ezc-ans').at(-1),
    preview: () => doc.querySelector('[data-ezik-stream]'),
    reading: () => doc.querySelector('[data-ezik-reading]'),
    offers: () => all('[data-ezik-live-offer]'),
    pump() { window.ReactDOM.flushSync(() => { for (const fn of Array.from(reveal.values())) fn(); }); },
    fireHint() { assert.equal(hints.size, 1, 'one 4000ms fallback timer'); for (const [id, fn] of hints) { hints.delete(id); window.ReactDOM.flushSync(fn); } },
    async wait(fn, what) {
      for (let i = 0; i < 160; i++) { c.pump(); if (fn()) return; await tick(); }
      throw new Error('timed out: ' + what + '; errors=' + errors.join(' | '));
    },
    async paint() { await tick(); for (let i = 0; i < 500; i++) c.pump(); await tick(); },
    async click(el) { assert.ok(el, 'click target exists'); el.dispatchEvent(new window.Event('click', { bubbles: true })); await tick(); },
    async ask(text = QUESTION) {
      const ta = doc.querySelector('textarea'); assert.ok(ta, 'composer exists');
      const key = Object.keys(ta).find((k) => k.startsWith('__reactProps$'));
      assert.ok(key && typeof ta[key].onChange === 'function', 'real composer onChange');
      ta[key].onChange({ target: { value: text }, currentTarget: ta, preventDefault() {}, stopPropagation() {} });
      await tick();
      const before = requests.length;
      await c.click(byLabel(grab("ezT('chat.send')")));
      await c.wait(() => requests.length === before + 1, 'POST body');
      return streams.at(-1);
    },
    async finish(stream) {
      stream.send({ type: 'message_stop' }); stream.end();
      await c.wait(() => c.all('.ezc-acts').length === requests.length, 'completed turn');
      await tick();
    },
    close() { if (root) window.ReactDOM.flushSync(() => root.unmount()); for (const id of timers) { native.clearTimeout(id); native.clearInterval(id); } reveal.clear(); hints.clear(); },
  };
  await c.wait(() => !!doc.querySelector('textarea'), 'chat mount');
  return c;
}

async function withApp(html, opts, fn) { const c = await boot(html, opts); try { await fn(c); } finally { c.close(); } }
const cases = {
  async U1(html) {
    await withApp(html, {}, async (c) => {
      const st = await c.ask();
      // A real UTF-8 SSE frame split inside the JSON, not a direct callback invocation.
      const first = frame({ type: 'ezik_status', stage: 'retrieve' });
      st.bytes(first.subarray(0, 19)); await tick();
      assert.equal(c.reading(), null, 'incomplete frame is buffered');
      st.bytes(first.subarray(19)); await c.paint();
      assert.equal(c.reading()?.textContent, LABELS.retrieve);
      st.send(DELTA('')); await c.paint();
      assert.equal(c.reading()?.textContent, LABELS.retrieve, 'empty delta is not answer text');
      for (const stage of Object.keys(LABELS).slice(1)) {
        st.send({ type: 'ezik_status', stage, hits: 12 }); await c.paint();
        assert.equal(c.all('[data-ezik-reading]').length, 1, 'one reading line');
        assert.equal(c.reading().textContent, LABELS[stage] + (['fatwa', 'library', 'encyclopedia', 'lessons'].includes(stage) ? FOUND_12 : ''));
      }
      st.send({ type: 'ezik_status', stage: 'fatwa', hits: 0 }); await c.paint();
      assert.equal(c.reading().textContent, LABELS.fatwa);
      st.send({ type: 'ezik_status', stage: 'unknown', hits: 4 }); await c.paint();
      assert.equal(c.reading().textContent, LABELS.fatwa, 'unknown stage leaves valid line alone');
      st.send(DELTA(DIACRITICS)); await c.paint();
      assert.equal(c.reading(), null, 'first text removes the line');
      st.send({ type: 'ezik_status', stage: 'write' }); await c.paint();
      assert.equal(c.reading(), null, 'late status cannot replace answer text');
      await c.finish(st);
    });
  },
  async U2(html) {
    await withApp(html, {}, async (c) => {
      const st = await c.ask();
      assert.equal(c.answer().textContent, '\u25cf\u25cf\u25cf', 'original three waiting dots');
      assert.equal(c.reading(), null);
      c.fireHint();
      assert.equal(c.reading()?.textContent, FALLBACK, 'original generic status after 4000ms');
      assert.equal(c.answer().textContent, FALLBACK + '\u25cf\u25cf\u25cf');
      st.send(DELTA('Ready')); await c.paint();
      assert.equal(c.reading(), null);
      await c.finish(st);
    });
  },
  async U3(html) {
    for (const reduced of [false, true]) await withApp(html, { reduced }, async (c) => {
      const st = await c.ask();
      st.send(DELTA('Before\n\n<')); await c.paint();
      assert.equal(c.answer().textContent, 'Before', 'even a lone opening bracket is withheld');
      st.send(DELTA('steps title="Middle">One\nTwo')); await c.paint();
      assert.equal(c.answer().textContent, 'Before', 'unclosed card body stays withheld');
      st.send(DELTA('</steps>\n\nAfter')); await c.paint();
      const t = c.answer().textContent;
      assert.ok(t.indexOf('Before') < t.indexOf('Middle') && t.indexOf('Middle') < t.indexOf('After'), 'mid-stream card sits between its prose');
      assert.equal(c.answer().querySelectorAll('li').length, 2, 'whole card is rendered');
      const advance = c.grab('ezikRevealAdvance');
      const src = 'ab<steps>One</steps>cd';
      assert.equal(advance(src, 2, 1, false), src.indexOf('cd'), 'reveal cursor jumps the complete card');
      assert.equal(advance('ab<steps>One', 2, 5, false), 2, 'reveal cursor waits at incomplete card');
      const preview = c.grab('ezikStreamPreviewSegments');
      for (const name of plain(c.grab('KNOWN_TAG_NAMES'))) {
        assert.deepEqual(plain(preview('Before<' + name + '>partial', 30)), [{ type: 'text', content: 'Before' }], name + ' incomplete withheld');
      }
      await c.finish(st);
    });
  },
  async U4(html) {
    await withApp(html, {}, async (c) => {
      const st = await c.ask();
      const reply = 'First\n<steps title="Position one">One\nTwo</steps>\nMiddle\n'
        + '<book author="Author" matn="' + Buffer.from('Selected passage').toString('base64') + '">Position two</book>\nLast';
      st.send(DELTA(reply)); await c.paint();
      const bookButton = c.answer().querySelector('button[aria-expanded]');
      await c.click(bookButton);
      assert.ok(c.answer().textContent.includes('Selected passage'), 'reader opens the book during streaming');
      const before = c.answer().innerHTML, style = c.answer().getAttribute('style');
      assert.ok(before.includes('Position one') && before.includes('Position two'), 'both cards visible before EOF');
      await c.finish(st);
      assert.equal(c.answer().innerHTML, before, 'identical card/prose DOM order after completion');
      assert.equal(c.answer().getAttribute('style'), style, 'same reading-sheet layout before and after');
      assert.equal(c.answer().querySelector('button[aria-expanded]'), bookButton, 'card keeps its mounted instance');
    });
  },
  async U5(html) {
    await withApp(html, {}, async (c) => {
      const st = await c.ask();
      st.send(DELTA('Not covered.')); st.send({ type: 'ezik_live_offer' }); st.send({ type: 'ezik_live_offer' });
      await c.paint();
      assert.equal(c.offers().length, 1, 'duplicate offer frames draw one button');
      assert.equal(c.offers()[0].textContent, OFFER_LABEL);
      assert.ok(c.offers()[0].disabled, 'offer waits until the current turn finishes');
      await c.finish(st);
      assert.equal(c.offers().length, 1); assert.equal(c.offers()[0].disabled, false);
      const button = c.offers()[0];
      button.dispatchEvent(new c.window.Event('click', { bubbles: true }));
      button.dispatchEvent(new c.window.Event('click', { bubbles: true }));
      await c.wait(() => c.requests.length === 2, 'live search request'); await c.paint();
      assert.equal(c.requests.length, 2, 'double press issues one new turn');
      assert.equal(c.offers().length, 1); assert.ok(c.offers()[0].disabled, 'used offer stays disabled');
      const first = c.requests[0], next = c.requests[1];
      assert.equal(Object.hasOwn(first.body, 'liveSearch'), false, 'ordinary request omits opt-in');
      assert.equal(next.body.liveSearch, true);
      assert.deepEqual(next.body.messages, [first.body.messages[0], { role: 'assistant', content: 'Not covered.' }, first.body.messages[0]], 'same question as a new turn, including normal history');
      const ordinary = (r) => { const b = { ...r.body }; delete b.messages; delete b.liveSearch; return { ...r, body: b }; };
      assert.deepEqual(ordinary(next), ordinary(first), 'all other request fields and headers unchanged');
      const used = Object.entries(c.data).filter(([k]) => k.startsWith('ezik_chat_v1_')).map(([, v]) => JSON.parse(v)).flat();
      assert.ok(used.some((m) => m.liveOffer && m.liveOfferUsed), 'use is saved with the answer');
      const retry = c.streams[1]; retry.send(DELTA('Live answer')); await c.finish(retry);
      assert.ok(c.offers()[0].disabled, 'use survives completion of the new turn');
    });
  },
  async U6(html) {
    for (const tashkeel of [true, false]) await withApp(html, { tashkeel }, async (c) => {
      const st = await c.ask();
      st.send(DELTA(DIACRITICS + '\n\n**Second paragraph**\nThird line')); await c.paint();
      const before = c.answer().textContent, dom = c.answer().innerHTML;
      if (tashkeel) assert.ok(before.startsWith(DIACRITICS), 'diacritics arrive letter for letter');
      else assert.ok(!/[\u064b-\u065f]/.test(before), 'the chosen unvocalized view applies from the first paint');
      await c.finish(st);
      assert.equal(c.answer().textContent, before, 'visible letters identical at completion');
      assert.equal(c.answer().innerHTML, dom, 'paragraphs and formatting do not reflow at completion');
    });
  },
  async U7(html) {
    const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-speed-client-old-path.json'), 'utf8'));
    assert.equal(baseline.head, 'af3e995f866a30ebea4b194ad2dece05584f87e9');
    for (const tashkeel of [true, false]) await withApp(html, { tashkeel }, async (c) => {
      const st = await c.ask(); st.send(DELTA(OLD_REPLY)); await c.finish(st);
      const expected = baseline.views[String(tashkeel)];
      assert.equal(c.answer().innerHTML, expected.html, 'old-path completed DOM equals measured main');
      assert.deepEqual(c.requests[0].body, expected.body, 'old-path request equals measured main');
      assert.equal(c.offers().length, 0, 'no offer without a server frame');
    });
  },
};

async function mutations(html) {
  const original = BB.readBabelBlock({ file: html }).raw;
  const changes = {
    U1: ['setReadingStatus(label);', 'setReadingStatus(null);', 'discard a valid status label'],
    U2: ['setSearchingSources(true);', 'setSearchingSources(false);', 'disable the legacy timer hint'],
    U3: ['ezikStreamPreviewSegments(message.content, age)', 'ezikStreamPreviewSegments(formatForStreamPreview(message.content), age)', 'strip complete cards from the live preview'],
    U4: ['const shownSegments = (canFold && !foldOpen) ? foldView : segments;', 'const shownSegments = (canFold && !foldOpen) ? foldView : (streaming ? segments : segments.slice().reverse());', 'reverse completed segment order'],
    U5: ['...(liveSearch === true ? { liveSearch: true } : {}),', '...{},', 'drop liveSearch from the request'],
    U6: ['ezikRenderSegments(shownSegments, { tashkeel, age,', 'ezikRenderSegments(shownSegments, { tashkeel: streaming ? tashkeel : false, age,', 'remove diacritics only at completion'],
    U7: ['<SourceCard key={i} site={seg.site} url={seg.url} content={seg.content} />', '<SourceCard key={i} site={seg.site} url={seg.url} content={seg.content + "!"} />', 'change old-path source-card text'],
  };
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-speed-client-mutants-'));
  say('Mutation evidence: ' + scratch);
  for (const [id, [before, after, description]] of Object.entries(changes)) {
    assert.equal(original.split(before).length - 1, 1, id + ' mutation anchor is unique');
    const dir = path.join(scratch, id); fs.mkdirSync(dir);
    const target = path.join(dir, 'index.html'); fs.copyFileSync(html, target);
    fs.writeFileSync(path.join(dir, 'app.jsx'), original.replace(before, after));
    const r = cp.spawnSync(process.execPath, [__filename, target, '--case', id], { cwd: REPO, encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
    fs.writeFileSync(path.join(dir, 'result.txt'), ascii((r.stdout || '') + (r.stderr || '')));
    assert.equal(r.status, 1, id + ' mutant must exit 1');
    assert.ok((r.stdout || '').includes('FAIL ' + id), id + ' must fail its behavioral case, not merely fail to boot');
    assert.ok((r.stdout || '').includes('AssertionError'), id + ' must reach a behavioral assertion');
    say('PASS mutation ' + id + ': ' + description + ' -> exit 1');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const html = path.resolve(args[0] && !args[0].startsWith('--') ? args.shift() : path.join(REPO, 'index.html'));
  const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
  assert.ok(!only || Object.hasOwn(cases, only), 'known --case');
  let failed = 0;
  for (const [id, run] of Object.entries(cases)) {
    if (only && only !== id) continue;
    try { await run(html); say('PASS ' + id); }
    catch (e) { failed++; say('FAIL ' + id + ': ' + e.stack); }
  }
  if (args.includes('--mutants') && !failed) {
    try { await mutations(html); } catch (e) { failed++; say('FAIL mutations: ' + e.stack); }
  }
  say('speed-client: ' + (only ? 1 : 7) + ' cases, ' + failed + ' failing');
  process.exit(failed ? 1 : 0);
}
module.exports = { boot, OLD_REPLY, QUESTION };
if (require.main === module) main().catch((e) => { say(e.stack); process.exit(1); });
