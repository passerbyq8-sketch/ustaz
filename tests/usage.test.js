import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { handleUsage } from '../api/usage.js';
import { checkUsageLimit } from '../lib/ratelimit.js';
import { __setRedisForTest, __resetRedis } from '../lib/ledger/redis.js';
import { USAGE_SECTIONS, USAGE_TTL_SECONDS, WRITE_USAGE_SCRIPT, READ_USAGE_SCRIPT,
  writeUsage, readUsage, usageWindow, usageKeys } from '../lib/usage.js';

const require = createRequire(import.meta.url);
const anon = 'a'.repeat(32);
const event = { section: 'mushaf', anon };
const response = () => ({
  headers: {}, statusCode: 0,
  setHeader(k, v) { this.headers[k] = v; },
  status(code) { this.statusCode = code; return this; },
  end() { this.ended = true; return this; },
  json(body) { this.body = body; return this; },
});

test('usage accepts a valid POST, forwards only the two anonymous fields, and returns 204', async () => {
  const writes = [], identities = [];
  const res = response();
  await handleUsage({ method: 'POST', body: event, headers: { 'user-agent': 'PRIVATE', cookie: 'PRIVATE' } }, res, {
    limit: async (id) => { identities.push(id); return { ok: true }; },
    write: async (body) => writes.push(body),
  });
  assert.equal(res.statusCode, 204);
  assert.deepEqual(writes, [event]);
  assert.deepEqual(identities, [anon]);
  assert.equal(res.body, undefined);
});

test('invalid sections, IDs, extra private fields and malformed Beacon bodies are silently dropped', async () => {
  const bad = [null, [], {}, { ...event, section: 'not-a-section' }, { ...event, section: '__proto__' },
    { ...event, anon: 'owner@example.com' }, { ...event, anon: 'a'.repeat(31) },
    { ...event, anon: 'g'.repeat(32) }, { ...event, question: 'PRIVATE' },
    { ...event, session: 'PRIVATE' }, { ...event, section: ['home'] }, '{', 'x'.repeat(257)];
  let calls = 0;
  for (const body of bad) {
    const res = response();
    await handleUsage({ method: 'POST', body }, res, {
      limit: async () => { calls++; return { ok: true }; }, write: async () => calls++,
    });
    assert.equal(res.statusCode, 204);
  }
  assert.equal(calls, 0);
});

test('Beacon text body is parsed; other methods and foreign origins cannot write', async () => {
  let writes = 0;
  const deps = { limit: async () => ({ ok: true }), write: async () => writes++ };
  const text = response();
  await handleUsage({ method: 'POST', body: JSON.stringify(event) }, text, deps);
  assert.equal(text.statusCode, 204);
  for (const method of ['GET', 'PUT', 'OPTIONS', 'DELETE']) {
    const res = response();
    await handleUsage({ method, body: event }, res, deps);
    assert.equal(res.statusCode, 405);
  }
  await handleUsage({ method: 'POST', body: event, headers: { origin: 'https://unrelated.example' } }, response(), deps);
  assert.equal(writes, 1);
});

test('over the usage limit and throttle/store outages return 204 and never log request content', async () => {
  let writes = 0;
  for (const limit of [async () => ({ ok: false }), async () => { throw new Error('offline'); }]) {
    const res = response();
    await handleUsage({ method: 'POST', body: event }, res, { limit, write: async () => writes++ });
    assert.equal(res.statusCode, 204);
  }
  assert.equal(writes, 0);
  const res = response();
  await handleUsage({ method: 'POST', body: event }, res, {
    limit: async () => ({ ok: true }), write: async () => { throw new Error('offline'); },
  });
  assert.equal(res.statusCode, 204);
});

test('usage throttle applies independent anonymous minute/day windows and fails closed', async () => {
  const ids = [];
  const window = (success) => ({ limit: async (id) => { ids.push(id); return { success }; } });
  assert.deepEqual(await checkUsageLimit(anon, { min: window(true), day: window(true) }), { ok: true });
  assert.deepEqual(await checkUsageLimit(anon, { min: window(false), day: window(true) }), { ok: false });
  assert.deepEqual(await checkUsageLimit(anon, { min: window(true), day: window(false) }), { ok: false });
  assert.deepEqual(ids, Array(6).fill(anon));
  assert.deepEqual(await checkUsageLimit(anon, { min: { limit() { throw new Error('offline'); } } }), { ok: false });
});

test('daily counters and HLL membership get 400-day TTLs; ranges count returning devices once', async () => {
  const values = new Map(), members = new Map(), expiries = new Map();
  const calls = [];
  __setRedisForTest({ async eval(script, keys, args) {
    calls.push({ script, keys, args });
    if (script === WRITE_USAGE_SCRIPT) {
      values.set(keys[0], (values.get(keys[0]) || 0) + 1);
      members.set(keys[1], new Set([...(members.get(keys[1]) || []), args[0]]));
      keys.forEach((key) => expiries.set(key, args[1]));
      return values.get(keys[0]);
    }
    assert.equal(script, READ_USAGE_SCRIPT);
    const out = [], days = args[0];
    for (let i = 0; i < keys.length; i += days * 2) {
      let opens = 0;
      const unique = new Set();
      for (let day = 0; day < days; day++) {
        opens += values.get(keys[i + day * 2]) || 0;
        for (const id of members.get(keys[i + day * 2 + 1]) || []) unique.add(id);
      }
      out.push(opens, unique.size);
    }
    return out;
  } });
  try {
    // Midnight in Kuwait is still the preceding UTC day.
    await writeUsage(event, new Date('2026-10-30T00:30:00+03:00'));
    assert.deepEqual(calls[0].keys, usageKeys('20261029', 'mushaf'));
    await writeUsage(event, new Date('2026-10-30T10:00:00Z'));
    await writeUsage({ ...event, anon: 'b'.repeat(32) }, new Date('2026-10-30T11:00:00Z'));
    await writeUsage({ section: 'chat', anon }, new Date('2026-10-30T11:00:00Z'));
    assert.equal(expiries.size, 6);
    assert.ok([...expiries.values()].every((ttl) => ttl === USAGE_TTL_SECONDS && ttl === 34560000));
    const one = await readUsage({ day: '20261030', days: 1 });
    assert.equal(one.items[0].section, 'mushaf');
    assert.deepEqual([one.items[0].opens, one.items[0].devices], [2, 2]);
    for (const days of [7, 30]) {
      const range = await readUsage({ day: '20261030', days });
      assert.deepEqual([range.items[0].opens, range.items[0].devices], [3, 2]);
      assert.equal(range.items.length, 29);
      assert.ok(!JSON.stringify(range).includes(anon));
    }
    assert.match(WRITE_USAGE_SCRIPT, /PFADD/);
    assert.equal((WRITE_USAGE_SCRIPT.match(/EXPIRE/g) || []).length, 2);
    assert.match(READ_USAGE_SCRIPT, /PFCOUNT', unpack\(devices\)/);
  } finally { __resetRedis(); }
});

test('bad dates and ranges are refused; an unreadable store is never an empty usage table', async () => {
  for (const input of [{ day: '20260230' }, { day: '20991231' }, { day: 'invalid' }, { days: 31 }, { days: '7' }]) {
    assert.throws(() => usageWindow(input));
  }
  __setRedisForTest(null);
  try { await assert.rejects(readUsage(), /usage-store/); } finally { __resetRedis(); }
});

function clientHarness({ storageThrows = false, beacon, fetch, local = new Map(), session = new Map(), pathname = '/', startTime = 10000 } = {}) {
  const events = [];
  let time = startTime;
  const storage = (map) => ({
    getItem(k) { if (storageThrows) throw new Error('denied'); return map.get(k) ?? null; },
    setItem(k, v) { if (storageThrows) throw new Error('denied'); map.set(k, v); },
  });
  const window = { localStorage: storage(local), sessionStorage: storage(session), location: { pathname },
    crypto: { getRandomValues(bytes) { bytes.fill(42); return bytes; } },
    navigator: { sendBeacon: beacon || ((_url, body) => { events.push(JSON.parse(body)); return true; }) }, fetch };
  const context = vm.createContext({ window, Date: { now: () => time } });
  vm.runInContext(require('../tools/build-usage.cjs').build(), context);
  return { window, events, local, session, tick(ms) { time += ms; } };
}

test('client whitelist, 5-second consecutive deduplication and cross-page deduplication', () => {
  const h = clientHarness();
  h.window.logSection('mushaf'); h.window.logSection('mushaf'); h.tick(4999); h.window.logSection('mushaf');
  assert.equal(h.events.length, 1);
  h.tick(1); h.window.logSection('mushaf');
  h.window.logSection('chat'); h.window.logSection('mushaf');
  h.window.logSection('PRIVATE QUESTION'); h.window.logSection('__proto__');
  assert.deepEqual(h.events.map((e) => e.section), ['mushaf', 'mushaf', 'chat', 'mushaf']);
  const next = clientHarness({ local: h.local, session: h.session, pathname: '/', startTime: 15000 });
  next.window.logSection('mushaf');
  assert.equal(next.events.length, 0);
  next.window.logSection('chat');
  assert.equal(next.events[0].anon, h.events[0].anon);
  next.window.localStorage.setItem('ezik_auth_session_v1', JSON.stringify({ session: 'DIFFERENT_ACCOUNT' }));
  next.window.logSection('home');
  assert.equal(next.events[1].anon, h.events[0].anon);
  assert.deepEqual(Object.keys(h.events[0]).sort(), ['anon', 'section']);
  for (const section of Object.keys(USAGE_SECTIONS)) h.window.logSection(section);
  assert.equal(new Set(h.events.map((e) => e.section)).size, 29);
});

test('storage refusal, thrown Beacon, rejected keepalive fetch and hung requests cannot block navigation', async () => {
  const sent = [];
  const h = clientHarness({ storageThrows: true,
    beacon() { throw new Error('offline'); },
    fetch(url, options) { sent.push({ url, options }); return Promise.reject(new Error('offline')); },
  });
  let navigated = false;
  assert.equal(h.window.logSection('home'), undefined);
  navigated = true;
  assert.equal(navigated, true);
  assert.equal(sent[0].options.keepalive, true);
  assert.equal(sent[0].options.credentials, 'omit');
  assert.equal(sent[0].options.referrerPolicy, 'no-referrer');
  await new Promise((resolve) => setImmediate(resolve));
  const hung = clientHarness({ beacon: () => false, fetch: () => new Promise(() => {}) });
  assert.equal(hung.window.logSection('home'), undefined);
  assert.equal(hung.window.logSection('chat'), undefined);
});

test('all standalone pages load the same built logger and direct visits log the right section', () => {
  const pages = { 'quest.html': 'treasure', 'library.html': 'library', 'quest-ghaws.html': 'ghaws',
    'quest-harb.html': 'harb', 'quest-test.html': 'test', 'quest-board.html': 'board', 'hanna-laha/index.html': 'hanna' };
  for (const [file, section] of Object.entries(pages)) {
    assert.match(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), /<script src="\/usage\.js"><\/script>/);
    assert.equal(clientHarness({ pathname: '/' + file }).events[0].section, section);
  }
  assert.equal(clientHarness({ pathname: '/hanna-laha/' }).events[0].section, 'hanna');
  assert.equal(fs.readFileSync(new URL('../usage.js', import.meta.url), 'utf8'), require('../tools/build-usage.cjs').build());
});

test('usage list follows the existing owner gate; strangers, readers and editors cannot read it', async () => {
  const source = fs.readFileSync(new URL('../api/inbox.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export default /g, '').replace(/export /g, '');
  let actor = null, reads = 0, unavailable = false;
  const context = vm.createContext({
    process: { env: {} }, TEXT_CAP: 5000,
    Redis: class {}, applyCorsOrigin() {}, checkAuthLimit: async () => ({ ok: true }), clientAddress: () => 'test',
    resolveActor: async () => actor, ROLE_OWNER: 'owner', DEVICE_HEADER: 'x-device',
    usageWindow, readUsage: async () => { reads++; if (unavailable) throw Error('offline'); return { ok: true, kind: 'usage', items: [] }; },
  });
  vm.runInContext(source + '\nglobalThis.runInbox = handler;', context);
  const req = { method: 'POST', body: { action: 'list', kind: 'usage' } };
  for (actor of [null, { role: 'none' }, { role: 'editor' }]) {
    const res = response(); await context.runInbox(req, res); assert.equal(res.statusCode, 401);
  }
  assert.equal(reads, 0);
  actor = { role: 'owner' };
  const res = response(); await context.runInbox(req, res); assert.equal(res.statusCode, 200);
  unavailable = true;
  const failed = response(); await context.runInbox(req, failed); assert.equal(failed.statusCode, 503);
  const invalid = response(); await context.runInbox({ ...req, body: { ...req.body, days: 999 } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(reads, 2);
});
