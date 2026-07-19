#!/usr/bin/env node
'use strict';
// classifier-guard.cjs  --  GATE 9 (AST edition): DEEN/GEN fast-channel classifier.
//
// The classifier is fail-CLOSED and sound; this guard FREEZES that on the PARSED
// TREE of index.html's text/babel block -- NOT on substrings. A safety phrase that
// slips into a comment, or a fail-open 'GEN' return added anywhere, is now caught
// because the tree (not the raw text) is judged. Substring matching could not tell
// live code from a comment; the AST can.
//
// Ten invariants -- same ids/messages as before (mechanism changed, constants kept):
//   C2 failclosed-empty      [A1]  every StringLiteral return in __classifyFast is 'DEEN'
//   C2 failclosed-network    [A1b] the network-failure ('||') guard returns 'DEEN'
//   C2 failclosed-only-GEN   [A2]  exactly ONE 'GEN' producer: a conditional whose test compares to 'GEN'
//   C2 failclosed-exception  [A3]  the catch clause returns 'DEEN'
//   C3 gen-gated-to-call     [A5]  mode === 'call' && (await __classifyFast()) is a LIVE && guard
//   C1 classifier-identity   [A4]  Arabic safety needle lives inside a StringLiteral/Template (NOT a comment)
//   C1 doubt-to-DEEN         [A4]
//   C1 feelings-safety-to-DEEN [A4]
//   C4 gen-defers-religious  [A4]
//   C4 gen-defers-safety     [A4]
//
// Arabic needles are string literals, copied byte-for-byte, and NEVER printed.
// Harakat + tatweel stripped both sides so rewording/vowels do not false-fail.
// Exit 0 = all pass | 1 = drift / missing invariant | 2 = could not run (structural).
//
// Usage:  node classifier-guard.cjs [indexFile]     (default: index.html in cwd)

const fs = require('fs');
const parser = require('@babel/parser');

const indexFile = (process.argv[2] && !process.argv[2].startsWith('-')) ? process.argv[2] : 'index.html';

let P = 0, F = 0;
const FAILS = [];
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; FAILS.push(m); console.log('  [FAIL] ' + m); };
const info = (m) => console.log('  [INFO] ' + m);
const strip = (s) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g, '');

console.log('classifier-guard: gate 9 (DEEN/GEN fast-channel classifier) [AST]');

const src = (() => { try { return fs.readFileSync(indexFile, 'utf8'); } catch (e) { return null; } })();
if (src === null) { console.error('ABORT: cannot read ' + indexFile); process.exit(2); }

// ---- extract the text/babel block ----
const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const om = openRe.exec(src);
if (!om) { console.error('ABORT: no text/babel script block in ' + indexFile); process.exit(2); }
const startBody = om.index + om[0].length;
const closeIdx = src.indexOf('</script>', startBody);
if (closeIdx === -1) { console.error('ABORT: unterminated text/babel block'); process.exit(2); }
const block = src.slice(startBody, closeIdx);

// ---- parse to a tree (jsx enabled) ----
let ast;
try {
  ast = parser.parse(block, { sourceType: 'script', plugins: ['jsx'], ranges: true, attachComment: true });
} catch (e) {
  console.error('ABORT: cannot parse text/babel block: ' + e.message);
  process.exit(2);
}

// ---- walkers ----
const KEYS_SKIP = new Set(['loc', 'range', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens', 'extra']);
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const k in node) {
    if (KEYS_SKIP.has(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) walk(c, visit); }
    else if (v && typeof v.type === 'string') walk(v, visit);
  }
}
const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod']);
function scopedWalk(root, visit) {
  // visit descendants of root WITHOUT entering nested function bodies
  (function rec(node, isRoot) {
    if (!node || typeof node.type !== 'string') return;
    if (!isRoot && FN_TYPES.has(node.type)) return;
    visit(node);
    for (const k in node) {
      if (KEYS_SKIP.has(k)) continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) rec(c, false); }
      else if (v && typeof v.type === 'string') rec(v, false);
    }
  })(root, true);
}

// ---- locate __classifyFast declarator ----
let cf = null;
walk(ast.program, (n) => {
  if (!cf && n.type === 'VariableDeclarator' && n.id && n.id.name === '__classifyFast'
      && n.init && FN_TYPES.has(n.init.type)) cf = n.init;
});
if (!cf) { console.error('ABORT: __classifyFast declarator (arrow/function) not found in tree'); process.exit(2); }
const body = cf.body;
info(indexFile + ' __classifyFast located; body node ' + body.type);

const isStr = (n, v) => !!n && n.type === 'StringLiteral' && (v === undefined || n.value === v);

// gather scoped ReturnStatements (excluding nested fns)
const scopedReturns = [];
scopedWalk(body, (n) => { if (n.type === 'ReturnStatement') scopedReturns.push(n); });

// ---- A1 (C2 failclosed-empty): every StringLiteral return is 'DEEN' ----
{
  const strReturns = scopedReturns.filter(r => r.argument && r.argument.type === 'StringLiteral');
  const bad = strReturns.filter(r => r.argument.value !== 'DEEN');
  if (strReturns.length > 0 && bad.length === 0) pass("C2 failclosed-empty  [A1] every StringLiteral return is 'DEEN' (n=" + strReturns.length + ")");
  else if (strReturns.length === 0) fail("C2 failclosed-empty  [A1] no StringLiteral 'DEEN' return remains (fail-closed gone)");
  else fail("C2 failclosed-empty  [A1] a StringLiteral return is NOT 'DEEN' (fail-OPEN: " + bad.length + ")");
}

// ---- A1b (C2 failclosed-network): the '||' network guard returns 'DEEN' ----
{
  let ok = false;
  scopedWalk(body, (n) => {
    if (n.type === 'IfStatement' && n.test && n.test.type === 'LogicalExpression' && n.test.operator === '||') {
      const cons = n.consequent;
      const ret = (cons && cons.type === 'ReturnStatement') ? cons
        : (cons && cons.type === 'BlockStatement' ? cons.body.find(s => s.type === 'ReturnStatement') : null);
      if (ret && isStr(ret.argument, 'DEEN')) ok = true;
    }
  });
  if (ok) pass("C2 failclosed-network  [A1b] '||' failure guard returns 'DEEN'");
  else fail("C2 failclosed-network  [A1b] network-failure guard returning 'DEEN' is gone");
}

// ---- A2 (C2 failclosed-only-GEN): exactly ONE 'GEN' producer, a conditional testing 'GEN' ----
{
  let producers = 0, condOk = false;
  for (const r of scopedReturns) if (isStr(r.argument, 'GEN')) producers++;
  scopedWalk(body, (n) => {
    if (n.type === 'ConditionalExpression') {
      if (isStr(n.consequent, 'GEN')) producers++;
      if (isStr(n.alternate, 'GEN')) producers++;
      const t = n.test;
      const testHitsGen = t && t.type === 'BinaryExpression' && (t.operator === '===' || t.operator === '==')
        && (isStr(t.left, 'GEN') || isStr(t.right, 'GEN'));
      if (testHitsGen && isStr(n.consequent, 'GEN') && isStr(n.alternate, 'DEEN')) condOk = true;
    }
  });
  if (producers === 1 && condOk) pass("C2 failclosed-only-GEN  [A2] exactly one 'GEN' producer via a conditional testing 'GEN'");
  else fail("C2 failclosed-only-GEN  [A2] 'GEN' producers=" + producers + " condOk=" + condOk + " (fail-OPEN / leak)");
}

// ---- A3 (C2 failclosed-exception): catch clause returns 'DEEN' ----
{
  let ok = false;
  scopedWalk(body, (n) => {
    if (n.type === 'CatchClause') {
      scopedWalk(n.body, (m) => { if (m.type === 'ReturnStatement' && isStr(m.argument, 'DEEN')) ok = true; });
    }
  });
  if (ok) pass("C2 failclosed-exception  [A3] catch clause returns 'DEEN'");
  else fail("C2 failclosed-exception  [A3] catch no longer returns 'DEEN'");
}

// ---- A5 (C3 gen-gated-to-call): mode === 'call' && (await __classifyFast()) live in the tree ----
{
  const parent = new Map();
  walk(ast.program, (n) => {
    for (const k in n) {
      if (KEYS_SKIP.has(k)) continue;
      const v = n[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') parent.set(c, n); }
      else if (v && typeof v.type === 'string') parent.set(v, n);
    }
  });
  const isModeCall = (t) => t && t.type === 'BinaryExpression' && t.operator === '==='
    && t.left && t.left.type === 'Identifier' && t.left.name === 'mode' && isStr(t.right, 'call');
  const subtreeHasModeCall = (n) => { let f = false; walk(n, (m) => { if (isModeCall(m)) f = true; }); return f; };
  let awaitCall = null;
  walk(ast.program, (n) => {
    if (!awaitCall && n.type === 'AwaitExpression' && n.argument && n.argument.type === 'CallExpression'
        && n.argument.callee && n.argument.callee.type === 'Identifier' && n.argument.callee.name === '__classifyFast') awaitCall = n;
  });
  let gated = false;
  if (awaitCall) {
    let child = awaitCall, p = parent.get(child);
    while (p) {
      if (p.type === 'LogicalExpression' && p.operator === '&&') {
        let inRight = false; walk(p.right, (m) => { if (m === awaitCall) inRight = true; });
        if (inRight && subtreeHasModeCall(p.left)) { gated = true; break; }
      }
      child = p; p = parent.get(p);
    }
  }
  if (gated) pass("C3 gen-gated-to-call  [A5] mode === 'call' && (await __classifyFast()) is a live && guard");
  else fail("C3 gen-gated-to-call  [A5] call-gate expression gone or not live in the tree");
}

// ---- A4 (C1 x3, C4 x2): each Arabic needle lives inside a StringLiteral/Template (NOT a comment) ----
const AR = [
  ['C1 classifier-identity',        'مصنف مسارات'],
  ['C1 doubt-to-DEEN',              'أدنى شك'],
  ['C1 feelings-safety-to-DEEN',    'مشاعر الطفل'],
  ['C4 gen-defers-religious',       'تركه للمربي'],
  ['C4 gen-defers-safety',          'شخصا كبيرا'],
];
const strRaws = [], comRaws = [];
walk(ast.program, (n) => { if (n.type === 'StringLiteral' || n.type === 'TemplateElement') strRaws.push(block.slice(n.start, n.end)); });
for (const c of (ast.comments || [])) comRaws.push(block.slice(c.start, c.end));
const strBlob = strRaws.map(strip).join('');
const comBlob = comRaws.map(strip).join('');
for (const [id, needle] of AR) {
  const sn = strip(needle);
  const inStr = strBlob.includes(sn);
  const inCom = comBlob.includes(sn);
  if (inStr) pass(id + '  [A4] safety phrase lives in a StringLiteral/Template');
  else if (inCom) fail(id + '  [A4] safety phrase DEMOTED to a comment (dead) -- absent from every string');
  else fail(id + '  [A4] safety phrase gone from the tree');
}

// ---- summary ----
console.log('  SUMMARY   PASS=' + P + '   FAIL=' + F);
if (F > 0) {
  console.log('  -- FAILURES (classifier drift) --');
  FAILS.forEach((m) => console.log('    * ' + m));
  process.exit(1);
}
console.log('  OK: DEEN/GEN classifier safety scaffolding intact (AST-verified).');
process.exit(0);
