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
    ok('C5: ...and no request path reads it',
      !/isDegraded|DEGRADED/.test(read('lib/retrieve.js')) && !/isDegraded|DEGRADED/.test(read('api/ask.js')),
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

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
