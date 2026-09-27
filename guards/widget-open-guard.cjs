// guards/widget-open-guard.cjs -- ITEM 45, the web half: the widget's press reaches its section.
//
// WHAT IS PROVED, AND ON WHAT. The shell (murabbi-shell, feat/item45-widget-20260915 at 399f8e6)
// turns a widget tap into ezik://open?route=<VALUE> and hands the page, through deliverOpen, ONE
// CustomEvent('ezik-scheduler') whose detail is
//   { channel: 'ezik-scheduler', v: 1, op: 'open', route, type: null, id: null }
// This guard throws exactly that event -- built the way the shell's buildReplyInjection builds it,
// JSON through CustomEvent on window -- into the SHIPPED app.js, mounted whole under node on
// linkedom the way runtime-gate.cjs mounts it, and reads where the reader is standing afterwards.
//
//   A  cold    the press arrives before React's first commit and still lands on its section
//   B  warm    from any screen the app switches to the section
//   C  layers  prayer and wirdi open over the home, and a back from them returns to the home
//   D  top     a layer App draws in front of every screen (الأسماء) is put away, not landed behind
//   E  new     a reader in onboarding is not interrupted and nothing is written to the ledger
//   F  twice   two presses in a row end on the last one
//   G  foreign any other route, op, version or channel changes nothing; `rearm-request` still arms
//   H  offline every scene runs with every fetch rejecting
//
// EACH SCENE IS ITS OWN PROCESS. Two linkedom windows in one process share React's module state
// and cross-talk, so the parent spawns this same file once per scene and reads one result line.
//
// AND THE PROOF IS SHOWN TO BE ABLE TO FAIL. Each MUTANT below is the application source with one
// named edit, compiled through tools/babel-block.cjs exactly as build-app compiles it, and driven
// through the scene that defends the rule it breaks. A mutant whose edit does not apply is itself
// a failure, so a stale needle cannot turn into a silent pass.
//
// The terminal gets ASCII only; the section titles are read out of the application at runtime.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const NODE_TICK = setTimeout;
const tick = (ms) => new Promise((r) => NODE_TICK(r, ms == null ? 40 : ms));

const PROFILE_PID = 'W45-GUARD';
const PROFILE = JSON.stringify({ name: 'Noor', age: 30, gender: 'male', birthYear: 1996, pid: PROFILE_PID, createdAt: '2026-01-01T00:00:00.000Z' });
const LEDGER = 'ezik_resume_section_v1';
// The mushaf's own shell title is a literal inside MushafScreen, not a named constant.
const MUSHAF_TITLE = 'المصحف';

/* ============================== THE CHILD: ONE SCENE ============================== */

function makeStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: (i) => Array.from(m.keys())[i] || null,
    get length() { return m.size; },
  };
}

function compile(mutantName) {
  if (!mutantName) return { code: fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'), applied: true };
  const BB = require(path.join(REPO, 'tools', 'babel-block.cjs'));
  const block = BB.readBabelBlock();
  const raw = block.raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const mut = MUTANTS.find((m) => m.name === mutantName);
  let out = raw;
  for (const [from, to] of mut.edits) {
    const at = out.indexOf(from);
    if (at === -1 || out.indexOf(from, at + 1) !== -1) return { code: '', applied: false };
    out = out.slice(0, at) + to + out.slice(at + from.length);
  }
  const code = BB.transformBabelBlock({ raw: out, runtime: block.runtime }, { retainLines: false, configFile: false, babelrc: false });
  return { code, applied: out !== raw };
}

function boot(opts) {
  const { parseHTML } = require(path.join(REPO, 'node_modules', 'linkedom'));
  const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
  window.self = window; window.window = window; window.globalThis = window;
  window.matchMedia = (q) => ({ matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.alert = () => {}; window.confirm = () => true;
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  const seed = {};
  if (opts.profile) {
    seed.child_profile = PROFILE;
    seed.ezik_ai_consent_v1 = JSON.stringify({ status: 'granted', version: '2026-08-06-1', pid: PROFILE_PID, grantedBy: 'user', at: '2026-08-06T00:00:00.000Z' });
  }
  window.localStorage = makeStore(seed);
  window.sessionStorage = makeStore({});
  // H: OFFLINE. Every request the application makes in any scene is refused.
  window.fetch = () => Promise.reject(new TypeError('offline'));
  const entries = [{}]; let at = 0;
  window.history = {
    get length() { return entries.length; }, get state() { return entries[at]; },
    pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
    replaceState: (st) => { entries[at] = st; },
    back: () => { if (at <= 0) return; at--; NODE_TICK(() => { try { window.dispatchEvent(new window.Event('popstate')); } catch (e) {} }, 0); },
  };
  global.window = window; global.document = window.document;
  try { Object.defineProperty(global, 'navigator', { configurable: true, value: window.navigator }); } catch (e) {}

  const ctx = vm.createContext(window);
  for (const f of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  }
  let caught = null;
  window.addEventListener('error', (ev) => { caught = caught || (ev && (ev.error || ev.message)); });
  window.console.error = () => {};
  const built = compile(opts.mutant);
  if (!built.applied) return { notApplied: true };
  vm.runInContext(built.code, ctx, { filename: 'app.js' });

  const grab = (expr) => { try { return vm.runInContext('(' + expr + ')', ctx); } catch (e) { return undefined; } };
  const root = window.document.getElementById('root');
  const titles = {
    prayer: grab('PRAYER_SHEET_TITLE'),
    wirdi: grab('DW_CARD_TITLE'),
    asmaa: grab("ezT('asmaa.title')"),
    mushaf: MUSHAF_TITLE,
  };
  const where = () => {
    const top = root.firstElementChild;
    const cls = top ? String(top.getAttribute('class') || '') : '';
    if (/\bezonb\b/.test(cls)) return 'onboarding';
    if (/\bezgate\b/.test(cls)) return 'gate';
    if (/\badhkar3\b/.test(cls)) return 'adhkar';
    if (root.querySelector('.ezc-rail')) return 'chat';
    if (root.querySelector('[data-ezik-home-module]')) return 'home';
    const brand = root.querySelector('.ezsh-brand');
    const spans = brand ? brand.querySelectorAll('span') : [];
    const t = spans.length ? String(spans[spans.length - 1].textContent || '').trim() : '';
    for (const k of Object.keys(titles)) if (titles[k] && t === titles[k]) return k;
    return 'other';
  };
  const send = (detail) => {
    // The shell's injection, reproduced: JSON parsed in the page, then one CustomEvent on window.
    vm.runInContext('(function(){try{var d=JSON.parse(' + JSON.stringify(JSON.stringify(detail)) +
      ');window.dispatchEvent(new CustomEvent("ezik-scheduler",{detail:d}));}catch(e){}})();', ctx);
  };
  const open = (route) => send({ channel: 'ezik-scheduler', v: 1, op: 'open', route: route, type: null, id: null });
  const ledger = () => window.sessionStorage.getItem(LEDGER);
  const pending = () => grab('EZIK_WIDGET_PENDING');
  // Wait for a place, polling, so a slow machine is waited for rather than misread.
  const until = async (want, cap) => {
    const end = Date.now() + (cap || 5000);
    for (;;) {
      if (where() === want) { await tick(60); return where(); }
      if (Date.now() > end) return where();
      await tick(30);
    }
  };
  // Wait until nothing is held any more and React has had its turns -- the moment a press that
  // WAS going to move the app has already moved it.
  const quiet = async () => {
    const end = Date.now() + 5000;
    while (pending() && Date.now() < end) await tick(30);
    await tick(250);
  };
  const click = async (el) => { el.dispatchEvent(new window.Event('click', { bubbles: true })); await tick(80); };
  const back = async () => { window.history.back(); await tick(200); };
  return { window, root, where, send, open, ledger, pending, until, quiet, click, back, grab, caught: () => caught };
}

const SCENES = {
  // A: the press is thrown before React's first commit -- the listener must already be there.
  'cold-mushaf': async (c, t) => {
    c.open('mushaf');
    t('A cold mushaf lands on the mushaf', await c.until('mushaf'), 'mushaf');
    t('A ...and the ledger names it', c.ledger(), 'mushaf');
  },
  'cold-adhkar': async (c, t) => {
    c.open('adhkar');
    t('A cold adhkar lands on the adhkar', await c.until('adhkar'), 'adhkar');
  },
  'cold-prayer': async (c, t) => {
    c.open('prayer');
    t('A cold prayer opens the prayer sheet', await c.until('prayer'), 'prayer');
    t('A ...and the ledger holds it while it is open', c.ledger(), 'prayer');
    await c.back();
    t('C back from prayer lands on the home', await c.until('home'), 'home');
    t('C ...and the home cleared the ledger', c.ledger(), null);
  },
  'cold-wirdi': async (c, t) => {
    c.open('wirdi');
    t('A cold wirdi opens the wird section', await c.until('wirdi'), 'wirdi');
    t('C ...and the ledger holds it while it is open', c.ledger(), 'wirdi');
    await c.back();
    t('C back from wirdi lands on the home', await c.until('home'), 'home');
    t('C ...and the home cleared the ledger', c.ledger(), null);
  },
  // B: already running, from several different screens.
  'warm-switch': async (c, t) => {
    t('B the boot lands on the chat', await c.until('chat'), 'chat');
    c.open('adhkar');
    t('B chat -> adhkar', await c.until('adhkar'), 'adhkar');
    c.open('mushaf');
    t('B adhkar -> mushaf', await c.until('mushaf'), 'mushaf');
    c.open('prayer');
    t('B mushaf -> prayer', await c.until('prayer'), 'prayer');
    c.open('wirdi');
    t('B prayer (a home layer) -> wirdi', await c.until('wirdi'), 'wirdi');
    c.open('mushaf');
    t('B wirdi -> mushaf', await c.until('mushaf'), 'mushaf');
  },
  // C + section 4-4: the home is ALREADY mounted and bare when the press for one of its layers comes.
  'warm-home': async (c, t) => {
    t('C the boot lands on the chat', await c.until('chat'), 'chat');
    c.open('prayer');
    t('C chat -> prayer', await c.until('prayer'), 'prayer');
    await c.back();
    t('C back -> home', await c.until('home'), 'home');
    c.open('prayer');
    t('C prayer over a home that is already standing', await c.until('prayer'), 'prayer');
    await c.back();
    t('C back -> home again', await c.until('home'), 'home');
    c.open('wirdi');
    t('C wirdi over a home that is already standing', await c.until('wirdi'), 'wirdi');
    t('C ...and the ledger holds it', c.ledger(), 'wirdi');
    await c.back();
    t('C back from wirdi -> home', await c.until('home'), 'home');
    t('C ...and nothing is left in the ledger', c.ledger(), null);
  },
  // D: a layer App draws in front of every screen.
  'top-layer': async (c, t) => {
    t('D the boot lands on the chat', await c.until('chat'), 'chat');
    c.open('prayer');
    await c.until('prayer');
    await c.back();
    t('D on the home', await c.until('home'), 'home');
    const tile = c.root.querySelector('[data-ezik-home-module="asmaa"]');
    t('D the asmaa tile exists', !!tile, true);
    if (tile) await c.click(tile);
    t('D asmaa stands in front', await c.until('asmaa'), 'asmaa');
    c.open('adhkar');
    t('D the press is not landed behind asmaa', await c.until('adhkar'), 'adhkar');
    c.open('prayer');
    t('D ...and asmaa does not come back over the home', await c.until('prayer'), 'prayer');
  },
  // E: a new reader.
  'onboarding': async (c, t) => {
    c.open('mushaf');
    t('E cold press on a new reader stays on onboarding', await c.until('onboarding'), 'onboarding');
    await c.quiet();
    t('E ...still onboarding once everything settled', c.where(), 'onboarding');
    t('E ...nothing written to the ledger', c.ledger(), null);
    t('E ...and the press is dropped, not held for later', c.pending(), '');
    c.open('prayer');
    await c.quiet();
    t('E warm press during onboarding changes nothing', c.where(), 'onboarding');
    t('E ...nothing written to the ledger', c.ledger(), null);
    t('E ...and it is dropped too', c.pending(), '');
  },
  // F: two presses.
  'twice': async (c, t) => {
    c.open('mushaf'); c.open('prayer');
    t('F two presses before the first commit end on the last', await c.until('prayer'), 'prayer');
    c.open('mushaf'); c.open('adhkar');
    t('F two presses in one turn end on the last', await c.until('adhkar'), 'adhkar');
    c.open('mushaf');
    await c.until('mushaf');
    c.open('prayer');
    t('F mushaf then prayer, one after the other, ends on prayer', await c.until('prayer'), 'prayer');
  },
  // G: everything that is not ours.
  'foreign': async (c, t) => {
    t('G the boot lands on the chat', await c.until('chat'), 'chat');
    const base = { channel: 'ezik-scheduler', v: 1, op: 'open', route: 'mushaf', type: null, id: null };
    const bad = [
      ['a fifth route (fatwa)', Object.assign({}, base, { route: 'fatwa' })],
      ['the home', Object.assign({}, base, { route: 'home' })],
      ['asmaa', Object.assign({}, base, { route: 'asmaa' })],
      ['a translated spelling', Object.assign({}, base, { route: 'Mushaf' })],
      ['a prototype key', Object.assign({}, base, { route: 'constructor' })],
      ['an empty route', Object.assign({}, base, { route: '' })],
      ['a non-string route', Object.assign({}, base, { route: 1 })],
      ['op schedule', Object.assign({}, base, { op: 'schedule' })],
      ['op result', Object.assign({}, base, { op: 'result' })],
      ['op status', Object.assign({}, base, { op: 'status' })],
      ['op enable', Object.assign({}, base, { op: 'enable' })],
      ['another version', Object.assign({}, base, { v: 2 })],
      ['another channel', Object.assign({}, base, { channel: 'ezik-other' })],
    ];
    for (const [label, d] of bad) {
      c.send(d);
      await c.quiet();
      t('G ' + label + ' is ignored', c.where(), 'chat');
    }
    t('G ...and nothing reached the ledger', c.ledger(), null);
    // rearm-request keeps its behaviour, and open does not borrow it.
    const posts = [];
    c.window.ReactNativeWebView = { postMessage: (m) => { posts.push(String(m)); } };
    c.grab('ezikSchedLastSent = SHELL_SCHED_EMPTY');
    c.send({ channel: 'ezik-scheduler', v: 1, op: 'rearm-request', route: 'mushaf', type: null, id: null });
    await c.quiet();
    t('G rearm-request still arms the schedule (one post)', posts.length, 1);
    t('G ...and does not navigate', c.where(), 'chat');
    c.grab('ezikSchedLastSent = SHELL_SCHED_EMPTY');
    c.open('mushaf');
    t('G open still navigates with a bridge present', await c.until('mushaf'), 'mushaf');
    t('G ...and open is not a rearm (no post)', posts.length, 1);
  },
};

async function runScene(name, mutant) {
  const results = [];
  const t = (label, got, want) => results.push({ label, ok: got === want, got: got === undefined ? 'undefined' : got, want });
  const c = boot({ profile: name !== 'onboarding', mutant });
  if (c.notApplied) return { notApplied: true, results };
  try { await SCENES[name](c, t); } catch (e) { results.push({ label: 'scene threw: ' + String(e && e.message), ok: false }); }
  const err = c.caught();
  if (err) results.push({ label: 'runtime error: ' + String(err && err.message || err).slice(0, 200), ok: false });
  return { results };
}

/* ============================== THE MUTANTS ============================== */

const MUTANTS = [
  {
    name: 'listener-in-effect', scene: 'cold-mushaf', rule: '4-1 the listener is attached at file level',
    edits: [
      ['(function ezikWidgetListen() {', 'const ezikWidgetListenLate = (function ezikWidgetListen() {'],
      ['  } catch (e) {}\n})();\n\n// The bridge, or null.', '  } catch (e) {}\n});\n\n// The bridge, or null.'],
      ['  const [homeEpoch, setHomeEpoch] = useState(0);\n', '  const [homeEpoch, setHomeEpoch] = useState(0);\n  useEffect(() => { ezikWidgetListenLate(); }, []);\n'],
    ],
  },
  { name: 'no-onboarding-drop', scene: 'onboarding', rule: 'E onboarding drops the press',
    edits: [["    if (cur === 'onboarding') return;\n    ezikWriteResume(route);", '    ezikWriteResume(route);']] },
  { name: 'applies-during-loading', scene: 'onboarding', rule: '4-2 nothing is applied over loading',
    edits: [["    if (cur === 'loading') return;\n    const route = ezikWidgetTake();", '    const route = ezikWidgetTake();']] },
  { name: 'no-home-remount', scene: 'warm-home', rule: '4-4 a standing home opens the layer',
    edits: [[" key={homeEpoch} />", ' />']] },
  { name: 'wird-not-restored', scene: 'cold-wirdi', rule: '4-3 wirdOpen restores from the ledger',
    edits: [["useState(() => ezikReadResume() === 'wirdi')", 'useState(false)']] },
  { name: 'wird-not-in-clear-guard', scene: 'cold-wirdi', rule: '4-3 the clear guard knows wirdOpen',
    edits: [['calcOpen || wirdPickOpen || wirdOpen) return;', 'calcOpen || wirdPickOpen) return;']] },
  { name: 'top-layer-left-open', scene: 'top-layer', rule: 'D App layers are put away',
    edits: [['    ezikWriteResume(route);\n    setAsmaaOpen(false);\n', '    ezikWriteResume(route);\n']] },
  { name: 'any-route', scene: 'foreign', rule: 'G only the four routes',
    edits: [["if (typeof d.route !== 'string' || EZIK_WIDGET_ROUTES.indexOf(d.route) === -1) return;", "if (typeof d.route !== 'string' || !d.route) return;"]] },
  { name: 'any-op', scene: 'foreign', rule: 'G only op open',
    edits: [[' || d.op !== SHELL_SCHED_OPEN_OP) return;', ') return;']] },
];

/* ============================== THE PARENT ============================== */

function spawnScene(name, mutant) {
  return new Promise((resolve) => {
    const args = [__filename, '--scene', name].concat(mutant ? ['--mutant', mutant] : []);
    const p = spawn(process.execPath, args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (b) => { out += b; });
    p.stderr.on('data', (b) => { out += b; });
    const kill = NODE_TICK(() => { try { p.kill(); } catch (e) {} }, 90000);
    p.on('close', () => {
      clearTimeout(kill);
      const line = out.split(/\r?\n/).find((l) => l.startsWith('WIDGET45-RESULT '));
      if (!line) return resolve({ crashed: out.slice(-600), results: [] });
      try { resolve(JSON.parse(line.slice('WIDGET45-RESULT '.length))); } catch (e) { resolve({ crashed: 'unparseable result', results: [] }); }
    });
  });
}

async function pool(jobs, width) {
  const out = new Array(jobs.length);
  let next = 0;
  const lane = async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); } };
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, lane));
  return out;
}

function staticChecks() {
  const src = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8').replace(/\r\n/g, '\n');
  const res = [];
  const ok = (label, cond) => res.push({ label, ok: !!cond });
  const a = src.indexOf("const SHELL_SCHED_OPEN_OP = 'open';");
  const b = src.indexOf('// The bridge, or null.', a);
  const listener = a !== -1 && b !== -1 ? src.slice(a, b) : '';
  const c0 = src.indexOf('// ===== ITEM 45 -- THE WIDGET');
  const c1 = src.indexOf('}, [screen, widgetSeq]);', c0);
  const consumer = c0 !== -1 && c1 !== -1 ? src.slice(c0, c1) : '';
  ok('S the file-level listener is present', listener.length > 0);
  ok('S the App consumer is present', consumer.length > 0);
  ok('S exactly the four routes, spelt as the shell spells them',
    listener.indexOf("const EZIK_WIDGET_ROUTES = ['mushaf', 'adhkar', 'wirdi', 'prayer'];") !== -1);
  ok('S the listener is not inside a hook', listener.length > 0 && listener.indexOf('useEffect') === -1);
  ok('S the consumer opens through the ledger and the boot tools',
    consumer.indexOf('ezikWriteResume(route);') !== -1
    && consumer.indexOf('ezikResumeMarkEntered(ezikReadResume());') !== -1
    && consumer.indexOf('const next = ezikResumeScreen();') !== -1
    && consumer.indexOf('setScreen(next);') !== -1);
  // Its own comment names the boot's setScreen line, so only code lines are counted.
  const consumerCode = consumer.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok('S the consumer sets no screen of its own choosing', (consumerCode.match(/setScreen\(/g) || []).length === 1);
  ok('H neither half touches the network',
    listener.length > 0 && consumer.length > 0 && !/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(listener + consumer));
  ok('S the boot line is unchanged',
    src.indexOf('        ezikResumeMarkEntered(ezikReadResume());\n        setScreen(ezikResumeScreen());') !== -1);
  ok('S the rearm listener still accepts rearm-request only',
    src.indexOf('if (d.channel !== SHELL_SCHED_CHANNEL || d.op !== SHELL_SCHED_REARM_OP) return;') !== -1);
  ok('S wirdi is a home layer in the ledger tables',
    src.indexOf('const EZIK_RESUME_HOME_LAYERS = { articles: 1, women: 1, prayer: 1, wirdi: 1 };') !== -1);
  return res;
}

async function main() {
  let fails = 0, passes = 0;
  const report = (label, ok, extra) => {
    if (ok) passes++; else fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + (extra ? '  ' + extra : ''));
  };
  for (const r of staticChecks()) report(r.label, r.ok);

  const sceneNames = Object.keys(SCENES);
  const jobs = sceneNames.map((n) => () => spawnScene(n, null))
    .concat(MUTANTS.map((m) => () => spawnScene(m.scene, m.name)));
  const all = await pool(jobs, 4);

  sceneNames.forEach((n, i) => {
    const r = all[i];
    if (r.crashed) { report('scene ' + n + ' ran', false, 'crashed: ' + r.crashed.replace(/[^\x20-\x7e\n]/g, '?')); return; }
    for (const x of r.results) report('[' + n + '] ' + x.label, x.ok, x.ok ? '' : 'got=' + JSON.stringify(x.got) + ' want=' + JSON.stringify(x.want));
  });
  MUTANTS.forEach((m, j) => {
    const r = all[sceneNames.length + j];
    if (r.notApplied) { report('MUTANT ' + m.name + ': its edit applies', false, 'needle not found exactly once'); return; }
    if (r.crashed) { report('MUTANT ' + m.name + ' ran', false, 'crashed: ' + r.crashed.replace(/[^\x20-\x7e\n]/g, '?')); return; }
    const killed = r.results.some((x) => !x.ok);
    const why = r.results.filter((x) => !x.ok).map((x) => x.label).slice(0, 2).join(' | ');
    report('MUTANT KILLED ' + m.name + ' (' + m.rule + ') by scene ' + m.scene, killed, killed ? '<- ' + why.replace(/[^\x20-\x7e]/g, '?') : '');
  });

  console.log('\nwidget-open-guard: PASS=' + passes + ' FAIL=' + fails);
  process.exit(fails ? 1 : 0);
}

if (process.argv[2] === '--scene') {
  const name = process.argv[3];
  const mi = process.argv.indexOf('--mutant');
  const mutant = mi !== -1 ? process.argv[mi + 1] : null;
  runScene(name, mutant).then((r) => {
    process.stdout.write('WIDGET45-RESULT ' + JSON.stringify(r) + '\n', () => process.exit(0));
  }, (e) => {
    process.stdout.write('WIDGET45-RESULT ' + JSON.stringify({ crashed: String(e && e.stack || e), results: [] }) + '\n', () => process.exit(0));
  });
} else {
  main();
}
