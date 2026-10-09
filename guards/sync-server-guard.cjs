// guards/sync-server-guard.cjs -- items 24 + 58, the server half, driven for real.
//
// THE REAL HANDLERS AND THE REAL MODULES, imported from the tree: api/sync.js, lib/sync/*,
// lib/auth/*, lib/daycap.js. The one stand-in is the store: guards/sync-fake-store.cjs, an
// in-memory Upstash installed through the seams the three store modules already publish. The
// encryption is real AES-256-GCM under a key generated in this process and never printed.
//
// ONE SECTION PER DECISION (order section T1, and section 6 "local on the server"):
//   E  encryption   no plain text in the store, nor in any log line
//   I  isolation    one account never reaches another's space
//   C  conflict     conversations join, counters take the larger, settings the last, a deletion stays
//   D  deletion     wipe empties and keeps the account; account delete erases everything
//   X  export       the file holds everything synced, conversations included, nothing device-only
//   L  link         two identities, one space, merged by the same rules
//   Q  cap          account + device counted together; one account on two devices one day; guest unchanged
//   S  switch       off closes everything new; owner opens only the owner and the test account;
//                   absent and corrupt are off
//   P  people       with the switch off, a reader's request and cap behave exactly as on the base
//   M  memory (58)  the address line: off/unset -> nothing; gender changes the address only; no name
//
// Usage: node guards/sync-server-guard.cjs     Exit 0 when every case holds.
'use strict';

const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { makeStore } = require('./sync-fake-store.cjs');

const REPO = path.join(__dirname, '..');
const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

const results = [];
let failed = 0;
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: cond ? '' : (detail || '') });
  if (!cond) failed++;
}

// Every console line any handler prints is captured here and checked for content.
const LOGS = [];
for (const k of ['log', 'warn', 'error', 'info']) {
  const orig = console[k];
  console[k] = (...a) => { LOGS.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); if (process.env.SYNC_GUARD_VERBOSE) orig(...a); };
}
const say = (s) => process.stdout.write(s + '\n');

function fakeRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[String(k).toLowerCase()] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}

const SECRET = 'PLAINTEXT-MARKER-' + crypto.randomBytes(6).toString('hex');
const OWNER_EMAIL = 'owner@example.com';
const TEST_EMAIL = 'tester@example.com';

async function main() {
  process.env.VERCEL_ENV = 'preview';
  process.env.SYNC_ENC_KEY = crypto.randomBytes(32).toString('hex');
  process.env.SYNC_SWITCH = 'all';
  delete process.env.SYNC_TEST_ACCOUNTS;
  process.env.DAY_CAP = '3';

  const AUTHSTORE = await load('lib/auth/store.js');
  const ACCOUNT = await load('lib/auth/account.js');
  const SSTORE = await load('lib/sync/store.js');
  const SVC = await load('lib/sync/service.js');
  const FLAG = await load('lib/sync/flag.js');
  const MERGE = await load('lib/sync/merge.js');
  const CRYPTO = await load('lib/sync/crypto.js');
  const MEM = await load('lib/sync/memory.js');
  const DAYCAP = await load('lib/daycap.js');
  const ROUTE = await load('api/sync.js');
  ROUTE.__setSyncRouteDepsForTest({ allow: async () => true });

  let store = null;
  const fresh = () => {
    store = makeStore();
    AUTHSTORE.__setAuthStoreForTest(store);
    SSTORE.__setSyncStoreForTest(store);
    DAYCAP.__setRedisForTest(store);
    return store;
  };
  fresh();

  async function account(provider, sub, email) {
    const a = await ACCOUNT.upsertAccount({ provider, sub, email, emailVerified: true });
    const s = await ACCOUNT.mintSession(a.key);
    return { key: a.key, session: s.session };
  }
  async function call(body, headers) {
    const req = { method: 'POST', headers: Object.assign({ 'x-murabbi-device': 'device-aaaa1111' }, headers || {}), body };
    const res = fakeRes();
    await ROUTE.default(req, res);
    return res;
  }
  const rec = (u, val, del) => ({ u, del: !!del, val });
  const msg = (role, ts, text) => ({ role, content: text, timestamp: new Date(ts).toISOString() });

  // ---------------------------------------------------------------- two devices, one account
  {
    fresh();
    const A = await account('google', '1001', 'a@example.com');
    // device 1 pushes a conversation (with an image) and settings
    const chat1 = { title: 't', pinned: false, at: 10, msgs: [msg('user', 1000, 'سؤال ' + SECRET), { role: 'assistant', timestamp: new Date(2000).toISOString(), content: [{ type: 'image', source: { data: 'AAAA' } }, { type: 'text', text: 'جواب ' + SECRET }] }] };
    let r = await call({ action: 'push', session: A.session, changes: [{ id: 'chat:c1', rec: rec(10, chat1) }, { id: 'kv:ezik_ui_lang_v1', rec: rec(10, '"fr"') }] });
    check('two devices: device 1 pushes', r.statusCode === 200 && r.body.results.every((x) => x.ver === 1), JSON.stringify(r.body));
    const stored = r.body.results[0].rec.val.msgs[1].content;
    check('conversations are stored as TEXT: the image block is replaced by the mark', Array.isArray(stored) && stored.every((b) => b.type === 'text') && stored[0].text === MERGE.IMAGE_ELSEWHERE, JSON.stringify(stored).slice(0, 200));
    // device 2 pulls from zero and sees both
    r = await call({ action: 'pull', session: A.session, cursor: 0 }, { 'x-murabbi-device': 'device-bbbb2222' });
    check('two devices: device 2 pulls everything from cursor 0', r.statusCode === 200 && r.body.changes.length === 2 && r.body.cursor === 2, JSON.stringify(r.body).slice(0, 300));
    const cur = r.body.cursor;
    r = await call({ action: 'pull', session: A.session, cursor: cur });
    check('two devices: a pull from the latest cursor returns nothing new', r.body.changes.length === 0);
    // the guest's own device data goes up on sign-in (a push of records the account never had)
    r = await call({ action: 'push', session: A.session, changes: [{ id: 'kv:ezik_hijri_offset_v1', rec: rec(5, '1') }] });
    check('guest upload: a device record new to the account is added, nothing removed', r.body.results[0].ver === 1);
    r = await call({ action: 'pull', session: A.session, cursor: 0 });
    check('account + device JOIN: three records now, none lost', r.body.changes.length === 3);

    // E -- no plain text anywhere in the store
    const dump = store.dump();
    check('E1 no plain text in the store (marker, Arabic, language value)', !dump.includes(SECRET) && !/[؀-ۿ]/.test(dump) && !dump.includes('"fr"'), dump.slice(0, 120));
    check('E2 the account key (provider:subject) is never part of a sync key', ![...store.data.keys()].some((k) => k.startsWith('sync:') && k.includes('1001')));
    check('E3 every sync key carries the environment (preview namespace)', [...store.data.keys()].filter((k) => k.startsWith('sync:')).every((k) => k.startsWith('sync:v1:preview:')));

    // E4 -- a record moved to another id or space does not open
    const space = SSTORE.spaceIdOf(A.key);
    const env = await store.hget('sync:v1:preview:s:' + space + ':r', 'chat:c1');
    const keys = CRYPTO.loadKeys();
    let movedOpens = true;
    try { CRYPTO.open(keys, 'preview', space, 'chat:c2', env); } catch (e) { movedOpens = false; }
    let otherEnvOpens = true;
    try { CRYPTO.open(keys, 'production', space, 'chat:c1', env); } catch (e) { otherEnvOpens = false; }
    let rightOpens = false;
    try { rightOpens = CRYPTO.open(keys, 'preview', space, 'chat:c1', env).val.msgs.length === 2; } catch (e) { rightOpens = false; }
    check('E4 a sealed record opens only at its own id, space and environment', rightOpens && !movedOpens && !otherEnvOpens);
    const k2 = CRYPTO.loadKeys({ SYNC_ENC_KEY: crypto.randomBytes(32).toString('base64') });
    let wrongKey = true;
    try { CRYPTO.open(k2, 'preview', space, 'chat:c1', env); } catch (e) { wrongKey = false; }
    check('E5 another key does not open it; the key id travels with the record', !wrongKey && typeof env.k === 'string' && env.k.length === 8);
    check('E6 a missing or malformed SYNC_ENC_KEY is no key at all', CRYPTO.loadKeys({}) === null && CRYPTO.loadKeys({ SYNC_ENC_KEY: 'short' }) === null && CRYPTO.loadKeys({ SYNC_ENC_KEY: 'zz'.repeat(32) }) === null);

    // I -- isolation
    const B = await account('google', '2002', 'b@example.com');
    r = await call({ action: 'pull', session: B.session, cursor: 0 });
    check('I1 a second account sees none of the first account records', r.statusCode === 200 && r.body.changes.length === 0);
    r = await call({ action: 'pull', session: B.session, cursor: 0, account: A.key, space: SSTORE.spaceIdOf(A.key) });
    check('I2 naming another account or space in the body changes nothing', r.body.changes.length === 0);
    r = await call({ action: 'pull', session: 'x'.repeat(43), cursor: 0 });
    check('I3 a session that does not exist: 401, nothing read', r.statusCode === 401 && r.body.error === 'sync-session-invalid');
    r = await call({ action: 'pull', cursor: 0 });
    check('I4 no session: 401', r.statusCode === 401);
    r = await call({ action: 'pull', session: A.session, cursor: 0 }, { 'x-murabbi-device': '' });
    check('I5 no device header: 400', r.statusCode === 400);
    r = await call({ action: 'push', session: A.session, changes: [{ id: 'res:purchases', rec: rec(1, { x: 1 }) }] });
    check('I6 the reserved purchases place cannot be written by any device', r.body.results[0].refused === 'id');
  }

  // ---------------------------------------------------------------- conflict rules
  {
    fresh();
    const A = await account('google', '3003', 'c@example.com');
    const push = (changes, dev) => call({ action: 'push', session: A.session, changes }, { 'x-murabbi-device': dev || 'device-aaaa1111' });
    await push([{ id: 'chat:k', rec: rec(10, { title: 'one', pinned: false, at: 10, msgs: [msg('user', 1, 'q1'), msg('assistant', 2, 'a1')] }) }]);
    let r = await push([{ id: 'chat:k', rec: rec(20, { title: 'two', pinned: true, at: 20, msgs: [msg('user', 1, 'q1'), msg('user', 3, 'q2 from device 2'), msg('assistant', 4, 'a2')] }) }], 'device-bbbb2222');
    const m = r.body.results[0].rec.val;
    check('C1 conversations JOIN: every message of both devices, once each, in time order', m.msgs.length === 4 && m.msgs.map((x) => x.content).join(',') === 'q1,a1,q2 from device 2,a2', JSON.stringify(m.msgs));
    check('C2 ...and the newer side names the title and the pin', m.title === 'two' && m.pinned === true);
    r = await push([{ id: 'chat:k', rec: rec(5, { title: 'old', msgs: [msg('user', 1, 'q1 EDITED')] }) }]);
    check('C3 no message is written over another: an older edit is ADDED, the original kept', r.body.results[0].rec.val.msgs.some((x) => x.content === 'q1') && r.body.results[0].rec.val.msgs.some((x) => x.content === 'q1 EDITED') && r.body.results[0].rec.val.title === 'two');
    await push([{ id: 'ctr:ezik_khatmah_v1', rec: rec(10, { pages: 40, days: { a: 3, b: 1 } }) }]);
    r = await push([{ id: 'ctr:ezik_khatmah_v1', rec: rec(30, { pages: 12, days: { a: 1, b: 5, c: 2 } }) }], 'device-bbbb2222');
    const c = r.body.results[0].rec.val;
    check('C4 counters: the LARGER wins, leaf by leaf (even when the smaller is newer)', c.pages === 40 && c.days.a === 3 && c.days.b === 5 && c.days.c === 2, JSON.stringify(c));
    await push([{ id: 'kv:ezik_visual_theme_v2', rec: rec(50, '"dark"') }]);
    r = await push([{ id: 'kv:ezik_visual_theme_v2', rec: rec(40, '"light"') }], 'device-bbbb2222');
    check('C5 settings: the LAST change wins -- an older write does not replace a newer one', r.body.results[0].rec.val === '"dark"');
    r = await push([{ id: 'kv:ezik_visual_theme_v2', rec: rec(60, '"light"') }], 'device-bbbb2222');
    check('C6 ...and a newer one does', r.body.results[0].rec.val === '"light"');
    await push([{ id: 'chat:gone', rec: rec(10, { title: 'x', msgs: [msg('user', 1, 'bye')] }) }]);
    r = await push([{ id: 'chat:gone', rec: rec(11, null, true) }]);
    check('C7 a deletion is kept as a tombstone', r.body.results[0].rec.del === true && r.body.results[0].rec.val === null);
    r = await push([{ id: 'chat:gone', rec: rec(999, { title: 'x', msgs: [msg('user', 1, 'bye')] }) }], 'device-bbbb2222');
    check('C8 the deleted does NOT come back from a device that never saw the deletion, however new its clock', r.body.results[0].rec.del === true);
    // a race between two devices: both pushes based on the same version
    const pa = push([{ id: 'ctr:race', rec: rec(1, { n: 1 }) }]);
    const pb = push([{ id: 'ctr:race', rec: rec(2, { n: 2, m: 7 }) }], 'device-bbbb2222');
    await Promise.all([pa, pb]);
    r = await call({ action: 'pull', session: A.session, cursor: 0 });
    const race = r.body.changes.find((x) => x.id === 'ctr:race');
    check('C9 two simultaneous pushes of one record: compare-and-set keeps BOTH contributions', race && race.rec.val.n === 2 && race.rec.val.m === 7, JSON.stringify(race));
    check('C10 the merge rules refuse an id of no known kind', MERGE.kindOf('weird:x') === null && MERGE.kindOf('chat:ok') === 'chat' && MERGE.kindOf('res:purchases') === null);
  }

  // ---------------------------------------------------------------- deletion, export
  {
    fresh();
    const A = await account('google', '4004', 'd@example.com');
    const B = await account('google', '4005', 'e@example.com');
    await call({ action: 'push', session: A.session, changes: [{ id: 'chat:x', rec: rec(1, { title: 'x', msgs: [msg('user', 1, 'hello')] }) }, { id: 'kv:ezik_ui_lang_v1', rec: rec(1, '"ur"') }, { id: 'ctr:ezik_tasbih_log_v1', rec: rec(1, [1, 2]) }, { id: 'note:n1', rec: rec(1, { text: 'my note' }) }, { id: 'chat:dead', rec: rec(1, null, true) }] });
    await call({ action: 'push', session: B.session, changes: [{ id: 'kv:keep', rec: rec(1, '"b"') }] });
    let r = await call({ action: 'export', session: A.session });
    const f = r.body;
    check('X1 export: a file with every synced record, the conversations included', r.statusCode === 200 && /attachment/.test(r.headers['content-disposition'] || '') && f.records['chat:x'] && f.records['chat:x'].msgs[0].content === 'hello' && f.records['note:n1'] && f.records['kv:ezik_ui_lang_v1'] && f.records['ctr:ezik_tasbih_log_v1'], JSON.stringify(f).slice(0, 300));
    check('X2 export: deleted records are not in it, and nothing device-only exists to be in it', !('chat:dead' in f.records) && !Object.keys(f.records).some((k) => /qibla|prayer_place|reminders|ai_consent|parent_pin|directConvo|wird_alerts|prayer_notify/.test(k)));
    r = await call({ action: 'wipe', session: A.session });
    const spaceA = SSTORE.spaceIdOf(A.key);
    check('D1 delete-all-my-data: the space is empty on the server', r.statusCode === 200 && ![...store.data.keys()].some((k) => k.includes(spaceA)));
    r = await call({ action: 'pull', session: A.session, cursor: 0 });
    check('D2 ...and the account stays: its session still works and finds nothing', r.statusCode === 200 && r.body.changes.length === 0 && !!(await AUTHSTORE.readJson(A.key)));
    r = await call({ action: 'pull', session: B.session, cursor: 0 });
    check('D3 ...and another account is untouched', r.body.changes.length === 1);
    await call({ action: 'push', session: A.session, changes: [{ id: 'kv:again', rec: rec(1, '"a"') }] });
    await SVC.eraseForAccountDelete(A.key);
    await ACCOUNT.deleteAccount(A.key, A.session);
    check('D4 deleting the account: its space and its account record are gone', ![...store.data.keys()].some((k) => k.includes(spaceA)) && !(await AUTHSTORE.readJson(A.key)));
    r = await call({ action: 'pull', session: A.session, cursor: 0 });
    check('D5 ...and its session no longer opens anything', r.statusCode === 401);
  }

  // ---------------------------------------------------------------- link
  {
    fresh();
    const G = await account('google', '5005', 'p@example.com');
    const AP = await account('apple', '000123.abc', 'xyz@privaterelay.appleid.com');
    await call({ action: 'push', session: G.session, changes: [{ id: 'chat:g', rec: rec(1, { title: 'g', msgs: [msg('user', 1, 'from google')] }) }, { id: 'kv:theme', rec: rec(10, '"g"') }, { id: 'ctr:n', rec: rec(1, { n: 4 }) }] });
    await call({ action: 'push', session: AP.session, changes: [{ id: 'chat:a', rec: rec(1, { title: 'a', msgs: [msg('user', 2, 'from apple')] }) }, { id: 'kv:theme', rec: rec(20, '"a"') }, { id: 'ctr:n', rec: rec(1, { n: 9 }) }] });
    let r = await call({ action: 'link', session: G.session });
    check('L1 link needs BOTH sign-ins: without the other session, 401', r.statusCode === 401);
    r = await call({ action: 'link', session: G.session, otherSession: AP.session });
    check('L2 link: the two identities join', r.statusCode === 200 && r.body.moved === 3, JSON.stringify(r.body));
    const pg = await call({ action: 'pull', session: G.session, cursor: 0 });
    const pa = await call({ action: 'pull', session: AP.session, cursor: 0 });
    const ids = (x) => x.body.changes.map((c) => c.id + '=' + JSON.stringify(c.rec.val)).sort().join('|');
    check('L3 ...both sessions now reach ONE space', ids(pg) === ids(pa) && pg.body.changes.length === 4, ids(pg));
    const get = (x, id) => x.body.changes.find((c) => c.id === id).rec.val;
    check('L4 ...merged by the rules: both conversations, the newer setting, the larger counter', get(pg, 'kv:theme') === '"a"' && get(pg, 'ctr:n').n === 9 && !!get(pg, 'chat:a') && !!get(pg, 'chat:g'));
    r = await call({ action: 'push', session: AP.session, changes: [{ id: 'kv:after', rec: rec(1, '"x"') }] });
    const pg2 = await call({ action: 'pull', session: G.session, cursor: 0 });
    check('L5 a write through one identity is read through the other', pg2.body.changes.some((c) => c.id === 'kv:after'));
    r = await call({ action: 'link', session: G.session, otherSession: G.session });
    check('L6 linking an account to itself is refused', r.statusCode === 400);
    await SVC.eraseForAccountDelete(AP.key);
    const after = await call({ action: 'pull', session: G.session, cursor: 0 });
    check('L7 deleting a linked account erases the shared data and every link', after.body.changes.length === 0 && ![...store.data.keys()].some((k) => k.includes(':link:') || k.includes(':members:')));
  }

  // ---------------------------------------------------------------- cap
  {
    fresh();
    const A = await account('google', '6006', 'q@example.com');
    const B = await account('google', '6007', 'r@example.com');
    const ask = async (dev, session) => {
      const h = { 'x-murabbi-device': dev, cookie: 'mrb_did=cookie-' + dev };
      if (session) h['x-ezik-session'] = session;
      return DAYCAP.guardDayCap({ headers: h }, fakeRes());
    };
    let v;
    for (let i = 0; i < 3; i++) v = await ask('dev-one-11111', A.session);
    check('Q1 an account uses its three questions on device one', v.allowed === true && v.remaining === 0);
    v = await ask('dev-two-22222', A.session);
    check('Q2 ONE account on TWO devices has ONE day: device two is refused', v.allowed === false && v.reason === 'day-cap-reached');
    v = await ask('dev-one-11111', B.session);
    check('Q3 a NEW account on a device that spent its day gets no new day', v.allowed === false && v.reason === 'day-cap-reached');
    v = await ask('dev-three-3333', null);
    check('Q4 a guest on a fresh device: the cap as it is today', v.allowed === true && v.remaining === 2);
    const before = store.ops.length;
    await ask('dev-four-44444', null);
    const guestOps = store.ops.slice(before).map((o) => o[1]);
    check('Q5 a guest touches only the device and cookie counters', guestOps.every((k) => /^dc:v1:[dc]:/.test(k.split(',')[0])) && !guestOps.some((k) => k.includes('dc:v1:a:')), JSON.stringify(guestOps));
    process.env.DAY_CAP = '';
  }

  // ---------------------------------------------------------------- switch
  {
    fresh();
    process.env.EZIK_OWNER_ACCOUNTS = ACCOUNT.emailDigest(OWNER_EMAIL);
    const O = await account('google', '7001', OWNER_EMAIL);
    const T = await account('apple', '7002', TEST_EMAIL);
    const N = await account('google', '7003', 'nobody@example.com');
    const push = (s) => call({ action: 'push', session: s, changes: [{ id: 'kv:z', rec: rec(1, '"1"') }] });
    for (const off of [undefined, '', 'OFF', 'on', 'true', 'owner ', ' all', 'All', 'owners']) {
      if (off === undefined) delete process.env.SYNC_SWITCH; else process.env.SYNC_SWITCH = off;
      const want = off === 'owner ' ? 'owner' : off === ' all' ? 'all' : 'off';
      check('S1 SYNC_SWITCH=' + JSON.stringify(off) + ' reads as ' + want, FLAG.syncSwitch() === want);
    }
    process.env.SYNC_SWITCH = 'off';
    let r = await push(O.session);
    check('S2 off: closed even for the owner (403 sync-closed), before any record is read', r.statusCode === 403 && r.body.error === 'sync-closed' && !store.ops.some((o) => String(o[1]).startsWith('sync:v1:preview:s:')));
    r = await call({ action: 'status', session: O.session });
    check('S3 off: status says closed', r.body.open === false);
    delete process.env.SYNC_SWITCH;
    r = await push(O.session);
    check('S4 absent: closed', r.statusCode === 403);
    process.env.SYNC_SWITCH = 'garbage';
    r = await push(O.session);
    check('S5 corrupt: closed', r.statusCode === 403);
    process.env.SYNC_SWITCH = 'owner';
    r = await push(O.session);
    check('S6 owner: open for the owner (the inbox gate EZIK_OWNER_ACCOUNTS)', r.statusCode === 200);
    r = await push(T.session);
    check('S7 owner: closed for the test account while SYNC_TEST_ACCOUNTS is empty', r.statusCode === 403);
    process.env.SYNC_TEST_ACCOUNTS = 'not-a-digest, ' + ACCOUNT.emailDigest(TEST_EMAIL).toUpperCase();
    r = await push(T.session);
    check('S8 owner: open for the test account once its digest is in SYNC_TEST_ACCOUNTS', r.statusCode === 200);
    r = await push(N.session);
    check('S9 owner: closed for everybody else', r.statusCode === 403);
    r = await call({ action: 'status' });
    check('S10 owner: a guest is closed', r.body.open === false);
    await store.set(N.key, JSON.stringify({ v: 1, provider: 'google', sub: '7003', email: OWNER_EMAIL, emailVerified: false, createdAt: 1, lastSeenAt: 1 }));
    r = await push(N.session);
    check('S11 owner: an UNPROVED owner address opens nothing', r.statusCode === 403);
    process.env.SYNC_SWITCH = 'all';
    r = await call({ action: 'status' });
    check('S12 all: open for a guest too (the preview)', r.body.open === true);
    const keep = process.env.SYNC_ENC_KEY;
    delete process.env.SYNC_ENC_KEY;
    r = await push(O.session);
    check('S13 no encryption key: 503 sync-unavailable, nothing written in the clear', r.statusCode === 503 && r.body.error === 'sync-unavailable' && !store.dump().includes('"1"'));
    process.env.SYNC_ENC_KEY = keep;
    store.ops.length = 0;
    const down = makeStore({ down: true });
    SSTORE.__setSyncStoreForTest(down);
    r = await push(O.session);
    check('S14 a store that cannot be reached: 503, never an empty answer', r.statusCode === 503);
    SSTORE.__setSyncStoreForTest(store);
    delete process.env.SYNC_TEST_ACCOUNTS;
    delete process.env.EZIK_OWNER_ACCOUNTS;
  }

  // ---------------------------------------------------------------- people (switch off)
  {
    fresh();
    process.env.SYNC_SWITCH = 'off';
    process.env.DAY_CAP = '3';
    const A = await account('google', '8001', 's@example.com');
    const h = { 'x-murabbi-device': 'dev-pple-12345', cookie: 'mrb_did=cookie-pple-12345', 'x-ezik-session': A.session };
    store.ops.length = 0;
    const v = await DAYCAP.guardDayCap({ headers: h }, fakeRes());
    const keys = store.ops.map((o) => String(o[1]));
    check('P1 switch off: a signed-in reader cap reads exactly the device and cookie counters', v.allowed === true && !keys.some((k) => k.includes('dc:v1:a:') || k.startsWith('sess:')), JSON.stringify(keys));
    const addr = await MEM.addresseeFor({ headers: h }, { gender: 'female', name: 'X' });
    check('P2 switch off: no address line for anybody', addr === null && MEM.addressLineFor(addr) === '');
    process.env.DAY_CAP = '';
  }

  // ---------------------------------------------------------------- memory (58)
  {
    fresh();
    process.env.SYNC_SWITCH = 'all';
    const f = await MEM.addresseeFor({ headers: {} }, { gender: 'female' });
    const m = await MEM.addresseeFor({ headers: {} }, { gender: 'male' });
    const u = await MEM.addresseeFor({ headers: {} }, { gender: null });
    const junk = await MEM.addresseeFor({ headers: {} }, { gender: 'Female' });
    check('M1 all: a stated gender is the addressee; unset or malformed is none', f === 'female' && m === 'male' && u === null && junk === null);
    const lf = MEM.addressLineFor('female');
    const lm = MEM.addressLineFor('male');
    check('M2 the line speaks of the ADDRESS, and says the ruling, its evidence and detail do not change', /الخطاب/.test(lf) && /الحكم/.test(lf) && /بلا زيادة/.test(lf) && /الحكم/.test(lm));
    const withName = await MEM.addresseeFor({ headers: {} }, { gender: 'female', name: 'فاطمة' + SECRET, madhhab: 'hanafi' });
    check('M3 no road for the name or the madhhab: neither changes the result nor appears in the line', withName === 'female' && !MEM.addressLineFor(withName).includes(SECRET) && !/مذهب|حنف|شافع|مالك|حنبل/.test(lf + lm));
    check('M4 an unset gender adds NOTHING (the base prompt, byte for byte)', MEM.addressLineFor(null) === '' && MEM.translatorAddressLine(null) === '');
    check('M5 the translator line changes the form of address only', /form of address/.test(MEM.translatorAddressLine('female')) && /woman/.test(MEM.translatorAddressLine('female')) && /man/.test(MEM.translatorAddressLine('male')));
    process.env.SYNC_SWITCH = 'owner';
    process.env.EZIK_OWNER_ACCOUNTS = ACCOUNT.emailDigest(OWNER_EMAIL);
    const O = await account('google', '9001', OWNER_EMAIL);
    const N = await account('google', '9002', 'n@example.com');
    const fo = await MEM.addresseeFor({ headers: { 'x-ezik-session': O.session } }, { gender: 'female' });
    const fn = await MEM.addresseeFor({ headers: { 'x-ezik-session': N.session } }, { gender: 'female' });
    const fg = await MEM.addresseeFor({ headers: {} }, { gender: 'female' });
    check('M6 owner: the owner session opens item 58; another account and a guest do not', fo === 'female' && fn === null && fg === null);
    delete process.env.EZIK_OWNER_ACCOUNTS;
  }

  // ---------------------------------------------------------------- logs
  check('E7 not one log line carries content, a session or an account key', !LOGS.some((l) => l.includes(SECRET) || /acct:v1:|sess:v1:|[؀-ۿ]/.test(l)), LOGS.slice(0, 3).join(' / '));

  say('=== sync-server-guard: items 24 + 58, server ===');
  for (const r of results) say((r.ok ? '[PASS] ' : '[FAIL] ') + r.name + (r.ok ? '' : '  -- ' + r.detail));
  say('=== ' + (results.length - failed) + '/' + results.length + ' cases hold ===');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { say('[FAIL] the guard could not run: ' + (e && e.stack || e)); process.exit(1); });
