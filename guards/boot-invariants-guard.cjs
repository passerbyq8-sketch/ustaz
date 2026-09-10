// boot-invariants-guard.cjs — the three things that were being checked BY HAND in every order.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS FILE EXISTS. Three properties of index.html have been re-verified by hand, in prose, at
// the end of order after order for weeks:
//
//   1. THE CATCHER is the first script after <body>.
//   2. ErrorBoundary is DEFINED **and MOUNTED**.
//   3. pinPassRef is present at every one of its positions.
//
// A check that is rewritten from memory each time is a check that will be forgotten once, and the
// once is the only one that matters. None of the three is expensive to assert; all three are
// expensive to lose. So they are a gate.
//
// THE FIRST IS THE ONE THAT ROTS SILENTLY. The catcher's whole value is its POSITION: it is the
// only thing in the page that can witness a failure before React exists — a CDN that 404s, an SRI
// mismatch, a Babel transform that throws, a syntax error in the app. The React error boundary
// cannot see any of that, because at that moment there is no React to catch with. A script
// inserted above it does not break anything anybody would notice; it just moves the witness
// behind the thing it was there to witness. So the scripts between <body> and the catcher are
// COUNTED, and the count must be zero — this gate fails on a perfectly benign insertion, which is
// the entire point.
//
// THE SECOND IS TWO CLAIMS, NOT ONE. `function ErrorBoundary` present proves nothing: a boundary
// that is defined and not mounted is dead code that reads exactly like protection. Both halves are
// asserted, and the mount is read from the syntax tree — root.render(createElement(ErrorBoundary,
// null, createElement(App))) — not from a substring that a comment could satisfy.
//
// THE THIRD IS A COUNT OF ROLES. pinPassRef is the circuit breaker that stops a device whose
// rendered spacer never converges from writing layout state forever. It has six code sites and
// each has a job: one declaration, one increment, one ceiling comparison, and three resets (the
// stream grew, the turn settled, a new turn armed). Item 102-ب was about which of those the
// breaker may be spent on. Losing any one of them is a silent behaviour change, so the roles are
// counted by role rather than pinned to a line number.
//
// THIS GATE READS index.html AND NEVER WRITES IT. Every mutation used to prove it was applied to a
// temporary copy outside the working tree.
//
// THIS GATE REPLACES THE MANUAL CHECK. From here on the three are verified by `npm run gates` and
// no order needs to restate them. A failure names WHICH of the three fell and why, so the reply to
// a red line is never "an assertion failed".
// ---------------------------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const NL = String.fromCharCode(10);
const HTML_FILE = process.argv[2] || path.join(__dirname, '..', 'index.html');

let pass = 0;
let fail = 0;
const failures = [];

// Every failure carries the name of the subject it belongs to. "an assertion failed" is not a
// diagnosis, and these three fail for reasons that have nothing to do with one another.
function ok(subject, name, cond, why) {
  if (cond) { pass++; console.log('  PASS [' + subject + '] ' + name); return true; }
  fail++;
  failures.push('[' + subject + '] ' + name);
  console.log('  FAIL [' + subject + '] ' + name);
  if (why) console.log('       ' + String(why).split(NL).join(NL + '       '));
  return false;
}
function eq(subject, name, actual, expected, why) {
  return ok(subject, name, actual === expected,
    'measured ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)
    + (why ? NL + why : ''));
}
function head(t) { console.log(NL + '=== ' + t + ' ==='); }

// A missing source is an explicit, named abort -- never an empty string that every check below
// would then be satisfied by. That is the defect gate `vacuousassert` exists to refuse, and this
// file is not going to be its first violation.
let html;
try { html = fs.readFileSync(HTML_FILE, 'utf8'); }
catch (e) { console.error('ABORT: cannot read ' + HTML_FILE + ': ' + e.message); process.exit(2); }
console.log('reading ' + HTML_FILE + ' (' + html.length + ' bytes)');

/* =============================================================================================
 * A. THE CATCHER IS THE FIRST SCRIPT AFTER <body>
 * =========================================================================================== */
head('A. THE PRE-BOOT CATCHER, AND ITS POSITION');
const CATCHER = 'CATCHER';
const CATCHER_ID = 'ezik-diagnostic-catcher';

const bodyOpen = /<body\b[^>]*>/i.exec(html);
if (!ok(CATCHER, 'the document has a <body> tag to measure from', !!bodyOpen,
  'no <body ...> in ' + HTML_FILE + ' -- the position of the catcher cannot be judged at all')) {
  console.log(NL + 'FAIL  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(1);
}
const bodyEnd = bodyOpen.index + bodyOpen[0].length;
const afterBody = html.slice(bodyEnd);

// Every opening <script ...> tag after <body>, in document order, with its offset.
const scriptTags = [];
{
  const re = /<script\b[^>]*>/gi;
  let m;
  while ((m = re.exec(afterBody)) !== null) scriptTags.push({ tag: m[0], at: m.index });
}
ok(CATCHER, 'there is at least one script after <body>', scriptTags.length > 0,
  'the page loads nothing after <body>, so there is no catcher and no app');

const catcherIdx = scriptTags.findIndex((s) => new RegExp('id\\s*=\\s*["\']' + CATCHER_ID + '["\']', 'i').test(s.tag));
ok(CATCHER, 'the catcher is present, by id', catcherIdx !== -1,
  'no <script id="' + CATCHER_ID + '"> after <body>. The page has no witness for any failure that'
  + NL + 'happens before React exists -- a 404 on the CDN, an SRI mismatch, a Babel transform that'
  + NL + 'throws. The error boundary cannot see those; nothing can, once this is gone.');

if (catcherIdx !== -1) {
  // THE COUNT. Not "the catcher comes before React" -- that is true of a catcher with three
  // scripts stacked on top of it. Zero, counted, so a harmless insertion fails here.
  const before = scriptTags.slice(0, catcherIdx);
  eq(CATCHER, 'exactly zero scripts stand between <body> and the catcher', before.length, 0,
    before.map((s) => '       intruder: ' + s.tag).join(NL)
    + NL + '       Any script above the catcher runs before it, so a failure inside THAT script is'
    + NL + '       the one thing the catcher cannot record. Move it back to the top of <body>.');

  const catcherTag = scriptTags[catcherIdx].tag;
  ok(CATCHER, '...and the catcher is not deferred', !/\bdefer\b/i.test(catcherTag), catcherTag);
  ok(CATCHER, '...and is not async', !/\basync\b/i.test(catcherTag), catcherTag);
  ok(CATCHER, '...and is not a module (which defers by definition)',
    !/type\s*=\s*["']module["']/i.test(catcherTag), catcherTag);
  ok(CATCHER, '...and is inline, not a src the network can lose',
    !/\bsrc\s*=/i.test(catcherTag), catcherTag);

  // Ordering against the things it exists to witness. Redundant with the count above on a healthy
  // tree, and not redundant at all on a broken one: it names WHICH boot stage overtook it.
  const catcherAt = scriptTags[catcherIdx].at;
  const laterThan = (label, re) => {
    const m2 = re.exec(afterBody);
    if (!m2) { ok(CATCHER, '...and ' + label + ' is present to be preceded', false, 'not found after <body>'); return; }
    ok(CATCHER, '...and the catcher precedes ' + label, catcherAt < m2.index,
      'catcher at +' + catcherAt + ', ' + label + ' at +' + m2.index);
  };
  laterThan('the React runtime', /<script[^>]*react[^>]*>/i);
  // ITEM 32. There is no Babel transform in the page to precede. What the catcher must now
  // precede is the thing that replaced it and can fail in the same three ways -- a 404, an SRI
  // mismatch, a syntax error: the compiled bundle. Moved, not dropped, and to a stricter anchor
  // (an exact src) than the substring /babel/ it replaces.
  laterThan('the app bundle', /<script[^>]*\ssrc=["']app\.js["'][^>]*>/i);
  laterThan('the root div', /<div[^>]+id\s*=\s*["']root["']/i);
}

/* =============================================================================================
 * THE SHIPPED BLOCK — LOCATED EXPLICITLY, NEVER FALLING BACK TO ''
 * =========================================================================================== */
// ITEM 32-b: the block is located in ONE place, ../tools/babel-block.cjs, which REQUIRES every
// anchor and names the one it lost. The two exits this replaces said the same thing twice; the
// rule they enforced -- an explicit failure, never an empty region every check below would be
// satisfied by -- is now enforced for all fifteen readers at once.
const BB = require('../tools/babel-block.cjs');
let bbBlock;
try { bbBlock = BB.readBabelBlock({ file: HTML_FILE, html: html }); }
catch (e) {
  console.log('  FAIL [BOOT] ' + e.message);
  console.log(NL + 'FAIL  ' + pass + ' checks passed, ' + (fail + 1) + ' failed.');
  process.exit(1);
}
const code = bbBlock.raw;

let ast;
try {
  ast = parser.parse(code, { sourceType: 'script', plugins: ['jsx'], allowReturnOutsideFunction: true });
} catch (e) {
  console.log('  FAIL [BOOT] the shipped block does not parse: ' + e.message);
  console.log(NL + 'FAIL  ' + pass + ' checks passed, ' + (fail + 1) + ' failed.');
  process.exit(1);
}
pass++;
console.log('  PASS [BOOT] the shipped text/babel block was located and parsed ('
  + code.length + ' bytes)');

function walk(node, fn, parent) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, fn, node); }
    else if (v && typeof v.type === 'string') walk(v, fn, node);
  }
}
const lineOf = (n) => (n && n.loc ? n.loc.start.line : '?');

/* =============================================================================================
 * B. ErrorBoundary IS DEFINED **AND MOUNTED**
 * =========================================================================================== */
head('B. THE ERROR BOUNDARY: DEFINED, AND ACTUALLY MOUNTED');
const BOUNDARY = 'ERROR BOUNDARY';

const definitions = [];
const mounts = [];
const bareAppRenders = [];
walk(ast, (n) => {
  if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'ErrorBoundary') definitions.push(n);
  if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'ErrorBoundary'
    && n.init && (n.init.type === 'FunctionExpression' || n.init.type === 'ArrowFunctionExpression'
      || n.init.type === 'ClassExpression')) definitions.push(n);
  if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'ErrorBoundary') definitions.push(n);

  if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
    && !n.callee.computed && n.callee.property.type === 'Identifier'
    && n.callee.property.name === 'render' && n.arguments.length >= 1) {
    const arg = n.arguments[0];
    const isCreate = (x) => x && x.type === 'CallExpression' && x.callee.type === 'MemberExpression'
      && !x.callee.computed && x.callee.property.type === 'Identifier'
      && x.callee.property.name === 'createElement';
    if (isCreate(arg) && arg.arguments[0] && arg.arguments[0].type === 'Identifier'
      && arg.arguments[0].name === 'ErrorBoundary') mounts.push({ node: n, element: arg });
    else if (isCreate(arg) && arg.arguments[0] && arg.arguments[0].type === 'Identifier'
      && arg.arguments[0].name === 'App') bareAppRenders.push(n);
    else if (arg && arg.type === 'JSXElement') {
      const nameOf = (el) => el.openingElement && el.openingElement.name
        && el.openingElement.name.type === 'JSXIdentifier' ? el.openingElement.name.name : null;
      if (nameOf(arg) === 'ErrorBoundary') mounts.push({ node: n, element: arg, jsx: true });
      else if (nameOf(arg) === 'App') bareAppRenders.push(n);
    }
  }
});

eq(BOUNDARY, 'ErrorBoundary is declared exactly once', definitions.length, 1,
  '       A boundary declared twice is a boundary whose behaviour depends on load order.');
eq(BOUNDARY, '...and it is MOUNTED at the root, not merely defined', mounts.length, 1,
  '       A defined-and-unmounted boundary is dead code that reads exactly like protection: every'
  + NL + '       componentDidCatch in it is unreachable, and the first render error takes the whole'
  + NL + '       page to a blank screen with nothing to copy.');

if (mounts.length === 1) {
  const el = mounts[0].element;
  let childName = null;
  if (mounts[0].jsx) {
    const kid = (el.children || []).find((c) => c.type === 'JSXElement');
    childName = kid && kid.openingElement.name.type === 'JSXIdentifier' ? kid.openingElement.name.name : null;
  } else {
    const kid = el.arguments[2];
    childName = kid && kid.type === 'CallExpression' && kid.arguments[0]
      && kid.arguments[0].type === 'Identifier' ? kid.arguments[0].name : null;
  }
  eq(BOUNDARY, '...and the application is INSIDE it, not beside it', childName, 'App',
    '       line ' + lineOf(mounts[0].node) + '. A boundary that does not wrap App catches nothing'
    + NL + '       App throws.');
}
eq(BOUNDARY, '...and nothing renders App at the root without it', bareAppRenders.length, 0,
  bareAppRenders.map((n) => '       bare render at line ' + lineOf(n)).join(NL));

// The boundary is only worth mounting if it can still show and copy what it caught.
const boundaryMembers = [];
walk(ast, (n) => {
  if (n.type === 'MemberExpression' && !n.computed
    && n.object.type === 'MemberExpression' && !n.object.computed
    && n.object.object.type === 'Identifier' && n.object.object.name === 'ErrorBoundary'
    && n.object.property.name === 'prototype' && n.property.type === 'Identifier') {
    boundaryMembers.push(n.property.name);
  }
  if (n.type === 'MemberExpression' && !n.computed
    && n.object.type === 'Identifier' && n.object.name === 'ErrorBoundary'
    && n.property.type === 'Identifier') boundaryMembers.push(n.property.name);
});
for (const member of ['componentDidCatch', 'getDerivedStateFromError', 'render']) {
  ok(BOUNDARY, '...and it still declares ' + member, boundaryMembers.indexOf(member) !== -1,
    'declared members: ' + Array.from(new Set(boundaryMembers)).sort().join(', '));
}

/* =============================================================================================
 * C. pinPassRef, AT EVERY ONE OF ITS POSITIONS
 * =========================================================================================== */
head('C. THE PIN CIRCUIT BREAKER, BY ROLE');
const BREAKER = 'PIN BREAKER';

const decls = [];
const increments = [];
const ceilings = [];
const resets = [];
const otherWrites = [];
const isRefCurrent = (n) => n && n.type === 'MemberExpression' && !n.computed
  && n.object.type === 'Identifier' && n.object.name === 'pinPassRef'
  && n.property.type === 'Identifier' && n.property.name === 'current';

walk(ast, (n) => {
  if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'pinPassRef') decls.push(n);
  if (n.type === 'AssignmentExpression' && isRefCurrent(n.left)) {
    if (n.operator === '+=') increments.push(n);
    else if (n.operator === '=' && n.right.type === 'NumericLiteral' && n.right.value === 0) resets.push(n);
    else otherWrites.push(n);
  }
  if (n.type === 'UpdateExpression' && isRefCurrent(n.argument)) increments.push(n);
  if (n.type === 'BinaryExpression' && isRefCurrent(n.left)
    && ['>', '>=', '<', '<='].indexOf(n.operator) !== -1) ceilings.push(n);
});

eq(BREAKER, 'the breaker is declared exactly once', decls.length, 1);
if (decls.length === 1) {
  const init = decls[0].init;
  ok(BREAKER, '...as a ref, so it survives a render without causing one',
    !!init && init.type === 'CallExpression' && init.callee.type === 'Identifier' && init.callee.name === 'useRef',
    'line ' + lineOf(decls[0]));
  ok(BREAKER, '...starting from zero',
    !!init && init.arguments.length === 1 && init.arguments[0].type === 'NumericLiteral'
    && init.arguments[0].value === 0, 'line ' + lineOf(decls[0]));
}

eq(BREAKER, 'it is incremented in exactly one place -- the layout pass it counts',
  increments.length, 1, increments.map((n) => '       line ' + lineOf(n)).join(NL));

eq(BREAKER, 'it is compared against a ceiling in exactly one place', ceilings.length, 1,
  '       A breaker with no ceiling never trips; a breaker with two has two different limits.');
if (ceilings.length === 1) {
  const c = ceilings[0];
  ok(BREAKER, '...and the ceiling is a literal bound, not a computed one',
    c.right.type === 'NumericLiteral', 'line ' + lineOf(c));
  ok(BREAKER, '...and the bound is a real number of passes (1..64)',
    c.right.type === 'NumericLiteral' && c.right.value >= 1 && c.right.value <= 64,
    'the bound reads ' + (c.right.type === 'NumericLiteral' ? c.right.value : '<not a literal>')
    + ' at line ' + lineOf(c));
  console.log('       the breaker trips when pinPassRef.current ' + c.operator + ' '
    + (c.right.type === 'NumericLiteral' ? c.right.value : '?') + '  (line ' + lineOf(c) + ')');
}

// THE THREE RESETS. Each is a different answer to "this turn's budget starts again": the streamed
// answer grew, the turn settled, a new turn armed. Losing one leaves the breaker carrying a
// previous turn's count into a turn that asked for nothing -- which is exactly the defect item
// 102-ب closed. They are counted, because their line numbers move on every edit and their roles
// do not.
eq(BREAKER, 'it is reset to zero in exactly three places', resets.length, 3,
  resets.map((n) => '       reset at line ' + lineOf(n)).join(NL)
  + NL + '       The three are: the streamed answer grew, the turn settled, a new turn armed.'
  + NL + '       A missing reset carries one turn\'s spent budget into the next.');

eq(BREAKER, 'nothing writes the breaker in any other way', otherWrites.length, 0,
  otherWrites.map((n) => '       line ' + lineOf(n) + ' uses ' + n.operator).join(NL));

eq(BREAKER, 'six code sites in total, one per role',
  decls.length + increments.length + ceilings.length + resets.length, 6);

// The increment and the ceiling belong to one decision. Split across two functions they become a
// counter in one place and a limit in another, which is how a breaker stops tripping.
if (increments.length === 1 && ceilings.length === 1) {
  const parents = new Map();
  walk(ast, (n, p) => { parents.set(n, p); });
  const fnOf = (n) => {
    let cur = n;
    while (cur) {
      if (cur.type === 'FunctionDeclaration' || cur.type === 'FunctionExpression'
        || cur.type === 'ArrowFunctionExpression') return cur;
      cur = parents.get(cur);
    }
    return null;
  };
  ok(BREAKER, '...and the increment and the ceiling sit in the same function',
    fnOf(increments[0]) === fnOf(ceilings[0]),
    'increment line ' + lineOf(increments[0]) + ', ceiling line ' + lineOf(ceilings[0]));
}

/* =============================================================================================
 * D. ITEM 85 -- A SUBRESOURCE THAT FAILS TO LOAD DOES NOT COVER THE APP
 *
 * The catcher's listener is registered with capture:true and must stay that way: resource error
 * events do not bubble, so the capture phase is the only phase in which window can see a <link>,
 * <img>, <script> or <audio> that failed to load. That is correct. What was wrong is that
 * report() then built the full-viewport panel for EVERY event it was handed.
 *
 * MEASURED, on the tree this gate guards. With fonts.googleapis.com blocked the app rendered,
 * the composer took a typed word, __ezikDiag held one entry -- and a black English-language
 * EZIK DIAGNOSTIC panel reading "MESSAGE / Unknown error" was over the whole thing:
 * document.elementFromPoint at the centre of a 390x844 viewport returned the panel, not the
 * chat. It does not even name the resource, because a resource error carries no message. The
 * mushaf's own text fallback was covered the same way when its scan origin was blocked.
 *
 * SO THIS IS WHAT MAKES A FALLBACK REAL. Three external origins remain in this page and each is
 * defended by a fallback that was correct all along and could not be seen. A path that cannot be
 * reached is not a fallback, and an origin whose fallback cannot be reached is a hard dependency
 * however carefully it was written.
 *
 * BOTH HALVES ARE ASSERTED, and the second is the one that matters: the catcher's own source is
 * EXECUTED and driven with events. A structural check alone would pass on a branch that was
 * written and never reached.
 *
 * WHY THE EVENTS ARE DELIVERED THROUGH A BUS OF OUR OWN. linkedom does not implement capture
 * propagation to window, and it overwrites event.target on dispatch -- measured: a resource
 * error dispatched at the element never reaches a window capture listener, and one dispatched at
 * window arrives with target undefined. So the two DOM facts a browser would supply, and only
 * those, are supplied here: the listener the catcher itself registers is called, with an event
 * whose target is what a browser sets it to. Everything else -- read(), isResourceError(),
 * report(), formatEntry(), buildPanel(), the entry store -- is the shipped source running
 * against a real linkedom document, and the panel is counted in that document's DOM.
 * =========================================================================================== */
head('D. ITEM 85 -- A DEAD SUBRESOURCE IS RECORDED, NOT DRAWN OVER THE APP');
const PANEL = 'PANEL';
{
  const vm = require('vm');
  const { parseHTML } = require('linkedom');

  const cut = /<script id="ezik-diagnostic-catcher">([\s\S]*?)<\/script>/.exec(html);
  const SRC = cut ? cut[1] : '';
  const alive = ok(PANEL, 'the catcher source can be cut out of the document', SRC.length > 0,
    'no <script id="ezik-diagnostic-catcher"> body -- every check below would have read nothing,'
    + NL + 'which is exactly the vacuous pass this suite refuses. Fix the anchor, not the check.');

  // STRUCTURE, briefly: the branch exists, it is consulted by report(), and the registration is
  // still a capture registration. The behaviour below is what actually proves it works.
  ok(PANEL, 'the error listener is still registered in the CAPTURE phase',
    alive && /addEventListener\('error',[\s\S]{0,120}?\},\s*true\);/.test(SRC),
    'without capture:true the catcher stops seeing resource failures at all, and it would stop'
    + NL + 'recording them -- which is the opposite of what item 85 asked for.');
  ok(PANEL, 'report() decides on the event, not on nothing',
    alive && /var resource = !rejection && isResourceError\(event\);/.test(SRC)
      && /if \(!panel && !resource\) buildPanel\(\);/.test(SRC));

  // THE DRIVE.
  function drive(kind) {
    const d = parseHTML('<!doctype html><html><body></body></html>').document;
    const bus = [];
    // A PLAIN SANDBOX, NOT linkedom's window object. linkedom returns a Proxy for window whose
    // setter refuses a plain assignment (measured: "Cannot set properties of undefined"), so the
    // global the catcher runs against is built here and given the one DOM it needs -- the real
    // linkedom document, in which the panel is then counted.
    const w = { document: d, navigator: { userAgent: 'guard' }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 };
    w.window = w;
    vm.createContext(w);
    // The catcher registers on window; this is the registration it gets. Only 'error' and
    // 'unhandledrejection' are collected, which is all it registers.
    w.addEventListener = function (type, fn) { bus.push({ type: type, fn: fn }); };
    vm.runInContext(SRC, w);

    let ev;
    if (kind === 'thrown') {
      // What a browser hands a window 'error' listener for a script error: target IS window,
      // and there is a message, a filename and an Error with a stack.
      ev = { target: w, message: 'ReferenceError: React is not defined', filename: 'app.js',
        lineno: 42, colno: 7, error: new Error('React is not defined') };
    } else if (kind === 'rejection') {
      ev = { target: w, reason: new Error('the model call was rejected') };
    } else {
      // What a browser hands a CAPTURE listener for a resource that failed to load: target is
      // the element, and there is no message of any kind.
      const el = d.createElement(kind);
      d.body.appendChild(el);
      ev = { target: el };
    }
    const type = kind === 'rejection' ? 'unhandledrejection' : 'error';
    bus.filter((h) => h.type === type).forEach((h) => h.fn(ev));
    return {
      w: w,
      panels: d.querySelectorAll('[role="alert"]').length,
      recorded: (function () { try { return w.__ezikDiag.count(); } catch (e) { return -1; } }()),
      text: (function () { try { return w.__ezikDiag.text(); } catch (e) { return ''; } }()),
    };
  }

  // 1. EVERY RESOURCE TYPE THE PAGE CAN LOAD. link is the stylesheet this order deleted, script
  // is the .docx reader on cdnjs, img is the printed mushaf page on our own domain, audio is the
  // recitation on everyayah. Each of the four has a working fallback beneath it, and each of the
  // four used to be a black screen.
  for (const tag of ['link', 'script', 'img', 'audio']) {
    if (!alive) { ok(PANEL, 'a failed <' + tag + '> builds no panel', false, 'no source'); continue; }
    const r = drive(tag);
    eq(PANEL, 'a failed <' + tag + '> builds NO panel over the app', r.panels, 0,
      'a resource with a working fallback under it must not replace the app with a diagnostic');
    eq(PANEL, '...and is still RECORDED in __ezikDiag', r.recorded, 1,
      'nothing stops being collected -- only the drawing changed');
  }

  // 2. WHAT THE CATCHER EXISTS FOR STILL OPENS IT. A thrown error is the SRI case as well: a
  // vendor bundle that fails its integrity check leaves app.js throwing ReferenceError on the
  // global it needed, and that throw is a script error with a message and a stack.
  if (alive) {
    const t = drive('thrown');
    eq(PANEL, 'a THROWN script error still opens the panel', t.panels, 1,
      'the catcher is the only witness the page has before React exists; this is its job');
    eq(PANEL, '...and is recorded with it', t.recorded, 1);
    ok(PANEL, '...and the panel names the error rather than "Unknown error"',
      t.text.indexOf('React is not defined') !== -1, t.text.slice(0, 200));
    const j = drive('rejection');
    eq(PANEL, 'an unhandled rejection still opens the panel', j.panels, 1);
  }

  // 3. THE TWO KINDS COMPOSE. A thrown error opens the panel; a resource failure after it is
  // appended to what the panel already shows rather than being dropped. This is the assertion
  // that would fail if the resource branch had been written as an early `return` instead.
  if (alive) {
    const d = parseHTML('<!doctype html><html><body></body></html>').document;
    const bus = [];
    const w = { document: d, navigator: { userAgent: 'guard' }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 };
    w.window = w;
    vm.createContext(w);
    w.addEventListener = function (type, fn) { bus.push({ type: type, fn: fn }); };
    vm.runInContext(SRC, w);
    const fire = (ev) => bus.filter((h) => h.type === 'error').forEach((h) => h.fn(ev));
    fire({ target: w, message: 'SyntaxError: Unexpected token', filename: 'app.js', lineno: 1, colno: 1,
      error: new Error('Unexpected token') });
    const el = d.createElement('link'); d.body.appendChild(el);
    fire({ target: el });
    eq(PANEL, 'a resource failure AFTER a real error is still collected, not dropped',
      (function () { try { return w.__ezikDiag.count(); } catch (e) { return -1; } }()), 2);
    eq(PANEL, '...and the panel that was already open is still the only one',
      d.querySelectorAll('[role="alert"]').length, 1);
  }
}

/* =========================================================================================== */
console.log(NL + (fail === 0 ? 'PASS  ' : 'FAIL  ') + pass + ' checks passed, ' + fail + ' failed.');
if (fail) {
  const subjects = Array.from(new Set(failures.map((f) => f.slice(1, f.indexOf(']')))));
  console.log('the subject that fell: ' + subjects.join(' + '));
  failures.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
process.exit(0);
