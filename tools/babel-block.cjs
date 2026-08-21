// babel-block.cjs — item 32-b. ONE place that cuts the shipped JSX out of index.html, and ONE
// place that decides how it is transformed.
//
// ---------------------------------------------------------------------------------------------
// WHAT WAS MEASURED (item 32-a, `node tools/prebuild-jsx.cjs --inventory`). FIFTEEN files in this
// tree do not merely read index.html: each cuts the `<script type="text/babel">` block out with
// its own copy of the same regex pair. TEN of those then decide `runtime: classic | automatic` by
// parsing the major version out of the @babel/standalone CDN `src`.
//
// THE DEFECT IS NOT THE DUPLICATION. It is what every one of those ten copies does when the URL
// is not there:
//
//     const babelSrc  = (html.match(/...@babel\/standalone.../i) || [])[1] || '';
//     const verMatch  = babelSrc.match(/@babel\/standalone@(\d+)\./);
//     const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8;      // <-- here
//
// A SILENT FALLBACK. Remove the CDN tag -- which is exactly what item 32 exists to do -- and every
// one of those guards goes on transforming, with the runtime the fallback chose rather than the
// one the page uses, and the gate stays GREEN. It is the shape this repository has now been bitten
// by twice: a default that satisfies the check instead of failing it.
//
// AND THE TWO RUNTIMES ARE NOT INTERCHANGEABLE. `classic` emits React.createElement against the
// React global; `automatic` injects a jsx-runtime dependency -- an ESM `import` in the browser, a
// `require` in Node. Over this block the two outputs differ by tens of thousands of bytes, so a
// guard that quietly picked the other one is not measuring the shipped app at all.
//
// SO: ONE SOURCE. readBabelBlock() locates the block and settles the runtime, and every anchor it
// depends on is REQUIRED. A missing open tag, an unterminated block, a missing CDN tag or a
// version it cannot parse each raise a BabelBlockError that names itself. There is no default.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO. It does not touch index.html, it does not change the
// three render-blocking tags, it adds nothing to sw.js's CORE and it changes no ignore list. Item
// 32 -- actually removing the CDN link -- is a different item. This one only makes it possible to
// do that in one place instead of fifteen.
// ---------------------------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const DEFAULT_HTML = path.join(REPO, 'index.html');

// The two regexes that were copied fifteen times. They live here now.
const OPEN_RE = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const CLOSE = '</script>';
const CDN_RE = /<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i;
const VERSION_RE = /@babel\/standalone@(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

class BabelBlockError extends Error {
  constructor(message) { super(message); this.name = 'BabelBlockError'; }
}

/**
 * Locate the shipped JSX block and settle the transform that reproduces the browser's.
 *
 * @param {object|string} [opts] a path, or { file, html }
 * @returns {{file:string, html:string, openTag:string, from:number, to:number, raw:string,
 *            rawBytes:number, lineOffset:number, babelSrc:string, babelMajor:number,
 *            babelVersion:string, runtime:'automatic'|'classic'}}
 * @throws {BabelBlockError} on ANY missing anchor. Never returns a partial or defaulted answer.
 */
function readBabelBlock(opts) {
  const o = (typeof opts === 'string') ? { file: opts } : (opts || {});
  const file = o.file || DEFAULT_HTML;
  let html = o.html;
  if (html === undefined) {
    try { html = fs.readFileSync(file, 'utf8'); }
    catch (e) { throw new BabelBlockError('cannot read ' + file + ': ' + e.message); }
  }

  const mOpen = OPEN_RE.exec(html);
  if (!mOpen) {
    throw new BabelBlockError('no <script type="text/babel"> block in ' + file
      + '. Nothing was extracted, and nothing is being reported as extracted: a guard that '
      + 'continued here would transform an empty string and pass every absence check in it.');
  }
  const from = mOpen.index + mOpen[0].length;
  const to = html.indexOf(CLOSE, from);
  if (to === -1) {
    throw new BabelBlockError('the text/babel block in ' + file + ' is never closed (no '
      + CLOSE + ' after offset ' + from + ')');
  }
  const raw = html.slice(from, to);

  // THE RUNTIME, FROM ONE PLACE AND WITH NO FALLBACK. The browser runs whatever
  // @babel/standalone the page loads, and preset-react's DEFAULT runtime follows that major:
  //   Babel 7.x -> classic    (React.createElement against the React global)
  //   Babel 8.x -> automatic  (injects a react/jsx-runtime dependency)
  // The version is READ, never assumed. "Assume 8" is precisely the behaviour item 32-b exists
  // to delete: it is what let a guard keep passing after the tag it reads was removed.
  const mCdn = CDN_RE.exec(html);
  if (!mCdn) {
    throw new BabelBlockError('no <script src="...@babel/standalone..."> tag in ' + file
      + ', so the JSX runtime the page uses cannot be read. This is an ERROR and not a default '
      + 'on purpose: every caller used to fall back to major 8 here, which meant that removing '
      + 'the CDN tag left the gates transforming with a runtime the page does not use, and '
      + 'passing. If the tag is gone for good, this decision has to be re-made once, here.');
  }
  const babelSrc = mCdn[1];
  const mVer = VERSION_RE.exec(babelSrc);
  if (!mVer) {
    throw new BabelBlockError('the @babel/standalone tag in ' + file + ' is ' + babelSrc
      + ', which pins no version this can parse. An UNPINNED url resolves to whatever the CDN '
      + 'calls latest, which is not a fact this repository holds, so it is refused rather than '
      + 'guessed.');
  }
  const babelMajor = parseInt(mVer[1], 10);
  const babelVersion = [mVer[1], mVer[2], mVer[3]].filter((x) => x !== undefined).join('.');

  return {
    file: file,
    html: html,
    openTag: mOpen[0],
    from: from,
    to: to,
    raw: raw,
    rawBytes: Buffer.byteLength(raw, 'utf8'),
    // Where the block's body starts, for mapping a transform error back to an HTML line.
    lineOffset: html.slice(0, from).split('\n').length - 1,
    babelSrc: babelSrc,
    babelMajor: babelMajor,
    babelVersion: babelVersion,
    runtime: babelMajor >= 8 ? 'automatic' : 'classic',
  };
}

/**
 * Transform the block exactly as the page's own pinned Babel would.
 * @param {object} block the value readBabelBlock() returned
 * @param {object} [options] { filename, sourceType, retainLines, presetOptions }
 * @returns {string} the transformed code
 */
function transformBabelBlock(block, options) {
  const opt = options || {};
  if (!block || typeof block.raw !== 'string' || !block.runtime) {
    throw new BabelBlockError('transformBabelBlock needs the object readBabelBlock returned');
  }
  const babel = require(path.join(REPO, 'node_modules', '@babel', 'core'));
  const presetOptions = Object.assign({ runtime: block.runtime }, opt.presetOptions || {});
  // Every caller's own transform options are carried through verbatim. Two of the guards run with
  // configFile/babelrc off and without retainLines, and a helper that quietly normalised those
  // would change their output -- which is the one thing this refactor may not do.
  const config = {
    presets: [[path.join(REPO, 'node_modules', '@babel', 'preset-react'), presetOptions]],
    filename: opt.filename || 'babel-block.jsx',
    sourceType: opt.sourceType || 'script',
  };
  if (opt.retainLines !== false) config.retainLines = true;
  if (opt.configFile !== undefined) config.configFile = opt.configFile;
  if (opt.babelrc !== undefined) config.babelrc = opt.babelrc;
  return babel.transformSync(block.raw, config).code;
}

/**
 * Parse the raw JSX into a syntax tree, for the guards that read structure rather than run it.
 * @param {object} block the value readBabelBlock() returned
 * @returns the @babel/parser File node
 */
function parseBabelBlock(block, options) {
  const opt = options || {};
  const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));
  return parser.parse(block.raw, Object.assign(
    { sourceType: 'script', plugins: ['jsx'] }, opt));
}

module.exports = { readBabelBlock, transformBabelBlock, parseBabelBlock, BabelBlockError,
  OPEN_RE: OPEN_RE, CDN_RE: CDN_RE, DEFAULT_HTML: DEFAULT_HTML };
