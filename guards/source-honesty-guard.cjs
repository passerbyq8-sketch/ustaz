// guards/source-honesty-guard.cjs — WHO DO WE SAY WE ARE, AND DO WE BELIEVE WHAT WE ARE TOLD?
//
// Two things this repository got wrong about other people's servers, and both were invisible
// because every gate here is offline and offline gates check lists against lists.
//
//   D6أ  FOUR different answers to "who is asking?", two of them a flat claim to be desktop
//        Chrome on Windows. A site's operator sets robots rules and rate limits on the basis of
//        who they are told is calling; a false name takes that decision away from them.
//
//   D6أ  The liveness tool classified on the HTTP STATUS ALONE, so al-badr.net's dead probe URL
//        — which answers HTTP 200 and serves the site's own «404» page — was recorded as
//        `live-cites`. Coverage that does not exist, in a file that drives a gate.
//
// The user-agent half is DRIVEN, not grepped: the guard stubs the network and reads the header
// the code actually sends. A gate that greps for a constant proves the constant exists, which
// is a different claim from "that is what goes out on the wire".
//
// Usage: node guards/source-honesty-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// Anything that claims to be a browser. `Mozilla/` is the token an operator's filter greps for,
// which is why the old "honest" string in safe-fetch.js — Mozilla/5.0 (compatible; EzikBot…) —
// counted as a false name despite carrying the true one in its parenthesis.
const BROWSER_TOKEN = /Mozilla\/|AppleWebKit|Chrome\/|Safari\/|Gecko\)/;

// Comments are stripped before scanning. The claim being tested is "no browser-impersonating
// string is SENT", and a comment cannot be sent — while the comments that RECORD what the old
// strings were are exactly the history a reader needs to keep. Naming the thing you removed is
// not the same as still doing it.
const stripComments = (s) => String(s)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

(async function main() {
  console.log('=== source-honesty-guard — one true name, and a 404 we can actually see ===');

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== A. D6أ — one honest agent, in every path ===');
  // ══════════════════════════════════════════════════════════════════════════

  const UA = await esm('lib/user-agent.js');
  ok('A1: the one name is exactly the declared one',
    UA.EZIK_USER_AGENT === 'EzikBot/1.0 (+https://ezik.app)', String(UA.EZIK_USER_AGENT));
  ok('A1: ...and it carries no browser token at all',
    !BROWSER_TOKEN.test(UA.EZIK_USER_AGENT), String(UA.EZIK_USER_AGENT));

  const FETCHERS = [
    'lib/retrieve.js',
    'lib/ledger/safe-fetch.js',
    'lib/binothaimeen.js',
    'tools/source-live-smoke.cjs',
  ];
  for (const f of FETCHERS) {
    const src = stripComments(read(f));
    ok('A2: no browser impersonation left in ' + f, !BROWSER_TOKEN.test(src),
      (src.match(BROWSER_TOKEN) || [''])[0]);
  }
  for (const f of FETCHERS) {
    ok('A3: ' + f + ' reads the shared constant rather than a literal',
      /user-agent\.js/.test(read(f)));
  }

  // ── DRIVEN: what actually goes out on the wire ────────────────────────────
  {
    const RT = await esm('lib/retrieve.js');
    const realFetch = globalThis.fetch;
    let sentUA = null;
    globalThis.fetch = async (url, init) => {
      sentUA = init && init.headers ? init.headers['User-Agent'] : null;
      return {
        ok: true, status: 200, url: String(url),
        text: async () => '<html><head><title>t</title></head><body><p>' + 'ا'.repeat(600) + '</p></body></html>',
      };
    };
    try {
      RT.resetBreakers();
      await RT.fetchAndClean('https://islamqa.info/ar/answers/13337', 5000);
    } finally { globalThis.fetch = realFetch; }
    ok('A4: fetchAndClean() SENDS the honest name', sentUA === UA.EZIK_USER_AGENT, String(sentUA));
    ok('A4: ...and sends no browser token', !BROWSER_TOKEN.test(String(sentUA)), String(sentUA));
  }
  {
    // safe-fetch resolves DNS and checks addresses before it opens anything, so this drives the
    // header set it declares rather than the socket. The constant is the same object either way.
    const SF = read('lib/ledger/safe-fetch.js');
    ok('A4: safe-fetch\'s header set is built from the constant',
      /'User-Agent': EZIK_USER_AGENT,/.test(SF));
  }
  // The name changed and NOTHING else did. Each clause is checked where the thing actually
  // lives: the robots-derived path refusals are in the page gates, not in the fetcher.
  ok('A5: the robots-derived path refusals are untouched',
    /robots\.txt/i.test(read('lib/source-page-gates.js')));
  ok('A5: ...the SSRF address checks are untouched',
    /checkHostAddresses/.test(read('lib/ledger/safe-fetch.js'))
    && /isIP/.test(read('lib/ledger/safe-fetch.js')));
  ok('A5: ...the one-at-a-time pacing between other people\'s servers is untouched',
    /GAP_MS/.test(read('tools/source-liveness.cjs')) && /MIN_GAP_MS/.test(read('lib/binothaimeen.js')));
  ok('A5: ...and the promise not to evade a refusal still stands, in words and in code',
    /does not evade Cloudflare/.test(read('lib/ledger/safe-fetch.js'))
    && /it does not rotate/.test(read('lib/ledger/safe-fetch.js')));

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== B. D6أ — a soft 404 is seen by its CONTENT, not its status ===');
  // ══════════════════════════════════════════════════════════════════════════

  const { detectSoftNotFound } = require(path.join(REPO, 'tools', 'soft-404.cjs'));

  // THE MEASURED PAIR. Both pages are HTTP 200 from al-badr.net, and both extract the SAME 1085
  // characters byte for byte — the site-wide hadith band. Length cannot separate them, and any
  // detector resting on length would have missed the very case it was written for. The TITLE is
  // the whole difference, which is why the detector reads content.
  const BAND = 'قال صلى الله عليه وسلم: «كُلُّ الْمُسْلِمِ عَلَى الْمُسْلِمِ حَرَامٌ دَمُهُ وَمَالُهُ وَعِرْضُهُ ». رواه مسلم.'.padEnd(1085, ' ');
  {
    const dead = detectSoftNotFound({
      requestedUrl: 'https://al-badr.net/muqolat/5051',
      finalUrl: 'https://al-badr.net/muqolat/5051',
      title: '404',
      text: BAND,
    });
    ok('B1: al-badr\'s MEASURED dead URL is caught (HTTP 200, 1085 chars, title "404")',
      dead.soft === true && dead.signal === 'not-found-title', JSON.stringify(dead));
  }
  {
    const live = detectSoftNotFound({
      requestedUrl: 'https://al-badr.net/detail/3Tshr80AJpHG',
      finalUrl: 'https://al-badr.net/detail/3Tshr80AJpHG',
      title: 'فضل يوم عاشوراء 09-01-1448',
      text: BAND,
    });
    ok('B1: ...and its MEASURED live URL is NOT — same status, same 1085 chars, real title',
      live.soft === false, JSON.stringify(live));
  }
  {
    const r = detectSoftNotFound({
      requestedUrl: 'https://example.org/articles/5001',
      finalUrl: 'https://example.org/',
      title: 'الصفحة الرئيسية',
      text: 'x'.repeat(900),
    });
    ok('B2: a deep path answered by the site root is caught',
      r.soft === true && r.signal === 'redirect-to-root', JSON.stringify(r));
  }
  {
    // shkhudheir.com's MEASURED probe: 0 extracted from 114 raw. There is no document.
    const r = detectSoftNotFound({
      requestedUrl: 'https://shkhudheir.com/', finalUrl: 'https://shkhudheir.com/',
      title: '', text: '', rawLen: 114,
    });
    ok('B3: HTTP 200 with no document at all is caught (measured: 0 chars from 114 raw)',
      r.soft === true && r.signal === 'empty-body', JSON.stringify(r));
  }
  {
    // tafsir.app's MEASURED probe: 0 extracted from 150,461 raw — a client-rendered app. THE
    // PAGE IS THERE and our extractor cannot read it, which is a fact about the adapter, not
    // about the URL. Calling this `probe-stale` (as the first cut of this detector did) sends
    // somebody hunting for a replacement link that does not exist.
    const r = detectSoftNotFound({
      requestedUrl: 'https://tafsir.app/tabari/94/5', finalUrl: 'https://tafsir.app/tabari/94/5',
      title: '', text: '', rawLen: 150461,
    });
    ok('B3: ...but a client-rendered SHELL is NOT a missing page',
      r.soft === false, JSON.stringify(r));
  }
  {
    const r = detectSoftNotFound({
      requestedUrl: 'https://islamqa.info/ar/answers/13337',
      finalUrl: 'https://islamqa.info/ar/answers/13337',
      title: 'حكم صلاة الجماعة', text: 'ن'.repeat(1400),
    });
    ok('B4: an ordinary article is left alone', r.soft === false, JSON.stringify(r));
  }
  {
    // The false positive worth naming: an article whose SUBJECT is the number. The detector
    // reads titles rather than bodies precisely so this survives.
    const r = detectSoftNotFound({
      requestedUrl: 'https://example.org/a/b', finalUrl: 'https://example.org/a/b',
      title: 'حكم البيع بالتقسيط',
      text: ('الصفحة غير موجودة هي رسالة خطأ شائعة في المواقع. ' + 'ن'.repeat(1400)),
    });
    ok('B4: ...even when its BODY happens to contain the words of an error page',
      r.soft === false, JSON.stringify(r));
  }

  // ── the tool wires it, and the probe URL was replaced ──────────────────────
  const TOOL = read('tools/source-liveness.cjs');
  ok('B5: the liveness tool consults the detector, and shares ONE implementation with this gate',
    /require\('\.\/soft-404\.cjs'\)/.test(TOOL) && /detectSoftNotFound\(\{/.test(TOOL));
  ok('B5: ...and no longer decides on the HTTP status alone',
    /soft\.soft\b[\s\S]{0,80}status = 'probe-stale'/.test(TOOL));
  ok('B6: al-badr\'s dead probe URL is gone from the tool',
    TOOL.indexOf('al-badr.net/muqolat/5051') === -1
    && /'al-badr\.net': 'https:\/\/al-badr\.net\/detail\//.test(TOOL));
  ok('B7: a host whose every page extracts the same bytes is caught by a SECOND article',
    /const PROBE_ALT = \{/.test(TOOL) && /altText === text/.test(TOOL)
    && /status = 'live-no-citation';\s*\/\/ two different articles/.test(TOOL),
    'one probe reported al-badr live-cites on 1085 chars of site furniture');
  ok('B8: a single transport failure does not condemn a source',
    /transport \(twice\)/.test(TOOL) && /res = await RT\.fetchAndClean\(url, TIMEOUT_MS\);[\s\S]{0,200}retried after transport failure/.test(TOOL),
    'ferkous.app was recorded dead on a TypeError that arrived in 6ms and answered 200 on the next request');
  ok('B8: ...and every row now records how long the host took',
    /const ms = Date\.now\(\) - t0;/.test(TOOL) && /textLen: text\.length, ms,/.test(TOOL),
    'D7 needs a number, and nobody had ever recorded one');

  // ── the written evidence agrees with what was measured ────────────────────
  {
    const doc = JSON.parse(read('data/source-liveness.json'));
    const row = (d) => doc.domains.find((r) => r.domain === d) || {};
    ok('B9: al-badr.net is recorded as what it actually is',
      row('al-badr.net').status === 'live-no-citation', JSON.stringify(row('al-badr.net').status));
    ok('B9: ...tafsir.app is recorded as unreadable, not as missing',
      row('tafsir.app').status === 'live-no-citation', JSON.stringify(row('tafsir.app').status));
    ok('B9: ...ferkous.app is not recorded dead on a blink',
      row('ferkous.app').status === 'live-cites', JSON.stringify(row('ferkous.app').status));
    ok('B9: ...and every probed row carries a response time',
      doc.domains.filter((r) => r.url).every((r) => Number.isFinite(r.ms)),
      doc.domains.filter((r) => r.url && !Number.isFinite(r.ms)).map((r) => r.domain).join(','));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== C. D7 — a per-host budget, and only where it was measured ===');
  // ══════════════════════════════════════════════════════════════════════════

  const DB = await esm('lib/domain-budget.js');
  const DEFAULT_BUDGET = 8000;

  ok('C1: islamweb has its own timeout, and it is the measured constant',
    DB.DOMAIN_FETCH_TIMEOUT_MS['islamweb.net'] === DB.ISLAMWEB_FETCH_TIMEOUT_MS
    && DB.ISLAMWEB_FETCH_TIMEOUT_MS === 3000, String(DB.ISLAMWEB_FETCH_TIMEOUT_MS));
  ok('C1: ...comfortably above the worst sample and comfortably below the shared budget',
    DB.ISLAMWEB_FETCH_TIMEOUT_MS > 1125 * 2 && DB.ISLAMWEB_FETCH_TIMEOUT_MS < DEFAULT_BUDGET,
    'worst observed 1125ms, shared budget ' + DEFAULT_BUDGET + 'ms');
  ok('C2: it applies to that host, www or apex',
    DB.fetchTimeoutFor('https://www.islamweb.net/ar/fatwa/2523/', DEFAULT_BUDGET) === 3000
    && DB.fetchTimeoutFor('https://islamweb.net/ar/fatwa/2523/', DEFAULT_BUDGET) === 3000);
  ok('C2: ...and EVERY other host keeps the shared budget, unchanged',
    ['https://islamqa.info/ar/answers/1', 'https://binbaz.org.sa/fatwas/1',
      'https://ar.wikipedia.org/wiki/x', 'https://islamstory.com/ar/artical/1']
      .every((u) => DB.fetchTimeoutFor(u, DEFAULT_BUDGET) === DEFAULT_BUDGET));
  ok('C2: ...including a URL that will not parse',
    DB.fetchTimeoutFor('not a url', DEFAULT_BUDGET) === DEFAULT_BUDGET);
  ok('C3: exactly ONE host has a measured exception',
    Object.keys(DB.DOMAIN_FETCH_TIMEOUT_MS).length === 1,
    Object.keys(DB.DOMAIN_FETCH_TIMEOUT_MS).join(','));
  ok('C4: the live path consults it rather than the bare default',
    /fetchAndClean\(r\.link, fetchTimeoutFor\(r\.link, perFetchTimeoutMs\)\)/.test(read('lib/retrieve.js')));

  // The degraded label: recorded, and PROVABLY inert.
  ok('C5: islamstory is labelled degraded, with its samples and its budget',
    DB.isDegraded('islamstory.com')
    && DB.DEGRADED['islamstory.com'].budgetMs === DEFAULT_BUDGET
    && DB.DEGRADED['islamstory.com'].samples.some((s) => s > DEFAULT_BUDGET));
  ok('C5: ...and the label records what was NOT established',
    /NOT ESTABLISHED/.test(DB.DEGRADED['islamstory.com'].caveat || ''),
    'a throttled host and a slow host look identical from outside');
  {
    // "وسم degraded فقط — لا حذف من أي قائمة". Proven, not promised.
    const RT2 = await esm('lib/retrieve.js');
    ok('C5: ...and it is REMOVED FROM NO LIST',
      RT2.SITES_MINOR.includes('islamstory.com') && RT2.SITES_ADULT.includes('islamstory.com'),
      'degraded is a label for the owner to decide against, never a filter');
    ok('C5: ...and no request path reads it',
      !/isDegraded|DEGRADED/.test(read('lib/retrieve.js')) && !/isDegraded|DEGRADED/.test(read('api/ask.js')),
      'a label that quietly changed behaviour would be a deletion wearing a different word');
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
