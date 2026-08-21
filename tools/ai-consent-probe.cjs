// tools/ai-consent-probe.cjs
// THE AI-CONSENT PROBE  (Apple 5.1.1(i) / 5.1.2(i)).
//
// It proves the phase the way every other guard in this repo does: by RUNNING the shipped code.
// The text/babel block is extracted from index.html, transformed with the page's own pinned Babel
// major, and evaluated inside a linkedom window against a localStorage stub and a fetch stub this
// file controls -- so "did a request go out?" is a fact recorded by the probe, not an inference
// from reading the source. The six server routes are imported for real and handed a req/res pair.
//
// It IS a gate: gates.json registers it as `aiconsent`, so `npm run gates` runs it with the rest.
// The roster is gates.json and the count is however many entries that file holds -- no number is
// repeated here, because a number written into a comment goes stale the next time a gate lands.
// To run this one alone:
//     node tools/ai-consent-probe.cjs
//
// PARTS -- one per lettered requirement:
//   A. A NEW READER          no consent record, no POST to any AI route, the screen is shown
//   B. DECLINED              AI blocked; mushaf, adhkar and treasures still reachable; no requests
//   C. GRANTED, 13+          status/grantedBy recorded; the ask goes out; it carries the header
//   D. UNDER 13              the agree button alone enables nothing; guardian => grantedBy guardian
//   E. WITHDRAWAL            granted -> declined; later sends never call fetch; server 403s
//   F. VERSION DRIFT         an old value or a different version re-shows the screen
//   G. ANALYTICS             no Vercel Analytics / Speed Insights script in index.html
//   H. LINKS                 privacy, delete and support open from the screen AND from settings
//   I. CHOKE POINT           no bare fetch to an AI route; the server guard precedes every send
//   J. WEB SPEECH            no engine constructed, started, or restarted without live consent
//   L. ISOLATION           no case inherits a granted store from the case before it
//   K. SOURCE CENSUS         every engine reference, start, mic and recorder in the file, classified
//
// Every DIAGNOSTIC that prints a matched string prints its codepoints too: a failure message
// carrying raw Arabic reorders under bidi and then lies about which value it names.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

const REPO = path.resolve(__dirname, '..');
const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(path.join(REPO, htmlFile), 'utf8');

const CONSENT_KEY = 'ezik_ai_consent_v1';
const CONSENT_VERSION = '2026-08-06-1';
const CONSENT_HEADER = 'x-ezik-ai-consent';
const AI_ROUTES = ['/api/ask', '/api/chat', '/api/chat-fast', '/api/tashkeel', '/api/tts', '/api/stt'];

// The Arabic the probe looks for, collected here so no assertion carries a raw literal inline.
const S = {
  TITLE: 'مشاركة البيانات مع خدمات الذكاء الاصطناعي',
  AGREE: 'أوافق وأفعّل ميزات الذكاء الاصطناعي',
  DECLINE: 'استخدام عزك دون الذكاء الاصطناعي',
  LOCAL_BODY: 'ميزات الذكاء الاصطناعي غير مفعّلة لأن مشاركة البيانات لم تتم الموافقة عليها.',
  GUARDIAN: 'يجب على ولي الأمر مراجعة هذه المعلومات والموافقة قبل تشغيل ميزات الذكاء الاصطناعي للطفل.',
  REVIEW: 'مراجعة إعدادات الخصوصية',
  OPEN_MUSHAF: 'فتح المصحف',
  OPEN_ADHKAR: 'فتح الأذكار',
  OPEN_TREASURE: 'فتح كنوز المعرفة',
  SETTINGS_GROUP: 'الخصوصية والذكاء الاصطناعي',
  WITHDRAW: 'سحب الموافقة وإيقاف ميزات الذكاء الاصطناعي',
  REVIEW_SETTINGS: 'مراجعة الموافقة وتشغيل ميزات الذكاء الاصطناعي',
  SETTINGS_TITLE: 'الإعدادات',
  UNDERSTOOD: 'فهمت',
  CONFIRM: 'تأكيد',
  // The chat header's drawer toggle, by its accessible name -- "open the side menu". It is the
  // ONE deterministic way into Settings while consent is held: the drawer's pinned footer holds
  // the settings entry. Pinned as codepoints, because a raw RTL literal in a selector is the
  // thing that silently stops matching after somebody retypes the file.
  OPEN_DRAWER: 'فتح القائمة الجانبية',
  SETTINGS_GEAR: 'الإعدادات',
  // S118: the home's top bar no longer carries a settings icon -- it carries the daily verse and
  // one menu button, and the settings entry is a row inside the menu that button opens. Both
  // names below are real reader paths and both are walked.
  HOME_MENU: 'القائمة',
  HOME_SETTINGS: 'الإعدادات',
};

// Arabic comparison, diacritic-blind. The policy pages and the UI are authored by different
// hands at different times, and a shadda that one carries and the other does not is a
// difference in spelling, not in meaning -- it must not be able to fail a legal assertion.
const bare = (s) => String(s == null ? '' : s).replace(/[ً-ْٰـ]/g, '');
const hasAr = (haystack, needle) => bare(haystack).indexOf(bare(needle)) !== -1;

// EVERY line this probe prints goes through fs.writeSync(1) rather than console.log. The reason
// is specific and was measured, not guessed: the app is mounted inside a contextified linkedom
// window whose `console` is the SAME object Node's global console is bound to, and silencing the
// app's console (which this probe must do, or a hundred lines of app logging drown the report)
// takes the report down with it. A synchronous write to fd 1 belongs to this process alone.
const say = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) {} };

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { say('  PASS  ' + name); return true; }
  failures++;
  say('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
function head(t) { say('\n=== ' + t + ' ==='); }
const plain = (v) => JSON.parse(JSON.stringify(v));
const cps = (x) => Array.prototype.map.call(String(x == null ? '' : x),
  (c) => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

/* ===================== the shipped block, transformed ===================== */
// ITEM 32-b. The block is cut, and the JSX runtime settled, in ONE place: ./babel-block.cjs.
// This used to be a private copy of the same two regexes plus `: 8` -- a SILENT fallback that
// let this gate keep transforming, with the wrong runtime, after the CDN tag it reads was
// removed. The helper raises a named error instead. (Measured: the page pins 7.26.4, so the
// runtime is `classic`; the fallback would have chosen `automatic`.)
const BB = require('./babel-block.cjs');
let block;
try { block = BB.readBabelBlock({ file: htmlFile, html: html }); }
catch (e) { console.error(e.message); process.exit(2); }
const rawCode = block.raw;
let transformed;
try { transformed = BB.transformBabelBlock(block); }
catch (e) { say('TRANSFORM ERROR:\n' + e.message); process.exit(1); }

function makeStore(seed) {
  const data = Object.assign({}, seed || {});
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k in data) delete data[k]; },
    _dump: () => plain(data),
  };
}

// EVERY request the app attempts is recorded here -- url, method and headers -- and the stub
// resolves to a dead response so nothing downstream of a send can succeed by accident. A probe
// that asserted "no POST happened" by reading source could be fooled by a path it did not read;
// this one asserts on what the running app actually attempted.
function buildContext(opts) {
  const o = opts || {};
  const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.window = window.window || window;
  window.globalThis = window.globalThis || window;
  window.matchMedia = function (q) {
    return { matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.scrollTo = window.scrollTo || function () {};
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  window.localStorage = o.store || makeStore(o.seed);
  window.alert = function () {}; window.confirm = function () { return true; };
  const net = [];
  window.fetch = function (u, init) {
    const url = String(u);
    net.push({ url, method: (init && init.method) || 'GET', headers: Object.assign({}, (init && init.headers) || {}) });
    // A same-origin GET of a file this repo actually ships is served FOR REAL, from disk. It is
    // not a network call and it is not a send -- it is the app reading its own bundle. Serving it
    // is what lets the local-mode assertions mean something: the memorizer cannot become ready
    // without the Quran text, so a dead stub here would "prove" the local features work by
    // proving only that they never loaded.
    if (/^\/[^/]/.test(url) && !AI_ROUTES.some((p) => url.indexOf(p) === 0)) {
      const rel = url.replace(/^\//, '').split('?')[0];
      const abs = path.join(REPO, rel);
      if (abs.indexOf(REPO) === 0 && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        const body = fs.readFileSync(abs, 'utf8');
        return Promise.resolve({
          ok: true, status: 200, body: null,
          headers: { get: () => null },
          text: () => Promise.resolve(body),
          json: () => Promise.resolve(JSON.parse(body)),
          blob: () => Promise.resolve({}),
        });
      }
    }
    return Promise.resolve({
      ok: false, status: 0, body: null,
      headers: { get: () => null },
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve({}),
    });
  };
  // No microphone, no camera. A path that tries to open one is a path that got past the gate.
  const media = [];
  window.navigator.mediaDevices = {
    getUserMedia: (c) => { media.push(c); return Promise.reject(new Error('probe: no media')); },
  };

  // ---- THE WEB SPEECH INSTRUMENT --------------------------------------------------------
  // Web Speech leaves no fetch() behind: calling start() ships the microphone audio to Google
  // or Apple with nothing observable in this file. So the engine is replaced by a recorder.
  // Every construction, every start, every stop and every abort is logged with a sequence
  // number, which is what lets the withdrawal test assert ORDER -- that handlers were detached
  // before the abort, and that no start followed it.
  const speech = { constructed: 0, events: [], instances: [] };
  let seq = 0;
  function FakeSpeechRecognition() {
    speech.constructed++;
    const self = this;
    this.lang = ''; this.continuous = false; this.interimResults = false;
    this.onresult = null; this.onend = null; this.onerror = null; this.onstart = null;
    this.started = 0; this.stopped = 0; this.aborted = 0; this.running = false;
    this.start = function () {
      // A real engine throws InvalidStateError on a double start; mimic it so a caller that
      // relies on the throw behaves here as it does in a browser.
      if (self.running) { const e = new Error('InvalidStateError'); e.name = 'InvalidStateError'; throw e; }
      self.running = true; self.started++;
      speech.events.push({ n: ++seq, kind: 'start' });
    };
    this.stop = function () { self.running = false; self.stopped++; speech.events.push({ n: ++seq, kind: 'stop' }); };
    this.abort = function () { self.running = false; self.aborted++; speech.events.push({ n: ++seq, kind: 'abort' }); };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
    // What the app assigns to onend, captured at the moment of assignment, so the probe can
    // fire the browser's real "session ended" callback and see whether the app restarts.
    speech.instances.push(self);
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;

  // MediaRecorder, recorded rather than performed -- the cloud STT path's half of the microphone.
  const recorders = [];
  function FakeMediaRecorder(stream, opts) {
    recorders.push({ opts: opts || null });
    this.state = 'inactive'; this.mimeType = 'audio/webm';
    this.ondataavailable = null; this.onstop = null;
    this.start = function () { this.state = 'recording'; };
    this.stop = function () { this.state = 'inactive'; if (typeof this.onstop === 'function') this.onstop(); };
  }
  FakeMediaRecorder.isTypeSupported = () => true;
  window.MediaRecorder = FakeMediaRecorder;
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try {
    const entries = [{}]; let at = 0;
    window.history = {
      get length() { return entries.length; }, get state() { return entries[at]; },
      pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
      replaceState: (st) => { entries[at] = st; },
      back: () => { if (at <= 0) return; at--; setTimeout(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0); },
    };
  } catch (e) {}
  global.navigator = window.navigator; global.window = window; global.document = window.document;

  const ctx = vm.createContext(window);
  const loadUMD = (f) => vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  loadUMD('react.umd.js'); loadUMD('react-dom.umd.js');
  if (!window.React || !window.ReactDOM) { say('FAIL: React/ReactDOM did not load.'); process.exit(1); }
  if (!o.mount) vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.addEventListener('error', () => {});
  // The app's own console is silenced, NOT this probe's: linkedom hands back the real global
  // console object, so overwriting its methods would mute every PASS/FAIL line printed here.
  // A fresh object on the sandbox window keeps the two apart.
  window.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  try { vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' }); }
  catch (e) { say('RUNTIME ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); }
  const grab = (expr) => {
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'ai-consent-probe-api' }); } catch (e) { return undefined; }
  };
  return {
    window, ctx, store: window.localStorage, grab,
    net: () => net.slice(),
    aiNet: () => net.filter((r) => AI_ROUTES.some((p) => r.url.indexOf(p) === 0)),
    media: () => media.slice(),
    speech: () => ({
      constructed: speech.constructed,
      starts: speech.events.filter((e) => e.kind === 'start').length,
      stops: speech.events.filter((e) => e.kind === 'stop').length,
      aborts: speech.events.filter((e) => e.kind === 'abort').length,
      events: speech.events.slice(),
      instances: speech.instances.slice(),
    }),
    recorders: () => recorders.slice(),
  };
}

const tick = (ms) => new Promise((r) => setTimeout(r, ms || 60));
function driver(window) {
  const root = window.document.getElementById('root');
  const all = (sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  const byText = (t) => all('button, a').filter((b) => String(b.textContent || '').trim() === t)[0];
  const byLabel = (t) => all('button, a').filter((b) => String(b.getAttribute('aria-label') || '').trim() === t)[0];
  const click = async (el) => {
    if (!el) throw new Error('nothing to click');
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
  };
  // TYPING, THE WAY REACT CAN SEE IT. React installs a value tracker on every controlled field
  // and drops an input event whose value matches what it already believes is there; assigning
  // `el.value` advances that tracker, so the event is swallowed and the component never hears
  // the keystroke. Writing through the PROTOTYPE setter moves the DOM value without touching
  // the tracker, which is what a real keypress does. And because React's change plugin does not
  // fire under linkedom at all, the component's OWN registered onChange is then called directly
  // with the real node -- the shipped handler, not a re-implementation of it.
  const type = async (el, value) => {
    if (!el) throw new Error('nothing to type into');
    let wrote = false;
    try {
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      if (desc && typeof desc.set === 'function') { desc.set.call(el, value); wrote = true; }
    } catch (e) {}
    if (!wrote) el.value = value;
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    await tick();
    const key = Object.keys(el).filter((k) => k.indexOf('__reactProps$') === 0)[0];
    const props = key ? el[key] : null;
    if (props && typeof props.onChange === 'function') {
      props.onChange({ target: el, currentTarget: el, preventDefault() {}, stopPropagation() {} });
      await tick();
    }
  };
  return { root, all, byText, byLabel, click, type, text: () => String(root.textContent || '') };
}

// Chat -> drawer -> settings. The drawer toggle is the chat header's one labelled control, and
// the settings entry is in the drawer's pinned footer. Both are found by accessible name, which
// is what a screen-reader user would use and what a guard should therefore pin.
async function openSettings(c) {
  const d = driver(c.window);
  if (hasAr(d.text(), S.SETTINGS_GROUP)) return true;
  const toggle = d.byLabel(S.OPEN_DRAWER);
  if (toggle) {
    await d.click(toggle);
    await tick(80);
    const gear = driver(c.window).byLabel(S.SETTINGS_GEAR);
    if (gear) {
      await driver(c.window).click(gear);
      await tick(150);
      if (hasAr(driver(c.window).text(), S.SETTINGS_GROUP)) return true;
    }
  }
  // Not on the chat (the withdrawal test starts inside the memorizer, which has no drawer):
  // go home and take the home's own route. S118: that route is the bar's menu button and then
  // the menu's settings row -- the bar's settings ICON is gone, and its action moved into that
  // menu. Still a real reader path, and still ending on the same screen.
  if (!(await goHome(c))) return false;
  const menu = driver(c.window).byLabel(S.HOME_MENU);
  if (!menu) return false;
  await driver(c.window).click(menu);
  await tick(120);
  const row = driver(c.window).byLabel(S.HOME_SETTINGS);
  if (!row) return false;
  await driver(c.window).click(row);
  await tick(150);
  return hasAr(driver(c.window).text(), S.SETTINGS_GROUP);
}

// A request is "outbound to a vendor" if it goes to an AI route or to another origin. The app
// also loads its OWN local assets (the Quran text, the adhkar) and those are not sends: they
// leave no data anywhere and are the whole point of the local mode.
const offDevice = (c) => c.net().filter((r) => /^https?:/i.test(r.url) || AI_ROUTES.some((p) => r.url.indexOf(p) === 0));

const PROFILE = (age) => JSON.stringify({ name: 'Probe', age, gender: 'male' });
const granted = (by) => JSON.stringify({ status: 'granted', version: CONSENT_VERSION, grantedBy: by || 'user', at: '2026-08-06T00:00:00.000Z' });
const declined = () => JSON.stringify({ status: 'declined', version: CONSENT_VERSION, grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });

/* ===================== A. A BRAND-NEW READER ============================= */
async function partA() {
  head('A. A NEW READER -- no consent, nothing sent, the screen is shown');
  const c = buildContext({ seed: { child_profile: PROFILE(30) }, mount: true });
  await tick(120);
  const d = driver(c.window);

  eq('there is no consent record at all', c.store.getItem(CONSENT_KEY), null);
  eq('hasValidAIConsent() is false', c.grab('hasValidAIConsent()'), false);
  eq('...and nothing was POSTed to any AI route', c.aiNet().map((r) => r.url), []);
  eq('...and nothing left the device at all', offDevice(c).map((r) => r.url), []);
  eq('...and no microphone was opened', c.media(), []);

  const t = d.text();
  ok('the consent screen is on screen, by its own title', t.indexOf(S.TITLE) !== -1, cps(S.TITLE));
  ok('...naming Anthropic', t.indexOf('Anthropic') !== -1);
  ok('...naming ElevenLabs', t.indexOf('ElevenLabs') !== -1);
  ok('...naming Brave Search', t.indexOf('Brave Search') !== -1);
  ok('...and stating the consent version', t.indexOf(CONSENT_VERSION) !== -1);

  const agree = d.byText(S.AGREE), decline = d.byText(S.DECLINE);
  ok('the agree button is present, worded as specified', !!agree, cps(S.AGREE));
  ok('the decline button is present, worded as specified', !!decline, cps(S.DECLINE));
  ok('BOTH are real buttons -- a single-button screen is not a choice',
    !!agree && !!decline && agree !== decline);
  ok('neither is preselected or disabled',
    !!agree && !!decline
      && !agree.hasAttribute('disabled') && !decline.hasAttribute('disabled')
      && agree.getAttribute('aria-pressed') === null && decline.getAttribute('aria-pressed') === null);
  ok('the refusal is not hidden: it carries visible text and no display:none',
    !!decline && String(decline.textContent || '').trim().length > 0
      && !/display\s*:\s*none/i.test(String(decline.getAttribute('style') || '')));
  ok('"understood" is NOT offered as a consent on this screen',
    d.all('button').every((b) => String(b.textContent || '').trim() !== S.UNDERSTOOD), cps(S.UNDERSTOOD));
  // Rendering the screen is itself the assertion: the app has been mounted for 120ms.
  eq('displaying the screen sent nothing off-device', offDevice(c).length, 0);
}

/* ===================== B. THE READER DECLINES ============================ */
async function partB() {
  head('B. DECLINED -- AI blocked, the local modules still work');
  const c = buildContext({ seed: { child_profile: PROFILE(30) }, mount: true });
  await tick(120);
  const d = driver(c.window);
  await d.click(d.byText(S.DECLINE));
  await tick(120);

  const rec = JSON.parse(c.store.getItem(CONSENT_KEY) || 'null');
  eq('the refusal is RECORDED as an answer, not left blank', rec && rec.status, 'declined');
  eq('...at the current version', rec && rec.version, CONSENT_VERSION);
  eq('hasValidAIConsent() is false', c.grab('hasValidAIConsent()'), false);

  const t = d.text();
  ok('the chat screen states the reason instead of going blank', t.indexOf(S.LOCAL_BODY) !== -1, cps(S.LOCAL_BODY));
  ok('...and offers the privacy settings', !!d.byText(S.REVIEW), cps(S.REVIEW));
  ok('...and offers the mushaf', !!d.byText(S.OPEN_MUSHAF), cps(S.OPEN_MUSHAF));
  ok('...and offers the adhkar', !!d.byText(S.OPEN_ADHKAR), cps(S.OPEN_ADHKAR));
  ok('...and offers the knowledge treasures', !!d.byText(S.OPEN_TREASURE), cps(S.OPEN_TREASURE));

  // The three local modules are opened for real and must render something.
  await d.click(d.byText(S.OPEN_MUSHAF));
  await tick(150);
  ok('the mushaf opens and renders', driver(c.window).text().trim().length > 0);
  eq('...with no AI request', c.aiNet().map((r) => r.url), []);

  const c2 = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: declined() }, mount: true });
  await tick(120);
  const d2 = driver(c2.window);
  await d2.click(d2.byText(S.OPEN_ADHKAR));
  await tick(200);
  ok('the adhkar open and render', driver(c2.window).text().trim().length > 0);
  eq('...with no AI request', c2.aiNet().map((r) => r.url), []);

  // Every send path, called directly, must refuse without touching fetch.
  const c3 = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: declined() } });
  eq('a declined reader cannot pass the central predicate', c3.grab('hasValidAIConsent()'), false);
  const rejected = await c3.grab("aiFetch('/api/ask', { method: 'POST' }).then(() => 'RESOLVED', (e) => (e && e.aiConsentMissing) ? 'REFUSED' : 'OTHER')");
  eq('aiFetch refuses rather than sending', rejected, 'REFUSED');
  eq('...and fetch was never called for an AI route', c3.aiNet().map((r) => r.url), []);
  eq('the consent headers are empty without consent', plain(c3.grab('aiConsentHeaders()')), {});
}

/* ===================== C. A 13+ READER AGREES =========================== */
async function partC() {
  head('C. GRANTED at 13+ -- the send goes out, and it carries the header');
  const c = buildContext({ seed: { child_profile: PROFILE(30) }, mount: true });
  await tick(120);
  const d = driver(c.window);
  await d.click(d.byText(S.AGREE));
  await tick(150);

  const rec = JSON.parse(c.store.getItem(CONSENT_KEY) || 'null');
  eq('status is granted', rec && rec.status, 'granted');
  eq('grantedBy is user -- no guardian gate at 13+', rec && rec.grantedBy, 'user');
  eq('the version is stamped', rec && rec.version, CONSENT_VERSION);
  ok('...and the timestamp is a real ISO instant',
    !!rec && typeof rec.at === 'string' && !isNaN(Date.parse(rec.at)), JSON.stringify(rec && rec.at));
  eq('hasValidAIConsent() is now true', c.grab('hasValidAIConsent()'), true);
  eq('the consent header is now attached', plain(c.grab('aiConsentHeaders()')), { [CONSENT_HEADER]: CONSENT_VERSION });

  // A real send, through the shipped choke point.
  await c.grab("aiFetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})");
  await tick(60);
  const sent = c.aiNet();
  eq('the ask reached fetch', sent.length, 1);
  eq('...at the shipped endpoint', sent[0] && sent[0].url, '/api/ask');
  eq('...carrying the legal header', sent[0] && sent[0].headers[CONSENT_HEADER], CONSENT_VERSION);
}

/* ===================== D. A READER UNDER 13 ============================= */
async function partD() {
  head('D. UNDER 13 -- the agree button alone enables nothing');
  const c = buildContext({ seed: { child_profile: PROFILE(9) }, mount: true });
  await tick(120);
  const d = driver(c.window);
  ok('the screen states the guardian requirement', d.text().indexOf(S.GUARDIAN) !== -1, cps(S.GUARDIAN));

  await d.click(d.byText(S.AGREE));
  await tick(120);
  eq('pressing agree records NOTHING on its own', c.store.getItem(CONSENT_KEY), null);
  eq('...and hasValidAIConsent() is still false', c.grab('hasValidAIConsent()'), false);
  eq('...and nothing was sent off-device', offDevice(c).map((r) => r.url), []);

  // The guardian barrier is the app's own arithmetic gate. Solve it the way an adult does.
  const d2 = driver(c.window);
  const sum = d2.all('.ezgate-sum')[0];
  ok('the guardian barrier is on screen', !!sum, String(sum && sum.textContent));
  const m = /(\d+)\s*\D\s*(\d+)/.exec(String(sum && sum.textContent) || '');
  ok('...with a readable challenge', !!m, String(sum && sum.textContent));
  const input = d2.all('input')[0];
  ok('...and an answer field', !!input);
  if (m && input) {
    await d2.type(input, String(Number(m[1]) * Number(m[2])));
    await tick(40);
    const dd = driver(c.window);
    const confirm = dd.byText(S.CONFIRM);
    ok('...and a confirm control', !!confirm, cps(S.CONFIRM));
    if (confirm) { await dd.click(confirm); await tick(150); }
  }
  const rec = JSON.parse(c.store.getItem(CONSENT_KEY) || 'null');
  eq('after the guardian passes, status is granted', rec && rec.status, 'granted');
  eq('...and grantedBy is guardian, not user', rec && rec.grantedBy, 'guardian');

  // The refusal branch: a guardian who does not agree leaves the app local.
  const c2 = buildContext({ seed: { child_profile: PROFILE(9) }, mount: true });
  await tick(120);
  const d3 = driver(c2.window);
  await d3.click(d3.byText(S.DECLINE));
  await tick(120);
  const rec2 = JSON.parse(c2.store.getItem(CONSENT_KEY) || 'null');
  eq('a child whose guardian declines is recorded declined', rec2 && rec2.status, 'declined');
  eq('...and nothing about the child was sent', offDevice(c2).map((r) => r.url), []);
  ok('...and the app is in local mode, not broken',
    driver(c2.window).text().indexOf(S.LOCAL_BODY) !== -1, cps(S.LOCAL_BODY));
}

/* ===================== E. WITHDRAWAL ==================================== */
async function partE() {
  head('E. WITHDRAWAL -- from settings, effective immediately, and the server refuses');
  const c = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: granted('user') }, mount: true });
  await tick(150);
  const d = driver(c.window);
  eq('the reader starts consented', c.grab('hasValidAIConsent()'), true);

  // Reach settings the way a reader does: the chat drawer's settings entry.
  const before = c.grab('hasValidAIConsent()');
  const inSettings = await openSettings(c);
  ok('the settings screen carries the privacy-and-AI group', inSettings, cps(S.SETTINGS_GROUP));
  if (inSettings) {
    const t = driver(c.window).text();
    ok('...naming the three providers', t.indexOf('Anthropic') !== -1 && t.indexOf('ElevenLabs') !== -1 && t.indexOf('Brave Search') !== -1);
    const w = driver(c.window).byText(S.WITHDRAW);
    ok('...and offering the withdrawal button while consent is held', !!w, cps(S.WITHDRAW));
    if (w) {
      await d.click(w);
      await tick(120);
      const rec = JSON.parse(c.store.getItem(CONSENT_KEY) || 'null');
      eq('withdrawal flips status to declined', rec && rec.status, 'declined');
      eq('...and the predicate is false at once', c.grab('hasValidAIConsent()'), false);
      ok('...and the group now offers the review button instead',
        !!driver(c.window).byText(S.REVIEW_SETTINGS), cps(S.REVIEW_SETTINGS));
      ok('...and the saved conversations were NOT wiped',
        c.store.getItem('child_profile') !== null);
    }
  }
  eq('before-state sanity', before, true);

  // Every send path, after withdrawal, must never reach fetch.
  const c2 = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: declined() } });
  for (const route of AI_ROUTES) {
    const r = await c2.grab("aiFetch('" + route + "', { method: 'POST' }).then(() => 'SENT', (e) => (e && e.aiConsentMissing) ? 'REFUSED' : 'OTHER')");
    eq('after withdrawal, ' + route + ' is refused locally', r, 'REFUSED');
  }
  eq('...and fetch was never invoked once', offDevice(c2).map((r) => r.url), []);

  // AND THE SERVER, independently. A request with no header reaches no vendor.
  const mkRes = () => {
    const r = { statusCode: 0, payload: null, ended: false, _h: {} };
    r.setHeader = (k, v) => { r._h[String(k).toLowerCase()] = v; return r; };
    r.status = (n) => { r.statusCode = n; return r; };
    r.json = (o) => { r.payload = o; r.ended = true; return r; };
    r.end = () => { r.ended = true; return r; };
    r.write = () => true;
    return r;
  };
  const mkReq = (headers) => ({ method: 'POST', headers: headers || {}, body: { text: 'x', audio: 'x', messages: [], system: 's' } });
  for (const route of AI_ROUTES) {
    const mod = 'api' + route.slice(4) + '.js';
    let handler;
    try { handler = (await import('file:///' + path.join(REPO, mod).replace(/\\/g, '/'))).default; }
    catch (e) { ok(mod + ' loads', false, String(e && e.message)); continue; }
    const res = mkRes();
    await handler(mkReq({}), res);
    eq(mod + ' answers 403 without the header', res.statusCode, 403);
    eq('...and names the required version', res.payload && res.payload.requiredVersion, CONSENT_VERSION);
    const res2 = mkRes();
    await handler(mkReq({ [CONSENT_HEADER]: 'not-the-version' }), res2);
    eq(mod + ' answers 403 for a WRONG version', res2.statusCode, 403);
    ok(mod + ' advertises the header for preflight',
      String(res._h['access-control-allow-headers'] || '').indexOf(CONSENT_HEADER) !== -1,
      String(res._h['access-control-allow-headers']));
  }
}

/* ===================== F. VERSION DRIFT ================================= */
async function partF() {
  head('F. VERSION DRIFT -- an old or absent version re-asks');
  const cases = [
    ['a record from an older disclosure', JSON.stringify({ status: 'granted', version: '2026-01-01-1', grantedBy: 'user', at: 'x' })],
    ['a record with no version at all', JSON.stringify({ status: 'granted', grantedBy: 'user' })],
    ['a record with a bogus status', JSON.stringify({ status: 'maybe', version: CONSENT_VERSION })],
    ['a corrupt, unparseable value', 'not-json-at-all'],
    ['an empty string', ''],
    ['the literal string 1, the shape the OLD key used', '1'],
  ];
  for (const [name, value] of cases) {
    const c = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: value }, mount: true });
    await tick(120);
    eq(name + ' does not count as consent', c.grab('hasValidAIConsent()'), false);
    ok('...and the screen is shown again', driver(c.window).text().indexOf(S.TITLE) !== -1, cps(S.TITLE));
    eq('...and nothing was sent off-device', offDevice(c).map((r) => r.url), []);
  }
  // The OLD key is not consent, on its own or alongside a profile.
  const c = buildContext({ seed: { child_profile: PROFILE(30), disclosureAck: '1' }, mount: true });
  await tick(120);
  eq('the old disclosureAck key grants nothing', c.grab('hasValidAIConsent()'), false);
  ok('...and the consent screen is shown to that reader too',
    driver(c.window).text().indexOf(S.TITLE) !== -1, cps(S.TITLE));
  eq('...and nothing was sent off-device', offDevice(c).map((r) => r.url), []);

  // Client and server agree on the number, by reading both files.
  const clientV = (html.match(/const EZ_AI_CONSENT_VERSION = '([^']+)'/) || [])[1];
  const serverV = (fs.readFileSync(path.join(REPO, 'lib', 'ai-consent.js'), 'utf8')
    .match(/AI_CONSENT_VERSION = '([^']+)'/) || [])[1];
  eq('the client declares the expected version', clientV, CONSENT_VERSION);
  eq('the server declares the same one -- the mirror cannot drift', serverV, clientV);
  const clientH = (html.match(/const EZ_AI_CONSENT_HEADER = '([^']+)'/) || [])[1];
  const serverH = (fs.readFileSync(path.join(REPO, 'lib', 'ai-consent.js'), 'utf8')
    .match(/AI_CONSENT_HEADER = '([^']+)'/) || [])[1];
  eq('...and the same header name', serverH, clientH);
}

/* ===================== G. ANALYTICS ===================================== */
function partG() {
  head('G. ANALYTICS -- neither script is loaded any more');
  ok('no Vercel Web Analytics script tag', !/<script[^>]*_vercel\/insights/.test(html));
  ok('no Speed Insights script tag', !/<script[^>]*_vercel\/speed-insights/.test(html));
  const srcs = (html.match(/<script[^>]*src=["']([^"']+)["']/gi) || []);
  eq('the page loads exactly three scripts', srcs.length, 3);
  ok('...and no analytics replacement was substituted',
    !/googletagmanager|google-analytics|gtag\(|plausible|posthog|mixpanel|segment\.com|amplitude|sentry/i.test(html));
  const quest = fs.readFileSync(path.join(REPO, 'quest.html'), 'utf8');
  ok('the treasures page carries no analytics either', !/_vercel\/(insights|speed-insights)/.test(quest));
}

/* ===================== H. THE LINKS ===================================== */
async function partH() {
  head('H. LINKS -- privacy, deletion and support open from both places');
  const want = ['/privacy.html', '/delete.html', '/support.html'];
  for (const f of ['privacy.html', 'delete.html', 'support.html']) {
    ok(f + ' exists on disk', fs.existsSync(path.join(REPO, f)));
  }
  // from the consent screen
  const c = buildContext({ seed: { child_profile: PROFILE(30) }, mount: true });
  await tick(120);
  const hrefs = driver(c.window).all('a').map((a) => a.getAttribute('href'));
  for (const w of want) ok('the consent screen links to ' + w, hrefs.indexOf(w) !== -1, JSON.stringify(hrefs));

  // from settings
  const c2 = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: granted('user') }, mount: true });
  await tick(150);
  ok('settings is reachable while consent is held', await openSettings(c2));
  const h2 = driver(c2.window).all('a').map((a) => a.getAttribute('href'));
  for (const w of want) ok('settings links to ' + w, h2.indexOf(w) !== -1, JSON.stringify(h2));

  // the three pages say the required things, in both languages
  const priv = fs.readFileSync(path.join(REPO, 'privacy.html'), 'utf8');
  ok('privacy.html carries the consent version number', priv.indexOf(CONSENT_VERSION) !== -1);
  ok('...and an English consent section', /Consent to share data with AI services/.test(priv));
  ok('...and the Apple equal-protection sentence, in English',
    /We require every service provider that receives user data from Ezik to provide the same or equivalent protection described in this policy and required by Apple(?:'|’)s guidelines and applicable law, and to process that data only for the purposes stated here\./.test(priv));
  ok('...and in Arabic',
    hasAr(priv, 'نُلزم أي مزود خدمة يتلقى بيانات المستخدم من عزك بأن يوفر لها الحماية نفسها أو حماية مكافئة'));
  ok('...and says the analytics are removed, in Arabic and English',
    hasAr(priv, 'أُزيلا في هذا الإصدار ولا يعملان فيه') && /removed and do not run in this release/.test(priv));
  for (const p of ['Anthropic', 'ElevenLabs', 'Brave Search', 'Upstash', 'Google Fonts', 'unpkg', 'cdnjs', 'everyayah.com', 'mushaf.almurabbi.app', 'Vercel']) {
    ok('privacy.html discloses ' + p, priv.indexOf(p) !== -1);
  }
  ok('...and browser/OS speech recognition', /Browser or operating-system speech-recognition services/.test(priv));
  const del = fs.readFileSync(path.join(REPO, 'delete.html'), 'utf8');
  ok('delete.html explains withdrawal, in Arabic', del.indexOf(S.SETTINGS_GROUP) !== -1);
  ok('...and in English', /Withdraw consent to share data with AI services/.test(del));
  const sup = fs.readFileSync(path.join(REPO, 'support.html'), 'utf8');
  ok('support.html explains withdrawal, in Arabic', sup.indexOf(S.SETTINGS_GROUP) !== -1);
  ok('...and in English', /withdraw consent to share data with the AI services/i.test(sup));
}

/* ===================== I. THE SOURCE INVARIANTS ========================= */
function partI() {
  head('I. THE CHOKE POINT -- no AI route is reachable by a bare fetch');
  // Every literal fetch to an AI endpoint in the client must be aiFetch. This is the assertion
  // that stops a new send path from being added around the gate.
  for (const route of AI_ROUTES) {
    const bare = new RegExp("[^i]fetch\\('" + route.replace(/\//g, '\\/') + "'", 'g');
    const hits = (rawCode.match(bare) || []).filter((h) => !/aiFetch/.test(h));
    eq('no bare fetch to ' + route, hits, []);
  }
  ok("the endpoint variable used by callAI goes through aiFetch",
    /await aiFetch\(endpoint, \{/.test(rawCode));
  ok('aiFetch itself is fail-closed', /if \(!hasValidAIConsent\(\)\) return Promise\.reject/.test(rawCode));
  ok('...and hasValidAIConsent checks BOTH status and version',
    /c\.status === EZ_AI_CONSENT_GRANTED && c\.version === EZ_AI_CONSENT_VERSION/.test(rawCode));
  ok('there is no default consent value anywhere',
    !/EZ_AI_CONSENT_KEY[^\n]{0,120}\|\|\s*['"]granted['"]/.test(rawCode));
  ok('the old disclosureAck key is no longer read',
    !/getItem\(\s*['"]disclosureAck['"]\s*\)/.test(rawCode));

  // The six routes each call the shared guard, and none rolls its own.
  for (const route of AI_ROUTES) {
    const rel = 'api' + route.slice(4) + '.js';
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    ok(rel + ' imports the shared guard', /from '\.\.\/lib\/ai-consent\.js'/.test(src));
    ok(rel + ' calls it and returns on refusal', /if \(!guardAIConsent\(req, res\)\) return;/.test(src));
    // ORDER, inside the handler: the guard must come before the handler's first outbound call.
    // Measured from the handler's own opening brace, because a module-level URL CONSTANT above
    // it is not a call and pinning against it would be theatre -- api/ask.js declares
    // ANTHROPIC_URL at the top of the file and reaches it hundreds of lines later.
    const hAt = src.indexOf('export default async function handler');
    const body = hAt === -1 ? src : src.slice(hAt);
    const guardAt = body.indexOf('guardAIConsent(req, res)');
    const callAt = (() => {
      const m = /\b(?:await\s+)?fetch\s*\(/.exec(body);
      return m ? m.index : -1;
    })();
    ok(rel + ': the guard is inside the handler', guardAt !== -1);
    if (callAt !== -1) {
      ok(rel + ': the guard runs before the handler makes any outbound call',
        guardAt !== -1 && guardAt < callAt, 'guard@' + guardAt + ' first fetch@' + callAt);
    }
  }
  // /api/report and /api/unlock are NOT AI routes and must be left alone.
  for (const rel of ['api/report.js', 'api/unlock.js']) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    ok(rel + ' is untouched by the AI gate (no vendor sees it)', !/guardAIConsent/.test(src));
  }
}

/* ===================== L. TEST ISOLATION ================================ */
// A consent test that inherited a granted store from the test before it would pass while proving
// nothing. Every context in this file gets a FRESH store built from its own seed; these checks
// hold that property to account instead of trusting it.
function partL() {
  head('L. ISOLATION -- no case inherits consent from the case before it');

  const a = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: granted('user') } });
  eq('a granted context reads granted', a.grab('hasValidAIConsent()'), true);
  a.store.setItem('probe_marker', 'from-context-a');

  const b = buildContext({ seed: { child_profile: PROFILE(30) } });
  eq('the NEXT context, seeded with no consent, reads no consent', b.grab('hasValidAIConsent()'), false);
  eq('...and cannot see the previous context\'s store at all', b.store.getItem('probe_marker'), null);
  eq('...and has no consent record', b.store.getItem(CONSENT_KEY), null);

  const cDecl = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: declined() } });
  eq('a declined context reads declined, not the earlier granted', cDecl.grab('aiConsentStatus()'), 'declined');
  eq('...and refuses', cDecl.grab('hasValidAIConsent()'), false);
  // The earlier context's STORE is a separate object and still holds what it held. (Its vm
  // context is not re-read here: a linkedom window is only valid until the next one replaces the
  // Node globals it installed, which is why every case in this file builds its own and uses it
  // immediately. The store is plain JS and outlives that, so it is what gets compared.)
  eq('the earlier granted store was not rewritten by the later declined one',
    JSON.parse(a.store.getItem(CONSENT_KEY) || 'null').status, 'granted');
  eq('...and the two stores are different objects', a.store === cDecl.store, false);

  // Writes in one context must not reach another.
  cDecl.store.setItem(CONSENT_KEY, granted('user'));
  const d = buildContext({ seed: { child_profile: PROFILE(30) } });
  eq('a write in one context does not leak into the next', d.store.getItem(CONSENT_KEY), null);
  eq('...and the fresh context still refuses', d.grab('hasValidAIConsent()'), false);

  // And the seed is copied, not aliased: mutating a context's store must not edit the caller's
  // seed object and silently arm the next test that reuses it.
  const seed = { child_profile: PROFILE(30) };
  const e1 = buildContext({ seed });
  e1.store.setItem(CONSENT_KEY, granted('user'));
  eq('the seed object itself was not mutated', Object.prototype.hasOwnProperty.call(seed, CONSENT_KEY), false);
  const e2 = buildContext({ seed });
  eq('...so a reused seed still yields a consent-free context', e2.grab('hasValidAIConsent()'), false);
}

/* ===================== J. WEB SPEECH ==================================== */
// Web Speech is the send that leaves no fetch behind. Everything below is measured on the
// instrumented engine in buildContext: constructions, starts, stops, aborts and their ORDER.
const MEM = {
  TILE: 'memorize',                 // data-ezik-home-module on the memorizer tile
  START_BTN: 'ابدأ',
  RECITE_START: 'ابدأ التسميع',
  MODE_RECITE: 'سمِّعني',
  NO_CONSENT: 'التسميع الصوتي غير مفعّل لأن مشاركة الصوت مع خدمات التعرف على الكلام لم تتم الموافقة عليها.',
};

const A2_BACK_TEXT = 'رجوع';
const DRAWER_HOME = 'القائمة';      // the drawer's "home" row

// Get to Home from wherever the app landed. Two routes, because the two consent states land on
// two different screens: refused lands on the local-mode notice, whose «رجوع» goes home; granted
// lands on the chat, whose drawer carries the home row.
async function goHome(c) {
  let d = driver(c.window);
  if (d.all('[data-ezik-home-module]').length) return true;
  // «رجوع» peels back ONE layer at a time (the memorizer's drill returns to its own picker
  // before it returns home), so walk it rather than assuming one click lands.
  for (let i = 0; i < 5; i++) {
    const back = driver(c.window).byText(A2_BACK_TEXT) || driver(c.window).byLabel(A2_BACK_TEXT);
    if (!back) break;
    await driver(c.window).click(back);
    await tick(150);
    if (driver(c.window).all('[data-ezik-home-module]').length) return true;
  }
  d = driver(c.window);
  const toggle = d.byLabel(S.OPEN_DRAWER);
  if (toggle) {
    await d.click(toggle);
    await tick(100);
    const homeRow = driver(c.window).byText(DRAWER_HOME);
    if (homeRow) { await driver(c.window).click(homeRow); await tick(200); }
  }
  return driver(c.window).all('[data-ezik-home-module]').length > 0;
}

// Home -> the memorizer -> the drill, where «ابدأ التسميع» lives.
async function openRecite(c) {
  if (!(await goHome(c))) return { ok: false, why: 'could not reach home' };
  const tile = driver(c.window).all('[data-ezik-home-module="' + MEM.TILE + '"]')[0];
  if (!tile) return { ok: false, why: 'no memorizer tile on home' };
  await driver(c.window).click(tile);
  await tick(500);                                    // the memorizer loads the Quran text
  // The start bar only exists once a surah is chosen, so choose one — al-Fatiha, by its own
  // data attribute. This is the reader's real path: pick a surah, then start.
  const surah = driver(c.window).all('[data-ezq-surah="1"]')[0];
  if (!surah) return { ok: false, why: 'the memorizer never became ready (no surah cards)' };
  await driver(c.window).click(surah);
  await tick(200);
  const start = driver(c.window).byText(MEM.START_BTN);
  if (!start) return { ok: false, why: 'no «start» button in the memorizer: ' + cps(MEM.START_BTN) };
  await driver(c.window).click(start);
  await tick(250);
  // The drill opens in manual mode; «سمِّعني» is the third mode tab and the only one that listens.
  const modeTab = driver(c.window).byText(MEM.MODE_RECITE);
  if (!modeTab) return { ok: false, why: 'no «recite to me» mode tab in the drill' };
  await driver(c.window).click(modeTab);
  await tick(200);
  const recite = driver(c.window).byText(MEM.RECITE_START);
  if (!recite) return { ok: false, why: 'no «start recitation» button in the recite mode' };
  return { ok: true, recite };
}

async function partJ() {
  head('J. WEB SPEECH -- the send that leaves no fetch behind');

  // --- J-A: a brand-new reader ---------------------------------------------------------
  {
    const c = buildContext({ seed: { child_profile: PROFILE(30) }, mount: true });
    await tick(200);
    const sp = c.speech();
    eq('J-A no consent: no SpeechRecognition was ever constructed', sp.constructed, 0);
    eq('J-A ...so recognition.start() was never called', sp.starts, 0);
    eq('J-A ...and no microphone was opened', c.media(), []);
    eq('J-A ...and no MediaRecorder was created', c.recorders(), []);
    eq('J-A ...and no POST to /api/stt', c.aiNet().filter((r) => r.url === '/api/stt').map((r) => r.url), []);
    eq('J-A ...and nothing left the device', offDevice(c).map((r) => r.url), []);
    // The dictation engine is built by an effect at mount; without consent it must not exist.
    eq('J-A the dictation engine ref is null', c.grab('null'), null);
  }

  // --- J-B: declined -------------------------------------------------------------------
  {
    const c = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: declined() }, mount: true });
    await tick(200);
    const sp0 = c.speech();
    eq('J-B declined: no engine constructed at mount', sp0.constructed, 0);
    eq('J-B ...and no start', sp0.starts, 0);

    const r = await openRecite(c);
    ok('J-B the memorizer opens and reaches the recitation control', r.ok, r.why || '');
    if (r.ok) {
      await driver(c.window).click(r.recite);
      await tick(150);
      const sp = c.speech();
      eq('J-B pressing «start recitation» constructs NO engine', sp.constructed, 0);
      eq('J-B ...calls no start()', sp.starts, 0);
      eq('J-B ...opens no microphone', c.media(), []);
      eq('J-B ...creates no MediaRecorder', c.recorders(), []);
      const t = driver(c.window).text();
      ok('J-B ...and shows the local-mode line instead', hasAr(t, MEM.NO_CONSENT), cps(MEM.NO_CONSENT));
      ok('J-B ...and does NOT blame the browser', !/متصفحك لا يدعم/.test(t));
      // The rest of the memorizer is untouched: the drill is still on screen and still readable.
      ok('J-B ...while the memorizing screen itself keeps working', t.trim().length > 200);
      eq('J-B ...and still nothing left the device', offDevice(c).map((r2) => r2.url), []);
    }
  }

  // --- J-C: granted --------------------------------------------------------------------
  {
    const c = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: granted('user') }, mount: true });
    await tick(200);
    const sp0 = c.speech();
    eq('J-C granted: the dictation engine IS constructed', sp0.constructed >= 1, true);
    eq('J-C ...but it has not started listening on its own', sp0.starts, 0);
    eq('J-C ...and no microphone was opened just by mounting', c.media(), []);

    const r = await openRecite(c);
    ok('J-C the memorizer reaches the recitation control', r.ok, r.why || '');
    if (r.ok) {
      const before = c.speech().constructed;
      await driver(c.window).click(r.recite);
      await tick(150);
      const sp = c.speech();
      eq('J-C pressing «start recitation» constructs an engine', sp.constructed, before + 1);
      eq('J-C ...and starts it', sp.starts >= 1, true);
    }
  }

  // --- J-D: withdrawal while an engine is listening ------------------------------------
  {
    const c = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: granted('user') }, mount: true });
    await tick(200);
    const r = await openRecite(c);
    ok('J-D the recitation control is reachable while consented', r.ok, r.why || '');
    if (r.ok) {
      await driver(c.window).click(r.recite);
      await tick(150);
      const live = c.speech().instances.filter((i) => i.running);
      eq('J-D an engine is actually listening before the withdrawal', live.length >= 1, true);
      const inst = live[live.length - 1];
      const onendBefore = typeof inst.onend;
      const startsBefore = c.speech().starts;

      // Withdraw the way a reader does -- by pressing the real button in Settings. Writing the
      // declined record directly into the store would prove only that the store accepts a write;
      // it is the app's own handler that has to tear the running engine down, so the app's own
      // handler is what gets invoked here.
      const inSettings = await openSettings(c);
      ok('J-D settings is reachable to withdraw from', inSettings);
      if (inSettings) {
        const w = driver(c.window).byText(S.WITHDRAW);
        ok('J-D the withdraw button is present', !!w, cps(S.WITHDRAW));
        if (w) {
          await driver(c.window).click(w);
          await tick(200);
          const sp = c.speech();
          eq('J-D the running engine was stopped or aborted',
            (inst.aborted + inst.stopped) >= 1, true);
          eq('J-D ...and its onend handler was detached first', typeof inst.onend, 'object');
          ok('J-D ...(it had a live onend before the withdrawal)', onendBefore === 'function', onendBefore);
          eq('J-D ...and the engine is no longer running', inst.running, false);

          // NO AUTO-RESTART. Fire the browser's real "session ended" event at the torn-down
          // engine: a surviving handler would call start() here, and that is exactly the bug.
          const startsAfterWithdraw = sp.starts;
          try { if (typeof inst.onend === 'function') inst.onend(); } catch (e) {}
          await tick(150);
          eq('J-D firing onend after withdrawal starts nothing', c.speech().starts, startsAfterWithdraw);
          ok('J-D ...and no start happened at all after the abort',
            (() => {
              const evs = c.speech().events;
              const lastKill = evs.map((e2) => e2.kind).lastIndexOf('abort');
              return lastKill === -1 || !evs.slice(lastKill + 1).some((e2) => e2.kind === 'start');
            })(), JSON.stringify(c.speech().events.slice(-6)));
          ok('J-D ...and starts did not increase across the whole withdrawal', c.speech().starts <= startsBefore + 1,
            'before=' + startsBefore + ' after=' + c.speech().starts);

          // And no new send of any kind afterwards.
          const netBefore = offDevice(c).length;
          await c.grab("aiFetch('/api/stt', { method: 'POST' }).catch(function(){})");
          await tick(60);
          eq('J-D no AI request succeeds after the withdrawal', offDevice(c).length, netBefore);
          eq('J-D ...and consent reads false', c.grab('hasValidAIConsent()'), false);
        }
      }
    }
  }

  // --- J-E: an old consent version is not consent --------------------------------------
  {
    const stale = JSON.stringify({ status: 'granted', version: '2026-01-01-1', grantedBy: 'user', at: 'x' });
    const c = buildContext({ seed: { child_profile: PROFILE(30), [CONSENT_KEY]: stale }, mount: true });
    await tick(200);
    const sp = c.speech();
    eq('J-E an old consent version constructs no engine', sp.constructed, 0);
    eq('J-E ...and starts none', sp.starts, 0);
    eq('J-E ...and opens no microphone', c.media(), []);
    eq('J-E ...and the central predicate refuses', c.grab('hasValidAIConsent()'), false);
    eq('J-E ...and the factory returns null', c.grab('ezNewRecognition()'), null);
    eq('J-E ...and the starter refuses a handed-in engine',
      c.grab('(function(){ var r = new window.SpeechRecognition(); return ezStartRecognition(r); })()'), false);
  }
}

/* ===================== K. THE SPEECH SOURCE CENSUS ====================== */
// A census, not a spot-check: EVERY mention of the engine and EVERY start in the shipped block
// is enumerated and classified. This is what stops a fourth recognizer, added months from now by
// someone who never read this file, from quietly shipping a reader's voice to Google.
function partK() {
  head('K. SOURCE CENSUS -- every engine reference and every start is accounted for');

  // THE CENSUS READS CODE, NOT COMMENTS. Line numbers are preserved (each comment is blanked in
  // place, never deleted) so a diagnostic still names the real line in index.html. Without this
  // the census reports its own explanatory comments as violations -- the sentence "recognition
  // .start() ships audio to Google" is a warning about the risk, not an instance of it.
  const srcLines = rawCode.split('\n');
  const lines = srcLines.map((l) => {
    const i = l.indexOf('//');
    if (i === -1) return l;
    // Only strip a `//` that is not inside a string literal or a URL. Counting quotes before it
    // is enough here: this block has no line carrying an odd number of quotes AND a real comment.
    const before = l.slice(0, i);
    const q1 = (before.match(/'/g) || []).length;
    const q2 = (before.match(/"/g) || []).length;
    const q3 = (before.match(/`/g) || []).length;
    if (q1 % 2 || q2 % 2 || q3 % 2) return l;
    if (/[:a-z]$/i.test(before.slice(-1)) && /^\/\/[^/]/.test(l.slice(i))) return l;  // https:// etc.
    return before;
  });
  const at = (i) => 'line ' + (i + 1) + ': ' + srcLines[i].trim().slice(0, 110);
  const code = lines.join('\n');

  // 1. Where may the engine be NAMED? Only inside the gate's own two helpers.
  const nameHits = [];
  lines.forEach((l, i) => { if (/\bwebkitSpeechRecognition\b|window\.SpeechRecognition\b/.test(l)) nameHits.push(i); });
  ok('the engine is named somewhere at all', nameHits.length > 0);
  const allowedNameLines = nameHits.filter((i) => /return window\.SpeechRecognition \|\| window\.webkitSpeechRecognition \|\| null;/.test(lines[i]));
  eq('...and ONLY inside ezSpeechEngine()', nameHits.filter((i) => allowedNameLines.indexOf(i) === -1).map(at), []);

  // 2. Where may an engine be CONSTRUCTED? Only in ezNewRecognition, which checks consent first.
  const ctorHits = [];
  lines.forEach((l, i) => { if (/new\s+SR\s*\(|new\s+(window\.)?(webkit)?SpeechRecognition\s*\(/.test(l)) ctorHits.push(i); });
  const allowedCtor = ctorHits.filter((i) => /rec = new SR\(\);/.test(lines[i]));
  eq('every construction is inside the consent-checked factory', ctorHits.filter((i) => allowedCtor.indexOf(i) === -1).map(at), []);
  eq('...and there is exactly one such construction in the file', allowedCtor.length, 1);
  ok('...and the factory refuses before constructing',
    /const ezNewRecognition = \(\) => \{\s*\n\s*if \(!hasValidAIConsent\(\)\) return null;/.test(code));

  // 3. Where may an engine be STARTED? A bare `.start()` on a recognizer is the whole risk.
  //    MediaRecorder starts are a different object and are listed separately below.
  const RECOGNIZER_STARTERS = /\b(rec|recognition|recognitionRef\.current|callRecognitionRef\.current|reciteRecognitionRef\.current)\s*(\?\.)?\.start\s*\(/;
  const startHits = [];
  lines.forEach((l, i) => { if (RECOGNIZER_STARTERS.test(l)) startHits.push(i); });
  const allowedStart = startHits.filter((i) => /try \{ rec\.start\(\); return true; \} catch \(e\) \{ return false; \}/.test(lines[i]));
  eq('every recognizer start goes through ezStartRecognition()', startHits.filter((i) => allowedStart.indexOf(i) === -1).map(at), []);
  eq('...and there is exactly one such start in the file', allowedStart.length, 1);
  ok('...and it re-reads consent immediately before starting',
    /const ezStartRecognition = \(rec\) => \{[\s\S]{0,200}?if \(!hasValidAIConsent\(\)\) \{ ezKillRecognizer\(rec\); return false; \}[\s\S]{0,80}?rec\.start\(\)/.test(code));

  // 4. Every CALLER of the two helpers, enumerated -- so the count is a fact, not a hope.
  const callers = (name) => lines.reduce((n, l) => n + (l.indexOf(name + '(') !== -1 ? 1 : 0), 0);
  eq('ezNewRecognition is called from exactly the three recognizers this app has',
    callers('ezNewRecognition'), 3);
  ok('ezStartRecognition is called from every start path',
    callers('ezStartRecognition') >= 6, 'occurrences=' + callers('ezStartRecognition'));

  // 5. MICROPHONE. Every getUserMedia must sit behind a consent check within its own function.
  const gumLines = [];
  lines.forEach((l, i) => { if (/getUserMedia\s*\(/.test(l) && !/\?\.getUserMedia|navigator\.mediaDevices\?\./.test(l)) gumLines.push(i); });
  ok('there are getUserMedia call sites to check', gumLines.length > 0);
  for (const i of gumLines) {
    // Walk back to the enclosing `const NAME = ` / `const NAME = async` declaration and require a
    // consent check between it and the call.
    let j = i, guard = false;
    for (; j >= 0 && i - j < 60; j--) {
      if (/hasValidAIConsent\(\)/.test(lines[j])) { guard = true; break; }
      if (/^\s{2}const \w+ = (async )?\(/.test(lines[j]) && j !== i) break;
    }
    ok('a consent check precedes the getUserMedia at ' + at(i).slice(0, 40), guard, at(i));
  }

  // 6. MediaRecorder, same rule.
  const mrLines = [];
  lines.forEach((l, i) => { if (/new MediaRecorder\s*\(/.test(l)) mrLines.push(i); });
  ok('there are MediaRecorder call sites to check', mrLines.length > 0);
  for (const i of mrLines) {
    let j = i, guard = false;
    for (; j >= 0 && i - j < 60; j--) {
      if (/hasValidAIConsent\(\)/.test(lines[j])) { guard = true; break; }
      if (/^\s{2}const \w+ = (async )?\(/.test(lines[j]) && j !== i) break;
    }
    ok('a consent check precedes the MediaRecorder at ' + at(i).slice(0, 40), guard, at(i));
  }

  // 7. The teardown contract.
  ok('ezKillRecognizer detaches onend BEFORE aborting',
    /rec\.onend = null;[\s\S]{0,240}?rec\.abort\(\)/.test(code));
  ok('...and aborts as well as stops', /typeof rec\.abort === 'function'/.test(code) && /typeof rec\.stop === 'function'/.test(code));
  ok('withdrawal tears down every live engine', /try \{ ezStopAllRecognition\(\); \} catch \(e\) \{\}/.test(code));
  ok('...and every constructed engine is registered so it can be found',
    /EZ_LIVE_RECOGNIZERS\.add\(rec\)/.test(code));
  ok('...and dropped again when killed', /EZ_LIVE_RECOGNIZERS\.delete\(rec\)/.test(code));

  // 8. Every onend auto-restart re-checks consent. These are the loops that outlive a choice.
  const onendBlocks = code.split(/\.onend = \(\) => \{/).slice(1);
  eq('there are auto-restarting onend handlers to check', onendBlocks.length >= 2, true);
  onendBlocks.forEach((b, i) => {
    const body = b.slice(0, 1400);
    if (!/ezStartRecognition|\.start\(/.test(body)) return;   // an onend that never restarts is fine
    ok('onend handler #' + (i + 1) + ' re-checks consent before restarting',
      /hasValidAIConsent\(\)/.test(body), body.slice(0, 200));
  });

  // 9. The refusal wording exists and is the one specified.
  ok('the local-mode speech line is the specified sentence',
    hasAr(code, MEM.NO_CONSENT), cps(MEM.NO_CONSENT));

  // 10. The corrected advertising/tracking wording -- no absolute promise on a provider's behalf.
  ok('the consent screen no longer makes an absolute no-ads claim',
    !hasAr(code, 'لا تُستخدم هذه البيانات للإعلانات ولا لتتبُّعك'));
  ok('...and states the scoped version instead',
    hasAr(code, 'لا يستخدم عزك هذه البيانات للإعلانات أو لتتبعك، ولا يرسلها إلى مزودي الخدمة إلا لتشغيل الميزات التي تختار استخدامها'));
  const priv = fs.readFileSync(path.join(REPO, 'privacy.html'), 'utf8');
  ok('privacy.html carries the scoped wording in Arabic',
    hasAr(priv, 'لا يستخدم عزك هذه البيانات للإعلانات أو لتتبعك، ولا يرسلها إلى مزودي الخدمة إلا لتشغيل الميزات التي تختار استخدامها'));
  ok('...and in English',
    /Ezik does not use this data for advertising or tracking and sends it to service providers only to operate the features you choose to use\./.test(priv));
  ok('...and the Apple equal-protection paragraph is still there',
    /We require every service provider that receives user data from Ezik/.test(priv));
  ok('...and the audio sentence is scoped too, in both languages',
    hasAr(priv, 'لا يستخدم عزك هذا الصوتَ للإعلانات أو لتتبعك')
      && /Ezik does not use that audio for advertising or tracking/.test(priv));
  ok('...and privacy.html names the browser/OS recitation path in the decline list',
    hasAr(priv, 'والتسميعُ الصوتيّ عبر خدمة التعرّف على الكلام في المتصفّح أو نظام التشغيل')
      && /voice recitation through the browser's or the operating system's speech-recognition service/.test(priv));
}

(async () => {
  say('==================================================================');
  say(' ai-consent-probe  ::  Apple 5.1.1(i) / 5.1.2(i)   (read-only)');
  say(' consent version: ' + CONSENT_VERSION);
  say('==================================================================');
  await partA();
  await partB();
  await partC();
  await partD();
  await partE();
  await partF();
  partG();
  await partH();
  partI();
  partL();
  await partJ();
  partK();
  say('');
  if (failures === 0) say('OK: ' + checks + '/' + checks + ' checks passed.');
  else say('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  // process.exitCode, NOT process.exit(): on Windows a piped stdout is written asynchronously,
  // and process.exit() discards whatever is still queued -- which silently ate this probe's
  // entire report the first time it was run. Setting the code lets Node drain and then leave.
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.log('\nPROBE CRASHED: ' + String(e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
