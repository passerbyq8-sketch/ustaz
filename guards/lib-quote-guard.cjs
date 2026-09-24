// guards/lib-quote-guard.cjs -- LIB_QUOTE_V1: a request for the TEXT of a book is answered with
// the book's own words, composed by the server, and nothing changes when the switch is off.
//
// THE OWNER'S ASK (sources order, 24 September 2026). «ما نصّ كلام ابن قدامة في المغني عن …»،
// «انقل لي من كتاب زاد المعاد ما جاء في …» -- a quotation, which a model's paraphrase must never
// stand in for. lib/lib-quote.js detects the request, resolves the title OFFLINE against
// lib/data/lib-catalog.js, makes the library call through runTool('search_library') narrowed to
// that book, and composes: a card line (book · author · ج · ص, or the chapter heading when the book
// has no printed pages) and the atom's text letter for letter as a blockquote.
//
// WHAT THIS PINS:
//   A. api/ask.js reads LIB_QUOTE_V1 once, beside the library's switches; the gate expression is
//      cut out of the source and evaluated (on + adult + SHAMELA_BRAIN on + token); the seat sits
//      after the route and before the stream is committed, and asks the two protections itself;
//      lib/ has no env read and still exactly one searchLibrary call site; the catalogue is whole;
//      max_chars_per_hit travels ONLY when a caller asks for it.
//   B. the detector and planner on 38 real-language fixtures (guards/fixtures-lib-quote.json),
//      the owner's sixteen sealed quotation requests among them, ordinary questions included.
//   C. the pure composer rules: modern = one paragraph cut at a sentence end before 700, a cut
//      atom says so, refusals carry no digit and no machinery word.
//   D. the REAL api/ask.js handler, driven with one fake globalThis.fetch whose library replies
//      are REAL atoms of the production index: cases (a)-(f) and the rest, byte-exact, with zero
//      provider calls on the quote path; OFF by default (flag unset: the model is called and the
//      library is not); a child, a grave hazard and an ordinary question are never quoted.
//   E. mutants of lib/lib-quote.js (and the gate expression), each killed.
//
// Usage: node guards/lib-quote-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lib-quote.json'), 'utf8'));
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
// Terminal output stays ASCII: Arabic in a detail line is printed as \u escapes.
const ascii = (v) => JSON.stringify(typeof v === 'string' ? v : v === undefined ? null : v)
  .replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (a) => a.slice().sort();

const LIB_SEARCH = 'https://lib.ezik.app/search';
const TOKEN = 'tk-quote-1';
const BOOK = '\u{1F4D6}';
const DIGIT = /[0-9٠-٩۰-۹]/;
const MACHINERY = ['المكتبة', 'المكتبه', 'بحثنا', 'الخدمة', 'الفهرس', 'الشاملة', 'الشامله', 'الذرة',
  'نتائج البحث', 'lib.ezik', 'ezik-shamela', 'FC-', 'atom'];
const namesMachinery = (t) => MACHINERY.filter((w) => String(t).includes(w));
// An environment READ (a comment saying there is none is not one).
const ENV_READ = /process\.env\s*[.[]|\benv\.LIB_QUOTE_V1/;

// ---- the guard's OWN rendering of the expected reply (not the module's) ----------------------
const cardWithPage = (h) => BOOK + ' «' + h.book_title + '» · ' + h.author
  + ' · ج' + h.volume + ' · ص'
  + (h.page_end > h.page_start ? h.page_start + '–' + h.page_end : String(h.page_start));
const cardWithHeading = (h) => BOOK + ' «' + h.book_title + '» · ' + h.author
  + ' · ' + h.heading_path[h.heading_path.length - 1];
const quote = (body) => body.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n');
const paragraphsOf = (t) => t.split('\n').map((p) => p.trim()).filter(Boolean);
// The spec's cut: the last sentence end before 700, else the last space; then « …».
function specCut(p) {
  let end = -1;
  for (let i = 0; i < 700; i++) if ('.!?؟'.includes(p[i])) end = i + 1;
  if (end <= 0) end = p.lastIndexOf(' ', 700);
  return p.slice(0, end).trimEnd() + ' …';
}
const hit0 = (key) => FIX.atoms[key].response.hits[0];

(async () => {
  console.log('\n=== lib-quote -- the book\'s own words, composed by the server (LIB_QUOTE_V1) ===');
  const askSrc = read('api/ask.js');
  const quoteSrc = read('lib/lib-quote.js');
  const LQ = await esm('lib/lib-quote.js');
  const TOOLS = await esm('lib/free-brain/tools.js');
  const SVC = await esm('lib/lib-service.js');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-lib-quote-'));
  const realFetch = globalThis.fetch;
  const ENV_KEYS = ['LIB_QUOTE_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1',
    'LIB_MUJAZ_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG', 'VERCEL_ENV',
    'VERCEL_URL', 'SEARCH_BUDGET_GLOBAL_PRODUCTION', 'SEARCH_BUDGET_GLOBAL_PREVIEW', 'SEARCH_BUDGET_GLOBAL_DEVELOPMENT',
    'SEARCH_BUDGET_PER_CALLER', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'ENCYC_V1'];
  const savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  try {
    // =====================================================================================
    console.log('\n--- A. the switch, the seat, the one door, the catalogue ---');
    const flagReads = (askSrc.match(/process\.env\.LIB_QUOTE_V1/g) || []).length;
    ok('A1  LIB_QUOTE_V1 is read in api/ask.js exactly once, and lib/ reads no environment for it',
      flagReads === 1 && !ENV_READ.test(quoteSrc)
      && !ENV_READ.test(read('lib/free-brain/tools.js')) && !ENV_READ.test(read('lib/lib-service.js')),
      'reads=' + flagReads);
    const gateExpr = (/\n  if \((libQuoteValue === 'on' && [^\n]+)\) \{\n    const libQuote = await import\('\.\.\/lib\/lib-quote\.js'\);/.exec(askSrc) || [])[1] || '';
    ok('A2  the gate expression was found whole in api/ask.js', gateExpr !== '', gateExpr);
    const decide = (expr) => (v, band, flag, token) => {
      try { return new Function('libQuoteValue', 'band', 'libFlagValue', 'libToken', 'return (' + expr + ');')(v, band, flag, token); }
      catch { return 'threw'; }
    };
    const table = (fn) => [
      fn('on', 'adult', 'on', 'tk') === true,
      fn('', 'adult', 'on', 'tk') === false,
      fn('off', 'adult', 'on', 'tk') === false,
      fn('true', 'adult', 'on', 'tk') === false,
      fn('on', 'teen', 'on', 'tk') === false,
      fn('on', 'young', 'on', 'tk') === false,
      fn('on', 'adult', 'off', 'tk') === false,
      fn('on', 'adult', 'on', '') === false,
    ];
    ok('A3  taken only for: LIB_QUOTE_V1 on + adult + SHAMELA_BRAIN on + a token (8 rows)',
      table(decide(gateExpr)).every(Boolean), JSON.stringify(table(decide(gateExpr))));
    ok('A3b ...and the value is read trimmed and lower-cased, like SHAMELA_BRAIN',
      /const libQuoteValue = String\(process\.env\.LIB_QUOTE_V1 \|\| ''\)\.trim\(\)\.toLowerCase\(\);/.test(askSrc));
    const at = (s) => askSrc.indexOf(s);
    const seat = at('return libQuote.writeQuoteReply(res, quoted.text);');
    ok('A4  the seat is after the route and before the stream is committed and wrapped',
      seat > at('const effectiveRoute = currentRuntime === \'GENERAL\'') && seat < at('let keepAlive = setInterval(')
      && seat < askSrc.indexOf('res = createFinalizedSseResponse(res, {', at('export default async function handler('))
      && seat > at('const cap = await guardDayCap(req, res);'),
      JSON.stringify({ seat, route: at('const effectiveRoute'), commit: at('let keepAlive = setInterval(') }));
    const block = askSrc.slice(at("if (libQuoteValue === 'on'"), seat);
    ok('A5  ...and it asks the two protections that run later on every path (hazard, health referral)',
      block.includes('!graveHazard(currentQuestionText)') && block.includes(".outcome !== 'REFER_ADULT'"));
    ok('A6  the library call goes through runTool, and the quote writer is not sendSynthesizedText',
      /runTool\('search_library', \{ query \}, ctx\)/.test(quoteSrc) && !/sendSynthesizedText/.test(block)
      && (askSrc.match(/sendSynthesizedText\(res,/g) || []).length === 3);
    const callSites = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'guards') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx|cjs|mjs)$/.test(entry.name)) continue;
        const body = fs.readFileSync(full, 'utf8');
        if (/\bsearchLibrary\s*\(/.test(body) && !/export async function searchLibrary/.test(body)) {
          callSites.push(path.relative(REPO, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(REPO);
    ok('A7  searchLibrary still has exactly ONE call site (lib/free-brain/tools.js)',
      callSites.length === 1 && callSites[0] === 'lib/free-brain/tools.js', JSON.stringify(callSites));
    const CAT = (await esm('lib/data/lib-catalog.js')).LIB_CATALOG;
    const counts = { turath: 0, fatwa: 0, modern: 0, auto: 0, blocked: 0 };
    for (const r of CAT) { counts[r[3]] = (counts[r[3]] || 0) + 1; counts.auto += r[4]; counts.blocked += r[5]; }
    // Quote order 2026-09-24: the turath line is 1300 AH, not 1400 -- the 388 turath books of the
    // 1301-1400 band are modern (4433 -> 4045 turath, 2879 -> 3267 modern); nothing else moved.
    ok('A8  the catalogue is whole: 7,400 unique ids, 4045 turath / 88 fatwa / 3267 modern, 943 auto, 15 blocked',
      CAT.length === 7400 && new Set(CAT.map((r) => r[0])).size === 7400 && CAT.every((r) => r.length === 6)
      && same(counts, { turath: 4045, fatwa: 88, modern: 3267, auto: 943, blocked: 15 }), JSON.stringify(counts));
    // max_chars_per_hit: additive, only when a caller asks.
    const bodies = [];
    const bodyFetch = async (url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, url: String(url), headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        text: async () => JSON.stringify({ hits: [] }) };
    };
    await SVC.searchLibrary('q', { flagValue: 'on', token: TOKEN, fetchImpl: bodyFetch });
    await SVC.searchLibrary('q', { flagValue: 'on', token: TOKEN, fetchImpl: bodyFetch, maxCharsPerHit: 2000 });
    await SVC.searchLibrary('q', { flagValue: 'on', token: TOKEN, fetchImpl: bodyFetch, maxCharsPerHit: 9999 });
    const ctx0 = { table: TOOLS.createEvidenceTable(), spend: [], degraded: [], libFlagValue: 'on', libToken: TOKEN, fetchImpl: bodyFetch };
    await TOOLS.runTool('search_library', { query: 'q' }, ctx0);
    ok('A9  max_chars_per_hit travels only when asked, clamped to the ceiling; the model\'s call is unchanged',
      same(Object.keys(bodies[0]).sort(), ['limit', 'q']) && bodies[1].max_chars_per_hit === 2000
      && bodies[2].max_chars_per_hit === 2000 && same(Object.keys(bodies[3]).sort(), ['limit', 'q']),
      JSON.stringify(bodies));

    // =====================================================================================
    console.log('\n--- B. the detector and the planner, ' + FIX.detector.length + ' fixtures ---');
    ok('B0  at least twelve fixtures, the owner\'s sixteen among them', FIX.detector.length >= 12
      && FIX.detector.filter((d) => /^owner-Q\d\d$/.test(d.id || '')).length === 16);
    FIX.detector.forEach((fx, i) => {
      const label = 'B' + (i + 1) + ' ' + (fx.id || 'fixture') + ' ';
      const d = LQ.detectQuoteRequest(fx.q);
      const gotD = d ? { kind: d.kind, shape: d.shape, explicitBook: d.explicitBook } : null;
      const p = d ? LQ.planQuote(d) : null;
      let good = same(gotD, fx.detect);
      let detail = 'detect ' + ascii(gotD) + ' want ' + ascii(fx.detect);
      if (good && fx.plan === null) { good = p === null; detail = 'plan ' + ascii(p && p.outcome) + ' want null'; }
      else if (good) {
        const ids = p ? p.books.map((b) => b.id) : null;
        good = !!p && p.outcome === fx.plan.outcome && same(sorted(ids), sorted(fx.plan.ids))
          && (fx.plan.topic === undefined || p.topic === fx.plan.topic)
          && (fx.plan.titleText === undefined || p.titleText === fx.plan.titleText);
        detail = 'plan ' + ascii(p && { outcome: p.outcome, ids, topic: p.topic, titleText: p.titleText }) + ' want ' + ascii(fx.plan);
      }
      ok(label + (fx.detect ? fx.detect.shape : 'none') + ' -> ' + (fx.plan ? fx.plan.outcome : 'not taken'), good, detail);
    });

    // =====================================================================================
    console.log('\n--- C. the composer, on real atoms ---');
    {
      const long = hit0('modern_long');
      const p = paragraphsOf(long.text).find((x) => x.length > 700);
      const got = LQ.quotedText(long, 'modern', 'الصيام');
      ok('C1  modern: ONE paragraph, cut before 700 at a sentence end or else a space, marked « …», a verbatim prefix',
        got === specCut(p) && got.length <= 702 && !got.includes('\n') && p.startsWith(got.slice(0, -2)), ascii(got.slice(-40)));
      const cutAtom = hit0('modern_cut');
      const p2 = paragraphsOf(cutAtom.text).find((x) => x.length > 700);
      const got2 = LQ.quotedText(cutAtom, 'modern', 'الصيام');
      ok('C2  ...and where a sentence ends before 700 the cut is there', got2 === specCut(p2) && /\. …$/.test(got2), ascii(got2.slice(-30)));
      const tr = FIX.atoms.turath_print.response.hits.find((h) => h.truncated === true);
      const got3 = LQ.quotedText(tr, 'turath', '');
      ok('C3  a turath atom the service cut is quoted whole and marked « …», never presented as whole',
        !!tr && got3 === tr.text.trim() + ' …');
      ok('C4  a blank line inside a quotation stays inside the blockquote', LQ.blockquote('a\n\nb') === '> a\n>\n> b');
      ok('C5  an echoed reader phrase keeps letters only: no digit, no markup',
        LQ.echo('<b>كتاب 45</b> «الغواصين»') === 'b كتاب b الغواصين');
      const refusals = [
        LQ.noBookReply('الغواصين', 'فلان'), LQ.askWhichReply([{ title: 'أ', author: 'ب' }, { title: 'ج', author: 'د' }]),
        LQ.blockedReply({ title: 'مجلة الأستاذ' }), LQ.pageReply({ title: 'المغني لابن قدامة' }), LQ.pageReply(null),
        LQ.needTopicReply({ title: 'مجموع الفتاوى' }), LQ.noHitReply({ title: 'زاد المعاد' }, 'الغوص 45'),
        LQ.tooBroadReply({ title: 'مجموع الفتاوى' }, 'صلاة الضحى'), LQ.unavailableReply({ title: 'مجموع الفتاوى' }),
      ];
      ok('C6  no refusal or question carries a digit or names the machinery (9 composers)',
        refusals.every((t) => !DIGIT.test(t) && namesMachinery(t).length === 0), ascii(refusals.filter((t) => DIGIT.test(t) || namesMachinery(t).length)));
      ok('C7  a page reply naming a book whose title carries a digit leaves the title out',
        !DIGIT.test(LQ.pageReply({ title: 'مجلة 2' })));
    }

    // =====================================================================================
    console.log('\n--- D. the real api/ask.js handler ---');
    const LEDGER_REDIS = await esm('lib/ledger/redis.js');
    const DAYCAP = await esm('lib/daycap.js');
    const FLAG = await esm('lib/ledger/flag.js');
    const LEGACY = await esm('lib/legacy-policy-flag.js');
    const CONSENT = await esm('lib/ai-consent.js');
    const FIN = await esm('lib/finalize-reader-text.js');
    const handler = (await esm('api/ask.js')).default;
    const capCounts = new Map();
    const installDayCapStore = () => {
      capCounts.clear();
      DAYCAP.__setRedisForTest({
        async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
        async sismember() { return 0; },
        pipeline() {
          const ops = [];
          return {
            incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
            expire() { ops.push(() => 1); },
            async exec() { return ops.map((f) => f()); },
          };
        },
      });
    };
    const makeRes = () => ({
      writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false, wroteAfterEnd: false,
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; },
      flushHeaders() { this.headersSent = true; },
      write(s) { if (this.ended) this.wroteAfterEnd = true; this.headersSent = true; this.writes.push(String(s)); return true; },
      end() { this.ended += 1; this.headersSent = true; return this; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
    });
    const readerText = (res) => res.writes.join('').split('\n').filter((l) => l.startsWith('data: '))
      .map((l) => { try { return JSON.parse(l.slice(6).trim()); } catch { return null; } })
      .filter((p) => p && p.type === 'content_block_delta').map((p) => p.delta.text).join('');
    const jsonResponse = (url, o, status = 200) => ({
      ok: status >= 200 && status < 300, status, url: String(url),
      headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => o, text: async () => JSON.stringify(o),
    });
    let ipSeq = 0;
    async function drive(question, { env = {}, lib = null, band = 'adult', age = 35, modelText = 'جواب عام من الاختبار.' } = {}) {
      for (const k of ENV_KEYS) delete process.env[k];
      process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
      process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
      process.env.LEDGER_RAG = 'off';
      Object.assign(process.env, env);
      LEDGER_REDIS.__setRedisForTest(null);
      FLAG.__resetFlagCacheForTest();
      LEGACY.__resetLegacyFlagCacheForTest();
      installDayCapStore();
      const calls = [];
      let libN = 0;
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith(LIB_SEARCH)) {
          let body = null; try { body = JSON.parse(init && init.body || 'null'); } catch { body = null; }
          calls.push({ kind: 'lib', body });
          const r = lib ? lib(body, libN++) : { status: 404, payload: {} };
          return jsonResponse(r.url || u, r.payload, r.status || 200);
        }
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          calls.push({ kind: 'model' });
          if (b.stream) {
            let done = false;
            return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
              body: { getReader: () => ({ read: async () => {
                if (done) return { done: true, value: undefined };
                done = true;
                const frames = 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: modelText } })
                  + '\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n';
                return { done: false, value: new TextEncoder().encode(frames) };
              } }) } };
          }
          return jsonResponse(u, { content: [{ type: 'text', text: modelText }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        calls.push({ kind: 'other', url: u.slice(0, 60) });
        if (u.includes('api.search.brave.com')) return jsonResponse(u, { web: { results: [] } });
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
      };
      const res = makeRes();
      ipSeq += 1;
      const req = {
        method: 'POST',
        headers: { 'x-murabbi-device': 'lib-quote-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.9.0.' + ipSeq,
          [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
        body: { messages: [{ role: 'user', content: question }], band, age },
      };
      const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
      let outcome = null;
      let crashed = null;
      console.log = (...a) => { if (a[0] === '[lib-quote]' && a[1]) outcome = a[1].outcome; };
      console.warn = () => {}; console.error = () => {}; console.info = () => {};
      try { await handler(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, saved); }
      globalThis.fetch = realFetch;
      const libCalls = calls.filter((c) => c.kind === 'lib');
      const firstModel = calls.findIndex((c) => c.kind === 'model');
      const firstLib = calls.findIndex((c) => c.kind === 'lib');
      return { res, text: readerText(res), crashed, outcome, libCalls, modelCalls: calls.filter((c) => c.kind === 'model').length,
        libBeforeModel: firstLib !== -1 && (firstModel === -1 || firstLib < firstModel) };
    }
    const ON = { LIB_QUOTE_V1: 'on', SHAMELA_BRAIN: 'on', SEARCH_API_TOKEN: TOKEN };
    const serve = (key) => () => ({ payload: FIX.atoms[key].response });
    const quotePath = (r) => !r.crashed && r.modelCalls === 0 && r.res.ended === 1 && r.res.statusCode === 200
      && String(r.res.headers['content-type'] || '').startsWith('text/event-stream') && !r.res.wroteAfterEnd;
    const pathDetail = (r) => JSON.stringify({ crashed: r.crashed && String(r.crashed.stack || r.crashed).slice(0, 300), model: r.modelCalls,
      ended: r.res.ended, status: r.res.statusCode, ct: r.res.headers['content-type'], outcome: r.outcome });
    const libBody = (r, i = 0) => (r.libCalls[i] && r.libCalls[i].body) || {};

    // (a) turath -- the whole atom, a page card; two editions of one work searched as one
    {
      const h = hit0('turath_print');
      const r = await drive('انقل لي من كتاب تاريخ الإسلام ما جاء في الزكاة', { env: ON, lib: serve('turath_print') });
      ok('Da1 (a) turath: quote path -- no provider call, one close, HTTP 200 event-stream', quotePath(r), pathDetail(r));
      ok('Da1 ...card + blockquote byte-exact (the whole atom, ج/ص from the atom)',
        r.text === cardWithPage(h) + '\n\n' + quote(h.text), ascii(r.text.slice(0, 120)));
      const b = libBody(r);
      ok('Da1 ...ONE library request: the topic, both editions of the work, 3 rows, the whole atom asked for',
        r.libCalls.length === 1 && b.q === 'الزكاة' && same(b.filters && b.filters.book_ids, ['FC-006195', 'FC-006497'])
        && b.limit === 3 && b.max_chars_per_hit === 2000 && r.outcome === 'quoted', ascii(b));
    }
    // (a) fatwa -- the whole atom
    {
      const h = hit0('fatwa_print');
      const r = await drive('اكتب لي نص ما قاله ابن تيمية في مجموع الفتاوى عن الزكاة', { env: ON, lib: serve('fatwa_print') });
      ok('Da2 (a) fatwa: byte-exact, whole atom, no provider call',
        quotePath(r) && r.text === cardWithPage(h) + '\n\n' + quote(h.text)
        && same(libBody(r).filters.book_ids, ['FC-004493']), ascii(r.text.slice(0, 120)) + ' ' + pathDetail(r));
    }
    // (a) turath whose own text the finalizer's seal would refuse
    {
      const h = hit0('turath_print2');
      const r = await drive('انقل لي من كتاب عمدة القاري ما جاء في الوضوء', { env: ON, lib: serve('turath_print2') });
      const want = cardWithPage(h) + '\n\n' + quote(h.text);
      ok('Da3 (a) a commentary quoting «روى ابن أبي شيبة …» reaches the reader letter for letter',
        quotePath(r) && r.text === want && r.text.includes('روى ابْن أبي شيبَة'), ascii(r.text.slice(0, 120)));
      const fin = FIN.finalizeReaderText({ wireText: want, text: want, fallbackText: 'X', sourceCards: [], readerCards: [] });
      console.log('  INFO  why the quote has its own writer: the finalizer ' + (fin.text === want ? 'now passes' : 'REPLACES')
        + ' this quotation (problems ' + ascii(fin.problems || []) + ')');
    }
    // (a) modern -- one paragraph, the best topic overlap
    {
      const h = hit0('modern_print');
      const r = await drive('انقل لي من كتاب الموسوعة الفقهية الكويتية ما جاء في صيام ثلاثة أيام', { env: ON, lib: serve('modern_print') });
      const p = paragraphsOf(h.text)[4];
      ok('Da4 (a) modern: ONE paragraph (the one about three days), byte-exact, a verbatim substring',
        quotePath(r) && r.text === cardWithPage(h) + '\n\n> ' + p && h.text.includes(p), ascii(r.text.slice(-80)));
    }
    {
      const h = hit0('modern_long');
      const r = await drive('انقل لي من كتاب التفسير المنير للزحيلي ما جاء في الصيام', { env: ON, lib: serve('modern_long') });
      const p = paragraphsOf(h.text).find((x) => x.length > 700);
      ok('Da5 (a) modern, a paragraph over 700: cut, marked, still a verbatim prefix',
        quotePath(r) && r.text === cardWithPage(h) + '\n\n> ' + specCut(p), ascii(r.text.slice(-60)));
    }
    {
      const h = hit0('modern_cut');
      const r = await drive('انقل لي من كتاب المسند الجامع ما جاء في الصيام', { env: ON, lib: serve('modern_cut') });
      const p = paragraphsOf(h.text).find((x) => x.length > 700);
      ok('Da6 (a) a page range prints as ص<start>–<end>, and the modern cut lands on a sentence end',
        quotePath(r) && r.text === cardWithPage(h) + '\n\n> ' + specCut(p) && r.text.includes('ص' + h.page_start + '–' + h.page_end),
        ascii(r.text.slice(0, 90)));
    }
    // (a) automatically numbered -- the heading, never a page
    {
      const h = hit0('auto');
      const r = await drive('انقل لي من كتاب شرح سنن أبي داود للعباد ما جاء في تغيير النية في الحج', { env: ON, lib: serve('auto') });
      const card = r.text.split('\n')[0];
      ok('Da7 (a) auto-numbered: card = book · author · last heading, NO page and NO volume',
        quotePath(r) && card === cardWithHeading(h) && !/[جص]\d/.test(card)
        && !card.includes(String(h.page_start)) && !card.includes(String(h.volume)), ascii(card));
      ok('Da7 ...and the text is one verbatim paragraph (the question line, ties to the longer)',
        r.text === cardWithHeading(h) + '\n\n> ' + paragraphsOf(h.text)[2], ascii(r.text.slice(-60)));
    }
    // (b) a page by number -- D7
    for (const [id, q, title] of [
      ['Db1', 'ما نص صفحة 50 من الجزء 25 من كتاب مجموع الفتاوى؟', 'مجموع الفتاوى'],
      ['Db2', 'انسخ لي ما في الصفحة 120 من المجلد الخامس من مجموع فتاوى ابن باز', 'مجموع فتاوى ابن باز'],
      ['Db3', 'اكتب لي نص الصفحة ٢٥٠ من الجزء الثاني من لمعة الاعتقاد لابن قدامة', 'لمعة الاعتقاد'],
    ]) {
      const r = await drive(q, { env: ON, lib: serve('fatwa_print') });
      ok(id + ' (b) a page by number: honest, names the book, offers the topic road; no digit, no machinery, no call',
        quotePath(r) && r.libCalls.length === 0 && r.outcome === 'page_request' && r.text.includes('«' + title + '»')
        && r.text.includes('لا أستطيع أن أنقل لك صفحة بعينها برقمها') && r.text.includes('ما جاء في')
        && !DIGIT.test(r.text) && namesMachinery(r.text).length === 0, ascii(r.text) + ' ' + pathDetail(r));
    }
    // (c) no such book
    {
      const r = await drive('انقل لي من كتاب الغواصين في البحار ما جاء في الصلاة', { env: ON, lib: serve('fatwa_print') });
      ok('Dc1 (c) no such book: says so plainly, byte-exact, no call',
        quotePath(r) && r.libCalls.length === 0 && r.outcome === 'no_book'
        && r.text === 'ليس عندي كتاب باسم «الغواصين في البحار». إن كان للكتاب اسم آخر يعرف به، أو كان عندك اسم مؤلفه، فاذكره لي.',
        ascii(r.text));
      const r2 = await drive('اكتب لي نص كلام القرضاوي في كتابه فقه الزكاة عن زكاة الأسهم', { env: ON, lib: serve('fatwa_print') });
      ok('Dc2 (c) a title under an author who wrote no such book is no book either (owner Q10)',
        quotePath(r2) && r2.libCalls.length === 0 && r2.text.startsWith('ليس عندي كتاب باسم «فقه الزكاة» لـالقرضاوي.'), ascii(r2.text));
    }
    // (d) two or more books
    {
      const r = await drive('انقل لي من كتاب بر الوالدين ما جاء في طاعة الأم', { env: ON, lib: serve('fatwa_print') });
      const want = 'عندي أكثر من كتاب بهذا الاسم، فأيها تقصد؟\n\n'
        + ['FC-004852', 'FC-004957', 'FC-005019'].map((id) => { const b = CAT.find((x) => x[0] === id); return '- «' + b[1] + '» لـ' + b[2]; }).join('\n');
      ok('Dd1 (d) several books: asks which, listing «title» لـauthor, byte-exact, no call',
        quotePath(r) && r.libCalls.length === 0 && r.outcome === 'ask_which' && r.text === want, ascii(r.text));
    }
    // (e) blocked
    {
      const r = await drive('انقل لي من كتاب مجلة الأستاذ ما جاء في التعليم', { env: ON, lib: serve('fatwa_print') });
      ok('De1 (e) a blocked book: does not quote from it, byte-exact, and the library is never asked',
        quotePath(r) && r.libCalls.length === 0 && r.outcome === 'blocked' && r.text === 'لا أنقل من كتاب «مجلة الأستاذ».', ascii(r.text));
      const r2 = await drive('انقل لي من كتاب لقاءات ملتقى أهل الحديث بالعلماء نص ما قيل عن طلب العلم', { env: ON, lib: serve('fatwa_print') });
      ok('De2 (e) the owner\'s Q09 (the service itself does not block it): refused before any call',
        quotePath(r2) && r2.libCalls.length === 0 && r2.text === 'لا أنقل من كتاب «لقاءات ملتقى أهل الحديث بالعلماء».', ascii(r2.text));
    }
    // (f) nothing in that book on that topic
    {
      const r = await drive('انقل لي من كتاب زاد المعاد ما جاء في الغوص تحت الماء', { env: ON, lib: () => ({ payload: { hits: [], refused: false } }) });
      ok('Df1 (f) no hit: says he found nothing in that book on that topic, byte-exact',
        quotePath(r) && r.libCalls.length === 1 && r.outcome === 'no_hit'
        && r.text === 'لم أجد في «زاد المعاد في هدي خير العباد» شيئا عن «الغوص تحت الماء». جرب أن تذكر المسألة بلفظ آخر كما قد ترد في الكتاب.',
        ascii(r.text));
    }
    // refused (too common a topic): one narrower retry, then quote or say so
    {
      const h = hit0('fatwa_print');
      const r = await drive('انقل لي من كتاب مجموع الفتاوى ما جاء في صلاة الضحى', { env: ON,
        lib: (body, n) => (n === 0 ? { payload: { hits: [], refused: true, refused_reason: 'estimated_postings_exceed_ceiling' } } : { payload: FIX.atoms.fatwa_print.response }) });
      ok('Dg1 a refused topic is asked once more with its rarer words, and the answer is quoted',
        quotePath(r) && r.libCalls.length === 2 && libBody(r, 0).q === 'صلاة الضحى' && libBody(r, 1).q === 'الضحى'
        && r.text === cardWithPage(h) + '\n\n' + quote(h.text), ascii(r.libCalls.map((c) => c.body.q)));
      const r2 = await drive('انقل لي من كتاب مجموع الفتاوى ما جاء في صلاة الضحى', { env: ON,
        lib: () => ({ payload: { hits: [], refused: true } }) });
      ok('Dg2 ...and refused twice: says the topic is too wide in that book -- not «found nothing»',
        quotePath(r2) && r2.libCalls.length === 2 && r2.outcome === 'too_broad'
        && r2.text === '«صلاة الضحى» باب واسع في «مجموع الفتاوى». اذكر لي مسألة أدق منه، وأنقل لك نص ما جاء فيها.', ascii(r2.text));
    }
    // a failed call is not an empty book
    {
      const want = 'تعذر علي الآن أن أنقل لك من «مجموع الفتاوى». أعد السؤال بعد قليل.';
      const r = await drive('انقل لي من كتاب مجموع الفتاوى ما جاء في زكاة الغنم', { env: ON, lib: () => ({ status: 401, payload: { error: { code: 'unauthorized' } } }) });
      ok('Dh1 a 401 from the library says it could not quote now, never «found nothing»',
        quotePath(r) && r.outcome === 'unavailable' && r.text === want, ascii(r.text));
      const r2 = await drive('انقل لي من كتاب مجموع الفتاوى ما جاء في زكاة الغنم', { env: ON,
        lib: () => ({ url: 'https://elsewhere.example/search', payload: FIX.atoms.fatwa_print.response }) });
      ok('Dh2 ...and so does a reply from a redirected origin (the door refuses it)', quotePath(r2) && r2.text === want, ascii(r2.text));
    }
    {
      const r = await drive('انقل لي من كتاب مجموع الفتاوى', { env: ON, lib: serve('fatwa_print') });
      ok('Di1 a book with no topic: asks for the topic, no call',
        quotePath(r) && r.libCalls.length === 0 && r.outcome === 'need_topic' && r.text.startsWith('اذكر لي المسألة التي تريد نصها من «مجموع الفتاوى»'), ascii(r.text));
    }
    // OFF by default, and never for a child, a hazard or an ordinary question
    {
      const q = 'انقل لي من كتاب تاريخ الإسلام ما جاء في الزكاة';
      const off = await drive(q, { env: { SHAMELA_BRAIN: 'on', SEARCH_API_TOKEN: TOKEN, FREE_BRAIN_V1: 'on' }, lib: serve('turath_print') });
      ok('Dj1 OFF BY DEFAULT: flag unset -> the model IS called, the library is not called before it, no quote card',
        !off.crashed && off.modelCalls >= 1 && !off.libBeforeModel && off.libCalls.length === 0 && !off.text.startsWith(BOOK)
        && off.outcome === null && off.res.ended === 1, pathDetail(off) + ' lib=' + off.libCalls.length);
      const offExplicit = await drive(q, { env: { LIB_QUOTE_V1: 'off', SHAMELA_BRAIN: 'on', SEARCH_API_TOKEN: TOKEN, FREE_BRAIN_V1: 'on' }, lib: serve('turath_print') });
      ok('Dj2 LIB_QUOTE_V1=off: the same', !offExplicit.crashed && offExplicit.modelCalls >= 1 && offExplicit.libCalls.length === 0 && offExplicit.outcome === null,
        pathDetail(offExplicit));
      const noToken = await drive(q, { env: { LIB_QUOTE_V1: 'on', SHAMELA_BRAIN: 'on', FREE_BRAIN_V1: 'on' }, lib: serve('turath_print') });
      ok('Dj3 ON but no library token: not taken, the model answers', !noToken.crashed && noToken.modelCalls >= 1 && noToken.outcome === null,
        pathDetail(noToken));
      const child = await drive(q, { env: { ...ON, FREE_BRAIN_V1: 'on' }, band: 'teen', age: 15, lib: serve('turath_print') });
      ok('Dk1 ON but a teen reader: never quoted, the library is not asked', !child.crashed && child.outcome === null
        && child.libCalls.length === 0 && !child.text.startsWith(BOOK), pathDetail(child));
      const hazard = await drive('انقل لي من كتاب مجموع الفتاوى ما جاء في كيف أخلط مواد التنظيف عشان تسوي فوران', { env: ON, lib: serve('fatwa_print') });
      ok('Dk2 ON but a grave hazard: the safety redirect, not a quotation, and no call',
        !hazard.crashed && hazard.outcome === null && hazard.libCalls.length === 0 && /خلط بعض المواد يطلع منه غاز/.test(hazard.text),
        ascii(hazard.text.slice(0, 80)));
      const plain = await drive('ما حكم صلاة الجماعة؟', { env: { ...ON, FREE_BRAIN_V1: 'on' }, lib: serve('fatwa_print') });
      ok('Dk3 ON and an ordinary question: not taken, the model answers, the library is not called before it',
        !plain.crashed && plain.outcome === null && plain.modelCalls >= 1 && !plain.libBeforeModel, pathDetail(plain));
    }

    // =====================================================================================
    console.log('\n--- E. mutants ---');
    async function mutant(name, edit, probe) {
      const changed = edit(quoteSrc);
      if (changed === quoteSrc || changed.indexOf(probe) === -1 || quoteSrc.indexOf(probe) !== -1) {
        ok('E  precondition: mutant ' + name + ' edits the source', false);
        return null;
      }
      const resolved = changed.replace(/(\bfrom\s*')(\.\.?\/[^']+)(')/g,
        (all, head, spec, tail) => head + pathToFileURL(path.resolve(path.join(REPO, 'lib'), spec)).href + tail);
      const file = path.join(temp, name + '.mjs');
      fs.writeFileSync(file, resolved, 'utf8');
      return import(pathToFileURL(file).href + '?v=' + name);
    }
    const detectPlan = (M, q) => M.planQuote(M.detectQuoteRequest(q));
    const M1 = await mutant('auto-gets-a-page', (s) => s.replace(
      "const printed = atom.page_citable === true && atom.numbering !== 'auto' && !catalogAuto && start !== null;",
      'const printed = start !== null; // mutant-auto-page'), 'mutant-auto-page');
    if (M1) ok('E1  MUTANT KILLED: an auto-numbered book printed with a page', /ص\d/.test(M1.quoteCard(hit0('auto'), true))
      && !/ص\d/.test(LQ.quoteCard(hit0('auto'), true)));
    const M2 = await mutant('modern-quoted-whole', (s) => s.replace(
      "  if (cls === 'modern') return modernParagraph(text, topic, atom.truncated === true);\n", '  // mutant-modern-whole\n'), 'mutant-modern-whole');
    if (M2) ok('E2  MUTANT KILLED: a modern book quoted whole instead of one paragraph',
      M2.quotedText(hit0('modern_print'), 'modern', 'صيام ثلاثة أيام').includes('\n'));
    const M3 = await mutant('blocked-ignored', (s) => s.replace(
      'const open = r.books.filter((b) => !b.blocked);', 'const open = r.books; // mutant-blocked'), 'mutant-blocked');
    if (M3) ok('E3  MUTANT KILLED: a blocked book planned for a search',
      detectPlan(M3, 'انقل لي من كتاب مجلة الأستاذ ما جاء في التعليم').outcome !== 'blocked');
    const M4 = await mutant('weak-shape-taken', (s) => s.replace(
      'if (!ask.explicitBook && (r.tier < 2 || !c.topic)) return null;', 'if (false) return null; // mutant-weak'), 'mutant-weak');
    if (M4) ok('E4  MUTANT KILLED: an ordinary «نص كلام العلماء في …» question taken as a book request',
      detectPlan(M4, 'ما نص كلام العلماء في حكم الغناء؟') !== null);
    const M5 = await mutant('cut-unmarked', (s) => s.replace(
      'return atom.truncated === true ? text + CUT_MARK : text;', 'return text; // mutant-no-mark'), 'mutant-no-mark');
    if (M5) {
      const tr = FIX.atoms.turath_print.response.hits.find((h) => h.truncated === true);
      ok('E5  MUTANT KILLED: a cut atom presented as whole', !M5.quotedText(tr, 'turath', '').endsWith(' …'));
    }
    const M6 = await mutant('no-narrower-retry', (s) => s.replace(
      '    if (narrow && foldArabic(narrow) !== foldArabic(plan.topic)) {', '    if (false) { // mutant-no-retry'), 'mutant-no-retry');
    if (M6) {
      let n = 0;
      const fetchImpl = async (url) => jsonResponse(url, n++ === 0 ? { hits: [], refused: true } : FIX.atoms.fatwa_print.response);
      const ask = M6.detectQuoteRequest('انقل لي من كتاب مجموع الفتاوى ما جاء في صلاة الضحى');
      const out = await M6.answerQuoteRequest(ask, { runTool: TOOLS.runTool, createEvidenceTable: TOOLS.createEvidenceTable,
        libFlagValue: 'on', libToken: TOKEN, fetchImpl });
      ok('E6  MUTANT KILLED: without the narrower retry a refused common topic reads as too wide', out && out.outcome === 'too_broad');
    }
    {
      const mutated = gateExpr.replace("band === 'adult' && ", '');
      ok('E7  MUTANT KILLED: the gate without its band clause would quote to a teen',
        mutated !== gateExpr && decide(mutated)('on', 'teen', 'on', 'tk') === true);
    }
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* temp only */ }
  }
  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL' : '  PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
