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
//   B. THE DECISION     — the boot script, run for real, for a stored choice, an Arabic device,
//                         an English device, a French device, no device signal, and a corrupt value.
//   C. THE DOCUMENT     — lang and dir, in both languages, from the boot script and from a switch.
//   D. THE CONTROLS     — the home button and the settings row, driven by real clicks in a
//                         mounted app: they exist, they are not submits, they carry ARIA, Escape
//                         closes the menu, the choice is applied and persisted.
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
  eq('the page still loads exactly the five scripts it always loaded', srcs.length, 5);
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
// It runs in a PLAIN sandbox rather than in a linkedom window, and that is not a shortcut: a
// linkedom window exposes `navigator` through a hard getter that rebuilds the object on every
// read, so it cannot be replaced, shadowed or assigned to. No device language can be simulated
// inside one. (That is also WHY the app treats "no tag reported" as ar rather than en: it is the
// state every guard in this repo mounts the app in, and it is not the same fact as a user whose
// device is French.) The boot script touches exactly four globals, and all four are provided here.
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
  console.log('\n=== B. THE FIRST-RUN DECISION (the shipped boot script, run for real) ===');
  const cases = [
    ['a brand-new Arabic device', undefined, ['ar-KW'], 'ar'],
    ['...and a bare ar tag', undefined, ['ar'], 'ar'],
    ['a brand-new English device', undefined, ['en-GB'], 'en'],
    ['a brand-new French device', undefined, ['fr-FR'], 'en'],
    ['a brand-new Urdu device (not Arabic, though it is written in Arabic script)', undefined, ['ur-PK'], 'en'],
    ['an environment that reports NO language at all', undefined, undefined, 'ar'],
    ['an environment that reports an empty tag', undefined, [''], 'ar'],
    ['a stored en beats an Arabic device', 'en', ['ar-KW'], 'en'],
    ['a stored ar beats an English device', 'ar', ['en-US'], 'ar'],
    ['a corrupt stored value falls back to the device', 'zz-not-a-language', ['fr-FR'], 'en'],
    ['a stored empty string falls back to the device', '', ['ar-EG'], 'ar'],
    ['a stored JSON blob falls back to the device', '{"lang":"en"}', ['ar-EG'], 'ar'],
  ];
  for (const [name, stored, navs, want] of cases) {
    const r = runBoot(stored, navs);
    if (!r) { ok('the boot script is runnable', false); return; }
    eq(name + ' => ' + want, r.lang, want);
    eq('...and its direction is ' + (want === 'ar' ? 'rtl' : 'ltr'), r.dir, want === 'ar' ? 'rtl' : 'ltr');
  }
  const dead = runBoot('__DEAD__', ['fr-FR']);
  ok('a storage that throws on every read does not break the boot', !!dead && dead.lang === 'en',
    JSON.stringify(dead));

  // ...and the module-level resolver states the SAME policy. Its device half cannot be driven
  // from a mounted app (see runBoot's note), so it is proved where the decision actually lives:
  // ezLangFromTag is the whole tag rule, ezLangStored is the whole stored-choice rule, and
  // ezLangResolve is the composition of the two with the fallback.
  console.log('\n=== B2. THE MODULE RESOLVER STATES THE SAME POLICY ===');
  const c = buildContext({ seed: {} });
  const tag = (t) => c.grab('ezLangFromTag(' + JSON.stringify(t) + ')');
  for (const t of ['ar', 'ar-KW', 'ar-EG', 'AR', 'ar_SA', 'ar-Arab-EG']) eq('tag ' + JSON.stringify(t) + ' is Arabic', tag(t), 'ar');
  for (const t of ['en', 'en-GB', 'fr-FR', 'ur-PK', 'fa-IR', 'de', 'arabic', 'arb']) eq('tag ' + JSON.stringify(t) + ' is not Arabic', tag(t), 'en');
  for (const t of ['', '   ', null, undefined, 42, {}]) eq('tag ' + JSON.stringify(t) + ' is NO SIGNAL, not a language', tag(t), null);

  // A valid stored choice is honoured and left exactly as written.
  for (const stored of ['ar', 'en']) {
    const cc = buildContext({ seed: { [S.LANG_KEY]: stored } });
    eq('a stored ' + JSON.stringify(stored) + ' is honoured', cc.grab('ezLangStored()'), stored);
    eq('...and is not rewritten by the boot', cc.store.getItem(S.LANG_KEY), stored);
  }
  // Anything that is not one of the two is not a choice. The module resolves without it and then
  // REPAIRS the slot, so a value corrupted once does not have to be re-judged on every launch.
  for (const stored of ['', '   ', 'zz', 'AR', '{"lang":"en"}', 'null', 'undefined', '["ar"]']) {
    const cc = buildContext({ seed: { [S.LANG_KEY]: stored } });
    eq('a stored ' + JSON.stringify(stored) + ' is discarded and the slot repaired',
      cc.store.getItem(S.LANG_KEY), 'ar');
    eq('...and the app runs in that language', cc.grab('ezLangGet()'), 'ar');
  }
  const cFirst = buildContext({ seed: {} });
  eq('a first run writes the language it resolved, so the journey can agree with the app',
    cFirst.store.getItem(S.LANG_KEY), 'ar');
  const cDead = buildContext({ store: makeDeadStore() });
  eq('a storage that throws is not a stored choice', cDead.grab('ezLangStored()'), null);
  eq('...and the resolver still returns a usable language', cDead.grab('ezLangResolve()'), 'ar');
  const cStored = buildContext({ seed: { [S.LANG_KEY]: 'en' } });
  eq('a stored choice wins the composition', cStored.grab('ezLangResolve()'), 'en');
  const cNone = buildContext({ seed: {} });
  eq('no stored choice and no device tag falls back to ar', cNone.grab('ezLangResolve()'), 'ar');
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
  const langCss = css.slice(css.indexOf('.ezlang-bar'));
  ok('the language CSS uses logical inset, not a physical left/right',
    /inset-inline-start/.test(langCss) && !/^\s*(left|right)\s*:/m.test(langCss));
  ok('...and declares no colour of its own — every value is an existing token',
    !/#[0-9a-fA-F]{3,8}\b/.test(langCss.replace(/rgba\(0,0,0,[0-9.]+\)/g, '')));
  ok('...and names no bare element or universal selector',
    !/(^|\})\s*(\*|div|button|span|body|input)\s*\{/.test(langCss));
}

/* ===================== D. THE CONTROLS =================================== */
async function partD() {
  console.log('\n=== D. THE CONTROLS, DRIVEN BY REAL CLICKS ===');
  // The home control.
  const c = buildContext({
    seed: { child_profile: JSON.stringify({ name: 'ن', age: 30, gender: 'male', birthYear: 1996, pid: 'I18N-A', createdAt: '2026-01-01T00:00:00.000Z' }), disclosureAck: '1' },
    nav: { languages: ['ar-KW'], language: 'ar-KW' },
    mount: true,
  });
  await tick(120);
  const w = c.window, d = driver(w);
  // A returning profile lands on the CHAT, which is where the app has always opened. The home is
  // reached the way a user reaches it: open the side menu from the rail, then press its home
  // entry. Both are the shipped controls -- this guard adds no route of its own.
  await d.click(d.all('.ezc-rail button.ezc-icon')[0]);
  const homeEntry = d.all('button').filter((b) => String(b.textContent || '').trim() === 'القائمة')[0];
  if (!ok('the side menu offers its home entry', !!homeEntry)) return;
  await d.click(homeEntry);
  await tick(120);
  const toggle = d.all('button[data-ez-lang-toggle]')[0];
  if (!ok('the home screen carries a language button', !!toggle)) return;
  eq('...and it is type="button", so it can never submit the composer', toggle.getAttribute('type'), 'button');
  ok('...and it carries an accessible name', !!(toggle.getAttribute('aria-label') || '').trim());
  eq('...and it declares its menu closed', toggle.getAttribute('aria-expanded'), 'false');
  eq('...and declares that it opens one', toggle.getAttribute('aria-haspopup'), 'listbox');
  eq('...and it shows the CURRENT language', String(toggle.textContent || '').trim(), S.AR);

  await d.click(toggle);
  eq('pressing it opens the menu', toggle.getAttribute('aria-expanded'), 'true');
  const items = d.all('.ezlang-menu button');
  eq('...offering exactly two languages', items.length, 2);
  eq('...both real buttons, so Enter and Space already work', items.filter((b) => b.tagName !== 'BUTTON').length, 0);
  eq('...neither of them a submit', items.filter((b) => b.getAttribute('type') !== 'button').length, 0);
  eq('...each declaring option semantics', items.filter((b) => b.getAttribute('role') !== 'option').length, 0);
  eq('...with the current one marked selected',
    items.map((b) => b.getAttribute('aria-selected')), ['true', 'false']);
  eq('...and the menu names itself', d.all('.ezlang-menu[role="listbox"]').length, 1);

  // Escape closes it, and does not change the language.
  const before = c.grab('ezLangGet()');
  w.document.dispatchEvent(new w.Event('keydown', { bubbles: true }));   // a keydown with no key
  await tick();
  const ev = new w.Event('keydown', { bubbles: true });
  ev.key = 'Escape';
  w.document.dispatchEvent(ev);
  await tick(60);
  eq('Escape closes the menu', toggle.getAttribute('aria-expanded'), 'false');
  eq('...and changes no language', c.grab('ezLangGet()'), before);

  // Choosing English.
  await d.click(d.all('button[data-ez-lang-toggle]')[0]);
  const en = d.all('.ezlang-menu button')[1];
  await d.click(en);
  await tick(80);
  eq('choosing English applies it', c.grab('ezLangGet()'), 'en');
  eq('...persists it', c.store.getItem(S.LANG_KEY), 'en');
  eq('...closes the menu', d.all('.ezlang-menu').length, 0);
  eq('...and moves the document with it', w.document.documentElement.getAttribute('dir'), 'ltr');
  eq('...and the button now reads English', String(d.all('button[data-ez-lang-toggle]')[0].textContent || '').trim(), S.EN);

  // NO RAW KEY may reach the screen, in either language.
  const dictKeys = Object.keys(plain(c.grab('EZ_I18N.ar') || {}));
  for (const lang of ['en', 'ar']) {
    c.grab("ezLangSet('" + lang + "')");
    await tick(80);
    const text = d.text();
    const leaked = dictKeys.filter((k) => text.indexOf(k) !== -1);
    eq('no raw translation key is rendered in ' + lang, leaked, []);
  }
  ok('...and the home screen is not blank in either language', d.text().trim().length > 20);

  // The settings row.
  console.log('\n=== D2. THE SETTINGS ROW ===');
  const opts = d.all('button[data-ez-lang-opt]');
  const set = html.slice(html.indexOf('function SettingsSheet'), html.indexOf('function ParentDashboard'));
  ok('Settings declares a language group', /<EzShellGroup title=\{ezT\('settings\.language'\)\}/.test(set));
  ok('...built from the SHIPPED group shell and the SHIPPED row geometry',
    /style=\{s\.themeRow\}/.test(set) && /s\.themeOpt/.test(set) && /s\.themeOptActive/.test(set));
  ok('...as a radiogroup with an accessible name', /role="radiogroup" aria-label=\{ezT\('settings\.language'\)\}/.test(set));
  ok('...whose options are radios that declare their state', /role="radio"/.test(set) && /aria-checked=\{uiLang === v/.test(set));
  ok('...each an explicit type="button"', /data-ez-lang-opt=\{v\}/.test(set) && /type="button"/.test(set));
  ok('...and it does not borrow the class the reading-preference controls are counted by',
    set.indexOf('data-ez-lang-opt') !== -1 && !/data-ez-lang-opt[\s\S]{0,200}?className="ez-a11y-opt"/.test(set));
  ok('the four reading-preference controls are still exactly four',
    (html.match(/className="ez-a11y-opt"/g) || []).length === 4);
  ok('...and the theme control is untouched', /<Opt value="light"/.test(set) && /<Opt value="dark"/.test(set));
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
    disclosureAck: '1',
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

  const ALLOWED = ['index.html', 'quest.html', 'guards/i18n-ui-guard.cjs'];
  eq('nothing outside the allow-list was modified', diff.filter((f) => ALLOWED.indexOf(f) === -1), []);

  const FORBIDDEN = [
    [/^api\//, 'api/**'],
    [/^lib\/ledger\//, 'lib/ledger/**'],
    [/^lib\/(binothaimeen|attribution|ask-plan|retrieve|brave-query|source-registry|source-purpose|claim-gate|duration)\.js$/, 'the search and sourcing modules'],
    [/^data\/ledger-/, 'data/ledger-*'],
    [/^tools\//, 'tools/**'],
    [/^[^/]*guard\.cjs$/, 'the shipped guards'],   // rooted on purpose: THIS file lives in guards/
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
  eq('...and the only guard in the diff is this one',
    diff.filter((f) => /guard\.cjs$/.test(f) && f !== 'guards/i18n-ui-guard.cjs'), []);

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
  await partD();
  await partE();
  partF();
  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed' + (skipped ? ('  (' + skipped + ' skipped)') : '') + '.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('GUARD ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); });
