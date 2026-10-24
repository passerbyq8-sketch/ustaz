// guards/brain-postship-5-guard.cjs -- POSTSHIP ITEM 5 -- 2026-10-24 (row 12)
//
// THE ANSWER-LOG TAB OPENS. Measured (sessions/side-brain-postship-2026-10-24/EZIK-EXT-ANSWER-LOG-WEEK-2026-10-24.txt
// lines 2-9, and the order, item 5): every day took 13-20 seconds to read on production, and the app aborts the
// request at 12 (EZIK_INBOX_TIMEOUT_MS, app.jsx). lib/answer-log.js readAnswerLog read the day's index and then ONE
// store request per record; api/inbox.js answersList takes a day and the tab never sent one.
//
// The order: (a) read in batches, one request per hundred records at most, through a new helper in lib/ledger/redis.js
// on that file's own rule (an absent store is an empty list, not an error); (b) the tab chooses the day -- today and the
// days before it within the 30-day retention, keyed by the server's UTC day, today by default.
// Acceptance: a fake store, 200 records: 201 requests -> 3 at most; 60 ms per request: over 12 s -> under 1 s; the tab
// asks for the chosen day; the existing inbox gates stay green.
'use strict';
const path = require('path');
const fs = require('fs');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

(async () => {
  const AL = await esm('lib/answer-log.js');
  const REDIS = await esm('lib/ledger/redis.js');
  const DAY = '20261023';
  const N = 200;
  const rec = (i) => JSON.stringify({ trace: 'tr' + String(i).padStart(5, '0'), day: DAY, path: i % 2 ? 'bw2' : 'free-brain', cited: i % 3 });
  // a fake Upstash client behind the module's own test seam: every round trip counted, each one DELAY ms
  function fake(delay) {
    const kv = new Map();
    for (let i = 0; i < N; i += 1) kv.set('al:v1:tr' + String(i).padStart(5, '0'), rec(i));
    kv.set('al:v1:d:' + DAY, Array.from({ length: N }, (_, i) => 'tr' + String(N - 1 - i).padStart(5, '0')));
    const c = { calls: 0 };
    const wait = () => new Promise((r) => setTimeout(r, delay));
    c.get = async (k) => { c.calls += 1; await wait(); return kv.has(k) ? kv.get(k) : null; };
    c.lrange = async (k, a, b) => { c.calls += 1; await wait(); const l = kv.get(k) || []; return l.slice(a, b + 1); };
    c.mget = async (...keys) => { c.calls += 1; await wait(); return keys.flat().map((k) => (kv.has(k) ? kv.get(k) : null)); };
    return c;
  }
  console.log('-- 1. the read, in batches');
  try {
    const f0 = fake(0);
    REDIS.__setRedisForTest(f0);
    const all = await AL.readAnswerLog({ day: DAY, limit: N });
    ok('200 records read back, newest first', all.length === N && all[0].trace === 'tr00199', all.length + ' ' + (all[0] || {}).trace);
    ok('store requests for 200 records: 3 at most (was 201)', f0.calls <= 3, String(f0.calls));
    const f1 = fake(0);
    REDIS.__setRedisForTest(f1);
    const some = await AL.readAnswerLog({ day: DAY, path: 'bw2', limit: 5 });
    ok('a filtered read still filters and stops at its limit', some.length === 5 && some.every((r) => r.path === 'bw2'));
    const f2 = fake(60);
    REDIS.__setRedisForTest(f2);
    const t0 = Date.now();
    const timed = await AL.readAnswerLog({ day: DAY, limit: N });
    const ms = Date.now() - t0;
    ok('60 ms per request: under 1 s for 200 records (was over 12 s)', timed.length === N && ms < 1000, ms + ' ms, ' + f2.calls + ' requests');
    console.log('        measured: ' + ms + ' ms, ' + f2.calls + ' requests');
    REDIS.__setRedisForTest(null);
    ok('no store: an empty list, not an error', Array.isArray(await AL.readAnswerLog({ day: DAY })) && (await AL.readAnswerLog({ day: DAY })).length === 0);
    ok('the helper itself: no store is an empty list', typeof REDIS.mget === 'function' && Array.isArray(await REDIS.mget(['a', 'b'])) && (await REDIS.mget(['a', 'b'])).length === 0);
  } finally { REDIS.__resetRedis(); }

  console.log('-- 2. the tab chooses the day');
  const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  ok('the answers list call sends the chosen day', /action: 'list', kind: which(?:, \.\.\.\(which === 'answers' \? \{ day: ansDay \} : \{\}\))/u.test(app));
  ok('the day keys are the server\'s: UTC, YYYYMMDD, today and the 29 before', /function ezikAnswerLogDays\(/u.test(app) && /toISOString\(\)\.slice\(0, 10\)\.replace\(\/-\/g, ''\)/u.test(app.slice(app.indexOf('function ezikAnswerLogDays('), app.indexOf('function ezikAnswerLogDays(') + 600)));
  const m = /function ezikAnswerLogDays\([^)]*\)\s*\{([\s\S]*?)\n\}/u.exec(app);
  let days = null;
  try { days = m ? new Function('now', m[1])(Date.UTC(2026, 9, 24, 23, 30)) : null; } catch (e) { days = null; }
  ok('thirty days, today first (UTC)', Array.isArray(days) && days.length === 30 && days[0] === '20261024' && days[29] === '20260925', JSON.stringify(days && [days[0], days[29], days.length]));
  ok('a changed day reloads the list', /\[kind, ansDay\]\)/u.test(app));
  ok('the server takes the day it is sent (api/inbox.js)', /body\.day/u.test(fs.readFileSync(path.join(REPO, 'api/inbox.js'), 'utf8')));

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
