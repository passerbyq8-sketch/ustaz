// guards/full-answer-g-guard.cjs -- م٣-ز (FULL_ANSWER_V1): «دروسٌ ذاتُ صلة» — no lessons under a general
// question, none that shares no issue word with the question, and no title twice.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-ز): «لا دروسَ تحتَ السؤالِ العامّ، ولا يتكرّرُ الدرسُ نفسُه،
// وعتبةُ صلة — شواهدُها: «الطلاق عبر رسائل الجوال» تحتَ السيرةِ الذاتيّة، والدرسُ نفسُه ثلاثَ مرّات».
// MEASURED (03-answer/measure/E-lessons.md): the strip's query is the ANSWER, so the server never saw
// the question; neither the server nor the client filtered or deduplicated anything.
//
// WHAT THIS PINS:
//   G1  the filter on the owner's witnesses: the CV question and the tomato question get nothing; the
//       page-number request gets nothing; a fiqh question keeps its related titles once each;
//   G2  no question means no change (an old client is served as before); an issue word is read on
//       the clitic-stripped form («لابن» is not an issue word);
//   G3  the handler: with the switch on it serves the filtered list; off, the service's list byte for
//       byte; and the question never reaches the upstream body, which stays {q, limit};
//   G4  the client sends the question beside the query, from the turn that fired the search;
//   G5  the module is pure: it imports only the router and prints nothing.
// Red on the tree before this item: `node guards/full-answer-g-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}

async function main() {
  console.log('full-answer-g guard — root ' + REPO);
  let REL = null;
  try { REL = await esm('lib/lessons-relevance.js'); } catch (e) { REL = null; }
  const pick = REL && typeof REL.lessonsForQuestion === 'function' ? REL.lessonsForQuestion : null;
  const hit = (title, n) => ({ title, url: 'https://example.invalid/lesson/' + n, scholar_id: 's' });

  // ── G1 ────────────────────────────────────────────────────────────────────
  const CV = 'شلون أكتب سيرة ذاتية (CV) احترافية؟';
  const TOMATO = 'أبي أزرع طماط بالكويت، ايش أفضل وقت؟';
  const PAGE = 'انقل لي نص الصفحة ١٤٠ من الجزء الأول من كتاب بداية المجتهد لابن رشد';
  const SABT = 'ما حكم صيام يوم السبت تطوعا؟';
  const cvRows = [hit('الطلاق عبر رسائل الجوال', 1), hit('أحكام الطلاق', 2), hit('فقه الأسرة', 3)];
  const tomatoRows = [hit('نصيحة لأهل الكويت بسبب الجو الحار', 4), hit('الزراعة في السنة', 5)];
  const pageRows = [hit('القواسم المشتركة بين الشيعة والسنة3 جزء 3', 6), hit('القواسم المشتركة بين الشيعة والسنة3 جزء 3', 7)];
  const sabtRows = [hit('صيام يوم السبت', 8), hit('صيام يوم السبت', 9), hit('أحكام التصوير', 10), hit('فضل صيام الست من شوال', 11)];
  const kept = pick ? pick(sabtRows, SABT) : null;
  ok('G1  the witnesses: CV, tomatoes and the page request get nothing; a fiqh question keeps related titles once',
    !!pick && pick(cvRows, CV).length === 0 && pick(tomatoRows, TOMATO).length === 0 && pick(pageRows, PAGE).length === 0
    && Array.isArray(kept) && kept.length === 2 && kept[0].url.endsWith('/8') && kept[1].url.endsWith('/11'),
    JSON.stringify({ kept }));

  // ── G2 ────────────────────────────────────────────────────────────────────
  ok('G2  no question, no change; «لابن» and «فليس» are not issue words',
    !!pick && pick(cvRows, '') === cvRows && pick(cvRows, undefined) === cvRows
    && !REL.issueWords('لابن تيمية فليس منا').has('لابن') && !REL.issueWords('فليس').has('فليس')
    && REL.issueWords('لابن تيمية').has('تيميه'),
    JSON.stringify(REL ? [...REL.issueWords('لابن تيمية فليس منا')] : null));

  // ── G3 the handler ───────────────────────────────────────────────────────
  const H = await esm('api/lessons-search.js');
  const upstream = [];
  const realFetch = globalThis.fetch;
  const savedToken = process.env.SEARCH_API_TOKEN;
  const savedFlag = process.env.FULL_ANSWER_V1;
  const call = async (flag, body) => {
    process.env.SEARCH_API_TOKEN = 'tk-fixture-lessons';
    if (flag) process.env.FULL_ANSWER_V1 = 'on'; else delete process.env.FULL_ANSWER_V1;
    globalThis.fetch = async (url, init) => {
      upstream.push(JSON.parse(init.body));
      return {
        ok: true, status: 200, url: String(url),
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ hits: sabtRows }), text: async () => JSON.stringify({ hits: sabtRows }),
      };
    };
    let status = 0; let sent = null;
    const res = {
      setHeader() {}, status(s) { status = s; return this; }, json(o) { sent = o; return this; }, end() { return this; },
    };
    try { await H.default({ method: 'POST', body }, res); } finally { globalThis.fetch = realFetch; }
    return { status, sent };
  };
  let on = null, off = null;
  try {
    // ب٣ (order B): with the switch on the strip is an adult's only, so the reader here is an adult.
    on = await call(true, { q: 'صيام السبت تطوعا', question: SABT, band: 'adult', age: 30 });
    off = await call(false, { q: 'صيام السبت تطوعا', question: SABT, band: 'adult', age: 30 });
  } finally {
    if (savedToken === undefined) delete process.env.SEARCH_API_TOKEN; else process.env.SEARCH_API_TOKEN = savedToken;
    if (savedFlag === undefined) delete process.env.FULL_ANSWER_V1; else process.env.FULL_ANSWER_V1 = savedFlag;
  }
  ok('G3  the handler filters with the switch on, hands the list over whole with it off, and sends no question upstream',
    on && on.status === 200 && on.sent.hits.length === 2 && off && off.status === 200 && off.sent.hits.length === 4
    && upstream.length === 2 && upstream.every((b) => Object.keys(b).sort().join(',') === 'limit,q'),
    JSON.stringify({ on: on && on.sent && on.sent.hits.length, off: off && off.sent && off.sent.hits.length, upstream }));

  // ── G4 the client ─────────────────────────────────────────────────────────
  const app = read('app.jsx');
  ok('G4  the client sends the question beside the query, from the turn that fired the search',
    app.includes('lessonsTurnRef.current = { msg: aiMsg, msgs: final, cid: chatIdRef.current, question: text };')
    // ب٣ (order B): the call also carries the reader's age, and the body his band and age.
    && app.includes("ezikFetchLessonRows(query, controller.signal, turn ? turn.question : '', age)")
    && /body: JSON\.stringify\(\{ q: query, question: typeof question === 'string' \? question\.trim\(\)\.slice\(0, 400\) : '', band: deriveCaps\(age\)\.band, age: age \}\)/u.test(app));

  // ── G5 pure ───────────────────────────────────────────────────────────────
  const mod = read('lib/lessons-relevance.js');
  const imports = [...mod.matchAll(/^import[^;]*from\s+'([^']+)';/gmu)].map((m) => m[1]);
  ok('G5  the module imports only the router and prints nothing',
    mod !== '' && imports.join(',') === './route-classify.js' && !/console\./u.test(mod), imports.join(','));

  console.log(`\n=== full-answer-g: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== full-answer-g: crashed ==='); process.exit(1); });
