// a11y-guard.cjs — S99, the reading-preferences gate.
//
// It proves the phase the way every other guard in this repo does: by RUNNING the shipped code.
// The text/babel block is extracted from index.html, transformed with the page's own pinned Babel
// major, and evaluated inside a linkedom window against a localStorage stub this file controls.
//
// Parts:
//   A. THE STORE      — per-profile isolation, corrupt JSON, a dead store, a full store, defaults.
//   B. THE MECHANISM  — every text size in the styles object scales from ONE custom property, the
//                       fixed-size controls do not, and the mushaf is not in it at all.
//   C. THE SCREEN     — the settings card driven by real clicks, in a mounted app.
//   D. THE WIRING     — read off the file: reduced motion reaches the scroll, reading mode touches
//                       line-height and nothing else, no network, no new dependency, S97/S98 intact.
//
// The Arabic it looks for is collected in S below; every DIAGNOSTIC prints codepoints, because a
// failure message carrying raw Arabic reorders under bidi and then lies about which value it names.
//
// ONE LIVE CONTEXT AT A TIME — linkedom's window is a Proxy, and a second one makes an earlier vm
// context resolve bare `localStorage` to the newer window's stub.
//
// Usage: node a11y-guard.cjs [htmlFile]   (default: index.html)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

// A CONSENTED reader, seeded the way the app itself stores the choice. Since the AI-consent
// screen (Apple 5.1.1(i)) sits between the profile and the chat, a harness that wants to reach
// the chat has to answer it first -- exactly as a real reader does. The refusal path is proved
// separately in tools/ai-consent-probe.cjs. Note that the old 'disclosureAck' key is kept in
// these seeds and is NOT what opens the app: it is not consent and is no longer read.
// SINCE THE PARENTAL-GATE ROUND THE CONSENT RECORD BELONGS TO A PROFILE, so this seed is built
// from the pid of the profile it is seeded beside rather than from a constant. A record whose pid
// does not match the seeded profile is NOT consent -- which is the right behaviour, and is exactly
// why it has to be threaded here: without it the app opens on the consent screen and every case
// below would be measuring the wrong screen while reporting green on the right one.
const AI_CONSENT_SEED = (pid) => JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: pid, grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });


const htmlFile = process.argv[2] || 'index.html';
// ITEM 32. The application source moved out of index.html into app.jsx, which
// tools/build-app.cjs compiles into app.js before every commit. Everything this file
// searches for is IN that source, so it reads the shipped client -- the document plus the
// JSX it loads -- and not the shell alone. readShippedClient() throws if the page ships no
// JSX it can find, so this can never quietly become a search over the wrong file.
const html = require('./tools/babel-block.cjs').readShippedClient(htmlFile);

const S = {
  TITLE:    'سهولة الاستخدام',
  FS_LABEL: 'حجم الخط',
  NORMAL:   'عادي',
  LARGE:    'كبير',
  XLARGE:   'كبير جدًّا',
  READ:     'وضع القراءة',
  MOTION:   'تقليل الحركة',
  RESET:    'إعادة الإعدادات الافتراضية',
  SETTINGS: 'الإعدادات',
  BACK:     '← رجوع',
  MENU:     'فتح القائمة الجانبية',
};

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
const plain = (v) => JSON.parse(JSON.stringify(v));
const cps = (x) => Array.prototype.map.call(String(x == null ? '' : x), (c) => c.charCodeAt(0).toString(16)).join(' ');

// --- extract + transform, exactly as runtime-gate does -----------------------
// ITEM 32-b. The block is cut, and the JSX runtime settled, in ONE place: tools/babel-block.cjs.
// This used to be a private copy of the same two regexes plus `: 8` -- a SILENT fallback that
// let this gate keep transforming, with the wrong runtime, after the CDN tag it reads was
// removed. The helper raises a named error instead. (Measured: the page pins 7.26.4, so the
// runtime is `classic`; the fallback would have chosen `automatic`.)
const BB = require('./tools/babel-block.cjs');
let block;
try { block = BB.readBabelBlock({ file: htmlFile, html: html }); }
catch (e) { console.error(e.message); process.exit(2); }
const rawCode = block.raw;
let transformed;
try { transformed = BB.transformBabelBlock(block); }
catch (e) { console.log('TRANSFORM ERROR:\n' + e.message); process.exit(1); }

function makeStore(seed) {
  const data = Object.assign({}, seed || {});
  const size = () => { let t = 0; for (const k in data) t += k.length + data[k].length; return t; };
  const store = {
    quota: Infinity,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => {
      const prev = Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      data[k] = String(v);
      if (size() > store.quota) {
        if (prev === null) delete data[k]; else data[k] = prev;
        const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
      }
    },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k in data) delete data[k]; },
    _keys: () => Object.keys(data),
    _dump: () => plain(data),
  };
  return store;
}
function makeDeadStore() {
  const boom = () => { const e = new Error('SecurityError'); e.name = 'SecurityError'; throw e; };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, _keys: () => [], _dump: () => ({}) };
}

let liveGen = 0;
function buildContext(opts) {
  const o = opts || {};
  const gen = ++liveGen;
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.window = window.window || window;
  window.globalThis = window.globalThis || window;
  // The reduced-motion question is asked through matchMedia; this stub is what lets the platform
  // preference be turned on and off inside a test.
  let mediaReduce = !!o.platformReduce;
  window.matchMedia = function (q) {
    return { matches: (/prefers-reduced-motion/.test(String(q)) ? mediaReduce : false),
      media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.__setMediaReduce = (v) => { mediaReduce = !!v; };
  window.scrollTo = window.scrollTo || function () {};
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  const store = o.store || makeStore(o.seed);
  window.localStorage = store;
  window.alert = function () {}; window.confirm = function () { return true; };
  const net = [];
  window.fetch = function (u) { net.push(String(u)); return Promise.resolve({ ok: false, status: 0, headers: { get: () => null }, text: () => Promise.resolve(''), json: () => Promise.resolve({}) }); };
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try {
    const entries = [{}]; let at = 0;
    window.history = {
      get length() { return entries.length; }, get state() { return entries[at]; },
      pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
      replaceState: (st) => { entries[at] = st; },
      back: () => { if (at <= 0) return; at--; setTimeout(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0); },
      _depth: () => at,
    };
  } catch (e) {}
  global.navigator = window.navigator; global.window = window; global.document = window.document;

  const ctx = vm.createContext(window);
  const loadUMD = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8'), ctx, { filename: f });
  loadUMD('react.umd.js'); loadUMD('react-dom.umd.js');
  if (!window.React || !window.ReactDOM) { console.log('FAIL: React/ReactDOM did not load.'); process.exit(1); }
  if (!o.mount) vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  let caught = null;
  window.addEventListener('error', (ev) => { caught = ev.error || ev.message; });
  window.console.error = () => {};
  try { vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' }); }
  catch (e) { console.log('RUNTIME ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); }
  const stale = () => { throw new Error('a11y-guard: context ' + gen + ' used after ' + liveGen + ' replaced it'); };
  const grab = (expr) => { if (gen !== liveGen) stale(); try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'a11y-guard-api' }); } catch (e) { return undefined; } };
  return { window, ctx, store, grab, net: () => net.slice(), err: () => caught };
}

function tick(ms) { return new Promise((r) => setTimeout(r, ms || 40)); }
async function waitFor(fn, what, tries) {
  for (let i = 0; i < (tries || 60); i++) { if (fn()) return true; await tick(25); }
  throw new Error('timed out waiting for ' + what);
}
function driver(window) {
  const root = window.document.getElementById('root');
  const all = (sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  const byLabel = (l) => all('button').filter((b) => b.getAttribute('aria-label') === l)[0];
  const byText = (t) => all('button').filter((b) => String(b.textContent || '').trim() === t)[0];
  const click = async (el, what) => {
    if (!el) throw new Error('nothing to click: ' + (what || '?'));
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
  };
  return { root, all, byLabel, byText, click, text: () => String(root.textContent || '') };
}

const PROFILE_A = { name: 'أ', age: 30, gender: 'male', birthYear: 1996, pid: 'A11Y-A', createdAt: '2026-01-01T00:00:00.000Z' };
const PROFILE_B = { name: 'ب', age: 30, gender: 'male', birthYear: 1996, pid: 'A11Y-B', createdAt: '2026-01-01T00:00:00.000Z' };

// ===========================================================================
function partA() {
  console.log('\n=== A. THE STORE (the shipped functions, run for real) ===');
  const c = buildContext({ seed: {} });
  const read = c.grab('ezikReadA11y');
  const write = c.grab('ezikWriteA11y');
  const clear = c.grab('ezikClearAllA11y');
  const KEY = c.grab('EZIK_A11Y_KEY');
  const DEF = plain(c.grab('EZIK_A11Y_DEFAULTS') || {});
  const SCALES = plain(c.grab('EZIK_FS_SCALES') || {});
  if (!ok('the preference store is on the page', typeof read === 'function' && typeof write === 'function')) return;

  eq('it lives under its own versioned key', KEY, 'ezik_reading_prefs_v1');
  ok('...which is not the conversations key and not the favourites key',
    KEY !== c.grab('EZIK_CHATS_KEY') && KEY !== c.grab('EZIK_FAVS_KEY'));
  eq('the defaults are the app as it shipped', DEF, { fontSize: 'normal', reading: false, reduceMotion: false });
  eq('there are exactly three text sizes', Object.keys(SCALES).sort(), ['large', 'normal', 'xlarge']);
  eq('...and normal is exactly 1, so nothing moves until it is asked to', SCALES.normal, 1);
  ok('...and each larger size really is larger', SCALES.large > 1 && SCALES.xlarge > SCALES.large,
    JSON.stringify(SCALES));

  eq('an unset profile reads the defaults', plain(read('A11Y-A')), DEF);

  // 1) ISOLATION BETWEEN TWO PROFILES
  ok('writing a preference reports success', write('A11Y-A', { fontSize: 'xlarge', reading: true, reduceMotion: false }) === true);
  eq('...and reads back for that profile', plain(read('A11Y-A')), { fontSize: 'xlarge', reading: true, reduceMotion: false });
  eq('THE OTHER PROFILE IS UNAFFECTED', plain(read('A11Y-B')), DEF);
  write('A11Y-B', { fontSize: 'large', reading: false, reduceMotion: true });
  eq('...and each keeps its own', plain(read('A11Y-A')), { fontSize: 'xlarge', reading: true, reduceMotion: false });
  eq('...independently', plain(read('A11Y-B')), { fontSize: 'large', reading: false, reduceMotion: true });
  ok('a profile with no id cannot be written', write('', { fontSize: 'large' }) === false);

  // 2) RESTORING THE DEFAULT
  write('A11Y-A', DEF);
  eq('restoring the defaults reads back as defaults', plain(read('A11Y-A')), DEF);
  const stored = JSON.parse(c.store.getItem(KEY) || '{}');
  ok('...and leaves NO record behind for that profile', !Object.prototype.hasOwnProperty.call(stored, 'A11Y-A'),
    JSON.stringify(Object.keys(stored)));
  eq('...while the other profile is still there', plain(read('A11Y-B')), { fontSize: 'large', reading: false, reduceMotion: true });

  // 3) CORRUPT JSON — every shape, and none of them may throw
  const bad = ['{ not json', 'null', '[]', '"a string"', '{"A11Y-A":5}', '{"A11Y-A":null}', '{"A11Y-A":[1,2]}'];
  bad.forEach((raw) => {
    c.store.setItem(KEY, raw);
    let threw = null, got;
    try { got = plain(read('A11Y-A')); } catch (e) { threw = e; }
    ok('corrupt payload ' + JSON.stringify(raw.slice(0, 18)) + ' reads as defaults', !threw && JSON.stringify(got) === JSON.stringify(DEF),
      threw ? String(threw.message) : JSON.stringify(got));
  });
  // a record with fields of the wrong TYPE, or an unknown size
  c.store.setItem(KEY, JSON.stringify({ 'A11Y-A': { fontSize: 'gigantic', reading: 'yes', reduceMotion: 1 } }));
  eq('an unknown size and non-boolean flags fall back to the defaults', plain(read('A11Y-A')), DEF);
  c.store.setItem(KEY, JSON.stringify({ 'A11Y-A': { fontSize: 'large' } }));
  eq('a partial record keeps what is valid and defaults the rest', plain(read('A11Y-A')), { fontSize: 'large', reading: false, reduceMotion: false });

  // 4) A FULL STORE must not report success it did not achieve
  c.store.clear();
  c.store.quota = 0;
  ok('a full store reports the write FAILED rather than claiming success', write('A11Y-A', { fontSize: 'xlarge' }) === false);
  c.store.quota = Infinity;

  // 5) «delete all my data»
  write('A11Y-A', { fontSize: 'xlarge' });
  clear();
  eq('«delete all my data» clears the preferences', plain(read('A11Y-A')), DEF);

  // 6) nothing else in storage was touched
  c.store.clear();
  write('A11Y-A', { fontSize: 'large' });
  eq('writing a preference writes exactly one key', c.store._keys(), [KEY]);
}

function partADead() {
  console.log('\n--- preferences with storage switched off ---');
  const c = buildContext({ store: makeDeadStore() });
  const read = c.grab('ezikReadA11y'), write = c.grab('ezikWriteA11y'), clear = c.grab('ezikClearAllA11y');
  let threw = null, got;
  try { got = plain(read('A11Y-A')); } catch (e) { threw = e; }
  ok('reading from a dead store does not throw', !threw, String(threw && threw.message));
  eq('...and yields the defaults', got, { fontSize: 'normal', reading: false, reduceMotion: false });
  threw = null;
  let w;
  try { w = write('A11Y-A', { fontSize: 'large' }); } catch (e) { threw = e; }
  ok('writing to a dead store does not throw', !threw, String(threw && threw.message));
  ok('...and reports that nothing was stored', w === false);
  threw = null;
  try { clear(); } catch (e) { threw = e; }
  ok('clearing a dead store does not throw', !threw, String(threw && threw.message));
}

// ===========================================================================
function partB() {
  console.log('\n=== B. THE MECHANISM (the styles object, as the browser will read it) ===');
  const c = buildContext({ seed: {} });
  const apply = c.grab('ezikApplyA11y');
  const SCALES = plain(c.grab('EZIK_FS_SCALES') || {});

  // THE DEFAULT PATH COSTS NOTHING. At the default size the styles object is the object that
  // shipped — plain numbers — which is what makes the measured keystroke and menu-open identical
  // to the commit before this phase. Proving it here is proving the performance claim.
  const asShipped = plain(c.grab('s') || {});
  let numeric = 0;
  const countNumeric = (o) => {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach((k) => {
      const v = o[k];
      if (v && typeof v === 'object') { countNumeric(v); return; }
      if (k === 'fontSize' && typeof v === 'number') numeric++;
    });
  };
  Object.keys(asShipped).forEach((k) => countNumeric(asShipped[k]));
  ok('AT THE DEFAULT SIZE the styles object still holds plain numbers — it costs nothing',
    numeric > 100, 'numeric fontSize values at default: ' + numeric);

  // ...and it becomes scalable only when a larger size is asked for.
  const madeScalable = c.grab('ezikEnsureScalableStyles')();
  ok('choosing a larger size makes the styles scalable, once', madeScalable === true);
  ok('...and asking twice does no work a second time', c.grab('ezikEnsureScalableStyles')() === false);
  const s = plain(c.grab('s') || {});

  // every text size scales, and the number inside it is the ORIGINAL number
  let scaled = 0, unscaled = [];
  const walk = (obj, key, fixedParent) => {
    if (!obj || typeof obj !== 'object') return;
    const fixed = fixedParent || typeof obj.width === 'number' || typeof obj.height === 'number';
    Object.keys(obj).forEach((k) => {
      const v = obj[k];
      if (v && typeof v === 'object') { walk(v, key + '.' + k, false); return; }
      if (k !== 'fontSize') return;
      if (typeof v === 'string' && /^calc\([0-9.]+px \* var\(--ez-fs, 1\)\)$/.test(v)) { scaled++; return; }
      // A RELATIVE size already scales: it is a multiple of its parent's computed size, and the
      // parent is a px size that this pass rewrote. `mdCode: '0.92em'` is the shipped example.
      if (typeof v === 'string' && /^[0-9.]+(em|rem|%)$/.test(v)) { scaled++; return; }
      if (typeof v === 'number' && fixed) return;                 // a fixed-size control, on purpose
      unscaled.push(key + ' = ' + JSON.stringify(v) + (fixed ? ' [fixed]' : ''));
    });
  };
  Object.keys(s).forEach((k) => walk(s[k], k, false));
  ok('the styles object carries scalable text sizes', scaled > 100, 'scaled=' + scaled);
  eq('...and every text size that is not on a fixed-size control scales', unscaled, []);

  // named surfaces the brief requires
  const REQUIRED = ['bubbleText', 'drawerItem', 'settingsLabel', 'favText', 'quickBtn', 'a11yOpt', 'suggestionChipSmall'];
  REQUIRED.forEach((k) => {
    const v = s[k] && s[k].fontSize;
    ok('the ' + k + ' surface scales', typeof v === 'string' && v.indexOf('var(--ez-fs') !== -1, k + '.fontSize=' + JSON.stringify(v));
  });

  // fixed-size controls do NOT scale — a glyph must not outgrow a box that cannot grow
  const FIXED = ['sendBtn', 'micBtn', 'callMuteBtn', 'drawerChatIcon'];
  FIXED.forEach((k) => {
    const v = s[k] || {};
    if (typeof v.fontSize === 'undefined') { ok('the fixed control ' + k + ' declares no text size', true); return; }
    ok('the fixed-size control ' + k + ' keeps its text size', typeof v.fontSize === 'number',
      k + '.fontSize=' + JSON.stringify(v.fontSize));
  });

  // NO CSS ZOOM anywhere
  ok('the mechanism uses no CSS zoom', !/[^a-z-]zoom\s*:/i.test(html), 'a zoom declaration is present');

  // the root attributes really move
  const el = c.window.document.documentElement;
  apply({ fontSize: 'xlarge', reading: true, reduceMotion: true });
  eq('applying a preference sets the multiplier on the root', el.style.getPropertyValue('--ez-fs'), String(SCALES.xlarge));
  eq('...and the size attribute', el.getAttribute('data-ez-fs'), 'xlarge');
  eq('...and the reading attribute', el.getAttribute('data-ez-read'), '1');
  eq('...and the motion attribute', el.getAttribute('data-ez-motion'), 'reduce');
  apply({ fontSize: 'normal', reading: false, reduceMotion: false });
  eq('turning them off removes the reading attribute', el.getAttribute('data-ez-read'), null);
  eq('...and the motion attribute', el.getAttribute('data-ez-motion'), null);
  eq('...and returns the multiplier to 1', el.style.getPropertyValue('--ez-fs'), '1');

  // the reduced-motion question: local OR platform
  const reduced = c.grab('ezikMotionReduced');
  ok('the local preference alone means reduced motion', reduced(true) === true);
  ok('...and neither means it is not', reduced(false) === false);
  c.window.__setMediaReduce(true);
  ok('THE PLATFORM PREFERENCE ALONE ALSO MEANS REDUCED MOTION', reduced(false) === true);
  c.window.__setMediaReduce(false);
  ok('...and it is asked again each time, never cached', reduced(false) === false);
}

// ===========================================================================
async function partC() {
  console.log('\n=== C. THE SCREEN (the settings card, driven by real clicks) ===');
  const seed = { child_profile: JSON.stringify(PROFILE_A), disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED(PROFILE_A.pid) };
  const c = buildContext({ seed: seed, mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts', false, String(c.err())); return; }
  const d = driver(c.window);
  const KEY = c.grab('EZIK_A11Y_KEY');
  const el = c.window.document.documentElement;
  const netAtStart = c.net().length;

  // reach الإعدادات through the shipped drawer
  await d.click(d.byLabel(S.MENU), 'menu');
  const gear = d.byLabel(S.SETTINGS);
  if (!ok('the settings entry is in the menu', !!gear)) return;
  await d.click(gear, 'settings');
  await waitFor(() => d.text().indexOf(S.TITLE) !== -1, 'the accessibility card');

  ok('the settings screen carries a «سهولة الاستخدام» card', d.text().indexOf(S.TITLE) !== -1);
  ok('...with the three text sizes', !!d.byText(S.NORMAL) && !!d.byText(S.LARGE) && !!d.byText(S.XLARGE));
  ok('...a reading-mode switch', d.all('button').some((b) => b.getAttribute('role') === 'switch' && String(b.textContent || '').indexOf(S.READ) !== -1));
  ok('...a reduced-motion switch', d.all('button').some((b) => b.getAttribute('role') === 'switch' && String(b.textContent || '').indexOf(S.MOTION) !== -1));
  ok('...and a reset', !!d.byText(S.RESET));

  const sizeGroup = d.all('[role="radiogroup"]').filter((g) => g.getAttribute('aria-label') === S.FS_LABEL)[0];
  ok('the sizes are one labelled radio group', !!sizeGroup);
  ok('...with the current one marked checked',
    !!d.byText(S.NORMAL) && d.byText(S.NORMAL).getAttribute('aria-checked') === 'true');

  // each of the three sizes
  await d.click(d.byText(S.LARGE), 'large');
  eq('choosing «كبير» moves the multiplier', el.style.getPropertyValue('--ez-fs'), String(plain(c.grab('EZIK_FS_SCALES')).large));
  eq('...and marks it checked', d.byText(S.LARGE).getAttribute('aria-checked'), 'true');
  eq('...and unchecks the previous one', d.byText(S.NORMAL).getAttribute('aria-checked'), 'false');
  await d.click(d.byText(S.XLARGE), 'xlarge');
  eq('choosing «كبير جدًّا» moves it again', el.getAttribute('data-ez-fs'), 'xlarge');
  await d.click(d.byText(S.NORMAL), 'normal');
  eq('choosing «عادي» returns it to 1', el.style.getPropertyValue('--ez-fs'), '1');

  // reading mode
  const readSwitch = () => d.all('button').filter((b) => b.getAttribute('role') === 'switch' && String(b.textContent || '').indexOf(S.READ) !== -1)[0];
  eq('reading mode starts off', readSwitch().getAttribute('aria-checked'), 'false');
  await d.click(readSwitch(), 'reading on');
  eq('turning reading mode on marks the switch', readSwitch().getAttribute('aria-checked'), 'true');
  eq('...and sets the attribute the stylesheet reads', el.getAttribute('data-ez-read'), '1');
  await d.click(readSwitch(), 'reading off');
  eq('turning it off clears the attribute', el.getAttribute('data-ez-read'), null);

  // reduced motion
  const motionSwitch = () => d.all('button').filter((b) => b.getAttribute('role') === 'switch' && String(b.textContent || '').indexOf(S.MOTION) !== -1)[0];
  await d.click(motionSwitch(), 'motion on');
  eq('turning reduced motion on marks the switch', motionSwitch().getAttribute('aria-checked'), 'true');
  eq('...and sets the attribute', el.getAttribute('data-ez-motion'), 'reduce');

  // it PERSISTS
  await d.click(d.byText(S.LARGE), 'large again');
  const saved = JSON.parse(c.store.getItem(KEY) || '{}');
  ok('the choices are stored under the active profile', !!saved[PROFILE_A.pid], JSON.stringify(Object.keys(saved)));
  eq('...exactly as chosen', saved[PROFILE_A.pid], { fontSize: 'large', reading: false, reduceMotion: true });

  // reset
  await d.click(d.byText(S.RESET), 'reset');
  eq('reset returns the multiplier to 1', el.style.getPropertyValue('--ez-fs'), '1');
  eq('...clears reading mode', el.getAttribute('data-ez-read'), null);
  eq('...clears reduced motion', el.getAttribute('data-ez-motion'), null);
  const afterReset = JSON.parse(c.store.getItem(KEY) || '{}');
  ok('...and removes the record entirely', !afterReset[PROFILE_A.pid], JSON.stringify(afterReset));

  eq('NOTHING on this screen reached the network', c.net().length, netAtStart);
  ok('...and no runtime error was raised', !c.err(), String(c.err()));
}

// A SECOND profile on the SAME device must not inherit the first one's settings.
async function partCTwoProfiles() {
  console.log('\n--- two profiles on one device ---');
  const prefs = {}; prefs[PROFILE_A.pid] = { fontSize: 'xlarge', reading: true, reduceMotion: true };
  const seed = {
    child_profile: JSON.stringify(PROFILE_B), disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED(PROFILE_B.pid),
    ezik_reading_prefs_v1: JSON.stringify(prefs),
  };
  const c = buildContext({ seed: seed, mount: true });
  await tick(400);
  if (c.err()) { ok('the second profile mounts', false, String(c.err())); return; }
  const d = driver(c.window);
  const el = c.window.document.documentElement;
  ok('the second profile mounts with the first one\'s settings already in the store',
    !!JSON.parse(c.store.getItem('ezik_reading_prefs_v1') || '{}')[PROFILE_A.pid]);
  eq('THE SECOND PROFILE IS AT THE DEFAULT SIZE', el.style.getPropertyValue('--ez-fs'), '1');
  eq('...with no reading mode', el.getAttribute('data-ez-read'), null);
  eq('...and no reduced motion', el.getAttribute('data-ez-motion'), null);

  await d.click(d.byLabel(S.MENU), 'menu');
  await d.click(d.byLabel(S.SETTINGS), 'settings');
  await waitFor(() => d.text().indexOf(S.TITLE) !== -1, 'the card');
  eq('...and its own card shows «عادي» selected', d.byText(S.NORMAL).getAttribute('aria-checked'), 'true');
  await d.click(d.byText(S.LARGE), 'large');
  const saved = JSON.parse(c.store.getItem('ezik_reading_prefs_v1') || '{}');
  eq('choosing a size files it under the SECOND profile', saved[PROFILE_B.pid], { fontSize: 'large', reading: false, reduceMotion: false });
  eq('THE FIRST PROFILE\'S SETTINGS ARE UNTOUCHED', saved[PROFILE_A.pid], { fontSize: 'xlarge', reading: true, reduceMotion: true });
}

// ===========================================================================
function partD() {
  console.log('\n=== D. THE WIRING (index.html) ===');
  const decoded = html.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // reduced motion reaches the ONE scroll it is allowed to change, and nothing else about S97
  ok('reduced motion reaches the follow scroll',
    /scrollIntoView\(\{ behavior: ezikMotionReduced\(a11yRef\.current\.reduceMotion\) \? 'auto' : 'smooth' \}\)/.test(decoded));
  ok('...and every S97 guard above it is untouched',
    /if \(skipFollowRef\.current > 0\)/.test(decoded)
    && /if \(jumpToEndRef\.current\) return;/.test(decoded)
    && /if \(!stickToEndRef\.current\) return;/.test(decoded));
  ok('...and the opening pin is still a layout effect written before paint',
    /React\.useLayoutEffect\(\(\) => \{\s*if \(!jumpToEndRef\.current\) return;/.test(decoded));
  // EVERY animated scroll, not some. A setting that leaves half the motion moving is not a
  // setting, and the count is how that is pinned -- but the count is a consequence, not the
  // rule. S103 took it from two to one: the second belonged to the deleted deck browser's
  // jump-to-favourites affordance, which went with the component rather than being turned off.
  // The rule below is unchanged and is the one that matters.
  const scrolls = (decoded.match(/^.*scrollIntoView\(\{[^}]*behavior[^}]*\}.*$/gm) || [])
    .map((l) => l.trim()).filter((l) => l.indexOf('//') !== 0 && l.indexOf('*') !== 0);
  eq('the app owns exactly one animated scroll', scrolls.length, 1);
  ok('...and EVERY one of them asks the reduced-motion question',
    scrolls.every((l) => /ezikMotionReduced/.test(l)), scrolls.join(' || '));

  // reading mode changes spacing, not content
  const rm = html.match(/:root\[data-ez-read="1"\][^\n]*/g) || [];
  ok('reading mode is declared', rm.length > 0);
  const props = rm.join(' ');
  ok('...and touches only spacing properties',
    !/display\s*:|visibility\s*:|color\s*:|background/.test(props), props.slice(0, 200));
  ok('...scoped to prose, never to a card', props.indexOf('.ez-prose') !== -1);

  // reduced motion: scoped, and the two things that must keep moving are not in it
  // Every SELECTOR in the reduced-motion block, isolated. A blanket `*{animation:none}` would
  // freeze the mushaf page turn, which resolves a promise on animationend and would hang that
  // screen forever — so each selector must be anchored on the attribute, never stand alone.
  const moBlock = (html.match(/^\s*:root\[data-ez-motion="reduce"\][\s\S]*?\}\s*$/gm) || []).join('\n');
  const moSelectors = (moBlock.match(/^[^{}\n]+(?=[,{])/gm) || []).map((x) => x.trim()).filter(Boolean);
  ok('reduced motion is declared', moSelectors.length > 0);
  const unanchored = moSelectors.filter((sel) => sel.indexOf(':root[data-ez-motion="reduce"]') !== 0);
  eq('...and every selector in it is anchored on that attribute, never a bare *', unanchored, []);
  const mo = moBlock;
  ok('...so the typing dots keep animating', mo.indexOf('typing') === -1 && mo.indexOf('s.dot') === -1);
  ok('...and the mushaf page turn is untouched', mo.indexOf('slide') === -1 && mo.indexOf('flip') === -1);
  // MEASURED: selecting the animated elements with [style*="..."] forces a substring search over
  // every element's inline style on every recalculation, and cost +0.74 ms on opening the menu.
  // The rule must name a class, never match on the style attribute.
  ok('...and it selects by class, never by matching the style attribute',
    mo.indexOf('[style') === -1, mo.slice(0, 240));
  ok('...on the elements that really animate', /\.ez-anim/.test(mo));
  ok('the animated elements carry that class',
    (decoded.match(/className="ez-anim"/g) || []).length >= 4,
    'tagged: ' + (decoded.match(/className="ez-anim"/g) || []).length);

  // the preferences never leave the device
  ok('no preference is ever sent anywhere',
    !/fetch\([^)]{0,200}(ez_fs|reading_prefs|reduceMotion)/.test(decoded));
  ok('the preferences are read once into state, not on a render path',
    /const \[a11y, setA11yState\] = useState\(EZIK_A11Y_DEFAULTS\);/.test(decoded));
  ok('...and applied from ONE function', (decoded.match(/function ezikApplyA11y/g) || []).length === 1);
  ok('«delete all my data» clears them', /ezikClearAllFavs\(\);[\s\S]{0,400}?ezikClearAllA11y\(\);/.test(decoded));

  // the mushaf keeps its OWN type system — no parallel one was invented
  ok('the mushaf still computes its own type size', /PG_BASE_FS/.test(decoded));
  ok('...and the scaler never reaches it',
    !/PG_BASE_FS[^\n]{0,120}--ez-fs/.test(decoded) && !/--ez-fs[^\n]{0,120}PG_BASE_FS/.test(decoded));

  // no new dependency, no new host
  const srcs = (html.match(/<script[^>]*src=["']([^"']+)["']/gi) || [])
    .map((tag) => (tag.match(/src=["']([^"']+)["']/i) || [])[1]);
  // ITEM 32. The three sources are the same three libraries, at exact LOCAL paths instead of
  // versioned CDN URLs, and one of them is new: the page loads its own compiled bundle instead of
  // shipping JSX and a compiler to compile it with. The patterns are ANCHORED (^...$) rather than
  // substring-matched, so this is strictly narrower than what it replaces -- 'vendor/react.umd.js'
  // matches and nothing else does, where the old '/react@<any>/umd/...' would have accepted any
  // version from any host. The 'unexpected' arm below is unchanged and still rejects a source
  // that is not on this list.
  const requiredScripts = [
    ['react', /^vendor\/react\.umd\.js$/],
    ['react-dom', /^vendor\/react-dom\.umd\.js$/],
    ['app bundle', /^app\.js$/],
  ];
  const scriptSourceProblems = (sources) => {
    const missing = requiredScripts.filter(([, re]) => !sources.some((source) => re.test(source)))
      .map(([name]) => 'missing:' + name);
    const unexpected = sources.filter((source) => !requiredScripts.some(([, re]) => re.test(source)))
      .map((source) => 'unexpected:' + source);
    return missing.concat(unexpected).sort();
  };
  eq('the page still loads the required script sources and no undeclared source',
    scriptSourceProblems(srcs), []);
  ok('counter-mutation: deleting a required script source is rejected',
    scriptSourceProblems(srcs.filter((source) => !/^vendor\/react\.umd\.js$/.test(source))).includes('missing:react'));
  ok('...and no analytics script is among them',
    !srcs.some((t) => /_vercel\/(insights|speed-insights)/.test(String(t))), srcs.join(' || '));
  const hosts = [];
  (html.match(/(?:src|href)=["']https?:\/\/([^\/"']+)/gi) || []).forEach((t) => {
    const m = t.match(/https?:\/\/([^\/"']+)/); if (m && hosts.indexOf(m[1]) === -1) hosts.push(m[1]);
  });
  // ITEM 32. unpkg.com and cdn.jsdelivr.net are struck OFF the allow-list, not left on it as
  // dead permission. The page reaches neither now, and a check that still blessed them would go
  // on passing the day one came back. Narrower, in both directions: the two assertions under it
  // state the removal positively, so this cannot pass by finding nothing.
  eq('...and reaches no host it did not already reach',
    hosts.filter((h) => ['fonts.googleapis.com', 'fonts.gstatic.com', 'mushaf.almurabbi.app'].indexOf(h) === -1), []);
  ok('...and not one script tag is fetched from another origin at all',
    srcs.length > 0 && !srcs.some((source) => /^https?:/i.test(String(source))), srcs.join(' || '));
  ok('...and @babel/standalone is nowhere in the page',
    html.length > 0 && html.indexOf('@babel/standalone') === -1);

  // the boot script applies the preference before first paint
  ok('the preferences are applied before the first paint', /ezik_reading_prefs_v1/.test(html.slice(0, html.indexOf('</head>'))));

  // S98 is intact
  ok('S98 folding is untouched', /const EZIK_FOLD_MIN_CHARS = 900;/.test(decoded));
  ok('S98 favourites identity is untouched', /function ezikFavId\(pk, chatId, idx, text\)/.test(decoded));

  // 320px: nothing new is pinned wider, and every new control is a real touch target
  const c2 = buildContext({ seed: {} });
  const s = plain(c2.grab('s') || {});
  const NEW = ['a11yOpt', 'a11ySwitchRow', 'a11yReset', 'a11yGroupLabel', 'a11ySwitch', 'a11yKnob', 'a11ySwitchTitle', 'a11ySwitchHint'];
  const literal = [], wide = [], small = [];
  NEW.forEach((k) => {
    const v = s[k] || {};
    ok('the new style key ' + k + ' exists', !!s[k]);
    Object.keys(v).forEach((p) => {
      const val = String(v[p]);
      if (/#[0-9a-fA-F]{3,8}\b/.test(val) || /\brgba?\(/.test(val)) literal.push(k + '.' + p + '=' + val);
    });
    if (typeof v.width === 'number' && v.width > 280) wide.push(k);
    if (typeof v.minWidth === 'number' && v.minWidth > 280) wide.push(k);
  });
  eq('no new style key carries a hardcoded colour — every one is a token', literal, []);
  eq('nothing new is pinned wider than a 320px screen', wide, []);
  ['a11yOpt', 'a11yReset'].forEach((k) => { if (!((s[k] || {}).minHeight >= 44)) small.push(k + '.minHeight=' + (s[k] || {}).minHeight); });
  if (!((s.a11ySwitchRow || {}).minHeight >= 44)) small.push('a11ySwitchRow.minHeight=' + (s.a11ySwitchRow || {}).minHeight);
  eq('every new tappable surface is at least 44px tall', small, []);
  ok('the new controls carry a visible keyboard focus ring', /\.ez-a11y-opt:focus-visible/.test(html));
}

// ===========================================================================
(async function main() {
  console.log('=== a11y-guard (S99) — ' + htmlFile + ' ===');
  partA();
  partADead();
  partB();
  await partC();
  await partCTwoProfiles();
  partD();
  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('\nGUARD CRASHED: ' + String(e && e.stack ? e.stack : e)); process.exit(1); });
