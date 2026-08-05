// guards/floors-and-filters-guard.cjs — steps 6, 7 and 8 of batch 2.
//
// THREE SMALL DEFECTS, EACH MEASURED, EACH WITH THE SAME SHAPE: a default quietly overriding a
// declaration somebody made on purpose.
//
// ── 6. A DECLARED minText IS THE FLOOR, NOT A SUGGESTION ─────────────────────
// mostafaaladwy.com declares `minText: 20` in lib/source-page-gates.js, because its fatwas are
// genuinely short — MEASURED from its own sitemap on 2026-08-05, /fatwa/49996 extracts to 110
// characters of real question-and-answer: «السؤال: هل يوجد كتاب خاص بالقصص القرآني؟ الإجابة: نعم
// هناك كتب، منها كتاب ابن كثير…». That is a complete, published, citable answer.
//
// The page cleared its own host's gate at 20 and was then thrown away by lib/retrieve.js's GENERIC
// 200-character floor. So the host's declaration bought nothing, and the site looked like a broken
// extractor when the extractor was working perfectly. The 200 is a DEFAULT for hosts that declare
// nothing; it may not sit above a floor a host declared for itself.
//
// ── 7. AN EMPTY LIST AFTER FILTERING STAYS EMPTY ─────────────────────────────
// filterSitesForPurpose() fell back to the UNFILTERED list whenever filtering emptied it. The
// comment said it could never happen. MEASURED: filterSitesForPurpose(SITES_GENERAL, 'fatwa')
// returned all four news domains — every one of which carries `scopes: []` precisely so that a
// news page can never back a ruling. A safety valve that returns exactly what the rule forbids is
// not a safety valve.
//
// ── 8. ASK_GLOBAL_DAY IS A NUMBER SOMEBODY CAN SET ───────────────────────────
// A hard-coded 800, derived for twenty closed testers, on an app that is now open. It is the
// switch that takes the service down for every reader at once, and it could only be moved by a
// deploy. Now `Number(process.env.ASK_GLOBAL_DAY) || 20000` — no environment variable is set by
// this batch; the default in the code is the change.
//
// Usage: node guards/floors-and-filters-guard.cjs
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
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

(async function main() {
  console.log('=== floors-and-filters-guard — a declaration beats a default ===');

  const PG = await esm('lib/source-page-gates.js');
  const R = await esm('lib/source-registry.js');
  const RT = await esm('lib/retrieve.js');

  // ── STEP 6 ─────────────────────────────────────────────────────────────────
  console.log('\n=== 6. THE DECLARED minText GOVERNS ===');
  ok('source-page-gates exports declaredMinText()', typeof PG.declaredMinText === 'function');
  if (typeof PG.declaredMinText === 'function') {
    eq('mostafaaladwy.com declares 20', PG.declaredMinText('https://mostafaaladwy.com/fatwa/49996/x'), 20);
    eq('tafsir.net declares 2500', PG.declaredMinText('https://tafsir.net/articles/1'), 2500);
    eq('ibn-jebreen.com declares 300', PG.declaredMinText('https://ibn-jebreen.com/fatwa/1'), 300);
    // A host with NO rule declares nothing, and the generic default then applies.
    eq('a host with no page rules declares nothing',
      PG.declaredMinText('https://islamqa.info/ar/answers/1/x'), null);
    eq('an unparseable input declares nothing', PG.declaredMinText('not a url'), null);
  }

  // The generic floor is named, exported and used — not a magic number buried in a comparison.
  ok('lib/retrieve.js exports its generic floor', typeof RT.GENERIC_MIN_TEXT === 'number',
    String(RT.GENERIC_MIN_TEXT));
  eq('...and it is still 200', RT.GENERIC_MIN_TEXT, 200);

  const retrieveSrc = read('lib/retrieve.js');
  ok('retrieve.js consults the declared floor before the generic one',
    /declaredMinText/.test(retrieveSrc),
    'the 200 must be a DEFAULT, not a ceiling above a host\'s own declaration');
  ok('...and the bare «< 200» comparison is gone',
    !/text\.length\s*<\s*200/.test(retrieveSrc),
    'a literal 200 in the admission test is the defect itself');

  // THE MEASURED PAGE. 110 characters of real question-and-answer from a host that declares 20.
  ok('the effective floor for mostafaaladwy.com admits its 110-character fatwa',
    (PG.declaredMinText('https://mostafaaladwy.com/fatwa/49996/x') ?? RT.GENERIC_MIN_TEXT) <= 110);
  // And a host that declares a HIGHER floor keeps it — the rule works in both directions.
  ok('...while tafsir.net\'s 2500 still refuses a 1000-character stub',
    (PG.declaredMinText('https://tafsir.net/articles/1') ?? RT.GENERIC_MIN_TEXT) > 1000);
  // A host that declares nothing is unchanged.
  ok('...and a host that declares nothing still uses 200',
    (PG.declaredMinText('https://islamqa.info/ar/answers/1/x') ?? RT.GENERIC_MIN_TEXT) === 200);

  // ── STEP 7 ─────────────────────────────────────────────────────────────────
  console.log('\n=== 7. AN EMPTY LIST AFTER FILTERING STAYS EMPTY ===');
  // THE MEASUREMENT. Every world domain carries scopes: [] so that a news page can never back a
  // ruling; the fallback handed back all four.
  eq('filterSitesForPurpose(SITES_GENERAL, "fatwa") is EMPTY',
    R.filterSitesForPurpose(RT.SITES_GENERAL, 'fatwa'), []);
  for (const p of R.PURPOSES) {
    eq('...and for "' + p + '" too', R.filterSitesForPurpose(RT.SITES_GENERAL, p), []);
  }
  ok('the fallback-to-unfiltered is gone from the source',
    !/kept\.length \? kept : list\.slice\(\)/.test(read('lib/source-registry.js')),
    'returning the unfiltered list is returning exactly what the scope rule refused');

  // WHAT MUST NOT CHANGE: filtering a list that has eligible members is untouched, and an
  // unrecognised purpose is still the identity.
  const adult = R.domainsForBand('adult');
  ok('a real band still filters to a non-empty list for every purpose',
    R.PURPOSES.every((p) => R.filterSitesForPurpose(adult, p).length > 0),
    R.PURPOSES.filter((p) => !R.filterSitesForPurpose(adult, p).length).join(','));
  eq('an unknown purpose is still the identity', R.filterSitesForPurpose(adult, 'nonsense'), adult);
  eq('no purpose at all is still the identity', R.filterSitesForPurpose(adult, ''), adult);

  // ── STEP 8 ─────────────────────────────────────────────────────────────────
  console.log('\n=== 8. ASK_GLOBAL_DAY IS SETTABLE, AND DEFAULTS TO 20000 ===');
  const rl = read('lib/ratelimit.js');
  ok('ASK_GLOBAL_DAY reads the environment',
    /Number\(process\.env\.ASK_GLOBAL_DAY\)/.test(rl), rl.match(/const ASK_GLOBAL_DAY.*/) || '');
  ok('...and defaults to 20000, not 800',
    /Number\(process\.env\.ASK_GLOBAL_DAY\)\s*\|\|\s*20000/.test(rl));
  ok('...and the closed-test 800 is no longer the shipped number',
    !/const ASK_GLOBAL_DAY = 800/.test(rl));
  // NO ENVIRONMENT VARIABLE WAS SET BY THIS BATCH. The default in the code is the whole change.
  ok('the guard itself does not depend on an env var being set',
    process.env.ASK_GLOBAL_DAY === undefined || Number(process.env.ASK_GLOBAL_DAY) > 0);

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
