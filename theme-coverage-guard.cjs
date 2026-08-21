// theme-coverage-guard.cjs -- S95, the dark-mode gate.
//
// It proves dark mode the same way the other guards prove their features: by reading the SHIPPED
// values. The styles object is not re-typed here -- the babel block is extracted from index.html,
// transformed with the page's own pinned Babel major, evaluated in a linkedom window, and `s` is
// read out of it. Every colour below is therefore the one the browser will resolve.
//
// Five groups, each answering one thing that had to be true:
//   A. THE ROOT CAUSE  -- the dark palette is declared on :root, NOT on a class. It used to be
//                         `:root[data-theme="dark"] .theme-dark`, and only four subtrees ever
//                         carried that class, so every other screen stayed light. A gate that
//                         only checked colours would let someone re-scope it and pass.
//   B. NO LIGHT ISLAND -- no style key keeps a light background once data-theme=dark, except the
//                         three named below, each of which is light ON PURPOSE.
//   C. READABLE        -- nothing lands under 3:1 in dark: no dark-on-dark, no light-on-light.
//   D. LIGHT IS PINNED -- every token introduced by this phase has a light value byte-identical
//                         to the literal it replaced. This is what stops a future dark tweak from
//                         quietly moving the light design.
//   E. THE QUEST PAGE  -- quest.html reads the same theme key, boots before first paint, and has
//                         a dark value for every token its light palette declares.
//   G. VISUAL THEMES   -- S100. A THIRD, independent setting: qibla_13 | istana_33, stored
//                         under its own key, defaulting to istana_33, composing with BOTH of
//                         the other two rather than replacing either. This group proves the
//                         reader, the default, the independence of the three keys, the plain
//                         #FFFFFF page invariant, the absence of any page-background pattern,
//                         the approved token values, both dark variants, the settings control,
//                         that every implemented screen inherits the identity, and contrast in
//                         all four (identity x mode) renderings.
//
// NO LITERAL ARABIC IN THIS FILE. Any Arabic is written \uXXXX and echoed as codepoints: a
// failure message that reorders under bidi lies about which value it is naming.
//
// Usage: node theme-coverage-guard.cjs [indexHtml] [questHtml]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const BB = require('./tools/babel-block.cjs');
const { parseHTML } = require('linkedom');

const INDEX = process.argv[2] || 'index.html';
const QUEST = process.argv[3] || 'quest.html';

let checks = 0, failures = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, a, b) => ok(name, String(a) === String(b), 'expected ' + b + '\n        actual   ' + a);

/* ── 106-ب. THE BLIND NEGATIVE CHECK, AND WHY IT NEEDED A PRECONDITION ─────────────────────
 * Every source reading below is an ANCHORED CUT: find the opening literal, find the closing one,
 * slice between them. When either anchor moves in index.html the cut does not throw -- it comes
 * back ''. And '' SATISFIES EVERY NEGATIVE CHECK WRITTEN OVER IT:
 *
 *     !/x/.test('')                       is true
 *     ''.indexOf('x') === -1              is true
 *     (''.match(/x/g) || []).length === 0 is true
 *     (''.match(/x/g) || [])              equals []
 *
 * so the assertion prints PASS while looking at nothing at all. That is the one failure mode a
 * guard may not have: it goes quiet exactly when the thing it guards has moved.
 *
 * MEASURED, NOT ASSUMED. Each of the 35 emptyable extractions in this file was forced to '' in
 * turn and the whole suite re-run against a healthy tree. 78 (assertion, anchor) pairs across 64
 * assertions still passed with their anchor gone. Those 64 calls are the ones rewritten to use
 * the two helpers below; nothing else was touched.
 *
 * THE FIX IS A PRECONDITION, NOT A STRONGER CHECK. Each assertion keeps its own condition byte
 * for byte. What changes is that a lost anchor is now reported as an explicit, NAMED failure
 * before that condition is ever consulted -- so «the anchor moved» can no longer be mistaken for
 * «the property still holds».
 */
function anchorLoss(anchors) {
  const lost = anchors.filter((a) => !(typeof a[1] === 'string' && a[1].length)).map((a) => a[0]);
  if (!lost.length) return null;
  return 'ANCHOR LOST: ' + lost.join(', ') + ' -- that extraction returned 0 bytes, so the check '
    + 'below read nothing. Fix the anchor in index.html; do not weaken the check.';
}
const okOn = (name, anchors, cond, detail) => {
  const lost = anchorLoss(anchors);
  return lost ? ok(name, false, lost) : ok(name, cond, detail);
};
const eqOn = (name, anchors, a, b) => {
  const lost = anchorLoss(anchors);
  return lost ? ok(name, false, lost) : eq(name, a, b);
};

/* -------------------------------------------------------------------------
 * Palette parsing. Comments are stripped FIRST -- the stylesheet's own prose
 * names tokens ("--madina-desk: the surface the sheet lies on"), and a
 * declaration parser reading [^;}]+ will swallow the real declaration that
 * follows such a line. That mis-measured this very file once.
 * ---------------------------------------------------------------------- */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
function palette(block) {
  const out = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) out[m[1]] = m[2].trim();
  return out;
}
function cssOf(file) {
  const h = fs.readFileSync(file, 'utf8');
  return { html: h, css: stripComments(h.slice(h.indexOf('<style>'), h.indexOf('</style>'))) };
}

/* ---- colour maths -------------------------------------------------------- */
function parseColor(v) {
  if (!v) return null;
  v = String(v).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16));
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    if (p.length > 3 && p[3] < 0.9) return null;   // translucent: not a surface on its own
    return [p[0], p[1], p[2]];
  }
  return null;
}
const lum = (c) => {
  const f = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };
const hex = (c) => (c ? '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('') : '-');
// The fully expanded declaration TEXT, for asking "is this a gradient?" rather than "what
// colour is it?" -- resolve() answers the second question and would happily pull the first
// colour out of a gradient, which is exactly the pattern the invariant forbids.
function resolveRaw(value, pal) {
  let v = String(value == null ? '' : value);
  for (let i = 0; i < 8 && v.indexOf('var(') !== -1; i++) {
    v = v.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^()]*))?\)/gi, (_, n2, fb) => (pal[n2] != null ? pal[n2] : (fb || '')));
  }
  return v;
}
function resolve(value, pal) {
  if (value == null) return null;
  let v = String(value);
  for (let i = 0; i < 8 && v.indexOf('var(') !== -1; i++) {
    v = v.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^()]*))?\)/gi, (_, n, fb) => (pal[n] != null ? pal[n] : (fb || '')));
  }
  const g = /(?:linear|radial)-gradient\([^)]*?(#[0-9a-f]{3,6}|rgba?\([^)]*\))/i.exec(v);
  if (g) return parseColor(g[1]);
  const f = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/i.exec(v);
  return f ? parseColor(f[1]) : null;
}

/* -------------------------------------------------------------------------
 * The documented exceptions. Each is a surface that is light in dark mode ON
 * PURPOSE, with the reason it is allowed to be. Anything not on this list that
 * stays light is a bug, and adding to this list is a deliberate act.
 * ---------------------------------------------------------------------- */
const LIGHT_ON_PURPOSE = {
  svgRuleOuter: 'the mushaf paper band. A page of the Quran is never inverted; the DESK under it darkens instead.',
  svgSheet: 'the mushaf sheet itself, same rule as svgRuleOuter.',
  // S113: callMuteBtn LEFT this list, and it left because its reason stopped being true. The
  // entry read "a light pill sitting ON the call screen, which is dark in BOTH themes" -- the
  // call screen is no longer dark in both themes. It is --page now: plain white in light and the
  // identity's own dark in dark, so the pill reads --a3-ice like every other istana control and
  // is measured by group C in both modes rather than excused from either. Group O asserts that
  // directly, so this is not a deletion that quietly widened the gate.
};
// a3Mark hides its tick by painting it the same colour as its own surface -- the unchecked
// marker. Equal foreground and background is the design there, in both themes.
const NO_TEXT = new Set(['a3Mark']);
// Pre-existing LIGHT-mode contrast, untouched by this phase: changing it would move the light
// design, which the brief forbids. Recorded so it is a known quantity, not an unnoticed one.
const KNOWN_LIGHT = new Set(['memPlaceholder']);

/* ---- read the shipped styles object -------------------------------------- */
let CTX = null;   // S100: section G calls the shipped readers; it does not re-type them.
function stylesObject(html) {
  let block;
  try { block = BB.readBabelBlock({ file: INDEX, html: html }); }
  catch (e) { console.error(e.message); process.exit(2); }
  let code;
  try {
    code = BB.transformBabelBlock(block);
  } catch (e) { console.log('TRANSFORM ERROR (babel-gate should have caught this):\n' + e.message); process.exit(1); }

  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 };
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  try { global.navigator = window.navigator; } catch (e) {}
  global.window = window; global.document = window.document;
  const ctx = vm.createContext(window);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8'), ctx, { filename: f });
  load('react.umd.js'); load('react-dom.umd.js');
  vm.runInContext('ReactDOM.createRoot=function(){return{render:function(){},unmount:function(){}};};', ctx);
  try { vm.runInContext(code, ctx, { filename: 'babel-block.jsx' }); }
  catch (e) { console.log('RUNTIME ERROR evaluating the app block:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); }
  CTX = ctx;
  return vm.runInContext('s', ctx);
}

/* ========================= A. THE ROOT CAUSE ============================== */
const { html, css } = cssOf(INDEX);
console.log('\n=== A. THE ROOT CAUSE: the palette is on :root, not on a class ===');

const docDark = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/g;
let DARK = {}, docBlocks = 0;
for (const m of css.matchAll(docDark)) { DARK = { ...DARK, ...palette(m[1]) }; docBlocks++; }
const LIGHT = palette((/:root\s*\{([^}]*)\}/.exec(css) || [, ''])[1]);
const a3l = /\.adhkar3\s*,\s*\.ezhome\s*\{([^}]*)\}/.exec(css);
if (a3l) Object.assign(LIGHT, palette(a3l[1]));
for (const m of css.matchAll(/:root\[data-theme="dark"\]\s+\.adhkar3[^{]*\{([^}]*)\}/g)) DARK = { ...DARK, ...palette(m[1]) };

ok('a document-level :root[data-theme="dark"] block exists', docBlocks > 0);
// THE regression this gate exists to stop.
ok('the palette is NOT re-scoped behind .theme-dark again',
  !/:root\[data-theme="dark"\]\s+\.theme-dark\s*\{/.test(css),
  'the dark palette was moved back under .theme-dark; only four subtrees carry that class, so '
  + 'every other screen would silently go back to the light palette');
// The core tokens have to be in the DOCUMENT-level block, not merely somewhere in the file.
const CORE = ['--red', '--red-deep', '--ink', '--muted', '--white', '--page', '--line', '--tint', '--accent-ink'];
const missing = CORE.filter((t) => DARK[t] == null);
ok('every core token has a document-level dark value', missing.length === 0, 'missing: ' + missing.join(', '));
ok('the boot script sets data-theme before first paint (no light flash)',
  /localStorage\.getItem\('murabbi_theme_v1'\)[\s\S]{0,200}?setAttribute\('data-theme'/.test(html));
ok('the runtime switcher writes data-theme onto documentElement',
  /document\.documentElement\.setAttribute\('data-theme', v\)/.test(html));
ok('...and persists the choice under the same key',
  /localStorage\.setItem\(THEME_KEY, v\)/.test(html));
ok('...and moves the browser/status-bar colour with it',
  /meta\[name="theme-color"\][\s\S]{0,120}?v === 'dark'/.test(html));
// The one deliberate opt-out, and it must stay an opt-out rather than becoming a second theme.
ok('the mushaf sheet opts out through a scoped re-declaration',
  /:root\[data-theme="dark"\]\s+\.mushaf-paper\s*\{/.test(css));
ok('...and the sheet element actually carries that class',
  /className="mushaf-paper"/.test(html));

/* ==================== B/C. SURFACES AND READABILITY ====================== */
const s = stylesObject(html);
const L = LIGHT, D = { ...LIGHT, ...DARK };
const rows = [];
for (const key of Object.keys(s)) {
  const st = s[key];
  if (!st || typeof st !== 'object') continue;
  const bgRaw = ['background', 'backgroundColor'].map((k) => st[k]).find((v) => v != null);
  rows.push({ key, bgRaw, fgRaw: st.color, bgL: resolve(bgRaw, L), bgD: resolve(bgRaw, D), fgL: resolve(st.color, L), fgD: resolve(st.color, D) });
}
console.log('\n=== B. NO LIGHT ISLAND (' + rows.length + ' style keys measured) ===');
const stuck = rows.filter((r) => r.bgD && lum(r.bgD) > 0.45 && r.bgRaw && !/var\(/.test(String(r.bgRaw)));
const unexpected = stuck.filter((r) => !LIGHT_ON_PURPOSE[r.key]);
ok('no screen keeps a hardcoded light background under data-theme=dark',
  unexpected.length === 0,
  unexpected.map((r) => r.key + ' = ' + hex(r.bgD)).join(', '));
for (const k of Object.keys(LIGHT_ON_PURPOSE)) {
  ok('...' + k + ' is still light on purpose', stuck.some((r) => r.key === k),
    'it no longer resolves light -- if that was intended, drop it from LIGHT_ON_PURPOSE');
}

console.log('\n=== C. READABLE IN BOTH THEMES ===');
const lowD = rows.filter((r) => !NO_TEXT.has(r.key) && r.bgD && r.fgD && contrast(r.bgD, r.fgD) < 3);
ok('nothing falls below 3:1 in DARK', lowD.length === 0,
  lowD.map((r) => r.key + ' bg ' + hex(r.bgD) + ' fg ' + hex(r.fgD) + ' = ' + contrast(r.bgD, r.fgD).toFixed(2)).join('\n        '));
const lowL = rows.filter((r) => !NO_TEXT.has(r.key) && !KNOWN_LIGHT.has(r.key) && r.bgL && r.fgL && contrast(r.bgL, r.fgL) < 3);
ok('nothing falls below 3:1 in LIGHT', lowL.length === 0,
  lowL.map((r) => r.key + ' bg ' + hex(r.bgL) + ' fg ' + hex(r.fgL) + ' = ' + contrast(r.bgL, r.fgL).toFixed(2)).join('\n        '));

/* ======================= D. LIGHT IS PINNED ============================== */
// Every token this phase introduced replaced a literal. Its LIGHT value must still BE that
// literal, or the dark work has moved the light design -- which the brief forbids outright.
console.log('\n=== D. LIGHT IS PINNED (the light design cannot drift) ===');
const PINNED = {
  '--accent-ink': '#12327A',   // was --red-deep used as text
  '--mushaf-desk': '#EDE7DB',  // was the MUSHAF_DESK constant
  '--madina-desk': '#FDFDFD',  // was the MADINA_DESK constant
  '--a3-on-blue': '#FFFFFF',   // was a literal #FFFFFF on the a3 accent fill
  '--warn-bg': '#FFF4E5',
  '--warn-line': '#F0C674',
  '--warn-ink': '#8B5A00',
  '--wird-pill': 'rgba(255,255,255,0.92)',
};
for (const t of Object.keys(PINNED)) eq('light ' + t + ' is the literal it replaced', LIGHT[t], PINNED[t]);
// ...and each must actually differ in dark, or it is not carrying its weight.
const notMoved = Object.keys(PINNED).filter((t) => DARK[t] == null || DARK[t] === PINNED[t]);
ok('...and every one of them has a DIFFERENT dark value', notMoved.length === 0, 'unchanged in dark: ' + notMoved.join(', '));

/* ========================= E. THE QUEST PAGE ============================= */
console.log('\n=== E. THE QUEST PAGE (\\u0643\\u0646\\u0648\\u0632 \\u0627\\u0644\\u0645\\u0639\\u0631\\u0641\\u0629) ===');
const q = cssOf(QUEST);
const qLight = palette((/:root\s*\{([^}]*)\}/.exec(q.css) || [, ''])[1]);
const qDark = palette((/:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(q.css) || [, ''])[1]);
ok('quest.html boots from the SAME theme key as the app',
  /localStorage\.getItem\('murabbi_theme_v1'\)/.test(q.html));
ok('...before first paint, so the journey never flashes light',
  q.html.indexOf("localStorage.getItem('murabbi_theme_v1')") < q.html.indexOf('<style>'));
ok('...and declares a dark palette', Object.keys(qDark).length > 0);
// Every COLOUR token in the light palette needs a dark counterpart. Radii, fonts and shadows do
// not, so only tokens whose light value is a colour are required to move.
const isColour = (v) => /^#|^rgba?\(/i.test(String(v).trim());
const qMissing = Object.keys(qLight).filter((t) => isColour(qLight[t]) && qDark[t] == null);
ok('every colour token in the light palette has a dark value', qMissing.length === 0, 'missing: ' + qMissing.join(', '));
ok('the status bar follows data-theme rather than hardcoding the sand paper',
  /getAttribute\("data-theme"\) === "dark"/.test(q.html));
// The reward skins are inline properties on <html> and MUST keep outranking the base palette.
ok('reward skins still override the base palette (inline properties on <html>)',
  /documentElement\.style\.setProperty\(k, t\.tokens\[k\]\)/.test(q.html));

/* ================= F. THE THREE DEFECTS THE PHONE VIDEO PROVED ==============
 * Each is asserted by what it actually depends on, not by looking for a string.
 * ------------------------------------------------------------------------ */
console.log('\n=== F. THE THREE DEFECTS FROM THE DEVICE VIDEO ===');

/* --- F1. the cold-start white flash -------------------------------------
 * Cause: per the HTML spec a <script> does not run until every PENDING STYLESHEET has
 * loaded. The boot script sat BELOW the Google Fonts link, so on a cold launch it waited
 * on the network and the UA painted white in the meantime. The invariant is positional,
 * and it is a real one: boot script strictly before the first external stylesheet.
 */
function headOrder(src) {
  // HTML comments are stripped FIRST. The comment above the boot script explains the rule by
  // quoting <link rel="stylesheet">, and a tag scanner reads its own prose as a real tag -- this
  // check failed on that exact self-reference before the strip was added. Both offsets are then
  // measured in the SAME stripped string, so the comparison stays valid.
  const head = src.slice(0, src.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, ' ');
  const boot = head.indexOf("localStorage.getItem('murabbi_theme_v1')");
  let firstSheet = -1;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    if (/rel\s*=\s*["']?stylesheet/i.test(m[0])) { firstSheet = m.index; break; }
  }
  return { boot, firstSheet };
}
const ordIdx = headOrder(html);
ok('F1: the theme boot script is inside <head>', ordIdx.boot !== -1);
ok('F1: it runs BEFORE any external stylesheet can block it',
  ordIdx.firstSheet === -1 || ordIdx.boot < ordIdx.firstSheet,
  'boot at ' + ordIdx.boot + ' but a <link rel=stylesheet> appears at ' + ordIdx.firstSheet
  + ' -- a script cannot execute until pending stylesheets load, so the app would paint white first');
ok('F1: the UA is told both schemes are supported before CSS parses',
  /<meta[^>]+name=["']color-scheme["'][^>]*>/i.test(html.slice(0, html.indexOf('</head>'))));

// Behavioural: actually RUN the boot script for each stored value and read the root back.
function runBoot(src, stored) {
  const m2 = /<script>\(function\(\)\{try\{var t=localStorage\.getItem\('murabbi_theme_v1'\)[\s\S]*?<\/script>/.exec(src);
  if (!m2) return null;
  const body = m2[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const { window: w } = parseHTML('<!DOCTYPE html><html><head><meta name="theme-color" content="#1D4ED8"></head><body></body></html>');
  w.localStorage = { getItem: () => stored, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 };
  vm.runInContext(body, vm.createContext(w), { filename: 'boot.js' });
  const d = w.document.documentElement;
  return { theme: d.getAttribute('data-theme'), scheme: d.style.colorScheme, bg: d.style.background,
    bar: w.document.querySelector('meta[name="theme-color"]').getAttribute('content') };
}
const VT_LIGHT_PAGES = (() => {
  const out = {};
  const re = /:root\[data-ezik-visual-theme="([a-z0-9_]+)"\]\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const p = /--vt-page:\s*(#[0-9A-Fa-f]{6})/.exec(m[2]);
    if (p) out[m[1]] = p[1].toUpperCase();
  }
  return out;
})();
const VT_LIGHT_PAGE_VALUES = Object.keys(VT_LIGHT_PAGES).map((k) => VT_LIGHT_PAGES[k]);
ok('F1: every identity declares a light --vt-page', VT_LIGHT_PAGE_VALUES.length > 0, JSON.stringify(VT_LIGHT_PAGES));
eq('F1: ...and they all declare the SAME one, so one boot literal can be right for all of them',
  VT_LIGHT_PAGE_VALUES.filter((v) => v !== VT_LIGHT_PAGE_VALUES[0]), []);
const BOOT_LIGHT_PAGE = VT_LIGHT_PAGE_VALUES[0] || String(LIGHT['--page']);
for (const stored of ['dark', 'light']) {
  const r = runBoot(html, stored);
  if (!ok('F1: the boot script is runnable for stored=' + stored, !!r)) continue;
  eq('F1: ...it sets data-theme=' + stored, r.theme, stored);
  eq('F1: ...it sets the UA colorScheme to ' + stored, r.scheme, stored);
  // The inline paint is what covers the gap before the stylesheet arrives, so it must BE the
  // page colour of that theme -- otherwise the first frame is the wrong dark/light shade.
  // ITEM 95 NARROWS THE LIGHT HALF. It compared against --page of the :root palette, and
  // that token has had NO READER since the visual identities landed: the mapping block
  // overwrites --page with var(--vt-page), and the identity attribute is written by the
  // very same boot script. So the old assertion pinned the first frame to a colour the app
  // never paints, which is precisely how the root came to sit on a pale blue while every
  // surface above it was white. It now compares against --vt-page, the value the app does
  // paint. The DARK half is unchanged and still compares against the base palette.
  const expectPage = (stored === 'dark') ? DARK['--page'] : BOOT_LIGHT_PAGE;
  const got = parseColor(String(r.bg).trim());
  ok('F1: ...and paints <html> with that theme\'s --page (' + expectPage + ')',
    got && hex(got).toLowerCase() === String(expectPage).toLowerCase(), 'painted ' + r.bg);
}
ok('F1: an unrecognised stored value still boots light', (runBoot(html, 'purple') || {}).theme === 'light');

/* --- F2. the Android system bars ----------------------------------------
 * A PWA cannot set the navigation bar directly. What the web CAN do is declare the scheme
 * and keep the root painted, and the runtime switch must move BOTH -- an inline style
 * outranks the stylesheet, so a stale inline paint would survive a theme change.
 */
ok('F2: the runtime switcher moves the UA colorScheme too',
  /applyTheme[\s\S]{0,700}?documentElement\.style\.colorScheme = v/.test(html));
ok('F2: ...and repaints the root, so no stale inline colour survives a switch',
  /applyTheme[\s\S]{0,900}?documentElement\.style\.background = \(v === 'dark'\)/.test(html));
// Drift guard: the two literals the boot/runtime code paints MUST stay equal to the tokens.
const bootDark = /d\.style\.background=\(t==='dark'\?'(#[0-9A-Fa-f]{6})':'(#[0-9A-Fa-f]{6})'\)/.exec(html);
if (ok('F2: the boot paint literals are readable', !!bootDark)) {
  eq('F2: boot dark paint == the dark --page token', bootDark[1].toUpperCase(), String(DARK['--page']).toUpperCase());
  eq('F2: boot light paint == the light page the identities actually paint',
    bootDark[2].toUpperCase(), BOOT_LIGHT_PAGE.toUpperCase());
}

/* --- F3. the quest celebration scrim -------------------------------------
 * Cause: the backdrop was color-mix(in srgb, var(--ink) 46%, transparent), and --ink INVERTS
 * with the theme, so in dark it dimmed with a light cream instead of darkening. Asserted by
 * RESOLVING the scrim in both palettes and measuring it: a scrim darkens in every theme.
 */
const qL = { ...qLight }, qD = { ...qLight, ...qDark };
const sheetRule = /\.sheet\s*\{([^}]*)\}/.exec(q.css);
ok('F3: the celebration/badge/result layer (.sheet) exists', !!sheetRule);
// pull the FIRST colour out of a value, understanding color-mix(in srgb, X p%, transparent)
function scrimBase(value, pal) {
  let v = String(value);
  for (let i = 0; i < 8 && v.indexOf('var(') !== -1; i++) {
    v = v.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^()]*))?\)/gi, (_, n, fb) => (pal[n] != null ? pal[n] : (fb || '')));
  }
  const mix = /color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-f]{3,6}|rgba?\([^)]*\))/i.exec(v);
  if (mix) return parseColor(mix[1]);
  const f = /(#[0-9a-f]{3,6}\b|rgba?\([^)]*\))/i.exec(v);
  if (!f) return null;
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(f[1]);
  if (rgba) { const p = rgba[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; }
  return parseColor(f[1]);
}
if (sheetRule) {
  const bgDecl = (/background\s*:\s*([^;]+)/i.exec(sheetRule[1]) || [, ''])[1];
  ok('F3: it dims through a dedicated token, not through a text colour',
    /var\(--scrim\)/.test(bgDecl) && !/var\(--ink\)/.test(bgDecl),
    'background: ' + bgDecl.trim());
  const sL = scrimBase(bgDecl, qL), sD = scrimBase(bgDecl, qD);
  ok('F3: the scrim resolves in LIGHT', !!sL);
  ok('F3: the scrim resolves in DARK', !!sD);
  // THE defect: in dark the base was #F3E9D8 (luminance ~0.82). A scrim must be dark in BOTH.
  if (sL) ok('F3: the LIGHT scrim darkens what is behind it', lum(sL) < 0.25, 'base ' + hex(sL) + ' luminance ' + lum(sL).toFixed(3));
  if (sD) ok('F3: the DARK scrim darkens too -- it is not a pale veil', lum(sD) < 0.25, 'base ' + hex(sD) + ' luminance ' + lum(sD).toFixed(3));
  // light must not have moved: the token's light value is the colour --ink used to resolve to
  eq('F3: the light scrim is the exact colour it always was', qLight['--scrim'], 'color-mix(in srgb,#2A2118 46%,transparent)');
}
ok('F3: every celebration window still goes through the one sheet() helper',
  (q.html.match(/function sheet\(/g) || []).length === 1 && (q.css.match(/\.sheet\s*\{/g) || []).length === 1,
  'more than one sheet implementation would mean a second, unchecked backdrop');
ok('F3: a reward skin no longer wipes the UA colorScheme off the root',
  /const scheme = document\.documentElement\.style\.colorScheme[\s\S]{0,300}?if \(scheme\)/.test(q.html));


/* ======================= G. THE VISUAL THEMES (S100) =====================
 * Three settings now exist and they are orthogonal:
 *   murabbi_theme_v1      light | dark              the colour MODE
 *   ezik_ui_style_v1      journey | deck            the home/adhkar LAYOUT
 *   ezik_visual_theme_v1  qibla_13 | istana_33      the visual IDENTITY
 * Everything below is measured from the SHIPPED artefact: the readers and writers are CALLED
 * in the same vm the styles object came out of, and every colour is resolved through the same
 * cascade the browser will resolve. Nothing here re-types a value that index.html declares,
 * except the approved token table, which is the point of it.
 * ---------------------------------------------------------------------- */
console.log('\n=== G. THE VISUAL THEMES: qibla_13 and istana_33 ===');

const VT_IDS = ['qibla_13', 'istana_33'];
// The approved light identity, byte for byte. This table is the specification; if a value here
// and a value in index.html disagree, index.html is wrong.
const VT_APPROVED = {
  qibla_13: { '--vt-page': '#FFFFFF', '--vt-surface': '#F8FBFA', '--vt-surface2': '#EDF3F1',
    '--vt-ink': '#123C37', '--vt-muted': '#5E716D', '--vt-accent': '#006B61', '--vt-accent2': '#C48A27',
    '--vt-line': '#D6E3DF', '--vt-radius': '18px', '--vt-radius-sig': '18px',
    '--vt-shadow': '0 16px 48px rgba(0,84,76,.10)' },
  // ITEM 95: the approved surface for istana_33 in LIGHT is now pure white. This table is the
  // specification and it is being changed deliberately, not relaxed: it still pins an exact
  // value, and index.html is still wrong if it disagrees by one digit.
  istana_33: { '--vt-page': '#FFFFFF', '--vt-surface': '#FFFFFF', '--vt-surface2': '#EEF6F7',
    '--vt-ink': '#10364E', '--vt-muted': '#647780', '--vt-accent': '#0B5F8E', '--vt-accent2': '#C43E38',
    '--vt-line': '#C8DDE2', '--vt-radius': '18px', '--vt-radius-sig': '120px 120px 18px 18px',
    '--vt-shadow': '0 18px 45px rgba(12,78,105,.12)' },
};
const VT_FONT = { qibla_13: 'Noto Kufi Arabic', istana_33: 'Noto Naskh Arabic' };

/* ---- G0. the blocks, parsed out of the shipped stylesheet ---------------- */
function vtBlocks(cssText) {
  const light = {}, dark = {};
  for (const m of cssText.matchAll(/:root\[data-ezik-visual-theme="([a-z0-9_]+)"\]\s*\{([^}]*)\}/gi)) light[m[1]] = palette(m[2]);
  for (const m of cssText.matchAll(/:root\[data-theme="dark"\]\[data-ezik-visual-theme="([a-z0-9_]+)"\]\s*\{([^}]*)\}/gi)) dark[m[1]] = palette(m[2]);
  const map = (/:root\[data-ezik-visual-theme\]\s*\{([^}]*)\}/.exec(cssText) || [, ''])[1];
  const a3map = (/:root\[data-ezik-visual-theme\][^{]*\.ezhome\s*\{([^}]*)\}/.exec(cssText) || [, ''])[1];
  return { light, dark, map: palette(map), a3map: palette(a3map), rawMap: map };
}
const VT = vtBlocks(css);
const A3_LIGHT = palette((/\.adhkar3\s*,\s*\.ezhome\s*\{([^}]*)\}/.exec(css) || [, ''])[1]);
let A3_DARK = {};
for (const m of css.matchAll(/:root\[data-theme="dark"\]\s+\.adhkar3[^{]*\{([^}]*)\}/g)) A3_DARK = { ...A3_DARK, ...palette(m[1]) };

// The palette a browser would resolve for one (identity, mode) pair, in cascade order.
function vtPalette(id, mode) {
  const dark = mode === 'dark';
  return { ...palette((/:root\s*\{([^}]*)\}/.exec(css) || [, ''])[1]),
    ...(dark ? DARK : {}), ...A3_LIGHT, ...(dark ? A3_DARK : {}),
    ...VT.light[id], ...(dark ? VT.dark[id] : {}), ...VT.map, ...VT.a3map };
}
const VT_PAL = {};
for (const id of VT_IDS) for (const mode of ['light', 'dark']) VT_PAL[id + ':' + mode] = vtPalette(id, mode);

/* ---- G1. the three keys are three keys ---------------------------------- */
const evalIn = (code) => vm.runInContext(code, CTX);
function withStore(store) { CTX.localStorage = store; }
const stubStore = (value) => ({ getItem: () => value, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 });
const throwStore = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); }, clear() {}, key: () => null, length: 0 };

let KEYS = null;
try { KEYS = { mode: evalIn('THEME_KEY'), visual: evalIn('EZIK_VISUAL_THEME_KEY') }; }
catch (err) { KEYS = null; }
if (!ok('the two remaining presentational keys are declared', !!KEYS,
  'THEME_KEY or EZIK_VISUAL_THEME_KEY is missing from the shipped block')) KEYS = { mode: '', visual: '' };
eq('the colour MODE key is unchanged', KEYS.mode, 'murabbi_theme_v1');
// S102: a PRE-RELEASE BUMP. v1 was never deployed, and the only devices holding it are the
// ones this session's own visual tests wrote qibla_13 onto -- which is why the app opened
// green. The new key is v2, and v1 is not read by anything.
eq('the visual identity key is the pre-release v2 key', KEYS.visual, 'ezik_visual_theme_v2');
ok('...and the two keys are different keys', KEYS.mode !== KEYS.visual);
// THE REGRESSION THIS EXISTS TO STOP: nothing may READ v1 again.
const v1Reads = (html.match(/getItem\(\s*['\"]ezik_visual_theme_v1['\"]\s*\)/g) || []).length
  + (html.match(/getItem\(EZIK_VISUAL_THEME_KEY_V1\)/g) || []).length;
eq('nothing reads the undeployed v1 key -- a stored qibla_13 cannot reach the app', v1Reads, 0);
ok('...and v1 is still named, so erasing data can delete it',
  /EZIK_VISUAL_THEME_KEY_V1 = 'ezik_visual_theme_v1'/.test(html)
  && /removeItem\(EZIK_VISUAL_THEME_KEY_V1\)/.test(html));
ok('...as is the obsolete layout key',
  /EZIK_UI_STYLE_KEY_DEAD = 'ezik_ui_style_v1'/.test(html)
  && /removeItem\(EZIK_UI_STYLE_KEY_DEAD\)/.test(html));
function recordWrite(expr) {
  const touched = [];
  withStore({ getItem: () => null, setItem: (k, v) => touched.push(k + '=' + v),
    removeItem: (k) => touched.push('-' + k), clear() {}, key: () => null, length: 0 });
  try { evalIn(expr); } catch (e) { touched.push('THREW:' + e.message); }
  return touched;
}
eq('choosing an identity writes ONLY the identity key',
  recordWrite('writeEzikVisualTheme("istana_33")'), ['ezik_visual_theme_v2=istana_33']);

/* ---- G2. the reader is total and the default is istana_33 --------------- */
eq('istana_33 is the declared default identity', evalIn('EZIK_VISUAL_THEME_DEFAULT'), 'istana_33');
eq('...and it is the id itself', evalIn('EZIK_VISUAL_THEME_ISTANA'), 'istana_33');
// S102: qibla_13 keeps its TOKEN groundwork in the stylesheet for the next batch, and has no
// constant, no accepted value and no control. It cannot be selected and cannot be stored.
ok('qibla_13 is not a reachable value in the app code', !/EZIK_VISUAL_THEME_QIBLA/.test(html));
function readVT(stored) { withStore(stubStore(stored)); return evalIn('readEzikVisualTheme()'); }
eq('a stored qibla_13 -- including the one the visual tests wrote -- resolves to istana_33', readVT('qibla_13'), 'istana_33');
eq('a saved istana_33 is returned', readVT('istana_33'), 'istana_33');
eq('an ABSENT key is istana_33 -- the never-saved default', readVT(null), 'istana_33');
eq('an unknown word fails safe to istana_33', readVT('ottoman'), 'istana_33');
eq('a layout word is not an identity', readVT('journey'), 'istana_33');
eq('a mode word is not an identity', readVT('dark'), 'istana_33');
eq('the wrong case is not the id', readVT('QIBLA_13'), 'istana_33');
eq('a value of the wrong type fails safe', readVT(13), 'istana_33');
withStore(throwStore);
eq('a storage that THROWS still yields istana_33', evalIn('readEzikVisualTheme()'), 'istana_33');
eq('...and the writer still returns a legal id when it cannot save', evalIn('writeEzikVisualTheme("istana_33")'), 'istana_33');
withStore(stubStore(null));
eq('the writer normalises an illegal id to the default', evalIn('writeEzikVisualTheme("nope")'), 'istana_33');
eq('the writer refuses qibla_13 and normalises it away', evalIn('writeEzikVisualTheme("qibla_13")'), 'istana_33');
eq('...and what lands on <html> is istana_33',
  evalIn('document.documentElement.getAttribute("data-ezik-visual-theme")'), 'istana_33');
eq('the writer accepts istana_33', evalIn('writeEzikVisualTheme("istana_33")'), 'istana_33');
eq('...and repaints the attribute',
  evalIn('document.documentElement.getAttribute("data-ezik-visual-theme")'), 'istana_33');

/* ---- G3. the layout system is GONE, not hidden -------------------------- */
// It was removed in the same commit that added these checks, after a reference sweep proved
// every symbol dead. Asserted by absence from the shipped file, which is the only way to tell
// 'removed' from 'still there behind a flag'.
for (const sym of ['EZIK_UI_STYLE_KEY ', 'EZIK_UI_STYLE_JOURNEY', 'EZIK_UI_STYLE_DECK', 'EZIK_UI_STYLE_EVENT',
  'readEzikUiStyle(', 'writeEzikUiStyle(', 'useEzikUiStyle(', 'EzikJourneyHome', 'EzikDeckHome',
  'EzHomeNav', 'EzHomeGreet', 'EzHomeCallout', 'A3_JOURNEY_NAME', 'A3_DECK_NAME', 'A3_STYLE_TITLE']) {
  ok('the legacy symbol ' + sym.trim() + ' is gone from the file', html.indexOf(sym) === -1);
}
// ...and so are the style keys only it read. Nothing may quietly keep drawing them.
for (const k of ['ezhContainer', 'ezhNav', 'ezhFab', 'ezhDeckCard', 'ezhPath', 'designRow', 'designOpt', 'prevBox']) {
  ok('the legacy style key ' + k + ' is gone', !s[k]);
}
ok('no journey/deck renderer is reachable from the home owner',
  /return <EzikIstanaHome \{\.\.\.home\} \/>;/.test(html)
  && !/EZIK_UI_STYLE_DECK \?/.test(html));

/* ---- G4. the identity is on <html> before the first paint --------------- */
function bootVT(src2, stored, v1) {
  const m2 = /<script>\(function\(\)\{try\{var t=localStorage\.getItem\('murabbi_theme_v1'\)[\s\S]*?<\/script>/.exec(src2);
  if (!m2) return null;
  const body = m2[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const { window: w } = parseHTML('<!DOCTYPE html><html><head><meta name="theme-color" content="#1D4ED8"></head><body></body></html>');
  // the boot script must read v2 ONLY: a device carrying the undeployed v1=qibla_13 (which is
  // exactly what the visual tests left behind) has to paint istana_33 anyway.
  w.localStorage = { getItem: (k) => (k === 'ezik_visual_theme_v2' ? stored : (k === 'ezik_visual_theme_v1' ? (v1 || null) : null)),
    setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 };
  vm.runInContext(body, vm.createContext(w), { filename: 'boot.js' });
  return w.document.documentElement.getAttribute('data-ezik-visual-theme');
}
for (const [stored, want] of [['istana_33', 'istana_33'], [null, 'istana_33'], ['qibla_13', 'istana_33'], ['journey', 'istana_33']]) {
  eq('boot: v2=' + String(stored) + ' paints istana_33 before first paint', bootVT(html, stored), want);
}
// THE DEFECT THAT MADE THE APP OPEN GREEN, asserted directly.
eq('boot: a device carrying the undeployed v1=qibla_13 still opens istana_33', bootVT(html, null, 'qibla_13'), 'istana_33');
eq('boot: ...even with v2 also holding a stale qibla_13', bootVT(html, 'qibla_13', 'qibla_13'), 'istana_33');
// Both offsets have to be measured in the SAME comment-stripped head, for the reason
// headOrder() documents: the prose above the boot script quotes <link rel="stylesheet">.
const vtHead = html.slice(0, html.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, ' ');
const vtSheet = (() => { for (const m of vtHead.matchAll(/<link\b[^>]*>/gi)) if (/rel\s*=\s*["']?stylesheet/i.test(m[0])) return m.index; return -1; })();
ok('the boot reader runs before any external stylesheet, like the mode reader',
  vtHead.indexOf('ezik_visual_theme_v2') !== -1 && (vtSheet === -1 || vtHead.indexOf('ezik_visual_theme_v2') < vtSheet),
  'reader at ' + vtHead.indexOf('ezik_visual_theme_v2') + ', first stylesheet at ' + vtSheet);

/* ---- G5. THE BACKGROUND INVARIANT -------------------------------------- */
// Every page root in light must be a plain, solid #FFFFFF: not near-white, not a gradient,
// not an image, not a wash, not a ::before. The tokens below are every token any full-height
// container in this app paints itself with.
const PAGE_TOKENS = ['--vt-page', '--page', '--a3-page', '--boot-bg', '--welcome-bg'];
for (const id of VT_IDS) {
  const pal = VT_PAL[id + ':light'];
  for (const t of PAGE_TOKENS) {
    const raw = pal[t];
    const c = resolve(raw, pal);
    ok(id + ' light ' + t + ' is exactly #FFFFFF', c && hex(c) === '#ffffff',
      'resolved ' + hex(c) + ' from ' + raw);
    ok(id + ' light ' + t + ' is a SOLID colour, not a gradient or an image',
      !/gradient|url\(|image-set|repeating|element\(/i.test(String(resolveRaw(raw, pal))),
      String(resolveRaw(raw, pal)));
  }
}
// ...and nothing in the theme blocks themselves can attach a pattern.
for (const id of VT_IDS) {
  for (const [what, block] of [['light', VT.light[id]], ['dark', VT.dark[id]]]) {
    const bad = Object.keys(block || {}).filter((k) => /gradient|url\(|repeating|image/i.test(String(block[k])));
    eq(id + ' ' + what + ' declares no pattern, image or gradient anywhere', bad, []);
  }
}
const bodyRule = /:root\[data-ezik-visual-theme\]\s+body\s*\{([^}]*)\}/.exec(css);
ok('the themed page root is painted by exactly one body rule', !!bodyRule);
if (bodyRule) {
  ok('...it paints a solid var(--vt-page)', /background\s*:\s*var\(--vt-page\)/.test(bodyRule[1]), bodyRule[1].trim());
  ok('...and turns any inherited background IMAGE off', /background-image\s*:\s*none/.test(bodyRule[1]), bodyRule[1].trim());
}
ok('no themed selector attaches a ::before/::after ornament to a page root',
  !/:root\[data-ezik-visual-theme\][^{]*(body|html)?\s*::?(before|after)\s*\{/i.test(css));

/* ---- G6. the approved token table, exactly ----------------------------- */
for (const id of VT_IDS) {
  const b = VT.light[id] || {};
  ok(id + ' declares a light identity block', Object.keys(b).length > 0);
  for (const t of Object.keys(VT_APPROVED[id])) eq(id + ' light ' + t, b[t], VT_APPROVED[id][t]);
  ok(id + ' carries its approved interface face (' + VT_FONT[id] + ')',
    String(b['--vt-font'] || '').indexOf(VT_FONT[id]) !== -1, String(b['--vt-font']));
}
// the identity namespace is separate from the roles it feeds: --ez-focus is not --a3-cyan and
// not --red-lift, and the signature radius is not the card radius.
ok('the focus ring has its own token, shared with no decoration',
  /--ez-focus\s*:/.test(css) && !/focus-visible\s*\{[^}]*var\(--a3-cyan\)/.test(css)
  && !/focus-visible\s*\{[^}]*var\(--red-lift\)/.test(css));
ok('...and every focus ring in the file reads it',
  (css.match(/:focus-visible\s*\{[^}]*outline[^}]*\}/g) || []).every((r) => /var\(--ez-focus\)/.test(r)),
  (css.match(/:focus-visible\s*\{[^}]*outline[^}]*\}/g) || []).filter((r) => !/var\(--ez-focus\)/.test(r)).join(' | '));
ok('the signature radius is a separate token from the card radius',
  /--vt-radius-sig\s*:/.test(css) && /--ez-radius-sig\s*:/.test(css));
eq('istana_33 is the identity that actually arches', VT.light.istana_33['--vt-radius-sig'], '120px 120px 18px 18px');
ok('...and one real component reads the signature radius',
  /\.ezist-masthead\{[^}]*border-radius:var\(--ez-radius-sig\)/.test(css),
  'the istana masthead is the component that arches; the legacy callout that used to read it is gone');

/* ---- G7. both identities have a dark face ------------------------------ */
for (const id of VT_IDS) {
  const d = VT.dark[id] || {};
  ok(id + ' declares a dark identity block', Object.keys(d).length > 0);
  const colours = Object.keys(VT.light[id]).filter((t) => /^#|^rgba?\(/i.test(String(VT.light[id][t])));
  const missingD = colours.filter((t) => d[t] == null);
  eq(id + ': every light colour token has a dark counterpart', missingD, []);
  const page = resolve(VT_PAL[id + ':dark']['--vt-page'], VT_PAL[id + ':dark']);
  ok(id + ' dark stays DARK', page && lum(page) < 0.08, 'page ' + hex(page));
}

/* ---- G8. contrast in all four renderings ------------------------------- */
// The Quran sheet is excluded by NAME and by REASON: every key below is drawn inside
// .mushaf-paper, which pins itself back to the base light tokens in every identity and every
// mode (proved in G10), so measuring it against an identity palette would measure a rendering
// that never happens.
const SHEET_KEYS = new Set(['svgRuleOuter', 'svgSheet', 'pgHeader', 'pgBasmala', 'pgAyah', 'pgSurahBox',
  'pgSurahName', 'pgMedal', 'pgFrameOuter', 'pgFrameInner', 'pgCorner', 'pgLine', 'pgWord', 'pgVerseNo']);
// The call screen is a dark room in every theme; the mute pill is light on it on purpose.
// KNOWN_LIGHT is carried over from group C for the same reason it exists there: memPlaceholder
// is placeholder text whose LIGHT contrast predates this work. Both identities in fact raise
// it (4.27:1 in istana_33 against the base value group C had to exempt at 3:1), but raising it
// the rest of the way would move a style key this phase has no business moving.
const VT_EXEMPT = new Set([...NO_TEXT, ...Object.keys(LIGHT_ON_PURPOSE), ...KNOWN_LIGHT, ...SHEET_KEYS]);
function threshold(st) {
  const fs2 = typeof st.fontSize === 'number' ? st.fontSize : parseFloat(st.fontSize);
  const fw = typeof st.fontWeight === 'number' ? st.fontWeight : parseInt(st.fontWeight, 10);
  if (fs2 >= 24) return 3;                                   // WCAG large text
  if (fs2 >= 18.66 && fw >= 700) return 3;                   // WCAG large bold text
  return 4.5;
}
for (const id of VT_IDS) {
  for (const mode of ['light', 'dark']) {
    const pal = VT_PAL[id + ':' + mode];
    const bad = [];
    for (const key of Object.keys(s)) {
      if (VT_EXEMPT.has(key)) continue;
      const st = s[key];
      if (!st || typeof st !== 'object') continue;
      const bgRaw = ['background', 'backgroundColor'].map((k) => st[k]).find((v) => v != null);
      const bg = resolve(bgRaw, pal), fg = resolve(st.color, pal);
      if (!bg || !fg) continue;
      const need = threshold(st), got = contrast(bg, fg);
      if (got < need) bad.push(key + ' ' + hex(bg) + '/' + hex(fg) + ' = ' + got.toFixed(2) + ' need ' + need);
    }
    eq(id + ' ' + mode + ': every text surface clears its WCAG ratio', bad, []);
  }
}
// The focus ring is the one thing a keyboard user has; it is measured against every surface it
// can land on, and 3:1 is the floor for a non-text indicator.
for (const id of VT_IDS) {
  for (const mode of ['light', 'dark']) {
    const pal = VT_PAL[id + ':' + mode];
    const ring = resolve(pal['--ez-focus'], pal);
    ok(id + ' ' + mode + ': the focus ring resolves', !!ring, String(pal['--ez-focus']));
    if (!ring) continue;
    const weak = ['--vt-page', '--vt-surface', '--vt-surface2'].filter((t) => {
      const c = resolve(pal[t], pal); return c && contrast(ring, c) < 3;
    }).map((t) => t + ' = ' + contrast(ring, resolve(pal[t], pal)).toFixed(2));
    eq(id + ' ' + mode + ': the focus ring clears 3:1 on every surface', weak, []);
  }
}

/* ---- G9. Settings states the active design; it no longer offers a choice --
 * S102: one reachable design, so the card is a STATEMENT. The failure this replaces is not
 * hypothetical -- the app opened green because a chooser existed and a test used it.
 * ---------------------------------------------------------------------- */
const vtSetStart = html.indexOf('const visualTheme = useEzikVisualTheme();');
const settingsRegion = vtSetStart === -1 ? '' : html.slice(vtSetStart, html.indexOf('{EZIK_A11Y_TITLE}', vtSetStart));
ok('the Settings screen was located', vtSetStart !== -1 && settingsRegion.length > 500,
  'region length ' + settingsRegion.length);
ok('Settings still offers both colour modes',
  /<Opt value="light"/.test(settingsRegion) && /<Opt value="dark"/.test(settingsRegion));
// JOURNEY AND DECK APPEAR NOWHERE.
okOn('Settings shows no Journey control', [["settingsRegion", settingsRegion]], !/Journey|JOURNEY|journey/.test(settingsRegion));
okOn('Settings shows no Deck control', [["settingsRegion", settingsRegion]], !/Deck|DECK|deck/.test(settingsRegion));
ok('...and the whole file offers no layout chooser', !/StyleOpt/.test(html));
// THE ACTIVE DESIGN IS STATED.
ok('Settings names the active application design', /\{EZ_VT_ISTANA\}/.test(settingsRegion));
ok('...as a state, not an option', /\{EZ_VT_ACTIVE\}/.test(settingsRegion));
// QIBLA IS NOT SELECTABLE. Not by pointer, not by keyboard, not by any code path.
ok('qibla_13 appears only as a disabled upcoming line',
  /\{EZ_VT_QIBLA\}/.test(settingsRegion) && /aria-disabled="true"/.test(settingsRegion));
const qibIdx = settingsRegion.indexOf('{EZ_VT_QIBLA}');
const qibRow = qibIdx === -1 ? '' : settingsRegion.slice(Math.max(0, qibIdx - 400), qibIdx + 200);
okOn('...with no radio role', [["qibRow", qibRow]], !/role="radio"/.test(qibRow));
okOn('...with no checked state', [["qibRow", qibRow]], !/aria-checked/.test(qibRow));
okOn('...with no click handler', [["qibRow", qibRow]], !/onClick/.test(qibRow));
okOn('...and it is not a button, so it cannot be tabbed to', [["qibRow", qibRow]], !/<button/.test(qibRow));
// and nothing anywhere can write it, because the value does not exist in the code.
// scoped to the APP BLOCK: the id is still a selector in <style>, which is the groundwork the
// next batch needs. What must not exist is a value the code can read, write or compare.
// comments are stripped first: a comment EXPLAINING that qibla_13 is unreachable is not a
// code path, and a check that cannot tell those apart would force the explanation out.
const appBlock = html.slice(html.indexOf('</style>'))
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
ok('no code path can produce qibla_13', !/qibla_13/.test(appBlock),
  'the id may live on in the stylesheet as groundwork, but not in the app block');
ok('the identity previews that fed the old chooser are gone with it',
  !/PREV_QIBLA|PREV_ISTANA|VtOpt/.test(html));
// the swatch tokens stay declared: the next batch needs them back.
for (const [pfx, want] of [['q', 'qibla_13'], ['i', 'istana_33']]) {
  eq('the ' + want + ' swatch groundwork is still declared', LIGHT['--vtp-' + pfx + '-page'], '#FFFFFF');
}

/* ---- G9b. the scope now comes from the shared shell, once ---------------
 * S105: Settings moved into EzShell/EzShellGroup, so the token scope is no longer a class on
 * each card -- it is on the shell root and on the group, in one place, for every tenant. The
 * S100 defect (a card mounted outside the scope, with an invisible checked state) is still the
 * thing being prevented; it is now prevented for every screen that adopts the shell at once.
 * ---------------------------------------------------------------------- */
ok('the shell root puts the token set in scope', /<div className="theme-dark ezhome" style=\{s\.ezshContainer\}>/.test(html));
ok('...and every group inside it is scoped too', /<div className="adhkar3" style=\{s\.ezshGroup\}>/.test(html));
ok('Settings renders THROUGH the shell, not beside it',
  /<EzShell title=\{A_SETTINGS\} onBack=\{onBack\} backLabel=\{A2_BACK\}>/.test(html));
ok('...and no longer draws the legacy full-width settings container',
  !/s\.settingsContainer/.test(html) && !/s\.settingsHeader/.test(html) && !/s\.settingsBody/.test(html));
ok('the shell column is bounded and centred', /\.ezsh-wrap\{[^}]*max-width:1100px[^}]*margin:0 auto/.test(css)
  && /\.ezsh-nav-inner\{[^}]*max-width:1100px[^}]*margin:0 auto/.test(css));
ok('...one column, and two only where the content earns it',
  /\.ezsh-grid\{[^}]*grid-template-columns:1fr/.test(css)
  && /@media \(min-width:900px\)\{[\s\S]{0,300}?\.ezsh-grid\{grid-template-columns:repeat\(2,1fr\)/.test(css));
ok('the shell owns no navigation state and invents no handler',
  /function EzShell\(\{ title, onBack, backLabel, actions, children \}\)/.test(html)
  && !/function EzShell[\s\S]{0,1200}?(useState|localStorage|setScreen|ezikGoBack)/.test(html));
ok('Settings keeps its own back handler', /onBack=\{onBack\}/.test(html));
// the shell is a page root too: nothing in its own rules may attach a pattern, and none of
// its selectors may reach html, body or :root.
const ezshRules = (css.match(/\.ezsh-[^{]*\{[^}]*\}/g) || []);
ok('the shell declares its own rules', ezshRules.length > 6);
eq('not one shell rule attaches an image, gradient or repeat',
  ezshRules.filter((r) => /background-image|gradient|url\(|repeating/i.test(r)), []);
ok('and no shell selector can match html, body or :root',
  !/(^|[,}\s])(html|body|:root)[^{,]*\.ezsh-/.test(css));
// every control the screen had, still here, with its own handler and accessible name.
const SET_CTRL = [
  ['light/dark', /<Opt value="light"/, /<Opt value="dark"/],
  ['text size', /role="radiogroup" aria-label=\{EZIK_A11Y_FS_LABEL\}/, /onClick=\{\(\) => onA11y\(\{ fontSize: v \}\)\}/],
  ['reading mode', /aria-checked=\{a11y\.reading/, /onClick=\{\(\) => onA11y\(\{ reading: !a11y\.reading \}\)\}/],
  ['reduced motion', /aria-checked=\{a11y\.reduceMotion/, /onClick=\{\(\) => onA11y\(\{ reduceMotion: !a11y\.reduceMotion \}\)\}/],
  ['a11y reset', /onClick=\{onA11yReset\}/, /\{EZIK_A11Y_RESET\}/],
  ['parental control', /onClick=\{onOpenControl\}/, /aria-label=\{A_CONTROL\}/],
  ['PIN change', /onClick=\{savePin\}/, /autoComplete="new-password"/],
];
for (const [name, a, b] of SET_CTRL) ok('Settings keeps its ' + name + ' control', a.test(html) && b.test(html));
// four: the font-size radios share one className in a map, plus the two switches and reset.
ok('...and the a11y controls are still keyboard-reachable buttons with the focus ring',
  (html.match(/className="ez-a11y-opt"/g) || []).length === 4 && /\.ez-a11y-opt:focus-visible/.test(css));
ok('the theme control still writes the SAME key with the SAME two values',
  /localStorage\.setItem\(THEME_KEY, v\)/.test(html) && /t === 'dark' \|\| t === 'light'/.test(html));
ok('the accessibility preferences are still profile-scoped',
  /ezikReadA11y\(ezikProfileKey\(/.test(html) && /EZIK_A11Y_KEY/.test(html));

const VT_CTRL = ['vtActiveRow', 'vtActiveMark', 'vtActiveName', 'vtActiveState', 'vtSoonRow', 'vtSoonName', 'vtSoonTag'];
for (const k of VT_CTRL) ok('the active-design card uses the shipped key ' + k, !!s[k]);
{
  const u = { ...palette((/:root\s*\{([^}]*)\}/.exec(css) || [, ''])[1]), ...VT.light.istana_33, ...VT.map };
  const dead = [['vtActiveRow.background', s.vtActiveRow.background], ['vtActiveRow.border', s.vtActiveRow.border],
    ['vtActiveMark.background', s.vtActiveMark.background], ['vtActiveName.color', s.vtActiveName.color]]
    .filter(([, v]) => resolve(v, u) !== null).map(([kk]) => kk);
  eq('outside that scope every one of them resolves to nothing -- the S100 defect, recorded', dead, []);
}
for (const mode of ['light', 'dark']) {
  const pal = VT_PAL['istana_33:' + mode];
  const surf = resolve(s.vtActiveRow.background, pal);
  const mark = resolve(s.vtActiveMark.background, pal);
  const name = resolve(s.vtActiveName.color, pal);
  const state = resolve(s.vtActiveState.color, pal);
  const tag = 'istana_33 ' + mode + ': ';
  ok(tag + 'the active row resolves', !!surf, String(s.vtActiveRow.background));
  ok(tag + 'the active mark is visible on it', !!mark && !!surf && contrast(mark, surf) >= 3,
    mark && surf ? hex(mark) + ' on ' + hex(surf) + ' = ' + contrast(mark, surf).toFixed(2) : 'unresolved');
  ok(tag + 'the design name clears 4.5:1', !!name && !!surf && contrast(name, surf) >= 4.5,
    name && surf ? hex(name) + ' on ' + hex(surf) + ' = ' + contrast(name, surf).toFixed(2) : 'unresolved');
  ok(tag + 'the state line clears 4.5:1', !!state && !!surf && contrast(state, surf) >= 4.5,
    state && surf ? hex(state) + ' on ' + hex(surf) + ' = ' + contrast(state, surf).toFixed(2) : 'unresolved');
}

/* ---- G10. every implemented screen inherits the identity --------------- */
// Not asserted by looking for a class name: each screen is measured by RESOLVING the background
// it actually paints, first with no identity and then with each one. A screen that did not
// inherit would resolve to the same colour in all three, and that is the failure.
const SCREENS = {
  'launch / loading': 'onboardingContainer',
  'first-run welcome': 'welcomeContainer',
  'home': 'ezistContainer',
  'chat': 'chatContainer',
  'voice call': 'callContainer',
  'adhkar (v1)': 'adhkarContainer',
  'adhkar (v2)': 'adhkar2Container',
  'adhkar browse / dhikr': 'eziaContainer',
  'adhkar reader': 'eziaReadContainer',
  'quran index / mushaf shell': 'pgViewport',
  'memorisation': 'memContainer',
  'ezik memory (saved answers)': 'favScreen',
  'parent area': 'dashboardContainer',
  'settings': 'settingsContainer',
};
const BASE_LIGHT_PAL = { ...LIGHT };
for (const label of Object.keys(SCREENS)) {
  const key = SCREENS[label];
  const st = s[key];
  if (!ok('screen present: ' + label + ' (' + key + ')', !!st)) continue;
  const raw = ['background', 'backgroundColor'].map((k) => st[k]).find((v) => v != null);
  ok('...' + label + ' paints itself from a token, never a literal',
    raw != null && /var\(/.test(String(raw)), String(raw));
  const base = resolve(raw, BASE_LIGHT_PAL);
  for (const id of VT_IDS) {
    const got = resolve(raw, VT_PAL[id + ':light']);
    ok('...' + label + ' inherits ' + id, got && base && hex(got) !== hex(base),
      'base ' + hex(base) + ' and ' + id + ' ' + hex(got) + ' are the same colour, so the identity does not reach this screen');
  }
}
// ...and the one surface that must NOT follow the identity: the Quran sheet.
const sheetRuleVT = /:root\[data-ezik-visual-theme\]\s+\.mushaf-paper\s*\{([^}]*)\}/.exec(css);
ok('the Quran sheet opts OUT of the identity, as it opts out of dark', !!sheetRuleVT);
if (sheetRuleVT) {
  const pinned = palette(sheetRuleVT[1]);
  const darkPin = palette((/:root\[data-theme="dark"\]\s+\.mushaf-paper\s*\{([^}]*)\}/.exec(css) || [, ''])[1]);
  const drift = Object.keys(darkPin).filter((t) => t !== 'color-scheme' && pinned[t] !== darkPin[t]);
  eq('...pinned to the SAME literals the dark opt-out pins it to', drift, []);
  eq('...including the interface face, so the sheet keeps its own type', pinned['--ez-ui-font'], "'Tajawal', sans-serif");
}

/* ---- G11. still one element per home module ---------------------------- */
// S101: THREE home renderers now -- journey, deck and istana -- and still exactly one module
// element apiece. The number is the count of renderers, so adding a fourth without a matching
// map, or drawing a module twice inside one of them, both land here.
const modAttrs = (html.match(/data-ezik-home-module=/g) || []).length;
eq('one home renderer, one module element each -- no duplicated module', modAttrs, 1);
ok('...and it maps the owner\'s single descriptor array',
  (html.match(/mods\.map\(\(m/g) || []).length === 1,
  'found ' + (html.match(/mods\.map\(\(m/g) || []).length + ' maps of the module array');
ok('no identity rule can add a second copy of a module',
  !/data-ezik-visual-theme[^{]*\{[^}]*content\s*:/i.test(css));

/* ---- G12. knowledge treasures follows the identity too ----------------- */
const qVT = vtBlocks(q.css);
// S104: quest.html was still reading v1 after the app moved to v2, so a device carrying the
// undeployed qibla_13 opened the journey green while the app opened istana. It reads v2 now,
// and the SAME way the app does: one accepted value, everything else istana_33.
ok('quest.html reads the pre-release v2 key before its first paint',
  q.html.indexOf('ezik_visual_theme_v2') !== -1 && q.html.indexOf('ezik_visual_theme_v2') < q.html.indexOf('<style>'));
eq('...and nothing on that page reads v1', (q.html.match(/ezik_visual_theme_v1/g) || []).length, 0);
ok('...and qibla_13 is not an accepted value there either',
  !/getItem\('ezik_visual_theme_v2'\)[^;]*qibla_13/.test(q.html));
for (const id of VT_IDS) {
  ok('quest.html declares ' + id + ' (light)', Object.keys(qVT.light[id] || {}).length > 0);
  ok('quest.html declares ' + id + ' (dark)', Object.keys(qVT.dark[id] || {}).length > 0);
  eq('quest.html ' + id + ' page is plain white in light', qVT.light[id]['--vt-page'], '#FFFFFF');
}
const qBody = /:root\[data-ezik-visual-theme\]\s+body\s*\{([^}]*)\}/.exec(q.css);
ok('quest.html paints its themed page from --vt-page', !!qBody && /background\s*:\s*var\(--vt-page\)/.test(qBody[1]));
ok('...and drops the two radial washes it paints without a theme',
  !!qBody && /background-image\s*:\s*none/.test(qBody[1]),
  'the base palette keeps its washes; a visual identity must not');
// A reward skin sets this page's OWN tokens inline on <html>, which outranks any stylesheet.
// The page background survives that only because it is painted from --vt-page, a token no skin
// declares. If the body rule ever went back to --paper, a skin would repaint the page.
ok('...so a reward skin cannot put a wash back behind the page',
  !!qBody && !/var\(--paper/.test(qBody[1]), String(qBody && qBody[1]).trim());

/* ===================== H. THE ISTANA_33 HOME (S101) ======================
 * The first pass made the identities palettes that composed over the legacy journey/deck home.
 * They are not: an identity is a design. This group proves that under istana_33 the app builds
 * a DIFFERENT COMPONENT with a different structure, that neither legacy home is constructed for
 * it, that qibla_13 is untouched by that change, and that the new structure has the parts the
 * design actually calls for -- because "it has a new component" is not the same claim as
 * "it has a top nav, a masthead, a mosaic, a Quran panel and a chat entry".
 * ---------------------------------------------------------------------- */
console.log('\n=== H. THE ISTANA_33 HOME: a structure, not a reskin ===');

const HSTART = '// ---- S101 ISTANA HOME START';
const HEND = '// ---- S101 ISTANA HOME END';
const hAt = html.indexOf(HSTART), hEndAt = html.indexOf(HEND);
ok('the istana home is delimited so it can be read as one unit', hAt !== -1 && hEndAt > hAt);
const IST = hAt === -1 ? '' : html.slice(hAt, hEndAt);

/* ---- H1. the identity chooses the component ---------------------------- */
ok('EzikIstanaHome exists', /function EzikIstanaHome\(/.test(IST));
ok('the owner renders it unconditionally', /return <EzikIstanaHome \{\.\.\.home\} \/>;/.test(html));
// The legacy homes must not be CONSTRUCTED for istana: the istana return has to come first.
ok('there is no legacy switch left to be reached', html.indexOf('EZIK_UI_STYLE_DECK ?') === -1);
okOn('neither legacy home is rendered inside the istana component', [["IST", IST]],
  !/<EzikDeckHome/.test(IST) && !/<EzikJourneyHome/.test(IST));
// ...and qibla_13 still gets exactly what it had before this batch.
// S102: there is no other home to route to. EzikIstanaHome is the whole of the answer.
ok('EzikIstanaHome is the ONLY reachable home', /return <EzikIstanaHome \{\.\.\.home\} \/>;/.test(html)
  && !/<EzikDeckHome|<EzikJourneyHome/.test(html));

/* ---- H2. the parts the design calls for -------------------------------- */
ok('it has a real TOP NAVIGATION bar', /<EzistTopNav /.test(IST) && /className="ezist-nav"/.test(IST));
ok('...bounded and centred rather than loose across the viewport',
  /\.ezist-nav-inner\{[^}]*max-width:1100px[^}]*margin:0 auto/.test(css));
// S118 -- TWO ELEMENTS AND NO THIRD. This asserted FOUR actions in the bar: home (which had no
// handler at all, because it pointed at the screen already showing), chat, settings, and a
// profile entry whose onClick was character for character the settings entry's. The bar now
// carries the daily verse and one button, and those four actions live in the menu that button
// opens -- where two of them already were. The check is not relaxed: it is the shape itself,
// asserted member by member and then ordered on its own line, plus a sweep proving the removed
// names survive nowhere.
{
  const NAV = IST.slice(IST.indexOf('function EzistTopNav'), IST.indexOf('function EzistMasthead'));
  ok('the bar was located as one unit', NAV.length > 200 && NAV.length < 3000, 'len=' + NAV.length);
  // S119: this pinned the two in ONE order -- verse, then button -- and the order is precisely
  // what item 58 changed, so an order-shaped regex would have had to be DELETED for the fix to
  // land. It is narrowed to the members instead, and it did not lose bite: the inner block is
  // cut out and must hold one button and one panel AND NOTHING ELSE, which is a stricter reading
  // of 'exactly two' than the regex it replaces gave. What the order meant is asserted on its
  // own two lines below, where it can say why it is the right and not the left.
  const INNER = (NAV.match(/<div className="ezist-nav-inner">([\s\S]*?)\r?\n\s*<\/div>/) || [])[1] || '';
  ok('...carrying exactly two elements: the daily verse and the menu button',
    (INNER.match(/<button /g) || []).length === 1
    && (INNER.match(/<EzistQuranPanel \/>/g) || []).length === 1
    && INNER.replace(/<button [\s\S]*?<\/button>/, '').replace(/<EzistQuranPanel \/>/, '').trim() === '',
    'the bar holds one button and one verse panel and no third thing');
  // S119 -- AND THE BUTTON IS THE FIRST OF THE TWO. The document lays out RTL, so the first
  // child of this row sits on the RIGHT. The button was second, and therefore on the left, which
  // is the trailing edge and the wrong side of an Arabic bar; the owner asked for the right.
  ok('...the menu button FIRST, so the RTL leading edge -- the right -- is where it sits',
    INNER.indexOf('<button ') < INNER.indexOf('<EzistQuranPanel />'));
  // ...and moved in the TREE. `order` or `row-reverse` would paint it on the right while leaving
  // it second in the document, so the tab ring and the screen reader would run against the eye.
  // The composition block promises no `order` anywhere in it; this is what holds that promise.
  ok('...and moved in the tree, not faked with order or flex-direction',
    !/\.ezist-nav(-inner)?\{(?:[^}]*[;{])?\s*(order|flex-direction):/.test(css)
    && !/ezistNavBtn: \{(?:[^}]*[,{])?\s*order:/.test(html));
  eq('...and exactly one of them is a control', (NAV.match(/<button/g) || []).length, 1);
  ok('...whose handler is the menu opener it was handed, named «القائمة»',
    /onClick=\{onOpenMenu\}[\s\S]{0,120}aria-label=\{EZH_NAV_MENU\}/.test(NAV)
    && /function EzistTopNav\(\{ onOpenMenu \}\)/.test(NAV));
  // THE MENU IT OPENS IS THE CHAT'S. Not a second drawer: the owner hands it App's own opener,
  // and App renders the one ezikDrawer() on the home branch as well as the chat's.
  // S118: the menu paints ONLY tokens, and the two screens that draw it declare them on
  // different elements -- --a3-* on .ezhome, --ezc-scrim on .ezc. Drawn beside <Home/> it is
  // inside neither, and every var() resolves to nothing: a panel with no surface and a scrim
  // with no dim, which is what the first render of the lift actually produced. The one element
  // that names both classes is what makes the menu look the same from either screen.
  ok('...and it carries the token carriers, or it paints nothing on the home',
    /const ezikDrawer = \(\) => drawerOpen && \(\s*\r?\n\s*<div className="ezhome ezc">\s*\r?\n\s*<div onClick=\{\(\) => closeDrawerWith\(null\)\} className="ezc-drawer-ov" \/>/.test(html),
    'the menu must sit inside .ezhome (for --a3-*) and .ezc (for --ezc-scrim)');
  ok('...and neither token is written as a literal to work around that',
    /\.ezc-drawer-ov\{[^}]*background:var\(--ezc-scrim\)\}/.test(css)
    && /\.ezc-drawer\{[^}]*background:var\(--a3-surface\)/.test(css));
  ok('...and that opener is the app\'s ONE drawer, not a parallel one built for the home',
    /<Home profile=\{profile\} onOpenMenu=\{openDrawer\}/.test(html)
    && (html.match(/const ezikDrawer = \(\) => drawerOpen && \(/g) || []).length === 1
    && (html.match(/\{ezikDrawer\(\)\}/g) || []).length === 2
    && (html.match(/<div className="ezc-drawer" role="dialog" aria-modal="true">/g) || []).length === 1);
  // The four removed names are GONE, not left behind as identifiers nothing renders.
  ok('...and the four controls it dropped survive nowhere in the file',
    !/EZH_ICON_NAV_HOME\b/.test(html.replace(/\/\/[^\n]*/g, ''))
    && !/EZH_ICON_NAV_CHAT_LINE\b/.test(html.replace(/\/\/[^\n]*/g, ''))
    && !/EZH_ICON_NAV_SET\b/.test(html.replace(/\/\/[^\n]*/g, ''))
    && !/EZH_ICON_PROFILE\b/.test(html.replace(/\/\/[^\n]*/g, ''))
    && !/className="ezist-nav-side"/.test(html) && !/className="ezist-brand"/.test(html));
}
// THE OLD BOTTOM DOCK IS NOT ON THIS HOME. EzHomeNav is what draws it, and it is not used here.
okOn('the legacy bottom dock is NOT presented on the istana home', [["IST", IST]],
  !/<EzHomeNav/.test(IST) && !/s\.ezhNav\b/.test(IST) && !/s\.ezhFab\b/.test(IST),
  'EzHomeNav / ezhNav / ezhFab must not appear inside the istana home');
ok('...and the component that drew it no longer exists at all', html.indexOf('function EzHomeNav') === -1);

ok('it has an OTTOMAN MASTHEAD', /<EzistMasthead /.test(IST) && /className="ezist-masthead"/.test(IST));
ok('...whose arch IS the approved signature radius',
  /\.ezist-masthead\{[^}]*border-radius:var\(--ez-radius-sig\)/.test(css));
eq('...which under istana_33 is the approved 120px arch', VT.light.istana_33['--vt-radius-sig'], '120px 120px 18px 18px');
okOn('the masthead carries NO emblem -- item 100 removed the tulip at the owner\'s request', [["IST", IST]],
  !/className="ezist-tulip"/.test(IST) && !/\.ezist-tulip/.test(css));
// The masthead is still the box that clips, which is what kept the emblem inside it and what
// keeps everything else inside it now.
ok('...and the masthead still clips, so nothing inside it can paint outside it',
  /\.ezist-masthead\{[^}]*overflow:hidden/.test(css));
ok('...and no .ezist-tulip selector survives anywhere in the sheet, with or without a literal colour',
  (css.match(/\.ezist-tulip/g) || []).length === 0 && html.indexOf('ezist-tulip') === -1);
ok('the greeting and the daily line are the ones the app already picked',
  /\{EZH_SALAM\}/.test(IST) && /\{EZH_HELLO\} \{name\}/.test(IST) && /\{g\.text\}/.test(IST));

ok('the modules are a real MOSAIC, not a stack', /className="ezist-mosaic"/.test(IST) && /\.ezist-mosaic\{[^}]*display:grid/.test(css));
ok('...one column on a phone', /\.ezist-mosaic\{[^}]*grid-template-columns:1fr/.test(css));
ok('...two from 600px', /@media \(min-width:600px\)\{[\s\S]{0,400}?\.ezist-mosaic\{grid-template-columns:repeat\(2,1fr\)/.test(css));
ok('...six from 1000px', /@media \(min-width:1000px\)\{[\s\S]{0,700}?\.ezist-mosaic\{grid-template-columns:repeat\(6,1fr\)/.test(css));
ok('...inside a centred maximum width, so it is never loose on a desktop',
  /\.ezist-wrap\{[^}]*max-width:1100px[^}]*margin:0 auto/.test(css));
ok('...and no element is reordered away from its DOM position',
  // the boundary matters: 'border' and 'box-sizing:border-box' both CONTAIN 'order', so the
  // property has to be the first thing in the rule or follow a semicolon/space.
  !/\.ezist-[a-z-]*\{(?:[^}]*[;\s])?order\s*:/.test(css),
  'an order property would put the tab order out of step with the reading order');
// FOUR MODULES, FOUR TREATMENTS -- not four identical rows.
const treatments = ['ezistCard_adhkar', 'ezistCard_memorize', 'ezistCard_treasure', 'ezistFeature'];
for (const t of treatments) ok('a distinct treatment exists: ' + t, !!s[t]);
ok('the treatment is chosen by the descriptor\'s own id', /m\.id === \'mushaf\'/.test(IST) && /s\[\'ezistCard_\' \+ m\.id\]/.test(IST));
// NO GIANT EMPTY CARD: every card renders an icon, a title AND a line of text, and none of them
// is given a fixed height that could outrun its content.
ok('every module card carries a title and a subtitle, not just an icon',
  /\{m\.label\}/.test(IST) && /\{EZIST_SUB\[m\.id\]\}/.test(IST));
for (const id of ['memorize', 'adhkar', 'mushaf', 'treasure']) ok('...and ' + id + ' has one', !!evalIn('EZIST_SUB["' + id + '"]'));
const tall = ['ezistCard', 'ezistFeature', 'ezistAsk', 'ezistQuran'].filter((k) => typeof (s[k] || {}).height === 'number' || ((s[k] || {}).minHeight || 0) > 140);
eq('no card is pinned to a height its content cannot fill', tall, []);
// ...and the OTHER way a card goes empty, which the height check could not see and a 1440px
// screenshot could: a card wide enough that its one cluster of content sits against a single
// edge with a void beside it. Two things prevent it -- the content is spread to both ends, and
// there is ALWAYS something at the far end, the real reading or the chevron.
// Item 64. ONE SPACING VALUE FOR THE MOSAIC, and one is the whole point: the mushaf card used
// to declare '16px 18px' and a gap of 14 while its four neighbours declared '14px' and 12, so
// the mushaf section carried more air around its content than any other -- measured at 430x932,
// and it is the gap the owner reported. This pins the values EQUAL rather than pinning a number,
// so the rhythm can be retuned later in one move and can never again drift apart card by card.
eq('every module card declares the same inner spacing as the feature card',
  [s.ezistCard.padding, s.ezistCard.gap], [s.ezistFeature.padding, s.ezistFeature.gap]);
ok('...and the feature card still keeps its own SIZE and its own arch, which are not spacing',
  s.ezistFeature.minHeight > s.ezistCard.minHeight
    && s.ezistFeature.borderRadius === '40px 40px 18px 18px');
for (const k of ['ezistCard', 'ezistFeature', 'ezistAsk']) {
  eq('a wide ' + k + ' spreads its content to both ends', (s[k] || {}).justifyContent, 'space-between');
}
ok('a module with no reading still ends in an affordance, never in blank card',
  /\{m\.meta \? <span style=\{s\.ezistMeta\}>\{m\.meta\}<\/span>[\s\S]{0,80}?: <span style=\{s\.ezistGo\}/.test(html),
  'the meta/affordance pair is what fills the trailing edge at every width');
ok('...and no module column is wide enough to strand its content on a desktop',
  /@media \(min-width:1000px\)\{[\s\S]{0,700}?\.ezist-mod,\.ezist-feature\{grid-column:span 2\}/.test(css),
  'four modules at span 2 of six is 348px at the 1100px maximum; span 3 and span 4 measured empty');

ok('the daily verse has its own bounded panel', /<EzistQuranPanel \/>/.test(IST) && /className="ezist-quran"/.test(IST));
// S118: it is drawn ONCE, and in the top bar rather than as the mosaic's last cell. The panel
// itself did not change -- same component, same source, same verbatim text, asserted below as
// before -- so what moved is where it is mounted and nothing else.
eq('...drawn exactly once', (IST.match(/<EzistQuranPanel \/>/g) || []).length, 1);
// S119: this pinned the panel to the line straight after the bar's opening tag, and that is an
// ORDER pin, not a placement one: item 58 put the menu button on that line so the RTL leading
// edge would carry it, and the verse moved down one. What this check is NAMED for is WHERE the
// panel is mounted, so it is asserted as that and nothing more -- the ONE occurrence (counted
// on the line above) falls inside EzistTopNav. It did not lose bite: a panel moved out of the
// bar fails it, and the mosaic exclusion it carries is untouched.
okOn('...and that once is inside the top bar', [["IST", IST]],
  IST.indexOf('<EzistQuranPanel />') > IST.indexOf('<div className="ezist-nav-inner">')
  && IST.indexOf('<EzistQuranPanel />') < IST.indexOf('function EzistMasthead')
  && !/<EzistModuleCard key=\{m\.id\} m=\{m\} \/>\)\}\s*\r?\n\s*<EzistQuranPanel/.test(IST));
okOn('...as a DISPLAY: no handler, no role and no tabindex on it', [["IST", IST]],
  !/<EzistQuranPanel[^>]*on[A-Z]/.test(IST)
  && !/<section className="ezist-quran"[^>]*(role=|tabIndex=|onClick=)/.test(IST));
ok('...reading the SAME single source the legacy card reads', /const v = getDailyVerse\(\);/.test(IST));

/* ---- V. ITEM 120-A: THE DAILY VERSE COMES FROM THE SEALED MUSHAF ------- */
// WHAT STOOD HERE: nothing. The card was fed by a 30-row array typed by hand into index.html,
// and NOTHING compared a single character of it to the mushaf. Three of the thirty did not
// match the verse they cited, and two of those were wrong WORDS, not wrong spelling -- 4:32
// carried the wording of 33:40, and 12:64 opened with a waw where the verse has a fa.
// Displayed Qur'anic text that nothing checks is the one thing in this application that cannot
// be allowed to drift, and a seal on the mushaf file could never have caught it: the mushaf was
// never wrong. What was wrong was a hand-written copy of it that nothing compared back.
//
// SO THE ROWS ARE COMPARED, EVERY RUN, CHARACTER FOR CHARACTER. Each ayah row must be a
// VERBATIM substring of the sealed verse at the reference it names. An excerpt is allowed --
// the card has always shown one -- but it must be an excerpt OF THOSE BYTES. The first
// differing character fails this, names the reference, and prints both sides.
{
  const dvPath = path.join(path.dirname(path.resolve(INDEX)), 'assets/daily-verses.json');
  const qPath = path.join(path.dirname(path.resolve(INDEX)), 'quran-uthmani.json');
  const haveData = fs.existsSync(dvPath), haveQuran = fs.existsSync(qPath);
  ok('DV1: the generated daily-verse file is on disk', haveData, dvPath);
  ok('DV1: ...and the sealed mushaf it was generated from is too', haveQuran, qPath);
  if (haveData && haveQuran) {
    const DV = JSON.parse(fs.readFileSync(dvPath, 'utf8'));
    const QU = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    // The generator recorded which mushaf it read. If that file is ever re-cut, this stops
    // matching and the rows are regenerated rather than silently kept against a moved source.
    // require()d here rather than at the top: `crypto` is already a name in this file, bound to
    // the browser webcrypto shim the shipped block runs against, and shadowing that at module
    // scope would hand the application code a Node module.
    const qDigest = require('crypto').createHash('sha256').update(fs.readFileSync(qPath)).digest('hex');
    eq('DV1: ...and the digest the generator recorded is that file', DV.source_sha256, qDigest);

    // THE ARRAY IN THE SHIPPED BLOCK IS THAT FILE. Two copies of a table is one copy too many;
    // this is the line that stops them parting.
    let shipped = null;
    try { shipped = evalIn('DAILY_VERSES'); } catch (e) { shipped = null; }
    if (!ok('DV2: the shipped block still declares DAILY_VERSES', Array.isArray(shipped))) {
      // nothing below can mean anything without it
    } else {
      eq('DV2: ...and it holds exactly as many rows as the generated file', shipped.length, DV.rows.length);
      const drift = [];
      for (let i = 0; i < Math.min(shipped.length, DV.rows.length); i++) {
        const a = shipped[i], b = DV.rows[i];
        if (a.text !== b.text || a.surah !== b.surah || a.ayah !== b.ayah
          || String(a.ref) !== String(b.ref) || a.kind !== b.kind) drift.push(i + 1);
      }
      ok('DV2: ...and every row is that file row for row', drift.length === 0,
        'rows that differ from assets/daily-verses.json: ' + drift.join(', ')
        + '\n        Regenerate; do not hand-edit either side.');
    }

    // THE CLAIM ITSELF.
    let bad = 0, checked = 0, carried = 0;
    for (const r of DV.rows) {
      if (r.kind !== 'ayah') { carried++; continue; }
      checked++;
      const verse = QU[r.ref];
      if (verse === undefined) {
        bad++;
        ok('DV3: ' + r.ref + ' is a reference the sealed mushaf has', false,
          'the row cites a verse that is not in quran-uthmani.json');
        continue;
      }
      if (verse.indexOf(r.text) === -1) {
        bad++;
        let k = 0;
        while (k < r.text.length && k < verse.length && r.text[k] === verse[k]) k++;
        ok('DV3: ' + r.ref + ' is verbatim from the sealed mushaf', false,
          'the row text is NOT a substring of the sealed verse.'
          + '\n        first difference at character ' + k
          + '\n        row    : ' + JSON.stringify(r.text)
          + '\n        sealed : ' + JSON.stringify(verse)
          + '\n        Qur\'anic text is COPIED from the sealed file, never typed and never fixed by hand.');
      }
    }
    ok('DV3: every ayah row is verbatim from the sealed mushaf (' + checked + ' checked, '
      + carried + ' non-Qur\'an row carried through)', bad === 0);

    // The one row that is NOT scripture must stay visibly not-scripture: the card branches on
    // surah === 'hadith' to change its label, so a row that lost that marker would be presented
    // to the reader as a verse of the Qur'an.
    const others = DV.rows.filter((r) => r.kind !== 'ayah');
    ok('DV4: the non-Qur\'an row is marked as such and keeps the marker the card branches on',
      others.length === 1 && others[0].surah === '\u062D\u062F\u064A\u062B'
      && others[0].ref === undefined,
      'the hadith row is ' + JSON.stringify(others));
    ok('DV4: ...and it makes no claim on the sealed file',
      others.every((r) => r.kind === 'other'));

    // NO HAND-WRITTEN ARRAY SURVIVES. The block must say what it is.
    ok('DV5: the shipped array declares itself generated',
      /GENERATED -- DO NOT EDIT BY HAND/.test(html));
    ok('DV5: ...and the rotation still takes a local day index, with no network and no model call',
      /const getDailyVerse = \(\) => \{/.test(html)
      && /DAILY_VERSES\[dayOfYear % DAILY_VERSES\.length\]/.test(html));
    const rotAt = html.indexOf('const getDailyVerse');
    const rot = rotAt === -1 ? '' : html.slice(rotAt, rotAt + 400);
    okOn('DV5: ...and it reaches for nothing outside itself', [['rot', rot]],
      !/fetch\(|XMLHttpRequest|\/api\/|await /.test(rot));
  }
}

ok('...and rendering the text verbatim', /<div style=\{s\.ezistQuranText\}>\{v\.text\}<\/div>/.test(IST),
  'the Quran text must be printed as it is read -- no transform, no slice, no ellipsis');
// no decorative mark may overlap the text: the marks live in the head row and the rule, both of
// which are siblings of the text block, and nothing in this panel is absolutely positioned.
ok('no mark is positioned over the Quran text',
  !/ezistQuran(Text|Meta)[^}]*position: \'absolute\'/.test(html));

// ---- 105: THE DOT IS GONE, AND IT MAY NOT COME BACK ----
// The second half of the check above used to assert that the dot EXISTED and was cyan. The
// owner ruled it out: it was an unconditional span, aria-hidden, driven by no state, and
// nothing in the app ever turned it off. So the assertion is inverted rather than deleted --
// a removal with no guard behind it is a removal that comes back.
ok('105: the verse panel header carries no decorative dot',
  !/ezistQuranDot/.test(html),
  'the dot returned — as a style key, a span, or both');
ok('105: ...and the header row holds exactly one child, the title',
  /<div style=\{s\.ezistQuranHead\}>\s*<span style=\{s\.ezistQuranLabel\}>[\s\S]*?<\/span>\s*<\/div>/.test(IST),
  'something else was put back into the header row');
// THE HEADER DID NOT MOVE. The dot occupied 8px and stood in the row's 8px gap; MEASURED at
// 430x932, the title's leading edge (its RIGHT edge -- the page is RTL) was at 346 before and
// is at 346 after, because those 16px went back as padding. Losing this line would slide the
// title 16px without anything else looking wrong.
ok('105: ...and the title still starts at the pixel it always did',
  /ezistQuranHead: \{[^}]*paddingInlineStart: 16/.test(html),
  'the 16px the dot and its gap occupied is no longer being held');

// S117: this used to read `/<EzistAsk /.test(IST) && /className="ezhome-focus ezist-ask"/`, and
// that pinned ONE element rather than the thing the check is named for. The home offered two ways
// into the chat -- the small icon in the top nav and a large "ask Ezik" panel at the head of the
// mosaic, both calling the same onOpenChat -- and the panel was removed. What this gate protects
// has not changed: the composition must offer a way into the chat. It is now asserted as what it
// means, so a future rearrangement is judged on the invariant and not on a class name.
{
  // S118 -- WHAT THIS CHECK PROTECTS HAS NOT CHANGED: the composition must offer a way into the
  // chat. What changed is that the way is no longer a control on this screen's own chrome. The
  // bar's menu button opens the app's ONE menu, and that menu's «محادثة جديدة» row is the app's
  // ONE new-conversation entry -- it always was; S118 only made it navigate as well as reset, so
  // it does from the home what it already did from the chat. Asserted as the route, end to end.
  // Read with the prose taken out: the note that RECORDS the removal names the handler, and a
  // scan that counted it would be answered by deleting the explanation rather than the defect.
  const ISTCODE = IST.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, ' ');
  eqOn('the composition holds no chat handler of its own', [["IST", IST]], (ISTCODE.match(/onOpenChat/g) || []).length, 0);
  ok('...because the one way in is the menu the bar opens',
    /function EzistTopNav\(\{ onOpenMenu \}\)/.test(IST)
    && /className="ezist-nav"[\s\S]*?onClick=\{onOpenMenu\}[\s\S]*?<\/div>\s*\r?\n\s*\);/.test(IST));
  ok('...and that menu lands on the chat, through ONE handler that resets and navigates',
    /const startChatFromMenu = \(\) => \{ newChat\(\); setScreen\('chat'\); \};/.test(html)
    && (html.match(/closeDrawerWith\(startChatFromMenu\)/g) || []).length === 1
    && html.indexOf('const newChat = () => { resetThread(); };') !== -1);
  // ...and the panel is GONE, not hidden and not faked: no element, no class, no CSS rule, and
  // no comment left behind carrying the strings this check used to look for.
  ok('...and the removed panel survives nowhere',
    !/EzistAsk/.test(html) && !/ezist-ask/.test(html) && !/ezist-ask/.test(css));
}
// S118: the callback the composition calls unchanged is the opener it is handed.
ok('...calling the existing callback unchanged', /onClick=\{onOpenMenu\}/.test(IST));
// not the legacy floating circle, and not a slab: a surface panel with one bounded accent box.
ok('...as a surface panel, not a solid accent rectangle',
  /var\(--a3-surface\)/.test(String(s.ezistAsk.background)) && (s.ezistAskGo || {}).width === 46,
  'ezistAsk background is ' + String(s.ezistAsk.background));

/* ---- H3. the identity still obeys the background invariant -------------- */
// Group G already proves the page tokens; this proves the NEW rules cannot smuggle one in.
const ezistRules = (css.match(/\.ezist-[^{]*\{[^}]*\}/g) || []);
ok('the istana home declares its own rules', ezistRules.length > 8);
const patterned = ezistRules.filter((r) => /background-image|gradient|url\(|repeating/i.test(r));
eq('not one istana rule attaches an image, gradient or repeat', patterned, []);
ok('and no istana selector can match html, body or :root',
  !/(^|[,}\s])(html|body|:root)[^{,]*\.ezist-/.test(css) && !/\.ezist-[^{,]*\s+(html|body)\b/.test(css));
// every colour in the new keys is a token, so the identity (and dark) reaches all of it.
const ezistKeys = Object.keys(s).filter((k) => k.indexOf('ezist') === 0);
ok('the istana home has its own style keys', ezistKeys.length >= 20, 'found ' + ezistKeys.length);
const lit = [];
for (const k of ezistKeys) for (const p of Object.keys(s[k])) {
  const v = String(s[k][p]);
  if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v)) lit.push(k + '.' + p + '=' + v);
}
eq('no istana style key carries a hardcoded colour -- every one is a token', lit, []);
// ...and therefore dark mode gets the SAME structure on the dark palette, which is measured by
// group G8 over every key in `s`. Asserted here as the structural half of that claim:
ok('the istana container paints itself from the page token, in both modes',
  /var\(--a3-page\)/.test(String(s.ezistContainer.background)));
for (const mode of ['light', 'dark']) {
  const pal = VT_PAL['istana_33:' + mode];
  const bg = resolve(s.ezistContainer.background, pal);
  ok('istana home page in ' + mode + ' resolves', !!bg, String(s.ezistContainer.background));
  if (mode === 'light') ok('...and light is exactly #FFFFFF', hex(bg) === '#ffffff', hex(bg));
  else ok('...and dark stays dark', lum(bg) < 0.08, hex(bg));
}
// text-size and reduced motion: sizes are numbers (the scaler only rewrites numeric fontSize),
// and this block introduces no animation or transition at all.
const notNum = ezistKeys.filter((k) => s[k].fontSize != null && typeof s[k].fontSize !== 'number');
eq('every istana font size is a number, so the text-size preference scales it', notNum, []);
const moving = ezistKeys.filter((k) => s[k].animation || s[k].transition);
eq('the istana home animates nothing, so reduced motion has nothing to switch off', moving, []);
// S118: this read ">= 5" while the bar held four buttons of its own. A floor is the wrong shape
// for the claim -- it passes just as happily when a control is added WITHOUT the ring. It is now
// the claim itself: every button the composition draws carries it, however many there are.
// The module card builds its class as an expression, so the ring is matched by NAME and not by
// the literal `className="` that precedes it on the other two.
okOn('...and its controls carry the shared focus ring class', [["IST", IST]],
  (IST.match(/ezhome-focus/g) || []).length === (IST.match(/<button/g) || []).length,
  (IST.match(/ezhome-focus/g) || []).length + ' rings for ' + (IST.match(/<button/g) || []).length + ' buttons');

/* ================== I. THE ISTANA ADHKAR CATALOGUE (S103) =================
 * The rejected screen was an overlapping stack followed by a grid of identical squares. Both
 * legacy browse designs and both legacy readers are DELETED in the commit that added this
 * group, so "reachable" is proved by absence, not by a flag. What replaces them has to be a
 * catalogue with real hierarchy -- and it has to render every category the owner hands it,
 * exactly once, in the owner's own order, with the owner's own handler.
 * ---------------------------------------------------------------------- */
console.log('\n=== I. THE ISTANA ADHKAR CATALOGUE ===');

const IA_START = '// ---- S103 ISTANA ADHKAR START';
const IA_END = '// ---- S103 ISTANA ADHKAR END';
const iaAt = html.indexOf(IA_START), iaEndAt = html.indexOf(IA_END);
ok('the istana adhkar block is delimited', iaAt !== -1 && iaEndAt > iaAt);
const IA = iaAt === -1 ? '' : html.slice(iaAt, iaEndAt);

/* ---- I1. the legacy presentation is gone -------------------------------- */
for (const sym of ['AdhkarJourneyHome', 'AdhkarDeckHome', 'AdhkarJourneyReader', 'AdhkarDeckReader',
  'adhkarMostUsed', 'function A3Bar', 'a3Container', 'a3DeckCard', 'a3Path', 'a3Stage']) {
  ok('the legacy adhkar symbol ' + sym + ' is gone', html.indexOf(sym) === -1);
}
ok('the browse owner renders the istana catalogue', /return <IstanaAdhkarBrowse \{\.\.\.view\} \/>;/.test(html));
ok('the reader owner renders the istana shell', /return <IstanaAdhkarReader \{\.\.\.view\} \/>;/.test(html));
ok('...and neither owner branches: the return is unconditional',
  !/return [a-zA-Z]+ === [A-Z_]+ ? <(Istana|Adhkar)/.test(html));

/* ---- I2. every category, exactly once, from the owner's one array -------- */
// The split is positional and total: featured is the head, rest is the tail, and the two are
// slices of the SAME array at the same index. There is no filter, no dedupe and no second
// source, so featured.length + rest.length === list.length by construction.
ok('the featured head and the catalogue tail are slices of the one array',
  /const featured = list\.slice\(0, EZIA_FEATURED\);/.test(IA) && /const rest = list\.slice\(EZIA_FEATURED\);/.test(IA));
okOn('...and nothing re-orders, ranks or filters them here', [["IA", IA]],
  !/\.sort\(|\.filter\(|adhkarMostUsed/.test(IA));
ok('each category is rendered by exactly one map over each slice',
  (IA.match(/featured\.map\(/g) || []).length === 1 && (IA.match(/rest\.map\(/g) || []).length === 1);
ok('...and every rendered category carries its own store id',
  (IA.match(/data-ezia-cat=\{c\.id\}/g) || []).length === 2,
  'one on the featured card, one on the catalogue card -- counting these elements counts categories');
okOn('...opened through the owner\'s handler, never a local one', [["IA", IA]],
  (IA.match(/onClick=\{\(\) => onOpen\(c\)\}/g) || []).length === 2 && !/setSelected|bumpAdhkarUsage/.test(IA));
okOn('the standing comes from the shipped helper, not a recount', [["IA", IA]],
  (IA.match(/a3CatStanding\(prog, c, byCat\)/g) || []).length === 2 && !/adhkarCatDone\(/.test(IA));

/* ---- I3. the structure the design calls for ----------------------------- */
ok('it has the istana top header', /className="ezia-nav"/.test(IA) && /\.ezia-nav-inner\{[^}]*max-width:1100px/.test(css));
ok('...with the same brand-arch language as the home', /className="ezia-brand-arch"/.test(IA));
ok('it has a bounded arched masthead', /className="ezia-masthead"/.test(IA)
  && /\.ezia-masthead\{[^}]*border-radius:var\(--ez-radius-sig\)/.test(css)
  && /\.ezia-masthead\{[^}]*overflow:hidden/.test(css));
okOn('...carrying the REAL daily ring, not a decorative one', [['IA', IA]],
  /role="progressbar"[\s\S]{0,200}?aria-valuenow=\{shown\}/.test(IA) && /Math\.min\(done, goal\)/.test(IA));

/* ---- I3-ب. ITEM 43-أ: THE CHAIN, AND THE NUMBER THE READER CHOSE ---------
 * The ring used to be measured against a constant. It is measured against the reader's own
 * goal now, and the constant survives only as the value that goal DEFAULTS to -- so a screen
 * that quietly went back to the constant would be presenting a target nobody chose.
 */
okOn('43-أ: the ring is measured against the READER\'S goal, not a constant', [['IA', IA]],
  /const shown = Math\.min\(done, goal\);/.test(IA)
  && /\(shown \/ goal\)/.test(IA)
  && /aria-valuemax=\{goal\}/.test(IA)
  && !/ADHKAR_DAILY_GOAL/.test(IA),
  'the fixed goal is back on this screen');
// The chooser is a real group of real controls, and the pressed one says so.
okOn('43-أ: the goal is chosen from the presets, in a labelled group', [['IA', IA]],
  /role="group" aria-label=\{A3_GOAL_PICK\}/.test(IA)
  && /ADHKAR_GOAL_PRESETS\.map/.test(IA)
  && /aria-pressed=\{goal === n \? 'true' : 'false'\}/.test(IA)
  && /onClick=\{\(\) => onGoal\(n\)\}/.test(IA));
// A LAPSE IS NOT PUNISHED. The chain row draws a number and a word; there is no red anywhere in
// its styles, and no second sentence for a chain that stopped -- the zero case is an INVITATION
// (A3_CHAIN_START), which is also what a first-time reader sees.
okOn('43-أ: the chain is drawn, and its number is the run', [['IA', IA]],
  /\{toArabicDigits\(run\)\}/.test(IA) && /A3_CHAIN_TITLE/.test(IA));
okOn('43-أ: ...and a chain that lapsed is neither red nor scolded', [['IA', IA]],
  /run > 0 \? A3_CHAIN_DAYS : A3_CHAIN_START/.test(IA)
  && !/A3_CHAIN_(?:LOST|BROKEN|MISSED|FAIL)/.test(IA),
  'a second, worse sentence was added for the day the chain stopped');
// Every chain style resolves to a token this screen declares in BOTH modes -- the group C
// contrast sweep above already proves the pair, so this only proves they are TOKENS.
for (const k of ['eziaChainNum', 'eziaChainWord', 'eziaGoalLabel', 'eziaGoalChip', 'eziaGoalChipOn']) {
  ok('43-أ: ' + k + ' takes its colour from a token, not a literal',
    !isColour(String((s[k] || {}).color || 'var(--x)'))
    && !isColour(String((s[k] || {}).background || 'var(--x)')));
}
// ZERO NOTIFICATIONS. A scheduled reminder needs the native shell; it is not in this build, so
// nothing may promise one -- not a permission request, not a Notification, not a scheduler, and
// not a word of copy on this screen that implies the app will come and find the reader.
ok('43-أ: nothing in the app asks for, schedules or sends a notification',
  !/Notification\s*\(/.test(html)
  && !/Notification\.requestPermission/.test(html)
  && !/showTrigger|periodicSync|pushManager|serviceWorker\.ready[\s\S]{0,80}showNotification/.test(html),
  'a notification path appeared -- item 43-أ ships zero of them');
// ITEM 108-أ brought a requestPermission into this file that is NOT a notification's: the
// orientation sensor's, called from inside the qibla panel's own press. The blanket substring
// sweep that used to stand here would now report a notification path that does not exist, so it
// is replaced by a NAMED one -- every requestPermission CALL in the shipped file must be that
// sensor's. That is a stronger statement than the sweep, not a relaxed one: a Notification
// permission request would still fail it, and so would any third caller.
eq('43-أ: ...and every requestPermission call in the file is the orientation sensor\'s',
  (html.match(/[A-Za-z0-9_.$]*requestPermission\s*\(/g) || [])
    .filter((x) => x !== 'DOE.requestPermission(').join(', '), '');
okOn('43-أ: ...and the chain says nothing about being reminded', [['IA', IA]],
  !/A3_CHAIN_(?:REMIND|NOTIFY)/.test(IA));
ok('featured groups are their own presentation', /<IstanaAdhkarFeature /.test(IA) && !!s.eziaFeature);
ok('...and the rest are a responsive catalogue',
  /className="ezia-catalogue"/.test(IA) && /\.ezia-catalogue\{[^}]*display:grid/.test(css));
ok('...two columns on a phone', /\.ezia-catalogue\{[^}]*grid-template-columns:repeat\(2,1fr\)/.test(css));
ok('...three from 600px', /@media \(min-width:600px\)\{[\s\S]{0,300}?\.ezia-catalogue\{grid-template-columns:repeat\(3,1fr\)/.test(css));
ok('...four from 1000px', /@media \(min-width:1000px\)\{[\s\S]{0,300}?\.ezia-catalogue\{grid-template-columns:repeat\(4,1fr\)/.test(css));
ok('...inside a centred maximum width', /\.ezia-wrap\{[^}]*max-width:1100px[^}]*margin:0 auto/.test(css));
// varied but coherent: a crest, a coral variant, an emblem, a completed state.
for (const k of ['eziaCard', 'eziaCardDone', 'eziaFeature', 'eziaEmblem', 'eziaEmblemDone', 'eziaCount', 'eziaGo']) {
  ok('the catalogue treatment ' + k + ' exists', !!s[k]);
}
ok('the crest is a bounded card band', /\.ezia-crest\{[^}]*position:absolute/.test(css));
ok('...with a restrained coral variant', /\.ezia-crest-coral\{[^}]*var\(--a3-cyan\)/.test(css));
ok('the emblem is a bounded geometric star', /\.ezia-star\{[^}]*width:20px/.test(css));
// no giant empty card: every card carries a title, a count and a trailing affordance, and the
// content is spread rather than clustered at one edge.
ok('every card shows its title and its real count', /\{c\.title\}/.test(IA) && /toArabicDigits\(c\.count\)/.test(IA));
eq('the card foot spreads its content', (s.eziaCardFoot || {}).justifyContent, 'space-between');
eq('...as does the card head', (s.eziaCardHead || {}).justifyContent, 'space-between');
const iaTall = ['eziaCard', 'eziaFeature'].filter((k) => typeof (s[k] || {}).height === 'number' || ((s[k] || {}).minHeight || 0) > 200);
eq('no catalogue card is pinned taller than its content', iaTall, []);

/* ---- I4. the reader keeps every protected action ------------------------ */
const IA_ACTIONS = [
  ['back', /onClick=\{v\.onBack\}/], ['favourite', /onClick=\{v\.onFav\}/], ['share', /onClick=\{v\.onShare\}/],
  ['previous', /onClick=\{v\.onPrev\}/], ['onward', /onClick=\{v\.onNext\}/], ['count', /onClick=\{v\.onCount\}/],
  ['audio', /<A3AudioBtn d=\{d\} playing=\{v\.playing\} onAudio=\{v\.onAudio\}/],
];
for (const [name, re] of IA_ACTIONS) ok('the reader keeps its ' + name + ' action', re.test(IA));
ok('the dhikr text is still a text child of the panel', /<div style=\{s\.eziaReadText\}>\{d\.text\}<\/div>/.test(IA),
  'no transform, no slice, no pass of any kind over the stored text');
ok('the counter still reports the real count over the real target',
  /toArabicDigits\(v\.count\)\} \/ \{toArabicDigits\(v\.target\)/.test(IA));
ok('the position still reports the real index over the real length',
  /toArabicDigits\(v\.idx \+ 1\)\} \/ \{toArabicDigits\(len\)/.test(IA));
ok('the live region is in the tree from the first render', /role="status" aria-live="polite"/.test(IA));
ok('the favourite still announces its pressed state', /aria-pressed=\{v\.isFav/.test(IA));
ok('the search row is the shipped one, with the shipped handler', /<A3Search query=\{query\} setQuery=\{setQuery\} \/>/.test(IA));
ok('back is the owner\'s back', /onClick=\{onBack\}/.test(IA));

/* ---- I5. the background invariant reaches this screen too --------------- */
const eziaRules = (css.match(/\.ezia-[^{]*\{[^}]*\}/g) || []);
ok('the adhkar catalogue declares its own rules', eziaRules.length > 8);
eq('not one of them attaches an image, gradient or repeat',
  eziaRules.filter((r) => /background-image|gradient|url\(|repeating/i.test(r)), []);
ok('and no adhkar selector can match html, body or :root',
  !/(^|[,}\s])(html|body|:root)[^{,]*\.ezia-/.test(css) && !/\.ezia-[^{,]*\s+(html|body)\b/.test(css));
const eziaKeys = Object.keys(s).filter((k) => k.indexOf('ezia') === 0);
ok('the adhkar screens have their own style keys', eziaKeys.length >= 25, 'found ' + eziaKeys.length);
const iaLit = [];
for (const k of eziaKeys) for (const p of Object.keys(s[k])) {
  const v = String(s[k][p]);
  if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v)) iaLit.push(k + '.' + p + '=' + v);
}
eq('no adhkar style key carries a hardcoded colour', iaLit, []);
const iaNotNum = eziaKeys.filter((k) => s[k].fontSize != null && typeof s[k].fontSize !== 'number');
eq('every adhkar font size is a number, so text scaling reaches it', iaNotNum, []);
eq('the adhkar screens animate nothing', eziaKeys.filter((k) => s[k].animation || s[k].transition), []);
for (const mode of ['light', 'dark']) {
  const bg = resolve(s.eziaContainer.background, VT_PAL['istana_33:' + mode]);
  if (mode === 'light') ok('the adhkar page is exactly #FFFFFF in light', bg && hex(bg) === '#ffffff', hex(bg));
  else ok('...and stays dark in dark', bg && lum(bg) < 0.08, hex(bg));
}

/* =============== J. THE ISTANA QUEST CATEGORY MAP (S104) =================
 * The rejected screen had rainbow rosette category badges and an emoji tab bar. Neither is a
 * data question, and neither may come back. The bank itself is sealed by quest-ux-guard, which
 * byte-compares every quest-data file; this group proves the PRESENTATION changed and that it
 * changed without touching an id, a count, a destination or a handler.
 * ---------------------------------------------------------------------- */
console.log('\n=== J. THE ISTANA QUEST CATEGORY MAP ===');

// the rosette was hue-driven. That is the thing that must be gone.
// comments stripped first: the comment recording WHY the hue is no longer read is not a read.
const qCode = q.html.replace(/^[ \t]*\/\/.*$/gm, ' ');
ok('the category medallion no longer colours itself from r.hue',
  !/r\.hue/.test(qCode) && !/hsl\(/.test(qCode),
  'a per-region hue is what made the map a row of differently coloured flowers');
ok('...and draws in the identity tokens instead',
  /medal\(r, locked\)[\s\S]{0,1400}?var\(--lapis\)/.test(q.html));
ok('...as a bounded arch medallion inside its own viewBox',
  /medal\(r, locked\)[\s\S]{0,1400}?viewBox="0 0 100 100"/.test(q.html));
ok('the region card carries a bounded arch crest',
  /el\("span", "crest"\)/.test(q.html) && /\.region \.crest\{[^}]*position:absolute/.test(q.css)
  && /\.region\{[^}]*overflow:hidden/.test(q.css));
ok('...and the completed mark is a stroke on a chip, not a trophy sticker',
  /chest-done/.test(q.html) && !/\uD83C\uDFC6/.test(q.html.slice(q.html.indexOf('_regionCard'), q.html.indexOf('_regionCard') + 1400)));

// the tab bar: same four tabs, same destinations, no emoji.
ok('the navigation glyphs are stroked line icons', /const NAV_ICON = \{/.test(q.html) && /NAV_SVG\(/.test(q.html));
const navBlock = q.html.slice(q.html.indexOf('function drawNav()'), q.html.indexOf('function drawNav()') + 1200);
okOn('...and the old emoji tab glyphs are gone from it', [["navBlock", navBlock]],
  !/[\u{1F300}-\u{1FAFF}]/u.test(navBlock), 'an emoji remains in the tab bar');
for (const [id, dest] of [['map', 'Screens.map'], ['challenge', 'Screens.challenges'], ['book', 'Screens.book'], ['me', 'Screens.profile']]) {
  ok('the ' + id + ' tab still goes to ' + dest, navBlock.indexOf('"' + id + '"') !== -1 && navBlock.indexOf(dest) !== -1);
}
ok('...and the tab still reports which one is current', /aria-current", String\(TAB === id\)/.test(navBlock));

// the catalogue stays contained, and nothing is painted behind the page.
ok('the map catalogue is centred and bounded', /\.map\{[^}]*max-width:1100px/.test(q.css));
ok('...and lays out in four columns on a desktop', /@media \(min-width:1000px\)\{\.map\{grid-template-columns:repeat\(4,1fr\)/.test(q.css));
const regionRules = (q.css.match(/\.region[^{]*\{[^}]*\}/g) || []);
eq('no region rule attaches an image, gradient or repeat',
  regionRules.filter((r) => /background-image|url\(|repeating/i.test(r)), []);

// THE DATA. Ids, counts and destinations are read, never written, by the presentation.
ok('the card still reads the region id it was handed', /data-region", r\.id/.test(q.html));
ok('the card still reports the real station count', /ar\(sts\.length\) \+ " \u0645\u062D\u0637\u0651\u0627\u062A/.test(q.html));
// scoped to the card itself: the same call appears on the region screen, so an unscoped
// test would keep passing while the CARD stopped reporting the real number.
const cardSrc = q.html.slice(q.html.indexOf('_regionCard(r) {'), q.html.indexOf('_regionCard(r) {') + 1600);
ok('...and the real question count', /Data\.regionQuestions\(r\.id\)\.length/.test(cardSrc));
// EVERY region the world hands over gets a card: no slice, no filter, no take-n between the
// data and the map. A dropped region is a category the child can never reach.
ok('every region in the world data gets exactly one card',
  /\(w\.regions \|\| \[\]\)\.forEach\(r => g\.appendChild\(Screens\._regionCard\(r\)\)\);/.test(q.html),
  'the map must map the world own array, unsliced and unfiltered');
ok('...and the card builder is called from exactly one place',
  (q.html.match(/Screens\._regionCard\(/g) || []).length === 1);
ok('...and the real star standing', /P\.regionStars\(r\.id\)/.test(q.html) && /P\.regionPct\(r\.id\)/.test(q.html));
ok('...and opens the region it names', /b\.onclick = \(\) => Screens\.region\(r\.id\)/.test(q.html));
ok('the presentation writes no progress of its own',
  !/_regionCard[\s\S]{0,1600}?P\.(set|save|add|award)/.test(q.html));

/* ============ K. THE REACHABLE-SCREEN INVENTORY (S105) ====================
 * The identity was being applied screen by screen, and "which screens are left" was being
 * answered from memory. It is answered here instead, from the shipped file: every screen the
 * render switch can reach is enumerated by PARSING it, and compared against a declared table
 * that records, for each one, whether it is inside an istana shell yet.
 *
 * The table is not documentation. A screen the file can reach and the table does not name is a
 * FAILURE -- that is what stops a new screen being added without anyone deciding what design it
 * is in, and it is what stops this inventory going stale the moment it is written. The reverse
 * is a failure too: a table entry the file can no longer reach is a claim about a screen that
 * does not exist.
 *
 * `shell` is the measured status, not an aspiration:
 *   istana  -- draws inside a dedicated istana structure
 *   legacy  -- still draws its pre-identity presentation, and is therefore outstanding work
 *   sacred  -- the ONE approved opt-out: the Quran sheet itself. Its surrounding controls are
 *              NOT covered by it and are listed separately.
 * ---------------------------------------------------------------------- */
console.log('\n=== K. THE REACHABLE-SCREEN INVENTORY ===');

const INDEX_SCREENS = {
  // S115: the last four. Each is classified istana because the checks in group Q pass, not
  // because someone edited these lines; Q1 asserts every one of those bindings directly.
  loading:         { render: 'inline loadingScreen -> .ezload mark', shell: 'istana' },
  onboarding:      { render: 'Onboarding / Welcome -> .ezonb card', shell: 'istana' },
  home:            { render: 'Home -> EzikIstanaHome', shell: 'istana' },
  fatwa:           { render: 'FatwaScreen -> .ezf shell + official result cards', shell: 'istana' },
  // S112: the chat body moved onto its own istana structure -- .ezc-rail / .ezc-scroll /
  // .ezc-dock / .ezc-drawer. It is classified istana because the checks in group N pass, not
  // because someone edited this line; N1 asserts that binding directly.
  chat:            { render: 'the chat body (App fall-through) -> .ezc rail + transcript + dock + drawer', shell: 'istana' },
  parentGate:      { render: 'ParentGate -> .ezgate card', shell: 'istana' },
  parentDashboard: { render: 'ParentDashboard -> .ezparent rail + cards', shell: 'istana' },
  settings:        { render: 'SettingsSheet -> EzShell', shell: 'istana' },
  // S114: the saved answers moved onto their own istana structure -- .ezfav-rail / .ezfav-masthead
  // / .ezfav-cat. Classified istana because the checks in group P pass, not because someone edited
  // this line; P1 asserts that binding directly.
  favorites:       { render: 'FavoritesScreen -> .ezfav rail + masthead + catalogue', shell: 'istana' },
  // S113: the voice room moved onto its own istana structure -- .ezcall-rail / .ezcall-stage /
  // .ezcall-dock. It is classified istana because the checks in group O pass, not because someone
  // edited this line; O1 asserts that binding directly. The three INTERSTITIALS standing in front
  // of this screen did NOT move and are still legacy below.
  call:            { render: 'CallScreen -> .ezcall rail + stage + dock', shell: 'istana' },
  // S107: the drill moved too, so the caveat is gone -- and it is gone because the checks in
  // group L6 pass, not because someone deleted the field.
  memorize:        { render: 'MemorizeScreen picker + drill -> EzShell', shell: 'istana' },
  // S110: the reader's chrome moved too, so the caveat is gone -- and it is gone because the
  // checks in group M pass, not because someone deleted the field.
  mushaf:          { render: 'MushafScreen index -> EzShell; reader -> .ezmr rail + dock', shell: 'istana' },
  adhkar:          { render: 'AdhkarScreen -> IstanaAdhkarBrowse / IstanaAdhkarReader', shell: 'istana' },
};
// Screens the switch reaches WITHOUT a screen key of their own -- guards and gates in front of
// another screen. They are reachable, so they are inventoried.
const INDEX_INTERSTITIALS = {
  // S115: the three barriers move onto the card family with the two PIN gates. Their conditions,
  // their order and their handlers are frozen in group Q; only the card they draw on is new.
  SpendGate:        { shell: 'istana', note: 'disabled by its own kill switch, still reachable code' },
  ChildVoiceNotice: { shell: 'istana', note: 'stands in front of the call screen' },
  UnlockSheet:      { shell: 'istana', note: 'stands in front of the call screen' },
};

// PARSED FROM THE SHIPPED FILE, not from the table above.
const foundScreens = new Set();
for (const m of html.matchAll(/if \(screen === '([a-zA-Z]+)'/g)) foundScreens.add(m[1]);
for (const m of html.matchAll(/screen === '([a-zA-Z]+)' \|\| screen === '([a-zA-Z]+)'/g)) { foundScreens.add(m[1]); foundScreens.add(m[2]); }
// the chat is the fall-through: no `if (screen === 'chat') return` guards it, it is what is left.
ok('the chat is still the render fall-through', /screen === 'chat' \|\| screen === 'call'/.test(html));
foundScreens.add('chat');

const declared = new Set(Object.keys(INDEX_SCREENS));
const handoff = fs.readFileSync(path.join(__dirname, 'EZIK-THEME-33-HANDOFF.md'), 'utf8');
const handoffAt = handoff.indexOf('### index.html');
const handoffEnd = handoff.indexOf('\n### ', handoffAt + 4);
const handoffIndexSection = handoffAt === -1 ? '' : handoff.slice(handoffAt, handoffEnd === -1 ? handoff.length : handoffEnd);
const handoffScreens = Array.from(handoffIndexSection.matchAll(/^\|\s*([A-Za-z][A-Za-z0-9]*)\s*\|/gm), (m) => m[1]);
const arabicCount = String(declared.size).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
ok('the handoff states the governing index.html screen count',
  handoffIndexSection.includes('### index.html — ' + arabicCount + ' شاشة'));
eq('the handoff screen list matches the governing reachable inventory',
  handoffScreens.slice().sort(), Array.from(declared).sort());
const missingFromTable = [...foundScreens].filter((k) => !declared.has(k)).sort();
const staleInTable = [...declared].filter((k) => !foundScreens.has(k)).sort();
eq('every reachable index.html screen is in the inventory', missingFromTable, []);
eq('...and every inventoried screen is still reachable', staleInTable, []);
eq('the inventory covers ' + declared.size + ' index.html screens', declared.size, foundScreens.size);
for (const name of Object.keys(INDEX_INTERSTITIALS)) {
  ok('the interstitial ' + name + ' is reachable and inventoried', html.indexOf('<' + name + ' ') !== -1);
}

// QUEST: every view on the Screens object, parsed from the object itself.
const QUEST_SCREENS = {
  map:        { shell: 'istana', note: 'S104 category map' },
  _regionCard:{ shell: 'istana', note: 'the card builder the map uses' },
  // S115: the remaining fifteen. Eleven RENDER a view and carry .ezq on its root; three are
  // LAUNCHERS whose presentation is the round itself (.ezq-play / .ezq-end), and one is the card
  // builder the challenges hub uses (.ezq-mode). Every one is bound in group R, and the three
  // launchers are bound through the surface they actually open.
  region:     { shell: 'istana', root: 'ezq-region' },
  startStation: { shell: 'istana', via: 'ezq-play' },
  challenges: { shell: 'istana', root: 'ezq-challenges' },
  _modeCard:  { shell: 'istana', root: 'ezq-mode' },
  daily:      { shell: 'istana', via: 'ezq-play' },
  speed:      { shell: 'istana', via: 'ezq-play' },
  teamsSetup: { shell: 'istana', root: 'ezq-teamsSetup' },
  teamsCats:  { shell: 'istana', root: 'ezq-teamsCats' },
  teamsTrack: { shell: 'istana', root: 'ezq-teamsTrack' },
  teamsAsk:   { shell: 'istana', root: 'ezq-teamsAsk' },
  teamsEnd:   { shell: 'istana', root: 'ezq-teamsEnd' },
  book:       { shell: 'istana', root: 'ezq-book' },
  profile:    { shell: 'istana', root: 'ezq-profile' },
  settings:   { shell: 'istana', root: 'ezq-settings' },
  inspect:    { shell: 'istana', root: 'ezq-inspect' },
};
// bounded to the Screens object itself: an unbounded slice ran to end of file and swept in
// the play engine own methods (start, judge, render, finish...), which are not screens.
const qScreensAt = q.html.indexOf('const Screens = {');
const qScreensBody = q.html.slice(qScreensAt, q.html.indexOf('\n};', qScreensAt));
const foundQuest = new Set();
for (const m of qScreensBody.matchAll(/^  ([a-zA-Z_][a-zA-Z0-9_]*)\(/gm)) foundQuest.add(m[1]);
const kQDeclared = new Set(Object.keys(QUEST_SCREENS));
const kQMissing = [...foundQuest].filter((k) => !kQDeclared.has(k)).sort();
const kQStale = [...kQDeclared].filter((k) => !foundQuest.has(k)).sort();
eq('every reachable quest.html view is in the inventory', kQMissing, []);
eq('...and every inventoried quest view still exists', kQStale, []);

/* ---- K2. what the inventory MEASURES, reported rather than asserted ----- */
const idxIstana = Object.keys(INDEX_SCREENS).filter((k) => INDEX_SCREENS[k].shell === 'istana');
const idxLegacy = Object.keys(INDEX_SCREENS).filter((k) => INDEX_SCREENS[k].shell === 'legacy');
const qIstana = Object.keys(QUEST_SCREENS).filter((k) => QUEST_SCREENS[k].shell === 'istana');
const qLegacy = Object.keys(QUEST_SCREENS).filter((k) => QUEST_SCREENS[k].shell === 'legacy');
eq('every index screen is istana after this commit', idxIstana.length, 13);
eq('...and NONE is left legacy', idxLegacy.length, 0);
eq('...and the set is exactly the thirteen', idxIstana.slice().sort().join(','),
  'adhkar,call,chat,fatwa,favorites,home,loading,memorize,mushaf,onboarding,parentDashboard,parentGate,settings');
eq('...and the three interstitials are still three', Object.keys(INDEX_INTERSTITIALS).length, 3);
// S115: the barriers moved WITH this batch, so the check flipped from "still legacy" to "all
// three, and by name". A fourth appearing here would fail the reachability check above first.
eq('every interstitial is istana too',
  Object.keys(INDEX_INTERSTITIALS).filter((k) => INDEX_INTERSTITIALS[k].shell !== 'istana'), []);
eq('...and they are exactly the three that were always inventoried',
  Object.keys(INDEX_INTERSTITIALS).slice().sort().join(','), 'ChildVoiceNotice,SpendGate,UnlockSheet');
ok('...and each of them draws on the card family, which is why it counts',
  ['ChildVoiceNotice', 'UnlockSheet', 'SpendGate'].every((n) => {
    const a = html.indexOf('function ' + n + '(');
    if (a === -1) return false;
    const src = html.slice(a, html.indexOf('\nfunction ', a + 10));
    return /className="theme-dark ezhome ezgate"/.test(src) && /<div className="ezgate-card"/.test(src);
  }), 'a barrier is classified istana without drawing on .ezgate-');
// S107: no screen carries a sub-view caveat any more. The field still exists and is still
// asserted, so the next partially-finished screen has to declare itself the same way.
const partial = Object.keys(INDEX_SCREENS).filter((k) => INDEX_SCREENS[k].subviews);
eq('no screen is left with an undeclared unfinished sub-view', partial, []);
// and the caveat may only be absent while the drill actually IS on the shell.
ok('the memorize caveat was earned, not deleted',
  !INDEX_SCREENS.memorize.subviews === /<EzShell title=\{MEM\.TITLE\} onBack=\{ezikGoBack\}/.test(html),
  'the drill must render through the shell for memorize to count as finished');
// S110: mushaf is finished, and the caveat may only be absent while the READER actually is on
// the new chrome. Delete the rail or the dock and this fails, exactly as the memorize one does.
eq('mushaf is classified istana', INDEX_SCREENS.mushaf.shell, 'istana');
eq('...and carries no partial caveat any more', INDEX_SCREENS.mushaf.partial, undefined);
// S111 -- the caveat may only be absent while BOTH reachable readers are on istana chrome, and
// the loading render with them. Before this, the WebP reader alone could carry the claim while
// ?madinaimg=0 still drew a navy slab -- a classification the shipped file did not support.
const READERS_ISTANA =
  /className="ezhome ezmr-rail"/.test(html)          // WebP reader, top
  && /className="ezhome ezmr-dockwrap"/.test(html)   // WebP reader, bottom
  && /className="ezhome ezmr-rail is-static"/.test(html)  // the loading/failed render
  && /: s\.memHeaderFb;/.test(html) && /: s\.pgBarFb;/.test(html)   // the rollback reader
  && !/gradient/.test(JSON.stringify(s.memHeaderFb));
ok('the mushaf caveat was earned by BOTH readers, not deleted',
  !INDEX_SCREENS.mushaf.partial === READERS_ISTANA,
  'the WebP reader, the rollback reader and the loading render must all be on istana chrome');
// and said the plain way: not one object the reader hands to a bar carries a gradient.
const READER_BAR_OBJECTS = ['memHeaderFb', 'pgBarFb', 'ezmrTitle', 'ezmrNav', 'ezmrJump'];
eq('no object any reader bar is drawn from carries a gradient',
  READER_BAR_OBJECTS.filter((k) => /gradient/.test(JSON.stringify(s[k] || {}))), []);

/* ---- K3. the fatwa classification is earned by its shipped screen ------- */
const fatwaAt = html.indexOf('const EZIK_FATWA_API_BASE =');
const fatwaEnd = fatwaAt === -1 ? -1 : html.indexOf('\n// EZIK ADHKAR UI V2', fatwaAt);
const fatwaSrc = (fatwaAt !== -1 && fatwaEnd > fatwaAt) ? html.slice(fatwaAt, fatwaEnd) : '';
const fatwaFormAt = fatwaSrc.indexOf('<main className="ezf-wrap">');
const fatwaFormEnd = fatwaSrc.indexOf('{status ?', fatwaFormAt);
const fatwaFormSrc = (fatwaFormAt !== -1 && fatwaFormEnd > fatwaFormAt)
  ? fatwaSrc.slice(fatwaFormAt, fatwaFormEnd) : '';
const ezfRules = (css.match(/\.ezf[a-z0-9-]*(?:[^{}]*)\{[^}]*\}/g) || []);
// The window is a LOCATOR check -- it proves the slice above really caught the fatwa feature
// and not the whole file or nothing at all. It is not a budget, and it has to follow the
// feature: the alphabetical browse of 2026-08-09 (the "all fatwas" option, the ten-to-a-page
// shelf and its pager) added ~4.3k characters, so the ceiling moved with it. Every assertion
// below it -- the identity, the tokens, no gradient, no motion, GET-only, no model endpoint --
// is what actually bounds this feature, and none of them moved.
ok('K3: the fatwa feature was located and bounded', fatwaSrc.length > 7000 && fatwaSrc.length < 22000,
  'len=' + fatwaSrc.length);
const FATWA_ON_EZF =
  /<div className="theme-dark ezhome ezf" style=\{s\.ezfContainer\}>/.test(fatwaSrc)
  && /<div className="ezsh-nav">/.test(fatwaSrc)
  && /<main className="ezf-wrap">/.test(fatwaSrc);
ok('K3: the fatwa screen mounts on its own identity inside the shared shell', FATWA_ON_EZF);
eq('K3: ...and THAT is why the inventory calls it istana', INDEX_SCREENS.fatwa.shell,
  FATWA_ON_EZF ? 'istana' : 'legacy');
ok('K3: the fatwa identity declares its own bounded rule set', ezfRules.length > 20,
  'found ' + ezfRules.length);
ok('K3: ...and no selector in it can match html, body or :root',
  !ezfRules.some((r) => /(^|[,\s])(html|body|:root)[\s,{]/.test(r.split('{')[0])));
eq('K3: not one fatwa rule attaches an image, a gradient or a repeat',
  ezfRules.filter((r) => /url\(|gradient|background-repeat\s*:|background-image\s*:\s*(?!none)/.test(r)), []);
ok('K3: ...and none draws a pseudo-element over the content',
  !/\.ezf[a-z0-9-]*[^{]*::(before|after)/.test(css)
  && !ezfRules.some((r) => /[;{]\s*content\s*:/.test(r)));
eq('K3: ...and every fatwa colour comes from the identity tokens',
  ezfRules.filter((r) => /(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(r)), []);
ok('K3: the page root is token-painted and accessibility-scalable',
  s.ezfContainer && s.ezfContainer.background === 'var(--a3-page)'
  && typeof s.ezfContainer.fontSize === 'number');
eq('K3: the fatwa rules introduce no motion',
  ezfRules.filter((r) => /animation|transition/.test(r)), []);

/* The empty state stays deliberately spare: navigation, selector and search. Result-only
 * furniture is below the status boundary and therefore cannot appear before the first search. */
ok('K3: the initial fatwa form was located and bounded', fatwaFormSrc.length > 700 && fatwaFormSrc.length < 2600,
  'len=' + fatwaFormSrc.length);
ok('K3: the empty screen contains the scholar selector and search control',
  /<select id="ezf-scholar"/.test(fatwaFormSrc)
  && /<input className="ezhome-focus ezf-input" type="search"/.test(fatwaFormSrc)
  && /<button type="submit" className="ezhome-focus ezf-submit"/.test(fatwaFormSrc));
okOn('K3: ...without a title, helper copy or suggestions', [["fatwaFormSrc", fatwaFormSrc]],
  !/<h[1-6]\b/.test(fatwaFormSrc) && !/suggest/i.test(fatwaFormSrc));
ok('K3: scholar choices show a name only, never a record count',
  /<option key=\{item\.id\} value=\{item\.id\}>\{item\.shortName \|\| ezT\('fatwa\.defaultScholar'\)\}<\/option>/.test(fatwaFormSrc));

/* This surface is retrieval-only. It asks the dedicated server for complete records, then
 * renders the official question, answer, recording and canonical source. */
ok('K3: fatwa retrieval is GET-only and asks for the complete official record',
  /method:\s*'GET'/.test(fatwaSrc) && /view:\s*'full'/.test(fatwaSrc)
  && /\/api\/v1\/fatwas\/search\?/.test(fatwaSrc));
okOn('K3: ...and no model or write endpoint is reachable from the fatwa feature', [["fatwaSrc", fatwaSrc]],
  !/\/api\/(?:ask|chat)\b/.test(fatwaSrc) && !/method:\s*'POST'/.test(fatwaSrc));
ok('K3: every result keeps its official evidence attached',
  /<p className="ezf-copy">\{question\}<\/p>/.test(fatwaSrc)
  && /<p className="ezf-copy">\{answer\}<\/p>/.test(fatwaSrc)
  && /<audio className="ezf-audio" controls/.test(fatwaSrc)
  && /href=\{sourceUrl\}/.test(fatwaSrc));
ok('K3: the four future learning actions remain visibly disabled',
  /EZIK_FATWA_ACTIONS\.map/.test(fatwaSrc)
  && /className="ezf-action" disabled\s*\r?\n\s*aria-disabled="true"/.test(fatwaSrc));
// S115: quest is finished too. Both numbers are asserted rather than merely printed now, because
// there is nothing left outstanding for a later batch to be measured against.
eq('every quest view is istana after this commit', qIstana.length, 17);
eq('...and NONE is left legacy', qLegacy.length, 0);
console.log('        index.html : ' + idxIstana.length + ' istana, ' + idxLegacy.length + ' legacy'
  + ' (+' + Object.keys(INDEX_INTERSTITIALS).length + ' interstitials, all istana)');
console.log('        istana now : ' + idxIstana.join(', '));
console.log('        quest.html : ' + qIstana.length + ' istana, ' + qLegacy.length + ' legacy');
console.log('        outstanding: (none -- the identity is complete)');
// The one approved sacred opt-out, and it covers the SHEET only -- never the controls round it.
// An OPT-OUT re-pins the base literals; the .adhkar3/.ezhome rule is a MAPPING onto the
// identity, which is the opposite thing. Distinguished by what the rule contains, not by name.
const themedClassRules = (css.match(/:root\[data-ezik-visual-theme\][^{]*\{[^}]*\}/g) || []);
const optOuts = themedClassRules.filter((r) => /--red:#1D4ED8|--ink:#1A1A1A/.test(r));
eq('exactly one sacred opt-out exists', optOuts.length, 1);
ok('...and it is the Quran sheet itself', optOuts.length === 1 && /\.mushaf-paper/.test(optOuts[0]),
  'the opt-out covers the SHEET; the controls around it follow the identity like every other screen');

/* ============ L. THE ISTANA QURAN CATALOGUE (S106) =======================
 * The measured defect: at 2048x1024 the memorisation picker laid 114 surahs across the whole
 * viewport behind a legacy navy header. The picker is on the shared shell now and the catalogue
 * is bounded and four columns wide on a desk. The DRILL sub-views of this screen are NOT moved
 * in this commit and are still legacy -- see the inventory note, which says so rather than
 * letting the screen count as finished.
 * ---------------------------------------------------------------------- */
console.log('\n=== L. THE ISTANA QURAN CATALOGUE ===');

const memAt = html.indexOf('function MemorizeScreen(');
// bounded to the component: the next top-level `function ` after it. MushafScreen is ABOVE
// MemorizeScreen in the file, so the old end marker was never found and this slice ran to EOF.
const memEnd = memAt === -1 ? -1 : html.indexOf('\nfunction ', memAt + 10);
const memSrc = memAt === -1 ? '' : html.slice(memAt, memEnd === -1 ? html.length : memEnd);
ok('the memorisation screen was located', memSrc.length > 1000);
ok('its picker renders through the shared shell',
  /<EzShell title=\{MEM\.TITLE\} onBack=\{onExit\} backLabel=\{MEM\.BACK_BTN\}>/.test(memSrc));
ok('...with the screen\'s OWN exit handler, not a new one', /onBack=\{onExit\}/.test(memSrc));
// THE LEGACY NAVY HEADER IS NOT REACHABLE FROM THE PICKER.
const pickerSrc = memSrc.slice(memSrc.indexOf('<EzShell title={MEM.TITLE}'), memSrc.indexOf('// ---------- DRILL ----------'));
okOn('the picker draws no legacy header or container', [["memSrc", memSrc]],
  !/s\.memHeader/.test(pickerSrc) && !/s\.memContainer/.test(pickerSrc) && !/s\.memTitle/.test(pickerSrc),
  'memHeader is the full-width navy strip the review rejected');

/* ---- L1. the canonical 114, once, in order ------------------------------ */
ok('the catalogue maps the canonical range exactly once',
  (pickerSrc.match(/Array\.from\(\{ length: 114 \}, \(_, i\) => i \+ 1\)\.map\(/g) || []).length === 1);
okOn('...and nothing re-orders, filters or slices it', [["memSrc", memSrc]],
  !/\.sort\(|\.filter\(|\.slice\(|\.reverse\(/.test(pickerSrc));
ok('...and each card carries its own surah number', /data-ezq-surah=\{n\}/.test(pickerSrc));
// the metadata comes from the shipped sources, and none of it is written down here.
ok('the name comes from SURAH_NAMES', /\{SURAH_NAMES\[n\]\}/.test(pickerSrc));
ok('the ayah count comes from the single-pass tally', /counts\[n\] \? \(toArabicDigits\(counts\[n\]\)/.test(pickerSrc));
ok('the Meccan/Medinan word comes from revelationLabel', /\{revelationLabel\(n\)\}/.test(pickerSrc));
okOn('no surah metadata is hardcoded in the catalogue', [["memSrc", memSrc]],
  !/\bMakkiy|\bMadaniy|\[\s*'\u0627\u0644\u0641\u0627\u062A\u062D\u0629'/.test(pickerSrc));

/* ---- L2. the layout the review asked for -------------------------------- */
ok('two columns on a phone', /\.ezq-cat\{[^}]*grid-template-columns:repeat\(2,1fr\)/.test(css));
ok('...three from 600px', /@media \(min-width:600px\)\{\.ezq-cat\{grid-template-columns:repeat\(3,1fr\)/.test(css));
ok('...and EXACTLY four from 1000px, never eight',
  /@media \(min-width:1000px\)\{\.ezq-cat\{grid-template-columns:repeat\(4,1fr\)/.test(css)
  && !/\.ezq-cat\{grid-template-columns:repeat\([5-9]|auto-fill/.test(css));
ok('...inside the shell\'s bounded column', /\.ezsh-wrap\{[^}]*max-width:1100px/.test(css));
ok('the card carries a bounded arch crest the card clips',
  /\.ezq-crest\{[^}]*position:absolute/.test(css) && /\.ezq-card\{[^}]*overflow:hidden/.test(css));
ok('...and a visible selected state', !!s.ezqCardOn && /aria-pressed=\{active/.test(pickerSrc));
const ezqTall = ['ezqCard'].filter((k) => typeof (s[k] || {}).height === 'number' || ((s[k] || {}).minHeight || 0) > 160);
eq('no surah card is a tall decorative panel', ezqTall, []);

/* ---- L3. the memorisation actions are untouched ------------------------- */
const MEM_ACTIONS = [
  ['select a surah', /onClick=\{\(\) => \{ setSelectedSurah\(n\); setStartAyah\(1\); \}\}/],
  ['choose the start ayah', /onChange=\{\(e\) => setStartAyah\(parseInt\(e\.target\.value, 10\) \|\| 1\)\}/],
  ['start the drill', /onClick=\{startDrill\}/],
];
for (const [name, re] of MEM_ACTIONS) ok('the picker keeps its ' + name + ' action', re.test(pickerSrc));
ok('the drill, recite and adnan flows are untouched by this commit',
  /const \[drillMode, setDrillMode\]/.test(memSrc) && /reciteRecognitionRef/.test(memSrc)
  && /useEzikBackLayer\(view === 'drill', leaveDrill\)/.test(memSrc),
  'the back layer, the recogniser and the talqin loop are the screen\'s own and stay its own');


/* ---- L6. THE THREE DRILL MODES (S107) -----------------------------------
 * The picker moved first and the drill was left legacy, which the inventory recorded. The drill
 * is on the shell now: ONE wrapper, ONE header and ONE sub-bar changed, and the three mode
 * blocks inside were not touched at all -- which is the point, because those blocks are the
 * talqin loop, the recogniser and the reveal sequence.
 * ---------------------------------------------------------------------- */
const drillSrc = memSrc.slice(memSrc.indexOf('// ---------- DRILL ----------'));
ok('the drill section was located', drillSrc.length > 2000);
ok('the drill renders through the shared shell',
  /<EzShell title=\{MEM\.TITLE\} onBack=\{ezikGoBack\} backLabel=\{MEM\.BACK_BTN\}>/.test(drillSrc));
ok('...and closes it', /<\/EzShell>/.test(drillSrc));
// NO LEGACY STRUCTURE ANYWHERE IN THE MEMORISATION SCREEN.
okOn('no memContainer/memHeader/memTitle/memSubBar remains in memorize', [["memSrc", memSrc]],
  !/s\.memContainer|s\.memHeader|s\.memTitle\b|s\.memSubBar/.test(memSrc),
  'these are the full-width navy presentation the review rejected');
ok('...while the mushaf screen still has its own, untouched', /s\.memContainer/.test(html));
// BACK GOES TO THE IMMEDIATE PARENT, NOT TO CHAT.
ok('the drill back is the application back, which lands on the picker',
  /onBack=\{ezikGoBack\}/.test(drillSrc) && /useEzikBackLayer\(view === 'drill', leaveDrill\)/.test(memSrc));
okOn('...and no back path in memorize routes to the chat', [["memSrc", memSrc]],
  !/onBack=\{[^}]*setScreen\(.chat.\)/.test(memSrc) && !/backLabel[\s\S]{0,80}setScreen\(.chat.\)/.test(memSrc));
ok('the change-surah control still leaves by the same door', /onClick=\{ezikGoBack\} style=\{s\.ezqDrillChange\}/.test(drillSrc));

// EVERY MODE, AND EVERY ANCHOR INSIDE IT.
for (const m of ['manual', 'adnan', 'recite']) {
  ok('the ' + m + ' mode still renders', new RegExp("drillMode === '" + m + "'").test(drillSrc));
  ok('...and is still selectable', new RegExp("setMode\\('" + m + "'\\)").test(drillSrc));
}
const DRILL_ANCHORS = [
  ['manual: the reveal control', /onClick=\{\(\) => setRevealedCount\(\(c\) => Math\.min\(c \+ 1, units\.length\)\)\}/],
  ['manual: the granularity choice', /setGran\('ayah'\)/],
  ['manual: the stage that shows the words', /s\.memDrillArea/],
  ['manual: the revealed word vs the placeholder', /s\.memWord/],
  ['talqin: the loop state', /const \[adnanRunning, setAdnanRunning\] = useState\(/],
  ['talqin: the start/stop binding', /onClick=\{\(\) => \(adnanRunning \? stopAdnan\(\) : startAdnan\(\)\)\}/],
  ['talqin: the current ayah state', /const \[adnanAyah, setAdnanAyah\] = useState\(/],
  ['talqin: the audio call', /onPlayVerse && onPlayVerse\(selectedSurah, focusAyah\)/],
  ['recite: the microphone control', /reciteListening \? stopRecite\(\) : startRecite\(\)/],
  ['recite: the per-word result state', /const \[reciteStates, setReciteStates\] = useState\(/],
  ['recite: the progression binding', /onClick=\{advanceReciteManual\}/],
  ['recite: the graceful error line', /reciteErr/],
];
for (const [name, re] of DRILL_ANCHORS) ok('preserved -- ' + name, re.test(memSrc));
// the safety and audio-focus guards are the screen's own and are not this commit's business.
ok('the child-voice restriction still stands in front of the call screen',
  /screen === 'call' && childVoiceBlocked\(\)/.test(html));
ok('the recogniser still cannot be reopened by a stale onend',
  /const reciteRunIdRef = useRef\(/.test(memSrc));
ok('the transcript is still never rendered or stored',
  /const reciteHeardRef = useRef\(/.test(memSrc) && !/\{reciteHeardRef\.current\}/.test(memSrc));
ok('the talqin loop still has its own cancel token', /const runIdRef = useRef\(/.test(memSrc));

// THE QURAN TEXT IS SURROUNDED, NEVER TOUCHED.
ok('the reading column is a WIDTH and paints nothing',
  /\.ezq-read\{width:100%;max-width:720px;margin:0 auto\}/.test(css));
ok('the drill text sits inside that bounded column',
  /<div className="ezq-read" style=\{s\.memDrillArea\}>/.test(html));
ok('...and no ezq rule draws a pseudo-element into the reading bounds',
  !/\.ezq-read[^{]*::(before|after)/.test(css));
ok('the verse text is still read straight from the store',
  /getVerseText\(selectedSurah, adnanAyah \|\| startAyah\)/.test(memSrc));
okOn('...with no transform, slice or ellipsis over it', [["memSrc", memSrc]],
  !/getVerseText\([^)]*\)\s*\.(slice|substring|replace|normalize)/.test(memSrc));


/* ---- L7. THE POSITIVE PAGE HOOK (S108) ---------------------------------
 * The measured probe established that the LIVE Quran page -- the Madina WebP -- has no class
 * and no id, so nothing in the stylesheet can reach it. Its safety therefore rested on ABSENCE,
 * not on exclusion, and the only thing a guard could check was that no rule NAMED it. That is a
 * guarantee about the guard, not about the page.
 *
 * data-mushaf-page={page.n} is the positive handle that replaces it. It exists so a guard can
 * identify every mounted page deterministically and freeze the measured geometry. It must stay
 * a data attribute and nothing more: the moment any CSS targets it, it has become a styling
 * surface on the Quran page and this group fails.
 * ---------------------------------------------------------------------- */
console.log('\n=== L7. THE POSITIVE PAGE HOOK ===');
const madinaImg = html.slice(html.indexOf('if (madina && !imgBroke)'), html.indexOf('if (!MUSHAF_SVG_ON || broke)'));
ok('the live Madina image branch was located', madinaImg.length > 200 && madinaImg.indexOf('<img') !== -1);
ok('the page image carries the hook', /data-mushaf-page=\{page\.n\}/.test(madinaImg),
  'without it the live page has no handle at all and can only be guarded by absence');
eq('...exactly once', (madinaImg.match(/data-mushaf-page=/g) || []).length, 1);
okOn('...bound to page.n and nothing else', [["madinaImg", madinaImg]],
  !/data-mushaf-page=\{(?!page\.n\})/.test(madinaImg),
  'a constant, an index or a derived value would make the guard measure the wrong page');
// IT MUST NOT BECOME A STYLING SURFACE.
ok('no CSS rule targets the hook', !/\[data-mushaf-page/.test(css),
  'the hook is for identification; a rule on it would be a rule on the Quran page');
ok('...and no CSS targets the live image through its branch either',
  !/:root\[data-ezik-visual-theme\][^{]*img[^{]*\{/.test(css));
// IT MUST NOT HAVE CHANGED WHAT THE ELEMENT IS.
okOn('the image still carries no class and no id', [["madinaImg", madinaImg]],
  !/<img[^>]*data-mushaf-page[^>]*className/.test(madinaImg)
  && !/<img[^>]*data-mushaf-page[^>]*\sid=/.test(madinaImg));
ok('the src is still the shipped page url', /src=\{madina\}/.test(madinaImg));
ok('the style is still the shipped fill/contain pair',
  /style=\{fill \? MADINA_IMG_ST : MADINA_IMG_ST_FIT\}/.test(madinaImg));
ok('...and the handlers are unchanged', /onLoad=\{\(\) => \{ if \(onSheetLoad\)/.test(madinaImg)
  && /onError=\{\(\) => setImgBroke\(true\)\}/.test(madinaImg));
// THE FROZEN GEOMETRY THE HOOK EXISTS TO PROTECT, asserted from the shipped style objects.
ok('the fill variant is width/height 100% with object-fit fill',
  /MADINA_IMG_ST = \{ width: '100%', height: '100%', objectFit: 'fill'/.test(html));
ok('the contain variant differs only in object-fit and margin',
  /MADINA_IMG_ST_FIT = \{ \.\.\.MADINA_IMG_ST, objectFit: 'contain', margin: 'auto' \}/.test(html));
for (const p of ['transform', 'filter', 'opacity', 'mixBlendMode', 'border', 'background']) {
  ok('the page image declares no ' + p, !new RegExp(p + ':').test(
    (/const MADINA_IMG_ST = \{[^}]*\}/.exec(html) || [''])[0]));
}
ok('the desk still paints only through --madina-desk',
  /MADINA_SHEET_ST = \{[^}]*background: MADINA_DESK/.test(html)
  && /const MADINA_DESK = 'var\(--madina-desk\)'/.test(html));

/* ---- L8. THE ISTANA MUSHAF INDEX (S109) ---------------------------------
 * The INDEX only. The reader below it is untouched and still classified legacy -- the
 * inventory says so and this group fails if that note is removed.
 * ---------------------------------------------------------------------- */
const mushAt = html.indexOf('function MushafScreen(');
const mushSrc = mushAt === -1 ? '' : html.slice(mushAt, html.indexOf('\nfunction MemorizeScreen(', mushAt));
ok('the mushaf screen was located', mushSrc.length > 1000);
const idxSrc = mushSrc.slice(mushSrc.lastIndexOf('  return ('));
ok('the index renders through the shared shell',
  /<EzShell title=\{[^}]*\} onBack=\{leaveScreen\}/.test(idxSrc));
ok('...with the screen own back handler', /onBack={leaveScreen}/.test(idxSrc));
okOn('the legacy navy header is gone from the index', [["mushSrc", mushSrc]],
  !/s\.memHeader|s\.memTitle\b|s\.memContainer/.test(idxSrc));
ok('the surah list is the bounded catalogue', /className="ezq-cat"/.test(idxSrc));
ok('...2 cols mobile, 3 at 600, 4 at 1000 -- and never more',
  /\.ezq-cat\{[^}]*grid-template-columns:repeat\(2,1fr\)/.test(css)
  && /@media \(min-width:600px\)\{\.ezq-cat\{grid-template-columns:repeat\(3,1fr\)/.test(css)
  && /@media \(min-width:1000px\)\{\.ezq-cat\{grid-template-columns:repeat\(4,1fr\)/.test(css)
  && !/\.ezq-cat\{grid-template-columns:repeat\([5-9]/.test(css));
ok('...inside the shell bounded column', /\.ezsh-wrap\{[^}]*max-width:1100px/.test(css));
// ONE map PER LIST, the owner order, the same handlers. S110 split the single mixed map in two
// -- the juz no longer span the surah grid -- so this counts each list once instead of counting
// the mixed map once. The intent is unchanged: no duplicate map, no dead map, no second source.
eq('the index maps the surah rows exactly once',
  idxSrc.split('surahRows.map(').length - 1, 1);
eq('...and the juz rows exactly once',
  idxSrc.split('juzRows.map(').length - 1, 1);
ok('...both lists come from the one owner array', /const navRows = nav \|\| MUSHAF_NAV_FALLBACK;/.test(mushSrc));
okOn('...and nothing sorts, filters, slices or reverses it', [["mushSrc", mushSrc]],
  !/\.sort\(|\.filter\(|\.slice\(|\.reverse\(/.test(idxSrc));
// S110 -- THE SEPARATION ITSELF. Everything below fails the moment the juz are put back inside
// the surah grid, given the surah grid's columns, or allowed to span it.
ok('the juz live in their OWN grid class, not the catalogue',
  /className="ezm-juzgrid"/.test(idxSrc));
okOn('...and the juz section never carries .ezq-cat', [["mushSrc", mushSrc]],
  !/className="ezq-cat ezm-juz|className="ezm-juz(grid)? ezq-cat|className="ezq-cat[^"]*ezm-/.test(idxSrc));
ok('.ezm-juzgrid is a real, independent grid',
  /\.ezm-juzgrid\{[^}]*display:grid/.test(css));
ok('...3 cols on a phone, 5 from 600, 6 from 1000 -- its own scale, not the catalogue\'s',
  /\.ezm-juzgrid\{[^}]*grid-template-columns:repeat\(3,1fr\)/.test(css)
  && /@media \(min-width:600px\)\{\.ezm-juzgrid\{grid-template-columns:repeat\(5,1fr\)/.test(css)
  && /@media \(min-width:1000px\)\{\.ezm-juzgrid\{grid-template-columns:repeat\(6,1fr\)/.test(css));
ok('NOTHING in the index spans a grid track', !/grid-column/.test(css.match(/\.ezm-[^{]*\{[^}]*\}/g)?.join('') || ''));
ok('...and no juz rule spans 1/-1 anywhere', !/\.ezm-juz[^{]*\{[^}]*grid-column:1\/-1/.test(css));
// the two sections are named on the page.
ok('the juz section is titled', idxSrc.indexOf('>الانتقال إلى جزء<') !== -1);
ok('the surah section is titled', idxSrc.indexOf('>السور<') !== -1);
// the masthead is a strip on THIS screen, never a hero.
ok('the index masthead is the strip variant', /className="ezq-masthead is-strip"/.test(idxSrc));
ok('...and the strip branch is really defined', /\.ezq-masthead\.is-strip\{/.test(css));
const strip = (css.match(/\.ezq-masthead\.is-strip\{([^}]*)\}/) || [])[1] || '';
ok('...it lays its rows out in one flex row', /display:flex/.test(strip));
ok('...it drops the hero padding', /padding:8px/.test(strip) && !/padding:2[0-9]px/.test(strip));
ok('...and claims no hero height', /min-height:0/.test(strip));
// the owner array is still whole and still in the owner's order.
const navSrc = html.slice(html.indexOf('const buildMushafNav'), html.indexOf('const MUSHAF_NAV_FALLBACK'));
ok('the owner still builds all 114 surahs', /for \(let sn = 1; sn <= 114; sn\+\+\)/.test(navSrc));
ok('...and all 30 juz', /for \(let jz = 1; jz <= 30; jz\+\+\)/.test(navSrc));
ok('...and refuses anything that is not 144 rows', /rows\.length !== 144/.test(navSrc));
ok('the split takes every row and drops none',
  /const juzRows = navRows\.filter\(\(r\) => r\.k === 'j'\);/.test(mushSrc)
  && /const surahRows = navRows\.filter\(\(r\) => r\.k === 's'\);/.test(mushSrc));
eq('the owner array is split exactly once', mushSrc.split('navRows.filter(').length - 1, 2);
ok('each surah card carries its own number', idxSrc.indexOf('data-ezm-surah={r.n}') !== -1);
ok('the open handler is unchanged',
  idxSrc.indexOf('onClick={() => { setOpenAt(null); setSelected(r.n); }}') !== -1);
ok('the juz handler is unchanged',
  idxSrc.indexOf('onClick={() => { setOpenAt({ p: r.p, s: r.s }); setSelected(r.s); }}') !== -1);
// metadata comes from the shipped sources only.
ok('the name comes from SURAH_NAMES', idxSrc.indexOf('{SURAH_NAMES[r.n]}') !== -1);
ok('the revelation label comes from revelationLabel', idxSrc.indexOf('{revelationLabel(r.n)}') !== -1);
ok('the ayah count comes from the single-pass tally', idxSrc.indexOf('counts[r.n] ? counts[r.n] : 0') !== -1);
okOn('no surah metadata is hardcoded in the index', [["mushSrc", mushSrc]],
  !/\[\s*'\u0627\u0644\u0641\u0627\u062A\u062D\u0629'/.test(idxSrc));
// THE READER IS UNTOUCHED.
ok('the reader still opens through the same door',
  /if \(selected\) return <PagedMushaf startSurah={selected}/.test(mushSrc));
ok('the reader chrome is still the shipped one', html.indexOf('{chromeOn && (') !== -1);
ok('the dwell constant is unchanged', /const WIRD_DWELL_MS = 8000;/.test(html));
ok('the mushaf storage keys are unchanged',
  /MUSHAF_BOOKMARK_KEY = 'mushaf_bookmark_v1'/.test(html)
  && /MUSHAF_LAST_PAGE_KEY = 'mushaf_last_page_v1'/.test(html)
  && /WIRD_TARGET_KEY = 'mushaf_wird_target_v1'/.test(html)
  && /WIRD_DAY_KEY = 'mushaf_wird_day_v1'/.test(html));
ok('the tap toggle is unchanged', html.indexOf('setChromeOn((v) => !v); }, MUSHAF_TAP_MS)') !== -1);
// the index must not paint a page background.
const ezmRules = (css.match(/\.ezm-[^{]*\{[^}]*\}/g) || []);
eq('no index rule attaches an image, gradient or repeat',
  ezmRules.filter((r) => /background-image|gradient|url\(|repeating/i.test(r)), []);

/* ---- L4. the background invariant reaches this screen too --------------- */
const ezqRules = (css.match(/\.ezq-[^{]*\{[^}]*\}/g) || []);
eq('no catalogue rule attaches an image, gradient or repeat',
  ezqRules.filter((r) => /background-image|gradient|url\(|repeating/i.test(r)), []);
ok('and no catalogue selector can match html, body or :root',
  !/(^|[,}\s])(html|body|:root)[^{,]*\.ezq-/.test(css));
const ezqKeys = Object.keys(s).filter((k) => k.indexOf('ezq') === 0);
const ezqLit = [];
for (const k of ezqKeys) for (const p of Object.keys(s[k])) {
  const v = String(s[k][p]);
  if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v)) ezqLit.push(k + '.' + p);
}
eq('no catalogue style key carries a hardcoded colour', ezqLit, []);

/* ---- L5. the Quran itself is untouched ---------------------------------- */
// The sheet remains the ONE sacred opt-out, and no identity selector may reach the page image.
ok('no identity selector targets the mushaf page image or the sheet',
  !/:root\[data-ezik-visual-theme\][^{]*(\.mushaf-page|\.madina|img)[^{]*\{/.test(css));
ok('...and no filter, opacity or transform is applied to the sheet',
  !/\.mushaf-paper[^{]*\{[^}]*(filter|opacity|transform)\s*:/.test(css));

/* ============ M. THE ISTANA MUSHAF READER (S110) =========================
 * The CHROME around the page, and only the chrome. Everything this group asserts about the
 * page itself is a FREEZE: the sheet, the image, the viewport and the strip are named here so
 * that moving any of them fails, never so that this commit may move them.
 *
 * Scope, stated rather than implied: the new rail and dock are the chrome of the SHIPPED
 * reader (MADINA_IMG_ON). The ?madinaimg=0 rollback reader keeps its in-flow bars byte for
 * byte, because its page is a flex child of the same column -- replacing those bars would
 * move the SVG paper, whose geometry is frozen in group M6. That branch is asserted to still
 * exist, so it cannot be quietly deleted either.
 * ---------------------------------------------------------------------- */
console.log('\n=== M. THE ISTANA MUSHAF READER ===');

const rdAt = html.indexOf('function PagedMushaf(');
const rdSrc = rdAt === -1 ? '' : html.slice(rdAt, html.indexOf('\nfunction MushafScreen(', rdAt));
ok('the reader was located', rdSrc.length > 4000);
// THE SHIPPED CHROME, and only it: the two istana branches, cut at the `) : (` that hands over
// to the rollback bars. An unbounded slice from the first gate would have swallowed those bars
// too, and then "the navy header is gone" would have been asserted against markup that still
// contains it -- a check that can only ever fail, or worse, be quietly weakened until it passes.
const cutBranch = (from) => {
  const a = rdSrc.indexOf(from);
  if (a === -1) return '';
  const b = rdSrc.indexOf('      ) : (', a);
  return b === -1 ? '' : rdSrc.slice(a, b);
};
// the SECOND arm of each ternary runs to the `))}` that closes the gate, not to a `) : (`.
const cutBranch2 = (from) => {
  const a = rdSrc.indexOf(from);
  if (a === -1) return '';
  const b = rdSrc.indexOf('      ))}', a);
  return b === -1 ? '' : rdSrc.slice(a, b);
};
const railSrc = cutBranch('<div className="ezhome ezmr-rail">');
const dockSrc = cutBranch('<div ref={barRef} className="ezhome ezmr-dockwrap">');
const shipped = railSrc + dockSrc;
ok('the shipped rail branch was located', railSrc.length > 400);
ok('the shipped dock branch was located', dockSrc.length > 400);

/* ---- M1. the two new bounded overlays exist and are used ---------------- */
ok('the top reader rail is rendered', /className="ezhome ezmr-rail"/.test(rdSrc));
ok('the bottom reader dock is rendered', /className="ezhome ezmr-dockwrap"/.test(rdSrc));
ok('...and the dock is what barH measures', /ref=\{barRef\} className="ezhome ezmr-dockwrap"/.test(rdSrc));
ok('the rail is a real, bounded, absolute overlay',
  /\.ezmr-rail,\.ezmr-dockwrap\{[^}]*position:absolute/.test(css)
  && /\.ezmr-rail>\.ezmr-bar\{[^}]*max-width:600px/.test(css));
ok('the dock is a real, bounded, absolute overlay',
  /\.ezmr-dockwrap\{[^}]*bottom:0/.test(css)
  && /\.ezmr-dockwrap>\.ezmr-bar\{[^}]*max-width:420px/.test(css));
ok('...so neither can ever stretch into a full-width slab',
  !/\.ezmr-[a-z-]*\{[^}]*width:100vw/.test(css));
ok('both sit inside the safe area', /\.ezmr-rail\{[^}]*env\(safe-area-inset-top/.test(css)
  && /\.ezmr-dockwrap\{[^}]*env\(safe-area-inset-bottom/.test(css));
ok('the chrome takes its colour from tokens only, never a literal',
  !/\.ezmr-[^{]*\{[^}]*(#[0-9a-fA-F]{3,8}|rgba?\()/.test(css));
ok('...from the a3 scope it actually carries', /\.ezmr-bar\{[^}]*background:var\(--a3-surface\)/.test(css)
  && /className="ezhome ezmr-/.test(rdSrc));
ok('the chrome has a visible focus ring', /\.ezmr-btn:focus-visible\{[^}]*outline:3px solid var\(--ez-focus\)/.test(css));
ok('...and every chrome font size is a number the reading preference can scale',
  ['ezmrTitle', 'ezmrNav', 'ezmrJump'].every((k) => s[k] && typeof s[k].fontSize === 'number'));
ok('the chrome animates nothing, so reduced motion has nothing to switch off',
  !/\.ezmr-[^{]*\{[^}]*(animation|transition)\s*:/.test(css));
ok('no chrome rule attaches an image, gradient or repeat',
  !/\.ezmr-[^{]*\{[^}]*(background-image|gradient|url\(|repeating)/i.test(css));
ok('no chrome rule draws a pseudo-element over anything',
  !/\.ezmr-[^:]*::(before|after)/.test(css));

/* ---- M2. the legacy reader chrome is gone from the shipped reader ------- */
okOn('the navy slab header is gone from the shipped rail', [["railSrc", railSrc]], !/s\.memHeader|headSt/.test(railSrc));
okOn('...and so are its title and its slab button', [["railSrc", railSrc]], !/s\.memTitle|s\.memBackBtn/.test(railSrc));
okOn('the full-width white pager is gone from the shipped dock', [["dockSrc", dockSrc]], !/s\.pgBar\b|barSt/.test(dockSrc));
okOn('...and so are its slab nav buttons', [["dockSrc", dockSrc]], !/s\.pgNavBtn|s\.pgNavOff/.test(dockSrc));
eq('the reader hands each in-flow bar exactly one style',
  (rdSrc.match(/style=\{headSt\}/g) || []).length + (rdSrc.match(/style=\{barSt\}/g) || []).length, 2);
ok('the loading render no longer wears the navy slab either',
  !/<div style=\{s\.memHeader\}>[\s\S]{0,200}تعذّر فتح المصحف/.test(rdSrc)
  && /className="ezhome ezmr-rail is-static"/.test(rdSrc));
/* ---- M2b. THE ROLLBACK READER IS ISTANA TOO, AND STILL IN FLOW (S111) ----
 * ?madinaimg=0 is reachable, so it counts. Its page is a flex child of the same column, which
 * means the two bars' HEIGHTS are inside the box the SVG paper is fitted to -- 65 and 53,
 * measured before the repaint. Everything below freezes the box and frees only the paint. */
const fbRail = cutBranch2('<div className="ezhome" style={headSt}>');
const fbDock = cutBranch2('<div ref={barRef} className="ezhome" style={barSt}>');
ok('the rollback rail was located', fbRail.length > 300);
ok('the rollback dock was located', fbDock.length > 300);
// Read off the PARSED objects. Testing the JS source form against JSON.stringify output could
// never match -- the property was invisible to this check until a mutation proved it.
eq('the rollback rail declares no position, so it stays in flow', s.memHeaderFb.position, undefined);
eq('...and neither does the rollback dock', s.pgBarFb.position, undefined);
eq('...nor a top/left/right/bottom that would lift either out of the column',
  ['top', 'left', 'right', 'bottom', 'zIndex']
    .filter((p) => s.memHeaderFb[p] !== undefined || s.pgBarFb[p] !== undefined), []);
ok('...and are still the column\'s own children', /<div className="ezhome" style=\{headSt\}>/.test(rdSrc)
  && /<div ref=\{barRef\} className="ezhome" style=\{barSt\}>/.test(rdSrc));
okOn('the rollback reader draws NO navy anywhere', [["fbDock", fbDock], ["fbRail", fbRail]],
  !/s\.memHeader\b|s\.memTitle\b|s\.memBackBtn\b/.test(fbRail) && !/s\.memHeader\b/.test(fbDock));
okOn('...and no legacy pager presentation either', [["fbDock", fbDock]],
  !/s\.pgBar\b|s\.pgNavBtn\b|s\.pgNavOff\b|s\.pgMeta\b/.test(fbDock));
ok('the rollback branch reads the istana objects', /: s\.memHeaderFb;/.test(rdSrc) && /: s\.pgBarFb;/.test(rdSrc));
ok('...which carry no gradient and no literal colour',
  !/gradient/.test(JSON.stringify(s.memHeaderFb) + JSON.stringify(s.pgBarFb))
  && !/#[0-9a-fA-F]{3,8}|rgba?\(/.test(JSON.stringify([s.memHeaderFb, s.pgBarFb, s.memTitleFb, s.memBtnFb, s.pgNavBtnFb, s.pgMetaFb])));
ok('...and take their surface from the a3 scope the elements carry',
  s.memHeaderFb.background === 'var(--a3-surface)' && s.pgBarFb.background === 'var(--a3-surface)'
  && (rdSrc.match(/className="ezhome" style=\{(headSt|barSt)\}/g) || []).length === 2);
// THE BOX, property for property against the object each one replaces.
for (const p of ['display', 'alignItems', 'justifyContent', 'padding'])
  eq('the rollback rail keeps memHeader\'s ' + p, s.memHeaderFb[p], s.memHeader[p]);
for (const p of ['display', 'alignItems', 'justifyContent', 'gap', 'padding'])
  eq('the rollback dock keeps pgBar\'s ' + p, s.pgBarFb[p], s.pgBar[p]);
eq('the rail\'s hairline is still exactly 1px', String(s.memHeaderFb.borderBottom).split(' ')[0], '1px');
eq('the dock\'s hairline is still exactly 1px', String(s.pgBarFb.borderTop).split(' ')[0], '1px');
// The two heights, composed from the parts rather than trusted: padding + tallest control +
// hairline. 65 and 53 were MEASURED in the browser before the repaint and are what the SVG
// paper is fitted against, so they are arithmetic here and not a comment.
const padY = (v) => 2 * parseFloat(String(v).split(' ')[0]);
const hairline = (v) => parseFloat(String(v).split(' ')[0]);
eq('the rollback rail still composes to 65', padY(s.memHeaderFb.padding) + s.memBtnFb.height + hairline(s.memHeaderFb.borderBottom), 65);
eq('the rollback dock still composes to 53', padY(s.pgBarFb.padding) + s.pgNavBtnFb.height + hairline(s.pgBarFb.borderTop), 53);
eq('...and the controls are the same height they always were', s.memBtnFb.height, s.memBackBtn.height);
eq('...on both bars', s.pgNavBtnFb.height, s.pgNavBtn.height);
eq('the dock\'s nav control keeps its width too', s.pgNavBtnFb.width, s.pgNavBtn.width);
eq('the jump well is untouched, so the dock\'s content row is still 36',
  JSON.stringify(s.pgJumpWrap), JSON.stringify({ minWidth: 128, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }));
eq('the rail title keeps its metrics', s.memTitleFb.fontSize, s.memTitle.fontSize);
// the bounded inner row is WEIGHTLESS -- it may centre, it may not add height.
const fbInner = (css.match(/\.ezmr-fb-inner\{([^}]*)\}/) || [])[1] || '';
ok('the bounded inner row exists and is used', fbInner.length > 20
  && (rdSrc.match(/className="ezmr-fb-inner"/g) || []).length === 2);
ok('...and it is centred and bounded', /max-width:1100px/.test(fbInner) && /margin:0 auto/.test(fbInner));
ok('...and adds no padding, margin, border or height of its own',
  !/padding|border|min-height|height/.test(fbInner) && /margin:0 auto/.test(fbInner));
ok('nothing in the rollback chrome shouts over inline paint with !important',
  !/\.ezmr-fb[^{]*\{[^}]*!important/.test(css));
ok('the rollback chrome has a visible focus ring',
  /\.ezmr-fb-btn:focus-visible\{[^}]*outline:3px solid var\(--ez-focus\)/.test(css));
ok('the rollback chrome animates nothing and paints no image',
  !/\.ezmr-fb[^{]*\{[^}]*(animation|transition|background-image|gradient|url\(|backdrop-filter)/.test(css));
// EVERY control survived the repaint, with its handler and its name.
ok('rollback back is the same handler and text', /onClick=\{onExit\} className="ezmr-fb-btn" style=\{s\.memBtnFb\}>السور<\/button>/.test(fbRail));
ok('rollback bookmark keeps its handler and both its names',
  /onClick=\{putMark\} title=\{marked \? 'علامتك هنا' : 'ضع العلامة'\} aria-label=\{marked \? 'علامتك هنا' : 'ضع العلامة'\}/.test(fbRail));
ok('rollback previous keeps its handler, glyph and bound',
  /onClick=\{\(\) => commit\(-1\)\} disabled=\{page <= 1\} className="ezmr-fb-btn" style=\{s\.pgNavBtnFb\}>›<\/button>/.test(fbDock));
ok('rollback next keeps its handler, glyph and bound',
  /onClick=\{\(\) => commit\(1\)\} disabled=\{page >= 604\} className="ezmr-fb-btn" style=\{s\.pgNavBtnFb\}>‹<\/button>/.test(fbDock));
ok('rollback jump keeps both its names', /aria-label="اذهب إلى صفحة"/.test(fbDock) && /aria-label="رقم الصفحة"/.test(fbDock));
eq('the rollback chrome draws the same five controls',
  ['onClick={onExit}', 'onClick={putMark}', 'onClick={() => commit(-1)}', 'onClick={() => commit(1)}',
   'onClick={() => setJump(String(page))}'].filter((h) => (fbRail + fbDock).indexOf(h) !== -1).length, 5);

/* ---- M3. every control survived, with its handler and its name ---------- */
ok('back is still the same handler and the same text',
  /className="ezmr-btn" style=\{s\.ezmrJump\}>السور<\/button>/.test(shipped)
  && /onClick=\{onExit\} className="ezmr-btn"/.test(shipped));
ok('the bookmark keeps its handler and BOTH its names',
  /onClick=\{putMark\} title=\{marked \? 'علامتك هنا' : 'ضع العلامة'\} aria-label=\{marked \? 'علامتك هنا' : 'ضع العلامة'\}/.test(shipped));
ok('previous keeps its handler, its glyph and its disabled bound',
  /onClick=\{\(\) => commit\(-1\)\} disabled=\{page <= 1\} className="ezmr-btn" style=\{s\.ezmrNav\}>›<\/button>/.test(shipped));
ok('next keeps its handler, its glyph and its disabled bound',
  /onClick=\{\(\) => commit\(1\)\} disabled=\{page >= 604\} className="ezmr-btn" style=\{s\.ezmrNav\}>‹<\/button>/.test(shipped));
ok('the page indicator still opens the jump, under the same name',
  /onClick=\{\(\) => setJump\(String\(page\)\)\} aria-label="اذهب إلى صفحة"/.test(shipped));
ok('...and the jump field keeps its name, its normaliser and its escapes',
  /aria-label="رقم الصفحة"/.test(shipped) && /if \(e\.key === 'Enter'\) jumpGo\(\); else if \(e\.key === 'Escape'\) setJump\(null\);/.test(shipped));
ok('the wird control keeps its handler and its name',
  /onClick=\{\(\) => setPicker\(true\)\} aria-label="وردُ اليوم"/.test(rdSrc));
ok('...and is still a bounded pill beside the dock, not inside it',
  /\bwirdBtn: \{[^}]*borderRadius: 999/.test(html) && /<div style=\{wirdSt\}>/.test(rdSrc));
// Counted in the SHIPPED branches, never in rdSrc: the rollback bars carry the same five
// handlers, so counting the whole component would keep saying six while the istana rail stood
// empty. The wird is the sixth and lives outside both branches by design, so it is named apart.
eq('the shipped chrome still draws its five controls',
  ['onClick={onExit}', 'onClick={putMark}', 'onClick={() => commit(-1)}', 'onClick={() => commit(1)}',
   'onClick={() => setJump(String(page))}'].filter((h) => shipped.indexOf(h) !== -1).length, 5);
ok('...and the wird is the sixth, beside them', rdSrc.indexOf('onClick={() => setPicker(true)}') !== -1);

/* ---- M4. the chrome's BEHAVIOUR is frozen ------------------------------- */
ok('the chrome still starts visible', /const \[chromeOn, setChromeOn\] = useState\(true\);/.test(rdSrc));
eq('both overlays are gated on the same chromeOn as before, and only those two',
  (rdSrc.match(/\{chromeOn && \(MADINA_IMG_ON \?/g) || []).length, 2);
eq('...and no other chromeOn gate was invented', (rdSrc.match(/\{chromeOn && /g) || []).length, 2);
ok('the one-shot collapse latch is unchanged',
  /const chromeAuto = useRef\(false\);/.test(rdSrc)
  && /if \(\(!MUSHAF_SVG_ON && !MADINA_IMG_ON\) \|\| chromeAuto\.current\) return;\s*\n\s*chromeAuto\.current = true;\s*\n\s*setChromeOn\(false\);/.test(rdSrc));
eq('...and it is still fired from land() and jumpTo(), and from nowhere else',
  (rdSrc.match(/readerTurnedPage\(\);/g) || []).length, 2);
// THE TAP BLOCK, byte for byte.
const TAP_BLOCK = `  const onTap = (x, y) => {
    const R = tapRef.current;
    const now = Date.now();
    if (R.timer && now - R.t <= MUSHAF_TAP_MS &&
        Math.abs(x - R.x) <= MUSHAF_TAP_SLOP && Math.abs(y - R.y) <= MUSHAF_TAP_SLOP) {
      clearTimeout(R.timer); R.timer = null; R.t = 0;
      setZoom((z) => (z ? null : { k: MUSHAF_ZOOM_K, tx: 0, ty: 0 }));
      return;
    }
    R.t = now; R.x = x; R.y = y;
    if (R.timer) clearTimeout(R.timer);
    R.timer = setTimeout(() => { R.timer = null; setChromeOn((v) => !v); }, MUSHAF_TAP_MS);
  };`.replace(/\n/g, '\r\n');
ok('the tap-to-restore block is byte-identical', html.indexOf(TAP_BLOCK) !== -1);
ok('...and its window is unchanged', /const MUSHAF_TAP_MS = 300;/.test(html));
ok('the wird dwell is unchanged', /const WIRD_DWELL_MS = 8000;/.test(html));
// ITEM 22+104 -- RE-CUT ONTO THE OPPOSITE CONTRACT, and kept as an assertion rather than
// dropped. The owner ruled that the wird is the FIRST thing that should leave the eye while
// reading, so the strip is gated on `chromeOn` and is ABSENT FROM THE DOM in reading mode.
// What this check is FOR has not changed: that the reader's chrome and the wird strip move
// together under ONE rule instead of drifting apart. Only the rule flipped, and both halves
// are stated positively now -- the position no longer names `chromeOn` (that branch became
// unreachable the moment the render gate took it), and the render gate does name it, with
// MADINA_IMG_ON still FIRST so ?madinaimg=0 keeps rolling the strip back on its own.
//
// rdSrc is '' when the reader region cannot be found, and '' satisfies every negative test
// written against it -- so the region is asserted FOUND before anything is concluded from it.
ok('the reader region was found (an empty slice must not pass as agreement)', rdSrc.length > 0);
ok('the wird strip now leaves WITH the chrome',
  /const wirdBottomMost = !\(barH > 0\);/.test(rdSrc)
  && /\{MADINA_IMG_ON && chromeOn && \(\s*\n\s*<div style=\{wirdSt\}/.test(rdSrc));
// ...AND THE COUNT DOES NOT LEAVE WITH IT. Gating the strip on `chromeOn` is one keystroke
// away from gating the DWELL on it too, which would credit a reader nothing for exactly the
// session this item exists to protect. The dwell effect must name `chromeOn` nowhere -- not
// in a condition, not in its dependency array -- and must still credit the page it is on.
{
  const dStart = rdSrc.indexOf('const arm = () => {');
  const dEnd = dStart < 0 ? -1 : rdSrc.indexOf('}, [state, page]);', dStart);
  const dwell = dStart >= 0 && dEnd > dStart ? rdSrc.slice(dStart, dEnd) : '';
  ok('...and the wird COUNT does not leave with it', dwell.length > 0
    && dwell.indexOf('chromeOn') === -1
    && dwell.indexOf('setWirdDay(markWirdPageRead(page))') !== -1);
}
ok('back from the reader is still the index, never the chat',
  /if \(selected\) return <PagedMushaf startSurah=\{selected\} startPage=\{[^}]*\} onExit=\{ezikGoBack\} \/>;/.test(html)
  && /useEzikBackLayer\(selected != null, leaveSurah\);/.test(html));
ok('the storage keys are untouched',
  /MUSHAF_BOOKMARK_KEY = 'mushaf_bookmark_v1'/.test(html)
  && /MUSHAF_LAST_PAGE_KEY = 'mushaf_last_page_v1'/.test(html)
  && /WIRD_TARGET_KEY = 'mushaf_wird_target_v1'/.test(html)
  && /WIRD_DAY_KEY = 'mushaf_wird_day_v1'/.test(html));

/* ---- M5. the PAGE is frozen -- geometry, paint and the box round it ----- */
ok('pgViewport is byte-identical',
  html.indexOf("pgViewport: { flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', touchAction: 'pan-y', background: 'var(--tint)', direction: 'ltr' },") !== -1);
ok('the page strip is byte-identical',
  html.indexOf("pgStrip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, willChange: 'transform', direction: 'ltr' },") !== -1);
ok('the page cell is byte-identical',
  html.indexOf("pgSlot: { position: 'absolute', top: 0, bottom: 0, width: '100%', boxSizing: 'border-box', padding: '0 6px', direction: 'rtl', display: 'flex', flexDirection: 'column', justifyContent: 'center' },") !== -1);
ok('the sheet box is byte-identical',
  html.indexOf("const MADINA_SHEET_ST = { flex: 1, minHeight: 0, width: '100%', display: 'flex', background: MADINA_DESK };") !== -1);
ok('the viewport is still the direct parent of the strip -- no wrapper was inserted',
  /<div style=\{vpSt\} onTouchStart=\{onStart\} onTouchMove=\{onMove\} onTouchEnd=\{onEnd\} onTouchCancel=\{onEnd\}>\s*\n\s*<div style=\{strip\} onTransitionEnd=\{onTransEnd\}>/.test(rdSrc));
ok('the image keeps fill on a portrait phone', /objectFit: 'fill'/.test(html) && /MADINA_FILL_Q = '\(orientation: portrait\) and \(max-width: 700px\)'/.test(html));
ok('...and contain everywhere else', /MADINA_IMG_ST_FIT = \{ \.\.\.MADINA_IMG_ST, objectFit: 'contain', margin: 'auto' \}/.test(html));
const imgSt = (html.match(/const MADINA_IMG_ST = \{([^}]*)\}/) || [])[1] || '';
for (const prop of ['transform', 'filter', 'opacity', 'mixBlendMode', 'border', 'background', 'objectPosition'])
  okOn('the page image declares no ' + prop + ' of its own', [["imgSt", imgSt]], imgSt.indexOf(prop) === -1);
ok('the page hook is still the positive handle, exactly once',
  (html.match(/data-mushaf-page=\{page\.n\}/g) || []).length === 1);
ok('...and STILL no CSS rule anywhere targets it', !/\[data-mushaf-page/.test(css));
ok('no rule targets the viewport, the strip or the sheet box either',
  !/\[style\*="pgViewport"|\.pg-viewport|\.pg-strip|\.pg-slot/.test(css));
ok('the desk behind the page is a flat token, never a pattern',
  /const vpSt = MADINA_IMG_ON\s*\r?\n\s*\? \{ \.\.\.s\.pgViewport, background: MADINA_DESK,/.test(rdSrc)
  && /const MADINA_DESK = 'var\(--madina-desk\)';/.test(html));
ok('...and the slot round it still adds only the safe area',
  /const slotSt = MADINA_IMG_ON\s*\r?\n\s*\? \{ \.\.\.s\.pgSlot, padding: MADINA_SAFE_PAD \}/.test(rdSrc));
// ITEM 33. The neighbourhood is STILL exactly two deep -- next and previous, never a third --
// and it is now clamped by the ceiling the worker keeps on the page store. Both halves are
// pinned: dropping the clamp would let a widened prefetch evict the page being read, and
// widening [1, -1] is the waterfall this line has refused since item 79.
ok('the neighbour prefetch is still two deep, and clamped by the store ceiling',
  /for \(const d of \[1, -1\]\.slice\(0, MADINA_PAGE_CACHE_CAP\)\)/.test(html)
  && /onSheetLoad=\{prefetchMushafSvg\}/.test(rdSrc));
ok('...and only the current sheet carries it',
  (rdSrc.match(/onSheetLoad=\{prefetchMushafSvg\}/g) || []).length === 1);

/* ---- M6. the SVG fallback and its opt-out are frozen -------------------- */
ok('the WebP -> SVG -> text fallback chain is intact',
  /if \(madina && !imgBroke\)/.test(html) && /onError=\{\(\) => setImgBroke\(true\)\}/.test(html)
  && /if \(!MUSHAF_SVG_ON \|\| broke\)/.test(html) && /onError=\{\(\) => setBroke\(true\)\}/.test(html));
ok('the SVG sheet still carries .mushaf-paper', /<div className="mushaf-paper" style=\{s\.svgFrame\}>/.test(html));
ok('the sacred opt-out still pins its four literals',
  /:root\[data-ezik-visual-theme\] \.mushaf-paper\{[\s\S]{0,240}--red:#1D4ED8[\s\S]{0,240}--ink:#1A1A1A[\s\S]{0,240}--white:#FFFFFF/.test(css));
ok('...and the sheet still opts out of dark with color-scheme light',
  /:root\[data-theme="dark"\] \.mushaf-paper\s*\{[^}]*color-scheme:\s*light/.test(css));

/* ============ N. THE ISTANA CHAT (S112) ==================================
 * The conversation screen. It was the last full-height legacy surface in index.html and it is
 * the one this group is about -- but only its PRESENTATION moved, so most of what follows is a
 * FREEZE: the handlers, the endpoints, the payload, the storage keys and the accessible names
 * are named here so that moving one fails, never so that this commit may move them.
 *
 * EVERY CHECK IS CUT TO THE CHAT. The chat's JSX is sliced from its root element to the line
 * that follows its closing brace, and MessageBubble from its signature to the next top-level
 * declaration. That matters: index.html still contains a navy gradient, a full-width bar and a
 * floating control -- on OTHER screens -- so "the navy header is gone" asserted against the
 * whole file would be a check that can only ever fail, or be quietly weakened until it passes.
 * ---------------------------------------------------------------------- */
console.log('\n=== N. THE ISTANA CHAT ===');

const chatRoot = '<div className="theme-dark ezhome ezc" style={s.chatContainer}>';
const chatAt = html.indexOf(chatRoot);
const chatEnd = html.indexOf('// Per-message listen button', chatAt);
const chatSrc = (chatAt !== -1 && chatEnd > chatAt) ? html.slice(chatAt, chatEnd) : '';
ok('the chat body was located and bounded', chatSrc.length > 8000 && chatSrc.length < 40000,
  'len=' + chatSrc.length);
const mbAt = html.indexOf('const MessageBubble = React.memo(function MessageBubble(');
const mbEnd = mbAt === -1 ? -1 : html.indexOf('\n// ====', mbAt);
const mbSrc = (mbAt !== -1 && mbEnd > mbAt) ? html.slice(mbAt, mbEnd) : '';
ok('the message bubble was located and bounded', mbSrc.length > 4000, 'len=' + mbSrc.length);
// The chat's own rules, isolated the same way group H isolates the istana home's.
const ezcRules = (css.match(/\.ezc[a-z0-9-]*(?:[^{}]*)\{[^}]*\}/g) || []);
// S118: the menu is no longer written inside the chat's return. It is ONE function defined
// above the screen ladder and called by the chat AND by the home, because openDrawer() from the
// home used to set state that nothing rendered. It is still one panel, one overlay and one
// conversation list -- asserted at the bar's own check in group H -- so it is sliced from where
// it now lives rather than from the chat.
const drawerAt = html.indexOf('const ezikDrawer = () => drawerOpen && (');
const drawerSrc = drawerAt === -1 ? '' : html.slice(drawerAt, html.indexOf('// S115: the boot mark', drawerAt));
// The chat's MARKUP, with its prose taken out. The notes in this region name the very things
// the checks below forbid -- "the navy gradient slab that ran the full width" -- and a scan that
// counted them would be answered by deleting the explanation rather than the defect.
const chatCode = chatSrc.replace(/\/\*[\s\S]*?\*\//g, ' ');
ok('the chat declares its own rule set', ezcRules.length > 20, 'found ' + ezcRules.length);
ok('the drawer markup was located inside it', drawerSrc.length > 3000, 'len=' + drawerSrc.length);

/* ---- N1. the identity, and that the inventory line was EARNED ----------- */
// 1) the chat is on .ezc-, at the mount and in every one of its four pieces.
const CHAT_ON_EZC =
  html.indexOf(chatRoot) !== -1
  && /<div className="ezc-rail">/.test(chatSrc)
  // STREAM-P4 §٣/١ made this className an expression, because the pin has to switch off the
  // scroller's bottom-aligning auto margin while a question is held at the top. The identity is
  // still asserted literally, and the ONLY thing the expression is allowed to append is that one
  // pin class — a computed className that could evaluate to anything would retire this check
  // rather than update it.
  && /<div ref=\{messagesAreaRef\} onScroll=\{onMessagesScroll\} className=\{'ezc-scroll' \+ \(pinnedAskIndex == null \? '' : ' ezc-askpinned'\)\}/.test(chatSrc)
  && /<div className="ezc-dock">/.test(chatSrc)
  // S118: the drawer is drawn BY the chat and is still exactly one element, but it is defined
  // above the screen ladder now so that the home can draw the same one. Asserted against the
  // slice that holds it, and against the chat actually calling it.
  && /<div className="ezc-drawer" role="dialog" aria-modal="true">/.test(drawerSrc)
  && /\{ezikDrawer\(\)\}/.test(chatSrc);
ok('N1: the chat mounts on the ezc identity, in all four of its pieces', CHAT_ON_EZC);
eq('N1: ...and THAT is why the inventory calls it istana', INDEX_SCREENS.chat.shell,
  CHAT_ON_EZC ? 'istana' : 'legacy');
ok('N1: the chat root also carries .ezhome, so the a3 tokens are in scope',
  html.indexOf(chatRoot) !== -1);
ok('N1: no ezc selector can match html, body or :root',
  !ezcRules.some((r) => /(^|[,\s])(html|body|:root)[\s,{]/.test(r.split('{')[0])));

/* ---- N2. the legacy navy header is GONE, keys and all ------------------- */
okOn('N2: the chat draws no navy masthead', [["chatSrc", chatSrc]], !/s\.header\b/.test(chatSrc) && !/s\.settingsBtn\b/.test(chatSrc));
ok('N2: ...and the keys that painted it no longer exist',
  !('header' in s) && !('settingsBtn' in s) && !('headerTitle' in s) && !('avatar' in s));
okOn('N2: no gradient is spread anywhere in the chat body', [["chatSrc", chatSrc]], !/gradient/.test(chatCode));
ok('N2: ...nor by any object the chat draws from',
  ['chatContainer', 'messagesArea', 'messageBubble', 'userBubble', 'assistantBubble', 'inputBar',
    'input', 'sendBtn', 'micBtn', 'toolBtn', 'toolBar', 'quickRow', 'quickBtn', 'drawerTop',
    'drawerItem', 'errorBanner'].filter((k) => /gradient/.test(JSON.stringify(s[k] || {}))).length === 0);

/* ---- N3..N6. the four bounded pieces, measured off the stylesheet ------- */
const measure = (/\.ezc\{[^}]*--ezc-measure:(\d+)px/.exec(css) || [])[1];
ok('N3: the chat declares ONE measure and it is a reading column', +measure >= 820 && +measure <= 900,
  'measure=' + measure);
ok('N3: the top rail is bounded by it, and is not a slab',
  /\.ezc-rail-inner\{[^}]*max-width:var\(--ezc-measure\)/.test(css)
  && /\.ezc-rail\{[^}]*justify-content:center/.test(css));
ok('N3: ...and sits inside the top safe area', /\.ezc-rail\{[^}]*env\(safe-area-inset-top/.test(css));
ok('N4: the transcript is bounded by the same measure, as the scroller\'s own padding',
  /\.ezc-scroll\{[^}]*calc\(\(100% - var\(--ezc-measure\)\) \/ 2\)/.test(css));
ok('N4: ...and nothing inline can beat that padding',
  !/padding/.test(JSON.stringify(s.messagesArea || {})),
  'messagesArea = ' + JSON.stringify(s.messagesArea));
// STREAM-P4 §٣/١ put the messages inside a keyed React.Fragment so a zero-height marker can be
// placed before the pinned question. A Fragment IS NOT A WRAPPER — it emits no DOM node, so the
// S97 opening pin still measures the same element and the ResizeObserver still observes the same
// children. What this check forbids is an ELEMENT around the transcript, and that is still
// forbidden: the map must be a direct child expression of the scroller, and the bubble must be
// the first element the Fragment opens.
ok('N4: ...and no wrapper was inserted between the scroll container and the messages',
  /className=\{'ezc-scroll'[^>]*style=\{s\.messagesArea\}>[\s\S]{0,1400}?\{messages\.map\(\(m, i\) => \([\s\S]{0,900}?<React\.Fragment key=\{i\}>[\s\S]{0,400}?<MessageBubble/.test(chatSrc));
ok('N4: ...and the marker it wraps them for is a bare node that draws nothing',
  /<div ref=\{pinAnchorRef\} aria-hidden="true" data-ezik-ask-pin="" \/>/.test(chatSrc));
ok('N5: the composer dock is bounded by the same measure',
  /\.ezc-dock-inner\{[^}]*max-width:var\(--ezc-measure\)/.test(css)
  && /\.ezc-dock\{[^}]*justify-content:center/.test(css));
ok('N5: ...and sits inside the bottom safe area',
  /\.ezc-dock\{[^}]*env\(safe-area-inset-bottom/.test(css));
ok('N6: the drawer is bounded on a phone', /\.ezc-drawer\{[^}]*width:320px[^}]*max-width:86vw/.test(css));
const wideDrawer = (/@media \(min-width:900px\)\{\s*\.ezc-drawer\{[^}]*width:(\d+)px/.exec(css) || [])[1];
ok('N6: ...and is an INSET panel on a desk, never a full-screen slab',
  +wideDrawer > 0 && +wideDrawer <= 400 && /@media \(min-width:900px\)\{\s*\.ezc-drawer\{[^}]*top:16px[^}]*right:16px[^}]*bottom:16px/.test(css),
  'desk width=' + wideDrawer);
ok('N6: ...and no ezc rule anywhere declares a viewport-wide box',
  !/\.ezc[a-z0-9-]*[^{]*\{[^}]*(width|min-width|max-width)\s*:\s*100vw/.test(css));

/* ---- N7/N8. light is plain white, dark is a real second rendering ------- */
{
  const lightPal = VT_PAL['istana_33:light'];
  const darkPal = VT_PAL['istana_33:dark'];
  const lit = resolve(s.chatContainer.background, lightPal);
  const drk = resolve(s.chatContainer.background, darkPal);
  ok('N7: the chat page in istana light is plain #FFFFFF', !!lit && hex(lit) === '#ffffff', String(lit && hex(lit)));
  ok('N7: ...and the page root attaches no image behind it',
    /:root\[data-ezik-visual-theme\] body\{[^}]*background-image:none/.test(css));
  ok('N8: the dark rendering is a different page, not an inverted one',
    !!drk && hex(drk) !== hex(lit), String(drk && hex(drk)));
  ok('N8: ...and the chat declares its own dark value for the one colour it owns',
    /\.ezc\{[^}]*--ezc-scrim:/.test(css) && /:root\[data-theme="dark"\] \.ezc\{[^}]*--ezc-scrim:/.test(css));
}

/* ---- N9. no pattern, no gradient, no image, no drawn pseudo-element ----- */
{
  const patterned = ezcRules.filter((r) => /url\(|gradient|repeat|background-image\s*:\s*(?!none)/.test(r));
  eq('N9: not one ezc rule attaches an image, a gradient or a repeat', patterned, []);
  // `content:` only as a DECLARATION -- `justify-content:` is not one, and matching it would
  // have made this check unfailable-by-construction rather than true.
  // 44-ج: AN INVISIBLE PSEUDO-ELEMENT IS NOT A DRAWING. This check used to ask whether an ezc
  // pseudo-element EXISTS, as a proxy for whether anything is painted over the transcript. The
  // touch-target overlay is a ::before on .ezc-icon and on the buttons inside .ezc-acts and
  // .ezc-row, and it paints nothing at all: no background, no border, no shadow, no image, and
  // `content:""`. So the question is now asked directly rather than through the proxy — which
  // makes it STRICTER about painting (a background on a pseudo-element is now named as such)
  // and honest about an empty box that only catches a thumb.
  const ezcPseudo = (css.match(/\.ezc[a-z0-9-]*[^{}]*::(?:before|after)[^{}]*\{[^}]*\}/g) || []);
  const painting = ezcPseudo.filter((r) => /background|border(?!-radius)|box-shadow|outline|url\(|gradient|(^|[;{]\s*)color\s*:/.test(r));
  eq('N9: ...and no pseudo-element PAINTS over the transcript', painting, []);
  ok('N9: ...and any that exists is an empty box and nothing more',
    // A rule that merely ADJUSTS an already-declared overlay carries no content of its own,
    // and that is not a drawing either. What is forbidden is a pseudo-element that puts glyphs
    // on screen, so the test is: if it declares content at all, that content is empty.
    ezcPseudo.every((r) => !/content\s*:/.test(r) || /content:\s*""/.test(r)),
    ezcPseudo.filter((r) => /content\s*:/.test(r) && !/content:\s*""/.test(r)).join(' | '));
  // A `content:` on a real ezc rule is still forbidden outright: that would put glyphs on screen.
  ok('N9: ...and no ezc rule of its own declares content',
    !ezcRules.filter((r) => !/::(?:before|after)/.test(r)).some((r) => /[;{]\s*content\s*:/.test(r)));
  const litRules = ezcRules.filter((r) => /(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(r) && !/--ezc-scrim/.test(r));
  eq('N9: ...and the only colour it states of its own is the modal scrim', litRules, []);
}

/* ---- N10. a NEW chat is an EMPTY chat --------------------------------- */
ok('N10: the reset is the shipped one, unchanged', html.indexOf('const newChat = () => { resetThread(); };') !== -1);
// S118: the home's explicit entry is the menu's «محادثة جديدة» row now, and it does the same
// two things this string used to do inline -- reset, then land on the chat.
ok('N10: the explicit entry from home still starts a new one',
  html.indexOf("const startChatFromMenu = () => { newChat(); setScreen('chat'); };") !== -1
  && drawerSrc.indexOf('onClick={() => closeDrawerWith(startChatFromMenu)}') !== -1
  && /<Home profile=\{profile\} onOpenMenu=\{openDrawer\}/.test(html));
ok('N10: the boot lands on an EMPTY thread and opens no saved conversation',
  /chatIdRef\.current = null;\s*\r?\n\s*setChatId\(null\);\s*\r?\n\s*setMessages\(\[\]\);\s*\r?\n\s*setChatList\(ezikListChats\(ezikProfileKey\(p\)\)\);\s*\r?\n\s*setScreen\('chat'\);/.test(html));
ok('N10: the welcome is shown ONLY while there is nothing to read',
  /\{messages\.length === 0 && streamingText === null && \(\s*\r?\n\s*<div className="ezc-empty">/.test(chatSrc));
// S118: this compared two offsets inside the chat's return, which stopped meaning anything the
// moment the menu was defined outside it. It is the same claim, said as containment: the list is
// in the menu and it is not in the transcript.
okOn('N10: ...and the history is not drawn inside the thread', [["chatSrc", chatSrc]],
  drawerSrc.indexOf('chatList.map(') !== -1 && chatSrc.indexOf('chatList.map(') === -1,
  'the conversation list must be inside the drawer, never in the transcript');
ok('N10: the empty state carries no text at all -- item 94 took the name, and no devotional text ever stood here',
  /<div className="ezc-empty"><\/div>/.test(chatSrc) && html.indexOf('ezc-empty-title') === -1);

/* ---- N11..N13. the store: keys, pin, delete --------------------------- */
ok('N11: the conversation keys are the shipped ones',
  /const EZIK_CHATS_KEY = 'ezik_chats_v1';/.test(html)
  && /const EZIK_CHAT_PREFIX = 'ezik_chat_v1_';/.test(html)
  && /const EZIK_FAVS_KEY = 'ezik_favorite_replies_v1';/.test(html));
ok('N11: ...read and written by the shipped readers and writers',
  /localStorage\.getItem\(EZIK_CHATS_KEY\)/.test(html)
  && /localStorage\.setItem\(EZIK_CHATS_KEY, JSON\.stringify\(list\)\)/.test(html)
  && /localStorage\.getItem\(EZIK_CHAT_PREFIX \+ id\)/.test(html));
ok('N12: a row still pins through the shipped handler',
  drawerSrc.indexOf('onClick={() => pinSavedChat(c.id)}') !== -1
  && html.indexOf('const pinSavedChat = (id) => { ezikToggleChatPin(id); refreshChatList(); };') !== -1);
okOn('N12: ...and pinning is a MARK on the store\'s own order, not a second list', [["chatSrc", chatSrc]],
  /className=\{'ezc-row' \+ \(c\.id === chatId \? ' is-on' : ''\) \+ \(c\.pinned \? ' is-pinned' : ''\)\}/.test(drawerSrc)
  && (html.match(/chatList\.map\(/g) || []).length === 1
  && !/chatList\.(sort|filter|slice|reverse)\(/.test(chatSrc));
ok('N13: a row still asks before deleting, and deletes through the shipped handler',
  drawerSrc.indexOf('onClick={() => setChatPendingDelete(c.id)}') !== -1
  && drawerSrc.indexOf('onClick={() => deleteSavedChat(c.id)}') !== -1
  && /const deleteSavedChat = \(id\) => \{\s*\r?\n\s*ezikDeleteChat\(id\);/.test(html));
ok('N13: ...and deleting the OPEN conversation still empties the thread',
  /if \(chatIdRef\.current === id\) resetThread\(\);/.test(html));

/* ---- N14..N17. the turn: send, endpoint, payload, stream --------------- */
ok('N14: the send button is in the dock and calls the shipped sender',
  /<button onClick=\{\(\) => sendMessage\(input\)\} disabled=\{isLoading \|\| \(!input\.trim\(\) && !pendingImage\)\}/.test(chatSrc));
// The window widened because STREAM-P4 §٣/١ arms the question-pin between these two statements.
// The count was only ever a proxy for «nothing substantial in between»; chat-history-guard.cjs
// carries the direct form of the same property (no `await` may separate them).
ok('N14: ...and the autosave still files on the QUESTION',
  /setMessages\(updated\);[\s\S]{0,1600}?saveMessages\(updated\);/.test(html));
ok('N15: text and call share the grounded answer endpoint',
  /endpoint = '\/api\/ask'/.test(html)
  && /const response = await aiFetch\(endpoint, \{/.test(html));
ok('N16: the request body is the shipped shape',
  html.indexOf("const __mkBody = (msgs) => ({ max_tokens: 4096, stream: true, name: p.name, age: p.age, gender: p.gender, mode, messages: msgs, ...__extra });") !== -1);
ok('N16: ...including the depth and band terms and the size fit',
  /fitMessagesToBudget\(__mkBody, history\.map\(m => \(\{ role: m\.role, content: m\.content \}\)\)\)/.test(html)
  && /depth: depthMode === 'scholar' \? 'scholar' : 'deep'/.test(html));
ok('N17: the stream is still read delta by delta into the live preview',
  /if \(evt\.type === 'content_block_delta' && evt\.delta && evt\.delta\.type === 'text_delta'\)/.test(html)
  && /onDelta: \(partial\) => \{ if \(abortRef\.current === controller\) \{ clearSearchingHint\(\); setStreamingText\(partial\); \} \}/.test(html));
ok('N17: ...and the live preview is still drawn, on the chat\'s own surface',
  /\{streamingText !== null && \(\s*\r?\n\s*<div className="ezc-turn is-ai">\s*\r?\n\s*<div style=\{\{ \.\.\.s\.messageBubble, \.\.\.s\.assistantBubble \}\}>/.test(chatSrc));

/* ---- N18. where a conversation opens ---------------------------------- */
ok('N18: the opening pin is still the pre-paint layout effect',
  /React\.useLayoutEffect\(\(\) => \{\s*if \(!jumpToEndRef\.current\) return;[\s\S]{0,200}?scrollTop = el\.scrollHeight;/.test(html));
ok('N18: ...still armed before the messages are handed to React',
  /jumpToEndRef\.current = true;\s*\r?\n\s*stickToEndRef\.current = true;\s*\r?\n\s*skipFollowRef\.current = 1;/.test(html));
ok('N18: ...and the follow effect still refuses to drag a reader back down',
  /if \(!stickToEndRef\.current\) return;/.test(html)
  && /messagesEndRef\.current\?\.scrollIntoView\(\{ behavior: ezikMotionReduced\(a11yRef\.current\.reduceMotion\) \? 'auto' : 'smooth' \}\)/.test(html));
ok('N18: ...over the SAME element, which still reports its own position',
  /<div ref=\{messagesAreaRef\} onScroll=\{onMessagesScroll\} className=\{'ezc-scroll'/.test(chatSrc));
// STREAM-P4 §٣/١ added a SECOND reason the follow effect may decline, and the two must not be
// confused. The reader's own «I have scrolled up» is `stickToEndRef`; the question-pin is its own
// flag and is checked separately, so the pin cannot be satisfied by quietly clearing the reader's
// state — which would have left them at the bottom for the NEXT turn as well.
ok('N18: ...and the pin declines the follow WITHOUT touching the reader\'s own position',
  /if \(pinActiveRef\.current\) return;\s*\r?\n\s*if \(!stickToEndRef\.current\) return;/.test(html)
  && !/stickToEndRef\.current = false;/.test(html));

/* ---- N19..N22. the reply's own controls -------------------------------- */
ok('N19: copy still hands over the whole reply, built on the tap',
  /<CopyReplyButton text=\{String\(message\.content \|\| ''\)\.trim\(\)\} getText=\{buildCopyText\} \/>/.test(mbSrc)
  && /const buildCopyText = \(\) => serializeReply\(segments, \{ tashkeel, band: deriveCaps\(age\)\.band \}\);/.test(mbSrc));
ok('N20: quote still hands the composer that same text, and sends nothing',
  /onClick=\{\(\) => onQuote\(buildCopyText\(\)\)\}/.test(mbSrc)
  && /quoteReply = \([\s\S]{0,600}?setInput\(/.test(html)
  && !/quoteReply = \([\s\S]{0,900}?sendMessage\(/.test(html));
ok('N21: the star still toggles through the shipped writer, and still says so',
  /onClick=\{\(\) => onFavorite\(message, index\)\}/.test(mbSrc)
  && /aria-pressed=\{isFavorite \? 'true' : 'false'\}/.test(mbSrc)
  && /isFavorite=\{favFlags\[i\]\}/.test(chatSrc));
ok('N22: the source card is still built from the segment\'s own site and url',
  /<SourceCard key=\{i\} site=\{seg\.site\} url=\{seg\.url\} content=\{seg\.content\} \/>/.test(html));
ok('N22: ...through the ONE renderer, called by the chat sheet and nothing new',
  (html.split('function ezikRenderSegments').length - 1) === 1
  && ((html.match(/ezikRenderSegments\(/g) || []).length - 1) === 2
  // Item 86 re-pinned the context literal. It read:
  //   ezikRenderSegments\(shownSegments, \{ tashkeel, age, onPlayVerse, onPlaySurah, onStopAudio \}\)
  // and the ayah star adds two keys to it. What this check is FOR is unchanged and is what it
  // still pins: there is one renderer, it has exactly two callers, and the chat sheet reaches
  // its cards only through it.
  && /<div className="ezc-ans" style=\{\{ \.\.\.s\.assistantBubble[\s\S]{0,260}?ezikRenderSegments\(shownSegments, \{ tashkeel, age, onPlayVerse, onPlaySurah, onStopAudio, onFavoriteAyah, ayahFavIds \}\)/.test(mbSrc));
  ok('N22: ...and the ayah star is handed DOWN, never read from a store by the card',
    /function VerseCard\(\{ surah, surahNum, ayah, onPlayVerse, onStopAudio, onFavorite, isFavorite \}\)/.test(html)
      && !/function VerseCard[\s\S]{0,3000}?localStorage/.test(html));
okOn('N22: ...so nothing in the chat re-orders, filters or counts the sources', [["mbSrc", mbSrc]],
  !/segments\.(sort|filter|slice|reverse)\(/.test(mbSrc) && !/seg\.type === 'source'/.test(mbSrc));

/* ---- N23..N26. attachment, voice, call, model -------------------------- */
ok('N23: the two file inputs keep their exact accept lists',
  chatSrc.indexOf('<input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: \'none\' }} />') !== -1
  && chatSrc.indexOf('accept=".pdf,application/pdf,.txt,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onPickImage}') !== -1);
ok('N23: ...and the [+] is still gated on the band\'s own capability',
  /\{caps\.upload && \(/.test(chatSrc));
ok('N24: dictation is the same pair of handlers on the same button',
  /onClick=\{isListening \? stopListening : startListening\}/.test(chatSrc));
// The endpoint is the shipped one; what changed under it is the transport. Every AI send now
// goes through aiFetch, the one choke point that refuses without consent and attaches the
// consent header (Apple 5.1.1(i)) -- so this pins the endpoint AND the gate it passes through.
ok('N24: ...and speech still goes to the shipped endpoint',
  /await aiFetch\('\/api\/tts'/.test(html));
ok('N24: ...with the child voice barrier untouched',
  /const CHILD_VOICE_ENABLED = false;/.test(html)
  && /if \(screen === 'call' && childVoiceBlocked\(\)\) return <ChildVoiceNotice onBack=\{goEzikBack\} \/>;/.test(html));
ok('N25: the call entry still only sets the screen, so the guard ORDER decides the rest',
  /\{directConvoAllowed && \(\s*\r?\n\s*<button\s*\r?\n\s*onClick=\{\(\) => setScreen\('call'\)\}/.test(chatSrc)
  && html.indexOf("if (screen === 'call' && childVoiceBlocked())") < html.indexOf("if (screen === 'call' && !hasFounderToken())"));
ok('N26: the model chip cycles exactly the shipped three values',
  /const next = depthMode === 'brief' \? 'detailed' : depthMode === 'detailed' \? \(SCHOLAR_ENABLED \? 'scholar' : 'brief'\) : 'brief';/.test(chatSrc));
ok('N26: ...and a non-adult still cannot cycle at all',
  /if \(caps\.band !== 'adult'\) return;/.test(chatSrc)
  && /disabled=\{isLoading \|\| caps\.band !== 'adult'\}/.test(chatSrc));
// Item 84 NARROWED this check. It read, byte for byte:
//     ok('N26: ...and the two deep tiers still need the token, via the SAME unlock sheet',
//       /if \(\(next === 'detailed' \|\| next === 'scholar'\) && !hasFounderToken\(\)\) \{ setUnlockAsk\(next\); return; \}/.test(chatSrc));
// and the owner lifted exactly that requirement, so it now describes something that is not
// there. What replaces it is the rule the item DOES ask for: the list stays CLOSED to the two
// named tiers and is not opened to any third thing.
//
// It is checked against LIVE code and never against the whole file. The removed line was first
// quoted verbatim in a comment beside its own removal, and this check went on passing by
// matching that comment -- a guard satisfiable by dead text is worse than no guard at all.
okOn('N26: ...and the client no longer asks for the token to select a tier', [["chatSrc", chatSrc]],
  !/if \(\(next === 'detailed' \|\| next === 'scholar'\) && !hasFounderToken\(\)\)/.test(chatSrc)
  && chatSrc.indexOf('setUnlockAsk(') === -1);
ok('N26: ...but the depth it sends is still ONLY one of the two named tiers',
  /\{ depth: depthMode === 'scholar' \? 'scholar' : 'deep' \}/.test(html)
  && /depthMode !== 'brief' \? \{ depth:/.test(html));
ok('N26: ...and it is still adult-only, and still never sent for brief',
  /deriveCaps\(p\.age\)\.band === 'adult' && depthMode !== 'brief'/.test(html));
eq('N26: ...and no third depth value exists to be asked for',
  Array.from(new Set((html.match(/depth: depthMode === '\w+' \? '\w+' : '\w+'/g) || []))).length, 1);
// The SERVER lock is the lock, and this item did not touch it. Named here so that lifting the
// client wall can never be mistaken for lifting the wall.
ok('N26: ...and the server still judges the depth it is sent',
  fs.existsSync(path.join(__dirname, 'api', 'ask.js'))
  && /const effectiveDepth = mayRequestDepth \? readRequestedDepth\(body\.depth\) : undefined;/
    .test(fs.readFileSync(path.join(__dirname, 'api', 'ask.js'), 'utf8')));

/* ---- N27..N29. keyboard, names, and the way out of the drawer ---------- */
// ---- N27. WHAT `Enter` DOES, AND IN WHICH ORDER --------------------------
// THIS CHECK USED TO PIN THE OPPOSITE RULE. It asserted, byte for byte, the inline handler that
// sent on any bare Enter — and STREAM-P4 §٣/٢ is the owner's decision that a bare Enter must NOT
// send on a touch device, because Enter there is how a person writes a second line. So this is
// re-pinned to the rule that replaced it rather than deleted, and it is pinned to the ORDER,
// which is where the rule actually lives: a composition test placed after the touch test would
// still pass a byte-comparison and would still send half a question from a laptop.
{
  const at = (needle) => html.indexOf(needle);
  const handler = at('const onComposerKeyDown = (e) => {');
  const notEnter = at("if (e.key !== 'Enter') return;");
  const composing = at('if (composingRef.current || e.nativeEvent?.isComposing');
  const shift = at('if (e.shiftKey) return;');
  // Item 65 re-pinned this needle. It read, byte for byte:
  //     const touch = at('if (inputIsTouch) return;');
  // and the rule it stood for -- "a touch composer does not send on Enter" -- is now the
  // DEFAULT of a stored preference rather than the only possibility, so the test in that
  // slot is the resolved preference. The slot, and its position, are unchanged.
  const touch = at('if (!enterSends) return;');
  // Searched FROM the touch test rather than by an absolute needle: index.html is CRLF, and a
  // needle carrying a bare \n silently matches nothing and reports the order as broken.
  const send = touch === -1 ? -1 : html.indexOf('sendMessage(input);', touch);
  ok('N27: the composer has one Enter handler, and it is a named function',
    handler !== -1 && /onKeyDown=\{onComposerKeyDown\}/.test(chatSrc),
    'handler at ' + handler);
  ok('N27: ...and its four tests run in the order the rule is written in',
    handler !== -1 && notEnter > handler && composing > notEnter && shift > composing
      && touch > shift && send > touch,
    JSON.stringify({ handler, notEnter, composing, shift, touch, send }));
  ok('N27: ...composition is tested BEFORE anything else can send',
    composing !== -1 && composing < shift && composing < touch
      && /onCompositionStart=\{\(\) => \{ composingRef\.current = true; \}\}/.test(chatSrc)
      && /onCompositionEnd=\{\(\) => \{ composingRef\.current = false; \}\}/.test(chatSrc));
  ok('N27: ...touch is decided by the INPUT DEVICE, never by the window width',
    /e\.pointerType === 'touch' \|\| e\.pointerType === 'pen'/.test(html)
      && /matchMedia\('\(pointer: coarse\)'\)/.test(html)
      && !/innerWidth[^\n]{0,80}inputIsTouch/.test(html));
  // Item 65: was /enterKeyHint=\{inputIsTouch \? 'enter' : 'send'\}/ -- the hint now follows the
  // RESOLVED preference, which is the same thing whenever the preference is `auto`.
  ok('N27: ...and the key is labelled with whatever it is about to do',
    /enterKeyHint=\{enterSends \? 'send' : 'enter'\}/.test(chatSrc));
  // ...and the preference is a preference, not a second rule about composition. It is read
  // through ONE resolver, its default is the rule that shipped, and it sits BELOW the
  // composition and Shift tests -- a preference that could reach above them would be able to
  // send half a word from an IME, which is the defect test 2 exists to prevent.
  ok('N27: ...the Enter preference resolves in one place, and defaults to the shipped rule',
    /const ezikEnterSends = \(pref, isTouch\) => \{/.test(html)
      && /if \(pref === 'send'\) return true;/.test(html)
      && /if \(pref === 'newline'\) return false;/.test(html)
      && /return !isTouch;/.test(html)
      && /const EZIK_ENTER_AUTO = 'auto';/.test(html));
  ok('N27: ...and the composer resolves it through that one function, not by re-deriving it',
    /const enterSends = ezikEnterSends\(enterPref, inputIsTouch\);/.test(html));
  ok('N27: ...and no preference is consulted before composition or Shift have been tested',
    composing !== -1 && shift !== -1 && composing < touch && shift < touch);
}
ok('N27: ...and the textarea still grows only within its shipped bound',
  s.input && s.input.maxHeight === 200 && s.input.resize === 'none');
{
  // فتح القائمة الجانبية / إملاء صوتي /
  // مكالمة صوتية مباشرة / إرفاق ملف أو صورة / حذف
  const NAMES = ['فتح القائمة الجانبية',
    'إملاء صوتي', 'مكالمة صوتية مباشرة',
    'إرفاق ملف أو صورة'];
  const decodedChat = chatSrc.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const missing = NAMES.filter((n) => decodedChat.indexOf("aria-label={'" + n + "'}") === -1);
  eq('N28: every accessible name the chat shipped with is still on its control',
    missing.map((n) => [...n].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')), []);
  ok('N28: ...and the drawer still names its search box and its rows',
    /aria-label=\{EZIK_SEARCH_ARIA\}/.test(drawerSrc) && /aria-label=\{c\.pinned \? /.test(drawerSrc));
}
ok('N29: the drawer is still a real back layer',
  /useEzikBackLayer\(drawerOpen, \(\) => \{/.test(html)
  && html.indexOf('const closeDrawerWith = (fn) =>') !== -1);
eqOn('N29: ...and no control inside it closes behind the resolver\'s back', [["drawerSrc", drawerSrc]],
  (drawerSrc.match(/setDrawerOpen\(false\)/g) || []).length, 0);
ok('N29: ...the scrim included', /<div onClick=\{\(\) => closeDrawerWith\(null\)\} className="ezc-drawer-ov" \/>/.test(drawerSrc));

/* ---- N29-ب. ITEM 42-أ: THE REPLY'S ACTION RAIL --------------------------
 * MEASURED FIRST, THEN WIRED. Of the four permitted actions, three were already connected on the
 * reply and one was not:
 *
 *     copy       CopyReplyButton              -- wired
 *     favourite  the star, over ezik_favorite_replies_v1 -- wired
 *     listen     MessageListenButton          -- wired, through the server voice route. NOT
 *                                                 `speechSynthesis`, which appears NOWHERE in
 *                                                 index.html. Recorded, not rebuilt.
 *     share      -- NOT WIRED. It is the one control this item adds.
 *
 * A control that is already wired is not rebuilt, so the only new button here is share.
 */
const shareAt = html.indexOf('const ShareReplyButton = ({ getText }) =>');
const shareEnd = shareAt === -1 ? -1 : html.indexOf('\nconst MessageListenButton', shareAt);
const shareSrc = (shareAt !== -1) ? html.slice(shareAt, shareEnd === -1 ? shareAt + 2000 : shareEnd) : '';
ok('42-أ: the share button was located', shareSrc.length > 200, 'len=' + shareSrc.length);

okOn('42-أ: the reply rail carries the five permitted actions', [['mbSrc', mbSrc]],
  /<MessageListenButton /.test(mbSrc)
  && /<CopyReplyButton /.test(mbSrc)
  && /<ShareReplyButton /.test(mbSrc)
  && /<ExportPdfReplyButton /.test(mbSrc)
  && /onFavorite\(message, index\)/.test(mbSrc),
  'one of the five permitted reply actions is no longer on the rail');

// THE HARD LIMIT: ZERO MODEL CALL. The three banned actions are banned by name, and the rail is
// proved to build no request of ANY kind. The brain freeze is not lifted by this item.
okOn('42-أ: ...and none of them is a summary, a regeneration or a re-ask', [['mbSrc', mbSrc]],
  !/onSummar|summarise|summarize|onRegenerat|regenerate|reAsk|askAgain|retryAnswer/i.test(mbSrc),
  'a control that would call the brain appeared on the reply rail');
okOn('42-أ: the reply rail builds no request at all', [['mbSrc', mbSrc]],
  !/fetch\(|aiFetch\(|XMLHttpRequest|sendBeacon|EventSource|new WebSocket/.test(mbSrc),
  'the reply rail reached for the network');
okOn('42-أ: ...and the share button itself calls nothing', [['shareSrc', shareSrc]],
  !/fetch\(|aiFetch\(|XMLHttpRequest|sendBeacon|EventSource|\/api\//.test(shareSrc),
  'the share button acquired a request');

// ONE SERIALIZER AND ONE CLIPBOARD. Share hands over exactly what copy hands over, and where the
// platform sheet does not exist it degrades to the SAME clipboard path -- not to a second one.
okOn('42-أ: share hands over the same text the copy button does', [['mbSrc', mbSrc]],
  /<ShareReplyButton getText=\{buildCopyText\} \/>/.test(mbSrc)
  && /<CopyReplyButton text=\{[^}]*\} getText=\{buildCopyText\} \/>/.test(mbSrc));
okOn('42-أ: ...and degrades to the clipboard where there is no share sheet', [['shareSrc', shareSrc]],
  /if \(navigator\.share\)/.test(shareSrc)
  && /ezikWriteClipboard\(payload\)/.test(shareSrc));
okOn('42-أ: ...and a share the reader CANCELS is not reported as a failure', [['shareSrc', shareSrc]],
  /AbortError/.test(shareSrc));
// The reply's copy and the reply's share are the only two callers, and they call the same one.
eq('42-أ: the reply rail has exactly one clipboard path, used twice',
  (html.match(/await ezikWriteClipboard\(payload\)/g) || []).length, 2);

// 44x44 ON ALL FOUR, BY WIDENING THE AREA AND NOT THE SHAPE (44-ج). Every control on this rail
// is a `.ezc-acts button`, so the floor is the rule already shipped -- which is exactly why the
// new button needed no geometry of its own. The rule is asserted here so that a future edit
// cannot narrow it and silently take the floor away from all four at once.
ok('42-أ: the 44x44 floor still covers every control on the reply rail',
  /\.ezc-acts button::before/.test(css)
  && /\.ezc-acts button::before[^}]*min-width: ?44px/.test(css.replace(/\s+/g, ' '))
  && /\.ezc-acts button::before[^}]*min-height: ?44px/.test(css.replace(/\s+/g, ' ')),
  'the reply rail lost its 44px hit-area floor');
ok('42-أ: ...and it is an overlay, so no painted shape was changed',
  /\.ezc-acts button::before[^}]*width: ?100%/.test(css.replace(/\s+/g, ' '))
  && /\.ezc-acts button::before[^}]*height: ?100%/.test(css.replace(/\s+/g, ' ')));

// LISTEN IS RECORDED AS IT IS, NOT AS THE BRIEF ASSUMED. The browser speech engine is not in
// this file; the listen button runs through the app's own voice route. This assertion states
// the measured fact so that the report and the code cannot drift apart.
ok('42-أ: speechSynthesis is genuinely absent from the application file',
  html.indexOf('speechSynthesis') === -1 && html.indexOf('SpeechSynthesisUtterance') === -1,
  'a browser speech path appeared -- the listen button inventory in the report is now stale');

/* ---- N30..N32. the inventory, the call screen, and the repo ------------- */
// The fatwa search moves the whole-screen count by one; chat remains one of the thirteen. This
// later assertion deliberately repeats K2 so a stale downstream assumption fails visibly too.
eq('N30: the index inventory reads exactly 13 istana / 0 legacy / 3 interstitials',
  idxIstana.length + '/' + idxLegacy.length + '/' + Object.keys(INDEX_INTERSTITIALS).length, '13/0/3');
eq('N30: ...and the chat is one of them', INDEX_SCREENS.chat.shell, 'istana');
{
  const callAt = html.indexOf('function CallScreen(');
  const callSrc = callAt === -1 ? '' : html.slice(callAt, html.indexOf('\nfunction ', callAt + 10));
  ok('N31: the call screen was located', callSrc.length > 1000);
  // S113 note: the call screen has an identity of its own now (.ezcall-, group O). This check is
  // unchanged and still means what it always meant -- the CHAT's vocabulary may not leak into it,
  // so a shared class can never make two screens drift together by accident.
  okOn('N31: ...and the chat identity does not leak into it -- no ezc- class reaches it', [["callSrc", callSrc]],
    !/ezc-/.test(callSrc) && !/className="theme-dark ezhome ezc"/.test(callSrc));
}
{
  // The visual pass ran outside the repo, and this is what proves it: no harness, no seed, no
  // switch that only a test would set may have followed the work back in.
  const SMELLS = [/__mode\b/, /127\.0\.0\.1:87\d\d/, /localhost:87\d\d/, /\bFIXTURE\b/i,
    /\bMOCK_[A-Z_]+\b/, /DEBUG_CHAT/, /window\.__ezc/, /\?ezcdebug/];
  const hit = SMELLS.filter((re) => re.test(html)).map(String);
  eq('N32: no fixture, mock, harness or debug switch reached the shipped page', hit, []);
  const stray = fs.readdirSync(path.dirname(path.resolve(INDEX)))
    .filter((f) => /^(mock|fixture|seed|visual|drive|cdp|serve)[-.].*\.(c?js|mjs|json)$/i.test(f));
  eq('N32: ...and none was left in the repo either', stray, []);
}

/* ---- N33. and the things the review named that are not any of the above -- */
{
  // NO LITERAL COLOUR IN THE CHAT, anywhere: not in its markup, not in the objects it draws from.
  const litInJsx = (chatCode.match(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g) || [])
    .filter((x) => !/^#[0-9a-fA-F]{0,2}$/.test(x));
  eq('N33: the chat body states no colour of its own', litInJsx, []);
  const CHAT_KEYS = ['chatContainer', 'messagesArea', 'messageBubble', 'userBubble', 'assistantBubble',
    'bubbleText', 'quickRow', 'quickBtn', 'foldToggle', 'inputBar', 'input', 'sendBtn', 'micBtn',
    'toolBar', 'toolGroup', 'toolBtn', 'errorBanner', 'typingDots', 'searchingHint', 'dot',
    'drawerTop', 'drawerItem', 'drawerSearchWrap', 'drawerSearch', 'drawerEmpty', 'drawerBadge',
    'drawerSectionLabel', 'drawerChatRow', 'drawerChatOpen', 'drawerChatTitle', 'drawerChatIcon',
    'drawerConfirmText', 'drawerConfirmYes', 'drawerConfirmNo', 'drawerPinned', 'drawerProfile',
    'drawerAvatar', 'drawerProfileName', 'drawerGear', 'drawerResultRow', 'drawerResultBtn',
    'drawerResultTitle', 'drawerResultDate', 'drawerSnippet'];
  const missingKey = CHAT_KEYS.filter((k) => !s[k]);
  eq('N33: every style key the chat draws from still exists', missingKey, []);
  const litInKeys = [];
  for (const k of CHAT_KEYS) for (const p of Object.keys(s[k] || {})) {
    const v = String(s[k][p]);
    if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v)) litInKeys.push(k + '.' + p + '=' + v);
  }
  eq('N33: ...and not one of them carries a hardcoded colour', litInKeys, []);
  // THE DOCK IS IN FLOW. That -- not a computed padding -- is what keeps the last reply visible:
  // a dock that consumes its own height cannot be over anything.
  ok('N33: the composer dock is in flow and floats over nothing',
    !/\.ezc-dock\{[^}]*position\s*:/.test(css) && !/\.ezc-dock-inner\{[^}]*position\s*:/.test(css));
  ok('N33: ...and it is a SIBLING of the transcript, not a child of it',
    chatSrc.indexOf('<div className="ezc-dock">') > chatSrc.indexOf('<div ref={messagesEndRef} />'));
  // NO LARGE FLOATING CONTROL came back with the redesign.
  const oversize = ['sendBtn', 'micBtn', 'toolBtn'].filter((k) => (s[k] || {}).width > 56 || (s[k] || {}).height > 56);
  eq('N33: no composer control grew into a floating circle', oversize, []);
  ok('N33: the thread sits ON the composer without a second scroll container',
    /\.ezc-scroll>\*:first-child\{margin-block-start:auto\}/.test(css)
    && !/\.ezc-scroll\{[^}]*justify-content:flex-end/.test(css));
  // The reply's own rail, and the reading sheet it belongs to.
  ok('N33: the reply keeps its small action rail, in the chat\'s own vocabulary',
    /<div className="ezc-acts"/.test(mbSrc) && /className="ezc-ans"/.test(mbSrc));
  // The two turns are different STRUCTURES.
  ok('N33: a user turn and an assistant turn are laid out differently, not merely tinted',
    /<div className="ezc-turn is-user">/.test(mbSrc)
    && /\.ezc-turn\.is-user\{align-items:flex-start\}/.test(css)
    && /\.ezc-turn\.is-ai\{align-items:stretch\}/.test(css)
    && s.messageBubble.maxWidth === '78%' && s.assistantBubble.maxWidth === '100%');
  // Item 63. THE ANSWER'S INK IS ONE ROLE, said once and read twice. It used to be two
  // declarations -- the bubble on --a3-ink, the prose inside it on --ink -- which resolved to
  // the same colour in every theme and so could not be moved in one place. This pins the token,
  // pins BOTH sites to it, and pins that only LIGHT carries a literal: dark still defers to the
  // ink it always had, so a future theme cannot darken an answer that is already on a dark page.
  ok('N33: the answer ink is one token, and every answer site reads it',
    s.assistantBubble.color === 'var(--answer-ink)' && s.bubbleText.color === 'var(--answer-ink)'
      && s.mdH1.color === 'var(--answer-ink)' && s.mdH2.color === 'var(--answer-ink)'
      && s.mdH3.color === 'var(--answer-ink)',
    'bubble=' + s.assistantBubble.color + ' prose=' + s.bubbleText.color
      + ' h1=' + s.mdH1.color + ' h2=' + s.mdH2.color + ' h3=' + s.mdH3.color);
  // ITEM 63 VERIFY. The measurement that produced this: on cfb73ca, in light, on a real
  // markdown answer, the prose painted rgb(0,0,0) at 21.00:1 and a heading in the SAME answer
  // painted rgb(16,54,78) at 12.65:1. The three heading styles were the last readers of --ink
  // inside a reply, and this is what stops a fourth appearing: no style whose name begins mdH
  // may read --ink again.
  eq('N33: ...and no heading style inside an answer reads the general --ink any more',
    Object.keys(s).filter((k) => /^mdH/.test(k) && String((s[k] || {}).color) === 'var(--ink)'), []);
  ok('N33: ...black in light, and dark defers to the ink it already had',
    /--answer-ink:#000000\}/.test(css) && /--answer-ink:var\(--a3-ink\)\}/.test(css));
  eq('N33: ...and it is declared in exactly those two places',
    (css.match(/--answer-ink:/g) || []).length, 2);
  // Item 62. THE BACKGROUND HAS A REAL ZERO, and zero means removed. Before this, 0 fell into
  // the same arm as every out-of-range number and came back as the DEFAULT -- asking for no
  // watermark set it to medium. These pin the three things that made it real: 0 survives the
  // clamp, the writer marks the document, and the mark is display:none rather than transparent
  // (an element at opacity 0 still downloads its image).
  ok('N33: zero is a legal watermark value, and the only one below the floor that is',
    /if \(n === 0\) return 0;/.test(html)
      && /if \(n < EZIK_WM_MIN \|\| n > 1\) return EZIK_WM_DEFAULT;/.test(html));
  ok('N33: ...and zero REMOVES the mark rather than making it invisible',
    /setAttribute\('data-ezwm', n === 0 \? 'off' : 'on'\)/.test(html)
      && /:root\[data-ezwm="off"\] \.ezwm\{display:none\}/.test(css));
  ok('N33: ...and the reader can reach it, as a named control and not a slider end',
    /\[0, ezT\('settings.watermark.none'\)\]/.test(html)
      && /min=\{EZIK_WM_MIN\}/.test(html));
  ok('N33: ...and the default strength is untouched',
    /const EZIK_WM_DEFAULT = 0\.5;/.test(html)
      && /const EZIK_WM_PRESETS = \[0\.2, 0\.5, 0\.8\];/.test(html));
  // ...and the retreat while a reply arrives is an OPTION, off unless asked for, and it is not
  // a second stored strength: the class is the whole mechanism and the key is never written.
  ok('N33: the watermark retreat is opt-in, and absent storage means off',
    /localStorage\.getItem\(EZIK_WM_HIDE_KEY\) === 'on'/.test(html)
      && /catch \(e\) \{ return false; \}/.test(html));
  ok('N33: ...and it retreats only while a reply is actually arriving',
    /wmAutoHide && \(isLoading \|\| streamingText !== null\)/.test(html)
      && /\.ezwm\.is-quiet\{opacity:0\}/.test(css));
  eq('N33: ...and it never writes the strength key, so the mark comes back as it was',
    (html.match(/setItem\(EZIK_WM_KEY/g) || []).length, 1);
  ok('N33: ...and the animated turns still carry the class reduced motion switches off',
    (html.match(/className="ez-anim"/g) || []).length >= 4);
  // The empty menu SAYS it is empty.
  ok('N33: an empty history says so instead of ending in a blank space',
    /\{chatResults === null && chatList\.length === 0 && \(\s*\r?\n\s*<div style=\{s\.drawerEmpty\}>\{EZIK_CHATS_EMPTY\}<\/div>/.test(drawerSrc));
  // The rail says which conversation is open, and reads it rather than inventing it.
  // ITEM 94 (the rest of it): the brand fallback is GONE, so this is narrowed, not relaxed --
  // it now demands the exact absence of a fallback, the conditional span, AND that the chat's
  // own markup cannot name the brand at all, which the old form did not check.
  ok('N33: the rail title is the store\'s own, and when there is no conversation there is no title',
    /const ezcOpenChat = chatId \? chatList\.find\(\(c\) => c\.id === chatId\) : null;/.test(html)
    && /const ezcTitle = \(ezcOpenChat && ezcOpenChat\.title\) \? ezcOpenChat\.title : null;/.test(html)
    && /\{ezcTitle \? <span className="ezc-brand-text">\{ezcTitle\}<\/span> : null\}/.test(chatSrc)
    && chatSrc.indexOf('A2_BRAND') === -1
    && /<span className="ezc-brand-arch" aria-hidden="true" \/>/.test(chatSrc));
}

/* ============ O. THE ISTANA VOICE ROOM (S113) ============================
 * The call screen. Its PRESENTATION moved; nothing about the call did -- so this group is mostly
 * a FREEZE. The recogniser, the endpoints, the payload, the two barriers and their ORDER, the
 * cleanup and every handler are named here so that moving one fails, never so that this batch
 * may move them.
 *
 * Cut to the screen. CallScreen's own source is sliced from its string table to the section
 * comment that follows it, and the call MACHINERY (which lives on App, not in the component) is
 * sliced separately. index.html still contains gradients, 76px round buttons and white-on-navy
 * captions -- on OTHER screens -- so any of these checks asserted against the whole file would be
 * a check that can only fail, or be quietly weakened until it passes.
 * ---------------------------------------------------------------------- */
console.log('\n=== O. THE ISTANA VOICE ROOM ===');

const oAt = html.indexOf('const CALL_TXT = {');
const oEnd = html.indexOf('\n// ====', html.indexOf('function CallScreen('));
const callView = (oAt !== -1 && oEnd > oAt) ? html.slice(oAt, oEnd) : '';
ok('the call screen was located and bounded', callView.length > 2500 && callView.length < 14000,
  'len=' + callView.length);
// Its prose names the very things the checks below forbid ("the 160deg navy-to-black gradient"),
// and a scan that counted those would be answered by deleting the explanation, not the defect.
const callCode = callView.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
// THE MACHINERY: the listen/turn/mute/lifecycle block on App. Bounded at both ends.
const fxAt = html.indexOf('const startCallListening = (armIdleClock = true) => {');
const fxEnd = html.indexOf('}, [screen]);', fxAt);
const callFx = (fxAt !== -1 && fxEnd > fxAt) ? html.slice(fxAt, fxEnd) : '';
ok('the call machinery was located and bounded', callFx.length > 6000, 'len=' + callFx.length);
const ezcallRules = (css.match(/\.ezcall[a-z0-9-]*(?:[^{}]*)\{[^}]*\}/g) || []);
ok('the call screen declares its own rule set', ezcallRules.length > 12, 'found ' + ezcallRules.length);

/* ---- O1. the identity, and that the inventory line was EARNED ----------- */
const CALL_ON_EZCALL =
  /<div className="theme-dark ezhome ezcall" style=\{s\.callContainer\}>/.test(callView)
  && /<div className="ezcall-rail">/.test(callView)
  && /<div className="ezcall-body">/.test(callView)
  && /<div className="ezcall-stage">/.test(callView)
  && /<div className="ezcall-dock">/.test(callView);
ok('O1: the call screen mounts on the ezcall identity, in all four of its pieces', CALL_ON_EZCALL);
eq('O1: ...and THAT is why the inventory calls it istana', INDEX_SCREENS.call.shell,
  CALL_ON_EZCALL ? 'istana' : 'legacy');
ok('O1: no ezcall selector can match html, body or :root',
  !ezcallRules.some((r) => /(^|[,\s])(html|body|:root)[\s,{]/.test(r.split('{')[0])));
{
  // Every JSX site in the whole file that puts an ezcall class on an element must be inside this
  // component. Comments are stripped from both sides first -- the prose here NAMES these classes.
  const htmlCode = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const anywhere = (htmlCode.match(/className=(?:"|\{')ezcall[A-Za-z0-9 '-]*/g) || []);
  const here = (callCode.match(/className=(?:"|\{')ezcall[A-Za-z0-9 '-]*/g) || []);
  ok('O1: ...and .ezcall- belongs to this screen alone',
    anywhere.length === here.length && here.length >= 8,
    'uses in the file: ' + anywhere.length + ', uses in CallScreen: ' + here.length);
}

/* ---- O2. the dark room and its white-on-navy captions are GONE ---------- */
okOn('O2: the call screen paints no gradient anywhere', [["callView", callView]], !/gradient/.test(callCode));
const CALL_STYLE_KEYS = ['callContainer', 'callAvatarWrap', 'callRing', 'callAvatar', 'callStatusLabel',
  'callSubLabel', 'callHint', 'callErrorBanner', 'callControls', 'callMuteBtn', 'callEndBtn', 'callBtnLabel'];
eq('O2: ...nor does any object it draws from',
  CALL_STYLE_KEYS.filter((k) => /gradient/.test(JSON.stringify(s[k] || {}))), []);
ok('O2: the caption and the free-floating centre column are gone, keys and all',
  !('callTopLabel' in s) && !('callCenter' in s)
  && !/s\.callTopLabel/.test(html) && !/s\.callCenter/.test(html));
// The dark-mode gate no longer has to excuse this screen's pill, and it may not silently
// re-acquire the excuse either.
ok('O2: the mute pill is no longer excused from dark mode',
  !('callMuteBtn' in LIGHT_ON_PURPOSE) && /var\(/.test(String(s.callMuteBtn.background)));

/* ---- O3..O6. the three bounded pieces ---------------------------------- */
const oMeasure = (/\.ezcall\{[^}]*--ezcall-measure:(\d+)px/.exec(css) || [])[1];
const oStage = (/\.ezcall\{[^}]*--ezcall-stage:(\d+)px/.exec(css) || [])[1];
ok('O3: the room declares one outer measure, at most 880px', +oMeasure > 0 && +oMeasure <= 880, 'measure=' + oMeasure);
ok('O3: the top rail is bounded by it and is not a slab',
  /\.ezcall-rail-inner\{[^}]*max-width:var\(--ezcall-measure\)/.test(css)
  && /\.ezcall-rail\{[^}]*justify-content:center/.test(css));
ok('O3: ...and sits inside the top safe area', /\.ezcall-rail\{[^}]*env\(safe-area-inset-top/.test(css));
ok('O3: the rail carries the screen\'s own name and the REAL way out',
  /<button onClick=\{onExit\} className="ezcall-icon" aria-label=\{CALL_TXT\.END\}>\{A2_ICON_BACK\}<\/button>/.test(callView)
  && /<span className="ezcall-brand-text">\{CALL_TXT\.TITLE\}<\/span>/.test(callView));
ok('O3: ...and it invented no control -- every button on this screen is one that shipped',
  (callCode.match(/<button /g) || []).length === 3
  && (callCode.match(/onClick=\{onExit\}/g) || []).length === 2
  && (callCode.match(/onClick=\{onToggleMute\}/g) || []).length === 1
  && (callCode.match(/onClick=\{canTalk \? onTalk : undefined\}/g) || []).length === 1,
  'buttons=' + (callCode.match(/<button /g) || []).length);
ok('O4: the voice stage is a bounded panel of about 720px',
  +oStage >= 640 && +oStage <= 760 && /\.ezcall-stage\{[^}]*max-width:var\(--ezcall-stage\)/.test(css),
  'stage=' + oStage);
ok('O4: ...centred in the room rather than given a hero band of its own',
  /\.ezcall-body\{[^}]*align-items:center/.test(css) && /\.ezcall-body\{[^}]*justify-content:center/.test(css));
ok('O4: the hint line is DRAWN ONLY WHEN IT HAS SOMETHING TO SAY -- no dead band',
  /const hint = callState === 'listening' && heard \? heard : \(isMuted \? CALL_TXT\.MUTED_HINT : ''\);/.test(callView)
  && /\{hint \? <div style=\{s\.callHint\}>\{hint\}<\/div> : null\}/.test(callView));
{
  // The interim transcript is read in EXACTLY ONE place, and that place is the shipped condition.
  // Take away the prop declaration and that one line, and the word must not occur again -- which
  // is what makes "nothing hidden is now revealed" a measurement rather than a promise.
  const rest = callCode
    .replace(/const hint = callState === 'listening' && heard \? heard : \(isMuted \? CALL_TXT\.MUTED_HINT : ''\);/, ' ')
    .replace(/function CallScreen\(\{[^}]*\}\)/, ' ');
  okOn('O4: ...and the condition that decides it is the SHIPPED one, so nothing hidden is revealed', [["callView", callView]],
    !/\bheard\b/.test(rest), 'the interim transcript is read somewhere else as well');
}
ok('O5: the state title is the REAL state, rendered from callState',
  /const cs = STATES\[callState\] \|\| STATES\.idle;/.test(callView)
  && /<div style=\{s\.callStatusLabel\}>\{cs\.label\}<\/div>/.test(callView));
ok('O5: ...all four shipped labels are still there, and none is hardcoded into the markup',
  /idle:\s*\{ label: 'اضغط للتحدّث'/.test(callView)
  && /listening:\s*\{ label: 'أستمع إليك\.\.\.'/.test(callView)
  && /thinking:\s*\{ label: 'لحظة\.\.\.'/.test(callView)
  && /speaking:\s*\{ label: gender === 'female' \?/.test(callView));
ok('O5: ...and the marker beside it is STRUCTURE, keyed to the same state',
  /<span className=\{'ezcall-mark is-' \+ callState\} aria-hidden="true" \/>/.test(callView)
  && /\.ezcall-mark\.is-listening\{width:64px/.test(css)
  && !/\.ezcall-mark[^{]*\{[^}]*gradient/.test(css));
ok('O6: the dock is bounded and in flow, so it floats over nothing',
  /\.ezcall-dock-inner\{[^}]*max-width:var\(--ezcall-stage\)/.test(css)
  && !/\.ezcall-dock\{[^}]*position\s*:/.test(css) && !/\.ezcall-dock-inner\{[^}]*position\s*:/.test(css));
ok('O6: ...and its controls stay together instead of drifting to the edges of a 2048px desk',
  /\.ezcall-dock-inner\{[^}]*justify-content:center/.test(css));
{
  const sized = ['callMuteBtn', 'callEndBtn'].map((k) => [k, (s[k] || {}).width, (s[k] || {}).height]);
  const bad = sized.filter(([, w, h]) => !(w >= 44 && w <= 56 && h >= 44 && h <= 56))
    .map(([k, w, h]) => k + '=' + w + 'x' + h);
  eq('O6: every control on this screen is between 44px and 56px', bad, []);
  ok('O6: ...and neither is a floating circle any more',
    !/borderRadius: 38/.test(JSON.stringify(s.callMuteBtn)) && !/borderRadius: 38/.test(JSON.stringify(s.callEndBtn)));
}
ok('O6: no ezcall rule declares a viewport-wide box',
  !/\.ezcall[a-z0-9-]*[^{]*\{[^}]*(width|min-width|max-width)\s*:\s*100vw/.test(css));

/* ---- O7/O8. light is plain white, dark is real, nothing is patterned ---- */
{
  const lit = resolve(s.callContainer.background, VT_PAL['istana_33:light']);
  const drk = resolve(s.callContainer.background, VT_PAL['istana_33:dark']);
  ok('O7: the call page in istana light is plain #FFFFFF', !!lit && hex(lit) === '#ffffff', String(lit && hex(lit)));
  ok('O7: the dark rendering is a real second page, not an inverted one',
    !!drk && hex(drk) !== hex(lit) && lum(drk) < 0.1, String(drk && hex(drk)));
  ok('O7: ...and nothing on this screen inverts or filters to get there',
    !/filter\s*:/.test(JSON.stringify(s.callContainer)) && !/\.ezcall[a-z0-9-]*[^{]*\{[^}]*filter\s*:/.test(css));
  const patterned = ezcallRules.filter((r) => /url\(|gradient|repeat|background-image\s*:\s*(?!none)/.test(r));
  eq('O8: not one ezcall rule attaches an image, a gradient or a repeat', patterned, []);
  ok('O8: ...and none draws a pseudo-element over the room',
    !/\.ezcall[a-z0-9-]*[^{]*::(before|after)/.test(css)
    && !ezcallRules.some((r) => /[;{]\s*content\s*:/.test(r)));
  const litRules = ezcallRules.filter((r) => /(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(r));
  eq('O8: ...and the screen states no colour of its own at all, in CSS', litRules, []);
  const litJsx = (callCode.match(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g) || []);
  eq('O8: ...nor in its markup', litJsx, []);
  eq('O8: every style key the call screen draws from still exists', CALL_STYLE_KEYS.filter((k) => !s[k]), []);
  const litKeys = [];
  for (const k of CALL_STYLE_KEYS) for (const p of Object.keys(s[k] || {})) {
    const v = String(s[k][p]);
    if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v)) litKeys.push(k + '.' + p + '=' + v);
  }
  eq('O8: ...and not one of them carries a hardcoded colour', litKeys, []);
}

/* ---- O9/O10. the way in, and the two barriers in front of it ----------- */
ok('O9: the screen is still entered by setting the screen, and by nothing else',
  /onClick=\{\(\) => setScreen\('call'\)\}/.test(html)
  && /if \(screen === 'call'\) return <CallScreen profileName=\{profile\?\.name\} gender=\{profile\?\.gender\} callState=\{callState\} heard=\{callHeard\} isMuted=\{isCallMuted\} error=\{voiceError\} onToggleMute=\{toggleCallMute\} onTalk=\{onCallTalk\} onExit=\{goEzikBack\} \/>;/.test(html));
{
  const spendAt = html.indexOf("if ((screen === 'chat' || screen === 'call') && !spendGateOpenState) return <SpendGate");
  const childAt = html.indexOf("if (screen === 'call' && childVoiceBlocked()) return <ChildVoiceNotice");
  const tokenAt = html.indexOf("if (screen === 'call' && !hasFounderToken()) return <UnlockSheet");
  const renderAt = html.indexOf("if (screen === 'call') return <CallScreen");
  ok('O10: all four call gates are present in the render chain',
    spendAt !== -1 && childAt !== -1 && tokenAt !== -1 && renderAt !== -1);
  ok('O10: ...and their ORDER is untouched: spend, then child voice, then the token, then the screen',
    spendAt < childAt && childAt < tokenAt && tokenAt < renderAt,
    [spendAt, childAt, tokenAt, renderAt].join(' < '));
  okOn('O10: none of them moved INSIDE the component, where it could be drawn around', [["callView", callView]],
    !/childVoiceBlocked|hasFounderToken|spendGateOpenState/.test(callView));
  ok('O10: the mic itself is held shut by the same two guards, in the same order',
    /if \(childVoiceBlocked\(\)\) return; \/\/ غ‑٣/.test(callFx)
    && /if \(!hasFounderToken\(\)\) return; \/\/ directive 82/.test(callFx)
    && callFx.indexOf('childVoiceBlocked()') < callFx.indexOf('hasFounderToken()'));
  // STRENGTHENED, not relaxed: the same two barriers in the same order, plus the AI-consent
  // barrier that Apple 5.1.1(i) requires between them. A call session must not be built -- no
  // engine, no recorder, no microphone -- for a reader who has not consented to voice sharing.
  ok('O10: ...and the call session is never even BUILT without them',
    /if \(childVoiceBlocked\(\)\) return; \/\/ غ‑٣[\s\S]{0,400}?if \(!hasValidAIConsent\(\)\) return;[\s\S]{0,200}?if \(!hasFounderToken\(\)\) return; \/\/ directive 82[\s\S]{0,120}?callGenRef\.current\+\+;/.test(callFx));
  ok('O10: the child-voice barrier is still shut at the flag', /const CHILD_VOICE_ENABLED = false;/.test(html));
}

/* ---- O11/O12. the endpoints ------------------------------------------- */
ok('O11: call and text both speak to /api/ask for answer parity',
  /endpoint = '\/api\/ask'/.test(html));
ok('O11: ...and the call turn still asks for mode:\'call\', which is what chooses it',
  /reply = await callAI\(apiHistory, profile, \{\s*\r?\n\s*signal: controller\.signal, mode: 'call',/.test(html));
ok('O11: ...on the shipped body, unchanged',
  html.indexOf("const __mkBody = (msgs) => ({ max_tokens: 4096, stream: true, name: p.name, age: p.age, gender: p.gender, mode, messages: msgs, ...__extra });") !== -1);
// Same endpoints, now reached only through the AI-consent choke point (see N24 above).
ok('O12: speech OUT still goes to the shipped endpoint', /await aiFetch\('\/api\/tts'/.test(html));
ok('O12: ...and speech IN still goes to the shipped one',
  /await aiFetch\('\/api\/stt', \{ method: 'POST', headers: \{ 'Content-Type': 'application\/json' \}, body: JSON\.stringify\(\{ audio: b64, mime: blob\.type, band \}\) \}\)/.test(html));
ok('O12: ...with the cloud path still the live one', /const CALL_STT_CLOUD = true;/.test(html));
// STRICTLY ADDED, not a rename: the two lines above pin WHERE the voice goes; these pin that
// there is no OTHER way to get there. A bare fetch to either endpoint would bypass the
// AI-consent gate entirely, which is the defect Apple 5.1.1(i) was raised about.
ok('O12: ...and no bare fetch reaches the speech endpoints', !/[^i]fetch\('\/api\/(tts|stt)'/.test(html));
ok('O12: ...and the choke point itself is fail-closed',
  /const aiFetch = \(url, opts\) => \{\s*\r?\n\s*if \(!hasValidAIConsent\(\)\) return Promise\.reject/.test(html));

/* ---- O13. SpeechRecognition, unchanged --------------------------------- */
// STRENGTHENED: the recogniser is still built only when an engine exists, and now ALSO only when
// consent is held. Both facts are pinned -- ezSpeechEngine() is the capability question and
// ezNewRecognition() is the consent-checked factory that is the file's ONLY constructor.
ok('O13: the recogniser is still built the shipped way, and only when an engine exists',
  /const SR = ezSpeechEngine\(\);/.test(callFx)
  && /const rec = ezNewRecognition\(\);/.test(callFx)
  && /const ezNewRecognition = \(\) => \{[\s\S]{0,120}?if \(!hasValidAIConsent\(\)\) return null;[\s\S]{0,200}?const SR = ezSpeechEngine\(\);/.test(html));
ok('O13: ...with the same language and the same continuous, interim configuration',
  /rec\.lang = 'ar-SA';/.test(callFx) && /rec\.continuous = true;/.test(callFx)
  && /rec\.interimResults = true;/.test(callFx));
ok('O13: ...and the same three handlers, wired the same way',
  /if \(rec\) \{ rec\.onresult = onRecResult; rec\.onend = onRecEnd; rec\.onerror = onRecError; \}/.test(callFx)
  && /const onRecResult = \(event\) => \{/.test(callFx)
  && /const onRecEnd = \(\) => \{/.test(callFx)
  && /const onRecError = \(event\) => \{/.test(callFx));
// COUNTED, not merely present. `rec.start()` is called from two places -- the fresh turn and the
// restart-gap retry -- and the recogniser is stopped from three: the silent auto-end, the
// end-of-turn, and mute. Deleting ONE of them leaves a call that is deaf, or a microphone that
// keeps running, in exactly one of its paths; a bare presence check cannot see that.
// STRENGTHENED: still BOTH places, and both now go through the one starter that re-reads consent
// at the instant of starting -- which is what stops an auto-restart from outliving a withdrawal.
eq('O13: ...started by the shipped calls, in BOTH places that start it',
  (callFx.match(/ezStartRecognition\(rec\)/g) || []).length, 2);
ok('O13: ...and that starter refuses and tears down when consent has gone',
  /const ezStartRecognition = \(rec\) => \{[\s\S]{0,200}?if \(!hasValidAIConsent\(\)\) \{ ezKillRecognizer\(rec\); return false; \}/.test(html));
eq('O13: ...and stopped by the shipped call, in ALL THREE places a turn can end',
  (html.match(/callRecognitionRef\.current\?\.stop\(\);/g) || []).length, 3);
ok('O13: ...and the session token that invalidates a stale continuation is still there',
  /callGenRef\.current\+\+;/.test(callFx) && /if \(callGenRef\.current !== genAtEnd\) return;/.test(callFx));
ok('O13: a denied microphone still SAYS so, and a network failure says something else',
  /const fatal = \['not-allowed', 'audio-capture', 'service-not-allowed'\];/.test(callFx)
  && /else if \(event\.error === 'network'\) \{/.test(callFx)
  && /const micErrorMessage = \(e\) => \{/.test(html) && /const sttErrorMessage = \(status\) => \{/.test(html));

/* ---- O14. the voice text is never written down ------------------------- */
ok('O14: no spoken text is ever put in storage',
  !/localStorage\.(setItem|getItem)\([^)]*(callHeard|callTranscript|callBaseText)/.test(html));
ok('O14: ...nor in the URL', !/(pushState|replaceState|location\.(hash|search|href))[^;\n]{0,120}(callHeard|callTranscript|callBaseText)/.test(html));
ok('O14: ...nor in the console', !/console\.(log|warn|error|info)\([^)]*(callHeard|callTranscript|callBaseText|setCallHeard)/.test(html));
ok('O14: ...and the interim result still goes ONLY to the feedback line',
  /setCallHeard\(\(finalText \+ interim\)\.trim\(\)\); \/\/ feedback only — NEVER setInput/.test(callFx)
  && !/setInput\(/.test(callFx));
ok('O14: no transcript store was invented by this batch',
  !/ezik_call|call_transcript|CALL_TRANSCRIPT_KEY/.test(html));

/* ---- O15. leaving the room actually leaves it -------------------------- */
{
  const teardown = callFx.slice(callFx.lastIndexOf('return () => {'));
  ok('O15: the teardown was located', teardown.length > 400, 'len=' + teardown.length);
  const NEEDS = [
    ['a new session token', /callGenRef\.current\+\+;/],
    ['the turn flag', /callActiveRef\.current = false;/],
    ['the silence timer', /clearTimeout\(silenceTimerRef\.current\)/],
    ['the inactivity timer', /clearInactivityTimer\(\);/],
    ['the error timer', /clearTimeout\(callErrorTimerRef\.current\)/],
    // Same teardown, now through the shared killer -- which does strictly more than the four
    // statements it replaced: it detaches onstart too, calls abort() as well as stop(), and drops
    // the engine from the live registry so a withdrawal cannot find it still listening.
    ['the recogniser handlers and the recogniser', /ezKillRecognizer\(rec\);/],
    ['the cloud recorder and the mic track', /stopCloudAll\(\);/],
    ['the in-flight request', /abortRef\.current\.abort\(\)/],
    ['the audio', /cancelAudio\(\);/],
  ];
  const missingTd = NEEDS.filter(([, re]) => !re.test(teardown)).map(([n]) => n);
  eq('O15: leaving the call still releases everything it took', missingTd, []);
  // ADDED: what the shared killer must actually do, since O15 now names it rather than the four
  // inline statements. Detaching onend BEFORE aborting is load-bearing -- abort() fires onend,
  // and a live onend is exactly what would restart the engine being torn down.
  ok('O15: ...and the shared killer detaches onend BEFORE it aborts',
    /rec\.onend = null;[\s\S]{0,300}?rec\.abort\(\)/.test(html));
  ok('O15: ...and drops the engine from the live registry',
    /EZ_LIVE_RECOGNIZERS\.delete\(rec\)/.test(html));
  ok('O15: ...and the effect that owns it still runs on the screen change',
    /\}, \[screen\]\);/.test(html) && fxEnd > fxAt);
}

/* ---- O16..O18. back, and the two things not to invent ------------------ */
ok('O16: back is the screen\'s own exit, and it resolves through the registry',
  /onExit=\{goEzikBack\} \/>;/.test(html) && /if \(cur === 'call'\) return 'chat';/.test(html));
okOn('O16: ...and the component itself navigates nowhere -- it only calls onExit', [["callView", callView]],
  !/setScreen\(/.test(callCode) && !/goEzikBack/.test(callCode) && !/history\.(back|go)\(/.test(callCode));
okOn('O17: no retry control was invented', [["callView", callView]], !/retry|إعادة المحاولة/i.test(callCode));
okOn('O17: ...and no cancel control either', [["callView", callView]],
  !/إلغاء/.test(callCode));
ok('O18: reduced motion is still decided in JS, from the platform query',
  /const reduceMotion = \(typeof window !== 'undefined' && window\.matchMedia\)\s*\r?\n\s*\? window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches : false;/.test(callView)
  && /animation: reduceMotion \? 'none' : `callPulse \$\{cs\.speed\} ease-in-out infinite`,/.test(callView));
ok('O18: ...and the ring is still the ONLY thing on this screen that moves',
  (callCode.match(/animation:/g) || []).length === 1
  && !/\.ezcall[a-z0-9-]*[^{]*\{[^}]*(animation|transition)\s*:/.test(css));
ok('O18: ...and no ezcall selector was smuggled into the reduced-motion block',
  !/@media \(prefers-reduced-motion: reduce\) \{[^}]*ezcall/.test(css));

/* ---- O19/O20. the words, and the call entry that is not this screen ----- */
{
  // مكالمة مع عزك / كتم / مكتوم / إنهاء / الميكروفون مكتوم /
  // تتحدّث إلى ذكاءٍ اصطناعيّ — لا إلى إنسان.
  const WORDS = {
    TITLE: 'مكالمة مع عزك',
    DISCLAIMER: 'تتحدّث إلى ذكاءٍ اصطناعيّ — لا إلى إنسان.',
    MUTED_HINT: 'الميكروفون مكتوم',
    MUTE_ON: 'مكتوم',
    MUTE_OFF: 'كتم',
    END: 'إنهاء',
  };
  const decodedCall = callView.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const wrong = Object.keys(WORDS).filter((k) => decodedCall.indexOf(k + ':' + ' '.repeat(Math.max(1, 11 - k.length)) + "'" + WORDS[k] + "'") === -1
    && decodedCall.indexOf(k + ': ' + "'" + WORDS[k] + "'") === -1
    && decodedCall.indexOf("'" + WORDS[k] + "'") === -1);
  eq('O19: every word this screen says is a word it already said', wrong, []);
  ok('O19: ...and they are stated once, in one table, not scattered through the markup',
    /const CALL_TXT = \{/.test(callView)
    && (callCode.match(/CALL_TXT\./g) || []).length >= 6);
  ok('O19: the accessible name on the way out is one of them',
    /aria-label=\{CALL_TXT\.END\}/.test(callView));
  ok('O19: ...and the emblem still declares itself decoration',
    /aria-hidden="true"/.test(callView) && /role="alert"/.test(callView));
}
ok('O20: the call entry inside the chat is untouched',
  /\{directConvoAllowed && \(\s*\r?\n\s*<button\s*\r?\n\s*onClick=\{\(\) => setScreen\('call'\)\}\s*\r?\n\s*disabled=\{isLoading \|\| isListening\}/.test(html));
okOn('O20: ...and the chat still owns its own identity, not this one', [["chatSrc", chatSrc]],
  html.indexOf('<div className="theme-dark ezhome ezc" style={s.chatContainer}>') !== -1
  && !/ezcall/.test(chatSrc));

/* ============ P. THE ISTANA SAVED ANSWERS (S114) =========================
 * The favourites screen. Its PRESENTATION moved and nothing else did, so most of this group is a
 * FREEZE: the store key, the readers and the one writer, the ORDER the records arrive in, the
 * renderer, every action and every accessible name are named here so that moving one fails.
 *
 * Cut to the screen. FavoritesScreen is sliced from its signature to the section comment that
 * follows it, and its card body separately. index.html still contains a legacy strip header, a
 * gradient and a full-width column -- on OTHER screens -- so any of these checks asserted against
 * the whole file would be a check that can only fail, or be quietly weakened until it passes.
 * ---------------------------------------------------------------------- */
console.log('\n=== P. THE ISTANA SAVED ANSWERS ===');

const pAt = html.indexOf('function FavoritesScreen(');
const pEnd = html.indexOf('\n// Flag-a-reply modal', pAt);
const favView = (pAt !== -1 && pEnd > pAt) ? html.slice(pAt, pEnd) : '';
const fbAt = html.indexOf('function FavoriteReplyBody(');
const fbEnd = fbAt === -1 ? -1 : html.indexOf('\nfunction FavoritesScreen(', fbAt);
const favBody = (fbAt !== -1 && fbEnd > fbAt) ? html.slice(fbAt, fbEnd) : '';
ok('the favourites screen was located and bounded', favView.length > 2000 && favView.length < 9000,
  'len=' + favView.length);
ok('...and its card body with it', favBody.length > 400, 'len=' + favBody.length);
// Its prose names the very things the checks forbid; a scan that counted those would be answered
// by deleting the explanation rather than the defect.
const favCode = favView.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const ezfavRules = (css.match(/\.ezfav[a-z0-9-]*(?:[^{}]*)\{[^}]*\}/g) || []);
ok('the screen declares its own rule set', ezfavRules.length > 14, 'found ' + ezfavRules.length);

/* ---- P1. the identity, and that the inventory line was EARNED ----------- */
const FAV_ON_EZFAV =
  /<div className="theme-dark ezhome ezfav" style=\{s\.favScreen\}>/.test(favView)
  && /<div className="ezfav-rail">/.test(favView)
  && /<div className="ezfav-wrap">/.test(favView)
  && /<div className="ezfav-cat">/.test(favView)
  && /<div key=\{f\.id\} className="ezfav-card" style=\{s\.favCard\}>/.test(favView);
ok('P1: the saved answers mount on the ezfav identity, in all four of its pieces', FAV_ON_EZFAV);
eq('P1: ...and THAT is why the inventory calls it istana', INDEX_SCREENS.favorites.shell,
  FAV_ON_EZFAV ? 'istana' : 'legacy');
ok('P1: no ezfav selector can match html, body or :root',
  !ezfavRules.some((r) => /(^|[,\s])(html|body|:root)[\s,{]/.test(r.split('{')[0])));
{
  const htmlCode = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const anywhere = (htmlCode.match(/className="ezfav[A-Za-z0-9 -]*/g) || []);
  const here = (favCode.match(/className="ezfav[A-Za-z0-9 -]*/g) || []);
  ok('P1: ...and .ezfav- belongs to this screen alone',
    anywhere.length === here.length && here.length >= 9,
    'uses in the file: ' + anywhere.length + ', uses in FavoritesScreen: ' + here.length);
}

/* ---- P2. the legacy strip header is gone from HERE, and only from here -- */
okOn('P2: the screen no longer borrows the parent dashboard\'s strip header', [["favView", favView]],
  !/s\.dashboardHeader/.test(favView) && !/s\.dashboardTitle/.test(favView) && !/s\.backBtn/.test(favView));
// S115: the parents' panel was the OTHER screen that drew that strip, and it has its own bounded
// rail now. So the three keys are gone from the file entirely, and this check flipped from "they
// still exist for the other tenant" to "no tenant is left, so they may not exist at all".
ok('P2: ...and the strip they drew is gone from the whole file, its last tenant with it',
  !('dashboardHeader' in s) && !('dashboardTitle' in s) && !('backBtn' in s)
  && !/s\.dashboardHeader|s\.dashboardTitle|s\.backBtn/.test(html));
okOn('P2: no gradient is spread anywhere on this screen', [["favView", favView]], !/gradient/.test(favCode));
const FAV_STYLE_KEYS = ['favScreen', 'favBody', 'favCard', 'favMeta', 'favText', 'favRow', 'favBtn', 'favBtnOff'];
eq('P2: ...nor by any object it draws from',
  FAV_STYLE_KEYS.filter((k) => /gradient/.test(JSON.stringify(s[k] || {}))), []);

/* ---- P3..P5. the three bounded pieces --------------------------------- */
const pMeasure = (/\.ezfav\{[^}]*--ezfav-measure:(\d+)px/.exec(css) || [])[1];
eq('P3: the screen declares one measure, and it is the 1100px shell measure', pMeasure, '1100');
ok('P3: the top rail is bounded by it and is not a strip across the page',
  /\.ezfav-rail-inner\{[^}]*max-width:var\(--ezfav-measure\)/.test(css)
  && /\.ezfav-rail\{[^}]*justify-content:center/.test(css)
  && /\.ezfav-rail\{[^}]*env\(safe-area-inset-top/.test(css));
ok('P3: it carries the screen\'s own title and the REAL back control, text and all',
  /<button onClick=\{onBack\} className="ezfav-back ezik-focus">\{EZIK_BACK\}<\/button>/.test(favView)
  && /<span className="ezfav-brand-text">\{EZIK_FAV_HEADING\}<\/span>/.test(favView));
ok('P3: ...and it invented no control -- the back is the only button in the rail',
  (favCode.slice(favCode.indexOf('ezfav-rail'), favCode.indexOf('ezfav-wrap')).match(/<button /g) || []).length === 1);
ok('P4: the masthead is SMALL and it is USEFUL -- it holds the one control this screen has',
  /\.ezfav-masthead\{[^}]*padding:12px 14px/.test(css)
  && /<div className="ezfav-masthead">[\s\S]{0,400}?type="search"/.test(favView)
  && !/\.ezfav-masthead\{[^}]*min-height:(1[5-9]\d|[2-9]\d\d)px/.test(css));
ok('P4: ...and it is absent while there is nothing saved to search',
  /\{total > 0 && \(\s*\r?\n\s*<div className="ezfav-masthead">/.test(favView));
ok('P5: the catalogue is bounded by the same measure',
  /\.ezfav-wrap\{[^}]*max-width:var\(--ezfav-measure\)/.test(css)
  && /\.ezfav-wrap\{[^}]*margin:0 auto/.test(css));
ok('P5: ...one column on a phone, two from a tablet, three from a desk',
  !/^\.ezfav-cat\{[^}]*column-count/.test(css)
  && /@media \(min-width:760px\)\{\.ezfav-cat\{column-count:2\}\}/.test(css)
  && /@media \(min-width:1180px\)\{\.ezfav-cat\{column-count:3\}\}/.test(css));
ok('P5: ...and a card is never split, stretched or padded out to a neighbour\'s height',
  /\.ezfav-card\{[^}]*break-inside:avoid/.test(css)
  && !/\.ezfav-cat\{[^}]*display:(grid|flex)/.test(css)
  && !/\.ezfav-card\{[^}]*height:/.test(css));
ok('P5: no ezfav rule declares a viewport-wide box or a sideways scroll',
  !/\.ezfav[a-z0-9-]*[^{]*\{[^}]*(width|min-width|max-width)\s*:\s*100vw/.test(css)
  && !/\.ezfav[a-z0-9-]*[^{]*\{[^}]*overflow-x\s*:\s*(auto|scroll)/.test(css));

/* ---- P6/P7. light is plain white, dark is real, nothing is patterned ---- */
{
  const lit = resolve(s.favScreen.background, VT_PAL['istana_33:light']);
  const drk = resolve(s.favScreen.background, VT_PAL['istana_33:dark']);
  ok('P6: the page in istana light is plain #FFFFFF', !!lit && hex(lit) === '#ffffff', String(lit && hex(lit)));
  ok('P6: the dark rendering is a real second page, not an inverted one',
    !!drk && hex(drk) !== hex(lit) && lum(drk) < 0.1, String(drk && hex(drk)));
  ok('P6: ...and nothing here inverts or filters to get there',
    !/\.ezfav[a-z0-9-]*[^{]*\{[^}]*filter\s*:/.test(css));
  const patterned = ezfavRules.filter((r) => /url\(|gradient|repeat|background-image\s*:\s*(?!none)/.test(r));
  eq('P7: not one ezfav rule attaches an image, a gradient or a repeat', patterned, []);
  ok('P7: ...and none draws a pseudo-element over a saved reply',
    !/\.ezfav[a-z0-9-]*[^{]*::(before|after)/.test(css)
    && !ezfavRules.some((r) => /[;{]\s*content\s*:/.test(r)));
  const litRules = ezfavRules.filter((r) => /(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(r));
  eq('P7: ...and the screen states no colour of its own at all, in CSS', litRules, []);
  eqOn('P7: ...nor in its markup', [["favView", favView]], (favCode.match(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g) || []), []);
  eq('P7: every style key it draws from still exists', FAV_STYLE_KEYS.filter((k) => !s[k]), []);
  const litKeys = [];
  for (const k of FAV_STYLE_KEYS) for (const p of Object.keys(s[k] || {})) {
    const v = String(s[k][p]);
    if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v)) litKeys.push(k + '.' + p + '=' + v);
  }
  eq('P7: ...and not one of them carries a hardcoded colour', litKeys, []);
}

/* ---- P8. the store: one key, one reader, one writer -------------------- */
ok('P8: the favourites key is the shipped, versioned one',
  /const EZIK_FAVS_KEY = 'ezik_favorite_replies_v1';/.test(html));
// FOUR mentions in the whole file and no more: the declaration, the read in ezikReadFavs, the
// write in ezikWriteFavs, and the removal in ezikClearAllFavs. A fifth is a second door onto the
// store, which is exactly what this counts.
eq('P8: the key is named in exactly the four places that own it',
  (html.match(/EZIK_FAVS_KEY/g) || []).length, 4);
ok('P8: ...read and written through the shipped pair, and nowhere else',
  /localStorage\.getItem\(EZIK_FAVS_KEY\)/.test(html)
  && /localStorage\.setItem\(EZIK_FAVS_KEY, JSON\.stringify\(l\)\)/.test(html)
  && /function ezikClearAllFavs\(\) \{ try \{ localStorage\.removeItem\(EZIK_FAVS_KEY\); \} catch \(e\) \{\} \}/.test(html));
ok('P8: ...through the ONE writer, which adopts what the store actually took',
  /const applyFavs = \(next\) => \{\s*\r?\n\s*const written = ezikWriteFavs\(next\);/.test(html)
  && /const removeFavorite = \(id\) => applyFavs\(favsRef\.current\.filter\(\(f\) => f\.id !== id\)\);/.test(html));
ok('P8: the record shape is unchanged -- id, pk, chatId, idx, at, snippet, text',
  /return \{ id: ezikFavId\(pk, chatId, idx, t\), pk: pk \|\| null, chatId: chatId \|\| null, idx: idx, at: Date\.now\(\), snippet: ezikFavSnippet\(t\), text: t \};/.test(html));
ok('P8: ...and the identity is still the POSITION, not the text',
  /function ezikFavId\(pk, chatId, idx, text\) \{\s*\r?\n\s*return String\(pk \|\| ''\) \+ '\|' \+ String\(chatId \|\| '-'\) \+ '\|' \+ String\(idx\) \+ '\|' \+ ezikHashText\(text\);/.test(html));
okOn('P8: the screen itself touches no store at all', [["favView", favView]],
  favCode.indexOf('localStorage') === -1 && favCode.indexOf('ezikReadFavs') === -1
  && favCode.indexOf('ezikWriteFavs') === -1 && favCode.indexOf('EZIK_FAVS_KEY') === -1
  && favCode.indexOf('JSON.parse') === -1);
ok('P8: no second favourites store and no migration was introduced',
  !/ezik_fav[a-z_]*_v[2-9]|favorites_v[2-9]|migrateFav|ezikMigrateFav/i.test(html)
  && !/localStorage\.(setItem|getItem|removeItem)\(\s*'[^']*fav[^']*'/i.test(html),
  'a favourites key is being touched by a literal string somewhere');

/* ---- P8b. ITEM 86: THREE KINDS IN ONE STORE ---------------------------- */
// The store holds three kinds now. What must never happen is that adding them costs anybody a
// favourite they already had, so the first two checks are about the OLD records, not the new.
ok('P8b: a record with no kind is a reply, and that is the only migration there is',
  /const ezikKindOf = \(f\) => ezikFavKind\(f && f\.kind\);/.test(html)
  && /const EZIK_FAV_KIND_DEFAULT = 'reply';/.test(html)
  && !/migrateFav|ezikMigrateFav|rewriteFav/i.test(html));
ok('P8b: ...and a stored reply is not rewritten on read, so it round-trips byte for byte',
  /if \(EZIK_FAV_KINDS\.indexOf\(r\.kind\) !== -1 && r\.kind !== EZIK_FAV_KIND_DEFAULT\) rec\.kind = r\.kind;/.test(html)
  && /return \{ id: ezikFavId\(pk, chatId, idx, t\), pk: pk \|\| null, chatId: chatId \|\| null, idx: idx, at: Date\.now\(\), snippet: ezikFavSnippet\(t\), text: t \};/.test(html));
eq('P8b: there are exactly three kinds', (function () {
  const m = /const EZIK_FAV_KINDS = \[([^\]]*)\];/.exec(html);
  return m ? m[1].split(',').length : 0;
}()), 3);
ok('P8b: a fatwa and an ayah carry their own identity, never a conversation position',
  /function ezikFavRefId\(kind, pk, ref, text\)/.test(html)
  && /const ezikAyahFavKey = \(surahNum, surahName, ayah\) =>/.test(html)
  && /function ezikMakeFavOf\(kind, pk, ref, title, text\)/.test(html)
  && /chatId: null, idx: -1,/.test(html));
ok('P8b: ...and both new kinds are saved from a real control on their own screen',
  /aria-label=\{saved \? ezT\('favorites.remove'\) : ezT\('favorites.addFatwa'\)\}/.test(html)
  && /aria-label=\{isFavorite \? ezT\('favorites.remove'\) : ezT\('favorites.addAyah'\)\}/.test(html));
ok('P8b: ...and the viewer sorts by kind, opening on everything',
  /function EzikFavKindTabs\(\{ kind, onKind, counts \}\)/.test(html)
  && /const \[favKind, setFavKind\] = useState\('all'\);/.test(html));
// «الإحالة» to the OTHER store: adhkar_favorites_v1 is a different thing, and this item may not
// merge it. The favourites block must not name it at all.
ok('P8b: adhkar_favorites_v1 is NOT merged into the favourites store', (function () {
  const a = html.indexOf('const EZIK_FAV_KINDS');
  const b = html.indexOf('function ezikClearAllFavs');
  const block = (a !== -1 && b > a) ? html.slice(a, b) : '';
  return block.length > 500 && block.indexOf('ADHKAR_FAVORITES_KEY') === -1
    && block.indexOf('adhkar_favorites_v1') === -1 && block.indexOf('readAdhkarFavorites') === -1;
}()));

/* ---- P9. the ORDER, and that this screen does not decide it ------------- */
ok('P9: the newest-first order is the owner\'s single sort, unchanged',
  /const myFavs = React\.useMemo\(\s*\r?\n\s*\(\) => favs\.filter\(\(f\) => f\.pk === favPk\)\.sort\(\(a, b\) => \(b\.at \|\| 0\) - \(a\.at \|\| 0\)\),/.test(html));
// Item 86 re-pinned this. It read:
//   /const shownFavs = favResults === null \? myFavs : favResults;/
// and the viewer now narrows by KIND before the search runs over what is left. The rule it
// guards is untouched and is still pinned below: the search re-orders nothing, it only
// annotates each record it kept with its hit.
ok('P9: ...and the search keeps whatever order it was given',
  /const shownFavs = favResults === null \? kindFavs : favResults\.filter/.test(html)
  && /const kindFavs = favKind === 'all' \? myFavs : myFavs\.filter\(\(f\) => ezikKindOf\(f\) === favKind\);/.test(html)
  && /out\.push\(Object\.assign\(\{\}, f, \{ hit: ezikSearchSnippet/.test(html));
ok('P9: ...and the kind is a FILTER over that order, never a re-sort of it',
  !/kindFavs[\s\S]{0,80}?\.(sort|reverse)\(/.test(html)
  && /favResults\.filter\(\(f\) => favKind === 'all' \|\| ezikKindOf\(f\) === favKind\)/.test(html));
eq('P9: the screen maps the records exactly once', (favCode.match(/items\.map\(/g) || []).length, 1);
okOn('P9: ...and re-orders, filters, slices or reverses nothing', [["favView", favView]],
  !/items\.(sort|filter|slice|reverse|concat)\(/.test(favCode)
  && !/\.sort\(|\.reverse\(/.test(favCode));
ok('P9: ...and every card is keyed by the record\'s OWN id',
  /<div key=\{f\.id\} className="ezfav-card"/.test(favView)
  && !/key=\{i\}|key=\{index\}/.test(favCode));

/* ---- P10. one renderer, and a long reply is never cut ------------------- */
ok('P10: the card still renders through the SAME segment renderer the chat bubble uses',
  /function FavoriteReplyBody[\s\S]{0,900}?ezikRenderSegments\(shown/.test(html)
  && (html.split('function ezikRenderSegments').length - 1) === 1
  && ((html.match(/ezikRenderSegments\(/g) || []).length - 1) === 2);
ok('P10: ...so the ayah, the hadith and the source card arrive by that one path',
  /<FavoriteReplyBody segments=\{parsed\.segments\} age=\{age\} tashkeel=\{tashkeel\} \/>/.test(favView)
  && /const parsed = parseRichMessage\(f\.text, age\);/.test(favView));
ok('P10: ...and the fold is the shipped one, so nothing is truncated permanently',
  /ezikFoldSegments\(segments, EZIK_FOLD_MIN_CHARS, EZIK_FOLD_HEAD_CHARS\)/.test(favBody)
  && /const shown = \(folded && !open\) \? folded : segments;/.test(favBody));
ok('P10: no rule on this screen clamps, truncates or ellipsises a saved reply',
  !/\.ezfav-(read|card|cat)[^{]*\{[^}]*(text-overflow|line-clamp|max-height)/.test(css)
  && !/textOverflow|WebkitLineClamp|maxHeight/.test(JSON.stringify([s.favCard, s.favText, s.favBody])));
okOn('P10: ...and the text handed to the renderer is the record\'s own, unaltered', [["favView", favView]],
  !/f\.text\.(slice|substr|substring|replace)\(/.test(favCode));

/* ---- P11. the actions, all three of them -------------------------------- */
ok('P11: copy is the shipped button, on the whole reply, serialised the shipped way',
  /<CopyReplyButton\s*\r?\n\s*text=\{String\(f\.text \|\| ''\)\.trim\(\)\}\s*\r?\n\s*getText=\{\(\) => serializeReply\(parsed\.segments, \{ tashkeel, band: deriveCaps\(age\)\.band \}\)\}/.test(favView));
ok('P11: remove calls the shipped handler with that record\'s id, and says so',
  /<button type="button" onClick=\{\(\) => onRemove\(f\.id\)\} aria-label=\{EZIK_FAV_DEL\} className="ezik-focus" style=\{s\.favBtn\}>/.test(favView));
ok('P11: ...and it removes ONE record, never the list',
  !/onRemove\(\)/.test(favCode) && !/ezikClearAllFavs/.test(favCode)
  && (favCode.match(/onRemove\(/g) || []).length === 1);
// Item 86 re-pinned the second term. It read `/\{alive \? \(/`, and a fatwa and an ayah never
// came from a conversation -- offering either of them «المحادثة الأصلية محذوفة» would be a
// false statement about a record that never had one. So the reply test comes FIRST and the
// alive test is unchanged behind it. The rule for a REPLY is exactly what it was.
ok('P11: opening the original is still offered only when the conversation exists',
  /const alive = !!f\.chatId && liveChatIds\.has\(f\.chatId\);/.test(favView)
  && /\{ezikKindOf\(f\) !== 'reply' \? null : alive \? \(/.test(favView)
  && /onClick=\{\(\) => onOpenChat\(f\.chatId\)\} aria-label=\{EZIK_FAV_OPEN_CHAT\}/.test(favView));
ok('P11: ...and when it is gone the card SAYS so instead of offering a dead button',
  /<span style=\{\{ \.\.\.s\.favBtn, \.\.\.s\.favBtnOff \}\}>\{EZIK_FAV_CHAT_GONE\}<\/span>/.test(favView));
ok('P11: ...through the one route into a conversation, which still spends the sheet\'s entry',
  /const openFavoriteChat = \(id\) => \{\s*\r?\n\s*if \(!id \|\| !liveChatIds\.has\(id\)\) return;\s*\r?\n\s*openSavedChat\(id\);\s*\r?\n\s*goEzikBack\(\);/.test(html));
ok('P11: the date shown is the record\'s own timestamp, formatted by the shipped helper',
  /const when = ezikFavDate\(f\.at\);/.test(favView) && /\{when && <div style=\{s\.favMeta\}>\{when\}<\/div>\}/.test(favView));

/* ---- P12/P13/P14. empty, back, and the names --------------------------- */
ok('P12: an empty screen is a composition, not a blank page',
  /\{total === 0 && \(\s*\r?\n\s*<div className="ezfav-empty">/.test(favView)
  && /<span className="ezfav-empty-crest" aria-hidden="true"><span className="ezfav-empty-in" \/><\/span>/.test(favView)
  && /\{EZIK_FAV_EMPTY\}/.test(favView));
ok('P12: ...and it still says exactly what it always said',
  /const EZIK_FAV_EMPTY = 'لا توجد ردود محفوظة بعد\. اضغط النجمة تحت أي رد لتحفظه هنا\.';/
    .test(html.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))));
ok('P12: a search that matches nothing says so, separately from an empty store',
  /\{total > 0 && searching && items\.length === 0 && <div style=\{s\.drawerEmpty\}>\{EZIK_SEARCH_NONE\}<\/div>\}/.test(favView));
// Every string this screen draws comes from a named constant or from the record itself. A quoted
// Arabic literal in the markup would be a sentence somebody wrote here, which is the thing the
// review forbade -- and no seeded record may have come along with the redesign either.
okOn('P12: no invented text and no seeded record reached the screen', [["favView", favView]],
  !/lorem|sample|demo|dummy/i.test(favCode)
  && !/['"][؀-ۿ]/.test(favCode)
  && !/\{\s*id:\s*['"]/.test(favCode));
ok('P13: the screen is still a SHEET, so its back returns to whatever opened it',
  /const EZIK_SHEET_SCREENS = \['parentGate', 'parentDashboard', 'settings', 'favorites'\];/.test(html)
  && /if \(screen === 'favorites'\) return <FavoritesScreen [^>]*onBack=\{goEzikBack\}/.test(html));
okOn('P13: ...and the component navigates nowhere itself', [["favView", favView]],
  !/setScreen\(/.test(favCode) && !/goEzikBack/.test(favCode) && !/history\.(back|go)\(/.test(favCode));
{
  // إزالة من المفضلة / افتح المحادثة الأصلية /
  // ابحث في الردود المفضلة
  const NAMES = ['EZIK_FAV_DEL', 'EZIK_FAV_OPEN_CHAT', 'EZIK_FAV_SEARCH_ARIA'];
  eqOn('P14: every accessible name this screen shipped with is still on its control',
    [["favView", favView]],
    NAMES.filter((n) => favView.indexOf('aria-label={' + n + '}') === -1), []);
  ok('P14: ...and the two decorative marks declare themselves decoration',
    (favView.match(/aria-hidden="true"/g) || []).length >= 4);
  ok('P14: ...and every control still carries the keyboard focus ring',
    (favCode.match(/className="ezik-focus"/g) || []).length >= 3
    || /ezfav-back ezik-focus/.test(favCode));
}

/* ---- P15..P17. the blast radius --------------------------------------- */
okOn('P15: the conversation store is untouched by this screen', [["favView", favView]],
  favCode.indexOf('EZIK_CHATS_KEY') === -1 && favCode.indexOf('EZIK_CHAT_PREFIX') === -1
  && favCode.indexOf('ezikSaveChat') === -1 && favCode.indexOf('ezikDeleteChat') === -1);
okOn('P15: ...and so is every endpoint', [["favView", favView]], !/fetch\(|\/api\//.test(favCode));
okOn('P16: the chat and the call keep their own identities, not this one', [["callView", callView], ["chatSrc", chatSrc]],
  !/ezfav/.test(chatSrc) && !/ezfav/.test(callView)
  && html.indexOf('<div className="theme-dark ezhome ezc" style={s.chatContainer}>') !== -1
  && html.indexOf('<div className="theme-dark ezhome ezcall" style={s.callContainer}>') !== -1);
ok('P17: no fixture, mock, harness or debug switch reached the shipped page',
  ![/__mode\b/, /127\.0\.0\.1:87\d\d/, /\bFIXTURE\b/i, /\bMOCK_[A-Z_]+\b/, /DEBUG_FAV/, /window\.__ezfav/]
    .some((re) => re.test(html)));

/* ============ Q. THE LAST FOUR SCREENS AND THE THREE BARRIERS (S115) ======
 * The boot screen, the first-run welcome, the parents' panel, its PIN gate, and the three
 * barriers. Their PRESENTATION moved and nothing else did, so most of this group is a FREEZE:
 * the first-run sequence, the PIN verification, the barrier conditions and their ORDER, every
 * storage key and every accessible name are named here so that moving one fails.
 * ---------------------------------------------------------------------- */
console.log('\n=== Q. THE LAST FOUR SCREENS AND THE THREE BARRIERS ===');

const cut = (from, to) => { const a = html.indexOf(from); if (a === -1) return ''; const b = html.indexOf(to, a + from.length); return b === -1 ? '' : html.slice(a, b); };
const onbSrc = cut('function Onboarding({ onStart })', '\nfunction ParentGate(');
const pgSrc = cut('function ParentGate({', '\n// قفل الإنفاق');
const sgSrc = cut('function SpendGate({', '\n// D88 -- the settings sheet');
const cvSrc = cut('function ChildVoiceNotice({', '\n// ONE PIN sheet');
const usSrc = cut('function UnlockSheet({', '\nfunction Onboarding(');
const pdSrc = cut('function ParentDashboard({', '\n// ====');
const qstrip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
for (const [n, src] of [['onboarding', onbSrc], ['parent gate', pgSrc], ['spend gate', sgSrc],
  ['child voice notice', cvSrc], ['unlock sheet', usSrc], ['parent dashboard', pdSrc]]) {
  ok('the ' + n + ' was located and bounded', src.length > 400 && src.length < 12000, 'len=' + src.length);
}
const ezRules = (name) => (css.match(new RegExp('\\.' + name + '[a-z0-9-]*(?:[^{}]*)\\{[^}]*\\}', 'g')) || []);

/* ---- Q1. every new classification is BOUND to a real mount ---------------- */
// Each test is run against the screen's OWN source, not the whole file: four of these screens
// share the card family, so a whole-file match would let one of them lose its mount while another
// kept the pattern alive -- which is exactly what the mutation battery caught here.
const MOUNTS = {
  loading: [html, /if \(screen === 'loading'\) return <div className="theme-dark ezhome ezload" style=\{s\.loadingScreen\}>/],
  onboarding: [onbSrc, /<div className="theme-dark ezhome ezonb" style=\{s\.welcomeContainer\}>[\s\S]{0,400}?<div className="ezonb-card"/],
  parentGate: [pgSrc, /<div className="theme-dark ezhome ezgate" style=\{s\.onboardingContainer\}>[\s\S]{0,200}?<div className="ezgate-card"/],
  parentDashboard: [pdSrc, /<div className="theme-dark ezhome ezparent" style=\{s\.dashboardContainer\}>[\s\S]{0,700}?<div className="ezparent-rail">/],
};
for (const k of Object.keys(MOUNTS)) {
  const mounted = MOUNTS[k][1].test(MOUNTS[k][0]);
  ok('Q1: ' + k + ' mounts on its own istana vocabulary', mounted);
  eq('Q1: ...and THAT is why the inventory calls it istana', INDEX_SCREENS[k].shell, mounted ? 'istana' : 'legacy');
}
ok('Q1: the three barriers all draw on the card family',
  /className="theme-dark ezhome ezgate"/.test(sgSrc) && /<div className="ezgate-card"/.test(sgSrc)
  && /className="theme-dark ezhome ezgate"/.test(cvSrc) && /<div className="ezgate-card"/.test(cvSrc)
  && /className="theme-dark ezhome ezgate"/.test(usSrc) && /<div className="ezgate-card"/.test(usSrc));
for (const v of ['ezload', 'ezonb', 'ezgate', 'ezparent']) {
  const rules = ezRules(v);
  ok('Q1: .' + v + '- declares its own rule set', rules.length >= 2, 'found ' + rules.length);
  ok('Q1: ...and no selector in it can match html, body or :root',
    !rules.some((r) => /(^|[,\s])(html|body|:root)[\s,{]/.test(r.split('{')[0])));
  eq('Q1: ...and not one of its rules attaches an image, a gradient or a repeat',
    rules.filter((r) => /url\(|gradient|repeat|background-image\s*:\s*(?!none)/.test(r)), []);
  ok('Q1: ...and none draws a pseudo-element over the content',
    !new RegExp('\\.' + v + '[a-z0-9-]*[^{]*::(before|after)').test(css)
    && !rules.some((r) => /[;{]\s*content\s*:/.test(r)));
  const lit = rules.filter((r) => /(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(r) && !/--ezg-scrim/.test(r));
  eq('Q1: ...and it states no colour of its own', lit, []);
}

/* ---- Q2. no legacy chrome and no literal colour is left on any of them ---- */
{
  const all = [onbSrc, pgSrc, sgSrc, cvSrc, usSrc, pdSrc].map(qstrip).join('\n');
  eqOn('Q2: none of the seven states a colour of its own', [["cvSrc", cvSrc], ["onbSrc", onbSrc], ["pdSrc", pdSrc], ["pgSrc", pgSrc], ["sgSrc", sgSrc], ["usSrc", usSrc]],
    (all.match(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g) || []), []);
  okOn('Q2: ...and none of them paints a gradient', [["cvSrc", cvSrc], ["onbSrc", onbSrc], ["pdSrc", pdSrc], ["pgSrc", pgSrc], ["sgSrc", sgSrc], ["usSrc", usSrc]], !/gradient/.test(all));
  const KEYS = ['loadingScreen', 'loadingSpinner', 'onboardingContainer', 'onboardingCard', 'bigEmoji',
    'onboardingTitle', 'onboardingSubtitle', 'onboardingInput', 'primaryBtn', 'secondaryBtn',
    'welcomeContainer', 'welcomeInner', 'welcomeCard', 'welcomeLogoSquare', 'welcomeTitle',
    'welcomeGreeting', 'welcomeInput', 'welcomePrimaryBtn', 'dashboardContainer', 'dashboardContent',
    'dashboardCard', 'dashboardLabel', 'dashboardValue', 'dashboardEmpty', 'conversationLog',
    'logEntry', 'logRole', 'logContent', 'logTime', 'dangerBtn'];
  eq('Q2: every style key the seven draw from still exists', KEYS.filter((k) => !s[k]), []);
  const litKeys = [];
  for (const k of KEYS) for (const p of Object.keys(s[k] || {})) {
    const v = String(s[k][p]);
    if (/#[0-9a-fA-F]{3,8}\b/.test(v) || /\brgba?\(/.test(v) || /gradient/.test(v)) litKeys.push(k + '.' + p + '=' + v);
  }
  eq('Q2: ...and not one of them carries a literal colour or a gradient', litKeys, []);
}

/* ---- Q3. the boot, and that nothing was added to it ---------------------- */
ok('Q3: the boot mark keeps the SHIPPED animation on the SHIPPED key',
  /loadingSpinner: \{ animation: 'pulse 1\.5s ease-in-out infinite' \}/.test(html)
  && /style=\{s\.loadingSpinner\} className="ezload-mark"/.test(html));
ok('Q3: ...and the boot gained no timer, no wait and no step',
  !/if \(screen === 'loading'\)[\s\S]{0,400}?(setTimeout|setInterval|await )/.test(html));
ok('Q3: the boot page is still painted from the boot token',
  /loadingScreen: \{ minHeight: '100vh', background: 'var\(--boot-bg\)'/.test(html));

/* ---- Q4. the first run is the first run ---------------------------------- */
// Measured on the MARKUP, in the order the reader meets it -- name, then the two choices, then
// the year. Reading order and tab order are the same thing here, and this is what pins both.
{
  const iName = onbSrc.indexOf('placeholder="الاسم"');
  const iMale = onbSrc.indexOf("setGender('male')");
  const iFemale = onbSrc.indexOf("setGender('female')");
  const iYear = onbSrc.indexOf('placeholder="سنة الميلاد');
  const iGo = onbSrc.indexOf('onClick={submit} disabled={!canStart}');
  ok('Q4: the welcome still asks the same three things, in the same order',
    iName !== -1 && iMale > iName && iFemale > iMale && iYear > iFemale && iGo > iYear,
    [iName, iMale, iFemale, iYear, iGo].join(' < '));
}
ok('Q4: ...validated the same way', /const ageValid = Number\.isInteger\(yearNum\) && derivedAge >= 4 && derivedAge <= 99;/.test(onbSrc)
  && /const canStart = !!\(name\.trim\(\) && gender && ageValid\);/.test(onbSrc));
ok('Q4: ...and it still hands the profile to the SAME single call',
  /const requestStart = \(n\) => \{\s*\r?\n\s*onStart\(name, n, gender\);/.test(onbSrc)
  && (qstrip(onbSrc).match(/onStart\(/g) || []).length === 1);
ok('Q4: the routing that follows it is untouched',
  html.indexOf("if (screen === 'onboarding') return <Onboarding onStart={startChat} />;") !== -1
  && /const startChat = async \(name, age, gender\) => \{/.test(html)
  && /localStorage\.setItem\('child_profile', JSON\.stringify\(p\)\);/.test(html));
okOn('Q4: ...and the welcome writes nothing itself', [["onbSrc", onbSrc]],
  !/localStorage|fetch\(/.test(qstrip(onbSrc)));

/* ---- Q5. the PIN gate: verification, creation, errors, lock -------------- */
// D12 MOVED THE JUDGE, NOT THE GATE. Until then these lines pinned a browser-side compare:
// SHA-256(code) in localStorage, re-hashed and string-compared right here. That compare is gone
// -- the verifier now lives in api/parent-code.js and the browser holds nothing it could check
// an answer against. So what Q5 pins changed shape, and deliberately: it now asserts the
// ABSENCE of a client-side verifier and the presence of the server call, which is the property
// that actually matters. The behaviour under test (four digits, matching confirmation, the
// adult challenge, the shipped wording) is asserted unchanged, because none of it moved.
// The mechanism itself is driven end to end by gate `lockpackage`; this stays a source pin.
okOn('Q5: the browser holds NO verifier for the parent code any more', [["pgSrc", pgSrc]],
  !/hashPin/.test(pgSrc) && !/=== stored/.test(pgSrc),
  'a client-side compare means the secret and the judge are both in the reader’s hands');
ok('Q5: ...it asks the server instead, for all three questions',
  /parentCodeCall\(\{ action: 'status' \}\)/.test(pgSrc)
  && /action: 'verify', pin: pinInput/.test(pgSrc)
  && /parentCodeCall\(\{ action: 'set', pin: pinInput \}\)/.test(pgSrc));
ok('Q5: ...and an unknown answer falls CLOSED to the verify form',
  /const needVerify = serverHas !== false \|\| !!readLegacyParentHash\(\);/.test(pgSrc),
  'an unreachable server must never be a route into create mode');
ok('Q5: ...created under the same rule as before',
  /if \(!\/\^\[0-9\]\{4,\}\$\/\.test\(pinInput\)\) return fail\('اختر ٤ أرقام على الأقل'\);/.test(pgSrc)
  && /if \(pinInput !== confirmPin\) return fail\('الرمزان غير متطابقان'\);/.test(pgSrc));
ok('Q5: ...and the adult challenge still stands in front of a child profile',
  /if \(mode === 'create' && !adultOk && PARENTAL_GATE_ENABLED && childProfileActive\(\)\) return <AdultGate a=\{challenge\.a\} b=\{challenge\.b\} onPass=\{\(\) => setAdultOk\(true\)\} onCancel=\{onBack\} \/>;/.test(pgSrc));
// The wording, not the call shape: D12 made these FALLBACKS behind the server's own message
// (`fail((d && d.message) || '…')`), because a wrong code, a day lockout and an unreachable
// store are three different truths and only the server knows which one happened.
ok('Q5: the shipped error wording has not drifted',
  /'رمز خاطئ'/.test(pgSrc) && /'تعذّر الحفظ'/.test(pgSrc)
  && /fail\(\(d && d\.message\) \|\| 'رمز خاطئ'\)/.test(pgSrc));
ok('Q5: the old key is read as a migration seed and never written again',
  /const LEGACY_PIN_HASH_KEY = 'parent_pin_hash';/.test(html)
  && /localStorage\.removeItem\(LEGACY_PIN_HASH_KEY\)/.test(html)
  && !/setItem\(LEGACY_PIN_HASH_KEY|setItem\('parent_pin_hash'/.test(html));

/* ---- Q6. the three barriers: conditions, order, handlers ----------------- */
{
  const spendAt = html.indexOf("if ((screen === 'chat' || screen === 'call') && !spendGateOpenState) return <SpendGate");
  const childAt = html.indexOf("if (screen === 'call' && childVoiceBlocked()) return <ChildVoiceNotice");
  const tokenAt = html.indexOf("if (screen === 'call' && !hasFounderToken()) return <UnlockSheet");
  const callAt2 = html.indexOf("if (screen === 'call') return <CallScreen");
  ok('Q6: the four gates are all still in the render chain',
    spendAt !== -1 && childAt !== -1 && tokenAt !== -1 && callAt2 !== -1);
  ok('Q6: ...in the shipped ORDER: spend, child voice, token, screen',
    spendAt < childAt && childAt < tokenAt && tokenAt < callAt2);
  okOn('Q6: no barrier grew a way past itself', [["cvSrc", cvSrc], ["sgSrc", sgSrc], ["usSrc", usSrc]],
    !/onSkip|bypass|skipGate/i.test(sgSrc + cvSrc + usSrc));
  ok('Q6: the spend gate still compares a hash and never stores the code',
    /if \(\(await hashPin\(code\)\) === SPEND_GATE_SHA256\) \{ onUnlock\(\); return; \}/.test(sgSrc)
    && !/localStorage/.test(qstrip(sgSrc)));
  ok('Q6: ...and its kill switch is untouched',
    /const SPEND_GATE_DISABLED = SPEND_GATE_SHA256 === '0'\.repeat\(64\);/.test(html));
  ok('Q6: the unlock sheet still POSTs to the shipped endpoint, once, and keeps only the token',
    /await fetch\('\/api\/unlock', \{/.test(usSrc)
    && /body: JSON\.stringify\(\{ pin, deviceId: getDeviceId\(\) \}\),/.test(usSrc)
    && /if \(r\.ok && d && d\.token\) \{ storeFounderToken\(d\.token\); setPin\(''\); onUnlocked\(\); return; \}/.test(usSrc));
  ok('Q6: ...and the SERVER still owns the wording', /setMsg\(\(d && d\.message\) \|\| ''\);/.test(usSrc));
  ok('Q6: the child-voice notice still shows the shipped text and the shipped way back',
    /\{CHILD_VOICE_NOTICE\}/.test(cvSrc) && /onClick=\{onBack\}/.test(cvSrc)
    && /const CHILD_VOICE_ENABLED = false;/.test(html));
  ok('Q6: no barrier fetches anything it did not already fetch',
    (qstrip(sgSrc + cvSrc + usSrc).match(/fetch\(/g) || []).length === 1);
}

/* ---- Q7. the parents' panel shows what it always showed ------------------ */
okOn('Q7: the panel still reads the SAVED history, handed down, and opens no store itself', [["pdSrc", pdSrc]],
  /<ParentDashboard profile=\{profile\} messages=\{ezikProfileTranscript\(ezikProfileKey\(profileRef\.current\)\)\}/.test(html)
  && !/localStorage|fetch\(/.test(qstrip(pdSrc)));
ok('Q7: ...and every row it shipped with is still drawn',
  /الطفل/.test(pdSrc) && /عدد الرسائل/.test(pdSrc) && /سجل المحادثات/.test(pdSrc)
  && /\{messages\.length\} رسالة/.test(pdSrc));
ok('Q7: ...including the young-only lock, on the same condition and the same handler',
  /const isYoung = deriveCaps\(profile\?\.age\)\.band === 'young';/.test(pdSrc)
  && /\{isYoung && \(/.test(pdSrc) && /onClick=\{onToggleDirectConvo\}/.test(pdSrc));
ok('Q7: ...and the reset is the same one control, on the same handler',
  (qstrip(pdSrc).match(/onClick=\{onReset\}/g) || []).length === 1);
ok('Q7: the log still shows exactly the messages it is handed, in order, unfiltered',
  /messages\.map\(\(m, i\) => \(/.test(pdSrc)
  && !/messages\.(sort|filter|slice|reverse)\(/.test(pdSrc));
ok('Q7: the back control is the screen\'s own, and the panel navigates nowhere itself',
  /<button onClick=\{onBack\} className="ezparent-back">← رجوع<\/button>/.test(pdSrc)
  && !/setScreen\(/.test(qstrip(pdSrc)));
ok('Q7: ...and its rail is bounded', /\.ezparent-rail-inner\{[^}]*max-width:900px/.test(css)
  && /\.ezparent-wrap\{[^}]*max-width:900px/.test(css));
ok('Q7: the card family is bounded too, and centred rather than stretched',
  /\.ezgate-card\{[^}]*max-width:420px/.test(css) && /\.ezonb-card\{[^}]*max-width:400px/.test(css));
ok('Q7: no vocabulary added here declares a viewport-wide box',
  !/\.(ezload|ezonb|ezgate|ezparent)[a-z0-9-]*[^{]*\{[^}]*(width|min-width|max-width)\s*:\s*100vw/.test(css));

/* ---- Q8. light is plain white, dark is real, for all of them ------------- */
for (const [label, key] of [['boot', 'loadingScreen'], ['welcome', 'welcomeContainer'],
  ['the card family', 'onboardingContainer'], ["the parents' panel", 'dashboardContainer']]) {
  const raw = s[key].background;
  const lit = resolve(raw, VT_PAL['istana_33:light']);
  const drk = resolve(raw, VT_PAL['istana_33:dark']);
  ok('Q8: ' + label + ' in istana light is plain #FFFFFF', !!lit && hex(lit) === '#ffffff', String(lit && hex(lit)));
  ok('Q8: ...and its dark face is a real second page', !!drk && hex(drk) !== hex(lit) && lum(drk) < 0.1, String(drk && hex(drk)));
}

/* ============ R. THE ISTANA QUEST VIEWS (S115) ===========================
 * The fifteen views that were left. Presentation only: this group binds each classification to
 * a real root class, and freezes the tabs, the ids, the destinations, the counts and the data
 * readers that the redesign was not allowed to touch.
 * ---------------------------------------------------------------------- */
console.log('\n=== R. THE ISTANA QUEST VIEWS ===');

const qCss = q.css;
const qRules = (qCss.match(/\.ezq[a-z0-9-]*(?:[^{}]*)\{[^}]*\}/g) || []);
ok('R1: quest declares its own istana rule set', qRules.length >= 8, 'found ' + qRules.length);
ok('R1: ...and no selector in it can match html, body or :root',
  !qRules.some((r) => /(^|[,\s])(html|body|:root)[\s,{]/.test(r.split('{')[0])));
eq('R1: ...and not one of its rules attaches an image, a gradient or a repeat',
  qRules.filter((r) => /url\(|gradient|repeat|background-image\s*:\s*(?!none)/.test(r)), []);
ok('R1: ...and none draws a pseudo-element over a question',
  !/\.ezq[a-z0-9-]*[^{]*::(before|after)/.test(qCss) && !qRules.some((r) => /[;{]\s*content\s*:/.test(r)));
eq('R1: ...and it states no colour of its own', qRules.filter((r) => /(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(r)), []);
ok('R1: no ezq rule declares a viewport-wide box',
  !/\.ezq[a-z0-9-]*[^{]*\{[^}]*(width|min-width|max-width)\s*:\s*100vw/.test(qCss));
// EVERY classification is bound to a root the file actually builds.
{
  // A view classified by its ROOT must actually call qv() with that name -- `_modeCard` is the one
  // that tags a card rather than a view root, so it is checked by the class it puts on the card.
  const missingRoot = Object.keys(QUEST_SCREENS)
    .filter((k) => QUEST_SCREENS[k].root)
    .filter((k) => {
      const n = QUEST_SCREENS[k].root.replace('ezq-', '');
      return q.html.indexOf('qv("' + n + '")') === -1 && q.html.indexOf('"card ' + QUEST_SCREENS[k].root + '"') === -1;
    });
  eq('R2: every view classified istana by its ROOT actually builds that root', missingRoot, []);
  // A LAUNCHER opens the round, so its classification is bound to the round's own surface.
  const viaMissing = Object.keys(QUEST_SCREENS)
    .filter((k) => QUEST_SCREENS[k].via)
    .filter((k) => q.html.indexOf('qv("' + QUEST_SCREENS[k].via.replace('ezq-', '') + '")') === -1);
  eq('R2: ...and every launcher\'s surface exists too', viaMissing, []);
  ok('R2: ...and the three launchers really do open that surface',
    /startStation\(rid, s\) \{[\s\S]{0,400}?Round\.start\(/.test(q.html)
    && /daily\(\) \{[\s\S]{0,400}?Round\.start\(/.test(q.html)
    && /speed\(\) \{[\s\S]{0,300}?Round\.start\(/.test(q.html));
  ok('R2: the root helper is what builds them, and it is presentation only',
    /function qv\(name\) \{ const d = document\.createElement\("div"\); d\.className = "ezq ezq-" \+ name; return d; \}/.test(q.html));
  ok('R2: ...and the head helper reads nothing and invents nothing',
    /function qhead\(v, eyebrow, title, sub, aside\) \{/.test(q.html)
    && !/Data\.|P\.s|Store\./.test(q.html.slice(q.html.indexOf('function qhead('), q.html.indexOf('function mount('))));
  const qvCalls = (q.html.match(/= qv\("/g) || []).length;
  eq('R2: thirteen view roots are built through it', qvCalls, 13);
}
ok('R3: the four tabs are unchanged -- same ids, same names, same destinations, same aria-current',
  q.html.indexOf('[["map", NAV_ICON.map, "الخريطة", Screens.map], ["challenge", NAV_ICON.challenge, "التحدّيات", Screens.challenges],') !== -1
  && q.html.indexOf('["book", NAV_ICON.book, "الكنوز", Screens.book], ["me", NAV_ICON.me, "أنا", Screens.profile]]') !== -1
  && /b\.setAttribute\("aria-current", String\(TAB === id\)\);/.test(q.html));
// EVERY one of the four is built by NAV_SVG. Counting the calls is what stops one of them being
// swapped for a glyph while the other three keep the helper alive.
ok('R3: ...and the nav glyphs are still stroked SVG, never emoji',
  /const NAV_SVG = \(d\) =>/.test(q.html)
  && (q.html.match(/: NAV_SVG\('/g) || []).length === 4
  && !/NAV_ICON = \{[\s\S]{0,900}?\\u[dD][89abAB]/.test(q.html));
ok('R4: the medallion is still the Iznik arch, and r.hue is still not a colour source',
  /const ARCH = "M50 12c14 0 24 10 24 24v40a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V36c0-14 10-24 24-24z";/.test(q.html)
  && !/r\.hue/.test(qstrip(q.html.slice(q.html.indexOf('function medal('), q.html.indexOf('function reportBtn(')))));
// COUNTED per tab. A view moving to another tab, a view losing its mount, or a new one appearing
// all change one of these five numbers -- which is what "same destinations" means in this file.
{
  const m = (t) => (q.html.match(new RegExp('mount\\(v, ' + t + '\\)', 'g')) || []).length;
  eq('R5: every view still mounts through the shipped mount(), with its shipped tab',
    [m('"map"'), m('"challenge"'), m('"book"'), m('"me"'), m('TAB')].join('/'), '2/7/1/2/3');
}
ok('R6: the region view still reads its stations and its stars from the shipped readers',
  /const r = Data\.regions\[rid\], sts = Data\.stations\(rid\);/.test(q.html)
  && /const got = P\.s\.stars\[rid \+ ":" \+ s\.index\] \|\| 0;/.test(q.html)
  && /btn\.onclick = \(\) => Screens\.startStation\(rid, s\);/.test(q.html));
ok('R6: ...and the four mode cards still point at the four shipped destinations',
  /Screens\._modeCard\("🗝️", "تحدّي اليوم"[\s\S]{0,220}?Screens\.daily\)/.test(q.html)
  && /Screens\.speed\)\);/.test(q.html) && /Screens\.teamsSetup\)\);/.test(q.html) && /Screens\.inspect\)\);/.test(q.html));
ok('R7: the round still scores, stars and progresses the shipped way',
  /P\.markStation\(cfg\.region, cfg\.station, stars\)/.test(q.html)
  && /P\.addXP\(/.test(q.html) && /P\.addCoins\(/.test(q.html) && /Rewards\.check\(\)/.test(q.html));
ok('R7: ...and the store key and its reader are untouched',
  /save\(\) \{ Store\.set\(this\.KEY, this\.s\); \}/.test(q.html)
  && /load\(\) \{ this\.s = Object\.assign\(this\.fresh\(\), Store\.get\(this\.KEY, \{\}\)\); \}/.test(q.html));
// The game has exactly ONE live fetch and it is the asset loader that shipped -- the only other
// occurrence in the file is inside a comment showing the reporting endpoint that was never wired.
ok('R8: nothing in this batch added a fetch, an endpoint or a second store to the game',
  (qstrip(q.html).match(/fetch\(/g) || []).length === 1
  && /const r = await fetch\(url, \{ cache: "no-store" \}\)/.test(q.html)
  && /send\(rec\) \{ \}/.test(q.html));
ok('R9: the question text is still built by the shipped presenter, from the bank',
  /present\(q\) \{/.test(q.html) && /stem\(p\) \{/.test(q.html)
  && /setBank\(json\) \{ this\.bank = json; this\.index\(\); \}/.test(q.html));
ok('R10: the primary action is flat now, and it is the only place that changed colour',
  /\.btn\.primary\{background:var\(--palm\);color:var\(--paper\);border-color:var\(--palm\);box-shadow:none\}/.test(qCss)
  && !/\.btn\.primary\{[^}]*linear-gradient/.test(qCss));

/* ---- S1. the analytics that were removed for the AI-consent release ------ */
// Apple 5.1.1(i): both Vercel scripts began measuring on page LOAD -- that is, before the reader
// had answered the consent screen -- so both were removed and nothing replaced them. These four
// checks are what stops either one, or a substitute, from returning unnoticed.
ok('S1: no Vercel Web Analytics script is loaded', !/<script[^>]*_vercel\/insights/.test(html));
ok('S1: no Speed Insights script is loaded', !/<script[^>]*_vercel\/speed-insights/.test(html));
ok('S1: and no substitute analytics tool took their place',
  !/googletagmanager|google-analytics|gtag\(|plausible|posthog|mixpanel|segment\.com|amplitude|plausible\.io|plausible\.js/i.test(html));
// EXACTLY three, never "three or fewer": a <= would let a fourth script arrive the day two others
// are dropped, which is precisely the drift this count exists to catch.
eq('S1: the page loads exactly three scripts', (html.match(/<script[^>]*src=["'][^"']+["']/gi) || []).length, 3);


/* ---- T. ITEM 102: THE ASK-PIN SETTLES BY ITSELF, AND THE BREAKER STILL SITS ABOVE IT ---- */
// The pin's layout effect has no dependency list: it runs on EVERY render of the chat, so
// whatever it computes must be a function of the LAYOUT ALONE. When it was a function of its own
// previous output as well, the effect walked away from its own answer -- MEASURED in Chrome at
// 430x932: `need` came back 14, 28, 42, 56, 70, 84, 98, 112 on eight consecutive passes of a
// single turn, and only `pinPassRef` stopped it. That is what these checks stand over.
//
// They are deliberately TWO checks and not one. The first says the room is measured without the
// spacer in the reading; the second says the breaker is still there anyway. A cure is not a
// reason to take the fence down, so neither check is allowed to stand in for the other.
const pinSrc = html.replace(/\r\n/g, '\n');
const pinEffect = (pinSrc.match(
  /const anchorTop = anchor\.getBoundingClientRect\(\)\.top[\s\S]*?pinScrollTopRef\.current = el\.scrollTop;/,
) || [''])[0];
// Every check below reads the CODE of that effect, never its prose: `pinCode` is the same
// region with its line comments removed. Asserting against text that includes the comments
// lets an explanation satisfy a check, and lets an honest explanation break one -- the first
// draft of T2 failed on the word `scrollHeight` inside the comment that explains why
// `scrollHeight` may not be used.
const pinCode = pinEffect.replace(/\/\/[^\n]*/g, '');
ok('T0: the ask-pin layout effect is still present and still measures from the anchor',
  pinEffect.length > 0 && /el\.clientHeight/.test(pinEffect));

// THE SETTLING RULE. The room is read off whichever element marks the end of the real content --
// the spacer when it is mounted, the end sentinel when it is not. Those two sit at the SAME
// place, so the reading does not change when the spacer appears, and `need` therefore cannot
// depend on `askPinPad`.
ok('T1: the room is measured from the content tail, not from the spacer that was applied',
  /const tail = askPadElRef\.current \|\| messagesEndRef\.current;/.test(pinCode)
  && /naturalBelow = tail\.getBoundingClientRect\(\)\.top/.test(pinCode),
  'the tail reading is gone -- `need` can depend on its own output again');

// AND IT MUST NOT GO BACK TO `scrollHeight`. That number never drops below `clientHeight`, so on
// every first question in a new chat -- where the transcript is shorter than the viewport -- it
// stays put no matter how tall the spacer grows, and subtracting the spacer from it removes a
// height that was never added.
ok('T2: the room measurement does not read el.scrollHeight',
  !/scrollHeight/.test(pinCode.split('const need =')[0]),
  'scrollHeight is back in the measurement -- it is clamped at clientHeight and cannot be used here');

// THE GAP THE SPACER BRINGS WITH IT. The scroller is a column flexbox; mounting one more child
// adds one more row gap, and `offsetHeight` knows nothing about it. Subtracting it is what makes
// a spacer that would buy less room than its own gap costs come out as 0 instead of flickering.
ok('T3: the row gap the spacer would introduce is taken off the room it must buy',
  /const rowGap = [^;]*cs\.rowGap/.test(pinCode)
  && /- naturalBelow - rowGap/.test(pinCode));

// THE BREAKER, UNCHANGED AND STILL ABOVE THE WRITE. `pinPassRef` is a fence, not a cure: it is
// what saved the product on the night of 20-21 August and it stays exactly where it was, with
// the same bound, regardless of the settling rule above being correct.
const bumpAt = pinCode.indexOf('pinPassRef.current += 1;');
const boundAt = pinCode.indexOf('if (pinPassRef.current > 8) {');
const writeAt = pinCode.indexOf('setAskPinPad(need);');
ok('T4: the pinPassRef breaker is still armed, still bounded at 8, and still ahead of the write',
  bumpAt !== -1 && boundAt !== -1 && writeAt !== -1
  && bumpAt < boundAt && boundAt < writeAt
  && /pinActiveRef\.current = false;\s*\n\s*setAskPinPad\(0\);/.test(pinCode),
  'the breaker moved, changed bound, or stopped preceding the write');
// The four places the counter lives, counted in the whole file so a silent deletion elsewhere
// cannot leave the effect looking healthy on its own.
eq('T5: pinPassRef still appears at exactly its five code positions',
  (pinSrc.match(/pinPassRef\.current|const pinPassRef/g) || []).length, 6);

// ITEM 102-ب. THE COUNT IS CLEARED BY REAL CONTENT CHANGE, so the breaker can only ever count
// CONSECUTIVE writes that changed nothing -- which is the only thing it was ever meant to stop.
// MEASURED before the clearing existed: `pinPassRef` stood at 9 by 504 visible characters of a
// 6,697-character answer (a write per ~72 streamed characters), so the fence was being spent in
// the middle of ordinary answers and the pin it protects was disarmed mid-stream.
//
// Read BY NAME and never by line number: every commit moves the lines under this file.
ok('T6: the pin pass count is cleared whenever the streamed length changed since the last pass',
  /const streamLen = streamingText == null \? -1 : streamingText\.length;/.test(pinCode)
  && /if \(streamLen !== pinLenRef\.current\) \{\s+pinLenRef\.current = streamLen;\s+pinPassRef\.current = 0;\s+\}/.test(pinCode),
  'the clearing is gone -- the breaker is charged again for every write a growing answer asks for');

// AND IT MUST SIT ABOVE THE BREAKER. A clearing that ran AFTER the bump would zero the very pass
// it was meant to judge; one that ran after the bound would never be reached once the breaker
// had fired. Ordering is the whole contract, so it is asserted as an ordering.
const clearAt = pinCode.indexOf('pinLenRef.current = streamLen;');
ok('T7: ...and the clearing happens BEFORE the breaker is charged and before it is tested',
  clearAt !== -1 && bumpAt !== -1 && boundAt !== -1
  && clearAt < bumpAt && bumpAt < boundAt,
  'the clearing moved below the breaker, where it can no longer stop it being spent on real work');

// The reading itself lives at exactly five places: declared once, compared and rewritten inside
// the pass, and returned to -1 at BOTH the point that disarms the pin and the point that re-arms
// it. A turn can therefore never inherit the previous turn's reading and start already counted.
eq('T8: pinLenRef appears at exactly its five code positions',
  (pinSrc.match(/pinLenRef\.current|const pinLenRef/g) || []).length, 5);


/* ---- X. ITEM 103: THE DIAGNOSTIC CATCHER IS PINNED, AND CONNECTED --------
 * The item as written was «remove the catcher once we are reassured». Removing it would have
 * been wrong, and this section is the reason it is pinned instead.
 *
 * The catcher is the FIRST script after <body>, and that position is the whole of its value: it
 * is the only thing in the page that can witness a failure BEFORE React exists -- a CDN that
 * 404s, an SRI mismatch, a Babel transform that throws on the inline block, a syntax error in
 * the app itself. The React error boundary cannot see any of those, because at that moment
 * there is no React to catch with. Move the catcher below the React tags and the whole class of
 * failure it exists for stops being recorded, silently, with nothing going red anywhere --
 * which is exactly what these checks now prevent.
 *
 * NOTHING IN THIS TREE ASSERTED ANY OF IT BEFORE. The repository was swept for a check pinning
 * the catcher or its position -- every .cjs, gates.json, every guard file -- and there was none,
 * in this file or any other. This barrier is therefore new rather than moved, and no assertion
 * had to be held out of scope.
 */
console.log('\n=== V. THE PRE-BOOT DIAGNOSTIC CATCHER (item 103) ===');
const bodyAt = html.indexOf('<body>');
const catcherAt = html.indexOf('<script id="ezik-diagnostic-catcher">');
const reactAt = html.indexOf('react.production.min.js');
const rootDivAt = html.indexOf('<div id="root">');
ok('X1: the diagnostic catcher is still in the page', catcherAt !== -1);
// FIRST, and proved as FIRST rather than merely as PRESENT: every other <script> must come
// either before <body> (the head boot scripts) or after the catcher. Counted, so that a script
// inserted between <body> and the catcher fails here even when it is harmless in itself.
const scriptsBetween = (bodyAt !== -1 && catcherAt !== -1)
  ? (html.slice(bodyAt, catcherAt).match(/<script\b/gi) || []).length : -1;
eq('X2: no script at all stands between <body> and the catcher', scriptsBetween, 0);
ok('X3: ...and the catcher runs BEFORE React, its DOM root and the Babel transform',
  catcherAt !== -1 && reactAt !== -1 && rootDivAt !== -1
  && catcherAt < reactAt && catcherAt < rootDivAt,
  'the catcher was moved below the boot it exists to witness');
// A deferred or async catcher is a catcher that is not there when the failure happens.
const catcherTag = catcherAt === -1 ? '' : html.slice(catcherAt, html.indexOf('>', catcherAt) + 1);
okOn('X4: the catcher is not deferred, async, or a module', [['catcherTag', catcherTag]],
  !/\bdefer\b/.test(catcherTag) && !/\basync\b/.test(catcherTag) && !/type\s*=\s*["']module/.test(catcherTag),
  'a deferred catcher cannot witness what happens before it runs');

/* ---- X5..X7. what it catches is KEPT, in memory and nowhere else -------- */
const catcherEnd = catcherAt === -1 ? -1 : html.indexOf('</script>', catcherAt);
const catcherSrc = (catcherAt !== -1 && catcherEnd > catcherAt) ? html.slice(catcherAt, catcherEnd) : '';
// Every check below reads the CODE, never the prose. The catcher explains in its own comments
// that it uses no localStorage and no request -- and a check that read those comments would
// fail on the very sentence that promises the thing it is checking.
const catcherCode = catcherSrc.replace(/\/\/[^\n]*/g, ' ');
ok('X5: the catcher body was located', catcherSrc.length > 2000, 'len=' + catcherSrc.length);
okOn('X5: ...and it publishes a bounded store the rest of the page can read', [['catcherSrc', catcherSrc]],
  /window\.__ezikDiag = \{/.test(catcherCode)
  && /max: MAX_ENTRIES/.test(catcherCode)
  && /count: function/.test(catcherCode)
  && /text: function/.test(catcherCode),
  'the pre-boot store is no longer published -- the boundary can reach nothing');
okOn('X6: the store is BOUNDED, and by the same constant the recorder obeys', [['catcherSrc', catcherSrc]],
  /var MAX_ENTRIES = \d+;/.test(catcherCode)
  && /if \(entries\.length >= MAX_ENTRIES\) return;/.test(catcherCode),
  'the store lost its bound, or the bound and the recorder disagree');
// IN MEMORY AND NOWHERE ELSE. A diagnostic that wrote to disk would outlive the fault it
// describes, and one that phoned home would be a request made by the very code path that exists
// because requests fail.
okOn('X7: the catcher persists nothing and sends nothing', [['catcherCode', catcherCode]],
  !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(catcherCode)
  && !/fetch\(|XMLHttpRequest|sendBeacon|EventSource|new WebSocket/.test(catcherCode),
  'the pre-boot catcher grew a store or a wire');

/* ---- X8..X10. and the boundary now carries it out ----------------------- */
const ebAt = html.indexOf('function ErrorBoundary(props)');
const ebEnd = html.indexOf('const root = ReactDOM.createRoot', ebAt);
const ebSrc = (ebAt !== -1 && ebEnd > ebAt) ? html.slice(ebAt, ebEnd) : '';
ok('X8: the error boundary was located', ebSrc.length > 1000, 'len=' + ebSrc.length);
okOn('X8: «copy the details» reads the pre-boot store, not the React error alone', [['ebSrc', ebSrc]],
  /ErrorBoundary\.prototype\.preBootDetails = function/.test(ebSrc)
  && /window\.__ezikDiag/.test(ebSrc)
  && /\+ this\.preBootDetails\(\)/.test(ebSrc),
  'the boundary is back to copying only what it caught itself');
okOn('X9: ...and a page where the catcher never ran copies exactly as it did before', [['ebSrc', ebSrc]],
  /if \(!diag \|\| typeof diag\.text !== 'function'\) return '';/.test(ebSrc)
  && /catch \(ignored\) \{[\s\S]{0,40}return '';/.test(ebSrc),
  'the pre-boot reader can now throw inside the copy handler');

// THE PANEL ITSELF IS UNTOUCHED. Its three Arabic strings are pinned BY CODEPOINT, read out of
// the render function's own escaped literals and compared as ASCII digits -- no Arabic is typed
// here, so nothing in this check can reorder under bidi and then lie about what it names.
const ebRenderAt = html.indexOf('ErrorBoundary.prototype.render = function ()');
const ebRender = (ebRenderAt !== -1 && ebEnd > ebRenderAt) ? html.slice(ebRenderAt, ebEnd) : '';
const ebArabic = (ebRender.match(/'(?:\\u[0-9a-f]{4})+'/gi) || []);
eq('X10: the panel still carries exactly its three Arabic strings', ebArabic.length, 3);
eq('X10: ...and not one codepoint of any of them moved',
  ebArabic.map((s) => (s.match(/[0-9a-f]{4}/gi) || []).join(',')).join(' / '),
  '062a,0639,0630,0651,0631,0020,0639,0631,0636,0020,0627,0644,0645,062d,0627,062f,062b,0629'
  + ' / 0623,0639,062f,0020,0627,0644,0645,062d,0627,0648,0644,0629'
  + ' / 0627,0646,0633,062e,0020,0627,0644,062a,0641,0627,0635,064a,0644');
okOn('X10: ...and both buttons are still there, on their own handlers', [['ebSrc', ebSrc]],
  /onClick: this\.retry/.test(ebSrc) && /onClick: this\.copyDetails/.test(ebSrc));

/* ---- U. ITEM 44-أ: THE TEXT SCALE, AND THE READER THAT IS OUTSIDE IT ---- */
// THESE CHECKS RUN THE SCALE PASS FOR REAL, so they must be LAST: `ezikEnsureScalableStyles`
// rewrites the styles object IN PLACE, and every earlier section reads that object. Nothing may
// be added below this block that reads `s`.
//
// The question they answer is not "is there a setting" but "does the multiplier stop where the
// brief says it stops". MEASURED in Chrome at 430x932 before the exclusion existed: the reader's
// own title rendered 15px / 17.1px / 19.2px across the three steps.
eq('U1: the scale is exactly three steps, with the factors the boot script uses',
  vm.runInContext('JSON.stringify(EZIK_FS_SCALES)', CTX), '{"normal":1,"large":1.14,"xlarge":1.28}');
// The pre-paint script is what stops the page flashing at the default size and then jumping. It
// carries its own copy of the table, so the two are compared rather than trusted.
ok('U2: the pre-paint boot script carries the SAME table, so the choice is applied before the first frame',
  /var S=\{normal:1,large:1\.14,xlarge:1\.28\};/.test(html)
  && /localStorage\.getItem\('ezik_reading_prefs_v1'\)/.test(html)
  && html.indexOf('var S={normal:1') < html.indexOf('<div id="root">'),
  'the boot table is missing, disagrees, or no longer runs before #root');

// THE DEFAULT IS THE OBJECT THAT SHIPPED. Nobody who never opens الإعدادات pays for this feature,
// and that is a property of the styles object, not a claim: at the default size every size is
// still a plain number and no calc() has been built.
const fsOf = (k) => vm.runInContext('JSON.stringify(s.' + k + '.fontSize)', CTX);
ok('U3: at the default step the styles object is untouched — every sampled size is still a number',
  ['input', 'messageBubble', 'ezmrTitle', 'pgHeader', 'mushafName'].every((k) => /^\d/.test(JSON.parse(fsOf(k)) + '')),
  ['input', 'messageBubble', 'ezmrTitle', 'pgHeader', 'mushafName'].map((k) => k + '=' + fsOf(k)).join(' '));

// ...and now the pass runs, exactly as choosing a larger size runs it.
vm.runInContext('ezikEnsureScalableStyles()', CTX);
const scaled = (k) => { const v = fsOf(k); return v === undefined ? undefined : JSON.parse(v); };
const isCalc = (v) => /^calc\(.*var\(--ez-fs/.test(String(v));
ok('U4: after the pass the interface follows the one multiplier on :root',
  isCalc(scaled('input')) && isCalc(scaled('messageBubble')),
  'input=' + fsOf('input') + ' bubble=' + fsOf('messageBubble'));

// THE READER'S SCOPE. Every size in the object scales — including the reader's own keys, which
// is what a11y-guard requires — and the reader is taken out ONE LEVEL DOWN instead: its root
// resets `--ez-fs` to 1, so every calc() inside it evaluates to the number that shipped. The
// page fit divides by pgPage's element-child count and measures its rows, so nothing inside
// that box may move when someone chooses larger text elsewhere.
ok('U5: the reader keys scale like everything else — the exclusion is not a hole in the pass',
  isCalc(scaled('ezmrTitle')) && isCalc(scaled('pgHeader')),
  'ezmrTitle=' + fsOf('ezmrTitle') + ' pgHeader=' + fsOf('pgHeader'));
eq('U6: ...and the reader root resets the multiplier, which is what actually excludes it',
  /\.ezmr-scope\s*\{\s*--ez-fs:\s*1;?\s*\}/.test(css) ? 'reset present' : 'RESET MISSING',
  'reset present');
// The scope must sit on the reader's OWN root and nowhere else. On a child of pgPage it would
// change that element's child count, which is the number the per-page fit divides by.
eq('U7: the scope is declared exactly once, on PagedMushaf\'s root container',
  (html.match(/className="ezmr-scope"/g) || []).length, 1);
ok('U7: ...and that root is the container, not anything inside the page box',
  /<div className="ezmr-scope" style=\{contSt\}>/.test(html),
  'the scope moved off the reader container');
// The exclusion is the READER, not everything that sounds like it. The surah index is a list of
// names with no fit to break, and it is outside the scope on purpose.
ok('U8: the surah INDEX is outside the scope and still grows',
  isCalc(scaled('mushafName')) && !/ezmr-scope[^}]*mushaf/.test(css),
  'mushafName=' + fsOf('mushafName'));


/* ---- V. ITEM 44-ب: REDUCED MOTION, AND THE TWO TRIGGERS THAT MUST AGREE ---- */
// A comment that closes twice is not a comment. The S99 note carried a `*/` in the middle of it,
// so the paragraph after it sat in the stylesheet as raw text; the parser recovers by swallowing
// everything up to the next block, and the rule immediately below was eaten. MEASURED in Chrome:
// only 3 of the 4 reduced-motion rules reached document.styleSheets.
//
// This check is deliberately about ALL comments and not about that one: the failure mode is the
// class of defect, not the instance.
eq('V1: every comment in the stylesheet opens and closes exactly once',
  (css.match(/\/\*/g) || []).length, (css.match(/\*\//g) || []).length);

// THE PLATFORM SETTING AND THE SWITCH STILL THE SAME THINGS. Either alone is enough, and neither
// is a lesser version of the other: a reader whose phone says «reduce motion» and who never opens
// الإعدادات must get the same stillness as one who found the switch. MEASURED before this item: a
// `.ez-anim` element reported animationName `fadeIn` under the platform setting, `none` under the
// switch.
const mediaBlock = (css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n  \}/) || [''])[0];
ok('V2: the platform query is present and is not empty', mediaBlock.length > 0);
// ONE LIST OF WHAT REDUCED MOTION MEANS, AND BOTH TRIGGERS ARRIVE AT IT.
// Nothing is added to the @media block: chat-ux-guard requires every selector in it to name an
// S98 class, because a blanket rule there would freeze the mushaf page turn. So the platform
// reader is given the rest through the SAME attribute the switch uses, and the list of what is
// stilled exists once. Two lists would drift; this cannot.
ok('V3: the @media block is left scoped to the S98 classes, as chat-ux-guard requires',
  mediaBlock.length > 0
  && (mediaBlock.match(/^\s*([^{}@\n][^{}\n]*)\{/gm) || []).every((sel) => /\.ezik-/.test(sel)),
  'a selector that is not an S98 class was put into the platform query');
for (const [what, re] of [
  ['the decorative fades (.ez-anim)', /:root\[data-ez-motion="reduce"\] \.ez-anim\s*\{[^}]*animation:\s*none\s*!important/],
  ['the watermark cross-fade (.ezwm)', /:root\[data-ez-motion="reduce"\] \.ezwm\s*\{[^}]*transition:\s*none\s*!important/],
  ['smooth scrolling', /:root\[data-ez-motion="reduce"\]\s*\{[^}]*scroll-behavior:\s*auto\s*!important/],
]) {
  ok('V4: the one list stills ' + what, re.test(css), 'the attribute rules no longer cover it');
}
// AND THE ATTRIBUTE IS SET FROM EITHER SOURCE. This is the whole of 44-ب: before it, the
// attribute meant «this reader found the switch», and a reader whose PHONE says «reduce motion»
// got only the two S98 surfaces. MEASURED then: a `.ez-anim` element reported animationName
// `fadeIn` under the platform setting and `none` under the switch.
ok('V5: the attribute is set from EITHER the switch or the platform, not the switch alone',
  /ezikMotionReduced\(p\.reduceMotion\)\) el\.setAttribute\('data-ez-motion', 'reduce'\)/.test(html),
  'ezikApplyA11y went back to reading only the local preference');
// The pre-paint script is what stops a reader who is owed stillness from seeing one animated
// frame first. Its stored-preferences path returns early when there is no record -- which is
// exactly the reader who never opened الإعدادات -- so the platform question is asked ABOVE it.
ok('V6: the pre-paint script asks the platform before it can return early',
  html.indexOf("var D=document.documentElement;try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){D.setAttribute('data-ez-motion','reduce');}}catch(e){}") !== -1
  && html.indexOf('var D=document.documentElement;try{if(window.matchMedia') < html.indexOf("if(!r||typeof r!=='object'){return;}"),
  'the platform question is missing from the boot script, or it sits after the early return');
ok('V7: and the attribute follows the OS if it changes while the app is open',
  /ezMq\.addEventListener\('change', ezSyncMotion\)/.test(html));

// WHAT MUST KEEP MOVING, and why a blanket rule is never written here. The mushaf page turn
// resolves a promise on animationend and its slide lands on transitionend; freezing either hangs
// that screen. The typing dots are a loading indicator, and item 13's typing flow is CONTENT
// ARRIVING rather than decoration.
// A BARE `*` IS THE DANGER; A SCOPED ONE IS THE POINT. `.ezik-panel *` is exactly what these
// rules are supposed to say, so the test cannot be a substring search for `*{`: it reads each
// rule's selector list and asks whether any single selector IS the universal one. Comments are
// stripped first for the same reason T2 strips them — the note above these rules quotes the
// very pattern it warns against, and a check that reads prose is a check that lies.
const cssCode = stripComments(css);
const blanketKill = (prop) => {
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(cssCode)) !== null) {
    const sels = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    if (!sels.some((x) => x === '*')) continue;
    if (new RegExp(prop + ':\\s*none').test(m[2])) return sels.join(',') + ' {' + m[2].trim() + '}';
  }
  return null;
};
ok('V8: no blanket animation kill — the mushaf page turn still resolves on animationend',
  !blanketKill('animation'), String(blanketKill('animation')));
ok('V9: no blanket transition kill — the page slide still lands on transitionend',
  !blanketKill('transition'), String(blanketKill('transition')));
ok('V10: the typing indicator is never marked as decoration',
  /@keyframes typing/.test(cssCode) && !/\.ez-anim[^{]*\{[^}]*typing/.test(cssCode)
  && !/typing[^{]*\{[^}]*animation:\s*none/.test(cssCode));
// `ez-anim` is a marked list of four places, not a substring search over inline styles: the
// attribute-match version of this rule cost +0.74 ms on opening the menu.
ok('V11: reduced motion is still matched by CLASS, never by [style*=...]',
  !/\[style\*=/.test(cssCode));


/* ---- W. ITEM 44-ج: THE TOUCH TARGETS, AND THE SHAPES THAT DID NOT MOVE ---- */
// MEASURED at 430x932 with a coarse pointer, on a chat with a reply on it: 14 controls were under
// 44x44 -- the drawer toggle at 40x40, the reply strip (favourite was the smallest at 31x23), the
// five quick actions at ~41 tall, and the drawer row's pin and delete at 32x32. Every one of them
// failed on HEIGHT.
const hitRule = (css.match(/\.ezc-icon::before[\s\S]*?\}/) || [''])[0];
ok('W1: the hit area is an overlay, and it only ever GROWS a control',
  /min-width:\s*44px/.test(hitRule) && /min-height:\s*44px/.test(hitRule)
  && /width:\s*100%/.test(hitRule) && /height:\s*100%/.test(hitRule),
  'the 44px floor is gone, or it stopped following the control it sits on: ' + hitRule);
// `width:100%` with `min-width:44px` is the whole trick: a control that is already big keeps its
// own size, so the rule can be aimed at a container without auditing every button inside it.
ok('W2: it is centred on the control, so a control grows in both directions and does not shift',
  /left:\s*50%/.test(hitRule) && /top:\s*50%/.test(hitRule)
  && /transform:\s*translate\(-50%,\s*-50%\)/.test(hitRule));
// THE SHAPE IS NOT TOUCHED. The overlay paints nothing at all: it carries no background, no
// border, no shadow and no content beyond the empty string that makes it exist.
ok('W3: the overlay paints nothing — the visible shape is exactly what it was',
  /content:\s*""/.test(hitRule)
  && !/background/.test(hitRule) && !/border/.test(hitRule) && !/box-shadow/.test(hitRule));
// AIMED, NOT SPRAYED. A 44px floor under every button on the page would grow controls that are
// already large enough and push their neighbours' hit areas into each other.
ok('W4: the rule names its containers and is never a bare `button`',
  /\.ezc-acts button::before/.test(css) && /\.ezc-row button::before/.test(css)
  && /\.ez-hit button::before/.test(css)
  && !/(^|[,{}\s])button::before\s*\{/.test(css.replace(/\.[\w-]+ button::before/g, '')));
const prayerTouchAt = html.indexOf('function PrayerSettingsControl(');
const prayerTouchEnd = prayerTouchAt === -1 ? -1 : html.indexOf('function QiblaPanel(', prayerTouchAt);
const prayerTouch = (prayerTouchAt !== -1 && prayerTouchEnd > prayerTouchAt)
  ? html.slice(prayerTouchAt, prayerTouchEnd) : '';
ok('W5: every compact action group carries the non-painting 44px hit scope',
  /className="ez-hit" style=\{s\.quickRow\} role="group"/.test(html)
  && (prayerTouch.match(/className="ez-hit" style=\{s\.prayerOptRow\}/g) || []).length === 2
  && /data-ezik-prayer-setting="hijri"[\s\S]{0,100}style=\{\{ \.\.\.s\.a11yOpt/.test(html)
  && /a11yOpt:\s*\{[^}]*minHeight:\s*44/.test(html),
  'prayer region=' + prayerTouch.length
  + ' option scopes=' + (prayerTouch.match(/className="ez-hit" style=\{s\.prayerOptRow\}/g) || []).length
  + ' hijri=' + /data-ezik-prayer-setting="hijri"[\s\S]{0,100}style=\{\{ \.\.\.s\.a11yOpt/.test(html)
  + ' a11y44=' + /a11yOpt:\s*\{[^}]*minHeight:\s*44/.test(html));
// The drawer toggle's PAINTED box is still the 40x40 it always was: the item grows the area a
// finger gets, never the shape an eye sees.
// THE ONE EXCEPTION, DECLARED RATHER THAN DISCOVERED. The drawer row's pin and delete are 32px
// wide and sit 2px apart; MEASURED, a 44px-wide area for each overlapped the other by 10px and
// stole its taps. They keep the full 44 in HEIGHT and take only the width that exists. This
// check exists so the narrowing stays deliberate: it may narrow the WIDTH and nothing else.
const rowExc = (css.match(/\.ezc-row button::before \{[^}]*\}/) || [''])[0];
ok('W7: the drawer-row exception is declared, and it narrows only the width',
  /min-width:\s*34px/.test(rowExc) && !/min-height/.test(rowExc) && !/height/.test(rowExc),
  'the exception is missing, or it started shrinking the height too: ' + rowExc);

ok('W6: the drawer toggle still paints at 40x40',
  /\.ezc-icon\{[^}]*width:40px;height:40px/.test(css.replace(/\s*\n\s*/g, '')),
  'the painted size of .ezc-icon moved — the item was supposed to leave it alone');

/* ---- Y. ITEM 93-C: THE WORKER'S BRIEF NOW HAS A LISTENER --------------- */
// THE SHAPE IS NOT RE-TYPED HERE. sw.js is READ -- never written by this screen -- and the two
// fields the page branches on are asserted to be the two fields installSummary() writes. A
// worker that renames `failed` fails here, rather than quietly ceasing to reach the reader.
const SWJS = fs.readFileSync(path.join(path.dirname(path.resolve(INDEX)), 'sw.js'), 'utf8');
const swTag = (SWJS.match(/const REPORT_TAG = '([^']+)';/) || [])[1] || '';
ok('Y1: sw.js still declares the report tag', !!swTag, 'tag=' + JSON.stringify(swTag));

// ITEM 33. THE PAGE CEILING IS WRITTEN IN TWO FILES AND MUST BE ONE NUMBER. The worker caps
// the printed-mushaf store and evicts least-recently-used; the reader clamps its prefetch to
// the same ceiling so warming a neighbour cannot evict the page being read. A page cannot
// import a worker constant, so the number is repeated -- and a repeated number that nothing
// compares is a number that drifts. Both are read here, from the two files, and compared.
const swCap = Number((SWJS.match(/const MUSHAF_PAGE_CAP = (\d+);/) || [])[1]);
ok('Y0: sw.js declares a printed-page ceiling', Number.isFinite(swCap) && swCap > 0, 'cap=' + swCap);
eq('Y0: ...and the reader clamps its prefetch to the very same number', evalIn('MADINA_PAGE_CACHE_CAP'), swCap);
const swMushafStore = (SWJS.match(/const MUSHAF_CACHE = '([^']+)';/) || [])[1] || '';
const swShipStore = (SWJS.match(/const CACHE = '([^']+)';/) || [])[1] || '';
ok('Y0: ...and the store those pages live in carries no shipment version',
  // The shipment store is 'ezik-vN'. Stripping the trailing digits leaves the family prefix, and
  // a page store that started with it would be swept by activate on the very next bump -- which
  // is the defect item 33 closed. Asserted on the NAME because that is what the sweep matches on.
  !!swMushafStore && swMushafStore !== swShipStore
    && swMushafStore.indexOf(swShipStore.replace(/\d+$/, '')) !== 0,
  'the page store is ' + JSON.stringify(swMushafStore) + ' and the shipment store is '
  + JSON.stringify(swShipStore) + ' -- they share a family prefix, so a bump sweeps the pages');

eq('Y1: ...and the page listens for exactly that tag', evalIn('EZIK_SW_REPORT_TAG'), swTag);
const swSummaryAt = SWJS.indexOf('function installSummary()');
const swSummary = swSummaryAt === -1 ? '' : SWJS.slice(swSummaryAt, SWJS.indexOf('function announceInstall', swSummaryAt));
okOn('Y1: ...and the fields it branches on are the fields the worker writes', [['swSummary', swSummary]],
  /ezik: REPORT_TAG/.test(swSummary)
  && /failed: precacheFailures\.length/.test(swSummary)
  && /skipped: storageState\.precacheSkipped/.test(swSummary),
  'installSummary no longer writes ezik/failed/skipped under those names');

// DRIVEN, NOT READ. Every branch below is the shipped function executed against a literal
// message; nothing here matches source text for behaviour.
const swNotice = (code) => evalIn('ezikPrecacheNotice(' + code + ')');
const SW_PARTIAL = evalIn('EZIK_SW_MSG_PARTIAL');
const SW_NONE = evalIn('EZIK_SW_MSG_NONE');
const swReport = (o) => JSON.stringify(Object.assign({ ezik: swTag, failed: 0, entries: [], skipped: null,
  persist: 'granted', evicted: 0, retried: 0 }, o));

ok('Y2: A HEALTHY INSTALL DRAWS NOTHING AT ALL', swNotice(swReport({})) === null);
ok('Y2: ...and neither does one that merely evicted and retried its way to success',
  swNotice(swReport({ evicted: 2, retried: 2 })) === null);
ok('Y2: ...nor a brief carrying no count at all', swNotice(JSON.stringify({ ezik: swTag })) === null);
ok('Y3: an install that lost entries says so', swNotice(swReport({ failed: 3,
  entries: [{ url: '/adhkar.json', reason: 'quota' }] })) === SW_PARTIAL);
ok('Y3: one lost entry is enough', swNotice(swReport({ failed: 1 })) === SW_PARTIAL);
ok('Y3: a precache that never started says the OTHER thing', swNotice(swReport({ skipped: 'quota' })) === SW_NONE);
ok('Y3: ...and that sentence wins even when entries also failed',
  swNotice(swReport({ failed: 4, skipped: 'quota' })) === SW_NONE);
ok('Y3: the two sentences are two sentences',
  !!SW_PARTIAL && !!SW_NONE && SW_PARTIAL !== SW_NONE);
// The reader is told what happened, not what the browser said. No URL, no reason word, no
// exception name -- «TypeError: Failed to fetch» tells a child nothing they can act on.
ok('Y4: neither sentence carries a URL, a reason word or browser text',
  [SW_PARTIAL, SW_NONE].every((t) => !/https?:|\.json|\.png|Error|fetch|quota|network|undefined|\[object/i.test(String(t))));
const NOT_OURS = ['null', 'undefined', '0', '""', '"' + swTag + '"', '[]',
  JSON.stringify({ ezik: 'warm' }), JSON.stringify({ ezik: 'storage', failed: 9 }),
  JSON.stringify({ failed: 9, skipped: 'quota' })];
for (const code of NOT_OURS) {
  ok('Y5: a message that is not the brief is ignored: ' + code, swNotice(code) === null);
}
// A count that is not a count may not become a banner.
for (const bad of ['"3"', 'true', '{}', '[3]', 'NaN', 'Infinity', '-2']) {
  ok('Y5: ...and a failed count of ' + bad + ' is not a failure',
    swNotice('{"ezik":"' + swTag + '","failed":' + bad + ',"skipped":null}') === null);
}

const swNoteAt = html.indexOf('function EzikPrecacheNotice()');
const swNoteEnd = html.indexOf('function EzShellGroup(', swNoteAt);
const swNoteSrc = (swNoteAt !== -1 && swNoteEnd > swNoteAt) ? html.slice(swNoteAt, swNoteEnd) : '';
okOn('Y6: ZERO RETRY, ZERO NETWORK, ZERO RECOVERY SURFACE', [['swNoteSrc', swNoteSrc]],
  !/fetch\(|aiFetch\(|XMLHttpRequest|sendBeacon|EventSource|new WebSocket/.test(swNoteSrc)
  && !/\.register\(|\.update\(|\.unregister\(|skipWaiting|location\.reload/.test(swNoteSrc)
  && !/setTimeout|setInterval/.test(swNoteSrc),
  'the consumer grew a retry, a wire or a timer');
eq('Y6: exactly one listener, and it is on the service worker container',
  (html.match(/navigator\.serviceWorker\.addEventListener\('message'/g) || []).length, 1);
okOn('Y7: the dismissal is spent for the SESSION, not merely for the mount', [['swNoteSrc', swNoteSrc]],
  /let ezikSwNoticeSpent = false;/.test(html) && /ezikSwNoticeSpent = true;/.test(swNoteSrc)
  && /if \(ezikSwNoticeSpent\) return;/.test(swNoteSrc),
  'the once-per-session latch moved into component state');
okOn('Y7: ...and the listener is removed when the notice unmounts', [['swNoteSrc', swNoteSrc]],
  /removeEventListener\('message', onMessage\)/.test(swNoteSrc));
ok('Y8: it is mounted, beside the app and under the same boundary',
  /root\.render\(React\.createElement\(ErrorBoundary, null, React\.createElement\(App\), React\.createElement\(EzikPrecacheNotice\)\)\);/
    .test(html));

/* ---- Z. ITEM 42-B: THE REPLY EXPORTS ITSELF, WITH NO NEW MACHINE -------- */
// THE MACHINE WAS MEASURED FIRST. Two things had to already be true before a button could be
// hung on them, and both are asserted rather than remembered: html2pdf is declared in the LAZY
// vendor map and is NOT a script tag on the boot path, and printAsPdf is the app's single PDF
// path. A future change that promotes html2pdf back to a render-blocking script fails here.
const vendAt = html.indexOf('window.__ezikVendor');
ok('Z1: the lazy vendor loader is still what fetches html2pdf',
  vendAt !== -1 && /html2pdf: \['https:\/\/[^']+html2pdf\.bundle\.min\.js'/.test(html),
  'the lazy vendor map no longer declares html2pdf');
ok('Z1: ...and html2pdf is on no <script src> in the document',
  !/<script[^>]+src=["'][^"']*html2pdf/i.test(html),
  'html2pdf came back as a boot-blocking script tag');
eq('Z1: the app has exactly one PDF path', (html.match(/const printAsPdf = async /g) || []).length, 1);
okOn('Z1: ...and it still awaits the lazy bundle and degrades to print()', [['html', html]],
  /await window\.__ezikVendor\('html2pdf'\)/.test(html)
  && /if \(!window\.html2pdf\) \{ document\.title = title; window\.print\(\); return; \}/.test(html));

const pdfAt = html.indexOf('const ExportPdfReplyButton = ({ getText }) =>');
const pdfEnd = pdfAt === -1 ? -1 : html.indexOf('const docToHtml = (md) =>', pdfAt);
const pdfSrc = (pdfAt !== -1 && pdfEnd > pdfAt) ? html.slice(pdfAt, pdfEnd) : '';
ok('Z2: the export button was located and bounded', pdfSrc.length > 400, 'len=' + pdfSrc.length);
okOn('Z2: it exports THE REPLY, from the very payload the clipboard is handed', [['mbSrc', mbSrc]],
  /<ExportPdfReplyButton getText=\{buildCopyText\} \/>/.test(mbSrc),
  'the export button was given a second source of truth');
okOn('Z2: ...and it prints it through the one PDF path, rendered by the one renderer',
  [['pdfSrc', pdfSrc]],
  /await printAsPdf\(EZIK_PDF_TITLE, docToHtml\(payload\)\)/.test(pdfSrc)
  && /const payload = \(typeof getText === 'function'\) \? getText\(\) : ''/.test(pdfSrc),
  'the export path stopped going through printAsPdf(docToHtml(...))');
// The document card already exports with exactly this pair. Two callers, one machine.
eq('Z2: ...which is the pair the document card already uses',
  (html.match(/printAsPdf\([^)]*docToHtml\(/g) || []).length, 2);
okOn('Z3: ZERO MODEL CALL AND ZERO REQUEST on the export path', [['pdfSrc', pdfSrc]],
  !/fetch\(|aiFetch\(|XMLHttpRequest|sendBeacon|EventSource|new WebSocket|\/api\//.test(pdfSrc),
  'the export button acquired a request');
okOn('Z3: ...and one press cannot become two files', [['pdfSrc', pdfSrc]],
  /const busyRef = useRef\(false\);/.test(pdfSrc) && /if \(busyRef\.current\) return;/.test(pdfSrc));
// 44x44 BY AREA, NOT BY SHAPE: it is a .ezc-acts button and it states no box of its own.
okOn('Z4: the new control takes the rail hit area and changes no shape', [['pdfSrc', pdfSrc]],
  /style=\{miniBtnStyle\}/.test(pdfSrc) && !/width:|height:|minWidth|minHeight/.test(pdfSrc),
  'the export button started declaring its own box instead of taking the rail area');
okOn('Z4: ...and the rail is the container the sheet gives 44x44 to', [['html', html]],
  /\.ezc-icon, \.ezc-acts button, \.ezc-row button, \.ez-hit button \{ position: relative; \}/.test(css)
  && /min-width: 44px; min-height: 44px;/.test(css));

// ---- Z5. THE CARD-AS-IMAGE WAS NOT BUILT, AND THE REASON IS MEASURED -----
// The item asked for the measurement, not the feature. There is no DOM rasteriser in this tree:
// the only canvas in the application file is the UPLOAD downscaler, which draws an <img> element
// and never a DOM subtree. The one rasteriser that exists at all is html2canvas, and it lives
// inside html2pdf.bundle -- 906KB, lazily loaded, and precached by nothing. These checks keep
// that statement true, so the decision cannot quietly reverse itself.
eq('Z5: the application file holds exactly one canvas rasterisation, and it is the upload path',
  (html.match(/toDataURL\(|canvas\.toBlob\(/g) || []).length, 1);
ok('Z5: ...which draws an image element, not a DOM subtree',
  /canvas\.getContext\('2d'\)\.drawImage\(img, 0, 0, w, h\)/.test(html));
ok('Z5: no DOM-to-image library entered the tree',
  !/dom-to-image|domtoimage|htmlToImage|html-to-image|satori/i.test(html));
ok('Z5: ...and html2canvas is named as an OPTION and never constructed or called',
  !/html2canvas\s*[.(]/.test(html) && /html2canvas: \{ scale: 2, useCORS: true \}/.test(html));
// And the offline store still carries no vendor JavaScript at all, which is the other half of
// the reason: a share card built on html2canvas would be a control that cannot work offline.
ok('Z5: the offline CORE still precaches no vendor bundle',
  !/html2pdf|mammoth|react[^"']*\.js/.test(SWJS.slice(SWJS.indexOf('const CORE = ['), SWJS.indexOf('];', SWJS.indexOf('const CORE = [')))));

console.log('\n' + (failures ? 'FAIL' : 'OK') + ': ' + (checks - failures) + '/' + checks + ' checks passed.');
process.exit(failures ? 1 : 0);
