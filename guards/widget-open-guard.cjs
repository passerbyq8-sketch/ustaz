// ITEM 45 / C1-C3. Whole-app runtime scenes, local public fixtures, and source mutations.
// Normal gates execute shipped app.js. --source compiles app.jsx without writing app.js.
// Each scene gets its own process: React state must not leak between linkedom windows.
// No request leaves this harness. DOM focus cannot measure a native WebView keyboard.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const REPO = path.join(__dirname, '..');
const SOURCE_MODE = process.argv.includes('--source');
const NODE_TICK = setTimeout;
const tick = (ms = 40) => new Promise((resolve) => NODE_TICK(resolve, ms));
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const say = (s) => process.stdout.write(ascii(s) + '\n');
const ROUTES = ['mushaf', 'adhkar_sabah', 'adhkar_masaa', 'home', 'adhkar', 'arbaeen', 'prayer', 'chat',
  'memorize', 'fatwa', 'lessons', 'articles', 'women', 'tasbih', 'calc', 'compass',
  'ayah-tafsir', 'asmaa', 'sunan-day', 'treasure'];
const SECTIONS = ['memorize', 'fatwa', 'lessons', 'adhkar', 'arbaeen', 'articles', 'women', 'prayer',
  'tasbih', 'calc', 'compass', 'ayah-tafsir', 'asmaa', 'sunan-day', 'treasure'];
const PROFILE_PID = 'W45-GUARD';
const PROFILE = { name: 'Noor', age: 30, gender: 'male', birthYear: 1996, pid: PROFILE_PID, createdAt: '2026-01-01T00:00:00.000Z' };
const FIXTURES = new Set(['/adhkar.json', '/adhkar-split-27.json', '/arbaeen.json', '/arbaeen-footnotes.json']);
const destination = (r) => /^adhkar_(sabah|masaa)$/.test(r) ? 'adhkar' : r;
function makeStore(seed, writes, name) {
  const m = new Map(Object.entries(seed || {}));
  return { getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { if (writes) writes.push([name, 'set', k]); m.set(k, String(v)); },
    removeItem: (k) => { if (writes) writes.push([name, 'remove', k]); m.delete(k); },
    clear: () => { if (writes) writes.push([name, 'clear']); m.clear(); },
    key: (i) => Array.from(m.keys())[i] || null, get length() { return m.size; } };
}
function compile(mutantName) {
  if (!mutantName && !SOURCE_MODE) return { code: fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'), applied: true };
  const BB = require(path.join(REPO, 'tools', 'babel-block.cjs'));
  const block = BB.readBabelBlock();
  const raw = block.raw.replace(/\r\n?/g, '\n');
  const mutant = mutantName && MUTANTS.find((m) => m.name === mutantName);
  let out = raw;
  for (const [from, to] of mutant ? mutant.edits : []) {
    const at = out.indexOf(from);
    if (at === -1 || out.indexOf(from, at + 1) !== -1) return { applied: false };
    out = out.slice(0, at) + to + out.slice(at + from.length);
  }
  return { applied: !mutant || out !== raw,
    code: BB.transformBabelBlock({ raw: out, runtime: block.runtime }, { retainLines: false, configFile: false, babelrc: false }) };
}
function boot(opts) {
  const { parseHTML } = require(path.join(REPO, 'node_modules', 'linkedom'));
  const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
  window.self = window; window.window = window; window.globalThis = window;
  window.matchMedia = (q) => ({ matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  const focuses = [], posts = [], browserPosts = [], requests = [], logs = [], dialogs = [], storageWrites = [], heldFixtures = [];
  let fixtureHold = !!opts.deferFixtures;
  window.scrollTo = () => {};
  window.alert = () => { dialogs.push('alert'); };
  window.confirm = () => { dialogs.push('confirm'); return true; };
  window.prompt = () => { dialogs.push('prompt'); return null; };
  window.location = { href: '/', pathname: '/', search: '', hash: '' };
  const EP = window.HTMLElement.prototype;
  EP.scrollIntoView = function () {};
  EP.focus = function () { focuses.push(this); };
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
  const seed = {};
  if (opts.profile) {
    seed.child_profile = JSON.stringify(PROFILE);
    if (opts.consent !== false) seed.ezik_ai_consent_v1 = JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: PROFILE_PID, grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });
  }
  seed.ezik_qibla_loc_v1 = JSON.stringify({ lat: 29.3759, lng: 47.9774 });
  seed.ezik_prayer_prefs_v1 = JSON.stringify({ method: 'kuwait', asr: 'standard', off: { fajr: 2 } });
  seed.adhkar_favorites_v1 = JSON.stringify(['adhkar_sabah:0']);
  window.localStorage = makeStore(seed, storageWrites, 'local');
  window.sessionStorage = makeStore({}, storageWrites, 'session');
  window.postMessage = (wire) => browserPosts.push(String(wire));
  if (opts.shell) window.ReactNativeWebView = { postMessage: (wire) => posts.push(String(wire)) };
  window.fetch = (url) => {
    const key = String(url); requests.push(key);
    if (opts.offline || !FIXTURES.has(key)) return Promise.reject(new TypeError('offline fixture boundary'));
    const value = fs.readFileSync(path.join(REPO, key.slice(1)), 'utf8');
    const response = { ok: true, status: 200, json: () => Promise.resolve(JSON.parse(value)), text: () => Promise.resolve(value) };
    if (fixtureHold) return new Promise((resolve) => heldFixtures.push(() => resolve(response)));
    return Promise.resolve(response);
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
  // A private console records calls without printing application text or mutating node's console.
  // Reply-silence checks snapshot this after boot, so React's startup output is not the subject.
  window.console = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug', 'trace', 'count', 'assert', 'dir', 'table', 'group', 'groupEnd']
    .map((level) => [level, () => { logs.push(level); }]));
  const built = compile(opts.mutant);
  if (!built.applied) return { notApplied: true };
  vm.runInContext(built.code, ctx, { filename: SOURCE_MODE || opts.mutant ? 'compiled-app.jsx' : 'app.js' });
  const read = (expr) => vm.runInContext('(' + expr + ')', ctx);
  const root = window.document.getElementById('root');
  const titleExpr = { prayer: 'PRAYER_SHEET_TITLE', memorize: 'MEM.TITLE', lessons: "ezT('module.lessons')",
    articles: 'EZH_ARTICLES', women: 'EZH_WOMEN', tasbih: "ezT('tasbih.title')", calc: "ezT('calc.title')",
    'ayah-tafsir': "ezT('home.verseOfDay2')", asmaa: "ezT('asmaa.title')", 'sunan-day': "ezT('sunan.title')" };
  const titles = Object.fromEntries(Object.entries(titleExpr).map(([key, expr]) => [key, read(expr)]));
  titles.mushaf = '\u0627\u0644\u0645\u0635\u062d\u0641';
  const where = () => {
    if (window.location.href === '/quest.html') return 'treasure';
    const top = root.firstElementChild;
    const cls = top ? String(top.getAttribute('class') || '') : '';
    if (/\bezonb\b/.test(cls)) return 'onboarding';
    if (/\bezgate\b/.test(cls)) return 'gate';
    if (/\bezf\b/.test(cls)) return 'fatwa';
    if (Array.from(root.querySelectorAll('svg')).some((el) => el.getAttribute('aria-label') === read('QIBLA_SECTION'))) return 'compass';
    const shellBrand = root.querySelector('.ezsh-brand');
    if (shellBrand) {
      const spans = shellBrand.querySelectorAll('span');
      const title = spans.length ? String(spans[spans.length - 1].textContent || '').trim() : '';
      for (const key of Object.keys(titles)) if (titles[key] && title === titles[key]) return key;
    }
    const bookBrand = root.querySelector('.ezia-brand');
    if (bookBrand && bookBrand.textContent.trim() === read('EZH_ARBAEEN')) return 'arbaeen';
    if (/\badhkar3\b/.test(cls)) return 'adhkar';
    if (root.querySelector('.ezc-rail')) return 'chat';
    if (root.querySelector('[data-ezik-home-module]')) return 'home';
    return 'other';
  };
  const send = (detail) => vm.runInContext('window.dispatchEvent(new CustomEvent("ezik-scheduler",{detail:JSON.parse(' + JSON.stringify(JSON.stringify(detail)) + ')}))', ctx);
  const open = (route) => send({ channel: 'ezik-scheduler', v: 1, op: 'open', route, type: null, id: null });
  const untilValue = async (fn, want, cap = 6000) => {
    const end = Date.now() + cap;
    while (fn() !== want && Date.now() < end) await tick(30);
    await tick(60); return fn();
  };
  const until = (want, cap) => untilValue(where, want, cap);
  const quiet = async () => { await untilValue(() => read('EZIK_WIDGET_PENDING'), ''); await tick(120); };
  const props = (el) => el && el[Object.keys(el).find((k) => k.startsWith('__reactProps$'))];
  const componentProps = (name) => {
    for (const el of root.querySelectorAll('*')) {
      let fiber = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];
      while (fiber) { if (fiber.type && fiber.type.name === name) return fiber.memoizedProps; fiber = fiber.return; }
    }
    return null;
  };
  const widgetPosts = () => posts.filter((wire) => { try { return JSON.parse(wire).op === 'widget-data'; } catch (_) { return false; } });
  const mountWidgetRoot = () => read('(function(){const host=document.createElement("div");document.body.appendChild(host);const extra=ReactDOM.createRoot(host);extra.render(React.createElement(function WidgetGuardRoot(){useEzikWidgetDataRoot(true);return null;}));return function(){extra.unmount();host.remove();};})()');
  return { window, root, read, where, open, send, until, untilValue, quiet, focuses, posts, browserPosts, requests, logs, dialogs, storageWrites, widgetPosts,
    mountWidgetRoot, heldFixtures, releaseFixtures: () => { fixtureHold = false; heldFixtures.splice(0).forEach((release) => release()); },
    props, componentProps, ledger: () => read('window.sessionStorage.getItem(EZIK_RESUME_KEY)'),
    click: async (el) => { if (!el) throw new Error('missing fixture button'); el.dispatchEvent(new window.Event('click', { bubbles: true })); await tick(100); },
    back: async () => { window.history.back(); await tick(160); }, caught: () => caught };
}
const SCENES = {};
for (const route of ROUTES) SCENES['cold-' + route] = async (c, t) => {
  c.open(route);
  t('C1 cold ' + route + ' opens ' + destination(route), await c.until(destination(route)), destination(route));
  if (route === 'chat') t('chat focuses its composer', c.focuses.some((el) => el.tagName === 'TEXTAREA'), true);
};
SCENES['warm-all'] = async (c, t) => {
  t('profile boot', await c.until('chat'), 'chat');
  for (const route of ROUTES) { c.open(route); t('C1 warm ' + route + ' opens ' + destination(route), await c.until(destination(route)), destination(route)); }
};
SCENES['warm-home'] = async (c, t) => {
  await c.until('chat'); c.open('home'); await c.until('home');
  for (const route of ['prayer', 'tasbih', 'calc', 'compass', 'articles', 'women']) {
    c.open(route); t('mounted home opens ' + route, await c.until(route), route);
    await c.back(); t('back from ' + route + ' returns home', await c.until('home'), 'home');
    t('home clears resume record', c.ledger(), null);
  }
};
SCENES['top-layer'] = async (c, t) => {
  for (const layer of ['asmaa', 'sunan-day']) {
    c.open(layer); t(layer + ' opens explicitly', await c.until(layer), layer);
    c.open('adhkar'); t(layer + ' closes before next destination', await c.until('adhkar'), 'adhkar');
    c.open('home'); t(layer + ' stays closed on home', await c.until('home'), 'home');
  }
};
SCENES['onboarding'] = async (c, t) => {
  for (const route of ['mushaf', 'prayer', 'chat']) {
    c.open(route); await c.until('onboarding'); await c.quiet();
    t('onboarding drops ' + route, c.where(), 'onboarding');
    t('onboarding keeps no pending route', c.read('EZIK_WIDGET_PENDING'), '');
    t('onboarding writes no resume record', c.ledger(), null);
  }
};
SCENES['twice'] = async (c, t) => {
  c.open('mushaf'); c.open('prayer'); t('two cold presses end on last', await c.until('prayer'), 'prayer');
  c.open('mushaf'); c.open('adhkar'); t('two warm presses end on last', await c.until('adhkar'), 'adhkar');
};
SCENES['foreign'] = async (c, t) => {
  await c.until('chat');
  const base = { channel: 'ezik-scheduler', v: 1, op: 'open', route: 'mushaf', type: null, id: null };
  const invalid = ['unknown', 'wirdi', 'constructor', '__proto__', 'Mushaf', ' prayer', '', 1, null];
  const messages = invalid.map((route) => ({ ...base, route })).concat(
    ['schedule', 'result', 'status', 'enable', 'widget-data'].map((op) => ({ ...base, op })),
    [{ ...base, v: 2 }, { ...base, channel: 'other' }]);
  for (const message of messages) {
    c.send(message); await c.quiet();
    t('foreign ignored ' + JSON.stringify({ route: message.route, op: message.op, v: message.v, channel: message.channel }), c.where(), 'chat');
    t('foreign writes no resume record', c.ledger(), null);
  }
  c.window.ReactNativeWebView = { postMessage: (wire) => c.posts.push(String(wire)) };
  c.read('ezikSchedLastSent = SHELL_SCHED_EMPTY');
  c.send({ ...base, op: 'rearm-request' }); await c.quiet();
  t('rearm-request still schedules', c.posts.filter((wire) => JSON.parse(wire).op === 'schedule').length, 1);
  const count = c.posts.length; c.open('mushaf'); await c.until('mushaf');
  t('open does not rearm schedule', c.posts.length, count);
};
SCENES['list-reset'] = async (c, t) => {
  for (const [route, selector] of [['adhkar', '[data-ezia-cat]'], ['arbaeen', '[data-ezia-hadith]']]) {
    c.open(route); await c.until(route);
    await c.untilValue(() => !!c.root.querySelector(selector), true);
    await c.click(c.root.querySelector(selector));
    t(route + ' fixture entered detail', !!c.root.querySelector(selector), false);
    c.open(route); await c.quiet();
    t(route + ' repeated tap returns to index', await c.untilValue(() => !!c.root.querySelector(selector), true), true);
  }
};
SCENES['chat-reset'] = async (c, t) => {
  await c.until('chat'); const input = c.root.querySelector('textarea');
  c.props(input).onChange({ target: { value: 'fixture draft' } }); await tick(100);
  t('fixture draft exists', c.root.querySelector('textarea').value, 'fixture draft');
  const count = c.focuses.length; c.open('chat'); await c.quiet();
  t('chat starts a new empty thread', c.root.querySelector('textarea').value, '');
  t('chat focuses after its new render', c.focuses.length > count && c.focuses[c.focuses.length - 1] === c.root.querySelector('textarea'), true);
};
SCENES['chat-consent'] = async (c, t) => {
  c.open('chat'); await c.until('gate'); await c.quiet();
  t('no composer before consent', !!c.root.querySelector('textarea'), false);
  t('no composer focus before consent', c.focuses.some((el) => el.tagName === 'TEXTAREA'), false);
  const gate = c.componentProps('AIConsentGate'); t('consent gate is mounted', !!gate, true);
  if (gate) gate.onGrant('user');
  t('grant mounts chat', await c.until('chat'), 'chat');
  t('pending widget focus runs after grant', c.focuses.some((el) => el === c.root.querySelector('textarea')), true);
};
SCENES['offline'] = async (c, t) => {
  for (const route of ['adhkar', 'arbaeen', 'prayer', 'asmaa', 'sunan-day']) { c.open(route); t('offline ' + route + ' opens', await c.until(route), route); }
};
SCENES['adhan'] = async (c, t) => {
  await c.until('chat');
  t('sound control fixture probes the shell', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  c.send(WIDGET_RESULT);
  t('sound setting defaults on', c.read('readPrayerPrefs().adhanSound'), true);
  t('sound label is exact contract text', c.read('PRAYER_ADHAN_SOUND_LABEL'), '\u0635\u0648\u062a \u0627\u0644\u0623\u0630\u0627\u0646');
  const items = c.read('ezikAdhanItems(new Date(2026, 8, 28))');
  t('five prayers for seven days', items.length, 35);
  for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    const group = items.filter((it) => it.id.split(':')[1] === prayer);
    t(prayer + ' sound matches C2', group.length === 7 && group.every((it) => it.adhanSound === (prayer === 'fajr' ? 'fajr' : 'other')), true);
  }
  const payload = c.read('ezikSchedPayload(' + JSON.stringify(items) + ', 0)');
  t('whitelist retains every sound', payload.message.items.length === 35 && payload.message.items.every((it) => ['fajr', 'other'].includes(it.adhanSound)), true);
  for (const value of [undefined, '', 'invalid', null, 1]) {
    const bad = { ...items[0] }; if (value === undefined) delete bad.adhanSound; else bad.adhanSound = value;
    const out = c.read('ezikSchedPayload(' + JSON.stringify([bad]) + ', 0)');
    t('missing/invalid sound rejected ' + String(value), out.message.items.length, 0);
    t('invalid sound counted ' + String(value), out.dropped.badAdhanSound, 1);
  }
  c.read('writePrayerPrefs({adhanSound:false})');
  t('sound off reaches all prayers', c.read('ezikAdhanItems(new Date(2026,8,28)).every((it) => it.adhanSound === "none")'), true);
  c.open('home'); await c.until('home');
  const home = c.componentProps('Home');
  if (home) home.onOpenSettings();
  await c.untilValue(() => !!c.root.querySelector('[data-ezik-prayer-setting="adhan-sound"]'), true);
  const control = c.root.querySelector('[data-ezik-prayer-setting="adhan-sound"]');
  t('sound switch beside prayer settings', !!control, true);
  if (control) {
    t('rendered sound label exactly matches C2', control.getAttribute('aria-label'), '\u0635\u0648\u062a \u0627\u0644\u0623\u0630\u0627\u0646');
    t('switch draws stored off', control.getAttribute('aria-checked'), 'false');
    await c.click(control); t('switch stores on', c.read('readPrayerPrefs().adhanSound'), true);
  }
};
function assertWidgetData(c, t, message) {
  t('C3 exact envelope', Object.keys(message).sort(), ['channel', 'data', 'op', 'v']);
  t('C3 channel/version/op', [message.channel, message.v, message.op], ['ezik-scheduler', 1, 'widget-data']);
  const d = message.data;
  t('C3 data keys', Object.keys(d).sort(), ['adhkar', 'arbaeen', 'generatedAt', 'prayer', 'sections', 'version']);
  t('C3 version', d.version, 1); t('C3 ISO time', new Date(d.generatedAt).toISOString(), d.generatedAt);
  t('30 local days', d.prayer.days.length, 30);
  const expected = c.read('(function(){const now=new Date(' + JSON.stringify(d.generatedAt) + '),loc=readQiblaLoc(),prefs=readPrayerPrefs(),off=readHijriOffset();return Array.from({length:30},(_,i)=>{const dt=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,12),y=dt.getFullYear(),m=dt.getMonth()+1,n=dt.getDate();const v=prayerTimesFor(y,m,n,loc.lat,loc.lng,-dt.getTimezoneOffset(),prefs.method,prefs.asr,prefs.off);const times={};for(const k of ["fajr","sunrise","dhuhr","asr","maghrib","isha"]){const x=v[k];times[k]=typeof x==="number"&&isFinite(x)?String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0"):null;}return {date:prayerDayKey(dt),gregorianLabel:ezikFavDate(dt.getTime())||null,hijriLabel:hijriLabel(hijriForCivilDay(y,m,n,off))||null,times};});})()');
  t('all dates labels and times use settings/calculator', d.prayer.days, expected);
  const raw = JSON.parse(fs.readFileSync(path.join(REPO, 'adhkar.json'), 'utf8'));
  const split = JSON.parse(fs.readFileSync(path.join(REPO, 'adhkar-split-27.json'), 'utf8'));
  const byId = new Map(raw.adhkar.map((row) => [String(row.id), row])); const expectedDoors = {};
  for (const [field, route] of [['sabah', 'adhkar_sabah'], ['masaa', 'adhkar_masaa']]) {
    expectedDoors[field] = split.doors.find((x) => x.key === route).items.map((row, i) => {
      const original = byId.get(String(row.id)); const item = row.text ? { ...original, text: row.text } : original;
      return { id: route + ':' + i, text: item.text, count: c.read('adhkarTarget(' + JSON.stringify(item) + ')') };
    });
    t(field + ' original split wording/counts', d.adhkar[field], expectedDoors[field]);
  }
  t('favorite uses app data', d.adhkar.favorites, [expectedDoors.sabah[0]]);
  const book = JSON.parse(fs.readFileSync(path.join(REPO, 'arbaeen.json'), 'utf8'));
  t('every hadith copied without rewriting', d.arbaeen, book.hadith.map(({ n, title, text }) => ({ n, title, text })));
  t('exact section-widget roster', d.sections.map((x) => x.route), SECTIONS);
  const labels = ['EZH_MEMORIZE','EZH_FATWA','EZH_LESSONS','EZH_ADHKAR','EZH_ARBAEEN','EZH_ARTICLES','EZH_WOMEN','EZH_PRAYER',"ezT('tasbih.card.title')","ezT('calc.card.title')",'EZH_NAV_COMPASS',"ezT('home.verseOfDay2')",'EZH_ASMAA','EZH_SUNAN','EZH_TREASURE'];
  t('every section label uses display text', d.sections.map((x) => x.label), labels.map((x) => c.read(x)));
}
SCENES['widget-data'] = async (c, t, notes) => {
  await c.until('chat'); t('boot sends once after debounce', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  c.send({ channel: 'ezik-scheduler', v: 1, op: 'result', inReplyTo: 'widget-data', ok: true, stored: true, dropped: 0 });
  const wire = c.widgetPosts()[0]; assertWidgetData(c, t, JSON.parse(wire));
  notes.push('FIXTURE widget-data UTF8_BYTES=' + Buffer.byteLength(wire, 'utf8') + ' profile=Noor adult Kuwait custom-fajr-offset favorite=sabah:0; not a real profile');
  const writers = [
    ['prayer settings', 'writePrayerPrefs({off:{fajr:7}})', (a,b) => a.prayer.days[0].times.fajr !== b.prayer.days[0].times.fajr],
    ['location', 'writeQiblaLoc(21.4225,39.8262)', (a,b) => a.prayer.days[0].times.dhuhr !== b.prayer.days[0].times.dhuhr],
    ['hijri offset', 'writeHijriOffset(1)', (a,b) => a.prayer.days[0].hijriLabel !== b.prayer.days[0].hijriLabel],
    ['adhkar favorites', 'toggleAdhkarFavorite("adhkar_masaa:0")', (a,b) => b.adhkar.favorites.length === a.adhkar.favorites.length + 1],
  ];
  for (const [label, expr, changed] of writers) {
    const count = c.widgetPosts().length, before = JSON.parse(c.widgetPosts()[count - 1]).data;
    c.read(expr); await tick(60); t(label + ' is debounced', c.widgetPosts().length, count);
    t(label + ' sends refreshed snapshot', await c.untilValue(() => c.widgetPosts().length, count + 1), count + 1);
    t(label + ' refresh uses stored change', changed(before, JSON.parse(c.widgetPosts().slice(-1)[0]).data), true);
  }
  const count = c.widgetPosts().length;
  for (const value of [8,9,10]) { c.read('writePrayerPrefs({off:{fajr:' + value + '}})'); await tick(50); }
  t('burst has not sent before final debounce', c.widgetPosts().length, count);
  t('burst sends only one snapshot', await c.untilValue(() => c.widgetPosts().length, count + 1), count + 1);
  await tick(300); t('burst leaves no extra snapshot', c.widgetPosts().length, count + 1);
};
SCENES['no-shell'] = async (c, t) => {
  await c.until('chat'); await tick(350);
  c.read('writePrayerPrefs({off:{fajr:7}})'); c.read('writeQiblaLoc(21.4,39.8)'); c.read('writeHijriOffset(1)'); c.read('toggleAdhkarFavorite("adhkar_masaa:0")');
  c.window.dispatchEvent(new c.window.Event('focus')); await tick(400);
  t('no widget-data without shell', c.widgetPosts().length, 0);
  t('no browser postMessage fallback', c.browserPosts.filter((wire) => { try { return JSON.parse(wire).op === 'widget-data'; } catch (_) { return false; } }).length, 0);
  t('no widget loaders outside shell', c.requests.filter((url) => FIXTURES.has(url)).length, 0);
};
SCENES['widget-reply-silence'] = async (c, t, notes) => {
  await c.until('chat');
  t('reply fixture completes the widget boot send', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  // Count entry into the REAL arm function, even when its fingerprint would suppress a post.
  c.window.__widgetReplyArms = 0;
  c.read('ezikSchedArm = ((arm) => function() { window.__widgetReplyArms++; return arm.apply(this, arguments); })(ezikSchedArm)');
  c.window.__widgetReplyEnableAnswers = [];
  c.window.__widgetReplyProbeAnswers = [];
  const stopEnable = c.read('ezikNotifyRequest((answer) => window.__widgetReplyEnableAnswers.push(answer))');
  const stopProbe = c.read('ezikSchedProbeAsk(SHELL_SCHED_STATUS_OP, null, (answer) => window.__widgetReplyProbeAnswers.push(answer))');
  t('enable request has a live listener', typeof stopEnable, 'function');
  t('probe request has a live listener', typeof stopProbe, 'function');
  const probe = JSON.parse(c.posts[c.posts.length - 1]);
  const base = { channel: 'ezik-scheduler', v: 1 };
  const success = { ...base, op: 'result', inReplyTo: 'widget-data', requestId: null, ok: true, stored: true, dropped: 0 };
  const failure = { ...base, op: 'result', inReplyTo: 'widget-data', requestId: null, ok: false, reason: 'invalid-widget-data' };
  const legacy = { ...base, op: 'error', requestId: null, ok: false, reason: 'unknown-op', received: 'widget-data' };
  const cases = [
    ['new success', success], ['new failure', failure],
    // A matching request id must not make the answer to a DIFFERENT operation ours.
    ['new success with active probe id', { ...success, requestId: probe.requestId }],
    ['new failure with active probe id', { ...failure, requestId: probe.requestId }],
    ['exact legacy unknown-op error', legacy],
  ];
  const storeSnapshot = () => [c.window.localStorage, c.window.sessionStorage].map((store) => {
    const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).sort();
    return keys.map((key) => [key, store.getItem(key)]);
  });
  const before = { html: c.root.outerHTML, screen: c.where(), location: c.window.location.href,
    history: [c.window.history.length, c.window.history.state], stores: storeSnapshot(),
    writes: c.storageWrites.length, posts: c.posts.length, browserPosts: c.browserPosts.length,
    logs: c.logs.length, dialogs: c.dialogs.length, requests: c.requests.filter((url) => FIXTURES.has(url)).length,
    focuses: c.focuses.length, ledger: c.ledger() };
  try {
    for (const [label, message] of cases) {
      for (let i = 0; i < 3; i++) { c.send(message); await tick(30); }
      await tick(250); // Longer than the widget sender's debounce; a reply loop cannot hide.
      t(label + ': UI unchanged', c.root.outerHTML, before.html);
      t(label + ': no visible dialog', c.dialogs.length, before.dialogs);
      t(label + ': no scheduler rearm call', c.window.__widgetReplyArms, 0);
      t(label + ': no outbound message', [c.posts.length, c.browserPosts.length], [before.posts, before.browserPosts]);
      t(label + ': navigation unchanged', [c.where(), c.window.location.href, c.window.history.length, c.window.history.state],
        [before.screen, before.location, before.history[0], before.history[1]]);
      t(label + ': stores unchanged', storeSnapshot(), before.stores);
      t(label + ': no storage writes', c.storageWrites.length, before.writes);
      t(label + ': no queued open or resume change', [c.read('EZIK_WIDGET_PENDING'), c.ledger()], ['', before.ledger]);
      t(label + ': enable/probe callbacks not consumed', [c.window.__widgetReplyEnableAnswers.length, c.window.__widgetReplyProbeAnswers.length], [0, 0]);
      t(label + ': no logging, including repeated replies', c.logs.length, before.logs);
      t(label + ': no widget loader or focus activity', [c.requests.filter((url) => FIXTURES.has(url)).length, c.focuses.length], [before.requests, before.focuses]);
    }
    // Positive controls: ignored widget replies must leave both real listeners alive.
    c.send({ ...base, op: 'result', inReplyTo: 'enable', ok: true });
    c.send({ ...base, op: 'result', inReplyTo: probe.op, requestId: probe.requestId, ok: true });
    await tick(40);
    t('real enable reply still reaches its callback', c.window.__widgetReplyEnableAnswers, [true]);
    t('real probe reply still reaches its callback', c.window.__widgetReplyProbeAnswers.length, 1);
    t('real probe reply retains its correlation', c.window.__widgetReplyProbeAnswers[0] && c.window.__widgetReplyProbeAnswers[0].requestId, probe.requestId);
    notes.push('REPLY_SILENCE 5 reply shapes x 3 repeats = 15 messages; active enable/status listeners; zero rearms/posts/UI/store/log changes');
  } finally {
    if (typeof stopEnable === 'function') stopEnable();
    if (typeof stopProbe === 'function') stopProbe();
  }
};
const WIDGET_RESULT = { channel: 'ezik-scheduler', v: 1, op: 'result', inReplyTo: 'widget-data', requestId: null, ok: true, stored: true, dropped: 0 };
const WIDGET_LEGACY_ERROR = { channel: 'ezik-scheduler', v: 1, op: 'error', requestId: null, ok: false, reason: 'unknown-op', received: 'widget-data' };
const soundControl = (c) => c.root.querySelector('[data-ezik-prayer-setting="adhan-sound"]');
const soundItems = (c) => c.read('ezikAdhanItems(new Date(2026,8,28))');
const rawPrayerPrefs = (c) => c.window.localStorage.getItem('ezik_prayer_prefs_v1');
async function openPrayerSettings(c) {
  c.open('home'); await c.until('home');
  const home = c.componentProps('Home');
  if (!home) throw new Error('missing Home settings fixture');
  home.onOpenSettings();
  await c.untilValue(() => !!c.root.querySelector('[data-ezik-prayer-setting="method"]'), true);
}
function hiddenSound(c, t, label) {
  t(label + ' switch hidden', !!soundControl(c), false);
  t(label + ' label hidden', c.root.textContent.includes(c.read('PRAYER_ADHAN_SOUND_LABEL')), false);
}
function preservedSound(c, t, label, saved, sounds) {
  t(label + ' preserves explicit stored sound value', JSON.parse(rawPrayerPrefs(c)).adhanSound, saved);
  t(label + ' preserves sound fields on all 35 adhan items', soundItems(c).map((it) => it.adhanSound), sounds);
}
for (const mode of ['browser', 'legacy']) SCENES['adhan-' + mode + '-hidden'] = async (c, t) => {
  await c.until('chat');
  if (mode === 'legacy') t('legacy fixture sends initial probe', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  for (const saved of [false, true]) {
    const label = mode + ' saved ' + saved;
    c.read('writePrayerPrefs({adhanSound:' + saved + ',method:"kuwait",asr:"standard",off:{fajr:2}})');
    const before = rawPrayerPrefs(c), items = soundItems(c), sounds = items.map((it) => it.adhanSound);
    t(label + ' fixture has 35 adhan items', items.length, 35);
    await openPrayerSettings(c);
    hiddenSound(c, t, label + ' before reply');
    t(label + ' hidden mount preserves raw preferences', rawPrayerPrefs(c), before);
    t(label + ' hidden mount preserves complete adhan items', soundItems(c), items);
    if (mode === 'legacy') { c.send(WIDGET_LEGACY_ERROR); await tick(100); }
    hiddenSound(c, t, label + ' after reply');
    t(label + ' reply preserves raw preferences', rawPrayerPrefs(c), before);
    t(label + ' reply preserves complete adhan items', soundItems(c), items);
    const method = Array.from(c.root.querySelectorAll('[data-ezik-prayer-setting="method"]')).find((el) => el.getAttribute('aria-checked') === 'false');
    await c.click(method);
    t(label + ' ordinary method control still works', c.read('readPrayerPrefs().method') !== 'kuwait', true);
    preservedSound(c, t, label + ' method edit', saved, sounds);
    const asr = Array.from(c.root.querySelectorAll('[data-ezik-prayer-setting="asr"]')).find((el) => el.getAttribute('aria-checked') === 'false');
    await c.click(asr);
    t(label + ' ordinary asr control still works', c.read('readPrayerPrefs().asr'), 'hanafi');
    preservedSound(c, t, label + ' asr edit', saved, sounds);
    c.open('prayer'); await c.until('prayer');
    const offsetLabel = c.read('PRAYER_LABELS.fajr + " " + PRAYER_PLUS');
    await c.click(Array.from(c.root.querySelectorAll('button')).find((el) => el.getAttribute('aria-label') === offsetLabel));
    t(label + ' ordinary offset control still works', c.read('readPrayerPrefs().off.fajr'), 3);
    preservedSound(c, t, label + ' offset edit', saved, sounds);
    const afterEdits = rawPrayerPrefs(c);
    await openPrayerSettings(c); hiddenSound(c, t, label + ' remount');
    t(label + ' remount preserves edited raw preferences', rawPrayerPrefs(c), afterEdits);
  }
};
for (const ok of [true, false]) SCENES['adhan-supported-' + ok] = async (c, t) => {
  await c.until('chat');
  t('supported ' + ok + ' fixture sends initial probe', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  for (const saved of [false, true]) {
    const label = 'supported ' + ok + ' saved ' + saved;
    c.read('writePrayerPrefs({adhanSound:' + saved + '})');
    const before = rawPrayerPrefs(c), items = soundItems(c);
    await openPrayerSettings(c);
    if (!saved) {
      hiddenSound(c, t, label + ' pending');
      c.send(ok ? WIDGET_RESULT : { channel: 'ezik-scheduler', v: 1, op: 'result', inReplyTo: 'widget-data', ok: false, reason: 'invalid-widget-data' });
    }
    t(label + ' shows switch after support, including pre-mount acknowledgement', await c.untilValue(() => !!soundControl(c), true), true);
    const control = soundControl(c);
    t(label + ' renders exact sound label', control && control.getAttribute('aria-label'), c.read('PRAYER_ADHAN_SOUND_LABEL'));
    t(label + ' displays saved switch value', control && control.getAttribute('aria-checked'), String(saved));
    t(label + ' support preserves raw preferences', rawPrayerPrefs(c), before);
    t(label + ' support preserves complete adhan items', soundItems(c), items);
  }
};
function wakeWidgetFixtures(c, value) {
  c.read('writePrayerPrefs({off:{fajr:' + value + '}})');
  c.read('writeQiblaLoc(21.4225,39.8262)');
  c.read('writeHijriOffset(1)');
  c.read('toggleAdhkarFavorite("adhkar_masaa:0")');
  for (const name of ['focus', 'pageshow', 'storage']) {
    const ev = new c.window.Event(name);
    if (name === 'storage') ev.key = null;
    c.window.dispatchEvent(ev);
  }
  c.window.document.dispatchEvent(new c.window.Event('visibilitychange'));
  c.read('EZ_LANG_SUBS.forEach((wake) => wake())');
}
SCENES['widget-legacy-session'] = async (c, t, notes) => {
  const roots = [c.mountWidgetRoot(), c.mountWidgetRoot()];
  try {
    await c.until('chat');
    t('fresh page sends its first capability probe', await c.untilValue(() => c.widgetPosts().length, 1), 1);
    wakeWidgetFixtures(c, 5); await tick(450);
    t('pending reply allows only one post across competing roots and changes', c.widgetPosts().length, 1);
    const writes = c.storageWrites.length;
    c.send(WIDGET_LEGACY_ERROR); await tick(50);
    t('legacy capability rejection is not persisted', c.storageWrites.length, writes);
    wakeWidgetFixtures(c, 7); await tick(450);
    t('legacy rejection blocks all four settings and foreground refreshes', c.widgetPosts().length, 1);
    roots.splice(0).forEach((stop) => stop());
    roots.push(c.mountWidgetRoot()); await tick(350);
    t('a remounted root remains disabled in this page', c.widgetPosts().length, 1);
    c.send(WIDGET_RESULT); wakeWidgetFixtures(c, 9); await tick(450);
    t('a late matching success cannot reenable a rejected shell', c.widgetPosts().length, 1);
    c.send({ ...WIDGET_RESULT, ok: false }); wakeWidgetFixtures(c, 11); await tick(450);
    t('a late matching failure cannot reenable a rejected shell', c.widgetPosts().length, 1);
    notes.push('SESSION_STOP delayed legacy reply; three competing roots; four writers and foreground events; remount and late success/failure remain stopped');
  } finally { roots.forEach((stop) => stop()); }
};
SCENES['widget-supported-failure'] = async (c, t) => {
  await c.until('chat');
  t('new page probes once before support is known', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  const first = JSON.parse(c.widgetPosts()[0]).data;
  for (const value of [5, 8, 11]) { c.read('writePrayerPrefs({off:{fajr:' + value + '}})'); await tick(70); }
  await tick(300);
  t('changes wait for a delayed capability reply', c.widgetPosts().length, 1);
  const writes = c.storageWrites.length;
  c.send({ ...WIDGET_RESULT, ok: false, reason: 'invalid-widget-data' });
  t('failed result still proves support and flushes one queued change', await c.untilValue(() => c.widgetPosts().length, 2), 2);
  t('capability acknowledgement is not persisted', c.storageWrites.length, writes);
  const latest = JSON.parse(c.widgetPosts().slice(-1)[0]).data;
  const mins = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  t('queued refresh uses latest offset across all 30 days', latest.prayer.days.map((day, i) =>
    (mins(day.times.fajr) - mins(first.prayer.days[i].times.fajr) + 1440) % 1440), Array(30).fill(9));
  for (let i = 0; i < 3; i++) { c.send(WIDGET_RESULT); c.send({ ...WIDGET_RESULT, ok: false }); }
  await tick(350);
  t('repeated acknowledgements without queued changes never echo', c.widgetPosts().length, 2);
  c.read('writePrayerPrefs({off:{fajr:13}})');
  t('support survives a failed result and permits later changes', await c.untilValue(() => c.widgetPosts().length, 3), 3);
  await tick(300); t('queued change leaves no duplicate send', c.widgetPosts().length, 3);
};
SCENES['widget-capability-foreign'] = async (c, t) => {
  await c.until('chat');
  t('foreign-reply fixture sends its first probe', await c.untilValue(() => c.widgetPosts().length, 1), 1);
  const messages = [
    ['wrong channel', { ...WIDGET_LEGACY_ERROR, channel: 'other' }],
    ['wrong version', { ...WIDGET_LEGACY_ERROR, v: 2 }],
    ['wrong operation', { ...WIDGET_LEGACY_ERROR, op: 'result' }],
    ['wrong reason', { ...WIDGET_LEGACY_ERROR, reason: 'invalid-data' }],
    ['wrong received operation', { ...WIDGET_LEGACY_ERROR, received: 'schedule' }],
    ['null detail', null], ['array detail', []], ['string detail', 'widget-data'],
    ['result for another operation', { ...WIDGET_RESULT, inReplyTo: 'schedule' }],
    ['result on another channel', { ...WIDGET_RESULT, channel: 'other' }],
    ['result with another version', { ...WIDGET_RESULT, v: 2 }],
  ];
  for (const [label, message] of messages) {
    c.send(message); await tick(20);
    t(label + ' leaves capability pending', c.read('ezikWidgetDataCapability'), 'pending');
  }
  c.read('writePrayerPrefs({off:{fajr:6}})'); c.send(WIDGET_RESULT);
  t('unrelated replies do not disable a later supported refresh', await c.untilValue(() => c.widgetPosts().length, 2), 2);
};
SCENES['widget-inflight-rejection'] = async (c, t) => {
  await c.until('chat');
  t('actual local widget fixtures are held during loading', await c.untilValue(() => c.heldFixtures.length >= 3, true), true);
  t('held loader has not posted yet', c.widgetPosts().length, 0);
  c.send(WIDGET_LEGACY_ERROR); c.releaseFixtures(); await tick(500);
  t('legacy rejection during awaited data load prevents an escaped post', c.widgetPosts().length, 0);
  wakeWidgetFixtures(c, 7); await tick(350);
  t('rejected in-flight sender remains stopped on later changes', c.widgetPosts().length, 0);
};
// Every needle must match exactly once; assertions execute the mutant, never recognize it.
const MUTANTS = [
  { name: 'listener-in-effect', scene: 'cold-mushaf', edits: [
    ['(function ezikWidgetListen() {', 'const ezikWidgetListenLate = (function ezikWidgetListen() {'],
    ['  } catch (e) {}\n})();\n\n// The bridge, or null.', '  } catch (e) {}\n});\n\n// The bridge, or null.'],
    ['  const [homeEpoch, setHomeEpoch] = useState(0);\n', '  const [homeEpoch, setHomeEpoch] = useState(0);\n  useEffect(() => { ezikWidgetListenLate(); }, []);\n']] },
  { name: 'no-onboarding-drop', scene: 'onboarding', edits: [["    if (cur === 'onboarding') return;", '']] },
  { name: 'applies-during-loading', scene: 'onboarding', edits: [["    if (cur === 'loading') return;\n    const requested = ezikWidgetTake();", '    const requested = ezikWidgetTake();']] },
  { name: 'no-home-remount', scene: 'warm-home', edits: [["onOpenTafsir={() => setScreen('ayah-tafsir')} key={homeEpoch} />", "onOpenTafsir={() => setScreen('ayah-tafsir')} />"]] },
  { name: 'any-route', scene: 'foreign', edits: [["if (typeof d.route !== 'string' || EZIK_WIDGET_ROUTES.indexOf(d.route) === -1) return;", "if (typeof d.route !== 'string' || !d.route) return;"]] },
  { name: 'any-op', scene: 'foreign', edits: [[' || d.op !== SHELL_SCHED_OPEN_OP) return;', ') return;']] },
  { name: 'asmaa-not-opened', scene: 'cold-asmaa', edits: [["    setAsmaaOpen(route === 'asmaa');", '    setAsmaaOpen(false);']] },
  { name: 'sunan-not-opened', scene: 'cold-sunan-day', edits: [["    setSunanOpen(route === 'sunan-day');", '    setSunanOpen(false);']] },
  { name: 'top-layer-left-open', scene: 'top-layer', edits: [["    setAsmaaOpen(route === 'asmaa');", "    if (route === 'asmaa') setAsmaaOpen(true);"]] },
  { name: 'treasure-wrong-page', scene: 'cold-treasure', edits: [["      window.location.href = '/quest.html';", "      window.location.href = '/wrong.html';"]] },
  { name: 'adhkar-index-not-reset', scene: 'list-reset', edits: [['<AdhkarScreen onBack={goEzikBack} key={homeEpoch} />', '<AdhkarScreen onBack={goEzikBack} />']] },
  { name: 'arbaeen-list-not-reset', scene: 'list-reset', edits: [['<ArbaeenScreen onBack={goEzikBack} key={homeEpoch} />', '<ArbaeenScreen onBack={goEzikBack} />']] },
  { name: 'chat-thread-not-new', scene: 'chat-reset', edits: [["      newChat();\n      setScreen('chat');", "      setScreen('chat');"]] },
  { name: 'chat-focus-missing', scene: 'chat-consent', edits: [['    el.focus();\n    widgetChatFocusRef.current = false;', '    widgetChatFocusRef.current = false;']] },
  { name: 'adhan-sound-missing', scene: 'adhan', edits: [["        adhanSound: prefs.adhanSound ? (k === 'fajr' ? 'fajr' : 'other') : 'none',\n", '']] },
  { name: 'adhan-whitelist-drops-sound', scene: 'adhan', edits: [['    if (type === ADHAN_TYPE) rec.adhanSound = it.adhanSound;\n', '']] },
  { name: 'adhan-missing-sound-accepted', scene: 'adhan', edits: [["    if (type === ADHAN_TYPE && ['fajr', 'other', 'none'].indexOf(it.adhanSound) === -1) {", '    if (false) {']] },
  { name: 'widget-browser-leak', scene: 'no-shell', edits: [["  const b = window.ReactNativeWebView;\n  if (!b || typeof b.postMessage !== 'function') return null;\n  return b;\n}\n\n// A DESTINATION", "  const b = window.ReactNativeWebView || { postMessage: window.postMessage };\n  if (!b || typeof b.postMessage !== 'function') return null;\n  return b;\n}\n\n// A DESTINATION"]] },
  { name: 'widget-boot-send-missing', scene: 'widget-data', edits: [['    EZ_LANG_SUBS.add(wake);\n    wake();\n    atMidnight();', '    EZ_LANG_SUBS.add(wake);\n    atMidnight();']] },
  { name: 'widget-not-debounced', scene: 'widget-data', edits: [['const EZIK_WIDGET_DATA_DEBOUNCE_MS = 200;', 'const EZIK_WIDGET_DATA_DEBOUNCE_MS = 0;']] },
  { name: 'widget-day-window-short', scene: 'widget-data', edits: [['const EZIK_WIDGET_DATA_DAYS = 30;', 'const EZIK_WIDGET_DATA_DAYS = 29;']] },
  { name: 'widget-local-change-ignored', scene: 'widget-data', edits: [['    window.addEventListener(EZIK_WIDGET_DATA_EVENT, wake);', '']] },
  { name: 'widget-reply-consumes-enable', scene: 'widget-reply-silence', edits: [
    ['  if (detail.inReplyTo !== SHELL_SCHED_ENABLE_OP) return null;\n', '']] },
  { name: 'widget-reply-consumes-probe', scene: 'widget-reply-silence', edits: [
    ['  if (detail.inReplyTo !== op) return null;\n', '']] },
  { name: 'widget-reply-rearms-schedule', scene: 'widget-reply-silence', edits: [
    ['      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;',
      '      if (d.channel !== SHELL_SCHED_CHANNEL || (d.op !== SHELL_SCHED_REARM_OP && d.op !== SHELL_SCHED_RESULT_OP)) return;']] },
  { name: 'widget-reply-logs-repeatedly', scene: 'widget-reply-silence', edits: [
    ['      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;',
      "      if (d.inReplyTo === 'widget-data' || d.received === 'widget-data') console.warn('widget reply');\n      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;"]] },
  { name: 'widget-reply-opens-ui', scene: 'widget-reply-silence', edits: [
    ["      if (d.channel !== SHELL_SCHED_CHANNEL || d.v !== SHELL_SCHED_VERSION || d.op !== SHELL_SCHED_OPEN_OP) return;",
      "      if (d.inReplyTo === 'widget-data') { EZIK_WIDGET_PENDING = 'prayer'; EZIK_WIDGET_SUBS.forEach((f) => f()); return; }\n      if (d.channel !== SHELL_SCHED_CHANNEL || d.v !== SHELL_SCHED_VERSION || d.op !== SHELL_SCHED_OPEN_OP) return;"]] },
  { name: 'legacy-widget-reply-rearms-schedule', scene: 'widget-reply-silence', edits: [
    ['      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;',
      "      if (d.channel !== SHELL_SCHED_CHANNEL || (d.op !== SHELL_SCHED_REARM_OP && !(d.op === 'error' && d.reason === 'unknown-op' && d.received === 'widget-data'))) return;"]] },
  { name: 'legacy-widget-reply-logs-repeatedly', scene: 'widget-reply-silence', edits: [
    ['      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;',
      "      if (d.op === 'error' && d.received === 'widget-data') console.warn('legacy widget reply');\n      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;"]] },
  { name: 'legacy-widget-reply-opens-ui', scene: 'widget-reply-silence', edits: [
    ['      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;',
      "      if (d.op === 'error' && d.reason === 'unknown-op' && d.received === 'widget-data') window.alert('widget reply');\n      if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;"]] },
  { name: 'widget-disabled-latch-missing', scene: 'widget-legacy-session', edits: [
    ["        ezikWidgetDataCapability = 'disabled';\n", '']] },
  { name: 'widget-pending-reservation-missing', scene: 'widget-legacy-session', edits: [
    ["          if (ezikWidgetDataCapability === 'unknown') ezikWidgetDataCapability = 'pending';\n", '']] },
  { name: 'widget-postawait-gate-missing', scene: 'widget-inflight-rejection', edits: [
    ['          if (stopped || mine !== generation || !canSend()) return;', '          if (stopped || mine !== generation) return;']] },
  { name: 'widget-error-match-too-broad', scene: 'widget-capability-foreign', edits: [
    ["      if (d.op === 'error' && d.reason === 'unknown-op' && d.received === 'widget-data') {", "      if (d.op === 'error') {"]] },
  { name: 'widget-version-check-missing', scene: 'widget-capability-foreign', edits: [
    ["      if (!d || typeof d !== 'object' || Array.isArray(d)) return;\n      if (d.channel !== SHELL_SCHED_CHANNEL || d.v !== SHELL_SCHED_VERSION) return;",
      "      if (!d || typeof d !== 'object' || Array.isArray(d)) return;\n      if (d.channel !== SHELL_SCHED_CHANNEL) return;"]] },
  { name: 'widget-failure-ack-ignored', scene: 'widget-supported-failure', edits: [
    ["      ezikWidgetDataCapability = 'supported';", "      if (d.ok !== true) return;\n      ezikWidgetDataCapability = 'supported';"]] },
  { name: 'widget-deferred-changes-lost', scene: 'widget-supported-failure', edits: [
    ['      waiting.forEach((wake) => { try { wake(); } catch (e) {} });', '']] },
  { name: 'widget-late-ack-reenables', scene: 'widget-legacy-session', edits: [
    ["      if (ezikWidgetDataCapability !== 'pending' || d.op !== SHELL_SCHED_RESULT_OP", '      if (d.op !== SHELL_SCHED_RESULT_OP']] },
  { name: 'sound-browser-incorrectly-shown', scene: 'adhan-browser-hidden', edits: [
    ['      {widgetDataSupported && ezikSchedBridge() ? <>', '      {true ? <>']] },
  { name: 'sound-legacy-incorrectly-shown', scene: 'adhan-legacy-hidden', edits: [
    ["    const sync = () => setWidgetDataSupported(ezikWidgetDataCapability === 'supported');", "    const sync = () => setWidgetDataSupported(ezikWidgetDataCapability === 'supported' || ezikWidgetDataCapability === 'disabled');"]] },
  { name: 'sound-supported-success-hidden', scene: 'adhan-supported-true', edits: [
    ['      {widgetDataSupported && ezikSchedBridge() ? <>', '      {false ? <>']] },
  { name: 'sound-supported-failure-hidden', scene: 'adhan-supported-false', edits: [
    ['      {widgetDataSupported && ezikSchedBridge() ? <>', '      {false ? <>']] },
  { name: 'sound-hidden-saved-value-changed', scene: 'adhan-browser-hidden', edits: [
    ["    const sync = () => setWidgetDataSupported(ezikWidgetDataCapability === 'supported');", "    const sync = () => { if (ezikWidgetDataCapability !== 'supported') writePrayerPrefs({adhanSound:!readPrayerPrefs().adhanSound}); setWidgetDataSupported(ezikWidgetDataCapability === 'supported'); };"]] },
  { name: 'sound-reply-subscription-missing', scene: 'adhan-supported-true', edits: [
    ['    window.addEventListener(SHELL_SCHED_CHANNEL, sync);\n', '']] },
  { name: 'sound-premount-support-lost', scene: 'adhan-supported-false', edits: [
    ["  const [widgetDataSupported, setWidgetDataSupported] = useState(() => ezikWidgetDataCapability === 'supported');", '  const [widgetDataSupported, setWidgetDataSupported] = useState(false);'],
    ['    window.addEventListener(SHELL_SCHED_CHANNEL, sync);\n    sync();', '    window.addEventListener(SHELL_SCHED_CHANNEL, sync);']] },
];
for (const route of ROUTES) MUTANTS.push({ name: 'route-dropped-' + route, scene: 'cold-' + route,
  edits: [['      EZIK_WIDGET_PENDING = d.route;', '      if (d.route === ' + JSON.stringify(route) + ') return;\n      EZIK_WIDGET_PENDING = d.route;']] });
async function runScene(name, mutant) {
  const results = [], notes = [];
  const t = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    const result = { label, ok };
    if (!ok) {
      result.got = typeof got === 'object' ? JSON.stringify(got).slice(0,250) : got;
      result.want = typeof want === 'object' ? JSON.stringify(want).slice(0,250) : want;
    }
    results.push(result);
    // One failed assertion already kills a mutant. Avoid waiting for every later timeout.
    if (mutant && !ok) throw new Error('mutation assertion failed: ' + label);
  };
  const c = boot({ profile: name !== 'onboarding', consent: name !== 'chat-consent',
    shell: name.startsWith('widget-') || name === 'adhan' || name === 'adhan-legacy-hidden' || name.startsWith('adhan-supported-'),
    deferFixtures: name === 'widget-inflight-rejection', offline: name === 'offline', mutant });
  if (c.notApplied) return { notApplied: true, results, notes };
  try { await SCENES[name](c, t, notes); } catch (e) { results.push({ label: 'scene threw: ' + String(e && e.message), ok: false }); }
  if (c.caught()) results.push({ label: 'runtime error: ' + String(c.caught()), ok: false });
  return { results, notes };
}
function spawnScene(name, mutant) {
  return new Promise((resolve) => {
    const args = [__filename, '--scene', name].concat(SOURCE_MODE ? ['--source'] : [], mutant ? ['--mutant', mutant] : []);
    const child = spawn(process.execPath, args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '';
    child.stdout.on('data', (b) => { out += b; }); child.stderr.on('data', (b) => { out += b; });
    const deadline = NODE_TICK(() => child.kill(), 90000);
    child.on('error', (error) => { clearTimeout(deadline); resolve({ crashed: error.message, results: [] }); });
    child.on('close', () => {
      clearTimeout(deadline); const line = out.split(/\r?\n/).find((l) => l.startsWith('WIDGET45-RESULT '));
      if (!line) return resolve({ crashed: out.slice(-600), results: [] });
      try { resolve(JSON.parse(line.slice('WIDGET45-RESULT '.length))); } catch (_) { resolve({ crashed: 'unparseable result', results: [] }); }
    });
  });
}
async function pool(jobs, width) {
  const out = new Array(jobs.length); let next = 0;
  const lane = async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); } };
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, lane)); return out;
}
function staticChecks() {
  const src = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8').replace(/\r\n?/g, '\n');
  const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));
  const ast = parser.parse(src, { sourceType: 'script', plugins: ['jsx'] }); let routes = null;
  for (const n of ast.program.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.name === 'EZIK_WIDGET_ROUTES') routes = d.init.elements.map((x) => x.value);
  const a = src.indexOf('// ===== ITEM 45 -- THE WIDGET'), b = src.indexOf('}, [screen, widgetSeq]);', a); const consumer = src.slice(a,b);
  return [
    ['C1 exact independent 20-route whitelist', JSON.stringify(routes) === JSON.stringify(ROUTES)],
    ['normal routes use resume writer and both boot tools', ['ezikWriteResume(route);','ezikResumeMarkEntered(ezikReadResume());','const next = ezikResumeScreen();','setScreen(next);'].every((s) => consumer.includes(s))],
    ['chat focus waits for SpendGate and consent', src.includes("if (!widgetChatFocusRef.current || screen !== 'chat' || !spendGateOpenState\n      || aiConsent !== EZ_AI_CONSENT_GRANTED || aiConsentReview) return;")],
    ['boot keeps the resume path', src.includes('        ezikResumeMarkEntered(ezikReadResume());\n        setScreen(ezikResumeScreen());')],
    ['rearm handler stays independent', src.includes('if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;')],
  ];
}
async function main() {
  let passes = 0, fails = 0;
  const report = (label, ok, extra) => { if (ok) passes++; else fails++; say((ok ? 'PASS ' : 'FAIL ') + label + (extra ? '  ' + extra : '')); };
  for (const [label, ok] of staticChecks()) report(label,ok);
  const names = Object.keys(SCENES);
  const jobs = names.map((name) => () => spawnScene(name)).concat(MUTANTS.map((m) => () => spawnScene(m.scene,m.name)));
  const all = await pool(jobs,4);
  names.forEach((name,i) => {
    const r = all[i]; if (r.crashed) return report('scene ' + name + ' ran',false,r.crashed);
    for (const x of r.results) report('[' + name + '] ' + x.label,x.ok,x.ok ? '' : 'got=' + JSON.stringify(x.got) + ' want=' + JSON.stringify(x.want));
    for (const note of r.notes || []) say(note);
  });
  MUTANTS.forEach((m,i) => {
    const r = all[names.length+i];
    if (r.notApplied) return report('MUTANT ' + m.name + ' edit applies',false,'needle not found exactly once');
    if (r.crashed) return report('MUTANT ' + m.name + ' ran',false,r.crashed);
    const failed = r.results.filter((x) => !x.ok && !/^(scene threw:|runtime error:)/.test(x.label));
    const exceptions = r.results.filter((x) => !x.ok && /^(scene threw:|runtime error:)/.test(x.label));
    report('MUTANT KILLED ' + m.name,failed.length>0,failed.length ? failed.slice(0,2).map((x) => x.label).join(' | ')
      : exceptions.length ? 'exception-only failure: ' + exceptions.map((x) => x.label).join(' | ') : 'no assertion failed');
  });
  say('widget-open-guard: PASS=' + passes + ' FAIL=' + fails + ' SCENES=' + names.length + ' MUTANTS=' + MUTANTS.length + ' MODE=' + (SOURCE_MODE?'source':'shipped'));
  process.exit(fails?1:0);
}
if (process.argv.includes('--scene')) {
  const name = process.argv[process.argv.indexOf('--scene')+1], mi = process.argv.indexOf('--mutant');
  runScene(name,mi===-1?null:process.argv[mi+1]).then((r) => { say('WIDGET45-RESULT ' + JSON.stringify(r)); process.exit(0); },
    (error) => { say('WIDGET45-RESULT ' + JSON.stringify({ crashed: String(error && error.stack || error), results: [] })); process.exit(0); });
} else main().catch((error) => { say(String(error && error.stack || error)); process.exit(1); });
