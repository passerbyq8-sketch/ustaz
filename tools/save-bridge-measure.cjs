// save-bridge-measure.cjs -- the save seam, proved without a browser, a phone or a network.
//
// WHAT THIS MEASURES AND WHY IT CAN. The web half of the download handshake is six things: a
// detector for the shell's injected bridge, one builder that turns a picture or a document into
// the seven fields the shell validates, one poster, a one-shot listener matched on the request's
// own id, the six lines a reader may be shown, and the deliberate ABSENCE of a deadline. Not one
// of those needs a DOM, a device, a canvas or a network -- they need a window with
// addEventListener on it, a document that can make an anchor, a Blob that can weigh a string, and
// a clock this tool can watch without letting it run. So this file builds those as fakes it fully
// controls, lifts the REAL source of the seam out of app.jsx, and runs it.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every function, every constant and every reader's
// line below is extracted from app.jsx by name through @babel/parser -- the same parser the babel
// gate and tools/build-app.cjs use -- and evaluated verbatim. Nothing here restates a contract
// word: `ezik:download:request`, the string "1", the six types, the four mebibytes, the five
// reasons and the six dictionary lines are all read from their own declarations at run time. If a
// name is renamed or a function deleted, extraction throws and this tool fails loudly rather than
// quietly measuring an older idea of the code.
//
// THE FAKES THROW WHERE THROWING IS THE POINT. On the browser path window.addEventListener is
// booby-trapped, so a press that attached a shell listener cannot pass by having its count read
// wrong. On the shell path document.createElement is booby-trapped, so a press that clicked the
// anchor as well cannot pass either. A counter asserted to be zero still passes when the call is
// made and the count is read wrong; a fake that throws cannot.
//
// AND IT CANNOT PASS BY DOING NOTHING. Six MUTANTS are compiled at the end from the same lifted
// source with one line changed each -- the version made a number, the data: prefix left on, a
// deadline added, the four-mebibyte limit raised, the id match removed, the size guessed from the
// encoded length -- and every one of them must be KILLED by a named case above. A tool that
// cannot go red proves nothing.
//
// Usage:  node tools/save-bridge-measure.cjs
// Exit:   0 when every case holds and every mutant dies; 1 with the failures named.
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

/** The whole top-level `const NAME = ...;` / `let NAME = ...;` statement, or throw. */
function topConst(name) {
  for (const n of ast.program.body) {
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier' && d.id.name === name) return n;
    }
  }
  throw new Error('app.jsx no longer declares the top-level binding ' + name);
}

/** The top-level declaration of NAME whatever its shape -- a function or a const, or throw. */
function topAny(name) {
  for (const n of ast.program.body) {
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) return n;
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier' && d.id.name === name) return d;
    }
  }
  throw new Error('app.jsx no longer declares ' + name + ' at the top level');
}

/** A `const NAME = ...` declarator sitting inside OWNER -- a component either shape. */
function innerConst(ownerName, name) {
  const owner = topAny(ownerName);
  let found = null;
  walk(owner, (n) => {
    if (n.type !== 'VariableDeclarator') return;
    if (n.id.type === 'Identifier' && n.id.name === name) found = n;
  });
  if (!found) throw new Error(ownerName + ' no longer declares ' + name);
  return found;
}

// The contract, the seam, the two deliveries, and the two presses. Every one of them by name.
const C_I18N = topConst('EZ_I18N');
const C_FALLBACK = topConst('EZ_LANG_FALLBACK');
const FN_T = topFunction('ezT');
const C_REQ = topConst('SHELL_DL_REQUEST');
const C_RES = topConst('SHELL_DL_RESULT');
const C_V = topConst('SHELL_DL_V');
const C_MIMES = topConst('SHELL_DL_MIMES');
const C_MAX = topConst('SHELL_DL_MAX_BYTES');
const C_LINES = topConst('SHELL_DL_LINES');
const C_OTHER = topConst('SHELL_DL_LINE_OTHER');
const C_NAMEFB = topConst('SHELL_DL_NAME_FALLBACK');
const C_SEQ = topConst('ezikDlSeq');
const FN_BRIDGE = topFunction('ezikDlBridge');
const FN_LINE = topFunction('ezikDlLine');
const FN_RAW = topFunction('ezikDlRawBytes');
const FN_SPLIT = topFunction('ezikDlSplitDataUrl');
const FN_NAME = topFunction('ezikDlName');
const FN_ID = topFunction('ezikDlId');
const FN_MSG = topFunction('ezikDlMessage');
const FN_ASK = topFunction('ezikDlAsk');
const FN_FROM_URL = topFunction('ezikDlFromDataUrl');
const FN_B64TEXT = topFunction('ezikDlB64Text');
const FN_FROM_TEXT = topFunction('ezikDlFromText');
const C_WORD_MIME = topConst('EZIK_WORD_MIME');
const C_WORD_DOC = topConst('ezikWordDoc');
const C_DOWNLOAD = topConst('downloadAsWord');
const C_ESCAPE = topConst('escapeHtml');
const C_CARD_FILE = topConst('EZIK_CARD_FILE');
const V_SAVE = innerConst('SaveReplyImageButton', 'doSave');
const V_EXPORT = innerConst('DocumentCard', 'exportDoc');

// THE HARNESS, ASSEMBLED FROM THE FILE ITSELF. Everything the seam cannot supply for itself --
// a window, a document, a Blob, a clock, the React setters the two presses close over -- arrives
// through `env`. Everything else is app.jsx's own text.
const HARNESS_PARTS = [
  '"use strict";',
  'const window = env.window;',
  'const document = env.document;',
  'const Blob = env.Blob;',
  'const URL = env.URL;',
  'const setTimeout = env.setTimeout;',
  'const clearTimeout = env.clearTimeout;',
  'const Date = env.Date;',
  'let EZ_LANG = env.lang;',
  text(C_FALLBACK),
  text(C_I18N),
  text(FN_T),
  text(C_REQ),
  text(C_RES),
  text(C_V),
  text(C_MIMES),
  text(C_MAX),
  text(C_LINES),
  text(C_OTHER),
  text(C_NAMEFB),
  text(FN_BRIDGE),
  text(FN_LINE),
  text(FN_RAW),
  text(FN_SPLIT),
  text(FN_NAME),
  text(C_SEQ),
  text(FN_ID),
  text(FN_MSG),
  text(FN_ASK),
  text(FN_FROM_URL),
  text(FN_B64TEXT),
  text(FN_FROM_TEXT),
  text(C_WORD_MIME),
  text(C_ESCAPE),
  text(C_WORD_DOC),
  text(C_DOWNLOAD),
  text(C_CARD_FILE),
  // The two presses, each with its component's surroundings handed in rather than invented.
  'const getText = env.getText;',
  'const getSource = env.getSource;',
  'const setFlash = env.setFlash;',
  'const setSaid = env.setSaid;',
  'const busyRef = env.busyRef;',
  'const stopRef = env.stopRef;',
  'const ezikDrawReplyCard = env.ezikDrawReplyCard;',
  'const title = env.title;',
  'const content = env.content;',
  'const docToHtml = env.docToHtml;',
  'const ' + text(V_SAVE) + ';',
  'const ' + text(V_EXPORT) + ';',
  'return {',
  '  doSave: doSave, exportDoc: exportDoc,',
  '  ezikDlRawBytes: ezikDlRawBytes, ezikDlSplitDataUrl: ezikDlSplitDataUrl,',
  '  ezikDlName: ezikDlName, ezikDlMessage: ezikDlMessage, ezikDlLine: ezikDlLine,',
  '  ezikDlB64Text: ezikDlB64Text, ezikWordDoc: ezikWordDoc,',
  '  SHELL_DL_REQUEST: SHELL_DL_REQUEST, SHELL_DL_RESULT: SHELL_DL_RESULT,',
  '  SHELL_DL_V: SHELL_DL_V, SHELL_DL_MIMES: SHELL_DL_MIMES,',
  '  SHELL_DL_MAX_BYTES: SHELL_DL_MAX_BYTES, SHELL_DL_LINES: SHELL_DL_LINES,',
  '  SHELL_DL_LINE_OTHER: SHELL_DL_LINE_OTHER, EZIK_WORD_MIME: EZIK_WORD_MIME,',
  '  EZIK_CARD_FILE: EZIK_CARD_FILE, EZ_I18N: EZ_I18N,',
  '  setLang: function (v) { EZ_LANG = v; },',
  '};',
];
const HARNESS = HARNESS_PARTS.join('\n');

// The contract words, read from the lifted declarations rather than restated here. Every literal
// this file compares against below comes out of this object, so a renamed message type or a
// changed limit moves the expectation with the code instead of leaving it behind.
const CONTRACT = new Function('env', HARNESS)(baseEnv());

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

/** A window with a real listener registry, so "is a listener still attached" is a fact. */
function fakeWindow(opts) {
  const o = opts || {};
  const listeners = [];
  const w = {
    addEventListener(type, fn) {
      if (o.trapListen) throw new Error('FORBIDDEN: ' + o.trapListen + ' attached a listener for ' + type);
      listeners.push({ type: type, fn: fn });
    },
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
  if (o.bridge) w.ReactNativeWebView = o.bridge;
  return w;
}

/** A document whose anchors record what was set on them and when they were clicked. */
function fakeDocument(clicks, trap) {
  const attached = [];
  return {
    body: {
      appendChild(n) { attached.push(n); },
      removeChild(n) { const i = attached.indexOf(n); if (i !== -1) attached.splice(i, 1); },
      attached: attached,
    },
    createElement(tag) {
      if (trap) throw new Error('FORBIDDEN: ' + trap + ' created a <' + tag + '> to click');
      const el = { tag: tag, href: '', download: '' };
      el.click = function () { clicks.push({ tag: el.tag, href: el.href, download: el.download }); };
      return el;
    },
  };
}

/** A Blob that weighs its parts in UTF-8 bytes, which is exactly what a real one reports. */
const enc = new TextEncoder();
function FakeBlob(parts, opts) {
  const t = (parts || []).map((p) => String(p)).join('');
  this.size = enc.encode(t).length;
  this.type = (opts && opts.type) || '';
  this.text = t;
}

function fakeUrl(objectUrls) {
  return {
    createObjectURL(b) { objectUrls.push(b); return 'blob:ezik/' + objectUrls.length; },
    revokeObjectURL(u) { objectUrls.revoked = (objectUrls.revoked || 0) + 1; },
  };
}

/** A clock the test drives, so nothing costs wall-clock and a pending timer is a countable fact. */
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

function recordingBridge(sent) { return { postMessage: (s) => { sent.push(s); } }; }
function throwingBridge() {
  return { postMessage: () => { throw new Error('the bridge refused the message'); } };
}

/** The minimum env the contract read above needs; it presses nothing. */
function baseEnv() {
  const clock = fakeClock();
  return {
    window: fakeWindow({}),
    document: fakeDocument([], null),
    Blob: FakeBlob,
    URL: fakeUrl([]),
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Date: { now: () => 1756000000000 },
    lang: 'ar',
    getText: () => '',
    getSource: () => '',
    setFlash: () => {},
    setSaid: () => {},
    busyRef: { current: false },
    stopRef: { current: null },
    ezikDrawReplyCard: () => ({ url: '' }),
    title: '',
    content: '',
    docToHtml: () => '',
  };
}

// ---------------------------------------------------------------------------
// THE SCENE -- one press-ready harness plus everything needed to inspect what a press did.
// ---------------------------------------------------------------------------
const CARD_B64 = 'iVBORw0KGgoAAAANSUhEUg==';          // 18 raw bytes, standard alphabet, padded
const CARD_URL = 'data:image/png;base64,' + CARD_B64;
const DOC_BODY = '<h1>Q</h1><p>وثيقةٌ صغيرةٌ للقياس</p>';
const DOC_TITLE = 'مستند';

function scene(opts, factory) {
  const o = opts || {};
  const make = factory || makeHarness;
  const sent = [];
  const clicks = [];
  const flashes = [];
  const saids = [];
  const objectUrls = [];
  const clock = fakeClock();

  let bridge = null;
  if (o.shell === 'recording') bridge = recordingBridge(sent);
  else if (o.shell === 'throwing') bridge = throwingBridge();
  else if (o.shell === 'shaped') bridge = o.shaped;

  const win = fakeWindow({
    bridge: bridge,
    trapListen: (o.shell === undefined || o.shell === null || o.shell === 'shaped') ? (o.label || 'the browser path') : null,
  });
  const env = {
    window: win,
    document: fakeDocument(clicks, o.trapAnchor ? (o.label || 'the shell path') : null),
    Blob: FakeBlob,
    URL: fakeUrl(objectUrls),
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Date: { now: () => 1756000000000 },
    lang: o.lang || 'ar',
    getText: () => (o.text === undefined ? 'a reply worth keeping' : o.text),
    getSource: () => '',
    setFlash: (v) => { flashes.push(v); },
    setSaid: (v) => { saids.push(v); },
    busyRef: { current: false },
    stopRef: { current: null },
    ezikDrawReplyCard: () => {
      if (o.cardThrows) throw new Error('the canvas refused');
      return { url: o.cardUrl === undefined ? CARD_URL : o.cardUrl };
    },
    title: o.title === undefined ? DOC_TITLE : o.title,
    content: 'ignored -- docToHtml below is what the press actually renders',
    docToHtml: () => (o.body === undefined ? DOC_BODY : o.body),
  };
  const h = make(env);
  if (o.lang) h.setLang(o.lang);
  return {
    h: h, env: env, win: win, clock: clock,
    sent: sent, clicks: clicks, flashes: flashes, saids: saids, objectUrls: objectUrls,
  };
}

const makeHarness = new Function('env', HARNESS);

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

/** The one message a press posted, parsed -- and it must be exactly one. */
function onlyMessage(s, what) {
  eq(s.sent.length, 1, (what || 'messages posted through the bridge'));
  return JSON.parse(s.sent[0]);
}

const okReply = (id) => ({ type: CONTRACT.SHELL_DL_RESULT, v: CONTRACT.SHELL_DL_V, id: id, ok: true });
const failReply = (id, reason) => ({
  type: CONTRACT.SHELL_DL_RESULT, v: CONTRACT.SHELL_DL_V, id: id, ok: false, reason: reason,
});

/* -- 1. NO SHELL: the old path, byte for byte, and not one message ---------- */

run('م١ without a shell: the anchor is clicked exactly as it was, and nothing is posted', () => {
  const s = scene({ shell: null, label: 'the browser image path' });
  s.h.doSave();
  eq(s.sent.length, 0, 'messages posted');
  eq(s.clicks.length, 1, 'anchors clicked');
  eq(s.clicks[0], { tag: 'a', href: CARD_URL, download: CONTRACT.EZIK_CARD_FILE }, 'the anchor');
  eq(s.saids, [], 'reader lines drawn in a browser');
  eq(s.flashes, [''], 'flash states across the press');
  eq(s.clock.pending(), 0, 'timers left');
  return '1 anchor -> ' + CONTRACT.EZIK_CARD_FILE + ', 0 messages, 0 listeners, 0 lines';
});

run('م٢ without a shell: the same anchor, the same .doc name, the same blob, nothing posted', () => {
  const s = scene({ shell: null, label: 'the browser document path' });
  s.h.exportDoc();
  eq(s.sent.length, 0, 'messages posted');
  eq(s.clicks.length, 1, 'anchors clicked');
  eq(s.clicks[0].tag, 'a', 'the element clicked');
  eq(s.clicks[0].download, DOC_TITLE + '.doc', 'the download name');
  is(/^blob:/.test(s.clicks[0].href), 'the href was not an object URL: ' + s.clicks[0].href);
  eq(s.objectUrls.length, 1, 'object URLs created');
  eq(s.objectUrls[0].type, CONTRACT.EZIK_WORD_MIME, 'the blob type the browser path writes');
  eq(s.saids, [], 'reader lines drawn in a browser');
  eq(s.env.document.body.attached.length, 0, 'anchors left attached to the document');
  eq(s.clock.delays(), [1000], 'the revoke the browser path has always scheduled, in ms');
  return '1 anchor -> ' + DOC_TITLE + '.doc, type ' + CONTRACT.EZIK_WORD_MIME
    + ', 1 object URL, 0 messages, 0 lines';
});

/* -- 2. WITH A SHELL: one message, seven fields, and `v` is a string -------- */

run('م١ inside the shell: ONE message, seven fields, their types, and v is a STRING', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell image path' });
  s.h.doSave();
  const m = onlyMessage(s);
  eq(Object.keys(m).sort(), ['b64', 'filename', 'id', 'mime', 'size', 'type', 'v'], 'the field names');
  eq(m.type, CONTRACT.SHELL_DL_REQUEST, 'the type field');
  eq(m.v, CONTRACT.SHELL_DL_V, 'the version field');
  is(typeof m.v === 'string', 'v crossed the bridge as a ' + typeof m.v + ', not a string');
  is(typeof m.id === 'string' && m.id.length > 0, 'id is not a non-empty string: ' + JSON.stringify(m.id));
  eq(m.mime, 'image/png', 'the mime field');
  is(CONTRACT.SHELL_DL_MIMES.indexOf(m.mime) !== -1, 'the mime is outside the six the shell writes');
  is(typeof m.size === 'number' && Math.trunc(m.size) === m.size, 'size is not a whole number');
  is(typeof m.b64 === 'string', 'b64 is not a string');
  is(typeof m.filename === 'string' && m.filename.length > 0, 'filename is not a non-empty string');
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 1, 'listeners waiting for the answer');
  eq(s.clock.pending(), 0, 'timers the web owns on this path');
  return '1 message, 7 fields, v=' + JSON.stringify(m.v) + ' (' + typeof m.v + '), mime='
    + m.mime + ', 1 listener, 0 timers';
});

run('م٢ inside the shell: ONE message, and the type is the one the builder actually builds', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell document path' });
  s.h.exportDoc();
  const m = onlyMessage(s);
  eq(Object.keys(m).sort(), ['b64', 'filename', 'id', 'mime', 'size', 'type', 'v'], 'the field names');
  eq(m.mime, CONTRACT.EZIK_WORD_MIME, 'the mime field');
  is(CONTRACT.SHELL_DL_MIMES.indexOf(m.mime) !== -1, 'the mime is outside the six');
  is(typeof m.v === 'string', 'v crossed the bridge as a ' + typeof m.v);
  eq(s.objectUrls.length, 0, 'object URLs created on the shell path');
  return '1 message, mime=' + m.mime + ' (measured from the Blob the builder makes), 0 object URLs';
});

run('the two presses cannot collide: every press carries its own id', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
  s.h.doSave();
  s.h.exportDoc();
  s.h.doSave();
  eq(s.sent.length, 3, 'messages posted');
  const ids = s.sent.map((x) => JSON.parse(x).id);
  eq(new Set(ids).size, 3, 'distinct ids across three presses: ' + ids.join(', '));
  return '3 presses, 3 distinct ids';
});

/* -- 3. THE FIVE PITFALLS OF b64 ------------------------------------------- */

run('b64 crosses with NO data: prefix, NO whitespace, NO base64url, length a multiple of 4', () => {
  for (const which of ['doSave', 'exportDoc']) {
    const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
    s.h[which]();
    const m = onlyMessage(s, 'messages from ' + which);
    is(m.b64.indexOf('data:') === -1, which + ': the data: prefix rode along inside b64');
    is(m.b64.indexOf(',') === -1, which + ': a comma survived inside b64');
    is(m.b64.indexOf(';base64') === -1, which + ': the ;base64 marker survived inside b64');
    is(!/\s/.test(m.b64), which + ': b64 carries whitespace');
    is(m.b64.indexOf('-') === -1 && m.b64.indexOf('_') === -1, which + ': b64 is base64url, not base64');
    is(/^[A-Za-z0-9+/]+={0,2}$/.test(m.b64), which + ': b64 is outside the standard alphabet');
    eq(m.b64.length % 4, 0, which + ': b64 length modulo 4');
  }
  return 'both presses: no prefix, no whitespace, no -/_, length % 4 == 0';
});

run('the splitter takes the prefix off THROUGH THE COMMA, and refuses what is not a data: URL', () => {
  eq(CONTRACT.ezikDlSplitDataUrl(CARD_URL), { mime: 'image/png', b64: CARD_B64 }, 'a plain data: URL');
  const bad = ['', 'blob:ezik/1', 'https://example.invalid/a.png', 'data:image/png,ABC',
    'image/png;base64,ABC', 'data:image/png;base64', null, undefined, 42, {}];
  for (const b of bad) {
    eq(CONTRACT.ezikDlSplitDataUrl(b), null, 'the split of ' + JSON.stringify(b));
  }
  return '1 real data: URL split, ' + bad.length + ' non-URLs refused';
});

run('a b64 the shell would refuse is refused HERE, and the five shapes are named', () => {
  const shapes = {
    'base64url -': 'ab-d',
    'base64url _': 'ab_d',
    'a newline inside': 'AB\nCD',
    'a space inside': 'AB CD',
    'not a multiple of four': 'ABCDE',
    'padding in the middle': 'A=BC',
    'three pad characters': 'A===',
    'nothing but padding': '====',
    'empty': '',
  };
  for (const k of Object.keys(shapes)) {
    eq(CONTRACT.ezikDlRawBytes(shapes[k]), -1, 'the raw byte count of ' + k);
  }
  eq(CONTRACT.ezikDlRawBytes('AAAA'), 3, 'the raw byte count of AAAA');
  eq(CONTRACT.ezikDlRawBytes('AAA='), 2, 'the raw byte count of AAA=');
  eq(CONTRACT.ezikDlRawBytes('AA=='), 1, 'the raw byte count of AA==');
  return Object.keys(shapes).length + ' refused shapes, 3 padding lengths measured exactly';
});

/* -- 4. size IS the raw length, from a Blob and from a data: URL ------------ */

run('م١ size equals the raw length computed from the encoding, not the encoded length', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell image path' });
  s.h.doSave();
  const m = onlyMessage(s);
  const expected = Buffer.from(CARD_B64, 'base64').length;
  eq(m.size, expected, 'the size field against the bytes the encoding really stands for');
  is(m.size !== m.b64.length, 'size was filled with the ENCODED length');
  eq(CONTRACT.ezikDlRawBytes(m.b64), m.size, 'the count re-derived from the very characters sent');
  return 'size=' + m.size + ' raw, b64 length=' + m.b64.length + ' -- and the shell re-derives ' + m.size;
});

run('م٢ size equals blob.size, byte for byte, and the b64 decodes back to the same document', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell document path' });
  s.h.exportDoc();
  const m = onlyMessage(s);
  // The document the BROWSER path would have written, built through the same one builder.
  const doc = s.h.ezikWordDoc(DOC_TITLE, DOC_TITLE, '<h1>' + DOC_TITLE + '</h1>' + DOC_BODY);
  eq(m.size, doc.blob.size, 'the size field against the Blob the browser path weighs');
  eq(CONTRACT.ezikDlRawBytes(m.b64), m.size, 'the count re-derived from the characters sent');
  const back = Buffer.from(m.b64, 'base64').toString('utf8');
  eq(back.length, doc.html.length, 'the length of the document decoded back out of b64');
  is(back === doc.html, 'the bytes the shell receives are not the bytes the browser would write');
  return 'size=' + m.size + ' = blob.size = re-derived from b64; decoded === the browser document';
});

run('a second count that disagrees stops the send dead rather than sending a number it cannot back', () => {
  const built = CONTRACT.ezikDlMessage('text/plain', 'AAAA', 3, 'x', 'id-1');
  eq(built.reason, null, 'the reason when the two counts agree');
  eq(built.msg.size, 3, 'the size when the two counts agree');
  const wrong = CONTRACT.ezikDlMessage('text/plain', 'AAAA', 4, 'x', 'id-1');
  eq(wrong.msg, null, 'the message when the two counts disagree');
  eq(wrong.reason, 'bad-payload', 'the reason when the two counts disagree');
  return 'agree -> size 3 sent; disagree -> nothing sent, bad-payload';
});

run('the six the shell writes are the six that may cross, and a seventh is refused unsent', () => {
  for (const mime of CONTRACT.SHELL_DL_MIMES) {
    const b = CONTRACT.ezikDlMessage(mime, 'AAAA', null, 'x', 'id-1');
    eq(b.reason, null, 'the reason for ' + mime);
    eq(b.msg.mime, mime, 'the mime carried for ' + mime);
  }
  for (const mime of ['image/jpeg', 'application/zip', 'text/csv', 'IMAGE/PNG', '', null, 7]) {
    const b = CONTRACT.ezikDlMessage(mime, 'AAAA', null, 'x', 'id-1');
    eq(b.msg, null, 'the message for ' + JSON.stringify(mime));
    eq(b.reason, 'unsupported-type', 'the reason for ' + JSON.stringify(mime));
  }
  return CONTRACT.SHELL_DL_MIMES.length + ' accepted, 7 refused as unsupported-type';
});

run('the extension is the shell\'s to add, so no filename carries one across', () => {
  eq(CONTRACT.ezikDlName('ezik-reply.png'), 'ezik-reply', 'the card file name');
  eq(CONTRACT.ezikDlName('report.doc'), 'report', 'a .doc name');
  eq(CONTRACT.ezikDlName('a/b\\c:d'), 'a b c d', 'a name carrying path separators');
  eq(CONTRACT.ezikDlName(''), CONTRACT.SHELL_DL_LINE_OTHER === '' ? '' : 'ezik', 'an empty name');
  eq(CONTRACT.ezikDlName(null), 'ezik', 'a null name');
  eq(CONTRACT.ezikDlName('.png'), 'ezik', 'a name that is nothing but an extension');
  eq(CONTRACT.ezikDlName('مستند'), 'مستند', 'an Arabic name with no extension');
  for (const which of ['doSave', 'exportDoc']) {
    const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
    s.h[which]();
    const m = onlyMessage(s, 'messages from ' + which);
    is(!/\.(png|doc|docx|pdf|txt|html)$/i.test(m.filename),
      which + ' sent an extension in the filename: ' + m.filename);
  }
  return 'ezik-reply.png -> ezik-reply; both presses send a bare name';
});

/* -- 5. FOUR MEBIBYTES, REFUSED ON THIS SIDE ------------------------------- */

run('exactly four mebibytes still goes; one byte more is never posted, and the reader is told', () => {
  const MAX = CONTRACT.SHELL_DL_MAX_BYTES;
  eq(MAX, 4 * 1024 * 1024, 'the limit this end mirrors');
  // A base64 string of exactly MAX raw bytes, and one of MAX+2.
  const atLen = ((MAX + 2) / 3) * 4;
  is(Math.trunc(atLen) === atLen, 'the boundary string is not a whole number of characters');
  const at = 'A'.repeat(atLen - 2) + '==';
  const over = 'A'.repeat(atLen);
  eq(CONTRACT.ezikDlRawBytes(at), MAX, 'the raw byte count of the boundary string');
  eq(CONTRACT.ezikDlRawBytes(over), MAX + 2, 'the raw byte count of the oversized string');

  const ok = scene({ shell: 'recording', trapAnchor: true, cardUrl: 'data:image/png;base64,' + at });
  ok.h.doSave();
  eq(ok.sent.length, 1, 'messages for a file of exactly the limit');
  eq(JSON.parse(ok.sent[0]).size, MAX, 'the size posted at the limit');

  const big = scene({ shell: 'recording', trapAnchor: true, cardUrl: 'data:image/png;base64,' + over });
  big.h.doSave();
  eq(big.sent.length, 0, 'messages for a file over the limit');
  eq(big.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners left after an oversized press');
  eq(big.clock.pending(), 0, 'timers left after an oversized press');
  eq(big.saids.length, 2, 'setSaid calls across the oversized press');
  const line = big.saids[big.saids.length - 1];
  eq(line, CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['too-large']], 'the line the reader is shown');
  is(line.indexOf('too-large') === -1, 'the reason code reached the reader: ' + line);
  return MAX + ' bytes posted; ' + (MAX + 2) + ' bytes -> 0 messages and one line';
});

/* -- 6. THE FIVE REASONS, AND THE SIXTH THAT IS NOT ONE -------------------- */

run('every one of the five reasons becomes a line, in BOTH languages, and never a code', () => {
  const reasons = Object.keys(CONTRACT.SHELL_DL_LINES);
  eq(reasons.length, 5, 'the reasons the contract names');
  for (const lang of ['ar', 'en']) {
    for (const r of reasons) {
      const key = CONTRACT.SHELL_DL_LINES[r];
      const dict = CONTRACT.EZ_I18N[lang];
      is(Object.prototype.hasOwnProperty.call(dict, key), lang + ' has no line for ' + key);
      const s = scene({ shell: 'recording', trapAnchor: true, lang: lang });
      s.h.doSave();
      const id = onlyMessage(s).id;
      s.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id, r));
      const line = s.saids[s.saids.length - 1];
      eq(line, dict[key], lang + ' line for ' + r);
      is(line.trim().length > 3, lang + ' line for ' + r + ' is too short to be a sentence');
      is(line.indexOf(r) === -1, lang + ' printed the reason code itself: ' + line);
      is(line.indexOf(key) === -1, lang + ' printed the dictionary key itself: ' + line);
    }
  }
  return '5 reasons x 2 languages = 10 lines, 0 codes, 0 keys';
});

run('a SIXTH reason -- from a newer shell, or none at all -- gets the general line, not a code', () => {
  const strangers = ['quota-exceeded', 'permission-denied', '', 'TOO-LARGE', null, undefined, 7,
    { reason: 'too-large' }, ['too-large']];
  for (const lang of ['ar', 'en']) {
    const general = CONTRACT.EZ_I18N[lang][CONTRACT.SHELL_DL_LINE_OTHER];
    is(typeof general === 'string' && general.trim().length > 3, lang + ' has no general line');
    for (const r of strangers) {
      const s = scene({ shell: 'recording', trapAnchor: true, lang: lang });
      s.h.doSave();
      const id = onlyMessage(s).id;
      s.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id, r));
      const line = s.saids[s.saids.length - 1];
      eq(line, general, lang + ' line for the stranger ' + JSON.stringify(r));
      is(line.indexOf(String(r)) === -1 || String(r) === '',
        lang + ' printed the stranger itself: ' + line);
    }
  }
  return strangers.length + ' strangers x 2 languages, every one the general line';
});

run('ok:true says nothing at all -- a cancelled share sheet is not a failure to announce', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
  s.h.doSave();
  const id = onlyMessage(s).id;
  s.win.dispatch(CONTRACT.SHELL_DL_RESULT, okReply(id));
  eq(s.saids, ['', ''], 'the lines drawn across a successful press');
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners left after the answer');
  return 'ok:true -> the line is cleared and nothing is claimed';
});

run('the six lines are keys in BOTH halves of the dictionary, in the same relative position', () => {
  const keys = Object.keys(CONTRACT.SHELL_DL_LINES).map((r) => CONTRACT.SHELL_DL_LINES[r])
    .concat([CONTRACT.SHELL_DL_LINE_OTHER]);
  eq(keys.length, 6, 'the lines the pipe can show');
  const ar = Object.keys(CONTRACT.EZ_I18N.ar);
  const en = Object.keys(CONTRACT.EZ_I18N.en);
  for (const k of keys) {
    is(ar.indexOf(k) !== -1, 'ar is missing ' + k);
    is(en.indexOf(k) !== -1, 'en is missing ' + k);
    eq(ar.indexOf(k), en.indexOf(k), 'the position of ' + k + ' in the two dictionaries');
    is(String(CONTRACT.EZ_I18N.ar[k]).trim() !== '', 'ar ' + k + ' is empty');
    is(String(CONTRACT.EZ_I18N.en[k]).trim() !== '', 'en ' + k + ' is empty');
    is(CONTRACT.EZ_I18N.ar[k] !== CONTRACT.EZ_I18N.en[k], k + ' was never translated');
  }
  return '6 keys, both languages, same index, none empty, none untranslated';
});

/* -- 7. NO DEADLINE ON THIS PATH ------------------------------------------- */

run('no timer is set by a shell press, and an answer minutes later still lands', () => {
  for (const which of ['doSave', 'exportDoc']) {
    const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
    s.h[which]();
    eq(s.clock.pending(), 0, which + ': timers the press left running');
    const id = onlyMessage(s, 'messages from ' + which).id;
    // Whatever a real clock did in between, nothing here can have fired: there is nothing to fire.
    s.clock.fireAll();
    eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 1, which + ': listeners after every timer fired');
    s.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id, 'write-failed'));
    eq(s.saids[s.saids.length - 1],
      CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['write-failed']], which + ': the line');
  }
  return 'both presses: 0 timers, listener survives every timer, the late answer lands';
});

run('STATIC: not one setTimeout exists anywhere on this path', () => {
  const BLOCK = [FN_BRIDGE, FN_LINE, FN_RAW, FN_SPLIT, FN_NAME, FN_ID, FN_MSG, FN_ASK,
    FN_FROM_URL, FN_B64TEXT, FN_FROM_TEXT];
  const bodies = BLOCK.map((n) => text(n));
  is(bodies.join('').length > 1500, 'the lifted block is too small to be the seam it claims to be');
  for (let i = 0; i < BLOCK.length; i++) {
    const b = bodies[i];
    is(b.indexOf('setTimeout') === -1 && b.indexOf('setInterval') === -1
      && b.indexOf('requestAnimationFrame') === -1,
      'a timer lives in the seam at app.jsx:' + startLine(BLOCK[i]));
  }
  // And the shell BRANCH of each press -- the consequent of `if (bridge)` -- carries none either.
  let branches = 0;
  for (const press of [V_SAVE, V_EXPORT]) {
    walk(press, (n) => {
      if (n.type !== 'IfStatement') return;
      if (!(n.test.type === 'Identifier' && n.test.name === 'bridge')) return;
      branches++;
      const b = text(n.consequent);
      is(b.length > 60, 'the shell branch at app.jsx:' + startLine(n) + ' is empty');
      is(b.indexOf('setTimeout') === -1 && b.indexOf('setInterval') === -1,
        'the shell branch at app.jsx:' + startLine(n) + ' sets a timer');
    });
  }
  eq(branches, 2, 'shell branches found across the two presses');
  return BLOCK.length + ' seam functions + 2 shell branches, 0 timers in any of them';
});

/* -- 8. THE ID IS WHAT MAKES AN ANSWER AN ANSWER --------------------------- */

run('a reply carrying another id is ignored, and the press it belongs to keeps waiting', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
  s.h.doSave();
  const id = onlyMessage(s).id;
  const impostors = [
    failReply(id + '-x', 'write-failed'),
    failReply('', 'write-failed'),
    failReply(null, 'write-failed'),
    { type: CONTRACT.SHELL_DL_RESULT, v: CONTRACT.SHELL_DL_V, ok: false, reason: 'write-failed' },
    { type: 'ezik:location:result', v: CONTRACT.SHELL_DL_V, id: id, ok: false, reason: 'write-failed' },
    { type: CONTRACT.SHELL_DL_RESULT, v: 1, id: id, ok: false, reason: 'write-failed' },
    { type: CONTRACT.SHELL_DL_RESULT, v: '2', id: id, ok: false, reason: 'write-failed' },
    null, undefined, 'a string', 42, [],
  ];
  for (const d of impostors) {
    s.win.dispatch(CONTRACT.SHELL_DL_RESULT, d);
    eq(s.saids, [''], 'lines drawn after the impostor ' + JSON.stringify(d));
    eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 1, 'listeners after the impostor ' + JSON.stringify(d));
  }
  // And the real one still lands.
  s.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id, 'share-unavailable'));
  eq(s.saids[s.saids.length - 1],
    CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['share-unavailable']], 'the line for the real answer');
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners left after the real answer');
  return impostors.length + ' impostors ignored, the real answer still landed, 0 listeners left';
});

run('the listener is released by the answer, by the next press, and by the unmount', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
  s.h.doSave();
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 1, 'listeners after one press');
  s.win.dispatch(CONTRACT.SHELL_DL_RESULT, okReply(JSON.parse(s.sent[0]).id));
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners after the answer');
  eq(s.env.stopRef.current, null, 'the detach the press parked, after the answer');

  // Three presses in a row: one listener at a time, never a pile.
  const t = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
  t.h.doSave();
  t.h.doSave();
  t.h.doSave();
  eq(t.win.live(CONTRACT.SHELL_DL_RESULT), 1, 'listeners after three presses');
  // The first two presses can no longer be answered at all.
  const first = JSON.parse(t.sent[0]).id;
  t.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(first, 'write-failed'));
  eq(t.saids, ['', '', ''], 'lines drawn when a released press is answered');
  // Unmount: exactly what the component's cleanup effect calls.
  is(typeof t.env.stopRef.current === 'function', 'nothing was parked for the unmount to call');
  t.env.stopRef.current();
  eq(t.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners left after the unmount');
  t.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(JSON.parse(t.sent[2]).id, 'write-failed'));
  eq(t.saids, ['', '', ''], 'lines drawn after the unmount');
  return '1 listener at a time across 3 presses; 0 after the answer and 0 after the unmount';
});

run('م٢ keeps its own listener on the same terms', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, label: 'the shell path' });
  s.h.exportDoc();
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 1, 'listeners after one press');
  s.h.exportDoc();
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 1, 'listeners after two presses');
  s.env.stopRef.current();
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners after the unmount');
  return '2 presses -> 1 listener; unmount -> 0';
});

/* -- THE EDGES ------------------------------------------------------------- */

run('a bridge whose postMessage throws leaves nothing attached and says one line', () => {
  for (const which of ['doSave', 'exportDoc']) {
    const s = scene({ shell: 'throwing', trapAnchor: true, label: 'the shell path' });
    s.h[which]();
    eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, which + ': listeners left when the bridge throws');
    eq(s.clock.pending(), 0, which + ': timers left when the bridge throws');
    eq(s.saids[s.saids.length - 1],
      CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['write-failed']], which + ': the line');
  }
  return 'both presses: 0 listeners, 0 timers, one line';
});

run('the detector reads the bridge and never the user agent', () => {
  // A page carrying a shell-shaped user agent but no bridge takes the browser path.
  const s = scene({ shell: null, label: 'the browser path' });
  s.win.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) ReactNative ezik-shell' };
  s.h.doSave();
  eq(s.sent.length, 0, 'messages posted for a UA-only "shell"');
  eq(s.clicks.length, 1, 'anchors clicked for a UA-only "shell"');
  for (const shape of [{}, { postMessage: 'not a function' }, { postMessage: null }]) {
    const s2 = scene({ shell: 'shaped', shaped: shape, label: 'the browser path' });
    s2.h.doSave();
    eq(s2.sent.length, 0, 'messages posted for ' + JSON.stringify(shape));
    eq(s2.clicks.length, 1, 'anchors clicked for ' + JSON.stringify(shape));
  }
  const ua = /navigator\s*\.\s*userAgent/;
  const paths = [text(FN_BRIDGE), text(V_SAVE), text(V_EXPORT), text(FN_ASK)].join('\n');
  is(!ua.test(paths), 'the save path reads navigator.userAgent somewhere');
  return '0 userAgent reads on the whole path; 3 non-bridges took the browser path';
});

run('a picture the canvas could not draw is the same failure it always was, and posts nothing', () => {
  const s = scene({ shell: 'recording', cardThrows: true, label: 'the shell path' });
  s.h.doSave();
  eq(s.sent.length, 0, 'messages posted');
  eq(s.flashes, ['fail'], 'the flash the press has always shown');
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners left');
  return '0 messages, the old fail flash, 0 listeners';
});

run('an empty reply is refused before the bridge is even consulted, exactly as before', () => {
  const s = scene({ shell: 'recording', text: '', label: 'the shell path' });
  s.h.doSave();
  eq(s.sent.length, 0, 'messages posted');
  eq(s.flashes, ['fail'], 'the flash');
  eq(s.saids, [], 'reader lines drawn');
  return '0 messages for an empty reply';
});

run('a card URL that is not a data: URL is answered with a line and never posted', () => {
  const s = scene({ shell: 'recording', trapAnchor: true, cardUrl: 'blob:ezik/9' });
  s.h.doSave();
  eq(s.sent.length, 0, 'messages posted');
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners left');
  eq(s.saids[s.saids.length - 1],
    CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['bad-payload']], 'the line');
  return '0 messages, one bad-payload line';
});

/* -- STATIC: ONE BUILDER, ONE POSTER --------------------------------------- */

run('STATIC: the request is BUILT in one place and POSTED in one place', () => {
  let builds = 0, buildSites = [];
  let posts = 0, postSites = [];
  walk(ast.program, (n) => {
    if (n.type === 'ObjectProperty' && n.key.type === 'Identifier' && n.key.name === 'type'
      && n.value.type === 'Identifier' && n.value.name === 'SHELL_DL_REQUEST') {
      builds++; buildSites.push(startLine(n));
    }
    if (n.type !== 'CallExpression') return;
    if (n.callee.type !== 'MemberExpression') return;
    if (n.callee.property.name !== 'postMessage') return;
    const owner = text(n);
    if (owner.indexOf('built.msg') !== -1) { posts++; postSites.push(startLine(n)); }
  });
  eq(builds, 1, 'places that build a download request: ' + buildSites.join(', '));
  eq(posts, 1, 'places that post a download request: ' + postSites.join(', '));
  is(buildSites[0] >= startLine(FN_MSG) && buildSites[0] <= endLine(FN_MSG),
    'the build site is outside ezikDlMessage, at app.jsx:' + buildSites[0]);
  is(postSites[0] >= startLine(FN_ASK) && postSites[0] <= endLine(FN_ASK),
    'the post site is outside ezikDlAsk, at app.jsx:' + postSites[0]);
  return '1 build at app.jsx:' + buildSites[0] + ' inside ezikDlMessage, 1 post at app.jsx:'
    + postSites[0] + ' inside ezikDlAsk';
});

run('STATIC: nothing on this path runs before a press', () => {
  const NAMES = ['ezikDlAsk', 'ezikDlFromDataUrl', 'ezikDlFromText', 'ezikDlBridge'];
  let effectHit = null;
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression') return;
    if (!(n.callee.type === 'Identifier' && n.callee.name === 'useEffect')) return;
    const body = text(n);
    for (const nm of NAMES.concat(['SHELL_DL_REQUEST'])) {
      if (body.indexOf(nm) !== -1) effectHit = nm + ' inside a useEffect at app.jsx:' + startLine(n);
    }
  });
  is(!effectHit, 'a boot-time caller exists: ' + effectHit);
  // And each caller of the two adapters is inside one of the two presses.
  const ranges = [[startLine(V_SAVE), endLine(V_SAVE)], [startLine(V_EXPORT), endLine(V_EXPORT)]];
  const callers = [];
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression') return;
    if (n.callee.type !== 'Identifier') return;
    if (['ezikDlFromDataUrl', 'ezikDlFromText'].indexOf(n.callee.name) === -1) return;
    callers.push({ name: n.callee.name, line: startLine(n) });
  });
  eq(callers.length, 2, 'call sites of the two adapters');
  for (const c of callers) {
    is(ranges.some((r) => c.line >= r[0] && c.line <= r[1]),
      c.name + ' is called from app.jsx:' + c.line + ', outside both presses');
  }
  return '0 effects mention the path; 2 adapter call sites, both inside a press';
});

// ---------------------------------------------------------------------------
// WHAT IS DRAWN -- because "zero change in the browser experience" is a claim about a TREE, and
// a claim about a tree is not proved by a claim about a press.
//
// Both seats changed shape this round: the reply card's button is now wrapped in a fragment, and
// the document card gained a child inside the fragment it already had. React's own rule is that
// a fragment contributes no node and a `null` child contributes no node, so in a browser both
// trees should be exactly what they were -- and that is a measurement, not something to take on
// trust. So the two COMPONENTS are lifted whole, compiled through @babel/core with the classic
// runtime, and rendered against a small React written below whose createElement RECORDS the tree
// instead of touching a DOM. Fragments are spliced into their parent exactly as React splices
// them, so what this counts is nodes, not elements-in-source.
// ---------------------------------------------------------------------------
const C_COMP_SAVE = topConst('SaveReplyImageButton');
const C_COMP_DOC = topFunction('DocumentCard');
const C_MINIBTN = topConst('miniBtnStyle');
const C_CARD_LABEL = topConst('EZIK_CARD_LABEL');
const C_CARD_ARIA = topConst('EZIK_CARD_ARIA');
const C_CARD_WAIT = topConst('EZIK_CARD_WAIT');
const C_CARD_FAIL = topConst('EZIK_CARD_FAIL');

const DRAW_SRC = babel.transformSync([
  '"use strict";',
  'const window = env.window;',
  'const document = env.document;',
  'const Blob = env.Blob;',
  'const URL = env.URL;',
  'const setTimeout = env.setTimeout;',
  'const clearTimeout = env.clearTimeout;',
  'const Date = env.Date;',
  'const React = env.React;',
  'const useState = env.useState;',
  'const useRef = env.useRef;',
  'const useEffect = env.useEffect;',
  'const s = env.s;',
  'const deriveCaps = env.deriveCaps;',
  'const printAsPdf = env.printAsPdf;',
  'const docToHtml = env.docToHtml;',
  'const ezikDrawReplyCard = env.ezikDrawReplyCard;',
  'let EZ_LANG = env.lang;',
  text(C_FALLBACK), text(C_I18N), text(FN_T),
  text(C_REQ), text(C_RES), text(C_V), text(C_MIMES), text(C_MAX), text(C_LINES),
  text(C_OTHER), text(C_NAMEFB),
  text(FN_BRIDGE), text(FN_LINE), text(FN_RAW), text(FN_SPLIT), text(FN_NAME),
  text(C_SEQ), text(FN_ID), text(FN_MSG), text(FN_ASK), text(FN_FROM_URL),
  text(FN_B64TEXT), text(FN_FROM_TEXT),
  text(C_WORD_MIME), text(C_ESCAPE), text(C_WORD_DOC), text(C_DOWNLOAD),
  text(C_CARD_FILE), text(C_CARD_LABEL), text(C_CARD_ARIA), text(C_CARD_WAIT), text(C_CARD_FAIL),
  text(C_MINIBTN),
  text(C_COMP_SAVE) + ';',
  text(C_COMP_DOC),
  'return { SaveReplyImageButton: SaveReplyImageButton, DocumentCard: DocumentCard };',
].join('\n'), {
  configFile: false,
  babelrc: false,
  compact: false,
  sourceType: 'script',
  parserOpts: { allowReturnOutsideFunction: true },
  presets: [[PRESET_REACT, { runtime: 'classic' }]],
}).code;
const makeDraw = new Function('env', DRAW_SRC);

// The label on the control, read from its own declaration rather than typed here.
const CARD_LABEL = (function () {
  const d = C_CARD_LABEL.declarations[0];
  if (!d.init || d.init.type !== 'StringLiteral') {
    throw new Error('EZIK_CARD_LABEL is no longer a string literal this tool can read');
  }
  return d.init.value;
})();

const FRAGMENT = { fragment: true };

/**
 * The smallest React that can answer the question being asked. It is not a re-implementation and
 * does not try to be: createElement records, the three hooks keep their cells across re-renders,
 * and a state setter renders again. What it CANNOT do is exactly what nothing here needs -- a
 * DOM, a scheduler, a reconciler.
 */
function mountComponent(pick, props, s) {
  const env = s.env;
  const cells = [];
  const teardowns = [];
  let cursor = 0;
  let tree = null;
  let renders = 0;
  const React = {
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
  env.React = React;
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
  env.useEffect = (fn, deps) => {
    const i = cursor++;
    if (cells[i]) return;                       // deps [] -- this harness mounts once
    cells[i] = { effect: true };
    const t = fn();
    if (typeof t === 'function') teardowns.push(t);
  };
  // THE MODULE IS BUILT ONLY NOW, because the lifted source reads its React and its three
  // hooks out of env at evaluation time -- a module built before they were installed would be
  // holding undefined and would fail at the first render rather than measure anything.
  const Component = makeDraw(env)[pick];
  if (typeof Component !== 'function') throw new Error('the lift did not yield ' + pick);
  function render() { cursor = 0; renders++; tree = Component(props); }
  render();
  return {
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
  if (node.type === FRAGMENT) return kids;      // exactly what React does with a fragment
  if (typeof node.type === 'function') return kids;
  return [{ tag: String(node.type), props: node.props, children: kids }];
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

function drawScene(opts) {
  const o = opts || {};
  const sent = [];
  const clock = fakeClock();
  const bridge = o.shell === 'recording' ? recordingBridge(sent) : null;
  const win = fakeWindow({ bridge: bridge });
  const env = {
    window: win,
    document: fakeDocument([], o.trapAnchor ? 'the shell path' : null),
    Blob: FakeBlob,
    URL: fakeUrl([]),
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Date: { now: () => 1756000000000 },
    lang: 'ar',
    s: { qiblaNote: { marginTop: 6 } },
    deriveCaps: () => ({ export: true }),
    printAsPdf: () => {},
    docToHtml: () => DOC_BODY,
    ezikDrawReplyCard: () => ({ url: CARD_URL }),
  };
  return { env: env, win: win, sent: sent, clock: clock };
}

run('DRAWN: in a browser the reply card is ONE button and nothing else -- the fragment adds no node', () => {
  const s = drawScene({ shell: null });
  const m = mountComponent('SaveReplyImageButton', { getText: () => 'x', getSource: () => '' }, s);
  const nodes = nodesOf(m.tree());
  eq(nodes.length, 1, 'top-level nodes the browser would insert');
  eq(nodes[0].tag, 'button', 'the one node');
  eq(countNodes(nodes), 2, 'nodes in the whole tree (the button and its label)');
  eq(textOf(nodes), CARD_LABEL, 'the label on the button');
  // And no press changes that in a browser.
  const before = countNodes(nodes);
  const press = m.tree();
  const onClick = nodesOf(press)[0].props.onClick;
  onClick();
  eq(countNodes(nodesOf(m.tree())), before, 'nodes after a press in a browser');
  eq(s.sent.length, 0, 'messages posted');
  return '1 node before the press, 1 after; 0 messages; the fragment is invisible';
});

run('DRAWN: the line appears ONLY in the shell, and only once the shell has refused', () => {
  const s = drawScene({ shell: 'recording', trapAnchor: true });
  const m = mountComponent('SaveReplyImageButton', { getText: () => 'x', getSource: () => '' }, s);
  eq(nodesOf(m.tree()).length, 1, 'nodes before the press');
  nodesOf(m.tree())[0].props.onClick();
  eq(nodesOf(m.tree()).length, 1, 'nodes while the shell is still thinking');
  const id = JSON.parse(s.sent[0]).id;
  s.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id, 'share-unavailable'));
  const after = nodesOf(m.tree());
  eq(after.length, 2, 'nodes after the shell refused');
  eq(after[1].tag, 'div', 'the node the refusal added');
  eq(textOf([after[1]]),
    CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['share-unavailable']], 'the line drawn');
  // A success takes it away again.
  nodesOf(m.tree())[0].props.onClick();
  eq(nodesOf(m.tree()).length, 1, 'nodes on the next press');
  m.unmount();
  eq(s.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners after the unmount effect ran');
  return '1 node -> 1 while waiting -> 2 after a refusal -> 1 on the next press';
});

run('DRAWN: the document card gains nothing at all in a browser, and one node in the shell', () => {
  const plain = drawScene({ shell: null });
  const a = mountComponent('DocumentCard', { title: DOC_TITLE, content: 'x', age: 12 }, plain);
  const browserNodes = countNodes(nodesOf(a.tree()));
  is(browserNodes > 5, 'the document card drew almost nothing -- the lift is wrong');
  const buttons = findTags(nodesOf(a.tree()), 'button');
  is(buttons.length >= 2, 'the two export controls are not both drawn');
  eq(findTags(nodesOf(a.tree()), 'div').filter((d) => textOf([d])
    === CONTRACT.EZ_I18N.ar[CONTRACT.SHELL_DL_LINES['write-failed']]).length, 0,
    'a shell line was drawn in a browser');

  const shell = drawScene({ shell: 'recording', trapAnchor: true });
  const b = mountComponent('DocumentCard', { title: DOC_TITLE, content: 'x', age: 12 }, shell);
  eq(countNodes(nodesOf(b.tree())), browserNodes, 'nodes in the shell before any press');
  findTags(nodesOf(b.tree()), 'button')[0].props.onClick();
  eq(countNodes(nodesOf(b.tree())), browserNodes, 'nodes while the shell is still thinking');
  const id = JSON.parse(shell.sent[0]).id;
  shell.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id, 'write-failed'));
  eq(countNodes(nodesOf(b.tree())), browserNodes + 2, 'nodes after the shell refused (the div and its line)');
  b.unmount();
  eq(shell.win.live(CONTRACT.SHELL_DL_RESULT), 0, 'listeners after the unmount effect ran');
  return browserNodes + ' nodes in a browser, unchanged in the shell until a refusal adds exactly 2';
});

// ---------------------------------------------------------------------------
// THE MUTANTS -- the same lifted source with one line changed, each of which must be KILLED.
// ---------------------------------------------------------------------------
const mutants = [];
function mutant(name, from, to, killedBy) {
  const at = HARNESS.indexOf(from);
  if (at === -1) { mutants.push({ name: name, applied: false, killed: false, note: 'the line to mutate is gone: ' + from }); return; }
  if (HARNESS.indexOf(from, at + 1) !== -1) { mutants.push({ name: name, applied: false, killed: false, note: 'the line to mutate is not unique' }); return; }
  const src = HARNESS.slice(0, at) + to + HARNESS.slice(at + from.length);
  let factory = null;
  try { factory = new Function('env', src); }
  catch (e) { mutants.push({ name: name, applied: true, killed: false, note: 'the mutant does not compile: ' + e.message }); return; }
  let died = null;
  try { killedBy(factory); }
  catch (e) { died = e.message; }
  mutants.push({ name: name, applied: true, killed: died !== null, note: died || 'SURVIVED -- no case above bites it' });
}

// A press through a given harness factory, answered or not, with everything to inspect.
function press(factory, opts) {
  const s = scene(Object.assign({ shell: 'recording', trapAnchor: true }, opts || {}), factory);
  s.h[(opts && opts.which) || 'doSave']();
  return s;
}

mutant('the version is sent as the NUMBER 1',
  "const SHELL_DL_V = '1';", 'const SHELL_DL_V = 1;',
  (f) => {
    const s = press(f);
    const m = JSON.parse(s.sent[0]);
    is(typeof m.v === 'string', 'v crossed the bridge as a ' + typeof m.v + ', not a string');
  });

mutant('the data: prefix is left on the front of b64',
  'return { mime: head.slice(5, head.length - 7), b64: url.slice(comma + 1) };',
  'return { mime: head.slice(5, head.length - 7), b64: url };',
  (f) => {
    const s = press(f);
    // The prefix left on is not base64 at all, so the request never leaves -- and a picture the
    // reader pressed for that produces no file and no message is exactly the defect. Both halves
    // are asserted so the diagnostic names which one bit.
    eq(s.sent.length, 1, 'messages posted for a picture the reader asked to save');
    const m = JSON.parse(s.sent[0]);
    is(m.b64.indexOf('data:') === -1, 'the data: prefix rode along inside b64');
    is(/^[A-Za-z0-9+/]+={0,2}$/.test(m.b64), 'b64 is outside the standard alphabet');
  });

mutant('a deadline is added that calls the request failed',
  '  try { window.addEventListener(SHELL_DL_RESULT, onResult); }',
  '  setTimeout(function () { stop(); onDone(ezikDlLine("write-failed")); }, 30000);\n'
  + '  try { window.addEventListener(SHELL_DL_RESULT, onResult); }',
  (f) => {
    const s = press(f);
    eq(s.clock.pending(), 0, 'timers the press left running');
  });

mutant('the four-mebibyte limit is raised',
  'const SHELL_DL_MAX_BYTES = 4 * 1024 * 1024;', 'const SHELL_DL_MAX_BYTES = 40 * 1024 * 1024;',
  (f) => {
    const MAX = CONTRACT.SHELL_DL_MAX_BYTES;
    const over = 'A'.repeat(((MAX + 2) / 3) * 4);
    const s = press(f, { cardUrl: 'data:image/png;base64,' + over });
    eq(s.sent.length, 0, 'messages for a file over the limit');
  });

mutant('the id on the reply is no longer matched',
  '    if (d.id !== id) return;', '    if (false) return;',
  (f) => {
    const s = press(f);
    const id = JSON.parse(s.sent[0]).id;
    s.win.dispatch(CONTRACT.SHELL_DL_RESULT, failReply(id + '-x', 'write-failed'));
    eq(s.saids, [''], 'lines drawn after another press\'s answer');
  });

mutant('size is guessed from the ENCODED length instead of measured',
  '  const size = ezikDlRawBytes(b64);', '  const size = b64.length;',
  (f) => {
    // م١ is the half with NO second count behind it, so a guessed size gets all the way onto the
    // bridge there. That is where this mutant is aimed, and where the wrong number is visible.
    const s = press(f);
    eq(s.sent.length, 1, 'messages posted');
    const m = JSON.parse(s.sent[0]);
    eq(m.size, Buffer.from(m.b64, 'base64').length,
      'the size field against the bytes the encoding really stands for');
  });

run('every mutant was applied and every one of them was killed', () => {
  is(mutants.length >= 4, 'only ' + mutants.length + ' mutants -- the floor is four');
  const notApplied = mutants.filter((m) => !m.applied).map((m) => m.name + ': ' + m.note);
  eq(notApplied, [], 'mutants that could not be applied');
  const survivors = mutants.filter((m) => !m.killed).map((m) => m.name + ': ' + m.note);
  eq(survivors, [], 'mutants that survived');
  return mutants.length + '/' + mutants.length + ' applied and killed';
});

// ---------------------------------------------------------------------------
// REPORT.
// ---------------------------------------------------------------------------
console.log('=== save bridge -- the web half, measured ===');
console.log('source:  app.jsx  ' + Buffer.byteLength(source, 'utf8') + ' bytes, '
  + source.split('\n').length + ' lines');
console.log('lifted:  ezikDlMessage@' + startLine(FN_MSG) + '  ezikDlAsk@' + startLine(FN_ASK)
  + '  ezikWordDoc@' + startLine(C_WORD_DOC) + '  doSave@' + startLine(V_SAVE)
  + '  exportDoc@' + startLine(V_EXPORT));
console.log('contract: ' + CONTRACT.SHELL_DL_REQUEST + ' -> ' + CONTRACT.SHELL_DL_RESULT
  + '  v=' + JSON.stringify(CONTRACT.SHELL_DL_V) + ' (' + typeof CONTRACT.SHELL_DL_V + ')'
  + '  max=' + CONTRACT.SHELL_DL_MAX_BYTES + '  types=' + CONTRACT.SHELL_DL_MIMES.length
  + '  reasons=' + Object.keys(CONTRACT.SHELL_DL_LINES).length);
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
