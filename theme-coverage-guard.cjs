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
ok('Settings shows no Journey control', !/Journey|JOURNEY|journey/.test(settingsRegion));
ok('Settings shows no Deck control', !/Deck|DECK|deck/.test(settingsRegion));
ok('...and the whole file offers no layout chooser', !/StyleOpt/.test(html));
// THE ACTIVE DESIGN IS STATED.
ok('Settings names the active application design', /\{EZ_VT_ISTANA\}/.test(settingsRegion));
ok('...as a state, not an option', /\{EZ_VT_ACTIVE\}/.test(settingsRegion));
// QIBLA IS NOT SELECTABLE. Not by pointer, not by keyboard, not by any code path.
ok('qibla_13 appears only as a disabled upcoming line',
  /\{EZ_VT_QIBLA\}/.test(settingsRegion) && /aria-disabled="true"/.test(settingsRegion));
const qibIdx = settingsRegion.indexOf('{EZ_VT_QIBLA}');
const qibRow = qibIdx === -1 ? '' : settingsRegion.slice(Math.max(0, qibIdx - 400), qibIdx + 200);
ok('...with no radio role', !/role="radio"/.test(qibRow));
ok('...with no checked state', !/aria-checked/.test(qibRow));
ok('...with no click handler', !/onClick/.test(qibRow));
ok('...and it is not a button, so it cannot be tabbed to', !/<button/.test(qibRow));
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
ok('neither legacy home is rendered inside the istana component',
  !/<EzikDeckHome/.test(IST) && !/<EzikJourneyHome/.test(IST));
// ...and qibla_13 still gets exactly what it had before this batch.
// S102: there is no other home to route to. EzikIstanaHome is the whole of the answer.
ok('EzikIstanaHome is the ONLY reachable home', /return <EzikIstanaHome \{\.\.\.home\} \/>;/.test(html)
  && !/<EzikDeckHome|<EzikJourneyHome/.test(html));

/* ---- H2. the parts the design calls for -------------------------------- */
ok('it has a real TOP NAVIGATION bar', /<EzistTopNav /.test(IST) && /className="ezist-nav"/.test(IST));
ok('...bounded and centred rather than loose across the viewport',
  /\.ezist-nav-inner\{[^}]*max-width:1100px[^}]*margin:0 auto/.test(css));
ok('...carrying the four existing actions, each with its own handler',
  /aria-label=\{EZH_NAV_HOME\}/.test(IST) && /onClick=\{onOpenChat\}[\s\S]{0,120}aria-label=\{EZH_BRAND\}/.test(IST)
  && /onClick=\{onOpenSettings\}[\s\S]{0,120}aria-label=\{EZH_NAV_SET\}/.test(IST)
  && /onClick=\{onOpenSettings\}[\s\S]{0,120}aria-label=\{EZH_ACCOUNT\}/.test(IST));
// THE OLD BOTTOM DOCK IS NOT ON THIS HOME. EzHomeNav is what draws it, and it is not used here.
ok('the legacy bottom dock is NOT presented on the istana home',
  !/<EzHomeNav/.test(IST) && !/s\.ezhNav\b/.test(IST) && !/s\.ezhFab\b/.test(IST),
  'EzHomeNav / ezhNav / ezhFab must not appear inside the istana home');
ok('...and the component that drew it no longer exists at all', html.indexOf('function EzHomeNav') === -1);

ok('it has an OTTOMAN MASTHEAD', /<EzistMasthead /.test(IST) && /className="ezist-masthead"/.test(IST));
ok('...whose arch IS the approved signature radius',
  /\.ezist-masthead\{[^}]*border-radius:var\(--ez-radius-sig\)/.test(css));
eq('...which under istana_33 is the approved 120px arch', VT.light.istana_33['--vt-radius-sig'], '120px 120px 18px 18px');
ok('it carries a bounded tulip emblem', /className="ezist-tulip"/.test(IST) && /\.ezist-tulip\{/.test(css));
// The emblem is bounded by construction: its own selector cannot match a page root, and the
// section that contains it clips.
ok('...the emblem selectors cannot reach a page root',
  !/(^|[,}])\s*(html|body|:root)[^{]*\.ezist-tulip/.test(css) && /\.ezist-masthead\{[^}]*overflow:hidden/.test(css));
ok('...and it uses the identity accent, not a literal', /\.ezist-tulip::before\{[^}]*var\(--a3-blue\)/.test(css));
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
ok('...reading the SAME single source the legacy card reads', /const v = getDailyVerse\(\);/.test(IST));
ok('...and rendering the text verbatim', /<div style=\{s\.ezistQuranText\}>\{v\.text\}<\/div>/.test(IST),
  'the Quran text must be printed as it is read -- no transform, no slice, no ellipsis');
// no decorative mark may overlap the text: the marks live in the head row and the rule, both of
// which are siblings of the text block, and nothing in this panel is absolutely positioned.
ok('no mark is positioned over the Quran text',
  !/ezistQuran(Text|Meta)[^}]*position: \'absolute\'/.test(html)
  && /ezistQuranDot[^}]*background: \'var\(--a3-cyan\)\'/.test(html));

ok('the chat entry is part of the composition', /<EzistAsk /.test(IST) && /className="ezhome-focus ezist-ask"/.test(IST));
ok('...calling the existing callback unchanged', /onClick=\{onOpenChat\}/.test(IST));
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
ok('...and its controls carry the shared focus ring class', (IST.match(/className="ezhome-focus/g) || []).length >= 5);

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
ok('...and nothing re-orders, ranks or filters them here',
  !/\.sort\(|\.filter\(|adhkarMostUsed/.test(IA));
ok('each category is rendered by exactly one map over each slice',
  (IA.match(/featured\.map\(/g) || []).length === 1 && (IA.match(/rest\.map\(/g) || []).length === 1);
ok('...and every rendered category carries its own store id',
  (IA.match(/data-ezia-cat=\{c\.id\}/g) || []).length === 2,
  'one on the featured card, one on the catalogue card -- counting these elements counts categories');
ok('...opened through the owner\'s handler, never a local one',
  (IA.match(/onClick=\{\(\) => onOpen\(c\)\}/g) || []).length === 2 && !/setSelected|bumpAdhkarUsage/.test(IA));
ok('the standing comes from the shipped helper, not a recount',
  (IA.match(/a3CatStanding\(prog, c, byCat\)/g) || []).length === 2 && !/adhkarCatDone\(/.test(IA));

/* ---- I3. the structure the design calls for ----------------------------- */
ok('it has the istana top header', /className="ezia-nav"/.test(IA) && /\.ezia-nav-inner\{[^}]*max-width:1100px/.test(css));
ok('...with the same brand-arch language as the home', /className="ezia-brand-arch"/.test(IA));
ok('it has a bounded arched masthead', /className="ezia-masthead"/.test(IA)
  && /\.ezia-masthead\{[^}]*border-radius:var\(--ez-radius-sig\)/.test(css)
  && /\.ezia-masthead\{[^}]*overflow:hidden/.test(css));
ok('...carrying the REAL daily ring, not a decorative one',
  /role="progressbar"[\s\S]{0,200}?aria-valuenow=\{shown\}/.test(IA) && /Math\.min\(done, ADHKAR_DAILY_GOAL\)/.test(IA));
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
ok('...and the old emoji tab glyphs are gone from it',
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
  loading:         { render: 'inline loadingScreen', shell: 'legacy' },
  onboarding:      { render: 'Onboarding / Welcome', shell: 'legacy' },
  home:            { render: 'Home -> EzikIstanaHome', shell: 'istana' },
  chat:            { render: 'the chat body (App fall-through)', shell: 'legacy' },
  parentGate:      { render: 'ParentGate', shell: 'legacy' },
  parentDashboard: { render: 'ParentDashboard', shell: 'legacy' },
  settings:        { render: 'SettingsSheet -> EzShell', shell: 'istana' },
  favorites:       { render: 'FavoritesScreen', shell: 'legacy' },
  call:            { render: 'CallScreen', shell: 'legacy' },
  // S107: the drill moved too, so the caveat is gone -- and it is gone because the checks in
  // group L6 pass, not because someone deleted the field.
  memorize:        { render: 'MemorizeScreen picker + drill -> EzShell', shell: 'istana' },
  // S109: the INDEX is on the shell; the READER is not. The screen stays classified legacy
  // until Step 3, and the note below is asserted so it cannot be dropped early.
  mushaf:          { render: 'MushafScreen index -> EzShell; reader still legacy', shell: 'legacy', partial: 'index istana, reader legacy' },
  adhkar:          { render: 'AdhkarScreen -> IstanaAdhkarBrowse / IstanaAdhkarReader', shell: 'istana' },
};
// Screens the switch reaches WITHOUT a screen key of their own -- guards and gates in front of
// another screen. They are reachable, so they are inventoried.
const INDEX_INTERSTITIALS = {
  SpendGate:        { shell: 'legacy', note: 'disabled by its own kill switch, still reachable code' },
  ChildVoiceNotice: { shell: 'legacy', note: 'stands in front of the call screen' },
  UnlockSheet:      { shell: 'legacy', note: 'stands in front of the call screen' },
};

// PARSED FROM THE SHIPPED FILE, not from the table above.
const foundScreens = new Set();
for (const m of html.matchAll(/if \(screen === '([a-zA-Z]+)'/g)) foundScreens.add(m[1]);
for (const m of html.matchAll(/screen === '([a-zA-Z]+)' \|\| screen === '([a-zA-Z]+)'/g)) { foundScreens.add(m[1]); foundScreens.add(m[2]); }
// the chat is the fall-through: no `if (screen === 'chat') return` guards it, it is what is left.
ok('the chat is still the render fall-through', /screen === 'chat' \|\| screen === 'call'/.test(html));
foundScreens.add('chat');

const declared = new Set(Object.keys(INDEX_SCREENS));
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
  region:     { shell: 'legacy' }, startStation: { shell: 'legacy' },
  challenges: { shell: 'legacy' }, _modeCard:   { shell: 'legacy' },
  daily:      { shell: 'legacy' }, speed:       { shell: 'legacy' },
  teamsSetup: { shell: 'legacy' }, teamsCats:   { shell: 'legacy' },
  teamsTrack: { shell: 'legacy' }, teamsAsk:    { shell: 'legacy' },
  teamsEnd:   { shell: 'legacy' }, book:        { shell: 'legacy' },
  profile:    { shell: 'legacy' }, settings:    { shell: 'legacy' },
  inspect:    { shell: 'legacy' },
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
eq('exactly 4 index screens are istana after this commit', idxIstana.length, 4);
eq('...and 8 index screens remain legacy', idxLegacy.length, 8);
eq('...with the other classifications unmoved',
  idxIstana.slice().sort().join(','), 'adhkar,home,memorize,settings');
// S107: no screen carries a sub-view caveat any more. The field still exists and is still
// asserted, so the next partially-finished screen has to declare itself the same way.
const partial = Object.keys(INDEX_SCREENS).filter((k) => INDEX_SCREENS[k].subviews);
eq('no screen is left with an undeclared unfinished sub-view', partial, []);
// and the caveat may only be absent while the drill actually IS on the shell.
ok('the memorize caveat was earned, not deleted',
  !INDEX_SCREENS.memorize.subviews === /<EzShell title=\{MEM\.TITLE\} onBack=\{ezikGoBack\}/.test(html),
  'the drill must render through the shell for memorize to count as finished');
// mushaf has NOT moved and must still say so.
eq('mushaf is still classified legacy', INDEX_SCREENS.mushaf.shell, 'legacy');
eq('...and its index/reader split is declared', INDEX_SCREENS.mushaf.partial, 'index istana, reader legacy');
console.log('        index.html : ' + idxIstana.length + ' istana, ' + idxLegacy.length + ' legacy'
  + ' (+' + Object.keys(INDEX_INTERSTITIALS).length + ' interstitials, all legacy)');
console.log('        istana now : ' + idxIstana.join(', '));
console.log('        outstanding: ' + idxLegacy.join(', '));
console.log('        quest.html : ' + qIstana.length + ' istana, ' + qLegacy.length + ' legacy');
console.log('        outstanding: ' + qLegacy.join(', '));
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
ok('the picker draws no legacy header or container',
  !/s\.memHeader/.test(pickerSrc) && !/s\.memContainer/.test(pickerSrc) && !/s\.memTitle/.test(pickerSrc),
  'memHeader is the full-width navy strip the review rejected');

/* ---- L1. the canonical 114, once, in order ------------------------------ */
ok('the catalogue maps the canonical range exactly once',
  (pickerSrc.match(/Array\.from\(\{ length: 114 \}, \(_, i\) => i \+ 1\)\.map\(/g) || []).length === 1);
ok('...and nothing re-orders, filters or slices it',
  !/\.sort\(|\.filter\(|\.slice\(|\.reverse\(/.test(pickerSrc));
ok('...and each card carries its own surah number', /data-ezq-surah=\{n\}/.test(pickerSrc));
// the metadata comes from the shipped sources, and none of it is written down here.
ok('the name comes from SURAH_NAMES', /\{SURAH_NAMES\[n\]\}/.test(pickerSrc));
ok('the ayah count comes from the single-pass tally', /counts\[n\] \? \(toArabicDigits\(counts\[n\]\)/.test(pickerSrc));
ok('the Meccan/Medinan word comes from revelationLabel', /\{revelationLabel\(n\)\}/.test(pickerSrc));
ok('no surah metadata is hardcoded in the catalogue',
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
ok('no memContainer/memHeader/memTitle/memSubBar remains in memorize',
  !/s\.memContainer|s\.memHeader|s\.memTitle\b|s\.memSubBar/.test(memSrc),
  'these are the full-width navy presentation the review rejected');
ok('...while the mushaf screen still has its own, untouched', /s\.memContainer/.test(html));
// BACK GOES TO THE IMMEDIATE PARENT, NOT TO CHAT.
ok('the drill back is the application back, which lands on the picker',
  /onBack=\{ezikGoBack\}/.test(drillSrc) && /useEzikBackLayer\(view === 'drill', leaveDrill\)/.test(memSrc));
ok('...and no back path in memorize routes to the chat',
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
ok('...with no transform, slice or ellipsis over it',
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
ok('...bound to page.n and nothing else',
  !/data-mushaf-page=\{(?!page\.n\})/.test(madinaImg),
  'a constant, an index or a derived value would make the guard measure the wrong page');
// IT MUST NOT BECOME A STYLING SURFACE.
ok('no CSS rule targets the hook', !/\[data-mushaf-page/.test(css),
  'the hook is for identification; a rule on it would be a rule on the Quran page');
ok('...and no CSS targets the live image through its branch either',
  !/:root\[data-ezik-visual-theme\][^{]*img[^{]*\{/.test(css));
// IT MUST NOT HAVE CHANGED WHAT THE ELEMENT IS.
ok('the image still carries no class and no id', !/<img[^>]*data-mushaf-page[^>]*className/.test(madinaImg)
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
ok('the legacy navy header is gone from the index',
  !/s\.memHeader|s\.memTitle\b|s\.memContainer/.test(idxSrc));
ok('the surah list is the bounded catalogue', /className="ezq-cat"/.test(idxSrc));
ok('...2 cols mobile, 3 at 600, 4 at 1000 -- and never more',
  /\.ezq-cat\{[^}]*grid-template-columns:repeat\(2,1fr\)/.test(css)
  && /@media \(min-width:600px\)\{\.ezq-cat\{grid-template-columns:repeat\(3,1fr\)/.test(css)
  && /@media \(min-width:1000px\)\{\.ezq-cat\{grid-template-columns:repeat\(4,1fr\)/.test(css)
  && !/\.ezq-cat\{grid-template-columns:repeat\([5-9]/.test(css));
ok('...inside the shell bounded column', /\.ezsh-wrap\{[^}]*max-width:1100px/.test(css));
// ONE map, the owner order, the same handlers.
eq('the index maps its row array exactly once',
  idxSrc.split('(nav || MUSHAF_NAV_FALLBACK).map(').length - 1, 1);
ok('...and nothing sorts, filters, slices or reverses it',
  !/\.sort\(|\.filter\(|\.slice\(|\.reverse\(/.test(idxSrc));
ok('each surah card carries its own number', idxSrc.indexOf('data-ezm-surah={r.n}') !== -1);
ok('the open handler is unchanged',
  idxSrc.indexOf('onClick={() => { setOpenAt(null); setSelected(r.n); }}') !== -1);
ok('the juz handler is unchanged',
  idxSrc.indexOf('onClick={() => { setOpenAt({ p: r.p, s: r.s }); setSelected(r.s); }}') !== -1);
// metadata comes from the shipped sources only.
ok('the name comes from SURAH_NAMES', idxSrc.indexOf('{SURAH_NAMES[r.n]}') !== -1);
ok('the revelation label comes from revelationLabel', idxSrc.indexOf('{revelationLabel(r.n)}') !== -1);
ok('the ayah count comes from the single-pass tally', idxSrc.indexOf('counts[r.n] ? counts[r.n] : 0') !== -1);
ok('no surah metadata is hardcoded in the index',
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

console.log('\n' + (failures ? 'FAIL' : 'OK') + ': ' + (checks - failures) + '/' + checks + ' checks passed.');
process.exit(failures ? 1 : 0);
