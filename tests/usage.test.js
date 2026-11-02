import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { handleUsage } from '../api/usage.js';
import { checkUsageLimit } from '../lib/ratelimit.js';
import { __setRedisForTest, __resetRedis } from '../lib/ledger/redis.js';
import { USAGE_SECTIONS, USAGE_TTL_SECONDS, USAGE_ACTIVE_TTL_SECONDS, WRITE_USAGE_SCRIPT, READ_USAGE_SCRIPT,
  READ_UNIONS_SCRIPT, READ_HASHES_SCRIPT, READ_RETURN_SCRIPT, writeUsage, readUsage, readUsageBoard, readUsageChat,
  usageAnswerOutcome, usageWindow, usageKeys, usageStatsKey, usageActiveKey, usageFields, usageStay, validUsageEvent } from '../lib/usage.js';

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
    { ...event, session: 'PRIVATE' }, { ...event, section: ['home'] }, '{', 'x'.repeat(257),
    { ...event, from: 'chat' }, { ...event, gap: 5 }, { ...event, from: 'PRIVATE', gap: 5 },
    { ...event, from: 'chat', gap: 1800001 }, { ...event, from: 'chat', gap: -1 }, { ...event, from: 'chat', gap: 1.5 },
    { ...event, boot: 2 }, { ...event, boot: 'PRIVATE' }, { ...event, side: 1, boot: 1 }];
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
      keys.slice(0, 2).forEach((key) => expiries.set(key, args[1]));
      return values.get(keys[0]);
    }
    if (script !== READ_USAGE_SCRIPT) return null;
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
    assert.deepEqual(calls[0].keys, [...usageKeys('20261029', 'mushaf'), usageStatsKey('20261029'), usageActiveKey('20261029')]);
    assert.deepEqual(calls[0].args, [anon, USAGE_TTL_SECONDS, USAGE_ACTIVE_TTL_SECONDS, 'h:0']);
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
    assert.equal((WRITE_USAGE_SCRIPT.match(/EXPIRE/g) || []).length, 4);
    assert.equal(USAGE_ACTIVE_TTL_SECONDS, 691200);
    assert.equal(one.board, null);
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

test('one event bumps closed fields only; a side event touches neither the day stats nor the device set', async () => {
  assert.ok(validUsageEvent({ ...event, from: 'chat', gap: 1800000 }));
  assert.ok(validUsageEvent({ ...event, boot: 1 }));
  assert.ok(validUsageEvent({ section: 'qibla', anon, side: 1 }));
  const at = new Date('2026-11-01T22:30:00Z');
  assert.deepEqual(usageFields({ ...event, boot: 1, plat: 'a', appv: '1.2', notif: 1 }, at), ['h:1', 'b', 'o:a', 'v:1.2', 'n']);
  assert.deepEqual(usageFields({ ...event, from: 'chat', gap: 9000 }, at), ['h:1', 'd:chat:0', 'p:chat>mushaf']);
  assert.deepEqual(usageFields({ ...event, from: 'mushaf', gap: 1800000 }, at), ['h:1', 'd:mushaf:6']);
  for (const bad of [{ ...event, plat: 'a' }, { ...event, boot: 1, plat: 'x' }, { ...event, boot: 1, appv: 'سؤال' }, { ...event, boot: 1, notif: 2 }]) assert.equal(validUsageEvent(bad), false);
  assert.deepEqual(usageStay([2, 0, 0, 0, 0, 0, 0]), { n: 2, mean: 5, median: 5 });
  assert.deepEqual(usageStay([0, 0, 1, 0, 0, 0, 1]), { n: 2, mean: 623, median: 60 });
  assert.equal(usageStay([0, 0, 0, 0, 0, 0, 0]), null);
  const calls = [];
  __setRedisForTest({ async eval(script, keys, args) { calls.push({ keys, args }); return 1; } });
  try {
    await writeUsage({ section: 'qibla', anon, side: 1 }, new Date('2026-11-01T10:00:00Z'));
    assert.deepEqual(calls[0].keys, usageKeys('20261101', 'qibla'));
    assert.deepEqual(calls[0].args, [anon, USAGE_TTL_SECONDS, USAGE_ACTIVE_TTL_SECONDS]);
  } finally { __resetRedis(); }
});

test('the board returns counts only, compares with the prior window and says null rather than a false zero', async () => {
  const when = new Date('2026-11-10T12:00:00Z');
  const sizes = [];
  __setRedisForTest({ async eval(script, keys, args) {
    if (script === READ_UNIONS_SCRIPT) { sizes.push(...args); return args.map((_, i) => i + 1); }
    if (script === READ_HASHES_SCRIPT) return keys.map((k) => (k === usageStatsKey('20261110')
      ? ['h:9', '5', 'b', '3', 'o:a', '2', 'o:w', '1', 'n', '1', 'v:1.2', '3', 'd:chat:1', '4', 'p:chat>mushaf', '2', 'p:home>chat', '4'] : k === usageStatsKey('20261109') ? ['b', '2'] : []));
    if (script === READ_RETURN_SCRIPT) return keys.map((k, i) => (i < 4 && i % 2 === 0 ? 10 : i < 4 ? 4 : 0));
    throw Error('unknown script');
  } });
  try {
    const board = await readUsageBoard({ day: '20261110', days: 1 }, when);
    assert.equal(sizes.length, 32);
    assert.equal(sizes[0], 29);
    assert.deepEqual([board.active, board.activeBefore], [31, 32]);
    assert.deepEqual([board.opens, board.opensBefore], [3, 2]);
    assert.deepEqual(board.d1, { cohort: 10, returned: 4 });
    assert.equal(board.d7, null);
    assert.equal(board.trend.length, 30);
    assert.equal(board.trend[29].day, '20261110');
    assert.deepEqual(board.paths.map((p) => p.n), [4, 2]);
    assert.equal(board.hours[9], 5);
    assert.equal(board.hours.length, 24);
    assert.deepEqual(board.platforms, { a: 2, i: 0, w: 1 });
    assert.deepEqual(board.notif, { on: 1, of: 2 });
    assert.deepEqual(board.versions, [{ v: '1.2', n: 3 }]);
    assert.deepEqual(board.stays[0], { label: USAGE_SECTIONS.chat, n: 4, mean: 20, median: 20 });
    assert.equal(board.paths[0].to, USAGE_SECTIONS.chat);
    assert.ok(!JSON.stringify(board).includes(anon));
  } finally { __resetRedis(); }
});

test('a window ending today measures return on the last settled day', async () => {
  const seen = [];
  __setRedisForTest({ async eval(script, keys, args) {
    if (script === READ_UNIONS_SCRIPT) return args.map(() => 0);
    if (script === READ_HASHES_SCRIPT) return keys.map(() => []);
    seen.push(...keys);
    return keys.map(() => 0);
  } });
  try {
    await readUsageBoard({ day: '20261110', days: 1 }, new Date('2026-11-10T12:00:00Z'));
    assert.equal(seen[1], usageActiveKey('20261109'));
    assert.equal(seen[0], usageActiveKey('20261108'));
  } finally { __resetRedis(); }
});

test('chat quality reads the answer log as counts: no fingerprint, no text', async () => {
  const asked = [];
  const out = await readUsageChat({ days: 7 }, { read: async (q) => {
    asked.push(q);
    return asked.length > 1 ? [] : [
      { fp: 'PRIVATE', cited: 2, route: 'deen', flags: [], status: 'ended', first_byte_ms: 1000 },
      { cited: 0, route: 'deen', flags: ['refusal_fallback'], status: 'ended', first_byte_ms: 3000 },
      { cited: 0, path: 'canned', flags: ['unsourced_withheld', 'incomplete'], status: 'ended', first_byte_ms: null },
    ];
  } });
  assert.equal(asked.length, 7);
  assert.equal(asked[0].limit, 200);
  assert.deepEqual([out.read, out.noFind, out.noSource, out.faults, out.firstMs, out.slowMs], [3, 2, 2, 1, 3000, 3000]);
  assert.deepEqual(out.top, [{ k: 'deen', n: 2 }, { k: 'canned', n: 1 }]);
  assert.ok(!JSON.stringify(out).includes('PRIVATE'));
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
  return { window, events, local, session, now: () => time, tick(ms) { time += ms; } };
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
  assert.deepEqual(Object.keys(h.events[0]).sort(), ['anon', 'boot', 'plat', 'section']);
  assert.equal(h.events[0].plat, 'w');
  assert.equal(h.events[0].boot, 1);
  assert.deepEqual([h.events[1].from, h.events[1].boot], ['mushaf', undefined]);
  assert.equal(h.events[1].gap, 5000);
  assert.equal(h.events[2].from, 'mushaf');
  for (const section of Object.keys(USAGE_SECTIONS)) h.window.logSection(section);
  assert.equal(new Set(h.events.map((e) => e.section)).size, 29);
});

test('a move carries the gap, a long silence is a new app open, and a side event moves nothing', () => {
  const h = clientHarness();
  h.window.logSection('prayer');
  h.window.logSection('qibla', true);
  h.tick(6000);
  h.window.logSection('chat');
  assert.deepEqual(h.events[1], { section: 'qibla', side: 1, anon: h.events[0].anon });
  assert.deepEqual([h.events[2].from, h.events[2].gap], ['prayer', 6000]);
  h.tick(1800001);
  h.window.logSection('home');
  assert.equal(h.events[3].boot, 1);
  assert.equal('from' in h.events[3], false);
  const next = clientHarness({ local: h.local, session: h.session, startTime: h.now() + 1000 });
  next.window.logSection('mushaf');
  assert.deepEqual([next.events[0].from, next.events[0].gap], ['home', 1000]);
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
  assert.ok(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').includes(require('../tools/build-usage.cjs').build()));
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

test('the panel overview is one owner-only read, and each part fails alone', async () => {
  const source = fs.readFileSync(new URL('../api/inbox.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export default /g, '').replace(/export /g, '');
  let actor = null, usageReads = 0;
  const chatDays = [];
  const context = vm.createContext({
    process: { env: {} }, TEXT_CAP: 5000, console: { error() {} },
    Redis: class {}, applyCorsOrigin() {}, checkAuthLimit: async () => ({ ok: true }), clientAddress: () => 'test',
    resolveActor: async () => actor, ROLE_OWNER: 'owner', DEVICE_HEADER: 'x-device', usageWindow,
    readUsage: async () => { usageReads++; throw Error('offline'); },
    readUsageChat: async (b) => { chatDays.push(b.day); return { ok: true, read: 1 }; },
  });
  vm.runInContext(source + '\nglobalThis.runInbox = handler;', context);
  const req = { method: 'POST', body: { action: 'list', kind: 'overview' } };
  for (actor of [null, { role: 'none' }, { role: 'editor' }]) {
    const res = response(); await context.runInbox(req, res); assert.equal(res.statusCode, 401);
  }
  assert.equal(usageReads, 0);
  actor = { role: 'owner' };
  const res = response(); await context.runInbox(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(usageReads, 1);
  assert.equal(chatDays.length, 2);
  assert.notEqual(chatDays[0], chatDays[1]);
});

test('one answer has one outcome, and a refusal outranks an answer that ended', () => {
  assert.equal(usageAnswerOutcome({ status: 'ended', flags: [] }), 'done');
  assert.equal(usageAnswerOutcome({ status: 'ended' }), 'done');
  assert.equal(usageAnswerOutcome({ status: 'ended', flags: ['refusal_fallback'] }), 'nofind');
  assert.equal(usageAnswerOutcome({ status: 'open', flags: ['unsourced_withheld'] }), 'nofind');
  assert.equal(usageAnswerOutcome({ status: 'open', flags: [] }), 'fault');
  assert.equal(usageAnswerOutcome({ status: 'ended', flags: ['incomplete'] }), 'fault');
});
