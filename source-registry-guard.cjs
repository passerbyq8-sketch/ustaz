// source-registry-guard.cjs — the source registry, its scopes, and its page-level admission.
//
// WHAT THIS GATE PROVES, in the order the brief asks for it:
//   A. THE REGISTRY   — one row per domain, normalised; no duplicate, no second name, no
//                       www. evasion, no nested domain, and the table mirrors the arrays in
//                       lib/retrieve.js exactly (so a domain added to one and not the other
//                       fails here rather than silently half-existing).
//   B. NO DUPLICATION — the sources the brief names as already present are present ONCE, and
//                       every one of the nine is accounted for as new, pre-existing, or
//                       deliberately refused.
//   C. SCOPE          — a source admitted for khutbahs may not back a ruling; and, the other
//                       half of that sentence, NONE of the fifteen pre-existing sources is
//                       ever narrowed, for any purpose.
//   D. PURPOSE        — the classifier that feeds C, on a fixed corpus.
//   E. THE URL GATE   — section indexes, media catalogues and forums are refused before a
//                       byte is fetched; look-alike hosts are refused outright.
//   F. THE PAGE GATE  — on fixtures built to the shapes MEASURED on the live sites: an empty
//                       answer, a listing, a reader submission, an anonymous khutbah, a
//                       reprint, and the Kuwait committee/personal split.
//   G. THE TWO NAMED REGRESSIONS — «أسقطت دون 80 يوم» and «يا معطي لا تبطي» still behave, and
//                       the eight new domains opened no path around either gate.
//   H. NO RAW TAG     — no <source> the model wrote can reach a reader on any branch.
//   I. THE WIRING     — read off lib/retrieve.js and api/ask.js.
//
// NO NETWORK. Every check here is offline and deterministic; the fixtures encode the page
// SHAPES that were measured live on 2026-08-03. The live counterpart is
// tools/source-live-smoke.cjs, which is deliberately NOT in gates.json.
//
// Usage: node source-registry-guard.cjs
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

// Pull a literal array body out of a module's source, so the gate reads what SHIPS rather
// than what a re-implementation here would compute.
function arrayLiteral(src, name) {
  const i = src.indexOf(name);
  if (i === -1) return null;
  const open = src.indexOf('[', i);
  if (open === -1) return null;
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '[') depth++;
    else if (src[k] === ']') { depth--; if (depth === 0) return src.slice(open, k + 1); }
  }
  return null;
}
const quotedDomains = (body) =>
  Array.from(String(body || '').matchAll(/'([a-z0-9][a-z0-9.-]*\.[a-z]{2,})'/g)).map((m) => m[1]);

(async function main() {
  console.log('=== source-registry-guard — one row per source, and a page is not a host ===');

  const R = await esm('lib/source-registry.js');
  const SP = await esm('lib/ledger/source-policy.js');
  const P = await esm('lib/source-purpose.js');
  const G = await esm('lib/source-page-gates.js');
  const { parseHTML } = await import('linkedom');
  const retrieveSrc = read('lib/retrieve.js');
  const askSrc = read('api/ask.js');

  // =========================================================================
  console.log('\n=== A. THE REGISTRY (one row per domain, normalised) ===');

  eq('duplicateProblems() is empty', R.duplicateProblems(), []);

  // The normaliser is the whole basis of every duplicate rule below, so it is pinned first.
  const NORM = [
    ['https://www.ibn-jebreen.com/', 'ibn-jebreen.com'],
    ['http://IBN-JEBREEN.com', 'ibn-jebreen.com'],
    ['WWW.Khutabaa.COM', 'khutabaa.com'],
    ['khutabaa.com/', 'khutabaa.com'],
    ['khutabaa.com.', 'khutabaa.com'],
    ['https://user:pw@salafcenter.org:8443/x?y#z', 'salafcenter.org'],
    ['https://eftaa.awqaf.gov.kw/ar', 'eftaa.awqaf.gov.kw'],
    ['not a domain', ''],
    ['', ''],
    [null, ''],
    ['javascript:alert(1)', ''],
  ];
  NORM.forEach(([input, want]) => eq('normalizeDomain(' + JSON.stringify(input) + ')', R.normalizeDomain(input), want));

  // Look-alikes must not resolve to an approved row. This is the same trap retrieve.js's
  // hostAllowed() closes, asserted here on the registry's own matcher.
  ok('hostMatches: sub-domain of an approved domain matches', R.hostMatches('ar.khutabaa.com', 'khutabaa.com'));
  ok('hostMatches: a look-alike prefix does NOT match', !R.hostMatches('evil-khutabaa.com', 'khutabaa.com'));
  ok('hostMatches: an approved name inside another domain does NOT match', !R.hostMatches('khutabaa.com.evil.net', 'khutabaa.com'));
  ok('findSource: an unapproved host has no row', R.findSource('example.com') === null);
  ok('findSource: www. resolves to the same single row',
    R.findSource('https://www.salafcenter.org/x') === R.findSource('salafcenter.org'));

  // (b) THE MIRROR. The registry is metadata; lib/retrieve.js owns the lists. They must name
  // exactly the same domains, or one of them is lying about what is searchable.
  const adultArr = quotedDomains(arrayLiteral(retrieveSrc, 'SITES_ADULT'));
  const minorArr = quotedDomains(arrayLiteral(retrieveSrc, 'SITES_MINOR ='));
  const fallbackArr = quotedDomains(arrayLiteral(retrieveSrc, 'SITES_MINOR_FALLBACK'));
  ok('lib/retrieve.js SITES_ADULT parsed', adultArr.length > 0, JSON.stringify(adultArr));
  const sorted = (a) => a.slice().sort();
  eq('registry adult set == SITES_ADULT', sorted(R.domainsForBand('adult')), sorted(adultArr));
  eq('registry minor set == SITES_MINOR', sorted(R.domainsForBand('minor')), sorted(minorArr));
  eq('registry minor-fallback set == SITES_MINOR_FALLBACK', sorted(R.domainsForBand('minor-fallback')), sorted(fallbackArr));

  const report = read('EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md');
  const documentedSourceCounts = [
    /\| Policy rows \| (\d+) \|/.exec(report)?.[1],
    /\| Enabled \| (\d+) \|/.exec(report)?.[1],
    /\| Enabled \*\*and\*\* searchable \| (\d+) \|/.exec(report)?.[1],
    /\| Registry active \| (\d+) \|/.exec(report)?.[1],
    /\| Registry blocked \| (\d+) \|/.exec(report)?.[1],
    /\| Registry total \| (\d+) \|/.exec(report)?.[1],
    /\| Registry deferred \| (\d+) \|/.exec(report)?.[1],
    /\| Registry world \| (\d+) \|/.exec(report)?.[1],
  ].map((value) => value == null ? null : Number(value));
  eq('the implementation report source counts match the governing registries',
    documentedSourceCounts, [
      SP.POLICY_ROWS.length,
      SP.POLICY_ROWS.filter((row) => row.health === 'enabled').length,
      SP.POLICY_ROWS.filter((row) => row.health === 'enabled' && row.searchable).length,
      R.activeSources().length,
      R.blockedSources().length,
      R.SOURCES.length,
      R.SOURCES.filter((row) => row.status === 'deferred').length,
      R.worldSources().length,
    ]);

  // ── THE CHILD'S ROSTER, PINNED BY NAME (batch 2, step 10) ─────────────────
  // Widened on 2026-08-05 by an explicit decision of the project's owner, from two domains to
  // eight. Pinned as a literal list rather than a count, because WHICH sources a child's search
  // may draw from is a decision somebody made — a domain quietly appearing here should be a
  // failing gate, not a diff nobody reads.
  //
  // dorar.net is named in that decision and is CONDITIONALLY ABSENT: it was to be included «إن
  // أُحيي», and it was not. Measured the same day, it answers HTTP 403 to every server-side
  // request including its own published API. The condition is asserted below so that reviving the
  // domain and forgetting the child's list cannot both happen quietly.
  eq('the child roster is exactly the eight the owner named', sorted(minorArr), sorted([
    'islamqa.info', 'binbaz.org.sa', 'islamweb.net', 'alukah.net',
    'iifa-aifi.org', 'islamstory.com', 'ibn-jebreen.com', 'almosleh.com',
  ]));
  ok('dorar.net is on the child list ONLY if it was revived',
    minorArr.includes('dorar.net') === ((R.findSource('dorar.net') || {}).status === 'active'),
    'status=' + (R.findSource('dorar.net') || {}).status + ' onList=' + minorArr.includes('dorar.net'));
  // The Kuwaiti fallback stays a FALLBACK — not folded into the primary list, which is what keeps
  // a child's ordinary question costing one search rather than two.
  eq('the Kuwaiti fallback is still a separate tier', sorted(fallbackArr), ['eftaa.awqaf.gov.kw']);
  ok('...and is not duplicated into the primary child list', !minorArr.includes('eftaa.awqaf.gov.kw'));
  // Every child-list domain must be one the liveness measurement says can produce a citation.
  {
    const live = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'source-liveness.json'), 'utf8'));
    const byDomain = new Map(live.domains.map((r) => [r.domain, r]));
    const notLive = minorArr.filter((d) => (byDomain.get(d) || {}).status !== 'live-cites');
    eq('every domain on the child list was MEASURED able to produce a citation', notLive, []);
  }

  // No domain may appear twice inside one shipped array either.
  eq('SITES_ADULT has no repeated domain', adultArr.length, new Set(adultArr).size);
  ok('every SITES_ADULT entry is already normalised (no www., no scheme, no slash)',
    adultArr.every((d) => d === R.normalizeDomain(d)),
    JSON.stringify(adultArr.filter((d) => d !== R.normalizeDomain(d))));

  // =========================================================================
  console.log('\n=== B. NO DUPLICATION (the named pre-existing sources, and the nine) ===');

  // The brief names two sources as already present and forbids re-adding them.
  const islamstory = R.findSource('islamstory.com');
  ok('islamstory.com is present EXACTLY once', !!islamstory
    && R.SOURCES.filter((s) => s.domain === 'islamstory.com').length === 1);
  ok('islamstory.com appears once in SITES_ADULT', adultArr.filter((d) => d === 'islamstory.com').length === 1);

  // tafsir.app AND tafsir.net ARE TWO SOURCES, NOT ONE.
  //
  // The first batch established that they are different: tafsir.app is «الباحث القرآني», an
  // aggregator of ~50 classical tafsir books at /{book}/{surah}/{ayah}; tafsir.net is «مركز
  // تفسير للدراسات القرآنية», a research centre publishing original studies by named authors.
  // The second batch added the latter. These assertions are what stop the two from ever being
  // "deduplicated" into one row by somebody who reads only the first six characters.
  const tApp = R.findSource('tafsir.app');
  const tNet = R.findSource('tafsir.net');
  ok('tafsir.app IS registered', !!tApp);
  ok('tafsir.net IS registered', !!tNet);
  ok('they are two DIFFERENT rows', !!tApp && !!tNet && tApp !== tNet);
  ok('...with different ids', tApp.id !== tNet.id);
  ok('...different names', tApp.name !== tNet.name);
  ok('...different domains, and neither is a sub-domain of the other',
    tApp.domain !== tNet.domain
    && !R.hostMatches(tApp.domain, tNet.domain) && !R.hostMatches(tNet.domain, tApp.domain));
  // tafsir.net is on SITES_ADULT exactly once. tafsir.app was too until 2026-08-05, when it was
  // deferred for LIVENESS — 200, ~150 KB, empty <body>, zero extractable characters. The
  // distinction matters and is asserted rather than assumed: it did NOT lose its place because a
  // neighbour with a similar name arrived, which is exactly the confusion these checks exist to
  // prevent. Its row still stands, still says why, and re-admitting it is a one-word change.
  ok('tafsir.net appears exactly once in SITES_ADULT',
    adultArr.filter((d) => d === 'tafsir.net').length === 1);
  ok('tafsir.app is absent from SITES_ADULT because it is DEFERRED, not displaced',
    !adultArr.includes('tafsir.app') && tApp.status === 'deferred'
    && /مؤجَّل|2026-08-05/.test(String(tApp.note || '')),
    'status=' + tApp.status + ' note=' + String(tApp.note || '').slice(0, 60));
  ok('a lookup of one never returns the other',
    R.findSource('https://www.tafsir.net/articles/1') === tNet
    && R.findSource('https://tafsir.app/tabari/2/3') === tApp);
  ok('adding tafsir.net was not a duplicate: duplicateProblems() stays empty',
    R.duplicateProblems().length === 0, JSON.stringify(R.duplicateProblems()));

  // The nine, each accounted for.
  const NINE = [
    { n: 2, domain: 'saleh.af.org.sa', expect: 'active' },
    { n: 4, domain: 'shkhudheir.com', expect: 'blocked' },
    { n: 6, domain: 'khaledalsabt.com', expect: 'active' },
    { n: 7, domain: 'ibn-jebreen.com', expect: 'active' },
    { n: 10, domain: 'mostafaaladwy.com', expect: 'active' },
    { n: 11, domain: 'almunajjid.com', expect: 'active' },
    { n: 18, domain: 'eftaa.awqaf.gov.kw', expect: 'active' },
    { n: 28, domain: 'khutabaa.com', expect: 'active' },
    { n: 29, domain: 'salafcenter.org', expect: 'active' },
  ];
  NINE.forEach(({ n, domain, expect }) => {
    const rows = R.SOURCES.filter((s) => s.domain === domain);
    ok('#' + n + ' ' + domain + ': exactly one row', rows.length === 1, 'rows=' + rows.length);
    ok('#' + n + ' ' + domain + ': status ' + expect, rows.length === 1 && rows[0].status === expect,
      rows.length === 1 ? 'status=' + rows[0].status : '');
  });

  // #18 is a WIDENING, not an insertion: one row, now on two bands.
  const eftaa = R.findSource('eftaa.awqaf.gov.kw');
  ok('#18 eftaa: one row carrying BOTH bands (widened, not duplicated)',
    !!eftaa && eftaa.bands.includes('adult') && eftaa.bands.includes('minor-fallback'));
  ok('#18 eftaa: appears exactly once in SITES_ADULT',
    adultArr.filter((d) => d === 'eftaa.awqaf.gov.kw').length === 1);
  ok('#18 eftaa: the parent awqaf.gov.kw is NOT registered',
    R.SOURCES.every((s) => s.domain !== 'awqaf.gov.kw') && !adultArr.includes('awqaf.gov.kw'));

  // #4 is declared and refused. The point of keeping the row is that this can be PROVEN.
  const khudheir = R.findSource('shkhudheir.com');
  ok('#4 shkhudheir.com: on NO band list', !!khudheir && khudheir.bands.length === 0);
  ok('#4 shkhudheir.com: absent from every shipped array',
    !adultArr.includes('shkhudheir.com') && !minorArr.includes('shkhudheir.com') && !fallbackArr.includes('shkhudheir.com'));
  ok('#4 shkhudheir.com: allowed for NO purpose',
    R.PURPOSES.every((p) => R.sourceAllowsPurpose('shkhudheir.com', p) === false));
  ok('#4 shkhudheir.com: the refusal records its evidence', /parking|مركون|متوقف/i.test(String(khudheir && khudheir.note)));

  // existingSourceFor() is the check a future batch runs BEFORE adding anything.
  ok('existingSourceFor("https://www.islamstory.com/") finds the existing row',
    R.existingSourceFor('https://www.islamstory.com/') === islamstory);
  ok('existingSourceFor("brand-new-site.example") finds nothing',
    R.existingSourceFor('brand-new-site.example') === null);

  // =========================================================================
  console.log('\n=== C. SCOPE (a khutbah archive may not issue a fatwa) ===');

  // THE NON-REGRESSION INVARIANT, and the most important assertion in this file: a source that
  // predates the registry is narrowed by NOTHING, for ANY purpose. Scope filtering can only ever
  // remove a source that was admitted on condition of a scope.
  //
  // ── WHY THE LIST IS NOW IN TWO HALVES (2026-08-05) ──
  // Three of the original fifteen were DEFERRED for LIVENESS, which is a different fact from
  // scope and must not be allowed to look like one:
  //   ferkous.com  — the site moved to ferkous.app (302 on every path; the redirect lands on HTTP,
  //                  which canonical.js refuses). The material is still reachable, under the new
  //                  name, which is on the list below.
  //   tafsir.app   — 200 and ~150 KB with an empty <body>; zero extractable characters.
  //   dorar.net    — HTTP 403 for every server-side client, including its own published API.
  //
  // The assertion is NOT weakened by splitting it; it is made in both directions. Every still-live
  // legacy source must STILL be unnarrowed by every purpose (the original claim, unchanged), and
  // every deferred one must be refused for every purpose — because a domain that cannot answer
  // must not sit in a candidate list looking like coverage.
  const LEGACY_LIVE = ['islamweb.net', 'binbaz.org.sa', 'alukah.net', 'islamqa.info', 'sh-albarrak.com',
    'almosleh.com', 'islamstory.com', 'al-badr.net', 'othmanalkhamees.com', 'iifa-aifi.org',
    'ferkous.app', 'dr-mutlaq.com', 'eftaa.awqaf.gov.kw'];
  const LEGACY_DEFERRED = ['ferkous.com', 'tafsir.app', 'dorar.net'];
  const LEGACY = LEGACY_LIVE.concat(LEGACY_DEFERRED);
  eq('the fifteen pre-existing sources are all still registered', LEGACY.filter((d) => !R.findSource(d)), []);
  eq('...and none of them was deleted rather than deferred',
    LEGACY_DEFERRED.filter((d) => (R.findSource(d) || {}).status !== 'deferred'), []);
  for (const p of R.PURPOSES) {
    ok('purpose "' + p + '": not one of the LIVE legacy sources is dropped',
      LEGACY_LIVE.every((d) => R.sourceAllowsPurpose(d, p)),
      LEGACY_LIVE.filter((d) => !R.sourceAllowsPurpose(d, p)).join(', '));
    ok('purpose "' + p + '": every DEFERRED legacy source is refused',
      LEGACY_DEFERRED.every((d) => !R.sourceAllowsPurpose(d, p)),
      LEGACY_DEFERRED.filter((d) => R.sourceAllowsPurpose(d, p)).join(', '));
  }
  for (const p of R.PURPOSES) {
    const kept = R.filterSitesForPurpose(LEGACY_LIVE, p);
    eq('filterSitesForPurpose(live legacy, "' + p + '") is the identity', kept, LEGACY_LIVE);
  }

  // The five restrictions the brief spells out, each asserted as a refusal.
  ok('خالد السبت: NOT a source for a fatwa', !R.sourceAllowsPurpose('khaledalsabt.com', 'fatwa'));
  ok('خالد السبت: IS a source for tafsir', R.sourceAllowsPurpose('khaledalsabt.com', 'tafsir'));
  ok('ملتقى الخطباء: NOT a source for a fatwa', !R.sourceAllowsPurpose('khutabaa.com', 'fatwa'));
  ok('ملتقى الخطباء: IS a source for general/khutbah material', R.sourceAllowsPurpose('khutabaa.com', 'general'));
  ok('مركز سلف: NOT a source for a personal fatwa', !R.sourceAllowsPurpose('salafcenter.org', 'fatwa'));
  ok('مركز سلف: IS a source for creedal research', R.sourceAllowsPurpose('salafcenter.org', 'general'));
  ok('موقع المنجد: NOT a source for a fatwa (islamqa.info is the fatwa corpus)',
    !R.sourceAllowsPurpose('almunajjid.com', 'fatwa'));
  ok('صالح آل الشيخ: NOT a source for a fatwa (his fatwas are audio, no transcript)',
    !R.sourceAllowsPurpose('saleh.af.org.sa', 'fatwa'));
  ok('ابن جبرين: IS a source for a fatwa (a text fatwa library)',
    R.sourceAllowsPurpose('ibn-jebreen.com', 'fatwa'));
  ok('مصطفى العدوي: IS a source for a fatwa', R.sourceAllowsPurpose('mostafaaladwy.com', 'fatwa'));
  ok('إدارة الإفتاء الكويتية: IS a source for a fatwa', R.sourceAllowsPurpose('eftaa.awqaf.gov.kw', 'fatwa'));

  // Filtering the ADULT list for a ruling drops exactly the restricted ones and nothing else.
  ok('مركز تفسير: NOT a source for a fatwa', !R.sourceAllowsPurpose('tafsir.net', 'fatwa'));
  ok('مركز تفسير: NOT a source for hadith grading', !R.sourceAllowsPurpose('tafsir.net', 'hadith'));
  ok('مركز تفسير: IS a source for tafsir', R.sourceAllowsPurpose('tafsir.net', 'tafsir'));
  ok('مركز تفسير: IS a source for general study', R.sourceAllowsPurpose('tafsir.net', 'general'));
  ok('العباد: NOT a source for a personal fatwa', !R.sourceAllowsPurpose('al-abbaad.com', 'fatwa'));
  ok('العباد: NOT a source for tafsir (withheld for now)', !R.sourceAllowsPurpose('al-abbaad.com', 'tafsir'));
  ok('العباد: IS a source for hadith', R.sourceAllowsPurpose('al-abbaad.com', 'hadith'));
  ok('العباد: IS a source for general explanation', R.sourceAllowsPurpose('al-abbaad.com', 'general'));
  // ADDING tafsir.net NARROWED NOTHING, and that is still the claim being tested — it is now
  // tested on the source that is still live. tafsir.app serves no purpose today because it is
  // DEFERRED for liveness (see above), and its scopes were emptied by that deferral rather than by
  // the arrival of a neighbour; the assertion below pins the reason, not just the outcome.
  ok('tafsir.net keeps every scope it was admitted with (the neighbour narrowed nothing)',
    R.sourceAllowsPurpose('tafsir.net', 'tafsir') && R.sourceAllowsPurpose('tafsir.net', 'general'));
  ok('tafsir.app serves no purpose, and the reason recorded is DEFERRAL',
    R.PURPOSES.every((p) => !R.sourceAllowsPurpose('tafsir.app', p))
    && R.findSource('tafsir.app').status === 'deferred');

  const droppedForFatwa = adultArr.filter((d) => !R.filterSitesForPurpose(adultArr, 'fatwa').includes(d));
  eq('a fatwa query drops exactly the seven scope-restricted sources', sorted(droppedForFatwa),
    sorted(['saleh.af.org.sa', 'khaledalsabt.com', 'almunajjid.com', 'khutabaa.com',
      'salafcenter.org', 'tafsir.net', 'al-abbaad.com']));
  eq('a tafsir query keeps مركز تفسير and drops العباد',
    [R.filterSitesForPurpose(adultArr, 'tafsir').includes('tafsir.net'),
      R.filterSitesForPurpose(adultArr, 'tafsir').includes('al-abbaad.com')], [true, false]);
  eq('a hadith query keeps العباد and drops مركز تفسير',
    [R.filterSitesForPurpose(adultArr, 'hadith').includes('al-abbaad.com'),
      R.filterSitesForPurpose(adultArr, 'hadith').includes('tafsir.net')], [true, false]);
  eq('a general query drops nothing', R.filterSitesForPurpose(adultArr, 'general'), adultArr);
  ok('filtering preserves the shipped order', R.filterSitesForPurpose(adultArr, 'fatwa')
    .every((d, i, a) => i === 0 || adultArr.indexOf(a[i - 1]) < adultArr.indexOf(d)));
  ok('filterSitesForPurpose never returns an empty list', R.PURPOSES
    .every((p) => R.filterSitesForPurpose(adultArr, p).length > 0));
  ok('filterSitesForPurpose does not mutate its input', (() => {
    const before = adultArr.slice();
    R.filterSitesForPurpose(adultArr, 'fatwa');
    return JSON.stringify(before) === JSON.stringify(adultArr);
  })());
  // An unknown purpose must not silently narrow anything.
  eq('an unrecognised purpose is a no-op', R.filterSitesForPurpose(adultArr, 'nonsense'), adultArr);

  // =========================================================================
  console.log('\n=== D. PURPOSE CLASSIFIER (fixed corpus, no network, no model) ===');
  const CORPUS = [
    ['ما حكم صلاة المسافر؟', 'fatwa'],
    ['هل يجوز بيع الذهب بالتقسيط؟', 'fatwa'],
    ['حكم الطلاق في الغضب', 'fatwa'],
    ['ما حكم التعامل بالعملات الرقمية؟', 'fatwa'],
    ['امرأة أسقطت في الشهر الثاني فهل تصلي؟', 'fatwa'],
    ['ما معنى قوله تعالى إن مع العسر يسرا', 'tafsir'],
    ['ما سبب نزول سورة الكوثر', 'tafsir'],
    ['تدبر في سورة النصر', 'tafsir'],
    ['تخريج حديث إنما الأعمال بالنيات', 'hadith'],
    ['ما درجة الحديث الذي فيه ذكر الجمعة', 'hadith'],
    // EXPLAINING a hadith is a hadith question too. The first version of the classifier
    // inherited lib/source-intent.js's takhrij-only vocabulary, so every one of these came
    // out `general` — the hadith sources were never ranked first and the scope-restricted
    // general sources were never dropped.
    ['اشرح حديث إنما الأعمال بالنيات', 'hadith'],
    ['شرح حديث إنما الأعمال بالنيات', 'hadith'],
    ['ما معنى حديث إنما الأعمال بالنيات', 'hadith'],
    ['ما صحة حديث إنما الأعمال بالنيات', 'hadith'],
    ['حديث من موقع الشيخ عبدالمحسن العباد', 'hadith'],
    ['اذكر حديثًا عن النية', 'hadith'],
    // ...but «حديث» is also the ordinary adjective for "modern", and a bare trigger would
    // read a phone as a prophetic report. These must never leave `general`.
    ['هذا جهاز حديث', 'general'],
    ['حدثني عن التقنية الحديثة', 'general'],
    ['ما أحدث أخبار المشروع', 'general'],
    ['اشتريت هاتفًا حديثًا', 'general'],
    ['المسجد الحديث في المدينة', 'general'],
    ['التعليم الحديث في العالم العربي', 'general'],
    ['خطبة عن بر الوالدين', 'general'],
    ['خطبة الجمعة عن الصبر', 'general'],
    ['موعظة عن الموت', 'general'],
    ['شبهات الملاحدة حول الوعي', 'general'],
    ['من هو شيخ الإسلام ابن تيمية', 'general'],
    ['', 'general'],
  ];
  CORPUS.forEach(([q, want]) => eq('purpose(' + JSON.stringify(q.slice(0, 40)) + ')', P.classifyPurpose(q), want));
  ok('classifyPurpose is pure (same input, same answer)',
    CORPUS.every(([q]) => P.classifyPurpose(q) === P.classifyPurpose(q)));
  eq('purposeOfLastUserTurn reads the LAST user turn', P.purposeOfLastUserTurn([
    { role: 'user', content: 'خطبة عن الصبر' },
    { role: 'assistant', content: '...' },
    { role: 'user', content: 'ما حكم صلاة المسافر' },
  ]), 'fatwa');

  // =========================================================================
  console.log('\n=== E. THE URL GATE (refused before a byte is fetched) ===');
  const URLS = [
    // [url, expect a refusal?]
    ['https://saleh.af.org.sa/ar/ftawa', true],                               // audio index
    ['https://saleh.af.org.sa/ar/khotab', true],
    ['https://saleh.af.org.sa/sites/default/files/2018-01/x.mp3', true],       // the audio itself
    ['https://saleh.af.org.sa/ar/node/132', false],                            // a text page
    ['https://khutabaa.com/ar/forums/134701', true],                           // user discussion
    ['https://khutabaa.com/ar/khutub', true],                                  // listing
    ['https://khutabaa.com/ar/khutub?latest_posts=4', true],
    ['https://khutabaa.com/ar/article/%D8%BA%D8%B6-%D8%A7%D9%84%D8%A8%D8%B5%D8%B1', false],
    ['https://www.ibn-jebreen.com/textlibrary/6', true],                       // catalogue
    ['https://www.ibn-jebreen.com/indexs', true],
    ['https://www.ibn-jebreen.com/soundlibrary', true],
    ['https://www.ibn-jebreen.com/topics/%D8%A8%D9%8A%D8%B9-%D8%A7%D9%84%D8%AF%D8%AE%D8%A7%D9%86', false],
    ['https://mostafaaladwy.com/fatwa-category/%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D9%82/', true],
    ['https://mostafaaladwy.com/fatwa/178087/x/', false],
    ['https://salafcenter.org/category/x/', true],
    ['https://salafcenter.org/10872/', false],
    ['https://khaledalsabt.com/specials/532/x', true],                          // audio
    ['https://khaledalsabt.com/videos', true],
    ['https://khaledalsabt.com/interpretations/category/146/x', true],
    ['https://khaledalsabt.com/interpretations/2166/x', false],
    ['https://almunajjid.com/articles', true],
    ['https://almunajjid.com/speeches/lessons/790', false],
    ['https://islamqa.info/ar/answers/12345', false],                           // no rules => untouched
    ['https://islamweb.net/ar/fatwa/121485/x', false],

    // ── batch 2 ──────────────────────────────────────────────────────────────
    ['https://tafsir.net/', true],                                              // the home page
    ['https://tafsir.net/articles', true],                                      // section index
    ['https://tafsir.net/articles/24811', false],                               // the article
    ['https://tafsir.net/researches', true],
    ['https://tafsir.net/collection/656', true],                                // taxonomy
    ['https://tafsir.net/category/396', true],
    ['https://tafsir.net/authors/24813', true],                                 // author profile
    ['https://tafsir.net/search?q=%D8%AA%D9%81%D8%B3%D9%8A%D8%B1', true],       // robots-disallowed
    ['https://tafsir.net/user/login', true],
    ['https://tafsir.net/articles/page/2', true],                               // real pagination

    ['https://al-abbaad.com/', true],                                           // the home page
    ['https://al-abbaad.com/articles', true],                                   // index
    ['https://al-abbaad.com/articles/607420', false],                           // the article
    ['https://al-abbaad.com/lecture/hadith', true],                             // lesson catalogue
    ['https://al-abbaad.com/lecture/aqedah/kitab-attauhid', true],
    ['https://al-abbaad.com/books/book-titles', true],
    ['https://al-abbaad.com/sound/1234', true],                                 // audio, no transcript
  ];
  URLS.forEach(([u, refused]) => {
    const why = G.pathRefusal(u, '');
    ok((refused ? 'refuses ' : 'admits  ') + u.slice(0, 78), refused ? !!why : !why, 'got ' + JSON.stringify(why));
  });
  // ── RE-PINNED ON THE STRONGER CONDITION, AND THE ASSERTION IS KEPT ──────────
  //
  // This used to read «pathRefusal leaves an unregistered host completely alone», and that was
  // the defect: a reply cited «Home — موقع د. مطلق الجاسر», the site ROOT of dr-mutlaq.com, because
  // dr-mutlaq.com has no per-host rules and the root refusal sat behind the per-host lookup. So did
  // binbaz.org.sa's root, and every other allow-listed host without a rules entry.
  //
  // WHAT THE ASSERTION WAS ACTUALLY PROTECTING is that one site's rules may not leak onto another
  // — al-abbaad's `blocked` prefixes must not refuse a path on a host that never declared them.
  // That is pinned below, unchanged in force. What is no longer claimed is that a host with no
  // rules is exempt from the two refusals that were never about the host: its front page, and the
  // generic taxonomy shapes every CMS emits.
  ok('a host with no rules is still refused its SITE ROOT',
    G.pathRefusal('https://example.com/', '') === 'site-root'
    && G.pathRefusal('https://dr-mutlaq.com/', '') === 'site-root');
  ok('...and the generic index shapes, which are facts about the web and not about the host',
    /^generic-listing-path/.test(String(G.pathRefusal('https://example.com/category/anything', ''))));
  ok('...but NO per-host rule leaks onto it: its ordinary article path is admitted',
    G.pathRefusal('https://example.com/some/article-slug', '') === null
    && G.pathRefusal('https://example.com/sound/1234', '') === null);
  ok('pathRefusal reads the FINAL url when there is one',
    !!G.pathRefusal('https://example.com/x', 'https://khutabaa.com/ar/forums/1'));

  // =========================================================================
  console.log('\n=== F. THE PAGE GATE (fixtures built to the measured shapes) ===');

  // Every fixture below reproduces a structure OBSERVED on the live site on 2026-08-03.
  const F = {};
  F.aladwyAnswered = `<html><head><title>هل يعلم الميت بما يحدث لأهله من بعده ؟ | موقع الشيخ مصطفى العدوي</title></head><body>
    <nav><a href="/">الرئيسية</a><a href="/fatwa-category/x/">الفتاوى</a></nav>
    <div>مكتبة الفتوى رقم الفتوى: 178087</div>
    <h1>هل يعلم الميت بما يحدث لأهله من بعده ؟</h1><div>تم النشر في : يوليو 8, 2025</div>
    <div>السؤال</div><div>هل يعلم الميت بما يحدث لأهله من بعده ؟</div>
    <div>الإجابة</div><div>لا نعلم دليلاً صحيحاً على ذلك، والذي عليه أهل العلم التوقف فيه، والله تعالى أعلم.</div>
    <div>شارك الفتوى:</div>
    <footer>عن الموقع الموقع الرسمي لفضيلة الشيخ مصطفى العدوي، يحتوي على الفتاوى والمرئيات.</footer></body></html>`;
  F.aladwyEmpty = F.aladwyAnswered.replace(
    '<div>لا نعلم دليلاً صحيحاً على ذلك، والذي عليه أهل العلم التوقف فيه، والله تعالى أعلم.</div>', '');
  F.aladwyNoSheikh = F.aladwyAnswered.replace(/مصطفى العدوي/g, 'الموقع');

  // The live committee fatwa measured 1,324 characters and the live article 9,074, so the
  // fixtures are padded to the same order of magnitude: a fixture shorter than the pages it
  // stands for would be testing the length floor instead of the rule under test.
  const PAD = ' وينبغي للمسلم أن يتقي الله في أمره كله، وأن يسأل أهل العلم عما أشكل عليه، '
    + 'فإن الفتوى تتغير بتغير الحال والزمان والمكان، والله سبحانه وتعالى أعلم بالصواب.';
  const eftaaPage = (bodyText) => `<html><head><title>إدارة الإفتاء | فتوى</title></head><body>
    <div class="ms-rtestate-field">${bodyText}</div></body></html>`;
  const COMMITTEE = 'الحمد لله، وبعد: فقد عرض على هيئة الفتوى في اجتماعها المنعقد الاستفتاء المقدم، ونصه: '
    + 'ما حكم كذا وكذا من المسائل المستجدة التي يسأل عنها الناس في هذا الزمان؟ '
    + 'وقد أجابت الهيئة بالتالي: لا يجوز شرعاً ذلك، وعلى المسلم أن يتقي الله، والله تعالى أعلم، '
    + 'وصلى الله على نبينا محمد وعلى آله وصحبه وسلم، وهذا ما انتهت إليه الهيئة في جلستها.' + PAD.repeat(2);
  const PERSONAL = 'السؤال: ما قولكم في هذه المسألة؟ الجواب: الذي يظهر لي أن الأمر فيه سعة، '
    + 'وهذا رأيي والله أعلم. أجاب عنه فضيلة الشيخ الدكتور أحمد الحجي الكردي، عضو إدارة الإفتاء، '
    + 'وهو جواب شخصي لا يُعد قراراً رسمياً، وبالله التوفيق وهو الهادي إلى سواء السبيل.' + PAD.repeat(2);
  F.eftaaCommittee = eftaaPage(COMMITTEE);
  F.eftaaPersonal = eftaaPage(PERSONAL);
  F.eftaaBoth = eftaaPage(COMMITTEE + ' ' + PERSONAL);
  F.eftaaUnsigned = eftaaPage('الحمد لله وبعد: هذه مسألة يكثر السؤال عنها، والذي يظهر أن حكمها كذا وكذا، '
    + 'وينبغي للمسلم أن يحتاط لدينه في مثل هذه المسائل، والله تعالى أعلم بالصواب وإليه المرجع والمآب.'
    + PAD.repeat(3));

  const khutbah = (byline) => `<html><head><title>حر الصيف - ملتقى الخطباء</title></head><body>
    <div id="body" class="subject-content">${byline ? '<span class="by">' + byline + '</span>' : ''}
    <p>الخطبة الأولى: الحمد لله الذي أسبغ علينا إنعامه باطناً وظاهراً، وأشهد أن لا إله إلا الله وحده لا شريك له،
    شهادة تكون حجاباً من النار وستراً ساتراً، وأشهد أن نبينا محمداً عبده ورسوله، صلى الله عليه وعلى آله وصحبه وسلم
    تسليماً كثيراً. أما بعد: فاتقوا الله عباد الله، واعلموا أن حر الصيف يذكّر بحر النار، وأن في سقيا الماء أجراً
    عظيماً، فقد جاء في السنة الحث على سقي الماء والإحسان إلى الخلق، فأكثروا من الصدقة في هذه الأيام، وتذكروا
    يوماً تدنو فيه الشمس من الرؤوس، ولا ظل إلا ظله سبحانه.</p></div></body></html>`;
  F.khutbahNamed = khutbah('صلاح بن محمد البدير');
  F.khutbahAnonymous = khutbah('');

  const salaf = (categoryText, author) => `<html><head><title>مقال - مركز سلف للبحوث والدراسات</title>
    ${author ? '<meta name="author" content="' + author + '">' : ''}</head><body>
    <article><p>أولاً: مقدمة. إن أعظم قضية جاءت بها الرسل جميعاً هي توحيد الله سبحانه وتعالى، وقد تناول هذا
    المقال بيان المسألة من جهة الأدلة النقلية والعقلية، مع مناقشة ما أورده المخالفون من الشبه، وبيان وجه
    الحق فيها على منهج أهل السنة والجماعة، مع الإحالة إلى مصادر أهل العلم المعتبرة في هذا الباب، والله الموفق.</p>
    <p>${'ثانياً: تحرير محل النزاع. المسألة عند التحقيق ترجع إلى أصل مقرر عند أهل السنة، وقد نص على ذلك جماعة من المحققين، وبيانه أن الأدلة الشرعية متضافرة على تقرير هذا الأصل، وأن ما خالفه فمردود إلى قائله. '.repeat(3)}</p>
    <ul><li><i></i> <a href="https://salafcenter.org/category/x/" rel="category tag">${categoryText}</a></li></ul>
    </article></body></html>`;
  F.salafCentre = salaf('مقالات المشرف', 'مركز سلف');
  F.salafReaders = salaf('مشاركات القرّاء', 'مركز سلف');
  F.salafAnonymous = salaf('مقالات المشرف', '');

  const munajjid = (extra) => `<html><head><title>الموقع الرسمي للشيخ محمد صالح المنجد - أشجار القرآن</title></head><body>
    <div class="chrome"><a href="https://islamqa.info">الإسلام سؤال وجواب</a></div>
    <article><p>الخطبة الأولى: إن الحمد لله نحمده ونستعينه ونستغفره، ونعوذ بالله من شرور أنفسنا وسيئات أعمالنا،
    من يهده الله فلا مضل له، ومن يضلل فلا هادي له. أما بعد: فإن الله ضرب في كتابه الأمثال، وذكر الأشجار في
    مواضع كثيرة، ليدل عباده على قدرته وعظمته، وليأخذ المؤمن من ذلك عبرة وعظة في حياته وسلوكه ومعاملته للناس.</p>
    <p>${'أيها المسلمون: تأملوا في النخلة كيف ضرب الله بها المثل للكلمة الطيبة، أصلها ثابت وفرعها في السماء، تؤتي أكلها كل حين بإذن ربها، فكذلك المؤمن ثابت على دينه نافع لأهله ومجتمعه. '.repeat(3)}</p>
    ${extra || ''}</article></body></html>`;
  F.munajjidOwn = munajjid('');
  F.munajjidDeepLink = munajjid('<p>وينظر: <a href="https://islamqa.info/ar/answers/12345">جواب الموقع</a></p>');
  F.munajjidReprint = munajjid('<p>المصدر: موقع الإسلام سؤال وجواب.</p>');

  F.khaledTafsir = `<html><head><title>سورة النصر كاملة - الموقع الرسمي للشيخ خالد السبت</title></head><body>
    <article><p>${'بسم الله الرحمن الرحيم، الحمد لله رب العالمين، وصلى الله وسلم على نبينا محمد. يقول ابن كثير رحمه الله في تفسير هذه السورة الكريمة ما حاصله أن الله بشّر نبيه بالفتح والنصر، وأمره عند ذلك بالتسبيح والاستغفار. '.repeat(4)}</p></article></body></html>`;
  F.khaledThin = `<html><head><title>صفحة - خالد السبت</title></head><body><p>نص قصير جداً.</p></body></html>`;
  F.khaledIndexish = `<html><head><title>قائمة</title></head><body><div>${
    Array.from({ length: 60 }, (_, i) => `<a href="/interpretations/${i}/x">الدرس رقم ${i} من سلسلة التفسير</a>`).join(' ')
  }<p>مقدمة قصيرة.</p></div></body></html>`;

  // Drive the gate exactly the way lib/retrieve.js drives it.
  // `content` names the element Readability WOULD have isolated. Passing it matters: the
  // chrome-vs-content distinction is real, and a fixture that hands the gate the navigation
  // bar as if it were the article is testing a situation retrieval does not produce. It is
  // exactly what made the almunajjid case look broken when it was not — his site links to
  // islamqa.info from every page's chrome, and the reprint test reads the ARTICLE.
  function gate(html, url, { usedReadability = true, byline = null, text = null, title = null, content = null } = {}) {
    const { document: doc } = parseHTML(html);
    const collapse = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    let body = doc.body ? doc.body.cloneNode(true) : null;
    if (body) for (const el of body.querySelectorAll('script,style')) el.remove();
    let extracted = collapse(body ? body.textContent : '');
    if (content) {
      const el = doc.querySelector(content);
      extracted = collapse(el ? el.textContent : '');
    }
    const bylineNode = doc.querySelector('span.by');
    const extractedByline = byline === null
      ? collapse(bylineNode ? bylineNode.textContent : '') : byline;
    return G.gateSourcePage({
      url, finalUrl: url, doc,
      title: title === null ? collapse(doc.title) : title,
      text: text === null ? extracted : text,
      usedReadability, byline: extractedByline,
    });
  }
  const AL = 'https://mostafaaladwy.com/fatwa/178087/x/';
  const EF_F = 'https://eftaa.awqaf.gov.kw/ar/%D8%AC%D8%AF%D9%8A%D8%AF%20%D8%A7%D9%84%D9%81%D8%AA%D8%A7%D9%88%D9%89/y-4822';
  const EF_A = 'https://eftaa.awqaf.gov.kw/ar/%D9%85%D9%82%D8%A7%D9%84%D8%A7%D8%AA/y-4521';
  const KH = 'https://khutabaa.com/ar/article/x';
  const SC = 'https://salafcenter.org/10872/';
  const MU = 'https://almunajjid.com/speeches/lessons/790';
  const KS = 'https://khaledalsabt.com/interpretations/2166/x';

  // (1) a matching page comes back whole — title, author, url and TEXT preserved.
  let g = gate(F.aladwyAnswered, AL, { usedReadability: false });
  ok('العدوي: a published answer is admitted', g.ok, g.note);
  ok('العدوي: the ANSWER text is what is carried, not the chrome',
    g.ok && g.text.includes('الإجابة:') && g.text.includes('التوقف فيه') && !g.text.includes('عن الموقع'), g.ok ? g.text : '');
  ok('العدوي: the question is preserved alongside it', g.ok && g.text.includes('السؤال:'));
  eq('العدوي: the shaykh is named as the author', g.ok && g.author, 'الشيخ مصطفى العدوي');
  eq('العدوي: attribution type', g.ok && g.attributionType, 'scholar');

  // (2)/(3) a page with no published answer is refused — the measured /fatwa/178116 shape.
  g = gate(F.aladwyEmpty, AL, { usedReadability: false });
  ok('العدوي: a fatwa page whose answer field is EMPTY is refused', !g.ok && /no-published-answer/.test(g.note), JSON.stringify(g));
  g = gate(F.aladwyNoSheikh, AL, { usedReadability: false });
  ok('العدوي: an answer that does not establish the shaykh is refused', !g.ok, JSON.stringify(g));

  // (4) the Kuwait split — the brief's named requirement.
  g = gate(F.eftaaCommittee, EF_F);
  ok('الكويت: a page proving BOTH presentation and committee answer is admitted', g.ok, g.note);
  eq('الكويت: it is labelled as the committee', g.ok && g.attributionType, 'Kuwait Fatwa Committee');
  g = gate(F.eftaaPersonal, EF_F);
  ok('الكويت: a personal answer is admitted but NOT as the committee', g.ok, g.note);
  eq('الكويت: it is labelled as al-Kurdi personally', g.ok && g.attributionType, 'Personal answer — Ahmad Al-Kurdi');
  ok('الكويت: the personal label names him', g.ok && /الكردي/.test(g.author));
  g = gate(F.eftaaBoth, EF_F);
  ok('الكويت: a page carrying BOTH signatures is REFUSED, not guessed at',
    !g.ok && /attribution-indeterminate/.test(g.note), JSON.stringify(g));
  g = gate(F.eftaaUnsigned, EF_F);
  ok('الكويت: an unsigned page in a FATWA section is refused', !g.ok, JSON.stringify(g));
  g = gate(F.eftaaUnsigned, EF_A);
  ok('الكويت: the same page in the ARTICLES section is a departmental publication', g.ok, g.note);
  eq('الكويت: and is labelled as such', g.ok && g.attributionType, 'department publication');

  // (5) khutabaa — author required, forums refused.
  ok('الخطباء: the named fixture executes its <span class="by"> branch',
    F.khutbahNamed.includes('<span class="by">صلاح بن محمد البدير</span>')
    && !F.khutbahAnonymous.includes('<span class="by">'));
  g = gate(F.khutbahNamed, KH);
  ok('الخطباء: a khutbah with a named khatib is admitted', g.ok, g.note);
  eq('الخطباء: the khatib is preserved', g.ok && g.author, 'صلاح بن محمد البدير');
  eq('الخطباء: attribution type', g.ok && g.attributionType, 'khatib');
  g = gate(F.khutbahAnonymous, KH);
  ok('الخطباء: an anonymous khutbah is refused', !g.ok && /attribution-indeterminate/.test(g.note), JSON.stringify(g));
  g = gate(F.khutbahAnonymous.replace('<div id="body" class="subject-content">',
    '<div id="body" class="subject-content">الفريق العلمي '), KH);
  ok('الخطباء: the site\'s own scientific team counts as an author', g.ok, g.note);

  // (6) salafcenter — reader submissions refused by the site's own badge.
  g = gate(F.salafCentre, SC);
  ok('مركز سلف: the centre\'s own research is admitted', g.ok, g.note);
  eq('مركز سلف: the centre is preserved as the author', g.ok && g.author, 'مركز سلف');
  g = gate(F.salafReaders, SC);
  ok('مركز سلف: «مشاركات القرّاء» is refused even at an identical URL shape',
    !g.ok && /attribution-indeterminate/.test(g.note), JSON.stringify(g));
  g = gate(F.salafAnonymous, SC);
  ok('مركز سلف: an article with no named author or centre is refused', !g.ok, JSON.stringify(g));

  // (7) almunajjid — reprints refused, his own material kept, islamqa never duplicated.
  g = gate(F.munajjidOwn, MU, { content: 'article' });
  ok('المنجد: his own khutbah is admitted despite the site-wide islamqa nav link', g.ok, g.note);
  eq('المنجد: attributed to him', g.ok && g.author, 'الشيخ محمد صالح المنجد');
  g = gate(F.munajjidDeepLink, MU, { content: 'article' });
  ok('المنجد: a page linking to a SPECIFIC islamqa.info answer is refused (no duplication)',
    !g.ok, JSON.stringify(g));
  g = gate(F.munajjidReprint, MU, { content: 'article' });
  ok('المنجد: a page that names another source as its origin is refused', !g.ok, JSON.stringify(g));

  // (8) khaledalsabt — thin and index-shaped pages refused.
  g = gate(F.khaledTafsir, KS);
  ok('خالد السبت: a tafsir page is admitted', g.ok, g.note);
  g = gate(F.khaledThin, KS);
  ok('خالد السبت: a thin page is refused', !g.ok && /thin-page/.test(g.note), JSON.stringify(g));
  g = gate(F.khaledIndexish, 'https://khaledalsabt.com/interpretations/9999/x', { usedReadability: false });
  ok('a link-heavy page that slipped past the path rules is refused by shape',
    !g.ok && /index-page-link-density/.test(g.note), JSON.stringify(g));

  // ── batch 2: مركز تفسير and العباد ─────────────────────────────────────────
  // The tafsir.net fixtures reproduce the two signals the live site declares: og:type on
  // every node, and the «الكاتب:» label sitting beside the writer's own /authors/ link.
  const TAFSIR_BODY = 'تتناول هذه المقالة المؤثرات الفكرية التي أسهمت في نشأة اتجاه الإعجاز العلمي '
    + 'في القرآن الكريم وتطوّره، وتعرض أبرز المحطات التي كان لها أثر ظاهر فيه، مع بيان موقف المفسرين '
    + 'المتقدمين من هذا الباب، ومناقشة ما استُدل به من الآيات، وتحرير محل النزاع في المسألة. ';
  const tafsirPage = (ogType, byline, bodyRepeat) => `<html><head>
    <title>المؤثرات الفكرية على الإعجاز العلمي | مركز تفسير للدراسات القرآنية</title>
    <meta property="og:type" content="${ogType}" /></head><body>
    <nav><a href="/articles">مقالات</a><a href="/researches">بحوث</a><a href="/collection/656">مقالات عامة</a></nav>
    <div class="node-title h3"><p>المؤثرات الفكرية على الإعجاز العلمي (2-2)</p></div>
    ${byline ? '<p class="text-secondary"><strong>الكاتب:</strong> <a href="/authors/24797"> ' + byline + ' </a></p>' : ''}
    <div class="share"><a href="#">0</a><a href="#">تحميل</a><a href="#">مشاركة</a><a href="#">مسح رمز QR</a></div>
    <article><p>${TAFSIR_BODY.repeat(bodyRepeat)}</p></article>
    <aside><a href="/authors/24813">محمد السيد عليّ بلاسي</a><a href="/authors/24800">كاتب آخر</a></aside>
    </body></html>`;
  const TN = 'https://tafsir.net/articles/24811';

  // (1) a real tafsir article is admitted, and the author comes back CLEAN.
  g = gate(tafsirPage('article', 'جمال الدين عبد العزيز الشريف', 14), TN, { content: 'article' });
  ok('مركز تفسير: a tafsir article is admitted', g.ok, g.note);
  eq('مركز تفسير: the author is the labelled one, with no toolbar text welded on',
    g.ok && g.author, 'جمال الدين عبد العزيز الشريف');
  eq('مركز تفسير: attribution type', g.ok && g.attributionType, 'researcher');
  ok('مركز تفسير: the sidebar authors of RELATED articles are not mistaken for the byline',
    g.ok && !/بلاسي/.test(g.author));

  // (2) a research paper with a named author is admitted.
  g = gate(tafsirPage('research', 'عثمان بن عليّ بندو', 14), 'https://tafsir.net/researchs/24780', { content: 'article' });
  ok('مركز تفسير: a research paper with an author is admitted', g.ok, g.note);
  eq('مركز تفسير: its author is preserved', g.ok && g.author, 'عثمان بن عليّ بندو');

  // (3)/(4) the home page, the indexes, the taxonomies and search are refused by URL alone.
  ok('مركز تفسير: the home page is refused', !!G.pathRefusal('https://tafsir.net/', ''));
  ok('مركز تفسير: a category listing is refused', !!G.pathRefusal('https://tafsir.net/category/396', ''));
  ok('مركز تفسير: a collection listing is refused', !!G.pathRefusal('https://tafsir.net/collection/656', ''));
  ok('مركز تفسير: the search page is refused (and the site disallows it in robots.txt)',
    !!G.pathRefusal('https://tafsir.net/search?q=x', ''));

  // (5) no author shown => no card. The brief's «أي صفحة لا يظهر فيها صاحب المادة».
  g = gate(tafsirPage('article', '', 14), TN, { content: 'article' });
  ok('مركز تفسير: an article with no named author is refused',
    !g.ok && /attribution-indeterminate/.test(g.note), JSON.stringify(g));

  // an author BIOGRAPHY page is not an article, whatever path it is reached by
  g = gate(tafsirPage('author', 'محمد السيد عليّ بلاسي', 14), TN, { content: 'article' });
  ok('مركز تفسير: an author profile page is refused even at an article URL',
    !g.ok, JSON.stringify(g));
  ok('مركز تفسير: ...and /authors/{id} is refused by URL too',
    !!G.pathRefusal('https://tafsir.net/authors/24813', ''));

  // a page whose real body is a PDF download: too little text to stand on
  g = gate(tafsirPage('research', 'عثمان بن عليّ بندو', 1), 'https://tafsir.net/researchs/24780', { content: 'article' });
  ok('مركز تفسير: a PDF-stub research page is refused for want of text',
    !g.ok && /thin-page/.test(g.note), JSON.stringify(g));

  // (8) a redirect off the domain: the row does not vouch for another host.
  ok('مركز تفسير: a look-alike host resolves to no row',
    R.findSource('tafsir.net.evil.com') === null && R.findSource('evil-tafsir.net') === null);
  g = gate(tafsirPage('article', 'جمال الدين عبد العزيز الشريف', 14), 'https://evil.example/x', { content: 'article' });
  ok('مركز تفسير: the same page served from another host gets no tafsir.net treatment',
    g.ok && g.author === '' && g.attributionType === '');

  // ── العباد ─────────────────────────────────────────────────────────────────
  const ABBAAD_BODY = 'الحمد لله والصلاة والسلام على رسول الله، أما بعد: فإن من أعظم ما يعتني به طالب '
    + 'العلم معرفة أحوال الرواة وطرق التحمل والأداء، وقد جاء في السنة ما يدل على فضل العناية بالحديث '
    + 'وحفظه وتبليغه، وهذا مما ينبغي أن يُعتنى به في هذا الزمان. ';
  const abbaadPage = (namePresent, bodyRepeat, sidebarOnly) => `<html><head>
    <title>من ذكرياتي عن الشيخ أبي بكر الجزائري - الموقع الرسمي</title></head><body>
    <nav><a href="/articles">المقالات</a><a href="/lecture/hadith">الدروس</a><a href="/books">الكتب</a></nav>
    ${sidebarOnly ? '<aside>' + Array.from({ length: 40 }, (_, i) => `<a href="/lecture/x${i}">شرح سنن أبي داود الدرس ${i}</a>`).join(' ') + '</aside>' : ''}
    <article><h1>من ذكرياتي عن الشيخ أبي بكر الجزائري رحمه الله</h1>
    <p>${ABBAAD_BODY.repeat(bodyRepeat)}</p></article>
    <footer>${namePresent ? 'جميع الحقوق محفوظة للموقع الرسمي عبد المحسن بن حمد العباد' : 'جميع الحقوق محفوظة'}</footer>
    </body></html>`;
  const AB = 'https://al-abbaad.com/articles/607420';

  // (1)/(2) a single article is admitted and its body is what is carried.
  g = gate(abbaadPage(true, 4, false), AB, { content: 'article' });
  ok('العباد: a single article page is admitted', g.ok, g.note);
  eq('العباد: attributed to the shaykh', g.ok && g.author, 'الشيخ عبد المحسن بن حمد العباد');
  ok('العباد: the article body is carried, not the navigation',
    g.ok && g.text.includes('طالب العلم') && !g.text.includes('شرح سنن أبي داود'), g.ok ? g.text.slice(0, 90) : '');

  // (3)/(4)/(5) indexes, lesson catalogues and untranscribed audio are refused by URL.
  ok('العباد: the articles index is refused', !!G.pathRefusal('https://al-abbaad.com/articles', ''));
  ok('العباد: the lesson catalogue is refused', !!G.pathRefusal('https://al-abbaad.com/lecture/hadith', ''));
  ok('العباد: audio with no transcript is refused', !!G.pathRefusal('https://al-abbaad.com/sound/12', ''));
  ok('العباد: the book shelf is refused', !!G.pathRefusal('https://al-abbaad.com/books/book-titles', ''));
  ok('العباد: the home page is refused', !!G.pathRefusal('https://al-abbaad.com/', ''));

  // (6) a page with no body of its own
  g = gate(abbaadPage(true, 0, false), AB, { content: 'article' });
  ok('العباد: a page with no article body is refused', !g.ok && /thin-page/.test(g.note), JSON.stringify(g));

  // ...and one whose only text is the sidebar, when Readability cannot isolate a body
  g = gate(abbaadPage(true, 0, true), 'https://al-abbaad.com/articles/999999', { usedReadability: false });
  ok('العباد: a page whose text cannot be separated from the sidebar is refused',
    !g.ok, JSON.stringify(g));

  // the page must establish it IS his official site
  g = gate(abbaadPage(false, 4, false), AB, { content: 'article' });
  ok('العباد: a page that does not establish the official site is refused',
    !g.ok && /attribution-indeterminate/.test(g.note), JSON.stringify(g));

  // (9) the site being down ends with no card and no claim
  g = gate('<html><head><title>خطأ</title></head><body></body></html>', AB);
  ok('العباد: an empty/broken response yields no card', !g.ok, JSON.stringify(g));
  g = gate('<html><body><h1>503 Service Unavailable</h1></body></html>', TN, { usedReadability: false });
  ok('مركز تفسير: a 503 body yields no card', !g.ok, JSON.stringify(g));

  // (9) an unregistered host is untouched by all of this — the fifteen keep their behaviour.
  g = gate(F.khaledTafsir, 'https://islamweb.net/ar/fatwa/121485/x');
  ok('a source with no page rules passes through unchanged', g.ok && g.author === '' && g.attributionType === '');

  // (10) a site that is down or serves nothing cannot become a card.
  g = gate('<html><head><title>خطأ</title></head><body></body></html>', KH);
  ok('an empty document is refused (a broken site invents nothing)', !g.ok, JSON.stringify(g));
  g = gate('<html><body><h1>404</h1></body></html>', AL, { usedReadability: false });
  ok('a 404 body is refused', !g.ok, JSON.stringify(g));

  // visibleText must not count the site's JavaScript as content — the defect that let a
  // 847-character page look like a 10,180-character one.
  {
    const { document: doc } = parseHTML(
      '<html><body><script>' + 'x'.repeat(5000) + '</script><p>نص قصير مرئي.</p></body></html>');
    ok('visibleText ignores <script> bodies', G.visibleText(doc).length < 100, String(G.visibleText(doc).length));
  }

  // =========================================================================
  console.log('\n=== G. THE TWO NAMED REGRESSIONS ===');
  const A = await esm('lib/attribution.js');
  const C = await esm('lib/claim-gate.js');
  const user = (t) => [{ role: 'user', content: t }];

  // (1) «ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟»
  const q80 = 'ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟';
  const d80 = A.detectAttribution(user(q80));
  ok('80-day: the attribution gate still fires', d80.attributed);
  ok('80-day: it still resolves to Ibn Uthaymeen', !!d80.scholar && d80.scholar.key === 'ibn-uthaymeen');
  eq('80-day: with NO source the reply is refused', A.verifyAttributedReply('الدم نفاس فتترك الصلاة.', d80, []).ok, false);
  // A source from one of the NEW domains must not be able to stand in for his corpus.
  const foreign = [{ scholar: 'ملتقى الخطباء', title: 'خطبة', exactText: 'كلام عام',
    canonicalUrl: 'https://khutabaa.com/ar/article/x' }];
  eq('80-day: a page by somebody else cannot back the attribution',
    A.verifyAttributedReply('قال الشيخ ...', d80, foreign).problems.includes('source-not-by-named-scholar'), true);
  // The correct page still passes the period test; a page about a different period does not.
  const rightPage = [{ scholar: 'محمد بن صالح العثيمين', title: 'ضابط السقط الذي تترك المرأة لأجله الصلاة',
    exactText: 'إذا سقط الجنين قبل ثمانين يوماً فإنه ليس بنفاس ولا حيض، وإنما هو دم فساد، فتصلي وتصوم.',
    canonicalUrl: 'https://binothaimeen.net/ar/voice_library/lessonDetails/a/b/c' }];
  {
    const faithful = 'السقط قبل ثمانين يوماً ليس بنفاس ولا حيض، وإنما هو دم فساد، فتصلي وتصوم.';
    const verdict = A.verifyAttributedReply(faithful, d80, rightPage);
    ok('80-day: the matching page + a faithful reply is accepted', verdict.ok, JSON.stringify(verdict.problems));
  }
  ok('80-day: the INVERTED reply is still refused against the same page',
    !A.verifyAttributedReply('هي نفساء فتترك الصلاة والصوم.', d80, rightPage).ok);
  // The adapter is still what serves Ibn Uthaymeen, and it is still tried FIRST. The
  // `key === 'ibn-uthaymeen'` test moved into lib/ask-plan.js as `hasDirectAdapter`, so the
  // assertion follows it there rather than pinning a line api/ask.js no longer contains.
  ok('80-day: the attributed route is still served by the binothaimeen adapter, tried first',
    /retrieveIbnUthaymeen/.test(askSrc) && /if \(plan\.hasDirectAdapter\)/.test(askSrc));
  ok('80-day: hasDirectAdapter is still decided by the scholar registry key',
    /attribution\.scholar && attribution\.scholar\.key === 'ibn-uthaymeen'/
      .test(read('lib/ask-plan.js')));
  // And the guarantee that matters regardless of routing: an attributed answer may only rest
  // on a source the verifier accepted as HIS.
  ok('80-day: an attributed answer still requires a source by the named scholar',
    /verifyAttributedReply\(draft, attribution, attributedSources\)/.test(askSrc));
  ok('80-day: no new domain was added to lib/attribution.js SCHOLARS',
    A.SCHOLARS.length === 1 && A.SCHOLARS[0].host === 'binothaimeen.net');

  // (2) «حكم قول يا معطي لا تبطي»
  const qm = 'ما حكم قول يا معطي لا تبطي؟';
  const subj = C.detectSubjectInThread(user(qm));
  ok('يا معطي: the specific expression is still detected', subj.specific && /معطي/.test(subj.subject));
  const qmAttribution = A.detectAttribution(user(qm));
  ok('يا معطي: it is still not mistaken for a scholar\'s name',
    !qmAttribution.attributed && qmAttribution.mode === 'none' && qmAttribution.scholarName === '',
    JSON.stringify(qmAttribution));
  const general = [{ title: 'الدعاء بأسماء الله الحسنى', url: 'https://islamweb.net/ar/fatwa/121485/x',
    passage: 'يجوز الدعاء بأسماء الله الحسنى، وهو من أفضل الدعاء، ولا حرج في ذلك.' }];
  const v = C.verifyClaims('هذه العبارة مستحبة ومن أفضل الدعاء.', subj, general);
  ok('يا معطي: a specific verdict on a general source is still refused',
    !v.ok && v.problems.some((p) => /specific-verdict-without-matching-source/.test(p)), JSON.stringify(v.problems));
  // And a page from one of the NEW hosts that never names the phrase is no better.
  const newHostPage = [{ title: 'خطبة في الدعاء', url: 'https://khutabaa.com/ar/article/x',
    passage: 'الدعاء عبادة عظيمة، وينبغي للمسلم أن يلح على ربه، وأن يحسن الظن به سبحانه.' }];
  eq('يا معطي: a NEW-source page that never mentions the phrase does not address it',
    C.sourcesAddressingSubject(subj.subject, newHostPage), []);
  ok('يا معطي: and a verdict resting on it is still refused',
    !C.verifyClaims('هذه العبارة مشروعة ولا بأس بها.', subj, newHostPage).ok);
  ok('يا معطي: a fabricated hadith is still refused',
    C.hadithProblems('قال رسول الله صلى الله عليه وسلم: «يا معطي لا تبطي فإن العطاء من الله» رواه الترمذي وصححه الألباني.', general).length > 0);
  ok('يا معطي: the refusal itself asserts no ruling',
    !/مستحب|بدعة|حرام|يجوز/.test(C.CLAIM_REFUSAL.replace('لا أجزم بحكم خاص', '')));

  // =========================================================================
  console.log('\n=== H. NO RAW SOURCE TAG REACHES A READER ===');
  const stripCount = (askSrc.match(/replace\(\/<source\\b\[\^>\]\*>\[\\s\\S\]\*\?<\\\/source>\/gi, ''\)/g) || []).length;
  ok('api/ask.js strips model-written <source> pairs on every buffered branch', stripCount >= 3, 'found ' + stripCount);
  ok('api/ask.js strips a DANGLING <source with no close', /<source\\b\[\^>\]\*>\?\[\\s\\S\]\*\$/.test(askSrc));
  ok('the streaming branch uses createSourceFilter (tag removal across chunk boundaries)',
    /createSourceFilter\(\)/.test(askSrc) && /filter\.push\(evt\.delta\.text\)/.test(askSrc));
  {
    // The filter's contract, exercised across an adversarial split.
    const { createSourceFilter } = await esm('lib/route-classify.js');
    const input = 'قبل <source site="khutabaa.com" url="https://khutabaa.com/ar/article/x">خطبة</source> بعد';
    for (const chunk of [1, 3, 7, 13]) {
      const f = createSourceFilter();
      let out = '';
      for (let i = 0; i < input.length; i += chunk) out += f.push(input.slice(i, i + chunk));
      out += f.end();
      ok('createSourceFilter removes the tag at chunk size ' + chunk, out === 'قبل  بعد', JSON.stringify(out));
    }
  }
  {
    const { buildSourceTag } = await esm('api/ask.js').catch(() => ({}));
    if (typeof buildSourceTag === 'function') {
      ok('buildSourceTag refuses a non-https url', buildSourceTag({ url: 'http://khutabaa.com/x', title: 'a' }) === null);
      ok('buildSourceTag refuses javascript:', buildSourceTag({ url: 'javascript:alert(1)', title: 'a' }) === null);
      const t = buildSourceTag({ url: 'https://www.khutabaa.com/ar/article/x', title: 'خطبة <b>' });
      ok('buildSourceTag folds www. and neutralises angle brackets',
        !!t && t.host === 'khutabaa.com' && !/[<>]/.test(t.tag.replace(/^<source[^>]*>|<\/source>$/g, '')), JSON.stringify(t));
    } else {
      ok('api/ask.js exports buildSourceTag for inspection', false, 'not exported');
    }
  }

  // =========================================================================
  console.log('\n=== I. THE WIRING (read off the shipped modules) ===');
  ok('retrieve.js imports the registry filter', /from '\.\/source-registry\.js'/.test(retrieveSrc));
  ok('retrieve.js imports the purpose classifier', /from '\.\/source-purpose\.js'/.test(retrieveSrc));
  ok('retrieve.js imports the page gates', /from '\.\/source-page-gates\.js'/.test(retrieveSrc));
  ok('retrieve() computes a purpose and scopes EVERY tier with it',
    /const purpose = classifyPurpose\(query\)/.test(retrieveSrc)
    && /rawTiers\.map\(\(t\) => filterSitesForPurpose\(t, purpose\)\)/.test(retrieveSrc));
  ok('the targeted pass consults the SCOPED list, not the raw one',
    /const bandList = tiers\[0\]/.test(retrieveSrc));
  ok('fetchAndClean applies the page gate before returning text',
    /if \(hasPageRules\(finalUrl \|\| url\)\)/.test(retrieveSrc) && /gateSourcePage\(\{/.test(retrieveSrc));
  ok('a refused page returns EMPTY text (it can never become a passage)',
    /if \(!gated\.ok\) return \{ title, text: '', rawLen, note: gated\.note, finalUrl \};/.test(retrieveSrc));
  ok('candidates are path-refused BEFORE the fetch', /const why = pathRefusal\(r\.link, ''\)/.test(retrieveSrc));
  ok('the FINAL post-redirect host is still enforced against the band list',
    /if \(!hostAllowed\(finalHost, allowSites\)\)/.test(retrieveSrc));
  // A THIN PAGE IS STILL REFUSED — the claim is unchanged; what changed is which number counts.
  // The flat 200 was overriding floors that lib/source-page-gates.js declares per host, and the
  // measured casualty was mostafaaladwy.com: it declares `minText: 20`, its /fatwa/49996 extracts
  // to 110 characters of real question-and-answer, and the flat comparison threw it away after it
  // had cleared its own host's gate. The floor is now the declared one where there is one, and 200
  // where there is not — and it is asserted in BOTH directions below.
  ok('a page under the EFFECTIVE floor is still refused',
    /if \(text\.length < floor\)/.test(retrieveSrc));
  ok('...the generic default is still 200 for a host that declares nothing',
    /GENERIC_MIN_TEXT = 200/.test(retrieveSrc));
  ok('...and a host\'s own declaration is what governs when it made one',
    /const declared = declaredMinText\(/.test(retrieveSrc)
    && /declared === null \? GENERIC_MIN_TEXT : declared/.test(retrieveSrc));
  ok('retrieval still degrades to NO_SOURCE_TEXT with an empty sources array',
    /return \{ text: NO_SOURCE_TEXT, sources: \[\] \};/.test(retrieveSrc));
  ok('the source object carries author + attributionType', /attributionType: k\.attributionType/.test(retrieveSrc));
  ok('api/ask.js still refuses to answer when no verified source came back',
    /NO_VERIFIED_SOURCE_MESSAGE/.test(askSrc));
  ok('gates.json lists this guard', /source-registry-guard\.cjs/.test(read('gates.json')));

  // =========================================================================
  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('source-registry-guard CRASHED:', e && e.stack || e);
  process.exit(1);
});
