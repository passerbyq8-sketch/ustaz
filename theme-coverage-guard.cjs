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
const babel = require('@babel/core');
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
  callMuteBtn: 'a light pill sitting ON the call screen, which is dark in BOTH themes.',
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
  const m = /<script[^>]*type=["']text\/babel["'][^>]*>/i.exec(html);
  if (!m) { console.log('FAIL: no text/babel block in ' + INDEX); process.exit(2); }
  const raw = html.slice(m.index + m[0].length, html.indexOf('</script>', m.index + m[0].length));
  const bs = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
  const major = parseInt((bs.match(/@babel\/standalone@(\d+)\./) || [])[1] || '8', 10);
  let code;
  try {
    code = babel.transformSync(raw, {
      presets: [['@babel/preset-react', { runtime: major >= 8 ? 'automatic' : 'classic' }]],
      filename: 'babel-block.jsx', sourceType: 'script', retainLines: true,
    }).code;
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
for (const stored of ['dark', 'light']) {
  const r = runBoot(html, stored);
  if (!ok('F1: the boot script is runnable for stored=' + stored, !!r)) continue;
  eq('F1: ...it sets data-theme=' + stored, r.theme, stored);
  eq('F1: ...it sets the UA colorScheme to ' + stored, r.scheme, stored);
  // The inline paint is what covers the gap before the stylesheet arrives, so it must BE the
  // page colour of that theme -- otherwise the first frame is the wrong dark/light shade.
  const expectPage = (stored === 'dark' ? DARK : LIGHT)['--page'];
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
  eq('F2: boot light paint == the light --page token', bootDark[2].toUpperCase(), String(LIGHT['--page']).toUpperCase());
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
  istana_33: { '--vt-page': '#FFFFFF', '--vt-surface': '#FFFDFC', '--vt-surface2': '#EEF6F7',
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
try { KEYS = { mode: evalIn('THEME_KEY'), layout: evalIn('EZIK_UI_STYLE_KEY'), visual: evalIn('EZIK_VISUAL_THEME_KEY') }; }
catch (err) { KEYS = null; }
if (!ok('the three presentational keys are all declared', !!KEYS,
  'one of THEME_KEY / EZIK_UI_STYLE_KEY / EZIK_VISUAL_THEME_KEY is missing from the shipped block')) {
  KEYS = { mode: '', layout: '', visual: '' };
}
eq('the colour MODE key is unchanged', KEYS.mode, 'murabbi_theme_v1');
eq('the LAYOUT key is unchanged', KEYS.layout, 'ezik_ui_style_v1');
eq('the VISUAL IDENTITY key is its own', KEYS.visual, 'ezik_visual_theme_v1');
ok('...and no two of the three are the same key',
  new Set([KEYS.mode, KEYS.layout, KEYS.visual]).size === 3);
// Independence is not a naming convention: WRITE each setting and see which keys move.
function recordWrite(expr) {
  const touched = [];
  withStore({ getItem: () => null, setItem: (k, v) => touched.push(k + '=' + v),
    removeItem: (k) => touched.push('-' + k), clear() {}, key: () => null, length: 0 });
  try { evalIn(expr); } catch (e) { touched.push('THREW:' + e.message); }
  return touched;
}
eq('choosing an identity writes ONLY the identity key',
  recordWrite('writeEzikVisualTheme("qibla_13")'), ['ezik_visual_theme_v1=qibla_13']);
eq('choosing a layout still writes ONLY the layout key',
  recordWrite('writeEzikUiStyle("deck")'), ['ezik_ui_style_v1=deck']);

/* ---- G2. the reader is total and the default is istana_33 --------------- */
eq('istana_33 is the declared default identity', evalIn('EZIK_VISUAL_THEME_DEFAULT'), 'istana_33');
eq('...and it is one of the two ids, not a third value', evalIn('EZIK_VISUAL_THEME_ISTANA'), 'istana_33');
eq('qibla_13 is the other id', evalIn('EZIK_VISUAL_THEME_QIBLA'), 'qibla_13');
function readVT(stored) { withStore(stubStore(stored)); return evalIn('readEzikVisualTheme()'); }
eq('a saved qibla_13 is returned, never defaulted away', readVT('qibla_13'), 'qibla_13');
eq('a saved istana_33 is returned', readVT('istana_33'), 'istana_33');
eq('an ABSENT key is istana_33 -- the never-saved default', readVT(null), 'istana_33');
eq('an unknown word fails safe to istana_33', readVT('ottoman'), 'istana_33');
eq('a layout word is not an identity', readVT('journey'), 'istana_33');
eq('a mode word is not an identity', readVT('dark'), 'istana_33');
eq('the wrong case is not the id', readVT('QIBLA_13'), 'istana_33');
eq('a value of the wrong type fails safe', readVT(13), 'istana_33');
withStore(throwStore);
eq('a storage that THROWS still yields istana_33', evalIn('readEzikVisualTheme()'), 'istana_33');
eq('...and the writer still returns a legal id when it cannot save', evalIn('writeEzikVisualTheme("qibla_13")'), 'qibla_13');
withStore(stubStore(null));
eq('the writer normalises an illegal id to the default', evalIn('writeEzikVisualTheme("nope")'), 'istana_33');
eq('the writer accepts qibla_13', evalIn('writeEzikVisualTheme("qibla_13")'), 'qibla_13');
eq('...and puts it on <html> where the stylesheet can see it',
  evalIn('document.documentElement.getAttribute("data-ezik-visual-theme")'), 'qibla_13');
eq('the writer accepts istana_33', evalIn('writeEzikVisualTheme("istana_33")'), 'istana_33');
eq('...and repaints the attribute',
  evalIn('document.documentElement.getAttribute("data-ezik-visual-theme")'), 'istana_33');

/* ---- G3. the layout choice is untouched --------------------------------- */
eq('journey is still a layout', evalIn('EZIK_UI_STYLE_JOURNEY'), 'journey');
eq('deck is still a layout', evalIn('EZIK_UI_STYLE_DECK'), 'deck');
eq('journey is still the layout default', evalIn('EZIK_UI_STYLE_DEFAULT'), 'journey');
function readUI(stored) { withStore(stubStore(stored)); return evalIn('readEzikUiStyle()'); }
eq('a saved journey survives this phase', readUI('journey'), 'journey');
eq('a saved deck survives this phase', readUI('deck'), 'deck');
eq('an absent layout key is still journey', readUI(null), 'journey');
eq('an identity id is NOT accepted as a layout', readUI('istana_33'), 'journey');
ok('both layouts are still rendered by the three switch points',
  (html.match(/style === EZIK_UI_STYLE_DECK \?/g) || []).length === 3,
  'the home, the adhkar browse and the adhkar reader each choose between journey and deck');

/* ---- G4. the identity is on <html> before the first paint --------------- */
function bootVT(src2, stored) {
  const m2 = /<script>\(function\(\)\{try\{var t=localStorage\.getItem\('murabbi_theme_v1'\)[\s\S]*?<\/script>/.exec(src2);
  if (!m2) return null;
  const body = m2[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const { window: w } = parseHTML('<!DOCTYPE html><html><head><meta name="theme-color" content="#1D4ED8"></head><body></body></html>');
  w.localStorage = stubStore(stored);
  vm.runInContext(body, vm.createContext(w), { filename: 'boot.js' });
  return w.document.documentElement.getAttribute('data-ezik-visual-theme');
}
for (const [stored, want] of [['qibla_13', 'qibla_13'], ['istana_33', 'istana_33'], [null, 'istana_33'], ['journey', 'istana_33']]) {
  eq('boot: stored=' + String(stored) + ' paints the identity before first paint', bootVT(html, stored), want);
}
// Both offsets have to be measured in the SAME comment-stripped head, for the reason
// headOrder() documents: the prose above the boot script quotes <link rel="stylesheet">.
const vtHead = html.slice(0, html.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, ' ');
const vtSheet = (() => { for (const m of vtHead.matchAll(/<link\b[^>]*>/gi)) if (/rel\s*=\s*["']?stylesheet/i.test(m[0])) return m.index; return -1; })();
ok('the boot reader runs before any external stylesheet, like the mode reader',
  vtHead.indexOf('ezik_visual_theme_v1') !== -1 && (vtSheet === -1 || vtHead.indexOf('ezik_visual_theme_v1') < vtSheet),
  'reader at ' + vtHead.indexOf('ezik_visual_theme_v1') + ', first stylesheet at ' + vtSheet);

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
  /borderRadius: 'var\(--ez-radius-sig\)'/.test(html));

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

/* ---- G9. Settings exposes the choice, beside the other two ------------- */
const vtSetStart = html.indexOf('const uiStyle = useEzikUiStyle()');
const settingsRegion = html.slice(vtSetStart, html.indexOf('{EZIK_A11Y_TITLE}', vtSetStart));
ok('the Settings screen was located', vtSetStart !== -1 && settingsRegion.length > 500,
  'region length ' + settingsRegion.length);
ok('Settings still offers both colour modes',
  /<Opt value="light"/.test(settingsRegion) && /<Opt value="dark"/.test(settingsRegion));
ok('Settings still offers both layouts',
  /<StyleOpt value=\{EZIK_UI_STYLE_JOURNEY\}/.test(settingsRegion) && /<StyleOpt value=\{EZIK_UI_STYLE_DECK\}/.test(settingsRegion));
ok('Settings offers qibla_13', /<VtOpt value=\{EZIK_VISUAL_THEME_QIBLA\}/.test(settingsRegion));
ok('Settings offers istana_33', /<VtOpt value=\{EZIK_VISUAL_THEME_ISTANA\}/.test(settingsRegion));
ok('...as a labelled radiogroup of its own', /role="radiogroup" aria-label=\{EZ_VT_TITLE\}/.test(settingsRegion));
ok('...whose options carry radio semantics and checked state',
  /role="radio" aria-checked=\{visualTheme === value/.test(settingsRegion));
ok('...and a press writes the identity, nothing else', /onClick=\{\(\) => writeEzikVisualTheme\(value\)\}/.test(settingsRegion));
ok('the identity previews are CSS only -- no image, no data URI, nothing to fetch',
  !/PREV_QIBLA[\s\S]{0,600}(<img|data:|url\()/.test(html) && !/PREV_ISTANA[\s\S]{0,600}(<img|data:|url\()/.test(html));
// A preview has to show the theme it is NOT: both preview swatch sets are declared, both are
// white-paged, and they do not follow data-theme (the choice is about the light face).
for (const [pfx, want] of [['q', 'qibla_13'], ['i', 'istana_33']]) {
  eq('the ' + want + ' preview page is plain white', LIGHT['--vtp-' + pfx + '-page'], '#FFFFFF');
  eq('the ' + want + ' preview surface is the approved surface', LIGHT['--vtp-' + pfx + '-surface'], VT_APPROVED[want]['--vt-surface']);
  eq('the ' + want + ' preview accent is the approved accent', LIGHT['--vtp-' + pfx + '-accent'], VT_APPROVED[want]['--vt-accent']);
  eq('the ' + want + ' preview line is the approved line', LIGHT['--vtp-' + pfx + '-line'], VT_APPROVED[want]['--vt-line']);
}

/* ---- G9c. the selector is mounted WHERE ITS TOKENS ARE ------------------
 * Group G proved the radiogroup, both ids, the radio semantics and the writer, and every one of
 * those passed while the control could not show which option was selected. Structure is not
 * enough: these style keys read --a3-*, which is a SCOPED token set, so where the card is
 * mounted decides whether the checked state has a colour at all. Asserted two ways -- the card
 * carries the scope, and the same keys resolve to NOTHING without it, which is the defect.
 * ---------------------------------------------------------------------- */
function cardTagAround(labelExpr) {
  const at = html.indexOf('<div style={s.settingsLabel}>{' + labelExpr + '}</div>');
  if (at === -1) return null;
  // from at-1: starting at `at` finds the label div itself, which is never the card.
  const open = html.lastIndexOf('<div', at - 1);
  return open === -1 ? null : html.slice(open, html.indexOf('>', open) + 1);
}
const vtCardTag = cardTagAround('EZ_VT_TITLE');
const uiCardTag = cardTagAround('A3_STYLE_TITLE');
ok('the identity card was located in Settings', !!vtCardTag);
ok('the layout card was located in Settings', !!uiCardTag);
// The token set these controls read is declared on .adhkar3,.ezhome and nowhere else.
ok('the identity card carries the token scope its own controls read',
  !!vtCardTag && /className="adhkar3"/.test(vtCardTag),
  'mounted as: ' + String(vtCardTag) + '  -- designOpt/designOptOn/designDot/designOptLabel all read --a3-*, '
  + 'which is declared only on .adhkar3,.ezhome; outside it the checked option has no border, no '
  + 'shadow and an invisible dot');
ok('...the same scope the layout card beside it uses',
  !!vtCardTag && !!uiCardTag && /className="adhkar3"/.test(vtCardTag) === /className="adhkar3"/.test(uiCardTag));

// The scope is load-bearing: without it these four resolve to nothing at all. This is the
// measured defect written down, so the check above can never be quietly weakened into a no-op.
function unscoped(id, mode) {
  const dark = mode === 'dark';
  return { ...palette((/:root\s*\{([^}]*)\}/.exec(css) || [, ''])[1]),
    ...(dark ? DARK : {}), ...VT.light[id], ...(dark ? VT.dark[id] : {}), ...VT.map };
}
const VT_CTRL = ['designOpt', 'designOptOn', 'designOptLabel', 'designDot', 'designDotOn'];
for (const k of VT_CTRL) ok('the identity control reuses the shipped key ' + k, !!s[k]);
{
  const u = unscoped('istana_33', 'light');
  const dead = [['designOptOn.border', s.designOptOn.border], ['designOptOn.boxShadow', s.designOptOn.boxShadow],
    ['designDotOn.background', s.designDotOn.background], ['designOptLabel.color', s.designOptLabel.color]]
    .filter(([, v]) => resolve(v, u) !== null).map(([kk]) => kk);
  eq('outside that scope every one of them resolves to nothing -- the defect, recorded', dead, []);
}

/* ---- G9d. and inside the scope, the checked option is actually VISIBLE -- */
for (const id of VT_IDS) {
  for (const mode of ['light', 'dark']) {
    const pal = VT_PAL[id + ':' + mode];
    const surface = resolve(s.designOpt.background, pal);
    const onBorder = resolve(s.designOptOn.border, pal);
    const offBorder = resolve(s.designOpt.border, pal);
    const dot = resolve(s.designDotOn.background, pal);
    const label = resolve(s.designOptLabel.color, pal);
    const shadowRaw = String(resolveRaw(s.designOptOn.boxShadow, pal)).trim();
    const tag = id + ' ' + mode + ': ';
    ok(tag + 'the option surface resolves', !!surface, String(s.designOpt.background));
    ok(tag + 'the CHECKED option has a real border colour', !!onBorder, String(s.designOptOn.border));
    ok(tag + '...visible against the option surface (>=3:1)',
      !!onBorder && !!surface && contrast(onBorder, surface) >= 3,
      onBorder && surface ? hex(onBorder) + ' on ' + hex(surface) + ' = ' + contrast(onBorder, surface).toFixed(2) : 'unresolved');
    ok(tag + '...and distinguishable from the UNCHECKED border',
      !!onBorder && !!offBorder && hex(onBorder) !== hex(offBorder),
      'checked ' + hex(onBorder) + ' vs unchecked ' + hex(offBorder));
    ok(tag + 'the CHECKED option has a shadow, not none',
      shadowRaw !== '' && shadowRaw !== 'none' && /#|rgba?\(/i.test(shadowRaw), shadowRaw || '(empty)');
    ok(tag + 'the selected DOT has a visible background',
      !!dot && !!surface && contrast(dot, surface) >= 3,
      dot && surface ? hex(dot) + ' on ' + hex(surface) + ' = ' + contrast(dot, surface).toFixed(2) : 'unresolved');
    const ink = resolve(pal['--vt-ink'], pal);
    ok(tag + 'the option label is the theme ink', !!label && !!ink && hex(label) === hex(ink),
      'label ' + hex(label) + ' vs --vt-ink ' + hex(ink));
  }
}

/* ---- G10. every implemented screen inherits the identity --------------- */
// Not asserted by looking for a class name: each screen is measured by RESOLVING the background
// it actually paints, first with no identity and then with each one. A screen that did not
// inherit would resolve to the same colour in all three, and that is the failure.
const SCREENS = {
  'launch / loading': 'onboardingContainer',
  'first-run welcome': 'welcomeContainer',
  'home': 'ezhContainer',
  'chat': 'chatContainer',
  'adhkar (v1)': 'adhkarContainer',
  'adhkar (v2)': 'adhkar2Container',
  'adhkar browse / dhikr': 'a3Container',
  'adhkar reader (deck)': 'a3DeckReadContainer',
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
const modAttrs = (html.match(/data-ezik-home-module=/g) || []).length;
eq('exactly two home renderers, one module element each -- no duplicated module', modAttrs, 2);
ok('...and both come from the owner\'s single descriptor array',
  (html.match(/mods\.map\(\(m, i\) =>/g) || []).length === 2);
ok('no identity rule can add a second copy of a module',
  !/data-ezik-visual-theme[^{]*\{[^}]*content\s*:/i.test(css));

/* ---- G12. knowledge treasures follows the identity too ----------------- */
const qVT = vtBlocks(q.css);
ok('quest.html reads the identity key before its first paint',
  q.html.indexOf('ezik_visual_theme_v1') !== -1 && q.html.indexOf('ezik_visual_theme_v1') < q.html.indexOf('<style>'));
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

console.log('\n' + (failures ? 'FAIL' : 'OK') + ': ' + (checks - failures) + '/' + checks + ' checks passed.');
process.exit(failures ? 1 : 0);
