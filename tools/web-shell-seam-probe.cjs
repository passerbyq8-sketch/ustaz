// web-shell-seam-probe.cjs -- the qibla panel's FIRST visit, mounted, without a phone.
//
// WHAT THIS ANSWERS AND WHY IT IS ITS OWN FILE. The owner reported one fact with his own eyes:
// he opens the prayer section for the first time and the compass is not there; he leaves, comes
// back, and it is there and works, and it never goes wrong again -- on iPhone AND on Android,
// which is what makes it a fact about THIS file rather than about a shell.
//
// The cause is not in the arithmetic, the sensor or the contract. It is in the panel's LIFETIME.
// QiblaPanel arms the shell's heading stream exactly once, in its single mount effect, and the
// only other sender in the panel is retryShellHeading -- which reaches a control drawn for ONE of
// the five statuses, `heading-error`. So a first start answered `permission-denied` ends the
// visit: no dial, no control, no second start. And `permission-denied` is exactly what a first
// start gets, because the shell reads the heading out of the LOCATION permission -- the panel's
// own line says so to the reader, and then tells them to grant it and COME BACK TO THIS SCREEN.
// That instruction is the bug, written down.
//
// SO THIS FILE MOUNTS THE PANEL over a shell that behaves the way the contract says: it refuses a
// heading while the location permission is ungranted, grants that permission when the reader
// presses the panel's own location button, and answers `ready` afterwards. Then it asks the one
// question that matters: is the needle drawn on the FIRST visit?
//
// AND IT CARRIES ITS OWN CONTROL. The same panel is lifted a second time with the re-arm line
// removed -- the tree exactly as it stood before this round -- and that one must NOT draw on the
// first visit, and MUST draw on the second. A probe every case passes is a probe that proves
// nothing, so the pre-fix panel is run beside the fixed one and both answers are printed.
//
// Nothing is re-typed: every function, constant and the panel itself are extracted from app.jsx
// by name through @babel/parser and evaluated verbatim. Zero bytes are written to the tree.
//
// Usage:  node tools/web-shell-seam-probe.cjs
// Exit:   0 when the fixed panel draws on the first visit AND the pre-fix panel does not.
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'app.jsx');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));
const babel = require(path.join(REPO, 'node_modules', '@babel', 'core'));
const PRESET_REACT = path.join(REPO, 'node_modules', '@babel', 'preset-react');

const source = fs.readFileSync(SRC, 'utf8');
const ast = parser.parse(source, { sourceType: 'script', plugins: ['jsx'] });

const text = (node) => source.slice(node.start, node.end);
const startLine = (node) => node.loc.start.line;

function topFunction(name) {
  for (const n of ast.program.body) {
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) return n;
  }
  throw new Error('app.jsx no longer declares function ' + name + '() at the top level');
}
function topConst(name) {
  for (const n of ast.program.body) {
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier' && d.id.name === name) return n;
    }
  }
  throw new Error('app.jsx no longer declares the top-level binding ' + name);
}

const CONSTS = [
  'KAABA_LAT', 'KAABA_LNG', 'QIBLA_DEFAULT_LAT', 'QIBLA_DEFAULT_LNG', 'QIBLA_DEFAULT_PLACE',
  'QIBLA_LOC_KEY', 'QIBLA_DIRS',
  'SHELL_LOC_REQUEST', 'SHELL_LOC_RESULT', 'SHELL_LOC_TIMEOUT_MS',
  'SHELL_HEADING_START', 'SHELL_HEADING_STOP', 'SHELL_HEADING_RESULT', 'SHELL_HEADING_STATUSES',
  'QIBLA_SECTION', 'QIBLA_DEG_SUFFIX', 'QIBLA_TOWARD', 'QIBLA_PLACE_LABEL',
  'QIBLA_PLACE_DEFAULT_NOTE', 'QIBLA_DEVICE_PLACE', 'QIBLA_USE_DEVICE', 'QIBLA_USE_DEFAULT',
  'QIBLA_LOC_ASKING', 'QIBLA_LOC_DENIED', 'QIBLA_COMPASS_START', 'QIBLA_COMPASS_WAIT',
  'QIBLA_COMPASS_NONE', 'QIBLA_COMPASS_LIVE', 'QIBLA_COMPASS_CALIBRATION',
  'QIBLA_COMPASS_SENSOR_UNAVAILABLE', 'QIBLA_COMPASS_PERMISSION_DENIED',
  'QIBLA_COMPASS_HEADING_ERROR', 'QIBLA_COMPASS_RETRY', 'QIBLA_NEEDLE_MS', 'toArabicDigits',
];
const FUNCS = [
  'qiblaBearing', 'qiblaDirName', 'qiblaDegreeText', 'qiblaHeadingOf',
  'qiblaNeedleAngle', 'qiblaNeedleVisual', 'readQiblaLoc', 'writeQiblaLoc', 'clearQiblaLoc',
  'ezikShellBridge', 'shellLocResultCoords', 'shellHeadingOf', 'sendShellHeadingCommand',
];
const FN_PANEL = topFunction('QiblaPanel');

const HARNESS_JSX = [
  '"use strict";',
  'const window = env.window;',
  'const navigator = env.navigator;',
  'const localStorage = env.localStorage;',
  'const setTimeout = env.setTimeout;',
  'const clearTimeout = env.clearTimeout;',
  'const React = env.React;',
  'const useState = env.useState;',
  'const useRef = env.useRef;',
  'const useEffect = env.useEffect;',
  'const s = env.s;',
  'const EzShellGroup = env.EzShellGroup;',
]
  .concat(CONSTS.map((n) => text(topConst(n))))
  .concat(FUNCS.map((n) => text(topFunction(n))))
  .concat([
    text(FN_PANEL),
    'return { QiblaPanel: QiblaPanel, readQiblaLoc: readQiblaLoc,',
    '  QIBLA_USE_DEVICE: QIBLA_USE_DEVICE, QIBLA_COMPASS_WAIT: QIBLA_COMPASS_WAIT,',
    '  QIBLA_COMPASS_PERMISSION_DENIED: QIBLA_COMPASS_PERMISSION_DENIED,',
    '  QIBLA_COMPASS_LIVE: QIBLA_COMPASS_LIVE };',
  ])
  .join('\n');

function compile(jsx) {
  return babel.transformSync(jsx, {
    configFile: false,
    babelrc: false,
    compact: false,
    sourceType: 'script',
    parserOpts: { allowReturnOutsideFunction: true },
    presets: [[PRESET_REACT, { runtime: 'classic' }]],
  }).code;
}

// THE PRE-FIX PANEL: the same lift with the one added line taken out. It is built here rather
// than remembered, so it cannot drift away from what was actually added.
const REARM = /\n\s*retryShellHeading\(\);/;
const PANEL_TEXT = text(FN_PANEL);
const PANEL_BEFORE = PANEL_TEXT.replace(REARM, '');
const REARM_FOUND = PANEL_BEFORE !== PANEL_TEXT;
const HARNESS_BEFORE_JSX = HARNESS_JSX.replace(PANEL_TEXT, PANEL_BEFORE);

// ---------------------------------------------------------------------------
// THE FAKE SHELL -- the contract as murabbi-shell states it, and not one step further.
// ---------------------------------------------------------------------------
//
// TWO RULES, BOTH READ FROM WHAT IS ALREADY WRITTEN DOWN:
//   1. A heading comes out of the LOCATION permission. Ungranted ⟹ `permission-denied`; granted
//      ⟹ `ready` with a usable true heading. (app.jsx's own QIBLA_COMPASS_PERMISSION_DENIED
//      tells the reader to grant the location permission and return to the screen.)
//   2. The location REQUEST is the reader's gesture, and it is what grants that permission.
function fakeShell(win) {
  const sent = [];
  let granted = false;
  const bridge = {
    postMessage: (raw) => {
      sent.push(raw);
      let msg = null;
      try { msg = JSON.parse(raw); } catch (e) { return; }
      if (msg.type === 'ezik:heading:start') {
        win.dispatch('ezik:heading:result', granted
          ? { type: 'ezik:heading:result', ok: true, status: 'ready', trueHeading: 100, magHeading: 100, accuracy: 3, error: null }
          : { type: 'ezik:heading:result', ok: false, status: 'permission-denied', trueHeading: null, magHeading: null, accuracy: null, error: 'permission-denied' });
        return;
      }
      if (msg.type === 'ezik:heading:stop') return;
      if (msg.type === 'ezik:location:request') {
        granted = true;                      // the reader answered the system prompt with yes
        win.dispatch('ezik:location:result',
          { type: 'ezik:location:result', ok: true, lat: 29.38, lon: 47.98, source: 'gps', error: null });
      }
    },
  };
  return { bridge: bridge, sent: sent, isGranted: () => granted };
}

function fakeWindow() {
  const listeners = [];
  return {
    addEventListener(type, fn) { listeners.push({ type: type, fn: fn }); },
    removeEventListener(type, fn) {
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].type === type && listeners[i].fn === fn) listeners.splice(i, 1);
      }
    },
    dispatch(type, detail) {
      for (const l of listeners.slice()) { if (l.type === type) l.fn({ type: type, detail: detail }); }
    },
    live(type) { return listeners.filter((l) => l.type === type).length; },
  };
}

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function fakeClock() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { fn: fn, ms: ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
  };
}

const FRAGMENT = { fragment: true };

/** The smallest React that can answer "is the needle on the screen". */
function makeReact() {
  return {
    Fragment: FRAGMENT,
    createElement(type, p, ...kids) {
      const flat = [];
      const push = (k) => {
        if (Array.isArray(k)) { k.forEach(push); return; }
        if (k === null || k === undefined || k === false || k === true) return;
        flat.push(k);
      };
      kids.forEach(push);
      return { type: type, props: p || {}, children: flat };
    },
  };
}

function nodesOf(node) {
  if (node === null || node === undefined || node === false || node === true) return [];
  if (typeof node !== 'object') return [{ tag: '#text', text: String(node), children: [] }];
  if (Array.isArray(node)) return node.reduce((a, n) => a.concat(nodesOf(n)), []);
  const kids = (node.children || []).reduce((a, n) => a.concat(nodesOf(n)), []);
  if (node.type === FRAGMENT || typeof node.type === 'function') return kids;
  return [{ tag: typeof node.type === 'string' ? node.type : '#component', props: node.props, children: kids }];
}
function flatten(list) {
  return list.reduce((a, n) => a.concat([n], flatten(n.children || [])), []);
}
function textOf(list) {
  return list.map((x) => (x.tag === '#text' ? x.text : textOf(x.children || []))).join('');
}

/**
 * One mounted panel over one fake shell. It keeps the position in state exactly as PrayerSheet
 * does, so `onLoc` moves the same prop the real sheet moves.
 */
function visit(harnessSrc, world) {
  const env = {
    window: world.win,
    navigator: {},
    localStorage: world.storage,
    setTimeout: world.clock.setTimeout,
    clearTimeout: world.clock.clearTimeout,
    React: makeReact(),
    s: new Proxy({}, { get: () => ({}) }),
    EzShellGroup: function EzShellGroup(props) { return props.children; },
  };
  const cells = [];
  const teardowns = [];
  let cursor = 0;
  let tree = null;
  // 🔴 THE SHELL ANSWERS SYNCHRONOUSLY HERE, and that is not an artefact -- the real bridge
  // dispatches a window event, and a listener registered inside the mount effect can be reached
  // before that effect returns. So a state setter may fire WHILE a render is in flight. React
  // batches that; this harness must too, or the hook cursor is reset in the middle of a render
  // and every cell after it belongs to the wrong hook.
  let rendering = false;
  let dirty = false;
  const bump = () => { if (rendering) { dirty = true; return; } render(); };
  env.useState = (init) => {
    const i = cursor++;
    if (!cells[i]) cells[i] = { v: typeof init === 'function' ? init() : init };
    const cell = cells[i];
    return [cell.v, (nv) => { cell.v = typeof nv === 'function' ? nv(cell.v) : nv; bump(); }];
  };
  env.useRef = (init) => {
    const i = cursor++;
    if (!cells[i]) cells[i] = { current: init };
    return cells[i];
  };
  env.useEffect = (fn) => {
    const i = cursor++;
    if (cells[i]) return;                      // deps [] -- one mount per visit, which is the point
    cells[i] = { effect: true };
    const t = fn();
    if (typeof t === 'function') teardowns.push(t);
  };
  world.win.ReactNativeWebView = world.shell.bridge;
  const mod = new Function('env', compile(harnessSrc))(env);
  let loc = mod.readQiblaLoc();
  function render() {
    let guard = 0;
    do {
      dirty = false;
      rendering = true;
      cursor = 0;
      try { tree = mod.QiblaPanel({ loc: loc, onLoc: (v) => { loc = v; bump(); } }); }
      finally { rendering = false; }
      guard += 1;
      if (guard > 20) throw new Error('the panel did not settle after 20 renders');
    } while (dirty);
  }
  render();
  return {
    mod: mod,
    nodes: () => flatten(nodesOf(tree)),
    dial: function () { return this.nodes().filter((n) => n.tag === 'svg').length; },
    note: function () { return textOf(nodesOf(tree)); },
    button: function (label) {
      return this.nodes().filter((n) => n.tag === 'button' && textOf(n.children || []) === label)[0];
    },
    unmount: () => { for (const t of teardowns) t(); },
  };
}

/** A fresh device: one window, one storage, one shell, one clock -- shared across its visits. */
function device() {
  const win = fakeWindow();
  return { win: win, storage: fakeStorage(), shell: fakeShell(win), clock: fakeClock() };
}

// ---------------------------------------------------------------------------
// THE CASES.
// ---------------------------------------------------------------------------
const results = [];
function run(name, fn) {
  try { results.push({ name: name, ok: true, detail: fn() || '' }); }
  catch (e) { results.push({ name: name, ok: false, detail: e.message }); }
}
function is(cond, what) { if (!cond) throw new Error(what); }
function eq(a, b, what) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(what + ': got ' + x + ', wanted ' + y);
}

run('the lift found the panel and the one line this round added', () => {
  is(REARM_FOUND, 'QiblaPanel carries no retryShellHeading() call inside the location result -- '
    + 'either the fix is gone or it was renamed, and this probe is measuring nothing');
  is(HARNESS_BEFORE_JSX !== HARNESS_JSX, 'the pre-fix lift is byte-identical to the fixed one');
  return 'QiblaPanel@' + startLine(FN_PANEL) + ', ' + CONSTS.length + ' constants and '
    + FUNCS.length + ' functions lifted; the pre-fix panel differs by '
    + (PANEL_TEXT.length - PANEL_BEFORE.length) + ' bytes';
});

run('THE FIRST VISIT, AS IT SHIPS: the needle is drawn without leaving the screen', () => {
  const dev = device();
  const v = visit(HARNESS_JSX, dev);
  // The mount asks, and the shell refuses -- because nothing has granted the location permission.
  eq(v.dial(), 0, 'dials drawn before the permission exists');
  is(v.note().indexOf(v.mod.QIBLA_COMPASS_PERMISSION_DENIED) !== -1,
    'the panel is not reporting the refusal it was given');
  // The reader presses the panel's own location button, which is the gesture that grants it.
  const btn = v.button(v.mod.QIBLA_USE_DEVICE);
  is(!!btn, 'the location button is not on the screen to be pressed');
  btn.props.onClick();
  is(dev.shell.isGranted(), 'the press did not reach the shell');
  // AND THE NEEDLE IS THERE -- on the same visit, with no unmount between.
  eq(v.dial(), 1, 'dials drawn after the permission was granted, on the same visit');
  is(v.note().indexOf(v.mod.QIBLA_COMPASS_LIVE) !== -1, 'the panel is not reporting a live compass');
  return 'first visit: 0 dials before the grant, 1 after it, 0 unmounts';
});

run('THE CONTROL -- the tree as it stood before this round draws nothing on the first visit', () => {
  const dev = device();
  const v = visit(HARNESS_BEFORE_JSX, dev);
  eq(v.dial(), 0, 'dials drawn by the pre-fix panel before the permission exists');
  const btn = v.button(v.mod.QIBLA_USE_DEVICE);
  is(!!btn, 'the location button is not on the pre-fix screen');
  btn.props.onClick();
  is(dev.shell.isGranted(), 'the press did not reach the shell');
  // 🔴 THIS IS THE BUG, REPRODUCED. The permission is now granted and the position is stored, and
  // the panel still shows the refusal it was handed before the press, with no dial and no control.
  eq(v.dial(), 0, 'THE PROBE CANNOT GO RED: the pre-fix panel drew a dial on the first visit');
  is(v.note().indexOf(v.mod.QIBLA_COMPASS_PERMISSION_DENIED) !== -1,
    'the pre-fix panel is not still showing the refusal');

  // ...AND THE SECOND VISIT WORKS, which is exactly what the owner saw. Leaving the screen and
  // coming back is a new mount, and a new mount is the only second start the panel had.
  v.unmount();
  const again = visit(HARNESS_BEFORE_JSX, dev);
  eq(again.dial(), 1, 'the second visit drew no dial either -- the reproduction is wrong');
  return 'pre-fix: 0 dials on the first visit, 1 on the second -- the reported behaviour exactly';
});

run('a refusal is still a refusal: declining the position asks for no heading', () => {
  // The reader says no. Nothing is granted, nothing is re-armed, and the panel says the one line
  // it has always said -- this is the case that stops the fix from becoming a nag.
  const win = fakeWindow();
  const shell = {
    bridge: {
      postMessage: (raw) => {
        const msg = JSON.parse(raw);
        shell.sent.push(msg.type);
        if (msg.type === 'ezik:heading:start') {
          win.dispatch('ezik:heading:result',
            { type: 'ezik:heading:result', ok: false, status: 'permission-denied', trueHeading: null, magHeading: null, accuracy: null, error: 'permission-denied' });
        }
        if (msg.type === 'ezik:location:request') {
          win.dispatch('ezik:location:result',
            { type: 'ezik:location:result', ok: false, lat: null, lon: null, source: null, error: 'denied' });
        }
      },
    },
    sent: [],
    isGranted: () => false,
  };
  const dev = { win: win, storage: fakeStorage(), shell: shell, clock: fakeClock() };
  const v = visit(HARNESS_JSX, dev);
  const startsBefore = shell.sent.filter((t) => t === 'ezik:heading:start').length;
  v.button(v.mod.QIBLA_USE_DEVICE).props.onClick();
  const startsAfter = shell.sent.filter((t) => t === 'ezik:heading:start').length;
  eq(startsAfter, startsBefore, 'heading starts sent after the reader refused the position');
  eq(v.dial(), 0, 'dials drawn after a refusal');
  return '1 start at mount, 0 after a refusal, 0 dials';
});

// ---------------------------------------------------------------------------
// REPORT.
// ---------------------------------------------------------------------------
console.log('=== the web/shell seam -- the qibla panel, mounted ===');
console.log('source:  app.jsx  ' + Buffer.byteLength(source, 'utf8') + ' bytes, '
  + source.split('\n').length + ' lines');
console.log('lifted:  QiblaPanel@' + startLine(FN_PANEL) + '  (' + CONSTS.length + ' constants, '
  + FUNCS.length + ' functions)');
console.log('');
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? '[PASS] ' : '[FAIL] ') + r.name);
  if (r.detail) console.log('        ' + r.detail);
}
console.log('');
console.log('=== ' + (results.length - failed) + '/' + results.length + ' cases hold ===');
if (failed) {
  console.log('-- FAILURES --');
  for (const r of results) { if (!r.ok) console.log('   * ' + r.name + ': ' + r.detail); }
}
process.exit(failed ? 1 : 0);
