// guards/compass-math-guard.cjs -- PRAYER REBUILD (29 October 2026): the compass's arithmetic, run and not read.
//
// WHAT WENT WRONG BEFORE (measure report F5): the needle angle was reduced to [0, 360) and then handed to a CSS
// transition, so facing the qibla -- the angle near 0/360 -- made every jitter a full turn. The cure is arithmetic:
// the shown angle is continuous and every step is the SHORTEST signed arc. This guard lifts the shipped functions
// out of app.jsx by name (brace-matched text, evaluated verbatim in a vm with nothing else in scope) and drives them:
//   C1  the shortest arc from 0.6 to 359.6 is -1, never +359
//   C2  smoothing from 350 to 10 walks through 0, never through 180 (every step within 20 degrees of north)
//   C3  the qibla bearing of Kuwait City is 224.6 +- 0.1
//   C4  WMM2025: Kuwait City's declination on the build day is between +3.4 and +4.4 (measured +3.74); New York's
//       is between -14 and -11; London's is EAST of north by a small angle (between +0.5 and +2.0): the build order
//       expected London negative, but WMM2025 -- validated against NCEI's own test values in the session -- puts the
//       agonic line west of London since 2022, so the guard holds the model's answer and the report says so
//   C5  the sun's azimuth over Kuwait City on 29 October 2026 at 16:00 (UTC+3) is 246 +- 2, and it is up
// A tree without the engine (origin/main before this branch) fails at the lift, by name.
//
// Usage: node guards/compass-math-guard.cjs [path/to/app.jsx]     Exit 0 when every case holds.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const SRC_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO, 'app.jsx');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const say = (s) => process.stdout.write(String(s).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n');
let passed = 0, failed = 0;
const ok = (name, cond, detail) => { if (cond) { passed++; say('  PASS  ' + name); } else { failed++; say('  FAIL  ' + name + (detail !== undefined ? ' [' + detail + ']' : '')); } };

function liftFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  const open = SRC.indexOf('{', SRC.indexOf(')', i));
  let d = 0, k = open;
  for (; ; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) break; } }
  return SRC.slice(i, k + 1);
}
function liftConst(name) {
  // a one-line const (its trailing comment dropped), or a multi-line array const that ends at the first `];` line
  const m = SRC.match(new RegExp('^const ' + name + ' = [^\\n]*?;(?:\\s*//[^\\n]*)?$', 'm'));
  if (m) return m[0].replace(/\s*\/\/[^\n]*$/, '');
  const at = SRC.indexOf('const ' + name + ' = [\n');
  if (at < 0) throw new Error('missing const ' + name);
  const end = SRC.indexOf('\n];', at);
  if (end < 0) throw new Error('unterminated const ' + name);
  return SRC.slice(at, end + 3);
}
const CONSTS = ['QIBLA_SMOOTH_ALPHA', 'QIBLA_SNAP_DEG', 'KAABA_LAT', 'KAABA_LNG', 'WMM_EPOCH', 'WMM_N', 'WMM_G', 'WMM_H', 'WMM_GD', 'WMM_HD'];
const FNS = ['qiblaArcDelta', 'qiblaSmoothStep', 'qiblaBearing', 'wmmDeclination', 'wmmYearOf', 'prayerSunPosition', 'prayerSunAzimuth'];
let A = null;
try {
  const code = CONSTS.map(liftConst).join('\n') + '\n' + FNS.map(liftFn).join('\n');
  const ctx = { Math, Date, Number, String, isFinite, Array };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.__api = {' + FNS.concat(CONSTS).join(',') + '};', ctx);
  A = ctx.__api;
  ok('the engine lifted out of app.jsx by name (' + FNS.length + ' functions, ' + CONSTS.length + ' constants)', true);
} catch (e) {
  ok('the engine lifted out of app.jsx by name', false, e.message);
}

if (A) {
  // C1 -- the shortest arc
  ok('C1 the arc from 0.6 to 359.6 is -1, not +359', Math.abs(A.qiblaArcDelta(0.6, 359.6) - (-1)) < 1e-9, A.qiblaArcDelta(0.6, 359.6));
  ok('C1 ...and back from 359.6 to 0.6 is +1', Math.abs(A.qiblaArcDelta(359.6, 0.6) - 1) < 1e-9);
  ok('C1 ...a half turn is -180 (one answer, never two)', A.qiblaArcDelta(0, 180) === -180 && A.qiblaArcDelta(10, 190) === -180);
  ok('C1 ...a shown angle far outside [0,360) still measures the short way', Math.abs(A.qiblaArcDelta(725, 10) - 5) < 1e-9 && Math.abs(A.qiblaArcDelta(-355, 10) - 5) < 1e-9);
  ok('C1 ...junk measures zero and never throws', A.qiblaArcDelta(NaN, 10) === 0 && A.qiblaArcDelta('x', 10) === 0);
  // C2 -- smoothing crosses north, not south
  {
    let shown = 350; const walk = [];
    for (let i = 0; i < 40; i++) { shown = A.qiblaSmoothStep(shown, 10, A.QIBLA_SMOOTH_ALPHA); walk.push(shown); }
    const farthestFromNorth = Math.max.apply(null, walk.map((v) => Math.abs(A.qiblaArcDelta(v, 0))));
    ok('C2 smoothing from 350 to 10 walks through 0 (every step within 20 degrees of north), not through 180',
      farthestFromNorth < 20 && Math.abs(A.qiblaArcDelta(shown, 10)) < 0.01, 'farthest ' + farthestFromNorth.toFixed(2) + ' end ' + shown.toFixed(3));
    ok('C2 ...and the shown angle is NOT reduced modulo 360 on the way (it runs past 360)', walk.some((v) => v > 360) && walk.every((v, i) => i === 0 || v >= walk[i - 1]), walk.slice(0, 4).map((v) => v.toFixed(1)).join(','));
    const first = A.qiblaSmoothStep(350, 10, A.QIBLA_SMOOTH_ALPHA);
    ok('C2 ...the first step is a quarter of the gap (alpha 0.25)', Math.abs(first - 355) < 1e-9, first);
    ok('C2 a gap wider than the snap width jumps straight', A.qiblaSmoothStep(0, 120, A.QIBLA_SMOOTH_ALPHA) === 120 && A.qiblaSmoothStep(0, 250, A.QIBLA_SMOOTH_ALPHA) === -110);
    ok('C2 the snap width is 90 degrees and the factor is a quarter', A.QIBLA_SNAP_DEG === 90 && A.QIBLA_SMOOTH_ALPHA === 0.25);
    ok('C2 no target leaves the shown angle where it is; no shown angle takes the target', A.qiblaSmoothStep(42, null, 0.25) === 42 && A.qiblaSmoothStep(null, 42, 0.25) === 42);
  }
  // C3 -- the bearing
  const b = A.qiblaBearing(29.3759, 47.9774);
  ok('C3 Kuwait City bears 224.6 +- 0.1 to the Kaaba', Math.abs(b - 224.6) <= 0.1, b);
  // C4 -- the declination, on the build day
  const Y = A.wmmYearOf(new Date(Date.UTC(2026, 9, 29)));
  const dKw = A.wmmDeclination(29.3759, 47.9774, Y);
  const dLon = A.wmmDeclination(51.5074, -0.1278, Y);
  const dNy = A.wmmDeclination(40.7128, -74.006, Y);
  ok('C4 the build day reads as 2026.8 in decimal years', Y > 2026.8 && Y < 2026.85, Y);
  ok('C4 WMM2025: Kuwait City on the build day is between +3.4 and +4.4 (measured +3.74)', dKw >= 3.4 && dKw <= 4.4, dKw);
  ok('C4 WMM2025: New York is between -14 and -11', dNy >= -14 && dNy <= -11, dNy);
  ok('C4 WMM2025: London is a small angle EAST of north (between +0.5 and +2.0; the model, not the order\'s guess)', dLon >= 0.5 && dLon <= 2.0, dLon);
  ok('C4 the epoch is 2025.0 and the model is degree 12 with 90 pairs', A.WMM_EPOCH === 2025 && A.WMM_N === 12 && A.WMM_G.length === 90 && A.WMM_H.length === 90 && A.WMM_GD.length === 90 && A.WMM_HD.length === 90);
  // the first three main-field terms as the COF file prints them (the dipole): a swapped or shifted array fails here
  ok('C4 the dipole terms are the file\'s (g10 -29351.8, g11 -1410.8, h11 4545.4)', A.WMM_G[0] === -29351.8 && A.WMM_G[1] === -1410.8 && A.WMM_H[1] === 4545.4);
  ok('C4 an impossible position has no declination', A.wmmDeclination(91, 0, Y) === null && A.wmmDeclination(0, 181, Y) === null && A.wmmDeclination('x', 0, Y) === null);
  // C5 -- the sun on the dial
  const sun = A.prayerSunAzimuth(Date.UTC(2026, 9, 29, 13, 0), 29.3759, 47.9774);
  ok('C5 the sun over Kuwait City on 29 October 2026 at 16:00 (UTC+3) stands at 246 +- 2 and is up', !!sun && Math.abs(sun.az - 246) <= 2 && sun.alt > 0, sun && (sun.az.toFixed(2) + ' / alt ' + sun.alt.toFixed(2)));
  const noon = A.prayerSunAzimuth(Date.UTC(2026, 9, 29, 9, 0), 29.3759, 47.9774);
  ok('C5 ...at noon it stands due south, high', !!noon && Math.abs(noon.az - 180) <= 12 && noon.alt > 40, noon && noon.az.toFixed(2));
  const night = A.prayerSunAzimuth(Date.UTC(2026, 9, 29, 21, 0), 29.3759, 47.9774);
  ok('C5 ...and at midnight it is below the horizon', !!night && night.alt < 0, night && night.alt.toFixed(2));
  ok('C5 junk has no sun', A.prayerSunAzimuth('x', 1, 1) === null && A.prayerSunAzimuth(0, 'x', 1) === null);
}

say('compass-math-guard: ' + (failed ? 'FAIL' : 'PASS') + ' ' + passed + '/' + (passed + failed) + ' (' + path.relative(REPO, SRC_PATH) + ')');
process.exit(failed ? 1 : 0);
