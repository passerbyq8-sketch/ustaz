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
// THE ONE NAMED EXCEPTION. ezNewRecognition -- the browser's own speech recognition for «سمِّعني». It is not Ezik's
// brain and it is not paid: Web Speech is the browser's engine (Google on Chrome, Apple on Safari), already behind
// the voice consent and the child guard, and its constructor stands on exactly three lines (gate aiconsent counts
// them). It is not followed into; everything else is.
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

const EXCEPTIONS = { ezNewRecognition: 'the browser speech engine of «سمِّعني» -- not Ezik\'s brain, not paid; consent-gated, three lines (gate aiconsent)' };
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
ok(seenExceptions.has('ezNewRecognition'), 'the one named exception is really reached (ezNewRecognition), so it is not a dead list');

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
