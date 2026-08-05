// guards/scholar-registry-drift-guard.cjs
// A SCHOLAR THE APP CAN SEARCH FOR MUST BE A SCHOLAR THE APP CAN RECOGNISE.
//
// ── THE DRIFT THIS CLOSES, MEASURED ──────────────────────────────────────────
// Two tables answer two halves of one question and neither can see the other:
//
//   lib/ledger/source-policy.js   «who owns this domain»            — ownerId per row
//   lib/source-registry.js        «which domain is this shaykh's»   — SCHOLAR_SITES
//
// `mutlaq-aljasir` had a live scope on dr-mutlaq.com and no row in SCHOLAR_SITES. The app was
// therefore indexing his site and could not understand a reader who named him: «ما رأي الشيخ مطلق
// الجاسر…» resolved to nobody and was answered with a request for his official website — the
// website already on the approved list. `ibn-uthaymeen` was the same defect wearing a different
// hat: the one scholar with a purpose-built adapter was unresolvable, because his domain is
// deliberately not a searchable source and the resolver only knew about searchable sources.
//
// Neither gap is visible from either file on its own. That is what this gate is for.
//
// ── WHAT IS EXCLUDED, AND WHY IT IS A DESIGN DECISION RATHER THAN A HOLE ─────
// SCHOLAR_SITES answers «this shaykh's site is which domain?». Four owners are not shaykhs:
// a national fatwa committee, an international fiqh academy, a hadith encyclopedia and a tafsir
// institute. They have no name a reader asks a fatwa of, and putting an institution into the
// persons table would let «الدرر» resolve as a man. They are named here so the exclusion is a
// decision on the record rather than an accident of what happens to be missing.
//
// Usage: node guards/scholar-registry-drift-guard.cjs
'use strict';
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

// INSTITUTIONS, NOT PERSONS. Listed explicitly so adding a fifth is a deliberate act.
const INSTITUTIONS = Object.freeze(['eftaa-committee-kw', 'iifa', 'dorar', 'tafsir-center']);

(async function main() {
  console.log('=== scholar-registry-drift-guard — searchable implies recognisable ===');

  const SP = await esm('lib/ledger/source-policy.js');
  const REG = await esm('lib/source-registry.js');
  const ATTR = await esm('lib/attribution.js');

  ok('SCHOLAR_SITES is exported so the two tables can be compared at all',
    Array.isArray(REG.SCHOLAR_SITES) && REG.SCHOLAR_SITES.length > 0,
    'without this the drift is unmeasurable from outside lib/source-registry.js');

  // =========================================================================
  console.log('\n=== A. EVERY ACTIVE PERSON OWNER RESOLVES ===');
  const active = SP.POLICY_ROWS.filter((r) => r.health === 'enabled' && r.ownerId);
  const byOwner = new Map();
  for (const r of active) {
    if (!byOwner.has(r.ownerId)) byOwner.set(r.ownerId, []);
    byOwner.get(r.ownerId).push(r.domain);
  }
  const personOwners = [...byOwner.keys()].filter((o) => !INSTITUTIONS.includes(o));

  ok('there are active owners to check at all', personOwners.length >= 10, String(personOwners.length));
  // THE EXCLUSION IS CHECKED AGAINST EVERY ROW, NOT ONLY THE ENABLED ONES. What this assertion is
  // for is dead weight: an exclusion naming an owner the policy no longer knows at all. A DEFERRED
  // row still knows its owner — dorar.net was deferred on 2026-08-05 (HTTP 403 for every
  // server-side client) and its row, its owner and its evidence all survive precisely so the
  // decision can be reversed in one word. Scoping this to `active` would have deleted the
  // exclusion for an institution that is still in the table, and re-admitting the site later would
  // then have silently made it scholar-resolvable.
  const ownersAnywhere = new Set(SP.POLICY_ROWS.filter((r) => r.ownerId).map((r) => r.ownerId));
  for (const inst of INSTITUTIONS) {
    ok('excluded by design, and still present in the policy: ' + inst, ownersAnywhere.has(inst),
      'an exclusion for an owner that no longer exists is dead weight — remove it from the list');
  }

  // THE CONTRACT IS PER OWNER, NOT PER DOMAIN. An owner may publish on more than one domain —
  // al-Munajjid owns both almunajjid.com and islamqa.info — and one recognisable corpus is enough
  // to understand a reader who names him. Requiring every domain would force «المنجد» to resolve
  // to two places at once, which is precisely the ambiguity resolveScholar refuses to invent.
  const unrecognised = [];
  for (const owner of personOwners) {
    const domains = byOwner.get(owner);
    const rows = REG.SCHOLAR_SITES.filter((s) => domains.includes(s.domain) && s.aliases.length > 0);
    const resolvable = rows.some((row) => row.aliases.every((a) => {
      const r = REG.resolveScholar(a);
      return r.status === 'resolved' && r.domain === row.domain;
    }));
    if (!resolvable) unrecognised.push(owner + ' (' + domains.join(', ') + ')');
  }
  eq('every active person owner has a corpus his name resolves to', unrecognised, []);

  // =========================================================================
  console.log('\n=== B. THE TWO THAT WERE MISSING, BY THE NAMES READERS TYPE ===');
  {
    // The six spellings lib/source-intent.js routes on. A reader understood by the intent layer
    // and not by the registry is the drift in miniature.
    for (const form of ['مطلق الجاسر', 'الشيخ مطلق', 'دكتور مطلق', 'مطلق جاسر', 'د مطلق', 'الجاسر']) {
      const r = REG.resolveScholar(form);
      eq('«' + form + '» resolves to dr-mutlaq.com',
        r.status === 'resolved' ? r.domain : r.status, 'dr-mutlaq.com');
    }
    for (const form of ['ابن عثيمين', 'العثيمين', 'محمد بن صالح العثيمين', 'الشيخ ابن عثيمين']) {
      const r = REG.resolveScholar(form);
      eq('«' + form + '» resolves to binothaimeen.net',
        r.status === 'resolved' ? r.domain : r.status, 'binothaimeen.net');
    }
    // ...and it is the SAME man the adapter registry knows, not a second opinion about him.
    const s = ATTR.lookupScholar('ابن عثيمين');
    eq('...and the adapter registry agrees who that is', s && s.key, 'ibn-uthaymeen');
    eq('...on the same host', s && s.host, 'binothaimeen.net');
  }

  // =========================================================================
  console.log('\n=== C. RECOGNISING A MAN DID NOT WIDEN ANY SEARCH ===');
  {
    // The whole reason resolveScholar refuses an inactive row is that a resolved domain becomes an
    // `onlySites` target. The adapter allowance must not smuggle one onto a band list.
    eq('binothaimeen.net is on no band search list', REG.domainsForBand('adult').includes('binothaimeen.net'), false);
    eq('...nor the young band', REG.domainsForBand('young').includes('binothaimeen.net'), false);
    eq('...and it is still not a SOURCES row', REG.findSource('binothaimeen.net') || null, null);
    ok('...and the resolution says so, so no caller can mistake it for a searchable domain',
      REG.resolveScholar('ابن عثيمين').viaAdapter === true);
    // 24 until 2026-08-05; 22 since the three deferrals and the one ferkous.app admission. The
    // point of this assertion is that RECOGNISING A SCHOLAR never widens the searchable surface —
    // which it still does not; the number moved for a different and recorded reason.
    eq('the searchable surface is unchanged by scholar recognition', SP.searchableDomains().length, 22);
    // A blocked owner must STILL be unresolvable — the allowance is for adapters, not for dead sites.
    const disabled = SP.POLICY_ROWS.filter((r) => r.health !== 'enabled').map((r) => r.domain);
    const leaked = disabled.filter((d) => REG.SCHOLAR_SITES.some((s) => s.domain === d
      && s.aliases.some((a) => (REG.resolveScholar(a).domain || '') === d)));
    eq('no disabled domain became resolvable', leaked, []);
  }

  // =========================================================================
  console.log('\n=== D. NO INSTITUTION ENTERED THE PERSONS TABLE ===');
  {
    const instDomains = active.filter((r) => INSTITUTIONS.includes(r.ownerId)).map((r) => r.domain);
    const intruders = REG.SCHOLAR_SITES
      .filter((s) => instDomains.includes(s.domain) && s.aliases.length > 0)
      .map((s) => s.domain);
    eq('a committee, an academy and an encyclopedia are not shaykhs', intruders, []);
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('scholar-registry-drift-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
