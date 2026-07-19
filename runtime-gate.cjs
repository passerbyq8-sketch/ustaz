// runtime-gate.cjs — runtime equivalent of the Babel gate.
// Transforms the text/babel block, evals it inside a jsdom window with React/
// ReactDOM as globals and a #root element, and reports whether the app mounts
// cleanly or throws a runtime error (with stack + line number).
//
// Usage: node runtime-gate.cjs [htmlFile]   (default: index.html)
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
// jsdom was dropped for linkedom (commit 456dc3b) and is no longer installed.
// linkedom is a drop-in DOM *provider* here — see the "Build a linkedom window"
// note below for why the swap preserves this gate's execution semantics.
const { parseHTML } = require('linkedom');

const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(htmlFile, 'utf8');

// --- Extract the text/babel block ---
const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const m = openRe.exec(html);
if (!m) { console.error('No text/babel script block found in ' + htmlFile); process.exit(2); }
const startBody = m.index + m[0].length;
const closeIdx = html.indexOf('</script>', startBody);
const rawCode = html.slice(startBody, closeIdx);
// Line number in the HTML where the babel block body begins (for mapping errors)
const lineOffset = html.slice(0, startBody).split('\n').length - 1;

// --- Determine the JSX runtime FAITHFULLY from the page's pinned Babel major ---
// The browser runs whatever @babel/standalone the page loads, and preset-react's
// DEFAULT runtime depends on the Babel MAJOR version:
//   * Babel 7.x  -> default runtime is "classic"   => React.createElement (uses the React global)
//   * Babel 8.x  -> default runtime is "automatic"  => injects a react/jsx-runtime dependency
//                                                       (ESM `import` in the browser; `require` in Node)
// We do NOT hardcode a runtime. We read the @babel/standalone <script src> from the
// HTML, parse its pinned version, and mirror that major's genuine default — so the gate
// reproduces exactly what the browser does. An UNPINNED url resolves to unpkg's latest
// (currently 8.x), so we treat unpinned as automatic.
const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8; // unpinned => latest (8.x)
const jsxRuntime = babelMajor >= 8 ? 'automatic' : 'classic';
console.log(`Page loads @babel/standalone: ${babelSrc || '(unpinned)'} -> major ${babelMajor} -> preset-react default runtime "${jsxRuntime}"`);

// --- Babel-transform (mirroring the page's Babel major default runtime) ---
let transformed;
try {
  transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    sourceType: 'script',
    retainLines: true, // keep original line numbers so stack traces map back
  }).code;
} catch (e) {
  console.log('TRANSFORM ERROR (should have been caught by babel-gate):');
  console.log(e.message);
  process.exit(1);
}

// --- Build a linkedom window with #root ---
// jsdom here was only a DOM *provider*: it was created with runScripts:'outside-only'
// so it NEVER executed page scripts. The React UMD bundles and the Babel-transformed
// app block are executed by Node's `vm` against this window (see below), not by the
// DOM engine. linkedom supplies an equivalent window/document (with #root, navigator,
// timers), so the execution path — and the mount assertion — are unchanged. The old
// jsdom-only options (url / pretendToBeVisual / runScripts) have no linkedom analog
// and aren't needed: the app mounts into #root regardless of document URL.
const { window } = parseHTML(
  '<!DOCTYPE html><html><body><div id="root"></div></body></html>'
);

// jsdom auto-defines the standard browser global self-references (self/window/
// globalThis all === window); linkedom does not. The React UMD is strict-mode, so
// its top-level `this` is undefined and it falls back to `self` to locate the
// global — restore those aliases so the UMD attaches React/ReactDOM to our window.
window.self = window.self || window;
window.window = window.window || window;
window.globalThis = window.globalThis || window;

// jsdom lacks a few APIs the React UMD/app may touch — stub the common ones.
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {},
           addEventListener() {}, removeEventListener() {} };
};
window.scrollTo = window.scrollTo || function () {};
if (!window.localStorage) {
  const store = {};
  window.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}
global.navigator = window.navigator;
global.window = window;
global.document = window.document;

// --- Load React + ReactDOM UMD globals into the window ---
function loadUMD(file) {
  const src = fs.readFileSync(path.join(__dirname, 'vendor', file), 'utf8');
  // UMD builds attach to `this`/`window`; run them with window as global.
  const vm = require('vm');
  const ctx = vm.createContext(window);
  vm.runInContext(src, ctx, { filename: file });
}
loadUMD('react.umd.js');
loadUMD('react-dom.umd.js');

if (!window.React || !window.ReactDOM) {
  console.log('FAIL: React/ReactDOM globals did not load.',
    'React=', typeof window.React, 'ReactDOM=', typeof window.ReactDOM);
  process.exit(1);
}

// --- Capture runtime errors ---
let caught = null;
window.addEventListener('error', (ev) => { caught = ev.error || ev.message; });
window.console.error = (...a) => { /* swallow React dev noise but keep last */ };

function report(err, phase) {
  console.log(`\n=== RUNTIME ERROR (${phase}) ===`);
  console.log(String(err && err.stack ? err.stack : err));
  // Try to map the first babel-block line in the stack back to the HTML file
  const stack = String(err && err.stack || '');
  const lm = stack.match(/babel-block\.jsx:(\d+)(?::(\d+))?/);
  if (lm) {
    const blkLine = parseInt(lm[1], 10);
    console.log(`\n-> babel-block line ${blkLine}  ≈  index.html line ${lineOffset + blkLine}`);
    const ctx = rawCode.split('\n')[blkLine - 1];
    if (ctx) console.log(`-> source: ${ctx.trim()}`);
  }
}

// --- Eval the transformed app code in the window context ---
const vm = require('vm');
const ctx = vm.createContext(window);
try {
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });
} catch (e) {
  report(e, 'module eval / mount');
  process.exit(1);
}

// Give microtasks/effects a tick to flush, then inspect #root.
setTimeout(() => {
  if (caught) { report(caught, 'async / effect'); process.exit(1); }
  const root = window.document.getElementById('root');
  const mounted = root && root.childNodes.length > 0;
  if (mounted) {
    console.log('OK: app mounted cleanly. #root has ' + root.childNodes.length +
      ' child node(s). No runtime error.');
    console.log('First ~200 chars of rendered HTML:');
    console.log('  ' + root.innerHTML.slice(0, 200).replace(/\s+/g, ' ').trim());
  } else {
    console.log('WARNING: no runtime error thrown, but #root is EMPTY after mount.');
    console.log('(App may render null, or mount target/logic differs.)');
  }
}, 200);
