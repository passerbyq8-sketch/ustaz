// guards/dead-domains-guard.cjs — a domain that cannot produce a citation is not on a list.
//
// HISTORICAL OPERATOR NOTES FROM 2026-08-05 follow. This gate consumes no raw responses,
// redirect chains, WARC records or signatures, so the notes are context—not current measurements:
//
//   dorar.net           HTTP 403 on «/», «/hadith/search?q=…», «/feqhia/1» AND on the documented
//                       «/dorar_api.json?skey=…». Every path returns the same ~6,100-byte refusal.
//                       There is no officially declared endpoint that serves a server-side client,
//                       so there is nothing to fix without impersonating a browser or working
//                       round the block — both of which are forbidden. => DEFERRED.
//
//   tafsir.app          HTTP 200, ~150,000 bytes, and an EMPTY <body>: Readability extracts 0
//                       characters and so does the raw fallback. Every HTML path — including
//                       /sitemap.xml — returns the same client-rendered shell. Its only
//                       unrendered surfaces are undeclared internal *.php endpoints, which are
//                       neither a declared interface nor a page a reader could open from a source
//                       card. => DEFERRED. tafsir.net carries tafsir.
//
//   ferkous.com         302 -> http://www.ferkous.app/… . The site moved domain. The new domain
//                       serves the same material and passes the gates: /home/?q=fatwa-660 extracts
//                       2,144 clean characters titled «في حكم الصُّفرة والكُدرة قبل زمن الحيض
//                       وبعده», on the apex AND on www, over HTTPS. Both conditions the brief set
//                       are therefore met by measurement => ferkous.app is admitted for the same
//                       owner, and ferkous.com is deferred as the moved-from name.
//                       (It matters that the row MOVES rather than doubling: the redirect lands on
//                       HTTP, and api/ask.js and lib/ledger/canonical.js both refuse a non-HTTPS
//                       final URL — so a card sourced through ferkous.com would be dropped anyway.)
//
//   mostafaaladwy.com   NOT DEAD, and not deferred. Sampled from its own fatwa-library sitemap
//                       (1,000 URLs), the extractor reaches the answer body correctly:
//                       /fatwa/49995/… => 2,600 chars, /fatwa/148584/… => 492, /fatwa/49996/… =>
//                       110, each «clean (page-gated)» with السؤال/الإجابة separated. What killed
//                       it was the GENERIC 200-character floor in lib/retrieve.js overriding the
//                       host's own declared `minText: 20` — the defect step 6 fixes. Two of the
//                       five sampled pages returned «BLOCKED (no-published-answer)», which is the
//                       page gate working exactly as its registry note says it should.
//
// This guard runs OFFLINE. It asserts registry/list/capability DECISIONS, not current network
// facts: no note length or prose status is treated as authentic liveness evidence.
//
// Usage: node guards/dead-domains-guard.cjs
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

const DEFERRED = ['dorar.net', 'tafsir.app', 'ferkous.com'];

(async function main() {
  console.log('=== dead-domains-guard — a domain that cannot produce a citation is not on a list ===');

  const R = await esm('lib/source-registry.js');
  const SP = await esm('lib/ledger/source-policy.js');
  const RT = await esm('lib/retrieve.js');
  const CAP = await esm('lib/ledger/capability.js');

  const LISTS = [
    ['SITES_ADULT', RT.SITES_ADULT], ['SITES_MINOR', RT.SITES_MINOR],
    ['SITES_MINOR_FALLBACK', RT.SITES_MINOR_FALLBACK], ['SITES_GENERAL', RT.SITES_GENERAL],
  ];

  // ── 1. EVERY DEFERRED DOMAIN IS DEFERRED EVERYWHERE ────────────────────────
  for (const d of DEFERRED) {
    const row = R.findSource(d);
    ok(d + ': registry status is «deferred»', row && row.status === 'deferred',
      row ? 'status=' + row.status : 'no row');
    ok(d + ': the row survives with a historical decision note',
      row && typeof row.note === 'string' && row.note.length > 30,
      'this preserves rationale only; the external transaction is not present');
    ok(d + ': grants no scope at all', row && row.scopes.length === 0,
      JSON.stringify(row && row.scopes));
    ok(d + ': sits on no band', row && row.bands.length === 0, JSON.stringify(row && row.bands));

    for (const [name, list] of LISTS) {
      ok(d + ': absent from ' + name, !list.includes(d));
    }
    ok(d + ': absent from the ledger\'s searchable set', !SP.searchableDomains().includes(d));

    const pol = SP.policyFor('https://' + d + '/x');
    ok(d + ': ledger health is not «enabled»', !pol || pol.health !== 'enabled',
      pol ? 'health=' + pol.health : 'no row');
    if (pol) {
      const granted = CAP.CAPABILITIES.filter((c) => pol.capabilityPolicy[c].eligible);
      ok(d + ': grants no capability', granted.length === 0, granted.join(','));
    }
    // No purpose may be served by it, by any route.
    for (const p of R.PURPOSES) {
      ok(d + ': may not serve purpose «' + p + '»', R.sourceAllowsPurpose(d, p) === false);
    }
  }

  // ── 2. dorar.net IS OFF THE CHILD'S LIST SPECIFICALLY ──────────────────────
  ok('dorar.net is off the minor band in the registry too',
    !R.domainsForBand('minor').includes('dorar.net'), JSON.stringify(R.domainsForBand('minor')));

  // ── 3. ferkous.app REPLACES IT, FOR THE SAME OWNER ─────────────────────────
  const fa = R.findSource('ferkous.app');
  ok('ferkous.app has its own registry row', !!fa);
  ok('ferkous.app is active on the adult band',
    fa && fa.status === 'active' && fa.bands.includes('adult'),
    JSON.stringify(fa && { s: fa.status, b: fa.bands }));
  ok('ferkous.app is on SITES_ADULT', RT.SITES_ADULT.includes('ferkous.app'));
  ok('ferkous.app is searchable in the ledger policy',
    SP.searchableDomains().includes('ferkous.app'));
  const faPol = SP.policyFor('https://ferkous.app/home/?q=fatwa-660');
  ok('...under the SAME owner id as before', faPol && faPol.ownerId === 'ferkous',
    JSON.stringify(faPol && faPol.ownerId));
  // The reader who names the shaykh must reach the live domain, not the moved-from one.
  const res = R.resolveScholar('فركوس');
  ok('«فركوس» resolves to ferkous.app, not the deferred name',
    res.status === 'resolved' && res.domain === 'ferkous.app', JSON.stringify(res));

  // ── 4. mostafaaladwy.com WAS NOT DEFERRED — IT WORKS ───────────────────────
  // "WORKS" in the historical heading means the active registry decision only. Current network
  // and extractor truth require an authenticated external transaction that this gate lacks.
  const ma = R.findSource('mostafaaladwy.com');
  ok('mostafaaladwy.com is still active in the registry', ma && ma.status === 'active',
    'current network/extractor truth requires an authenticated external transaction');
  ok('...and still on SITES_ADULT', RT.SITES_ADULT.includes('mostafaaladwy.com'));

  // ── 5. NOTHING DRIFTED ─────────────────────────────────────────────────────
  const dupes = R.duplicateProblems();
  ok('no duplicate/nested/renamed rows', dupes.length === 0, dupes.join('; '));
  const conf = SP.conformanceProblems();
  ok('the ledger policy still conforms to the registry', conf.length === 0, conf.join('; '));

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
