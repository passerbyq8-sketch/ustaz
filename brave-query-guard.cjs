// brave-query-guard.cjs — no Brave query this app can build is ever too long.
//
// WHY THIS GATE EXISTS, and it is the most expensive lesson in the repo:
//
// On 2026-08-03 the adult allow-list went from 14 domains to 24. Twenty-five gates passed.
// recon passed. The live source smoke test passed 34/34. And adult retrieval was DEAD in
// production — every question that needed a source answered «تعذّر عليّ التحقق من مصدر
// موثوق», because the `site:` filter had pushed the query from 341 characters to 576 and
// Brave's ceiling is 400. Children were fine (3 domains, short query) and the Ibn Uthaymeen
// adapter was fine (it does not use Brave), which is exactly why nothing looked wrong.
//
// Not one of those gates measured the only number that mattered: the length of the string
// the provider is actually asked to accept. This gate measures it, and it measures it the
// way the provider does — on the assembled `q`, in characters AND in words, for every list,
// every purpose and every question shape the app can produce.
//
// It is offline and deterministic. It sends nothing.
//
// Usage: node brave-query-guard.cjs
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

(async function main() {
  console.log('=== brave-query-guard — the provider refuses long queries; we never send one ===');

  const B = await esm('lib/brave-query.js');
  const R = await esm('lib/source-registry.js');
  const retrieveSrc = read('lib/retrieve.js');

  const ADULT = R.domainsForBand('adult');
  const MINOR = R.domainsForBand('minor');
  const FOURTEEN = ADULT.slice(0, 14);
  const Q_SHORT = 'حكم صيام عرفة';
  const Q_TYPICAL = 'ما معنى قوله تعالى وأن ليس للإنسان إلا ما سعى';

  // =========================================================================
  console.log('\n=== A. THE TWO CEILINGS, AND HOW A QUERY IS MEASURED ===');
  eq('provider hard limit: chars', B.HARD_MAX_CHARS, 400);
  eq('provider hard limit: words', B.HARD_MAX_WORDS, 50);
  ok('our safe limit is STRICTLY below the provider\'s',
    B.SAFE_MAX_CHARS < B.HARD_MAX_CHARS && B.SAFE_MAX_WORDS < B.HARD_MAX_WORDS,
    `${B.SAFE_MAX_CHARS}/${B.SAFE_MAX_WORDS} vs ${B.HARD_MAX_CHARS}/${B.HARD_MAX_WORDS}`);
  eq('safe limits are the documented 380/45', [B.SAFE_MAX_CHARS, B.SAFE_MAX_WORDS], [380, 45]);

  // Measurement is on the ASSEMBLED q, not on the filter alone — the defect's exact shape.
  {
    const q = B.buildQuery('سؤال', ['a.com', 'b.com']);
    eq('buildQuery assembles question + parenthesised site filter', q, 'سؤال (site:a.com OR site:b.com)');
    eq('measureQuery counts chars and whitespace-words', B.measureQuery('ab cd  ef'), { chars: 9, words: 3 });
  }

  // (10) 399 / 400 / 401 characters, exactly.
  for (const n of [399, 400, 401]) {
    const s = 'x'.repeat(n);
    eq('hard limit at ' + n + ' chars', B.withinHard(s), n <= 400);
  }
  for (const n of [379, 380, 381]) {
    const s = 'y'.repeat(n);
    eq('safe limit at ' + n + ' chars', B.withinSafe(s), n <= 380);
  }
  // (11) 49 / 50 / 51 words, exactly.
  for (const n of [49, 50, 51]) {
    const s = Array.from({ length: n }, () => 'w').join(' ');
    eq('hard limit at ' + n + ' words', B.withinHard(s), n <= 50);
  }
  for (const n of [44, 45, 46]) {
    const s = Array.from({ length: n }, () => 'z').join(' ');
    eq('safe limit at ' + n + ' words', B.withinSafe(s), n <= 45);
  }
  ok('a query can bust the WORD limit while under the CHAR limit (both are checked)',
    !B.withinHard(Array.from({ length: 60 }, () => 'a').join(' ')));

  // =========================================================================
  console.log('\n=== B. PLANNING (split, cover, order — never drop) ===');

  const plans = {};
  const CASES = [
    ['3 domains (the child list)', MINOR, Q_TYPICAL, 'general'],
    ['14 domains (the pre-regression list)', FOURTEEN, Q_TYPICAL, 'general'],
    ['24 domains — fatwa', ADULT, 'ما حكم بيع الذهب بالتقسيط', 'fatwa'],
    ['24 domains — tafsir', ADULT, Q_TYPICAL, 'tafsir'],
    ['24 domains — hadith', ADULT, 'تخريج حديث إنما الأعمال بالنيات', 'hadith'],
    ['24 domains — general', ADULT, 'خطبة عن بر الوالدين', 'general'],
    ['24 domains — short question', ADULT, Q_SHORT, 'fatwa'],
  ];
  for (const [label, sites, q, purpose] of CASES) {
    const plan = B.planQueries(q, sites, { purpose });
    plans[label] = plan;
    const worst = plan.groups.reduce((a, g) => Math.max(a, g.chars), 0);
    const worstW = plan.groups.reduce((a, g) => Math.max(a, g.words), 0);
    ok(label + ': every group within SAFE', plan.groups.every((g) => B.withinSafe(g.q)),
      `worst ${worst}c/${worstW}w`);
    ok(label + ': every group within HARD', plan.groups.every((g) => B.withinHard(g.q)));
    // NOTHING IS DROPPED — the union of the groups is exactly the input list.
    const union = plan.groups.flatMap((g) => g.sites);
    eq(label + ': union of groups == input list (no silent drop)',
      union.slice().sort(), sites.slice().sort());
    eq(label + ': no domain appears in two groups', union.length, new Set(union).size);
    console.log(`        -> ${plan.groups.length} group(s): `
      + plan.groups.map((g) => `#${g.index} ${g.sites.length} sites ${g.chars}c/${g.words}w`).join(' | '));
  }

  // (1) and (2): the short lists stay ONE request. This is the child non-regression.
  eq('3 domains -> exactly one request', plans['3 domains (the child list)'].groups.length, 1);
  eq('14 domains -> exactly one request', plans['14 domains (the pre-regression list)'].groups.length, 1);
  // (3) 24 domains must split.
  ok('24 domains -> two or more groups', plans['24 domains — fatwa'].groups.length >= 2,
    String(plans['24 domains — fatwa'].groups.length));
  ok('24 domains -> not an absurd number of groups (budget is preserved)',
    plans['24 domains — fatwa'].groups.length <= 3);

  // (16) every one of the 24 appears in at least one group, for EVERY purpose.
  for (const p of R.PURPOSES) {
    const plan = B.planQueries(Q_TYPICAL, ADULT, { purpose: p });
    const seen = new Set(plan.groups.flatMap((g) => g.sites));
    eq('purpose ' + p + ': all ' + ADULT.length + ' domains are searchable',
      ADULT.filter((d) => !seen.has(d)), []);
  }

  // Ordering: the purpose's own sources lead, and ordering is a PERMUTATION, never a filter.
  {
    const ranked = R.rankForPurpose(ADULT, 'tafsir');
    eq('rankForPurpose returns a permutation (same members)', ranked.slice().sort(), ADULT.slice().sort());
    const g1 = B.planQueries(Q_TYPICAL, ADULT, { purpose: 'tafsir' }).groups[0].sites;
    ok('a tafsir question meets the tafsir sources in group 1',
      g1.includes('tafsir.app') && g1.includes('tafsir.net'), JSON.stringify(g1));
    const h1 = B.planQueries('تخريج حديث', ADULT, { purpose: 'hadith' }).groups[0].sites;
    ok('a hadith question meets dorar.net in group 1', h1.includes('dorar.net'), JSON.stringify(h1));
    const f1 = B.planQueries('ما حكم كذا', ADULT, { purpose: 'fatwa' }).groups[0].sites;
    ok('a fatwa question meets the fatwa portals in group 1',
      f1.includes('islamqa.info') && f1.includes('islamweb.net'), JSON.stringify(f1));
  }

  // (9) long domain names must not break the packing.
  {
    const LONG = ['a-very-long-domain-name-for-testing.example.org',
      'another-extremely-long-domain-name.example.com',
      'third-long-one.subdomain.example.net', 'eftaa.awqaf.gov.kw'];
    const plan = B.planQueries(Q_TYPICAL, LONG, { purpose: 'general' });
    ok('long domain names: every group still within SAFE', plan.groups.every((g) => B.withinSafe(g.q)));
    eq('long domain names: none dropped', plan.groups.flatMap((g) => g.sites).slice().sort(), LONG.slice().sort());
  }

  // =========================================================================
  console.log('\n=== C. AN OVER-LONG QUESTION IS SHORTENED BY WHOLE WORDS ===');
  const LONG_Q = 'أريد أن أسأل فضيلتكم سؤالا مطولا جدا عن مسألة وقعت لي في هذا الشهر وقد '
    + 'حيرتني كثيرا وسألت عنها بعض طلبة العلم في بلدي فلم أجد جوابا شافيا يطمئن قلبي '
    + 'وهي مسألة تتعلق بالطهارة والصلاة والصيام معا وأرجو التفصيل';
  {
    const plan = B.planQueries(LONG_Q, ADULT, { purpose: 'fatwa' });
    ok('a long question is shortened', plan.shortened);
    ok('...every group is still within SAFE', plan.groups.every((g) => B.withinSafe(g.q)),
      plan.groups.map((g) => g.chars + 'c/' + g.words + 'w').join(', '));
    ok('...and nothing is dropped', new Set(plan.groups.flatMap((g) => g.sites)).size === ADULT.length);
    // NO WORD IS CUT IN HALF. Every surviving token is a token of the original.
    const origToks = new Set(LONG_Q.split(/\s+/).filter(Boolean));
    eq('...no Arabic word is split mid-way',
      plan.question.split(/\s+/).filter(Boolean).filter((t) => !origToks.has(t)), []);
    ok('...the shortened question is a PREFIX-ORDERED subset of the original',
      (() => {
        const kept = plan.question.split(/\s+/).filter(Boolean);
        const orig = LONG_Q.split(/\s+/).filter(Boolean);
        let i = 0;
        for (const k of kept) { while (i < orig.length && orig[i] !== k) i++; if (i >= orig.length) return false; i++; }
        return true;
      })());
  }
  {
    // A duration must survive the shortening: in this app the period IS the ruling.
    const q = 'أريد أن أسأل فضيلتكم عن مسألة طويلة جدا حيرتني كثيرا وسألت عنها كثيرا من طلبة '
      + 'العلم ولم أجد جوابا شافيا وهي فيمن أسقطت دون 80 يوم';
    const plan = B.planQueries(q, ADULT, { purpose: 'fatwa' });
    ok('a duration survives shortening: the number is kept', /80/.test(plan.question), plan.question);
    ok('...and so is its unit', /يوم/.test(plan.question), plan.question);
  }
  ok('a question that already fits is left VERBATIM',
    B.planQueries(Q_TYPICAL, MINOR, { purpose: 'general' }).question === Q_TYPICAL);
  ok('an empty question does not crash the planner',
    B.planQueries('', ADULT, { purpose: 'general' }).groups.every((g) => B.withinSafe(g.q)));

  // =========================================================================
  console.log('\n=== D. PROPERTY: NOTHING THE APP CAN BUILD EXCEEDS THE LIMITS ===');
  {
    // Deterministic pseudo-random questions of many lengths, over the real lists.
    const WORDS = ['ما', 'حكم', 'الصلاة', 'الصيام', 'الزكاة', 'قوله', 'تعالى', 'حديث', 'إنما',
      'الأعمال', 'بالنيات', 'المسافر', 'المرأة', 'الطهارة', 'الاستحاضة', 'النفاس', '80', 'يوم',
      'التقسيط', 'الذهب', 'المضاربة', 'الوقف', 'الميراث', 'الرضاع'];
    let seed = 20260803;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let worstChars = 0, worstWords = 0, bad = 0, plansMade = 0, uncovered = 0;
    for (const list of [MINOR, FOURTEEN, ADULT]) {
      for (const purpose of R.PURPOSES) {
        for (let n = 1; n <= 60; n++) {
          const q = Array.from({ length: n }, () => WORDS[Math.floor(rnd() * WORDS.length)]).join(' ');
          const plan = B.planQueries(q, list, { purpose });
          plansMade++;
          for (const g of plan.groups) {
            worstChars = Math.max(worstChars, g.chars);
            worstWords = Math.max(worstWords, g.words);
            if (!B.withinSafe(g.q) || !B.withinHard(g.q)) bad++;
          }
          if (new Set(plan.groups.flatMap((g) => g.sites)).size !== list.length) uncovered++;
        }
      }
    }
    console.log(`        -> ${plansMade} plans built; worst group ${worstChars} chars / ${worstWords} words`);
    eq('no plan in ' + plansMade + ' produced an over-limit query', bad, 0);
    eq('no plan lost a domain', uncovered, 0);
    ok('the worst query built is under the SAFE char limit', worstChars <= B.SAFE_MAX_CHARS, String(worstChars));
    ok('the worst query built is under the SAFE word limit', worstWords <= B.SAFE_MAX_WORDS, String(worstWords));
  }

  // =========================================================================
  console.log('\n=== E. THE REQUEST PATH (Brave stubbed; no network) ===');
  {
    // Stub ONLY the Brave endpoint and the page fetches, then drive the real retrieve().
    const realFetch = globalThis.fetch;
    // A synthetic Response reports url === '', and retrieve.js reads res.url as the FINAL
    // post-redirect host and refuses anything off-list — correctly. So the stub has to say
    // where it came from, exactly as a real fetch does, or the test would be measuring the
    // allow-list rather than the query planner.
    const at = (res, u) => { Object.defineProperty(res, 'url', { value: u }); return res; };
    const html = (body, u) => at(new Response(
      '<html><head><title>صفحة</title></head><body><article><p>' + body.repeat(30) + '</p></article></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } }), u);

    const scenario = { braveQueries: [], pageFetches: [], results: {}, pages: {} };
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('api.search.brave.com')) {
        const q = decodeURIComponent(new URL(u).searchParams.get('q') || '');
        scenario.braveQueries.push(q);
        const idx = scenario.braveQueries.length;
        return at(new Response(JSON.stringify({ web: { results: scenario.results[idx] || [] } }),
          { status: 200, headers: { 'content-type': 'application/json' } }), u);
      }
      scenario.pageFetches.push(u);
      const body = scenario.pages[u];
      if (body === undefined) return at(new Response('', { status: 404 }), u);
      return html(body, u);
    };
    process.env.BRAVE_API_KEY = process.env.BRAVE_API_KEY || 'stub-for-gate';
    const { retrieve, resetBreakers } = await esm('lib/retrieve.js');

    const reset = () => {
      scenario.braveQueries = []; scenario.pageFetches = [];
      scenario.results = {}; scenario.pages = {};
      resetBreakers();
    };
    const GOOD = 'هذا نص علمي كافٍ عن المسألة المسؤول عنها وفيه بيان الحكم بالدليل والتفصيل. ';

    // (17) every query the real path sends is within both limits.
    reset();
    scenario.results[1] = [{ title: 'x', url: 'https://islamweb.net/ar/fatwa/1/x', description: '' }];
    scenario.pages['https://islamweb.net/ar/fatwa/1/x'] = GOOD;
    let out = await retrieve('ما حكم صيام عرفة', { band: 'adult' });
    ok('a verified source is returned', out.sources.length === 1, JSON.stringify(out.sources.map((s) => s.url)));
    ok('every Brave query sent is within the HARD limit', scenario.braveQueries.every((q) => B.withinHard(q)));
    ok('every Brave query sent is within OUR SAFE limit', scenario.braveQueries.every((q) => B.withinSafe(q)),
      scenario.braveQueries.map((q) => B.measureQuery(q).chars + 'c').join(','));
    // (13) group 1 succeeding must not cost a second request.
    eq('group 1 succeeded -> exactly ONE Brave request', scenario.braveQueries.length, 1);

    // (12) group 1 empty -> group 2 is tried and succeeds.
    reset();
    scenario.results[1] = [];
    // a host with no per-page attribution rule, so this test measures the GROUP FALLBACK
    // and not khutabaa's (correct) refusal to cite an anonymous khutbah.
    scenario.results[2] = [{ title: 'y', url: 'https://ferkous.com/ar/fatawa/1', description: '' }];
    scenario.pages['https://ferkous.com/ar/fatawa/1'] = GOOD;
    out = await retrieve('خطبة عن بر الوالدين', { band: 'adult' });
    ok('group 1 empty -> a second Brave request is made', scenario.braveQueries.length >= 2,
      String(scenario.braveQueries.length));
    ok('...and group 2 can answer the question', out.sources.length === 1, JSON.stringify(out.sources.map((s) => s.url)));

    // (15) an INDEX page in group 1 does not stop group 2 being tried.
    reset();
    scenario.results[1] = [{ title: 'i', url: 'https://mostafaaladwy.com/fatwa-category/x/', description: '' }];
    scenario.results[2] = [{ title: 'y', url: 'https://ferkous.com/ar/fatawa/2', description: '' }];
    scenario.pages['https://ferkous.com/ar/fatawa/2'] = GOOD;
    out = await retrieve('خطبة عن الصبر', { band: 'adult' });
    ok('an index page in group 1 does not end the search', scenario.braveQueries.length >= 2);
    ok('...and the listing was never fetched', !scenario.pageFetches.some((u) => u.includes('fatwa-category')));

    // (14) the same URL returned by two groups is fetched ONCE.
    reset();
    const DUP = 'https://alukah.net/sharia/0/1/x';
    scenario.results[1] = [{ title: 'd', url: DUP, description: '' }];
    scenario.results[2] = [{ title: 'd', url: DUP, description: '' }];
    // no page body registered -> 404 -> not usable, so both groups run
    out = await retrieve('سؤال عام عن الأخلاق', { band: 'adult' });
    eq('a duplicate URL across groups is fetched only once',
      scenario.pageFetches.filter((u) => u === DUP).length, 1);
    eq('...and with nothing usable, no source is invented', out.sources.length, 0);

    // (18) the child list is still ONE request.
    reset();
    scenario.results[1] = [{ title: 'c', url: 'https://binbaz.org.sa/fatwas/1/x', description: '' }];
    scenario.pages['https://binbaz.org.sa/fatwas/1/x'] = GOOD;
    out = await retrieve('ما حكم صيام عرفة', { band: 'young' });
    eq('the child band still costs exactly one Brave request', scenario.braveQueries.length, 1);
    ok('...and still returns its source', out.sources.length === 1);

    // Worst case: nothing anywhere. Bounded requests, and no fabrication.
    reset();
    out = await retrieve('سؤال لا مصدر له إطلاقا', { band: 'adult' });
    ok('worst case makes at most 3 Brave requests', scenario.braveQueries.length <= 3,
      String(scenario.braveQueries.length));
    ok('worst case fetches no more than 8 pages', scenario.pageFetches.length <= 8,
      String(scenario.pageFetches.length));
    eq('worst case invents nothing', out.sources.length, 0);
    console.log(`        -> worst case: ${scenario.braveQueries.length} search request(s), ${scenario.pageFetches.length} page fetch(es)`);

    globalThis.fetch = realFetch;
  }

  // =========================================================================
  console.log('\n=== F. THE WIRING ===');
  ok('retrieve.js builds its queries through lib/brave-query.js',
    /from '\.\/brave-query\.js'/.test(retrieveSrc));
  ok('retrieve.js no longer assembles a site: filter of its own',
    !/function siteFilterFor/.test(retrieveSrc));
  ok('searchWeb refuses to send an over-long query', /if \(!isSendable\(q\)\)/.test(retrieveSrc));
  ok('runSearchPass iterates the planned groups', /for \(const group of plan\.groups\)/.test(retrieveSrc));
  ok('it stops at the first verified source', /kept\.push\(first\); break;/.test(retrieveSrc));
  ok('a page fetched for one group is not refetched for the next', /dup-skip/.test(retrieveSrc));
  ok('the attributed Ibn Uthaymeen path does not go through Brave at all',
    !/brave|BRAVE/i.test(read('lib/binothaimeen.js')));
  ok('gates.json lists this guard', /brave-query-guard\.cjs/.test(read('gates.json')));

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('brave-query-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
