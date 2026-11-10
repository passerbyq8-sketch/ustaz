// ORDER T4: the real roads, as diagnosis D3 drove them. Pure ASCII; no network, no browser.
// The built app.js (or an older build's text) runs in a linkedom window with React's root stubbed.
// One fake clock serves the page and the server; each page has its own timer queue and only the
// page being driven fires its timers. /api/sync is answered by the shipped lib/sync/service.js over
// guards/sync-fake-store.cjs with the route's own reply shapes; /dima/* is read from the repo.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), nodeCrypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { parseHTML } = require('linkedom');
const REPO = path.resolve(__dirname, '..');
const plain = (v) => JSON.parse(JSON.stringify(v));
const ENV = { SYNC_ENC_KEY: '11'.repeat(32), VERCEL_ENV: 'preview' };
const VENDOR = ['react.umd.js', 'react-dom.umd.js'].map((f) => fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'));
let APP_HEAD = null;
const flush = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

function fakeLocal(seed) {
  const data = Object.assign({}, seed || {});
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; },
    key: (i) => Object.keys(data)[i] || null,
    get length() { return Object.keys(data).length; },
    _data: data,
  };
}

/** One world: a clock, a server, the sessions it resolves, and the pages driven in it. */
async function world(startIso) {
  const realNow = Date.now;
  const clock = { now: new Date(startIso || '2026-11-08T07:00:00+03:00').getTime() };
  Date.now = () => clock.now;
  const store = await import(pathToFileURL(path.join(REPO, 'lib/sync/store.js')).href);
  store.__setSyncStoreForTest(require('../guards/sync-fake-store.cjs').makeStore());
  const service = await import(pathToFileURL(path.join(REPO, 'lib/sync/service.js')).href);
  const sessions = {};
  const pages = [];
  let seq = 0;
  async function route(body) {
    const reply = (status, d) => ({ ok: status >= 200 && status < 300, status, json: async () => plain(d) });
    const account = sessions[body.session];
    if (body.action === 'status') return reply(200, { ok: true, open: !!account });
    if (!account) return reply(401, { ok: false, error: 'sync-session-invalid' });
    if (body.action === 'pull') { const p = await service.pull(account, body.cursor, ENV); return reply(200, { ok: true, cursor: p.cursor, changes: p.changes }); }
    if (body.action === 'push') { const r = await service.push(account, body.changes, ENV); return reply(200, { ok: true, results: r.results }); }
    if (body.action === 'export') return reply(200, await service.exportAll(account, ENV));
    if (body.action === 'wipe') { await service.wipeAll(account, ENV); return reply(200, { ok: true }); }
    return reply(400, { ok: false, error: 'sync-action' });
  }
  function addTimer(page, fn, ms, every) {
    const id = ++page.seq;
    page.timers.push({ id, at: clock.now + Math.max(0, Number(ms) || 0), fn, every: every ? Math.max(1, Number(ms) || 1) : 0 });
    return id;
  }
  function clearT(page, id) { page.timers = page.timers.filter((t) => t.id !== id); }
  /** Open the app on a storage. `app` is the built app.js text (default: this tree's app.js). */
  function open(opts) {
    const o = Object.assign({ storage: null, name: 'dev' }, opts || {});
    const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
    const page = { name: o.name, window, local: o.storage || fakeLocal({ mrb_device_v1: 'dev-' + (++seq) }), timers: [], seq: 0, alive: true, visible: true, requests: [] };
    window.self = window; window.window = window; window.globalThis = window;
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    if (!window.crypto) { try { window.crypto = nodeCrypto.webcrypto; } catch (e) {} }
    window.localStorage = page.local;
    const sess = {};
    window.sessionStorage = { getItem: (k) => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: (k) => { delete sess[k]; } };
    window.alert = () => {}; window.confirm = () => true;
    window.requestAnimationFrame = (fn) => addTimer(page, fn, 16, false);
    window.cancelAnimationFrame = (id) => clearT(page, id);
    window.requestIdleCallback = (fn) => addTimer(page, fn, 50, false);
    try { Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => (page.visible ? 'visible' : 'hidden') }); } catch (e) {}
    try { Object.defineProperty(window.document, 'hidden', { configurable: true, get: () => !page.visible }); } catch (e) {}
    window.setTimeout = (fn, ms, ...a) => addTimer(page, () => fn(...a), ms, false);
    window.clearTimeout = (id) => clearT(page, id);
    window.setInterval = (fn, ms, ...a) => addTimer(page, () => fn(...a), ms, true);
    window.clearInterval = (id) => clearT(page, id);
    window.__now = () => clock.now;
    window.fetch = async (url, init) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : {};
      page.requests.push({ t: clock.now, url: u, action: body.action, ids: (body.changes || []).map((c) => c.id), keepalive: !!(init && init.keepalive) });
      if (!page.alive && !(init && init.keepalive)) throw new Error('page gone');
      if (u === '/api/sync') return route(body);
      if (u.startsWith('/dima/')) {
        const f = path.join(REPO, u.split('?')[0]);
        if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => ({}) };
        const txt = fs.readFileSync(f, 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt };
      }
      throw new Error('blocked ' + u);
    };
    window.indexedDB = undefined;
    const ctx = vm.createContext(window);
    page.ctx = ctx;
    vm.runInContext('(function(){var R=Date;function D(){if(!(this instanceof D))return new R(__now()).toString();var a=[].slice.call(arguments);return a.length?new (Function.prototype.bind.apply(R,[null].concat(a)))():new R(__now());}D.prototype=R.prototype;D.now=function(){return __now();};D.UTC=R.UTC;D.parse=R.parse;Date=D;})();', ctx);
    global.window = window; global.document = window.document;
    // react-dom asks `'oninput' in document` once, at load; linkedom answers no, which sends text inputs down an IE-only path
    if (!('oninput' in window.document)) window.document.oninput = null;
    vm.runInContext(VENDOR[0], ctx, { filename: 'react.umd.js' });
    vm.runInContext(VENDOR[1], ctx, { filename: 'react-dom.umd.js' });
    vm.runInContext('var __t4CreateRoot = ReactDOM.createRoot; ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
    window.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
    if (!o.app && APP_HEAD === null) APP_HEAD = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
    vm.runInContext(o.app || APP_HEAD, ctx, { filename: 'app.js' });
    pages.push(page);
    return page;
  }
  /** Advance the shared clock, firing the driven page's timers in order (every other page is frozen). */
  async function advance(page, ms) {
    const end = clock.now + ms;
    let guard = 0;
    for (;;) {
      await flush();
      if (!page.alive) { clock.now = end; return; }
      const due = page.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      if (++guard > 20000) throw new Error('timer storm');
      clock.now = Math.max(clock.now, due.at);
      if (due.every) due.at += due.every; else page.timers = page.timers.filter((t) => t !== due);
      try { due.fn(); } catch (e) {}
    }
    clock.now = end;
    await flush();
  }
  const run = (page, code) => vm.runInContext(code, page.ctx);
  function kill(page) { page.alive = false; page.timers = []; }
  function fire(page, type, target) {
    const ev = new page.window.Event(type);
    (target === 'document' ? page.window.document : page.window).dispatchEvent(ev);
  }
  function signIn(page, account) {
    const session = 'S-' + account + '-' + (++seq);
    sessions[session] = account;
    // the native door's publishSession -> writeAuthSession: finish the link, kick a cycle in 1200 ms
    run(page, 'writeAuthSession(' + JSON.stringify({ session }) + ')');
    return session;
  }
  /** The first-run card's profile (onStart(nm, ONBOARDING_DEFAULT_AGE, null)). */
  function onboard(page) {
    run(page, "localStorage.setItem('child_profile', JSON.stringify({ name: '', age: 19, gender: null, birthYear: new Date().getFullYear() - 19, birthYearProvided: false, pid: ezikMintId(), createdAt: new Date().toISOString() }))");
  }
  /** What Dima's screen and home banner show, through the readers both components call. */
  function view(page) {
    return plain(run(page, `(() => {
      dimaResetSession();
      const store = dimaReadStore();
      const today = dimaCivilDate(), key = dimaDateKey(today);
      const raw = store.startDate ? dimaIndexForDate(store.startDate, today) : 1;
      const cur = dimaLogFor(store, key);
      const resolved = (typeof __dimaCatalog !== 'undefined' && __dimaCatalog) || __dimaData ? dimaResolveForDate(store, today) : null;
      const days = {};
      for (const k of Object.keys(store.log || {})) { const r = dimaLogFor(store, k); days[k] = r.l + r.q + r.j; }
      const plants = Array.from({ length: 7 }, (_, i) => { const d = dimaDateAdd(today, -i), k = dimaDateKey(d), r = dimaLogFor(store, k);
        return store.startDate && k >= store.startDate ? r.l + r.q + r.j : 0; });
      return { startDate: store.startDate || null, todayKey: key, titleIndex: Math.max(1, raw || 1), todayDrops: cur.l + cur.q + cur.j,
        contentIndex: resolved ? resolved.index : null, contentDayId: resolved ? resolved.dayId : null,
        frozenIndex: store.presented && store.presented[key] ? store.presented[key].index : null, days, plants };
    })()`));
  }
  async function openDima(page) {
    // DimaScreen mounts: loadDimaPacks().then(dimaPrepareTranslations), then its freeze effect.
    await run(page, 'loadDimaPacks().then(() => dimaPrepareTranslations())').catch(() => {});
    await flush();
    run(page, `(() => { const s = dimaReadStore(); const t = dimaCivilDate(); const k = dimaDateKey(t);
      if (!s.startDate || dimaIndexForDate(s.startDate, t) < 1 || s.presented?.[k]) return; dimaFreezePresented(s, dimaResolveForDate(s, t)); })()`);
  }
  /** DimaScreen's begin(), in its own expressions. */
  function begin(page) {
    run(page, `(() => { const store = dimaReadStore(); if (store.startDate) return; dimaWriteStore({ ...store, startDate: dimaDateKey(dimaCivilDate()), notifySeen: false }); })()`);
  }
  /** DimaScreen's mark() through updateLog(), in its own expressions (tab 0, 1 or 2). */
  function mark(page, tab) {
    run(page, `(() => { const store = dimaReadStore(); const today = dimaCivilDate(), todayKey = dimaDateKey(today);
      const rawIndex = store.startDate ? dimaIndexForDate(store.startDate, today) : 1; if (!store.startDate || rawIndex < 1) return;
      const resolved = dimaResolveForDate(store, today); const currentLog = dimaLogFor(store, todayKey);
      const patch = ${Number(tab)} === 0 ? { l: 1, taps: currentLog.taps + 1 } : ${Number(tab)} === 1 ? { q: 1 } : { j: 1 };
      const frozen = dimaFreezePresented(store, resolved);
      dimaWriteStore({ ...frozen, log: { ...(frozen.log || {}), [todayKey]: { ...currentLog, ...patch } } }); })()`);
  }
  /** Render one shipped component into its own node with the real React root; returns the node. */
  async function render(page, name, props) {
    run(page, '(() => { const el = document.createElement("div"); el.id = "t4-mount"; document.body.appendChild(el); globalThis.__t4Root = __t4CreateRoot(el); ReactDOM.flushSync(() => globalThis.__t4Root.render(React.createElement(' + name + ', ' + JSON.stringify(props || {}) + '))); })()');
    await advance(page, 200);
    return page.window.document.getElementById('t4-mount');
  }
  function unmount(page) { run(page, '(() => { if (globalThis.__t4Root) { globalThis.__t4Root.unmount(); globalThis.__t4Root = null; } const el = document.getElementById("t4-mount"); if (el) el.remove(); })()'); }
  const readJSON = (page, k) => { const v = page.local.getItem(k); try { return JSON.parse(v); } catch (e) { return v; } };
  async function account(acct) { return (await service.pull(acct, 0, ENV)).changes; }
  function restore() { for (const p of pages) kill(p); Date.now = realNow; }
  return { clock, open, advance, run, render, unmount, kill, fire, signIn, onboard, view, openDima, begin, mark, readJSON, account, service, sessions, restore, fakeLocal, ENV };
}
module.exports = { world, fakeLocal, plain, REPO };
