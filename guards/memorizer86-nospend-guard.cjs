// memorizer86-nospend-guard.cjs -- Item 86 (memorizer), decision 5: the memorizer never calls Ezik's AI brain nor
// any paid service.
//
// SCOPE. MemorizeScreen; every top-level memorizer initializer (mem86* / Mem86* / MEM86_*); and the three calls App
// hands it (onPlayVerse = playVerseManual, onPlaySurah = playSurahManual, onStopAudio = cancelAudio) -- then,
// transitively, every top-level declaration and every App-level declaration that this code names. The closure is
// computed from the parsed app.jsx (tools/babel-block.cjs, as tools/memorizer86-check.cjs reads it), not listed by
// hand, so a new helper that reaches the network is in scope the day it is called.
//
// WHAT FAILS. Inside the closure: aiFetch, EZ_AI_ENDPOINTS or any of its paths, any '/api/' string, a network
// primitive (XMLHttpRequest, WebSocket, EventSource, sendBeacon) or an import(), a fetch() whose address is not one
// of Ezik's own static files, and an absolute URL on any host but everyayah.com (the recitation audio Ezik already
// streams, QURAN_RECITER).
//
// THE NAMED EXCEPTIONS -- two, and each is not followed into by the closure above; everything else is.
//   ezNewRecognition -- the browser's own speech recognition for «سمِّعني». It is not Ezik's brain and it is not
//     paid: Web Speech is the browser's engine (Google on Chrome, Apple on Safari), already behind the voice consent
//     and the child guard, and its constructor stands on exactly three lines (gate aiconsent counts them).
//   ezEar (item 86, phase 2) -- the owner's own recitation engine, on his own computer: not Ezik's brain, not paid,
//     not a third party. It is a door to the network all the same, so it is not merely named: its own closure is
//     computed and checked whole below -- one address (http://127.0.0.1:8865) and nothing else absolute, one fetch
//     on that address, five paths of the engine's and no other, no store written, no AI door, no network primitive,
//     a microphone asked only behind the voice consent and the child guard and heard on silent speakers, the browser's
//     own answer about this computer read and never asked for (18 October) -- and five mutants of its source must each
//     be caught.
//
// No network, no audio, no microphone: this reads app.jsx and nothing else.
'use strict';

const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');

const ROOT = path.join(__dirname, '..');
const BB = require(path.join(ROOT, 'tools', 'babel-block.cjs'));
const raw = BB.readBabelBlock({ file: path.join(ROOT, 'index.html'), html: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') }).raw;
const ast = babelParser.parse(raw, { sourceType: 'script', plugins: ['jsx'] });

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('PASS ' + label); } else { fail++; console.log('FAIL ' + label); } };

const EXCEPTIONS = {
  ezNewRecognition: 'the browser speech engine of «سمِّعني» -- not Ezik\'s brain, not paid; consent-gated, three lines (gate aiconsent)',
  ezEar: 'the owner\'s own recitation engine on his own computer (item 86, phase 2) -- not Ezik\'s brain, not paid; its closure is checked whole below',
};
const APP_HANDS = ['playVerseManual', 'playSurahManual', 'cancelAudio'];
const STATIC_FETCH = /^\/[A-Za-z0-9._\-/]+\.(json|js|css|txt|html)$/; // Ezik's own static files, e.g. /mushaf-layout.json

// ---- the declarations: top level, and App's own level ----
const TOP = new Map(), APP = new Map();
const addDecls = (body, into) => {
  for (const st of body) {
    if (st.type === 'FunctionDeclaration' && st.id) into.set(st.id.name, st);
    else if (st.type === 'VariableDeclaration') for (const d of st.declarations) { if (d.id && d.id.type === 'Identifier' && d.init) into.set(d.id.name, d); }
  }
};
addDecls(ast.program.body, TOP);
const appFn = TOP.get('App');
ok(!!appFn && appFn.type === 'FunctionDeclaration', 'function App is found');
if (appFn) addDecls(appFn.body.body, APP);
ok(APP_HANDS.every((n) => APP.has(n)), 'App declares the three calls it hands the memorizer: ' + APP_HANDS.join(', '));
const mount = raw.match(/<MemorizeScreen [^>]*\/>/);
ok(!!mount && APP_HANDS.every((n) => mount[0].includes('={' + n + '}')) && (mount[0].match(/=\{/g) || []).length === 5, 'App mounts MemorizeScreen with those three calls and nothing else that acts (profile, onExit)');

// ---- the closure ----
const names = (node) => {
  const out = new Set();
  const walk = (n, parent, key) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier' || n.type === 'JSXIdentifier') {
      const isProp = parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) || (parent.type === 'ObjectProperty' && key === 'key' && !parent.computed) || parent.type === 'JSXAttribute');
      if (!isProp) out.add(n.name);
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => walk(c, n, k)); else if (v && typeof v.type === 'string') walk(v, n, k);
    }
  };
  walk(node, null, null);
  return out;
};
const scope = new Map(); // 'top:name' | 'app:name' -> node
const queue = [];
const take = (where, name) => {
  const key = where + ':' + name;
  if (scope.has(key) || EXCEPTIONS[name]) return;
  const node = (where === 'app' ? APP : TOP).get(name);
  if (!node) return;
  scope.set(key, node); queue.push([where, node]);
};
take('top', 'MemorizeScreen');
for (const n of TOP.keys()) if (/^(mem86|Mem86|MEM86_)/.test(n)) take('top', n);
for (const n of APP_HANDS) take('app', n);
const seenExceptions = new Set();
while (queue.length) {
  const [where, node] = queue.shift();
  for (const n of names(node)) {
    if (EXCEPTIONS[n]) { seenExceptions.add(n); continue; }
    if (where === 'app' && APP.has(n)) take('app', n);
    else if (TOP.has(n) && n !== 'App') take('top', n);
  }
}
const src = [...scope.values()].map((n) => raw.slice(n.start, n.end)).join('\n');
const scopeNames = [...scope.keys()];
ok(scope.has('top:MemorizeScreen') && scopeNames.filter((k) => /^top:(mem86|Mem86|MEM86_)/.test(k)).length >= 100, 'in scope: MemorizeScreen and ' + scopeNames.filter((k) => /^top:(mem86|Mem86|MEM86_)/.test(k)).length + ' memorizer initializers');
ok(APP_HANDS.every((n) => scope.has('app:' + n)) && scope.has('app:playRecitation') && scope.has('app:playRecitationUrl'), '...App\'s three calls and what they call (playRecitation, playRecitationUrl): ' + scopeNames.filter((k) => k.startsWith('app:')).length + ' App-level declarations');
console.log('INFO closure ' + scope.size + ' declarations; exceptions named and not followed: ' + ([...seenExceptions].map((n) => n + ' (' + EXCEPTIONS[n] + ')').join('; ') || 'none'));
ok(Object.keys(EXCEPTIONS).every((n) => seenExceptions.has(n)), 'each named exception is really reached (' + Object.keys(EXCEPTIONS).join(', ') + '), so it is not a dead list');

// ---- the checks ----
ok(!scope.has('top:aiFetch') && !/\baiFetch\b/.test(src), 'no aiFetch in the memorizer or anything it calls');
const endpoints = (() => { const n = TOP.get('EZ_AI_ENDPOINTS'); return n ? JSON.parse(raw.slice(n.init.start, n.init.end).replace(/'/g, '"')) : null; })();
ok(Array.isArray(endpoints) && endpoints.length >= 6, 'EZ_AI_ENDPOINTS read from app.jsx: ' + (endpoints || []).join(' '));
ok(!scope.has('top:EZ_AI_ENDPOINTS') && (endpoints || []).every((p) => !src.includes("'" + p + "'") && !src.includes('"' + p + '"') && !src.includes('`' + p)), 'no path of EZ_AI_ENDPOINTS is named in scope');
ok(!/['"`]\/api\//.test(src), 'no /api/ address of any kind in scope');
const prim = ['XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'import('].filter((p) => src.includes(p));
ok(prim.length === 0, 'no XMLHttpRequest, WebSocket, EventSource, sendBeacon or import() in scope' + (prim.length ? ': ' + prim.join(', ') : ''));
// every fetch() in scope: its address must be one of Ezik's own static files
// ...or the recitation itself (preloadRecitation warms the browser cache): an address bound, in the same
// declaration, to a template on https://everyayah.com/
const fetches = [];
const findFetch = (n, owner) => {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'CallExpression' && n.callee && ((n.callee.type === 'Identifier' && n.callee.name === 'fetch') || (n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'fetch'))) fetches.push({ arg: n.arguments[0], owner });
  for (const k of Object.keys(n)) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach((c) => findFetch(c, owner)); else if (v && typeof v.type === 'string') findFetch(v, owner); }
};
for (const n of scope.values()) findFetch(n, raw.slice(n.start, n.end));
const fetchOk = ({ arg, owner }) => {
  if (arg && arg.type === 'StringLiteral') return STATIC_FETCH.test(arg.value) ? 'static ' + arg.value : '';
  if (arg && arg.type === 'Identifier') return new RegExp('const ' + arg.name + ' = `https://everyayah\.com/').test(owner) ? 'recitation (' + arg.name + ' = everyayah.com)' : '';
  return '';
};
const badFetch = fetches.filter((x) => !fetchOk(x));
ok(fetches.length > 0 && badFetch.length === 0, fetches.length + ' fetch() call(s) in scope: ' + fetches.map((x) => fetchOk(x) || ('NOT ALLOWED ' + raw.slice(x.arg.start, x.arg.end))).join('; '));
// absolute addresses: everyayah.com only
const hosts = new Set();
for (const m of src.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) hosts.add(m[1].toLowerCase());
ok([...hosts].every((h) => h === 'everyayah.com'), 'every absolute address in scope is on everyayah.com: ' + ([...hosts].join(', ') || 'none'));
ok(hosts.has('everyayah.com'), '...and the recitation address is really in scope (the guard sees App\'s audio path)');

// ---- the second exception, checked whole: ezEar and everything it names ----
const EAR_BASE = 'http://127.0.0.1:8865';
const EAR_PATHS = ['/v1/health', '/v1/session', '/v1/audio', '/v1/seek', '/v1/end'];
const earAudit = (source) => {
  const a2 = babelParser.parse(source, { sourceType: 'script', plugins: ['jsx'] });
  const T2 = new Map(); addDecls(a2.program.body, T2);
  const root = T2.get('ezEar');
  if (!root) return { bad: ['ezEar is not a top-level declaration'], size: 0 };
  const sc = new Map(); const qq = [];
  const tk = (name) => { if (sc.has(name) || name === 'App' || (EXCEPTIONS[name] && name !== 'ezEar')) return; const node = T2.get(name); if (!node) return; sc.set(name, node); qq.push(node); };
  tk('ezEar');
  while (qq.length) for (const n of names(qq.shift())) if (T2.has(n)) tk(n);
  const all = [...sc.values()].map((n) => source.slice(n.start, n.end)).join('\n');
  const own = source.slice(root.start, root.end);
  const bad = [];
  if (/\baiFetch\b/.test(all) || sc.has('aiFetch')) bad.push('aiFetch');
  if (/['"`]\/api\//.test(all)) bad.push('an /api/ address');
  for (const p of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'import(']) if (all.includes(p)) bad.push(p);
  const abs = [...all.matchAll(/https?:\/\/[A-Za-z0-9.:-]+/g)].map((m) => m[0]);
  if (abs.length !== 1 || abs[0] !== EAR_BASE || !own.includes("const BASE = '" + EAR_BASE + "';")) bad.push('absolute addresses ' + JSON.stringify(abs));
  const fx = [];
  const findF = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && n.callee && ((n.callee.type === 'Identifier' && n.callee.name === 'fetch') || (n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'fetch'))) fx.push(n);
    for (const k of Object.keys(n)) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(findF); else if (v && typeof v.type === 'string') findF(v); }
  };
  for (const n of sc.values()) findF(n);
  const a0 = fx.length === 1 ? fx[0].arguments[0] : null;
  if (!(a0 && a0.type === 'BinaryExpression' && a0.operator === '+' && a0.left.type === 'Identifier' && a0.left.name === 'BASE' && a0.start > root.start && a0.end < root.end)) bad.push('fetch calls: ' + fx.length + ' (one, on BASE, inside ezEar)');
  const paths = [...own.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
  if (!paths.length || paths.some((p) => EAR_PATHS.indexOf(p) === -1) || EAR_PATHS.some((p) => paths.indexOf(p) === -1)) bad.push('paths ' + JSON.stringify(paths));
  if (/localStorage|sessionStorage|indexedDB|\bcaches\b|document\.cookie|mem86Store|setItem/.test(own) || /\.setItem\(/.test(all)) bad.push('a store');
  if (/permissions\s*\.\s*(request|revoke)\b|requestPermission/.test(all)) bad.push('a permission asked for');
  const gum = own.indexOf('getUserMedia(');
  const listenAt = own.indexOf('const listen = async (got) => {');
  const gate = 'if (!hasValidAIConsent() || childVoiceBlocked())';
  if ((own.match(/getUserMedia\(/g) || []).length !== 1 || listenAt < 0 || !(own.indexOf(gate, listenAt) > listenAt && own.indexOf(gate, listenAt) < gum) || own.indexOf(gate, gum) < 0) bad.push('the microphone gate');
  if (!own.includes(gate + ' {\n        dead = true;\n        if (mic && mic.close) mic.close();')) bad.push('the gate read again at every block');
  if (!/hush\.gain\.value = 0;/.test(own) || !own.includes('src.connect(node); node.connect(hush); hush.connect(ctx.destination);') || (own.match(/\.connect\(/g) || []).length !== 3) bad.push('silent speakers');
  return { bad, size: sc.size, names: [...sc.keys()] };
};
{
  const r = earAudit(raw);
  ok(r.size > 0 && r.bad.length === 0, 'ezEar, checked whole (' + r.size + ' declarations: ' + (r.names || []).join(', ') + '): one address ' + EAR_BASE + ', one fetch on it, the five paths ' + EAR_PATHS.join(' ') + ', no store, no AI door, no network primitive, the microphone behind the voice consent and the child guard (read again at every block), silent speakers, the browser\'s answer about this computer read and never asked for' + (r.bad.length ? ' -- VIOLATED: ' + r.bad.join('; ') : ''));
  const used = [...new Set([...src.matchAll(/\bezEar\.(\w+)/g)].map((m) => m[1]))].sort();
  ok(JSON.stringify(used) === JSON.stringify(['here', 'open', 'reachable']), 'the memorizer uses ezEar through its three doors only (here, reachable, open): ' + used.join(', '));
  const earAnchor = "const reachable = () => call('/v1/health', undefined, REACH_MS).then(() => true, (e) => (e && e.status ? false : refused().then((no) => (no ? 'blocked' : false), () => false)));";
  ok(raw.includes(earAnchor), 'ezEar mutation anchor present');
  ok(earAudit(raw.replace(earAnchor, earAnchor + " const x1 = () => aiFetch('/x', {});")).bad.length > 0, 'MUTANT KILLED: aiFetch inside ezEar');
  ok(earAudit(raw.replace(earAnchor, earAnchor + " const x2 = () => fetch('https://api.example.com/v1');")).bad.length > 0, 'MUTANT KILLED: a third-party host inside ezEar');
  ok(earAudit(raw.replace(earAnchor, earAnchor + " const x3 = (b) => localStorage.setItem('ear', b);")).bad.length > 0, 'MUTANT KILLED: a store written inside ezEar');
  ok(earAudit(raw.replace(earAnchor, earAnchor + " const x4 = () => call('/v1/log', '');")).bad.length > 0, 'MUTANT KILLED: a sixth path inside ezEar');
  ok(earAudit(raw.replace(earAnchor, earAnchor + " const x5 = () => navigator.permissions.request({ name: 'loopback-network' });")).bad.length > 0, 'MUTANT KILLED: the browser asked for a permission inside ezEar');
}

// ---- the guard bites: three mutants on the source must each fail ----
const probe = (mutated) => {
  const a2 = babelParser.parse(mutated, { sourceType: 'script', plugins: ['jsx'] });
  const T2 = new Map(); addDecls(a2.program.body, T2);
  const s2 = [];
  for (const [k] of scope) { const [w, n] = k.split(':'); const node = w === 'top' ? T2.get(n) : null; if (node) s2.push(mutated.slice(node.start, node.end)); }
  const t = s2.join('\n');
  return /\baiFetch\b/.test(t) || /['"`]\/api\//.test(t) || [...t.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)].some((m) => m[1].toLowerCase() !== 'everyayah.com');
};
const anchor = 'const mem86Rest = () => {';
ok(raw.includes(anchor), 'mutation anchor present');
ok(probe(raw.replace(anchor, anchor + " aiFetch('/x', {});")), 'MUTANT KILLED: aiFetch inside mem86Rest');
ok(probe(raw.replace(anchor, anchor + " fetch('/api/chat');")), 'MUTANT KILLED: /api/chat inside mem86Rest');
ok(probe(raw.replace(anchor, anchor + " fetch('https://api.example.com/v1');")), 'MUTANT KILLED: a third-party host inside mem86Rest');
ok(!probe(raw), 'the shipped source itself is clean under the same probe');

console.log((fail ? 'FAIL' : 'OK') + ': memorizer86-nospend ' + pass + '/' + (pass + fail) + ' checks passed.');
process.exit(fail ? 1 : 0);
