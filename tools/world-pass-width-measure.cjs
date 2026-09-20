// tools/world-pass-width-measure.cjs — WHY DOES THE VETTED WORLD PASS RETURN ONE SOURCE?
//
// ── THE QUESTION (ج-٣/٢) ────────────────────────────────────────────────────
// On the owner's «أهمُّ الأخبار» turn the trace read `[free-brain/live] { sources: 1, open: false
// }` — the vetted pass returned a single page and, because a single page is more than none, the
// open fallback never ran. The answer the reader then read cited `akher.news`, `youm7.com` and
// `tunisie-telegraph.com`, which came from OTHER rounds' calls. The order asks WHY the one, and
// asks it to be measured rather than reasoned about.
//
// ── WHAT IS STUBBED AND WHAT IS REAL ────────────────────────────────────────
// The provider and every page fetch are stubs, and they are DELIBERATELY PERFECT: Brave returns
// eight results spread across all four admitted world hosts, and every page comes back as a long,
// clean, well-formed Arabic article that clears every gate this repository has. Nothing about
// the network, the hosts, Cloudflare or the breaker can be the answer here, because none of them
// is present. What is real is lib/retrieve.js — the planner, the wave loop, the per-page gates,
// the match rule and the early stop.
//
// If a PERFECT search over PERFECT pages still returns one source, the number is a property of
// our own code and not of the news desks, and that is a different finding with a different owner.
//
//   node tools/world-pass-width-measure.cjs
//
'use strict';

const path = require('path');

const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

const QUESTION = 'ما أهم أخبار العالم اليوم';

// Eight candidates, two on each admitted host, each on its own path so nothing is de-duplicated.
const HOSTS = ['aljazeera.net', 'bbc.com', 'skynewsarabia.com', 'ar.wikipedia.org'];
const CANDIDATES = [];
for (let i = 0; i < 2; i += 1) {
  for (const host of HOSTS) {
    CANDIDATES.push({
      title: 'تقرير إخباري عن أهم أحداث العالم — ' + host + ' — ' + (i + 1),
      url: 'https://' + host + '/news/2026/09/20/world-report-' + (i + 1),
      description: 'ملخص لأهم أخبار العالم اليوم من ' + host + '.',
    });
  }
}

// A page that answers the question at length: the match rule scores coverage of the sent query's
// terms, and a page that says nothing the question asked about is refused for the right reason.
const BODY = [
  'أهم أخبار العالم اليوم',
  'نستعرض في هذا التقرير أهم أخبار العالم اليوم، وما جرى من أحداث في مختلف المناطق.',
  'وتصدرت أخبار العالم اليوم عناوين الصحف، وتناولت التقارير أهم الأحداث الجارية.',
].join(' ');
const ARTICLE_HTML = '<!doctype html><html lang="ar"><head><meta charset="utf-8">'
  + '<title>أهم أخبار العالم اليوم</title></head><body><article>'
  + ('<p>' + BODY + '</p>').repeat(24)
  + '</article></body></html>';

function installStub(state) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.search.brave.com')) {
      state.searchCalls += 1;
      return {
        ok: true, status: 200,
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ web: { results: CANDIDATES } }),
        text: async () => '',
      };
    }
    state.pageFetches.push(u);
    return {
      ok: true, status: 200, url: u, redirected: false,
      headers: {
        get: (h) => {
          const k = String(h).toLowerCase();
          if (k === 'content-type') return 'text/html; charset=utf-8';
          if (k === 'content-length') return String(Buffer.byteLength(ARTICLE_HTML));
          return null;
        },
      },
      text: async () => ARTICLE_HTML,
      arrayBuffer: async () => Buffer.from(ARTICLE_HTML, 'utf8'),
      body: null,
    };
  };
  return () => { globalThis.fetch = real; };
}

(async function main() {
  console.log('=== world-pass-width-measure — how wide can the vetted world pass be? ===');

  // The flag's NAME comes from the module that owns it rather than being spelt a second time
  // here — lib/live-world-v2.js exports it for exactly this, and
  // guards/live-world-v2-killswitch-guard.cjs counts the files that spell it.
  const { LIVE_WORLD_V2_FLAG } = await esm('lib/live-world-v2.js');
  const prev = { BRAVE_API_KEY: process.env.BRAVE_API_KEY };
  prev[LIVE_WORLD_V2_FLAG] = process.env[LIVE_WORLD_V2_FLAG];
  process.env.BRAVE_API_KEY = 'probe-brave-not-a-credential';
  process.env[LIVE_WORLD_V2_FLAG] = 'on';

  const state = { searchCalls: 0, pageFetches: [] };
  const restore = installStub(state);
  // Always grants: the daily cap is not the subject and a refusal here would measure the cap.
  const dailyBudget = { reserve: async () => ({ ok: true }) };

  try {
    const R = await esm('lib/retrieve.js');
    console.log('\n  admitted world hosts: ' + R.SITES_GENERAL.join(', '));
    console.log('  provider returns:     ' + CANDIDATES.length + ' candidates, ' + HOSTS.length + ' distinct hosts');
    console.log('  every page fetch:     HTTP 200, ' + ARTICLE_HTML.length + ' bytes of clean Arabic article');

    const world = await R.retrieveWorld(QUESTION, { dailyBudget });
    console.log('\n  retrieveWorld()');
    console.log('    sources returned  = ' + (world.sources || []).length);
    console.log('    hosts             = ' + (world.sources || []).map((s) => {
      try { return new URL(s.url).hostname; } catch { return '?'; }
    }).join(', '));
    console.log('    pages fetched     = ' + state.pageFetches.length);
    console.log('    brave calls       = ' + state.searchCalls);
    console.log('    outcome           = ' + (world.diagnostics && world.diagnostics.outcome));

    const before = state.pageFetches.length;
    state.searchCalls = 0;
    const open = await R.retrieveOpenWorld(QUESTION, { band: 'adult', dailyBudget });
    console.log('\n  retrieveOpenWorld()  (the fallback, for the contrast)');
    console.log('    sources returned  = ' + (open.sources || []).length);
    console.log('    hosts             = ' + (open.sources || []).map((s) => s.host).join(', '));
    console.log('    pages fetched     = ' + (state.pageFetches.length - before) + '  (a snippet pass fetches none)');
    console.log('    brave calls       = ' + state.searchCalls);
  } finally {
    restore();
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
    }
  }
}()).catch((e) => { console.error('MEASURE THREW:', e); process.exit(1); });
