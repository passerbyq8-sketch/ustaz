// guards/telemetry-scan-lib.cjs — the source sweep that guards/telemetry-text-guard.cjs runs.
//
// WHY THIS IS ITS OWN FILE. The guard mutates api/ask.js in memory to prove its own checks can
// fail, and a scanner that lived inside the guard would be mutated along with nothing — a check
// that cannot fail proves nothing, so the scanner and the assertions that drive it are kept
// apart and the mutants are fed through this same entry point the real sweep uses.
'use strict';

const SQ = String.fromCharCode(39);
const DQ = String.fromCharCode(34);
const BQ = String.fromCharCode(96);
const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);

/**
 * Blank out comments, keeping offsets and line numbers intact.
 *
 * A `(` inside a prose comment is not a call paren. This codebase's handlers carry more comment
 * than code in places, so a paren matcher that reads them walks off the end of the call it was
 * asked about and reports the next fetch body as telemetry. Blanking rather than deleting keeps
 * every reported line number equal to the line number in the file on disk.
 */
function blankComments(src) {
  let out = '';
  let inS = null;
  let esc = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (esc) { esc = false; out += c; i += 1; continue; }
    if (inS) {
      if (c === BS) esc = true;
      else if (c === inS) inS = null;
      out += c;
      i += 1;
      continue;
    }
    if (c === SQ || c === DQ || c === BQ) { inS = c; out += c; i += 1; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== NL) { out += ' '; i += 1; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === NL ? NL : ' ';
        i += 1;
      }
      out += '  ';
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Replace every string/template literal body with spaces, keeping the quotes and the length. */
function blankLiterals(text) {
  let out = '';
  let inS = null;
  let esc = false;
  for (const c of text) {
    if (esc) { esc = false; out += ' '; continue; }
    if (inS) {
      if (c === BS) { esc = true; out += ' '; continue; }
      if (c === inS) { inS = null; out += c; continue; }
      out += c === NL ? NL : ' ';
      continue;
    }
    if (c === SQ || c === DQ || c === BQ) { inS = c; out += c; continue; }
    out += c;
  }
  return out;
}

/**
 * Every console.* call in a source file, as {line, text} with `text` comment-free.
 *
 * `balanced` is reported rather than assumed: an extractor that silently returns a half call
 * would make the whole sweep read clean on a file it never finished reading.
 */
function consoleCalls(rawSource) {
  const src = blankComments(String(rawSource == null ? '' : rawSource));
  const re = /console\s*\.\s*(?:log|warn|error|info|debug)\s*\(/g;
  const calls = [];
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    let inS = null;
    let esc = false;
    let closed = false;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (esc) { esc = false; continue; }
      if (inS) {
        if (c === BS) esc = true;
        else if (c === inS) inS = null;
        continue;
      }
      if (c === SQ || c === DQ || c === BQ) { inS = c; continue; }
      if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) { i += 1; closed = true; break; }
      }
    }
    calls.push({
      line: src.slice(0, m.index).split(NL).length,
      text: src.slice(m.index, i),
      balanced: closed,
    });
  }
  return calls;
}

/** The object-literal keys written inside a console call's arguments. */
function objectKeys(callText) {
  const body = blankLiterals(callText);
  const names = [];
  const re = /(?:^|[{,\n])\s*([A-Za-z_$][\w$]*)\s*:/g;
  let k;
  while ((k = re.exec(body))) names.push(k[1]);
  return names;
}

/** The identifier expressions a console call reads, with literals blanked out. */
function expressionText(callText) {
  return blankLiterals(callText);
}

module.exports = { blankComments, blankLiterals, consoleCalls, objectKeys, expressionText };
