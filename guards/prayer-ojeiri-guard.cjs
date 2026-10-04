// prayer-ojeiri-guard.cjs -- ITEM 124, phase 2. The prayer calculator against the Ojeiri calendar (Kuwait).
//
// WHAT THIS HOLDS. The owner's ruling of 4 October 2026: a one-minute difference from the Ojeiri calendar
// is accepted ONLY on the safe side. Dhuhr, asr, maghrib and isha: Ezik never comes BEFORE Ojeiri on any day.
// Fajr and sunrise: Ezik never comes AFTER Ojeiri on any day. Everywhere, the allowed-side difference is at
// most two minutes. The reason is the owner's: no prayer is announced before its time, no fast is broken before
// maghrib, nothing is eaten after fajr.
//
// THE DATA is two months, fetched day by day from alojeiri.com/ar/ojeiri-calendar and kept in data/ as CSV
// (October 2026 = the matching month the rule was fitted on, November 2026 = the verification month, no second
// adjustment). The calculator is NOT re-typed here: its text is read out of app.jsx when this runs and evaluated
// verbatim, with the app's own default position (QIBLA_DEFAULT_LAT/LNG), Kuwait method, standard asr, no offsets,
// UTC+3.
//
// MUTANTS. Each of the three clauses of the rule is removed in turn and the check must fail: round to nearest
// instead of the safe direction, the directions swapped, and Kuwait's fixed seconds dropped.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app.jsx'), 'utf8');
let passed = 0, failed = 0;
const ok = (name, cond, detail) => {
  if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
};

function lifted(src) {
  const fn = (name) => {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('missing function ' + name);
    const open = src.indexOf('{', src.indexOf(')', i));
    let d = 0, k = open;
    for (; ; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
    return src.slice(i, k + 1);
  };
  const cst = (name) => {
    const m = src.match(new RegExp('^const ' + name + ' = [^\n]*;$', 'm'));
    if (!m) throw new Error('missing const ' + name);
    return m[0];
  };
  const consts = ['PRAYER_METHOD_DEFAULT', 'PRAYER_ASR_DEFAULT', 'PRAYER_OFFSET_MIN', 'PRAYER_OFFSET_MAX', 'PRAYER_KEYS',
    'PRAYER_OFFSETTABLE', 'PRAYER_HORIZON', 'PRAYER_ROUND_UP', 'PRAYER_CALC_VERSION', 'QIBLA_DEFAULT_LAT', 'QIBLA_DEFAULT_LNG'];
  const fns = ['prayerMethodTable', 'prayerMethodIds', 'prayerMethodOf', 'prayerSunPosition', 'prayerSunAngleTime',
    'prayerAsrAngle', 'hijriJdnFromCivil', 'prayerTimesFor'];
  return consts.map(cst).join('\n') + '\n' + fns.map(fn).join('\n');
}
function machine(code) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(code + ';this.f=prayerTimesFor;this.keys=PRAYER_KEYS;this.lat=QIBLA_DEFAULT_LAT;this.lng=QIBLA_DEFAULT_LNG;', ctx);
  return ctx;
}
const ref = (file) => fs.readFileSync(path.join(ROOT, 'data', file), 'utf8').trim().split('\n').slice(1).map((l) => {
  const c = l.split(',');
  return { date: c[0], t: c.slice(1).map((s) => { const p = s.split(':'); return Number(p[0]) * 60 + Number(p[1]); }) };
});
const COLS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const EARLY_SIDE = [true, true, false, false, false, false]; // fajr, sunrise: Ezik may only be earlier

// Per month, per column: the distribution of (ezik - ojeiri), the forbidden count and the worst allowed-side gap.
function judge(ctx, file, month) {
  const rows = ref(file);
  const out = COLS.map(() => ({ dist: {}, forbidden: 0, worst: 0 }));
  rows.forEach((r, i) => {
    const t = ctx.f(2026, month, i + 1, ctx.lat, ctx.lng, 180, 'kuwait', 'standard', null);
    COLS.forEach((k, c) => {
      const d = t[k] - r.t[c];
      out[c].dist[d] = (out[c].dist[d] || 0) + 1;
      const forbidden = EARLY_SIDE[c] ? d > 0 : d < 0;
      if (forbidden) out[c].forbidden++;
      else out[c].worst = Math.max(out[c].worst, Math.abs(d));
    });
  });
  return { rows: rows.length, cols: out };
}
const clean = (j) => j.cols.every((c) => c.forbidden === 0 && c.worst <= 2);

console.log('prayer-ojeiri-guard: the calculator against the Ojeiri calendar, safe side only');
const ctx = machine(lifted(SRC));
const MONTHS = [['prayer-ojeiri-kw-2026-10.csv', 10, 31, 'October 2026 (matching month)'],
  ['prayer-ojeiri-kw-2026-11.csv', 11, 30, 'November 2026 (verification month)']];
for (const [file, month, days, label] of MONTHS) {
  const j = judge(ctx, file, month);
  ok(label + ': the table has every day of the month', j.rows === days);
  COLS.forEach((k, c) => {
    ok(label + ': ' + k + ' never on the forbidden side', j.cols[c].forbidden === 0,
      'forbidden days ' + j.cols[c].forbidden + ' distribution ' + JSON.stringify(j.cols[c].dist));
    ok(label + ': ' + k + ' allowed-side gap at most two minutes', j.cols[c].worst <= 2, 'worst ' + j.cols[c].worst);
  });
}
ok('the stored thirty-day table is stamped with the calculation version', /'calc' \+ PRAYER_CALC_VERSION/.test(SRC));
ok('the calculation version is a positive integer', Number.isInteger(Number(/^const PRAYER_CALC_VERSION = (\d+);$/m.exec(SRC)[1])));

// --- the mutants -----------------------------------------------------------------------------------
const mutate = (name, from, to) => {
  const code = lifted(SRC);
  if (code.indexOf(from) < 0 || code.indexOf(from) !== code.lastIndexOf(from)) { ok('MUTANT ' + name + ': seam present exactly once', false); return; }
  let killed = false;
  try {
    const m = machine(code.replace(from, to));
    killed = MONTHS.some(([file, month]) => !clean(judge(m, file, month)));
  } catch (e) { killed = true; }
  ok('MUTANT ' + name + ' KILLED', killed);
};
mutate('round to nearest', '(PRAYER_ROUND_UP[k] === true ? Math.ceil(exact) : Math.floor(exact))', 'Math.round(exact)');
mutate('directions swapped', 'PRAYER_ROUND_UP[k] === true ?', 'PRAYER_ROUND_UP[k] !== true ?');
mutate('Kuwait fixed seconds dropped', "secs: { sunrise: -20 }", 'secs: {}');

console.log('\n' + (failed ? 'FAIL' : 'PASS') + '  ' + passed + ' checks passed, ' + failed + ' failed.');
process.exit(failed ? 1 : 0);
