// guards/rfc-v05r2-historical-guard.cjs — a historical scholar is not asked for a website.
//
// THE DEFECT THIS GATE EXISTS TO KEEP CLOSED, MEASURED ON THE LIVE SERVICE:
//
//   «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟»
//   → «لم أتبيّنْ أيَّ شيخٍ تقصد... اذكرْ لي اسمَه كاملًا أو رابطَ موقعِه»
//
// A man dead seven centuries was asked for his official website, and nothing was searched. The
// entity layer had him right all along — ibn-taymiyyah, authority, historical, RESOLVED, no
// pre-search rejection — but lib/ask-plan.js decided `needsScholarIdentity` from resolveScholar(),
// which is the CONTEMPORARY registry keyed by official domain. The contemporary rule is sound
// where it belongs and was simply applied to the wrong era.
//
// AND A SECOND ONE FOUND WHILE PROVING THE FIRST: the honorific «شيخ الاسلام» was missing from the
// BY frames while present in the ABOUT frames, so «ما رأي شيخ الإسلام ابن تيمية» failed to mark him
// as the authority and was read as a question ABOUT him. The same sentence with «الشيخ» worked. A
// title must never decide whether a man's opinion may be asked for.
//
// WHAT THIS GATE DOES NOT ALLOW ANYONE TO CONCLUDE: that anything may now be credited to him. The
// ceiling stays C, C still may not assert a wording, and a contemporary without his own corpus is
// still fail-closed. Dropping a refusal is not granting an attribution.
//
// Offline and pure — planAsk() touches no network.
//
// Usage: node guards/rfc-v05r2-historical-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
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

// THE LITERAL QUESTION. Not a paraphrase — the defect was reported on this sentence, so the
// fixture is this sentence.
const Q = 'ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟';
const Q_HONORIFIC = 'ما رأي شيخ الإسلام ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟';

(async function main() {
  console.log('=== rfc-v05r2-historical-guard — the historical scholar needs no site ===');

  const AP = await esm('lib/ask-plan.js');
  const EN = await esm('lib/policy/entities.js');
  const GR = await esm('lib/policy/attribution-grades.js');

  const plan = (q, on = true, prior = []) =>
    AP.planAsk([...prior, { role: 'user', content: q }], { policyEnabled: on });
  const authorityOf = (p) => p.entities.find((e) => e.role === 'authority' && e.targetType === 'person');

  // =========================================================================
  console.log('\n=== A. THE RED FIXTURE — the exact reported question ===');
  {
    const p = plan(Q);
    const a = authorityOf(p);
    eq('canonical_id           = ibn-taymiyyah', a && a.canonicalId, 'ibn-taymiyyah');
    eq('entity_status          = resolved', a && a.resolutionStatus, 'resolved');
    eq('role                   = authority', a && a.role, 'authority');
    eq('era                    = historical', p.authorityEra, 'historical');
    eq('claim_relation         = BY_ENTITY', p.claimRelation, 'BY_ENTITY');
    eq('provenance_cap         = C', p.provenanceCap, 'C');
    eq('primary_adapter_needed = false', p.primaryAdapterNeeded, false);
    eq('pre_search_rejection   = null', EN.preSearchRejection(EN.readEntities(Q)), null);
    eq('...and NO identity template is emitted', p.needsScholarIdentity, false);
  }

  // =========================================================================
  console.log('\n=== B. THE TWO NAMES ARE ONE MAN (rule 1) ===');
  {
    for (const [label, q] of [['«ابن تيمية»', Q], ['«شيخ الإسلام ابن تيمية»', Q_HONORIFIC]]) {
      const p = plan(q);
      const a = authorityOf(p);
      eq(label + ' resolves to ibn-taymiyyah', a && a.canonicalId, 'ibn-taymiyyah');
      eq(label + ' is BY_ENTITY', p.claimRelation, 'BY_ENTITY');
      eq(label + ' asks for no website', p.needsScholarIdentity, false);
    }
    // Every honorific, and none, reach the same man. A title is not a classifier.
    for (const q of [
      'ما قول شيخ الإسلام ابن تيمية في هذه المسألة؟',
      'ماذا قال شيخ الإسلام ابن تيمية عن تارك الصلاة؟',
      'ما رأي الشيخ ابن تيمية فيمن ترك الصلاة؟',
      'ما رأي الإمام ابن تيمية فيمن ترك الصلاة؟',
    ]) {
      const p = plan(q);
      ok('«' + q.slice(0, 34) + '…» is his POSITION, not a question about him',
        p.claimRelation === 'BY_ENTITY' && p.needsScholarIdentity === false, p.claimRelation);
    }
  }

  // =========================================================================
  console.log('\n=== C. A QUESTION ABOUT HIM STAYS ABOUT HIM (no over-correction) ===');
  {
    // The fix must not turn every mention into a request for his fatwa. «هل خالف» asks about the
    // man's standing, and answering it with his own position would answer another question.
    const p = plan('هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟');
    eq('«هل خالف …» is ABOUT_ENTITY', p.claimRelation, 'ABOUT_ENTITY');
    eq('...and still emits no identity template', p.needsScholarIdentity, false);
  }

  // =========================================================================
  console.log('\n=== D. NO CONTAMINATION FROM EARLIER TURNS (rule 6) ===');
  {
    const priors = [
      ['after a CONTEMPORARY scholar turn', [
        { role: 'user', content: 'ما رأي ابن باز في صلاة المسافر؟' },
        { role: 'assistant', content: 'جواب سابق.' }]],
      ['after an AMBIGUOUS entity turn', [
        { role: 'user', content: 'ما رأي ابن حجر في المسألة؟' },
        { role: 'assistant', content: 'أي ابن حجر تقصد؟' }]],
      ['after an unrelated child turn', [
        { role: 'user', content: 'شلون أسوي ماسك للشفايف؟' },
        { role: 'assistant', content: 'جواب سابق.' }]],
    ];
    for (const [label, prior] of priors) {
      const p = plan(Q, true, prior);
      const a = authorityOf(p);
      ok(label + ' still resolves ibn-taymiyyah, BY_ENTITY, cap C, no template',
        a && a.canonicalId === 'ibn-taymiyyah' && p.claimRelation === 'BY_ENTITY'
        && p.provenanceCap === 'C' && p.needsScholarIdentity === false,
        JSON.stringify({ id: a && a.canonicalId, rel: p.claimRelation, cap: p.provenanceCap }));
    }
  }

  // =========================================================================
  console.log('\n=== E. EVERY HISTORICAL SCHOLAR, NOT ONE NAME (rule 10) ===');
  {
    const persons = EN.ROSTER.filter((e) => e.era === 'historical' && e.targetType === 'person');
    ok('the historical roster is non-trivial', persons.length >= 15, String(persons.length));
    let bad = [];
    for (const e of persons) {
      // Probed through a REAL alias: «مسلم» and «مالك» are deliberately not aliases of their own
      // (they are ordinary Arabic words), and probing by display name would invent a failure.
      const p = plan('ما رأي ' + e.aliases[0] + ' فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟');
      const a = authorityOf(p);
      const good = e.ambiguous
        // An ambiguous name is NOT resolved by this fix. Choosing an Ibn Hajar is still guessing.
        ? (p.needsScholarIdentity === true)
        : (a && a.canonicalId === e.canonicalId && p.authorityEra === 'historical'
          && p.provenanceCap === 'C' && p.primaryAdapterNeeded === false
          && p.needsScholarIdentity === false);
      if (!good) bad.push(e.canonicalId);
    }
    ok('every unambiguous historical scholar: cap C, no adapter, no website asked',
      bad.length === 0, 'offenders: ' + bad.join(', '));
    ok('...and the AMBIGUOUS one still asks which man is meant',
      plan('ما رأي ابن حجر فيمن ترك الصلاة؟').needsScholarIdentity === true);

    const schools = EN.ROSTER.filter((e) => e.targetType === 'madhhab');
    let badSchools = [];
    for (const e of schools) {
      const p = plan('ما حكم من ترك الصلاة تكاسلًا عند ' + e.aliases[0] + '؟');
      if (!(p.targetType === 'madhhab' && p.needsScholarIdentity === false)) badSchools.push(e.canonicalId);
    }
    ok('a school is not a man and is never asked for a website',
      badSchools.length === 0, 'offenders: ' + badSchools.join(', '));
  }

  // =========================================================================
  console.log('\n=== F. THE CEILING DID NOT MOVE — a dropped refusal is not an attribution ===');
  {
    eq('a historical entity is capped at C', GR.provenanceCap({ era: 'historical' }), 'C');
    eq('...and no adapter can raise it to B', GR.provenanceCap({ era: 'historical', hasPrimaryAdapter: true }), 'C');
    eq('a contemporary WITHOUT his own corpus is still NONE',
      GR.provenanceCap({ era: 'contemporary', hasPrimaryAdapter: false }), 'NONE');
    eq('an UNDECLARED era is still not a licence', GR.provenanceCap({ era: '', hasPrimaryAdapter: false }), 'NONE');
    ok('C still may not assert a wording',
      GR.violatesTemplate('قال ابن تيمية بجوازه', { relation: 'BY_ENTITY', grade: 'C' }));
    ok('...while the sourced transmission form passes',
      !GR.violatesTemplate('ذكر المصدر أن رأيه الجواز', { relation: 'BY_ENTITY', grade: 'C' }));
    // The contemporary path must not have been widened by this change.
    const c = plan('ما رأي الشيخ عبدالمحسن العباد في الطلاق عند الغضب؟');
    ok('a contemporary scholar is NOT granted the historical exemption',
      c.primaryAdapterNeeded === true || c.authorityEra !== 'historical',
      JSON.stringify({ era: c.authorityEra, adapter: c.primaryAdapterNeeded }));
  }

  // =========================================================================
  console.log('\n=== G. WITH THE ROLLOUT FLAG OFF, THE SHIPPED BEHAVIOUR IS UNCHANGED ===');
  {
    const p = plan(Q, false);
    eq('flag off still emits the shipped identity template', p.needsScholarIdentity, true);
    eq('...and the entity layer still reads him correctly either way', p.authorityEra, 'historical');
  }

  // =========================================================================
  console.log('\n=== H. MUTATION — the check above is load-bearing (rule 9) ===');
  {
    // A REAL source mutation, not a restatement of the assertion. lib/ask-plan.js is copied out of
    // the repo with its relative imports rewritten to absolute ones, the historical exemption is
    // deleted, and the mutant is imported. If removing the exemption does NOT bring the reported
    // defect back, then section A was passing for some other reason and proves nothing.
    const src = fs.readFileSync(path.join(REPO, 'lib', 'ask-plan.js'), 'utf8');
    const MUT = '&& !(policyEnabled && historicalAuthority)';
    ok('the exemption is present in the source to be mutated', src.includes(MUT));

    const libUrl = 'file:///' + path.join(REPO, 'lib').replace(/\\/g, '/') + '/';
    const rewrite = (s) => s.replace(/from '\.\/([^']+)'/g, (_m, rel) => "from '" + libUrl + rel + "'");
    const mutant = rewrite(src.replace(MUT, ''));
    ok('the mutation actually changed the source', mutant !== rewrite(src));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-mut-'));
    const file = path.join(dir, 'mutant-ask-plan.mjs');
    try {
      fs.writeFileSync(file, mutant, 'utf8');
      const M = await import('file:///' + file.replace(/\\/g, '/'));
      const mp = M.planAsk([{ role: 'user', content: Q }], { policyEnabled: true });
      ok('MUTANT: historical + no primary adapter emits NEEDS_SCHOLAR_IDENTITY again',
        mp.needsScholarIdentity === true,
        'the mutant did NOT reproduce the defect, so section A is not load-bearing');
      // And the guard's own assertion is the thing that would go red.
      ok('...so section A would be RED under this mutation',
        mp.needsScholarIdentity !== plan(Q).needsScholarIdentity);
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir */ }
    }
  }

  console.log('\n' + (failures ? 'FAIL ' : 'PASS ') + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
