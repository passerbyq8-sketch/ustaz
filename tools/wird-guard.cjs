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
// ITEMS 43-b / 47-b -- the three ways a time field can be spelled in this client, written ONCE
// because A-2 and A-3 both scan for them and two copies of a list is two lists that drift.
const TIME_FIELD = ['type="time"', "type: 'time'", "type='time'"];

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
// ITEM 122. THE ANCHOR IS REQUIRED BY THE ASSERTION THAT READS IT, not by a neighbour.
// An anchored cut that comes back empty satisfies every negative check written against it, so
// a moved anchor turns a guard GREEN instead of red -- the one failure mode a guard must not
// have. Both sites below already sat under an `if (ok(length > N))` precondition, which
// protects the assertions written under it TODAY and says nothing about the one somebody adds
// beneath it tomorrow. This binds the region to the check.
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
// ITEM 32. Every helper this guard lifts is in app.jsx now; index.html only loads the bundle
// built from it. readShippedClient hands back both, and throws if the page ships no JSX it can
// find -- so an anchor that stops matching is still an anchor failure and never an empty read.
const SRC = require('./babel-block.cjs').readShippedClient(path.join(ROOT, APP)).replace(/\r\n/g, '\n');
// ITEMS 43-b / 47-b -- THE SAME CLIENT WITH ITS PROSE REMOVED, cut once and shared.
//
// Several checks below ask what the client OFFERS or DOES: whether it offers a time field,
// whether it asks the system for a permission, whether it cancels a channel. A COMMENT does
// none of those things. Counting the raw file made a paragraph explaining a rule
// indistinguishable from a second breach of it -- a check that punishes the one thing it
// should reward, and one that a guard whose whole subject is honest prose cannot afford.
//
// THE SCANS OVER VISIBLE TEXT ARE NOT MOVED TO THIS. Those already strip comments themselves,
// for the same reason and by the same two expressions; what changes here is only that the
// checks about BEHAVIOUR now get the same courtesy.
const SRC_CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

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
// ITEM 32. ONE readFileSync here, not two: the shipped client is opened through
// tools/babel-block.cjs, the only thing in this tree allowed to know that the client is two
// files now. The intent is unchanged and still exact -- this guard reaches for no asset of its
// own -- so it counts what it now has: one read of itself, and one named call to the helper.
// A third read of anything, or a second path opened by hand, fails here.
eq('this guard opens no asset but the shipped client and itself',
  (SELF.match(/readFileSync\(/g) || []).length, 1);
eq('...and it reaches the client through the shared helper, never by a path of its own',
  (SELF.match(/readShippedClient\(/g) || []).length, 1);

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
  // ITEM 108-a put an orientation-sensor requestPermission in this file. The claim being kept
  // is about NOTIFICATIONS, so it is stated about notifications -- and the sweep that used to
  // match any requestPermission is replaced by an exhaustive one that names the only caller the
  // file is allowed to have. A Notification.requestPermission would fail both halves.
  ok('43-a: the application asks for no notification permission',
    SRC.indexOf('Notification.requestPermission') === -1);
  eq('43-a: ...and every permission request in the file is the orientation sensor\'s',
    (SRC.match(/[A-Za-z0-9_.$]*requestPermission\s*\(/g) || [])
      .filter((x) => x !== 'DOE.requestPermission(').join(', '), '');
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
  const settingsAt = SRC.indexOf('function SettingsSheet(');
  const settingsEnd = settingsAt === -1 ? -1 : SRC.indexOf('function ParentDashboard(', settingsAt);
  const settingsSource = (settingsAt !== -1 && settingsEnd > settingsAt)
    ? SRC.slice(settingsAt, settingsEnd) : '';
  const prayerGroupAt = settingsSource.indexOf('<EzShellGroup title={PRAYER_SETTINGS_TITLE} hint={PRAYER_HINT}>');
  const prayerGroupEnd = prayerGroupAt === -1 ? -1 : settingsSource.indexOf('</EzShellGroup>', prayerGroupAt);
  const prayerGroup = (prayerGroupAt !== -1 && prayerGroupEnd > prayerGroupAt)
    ? settingsSource.slice(prayerGroupAt, prayerGroupEnd) : '';
  ok('109: the manual offset moved intact into the final Prayer group in Settings',
    settingsSource.length > 1000
    && prayerGroup.indexOf('<HijriOffsetControl />') !== -1
    && prayerGroup.indexOf('{HIJRI_SET_TITLE}') !== -1
    && prayerGroup.indexOf('{HIJRI_SET_HINT}') !== -1
    && settingsSource.lastIndexOf('<EzShellGroup ') === prayerGroupAt
    && !/<EzShellGroup title=\{HIJRI_SET_TITLE\}/.test(settingsSource));
  ok('109: ...as a radiogroup over the five permitted values, and nothing wider',
    /role="radiogroup" aria-label=\{HIJRI_SET_LABEL\}/.test(SRC)
    && /for \(let v = HIJRI_OFFSET_MIN; v <= HIJRI_OFFSET_MAX; v\+\+\) opts\.push\(v\);/.test(SRC)
    && /data-ezik-prayer-setting="hijri"[\s\S]{0,100}style=\{\{ \.\.\.s\.a11yOpt/.test(SRC));
  // NOTHING IS CLAIMED ABOUT A CALENDAR THAT WAS NOT IN HAND.
  ok('109: no agreement with an external calendar is asserted anywhere in the app',
    !/\u0645\u0637\u0627\u0628\u0642 \u0644\u062A\u0642\u0648\u064A\u0645/.test(SRC));
}



// ---------------------------------------------------------------------------
// L. ITEM 108-a -- THE QIBLA: A KNOWN ANGLE FROM A KNOWN PLACE
// ---------------------------------------------------------------------------
// The bearing is RUN, against published values for six cities and two degenerate positions whose
// answers are fixed by geometry rather than by a table. The heading reader is run against the
// exact event shapes Chrome was MEASURED to deliver -- including the one that made this design
// what it is: an event that arrives, is not absolute, and carries alpha === null.

const Q_CONSTS = ['KAABA_LAT', 'KAABA_LNG', 'QIBLA_DEFAULT_LAT', 'QIBLA_DEFAULT_LNG',
  'QIBLA_DEFAULT_PLACE', 'QIBLA_LOC_KEY', 'QIBLA_DIRS', 'toArabicDigits'];
const Q_FNS = ['qiblaBearing', 'qiblaDirName', 'qiblaDegreeText', 'qiblaHeadingOf',
  'qiblaNeedleAngle', 'readQiblaLoc', 'writeQiblaLoc', 'clearQiblaLoc'];

const qConsts = {};
const qFns = {};
let qLifted = true;
for (const n of Q_CONSTS) { qConsts[n] = liftConst(n); if (!ok('108-a: lift const ' + n, !!qConsts[n])) qLifted = false; }
for (const n of Q_FNS) { qFns[n] = liftFunction(n); if (!ok('108-a: lift function ' + n, !!qFns[n])) qLifted = false; }

if (qLifted) {
  const Q_LIFTED = Q_CONSTS.map((n) => qConsts[n]).concat(Q_FNS.map((n) => qFns[n])).join('\n\n');
  ok('108-a: lifted block braces balance',
    (Q_LIFTED.match(/\{/g) || []).length === (Q_LIFTED.match(/\}/g) || []).length);
  ok('108-a: lifted block has no template literal', Q_LIFTED.indexOf(String.fromCharCode(96)) === -1);
  const Q = (store) => new Function('localStorage', 'JSON',
    Q_LIFTED + '\nreturn { ' + Q_CONSTS.concat(Q_FNS).join(', ') + ' };')(store, JSON);

  const B = Q(memStore());
  ok('108-a: the Kaaba is where the Kaaba is',
    Math.abs(B.KAABA_LAT - 21.4225) < 0.002 && Math.abs(B.KAABA_LNG - 39.8262) < 0.002,
    B.KAABA_LAT + ', ' + B.KAABA_LNG);
  ok('108-a: the default position is Kuwait',
    Math.abs(B.QIBLA_DEFAULT_LAT - 29.3759) < 0.05 && Math.abs(B.QIBLA_DEFAULT_LNG - 47.9774) < 0.05,
    B.QIBLA_DEFAULT_LAT + ', ' + B.QIBLA_DEFAULT_LNG);
  eq('108-a: the position key carries its version', B.QIBLA_LOC_KEY, 'ezik_qibla_loc_v1');
  eq('108-a: eight named directions', B.QIBLA_DIRS.length, 8);
  eq('108-a: ...and no two the same', new Set(B.QIBLA_DIRS).size, 8);

  // ---- A KNOWN ANGLE FROM A KNOWN POSITION --------------------------------
  (function known() {
    // Published qibla bearings, to two decimals, at coordinates named beside each.
    const CITIES = [
      ['Kuwait City', 29.3759, 47.9774, 224.62],
      ['Cairo', 30.0444, 31.2357, 136.14],
      ['Istanbul', 41.0082, 28.9784, 151.62],
      ['London', 51.5074, -0.1278, 118.99],
      ['Jakarta', -6.2088, 106.8456, 295.15],
      ['New York', 40.7128, -74.0060, 58.48],
    ];
    for (const [name, lat, lng, want] of CITIES) {
      const got = B.qiblaBearing(lat, lng);
      ok('108-a: the qibla from ' + name + ' is ' + want + ' degrees',
        got !== null && Math.abs(got - want) < 0.05, show(got));
    }
    // GEOMETRY, not a table: due north of the Kaaba must be exactly 180, and the same point
    // one degree of longitude east must be a great-circle bearing that is NOT exactly 270 --
    // which is what separates this from a bearing drawn on a flat map.
    const north = B.qiblaBearing(B.KAABA_LAT + 1, B.KAABA_LNG);
    ok('108-a: due north of the Kaaba points exactly south', Math.abs(north - 180) < 0.001, show(north));
    const east = B.qiblaBearing(B.KAABA_LAT, B.KAABA_LNG + 1);
    ok('108-a: due east of it is a GREAT CIRCLE bearing, not a flat-map 270',
      east > 270 && east < 271, show(east));
    const south = B.qiblaBearing(B.KAABA_LAT - 1, B.KAABA_LNG);
    ok('108-a: due south of the Kaaba points exactly north',
      Math.abs(south) < 0.001 || Math.abs(south - 360) < 0.001, show(south));
    // Nothing usable in, nothing out.
    for (const bad of [[null, 0], [0, null], ['29', '47'], [NaN, 0], [0, Infinity],
      [91, 0], [-91, 0], [0, 181], [0, -181], [undefined, undefined]]) {
      eq('108-a: an impossible position yields no bearing: ' + show(bad),
        B.qiblaBearing(bad[0], bad[1]), null);
    }
  })();

  // ---- AND IT IS SAID IN WORDS, NOT ONLY IN DEGREES -----------------------
  (function words() {
    const D = B.QIBLA_DIRS;
    const CASES = [[0, 0], [10, 0], [22.4, 0], [22.6, 1], [45, 1], [90, 2], [135, 3],
      [180, 4], [225, 5], [270, 6], [315, 7], [337.6, 0], [359.9, 0], [360, 0]];
    for (const [deg, i] of CASES) {
      eq('108-a: ' + deg + ' degrees is direction ' + i, B.qiblaDirName(deg), D[i]);
    }
    for (const bad of [null, undefined, NaN, 'x', {}]) {
      eq('108-a: an unusable bearing has no direction name: ' + show(bad), B.qiblaDirName(bad), '');
    }
    const AR = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
    const txt = B.qiblaDegreeText(224.62);
    ok('108-a: the degree is written in Arabic-Indic digits',
      new RegExp('^[' + AR + ']+\u066b[' + AR + ']$').test(txt), show(txt));
    eq('108-a: an unusable bearing prints nothing', B.qiblaDegreeText(NaN), '');
  })();

  // ---- THE READING THAT IS NOT A READING ----------------------------------
  (function heading() {
    // MEASURED: Chrome 151 headless, secure origin, fired deviceorientation with
    // absolute === false and alpha === null within two seconds, while
    // 'ondeviceorientationabsolute' in window was TRUE. Feature detection said yes and there
    // was no heading. This is the case that must return null.
    eq('108-a: the measured Chrome event -- not absolute, alpha null -- is NOT a heading',
      B.qiblaHeadingOf({ absolute: false, alpha: null }), null);
    eq('108-a: a relative reading with a real alpha is still not a heading',
      B.qiblaHeadingOf({ absolute: false, alpha: 120 }), null);
    eq('108-a: an absolute reading with no alpha is not a heading',
      B.qiblaHeadingOf({ absolute: true, alpha: null }), null);
    eq('108-a: ...nor one whose alpha is a string', B.qiblaHeadingOf({ absolute: true, alpha: '90' }), null);
    eq('108-a: an empty event is not a heading', B.qiblaHeadingOf({}), null);
    eq('108-a: no event at all is not a heading', B.qiblaHeadingOf(null), null);
    // An absolute alpha is counter-clockwise from north; a compass heading is clockwise.
    eq('108-a: an absolute alpha of 0 is a heading of 0', B.qiblaHeadingOf({ absolute: true, alpha: 0 }), 0);
    eq('108-a: an absolute alpha of 90 is a heading of 270', B.qiblaHeadingOf({ absolute: true, alpha: 90 }), 270);
    eq('108-a: an absolute alpha of 270 is a heading of 90', B.qiblaHeadingOf({ absolute: true, alpha: 270 }), 90);
    // Safari carries a true heading in its own field, and it wins.
    eq('108-a: webkitCompassHeading is taken as the heading it is',
      B.qiblaHeadingOf({ webkitCompassHeading: 33.5, absolute: false, alpha: null }), 33.5);
    eq('108-a: ...and an out-of-range one is refused',
      B.qiblaHeadingOf({ webkitCompassHeading: 900, absolute: false, alpha: null }), null);

    // The needle turns by the difference, and by nothing else.
    eq('108-a: a device facing north points the needle at the qibla', B.qiblaNeedleAngle(224.62, 0), 224.62);
    eq('108-a: a device facing the qibla points the needle straight up', B.qiblaNeedleAngle(224.62, 224.62), 0);
    eq('108-a: the turn wraps rather than going negative', B.qiblaNeedleAngle(10, 350), 20);
    eq('108-a: no bearing, no needle', B.qiblaNeedleAngle(null, 0), null);
    eq('108-a: no heading, no needle', B.qiblaNeedleAngle(10, null), null);
  })();

  // ---- THE POSITION IS DEVICE-LOCAL, AND ITS DEFAULT IS A DEFAULT ---------
  (function loc() {
    const K = 'ezik_qibla_loc_v1';
    const d = Q(memStore()).readQiblaLoc();
    ok('108-a: an empty store reads the Kuwait default, and SAYS it is the default',
      d.by === 'default' && d.lat === B.QIBLA_DEFAULT_LAT && d.lng === B.QIBLA_DEFAULT_LNG, show(d));
    const bad = ['', 'x', 'null', '7', '[]', '{}', '{"lat":29}', '{"lat":"29","lng":"47"}',
      '{"lat":91,"lng":47}', '{"lat":29,"lng":181}', '{"lat":null,"lng":null}'];
    for (const b of bad) {
      const st = memStore(); st.setItem(K, b);
      const r = Q(st).readQiblaLoc();
      ok('108-a: a broken record falls back to the default: ' + show(b), r.by === 'default', show(r));
    }
    const st = countingStore();
    const w = Q(st).writeQiblaLoc(25.2048, 55.2708);
    ok('108-a: a real position is stored and reported as the device\'s',
      w.by === 'device' && w.lat === 25.2048 && st.writes === 1, show(w));
    const back = Q(st).readQiblaLoc();
    ok('108-a: ...and reads back', back.by === 'device' && back.lat === 25.2048 && back.lng === 55.2708, show(back));
    for (const p of [[91, 0], [0, 181], [NaN, 0], ['25', '55'], [null, null], [undefined, 0]]) {
      const s2 = countingStore();
      const r = Q(s2).writeQiblaLoc(p[0], p[1]);
      ok('108-a: an impossible position is refused and nothing is stored: ' + show(p),
        r.by === 'default' && s2.writes === 0, show(r));
    }
    const s3 = memStore(); s3.setItem(K, JSON.stringify({ lat: 25, lng: 55 }));
    eq('108-a: clearing returns to the default', Q(s3).clearQiblaLoc().by, 'default');
    ok('108-a: a storage that throws still yields the default rather than an exception',
      Q(throwingStore()).readQiblaLoc().by === 'default');
    ok('108-a: ...and a write into it does not throw either',
      Q(throwingStore()).writeQiblaLoc(25, 55).by === 'default');
    const ro = countingStore();
    Q(ro).readQiblaLoc();
    eq('108-a: reading the position writes nothing', ro.writes, 0);
  })();

  // ---- NOTHING HERE ASKS THE DEVICE ANYTHING UNTIL IT IS ASKED TO --------
  // ITEM 107 gave the panel a destructured parameter, and a brace-counting lift stops at the
  // FIRST brace it meets -- which is now the parameter list. So the panel is taken as an
  // anchored cut between two function names, with the length precondition below standing as
  // the guard against a cut that came back empty.
  const qpAt = SRC.indexOf('function QiblaPanel(');
  const qpEnd = qpAt === -1 ? -1 : SRC.indexOf('function PrayerSheet(', qpAt);
  const QPANEL = (qpAt !== -1 && qpEnd > qpAt) ? SRC.slice(qpAt, qpEnd) : '';
  if (ok('108-a: the panel was located', QPANEL.length > 800, 'len=' + QPANEL.length)) {
    ok('108-a: THE NEEDLE EXISTS ONLY WHILE A HEADING DOES',
      QPANEL.indexOf("compass === 'live' && needle !== null ?") !== -1
      && (QPANEL.match(/<svg /g) || []).length === 1);
    ok('108-a: ...and when it does not, the reader is told why rather than shown a still needle',
      QPANEL.indexOf('QIBLA_COMPASS_NONE') !== -1);
    ok('108-a: the position is never asked for at mount',
      QPANEL.indexOf('getCurrentPosition') !== -1
      && QPANEL.indexOf('useEffect') < QPANEL.indexOf('askLocation')
      && !/useEffect\([^)]*getCurrentPosition/.test(QPANEL));
    ok('108-a: ...and the only effect in the panel is the listener teardown',
      (QPANEL.match(/useEffect\(/g) || []).length === 1
      && /useEffect\(\(\) => \(\) => \{ if \(stopRef\.current\)/.test(QPANEL));
    ok('108-a: the sensor is started from a press and from nowhere else',
      /onClick=\{startCompass\}/.test(QPANEL)
      && (QPANEL.match(/startCompass\(\)/g) || []).length === 0);
    ok('108-a: ...and the permission request sits inside that press',
      QPANEL.indexOf('const startCompass = () =>') < QPANEL.indexOf('DOE.requestPermission()'));
    ok('108-a: the position is asked for from a press too',
      /onClick=\{askLocation\}/.test(QPANEL) && (QPANEL.match(/askLocation\(\)/g) || []).length === 0);
    ok('108-a: the listeners are removed when the panel goes',
      /removeEventListener\('deviceorientationabsolute', onEvent\)/.test(QPANEL)
      && /removeEventListener\('deviceorientation', onEvent\)/.test(QPANEL));
    for (const t of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'EventSource', 'new WebSocket', '/api/']) {
        okOn('108-a: the panel contains no ' + t, [["QPANEL", QPANEL]], QPANEL.indexOf(t) === -1);
    }
  }
  for (const t of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(',
    'document.cookie', 'indexedDB', 'sessionStorage']) {
    ok('108-a: the bearing helpers contain no ' + t, Q_LIFTED.indexOf(t) === -1);
  }
  // The whole app asks for a position exactly once, and it is this one.
  eq('108-a: the application calls getCurrentPosition exactly once',
    (SRC.match(/getCurrentPosition\(/g) || []).length, 1);
  ok('108-a: it opens from the home, over the home, without adding a route',
    /if \(prayerOpen\) return <PrayerSheet onClose=\{\(\) => setPrayerOpen\(false\)\} \/>;/.test(SRC)
    && SRC.indexOf("screen === 'prayer'") === -1 && SRC.indexOf("screen === 'qibla'") === -1);
  ok('108-a: ...and it is reached from a tile in the home\'s own module array',
    /\{ id: 'prayer',   label: EZH_PRAYER,   icon: EZH_ICON_PRAYER,   onClick: v\.onOpenPrayer,   meta: null \}/.test(SRC));
}



// ---------------------------------------------------------------------------
// M. ITEM 107 -- PRAYER TIMES, COMPUTED HERE AND NOT FETCHED
// ---------------------------------------------------------------------------
// The whole of this section RUNS the shipped calculator. It is lifted with the day-number
// helper item 109 introduced, because the two share one definition of what a day is, and then
// driven over a year of days, at seven methods, two madhhabs, both offset limits, the equator,
// the far north and the far south.

const T_CONSTS = ['PRAYER_PREFS_KEY', 'PRAYER_METHOD_DEFAULT', 'PRAYER_ASR_DEFAULT',
  'PRAYER_OFFSET_MIN', 'PRAYER_OFFSET_MAX', 'PRAYER_KEYS', 'PRAYER_OFFSETTABLE',
  'PRAYER_LABELS', 'PRAYER_ASR_LABELS', 'PRAYER_HORIZON', 'toArabicDigits'];
const T_FNS = ['hijriJdnFromCivil', 'prayerMethodTable', 'prayerMethodIds', 'prayerMethodOf',
  'prayerSunPosition', 'prayerSunAngleTime', 'prayerAsrAngle', 'prayerTimesFor', 'prayerClock',
  'readPrayerPrefs', 'writePrayerPrefs', 'prayerNudgeOffset'];

const tConsts = {};
const tFns = {};
let tLifted = true;
for (const n of T_CONSTS) { tConsts[n] = liftConst(n); if (!ok('107: lift const ' + n, !!tConsts[n])) tLifted = false; }
for (const n of T_FNS) { tFns[n] = liftFunction(n); if (!ok('107: lift function ' + n, !!tFns[n])) tLifted = false; }

if (tLifted) {
  const T_LIFTED = T_CONSTS.map((n) => tConsts[n]).concat(T_FNS.map((n) => tFns[n])).join('\n\n');
  ok('107: lifted block braces balance',
    (T_LIFTED.match(/\{/g) || []).length === (T_LIFTED.match(/\}/g) || []).length);
  ok('107: lifted block has no template literal', T_LIFTED.indexOf(String.fromCharCode(96)) === -1);
  const T = (store) => new Function('localStorage', 'JSON', 'Object',
    T_LIFTED + '\nreturn { ' + T_CONSTS.concat(T_FNS).join(', ') + ' };')(store, JSON, Object);
  const B = T(memStore());

  // KUWAIT CITY, the coordinates the app defaults to, at UTC+3.
  const KW = [29.3759, 47.9774, 180];
  const day = (y, m, d, method, asr, off) =>
    B.prayerTimesFor(y, m, d, KW[0], KW[1], KW[2], method, asr || 'standard', off || null);

  eq('107: the preferences key carries its version', B.PRAYER_PREFS_KEY, 'ezik_prayer_prefs_v1');
  eq('107: six times are computed, the five and the sunrise', B.PRAYER_KEYS.length, 6);
  eq('107: ...and the five prayers are the ones an offset may move', B.PRAYER_OFFSETTABLE.length, 5);
  ok('107: the sunrise is computed but is not a prayer to be offset',
    B.PRAYER_KEYS.indexOf('sunrise') !== -1 && B.PRAYER_OFFSETTABLE.indexOf('sunrise') === -1);
  eq('107: every computed time has a label',
    B.PRAYER_KEYS.filter((k) => !String(B.PRAYER_LABELS[k] || '').trim()).length, 0);

  // ---- THE METHODS ARE WRITTEN OUT, WITH THEIR VALUES ---------------------
  (function methods() {
    const ids = B.prayerMethodIds();
    eq('107: all seven named methods are still offered', ids.length, 7);
    ok('107: the default is one of them', ids.indexOf(B.PRAYER_METHOD_DEFAULT) !== -1);
    eq('107: ...and the default is the one this app names for its own city', B.PRAYER_METHOD_DEFAULT, 'kuwait');
    for (const id of ids) {
      const M = B.prayerMethodOf(id);
      ok('107: the method ' + id + ' carries a name', !!String(M.name || '').trim());
      ok('107: ...a fajr angle inside the range anybody uses',
        typeof M.fajr === 'number' && M.fajr >= 12 && M.fajr <= 21, id + ' fajr=' + show(M.fajr));
      ok('107: ...and an isha rule that is EITHER an angle OR an interval, never both and never neither',
        (M.ishaMin > 0 && M.isha === 0) || (M.ishaMin === 0 && M.isha >= 12 && M.isha <= 21),
        id + ' isha=' + show(M.isha) + ' ishaMin=' + show(M.ishaMin));
    }
    // The two interval methods are the two that are actually defined that way.
    eq('107: exactly the interval methods use an interval',
      ids.filter((id) => B.prayerMethodOf(id).ishaMin > 0).sort().join(','), 'makkah,qatar');
    eq('107: an unknown method falls back to the default rather than to nothing',
      B.prayerMethodOf('no-such-method').name, B.prayerMethodOf(B.PRAYER_METHOD_DEFAULT).name);
    // AND THE METHODS ARE NOT ALL THE SAME METHOD: a table that had quietly collapsed to one
    // set of angles would pass every check above and be worthless.
    const fajrs = new Set(ids.map((id) => day(2026, 8, 22, id).fajr));
    ok('107: the methods really do produce different times', fajrs.size >= 3, show(Array.from(fajrs)));
  })();

  // ---- IT IS COMPUTED, AND THE ORDER NEVER BREAKS -------------------------
  (function ordered() {
    const ids = B.prayerMethodIds();
    let bad = 0, badAt = '', n = 0;
    for (const id of ids) {
      for (const asr of ['standard', 'hanafi']) {
        for (let i = 0; i < 365; i++) {
          const c = (function (jdn) {
            const a = jdn + 32044;
            const b2 = Math.floor((4 * a + 3) / 146097);
            const c2 = a - Math.floor((146097 * b2) / 4);
            const dd = Math.floor((4 * c2 + 3) / 1461);
            const e = c2 - Math.floor((1461 * dd) / 4);
            const mi = Math.floor((5 * e + 2) / 153);
            return { y: 100 * b2 + dd - 4800 + Math.floor(mi / 10), m: mi + 3 - 12 * Math.floor(mi / 10),
              d: e - Math.floor((153 * mi + 2) / 5) + 1 };
          })(B.hijriJdnFromCivil(2026, 1, 1) + i);
          const t = day(c.y, c.m, c.d, id, asr);
          n++;
          const seq = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha];
          if (seq.some((v) => v === null)) { bad++; if (!badAt) badAt = id + ' ' + asr + ' ' + show(c); continue; }
          for (let k = 1; k < seq.length; k++) {
            if (!(seq[k] > seq[k - 1])) { bad++; if (!badAt) badAt = id + ' ' + asr + ' ' + show(c) + ' ' + show(seq); break; }
          }
        }
      }
    }
    ok('107: a full year at Kuwait, every method, both madhhabs: the order is always ascending',
      bad === 0, n + ' days computed, ' + bad + ' bad, first ' + badAt);
    ok('107: ...and that really was a full year of real computations', n === 365 * ids.length * 2, 'n=' + n);
  })();

  // ---- SOLAR NOON IS THE MIDDLE OF THE DAY --------------------------------
  // The one check that measures the equation of time rather than merely carrying it. Sunrise and
  // sunset are symmetric about solar noon, so dhuhr must sit within a minute of their midpoint --
  // every day of the year, not on the days when the correction happens to be near zero. The
  // correction swings sixteen minutes either way across a year, so a calculator that dropped it
  // would keep every ordering property intact and fail only here.
  (function solarNoon() {
    let worst = 0, worstAt = '';
    for (let i = 0; i < 365; i++) {
      const c = (function (jdn) {
        const a2 = jdn + 32044;
        const b2 = Math.floor((4 * a2 + 3) / 146097);
        const c2 = a2 - Math.floor((146097 * b2) / 4);
        const dd = Math.floor((4 * c2 + 3) / 1461);
        const e = c2 - Math.floor((1461 * dd) / 4);
        const mi = Math.floor((5 * e + 2) / 153);
        return { y: 100 * b2 + dd - 4800 + Math.floor(mi / 10), m: mi + 3 - 12 * Math.floor(mi / 10),
          d: e - Math.floor((153 * mi + 2) / 5) + 1 };
      })(B.hijriJdnFromCivil(2026, 1, 1) + i);
      const x = day(c.y, c.m, c.d, 'kuwait', 'standard');
      if (x.sunrise === null || x.maghrib === null || x.dhuhr === null) continue;
      const gap = Math.abs(x.dhuhr - (x.sunrise + x.maghrib) / 2);
      if (gap > worst) { worst = gap; worstAt = c.y + '-' + c.m + '-' + c.d + ' ' + show(x); }
    }
    ok('107: solar noon sits at the midpoint of sunrise and sunset, every day of the year',
      worst <= 1, 'worst deviation ' + worst.toFixed(2) + ' minutes at ' + worstAt);
    ok('107: ...and that really was measured across a year, not asserted on one day', worst >= 0);
  })();

  // ---- THE HANAFI ASR IS LATER, AND ONLY THE ASR MOVES --------------------
  (function madhhab() {
    // Twelve dates spread over a year, so this is a property of the rule and not of one day.
    let later = 0, others = 0, n2 = 0;
    for (let m = 1; m <= 12; m++) {
      const A = day(2026, m, 15, 'kuwait', 'standard');
      const H = day(2026, m, 15, 'kuwait', 'hanafi');
      n2++;
      if (H.asr > A.asr) later++;
      for (const k of ['fajr', 'sunrise', 'dhuhr', 'maghrib', 'isha']) if (H[k] !== A[k]) others++;
    }
    eq('107: the Hanafi asr is later than the majority asr on every month of the year', later, n2);
    eq('107: ...and nothing else moves with it', others, 0);
  })();

  // ---- WHERE THE SUN DOES NOT REACH THE ANGLE, THERE IS NO NUMBER --------
  (function polar() {
    // Tromso in midsummer: the sun never reaches 18 degrees below the horizon.
    const t = B.prayerTimesFor(2026, 6, 21, 69.6, 18.95, 120, 'kuwait', 'standard', null);
    ok('107: at a polar midsummer, fajr and isha are ABSENT rather than invented',
      t.fajr === null && t.isha === null, show(t));
    ok('107: ...and the noon that DOES exist is still given', typeof t.dhuhr === 'number');
    // and it does not throw at either pole
    for (const lat of [89.9, -89.9, 66.6, -66.6]) {
      let threw = null;
      try { B.prayerTimesFor(2026, 12, 21, lat, 0, 0, 'kuwait', 'standard', null); } catch (e) { threw = e; }
      ok('107: latitude ' + lat + ' does not throw', threw === null);
    }
    // an impossible position yields six absences, not six zeros
    for (const p of [[null, 0], [0, null], ['29', '47'], [NaN, 0], [91, 0], [0, 181]]) {
      const r = B.prayerTimesFor(2026, 8, 22, p[0], p[1], 180, 'kuwait', 'standard', null);
      ok('107: an impossible position yields no times at all: ' + show(p),
        B.PRAYER_KEYS.every((k) => r[k] === null), show(r));
    }
  })();

  // ---- THE OFFSET MOVES ITS OWN PRAYER, BY ITS OWN AMOUNT, AND NO MORE ---
  (function offsets() {
    const base = day(2026, 8, 22, 'kuwait', 'standard');
    for (const k of B.PRAYER_OFFSETTABLE) {
      for (const v of [-15, -7, -1, 1, 7, 15]) {
        const off = {};
        off[k] = v;
        const t = day(2026, 8, 22, 'kuwait', 'standard', off);
        eq('107: an offset of ' + v + ' moves ' + k + ' by exactly ' + v,
          ((t[k] - base[k]) % 1440 + 1440) % 1440, ((v % 1440) + 1440) % 1440);
        const moved = B.PRAYER_KEYS.filter((o) => t[o] !== base[o]);
        eq('107: ...and moves nothing else', moved.join(','), k);
      }
    }
    // beyond the pair, the calculation itself clamps -- a hand-edited store cannot move a
    // prayer by an hour.
    for (const [v, want] of [[60, 15], [-60, -15], [16, 15], [-16, -15]]) {
      const off = { fajr: v };
      const t = day(2026, 8, 22, 'kuwait', 'standard', off);
      eq('107: a stored offset of ' + v + ' is clamped to ' + want,
        ((t.fajr - base.fajr) % 1440 + 1440) % 1440, ((want % 1440) + 1440) % 1440);
    }
    for (const v of [null, undefined, NaN, '5', 1.5, {}, Infinity]) {
      const off = { fajr: v };
      const t = day(2026, 8, 22, 'kuwait', 'standard', off);
      eq('107: an unusable offset ' + show(v) + ' moves nothing', t.fajr, base.fajr);
    }
    // an offset aimed at something that is not an offsettable prayer is ignored
    const t2 = day(2026, 8, 22, 'kuwait', 'standard', { sunrise: 10, nonsense: 10 });
    eq('107: the sunrise carries no offset', t2.sunrise, base.sunrise);
  })();

  // ---- THE CLOCK ----------------------------------------------------------
  (function clock() {
    const AR = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
    const has = (s2) => new RegExp('[' + AR + ']').test(s2);
    ok('107: a time is written in Arabic-Indic digits', has(B.prayerClock(4 * 60 + 7)));
    ok('107: ...with no Western digit', !/[0-9]/.test(B.prayerClock(4 * 60 + 7)));
    eq('107: midnight is twelve, not zero', B.prayerClock(0).indexOf(B.toArabicDigits(12)), 0);
    eq('107: noon is twelve too', B.prayerClock(720).indexOf(B.toArabicDigits(12)), 0);
    ok('107: the morning and the evening are told apart',
      B.prayerClock(4 * 60) !== B.prayerClock(16 * 60));
    for (const bad of [null, undefined, NaN, 'x', {}]) {
      eq('107: an absent time draws a dash, never a zero: ' + show(bad), B.prayerClock(bad), '\u2014');
    }
  })();

  // ---- THE PREFERENCES ----------------------------------------------------
  (function prefs() {
    const K = 'ezik_prayer_prefs_v1';
    const d = T(memStore()).readPrayerPrefs();
    ok('107: an empty store reads the shipped defaults',
      d.method === B.PRAYER_METHOD_DEFAULT && d.asr === B.PRAYER_ASR_DEFAULT
      && B.PRAYER_OFFSETTABLE.every((k) => d.off[k] === 0), show(d));
    const bad = ['', 'x', 'null', '7', '[]', '{"method":"nope"}', '{"asr":"maliki"}',
      '{"off":5}', '{"off":{"fajr":"5"}}', '{"off":{"fajr":99}}', '{"off":{"fajr":1.5}}',
      '{"method":7,"asr":7,"off":7}'];
    for (const b of bad) {
      const st = memStore(); st.setItem(K, b);
      let threw = null, r = null;
      try { r = T(st).readPrayerPrefs(); } catch (e) { threw = e; }
      ok('107: a broken record reads as the defaults and does not throw: ' + show(b),
        threw === null && r && r.method === B.PRAYER_METHOD_DEFAULT && r.asr === B.PRAYER_ASR_DEFAULT
        && B.PRAYER_OFFSETTABLE.every((k) => r.off[k] === 0), threw ? 'threw' : show(r));
    }
    // a record that is PART good keeps the good part
    const p1 = memStore(); p1.setItem(K, '{"method":"makkah","asr":"maliki","off":{"fajr":3,"asr":99}}');
    const r1 = T(p1).readPrayerPrefs();
    ok('107: a partly usable record keeps what is usable and defaults the rest',
      r1.method === 'makkah' && r1.asr === B.PRAYER_ASR_DEFAULT && r1.off.fajr === 3 && r1.off.asr === 0, show(r1));
    // writes
    const w1 = countingStore();
    eq('107: choosing a method stores it', T(w1).writePrayerPrefs({ method: 'egypt' }).method, 'egypt');
    eq('107: ...with one write', w1.writes, 1);
    eq('107: an unknown method is refused', T(countingStore()).writePrayerPrefs({ method: 'nope' }).method, B.PRAYER_METHOD_DEFAULT);
    eq('107: an unknown madhhab is refused', T(countingStore()).writePrayerPrefs({ asr: 'maliki' }).asr, B.PRAYER_ASR_DEFAULT);
    const w2 = countingStore();
    T(w2).writePrayerPrefs({ method: 'makkah' });
    const r2 = T(w2).writePrayerPrefs({ asr: 'hanafi' });
    ok('107: a second choice does not erase the first', r2.method === 'makkah' && r2.asr === 'hanafi', show(r2));
    // the nudge
    const w3 = countingStore();
    let p = T(w3).readPrayerPrefs();
    for (let i = 0; i < 20; i++) p = T(w3).prayerNudgeOffset(p, 'asr', 1);
    eq('107: nudging up stops at the ceiling', p.off.asr, B.PRAYER_OFFSET_MAX);
    for (let i = 0; i < 40; i++) p = T(w3).prayerNudgeOffset(p, 'asr', -1);
    eq('107: ...and down at the floor', p.off.asr, B.PRAYER_OFFSET_MIN);
    eq('107: ...and the other prayers never moved', p.off.fajr, 0);
    eq('107: a nudge on something that is not an offsettable prayer changes nothing',
      T(w3).prayerNudgeOffset(p, 'sunrise', 5).off.asr, B.PRAYER_OFFSET_MIN);
    ok('107: a storage that throws reads the defaults and does not throw',
      T(throwingStore()).readPrayerPrefs().method === B.PRAYER_METHOD_DEFAULT);
    ok('107: ...and a write into it does not throw either',
      T(throwingStore()).writePrayerPrefs({ method: 'egypt' }).method === B.PRAYER_METHOD_DEFAULT);
    const ro = countingStore();
    T(ro).readPrayerPrefs();
    eq('107: reading the preferences writes nothing', ro.writes, 0);
  })();

  // ---- ZERO WIRE, ZERO ADHAN, ZERO PROMISE OF ONE ------------------------
  for (const t of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(',
    'document.cookie', 'indexedDB', 'sessionStorage', '/api/', 'aladhan', 'api.']) {
    ok('107: the calculator contains no ' + t, T_LIFTED.indexOf(t) === -1);
  }
  const TPANEL_AT = SRC.indexOf('function PrayerTimesPanel(');
  const TPANEL_END = TPANEL_AT === -1 ? -1 : SRC.indexOf('function PrayerSettingsControl(', TPANEL_AT);
  const TPANEL = (TPANEL_AT !== -1 && TPANEL_END > TPANEL_AT) ? SRC.slice(TPANEL_AT, TPANEL_END) : '';
  const PSET_AT = SRC.indexOf('function PrayerSettingsControl(');
  const PSET_END = PSET_AT === -1 ? -1 : SRC.indexOf('// ============================================================\n// ITEM 108', PSET_AT);
  const PSET = (PSET_AT !== -1 && PSET_END > PSET_AT) ? SRC.slice(PSET_AT, PSET_END) : '';
  if (ok('107: the times panel and its moved Settings control were both located',
    TPANEL.length > 800 && PSET.length > 500,
    'tile=' + TPANEL.length + ' settings=' + PSET.length)) {
    for (const t of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'EventSource', '/api/',
      'Audio', 'play(', 'Notification', 'requestPermission', 'setTimeout', 'setInterval']) {
      okOn('107: neither the times panel nor its Settings control contains ' + t,
        [["TPANEL", TPANEL], ["PSET", PSET]],
        TPANEL.indexOf(t) === -1 && PSET.indexOf(t) === -1);
    }
  }
  // 107 + ITEM 67 -- WHY THIS SCAN NARROWED, AND IN WHICH DIRECTION ONLY.
  //
  // This check was a whole-file ban on seven latin characters, and for as long as nothing could
  // ring that ban and this check's own LABEL said the same thing. Item 67 separates them. The
  // latin word is now a PROTOCOL IDENTIFIER: it is the shell's own frozen notification type
  // (murabbi-shell src/scheduler/core.js:24, `TYPES = ['adhan','daily','adhkar']`), and an item
  // typed anything else is refused there and counted `unknownType`. The web half cannot schedule
  // the call at its time without naming it.
  //
  // So the ban does not become a permission. It becomes an EXACT ALLOWANCE, and everything the
  // label ever claimed is now asserted DIRECTLY instead of through a substring that stood in for
  // it. Three things are stricter here than they were:
  //
  //   * the ARABIC word is still banned outright, everywhere, with no exception -- it is what a
  //     reader would SEE, and this application still promises nobody a call it does not make;
  //   * the latin word is allowed in EXACTLY ONE declaration, named below, and the count of
  //     occurrences outside it must be zero -- a second one anywhere fails, including in a
  //     comment, which the old substring ban could not distinguish either;
  //   * and no sound is built for it: the neighbourhood of that declaration is scanned for audio
  //     construction, which the old check never did (it could not -- it had banned the word, so
  //     there was never a neighbourhood to look at). This client DOES construct audio elsewhere,
  //     for recitation; what it must never do is construct it for this.
  const AR_ADHAN = '\u0623\u0630\u0627\u0646';
  ok('107: the reader is shown no such word, anywhere in the client',
    SRC.indexOf(AR_ADHAN) === -1);
  {
    const DECL = "const ADHAN_TYPE = 'adhan';";
    const declAt = SRC.indexOf(DECL);
    const hits = [];
    for (let i = SRC.indexOf('adhan'); i !== -1; i = SRC.indexOf('adhan', i + 1)) hits.push(i);
    const stray = hits.filter((i) => declAt === -1 || i < declAt || i >= declAt + DECL.length);
    ok('107: the latin word is a scheduler type and nothing else (occurrences=' + hits.length
      + ', outside its one declaration=' + stray.length + ')',
      hits.length === 0 || (declAt !== -1 && stray.length === 0
        && SRC.indexOf(DECL, declAt + 1) === -1));
    // The neighbourhood, only when there is one. 600 characters each way is the whole block that
    // declares the type and builds its items -- far more than a sound would need to hide in.
    if (declAt !== -1) {
      const near = SRC.slice(Math.max(0, declAt - 600), declAt + 600);
      let sound = null;
      for (const t of ['new Audio', '.play(', 'AudioContext', 'HTMLAudioElement', '<audio',
        'playbackRate', '.mp3', '.ogg', '.wav']) {
        if (near.indexOf(t) !== -1) sound = t;
      }
      ok('107: and no sound is constructed for it (' + (sound || 'nothing audio-shaped within 600 chars') + ')',
        sound === null);
    }
  }
  ok('107: ...and still asks for no notification permission',
    SRC.indexOf('Notification.requestPermission') === -1);

  // ---- WHERE IT LIVES -----------------------------------------------------
  ok('107: readings and minute offsets stay on the tile; method, madhhab and prose live in Settings',
    /<PrayerTimesPanel loc=\{loc\} \/>/.test(SRC)
    && /<QiblaPanel loc=\{loc\} onLoc=\{setLoc\} \/>/.test(SRC)
    && (SRC.match(/useState\(readQiblaLoc\)/g) || []).length === 1
    && TPANEL.indexOf('PRAYER_KEYS.map') !== -1
    && TPANEL.indexOf('PRAYER_OFFSETTABLE.map') !== -1
    && TPANEL.indexOf('PRAYER_METHOD_LABEL') === -1
    && TPANEL.indexOf('PRAYER_ASR_LABEL') === -1
    && TPANEL.indexOf('PRAYER_HINT') === -1
    && (PSET.match(/className="ez-hit" style=\{s\.prayerOptRow\}/g) || []).length === 2
    && PSET.indexOf('data-ezik-prayer-setting="method"') !== -1
    && PSET.indexOf('data-ezik-prayer-setting="asr"') !== -1
    && /<EzShellGroup title=\{PRAYER_SETTINGS_TITLE\} hint=\{PRAYER_HINT\}>[\s\S]*?<PrayerSettingsControl \/>/.test(SRC));
  ok('107: ...and still without adding a route',
    SRC.indexOf("screen === 'prayer'") === -1 && SRC.indexOf("setScreen('prayer')") === -1);
  ok('107: the default position is still Kuwait, and no prompt is raised to get one',
    /const QIBLA_DEFAULT_LAT = 29\.3759;/.test(SRC));
}



// ---------------------------------------------------------------------------
// N. ROUND 25 A-2 -- THE THIRTY-DAY TABLE, BUILT HERE AND RENEWED HERE
// ---------------------------------------------------------------------------
// Section M above proves the CALCULATOR. This section proves the TABLE built from it: that
// it is thirty days long, that it starts today, that the reader's calibration reaches every
// row of it, that the sunrise is the one time no offset may move, that it is built ONCE and
// not on every open, that it renews itself at a declared threshold and whenever an input it
// was computed from moves, that a corrupt store rebuilds instead of throwing, and that
// nothing on the whole path is a request.
//
// IT IS RUN, NOT READ. Every claim below drives the lifted functions against a fake store and
// a fake clock. A claim about a table is worth what the table it produced is worth.

const N_CONSTS = ['PRAYER_SCHEDULE_KEY', 'PRAYER_SCHEDULE_DAYS', 'PRAYER_SCHEDULE_RENEW_AT'];
const N_FNS = ['prayerDayKey', 'prayerScheduleStamp', 'buildPrayerSchedule',
  'readPrayerSchedule', 'writePrayerSchedule', 'prayerScheduleRemaining', 'ensurePrayerSchedule'];

const nConsts = {};
const nFns = {};
let nLifted = true;
for (const n of N_CONSTS) { nConsts[n] = liftConst(n); if (!ok('A-2: lift const ' + n, !!nConsts[n])) nLifted = false; }
for (const n of N_FNS) { nFns[n] = liftFunction(n); if (!ok('A-2: lift function ' + n, !!nFns[n])) nLifted = false; }

if (nLifted && tLifted && hLifted) {
  // ONE SANDBOX, THREE FAMILIES. The table needs the calculator (M) and the calendar (K), so
  // all three are lifted into the same scope -- deduped, because two of the names are shared.
  const seen = Object.create(null);
  const NAMES = [];
  const PIECES = [];
  const addAll = (names, bag) => {
    for (const n of names) {
      if (seen[n]) continue;
      seen[n] = true; NAMES.push(n); PIECES.push(bag[n]);
    }
  };
  addAll(H_CONSTS, hConsts); addAll(T_CONSTS, tConsts); addAll(N_CONSTS, nConsts);
  addAll(H_FNS, hFns); addAll(T_FNS, tFns); addAll(N_FNS, nFns);
  const N_LIFTED = PIECES.join('\n\n');

  ok('A-2: lifted block braces balance',
    (N_LIFTED.match(/\{/g) || []).length === (N_LIFTED.match(/\}/g) || []).length);
  ok('A-2: lifted block has no template literal', N_LIFTED.indexOf(String.fromCharCode(96)) === -1);

  const NS = (store) => new Function('localStorage', 'JSON', 'Object',
    N_LIFTED + '\nreturn { ' + NAMES.join(', ') + ' };')(store, JSON, Object);

  // KUWAIT CITY at UTC+3 -- the same place section M drives the calculator at.
  const KLAT = 29.3759, KLNG = 47.9774;
  const LOC = { lat: KLAT, lng: KLNG };
  // A fake clock. getTimezoneOffset() is NEGATIVE east of Greenwich, so UTC+3 is -180.
  const at = (y, m, d) => ({
    getFullYear() { return y; }, getMonth() { return m - 1; }, getDate() { return d; },
    getTimezoneOffset() { return -180; },
  });
  const prefsWith = (over) => {
    const off = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
    const o = { method: 'kuwait', asr: 'standard', off: off };
    if (over) for (const k in over) { if (k === 'off') { for (const j in over.off) off[j] = over.off[j]; } else o[k] = over[k]; }
    return o;
  };

  /* ---- the key, and that it is a NEW one ---- */
  const B0 = NS(memStore());
  eq('A-2: the table has its own versioned key', B0.PRAYER_SCHEDULE_KEY, 'ezik_prayer_schedule_v1');
  ok('A-2: ...and it is not the preferences key, so no existing store is renamed or migrated',
    B0.PRAYER_SCHEDULE_KEY !== B0.PRAYER_PREFS_KEY && B0.PRAYER_SCHEDULE_KEY !== B0.HIJRI_OFFSET_KEY);
  eq('A-2: thirty days ahead', B0.PRAYER_SCHEDULE_DAYS, 30);
  ok('A-2: the renewal threshold is declared, positive and shorter than the table',
    B0.PRAYER_SCHEDULE_RENEW_AT > 0 && B0.PRAYER_SCHEDULE_RENEW_AT < B0.PRAYER_SCHEDULE_DAYS);

  /* ---- a fresh device builds one, and it starts today ---- */
  const st1 = memStore();
  const B1 = NS(st1);
  const r1 = B1.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
  ok('A-2: a fresh device builds the table', r1.built === true && r1.why === 'absent');
  eq('A-2: ...of exactly thirty days', r1.rec.days.length, 30);
  eq('A-2: ...beginning today', (r1.rec.days[0] || {}).day, '2026-08-22');
  eq('A-2: ...and running to the thirtieth day', (r1.rec.days[r1.rec.days.length - 1] || {}).day, '2026-09-20');
  ok('A-2: ...and it was actually stored on the device', st1.has('ezik_prayer_schedule_v1'));
  ok('A-2: every row carries all six times and a Hijri date',
    r1.rec.days.every((r) => typeof r.hijri === 'string' && r.hijri.length > 0
      && B1.PRAYER_KEYS.every((k) => Object.prototype.hasOwnProperty.call(r, k))));

  /* ---- it is built ONCE, not on every open ---- */
  const r1b = B1.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
  ok('A-2: opening it again the same day does NOT rebuild it', r1b.built === false && r1b.why === null);

  /* ---- the calibration reaches every row ---- */
  const st2 = memStore();
  const B2 = NS(st2);
  const base = B2.buildPrayerSchedule(at(2026, 8, 22), LOC, prefsWith(), 180);
  const moved = B2.buildPrayerSchedule(at(2026, 8, 22), LOC, prefsWith({ off: { fajr: 7, isha: -5 } }), 180);
  let fajrOk = 0, ishaOk = 0, sunMoved = 0;
  const nRows = Math.min(base.length, moved.length);
  for (let i = 0; i < nRows; i++) {
    if (base[i].fajr !== null && moved[i].fajr - base[i].fajr === 7) fajrOk++;
    if (base[i].isha !== null && moved[i].isha - base[i].isha === -5) ishaOk++;
    if (base[i].sunrise !== moved[i].sunrise) sunMoved++;
  }
  eq('A-2: a +7 calibration moves the fajr of all thirty rows by exactly seven minutes', fajrOk, 30);
  eq('A-2: a -5 calibration moves the isha of all thirty rows by exactly five minutes', ishaOk, 30);
  eq('A-2: and NO offset moves the sunrise, on any of the thirty days', sunMoved, 0);

  /* ---- it renews itself at the declared threshold ---- */
  const st3 = memStore();
  const B3 = NS(st3);
  B3.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
  const keep = B3.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 9, 14)); // 7 days still ahead
  ok('A-2: with exactly the threshold left it is NOT rebuilt', keep.built === false && keep.remaining === 7);
  const renew = B3.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 9, 15)); // 6 left, under the threshold
  ok('A-2: one day later, under the threshold, it renews itself', renew.built === true && renew.why === 'short');
  eq('A-2: ...and the renewed table starts that day', (renew.rec.days[0] || {}).day, '2026-09-15');
  eq('A-2: ...and is thirty days long again', renew.rec.days.length, 30);

  /* ---- any input that moves invalidates it ---- */
  const drift = [
    ['the method', (b) => b.ensurePrayerSchedule(LOC, prefsWith({ method: 'makkah' }), at(2026, 8, 22))],
    ['the Asr school', (b) => b.ensurePrayerSchedule(LOC, prefsWith({ asr: 'hanafi' }), at(2026, 8, 22))],
    ['a per-prayer offset', (b) => b.ensurePrayerSchedule(LOC, prefsWith({ off: { asr: 3 } }), at(2026, 8, 22))],
    ['the position', (b) => b.ensurePrayerSchedule({ lat: 24.7136, lng: 46.6753 }, prefsWith(), at(2026, 8, 22))],
  ];
  for (const d of drift) {
    const st = memStore();
    const b = NS(st);
    b.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
    const after = d[1](b);
    ok('A-2: moving ' + d[0] + ' rebuilds the table rather than serving a superseded one',
      after.built === true && after.why === 'inputs');
  }
  // The Hijri offset is an input too: it is what the date column is computed with.
  const st4 = memStore();
  const B4 = NS(st4);
  B4.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
  st4.setItem('ezik_hijri_offset_v1', '1');
  const afterH = B4.ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
  ok('A-2: moving the Hijri offset rebuilds the table too', afterH.built === true && afterH.why === 'inputs');

  /* ---- a broken store is rebuilt, never thrown ---- */
  const bad = ['', 'not json', '{}', '[]', 'null', '{"v":2}',
    '{"v":1,"stamp":"x","from":"2026-08-22","days":[]}'];
  let rebuilt = 0, threw = 0;
  for (const b of bad) {
    const st = memStore();
    st.setItem('ezik_prayer_schedule_v1', b);
    try {
      const r = NS(st).ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
      if (r.built === true && r.rec.days.length === 30) rebuilt++;
    } catch (e) { threw++; }
  }
  eq('A-2: every shape of broken store is rebuilt', rebuilt, bad.length);
  eq('A-2: ...and none of them throws at the reader', threw, 0);

  /* ---- a store that denies every operation still draws a table ---- */
  const deaf = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  let deafOk = false;
  try {
    const r = NS(deaf).ensurePrayerSchedule(LOC, prefsWith(), at(2026, 8, 22));
    deafOk = r.rec.days.length === 30;
  } catch (e) { deafOk = false; }
  ok('A-2: a storage that denies every operation still yields a thirty-day table', deafOk);

  /* ---- ZERO NETWORK, asserted over the source of the path itself ---- */
  ok('A-2: nothing on the table path is a request',
    N_LIFTED.length > 0 && !/fetch\(|aiFetch\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket|new Image\(|navigator\.geolocation|\/api\//.test(N_LIFTED),
    'the table path acquired a request');

  /* ---- IT PROMISES NOTHING IT CANNOT DO ---- */
  // The four words the round forbids in visible text, plus the two this item forbids by name,
  // matched with the harakat stripped so an undotted spelling cannot walk past the scan.
  const strip = (x) => String(x).replace(/[\u064B-\u0652\u0670\u0640]/g, '');
  const FORBIDDEN = [
    ['tadhkir', '\u062A\u0630\u0643\u064A\u0631'],
    ['tanbih', '\u062A\u0646\u0628\u064A\u0647'],
    ['yudhakkiruk', '\u064A\u0630\u0643\u0631\u0643'],
    ['nuallimuk', '\u0646\u0639\u0644\u0645\u0643'],
    ['adhan', '\u0623\u0630\u0627\u0646'],
    ['ishaar', '\u0625\u0634\u0639\u0627\u0631'],
  ];
  const SCHED_TEXT = ['PRAYER_SCHEDULE_TITLE', 'PRAYER_SCHEDULE_SHOW', 'PRAYER_SCHEDULE_HIDE',
    'PRAYER_SCHEDULE_NOTE', 'PRAYER_SUNRISE_NOTE'].map((n) => liftConst(n)).join('\n');
  ok('A-2: the table text was found to scan', SCHED_TEXT.length > 40);
  for (const w of FORBIDDEN) {
    ok('A-2: the table promises no ' + w[0], SCHED_TEXT.length > 40 && strip(SCHED_TEXT).indexOf(strip(w[1])) === -1);
  }
  // !! ITEMS 43-b / 47-b NARROWED THIS BAN TO THE THING IT WAS EVER ABOUT: THE TABLE.
  //
  // WHY THE BAN EXISTED. Round 25 forbade a time field ANYWHERE in the client because nothing in
  // the client could ring: a reader who set an hour would have been failed silently by software
  // that never intended to wake up. The layer holding the wird choice says so in its own words --
  // "the time field is born on the day notifications ship and not one hour before it".
  //
  // WHAT CHANGED. That day came. Item 67 shipped the engine -- murabbi-shell fires real system
  // notifications off absolute timestamps this client computes -- and items 43-b / 47-b ship the
  // screen the reader sets the hours on. A time field is no longer a promise this client cannot
  // keep.
  //
  // AND THE BAN DOES NOT BECOME A PERMISSION. What THIS case is about is the thirty-day PRAYER
  // TABLE, whose times are COMPUTED and must never become times a reader picks. So the scan
  // narrows to the table, its Settings control, the table's own visible text and the whole lifted
  // table path -- four places, each named, where it is stricter than a whole-file substring could
  // be. The whole-file half moves to A-3, where the allowance is named and BACKED line by line.
  //
  // The two slices are re-derived here rather than borrowed from the 107 block, which is a scope
  // of its own: a check that silently read an empty string would pass on every tree, which is the
  // exact failure these guards exist to prevent.
  {
    const T_AT = SRC_CODE.indexOf('function PrayerTimesPanel(');
    const T_END = T_AT === -1 ? -1 : SRC_CODE.indexOf('function PrayerSettingsControl(', T_AT);
    const T = (T_AT !== -1 && T_END > T_AT) ? SRC_CODE.slice(T_AT, T_END) : '';
    const P_AT = SRC_CODE.indexOf('function PrayerSettingsControl(');
    const P_END = P_AT === -1 ? -1 : SRC_CODE.indexOf('const KAABA_LAT', P_AT);
    const P = (P_AT !== -1 && P_END > P_AT) ? SRC_CODE.slice(P_AT, P_END) : '';
    const noTime = (blob) => TIME_FIELD.every((t) => blob.indexOf(t) === -1);
    ok('A-2: and the table offers no time field, so it cannot promise an hour it will not keep',
      T.length > 800 && P.length > 500
      && noTime(T) && noTime(P) && noTime(SCHED_TEXT) && noTime(N_LIFTED),
      'panel=' + T.length + ' settings=' + P.length);
  }

  /* ---- the sunrise is DECLARED computed, not calibrated ---- */
  const sunNote = liftConst('PRAYER_SUNRISE_NOTE') || '';
  ok('A-2: the interface says in words that the sunrise is computed and takes no offset',
    sunNote.length > 20 && strip(sunNote).indexOf(strip('\u0645\u064F\u0639\u0627\u064A\u064E\u0631')) !== -1);
  ok('A-2: and the sunrise is absent from the offsettable list in the shipped source',
    B0.PRAYER_OFFSETTABLE.indexOf('sunrise') === -1 && B0.PRAYER_KEYS.indexOf('sunrise') !== -1);
}


// ---------------------------------------------------------------------------
// O. ROUND 25 A-3 -- THE SELECTION LAYER, AND THE PROMISE IT MUST NOT MAKE
// ---------------------------------------------------------------------------
// The reader chooses his own daily content in each of the three modules, the choice is kept
// on the device, and the home screen shows it back. This section runs that record and then
// enforces the constraint the round called the most dangerous one in it:
//
//   NO GIVING AND THEN TAKING AWAY. Not one visible string in the whole shipped client may
//   say 'remind', 'alert', 'it will remind you' or 'we will let you know', and there may be
//   no time field anywhere. A control that asks a child for an hour, when nothing in the
//   application can ring at that hour, is a lie told by software -- and the child is the one
//   who finds out. The hour is born the day notifications ship, and not before.
//
// The scan below is over the WHOLE client's visible text, not merely this layer's, and its
// match count is printed so the number is read rather than trusted.

const O_CONSTS = ['DAILY_WIRD_KEY', 'DAILY_WIRD_MODES', 'DW_LINE_MUSHAF', 'DW_LINE_ADHKAR',
  'DW_LINE_MEMORIZE', 'DW_SURAH_WORD', 'DW_PAGES_WORD', 'DW_CARD_TITLE', 'DW_CARD_EMPTY',
  'DW_MUSHAF_LABEL', 'DW_ADHKAR_LABEL', 'DW_MEMORIZE_LABEL', 'toArabicDigits', 'SURAH_ORDER'];
const O_FNS = ['readDailyWird', 'writeDailyWird', 'dailyWirdLines'];

const oConsts = {};
const oFns = {};
let oLifted = true;
for (const n of O_CONSTS) { oConsts[n] = liftConst(n); if (!ok('A-3: lift const ' + n, !!oConsts[n])) oLifted = false; }
for (const n of O_FNS) { oFns[n] = liftFunction(n); if (!ok('A-3: lift function ' + n, !!oFns[n])) oLifted = false; }

if (oLifted) {
  // SURAH_NAMES is built by a loop over the name table, so lifting its declaration would hand
  // back an empty object. It is stubbed with ASCII names instead: what is under test here is
  // that the line NAMES the chosen surah from that map, not what Arabic the map holds.
  const O_LIFTED = O_CONSTS.map((n) => oConsts[n]).concat(O_FNS.map((n) => oFns[n])).join('\n\n')
    + '\nconst SURAH_NAMES = { 1: "ALFATIHA", 2: "ALBAQARA", 114: "ALNAS" };';
  ok('A-3: lifted block braces balance',
    (O_LIFTED.match(/\{/g) || []).length === (O_LIFTED.match(/\}/g) || []).length);

  const OS = (store) => new Function('localStorage', 'JSON', 'Object', 'Array',
    O_LIFTED + '\nreturn { ' + O_CONSTS.concat(O_FNS).join(', ') + ', SURAH_NAMES };')(store, JSON, Object, Array);

  /* ---- the key: new, versioned, and nobody else's ---- */
  const D0 = OS(memStore());
  eq('A-3: the selection record has its own versioned key', D0.DAILY_WIRD_KEY, 'ezik_daily_wird_v1');
  ok('A-3: ...and it is none of the keys that already existed',
    ['mushaf_wird_target_v1', 'mushaf_wird_day_v1', 'ezik_adhkar_streak_v1', 'ezik_prayer_prefs_v1',
      'ezik_hijri_offset_v1', 'child_profile'].indexOf(D0.DAILY_WIRD_KEY) === -1);
  eq('A-3: a mushaf wird is a page count or a surah, and nothing else', D0.DAILY_WIRD_MODES.join(','), 'pages,surah');
  eq('A-3: the canonical 114 are offered in the mushaf order', D0.SURAH_ORDER.length, 114);
  ok('A-3: ...beginning at al-Fatiha and ending at 114',
    D0.SURAH_ORDER[0] === 1 && D0.SURAH_ORDER[113] === 114);

  /* ---- NOTHING EXISTING IS RENAMED OR MIGRATED ---- */
  const storeSrc = oFns.readDailyWird + '\n' + oFns.writeDailyWird;
  const setItems = storeSrc.match(/setItem\(/g) || [];
  const removeItems = storeSrc.match(/removeItem\(/g) || [];
  eq('A-3: the selection store writes exactly one key', setItems.length, 1);
  ok('A-3: ...and that key is its own', /setItem\(DAILY_WIRD_KEY/.test(storeSrc));
  eq('A-3: ...and it deletes nothing, so no existing store is migrated away', removeItems.length, 0);
  ok('A-3: the pre-existing page-count key is still the one the mushaf reads',
    SRC.indexOf("const WIRD_TARGET_KEY = 'mushaf_wird_target_v1';") !== -1);

  /* ---- a fresh device has chosen nothing ---- */
  const fresh = OS(memStore()).readDailyWird();
  ok('A-3: a fresh device has chosen nothing at all',
    fresh.mushaf.mode === '' && fresh.mushaf.surah === 0 && fresh.adhkar.cat === ''
    && fresh.memorize.surah === 0);

  /* ---- each module's choice round-trips ---- */
  const st1 = memStore();
  const D1 = OS(st1);
  const w1 = D1.writeDailyWird({ mushaf: { mode: 'surah', surah: 114 } });
  eq('A-3: a chosen surah survives the round trip', w1.mushaf.surah, 114);
  eq('A-3: ...as a surah wird, not a page wird', w1.mushaf.mode, 'surah');
  const w2 = D1.writeDailyWird({ adhkar: { cat: 'morning', title: 'T' } });
  eq('A-3: a chosen dhikr survives the round trip', w2.adhkar.cat, 'morning');
  ok('A-3: ...and it keeps the surah already chosen in another module', w2.mushaf.surah === 114);
  const w3 = D1.writeDailyWird({ memorize: { surah: 2 } });
  eq('A-3: a chosen memorisation survives the round trip', w3.memorize.surah, 2);
  ok('A-3: ...and all three choices stand together', w3.mushaf.surah === 114 && w3.adhkar.cat === 'morning');
  ok('A-3: the choices are on the device and nowhere else', st1.has('ezik_daily_wird_v1'));

  /* ---- half a choice is not a choice ---- */
  const half = OS(memStore({ ezik_daily_wird_v1: '{"mushaf":{"mode":"surah","surah":0}}' })).readDailyWird();
  eq('A-3: a surah wird with no surah behind it is refused', half.mushaf.mode, '');
  const bad = ['0', '115', '-1', '1.5', '"x"', 'null'];
  let refused = 0;
  for (const v of bad) {
    const r = OS(memStore({ ezik_daily_wird_v1: '{"memorize":{"surah":' + v + '}}' })).readDailyWird();
    if (r.memorize.surah === 0) refused++;
  }
  eq('A-3: every surah number outside 1..114 is refused', refused, bad.length);

  /* ---- a broken store is 'nothing chosen', never an exception ---- */
  const broken = ['', 'not json', '[]', 'null', '3', '{"mushaf":5}', '{"adhkar":[]}'];
  let quiet = 0, threw = 0;
  for (const b of broken) {
    try {
      const r = OS(memStore({ ezik_daily_wird_v1: b })).readDailyWird();
      if (r.mushaf.mode === '' && r.adhkar.cat === '' && r.memorize.surah === 0) quiet++;
    } catch (e) { threw++; }
  }
  eq('A-3: every broken store reads as nothing chosen', quiet, broken.length);
  eq('A-3: ...and none of them throws at the reader', threw, 0);
  const deafD = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); },
    removeItem() { throw new Error('no'); } };
  let deafOk = false;
  try { const d = OS(deafD); d.writeDailyWird({ memorize: { surah: 2 } }); deafOk = d.readDailyWird().memorize.surah === 0; }
  catch (e) { deafOk = false; }
  ok('A-3: a storage that denies every operation neither throws nor invents a choice', deafOk);

  /* ---- the card shows what was chosen, and only that ---- */
  const D2 = OS(memStore());
  eq('A-3: nothing chosen draws no lines', D2.dailyWirdLines(D2.readDailyWird(), null).length, 0);
  const chose = { mushaf: { mode: 'surah', surah: 1 }, adhkar: { cat: 'c', title: 'DHIKR' }, memorize: { surah: 114 } };
  const lines = D2.dailyWirdLines(chose, null);
  eq('A-3: three choices draw three lines', lines.length, 3);
  ok('A-3: the mushaf line names the chosen surah from SURAH_NAMES', lines[0].indexOf('ALFATIHA') !== -1);
  ok('A-3: the dhikr line names the chosen category', lines[1].indexOf('DHIKR') !== -1);
  ok('A-3: the memorisation line names its own surah', lines[2].indexOf('ALNAS') !== -1);
  const pages = D2.dailyWirdLines({ mushaf: { mode: 'pages', surah: 0 }, adhkar: { cat: '', title: '' }, memorize: { surah: 0 } }, 5);
  eq('A-3: a page wird draws one line', pages.length, 1);
  const pagesNone = D2.dailyWirdLines({ mushaf: { mode: 'pages', surah: 0 }, adhkar: { cat: '', title: '' }, memorize: { surah: 0 } }, null);
  eq('A-3: ...and with no page target stored it invents none', pagesNone.length, 0);

  /* ---- one dropdown per module, and they are dropdowns ---- */
  const selects = SRC.match(/<select/g) || [];
  ok('A-3: the three modules each carry a dropdown',
    (SRC.match(/aria-label=\{DW_MUSHAF_LABEL\}/g) || []).length === 1
    && (SRC.match(/aria-label=\{DW_ADHKAR_LABEL\}/g) || []).length === 1
    && (SRC.match(/aria-label=\{DW_MEMORIZE_LABEL\}/g) || []).length === 1);
  ok('A-3: and each of the three is a real dropdown', selects.length >= 5);
  ok('A-3: the home card is drawn from the stored choices, not from a second source',
    SRC.indexOf('{DW_CARD_TITLE}') !== -1 && SRC.indexOf('v.dailyWirdLines') !== -1);

  /* ================= THE BINDING SCAN ================= */
  // Visible text only: comments are stripped first, because a word nobody is shown is not a
  // promise made to anybody.
  const visible = (function () {
    const noC = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    const AR = /[\u0600-\u06FF]/;
    const out = [];
    const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
    let m;
    while ((m = re.exec(noC)) !== null) {
      const v = m[1] !== undefined ? m[1] : m[2];
      if (v && AR.test(v)) out.push(v);
    }
    const jsxRe = />([^<>{}]*[\u0600-\u06FF][^<>{}]*)</g;
    while ((m = jsxRe.exec(noC)) !== null) out.push(m[1]);
    return out;
  })();
  const stripH = (x) => String(x).replace(/[\u064B-\u0652\u0670\u0640]/g, '');
  const PROMISE_WORDS = [
    ['tadhkir', '\u062A\u0630\u0643\u064A\u0631'],
    ['tanbih', '\u062A\u0646\u0628\u064A\u0647'],
    ['yudhakkiruk', '\u064A\u0630\u0643\u0631\u0643'],
    ['nuallimuk', '\u0646\u0639\u0644\u0645\u0643'],
  ];
  ok('A-3: the visible-text scan actually read the client', visible.length > 200);
  // ITEM 67 NARROWED THIS BAN -- ONE OF ITS FOUR WORDS, AND ONLY INSIDE ONE NAMED SET OF LINES.
  //
  // WHY THE BAN EXISTED. Round 25 A-3 forbade these four words in visible text because the
  // client could not keep any of the promises they make: nothing in this application reminded
  // anybody of anything, there was no time field, no alarm and no notification. A screen saying
  // "tadhkir" would have been a promise with nothing behind it, and this repository counts that
  // as a lie whether or not anybody complains about it.
  //
  // WHAT CHANGED. Item 67 built the thing the word names. murabbi-shell schedules real system
  // notifications; the web half hands it the five prayers of the next seven local days with
  // absolute timestamps and text already written in the reader's language; and the reader now has
  // a switch which asks the system for permission and turns the whole of it on or off. The word
  // is no longer a promise this client cannot keep. It is the NAME of something it ships.
  //
  // SO THE BAN DOES NOT BECOME A PERMISSION. It becomes an EXACT ALLOWANCE -- the same shape item
  // 67 gave gate 107's ban on the latin type name -- and everything the ban ever stood in for is
  // now asserted DIRECTLY instead of through a word:
  //
  //   * the other three words are still forbidden outright, everywhere, with no exception;
  //   * this one is allowed ONLY inside the values of the switch's own dictionary keys, and the
  //     count of visible strings carrying it ANYWHERE else must be zero -- a second one fails,
  //     including one added to a panel, a tile or a settings row;
  //   * and the promise is CHECKED rather than trusted. The switch has to exist, be drawn only
  //     behind the shell bridge, default to off, gate the feed, and raise the system prompt from
  //     the reader's press and from nowhere else. The day any of that stops being true the word
  //     goes back to being a promise with nothing behind it, and these fail before the scan does.
  // !! ITEMS 43-b / 47-b -- A SECOND SWITCH, SO A SECOND PREFIX, AND NOT ONE LETTER MORE.
  // Item 67 allowed the word inside the values of `prayer.notify.*` and nowhere else at all. The
  // four reminders a reader now sets their own times for are the same kind of thing by exactly the
  // same reasoning: they NAME an engine that exists rather than promise one that does not. So
  // `reminders.*` joins it. Both prefixes are read out of the dictionary as it stands rather than
  // retyped, the count outside them must still be zero, and everything the ban stood in for is
  // asserted directly for the new switch below exactly as it already is for the old.
  const NOTIFY_LINES = new Set();
  {
    const re = /'((?:prayer\.notify|reminders)\.[a-zA-Z.]+)': '((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(SRC)) !== null) NOTIFY_LINES.add(m[2]);
  }
  ok('A-3: the switches\' own lines were found to scan (' + NOTIFY_LINES.size + ')', NOTIFY_LINES.size >= 30);
  const ALLOWED_IN = 'tadhkir';
  let promiseHits = 0;
  for (const w of PROMISE_WORDS) {
    const hits = visible.filter((t) => stripH(t).indexOf(stripH(w[1])) !== -1);
    const stray = w[0] === ALLOWED_IN ? hits.filter((t) => !NOTIFY_LINES.has(t)) : hits;
    promiseHits += stray.length;
    ok('A-3: no visible string says ' + w[0] + ' outside the switch it names (matches=' + hits.length
      + ', outside=' + stray.length + ')', visible.length > 200 && stray.length === 0);
  }
  console.log('  A-3 SCAN: visible Arabic strings=' + visible.length
    + '  forbidden-word matches outside the switch=' + promiseHits);
  eq('A-3: THE COUNT THE ROUND REQUIRES TO BE ZERO', promiseHits, 0);
  // ---- AND THE ONE ALLOWANCE IS BACKED, LINE BY LINE ----
  ok('A-3: the word names a switch that exists',
    SRC.indexOf('function PrayerNotifyToggle() {') !== -1
    && (SRC.match(/<PrayerNotifyToggle \/>/g) || []).length === 1);
  ok('A-3: ...which is drawn only where there is an engine behind it, and nowhere else',
    /function PrayerNotifyToggle\(\) \{[\s\S]{0,2000}?if \(!ezikSchedBridge\(\)\) return null;/.test(SRC));
  ok('A-3: ...whose store defaults to off, with exactly one value that means on',
    /const PRAYER_NOTIFY_ON = '[a-z]+';/.test(SRC)
    && SRC.indexOf('return localStorage.getItem(PRAYER_NOTIFY_KEY) === PRAYER_NOTIFY_ON;') !== -1);
  ok('A-3: ...and nothing at all is scheduled until the reader turns it on',
    SRC.indexOf('if (!readPrayerNotify()) return [];') !== -1);
  // !! THE TWO COUNTS ARE TAKEN ON CODE, NOT ON CODE PLUS PROSE. They read "the permission is
  // asked for from the press and from nowhere else" and "turning it off cancels rather than
  // merely forgetting" -- and a COMMENT naming either function does neither. Counting the raw
  // file made a paragraph explaining the rule indistinguishable from a second breach of it, which
  // is a check that punishes the one thing it should reward. Comments are stripped first; the
  // numbers, the labels and the direction of both assertions are exactly what they were.
  const CODE = SRC_CODE;
  ok('A-3: ...and the system permission is asked for from the press and from nowhere else',
    (CODE.match(/ezikNotifyAsk\(\)/g) || []).length === 2);
  ok('A-3: ...and turning it off cancels rather than merely forgetting',
    (CODE.match(/ezikNotifyStop\(\)/g) || []).length === 2
    && CODE.indexOf('op: SHELL_SCHED_CANCEL_OP,') !== -1);

  // ---- ITEMS 43-b / 47-b: THE SECOND SWITCH, BACKED THE WAY THE FIRST ONE IS ----
  //
  // The time field is the whole of what round 25 forbade, so it is allowed in exactly ONE
  // component and the count anywhere else in the client must be zero. And, exactly as with the
  // word above, the allowance is CHECKED rather than trusted: the reminders have to exist, be
  // reachable from the settings the reader already knows, default to off, gate their own feed,
  // reach the system prompt through the one shared sender rather than a copy of it, leave the
  // channel the prayers ride alone when one of them is switched off, and go with "delete all my
  // data". The day any of that stops being true the field goes back to being a promise with
  // nothing behind it, and these fail before the scan does.
  {
    const CMP = 'function EzikReminderSettings() {';
    const at = CODE.indexOf(CMP);
    const end = at === -1 ? -1 : CODE.indexOf('\nfunction SettingsSheet(', at);
    const REM = (at !== -1 && end > at) ? CODE.slice(at, end) : '';
    ok('A-3: the time field names a screen that exists, reached from the settings that do',
      REM.length > 1500 && (CODE.match(/<EzikReminderSettings \/>/g) || []).length === 1,
      'component=' + REM.length);
    const count = (blob, t) => { let n = 0, i = -1; while ((i = blob.indexOf(t, i + 1)) !== -1) n++; return n; };
    let inside = 0, outside = 0;
    for (const t of TIME_FIELD) { inside += count(REM, t); outside += count(CODE, t) - count(REM, t); }
    ok('A-3: ...and the client offers a time field THERE and nowhere else (inside=' + inside
      + ', outside=' + outside + ')', inside > 0 && outside === 0);
    ok('A-3: ...whose store defaults to off, with exactly one value that means on',
      /const REMINDERS_KEY = '[a-z_0-9]+';/.test(SRC)
      && REM.indexOf('readReminders') !== -1
      && SRC.indexOf('out[f.id] = { on: got.on === true, times: times };') !== -1
      && SRC.indexOf('out[f.id] = { on: false, times: [f.at] };') !== -1);
    ok('A-3: ...and nothing at all is scheduled until the reader turns one on',
      SRC.indexOf('if (!got || got.on !== true) continue;') !== -1
      && SRC.indexOf('return ezikAdhanFeed().concat(ezikReminderItems(new Date()));') !== -1);
    ok('A-3: ...and it asks the system through the one sender both switches share',
      REM.indexOf('ezikNotifyRequest(') !== -1 && REM.indexOf('SHELL_SCHED_ENABLE_OP') === -1);
    ok('A-3: ...and turning one off never cancels the channel the prayers ride on',
      REM.indexOf('ezikNotifyStop') === -1 && REM.indexOf('ezikSchedArm()') !== -1);
    ok('A-3: ...and the hours a reader chose go with "delete all my data"',
      SRC.indexOf('localStorage.removeItem(REMINDERS_KEY);') !== -1);
  }
}


// ---------------------------------------------------------------------------
// P. ROUND 25 A-4 -- THE OFFLINE PACKAGE, AND THE FOUR CONDITIONS IT STANDS ON
// ---------------------------------------------------------------------------
// The WORKER side of this item is B16 in quest-bank-integrity-guard.cjs: the published
// ceiling, the floor, the store name, and the proof that the ceiling holds the largest juz
// whole. (It lives there because the juz ranges come out of mushaf-layout.json, and THIS
// guard opens no asset but the shipped client -- a rule this item does not get to weaken.)
//
// This is the PAGE side: the four conditions without any one of which the button lies.
//   1. an estimate BEFORE the first byte, and a refusal that says why;
//   2. a visible count while it runs;
//   3. every failure counted and shown -- no swallowed rejection anywhere on the path;
//   4. the eviction rule, in words, on the same panel.
// The room decision is a PURE function on purpose, so every branch of condition 1 is driven
// here with no browser, no disk and no worker.

// The control is an arrow, not a `function` declaration, so it gets its own brace-matched
// lift -- and a THROW when the anchor is gone, never a silent empty string that would make
// every check below pass by reading nothing.
function liftArrow(name) {
  const sig = 'const ' + name + ' = async () => {';
  const i = SRC.indexOf(sig);
  if (i < 0) throw new Error('wird-guard A-4: ' + name + ' not found in the shipped client');
  const open = SRC.indexOf('{', i + sig.length - 1);
  let depth = 0;
  for (let j = open; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(i, j + 1); }
  }
  throw new Error('wird-guard A-4: ' + name + ' has unbalanced braces');
}

const P_CONSTS = ['JUZ_DL_PAGE_BYTES', 'MADINA_IMG_PAGES'];
const P_FNS = ['juzPagesFor', 'juzOfPage', 'juzRoomVerdict'];
const pConsts = {};
const pFns = {};
let pLifted = true;
for (const n of P_CONSTS) { pConsts[n] = liftConst(n); if (!ok('A-4: lift const ' + n, !!pConsts[n])) pLifted = false; }
for (const n of P_FNS) { pFns[n] = liftFunction(n); if (!ok('A-4: lift function ' + n, !!pFns[n])) pLifted = false; }

if (pLifted) {
  const P_LIFTED = P_CONSTS.map((n) => pConsts[n]).concat([pFns.juzRoomVerdict]).join('\n\n');
  const PS = new Function('Object',
    P_LIFTED + '\nreturn { JUZ_DL_PAGE_BYTES, MADINA_IMG_PAGES, juzRoomVerdict };')(Object);

  /* ---- CONDITION 1, every branch of it ---- */
  const POL = { cap: 60, minFree: 50 * 1024 * 1024 };
  const need23 = 23 * PS.JUZ_DL_PAGE_BYTES;
  eq('A-4: with no worker to answer, the download does not start',
    PS.juzRoomVerdict(null, 1e12, 23).why, 'noworker');
  ok('A-4: ...and that is a refusal, not a silent pass', PS.juzRoomVerdict(null, 1e12, 23).ok === false);
  eq('A-4: with the free space unmeasurable, the download does not start',
    PS.juzRoomVerdict(POL, null, 23).why, 'unmeasured');
  ok('A-4: ...because an estimate that could not be taken is not an estimate that passed',
    PS.juzRoomVerdict(POL, null, 23).ok === false);
  eq('A-4: one byte short of the worker\'s own floor, it does not start',
    PS.juzRoomVerdict(POL, need23 + POL.minFree - 1, 23).why, 'nospace');
  ok('A-4: exactly at the floor it starts', PS.juzRoomVerdict(POL, need23 + POL.minFree, 23).ok === true);
  ok('A-4: the refusal carries the three numbers the reader is owed',
    (function () {
      const v = PS.juzRoomVerdict(POL, 1000, 23);
      return v.need === need23 && v.free === 1000 && v.minFree === POL.minFree;
    })());
  ok('A-4: the need is the page count times the per-page estimate, never less',
    PS.juzRoomVerdict(POL, 1e12, 23).need === 23 * PS.JUZ_DL_PAGE_BYTES);
  eq('A-4: the printed book is still 604 pages', PS.MADINA_IMG_PAGES, 604);

  /* ---- CONDITIONS 2, 3 and 4, in the control itself ---- */
  let runSrc = '';
  let threwByName = false;
  try { runSrc = liftArrow('runJuzDownload'); } catch (e) { threwByName = true; }
  ok('A-4: the download control was found in the shipped client', !threwByName && runSrc.length > 400);
  if (runSrc.length > 400) {
    const fetchAt = runSrc.indexOf('await fetch(');
    const verdictAt = runSrc.indexOf('juzRoomVerdict(');
    ok('A-4: CONDITION 1 -- the room is decided BEFORE the first page is fetched',
      verdictAt !== -1 && fetchAt !== -1 && verdictAt < fetchAt);
    ok('A-4: ...and a refused verdict returns without fetching anything',
      /if \(!verdict\.ok\)[\s\S]*?return;/.test(runSrc));
    ok('A-4: CONDITION 2 -- how many of how many is put on screen as it runs',
      runSrc.indexOf('total: pages.length, done: done') !== -1);
    ok('A-4: CONDITION 3 -- no swallowed rejection: there is no empty catch on the path',
      !/catch\s*\([^)]*\)\s*\{\s*\}/.test(runSrc)
      && !/catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(runSrc));
    ok('A-4: ...and the one catch there is COUNTS the failure it caught',
      /catch \(e\) \{[\s\S]{0,80}failed\+\+/.test(runSrc));
    ok('A-4: ...and a page that fetched but was never STORED is reported too',
      runSrc.indexOf('skipped') !== -1 && runSrc.indexOf('storeFailed') !== -1);
    ok('A-4: ...and one press cannot become two runs',
      runSrc.indexOf("juzDl.phase === 'run'") !== -1);
  }
  const ruleTail = liftConst('JD_RULE_B') || '';
  const ruleHead = liftConst('JD_RULE_A') || '';
  ok('A-4: CONDITION 4 -- the eviction rule is a real sentence, not a label',
    ruleHead.length > 20 && ruleTail.length > 30);
  // Same PANEL, not merely same file: the rule has to be in front of the reader where the
  // button is, so the two are required to sit within a screenful of each other in the source.
  ok('A-4: ...and it is rendered on the same panel as the button',
    (function () {
      const btn = SRC.lastIndexOf('JD_BUSY : JD_BTN');
      const rule = SRC.lastIndexOf('JD_RULE_A + toArabicDigits(');
      return btn !== -1 && rule !== -1 && rule > btn && (rule - btn) < 1200;
    })());
  ok('A-4: the ceiling in that sentence is the WORKER\'s, pulled, never retyped in the client',
    SRC.indexOf('mushafPolicy') !== -1 && !/const JUZ_DL_CAP\b/.test(SRC));
  // The storage is the WORKER's job and stays the worker's job: the page fetches, and the
  // worker's own cache-first branch decides what is kept. A page that opened a cache itself
  // would be a second store with no ceiling and no eviction rule behind it.
  ok('A-4: the page opens no cache of its own -- storing stays with the worker',
    SRC.length > 0 && SRC.indexOf('caches.open(') === -1 && SRC.indexOf('caches.match(') === -1
    && SRC.indexOf('caches.delete(') === -1 && SRC.indexOf('caches.keys(') === -1);
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
