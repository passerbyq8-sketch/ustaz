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
    const r = detectSoftNotFound({
      requestedUrl: 'https://example.org/a/b', finalUrl: 'https://example.org/a/b',
      title: 'شيء ما', text: 'قليل',
    });
    ok('B3: HTTP 200 with no document at all is caught',
      r.soft === true && r.signal === 'empty-body', JSON.stringify(r));
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

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
