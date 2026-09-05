// guards/regex-dup-group-guard.cjs
// A NAMED CAPTURE GROUP MAY NOT APPEAR TWICE INSIDE ONE PATTERN — AND THE LOCAL
// ENGINE IS NOT ALLOWED TO BE THE JUDGE OF THAT.
//
// ── THE DEFECT THIS CLOSES, MEASURED ON a23369f (ع-٩٠) ──────────────────────
// The preview deployment of this branch answered `500` to every `/api/ask` call, and the
// function died at MODULE LOAD, before one line of it ran. Vercel's runtime log, verbatim:
//
//     SyntaxError: Invalid regular expression: /.../u: Duplicate capture group name
//         at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
//     Node.js process exited with exit status: 1.
//
// The cause was an ENGINE VERSION DIFFERENCE, not a logic error. ES2025 lets two named groups
// share a name when they sit in mutually exclusive alternatives; node 24 — the owner's local
// engine — implements that, and node 22 — the engine `package.json#engines` pins and the one
// the function actually runs on — throws. So `npm run gates` was 102/102 green on a tree whose
// deployed function could not be imported at all.
//
// ── WHY THIS GUARD COUNTS INSTEAD OF COMPILING ──────────────────────────────
// The obvious check — hand each pattern to `new RegExp` and see whether it throws — is exactly
// the check that CANNOT work here: on the machine that runs the gates, `new RegExp` ACCEPTS the
// thing that kills the server. A guard that asks the local engine would have been green on
// a23369f too. So this file never compiles anything. It reads the source text, finds every
// regex LITERAL, and counts the group names inside each one. The count is the same number on
// every engine that will ever run it.
//
// ── WHAT IT SCANS AND WHAT IT REFUSES ───────────────────────────────────────
// Every `.js`, `.cjs` and `.mjs` under `api/`, `lib/` and `guards/`, recursively. A name that
// appears twice inside ONE literal is a FAIL, printed with its file, its line and the name. The
// same name in two DIFFERENT literals is fine and is not reported — that is not what node 22
// refuses.
//
// Section A proves the reader itself: a scanner that silently stops finding regex literals is a
// guard that passes on everything, so it is exercised against synthetic sources — a duplicate it
// must catch, a lookbehind it must not mistake for a group name, and a duplicate written inside
// a string or a comment that it must not report. Section B is the tree.
//
// Usage: node guards/regex-dup-group-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const ROOTS = ['api', 'lib', 'guards'];
const EXTS = new Set(['.js', '.cjs', '.mjs']);

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}

// ── THE READER ─────────────────────────────────────────────────────────────
// A hand-written lexer, because the question "is this slash a regex or a division" cannot be
// answered by a regex. It tracks the four places a slash means nothing — line comment, block
// comment, string, template literal — and decides regex-vs-division from the last significant
// token, which is the same rule the language itself uses.
//
// `${...}` inside a template is real code and may hold a regex literal, so the context is a
// STACK, not a flag: a template pushes, a substitution pushes back into code, and the brace that
// closes the substitution pops.
const SLASH_STARTS_REGEX_AFTER = new Set(
  ['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>']);
const SLASH_STARTS_REGEX_AFTER_WORD = new Set(
  ['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'do', 'else',
    'yield', 'await', 'instanceof']);
const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

// Returns [{ line, body }] — one entry per regex literal, `body` being the source text between
// the delimiting slashes, exactly as written.
function regexLiterals(source) {
  const found = [];
  const stack = [{ template: false, brace: 0 }];
  let i = 0, line = 1;
  let prevChar = '';   // last significant character, or 'w'/'0' for a word/number
  let prevWord = '';

  const bump = (from, to) => { for (let k = from; k < to; k += 1) if (source[k] === '\n') line += 1; };

  while (i < source.length) {
    const top = stack[stack.length - 1];

    if (top.template) {
      // Inside a template literal: only the closing backtick and `${` matter.
      if (source[i] === '\\') { bump(i, i + 2); i += 2; continue; }
      if (source[i] === '`') { stack.pop(); prevChar = '"'; i += 1; continue; }
      if (source[i] === '$' && source[i + 1] === '{') {
        stack.push({ template: false, brace: 0 });
        prevChar = '{'; i += 2; continue;
      }
      if (source[i] === '\n') line += 1;
      i += 1; continue;
    }

    const c = source[i];

    if (c === '\n') { line += 1; i += 1; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i += 1; continue; }

    if (c === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      bump(i, stop); i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === c) { j += 1; break; }
        if (source[j] === '\n') break; // unterminated: give up on this string, not on the file
        j += 1;
      }
      bump(i, j); i = j; prevChar = '"';
      continue;
    }
    if (c === '`') { stack.push({ template: true, brace: 0 }); i += 1; continue; }

    if (c === '{') { top.brace += 1; prevChar = '{'; i += 1; continue; }
    if (c === '}') {
      if (top.brace === 0 && stack.length > 1) { stack.pop(); prevChar = '"'; i += 1; continue; }
      top.brace -= 1; prevChar = '}'; i += 1; continue;
    }

    if (IDENT_START.test(c)) {
      let j = i + 1;
      while (j < source.length && IDENT_PART.test(source[j])) j += 1;
      prevWord = source.slice(i, j); prevChar = 'w'; i = j;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < source.length && /[0-9a-fA-FxXoObBn_.]/.test(source[j])) j += 1;
      prevChar = '0'; i = j;
      continue;
    }

    if (c === '/') {
      const isRegex = prevChar === ''
        || SLASH_STARTS_REGEX_AFTER.has(prevChar)
        || (prevChar === 'w' && SLASH_STARTS_REGEX_AFTER_WORD.has(prevWord));
      if (!isRegex) { prevChar = '/'; i += 1; continue; }
      // Consume the literal. A raw newline cannot appear inside one, so an unterminated read
      // means this slash was not a regex after all and the scan resumes after it.
      let j = i + 1, inClass = false, closed = -1;
      while (j < source.length) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;
        if (inClass) { if (d === ']') inClass = false; j += 1; continue; }
        if (d === '[') { inClass = true; j += 1; continue; }
        if (d === '/') { closed = j; break; }
        j += 1;
      }
      if (closed < 0) { prevChar = '/'; i += 1; continue; }
      found.push({ line, body: source.slice(i + 1, closed) });
      let k = closed + 1;
      while (k < source.length && IDENT_PART.test(source[k])) k += 1; // flags
      i = k; prevChar = '"';
      continue;
    }

    prevChar = c; i += 1;
  }
  return found;
}

// Every named group DEFINED in one pattern body, in source order. `(?<=` and `(?<!` are
// lookbehinds and are not definitions; `\k<name>` is a backreference and is not one either.
// Escapes and character classes are honoured so that `\(?<x>` and `[(?<x>]` count as nothing.
function definedGroupNames(body) {
  const names = [];
  let inClass = false;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '\\') { i += 1; continue; }
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') { inClass = true; continue; }
    if (c !== '(' || body[i + 1] !== '?' || body[i + 2] !== '<') continue;
    const after = body[i + 3];
    if (after === '=' || after === '!') continue;               // lookbehind
    const close = body.indexOf('>', i + 3);
    if (close < 0) continue;
    names.push(body.slice(i + 3, close));
    i = close;
  }
  return names;
}

// The whole verdict for one file, as data: [{ line, name, count }].
function duplicatesIn(source) {
  const out = [];
  for (const lit of regexLiterals(source)) {
    const seen = new Map();
    for (const name of definedGroupNames(lit.body)) seen.set(name, (seen.get(name) || 0) + 1);
    for (const [name, count] of seen) if (count > 1) out.push({ line: lit.line, name, count });
  }
  return out;
}

function walk(dir, acc) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return acc; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, acc); continue; }
    if (EXTS.has(path.extname(entry.name))) acc.push(full);
  }
  return acc;
}

console.log('=== A. THE READER IS EXERCISED BEFORE IT IS TRUSTED ===');
{
  // The two characters this section must build rather than type, so that nothing below is a
  // regex literal in THIS file that the tree scan of section B would then read back.
  const S = String.fromCharCode(47);   // '/'
  const rx = (body, flags) => S + body + S + (flags || '');

  const dupSource = 'const p = ' + rx('(?<a>x)|(?<a>y)', 'u') + ';';
  eq('a name repeated across two alternatives of ONE literal is caught',
    duplicatesIn(dupSource), [{ line: 1, name: 'a', count: 2 }]);

  eq('...and the same two alternatives with distinct names are clean',
    duplicatesIn('const p = ' + rx('(?<a>x)|(?<b>y)', 'u') + ';'), []);

  eq('the same name in two DIFFERENT literals is not a duplicate — node 22 does not refuse it',
    duplicatesIn('const a = ' + rx('(?<n>x)', 'u') + '; const b = ' + rx('(?<n>y)', 'u') + ';'), []);

  eq('a lookbehind is not a group name — «(?<=» and «(?<!» define nothing',
    definedGroupNames('(?<=a)(?<!b)(?<n>c)'), ['n']);

  eq('a duplicate written inside a STRING is not source and is not reported',
    duplicatesIn('const s = "' + rx('(?<a>x)(?<a>y)', 'u') + '";'), []);

  eq('...nor one written inside a line comment',
    duplicatesIn('// ' + rx('(?<a>x)(?<a>y)', 'u') + '\nconst q = 1;'), []);

  eq('...nor one written inside a block comment',
    duplicatesIn('/* ' + rx('(?<a>x)(?<a>y)', 'u') + ' */\nconst q = 1;'), []);

  eq('a division is not read as a literal — «a / b; c / d» holds no pattern',
    regexLiterals('const z = a / b; const y = c / d;'), []);

  eq('a literal inside a template substitution is still read',
    duplicatesIn('const t = `x${' + rx('(?<a>1)|(?<a>2)', 'u') + '.source}y`;'),
    [{ line: 1, name: 'a', count: 2 }]);

  eq('a duplicate written inside template TEXT is not source',
    duplicatesIn('const t = `' + rx('(?<a>1)(?<a>2)', 'u') + '`;'), []);

  eq('the line number reported is the line the literal opens on',
    duplicatesIn('\n\n\nconst p = ' + rx('(?<a>x)|(?<a>y)', 'u') + ';'),
    [{ line: 4, name: 'a', count: 2 }]);

  // THE ENGINE IS NEVER ASKED. This is the whole reason the file exists, and it is asserted on
  // this file's own source: `new RegExp` cannot enter here later without turning the check back
  // into the one that was green while the server was dead.
  const self = fs.readFileSync(__filename, 'utf8');
  ok('this guard never compiles a pattern to decide — no «new RegExp» in its own source',
    !self.includes('new Reg' + 'Exp('), 'the local engine accepts what node 22 refuses');
}

console.log('\n=== B. EVERY PATTERN SHIPPED UNDER api/ · lib/ · guards/ ===');
{
  const files = [];
  for (const root of ROOTS) walk(path.join(REPO, root), files);
  files.sort();

  ok('there are files to scan under ' + ROOTS.join(', '), files.length > 0,
    'found ' + files.length);

  let literals = 0, named = 0;
  const offenders = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(REPO, file).replace(/\\/g, '/');
    for (const lit of regexLiterals(source)) {
      literals += 1;
      named += definedGroupNames(lit.body).length;
    }
    for (const hit of duplicatesIn(source)) offenders.push(rel + ':' + hit.line + '  «' + hit.name + '» x' + hit.count);
  }

  console.log('  ..    ' + files.length + ' files · ' + literals + ' regex literals · '
    + named + ' named groups');

  // A reader that found nothing would report a clean tree forever. The floor is deliberately
  // low — it is a liveness check, not a census — but it is not zero.
  ok('the reader actually found patterns to count', literals > 100 && named > 0,
    literals + ' literals, ' + named + ' named groups');

  ok('no named group is defined twice inside one pattern', offenders.length === 0,
    offenders.join('\n        '));
  for (const line of offenders) console.log('        DUP  ' + line);
}

console.log('\n' + (failures === 0
  ? 'OK: ' + checks + '/' + checks + ' checks passed.'
  : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
process.exit(failures === 0 ? 0 : 1);
