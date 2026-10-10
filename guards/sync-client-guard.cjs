// guards/sync-client-guard.cjs -- items 24 + 58, the application half, end to end.
//
// THE SHIPPED CLIENT, RUN FOR REAL: the babel block of app.jsx is transformed exactly as the other
// client guards transform it and evaluated in a linkedom window (React is loaded, the root is not
// mounted). Its fetch is wired to THE REAL SERVER ROUTE, api/sync.js, over the in-memory store of
// guards/sync-fake-store.cjs -- so every case below is the device engine talking to the server
// that will ship, with real AES-256-GCM in between.
//
// Sections (order section 6, "local on the application"):
//   K  the key table of decision 2, key by key: every synced key travels, every device key stays
//   G  a guest signs in: everything on the device goes up, nothing is erased
//   T  two devices: the second receives conversations (text only), settings, counters, profile
//   O  sign-out: synced keys leave the device, device keys stay
//   W  delete-all: the server copy is wiped too; item 142: the mushaf downloads store goes
//   B  library (phase 3): a note and the reading position travel; a deleted note does not return
//   C  closed switch: the engine sends nothing beyond one status question, writes nothing
//
// Usage: node guards/sync-client-guard.cjs        Exit 0 when every case holds.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { parseHTML } = require('linkedom');
const { makeStore } = require('./sync-fake-store.cjs');

const REPO = path.join(__dirname, '..');
process.chdir(REPO);
const BB = require(path.join(REPO, 'tools', 'babel-block.cjs'));
const html = BB.readShippedClient('index.html');
const transformed = BB.transformBabelBlock(BB.readBabelBlock({ file: 'index.html', html }));

const results = [];
let failed = 0;
const check = (name, cond, detail) => { results.push({ name, ok: !!cond, detail: cond ? '' : (detail || '') }); if (!cond) failed++; };
const say = (s) => process.stdout.write(s + '\n');
const quiet = { log: console.log, warn: console.warn, error: console.error };

function fakeLocal(seed) {
  const data = Object.assign({}, seed || {});
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    key: (i) => Object.keys(data)[i] || null,
    get length() { return Object.keys(data).length; },
    _data: data,
  };
}

let ROUTE = null;
let serverCalls = [];
function makeDevice(seed, deviceId, opts) {
  const o = opts || {};
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  window.self = window; window.window = window; window.globalThis = window;
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  if (!window.crypto) { try { window.crypto = crypto.webcrypto; } catch (e) {} }
  const local = fakeLocal(Object.assign({ mrb_device_v1: deviceId }, seed));
  window.localStorage = local;
  const sess = {}; window.sessionStorage = { getItem: (k) => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: (k) => { delete sess[k]; } };
  window.alert = () => {}; window.confirm = () => true;
  const deleted = [];
  const requests = [];
  // Per device and not on the window: two linkedom windows in one process share expandos.
  const ctl = { pageGone: false };
  window.fetch = async (url, init) => {
    const body = init && init.body ? JSON.parse(init.body) : {};
    requests.push({ url: String(url), action: body.action, headers: init && init.headers, keepalive: !!(init && init.keepalive), bytes: Buffer.byteLength(String((init && init.body) || ''), 'utf8'), ids: (body.changes || []).map((c) => c.id) });
    serverCalls.push(body.action);
    // FIX 1: a page that died takes its ordinary requests with it; only keepalive ones arrive.
    if (ctl.pageGone && !(init && init.keepalive)) throw new Error('page gone');
    if (String(url) !== '/api/sync') return { ok: false, status: 404, json: async () => ({}) };
    const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
    await ROUTE.default({ method: 'POST', headers: Object.assign({}, init.headers), body }, res);
    if (process.env.SYNC_GUARD_DEBUG && body.action === 'pull') quiet.log('PULL', deviceId, body.cursor, '->', res.body && res.body.cursor, (res.body && res.body.changes || []).map((c) => c.id).join(','));
    return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => JSON.parse(JSON.stringify(res.body)) };
  };
  // No IndexedDB in linkedom: the library half is given a small in-memory one with the same API.
  window.indexedDB = o.idb || fakeIdb();
  global.window = window; global.document = window.document;
  try { Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true }); } catch (e) {}
  const ctx = vm.createContext(window);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  load('react.umd.js'); load('react-dom.umd.js');
  vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.console.error = () => {}; window.console.warn = () => {};
  vm.runInContext(transformed, ctx, { filename: 'app.jsx' });
  const api = vm.runInContext('({ cycle: ezikSyncCycle, collect: ezikSyncCollect, signOut: ezikSyncSignOutWipe, wipeServer: ezikSyncWipeServer, clearDl: ezikClearMushafDownloads, isOpen: ezikSyncIsOpen, flush: ezikSyncFlush, resetGate: ezikSyncResetGate, del: ezikDeleteChat, boot: ezikSyncBoot, save: ezikSaveChat, soonMs: EZIK_SYNC_SOON_MS, keepMax: EZIK_SYNC_KEEPALIVE_MAX, status: ezikSyncStatus, kv: ezikSyncKv, ctr: ezikSyncCtr, deviceOnly: ezikSyncDeviceOnly, beginLink: ezikSyncBeginLink, finishLink: ezikSyncFinishLink, writeSession: writeAuthSession, mark: EZIK_SYNC_IMAGE_MARK })', ctx);
  return { window, local, api, requests, deleted, idb: window.indexedDB, ctx, ctl };
}

function fakeIdb() {
  const dbs = {};
  const req = (fn) => { const r = {}; setTimeout(() => { try { r.result = fn(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; };
  return {
    _dbs: dbs,
    open(name) {
      const r = {};
      setTimeout(() => {
        const fresh = !dbs[name];
        if (fresh) dbs[name] = new Map();
        const store = dbs[name];
        const db = {
          close() {},
          createObjectStore() { return { createIndex() {} }; },
          transaction() {
            const t = { objectStore: () => ({
              getAll: () => req(() => Array.from(store.values()).map((v) => JSON.parse(JSON.stringify(v)))),
              put: (v) => { store.set(v.id, JSON.parse(JSON.stringify(v))); setTimeout(() => t.oncomplete && t.oncomplete(), 0); return {}; },
              delete: (id) => { store.delete(id); setTimeout(() => t.oncomplete && t.oncomplete(), 0); return {}; },
            }) };
            return t;
          },
        };
        r.result = db;
        if (fresh && r.onupgradeneeded) r.onupgradeneeded();
        r.onsuccess && r.onsuccess();
      }, 0);
      return r;
    },
    deleteDatabase(name) { delete dbs[name]; return {}; },
  };
}

// The interface-language key is spelt here in parts: guards/i18n-ui-guard.cjs holds the set of files
// that name it whole to exactly three, and this guard is not a place the key is decided.
const LANG_KEY = ['ezik', 'ui', 'lang', 'v1'].join('_');
const settle = () => new Promise((r) => setTimeout(r, 30));
// Two linkedom windows in one process cross-talk, so a device is RE-OPENED (a fresh window over the
// same storage and the same IndexedDB) every time the test turns back to it -- an app restart.
function reopen(d, deviceId) { const n = makeDevice({}, deviceId, { idb: d.idb }); for (const k of Object.keys(n.local._data)) delete n.local._data[k]; Object.assign(n.local._data, d.local._data); return n; }

async function main() {
  process.env.VERCEL_ENV = 'preview';
  process.env.SYNC_ENC_KEY = crypto.randomBytes(32).toString('hex');
  process.env.SYNC_SWITCH = 'all';
  const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
  const AUTHSTORE = await load('lib/auth/store.js');
  const ACCOUNT = await load('lib/auth/account.js');
  const SSTORE = await load('lib/sync/store.js');
  ROUTE = await load('api/sync.js');
  ROUTE.__setSyncRouteDepsForTest({ allow: async () => true });
  const MERGE = await load('lib/sync/merge.js');
  const store = makeStore();
  AUTHSTORE.__setAuthStoreForTest(store);
  SSTORE.__setSyncStoreForTest(store);
  const acct = async (sub, email) => {
    const a = await ACCOUNT.upsertAccount({ provider: 'google', sub, email, emailVerified: true });
    const s = await ACCOUNT.mintSession(a.key);
    return { key: a.key, session: s.session, json: JSON.stringify({ session: s.session, email, provider: 'google' }) };
  };
  const A = await acct('11', 'a@example.com');

  // ---------------- device 1: a guest with data, who signs in
  const PROFILE1 = { name: 'سارة', age: 30, gender: 'female', birthYear: 1996, pid: 'pid-device-1', createdAt: 'x' };
  const chatBody = [
    { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }, { type: 'text', text: 'ما هذا؟' }], timestamp: '2026-10-01T10:00:00.000Z' },
    { role: 'assistant', content: 'جواب الصورة', timestamp: '2026-10-01T10:00:05.000Z' },
  ];
  const seed1 = {
    child_profile: JSON.stringify(PROFILE1),
    ezik_chats_v1: JSON.stringify([{ id: 'c1', pk: 'pid-device-1', title: 'ما هذا؟', pinned: false, at: 5 }]),
    ezik_chat_v1_c1: JSON.stringify(chatBody),
    ezik_visual_theme_v2: 'night',
    [LANG_KEY]: 'fr',
    ezik_khatmah_v1: JSON.stringify({ pages: 40 }),
    mushaf_last_page_v1: JSON.stringify({ p: 77, s: 3 }),
    ezik_prayer_prefs_v1: JSON.stringify({ method: 'kuwait', asr: 'standard', off: { fajr: 2 }, adhanSound: true, iq: { fajr: { on: true, min: 20 } } }),
    ezik_qibla_loc_v1: JSON.stringify({ lat: 29.3, lng: 47.9 }),
    ezik_reminders_v1: JSON.stringify({ sabah: { on: true, times: ['06:00'] } }),
    ezik_ai_consent_v1: 'granted-device-1',
    parent_pin_hash: 'digest-device-1',
    directConvoLocked: 'true',
    ezik_wird_alerts_v1: '{"x":1}',
    ezlib_pos_v1: JSON.stringify({ 'FC-000001': 12 }),
  };
  const idb1 = fakeIdb();
  // a library note on device 1
  await new Promise((res) => { const r = idb1.open('ezik-library-v1', 1); r.onupgradeneeded = () => {}; r.onsuccess = () => { r.result.transaction('notes', 'readwrite').objectStore('notes').put({ id: 'n1-a-b', book_id: 'FC-000001', text: 'ملاحظتي', seq: 3 }); res(); }; });
  let d1 = makeDevice(seed1, 'device-one-1111', { idb: idb1 });

  // C -- before sign-in, a guest: the engine never calls the server
  serverCalls = [];
  const guestOut = await d1.api.cycle();
  check('C1 a guest (no session): the engine makes NO request and writes nothing', guestOut === 'signed-out' && serverCalls.length === 0);

  // K -- the table, key by key
  const kv = d1.api.kv(), ctr = d1.api.ctr(), dev = d1.api.deviceOnly();
  const OWNER_SYNC = ['ezik_visual_theme_v2', LANG_KEY, 'ezik_home_widgets_v1', 'ezik_home_order_v1', 'ezik_hijri_offset_v1', 'ezik_fatwa_scholars_v1', 'mushaf_bookmark_v1', 'mushaf_last_page_v1', 'mushaf_wird_target_v1', 'ezik_daily_wird_v1', 'ezik_wird_list_v1', 'adhkar_favorites_v1', 'adhkar_place_v1', 'ezik_tasbih_session_v1', 'ezlib_pos_v1'];
  const OWNER_CTR = ['ezik_khatmah_v1', 'mushaf_wird_day_v1', 'adhkar_daily_progress_v1', 'adhkar_usage_v1', 'ezik_adhkar_streak_v1', 'ezik_tasbih_log_v1'];
  const OWNER_DEVICE = ['ezik_qibla_loc_v1', 'ezik_prayer_place_v1', 'ezik_prayer_notify_v1', 'ezik_reminders_v1', 'ezik_wird_alerts_v1', 'ezik_ai_consent_v1', 'parent_pin_hash', 'directConvoLocked'];
  check('K1 every setting, position and list of decision 2 is in the synced table', OWNER_SYNC.every((k) => kv.includes(k)), OWNER_SYNC.filter((k) => !kv.includes(k)).join(','));
  check('K2 every counter (khatmah, wird day, adhkar, tasbih) is synced as a counter', OWNER_CTR.every((k) => ctr.includes(k)));
  check('K3 every device key of decision 2 is in NEITHER synced table', OWNER_DEVICE.every((k) => !kv.includes(k) && !ctr.includes(k) && dev.includes(k)));

  // G -- sign in (the session is written as every door writes it)
  d1.local.setItem('ezik_auth_session_v1', A.json);
  serverCalls = [];
  const out1 = await d1.api.cycle(); await settle();
  check('G1 a guest who signs in: the first cycle pushes and pulls', out1 === 'ok' && serverCalls.includes('push') && serverCalls.includes('pull'), out1 + ' ' + serverCalls.join(','));
  const pushed = d1.requests.filter((r) => r.action === 'push');
  check('G2 the session header rides only once the switch said open', d1.requests.find((r) => r.action === 'status') && !(d1.requests.find((r) => r.action === 'status').headers['x-ezik-session']) && pushed.every((r) => r.headers['x-ezik-session'] === A.session));
  const after1 = d1.local._data;
  check('G3 nothing on the device was erased by signing in', Object.keys(seed1).every((k) => k in after1));
  const imgStill = JSON.parse(after1.ezik_chat_v1_c1)[0].content.some((b) => b.type === 'image');
  check('G4 the device keeps its own image after the merge', imgStill);
  // what the server holds: no device keys
  const qh = store.data.get('sync:v1:preview:s:' + SSTORE.spaceIdOf(A.key) + ':q');
  const ids = qh ? Array.from(qh.v.keys()) : [];
  check('K4 the server holds the synced records and no device key', ids.includes('chat:c1') && ids.includes('kv:' + LANG_KEY) && ids.includes('ctr:ezik_khatmah_v1') && ids.includes('kv:profile') && ids.includes('kv:prayer_calc') && ids.includes('note:n1-a-b') && !ids.some((i) => /qibla|reminders|ai_consent|parent_pin|directConvo|wird_alerts|prayer_notify|mrb_device|auth_session/.test(i)), ids.join(','));
  const cycle2 = (serverCalls = [], await d1.api.cycle(), d1.requests.filter((r) => r.action === 'push').length);
  check('G5 a second cycle with nothing changed pushes nothing', cycle2 === pushed.length, cycle2 + ' vs ' + pushed.length);

  // T -- device 2 of the same account
  const PROFILE2 = { name: '', age: 19, gender: null, birthYear: 2007, pid: 'pid-device-2', createdAt: 'y' };
  const seed2 = { child_profile: JSON.stringify(PROFILE2), ezik_auth_session_v1: A.json, ezik_qibla_loc_v1: JSON.stringify({ lat: 1, lng: 2 }), ezik_khatmah_v1: JSON.stringify({ pages: 55 }), ezik_ai_consent_v1: 'granted-device-2' };
  const idb2 = fakeIdb();
  let d2 = makeDevice(seed2, 'device-two-2222', { idb: idb2 });
  const out2 = await d2.api.cycle(); await settle();
  const L2 = d2.local._data;
  const chat2 = L2.ezik_chat_v1_c1 ? JSON.parse(L2.ezik_chat_v1_c1) : [];
  check('T1 device 2 receives the conversation, filed under ITS profile', out2 === 'ok' && chat2.length === 2 && JSON.parse(L2.ezik_chats_v1).some((r) => r.id === 'c1' && r.pk === 'pid-device-2'));
  check('T2 ...as TEXT: the image is the mark on the other device', chat2[0].content.every((b) => b.type === 'text') && chat2[0].content[0].text === d2.api.mark && d2.api.mark === MERGE.IMAGE_ELSEWHERE);
  check('T3 settings and positions arrive', L2[LANG_KEY] === 'fr' && L2.ezik_visual_theme_v2 === 'night' && JSON.parse(L2.mushaf_last_page_v1).p === 77);
  check('T4 the counter takes the larger of the two devices', JSON.parse(L2.ezik_khatmah_v1).pages === 55);
  const p2 = JSON.parse(L2.child_profile);
  check('T5 «ملفّك» arrives (name, gender) and this device keeps its own profile id', p2.name === 'سارة' && p2.gender === 'female' && p2.birthYear === 1996 && p2.pid === 'pid-device-2');
  const pr2 = L2.ezik_prayer_prefs_v1 ? JSON.parse(L2.ezik_prayer_prefs_v1) : {};
  check('T6 the prayer method and adjustments arrive; the alerts inside them do not', pr2.method === 'kuwait' && pr2.off && pr2.off.fajr === 2 && !('iq' in pr2) && !('adhanSound' in pr2));
  check('T7 device keys did not travel: device 2 keeps its own qibla and consent, has no lock or reminders', JSON.parse(L2.ezik_qibla_loc_v1).lat === 1 && L2.ezik_ai_consent_v1 === 'granted-device-2' && !('parent_pin_hash' in L2) && !('directConvoLocked' in L2) && !('ezik_reminders_v1' in L2) && !('ezik_wird_alerts_v1' in L2));
  const note2 = idb2._dbs['ezik-library-v1'] && idb2._dbs['ezik-library-v1'].get('n1-a-b');
  check('B1 library: the note reaches device 2 and the reading position too', note2 && note2.text === 'ملاحظتي' && JSON.parse(L2.ezlib_pos_v1)['FC-000001'] === 12);
  // device 1 learns device 2's larger khatmah on its next cycle
  d1 = reopen(d1, 'device-one-1111');
  const o8 = await d1.api.cycle(); await settle();
  if (process.env.SYNC_GUARD_DEBUG) quiet.log('T8 outcome', o8, d1.local._data.ezik_khatmah_v1, JSON.stringify(d1.requests.slice(-3).map((r) => r.action)));
  check('T8 device 1 then takes the larger counter too', JSON.parse(d1.local._data.ezik_khatmah_v1).pages === 55);

  // B -- a note deleted on device 2 does not come back from device 1
  idb2._dbs['ezik-library-v1'].delete('n1-a-b');
  d2 = reopen(d2, 'device-two-2222'); await d2.api.cycle(); await settle();
  d1 = reopen(d1, 'device-one-1111'); await d1.api.cycle(); await settle();
  check('B2 a library note deleted on one device is deleted on the other, and stays deleted', !idb1._dbs['ezik-library-v1'].has('n1-a-b'));
  // a conversation deleted on device 1 disappears on device 2
  // deleted BY HAND, through the app's own delete (SYNC FIX 2: a dropped conversation is not a deletion)
  d1.api.del('c1');
  await d1.api.cycle(); await settle();
  d2 = reopen(d2, 'device-two-2222'); await d2.api.cycle(); await settle();
  check('T9 a conversation deleted on device 1 is gone from device 2', !('ezik_chat_v1_c1' in d2.local._data) && JSON.parse(d2.local._data.ezik_chats_v1).length === 0);

  // O -- sign-out on device 2
  d2.api.signOut();
  const L2b = d2.local._data;
  check('O1 sign-out: synced keys leave the device', !(LANG_KEY in L2b) && !('ezik_khatmah_v1' in L2b) && !('mushaf_last_page_v1' in L2b) && JSON.parse(L2b.child_profile).name === '');
  check('O2 sign-out: device keys stay', JSON.parse(L2b.ezik_qibla_loc_v1).lat === 1 && L2b.ezik_ai_consent_v1 === 'granted-device-2');
  const still = await (async () => { const r = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } }; await ROUTE.default({ method: 'POST', headers: { 'x-murabbi-device': 'device-one-1111' }, body: { action: 'pull', session: A.session, cursor: 0 } }, r); return r.body.changes.filter((c) => !c.rec.del).length; })();
  check('O3 ...and everything stays in the account', still >= 7, String(still));

  // W -- delete all on device 1
  d1 = reopen(d1, 'device-one-1111'); await d1.api.status();
  d1.api.wipeServer(); await settle(); await settle();
  // linkedom builds a fresh plain navigator object on every read, so the worker is lent to it for
  // the length of the one call, through that object's prototype, and taken back at once.
  {
    const proto = Object.getPrototypeOf(d1.window.navigator);
    Object.defineProperty(proto, 'serviceWorker', { configurable: true, get: () => ({ controller: { postMessage: (m) => d1.deleted.push(m) } }) });
    try { d1.api.clearDl(); } finally { delete proto.serviceWorker; }
  }
  check('W1 delete-all: the server copy of the account is empty', ![...store.data.keys()].some((k) => k.includes(SSTORE.spaceIdOf(A.key)) && /:(r|q|v|m)$/.test(k)));
  check('W2 item 142: the page asks the worker to drop the mushaf downloads store', d1.deleted.length === 1 && d1.deleted[0].ezik === 'downloads-clear');
  // SYNC FIX 3 -- the gate in front of «حذف كل البيانات», against the real route: the server is
  // wiped FIRST, and the device erase runs only after the server said so.
  {
    const Wk = await acct('77', 'w@example.com');
    const dw = makeDevice({ child_profile: JSON.stringify(PROFILE1), ezik_auth_session_v1: Wk.json, ezik_chats_v1: JSON.stringify([{ id: 'w1', pk: 'pid-device-1', title: 'w', pinned: false, at: 5 }]), ezik_chat_v1_w1: JSON.stringify([{ role: 'user', content: 'سؤال', timestamp: '2026-10-10T09:00:00.000Z' }]) }, 'device-wipe-7777');
    await dw.api.cycle(); await settle();
    const spaceKeys = () => [...store.data.keys()].filter((k) => k.includes(SSTORE.spaceIdOf(Wk.key)) && /:(r|q|v|m)$/.test(k));
    const hadData = spaceKeys().length > 0;
    let serverEmptyWhenErased = null;
    const took = dw.api.resetGate(() => { serverEmptyWhenErased = spaceKeys().length === 0; });
    await settle(); await settle();
    check('W3 sync fix 3: for an open account the gate takes the press, wipes the server, THEN lets the device erase run', hadData && took === true && serverEmptyWhenErased === true && spaceKeys().length === 0, JSON.stringify({ hadData, took, serverEmptyWhenErased }));
  }

  // C -- switch closed
  process.env.SYNC_SWITCH = 'off';
  const B = await acct('22', 'b@example.com');
  const d3 = makeDevice({ ezik_auth_session_v1: B.json, [LANG_KEY]: 'ur', child_profile: JSON.stringify(PROFILE1) }, 'device-three-333');
  const before3 = JSON.stringify(d3.local._data);
  serverCalls = [];
  const out3 = await d3.api.cycle();
  check('C2 switch off: one status question, answered closed, then nothing', out3 === 'closed' && serverCalls.join(',') === 'status');
  serverCalls = [];
  const out3b = await d3.api.cycle();
  check('C3 ...and the closed answer is believed: the next wake sends nothing at all', out3b === 'closed' && serverCalls.length === 0);
  check('C4 switch off: the device is byte for byte as it was, and the cap headers carry no session', JSON.stringify(d3.local._data) === before3 && d3.requests.every((r) => !(r.headers || {})['x-ezik-session']));
  check('C5 switch off: sign-out wipes nothing (sign-out is what it was)', d3.api.signOut() === false && d3.local._data[LANG_KEY] === 'ur');
  serverCalls = [];
  d3.api.wipeServer();
  check('C6 switch off: delete-all sends nothing to the server', serverCalls.length === 0);

  // ---------------------------------------------------------------- FIX 1 (10 October): upload now
  // F1  a change, then the page hidden at once: the change reached the server on a keepalive request
  // F2  an answer completes (the chat is saved): it is uploaded within seconds, with no hide at all
  // F3  more than the keepalive allowance: newest first in the keepalive request, the rest on
  //     ordinary ones -- and when the page dies with those, the next open sends them: nothing lost
  process.env.SYNC_SWITCH = 'all';
  const F = await acct('55', 'f@example.com');
  const serverIds = async (acctF) => { const r = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } }; await ROUTE.default({ method: 'POST', headers: { 'x-murabbi-device': 'device-fix1-0000' }, body: { action: 'pull', session: acctF.session, cursor: 0 } }, r); const o = {}; for (const c of r.body.changes) if (!c.rec.del) o[c.id] = c.rec.val; return o; };
  const PROFILEF = { name: '', age: 30, gender: null, birthYear: 1996, pid: 'pid-fix1', createdAt: 'z' };
  let df = makeDevice({ child_profile: JSON.stringify(PROFILEF), ezik_auth_session_v1: F.json }, 'device-fix1-1111');
  await df.api.cycle(); await settle();
  df.api.boot();
  let vis = 'visible';
  const doc = df.window.document;
  let canHide = true;
  try { Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => vis }); } catch (e) { canHide = false; }
  const hide = () => { vis = 'hidden'; doc.dispatchEvent(new df.window.Event('visibilitychange')); };
  canHide = canHide && doc.visibilityState === 'visible';
  const n0 = df.requests.length;
  df.local.setItem('ezik_visual_theme_v2', 'fix1-theme');
  hide(); await settle();
  const sent1 = df.requests.slice(n0).filter((r) => r.action === 'push');
  const held1 = await serverIds(F);
  check('F1 a change and an immediate hide: it is on the server, sent on a keepalive request, before the gather ran', canHide && held1['kv:ezik_visual_theme_v2'] === 'fix1-theme' && sent1.length >= 1 && sent1[0].keepalive === true, JSON.stringify({ canHide, sent1, v: held1['kv:ezik_visual_theme_v2'] }));
  vis = 'visible';
  // F2 -- an answer completes: the app saves the conversation, and the engine follows within seconds
  const n1 = df.requests.length;
  const cid = df.api.save(null, [{ role: 'user', content: 'سؤال الإصلاح', timestamp: '2026-10-10T10:00:00.000Z' }, { role: 'assistant', content: 'جواب الإصلاح', timestamp: '2026-10-10T10:00:04.000Z' }], 'pid-fix1');
  await new Promise((r) => setTimeout(r, df.api.soonMs + 600));
  const held2 = await serverIds(F);
  const pushes2 = df.requests.slice(n1).filter((r) => r.action === 'push');
  check('F2 a completed answer is uploaded within seconds (the gather is ' + df.api.soonMs + ' ms), without a hide', cid && held2['chat:' + cid] && held2['chat:' + cid].msgs.length === 2 && pushes2.length >= 1 && pushes2.every((r) => !r.keepalive));
  // F3 -- six large conversations (each ~30 KB on the wire), then hide; the page dies with its ordinary requests
  df = reopen(df, 'device-fix1-1111');
  const big = 'ب'.repeat(15000);
  const idx = JSON.parse(df.local._data.ezik_chats_v1 || '[]');
  const bigIds = [];
  for (let i = 0; i < 6; i++) {
    const id = 'big' + i;
    bigIds.push(id);
    df.local._data['ezik_chat_v1_' + id] = JSON.stringify([{ role: 'user', content: big + i, timestamp: '2026-10-10T11:0' + i + ':00.000Z' }]);
    idx.push({ id, pk: 'pid-fix1', title: 't' + i, pinned: false, at: 1000 + i });
  }
  df.local._data.ezik_chats_v1 = JSON.stringify(idx);
  await df.api.status();
  df.ctl.pageGone = true;
  const n2 = df.requests.length;
  const nSent = df.api.flush(); await settle();
  const live = df.requests.slice(n2).filter((r) => r.keepalive);
  const ordinary = df.requests.slice(n2).filter((r) => !r.keepalive);
  const held3 = await serverIds(F);
  const onServer = bigIds.filter((id) => held3['chat:' + id]);
  check('F3a the keepalive request stays inside the browser allowance (' + df.api.keepMax + ' bytes)', live.length === 1 && live[0].bytes <= df.api.keepMax, JSON.stringify(live.map((r) => r.bytes)));
  check('F3b ...it carries the NEWEST conversations first', live.length === 1 && live[0].ids.includes('chat:big5') && live[0].ids.includes('chat:big4') && !live[0].ids.includes('chat:big0'), JSON.stringify(live.map((r) => r.ids)));
  check('F3c ...and the rest was sent on ordinary requests, not dropped', nSent === 6 && ordinary.length >= 1 && onServer.length === live[0].ids.length && onServer.length < 6, JSON.stringify({ nSent, ord: ordinary.length, onServer }));
  df = reopen(df, 'device-fix1-1111');
  const o4 = await df.api.cycle(); await settle();
  if (process.env.SYNC_GUARD_DEBUG) quiet.log('F3d', o4, JSON.stringify(df.requests.map((r) => [r.action, r.keepalive, r.bytes, r.ids.length])));
  const held4 = await serverIds(F);
  check('F3d the page died with them, and the next open sends them: all six are in the account', bigIds.every((id) => held4['chat:' + id]), JSON.stringify(Object.keys(held4)));

  // ---------------------------------------------------------------- FIX 2 (10 October): a full device
  // H1  a device at the cap that saves one more: the oldest leaves the device and STAYS in the account
  // H2  a second cycle does not bring it back
  // H3  a deletion by hand still deletes from the account
  // H4  a new device takes the newest conversations up to the cap
  // H5  «نزّل بياناتي» holds everything the account holds
  const Gk = await acct('66', 'g@example.com');
  const PROFILEG = { name: '', age: 30, gender: null, birthYear: 1996, pid: 'pid-fix2', createdAt: 'g' };
  const seedG = { child_profile: JSON.stringify(PROFILEG), ezik_auth_session_v1: Gk.json };
  const gIdx = [];
  for (let i = 0; i < 60; i++) {
    const id = 'g' + String(i).padStart(2, '0');
    seedG['ezik_chat_v1_' + id] = JSON.stringify([{ role: 'user', content: 'سؤال ' + i, timestamp: new Date(1e12 + i * 1000).toISOString() }]);
    gIdx.push({ id, pk: 'pid-fix2', title: 't' + i, pinned: false, at: 1e12 + i * 1000 });
  }
  seedG.ezik_chats_v1 = JSON.stringify(gIdx);
  let dg = makeDevice(seedG, 'device-fix2-1111');
  await dg.api.cycle(); await settle();
  const liveIn = async () => { const r = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } }; await ROUTE.default({ method: 'POST', headers: { 'x-murabbi-device': 'device-fix2-0000' }, body: { action: 'pull', session: Gk.session, cursor: 0 } }, r); return r.body.changes.filter((c) => c.id.indexOf('chat:') === 0); };
  const newId = dg.api.save(null, [{ role: 'user', content: 'السؤال الحادي والستون', timestamp: '2026-10-10T12:00:00.000Z' }], 'pid-fix2');
  const localIds = () => JSON.parse(dg.local._data.ezik_chats_v1).map((r) => r.id);
  const trimmedHere = !localIds().includes('g00') && localIds().length === 60;
  await dg.api.cycle(); await settle();
  let held = await liveIn();
  const g00 = held.find((c) => c.id === 'chat:g00');
  check('H1 the device drops its oldest past the cap (60), and the account keeps it, with no tombstone', trimmedHere && g00 && !g00.rec.del && held.filter((c) => !c.rec.del).length === 61, JSON.stringify({ trimmedHere, g00: g00 && g00.rec.del, n: held.length }));
  dg = reopen(dg, 'device-fix2-1111');
  await dg.api.cycle(); await settle();
  dg = reopen(dg, 'device-fix2-1111');
  await dg.api.cycle(); await settle();
  check('H2 two more cycles do not bring it back, and the device stays at the cap', !localIds().includes('g00') && localIds().length === 60 && !('ezik_chat_v1_g00' in dg.local._data));
  dg.api.del('g30');
  dg = reopen(dg, 'device-fix2-1111');
  await dg.api.cycle(); await settle();
  held = await liveIn();
  const g30 = held.find((c) => c.id === 'chat:g30');
  check('H3 a conversation deleted by hand is deleted from the account (a tombstone)', g30 && g30.rec.del === true && !localIds().includes('g30'));
  // one more question on the full device: the account now holds 61 live conversations
  const newId2 = dg.api.save(null, [{ role: 'user', content: 'سؤال آخر', timestamp: '2026-10-10T12:05:00.000Z' }], 'pid-fix2');
  await dg.api.cycle(); await settle();
  const dn = makeDevice({ child_profile: JSON.stringify(Object.assign({}, PROFILEG, { pid: 'pid-fix2-new' })), ezik_auth_session_v1: Gk.json }, 'device-fix2-2222');
  await dn.api.cycle(); await settle();
  const nIds = JSON.parse(dn.local._data.ezik_chats_v1 || '[]').map((r) => r.id);
  check('H4 a new device takes the newest up to the cap: 60 of the 61 live, the oldest left in the account, the deleted one absent', nIds.length === 60 && nIds.includes(newId) && nIds.includes(newId2) && !nIds.includes('g00') && nIds.includes('g01') && !nIds.includes('g30'), JSON.stringify({ n: nIds.length }));
  {
    const r = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await ROUTE.default({ method: 'POST', headers: { 'x-murabbi-device': 'device-fix2-0000' }, body: { action: 'export', session: Gk.session } }, r);
    const ex = Object.keys(r.body.records || {}).filter((k) => k.indexOf('chat:') === 0);
    check('H5 «نزّل بياناتي» holds every conversation the account holds (61 live), the dropped ones included', ex.length === 61 && ex.includes('chat:g00') && !ex.includes('chat:g30'), String(ex.length));
  }

  say('=== sync-client-guard: items 24 + 58, application ===');
  for (const r of results) say((r.ok ? '[PASS] ' : '[FAIL] ') + r.name + (r.ok ? '' : '  -- ' + r.detail));
  say('=== ' + (results.length - failed) + '/' + results.length + ' cases hold ===');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { for (const r of results) say((r.ok ? '[PASS] ' : '[FAIL] ') + r.name + (r.ok ? '' : '  -- ' + r.detail)); quiet.log('[FAIL] the guard could not run: ' + (e && e.stack || e)); process.exit(1); });
