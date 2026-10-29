// guards/prayer-log-guard.cjs -- PRAYER REBUILD (29 October 2026): «your prayers today», measured in the DOM and by running the record.
//
// The one feature of com.salati.prayertracker taken this session: a touch on a prayer whose time has come marks it on
// time, a second late, a third clears it; the days in a row that are complete are the streak. This guard mounts the
// shipped app.js in a linkedom window the way prayer-features-guard does and reads the store the touches wrote:
//   L1  the key is ezik_prayer_log_v1 and its shape is { "YYYY-MM-DD": { fajr, dhuhr, asr, maghrib, isha } } with
//       "on" | "late" | null: the first touch writes "on", the second "late", the third clears
//   L2  a prayer whose time has not come cannot be touched; the current one is dashed
//   L3  three complete days in a row make a streak of 3; a day short of one prayer breaks it; today counts when complete
//   L4  the record is capped at 400 days, a broken store reads as empty, and the key is synced as a counter and
//       erased by «delete all my data»
// A tree without the card (origin/main before this branch) fails L1 and the lift.
//
// Usage: node guards/prayer-log-guard.cjs [--all | <scene>]      LOG_APP=<path to app.js> for a before/after run.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const APP_JS = process.env.LOG_APP ? path.resolve(process.env.LOG_APP) : path.join(REPO, 'app.js');
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
function memStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }, dump: () => Object.fromEntries(m) };
}
function liftFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  const open = src.indexOf('{', src.indexOf(')', i));
  let d = 0, k = open;
  for (; ; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(i, k + 1);
}
function liftConst(src, name) {
  const m = src.match(new RegExp('^const ' + name + ' = [^\\n]*?;(?:\\s*//[^\\n]*)?$', 'm'));
  if (!m) throw new Error('missing const ' + name);
  return m[0].replace(/\s*\/\/[^\n]*$/, '');
}
const ALL = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const dayKey = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return dayKey(d); };
const full = (m) => ({ fajr: m, dhuhr: m, asr: m, maghrib: m, isha: m });

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
  const seed = {};
  seed.child_profile = JSON.stringify({ name: 'Noor', age: 30, gender: 'male', birthYear: 1996, pid: 'PF-GUARD', createdAt: '2026-01-01T00:00:00.000Z' });
  seed.ezik_ai_consent_v1 = JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: 'PF-GUARD', grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });
  Object.assign(seed, opts.seed || {});
  window.localStorage = memStore(seed);
  window.sessionStorage = memStore({});
  window.postMessage = () => {};
  const FIX = new Set(['/places.json', '/adhkar.json', '/adhkar-split-27.json', '/arbaeen.json']);
  window.fetch = (url) => {
    const key = String(url);
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
  vm.runInContext(fs.readFileSync(APP_JS, 'utf8'), ctx, { filename: 'app.js' });
  const root = window.document.getElementById('root');
  const read = (expr) => vm.runInContext('(' + expr + ')', ctx);
  const props = (el) => el && el[Object.keys(el).find((k) => k.startsWith('__reactProps$'))];
  const open = (route) => vm.runInContext('window.dispatchEvent(new CustomEvent("ezik-scheduler",{detail:{channel:"ezik-scheduler",v:1,op:"open",route:' + JSON.stringify(route) + ',type:null,id:null}}))', ctx);
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));
  const waitFor = async (fn, cap = 6000) => { const end = Date.now() + cap; let v = fn(); while (!v && Date.now() < end) { await tick(30); v = fn(); } return fn(); };
  const click = async (el) => { if (!el) throw new Error('missing control'); const p = props(el); if (p && p.onClick && !el.disabled) p.onClick({ preventDefault() {}, stopPropagation() {}, currentTarget: el, target: el }); await tick(80); };
  return { window, root, read, open, q, qa, waitFor, click, store: window.localStorage, caught: () => caught, ctx };
}
async function openPrayer(c) {
  await c.waitFor(() => c.q('.ezc-rail') || c.q('[data-ezik-home-module]') || c.q('.ez110-home'));
  c.open('prayer');
  await c.waitFor(() => c.q('[data-ezik-log="card"]'));
}
const SCENES = {};
SCENES.touch = async () => {
  say('L1  a touch writes the key in its shape: on, then late, then cleared');
  const c = boot({});
  await openPrayer(c);
  const card = c.q('[data-ezik-log="card"]');
  ok('the card is on the first page with today\'s day', !!card && /^\d{4}-\d{2}-\d{2}$/.test(card.getAttribute('data-ezik-log-day')), card && card.getAttribute('data-ezik-log-day'));
  const today = card.getAttribute('data-ezik-log-day');
  t('five circles, one per prayer, in order', c.qa('[data-ezik-log="dot"]').map((e) => e.getAttribute('data-ezik-log-k')), ALL);
  const can = c.qa('[data-ezik-log="dot"][data-ezik-log-can="1"]');
  const cur = c.q('.ez110-plog-dot.is-cur');
  if (can.length === 0) {
    say('  (before fajr: no prayer of today has come, nothing can be touched -- the shape is proved by the record functions below)');
    t('before fajr no circle can be touched and none is dashed', [can.length, cur], [0, null]);
  } else {
    const k = can[0].getAttribute('data-ezik-log-k');
    ok('the current prayer is the dashed one and the last touchable', cur && cur.getAttribute('data-ezik-log-k') === can[can.length - 1].getAttribute('data-ezik-log-k'));
    await c.click(can[0]);
    let rec = JSON.parse(c.store.getItem('ezik_prayer_log_v1'));
    t('the first touch writes "on" under today, the other four null', rec[today], Object.assign(full(null), { [k]: 'on' }));
    t('...and only today is in the record', Object.keys(rec), [today]);
    t('...and the circle says so', c.q('[data-ezik-log-k="' + k + '"]').getAttribute('data-ezik-log-state'), 'on');
    await c.click(c.q('[data-ezik-log-k="' + k + '"]'));
    rec = JSON.parse(c.store.getItem('ezik_prayer_log_v1'));
    t('the second touch writes "late"', rec[today][k], 'late');
    await c.click(c.q('[data-ezik-log-k="' + k + '"]'));
    rec = JSON.parse(c.store.getItem('ezik_prayer_log_v1'));
    t('the third clears it', rec[today][k], null);
  }
  const future = c.qa('[data-ezik-log="dot"][data-ezik-log-can="0"]');
  ok('L2 a prayer whose time has not come is disabled', future.every((e) => e.disabled === true || e.getAttribute('disabled') !== null));
  if (future.length) { await c.click(future[0]); t('L2 ...and a touch on it writes nothing', c.store.getItem('ezik_prayer_log_v1') === null || !JSON.parse(c.store.getItem('ezik_prayer_log_v1'))[today] || JSON.parse(c.store.getItem('ezik_prayer_log_v1'))[today][future[0].getAttribute('data-ezik-log-k')] === null, true); }
  t('nothing threw', c.caught(), null);
};
SCENES.streak = async () => {
  say('L3  the streak: three complete days in a row count 3; a day short of one prayer breaks it');
  const three = {}; three[daysAgo(3)] = full('on'); three[daysAgo(2)] = full('late'); three[daysAgo(1)] = full('on');
  let c = boot({ seed: { ezik_prayer_log_v1: JSON.stringify(three) } });
  await openPrayer(c);
  t('three complete days ending yesterday read as a streak of 3', c.q('[data-ezik-log="streak"]').getAttribute('data-ezik-log-streak'), '3');
  const broken = {}; broken[daysAgo(3)] = full('on'); broken[daysAgo(2)] = Object.assign(full('on'), { asr: null }); broken[daysAgo(1)] = full('on');
  c = boot({ seed: { ezik_prayer_log_v1: JSON.stringify(broken) } });
  await openPrayer(c);
  t('a day short of one prayer breaks it: only yesterday counts', c.q('[data-ezik-log="streak"]').getAttribute('data-ezik-log-streak'), '1');
  const withToday = Object.assign({}, three); withToday[daysAgo(0)] = full('on');
  c = boot({ seed: { ezik_prayer_log_v1: JSON.stringify(withToday) } });
  await openPrayer(c);
  t('today counts when it is complete: 4', c.q('[data-ezik-log="streak"]').getAttribute('data-ezik-log-streak'), '4');
  t('nothing threw', c.caught(), null);
};
SCENES.record = async () => {
  say('L4  the record: the cap, a broken store, the sync table and the erasure');
  const store = memStore();
  const code = ['PRAYER_LOG_KEY', 'PRAYER_LOG_DAYS', 'PRAYER_LOG_MARKS', 'PRAYER_OFFSETTABLE', 'PRAYER_DAY_MIN_YEAR', 'PRAYER_DAY_MAX_YEAR'].map((n) => liftConst(SRC, n)).join('\n') + '\n'
    + ['prayerLogDayBlank', 'prayerLogDayRead', 'readPrayerLog', 'writePrayerLog', 'markPrayerLog', 'prayerLogNextMark', 'prayerLogDayComplete', 'prayerLogStreak', 'prayerDayFromIso', 'prayerDayIso', 'prayerShiftDay'].map((n) => liftFn(SRC, n)).join('\n');
  const ctx = { localStorage: store, JSON, Object, Array, Math, Number, String, Date, isFinite };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.A = { readPrayerLog, markPrayerLog, prayerLogStreak, prayerLogNextMark, PRAYER_LOG_KEY, PRAYER_LOG_DAYS };', ctx);
  const A = ctx.A;
  t('the key carries its version', A.PRAYER_LOG_KEY, 'ezik_prayer_log_v1');
  t('an empty store reads as an empty record', A.readPrayerLog(), {});
  for (const bad of ['', 'x', '[]', 'null', '{"2026-13-99":1}', '{"a":{"fajr":"on"}}']) { store.setItem('ezik_prayer_log_v1', bad); t('a broken store reads as empty: ' + bad, A.readPrayerLog(), {}); }
  store.removeItem('ezik_prayer_log_v1');
  A.markPrayerLog('2026-10-29', 'fajr', 'on');
  t('a mark lands in the shape', JSON.parse(store.getItem('ezik_prayer_log_v1')), { '2026-10-29': { fajr: 'on', dhuhr: null, asr: null, maghrib: null, isha: null } });
  t('a mark outside on/late reads as cleared', A.markPrayerLog('2026-10-29', 'fajr', 'x')['2026-10-29'].fajr, null);
  t('the cycle is nothing -> on -> late -> nothing', [A.prayerLogNextMark(null), A.prayerLogNextMark('on'), A.prayerLogNextMark('late')], ['on', 'late', null]);
  const big = {}; const d0 = new Date(Date.UTC(2024, 0, 1)); for (let i = 0; i < 450; i++) { const d = new Date(d0.getTime() + i * 86400000); big[d.toISOString().slice(0, 10)] = full('on'); }
  store.setItem('ezik_prayer_log_v1', JSON.stringify(big));
  const kept = Object.keys(A.readPrayerLog());
  t('the record keeps the last 400 days and drops the oldest', [kept.length, kept[0], kept[kept.length - 1]], [400, Object.keys(big).sort()[50], Object.keys(big).sort()[449]]);
  t('a 400-day streak', A.prayerLogStreak(A.readPrayerLog(), kept[kept.length - 1]), 400);
  ok('the key is synced as a counter and nowhere else', /PRAYER_LOG_KEY,/.test(SRC.slice(SRC.indexOf('function ezikSyncCtr()'), SRC.indexOf('function ezikSyncCtr()') + 400)) && !/PRAYER_LOG_KEY/.test(SRC.slice(SRC.indexOf('function ezikSyncKv()'), SRC.indexOf('function ezikSyncCtr()'))));
  ok('«delete all my data» erases it by its named constant', /try \{ localStorage\.removeItem\(PRAYER_LOG_KEY\); \} catch \(e\) \{\}/.test(SRC));
};

async function main() {
  const which = process.argv[2];
  if (which && which !== '--all') {
    if (!SCENES[which]) throw new Error('no scene ' + which);
    await SCENES[which]();
    say('SCENE ' + which + ' ' + (failed ? 'FAIL' : 'PASS') + ' ' + passed + '/' + (passed + failed));
    process.exit(failed ? 1 : 0);
  }
  say('prayer-log-guard: your prayers today (' + path.relative(REPO, APP_JS) + ')');
  let sceneFail = 0;
  for (const name of Object.keys(SCENES)) {
    const code = await new Promise((resolve) => {
      const ch = spawn(process.execPath, [__filename, name], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
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
