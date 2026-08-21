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

/* =========================================================================================== */
console.log(NL + (fail === 0 ? 'PASS  ' : 'FAIL  ') + pass + ' checks passed, ' + fail + ' failed.');
if (fail) {
  const subjects = Array.from(new Set(failures.map((f) => f.slice(1, f.indexOf(']')))));
  console.log('the subject that fell: ' + subjects.join(' + '));
  failures.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
process.exit(0);
