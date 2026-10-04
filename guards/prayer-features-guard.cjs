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
  const shown = () => KEYS.map((k) => c.q('[data-ezik-prayer="' + k + '"]').textContent);
  const expect = (y, m, d) => KEYS.map((k) => c.read("ezT('widget.prayer.' + '" + k + "')") + c.read('prayerClock(prayerTimesFor(' + [y, m, d].join(',') + ', QIBLA_DEFAULT_LAT, QIBLA_DEFAULT_LNG, prayerTzOn(' + [y, m, d].join(',') + ', null), "kuwait", "standard", null)["' + k + '"])'));
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
