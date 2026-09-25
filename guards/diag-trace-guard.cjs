// guards/diag-trace-guard.cjs -- د-١ (DIAG_TRACE_V1): the diagnostic trace of one /api/ask turn.
//
// THE GAP (order د-١ §٠): the platform log kept tool names and row counts and nothing else, so a failed fiqh answer
// could only be diagnosed by inference. lib/diag-trace.js writes the whole turn to the runtime log, on the preview
// alone, and tools/trace-read.mjs reads it back one file per turn.
//
// WHAT THIS PINS (the REAL api/ask.js handler, a scripted provider, an offline library; no network):
//   T1  production writes nothing: VERCEL_ENV=production with DIAG_TRACE_V1 and every other switch on -- no trace
//       line, no probe line, and the decision says so; the switch unset or off writes nothing either.
//   T2  the answer is unchanged, byte for byte: the same «حسب المذاهب» fiqh turn with the switch off and on, the
//       whole SSE reply, unstreamed and streamed (STREAM_V1 on).
//   T3  the turn is all there (order §٢ rows 3-12): the question as it arrived, the tier and route, the classifier,
//       the planner's plan and raw reply, every library request (book ids, query, limit, max chars, status,
//       `refused`, time) with every passage (id, volume, page, title, first 120 chars), the encyclopedia's first
//       twenty candidates with rank and score, the judge (what it was shown, raw reply, kept, dropped), the pinned
//       table, every provider call with its phase and text, the draft whole before any door, the phrase filter,
//       the sentence door (sentence, kind, verdict, quote, row, replacement), the door markers with their times,
//       the finalizer, and the text as the reader got it (= the reply's own text).
//   T4  no secret: none of the fake keys appears in any line.
//   T5  the channel: a long turn (a 30,000-char draft) is cut into numbered lines under the platform's ceilings
//       (every line < 256 KB, the request's lines <= 256 and bytes <= 1 MB, trace lines <= MAX_LINES) and joined
//       back with no loss (every line's sha, the stream's sha and length).
//   T6  tools/trace-read.mjs reads that turn from a `vercel logs --json` shaped file into <turn>.json and <turn>.md,
//       complete, with the question and the delivered text in them.
// Red on the tree before this item (12074c0): `node guards/diag-trace-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
const say = console.log.bind(console);
function ok(name, cond, detail) {
  checks++;
  if (cond) { say('  PASS  ' + name); return true; }
  failures++;
  say('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 900) : ''));
  return false;
}
const bytes = (s) => Buffer.byteLength(String(s), 'utf8');

const FAKE = { anthropic: 'dtfake-provider-0001', founder: 'founder-diagtrace-fake-0002', search: 'lib-diagtrace-fake-token-0003' };
const QUESTION = 'ما صفة صلاة الخوف حسب المذاهب الأربعة؟';
const PLAN = { issue: 'صفة صلاة الخوف', fatwa_queries: ['صلاة الخوف'], library_query: 'صفة صلاة الخوف', encyclopedia_terms: ['صلاة الخوف'] };
const MADHHAB_TEXT = {
  'FC-003532': 'قال الحنفية: صلاة الخوف أن يجعل الإمام الناس طائفتين، طائفة بإزاء العدو وطائفة خلفه فيصلي بهم ركعة.',
  'FC-003623': 'قال المالكية: يقسم الإمام الناس طائفتين فيصلي بالأولى ركعة ثم يثبت قائما حتى تتم لأنفسها.',
  'FC-003660': 'قال الشافعي: إذا كان العدو في غير جهة القبلة صلى بهم صلاة ذات الرقاع.',
  'FC-003727': 'قال الحنابلة: صلاة الخوف جائزة على كل صفة صحت عن النبي صلى الله عليه وسلم.',
  'FC-003910': 'وأما صفة صلاة الخوف فإن العلماء اختلفوا فيها اختلافا كثيرا.',
  'FC-003592': 'صلاة الخوف ثابتة بالكتاب والسنة وإجماع الصحابة.',
};
function draftText(long) {
  const base = [
    'صلاةُ الخوفِ مشروعةٌ بالكتابِ والسنّة [[1]].',
    'ذهبَ الحنفيّةُ إلى أنّ الإمامَ يجعلُ الناسَ طائفتين [[2]].',
    'وذهبَ المالكيّةُ إلى أنّ الإمامَ يثبتُ قائمًا حتّى تتمَّ الأولى [[3]].',
    'وأجمعَ العلماءُ على أنّها تُصلّى في السفرِ والحضر.',
  ].join('\n');
  if (!long) return base;
  let out = base;
  let i = 0;
  while (out.length < 30000) { i += 1; out += `\nوفي المسألةِ تفصيلٌ رقم ${i}: يُراعى فيه حالُ العدوِّ وجهةُ القبلةِ وعددُ المصلّين، ويُرجَعُ فيه إلى كتبِ المذاهب [[2]].`; }
  return out;
}

async function main() {
  say('diag-trace guard — root ' + REPO);
  // The reading helpers (join, decision) come from the tree under test, or -- on a tree that has no trace, the
  // red side -- from this guard's own tree, so every row below still says what that tree does.
  let DT = null;
  try { DT = await esm('lib/diag-trace.js'); } catch (e) {
    ok('T0  lib/diag-trace.js loads', false, e.message);
    DT = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'diag-trace.js')).href);
  }

  for (const k of Object.keys(process.env)) {
    if (/UPSTASH|^KV_|REDIS|ANTHROPIC|BRAVE|SERPER|TAVILY|VERCEL|FOUNDER|SEARCH_API|LIB_|MODEL|FREE_BRAIN|STREAM_V1|TAKHRIJ|DEPTH_|ENCYC|LEDGER|RFC_|SHAMELA|LIVE_WORLD|DAILY|FATWA|REMOTE_SCHOLARS|FULL_ANSWER|BEFORE_WRITING|PROPHET_ASCRIPTION|DIAG_TRACE/i.test(k)) delete process.env[k];
  }
  Object.assign(process.env, {
    FREE_BRAIN_V1: 'on', TAKHRIJ_V1: 'on', STREAM_V1: 'off', SHAMELA_BRAIN: 'on', DEPTH_FREE_TRIAL: 'on',
    LEDGER_RAG: 'off', RFC_V05_MODE: 'off', BEFORE_WRITING_V1: 'on', FULL_ANSWER_V1: 'on', ENCYC_V1: 'on', LIB_MUJAZ_V1: 'on',
    ANTHROPIC_API_KEY: FAKE.anthropic, FOUNDER_SECRET: FAKE.founder, SEARCH_API_TOKEN: FAKE.search,
  });
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');
  const CONSENT = await esm('lib/ai-consent.js');
  const ENC = await esm('lib/encyclopedia.js');
  const IM = await esm('lib/issue-match.js');
  const RR = await esm('lib/ruling-review.js');
  const counts = new Map();
  DC.__setRedisForTest({
    async mget(...keys) { return keys.map((k) => (counts.has(k) ? counts.get(k) : null)); },
    async sismember() { return 0; },
    pipeline() { const ops = []; return { incr(k) { ops.push(() => { const n = (Number(counts.get(k)) || 0) + 1; counts.set(k, n); return n; }); }, expire() { ops.push(() => 1); }, async exec() { return ops.map((f) => f()); } }; },
  });
  STORE.__setRedisForTest({ async get() { return null; }, async set() { return 'OK'; }, async incr() { return 1; }, async expire() { return 1; }, async sismember() { return 0; }, async eval() { return [1, 1, 1, 0]; } });

  // ── THE OFFLINE WORLD ──────────────────────────────────────────────────────────────────────────
  let long = false;
  const sysOf = (b) => (Array.isArray(b.system) ? b.system.map((x) => x && x.text).join('\n') : String(b.system || ''));
  const lastText = (b) => { const m = b.messages[b.messages.length - 1]; return typeof m.content === 'string' ? m.content : (m.content || []).map((x) => x && x.text).join('\n'); };
  const answerFor = (b) => {
    const sys = sysOf(b);
    if (sys.startsWith(IM.RESOLVER_SYSTEM.slice(0, 40))) return JSON.stringify(PLAN);
    if (sys.startsWith(IM.JUDGE_SYSTEM.slice(0, 40))) {
      const n = (lastText(b).match(/^\[(\d+)\]/gmu) || []).length;
      return JSON.stringify({ keep: Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1) });
    }
    if (sys.startsWith(RR.RULING_REVIEW_SYSTEM.slice(0, 40))) {
      return JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 2, quote: 'يجعل الإمام الناس طائفتين' }, { id: 2, verdict: 'not_found', row: 0, quote: '' }] });
    }
    if ((b.max_tokens || 0) <= 2000) return '{}';
    return draftText(long);
  };
  const sse = (b, text) => {
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    const parts = [];
    for (let i = 0; i < text.length; i += 400) parts.push(text.slice(i, i + 400));
    return ev({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: b.model, content: [], usage: { input_tokens: 10, output_tokens: 1 } } })
      + ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
      + parts.map((p) => ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p } })).join('')
      + ev({ type: 'content_block_stop', index: 0 })
      + ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: Math.ceil(text.length / 3) } })
      + ev({ type: 'message_stop' });
  };
  const json = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
  const hit = (book, n) => ({
    atom_id: `${book}:0100:00${n}`, subject_id: book, book_title: `كتاب ${book}`, author: 'مؤلف', volume: 1, page_start: 100 + n, page_end: 100 + n,
    page_citable: true, numbering: 'print', heading_path: ['باب صلاة الخوف'], heading_kind: 'chapter', hadith_no: null, matn_chars: 0,
    truncated: false, score: 10 - n, text: MADHHAB_TEXT[book] || 'صلاة الخوف.',
  });
  globalThis.fetch = async (input, init = {}) => {
    const u = String(input && input.url ? input.url : input);
    if (u.startsWith('https://api.anthropic.com')) {
      const b = JSON.parse(String(init.body || '{}'));
      const text = answerFor(b);
      if (b.stream) return new Response(sse(b, text), { status: 200, headers: { 'content-type': 'text/event-stream' } });
      return json({ id: 'm', type: 'message', role: 'assistant', model: b.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: Math.ceil(text.length / 3) } });
    }
    if (u.startsWith('https://lib.ezik.app/search')) {
      const b = JSON.parse(String(init.body || '{}'));
      const book = ((b.filters && b.filters.book_ids) || ['FC-003910'])[0];
      return json({ index_version: 'fixture', took_ms: 1, queue_ms: 0, candidates_examined: 2, candidates_truncated: false,
        refused: false, refused_reason: null, degraded_reason: null, hits_dropped: 0, hits: [hit(book, 1), hit(book, 2)] });
    }
    return new Response('', { status: 503 });
  };
  await ENC.searchStoredCorpus('صلاة الخوف', { limit: 1 });

  const captured = [];
  const real = {};
  for (const m of ['log', 'warn', 'info', 'error']) { real[m] = console[m]; console[m] = (...a) => { captured.push({ level: m, text: a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') }); }; }
  const ask = await esm('api/ask.js');
  const drive = async ({ stream = false, method = 'POST', url = '/api/ask' } = {}) => {
    process.env.STREAM_V1 = stream ? 'on' : 'off';
    captured.length = 0;
    const res = { writes: [], statusCode: 200, headersSent: false, headers: {},
      status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k] = v; return this; }, getHeader(k) { return this.headers[k]; },
      flushHeaders() { this.headersSent = true; }, write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
      end(s) { if (s != null && typeof s !== 'function') this.writes.push(String(s)); this.ended = true; return this; }, json(o) { this.jsonBody = o; return this; }, on() { return this; }, once() { return this; } };
    const req = { method, url, on() { return this; }, once() { return this; },
      headers: { 'content-type': 'application/json', 'x-murabbi-device': 'dt-device', 'x-murabbi-founder': DC.founderTokenFor('dt-device'),
        [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION, origin: 'https://ezik.app' },
      body: method === 'POST' ? { max_tokens: 4096, stream: true, depth: 'scholar', name: '', age: 30, gender: null, mode: 'chat', band: 'adult', messages: [{ role: 'user', content: QUESTION }] } : undefined };
    await ask.default(req, res);
    await new Promise((r) => setTimeout(r, 50));
    const lines = captured.map((c) => c.text);
    return { sse: res.writes.join(''), status: res.statusCode, lines, trace: lines.filter((l) => l.includes(DT.DIAG_TRACE_TAG + ' ')), all: captured.slice() };
  };
  let off1, on1, off2, on2, offS, onS, prod, prodProbe, longOn, unset;
  try {
    // T1 — production and the switch off write nothing.
    Object.assign(process.env, { VERCEL_ENV: 'production', VERCEL_URL: 'ustaz.example.vercel.app', DIAG_TRACE_V1: 'on', STREAM_V1: 'on', LIB_NAV_V1: 'on', LIB_QUOTE_V1: 'on', PROPHET_ASCRIPTION_BLOCK: 'on' });
    prod = await drive({ stream: true });
    prodProbe = await drive({ method: 'GET', url: '/api/ask?diag_trace_probe=sizes' });
    for (const k of ['VERCEL_ENV', 'VERCEL_URL', 'LIB_NAV_V1', 'LIB_QUOTE_V1', 'PROPHET_ASCRIPTION_BLOCK']) delete process.env[k];
    process.env.DIAG_TRACE_V1 = 'off';
    off1 = await drive();
    delete process.env.DIAG_TRACE_V1;
    unset = await drive();
    process.env.DIAG_TRACE_V1 = 'on';
    on1 = await drive();
    process.env.DIAG_TRACE_V1 = 'off';
    off2 = await drive();
    offS = await drive({ stream: true });
    process.env.DIAG_TRACE_V1 = 'on';
    on2 = await drive();
    onS = await drive({ stream: true });
    long = true;
    longOn = await drive();
    process.env.DIAG_TRACE_V1 = 'off';
    const longOff = await drive();
    long = false;
    Object.assign(console, real);

    const prodDecision = DT.diagTraceDecision({ VERCEL_ENV: 'production', DIAG_TRACE_V1: 'on', FREE_BRAIN_V1: 'on', STREAM_V1: 'on', BEFORE_WRITING_V1: 'on' });
    ok('T1a production writes no trace line with DIAG_TRACE_V1 and every other switch on, and the decision says production',
      prod.trace.length === 0 && prod.lines.every((l) => !l.includes('[diag-')) && prodDecision.enabled === false && prodDecision.reason === 'production'
      && prod.sse.length > 0, JSON.stringify({ trace: prod.trace.length, decision: prodDecision, sse: prod.sse.length }));
    ok('T1b production: the channel probe is not answered and writes nothing',
      prodProbe.lines.every((l) => !l.includes('[diag-')) && !prodProbe.sse.includes('"probe"'), prodProbe.sse.slice(0, 200));
    ok('T1c the switch off or unset writes nothing', off1.trace.length === 0 && unset.trace.length === 0 && off2.trace.length === 0 && offS.trace.length === 0,
      JSON.stringify([off1.trace.length, unset.trace.length, off2.trace.length, offS.trace.length]));
    ok('T1d and on (not production) it writes', on1.trace.length > 0 && onS.trace.length > 0, JSON.stringify([on1.trace.length, onS.trace.length]));

    // T2 — the reply is the same bytes. (The handler's own lines carry wall-clock milliseconds, which are noise.)
    const noMs = (l) => l.replace(/("?[A-Za-z]*(?:ms|Ms)"?\s*[:=]\s*)\d+/g, '$1#');
    const answered = (r) => r.sse.includes('content_block_delta') && DT.readerTextOfSse(r.sse).length > 40;
    ok('T2a unstreamed: the whole SSE reply is byte-identical with the switch off and on (twice each), and it is an answer',
      answered(off1) && off1.sse === on1.sse && off2.sse === on2.sse && off1.sse === off2.sse && off1.status === on1.status,
      JSON.stringify({ off: off1.sse.length, on: on1.sse.length, off2: off2.sse.length, on2: on2.sse.length }));
    ok('T2b streamed (STREAM_V1 on): byte-identical off and on', answered(offS) && offS.sse === onS.sse, JSON.stringify({ off: offS.sse.length, on: onS.sse.length }));
    ok('T2c the long turn: byte-identical off and on', answered(longOff) && longOff.sse === longOn.sse, JSON.stringify({ off: longOff.sse.length, on: longOn.sse.length }));
    ok('T2d the handler\'s own log lines are the same lines, off and on (the trace only adds its own)',
      JSON.stringify(off2.lines.map(noMs)) === JSON.stringify(on2.lines.filter((l) => !l.includes(DT.DIAG_TRACE_TAG + ' ')).map(noMs)),
      JSON.stringify({ off: off2.lines.length, on: on2.lines.length - on2.trace.length }));

    // T3 — the turn is all there. (On a tree with no trace a row can throw; that is a failure, not a crash.)
    try {
    const joined = DT.joinTraceLines(on1.trace);
    const t = joined[0] || { records: [] };
    const recs = t.records;
    const of = (stage) => recs.filter((r) => r.stage === stage);
    const one = (stage) => of(stage)[0];
    ok('T3a one turn, joined complete', joined.length === 1 && t.complete, JSON.stringify(joined.map((x) => ({ complete: x.complete, missing: x.missingLines, bad: x.badShaLines }))));
    ok('T3b the question as it arrived, the tier (depth, band, model) and the route',
      one('route') && one('route').data.question === QUESTION && one('tier') && one('tier').data.effectiveDepth === 'scholar' && one('tier').data.band === 'adult'
      && one('free-brain') && one('classify') && one('classify').data.bwClass === 'fiqh', JSON.stringify([one('route'), one('classify')]).slice(0, 400));
    const gp = one('gather-plan');
    ok('T3c the planner: its raw reply and plan, the queries used, and no fallback',
      one('planner') && JSON.stringify(one('planner').data.plan).includes('صلاة الخوف') && String(one('planner').data.raw).includes('library_query')
      && gp && gp.data.resolver === 'ok' && gp.data.madhhabMode === true && String(gp.data.libraryQuery || '').length > 0,
      JSON.stringify([one('planner'), gp]).slice(0, 500));
    const libs = of('fetch').filter((r) => r.data.req && /lib\.ezik\.app\/search/.test(r.data.req.url));
    const lib0 = libs[0] && libs[0].data;
    ok('T3d every library request: book ids, query, limit, max chars, status, refused, time — and every passage: id, volume, page, title, first 120 chars',
      libs.length === 5 && lib0.req.body.q && Array.isArray(lib0.req.body.filters.book_ids) && lib0.req.body.limit && lib0.req.body.max_chars_per_hit
      && new Set(libs.map((r) => r.data.req.body.filters.book_ids.join(','))).size === 5
      && lib0.status === 200 && lib0.res.refused === false && Number.isFinite(lib0.ms) && lib0.res.hits.length === 2
      && lib0.res.hits.every((h) => h.id && h.volume === 1 && h.page && h.title && h.head && h.head.length <= 120),
      JSON.stringify({ n: libs.length, lib0 }).slice(0, 600));
    const fatwa = of('fetch').filter((r) => r.data.req && /api\/v1/.test(r.data.req.url));
    ok('T3e a failed request is written with its status', fatwa.length > 0 && fatwa.every((r) => r.data.status === 503 || r.data.error),
      JSON.stringify(fatwa.map((r) => [r.data.req.url, r.data.status, r.data.error])).slice(0, 300));
    const enc = of('encyclopedia').filter((r) => r.data.cap === 6).sort((a, b) => b.data.matched - a.data.matched)[0];
    ok('T3f the encyclopedia: the first twenty candidates with id, title, rank and score, not only the six taken',
      enc && enc.data.top.length === Math.min(20, enc.data.matched) && enc.data.top.length > 6 && enc.data.top.every((x, i) => x.rank === i + 1 && x.id && x.title && typeof x.score === 'number')
      && enc.data.top.filter((x) => x.taken).length === 6, JSON.stringify(enc && { matched: enc.data.matched, top: enc.data.top.slice(0, 3) }));
    const judge = one('judge');
    ok('T3g the judge: what it was shown (ids and windows), its raw reply, what it kept and dropped',
      judge && judge.data.shown.length >= 8 && Array.isArray(judge.data.kept) && judge.data.shown.every((x) => x.id && x.line) && String(judge.data.raw).includes('keep')
      && judge.data.dropped.length === 1 && judge.data.kept.length === judge.data.shown.length - 1 && judge.data.fallback === null,
      JSON.stringify(judge).slice(0, 500));
    const pinned = one('pinned-table');
    ok('T3h the pinned table: number → source, volume, page, id',
      pinned && pinned.data.rows.length >= 6 && pinned.data.rows.every((r, i) => r.ref === i + 1 && (r.id || r.url)) && pinned.data.rows.some((r) => String(r.volume) === '1' && r.page),
      JSON.stringify(pinned).slice(0, 500));
    const calls = of('call');
    const writer = calls.find((r) => r.data.text === draftText(false));
    ok('T3i every provider call with its phase, model, stop and tokens; the writer\'s whole text',
      calls.length >= 3 && calls.some((r) => r.data.phase === 'before-writing') && writer && writer.data.stop === 'end_turn' && writer.data.model && writer.data.outTokens > 0,
      JSON.stringify(calls.map((r) => [r.data.phase, r.data.stop, String(r.data.text || '').length])));
    ok('T3j the draft whole before any door, the phrase filter, and what the writer cited',
      one('draft') && one('draft').data.draft === draftText(false) && of('phrase-filter').length >= 1 && one('writer-cited') && one('writer-cited').data.cited.length === 3,
      JSON.stringify([one('draft') && one('draft').data.chars, one('writer-cited')]).slice(0, 300));
    const door = one('sentence-door');
    ok('T3k the sentence door: each ruling sentence, its kind, verdict, quote, row and what replaced it',
      door && door.data.claims.length >= 2 && door.data.claims[0].sentence && door.data.claims[0].verdict === 'supported' && door.data.claims[0].row === 2
      && door.data.claims[0].rowSource && door.data.claims.some((c) => c.verdict === 'not_found' && typeof c.replacedBy === 'string'),
      JSON.stringify(door).slice(0, 600));
    ok('T3l the markers with their times, the loop\'s output, the finalizer',
      of('marker').length >= 1 && of('marker').every((r) => Number.isFinite(r.t)) && one('loop-out') && Array.isArray(one('loop-out').data.roundLedger) && one('finalizer'),
      JSON.stringify(of('marker').map((r) => r.data)).slice(0, 300));
    const delivered = one('delivered');
    ok('T3m the text as the reader got it is the reply\'s own text, and every record is timed in order',
      delivered && delivered.data.readerText === DT.readerTextOfSse(on1.sse) && delivered.data.readerText.length > 40
      && recs.every((r, i) => i === 0 || r.t >= recs[i - 1].t || r.stage === 'fetch'),
      JSON.stringify(delivered && delivered.data.readerText.slice(0, 120)));

    // T4 — no secret.
    const everything = [...on1.trace, ...onS.trace, ...longOn.trace].join('\n');
    ok('T4  none of the fake keys appears in any trace line, and no limiter/day-cap store call is written (its keys name a device)',
      !Object.values(FAKE).some((v) => everything.includes(v)) && !everything.includes('evalsha') && !everything.includes('ask:min:'));

    // T5 — the channel.
    const lj = DT.joinTraceLines(longOn.trace)[0];
    const reqBytes = longOn.all.reduce((a, c) => a + bytes(c.text), 0);
    ok('T5  a long turn: several lines, each under 256 KB; the request under 256 lines and 1 MB; joined with no loss',
      lj && lj.complete && longOn.trace.length >= 4 && longOn.trace.length <= DT.MAX_LINES && longOn.trace.every((l) => bytes(l) < 256 * 1024)
      && longOn.all.length <= 256 && reqBytes <= 1024 * 1024 && lj.records.some((r) => r.stage === 'draft' && r.data.draft.length >= 30000),
      JSON.stringify({ lines: longOn.trace.length, all: longOn.all.length, reqBytes, complete: lj && lj.complete }));

    // T6 — the reader tool.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-trace-'));
    try {
      const file = path.join(dir, 'logs.jsonl');
      // the shape `vercel logs --json` prints: one row per request, its lines under `logs`.
      fs.writeFileSync(file, JSON.stringify({ id: 'row-1', timestamp: Date.now(), requestPath: '/api/ask', message: longOn.all[0].text,
        logs: longOn.all.map((c) => ({ level: c.level, message: c.text })) }) + '\n');
      const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'trace-read.mjs'), '--from-file', file, '--out', path.join(dir, 'out')], { encoding: 'utf8' });
      let summary = null;
      try { summary = JSON.parse(r.stdout); } catch { summary = null; }
      const turn = summary && summary.turns && summary.turns[0];
      const md = turn ? fs.readFileSync(path.join(dir, 'out', turn.turn + '.md'), 'utf8') : '';
      const js = turn ? JSON.parse(fs.readFileSync(path.join(dir, 'out', turn.turn + '.json'), 'utf8')) : null;
      ok('T6  tools/trace-read.mjs: one turn, complete, JSON and Markdown, with the question, the draft and the delivered text',
        r.status === 0 && summary.turns.length === 1 && turn.complete && js && js.integrity.complete && js.records.length === lj.records.length
        && md.includes(QUESTION) && md.includes('المسوّدةُ كاملةً') && md.includes('النصُّ كما وصلَ القارئ') && md.includes('السجلّ كاملٌ'),
        (r.stderr || '') + (r.stdout || '').slice(0, 300));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    } catch (e) { ok('T*  the remaining rows ran to the end', false, e && e.message); }
  } finally {
    Object.assign(console, real);
  }
  say(`\n=== diag-trace: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  threw: ' + (e && e.stack || e)); console.log('\n=== diag-trace: threw ==='); process.exit(1); });
