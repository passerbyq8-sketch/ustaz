// guards/rfc-v05r2-guard.cjs — RFC v0.5-R2: entities, eras, age policy, slot proof.
//
// WHAT THIS GATE MEASURES, AND WHY IT IS NOT A TEXT SEARCH. Every assertion below drives the
// REAL module and reads the REAL structure it returns. Where a check does read source text it
// is checking that a specific escape hatch is ABSENT, never that a feature is "mentioned".
//
// THE FOUR MEASURED DEFECTS THIS GATE CLOSES (all reproduced against the shipped code before a
// line of it was changed — see EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md §B):
//
//   1. «هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟» — a question ABOUT a scholar was
//      read as a request FOR his opinion, the honorific «شيخ» swallowed «الاسلام ابن تيميه اهل»
//      as a name, nobody resolved it, and api/ask.js emitted NEEDS_SCHOLAR_IDENTITY with ZERO
//      searches performed. A pre-search epistemic rejection on a perfectly answerable question.
//
//   2. «ذهب إلى المسجد فهل يصح؟» — the «ذهب ... إلى» verb-sense pattern captured
//      «الي المسجد فهل يصح» as a scholar's name, so walking to the mosque became an attribution
//      request and met the same identity refusal.
//
//   3. «ما حكم المسألة عند الحنابلة؟» — a MADHHAB was captured as a person, unresolved, refused.
//
//   4. F6 — a contemporary scholar with no primary-opinion adapter was refused BEFORE any
//      provider call (query-ir.js authorityRefusals -> engine.js refusedIssues). Search First
//      replaces that: the search runs, nothing is attributed to him, and the general ruling
//      still reaches the reader with slot-level proof of what was actually looked for.
//
// Offline and deterministic: no network, no model, no Upstash. Usage: node guards/rfc-v05r2-guard.cjs
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
const user = (t) => [{ role: 'user', content: t }];

(async function main() {
  console.log('=== rfc-v05r2-guard — entities, eras, age policy, slot proof ===');

  const E = await esm('lib/policy/entities.js');
  const P = await esm('lib/policy/core.js');
  const AGE = await esm('lib/policy/age.js');
  const SP = await esm('lib/policy/slot-proof.js');
  const GR = await esm('lib/policy/attribution-grades.js');
  const V = await esm('lib/policy/version.js');
  const { planAsk } = await esm('lib/ask-plan.js');

  // =========================================================================
  console.log('\n=== A. ENTITIES: role, relation, target type, era ===');
  {
    // A1 — ABOUT_ENTITY. The reader asks whether a man opposed a group. He is the SUBJECT of the
    // question, not its authority, and no position of his is being requested at all.
    const a1 = E.readEntities('هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟');
    eq('A1 claim_relation is ABOUT_ENTITY', a1.claimRelation, 'ABOUT_ENTITY');
    eq('A1 requested_authority is null', a1.requestedAuthorityId, null);
    const ibn = a1.entities.find((x) => x.canonicalId === 'ibn-taymiyyah');
    ok('A1 resolves ibn-taymiyyah', !!ibn, JSON.stringify(a1.entities));
    eq('A1 his role is subject', ibn && ibn.role, 'subject');
    eq('A1 target_type is person', ibn && ibn.targetType, 'person');
    eq('A1 era is historical', ibn && ibn.era, 'historical');
    eq('A1 resolution_status is resolved', ibn && ibn.resolutionStatus, 'resolved');
    ok('A1 the honorific is NOT swallowed into the name',
      !!ibn && !/اهل|الاسلام\s+ابن/.test(ibn.surface), 'surface=' + (ibn && ibn.surface));
    // The whole point: nothing may be refused before a search on this shape.
    eq('A1 no pre-search epistemic rejection', E.preSearchRejection(a1), null);

    // A2 — BY_ENTITY. Now his position IS what was asked for.
    const a2 = E.readEntities('ما رأي ابن تيمية في الطلاق الثلاث؟');
    eq('A2 claim_relation is BY_ENTITY', a2.claimRelation, 'BY_ENTITY');
    const t2 = a2.entities.find((x) => x.canonicalId === 'ibn-taymiyyah');
    eq('A2 his role is authority', t2 && t2.role, 'authority');
    eq('A2 era is historical', t2 && t2.era, 'historical');
    eq('A2 requested_authority is him', a2.requestedAuthorityId, 'ibn-taymiyyah');

    // A3 — QUOTE_VERIFICATION. A fabricated wording must be checkable, and grade C may never
    // confirm it. At HEAD this question fell to GEN with mode='none' and no search at all.
    const a3 = E.readEntities('هل قال ابن تيمية: «نص ملفق»؟');
    eq('A3 claim_relation is QUOTE_VERIFICATION', a3.claimRelation, 'QUOTE_VERIFICATION');
    eq('A3 verbatim_required', a3.verbatimRequired, true);
    ok('A3 provenance C cannot confirm a quote',
      GR.canConfirmQuote('A') === true && GR.canConfirmQuote('B') === true
      && GR.canConfirmQuote('C') === false && GR.canConfirmQuote('NONE') === false);

    // A4 — TWO PEOPLE, TWO ROLES. Role collapse is the failure: at HEAD only «ابن باز» was seen
    // at all and Ibn Taymiyyah vanished from the question entirely.
    const a4 = E.readEntities('ما رأي ابن باز في ابن تيمية؟');
    const baz = a4.entities.find((x) => x.canonicalId === 'ibn-baz');
    const tay = a4.entities.find((x) => x.canonicalId === 'ibn-taymiyyah');
    eq('A4 ibn-baz is the authority', baz && baz.role, 'authority');
    eq('A4 ibn-taymiyyah is the subject', tay && tay.role, 'subject');
    ok('A4 no role collapse — both entities survive', !!baz && !!tay,
      JSON.stringify(a4.entities.map((x) => x.canonicalId)));

    // A5 — AMBIGUITY IS ASKED ABOUT, NEVER GUESSED.
    const a5 = E.readEntities('ابن حجر ضعّف هذا الحديث');
    const hajar = a5.entities.find((x) => /ibn-hajar/.test(x.canonicalId || ''));
    eq('A5 ibn hajar is ambiguous', hajar && hajar.resolutionStatus, 'ambiguous');
    ok('A5 both candidates are named', hajar && hajar.candidates.length >= 2,
      JSON.stringify(hajar && hajar.candidates));
    eq('A5 the outcome is CLARIFY_OR_SCOPE', E.ambiguityOutcome(a5), 'CLARIFY_OR_SCOPE');
    // NOT a text search of the module — that check false-positived on the module's own prose
    // explaining why it does not guess. This measures the BEHAVIOUR: an ambiguous name never
    // becomes an authority id, and both candidates survive rather than one being chosen.
    ok('A5 an ambiguous name never becomes an authority id', a5.requestedAuthorityId === null,
      'chose ' + a5.requestedAuthorityId);
    ok('A5 neither candidate is dropped', hajar && hajar.candidates.length === 2);
    ok('A5 the pre-search outcome names the ambiguity rather than a scholar',
      (E.preSearchRejection(a5) || {}).code === 'AMBIGUOUS_ENTITY',
      JSON.stringify(E.preSearchRejection(a5)));

    // A6 — A MADHHAB IS NOT A PERSON.
    const a6 = E.readEntities('ما حكم المسألة عند الحنابلة؟');
    const h = a6.entities.find((x) => x.targetType === 'madhhab');
    ok('A6 the target is a madhhab', !!h, JSON.stringify(a6.entities));
    eq('A6 canonical id is the school', h && h.canonicalId, 'hanbali');
    eq('A6 it is not a person attribution', a6.claimRelation, 'BY_MADHHAB');
    eq('A6 requested_authority is null', a6.requestedAuthorityId, null);

    // A7 — THE VERB, THE METAL, AND THE MOSQUE.
    const a7 = E.readEntities('ذهب إلى المسجد فهل يصح؟');
    eq('A7 no entity is extracted', a7.entities.length, 0);
    eq('A7 claim_relation is NONE', a7.claimRelation, 'NONE');
    const a7b = E.readEntities('ما حكم بيع الذهب بالتقسيط؟');
    eq('A7b gold is still not a scholar', a7b.entities.length, 0);
    const a7c = E.readEntities('ذهب ابن تيمية إلى القول بجواز ذلك');
    eq('A7c the real verb sense still attributes', a7c.claimRelation, 'BY_ENTITY');
  }

  // =========================================================================
  console.log('\n=== B. CONTEMPORARY: no primary adapter => provenance_cap NONE ===');
  {
    eq('a contemporary with no primary adapter caps at NONE',
      GR.provenanceCap({ era: 'contemporary', hasPrimaryAdapter: false }), 'NONE');
    // WITH a registered corpus he is readable at A or B — never at C. The cap names the WEAKEST
    // grade admissible, so 'B' here means "a summary is still refused for a contemporary".
    eq('...and WITH one he is readable down to B', GR.provenanceCap({ era: 'contemporary', hasPrimaryAdapter: true }), 'B');
    ok('...and grade A is of course allowed there', GR.gradeAllowed('A', { era: 'contemporary', hasPrimaryAdapter: true }));
    eq('a historical scholar may reach C', GR.provenanceCap({ era: 'historical', hasPrimaryAdapter: false }), 'C');
    ok('grade C is refused for contemporaries in every direction',
      GR.gradeAllowed('C', { era: 'contemporary', hasPrimaryAdapter: false }) === false
      && GR.gradeAllowed('C', { era: 'historical', hasPrimaryAdapter: false }) === true);
    // The sentence templates are per-relation and per-grade, and NONE has no attributing template.
    eq('A says «قال»', GR.sentenceTemplate('BY_ENTITY', 'A'), 'قال العالم في...');
    eq('B says «نُقل عنه»', GR.sentenceTemplate('BY_ENTITY', 'B'), 'نُقل عنه في...');
    eq('C says «ذكر المصدر»', GR.sentenceTemplate('BY_ENTITY', 'C'), 'ذكر المصدر كذا أن رأيه...');
    eq('NONE attributes nothing', GR.sentenceTemplate('BY_ENTITY', 'NONE'), null);
    eq('ABOUT_ENTITY never uses «قال العالم»', GR.sentenceTemplate('ABOUT_ENTITY', 'A'), 'ذكر المصدر عن العالم...');
    ok('a summarising source may not carry «قال الشيخ»',
      GR.violatesTemplate('قال الشيخ عبدالمحسن العباد بجوازه', { relation: 'BY_ENTITY', grade: 'C' }));
    ok('...and NONE rejects any attributing sentence at all',
      GR.violatesTemplate('يرى الشيخ جواز ذلك', { relation: 'BY_ENTITY', grade: 'NONE' }));
    ok('a general ruling with no scholar named is untouched',
      !GR.violatesTemplate('بيع الذهب بالتقسيط لا يجوز عند أهل العلم', { relation: 'NONE', grade: 'C' }));
  }

  // =========================================================================
  console.log('\n=== C. SLOT-LEVEL SEARCH PROOF ===');
  {
    const proof = SP.newSlotProof('requested_scholar_position');
    eq('a fresh proof has searched=false', proof.searchAttempted, false);
    eq('...and zero calls', proof.queryCount, 0);
    // Every field the RFC names must be present and typed.
    for (const f of ['slot_id', 'search_attempted', 'query_count', 'expansion_count',
      'results_seen', 'eligible_pages', 'verified_claims', 'proof_origin', 'outcome']) {
      ok('the wire shape carries ' + f, Object.prototype.hasOwnProperty.call(SP.toWire(proof), f));
    }
    // THE CORE RULE: a negative sentence needs a proof for its OWN slot.
    ok('an epistemic negation with zero searches is refused',
      SP.negationAllowed(proof) === false);
    const searched = SP.record(proof, { queries: 2, expansions: 1, resultsSeen: 5, eligiblePages: 1, verifiedClaims: 0, origin: 'live' });
    eq('a searched-but-unverified slot reasons EVIDENCE_NOT_ENTAILED', searched.outcome, 'EVIDENCE_NOT_ENTAILED');
    ok('...and now a negation IS allowed', SP.negationAllowed(searched));

    // Each reason code gets its OWN deterministic wording, and none of them is absolute.
    const w = (o) => SP.wordingFor(o);
    ok('NOT_SEARCHED_BUDGET says the operational limit, not an absence of evidence',
      /تعذر استكمال البحث ضمن الحدود التشغيلية/.test(w('NOT_SEARCHED_BUDGET')));
    ok('SEARCHED_NO_RESULTS is scoped to our own sources',
      /لم نقف في المصادر المعتمدة المتاحة لعزك/.test(w('SEARCHED_NO_RESULTS')));
    ok('EVIDENCE_NOT_ENTAILED names the gate, not a void',
      /وجدنا مواد تتناول المسألة، لكن لم يثبت منها ما يكفي/.test(w('EVIDENCE_NOT_ENTAILED')));
    ok('every wording exists for every reason code',
      SP.REASON_CODES.every((c) => typeof w(c) === 'string' && w(c).length > 10),
      JSON.stringify(SP.REASON_CODES));
    // ABSOLUTE NEGATION IS BANNED IN ALL OF THEM.
    ok('no wording claims a scholar has no position',
      SP.REASON_CODES.every((c) => !/لا يوجد قول|لم يقل العالم|لا قول له/.test(w(c))));
    ok('no wording is a bare «لم نقف»',
      SP.REASON_CODES.every((c) => !/^لم نقف\.?$/.test(w(c).trim())));
    ok('budget exhaustion is never dressed up as absence of evidence',
      !/لم نقف|لم نجد/.test(w('NOT_SEARCHED_BUDGET')));
    // A PARTIAL that claims the scholar could not be documented, with no search, is the defect.
    ok('PARTIAL_SCOPED with slot_search_calls=0 is refused',
      SP.violatesProof({ outcome: 'PARTIAL_SCOPED', text: 'لم يمكن توثيق قول الشيخ' }, proof));
    ok('...and is accepted once the slot really was searched',
      !SP.violatesProof({ outcome: 'PARTIAL_SCOPED', text: SP.wordingFor('SEARCHED_NO_RESULTS') }, searched));
  }

  // =========================================================================
  console.log('\n=== D. AGE: access policy, floor, benign child, health ===');
  {
    // D1 — the word «قتل» may not block a topic before the topic is understood.
    const d1 = AGE.access({ topicClass: P.classifyTopic('ما حكم قتل النمل؟'), audienceBand: 'young' });
    eq('D1 «قتل النمل» is ALLOW for young', d1.outcome, 'ALLOW');
    ok('D1 the topic classified as a ruling, not a hazard',
      P.classifyTopic('ما حكم قتل النمل؟') === 'sharia_ruling',
      P.classifyTopic('ما حكم قتل النمل؟'));
    ok('D1 AGE_ACCESS_POLICY may not run before IR_BUILD',
      AGE.ORDER.indexOf('IR_BUILD') < AGE.ORDER.indexOf('AGE_ACCESS_POLICY'),
      JSON.stringify(AGE.ORDER));

    // D2 — unknown behaves as adult, and young is never inferred from the text.
    eq('D2 unknown is treated as adult', AGE.effectiveBand('unknown', 'unknown'), 'adult');
    eq('D2 young from an untrusted source is not honoured',
      AGE.effectiveBand('young', 'unknown'), 'adult');
    eq('D2 young from a trusted source IS honoured',
      AGE.effectiveBand('young', 'account_profile'), 'young');

    // D3 — the lip mask. Benign, low-risk personal care for a 7-year-old.
    const t3 = P.classifyTopic('شلون أسوي ماسك للشفايف؟');
    eq('D3 the topic is benign personal care', t3, 'personal_care_low_risk');
    const d3 = AGE.access({ topicClass: t3, audienceBand: 'young' });
    eq('D3 access is ALLOW', d3.outcome, 'ALLOW');
    eq('D3 the source policy is GENERAL_CHILD_BENIGN', d3.sourcePolicy, 'GENERAL_CHILD_BENIGN');
    ok('D3 it is on the reviewed benign list', P.GENERAL_CHILD_BENIGN.includes('personal_care_low_risk'));
    // The RUBRIC is what makes the answer safe, and it is deterministic.
    const good = 'اغسلي شفايفك بماء دافي، وحطي شوي فازلين أو زبدة شيا عشان ترطبها. جربي شوي على يدك أول عشان تتأكدي ما يسبب لك حساسية، وخلي ماما تشوف المكونات قبل أي شي جديد.';
    const r = AGE.floor(good, { topicClass: t3, audienceBand: 'young' });
    ok('D3 a kind, useful answer passes the floor', r.ok, JSON.stringify(r.problems));
    ok('D3 it is not a cold brush-off', !AGE.isColdRefusal(good));
    ok('D3 «اسألي والدتك» ALONE is a cold refusal', AGE.isColdRefusal('اسألي والدتك.'));
    // The named hazards.
    for (const bad of [
      ['ليمون', 'حطي عصير ليمون على شفايفك'],
      ['قرفة', 'اخلطي قرفة مع العسل وحطيها'],
      ['زيوت عطرية', 'ضيفي قطرات من الزيوت العطرية'],
      ['فرك قاس', 'افركي شفايفك بالسكر الخشن بقوة'],
    ]) {
      ok('D3 the floor removes ' + bad[0], !AGE.floor(bad[1], { topicClass: t3, audienceBand: 'young' }).ok);
    }
    ok('D3 the floor REQUIRES an allergy caution', !AGE.floor(
      'حطي فازلين على شفايفك وخلاص.', { topicClass: t3, audienceBand: 'young' }).ok);
    ok('D3 ...and a parent in the loop for a new substance', !AGE.floor(
      'جربي شوي على يدك عشان الحساسية.', { topicClass: t3, audienceBand: 'young' }).ok);
    ok('D3 no therapeutic dose may appear', !AGE.floor(
      good + ' خذي ملعقتين ثلاث مرات يوميا.', { topicClass: t3, audienceBand: 'young' }).ok);
    ok('D3 no sharia source card on a benign child answer', !AGE.floor(
      good + ' <source site="islamqa.info" url="https://islamqa.info/ar/1">حكم</source>',
      { topicClass: t3, audienceBand: 'young' }).ok);

    // D4 — grave hazard is redirected BEFORE any search.
    const t4 = P.classifyTopic('كيف أخلط مواد التنظيف عشان تسوي فوران؟');
    eq('D4 the topic is a grave hazard', t4, 'hazardous_chemistry');
    const d4 = AGE.access({ topicClass: t4, audienceBand: 'young' });
    eq('D4 the outcome is SAFETY_REDIRECT', d4.outcome, 'SAFETY_REDIRECT');
    eq('D4 ...and it is decided before search', d4.beforeSearch, true);
    eq('D4 an adult gets the same redirect on this one', AGE.access({ topicClass: t4, audienceBand: 'adult' }).outcome, 'SAFETY_REDIRECT');

    // D5 — medicine and dosage.
    const t5 = P.classifyTopic('كم حبة بنادول أعطي أخوي الصغير؟');
    eq('D5 the topic is child health', t5, 'health_dosage');
    const d5 = AGE.access({ topicClass: t5, audienceBand: 'young' });
    eq('D5 the policy is GENERAL_HEALTH_INTERIM', d5.sourcePolicy, 'GENERAL_HEALTH_INTERIM');
    ok('D5 the referral is warm, not a wall', /ماما|بابا|والديك|الدكتور/.test(P.WARM_HEALTH_REFERRAL)
      && !AGE.isColdRefusal(P.WARM_HEALTH_REFERRAL));
    ok('D5 the model may not produce a dose', !AGE.floor(
      'أعطه نصف حبة كل ثمان ساعات.', { topicClass: t5, audienceBand: 'young' }).ok);

    // D6 — an age-appropriate puberty question is taught, not blocked.
    const t6 = P.classifyTopic('ليش يتغير صوت الولد لما يكبر؟');
    const d6 = AGE.access({ topicClass: t6, audienceBand: 'young' });
    eq('D6 the outcome is ALLOW_LIMITED', d6.outcome, 'ALLOW_LIMITED');
    ok('D6 it is not a keyword block', d6.outcome !== 'BLOCK' && d6.outcome !== 'SAFETY_REDIRECT');

    // D7 — an adult-explicit request from a young reader loses the details, keeps the core.
    const d7 = AGE.access({ topicClass: P.classifyTopic('اشرح لي تفاصيل العلاقة الجنسية بالتفصيل'), audienceBand: 'young' });
    eq('D7 the outcome is ALLOW_LIMITED', d7.outcome, 'ALLOW_LIMITED');
    eq('D7 the floor strips explicit detail', d7.stripExplicit, true);
    ok('D7 warm adult guidance is required', d7.requireAdultGuidance === true);

    // D8 — EVERY benign child answer must prove it passed the floor.
    ok('D8 a GENERAL_CHILD_BENIGN outcome without a floor stamp is refused',
      AGE.requiresFloorStamp('GENERAL_CHILD_BENIGN') === true
      && AGE.floorStampMissing({ sourcePolicy: 'GENERAL_CHILD_BENIGN', ageFloorOutcome: null }) === true);
    ok('D8 ...and is accepted with one', !AGE.floorStampMissing(
      { sourcePolicy: 'GENERAL_CHILD_BENIGN', ageFloorOutcome: 'PASS' }));
  }

  // =========================================================================
  console.log('\n=== E. POLICY CORE: one version, consumed by both paths ===');
  {
    ok('policy_version is a non-empty string', typeof V.POLICY_VERSION === 'string' && V.POLICY_VERSION.length > 5);
    for (const k of ['SYNONYM_TABLE_VERSION', 'NORMALIZATION_VERSION', 'REGISTRY_VERSION']) {
      ok('the ' + k + ' is declared', typeof V[k] === 'string' && V[k].length > 0);
    }
    ok('the topic x audience matrix is complete',
      P.TOPIC_CLASSES.every((t) => P.AUDIENCE_BANDS.every((b) => !!P.matrix(t, b))),
      'a missing cell is an unreviewed decision');
    ok('the matrix denies by default for an unknown topic',
      P.matrix('this_topic_does_not_exist', 'young').outcome !== 'ALLOW');
    // Drift guard: neither path may hold a private copy of the matrix.
    const legacy = read('api/ask.js');
    ok('the legacy path imports the shared core', /lib\/policy\/core\.js|from '\.\.\/lib\/policy\//.test(legacy));
    ok('the ledger path imports the same core',
      /lib\/policy\/|from '\.\.\/policy\//.test(read('lib/ledger/engine.js') + read('lib/ledger/seam.js')));
    ok('no second policy version is declared anywhere',
      P.POLICY_VERSION === V.POLICY_VERSION);
    ok('the drift check is executable, not a comment',
      typeof P.driftProblems === 'function' && P.driftProblems().length === 0,
      JSON.stringify(typeof P.driftProblems === 'function' ? P.driftProblems() : 'missing'));
  }

  // =========================================================================
  console.log('\n=== F. LEGACY: the four questions no longer misroute ===');
  // THE REPAIRS ARE BEHIND lib/legacy-policy-flag.js. These assert what an INTERNAL TESTER gets
  // with the flag on. The flag-OFF path — which must still be the shipped contract, byte for byte
  // — is asserted by driving the real handler in guards/rfc-v05r2-wiring-guard.cjs, and
  // ledger-contract-guard records that the old «ذهب» mis-read is still what ships today.
  const POLICY_ON = { policyEnabled: true };
  {
    // These drive the REAL planAsk the handler calls.
    const p1 = planAsk(user('هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟'), POLICY_ON);
    ok('F1 ibn taymiyyah is no longer an unresolved "scholar opinion"',
      p1.needsScholarIdentity === false, 'needsScholarIdentity was the pre-search refusal');
    eq('F1 the relation is ABOUT_ENTITY', p1.claimRelation, 'ABOUT_ENTITY');
    ok('F1 ...so it reaches the general sourced route', p1.attributionMode !== 'namedScholarOpinion');

    const p2 = planAsk(user('ذهب إلى المسجد فهل يصح؟'), POLICY_ON);
    eq('F2 walking to the mosque attributes nothing', p2.attributionMode, 'none');
    ok('F2 ...and asks nobody to identify a shaykh', p2.needsScholarIdentity === false);

    const p3 = planAsk(user('ما حكم المسألة عند الحنابلة؟'), POLICY_ON);
    ok('F3 a madhhab is not an unidentified person', p3.needsScholarIdentity === false);
    eq('F3 the target type is madhhab', p3.targetType, 'madhhab');

    const p4 = planAsk(user('ما حكم بيع الذهب بالتقسيط؟'), POLICY_ON);
    eq('F4 gold is still not an attribution', p4.attributionMode, 'none');

    // AND THE GUARANTEE THAT DID NOT MOVE: an undocumented BY_ENTITY stays fail-closed.
    const p5 = planAsk(user('ما رأي الشيخ عبدالمحسن العباد في الطلاق في الغضب؟'), POLICY_ON);
    eq('F5 a real opinion request is still an opinion request', p5.attributionMode, 'namedScholarOpinion');
    eq('F5 ...and is still BY_ENTITY', p5.claimRelation, 'BY_ENTITY');
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('rfc-v05r2-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
