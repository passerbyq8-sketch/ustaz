// i18n-ui-guard.cjs — S116, the interface-language gate.
//
// It proves the phase the way every other guard in this repo does: by RUNNING the shipped code.
// The text/babel block is extracted from index.html, transformed with the page's own pinned Babel
// major, and evaluated inside a linkedom window against a localStorage stub and a navigator stub
// this file controls. The <head> boot script is run separately, in its own window, because that
// is where the very first language decision is actually made.
//
// It is NOT in gates.json and it does not modify it. Run it alongside the 33.
//
// Parts:
//   A. THE DICTIONARIES — two languages, identical keys, no empty value, no duplicate, no
//                         orphaned {placeholder}, and no translation fetched from anywhere.
//   B. THE DECISION     — the boot script, run for real, against a dozen devices that all report
//                         a language and none of which may move the answer: the first run is
//                         Arabic, and only a stored 'ar'/'en' is honoured.
//   C. THE DOCUMENT     — lang and dir, in both languages, from the boot script and from a switch.
//   D. THE CONTROLS     — the first-run card and the settings row, driven by real clicks in a
//                         mounted app: they exist THERE and nowhere else, they are not submits,
//                         they carry ARIA, Escape closes the menu, the typed profile fields
//                         survive a switch, and the choice is applied and persisted.
//   E. THE BLAST RADIUS — every store this phase must not touch, compared before and after a
//                         switch; and every file this phase must not touch, compared with the
//                         commit the branch started from.
//
// The Arabic this file looks for is collected in S below; every DIAGNOSTIC prints codepoints,
// because a failure message carrying raw Arabic reorders under bidi and then lies about which
// value it names.
//
// Usage: node guards/i18n-ui-guard.cjs [htmlFile]   (default: index.html)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

// A CONSENTED reader, seeded the way the app itself stores the choice. Since the AI-consent
// screen (Apple 5.1.1(i)) sits between the profile and the chat, a harness that wants to reach
// the chat has to answer it first -- exactly as a real reader does. The refusal path is proved
// separately in tools/ai-consent-probe.cjs. Note that the old 'disclosureAck' key is kept in
// these seeds and is NOT what opens the app: it is not consent and is no longer read.
const AI_CONSENT_SEED = JSON.stringify({ status: 'granted', version: '2026-08-06-1', grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });


// This guard lives in guards/ rather than in the repo root on purpose: recon-audit requires
// every ROOT .cjs to be classified either inside gates.json or inside recon-audit's own
// non-gate list, and this phase is allowed to edit neither. A directory of its own keeps that
// rule intact without weakening it, and keeps this guard out of the 33.
const REPO = path.resolve(__dirname, '..');
const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(path.join(REPO, htmlFile), 'utf8');

// The commit this branch started from. Every "unchanged" assertion in part E is measured
// against it, so the guard states a fact about the branch rather than about the last save.
const BASE = process.env.I18N_GUARD_BASE || '27112875ed6cac2cb15ea5c162832ed9eada737a';

const S = {
  LANG_KEY: 'ezik_ui_lang_v1',
  AR: 'العربية',
  EN: 'English',
};

let failures = 0, checks = 0, skipped = 0;
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
function skip(name, why) { checks++; skipped++; console.log('  SKIP  ' + name + '  (' + why + ')'); }
const plain = (v) => JSON.parse(JSON.stringify(v));
const cps = (x) => Array.prototype.map.call(String(x == null ? '' : x),
  (c) => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

/* ===================== the shipped block, transformed ===================== */
const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const mOpen = openRe.exec(html);
if (!mOpen) { console.error('No text/babel script block found in ' + htmlFile); process.exit(2); }
const rawCode = html.slice(mOpen.index + mOpen[0].length, html.indexOf('</script>', mOpen.index + mOpen[0].length));
const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
const babelMajor = (babelSrc.match(/@babel\/standalone@(\d+)\./) || [])[1] || 8;
let transformed;
try {
  transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: Number(babelMajor) >= 8 ? 'automatic' : 'classic' }]],
    filename: 'babel-block.jsx', sourceType: 'script', retainLines: true,
  }).code;
} catch (e) { console.log('TRANSFORM ERROR:\n' + e.message); process.exit(1); }

function makeStore(seed) {
  const data = Object.assign({}, seed || {});
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k in data) delete data[k]; },
    _dump: () => plain(data),
  };
}
function makeDeadStore() {
  const boom = () => { const e = new Error('SecurityError'); e.name = 'SecurityError'; throw e; };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, _dump: () => ({}) };
}

let liveGen = 0;
function buildContext(opts) {
  const o = opts || {};
  const gen = ++liveGen;
  const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.window = window.window || window;
  window.globalThis = window.globalThis || window;
  window.matchMedia = function (q) {
    return { matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.scrollTo = window.scrollTo || function () {};
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  window.localStorage = o.store || makeStore(o.seed);
  window.alert = function () {}; window.confirm = function () { return true; };
  const net = [];
  window.fetch = function (u) {
    net.push(String(u));
    return Promise.resolve({ ok: false, status: 0, headers: { get: () => null }, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
  };
  // The navigator the app is allowed to see. `undefined` means "this environment reports no
  // language", which is a different fact from "a language that is not Arabic".
  try {
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: ('nav' in o) ? o.nav : window.navigator,
    });
  } catch (e) {}
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try {
    const entries = [{}]; let at = 0;
    window.history = {
      get length() { return entries.length; }, get state() { return entries[at]; },
      pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
      replaceState: (st) => { entries[at] = st; },
      back: () => { if (at <= 0) return; at--; setTimeout(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0); },
    };
  } catch (e) {}
  global.navigator = window.navigator; global.window = window; global.document = window.document;

  const ctx = vm.createContext(window);
  const loadUMD = (f) => vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  loadUMD('react.umd.js'); loadUMD('react-dom.umd.js');
  if (!window.React || !window.ReactDOM) { console.log('FAIL: React/ReactDOM did not load.'); process.exit(1); }
  if (!o.mount) vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.addEventListener('error', () => {});
  window.console.error = () => {};
  try { vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' }); }
  catch (e) { console.log('RUNTIME ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); }
  const grab = (expr) => {
    if (gen !== liveGen) throw new Error('i18n-ui-guard: context ' + gen + ' used after ' + liveGen + ' replaced it');
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'i18n-guard-api' }); } catch (e) { return undefined; }
  };
  return { window, ctx, store: window.localStorage, grab, net: () => net.slice() };
}

const tick = (ms) => new Promise((r) => setTimeout(r, ms || 40));
function driver(window) {
  const root = window.document.getElementById('root');
  const all = (sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  const click = async (el) => {
    if (!el) throw new Error('nothing to click');
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
  };
  return { root, all, click, text: () => String(root.textContent || '') };
}

/* ===================== A. THE DICTIONARIES ================================ */
async function partA() {
  console.log('\n=== A. THE DICTIONARIES ===');
  const c = buildContext({ seed: {} });
  const langs = plain(c.grab('EZ_LANGS') || []);
  eq('exactly two languages are supported, ar and en', langs, ['ar', 'en']);
  ok('...and no third language is declared anywhere in the block',
    !/EZ_I18N\s*\.\s*(?!ar\b|en\b)[a-z]{2}\b/.test(rawCode));

  const dict = plain(c.grab('EZ_I18N') || {});
  eq('the dictionary declares those two and nothing else', Object.keys(dict).sort(), ['ar', 'en']);
  const ar = dict.ar || {}, en = dict.en || {};
  const arK = Object.keys(ar), enK = Object.keys(en);
  ok('both dictionaries are non-empty', arK.length > 0 && enK.length > 0, 'ar=' + arK.length + ' en=' + enK.length);
  eq('every ar key exists in en', arK.filter((k) => !Object.prototype.hasOwnProperty.call(en, k)), []);
  eq('every en key exists in ar', enK.filter((k) => !Object.prototype.hasOwnProperty.call(ar, k)), []);
  eq('the two dictionaries are the same size', arK.length, enK.length);

  const emptyAr = arK.filter((k) => typeof ar[k] !== 'string' || ar[k].trim() === '');
  const emptyEn = enK.filter((k) => typeof en[k] !== 'string' || en[k].trim() === '');
  eq('no ar value is empty or non-string', emptyAr, []);
  eq('no en value is empty or non-string', emptyEn, []);

  // A duplicate key is invisible in the evaluated object — the later one silently wins — so it
  // has to be counted in the SOURCE, per dictionary half.
  const src = rawCode.slice(rawCode.indexOf('const EZ_I18N = {'));
  const enAt = src.indexOf('\n  en: {');
  const arHalf = src.slice(0, enAt), enHalf = src.slice(enAt, src.indexOf('\n};', enAt));
  const keysIn = (s) => (s.match(/^    '([^']+)':/gm) || []).map((x) => x.replace(/^\s*'/, '').replace(/':$/, ''));
  const dupes = (list) => list.filter((k, i) => list.indexOf(k) !== i);
  eq('no key is declared twice in the ar dictionary', dupes(keysIn(arHalf)), []);
  eq('no key is declared twice in the en dictionary', dupes(keysIn(enHalf)), []);
  eq('the ar source declares exactly the ar keys the object has', keysIn(arHalf).length, arK.length);
  eq('the en source declares exactly the en keys the object has', keysIn(enHalf).length, enK.length);

  // A placeholder that exists on one side only is a string that will render a literal {token}.
  const ph = (v) => (String(v).match(/\{[A-Za-z0-9_]+\}/g) || []).slice().sort();
  const mismatched = arK.filter((k) => JSON.stringify(ph(ar[k])) !== JSON.stringify(ph(en[k])));
  eq('every {placeholder} appears on both sides of a key', mismatched, []);

  // The lookup itself.
  const t = c.grab('ezT');
  ok('ezT substitutes a placeholder', String(c.grab("ezT('language.current', { lang: 'X' })")).indexOf('X') !== -1);
  ok('...and leaves an unsupplied one as authored rather than printing undefined',
    String(c.grab("ezT('language.current')")).indexOf('undefined') === -1);
  eq('...and a key that exists in neither dictionary returns empty, never the raw key',
    c.grab("ezT('no.such.key.at.all')"), '');
  ok('...and a non-string key cannot throw', c.grab('ezT(null)') === '' && c.grab('ezT(undefined)') === '');

  console.log('  ..  ' + arK.length + ' keys per language');

  // NO TRANSLATION IS FETCHED. Two independent facts: the page loads no new script, and the
  // i18n block contains no network call of any kind.
  const srcs = (html.match(/<script[^>]*src=["']([^"']+)["']/gi) || []);
  // THREE, not the five that shipped before: /_vercel/insights and /_vercel/speed-insights were
  // removed for the AI-consent release (both measured on page load, before the reader had
  // answered the consent screen). The exact count stays exact so "we dropped two" cannot become
  // "we dropped two and added one", and the companion check below names what must not come back.
  eq('the page still loads exactly the three scripts it loads now', srcs.length, 3);
  ok('...and no analytics script is among them',
    !srcs.some((t) => /_vercel\/(insights|speed-insights)/.test(String(t))), srcs.join(' || '));
  const i18nBlock = rawCode.slice(rawCode.indexOf('const EZ_LANG_KEY'), rawCode.indexOf('function EzLangControl'));
  ok('the language layer makes no network call',
    !/\bfetch\s*\(|XMLHttpRequest|import\s*\(|EventSource|navigator\.sendBeacon/.test(i18nBlock));
  ok('...and no dictionary is loaded from a URL',
    !/https?:\/\//.test(i18nBlock));
  ok('...and no dependency was added',
    (() => {
      const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
      return Object.keys(pkg.dependencies || {}).length === 5 && Object.keys(pkg.devDependencies || {}).length === 4;
    })());
}

/* ===================== B. THE DECISION =================================== */
// The <head> boot script, run for real. This is where a first run is actually decided.
//
// It runs in a PLAIN sandbox rather than in a linkedom window, because a linkedom window exposes
// navigator through a hard getter that rebuilds the object on every read — it cannot be replaced,
// shadowed or assigned to, so no device language can be simulated inside one. Here the sandbox is
// built by hand, which means a navigator CAN be handed in — and the point of most of the cases
// below is that handing one in changes nothing.
function runBoot(stored, navLanguages) {
  const m = /<script>\(function\(\)\{try\{var K='ezik_ui_lang_v1'[\s\S]*?<\/script>/.exec(html);
  if (!m) return null;
  const body = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const { document: doc } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><head></head><body></body></html>');
  const written = {};
  const sandbox = {
    document: doc,
    localStorage: stored === '__DEAD__' ? makeDeadStore() : {
      getItem: () => (stored === undefined ? null : stored),
      setItem: (k, v) => { written[k] = v; }, removeItem() {}, clear() {},
    },
  };
  if (navLanguages !== undefined) sandbox.navigator = { languages: navLanguages, language: navLanguages[0] };
  sandbox.window = sandbox;
  vm.runInContext(body, vm.createContext(sandbox), { filename: 'lang-boot.js' });
  const d = doc.documentElement;
  return { lang: d.getAttribute('lang'), dir: d.getAttribute('dir'), data: d.getAttribute('data-ez-lang'), written };
}

function partB() {
  console.log('\n=== B. THE FIRST RUN IS ARABIC, WHATEVER THE DEVICE SAYS ===');
  // Every row here hands the boot script a REAL navigator. None of them may move the answer.
  const cases = [
    ['a brand-new device reporting ar-KW', undefined, ['ar-KW'], 'ar'],
    ['a brand-new device reporting en-US', undefined, ['en-US'], 'ar'],
    ['a brand-new device reporting en-GB', undefined, ['en-GB'], 'ar'],
    ['a brand-new device reporting fr-FR', undefined, ['fr-FR'], 'ar'],
    ['a brand-new device reporting ur-PK', undefined, ['ur-PK'], 'ar'],
    ['a device reporting a whole English list', undefined, ['en-US', 'en', 'fr'], 'ar'],
    ['an environment reporting NO language at all', undefined, undefined, 'ar'],
    ['an environment reporting an empty tag', undefined, [''], 'ar'],
    ['a corrupt stored value on an English device', 'zz-not-a-language', ['en-US'], 'ar'],
    ['a stored empty string on a French device', '', ['fr-FR'], 'ar'],
    ['a stored JSON blob on an English device', '{"lang":"en"}', ['en-US'], 'ar'],
    ['a stored AR in the wrong case', 'AR', ['en-US'], 'ar'],
    // ...and the two that MUST still be honoured.
    ['a stored en on an Arabic device', 'en', ['ar-KW'], 'en'],
    ['a stored ar on an English device', 'ar', ['en-US'], 'ar'],
  ];
  for (const [name, stored, navs, want] of cases) {
    const r = runBoot(stored, navs);
    if (!r) { ok('the boot script is runnable', false); return; }
    eq(name + ' => ' + want, r.lang, want);
    eq('...direction ' + (want === 'ar' ? 'rtl' : 'ltr'), r.dir, want === 'ar' ? 'rtl' : 'ltr');
  }
  const dead = runBoot('__DEAD__', ['en-US']);
  ok('a storage that throws on every read still boots Arabic', !!dead && dead.lang === 'ar', JSON.stringify(dead));

  // The strongest form of the rule: the layer cannot consult the device, because it never names it.
  console.log('\n=== B2. THE DEVICE IS NOT AN INPUT ===');
  const bootScript = (/<script>\(function\(\)\{try\{var K='ezik_ui_lang_v1'[\s\S]*?<\/script>/.exec(html) || [''])[0];
  eq('the boot script names navigator nowhere', (bootScript.match(/navigator/g) || []).length, 0);
  eq('...and names no language tag pattern either', (bootScript.match(/languages?\b/g) || []).length, 0);
  const layer = rawCode.slice(rawCode.indexOf('const EZ_LANG_KEY'), rawCode.indexOf('function EzLangControl'));
  eq('the language module names navigator nowhere', (layer.match(/navigator/g) || []).length, 0);
  eq('...and the device readers are gone, not dormant',
    [/function ezLangDevice/, /function ezLangFromTag/].filter((re) => re.test(rawCode)).length, 0);
  ok('...so the resolver is a stored choice, or Arabic, and nothing else',
    /function ezLangResolve\(\) \{ return ezLangStored\(\) \|\| EZ_LANG_FALLBACK; \}/.test(rawCode));
  eq('and the journey does not read the device either',
    (fs.readFileSync(path.join(REPO, 'quest.html'), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
      .match(/navigator\s*\.\s*languages?/g) || []).length, 0);

  // The module-level readers, driven directly.
  console.log('\n=== B3. THE STORED CHOICE, READ BACK ===');
  for (const stored of ['ar', 'en']) {
    const cc = buildContext({ seed: { [S.LANG_KEY]: stored } });
    eq('a stored ' + JSON.stringify(stored) + ' is honoured', cc.grab('ezLangStored()'), stored);
    eq('...and is not rewritten by the boot', cc.store.getItem(S.LANG_KEY), stored);
    eq('...and the app runs in it', cc.grab('ezLangGet()'), stored);
  }
  for (const stored of ['', '   ', 'zz', 'AR', '{"lang":"en"}', 'null', 'undefined', '["ar"]']) {
    const cc = buildContext({ seed: { [S.LANG_KEY]: stored } });
    eq('a stored ' + JSON.stringify(stored) + ' is discarded and the slot repaired',
      cc.store.getItem(S.LANG_KEY), 'ar');
    eq('...and the app runs in Arabic', cc.grab('ezLangGet()'), 'ar');
  }
  const cDead = buildContext({ store: makeDeadStore() });
  eq('a storage that throws is not a stored choice', cDead.grab('ezLangStored()'), null);
  eq('...and the resolver still returns Arabic', cDead.grab('ezLangResolve()'), 'ar');
  const cFirst = buildContext({ seed: {} });
  eq('a first run writes ar down, so the journey can agree with the app',
    cFirst.store.getItem(S.LANG_KEY), 'ar');
}


/* ===================== C. THE DOCUMENT =================================== */
async function partC() {
  console.log('\n=== C. lang, dir AND THE SWITCH ===');
  const c = buildContext({ seed: { [S.LANG_KEY]: 'en' }, mount: true });
  await tick(60);
  const d = c.window.document.documentElement;
  eq('a stored en settles the document as en without any boot script', d.getAttribute('lang'), 'en');
  eq('...ltr', d.getAttribute('dir'), 'ltr');
  eq('...and stamps the attribute the stylesheet keys off', d.getAttribute('data-ez-lang'), 'en');
  c.grab("ezLangSet('ar')");
  await tick(60);
  eq('switching to ar repaints the document lang', d.getAttribute('lang'), 'ar');
  eq('...and its direction', d.getAttribute('dir'), 'rtl');
  eq('...and the data attribute follows', d.getAttribute('data-ez-lang'), 'ar');
  eq('...and persists the choice under its own key', c.store.getItem(S.LANG_KEY), 'ar');
  c.grab("ezLangSet('en')");
  await tick(60);
  eq('and back again', [d.getAttribute('lang'), d.getAttribute('dir')], ['en', 'ltr']);
  eq('...persisted', c.store.getItem(S.LANG_KEY), 'en');
  c.grab("ezLangSet('fr')");
  eq('a language that is not offered is refused outright', c.grab('ezLangGet()'), 'en');
  eq('...and nothing was written for it', c.store.getItem(S.LANG_KEY), 'en');

  // The shipped document declares ar, so a run that never reaches the boot script still draws
  // the app the way it always drew it.
  ok('the shipped <html> still declares lang="ar" dir="rtl"', /<html lang="ar" dir="rtl">/.test(html));
  // Measured with HTML comments stripped: the prose above the theme boot QUOTES a stylesheet
  // link to explain this very rule, and a tag scanner reads its own explanation as a real tag.
  const head = html.slice(0, html.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, ' ');
  const iTheme = head.indexOf("localStorage.getItem('murabbi_theme_v1')");
  const iLang = head.indexOf("var K='ezik_ui_lang_v1'");
  const iSheet = head.search(/<link[^>]+rel=["']?stylesheet/i);
  ok('the language boot script runs inside <head>', iLang !== -1);
  ok('...and the THEME boot still runs first', iTheme !== -1 && iTheme < iLang);
  ok('...and both run before any external stylesheet can block them',
    iSheet === -1 || (iTheme < iSheet && iLang < iSheet),
    'theme@' + iTheme + ' lang@' + iLang + ' stylesheet@' + iSheet);

  // Logical properties only: a direction-specific rule would need a second block to serve ltr.
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const langCss = css.slice(css.indexOf('.ezlang-wrap{'));
  ok('the language CSS positions with logical inset, not a physical left/right',
    /inset-inline-(start|end)/.test(langCss) && !/(^|[;{])\s*(left|right)\s*:/m.test(langCss));
  // THE LAYOUT DIRECTION. body{direction:rtl} is declared in the shipped stylesheet, and a CSS
  // declaration beats the dir ATTRIBUTE the boot script writes on <html> — so without an explicit
  // override the English interface is English words inside a right-to-left layout, and every
  // logical margin, padding and inset in the app still resolves the Arabic way. This was measured
  // on a real browser (the first-run control computed direction:rtl with document.dir "ltr"), and
  // it is pinned here so it cannot come back.
  ok('body still declares the Arabic direction, so Arabic is unchanged', /body\s*\{[^}]*direction:\s*rtl/.test(css));
  ok('...and the English document turns the layout with it',
    /:root\[data-ez-lang="en"\]\s*body\s*\{[^}]*direction:\s*ltr/.test(css));
  ok('...and declares no colour of its own — every value is an existing token',
    !/#[0-9a-fA-F]{3,8}\b/.test(langCss.replace(/rgba\(0,0,0,[0-9.]+\)/g, '')));
  ok('...and names no bare element or universal selector',
    !/(^|\})\s*(\*|div|button|span|body|input)\s*\{/.test(langCss));
}

/* ===================== D. THE CONTROLS =================================== */
/* D0. THE FIRST RUN.
   The language choice belongs to two places and no others: the card a reader meets BEFORE they
   have a profile, and Settings afterwards. It is deliberately not on the chat, the home, the
   drawer or any rail — a returning reader is not asked to pick a language every time they open
   the app. This part proves the first half of that rule by driving the real first-run card. */
async function partD0() {
  console.log('\n=== D0. THE FIRST RUN OFFERS THE CHOICE ===');
  // No profile at all: this is a device that has never been set up.
  const c = buildContext({ seed: {}, mount: true });
  await tick(150);
  const w = c.window, d = driver(w);

  ok('a device with no profile lands on the first-run card', d.all('.ezonb-card').length === 1);
  const t = d.all('button[data-ez-lang-toggle]')[0];
  if (!ok('...and that card carries the language control', !!t)) return;
  ok('...INSIDE the card, not floating somewhere over the screen',
    !!(t.closest && t.closest('.ezonb-card')));
  eq('...as an explicit type="button", so it cannot submit the card', t.getAttribute('type'), 'button');
  ok('...with an accessible name', !!(t.getAttribute('aria-label') || '').trim());
  eq('...declaring its menu closed', t.getAttribute('aria-expanded'), 'false');
  eq('...and reading the language in use', String(t.textContent || '').trim(), S.AR);

  // Type into the card first: a language switch may not cost the reader what they typed.
  const inputs = d.all('input');
  eq('the card asks for a name and a year', inputs.length, 2);
  const nameEl = inputs[0], yearEl = inputs[1];
  // TYPING, THE WAY REACT CAN SEE IT — the same delivery chat-ux-guard documents and uses.
  // The DOM value is moved through the PROTOTYPE setter so React's value tracker is not advanced
  // (assigning el.value advances it, and React then drops the event as a keystroke it already
  // knows about); and because React's ChangeEventPlugin does not fire under linkedom at all, the
  // component's OWN registered onChange is then called with the node as its target. That is the
  // shipped handler, not a re-implementation — only the delivery differs.
  const type = async (el, v) => {
    if (!el) throw new Error('nothing to type into');
    let wrote = false;
    try {
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      if (desc && typeof desc.set === 'function') { desc.set.call(el, v); wrote = true; }
    } catch (e) {}
    if (!wrote) el.value = v;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    await tick(30);
    const key = Object.keys(el).filter((k) => k.indexOf('__reactProps$') === 0)[0];
    const props = key ? el[key] : null;
    if (props && typeof props.onChange === 'function') {
      props.onChange({ target: el, currentTarget: el, preventDefault() {}, stopPropagation() {} });
      await tick(30);
    }
  };
  await type(nameEl, 'Sami');
  await type(yearEl, '2015');
  // Proving the typing landed BEFORE the switch, so "the values survived" cannot pass vacuously
  // on a harness that never delivered them.
  eq('the name reached the card', d.all('input')[0].value, 'Sami');
  eq('the year reached the card', d.all('input')[1].value, '2015');
  const male = d.all('.ezonb-row button')[0];
  await d.click(male);
  await tick(40);

  const beforeStore = JSON.stringify(c.store._dump());
  const beforeNet = c.net().length;

  await d.click(t);
  eq('pressing the control opens its own menu', t.getAttribute('aria-expanded'), 'true');
  const items = d.all('.ezlang-menu button');
  eq('...offering one row per declared language', items.length, plain(c.grab('EZ_LANGUAGES') || []).length);
  eq('...each a real button', items.filter((b) => b.tagName !== 'BUTTON').length, 0);
  eq('...none of them a submit', items.filter((b) => b.getAttribute('type') !== 'button').length, 0);
  eq('...each declaring option semantics', items.filter((b) => b.getAttribute('role') !== 'option').length, 0);
  eq('...with the current one marked selected', items.map((b) => b.getAttribute('aria-selected')), ['true', 'false']);
  eq('...and no profile was created by opening it', c.store.getItem('child_profile'), null);

  // ar -> en
  await d.click(d.all('.ezlang-menu button')[1]);
  await tick(90);
  eq('choosing English applies it at once', c.grab('ezLangGet()'), 'en');
  eq('...and turns the document round', w.document.documentElement.getAttribute('dir'), 'ltr');
  ok('...and the CARD is in English now', d.text().indexOf('Welcome') !== -1, d.text().slice(0, 60));
  ok('...including its start button', d.all('button').some((b) => String(b.textContent || '').trim() === 'Start'));
  eq('...the name survived the switch', d.all('input')[0].value, 'Sami');
  eq('...the year survived the switch', d.all('input')[1].value, '2015');
  ok('...and the gender choice survived it',
    d.all('.ezonb-row button').some((b) => /var\(--accent-fill\)/.test(b.getAttribute('style') || '')));
  eq('...no profile was created', c.store.getItem('child_profile'), null);
  eq('...the screen did not move', d.all('.ezonb-card').length, 1);
  eq('...and not one network request was made', c.net().length, beforeNet);
  eq('...the only thing written is the language itself',
    Object.keys(JSON.parse(beforeStore)).concat([S.LANG_KEY]).sort().filter((k, i, a) => a.indexOf(k) === i),
    Object.keys(c.store._dump()).sort());

  // en -> ar
  await d.click(d.all('button[data-ez-lang-toggle]')[0]);
  await d.click(d.all('.ezlang-menu button')[0]);
  await tick(90);
  eq('and back to Arabic, immediately', c.grab('ezLangGet()'), 'ar');
  eq('...rtl again', w.document.documentElement.getAttribute('dir'), 'rtl');
  eq('...with the typed values still there', [d.all('input')[0].value, d.all('input')[1].value], ['Sami', '2015']);
}

/* D1. AFTER THE PROFILE EXISTS.
   The other half of the rule, and the one that regressed once: a returning reader must not meet
   the control on any ordinary screen. Every screen below is reached through the app's own
   controls, and each is checked for the toggle by attribute, not by counting. */
async function partD() {
  console.log('\n=== D1. A RETURNING READER MEETS IT ONLY IN SETTINGS ===');
  const c = buildContext({
    seed: {
      child_profile: JSON.stringify({ name: 'Noor', age: 30, gender: 'male', birthYear: 1996, pid: 'I18N-D1', createdAt: '2026-01-01T00:00:00.000Z' }),
      disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED,
    },
    mount: true,
  });
  await tick(150);
  const w = c.window, d = driver(w);
  const toggles = () => d.all('[data-ez-lang-toggle]').length;

  ok('the app opens on the chat, as it always has', d.all('.ezc-dock').length === 1);
  eq('the chat carries NO language control', toggles(), 0);
  eq('...and the first-run card is nowhere on screen', d.all('.ezonb-card').length, 0);

  await d.click(d.all('.ezc-rail button.ezc-icon')[0]);
  await tick(80);
  eq('the side menu carries none either', toggles(), 0);

  const homeEntry = d.all('button').filter((b) => String(b.textContent || '').trim() === 'القائمة')[0];
  if (ok('the side menu offers its home entry', !!homeEntry)) {
    await d.click(homeEntry);
    await tick(140);
    ok('...and the home screen was reached', d.all('.ezist-mosaic').length === 1);
    eq('the home carries none', toggles(), 0);

    // ONE WAY INTO THE CHAT. The home used to offer two — the small icon in the top nav, and a
    // large "ask Ezik" panel at the head of the mosaic — both calling the same onOpenChat. The
    // panel is gone. Measured on the live DOM, not on the source, because "deleted" and "hidden"
    // look identical in a file and different on a screen.
    eq('the home draws no chat panel at all', d.all('.ezist-ask').length, 0);
    eq('...and nothing is hiding where it was', d.all('[class*="ezist-ask"]').length, 0);
    const mosaic = d.all('.ezist-mosaic')[0];
    if (ok('the home still draws its mosaic', !!mosaic)) {
      const kids = Array.prototype.slice.call(mosaic.children);
      eq('...with no empty cell left behind',
        kids.filter((e) => !String(e.textContent || '').trim() && !e.querySelector('svg')).length, 0);
      ok('...and the four modules and the daily verse are all still in it',
        ['memorize', 'adhkar', 'mushaf', 'treasure']
          .every((id) => !!mosaic.querySelector('[data-ezik-home-module="' + id + '"]'))
        && !!mosaic.querySelector('.ezist-quran'), String(kids.length) + ' children');
    }
    // The one entry that remains, driven for real.
    const navChat = d.all('.ezist-nav button').filter((b) => (b.getAttribute('aria-label') || '') === 'عزك')[0];
    if (ok('the top nav still carries the chat icon', !!navChat)) {
      eq('...as a type="button"', navChat.getAttribute('type'), 'button');
      ok('...drawn as an icon, with no text of its own', !String(navChat.textContent || '').trim() && !!navChat.querySelector('svg'));
      const before = { chats: c.store.getItem('ezik_chats_v1'), net: c.net().length };
      await d.click(navChat);
      await tick(180);
      ok('...and pressing it opens the chat', d.all('.ezc-dock').length === 1);
      eq('...without sending a message', d.all('.ezc-turn').length, 0);
      eq('...without filing a conversation', c.store.getItem('ezik_chats_v1'), before.chats);
      eq('...and without a request', c.net().length, before.net);
      // back to the home for the rest of this part
      await d.click(d.all('.ezc-rail button.ezc-icon')[0]);
      await tick(120);
      const h = d.all('button').filter((b) => String(b.textContent || '').trim() === 'القائمة')[0];
      if (h) { await d.click(h); await tick(160); }
    }
    ok('...and the panel is gone from the source too, not merely unmounted',
      rawCode.indexOf('EzistAsk') === -1 && rawCode.indexOf('ezist-ask') === -1
      && rawCode.indexOf('EZIST_ASK_TITLE') === -1);
    // ...and the words themselves are still where they are needed. The menu writes them as
    // \\uXXXX escapes, so the source is read decoded — a raw search would find nothing and call
    // that a pass.
    const decoded = rawCode.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const drawerSrc = decoded.slice(decoded.indexOf('{drawerOpen && ('), decoded.indexOf('{reportFor &&'));
    ok('the side menu still offers «a new conversation», on the same handler',
      /onClick=\{\(\) => closeDrawerWith\(newChat\)\}/.test(drawerSrc)
      && drawerSrc.indexOf('محادثة جديدة') !== -1);
    // Reached the way a reader reaches it: home -> chat -> the menu button on the chat's rail.
    await d.click(d.all('.ezist-nav button')[1]);
    await tick(160);
    if (ok('...the chat is reachable from the home', d.all('.ezc-rail').length === 1)) {
      await d.click(d.all('.ezc-rail button.ezc-icon')[0]);
      await tick(140);
      const newChat = d.all('button').filter((b) => /محادثة جديدة|New conversation/.test(String(b.textContent || '')))[0];
      if (ok('...and the entry is really on the screen', !!newChat, d.text().slice(0, 60))) {
        await d.click(newChat);
        await tick(160);
        ok('...and pressing it lands on a chat', d.all('.ezc-dock').length === 1);
      }
    }
    // ...and back to the home, because the settings step below is reached from its top nav.
    await d.click(d.all('.ezc-rail button.ezc-icon')[0]);
    await tick(120);
    const back = d.all('button').filter((b) => String(b.textContent || '').trim() === 'القائمة')[0];
    if (back) { await d.click(back); await tick(160); }
    ok('the home is reachable again', d.all('.ezist-nav').length === 1);
  }

  // Settings, through the app's own route.
  await d.click(d.all('.ezist-nav button')[3] || d.all('.ezist-nav button')[2]);
  await tick(160);
  ok('settings was reached', d.all('.ezsh-group').length > 0, d.text().slice(0, 80));
  eq('...and THIS is where the control lives — exactly one', toggles(), 1);
  const st = d.all('button[data-ez-lang-toggle]')[0];
  ok('...inside a settings group, not floating', !!(st.closest && st.closest('.ezsh-group')));
  eq('...as a type="button"', st.getAttribute('type'), 'button');
  eq('...showing the current choice', String(st.textContent || '').trim().replace(/[\u25BE\s]+$/, ''), S.AR);

  // It is ONE compact row, not a pair of full-width buttons.
  const set = html.slice(html.indexOf('function SettingsSheet'), html.indexOf('function ParentDashboard'));
  ok('the settings entry is one compact row', /<div className="ezlang-row"><EzLangControl variant="settings" \/><\/div>/.test(set));
  ok('...inside the shell every other setting uses', /<EzShellGroup title=\{ezT\('settings\.language'\)\}>/.test(set));
  ok('...and it is no longer a radiogroup of full-width buttons', !/data-ez-lang-opt/.test(set));
  eq('...so the group draws exactly one control', d.all('.ezlang-row button').length, 1);

  await d.click(st);
  await tick(60);
  eq('it opens its menu in place', d.all('.ezlang-menu').length, 1);
  await d.click(d.all('.ezlang-menu button')[1]);
  await tick(90);
  eq('choosing English from Settings applies it', c.grab('ezLangGet()'), 'en');
  eq('...and persists it', c.store.getItem(S.LANG_KEY), 'en');
  eq('...and still exactly one control on screen', toggles(), 1);

  console.log('\n=== D2. THE PLACEMENT, READ OFF THE SOURCE ===');
  // Not a count: WHERE. The toggle attribute is written once, inside the control, and the
  // control is rendered from exactly two components — the first-run card and Settings.
  const block = rawCode;
  eq('data-ez-lang-toggle is written exactly once, inside the control',
    (block.match(/data-ez-lang-toggle/g) || []).length, 1);
  const renders = [...block.matchAll(/<EzLangControl\b[^/>]*\/>/g)];
  eq('...and the control is rendered in exactly two places', renders.length, 2);
  const owner = (idx) => {
    const before = block.slice(0, idx);
    const m = [...before.matchAll(/^function ([A-Za-z0-9_]+)\s*\(/gm)].pop();
    return m ? m[1] : '(top level)';
  };
  eq('...and those two are the first-run card and the settings sheet',
    renders.map((m) => owner(m.index)).sort(), ['Onboarding', 'SettingsSheet']);
  for (const comp of ['App', 'Home', 'EzikIstanaHome', 'EzistTopNav', 'EzistMasthead', 'FavoritesScreen',
    'AdhkarScreen', 'MushafScreen', 'MemorizeScreen', 'CallScreen', 'ParentDashboard']) {
    const at = block.indexOf('function ' + comp + '(');
    if (at < 0) continue;
    const nxt = block.indexOf('\nfunction ', at + 1);
    const body = block.slice(at, nxt === -1 ? block.length : nxt);
    ok(comp + ' renders no language control', body.indexOf('EzLangControl') === -1);
  }
  ok('...and nothing hides one with CSS instead of not rendering it',
    !/\.ezlang-[a-z-]*\{[^}]*display\s*:\s*none/.test(html) && !/\.ezlang-[a-z-]*\{[^}]*visibility\s*:\s*hidden/.test(html));

  console.log('\n=== D3. THE LIST IS EXTENSIBLE ===');
  const list = plain(c.grab('EZ_LANGUAGES') || []);
  eq('the offer is a data list', list.map((l) => l.code), ['ar', 'en']);
  eq('...every entry carries a native name', list.filter((l) => !String(l.nativeName || '').trim()), []);
  eq('...a short label', list.filter((l) => !String(l.shortLabel || '').trim()), []);
  eq('...and a direction', list.filter((l) => ['rtl', 'ltr'].indexOf(l.dir) === -1), []);
  eq('...and EZ_LANGS is derived from it, not written twice',
    plain(c.grab('EZ_LANGS')), list.map((l) => l.code));
  eq('...as is the direction map', plain(c.grab('EZ_LANG_DIR')),
    list.reduce((m, l) => { m[l.code] = l.dir; return m; }, {}));
  ok('...and the menu is built by mapping the list, not by two hardcoded rows',
    /EZ_LANGUAGES\.map\(/.test(block));
  ok('no flag stands in for a language', !/\uD83C[\uDDE6-\uDDFF]/.test(block));
}


/* ===================== E. THE BLAST RADIUS =============================== */
async function partE() {
  console.log('\n=== E. WHAT THIS PHASE MUST NOT HAVE TOUCHED ===');

  // --- E1. the stores, across a real switch ---
  const seed = {
    ezik_chats_v1: JSON.stringify([{ id: 'c1', title: 'محفوظة', at: 1, pinned: true }, { id: 'c2', title: 'ثانية', at: 2 }]),
    ezik_favorite_replies_v1: JSON.stringify([{ id: 'f1', text: 'رد', chatId: 'c1', at: 1 }]),
    murabbi_theme_v1: 'dark',
    ezik_visual_theme_v2: 'istana_33',
    ezik_reading_prefs_v1: JSON.stringify({ 'I18N-A': { fontSize: 'large', reading: true, reduceMotion: true } }),
    tashkeel_v1: '1',
    mushaf_wird_target_v1: '5',
    child_profile: JSON.stringify({ name: 'ن', age: 30, gender: 'male', birthYear: 1996, pid: 'I18N-A', createdAt: '2026-01-01T00:00:00.000Z' }),
    disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED,
  };
  const c = buildContext({ seed, nav: { languages: ['ar-KW'], language: 'ar-KW' }, mount: true });
  await tick(120);
  const beforeStore = c.store._dump();
  const beforeNet = c.net().length;
  for (const l of ['en', 'ar', 'en', 'ar']) { c.grab("ezLangSet('" + l + "')"); await tick(50); }
  const afterStore = c.store._dump();
  const changed = Object.keys(Object.assign({}, beforeStore, afterStore))
    .filter((k) => beforeStore[k] !== afterStore[k]);
  eq('switching the language four times touches no key but its own',
    changed.filter((k) => k !== S.LANG_KEY), []);
  eq('...and its own key holds the language actually in use', afterStore[S.LANG_KEY], c.grab('ezLangGet()'));
  for (const k of Object.keys(seed)) {
    eq('...' + k + ' is byte-for-byte what it was', afterStore[k], seed[k]);
  }
  // Not "the app made no request" -- it reads its own daily verse, as it always has. The claim is
  // that SWITCHING THE LANGUAGE makes none: no dictionary is fetched, nothing is reported.
  eq('...and switching the language four times made no request at all', c.net().slice(beforeNet), []);
  eq('...and every request the app did make is same-origin and local',
    c.net().filter((u) => !/^\//.test(u)), []);

  // --- E2. the files, against the commit this branch started from ---
  const diff = (() => {
    try {
      return cp.execSync('git diff --name-only ' + BASE, { cwd: REPO, encoding: 'utf8' })
        .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    } catch (e) { return null; }
  })();
  if (diff === null) { skip('the blocked files are untouched', 'git unavailable'); return; }
  console.log('  ..  files changed since ' + BASE.slice(0, 7) + ': ' + JSON.stringify(diff));

  // theme-coverage-guard.cjs is on this list by an EXPLICIT, NARROW authorisation and nothing
  // else: it carried an assertion that required the duplicate chat panel to exist, so the panel
  // could not be removed while it stood. The permission was to change THAT assertion and no
  // other, and the next block proves the diff kept to it.
  const ALLOWED = ['index.html', 'quest.html', 'guards/i18n-ui-guard.cjs', 'theme-coverage-guard.cjs'];
  eq('nothing outside the allow-list was modified', diff.filter((f) => ALLOWED.indexOf(f) === -1), []);

  if (diff.indexOf('theme-coverage-guard.cjs') !== -1) {
    const was = (() => { try { return cp.execSync('git show ' + BASE + ':theme-coverage-guard.cjs', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }); } catch (e) { return null; } })();
    const now = fs.readFileSync(path.join(REPO, 'theme-coverage-guard.cjs'), 'utf8');
    if (ok('the shipped guard the phase was allowed to touch is readable at both ends', !!was)) {
      const L = (s) => s.replace(/\r\n/g, '\n').split('\n');
      const before = L(was), after = L(now);
      const gone = before.filter((l) => after.indexOf(l) === -1);
      // ---------------------------------------------------------------------------------
      // TWO authorisations, each literal, each closed. A file on the allow-list is NOT a file
      // that may be edited freely: what is permitted is a named list of exact lines, and any
      // other difference is still a FAIL.
      //
      // (1) S116, the interface-language phase: ONE line, the assertion that pinned the
      //     duplicate chat panel and therefore stopped the panel being removed.
      // (2) THE APPLE-PRIVACY PHASE (5.1.1(i) / 5.1.2(i)): eight further lines, all of them
      //     assertions that described code this phase had to change --
      //       * two that pinned a BARE fetch() to /api/tts and /api/stt, which now must go
      //         through aiFetch, the consent choke point;
      //       * one that pinned the call barrier order without the consent barrier in it;
      //       * three that pinned the OLD recogniser shape (window.SpeechRecognition, new SR(),
      //         rec.start()), which now go through the consent-checked factory and starter;
      //       * one that pinned the inline four-statement recogniser teardown, now ezKillRecognizer.
      //     Each is paired below with the successor line that MUST be present, so a removal
      //     cannot be authorised without its replacement actually landing.
      const S116_REMOVED = "ok('the chat entry is part of the composition', /<EzistAsk /.test(IST) && /className=\"ezhome-focus ezist-ask\"/.test(IST));";
      const AP_REMOVED = [
        "  /await fetch\\('\\/api\\/tts'/.test(html));",
        "    /if \\(childVoiceBlocked\\(\\)\\) return; \\/\\/ غ‑٣[\\s\\S]{0,200}?if \\(!hasFounderToken\\(\\)\\) return; \\/\\/ directive 82[\\s\\S]{0,120}?callGenRef\\.current\\+\\+;/.test(callFx));",
        "ok('O12: speech OUT still goes to the shipped endpoint', /await fetch\\('\\/api\\/tts'/.test(html));",
        "  /await fetch\\('\\/api\\/stt', \\{ method: 'POST', headers: \\{ 'Content-Type': 'application\\/json' \\}, body: JSON\\.stringify\\(\\{ audio: b64, mime: blob\\.type, band \\}\\) \\}\\)/.test(html));",
        "  /const SR = window\\.SpeechRecognition \\|\\| window\\.webkitSpeechRecognition;/.test(callFx)",
        "  && /const rec = SR \\? new SR\\(\\) : null;/.test(callFx));",
        "  (callFx.match(/rec\\.start\\(\\);/g) || []).length, 2);",
        "    ['the recogniser handlers and the recogniser', /rec\\.onresult = null; rec\\.onend = null; rec\\.onerror = null; rec\\.stop\\(\\);/],",
      ];
      // The successors, and the four analytics assertions this phase added: no Vercel Web
      // Analytics, no Speed Insights, no substitute tool, and a script count that is EXACTLY
      // three rather than "three or fewer".
      const AP_REQUIRED_NEW = [
        "ok('O12: speech OUT still goes to the shipped endpoint', /await aiFetch\\('\\/api\\/tts'/.test(html));",
        "  /await aiFetch\\('\\/api\\/tts'/.test(html));",
        "  /await aiFetch\\('\\/api\\/stt', \\{ method: 'POST', headers: \\{ 'Content-Type': 'application\\/json' \\}, body: JSON\\.stringify\\(\\{ audio: b64, mime: blob\\.type, band \\}\\) \\}\\)/.test(html));",
        "    /if \\(childVoiceBlocked\\(\\)\\) return; \\/\\/ غ‑٣[\\s\\S]{0,400}?if \\(!hasValidAIConsent\\(\\)\\) return;[\\s\\S]{0,200}?if \\(!hasFounderToken\\(\\)\\) return; \\/\\/ directive 82[\\s\\S]{0,120}?callGenRef\\.current\\+\\+;/.test(callFx));",
        "  /const SR = ezSpeechEngine\\(\\);/.test(callFx)",
        "  && /const rec = ezNewRecognition\\(\\);/.test(callFx)",
        "  (callFx.match(/ezStartRecognition\\(rec\\)/g) || []).length, 2);",
        "    ['the recogniser handlers and the recogniser', /ezKillRecognizer\\(rec\\);/],",
        "ok('S1: no Vercel Web Analytics script is loaded', !/<script[^>]*_vercel\\/insights/.test(html));",
        "ok('S1: no Speed Insights script is loaded', !/<script[^>]*_vercel\\/speed-insights/.test(html));",
        "ok('S1: and no substitute analytics tool took their place',",
        "eq('S1: the page loads exactly three scripts', (html.match(/<script[^>]*src=[\"'][^\"']+[\"']/gi) || []).length, 3);",
      ];
      const AUTHORISED = [S116_REMOVED].concat(AP_REMOVED);

      // Exact set equality, both directions. An unlisted removal fails; a listed removal that
      // did not happen fails too, so this block cannot rot into a blanket permission.
      eq('exactly the authorised lines were removed from it', gone.length, AUTHORISED.length);
      eq('...and every removed line is on the authorised list',
        gone.filter((l) => AUTHORISED.indexOf(l) === -1), []);
      eq('...and every authorised removal actually happened',
        AUTHORISED.filter((l) => gone.indexOf(l) === -1), []);
      ok('...and the S116 removal is still the assertion that required the panel to exist',
        gone.indexOf(S116_REMOVED) !== -1, JSON.stringify(gone[0]));
      eq('...and every authorised removal landed its named replacement',
        AP_REQUIRED_NEW.filter((l) => after.indexOf(l) === -1), []);
      // Nothing was softened: no check downgraded to a warning, no blanket skip, and the file
      // still runs strictly more assertions than it did.
      const count = (s) => (s.match(/^\s*(ok|eq)\(/gm) || []).length;
      ok('...no assertion was turned into a warning or a skip',
        count(now) > count(was) && !/\bwarn\(/.test(now)
        && (now.match(/\bskip\(/g) || []).length === (was.match(/\bskip\(/g) || []).length,
        count(was) + ' -> ' + count(now));
      // ...and the ok()/eq() OPENING lines that went are exactly the two authorised ones.
      eq('...and no other ok()/eq() line was dropped',
        before.filter((l) => /^\s*(ok|eq)\(/.test(l) && after.indexOf(l) === -1)
              .filter((l) => AUTHORISED.indexOf(l) === -1), []);
    }
  }

  const FORBIDDEN = [
    [/^api\//, 'api/**'],
    [/^lib\/ledger\//, 'lib/ledger/**'],
    [/^lib\/(binothaimeen|attribution|ask-plan|retrieve|brave-query|source-registry|source-purpose|claim-gate|duration)\.js$/, 'the search and sourcing modules'],
    [/^data\/ledger-/, 'data/ledger-*'],
    [/^tools\//, 'tools/**'],
    // Rooted on purpose (THIS file lives in guards/), and theme-coverage-guard.cjs is excluded
    // because the block above proves what happened to it, line by line, instead of forbidding it.
    [/^(?!theme-coverage-guard\.cjs$)[^/]*guard\.cjs$/, 'the shipped guards'],
    [/^gates\.json$/, 'gates.json'],
    [/^recon-audit\.cjs$/, 'recon-audit.cjs'],
    [/^quest-data\//, 'quest-data/**'],
    [/^(quran-uthmani|quran-golden|adhkar|mushaf-layout|worship-golden|worship-display|referral-golden)\.json$/, 'scripture, adhkar and worship data'],
    [/^(manifest\.json|sw\.js)$/, 'the manifest and the service worker'],
    [/^(package\.json|package-lock\.json)$/, 'the package manifests'],
    [/^vercel\.json$/, 'the deployment config'],
    [/^(android|ios)\//, 'the native projects'],
    [/capacitor/i, 'the Capacitor config'],
  ];
  for (const [re, label] of FORBIDDEN) {
    eq(label + ' is untouched', diff.filter((f) => re.test(f)), []);
  }
  // This file is a guard by name; it is the one exception, and it ships nothing to a user.
  eq('...and the only guards in the diff are this one and the authorised one',
    diff.filter((f) => /guard\.cjs$/.test(f)
      && f !== 'guards/i18n-ui-guard.cjs' && f !== 'theme-coverage-guard.cjs'), []);

  // --- E3. the things measured by content, not by name ---
  const at = (f) => { try { return cp.execSync('git show ' + BASE + ':' + f, { cwd: REPO, encoding: 'buffer', maxBuffer: 1 << 28 }); } catch (e) { return null; } };
  const now = (f) => { try { return fs.readFileSync(path.join(REPO, f)); } catch (e) { return null; } };
  // Compared with line endings normalised, deliberately. `git show` hands back the stored blob,
  // and .gitattributes pins several of these files to a DIFFERENT ending in the working tree, so
  // a raw byte compare would report a change nobody made. What is being asserted is content.
  const norm = (b) => (b == null ? null : b.toString('utf8').replace(/\r\n/g, '\n'));
  const same = (f) => { const a = norm(at(f)), b = norm(now(f)); return a !== null && b !== null && a === b; };
  for (const f of ['quran-uthmani.json', 'adhkar.json', 'mushaf-layout.json', 'worship-golden.json',
    'quest-data/rewards.json', 'quest-data/world.json', 'quest-data/bank-integrity-golden.json',
    'manifest.json', 'sw.js', 'package.json', 'package-lock.json', 'vercel.json']) {
    ok(f + ' is, content-for-content, the file the branch started from', same(f));
  }

  // Theme 33: the token blocks, not a screenshot. CSS comments are stripped first -- the prose
  // in this stylesheet NAMES tokens while explaining them, and a scanner reads its own
  // explanation as a declaration.
  const baseHtml = norm(at('index.html')) || '';
  const nowHtml = norm(now('index.html')) || '';
  const tokenBlock = (s) => s.slice(s.indexOf(':root {'), s.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const varsOf = (s) => {
    const out = {};
    for (const m of s.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) if (!(m[1] in out)) out[m[1]] = m[2].trim();
    return out;
  };
  const vBase = varsOf(tokenBlock(baseHtml)), vNow = varsOf(tokenBlock(nowHtml));
  ok('the theme declares a real token set to compare', Object.keys(vBase).length > 40, Object.keys(vBase).length + ' tokens');
  eq('no theme token was removed', Object.keys(vBase).filter((k) => !(k in vNow)), []);
  eq('no theme token changed its value', Object.keys(vBase).filter((k) => vBase[k] !== vNow[k]), []);
  eq('...and this phase declared no new token', Object.keys(vNow).filter((k) => !(k in vBase)), []);

  // --- E4. the ledger is still off by default ---
  const flag = fs.readFileSync(path.join(REPO, 'lib', 'ledger', 'flag.js'), 'utf8');
  ok('the ledger env floor is still closed unless LEDGER_RAG is exactly "on"',
    /=== 'on'/.test(flag));
  ok('...and lib/ledger is not in the diff', diff.filter((f) => /^lib\/ledger\//.test(f)).length === 0);

  // --- E5. no secret was introduced ---
  const added = ['index.html', 'quest.html', 'guards/i18n-ui-guard.cjs']
    .filter((f) => diff.indexOf(f) !== -1)
    .map((f) => String(now(f) || '')).join('\n');
  ok('no key, token or secret appears in anything this phase wrote',
    !/(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(added));
}

/* ===================== F. THE TREASURE JOURNEY =========================== */
// quest.html is a standalone vanilla page with its own tiny layer. It is checked by reading and
// by RUNNING that layer in isolation — the page itself is driven by quest-ux-guard, in a real
// browser, and this guard does not duplicate that.
function partF() {
  console.log('\n=== F. THE TREASURE JOURNEY (quest.html) ===');
  const q = fs.readFileSync(path.join(REPO, 'quest.html'), 'utf8');

  ok('the journey reads the language the app stored', /localStorage\.getItem\('ezik_ui_lang_v1'\)/.test(q));
  // Measured with the prose stripped: the comment above the boot script EXPLAINS this rule by
  // naming navigator.language, and a scanner reads its own explanation as a use of it.
  const qCode = q.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok('...and does NOT read the device — it is proved in a real browser, which reports a real locale',
    !/navigator\s*\.\s*languages?/.test(qCode));
  ok('...and writes nothing: the choice belongs to the app',
    !/localStorage\.setItem\('ezik_ui_lang_v1'/.test(q));
  ok('the boot script sets lang, dir and the data attribute before the first paint',
    /d\.setAttribute\('lang',v\);d\.setAttribute\('dir',v==='ar'\?'rtl':'ltr'\);d\.setAttribute\('data-ez-lang',v\);/.test(q));
  ok('...inside <head>', q.indexOf("localStorage.getItem('ezik_ui_lang_v1')") < q.indexOf('</head>'));
  ok('...and the THEME boot still runs before it',
    q.indexOf("localStorage.getItem('murabbi_theme_v1')") < q.indexOf("localStorage.getItem('ezik_ui_lang_v1')"));
  ok('an unrecognised stored value falls back to ar rather than breaking the page',
    /if\(v!=='ar'&&v!=='en'\)\{v='ar';\}/.test(q));

  // The layer, run on its own. It declares no DOM dependency, so it needs no browser.
  const core = q.slice(q.indexOf('var QUEST_I18N = {'), q.indexOf('\r\n  }\r\n', q.indexOf('function qT(')) + 6);
  const sandbox = { localStorage: { getItem: () => 'en' }, Object, String, RegExp, JSON };
  vm.runInContext(core, vm.createContext(sandbox), { filename: 'quest-i18n.js' });
  const D = sandbox.QUEST_I18N || {};
  eq('the journey declares exactly ar and en', Object.keys(D).sort(), ['ar', 'en']);
  const qa = Object.keys(D.ar || {}), qe = Object.keys(D.en || {});
  ok('...with keys', qa.length > 0);
  eq('...and the two halves hold the same keys', qa.filter((k) => qe.indexOf(k) === -1).concat(qe.filter((k) => qa.indexOf(k) === -1)), []);
  eq('...no empty value on either side',
    qa.filter((k) => !String(D.ar[k]).trim() || !String(D.en[k]).trim()), []);
  const ph = (v) => (String(v).match(/\{[A-Za-z0-9_]+\}/g) || []).slice().sort();
  eq('...and every {placeholder} appears on both sides', qa.filter((k) => JSON.stringify(ph(D.ar[k])) !== JSON.stringify(ph(D.en[k]))), []);
  // Counted per HALF. Both halves declare the same keys by design, so counting across the whole
  // block would report every key as its own duplicate.
  const dup = (s) => { const l = (s.match(/^    '([^']+)':/gm) || []); return l.filter((x, i) => l.indexOf(x) !== i); };
  const qEnAt = core.indexOf('    en: {');
  eq('...and no key is declared twice in the ar half', dup(core.slice(0, qEnAt)), []);
  eq('...nor in the en half', dup(core.slice(qEnAt)), []);

  eq('the lookup substitutes a placeholder', sandbox.qT('quest.review', { n: '3' }).indexOf('3') !== -1, true);
  eq('...leaves an unsupplied one as authored', sandbox.qT('quest.review').indexOf('undefined'), -1);
  eq('...and never returns a raw key', sandbox.qT('no.such.key'), '');
  eq('...and is running in the language that was stored', sandbox.QUEST_LANG, 'en');

  // The bank, and everything else the journey must not have touched.
  ok('every control the round guard drives is routed through the lookup',
    ['quest.next', 'quest.result', 'quest.again', 'quest.review', 'quest.exit',
      'quest.prev', 'quest.backToResult'].every((k) => qa.indexOf(k) !== -1));
  ok('...and not one question, option, answer or reward rule is in the dictionary',
    qa.every((k) => k.indexOf('quest.') === 0) && qa.length < 30);
  ok('the bank is still loaded from the shipped <script id="bank"> block',
    /<script id="bank" type="application\/json">/.test(q));
  ok('...and the journey added no dependency and no new script tag',
    (q.match(/<script[^>]*src=/gi) || []).length === 0);
}

/* ===================== main ============================================== */
(async function main() {
  console.log('=== i18n-ui-guard (S116) — ' + htmlFile + ' ===');
  await partA();
  partB();
  await partC();
  await partD0();
  await partD();
  await partE();
  partF();
  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed' + (skipped ? ('  (' + skipped + ' skipped)') : '') + '.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('GUARD ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); });
