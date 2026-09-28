// guards/speed-pipes-guard.cjs -- SPEED ITEM 17, THE PIPES ROUND (order EZIK-SPEED-PIPES-ORDER-2026-09-28).
//
// Each case is built from the owner tool's round-6 questions, verbatim (EZIK-SPEED-PREVIEW6-ORDER-2026-09-28),
// and from what the pipes harness measured on them over the local library twin (EZIK-SPEED-PIPES-REPORT-2026-09-28).
// No network and no model: sources, the judge and the writer are fakes handed in through `deps`.
//
//   P1  the issue's words: the interrogative written as one word, the name joiner and the honorific formulas are
//       not query words; the verb and the noun they resemble stay issue words; every library member and the
//       fatwa store are asked the issue itself (questions 1-3 and 22)
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { harness } = require('./output-reviewer-mutant-lib.cjs');

const { ok, finish } = harness('speed-pipes');
const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const ascii = (s) => String(s).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300);

// -- the round-6 questions, verbatim -----------------------------------------------------------
const Q1 = '\u0645\u0627\u0647\u064a \u0635\u0641\u0627\u062a \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0627\u0631\u0628\u0639\u0647';
const Q2 = '\u0645\u0627\u0647\u064a \u0635\u0641\u0627\u062a \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0623\u0631\u0628\u0639\u0629';
const Q22 = '\u0645\u0627 \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0639\u0646 \u062e\u062f\u0645\u062a\u0647 \u0644\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u061f';
const Q18 = '\u0647\u0644 \u062d\u062f\u064a\u062b: \u0627\u062e\u062a\u0644\u0627\u0641 \u0623\u0645\u062a\u064a \u0631\u062d\u0645\u0629 \u0635\u062d\u064a\u062d\u061f';
const Q_PRAYED = '\u0647\u0644 \u0635\u0644\u0649 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u0636\u062d\u0649\u061f';
const KHAWF = '\u0635\u0644\u0627\u0647 \u0627\u0644\u062e\u0648\u0641';
// The fatwa store is asked the same words as written (P2): the store does not fold.
const KHAWF_AS_WRITTEN = '\u0635\u0644\u0627\u0629\u0020\u0627\u0644\u062e\u0648\u0641';

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');

  // ---------------------------------------------------------------- P1 the issue's words
  {
    const t1 = BW2.issueTerms(Q1);
    ok('P1a question 1: the one-word interrogative is not an issue word; the library and the fatwa store are asked the issue',
      !t1.includes('\u0645\u0627\u0647\u064a') && BW2.libraryQuery(Q1) === KHAWF && JSON.stringify(BW2.fatwaQueries(Q1)) === JSON.stringify([KHAWF_AS_WRITTEN])
      && BW2.libraryQuery(Q2) === KHAWF, ascii(JSON.stringify(t1)));
    const t22 = BW2.issueTerms(Q22);
    const gone = ['\u0631\u0636\u064a', '\u0639\u0646\u0647', '\u0635\u0644\u064a', '\u0639\u0644\u064a\u0647', '\u0648\u0633\u0644\u0645', '\u0628\u0646'];
    ok('P1b question 22: the honorific formulas and the name joiner are not issue words; the narrator and the issue stay',
      gone.every((w) => !t22.includes(w)) && ['\u0627\u0646\u0633', '\u0645\u0627\u0644\u0643', '\u062e\u062f\u0645\u062a\u0647'].every((w) => t22.includes(w)), ascii(JSON.stringify(t22)));
    const tp = BW2.issueTerms(Q_PRAYED);
    ok('P1c the formula is removed as a phrase: "salla" as the verb asked about stays, and so does "rahma" in question 18',
      tp.includes('\u0635\u0644\u064a') && tp.includes('\u0627\u0644\u0636\u062d\u064a') && BW2.issueTerms(Q18).includes('\u0631\u062d\u0645\u0647'), ascii(JSON.stringify(tp)));

    const seen = [];
    const runTool = async (name, input, ctx) => {
      seen.push({ name, query: input.query, books: Array.isArray(ctx.bookIds) ? ctx.bookIds.join(',') : '' });
      return { text: '', added: [], calls: 1 };
    };
    await BW2.gatherBw2({
      question: Q1, libFlagValue: 'on', libToken: 't', budgetMs: 800,
      deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true },
    });
    const lib = seen.filter((s) => s.name === 'search_library');
    const fat = seen.filter((s) => s.name === 'search_fatawa');
    ok('P1d question 1 end to end: the general, the two comparative and the four madhhab members all ask the issue, and so does the fatwa store',
      lib.length >= 6 && lib.every((s) => s.query === KHAWF) && lib.filter((s) => s.books).length === 5
      && fat.length === 1 && fat[0].query === KHAWF_AS_WRITTEN, ascii(JSON.stringify(seen)));
  }

  // ---------------------------------------------------------------- P2 the fatwa store in the reader's letters
  {
    const Q5 = '\u0645\u0627 \u062d\u0643\u0645 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0641\u0627\u062a\u062d\u0629 \u0644\u0644\u0645\u0623\u0645\u0648\u0645 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0623\u0631\u0628\u0639\u0629';
    const Q13 = '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062a\u062f\u0627\u0648\u0644 \u0641\u064a \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629\u061f';
    const Q_MARKED = '\u0645\u0627 \u062d\u064f\u0643\u0652\u0645\u064f \u0635\u064e\u0644\u0627\u0629\u0650 \u0627\u0644\u062e\u064e\u0648\u0652\u0641\u0650\u061f';
    ok('P2a question 5: the words are chosen folded and sent as written (the store does not fold: 74 fatwas against 0)',
      JSON.stringify(BW2.fatwaQueries(Q5)) === JSON.stringify(['\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0641\u0627\u062a\u062d\u0629 \u0644\u0644\u0645\u0623\u0645\u0648\u0645'])
      && JSON.stringify(BW2.issueTerms(Q5)) === JSON.stringify(['\u0642\u0631\u0627\u0621\u0647', '\u0627\u0644\u0641\u0627\u062a\u062d\u0647', '\u0644\u0644\u0645\u0627\u0645\u0648\u0645']), ascii(JSON.stringify(BW2.fatwaQueries(Q5))));
    ok('P2b question 13 as written, and diacritics and punctuation are taken off without folding a letter',
      JSON.stringify(BW2.fatwaQueries(Q13)) === JSON.stringify(['\u0627\u0644\u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629'])
      && JSON.stringify(BW2.fatwaQueries(Q_MARKED)) === JSON.stringify(['\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641']), ascii(JSON.stringify(BW2.fatwaQueries(Q_MARKED))));
    ok('P2c question 22: the honorific formulas stay out of the written words too',
      BW2.fatwaQueries(Q22).every((q) => !/\u0631\u0636\u064a|\u0648\u0633\u0644\u0645/u.test(q)) && BW2.fatwaQueries(Q22).join(' ').includes('\u0623\u0646\u0633'),
      ascii(JSON.stringify(BW2.fatwaQueries(Q22))));
    const byQuery = {};
    const runTool = async (name, input, ctx) => {
      if (name !== 'search_fatawa') return { text: '', added: [], calls: 0 };
      const tag = Object.keys(byQuery).length;
      byQuery[input.query] = tag;
      for (let i = 0; i < 4; i += 1) ctx.table.add({ kind: 'fatwa', title: 't' + tag + i, url: 'https://binbaz.org.sa/fatwas/' + tag + i, text: 'x' });
      return { text: '', added: [], calls: 1 };
    };
    const g = await BW2.gatherBw2({
      question: '\u0645\u0627 \u062d\u0643\u0645 \u0635\u064a\u0627\u0645 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0648\u062d\u062f\u0647\u061f', budgetMs: 800,
      deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true },
    });
    const order = g.results.fatwa.map((r) => r.url.slice(-2)).join(',');
    ok('P2d two answering queries take turns in the six places (question 10 kept its three carrying rows)',
      Object.keys(byQuery).length === 2 && order === '00,10,01,11,02,12', order);
  }

  // ---------------------------------------------------------------- P3 no coverage goes on by itself
  {
    const SSE = await esm('lib/finalized-sse-writer.js');
    const ASK = await esm('api/ask.js');
    const makeTarget = () => ({
      writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
      write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
      end() { this.ended += 1; return this; },
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; },
      flushHeaders() { this.headersSent = true; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
      once() { return this; }, on() { return this; }, removeListener() { return this; },
    });
    const framesOf = (writes) => writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
      .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
    const NOT_COVERED = BW2.BW2_NOT_COVERED;

    // P3a/P3b: the unit, over the real facade and the real wire.
    const unit = async (continueWhenNotCovered) => {
      const target = makeTarget();
      const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const out = await BW2.runBw2Turn({
        question: Q1, messages: [{ role: 'user', content: Q1 }], wire: BW2.createBw2Wire(facade),
        libFlagValue: 'on', libToken: 't', continueWhenNotCovered,
        deps: {
          runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [] }),
          encyclopediaReady: () => true, warmEncyclopedia: () => true,
          callWriter: async () => { throw new Error('the writer must not be called'); },
        },
      });
      return { out, target, frames: framesOf(target.writes) };
    };
    const on = await unit(true);
    ok('P3a no row in any of our sources, continuation on: handed back unfinished -- status frames only, no text, no offer, the response still open',
      on.out.continued === true && on.out.telemetry.continued === 'no_rows' && on.target.ended === 0
      && on.frames.length > 0 && on.frames.every((f) => f.type === 'ezik_status'), ascii(JSON.stringify(on.frames.map((f) => f.type))));
    const off = await unit(false);
    ok('P3b ...and with it off (the default) the turn ends as before: the not-covered sentence and the offer',
      !off.out.continued && off.target.ended === 1 && framesOf(off.target.writes).some((f) => f.type === 'ezik_live_offer')
      && off.frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') === NOT_COVERED);

    // P3e: a kept row, and the writer answers with its not-covered marker alone -- handed back as 'marker'.
    {
      const target = makeTarget();
      const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const UNITS = await esm('lib/bw2-units.js');
      const rec = { id: 'F9', term: 'x', part: 1, snippet: 'text about the issue', text: 'text about the issue' };
      const out = await BW2.runBw2Turn({
        question: Q1, messages: [{ role: 'user', content: Q1 }], wire: BW2.createBw2Wire(facade), continueWhenNotCovered: true,
        deps: {
          runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
          encyclopediaReady: () => true, warmEncyclopedia: () => true,
          ask: async () => '{"d":{"1":1}}',
          callWriter: async ({ onText }) => { onText(UNITS.BW2_NOT_COVERED_MARKER); return { stop_reason: 'end_turn', usage: {} }; },
        },
      });
      ok('P3e a kept row and the writer\'s marker alone: handed back as "marker", nothing written',
        out.continued === true && out.telemetry.continued === 'marker' && target.ended === 0
        && framesOf(target.writes).every((f) => f.type === 'ezik_status'), JSON.stringify(out.telemetry.continued));
    }

    // P3f: the switch. On in code; only the words that plainly mean off take it down.
    {
      const FLAGS = await esm('lib/free-brain/flag.js');
      const d = (v) => FLAGS.bw2ContinueDecision(v === undefined ? {} : { BW2_CONTINUE: v }).enabled;
      ok('P3f BW2_CONTINUE: default on; off/false/0 (any case) turn it off; anything else stays on',
        d() && d('on') && d('typo') && !d('off') && !d('FALSE') && !d('0') && FLAGS.BW2_CONTINUE_DEFAULT === true);
    }

    // P3c/P3d: the real handler. Every source is empty or refused and the judge keeps nothing, so the
    // before-writing path finds no text; today's path must then run by itself, first round forced to search.
    const LEDGER_REDIS = await esm('lib/ledger/redis.js');
    const DAYCAP = await esm('lib/daycap.js');
    const FLAG = await esm('lib/ledger/flag.js');
    const LEGACY = await esm('lib/legacy-policy-flag.js');
    const CONSENT = await esm('lib/ai-consent.js');
    const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN',
      'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG',
      'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS',
      'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE'];
    const saved = {};
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    const realFetch = globalThis.fetch;
    const capCounts = new Map();
    const ANSWER = '\u062a\u0635\u0644\u0649 \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0644\u0649 \u0635\u0641\u0627\u062a \u0648\u0631\u062f\u062a \u0628\u0647\u0627 \u0627\u0644\u0633\u0646\u0629.';
    const jsonResponse = (url, o, status = 200) => ({
      ok: status >= 200 && status < 300, status, url: String(url),
      headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => o, text: async () => JSON.stringify(o),
    });
    let ip = 0;
    const drive = async (question) => {
      for (const k of ENV_KEYS) delete process.env[k];
      Object.assign(process.env, { ANTHROPIC_API_KEY: 'guard-not-a-real-key', BRAVE_API_KEY: 'guard-not-a-real-key', LEDGER_RAG: 'off', FREE_BRAIN_V1: 'on' });
      LEDGER_REDIS.__setRedisForTest(null);
      FLAG.__resetFlagCacheForTest();
      LEGACY.__resetLegacyFlagCacheForTest();
      capCounts.clear();
      DAYCAP.__setRedisForTest({
        async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
        async sismember() { return 0; },
        pipeline() {
          const ops = [];
          return { incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
            expire() { ops.push(() => 1); }, async exec() { return ops.map((f) => f()); } };
        },
      });
      const model = [];
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          model.push(b);
          if (b.system === BW2.BW2_JUDGE_SYSTEM) return jsonResponse(u, { content: [{ type: 'text', text: '{"d":{}}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
          return jsonResponse(u, { content: [{ type: 'text', text: ANSWER }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        if (u.includes('api.search.brave.com')) return jsonResponse(u, { web: { results: [] } });
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
      };
      const res = makeTarget();
      ip += 1;
      const req = { method: 'POST',
        headers: { 'x-murabbi-device': 'speed-pipes-guard-' + String(ip).padStart(4, '0'), 'x-real-ip': '10.18.0.' + ip,
          [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
        body: { messages: [{ role: 'user', content: question }], band: 'adult', age: 35 } };
      const logs = [];
      const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
      console.log = (...a) => { logs.push(a); };
      console.warn = () => {}; console.error = () => {}; console.info = () => {};
      let crashed = null;
      try { await ASK.default(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
      globalThis.fetch = realFetch;
      const frames = framesOf(res.writes);
      const logOf = (tag) => (logs.find((a) => a[0] === tag) || [])[1] || null;
      return { res, frames, model, logOf, crashed, text: frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') };
    };
    try {
      const d = await drive(Q2);
      const t = d.logOf('[bw2]');
      const worked = d.model.filter((b) => b.system !== BW2.BW2_JUDGE_SYSTEM);
      ok('P3c question 2 through the real handler: no source row (or the judge keeps none), the turn goes on by itself -- no not-covered sentence, no offer',
        !d.crashed && t && ['no_rows', 'judge_none'].includes(t.continued) && !d.frames.some((f) => f.type === 'ezik_live_offer')
        && !d.text.includes(NOT_COVERED) && d.res.ended === 1,
        ascii(JSON.stringify({ t: t && t.continued, frames: d.frames.map((f) => f.type + (f.stage ? ':' + f.stage : '')), crashed: d.crashed && String(d.crashed.stack) })));
      const stages = d.frames.filter((f) => f.type === 'ezik_status').map((f) => f.stage);
      ok('P3d ...today\'s path answers it, its first round forced to search_sources, and the reader\'s line reads "searching" again before its text',
        worked[0] && worked[0].tool_choice && worked[0].tool_choice.name === 'search_sources' && stages[stages.length - 1] === 'retrieve'
        && stages.lastIndexOf('retrieve') > stages.indexOf('fatwa') && stages.indexOf('fatwa') > 0 && d.text.includes(ANSWER),
        ascii(JSON.stringify({ stages, first: worked[0] && worked[0].tool_choice, text: d.text.slice(0, 80) })));
    } finally {
      globalThis.fetch = realFetch;
      for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
  }
  process.exit(finish());
})().catch((error) => {
  ok('guard completed without exception', false, error && error.stack ? error.stack : String(error));
  process.exit(finish());
});
