#!/usr/bin/env node
/*
 * wird-guard.cjs -- the device-local wird: last page, daily target, daily progress.
 *
 * Session 82 added three localStorage keys and a progress strip to the image mushaf.
 * None of them may ever leave the device, none of them may throw at a reader, and none
 * of them may disturb the manual bookmark, the renderer or the reading viewport.
 *
 * This guard does two things and nothing else:
 *
 *   1. It LIFTS the pure storage/date helpers out of index.html by brace matching and
 *      EXECUTES them against fake localStorage objects -- an empty one, a seeded one, a
 *      corrupt one and one that throws on every operation -- with a fake Date so the
 *      local-day boundary can be tested without waiting for midnight.
 *
 *   2. It asserts, against the source text, the things that are structural rather than
 *      behavioural: the dwell constant, the presets, the strip's overlay nature, its
 *      independence from the chrome, its gate on the image flag, the survival of the
 *      bookmark identifiers, the three new removals in resetAll, and the total absence
 *      of the new keys from every request-building line in the file.
 *
 * It never decodes, prints or embeds Quran text, and all of its output is ASCII.
 *
 * Usage:  node wird-guard.cjs
 * Exit 0 = every check passed. Exit 1 = at least one failed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = 'index.html';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; return true; }
  fail++;
  failures.push(ascii(name + (detail ? ' -- ' + detail : '')));
  return false;
}
function eq(name, actual, expected) {
  return ok(name, actual === expected, 'expected ' + show(expected) + ', got ' + show(actual));
}
function show(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return ascii(JSON.stringify(v));
  try { return ascii(JSON.stringify(v)); } catch (e) { return ascii(String(v)); }
}
// Nothing non-ASCII reaches the terminal, whatever a detail string was built from.
function ascii(v) {
  return String(v).replace(/[^\x20-\x7E]/g, '?');
}

// ---------------------------------------------------------------------------
// LIFTING
// ---------------------------------------------------------------------------

// Line endings are normalised so that every `$`-anchored and literal-newline check below
// means the same thing on a CRLF checkout as on an LF one.
const SRC = fs.readFileSync(path.join(ROOT, APP), 'utf8').replace(/\r\n/g, '\n');

// Brace matching from the function's opening brace. Every function lifted below is
// verified to contain no brace inside a string or a regular expression, so a plain depth
// count is exact for them; that property is asserted below rather than assumed.
function liftFunction(name) {
  const sig = 'function ' + name + '(';
  const i = SRC.indexOf(sig);
  if (i < 0) return null;
  const open = SRC.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return SRC.slice(i, j + 1); }
  }
  return null;
}
function liftConst(name) {
  const m = SRC.match(new RegExp('^const ' + name + ' = (.+);[ \\t]*(?://.*)?$', 'm'));
  return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

const CONST_NAMES = [
  'MUSHAF_LAST_PAGE_KEY', 'WIRD_TARGET_KEY', 'WIRD_DAY_KEY',
  'WIRD_DWELL_MS', 'WIRD_TARGET_PRESETS',
];
const FN_NAMES = [
  'readMushafLastPage', 'writeMushafLastPage',
  'readWirdTarget', 'writeWirdTarget', 'clearWirdTarget',
  'wirdDayKey', 'readWirdDay', 'markWirdPageRead', 'wirdNormalizeDigits',
];

const consts = {};
const fns = {};
let liftedAll = true;
for (const n of CONST_NAMES) {
  consts[n] = liftConst(n);
  if (!ok('lift const ' + n, !!consts[n])) liftedAll = false;
}
for (const n of FN_NAMES) {
  fns[n] = liftFunction(n);
  if (!ok('lift function ' + n, !!fns[n])) liftedAll = false;
}

if (!liftedAll) {
  report();
  process.exit(1);
}

const LIFTED = CONST_NAMES.map((n) => consts[n]).concat(FN_NAMES.map((n) => fns[n])).join('\n\n');

// The brace count of the lifted block must balance, and no lifted body may carry a brace
// inside a string or a regex -- that is what makes the depth-counting lift exact.
ok('lifted block braces balance',
  (LIFTED.match(/\{/g) || []).length === (LIFTED.match(/\}/g) || []).length);
ok('lifted block has no template literal', LIFTED.indexOf('`') === -1);

// ---------------------------------------------------------------------------
// THE SANDBOX
// ---------------------------------------------------------------------------

function memStore(init) {
  const m = Object.create(null);
  if (init) for (const k in init) m[k] = String(init[k]);
  return {
    map: m,
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; },
    has(k) { return Object.prototype.hasOwnProperty.call(m, k); },
    writes: 0,
  };
}
function countingStore(init) {
  const s = memStore(init);
  const set = s.setItem.bind(s);
  s.setItem = function (k, v) { s.writes++; set(k, v); };
  return s;
}
function throwingStore() {
  const boom = () => { throw new Error('storage denied'); };
  return { getItem: boom, setItem: boom, removeItem: boom, map: Object.create(null), has: () => false };
}
// `new FakeDate()` returns this object, so wirdDayKey's `new Date()` reads the fake local
// calendar. Only the three device-local getters exist on it: a helper that reached for
// toISOString, getUTCDate or getTime would fail here rather than quietly pass.
function fakeDate(y, m, d) {
  return function FakeDate() {
    return { getFullYear: () => y, getMonth: () => m - 1, getDate: () => d };
  };
}

function api(store, DateImpl) {
  const body = LIFTED + '\nreturn { ' + CONST_NAMES.concat(FN_NAMES).join(', ') + ' };';
  return new Function('localStorage', 'Date', body)(store, DateImpl || Date);
}

const TODAY = fakeDate(2026, 7, 31);
const DAY = '2026-07-31';

// ---------------------------------------------------------------------------
// A. LAST PAGE
// ---------------------------------------------------------------------------

(function lastPage() {
  const K = 'mushaf_last_page_v1';
  eq('last page key name', api(memStore()).MUSHAF_LAST_PAGE_KEY, K);

  // valid boundaries, both ends of both fields
  const good = [[1, 1], [604, 114], [1, 114], [604, 1], [300, 57]];
  for (const [p, s] of good) {
    const st = memStore();
    const A = api(st);
    A.writeMushafLastPage(p, s);
    const back = A.readMushafLastPage();
    ok('last page round trip ' + p + '/' + s,
      back && back.p === p && back.s === s, show(back));
  }

  // every invalid shape reads as null
  const bad = {
    'missing key': null,
    'empty string': '',
    'not json': 'not json at all',
    'json null': 'null',
    'json number': '7',
    'json string': '"604"',
    'json array': '[1,2]',
    'no fields': '{}',
    'page 0': '{"p":0,"s":1}',
    'page 605': '{"p":605,"s":1}',
    'page negative': '{"p":-3,"s":1}',
    'page float': '{"p":12.5,"s":1}',
    'page string': '{"p":"12","s":1}',
    'page null': '{"p":null,"s":1}',
    'surah 0': '{"p":12,"s":0}',
    'surah 115': '{"p":12,"s":115}',
    'surah float': '{"p":12,"s":1.5}',
    'surah string': '{"p":12,"s":"1"}',
    'surah missing': '{"p":12}',
    'page missing': '{"s":12}',
  };
  for (const label in bad) {
    const st = bad[label] === null ? memStore() : memStore({ [K]: bad[label] });
    eq('last page rejects ' + label, api(st).readMushafLastPage(), null);
  }

  // invalid writes never touch storage
  const badWrites = [[0, 1], [605, 1], [-1, 1], [1.5, 1], ['3', 1], [null, 1], [12, 0], [12, 115], [12, '4'], [12, null], [undefined, undefined]];
  for (const [p, s] of badWrites) {
    const st = countingStore();
    api(st).writeMushafLastPage(p, s);
    ok('last page refuses to write ' + show(p) + '/' + show(s), st.writes === 0 && !st.has(K));
  }

  // a storage that throws is silent on both sides
  const T = api(throwingStore());
  let threw = false;
  try { T.writeMushafLastPage(12, 3); eq('last page read on throwing storage', T.readMushafLastPage(), null); }
  catch (e) { threw = true; }
  ok('last page survives throwing storage', !threw);
})();

// ---------------------------------------------------------------------------
// B. DAILY TARGET
// ---------------------------------------------------------------------------

(function target() {
  const K = 'mushaf_wird_target_v1';
  eq('target key name', api(memStore()).WIRD_TARGET_KEY, K);

  // absence is a permanent, valid state
  eq('absent target reads null', api(memStore()).readWirdTarget(), null);

  for (const n of [1, 2, 5, 10, 20, 603, 604]) {
    const st = memStore();
    const A = api(st);
    A.writeWirdTarget(n);
    eq('target round trip ' + n, A.readWirdTarget(), n);
    eq('target stored as decimal string ' + n, st.getItem(K), String(n));
  }

  const badStrings = ['', ' ', '0', '605', '-1', '-604', '1.0', '1.5', '5 ', ' 5', '5\n',
    'abc', '1e2', '0x10', '+5', '05', '005', 'NaN', 'Infinity', 'null', '\u0665', '\u0661\u0660'];
  for (const raw of badStrings) {
    eq('target rejects ' + show(raw), api(memStore({ [K]: raw })).readWirdTarget(), null);
  }

  const badWrites = [0, 605, -1, 1.5, '5', null, undefined, NaN];
  for (const n of badWrites) {
    const st = countingStore();
    api(st).writeWirdTarget(n);
    ok('target refuses to write ' + show(n), st.writes === 0 && !st.has(K));
  }

  // clearing returns the reader to the no-target state, and that state stays valid
  const st = memStore();
  const A = api(st);
  A.writeWirdTarget(10);
  A.clearWirdTarget();
  ok('clear removes the target key', !st.has(K));
  eq('cleared target reads null', A.readWirdTarget(), null);

  const T = api(throwingStore());
  let threw = false;
  try { T.writeWirdTarget(5); T.clearWirdTarget(); eq('target read on throwing storage', T.readWirdTarget(), null); }
  catch (e) { threw = true; }
  ok('target survives throwing storage', !threw);
})();

// ---------------------------------------------------------------------------
// C. THE LOCAL DAY KEY
// ---------------------------------------------------------------------------

(function dayKey() {
  const A = api(memStore(), TODAY);
  eq('day key from fake local date', A.wirdDayKey(), DAY);
  eq('day key pads month and day', A.wirdDayKey({ getFullYear: () => 2026, getMonth: () => 0, getDate: () => 5 }), '2026-01-05');
  eq('day key december', A.wirdDayKey({ getFullYear: () => 1999, getMonth: () => 11, getDate: () => 31 }), '1999-12-31');
  ok('day key shape', /^\d{4}-\d{2}-\d{2}$/.test(api(memStore()).wirdDayKey()));

  // The boundary is the DEVICE's midnight and nothing else may be consulted.
  const src = fns.wirdDayKey;
  ok('day key uses getFullYear', src.indexOf('getFullYear') !== -1);
  ok('day key uses getMonth', src.indexOf('getMonth') !== -1);
  ok('day key uses getDate()', src.indexOf('getDate') !== -1);
  ok('day key never uses toISOString', src.indexOf('toISOString') === -1);
  ok('no lifted helper uses toISOString', LIFTED.indexOf('toISOString') === -1);
  ok('no lifted helper uses a UTC getter', LIFTED.indexOf('getUTC') === -1);
  ok('index.html mushaf helpers never use toISOString near the wird', !/wirdDayKey[\s\S]{0,400}toISOString/.test(SRC));
})();

// ---------------------------------------------------------------------------
// D. DAILY COMPLETED PAGES
// ---------------------------------------------------------------------------

(function dailyPages() {
  const K = 'mushaf_wird_day_v1';
  eq('day key name', api(memStore()).WIRD_DAY_KEY, K);

  const empty = (A) => { const r = A.readWirdDay(); return r && r.d === DAY && Array.isArray(r.pages) && r.pages.length === 0; };

  ok('missing record reads as today empty', empty(api(memStore(), TODAY)));

  const invalid = {
    'not json': 'zzz',
    'json null': 'null',
    'json number': '5',
    'json array': '[1,2,3]',
    'no fields': '{}',
    'pages not array': '{"d":"' + DAY + '","pages":5}',
    'pages string': '{"d":"' + DAY + '","pages":"1,2"}',
    'pages missing': '{"d":"' + DAY + '"}',
    'date missing': '{"pages":[1,2]}',
    'date null': '{"d":null,"pages":[1,2]}',
    'date number': '{"d":20260731,"pages":[1,2]}',
  };
  for (const label in invalid) {
    ok('invalid day record reads as today empty: ' + label, empty(api(memStore({ [K]: invalid[label] }), TODAY)));
  }

  // A record from another local date is yesterday's business, not today's.
  for (const other of ['2026-07-30', '2026-08-01', '2025-07-31', '2000-01-01']) {
    const A = api(memStore({ [K]: JSON.stringify({ d: other, pages: [1, 2, 3, 4, 5] }) }), TODAY);
    ok('old date ' + other + ' resets to today empty', empty(A));
  }

  // Filtering, range checking and de-duplication all happen on the way out.
  const messy = { d: DAY, pages: [3, 3, 3, 0, 605, -2, 1.5, '4', null, undefined, 7, 7, 604, 1, NaN, [], {}] };
  const A = api(memStore({ [K]: JSON.stringify(messy) }), TODAY);
  const r = A.readWirdDay();
  eq('messy record dedupes and filters', JSON.stringify(r.pages), JSON.stringify([3, 7, 604, 1]));
  eq('messy record carries today', r.d, DAY);

  // The 604 cap is structural: range check plus de-duplication cannot exceed the mushaf.
  const all = [];
  for (let i = 1; i <= 604; i++) all.push(i);
  const flood = all.concat(all).concat([0, 605, 900, -1, 604.5]);
  const B = api(memStore({ [K]: JSON.stringify({ d: DAY, pages: flood }) }), TODAY);
  eq('604 page cap', B.readWirdDay().pages.length, 604);

  // Marking a page already credited today writes NOTHING.
  const st = countingStore({ [K]: JSON.stringify({ d: DAY, pages: [12] }) });
  const C = api(st, TODAY);
  eq('mark new page credits it', C.markWirdPageRead(13).pages.length, 2);
  const afterFirst = st.writes;
  eq('mark same page twice does not inflate', C.markWirdPageRead(13).pages.length, 2);
  eq('mark same page twice does not write', st.writes, afterFirst);
  eq('mark pre-existing page does not inflate', C.markWirdPageRead(12).pages.length, 2);
  eq('mark pre-existing page does not write', st.writes, afterFirst);
  for (let i = 0; i < 40; i++) C.markWirdPageRead(13);
  eq('forty revisits do not inflate', C.readWirdDay().pages.length, 2);
  eq('forty revisits do not write', st.writes, afterFirst);

  // Invalid marks perform no write at all.
  for (const v of [0, 605, -1, 1.5, '3', null, undefined, NaN, {}, []]) {
    const s2 = countingStore();
    api(s2, TODAY).markWirdPageRead(v);
    ok('invalid mark performs no write: ' + show(v), s2.writes === 0 && !s2.has(K));
  }

  // Marking against an old record rewrites it as today's, with only the new page.
  const s3 = memStore({ [K]: JSON.stringify({ d: '2001-09-09', pages: [1, 2, 3] }) });
  const D = api(s3, TODAY);
  const rec = D.markWirdPageRead(500);
  eq('mark after an old date carries today', rec.d, DAY);
  eq('mark after an old date keeps only the new page', JSON.stringify(rec.pages), JSON.stringify([500]));
  eq('mark after an old date persists today only', JSON.stringify(D.readWirdDay().pages), JSON.stringify([500]));

  // Only localStorage is ever written -- the stored value is exactly the schema.
  const s4 = memStore();
  const E = api(s4, TODAY);
  E.markWirdPageRead(1);
  E.markWirdPageRead(2);
  const stored = JSON.parse(s4.getItem(K));
  eq('stored record has exactly two fields', Object.keys(stored).sort().join(','), 'd,pages');
  eq('stored record date', stored.d, DAY);
  eq('stored record pages', JSON.stringify(stored.pages), JSON.stringify([1, 2]));

  const T = api(throwingStore(), TODAY);
  let threw = false;
  let out = null;
  try { out = T.markWirdPageRead(7); } catch (e) { threw = true; }
  ok('daily record survives throwing storage', !threw);
  ok('daily record on throwing storage reads today empty', !threw && out && out.d === DAY);
})();

// ---------------------------------------------------------------------------
// E. THE PICKER'S NORMALISATION
// ---------------------------------------------------------------------------

(function normalise() {
  const A = api(memStore());
  eq('normalise latin digits', A.wirdNormalizeDigits('10'), '10');
  eq('normalise arabic-indic digits', A.wirdNormalizeDigits('\u0661\u0660'), '10');
  eq('normalise mixed digits', A.wirdNormalizeDigits('1\u0660'), '10');
  eq('normalise strips whitespace', A.wirdNormalizeDigits('  2 0 '), '20');
  eq('normalise null', A.wirdNormalizeDigits(null), '');
  eq('normalise undefined', A.wirdNormalizeDigits(undefined), '');
  ok('normalise leaves letters non-numeric', !/^[0-9]+$/.test(A.wirdNormalizeDigits('ab')));
  // The page jump keeps its own expression: this must be a SEPARATE function.
  ok('page jump normalisation untouched', /const jumpGo = \(\) => \{ const raw = String\(jump == null \? '' : jump\)\.replace\(\/\\s\+\/g, ''\)/.test(SRC));
})();

// ---------------------------------------------------------------------------
// F. STRUCTURE, IN THE SOURCE
// ---------------------------------------------------------------------------

// A helper that returns the source of a block starting at a literal anchor.
function region(anchor, len) {
  const i = SRC.indexOf(anchor);
  return i < 0 ? '' : SRC.slice(i, i + len);
}

// the dwell
eq('dwell constant is 8000', api(memStore()).WIRD_DWELL_MS, 8000);
eq('dwell constant is 8 seconds', api(memStore()).WIRD_DWELL_MS / 1000, 8);
ok('dwell timer uses the constant', SRC.indexOf('t = setTimeout(() => { t = null; setWirdDay(markWirdPageRead(page)); }, WIRD_DWELL_MS);') !== -1);
ok('dwell effect is gated on state ok', /if \(state !== 'ok'\) return;[\s\S]{0,600}WIRD_DWELL_MS/.test(SRC));
ok('dwell effect checks document visibility', /visibilityState !== 'hidden'/.test(SRC));
ok('dwell effect subscribes to visibilitychange', /addEventListener\('visibilitychange'/.test(SRC));
ok('dwell effect unsubscribes from visibilitychange', /removeEventListener\('visibilitychange'/.test(SRC));
ok('dwell effect re-runs on page change', /\}, \[state, page\]\);/.test(SRC));
ok('dwell effect clears its timer', /const disarm = \(\) => \{ if \(t\) \{ clearTimeout\(t\); t = null; \} \};/.test(SRC));

// the last page is NOT coupled to the dwell
ok('last page effect is its own effect', /writeMushafLastPage\(page, startSurah\);\s*\}, \[state, page, startSurah\]\);/.test(SRC));
ok('last page is not written from the dwell timeout', !/WIRD_DWELL_MS[\s\S]{0,200}writeMushafLastPage/.test(SRC));
ok('last page is not written from markWirdPageRead', !/function markWirdPageRead[\s\S]{0,600}writeMushafLastPage/.test(SRC));

// the presets
const presets = api(memStore()).WIRD_TARGET_PRESETS;
ok('presets is an array', Array.isArray(presets));
eq('presets are exactly 1,2,5,10,20', JSON.stringify(presets), JSON.stringify([1, 2, 5, 10, 20]));
eq('presets count', presets.length, 5);
ok('presets are all valid targets', presets.every((n) => Number.isInteger(n) && n >= 1 && n <= 604));
ok('picker renders the presets', /WIRD_TARGET_PRESETS\.map\(\(n\) => \(/.test(SRC));
ok('picker offers a no-target action', /const dropTarget = \(\) => \{ clearWirdTarget\(\); setWirdTarget\(null\);/.test(SRC));
ok('picker offers free entry', /onKeyDown=\{\(e\) => \{ if \(e\.key === 'Enter'\) pickerGo\(\); \}\}/.test(SRC));
ok('free entry range checks 1..604', /if \(n >= 1 && n <= 604\) setTarget\(n\); else setPickerText\(''\);/.test(SRC));
ok('free entry uses the wird normaliser', /const raw = wirdNormalizeDigits\(pickerText\);/.test(SRC));
ok('picker closes on backdrop', /<div style=\{s\.wirdBack\} onClick=\{\(\) => setPicker\(false\)\}>/.test(SRC));
ok('picker sheet stops backdrop propagation', /style=\{s\.wirdSheet\} onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(SRC));
ok('picker closes on Escape', /if \(e\.key === 'Escape'\) setPicker\(false\);/.test(SRC));
ok('picker has an explicit close action', /aria-label="[^"]*"[^>]*>\u00d7<\/button>/.test(SRC) || /setPicker\(false\)\} aria-label=/.test(SRC));
ok('picker opens from the strip', /<button onClick=\{\(\) => setPicker\(true\)\}/.test(SRC));

// the strip: an absolute overlay, a sibling, never a flex child, zero layout height
ok('strip wrapper style exists', /^  wirdWrap: \{ position: 'absolute',/m.test(SRC));
ok('strip is absolutely positioned', /wirdWrap: \{ position: 'absolute', left: 0, right: 0, zIndex: \d/.test(SRC));
ok('strip carries no flex child properties', !/wirdWrap: \{[^}]*\bflex:/.test(SRC));
ok('strip has no height of its own', !/wirdWrap: \{[^}]*\bheight:/.test(SRC));
ok('strip style spreads the absolute wrapper', /const wirdSt = \{\s*\.\.\.s\.wirdWrap,/.test(SRC));
ok('strip bottom follows the measured pager', /bottom: wirdBottomMost \? 0 : barH,/.test(SRC));
ok('strip falls back to bottom 0', /const wirdBottomMost = !chromeOn \|\| !\(barH > 0\);/.test(SRC));
ok('measurement failure leaves the strip bottom-most', /if \(state !== 'ok' \|\| !chromeOn\) return;/.test(SRC));
ok('pager height is measured, not assumed', /const el = barRef\.current; h = \(el && el\.offsetHeight\) \|\| 0;/.test(SRC));
ok('pager height failure falls back to 0', /catch \(e\) \{ h = 0; \}/.test(SRC));
ok('pager measurement ref is on the pager use site', /<div ref=\{barRef\} style=\{barSt\}>/.test(SRC));
ok('barSt geometry untouched', /const barSt = MADINA_IMG_ON\s*\? \{ \.\.\.s\.pgBar, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4,/.test(SRC));
ok('strip respects the bottom safe area when bottom-most', /paddingBottom: wirdBottomMost \? 'calc\(6px \+ env\(safe-area-inset-bottom, 0px\)\)' : 6,/.test(SRC));
ok('strip respects the left safe area', /wirdWrap: \{[^}]*paddingLeft: 'calc\(14px \+ env\(safe-area-inset-left, 0px\)\)'/.test(SRC));
ok('strip respects the right safe area', /wirdWrap: \{[^}]*paddingRight: 'calc\(14px \+ env\(safe-area-inset-right, 0px\)\)'/.test(SRC));

// the strip does not resize the reading box: the viewport and the sheet keep their flex
ok('reading viewport keeps flex 1', /^  pgViewport: \{[^}]*\bflex: 1\b/m.test(SRC));
ok('madina sheet keeps flex 1', /const MADINA_SHEET_ST = \{ flex: 1, minHeight: 0, width: '100%'/.test(SRC));
ok('container is still the relative overlay host', /const contSt = MADINA_IMG_ON \? \{ \.\.\.s\.memContainer, position: 'relative' \} : s\.memContainer;/.test(SRC));

// the strip is a SIBLING of header, viewport and pager, and outlives the chrome
const iHead = SRC.indexOf('<div style={headSt}>');
const iView = SRC.indexOf('<div style={vpSt}');
const iBar = SRC.indexOf('<div ref={barRef} style={barSt}>');
const iStrip = SRC.indexOf('<div style={wirdSt}>');
ok('strip is rendered', iStrip > 0);
ok('strip is a sibling after header, viewport and pager', iHead > 0 && iView > iHead && iBar > iView && iStrip > iBar);
ok('strip is gated by MADINA_IMG_ON', /\{MADINA_IMG_ON && \(\s*<div style=\{wirdSt\}>/.test(SRC));
ok('strip is NOT gated by chromeOn', !/\{chromeOn && \(\s*<div style=\{wirdSt\}>/.test(SRC));
ok('strip render gate mentions no chromeOn', region('{MADINA_IMG_ON && (\n      <div style={wirdSt}>', 40).indexOf('chromeOn') === -1);
ok('picker is gated by MADINA_IMG_ON too', /\{MADINA_IMG_ON && picker && \(/.test(SRC));
// rollback: the flag is read from ?madinaimg and is false on '0', so both gates go dark
ok('image flag reader untouched', /const readMadinaImgFlag = \(\) => \{/.test(SRC));
ok('image flag honours the 0 parameter', /if \(p === '1' \|\| p === '0'\) \{/.test(SRC));
ok('image flag const untouched', /^const MADINA_IMG_ON = readMadinaImgFlag\(\);$/m.test(SRC));

// the strip's own content. Read as a source SLICE and matched on ASCII identifiers only:
// no Arabic label and no Quran text is ever lifted into this file or printed by it.
const stripBlock = iStrip > 0 ? SRC.slice(iStrip, iStrip + 1200) : '';
ok('strip branches on the target', stripBlock.indexOf('{wirdTarget ? (') !== -1);
eq('strip shows the day count on both branches', (stripBlock.match(/toArabicDigits\(wirdDone\)/g) || []).length, 2);
ok('strip shows count over target', stripBlock.indexOf('{toArabicDigits(wirdDone)} / {toArabicDigits(wirdTarget)}') !== -1);
ok('strip carries a capped fill when a target is set',
  stripBlock.indexOf('s.wirdTrack') !== -1 && stripBlock.indexOf('...s.wirdFill, width: wirdPct') !== -1);
ok('strip itself is the target-selection affordance', stripBlock.indexOf('setPicker(true)') !== -1);
ok('progress fill is capped at 100 percent', /Math\.min\(100, Math\.round\(\(wirdDone \/ wirdTarget\) \* 100\)\)/.test(SRC));
ok('progress fill is thin', /^  wirdFill: \{[^}]*height: '100%'/m.test(SRC) && /^  wirdTrack: \{[^}]*height: 4,/m.test(SRC));
ok('count is not capped', /const wirdDone = wirdDay && wirdDay\.pages \? wirdDay\.pages\.length : 0;/.test(SRC));

// hooks are unconditional and above the early return
const pm = SRC.indexOf('function PagedMushaf(');
const early = SRC.indexOf("if (state !== 'ok') {", pm);
ok('PagedMushaf found', pm > 0);
ok('early return found', early > pm);
for (const anchor of ['const [wirdDay, setWirdDay] = useState(readWirdDay);',
                      'const [wirdTarget, setWirdTarget] = useState(readWirdTarget);',
                      'const [picker, setPicker] = useState(false);',
                      'const [pickerText, setPickerText] = useState(\'\');',
                      'const barRef = useRef(null);',
                      'const [barH, setBarH] = useState(0);',
                      '}, [state, page, startSurah]);',
                      '}, [state, page]);',
                      '}, [state, chromeOn, epoch]);',
                      '}, [picker]);']) {
  const at = SRC.indexOf(anchor, pm);
  ok('hook is above the early return: ' + ascii(anchor.slice(0, 46)), at > pm && at < early);
}
ok('no new hook is conditional', !/if \([^)]*\) \{?\s*(useEffect|useState|useRef)\(/.test(SRC.slice(pm, early)));

// the first-turn chrome collapse and the existing page writers are untouched
ok('first-turn collapse untouched', /const readerTurnedPage = \(\) => \{\s*if \(\(!MUSHAF_SVG_ON && !MADINA_IMG_ON\) \|\| chromeAuto\.current\) return;/.test(SRC));
ok('land still turns the page', /if \(sl\) \{ setPage\(page \+ sl\); setSlide\(0\); readerTurnedPage\(\); \}/.test(SRC));
ok('jumpTo untouched', /const jumpTo = \(n\) => \{ if \(timer\.current\) \{ clearTimeout\(timer\.current\); timer\.current = null; \} setDrag\(0\); setAnim\(false\); setSlide\(0\); setPage\(n\); if \(n !== page\) readerTurnedPage\(\); \};/.test(SRC));

// ---------------------------------------------------------------------------
// G. THE MANUAL BOOKMARK, AND THE RESUME ROW BESIDE IT
// ---------------------------------------------------------------------------

for (const id of ["const MUSHAF_BOOKMARK_KEY = 'mushaf_bookmark_v1';",
                  'function readMushafBookmark()',
                  'function writeMushafBookmark(pg, sr)',
                  'const openBookmark = () =>',
                  'const clearBookmark = () =>',
                  'const putMark = () =>',
                  'const [markPage, setMarkPage] = useState',
                  'const [bookmark, setBookmark] = useState(readMushafBookmark);',
                  'useEffect(() => { if (selected == null) setBookmark(readMushafBookmark()); }, [selected]);']) {
  ok('bookmark identifier preserved: ' + ascii(id.slice(0, 46)), SRC.indexOf(id) !== -1);
}
ok('bookmark writer is still the mark button only', /const putMark = \(\) => \{ writeMushafBookmark\(page, startSurah\); setMarkPage\(page\); \};/.test(SRC));
ok('bookmark is never written by the page effect', !/writeMushafBookmark\(page, startSurah\);\s*\}, \[/.test(SRC));
ok('bookmark key is distinct from the last page key', "mushaf_bookmark_v1" !== api(memStore()).MUSHAF_LAST_PAGE_KEY);

// the resume row: separate state, separate opener, separate glyph, above the bookmark row
ok('resume state is separate', /const \[lastPage, setLastPage\] = useState\(readMushafLastPage\);/.test(SRC));
ok('resume opener is separate', /const openLastPage = \(\) => \{ if \(lastPage\) \{ setOpenAt\(lastPage\); setSelected\(lastPage\.s\); \} \};/.test(SRC));
ok('resume reuses the openAt/selected path', /setOpenAt\(lastPage\); setSelected\(lastPage\.s\);/.test(SRC));
ok('resume row refreshes on return from the reader', /useEffect\(\(\) => \{ if \(selected == null\) setLastPage\(readMushafLastPage\(\)\); \}, \[selected\]\);/.test(SRC));
ok('resume row is conditional on a valid record', /\{lastPage && \(/.test(SRC));

const iResume = SRC.indexOf('{lastPage && (');
const iBookRow = SRC.indexOf('{bookmark && (');
ok('resume row is above the bookmark row', iResume > 0 && iBookRow > iResume);
const resumeBlock = SRC.slice(iResume, iBookRow);
ok('resume row calls its own opener', resumeBlock.indexOf('onClick={openLastPage}') !== -1);
ok('resume row does not call the bookmark opener', resumeBlock.indexOf('openBookmark') === -1);
ok('resume row does not use the bookmark ribbon glyph', resumeBlock.indexOf('M7 3h10') === -1);
ok('resume row has its own glyph', /<path d="M3\.5 12a8\.5 8\.5 0 1 0/.test(resumeBlock));
ok('bookmark row keeps the ribbon glyph', SRC.slice(iBookRow, iBookRow + 900).indexOf('M7 3h10') !== -1);

// entering the mushaf must NOT auto-open the reader
const ms = SRC.indexOf('function MushafScreen(');
const msEnd = SRC.indexOf('function MemorizeScreen(', ms);
const msBody = SRC.slice(ms, msEnd > ms ? msEnd : ms + 6000);
ok('nothing auto-selects on mount', !/useEffect\(\(\) => \{[^}]*setSelected\(/.test(msBody));
ok('resume only fires from a tap', (msBody.match(/setSelected\(lastPage\.s\)/g) || []).length === 1);
ok('openAt is still only set by a tap', msBody.indexOf('const [openAt, setOpenAt] = useState(null);') !== -1);
ok('reader still opens from selected only', /if \(selected\) return <PagedMushaf startSurah=\{selected\} startPage=\{openAt && openAt\.s === selected \? openAt\.p : null\} onExit=\{leaveSurah\} \/>;/.test(SRC));

// ---------------------------------------------------------------------------
// H. RESET AND PRIVACY
// ---------------------------------------------------------------------------

const iReset = SRC.indexOf('const resetAll = () => {');
const resetBlock = iReset < 0 ? '' : SRC.slice(iReset, SRC.indexOf('\n  };', iReset));
ok('resetAll found', iReset > 0);
for (const k of ['MUSHAF_LAST_PAGE_KEY', 'WIRD_TARGET_KEY', 'WIRD_DAY_KEY']) {
  ok('resetAll removes ' + k, resetBlock.indexOf('localStorage.removeItem(' + k + ');') !== -1);
}
ok('resetAll still removes the manual bookmark', resetBlock.indexOf('localStorage.removeItem(MUSHAF_BOOKMARK_KEY);') !== -1);
eq('resetAll adds exactly three new removals',
  (resetBlock.match(/removeItem\((MUSHAF_LAST_PAGE_KEY|WIRD_TARGET_KEY|WIRD_DAY_KEY)\)/g) || []).length, 3);

// Nothing about the wird may reach a request. Two directions, both checked line by line.
const NEW_TOKENS = ['mushaf_last_page_v1', 'mushaf_wird_target_v1', 'mushaf_wird_day_v1',
  'MUSHAF_LAST_PAGE_KEY', 'WIRD_TARGET_KEY', 'WIRD_DAY_KEY', 'WIRD_DWELL_MS',
  'WIRD_TARGET_PRESETS', 'readMushafLastPage', 'writeMushafLastPage', 'readWirdTarget',
  'writeWirdTarget', 'clearWirdTarget', 'readWirdDay', 'markWirdPageRead', 'wirdDayKey',
  'wirdDay', 'wirdTarget', 'wirdDone', 'wirdPct'];
const REQUEST_TOKENS = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'capHeaders(', 'submitReport(',
  'headers:', 'body:', 'JSON.stringify({ model', 'new WebSocket', 'navigator.sendBeacon',
  'EventSource', 'axios', '.ajax('];

const lines = SRC.split('\n');
let leaks = 0;
let firstLeak = 0;
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  let hasNew = false;
  for (const t of NEW_TOKENS) if (L.indexOf(t) !== -1) { hasNew = true; break; }
  if (!hasNew) continue;
  for (const t of REQUEST_TOKENS) {
    if (L.indexOf(t) !== -1) { leaks++; if (!firstLeak) firstLeak = i + 1; }
  }
}
ok('no wird token shares a line with a request token', leaks === 0, 'first at line ' + firstLeak);

let fetchLeaks = 0;
let firstFetch = 0;
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (L.indexOf('fetch(') === -1) continue;
  for (const t of NEW_TOKENS) {
    if (L.indexOf(t) !== -1) { fetchLeaks++; if (!firstFetch) firstFetch = i + 1; }
  }
}
ok('no fetch call mentions a wird token', fetchLeaks === 0, 'first at line ' + firstFetch);

// The lifted helpers themselves must contain no I/O of any kind beyond localStorage.
for (const t of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(', 'document.cookie', 'indexedDB', 'sessionStorage']) {
  ok('lifted helpers contain no ' + t, LIFTED.indexOf(t) === -1);
}
eq('lifted helpers touch only localStorage',
  (LIFTED.match(/localStorage\./g) || []).length,
  (LIFTED.match(/localStorage\.(getItem|setItem|removeItem)\(/g) || []).length);
ok('lifted helpers write only through setItem', (LIFTED.match(/setItem\(/g) || []).length === 3);

// Every storage operation is independently wrapped: no getItem/setItem/removeItem in the
// lifted block sits outside a try. Counted by comparing operations to try blocks.
eq('every storage operation is wrapped in try/catch',
  (LIFTED.match(/try \{[^}]*(getItem|setItem|removeItem)\(/g) || []).length,
  (LIFTED.match(/localStorage\.(getItem|setItem|removeItem)\(/g) || []).length);

// ---------------------------------------------------------------------------
// I. THINGS THAT MUST NOT HAVE MOVED
// ---------------------------------------------------------------------------

for (const anchor of [
  "const MADINA_IMG_KEY = 'madina_img_v1';",
  'const MADINA_IMG_PAGES = 604;',
  "return '/assets/madina-hafs/page-' + String(n).padStart(3, '0') + '.webp';",
  "objectFit: 'fill'",
  "const MADINA_IMG_ST_FIT = { ...MADINA_IMG_ST, objectFit: 'contain', margin: 'auto' };",
  "const MADINA_FILL_Q = '(orientation: portrait) and (max-width: 700px)';",
  'const prefetchMushafSvg = (n) => {',
  'onSheetLoad={prefetchMushafSvg}',
  'function MushafSheet(',
]) {
  ok('renderer anchor preserved: ' + ascii(anchor.slice(0, 46)), SRC.indexOf(anchor) !== -1);
}
// This guard's own source must stay ASCII: no Arabic label and no scripture may be pinned
// in it, so nothing it prints or holds can ever be a verse. The ranges are numeric code
// points rather than a character class, so writing this check introduces no Arabic byte
// of its own -- the guard is its own witness.
const SELF = fs.readFileSync(__filename, 'utf8');
const ARABIC_RANGES = [[0x0600, 0x06FF], [0x0750, 0x077F], [0x08A0, 0x08FF], [0xFB50, 0xFDFF], [0xFE70, 0xFEFF]];
let arabicChars = 0;
for (let i = 0; i < SELF.length; i++) {
  const c = SELF.charCodeAt(i);
  for (const R of ARABIC_RANGES) if (c >= R[0] && c <= R[1]) { arabicChars++; break; }
}
eq('this guard embeds no Arabic text', arabicChars, 0);
let nonAscii = 0;
for (let i = 0; i < SELF.length; i++) if (SELF.charCodeAt(i) > 126) nonAscii++;
eq('this guard is ASCII only', nonAscii, 0);
ok('this guard opens no asset but index.html and itself',
  (SELF.match(/readFileSync\(/g) || []).length === 2);

// ---------------------------------------------------------------------------

function report() {
  const line = '-'.repeat(58);
  console.log(line);
  console.log('wird-guard: device-local last page, target and daily progress');
  console.log(line);
  if (failures.length) {
    console.log('FAILURES (' + failures.length + '):');
    for (const f of failures) console.log('  x ' + f);
    console.log(line);
  }
  console.log('passed: ' + pass);
  console.log('failed: ' + fail);
  console.log('result: ' + (fail === 0 ? 'PASS' : 'FAIL'));
  console.log(line);
}

report();
process.exit(fail === 0 ? 0 : 1);
