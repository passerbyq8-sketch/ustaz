// auth-bridge-measure.cjs -- the sign-in seam, proved without a browser, a phone or a network.
//
// WHAT THIS MEASURES AND WHY IT CAN. The web half of the sign-in handshake is seven things: a
// detector for the shell's injected bridge, a client state minted per press, one builder that
// turns a URL into the four fields the shell validates, one poster, a one-shot listener matched
// on the request's own id, the sorting of the contract's five refusal reasons into three
// treatments, and the deliberate ABSENCE of a deadline. Not one of those needs a DOM, a device or
// a network -- they need a window with addEventListener on it, a source of random bytes, a clock
// this tool can watch without letting it run, and a fetch it controls. So this file builds those
// as fakes it fully owns, lifts the REAL source of the seam out of app.jsx, and runs it.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every function, every constant and the whole
// SettingsSheet row below is extracted from app.jsx by name through @babel/parser -- the same
// parser the babel gate and tools/build-app.cjs use -- and evaluated verbatim. Nothing here
// restates a contract word: `ezik:auth:request`, the string "1", the five reasons, the three
// classes and the origin are all read from their own declarations at run time. If a name is
// renamed or a function deleted, extraction throws and this tool fails loudly rather than quietly
// measuring an older idea of the code.
//
// THE SERVER HALF OF THIS SEAM IS NOT MEASURED HERE, DELIBERATELY. `cs` is worth nothing unless
// api/auth-start.js records it and api/auth-return.js hands it back, and Apple's form POST is
// worth nothing unless that route reads a body -- but those three files already have a gate that
// drives them against a fake provider and a fake store (tools/auth-server-measure.cjs), and a
// second half-built module loader beside it would be a second opinion about what they do rather
// than a second proof. Those cases live there, beside the harness that can run them; what lives
// here is what only app.jsx can answer.
//
// THE FAKES THROW WHERE THROWING IS THE POINT. The clock refuses to be ignored: a timer armed on
// this path is a countable fact, not an assertion about intent. And zero bytes are written to the
// tree -- no fixture, no temp directory, no key.
//
// AND IT CANNOT PASS BY DOING NOTHING. Six MUTANTS are compiled at the end from the same lifted
// source with one line changed each -- a deadline added, the id match removed, the version made a
// number, the client-state comparison dropped, `dismissed` made a red line, the button shown
// outside the shell -- and every one of them must be KILLED by a named case above. A tool that
// cannot go red proves nothing.
//
// Usage:  node tools/auth-bridge-measure.cjs
// Exit:   0 when every case holds and every mutant dies; 1 with the failures named.
'use strict';

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('node:crypto');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'app.jsx');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));
const babel = require(path.join(REPO, 'node_modules', '@babel', 'core'));
const PRESET_REACT = path.join(REPO, 'node_modules', '@babel', 'preset-react');

const source = fs.readFileSync(SRC, 'utf8');
const ast = parser.parse(source, { sourceType: 'script', plugins: ['jsx'] });

// ---------------------------------------------------------------------------
// EXTRACTION -- by name, from the parsed file, verbatim.
// ---------------------------------------------------------------------------
const text = (node) => source.slice(node.start, node.end);
const startLine = (node) => node.loc.start.line;

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

// The contract, the seam, the store and the row. Every one of them by name.
const C_I18N = topConst('EZ_I18N');
const C_FALLBACK = topConst('EZ_LANG_FALLBACK');
const FN_T = topFunction('ezT');
const C_REQ = topConst('SHELL_AUTH_REQUEST');
const C_RES = topConst('SHELL_AUTH_RESULT');
const C_V = topConst('SHELL_AUTH_V');
const C_ORIGIN = topConst('SHELL_AUTH_ORIGIN');
const C_START_PATH = topConst('SHELL_AUTH_START_PATH');
const C_EXCH_PATH = topConst('SHELL_AUTH_EXCHANGE_PATH');
const C_DELETE_PATH = topConst('SHELL_AUTH_DELETE_PATH');
const C_PROVIDER = topConst('SHELL_AUTH_PROVIDER');
const C_SCHEME = topConst('SHELL_AUTH_RETURN_SCHEME');
const C_QUIET = topConst('SHELL_AUTH_QUIET');
const C_FAULT = topConst('SHELL_AUTH_FAULT');
const C_RETRY = topConst('SHELL_AUTH_RETRY');
const C_CLASSES = topConst('SHELL_AUTH_CLASSES');
const C_LINES = topConst('SHELL_AUTH_LINES');
const C_OTHER = topConst('SHELL_AUTH_REASON_OTHER');
const FN_BRIDGE = topFunction('ezikAuthBridge');
const FN_REASON = topFunction('ezikAuthReason');
const FN_CLASS = topFunction('ezikAuthClass');
const FN_LINE = topFunction('ezikAuthLine');
const FN_CS = topFunction('ezikAuthClientState');
const C_SEQ = topConst('ezikAuthSeq');
const FN_ID = topFunction('ezikAuthId');
const FN_START_URL = topFunction('ezikAuthStartUrl');
const FN_MSG = topFunction('ezikAuthMessage');
const FN_ASK = topFunction('ezikAuthAsk');
const FN_PARAMS = topFunction('ezikAuthReturnParams');
const FN_EXCHANGE = topFunction('ezikAuthExchange');
const FN_DELETE = topFunction('ezikAuthDelete');
const C_SESSION_KEY = topConst('AUTH_SESSION_KEY');
const FN_READ_SESSION = topFunction('readAuthSession');
const FN_WRITE_SESSION = topFunction('writeAuthSession');
const FN_CLEAR_SESSION = topFunction('clearAuthSession');
// THE FIFTH CHANNEL AND THE FLAG THAT TAKES THE TWO DOORS AWAY. Both are lifted by name for the
// same reason everything above them is: a rename or a deletion must make this tool THROW rather
// than quietly measure an older idea of the file.
const C_PROVIDER_APPLE = topConst('SHELL_AUTH_PROVIDER_APPLE');
const C_PROVIDERS = topConst('SHELL_AUTH_PROVIDERS');
const C_SESSION_CH = topConst('SHELL_AUTH_SESSION');
const FN_SESSION_OF = topFunction('ezikNativeSessionOf');
const C_SUBS = topConst('EZIK_NATIVE_AUTH_SUBS');
const FN_RECEIVE = topFunction('ezikNativeAuthReceive');
const C_HIDE_FLAG = topConst('SHELL_HIDE_SOCIAL_FLAG');
const FN_HIDES = topFunction('ezikShellHidesSocialSignIn');
const FN_DOORS = topFunction('ezikEntryDoors');
// THE ENTRY CARD ITSELF. The two doors are DRAWN there and nowhere else, so a proof about
// whether they exist has to mount the card rather than read the function that decides.
const C_ENTRY_KEY = topConst('ENTRY_CHOICE_KEY');
const C_ENTRY_ACCOUNT = topConst('ENTRY_ACCOUNT');
const C_ENTRY_GUEST = topConst('ENTRY_GUEST');
const FN_READ_ENTRY = topFunction('readEntryChoice');
const FN_WRITE_ENTRY = topFunction('writeEntryChoice');
const FN_ENTRY_ANSWERED = topFunction('ezikEntryAnswered');
const C_DEFAULT_AGE = topConst('ONBOARDING_DEFAULT_AGE');
const FN_NATIVE_ENTRY = topFunction('useEzikNativeAuthEntry');
const FN_ONBOARDING = topFunction('Onboarding');
const FN_ROW = topFunction('EzikSignInRow');
const FN_SETTINGS = topFunction('SettingsSheet');

// THE HARNESS, ASSEMBLED FROM THE FILE ITSELF. Everything the seam cannot supply for itself -- a
// window, a store, randomness, a clock, a fetch, the React the row closes over -- arrives through
// `env`. Everything else is app.jsx's own text.
const HARNESS_PARTS = [
  '"use strict";',
  'const window = env.window;',
  'const localStorage = env.localStorage;',
  'const crypto = env.crypto;',
  'const fetch = env.fetch;',
  'const setTimeout = env.setTimeout;',
  'const clearTimeout = env.clearTimeout;',
  'const Date = env.Date;',
  'const URL = env.URL;',
  'const capHeaders = env.capHeaders;',
  'const getDeviceId = env.getDeviceId;',
  'const React = env.React;',
  'const useState = env.useState;',
  'const useRef = env.useRef;',
  'const useEffect = env.useEffect;',
  'const s = env.s;',
  'const EzShellGroup = env.EzShellGroup;',
  'const useEzLang = env.useEzLang;',
  'const EzLangControl = env.EzLangControl;',
  'let EZ_LANG = env.lang;',
  text(C_FALLBACK),
  text(C_I18N),
  text(FN_T),
  text(C_REQ), text(C_RES), text(C_V), text(C_ORIGIN), text(C_START_PATH), text(C_EXCH_PATH),
  text(C_PROVIDER), text(C_SCHEME), text(C_DELETE_PATH),
  text(C_QUIET), text(C_FAULT), text(C_RETRY), text(C_CLASSES), text(C_LINES), text(C_OTHER),
  text(FN_BRIDGE), text(FN_REASON), text(FN_CLASS), text(FN_LINE), text(FN_CS),
  text(C_SEQ), text(FN_ID), text(FN_START_URL), text(FN_MSG), text(FN_ASK), text(FN_PARAMS),
  text(FN_EXCHANGE), text(FN_DELETE),
  text(C_SESSION_KEY), text(FN_READ_SESSION), text(FN_WRITE_SESSION), text(FN_CLEAR_SESSION),
  text(C_PROVIDER_APPLE), text(C_PROVIDERS), text(C_SESSION_CH), text(FN_SESSION_OF),
  text(C_SUBS), text(FN_RECEIVE), text(C_HIDE_FLAG), text(FN_HIDES), text(FN_DOORS),
  text(FN_ROW),
  'return {',
  '  EzikSignInRow: EzikSignInRow,',
  '  ezikAuthBridge: ezikAuthBridge, ezikAuthReason: ezikAuthReason,',
  '  ezikAuthClass: ezikAuthClass, ezikAuthLine: ezikAuthLine,',
  '  ezikAuthClientState: ezikAuthClientState, ezikAuthStartUrl: ezikAuthStartUrl,',
  '  ezikAuthMessage: ezikAuthMessage, ezikAuthAsk: ezikAuthAsk,',
  '  ezikAuthReturnParams: ezikAuthReturnParams, ezikAuthExchange: ezikAuthExchange,',
  '  ezikAuthDelete: ezikAuthDelete, SHELL_AUTH_DELETE_PATH: SHELL_AUTH_DELETE_PATH,',
  '  readAuthSession: readAuthSession, writeAuthSession: writeAuthSession,',
  '  clearAuthSession: clearAuthSession,',
  '  SHELL_AUTH_SESSION: SHELL_AUTH_SESSION, SHELL_AUTH_PROVIDERS: SHELL_AUTH_PROVIDERS,',
  '  ezikNativeSessionOf: ezikNativeSessionOf, ezikNativeAuthReceive: ezikNativeAuthReceive,',
  '  EZIK_NATIVE_AUTH_SUBS: EZIK_NATIVE_AUTH_SUBS,',
  '  SHELL_HIDE_SOCIAL_FLAG: SHELL_HIDE_SOCIAL_FLAG,',
  '  ezikShellHidesSocialSignIn: ezikShellHidesSocialSignIn, ezikEntryDoors: ezikEntryDoors,',
  '  SHELL_AUTH_REQUEST: SHELL_AUTH_REQUEST, SHELL_AUTH_RESULT: SHELL_AUTH_RESULT,',
  '  SHELL_AUTH_V: SHELL_AUTH_V, SHELL_AUTH_ORIGIN: SHELL_AUTH_ORIGIN,',
  '  SHELL_AUTH_START_PATH: SHELL_AUTH_START_PATH, SHELL_AUTH_PROVIDER: SHELL_AUTH_PROVIDER,',
  '  SHELL_AUTH_RETURN_SCHEME: SHELL_AUTH_RETURN_SCHEME,',
  '  SHELL_AUTH_QUIET: SHELL_AUTH_QUIET, SHELL_AUTH_FAULT: SHELL_AUTH_FAULT,',
  '  SHELL_AUTH_RETRY: SHELL_AUTH_RETRY, SHELL_AUTH_CLASSES: SHELL_AUTH_CLASSES,',
  '  SHELL_AUTH_LINES: SHELL_AUTH_LINES, SHELL_AUTH_REASON_OTHER: SHELL_AUTH_REASON_OTHER,',
  '  AUTH_SESSION_KEY: AUTH_SESSION_KEY, EZ_I18N: EZ_I18N,',
  '  setLang: function (v) { EZ_LANG = v; },',
  '};',
];
const HARNESS_JSX = HARNESS_PARTS.join('\n');

// THE SECOND LIFT: the same parts, plus the entry card and the four things only it stands on.
// It is a SEPARATE substrate on purpose. Onboarding repeats the sign-in ladder rather than
// sharing it, exactly so that mutant م٤ can find the client-state comparison by its own line;
// putting both copies into one lift would make that line ambiguous and disarm the mutant
// silently. So the mutants above keep the harness they have always had, and the card gets its
// own -- and mutantEntry() below mutates THIS one.
const HARNESS_ENTRY_PARTS = (function () {
  const parts = HARNESS_PARTS.slice();
  const at = parts.indexOf('return {');
  if (at === -1) throw new Error('the lift no longer ends in a return block');
  parts.splice(at, 0,
    text(C_ENTRY_KEY), text(C_ENTRY_ACCOUNT), text(C_ENTRY_GUEST),
    text(FN_READ_ENTRY), text(FN_WRITE_ENTRY), text(FN_ENTRY_ANSWERED),
    text(C_DEFAULT_AGE), text(FN_NATIVE_ENTRY), text(FN_ONBOARDING));
  parts.splice(parts.indexOf('return {') + 1, 0,
    '  Onboarding: Onboarding, ENTRY_CHOICE_KEY: ENTRY_CHOICE_KEY,',
    '  ENTRY_ACCOUNT: ENTRY_ACCOUNT, ENTRY_GUEST: ENTRY_GUEST,',
    '  readEntryChoice: readEntryChoice, ezikEntryAnswered: ezikEntryAnswered,');
  return parts;
}());
const HARNESS_ENTRY_JSX = HARNESS_ENTRY_PARTS.join('\n');

/** The lifted seam, compiled through the page's own Babel with the classic runtime. */
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
const HARNESS = compile(HARNESS_JSX);
const HARNESS_ENTRY = compile(HARNESS_ENTRY_JSX);

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

/** A window with a real listener registry, so "is a listener still attached" is a fact. */
function fakeWindow(bridge) {
  const listeners = [];
  const w = {
    addEventListener(type, fn) { listeners.push({ type: type, fn: fn }); },
    removeEventListener(type, fn) {
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].type === type && listeners[i].fn === fn) listeners.splice(i, 1);
      }
    },
    // What the shell does: a window event of the agreed name, its payload in .detail.
    dispatch(type, detail) {
      const snapshot = listeners.slice();
      for (const l of snapshot) { if (l.type === type) l.fn({ type: type, detail: detail }); }
    },
    live(type) { return listeners.filter((l) => l.type === type).length; },
  };
  if (bridge) w.ReactNativeWebView = bridge;
  return w;
}

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    keys: () => Array.from(m.keys()),
  };
}

/** A clock the test drives, so a pending timer is a countable fact and nothing costs wall-clock. */
function fakeClock() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { fn: fn, ms: ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    pending: () => timers.size,
    delays: () => Array.from(timers.values()).map((t) => t.ms),
  };
}

function recordingBridge(sent) { return { postMessage: (str) => { sent.push(str); } }; }
function throwingBridge() {
  return { postMessage: () => { throw new Error('the bridge refused the message'); } };
}

// REAL RANDOMNESS FROM node:crypto, not a counter. A counter would let a client state that was
// never actually random pass a case about a client state.
const realRandom = {
  getRandomValues: (arr) => { nodeCrypto.randomFillSync(arr); return arr; },
};

const FIXTURE = {
  device: 'device-aaaa1111',
  ticket: 'tkt-77',
  session: 'sess-88',
  email: 'reader@example.com',
  provider: 'google',
};

/** The exchange, answered by the test rather than by a network. */
function fakeFetch(plan) {
  const calls = [];
  const fn = (url, init) => {
    calls.push({ url: url, init: init });
    const answer = plan.shift() || { status: 200, body: { ok: true, session: FIXTURE.session, email: FIXTURE.email, provider: FIXTURE.provider } };
    if (answer.throws) return Promise.reject(new Error('network'));
    return Promise.resolve({
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: () => Promise.resolve(answer.body),
    });
  };
  fn.calls = calls;
  return fn;
}

// THE CLOCK, PINNED AND CONSTRUCTIBLE. `new Date()` answers one fixed instant and `Date.now()`
// answers the same number, so nothing measured here moves with the day this file is run.
const FIXED_NOW = 1756000000000;
const FIXED_DATE = (function () {
  const Real = Date;
  function EzikDate() { return new Real(FIXED_NOW); }
  EzikDate.now = () => FIXED_NOW;
  return EzikDate;
}());

const FRAGMENT = { fragment: true };

/**
 * The smallest React that can answer the question being asked. createElement records, the three
 * hooks keep their cells across re-renders, and a state setter renders again. What it CANNOT do
 * is exactly what nothing here needs -- a DOM, a scheduler, a reconciler.
 */
function mountRow(scn, factory, pick, props) {
  const env = scn.env;
  const cells = [];
  const teardowns = [];
  let cursor = 0;
  let tree = null;
  let renders = 0;
  env.React = {
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
  env.useState = (init) => {
    const i = cursor++;
    if (!cells[i]) cells[i] = { v: typeof init === 'function' ? init() : init };
    const cell = cells[i];
    return [cell.v, (nv) => { cell.v = typeof nv === 'function' ? nv(cell.v) : nv; render(); }];
  };
  env.useRef = (init) => {
    const i = cursor++;
    if (!cells[i]) cells[i] = { current: init };
    return cells[i];
  };
  env.useEffect = (fn) => {
    const i = cursor++;
    if (cells[i]) return;                        // deps [] -- this harness mounts once
    cells[i] = { effect: true };
    const t = fn();
    if (typeof t === 'function') teardowns.push(t);
  };
  // THE MODULE IS BUILT ONLY NOW, because the lifted source reads its React and its three hooks
  // out of env at evaluation time -- a module built before they were installed would be holding
  // undefined and would fail at the first render rather than measure anything.
  const mod = (factory || makeSeam)(env);
  const Component = pick ? pick(mod) : mod.EzikSignInRow;
  const given = props || {};
  function render() { cursor = 0; renders++; tree = Component(given); }
  render();
  return {
    mod: mod,
    tree: () => tree,
    renders: () => renders,
    unmount: () => { for (const t of teardowns) t(); },
  };
}

/** The nodes a tree would actually put in a document: fragments and nulls contribute none. */
function nodesOf(node) {
  if (node === null || node === undefined || node === false || node === true) return [];
  if (typeof node !== 'object') return [{ tag: '#text', text: String(node), children: [] }];
  if (Array.isArray(node)) return node.reduce((a, n) => a.concat(nodesOf(n)), []);
  const kids = (node.children || []).reduce((a, n) => a.concat(nodesOf(n)), []);
  if (node.type === FRAGMENT) return kids;
  if (typeof node.type === 'function') return kids;
  const tag = typeof node.type === 'string' ? node.type : String(node.props && node.props.title);
  return [{ tag: tag, props: node.props, children: kids }];
}
function countNodes(list) {
  return list.reduce((n, x) => n + 1 + countNodes(x.children || []), 0);
}
function textOf(list) {
  return list.map((x) => (x.tag === '#text' ? x.text : textOf(x.children || []))).join('');
}
function findTags(list, tag, out) {
  const acc = out || [];
  for (const x of list) { if (x.tag === tag) acc.push(x); findTags(x.children || [], tag, acc); }
  return acc;
}

const makeSeam = new Function('env', HARNESS);
const makeEntry = new Function('env', HARNESS_ENTRY);

/** One scene: a window, a store, a clock, a fetch plan, and everything to inspect afterwards. */
function scene(opts) {
  const o = opts || {};
  const sent = [];
  const clock = fakeClock();
  const bridge = o.shell === false ? null
    : (o.shell === 'throwing' ? throwingBridge() : recordingBridge(sent));
  const win = fakeWindow(bridge);
  const storage = fakeStorage();
  const fetchFn = fakeFetch((o.fetchPlan || []).slice());
  const env = {
    window: win,
    localStorage: storage,
    crypto: realRandom,
    fetch: fetchFn,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Date: FIXED_DATE,
    URL: URL,
    capHeaders: () => ({ 'x-murabbi-device': FIXTURE.device }),
    getDeviceId: () => FIXTURE.device,
    lang: o.lang || 'ar',
    s: new Proxy({}, { get: () => ({}) }),
    EzShellGroup: function EzShellGroup(props) { return props.children; },
    // The language control is a SCREEN of its own and belongs to the i18n gate; what this file
    // needs from it is that the card can be drawn, so it is a stub that draws nothing.
    useEzLang: () => (o.lang || 'ar'),
    EzLangControl: function EzLangControl() { return null; },
  };
  return { env: env, win: win, sent: sent, clock: clock, storage: storage, fetch: fetchFn };
}

/** The seam alone, with no component mounted -- for the pure functions. */
function seam(opts) {
  const scn = scene(opts);
  return Object.assign({ mod: makeSeam(scn.env) }, scn);
}

/** Mount the row and press the button, returning everything the press touched. */
function press(opts, factory) {
  const scn = scene(opts);
  const m = mountRow(scn, factory);
  const btn = findTags(nodesOf(m.tree()), 'button')[0];
  if (!btn) throw new Error('the row drew no button to press');
  btn.props.onClick();
  return Object.assign({ m: m, btn: () => findTags(nodesOf(m.tree()), 'button')[0] }, scn);
}

/** The shell's answer, built here from the contract's own words. */
function reply(mod, id, over) {
  return Object.assign({ type: mod.SHELL_AUTH_RESULT, v: mod.SHELL_AUTH_V, id: id }, over || {});
}
function sentId(scn) { return JSON.parse(scn.sent[0]).id; }

/** Let the exchange's promise chain finish. Two awaits inside it, one .then on the caller. */
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

// ---------------------------------------------------------------------------
// THE CASES.
// ---------------------------------------------------------------------------
const results = [];
const queue = [];
function run(name, fn) { queue.push({ name: name, fn: fn }); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': got ' + a + ', wanted ' + b);
}
function is(cond, what) { if (!cond) throw new Error(what); }

const CONTRACT = makeSeam(scene({}).env);

/* -- THE FOUR FIELDS ------------------------------------------------------- */

run('the request carries the four fields the contract names, and NO fifth', () => {
  const p = press({});
  eq(p.sent.length, 1, 'messages posted for one press');
  const m = JSON.parse(p.sent[0]);
  eq(Object.keys(m).sort(), ['id', 'type', 'url', 'v'], 'the fields on the wire');
  eq(m.type, CONTRACT.SHELL_AUTH_REQUEST, 'the message type');
  is(typeof m.id === 'string' && m.id.length > 0, 'id is not a non-empty string');
  return Object.keys(m).sort().join(',') + '  type=' + m.type;
});

run('`v` crosses as the STRING "1" and never the number 1', () => {
  const p = press({});
  const m = JSON.parse(p.sent[0]);
  eq(typeof m.v, 'string', 'the type of v on the wire');
  eq(m.v, '1', 'the value of v');
  eq(CONTRACT.SHELL_AUTH_V, '1', 'the constant the page holds');
  eq(typeof CONTRACT.SHELL_AUTH_V, 'string', 'the type of the constant');
  return 'v = ' + JSON.stringify(m.v) + ' (' + typeof m.v + ')';
});

run('the url is https on ezik.app and is OUR route, never the provider\'s', () => {
  const p = press({});
  const m = JSON.parse(p.sent[0]);
  const u = new URL(m.url);
  eq(u.protocol, 'https:', 'the scheme the shell is asked to open');
  eq(u.host, 'ezik.app', 'the host the shell is asked to open');
  eq(u.pathname, CONTRACT.SHELL_AUTH_START_PATH, 'the path');
  eq(u.searchParams.get('provider'), CONTRACT.SHELL_AUTH_PROVIDER, 'the provider parameter');
  eq(u.searchParams.get('device'), FIXTURE.device, 'the device parameter');
  is(m.url.indexOf('accounts.google.com') === -1, 'a provider URL was handed to the shell');
  return u.origin + u.pathname + ' ?provider,cs,device';
});

/* -- THE id MATCH ---------------------------------------------------------- */

run('a reply carrying ANOTHER id is neither an answer nor a refusal', () => {
  const p = press({});
  const id = sentId(p);
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT, reply(CONTRACT.mod || CONTRACT, id + '-x', { ok: false, reason: 'browser-failed' }));
  eq(p.win.live(CONTRACT.SHELL_AUTH_RESULT), 1, 'listeners after another press\'s answer');
  eq(p.btn().props.disabled, true, 'the button after another press\'s answer');
  eq(textOf(nodesOf(p.m.tree())).indexOf(CONTRACT.EZ_I18N.ar['auth.browserFailed']), -1,
    'a line was drawn for another press\'s answer');
  return 'listener still attached, button still disabled, nothing drawn';
});

run('a reply with the wrong type or the wrong version is ignored the same way', () => {
  for (const over of [{ type: 'ezik:download:result' }, { v: 1 }, { v: '2' }]) {
    const p = press({});
    const id = sentId(p);
    p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
      Object.assign(reply(CONTRACT, id, { ok: true, url: 'ezik://auth/return?ticket=t&state=s' }), over));
    eq(p.win.live(CONTRACT.SHELL_AUTH_RESULT), 1, 'listeners after ' + JSON.stringify(over));
    eq(p.fetch.calls.length, 0, 'exchanges made for ' + JSON.stringify(over));
  }
  return '3 malformed envelopes ignored, listener kept, 0 exchanges';
});

/* -- THE FIVE REASONS AND THE THREE CLASSES -------------------------------- */

run('the contract\'s five reasons are the five this page knows, and no sixth is declared', () => {
  eq(Object.keys(CONTRACT.SHELL_AUTH_CLASSES).sort(),
    ['bad-payload', 'bad-url', 'browser-failed', 'dismissed', 'unsupported'],
    'the reasons the page classifies');
  eq(Object.keys(CONTRACT.SHELL_AUTH_LINES).sort(),
    ['bad-payload', 'bad-url', 'browser-failed', 'unsupported'],
    'the reasons that carry a line -- dismissed carries none, on purpose');
  return '5 reasons, 4 lines, 1 silence';
});

run('the five sort into exactly THREE treatments, and each one is the treatment named', () => {
  const c = CONTRACT;
  eq(c.ezikAuthClass('dismissed'), c.SHELL_AUTH_QUIET, 'dismissed');
  eq(c.ezikAuthClass('bad-payload'), c.SHELL_AUTH_FAULT, 'bad-payload');
  eq(c.ezikAuthClass('bad-url'), c.SHELL_AUTH_FAULT, 'bad-url');
  eq(c.ezikAuthClass('unsupported'), c.SHELL_AUTH_RETRY, 'unsupported');
  eq(c.ezikAuthClass('browser-failed'), c.SHELL_AUTH_RETRY, 'browser-failed');
  const classes = Object.keys(c.SHELL_AUTH_CLASSES).map((r) => c.ezikAuthClass(r));
  eq(Array.from(new Set(classes)).sort(), [c.SHELL_AUTH_FAULT, c.SHELL_AUTH_QUIET, c.SHELL_AUTH_RETRY].sort(),
    'the distinct treatments');
  // And `unsupported` has its own LINE inside the retry class, which is the alternate path.
  is(c.ezikAuthLine('unsupported') !== c.ezikAuthLine('browser-failed'),
    'unsupported and browser-failed say the same sentence -- the alternate path is not named');
  return '3 treatments over 5 reasons; unsupported keeps its own line';
});

run('`dismissed` is SILENCE: no line, and the offer is standing again', () => {
  const p = press({});
  const id = sentId(p);
  eq(p.btn().props.disabled, true, 'the button while the sheet is open');
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT, reply(CONTRACT, id, { ok: false, reason: 'dismissed' }));
  eq(CONTRACT.ezikAuthLine('dismissed'), '', 'the line for dismissed');
  eq(p.btn().props.disabled, false, 'the button after the reader closed the sheet');
  const drawn = textOf(nodesOf(p.m.tree()));
  eq(drawn, CONTRACT.EZ_I18N.ar['auth.signIn'], 'what is drawn after a dismissal');
  eq(p.win.live(CONTRACT.SHELL_AUTH_RESULT), 0, 'listeners left attached after an answer');
  return 'no line, button released, exactly the offer redrawn';
});

run('every other reason draws its OWN line and releases the button', () => {
  const seen = [];
  for (const reason of ['bad-payload', 'bad-url', 'unsupported', 'browser-failed']) {
    const p = press({});
    const id = sentId(p);
    p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT, reply(CONTRACT, id, { ok: false, reason: reason }));
    const want = CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_AUTH_LINES[reason]];
    is(!!want, 'no dictionary line for ' + reason);
    is(textOf(nodesOf(p.m.tree())).indexOf(want) !== -1, 'the line for ' + reason + ' was not drawn');
    eq(p.btn().props.disabled, false, 'the button after ' + reason);
    seen.push(reason);
  }
  return seen.length + ' reasons, 4 distinct lines, button released each time';
});

run('a SIXTH reason nobody has heard of is treated exactly as `browser-failed`', () => {
  const want = CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_AUTH_LINES['browser-failed']];
  for (const sixth of ['provider-exploded', '', undefined, null, 42, {}]) {
    eq(CONTRACT.ezikAuthClass(sixth), CONTRACT.ezikAuthClass('browser-failed'),
      'the class for ' + JSON.stringify(sixth));
    eq(CONTRACT.ezikAuthLine(sixth), want, 'the line for ' + JSON.stringify(sixth));
  }
  const p = press({});
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(p), { ok: false, reason: 'a-word-from-a-newer-shell' }));
  is(textOf(nodesOf(p.m.tree())).indexOf(want) !== -1, 'the sixth reason drew no line');
  eq(p.btn().props.disabled, false, 'the button after a sixth reason');
  eq(CONTRACT.SHELL_AUTH_REASON_OTHER, 'browser-failed', 'the declared fallback');
  return '6 unknown shapes, all -> browser-failed, button released';
});

/* -- NO DEADLINE ----------------------------------------------------------- */

run('NOT ONE TIMER IS ARMED -- not on the press, not on the answer, not on the failure', () => {
  const answered = press({});
  eq(answered.clock.pending(), 0, 'timers pending after the press');
  answered.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(answered), { ok: false, reason: 'dismissed' }));
  eq(answered.clock.pending(), 0, 'timers pending after the answer');
  eq(answered.clock.delays(), [], 'delays armed at any point');

  // And the silent case: no answer at all. The button stays disabled, which IS the contract.
  const silent = press({});
  eq(silent.clock.pending(), 0, 'timers pending while waiting for an answer that never comes');
  eq(silent.btn().props.disabled, true, 'the button with no answer');
  eq(silent.win.live(CONTRACT.SHELL_AUTH_RESULT), 1, 'the listener with no answer');

  // Static, too: nothing on this path names setTimeout at all.
  const names = [FN_ASK, FN_ROW, FN_EXCHANGE, FN_START_URL, FN_MSG];
  for (const fn of names) {
    const body = text(fn);
    is(body.indexOf('setTimeout') === -1 && body.indexOf('setInterval') === -1,
      'a deadline appears in the source of ' + (fn.id ? fn.id.name : 'a lifted function'));
  }
  return '0 timers armed, 0 delays, 0 setTimeout in 5 lifted functions';
});

/* -- THE BUTTON, DISABLED AND RELEASED ------------------------------------- */

run('the button is disabled on the press and released in EVERY failure branch', async () => {
  const branches = [];
  // 1. the bridge itself throws -- onDone is called synchronously, before any listener exists
  const t = press({ shell: 'throwing' });
  eq(t.btn().props.disabled, false, 'the button when the bridge refused the message');
  eq(t.win.live(CONTRACT.SHELL_AUTH_RESULT), 0, 'a listener left behind by a refused post');
  branches.push('bridge-throws');
  // 2..5. a returned URL that is not the destination, a state that does not match, an error in
  //       the query, and a return with no ticket at all.
  const cases = [
    ['not our scheme', (id) => ({ ok: true, url: 'https://evil.example/?ticket=t' }), 'auth.badReturn'],
    ['no url at all', () => ({ ok: true }), 'auth.badReturn'],
    ['a state from another press', () => ({ ok: true, url: 'ezik://auth/return?ticket=t&state=nope' }), 'auth.stateMismatch'],
    ['no ticket in a matching return', (cs) => ({ ok: true, url: 'ezik://auth/return?state=' + cs }), 'auth.badReturn'],
  ];
  for (const [label, build, key] of cases) {
    const p = press({});
    const cs = new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs');
    p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT, reply(CONTRACT, sentId(p), build(cs)));
    eq(p.btn().props.disabled, false, 'the button after ' + label);
    is(textOf(nodesOf(p.m.tree())).indexOf(CONTRACT.EZ_I18N.ar[key]) !== -1,
      'the line for ' + label);
    branches.push(label);
  }
  // 6. the exchange itself refuses.
  const bad = press({ fetchPlan: [{ status: 400, body: { ok: false, error: 'auth-ticket-invalid' } }] });
  const cs6 = new URL(JSON.parse(bad.sent[0]).url).searchParams.get('cs');
  bad.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(bad), { ok: true, url: 'ezik://auth/return?ticket=t&state=' + cs6 }));
  await flush();
  eq(bad.btn().props.disabled, false, 'the button after the exchange refused');
  is(textOf(nodesOf(bad.m.tree())).indexOf(CONTRACT.EZ_I18N.ar['auth.exchangeFailed']) !== -1,
    'the line after the exchange refused');
  branches.push('exchange-refused');

  // And a network that never answers at all is the seventh: same release, same line.
  const dead = press({ fetchPlan: [{ throws: true }] });
  const cs7 = new URL(JSON.parse(dead.sent[0]).url).searchParams.get('cs');
  dead.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(dead), { ok: true, url: 'ezik://auth/return?ticket=t&state=' + cs7 }));
  await flush();
  eq(dead.btn().props.disabled, false, 'the button after the exchange threw');
  branches.push('exchange-threw');
  return branches.length + ' failure branches, every one released the button';
});

/* -- THE CLIENT STATE ------------------------------------------------------ */

run('`cs` is minted per press, is never stored, and never repeats', () => {
  const seen = new Set();
  for (let i = 0; i < 24; i++) {
    const p = press({});
    const cs = new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs');
    is(/^[0-9a-f]{32}$/.test(cs), 'cs is not 32 hex characters: ' + cs);
    is(!seen.has(cs), 'cs repeated across presses');
    seen.add(cs);
    eq(p.storage.keys(), [], 'keys written to the store by a press');
  }
  // And the source says so: the client state never touches localStorage anywhere in the seam.
  for (const fn of [FN_CS, FN_ASK, FN_ROW]) {
    const body = text(fn);
    is(!/localStorage\.setItem\([^)]*cs/i.test(body), 'the client state is written to the store');
  }
  return seen.size + ' presses, ' + seen.size + ' distinct 32-hex states, 0 store writes';
});

run('a return whose `state` does not match this press is REFUSED before anything else is read', () => {
  const p = press({});
  const id = sentId(p);
  // A perfectly well-formed return -- ticket and all -- but from another press.
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, id, { ok: true, url: 'ezik://auth/return?ticket=' + FIXTURE.ticket + '&state=someone-else' }));
  eq(p.fetch.calls.length, 0, 'exchanges made for a state that did not match');
  eq(p.storage.keys(), [], 'sessions stored for a state that did not match');
  is(textOf(nodesOf(p.m.tree())).indexOf(CONTRACT.EZ_I18N.ar['auth.stateMismatch']) !== -1,
    'the mismatch line was not drawn');
  return '0 exchanges, 0 sessions, the mismatch named';
});

run('a matching return is exchanged, and the exchange carries the device header', async () => {
  const p = press({});
  const cs = new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs');
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(p), { ok: true, url: 'ezik://auth/return?ticket=' + FIXTURE.ticket + '&state=' + cs }));
  await flush();
  eq(p.fetch.calls.length, 1, 'exchanges made');
  const call = p.fetch.calls[0];
  eq(call.url, CONTRACT.SHELL_AUTH_ORIGIN + '/api/auth-exchange', 'the exchange URL');
  eq(call.init.method, 'POST', 'the exchange verb');
  eq(call.init.headers['x-murabbi-device'], FIXTURE.device, 'the device header on the exchange');
  eq(JSON.parse(call.init.body), { ticket: FIXTURE.ticket }, 'the exchange body');
  return 'POST /api/auth-exchange  x-murabbi-device  { ticket }';
});

/* -- WHAT IS DRAWN --------------------------------------------------------- */

run('OUTSIDE THE SHELL THE ROW DRAWS NOTHING AT ALL -- not a hidden node, none', () => {
  const outside = scene({ shell: false });
  const m = mountRow(outside);
  eq(m.tree(), null, 'what the row returns in a browser tab');
  eq(countNodes(nodesOf(m.tree())), 0, 'nodes drawn in a browser tab');
  const inside = scene({});
  const m2 = mountRow(inside);
  is(countNodes(nodesOf(m2.tree())) > 0, 'the row drew nothing inside the shell either');
  // And the bridge test is the injected object, never the user agent.
  const body = text(FN_BRIDGE);
  is(body.indexOf('userAgent') === -1, 'the bridge test consults navigator.userAgent');
  is(body.indexOf('ReactNativeWebView') !== -1, 'the bridge test no longer reads the injected bridge');
  return '0 nodes in a tab, ' + countNodes(nodesOf(m2.tree())) + ' in the shell';
});

run('the shell can ask for the settings row to go, and it goes whole -- account kept', () => {
  // THE SAME DECLARATION THE ENTRY CARD READS, SET THE SAME WAY: on the window before the page
  // draws. What is asserted here is a COUNT OF NODES and not the absence of a label, because a
  // row that draws an empty group is still a row a reviewer can photograph.
  const flag = CONTRACT.SHELL_HIDE_SOCIAL_FLAG;
  const ar = CONTRACT.EZ_I18N.ar;

  // 1 -- DECLARED, IN THE SHELL, NO SESSION: zero social sign-in rows in Settings.
  const hidden = scene({});
  hidden.win[flag] = true;
  const mh = mountRow(hidden);
  eq(mh.tree(), null, 'what the row returns under the declaration');
  eq(countNodes(nodesOf(mh.tree())), 0, 'nodes drawn in Settings under the declaration');
  is(textOf(nodesOf(mh.tree())).indexOf(ar['auth.signIn']) === -1,
    'the Google label survived the declaration in Settings');

  // 2 -- NOT DECLARED, IN THE SHELL: the row is there, as the default, with its offer.
  const shown = scene({});
  const ms = mountRow(shown);
  is(countNodes(nodesOf(ms.tree())) > 0, 'the row drew nothing without the declaration');
  is(textOf(nodesOf(ms.tree())).indexOf(ar['auth.signIn']) !== -1,
    'the sign-in offer is missing when nothing was declared');
  // AND EVERY VALUE THAT IS NOT THE LITERAL true IS NOT A DECLARATION. The flag test is
  // ezikShellHidesSocialSignIn() and this row inherits its strictness rather than restating it.
  for (const junk of ['true', 1, {}, [], 'yes']) {
    const loose = scene({});
    loose.win[flag] = junk;
    is(countNodes(nodesOf(mountRow(loose).tree())) > 0,
      'the row went away for a flag set to ' + JSON.stringify(junk) + ' -- not a declaration');
  }

  // 3 -- A BROWSER TAB IS UNAFFECTED IN BOTH DIRECTIONS. It drew nothing before the flag existed
  // and draws nothing now; the switch must not have become a second bridge.
  for (const declared of [false, true]) {
    const tab = scene({ shell: false });
    if (declared) tab.win[flag] = true;
    eq(countNodes(nodesOf(mountRow(tab).tree())), 0, 'nodes in a tab, declared=' + declared);
  }

  // 4 -- THE ACCOUNT IS NOT THE INVITATION. A session handed over by the native door stands on
  // the very platform that declares this flag, so the address, the sign-out and the delete
  // control must all survive it. This is the half the order forbids hiding.
  const held = scene({});
  held.win[flag] = true;
  held.storage.setItem(CONTRACT.AUTH_SESSION_KEY, JSON.stringify({
    session: FIXTURE.session, email: FIXTURE.email, provider: 'apple',
  }));
  const mk = mountRow(held);
  const kept = textOf(nodesOf(mk.tree()));
  is(kept.indexOf(FIXTURE.email) !== -1, 'the address was hidden from a reader who IS signed in');
  is(kept.indexOf(ar['auth.signOut']) !== -1, 'the sign-out control was hidden');
  is(kept.indexOf(ar['auth.delete']) !== -1, 'the delete control was hidden');
  is(kept.indexOf(ar['auth.signIn']) === -1, 'the sign-in offer is drawn beside a live session');

  // 5 -- AND THE ROW READS THE ONE FUNCTION RATHER THAN THE FLAG. A direct window read here
  // would be a second definition of "declared" that drifts from ezikShellHidesSocialSignIn().
  const rowSrc = text(FN_ROW);
  is(rowSrc.indexOf('ezikShellHidesSocialSignIn()') !== -1,
    'the row no longer asks ezikShellHidesSocialSignIn()');
  is(rowSrc.indexOf('SHELL_HIDE_SOCIAL_FLAG') === -1 && rowSrc.indexOf(flag) === -1,
    'the row reads the flag off the window itself instead of through the one function');

  return '0 nodes declared, row present undeclared, 0 in a tab either way, account kept';
});

run('after a successful sign-in the ADDRESS is shown and nothing else is', async () => {
  const p = press({});
  const cs = new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs');
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(p), { ok: true, url: 'ezik://auth/return?ticket=' + FIXTURE.ticket + '&state=' + cs }));
  await flush();
  const drawn = textOf(nodesOf(p.m.tree()));
  is(drawn.indexOf(FIXTURE.email) !== -1, 'the address was not drawn');
  is(drawn.indexOf(CONTRACT.EZ_I18N.ar['auth.signOut']) !== -1, 'the sign-out control was not drawn');
  is(drawn.indexOf(CONTRACT.EZ_I18N.ar['auth.signIn']) === -1, 'the sign-in offer is still drawn');
  is(drawn.indexOf(FIXTURE.session) === -1, 'the SESSION KEY was drawn on the screen');
  is(drawn.indexOf(FIXTURE.provider) === -1, 'the provider name was drawn');
  // ITEM: the delete control joined this row, and this assertion stays TOTAL rather than
  // being loosened into a contains-check: the whole point of it is that a badge, a rank or a
  // ceiling cannot appear here unnoticed. The row draws three things and they are named.
  is(drawn.indexOf(CONTRACT.EZ_I18N.ar['auth.delete']) !== -1, 'the delete control was not drawn');
  is(drawn.indexOf(CONTRACT.EZ_I18N.ar['auth.deleteConfirm']) === -1,
    'the control that ACTUALLY deletes is on screen before the reader armed it -- one press');
  eq(drawn, FIXTURE.email + CONTRACT.EZ_I18N.ar['auth.signOut'] + CONTRACT.EZ_I18N.ar['auth.delete'],
    'everything the row draws');
  return 'address + sign-out + delete, and literally nothing else';
});

run('signing out removes the key locally and calls nothing', async () => {
  const p = press({});
  const cs = new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs');
  p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
    reply(CONTRACT, sentId(p), { ok: true, url: 'ezik://auth/return?ticket=' + FIXTURE.ticket + '&state=' + cs }));
  await flush();
  eq(p.storage.keys(), [CONTRACT.AUTH_SESSION_KEY], 'the keys after a sign-in');
  const before = p.fetch.calls.length;
  findTags(nodesOf(p.m.tree()), 'button')[0].props.onClick();
  eq(p.storage.keys(), [], 'the keys after signing out');
  eq(p.fetch.calls.length, before, 'requests made by signing out');
  is(textOf(nodesOf(p.m.tree())).indexOf(CONTRACT.EZ_I18N.ar['auth.signIn']) !== -1,
    'the offer did not come back after signing out');
  return '1 key written, 1 key removed, 0 requests';
});

run('the listener is torn down when the row unmounts with a press still open', () => {
  const scn = scene({});
  const m = mountRow(scn);
  findTags(nodesOf(m.tree()), 'button')[0].props.onClick();
  eq(scn.win.live(CONTRACT.SHELL_AUTH_RESULT), 1, 'the listener while the press is open');
  m.unmount();
  eq(scn.win.live(CONTRACT.SHELL_AUTH_RESULT), 0, 'listeners after the unmount effect ran');
  return 'attached on press, gone on unmount';
});

/* -- THE ROW IS WHERE THE PARENTAL CONTROLS ALREADY ARE -------------------- */

run('the row is rendered by SettingsSheet and by no other component', () => {
  const sites = [];
  walk(ast.program, (n, parent) => {
    if (n.type !== 'JSXIdentifier' || n.name !== 'EzikSignInRow') return;
    if (parent && parent.type === 'JSXOpeningElement') sites.push(startLine(n));
  });
  eq(sites.length, 1, 'JSX sites that draw the row');
  const from = startLine(FN_SETTINGS);
  const to = FN_SETTINGS.loc.end.line;
  is(sites[0] > from && sites[0] < to,
    'the row is drawn at app.jsx:' + sites[0] + ', outside SettingsSheet (' + from + '-' + to + ')');
  // And it sits with the two controls that were already there.
  const body = text(FN_SETTINGS);
  is(body.indexOf('onOpenControl') !== -1, 'SettingsSheet no longer holds the parental-controls row');
  is(body.indexOf('canSetPin') !== -1, 'SettingsSheet no longer holds the founder PIN row');
  return 'one site, app.jsx:' + sites[0] + ', inside SettingsSheet(' + from + '-' + to + ')';
});

run('the session key is the ONLY key this seam stores, and it is classified MUST_GO', () => {
  // Every localStorage call inside the lifted seam, by the name it is given.
  const keys = new Set();
  for (const fn of [FN_ROW, FN_READ_SESSION, FN_WRITE_SESSION, FN_CLEAR_SESSION, FN_ASK,
    FN_EXCHANGE, FN_CS, FN_START_URL]) {
    walk(fn, (n) => {
      if (n.type !== 'CallExpression') return;
      const c = n.callee;
      if (c.type !== 'MemberExpression' || c.computed) return;
      if (!(c.object.type === 'Identifier' && c.object.name === 'localStorage')) return;
      const a = n.arguments[0];
      keys.add(a && a.type === 'Identifier' ? a.name : '(a literal)');
    });
  }
  eq(Array.from(keys).sort(), ['AUTH_SESSION_KEY'], 'the store keys this seam touches');

  // resetAll removes it, by the named constant.
  const reset = (function () {
    let found = null;
    walk(ast.program, (n) => {
      if (n.type !== 'VariableDeclarator') return;
      if (n.id.type === 'Identifier' && n.id.name === 'resetAll') found = n;
    });
    if (!found) throw new Error('app.jsx no longer declares resetAll');
    return found;
  })();
  let removed = false;
  walk(reset.init, (n) => {
    if (n.type !== 'CallExpression') return;
    const c = n.callee;
    if (c.type !== 'MemberExpression' || c.computed) return;
    if (!(c.object.type === 'Identifier' && c.object.name === 'localStorage')) return;
    if (c.property.name !== 'removeItem') return;
    const a = n.arguments[0];
    if (a && a.type === 'Identifier' && a.name === 'AUTH_SESSION_KEY') removed = true;
  });
  is(removed, 'resetAll does not remove AUTH_SESSION_KEY -- "delete my data" would leave a session');

  // And the delete-truth gate is the one that says so, with a reason written beside it.
  const dt = fs.readFileSync(path.join(REPO, 'tools', 'delete-truth-measure.cjs'), 'utf8');
  is(dt.indexOf("{ c: 'AUTH_SESSION_KEY'") !== -1,
    'tools/delete-truth-measure.cjs has no opinion about AUTH_SESSION_KEY');
  const at = dt.indexOf("{ c: 'AUTH_SESSION_KEY'");
  const clause = dt.slice(at, at + 400);
  is(/clause:/.test(clause), 'AUTH_SESSION_KEY is classified without a written reason');
  is(dt.slice(0, at).lastIndexOf('MUST_GO_NEW') > dt.slice(0, at).lastIndexOf('MUST_STAY'),
    'AUTH_SESSION_KEY is not in a MUST_GO list');
  return '1 key: AUTH_SESSION_KEY  ·  removed by resetAll  ·  MUST_GO with a clause';
});

/**
 * The lifted module over one scene, for the cases that are pure functions rather than a
 * component. Nothing here needs React, so nothing here installs one -- and a case that
 * silently needed one would fail rather than pass.
 */
function build(scn, factory) {
  return (factory || new Function('env', HARNESS))(scn.env);
}

// ---------------------------------------------------------------------------
// THE FIFTH CHANNEL -- a session handed over by the shell.
// ---------------------------------------------------------------------------
run('the fifth channel writes the handed-over session through the one writer', () => {
  const scn = scene({});
  const mod = build(scn);
  const good = {
    type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true,
    session: FIXTURE.session, email: FIXTURE.email, provider: 'apple',
  };
  is(mod.ezikNativeAuthReceive(good) === true, 'a valid payload from a shell was refused');
  // THE ONE KEY, IN THE ONE SHAPE. Read back through the file's own reader, so a write that
  // landed in a shape readAuthSession will not take would fail here rather than pass.
  eq(mod.readAuthSession(),
    { session: FIXTURE.session, email: FIXTURE.email, provider: 'apple' },
    'what the fifth channel stored');
  eq(Object.keys(JSON.parse(scn.storage.getItem(mod.AUTH_SESSION_KEY))).sort(),
    ['email', 'provider', 'session'], 'the fields stored');
  // AND NO SECOND KEY: the store holds exactly what the two existing doors would have left.
  eq(scn.storage.keys(), [mod.AUTH_SESSION_KEY], 'keys written by the fifth channel');
  return 'session written to ' + mod.AUTH_SESSION_KEY + ', 3 fields, 1 key';
});

run('a payload from a foreign origin is refused, and writes nothing at all', () => {
  // THE ORIGIN TEST IS THE BRIDGE, which is what it is on all four channels beside this one.
  // The identical event, dispatched on a page with no shell behind it -- a browser tab, an
  // extension, a bookmarklet -- has no shell that could have sent it.
  const tab = scene({ shell: false });
  const mod = build(tab);
  const good = {
    type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true,
    session: FIXTURE.session, email: FIXTURE.email, provider: 'apple',
  };
  eq(mod.ezikNativeSessionOf(good), null, 'what a browser tab made of a valid payload');
  is(mod.ezikNativeAuthReceive(good) === false, 'a browser tab accepted a handed-over session');
  eq(tab.storage.keys(), [], 'keys a browser tab wrote');
  // And a bridge-shaped object that is not a bridge is not one either.
  for (const shape of [{}, { postMessage: 1 }, { postMessage: null }]) {
    const fake = scene({ shell: false });
    fake.win.ReactNativeWebView = shape;
    const m2 = build(fake);
    eq(m2.ezikNativeSessionOf(good), null, 'accepted through ' + JSON.stringify(shape));
  }
  return 'no bridge and 3 non-bridges: 0 sessions written';
});

run('every malformed shape is refused whole, and none of them writes half a session', () => {
  const scn = scene({});
  const mod = build(scn);
  const base = () => ({
    type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true,
    session: FIXTURE.session, email: FIXTURE.email, provider: 'apple',
  });
  const bad = [];
  bad.push(['no payload at all', null]);
  bad.push(['a string', 'session']);
  bad.push(['an array', [base()]]);
  bad.push(['another channel', Object.assign(base(), { type: 'ezik:auth:result' })]);
  bad.push(['the version as the NUMBER 1', Object.assign(base(), { v: 1 })]);
  bad.push(['a version this page does not speak', Object.assign(base(), { v: '2' })]);
  bad.push(['ok absent', (function () { const o = base(); delete o.ok; return o; }())]);
  bad.push(['ok false', Object.assign(base(), { ok: false })]);
  bad.push(['session absent', (function () { const o = base(); delete o.session; return o; }())]);
  bad.push(['session empty', Object.assign(base(), { session: '' })]);
  bad.push(['session not a string', Object.assign(base(), { session: 42 })]);
  bad.push(['a provider nobody holds', Object.assign(base(), { provider: 'facebook' })]);
  bad.push(['no provider', (function () { const o = base(); delete o.provider; return o; }())]);
  for (const [what, payload] of bad) {
    eq(mod.ezikNativeSessionOf(payload), null, 'refused: ' + what);
    is(mod.ezikNativeAuthReceive(payload) === false, 'received: ' + what);
  }
  eq(scn.storage.keys(), [], 'keys written by ' + bad.length + ' malformed payloads');
  // AND THE ONE FIELD THAT MAY BE MISSING IS THE ADDRESS, normalised the way the exchange
  // already normalises it -- an account with no verified address is a lawful account.
  const noEmail = base();
  delete noEmail.email;
  eq(mod.ezikNativeSessionOf(noEmail), { session: FIXTURE.session, email: '', provider: 'apple' },
    'a payload with no address');
  // BOTH names lib/auth/oidc.js holds are taken, and they are read from the file's own list.
  for (const name of mod.SHELL_AUTH_PROVIDERS) {
    is(mod.ezikNativeSessionOf(Object.assign(base(), { provider: name })) !== null,
      'refused the provider ' + name + ', which the page itself names');
  }
  return bad.length + ' malformed payloads refused, 0 keys written, '
    + mod.SHELL_AUTH_PROVIDERS.length + ' providers accepted';
});

run('whoever is listening is told, and only after the session is already stored', () => {
  const scn = scene({});
  const mod = build(scn);
  const seen = [];
  const sub = (got) => { seen.push([got.provider, mod.readAuthSession() !== null]); };
  mod.EZIK_NATIVE_AUTH_SUBS.add(sub);
  mod.ezikNativeAuthReceive({
    type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true,
    session: FIXTURE.session, email: '', provider: 'apple',
  });
  eq(seen, [['apple', true]], 'what the subscriber saw');
  // A SUBSCRIBER THAT THROWS COSTS NOTHING. The session is already written by then, and one
  // broken listener must not take the others down with it.
  mod.EZIK_NATIVE_AUTH_SUBS.add(() => { throw new Error('a listener threw'); });
  const after = [];
  mod.EZIK_NATIVE_AUTH_SUBS.add(() => { after.push(1); });
  mod.ezikNativeAuthReceive({
    type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true,
    session: 'sess-99', email: '', provider: 'google',
  });
  eq(after, [1], 'listeners reached past the one that threw');
  eq(mod.readAuthSession().session, 'sess-99', 'the session stored past the throw');
  return '1 subscriber told after the write; a throwing listener costs nothing';
});

// ---------------------------------------------------------------------------
// THE FLAG -- both provider doors, off the entry screen, on the shell's word.
// ---------------------------------------------------------------------------
run('the doors are drawn by default, and only the literal true takes them away', () => {
  const scn = scene({});
  const mod = build(scn);
  const bridge = scn.win.ReactNativeWebView;
  is(mod.ezikShellHidesSocialSignIn() === false, 'an undeclared flag hid the doors');
  is(mod.ezikEntryDoors(bridge) === true, 'the doors were not drawn with a shell and no flag');
  // NOT INFERRED. Every one of these is a value that is truthy, or nearly a declaration, and
  // not one of them is the declaration -- a switch that can be turned on by accident will be.
  for (const v of ['true', 'yes', 1, {}, [], 'false', 0, null, undefined]) {
    scn.win[mod.SHELL_HIDE_SOCIAL_FLAG] = v;
    is(mod.ezikShellHidesSocialSignIn() === false,
      'a non-boolean ' + JSON.stringify(v) + ' declared the flag');
    is(mod.ezikEntryDoors(bridge) === true, 'the doors went on ' + JSON.stringify(v));
  }
  scn.win[mod.SHELL_HIDE_SOCIAL_FLAG] = true;
  is(mod.ezikShellHidesSocialSignIn() === true, 'the literal true did not declare the flag');
  is(mod.ezikEntryDoors(bridge) === false, 'the doors survived the declaration');
  // AND THE FLAG IS NOT A SHELL. Declared or not, a browser tab has no doors either way, so
  // the four other contracts -- every one of which tests the bridge and not this -- are
  // untouched by whichever way it is set.
  const tab = scene({ shell: false });
  const tabMod = build(tab);
  is(tabMod.ezikEntryDoors(null) === false, 'a tab drew the doors');
  tab.win[tabMod.SHELL_HIDE_SOCIAL_FLAG] = true;
  is(tabMod.ezikEntryDoors(null) === false, 'a tab drew the doors with the flag declared');
  return '9 near-declarations refused; the literal true accepted; a tab unaffected either way';
});

// ---------------------------------------------------------------------------
// THE ENTRY CARD -- the two doors, drawn or taken away, with the guest door standing.
// ---------------------------------------------------------------------------

/** The entry card, mounted. `onStart` is never reached by any case here and throws if it is. */
function mountEntry(scn, factory) {
  return mountRow(scn, factory || makeEntry, (m) => m.Onboarding,
    { onStart: () => { throw new Error('the entry step called onStart'); } });
}
/** Every button on the card, by the text it actually draws. */
function buttonsOf(tree) {
  return nodesOf(tree).reduce(function walk(acc, n) {
    if (n.tag === 'button') acc.push(textOf(n.children || []));
    (n.children || []).reduce(walk, acc);
    return acc;
  }, []);
}

run('inside the shell the entry card draws both doors, with the guest door beside them', () => {
  const scn = scene({});
  const m = mountEntry(scn);
  const drawn = buttonsOf(m.tree());
  const ar = m.mod.EZ_I18N.ar;
  eq(drawn, [ar['entry.google'], ar['entry.apple'], ar['entry.guest']],
    'the buttons on the entry card inside the shell');
  is(textOf(nodesOf(m.tree())).indexOf(ar['entry.inApp']) === -1,
    'the browser sentence is drawn inside the shell, where it is false');
  return '3 buttons: google, apple, guest';
});

run('the shell can ask for both doors to go, and only the guest door is left', () => {
  const scn = scene({});
  // DECLARED BEFORE THE CARD IS DRAWN, which is the contract: the shell sets it on the window
  // before this page's own script runs.
  scn.win['EZIK_SHELL_HIDE_SOCIAL_SIGNIN'] = true;
  const m = mountEntry(scn);
  const ar = m.mod.EZ_I18N.ar;
  const drawn = buttonsOf(m.tree());
  eq(drawn, [ar['entry.guest']], 'the buttons left after the declaration');
  // A DOOR REMOVED IS ONLY REMOVED IF NOTHING OF IT IS LEFT: not the label somewhere else on
  // the card, and not the browser sentence standing in a seat that is not its own.
  const text = textOf(nodesOf(m.tree()));
  is(text.indexOf(ar['entry.google']) === -1, 'the Google label survived the declaration');
  is(text.indexOf(ar['entry.apple']) === -1, 'the Apple label survived the declaration');
  is(text.indexOf(ar['entry.inApp']) === -1, 'the browser sentence took the doors\' seat');
  is(text.indexOf(ar['entry.guestWarn']) !== -1, 'the guest warning went with the doors');
  return '1 button: guest, with its warning; 0 provider labels anywhere on the card';
});

run('a browser tab is unaffected by the declaration, in both directions', () => {
  // THE FLAG IS NOT A BRIDGE. A tab never drew the doors and still does not; the sentence that
  // stands in their seat there is still the sentence. This is the case that says the switch
  // cannot reach anything the four other contracts read.
  for (const declared of [false, true]) {
    const tab = scene({ shell: false });
    if (declared) tab.win['EZIK_SHELL_HIDE_SOCIAL_SIGNIN'] = true;
    const m = mountEntry(tab);
    const ar = m.mod.EZ_I18N.ar;
    eq(buttonsOf(m.tree()), [ar['entry.guest']], 'buttons in a tab, declared=' + declared);
    is(textOf(nodesOf(m.tree())).indexOf(ar['entry.inApp']) !== -1,
      'the browser sentence went missing in a tab, declared=' + declared);
  }
  return 'a tab draws 1 button and the sentence, declared or not';
});

run('a session handed over by the shell moves the card off the question it answered', () => {
  const scn = scene({});
  const m = mountEntry(scn);
  const ar = m.mod.EZ_I18N.ar;
  eq(buttonsOf(m.tree()), [ar['entry.google'], ar['entry.apple'], ar['entry.guest']],
    'the card before the session lands');
  // THE SHELL SPEAKS FIRST, and the card is not the thing listening -- the root is. What the
  // card subscribes to is the fact that a session was written.
  is(m.mod.ezikNativeAuthReceive({
    type: m.mod.SHELL_AUTH_SESSION, v: m.mod.SHELL_AUTH_V, ok: true,
    session: FIXTURE.session, email: FIXTURE.email, provider: 'apple',
  }) === true, 'the handed-over session was refused');
  eq(m.mod.readAuthSession().session, FIXTURE.session, 'the session stored');
  const after = buttonsOf(m.tree());
  is(after.indexOf(ar['entry.google']) === -1 && after.indexOf(ar['entry.apple']) === -1,
    'the card is still asking a question that has been answered: ' + JSON.stringify(after));
  is(textOf(nodesOf(m.tree())).indexOf(ar['onboarding.welcome']) !== -1,
    'the card did not move to the step behind the entry screen');
  // AND A REFUSED PAYLOAD MOVES NOTHING -- the control that proves the case above is real.
  const still = scene({});
  const m2 = mountEntry(still);
  is(m2.mod.ezikNativeAuthReceive({
    type: m2.mod.SHELL_AUTH_SESSION, v: m2.mod.SHELL_AUTH_V, ok: true,
    session: '', email: '', provider: 'apple',
  }) === false, 'an empty session was accepted');
  eq(buttonsOf(m2.tree()),
    [m2.mod.EZ_I18N.ar['entry.google'], m2.mod.EZ_I18N.ar['entry.apple'], m2.mod.EZ_I18N.ar['entry.guest']],
    'the card after a refused payload');
  return 'a valid session advances the card; a refused one leaves all three doors standing';
});

// ---------------------------------------------------------------------------
// THE MUTANTS -- the same lifted source with one line changed, each of which must be KILLED.
// ---------------------------------------------------------------------------
const mutants = [];
function mutant(name, from, to, killedBy) {
  const at = HARNESS_JSX.indexOf(from);
  if (at === -1) { mutants.push({ name: name, applied: false, killed: false, note: 'the line to mutate is gone: ' + from }); return; }
  if (HARNESS_JSX.indexOf(from, at + 1) !== -1) { mutants.push({ name: name, applied: false, killed: false, note: 'the line to mutate is not unique' }); return; }
  const src = HARNESS_JSX.slice(0, at) + to + HARNESS_JSX.slice(at + from.length);
  let factory = null;
  try { factory = new Function('env', compile(src)); }
  catch (e) { mutants.push({ name: name, applied: true, killed: false, note: 'the mutant does not compile: ' + e.message }); return; }
  let died = null;
  try { killedBy(factory); }
  catch (e) { died = e.message; }
  mutants.push({ name: name, applied: true, killed: died !== null, note: died || 'SURVIVED -- no case above bites it' });
}

mutant('م١ a deadline is armed on the press',
  '  try { window.addEventListener(SHELL_AUTH_RESULT, onResult); }',
  '  setTimeout(function () { stop(); onDone({ ok: false, reason: \'browser-failed\' }); }, 30000);\n'
  + '  try { window.addEventListener(SHELL_AUTH_RESULT, onResult); }',
  (f) => {
    const p = press({}, f);
    eq(p.clock.pending(), 0, 'timers the press left running');
    eq(p.clock.delays(), [], 'deadlines armed by the press');
  });

mutant('م٢ a reply is accepted without matching the request id',
  '    if (d.id !== id) return;', '    if (false) return;',
  (f) => {
    const p = press({}, f);
    p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,
      reply(CONTRACT, sentId(p) + '-x', { ok: false, reason: 'browser-failed' }));
    eq(p.btn().props.disabled, true, 'the button after ANOTHER press\'s answer');
    eq(p.win.live(CONTRACT.SHELL_AUTH_RESULT), 1, 'listeners after another press\'s answer');
  });

mutant('م٣ the version crosses as the NUMBER 1',
  "const SHELL_AUTH_V = '1';", 'const SHELL_AUTH_V = 1;',
  (f) => {
    const p = press({}, f);
    const m = JSON.parse(p.sent[0]);
    eq(typeof m.v, 'string', 'v crossed the bridge as a ' + typeof m.v);
  });

mutant('م٤ the client-state comparison is dropped',
  "    if (p.get('state') !== csRef.current) { settle(ezT('auth.stateMismatch')); return; }",
  "    if (false) { settle(ezT('auth.stateMismatch')); return; }",
  (f) => {
    const p = press({}, f);
    p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT, reply(CONTRACT, sentId(p),
      { ok: true, url: 'ezik://auth/return?ticket=' + FIXTURE.ticket + '&state=someone-else' }));
    eq(p.fetch.calls.length, 0, 'exchanges made for a state that did not match');
  });

mutant('م٥ `dismissed` is drawn as a red line like every other refusal',
  '  if (SHELL_AUTH_CLASSES[r] === SHELL_AUTH_QUIET) return \'\';',
  '  if (SHELL_AUTH_CLASSES[r] === SHELL_AUTH_QUIET) return ezT(SHELL_AUTH_LINES[SHELL_AUTH_REASON_OTHER]);',
  (f) => {
    const p = press({}, f);
    p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT, reply(CONTRACT, sentId(p), { ok: false, reason: 'dismissed' }));
    const drawn = textOf(nodesOf(p.m.tree()));
    eq(drawn, CONTRACT.EZ_I18N.ar['auth.signIn'],
      'what is drawn after the reader simply closed the sheet');
  });

mutant('م٦ the button is drawn outside the shell as well',
  '  if (!bridge) return null;', '  if (false) return null;',
  (f) => {
    const outside = scene({ shell: false });
    const m = mountRow(outside, f);
    eq(countNodes(nodesOf(m.tree())), 0, 'nodes drawn in a browser tab');
  });

mutant('م٧ the origin test on the fifth channel is dropped',
  '  if (!ezikAuthBridge()) return null;', '  if (false) return null;',
  (f) => {
    const tab = scene({ shell: false });
    const mod = build(tab, f);
    mod.ezikNativeAuthReceive({
      type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true,
      session: FIXTURE.session, email: '', provider: 'apple',
    });
    eq(tab.storage.keys(), [], 'keys a browser tab wrote');
  });

mutant('م٨ the fifth channel stops requiring a session',
  "  if (typeof detail.session !== 'string' || !detail.session) return null;",
  '  if (false) return null;',
  (f) => {
    const scn = scene({});
    const mod = build(scn, f);
    mod.ezikNativeAuthReceive({
      type: mod.SHELL_AUTH_SESSION, v: mod.SHELL_AUTH_V, ok: true, email: '', provider: 'apple',
    });
    eq(scn.storage.keys(), [], 'keys written for a payload carrying no session');
  });

mutant('م٩ the hide flag accepts anything truthy',
  '  return window[SHELL_HIDE_SOCIAL_FLAG] === true;',
  '  return !!window[SHELL_HIDE_SOCIAL_FLAG];',
  (f) => {
    const scn = scene({});
    const mod = build(scn, f);
    scn.win[mod.SHELL_HIDE_SOCIAL_FLAG] = 'true';
    is(mod.ezikEntryDoors(scn.win.ReactNativeWebView) === true,
      'the string \'true\' took both doors away');
  });

mutant('م١١ the settings row goes back to reading the bridge alone',
  '  if (!session && ezikShellHidesSocialSignIn()) return null;', '  if (false) return null;',
  (f) => {
    const scn = scene({});
    scn.win['EZIK_SHELL_HIDE_SOCIAL_SIGNIN'] = true;
    const m = mountRow(scn, f);
    eq(countNodes(nodesOf(m.tree())), 0,
      'nodes drawn in Settings under the declaration');
  });

/** The same mutation discipline, over the entry card's own lift. */
function mutantEntry(name, from, to, killedBy) {
  const at = HARNESS_ENTRY_JSX.indexOf(from);
  if (at === -1) { mutants.push({ name: name, applied: false, killed: false, note: 'the line to mutate is gone: ' + from }); return; }
  if (HARNESS_ENTRY_JSX.indexOf(from, at + 1) !== -1) { mutants.push({ name: name, applied: false, killed: false, note: 'the line to mutate is not unique' }); return; }
  const src = HARNESS_ENTRY_JSX.slice(0, at) + to + HARNESS_ENTRY_JSX.slice(at + from.length);
  let factory = null;
  try { factory = new Function('env', compile(src)); }
  catch (e) { mutants.push({ name: name, applied: true, killed: false, note: 'the mutant does not compile: ' + e.message }); return; }
  let died = null;
  try { killedBy(factory); }
  catch (e) { died = e.message; }
  mutants.push({ name: name, applied: true, killed: died !== null, note: died || 'SURVIVED -- no case above bites it' });
}

mutantEntry('م١٠ the entry card goes back to reading the bridge alone',
  '          {ezikEntryDoors(bridge) ? (<>', '          {bridge ? (<>',
  (f) => {
    const scn = scene({});
    scn.win['EZIK_SHELL_HIDE_SOCIAL_SIGNIN'] = true;
    const m = mountEntry(scn, f);
    const ar = m.mod.EZ_I18N.ar;
    eq(buttonsOf(m.tree()), [ar['entry.guest']], 'the buttons left after the declaration');
  });

run('every mutant was applied and every one of them was killed', () => {
  is(mutants.length >= 11, 'only ' + mutants.length + ' mutants -- the floor is eleven');
  const notApplied = mutants.filter((m) => !m.applied).map((m) => m.name + ': ' + m.note);
  eq(notApplied, [], 'mutants that could not be applied');
  const survivors = mutants.filter((m) => !m.killed).map((m) => m.name + ': ' + m.note);
  eq(survivors, [], 'mutants that survived');
  return mutants.length + '/' + mutants.length + ' applied and killed';
});

// ---------------------------------------------------------------------------
// RUN, THEN REPORT.
// ---------------------------------------------------------------------------
(async () => {
  for (const item of queue) {
    try { results.push({ name: item.name, ok: true, detail: (await item.fn()) || '' }); }
    catch (e) { results.push({ name: item.name, ok: false, detail: e.message }); }
  }

  console.log('=== auth bridge -- the web half, measured ===');
  console.log('source:  app.jsx  ' + Buffer.byteLength(source, 'utf8') + ' bytes, '
    + source.split('\n').length + ' lines');
  console.log('lifted:  ezikAuthAsk@' + startLine(FN_ASK) + '  ezikAuthMessage@' + startLine(FN_MSG)
    + '  ezikAuthClientState@' + startLine(FN_CS) + '  EzikSignInRow@' + startLine(FN_ROW)
    + '  SettingsSheet@' + startLine(FN_SETTINGS));
  console.log('contract: ' + CONTRACT.SHELL_AUTH_REQUEST + ' -> ' + CONTRACT.SHELL_AUTH_RESULT
    + '  v=' + JSON.stringify(CONTRACT.SHELL_AUTH_V) + ' (' + typeof CONTRACT.SHELL_AUTH_V + ')'
    + '  reasons=' + Object.keys(CONTRACT.SHELL_AUTH_CLASSES).length
    + '  classes=' + new Set(Object.values(CONTRACT.SHELL_AUTH_CLASSES)).size
    + '  timers=0');
  console.log('store:   ' + CONTRACT.AUTH_SESSION_KEY + '  (MUST_GO)   origin='
    + CONTRACT.SHELL_AUTH_ORIGIN + '  return=' + CONTRACT.SHELL_AUTH_RETURN_SCHEME);
  console.log('');

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? '[PASS] ' : '[FAIL] ') + r.name);
    if (r.detail) console.log('        ' + r.detail);
  }
  console.log('');
  console.log('--- MUTANTS ---');
  for (const m of mutants) {
    console.log((m.killed ? '[KILLED]   ' : '[SURVIVED] ') + m.name);
    console.log('           ' + m.note);
  }
  console.log('');
  console.log('=== ' + (results.length - failed) + '/' + results.length + ' cases hold  ·  '
    + mutants.filter((m) => m.killed).length + '/' + mutants.length + ' mutants killed ===');
  if (failed) {
    console.log('-- FAILURES --');
    for (const r of results) { if (!r.ok) console.log('   * ' + r.name + ': ' + r.detail); }
  }
  process.exit(failed ? 1 : 0);
})();
