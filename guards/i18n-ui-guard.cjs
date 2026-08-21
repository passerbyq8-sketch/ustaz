// i18n-ui-guard.cjs — S116, the interface-language gate.
//
// It proves the phase the way every other guard in this repo does: by RUNNING the shipped code.
// The text/babel block is extracted from index.html, transformed with the page's own pinned Babel
// major, and evaluated inside a linkedom window against a localStorage stub and a navigator stub
// this file controls. The <head> boot script is run separately, in its own window, because that
// is where the very first language decision is actually made.
//
// It IS a gate: gates.json registers it as `i18nui`, so `npm run gates` runs it with the rest.
// The roster is gates.json and the count is however many entries that file holds -- no number is
// repeated here, because a number written into a comment goes stale the next time a gate lands.
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
//                         switch; the interface language proved to stay INSIDE the client, by
//                         scanning the server for it rather than by forbidding edits to it; and
//                         the two pages whose behaviour was just measured proved to be the two
//                         pages that are actually committed.
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
// non-gate list, and the phase that first wrote this file was allowed to edit neither. A
// directory of its own kept that rule intact without weakening it. The registration came
// later, and it is where every gate's registration belongs: gates.json.
const REPO = path.resolve(__dirname, '..');
const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(path.join(REPO, htmlFile), 'utf8');

// There was a BASE commit id pinned here, and part E measured every "unchanged" assertion
// against it. It is gone, with its reasoning recorded at part E2: a fixed commit cannot anchor
// a permanent claim, and this one had drifted 52 commits behind HEAD and past its own
// description. Nothing in this file names a commit any more.

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
// A skipped check is NOT a check. It used to increment `checks`, which is how the last line came
// to read "OK: 232/232 checks passed" on a machine where a whole section had not run.
function skip(name, why) { skipped++; console.log('  SKIP  ' + name + '  (' + why + ')'); }
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
  // ITEM 106. THE ANCHORS ARE REQUIRED BEFORE THE REGION IS SEARCHED. This cut used to run
  // straight off two indexOf calls: move either anchor and indexOf returns -1, slice(-1, n)
  // returns an EMPTY STRING, and both negative checks below are satisfied by emptiness. The
  // two assertions passed at their loudest while reading nothing at all.
  const i18nAt = rawCode.indexOf('const EZ_LANG_KEY');
  const i18nEnd = rawCode.indexOf('function EzLangControl');
  const i18nBlock = (i18nAt !== -1 && i18nEnd > i18nAt) ? rawCode.slice(i18nAt, i18nEnd) : '';
  ok('the language layer was LOCATED before it was searched', i18nBlock.length > 200,
    'const EZ_LANG_KEY@' + i18nAt + '  function EzLangControl@' + i18nEnd);
  ok('the language layer makes no network call',
    i18nBlock.length > 0
    && !/\bfetch\s*\(|XMLHttpRequest|import\s*\(|EventSource|navigator\.sendBeacon/.test(i18nBlock));
  ok('...and no dictionary is loaded from a URL',
    i18nBlock.length > 0 && !/https?:\/\//.test(i18nBlock));
  // Five devDependencies, not four: @babel/parser was declared (D35) because classifier-guard.cjs
  // requires it directly and had been resolving on @babel/core's transitive copy. The count stays
  // exact, so a sanctioned declaration cannot become cover for an unsanctioned addition.
  ok('...and no dependency was added',
    (() => {
      const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
      return Object.keys(pkg.dependencies || {}).length === 5 && Object.keys(pkg.devDependencies || {}).length === 5;
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
  // ITEM 106, THIRD SHAPE: a negative check wearing a COUNT. `(layer.match(/navigator/g) || []).length
  // === 0` is satisfied by an empty region exactly as `!/navigator/.test(layer)` would be, and it
  // reads like a measurement rather than an absence check -- which is why the first sweep for
  // this defect, written around `=== -1` and `!test`, walked straight past it.
  const layerAt = rawCode.indexOf('const EZ_LANG_KEY');
  const layerEnd = rawCode.indexOf('function EzLangControl');
  const layer = (layerAt !== -1 && layerEnd > layerAt) ? rawCode.slice(layerAt, layerEnd) : '';
  ok('the language module was LOCATED before it was counted', layer.length > 200,
    'const EZ_LANG_KEY@' + layerAt + '  function EzLangControl@' + layerEnd);
  eq('the language module names navigator nowhere',
    layer.length > 0 ? (layer.match(/navigator/g) || []).length : -1, 0);
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
  // ITEM 106: a ONE-ARGUMENT slice at a missing anchor is slice(-1), which returns the last
  // CHARACTER of the stylesheet -- one byte that satisfies every negative check below exactly
  // as an empty string would, and reads like a found region to anyone scanning the source.
  const langCssAt = css.indexOf('.ezlang-wrap{');
  const langCss = langCssAt === -1 ? '' : css.slice(langCssAt);
  ok('the language CSS was LOCATED before it was searched', langCss.length > 100,
    '.ezlang-wrap{@' + langCssAt + '  len=' + langCss.length);
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
    langCss.length > 0 && !/#[0-9a-fA-F]{3,8}\b/.test(langCss.replace(/rgba\(0,0,0,[0-9.]+\)/g, '')));
  ok('...and names no bare element or universal selector',
    langCss.length > 0 && !/(^|\})\s*(\*|div|button|span|body|input)\s*\{/.test(langCss));
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
      // S118: the daily verse left this grid for the top bar, so it is measured THERE. The
      // assertion is not weakened, it is moved with the thing it names: the verse must still be
      // on the screen, drawn exactly once, and it must no longer be a cell of the mosaic.
      ok('...and the four modules are all still in it',
        ['memorize', 'adhkar', 'mushaf', 'treasure']
          .every((id) => !!mosaic.querySelector('[data-ezik-home-module="' + id + '"]')),
        String(kids.length) + ' children');
      eq('...and the daily verse is NOT one of its cells any more', mosaic.querySelectorAll('.ezist-quran').length, 0);
      eq('...it is in the top bar, drawn exactly once on the screen', d.all('.ezist-quran').length, 1);
      ok('...and the bar is where it is', !!d.all('.ezist-nav .ezist-quran')[0]);
    }
    // S118 -- THE BAR HOLDS TWO ELEMENTS AND NO THIRD, and this drives the one that is a
    // control. It used to look for the chat icon by the accessible name «عزك»; that icon, the
    // home button, the settings button, the profile button and the centred brand were all
    // removed from the bar in the same commit, and their four actions moved into the menu the
    // button below opens. Each is walked to its destination further down this part, so nothing
    // is asserted to exist that is not also proved to WORK.
    eq('the top bar carries exactly two elements', d.all('.ezist-nav-inner')[0].children.length, 2);
    eq('...and exactly one of them is a control', d.all('.ezist-nav button').length, 1);
    eq('...the daily verse being the other, and a display: no role', d.all('.ezist-nav .ezist-quran')[0].getAttribute('role'), null);
    eq('...no tabindex', d.all('.ezist-nav .ezist-quran')[0].getAttribute('tabindex'), null);
    eq('...and nothing clickable inside it', d.all('.ezist-nav .ezist-quran button, .ezist-nav .ezist-quran a').length, 0);
    eq('the four controls the bar used to carry are gone from it',
      d.all('.ezist-nav button').filter((b) => ['عزك', 'الرئيسية', 'الإعدادات', 'الحساب']
        .indexOf(String(b.getAttribute('aria-label') || '')) !== -1).length, 0);
    const navMenu = d.all('.ezist-nav button')[0];
    if (ok('the top nav carries the menu button', !!navMenu)) {
      eq('...as a type="button"', navMenu.getAttribute('type'), 'button');
      eq('...named «القائمة»', navMenu.getAttribute('aria-label'), 'القائمة');
      ok('...drawn as an icon, with no text of its own', !String(navMenu.textContent || '').trim() && !!navMenu.querySelector('svg'));
      const before = { chats: c.store.getItem('ezik_chats_v1'), net: c.net().length };
      await d.click(navMenu);
      await tick(180);
      // THE CHAT'S OWN DRAWER, not a second one built for the home.
      eq('...and pressing it opens the menu', d.all('.ezc-drawer').length, 1);
      eq('...exactly one panel, not a parallel drawer', d.all('.ezc-drawer').length + d.all('.ezc-drawer-ov').length, 2);
      eq('...without filing a conversation', c.store.getItem('ezik_chats_v1'), before.chats);
      eq('...and without a request', c.net().length, before.net);
      // and the menu carries the two entries the bar used to hold as icons
      ok('...the menu offers the home entry the bar used to carry',
        !!d.all('.ezc-drawer button').filter((b) => String(b.textContent || '').trim() === 'القائمة')[0]);
      ok('...and the settings/account entry, by the name it always had',
        !!d.all('.ezc-drawer button').filter((b) => String(b.getAttribute('aria-label') || '').indexOf('الإعدادات') === 0)[0]);
      // close it again, so the rest of this part starts where it used to
      await d.click(d.all('.ezc-drawer-ov')[0]);
      await tick(140);
    }
    ok('...and the panel is gone from the source too, not merely unmounted',
      rawCode.indexOf('EzistAsk') === -1 && rawCode.indexOf('ezist-ask') === -1
      && rawCode.indexOf('EZIST_ASK_TITLE') === -1);
    // ...and the words themselves are still where they are needed. The menu writes them as
    // \\uXXXX escapes, so the source is read decoded — a raw search would find nothing and call
    // that a pass.
    const decoded = rawCode.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    // S118: the menu is no longer written inside the chat's return -- it is one function above
    // the screen ladder, called by the chat AND by the home, so it is sliced from that.
    const drawerAt = decoded.indexOf('const ezikDrawer = () => drawerOpen && (');
    const drawerSrc = drawerAt === -1 ? '' : decoded.slice(drawerAt, decoded.indexOf('// S115: the boot mark', drawerAt));
    ok('the menu source was located', drawerSrc.length > 3000, 'len=' + drawerSrc.length);
    // S118: the handler changed by exactly one thing and it is named here. It was
    // closeDrawerWith(newChat), and newChat only RESETS the thread -- which was enough while
    // this menu could be opened from the chat and from nowhere else. The home opens the same
    // menu now, so the row had to land on the chat as well as reset it, or it would be a control
    // that silently does nothing. newChat itself is untouched and is still what does the reset.
    ok('the side menu still offers «a new conversation», on the app\'s one new-chat handler',
      /onClick=\{\(\) => closeDrawerWith\(startChatFromMenu\)\}/.test(drawerSrc)
      && /const startChatFromMenu = \(\) => \{ newChat\(\); setScreen\('chat'\); \};/.test(decoded)
      && /const newChat = \(\) => \{ resetThread\(\); \};/.test(decoded)
      && drawerSrc.indexOf('محادثة جديدة') !== -1);
    // Reached the way a reader reaches it NOW: home -> the bar's menu button -> the row.
    // Driven by the selector, never by an index into the bar's children.
    await d.click(d.all('.ezist-nav button')[0]);
    await tick(160);
    if (ok('...the menu is reachable from the home', d.all('.ezc-drawer').length === 1)) {
      const newChat = d.all('.ezc-drawer button').filter((b) => /محادثة جديدة|New conversation/.test(String(b.textContent || '')))[0];
      if (ok('...and the entry is really on the screen', !!newChat, d.text().slice(0, 60))) {
        await d.click(newChat);
        await tick(200);
        ok('...and pressing it lands on a chat, FROM THE HOME', d.all('.ezc-dock').length === 1);
        eq('...on an empty one', d.all('.ezc-turn').length, 0);
      }
    }
    // ...and back to the home, because the settings step below starts there.
    await d.click(d.all('.ezc-rail button.ezc-icon')[0]);
    await tick(120);
    const back = d.all('button').filter((b) => String(b.textContent || '').trim() === 'القائمة')[0];
    if (back) { await d.click(back); await tick(160); }
    ok('the home is reachable again', d.all('.ezist-nav').length === 1);
  }

  // Settings, through the app's own route. S118: that route is no longer an icon in the top
  // bar, so this no longer indexes into the bar's children -- `[3] || [2]` was a guess about
  // an arrangement, and it would have gone on passing against whatever button happened to land
  // at that position. The bar's ONE button opens the menu, and the menu's settings row is found
  // by the accessible name it has carried since D88.
  await d.click(d.all('.ezist-nav button')[0]);
  await tick(160);
  const setRow = d.all('.ezc-drawer button').filter((b) => String(b.getAttribute('aria-label') || '').indexOf('الإعدادات') === 0)[0];
  if (!ok('the menu carries the settings entry', !!setRow, d.text().slice(0, 80))) throw new Error('no settings row');
  await d.click(setRow);
  await tick(160);
  ok('settings was reached', d.all('.ezsh-group').length > 0, d.text().slice(0, 80));
  eq('...and THIS is where the control lives — exactly one', toggles(), 1);
  const st = d.all('button[data-ez-lang-toggle]')[0];
  ok('...inside a settings group, not floating', !!(st.closest && st.closest('.ezsh-group')));
  eq('...as a type="button"', st.getAttribute('type'), 'button');
  eq('...showing the current choice', String(st.textContent || '').trim().replace(/[\u25BE\s]+$/, ''), S.AR);

  // It is ONE compact row, not a pair of full-width buttons.
  // ITEM 106: same two-anchor cut, same empty string, and the negative check below is the
  // only one of the three assertions on `set` that emptiness would have satisfied.
  const setAt = html.indexOf('function SettingsSheet');
  const setEnd = html.indexOf('function ParentDashboard');
  const set = (setAt !== -1 && setEnd > setAt) ? html.slice(setAt, setEnd) : '';
  ok('SettingsSheet was LOCATED before it was searched', set.length > 200,
    'function SettingsSheet@' + setAt + '  function ParentDashboard@' + setEnd);
  ok('the settings entry is one compact row', /<div className="ezlang-row"><EzLangControl variant="settings" \/><\/div>/.test(set));
  ok('...inside the shell every other setting uses', /<EzShellGroup title=\{ezT\('settings\.language'\)\}>/.test(set));
  ok('...and it is no longer a radiogroup of full-width buttons',
    set.length > 0 && !/data-ez-lang-opt/.test(set));
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
  console.log('\n=== E. THE BLAST RADIUS ===');

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

  // --- E2. the language never leaves the client ---
  //
  // WHAT STOOD HERE, AND WHY IT DOES NOT ANY MORE.
  //
  // This section used to run `git diff --name-only <BASE>` against a commit id written into the
  // source of this file, and assert that api/**, lib/ledger/**, tools/**, gates.json,
  // recon-audit.cjs, the package manifests, the scripture data and the shipped guards were all
  // "untouched". Those are statements about ONE PHASE's diff. They can only be true for the
  // length of that phase; from the next commit onward they are false BY CONSTRUCTION -- not
  // because anything regressed, but because time passed.
  //
  // Measured, not assumed. The pin was 27112875 (2026-08-04). Fifty-two commits later it failed
  // ELEVEN of its own assertions, and every one of the eleven named work that had been authored,
  // gated and merged on purpose: api/** by D01/D02a/D05, lib/ledger/** and the sourcing modules
  // by the ledger batches, tools/** by the Apple-privacy phase, gates.json and recon-audit.cjs by
  // D14 -- fourteen commits between them. Not one was a regression.
  //
  // The pin had also stopped being what its own comment called it. "The commit this branch
  // started from" is `git merge-base main HEAD`, and main has since absorbed 27112875 entirely;
  // the real merge-base is a different commit. Re-anchoring there fixes nothing -- thirty-six of
  // the same files sit in that diff too. The defect was never which commit was named. It was the
  // QUESTION: a guard whose answer has to become "no" is not measuring a regression, it is
  // measuring the calendar. And because the whole block hung on git, a machine without git
  // turned all of it into a single SKIP and the last line still read "OK: n/n checks passed".
  //
  // So each expired scope seal is replaced by the permanent property it was standing in for --
  // true at every HEAD, false only on a real defect.
  //
  // The fear behind "the server is untouched" was that the interface language would leak out of
  // the client and start being decided, stored or translated on the server. Said that way, it is
  // checkable forever, and it needs no git at all.
  const SCAN_EXT = /\.(js|cjs|mjs|html)$/;
  const walk = (rel, out) => {
    let entries;
    try { entries = fs.readdirSync(path.join(REPO, rel), { withFileTypes: true }); } catch (e) { return out; }
    for (const e of entries) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(r, out); }
      else if (SCAN_EXT.test(e.name)) out.push(r);
    }
    return out;
  };
  const slurp = (f) => { try { return fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return ''; } };

  const serverTree = ['api', 'lib'].reduce((acc, d) => walk(d, acc), []);
  const scanned = ['api', 'lib', 'tools', 'guards'].reduce((acc, d) => walk(d, acc), [])
    .concat(fs.readdirSync(REPO).filter((f) => SCAN_EXT.test(f)));
  ok('the leak scan reached a real corpus', scanned.length > 50 && serverTree.length > 20,
    scanned.length + ' files scanned, ' + serverTree.length + ' of them server-side');

  // Exact set equality, both directions -- the same discipline the authorisation block used, kept.
  // A new file naming the key fails; and if one of the three stops naming it, that fails too,
  // so this cannot rot into a check that passes because it stopped finding anything.
  eq('the interface-language key is named by exactly the two pages and this guard',
    scanned.filter((f) => slurp(f).indexOf(S.LANG_KEY) !== -1).sort(),
    ['guards/i18n-ui-guard.cjs', 'index.html', 'quest.html']);
  eq('...and no server module reads the device language',
    serverTree.filter((f) => /navigator\s*\.\s*languages?/.test(slurp(f))), []);
  eq('...and no server module carries an interface dictionary',
    serverTree.filter((f) => /\bUI_STRINGS\b|\bQUEST_I18N\b/.test(slurp(f))), []);

  // The theme, as a property of the page rather than as a diff against a dead commit. What the
  // old seal wanted was "this phase changed no colour"; what is true forever is that the token
  // set is complete -- every token the stylesheet USES is one the stylesheet DECLARES. A removed
  // or renamed token is exactly what that catches, and it catches it at any HEAD.
  const nowHtml = html.replace(/\r\n/g, '\n');
  const tokenBlock = nowHtml.slice(nowHtml.indexOf(':root {'), nowHtml.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const declaredTokens = {};
  for (const m of tokenBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) {
    if (!(m[1] in declaredTokens)) declaredTokens[m[1]] = m[2].trim();
  }
  const usedTokens = [...new Set([...tokenBlock.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))];
  ok('the theme declares a real token set', Object.keys(declaredTokens).length > 40,
    Object.keys(declaredTokens).length + ' tokens declared, ' + usedTokens.length + ' used');
  eq('every theme token the stylesheet uses is one it declares',
    usedTokens.filter((t) => !(t in declaredTokens)), []);

  // The theme GATE, not the theme. theme-coverage-guard.cjs sat on the old allow-list under a
  // narrow, literal authorisation: a named list of exact lines could leave it and nothing else.
  // That authorisation is spent -- the lines went, the phase closed, main absorbed it, and the
  // block that policed it could only ever fire against the dead pin. What it was really guarding
  // is that the gate did not get SOFTENED while the permission was open, and THAT survives as a
  // property of the file itself: no warning, no skip, and a full board still standing.
  const tcg = slurp('theme-coverage-guard.cjs');
  const tcgAssertions = (tcg.match(/^\s*(ok|eq)\(/gm) || []).length;
  ok('the theme gate still runs a full board of assertions', tcgAssertions >= 780, tcgAssertions + ' assertions');
  ok('...and none of them was downgraded to a warning', tcg !== '' && !/\bwarn\(/.test(tcg));
  ok('...and none of them was downgraded to a skip', tcg !== '' && !/\bskip\(/.test(tcg));

  // --- E3. what was proved is what is committed ---
  // The behaviour asserted above was measured by RUNNING these pages off the disk. If they carry
  // uncommitted edits then the proof is about a working copy while the repository holds something
  // else, and the run is worth less than it looks. This is the same discipline attribution-guard
  // already applies to the same two files, and it is ALL that part E still needs git for.
  //
  // These are the git-dependent checks. When git is absent they are SKIPPED BY NAME and counted,
  // and the last line of this guard reports that count instead of folding it into the total.
  const GIT_DEPENDENT = [
    [htmlFile, 'the page whose behaviour was just measured has no uncommitted edit'],
    ['quest.html', '...and neither has the journey page'],
  ];
  const pending = (() => {
    try {
      return cp.execSync('git status --porcelain', { cwd: REPO, encoding: 'utf8' })
        .split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean)
        .map((p) => p.replace(/^"|"$/g, '').split(' -> ').pop());
    } catch (e) { return null; }
  })();
  for (const [file, name] of GIT_DEPENDENT) {
    if (pending === null) { skip(name, 'git unavailable'); continue; }
    ok(name, pending.indexOf(file) === -1, 'uncommitted: ' + JSON.stringify(pending.filter((f) => f === file)));
  }

  // --- E4. the ledger is still off by default ---
  const flag = slurp('lib/ledger/flag.js');
  ok('the ledger env floor is still closed unless LEDGER_RAG is exactly "on"',
    /=== 'on'/.test(flag));

  // --- E5. no secret was introduced ---
  // Unconditional now. This used to scan only the files git reported as changed, so on a machine
  // without git -- and on any run where the diff came back empty -- it scanned nothing at all and
  // still passed.
  const surface = ['index.html', 'quest.html', 'guards/i18n-ui-guard.cjs'].map(slurp).join('\n');
  ok('the secret scan actually has something to read', surface.length > 10000, surface.length + ' chars');
  ok('no key, token or secret appears in the pages this phase owns',
    !/(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(surface));
}

/* ===================== F. WORSHIP SPEECH FAILURE ========================= */
// F-125. These cases execute the shipped loadWorship -> resolveWorshipTags -> formatForTTS
// pipeline with a local fetch double. The model's raw tag body must never be the fallback, and a
// failed canonical-data load must remain audible in the language the reader selected.
async function partWorshipFailure() {
  console.log('\n=== F. WORSHIP SPEECH FAILURE (F-125) ===');

  const run = async (lang, fetchDouble, band) => {
    const c = buildContext({ seed: { [S.LANG_KEY]: lang } });
    c.window.fetch = fetchDouble;
    const resolve = c.grab('resolveWorshipTags');
    const speak = c.grab('formatForTTS');
    const fallback = c.grab("ezT('errors.generic')");
    const raw = 'before <worship id="fixture">MODEL RAW MARKUP</worship> after';
    const resolved = await resolve(raw, band || 'adult');
    return { fallback, raw, resolved, spoken: speak(resolved).trim() };
  };
  const rejectedFetch = async () => { throw new Error('local worship loader rejection'); };
  const malformedFetch = async () => ({ ok: true, json: async () => ({ cells: [] }) });
  const missingFetch = async () => ({ ok: true, json: async () => ({ cells: {} }) });

  for (const lang of ['ar', 'en']) {
    const r = await run(lang, rejectedFetch);
    ok('loader rejection is audible in ' + lang,
      r.spoken.includes(r.fallback) && r.spoken.length > 0,
      JSON.stringify({ fallback: r.fallback, resolved: r.resolved, spoken: r.spoken }));
    ok('loader rejection exposes no raw worship markup in ' + lang,
      !/<\/?worship\b/i.test(r.resolved) && !/MODEL RAW MARKUP/.test(r.resolved), r.resolved);
  }

  const malformed = await run('ar', malformedFetch);
  ok('malformed worship data uses the existing localized failure state',
    malformed.spoken.includes(malformed.fallback) && malformed.spoken.length > 0,
    JSON.stringify(malformed));
  const missing = await run('en', missingFetch);
  ok('a missing worship key uses the existing localized failure state',
    missing.spoken.includes(missing.fallback) && missing.spoken.length > 0,
    JSON.stringify(missing));

  const goldenText = 'GOLDEN  BYTES\nNEXT';
  const success = await run('en', async () => ({
    ok: true,
    json: async () => ({ cells: { 'fixture:adult': { text: goldenText } } }),
  }));
  eq('the current successful worship replacement stays byte-for-byte identical',
    success.resolved, 'before  ' + goldenText + '  after');
  ok('the successful path also exposes neither raw markup nor an empty utterance',
    success.spoken.length > 0 && !/<\/?worship\b/i.test(success.resolved)
      && !/MODEL RAW MARKUP/.test(success.resolved), JSON.stringify(success));
}

/* ===================== G. THE TREASURE JOURNEY =========================== */
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

  // The layer, run on its own. It declares no DOM dependency, so it needs no browser. Extract
  // by JavaScript landmarks rather than one checkout's newline bytes: the previous CRLF-only
  // terminator returned an empty program when Git materialised this protected page with LF.
  const extractCore = (source) => {
    const start = source.indexOf('var QUEST_I18N = {');
    const lookup = source.indexOf('function qT(', start);
    const nextModule = source.indexOf('/* ==========================================================', lookup);
    if (start < 0 || lookup < 0 || nextModule < 0) throw new Error('quest i18n extraction landmark moved');
    return source.slice(start, nextModule);
  };
  const evaluateCore = (source) => {
    const extracted = extractCore(source);
    const context = { localStorage: { getItem: () => 'en' }, Object, String, RegExp, JSON };
    vm.runInContext(extracted, vm.createContext(context), { filename: 'quest-i18n.js' });
    return { extracted, context };
  };
  const evaluated = evaluateCore(q);
  const core = evaluated.extracted;
  const sandbox = evaluated.context;
  const lfEvaluation = evaluateCore(q.replace(/\r\n?/g, '\n')).context;
  const crlfEvaluation = evaluateCore(q.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n')).context;
  eq('the same real dictionary executes under LF and CRLF checkout bytes',
    [Object.keys(lfEvaluation.QUEST_I18N), Object.keys(crlfEvaluation.QUEST_I18N)],
    [['ar', 'en'], ['ar', 'en']]);
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

  const languageMutantSource = q.replace('\n    en: {', '\n    zz: {');
  if (languageMutantSource === q) throw new Error('quest language mutation seam moved');
  const languageMutant = evaluateCore(languageMutantSource).context.QUEST_I18N;
  ok('MUTANT killed: renaming the English dictionary fails the exact language roster',
    JSON.stringify(Object.keys(D).sort()) === JSON.stringify(['ar', 'en'])
      && JSON.stringify(Object.keys(languageMutant).sort()) !== JSON.stringify(['ar', 'en']));
  const fallbackMutantSource = q.replace("if (typeof out !== 'string') return '';",
    "if (typeof out !== 'string') return k; // mutant: expose the untranslated key");
  if (fallbackMutantSource === q) throw new Error('quest lookup mutation seam moved');
  const fallbackMutant = evaluateCore(fallbackMutantSource).context;
  ok('MUTANT killed: returning a missing raw key violates the shipped empty fallback',
    sandbox.qT('no.such.key') === '' && fallbackMutant.qT('no.such.key') === 'no.such.key');

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
  await partWorshipFailure();
  partF();
  console.log('');
  // The skipped count is stated on its own and never folded into the total. A run that could not
  // reach git covered fewer things than a run that could, and the last line has to say so: the
  // old line reported "OK: n/n checks passed" while a whole section had been skipped wholesale.
  const tail = skipped
    ? '  —  ' + skipped + ' check(s) SKIPPED and therefore NOT covered by this run.'
    : '';
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed.' + tail);
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.' + tail);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('GUARD ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(1); });
