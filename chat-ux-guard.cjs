// chat-ux-guard.cjs — S98, the reply-controls gate.
//
// It proves this phase the way chat-history-guard proves the saved conversations: by RUNNING the
// shipped code. The text/babel block is extracted from index.html, transformed with the page's own
// pinned Babel major, and evaluated inside a linkedom window against a localStorage stub this file
// controls — so every function and every component under test is literally the one the browser
// runs, never a re-typed copy of it.
//
// Parts, and each answers one of the things that had to be true:
//   A. THE FOLD, AS ARITHMETIC — the pure functions: what counts as long, where the cut lands, and
//      what survives a fold (every card, always; the whole prose in the copy text).
//   B. THE BUBBLE, RENDERED    — a real conversation in a real mounted app: the short reply grows
//      no toggle, the long one folds/opens/closes, its source card and hadith stay on screen the
//      whole time, and the CLIPBOARD carries the entire reply while it is folded.
//   C. THE ACTIONS, PRESSED    — the quick-action strip appears under the newest completed reply
//      and nowhere else, a double press sends once, and the quote fills the composer without
//      sending and without eating what was already typed.
//   E. THE WIRING              — read off the file: no API, manifest, service worker or platform
//      file moved, every new style key is a token, and the S97 scroll contract still stands.
//
// THE ARABIC IT LOOKS FOR IS COLLECTED IN ONE TABLE (S, below) and nowhere else, so a label the
// app renames is re-pointed in a single place. Every DIAGNOSTIC prints codepoints through cps()
// rather than the glyphs: a failure message carrying raw Arabic reorders under bidi and then lies
// about which of two values it is naming.
//
// ONE LIVE CONTEXT AT A TIME — the hard rule chat-history-guard states, for the same cause:
// linkedom's window is a Proxy, and creating a second one makes an EARLIER vm context resolve bare
// `localStorage` to the NEWER window's stub, so a stale handle asserts against the wrong store and
// passes while proving nothing. Every group builds its context, finishes with it, drops it.
//
// Usage: node chat-ux-guard.cjs [htmlFile]   (default: index.html)
//
// SLOPPY MODE ON PURPOSE, exactly as chat-history-guard is. Node's own `navigator` global is
// getter-only; the parity assignment below is a silent no-op in sloppy mode and a hard throw under
// 'use strict'. The vm context resolves `navigator` through the linkedom window regardless.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

// A CONSENTED reader, seeded the way the app itself stores the choice. Since the AI-consent
// screen (Apple 5.1.1(i)) sits between the profile and the chat, a harness that wants to reach
// the chat has to answer it first -- exactly as a real reader does. The refusal path is proved
// separately in tools/ai-consent-probe.cjs. Note that the old 'disclosureAck' key is kept in
// these seeds and is NOT what opens the app: it is not consent and is no longer read.
const AI_CONSENT_SEED = JSON.stringify({ status: 'granted', version: '2026-08-06-1', grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });


const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(htmlFile, 'utf8');

// ---------------------------------------------------------------------------
// The Arabic this gate looks for, as codepoints.
// ---------------------------------------------------------------------------
const S = {
  FOLD_OPEN:   'عرض بقية الرد',
  FOLD_CLOSE:  'إخفاء التفاصيل',
  QUOTE_LABEL: 'اقتباس',
  QUOTE_ARIA:  'اقتباس الرد في خانة الكتابة',
  MENU_OPEN:   'فتح القائمة الجانبية',
  NEW_CHAT:    'محادثة جديدة',
  COPY:        'نسخ',
  QA_SIMPLIFY: 'بسّط',
  QA_EXAMPLE:  'مثال',
  QA_QUIZ:     'اختبرني',
  QA_SHORTEN:  'اختصر',
  QA_CONTINUE: 'كمّل',
  QA_GROUP:    'إجراءات سريعة على آخر رد',
  DISCLAIMER:  'عزك ذكاءٌ اصطناعيّ',
  FAV:            'المفضلة',
  FAV_TITLE:      'الردود المفضلة',
  FAV_ADD:        'أضف إلى المفضلة',
  FAV_DEL:        'إزالة من المفضلة',
  FAV_OPEN_CHAT:  'افتح المحادثة الأصلية',
  FAV_EMPTY_HEAD: 'لا توجد ردود محفوظة بعد',
  FAV_GONE_HEAD:  'المحادثة الأصلية محذوفة',
  BACK:           '← رجوع',
  DEL:            'حذف',
  SEARCH_NONE:    'لا توجد نتائج مطابقة',
  S_PLAIN:        'الإسلام',
  S_BARE:         'الاسلام',
  S_HARAKAT:      'الإِسْلَامُ',
  // ---- fixtures ----
  Q_USER:      'ما حكم الصلاة؟',   // ma hukm as-salah?
  A_SHORT:     'نعم، الصلاة واجبة.',
  W_HEAD:      'المقدمة',        // appears in the folded head
  W_TAIL:      'الخاتمة',        // appears ONLY in the full prose
  W_FILLER:    'والصلاة عمود الدين ',
  SRC_SITE:    'إسلام ويب',
  SRC_BODY:    'نصُّ المصدر',
  HADITH_BODY: 'إنما الأعمال بالنيات',
  TYPED:       'كنت أكتب',
};

let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const plain = (v) => JSON.parse(JSON.stringify(v));
// Codepoints, so a bidi terminal cannot reorder a diagnostic into a lie.
const cps = (s) => Array.prototype.map.call(String(s == null ? '' : s), (c) => c.charCodeAt(0).toString(16)).join(' ');

// ---------------------------------------------------------------------------
// Extract + transform, exactly as runtime-gate does (same pinned-major rule).
// ---------------------------------------------------------------------------
const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const mOpen = openRe.exec(html);
if (!mOpen) { console.error('No text/babel script block found in ' + htmlFile); process.exit(2); }
const rawCode = html.slice(mOpen.index + mOpen[0].length, html.indexOf('</script>', mOpen.index + mOpen[0].length));

const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8;
const jsxRuntime = babelMajor >= 8 ? 'automatic' : 'classic';

let transformed;
try {
  transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    sourceType: 'script',
    retainLines: true,
  }).code;
} catch (e) {
  console.log('TRANSFORM ERROR (should have been caught by babel-gate):\n' + e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A localStorage we can seed, starve and corrupt — and one that is simply dead.
// ---------------------------------------------------------------------------
function makeStore(seed) {
  const data = Object.assign({}, seed || {});
  const size = () => { let t = 0; for (const k in data) t += k.length + data[k].length; return t; };
  const store = {
    quota: Infinity,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => {
      const prev = Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      data[k] = String(v);
      if (size() > store.quota) {
        if (prev === null) delete data[k]; else data[k] = prev;
        const err = new Error('QuotaExceededError'); err.name = 'QuotaExceededError'; throw err;
      }
    },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k in data) delete data[k]; },
    _size: size,
    _dump: () => plain(data),
    _keys: () => Object.keys(data),
  };
  return store;
}
// A browser with storage switched off: every access throws. A real device state, and the feature
// has to degrade to "no favourites" rather than take the chat down with it.
function makeDeadStore() {
  const boom = () => { const e = new Error('SecurityError'); e.name = 'SecurityError'; throw e; };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, _keys: () => [], _dump: () => ({}) };
}

let liveGen = 0;
function buildContext(opts) {
  const o = opts || {};
  const gen = ++liveGen;
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.window = window.window || window;
  window.globalThis = window.globalThis || window;
  window.matchMedia = window.matchMedia || function () {
    return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.scrollTo = window.scrollTo || function () {};
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  const store = o.store || makeStore(o.seed);
  window.localStorage = store;
  window.alert = function () {};
  window.confirm = function () { return true; };
  // EVERY outbound call is recorded and NONE is performed. A search that reached the network, or a
  // menu that fetched on open, appears here as an entry.
  const net = [];
  window.fetch = function (url) {
    net.push(String(url));
    return Promise.resolve({ ok: false, status: 0, headers: { get: () => null },
      text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
  };
  // The clipboard, captured rather than written. BOTH paths are stubbed, because CopyReplyButton
  // deliberately has two: the Clipboard API, and the legacy execCommand fallback it keeps for the
  // Android WebViews where the API is present but refuses. linkedom offers neither, so without
  // both stubs the button would silently take the fallback and this gate would prove nothing.
  // MEASURED: linkedom's navigator refuses BOTH a plain assignment and defineProperty, so
  // `navigator.clipboard` cannot be installed here at all and the button necessarily takes its
  // legacy branch. That branch is not a lesser test — it calls the SAME getText() and therefore
  // proves the same thing this gate is about (a folded reply copies whole). It needs select() and
  // setSelectionRange(), which linkedom does not implement, so they are stubbed below; without
  // them legacyCopy throws into its own catch and reports a failed copy that never happened.
  const clip = { last: null };
  const clipboard = { writeText: (t) => { clip.last = String(t); return Promise.resolve(); } };
  try { window.navigator.clipboard = clipboard; } catch (e) {
    try { Object.defineProperty(window.navigator, 'clipboard', { value: clipboard, configurable: true }); } catch (e2) {}
  }
  try {
    const TAP = (window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype)
      || (window.HTMLElement && window.HTMLElement.prototype);
    if (TAP) {
      if (!TAP.select) TAP.select = function () {};
      if (!TAP.setSelectionRange) TAP.setSelectionRange = function () {};
    }
  } catch (e) {}
  window.document.execCommand = function (cmd) {
    if (String(cmd) !== 'copy') return false;
    const tas = Array.prototype.slice.call(window.document.querySelectorAll('textarea'));
    const src = tas[tas.length - 1];
    if (src) clip.last = String(src.value || '');
    return true;
  };
  // The focus the quote must move: linkedom has no focus manager, so activeElement never changes.
  // Record the calls instead — which is the behaviour under test, not the DOM's bookkeeping.
  const focusCalls = [];
  try {
    const HEP = window.HTMLElement && window.HTMLElement.prototype;
    if (HEP) {
      const prev = HEP.focus;
      HEP.focus = function () { focusCalls.push(this); if (typeof prev === 'function') { try { return prev.apply(this, arguments); } catch (e) {} } };
    }
  } catch (e) {}
  try {
    const entries = [{}];
    let at = 0;
    window.history = {
      get length() { return entries.length; },
      get state() { return entries[at]; },
      pushState: (s) => { entries.splice(at + 1); entries.push(s); at = entries.length - 1; },
      replaceState: (s) => { entries[at] = s; },
      back: () => {
        if (at <= 0) return;
        at--;
        setTimeout(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0);
      },
      _depth: () => at,
    };
  } catch (e) { /* getter-only in this DOM */ }
  // The SSE reader in callAI decodes with TextDecoder, and submitReport measures bytes with
  // TextEncoder. Neither is a linkedom global and neither is inherited by a vm context, so the
  // streaming path would throw before a single frame was read.
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try { if (!window.AbortController) window.AbortController = AbortController; } catch (e) {}
  global.navigator = window.navigator;
  global.window = window;
  global.document = window.document;

  const ctx = vm.createContext(window);
  const loadUMD = (file) => vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', file), 'utf8'), ctx, { filename: file });
  loadUMD('react.umd.js');
  loadUMD('react-dom.umd.js');
  if (!window.React || !window.ReactDOM) { console.log('FAIL: React/ReactDOM globals did not load.'); process.exit(1); }
  if (!o.mount) vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);

  let caught = null;
  window.addEventListener('error', (ev) => { caught = ev.error || ev.message; });
  window.console.error = () => {};

  try {
    vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });
  } catch (e) {
    console.log('RUNTIME ERROR evaluating the app block:\n' + String(e && e.stack ? e.stack : e));
    process.exit(1);
  }

  const stale = () => { throw new Error('chat-ux-guard: context ' + gen + ' used after context ' + liveGen + ' replaced it'); };
  // Top-level const/function from a vm script live in the context's global lexical scope, so a
  // later script in the SAME context reaches them. This is how the shipped helpers are read.
  const grab = (expr) => {
    if (gen !== liveGen) stale();
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'chat-ux-guard-api' }); }
    catch (e) { return undefined; }
  };
  return { window, ctx, store, clip, grab, focusCalls, net: () => net.slice(), err: () => caught };
}

function tick(ms) { return new Promise((r) => setTimeout(r, ms || 40)); }
async function waitFor(fn, what, tries) {
  const n = tries || 60;
  for (let i = 0; i < n; i++) { if (fn()) return true; await tick(25); }
  throw new Error('timed out waiting for ' + what);
}

// A DOM toolkit over one mounted app.
function driver(window) {
  const doc = window.document;
  const root = doc.getElementById('root');
  const all = (sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  const byLabel = (label) => all('button').filter((b) => b.getAttribute('aria-label') === label)[0];
  const byText = (t) => all('button').filter((b) => String(b.textContent || '').trim() === t)[0];
  const click = async (el, what) => {
    if (!el) throw new Error('nothing to click: ' + (what || '?'));
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
  };
  // A double press inside ONE task — no await between them. That is the shape a fast double tap
  // has, and the shape a state flag alone cannot defend against.
  const doublePress = async (el) => {
    if (!el) throw new Error('nothing to double-press');
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    el.dispatchEvent(new window.Event('click', { bubbles: true }));
    await tick();
  };
  // TYPING, THE WAY REACT CAN SEE IT. React installs a value TRACKER on every controlled field and
  // drops an input event whose value matches what it already believes is there. Assigning
  // `el.value` updates the tracker at the same time, so the event is swallowed and the component
  // never hears the keystroke — a test that did that would assert against state the app never
  // received. Writing through the PROTOTYPE setter moves the DOM value without touching the
  // tracker, which is exactly what a real keypress does.
  const type = async (el, value) => {
    if (!el) throw new Error('nothing to type into');
    // 1) move the DOM value through the PROTOTYPE setter, which is what a real keypress does:
    //    assigning `el.value` would also advance React's value tracker, and React drops an input
    //    event whose value matches what the tracker already believes is there.
    let wrote = false;
    try {
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      if (desc && typeof desc.set === 'function') { desc.set.call(el, value); wrote = true; }
    } catch (e) {}
    if (!wrote) el.value = value;
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    await tick();
    // 2) MEASURED: React's ChangeEventPlugin does not fire under linkedom even so — the DOM has
    //    no layout and no real input machinery behind it. So the very handler the component
    //    registered is called, with the very node as the target. This is still the SHIPPED
    //    onChange, not a re-implementation of it; only the delivery differs. It is called
    //    unconditionally: every handler on these fields is `setX(e.target.value)`, so a second
    //    delivery of the same value is a no-op, and trying to detect whether React had already
    //    heard it is what made an earlier version of this helper silently skip later keystrokes.
    const key = Object.keys(el).filter((k) => k.indexOf('__reactProps$') === 0)[0];
    const props = key ? el[key] : null;
    if (props && typeof props.onChange === 'function') {
      props.onChange({ target: el, currentTarget: el, preventDefault() {}, stopPropagation() {} });
      await tick();
    }
    return el;
  };
  return { doc, root, all, byLabel, byText, click, doublePress, type, text: () => String(root.textContent || '') };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// A LONG reply that also carries cards, so one fixture proves both halves of the fold contract:
// the prose is cut, and the hadith and the source card are not.
function longReply() {
  let prose = S.W_HEAD + '\n\n';
  while (prose.length < 1400) prose += S.W_FILLER;
  prose += '\n\n' + S.W_TAIL;
  return prose
    + '\n\n<hadith narrator="عمر" ruling="صحيح">' + S.HADITH_BODY + '</hadith>\n\n'
    + '<source site="' + S.SRC_SITE + '" url="https://example.invalid/a">' + S.SRC_BODY + '</source>';
}
const PROFILE = { name: 'سلمى', age: 30, gender: 'female', birthYear: 1996, pid: 'PID-A', createdAt: '2026-01-01T00:00:00.000Z' };

// ===========================================================================
// PART A — THE FOLD, AS ARITHMETIC
// ===========================================================================
function partA() {
  console.log('\n=== A. THE FOLD, AS ARITHMETIC (the shipped pure functions) ===');
  const c = buildContext({ seed: { child_profile: JSON.stringify(PROFILE), disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED } });
  const foldSegments = c.grab('ezikFoldSegments');
  const foldCut = c.grab('ezikFoldCut');
  const proseLen = c.grab('ezikProseLength');
  const buildQuote = c.grab('ezikBuildQuote');
  const isError = c.grab('ezikIsErrorReply');
  const MIN = c.grab('EZIK_FOLD_MIN_CHARS');
  const HEAD = c.grab('EZIK_FOLD_HEAD_CHARS');
  const QMAX = c.grab('EZIK_QUOTE_MAX');
  const QA = plain(c.grab('EZIK_QUICK_ACTIONS') || []);
  const parse = c.grab('parseRichMessage');

  if (!ok('the fold helpers are on the page', typeof foldSegments === 'function' && typeof foldCut === 'function')) return;
  ok('the thresholds are declared as named constants', typeof MIN === 'number' && typeof HEAD === 'number',
    'MIN=' + MIN + ' HEAD=' + HEAD);
  ok('the folded head is shorter than the fold threshold', HEAD < MIN, HEAD + ' vs ' + MIN);

  // --- what is long, and what is not -----------------------------------------
  const shortSegs = [{ type: 'text', content: 'x'.repeat(MIN - 1) }];
  eq('a reply at or under the threshold does not fold', foldSegments(shortSegs, MIN, HEAD), null);
  const exact = [{ type: 'text', content: 'x'.repeat(MIN) }];
  eq('...nor does one exactly at it', foldSegments(exact, MIN, HEAD), null);
  const longSegs = [{ type: 'text', content: 'x'.repeat(MIN + 1) }];
  ok('a reply past the threshold folds', Array.isArray(foldSegments(longSegs, MIN, HEAD)));

  // --- a reply that is long ONLY because of its cards must not fold -----------
  // The threshold counts PROSE. A short answer wrapped around a large worship card is not a wall
  // of text, and folding it would hide nothing (cards are always kept) while still growing a
  // pointless toggle.
  const cardHeavy = [
    { type: 'text', content: 'y'.repeat(40) },
    { type: 'hadith', content: 'z'.repeat(4000), narrator: '', ruling: '' },
  ];
  eq('a short answer around a huge card does not fold', foldSegments(cardHeavy, MIN, HEAD), null);
  eq('...because the length counted is the prose alone', proseLen(cardHeavy), 40);

  // --- EVERY card survives the fold ------------------------------------------
  const CARD_TYPES = ['verse', 'surah', 'hadith', 'source', 'dhikr', 'worship', 'steps', 'board', 'document'];
  const mixed = [{ type: 'text', content: 'p'.repeat(MIN + 500) }]
    .concat(CARD_TYPES.map((t) => ({ type: t, content: t, items: [t], id: t, catId: t, num: '1', title: t })));
  const foldedMixed = foldSegments(mixed, MIN, HEAD);
  ok('a long reply with cards folds', Array.isArray(foldedMixed));
  const keptTypes = (foldedMixed || []).filter(Boolean).map((x) => x.type);
  CARD_TYPES.forEach((t) => {
    ok('...and the ' + t + ' card is still drawn while folded', keptTypes.indexOf(t) !== -1, JSON.stringify(keptTypes));
  });
  eq('...and the folded view holds exactly as many slots as the full one',
    (foldedMixed || []).length, mixed.length);
  // The index-stability property: every card sits at the SAME index in both views, so React does
  // not renumber (and therefore remount, and therefore refetch) a single card on a toggle.
  const sameIndex = mixed.every((sg, i) => sg.type === 'text' || (foldedMixed[i] && foldedMixed[i].type === sg.type));
  ok('...at the same index it has unfolded, so no card remounts on a toggle', sameIndex);

  // --- the cut ---------------------------------------------------------------
  const folded = foldSegments(longSegs, MIN, HEAD);
  const head = folded.filter(Boolean).filter((x) => x.type === 'text').map((x) => x.content).join('');
  ok('the folded prose is shorter than the whole prose', head.length < MIN + 1, head.length + '');
  ok('...and is close to the head budget', head.length <= HEAD + 8, head.length + ' vs budget ' + HEAD);
  ok('...and is marked as cut', head.indexOf('…') !== -1, cps(head.slice(-6)));

  eq('a string shorter than the budget is returned untouched', foldCut('abc', 100), 'abc');
  const cutWords = foldCut('alpha beta gamma delta epsilon zeta', 20);
  ok('the cut lands on a word boundary, never mid-word',
    /^[a-z ]+ …$/.test(cutWords) && cutWords.indexOf('gam ') === -1, JSON.stringify(cutWords));
  const fenced = foldCut('```js\n' + 'a'.repeat(400) + '\n```\ntail', 100);
  eq('a cut inside a fenced block closes the fence',
    ((fenced.match(/```/g) || []).length) % 2, 0);
  // A single unbroken paragraph has no boundary to walk back to; it must still yield a real head
  // rather than collapsing to nothing.
  const noBoundary = foldCut('x'.repeat(900), 300);
  ok('a paragraph with no boundary at all still yields a head', noBoundary.length > 200, noBoundary.length + '');

  // --- the fold never edits the reply ----------------------------------------
  const raw = longReply();
  const parsed = plain(parse(raw, 30));
  const before = JSON.stringify(parsed.segments);
  foldSegments(parsed.segments, MIN, HEAD);
  eq('folding does not mutate the segments the copy/voice/export paths read',
    JSON.stringify(parsed.segments), before);

  // --- the quote builder ------------------------------------------------------
  eq('an empty reply quotes to nothing', buildQuote(''), '');
  const shortQ = buildQuote('hello   world\n\nagain');
  ok('a quote collapses whitespace and is wrapped', shortQ.indexOf('hello world again') !== -1, JSON.stringify(shortQ));
  ok('...with no raw tag left in it', shortQ.indexOf('<') === -1);
  const longQ = buildQuote(('word '.repeat(400)));
  ok('a long quote is capped', longQ.length <= QMAX + 12, longQ.length + ' vs cap ' + QMAX);
  ok('...and says it was cut', longQ.indexOf('…') !== -1, cps(longQ.slice(-6)));

  // WHERE THE QUOTE LANDS. This is the rule that must never eat what a child was writing, so it
  // is a named pure function and is tested as one. (The end-to-end press is proved below; the
  // keystroke itself cannot be simulated here — see the note on the double-quote check.)
  const compose = c.grab('ezikComposeWithQuote');
  eq('a quote into an EMPTY composer is just the quote', compose('', 'Q'), 'Q\n');
  eq('...and a null composer behaves the same', compose(null, 'Q'), 'Q\n');
  eq('a composer holding whitespace only is treated as empty', compose('   \n ', 'Q'), 'Q\n');
  eq('TYPED TEXT IS KEPT, and the quote is appended under it', compose('typed', 'Q'), 'typed\n\nQ\n');
  eq('...trailing whitespace is tidied, never the text', compose('typed   \n\n', 'Q'), 'typed\n\nQ\n');
  eq('a second quote keeps the first', compose('Q1\n', 'Q2'), 'Q1\n\nQ2\n');
  eq('an empty quote changes nothing at all', compose('typed', ''), 'typed');

  // --- error replies ----------------------------------------------------------
  const FE = plain(c.grab('FRIENDLY_ERRORS') || {});
  const everyErrorKnown = Object.keys(FE).every((k) => isError(FE[k].male) && isError(FE[k].female));
  ok('every line the client writes for its own failure is recognised as an error', everyErrorKnown);
  ok('...and an ordinary answer is not', isError('الصلاة واجبة') === false);
  ok('...and a non-string cannot throw it', isError(null) === false && isError(undefined) === false);

  // --- the five quick actions -------------------------------------------------
  eq('there are exactly five quick actions', QA.length, 5);
  const labels = QA.map((q) => q.label);
  [S.QA_SIMPLIFY, S.QA_EXAMPLE, S.QA_QUIZ, S.QA_SHORTEN, S.QA_CONTINUE].forEach((l) => {
    ok('the quick action ' + cps(l) + ' exists', labels.indexOf(l) !== -1, labels.map(cps).join(' | '));
  });
  ok('every quick action carries a real sentence to send',
    QA.every((q) => typeof q.prompt === 'string' && q.prompt.length > 20));
  ok('...and none of them carries an endpoint, a model or a depth',
    QA.every((q) => Object.keys(q).sort().join(',') === 'key,label,prompt'), JSON.stringify(QA.map((q) => Object.keys(q))));
}

// ===========================================================================
// PART B + C — THE BUBBLE AND THE ACTIONS, IN A MOUNTED APP
// ===========================================================================
const CHAT_LONG = 'C-LONG';
const CHAT_SHORT = 'C-SHORT';
function seedChats() {
  return {
    child_profile: JSON.stringify(PROFILE),
    disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED,
    tashkeel_v1: '1',
    ezik_chats_v1: JSON.stringify([
      { id: CHAT_LONG, pk: PROFILE.pid, title: S.Q_USER, pinned: false, at: 2000 },
      { id: CHAT_SHORT, pk: PROFILE.pid, title: S.Q_USER + ' 2', pinned: false, at: 1000 },
    ]),
    ['ezik_chat_v1_' + CHAT_LONG]: JSON.stringify([
      { role: 'user', content: S.Q_USER },
      { role: 'assistant', content: longReply() },
    ]),
    ['ezik_chat_v1_' + CHAT_SHORT]: JSON.stringify([
      { role: 'user', content: S.Q_USER + ' 2' },
      { role: 'assistant', content: S.A_SHORT },
    ]),
  };
}

async function partBC() {
  console.log('\n=== B. THE BUBBLE, RENDERED (a real conversation in a mounted app) ===');
  const c = buildContext({ seed: seedChats(), mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts with the new controls present', false, String(c.err() && c.err().stack || c.err())); return c; }
  const d = driver(c.window);
  ok('the app mounts and lands on the chat', d.text().indexOf(S.DISCLAIMER) !== -1, cps(d.text().slice(0, 80)));

  // ---- open the LONG conversation through the shipped menu -------------------
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  const rowLong = d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER)[0];
  if (!ok('the long conversation is listed in the menu', !!rowLong)) return c;
  await d.click(rowLong, 'long chat');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the long reply on screen');

  // 1) it folded, and it folded BY DEFAULT
  const toggle = () => d.byLabel(S.FOLD_OPEN) || d.byLabel(S.FOLD_CLOSE);
  ok('a long completed reply shows a toggle', !!toggle());
  ok('...reading «show the rest» — so it opened FOLDED', !!d.byLabel(S.FOLD_OPEN));
  ok('...and the head of the prose is on screen', d.text().indexOf(S.W_HEAD) !== -1);
  ok('...while the tail of the prose is NOT', d.text().indexOf(S.W_TAIL) === -1, cps(d.text().slice(0, 120)));

  // 3) the cards are on screen WHILE it is folded — this is the whole safety of the fold
  ok('the hadith is on screen while the reply is folded', d.text().indexOf(S.HADITH_BODY) !== -1);
  ok('the source card is on screen while the reply is folded', d.text().indexOf(S.SRC_SITE) !== -1);

  // 4) the clipboard carries the WHOLE reply while it is folded
  const copyBtn = d.byLabel(S.COPY);
  if (ok('the copy button is under the folded reply', !!copyBtn)) {
    await d.click(copyBtn, 'copy');
    await tick(60);
    const wrote = c.clip.last;
    ok('copying a FOLDED reply puts the whole reply on the clipboard',
      !!wrote && wrote.indexOf(S.W_HEAD) !== -1 && wrote.indexOf(S.W_TAIL) !== -1,
      wrote ? ('len=' + wrote.length + ' tail?' + (wrote.indexOf(S.W_TAIL) !== -1)) : 'nothing captured');
    ok('...including its hadith and its source, as it always did',
      !!wrote && wrote.indexOf(S.HADITH_BODY) !== -1 && wrote.indexOf(S.SRC_SITE) !== -1);
    ok('...and no raw card tag leaks into it', !!wrote && wrote.indexOf('<hadith') === -1 && wrote.indexOf('<source') === -1);
  }

  // the listen button reads the raw message, not the folded view
  const listenBtns = d.all('button').filter((b) => /^(استمع|إيقاف)$/.test(String(b.textContent || '').trim()));
  ok('the listen button is still under the reply', listenBtns.length > 0);

  // 2) opening and closing it
  await d.click(d.byLabel(S.FOLD_OPEN), 'open the fold');
  ok('pressing «show the rest» reveals the tail of the prose', d.text().indexOf(S.W_TAIL) !== -1);
  ok('...and the button becomes «hide the details»', !!d.byLabel(S.FOLD_CLOSE));
  ok('...and the cards are still there', d.text().indexOf(S.HADITH_BODY) !== -1 && d.text().indexOf(S.SRC_SITE) !== -1);
  await d.click(d.byLabel(S.FOLD_CLOSE), 'close the fold');
  ok('pressing «hide the details» folds it again', d.text().indexOf(S.W_TAIL) === -1);
  ok('...and the button reads «show the rest» once more', !!d.byLabel(S.FOLD_OPEN));

  // the fold is UI state and is never stored
  const foldKeys = c.store._keys().filter((k) => /fold|collapse/i.test(k));
  eq('the open/closed state is never written to storage', foldKeys, []);

  // 1b) THE SHORT REPLY — no toggle at all
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  const rowShort = d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER + ' 2')[0];
  if (ok('the short conversation is listed', !!rowShort)) {
    await d.click(rowShort, 'short chat');
    await waitFor(() => d.text().indexOf(S.A_SHORT) !== -1, 'the short reply on screen');
    ok('a SHORT reply grows no toggle at all', !toggle(), 'a toggle appeared under a short reply');
    ok('...and its whole text is on screen', d.text().indexOf(S.A_SHORT) !== -1);
  }

  // =========================================================================
  console.log('\n=== C. THE ACTIONS, PRESSED ===');
  // 5) the quick actions: under the newest completed reply, and nowhere else
  const quickBtns = () => [S.QA_SIMPLIFY, S.QA_EXAMPLE, S.QA_QUIZ, S.QA_SHORTEN, S.QA_CONTINUE]
    .map((l) => d.byText(l)).filter(Boolean);
  eq('all five quick actions are under the last completed reply', quickBtns().length, 5);
  const groups = d.all('[role="group"]').filter((g) => g.getAttribute('aria-label') === S.QA_GROUP);
  eq('...as exactly ONE labelled group, not one per reply', groups.length, 1);
  ok('...and the group is inside the scroller, never over the composer',
    !!groups[0] && !/position:\s*(fixed|absolute)/.test(String(groups[0].getAttribute('style') || '')),
    String(groups[0] && groups[0].getAttribute('style')));

  // it must NOT be under a user message: a thread ending on a question shows none
  const setMessages = null; // the app owns its state; drive it the way a child would instead

  // 6) ONE PRESS, ONE SEND — two clicks in a single task
  const before = c.net().length;
  await d.doublePress(d.byText(S.QA_SIMPLIFY));
  await tick(120);
  const sends = c.net().filter((u) => /\/api\/(ask|chat)/.test(u));
  eq('a double press on a quick action sends exactly once', sends.length, 1);
  ok('...through the SAME chat endpoint the composer uses, with no new route invented',
    sends.every((u) => u === '/api/ask' || u === '/api/chat' || u === '/api/chat-fast'), JSON.stringify(sends));
  ok('...and the pressed sentence is the one the table declares',
    d.text().indexOf('بسّط لي الإجابة السابقة') !== -1);
  // the strip is gone while the turn is in flight
  ok('the quick actions disappear while a reply is in flight', quickBtns().length === 0 || quickBtns().every((b) => b.disabled));
  return c;
}

// ===========================================================================
// PART C2 — THE QUOTE
// ===========================================================================
async function partQuote() {
  console.log('\n--- the quote ---');
  const c = buildContext({ seed: seedChats(), mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts for the quote checks', false, String(c.err())); return c; }
  const d = driver(c.window);
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  const row = d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER)[0];
  if (!ok('the conversation opens for the quote checks', !!row)) return c;
  await d.click(row, 'chat');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the reply on screen');

  const composer = () => d.all('textarea')[0];
  if (!ok('the composer is on screen', !!composer())) return c;

  // 7) the quote fills the composer and sends NOTHING
  const netBefore = c.net().length;
  const qBtn = d.byLabel(S.QUOTE_ARIA);
  if (!ok('every completed reply offers a quote button', !!qBtn)) return c;
  await d.click(qBtn, 'quote');
  await tick(60);
  const filled = String(composer().value || '');
  ok('quoting puts text in the composer', filled.trim().length > 0, cps(filled.slice(0, 30)));
  eq('...and sends absolutely nothing', c.net().length, netBefore);
  ok('...with no raw tag in it', filled.indexOf('<hadith') === -1 && filled.indexOf('<source') === -1 && filled.indexOf('<') === -1);
  ok('...marked as a quotation', filled.indexOf('«') !== -1 && filled.indexOf('»') !== -1, cps(filled.slice(0, 6)));
  ok('...capped in length', filled.length < 700, filled.length + '');
  ok('...and the reply it came from is untouched on screen', d.text().indexOf(S.W_HEAD) !== -1);
  const focusedComposer = c.focusCalls.filter((el) => el === composer());
  ok('...and the composer takes the focus', focusedComposer.length > 0,
    'focus() calls seen: ' + c.focusCalls.map((el) => String(el && el.tagName)).join(','));

  // 8) a second quote must not eat what is already in the box.
  //
  // Driven twice over, because each half proves something the other cannot.
  //
  // (a) A SECOND QUOTE over the first. Real app text, real app path.
  const firstQuote = String(composer().value || '');
  await d.click(d.byLabel(S.QUOTE_ARIA), 'quote again');
  await tick(60);
  const after = String(composer().value || '');
  ok('quoting again KEEPS what the composer already held',
    after.indexOf(firstQuote.trim()) === 0, cps(after.slice(0, 40)));
  eq('...and the box now holds two quotations, not one', (after.match(/«/g) || []).length, 2);
  ok('...separated by a blank line', after.indexOf('\n\n«') !== -1);
  ok('...and still nothing was sent', c.net().filter((u) => /\/api\//.test(u)).length === 0, JSON.stringify(c.net()));

  // (b) TYPED TEXT, delivered to the shipped onChange (see the note in the driver's type()).
  await d.type(composer(), S.TYPED);
  ok('typing reaches the composer state', String(composer().value || '') === S.TYPED, cps(String(composer().value).slice(0, 30)));
  await d.click(d.byLabel(S.QUOTE_ARIA), 'quote over typed text');
  await tick(60);
  const typedAfter = String(composer().value || '');
  ok('quoting over TYPED text keeps the typed text', typedAfter.indexOf(S.TYPED) === 0, cps(typedAfter.slice(0, 40)));
  ok('...and puts the quotation after it', typedAfter.indexOf('«') > S.TYPED.length - 1);
  eq('...and still sent nothing', c.net().filter((u) => /\/api\//.test(u)).length, 0);
  return c;
}

// ===========================================================================
// PART D — FAVOURITES: THE STORE, AND EVERY WAY IT CAN GO WRONG
// ===========================================================================
function partDStore() {
  console.log('\n=== D. FAVOURITES — the store, run for real ===');
  const c = buildContext({ seed: {} });
  const read = c.grab('ezikReadFavs');
  const write = c.grab('ezikWriteFavs');
  const make = c.grab('ezikMakeFav');
  const hash = c.grab('ezikHashText');
  const snip = c.grab('ezikFavSnippet');
  const clearAll = c.grab('ezikClearAllFavs');
  const KEY = c.grab('EZIK_FAVS_KEY');
  const MAX = c.grab('EZIK_FAVS_MAX');

  if (!ok('the favourites store is on the page', typeof read === 'function' && typeof write === 'function')) return;
  eq('it lives under its own versioned key', KEY, 'ezik_favorite_replies_v1');
  ok('...which is not the conversations key', KEY !== c.grab('EZIK_CHATS_KEY'));
  ok('...and shares no prefix with a conversation body', KEY.indexOf(c.grab('EZIK_CHAT_PREFIX')) !== 0);

  // an empty store is not an error
  eq('an absent key reads as no favourites', plain(read()), []);

  // the id is stable, and derived from the text alone
  const t1 = 'a reply', t2 = 'another reply';
  eq('the id of a reply is stable across calls', hash(t1), hash(t1));
  ok('...and differs between replies', hash(t1) !== hash(t2));
  ok('...and is a plain string with no store behind it', typeof hash(t1) === 'string' && hash(t1).length > 2);
  eq('an empty reply still hashes without throwing', typeof hash(''), 'string');
  eq('a null reply still hashes without throwing', typeof hash(null), 'string');

  // ===== THE IDENTITY OF A SAVED REPLY IS A POSITION, NOT A TEXT =====
  // This is the whole of the isolation, and it is checked here as arithmetic before it is checked
  // through the UI below. The same answer can legitimately exist in two conversations, and on two
  // children's profiles on one device; with the id equal, one star would have driven both and one
  // child's tap would have removed the other child's favourite.
  const favId = c.grab('ezikFavId');
  if (!ok('the favourite identity function is on the page', typeof favId === 'function')) return;
  const SAME = 'الجواب نفسه حرفًا بحرف';
  eq('the same reply at the same place has one identity', favId('P1', 'C1', 3, SAME), favId('P1', 'C1', 3, SAME));
  ok('THE SAME TEXT IN TWO CONVERSATIONS IS TWO DIFFERENT FAVOURITES',
    favId('P1', 'C1', 3, SAME) !== favId('P1', 'C2', 3, SAME));
  ok('THE SAME TEXT ON TWO PROFILES IS TWO DIFFERENT FAVOURITES',
    favId('P1', 'C1', 3, SAME) !== favId('P2', 'C1', 3, SAME));
  ok('the same text twice in ONE conversation is two different favourites',
    favId('P1', 'C1', 3, SAME) !== favId('P1', 'C1', 9, SAME));
  ok('...and a different reply at the same place is different again',
    favId('P1', 'C1', 3, SAME) !== favId('P1', 'C1', 3, SAME + '!'));
  ok('the id carries the profile, so it can never be matched across one',
    favId('P1', 'C1', 3, SAME).indexOf('P1') === 0);
  ok('an unfiled thread (no conversation id yet) still yields an id',
    typeof favId('P1', null, 0, SAME) === 'string' && favId('P1', null, 0, SAME).length > 4);
  ok('...that is not the id of any real conversation', favId('P1', null, 0, SAME) !== favId('P1', 'C1', 0, SAME));

  // saving and re-reading — the reload case
  const rec = plain(make(longReply(), 'PID-A', CHAT_LONG, 1));
  write([rec]);
  const back = plain(read());
  eq('a saved reply survives a reload', back.length, 1);
  eq('...with the same id', back[0].id, rec.id);
  eq('...the conversation it came from', back[0].chatId, CHAT_LONG);
  eq('...and the profile it belongs to', back[0].pk, 'PID-A');
  ok('...its full text, so the screen can stand without the conversation',
    back[0].text.indexOf(S.W_TAIL) !== -1 && back[0].text.indexOf(S.HADITH_BODY) !== -1);
  ok('...a saved-on date', typeof back[0].at === 'number' && back[0].at > 0);
  ok('...and a clean snippet with no tag in it',
    back[0].snippet.indexOf('<') === -1 && back[0].snippet.length > 0, cps(back[0].snippet.slice(0, 20)));
  ok('the snippet is capped', snip('x'.repeat(4000)).length <= 160, snip('x'.repeat(4000)).length + '');

  // removing
  write([]);
  eq('removing a favourite empties the store', plain(read()), []);

  // 10) CORRUPT JSON must not break anything
  c.store.setItem(KEY, '{ not json at all');
  eq('corrupt JSON reads as no favourites instead of throwing', plain(read()), []);
  c.store.setItem(KEY, 'null');
  eq('a null payload reads as no favourites', plain(read()), []);
  c.store.setItem(KEY, '{"a":1}');
  eq('a non-array payload reads as no favourites', plain(read()), []);
  c.store.setItem(KEY, '[1,2,"three",null,{"nope":true}]');
  eq('a list of junk entries reads as no favourites', plain(read()), []);

  // A HALF-WRITTEN record. Two of its fields cannot be invented, and a record missing either is
  // dropped rather than guessed at: the id is a POSITION and cannot be re-derived from the text,
  // and a record with no owner would otherwise have to be shown to every profile on the device —
  // which is exactly the leak this store exists to prevent.
  c.store.setItem(KEY, JSON.stringify([{ text: 'an ownerless reply', id: 'x|y|0|z' }]));
  eq('A RECORD WITH NO PROFILE IS IGNORED, never shown to everyone', plain(read()), []);
  c.store.setItem(KEY, JSON.stringify([{ text: 'an id-less reply', pk: 'PID-A' }]));
  eq('a record with no identity is ignored', plain(read()), []);
  c.store.setItem(KEY, JSON.stringify([{ id: 'x', at: 5, pk: 'PID-A' }]));
  eq('a record with no text at all is dropped', plain(read()), []);
  // what a record IS allowed to be missing
  c.store.setItem(KEY, JSON.stringify([{ text: 'a partial but valid reply', id: 'PID-A|-|0|h', pk: 'PID-A' }]));
  const partial = plain(read());
  eq('a record with an owner, an identity and a reply is kept', partial.length, 1);
  ok('...and is given a snippet', partial[0].snippet.length > 0);
  eq('...with no conversation to open', partial[0].chatId, null);
  eq('...and no date invented for it', partial[0].at, 0);

  // a FULL store: the write must not throw, and must not silently claim success
  const big = [];
  for (let i = 0; i < 40; i++) big.push(plain(make('reply number ' + i + ' ' + 'z'.repeat(500), 'PID-A', 'CQ', i)));
  c.store.clear();
  c.store.quota = 6000;
  const written = write(big);
  ok('a full store still writes what it can', Array.isArray(written), JSON.stringify(written));
  ok('...dropping the OLDEST rather than failing outright', written.length > 0 && written.length < big.length,
    'kept ' + (written && written.length) + ' of ' + big.length);
  eq('...and what it reports written is what comes back', plain(read()).length, written.length);
  c.store.quota = Infinity;

  // a store that refuses everything
  c.store.clear();
  c.store.quota = 0;
  eq('a store that refuses even an empty list reports the refusal', write([]), null);
  c.store.quota = Infinity;

  // the cap
  const over = [];
  for (let i = 0; i < MAX + 25; i++) over.push(plain(make('r' + i, 'PID-A', 'CQ', i)));
  eq('the store is capped', write(over).length, MAX);

  // clearing
  write([plain(make('x', 'PID-A', 'CQ', 0))]);
  clearAll();
  eq('«delete all my data» clears the favourites', plain(read()), []);

  // 11) the conversation store is untouched by ANY of this
  const chatKeys = c.store._keys().filter((k) => k.indexOf('ezik_chat') === 0);
  eq('nothing above wrote a single conversation key', chatKeys, []);
}

// A store with NO localStorage at all: every access throws.
function partDDead() {
  console.log('\n--- favourites with storage switched off ---');
  const c = buildContext({ store: makeDeadStore() });
  const read = c.grab('ezikReadFavs');
  const write = c.grab('ezikWriteFavs');
  let threw = null;
  let got;
  try { got = plain(read()); } catch (e) { threw = e; }
  ok('reading favourites from a dead store does not throw', !threw, String(threw && threw.message));
  eq('...it reads as no favourites', got, []);
  threw = null;
  let w;
  try { w = write([{ id: 'a', text: 'b' }]); } catch (e) { threw = e; }
  ok('writing to a dead store does not throw', !threw, String(threw && threw.message));
  eq('...and reports that nothing was written', w, null);
}

// The favourites, driven through the real UI.
async function partDScreen() {
  console.log('\n--- favourites, driven through the real UI ---');
  const c = buildContext({ seed: seedChats(), mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts for the favourites checks', false, String(c.err())); return c; }
  const d = driver(c.window);
  const KEY = c.grab('EZIK_FAVS_KEY');

  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  ok('the menu carries a «favourites» entry', !!d.byText(S.FAV) || d.text().indexOf(S.FAV) !== -1, cps(d.text().slice(0, 120)));
  const favEntry = d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0];
  if (!ok('...that can be pressed', !!favEntry)) return c;
  await d.click(favEntry, 'favourites');
  await tick(80);
  ok('it opens the favourites screen', d.text().indexOf(S.FAV_TITLE) !== -1, cps(d.text().slice(0, 120)));
  ok('...saying it is empty', d.text().indexOf(S.FAV_EMPTY_HEAD) !== -1, cps(d.text().slice(0, 200)));
  eq('...and it reached the network for none of it', c.net().filter((u) => /\/api\//.test(u)).length, 0);

  // back to the chat, open the long conversation, and star its reply
  await d.click(d.byText(S.BACK), 'back');
  await tick(80);
  ok('back returns to the chat that opened it', d.text().indexOf(S.DISCLAIMER) !== -1, cps(d.text().slice(0, 120)));
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  const rowLong = d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER)[0];
  if (!ok('the conversation is still listed', !!rowLong)) return c;
  await d.click(rowLong, 'long chat');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the reply on screen');

  const star = () => d.byLabel(S.FAV_ADD) || d.byLabel(S.FAV_DEL);
  if (!ok('a completed reply offers a star', !!star())) return c;
  ok('...and it starts unfilled', !!d.byLabel(S.FAV_ADD));
  await d.click(d.byLabel(S.FAV_ADD), 'star');
  await tick(60);
  ok('starring a reply fills the star', !!d.byLabel(S.FAV_DEL));
  const stored = JSON.parse(c.store.getItem(KEY) || '[]');
  eq('...and writes exactly one record', stored.length, 1);
  ok('...carrying the whole reply', String(stored[0].text).indexOf(S.W_TAIL) !== -1);
  ok('...and the conversation it came from', stored[0].chatId === CHAT_LONG);
  ok('the message itself gained NOTHING — the stored conversation is unchanged',
    JSON.parse(c.store.getItem('ezik_chat_v1_' + CHAT_LONG))
      .every((m) => Object.keys(m).sort().join(',') === 'content,role'),
    c.store.getItem('ezik_chat_v1_' + CHAT_LONG).slice(0, 200));

  // rapid double press: a toggle, never a duplicate
  await d.doublePress(d.byLabel(S.FAV_DEL));
  await tick(60);
  const afterDouble = JSON.parse(c.store.getItem(KEY) || '[]');
  ok('a rapid double press leaves no duplicate behind', afterDouble.length <= 1, JSON.stringify(afterDouble.map((r) => r.id)));
  // put it back, starred, for the reload check
  if (!d.byLabel(S.FAV_DEL)) { await d.click(d.byLabel(S.FAV_ADD), 'star again'); await tick(60); }
  ok('...and the star agrees with the store',
    (!!d.byLabel(S.FAV_DEL)) === (JSON.parse(c.store.getItem(KEY) || '[]').length === 1));

  // it shows on the favourites screen, with its cards
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0], 'favourites');
  await tick(80);
  ok('the saved reply is on the favourites screen', d.text().indexOf(S.W_HEAD) !== -1, cps(d.text().slice(0, 200)));
  ok('...rendered through the same renderer, so its hadith is there too', d.text().indexOf(S.HADITH_BODY) !== -1);
  ok('...and its source card', d.text().indexOf(S.SRC_SITE) !== -1);
  ok('...with no raw tag anywhere on the screen',
    d.text().indexOf('<hadith') === -1 && d.text().indexOf('<source') === -1 && d.text().indexOf('<verse') === -1);
  ok('...offering to open the conversation it came from', !!d.byLabel(S.FAV_OPEN_CHAT));
  ok('...and offering a full copy', !!d.byLabel(S.COPY));
  await d.click(d.byLabel(S.COPY), 'copy from favourites');
  await tick(60);
  ok('copying from the favourites screen copies the WHOLE reply',
    !!c.clip.last && c.clip.last.indexOf(S.W_HEAD) !== -1 && c.clip.last.indexOf(S.W_TAIL) !== -1,
    c.clip.last ? ('len=' + c.clip.last.length) : 'nothing captured');

  // opening the original conversation
  await d.click(d.byLabel(S.FAV_OPEN_CHAT), 'open the original');
  await tick(120);
  ok('opening the original conversation lands back in the chat', d.text().indexOf(S.DISCLAIMER) !== -1, cps(d.text().slice(0, 120)));
  ok('...showing that conversation', d.text().indexOf(S.W_HEAD) !== -1);
  return c;
}

// 11) THE CONVERSATION IS DELETED — the saved reply must outlive it.
async function partDOrphan() {
  console.log('\n--- a favourite whose conversation was deleted ---');
  const seed = seedChats();
  const c = buildContext({ seed, mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts for the orphan checks', false, String(c.err())); return c; }
  const d = driver(c.window);
  const KEY = c.grab('EZIK_FAVS_KEY');

  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER)[0], 'long chat');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the reply on screen');
  await d.click(d.byLabel(S.FAV_ADD), 'star');
  await tick(60);
  eq('the reply is saved', JSON.parse(c.store.getItem(KEY) || '[]').length, 1);

  // delete the conversation through the shipped confirmation
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => b.getAttribute('aria-label') === S.DEL)[0], 'delete');
  await d.click(d.byText(S.DEL), 'confirm delete');
  await tick(80);
  const favsAfter = JSON.parse(c.store.getItem(KEY) || '[]');
  eq('deleting the conversation does NOT delete the saved reply', favsAfter.length, 1);
  ok('...and the saved reply still carries its full text', String(favsAfter[0].text).indexOf(S.W_TAIL) !== -1);
  eq('...while the conversation body really is gone', c.store.getItem('ezik_chat_v1_' + CHAT_LONG), null);

  // the screen must not crash, and must not offer to open what is gone
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0], 'favourites');
  await tick(100);
  ok('the favourites screen still opens', d.text().indexOf(S.FAV_TITLE) !== -1, cps(d.text().slice(0, 150)));
  ok('...with no runtime error', !c.err(), String(c.err()));
  ok('...and the reply is still readable', d.text().indexOf(S.W_HEAD) !== -1);
  ok('...and still copyable', !!d.byLabel(S.COPY));
  ok('...but no longer offers to open the conversation', !d.byLabel(S.FAV_OPEN_CHAT));
  ok('...saying plainly that it is gone', d.text().indexOf(S.FAV_GONE_HEAD) !== -1, cps(d.text().slice(0, 250)));

  // and removing it from here works
  await d.click(d.byLabel(S.FAV_DEL), 'remove');
  await tick(60);
  eq('removing it from the favourites screen empties the store', JSON.parse(c.store.getItem(KEY) || '[]').length, 0);
  return c;
}

// ===========================================================================
// PART D3 — ISOLATION: TWO CONVERSATIONS, TWO PROFILES, ONE ANSWER
// ===========================================================================
// The identity arithmetic is checked in part A. This drives the same thing through the real UI,
// because that is where it went wrong: the same answer really does turn up in two conversations
// (ask the same question twice) and on two children's profiles on one device.
const TWIN_A = 'TW-A';
const TWIN_B = 'TW-B';
const PROFILE_B = { name: 'خالد', age: 30, gender: 'male', birthYear: 1996, pid: 'PID-B', createdAt: '2026-01-01T00:00:00.000Z' };
function seedTwins(profile) {
  const seed = { child_profile: JSON.stringify(profile), disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED };
  const body = [
    { role: 'user', content: S.Q_USER },
    { role: 'assistant', content: longReply() },      // BYTE-IDENTICAL in both conversations
  ];
  seed.ezik_chats_v1 = JSON.stringify([
    { id: TWIN_A, pk: profile.pid, title: 'التوأم الأول', pinned: false, at: 2000 },
    { id: TWIN_B, pk: profile.pid, title: 'التوأم الثاني', pinned: false, at: 1000 },
  ]);
  seed['ezik_chat_v1_' + TWIN_A] = JSON.stringify(body);
  seed['ezik_chat_v1_' + TWIN_B] = JSON.stringify(body);
  return seed;
}

async function partDIsolation() {
  console.log('\n--- isolation: the same answer in two conversations ---');
  const c = buildContext({ seed: seedTwins(PROFILE), mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts for the isolation checks', false, String(c.err())); return null; }
  const d = driver(c.window);
  const KEY = c.grab('EZIK_FAVS_KEY');
  const favs = () => { try { return JSON.parse(c.store.getItem(KEY) || '[]'); } catch (e) { return []; } };
  // The favourites screen has no menu button, so anything that navigates from it goes home first.
  const backToChat = async () => {
    if (d.byLabel(S.MENU_OPEN)) return;
    await d.click(d.byText(S.BACK), 'back to the chat');
    await tick(80);
  };
  const openChat = async (title) => {
    await backToChat();
    await d.click(d.byLabel(S.MENU_OPEN), 'menu');
    const row = d.all('button').filter((b) => String(b.textContent || '').trim() === title)[0];
    if (!row) throw new Error('no row for ' + cps(title));
    await d.click(row, title);
    await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the reply on screen');
  };

  await openChat('التوأم الأول');
  ok('the first conversation opens with an unsaved reply', !!d.byLabel(S.FAV_ADD));
  await d.click(d.byLabel(S.FAV_ADD), 'star in the first');
  await tick(60);
  ok('starring in the first conversation fills its star', !!d.byLabel(S.FAV_DEL));
  eq('...and writes one record', favs().length, 1);

  await openChat('التوأم الثاني');
  ok('THE SECOND CONVERSATION HOLDS THE SAME ANSWER, and its star is EMPTY',
    !!d.byLabel(S.FAV_ADD), 'the identical reply in another conversation inherited the star');
  await d.click(d.byLabel(S.FAV_ADD), 'star in the second');
  await tick(60);
  const two = favs();
  eq('starring it saves a SECOND, independent record', two.length, 2);
  ok('...with two different identities', two[0].id !== two[1].id, JSON.stringify(two.map((r) => r.id)));
  eq('...pointing at the two different conversations',
    two.map((r) => r.chatId).sort(), [TWIN_A, TWIN_B].sort());
  ok('...though the saved text really is identical', two[0].text === two[1].text);

  // removing one must not touch the other
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0], 'favourites');
  await tick(100);
  const removeBtns = d.all('button').filter((b) => b.getAttribute('aria-label') === S.FAV_DEL);
  eq('both saved replies are listed', removeBtns.length, 2);
  await d.click(removeBtns[0], 'remove one');
  await tick(80);
  const left = favs();
  eq('REMOVING ONE LEAVES THE OTHER', left.length, 1);
  ok('...and the survivor is the other conversation\'s', left[0].chatId === TWIN_A || left[0].chatId === TWIN_B);

  // and the star in the surviving conversation is still filled, while the other is empty again
  const survivor = left[0].chatId;
  const gone = survivor === TWIN_A ? TWIN_B : TWIN_A;
  await openChat(survivor === TWIN_A ? 'التوأم الأول' : 'التوأم الثاني');
  ok('the surviving favourite\'s conversation still shows a filled star', !!d.byLabel(S.FAV_DEL));
  await openChat(gone === TWIN_A ? 'التوأم الأول' : 'التوأم الثاني');
  ok('...and the removed one\'s conversation shows an empty star', !!d.byLabel(S.FAV_ADD));

  // opening each favourite reaches ITS OWN conversation
  await d.click(d.byLabel(S.FAV_ADD), 'star it again');
  await tick(60);
  eq('both are saved again', favs().length, 2);
  await backToChat();
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0], 'favourites');
  await tick(100);
  const openBtns = d.all('button').filter((b) => b.getAttribute('aria-label') === S.FAV_OPEN_CHAT);
  eq('each saved reply offers to open its own conversation', openBtns.length, 2);
  await d.click(openBtns[0], 'open the first original');
  await tick(140);
  ok('opening a favourite lands in the chat', d.text().indexOf(S.DISCLAIMER) !== -1);
  ok('...showing a conversation that holds that reply', d.text().indexOf(S.W_HEAD) !== -1);
  ok('...and the star there is filled, so it opened the RIGHT one of the twins',
    !!d.byLabel(S.FAV_DEL), 'it opened a conversation whose reply is not the saved one');

  return c.store._dump();
}

// The SECOND profile, on the SAME device, with the first profile's favourites already in the store.
async function partDTwoProfiles(dumpFromA) {
  console.log('\n--- isolation: two profiles on one device ---');
  if (!dumpFromA) { ok('the first profile produced a store to carry over', false); return; }
  const KEY = 'ezik_favorite_replies_v1';
  const before = JSON.parse(dumpFromA[KEY] || '[]');
  const seed = Object.assign(seedTwins(PROFILE_B), { [KEY]: dumpFromA[KEY] });
  const c = buildContext({ seed: seed, mount: true });
  await tick(400);
  if (c.err()) { ok('a second profile mounts on the same device', false, String(c.err())); return; }
  const d = driver(c.window);
  const favs = () => { try { return JSON.parse(c.store.getItem(KEY) || '[]'); } catch (e) { return []; } };

  ok('a second profile mounts on the same device', d.text().indexOf(S.DISCLAIMER) !== -1);
  eq('the store still holds the first profile\'s favourites', favs().length, before.length);
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0], 'favourites');
  await tick(100);
  ok('THE SECOND PROFILE SEES NONE OF THE FIRST\'S SAVED REPLIES',
    d.text().indexOf(S.FAV_EMPTY_HEAD) !== -1, cps(d.text().slice(0, 220)));
  eq('...and no remove button is offered for them',
    d.all('button').filter((b) => b.getAttribute('aria-label') === S.FAV_DEL).length, 0);

  // the second profile stars the SAME answer
  await d.click(d.byText(S.BACK), 'back');
  await tick(80);
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').trim() === 'التوأم الأول')[0], 'first twin');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the reply');
  ok('...and its own star on the same answer is EMPTY', !!d.byLabel(S.FAV_ADD));
  await d.click(d.byLabel(S.FAV_ADD), 'star as the second profile');
  await tick(60);
  const after = favs();
  eq('starring it ADDS a record rather than replacing one', after.length, before.length + 1);
  const mine = after.filter((r) => r.pk === PROFILE_B.pid);
  const theirs = after.filter((r) => r.pk === PROFILE.pid);
  eq('...one owned by the second profile', mine.length, 1);
  eq('THE FIRST PROFILE\'S RECORDS ARE UNTOUCHED', theirs.length, before.length);
  ok('...byte for byte', JSON.stringify(theirs) === JSON.stringify(before), JSON.stringify(theirs.map((r) => r.id)));

  // a record with no owner is shown to nobody
  c.store.setItem(KEY, JSON.stringify([{ id: 'orphan|-|0|x', text: 'a reply with no owner', at: 1, snippet: 'x' }]));
  const readBack = plain(c.grab('ezikReadFavs')());
  eq('A RECORD WITH NO PROFILE IS SHOWN TO NOBODY', readBack, []);
}

// ===========================================================================
// PART G — A REPLY MUST NOT SHRINK WHEN ITS STREAM ENDS
// ===========================================================================
// The fold used to apply the moment a reply settled, so a long answer the child had just watched
// arrive collapsed under them. This drives the REAL streaming path — the shipped callAI, reading a
// real SSE body frame by frame — and checks the two states either side of the transition.
//
// linkedom has no layout, so "the height did not change" is measured as the rendered TEXT of the
// bubble: the tail of the reply is on screen during the stream and is STILL on screen after it
// settles. That is the same claim in the only terms this DOM can express; the pixel claim belongs
// to the device video.
function sseStream(text, chunks) {
  const parts = [];
  const size = Math.ceil(text.length / chunks);
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  const frames = parts.map((p) => 'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: p } }) + '\n\n');
  frames.push('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
  let at = 0;
  const gate = { hold: false };
  const reader = {
    read: () => new Promise((resolve) => {
      const step = () => {
        if (gate.hold && at >= frames.length - 1) { setTimeout(step, 10); return; }   // park before the last frame
        if (at >= frames.length) { resolve({ done: true, value: undefined }); return; }
        const f = frames[at++];
        resolve({ done: false, value: Buffer.from(f, 'utf8') });
      };
      setTimeout(step, 5);
    }),
  };
  return { gate, response: { ok: true, status: 200, headers: { get: () => null }, body: { getReader: () => reader }, text: () => Promise.resolve(''), json: () => Promise.resolve({}) } };
}

async function partGStreaming() {
  console.log('\n=== G. A STREAMED REPLY DOES NOT SHRINK WHEN IT SETTLES ===');
  const c = buildContext({ seed: { child_profile: JSON.stringify(PROFILE), disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED }, mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts on an empty thread', false, String(c.err())); return; }
  const d = driver(c.window);
  ok('the app mounts on an empty thread', d.text().indexOf(S.DISCLAIMER) !== -1);

  // The stream the app will read: the SAME long reply the fold checks use, so it certainly folds.
  const REPLY = longReply();
  const built = sseStream(REPLY, 12);
  built.gate.hold = true;                       // park the stream one frame from the end
  c.window.fetch = function () { return Promise.resolve(built.response); };

  const composer = () => d.all('textarea')[0];
  await d.type(composer(), S.Q_USER);
  const sendBtn = d.all('button').filter((b) => b.querySelector('polygon'))[0];
  if (!ok('the send button is on the composer', !!sendBtn)) return;
  await d.click(sendBtn, 'send');

  // ---- DURING the stream ----
  await waitFor(() => d.text().indexOf(S.W_TAIL) !== -1, 'the streamed reply to reach its tail', 200);
  ok('the whole reply is on screen WHILE it streams', d.text().indexOf(S.W_TAIL) !== -1);
  ok('...and no fold toggle is offered on a live stream',
    !d.byLabel(S.FOLD_OPEN) && !d.byLabel(S.FOLD_CLOSE));
  const duringLen = d.text().length;

  // ---- the transition ----
  built.gate.hold = false;
  await waitFor(() => !!d.byLabel(S.FOLD_CLOSE) || !!d.byLabel(S.FOLD_OPEN), 'the reply to settle', 200);
  const afterLen = d.text().length;

  ok('THE TAIL IS STILL ON SCREEN AFTER THE STREAM ENDS — nothing collapsed',
    d.text().indexOf(S.W_TAIL) !== -1, 'the reply folded itself the moment it finished arriving');
  ok('...so the rendered reply did not shrink across the transition',
    afterLen >= duringLen - 40, 'during=' + duringLen + ' after=' + afterLen);
  ok('...and the toggle offers to HIDE, not to show', !!d.byLabel(S.FOLD_CLOSE) && !d.byLabel(S.FOLD_OPEN));
  ok('...and its cards arrived with it', d.text().indexOf(S.HADITH_BODY) !== -1 && d.text().indexOf(S.SRC_SITE) !== -1);

  // ---- the user still owns it ----
  await d.click(d.byLabel(S.FOLD_CLOSE), 'fold it by hand');
  ok('the reader can fold it', d.text().indexOf(S.W_TAIL) === -1 && !!d.byLabel(S.FOLD_OPEN));
  await d.click(d.byLabel(S.FOLD_OPEN), 'unfold it again');
  ok('...and open it again', d.text().indexOf(S.W_TAIL) !== -1 && !!d.byLabel(S.FOLD_CLOSE));

  // ---- nothing about this is stored ----
  const keys = c.store._keys().filter((k) => /stream|fold|open/i.test(k));
  eq('the expanded state is never written to storage', keys, []);

  // ---- reopening the SAME conversation folds it again ----
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  const row = d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER)[0];
  if (!ok('the conversation it created is in the menu', !!row)) return;
  await d.click(row, 'reopen it');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the reopened conversation');
  ok('REOPENING THE SAME CONVERSATION SHOWS IT FOLDED AGAIN',
    !!d.byLabel(S.FOLD_OPEN) && d.text().indexOf(S.W_TAIL) === -1, 'it reopened expanded');

  // ---- and a NEW chat inherits nothing ----
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.byText(S.NEW_CHAT), 'new chat');
  await tick(80);
  ok('a new chat starts empty', d.text().indexOf(S.W_HEAD) === -1);
  ok('...with no runtime error anywhere on this path', !c.err(), String(c.err()));
}

// ===========================================================================
// PART F — LOCAL SEARCH
// ===========================================================================
function partFPure() {
  console.log('\n=== F. LOCAL SEARCH — the matcher, run for real ===');
  const c = buildContext({ seed: {} });
  const norm = c.grab('ezikSearchNormalize');
  const q = c.grab('ezikSearchQuery');
  const plain0 = c.grab('ezikSearchPlain');
  const snippet = c.grab('ezikSearchSnippet');
  const searchChats = c.grab('ezikSearchChats');
  const searchFavs = c.grab('ezikSearchFavs');
  if (!ok('the search helpers are on the page', typeof norm === 'function' && typeof searchChats === 'function')) return;

  // 12) ARABIC NORMALISATION — the whole point of the feature on this language.
  const N = (x) => norm(x).text;
  eq('diacritics are ignored', N(S.S_HARAKAT), N(S.S_PLAIN));
  eq('the alif forms are unified', N(S.S_BARE), N(S.S_PLAIN));
  eq('...including the wasla form', N('ٱلاسلام'), N(S.S_PLAIN));
  eq('the dotless ya is folded onto the ya', N('علي'), N('على'));
  eq('the tatweel is ignored', N('اســـلام'), N('اسلام'));
  eq('runs of whitespace collapse', N('  a\n\n\t b  '), ' a b ');
  eq('latin case is ignored', N('HeLLo'), 'hello');
  eq('a query is normalised and trimmed', q('  ' + S.S_HARAKAT + ' '), N(S.S_PLAIN));
  eq('an empty query normalises to nothing', q('   '), '');
  eq('a null query does not throw', q(null), '');

  // the index map, which is what makes a snippet land on the right characters
  const withMarks = S.S_HARAKAT + ' ' + S.W_TAIL;
  const nm = norm(withMarks);
  eq('the map has one entry per normalised character', nm.map.length, nm.text.length);
  ok('...and every entry points inside the source',
    nm.map.every((i) => i >= 0 && i < withMarks.length));
  const hitAt = nm.text.indexOf(N(S.W_TAIL));
  ok('a hit found in the normalised text maps back to the source', hitAt > 0);
  const snip = snippet(withMarks, nm.map, hitAt, N(S.W_TAIL).length);
  ok('...and the snippet cut from the SOURCE contains the word as written, marks and all',
    snip.indexOf(S.W_TAIL) !== -1, cps(snip));

  // card markup never reaches a snippet, but the words inside a card do
  const withCards = 'قبل <hadith narrator="x" ruling="y">' + S.HADITH_BODY + '</hadith> بعد';
  const p = plain0(withCards);
  ok('card markup is stripped before indexing', p.indexOf('<') === -1, cps(p.slice(0, 40)));
  ok('...but the words inside the card are still searchable', p.indexOf(S.HADITH_BODY) !== -1);

  // matching over rows
  const rows = [
    { id: 'A', title: S.S_PLAIN, at: 2, pinned: false, body: 'body a', hay: N('body a'), map: norm('body a').map, titleHay: N(S.S_PLAIN) },
    { id: 'B', title: 'other', at: 1, pinned: false, body: S.S_HARAKAT + ' inside the body', hay: norm(S.S_HARAKAT + ' inside the body').text, map: norm(S.S_HARAKAT + ' inside the body').map, titleHay: N('other') },
    { id: 'C', title: 'none', at: 0, pinned: false, body: 'nothing here', hay: N('nothing here'), map: norm('nothing here').map, titleHay: N('none') },
  ];
  const res = plain(searchChats(rows, q(S.S_BARE)));
  eq('a bare-alif query finds the diacritised title and the diacritised body', res.map((r) => r.id), ['A', 'B']);
  ok('...and each result carries a snippet', res.every((r) => typeof r.snippet === 'string'));
  ok('...with no tag in it', res.every((r) => r.snippet.indexOf('<') === -1));
  eq('an empty query matches nothing at all', plain(searchChats(rows, '')), []);
  eq('a query nothing holds matches nothing', plain(searchChats(rows, q('zzzz'))), []);
  // 'n' is in B's body ("inside") and in C's title and body, and in neither of A's — so a hit set
  // of exactly {B, C} in that order is the store order surviving, not an accident of the query.
  eq('the order is the store\'s own, never re-ranked', plain(searchChats(rows, q('n'))).map((r) => r.id), ['B', 'C']);

  // favourites
  const favs = [
    { id: 'f1', text: 'قبل <source site="x" url="y">' + S.S_HARAKAT + '</source> بعد', snippet: '', at: 1, chatId: null, pk: null },
    { id: 'f2', text: 'nothing', snippet: '', at: 2, chatId: null, pk: null },
  ];
  const fres = plain(searchFavs(favs, q(S.S_BARE)));
  eq('the favourites search finds a word inside a saved source card', fres.map((f) => f.id), ['f1']);
  ok('...and its hit line carries no tag', fres[0].hit.indexOf('<') === -1, cps(fres[0].hit));
  eq('an empty favourites query matches nothing', plain(searchFavs(favs, '')), []);
  eq('searching an empty favourites list is safe', plain(searchFavs([], q('a'))), []);
  eq('searching a null favourites list is safe', plain(searchFavs(null, q('a'))), []);
}

// The search, driven through the real menu — including 13) it must reach no network, and
// 14) opening a result must use the SAME path and land at the end of the conversation.
const MANY = 42;
function seedManyChats() {
  const seed = {
    child_profile: JSON.stringify(PROFILE),
    disclosureAck: '1', ezik_ai_consent_v1: AI_CONSENT_SEED,
  };
  const index = [];
  for (let i = 0; i < MANY; i++) {
    const id = 'M' + i;
    index.push({ id: id, pk: PROFILE.pid, title: 'محادثة ' + i, pinned: false, at: 1000 + i });
    // exactly ONE conversation carries the diacritised word; the rest are noise of the same size
    const marked = (i === 7);
    const msgs = [];
    for (let k = 0; k < 8; k++) {
      msgs.push({ role: 'user', content: 'سؤال ' + i + ' ' + k });
      msgs.push({ role: 'assistant', content: (marked && k === 3)
        ? ('جواب فيه ' + S.S_HARAKAT + ' ثم بقية الكلام')
        : ('جواب عادي ' + i + ' ' + k + ' ' + 'حشو '.repeat(30)) });
    }
    seed['ezik_chat_v1_' + id] = JSON.stringify(msgs);
  }
  seed.ezik_chats_v1 = JSON.stringify(index);
  return seed;
}

async function partFDrawer() {
  console.log('\n--- search, driven through the real menu ---');
  const c = buildContext({ seed: seedManyChats(), mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts with 42 saved conversations', false, String(c.err())); return c; }
  const d = driver(c.window);
  ok('the app mounts with ' + MANY + ' saved conversations', d.text().indexOf(S.DISCLAIMER) !== -1);

  const netAtStart = c.net().length;
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  eq('opening the menu makes no network request', c.net().length, netAtStart);
  const box = d.all('input').filter((i) => i.getAttribute('type') === 'search')[0];
  if (!ok('the menu carries a search box', !!box)) return c;
  ok('...with an accessible name', !!box.getAttribute('aria-label'));

  // 12 + 14) a BARE-ALIF, UNDIACRITISED query finds the diacritised conversation
  await d.type(box, S.S_BARE);
  await tick(60);
  eq('searching makes no network request at all', c.net().length, netAtStart);
  const resultRows = d.all('button').filter((b) => /محادثة 7/.test(String(b.textContent || '')));
  ok('an undiacritised query finds the diacritised conversation', resultRows.length === 1,
    'matched rows: ' + d.all('button').filter((b) => /محادثة \d/.test(String(b.textContent || ''))).length);
  ok('...and the other 41 are not listed',
    d.all('button').filter((b) => /محادثة \d/.test(String(b.textContent || ''))).length === 1);
  ok('...the result shows a snippet of what matched', d.text().indexOf('ثم بقية الكلام') !== -1, cps(d.text().slice(0, 200)));
  ok('...and no raw tag anywhere in the menu', d.text().indexOf('<') === -1);

  // a query that matches nothing says so, and does not empty the menu of its entries
  await d.type(box, 'zzzzzz');
  await tick(60);
  ok('a query with no match says so', d.text().indexOf(S.SEARCH_NONE) !== -1, cps(d.text().slice(0, 200)));
  ok('...and the menu keeps its own entries', d.text().indexOf(S.NEW_CHAT) !== -1);

  // 14) opening a result: the SAME path, and the conversation opens AT ITS END
  await d.type(box, S.S_BARE);
  await tick(60);
  const hit = d.all('button').filter((b) => /محادثة 7/.test(String(b.textContent || '')))[0];
  if (!ok('the result can be opened', !!hit)) return c;
  await d.click(hit, 'open the result');
  await tick(120);
  ok('opening a result closes the menu', d.text().indexOf(S.NEW_CHAT) === -1);
  ok('...and puts that conversation on screen', d.text().indexOf('سؤال 7 0') !== -1, cps(d.text().slice(0, 200)));
  eq('...having made no network request for any of it', c.net().length, netAtStart);

  // 15) WHERE it opens is S97's contract and chat-history-guard part D measures it with a real
  // scroll recorder. linkedom has no layout, so a second measurement here would be theatre; what
  // this gate adds instead is that a search result takes the SAME route — see part E, which reads
  // the result row and the ordinary row off the file and requires both to be
  // closeDrawerWith(() => openSavedChat(id)). One route, one scroll behaviour, nothing new to fix.

  // reopening the menu clears the box, so it never reopens on a stale query
  await d.click(d.byLabel(S.MENU_OPEN), 'menu again');
  const box2 = d.all('input').filter((i) => i.getAttribute('type') === 'search')[0];
  eq('reopening the menu clears the search box', String(box2 && box2.value || ''), '');
  ok('...and the ordinary conversation list is back',
    d.all('button').filter((b) => /محادثة \d/.test(String(b.textContent || ''))).length > 1);
  return c;
}

async function partFFavs() {
  console.log('\n--- search inside the favourites ---');
  const c = buildContext({ seed: seedChats(), mount: true });
  await tick(400);
  if (c.err()) { ok('the app mounts for the favourites search', false, String(c.err())); return c; }
  const d = driver(c.window);

  // save two replies: only one carries the searched word
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER)[0], 'long chat');
  await waitFor(() => d.text().indexOf(S.W_HEAD) !== -1, 'the long reply');
  await d.click(d.byLabel(S.FAV_ADD), 'star the long reply');
  await tick(60);
  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').trim() === S.Q_USER + ' 2')[0], 'short chat');
  await waitFor(() => d.text().indexOf(S.A_SHORT) !== -1, 'the short reply');
  await d.click(d.byLabel(S.FAV_ADD), 'star the short reply');
  await tick(60);

  await d.click(d.byLabel(S.MENU_OPEN), 'menu');
  await d.click(d.all('button').filter((b) => String(b.textContent || '').indexOf(S.FAV) !== -1)[0], 'favourites');
  await tick(100);
  ok('both saved replies are on the favourites screen',
    d.text().indexOf(S.W_HEAD) !== -1 && d.text().indexOf(S.A_SHORT) !== -1, cps(d.text().slice(0, 200)));
  const box = d.all('input').filter((i) => i.getAttribute('type') === 'search')[0];
  if (!ok('the favourites screen carries its own search box', !!box)) return c;
  ok('...with an accessible name', !!box.getAttribute('aria-label'));

  const netAtStart = c.net().length;
  await d.type(box, S.W_TAIL);
  await tick(60);
  ok('searching the favourites narrows them to the match', d.text().indexOf(S.W_HEAD) !== -1 && d.text().indexOf(S.A_SHORT) === -1,
    cps(d.text().slice(0, 200)));
  eq('...and reaches no network', c.net().length, netAtStart);
  await d.type(box, 'zzzzz');
  await tick(60);
  ok('a favourites query with no match says so', d.text().indexOf(S.SEARCH_NONE) !== -1, cps(d.text().slice(0, 200)));
  ok('...and does not crash the screen', !c.err(), String(c.err()));
  await d.type(box, '');
  await tick(60);
  ok('clearing the query brings every favourite back',
    d.text().indexOf(S.W_HEAD) !== -1 && d.text().indexOf(S.A_SHORT) !== -1);
  return c;
}

// ===========================================================================
// PART E — THE WIRING, READ OFF THE FILE
// ===========================================================================
function partE() {
  console.log('\n=== E. THE WIRING (index.html, and what this phase must NOT have touched) ===');
  const decoded = html.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // 20) nothing outside the web app moved. Read from git, so it is the real diff and not a guess.
  let changed = [];
  try {
    changed = require('child_process')
      .execSync('git diff --name-only HEAD', { cwd: __dirname, encoding: 'utf8' })
      .split('\n').map((x) => x.trim()).filter(Boolean);
  } catch (e) { changed = null; }
  if (changed === null) {
    ok('the changed-file set can be read from git', false, 'git unavailable — cannot prove the blast radius');
  } else {
    // The PERMANENT blast radius: native wrappers, the API, the service worker, the manifest, and
    // every file that carries scripture or the question bank. quest.html itself was on this list
    // while S98 was the only phase in flight and the game page was out of scope; S100 changed that
    // by instruction, so the page moved off the list and the thing that actually needed protecting
    // — the CONTENT of the bank — is asserted directly below instead. That is strictly more than
    // the path check said: a quest-data file could have been rewritten in place and still passed
    // a name-only check if it had somehow been staged, whereas a hash cannot be talked around.
    // `api/` and `lib/` were on this list while S98 was a web-only phase and the server was out
    // of scope by instruction. They are off it now, because a later phase changed the server
    // deliberately (the scholar-attribution gate lives in api/ask.js and lib/), and a path check
    // that forbids what the current work is FOR stops being a guard and becomes an obstacle.
    // Nothing is lost by it: the server has its own gates — classifier-guard, referral-guard and
    // attribution-guard. What remains here is the set that no web phase and no server phase may
    // move: the native wrappers, the manifest, the service worker, the deployment config, and
    // every file carrying scripture or the question bank.
    const FORBIDDEN = /^(android|ios|capacitor|quest-data)\/|^(manifest\.json|sw\.js|vercel\.json|adhkar\.json|quran-uthmani\.json|mushaf-layout\.json|worship-display\.json)$/;
    const bad = changed.filter((f) => FORBIDDEN.test(f));
    eq('no manifest, service worker, platform or scripture file is modified', bad, []);
    // The SHA-256 seal on those same thirteen files used to sit right here, inside this `else`.
    // That made the strongest promise in the repository conditional on `git` being installed:
    // where git was absent the seal did not fail, it did not run. It now lives in
    // quest-bank-integrity-guard.cjs (gate `bankintegrity`, check B10), where it runs on every
    // tree with no condition attached. One source, not two — do not re-add a copy here.
  }

  // 19) every style key this phase adds is a token, so light and dark both work by construction
  const c = buildContext({ seed: {} });
  const s = plain(c.grab('s') || {});
  const NEW_KEYS = ['foldToggle', 'quickRow', 'quickBtn', 'drawerSearchWrap', 'drawerSearch',
    'drawerEmpty', 'drawerSnippet', 'drawerBadge', 'favScreen', 'favBody', 'favCard',
    'favMeta', 'favText', 'favRow', 'favBtn', 'favBtnOff'];
  NEW_KEYS.forEach((k) => { ok('the new style key ' + k + ' exists', !!s[k]); });
  const literal = [];
  NEW_KEYS.forEach((k) => {
    const v = s[k] || {};
    Object.keys(v).forEach((prop) => {
      const val = String(v[prop]);
      if (/#[0-9a-fA-F]{3,8}\b/.test(val) || /\brgba?\(/.test(val)) literal.push(k + '.' + prop + '=' + val);
    });
  });
  eq('no new style key carries a hardcoded colour — every one is a token', literal, []);
  // 320px: nothing new may declare a fixed width that cannot shrink
  const wide = [];
  NEW_KEYS.forEach((k) => {
    const v = s[k] || {};
    if (typeof v.width === 'number' && v.width > 280) wide.push(k + '.width=' + v.width);
    if (typeof v.minWidth === 'number' && v.minWidth > 280) wide.push(k + '.minWidth=' + v.minWidth);
  });
  eq('nothing new is pinned wider than a 320px screen', wide, []);
  // touch targets
  const small = [];
  ['foldToggle', 'quickBtn', 'drawerSearch', 'favBtn'].forEach((k) => {
    const v = s[k] || {};
    if (!(typeof v.minHeight === 'number' && v.minHeight >= 40)) small.push(k + '.minHeight=' + v.minHeight);
  });
  eq('every new tappable surface is at least 40px tall', small, []);

  // the focus ring and the reduced-motion rule exist, and reduce is SCOPED (a blanket rule would
  // freeze the mushaf page turn, which resolves a promise on animationend)
  ok('a keyboard focus ring is declared for the new controls', /\.ezik-focus:focus-visible\s*\{/.test(html));
  const rm = html.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n  \}/);
  ok('a reduced-motion rule is declared', !!rm);
  // SCOPED, and this is the check that matters. A blanket `*{animation:none}` would freeze the
  // mushaf page turn, which resolves a promise on animationend — the screen would hang forever.
  // So every selector in the rule must name an S98 class; `.ezik-focus *` is a descendant of one
  // and is fine, a bare `*` is not.
  const rmSelectors = rm ? (rm[1].match(/^[^{}]+(?=\{)/gm) || []).join(',').split(',').map((x) => x.trim()).filter(Boolean) : [];
  const unscoped = rmSelectors.filter((sel) => sel.indexOf('.ezik-') !== 0);
  eq('...and every selector in it is scoped to an S98 class, never a bare *', unscoped, []);
  ok('...and it names at least one', rmSelectors.length > 0);

  // the quick actions go through sendMessage and through nothing else
  ok('the quick action runner calls the shipped sendMessage', /runQuickAction\s*=\s*\([\s\S]{0,400}?sendMessage\(prompt\)/.test(decoded));
  ok('...guarded by a synchronous ref, not by state alone', /quickBusyRef\.current\s*=\s*true/.test(decoded));
  ok('...and it is rendered exactly once in the tree', (decoded.split('EZIK_QUICK_ACTIONS.map').length - 1) === 1);
  ok('the quick actions never render during a stream', /quickActionsVisible[\s\S]{0,320}?streamingText === null/.test(decoded));
  ok('...nor under a user message', /quickActionsVisible[\s\S]{0,320}?lastMsg\.role === 'assistant'/.test(decoded));
  ok('...nor under one of the client\'s own error lines', /quickActionsVisible[\s\S]{0,400}?ezikIsErrorReply\(lastMsg\.content\)/.test(decoded));

  // ONE RENDERER, and this is what keeps a raw tag off the favourites screen forever: the chat
  // bubble and the favourites card must both go through ezikRenderSegments and neither may grow a
  // map of its own. A second mapping is how the two would eventually drift.
  eq('the segment renderer is defined exactly once', (decoded.split('function ezikRenderSegments').length - 1), 1);
  const callers = (decoded.match(/ezikRenderSegments\(/g) || []).length - 1;   // minus the definition
  eq('...and both display sites call it', callers, 2);
  ok('...so no screen maps segments to cards on its own',
    !/segments\.map\(\(seg/.test(decoded) && !/\.map\(\(seg, i\) => \{[\s\S]{0,200}seg\.type === 'verse'/.test(decoded));
  ok('the favourites card renders through it', /function FavoriteReplyBody[\s\S]{0,900}?ezikRenderSegments\(shown/.test(decoded));
  ok('...and the favourites screen draws its replies with that card',
    /function FavoritesScreen[\s\S]{0,2600}?<FavoriteReplyBody /.test(decoded));
  // The fold reaches BOTH surfaces, through the same function and the same pair of labels — a
  // long favourite that could not be folded pushed its own copy/remove/open buttons off-screen.
  ok('the favourites card folds a long reply too',
    /function FavoriteReplyBody[\s\S]{0,600}?ezikFoldSegments\(segments, EZIK_FOLD_MIN_CHARS, EZIK_FOLD_HEAD_CHARS\)/.test(decoded));
  eq('the fold labels are declared once and shared', (decoded.match(/const EZIK_FOLD_SHOW = /g) || []).length, 1);
  ok('...and both surfaces use them, not their own strings',
    (decoded.match(/EZIK_FOLD_SHOW/g) || []).length >= 3 && (decoded.match(/EZIK_FOLD_HIDE/g) || []).length >= 3);

  // FAVOURITES: separate store, separate key, and it never touches the conversation schema.
  ok('the favourites key is its own versioned key', /const EZIK_FAVS_KEY = 'ezik_favorite_replies_v1';/.test(decoded));
  ok('the conversation autosave never reads or writes it',
    !/ezikSaveChat[\s\S]{0,900}?EZIK_FAVS_KEY/.test(decoded));
  ok('deleting a conversation never touches it',
    !/function ezikDeleteChat[\s\S]{0,300}?EZIK_FAVS_KEY/.test(decoded));
  ok('...and «delete all my data» does', /ezikClearAllChats\(\);[\s\S]{0,400}?ezikClearAllFavs\(\);/.test(decoded));
  ok('the store is read ONCE into state, not on a render path',
    /const \[favs, setFavs\] = useState\(ezikReadFavs\);/.test(decoded));
  ok('...and the bubble is handed a boolean, never a store',
    /isFavorite=\{favFlags\[i\]\}/.test(decoded));
  // The dependency list must carry the profile and the conversation too, because both are now
  // terms of the identity — a memo keyed on the thread alone would keep drawing the stars of the
  // conversation the user just left.
  ok('...computed once per change of the thread, conversation, profile or favourites',
    /const favFlags = React\.useMemo\([\s\S]{0,500}?\[messages, favIdSet, favPk, chatId\]\);/.test(decoded));
  ok('...and it asks the identity function, not the bare text hash',
    /favIdSet\.has\(ezikFavId\(favPk, chatId, i, m\.content\)\)/.test(decoded));
  // ===== THE KEYSTROKE PATH =====
  // Measured, interleaved, 440 keystrokes a side: adding a quote button and a star to every reply
  // cost +0.39 ms per keystroke in a 120-turn thread (1.20 -> 1.60 ms, Welch t=14.4) because the
  // composer's state lives on App and every bubble was rebuilt. Pinning the props and memoising
  // the bubble took it to 0.50 ms — BELOW the baseline. These checks are what keep it there.
  ok('MessageBubble is memoised', /const MessageBubble = React\.memo\(function MessageBubble\(/.test(decoded));
  const PINNED = ['cbSuggestion', 'cbPlayVerse', 'cbPlaySurah', 'cbStopAudio', 'cbPlayMessage',
    'cbToggleTashkeel', 'cbQuote', 'cbFavorite', 'cbReport'];
  PINNED.forEach((cb) => {
    ok('...and ' + cb + ' is pinned to one identity',
      new RegExp('const ' + cb + ' = React\\.useCallback\\([\\s\\S]{0,220}?\\}?\\, \\[\\]\\);').test(decoded)
      || new RegExp('const ' + cb + ' = React\\.useCallback\\([^;]{0,240}, \\[\\]\\);').test(decoded),
      cb + ' is not a useCallback with an empty dependency list');
  });
  const bubbleTag = (decoded.match(/<MessageBubble [^>]*\/>/) || [''])[0];
  ok('the bubble is handed only pinned callbacks and primitives', !!bubbleTag && !/=\{\(/.test(bubbleTag),
    'an inline arrow is still being passed to the bubble: ' + bubbleTag.slice(0, 240));
  ok('...and the latest implementations reach it through a ref refreshed after each render',
    /const bubbleFnRef = useRef\(\{\}\);\s*useEffect\(\(\) => \{/.test(decoded));
  // The S94 trap, again: the effect above closes over openReport, and an effect runs after the
  // component function returns — so on a screen App leaves early, a later `const` would still be
  // in its temporal dead zone. This is the ordering that stops it throwing at the first commit.
  const openReportAt = decoded.indexOf('const openReport = (aiMsg, prevMsg)');
  const firstEarlyReturn = decoded.search(/\n  if \(screen === /);
  ok('openReport is declared above every early return', openReportAt !== -1 && openReportAt < firstEarlyReturn,
    'openReport at ' + openReportAt + ', first `if (screen === ` return at ' + firstEarlyReturn);

  // MessageBubble's own body, isolated: from its signature to the next top-level declaration.
  const mbStart = decoded.indexOf('function MessageBubble(');
  const mbEnd = decoded.indexOf('\n// =====', mbStart);
  const mbBody = (mbStart !== -1 && mbEnd > mbStart) ? decoded.slice(mbStart, mbEnd) : '';
  ok('MessageBubble\'s body was located for inspection', mbBody.length > 500, 'len=' + mbBody.length);
  ok('...and it touches no store at all', mbBody.indexOf('localStorage') === -1, 'localStorage inside MessageBubble');
  ok('...and never reads the favourites list', mbBody.indexOf('ezikReadFavs') === -1 && mbBody.indexOf('EZIK_FAVS_KEY') === -1);
  ok('...and never parses JSON', mbBody.indexOf('JSON.parse') === -1);
  ok('the lookup a bubble is answered from is a Set built once',
    /const favIdSet = React\.useMemo\(\(\) => \{[\s\S]{0,300}?new Set\(\)[\s\S]{0,300}?\}, \[myFavs\]\);/.test(decoded));

  // SEARCH: local only, and one route into a conversation.
  ok('a search result opens through the SAME path an ordinary menu row uses',
    (decoded.match(/closeDrawerWith\(\(\) => openSavedChat\(/g) || []).length === 2,
    'openSavedChat call sites in the drawer: ' + (decoded.match(/closeDrawerWith\(\(\) => openSavedChat\(/g) || []).length);
  // Exactly three CALLS: the ordinary menu row, the search result row, and the favourites
  // screen's "open the original". Every one of them is the S97 path; there is no fourth.
  ok('...so nothing new scrolls, and no second navigation path exists',
    (decoded.match(/openSavedChat\(/g) || []).length === 3,
    'openSavedChat call sites: ' + (decoded.match(/openSavedChat\(/g) || []).length);
  ok('the search matcher is called with the corpus, never with a fetch',
    !/ezikSearchChats[\s\S]{0,400}?fetch\(/.test(decoded));
  ok('the corpus is built lazily, behind a non-empty query',
    /const chatResults = React\.useMemo\(\(\) => \{\s*const q = ezikSearchQuery\(chatQuery\);\s*if \(!q\) return null;/.test(decoded));
  ok('...and cached against the conversation list\'s own identity',
    /searchCorpusRef\.current\.key === key/.test(decoded));
  ok('opening the menu builds no corpus',
    /const openDrawer = \(\) => \{[^}]*\};/.test(decoded)
      && !/const openDrawer = \(\) => \{[^}]*getSearchCorpus/.test(decoded));
  ok('the favourites search runs over the records already in memory',
    /ezikSearchFavs\(myFavs, q\)/.test(decoded));
  ok('no search path calls the network or the model',
    !/ezikSearch[A-Za-z]*\([\s\S]{0,600}?(fetch\(|callAI\()/.test(decoded));
  ok('no search index is written to storage',
    !/localStorage\.setItem\([^)]*search/i.test(decoded));
  ok('the search normalizer is its own, leaving normalizeArabic untouched',
    /const normalizeArabic = \(str\) => \(str \|\| ''\)\s*\n\s*\.replace\(\/\[ً-ْٰـ\]\/g, ''\)/.test(html)
      || /const normalizeArabic = \(str\)/.test(decoded));

  // the quote writes to the composer only
  ok('the quote handler writes to the composer', /quoteReply = \([\s\S]{0,600}?setInput\(/.test(decoded));
  ok('...and calls no send path at all', !/quoteReply = \([\s\S]{0,900}?sendMessage\(/.test(decoded));

  // ===== THE STREAMED-REPLY RULE, read off the file =====
  ok('the expanded set is state, not storage',
    /const \[streamedOpen, setStreamedOpen\] = useState\(\(\) => new Set\(\)\);/.test(decoded));
  ok('...and is never written to localStorage', !/localStorage\.setItem\([^)]*streamedOpen/.test(decoded));
  ok('it is filled at the REAL streaming transition, beside the finished reply',
    /setStreamingText\(null\);[\s\S]{0,700}?markStreamedOpen\(final\.length - 1\);/.test(decoded));
  ok('...never from a text comparison',
    !/markStreamedOpen\([^)]*content/.test(decoded) && !/markStreamedOpen\([^)]*text/.test(decoded));
  ok('...and never from a timer', !/setTimeout\([^)]{0,80}markStreamedOpen/.test(decoded)
    && !/markStreamedOpen[\s\S]{0,40}setTimeout/.test(decoded));
  ok('opening a saved conversation empties it', /setMessages\(ezikReadChatMessages\(id\)\);\s*setStreamedOpen\(new Set\(\)\);/.test(decoded));
  ok('...and so does starting a new thread', /const resetThread = \(\)[\s\S]{0,700}?setStreamedOpen\(new Set\(\)\);/.test(decoded));
  ok('both also retire every manual expand, through the thread epoch',
    (decoded.match(/newThreadEpoch\(\);/g) || []).length === 2);
  ok('the bubble keys the reader\'s own toggle to that epoch',
    /foldOverride\.epoch === foldEpoch/.test(decoded));
  ok('...so a reopened conversation cannot inherit it', /setFoldOverride\(\{ epoch: foldEpoch, open: !foldOpen \}\)/.test(decoded));
  ok('nothing here adds a listener or an observer per message',
    !/messages\.map\([\s\S]{0,400}?addEventListener/.test(decoded)
    && !/messages\.map\([\s\S]{0,400}?ResizeObserver/.test(decoded));

  // 15-17) the S97 scroll contract is still the one that shipped
  ok('opening a conversation still pins the container before paint (layout effect)',
    /React\.useLayoutEffect\(\(\) => \{\s*if \(!jumpToEndRef\.current\) return;/.test(decoded));
  ok('...and the follow effect still refuses to drag a reader back down',
    /if \(!stickToEndRef\.current\) return;/.test(decoded));
  // The page owns exactly TWO animated scrolls and neither this phase nor S99 added one: the
  // chat's follow effect, and the home screen's jump to the favourites strip.
  //
  // S99 STRENGTHENED THIS. It used to count the literal `behavior: 'smooth'`, and the reading
  // preferences made the chat's scroll conditional -- correctly, because reduced motion must land
  // the correction instantly. Rather than relax the count, the check now enumerates every
  // scrollIntoView that carries a behaviour at all, requires there to be exactly two, requires the
  // chat's to be the reduced-motion DECISION rather than any hardcoded value, and requires the
  // other to be the home one. A third animated scroll, or a chat scroll that stopped honouring
  // reduced motion, both fail here.
  const scrolls = (decoded.match(/^.*scrollIntoView\(\{[^}]*behavior[^}]*\}.*$/gm) || [])
    .map((l) => l.trim())
    .filter((l) => l.indexOf('//') !== 0 && l.indexOf('*') !== 0);   // the S97 note quotes the old line
  // S103: one, not two. The second was the deleted deck browser's jump-to-favourites; the
  // invariant that every animated scroll honours reduced motion is asserted below, unchanged.
  eq('there is still exactly one animated scroll on the page', scrolls.length, 1);
  ok('...one of them the chat follow effect',
    scrolls.some((l) => l.indexOf('messagesEndRef.current?.scrollIntoView') === 0), scrolls.join(' || '));
  ok('...and it honours reduced motion rather than hardcoding a behaviour',
    scrolls.some((l) => /messagesEndRef[\s\S]*ezikMotionReduced\([^)]*\) \? 'auto' : 'smooth'/.test(l)), scrolls.join(' || '));
  ok('...and so does the other one',
    scrolls.every((l) => /ezikMotionReduced/.test(l)), 'an animated scroll ignores the setting: ' + scrolls.join(' || '));
  ok('...and neither phase introduced a third',
    scrolls.every((l) => l.indexOf('messagesEndRef') !== -1 || l.indexOf('favRef') !== -1), scrolls.join(' || '));

  // no new dependency, no new CDN, no new host of any kind
  const srcs = (html.match(/<script[^>]*src=["']([^"']+)["']/gi) || []).map((t) => (t.match(/src=["']([^"']+)["']/) || [])[1]);
  // THREE, not the five that shipped before: /_vercel/insights and /_vercel/speed-insights were
  // REMOVED for this release, because both began measuring on page load -- before the reader had
  // answered the AI-consent screen. Nothing replaced them. This stays an exact count so that
  // "we dropped two" cannot quietly become "we dropped two and added one".
  eq('the page loads exactly the three scripts it still loads', srcs.length, 3);
  ok('...and neither analytics script is among them',
    !srcs.some((u) => /_vercel\/(insights|speed-insights)/.test(String(u))), srcs.join(' || '));
  const EXPECTED_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'mushaf.almurabbi.app'];
  const hosts = [];
  (html.match(/(?:src|href)=["']https?:\/\/([^\/"']+)/gi) || []).forEach((t) => {
    const h = (t.match(/https?:\/\/([^\/"']+)/) || [])[1];
    if (h && hosts.indexOf(h) === -1) hosts.push(h);
  });
  eq('...and reaches no host it did not already reach', hosts.filter((h) => EXPECTED_HOSTS.indexOf(h) === -1), []);
  // FIVE devDependencies, not the four that stood before: @babel/parser was DECLARED (D35),
  // because classifier-guard.cjs requires it directly and had been resolving on @babel/core's
  // transitive copy. Declaring what we require is the whole change -- the count stays exact so
  // that "we declared one we already used" cannot quietly become "we declared one and added one".
  ok('no dependency was added to package.json',
    (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        return Object.keys(pkg.dependencies || {}).length === 5 && Object.keys(pkg.devDependencies || {}).length === 5;
      } catch (e) { return false; }
    })());
}

// ===========================================================================
(async function main() {
  console.log('=== chat-ux-guard (S98) — ' + htmlFile + ' ===');
  partA();
  await partBC();
  await partQuote();
  partDStore();
  partDDead();
  await partDScreen();
  await partDOrphan();
  const dumpA = await partDIsolation();
  await partDTwoProfiles(dumpA);
  await partGStreaming();
  partFPure();
  await partFDrawer();
  await partFFavs();
  partE();
  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.log('\nGUARD CRASHED: ' + String(e && e.stack ? e.stack : e));
  process.exit(1);
});
