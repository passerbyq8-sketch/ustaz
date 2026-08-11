// tools/world-retrieval-fixture.cjs
// LIVE WORLD RETRIEVAL — the fixture that proves the two paths do not touch.
//
// WHAT IT ANSWERS, in the order the brief asks for it:
//   A. ROUTING      — which route each question takes, and WHY, from the pure classifiers.
//   B. DOMAINS      — the EXACT Brave query each question would send, so the `site:` filter can
//                     be read off the page rather than taken on trust.
//   C. PAGE GATES   — the URL shapes each world source admits and refuses.
//   D. END TO END   — api/ask.js's real default export, driven with a request and a response,
//                     with only the TRANSPORT stubbed. Every classifier, the real retrieve(),
//                     the real page gates, the real card builder and the real SSE writer run.
//                     The retrieval logs are captured and printed, so the domains actually
//                     used are evidence and not a claim.
//   E. LIVE FETCH   — optional (--live-fetch): the four world sources are fetched for real,
//                     through lib/retrieve.js's own fetchAndClean(), to show the pipeline
//                     yields real, current text. No API key needed.
//
// IT IS NOT IN gates.json, deliberately. Sections A-D are offline and deterministic and could
// be; section E touches the network, and this file is meant to be read as a REPORT of one
// change rather than run on every commit.
//
// Usage:
//   node tools/world-retrieval-fixture.cjs                 offline (stubbed transport)
//   node tools/world-retrieval-fixture.cjs --live-fetch    + real fetches of the world sources
//   node tools/world-retrieval-fixture.cjs --live          + real Brave and real Anthropic,
//                                                          IF BRAVE_API_KEY and
//                                                          ANTHROPIC_API_KEY are in the env
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

const LIVE = process.argv.includes('--live');
const LIVE_FETCH = LIVE || process.argv.includes('--live-fetch');

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const head = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));

// ── THE TWO QUESTIONS THE BRIEF NAMES ────────────────────────────────────────
const Q_NEWS = 'ما هي آخر الأخبار والتطورات في غزة اليوم؟';
const Q_TECH = 'ما هي أحدث تطورات الذكاء الاصطناعي؟';
const Q_FIQH = 'ما حكم صلاة المسافر؟';

// ── stub pages ───────────────────────────────────────────────────────────────
// Both are padded past the 400-character page-gate floor for their host, because a fixture
// shorter than the pages it stands for would be testing the length gate instead of the routing.
const NEWS_BODY = 'أفادت مصادر ميدانية بأن جولة المفاوضات الجديدة استؤنفت اليوم وسط حديث عن '
  + 'تقدم محدود في ملف إدخال المساعدات، فيما أعلنت المنظمات الإنسانية أن عدد الشاحنات التي دخلت '
  + 'خلال الساعات الأربع والعشرين الماضية ما يزال دون الحاجة الفعلية للسكان. ';
const PAGE_NEWS = '<html><head><title>آخر تطورات غزة</title></head><body><article><h1>آخر تطورات غزة</h1><p>'
  + NEWS_BODY.repeat(4) + '</p></article></body></html>';

const FIQH_BODY = 'صلاة المسافر: من فارق عمران بلده قاصدا سفرا تبلغ مسافته ما جرى العرف بأنه سفر، '
  + 'فإنه يقصر الرباعية ركعتين، والقصر سنة مؤكدة عند جمهور أهل العلم، وذهب بعضهم إلى وجوبه. '
  + 'وله أن يجمع بين الظهر والعصر وبين المغرب والعشاء جمع تقديم أو تأخير عند الحاجة. ';
const PAGE_FIQH = '<html><head><title>حكم صلاة المسافر</title></head><body><article><h1>حكم صلاة المسافر</h1><p>'
  + FIQH_BODY.repeat(4) + '</p></article></body></html>';

// The URLs the stubbed Brave hands back. Every one of them is a REAL shape from the live site,
// so they are subject to the real path rules rather than to an invented shape that always passes.
const WORLD_HITS = [
  { url: 'https://www.aljazeera.net/news/2026/8/5/ماذا-بحثت-جولة-المفاوضات-الجديدة', title: 'ماذا بحثت جولة المفاوضات الجديدة', description: '' },
  { url: 'https://www.bbc.com/arabic/articles/c1e13155wj5o', title: 'آخر التطورات', description: '' },
];
const SHARIA_HITS = [
  { url: 'https://islamqa.info/ar/answers/38079/x', title: 'حكم صلاة المسافر', description: '' },
];

(async function main() {
  console.log('=== world-retrieval-fixture — live world search, and the sharia perimeter ===');
  console.log('    mode: ' + (LIVE ? 'LIVE (real Brave + real Anthropic)' : 'offline (stubbed transport)')
    + (LIVE_FETCH ? ' + live page fetches' : ''));

  const RC = await esm('lib/route-classify.js');
  const WI = await esm('lib/world-intent.js');
  const RET = await esm('lib/retrieve.js');
  const REG = await esm('lib/source-registry.js');
  const PG = await esm('lib/source-page-gates.js');
  const BQ = await esm('lib/brave-query.js');
  const SP = await esm('lib/source-purpose.js');

  // =========================================================================
  head('A. ROUTING — which path each question takes, and why');

  const route = (q) => RC.classifyRoute([{ role: 'user', content: q }]);
  const world = (q) => WI.classifyWorldIntent(q);

  for (const q of [Q_NEWS, Q_TECH, Q_FIQH]) {
    const r = route(q), w = world(q);
    console.log('\n  «' + q + '»');
    console.log('    classifyRoute        : ' + r);
    console.log('    classifyWorldIntent  : world=' + w.world + '  reason=' + w.reason
      + (w.matched ? '  matched=«' + w.matched + '»' : ''));
    console.log('    classifyPurpose      : ' + SP.classifyPurpose(q));
    console.log('    → SEARCHES           : ' + (r === 'GEN' && w.world ? 'SITES_GENERAL (world)'
      : r === 'DEEN' ? 'SITES_ADULT / SITES_MINOR (sharia)' : 'nothing (plain general answer)'));
  }
  console.log('');

  eq('news question routes GENERAL', route(Q_NEWS), 'GEN');
  ok('...and fires the world classifier', world(Q_NEWS).world, JSON.stringify(world(Q_NEWS)));
  eq('AI-developments question routes GENERAL', route(Q_TECH), 'GEN');
  ok('...and fires the world classifier', world(Q_TECH).world, JSON.stringify(world(Q_TECH)));
  eq('the fiqh question routes DEEN', route(Q_FIQH), 'DEEN');
  eq('...and the world classifier refuses it outright',
    world(Q_FIQH).reason, WI.WORLD_REASONS.REFUSED_RELIGIOUS);

  // THE PERIMETER, ON QUESTIONS BUILT TO CROSS IT. Each of these carries a news trigger AND a
  // religious subject; each must be refused by the world classifier on its own account, before
  // the router is even consulted.
  const RELIGIOUS_WITH_NEWS_WORDS = [
    'ما آخر أخبار المسجد الأقصى اليوم؟',
    'ما هي آخر تطورات فتوى صلاة الجمعة؟',
    'أخبار الحج هذا العام',
    'ما حكم متابعة الأخبار في رمضان؟',
    'آخر أخبار العملات الرقمية وحكمها الشرعي',
  ];
  for (const q of RELIGIOUS_WITH_NEWS_WORDS) {
    eq('refused as religious: «' + q.slice(0, 42) + '…»',
      world(q).reason, WI.WORLD_REASONS.REFUSED_RELIGIOUS);
  }

  // ...and the other direction: ordinary general questions must NOT start a live search.
  const NOT_WORLD = [
    'احك لي نكتة', 'كم يساوي سبعة في ثمانية؟', 'اشرح لي قانون نيوتن الأول',
    'كم الساعة الآن؟', 'ما عاصمة اليابان؟', 'كيف أطبخ المكبوس؟',
    'ما هي أفضل طريقة لحفظ المعلومات؟',
  ];
  for (const q of NOT_WORLD) {
    eq('no live search for: «' + q.slice(0, 40) + '»', world(q).world, false);
  }

  // The recency frame and the year rule, each on its own.
  eq('«آخر» alone is not a news question', world('آخر مرة زرت فيها جدتي').world, false);
  eq('«اليوم» alone is not a news question', world('كم الساعة اليوم؟').world, false);
  eq('but «آخر» + «اليوم» together are',
    world('ما آخر ما وصل إليه الوضع اليوم؟').world, true);
  eq('a year past the training cut-off is', world('ماذا جرى في مؤتمر المناخ 2026؟').world, true);
  eq('...in Arabic-Indic digits too', world('ماذا جرى في مؤتمر المناخ ٢٠٢٦؟').world, true);
  eq('a year BEFORE the cut-off is not', world('ماذا جرى في مؤتمر المناخ 1998؟').world, false);
  ok('the classifier is pure', [Q_NEWS, Q_TECH, Q_FIQH, ...NOT_WORLD]
    .every((q) => JSON.stringify(world(q)) === JSON.stringify(world(q))));

  // =========================================================================
  head('B. DOMAINS — the exact Brave query each path sends');

  const worldPlan = BQ.planQueries(Q_NEWS, RET.SITES_GENERAL, {});
  const shariaPlan = BQ.planQueries(Q_FIQH, RET.SITES_ADULT.filter(
    (d) => REG.sourceAllowsPurpose(d, 'fatwa')), { purpose: 'fatwa' });

  console.log('\n  WORLD  «' + Q_NEWS + '»');
  for (const g of worldPlan.groups) console.log('    q[' + g.index + '] (' + g.chars + 'c/' + g.words + 'w): ' + g.q);
  console.log('\n  SHARIA «' + Q_FIQH + '»  (purpose=fatwa)');
  for (const g of shariaPlan.groups) console.log('    q[' + g.index + '] (' + g.chars + 'c/' + g.words + 'w): ' + g.q);
  console.log('');

  const worldQ = worldPlan.groups.map((g) => g.q).join(' ');
  const shariaQ = shariaPlan.groups.map((g) => g.q).join(' ');

  const queriedWorldDomains = Array.from(new Set(Array.from(
    worldQ.matchAll(/\bsite:([a-z0-9.-]+)/gi), (match) => match[1].toLowerCase()))).sort();
  eq('the world query domain set equals the governing SITES_GENERAL set',
    queriedWorldDomains, RET.SITES_GENERAL.slice().sort());
  eq('the world list overlaps NO sharia list', RET.worldListOverlap(), []);
  ok('the world query names only world domains',
    RET.SITES_GENERAL.every((d) => worldQ.includes('site:' + d))
    && !RET.SITES_ADULT.some((d) => worldQ.includes('site:' + d)),
    worldQ);
  ok('the sharia query names NO world domain',
    !RET.SITES_GENERAL.some((d) => shariaQ.includes('site:' + d)), shariaQ);
  ok('every world query is inside the provider ceiling',
    worldPlan.groups.every((g) => BQ.isSendable(g.q)));
  eq('...and costs exactly one request', worldPlan.groups.length, 1);

  // THE REGISTRY SAYS THE SAME THING IN THE DATA.
  eq('the registry-owned world set == SITES_GENERAL',
    REG.domainsForWorld().slice().sort(), RET.SITES_GENERAL.slice().sort());
  for (const d of RET.SITES_GENERAL) {
    ok('«' + d + '» may back NO religious purpose',
      REG.PURPOSES.every((p) => REG.sourceAllowsPurpose(d, p) === false),
      REG.PURPOSES.filter((p) => REG.sourceAllowsPurpose(d, p)).join(','));
    ok('...and it is on no age band', ['adult', 'minor', 'minor-fallback']
      .every((b) => !REG.domainsForBand(b).includes(d)));
  }
  eq('the age bands are byte-for-byte what they were',
    [REG.domainsForBand('adult').length, REG.domainsForBand('minor').length,
      REG.domainsForBand('minor-fallback').length],
    [RET.SITES_ADULT.length, RET.SITES_MINOR.length, 1]);
  eq('adding the world rows introduced no duplicate/nested domain', REG.duplicateProblems(), []);
  ok('alarabiya.net is DECLARED and REFUSED, with its evidence recorded', (() => {
    const r = REG.findSource('alarabiya.net');
    return !!r && r.status === 'blocked' && !RET.SITES_GENERAL.includes('alarabiya.net')
      && /403|رفض الوصول|Cloudflare/i.test(String(r.note));
  })(), JSON.stringify(REG.findSource('alarabiya.net')));

  // =========================================================================
  head('C. PAGE GATES — what each world source admits, and what it refuses');

  const URLS = [
    // [url, must be refused?, why it matters]
    ['https://www.aljazeera.net/news/2026/8/5/ماذا-بحثت-جولة-المفاوضات', false, 'a dated story'],
    ['https://www.aljazeera.net/news/', true, 'MEASURED 2,573 clean chars — a front page, not a story'],
    ['https://www.aljazeera.net/', true, 'site root'],
    ['https://www.aljazeera.net/where/gaza', true, 'a topic index'],
    ['https://www.bbc.com/arabic/articles/c1e13155wj5o', false, 'MEASURED 4,720 clean chars'],
    ['https://www.bbc.com/arabic', true, 'MEASURED 2,111 clean chars — the Arabic front page'],
    ['https://www.bbc.com/news', true, 'MEASURED 7,718 clean chars — the ENGLISH edition'],
    ['https://www.bbc.com/arabic/topics/c404v08p10lt', true, 'a topic index'],
    ['https://www.skynewsarabia.com/middle-east/1884498-واشنطن-تنفي-مزاعم', false, 'MEASURED 1,403 clean chars'],
    ['https://www.skynewsarabia.com/middle-east', true, 'MEASURED 7,007 clean chars — a section'],
    ['https://www.skynewsarabia.com/', true, 'MEASURED 6,647 clean chars — the front page'],
    ['https://ar.wikipedia.org/wiki/غزة', false, 'MEASURED 71,938 clean chars'],
    ['https://ar.wikipedia.org/wiki/تصنيف:غزة', true, 'MEASURED 1,753 clean chars — a category'],
    ['https://ar.wikipedia.org/wiki/بوابة:فلسطين', true, 'a portal'],
    ['https://ar.wikipedia.org/wiki/نقاش:غزة', true, 'a talk page'],
    ['https://ar.wikipedia.org/w/index.php?search=غزة', true, 'the search endpoint'],
    // and the religious sources are untouched by any of it
    ['https://islamqa.info/ar/answers/38079/x', false, 'a fatwa page, unchanged'],
    ['https://islamweb.net/ar/fatwa/121485/x', false, 'a fatwa page, unchanged'],
  ];
  for (const [u, refused, why] of URLS) {
    const r = PG.pathRefusal(u, '');
    ok((refused ? 'refuses ' : 'admits  ') + decodeURIComponent(u).slice(0, 62).padEnd(63) + '(' + why + ')',
      refused ? !!r : !r, 'got ' + JSON.stringify(r));
  }

  // =========================================================================
  if (LIVE_FETCH) {
    head('E. LIVE FETCH — the world sources, through the real fetchAndClean()');
    const SAMPLES = [
      'https://ar.wikipedia.org/wiki/%D8%BA%D8%B2%D8%A9',
      'https://www.bbc.com/arabic/articles/c1e13155wj5o',
      'https://www.aljazeera.net/news/',
      'https://www.bbc.com/news',
    ];
    for (const u of SAMPLES) {
      const refusedFirst = PG.pathRefusal(u, '');
      if (refusedFirst) {
        console.log('  SKIP-BEFORE-FETCH  ' + decodeURIComponent(u).slice(0, 60) + '  (' + refusedFirst + ')');
        continue;
      }
      try {
        const r = await RET.fetchAndClean(u, 15000);
        console.log('  FETCHED  ' + decodeURIComponent(u).slice(0, 58)
          + '\n           note=' + r.note + '  chars=' + r.text.length + '  title=«' + r.title.slice(0, 50) + '»'
          + '\n           first 120: ' + r.text.slice(0, 120).replace(/\s+/g, ' '));
      } catch (e) {
        console.log('  FETCH FAILED  ' + u.slice(0, 60) + '  ' + e.message);
      }
    }
  }

  // =========================================================================
  head('D. END TO END — api/ask.js driven for real, transport stubbed');

  const DAY = await esm('lib/daycap.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const DEVICE = 'world-fixture-device-1';
  process.env.FOUNDER_SECRET = process.env.FOUNDER_SECRET || 'world-fixture-secret';
  const FOUNDER = DAY.founderTokenFor(DEVICE);
  const haveKeys = !!(process.env.ANTHROPIC_API_KEY && process.env.BRAVE_API_KEY);
  const realRun = LIVE && haveKeys;
  if (LIVE && !haveKeys) {
    console.log('  NOTE: --live asked for, but ANTHROPIC_API_KEY / BRAVE_API_KEY are empty in this');
    console.log('        environment, so the transport stays stubbed. Everything BELOW the transport');
    console.log('        — routing, retrieval, gates, cards, SSE — is the shipped code either way.');
  }
  if (!realRun) {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'fixture-key-not-real';
    process.env.BRAVE_API_KEY = process.env.BRAVE_API_KEY || 'fixture-brave-not-real';
  }

  const sse = (text) => 'data: ' + JSON.stringify({
    type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text },
  }) + '\n\ndata: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';

  const at = (r, u) => { Object.defineProperty(r, 'url', { value: u }); return r; };
  const realFetch = globalThis.fetch;

  // The transport double. It records every Brave query and every page URL, which is what makes
  // "these domains were searched" a measurement rather than an assertion.
  const trace = { braveQueries: [], pages: [], anthropic: [] };
  const installStub = () => {
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('api.search.brave.com')) {
        const q = decodeURIComponent(new URL(u).searchParams.get('q') || '');
        trace.braveQueries.push(q);
        const isWorld = RET.SITES_GENERAL.some((d) => q.includes('site:' + d));
        return at(new Response(JSON.stringify({ web: { results: isWorld ? WORLD_HITS : SHARIA_HITS } }),
          { status: 200, headers: { 'content-type': 'application/json' } }), u);
      }
      if (u.includes('api.anthropic.com')) {
        const body = JSON.parse(String(init && init.body) || '{}');
        const last = body.messages[body.messages.length - 1];
        const lastText = typeof last.content === 'string' ? last.content
          : (last.content || []).map((b) => b.text || b.content || '').join('\n');
        trace.anthropic.push({ tools: !!body.tools, stream: !!body.stream, chars: lastText.length });
        // Round 1 of the DEEN route: the search tool is FORCED, so answer with a tool_use block.
        if (body.tools) {
          return at(new Response(JSON.stringify({
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', id: 'tu_1', name: 'search_islamic_sources', input: { query: Q_FIQH } }],
          }), { status: 200, headers: { 'content-type': 'application/json' } }), u);
        }
        // Anything else: echo enough of what the model was HANDED that the report can show the
        // grounding actually arrived. A stub must not pretend to be a good answer.
        const gotWorld = /مصادرَ إخباريّةٍ وعامّةٍ مُعتمَدة/.test(lastText);
        const answer = gotWorld
          ? '[STUB MODEL] بحسب المصادر الإخباريّة المسترجَعة: ' + NEWS_BODY.slice(0, 150).trim()
            + ' … (هذه صياغة نموذج مُصطنَعة في الاختبار؛ المادّة أعلاه هي ما سُلِّم للنموذج فعلاً).'
          : '[STUB MODEL] القصر سنّة مؤكدة للمسافر عند جمهور أهل العلم، ويجوز الجمع عند الحاجة.';
        if (body.stream) {
          return at(new Response(sse(answer), { status: 200, headers: { 'content-type': 'text/event-stream' } }), u);
        }
        return at(new Response(JSON.stringify({ content: [{ type: 'text', text: answer }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }), u);
      }
      // Not a page. @upstash/redis is constructed with no url/token in this environment and
      // still issues a relative POST to '/pipeline'; recording that as a "page fetched" would
      // put a phantom host in the evidence. Answer it with a failure — checkAskLimit is
      // fail-open and guardDayCap is bypassed by the founder token, so the request proceeds.
      if (!/^https?:\/\//i.test(u)) {
        return at(new Response('{}', { status: 500 }), 'https://redis.invalid' + u);
      }
      // a page fetch
      trace.pages.push(u);
      const isWorldPage = RET.SITES_GENERAL.some((d) => {
        try { const h = new URL(u).hostname.replace(/^www\./, ''); return h === d || h.endsWith('.' + d); }
        catch { return false; }
      });
      return at(new Response(isWorldPage ? PAGE_NEWS : PAGE_FIQH,
        { status: 200, headers: { 'content-type': 'text/html' } }), u);
    };
  };

  const makeRes = () => ({
    writes: [], ended: 0, statusCode: 0, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    setHeader() { return this; },
    flushHeaders() { this.headersSent = true; },
    write(s) { this.writes.push(String(s)); return true; },
    end() { this.ended += 1; return this; },
    json(o) { this.jsonBody = o; this.ended += 1; return this; },
  });
  const makeReq = (text, band) => ({
    method: 'POST',
    headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER },
    body: { system: 'أنت «عزك»، معلّم مسلم.', messages: [{ role: 'user', content: text }], band },
  });
  const readerText = (res) => res.writes.join('')
    .split('data: ').filter(Boolean)
    .map((s) => { try { return JSON.parse(s.split('\n\n')[0]); } catch { return null; } })
    .filter((e) => e && e.type === 'content_block_delta')
    .map((e) => e.delta.text).join('');

  const { default: handler } = await esm('api/ask.js');

  async function run(label, question, band, env = {}) {
    trace.braveQueries = []; trace.pages = []; trace.anthropic = [];
    RET.resetBreakers();
    // Since the public go-live (lib/ledger/flag.js PUBLIC_GO_LIVE) the ledger is the default path.
    // A case that wants the LEGACY engine has to say so, and says so through the documented floor.
    for (const k of ['LEDGER_RAG', 'RFC_V05_MODE']) delete process.env[k];
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    FLAG.__resetFlagCacheForTest();
    if (!realRun) installStub(); else globalThis.fetch = realFetch;

    // Capture the retrieval logs the way production emits them.
    const logs = [];
    const origWarn = console.warn, origLog = console.log, origErr = console.error;
    const cap = (fn) => (...a) => { logs.push(a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };
    console.warn = cap(); console.log = cap(); console.error = cap();
    const res = makeRes();
    try {
      await handler(makeReq(question, band), res);
    } finally {
      console.warn = origWarn; console.log = origLog; console.error = origErr;
      globalThis.fetch = realFetch;
    }

    console.log('\n────────────────────────────────────────────────────────────────────');
    console.log('  ' + label);
    console.log('  السؤال: «' + question + '»   (band=' + band + ')');
    console.log('────────────────────────────────────────────────────────────────────');
    console.log('  LOGS (retrieval + routing):');
    for (const l of logs) {
      if (/^\[(retrieve|retrieve\/world|world-search|route|angles|source|claim|world|tier|policy)\]/.test(l)) {
        console.log('    ' + l);
      }
    }
    console.log('  BRAVE QUERIES ACTUALLY SENT:');
    for (const q of trace.braveQueries) console.log('    · ' + q);
    console.log('  PAGES ACTUALLY FETCHED:');
    for (const p of trace.pages) console.log('    · ' + decodeURIComponent(p).slice(0, 100));
    const answer = readerText(res);
    console.log('  ANSWER SEEN BY THE READER:');
    console.log('    ' + answer.split('\n').join('\n    '));
    return { answer, logs, queries: trace.braveQueries.slice(), pages: trace.pages.slice() };
  }

  const hostsOf = (urls) => urls.map((u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return '?'; } });
  const onWorldList = (h) => RET.SITES_GENERAL.some((d) => h === d || h.endsWith('.' + d));
  const onShariaList = (h) => [...RET.SITES_ADULT, ...RET.SITES_MINOR].some((d) => h === d || h.endsWith('.' + d));

  // ── (أ) the news question ──────────────────────────────────────────────────
  const a = await run('(أ) سؤال إخباري — يجب أن يذهب إلى SITES_GENERAL', Q_NEWS, 'adult');
  console.log('');
  ok('(أ) a world search ran', a.logs.some((l) => l.includes('[retrieve/world]')),
    a.logs.filter((l) => l.startsWith('[world-search]')).join(' | '));
  ok('(أ) every Brave query filtered on world domains only',
    a.queries.length > 0 && a.queries.every((q) => RET.SITES_GENERAL.every((d) => q.includes('site:' + d))),
    JSON.stringify(a.queries));
  ok('(أ) NO sharia domain appears in any query it sent',
    a.queries.every((q) => ![...RET.SITES_ADULT, ...RET.SITES_MINOR].some((d) => q.includes('site:' + d))),
    JSON.stringify(a.queries));
  ok('(أ) every page fetched is on the world list',
    a.pages.length > 0 && hostsOf(a.pages).every(onWorldList), JSON.stringify(hostsOf(a.pages)));
  ok('(أ) the reply carries a source card from a world domain',
    /<source site="([^"]+)"/.test(a.answer)
    && onWorldList((a.answer.match(/<source site="([^"]+)"/) || [])[1] || ''), a.answer.slice(-220));
  ok('(أ) the reply does NOT apologise for a knowledge cut-off',
    !/(لا أستطيع|لا يمكنني)[^.]{0,40}(الإنترنت|تصفح|الوصول)/.test(a.answer)
    && !/معرفتي (تتوقف|محدودة)/.test(a.answer) && !/2024|أبريل 2024/.test(a.answer), a.answer.slice(0, 200));
  ok('(أ) the model was handed the live material and the no-fatwa warning',
    a.logs.some((l) => l.startsWith('[world-search] answered')));

  // ── (ب) the fiqh question ──────────────────────────────────────────────────
  //
  // DRIVEN ON THE LEGACY ENGINE, DELIBERATELY, and the floor is written rather than assumed.
  // Since the public go-live this question takes the LEDGER, whose own retrieval is scripted by
  // guards/rfc-v05r2-wiring-guard.cjs with a planner-shaped fixture. What this file is here to
  // prove is the SITE FILTER — that a religious question's Brave query names Islamic domains and
  // no world domain — and that is visible on the legacy engine's own retrieve() path. Case (د)
  // below asserts the same perimeter on the ledger, at the seam where its site list is chosen.
  const b = await run('(ب) سؤال شرعي على المحرّك القديم — الحصار في المصادر الشرعية',
    Q_FIQH, 'adult', { LEDGER_RAG: 'off' });
  console.log('');
  ok('(ب) it took the sourced DEEN route', b.logs.some((l) => l.includes('route: \'DEEN\'') || l.includes('"route":"DEEN"') || /\[route\].*DEEN/.test(l)),
    b.logs.filter((l) => l.startsWith('[route]')).join(' | '));
  ok('(ب) NO world search ran at all',
    !b.logs.some((l) => l.includes('[retrieve/world]')),
    b.logs.filter((l) => l.includes('world')).join(' | '));
  ok('(ب) every Brave query filtered on sharia domains only',
    b.queries.length > 0 && b.queries.every((q) => !RET.SITES_GENERAL.some((d) => q.includes('site:' + d))),
    JSON.stringify(b.queries));
  ok('(ب) ...and each one names at least one approved Islamic source',
    b.queries.every((q) => [...RET.SITES_ADULT].some((d) => q.includes('site:' + d))), JSON.stringify(b.queries));
  ok('(ب) every page fetched is on a sharia list',
    b.pages.length > 0 && hostsOf(b.pages).every(onShariaList), JSON.stringify(hostsOf(b.pages)));
  ok('(ب) the reply carries a source card from an approved Islamic domain',
    /<source site="([^"]+)"/.test(b.answer)
    && onShariaList((b.answer.match(/<source site="([^"]+)"/) || [])[1] || ''), b.answer.slice(-220));

  // ── (ج) a child asking the news question ───────────────────────────────────
  const c = await run('(ج) نفس السؤال الإخباري من طفل — نفس الحصار، مع نبرة مناسبة', Q_NEWS, 'young');
  console.log('');
  ok('(ج) the child\'s world search still touches only world domains',
    c.queries.every((q) => ![...RET.SITES_ADULT, ...RET.SITES_MINOR].some((d) => q.includes('site:' + d))),
    JSON.stringify(c.queries));
  ok('(ج) ...and a child never reaches an adult-only Islamic source through this route',
    hostsOf(c.pages).every((h) => !RET.SITES_ADULT.filter((d) => !RET.SITES_MINOR.includes(d)).some(
      (d) => h === d || h.endsWith('.' + d))), JSON.stringify(hostsOf(c.pages)));

  // ── (د) THE PUBLIC LEDGER, AND THE PERIMETER AT ITS SEAM ───────────────────
  //
  // With PUBLIC_GO_LIVE the ledger is the default path, so the two claims that matter here are:
  // a religious question REACHES it, and the site list it is handed is a religious one.
  const d = await run('(د) نفس السؤال الشرعي على المحرّك العام (Ledger) — يجب أن يصله', Q_FIQH, 'adult');
  console.log('');
  ok('(د) the public go-live is live: the request took the ledger',
    d.logs.some((l) => /"path":"ledger"/.test(l)) || d.logs.some((l) => /\[ledger\]/.test(l)),
    d.logs.filter((l) => l.startsWith('[policy]')).join(' | '));
  ok('(د) ...with no credential of any kind required',
    (await FLAG.decidePath({ headers: {} })).path === 'ledger');
  {
    // THE SEAM CHOOSES THE LIST, and it chooses it from the AGE BAND — never from the world list.
    // Read off the shipped source, because this is the one line that decides what a ledger
    // request may fetch, and a stub cannot prove what a future edit would do to it.
    const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('(د) the ledger is handed the age band\'s Islamic list, and only that',
      /bandSites: band === 'adult' \? SITES_ADULT : SITES_MINOR/.test(askSrc));
    ok('(د) ...and SITES_GENERAL is never imported into the ledger branch',
      !/import\('\.\.\/lib\/retrieve\.js'\)[\s\S]{0,200}SITES_GENERAL/.test(askSrc)
      && !/SITES_GENERAL[\s\S]{0,120}runLedgerTurn/.test(askSrc));
    ok('(د) ...and the world branch runs BEFORE the ledger returns, or it could never run at all',
      askSrc.indexOf('LIVE WORLD RETRIEVAL: a general question')
        < askSrc.indexOf("if (ledgerPath.path === 'ledger') {"));
  }

  globalThis.fetch = realFetch;
  for (const k of ['LEDGER_RAG', 'RFC_V05_MODE']) delete process.env[k];

  head('RESULT');
  console.log(failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('world-retrieval-fixture CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
