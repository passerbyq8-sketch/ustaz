// guards/hijri-events-guard.cjs -- PRAYER REBUILD (29 October 2026): the occasions of the Hijri calendar, run and not read.
//
// Panel 4 computes its occasions on the app's own calendar (Umm al-Qura through Intl, the named fallback) with the
// reader's offset, and stores none of them. This guard lifts the shipped functions out of app.jsx by name and drives
// them against the civil days the build order fixed, on the same engine the app runs in (node's ICU, which the measure
// report found identical to the app's own conversion for every date it tried):
//   H1  1 Ramadan 1448 is 2027-02-08 and 10 Dhul-Hijjah 1448 is 2027-05-16
//   H2  the white days of Jumada al-Ula 1448 are 24, 25 and 26 October 2026
//   H3  with an offset of -1 every one of them moves one day later; with +1, one day earlier
//   H4  the five named occasions of a year carry their Hijri day, and Ashura is 10 Muharram
//   H5  the upcoming list from the build day starts with the next occasion ahead and is sorted by days
// A tree without panel 4 (origin/main before this branch) fails at the lift, by name.
//
// Usage: node guards/hijri-events-guard.cjs [path/to/app.jsx]     Exit 0 when every case holds.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const SRC_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO, 'app.jsx');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const say = (s) => process.stdout.write(String(s).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n');
let passed = 0, failed = 0;
const t = (name, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a === b) { passed++; say('  PASS  ' + name); } else { failed++; say('  FAIL  ' + name + '\n        got  ' + a + '\n        want ' + b); } };
const ok = (name, cond, detail) => t(name + (cond || !detail ? '' : ' [' + detail + ']'), !!cond, true);

function liftFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  const open = SRC.indexOf('{', SRC.indexOf(')', i));
  let d = 0, k = open;
  for (; ; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) break; } }
  return SRC.slice(i, k + 1);
}
function liftConst(name) {
  const m = SRC.match(new RegExp('^const ' + name + ' = [^\\n]*?;(?:\\s*//[^\\n]*)?$', 'm'));
  if (m) return m[0].replace(/\s*\/\/[^\n]*$/, '');
  const at = SRC.indexOf('const ' + name + ' = [\n');
  if (at < 0) throw new Error('missing const ' + name);
  const end = SRC.indexOf('\n];', at);
  if (end < 0) throw new Error('unterminated const ' + name);
  return SRC.slice(at, end + 3);
}
const CONSTS = ['HIJRI_CALENDAR', 'HIJRI_FALLBACK_CALENDAR', 'HIJRI_OFFSET_MIN', 'HIJRI_OFFSET_MAX', 'HIJRI_CONV_MIN_YEAR', 'HIJRI_CONV_MAX_YEAR', 'PRAYER_EVENTS'];
const FNS = ['hijriJdnFromCivil', 'hijriCivilFromJdn', 'hijriTabularFromJdn', 'hijriUmalquraFromJdn', 'hijriFromJdn', 'hijriForCivilDay', 'hijriToCivil',
  'prayerHijriEvents', 'prayerWhiteDays', 'prayerUpcomingEvents'];
let A = null;
try {
  const code = CONSTS.map(liftConst).join('\n') + '\n' + FNS.map(liftFn).join('\n');
  const ctx = { Math, Date, Number, String, isFinite, Array, Intl, parseInt };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.__api = {' + FNS.concat(CONSTS).join(',') + '};', ctx);
  A = ctx.__api;
  ok('the calendar lifted out of app.jsx by name (' + FNS.length + ' functions, ' + CONSTS.length + ' constants)', true);
} catch (e) { ok('the calendar lifted out of app.jsx by name', false, e.message); }

if (A) {
  const iso = (c) => (c ? c.y + '-' + String(c.m).padStart(2, '0') + '-' + String(c.d).padStart(2, '0') : null);
  ok('the engine resolves the Umm al-Qura calendar (the named one, not the fallback)', A.hijriFromJdn(2461000).by === A.HIJRI_CALENDAR, A.hijriFromJdn(2461000).by);
  // H1
  const ev = A.prayerHijriEvents(1448, 0);
  const byKey = (k) => ev.find((e) => e.key === k);
  t('H1 1 Ramadan 1448 is 2027-02-08', iso(byKey('ramadan').civil), '2027-02-08');
  t('H1 10 Dhul-Hijjah 1448 is 2027-05-16', iso(byKey('adha').civil), '2027-05-16');
  t('H1 ...and Arafah is the day before it', iso(byKey('arafah').civil), '2027-05-15');
  // H2
  t('H2 the white days of Jumada al-Ula 1448 are 24-26 October 2026', A.prayerWhiteDays(1448, 5, 0).map(iso), ['2026-10-24', '2026-10-25', '2026-10-26']);
  // H3
  const evM = A.prayerHijriEvents(1448, -1), evP = A.prayerHijriEvents(1448, 1);
  t('H3 with an offset of -1 every occasion moves one day later', evM.map((e) => iso(e.civil)), ['2026-06-26', '2027-02-09', '2027-03-10', '2027-05-16', '2027-05-17']);
  t('H3 ...and with +1 one day earlier', evP.map((e) => iso(e.civil)), ['2026-06-24', '2027-02-07', '2027-03-08', '2027-05-14', '2027-05-15']);
  t('H3 the white days move with it', A.prayerWhiteDays(1448, 5, -1).map(iso), ['2026-10-25', '2026-10-26', '2026-10-27']);
  // H4
  t('H4 the five occasions of a year, by key and Hijri day', ev.map((e) => [e.key, e.hm, e.hd]), [['ashura', 1, 10], ['ramadan', 9, 1], ['fitr', 10, 1], ['arafah', 12, 9], ['adha', 12, 10]]);
  t('H4 Ashura 1448 and Eid al-Fitr 1448 on the calendar', [iso(byKey('ashura').civil), iso(byKey('fitr').civil)], ['2026-06-25', '2027-03-09']);
  ok('H4 every civil day reads back as the Hijri day it was asked for', ev.every((e) => { const h = A.hijriForCivilDay(e.civil.y, e.civil.m, e.civil.d, 0); return h.y === 1448 && h.m === e.hm && h.d === e.hd; }));
  // H5
  const up = A.prayerUpcomingEvents({ y: 2026, m: 10, d: 29 }, 0, 6);
  t('H5 from the build day the next occasion is the first of Ramadan, 102 days away', [up[0].key, up[0].days, iso(up[0].civil)], ['ramadan', 102, '2027-02-08']);
  ok('H5 ...and the list is sorted by days with nothing past', up.every((e, i) => e.days >= 0 && (i === 0 || e.days >= up[i - 1].days)), JSON.stringify(up.map((e) => [e.key, e.days])));
  t('H5 ...six long: Ramadan, Fitr, Arafah, Adha of 1448, then Ashura and Ramadan of 1449', up.map((e) => e.key + e.hy), ['ramadan1448', 'fitr1448', 'arafah1448', 'adha1448', 'ashura1449', 'ramadan1449']);
  t('H5 an occasion falling today counts as today (zero days)', A.prayerUpcomingEvents({ y: 2027, m: 2, d: 8 }, 0, 1)[0].days, 0);
}
say('hijri-events-guard: ' + (failed ? 'FAIL' : 'PASS') + ' ' + passed + '/' + (passed + failed) + ' (' + path.relative(REPO, SRC_PATH) + ')');
process.exit(failed ? 1 : 0);
