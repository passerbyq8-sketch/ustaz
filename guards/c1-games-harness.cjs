'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const HOST_TOKEN = ['synthetic', 'room', 'host'].join('-');
const ORIGIN = 'https://hanna-laha.hl-worker.workers.dev';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fixtures = JSON.parse(read('guards/c1-games-response-fixtures.json'));
function functionSource(source, name) {
  const ast = babel.parseSync(source, { configFile: false, babelrc: false, sourceType: 'unambiguous' });
  let node;
  function visit(value) { if (!value || typeof value !== 'object' || node) return; if (value.type === 'FunctionDeclaration' && value.id.name === name) { node = value; return; } for (const key of Object.keys(value)) if (key !== 'loc') { const child = value[key]; if (Array.isArray(child)) child.forEach(visit); else visit(child); } }
  visit(ast.program);
  assert(node, 'production function ' + name); return source.slice(node.start, node.end);
}
function classSource(source, name) {
  const ast = babel.parseSync(source, { configFile: false, babelrc: false });
  for (const n of ast.program.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.name === name) return source.slice(d.init.start, d.init.end);
  throw Error('production class ' + name);
}
const hannaSource = read('hanna-laha/assets/Page-CJ0DuoAl.js');
const harbSource = [...read('quest-harb.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function roomCreate()'));
const snippets = {
  hannaAPI: functionSource(hannaSource, 'jc'), hannaConnection: classSource(hannaSource, 'Rc'), hannaClient: classSource(hannaSource, 'Vc'),
  harbCreate: functionSource(harbSource, 'roomCreate'), harbConnect: functionSource(harbSource, 'rmConnect'), harbSend: functionSource(harbSource, 'rmSend'), harbRaw: functionSource(harbSource, 'rmRawSend')
};
function storage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), dump: () => Object.fromEntries(map) };
}
function environment(options = {}) {
  const events = {}, documentEvents = {}, timers = new Map(), sockets = [], calls = [], posts = [], messages = [], notices = [];
  let sequence = 0, clock = 0, currentFixture = options.fixture || fixtures.responseCases[0], beforeReply = null;
  const localStorage = storage(options.storage);
  const add = (map, type, fn) => (map[type] ||= []).push(fn);
  const context = {
    URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal, TextDecoder, TextEncoder, Uint8Array, Uint32Array, Promise,
    performance: { now: () => clock }, crypto: require('crypto').webcrypto,
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: () => ++sequence, clearInterval() {},
    location: { href: ORIGIN + '/quest-board.html', origin: ORIGIN, pathname: '/quest-board.html', search: '', hostname: new URL(ORIGIN).hostname },
    history: { replaceState() {} }, navigator: { onLine: true }, localStorage,
    addEventListener: (t, f) => add(events, t, f), removeEventListener() {},
    document: { visibilityState: 'visible', readyState: 'loading', addEventListener: (t, f) => add(documentEvents, t, f), removeEventListener() {} },
    console: { log() {}, warn() {}, error() {} },
    ezikOnlineRecovery: value => notices.push(value), ezikOnlineRefreshAccount: () => { context.refreshes++; }, refreshes: 0,
    DATA: { cats: [['deen'], ['prayer'], ['quran']], qs: [[0, '', '', '', '', '', '', '', 'one']] },
    KunuzModel: { live: () => true, history: () => ({ read() {}, has: () => false, last: () => 0, mark() {}, restart() {} }) }
  };
  context.window = context; context.globalThis = context;
  context.WebSocket = class {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = 0; sockets.push(this); }
    send(raw) { if (raw !== 'ping') messages.push(JSON.parse(raw)); }
    close() { this.readyState = 3; }
  };
  async function network(url, init = {}) {
    const request = url instanceof Request ? url : new Request(url, init), parsed = new URL(request.url);
    calls.push({ url: request.url, method: request.method, cache: request.cache, credentials: request.credentials, redirect: request.redirect, headers: [...request.headers] });
    if (parsed.pathname === '/api/account-capabilities') {
      const f = currentFixture;
      clock += f.elapsedMs || 0;
      if (beforeReply) { const callback = beforeReply; beforeReply = null; callback(); }
      if (!f.currentOperation) for (const fn of events.pagehide || []) fn({});
      if (!f.response) {
        if (f.id === 'timeout') { for (const t of [...timers.values()]) if (t.ms === 5000) t.fn(); return new Promise(() => {}); }
        throw Error('synthetic ' + f.id);
      }
      const probe = parsed.searchParams.get('probe');
      const body = f.response.rawBody.replaceAll(f.request.probe, probe);
      const headers = { ...f.response.headers };
      if (f.delivery !== 'network') headers['x-cache'] = 'HIT';
      const result = new Response(body, { status: f.response.status === 304 ? 200 : f.response.status, headers });
      Object.defineProperty(result, 'status', { value: f.response.status });
      Object.defineProperty(result, 'url', { value: f.response.origin === f.request.origin ? request.url : request.url.replace(ORIGIN, f.response.origin) });
      return result;
    }
    if (parsed.pathname === '/api/board/catalog') return Response.json({ bankStamp: 'fixture-bank', categories: ['deen', 'prayer', 'quran'].map((slug, index) => ({ slug, index })) });
    if (request.method === 'POST' && /\/rooms$/.test(parsed.pathname)) {
      posts.push({ headers: [...request.headers], body: await request.json() });
      return Response.json({ code: '123456', roomId: 'a'.repeat(24), hostToken: HOST_TOKEN, createdAt: 1 });
    }
    throw Error('Unexpected local fixture route ' + parsed.pathname);
  }
  context.fetch = options.fetch || network;
  const sandbox = vm.createContext(context);
  let core = options.source || read('hanna-laha/assets/iap-bridge-v1.js').split('/* ONLINE_GENERATION_END */')[0] + '/* ONLINE_GENERATION_END */';
  vm.runInContext(core, sandbox, { filename: 'production-iap-generation.js' });
  const run = source => vm.runInContext(source, sandbox);
  const result = { context, sandbox, calls, posts, messages, notices, sockets, localStorage, timers, run, events, documentEvents,
    fixture: f => { currentFixture = typeof f === 'string' ? fixtures.responseCases.find(x => x.id === f) : f; assert(currentFixture); },
    beforeReply: fn => { beforeReply = fn; }, network,
    setSession: value => localStorage.setItem('ezik_auth_session_v1', JSON.stringify({ session: value })),
    fire: type => { for (const fn of events[type] || []) fn({ type }); },
    tick: async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); }
  };
  if (options.sw) {
    const handlers = {}, worker = { location: { origin: ORIGIN }, addEventListener: (t, f) => { handlers[t] = f; } };
    const cacheTrap = new Proxy({}, { get() { throw Error('Capability used offline storage'); } });
    vm.runInNewContext(options.swSource || read(options.sw), { self: worker, URL, Request, Response, Headers, fetch: network, caches: cacheTrap, indexedDB: cacheTrap, importScripts() {}, console: context.console, setTimeout: context.setTimeout, clearTimeout: context.clearTimeout, Set, Map, crypto: context.crypto });
    context.fetch = (url, init) => {
      const request = new Request(url, init); let response;
      handlers.fetch({ request, respondWith: p => { assert.equal(response, undefined); response = p; }, waitUntil() {} });
      if (new URL(url).pathname === '/api/account-capabilities') assert(response, 'explicit network-only service-worker path');
      return response || network(request);
    };
  }
  return result;
}
function entry(env, game) {
  const c = env.context;
  if (game === 'hanna') {
    env.run(`class Ac extends Error { constructor(code,status){super(code);this.code=code;this.status=status;} } function s(e,t,n){return (e.apiOrigin||n)+t;} const xc={parse:x=>x}; ${snippets.hannaAPI}; globalThis.entryAPI=jc({apiOrigin:${JSON.stringify(ORIGIN)}},${JSON.stringify(ORIGIN)},fetch);`);
    return async () => { try { await c.entryAPI.createRoom('synthetic-device', { teams: ['one', 'two'], cap: 1 }); } catch (_) {} };
  }
  if (game === 'harb') {
    Object.assign(c, { WAR_HOST: ORIGIN, G: { cats: [0, 1, 2], fuse: 0, shots: 1, winRule: 2, deployMul: 1, deployFree: 2 }, RM: {}, rmDevice: () => 'synthetic-device', rmSave() {}, leaveCfgMode() {}, drawLobby() {}, show() {}, rmConnect() {} });
    c.$ = () => ({ disabled: false, textContent: '', classList: { add() {}, remove() {} } });
    c.online = c.KunuzOnline.create({ game, origin: ORIGIN }); c.rmOnline = () => c.online;
    env.run(snippets.harbCreate);
    return async () => { c.roomCreate(); for (let i = 0; i < 100; i++) await env.tick(); };
  }
  const state = { cats: [0, 1, 2], teams: [{ n: 'First', c: 'red' }, { n: 'Second', c: 'blue' }], settings: { roomCode: '', reveals: 2, options: 'shown', difficulty: 'points' } };
  const h = { state, esc: x => x, ar: String, button: () => '', digits: String, time: () => 0, colors: ['red', 'blue'], render() {}, paintTime() {}, app: {}, askDialog() {} };
  c.harness = h; env.run(read('quest-theme/board-rooms.js'));
  const board = c.KunuzBoardRooms.attach(h); c.boardEntry = board;
  return async () => { await board.create(); await env.tick(); };
}
async function connected(env, game, generation) {
  const c = env.context, record = { origin: ORIGIN, game, code: '123456', roomId: 'a'.repeat(24), generation };
  env.localStorage.setItem('kunuz_worker_rooms_v1', JSON.stringify([record]));
  env.fixture(generation === 'ACCOUNT' ? 'account-exact' : 'legacy-fix46-4725edfd');
  const snapshot = (phase = 'lobby', version = 1, gameNumber = 0) => ({ roomId: record.roomId, phase, stage: phase === 'lobby' ? 'lobby' : 'play', version, gameNumber, bankStamp: 'fixture-bank', self: { role: 'host' }, teams: [{ name: 'First', color: 0, score: 0, shows: 2 }, { name: 'Second', color: 1, score: 0, shows: 2 }], config: { rounds: 1 }, settings: { options: 'shown', timeMs: 0, reveals: 2, questionOrder: 'points' }, cats: [0, 1, 2], slots: [], restartCats: [], turn: 0, question: null });
  const credentials = { code: record.code, roomId: record.roomId, hostToken: HOST_TOKEN, teamToken: '', deviceId: 'synthetic-device' };
  let controller, send, reconnect, receive, startEntry;
  if (game === 'hanna') {
    c.s = (config, route) => config.apiOrigin + route; c.c = (config, code) => config.apiOrigin.replace('http', 'ws') + '/ws/rooms/' + code;
    c.Bc = { role: null, code: null, snapshot: null, status: 'idle', reported: 0 };
    c.Mc = new Set(['ROOM_CLOSED', 'NOT_FOUND', 'OUTDATED', 'BAD_TOKEN']); c.Nc = { baseMs: 500, maxMs: 5000, jitter: .25 }; c.Lc = () => 500; c.Pc = 10000; c.Fc = 30000; c.Ic = 3000; c.kc = { safeParse: data => ({ success: true, data }) };
    c.deps = { config: { apiOrigin: ORIGIN, version: 'fixture' }, pageOrigin: ORIGIN, identity: { deviceId: () => credentials.deviceId }, env: { createSocket: url => new c.WebSocket(url), now: () => 1, random: () => 0, setTimer: c.setTimeout, clearTimer: c.clearTimeout, onWake: () => () => {} }, sessions: { updateHostMeta() {}, clearPhone() {}, clearHost() {}, host: () => credentials, phone: () => null } };
    env.run('var Rc=' + snippets.hannaConnection + ';var Vc=' + snippets.hannaClient + ';globalThis.gameClient=new Vc(deps);');
    const client = c.gameClient; client.connectHost(credentials); await env.tick();
    controller = client.online; send = m => client.send(m); reconnect = async () => { client.conn.stop(); client.conn.start(); await env.tick(); };
    receive = s => client.onMessage({ t: client.state.snapshot ? 'snapshot' : 'welcome', snapshot: s, self: { role: 'host' } });
    startEntry = () => ({ send: () => client.start(), options: { online: controller, waitForStart: () => client.waitForStart(), cycle: '1' } });
  } else if (game === 'board') {
    const state = { cats: [0, 1, 2], teams: [{ n: 'First', c: 'red' }, { n: 'Second', c: 'blue' }], settings: { roomCode: '', reveals: 2, options: 'shown', difficulty: 'points' } };
    const h = { state, esc: x => x, ar: String, button: () => '', digits: String, time: () => 0, colors: ['red', 'blue'], render() {}, paintTime() {}, app: {}, askDialog() {} };
    c.localStorage.setItem('kunuz_points_board_room_v1', JSON.stringify(credentials));
    c.localStorage.setItem('kunuz_points_board_device_v1', credentials.deviceId);
    const nativeCreate = c.KunuzOnline.create; c.KunuzOnline = { ...c.KunuzOnline, create: o => (controller = nativeCreate(o)) };
    env.run(read('quest-theme/board-rooms.js')); const board = c.KunuzBoardRooms.attach(h); board.resume(); await env.tick(); await env.tick();
    send = async m => { if (['start', 'rematch'].includes(m.t)) { let pending; c.ezikIapStart = fn => { pending = fn(); }; board.handle(m.t === 'start' ? 'br-start' : 'br-rematch', {}); return pending; } return controller.send(m, x => { env.sockets.at(-1).send(JSON.stringify(x)); return true; }); };
    reconnect = async () => { const socket = env.sockets.at(-1); socket.onclose(); const retry = [...env.timers.values()].find(t => t.ms === 500); assert(retry); retry.fn(); await env.tick(); };
    receive = s => env.sockets.at(-1).onmessage({ data: JSON.stringify({ t: 'snapshot', snapshot: s }) });
    startEntry = () => { let captured; c.ezikIapStart = (fn, code, id, options) => { captured = { send: fn, options }; }; board.handle('br-start', {}); assert(captured); return captured; };
  } else {
    controller = c.KunuzOnline.create({ game, origin: ORIGIN });
    Object.assign(c, { WAR_V: 1, RM: { ...credentials, on: true, host: true, ws: null, snap: null }, rmOnline: () => controller, rmDevice: () => credentials.deviceId, rmWsUrl: route => ORIGIN.replace('http', 'ws') + route, rmDrop() {}, roomBroken() {}, lobbyMsg() {}, rmMsg: m => controller.observe(m.snapshot) });
    env.run(snippets.harbRaw + '\n' + snippets.harbSend + '\n' + snippets.harbConnect); await c.rmConnect(true);
    send = c.rmSend; reconnect = async () => { controller.disconnect(); await c.rmConnect(false); };
    receive = s => { c.RM.snap = s; env.sockets.at(-1).onmessage({ data: JSON.stringify({ t: 'snapshot', snapshot: s }) }); };
    env.run(functionSource(harbSource, 'waitForWarStart') + '\n' + functionSource(harbSource, 'notifyWarStart')); c.RM.iapStartWaiters = [];
    const originalReceive = receive; receive = s => { originalReceive(s); c.notifyWarStart(s); };
    startEntry = () => ({ send: () => c.rmSend({ t: 'start' }), options: { online: controller, waitForStart: c.waitForWarStart, cycle: '1', roomInstanceId: credentials.roomId } });
  }
  function socketOpen() { const socket = env.sockets.at(-1); assert(socket, game + ' opens socket'); socket.readyState = 1; socket.onopen(); }
  socketOpen(); receive(snapshot());
  return { controller, send, reconnect, receive, snapshot, socketOpen, startEntry, credentials };
}
function iap(env) {
  const source = read('hanna-laha/assets/iap-bridge-v1.js'), c = env.context;
  const consume = [], nativeFetch = c.fetch;
  c.fetch = (url, init) => { if (url === '../api/iap-consume') { consume.push(JSON.parse(init.body)); return Promise.resolve(Response.json({ ok: true })); } return nativeFetch(url, init); };
  Object.assign(c, { sessionStorage: storage(), startContext: null, sessionIdMemory: {}, authSession: () => JSON.parse(c.localStorage.getItem('ezik_auth_session_v1')).session, requestId: () => 'synthetic-idempotent-request', getEnforcementState: async () => ({ mode: 'all', signin: 'none' }), entitlementBalance: async () => ({ ok: true, data: { enforced: true } }), hasFreeEntitlement: () => true, closeModal() {}, showFailure() {}, stopSignInWatch() {}, showSignIn() {}, showExpired() {} });
  env.run(['roomSessionId', 'consumeAndStart', 'startWithIntent', 'startWithoutIap', 'beginStart'].map(n => functionSource(source, n)).join('\n'));
  return { consume, begin: (send, game, options) => c.beginStart(send, '123456', game, options) };
}
module.exports = { root, read, fixtures, ORIGIN, HOST_TOKEN, environment, entry, connected, iap, snippets, functionSource, classSource };
