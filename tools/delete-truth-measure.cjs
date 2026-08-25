// delete-truth-measure.cjs -- "delete all my data" measured against what the page promises.
//
// WHAT THIS MEASURES AND WHY IT CAN. delete.html tells the reader, in both languages, exactly what
// the Settings button erases: the profile, every conversation, the AI-consent decision and its
// version number, and the position saved for the qibla and the prayer times. It also tells the
// reader, in the very next sentence, what does NOT go: the digest of the parental lock code and
// the device identifier it is tied to. Both halves are promises, and a button can break either one
// -- by erasing less than the page says, or by erasing more. resetAll needs no DOM, no device and
// no network to be judged against them: it needs a localStorage, a window, a document and a
// confirm(). So this tool builds those as fakes it fully controls, lifts the REAL resetAll out of
// app.jsx, seeds a storage with every key the application knows, presses the button, and reads
// back what is left.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. resetAll and every top-level name it closes over
// are extracted from app.jsx by @babel/parser -- the same parser the babel gate and
// tools/build-app.cjs use -- and evaluated verbatim. The closure is resolved by walking the
// function's free identifiers and pulling their top-level declarations, so a helper renamed or a
// constant moved makes extraction throw rather than quietly measure an older idea of the code.
//
// IT DOES RE-TYPE THE EXPECTATIONS, DELIBERATELY. The roster of keys that must go and the roster
// that must stay are written out by name below. Deriving them from resetAll would make this tool
// circular -- it would agree with any resetAll, including a resetAll that erased nothing. An
// expectation is only worth having when the code under test is able to contradict it.
//
// THE SEED IS DERIVED, NOT LISTED. Every `X_KEY = '...'` constant and every string literal handed
// to localStorage anywhere in app.jsx is collected and seeded. The classification of that roster
// into "must go" and "must stay" is then asserted TOTAL: a key added to app.jsx tomorrow and left
// out of both lists fails this tool and asks for a decision, rather than being silently untested.
//
// THE HIJRI OFFSET IS THE CONTROL. delete.html promises it in neither language, so resetAll
// leaving it alone is the correct behaviour and is asserted as such. It is the case that proves
// this tool measures the promise rather than measuring "erase everything".
//
// Usage:  node tools/delete-truth-measure.cjs
// Exit:   0 when every case holds; 1 with the failing cases named.
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'app.jsx');
const PAGE = path.join(REPO, 'delete.html');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));

const source = fs.readFileSync(SRC, 'utf8');
const page = fs.readFileSync(PAGE, 'utf8');
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

/** Every top-level declaration, by the name it binds. */
const TOP = new Map();
for (const n of ast.program.body) {
  if (n.type === 'FunctionDeclaration' && n.id) TOP.set(n.id.name, { node: n, emit: text(n) });
  if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier') TOP.set(d.id.name, { node: d, emit: n.kind + ' ' + text(d) + ';' });
    }
  }
}

/** Names a node BINDS for itself -- params, inner declarations, catch clauses. Not free variables. */
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
    if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;   // .foo
    if (p && p.type === 'ObjectProperty' && p.key === n && !p.computed) return;          // { foo: }
    if (p && p.type === 'ObjectMethod' && p.key === n && !p.computed) return;
    if (p && (p.type === 'VariableDeclarator' || p.type === 'FunctionDeclaration'
      || p.type === 'ClassDeclaration') && p.id === n) return;                           // its own name
    if (bound.has(n.name)) return;
    free.add(n.name);
  });
  return free;
}

// Things the language itself provides. Anything free that is neither one of these nor a top-level
// declaration must be supplied by the harness below -- and is asserted to be, in both directions.
const LANGUAGE = new Set(['Array', 'Object', 'JSON', 'String', 'Number', 'Boolean', 'Math', 'Date',
  'RegExp', 'Error', 'Map', 'Set', 'Promise', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'undefined', 'NaN', 'Infinity', 'console', 'encodeURIComponent', 'decodeURIComponent']);

// What the harness stands in for -- the browser and the React bindings resetAll closes over.
const ENV_NAMES = ['window', 'document', 'localStorage', 'confirm', 'CustomEvent',
  'setDirectConvoLocked', 'setProfile', 'setMessages', 'setChatId', 'setChatList', 'setScreen',
  'chatIdRef'];

const V_RESET = innerConst('App', 'resetAll');

/** Pull resetAll's whole top-level closure, in source order, and name what is left over. */
function resolveClosure(root) {
  const picked = new Map();
  const outside = new Set();
  const queue = [root];
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

const CLOSURE = resolveClosure(V_RESET.init);

// THE HARNESS IS HELD TO THE CODE IN BOTH DIRECTIONS. A name resetAll starts using that nothing
// here supplies is a tool measuring a function that cannot run; a name this harness fakes that
// resetAll stopped using is a tool carrying scenery for a scene that has been struck. Both throw.
{
  const missing = ENV_NAMES.filter((n) => !CLOSURE.outside.has(n));
  const extra = Array.from(CLOSURE.outside).filter((n) => ENV_NAMES.indexOf(n) === -1);
  if (extra.length) {
    throw new Error('resetAll now closes over ' + extra.join(', ') + ' -- names this harness does '
      + 'not supply. Add them to ENV_NAMES and give each one a fake.');
  }
  if (missing.length) {
    throw new Error('resetAll no longer uses ' + missing.join(', ') + ' -- the harness is faking '
      + 'something the code stopped asking for, which is how a stale test starts.');
  }
}

const HARNESS = ['"use strict";']
  .concat(ENV_NAMES.map((n) => 'const ' + n + ' = env.' + n + ';'))
  .concat(CLOSURE.order.map((e) => e[1].emit))
  .concat([
    'const ' + text(V_RESET) + ';',
    'return { resetAll: resetAll };',
  ]).join('\n');

const makeHarness = new Function('env', HARNESS);

// ---------------------------------------------------------------------------
// THE SEED -- every key the application knows, read out of app.jsx.
// ---------------------------------------------------------------------------
const KEY_CONST = /_(KEY|PREFIX)(_[A-Z0-9]+)?$/;

// A _KEY THAT IS NOT A PLACE IN THE STORE, each with the reason it is not one. This is the third
// column item 115-ب established for sw.js's prose, in the one place this tool needed it: the
// suffix rule above is a heuristic, and app.jsx is free to name a key of some OTHER dictionary
// the same way. There is no silent third option -- a name that ends in _KEY is a storage key, or
// it is excused HERE in writing, and an excuse that is wrong fails immediately below.
const NOT_A_STORAGE_KEY = {
  ADHAN_BODY_KEY: 'a key into the interface dictionary, not into the store -- it names the'
    + ' sentence the notification body is written from, and nothing ever hands it to localStorage',
};

/** `const X_KEY = 'literal'` at the top level -> the literal. */
const namedKeys = new Map();
for (const [name, decl] of TOP) {
  if (!KEY_CONST.test(name)) continue;
  if (Object.prototype.hasOwnProperty.call(NOT_A_STORAGE_KEY, name)) continue;
  const init = decl.node.init;
  if (init && init.type === 'StringLiteral') namedKeys.set(name, init.value);
}

/** Every string handed straight to localStorage anywhere in the file. */
const literalKeys = new Set();
walk(ast.program, (n) => {
  if (n.type !== 'CallExpression') return;
  const c = n.callee;
  if (c.type !== 'MemberExpression' || c.computed) return;
  if (!(c.object.type === 'Identifier' && c.object.name === 'localStorage')) return;
  if (['getItem', 'setItem', 'removeItem'].indexOf(c.property.name) === -1) return;
  const a = n.arguments[0];
  if (a && a.type === 'StringLiteral') literalKeys.add(a.value);
});

/** Every identifier handed straight to localStorage anywhere in the file. */
const byConstant = new Set();
walk(ast.program, (n) => {
  if (n.type !== 'CallExpression') return;
  const c = n.callee;
  if (c.type !== 'MemberExpression' || c.computed) return;
  if (!(c.object.type === 'Identifier' && c.object.name === 'localStorage')) return;
  if (['getItem', 'setItem', 'removeItem'].indexOf(c.property.name) === -1) return;
  const a = n.arguments[0];
  if (a && a.type === 'Identifier') byConstant.add(a.name);
});

const PREFIXES = new Set();
for (const [name, value] of namedKeys) { if (/_PREFIX$/.test(name)) PREFIXES.add(value); }

// KEYS ARE NAMED THE WAY app.jsx NAMES THEM. Every roster entry below identifies its key by the
// CONSTANT app.jsx binds it to, and the literal is read back out of that declaration here. Two
// reasons, and the second one is not theoretical. First: a second copy of a storage key in a
// second file is exactly the drift this repository spends its guards preventing, and a tool that
// re-typed twenty of them would be the drift it is meant to detect. Second: guards/i18n-ui-guard
// .cjs holds the interface-language key to an EXACT set of four files, in both directions -- this
// tool naming that string would have been a fifth, and would have failed a gate that is right.
// A renamed constant now throws here instead of being quietly missed.
function keyOf(name) {
  const decl = TOP.get(name);
  if (!decl) {
    throw new Error('app.jsx no longer declares the constant ' + name + ' -- this tool identifies '
      + 'every storage key by the name app.jsx gives it, never by a second copy of the string, so '
      + 'a rename has to be seen here rather than silently measured as a key nobody writes.');
  }
  const init = decl.node.init;
  if (!init || init.type !== 'StringLiteral') {
    throw new Error(name + ' is no longer a plain string constant in app.jsx');
  }
  return init.value;
}

/** A roster entry -> the key string it stands for. */
function keyFor(e) {
  if (e.c) return keyOf(e.c);
  if (e.chat) return keyOf('EZIK_CHAT_PREFIX') + e.chat;
  if (!literalKeys.has(e.lit)) {
    throw new Error('this tool expects the bare literal "' + e.lit + '" to be a storage key, but '
      + 'app.jsx hands no such string to localStorage any more');
  }
  return e.lit;
}

/** The whole roster: plain keys, and separately the prefixes that stand for a family of them. */
const ALL_KEYS = new Set();
for (const [, v] of namedKeys) { if (!PREFIXES.has(v)) ALL_KEYS.add(v); }
for (const v of literalKeys) ALL_KEYS.add(v);

// Two saved conversations, so "every stored body" is a claim with bodies behind it.
const CHAT_IDS = ['c_alpha', 'c_beta'];

// ---------------------------------------------------------------------------
// THE EXPECTATIONS -- written out, not derived. See the header.
// ---------------------------------------------------------------------------

// What this button already erased before this round, and must still erase. Not one of these is
// new; every one is a line that was in resetAll yesterday. If a name drops out of this set the
// tool goes red, which is the whole point: no silent regression behind a new repair.
const MUST_GO_ALREADY = [
  { lit: 'child_profile' },              // the name, birth year and gender
  { c: 'EZIK_CHATS_KEY' },               // the index of saved conversations
  { chat: 'c_alpha' },                   // and every stored body that index lists
  { chat: 'c_beta' },
  { c: 'EZIK_LEGACY_MSGS_KEY' },         // the single legacy thread
  { c: 'EZIK_FAVS_KEY' },                // saved replies, which outlive a deleted conversation
  { c: 'EZIK_A11Y_KEY' },                // reading preferences
  { lit: 'directConvoLocked' },
  { c: 'MUSHAF_BOOKMARK_KEY' },
  { lit: 'mushaf_pos_v1' },              // the pre-bookmark name, swept
  { c: 'MUSHAF_LAST_PAGE_KEY' },
  { c: 'KHATMAH_KEY' },
  { c: 'WIRD_TARGET_KEY' },
  { c: 'WIRD_DAY_KEY' },
  { c: 'ADHKAR_PROGRESS_KEY' },
  { c: 'ADHKAR_FAVORITES_KEY' },
  { c: 'ADHKAR_USAGE_KEY' },
  { c: 'EZIK_UI_STYLE_KEY_DEAD' },       // the obsolete layout key
  { c: 'EZIK_VISUAL_THEME_KEY' },
  { c: 'EZIK_VISUAL_THEME_KEY_V1' },
];

// What delete.html:94 and :138 promise and the code did NOT keep until this round. Each is mapped
// to the clause of the page that asks for it.
const MUST_GO_NEW = [
  { c: 'EZ_AI_CONSENT_KEY',
    clause: 'the AI-consent decision and its version number' },
  { c: 'QIBLA_LOC_KEY',
    clause: 'the position saved for the qibla and the prayer times -- the position' },
  { c: 'PRAYER_PREFS_KEY',
    clause: 'the position saved for the qibla and the prayer times -- the prayer settings' },
  { c: 'PRAYER_SCHEDULE_KEY',
    clause: 'the position saved for the qibla and the prayer times -- the table derived from both' },
];

// What must be standing afterwards, and the reason each one is allowed to stand.
const MUST_STAY = [
  { c: 'HIJRI_OFFSET_KEY',
    why: 'delete.html promises it in neither language; erasing it would widen the button' },
  // ITEM 67. THE SAME RULE AS THE HIJRI OFFSET, BY THE SAME OWNER'S REASONING. delete.html
  // names four things it erases and two it keeps, and the reminder switch is in neither list.
  // Erasing it would widen the button beyond its own page -- and it would do it in the most
  // expensive direction available: a reader who had granted the system permission and turned
  // the reminder on would find it silently off, with the permission still granted, and no
  // sentence anywhere that had warned them. The page is not touched to make room for it.
  { c: 'PRAYER_NOTIFY_KEY',
    why: 'delete.html promises it in neither language; erasing it would widen the button' },
  { c: 'LEGACY_PIN_HASH_KEY',
    why: 'delete.html:95 / :139 -- the digest of the parental lock code is named as remaining' },
  { c: 'DEVICE_ID_KEY',
    why: 'delete.html:95 / :139 -- the device identifier that digest is tied to' },
  { c: 'EZ_LANG_KEY', why: 'not promised -- the interface language' },
  { c: 'SPEND_GATE_KEY', why: 'not promised' },
  { c: 'EZIK_WM_KEY', why: 'not promised' },
  { c: 'EZIK_ENTER_KEY', why: 'not promised' },
  { c: 'EZIK_WM_HIDE_KEY', why: 'not promised' },
  { c: 'THEME_KEY', why: 'not promised' },
  { c: 'FOUNDER_TOKEN_KEY', why: 'not promised' },
  { c: 'EZIK_DHIKR_CYCLE_KEY', why: 'not promised' },
  { c: 'EZWID_KEY', why: 'not promised' },
  { c: 'EZIK_FATWA_SCHOLARS_KEY', why: 'not promised' },
  { c: 'ADHKAR_UI_V2_KEY', why: 'not promised' },
  { c: 'ADHKAR_STREAK_KEY', why: 'not promised' },
  { c: 'MUSHAF_SVG_KEY', why: 'not promised' },
  { c: 'MADINA_IMG_KEY', why: 'not promised' },
  { c: 'DAILY_WIRD_KEY', why: 'not promised' },
  { lit: 'tashkeel_v1', why: 'not promised' },
];

// Resolved once, here, so every case below compares real keys and a rename fails loudly above.
const GONE_ALREADY = MUST_GO_ALREADY.map(keyFor);
const GONE_NEW = MUST_GO_NEW.map((e) => ({ key: keyFor(e), clause: e.clause }));
const STAYS = MUST_STAY.map((e) => ({ key: keyFor(e), why: e.why }));

const GO = new Set(GONE_ALREADY.concat(GONE_NEW.map((x) => x.key)));
const STAY = new Set(STAYS.map((x) => x.key));

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

/** localStorage, in a Map, with the one thing a stub usually forgets: the ability to list keys. */
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    has: (k) => m.has(k),
    keys: () => Array.from(m.keys()),
    size: () => m.size,
  };
}

function fakeWindow(events) {
  return {
    dispatchEvent: (e) => { events.push(e); return true; },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function fakeDocument(painted) {
  return {
    documentElement: {
      setAttribute: (k, v) => { painted.push([k, v]); },
      getAttribute: () => null,
    },
  };
}

function FakeCustomEvent(type, init) {
  this.type = type;
  this.detail = init && init.detail;
}

/** One press-ready harness, its storage seeded with the whole roster, plus what the press did. */
function scene(opts) {
  const o = opts || {};
  const asked = [];
  const events = [];
  const painted = [];
  const setters = [];
  const storage = fakeStorage();

  // Every key the application knows, each with a value that is plainly this tool's, so a survivor
  // read back later cannot be mistaken for a default the code invented for itself.
  for (const k of ALL_KEYS) storage.setItem(k, 'SEED:' + k);
  // The conversation index is real JSON, because ezikClearAllChats parses it to find the bodies.
  storage.setItem(keyOf('EZIK_CHATS_KEY'), JSON.stringify(CHAT_IDS.map((id) => ({ id: id, pk: 'p1', at: 1 }))));
  for (const id of CHAT_IDS) storage.setItem(keyOf('EZIK_CHAT_PREFIX') + id, JSON.stringify([{ role: 'user', text: 'x' }]));

  const env = {
    window: fakeWindow(events),
    document: fakeDocument(painted),
    localStorage: storage,
    confirm: (q) => { asked.push(q); return o.answer !== false; },
    CustomEvent: FakeCustomEvent,
    setDirectConvoLocked: (v) => { setters.push(['setDirectConvoLocked', v]); },
    setProfile: (v) => { setters.push(['setProfile', v]); },
    setMessages: (v) => { setters.push(['setMessages', v]); },
    setChatId: (v) => { setters.push(['setChatId', v]); },
    setChatList: (v) => { setters.push(['setChatList', v]); },
    setScreen: (v) => { setters.push(['setScreen', v]); },
    chatIdRef: { current: 'c_alpha' },
  };
  return {
    h: makeHarness(env), env: env, storage: storage,
    asked: asked, events: events, painted: painted, setters: setters,
    seeded: storage.keys().slice(),
  };
}

/** Press the button and report what went and what stayed. */
function press(opts) {
  const s = scene(opts);
  const before = new Set(s.seeded);
  s.h.resetAll();
  const after = new Set(s.storage.keys());
  const gone = Array.from(before).filter((k) => !after.has(k)).sort();
  const left = Array.from(after).sort();
  return { s: s, before: before, after: after, gone: gone, left: left };
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

// ---- 0. The roster this tool seeds is the roster it has an opinion about. -------------------
run('every key app.jsx knows is classified -- must go, or must stay, and never neither', () => {
  const unclassified = Array.from(ALL_KEYS).filter((k) => !GO.has(k) && !STAY.has(k)).sort();
  is(unclassified.length === 0,
    'app.jsx knows ' + unclassified.length + ' key(s) this tool has no opinion about: '
    + unclassified.join(', ') + ' -- decide whether "delete all my data" promises each one, '
    + 'then add it to MUST_GO_ALREADY or to MUST_STAY.');
  const both = Array.from(GO).filter((k) => STAY.has(k));
  is(both.length === 0, 'classified as both go and stay: ' + both.join(', '));
  const phantom = Array.from(STAY).filter((k) => !ALL_KEYS.has(k)).sort();
  is(phantom.length === 0,
    'this tool expects ' + phantom.join(', ') + ' to survive, but app.jsx no longer knows that '
    + 'name -- an expectation about a key nobody writes proves nothing');
  return ALL_KEYS.size + ' keys read out of app.jsx; ' + GO.size + ' must go, ' + STAY.size
    + ' must stay, 0 unclassified';
});

run('...and every name excused from that roster really is a key into something else', () => {
  const names = Object.keys(NOT_A_STORAGE_KEY);
  is(names.length > 0, 'the excuse roster is empty -- delete this case with it');
  for (const name of names) {
    const decl = TOP.get(name);
    is(!!decl, 'app.jsx no longer declares ' + name + ', so the excuse for it is scenery');
    const init = decl.node.init;
    is(!!init && init.type === 'StringLiteral',
      name + ' is no longer a plain string constant, and the excuse for it no longer describes it');
    // THE EXCUSE IS CHECKED, NOT TAKEN. A name excused from the storage roster must never be
    // handed to the store -- by its own constant or by its literal. The moment it is, it IS a
    // storage key, the excuse is false, and this case is the thing that says so.
    is(!literalKeys.has(init.value),
      name + ' is excused as "not a storage key", but its literal "' + init.value + '" is handed'
      + ' straight to localStorage somewhere in app.jsx');
    is(!byConstant.has(name),
      name + ' is excused as "not a storage key", but app.jsx hands it to localStorage by name');
    is(String(NOT_A_STORAGE_KEY[name]).trim().length > 20,
      name + ' is excused with no reason worth reading');
  }
  return names.length + ' excused name(s), each still declared, each with a reason, none of them'
    + ' reaching the store';
});

// ---- 1. The four the page already promised. -------------------------------------------------
run('the four the page promised and the code did not keep are gone, each by name', () => {
  const r = press();
  const lines = [];
  for (const item of GONE_NEW) {
    is(r.before.has(item.key), item.key + ' was never seeded -- this case is measuring nothing');
    is(!r.after.has(item.key),
      item.key + ' SURVIVED "delete all my data", and delete.html promises it goes: "'
      + item.clause + '"');
    lines.push(item.key);
  }
  return lines.join(' · ') + ' -- all 4 gone';
});

// ---- 2. The control: what was not promised is not touched. ----------------------------------
run('ezik_hijri_offset_v1 is still there -- the page promises it in neither language', () => {
  const r = press();
  const hijri = keyOf('HIJRI_OFFSET_KEY');
  is(r.before.has(hijri), 'the hijri offset was never seeded');
  is(r.after.has(hijri),
    hijri + ' was erased. Nothing on delete.html asks for that, so the button now erases more '
    + 'than it says -- the page made false in the other direction.');
  eq(r.s.storage.getItem(hijri), 'SEED:' + hijri, 'the hijri offset value after the press');
  return 'standing, and holding the exact value it was seeded with';
});

// ---- 3. The other half of the promise: what delete.html says REMAINS. -----------------------
run('the parental digest and the device identifier remain -- delete.html:95 / :139 say so', () => {
  const r = press();
  for (const k of [keyOf('LEGACY_PIN_HASH_KEY'), keyOf('DEVICE_ID_KEY')]) {
    is(r.before.has(k), k + ' was never seeded');
    is(r.after.has(k),
      k + ' was erased. delete.html:95 and :139 tell the reader it remains and that they must '
      + 'email to have it removed -- erasing it here makes those two sentences false.');
  }
  // And the page still carries the sentences this case is holding the code to.
  is(page.indexOf('بصمةُ رمزِ قفلِ الوالدين') !== -1, 'delete.html no longer carries the Arabic sentence');
  is(page.indexOf('the digest of the parental lock code') !== -1,
    'delete.html no longer carries the English sentence');
  return keyOf('LEGACY_PIN_HASH_KEY') + ' · ' + keyOf('DEVICE_ID_KEY')
    + ' both standing; both page sentences still on the page';
});

// ---- 4. No silent regression: everything erased before is still erased. ---------------------
run('every erasure this button already performed still happens, one by one', () => {
  const r = press();
  const survivors = [];
  for (const k of GONE_ALREADY) {
    is(r.before.has(k), k + ' was never seeded -- this case is measuring nothing');
    if (r.after.has(k)) survivors.push(k);
  }
  is(survivors.length === 0,
    survivors.length + ' erasure(s) this button used to perform no longer happen: '
    + survivors.join(', '));
  return GONE_ALREADY.length + '/' + GONE_ALREADY.length + ' pre-existing erasures intact';
});

run('the press erases the roster and nothing beyond it', () => {
  const r = press();
  const expected = Array.from(GO).sort();
  eq(r.gone, expected, 'the exact set of keys the press removed');
  return r.gone.length + ' keys removed, exactly the ' + expected.length + ' expected';
});

// ---- 5. The survivors, printed by name for the owner to read. -------------------------------
run('what is still on the device after the button, by name', () => {
  const r = press();
  const unexpected = r.left.filter((k) => !STAY.has(k));
  is(unexpected.length === 0, 'unexpected survivors: ' + unexpected.join(', '));
  const missing = Array.from(STAY).filter((k) => !r.after.has(k)).sort();
  is(missing.length === 0, 'expected survivors that did not survive: ' + missing.join(', '));
  return r.left.length + ' survivors (listed in full below the cases)';
});

// ---- The button is still a button: the dialog, and the answer "no". -------------------------
run('answering no to the dialog erases nothing at all', () => {
  const r = press({ answer: false });
  eq(r.gone, [], 'keys removed after the reader answered no');
  eq(r.s.storage.size(), r.before.size, 'storage size after the reader answered no');
  eq(r.s.setters, [], 'React state changes after the reader answered no');
  eq(r.s.asked.length, 1, 'confirm() calls');
  return '0 removals, 0 state changes, 1 dialog';
});

run('answering yes still does the rest of what it did: state, screen, repaint', () => {
  const r = press();
  eq(r.s.asked.length, 1, 'confirm() calls');
  eq(r.s.setters, [['setDirectConvoLocked', false], ['setProfile', null], ['setMessages', []],
    ['setChatId', null], ['setChatList', []], ['setScreen', 'onboarding']],
    'the React state changes the press makes, in order');
  eq(r.s.env.chatIdRef.current, null, 'chatIdRef after the press');
  const attr = keyOf('EZIK_VISUAL_THEME_ATTR');
  const istana = keyOf('EZIK_VISUAL_THEME_ISTANA');
  const evt = keyOf('EZIK_VISUAL_THEME_EVENT');
  eq(r.s.painted, [[attr, istana]], 'the visual theme repaint');
  eq(r.s.events.map((e) => [e.type, e.detail]), [[evt, istana]], 'the events dispatched');
  return '1 dialog, 6 state changes in order, repainted to ' + istana + ', 1 event';
});

// ---- The lines themselves: named constants, not a second literal. ---------------------------
run('the four new removals use the named constant, never a second string literal', () => {
  const wanted = ['EZ_AI_CONSENT_KEY', 'QIBLA_LOC_KEY', 'PRAYER_PREFS_KEY', 'PRAYER_SCHEDULE_KEY'];
  const removed = [];
  walk(V_RESET.init, (n) => {
    if (n.type !== 'CallExpression') return;
    const c = n.callee;
    if (c.type !== 'MemberExpression' || c.computed) return;
    if (!(c.object.type === 'Identifier' && c.object.name === 'localStorage')) return;
    if (c.property.name !== 'removeItem') return;
    const a = n.arguments[0];
    if (a.type === 'Identifier') removed.push(a.name);
    else if (a.type === 'StringLiteral') removed.push('"' + a.value + '"');
  });
  for (const name of wanted) {
    is(removed.indexOf(name) !== -1,
      'resetAll does not remove ' + name + ' by its named constant');
  }
  // And each new key's literal still appears exactly once in the whole file: at its declaration.
  for (const item of GONE_NEW) {
    const hits = source.split("'" + item.key + "'").length - 1;
    eq(hits, 1, "occurrences of the literal '" + item.key + "' in app.jsx");
  }
  return wanted.length + ' by constant; each literal still appears exactly once in app.jsx';
});

run('clearQiblaLoc is untouched and is still its own button', () => {
  const fn = TOP.get('clearQiblaLoc');
  is(!!fn, 'app.jsx no longer declares clearQiblaLoc');
  const body = text(fn.node);
  is(body.indexOf('QIBLA_LOC_KEY') !== -1, 'clearQiblaLoc no longer clears the qibla key');
  is(body.indexOf('PRAYER_PREFS_KEY') === -1 && body.indexOf('EZ_AI_CONSENT_KEY') === -1,
    'clearQiblaLoc has grown into a second "delete all my data"');
  return 'clearQiblaLoc@app.jsx:' + startLine(fn.node) + ' clears the qibla key and nothing else';
});

// ---- The page still says what the code is being held to. ------------------------------------
run('delete.html still carries both promises this tool measures against', () => {
  const arabic = 'قرارُ موافقة الذكاء الاصطناعيّ ورقمُ نسخته';
  const english = 'the AI-consent decision and its version number';
  const arabicLoc = 'الموضعُ المحفوظُ للقبلةِ ومواقيتِ الصلاة';
  const englishLoc = 'the position saved for the qibla and the prayer times';
  for (const s of [arabic, english, arabicLoc, englishLoc]) {
    is(page.indexOf(s) !== -1,
      'delete.html no longer says "' + s + '" -- either the page was weakened to fit the code, '
      + 'which is the wrong repair, or this tool measures against a sentence nobody makes.');
  }
  const lineOf = (s) => page.slice(0, page.indexOf(s)).split('\n').length;
  return 'Arabic promise at delete.html:' + lineOf(arabic)
    + ', English promise at delete.html:' + lineOf(english);
});

// ---------------------------------------------------------------------------
// REPORT.
// ---------------------------------------------------------------------------
console.log('=== "delete all my data" -- measured against delete.html ===');
console.log('source:  app.jsx  ' + Buffer.byteLength(source, 'utf8') + ' bytes, '
  + source.split('\n').length + ' lines');
console.log('lifted:  resetAll@' + startLine(V_RESET) + '-' + endLine(V_RESET)
  + '  + ' + CLOSURE.order.length + ' top-level names it closes over');
console.log('faked:   ' + ENV_NAMES.length + ' -- ' + ENV_NAMES.join(', '));
console.log('seeded:  ' + ALL_KEYS.size + ' keys read out of app.jsx, plus '
  + CHAT_IDS.length + ' conversation bodies');
console.log('');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? '[PASS] ' : '[FAIL] ') + r.name);
  if (r.detail) console.log('        ' + r.detail);
}
console.log('');

// THE LIST THE OWNER READS. Not an assertion -- the assertions are above. This is the answer to
// "what is actually left on my child's device after I press that button", written out by name.
{
  const r = press();
  const why = new Map(STAYS.map((x) => [x.key, x.why]));
  console.log('=== what "delete all my data" ERASES (' + r.gone.length + ') ===');
  for (const k of r.gone) console.log('   - ' + k);
  console.log('');
  console.log('=== what SURVIVES it, and why (' + r.left.length + ') ===');
  for (const k of r.left) console.log('   + ' + k + '  --  ' + (why.get(k) || '(unclassified)'));
  console.log('');
}

console.log('=== ' + (results.length - failed) + '/' + results.length + ' cases hold ===');
if (failed) {
  console.log('-- FAILURES --');
  for (const r of results) { if (!r.ok) console.log('   * ' + r.name + ': ' + r.detail); }
}
process.exit(failed ? 1 : 0);
