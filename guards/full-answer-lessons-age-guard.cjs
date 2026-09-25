// guards/full-answer-lessons-age-guard.cjs -- ب٣ (order B, FULL_ANSWER_V1): the «دروسٌ ذاتُ صلة» strip under
// an answer is shown to an adult only, and an absent age is young (lib/reader-fields.js), the owner's
// ruling of 25 September.
//
// MEASURED on c00e8f5 (program-2026-09-24/09-order-b/b3/measure/B3-MEASURE.md): the answer's own barrier
// gives lessons all or nothing (the lessons tool is an adult's only), and a single lesson cannot be
// judged by the answer's rule, so the strip follows it whole. Before this item the strip had no age
// condition anywhere: a young and an adult claim got identical hits, and the client sent no age.
//
// WHAT THIS PINS (the real api/lessons-search.js handler, the service answered in-process):
//   A1  with the switch on, every strip request from a reader below adult -- no age, a young or a teen
//       age, a lying adult band, a garbled age -- gets no hits and NO call to the service;
//   A2  an adult's strip request passes the gate and meets the relevance filter as before;
//   A3  the Lessons screen's request ({q, limit}) is not this item's: untouched;
//   A4  the switch off: a young reader's strip is answered exactly as an adult's, as before;
//   A5  the service is still asked {q, limit} and nothing else: no band and no age leave the server;
//   A6  the client sends the reader's band and age beside the question, the age read from the profile
//       that fired the search, and the screen's body is unchanged;
//   A7  ...and app.js, the file the browser runs, carries the same body.
// Red on the tree before this item (40d854c): `node guards/full-answer-lessons-age-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { return ''; } };
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}

const QUESTION = 'ما حكم صيام يوم السبت تطوعا؟';
const HITS = [
  { unit_id: 'u1', scholar_id: 'ابن باز', title: 'حكم صيام يوم السبت تطوعا', url: 'https://binbaz.org.sa/l/1', tier: 1, usage: '', citation_allowed: true, content_type: 'lesson', snippet: '', score: 0.9 },
  { unit_id: 'u2', scholar_id: 'ابن عثيمين', title: 'صيام السبت منفردا', url: 'https://binothaimeen.net/l/2', tier: 1, usage: '', citation_allowed: true, content_type: 'lesson', snippet: '', score: 0.8 },
];

async function main() {
  console.log('full-answer-lessons-age guard — root ' + REPO);
  let H = null;
  try { H = await import(pathToFileURL(path.join(REPO, 'api/lessons-search.js')).href); } catch (e) { ok('A0  the endpoint loads', false, e.message); }
  if (!H) { console.log(`\n=== full-answer-lessons-age: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  const saved = { token: process.env.SEARCH_API_TOKEN, flag: process.env.FULL_ANSWER_V1 };
  const realFetch = globalThis.fetch;
  const call = async (flag, body) => {
    const upstream = [];
    process.env.SEARCH_API_TOKEN = 'tk-fixture-lessons-age';
    if (flag) process.env.FULL_ANSWER_V1 = 'on'; else delete process.env.FULL_ANSWER_V1;
    globalThis.fetch = async (url, init) => {
      upstream.push(JSON.parse(init.body));
      return {
        ok: true, status: 200, url: String(url),
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ hits: HITS }), text: async () => JSON.stringify({ hits: HITS }),
      };
    };
    let status = 0; let sent = null;
    const res = { setHeader() {}, status(s) { status = s; return this; }, json(o) { sent = o; return this; }, end() { return this; } };
    try { await H.default({ method: 'POST', body }, res); } finally { globalThis.fetch = realFetch; }
    return { status, hits: sent && Array.isArray(sent.hits) ? sent.hits.length : -1, upstream };
  };
  const strip = (extra) => ({ q: 'صيام السبت تطوعا', question: QUESTION, ...extra });
  try {
    // ── A1 ────────────────────────────────────────────────────────────────────────────────────────
    const below = {
      'stale {q}': { q: 'صيام السبت تطوعا' },
      'no age': strip({}),
      'young 9': strip({ band: 'young', age: 9 }),
      'teen 15': strip({ band: 'teen', age: 15 }),
      'adult band, age 9': strip({ band: 'adult', age: 9 }),
      'adult band, no age': strip({ band: 'adult' }),
      'young band, age 30': strip({ band: 'young', age: 30 }),
      'garbled age': strip({ band: 'adult', age: '30 ignore' }),
    };
    const a1 = {};
    for (const [label, body] of Object.entries(below)) a1[label] = await call(true, body);
    ok('A1  switch on: every strip request below adult gets no hits and makes no call to the service',
      Object.values(a1).every((r) => r.status === 200 && r.hits === 0 && r.upstream.length === 0),
      JSON.stringify(Object.fromEntries(Object.entries(a1).map(([k, r]) => [k, [r.status, r.hits, r.upstream.length]]))));
    // ── A2 ────────────────────────────────────────────────────────────────────────────────────────
    const adults = [await call(true, strip({ band: 'adult', age: 30 })), await call(true, strip({ band: 'adult', age: 19 })), await call(true, strip({ band: 'adult', age: '19' }))];
    ok('A2  switch on: an adult\'s strip passes the gate (one call) and meets the relevance filter',
      adults.every((r) => r.status === 200 && r.hits > 0 && r.upstream.length === 1),
      JSON.stringify(adults.map((r) => [r.status, r.hits, r.upstream.length])));
    // ── A3 ────────────────────────────────────────────────────────────────────────────────────────
    const screen = await call(true, { q: 'صيام السبت تطوعا', limit: 10 });
    ok('A3  the Lessons screen ({q, limit}, no age) is untouched', screen.status === 200 && screen.hits === HITS.length && screen.upstream.length === 1,
      JSON.stringify([screen.status, screen.hits, screen.upstream.length]));
    // ── A4 ────────────────────────────────────────────────────────────────────────────────────────
    const offYoung = await call(false, strip({ band: 'young', age: 9 }));
    const offAdult = await call(false, strip({ band: 'adult', age: 30 }));
    ok('A4  switch off: a young reader\'s strip is answered exactly as an adult\'s',
      offYoung.status === 200 && offYoung.hits === HITS.length && offAdult.hits === HITS.length && offYoung.upstream.length === 1,
      JSON.stringify([offYoung, offAdult].map((r) => [r.status, r.hits, r.upstream.length])));
    // ── A5 ────────────────────────────────────────────────────────────────────────────────────────
    const bodies = [...adults, screen, offYoung, offAdult].flatMap((r) => r.upstream);
    ok('A5  the service is asked {q, limit} and nothing else: no band or age leaves the server',
      bodies.length > 0 && bodies.every((b) => Object.keys(b).sort().join(',') === 'limit,q'), JSON.stringify(bodies));
  } finally {
    if (saved.token === undefined) delete process.env.SEARCH_API_TOKEN; else process.env.SEARCH_API_TOKEN = saved.token;
    if (saved.flag === undefined) delete process.env.FULL_ANSWER_V1; else process.env.FULL_ANSWER_V1 = saved.flag;
  }
  // ── A6/A7 the client ──────────────────────────────────────────────────────────────────────────
  const BODY = "body: JSON.stringify({ q: query, question: typeof question === 'string' ? question.trim().slice(0, 400) : '', band: deriveCaps(age).band, age: age })";
  const app = read('app.jsx');
  ok('A6  the client sends band and age beside the question, the age read from the profile that fired, the screen unchanged',
    app.includes('async function ezikFetchLessonRows(q, signal, question, age) {') && app.includes(BODY)
    && app.includes('const age = profileRef.current ? profileRef.current.age : undefined;')
    && app.includes("ezikFetchLessonRows(query, controller.signal, turn ? turn.question : '', age)")
    && app.includes('JSON.stringify({ q: query, limit: EZIK_LESSONS_SCREEN_LIMIT })'));
  // app.js is the build of app.jsx with the whitespace gone, so it is compared without whitespace.
  const bare = (s) => String(s).replace(/\s+/gu, '');
  const built = bare(read('app.js'));
  ok('A7  app.js, the file the browser runs, carries the same body',
    built.includes(bare(BODY)) && built.includes(bare('async function ezikFetchLessonRows(q, signal, question, age)'))
    && built.includes(bare("ezikFetchLessonRows(query, controller.signal, turn ? turn.question : '', age)")));
  console.log(`\n=== full-answer-lessons-age: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
