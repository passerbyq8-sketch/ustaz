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
// ITEM 32 HAS NOW BEEN DONE, AND THIS IS WHERE THE DECISION WAS RE-MADE. The paragraph above
// used to end "if the tag is gone for good, this decision has to be re-made once, here" -- and it
// is gone for good. index.html no longer carries a text/babel block or an @babel/standalone tag:
// it loads app.js, which tools/build-app.cjs compiles from app.jsx before the commit.
//
// So readBabelBlock() now has TWO shapes, and neither of them defaults:
//   * a page that still carries the block is read exactly as before, CDN tag REQUIRED. Nothing
//     in this repository is in that state any more; the path is kept because deleting it would
//     make this file unable to say what it used to do, and because quest.html or a future page
//     may still be.
//   * a page that carries <script src="app.js"> is read from app.jsx, with the runtime taken
//     from the pinned constant below. The pin is a MEASUREMENT, not a guess: it is the runtime
//     the CDN tag settled on the day it was removed, recorded with the version it came from, and
//     tools/build-app.cjs compiles the shipped bundle through this same value -- so a guard and
//     the browser cannot diverge without the bundle changing too.
// A page that carries NEITHER anchor is still an error that names itself. That is the property
// item 32-b exists to protect and it is not weakened here: what is removed is the CDN tag, not
// the refusal to guess.
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
// ITEM 32. The second shape: the page loads the built bundle, and the JSX it was built from is a
// file in the repository. Both anchors are REQUIRED together -- app.jsx without the tag would be
// a source nothing ships, and the tag without app.jsx would be a bundle nothing can rebuild.
const APP_SRC_RE = /<script[^>]*\ssrc=["']app\.js["'][^>]*>/i;
const JSX_NAME = 'app.jsx';
// THE RUNTIME, PINNED ONCE, WITH THE MEASUREMENT IT CAME FROM. The page pinned
// @babel/standalone 7.26.4 until the commit that removed the tag; preset-react's default for
// major 7 is classic, which emits React.createElement against the React global that vendor/
// serves. Automatic would inject a react/jsx-runtime dependency -- an ESM import in a classic
// <script> -- and the page would not boot at all. The value is stated rather than derived
// because there is no longer a URL to derive it from, and a derivation with nothing to read is
// the silent fallback this module was written to delete.
const PINNED_BABEL_VERSION = '7.26.4';
const PINNED_BABEL_MAJOR = 7;
const PINNED_RUNTIME = 'classic';

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
    // ITEM 32. No block in the page. That is the SHIPPED state now, and it is only accepted
    // when the page proves it loads the bundle instead -- and when the source that bundle is
    // built from is on disk and non-empty. Any other combination is the same named error it
    // has always been.
    const mApp = APP_SRC_RE.exec(html);
    if (!mApp) {
      throw new BabelBlockError('no <script type="text/babel"> block in ' + file
        + ' and no <script src="app.js"> either, so this page ships no JSX this can read. '
        + 'Nothing was extracted, and nothing is being reported as extracted: a guard that '
        + 'continued here would transform an empty string and pass every absence check in it.');
    }
    const jsxFile = path.join(path.dirname(path.resolve(file)), JSX_NAME);
    let raw;
    // A caller may HOLD the source instead of wanting it read: the two --mutants guards boot
    // deliberately corrupted copies of the shipped JSX and need the block cut from the copy they
    // hold, not from the file on disk. It is an explicit named option and not a guess -- an
    // absent `jsx` still means "read app.jsx", and an empty one is refused below exactly as an
    // empty file is, so a mutation that produced nothing cannot pass as a mutation that applied.
    if (typeof o.jsx === 'string') raw = o.jsx;
    else {
      try { raw = fs.readFileSync(jsxFile, 'utf8'); }
      catch (e) {
        throw new BabelBlockError(file + ' loads app.js, but ' + JSX_NAME + ' is not beside it ('
          + e.message + '). The bundle is a build product; the source it is built from is what a '
          + 'guard must read, and a bundle whose source is missing cannot be rebuilt or checked.');
      }
    }
    if (!raw.trim()) {
      throw new BabelBlockError(jsxFile + ' is empty. An empty source satisfies every absence '
        + 'check written against it, which is the one failure this module exists to prevent.');
    }
    return {
      file: jsxFile,
      html: html,
      openTag: mApp[0],
      from: 0,
      to: raw.length,
      raw: raw,
      rawBytes: Buffer.byteLength(raw, 'utf8'),
      // app.jsx line 1 is app.jsx line 1: a stack maps back to the source, not to an HTML offset.
      lineOffset: 0,
      babelSrc: '(none -- the page loads the built bundle app.js)',
      babelMajor: PINNED_BABEL_MAJOR,
      babelVersion: PINNED_BABEL_VERSION,
      runtime: PINNED_RUNTIME,
    };
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

/**
 * The whole source that reaches a browser, as one string: the document, plus the JSX it loads.
 *
 * WHY THIS EXISTS. Before item 32 those were the same file, and about twenty guards in this tree
 * relied on it -- they read index.html and searched it for a component, a style key, a storage
 * key, an event handler, a constant. Moving the block into app.jsx would have left every one of
 * them searching the shell that LOADS the application for text that is now in the application.
 * Not one of them would have failed loudly: a marker check goes to "token may differ", a splice
 * by anchors returns nothing, and an absence check over nothing passes. That is the exact defect
 * item 32-b was raised to end, arriving from the other side.
 *
 * So the answer is not to weaken those guards, and not to leave them reading the wrong file. It
 * is to give them the thing they were always reading: the shipped client. A page that still
 * inlines its JSX IS the shipped client and is returned unchanged; a page that loads app.js is
 * returned with app.jsx appended. A page that does neither throws, through readBabelBlock, which
 * requires every anchor and names the one it lost.
 *
 * WHAT IT IS NOT. It is not a substitute for reading index.html when index.html is the subject.
 * A check on the document's own bytes, its tag count, its line endings or its size must keep
 * reading the file. This is for checks whose subject is the APPLICATION.
 *
 * @param {object|string} [opts] a path, or { file, html }
 * @returns {string}
 * @throws {BabelBlockError} when the page ships no JSX this can find
 */
function readShippedClient(opts) {
  const o = (typeof opts === 'string') ? { file: opts } : (opts || {});
  const file = o.file || DEFAULT_HTML;
  let html = o.html;
  if (html === undefined) {
    try { html = fs.readFileSync(file, 'utf8'); }
    catch (e) { throw new BabelBlockError('cannot read ' + file + ': ' + e.message); }
  }
  if (OPEN_RE.test(html)) return html;
  return html + '\n' + readBabelBlock({ file: file, html: html }).raw;
}

module.exports = { readBabelBlock, transformBabelBlock, parseBabelBlock, readShippedClient,
  BabelBlockError,
  OPEN_RE: OPEN_RE, CDN_RE: CDN_RE, DEFAULT_HTML: DEFAULT_HTML,
  APP_SRC_RE: APP_SRC_RE, JSX_NAME: JSX_NAME,
  PINNED_RUNTIME: PINNED_RUNTIME, PINNED_BABEL_VERSION: PINNED_BABEL_VERSION };
