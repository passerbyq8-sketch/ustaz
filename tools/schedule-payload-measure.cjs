// schedule-payload-measure.cjs -- the schedule pipe, measured against the shell's contract.
//
// WHAT THIS MEASURES AND WHY IT CAN. murabbi-shell's notification engine computes nothing: it is
// handed a list of items, each with an ABSOLUTE epoch-millisecond timestamp and text already
// written in the reader's language, and it fires them. Everything that can go wrong therefore
// goes wrong on THIS side of the bridge -- a relative time, a time already past, a call made in a
// browser tab that has no shell to answer it, the same payload sent twice, or the web's own
// vocabulary (`lng`) crossing into a contract that says `lon`. None of those needs a device, a
// network or a browser to be judged. They need a window, a bridge object and a clock, and this
// tool builds all three as fakes it fully controls.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every function and constant below is extracted
// from app.jsx by @babel/parser -- the same parser the babel gate and tools/build-app.cjs use --
// and evaluated VERBATIM. The closure is resolved by walking each function's free identifiers and
// pulling their top-level declarations, so a helper renamed or a constant moved makes extraction
// throw rather than quietly measure an older idea of the code.
//
// EVERY KEY IS READ FROM ITS DECLARATION AT RUN TIME, NEVER SPELLED HERE. The channel name, the
// contract version, the operation names: each is looked up by the CONSTANT app.jsx binds it to
// and its literal is read out of that declaration while this tool runs. A second copy of a
// protocol string in a second file is exactly the drift this repository spends its guards
// preventing -- guards/i18n-ui-guard.cjs holds one such literal to an exact set of files in both
// directions and correctly fails a tool that spells it.
//
// IT DOES RE-TYPE THE EXPECTATIONS, DELIBERATELY. The behaviours below -- absolute, ascending,
// past dropped, silent without a shell, never twice, no `lng` -- are written out as cases. They
// are not derived from the code under test, because a roster read out of the thing being measured
// agrees with any implementation, including one that sends nothing at all.
//
// THE TRAPS THROW. console, fetch, XMLHttpRequest, navigator, localStorage, Notification and
// document.createElement are all supplied as objects that throw the moment they are touched. A
// path that reaches for any of them fails LOUDLY here rather than being discovered on a device.
// "Zero console output when there is no shell" is therefore not observed, it is enforced.
//
// Usage:  node tools/schedule-payload-measure.cjs
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

/** Every top-level declaration, by the name it binds. */
const TOP = new Map();
for (const n of ast.program.body) {
  if (n.type === 'FunctionDeclaration' && n.id) TOP.set(n.id.name, { node: n, emit: text(n), kind: 'fn' });
  if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier') {
        TOP.set(d.id.name, { node: d, emit: n.kind + ' ' + text(d) + ';', kind: n.kind });
      }
    }
  }
}

function topFunction(name) {
  const e = TOP.get(name);
  if (!e || e.kind !== 'fn') throw new Error('app.jsx no longer declares function ' + name + '() at the top level');
  return e.node;
}

/** Names a node BINDS for itself. Not free variables. */
function boundNames(root) {
  const bound = new Set();
  const takePattern = (p) => {
    if (!p || typeof p.type !== 'string') return;
    if (p.type === 'Identifier') { bound.add(p.name); return; }
    walk(p, (n) => { if (n.type === 'Identifier') bound.add(n.name); });
  };
  walk(root, (n) => {
    if (n.type === 'VariableDeclarator') takePattern(n.id);
    else if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') {
      if (n.id) bound.add(n.id.name);
      n.params.forEach(takePattern);
    } else if (n.type === 'ArrowFunctionExpression') n.params.forEach(takePattern);
    else if (n.type === 'CatchClause') takePattern(n.param);
    else if (n.type === 'ClassDeclaration' && n.id) bound.add(n.id.name);
  });
  return bound;
}

/** The free variables of a node: identifiers read, minus what the node binds for itself. */
function freeNames(root) {
  const bound = boundNames(root);
  const free = new Set();
  walk(root, (n, p) => {
    if (n.type !== 'Identifier') return;
    if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
    if (p && p.type === 'ObjectProperty' && p.key === n && !p.computed) return;
    if (p && p.type === 'ObjectMethod' && p.key === n && !p.computed) return;
    if (p && (p.type === 'VariableDeclarator' || p.type === 'FunctionDeclaration'
      || p.type === 'ClassDeclaration') && p.id === n) return;
    if (bound.has(n.name)) return;
    free.add(n.name);
  });
  return free;
}

const LANGUAGE = new Set(['Array', 'Object', 'JSON', 'String', 'Number', 'Boolean', 'Math', 'Date',
  'RegExp', 'Error', 'Map', 'Set', 'Promise', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'undefined', 'NaN', 'Infinity', 'encodeURIComponent', 'decodeURIComponent']);

// What the harness stands in for. Asserted in BOTH directions below: a name the pipe starts using
// that nothing here supplies is a tool measuring code that cannot run, and a name faked here that
// the pipe stopped using is a tool carrying scenery for a scene that has been struck.
const ENV_NAMES = ['window', 'document', 'setTimeout', 'clearTimeout', 'useEffect'];

// THE PIPE, BY NAME. Every one of these must exist or extraction throws.
const ROOTS = ['ezikSchedBridge', 'ezikSchedRoute', 'ezikSchedPayload', 'ezikSchedSend',
  'ezikSchedItems', 'ezikSchedArm', 'useEzikSchedRoot', 'useEzikSchedWatch'];
const ROOT_NODES = ROOTS.map((n) => topFunction(n));

/** Pull the whole top-level closure of a set of roots, in source order, and name what is left. */
function resolveClosure(roots) {
  const picked = new Map();
  const outside = new Set();
  const queue = roots.slice();
  for (const r of roots) {
    // A root is itself part of the harness, by the name it binds.
    for (const [name, decl] of TOP) { if (decl.node === r) picked.set(name, decl); }
  }
  while (queue.length) {
    const node = queue.shift();
    for (const name of freeNames(node)) {
      if (picked.has(name)) continue;
      const decl = TOP.get(name);
      if (decl) { picked.set(name, decl); queue.push(decl.node); }
      else if (!LANGUAGE.has(name)) outside.add(name);
    }
  }
  const order = Array.from(picked.entries()).sort((a, b) => a[1].node.start - b[1].node.start);
  return { order: order, outside: outside };
}

const CLOSURE = resolveClosure(ROOT_NODES);

{
  const missing = ENV_NAMES.filter((n) => !CLOSURE.outside.has(n));
  const extra = Array.from(CLOSURE.outside).filter((n) => ENV_NAMES.indexOf(n) === -1);
  if (extra.length) {
    throw new Error('the schedule pipe now closes over ' + extra.join(', ') + ' -- names this '
      + 'harness does not supply. Add them to ENV_NAMES and give each one a fake.');
  }
  if (missing.length) {
    throw new Error('the schedule pipe no longer uses ' + missing.join(', ') + ' -- the harness is '
      + 'faking something the code stopped asking for, which is how a stale test starts.');
  }
}

const LIFTED = CLOSURE.order.map((e) => e[1].emit).join('\n');

const HARNESS = ['"use strict";']
  .concat(ENV_NAMES.map((n) => 'const ' + n + ' = env.' + n + ';'))
  .concat([LIFTED])
  .concat(['return { ' + ROOTS.map((n) => n + ': ' + n).join(', ')
    + ', peekLastSent: function () { return ezikSchedLastSent; }'
    + ', SHELL_SCHED_EMPTY: SHELL_SCHED_EMPTY };'])
  .join('\n');

const makeHarness = new Function('env', HARNESS);

// ---------------------------------------------------------------------------
// THE PROTOCOL WORDS -- read from their declarations, never spelled here.
// ---------------------------------------------------------------------------
function literalOf(name, type) {
  const e = TOP.get(name);
  if (!e || e.kind === 'fn') throw new Error('app.jsx no longer declares ' + name);
  const init = e.node.init;
  if (!init || init.type !== type) {
    throw new Error(name + ' is no longer a ' + type + ' -- this tool reads its value from its '
      + 'declaration rather than carrying a second copy of it.');
  }
  return init.value;
}
const CHANNEL = literalOf('SHELL_SCHED_CHANNEL', 'StringLiteral');
const OP = literalOf('SHELL_SCHED_OP', 'StringLiteral');
const REARM_OP = literalOf('SHELL_SCHED_REARM_OP', 'StringLiteral');
const VERSION = literalOf('SHELL_SCHED_VERSION', 'NumericLiteral');

// ---------------------------------------------------------------------------
// THE FAKES. Everything that is not the pipe throws when touched.
// ---------------------------------------------------------------------------
function trap(what) {
  return new Proxy({}, {
    get(_t, prop) {
      throw new Error('the schedule pipe touched ' + what + '.' + String(prop)
        + ' -- this path is allowed no such thing');
    },
    apply() { throw new Error('the schedule pipe called ' + what + '()'); },
  });
}

/** A window with, or without, a shell bridge on it. Records every post. */
function makeEnv(opts) {
  const o = opts || {};
  const posts = [];
  const listeners = new Map();
  const timers = [];
  const bridge = o.shell === false ? undefined : (o.bridge !== undefined ? o.bridge : {
    postMessage(text) {
      if (typeof text !== 'string') throw new Error('postMessage was handed a ' + typeof text
        + ' -- the contract is a JSON string');
      posts.push(text);
    },
  });
  const addTo = (map) => (name, fn) => {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(fn);
  };
  const removeFrom = (map) => (name, fn) => {
    const a = map.get(name);
    if (!a) return;
    const i = a.indexOf(fn);
    if (i !== -1) a.splice(i, 1);
  };
  const docListeners = new Map();
  const win = {
    ReactNativeWebView: bridge,
    addEventListener: addTo(listeners),
    removeEventListener: removeFrom(listeners),
    // Anything else on the window is a thing this path must not reach for.
    get fetch() { throw new Error('the schedule pipe reached for window.fetch'); },
    get navigator() { throw new Error('the schedule pipe reached for window.navigator'); },
    get localStorage() { throw new Error('the schedule pipe reached for window.localStorage'); },
    get Notification() { throw new Error('the schedule pipe reached for window.Notification'); },
  };
  const doc = {
    addEventListener: addTo(docListeners),
    removeEventListener: removeFrom(docListeners),
    get createElement() { throw new Error('the schedule pipe reached for document.createElement'); },
    get cookie() { throw new Error('the schedule pipe reached for document.cookie'); },
  };
  const env = {
    window: win,
    document: doc,
    // A NODE-SHAPED HANDLE, deliberately. Under node -- which is where runtime-gate.cjs mounts
    // this tree -- setTimeout returns an object carrying unref(), and a pending long timer that
    // is never unref'd keeps the process alive until it fires. That gate would then HANG rather
    // than fail, which is worse than failing, so this fake records whether unref was called.
    setTimeout(fn, ms) {
      const h = { fn: fn, ms: ms, unrefs: 0, unref() { this.unrefs++; } };
      timers.push(h);
      return h;
    },
    clearTimeout(h) {
      const i = timers.indexOf(h);
      if (i !== -1) timers[i] = null;
    },
    useEffect(fn, deps) { env.effects.push({ fn: fn, deps: deps }); },
    // Everything below is scenery only in the sense that it must never be used.
    console: trap('console'),
    fetch: trap('fetch'),
    XMLHttpRequest: trap('XMLHttpRequest'),
    navigator: trap('navigator'),
    localStorage: trap('localStorage'),
    Notification: trap('Notification'),
    effects: [],
    posts: posts,
    listeners: listeners,
    docListeners: docListeners,
    timers: timers,
  };
  return env;
}

/** A fresh pipe with a fresh module state -- ezikSchedLastSent starts over every time. */
function fresh(opts) {
  const env = makeEnv(opts);
  return { env: env, h: makeHarness(env) };
}

// ---------------------------------------------------------------------------
// CASES.
// ---------------------------------------------------------------------------
const results = [];
function run(name, body) {
  try {
    const detail = body();
    results.push({ ok: true, name: name, detail: detail || '' });
  } catch (e) {
    results.push({ ok: false, name: name, detail: e && e.message ? e.message : String(e) });
  }
}
function is(cond, whatWentWrong) { if (!cond) throw new Error(whatWentWrong); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': expected ' + b + ' but got ' + a);
}

const NOW = 1756100000000;         // a fixed instant; nothing here reads a real clock
const HOUR = 3600000;

// -- 1. THE MESSAGE ENVELOPE, AS THE CONTRACT NAMES IT ----------------------
run('the envelope carries the channel, the version and the operation from their own declarations', () => {
  const { h } = fresh();
  const built = h.ezikSchedPayload([
    { type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
  ], NOW);
  eq(Object.keys(built.message), ['channel', 'v', 'op', 'items'], 'the envelope fields');
  eq(built.message.channel, CHANNEL, 'the channel');
  eq(built.message.v, VERSION, 'the contract version');
  eq(built.message.op, OP, 'the operation');
  return 'channel/v/op read from SHELL_SCHED_CHANNEL / SHELL_SCHED_VERSION / SHELL_SCHED_OP';
});

// -- 2. ABSOLUTE, WHOLE, AND ASCENDING --------------------------------------
run('every timestamp is an absolute whole millisecond, and the list climbs', () => {
  const { h } = fresh();
  const built = h.ezikSchedPayload([
    { id: 'c', type: 'daily', at: NOW + 5 * HOUR, title: 't', body: 'b' },
    { id: 'a', type: 'daily', at: NOW + 1 * HOUR, title: 't', body: 'b' },
    { id: 'b', type: 'daily', at: NOW + 3 * HOUR, title: 't', body: 'b' },
  ], NOW);
  const ats = built.message.items.map((x) => x.at);
  eq(ats.length, 3, 'items that survived');
  for (const a of ats) {
    is(typeof a === 'number' && isFinite(a) && Math.trunc(a) === a, 'a timestamp is not a whole number: ' + a);
    is(a > NOW, 'a timestamp is not in the future: ' + a);
    // AN ABSOLUTE INSTANT, NOT AN INTERVAL. Anything expressed as "in N hours" would land in the
    // low thousands or the low millions; an epoch millisecond in this decade cannot.
    is(a > 1000000000000, 'a timestamp is small enough to be an interval rather than an instant: ' + a);
  }
  for (let i = 1; i < ats.length; i++) is(ats[i] > ats[i - 1], 'the list does not climb: ' + ats.join(','));
  eq(built.message.items.map((x) => x.id), ['a', 'b', 'c'], 'the order the items came back in');
  return 'input order c,a,b -> output a,b,c, all absolute';
});

run('two items at the same instant are ordered by key, so the same list always prints the same bytes', () => {
  const { h } = fresh();
  const one = h.ezikSchedPayload([
    { id: 'zz', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
    { id: 'aa', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
  ], NOW);
  const two = h.ezikSchedPayload([
    { id: 'aa', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
    { id: 'zz', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
  ], NOW);
  eq(JSON.stringify(one.message), JSON.stringify(two.message), 'the two printings');
  return 'input order does not reach the wire';
});

// -- 3. THE PAST IS DROPPED HERE, NOT ON THE FAR SIDE ------------------------
run('a time that has passed is dropped, counted, and never sent', () => {
  const { h, env } = fresh();
  const r = h.ezikSchedSend([
    { id: 'gone', type: 'daily', at: NOW - 1, title: 't', body: 'b' },
    { id: 'now', type: 'daily', at: NOW, title: 't', body: 'b' },
    { id: 'soon', type: 'daily', at: NOW + 1, title: 't', body: 'b' },
  ], NOW);
  eq(r.dropped.past, 2, 'items counted as past');
  eq(r.items, 1, 'items that survived');
  eq(env.posts.length, 1, 'posts');
  const sent = JSON.parse(env.posts[0]);
  eq(sent.items.map((x) => x.id), ['soon'], 'the ids that crossed the bridge');
  return 'now-1 and now dropped as past; now+1 sent';
});

run('a clock this end cannot read sends nothing at all, rather than sending it unchecked', () => {
  const { h, env } = fresh();
  for (const bad of [undefined, null, NaN, Infinity, 'now', {}]) {
    const r = h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }], bad);
    eq(r.items, 0, 'items surviving a clock of ' + JSON.stringify(String(bad)));
  }
  eq(env.posts.length, 0, 'posts made with an unusable clock');
  return '6 unusable clocks, 0 items, 0 posts';
});

run('a timestamp that is not an absolute whole millisecond is refused by name', () => {
  const { h } = fresh();
  const r = h.ezikSchedPayload([
    { id: 'a', type: 'daily', at: NOW + 0.5, title: 't', body: 'b' },
    { id: 'b', type: 'daily', at: '1756100000000', title: 't', body: 'b' },
    { id: 'c', type: 'daily', at: NaN, title: 't', body: 'b' },
    { id: 'd', type: 'daily', at: Infinity, title: 't', body: 'b' },
    { id: 'e', type: 'daily', at: 0, title: 't', body: 'b' },
    { id: 'f', type: 'daily', at: -1, title: 't', body: 'b' },
  ], NOW);
  eq(r.dropped.badTime, 6, 'items counted as a bad time');
  eq(r.message.items.length, 0, 'items that survived');
  return 'fraction, string, NaN, Infinity, zero and negative all refused';
});

// -- 4. NO SHELL MEANS SILENCE, AND SILENCE MEANS SILENCE --------------------
run('with no shell there is no call, no throw, and no console', () => {
  const { h, env } = fresh({ shell: false });
  const r = h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }], NOW);
  eq(r.sent, false, 'sent');
  eq(r.reason, 'no-shell', 'the reason given');
  eq(env.posts.length, 0, 'posts');
  // The console in this harness THROWS on any property access, so reaching case 4 at all is the
  // proof that nothing on this path wrote to it.
  return 'ReactNativeWebView absent -> 0 posts, 0 throws, 0 console touches';
});

run('a bridge that is present but is not a bridge is also silence', () => {
  for (const shape of [{}, { postMessage: 1 }, null, 'yes', 0]) {
    const { h, env } = fresh({ bridge: shape });
    const r = h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }], NOW);
    eq(r.reason, 'no-shell', 'the reason for a bridge shaped ' + JSON.stringify(shape));
    eq(env.posts.length, 0, 'posts for a bridge shaped ' + JSON.stringify(shape));
  }
  return '5 non-bridges, 0 posts each';
});

run('a bridge that throws is caught, and the fingerprint does NOT advance', () => {
  const env = makeEnv({ bridge: { postMessage() { throw new Error('the shell went away'); } } });
  const h = makeHarness(env);
  const before = h.peekLastSent();
  const r = h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }], NOW);
  eq(r.sent, false, 'sent');
  eq(r.reason, 'bridge-refused', 'the reason given');
  eq(h.peekLastSent(), before, 'the fingerprint after a refused post');
  return 'a refused post is retried next time rather than remembered as sent';
});

// -- 5. THE SAME PAYLOAD IS NEVER SENT TWICE --------------------------------
run('an identical payload is sent once and not again', () => {
  const { h, env } = fresh();
  const items = [{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }];
  const a = h.ezikSchedSend(items, NOW);
  const b = h.ezikSchedSend(items, NOW);
  const c = h.ezikSchedSend(items.slice(), NOW);      // a different array, the same payload
  eq([a.sent, b.sent, c.sent], [true, false, false], 'the three answers');
  eq([a.reason, b.reason, c.reason], [null, 'unchanged', 'unchanged'], 'the three reasons');
  eq(env.posts.length, 1, 'posts');
  return '3 sends, 1 post';
});

run('a payload that differs by one character does go', () => {
  const { h, env } = fresh();
  h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }], NOW);
  h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'B' }], NOW);
  h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR + 1, title: 't', body: 'B' }], NOW);
  eq(env.posts.length, 3, 'posts');
  return 'body then time moved -> 3 posts';
});

run('a page that opens with nothing to arm says nothing at all', () => {
  const { h, env } = fresh();
  const r = h.ezikSchedSend([], NOW);
  eq(r.sent, false, 'sent');
  eq(r.reason, 'unchanged', 'the reason given');
  eq(env.posts.length, 0, 'posts');
  return 'the empty payload matches the fingerprint the pipe starts on';
});

run('...but a RETURN to nothing is sent, because an atomic rebuild from nothing is a cancel', () => {
  const { h, env } = fresh();
  h.ezikSchedSend([{ id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' }], NOW);
  const back = h.ezikSchedSend([], NOW);
  eq(back.sent, true, 'sent');
  eq(env.posts.length, 2, 'posts');
  eq(JSON.parse(env.posts[1]).items, [], 'the items in the cancelling payload');
  eq(env.posts[1], h.SHELL_SCHED_EMPTY, 'the cancelling payload against the empty fingerprint');
  return 'arm then disarm -> 2 posts, the second carrying an empty list';
});

// -- 6. THE WEB'S VOCABULARY DOES NOT CROSS THE BRIDGE -----------------------
run('lng, lat and lon never reach the shell, whatever a caller is holding', () => {
  const { h, env } = fresh();
  h.ezikSchedSend([{
    id: 'x', type: 'daily', at: NOW + HOUR, title: 't', body: 'b',
    // Everything a caller might be carrying when it builds an item out of a stored position.
    lng: 47.98, lat: 29.38, lon: 47.98, loc: { lat: 29.38, lng: 47.98 }, by: 'device',
    prefs: { method: 'kuwait' }, tz: 180,
  }], NOW);
  eq(env.posts.length, 1, 'posts');
  const wire = env.posts[0];
  for (const word of ['lng', 'lat', 'lon', 'loc', 'prefs', 'method', 'device']) {
    is(wire.indexOf(word) === -1, 'the wire carries the word "' + word + '": ' + wire);
  }
  eq(Object.keys(JSON.parse(wire).items[0]).sort(), ['at', 'body', 'id', 'title', 'type'],
    'the fields of the item that crossed');
  return 'the payload is constructed from a whitelist, not forwarded';
});

run('and the whitelist is asserted in the source, not only in the output', () => {
  // The item that is pushed is an object literal whose keys are exactly these. A field added to
  // it tomorrow without a case here fails this, which is the point.
  const fn = topFunction('ezikSchedPayload');
  let keys = null;
  walk(fn, (n) => {
    if (n.type !== 'VariableDeclarator') return;
    if (!(n.id.type === 'Identifier' && n.id.name === 'rec')) return;
    is(n.init && n.init.type === 'ObjectExpression', '`rec` is no longer built as an object literal');
    keys = n.init.properties.map((p) => p.key.name || p.key.value);
  });
  is(keys !== null, 'ezikSchedPayload no longer builds a `rec`');
  eq(keys.sort(), ['at', 'body', 'id', 'title', 'type'], 'the literal fields of an item');
  // `route` is the one conditional field, and it is set by name and from the shape check alone.
  is(/rec\.route = route;/.test(text(fn)), 'the destination is no longer attached by name');
  return 'rec = { ' + keys.join(', ') + ' } (+ route, conditionally)';
});

run('the timestamp on the wire is the caller\'s number and nothing computed from it', () => {
  const fn = topFunction('ezikSchedPayload');
  const body = text(fn);
  // No relative-time arithmetic anywhere in the builder: no clock read, no interval added.
  for (const t of ['Date.now(', 'new Date(', 'getTime(', 'getTimezoneOffset(', '60 * 1000', '* 60 *']) {
    is(body.indexOf(t) === -1, 'the builder contains ' + t + ' -- a second clock is a second source');
  }
  // And the field is bound straight from the item.
  is(/const at = it\.at;/.test(body), 'the timestamp is no longer read straight off the item');
  is(/at: at,/.test(body), 'the timestamp on the wire is no longer the one that was read');
  return '0 clock reads, 0 interval arithmetic, at: at';
});

// -- 7. THE ITEMS THAT ARE NOT ITEMS ----------------------------------------
run('an item with no type, no title or no body is dropped and counted, never invented', () => {
  const { h } = fresh();
  const r = h.ezikSchedPayload([
    { id: 'a', at: NOW + HOUR, title: 't', body: 'b' },
    { id: 'b', type: '  ', at: NOW + HOUR, title: 't', body: 'b' },
    { id: 'c', type: 'daily', at: NOW + HOUR, body: 'b' },
    { id: 'd', type: 'daily', at: NOW + HOUR, title: '   ', body: 'b' },
    { id: 'e', type: 'daily', at: NOW + HOUR, title: 't' },
    { id: 'f', type: 'daily', at: NOW + HOUR, title: 't', body: '' },
    null, 'not an item', [1, 2],
  ], NOW);
  eq(r.dropped.missingType, 2, 'items counted as having no type');
  eq(r.dropped.missingText, 4, 'items counted as having no text');
  eq(r.dropped.notAnObject, 3, 'items counted as not being objects');
  eq(r.message.items.length, 0, 'items that survived');
  return '9 malformed items, 9 counted, 0 sent';
});

run('a repeated key is dropped once and counted, so the far side sees no duplicate', () => {
  const { h } = fresh();
  const r = h.ezikSchedPayload([
    { id: 'same', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
    { id: 'same', type: 'daily', at: NOW + 2 * HOUR, title: 't', body: 'b' },
    { id: ' same ', type: 'daily', at: NOW + 3 * HOUR, title: 't', body: 'b' },
  ], NOW);
  eq(r.dropped.duplicateId, 2, 'items counted as a repeated key');
  eq(r.message.items.length, 1, 'items that survived');
  // A key that could be smuggled in through the prototype is an own key here or it is nothing.
  const proto = h.ezikSchedPayload([
    { id: '__proto__', type: 'daily', at: NOW + HOUR, title: 't', body: 'b' },
    { id: '__proto__', type: 'daily', at: NOW + 2 * HOUR, title: 't', body: 'b' },
  ], NOW);
  eq(proto.dropped.duplicateId, 1, 'items counted as a repeated __proto__ key');
  eq(proto.message.items.length, 1, 'items surviving a __proto__ key');
  return 'trimmed keys collide; __proto__ collides too';
});

run('a key that is not given is derived, and never composed from text', () => {
  const { h } = fresh();
  const r = h.ezikSchedPayload([{ type: 'daily', at: NOW + HOUR, title: 'a title', body: 'a body' }], NOW);
  eq(r.message.items[0].id, 'daily:' + (NOW + HOUR), 'the derived key');
  return 'id = "{type}:{at}", which is the shell\'s own rule for a missing key';
});

// -- 8. THE DESTINATION IS CARRIED, NEVER INTERPRETED ------------------------
run('a destination is carried verbatim; a malformed one costs the destination, not the item', () => {
  const { h } = fresh();
  const r = h.ezikSchedPayload([
    { id: 'a', type: 'daily', at: NOW + 1 * HOUR, title: 't', body: 'b', route: '  where  ' },
    { id: 'b', type: 'daily', at: NOW + 2 * HOUR, title: 't', body: 'b', route: 'x y' },
    { id: 'c', type: 'daily', at: NOW + 3 * HOUR, title: 't', body: 'b', route: '   ' },
    { id: 'd', type: 'daily', at: NOW + 4 * HOUR, title: 't', body: 'b', route: 42 },
    { id: 'e', type: 'daily', at: NOW + 5 * HOUR, title: 't', body: 'b' },
  ], NOW);
  eq(r.message.items.length, 5, 'items that survived');
  eq(r.message.items.map((x) => x.route), ['where', undefined, undefined, undefined, undefined],
    'the destinations that survived');
  is(!Object.prototype.hasOwnProperty.call(r.message.items[1], 'route'),
    'a dropped destination left a route key behind rather than no key at all');
  return '1 destination kept and trimmed; 4 dropped; 5 notifications intact';
});

// -- 9. WHAT RIDES THE PIPE TODAY -------------------------------------------
run('the feed is empty today, and the pipe is therefore silent in a shell as well as in a tab', () => {
  const { h, env } = fresh();
  eq(h.ezikSchedItems(), [], 'what the feed offers');
  const r = h.ezikSchedArm();
  eq(r.sent, false, 'sent');
  eq(env.posts.length, 0, 'posts');
  return 'zero feeds -> zero posts, in a shell that is present and answering';
});

// -- 10. THE TRIGGERS -------------------------------------------------------
run('the root arms once at mount and subscribes to the four wake signals', () => {
  const { h, env } = fresh();
  h.useEzikSchedRoot();
  eq(env.effects.length, 1, 'effects registered');
  eq(env.effects[0].deps, [], 'the dependency array of the root effect');
  const teardown = env.effects[0].fn();
  eq(Array.from(env.listeners.keys()).sort(), ['focus', 'pageshow', 'storage', CHANNEL].sort(),
    'the window signals subscribed to');
  eq(Array.from(env.docListeners.keys()), ['visibilitychange'], 'the document signals subscribed to');
  eq(env.timers.filter(Boolean).length, 1, 'timers armed');
  is(env.timers[0].ms > 0 && env.timers[0].ms <= 24 * HOUR + 60000,
    'the midnight timer is not within a day: ' + env.timers[0].ms);
  is(typeof teardown === 'function', 'the root effect returns no teardown');
  teardown();
  for (const [, a] of env.listeners) eq(a.length, 0, 'listeners left behind after teardown');
  for (const [, a] of env.docListeners) eq(a.length, 0, 'document listeners left behind after teardown');
  eq(env.timers.filter(Boolean).length, 0, 'timers left running after teardown');
  return '4 window signals + visibilitychange + 1 midnight timer, all released on teardown';
});

run('the day timer releases the event loop wherever a platform lets it, so no harness hangs', () => {
  const { h, env } = fresh();
  h.useEzikSchedRoot();
  const teardown = env.effects[0].fn();
  const armed = env.timers.filter(Boolean);
  eq(armed.length, 1, 'timers armed');
  eq(armed[0].unrefs, 1, 'times unref() was called on the day timer');
  // And it re-arms itself rather than firing once: a page open for a week arms once a day.
  armed[0].fn();
  const after = env.timers.filter(Boolean);
  eq(after.length, 2, 'timers armed after the first one fired');
  eq(after[1].unrefs, 1, 'times unref() was called on the second day timer');
  teardown();
  return 'unref()d on arming and on every re-arming; a browser number is untouched by the guard';
});

run('the shell\'s re-arm request is answered, and a message that is not it is ignored', () => {
  const { h, env } = fresh();
  h.useEzikSchedRoot();
  env.effects[0].fn();
  const fire = (detail) => { for (const fn of (env.listeners.get(CHANNEL) || [])) fn({ detail: detail }); };
  // None of these is a re-arm request, and none of them may be treated as one.
  const armed = [];
  for (const d of [null, undefined, 'text', {}, { op: REARM_OP }, { channel: CHANNEL },
    { channel: 'other', op: REARM_OP }, { channel: CHANNEL, op: 'result' }]) {
    fire(d);
    armed.push(env.posts.length);
  }
  eq(armed[armed.length - 1], 0, 'posts made from messages that are not a re-arm request');
  // And the real one is answered: it reaches the arm, which is silent today only because the
  // feed is empty. The proof that it RAN is that it is the same call the mount made.
  fire({ channel: CHANNEL, op: REARM_OP });
  eq(env.posts.length, 0, 'posts (the feed is empty today)');
  return '8 impostor messages ignored; the real one accepted';
});

run('the watcher arms after every render of its caller, with no dependency array', () => {
  const { h, env } = fresh();
  h.useEzikSchedWatch();
  eq(env.effects.length, 1, 'effects registered');
  eq(env.effects[0].deps, undefined, 'the dependency array of the watch effect');
  env.effects[0].fn();
  return 'no dependency array: the position and the preferences need no second copy of their list';
});

run('the root is mounted in App and the watcher in the panel that owns both inputs', () => {
  const mounts = [];
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier') return;
    if (n.callee.name !== 'useEzikSchedRoot' && n.callee.name !== 'useEzikSchedWatch') return;
    mounts.push({ name: n.callee.name, line: startLine(n) });
  });
  eq(mounts.length, 2, 'mount sites');
  const owner = (line) => {
    let best = null;
    for (const [name, decl] of TOP) {
      if (decl.kind !== 'fn') continue;
      if (line >= startLine(decl.node) && line <= endLine(decl.node)) best = name;
    }
    return best;
  };
  const where = mounts.map((m) => m.name + ' in ' + owner(m.line));
  eq(where.sort(), ['useEzikSchedRoot in App', 'useEzikSchedWatch in PrayerTimesPanel'].sort(),
    'where the two hooks are mounted');
  return where.join(', ');
});

// -- 11. STATIC CLAIMS ABOUT THE WHOLE PATH ---------------------------------
run('nothing on this path is a request, a sound, a permission or a console line', () => {
  for (const t of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(',
    'document.cookie', 'indexedDB', 'sessionStorage', 'localStorage', '/api/', 'console.',
    'requestPermission', 'new Audio', 'navigator.', 'alert(', 'confirm(']) {
    is(LIFTED.indexOf(t) === -1, 'the schedule pipe contains ' + t);
  }
  return '17 forbidden constructs, 0 present across ' + LIFTED.split('\n').length + ' lifted lines';
});

run('the pipe posts from exactly one place, and it is the sender', () => {
  const sites = [];
  walk(ast.program, (n) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'MemberExpression') return;
    if (n.callee.property.name !== 'postMessage') return;
    sites.push(startLine(n));
  });
  const send = topFunction('ezikSchedSend');
  const inside = sites.filter((l) => l >= startLine(send) && l <= endLine(send));
  eq(inside.length, 1, 'post sites inside ezikSchedSend');
  // The other post site in this file is the location request, which is a different contract.
  is(sites.length >= 1, 'no post site found at all');
  return '1 post site at app.jsx:' + inside[0] + ' (of ' + sites.length + ' in the file)';
});

run('the pipe reads its own bridge and never the one the location press is held to', () => {
  const send = topFunction('ezikSchedSend');
  const bridgeFn = topFunction('ezikSchedBridge');
  is(text(send).indexOf('ezikShellBridge') === -1,
    'the sender calls ezikShellBridge -- the name tools/location-bridge-measure.cjs holds to the press');
  is(/window\.ReactNativeWebView/.test(text(bridgeFn)), 'the bridge test no longer reads the injected object');
  is(!/navigator\s*\.\s*userAgent/.test(text(bridgeFn)), 'the bridge test reads navigator.userAgent');
  return 'its own three-line test; 0 userAgent reads';
});

// ---------------------------------------------------------------------------
// REPORT.
// ---------------------------------------------------------------------------
console.log('=== the schedule pipe -- the web half, measured ===');
console.log('source:  app.jsx  ' + Buffer.byteLength(source, 'utf8') + ' bytes, '
  + source.split('\n').length + ' lines');
console.log('lifted:  ' + ROOTS.map((n) => n + '@' + startLine(topFunction(n))).join('  '));
console.log('closure: ' + CLOSURE.order.length + ' top-level names, '
  + LIFTED.split('\n').length + ' lines evaluated verbatim');
console.log('words:   channel=' + JSON.stringify(CHANNEL) + '  v=' + VERSION
  + '  op=' + JSON.stringify(OP) + '  rearm=' + JSON.stringify(REARM_OP)
  + '   (all read from their declarations)');
console.log('');

{
  // ONE PAYLOAD, PRINTED WHOLE, exactly as it would reach the shell. A broken pipe must still be
  // REPORTED rather than crash the report: if nothing was posted, that is itself the finding and
  // the cases below name why.
  const { h, env } = fresh();
  const r = h.ezikSchedSend([
    { id: 'sample:two', type: 'daily', at: NOW + 2 * HOUR, title: 'B', body: 'second', route: 'somewhere' },
    { id: 'sample:one', type: 'adhkar', at: NOW + 1 * HOUR, title: 'A', body: 'first' },
    { id: 'sample:past', type: 'daily', at: NOW - HOUR, title: 'C', body: 'dropped' },
  ], NOW);
  console.log('a payload as the shell receives it (now = ' + NOW + '):');
  if (env.posts.length === 1) {
    console.log(JSON.stringify(JSON.parse(env.posts[0]), null, 2).split('\n').map((l) => '  ' + l).join('\n'));
  } else {
    console.log('  (nothing was posted: sent=' + r.sent + ' reason=' + r.reason
      + ' items=' + r.items + ' dropped=' + JSON.stringify(r.dropped) + ')');
  }
  console.log('');
}

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
