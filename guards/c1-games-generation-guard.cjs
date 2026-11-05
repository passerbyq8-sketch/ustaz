'use strict';
const assert = require('assert/strict');
const { read, fixtures, ORIGIN, environment, entry, connected, iap } = require('./c1-games-harness.cjs');
const core = read('hanna-laha/assets/iap-bridge-v1.js').split('/* ONLINE_GENERATION_END */')[0] + '/* ONLINE_GENERATION_END */';
const tests = [], results = [];
const test = (id, fn) => tests.push({ id, fn });
const session = suffix => ['synthetic', 'account', suffix, 'fixture'].join('-');
const room = { code: '123456', roomId: 'a'.repeat(24), existing: true };
const provenance = generation => ({ kunuz_worker_rooms_v1: JSON.stringify([{ origin: ORIGIN, game: 'board', code: room.code, roomId: room.roomId, generation }]) });
async function open(env, client) { const ticket = await client.open(); client.hello(ticket, { t: 'hello', v: 1, roomId: room.roomId, hostToken: 'synthetic-room-host', deviceId: 'synthetic-device' }, message => { env.messages.push(message); return true; }); }
const snap = (phase = 'lobby', version = 1, gameNumber = 0) => ({ roomId: room.roomId, phase, version, gameNumber });
for (const sw of ['sw.js', 'quest-sw.js']) for (const game of ['hanna', 'harb', 'board']) for (const fixture of fixtures.responseCases) {
  test('fixture/' + sw + '/' + game + '/' + fixture.id, async source => {
    const env = environment({ source, fixture, sw }); env.setSession(session('before'));
    env.beforeReply(() => env.setSession(session('fresh')));
    await entry(env, game)();
    const probes = env.calls.filter(c => c.url.includes('/api/account-capabilities?'));
    assert(probes.length, 'entry performs discovery');
    for (const p of probes) { assert.equal(p.method, 'GET'); assert.equal(p.credentials, 'omit'); assert.equal(p.cache, 'no-store'); assert.equal(p.redirect, 'error'); assert.match(new URL(p.url).searchParams.get('probe'), /^[0-9a-f]{32}$/); assert(!p.headers.some(([name]) => /session|cookie|authorization/i.test(name))); }
    if (fixture.expected.generation === 'UNKNOWN') { assert.equal(env.posts.length, 0, 'unknown prevents create'); assert.equal(env.sockets.length, 0, 'unknown prevents socket'); }
    else {
      assert.equal(env.posts.length, 1, 'exact generation creates once');
      const header = new Headers(env.posts[0].headers).get('x-ezik-session');
      assert.equal(header, fixture.expected.generation === 'ACCOUNT' ? session('fresh') : null, 'generation selects fresh transport');
      assert(env.posts[0].body.config); assert(env.posts[0].body.deviceId);
    }
    assert.equal(JSON.parse(env.localStorage.getItem('ezik_auth_session_v1')).session, session('fresh'));
    const saved = env.localStorage.getItem('kunuz_worker_rooms_v1');
    if (fixture.expected.generation === 'UNKNOWN') assert.equal(saved, null, 'unknown creates no room provenance');
    else {
      assert(saved && saved.length > 0, 'successful create persists nonempty provenance');
      const records = JSON.parse(saved);
      assert(Array.isArray(records) && records.length > 0, 'parsed provenance is nonempty');
      assert(records.some(record => record.origin === ORIGIN && record.game === game && record.code === room.code && record.roomId === room.roomId && record.generation === fixture.expected.generation), 'created room provenance matches');
      assert(!saved.includes(session('fresh')) && !saved.includes(session('before')), 'no account session in game records');
    }
    for (const call of env.calls) assert(!call.url.includes(session('fresh')), 'no session in URL');
  });
}
for (const sw of ['sw.js', 'quest-sw.js']) for (const game of ['hanna', 'harb', 'board']) for (const sequence of fixtures.sequences) test('scenario/' + sw + '/' + game + '/' + sequence.id, async source => {
  const env = environment({ source, sw }); env.setSession(session('scenario'));
  let created;
  const originalCreate = env.context.KunuzOnline.create;
  env.context.KunuzOnline = { ...env.context.KunuzOnline, create: options => (created = originalCreate(options)) };
  let client = env.context.KunuzOnline.create({ game, origin: ORIGIN }); client.bind(room);
  const createEntry = entry(env, game);
  const raw = message => { env.messages.push(message); return true; };
  const initial = sequence.roomGeneration === 'LEGACY' ? 'legacy-fix46-4725edfd' : 'account-exact';
  if (sequence.roomGeneration && sequence.steps[0].event !== 'create') { env.fixture(initial); await createEntry(); client = created; await open(env, client); client.observe(snap()); }
  for (const step of sequence.steps) {
    env.fixture(step.fixture); const count = env.messages.length, posts = env.posts.length;
    switch (step.event) {
      case 'create':
      case 'explicit-new-room':
        await createEntry(); client = created;
        assert.equal(env.posts.length, posts + 1); await open(env, client); client.observe(snap()); break;
      case 'hello': await open(env, client); client.observe(snap()); assert.equal(env.messages.at(-1).session, session('scenario')); break;
      case 'start':
        await client.send({ t: 'start', rev: 1 }, raw); assert.equal(env.messages.at(-1).session, session('scenario')); client.observe(snap('board', 2, 1)); await assert.rejects(client.legacyConsumption()); break;
      case 'rematch':
        client.observe(snap('final', 3, 1)); await client.send({ t: 'rematch', rev: 3, expect: { phase: 'final', round: 1, tb: 0 } }, raw);
        assert.equal(env.messages.at(-1).session, session('scenario')); assert.equal(env.messages.at(-1).rev, 3); assert.equal(env.messages.at(-1).expect.phase, 'final'); client.observe(snap('board', 4, 2)); await assert.rejects(client.legacyConsumption()); break;
      case 'start-acknowledged-and-post-checked':
        await client.send({ t: 'start', rev: 1 }, raw); client.observe(snap('board', 2, 1)); assert.equal(await client.legacyConsumption(), true); assert(!('session' in env.messages.at(-1))); break;
      case 'reconnect':
      case 'resume':
        client.disconnect();
        if ((step.fixture === 'account-exact' ? 'ACCOUNT' : 'LEGACY') !== sequence.roomGeneration) { await assert.rejects(open(env, client)); assert.equal(env.messages.length, count); }
        else { await open(env, client); assert.equal(env.messages.at(-1).hostToken, 'synthetic-room-host'); await assert.rejects(client.send({ t: 'start' }, raw)); client.observe(snap()); }
        break;
      case 'established-socket':
        client.observe(snap('question', 2, 1)); await client.send({ t: 'answer', qn: 1, pos: 0 }, raw); assert.equal(env.messages.length, count + 1); await assert.rejects(client.send({ t: 'rematch', rev: 2 }, raw)); break;
      case 'socket-closed': client.disconnect(); await assert.rejects(open(env, client)); assert.equal(env.messages.length, count); break;
      case 'explicit-retry': await open(env, client); client.observe(snap('board', 2, 1)); assert.equal(env.messages.length, count + 1); break;
      case 'snapshot-started':
      case 'snapshot-definitely-not-started':
      case 'snapshot-unknown': {
        env.fixture('account-exact'); await open(env, client); client.observe(snap()); await client.send({ t: 'start', rev: 1 }, raw);
        await assert.rejects(client.send({ t: 'start', rev: 1 }, raw), 'lost reply cannot replay'); client.disconnect(); env.fixture(step.fixture);
        if (step.event === 'snapshot-unknown') { await assert.rejects(open(env, client)); await assert.rejects(client.send({ t: 'start' }, raw)); }
        else { await open(env, client); const before = env.messages.length; client.observe(step.event === 'snapshot-started' ? snap('board', 2, 1) : snap()); assert.equal(env.messages.length, before, 'snapshot never auto-replays'); if (step.event === 'snapshot-definitely-not-started') { await client.send({ t: 'start', rev: 1 }, raw); assert.equal(env.messages.at(-1).rev, 1); client.observe(snap('board', 2, 1)); } }
        await assert.rejects(client.legacyConsumption()); break;
      }
      case 'start-acknowledged-post-check':
        env.fixture('legacy-fix46-4725edfd'); await client.send({ t: 'start', rev: 1 }, raw); client.observe(snap('board', 2, 1)); env.fixture(step.fixture); await assert.rejects(client.legacyConsumption()); assert.equal(client.generation, 'LEGACY'); break;
      case 'discovery': assert.equal(await client.modeForStart(), 'ACCOUNT'); break;
      case 'operation-SERVER':
      case 'operation-FORBIDDEN':
        client.permissionError(step.event.slice(10)); assert.equal(client.generation, 'ACCOUNT'); await assert.rejects(client.send({ t: 'start' }, raw)); await assert.rejects(client.legacyConsumption()); assert(env.notices.length); if (step.event.endsWith('FORBIDDEN')) assert.equal(env.context.refreshes, 1); break;
      case 'pending-old-result': await assert.rejects(client.send({ t: 'start' }, raw)); assert.equal(env.messages.length, count); break;
      default: throw Error('Unimplemented fixture event ' + step.event);
    }
  }
  assert.equal(JSON.parse(env.localStorage.getItem('ezik_auth_session_v1')).session, session('scenario'));
  assert(!env.localStorage.getItem('kunuz_worker_rooms_v1')?.includes(session('scenario')));
});
test('discovery/anonymous-and-random-probes', async source => {
  const env = environment({ source }); const client = env.context.KunuzOnline.create({ game: 'board', origin: ORIGIN });
  client.bind({ code: room.code, existing: false }); await open(env, client); client.observe(snap()); await client.send({ t: 'start', rev: 1 }, m => { env.messages.push(m); return true; });
  assert(!('session' in env.messages.at(-1))); const probes = env.calls.map(c => c.url); assert.equal(new Set(probes).size, probes.length);
});
test('discovery/untrusted-origin', async source => {
  const env = environment({ source }); assert.throws(() => env.context.KunuzOnline.create({ game: 'board', origin: 'https://other.example' })); assert.equal(env.calls.length, 0);
});
test('discovery/body-total-deadline', async source => {
  const env = environment({ source }); let cancelled = false, signal;
  env.context.fetch = async (url, options) => {
    signal = options.signal;
    return { url, status: 200, headers: new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' }), body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => { cancelled = true; } }) } };
  };
  const pending = env.context.KunuzOnline.discover(ORIGIN, () => true);
  await env.tick(); const deadline = [...env.timers.values()].find(t => t.ms === 5000); assert(deadline); deadline.fn();
  assert.equal(await pending, 'UNKNOWN'); assert(signal.aborted); assert(cancelled);
});
for (const game of ['hanna', 'harb', 'board']) for (const generation of ['ACCOUNT', 'LEGACY']) {
  test('wire/' + game + '/' + generation, async source => {
    const env = environment({ source }); env.setSession(session('hello'));
    const live = await connected(env, game, generation);
    const hello = env.messages.find(m => m.t === 'hello'); assert(hello);
    assert.equal(hello.session, generation === 'ACCOUNT' ? session('hello') : undefined);
    assert.equal(hello.roomId, live.credentials.roomId);
    assert.equal(hello[game === 'hanna' ? 'token' : 'hostToken'], live.credentials.hostToken);
    assert.equal(hello.deviceId, live.credentials.deviceId);
    if (game === 'hanna') { assert.equal(hello.protocolVersion, 4); assert.equal(hello.cap, 1); assert.equal(hello.role, 'host'); }
    else assert.equal(hello.v, 1);
    if (game === 'board') assert.equal(hello.bankStamp, 'fixture-bank');
    env.setSession(session('start')); assert.notEqual(await live.send({ t: 'start', rev: 1 }), false);
    const start = env.messages.find(m => m.t === 'start'); assert(start); assert.equal(start.session, generation === 'ACCOUNT' ? session('start') : undefined);
    if (game === 'board') assert.equal(start.rev, 1);
    const count = env.messages.length; assert.equal(await live.send({ t: 'start', rev: 1 }).catch(() => false), false); assert.equal(env.messages.length, count, 'no replay before snapshot');
    live.receive(live.snapshot('board', 2, 1));
    const beforeReconnect = env.messages.length; await live.reconnect(); live.socketOpen(); assert.equal(env.messages.length, beforeReconnect + 1); assert.equal(env.messages.at(-1).t, 'hello');
    assert.equal(await live.send({ t: 'start', rev: 1 }).catch(() => false), false); live.receive(live.snapshot('final', 3, 1));
    env.setSession(session('rematch')); assert.notEqual(await live.send({ t: 'rematch', rev: 3, expect: { phase: 'final', round: 1, tb: 0 } }), false); assert.equal(env.messages.at(-1).t, 'rematch');
    assert.equal(env.messages.at(-1).session, generation === 'ACCOUNT' ? session('rematch') : undefined);
    live.receive(live.snapshot('board', 4, 2));
    env.fixture('timeout'); const beforePlay = env.messages.length;
    await live.send({ t: 'answer', qn: 1, pos: 0 }); assert.equal(env.messages.length, beforePlay + 1, 'non-start play continues');
    assert.equal(await live.send({ t: 'rematch', rev: 4 }).catch(() => false), false);
    assert(!env.localStorage.getItem('kunuz_worker_rooms_v1').includes(session('rematch')));
  });
  test('consumption/' + game + '/' + generation, async source => {
    const env = environment({ source }); env.setSession(session('consume')); const live = await connected(env, game, generation), bridge = iap(env);
    const action = live.startEntry(); assert.equal(action.options.online, live.controller);
    const pending = bridge.begin(action.send, game, action.options); await env.tick(); await env.tick();
    assert.equal(env.messages.filter(m => m.t === 'start').length, 1);
    live.receive(live.snapshot('board', 2, 1)); await pending;
    assert.equal(bridge.consume.length, generation === 'ACCOUNT' ? 0 : 1);
    if (generation === 'LEGACY') { assert.equal(bridge.consume[0].gameId, game); assert.equal(bridge.consume[0].intent, 'automatic'); assert.equal(bridge.consume[0].sessionId, 'synthetic-idempotent-request'); assert.equal(env.calls.filter(c => c.url.includes('/api/account-capabilities')).length, 4, 'open, policy, pre-send, post-ack'); }
  });
  test('transition/' + game + '/' + generation, async source => {
    const env = environment({ source }); env.setSession(session('kept')); const live = await connected(env, game, generation);
    env.fixture(generation === 'ACCOUNT' ? 'legacy-fix46-4725edfd' : 'account-exact'); const before = env.messages.length;
    assert.equal(await live.send({ t: 'start', rev: 1 }).catch(() => false), false); assert.equal(env.messages.length, before); assert.equal(live.controller.generation, generation);
    assert(env.notices.some(n => n.reason === 'generation-changed')); assert.equal(JSON.parse(env.localStorage.getItem('ezik_auth_session_v1')).session, session('kept'));
  });
}
for (const game of ['hanna', 'harb', 'board']) test('consumption/post-switch/' + game, async source => {
  const env = environment({ source }); env.setSession(session('no-debit')); const live = await connected(env, game, 'LEGACY'), bridge = iap(env), action = live.startEntry();
  const pending = bridge.begin(action.send, game, action.options); await env.tick(); await env.tick(); env.fixture('account-exact'); live.receive(live.snapshot('board', 2, 1)); await pending;
  assert.equal(bridge.consume.length, 0); assert(env.notices.some(n => n.reason === 'generation-changed'));
});
async function run(source, selected = tests) {
  const rows = [];
  for (const t of selected) { let timer; try { await Promise.race([t.fn(source), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('harness watchdog')), 2000); })]); rows.push({ id: t.id, pass: true }); } catch (error) { rows.push({ id: t.id, pass: false, error: error.message }); } finally { clearTimeout(timer); } }
  return rows;
}
async function main() {
  const rows = await run(core); results.push(...rows); for (const r of rows.filter(r => !r.pass)) console.error('FAIL ' + r.id + ': ' + r.error);
  console.log('c1gamesgeneration ' + rows.filter(r => r.pass).length + '/' + rows.length);
  if (rows.some(r => !r.pass)) { process.exitCode = 1; return; }
  const mutations = [
    ['account-absent', "return ACCOUNT;", "return UNKNOWN;"],
    ['legacy-absent', "return LEGACY;", "return UNKNOWN;"],
    ['unknown-downgrade', "const generation = await discover(origin, current, abort.signal);", "const detected = await discover(origin, current, abort.signal); const generation = detected === UNKNOWN ? ACCOUNT : detected;"],
    ['superseded-resumes', 'suspend() { invalidate();', 'suspend() {'],
    ['operation-invalidation-removed', 'invalidate();', ''],
    ['generation-reinterpreted', "if (room.generation !== generation) return fail('generation-changed');", 'room.generation = generation;'],
    ['old-room-guessed-account', "if (room.existing && generation !== LEGACY) return fail('generation-changed');", ''],
    ['replay-lost-start', '|| pendingStart', ''],
    ['account-session-omitted', 'if (session) value.session = session;', 'if (false) value.session = session;'],
    ['legacy-session-added', 'if (generation === ACCOUNT) { const session = accountSession();', 'if (true) { const session = accountSession();'],
    ['anonymous-empty-field', 'if (session) value.session = session;', 'value.session = session;'],
    ['authority-error-ignored', "if (code === 'FORBIDDEN' || code === 'SERVER')", 'if (false)'],
    ['foreign-origin-accepted', "if (url.origin === 'https://hanna-laha.hl-worker.workers.dev') return url.origin;", 'return url.origin;'],
    ['post-check-omitted', "const ack = acknowledged, ticket = await fresh('post-start');", "const ack = acknowledged, ticket = { mine: epoch, room, generation: LEGACY };"],
    ['room-snapshot-gate-omitted', '!snapshotReady ||', ''],
    ['probe-echo-ignored', 'data.probe === probe', 'true'],
    ['body-bound-removed', 'size > 4096', 'size > 1000000'],
    ['deadline-removed', 'performance.now() - started >= 5000', 'false'],
    ['timeout-accepts-account', 'resolve(UNKNOWN);', 'resolve(ACCOUNT);']
  ];
  const covered = new Set(), evidence = [];
  for (const [name, before, after] of mutations) {
    assert(core.includes(before), 'mutation target exists: ' + name);
    const mutated = core.replaceAll(before, after), outcomes = await run(mutated);
    const killed = outcomes.filter(r => !r.pass);
    assert(killed.length, 'mutation must fail: ' + name);
    assert(killed.every(r => !/not defined|Unexpected token|watchdog/.test(r.error)), 'behavioral failures only: ' + name);
    killed.forEach(r => covered.add(r.id)); evidence.push({ name, killed: killed.map(r => r.id) });
  }
  const uncovered = tests.filter(t => !covered.has(t.id)).map(t => t.id);
  assert.deepEqual(uncovered, [], 'every case must fail under a semantic mutation');
  if (process.env.C1_GAMES_PROOF) require('fs').writeFileSync(process.env.C1_GAMES_PROOF, JSON.stringify({ cases: rows.length, responseFixtures: fixtures.responseCases.length, scenarios: fixtures.sequences.length, mutations: evidence, uncovered }, null, 2) + '\n');
  console.log('PASS ' + mutations.length + ' semantic mutants; every one of ' + tests.length + ' cases covered.');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { tests, run, core };
