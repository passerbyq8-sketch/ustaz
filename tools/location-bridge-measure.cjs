// location-bridge-measure.cjs -- the location seam, proved without a browser and without a phone.
//
// WHAT THIS MEASURES AND WHY IT CAN. The web half of the location handshake is four things: a
// detector for the shell's injected bridge, a one-shot listener, the single place where the
// shell's `lon` becomes this file's `lng`, and a deadline the web owns because the shell keeps
// none. Not one of those needs a DOM, a device, a sensor or a network -- they need a window with
// addEventListener on it, a navigator, a clock and a localStorage. So this tool builds those four
// as fakes it fully controls, lifts the REAL source of the seam out of app.jsx, and runs it.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every function below is extracted from app.jsx by
// name through @babel/parser -- the same parser the babel gate and tools/build-app.cjs use -- and
// evaluated verbatim. A hand-copied duplicate would drift from the file within a commit and would
// then be proving something nobody ships. If a name is renamed or a function deleted, extraction
// throws and this tool fails loudly rather than quietly measuring an older idea of the code.
//
// THE FAKES THROW WHERE THROWING IS THE POINT. navigator.geolocation on the shell path, and the
// bridge on the browser path, are not counted -- they are booby-trapped. A counter asserted to be
// zero still passes when the call is made and the count is read wrong; a fake that throws cannot.
//
// THE COORDINATES ARE CHOSEN TO EXPOSE A SWAP. lat 21.42 and lon 39.83 are two plainly different
// numbers, so writeQiblaLoc(lat, lng) called in the wrong order is a visible failure rather than
// a pair of interchangeable values that pass either way. That matters more than usual here: the
// shell says `lon`, this file says `lng`, and a rename is exactly where an argument order flips.
//
// Usage:  node tools/location-bridge-measure.cjs
// Exit:   0 when every case holds; 1 with the failing cases named.
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'app.jsx');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));

const source = fs.readFileSync(SRC, 'utf8');
const ast = parser.parse(source, { sourceType: 'script', plugins: ['jsx'] });

// ---------------------------------------------------------------------------
// EXTRACTION -- by name, from the parsed file, verbatim.
// ---------------------------------------------------------------------------
const text = (node) => source.slice(node.start, node.end);
const startLine = (node) => node.loc.start.line;
const endLine = (node) => node.loc.end.line;

function walk(node, visit, parent) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments'
      || key === 'innerComments') continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const c of v) { if (c && typeof c.type === 'string') walk(c, visit, node); }
    } else if (v && typeof v.type === 'string') {
      walk(v, visit, node);
    }
  }
}

/** The top-level `function NAME(...)`, or throw. */
function topFunction(name) {
  for (const n of ast.program.body) {
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) return n;
  }
  throw new Error('app.jsx no longer declares function ' + name + '() at the top level');
}

/** The whole top-level `const NAME = ...;` statement, or throw. */
function topConst(name) {
  for (const n of ast.program.body) {
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier' && d.id.name === name) return n;
    }
  }
  throw new Error('app.jsx no longer declares the top-level constant ' + name);
}

/** A `const NAME = ...` declarator sitting inside the body of function OWNER, or throw. */
function innerConst(ownerName, name) {
  const owner = topFunction(ownerName);
  let found = null;
  walk(owner, (n) => {
    if (n.type !== 'VariableDeclarator') return;
    if (n.id.type === 'Identifier' && n.id.name === name) found = n;
  });
  if (!found) throw new Error(ownerName + '() no longer declares ' + name);
  return found;
}

const FN_BRIDGE = topFunction('ezikShellBridge');
const FN_COORDS = topFunction('shellLocResultCoords');
const FN_READ = topFunction('readQiblaLoc');
const FN_WRITE = topFunction('writeQiblaLoc');
const C_KEY = topConst('QIBLA_LOC_KEY');
const C_DEF_LAT = topConst('QIBLA_DEFAULT_LAT');
const C_DEF_LNG = topConst('QIBLA_DEFAULT_LNG');
const C_REQ = topConst('SHELL_LOC_REQUEST');
const C_RES = topConst('SHELL_LOC_RESULT');
const C_TMO = topConst('SHELL_LOC_TIMEOUT_MS');
const V_ASK = innerConst('QiblaPanel', 'askLocation');
const V_VIA = innerConst('QiblaPanel', 'askLocationViaShell');
const FN_HEADING = topFunction('shellHeadingOf');
const FN_HEADING_SEND = topFunction('sendShellHeadingCommand');
const C_HEADING_START = topConst('SHELL_HEADING_START');
const C_HEADING_STOP = topConst('SHELL_HEADING_STOP');
const C_HEADING_RESULT = topConst('SHELL_HEADING_RESULT');
const C_HEADING_STATUSES = topConst('SHELL_HEADING_STATUSES');
const V_HEADING_RESULT = innerConst('QiblaPanel', 'onHeadingResult');
const V_HEADING_RETRY = innerConst('QiblaPanel', 'retryShellHeading');
const V_BROWSER_COMPASS = innerConst('QiblaPanel', 'startCompass');
const FN_QIBLA_PANEL = topFunction('QiblaPanel');

const HEADING_UI_NAMES = [
  'QIBLA_COMPASS_LIVE',
  'QIBLA_COMPASS_CALIBRATION',
  'QIBLA_COMPASS_SENSOR_UNAVAILABLE',
  'QIBLA_COMPASS_PERMISSION_DENIED',
  'QIBLA_COMPASS_HEADING_ERROR',
];
const HEADING_UI_CONSTS = HEADING_UI_NAMES.map((name) => topConst(name));

// The real writeQiblaLoc is WRAPPED rather than replaced. The recorder proves the argument order;
// the real body underneath proves the value actually lands in storage in a shape readQiblaLoc
// will accept back. A recorder on its own would pass on a write that never landed.
const HARNESS = [
  '"use strict";',
  'const window = env.window;',
  'const navigator = env.navigator;',
  'const localStorage = env.localStorage;',
  'const setTimeout = env.setTimeout;',
  'const clearTimeout = env.clearTimeout;',
  'const locStopRef = env.locStopRef;',
  'const setLoc = env.setLoc;',
  'const setLocState = env.setLocState;',
  text(C_KEY),
  text(C_DEF_LAT),
  text(C_DEF_LNG),
  text(FN_READ),
  text(FN_WRITE).replace('function writeQiblaLoc(', 'function writeQiblaLocReal('),
  'function writeQiblaLoc(lat, lng) { env.writes.push([lat, lng]); return writeQiblaLocReal(lat, lng); }',
  text(FN_BRIDGE),
  text(C_REQ),
  text(C_RES),
  text(C_TMO),
  text(FN_COORDS),
  'const ' + text(V_VIA) + ';',
  'const ' + text(V_ASK) + ';',
  'return { askLocation: askLocation, readQiblaLoc: readQiblaLoc,',
  '  SHELL_LOC_REQUEST: SHELL_LOC_REQUEST, SHELL_LOC_RESULT: SHELL_LOC_RESULT,',
  '  SHELL_LOC_TIMEOUT_MS: SHELL_LOC_TIMEOUT_MS };',
].join('\n');

const makeHarness = new Function('env', HARNESS);

// The heading helpers and the real event handler need no React renderer. State setters are
// recorders, the bridge is injected, and the exact functions are lifted from app.jsx.
const HEADING_HARNESS = [
  '"use strict";',
  text(C_HEADING_START),
  text(C_HEADING_STOP),
  text(C_HEADING_RESULT),
  text(C_HEADING_STATUSES),
  text(FN_HEADING),
  text(FN_HEADING_SEND),
  'return { shellHeadingOf: shellHeadingOf, sendShellHeadingCommand: sendShellHeadingCommand,',
  '  SHELL_HEADING_START: SHELL_HEADING_START, SHELL_HEADING_STOP: SHELL_HEADING_STOP,',
  '  SHELL_HEADING_RESULT: SHELL_HEADING_RESULT, SHELL_HEADING_STATUSES: SHELL_HEADING_STATUSES };',
].join('\n');
const makeHeadingHarness = new Function(HEADING_HARNESS);
const headingHarness = makeHeadingHarness();

const HEADING_EVENT_HARNESS = [
  '"use strict";',
  'const setHeading = env.setHeading;',
  'const setCompass = env.setCompass;',
  text(C_HEADING_RESULT),
  text(C_HEADING_STATUSES),
  text(FN_HEADING),
  'const ' + text(V_HEADING_RESULT) + ';',
  'return onHeadingResult;',
].join('\n');
const makeHeadingEventHandler = new Function('env', HEADING_EVENT_HARNESS);

const HEADING_UI_HARNESS = HEADING_UI_CONSTS.map((node) => text(node)).concat([
  'return [' + HEADING_UI_NAMES.join(', ') + '];',
]).join('\n');
const headingUiTexts = new Function(HEADING_UI_HARNESS)();

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

/**
 * A window with a real listener registry, so "is a listener still attached" is a fact this tool
 * reads rather than a thing it assumes.
 */
function fakeWindow(bridge) {
  const listeners = [];
  const w = {
    addEventListener(type, fn) { listeners.push({ type: type, fn: fn }); },
    removeEventListener(type, fn) {
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].type === type && listeners[i].fn === fn) listeners.splice(i, 1);
      }
    },
    // What the shell does: a window event of the agreed name, payload in .detail.
    dispatch(type, detail) {
      const snapshot = listeners.slice();
      for (const l of snapshot) { if (l.type === type) l.fn({ type: type, detail: detail }); }
    },
    live(type) { return listeners.filter((l) => l.type === type).length; },
  };
  if (bridge) w.ReactNativeWebView = bridge;
  return w;
}

function recordingBridge(sent) { return { postMessage: (s) => { sent.push(s); } }; }
function throwingBridge() {
  return { postMessage: () => { throw new Error('the bridge refused the message'); } };
}
function trapBridge(label) {
  return {
    postMessage: () => {
      throw new Error('FORBIDDEN: ' + label + ' posted through the shell bridge');
    },
  };
}
function recordingGeo(calls) {
  return { getCurrentPosition: (ok, fail, opts) => { calls.push({ ok: ok, fail: fail, opts: opts }); } };
}
function trapGeo(label) {
  return {
    getCurrentPosition: () => {
      throw new Error('FORBIDDEN: ' + label + ' called navigator.geolocation');
    },
  };
}

/** localStorage, in a Map. */
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** A clock the test drives, so a 10000 ms deadline costs no wall-clock at all. */
function fakeClock() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { fn: fn, ms: ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    delays: () => Array.from(timers.values()).map((t) => t.ms),
    fireAll: () => {
      const all = Array.from(timers.values());
      timers.clear();
      for (const t of all) t.fn();
    },
  };
}

/** One press-ready harness plus everything needed to inspect what the press did. */
function scene(opts) {
  const o = opts || {};
  const sent = [];
  const geoCalls = [];
  const states = [];
  const locs = [];
  const writes = [];
  const clock = fakeClock();

  let bridge = null;
  if (o.shell === 'recording') bridge = recordingBridge(sent);
  else if (o.shell === 'throwing') bridge = throwingBridge();
  else if (o.shell === 'trap') bridge = trapBridge(o.label || 'this path');

  const win = fakeWindow(bridge);
  const nav = o.geo === 'trap' ? { geolocation: trapGeo(o.label || 'this path') }
    : o.geo === 'none' ? {}
      : { geolocation: recordingGeo(geoCalls) };

  const env = {
    window: win,
    navigator: nav,
    localStorage: fakeStorage(),
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    locStopRef: { current: null },
    setLoc: (v) => { locs.push(v); },
    setLocState: (v) => { states.push(v); },
    writes: writes,
  };
  return {
    h: makeHarness(env), env: env, win: win, clock: clock,
    sent: sent, geoCalls: geoCalls, states: states, locs: locs, writes: writes,
  };
}

// ---------------------------------------------------------------------------
// THE CASES.
// ---------------------------------------------------------------------------
const results = [];
function run(name, fn) {
  try { results.push({ name: name, ok: true, detail: fn() || '' }); }
  catch (e) { results.push({ name: name, ok: false, detail: e.message }); }
}
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': got ' + a + ', wanted ' + b);
}
function is(cond, what) { if (!cond) throw new Error(what); }

const LAT = 21.42;   // two plainly different numbers, so a swap cannot pass unnoticed
const LON = 39.83;
const okResult = () => ({
  type: 'ezik:location:result', ok: true, lat: LAT, lon: LON, source: 'last-known', error: null,
});
const headingResult = (status, overrides) => Object.assign({
  type: 'ezik:heading:result',
  ok: status === 'ready',
  status: status,
  magHeading: status === 'ready' || status === 'calibration-needed' ? 230 : null,
  trueHeading: status === 'ready' || status === 'calibration-needed' ? 224 : null,
  accuracy: status === 'ready' ? 3 : status === 'calibration-needed' ? 1 : null,
  error: status === 'ready' || status === 'calibration-needed' ? null : status,
}, overrides || {});

run('shell present: one request posted, and geolocation is never touched', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  eq(s.sent.length, 1, 'messages posted through the bridge');
  const msg = JSON.parse(s.sent[0]);
  eq(msg, { type: 'ezik:location:request' }, 'the posted message');
  eq(Object.keys(msg).length, 1, 'keys on the posted message');
  eq(s.states, ['asking'], 'locState after the press');
  eq(s.win.live('ezik:location:result'), 1, 'listeners waiting for the result');
  eq(s.clock.delays(), [10000], 'the deadline the web set, in ms');
  return '1 message, 0 geolocation calls, 1 listener, deadline 10000ms';
});

run('shell absent: geolocation exactly as before, and nothing is posted', () => {
  const s = scene({ shell: null, geo: 'recording', label: 'the browser path' });
  s.h.askLocation();
  eq(s.geoCalls.length, 1, 'getCurrentPosition calls');
  eq(s.sent.length, 0, 'messages posted through the bridge');
  eq(s.win.live('ezik:location:result'), 0, 'listeners waiting for the result');
  eq(s.clock.pending(), 0, 'timers the web owns on this path');
  eq(s.geoCalls[0].opts, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    'the options handed to getCurrentPosition');
  eq(s.states, ['asking'], 'locState after the press');
  // And the browser callbacks still do what they did.
  s.geoCalls[0].ok({ coords: { latitude: LAT, longitude: LON } });
  eq(s.writes, [[LAT, LON]], 'the browser path arguments to writeQiblaLoc');
  eq(s.states, ['asking', ''], 'locState after the browser answered');
  return '1 geolocation call, 0 messages, options unchanged, browser write intact';
});

run('shell absent and geolocation missing: denied, exactly as today', () => {
  const s = scene({ shell: null, geo: 'none' });
  s.h.askLocation();
  eq(s.states, ['denied'], 'locState');
  eq(s.sent.length, 0, 'messages posted');
  return 'denied, 0 messages';
});

run('ok:true: writeQiblaLoc(lat, lng) in that order, lon renamed exactly once', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  s.win.dispatch('ezik:location:result', okResult());
  eq(s.writes, [[LAT, LON]], 'the arguments writeQiblaLoc received');
  is(s.writes[0][0] !== LON, 'lat and lng arrived swapped');
  eq(s.locs, [{ lat: LAT, lng: LON, by: 'device' }], 'the position handed to setLoc');
  eq(s.h.readQiblaLoc(), { lat: LAT, lng: LON, by: 'device' }, 'the position read back from storage');
  eq(s.states, ['asking', ''], 'locState across the press');
  eq(s.win.live('ezik:location:result'), 0, 'listeners left after the result');
  eq(s.clock.pending(), 0, 'timers left after the result');
  return 'wrote (' + LAT + ', ' + LON + '), read back by:device, 0 listeners left';
});

run('the two decimals the shell sent are the two decimals stored', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  s.win.dispatch('ezik:location:result', okResult());
  const back = s.h.readQiblaLoc();
  eq(back.lat, LAT, 'stored latitude');
  eq(back.lng, LON, 'stored longitude');
  is(String(back.lat) === '21.42' && String(back.lng) === '39.83',
    'a coordinate was rounded a second time on the way in');
  return 'in 21.42/39.83, out 21.42/39.83 -- no second rounding';
});

run('ok:false: denied, nothing written, nothing thrown', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  s.win.dispatch('ezik:location:result', {
    type: 'ezik:location:result', ok: false, lat: null, lon: null, source: null,
    error: 'permission-denied',
  });
  eq(s.writes, [], 'writes on a refusal');
  eq(s.locs, [], 'setLoc calls on a refusal');
  eq(s.states, ['asking', 'denied'], 'locState across the press');
  eq(s.win.live('ezik:location:result'), 0, 'listeners left after the refusal');
  eq(s.clock.pending(), 0, 'timers left after the refusal');
  eq(s.h.readQiblaLoc().by, 'default', 'the position after a refusal');
  return 'denied, 0 writes, 0 listeners left, default position standing';
});

run('the other two refusals the shell can send are answered the same way', () => {
  for (const err of ['no-position', 'location-error: kCLErrorDomain 1']) {
    const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
    s.h.askLocation();
    s.win.dispatch('ezik:location:result', {
      type: 'ezik:location:result', ok: false, lat: null, lon: null, source: null, error: err,
    });
    eq(s.states, ['asking', 'denied'], 'locState for ' + err);
    eq(s.writes, [], 'writes for ' + err);
  }
  return '2 further refusals, both denied, 0 writes';
});

run('the deadline passes, then the answer arrives: denied, and it writes nothing', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  s.clock.fireAll();                       // the 10000 ms the web owns runs out
  eq(s.states, ['asking', 'denied'], 'locState at the deadline');
  eq(s.win.live('ezik:location:result'), 0, 'listeners left at the deadline');
  // The shell answers anyway, late. Nobody is listening, so nothing lands.
  s.win.dispatch('ezik:location:result', okResult());
  eq(s.writes, [], 'writes from the late answer');
  eq(s.locs, [], 'setLoc calls from the late answer');
  eq(s.states, ['asking', 'denied'], 'locState after the late answer');
  eq(s.h.readQiblaLoc().by, 'default', 'the position after the late answer');
  return 'denied at 10000ms, late answer wrote nothing';
});

run('two presses in a row: one listener at a time, none left at the end', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  eq(s.win.live('ezik:location:result'), 1, 'listeners after the first press');
  eq(s.clock.pending(), 1, 'timers after the first press');
  s.h.askLocation();
  eq(s.win.live('ezik:location:result'), 1, 'listeners after the second press');
  eq(s.clock.pending(), 1, 'timers after the second press');
  eq(s.sent.length, 2, 'messages posted across two presses');
  s.win.dispatch('ezik:location:result', okResult());
  eq(s.win.live('ezik:location:result'), 0, 'listeners after both presses finished');
  eq(s.clock.pending(), 0, 'timers after both presses finished');
  eq(s.writes, [[LAT, LON]], 'writes across two presses');
  return '1 listener at a time, 0 left, 1 write from 2 presses';
});

run('the first press cannot be answered after the second replaced it', () => {
  // A stale answer to press one must not resurrect press one's handler.
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  s.h.askLocation();
  s.clock.fireAll();                       // press two's deadline; press one's is already cleared
  eq(s.states, ['asking', 'asking', 'denied'], 'locState across two presses and one deadline');
  eq(s.win.live('ezik:location:result'), 0, 'listeners left');
  s.win.dispatch('ezik:location:result', okResult());
  eq(s.writes, [], 'writes after both presses closed');
  return '1 deadline fired, not 2; 0 writes afterwards';
});

run('unmount during a press: the detach is reachable, and it detaches', () => {
  const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  is(typeof s.env.locStopRef.current === 'function', 'no detach was parked for unmount to call');
  s.env.locStopRef.current();              // exactly what the unmount effect calls
  eq(s.win.live('ezik:location:result'), 0, 'listeners left after unmount');
  eq(s.clock.pending(), 0, 'timers left after unmount');
  s.win.dispatch('ezik:location:result', okResult());
  eq(s.writes, [], 'writes after unmount');
  return '0 listeners, 0 timers, 0 writes after unmount';
});

run('a malformed answer is answered like a refusal, not like a crash', () => {
  const bad = [
    null,
    undefined,
    {},
    { type: 'ezik:location:result', ok: true, lat: '21.42', lon: LON },   // strings are not numbers
    { type: 'ezik:location:result', ok: true, lat: LAT, lon: null },
    { type: 'ezik:location:result', ok: true, lat: LAT, lng: LON },       // web vocabulary, not the shell's
    { type: 'something:else', ok: true, lat: LAT, lon: LON },             // right event, wrong type field
    { type: 'ezik:location:result', ok: true, lat: LAT, lon: Infinity },
    { type: 'ezik:location:result', ok: 'true', lat: LAT, lon: LON },     // truthy is not true
  ];
  for (const d of bad) {
    const s = scene({ shell: 'recording', geo: 'trap', label: 'the shell path' });
    s.h.askLocation();
    s.win.dispatch('ezik:location:result', d);
    eq(s.writes, [], 'writes for ' + JSON.stringify(d));
    eq(s.states, ['asking', 'denied'], 'locState for ' + JSON.stringify(d));
    eq(s.win.live('ezik:location:result'), 0, 'listeners left for ' + JSON.stringify(d));
  }
  return bad.length + ' malformed answers, all denied, 0 writes, 0 listeners left';
});

run('a bridge whose postMessage throws ends in denied, not in a stuck button', () => {
  const s = scene({ shell: 'throwing', geo: 'trap', label: 'the shell path' });
  s.h.askLocation();
  eq(s.states, ['asking', 'denied'], 'locState when the bridge throws');
  eq(s.win.live('ezik:location:result'), 0, 'listeners left when the bridge throws');
  eq(s.clock.pending(), 0, 'timers left when the bridge throws');
  return 'denied, nothing left attached';
});

run('the detector reads the bridge, never the user agent', () => {
  // A page carrying a shell-shaped user agent but no bridge must take the browser path.
  const s = scene({ shell: null, geo: 'recording', label: 'the browser path' });
  s.env.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14; wv) ReactNative ezik-shell';
  s.h.askLocation();
  eq(s.geoCalls.length, 1, 'getCurrentPosition calls for a UA-only "shell"');
  eq(s.sent.length, 0, 'messages posted for a UA-only "shell"');
  // And an object that is not a bridge is not a bridge, however shell-shaped its name.
  for (const shape of [{ postMessage: 'not a function' }, {}, { postMessage: null }]) {
    const s2 = scene({ shell: null, geo: 'recording', label: 'the browser path' });
    s2.win.ReactNativeWebView = shape;
    s2.h.askLocation();
    eq(s2.geoCalls.length, 1, 'getCurrentPosition calls for ' + JSON.stringify(shape));
  }
  const ua = /navigator\s*\.\s*userAgent/;
  is(!ua.test(text(FN_BRIDGE)) && !ua.test(text(V_ASK)) && !ua.test(text(V_VIA)),
    'the location path reads navigator.userAgent somewhere');
  return '0 userAgent reads on the whole path; 3 non-bridges rejected';
});

// ---------------------------------------------------------------------------
// HEADING -- the stream handshake and five shell statuses, without a browser or phone.
// ---------------------------------------------------------------------------
run('heading commands are the two one-field messages, and no bridge means no message', () => {
  const sent = [];
  const bridge = recordingBridge(sent);
  is(headingHarness.sendShellHeadingCommand(bridge, headingHarness.SHELL_HEADING_START),
    'the start command was refused');
  is(headingHarness.sendShellHeadingCommand(bridge, headingHarness.SHELL_HEADING_STOP),
    'the stop command was refused');
  eq(sent.map((raw) => JSON.parse(raw)), [
    { type: 'ezik:heading:start' },
    { type: 'ezik:heading:stop' },
  ], 'heading commands posted');
  const before = sent.length;
  is(!headingHarness.sendShellHeadingCommand(null, headingHarness.SHELL_HEADING_START),
    'an absent bridge claimed to send start');
  is(!headingHarness.sendShellHeadingCommand(bridge, 'ezik:heading:other'),
    'an unknown heading command was accepted');
  eq(sent.length, before, 'messages added by absent bridge or unknown command');
  is(!headingHarness.sendShellHeadingCommand(throwingBridge(), headingHarness.SHELL_HEADING_START),
    'a throwing bridge claimed success');
  return 'start + stop exact; absent/throwing bridge and unknown command send nothing';
});

run('true north wins, -1 falls back to magnetic, and accuracy never classifies in the web', () => {
  eq(headingHarness.shellHeadingOf(headingResult('ready', {
    trueHeading: 17, magHeading: 231, accuracy: 0,
  })), 17, 'valid true heading');
  eq(headingHarness.shellHeadingOf(headingResult('ready', {
    trueHeading: -1, magHeading: 231, accuracy: 3,
  })), 231, 'magnetic fallback for trueHeading -1');
  eq(headingHarness.shellHeadingOf(headingResult('calibration-needed', {
    trueHeading: 360, magHeading: 40, accuracy: 3,
  })), 0, 'normalised true heading');
  eq(headingHarness.shellHeadingOf(headingResult('ready', {
    trueHeading: NaN, magHeading: Infinity,
  })), null, 'two invalid headings');
  eq(headingHarness.shellHeadingOf({ type: 'something:else', trueHeading: 17, magHeading: 20 }),
    null, 'wrong result type');
  is(text(FN_HEADING).indexOf('accuracy') === -1,
    'shellHeadingOf reads accuracy even though the shell owns calibration');
  return 'true 17; -1 -> magnetic 231; 360 -> 0; no accuracy read';
});

run('all five shell statuses remain distinct, and status -- not accuracy -- is the judgment', () => {
  const cases = [
    ['ready', headingResult('ready', { accuracy: 0 }), [224], ['ready']],
    ['calibration-needed', headingResult('calibration-needed', { accuracy: 3 }), [224], ['calibration-needed']],
    ['sensor-unavailable', headingResult('sensor-unavailable'), [null], ['sensor-unavailable']],
    ['permission-denied', headingResult('permission-denied'), [null], ['permission-denied']],
    ['heading-error', headingResult('heading-error'), [null], ['heading-error']],
  ];
  for (const c of cases) {
    const headings = [];
    const states = [];
    const onResult = makeHeadingEventHandler({
      setHeading: (v) => { headings.push(v); },
      setCompass: (v) => { states.push(v); },
    });
    onResult({ detail: c[1] });
    eq(headings, c[2], 'heading updates for ' + c[0]);
    eq(states, c[3], 'compass states for ' + c[0]);
  }
  is(text(V_HEADING_RESULT).indexOf('.status') !== -1, 'the result handler never reads status');
  is(text(V_HEADING_RESULT).indexOf('accuracy') === -1,
    'the result handler reclassifies from accuracy');
  eq(new Set(headingUiTexts).size, 5, 'distinct visible texts for the five shell statuses');
  is(headingUiTexts.every((s) => typeof s === 'string' && s.length > 20),
    'a shell status has no substantive visible text');
  return 'ready trusts accuracy 0; calibration trusts accuracy 3; 5 unique states and texts';
});

run('the panel owns one shell stream: start on mount, stop and detach on unmount, retry on error', () => {
  const panel = text(FN_QIBLA_PANEL);
  const effects = [];
  walk(FN_QIBLA_PANEL, (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'useEffect') {
      effects.push(text(n));
    }
  });
  eq(effects.length, 1, 'effects in QiblaPanel');
  const effect = effects[0];
  is(effect.indexOf('const bridge = headingBridgeRef.current || null') !== -1
    && effect.indexOf('if (bridge)') !== -1,
  'the heading effect is not guarded by the captured bridge');
  is(effect.indexOf('addEventListener(SHELL_HEADING_RESULT, onHeadingResult)') !== -1
    && effect.indexOf('sendShellHeadingCommand(bridge, SHELL_HEADING_START)') !== -1,
  'mount does not attach then start the heading stream');
  is(effect.indexOf('removeEventListener(SHELL_HEADING_RESULT, onHeadingResult)') !== -1
    && effect.indexOf('sendShellHeadingCommand(bridge, SHELL_HEADING_STOP)') !== -1,
  'unmount does not detach then stop the heading stream');
  const retry = text(V_HEADING_RETRY);
  is(retry.indexOf("setCompass('wait')") !== -1
    && retry.indexOf('sendShellHeadingCommand(bridge, SHELL_HEADING_START)') !== -1,
  'heading-error has no real retry command');
  is(panel.indexOf('onClick={retryShellHeading}') !== -1
    && panel.indexOf("compass === 'heading-error'") !== -1,
  'the retry command is not reachable from heading-error');
  return '1 effect; guarded attach/start; detach/stop; reachable retry';
});

run('no bridge keeps the existing DeviceOrientation path and never wraps it in shell failure prose', () => {
  const panel = text(FN_QIBLA_PANEL);
  const browser = text(V_BROWSER_COMPASS);
  is(browser.indexOf("addEventListener('deviceorientationabsolute', onEvent)") !== -1
    && browser.indexOf("addEventListener('deviceorientation', onEvent)") !== -1
    && browser.indexOf('DOE.requestPermission()') !== -1,
  'the existing browser orientation path is not intact');
  is(browser.indexOf('SHELL_HEADING_') === -1 && browser.indexOf('ezikShellBridge') === -1,
    'the browser orientation function was coupled to the shell');
  is(panel.indexOf("useState(headingBridgeRef.current ? 'wait' : 'off')") !== -1
    && panel.indexOf("compass === 'off' || compass === 'none'") !== -1
    && panel.indexOf('onClick={startCompass}') !== -1,
  'an absent bridge no longer reaches the old off/none button path');
  is(panel.indexOf('QIBLA_COMPASS_NONE') !== -1,
    'the existing browser failure sentence was removed');
  return 'DeviceOrientation + permission press intact; absent bridge starts off and keeps its button';
});

// ---------------------------------------------------------------------------
// SILENCE AT BOOT -- a static proof, because it is a static claim: the press is the only caller.
// ---------------------------------------------------------------------------
run('nothing on this path runs before the press', () => {
  const NAMES = ['askLocation', 'askLocationViaShell'];
  const askRange = [startLine(V_ASK), endLine(V_ASK)];
  const viaRange = [startLine(V_VIA), endLine(V_VIA)];
  const sites = [];
  walk(ast.program, (n, parent) => {
    if (n.type !== 'Identifier' || NAMES.indexOf(n.name) === -1) return;
    if (parent && parent.type === 'VariableDeclarator' && parent.id === n) return;   // its own name
    if (parent && parent.type === 'FunctionDeclaration' && parent.id === n) return;  // its own name
    sites.push({ name: n.name, line: startLine(n), parent: parent ? parent.type : '(root)' });
  });
  is(sites.length > 0, 'no reference sites found at all -- the extraction is measuring nothing');
  for (const st of sites) {
    const onButton = st.parent === 'JSXExpressionContainer';
    const insideAsk = st.line >= askRange[0] && st.line <= askRange[1];
    const insideVia = st.line >= viaRange[0] && st.line <= viaRange[1];
    is(onButton || insideAsk || insideVia,
      st.name + ' is referenced at app.jsx:' + st.line + ' from a ' + st.parent
      + ' -- neither the button nor the two functions behind it');
  }
  // And no effect anywhere in the file mentions either location function or request. The shared
  // bridge detector is deliberately allowed in the qibla heading effect added by item 108-b.
  let effectHit = null;
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression') return;
    if (!(n.callee.type === 'Identifier' && n.callee.name === 'useEffect')) return;
    const body = text(n);
    for (const nm of NAMES.concat(['SHELL_LOC_REQUEST', 'getCurrentPosition'])) {
      if (body.indexOf(nm) !== -1) effectHit = nm + ' inside a useEffect at app.jsx:' + startLine(n);
    }
  });
  is(!effectHit, 'a boot-time caller exists: ' + effectHit);
  return sites.length + ' location reference site(s), all inside the press or on the button: '
    + sites.map((x) => x.name + '@' + x.line + ':' + x.parent).join(', ');
});

run('the request is posted from one place, and the shell object is never passed on raw', () => {
  let posts = 0;
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression') return;
    if (n.callee.type !== 'MemberExpression') return;
    if (n.callee.property.name !== 'postMessage') return;
    if (text(n).indexOf('SHELL_LOC_REQUEST') !== -1) posts++;
  });
  eq(posts, 1, 'places that post the location request');
  // writeQiblaLoc is never handed a `.lon`, and `lon` is read in exactly one function.
  let lonReads = [];
  walk(ast.program, (n) => {
    if (n.type !== 'MemberExpression') return;
    if (n.property.type !== 'Identifier' || n.property.name !== 'lon') return;
    lonReads.push(startLine(n));
  });
  eq(lonReads.length, 1, 'places that read a `.lon`');
  is(lonReads[0] >= startLine(FN_COORDS) && lonReads[0] <= endLine(FN_COORDS),
    'the only `.lon` read is outside shellLocResultCoords, at app.jsx:' + lonReads[0]);
  return '1 post site, 1 `.lon` read at app.jsx:' + lonReads[0] + ' inside shellLocResultCoords';
});

// ---------------------------------------------------------------------------
// REPORT.
// ---------------------------------------------------------------------------
console.log('=== location bridge -- the web half, measured ===');
console.log('source:  app.jsx  ' + Buffer.byteLength(source, 'utf8') + ' bytes, '
  + source.split('\n').length + ' lines');
console.log('lifted:  ezikShellBridge@' + startLine(FN_BRIDGE)
  + '  shellLocResultCoords@' + startLine(FN_COORDS)
  + '  askLocationViaShell@' + startLine(V_VIA)
  + '  askLocation@' + startLine(V_ASK));
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
