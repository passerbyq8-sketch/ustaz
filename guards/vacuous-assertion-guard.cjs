// vacuous-assertion-guard.cjs — the pattern behind items 106 and 106-ب, made impossible to
// re-introduce quietly.
//
// ---------------------------------------------------------------------------------------------
// THE DEFECT, IN ONE SENTENCE. A region is cut out of a source at a literal anchor; the anchor
// moves; the cut returns an EMPTY STRING instead of throwing; and the empty string is then handed
// to a NEGATIVE assertion — `!re.test(region)`, `region.indexOf(x) === -1`,
// `(region.match(/x/g) || []).length === 0`. Every one of those is SATISFIED by emptiness. The
// assertion prints PASS at its loudest at the exact moment it stopped reading anything.
//
// WHAT ALREADY HAPPENED. Item 106 swept 143 .cjs files by hand and found eight infected sites in
// three guards; one of them (lock-package B8) was the only check standing between the browser and
// a re-introduced parent-code verifier, and it would have gone green the moment a function was
// renamed. Item 106-ب then found 64 more in a single file. Both were repaired IN PLACE, one site
// at a time, and nothing in the tree stopped the ninth from being written the next morning.
//
// SO THIS IS THE GENERAL CASE. It parses every .cjs file in the repository with Babel and fails on
// any (emptyable extraction × negative assertion) pair that is not protected and is not in the
// named exception list below. Every exception carries its reason in this file, beside the entry.
//
// WHY BABEL AND NOT A REGULAR EXPRESSION. Item 106 tried regular expressions twice and mis-measured
// twice. Its own commit message records why: `=== -1` and `!test` were the two shapes the first
// sweep was written around, and `(layer.match(/navigator/g) || []).length === 0` — a negative check
// wearing a COUNT — walked straight past both. A sweep written around operators cannot see that a
// count-against-zero is an absence check. The tree is the authority on its own shapes, so the tree
// is parsed.
//
// ---------------------------------------------------------------------------------------------
// THREE MEASURED REFINEMENTS, each of which removes a whole class of false positive. None of them
// is a guess; each is either a measurement recorded by item 106 or a measurement re-taken here.
//
//   1. ONLY THE START ANCHOR IS DANGEROUS. `s.slice(a.indexOf(X), b)` returns '' when X is gone.
//      `s.slice(a, b.indexOf(Y))` becomes `s.slice(a, -1)` — which holds almost the WHOLE source,
//      so no negative check over it is vacuous. Item 106 measured exactly this: "Two further
//      mutants moved an END anchor instead and failed in both columns". So an extraction counts as
//      emptyable only when its FIRST argument derives from a locator.
//
//   2. ONLY AN ASSERTION'S CONDITION IS DANGEROUS. `if (!/telemetryWritten/.test(src))
//      problems.push(...)` has the OPPOSITE polarity: an empty src makes the negative test true,
//      which RECORDS a problem and makes the guard fail. Emptiness there is loud, not silent. The
//      defect needs a context where true means PASS, so a pair is only reported when the negative
//      check sits inside the condition argument of a named assertion helper (ASSERTERS below).
//
//   3. A SIBLING ASSERTION IS NOT PROTECTION. Item 106-ب's own fix note is explicit: each repaired
//      assertion carries `region.length > 0 &&` "so the assertion ITSELF falls rather than merely
//      its neighbour". A `ok('...was LOCATED', region.length > 500)` one line above turns one
//      failure into one failure — the three assertions under it still print PASS while reading
//      nothing. So protection must be inside the assertion's own condition, or delivered by an
//      anchor-preconditioned helper (okOn/eqOn) that consults the region before the condition.
//
//   4. A POSITIVE CONJUNCT IS PROTECTION, AND IT IS THE COMMON ONE. `ok(n, /inset-inline/.test(css)
//      && !/left|right/.test(css))` cannot pass on an empty css: the FIRST conjunct fails. Four of
//      the ten sites this file reported on its first run over the tree were exactly that shape, in
//      four different guards, and calling them defects would have taught the next reader to bolt a
//      redundant `.length > 0` onto an assertion that already falls. A conjunct that READS the
//      binding positively — `re.test(b)`, `b.includes(x)`, `b.indexOf(x) !== -1` — is counted as
//      protection, and only for the binding it actually reads.
// ---------------------------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '..');
const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (detail ? NL + '       ' + detail : '')); }
  return !!cond;
}
function eq(name, actual, expected) {
  return ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    'actual   ' + JSON.stringify(actual) + NL + '       expected ' + JSON.stringify(expected));
}
function head(t) { console.log(NL + '=== ' + t + ' ==='); }

/* =============================================================================================
 * SCOPE
 * =========================================================================================== */

// Merge round 23 closed the temporary parallel-screen exclusion after both owned guards landed.
// theme-coverage-guard.cjs and tools/wird-guard.cjs now belong to the ordinary corpus below; the
// sweep must parse and judge them on every run just like every other .cjs file in the tree.

// Named exceptions: a pair this guard reports, adjudicated and permitted, each with its reason.
// Keyed 'path:line:binding'. An exception that no longer matches anything is itself a failure --
// a stale exception is how a suppression outlives the thing it suppressed.
const EXCEPTIONS = Object.create(null);

/* =============================================================================================
 * THE ANALYSER
 * =========================================================================================== */

const CUTTERS = new Set(['slice', 'substring', 'substr']);
const LOCATORS = new Set(['indexOf', 'lastIndexOf', 'search']);
// Helpers whose FIRST argument is a name and whose remaining arguments carry the condition. A
// negative check anywhere inside one of these is a check whose truth prints PASS.
const ASSERTERS = new Set(['ok', 'eq', 'okOn', 'eqOn', 'assert', 'pass', 'check', 'is', 'must']);
// Helpers that consult the region BEFORE the condition and fail on a lost anchor by themselves.
const ANCHOR_HELPERS = new Set(['okOn', 'eqOn']);

function walk(node, fn, parent) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
    const v = node[k];
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c.type === 'string') walk(c, fn, node);
    } else if (v && typeof v.type === 'string') walk(v, fn, node);
  }
}
function contains(node, pred) { let hit = false; walk(node, (n) => { if (!hit && pred(n)) hit = true; }); return hit; }

const isName = (n, name) => !!n && n.type === 'Identifier' && n.name === name;
const isEmptyStr = (n) => !!n && n.type === 'StringLiteral' && n.value === '';
const isLocatorCall = (n) => n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
  && !n.callee.computed && n.callee.property.type === 'Identifier' && LOCATORS.has(n.callee.property.name);

// REFINEMENT 1 lives here: only the FIRST argument of a cut is consulted.
function emptyableKind(init) {
  if (!init) return null;
  if (init.type === 'CallExpression' && init.callee.type === 'MemberExpression'
    && !init.callee.computed && init.callee.property.type === 'Identifier'
    && CUTTERS.has(init.callee.property.name) && init.arguments.length >= 1
    && contains(init.arguments[0], isLocatorCall)) {
    return init.arguments.length === 1 ? 'one-arg-cut' : 'anchored-cut';
  }
  if (init.type === 'ConditionalExpression' && (isEmptyStr(init.consequent) || isEmptyStr(init.alternate))) {
    return 'conditional-empty';
  }
  if (init.type === 'MemberExpression' && init.computed
    && init.property.type === 'NumericLiteral' && init.property.value === 0
    && init.object.type === 'LogicalExpression' && init.object.operator === '||'
    && init.object.right.type === 'ArrayExpression' && init.object.right.elements.length === 1
    && isEmptyStr(init.object.right.elements[0])) {
    return 'match-or-empty';
  }
  if (init.type === 'LogicalExpression' && init.operator === '||' && isEmptyStr(init.right)) return 'or-empty';
  return null;
}

// The four shapes. `!re.test(x)` and `x.indexOf(y) === -1` are the two item 106 was written
// around; `(x.match(/y/g) || []).length === 0` is the count-shaped one it nearly missed;
// `!x.includes(y)` is the plain-membership one.
function negativeCheckOn(node, name) {
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const a = node.argument;
    if (a.type === 'CallExpression' && a.callee.type === 'MemberExpression'
      && !a.callee.computed && a.callee.property.type === 'Identifier') {
      const p = a.callee.property.name;
      if (p === 'test' && a.arguments.some((x) => isName(x, name))) return '!re.test(' + name + ')';
      if (['includes', 'match', 'some', 'startsWith', 'endsWith'].indexOf(p) !== -1 && isName(a.callee.object, name)) {
        return '!' + name + '.' + p + '(..)';
      }
    }
  }
  if (node.type === 'BinaryExpression' && (node.operator === '===' || node.operator === '==')) {
    const minusOne = (n) => n.type === 'UnaryExpression' && n.operator === '-'
      && n.argument.type === 'NumericLiteral' && n.argument.value === 1;
    const zero = (n) => n.type === 'NumericLiteral' && n.value === 0;
    const locOn = (n) => n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
      && !n.callee.computed && n.callee.property.type === 'Identifier'
      && LOCATORS.has(n.callee.property.name) && isName(n.callee.object, name);
    const countOfMatch = (n) => n.type === 'MemberExpression' && !n.computed
      && n.property.type === 'Identifier' && n.property.name === 'length'
      && contains(n.object, (x) => x.type === 'CallExpression' && x.callee.type === 'MemberExpression'
        && !x.callee.computed && x.callee.property.type === 'Identifier'
        && x.callee.property.name === 'match' && isName(x.callee.object, name));
    const L = node.left;
    const R = node.right;
    if (locOn(L) && minusOne(R)) return name + '.indexOf(..) === -1';
    if (locOn(R) && minusOne(L)) return '-1 === ' + name + '.indexOf(..)';
    if (countOfMatch(L) && zero(R)) return '(' + name + '.match(..)||[]).length === 0';
    if (countOfMatch(R) && zero(L)) return '0 === (' + name + '.match(..)||[]).length';
  }
  return null;
}

// THE COUNT SHAPE, WHEN THE COMPARISON BELONGS TO THE HELPER. `eq(label, (r.match(/x/g) || [])
// .length, 0)` is the same absence check as `ok(label, (r.match(/x/g) || []).length === 0)` -- an
// empty region names x zero times too -- but there is no `=== 0` operator anywhere in the source
// for an operator-shaped sweep to find. It is item 106's third shape wearing the helper's
// signature, and the first version of THIS file missed it: mutant M2 survived. So the measurement
// is recognised on its own, and its expected value is read from the assertion's argument list.
// `eq(label, count, 3)` is untouched -- an empty region gives 0, which fails it.
function measurementOn(node, name) {
  if (node.type === 'MemberExpression' && !node.computed
    && node.property.type === 'Identifier' && node.property.name === 'length'
    && contains(node.object, (x) => x.type === 'CallExpression' && x.callee.type === 'MemberExpression'
      && !x.callee.computed && x.callee.property.type === 'Identifier'
      && x.callee.property.name === 'match' && isName(x.callee.object, name))) {
    return { kind: 'count', vacuousWhenExpected: 0, text: '(' + name + '.match(..)||[]).length' };
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && !node.callee.computed && node.callee.property.type === 'Identifier'
    && LOCATORS.has(node.callee.property.name) && isName(node.callee.object, name)) {
    return { kind: 'locator', vacuousWhenExpected: -1, text: name + '.indexOf(..)' };
  }
  return null;
}
const literalValue = (n) => {
  if (!n) return undefined;
  if (n.type === 'NumericLiteral') return n.value;
  if (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'NumericLiteral') return -n.argument.value;
  return undefined;
};

// A length precondition, tested on a node DIRECTLY -- never by searching a subtree. Searching a
// subtree is how a sweep convinces itself that `a.indexOf(x) === -1 && a.indexOf(y) === -1` is
// protected: the second conjunct merely MENTIONS the binding.
function isLengthPrecondition(node, name) {
  if (!node) return false;
  const lenOf = (n) => !!n && n.type === 'MemberExpression' && !n.computed
    && n.property.type === 'Identifier' && n.property.name === 'length' && isName(n.object, name);
  if (node.type === 'BinaryExpression' && ['>', '>=', '!==', '!='].indexOf(node.operator) !== -1
    && node.right.type === 'NumericLiteral') {
    if (node.operator === '>' && lenOf(node.left) && node.right.value >= 0) return true;
    if (node.operator === '>=' && lenOf(node.left) && node.right.value >= 1) return true;
    if ((node.operator === '!==' || node.operator === '!=') && lenOf(node.left) && node.right.value === 0) return true;
  }
  if (lenOf(node)) return true;                       // `region.length && ...`
  if (isName(node, name)) return true;                // `region && ...`  (truthiness on a string)
  if (node.type === 'UnaryExpression' && node.operator === '!'
    && node.argument.type === 'UnaryExpression' && node.argument.operator === '!'
    && isName(node.argument.argument, name)) return true;   // `!!region && ...`
  return isPositiveReadOf(node, name);                      // REFINEMENT 4
}

// REFINEMENT 4. A conjunct that reads the binding POSITIVELY. An empty string fails it, so the
// assertion it sits in falls on a lost anchor without any length precondition being written.
function isPositiveReadOf(node, name) {
  if (!node) return false;
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && !node.callee.computed && node.callee.property.type === 'Identifier') {
    const p = node.callee.property.name;
    if (p === 'test' && node.arguments.some((x) => isName(x, name))) return true;
    if (['includes', 'startsWith', 'endsWith', 'match'].indexOf(p) !== -1 && isName(node.callee.object, name)) return true;
  }
  if (node.type === 'BinaryExpression') {
    const locOn = (n) => !!n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
      && !n.callee.computed && n.callee.property.type === 'Identifier'
      && LOCATORS.has(n.callee.property.name) && isName(n.callee.object, name);
    const minusOne = (n) => n.type === 'UnaryExpression' && n.operator === '-'
      && n.argument.type === 'NumericLiteral' && n.argument.value === 1;
    if (locOn(node.left)) {
      if ((node.operator === '!==' || node.operator === '!=') && minusOne(node.right)) return true;
      if (node.operator === '>' && minusOne(node.right)) return true;
      if (node.operator === '>=' && node.right.type === 'NumericLiteral' && node.right.value >= 0) return true;
    }
  }
  return false;
}

// Flatten one `&&` spine into its direct operands.
function conjuncts(node, out) {
  out = out || [];
  if (node && node.type === 'LogicalExpression' && node.operator === '&&') {
    conjuncts(node.left, out);
    conjuncts(node.right, out);
  } else out.push(node);
  return out;
}

function analyse(relPath, src) {
  const ast = parser.parse(src, { sourceType: 'unambiguous', allowReturnOutsideFunction: true });

  const emptyable = new Map();
  walk(ast, (n) => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
      const kind = emptyableKind(n.init);
      if (kind) emptyable.set(n.id.name, { kind, line: n.loc.start.line });
    }
  });

  const parents = new Map();
  walk(ast, (n, p) => { parents.set(n, p); });

  const pairs = [];
  if (!emptyable.size) return pairs;
  walk(ast, (n) => {
    emptyable.forEach((meta, name) => {
      const direct = negativeCheckOn(n, name);
      const measure = direct ? null : measurementOn(n, name);
      let shape = direct;
      if (!direct && !measure) return;

      // REFINEMENT 2: is this inside the condition of an assertion?
      let asserter = null;
      let anchorHelper = false;
      let argIndex = -1;
      // REFINEMENT 3 + protection: walk up, collecting sibling conjuncts and conditional tests.
      let protectedBy = null;
      let cur = n;
      let up = parents.get(n);
      let depth = 0;
      while (up && depth++ < 24) {
        if (!protectedBy && up.type === 'LogicalExpression' && up.operator === '&&') {
          const other = up.left === cur ? up.right : up.left;
          if (conjuncts(other).some((c) => isLengthPrecondition(c, name))) protectedBy = 'length-precondition';
        }
        if (!protectedBy && up.type === 'ConditionalExpression' && up.test !== cur
          && conjuncts(up.test).some((c) => isLengthPrecondition(c, name))) {
          protectedBy = 'conditional-precondition';
        }
        if (up.type === 'IfStatement' && up.test !== cur
          && conjuncts(up.test).some((c) => isLengthPrecondition(c, name))) {
          if (!protectedBy) protectedBy = 'if-precondition';
        }
        if (up.type === 'CallExpression' && up.callee.type === 'Identifier' && ASSERTERS.has(up.callee.name)) {
          asserter = up.callee.name;
          argIndex = up.arguments.indexOf(cur);
          if (ANCHOR_HELPERS.has(up.callee.name)
            && up.arguments.some((a) => contains(a, (x) => isName(x, name)))) anchorHelper = true;
          if (measure) {
            const expected = literalValue(up.arguments[argIndex + 1]);
            if (!/^eq/.test(asserter) || argIndex === -1 || expected !== measure.vacuousWhenExpected) asserter = null;
            else shape = asserter + '(.., ' + measure.text + ', ' + expected + ')';
          }
          break;
        }
        if (up.type === 'CallExpression' && up.callee.type === 'MemberExpression'
          && !up.callee.computed && up.callee.property.type === 'Identifier'
          && ASSERTERS.has(up.callee.property.name)) {
          asserter = up.callee.property.name;
          argIndex = up.arguments.indexOf(cur);
          if (measure) {
            const expected = literalValue(up.arguments[argIndex + 1]);
            if (!/^eq/.test(asserter) || argIndex === -1 || expected !== measure.vacuousWhenExpected) asserter = null;
            else shape = asserter + '(.., ' + measure.text + ', ' + expected + ')';
          }
          break;
        }
        cur = up;
        up = parents.get(up);
      }
      if (!asserter) return;                       // polarity is not PASS-on-empty; not this defect
      if (anchorHelper) protectedBy = protectedBy || 'anchor-helper';

      pairs.push({
        file: relPath, line: n.loc.start.line, binding: name, shape,
        kind: meta.kind, declLine: meta.line, asserter, protectedBy: protectedBy || null,
      });
    });
  });
  return pairs;
}

/* =============================================================================================
 * A. THE ANALYSER IS TESTED BEFORE IT IS TRUSTED
 *
 * A sweep that finds nothing is indistinguishable from a clean tree, which is the very defect
 * this file exists to end. So the analyser is driven over synthetic sources whose answers are
 * known, and every refinement above is proven by a case that would fail without it.
 * =========================================================================================== */
head('A. THE ANALYSER, DRIVEN OVER KNOWN SOURCES');

function findingsOf(source) {
  return analyse('<fixture>', source).filter((p) => !p.protectedBy).map((p) => p.shape);
}
function allPairsOf(source) { return analyse('<fixture>', source); }

{
  const cut = 'const r = s.slice(s.indexOf("A"), s.indexOf("B"));';

  eq('the bare shape is caught: !re.test over an anchored cut',
    findingsOf(cut + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);
  eq('...and the membership shape: !region.includes',
    findingsOf(cut + NL + 'ok("x", !r.includes("z"));'), ['!r.includes(..)']);
  eq('...and the locator shape: region.indexOf(..) === -1',
    findingsOf(cut + NL + 'ok("x", r.indexOf("z") === -1);'), ['r.indexOf(..) === -1']);
  eq('...and the COUNT shape, which a sweep written around operators walks past',
    findingsOf(cut + NL + 'ok("x", (r.match(/z/g) || []).length === 0);'),
    ['(r.match(..)||[]).length === 0']);
  eq('...and the same count when the COMPARISON belongs to the helper, not to an operator',
    findingsOf(cut + NL + 'eq("x", (r.match(/z/g) || []).length, 0);'),
    ['eq(.., (r.match(..)||[]).length, 0)']);
  eq('...and the locator when the helper owns the -1',
    findingsOf(cut + NL + 'eq("x", r.indexOf("z"), -1);'), ['eq(.., r.indexOf(..), -1)']);
  eq('...but a count compared against a NON-zero expectation is not vacuous -- \'\' gives 0',
    findingsOf(cut + NL + 'eq("x", (r.match(/z/g) || []).length, 3);'), []);
  eq('...and the conditional repair item 106-ب wrote for that shape protects it',
    findingsOf(cut + NL + 'eq("x", r.length > 0 ? (r.match(/z/g) || []).length : -1, 0);'), []);

  eq('an inline length precondition protects the assertion',
    findingsOf(cut + NL + 'ok("x", r.length > 0 && !/z/.test(r));'), []);
  eq('...and so does the conditional form the count shape needs',
    findingsOf(cut + NL + 'eq("x", r.length > 0 ? (r.match(/z/g) || []).length : -1, 0);'), []);
  eq('...and so does an anchor-preconditioned helper',
    findingsOf(cut + NL + 'okOn("x", [["r", r]], !/z/.test(r));'), []);

  eq('REFINEMENT 3: a LOCATED assertion on the line above protects nothing',
    findingsOf(cut + NL + 'ok("located", r.length > 500);' + NL + 'ok("x", !/z/.test(r));'),
    ['!re.test(r)']);
  eq('...and a second negative conjunct that merely MENTIONS the binding protects nothing',
    findingsOf(cut + NL + 'ok("x", r.indexOf("y") === -1 && r.indexOf("z") === -1);'),
    ['r.indexOf(..) === -1', 'r.indexOf(..) === -1']);

  eq('REFINEMENT 1: an END-only anchor is not emptyable -- slice(start, -1) holds the source',
    findingsOf('const r = s.slice(0, s.indexOf("B"));' + NL + 'ok("x", !/z/.test(r));'), []);
  eq('...but a START anchor is, in the two-argument form',
    findingsOf('const r = s.slice(s.indexOf("A"), 10);' + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);
  eq('...and in the one-argument form item 106 found last',
    findingsOf('const r = s.slice(s.indexOf("A"));' + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);

  eq('REFINEMENT 2: an if/push has the opposite polarity and is not this defect',
    findingsOf(cut + NL + 'if (!/z/.test(r)) problems.push("missing");'), []);
  eq('...while the same expression inside an assertion is',
    findingsOf(cut + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);

  eq('the deliberate empty branch is still emptyable -- it is the fix half nobody wrote',
    findingsOf('const r = a === -1 ? "" : s.slice(a);' + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);
  eq('...as is a match that falls back to an empty string',
    findingsOf('const r = (s.match(/x/) || [""])[0];' + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);
  eq('...and a plain || "" fallback',
    findingsOf('const r = MAP.get(k) || "";' + NL + 'ok("x", !/z/.test(r));'), ['!re.test(r)']);

  eq('a POSITIVE assertion over the same region is not reported -- emptiness fails it',
    findingsOf(cut + NL + 'ok("x", /z/.test(r));'), []);

  eq('REFINEMENT 4: a positive conjunct on the SAME binding protects the negative one beside it',
    findingsOf(cut + NL + 'ok("x", /y/.test(r) && !/z/.test(r));'), []);
  eq('...in the membership form too',
    findingsOf(cut + NL + 'ok("x", r.includes("y") && !r.includes("z"));'), []);
  eq('...and in the locator form',
    findingsOf(cut + NL + 'ok("x", r.indexOf("y") !== -1 && !/z/.test(r));'), []);
  eq('...but a positive conjunct on a DIFFERENT binding protects nothing',
    findingsOf(cut + NL + 'const q = s.slice(s.indexOf("C"));' + NL + 'ok("x", /y/.test(q) && !/z/.test(r));'),
    ['!re.test(r)']);
  eq('...and each branch of a conditional is judged on its own conjuncts',
    findingsOf(cut + NL + 'ok("x", flag ? r.includes("y") && !r.includes("z") : !r.includes("w"));'),
    ['!r.includes(..)']);
  eq('a binding that cannot go empty is not reported at all',
    allPairsOf('const r = s.slice(3, 9);' + NL + 'ok("x", !/z/.test(r));').length, 0);
}

/* =============================================================================================
 * B. THE SWEEP
 * =========================================================================================== */
head('B. THE SWEEP OVER EVERY .cjs FILE IN THE TREE');

function listCjs(dir, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listCjs(full, out);
    else if (entry.isFile() && entry.name.endsWith('.cjs')) out.push(path.relative(ROOT, full).split(BS).join('/'));
  }
  return out;
}

const corpus = listCjs(ROOT).sort();
// A sweep whose corpus collapsed would report a clean tree. That is this file's own defect, so the
// floor is asserted rather than assumed. 145 .cjs files were tracked when this was written.
ok('the sweep has a corpus to read (>= 140 .cjs files)', corpus.length >= 140, 'found ' + corpus.length);

ok('the merged theme and wird guards are both in the sweep',
  corpus.includes('theme-coverage-guard.cjs') && corpus.includes('tools/wird-guard.cjs'));

const scanned = [];
const parseFailures = [];
const reported = [];
const protectedPairs = [];
for (const rel of corpus) {
  let pairs;
  try { pairs = analyse(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch (e) { parseFailures.push(rel + ' :: ' + e.message); continue; }
  scanned.push(rel);
  for (const p of pairs) (p.protectedBy ? protectedPairs : reported).push(p);
}

ok('every file in scope parsed -- an unparsed file is an unswept file', parseFailures.length === 0,
  parseFailures.join(NL + '       '));
console.log('  ---- swept ' + scanned.length + ' files; '
  + (reported.length + protectedPairs.length) + ' (emptyable region x negative assertion) pairs, '
  + protectedPairs.length + ' of them protected');

const unexcused = [];
const usedExceptions = new Set();
for (const p of reported) {
  const key = p.file + ':' + p.line + ':' + p.binding;
  if (Object.prototype.hasOwnProperty.call(EXCEPTIONS, key)) { usedExceptions.add(key); continue; }
  unexcused.push(p);
}

for (const p of unexcused) {
  console.log('  FAIL VACUOUS ASSERTION  ' + p.file + ':' + p.line);
  console.log('       ' + p.asserter + '(...) asserts ' + p.shape);
  console.log('       `' + p.binding + '` is an ' + p.kind + ' declared at ' + p.file + ':' + p.declLine
    + ', so it is \'\' whenever its anchor moves,');
  console.log('       and \'\' satisfies that check. Add `' + p.binding + '.length > 0 && ` to THIS'
    + ' assertion (not to a neighbour),');
  console.log('       or list ' + p.file + ':' + p.line + ':' + p.binding + ' in EXCEPTIONS with a reason.');
}
if (unexcused.length) { fail++; failures.push('vacuous assertions: ' + unexcused.length); }
else { pass++; console.log('  PASS no unexcused vacuous assertion in ' + scanned.length + ' files'); }

const staleExceptions = Object.keys(EXCEPTIONS).filter((k) => !usedExceptions.has(k));
ok('no exception outlives the thing it excuses', staleExceptions.length === 0, staleExceptions.join(', '));

/* =============================================================================================
 * C. MERGE CLOSURE
 * =========================================================================================== */
head('C. MERGE CLOSURE');
console.log('  CLOSED. theme-coverage-guard.cjs and tools/wird-guard.cjs are in the ordinary sweep.');

console.log(NL + (fail === 0 ? 'PASS  ' : 'FAIL  ') + pass + ' checks passed, ' + fail + ' failed.');
if (fail) { console.log('failing: ' + failures.join(' | ')); process.exit(1); }
process.exit(0);
