// prayer-features-guard.cjs -- ITEM 124, phase 3. The Salati-derived prayer features, one section per feature.
//
// TWO KINDS OF PROOF, BOTH BY RUNNING THE SHIPPED CODE:
//   * F-sections lift the real functions out of app.jsx by name (the brace-matched text, evaluated verbatim in a vm
//     with a storage stub) and drive them with literal inputs.
//   * S-scenes mount the shipped app.js in a linkedom window, open the prayer sheet through the scheduler's own `open`
//     event and drive the controls by their data-ezik-* attributes through React's own handlers. Each scene runs in its
//     own process (two linkedom windows in one process cross-talk).
//
// No request leaves this harness: /places.json is served from the repository file, every other path is refused.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
const NODE_TICK = setTimeout;
const tick = (ms = 40) => new Promise((resolve) => NODE_TICK(resolve, ms));
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const say = (s) => process.stdout.write(ascii(s) + '\n');

let passed = 0, failed = 0;
const t = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { passed++; say('  PASS  ' + name); } else { failed++; say('  FAIL  ' + name + '\n        got  ' + a + '\n        want ' + b); }
};
const ok = (name, cond, detail) => t(name + (cond || !detail ? '' : ' [' + detail + ']'), !!cond, true);

// ---------------------------------------------------------------------------------------------- lifting
function liftFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  const open = src.indexOf('{', src.indexOf(')', i));
  let d = 0, k = open;
  for (; ; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(i, k + 1);
}
function liftConst(src, name) {
  const m = src.match(new RegExp('^const ' + name + ' = [^\\n]*;$', 'm'));
  if (!m) throw new Error('missing const ' + name);
  return m[0];
}
function lifted(names, consts, env) {
  const code = consts.map((n) => liftConst(SRC, n)).join('\n') + '\n' + names.map((n) => liftFn(SRC, n)).join('\n');
  const ctx = Object.assign({ Intl, Date, Math, JSON, Object, Array, Number, String, isFinite, parseInt }, env || {});
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.__api = {' + names.join(',') + '};', ctx);
  return ctx.__api;
}
function memStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }, dump: () => Object.fromEntries(m) };
}

// ---------------------------------------------------------------------------------------------- F: place (124-1)
function sectionPlace() {
  say('F1  the place a reader chooses, and the zone it belongs to');
  const store = memStore();
  const A = lifted(['prayerZoneFmt', 'prayerZoneWall', 'prayerZoneOffset', 'readPrayerPlaceFor', 'writePrayerPlace',
    'prayerTzOn', 'prayerTodayParts', 'prayerInstant', 'prayerTzNow', 'readQiblaLoc', 'writeQiblaLoc', 'clearQiblaLoc'],
  ['QIBLA_LOC_KEY', 'QIBLA_DEFAULT_LAT', 'QIBLA_DEFAULT_LNG', 'PRAYER_PLACE_KEY', 'PRAYER_ZONE_FMT'],
  { localStorage: store, ezikWidgetDataChanged() {} });
  t('Kuwait zone offset', A.prayerZoneOffset('Asia/Kuwait', 2026, 10, 4), 180);
  t('Jakarta zone offset', A.prayerZoneOffset('Asia/Jakarta', 2026, 10, 4), 420);
  t('London in summer time', A.prayerZoneOffset('Europe/London', 2026, 10, 4), 60);
  t('London after the clocks go back', A.prayerZoneOffset('Europe/London', 2026, 11, 4), 0);
  t('New York the day before the spring change', A.prayerZoneOffset('America/New_York', 2026, 3, 7), -300);
  t('New York on the spring change day (noon is already summer time)', A.prayerZoneOffset('America/New_York', 2026, 3, 8), -240);
  t('an unknown zone is refused', A.prayerZoneOffset('Not/AZone', 2026, 10, 4), null);
  // The place's calendar day, not the device's.
  const now = new Date(Date.UTC(2026, 9, 4, 20, 0));
  t('Jakarta is already the next morning', A.prayerTodayParts(now, { tz: 'Asia/Jakarta' }), { y: 2026, m: 10, d: 5, mins: 180 });
  t('an instant in Jakarta is built from Jakarta\'s offset', A.prayerInstant(2026, 10, 4, 720, { tz: 'Asia/Jakarta' }, 420), Date.UTC(2026, 9, 4, 5, 0));
  t('with no place the instant is the device\'s wall clock', A.prayerInstant(2026, 10, 4, 725, null, 0), new Date(2026, 9, 4, 12, 5, 0, 0).getTime());
  t('with no place a negative total still rolls the day back', A.prayerInstant(2026, 10, 4, -30, null, 0), new Date(2026, 9, 3, 23, 30, 0, 0).getTime());
  // Storage: choose, read back, replace by a device fix, clear.
  const jak = { n: 'Jakarta', a: 'x', cc: 'ID', tz: 'Asia/Jakarta', lat: -6.2146, lng: 106.8451 };
  const after = A.writePrayerPlace(jak);
  t('choosing a place stores it and reads back as a place', [after.by, after.place.n, after.place.tz, after.lat, after.lng], ['place', 'Jakarta', 'Asia/Jakarta', -6.2146, 106.8451]);
  t('the position store holds only coordinates', JSON.parse(store.getItem('ezik_qibla_loc_v1')), { lat: -6.2146, lng: 106.8451 });
  t('the zone offset for "now" follows the place', A.prayerTzNow(now, after), 420);
  store.setItem('ezik_qibla_loc_v1', JSON.stringify({ lat: 1, lng: 2 }));
  t('a place standing on other coordinates is not believed', A.readQiblaLoc().by, 'device');
  A.writePrayerPlace(jak);
  const dev = A.writeQiblaLoc(29.37, 47.97);
  t('a device fix removes the place', [dev.by, store.getItem('ezik_prayer_place_v1')], ['device', null]);
  A.writePrayerPlace(jak);
  t('the default button removes the place and the position', [A.clearQiblaLoc().by, store.getItem('ezik_prayer_place_v1'), store.getItem('ezik_qibla_loc_v1')], ['default', null, null]);
  t('a place with an unknown zone is refused whole', [A.writePrayerPlace({ n: 'X', tz: 'Not/AZone', lat: 1, lng: 1 }).by, store.getItem('ezik_prayer_place_v1')], ['default', null]);
  t('a place out of range is refused whole', A.writePrayerPlace({ n: 'X', tz: 'Asia/Kuwait', lat: 91, lng: 1 }).by, 'default');
  t('the zone cache never throws on junk', A.prayerZoneWall('', 0), null);
  // The search itself.
  const S = lifted(['placeNorm', 'placeSearch'], [], {});
  const raw = JSON.parse(fs.readFileSync(path.join(REPO, 'places.json'), 'utf8'));
  const idx = raw.p.map((r) => { const keys = [S.placeNorm(r[1]), S.placeNorm(r[2])]; (r[3] ? r[3].split('|') : []).forEach((x) => keys.push(S.placeNorm(x))); return keys.filter((k) => k); });
  const find = (q) => S.placeSearch({ raw, idx }, q, 5).map((r) => r[1]);
  t('English search finds Jakarta first', find('jakarta')[0], 'Jakarta');
  t('English search is case and accent blind', find('JAKARTA')[0], 'Jakarta');
  const ar = raw.p.find((r) => r[1] === 'Jakarta')[2];
  ok('the list holds an Arabic name for Jakarta', !!ar);
  t('Arabic search finds the same city', find(ar)[0], 'Jakarta');
  t('Arabic search ignores vowel marks and tatweel', find(ar.split('').join(String.fromCharCode(0x064E))).indexOf('Jakarta') >= 0, true);
  t('a one-letter query returns nothing', find('j'), []);
  t('the list is the downloaded one', [raw.v, raw.license.indexOf('Attribution 4.0') >= 0, raw.source, raw.p.length > 30000], [1, true, 'https://download.geonames.org/export/dump/cities15000.zip', true]);
  const bad = raw.p.filter((r) => !raw.tz[r[7]] || !(r[5] >= -90 && r[5] <= 90) || !(r[6] >= -180 && r[6] <= 180));
  t('every row has a zone and in-range coordinates', bad.length, 0);
  const A2 = lifted(['prayerZoneFmt', 'prayerZoneOffset', 'prayerZoneWall'], ['PRAYER_ZONE_FMT'], {});
  const unknownZones = raw.tz.filter((z) => A2.prayerZoneOffset(z, 2026, 10, 4) === null);
  t('every zone in the list is known to the engine', unknownZones, []);
}

// ---------------------------------------------------------------------------------------------- F: another day (124-2)
function sectionDay() {
  say('F2  the times of another day');
  const A = lifted(['prayerShiftDay', 'prayerDayIso', 'prayerDayFromIso'], ['PRAYER_DAY_MIN_YEAR', 'PRAYER_DAY_MAX_YEAR'], {});
  t('a step crosses a month end', A.prayerShiftDay({ y: 2026, m: 10, d: 31 }, 1), { y: 2026, m: 11, d: 1 });
  t('a step crosses a year end backwards', A.prayerShiftDay({ y: 2026, m: 1, d: 1 }, -1), { y: 2025, m: 12, d: 31 });
  t('a step knows the leap day', A.prayerShiftDay({ y: 2028, m: 2, d: 28 }, 1), { y: 2028, m: 2, d: 29 });
  t('the ISO form is zero padded', A.prayerDayIso({ y: 2026, m: 3, d: 5 }), '2026-03-05');
  t('an ISO day reads back', A.prayerDayFromIso('2027-03-01'), { y: 2027, m: 3, d: 1 });
  t('a day that does not exist is refused', A.prayerDayFromIso('2026-02-30'), null);
  t('a year before the range is refused', A.prayerDayFromIso('1899-12-31'), null);
  t('a year after the range is refused', A.prayerDayFromIso('2201-01-01'), null);
  t('an empty value is refused', A.prayerDayFromIso(''), null);
  t('a non-string is refused', A.prayerDayFromIso(null), null);
}

// ---------------------------------------------------------------------------------------------- F: the converter (124-5)
function sectionConv() {
  say('F3  the Hijri/Gregorian converter');
  const A = lifted(['hijriToCivil', 'hijriFromJdn', 'hijriUmalquraFromJdn', 'hijriTabularFromJdn', 'hijriJdnFromCivil',
    'hijriCivilFromJdn', 'hijriForCivilDay'],
  ['HIJRI_CONV_MIN_YEAR', 'HIJRI_CONV_MAX_YEAR', 'HIJRI_CALENDAR', 'HIJRI_FALLBACK_CALENDAR', 'HIJRI_OFFSET_MIN', 'HIJRI_OFFSET_MAX'], {});
  // Every civil day of two years, at every offset: forward then back lands on the same day.
  let bad = 0, total = 0, firstBad = null;
  for (let off = -2; off <= 2; off++) {
    for (let i = 0; i < 730; i++) {
      const dt = new Date(Date.UTC(2026, 0, 1 + i));
      const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
      const h = A.hijriForCivilDay(y, m, d, off);
      const back = A.hijriToCivil(h.y, h.m, h.d, off);
      total++;
      if (!back || back.y !== y || back.m !== m || back.d !== d) { bad++; if (!firstBad) firstBad = [y, m, d, off, h, back]; }
    }
  }
  t('every civil day round-trips through the Hijri date and back (' + total + ' cases)', bad, 0);
  if (bad) say('  first miss ' + JSON.stringify(firstBad));
  // A day that does not exist: find a 29-day month and ask for its 30th.
  let found = null;
  for (let m = 1; m <= 12 && !found; m++) if (!A.hijriToCivil(1448, m, 30, 0)) found = m;
  ok('some month of 1448 has no 30th day, and asking for it answers null', found !== null);
  t('a year below the range is refused', A.hijriToCivil(1299, 1, 1, 0), null);
  t('a year above the range is refused', A.hijriToCivil(1601, 1, 1, 0), null);
  t('a month outside 1..12 is refused', A.hijriToCivil(1448, 13, 1, 0), null);
  t('a day of 0 is refused', A.hijriToCivil(1448, 1, 0, 0), null);
  t('a fraction is refused', A.hijriToCivil(1448.5, 1, 1, 0), null);
  t('junk is refused', A.hijriToCivil('x', 1, 1, 0), null);
  const one = A.hijriToCivil(1448, 1, 1, 0), plus = A.hijriToCivil(1448, 1, 1, 1);
  const dayNo = (c) => Date.UTC(c.y, c.m - 1, c.d) / 86400000;
  t('the reader\'s offset of +1 moves the civil day back by one', dayNo(one) - dayNo(plus), 1);
}

// ---------------------------------------------------------------------------------------------- F: the screen (124-7)
function sectionScreen() {
  say('F4  where the reader is in the day: current, next, countdown, clock');
  const names = ['prayerStatus', 'prayerTodayParts', 'prayerTzOn', 'prayerInstant', 'prayerTimesFor', 'prayerMethodTable',
    'prayerMethodIds', 'prayerMethodOf', 'prayerSunPosition', 'prayerSunAngleTime', 'prayerAsrAngle', 'hijriJdnFromCivil',
    'prayerZoneFmt', 'prayerZoneWall', 'prayerZoneOffset', 'prayerCountdownText', 'prayerClockL', 'prayerClock'];
  const consts = ['PRAYER_METHOD_DEFAULT', 'PRAYER_ASR_DEFAULT', 'PRAYER_OFFSET_MIN', 'PRAYER_OFFSET_MAX', 'PRAYER_KEYS',
    'PRAYER_OFFSETTABLE', 'PRAYER_HORIZON', 'PRAYER_ROUND_UP', 'PRAYER_ZONE_FMT', 'ADHAN_KEYS', 'toArabicDigits'];
  const A = lifted(names, consts, { EZ_LANG: 'ar', ezikBrowseNum: (v) => String(v) });
  const place = { tz: 'Asia/Kuwait' };
  const loc = { lat: 29.3759, lng: 47.9774, by: 'place', place };
  const prefs = { method: 'kuwait', asr: 'standard', off: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } };
  const day = (y, m, d) => A.prayerTimesFor(y, m, d, loc.lat, loc.lng, 180, 'kuwait', 'standard', null);
  const at = (y, m, d, mins) => Date.UTC(y, m - 1, d) + (mins - 180) * 60000;
  const T = day(2026, 10, 4), T2 = day(2026, 10, 5);
  let s = A.prayerStatus(new Date(at(2026, 10, 4, T.fajr) + 60000), loc, prefs);
  t('just after fajr: fajr is current, dhuhr is next', [s.current, s.next.key, s.remainingMs], ['fajr', 'dhuhr', at(2026, 10, 4, T.dhuhr) - (at(2026, 10, 4, T.fajr) + 60000)]);
  s = A.prayerStatus(new Date(at(2026, 10, 4, T.isha) + 600000), loc, prefs);
  t('after isha: isha is current and the next is tomorrow\'s fajr', [s.current, s.next.key, s.remainingMs], ['isha', 'fajr', at(2026, 10, 5, T2.fajr) - (at(2026, 10, 4, T.isha) + 600000)]);
  s = A.prayerStatus(new Date(at(2026, 10, 4, T.fajr) - 600000), loc, prefs);
  t('before fajr: yesterday\'s isha is still current, fajr is ten minutes away', [s.current, s.next.key, s.remainingMs], ['isha', 'fajr', 600000]);
  s = A.prayerStatus(new Date(at(2026, 10, 4, T.dhuhr)), loc, prefs);
  t('at the very minute of a prayer it is the current one', [s.current, s.next.key], ['dhuhr', 'asr']);
  t('the sunrise is never a prayer: between sunrise and dhuhr fajr is still current', A.prayerStatus(new Date(at(2026, 10, 4, T.sunrise) + 60000), loc, prefs).current, 'fajr');
  const withOff = A.prayerStatus(new Date(at(2026, 10, 4, T.dhuhr) + 60000), loc, Object.assign({}, prefs, { off: { fajr: 0, dhuhr: 5, asr: 0, maghrib: 0, isha: 0 } }));
  t('the reader\'s offset moves the prayer: with +5 dhuhr has not come yet', withOff.current, 'fajr');
  t('a countdown reads hh:mm:ss', A.prayerCountdownText(3725000), '01:02:05');
  t('a countdown never goes below zero', A.prayerCountdownText(-5), '00:00:00');
  t('a countdown of junk is zero', A.prayerCountdownText('x'), '00:00:00');
  const E = lifted(['prayerClockL', 'prayerClock'], ['toArabicDigits'], { EZ_LANG: 'en' });
  t('English clock: midnight', E.prayerClockL(0), '12:00 AM');
  t('English clock: noon and five', E.prayerClockL(725), '12:05 PM');
  t('English clock: afternoon', E.prayerClockL(805), '1:25 PM');
  t('English clock: a missing time is a dash', E.prayerClockL(null), String.fromCharCode(0x2014));
  t('Arabic clock is the old one', A.prayerClockL(805), A.prayerClock(805));
}

// ---------------------------------------------------------------------------------------------- S: mounted scenes
function boot(opts) {
  const { parseHTML } = require(path.join(REPO, 'node_modules', 'linkedom'));
  const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
  window.self = window; window.window = window; window.globalThis = window;
  window.matchMedia = (q) => ({ matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
  window.location = { href: '/', pathname: '/', search: '', hash: '' };
  const EP = window.HTMLElement.prototype;
  EP.scrollIntoView = function () {}; EP.focus = function () {};
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
  const requests = [];
  const seed = {};
  seed.child_profile = JSON.stringify({ name: 'Noor', age: 30, gender: 'male', birthYear: 1996, pid: 'PF-GUARD', createdAt: '2026-01-01T00:00:00.000Z' });
  seed.ezik_ai_consent_v1 = JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: 'PF-GUARD', grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });
  Object.assign(seed, opts.seed || {});
  window.localStorage = memStore(seed);
  window.sessionStorage = memStore({});
  window.postMessage = () => {};
  const posts = [];
  if (opts.shell) window.ReactNativeWebView = { postMessage: (wire) => posts.push(String(wire)) };
  const FIX = new Set(['/places.json', '/adhkar.json', '/adhkar-split-27.json', '/arbaeen.json', '/arbaeen-footnotes.json']);
  window.fetch = (url) => {
    const key = String(url); requests.push(key);
    if (!FIX.has(key) || (key === '/places.json' && opts.placesOffline)) return Promise.reject(new TypeError('offline fixture boundary'));
    const value = fs.readFileSync(path.join(REPO, key.slice(1)), 'utf8');
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(value)), text: () => Promise.resolve(value) });
  };
  const entries = [{}]; let at = 0;
  window.history = { get length() { return entries.length; }, get state() { return entries[at]; },
    pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
    replaceState: (st) => { entries[at] = st; },
    back: () => { if (at > 0) { at--; NODE_TICK(() => window.dispatchEvent(new window.Event('popstate')), 0); } } };
  global.window = window; global.document = window.document;
  Object.defineProperty(global, 'navigator', { configurable: true, value: window.navigator });
  const ctx = vm.createContext(window);
  for (const f of ['react.umd.js', 'react-dom.umd.js']) vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  let caught = null;
  window.addEventListener('error', (ev) => { caught = caught || (ev.error || ev.message); });
  window.console = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug', 'trace', 'count', 'assert', 'dir', 'table', 'group', 'groupEnd'].map((l) => [l, () => {}]));
  vm.runInContext(fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'), ctx, { filename: 'app.js' });
  const root = window.document.getElementById('root');
  const read = (expr) => vm.runInContext('(' + expr + ')', ctx);
  const props = (el) => el && el[Object.keys(el).find((k) => k.startsWith('__reactProps$'))];
  const open = (route) => vm.runInContext('window.dispatchEvent(new CustomEvent("ezik-scheduler",{detail:{channel:"ezik-scheduler",v:1,op:"open",route:' + JSON.stringify(route) + ',type:null,id:null}}))', ctx);
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));
  const waitFor = async (fn, cap = 6000) => { const end = Date.now() + cap; let v = fn(); while (!v && Date.now() < end) { await tick(30); v = fn(); } await tick(60); return fn(); };
  const click = async (el) => { if (!el) throw new Error('missing control'); const p = props(el); if (p && p.onClick) p.onClick({ preventDefault() {}, stopPropagation() {}, currentTarget: el, target: el }); await tick(80); };
  const type = async (el, value) => { const p = props(el); p.onChange({ target: { value }, currentTarget: { value } }); await tick(80); };
  const store = window.localStorage;
  return { window, root, read, open, q, qa, waitFor, click, type, requests, posts, store, props, caught: () => caught, ctx };
}
async function openPrayer(c) {
  await c.waitFor(() => c.q('.ezc-rail') || c.q('[data-ezik-home-module]'));
  c.open('prayer');
  await c.waitFor(() => c.q('[data-ezik-place="toggle"]'));
}
const SCENES = {};
SCENES.place = async () => {
  say('S1  searching for a place, choosing it, and getting it back out');
  const jakAr = JSON.parse(fs.readFileSync(path.join(REPO, 'places.json'), 'utf8')).p.find((r) => r[1] === 'Jakarta')[2];
  const c = boot({});
  await openPrayer(c);
  t('no request for the places list before the search is opened', c.requests.filter((r) => r === '/places.json').length, 0);
  t('no place is chosen at first', c.q('[data-ezik-place="current"]'), null);
  await c.click(c.q('[data-ezik-place="toggle"]'));
  await c.waitFor(() => c.q('[data-ezik-place="input"]'));
  t('opening the search loads the list once', c.requests.filter((r) => r === '/places.json').length, 1);
  await c.type(c.q('[data-ezik-place="input"]'), 'jakarta');
  await c.waitFor(() => c.qa('[data-ezik-place="result"]').length > 0);
  const results = c.qa('[data-ezik-place="result"]');
  ok('an English search lists results', results.length > 0);
  ok('the first result names Jakarta', results[0].textContent.indexOf(jakAr) >= 0 || /Jakarta/.test(results[0].textContent), results[0].textContent);
  await c.click(results[0]);
  await c.waitFor(() => c.q('[data-ezik-place="current"]'));
  const cur = c.q('[data-ezik-place="current"]');
  ok('the chosen place is shown', !!cur && (cur.textContent.indexOf(jakAr) >= 0 || /Jakarta/.test(cur.textContent)), cur && cur.textContent);
  t('the chosen place is stored under its own key', JSON.parse(c.store.getItem('ezik_prayer_place_v1')).tz, 'Asia/Jakarta');
  const pos = JSON.parse(c.store.getItem('ezik_qibla_loc_v1'));
  ok('the position store holds the place\'s coordinates', Math.abs(pos.lat - -6.2) < 0.5 && Math.abs(pos.lng - 106.8) < 0.5, JSON.stringify(pos));
  ok('the sheet states the time zone', c.root.textContent.indexOf('Asia/Jakarta') >= 0);
  // Arabic search, from a clean sheet.
  await c.click(c.q('[data-ezik-place="toggle"]'));
  await c.waitFor(() => c.q('[data-ezik-place="input"]'));
  const arName = JSON.parse(fs.readFileSync(path.join(REPO, 'places.json'), 'utf8')).p.find((r) => r[1] === 'Cairo')[2];
  await c.type(c.q('[data-ezik-place="input"]'), arName);
  await c.waitFor(() => c.qa('[data-ezik-place="result"]').length > 0);
  ok('an Arabic search lists Cairo', c.qa('[data-ezik-place="result"]')[0].textContent.indexOf(arName) >= 0 || /Cairo/.test(c.qa('[data-ezik-place="result"]')[0].textContent));
  // The automatic-location button exists once a place is chosen, and a device fix replaces the place.
  const auto = c.q('[data-ezik-place="auto"]');
  ok('the automatic-location button is offered beside a chosen place', !!auto);
  t('the page made no request other than the places list, the corpora and the home feeds', c.requests.filter((r) => !/^\/(places|adhkar|adhkar-split-27|arbaeen|arbaeen-footnotes)\.json$/.test(r) && !/^\/api\/articles-list\?/.test(r)), []);
  t('nothing threw', c.caught(), null);
};
SCENES.day = async () => {
  say('S3  stepping to another day, picking a date, coming back');
  const c = boot({});
  await openPrayer(c);
  const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const shown = () => KEYS.map((k) => c.q('[data-ezik-prayer="' + k + '"]').querySelectorAll('span')[1].textContent);
  const expect = (y, m, d) => KEYS.map((k) => c.read('prayerClockL(prayerTimesFor(' + [y, m, d].join(',') + ', QIBLA_DEFAULT_LAT, QIBLA_DEFAULT_LNG, prayerTzOn(' + [y, m, d].join(',') + ', null), "kuwait", "standard", null)["' + k + '"])'));
  const today = c.read('prayerTodayParts(new Date(), null)');
  t('the sheet opens on today\'s times', shown(), expect(today.y, today.m, today.d));
  t('there is no "back to today" button on today', c.q('[data-ezik-day="today"]'), null);
  const headToday = c.q('[data-ezik-day="head"]').textContent;
  await c.click(c.q('[data-ezik-day="next"]'));
  const tom = c.read('prayerShiftDay(prayerTodayParts(new Date(), null), 1)');
  t('"next day" shows tomorrow\'s times', shown(), expect(tom.y, tom.m, tom.d));
  ok('the date line changes', c.q('[data-ezik-day="head"]').textContent !== headToday);
  ok('"back to today" appears', !!c.q('[data-ezik-day="today"]'));
  await c.click(c.q('[data-ezik-day="prev"]'));
  await c.click(c.q('[data-ezik-day="prev"]'));
  const yest = c.read('prayerShiftDay(prayerTodayParts(new Date(), null), -1)');
  t('"previous day" twice from tomorrow shows yesterday', shown(), expect(yest.y, yest.m, yest.d));
  await c.type(c.q('[data-ezik-day="pick"]'), '2027-03-01');
  t('picking a date shows that day', shown(), expect(2027, 3, 1));
  t('the picker holds the picked date', c.props(c.q('[data-ezik-day="pick"]')).value, '2027-03-01');
  await c.type(c.q('[data-ezik-day="pick"]'), '2026-02-30');
  t('an impossible date changes nothing', shown(), expect(2027, 3, 1));
  await c.click(c.q('[data-ezik-day="today"]'));
  t('"back to today" restores today', shown(), expect(today.y, today.m, today.d));
  t('...and the button is gone again', c.q('[data-ezik-day="today"]'), null);
  await c.type(c.q('[data-ezik-day="pick"]'), c.read('prayerDayIso(prayerTodayParts(new Date(), null))'));
  t('picking today\'s own date is the same as being on today', c.q('[data-ezik-day="today"]'), null);
  t('nothing threw', c.caught(), null);
};
const prefsWith = (extra) => JSON.stringify(Object.assign({ method: 'kuwait', asr: 'standard', off: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, adhanSound: true }, extra));
const blank5 = () => ({ fajr: { on: false, min: 0 }, dhuhr: { on: false, min: 0 }, asr: { on: false, min: 0 }, maghrib: { on: false, min: 0 }, isha: { on: false, min: 0 } });
SCENES.iqama = async () => {
  say('S4  the iqama reminder: the reader\'s minutes, per prayer, through the shell\'s own pipe');
  // --- one prayer on
  const one = blank5(); one.dhuhr = { on: true, min: 10 };
  let c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on', ezik_prayer_prefs_v1: prefsWith({ iq: one }) } });
  await openPrayer(c);
  const items = c.read('ezikSchedItems()');
  const iq = items.filter((x) => x.id.indexOf('adhan:iqama:dhuhr:') === 0);
  t('seven iqama items for the one prayer that is on', iq.length, 7);
  t('...and none for the others', items.filter((x) => /^adhan:iqama:(fajr|asr|maghrib|isha):/.test(x.id)).length, 0);
  t('an iqama rides the shell\'s adhan type with the device tone', [iq[0].type, iq[0].adhanSound], ['adhan', 'none']);
  const day = iq[0].id.split(':')[3];
  const adhan = items.find((x) => x.id === 'adhan:dhuhr:' + day);
  t('the iqama is exactly the reader\'s minutes after the adhan', iq[0].at - adhan.at, 10 * 60000);
  t('with one prayer on the window stays seven days', c.read('ezikSchedWindow(ezikSchedTiers(new Date()), new Date()).days'), 7);
  // --- the control
  ok('the control is drawn in the shell', c.qa('[data-ezik-alert-row^="iq:"]').length === 5);
  // --- every prayer on: the window narrows, to the longest that fits
  const all = blank5(); for (const k of Object.keys(all)) all[k] = { on: true, min: 5 };
  c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on', ezik_prayer_prefs_v1: prefsWith({ iq: all }) } });
  await openPrayer(c);
  const days = c.read('ezikSchedWindow(ezikSchedTiers(new Date()), new Date()).days');
  ok('five iqama a day narrow the window below seven days', days < 7 && days >= 1, 'days ' + days);
  const sched = c.read('ezikSchedItems()');
  ok('the schedule fits the ceiling', sched.length <= 60, 'n ' + sched.length);
  const cutAt = (n) => c.read('(function(){const nw=new Date();const p=prayerTodayParts(nw,null);return prayerInstant(p.y,p.m,p.d+' + n + ',0,null,0);})()');
  ok('nothing lies beyond the chosen window', sched.every((x) => x.at < cutAt(days)));
  const allTiers = c.read('ezikSchedTiers(new Date())').flat();
  ok('one more day would not have fitted', allTiers.filter((x) => x.at < cutAt(days + 1)).length > 60);
  ok('the sheet tells the reader about the narrowing', !!c.q('[data-ezik-alert="window"]'));
  // --- both off again: seven days, nothing narrowed
  c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on' } });
  await openPrayer(c);
  t('with nothing on the window is seven days', c.read('ezikSchedWindow(ezikSchedTiers(new Date()), new Date()).days'), 7);
  t('...and no iqama item exists', c.read('ezikSchedItems()').filter((x) => x.id.indexOf('iqama') >= 0).length, 0);
  t('...and the narrowing sentence is absent', c.q('[data-ezik-alert="window"]'), null);
  // --- the switch needs minutes; typing minutes; turning on; the pipe carries it
  const min = () => c.q('[data-ezik-alert="iq:asr:min"]');
  const sw = () => c.q('[data-ezik-alert="iq:asr:on"]');
  await c.click(sw());
  t('a switch cannot be turned on while its minutes are empty', JSON.parse(c.store.getItem('ezik_prayer_prefs_v1') || '{}').iq, undefined);
  await c.type(min(), '15');
  t('minutes are stored', JSON.parse(c.store.getItem('ezik_prayer_prefs_v1')).iq.asr, { on: false, min: 15 });
  await c.click(sw());
  t('the switch turns on', JSON.parse(c.store.getItem('ezik_prayer_prefs_v1')).iq.asr, { on: true, min: 15 });
  ok('the shell was handed the iqama items', c.posts.some((w) => { try { return JSON.parse(w).items.some((x) => x.id.indexOf('adhan:iqama:asr:') === 0); } catch (e) { return false; } }));
  await c.type(min(), '500');
  t('minutes are bounded at the ceiling', JSON.parse(c.store.getItem('ezik_prayer_prefs_v1')).iq.asr.min, 120);
  await c.type(min(), '0');
  t('emptying the minutes turns the switch off', JSON.parse(c.store.getItem('ezik_prayer_prefs_v1')).iq.asr, { on: false, min: 0 });
  // --- notify off: nothing rings
  c = boot({ shell: true, seed: { ezik_prayer_prefs_v1: prefsWith({ iq: one }) } });
  await openPrayer(c);
  t('with the prayer reminders off no iqama is scheduled', c.read('ezikSchedItems()').filter((x) => x.id.indexOf('iqama') >= 0).length, 0);
  t('nothing threw', c.caught(), null);
};
SCENES.pre = async () => {
  say('S6  the alert before each prayer: minutes the reader sets, before the time');
  const asr = blank5(); asr.asr = { on: true, min: 15 };
  let c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on', ezik_prayer_prefs_v1: prefsWith({ pre: asr }) } });
  await openPrayer(c);
  const items = c.read('ezikSchedItems()');
  const pre = items.filter((x) => x.id.indexOf('adhan:pre:asr:') === 0);
  t('seven alerts for the one prayer that is on', pre.length, 7);
  t('...and none for the others', items.filter((x) => /^adhan:pre:(fajr|dhuhr|maghrib|isha):/.test(x.id)).length, 0);
  t('an alert rides the shell\'s adhan type with the device tone', [pre[0].type, pre[0].adhanSound], ['adhan', 'none']);
  const day = pre[0].id.split(':')[3];
  const adhan = items.find((x) => x.id === 'adhan:asr:' + day);
  t('the alert is exactly the reader\'s minutes BEFORE the time', adhan.at - pre[0].at, 15 * 60000);
  ok('the body names the minutes', pre[0].body.indexOf(c.read('ezikBrowseNum(15)')) >= 0, pre[0].body);
  ok('the control for it is drawn', c.qa('[data-ezik-alert-row^="pre:"]').length === 5);
  // an alert that crosses midnight rolls to the day before, in the right order
  const fajr = blank5(); fajr.fajr = { on: true, min: 120 };
  c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on', ezik_prayer_prefs_v1: prefsWith({ pre: fajr }) } });
  await openPrayer(c);
  const it2 = c.read('ezikSchedItems()');
  const f = it2.find((x) => x.id.indexOf('adhan:pre:fajr:') === 0);
  const fa = it2.find((x) => x.id === 'adhan:fajr:' + f.id.split(':')[3]);
  t('two hours before fajr is two hours before fajr', fa.at - f.at, 120 * 60000);
  // iqama and alert together: one window, under the ceiling, nothing cut in silence
  const all = blank5(); for (const k of Object.keys(all)) all[k] = { on: true, min: 5 };
  c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on', ezik_prayer_prefs_v1: prefsWith({ iq: all, pre: all }) } });
  await openPrayer(c);
  const days = c.read('ezikSchedWindow(ezikSchedTiers(new Date()), new Date()).days');
  const both = c.read('ezikSchedItems()');
  ok('both feeds on: the window is narrower still', days >= 1 && days < 7, 'days ' + days);
  ok('...and everything fits the ceiling', both.length <= 60, 'n ' + both.length);
  t('...and the clip counter records no silent cut', c.read('ezikSchedClipRead().cut'), 0);
  ok('...both kinds are present', both.some((x) => x.id.indexOf(':iqama:') >= 0) && both.some((x) => x.id.indexOf(':pre:') >= 0));
  // the control, typed through
  c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on' } });
  await openPrayer(c);
  await c.type(c.q('[data-ezik-alert="pre:maghrib:min"]'), '10');
  await c.click(c.q('[data-ezik-alert="pre:maghrib:on"]'));
  t('the switch and minutes are stored in the prayer preferences', JSON.parse(c.store.getItem('ezik_prayer_prefs_v1')).pre.maghrib, { on: true, min: 10 });
  ok('the shell was handed the alerts', c.posts.some((w) => { try { return JSON.parse(w).items.some((x) => x.id.indexOf('adhan:pre:maghrib:') === 0); } catch (e) { return false; } }));
  t('nothing threw', c.caught(), null);
};
SCENES.conv = async () => {
  say('S7  the converter on the sheet: both directions, an impossible date, and "show the times of that day"');
  const c = boot({});
  await openPrayer(c);
  await c.type(c.q('[data-ezik-conv="greg"]'), '2026-10-04');
  const wantH = c.read('hijriLabel(hijriForCivilDay(2026, 10, 4, readHijriOffset()))');
  t('a Gregorian date reads as its Hijri date', c.q('[data-ezik-conv="hijri-out"]').textContent, wantH);
  await c.type(c.q('[data-ezik-conv="greg"]'), '2026-02-30');
  t('an impossible Gregorian date says so', c.q('[data-ezik-conv="hijri-out"]').textContent, c.read("ezT('conv.invalidGreg')"));
  const h = c.read('hijriForCivilDay(2026, 10, 4, 0)');
  await c.type(c.q('[data-ezik-conv="hy"]'), String(h.y));
  await c.type(c.q('[data-ezik-conv="hm"]'), String(h.m));
  await c.type(c.q('[data-ezik-conv="hd"]'), String(h.d));
  t('a Hijri date reads as its Gregorian date', c.q('[data-ezik-conv="greg-out"]').textContent, c.read('prayerDayLabel({y:2026,m:10,d:4})'));
  await c.click(c.q('[data-ezik-conv="show-hijri"]'));
  t('"show the times" sends the sheet to that day', c.q('[data-ezik-day="head"]').textContent, c.read('prayerDayLabel({y:2026,m:10,d:4})'));
  const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const shown = KEYS.map((k) => c.q('[data-ezik-prayer="' + k + '"]').querySelectorAll('span')[1].textContent);
  const expect = KEYS.map((k) => c.read('prayerClockL(prayerTimesFor(2026,10,4, QIBLA_DEFAULT_LAT, QIBLA_DEFAULT_LNG, prayerTzOn(2026,10,4,null), "kuwait", "standard", null)["' + k + '"])'));
  t('...and the times on show are that day\'s', shown, expect);
  await c.type(c.q('[data-ezik-conv="hd"]'), '31');
  t('a day of 31 says the date does not exist', c.q('[data-ezik-conv="greg-out"]').textContent, c.read("ezT('conv.invalidHijri')"));
  t('...and offers no "show" button', c.q('[data-ezik-conv="show-hijri"]'), null);
  ok('the card warns the date can differ by a day or two', c.root.textContent.indexOf(c.read("ezT('conv.hint')")) >= 0);
  t('nothing threw', c.caught(), null);
};
const JAK = { n: 'Jakarta', a: 'x', cc: 'ID', tz: 'Asia/Jakarta', lat: -6.2146, lng: 106.8451 };
SCENES['backup-make'] = async () => {
  say('S8  making a copy of the prayer settings');
  const iq = blank5(); iq.dhuhr = { on: true, min: 10 };
  const c = boot({ shell: true, seed: {
    ezik_prayer_prefs_v1: prefsWith({ method: 'mwl', asr: 'hanafi', off: { fajr: 3, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, iq }),
    ezik_qibla_loc_v1: JSON.stringify({ lat: JAK.lat, lng: JAK.lng }), ezik_prayer_place_v1: JSON.stringify(JAK),
    ezik_hijri_offset_v1: '1', ezik_prayer_notify_v1: 'on',
    ezik_prayer_schedule_v1: '{"v":1}', ezik_wird_alerts_v1: JSON.stringify({ sabah: { on: false, offset: 15 } }) } });
  await openPrayer(c);
  await c.click(c.q('[data-ezik-backup="make"]'));
  const text = c.props(c.q('[data-ezik-backup="out"]')).value;
  const doc = JSON.parse(text);
  t('the copy carries its tag and version', [doc.ezik, doc.v], ['prayer-settings', 1]);
  t('the copy lists exactly the prayer parts', Object.keys(doc.keys).sort(), ['hijri', 'loc', 'place', 'prefs', 'wirdAlerts']);
  t('the prefs are carried whole', [doc.keys.prefs.method, doc.keys.prefs.asr, doc.keys.prefs.off.fajr, doc.keys.prefs.iq.dhuhr], ['mwl', 'hanafi', 3, { on: true, min: 10 }]);
  t('the position, the place and the Hijri offset are carried', [doc.keys.loc, doc.keys.place.tz, doc.keys.hijri], [{ lat: JAK.lat, lng: JAK.lng }, 'Asia/Jakarta', 1]);
  t('the prayer-anchored alert choices are carried', [doc.keys.wirdAlerts.sabah, doc.keys.wirdAlerts.masaa], [{ on: false, offset: 15 }, { on: true, offset: 0 }]);
  ok('the permission-gated switch and the derived table are NOT in the copy', text.indexOf('notify') === -1 && text.indexOf('schedule') === -1 && text.indexOf('ezik_') === -1);
  t('the copy passes its own check', c.read('prayerBackupCheck(' + JSON.stringify(text) + ').ok'), true);
  t('nothing threw', c.caught(), null);
};
SCENES['backup-bad'] = async () => {
  say('S9  a text that is not a whole, valid copy changes nothing');
  const c = boot({ shell: true, seed: { ezik_prayer_prefs_v1: prefsWith({ method: 'egypt' }) } });
  await openPrayer(c);
  const wrap = (keys) => JSON.stringify({ ezik: 'prayer-settings', v: 1, keys });
  const cases = {
    'not json': 'hello',
    'wrong tag': JSON.stringify({ ezik: 'other', v: 1, keys: {} }),
    'wrong version': JSON.stringify({ ezik: 'prayer-settings', v: 2, keys: {} }),
    'unknown part': wrap({ language: 'ar' }),
    'the reminders part is not accepted': wrap({ reminders: {} }),
    'unknown method': wrap({ prefs: { method: 'xyz' } }),
    'offset out of range': wrap({ prefs: { off: { fajr: 99 } } }),
    'offset for the sunrise': wrap({ prefs: { off: { sunrise: 1 } } }),
    'extra prefs field': wrap({ prefs: { method: 'mwl', evil: 1 } }),
    'iqama on without minutes': wrap({ prefs: { iq: { fajr: { on: true, min: 0 } } } }),
    'iqama minutes too many': wrap({ prefs: { iq: { fajr: { on: false, min: 121 } } } }),
    'position out of range': wrap({ loc: { lat: 91, lng: 0 } }),
    'place without a position': wrap({ place: { n: 'X', tz: 'Asia/Jakarta', lat: 1, lng: 2 } }),
    'place off its position': wrap({ loc: { lat: 1, lng: 2 }, place: { n: 'X', tz: 'Asia/Jakarta', lat: 3, lng: 4 } }),
    'place with an unknown zone': wrap({ loc: { lat: 1, lng: 2 }, place: { n: 'X', tz: 'Not/AZone', lat: 1, lng: 2 } }),
    'hijri offset out of range': wrap({ hijri: 5 }),
    'unknown alert id': wrap({ wirdAlerts: { evil: { on: true, offset: 0 } } }),
    'alert offset out of range': wrap({ wirdAlerts: { sabah: { on: true, offset: 999 } } }),
  };
  const before = JSON.stringify(c.store.dump());
  for (const name of Object.keys(cases)) {
    const r = c.read('prayerBackupCheck(' + JSON.stringify(cases[name]) + ')');
    t('refused: ' + name, r.ok, false);
  }
  t('the empty-keys copy is valid (restores nothing)', c.read('prayerBackupCheck(' + JSON.stringify(wrap({})) + ').ok'), true);
  // through the control: a bad text says so and the store is untouched
  await c.type(c.q('[data-ezik-backup="in"]'), cases['unknown method']);
  await c.click(c.q('[data-ezik-backup="restore"]'));
  ok('the bad-text sentence is shown', !!c.q('[data-ezik-backup="bad"]'));
  t('...and not one key changed', JSON.stringify(c.store.dump()), before);
  t('nothing threw', c.caught(), null);
};
SCENES['backup-restore'] = async () => {
  say('S10  restoring a copy: the writers, the refreshed sheet, and the schedule re-armed');
  const iq = blank5(); iq.asr = { on: true, min: 7 };
  const copy = JSON.stringify({ ezik: 'prayer-settings', v: 1, keys: {
    prefs: { method: 'mwl', asr: 'hanafi', off: { fajr: 2, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, adhanSound: false, iq, pre: blank5() },
    loc: { lat: JAK.lat, lng: JAK.lng }, place: JAK, hijri: -1,
    wirdAlerts: { sabah: { on: false, offset: 20 } } } });
  const c = boot({ shell: true, seed: { ezik_prayer_notify_v1: 'on' } });
  await openPrayer(c);
  t('before: no place is shown', c.q('[data-ezik-place="current"]'), null);
  await c.type(c.q('[data-ezik-backup="in"]'), copy);
  await c.click(c.q('[data-ezik-backup="restore"]'));
  ok('the success sentence is shown', !!c.q('[data-ezik-backup="ok"]'));
  const prefs = JSON.parse(c.store.getItem('ezik_prayer_prefs_v1'));
  t('the prefs landed', [prefs.method, prefs.asr, prefs.off.fajr, prefs.adhanSound, prefs.iq.asr], ['mwl', 'hanafi', 2, false, { on: true, min: 7 }]);
  t('the position and the place landed', [JSON.parse(c.store.getItem('ezik_qibla_loc_v1')), JSON.parse(c.store.getItem('ezik_prayer_place_v1')).tz], [{ lat: JAK.lat, lng: JAK.lng }, 'Asia/Jakarta']);
  t('the Hijri offset landed', c.store.getItem('ezik_hijri_offset_v1'), '-1');
  t('the alert choice landed', JSON.parse(c.store.getItem('ezik_wird_alerts_v1')).sabah, { on: false, offset: 20 });
  t('the permission-gated switch was left as it was', c.store.getItem('ezik_prayer_notify_v1'), 'on');
  await c.waitFor(() => c.q('[data-ezik-place="current"]'));
  ok('the sheet shows the restored place without a reload', !!c.q('[data-ezik-place="current"]'));
  t('the iqama control shows the restored minutes', c.props(c.q('[data-ezik-alert="iq:asr:min"]')).value, 7);
  ok('the shell was handed a schedule that carries the iqama', c.posts.some((w) => { try { return JSON.parse(w).items.some((x) => x.id.indexOf('adhan:iqama:asr:') === 0); } catch (e) { return false; } }));
  t('nothing threw', c.caught(), null);
};
const countdownSecs = (txt) => {
  const latin = String(txt).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = /^(\d\d):(\d\d):(\d\d)$/.exec(latin);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};
SCENES.next = async () => {
  say('S11 the screen in Arabic: city, next prayer, a live countdown, the current prayer marked');
  const c = boot({});
  await openPrayer(c);
  const st = c.read('prayerStatus(new Date(), readQiblaLoc(), readPrayerPrefs())');
  t('the city line names the default city', c.q('[data-ezik-city="name"]').textContent.indexOf(c.read("ezT('place.default')")) >= 0, true);
  t('the next prayer is named', c.q('[data-ezik-next="name"]').textContent, c.read("ezT('widget.prayer.' + '" + st.next.key + "')"));
  const first = countdownSecs(c.q('[data-ezik-next="count"]').textContent);
  ok('the countdown is hh:mm:ss in Arabic-Indic digits', first !== null && /[\u0660-\u0669]/.test(c.q('[data-ezik-next="count"]').textContent));
  const marked = c.qa('[data-ezik-current="1"]');
  t('exactly the current prayer is marked', marked.map((e) => e.getAttribute('data-ezik-prayer')), st.current ? [st.current] : []);
  ok('...and it says so in words and for assistive tech', marked.length === 0 || (marked[0].getAttribute('aria-current') === 'true' && marked[0].textContent.indexOf(c.read("ezT('panel.current')")) >= 0));
  await tick(2300);
  const later = countdownSecs(c.q('[data-ezik-next="count"]').textContent);
  ok('the countdown runs by itself (it fell by one to three seconds)', first !== null && later !== null && first - later >= 1 && first - later <= 3, first + ' -> ' + later);
  await c.click(c.q('[data-ezik-day="next"]'));
  t('on another day there is no countdown strip', c.q('[data-ezik-next="head"]'), null);
  t('...and no prayer is marked', c.qa('[data-ezik-current="1"]').length, 0);
  await c.click(c.q('[data-ezik-day="today"]'));
  ok('back on today the strip returns', !!c.q('[data-ezik-next="head"]'));
  t('nothing threw', c.caught(), null);
};
SCENES['next-en'] = async () => {
  say('S12 the same screen in English, for a place chosen by name');
  const c = boot({ seed: { ezik_ui_lang_v1: 'en', ezik_qibla_loc_v1: JSON.stringify({ lat: JAK.lat, lng: JAK.lng }), ezik_prayer_place_v1: JSON.stringify(JAK) } });
  await openPrayer(c);
  const text = c.root.textContent;
  ok('the panel title is English', text.indexOf('Prayer times') >= 0);
  ok('the city is the place', c.q('[data-ezik-city="name"]').textContent.indexOf('Jakarta') >= 0 || c.q('[data-ezik-city="name"]').textContent.indexOf('x') >= 0);
  for (const w of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) ok('the row is labelled ' + w, text.indexOf(w) >= 0);
  ok('the clock is AM/PM with Latin digits', /\d{1,2}:\d\d (AM|PM)/.test(c.q('[data-ezik-prayer="fajr"]').textContent));
  const cnt = c.q('[data-ezik-next="count"]').textContent;
  ok('the countdown is Latin digits', /^\d\d:\d\d:\d\d$/.test(cnt), cnt);
  ok('the next-prayer words are English', text.indexOf('Next prayer') >= 0 && text.indexOf(' in ') >= 0);
  ok('the offsets heading is English', text.indexOf('Manual offset in minutes') >= 0);
  ok('the sunrise note is English', text.indexOf('Sunrise is calculated') >= 0);
  const arabicInPanel = Array.from(c.root.querySelectorAll('[data-ezik-prayer],[data-ezik-next],[data-ezik-city]')).filter((e) => /[\u0600-\u06FF]/.test(e.textContent));
  t('no Arabic letter inside the rows, the next-prayer strip or the city line', arabicInPanel.length, 0);
  t('nothing threw', c.caught(), null);
};
SCENES['iqama-noshell'] = async () => {
  say('S5  in a browser tab the alert controls are not drawn');
  const one = blank5(); one.dhuhr = { on: true, min: 10 };
  const c = boot({ seed: { ezik_prayer_prefs_v1: prefsWith({ iq: one }) } });
  await openPrayer(c);
  t('in a browser tab the control is not drawn', c.qa('[data-ezik-alert-row]').length, 0);
  t('nothing threw', c.caught(), null);
};
SCENES['places-offline'] = async () => {
  say('S2  a failed download of the places list says so and breaks nothing');
  const c = boot({ placesOffline: true });
  await openPrayer(c);
  await c.click(c.q('[data-ezik-place="toggle"]'));
  await c.waitFor(() => c.q('[data-ezik-place="input"]'));
  await c.waitFor(() => c.root.textContent.indexOf(c.read("ezT('place.search.failed')")) >= 0);
  ok('the failure sentence is shown', c.root.textContent.indexOf(c.read("ezT('place.search.failed')")) >= 0);
  t('no place was stored', c.store.getItem('ezik_prayer_place_v1'), null);
  t('nothing threw', c.caught(), null);
};

async function main() {
  const which = process.argv[2];
  if (which && which !== '--all') {
    if (!SCENES[which]) throw new Error('no scene ' + which);
    await SCENES[which]();
    say('SCENE ' + which + ' ' + (failed ? 'FAIL' : 'PASS') + ' ' + passed + '/' + (passed + failed));
    process.exit(failed ? 1 : 0);
  }
  say('prayer-features-guard: the prayer features of item 124');
  sectionPlace();
  sectionDay();
  sectionConv();
  sectionScreen();
  let sceneFail = 0;
  for (const name of Object.keys(SCENES)) {
    const code = await new Promise((resolve) => {
      const ch = spawn(process.execPath, [__filename, name], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      ch.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
      ch.stderr.on('data', (d) => { out += d; process.stdout.write(d); });
      ch.on('close', (c) => resolve(c));
    });
    if (code !== 0) sceneFail++;
  }
  say('\n' + (failed || sceneFail ? 'FAIL' : 'PASS') + '  ' + passed + ' function checks passed, ' + failed + ' failed; ' + (Object.keys(SCENES).length - sceneFail) + '/' + Object.keys(SCENES).length + ' scenes passed.');
  process.exit(failed || sceneFail ? 1 : 0);
}
main().catch((e) => { say('CRASH ' + (e && e.stack || e)); process.exit(2); });
