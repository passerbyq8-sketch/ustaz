'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const A = (hex) => String.fromCodePoint(...hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? ' | ' + detail : ''));
  return false;
}
const forms = [
  [1, A('645 646 20 647 648 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
  [2, A('645 646 20 647 648 20 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a 61f')],
  [3, A('645 646 20 647 648 20 639 645 631 20 628 646 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
  [4, A('639 631 641 646 64a 20 628 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [5, A('639 631 651 641 646 64a 20 628 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a')],
  [6, A('639 631 641 646 64a 20 639 644 649 20 627 644 634 64a 62e 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [7, A('645 64a 646 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a 61f')],
  [8, A('645 646 20 64a 643 648 646 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
  [9, A('646 628 630 629 20 639 646 20 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [10, A('62a 631 62c 645 629 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [11, A('62a 639 631 641 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
];
const negative = [
  [A('639 631 641 646 64a 20 628 623 62d 643 627 645 20 627 644 635 64a 627 645'), 'STORED_FIQH'],
  [A('639 631 651 641 646 64a 20 639 644 649 20 634 631 648 637 20 627 644 635 644 627 629'), 'STORED_FIQH'],
  [A('646 628 630 629 20 639 646 20 635 644 627 629 20 627 644 627 633 62a 62e 627 631 629'), 'STORED_FIQH'],
  [A('62a 631 62c 645 629 20 633 648 631 629 20 627 644 641 627 62a 62d 629'), 'STORED_FIQH'],
  [A('645 646 20 64a 643 648 646 20 623 648 644 649 20 628 627 644 625 645 627 645 629 61f'), 'GENERAL'],
  [A('62a 639 631 641 20 62d 643 645 20 635 644 627 629 20 627 644 648 62a 631 61f'), 'STORED_FIQH'],
  [A('639 631 641 646 64a 20 628 641 636 644 20 627 644 635 62f 642 629'), 'STORED_FIQH'],
  [A('62a 631 62c 645 629 20 645 639 627 646 64a 20 627 644 642 631 622 646'), 'STORED_FIQH'],
  [A('646 628 630 629 20 639 646 20 63a 632 648 629 20 628 62f 631'), 'STORED_FIQH'],
  [A('645 646 20 64a 643 648 646 20 627 644 625 645 627 645 20 641 64a 20 635 644 627 629 20 627 644 62c 646 627 632 629 61f'), 'STORED_FIQH'],
  [A('639 631 641 646 64a 20 628 632 643 627 629 20 627 644 641 637 631'), 'STORED_FIQH'],
  [A('646 628 630 629 20 639 646 20 64a 648 645 20 639 631 641 629'), 'STORED_FIQH'],
  [A('639 631 641 646 64a 20 628 633 646 646 20 627 644 648 636 648 621'), 'STORED_FIQH'],
  [A('62a 639 631 641 20 643 641 627 631 629 20 627 644 64a 645 64a 646 61f'), 'STORED_FIQH'],
  [A('62a 631 62c 645 629 20 643 644 645 629 20 627 644 633 644 627 645'), 'GENERAL'],
  [A('646 628 630 629 20 639 646 20 644 64a 644 629 20 627 644 642 62f 631'), 'STORED_FIQH'],
];
const CONTROL = A('645 62d 645 62f 20 645 62a 648 644 64a 20 627 644 634 639 631 627 648 64a');
const CANONICAL = A('639 645 631 20 639 628 62f 20 627 644 643 627 641 64a');
const EXPECTED_NOTE = A('62a 646 628 64a 647 3a 20 644 64a 633 20 639 646 62f 64a 20 645 635 627 62f 631 20 645 646 20 643 62a 628 20') + CANONICAL + A('2e');

// B4 P3-27: exercise the real handler, retrieval adapters, reviewer, finalizer,
// cards and log together. Only transports are fake. This harness uses APIs that
// already exist on a095acc8, so the same behavioral guard runs on that baseline.
async function b4IdentityRuntime(REM, FS) {
  const ASK = await esm('api/ask.js');
  const DAY = await esm('lib/daycap.js');
  const REDIS = await esm('lib/ledger/redis.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const LEGACY = await esm('lib/legacy-policy-flag.js');
  const CONSENT = await esm('lib/ai-consent.js');
  const SAFE = await esm('lib/ledger/safe-fetch.js');
  const FATWA = await esm('lib/fatwa-contract.js');
  const REVIEW = await esm('lib/output-reviewer.js');
  const LIBRARY = await esm('lib/lib-service.js');
  const LIB_CONTRACT = await esm('lib/lib-contract.js');
  const librarySearchUrl = String(LIB_CONTRACT.libSearchUrl());
  const BIO_URL = 'https://ar.wikipedia.org/wiki/B4_removed_identity';
  const OWN_URL = 'https://omarabdelkafy.com/b4-biography';
  const CHANNEL_URL = 'https://www.youtube.com/@OmarAbdelKafy/b4';
  const LESSON_URL = 'https://omarabdelkafy.com/lessons/b4';
  const BIO_MARK = 'B4_BIO_THIRD_PARTY';
  const OWN_MARK = 'B4_OWN_SITE_TEXT';
  const CHANNEL_MARK = 'B4_OWN_CHANNEL_TEXT';
  const LESSON_MARK = 'B4_OWN_LESSON_TEXT';
  const ESCAPE_QUERY = 'B4_ESCAPE_QUERY';
  const noFacts = A('628 644 627 20 62a 627 631 64a 62e 20 648 644 627 20 645 643 627 646 20 648 644 627 62f 629 20 648 644 627 20 634 647 627 62f 629 20 648 644 627 20 631 642 645');
  const general = CANONICAL + A('20 62f 627 639 64a 629 20 645 635 631 64a 20 645 639 631 648 641 20 628 62f 631 648 633 647 20 648 645 62d 627 636 631 627 62a 647 2e');
  const invented = CANONICAL + A('20 648 644 62f 20 633 646 629 20') + '1940'
    + A('20 641 64a 20 642 631 64a 629 20 645 62c 647 648 644 629 60c 20 648 62d 635 644 20 639 644 649 20 62f 643 62a 648 631 627 647 20 641 64a 20 637 628 20 627 644 623 633 646 627 646 2e');
  const khilaf = String(REVIEW.REVIEW_KHILAF_TAIL || '').trim();
  const identityNotice = REVIEW.requestedIdentityRespected(A('642 627 644 20 627 628 646 20 628 627 632 20 625 646 20 628 631 20 627 644 648 627 644 62f 64a 646 20 648 627 62c 628 2e'),
    { name: A('633 627 644 645 20 627 644 641 644 627 646 64a'), status: 'unresolved' }).notice;
  const bioHtml = '<!doctype html><html lang="ar"><head><title>' + CANONICAL
    + ' - biography</title></head><body><main><article><h1>' + CANONICAL
    + '</h1><p>' + general + ' ' + BIO_MARK + '</p>'
    + Array.from({ length: 8 }, () => '<p>' + general + ' ' + A('647 630 647 20 62a 631 62c 645 629 20 639 646 647 20 643 62a 628 647 627 20 63a 64a 631 647 2e') + '</p>').join('')
    + '</article></main></body></html>';
  const forbidden = [
    { url: OWN_URL, title: CANONICAL, description: CANONICAL + ' ' + OWN_MARK },
    { url: CHANNEL_URL, title: CANONICAL, description: CANONICAL + ' ' + CHANNEL_MARK },
    { url: LESSON_URL, title: CANONICAL, description: CANONICAL + ' ' + LESSON_MARK },
  ];
  const bookIds = Array.from(REM.REMOVED_BOOK_IDS);
  const bookHits = bookIds.map((id, index) => ({
    atom_id: id + ':b4:001', subject_id: id, book_title: REM.REMOVED_SOURCES.bookTitles[id],
    author: CANONICAL, text: 'B4_REMOVED_BOOK_' + index, page_citable: true,
    numbering: 'print', volume: 1, page_start: 1, page_end: 1,
    score: 99, matn_chars: 200, matn_spans: [[0, 200]], truncated: false,
  }));
  const envKeys = [
    'BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN',
    'SEARCH_API_TOKEN', 'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL',
    'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG', 'VERCEL_ENV', 'VERCEL_URL',
    'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2',
    'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS', 'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK',
    'BW2_CONTINUE', 'FRONT_SORTER_V1', 'SEARCH_BUDGET_IDENTITY_SECRET',
    'SEARCH_BUDGET_GLOBAL_PREVIEW', 'SEARCH_BUDGET_PER_CALLER',
  ];
  const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const realFetch = globalThis.fetch;
  const realConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  const sysText = (body) => Array.isArray(body && body.system)
    ? body.system.map((block) => String(block && block.text || '')).join('\n')
    : String(body && body.system || '');
  const framesOf = (writes) => writes.join('').split('\n\n').filter((frame) => frame.startsWith('data:'))
    .map((frame) => { try { return JSON.parse(frame.slice(5).trim()); } catch { return null; } }).filter(Boolean);
  const json = (url, payload, status = 200) => ({
    ok: status >= 200 && status < 300, status, url: String(url),
    headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'application/json' : null },
    json: async () => payload, text: async () => JSON.stringify(payload),
  });
  const safeUrl = (value) => {
    try { const url = new URL(value); return (url.origin + url.pathname).replace(/[^\x20-\x7e]/gu, '?'); }
    catch { return String(value).split('?')[0].replace(/[^\x20-\x7e]/gu, '?').slice(0, 160); }
  };
  const providerResponse = (url, payload, stream) => {
    if (!stream) return json(url, payload);
    const events = [{ type: 'message_start', message: { id: 'b4-offline', role: 'assistant', content: [], usage: { input_tokens: 1 } } }];
    for (const [index, block] of payload.content.entries()) {
      if (block.type === 'tool_use') {
        events.push({ type: 'content_block_start', index, content_block: { ...block, input: {} } });
        events.push({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
      } else {
        events.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
        const middle = Math.max(1, Math.floor(block.text.length / 2));
        events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text.slice(0, middle) } });
        events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text.slice(middle) } });
      }
      events.push({ type: 'content_block_stop', index });
    }
    events.push({ type: 'message_delta', delta: { stop_reason: payload.stop_reason }, usage: { output_tokens: 1 } });
    events.push({ type: 'message_stop' });
    const bytes = new TextEncoder().encode(events.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''));
    let read = false;
    return { ok: true, status: 200, headers: { get: () => 'text/event-stream' },
      body: { getReader: () => ({ read: async () => read ? { done: true } : (read = true, { done: false, value: bytes }), cancel: async () => {} }) } };
  };
  let sequence = 0;
  async function drive(question, { available = true, hostile = false, streaming = false, includeKhilaf = false } = {}) {
    for (const key of envKeys) delete process.env[key];
    Object.assign(process.env, {
      ANTHROPIC_API_KEY: 'b4-offline-key', BRAVE_API_KEY: 'b4-offline-key', FREE_BRAIN_V1: 'on',
      FRONT_SORTER_V1: 'on', BEFORE_WRITING_V2: 'off', STREAM_V1: streaming ? 'on' : 'off',
      TAKHRIJ_V1: 'off', PROPHET_ASCRIPTION_BLOCK: 'off', LEDGER_RAG: 'off',
      LIB_QUOTE_V1: 'off', LIB_MUJAZ_V1: 'off', ENCYC_V1: 'off', SHAMELA_BRAIN: 'on',
      SEARCH_API_TOKEN: 'b4-offline-token', DEPTH_FREE_TRIAL: 'on', LIVE_WORLD_V2: 'off',
      VERCEL_ENV: 'preview', SEARCH_BUDGET_IDENTITY_SECRET: 'b4-offline-budget-secret',
      SEARCH_BUDGET_GLOBAL_PREVIEW: '1000', SEARCH_BUDGET_PER_CALLER: '100',
    });
    const rows = new Map();
    REDIS.__setRedisForTest({
      async get(key) { return rows.get(key) ?? null; },
      async set(key, value) { rows.set(key, value); return 'OK'; },
      async eval() { return [1, 1, 1, 0]; },
      async lpush(key, value) { rows.set(key, [value, ...(rows.get(key) || [])]); return 1; },
      async ltrim() { return 'OK'; }, async expire() { return 1; },
    });
    const capCounts = new Map();
    DAY.__setRedisForTest({
      async mget(...keys) { return keys.map((key) => capCounts.get(key) ?? null); },
      async sismember() { return 0; },
      pipeline() {
        const ops = [];
        return { incr(key) { ops.push(() => { const value = (capCounts.get(key) || 0) + 1; capCounts.set(key, value); return value; }); },
          expire() { ops.push(() => 1); }, async exec() { return ops.map((op) => op()); } };
      },
    });
    FLAG.__resetFlagCacheForTest(); LEGACY.__resetLegacyFlagCacheForTest();
    const counts = { sorter: 0, writer: 0, brave: 0, wiki: 0, library: 0, bookRowsServed: 0, lessons: 0, throttle: 0, forbiddenFetch: 0, unmatched: 0 };
    const providerBodies = [], searches = [], logs = [], unmatchedUrls = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input && input.url || input);
      // ratelimit.js constructs its Redis client at import time. With the
      // deliberately absent real credentials its SDK posts to /pipeline. The
      // fixture returns an explicit store error, exercising that throttle's
      // existing fail-open behavior without retries or an external transport.
      if (url === '/pipeline') {
        counts.throttle += 1;
        const commands = JSON.parse(init && init.body || '[]');
        return json(url, commands.map(() => ({ error: 'B4 offline throttle fixture' })));
      }
      if (url.includes('api.anthropic.com')) {
        const body = JSON.parse(init && init.body || '{}');
        if (body.system === FS.FRONT_SORTER_SYSTEM) {
          counts.sorter += 1;
          return json(url, { content: [{ type: 'text', text: 'WORLDLY' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        providerBodies.push(body); counts.writer += 1;
        if (hostile && providerBodies.length === 1) {
          return providerResponse(url, { stop_reason: 'tool_use', content: [
            { type: 'tool_use', id: 'b4-book', name: 'search_library', input: { query: CANONICAL } },
            { type: 'tool_use', id: 'b4-lesson', name: 'search_lessons', input: { query: CANONICAL } },
            { type: 'tool_use', id: 'b4-live', name: 'search_live', input: { query: ESCAPE_QUERY } },
          ] }, body.stream);
        }
        const offered = JSON.stringify(body.messages || []).includes(BIO_MARK);
        const answer = question.includes(CONTROL) ? 'Ordinary identity answer.'
          : offered ? general + ' [[1]].' : (sysText(body).includes(noFacts) ? general : invented);
        return providerResponse(url, { stop_reason: 'end_turn', content: [{ type: 'text', text: answer + (includeKhilaf && khilaf ? '\n\n' + khilaf : '') }] }, body.stream);
      }
      if (url.includes('api.search.brave.com')) {
        counts.brave += 1;
        const query = new URL(url).searchParams.get('q') || ''; searches.push(query);
        const results = available && !query.includes(ESCAPE_QUERY)
          ? [{ url: BIO_URL, title: CANONICAL + ' biography', description: general + ' ' + BIO_MARK }, ...forbidden]
          : (hostile ? forbidden : []);
        return json(url, { web: { results } });
      }
      if (url === BIO_URL) {
        counts.wiki += 1;
        return { ok: true, status: 200, url, headers: { get: (key) => String(key).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null }, text: async () => bioHtml };
      }
      if (forbidden.some((row) => row.url === url)) {
        counts.forbiddenFetch += 1;
        return { ok: true, status: 200, url, headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => '<html><title>' + CANONICAL + '</title><article>' + forbidden.map((row) => row.description).join(' ').repeat(8) + '</article></html>' };
      }
      if (url.startsWith('https://lib.ezik.app/lessons/search')) {
        counts.lessons += 1;
        return json(url, { hits: [{ unit_id: 'b4-own-lesson', scholar_id: CANONICAL, title: 'Own lesson',
          url: LESSON_URL, snippet: LESSON_MARK, score: 99 }] });
      }
      if (url === librarySearchUrl) {
        counts.library += 1;
        counts.bookRowsServed += bookHits.length;
        return json(url, { hits: bookHits, total: bookHits.length });
      }
      if (url.startsWith(FATWA.FATWA_BASE)) {
        return json(url, { ok: true, schemaVersion: FATWA.FATWA_SCHEMA, results: [], scholars: [],
          pagination: { total: 0 }, counts: { scholars: 0 } });
      }
      counts.unmatched += 1;
      const diagnostic = safeUrl(url);
      if (!unmatchedUrls.includes(diagnostic)) unmatchedUrls.push(diagnostic);
      throw new Error('B4 offline transport refused an unexpected URL');
    };
    const target = { writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
      status(code) { this.statusCode = code; return this; },
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; },
      getHeader(key) { return this.headers[String(key).toLowerCase()]; }, flushHeaders() { this.headersSent = true; },
      write(value) { this.headersSent = true; this.writes.push(String(value)); return true; },
      end(chunk, encoding, callback) { if (chunk && typeof chunk !== 'function') this.writes.push(String(chunk)); this.ended += 1;
        (typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : callback)?.(); return this; },
      json(value) { this.jsonBody = value; this.ended += 1; return this; },
      on() { return this; }, once() { return this; }, removeListener() { return this; },
    };
    sequence += 1;
    const req = { method: 'POST', complete: true,
      headers: { 'x-murabbi-device': 'b4-identity-offline-' + sequence, 'x-real-ip': '10.24.0.' + sequence,
        [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
      body: { messages: [{ role: 'user', content: question }], band: 'adult', age: 35, depth: 'deep' } };
    console.log = (...args) => logs.push(args); console.warn = (...args) => logs.push(args);
    console.error = (...args) => logs.push(args); console.info = (...args) => logs.push(args);
    let crashed = false;
    try { await ASK.default(req, target); } catch { crashed = true; }
    finally { Object.assign(console, realConsole); }
    const frames = framesOf(target.writes);
    const shown = frames.filter((frame) => frame.type === 'content_block_delta' && frame.delta?.type === 'text_delta')
      .map((frame) => frame.delta.text).join('');
    const prose = shown.replace(/<(?:source|book)\b[^>]*>(?:[\s\S]*?<\/(?:source|book)>)?/gu, '').trim();
    const recordValue = [...rows.entries()].find(([key]) => /^al:v1:[0-9a-f]{16}$/u.test(key));
    const record = recordValue ? JSON.parse(recordValue[1]) : null;
    return { counts, providerBodies, searches, logs, target, frames, shown, prose, record, crashed, unmatchedUrls,
      route: (logs.find((args) => args[0] === '[route]') || [])[1] || null };
  }
  try {
    SAFE.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }]);
    let libraryFixtureCalls = 0, libraryFixtureUrl = '';
    const libraryFixture = await LIBRARY.searchLibrary(CANONICAL, {
      flagValue: 'on', token: 'b4-offline-token', fetchImpl: async (input) => {
        libraryFixtureCalls += 1; libraryFixtureUrl = String(input && input.url || input);
        if (libraryFixtureUrl !== librarySearchUrl) throw new Error('B4 library fixture endpoint mismatch');
        return json(libraryFixtureUrl, { hits: bookHits, total: bookHits.length });
      },
    });
    ok('B4 real library adapter receives and rejects all four removed-book fixture rows',
      libraryFixtureCalls === 1 && libraryFixtureUrl === librarySearchUrl && libraryFixture.ok === true
        && libraryFixture.hitsSeen === 4 && libraryFixture.dropped === 4 && libraryFixture.records.length === 0,
      'calls=' + libraryFixtureCalls + ' url=' + safeUrl(libraryFixtureUrl)
        + ' seen=' + libraryFixture.hitsSeen + ' dropped=' + libraryFixture.dropped);
    const sourced = await drive(forms[0][1]);
    const first = sourced.providerBodies[0];
    ok('B4 biography evidence reaches the first writer through the real handler', !sourced.crashed
      && sourced.counts.brave > 0 && sourced.counts.wiki > 0 && !!first
      && JSON.stringify(first.messages).includes(BIO_MARK) && JSON.stringify(first.messages).includes(BIO_URL));
    ok('B4 sourced identity retains GEN GENERAL and skips the classifier', sourced.counts.sorter === 0
      && sourced.route?.route === 'GEN' && sourced.route?.runtime === 'GENERAL' && sourced.route?.sorter === 'removed_identity');
    ok('B4 cited biography produces a visible reader card and recorded cited count', sourced.shown.includes(BIO_URL)
      && /<source\b/u.test(sourced.shown) && sourced.record?.cited === 1);
    ok('B4 sourced identity ends in one short note without notices', sourced.prose.endsWith(EXPECTED_NOTE)
      && sourced.prose.split(EXPECTED_NOTE).length === 2 && (!khilaf || !sourced.prose.includes(khilaf))
      && !!identityNotice && !sourced.prose.includes(identityNotice));
    ok('B4 sourced identity gets no empty-evidence instruction', !!first && !sysText(first).includes(noFacts));

    const empty = await drive(forms[1][1], { available: false });
    const emptyFirst = empty.providerBodies[0];
    ok('B4 empty biography search gives the writer the explicit restricted instruction', !empty.crashed
      && empty.counts.brave > 0 && !!emptyFirst && sysText(emptyFirst).includes(noFacts));
    ok('B4 empty biography still delivers a short general introduction without invented facts', empty.prose.includes(general)
      && !/[0-9\u0660-\u0669\u06f0-\u06f9]/u.test(empty.prose) && !empty.prose.includes(invented)
      && !empty.prose.includes(A('644 645 20 623 62c 62f')) && !empty.prose.includes(A('644 627 20 623 633 62a 637 64a 639')));
    ok('B4 empty biography has no card and keeps exactly one final short note', empty.record?.cited === 0
      && !/<(?:source|book)\b/u.test(empty.shown) && empty.prose.endsWith(EXPECTED_NOTE)
      && empty.prose.split(EXPECTED_NOTE).length === 2 && (!khilaf || !empty.prose.includes(khilaf))
      && !!identityNotice && !empty.prose.includes(identityNotice));
    const cached = (body) => JSON.stringify((body?.system || []).filter?.((block) => block && block.cache_control) || []);
    ok('B4 per-turn restriction preserves the cached system blocks', Array.isArray(first?.system)
      && Array.isArray(emptyFirst?.system) && cached(first) === cached(emptyFirst)
      && (emptyFirst.system || []).some((block) => block && String(block.text || '').includes(noFacts) && !block.cache_control));

    const hostile = await drive(forms[2][1], { hostile: true });
    const allWriterMaterial = JSON.stringify(hostile.providerBodies.map((body) => ({ system: body.system, messages: body.messages })));
    ok('B4 all four removed books and their identifiers never reach a writer', bookIds.length === 4
      && bookIds.every((id, index) => !allWriterMaterial.includes(id) && !allWriterMaterial.includes('B4_REMOVED_BOOK_' + index)));
    ok('B4 hostile unoffered tool calls cannot expose own site channel or lessons', !hostile.crashed
      && hostile.providerBodies.length >= 2 && hostile.counts.forbiddenFetch === 0
      && [OWN_URL, CHANNEL_URL, LESSON_URL, OWN_MARK, CHANNEL_MARK, LESSON_MARK].every((value) => !allWriterMaterial.includes(value)));
    ok('B4 identity restrictions follow the reader question despite an escaped tool query', hostile.searches.length > 0
      && hostile.searches.every((query) => !query.includes(ESCAPE_QUERY)) && hostile.prose.endsWith(EXPECTED_NOTE));

    const streamed = await drive(forms[0][1], { streaming: true, includeKhilaf: true });
    ok('B4 streaming identity finishes its introduction card and final note without a disagreement tail', !streamed.crashed
      && streamed.target.ended === 1 && streamed.prose.includes(general) && streamed.shown.includes(BIO_URL)
      && streamed.prose.endsWith(EXPECTED_NOTE) && !!khilaf && !streamed.prose.includes(khilaf));

    const controlQuestion = A('639 631 651 641 646 64a 20 628 627 644 634 64a 62e 20') + CONTROL;
    const control = await drive(controlQuestion);
    ok('B4 Shaarawi keeps the ordinary classifier and no removed identity note', !control.crashed
      && control.counts.sorter === 1 && control.providerBodies.length > 0
      && control.providerBodies.every((body) => !sysText(body).includes(noFacts)) && !control.shown.includes(EXPECTED_NOTE));
    const scenarioDiagnostics = [ ['sourced', sourced], ['empty', empty], ['hostile', hostile], ['streamed', streamed], ['control', control] ]
      .map(([name, result]) => ({ name, counts: result.counts, unmatchedUrls: result.unmatchedUrls }));
    console.log('  B4 transport diagnostics ' + JSON.stringify(scenarioDiagnostics));
    ok('B4 all scenario transports stayed inside the offline fixtures', [sourced, empty, hostile, streamed, control]
      .every((result) => result.counts.unmatched === 0), JSON.stringify(scenarioDiagnostics));
  } finally {
    globalThis.fetch = realFetch; Object.assign(console, realConsole);
    for (const key of envKeys) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }
    SAFE.__resetResolver(); REDIS.__resetRedis(); DAY.__setRedisForTest(null);
    FLAG.__resetFlagCacheForTest(); LEGACY.__resetLegacyFlagCacheForTest();
  }
}
(async () => {
  const NP = await esm('lib/policy/name-presence.js');
  const REM = await esm('lib/removed-sources.js');
  const FS = await esm('lib/front-sorter.js');
  const RT = await esm('lib/stored-deen.js');
  const PL = await esm('lib/ask-plan.js');
  const RC = await esm('lib/route-classify.js');
  const askSource = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  const runtime = (q) => {
    const messages = [{ role: 'user', content: q }];
    return RT.classifyReligiousRuntime(q, PL.planAsk(messages, { policyEnabled: true }), RC.classifyRoute(messages));
  };
  const person = (REM.REMOVED_SOURCES.persons || []).find((x) => x.id === 'umar-abd-al-kafi');
  ok('removed-source canonical identity is the expected person', !!person && person.canonical === CANONICAL);
  const measuredForms = new Set((person && Array.isArray(person.forms) ? person.forms : []).map(REM.normalizeRemovedName));
  ok('removedPersonIdentity helper is exported', typeof REM.removedPersonIdentity === 'function');
  ok('removed identity note helper is exported', typeof REM.removedPersonIdentityNote === 'function');
  ok('identity sorter frame helper is exported', typeof FS.frameAfterSorter === 'function');
  ok('api/ask.js supplies the removed-identity signal to sorterEligibility',
    askSource.includes('removedIdentity: !!removedIdentityQuestion'));
  ok('api/ask.js appends the identity note at the free-brain answer boundary',
    askSource.includes('appendRemovedPersonIdentityNote('));

  const sorterInput = (q, removedIdentity) => ({
    enabled: true, band: 'adult', freeBrainEnabled: true, runtime: runtime(q),
    liveSearch: false, excluded: '', text: q, removedIdentity,
  });
  for (const [id, q] of forms) {
    const subject = NP.identitySubject(q);
    const role = typeof REM.removedPersonIdentity === 'function' ? REM.removedPersonIdentity(q) : null;
    ok('Q' + id + ' resolves the full removed identity without attribution',
      !!role && role.id === 'umar-abd-al-kafi' && role.name === CANONICAL && role.role === 'removed_identity',
      JSON.stringify(role));
    ok('Q' + id + ' keeps a complete measured removed-name form',
      !!subject && measuredForms.has(REM.normalizeRemovedName(subject)));
    const decision = FS.sorterEligibility(sorterInput(q, true));
    ok('Q' + id + ' bypasses the classifier with removed_identity',
      decision.ask === false && decision.sorter === 'removed_identity', JSON.stringify(decision));
    ok('Q' + id + ' finishes in GENERAL',
      FS.runtimeAfterSorter(runtime(q), 'removed_identity') === 'GENERAL');
    const controlQuestion = subject ? q.replace(subject, CONTROL) : q;
    const controlSubject = NP.identitySubject(controlQuestion);
    const controlRole = typeof REM.removedPersonIdentity === 'function' ? REM.removedPersonIdentity(controlQuestion) : null;
    ok('C' + id + ' is not marked as removed and remains an identity',
      controlSubject === CONTROL && controlRole === null, JSON.stringify({ controlSubject, controlRole }));
    const controlShape = NP.probeShape(controlQuestion, null);
    ok('C' + id + ' stays in the ordinary identity probe',
      controlShape.kind === 'IDENTITY_SHAPE' && controlShape.name === CONTROL, JSON.stringify(controlShape));
    const controlDecision = FS.sorterEligibility(sorterInput(controlQuestion, false));
    ok('C' + id + ' still asks the classifier as today', controlDecision.ask === true, JSON.stringify(controlDecision));
  }
  const sampleRole = typeof REM.removedPersonIdentity === 'function' ? REM.removedPersonIdentity(forms[0][1]) : null;
  const note = typeof REM.removedPersonIdentityNote === 'function' ? REM.removedPersonIdentityNote(sampleRole) : '';
  ok('identity note uses the canonical name and exact sentence', note === EXPECTED_NOTE, note);
  if (typeof REM.appendRemovedPersonIdentityNote === 'function') {
    const body = 'definition';
    const withNote = body + '\n\n' + EXPECTED_NOTE;
    ok('identity note is appended once and only after a nonempty answer',
      REM.appendRemovedPersonIdentityNote(body, sampleRole) === withNote
      && REM.appendRemovedPersonIdentityNote(withNote, sampleRole) === withNote
      && REM.appendRemovedPersonIdentityNote('', sampleRole) === ''
      && REM.appendRemovedPersonIdentityNote(body, null) === body);
  } else {
    ok('identity note is appended once and only after a nonempty answer', false);
  }
  const off = FS.sorterEligibility({
    enabled: false, band: 'adult', freeBrainEnabled: true, runtime: 'GENERAL',
    text: forms[0][1], removedIdentity: true,
  });
  ok('removed identity is not sent to the classifier when its key is off',
    off.ask === false && off.sorter === 'removed_identity', JSON.stringify(off));
  const frame = typeof FS.frameAfterSorter === 'function'
    ? FS.frameAfterSorter('GENERAL', 'removed_identity', { enabled: false, band: 'adult', freeBrainEnabled: true })
    : '';
  ok('removed identity uses the general frame without a classifier verdict', frame === 'general', frame);
  const controlNote = typeof REM.removedPersonIdentityNote === 'function' ? REM.removedPersonIdentityNote(null) : '';
  ok('the removed-identity note is absent for a nonremoved person', controlNote === '');

  for (let i = 0; i < negative.length; i += 1) {
    const [q, expectedRuntime] = negative[i];
    const subject = NP.identitySubject(q);
    const shape = NP.probeShape(q, null);
    ok('N' + (i + 1) + ' is not an identity subject', subject === '', JSON.stringify({ subject }));
    ok('N' + (i + 1) + ' does not open a presence probe',
      shape.kind === 'NOT_PROBED' && shape.probe === false, JSON.stringify(shape));
    ok('N' + (i + 1) + ' preserves the lexical runtime',
      runtime(q) === expectedRuntime, runtime(q) + ' expected ' + expectedRuntime);
  }
  const embedded = A('645 627 20 631 623 64a 643 20 641 64a 20') + forms[0][1];
  ok('an identity frame embedded later in a question is not captured', NP.identitySubject(embedded) === '');
  await b4IdentityRuntime(REM, FS);
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
