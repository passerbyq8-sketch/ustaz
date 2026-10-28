// guards/location-auto-guard.cjs -- PRAYER REBUILD (29 October 2026): the position found by itself, measured in the DOM.
//
// THE OWNER'S WORD (29 October 2026, 01:54): opening the section, or merely opening the app, must find his place and
// move the times. This guard mounts the shipped app.js in a linkedom window the way prayer-features-guard does, hands
// it a fake geolocation, and reads what the section did:
//   S1  with a geolocation answering within 100 ms with Salmiya (29.3399, 48.0760): the stored position and the city
//       line move within a second of the section's mount -- the position to Salmiya, the city to the nearest listed
//       name (As Salimiyah / السالمية), and the device name lands in the preferences' device record
//   S2  with a manual city stored (Jakarta): nothing is asked and nothing changes
//   S3  with the permission refused: the default stands, the refresh shows the refusal and the door to allow
//   S4  at the app's door with the permission already granted: the position is found before any section is opened;
//       with the permission still to be asked: the app's door asks nothing (the prompt belongs to the section)
//   S5  the default position computes on Asia/Kuwait whatever the device's zone (TZ=America/New_York for the scene)
//   S6  in the shell the section posts the one location request and takes the bridge's answer
// Each scene runs in its own process (two linkedom windows in one process cross-talk). A tree without the doors
// (origin/main before this branch) fails S1, S4 and S5. No request leaves: /places.json is served from the repo.
//
// Usage: node guards/location-auto-guard.cjs [--all | <scene>]       LOCAUTO_APP=<path to app.js> for a before/after run.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const APP_JS = process.env.LOCAUTO_APP ? path.resolve(process.env.LOCAUTO_APP) : path.join(REPO, 'app.js');
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
function memStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }, dump: () => Object.fromEntries(m) };
}
const SALMIYA = { lat: 29.3399, lng: 48.0760 };
const JAK = { n: 'Jakarta', a: 'x', cc: 'ID', tz: 'Asia/Jakarta', lat: -6.2146, lng: 106.8451 };

// The boot, as prayer-features-guard boots: a linkedom window, the vendor React, app.js, the one fixture fetch.
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
  // THE FAKE PLATFORM. linkedom's window.navigator is a fresh object on every read, so the fakes sit on its prototype.
  const geoCalls = [];
  const NP = Object.getPrototypeOf(window.navigator);
  if (opts.geo) {
    Object.defineProperty(NP, 'geolocation', { configurable: true, get: () => ({
      getCurrentPosition: (okFn, failFn, o) => {
        geoCalls.push({ opts: o, at: Date.now() });
        NODE_TICK(() => {
          if (opts.geo === 'deny') { failFn({ code: 1, message: 'denied' }); return; }
          if (opts.geo === 'nopos') { failFn({ code: 2, message: 'unavailable' }); return; }
          okFn({ coords: { latitude: SALMIYA.lat, longitude: SALMIYA.lng, accuracy: o && o.enableHighAccuracy ? 20 : 800 } });
        }, 100);
      },
    }) });
  }
  if (opts.permission) Object.defineProperty(NP, 'permissions', { configurable: true, get: () => ({ query: () => Promise.resolve({ state: opts.permission }) }) });
  const FIX = new Set(['/places.json', '/adhkar.json', '/adhkar-split-27.json', '/arbaeen.json']);
  window.fetch = (url) => {
    const key = String(url); requests.push(key);
    if (!FIX.has(key)) return Promise.reject(new TypeError('offline fixture boundary'));
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
  const t0 = Date.now();
  vm.runInContext(fs.readFileSync(APP_JS, 'utf8'), ctx, { filename: 'app.js' });
  const root = window.document.getElementById('root');
  const read = (expr) => vm.runInContext('(' + expr + ')', ctx);
  const props = (el) => el && el[Object.keys(el).find((k) => k.startsWith('__reactProps$'))];
  const open = (route) => vm.runInContext('window.dispatchEvent(new CustomEvent("ezik-scheduler",{detail:{channel:"ezik-scheduler",v:1,op:"open",route:' + JSON.stringify(route) + ',type:null,id:null}}))', ctx);
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));
  const waitFor = async (fn, cap = 6000) => { const end = Date.now() + cap; let v = fn(); while (!v && Date.now() < end) { await tick(30); v = fn(); } return fn(); };
  const click = async (el) => { if (!el) throw new Error('missing control'); const p = props(el); if (p && p.onClick) p.onClick({ preventDefault() {}, stopPropagation() {}, currentTarget: el, target: el }); await tick(80); };
  const store = window.localStorage;
  const sendLoc = (detail) => vm.runInContext('window.dispatchEvent(new CustomEvent("ezik:location:result",{detail:' + JSON.stringify(detail) + '}))', ctx);
  return { window, root, read, open, q, qa, waitFor, click, requests, posts, geoCalls, store, props, sendLoc, t0, caught: () => caught, ctx };
}
async function openPrayer(c) {
  await c.waitFor(() => c.q('.ezc-rail') || c.q('[data-ezik-home-module]') || c.q('.ez110-home'));
  c.open('prayer');
  await c.waitFor(() => c.q('[data-ezik-city="name"]'));
}
const SCENES = {};
SCENES.section = async () => {
  say('S1  the section\'s door: a fix within 100 ms moves the position and the city within a second');
  const c = boot({ geo: 'ok' });
  await openPrayer(c);
  const opened = Date.now();
  const moved = await c.waitFor(() => { const r = c.store.getItem('ezik_qibla_loc_v1'); return r && JSON.parse(r).lat === SALMIYA.lat ? r : null; }, 1500);
  ok('the position moved to Salmiya within a second of the mount', !!moved && Date.now() - opened < 1500, JSON.stringify(moved) + ' after ' + (Date.now() - opened) + ' ms');
  ok('the quick fix was asked for first (cached, eight seconds)', c.geoCalls.length >= 1 && c.geoCalls[0].opts && c.geoCalls[0].opts.enableHighAccuracy === false && c.geoCalls[0].opts.maximumAge === 600000 && c.geoCalls[0].opts.timeout === 8000, JSON.stringify(c.geoCalls[0] && c.geoCalls[0].opts));
  const named = await c.waitFor(() => { const r = c.store.getItem('ezik_prayer_prefs_v1'); const p = r ? JSON.parse(r) : null; return p && p.dev && p.dev.n ? p.dev : null; }, 3000);
  t('the fix is named by the nearest listed city, with its zone', named && [named.n, named.a, named.tz, named.lat, named.lng], ['As Salimiyah', 'السالمية', 'Asia/Kuwait', SALMIYA.lat, SALMIYA.lng]);
  const city = await c.waitFor(() => { const el = c.q('[data-ezik-city="name"]'); return el && /السالمية/.test(el.textContent) ? el.textContent : null; }, 3000);
  ok('the city line says Salmiya in Arabic', !!city, c.q('[data-ezik-city="name"]') && c.q('[data-ezik-city="name"]').textContent);
  t('the silent fresh fix followed and, a hundred metres off, changed nothing', [c.geoCalls.length, c.geoCalls[1] && c.geoCalls[1].opts.enableHighAccuracy, JSON.parse(c.store.getItem('ezik_qibla_loc_v1')).lat], [2, true, SALMIYA.lat]);
  t('the manual-city record was not invented', c.store.getItem('ezik_prayer_place_v1'), null);
  t('no request left the page but the places list and the static corpora', c.requests.filter((r) => !/^\/[a-z0-9-]+\.json$/.test(r) && !/^\/api\/articles-list\?/.test(r)), []);
  t('nothing threw', c.caught(), null);
};
SCENES.manual = async () => {
  say('S2  a manual city stands: nothing is asked, nothing moves');
  const c = boot({ geo: 'ok', seed: { ezik_qibla_loc_v1: JSON.stringify({ lat: JAK.lat, lng: JAK.lng }), ezik_prayer_place_v1: JSON.stringify(JAK) } });
  await openPrayer(c);
  await tick(600);
  t('geolocation was never asked', c.geoCalls.length, 0);
  t('the position is still Jakarta', JSON.parse(c.store.getItem('ezik_qibla_loc_v1')), { lat: JAK.lat, lng: JAK.lng });
  ok('the city line is the manual city', /Jakarta|x/.test(c.q('[data-ezik-city="name"]').textContent));
  ok('the way back to automatic is offered', !!c.q('[data-ezik-city="auto"]'));
  await c.click(c.q('[data-ezik-city="auto"]'));
  const moved = await c.waitFor(() => { const r = c.store.getItem('ezik_qibla_loc_v1'); return r && JSON.parse(r).lat === SALMIYA.lat ? r : null; }, 1500);
  ok('«automatic» asks and replaces the manual city with the device fix', !!moved && c.store.getItem('ezik_prayer_place_v1') === null && c.geoCalls.length === 1 && c.geoCalls[0].opts.enableHighAccuracy === true);
  t('nothing threw', c.caught(), null);
};
SCENES.denied = async () => {
  say('S3  the permission is refused: the default stands, the refresh says so and offers the door');
  const c = boot({ geo: 'deny' });
  await openPrayer(c);
  await tick(400);
  t('geolocation was asked once at the door', c.geoCalls.length, 1);
  t('the default position stands', c.store.getItem('ezik_qibla_loc_v1'), null);
  ok('the city line is the default city', c.q('[data-ezik-city="name"]').textContent.indexOf(c.read("ezT('place.default')")) >= 0);
  await c.click(c.q('[data-ezik-city="refresh"]'));
  const state = await c.waitFor(() => { const el = c.q('[data-ezik-city="state"]'); return el && el.getAttribute('data-ezik-city-fix') === 'failed' ? el : null; }, 1500);
  ok('the refresh reports the refusal in words', !!state && state.textContent === c.read("ezT('place.fail.denied')"), state && state.textContent);
  ok('...and draws the door to allow the location', !!c.q('[data-ezik-city="allow"]'));
  t('the refresh asked a fresh fix (no cache, high accuracy, fifteen seconds)', c.geoCalls[1] && c.geoCalls[1].opts, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  t('nothing threw', c.caught(), null);
};
SCENES.boot = async () => {
  say('S4  the app\'s door: with the permission granted the position is found before any section opens; with it still to ask, nothing is asked');
  const c = boot({ geo: 'ok', permission: 'granted' });
  await c.waitFor(() => c.q('.ezc-rail') || c.q('[data-ezik-home-module]') || c.q('.ez110-home'));
  const moved = await c.waitFor(() => { const r = c.store.getItem('ezik_qibla_loc_v1'); return r && JSON.parse(r).lat === SALMIYA.lat ? r : null; }, 2000);
  ok('the position was found at the app\'s door, no section opened', !!moved && Date.now() - c.t0 < 4000, (Date.now() - c.t0) + ' ms after app.js ran');
  t('the chat is what is on screen', !!c.q('.ezc-rail'), true);
  t('nothing threw', c.caught(), null);
};
SCENES['boot-prompt'] = async () => {
  say('S4b the app\'s door with the permission still to be asked: nothing is asked (two windows in one process cross-talk, so its own process)');
  const p = boot({ geo: 'ok', permission: 'prompt' });
  await p.waitFor(() => p.q('.ezc-rail') || p.q('[data-ezik-home-module]') || p.q('.ez110-home'));
  await tick(500);
  t('with the permission still to be asked, the app\'s door asks nothing', p.geoCalls.length, 0);
  t('...and the default stands', p.store.getItem('ezik_qibla_loc_v1'), null);
  t('nothing threw', p.caught(), null);
};
SCENES.zone = async () => {
  say('S5  the default position computes on Asia/Kuwait whatever the device\'s zone (this scene runs with TZ=America/New_York)');
  const c = boot({});
  t('the scene\'s device zone is not Kuwait\'s', new Date(Date.UTC(2026, 9, 29, 12)).getTimezoneOffset(), 240);
  t('the default position\'s offset is +180', c.read('prayerTzNow(new Date(Date.UTC(2026, 9, 29, 12)), readQiblaLoc())'), 180);
  t('...and its zone object is the fixed one', c.read('prayerZoneOf(readQiblaLoc()).tz'), 'Asia/Kuwait');
  t('a device fix keeps the device\'s clock', c.read('prayerTzNow(new Date(Date.UTC(2026, 9, 29, 12)), { lat: 40.7, lng: -74, by: "device" })'), -240);
  const kw = c.read('(function(){const l=readQiblaLoc();const p=prayerTodayParts(new Date(Date.UTC(2026, 9, 29, 12)), prayerZoneOf(l));return prayerTimesFor(p.y,p.m,p.d,l.lat,l.lng,prayerTzNow(new Date(Date.UTC(2026, 9, 29, 12)),l),"kuwait","standard",null).dhuhr;})()');
  t('Kuwait City\'s dhuhr on the default reads 11:32 (Ojeiri, 29 October) and not a New York clock', kw, 11 * 60 + 32);
};
SCENES.shell = async () => {
  say('S6  in the shell the section posts the one location request and takes the bridge\'s answer');
  const c = boot({ shell: true });
  await openPrayer(c);
  const req = await c.waitFor(() => c.posts.find((w) => { try { return JSON.parse(w).type === 'ezik:location:request'; } catch (e) { return false; } }), 1500);
  ok('the section posted the location request through the bridge', !!req, JSON.stringify(c.posts.slice(0, 3)));
  t('the request is one type field', req && JSON.parse(req), { type: 'ezik:location:request' });
  c.sendLoc({ type: 'ezik:location:result', ok: true, lat: 29.34, lon: 48.08, source: 'last-known', error: null });
  const moved = await c.waitFor(() => { const r = c.store.getItem('ezik_qibla_loc_v1'); return r && JSON.parse(r).lat === 29.34 ? r : null; }, 1500);
  ok('the bridge\'s answer landed as the position (lon renamed once)', !!moved && JSON.parse(moved).lng === 48.08, moved);
  const named = await c.waitFor(() => { const r = c.store.getItem('ezik_prayer_prefs_v1'); const p = r ? JSON.parse(r) : null; return p && p.dev && p.dev.n ? p.dev.n : null; }, 3000);
  t('...and was named by the nearest listed city', named, 'As Salimiyah');
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
  say('location-auto-guard: the position found at the two doors (' + path.relative(REPO, APP_JS) + ')');
  let sceneFail = 0;
  for (const name of Object.keys(SCENES)) {
    const env = Object.assign({}, process.env);
    if (name === 'zone') env.TZ = 'America/New_York';
    const code = await new Promise((resolve) => {
      const ch = spawn(process.execPath, [__filename, name], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env });
      ch.stdout.on('data', (d) => { process.stdout.write(d); });
      ch.stderr.on('data', (d) => { process.stdout.write(d); });
      ch.on('close', (c) => resolve(c));
    });
    if (code !== 0) sceneFail++;
  }
  say('\n' + (sceneFail ? 'FAIL' : 'PASS') + '  ' + (Object.keys(SCENES).length - sceneFail) + '/' + Object.keys(SCENES).length + ' scenes passed.');
  process.exit(sceneFail ? 1 : 0);
}
main().catch((e) => { say('CRASH ' + (e && e.stack || e)); process.exit(2); });
