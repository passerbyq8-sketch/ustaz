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
const exists = (rel) => fs.existsSync(path.join(REPO, rel));

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
      'https://ar.wikipedia.org/wiki/x']
      .every((u) => DB.fetchTimeoutFor(u, DEFAULT_BUDGET) === DEFAULT_BUDGET));
  ok('C2: ...including a URL that will not parse',
    DB.fetchTimeoutFor('not a url', DEFAULT_BUDGET) === DEFAULT_BUDGET);
  ok('C3: exactly TWO hosts have a measured exception, and they are the two that were measured',
    Object.keys(DB.DOMAIN_FETCH_TIMEOUT_MS).length === 2
    && Object.keys(DB.DOMAIN_FETCH_TIMEOUT_MS).sort().join(',') === 'islamstory.com,islamweb.net',
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
    // COMMENTS STRIPPED FIRST, for the reason section A already gives about the user-agent: the
    // claim under test is that no request path READS this label, and a comment reads nothing.
    // MEASURED: this fired on the English prose «NOTHING THAT WORKS TODAY IS DEGRADED» in an
    // api/ask.js comment — a sentence about not degrading behaviour, caught by a check about not
    // reading a table. Code that actually reads it (`DEGRADED[...]`, `isDegraded(...)`) survives
    // the strip untouched, so this is narrower, not weaker.
    ok('C5: ...and no request path reads it',
      !/isDegraded|DEGRADED/.test(stripComments(read('lib/retrieve.js')))
      && !/isDegraded|DEGRADED/.test(stripComments(read('api/ask.js'))),
      'a label that quietly changed behaviour would be a deletion wearing a different word');
  }

  // ── C6: the degraded host was ACTED ON, and the action is a timeout, not a deletion ────
  ok('C6: islamstory fails fast, on the measured number',
    DB.DOMAIN_FETCH_TIMEOUT_MS['islamstory.com'] === DB.ISLAMSTORY_FETCH_TIMEOUT_MS
    && DB.ISLAMSTORY_FETCH_TIMEOUT_MS === 5000, String(DB.ISLAMSTORY_FETCH_TIMEOUT_MS));
  {
    // THE NUMBER FOLLOWS FROM THE SAMPLES, and this is the arithmetic said out loud. It must sit
    // ABOVE the only sample that ever arrived inside the budget, and BELOW the budget it is
    // cutting short — otherwise it is either a deletion in disguise or no change at all.
    const s = DB.DEGRADED['islamstory.com'].samples;
    const insideBudget = s.filter((x) => x < DEFAULT_BUDGET);
    ok('C6: ...above the ONLY sample that ever arrived inside the budget',
      insideBudget.length === 1 && DB.ISLAMSTORY_FETCH_TIMEOUT_MS > Math.max(...insideBudget),
      'samples inside ' + DEFAULT_BUDGET + 'ms: ' + JSON.stringify(insideBudget));
    ok('C6: ...and below the shared budget it is cutting short',
      DB.ISLAMSTORY_FETCH_TIMEOUT_MS < DEFAULT_BUDGET,
      'a timeout at or above the default would change nothing at all');
    ok('C6: ...and the window it gives up is measured EMPTY — no sample ever landed in it',
      s.every((x) => x < DB.ISLAMSTORY_FETCH_TIMEOUT_MS || x >= DEFAULT_BUDGET),
      'a sample between the new timeout and the default would be an answer this change throws away');
  }
  ok('C6: ...and it is on every list it was on before — a timeout is not a removal',
    (await esm('lib/retrieve.js')).SITES_MINOR.includes('islamstory.com')
    && (await esm('lib/retrieve.js')).SITES_ADULT.includes('islamstory.com'));
  ok('C6: ...and it goes through the SAME lookup every other host does',
    DB.fetchTimeoutFor('https://islamstory.com/ar/artical/1', DEFAULT_BUDGET) === 5000
    && DB.fetchTimeoutFor('https://www.islamstory.com/ar/artical/1', DEFAULT_BUDGET) === 5000);

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== D. D8 — the takhrij limit is declared, not left invisible ===');
  // ══════════════════════════════════════════════════════════════════════════

  const TD = await esm('lib/policy/takhrij-disclosure.js');

  ok('D1: there is still NO primary takhrij corpus, which is why the sentence exists',
    TD.PRIMARY_TAKHRIJ_DOMAINS.length === 0,
    'dorar.net was the only one and it is deferred (403 on every path)');
  ok('D1: ...and the sentence is one fixed string the server owns',
    typeof TD.TAKHRIJ_DISCLOSURE === 'string' && TD.TAKHRIJ_DISCLOSURE.length > 40
    && /دواوين التخريج/.test(TD.TAKHRIJ_DISCLOSURE));
  ok('D1: ...that does not withdraw or apologise for the answer above it',
    !/عذر|لا أستطيع|لا استطيع|آسف|اسف|قد يكون خطأ/.test(TD.TAKHRIJ_DISCLOSURE),
    'the referral-tail rule: a tail that undermines the answer is worse than no tail');

  for (const q of [
    'ما درجة حديث «من صام رمضان إيمانًا واحتسابًا»؟',
    'هل يصح حديث الأعمال بالنيات؟',
    'ما صحة حديث نضر الله امرأً سمع مقالتي؟',
    'من خرّج هذا الحديث؟',
    'ما حكم الحديث سندًا؟',
  ]) {
    ok('D2: a GRADING question is disclosed — «' + q.slice(0, 34) + '…»',
      TD.takhrijDisclosureFor({ question: q }) === TD.TAKHRIJ_DISCLOSURE);
  }
  for (const q of [
    'اشرح حديث إنما الأعمال بالنيات',
    'ما معنى حديث الحياء من الإيمان؟',
    'ما حكم صلاة الوتر؟',
    'كم عدد ركعات صلاة الفجر؟',
    'ما موضوع الدرس اليوم؟',
    'اشتريت جهاز حديث، ما حكم بيعه؟',
  ]) {
    ok('D3: a NON-grading question gets nothing — «' + q.slice(0, 34) + '…»',
      TD.takhrijDisclosureFor({ question: q }) === '',
      JSON.stringify(TD.takhrijDisclosureFor({ question: q })));
  }

  ok('D4: appended once — a draft already carrying it gets no second copy',
    TD.takhrijDisclosureOnce('نص الجواب. ' + TD.TAKHRIJ_DISCLOSURE, TD.TAKHRIJ_DISCLOSURE) === '');
  ok('D4: ...and a draft that already sent the reader to the takhrij books gets none either',
    TD.takhrijDisclosureOnce('راجع كتب التخريج في ذلك.', TD.TAKHRIJ_DISCLOSURE) === '');
  ok('D4: ...but an ordinary draft receives it',
    TD.takhrijDisclosureOnce('نص الجواب.', TD.TAKHRIJ_DISCLOSURE) === TD.TAKHRIJ_DISCLOSURE);

  {
    const ASK = read('api/ask.js');
    ok('D5: the live path composes it into the ONE block every exit appends',
      /const referralBlockFor = \(draft\) => \{[\s\S]{0,260}takhrijDisclosureOnce/.test(ASK),
      'five exits append that block; adding it at five call sites is how "once" rots');
    // The pairing that must not rot: an empty corpus list is the ONLY thing that makes passing
    // [] honest. If a domain is ever added, this fails until the real domains are threaded in.
    ok('D5: ...and sourceDomains:[] is paired with an EMPTY corpus list',
      TD.PRIMARY_TAKHRIJ_DOMAINS.length === 0
        ? /takhrijDisclosureFor\(\{ question: questionText, sourceDomains: \[\] \}\)/.test(ASK)
        : !/sourceDomains: \[\]/.test(ASK),
      'a primary corpus was admitted but api/ask.js still passes no domains — thread the retrieved domains through');
  }
  ok('D6: the takhrij LOCK is untouched — nothing unsourced was ever emitted, and still is not',
    /lockTakhrij/.test(read('lib/ledger/engine.js')) && exists('lib/takhrij-lock.js'),
    'this sentence describes provenance; it does not relax what may be said');

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== E. س٦ — the living world, and the wall between it and the religion ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // NOTHING DROVE classifyWorldIntent() BEFORE THIS. It has decided since 2026-08-05 whether a
  // question goes to a live search, and no gate in the suite called it once — `worldparity`,
  // which the brief names as its proof, guards the QUEST GAME's region map and has never
  // imported this module. So the expansion below is checked here, and so is the wall it must
  // not move: the file's rule 1.

  const WI = await esm('lib/world-intent.js');

  // ── E1: the seven that were MEASURED falling through on 2026-08-07 ─────────
  // Recorded before the change, by running the classifier itself. Each row is the owner's own
  // sample question and the reason it now travels on.
  const NOW_WORLD = [
    ['كم درجة الحرارة اليوم في الكويت؟', 'WEATHER'],
    ['شنو الطقس اليوم؟', 'WEATHER'],
    ['هل تمطر بكرة؟', 'WEATHER'],
    ['كم سعر صرف الدولار مقابل الدينار؟', 'MARKET_PRICE'],
    ['كم سعر الدولار اليوم؟', 'MARKET_PRICE'],
    ['كم سعر برميل النفط؟', 'MARKET_PRICE'],
    ['ما نتائج مباريات أمس؟', 'NEWS_TERM'],
  ];
  for (const [q, reason] of NOW_WORLD) {
    const r = WI.classifyWorldIntent(q);
    ok('E1: measured NONE before, now ' + reason + ' — «' + q.slice(0, 30) + '…»',
      r.world === true && r.reason === reason, JSON.stringify(r));
  }

  // ── E2: what already worked still works, unchanged ────────────────────────
  for (const [q, reason] of [
    ['كم سعر الذهب اليوم؟', 'NEWS_PHRASE'],
    ['من فاز في مباراة الأمس؟', 'NEWS_TERM'],
    ['ما آخر أخبار الاقتصاد؟', 'NEWS_TERM'],
    ['ابحث لي عن نتائج القمة', 'EXPLICIT_SEARCH'],
    ['ماذا حدث في 2026؟', 'RECENT_YEAR'],
  ]) {
    const r = WI.classifyWorldIntent(q);
    ok('E2: the existing trigger is untouched (' + reason + ') — «' + q.slice(0, 28) + '…»',
      r.world === true && r.reason === reason, JSON.stringify(r));
  }

  // ── E3: RULE 1 IS THE WHOLE GUARANTEE, AND IT STILL HOLDS ─────────────────
  // The negative test the brief demands: nothing religious may reach the world path. These are
  // the two proofs the measurement already had, plus the ones the NEW vocabulary could have
  // broken — a price question about the ʿaḍḥiya, the value of zakāt al-fiṭr, and the sale of
  // gold all now contain a PRICE_HEAD and a TRADED_THING, and every one of them must still be
  // refused by rule 1 before the conjunction is ever consulted.
  for (const q of [
    'ما حكم صلاة الوتر؟',
    'ما آخر أخبار المسجد الأقصى؟',
    'كم سعر الأضحية هذي السنة؟',
    'كم قيمة زكاة الفطر؟',
    'ما حكم بيع الذهب بالتقسيط؟',
    'ما نصاب زكاة الفضة؟',
    'كيف أتوضأ؟',
    'كم عدد ركعات صلاة الفجر؟',
  ]) {
    const r = WI.classifyWorldIntent(q);
    ok('E3: religious, and refused on its own account — «' + q.slice(0, 30) + '…»',
      r.world === false && r.reason === 'REFUSED_RELIGIOUS', JSON.stringify(r));
  }
  {
    const RC = await esm('lib/route-classify.js');
    ok('E3: ...and rule 1 is the router\'s OWN predicate, not a second copy of it',
      /import \{ normalizeArabic, stripFormulas, isReligiousText \} from '\.\/route-classify\.js';/
        .test(read('lib/world-intent.js'))
      && typeof RC.isReligiousText === 'function',
      'a guarantee re-implemented locally is a guarantee that drifts');
    ok('E3: ...and it is tested BEFORE every trigger in the file',
      /if \(isReligiousText\(raw\)\) \{[\s\S]{0,140}REFUSED_RELIGIOUS[\s\S]*?hitPhrase\(padded, EXPLICIT_SEARCH\)/
        .test(read('lib/world-intent.js')),
      'rule 1 overrides everything below it — that ordering is the wall');
  }

  // ── E4: THE BIAS IS STILL "DO NOT SEARCH" ─────────────────────────────────
  // The file's stated doctrine is that doubt resolves towards NOT searching, and the new rules
  // are the first ones triggered by a SUBJECT rather than a news word. These are the questions
  // that would fall to the widest plausible reading of them and must not.
  //
  // The first two are the measured collision worth naming: lib/policy/core.js classifies
  // «حرارة» as a health symptom, and a weather rule that fired on a child's fever would take the
  // one topic with its own referral policy onto a news search.
  for (const q of [
    'عندي حرارة وما أدري وش أسوي',
    'ابني درجة حرارته ٣٩ وش أسوي؟',
    'ما عاصمة الكويت؟',
    'بكم اشتريت سيارتك؟',
    'كم سعر البيتزا عندكم؟',
    'ليش الجو يتغير بين الفصول؟',
  ]) {
    const r = WI.classifyWorldIntent(q);
    ok('E4: not a live-world question, and not searched — «' + q.slice(0, 30) + '…»',
      r.world === false, JSON.stringify(r));
  }
  {
    // A CONJUNCTION, PROVEN AS ONE. Either half alone must decide nothing — that is the whole
    // difference between this rule and a keyword blocklist, and it is checkable rather than
    // claimed.
    const headOnly = WI.classifyWorldIntent('كم سعر الحجز في الفندق؟');
    const thingOnly = WI.classifyWorldIntent('صرفت الدينار على أشياء كثيرة');
    ok('E5: a price head with nothing traded decides nothing',
      headOnly.world === false, JSON.stringify(headOnly));
    ok('E5: ...and a traded thing with no price head decides nothing either',
      thingOnly.world === false, JSON.stringify(thingOnly));
    ok('E5: ...but the two together do',
      WI.classifyWorldIntent('كم سعر الدينار مقابل الدولار؟').reason === 'MARKET_PRICE');
  }
  ok('E6: every reason the classifier can return is declared in WORLD_REASONS',
    ['WEATHER', 'MARKET_PRICE'].every((k) => WI.WORLD_REASONS[k] === k),
    JSON.stringify(Object.keys(WI.WORLD_REASONS)));

  // ── E7-E10: س٦٫٤ — THE SHARIA FILTER, AND THE RULING IT MAY NOT PRONOUNCE ─
  const IR = await esm('lib/policy/impermissible-request.js');
  const RC2 = await esm('lib/route-classify.js');

  // E7: the owner's own two samples, which were MEASURED coming back NONE — no refusal, no
  // counsel, straight to the model. This part is a new build, not a widened behaviour.
  for (const [q, kind] of [
    ['ابغى أغنية حلوة', 'music'],
    ['رشح لي فلم', 'film'],
    ['عطني رابط أغاني', 'music'],
    ['ودي أسمع موسيقى', 'music'],
    ['رشح لي مسلسل', 'film'],
    ['ابغى أشوف أفلام إباحية', 'pornography'],
  ]) {
    const r = IR.classifyImpermissibleRequest(q);
    ok('E7: a request for the forbidden is stopped (' + kind + ') — «' + q.slice(0, 26) + '…»',
      r.blocked === true && r.kind === kind, JSON.stringify(r));
  }

  // E8: THE RULING QUESTION KEEPS ITS SOURCED ANSWER. core.js's one rule about regexes, applied:
  // a single keyword may never block a topic. Both halves are checked — the router sends the
  // ruling question to DEEN so it never reaches the filter, AND the filter would decline it
  // anyway. Either alone would be a guarantee resting on the other file not changing.
  const M = (q) => [{ role: 'user', content: q }];
  for (const q of ['ما حكم الأغاني؟', 'ما حكم مشاهدة الأفلام؟', 'ما حكم سماع الموسيقى؟']) {
    ok('E8: the RULING question is DEEN and never reaches the filter — «' + q.slice(0, 26) + '…»',
      RC2.classifyRoute(M(q)) === 'DEEN');
    ok('E8: ...and the filter declines it on its own account too',
      IR.classifyImpermissibleRequest(q).blocked === false,
      JSON.stringify(IR.classifyImpermissibleRequest(q)));
  }
  for (const q of ['ابغى أغنية حلوة', 'رشح لي فلم']) {
    ok('E8: ...while the REQUEST is GEN, which is what puts it in front of the filter',
      RC2.classifyRoute(M(q)) === 'GEN');
  }

  // E9: A CONJUNCTION, AND THE MEASURED COLLISION IT HAD TO SURVIVE.
  // «فلم» is the Kuwaiti spelling of "film" AND the classical «ف» + «لم». The exclusion that
  // separates them was measured INERT on its first cut: it was written with `\b`, which in
  // JavaScript is defined on ASCII word characters and can never match before an Arabic letter,
  // so «أبغى كتابًا فلم أجده في المكتبة» was classified as a request for a film.
  for (const q of ['رشح لي فلم وثائقي', 'ابغى فلم حلو']) {
    ok('E9: «فلم» as a film is caught — «' + q + '»',
      IR.classifyImpermissibleRequest(q).kind === 'film');
  }
  for (const q of [
    'أبغى كتابًا فلم أجده في المكتبة',
    'قرأت الكتاب فلم أجد فيه جواباً',
    'ابغى أروح فلم يتيسر لي',
  ]) {
    ok('E9: ...and «فلم» as negation is not — «' + q.slice(0, 30) + '…»',
      IR.classifyImpermissibleRequest(q).blocked === false,
      JSON.stringify(IR.classifyImpermissibleRequest(q)));
  }
  for (const q of ['رشح لي كتاب', 'ابغى ألعب لعبة', 'رشح لي برنامج علمي', 'ابغى أعرف الطقس']) {
    ok('E9: ...and an ordinary request is untouched — «' + q + '»',
      IR.classifyImpermissibleRequest(q).blocked === false);
  }
  {
    // Either half alone decides nothing — the same proof E5 makes for the price rule.
    const shapeOnly = IR.classifyImpermissibleRequest('رشح لي مطعم زين');
    const objectOnly = IR.classifyImpermissibleRequest('الأفلام منتشرة في هذي الأيام');
    ok('E9: a request shape with nothing forbidden decides nothing',
      shapeOnly.blocked === false, JSON.stringify(shapeOnly));
    ok('E9: ...and the bare word with no request decides nothing either',
      objectOnly.blocked === false, JSON.stringify(objectOnly));
  }

  // ── E10: THE COUNSEL — the owner's tone spec, checked rather than admired ──
  ok('E10: the module is internally conformant to its own doctrine',
    IR.counselProblems().length === 0, JSON.stringify(IR.counselProblems()));
  {
    const RULINGS = ['حرام', 'محرّم', 'لا يجوز', 'يحرم', 'إثم', 'معصية'];
    for (const b of ['young', 'teen', 'adult', 'unknown']) {
      const text = IR.impermissibleCounsel(b);
      // THE LINE THIS MAY NEVER CROSS. A verdict from a regex is a fatwa with no source behind
      // it, which is the one thing this repository is built to prevent.
      ok('E10: it pronounces NO ruling for band ' + b,
        !RULINGS.some((v) => text.includes(v)),
        RULINGS.filter((v) => text.includes(v)).join(','));
      // ...and it is not a wall. age.js treats a bare referral as a DEFECT, not as safety.
      ok('E10: ...and it is not a bare refusal — it offers something instead (' + b + ')',
        /أقدر أدلّك/.test(text) && text.length > 200, String(text.length));
      // It hands the ruling question back as an answerable one, which is the same move
      // buildWorldSearchInstruction() makes when a world answer drifts towards a ruling.
      ok('E10: ...and it returns the ruling to the people who issue it (' + b + ')',
        /ناقلٌ لا مفتٍ/.test(text) && /أهل العلم/.test(text) && /سؤالٌ مستقلٌّ/.test(text));
    }
    ok('E10: a child is left with a person; an adult is not handed a child\'s ending',
      /ماما أو بابا/.test(IR.impermissibleCounsel('young'))
      && /ماما أو بابا/.test(IR.impermissibleCounsel('teen'))
      && !/ماما أو بابا/.test(IR.impermissibleCounsel('adult'))
      && !/ماما أو بابا/.test(IR.impermissibleCounsel('unknown')));
    ok('E10: ...and the tone is built on the template the owner approved, not a new one',
      /WARM_SAFETY_REDIRECT/.test(read('lib/policy/impermissible-request.js')),
      'the brief: «ابنِ على قوالب lib/policy ولا تخترع نبرة جديدة»');
  }

  // ── E11: IT IS WIRED, AND WIRED ABOVE THE LEDGER ──────────────────────────
  {
    const ASK = read('api/ask.js');
    ok('E11: the live path consults the filter on the GEN route',
      /const impermissible = effectiveRoute === 'GEN'\s*\?\s*classifyImpermissibleRequest\(questionText\)/.test(ASK));
    ok('E11: ...and answers with the counsel rather than the model',
      /if \(impermissible\.blocked\) \{[\s\S]{0,400}return emitOnce\(impermissibleCounsel\(audienceBand\)\);/.test(ASK));
    // ── THE ORDERING, AND EVERY BRANCH THAT RETURNS BEFORE IT WOULD BE FATAL ──
    //
    // Three branches below RETURN, and a check that sits under any of them is a check that never
    // runs for the readers it swallows. This is the trap the world block was already moved out of
    // once (below the ledger), and the one the child-benign branch had it in all along.
    const atFilter = ASK.indexOf('const impermissible = effectiveRoute');
    const atSearch = ASK.indexOf('const LIVE_QUANTITY = worldIntent.reason');
    const atChild = ASK.indexOf("if (ageAccess.sourcePolicy === 'GENERAL_CHILD_BENIGN'");
    const atLedger = ASK.indexOf("if (ledgerPath.path === 'ledger') {");
    ok('E11: ...and it sits above the SEARCH — a refusal must not spend a unit of the day first',
      atFilter > 0 && atSearch > 0 && atFilter < atSearch,
      'filter=' + atFilter + ' search=' + atSearch);
    ok('E11: ...above the CHILD-BENIGN branch, which returns and would swallow it for young/teen',
      atChild > 0 && atFilter < atChild, 'filter=' + atFilter + ' child=' + atChild);
    ok('E11: ...and above the LEDGER branch, which returns for every reader',
      atLedger > 0 && atFilter < atLedger && atSearch < atLedger,
      'filter=' + atFilter + ' search=' + atSearch + ' ledger=' + atLedger);
    ok('E11: ...and the world SEARCH is above the child branch too, for the same reason',
      atSearch < atChild, 'search=' + atSearch + ' child=' + atChild);
    ok('E11: ...and it logs the KIND and the band, never the question',
      /IMPERMISSIBLE_REQUEST', \{\s*kind: impermissible\.kind, band: audienceBand/.test(ASK));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== F. س٦٫٢/٦٫٣ — the open search, DRIVEN rather than grepped ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Everything above this line is offline logic. What follows drives the module that talks to
  // the provider, with the network stubbed, and reads the URL that would actually have gone out
  // — because a gate that greps for `safesearch=strict` proves a string exists in a file, which
  // is a different claim from "that is what travels on the wire". Section A makes the same
  // distinction about the user-agent, for the same reason.

  const RTO = await esm('lib/retrieve.js');
  const DB2 = await esm('lib/ledger/daily-budget.js');

  ok('F1: safesearch follows the owner\'s rule — strict for young, teen AND the absent band',
    RTO.safesearchFor('young') === 'strict' && RTO.safesearchFor('teen') === 'strict'
    && RTO.safesearchFor(undefined) === 'strict' && RTO.safesearchFor('adult') === 'moderate',
    JSON.stringify(['young', 'teen', undefined, 'adult'].map((b) => RTO.safesearchFor(b))));
  ok('F1: ...and the ABSENT case falls to the strict side, which is the OPPOSITE of age.js',
    RTO.safesearchFor(undefined) === RTO.safesearchFor('young'),
    'lib/policy/age.js resolves unknown to ADULT; the owner resolved this one the other way');
  {
    // The handler must pass the RAW band, not audienceBand — resolveAudience() collapses
    // "claimed nothing" into `adult`, so passing it would silently give an unidentified reader
    // the ordinary filter. This is the one place in the handler where that distinction bites.
    const AGE = await esm('lib/policy/age.js');
    ok('F1: ...and that distinction is real: resolveAudience() maps an absent claim to adult',
      AGE.resolveAudience({ serverBand: null, clientBand: undefined }).band === 'adult',
      'which is exactly why the raw band is what the handler passes');
    ok('F1: ...so the handler passes the raw `band` to the open search',
      /retrieveOpenWorld\(questionText, \{\s*\n\s*band,/.test(read('api/ask.js')),
      'passing audienceBand here would give an unidentified reader safesearch=moderate');
  }

  // ── F2: what actually goes out on the wire ────────────────────────────────
  {
    const realFetch = globalThis.fetch;
    const realKey = process.env.BRAVE_API_KEY;
    process.env.BRAVE_API_KEY = 'test-brave-key';
    const RESULTS = [
      { title: 'الطقس في الكويت', url: 'https://www.accuweather.com/ar/kw/kuwait-city/1', description: 'درجة الحرارة اليوم <b>44</b> مئوية' },
      { title: 'فتوى', url: 'https://islamqa.info/ar/answers/1', description: 'نص' },
      { title: 'plain http', url: 'http://example.org/a', description: 'نص' },
      { title: 'duplicate', url: 'https://www.accuweather.com/ar/kw/kuwait-city/1', description: 'نص' },
      { title: 'Kuwait weather', url: 'https://timeanddate.com/weather/kuwait', description: '44C now' },
    ];
    let sentUrl = '';
    globalThis.fetch = async (u) => {
      sentUrl = String(u);
      return { ok: true, status: 200, json: async () => ({ web: { results: RESULTS } }) };
    };
    let out;
    try {
      out = await RTO.retrieveOpenWorld('كم درجة الحرارة اليوم في الكويت؟', { band: 'young' });
    } finally {
      globalThis.fetch = realFetch;
      if (realKey === undefined) delete process.env.BRAVE_API_KEY; else process.env.BRAVE_API_KEY = realKey;
    }
    ok('F2: NO `site:` filter is on the wire — this is the open search the owner asked for',
      !/site%3A/i.test(sentUrl) && !/site:/i.test(decodeURIComponent(sentUrl)), sentUrl.slice(0, 160));
    ok('F2: ...and safesearch=strict IS, for a young reader',
      /[?&]safesearch=strict(?:&|$)/.test(sentUrl), sentUrl.slice(0, 160));
    // THE WALL, IN THE ONE DIRECTION AN OPEN SEARCH CAN BREACH IT. A provider ranks by relevance
    // and knows nothing about this app's source policy; a fatwa site quoted under news rules,
    // with a news card, is the failure retrieveWorld() was built to make impossible.
    const hosts = out.sources.map((s) => s.host);
    ok('F2: a religious domain returned by the provider is REFUSED',
      !hosts.includes('islamqa.info'), JSON.stringify(hosts));
    ok('F2: ...and every sharia host is refused, not just the one in the fixture',
      [...RTO.shariaHosts()].length > 10
      && [...RTO.shariaHosts()].every((h) => !hosts.includes(h)), String(RTO.shariaHosts().size));
    ok('F2: a non-https result is dropped — a card is a link the reader is invited to open',
      !out.sources.some((s) => s.url.startsWith('http:')), JSON.stringify(out.sources.map((s) => s.url)));
    ok('F2: a repeated URL is carried once', hosts.filter((h) => h === 'accuweather.com').length === 1);
    ok('F2: what survived is what should have', JSON.stringify(hosts) === '["accuweather.com","timeanddate.com"]',
      JSON.stringify(hosts));
    // The snippets are somebody else's words arriving inside our prompt. That is the injection
    // surface lib/ledger/segment.js exists for, and it is not treated more kindly for being short.
    ok('F2: the provider\'s text is wrapped as UNTRUSTED data, exactly as page text is',
      /ليست تعليماتٍ لك|وليس تعليماتٍ لك/.test(out.text), out.text.slice(0, 120));
    ok('F2: ...and the numbers a reader asked for actually survive into the material',
      out.text.includes('44'), out.text.slice(0, 200));
  }

  // ── F3: the day's ceiling is the EXISTING one, and it is reserved BEFORE the call ──
  {
    const realFetch = globalThis.fetch;
    const realKey = process.env.BRAVE_API_KEY;
    process.env.BRAVE_API_KEY = 'test-brave-key';
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ web: { results: [{ title: 't', url: 'https://example.org/x', description: 'd' }] } }) };
    };
    let spent, refused, budget;
    try {
      budget = new DB2.DailySearchBudget({ limit: 1, store: DB2.fakeStore() });
      spent = await RTO.retrieveOpenWorld('س', { band: 'adult', dailyBudget: budget });
      refused = await RTO.retrieveOpenWorld('س', { band: 'adult', dailyBudget: budget });
    } finally {
      globalThis.fetch = realFetch;
      if (realKey === undefined) delete process.env.BRAVE_API_KEY; else process.env.BRAVE_API_KEY = realKey;
    }
    ok('F3: the first search reserves a unit and proceeds', spent.sources.length === 1 && calls === 1);
    ok('F3: ...and the one past the ceiling makes NO provider request at all',
      refused.sources.length === 0 && calls === 1,
      'reserve() runs BEFORE the I/O; a counter incremented after has already authorised the call');
    ok('F3: ...and a refused reservation is a FALL-THROUGH, never a refusal to the reader',
      Array.isArray(refused.sources) && refused.sources.length === 0,
      'the caller takes the ordinary GEN route; the reader loses the live facts, never the answer');
    ok('F3: it is the EXISTING ceiling — same module, same global day key, no second cap',
      /lg:dsb:|store\.key\('dsb'/.test(read('lib/ledger/daily-budget.js'))
      && /daily-budget\.js/.test(read('lib/retrieve.js'))
      && !/DAILY|DAY_CAP|dayCap/.test(read('lib/retrieve.js').split('retrieveOpenWorld')[1] || ''),
      'the brief: «يستهلك من سقف Brave اليومي القائم — لا سقف جديد»');
  }

  // ── F4: the split between the two world searches ──────────────────────────
  {
    const ASK = read('api/ask.js');
    ok('F4: a LIVE QUANTITY goes straight to the open search',
      /const LIVE_QUANTITY = worldIntent\.reason === 'WEATHER' \|\| worldIntent\.reason === 'MARKET_PRICE';/.test(ASK));
    ok('F4: ...and every other reason keeps the vetted, host-allow-listed retrieval first',
      /if \(!LIVE_QUANTITY\) \{[\s\S]{0,400}retrieveWorld\(questionText\)/.test(ASK),
      'nothing that works today is degraded to snippets');
    ok('F4: ...reaching the open search only when that came back empty',
      /if \(!worldPass\) \{[\s\S]{0,1600}retrieveOpenWorld\(questionText/.test(ASK));
    ok('F4: the answer says WHICH search produced it',
      /open: worldOpen, band: audienceBand/.test(ASK),
      'a routing failure and a retrieval failure looked identical without it');
  }

  // ── F5: the model is BOUND to the results (س٦٫٣) ──────────────────────────
  {
    const ASK = read('api/ask.js');
    ok('F5: the open path gets its own binding clauses, from ONE instruction builder',
      /function buildWorldSearchInstruction\(material, band, \{ open = false \} = \{\}\)/.test(ASK)
      && /buildWorldSearchInstruction\(worldPass\.text, band, \{ open: worldOpen \}\)/.test(ASK),
      'a second copy of this wording is a second copy that drifts');
    ok('F5: the reader is told the number must come FROM the results, or be declared missing',
      /فإن لم يكن الرقمُ المطلوبُ مذكورًا فيها، فقلْ صراحةً/.test(ASK));
    ok('F5: ...and that these are open results, not approved sources',
      /نتائجُ بحثٍ مفتوحٍ من الإنترنت/.test(ASK));
    ok('F5: ...and the snippet may be STALE even when the question is about today',
      /فقد تكونُ النتيجةُ قديمةً وإن كان السؤالُ عن اليوم/.test(ASK),
      'a search result carries no guarantee of being current');
    // Unchanged, and it is the clause that matters most on a path with no religious sources.
    ok('F5: the ban on deriving a ruling from these pages is untouched',
      /يُمنع منعًا باتًّا استنباطُ أو إصدارُ أيِّ حكمٍ شرعيٍّ/.test(ASK));
    ok('F5: ...and the card is still the server\'s, never the model\'s',
      /لا تكتبْ وسمَ <source> ولا أيَّ رابط/.test(ASK)
      && /worldCards = pickVerifiedSources\(worldPass\.sources\)/.test(ASK));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== G. THE WHOLE س٦ PATH, THROUGH THE REAL HANDLER ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ── THE DEFECT THIS SECTION EXISTS FOR, AND IT PREDATES س٦ ────────────────
  // The child-benign branch RETURNS, and its condition is `GENERAL_CHILD_BENIGN && young|teen`.
  // «كم درجة الحرارة اليوم في الكويت؟» classifies as `general_knowledge`, and general_knowledge x
  // young is exactly that cell — so it matched, it returned, and the world block two hundred
  // lines below WAS NEVER REACHED BY ANY CHILD. Since the world path went live on 2026-08-05,
  // every child asking about today's world has been answered from the model's memory, which is
  // the hole that path exists to close; and س٦٫٢'s «safesearch=strict لغير البالغ» would have
  // been unreachable code on the day it was written.
  //
  // Every check below drives api/ask.js's real default export with the network stubbed. Cases B
  // and C are the ones that matter most: they prove the fix did not buy a child's live answer
  // with a child's floor.
  {
    const DC = await esm('lib/daycap.js');
    const STORE = await esm('lib/ledger/redis.js');
    const DEVICE = 'abcdefgh12345678';
    const saved = {
      fetch: globalThis.fetch,
      env: { ...process.env },
    };
    process.env.FOUNDER_SECRET = 'test-secret-for-the-source-honesty-gate';
    process.env.RFC_V05_LEGACY_POLICY = 'on';
    process.env.RFC_V05_MODE = 'internal';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.BRAVE_API_KEY = 'test-brave';
    // The legacy path, switched off the ledger by its documented floor — the same note
    // guards/rfc-v05r2-consistency-guard.cjs carries.
    process.env.LEDGER_RAG = 'off';
    // A COUNTER THAT ANSWERS. The open search reserves a unit before it searches, and a store
    // that never answers would fail the reservation closed — which would make every case below
    // pass for the wrong reason, by never searching at all.
    let counter = 0;
    STORE.__setRedisForTest({ eval: async () => { counter += 1; return [counter, counter <= 50 ? 1 : 0]; } });

    const RESULTS = [
      { title: 'الطقس في مدينة الكويت', url: 'https://www.accuweather.com/ar/kw/kuwait-city/1', description: 'درجة الحرارة اليوم 44 مئوية' },
      { title: 'Kuwait City weather', url: 'https://timeanddate.com/weather/kuwait', description: '44C now' },
    ];
    const founder = DC.founderTokenFor(DEVICE);
    const makeRes = () => ({
      writes: [], ended: 0,
      status() { return this; }, setHeader() { return this; }, flushHeaders() {},
      write(s) { this.writes.push(String(s)); return true; }, end() { this.ended += 1; return this; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
    });
    const readerText = (res) => res.writes.join('')
      .split('data: ').filter(Boolean)
      .map((s) => { try { return JSON.parse(s.trim()); } catch { return null; } })
      .filter((p) => p && p.type === 'content_block_delta')
      .map((p) => p.delta.text).join('');

    const drive = async (question, band, opts = {}) => {
      const braveReturns = opts.braveReturns || RESULTS;
      const draft = opts.draft || 'درجة الحرارة اليوم في الكويت 44 مئوية بحسب ما ظهر في النتائج.';
      const state = { brave: [], anthropic: 0, prompts: [], logs: [] };
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.search.brave.com')) {
          state.brave.push(u);
          return { ok: true, status: 200, json: async () => ({ web: { results: braveReturns } }) };
        }
        if (u.includes('api.anthropic.com')) {
          state.anthropic += 1;
          const b = JSON.parse(init.body);
          const last = b.messages[b.messages.length - 1];
          state.prompts.push(typeof last.content === 'string' ? last.content : '');
          return {
            ok: true, status: 200,
            headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
            json: async () => ({ content: [{ type: 'text', text: draft }], stop_reason: 'end_turn' }),
            text: async () => '',
          };
        }
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
      };
      const res = makeRes();
      // The handler's own stamps are the evidence for what it DID, so they are captured rather
      // than the source re-read. `[policy] AGE_FLOOR … path: 'world'` is emitted only by the
      // world branch's floor, and nothing else in the file writes it.
      const realLog = console.log;
      console.log = (...a) => {
        try { state.logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); }
        catch { /* a value that will not serialise is not evidence we need */ }
      };
      try {
        await (await esm('api/ask.js')).default({
          method: 'POST',
          headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' },
          body: { band, messages: [{ role: 'user', content: question }] },
        }, res);
      } finally { console.log = realLog; }
      return { text: readerText(res), state };
    };

    try {
      // ── A: THE CASE THAT WAS BROKEN ────────────────────────────────────────
      const a = await drive('كم درجة الحرارة اليوم في الكويت؟', 'young');
      ok('G1: a YOUNG reader\'s weather question now reaches the open search at all',
        a.state.brave.length === 1, 'brave calls: ' + a.state.brave.length);
      ok('G1: ...with safesearch=strict actually on the wire for a child',
        /[?&]safesearch=strict(?:&|$)/.test(a.state.brave[0] || ''), (a.state.brave[0] || '').slice(0, 140));
      ok('G1: ...and no `site:` filter', !/site%3A/i.test(a.state.brave[0] || ''));
      ok('G1: ...the model is told it is holding open results',
        a.state.prompts.some((p) => /نتائجُ بحثٍ مفتوحٍ من الإنترنت/.test(p)));
      ok('G1: ...the child gets the simple-language clause too',
        a.state.prompts.some((p) => /المخاطَبُ صغيرٌ أو يافع/.test(p)));
      ok('G1: ...and the answer carries the server\'s source card',
        /<source site="accuweather\.com"/.test(a.text), a.text.slice(0, 160));
      // THE FLOOR FOLLOWED THE CHILD. The benign branch is skipped when material is in hand, and
      // that branch was where ageRepair() lived, so this is the check that the fix did not trade
      // one hole for a worse one.
      const floorStamp = (r) => r.state.logs.filter((l) => l.includes('AGE_FLOOR'));
      ok('G1: ...and the CHILD FLOOR actually RAN on the world draft',
        floorStamp(a).some((l) => /"path":"world"/.test(l) && /"ageFloorOutcome"/.test(l)),
        JSON.stringify(floorStamp(a)));

      // ── B: THE NO-REGRESSION CASE THE GATE `!worldPass` EXISTS FOR ─────────
      const b = await drive('كم درجة الحرارة اليوم في الكويت؟', 'young', { braveReturns: [] });
      ok('G2: when the search yields NOTHING, the child falls back to the benign branch',
        b.state.anthropic === 1 && !/<source /.test(b.text)
        && !b.state.prompts.some((p) => /نتائجُ بحثٍ مفتوحٍ من الإنترنت/.test(p)),
        JSON.stringify({ anthropic: b.state.anthropic, card: /<source /.test(b.text) }));
      ok('G2: ...and its floor still ran, from the benign branch rather than the world one',
        floorStamp(b).length === 1 && !/"path":"world"/.test(floorStamp(b)[0]),
        JSON.stringify(floorStamp(b)));
      ok('G2: ...which is why the gate is `!worldPass` and NOT `!worldIntent.world`',
        /if \(ageAccess\.sourcePolicy === 'GENERAL_CHILD_BENIGN'\s*\n\s*&& !worldPass/.test(read('api/ask.js')),
        'gating on the INTENT would drop a child onto the unfloored general route on every failed search');

      // ── C: THE ORDINARY CHILD QUESTION IS UNTOUCHED ────────────────────────
      const c = await drive('كيف أرتب غرفتي؟', 'young', { draft: 'رتب غرفتك مع ماما خطوة خطوة.' });
      ok('G3: an ordinary benign child question searches nothing and keeps its own branch',
        c.state.brave.length === 0 && c.state.anthropic === 1,
        JSON.stringify({ brave: c.state.brave.length, anthropic: c.state.anthropic }));

      // ── D: THE SHARIA FILTER, FOR THE BAND IT COULD NOT REACH BEFORE ───────
      const d = await drive('ابغى أغنية حلوة', 'young');
      ok('G4: a YOUNG reader asking for a song gets the counsel',
        /ناقلٌ لا مفتٍ/.test(d.text) && /أقدر أدلّك/.test(d.text), d.text.slice(0, 120));
      ok('G4: ...and it is the CHILD ending, with a person in it',
        /ماما أو بابا/.test(d.text));
      ok('G4: ...costing NO search and NO model call — a refusal must not spend the day\'s budget',
        d.state.brave.length === 0 && d.state.anthropic === 0,
        JSON.stringify({ brave: d.state.brave.length, anthropic: d.state.anthropic }));

      // ── E/F: the adult, both ways ──────────────────────────────────────────
      const e = await drive('كم سعر الدولار اليوم؟', 'adult');
      ok('G5: an ADULT price question searches, with the ordinary filter',
        e.state.brave.length === 1 && /[?&]safesearch=moderate(?:&|$)/.test(e.state.brave[0]),
        (e.state.brave[0] || '').slice(0, 140));
      ok('G5: ...and gets a card', /<source site="/.test(e.text));
      ok('G5: ...and NOT the child\'s simple-language clause',
        !e.state.prompts.some((p) => /المخاطَبُ صغيرٌ أو يافع/.test(p)));
      const f = await drive('رشح لي فلم', 'adult');
      ok('G6: an ADULT asking for a film gets the counsel, with the adult ending',
        /ناقلٌ لا مفتٍ/.test(f.text) && !/ماما أو بابا/.test(f.text), f.text.slice(0, 120));
      ok('G6: ...and spends nothing either',
        f.state.brave.length === 0 && f.state.anthropic === 0);
    } finally {
      globalThis.fetch = saved.fetch;
      STORE.__resetRedis();
      for (const k of ['FOUNDER_SECRET', 'RFC_V05_LEGACY_POLICY', 'RFC_V05_MODE',
        'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LEDGER_RAG']) {
        if (saved.env[k] === undefined) delete process.env[k]; else process.env[k] = saved.env[k];
      }
    }
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
