#!/usr/bin/env node
/*
 * wird-guard.cjs -- the device-local wird: last page, daily target, daily progress.
 *
 * Session 82 added three localStorage keys and a progress strip to the image mushaf.
 * None of them may ever leave the device, none of them may throw at a reader, and none
 * of them may disturb the manual bookmark, the renderer or the reading viewport.
 *
 * Item 43-a added a fourth device-local key to the same family -- the adhkar chain and the
 * reader's own daily goal (ezik_adhkar_streak_v1) -- and section J below gives it the same
 * treatment, in its own lifted block so that none of the wird's own counts change meaning.
 *
 * This guard does three things and nothing else:
 *
 *   1. It LIFTS the pure storage/date helpers out of index.html by brace matching and
 *      EXECUTES them against fake localStorage objects -- an empty one, a seeded one, a
 *      corrupt one and one that throws on every operation -- with a fake Date so the
 *      local-day boundary can be tested without waiting for midnight.
 *
 *   2. It asserts, against the source text, the things that are structural rather than
 *      behavioural: the dwell constant, the presets, the strip's overlay nature, its
 *      departure WITH the chrome, its gate on the image flag, the survival of the
 *      bookmark identifiers, the three new removals in resetAll, and the total absence
 *      of the new keys from every request-building line in the file.
 *
 *   3. It EXECUTES the adhkar chain helpers the same way (section J): the local-day
 *      rollover, the goal bounds, the single credit per day, and the absence of any
 *      notification path anywhere in the application file.
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
ok('strip falls back to bottom 0', /const wirdBottomMost = !\(barH > 0\);/.test(SRC));
// ITEM 22+104: and `chromeOn` is no longer a term in the POSITION at all. The strip renders
// only with the chrome now, so a `!chromeOn ||` here would be dead source dressed as a
// branch -- and, worse, the shape someone would reach for while trying to bring the strip
// back into reading mode by the back door. Asserted absent rather than merely not-required.
ok('strip position carries no chromeOn term', !/const wirdBottomMost = [^;]*chromeOn/.test(SRC));
ok('measurement failure leaves the strip bottom-most', /if \(state !== 'ok' \|\| !chromeOn\) return;/.test(SRC));
ok('pager height is measured, not assumed', /const el = barRef\.current; h = \(el && el\.offsetHeight\) \|\| 0;/.test(SRC));
ok('pager height failure falls back to 0', /catch \(e\) \{ h = 0; \}/.test(SRC));
// RE-PINNED ON THE STRONGER CONDITION, ASSERTION KEPT. S110 gave the pager TWO shapes -- the
// Madina-image dock and the fallback bar -- so a literal `<div ref={barRef} style={barSt}>` matched
// neither and this check had been red ever since, asserting nothing. What it is actually for is
// that barRef measures the OUTER element the dock occupies from the bottom edge, because the wird
// strip is positioned against that height. Pinned on that, for EVERY shape, so a third renderer
// cannot quietly move the ref onto an inner control.
{
  const refs = SRC.match(/<div ref=\{barRef\}[^>]*>/g) || [];
  ok('pager measurement ref is on the pager use site', refs.length >= 1, 'no ref={barRef} element');
  ok('...on every renderer shape the pager has',
    refs.length >= 2, 'found ' + refs.length + ' -- the image dock and the fallback bar');
  ok('...and always on the OUTER chrome element, never an inner control',
    refs.every((t) => /class(?:Name)?="ezhome\b/.test(t)), refs.join(' | '));
}
ok('barSt geometry untouched', /const barSt = MADINA_IMG_ON\s*\? \{ \.\.\.s\.pgBar, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4,/.test(SRC));
ok('strip respects the bottom safe area when bottom-most', /paddingBottom: wirdBottomMost \? 'calc\(6px \+ env\(safe-area-inset-bottom, 0px\)\)' : 6,/.test(SRC));
ok('strip respects the left safe area', /wirdWrap: \{[^}]*paddingLeft: 'calc\(14px \+ env\(safe-area-inset-left, 0px\)\)'/.test(SRC));
ok('strip respects the right safe area', /wirdWrap: \{[^}]*paddingRight: 'calc\(14px \+ env\(safe-area-inset-right, 0px\)\)'/.test(SRC));

// the strip does not resize the reading box: the viewport and the sheet keep their flex
ok('reading viewport keeps flex 1', /^  pgViewport: \{[^}]*\bflex: 1\b/m.test(SRC));
ok('madina sheet keeps flex 1', /const MADINA_SHEET_ST = \{ flex: 1, minHeight: 0, width: '100%'/.test(SRC));
ok('container is still the relative overlay host', /const contSt = MADINA_IMG_ON \? \{ \.\.\.s\.memContainer, position: 'relative' \} : s\.memContainer;/.test(SRC));

// the strip is a SIBLING of header, viewport and pager, and leaves with the chrome
// RE-PINNED for the same reason: the header carries a className now. The check is about the
// ORDER of the siblings, not about which attributes each one lists, so it matches the element
// by the style that identifies it and tolerates anything else on the tag.
const iHead = SRC.search(/<div [^>]*style=\{headSt\}>/);
const iView = SRC.indexOf('<div style={vpSt}');
// RE-PINNED for the same reason as the ref above: the pager now renders in two shapes, so its
// position is the LAST of them -- the strip must follow every pager shape, not merely the first.
const iBar = SRC.indexOf('<div ref={barRef}');
const iBarLast = SRC.lastIndexOf('<div ref={barRef}');
const iStrip = SRC.indexOf('<div style={wirdSt}>');
ok('strip is rendered', iStrip > 0);
ok('strip is a sibling after header, viewport and pager',
  iHead > 0 && iView > iHead && iBar > iView && iStrip > iBarLast,
  JSON.stringify({ iHead, iView, iBar, iBarLast, iStrip }));
// ITEM 22+104 -- THE STRIP LEAVES WITH THE CHROME, and the three assertions that used to say
// the exact opposite are re-cut here. None is disabled and none is dropped: each still pins
// the render gate, and the gate it pins is now the two-term one.
//
// MADINA_IMG_ON IS STILL ASSERTED TO BE FIRST, because the rollback contract did not change:
// ?madinaimg=0 must take the strip away with the reader it belongs to. A gate written
// `chromeOn && MADINA_IMG_ON` would satisfy a naive 'mentions both' check while leaving the
// flag deciding nothing on its own, so the order is part of the assertion.
//
// AND THE ANCHOR IS REQUIRED TO BE FOUND. The third check here used to call region() and
// compare the result against '' -- which is precisely what region() returns when its anchor
// has MOVED. It therefore passed loudest at the moment it had stopped looking at anything.
// A missing anchor is now a failure with a sentence on it.
ok('strip is gated by MADINA_IMG_ON, and it is the FIRST term',
  /\{MADINA_IMG_ON && chromeOn && \(\s*<div style=\{wirdSt\}>/.test(SRC));
ok('strip IS gated by chromeOn -- absent from the DOM in reading mode',
  /&& chromeOn && \(\s*<div style=\{wirdSt\}>/.test(SRC));
{
  const gate = '{MADINA_IMG_ON && chromeOn && (';
  const at = SRC.indexOf(gate);
  const strip = at < 0 ? -1 : SRC.indexOf('<div style={wirdSt}>', at);
  ok('strip render gate anchor is FOUND, not silently absent', at > 0, 'region anchor missing');
  ok('...and it is the gate on the strip itself, not some other flag site',
    strip > at && strip - at < 60, JSON.stringify({ at: at, strip: strip }));
}
// ...and the departure is by ABSENCE, not by paint. opacity/visibility/display on the
// wrapper would leave the node in the tree and satisfy nobody's reading of the item.
ok('strip is not merely painted out',
  !/wirdWrap: \{[^}]*\b(?:opacity|visibility)\b/.test(SRC));

// ...AND THE COUNT DOES NOT LEAVE WITH IT. This is the half of the new contract that is
// easiest to break by accident: gating the strip on `chromeOn` is one keystroke away from
// gating the DWELL on it too, and a reader in reading mode would then be credited nothing
// for exactly the session this item exists to protect. The dwell effect must name `chromeOn`
// NOWHERE -- not in a condition, not in a dependency array -- and must still credit the page.
{
  const dStart = SRC.indexOf('const arm = () => {');
  ok('dwell effect is FOUND', dStart > 0, 'arm() anchor missing');
  const dEnd = dStart < 0 ? -1 : SRC.indexOf('}, [state, page]);', dStart);
  ok('dwell effect closes on the [state, page] dependency array', dEnd > dStart);
  const dwell = dStart > 0 && dEnd > dStart ? SRC.slice(dStart, dEnd) : '';
  ok('dwell body names chromeOn NOWHERE', dwell.length > 0 && dwell.indexOf('chromeOn') === -1);
  ok('dwell still credits the page it is sitting on',
    dwell.indexOf('setWirdDay(markWirdPageRead(page))') !== -1);
}
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

// ITEM 87 REVERSED THIS BLOCK'S RULE, and the block is NARROWED to the new one rather than
// disabled. It stood under the heading "entering the mushaf must NOT auto-open the reader" and
// its three checks read, byte for byte:
//
//   ok('nothing auto-selects on mount', !/useEffect\(\(\) => \{[^}]*setSelected\(/.test(msBody));
//   ok('resume only fires from a tap', (msBody.match(/setSelected\(lastPage\.s\)/g) || []).length === 1);
//   ok('openAt is still only set by a tap', msBody.indexOf('const [openAt, setOpenAt] = useState(null);') !== -1);
//
// The owner asked for the opposite: the mushaf opens where it was left. So these now assert THE
// RESTORE AND ITS KEY -- and, just as importantly, the two things that keep the restore from
// becoming a trap: it fires once per mount, and the index is still reachable in one tap.
const ms = SRC.indexOf('function MushafScreen(');
const msEnd = SRC.indexOf('function MemorizeScreen(', ms);
const msBody = SRC.slice(ms, msEnd > ms ? msEnd : ms + 6000);
ok('the mushaf resumes on mount', /useEffect\(\(\) => \{[\s\S]{0,400}?setSelected\(lp\.s\);/.test(msBody));
ok('...from the contracted key, through its one refusing reader',
  /const lp = readMushafLastPage\(\);/.test(msBody)
  && /if \(!lp\) return;/.test(msBody)
  && /const MUSHAF_LAST_PAGE_KEY = 'mushaf_last_page_v1';/.test(SRC)
  && /localStorage\.getItem\(MUSHAF_LAST_PAGE_KEY\)/.test(SRC));
ok('...through the SAME door a tap uses, carrying the page on openAt',
  /setOpenAt\(lp\);\s*\r?\n\s*setSelected\(lp\.s\);/.test(msBody)
  && msBody.indexOf('const [openAt, setOpenAt] = useState(null);') !== -1);
// ONCE. MushafScreen does not unmount when a surah is left -- only `selected` drops to null -- so
// an effect without this guard re-opens the page the instant the exit control returns to the
// index, and the index becomes unreachable. This is the check that would catch that.
ok('...once per mount, so the index stays reachable',
  /const autoResumedRef = useRef\(false\);/.test(msBody)
  && /if \(autoResumedRef\.current\) return;\s*\r?\n\s*autoResumedRef\.current = true;/.test(msBody)
  && /\}, \[\]\);/.test(msBody));
// The label is built from code points: this guard is ASCII only, and an Arabic literal in it is
// a mojibake report waiting to happen on a Windows terminal.
ok('...and the way back to the index is one visible tap',
  new RegExp('<button onClick=\\{onExit\\} className="ezmr-btn" style=\\{s\\.ezmrJump\\}>'
    + '\u0627\u0644\u0633\u0648\u0631' + '</button>').test(SRC));
// The resume ROW is kept beside the restore, not replaced by it: it is what the reader taps
// after choosing to go back to the index.
ok('...and the tap-to-resume row is still there beside it',
  (msBody.match(/setSelected\(lastPage\.s\)/g) || []).length === 1);
// THE DEAD NAME. `mushaf_pos_v1` is swept by "delete all my data" and is nothing else anywhere:
// not read, not written, not the position this app keeps. Pinned at exactly one appearance, and
// inside resetAll, so it can never be resurrected as a live key.
// Counted as a STRING LITERAL and not as the word: the file now carries a comment explaining
// why this name is dead, and a check that counted the word would be defeated by its own
// documentation -- which is the same trap item 84 caught in theme-coverage.
eq('the pre-bookmark name appears exactly once as a literal',
  (SRC.match(/'mushaf_pos_v1'/g) || []).length, 1);
ok('...and that one appearance is a removeItem inside the full wipe', (function () {
  const at = SRC.indexOf("localStorage.removeItem('mushaf_pos_v1');");
  const reset = SRC.indexOf('const resetAll = () => {');
  const end = reset === -1 ? -1 : SRC.indexOf('\n  };', reset);
  return at !== -1 && reset !== -1 && at > reset && at < end;
}()));
// RE-PINNED, ASSERTION KEPT. The exit handler was renamed leaveSurah -> ezikGoBack, which is not
// what this check is about and which had left it red and silent. What it guards is the OPENING
// rule: the reader opens from `selected` alone, and the resumed page is carried only when
// `openAt` belongs to the very surah being opened -- that is the bookmark rule, and it is pinned
// exactly. The handler is pinned as "there is one", by name-shape rather than by name.
ok('reader still opens from selected only',
  /if \(selected\) return <PagedMushaf startSurah=\{selected\} startPage=\{openAt && openAt\.s === selected \? openAt\.p : null\} onExit=\{\w+\} \/>;/.test(SRC));

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

// ---------------------------------------------------------------------------
// J. ITEM 43-a -- THE ADHKAR CHAIN AND THE READER'S OWN GOAL
//
// The same treatment the wird gets, for the same reason: these helpers decide what a reader is
// told about their own devotion, so they are EXECUTED here against fake stores and a fake local
// calendar rather than read as text. They are lifted into their OWN block, so that every count
// this file already makes about the wird's lifted helpers keeps meaning what it meant.
//
// The behaviour under test is the ROLLOVER, which is the whole of the design: there is no timer
// and no midnight listener anywhere. A chain whose last credited day is neither today nor
// yesterday simply reads as zero the next time it is read, and starts again at one.
// ---------------------------------------------------------------------------

const A_CONSTS = ['ADHKAR_STREAK_KEY', 'ADHKAR_DAILY_GOAL', 'ADHKAR_GOAL_MIN', 'ADHKAR_GOAL_MAX', 'ADHKAR_GOAL_PRESETS'];
const A_FNS = ['adhkarDayKey', 'adhkarPrevDayKey', 'readAdhkarStreak', 'adhkarRunAsOf', 'writeAdhkarGoal', 'markAdhkarDayMet'];

const aConsts = {};
const aFns = {};
let aLifted = true;
for (const n of A_CONSTS) { aConsts[n] = liftConst(n); if (!ok('43-a: lift const ' + n, !!aConsts[n])) aLifted = false; }
for (const n of A_FNS) { aFns[n] = liftFunction(n); if (!ok('43-a: lift function ' + n, !!aFns[n])) aLifted = false; }

if (aLifted) {
  const A_LIFTED = A_CONSTS.map((n) => aConsts[n]).concat(A_FNS.map((n) => aFns[n])).join('\n\n');
  ok('43-a: lifted block braces balance',
    (A_LIFTED.match(/\{/g) || []).length === (A_LIFTED.match(/\}/g) || []).length);
  ok('43-a: lifted block has no template literal', A_LIFTED.indexOf(String.fromCharCode(96)) === -1);

  // One sandbox builder, exactly like api() above but over the chain's own block.
  const A = (store, DateImpl) => new Function('localStorage', 'Date',
    A_LIFTED + '\nreturn { ' + A_CONSTS.concat(A_FNS).join(', ') + ' };')(store, DateImpl || Date);

  const K = 'ezik_adhkar_streak_v1';
  const BASE = A(memStore());
  eq('43-a: the chain key carries its version', BASE.ADHKAR_STREAK_KEY, K);
  eq('43-a: the goal floor', BASE.ADHKAR_GOAL_MIN, 1);
  eq('43-a: the goal ceiling', BASE.ADHKAR_GOAL_MAX, 20);
  ok('43-a: the floor is below the ceiling', BASE.ADHKAR_GOAL_MIN < BASE.ADHKAR_GOAL_MAX);
  ok('43-a: the default goal lies inside the pair',
    BASE.ADHKAR_DAILY_GOAL >= BASE.ADHKAR_GOAL_MIN && BASE.ADHKAR_DAILY_GOAL <= BASE.ADHKAR_GOAL_MAX);
  ok('43-a: every preset lies inside the pair too',
    BASE.ADHKAR_GOAL_PRESETS.length > 0 && BASE.ADHKAR_GOAL_PRESETS.every((n) =>
      Number.isInteger(n) && n >= BASE.ADHKAR_GOAL_MIN && n <= BASE.ADHKAR_GOAL_MAX));

  // ---- the day BEFORE, computed on the string and on nothing else ----------
  (function prevDay() {
    const P = BASE.adhkarPrevDayKey;
    const cases = [
      ['2026-08-21', '2026-08-20'], ['2026-08-01', '2026-07-31'], ['2026-01-01', '2025-12-31'],
      ['2026-03-01', '2026-02-28'], ['2024-03-01', '2024-02-29'], ['2000-03-01', '2000-02-29'],
      ['1900-03-01', '1900-02-28'], ['2026-05-01', '2026-04-30'], ['2026-12-31', '2026-12-30'],
    ];
    for (const c of cases) eq('43-a: the day before ' + c[0], P(c[0]), c[1]);
    const bad = ['', 'x', '2026-8-1', '20260801', null, undefined, 5, '2026-13-01', '2026-00-10', '2026-05-00', '2026-05-32'];
    for (const b of bad) eq('43-a: a malformed key has no predecessor: ' + show(b), P(b), '');
  })();

  // ---- ANYTHING BROKEN READS AS THE DEFAULT, and never as a chain ----------
  (function readsClean() {
    const isDefault = (r) => !!r && r.goal === 8 && r.last === '' && r.run === 0;
    ok('43-a: a missing key reads as the default record', isDefault(A(memStore()).readAdhkarStreak()));
    const bad = {
      'not json': 'zzz',
      'json null': 'null',
      'json number': '7',
      'json array': '[1]',
      'no fields': '{}',
      'last malformed': '{"goal":5,"last":"2026-8-1","run":3}',
      'last number': '{"goal":5,"last":20260821,"run":3}',
      'run zero': '{"goal":5,"last":"2026-08-21","run":0}',
      'run negative': '{"goal":5,"last":"2026-08-21","run":-4}',
      'run float': '{"goal":5,"last":"2026-08-21","run":1.5}',
      'run without last': '{"goal":5,"run":9}',
    };
    for (const label in bad) {
      const store = memStore();
      store.setItem(K, bad[label]);
      const r = A(store).readAdhkarStreak();
      ok('43-a: a broken record never invents a chain: ' + label, r.run === 0, show(r));
    }
    const g1 = memStore(); g1.setItem(K, '{"goal":99,"last":"2026-08-21","run":3}');
    eq('43-a: an out-of-range goal falls back to the default', A(g1).readAdhkarStreak().goal, 8);
    const g2 = memStore(); g2.setItem(K, '{"goal":5,"last":"2026-08-21","run":-1}');
    eq('43-a: a broken run does not take a good goal down with it', A(g2).readAdhkarStreak().goal, 5);
    // THE OTHER DIRECTION, and it is deliberate: a goal outside the pair is replaced by the
    // default, and the chain the reader ALREADY EARNED survives that replacement untouched. A
    // number nobody can choose through the interface must not be able to erase days of dhikr.
    const badGoals = {
      'goal 0': '{"goal":0,"last":"2026-08-21","run":3}',
      'goal 21': '{"goal":21,"last":"2026-08-21","run":3}',
      'goal float': '{"goal":2.5,"last":"2026-08-21","run":3}',
      'goal string': '{"goal":"5","last":"2026-08-21","run":3}',
    };
    for (const label in badGoals) {
      const st = memStore(); st.setItem(K, badGoals[label]);
      const r = A(st).readAdhkarStreak();
      ok('43-a: an unusable goal falls back and the earned chain survives: ' + label,
        r.goal === 8 && r.run === 3 && r.last === '2026-08-21', show(r));
    }
    ok('43-a: a storage that throws still reads as the default', isDefault(A(throwingStore()).readAdhkarStreak()));
  })();

  // ---- THE ROLLOVER: today, yesterday, and anything older ------------------
  (function rollover() {
    const NOW = fakeDate(2026, 8, 21);
    const T = '2026-08-21', Y = '2026-08-20', OLD = '2026-08-19';
    const runAsOf = (last, n) => {
      const st = memStore();
      st.setItem(K, JSON.stringify({ goal: 3, last: last, run: n }));
      const box = A(st, NOW);
      return box.adhkarRunAsOf(box.readAdhkarStreak(), T);
    };
    eq('43-a: a chain credited TODAY stands', runAsOf(T, 4), 4);
    eq('43-a: a chain credited YESTERDAY still stands -- today is not over yet', runAsOf(Y, 4), 4);
    eq('43-a: a chain older than yesterday reads as zero -- THE RESET', runAsOf(OLD, 4), 0);
    eq('43-a: ...and a chain a year old reads as zero too', runAsOf('2025-08-21', 40), 0);
    eq('43-a: ...and a record with no last day has no chain', runAsOf('', 4), 0);

    // The reset costs the reader nothing else: the goal they chose is still theirs.
    const st = countingStore();
    st.setItem(K, JSON.stringify({ goal: 3, last: OLD, run: 4 }));
    st.writes = 0;
    const box = A(st, NOW);
    eq('43-a: the reset does not take the reader goal with it', box.readAdhkarStreak().goal, 3);
    box.adhkarRunAsOf(box.readAdhkarStreak(), T);
    eq('43-a: and reading a lapsed chain writes nothing at all', st.writes, 0);
  })();

  // ---- CREDITING A DAY -----------------------------------------------------
  (function credit() {
    const NOW = fakeDate(2026, 8, 21);
    const T = '2026-08-21', Y = '2026-08-20', OLD = '2026-08-19';
    const seeded = (rec) => {
      const st = countingStore();
      if (rec) st.setItem(K, JSON.stringify(rec));
      st.writes = 0;
      return st;
    };

    let st = seeded({ goal: 3, last: '', run: 0 });
    let r = A(st, NOW).markAdhkarDayMet(2);
    ok('43-a: below the goal nothing is credited and nothing is written',
      r.run === 0 && st.writes === 0, show(r));

    st = seeded({ goal: 3, last: '', run: 0 });
    r = A(st, NOW).markAdhkarDayMet(3);
    ok('43-a: reaching the goal starts the chain at one',
      r.run === 1 && r.last === T && st.writes === 1, show(r));

    st = seeded({ goal: 3, last: T, run: 5 });
    r = A(st, NOW).markAdhkarDayMet(9);
    ok('43-a: a day already credited is never credited twice',
      r.run === 5 && st.writes === 0, show(r));

    st = seeded({ goal: 3, last: Y, run: 5 });
    r = A(st, NOW).markAdhkarDayMet(3);
    ok('43-a: a chain continued from yesterday grows by exactly one',
      r.run === 6 && r.last === T && st.writes === 1, show(r));

    st = seeded({ goal: 3, last: OLD, run: 5 });
    r = A(st, NOW).markAdhkarDayMet(3);
    ok('43-a: a lapsed chain starts again at one, not at six',
      r.run === 1 && r.last === T, show(r));

    st = seeded({ goal: 3, last: '', run: 0 });
    const box = A(st, NOW);
    box.markAdhkarDayMet(3);
    box.markAdhkarDayMet(4);
    box.markAdhkarDayMet(50);
    eq('43-a: three completions past the goal are still one write', st.writes, 1);
    eq('43-a: crediting preserves the goal the reader chose', A(st, NOW).readAdhkarStreak().goal, 3);

    const bads = [null, undefined, '3', 2.5, NaN, -1];
    for (const b of bads) {
      const s2 = seeded({ goal: 1, last: '', run: 0 });
      const rr = A(s2, NOW).markAdhkarDayMet(b);
      ok('43-a: a completion count of ' + show(b) + ' credits nothing', rr.run === 0 && s2.writes === 0, show(rr));
    }
    ok('43-a: a storage that throws still credits without throwing',
      A(throwingStore(), NOW).markAdhkarDayMet(99).run >= 0);
  })();

  // ---- THE GOAL IS THE READER'S, WITHIN A PAIR -----------------------------
  (function goal() {
    for (const n of [1, 3, 8, 20]) {
      const st = countingStore();
      const r = A(st).writeAdhkarGoal(n);
      ok('43-a: the goal ' + n + ' is accepted and stored', r.goal === n && st.writes === 1, show(r));
    }
    for (const n of [0, -1, 21, 100, 2.5, '5', null, undefined, NaN]) {
      const st = countingStore();
      const r = A(st).writeAdhkarGoal(n);
      ok('43-a: the goal ' + show(n) + ' is refused and nothing is written',
        r.goal === 8 && st.writes === 0, show(r));
    }
    const st = countingStore();
    st.setItem(K, JSON.stringify({ goal: 3, last: '2026-08-20', run: 7 }));
    st.writes = 0;
    const r = A(st).writeAdhkarGoal(12);
    ok('43-a: changing the goal keeps the chain that was already earned',
      r.goal === 12 && r.last === '2026-08-20' && r.run === 7, show(r));
  })();

  // ---- IT NEVER LEAVES THE DEVICE, AND IT PROMISES NO REMINDER -------------
  const A_IO = ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(',
    'document.cookie', 'indexedDB', 'sessionStorage', 'Notification', 'requestPermission', 'showNotification'];
  for (const t of A_IO) ok('43-a: the chain helpers contain no ' + t, A_LIFTED.indexOf(t) === -1);
  eq('43-a: the chain helpers touch only localStorage',
    (A_LIFTED.match(/localStorage\./g) || []).length,
    (A_LIFTED.match(/localStorage\.(getItem|setItem)\(/g) || []).length);
  eq('43-a: every storage operation is wrapped in its own try',
    (A_LIFTED.match(/try \{[^}]*(getItem|setItem)\(/g) || []).length,
    (A_LIFTED.match(/localStorage\.(getItem|setItem)\(/g) || []).length);
  ok('43-a: the chain never uses a UTC getter', A_LIFTED.indexOf('getUTC') === -1);
  ok('43-a: ...and never toISOString', A_LIFTED.indexOf('toISOString') === -1);

  const A_TOKENS = [K].concat(A_CONSTS).concat(A_FNS);
  let aLeaks = 0;
  let aFirst = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    let touches = false;
    for (const t of A_TOKENS) if (L.indexOf(t) !== -1) { touches = true; break; }
    if (!touches) continue;
    for (const t of REQUEST_TOKENS) {
      if (L.indexOf(t) !== -1) { aLeaks++; if (!aFirst) aFirst = i + 1; }
    }
  }
  ok('43-a: no chain token shares a line with a request token', aLeaks === 0, 'first at line ' + aFirst);

  // ZERO NOTIFICATIONS, measured over the WHOLE application file. A scheduled reminder needs the
  // native shell, is not in this build, and may not be promised or prepared for anywhere.
  ok('43-a: the application asks for no notification permission',
    SRC.indexOf('Notification.requestPermission') === -1 && SRC.indexOf('requestPermission()') === -1);
  ok('43-a: ...and constructs no Notification', !/new\s+Notification\s*\(/.test(SRC));
  ok('43-a: ...and schedules none through a service worker', SRC.indexOf('showNotification') === -1);
}


// ---------------------------------------------------------------------------
// K. ITEM 109 -- THE HIJRI DATE, ON A CALENDAR NAMED IN THE SOURCE
// ---------------------------------------------------------------------------
// Everything below RUNS the shipped conversion. Nothing here matches its source text for a
// behavioural claim: the block is lifted, executed against a fake store, a fake clock and --
// this is the point -- a REMOVED Intl, so both calendars are exercised on the same machine.

const H_CONSTS = ['HIJRI_CALENDAR', 'HIJRI_FALLBACK_CALENDAR', 'HIJRI_OFFSET_KEY',
  'HIJRI_OFFSET_MIN', 'HIJRI_OFFSET_MAX', 'HIJRI_MONTHS', 'HIJRI_SUFFIX', 'toArabicDigits'];
const H_FNS = ['hijriJdnFromCivil', 'hijriCivilFromJdn', 'hijriTabularFromJdn',
  'hijriUmalquraFromJdn', 'hijriFromJdn', 'hijriForCivilDay',
  'readHijriOffset', 'writeHijriOffset', 'hijriLabel', 'hijriTodayLabel'];

const hConsts = {};
const hFns = {};
let hLifted = true;
for (const n of H_CONSTS) { hConsts[n] = liftConst(n); if (!ok('109: lift const ' + n, !!hConsts[n])) hLifted = false; }
for (const n of H_FNS) { hFns[n] = liftFunction(n); if (!ok('109: lift function ' + n, !!hFns[n])) hLifted = false; }

if (hLifted) {
  const H_LIFTED = H_CONSTS.map((n) => hConsts[n]).concat(H_FNS.map((n) => hFns[n])).join('\n\n');
  ok('109: lifted block braces balance',
    (H_LIFTED.match(/\{/g) || []).length === (H_LIFTED.match(/\}/g) || []).length);
  ok('109: lifted block has no template literal', H_LIFTED.indexOf(String.fromCharCode(96)) === -1);

  // The sandbox takes Intl as a PARAMETER, so the fallback is reachable on an engine that has
  // the real one. Passing undefined is what a browser without the tables looks like from inside.
  const HI = (store, DateImpl) => new Function('localStorage', 'Date', 'Intl',
    H_LIFTED + '\nreturn { ' + H_CONSTS.concat(H_FNS).join(', ') + ' };')(store, DateImpl || Date, Intl);
  const HNO = (store, DateImpl) => new Function('localStorage', 'Date', 'Intl',
    H_LIFTED + '\nreturn { ' + H_CONSTS.concat(H_FNS).join(', ') + ' };')(store, DateImpl || Date, undefined);

  const BASE = HI(memStore());
  eq('109: the offset key carries its version', BASE.HIJRI_OFFSET_KEY, 'ezik_hijri_offset_v1');
  eq('109: the calendar is named in the source', BASE.HIJRI_CALENDAR, 'islamic-umalqura');
  eq('109: ...and so is the arithmetical fallback', BASE.HIJRI_FALLBACK_CALENDAR, 'tabular-civil-IIa');
  ok('109: the two names are two names', BASE.HIJRI_CALENDAR !== BASE.HIJRI_FALLBACK_CALENDAR);
  eq('109: the offset floor', BASE.HIJRI_OFFSET_MIN, -2);
  eq('109: the offset ceiling', BASE.HIJRI_OFFSET_MAX, 2);
  eq('109: twelve month names, none empty', BASE.HIJRI_MONTHS.length, 12);
  eq('109: ...and no two of them are the same',
    new Set(BASE.HIJRI_MONTHS).size, 12);
  eq('109: ...and not one is blank', BASE.HIJRI_MONTHS.filter((m) => !String(m).trim()).length, 0);

  // ---- the day number is a day number, both ways --------------------------
  (function jdnRoundTrip() {
    const days = [[2026, 8, 21], [2026, 1, 1], [2026, 12, 31], [2024, 2, 28], [2024, 2, 29],
      [2024, 3, 1], [2000, 2, 29], [1900, 2, 28], [1900, 3, 1], [2100, 2, 28], [1970, 1, 1]];
    for (const [y, m, d] of days) {
      const back = BASE.hijriCivilFromJdn(BASE.hijriJdnFromCivil(y, m, d));
      ok('109: the civil day survives the round trip ' + y + '-' + m + '-' + d,
        back.y === y && back.m === m && back.d === d, show(back));
    }
    // consecutive civil days are consecutive numbers, across a leap day and a year end
    for (const [a, b] of [[[2024, 2, 28], [2024, 2, 29]], [[2024, 2, 29], [2024, 3, 1]],
      [[2026, 12, 31], [2027, 1, 1]], [[1900, 2, 28], [1900, 3, 1]]]) {
      eq('109: one day apart: ' + a.join('-') + ' -> ' + b.join('-'),
        BASE.hijriJdnFromCivil(b[0], b[1], b[2]) - BASE.hijriJdnFromCivil(a[0], a[1], a[2]), 1);
    }
  })();

  // ---- the named calendar answers, and it is the one that answers ---------
  (function namedCalendar() {
    const j = (y, m, d) => BASE.hijriJdnFromCivil(y, m, d);
    const umq = BASE.hijriUmalquraFromJdn(j(2026, 8, 21));
    if (!ok('109: this engine carries the named calendar', !!umq, 'Intl returned nothing')) return;
    // MEASURED against the engine's own tables, at four dates twenty years apart.
    const CASES = [[[2026, 8, 21], [1448, 3, 8]], [[2026, 9, 12], [1448, 4, 1]],
      [[2026, 1, 1], [1447, 7, 12]], [[1990, 1, 1], [1410, 6, 3]]];
    for (const [g, h] of CASES) {
      const got = BASE.hijriFromJdn(j(g[0], g[1], g[2]));
      ok('109: ' + g.join('-') + ' converts to ' + h.join('-'),
        got.y === h[0] && got.m === h[1] && got.d === h[2], show(got));
      eq('109: ...and it says which calendar said so', got.by, BASE.HIJRI_CALENDAR);
    }
    // THE FALLBACK IS A FALLBACK. Same dates, Intl removed: the arithmetical calendar answers,
    // it names ITSELF, and it disagrees with the named one -- which is the whole reason the
    // named one is preferred. A mutant that promotes the tabular rule to primary dies here.
    const NO = HNO(memStore());
    let disagreements = 0;
    for (const [g, h] of CASES) {
      const got = NO.hijriFromJdn(j(g[0], g[1], g[2]));
      eq('109: without the tables, ' + g.join('-') + ' is answered by the arithmetical calendar',
        got.by, NO.HIJRI_FALLBACK_CALENDAR);
      if (!(got.y === h[0] && got.m === h[1] && got.d === h[2])) disagreements++;
    }
    ok('109: ...and the two calendars are not the same calendar', disagreements > 0,
      'the arithmetical fallback agreed with Umm al-Qura on every measured date');
  })();

  // ---- AN ENGINE THAT SUBSTITUTES A DIFFERENT CALENDAR IS REFUSED --------
  // Not every engine carries the Umm al-Qura tables, and the ones that do not do NOT throw --
  // they quietly hand back islamic-civil, which is the arithmetical calendar this item exists to
  // stop trusting. So the shipped reader is driven here against three counterfeit Intls: one
  // that resolves to a different calendar, one that cannot say what it resolved to, and one that
  // answers with a date no calendar could produce. Each must come back null, and null is what
  // sends the app to its OWN named fallback rather than to a wrong day dressed as a right one.
  (function refusesASubstitute() {
    const partsOf = (y, m, d) => [{ type: 'month', value: String(m) }, { type: 'literal', value: '/' },
      { type: 'day', value: String(d) }, { type: 'literal', value: '/' },
      { type: 'year', value: String(y) }, { type: 'era', value: 'AH' }];
    const fakeIntl = (calendar, parts, drop) => ({
      DateTimeFormat: function () {
        const o = { formatToParts: () => parts };
        if (!drop) o.resolvedOptions = () => ({ calendar: calendar });
        return o;
      },
    });
    const H_SRC = H_LIFTED + '\nreturn { ' + H_CONSTS.concat(H_FNS).join(', ') + ' };';
    const withIntl = (I) => new Function('localStorage', 'Date', 'Intl', H_SRC)(memStore(), Date, I);
    const jdn = BASE.hijriJdnFromCivil(2026, 8, 21);

    const sub = withIntl(fakeIntl('islamic-civil', partsOf(1448, 3, 7)));
    eq('109: an engine that substitutes islamic-civil is refused', sub.hijriUmalquraFromJdn(jdn), null);
    eq('109: ...so the app falls back to the calendar it NAMES as its fallback',
      sub.hijriFromJdn(jdn).by, sub.HIJRI_FALLBACK_CALENDAR);

    const mute = withIntl(fakeIntl('islamic-umalqura', partsOf(1448, 3, 8), true));
    eq('109: an engine that cannot say which calendar it used is refused',
      mute.hijriUmalquraFromJdn(jdn), null);

    for (const bad of [[1448, 13, 8], [1448, 0, 8], [1448, 3, 0], [1448, 3, 31], [0, 3, 8]]) {
      const weird = withIntl(fakeIntl('islamic-umalqura', partsOf(bad[0], bad[1], bad[2])));
      eq('109: an impossible answer ' + bad.join('-') + ' is refused',
        weird.hijriUmalquraFromJdn(jdn), null);
    }
    const none = withIntl(fakeIntl('islamic-umalqura', []));
    eq('109: an answer with no fields at all is refused', none.hijriUmalquraFromJdn(jdn), null);
    const thrower = withIntl({ DateTimeFormat: function () { throw new Error('no tables'); } });
    eq('109: an engine that throws is refused rather than propagated',
      thrower.hijriUmalquraFromJdn(jdn), null);
    eq('109: ...and the date is still produced', typeof thrower.hijriFromJdn(jdn).y, 'number');
  })();

  // ---- IT IS RUN, DAY AFTER DAY, ACROSS EVERY BOUNDARY THERE IS -----------
  (function walk() {
    // 800 consecutive civil days from 2024-02-01: it crosses a Gregorian leap day, two Gregorian
    // year ends, and roughly 27 Hijri month ends including at least one Hijri year end. Every
    // step must advance the Hijri date by exactly one day.
    const start = BASE.hijriJdnFromCivil(2024, 2, 1);
    let prev = BASE.hijriFromJdn(start);
    let months = 0, years = 0, bad = 0, badAt = '';
    for (let i = 1; i < 800; i++) {
      const cur = BASE.hijriFromJdn(start + i);
      const sameMonth = cur.y === prev.y && cur.m === prev.m && cur.d === prev.d + 1;
      const newMonth = cur.y === prev.y && cur.m === prev.m + 1 && cur.d === 1 && prev.d >= 29;
      const newYear = cur.y === prev.y + 1 && cur.m === 1 && cur.d === 1 && prev.m === 12 && prev.d >= 29;
      if (newMonth) months++;
      if (newYear) years++;
      if (!(sameMonth || newMonth || newYear)) { bad++; if (!badAt) badAt = show([prev, cur]); }
      prev = cur;
    }
    ok('109: 800 consecutive days advance the Hijri date by exactly one, every time',
      bad === 0, bad + ' bad steps, first ' + badAt);
    ok('109: ...and the walk really crossed month ends', months >= 20, 'month rollovers: ' + months);
    ok('109: ...and at least one year end', years >= 1, 'year rollovers: ' + years);
    ok('109: ...and no month outside 1..12, no day outside 1..30', (function () {
      for (let i = 0; i < 800; i++) {
        const c = BASE.hijriFromJdn(start + i);
        if (!(c.m >= 1 && c.m <= 12 && c.d >= 1 && c.d <= 30 && c.y > 1400)) return false;
      }
      return true;
    })());
  })();

  // ---- THE OFFSET MOVES THE DAY BY WHAT IT SAYS, AND BY NO MORE -----------
  (function offset() {
    const at = (y, m, d, k) => BASE.hijriForCivilDay(y, m, d, k);
    const jd = (y, m, d) => BASE.hijriJdnFromCivil(y, m, d);
    for (const [y, m, d] of [[2026, 8, 21], [2026, 9, 11], [2026, 9, 12], [2027, 5, 17], [2024, 2, 29]]) {
      for (const k of [-2, -1, 0, 1, 2]) {
        const got = at(y, m, d, k);
        const want = BASE.hijriFromJdn(jd(y, m, d) + k);
        ok('109: an offset of ' + k + ' at ' + y + '-' + m + '-' + d + ' moves exactly ' + k + ' day(s)',
          got.y === want.y && got.m === want.m && got.d === want.d, show([got, want]));
        eq('109: ...and the record reports the offset it used', got.offset, k);
      }
    }
    // A stored value beyond the pair CANNOT move the date beyond the pair.
    for (const [k, want] of [[7, 2], [-7, -2], [100, 2], [-100, -2], [2.9, 2], [-2.9, -2]]) {
      eq('109: an offset of ' + k + ' is clamped to ' + want, at(2026, 8, 21, k).offset, want);
    }
    for (const k of [null, undefined, NaN, 'x', {}, [], Infinity, -Infinity]) {
      const got = at(2026, 8, 21, k);
      const zero = at(2026, 8, 21, 0);
      ok('109: an unusable offset ' + show(k) + ' behaves as zero',
        got.offset === 0 && got.y === zero.y && got.m === zero.m && got.d === zero.d, show(got));
    }
    // The offset crosses a month end properly rather than inventing a 31st.
    const ahead = at(2026, 9, 11, 1);
    eq('109: an offset that crosses a Hijri month end rolls the month',
      show([ahead.m, ahead.d]), show([4, 1]));
  })();

  // ---- A BROKEN KEY READS ZERO AND NEVER THROWS ---------------------------
  (function store() {
    const K = 'ezik_hijri_offset_v1';
    eq('109: an empty store reads no offset', HI(memStore()).readHijriOffset(), 0);
    const bad = ['', ' ', 'x', 'null', '{}', '[]', '3', '-3', '99', '1.5', 'NaN', 'Infinity',
      '+1 ', 'true', '\u0661'];
    for (const b of bad) {
      const st = memStore(); st.setItem(K, b);
      let threw = null, got = null;
      try { got = HI(st).readHijriOffset(); } catch (e) { threw = e; }
      ok('109: a stored ' + show(b) + ' reads as zero and does not throw',
        threw === null && got === 0, threw ? 'threw' : show(got));
    }
    for (const g of [-2, -1, 0, 1, 2]) {
      const st = memStore(); st.setItem(K, String(g));
      eq('109: a stored ' + g + ' reads back', HI(st).readHijriOffset(), g);
    }
    ok('109: a storage that throws reads as zero rather than breaking the screen',
      HI(throwingStore()).readHijriOffset() === 0);
    // writing
    for (const g of [-2, -1, 0, 1, 2]) {
      const st = countingStore();
      eq('109: writing ' + g + ' returns it', HI(st).writeHijriOffset(g), g);
      eq('109: ...and writes exactly once', st.writes, 1);
      eq('109: ...and stores the number as text', st.getItem(K), String(g));
    }
    for (const g of [3, -3, 99, 1.5, 'x', null, undefined, NaN]) {
      const st = countingStore();
      const r = HI(st).writeHijriOffset(g);
      ok('109: writing ' + show(g) + ' is refused and nothing is stored', r === 0 && st.writes === 0, show(r));
    }
    ok('109: a storage that throws on write does not throw at the reader',
      HI(throwingStore()).writeHijriOffset(1) === 0);
    // reading never writes -- a default that persisted itself would be a write on first paint
    const ro = countingStore();
    HI(ro).readHijriOffset();
    HI(ro).hijriTodayLabel();
    eq('109: reading the date writes nothing at all', ro.writes, 0);
  })();

  // ---- THE LINE ON THE SCREEN --------------------------------------------
  (function label() {
    const AR = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
    const st = memStore();
    const A = HI(st, fakeDate(2026, 8, 21));
    const line = A.hijriTodayLabel();
    ok('109: the line is drawn from the LOCAL day', !!line && line.length > 6, show(line));
    ok('109: ...in Arabic-Indic digits', new RegExp('[' + AR + ']').test(line), show(line));
    ok('109: ...with no Western digit left in it', !/[0-9]/.test(line), show(line));
    ok('109: ...and it names the Hijri era', line.indexOf(A.HIJRI_SUFFIX) !== -1);
    const h = A.hijriForCivilDay(2026, 8, 21, 0);
    ok('109: ...and it carries the month name the conversion chose',
      line.indexOf(A.HIJRI_MONTHS[h.m - 1]) !== -1);
    // the offset really reaches the line
    const st2 = memStore(); st2.setItem('ezik_hijri_offset_v1', '2');
    const B = HI(st2, fakeDate(2026, 8, 21));
    ok('109: a stored offset changes the line', B.hijriTodayLabel() !== line, show(B.hijriTodayLabel()));
    ok('109: a record with no month draws nothing rather than a wrong date',
      A.hijriLabel(null) === '' && A.hijriLabel({}) === '' && A.hijriLabel({ y: 1, m: 13, d: 1 }) === '');
    ok('109: a storage that throws still yields a line rather than an exception',
      typeof HI(throwingStore(), fakeDate(2026, 8, 21)).hijriTodayLabel() === 'string');
  })();

  // ---- IT NEVER LEAVES THE DEVICE, AND IT NEVER READS UTC -----------------
  const H_IO = ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(',
    'document.cookie', 'indexedDB', 'sessionStorage', 'Notification', '/api/'];
  for (const t of H_IO) ok('109: the conversion contains no ' + t, H_LIFTED.indexOf(t) === -1);
  ok('109: the conversion never uses a UTC getter', H_LIFTED.indexOf('getUTC') === -1);
  ok('109: ...and never toISOString', H_LIFTED.indexOf('toISOString') === -1);
  eq('109: every storage operation is wrapped in its own try',
    (H_LIFTED.match(/try \{[^}]*(getItem|setItem)\(/g) || []).length,
    (H_LIFTED.match(/localStorage\.(getItem|setItem)\(/g) || []).length);

  const H_TOKENS = ['ezik_hijri_offset_v1'].concat(H_CONSTS.slice(0, 7)).concat(H_FNS);
  let hLeaks = 0;
  let hFirst = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    let touches = false;
    for (const t of H_TOKENS) if (L.indexOf(t) !== -1) { touches = true; break; }
    if (!touches) continue;
    for (const t of REQUEST_TOKENS) {
      if (L.indexOf(t) !== -1) { hLeaks++; if (!hFirst) hFirst = i + 1; }
    }
  }
  ok('109: no Hijri token shares a line with a request token', hLeaks === 0, 'first at line ' + hFirst);

  // ---- WHERE IT IS DRAWN, AND THAT IT IS NOT A NEW SCREEN -----------------
  ok('109: the date is drawn on the home masthead, which already existed',
    /\{hijri \? <div style=\{s\.ezistHijri\}>\{hijri\}<\/div> : null\}/.test(SRC));
  ok('109: ...from a prop the OWNER read, not from a store the presentation opened',
    /const hijri = hijriTodayLabel\(\);/.test(SRC)
    && /<EzistMasthead name=\{v\.name\} g=\{v\.greeting\} hijri=\{v\.hijri\} onOpenAdhkar=\{v\.onOpenAdhkar\} \/>/.test(SRC));
  ok('109: ...and no screen was added for it',
    SRC.indexOf("screen === 'hijri'") === -1 && SRC.indexOf("setScreen('hijri')") === -1);
  ok('109: the manual offset lives in Settings',
    /<EzShellGroup title=\{HIJRI_SET_TITLE\} hint=\{HIJRI_SET_HINT\}>/.test(SRC)
    && /<HijriOffsetControl \/>/.test(SRC));
  ok('109: ...as a radiogroup over the five permitted values, and nothing wider',
    /role="radiogroup" aria-label=\{HIJRI_SET_LABEL\}/.test(SRC)
    && /for \(let v = HIJRI_OFFSET_MIN; v <= HIJRI_OFFSET_MAX; v\+\+\) opts\.push\(v\);/.test(SRC));
  // NOTHING IS CLAIMED ABOUT A CALENDAR THAT WAS NOT IN HAND.
  ok('109: no agreement with an external calendar is asserted anywhere in the app',
    !/\u0645\u0637\u0627\u0628\u0642 \u0644\u062A\u0642\u0648\u064A\u0645/.test(SRC));
}


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
