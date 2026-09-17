// guards/app-version-pattern-parity-guard.cjs
// THE APP-VERSION SHAPE IS WRITTEN IN FOUR PLACES AND NOTHING HELD THEM TOGETHER.
//
// -- THE DEBT THIS CLOSES, MEASURED ON 1957e64 -------------------------------
// One pattern decides what a build may call itself, and four independent files spell it out,
// each with its own comment:
//
//     api/feedback.js:105              const APPV_RE    = <pattern>
//     api/report.js:54                 const APPV_RE    = <pattern>
//     tools/build-app.cjs:64           const VERSION_RE = <pattern>
//     quest-bank-integrity-guard.cjs:1491   inside const SW_CACHE
//
// The first three were MEASURED IDENTICAL on 1957e64 and the fourth was MEASURED IDENTICAL to
// them on 26a9214, so this is not a live defect: it is a future drift with no brake. The copies
// are deliberate -- api/report.js says in prose that it "imports nothing for it", the two
// serverless routes are not allowed to share a module, and a guard may not import from the tree
// it judges -- so the repair is not a shared import. It is this gate: a reader that lifts the
// pattern out of all four by TEXT and refuses to be green when they stop being the same
// characters.
//
// -- HOW THE FOURTH SITE IS ADDRESSED ---------------------------------------
// The first three sites are the whole initialiser of a named const. The fourth is not: it is
// written inline, in the `if` that validates config/app-version.json inside the IIFE that
// computes `const SW_CACHE`. So the reader does not look for "a const whose value is a literal".
// It looks for a named const and then reads THE INITIALISER STATEMENT WHOLE -- to the first `;`
// outside every bracket and outside every literal -- and collects the regex literals inside it.
// For the first three that statement is the literal; for the fourth it is six lines of IIFE with
// exactly one literal in them. One rule, four sites, no special case.
//
// The anchor is therefore a NAME (`SW_CACHE`), not a line number and not a quoted source line:
// the fourth site can be rewrapped, re-indented or moved down the file and stay held. What it
// may not do is lose its name, and losing it is a FAIL that says so.
//
// -- WHAT IT COMPARES -------------------------------------------------------
// The regex LITERAL of each site, body and flags, exactly as written between the delimiting
// slashes. Not the compiled RegExp: two literals can compile to objects that behave alike on
// today's inputs and still be different text, and the thing being protected here is the text,
// since that is what a future editor changes one of.
//
// The expected pattern is NOT written in this file. Writing it here would make this guard a
// FIFTH copy of the very thing it exists to stop from multiplying. The four are compared to
// each other; the first site in the list is the reference and every other site is reported
// against it BY NAME, with both texts printed, so a red says which file moved.
//
// -- THE FAILURE MODES ALL POINT THE SAME WAY -------------------------------
// A guard whose reader quietly stops finding things passes on everything. So every way this
// reader can fail is a FAIL, never a skip: a missing declaration, more than one declaration of
// the same name in one file, an initialiser that never terminates, an initialiser with NO regex
// literal in it, and an initialiser with MORE THAN ONE are each reported by file and name.
// Section A exercises the reader against synthetic sources -- including a decoy inside a
// comment, one inside a string, a literal nested in an IIFE and a literal that belongs to the
// NEXT statement -- before section B is allowed to speak about the tree.
//
// THIS GATE EDITS NOTHING AND IMPORTS NOTHING FROM THE FOUR FILES. api/feedback.js and
// api/report.js are ES modules with side effects at import (a Redis client is constructed at
// module scope), and quest-bank-integrity-guard.cjs is a gate that would run its whole battery;
// all four are read as bytes.
//
// Usage: node guards/app-version-pattern-parity-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

// The four sites, in the order the report names them. The FIRST is the reference.
// `decl` is the const whose INITIALISER STATEMENT holds the pattern -- for the first three the
// initialiser is the literal itself, for the fourth it is the IIFE that validates the version
// file before it is used as a cache-store name.
const SITES = [
  { file: 'api/feedback.js', decl: 'APPV_RE' },
  { file: 'api/report.js', decl: 'APPV_RE' },
  { file: 'tools/build-app.cjs', decl: 'VERSION_RE' },
  { file: 'quest-bank-integrity-guard.cjs', decl: 'SW_CACHE' },
];

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).split('\n').join('\n        ') : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n  actual   ' + a);
}

// -- THE READER -------------------------------------------------------------
// Comments and strings are blanked before the declaration is looked for, so that a pattern
// quoted in prose or inside an error message is not mistaken for the shipped one. Blanking
// preserves length and newlines, so every line number reported below is the real one.
function blankNonCode(src) {
  const out = src.split('');
  const blank = (from, to) => { for (let k = from; k < to && k < out.length; k += 1) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      const stop = nl < 0 ? src.length : nl;
      blank(i, stop); i = stop; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      blank(i, stop); i = stop; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j += 1; break; }
        if (src[j] === '\n' && c !== '`') { break; }
        j += 1;
      }
      blank(i, j); i = j; continue;
    }
    if (c === '/') {
      // A regex literal: stepped over whole, so that a '//' or a quote INSIDE a pattern is not
      // read as the start of a comment or a string. Its text is left intact -- it is the
      // subject of this guard.
      const lit = readRegexLiteralAt(src, i);
      if (lit) { i = lit.end; continue; }
      i += 1; continue;
    }
    i += 1;
  }
  return out.join('');
}

// Read the regex literal whose opening slash is at `start`. Character classes and escapes are
// honoured, so `[/]` and `\/` do not end it. A raw newline means this slash was not a literal.
// Returns null rather than guessing.
function readRegexLiteralAt(src, start) {
  if (src[start] !== '/') return null;
  let i = start + 1, inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '\n') return null;
    if (inClass) { if (c === ']') inClass = false; i += 1; continue; }
    if (c === '[') { inClass = true; i += 1; continue; }
    if (c === '/') break;
    i += 1;
  }
  if (src[i] !== '/') return null;
  if (i === start + 1) return null;             // '//' is a comment, not an empty pattern
  const body = src.slice(start + 1, i);
  let j = i + 1;
  while (j < src.length && /[a-z]/.test(src[j])) j += 1;
  return { body: body, flags: src.slice(i + 1, j), end: j };
}

const lineAt = (src, index) => src.slice(0, index).split('\n').length;

// The initialiser statement that starts at `from`, read WHOLE: it ends at the first `;` that sits
// outside every bracket. Brackets inside comments and strings do not count (they were blanked);
// brackets inside a regex literal do not count either, because a literal is stepped over as one
// token -- `{1,40}` and `[/]` are pattern text, not structure. Every regex literal met on the way
// is collected, in source order. An initialiser with no `;` at depth zero is reported as
// unterminated rather than guessed at.
function initialiserAt(src, code, from) {
  const literals = [];
  let i = from, depth = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') { depth += 1; i += 1; continue; }
    if (c === ')' || c === ']' || c === '}') { depth -= 1; i += 1; continue; }
    if (c === ';' && depth <= 0) return { literals: literals, terminated: true };
    if (c === '/') {
      const lit = readRegexLiteralAt(code, i);
      if (lit) {
        literals.push({ body: lit.body, flags: lit.flags, text: '/' + lit.body + '/' + lit.flags, line: lineAt(src, i) });
        i = lit.end; continue;
      }
    }
    i += 1;
  }
  return { literals: literals, terminated: false };
}

// Every `const <name> = ...` declaration in real code, as { line, literals, terminated }.
// More than one declaration is an ambiguity the caller must refuse; zero is a missing site. The
// literals are those of the initialiser STATEMENT, however deeply they are nested inside it --
// which is what lets one rule hold a bare literal and one buried in an IIFE.
function declarationsOf(src, name) {
  const code = blankNonCode(src);
  const found = [];
  const needle = 'const ' + name;
  let at = 0;
  for (;;) {
    const hit = code.indexOf(needle, at);
    if (hit < 0) break;
    at = hit + needle.length;
    const before = hit === 0 ? '\n' : code[hit - 1];
    if (!/[\s;{}]/.test(before)) continue;                       // part of a longer token
    let k = at;
    if (/[A-Za-z0-9_$]/.test(code[k])) continue;                 // a longer identifier
    while (k < code.length && /[ \t]/.test(code[k])) k += 1;
    if (code[k] !== '=') continue;
    k += 1;
    while (k < code.length && /[ \t]/.test(code[k])) k += 1;
    const init = initialiserAt(src, code, k);
    found.push({ line: lineAt(src, hit), literals: init.literals, terminated: init.terminated });
  }
  return found;
}

console.log('=== A. THE READER IS EXERCISED BEFORE IT IS TRUSTED ===');
{
  // The delimiter is built rather than typed so that the synthetic sources below are strings in
  // this file and not literals of it.
  const S = String.fromCharCode(47);
  const rx = (body, flags) => S + body + S + (flags || '');

  // The shape the reader returns, so the expectations below stay short.
  const decl = (line, literals, terminated) =>
    ({ line: line, literals: literals, terminated: terminated !== false });
  const lit = (line, body, flags) =>
    ({ body: body, flags: flags, text: rx(body, flags), line: line });

  eq('a plain declaration yields the literal of its initialiser, with body, flags and line',
    declarationsOf('const A = 1;\nconst RE = ' + rx('^ab$', 'u') + ';\n', 'RE'),
    [decl(2, [lit(2, '^ab$', 'u')])]);

  eq('a slash inside a character class does not end the literal',
    declarationsOf('const RE = ' + rx('^[a' + S + 'b]$', '') + ';', 'RE'),
    [decl(1, [lit(1, '^[a' + S + 'b]$', '')])]);

  eq('an escaped slash does not end it either',
    declarationsOf('const RE = ' + rx('^a\\' + S + 'b$', 'i') + ';', 'RE'),
    [decl(1, [lit(1, '^a\\' + S + 'b$', 'i')])]);

  eq('a declaration written inside a LINE comment is not code',
    declarationsOf('// const RE = ' + rx('^decoy$', '') + ';\nconst KEEP = 1;', 'RE'), []);

  eq('...nor one inside a BLOCK comment',
    declarationsOf('/*\n * const RE = ' + rx('^decoy$', '') + ';\n */\nconst KEEP = 1;', 'RE'), []);

  eq('...nor one inside a STRING',
    declarationsOf('const msg = "const RE = ' + rx('^decoy$', '') + ';";', 'RE'), []);

  eq('the real declaration is still found when a decoy sits above it',
    declarationsOf('// const RE = ' + rx('^decoy$', '') + ';\nconst RE = ' + rx('^real$', 'u') + ';', 'RE'),
    [decl(2, [lit(2, '^real$', 'u')])]);

  eq('a longer identifier with the same prefix is not the declaration',
    declarationsOf('const RE_OTHER = ' + rx('^x$', '') + ';', 'RE'), []);

  eq('two declarations of one name are both returned, so the caller can refuse the ambiguity',
    declarationsOf('const RE = ' + rx('^a$', '') + ';\nconst RE = ' + rx('^b$', '') + ';', 'RE').length, 2);

  eq('a missing declaration is an empty list, not a pass',
    declarationsOf('const OTHER = 1;', 'RE'), []);

  eq('a declaration whose initialiser holds no literal reports an EMPTY literal list',
    declarationsOf('const RE = buildPattern();', 'RE'), [decl(1, [])]);

  // -- THE FOURTH SITE'S SHAPE, SYNTHESISED ---------------------------------
  // A literal buried in the IIFE that computes the const, with a `;` and braces between the
  // declaration and the pattern. Reading only "the value after the `=`" finds nothing here; the
  // statement is read whole instead.
  eq('a literal nested inside an IIFE initialiser is found, and the `;` inside it does not end the statement',
    declarationsOf('const V = (() => {\n  const raw = load();\n  if (!' + rx('^ok$', '') + '.test(raw)) {\n    throw new Error(raw);\n  }\n  return raw;\n})();\n', 'V'),
    [decl(1, [lit(3, '^ok$', '')])]);

  eq('two literals in one initialiser are both returned, so the caller can refuse THAT ambiguity too',
    declarationsOf('const V = (() => ' + rx('^a$', '') + '.test(x) ? ' + rx('^b$', '') + ' : null)();', 'V'),
    [decl(1, [lit(1, '^a$', ''), lit(1, '^b$', '')])]);

  eq('a literal in the NEXT statement is not attributed to this declaration',
    declarationsOf('const V = 1;\nconst OTHER = ' + rx('^x$', '') + ';', 'V'), [decl(1, [])]);

  eq('an initialiser with no terminating `;` is reported unterminated, not guessed at',
    declarationsOf('const V = (() => {\n  return ' + rx('^x$', '') + ';\n})()', 'V'),
    [decl(1, [lit(2, '^x$', '')], false)]);

  {
    // A comment that contains a slash inside a pattern must not swallow the code after it.
    const src = 'const RE = ' + rx('^a' + S + S + 'b$', '') + ';\nconst AFTER = 2;';
    ok('a pattern containing two slashes does not blank the rest of the file',
      blankNonCode(src).includes('const AFTER'), blankNonCode(src));
  }

  // The pattern under protection is NOT written in this file. If it ever is, this guard has
  // become the fourth copy and the check it performs has stopped meaning anything.
  {
    const self = fs.readFileSync(__filename, 'utf8');
    const bodies = new Set();
    for (const site of SITES) bodies.add(site.decl);
    ok('this guard names the four sites but does not restate their pattern',
      !self.includes('A-Za-z0' + '-9._-'),
      'the expected pattern is hard-coded here, which makes this file a fourth copy');
  }
}

console.log('\n=== B. THE FOUR SITES CARRY ONE PATTERN ===');
{
  const read = [];
  for (const site of SITES) {
    const abs = path.join(REPO, site.file);
    let src = null;
    try { src = fs.readFileSync(abs, 'utf8'); } catch (e) { src = null; }
    if (src === null) {
      ok(site.file + ': the file is on disk', false, 'cannot read ' + abs);
      read.push(null);
      continue;
    }
    const decls = declarationsOf(src, site.decl);
    if (decls.length === 0) {
      ok(site.file + ': declares const ' + site.decl, false,
        'no such declaration. It was renamed, moved or deleted. This gate holds the four '
        + 'copies of the app-version pattern together; a site that vanished is a site that '
        + 'stopped being held, not a site that agrees.');
      read.push(null);
      continue;
    }
    if (decls.length > 1) {
      ok(site.file + ': declares const ' + site.decl + ' exactly once', false,
        'declared ' + decls.length + ' times, at lines ' + decls.map((d) => d.line).join(', ')
        + ' -- this gate cannot say which one ships.');
      read.push(null);
      continue;
    }
    const d = decls[0];
    if (!d.terminated) {
      ok(site.file + ': the initialiser of const ' + site.decl + ' ends', false,
        'the statement opened at line ' + d.line + ' never reaches a `;` outside its brackets, '
        + 'so this gate cannot say where it stops or which literals belong to it.');
      read.push(null);
      continue;
    }
    if (d.literals.length === 0) {
      ok(site.file + ': the initialiser of const ' + site.decl + ' holds a regex LITERAL', false,
        'the statement at line ' + d.line + ' contains no regex literal. A computed pattern '
        + 'cannot be compared as text, and text is what drifts.');
      read.push(null);
      continue;
    }
    if (d.literals.length > 1) {
      ok(site.file + ': the initialiser of const ' + site.decl + ' holds exactly one literal', false,
        d.literals.length + ' literals, at lines ' + d.literals.map((l) => l.line).join(', ')
        + ' -- this gate cannot say which one is the app-version shape.');
      read.push(null);
      continue;
    }
    const found = d.literals[0];
    ok(site.file + ':' + found.line + '  const ' + site.decl + ' -> ' + found.text, true);
    read.push({ site: site, line: found.line, text: found.text });
  }

  const usable = read.filter(Boolean);
  ok('all ' + SITES.length + ' sites were read', usable.length === SITES.length,
    usable.length + ' of ' + SITES.length + ' could be read; the comparison below is not a '
    + 'verdict on the ones that could not.');

  if (usable.length === SITES.length) {
    const ref = usable[0];
    const drifted = usable.slice(1).filter((r) => r.text !== ref.text);
    ok('the four copies of the app-version pattern are the same characters',
      drifted.length === 0,
      drifted.map((r) =>
        'DRIFTED  ' + r.site.file + ':' + r.line + '  const ' + r.site.decl + ' -> ' + r.text
        + '\n         reference ' + ref.site.file + ':' + ref.line + '  const ' + ref.site.decl
        + ' -> ' + ref.text).join('\n'));
    for (const r of drifted) {
      console.log('        DRIFT  ' + r.site.file + ':' + r.line + '  ' + r.text
        + '   !=   ' + ref.site.file + ':' + ref.line + '  ' + ref.text);
    }
    console.log('  ..    one pattern, ' + usable.length + ' sites: '
      + usable.map((r) => r.site.file + ':' + r.line).join(' · '));
  }
}

console.log('\n' + (failures === 0
  ? 'OK: ' + checks + '/' + checks + ' checks passed.'
  : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
process.exit(failures === 0 ? 0 : 1);
