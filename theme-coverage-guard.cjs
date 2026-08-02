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

console.log('\n' + (failures ? 'FAIL' : 'OK') + ': ' + (checks - failures) + '/' + checks + ' checks passed.');
process.exit(failures ? 1 : 0);
