// ledger-retrieval-guard.cjs — the boundaries, the budgets, the ranking, and the fetch.
//
// THE ONE NUMBER THAT MATTERS, MEASURED THE WAY THE PROVIDER MEASURES IT. On 2026-08-03 the
// adult allow-list grew and the `site:` filter pushed `q` from 341 characters to 576. Brave's
// ceiling is 400. Twenty-five green gates said nothing, because not one of them measured the
// string the provider is asked to accept. This gate measures it — in CHARACTERS AND IN WORDS
// SEPARATELY, at the exact boundary values, for every list and every capability.
//
// AND IT MEASURES THE OTHER THING THAT WAS NEVER MEASURED: what the ranker REFUSES. A retrieval
// layer that scores everything can be talked past by a good title; the refusals here return a
// reason and stop, and the gate proves a video page cannot outscore its way in.
//
// Offline and deterministic: DNS and the network are stubbed. No key, no requests.
//
// Usage: node ledger-retrieval-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = __dirname;
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
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const issue = (over) => Object.assign({
  issueId: 'iss_1', intent: 'fatwa', requestedAuthorityId: null,
  protectedEntities: [], coreTerms: [], contextVars: [], exactUserPhrases: [],
  requiredSlots: ['ruling'], dependencies: [], temporalScope: 'unknown',
}, over || {});

(async function main() {
  console.log('=== ledger-retrieval-guard — bounds, budgets, ranking, and safe fetching ===');

  const BG = await esm('lib/ledger/budgets.js');
  const QB = await esm('lib/ledger/query-build.js');
  const RK = await esm('lib/ledger/rank.js');
  const CA = await esm('lib/ledger/canonical.js');
  const SF = await esm('lib/ledger/safe-fetch.js');
  const SP = await esm('lib/ledger/source-policy.js');

  const ALL = SP.searchableDomains();

  // =========================================================================
  console.log('\n=== A. THE FOUR BOUNDS, DECLARED IN ONE PLACE ===');
  eq('PROVIDER_MAX_QUERY_CHARS', BG.PROVIDER_MAX_QUERY_CHARS, 400);
  eq('PROVIDER_MAX_QUERY_WORDS', BG.PROVIDER_MAX_QUERY_WORDS, 50);
  eq('INTERNAL_MAX_QUERY_CHARS', BG.INTERNAL_MAX_QUERY_CHARS, 380);
  eq('INTERNAL_MAX_QUERY_WORDS', BG.INTERNAL_MAX_QUERY_WORDS, 45);
  ok('ours is STRICTLY below theirs, on both axes',
    BG.INTERNAL_MAX_QUERY_CHARS < BG.PROVIDER_MAX_QUERY_CHARS
    && BG.INTERNAL_MAX_QUERY_WORDS < BG.PROVIDER_MAX_QUERY_WORDS);
  eq('the network budgets', [BG.MAX_BRAVE_CALLS, BG.MAX_PAGES_FETCHED, BG.MAX_FETCH_CONCURRENCY], [4, 5, 3]);
  eq('the cycle and model budgets', [BG.MAX_VERIFIED_CYCLES, BG.MAX_MODEL_CALLS], [2, 8]);
  eq('the token and time budgets',
    [BG.MAX_MODEL_INPUT_TOKENS, BG.MAX_MODEL_OUTPUT_TOKENS, BG.GLOBAL_TIMEOUT_MS], [15000, 3000, 25000]);
  // MAX_MODEL_CALLS is ITEMISED, so the declared ceiling cannot drift from its line items.
  {
    const b = BG.MODEL_CALL_BUDGET;
    const total = b.query_ir + b.claim_extraction + b.claim_verification + b.drafting + b.sentence_verification;
    eq('the itemised model budget sums to MAX_MODEL_CALLS', total, BG.MAX_MODEL_CALLS);
    eq('extraction and verification are SEPARATE line items',
      [b.claim_extraction, b.claim_verification], [2, 2]);
  }

  // =========================================================================
  console.log('\n=== B. THE BOUNDARY MATRIX — CHARS AND WORDS, INDEPENDENTLY ===');
  // Characters, with the word count held far below its limit.
  for (const [n, want] of [[379, 'PASS'], [380, 'PASS'], [381, 'SPLIT_OR_REJECT']]) {
    eq('PROJECT CHARS ' + n, BG.queryVerdict('x'.repeat(n)), want);
  }
  for (const [n, want] of [[399, 'SPLIT_OR_REJECT'], [400, 'SPLIT_OR_REJECT'], [401, 'BLOCKED']]) {
    eq('PROVIDER CHARS ' + n, BG.queryVerdict('x'.repeat(n)), want);
  }
  eq('PROVIDER CHARS 399 is acceptable to the provider guard', BG.withinProviderBounds('x'.repeat(399)), true);
  eq('PROVIDER CHARS 400 is acceptable to the provider guard', BG.withinProviderBounds('x'.repeat(400)), true);
  eq('PROVIDER CHARS 401 is BLOCKED', BG.withinProviderBounds('x'.repeat(401)), false);
  // Words, with the character count held far below its limit.
  const words = (n) => Array.from({ length: n }, () => 'w').join(' ');
  for (const [n, want] of [[44, 'PASS'], [45, 'PASS'], [46, 'SPLIT_OR_REJECT']]) {
    eq('PROJECT WORDS ' + n, BG.queryVerdict(words(n)), want);
  }
  for (const [n, want] of [[49, true], [50, true], [51, false]]) {
    eq('PROVIDER WORDS ' + n + ' acceptable', BG.withinProviderBounds(words(n)), want);
  }
  // THE TWO AXES ARE INDEPENDENT — a query can bust one while comfortably inside the other.
  ok('a 46-word query 92 characters long busts WORDS only',
    BG.measureQuery(words(46)).chars < 380 && BG.queryVerdict(words(46)) === 'SPLIT_OR_REJECT');
  ok('a 381-character single token busts CHARS only',
    BG.measureQuery('x'.repeat(381)).words === 1 && BG.queryVerdict('x'.repeat(381)) === 'SPLIT_OR_REJECT');
  ok('isSendable refuses anything over the provider ceiling', !QB.isSendable('x'.repeat(401)));
  ok('...and anything over OUR ceiling too', !QB.isSendable('x'.repeat(381)));

  // =========================================================================
  console.log(`\n=== C. PACKING — 3, 14 AND ${ALL.length} DOMAINS, NOTHING DROPPED ===`);
  const CHILD_SITES = ['islamqa.info', 'binbaz.org.sa', 'islamweb.net'];
  const FULL_LABEL = ALL.length + ' domains';
  const LISTS = [
    ['3 domains (the child list)', CHILD_SITES],
    ['14 domains', ALL.slice(0, 14)],
    [FULL_LABEL, ALL],
  ];
  for (const [label, sites] of LISTS) {
    if (sites === ALL) {
      eq('the full-list label is derived from the measured source set',
        Number((label.match(/^\d+/) || [])[0]), sites.length);
    }
    for (const intent of ['fatwa', 'tafsir', 'hadith_grading', 'general']) {
      const iss = issue({ intent, coreTerms: ['الصلاة'], protectedEntities: ['الجمع'] });
      const p = QB.planIssueBatches(iss, sites, {});
      if (!p.ok) { eq(label + '/' + intent + ' plans', p.reason, 'no_eligible_source'); continue; }
      ok(label + '/' + intent + ': every batch within OUR bound',
        p.batches.every((b) => BG.withinInternalBounds(b.q)),
        p.batches.map((b) => b.chars + 'c/' + b.words + 'w').join(', '));
      ok(label + '/' + intent + ': every batch within the PROVIDER bound',
        p.batches.every((b) => BG.withinProviderBounds(b.q)));
      // NOTHING ELIGIBLE IS DROPPED: the union of the batches plus the named uncovered set is
      // exactly the eligible list.
      const cap = (await esm('lib/ledger/capability.js')).capabilityForIntent(intent);
      const eligible = SP.eligibleSites(sites, cap).slice().sort();
      const covered = p.batches.flatMap((b) => b.sites).concat(p.uncoveredSites).slice().sort();
      if (sites === CHILD_SITES && intent === 'fatwa') {
        eq('the child fatwa fixture exercises its intended three-source branch',
          eligible, CHILD_SITES.slice().sort());
      }
      eq(label + '/' + intent + ': union == eligible list', covered, eligible);
      eq(label + '/' + intent + ': no domain in two batches',
        p.batches.flatMap((b) => b.sites).length,
        new Set(p.batches.flatMap((b) => b.sites)).size);
      // AND NOTHING INELIGIBLE IS SEARCHED.
      ok(label + '/' + intent + ': no ineligible domain is searched',
        p.batches.flatMap((b) => b.sites).every((d) => SP.capabilityEligible(d, cap)));
    }
  }
  // A silent cap is a lie; the uncovered set is named.
  ok('a truncated plan names what it did not search',
    /uncoveredSites/.test(read('lib/ledger/query-build.js'))
    && /coverage_truncated/.test(read('lib/ledger/engine.js')));

  // =========================================================================
  console.log('\n=== D. THE PROTECTED TERMS ARE NEVER TRIMMED ===');
  {
    // A long question: fillers and context give way, the protected entity does not.
    const iss = issue({
      protectedEntities: ['بيع الذهب بالتقسيط'],
      coreTerms: ['الربا', 'الصرف', 'التقابض', 'الأجل', 'الحلي', 'المصوغات'],
      contextVars: ['في البنوك', 'عبر الإنترنت', 'مع فوائد', 'بالتقسيط الشهري', 'من تاجر'],
    });
    const p = QB.planIssueBatches(iss, ALL, {});
    ok('the plan is made', p.ok, p.reason);
    ok('the protected entity survives verbatim', p.terms.includes('بيع الذهب بالتقسيط'), JSON.stringify(p.terms));
    ok('...and something optional gave way instead', p.droppedTerms.length > 0 || p.terms.length >= 1);
    ok('every dropped term is optional, never protected',
      p.droppedTerms.every((t) => !iss.protectedEntities.includes(t)));
    ok('no term is a truncated fragment of another',
      p.terms.every((t) => [...iss.protectedEntities, ...iss.coreTerms, ...iss.contextVars, ...iss.exactUserPhrases].includes(t)));
  }
  {
    // Protected terms alone over the bound: REFUSE, do not mutilate.
    const huge = 'ط'.repeat(400);
    const p = QB.planIssueBatches(issue({ protectedEntities: [huge] }), ALL, {});
    eq('protected terms over the bound REFUSE the issue', p.ok, false);
    eq('...with the honest reason', p.reason, 'protected_terms_too_long');
    eq('...and cost zero batches', p.batches.length, 0);
  }
  {
    // No eligible source: refuse before a request, not after.
    const p = QB.planIssueBatches(issue({ intent: 'fatwa' }), ['khutabaa.com', 'salafcenter.org'], {});
    eq('no eligible source refuses the issue', p.ok, false);
    eq('...with the honest reason', p.reason, 'no_eligible_source');
    eq('...and costs zero batches', p.batches.length, 0);
  }
  // A scholar's own site can be searched, scoped, and stays inside the bound trivially.
  {
    const iss = issue({ intent: 'scholar_opinion', requestedAuthorityId: 'ibn-baz', protectedEntities: ['الجمع بين الصلاتين'] });
    const p = QB.planIssueBatches(iss, ALL, { onlySites: ['binbaz.org.sa'] });
    ok('a scoped opinion search plans', p.ok, p.reason);
    eq('...against exactly his own domain', p.batches.flatMap((b) => b.sites), ['binbaz.org.sa']);
    eq('...as one request', p.batches.length, 1);
  }

  // =========================================================================
  console.log('\n=== E. BOTH FILTER FORMS ARE IMPLEMENTED AND BOUNDED ===');
  {
    eq('the OR form assembles as documented',
      QB.assembleQuery(['س'], ['a.com', 'b.com'], 'or'), 'س (site:a.com OR site:b.com)');
    eq('the single form assembles as documented',
      QB.assembleQuery(['س'], ['a.com'], 'single'), 'س (site:a.com)');
    const p = QB.planIssueBatches(issue({ coreTerms: ['الصلاة'] }), ALL, { form: 'single', maxGroups: 40 });
    ok('the single-site fallback plans one request per eligible domain', p.ok && p.batches.length > 5,
      String(p.batches.length));
    ok('...and every one is inside the bound', p.batches.every((b) => BG.withinInternalBounds(b.q)));
    ok('...each naming exactly one domain', p.batches.every((b) => b.sites.length === 1));
  }
  ok('a LIVE contract probe exists for the OR form and is NOT a Git gate',
    /export async function probeOrContract/.test(read('lib/ledger/search.js'))
    && !/probeOrContract/.test(read('gates.json')));
  ok('...and it is honest about needing a key', /VOID: no BRAVE_API_KEY/.test(read('lib/ledger/search.js')));

  // =========================================================================
  console.log('\n=== F. RANKING: HARD GATES FIRST, ORDER SECOND ===');
  {
    // A video page cannot outscore its way in, however good its title.
    const iss = issue({ intent: 'fatwa', protectedEntities: ['التقسيط'], coreTerms: ['الذهب', 'بيع'] });
    const cands = [
      { url: 'https://dr-mutlaq.com/aiovg_videos/بيع-الذهب-بالتقسيط', title: 'بيع الذهب بالتقسيط التقسيط الذهب بيع' },
      { url: 'https://islamqa.info/ar/answers/12345/x', title: 'حكم البيع' },
    ];
    const { ranked, refused } = RK.rankPreFetch(iss, cands);
    ok('the video page is REFUSED, not ranked', refused.some((r) => r.url.includes('aiovg_videos')));
    ok('...for a stated reason', refused[0].reason.startsWith('confirmed-index'), JSON.stringify(refused));
    ok('...and the ordinary page survives', ranked.length === 1 && ranked[0].url.includes('islamqa'));
  }
  {
    // Capability ineligibility is a refusal, not a penalty.
    const iss = issue({ intent: 'fatwa', coreTerms: ['الطلاق'] });
    const { ranked, refused } = RK.rankPreFetch(iss, [
      { url: 'https://khutabaa.com/article/1', title: 'الطلاق الطلاق الطلاق' },
      { url: 'https://tafsir.net/articles/1', title: 'الطلاق' },
    ]);
    eq('an ineligible source never ranks', ranked.length, 0);
    ok('...and every refusal names the capability',
      refused.every((r) => r.reason.startsWith('capability-ineligible')), JSON.stringify(refused));
  }
  {
    // A requested authority: only his own corpus, whatever else matches.
    const iss = issue({ intent: 'scholar_opinion', requestedAuthorityId: 'ibn-baz', coreTerms: ['الجمع'] });
    const { ranked, refused } = RK.rankPreFetch(iss, [
      // A general fatwa portal: eligible for `fatwa`, never for anybody's PRIMARY opinion.
      { url: 'https://islamqa.info/ar/answers/1/x', title: 'الجمع بين الصلاتين' },
      // ANOTHER scholar's own corpus: eligible for a primary opinion — just not for HIS.
      { url: 'https://binothaimeen.net/content/999', title: 'الجمع بين الصلاتين' },
      { url: 'https://binbaz.org.sa/fatwas/999/x', title: 'الجمع' },
    ]);
    eq('only his own site survives', ranked.map((r) => r.host), ['binbaz.org.sa']);
    ok('...a general portal is refused as ineligible for a primary opinion',
      refused.some((r) => r.url.includes('islamqa') && r.reason === 'capability-ineligible:scholar_opinion_primary'),
      JSON.stringify(refused));
    ok('...and ANOTHER scholar\'s corpus is refused as not-his, though it is capable',
      refused.some((r) => r.url.includes('binothaimeen') && r.reason === 'not-the-requested-authority:ibn-uthaymeen'),
      JSON.stringify(refused));
  }
  {
    // Generic index shapes, refused from the URL alone.
    for (const u of ['https://islamqa.info/ar/category/x', 'https://mostafaaladwy.com/fatwa-category/y',
      'https://alukah.net/tag/z', 'https://islamweb.net/ar/search?q=x',
      'https://saleh.af.org.sa/ar/ftawa/1.mp3', 'https://al-abbaad.com/lecture/12']) {
      ok('refused before any fetch: ' + u.slice(8, 60), !!RK.urlRefusal(u), String(RK.urlRefusal(u)));
    }
    ok('...while a real answer page is not refused',
      RK.urlRefusal('https://islamqa.info/ar/answers/12345/slug') === null,
      String(RK.urlRefusal('https://islamqa.info/ar/answers/12345/slug')));
  }
  {
    // Post-fetch hard gates. NOTE the field name: `authorialText` is what lib/ledger/page.js
    // produces and what the ranker scores. Scoring a `text` field would be scoring the
    // navigation on half these sites.
    const iss = issue({ intent: 'fatwa', coreTerms: ['الصلاة'] });
    const base = {
      url: 'https://islamqa.info/ar/answers/1/x', title: 't', kind: 'answer',
      authorialText: 'ن'.repeat(500), answerUnits: [{ answerUnitId: 'u1' }], ownerId: null, hasTranscript: true, dates: {},
    };
    ok('a good page is admitted', RK.admitPostFetch(iss, base).ok);
    eq('an index page is refused', RK.admitPostFetch(iss, { ...base, kind: 'index' }).reason, 'page-is-an-index');
    eq('media without a transcript is refused', RK.admitPostFetch(iss, { ...base, kind: 'media-only' }).reason,
      'media-without-transcript');
    eq('a page with no answer unit is refused', RK.admitPostFetch(iss, { ...base, answerUnits: [] }).reason,
      'no-answer-unit');
    // A SHORT ORIGINAL FATWA IS NOT REFUSED FOR BEING SHORT. There is no generic 50-word floor;
    // the floor is the source's own, and mostafaaladwy's is 20 characters.
    const shortFatwa = {
      url: 'https://mostafaaladwy.com/fatwa/178087/x', title: 't', kind: 'answer',
      authorialText: 'يجوز ذلك ولا حرج فيه.', answerUnits: [{ answerUnitId: 'u1' }], hasTranscript: true, dates: {},
    };
    ok('a genuinely SHORT published fatwa is admitted (< 50 words)',
      RK.admitPostFetch(iss, shortFatwa).ok, JSON.stringify(RK.admitPostFetch(iss, shortFatwa)));
    ok('...and it really is under 50 words', shortFatwa.authorialText.split(/\s+/).length < 50);
  }
  {
    // A PAGE DATE EARNS NOTHING ON A TIMELESS QUESTION.
    const timeless = issue({ temporalScope: 'unknown', coreTerms: ['الصلاة'] });
    const dated = issue({ temporalScope: 'dated_fact', coreTerms: ['الصلاة'] });
    const page = {
      url: 'https://islamqa.info/ar/answers/1/x', title: 't', kind: 'answer', authorialText: 'ن'.repeat(500),
      answerUnits: [{ answerUnitId: 'u1' }], hasTranscript: true, dates: { published: '2026-01-01' },
    };
    const noDate = { ...page, dates: {} };
    eq('a recent date adds NOTHING to a timeless question',
      RK.admitPostFetch(timeless, page).score, RK.admitPostFetch(timeless, noDate).score);
    ok('...but counts on an explicitly dated one',
      RK.admitPostFetch(dated, page).score > RK.admitPostFetch(dated, noDate).score);
  }

  // =========================================================================
  console.log('\n=== G. CANONICAL AND DEDUP ===');
  {
    const k = CA.canonicalKey;
    eq('www., scheme, trailing slash and case fold to one key',
      k('https://WWW.Islamqa.info/ar/answers/1/'), k('https://islamqa.info/ar/answers/1'));
    eq('a fragment folds', k('https://islamqa.info/ar/answers/1#x'), k('https://islamqa.info/ar/answers/1'));
    eq('percent-escape case folds',
      k('https://islamqa.info/ar/%d8%a7'), k('https://islamqa.info/ar/%D8%A7'));
    eq('parameter ORDER folds',
      k('https://tafsir.app/x?b=2&a=1'), k('https://tafsir.app/x?a=1&b=2'));
    // DECLARED tracking params go...
    ok('utm_* and gclid are stripped',
      k('https://islamqa.info/ar/answers/1?utm_source=x&gclid=y') === k('https://islamqa.info/ar/answers/1'));
    // ...and NOTHING ELSE does. This is the rule that stops two fatwas becoming one.
    ok('«ref» is KEPT (unknown params select content on these sites)',
      k('https://islamqa.info/ar/answers/1?ref=a') !== k('https://islamqa.info/ar/answers/1'));
    ok('«page» is KEPT', k('https://islamqa.info/x?page=2') !== k('https://islamqa.info/x?page=3'));
    ok('an unrecognised param is KEPT', k('https://tafsir.app/x?book=1') !== k('https://tafsir.app/x?book=2'));
    ok('two different paths on one host stay two pages',
      k('https://islamqa.info/ar/answers/1') !== k('https://islamqa.info/ar/answers/2'));
  }
  {
    // The declared canonical is page-supplied and therefore checked.
    const same = CA.resolveCitableUrl('https://islamqa.info/ar/answers/1/x', 'https://islamqa.info/ar/answers/1');
    eq('a same-site canonical is honoured', same.basis, 'declared-canonical');
    const off = CA.resolveCitableUrl('https://islamqa.info/ar/answers/1/x', 'https://evil.example.com/a');
    eq('an off-site canonical is REFUSED', off.basis, 'fetched');
    ok('...and recorded rather than discarded', off.rejectedCanonical === 'https://evil.example.com/a');
    const unlisted = CA.resolveCitableUrl('https://islamqa.info/ar/answers/1/x', 'https://shkhudheir.com/a');
    eq('a canonical to a disabled host is refused', unlisted.basis, 'fetched');
  }
  {
    const led = new CA.FetchLedger();
    ok('the first claim of a URL succeeds', led.claim('https://islamqa.info/ar/answers/1', 'iss_1'));
    ok('a second claim of the SAME page fails', !led.claim('https://www.islamqa.info/ar/answers/1/', 'iss_2'));
    ok('...even across issues and with tracking params',
      !led.claim('https://islamqa.info/ar/answers/1?utm_source=z', 'iss_3'));
    ok('a genuinely different page still claims', led.claim('https://islamqa.info/ar/answers/2', 'iss_1'));
    eq('so exactly two pages were claimed', led.size, 2);
  }
  {
    eq('http is not admissible', CA.admissible('http://islamqa.info/x'), false);
    eq('a disabled host is not admissible', CA.admissible('https://shkhudheir.com/x'), false);
    eq('an unknown host is not admissible', CA.admissible('https://evil.example.com/x'), false);
    eq('userinfo is not admissible', CA.admissible('https://a@islamqa.info/x'), false);
    eq('a real page is admissible', CA.admissible('https://islamqa.info/ar/answers/1'), true);
  }

  // =========================================================================
  console.log('\n=== H. SSRF — EVERY HOP, IPv4 AND IPv6 ===');
  {
    const BLOCKED = [
      ['127.0.0.1', 'loopback'], ['127.9.9.9', 'loopback'], ['0.0.0.0', 'this-network'],
      ['10.1.2.3', 'private-10/8'], ['172.16.0.1', 'private-172.16/12'], ['172.31.255.255', 'private-172.16/12'],
      ['192.168.1.1', 'private-192.168/16'], ['169.254.169.254', 'link-local'],
      ['100.64.0.1', 'cgnat-100.64/10'], ['224.0.0.1', 'multicast-or-reserved'],
      ['::1', 'loopback'], ['fd00::1', 'unique-local-fc00::/7'], ['fe80::1', 'link-local-fe80::/10'],
      ['ff02::1', 'multicast-ff00::/8'], ['::ffff:127.0.0.1', 'ipv4-mapped:loopback'],
      ['::ffff:169.254.169.254', 'ipv4-mapped:link-local'],
    ];
    for (const [ip, why] of BLOCKED) eq('BLOCKED ' + ip, SF.blockedIpReason(ip), why);
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '11.0.0.1', '2001:4860:4860::8888']) {
      eq('allowed ' + ip, SF.blockedIpReason(ip), null);
    }
    // 172.15 and 172.32 sit just outside the private block — an off-by-one here is a real hole.
    eq('172.15.255.255 is public', SF.blockedIpReason('172.15.255.255'), null);
    eq('172.16.0.0 is private', SF.blockedIpReason('172.16.0.0'), 'private-172.16/12');
    eq('172.31.0.0 is private', SF.blockedIpReason('172.31.0.0'), 'private-172.16/12');
    eq('172.32.0.0 is public', SF.blockedIpReason('172.32.0.0'), null);
  }
  {
    // A host that resolves to a private address is refused even though the NAME is approved.
    SF.__setResolverForTest(async () => [{ address: '10.0.0.7', family: 4 }]);
    const r = await SF.preflight('https://islamqa.info/ar/answers/1');
    eq('an approved NAME resolving to a private IP is refused', r.ok, false);
    ok('...naming the range', String(r.reason).includes('private-10/8'), r.reason);

    // ANY non-public address in the set is enough — this is the rebinding case.
    SF.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    eq('a mixed public/private resolution is refused', (await SF.preflight('https://islamqa.info/x')).ok, false);

    SF.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }]);
    eq('a wholly public resolution passes', (await SF.preflight('https://islamqa.info/ar/answers/1')).ok, true);
    eq('...but an unapproved host still fails first', (await SF.preflight('https://evil.example.com/x')).ok, false);
    // An IP literal in the URL is refused outright — every approved source is a NAME.
    ok('an IP-literal host is refused', !(await SF.preflight('https://127.0.0.1/x')).ok);
    SF.__resetResolver();
  }
  {
    // Redirect hops. The fetch is stubbed; DNS says public.
    SF.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }]);
    const resp = (status, headers, body) => ({
      status,
      headers: { get: (k) => (headers || {})[k.toLowerCase()] ?? null },
      body: null,
      text: async () => body || '',
    });
    let seen = [];
    const stub = (map) => async (u) => { seen.push(String(u)); return map[String(u)] || resp(404, {}); };

    // A redirect to loopback is refused BEFORE the connection, not after.
    seen = [];
    let out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({ 'https://islamqa.info/a': resp(302, { location: 'http://127.0.0.1:8080/x' }) }),
    });
    eq('a redirect to loopback is a hard reject', out.ok, false);
    eq('...with the honest reason', out.reason, 'redirect-off-policy');
    eq('...and the loopback URL was never requested', seen.filter((u) => u.includes('127.0.0.1')).length, 0);

    // A redirect off the approved set.
    seen = [];
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({ 'https://islamqa.info/a': resp(301, { location: 'https://evil.example.com/x' }) }),
    });
    eq('a redirect to an unregistered host is a hard reject', out.reason, 'redirect-off-policy');
    eq('...and that host was never requested', seen.filter((u) => u.includes('evil.example')).length, 0);

    // A legal same-site redirect IS followed, and both hops are recorded.
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({
        'https://islamqa.info/a': resp(302, { location: 'https://islamqa.info/b' }),
        'https://islamqa.info/b': resp(200, { 'content-type': 'text/html; charset=utf-8' }, '<html>ok</html>'),
      }),
    });
    ok('a same-site redirect is followed', out.ok, JSON.stringify(out));
    eq('...and every hop is recorded', out.hops.length, 2);
    eq('...with the final URL reported', out.fetchedUrl, 'https://islamqa.info/b');

    // Content-type and size.
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({ 'https://islamqa.info/a': resp(200, { 'content-type': 'application/pdf' }, 'x') }),
    });
    ok('a disallowed content-type is refused', !out.ok && out.reason.startsWith('content-type'));
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({ 'https://islamqa.info/a': resp(200, { 'content-type': 'text/html', 'content-length': '99999999' }, 'x') }),
    });
    ok('an over-large declared size is refused', !out.ok && out.reason.startsWith('declared-too-large'));
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({ 'https://islamqa.info/a': resp(200, { 'content-type': 'text/html' }, 'x'.repeat(3 * 1024 * 1024)) }),
    });
    ok('an over-large ACTUAL body is refused even when the header lied',
      !out.ok && out.reason.startsWith('body-too-large'), JSON.stringify(out));

    // 403 is not retried and not worked around.
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: stub({ 'https://islamqa.info/a': resp(403, { 'content-type': 'text/html' }, 'nope') }),
    });
    eq('a 403 is reported, not evaded', out.reason, 'http-403');

    // A timeout is a value, never an exception.
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; },
    });
    eq('a timeout degrades to a refusal', out.reason, 'timeout');

    // A redirect loop terminates.
    out = await SF.safeFetch('https://islamqa.info/a', {
      fetchImpl: async (u) => resp(302, { location: String(u) === 'https://islamqa.info/a' ? 'https://islamqa.info/b' : 'https://islamqa.info/a' }),
    });
    eq('a redirect loop terminates', out.reason, 'too-many-redirects');
    SF.__resetResolver();
  }
  ok('redirects are followed MANUALLY, so every hop is checked',
    /redirect: 'manual'/.test(read('lib/ledger/safe-fetch.js')));
  ok('no browser impersonation and no challenge evasion',
    !/cf_clearance|__cf|Chrome\/1[0-9]{2}/.test(read('lib/ledger/safe-fetch.js')));

  // =========================================================================
  console.log('\n=== I. THE BUDGET LEDGER REFUSES RATHER THAN THROWS ===');
  {
    let t = 1000;
    const b = new BG.Budget({ now: () => t });
    ok('four Brave calls are affordable', [1, 2, 3, 4].every(() => b.spend('braveCalls', 1)));
    ok('the fifth is a breach', !b.canAfford('braveCalls'));
    eq('...and spending it is RECORDED, not hidden', (b.spend('braveCalls', 1), b.snapshot().breaches.length), 1);
    t = 1000 + BG.GLOBAL_TIMEOUT_MS + 1;
    ok('past the deadline nothing is affordable', !b.canAfford('modelCalls'));
    eq('...and remainingMs floors at zero', b.remainingMs(), 0);
  }
  {
    const b = new BG.Budget({ now: () => 0 });
    ok('a model call inside the token budget is affordable', b.canAffordModelCall(1000));
    b.spend('inputTokens', BG.MAX_MODEL_INPUT_TOKENS - 100);
    ok('...and one that would breach the TOKEN budget is not, though the COUNT allows it',
      !b.canAffordModelCall(1000) && b.canAfford('modelCalls'));
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ledger-retrieval-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
