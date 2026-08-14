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
const os = require('os');
const { spawnSync } = require('child_process');

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
const sourceArg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 && process.argv[at + 1] ? path.resolve(process.argv[at + 1]) : path.join(REPO, fallback);
};
const CORE_FILE = sourceArg('--core-source', 'lib/policy/core.js');
const ENTITIES_FILE = sourceArg('--entities-source', 'lib/policy/entities.js');
const ASK_PLAN_FILE = sourceArg('--ask-plan-source', 'lib/ask-plan.js');
const mutationRun = process.argv.includes('--mutation-run');
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const esmFile = (file, dependencyBase) => {
  const defaults = [path.join(REPO, 'lib/policy/core.js'), path.join(REPO, 'lib/policy/entities.js'),
    path.join(REPO, 'lib/ask-plan.js')];
  if (defaults.some((candidate) => samePath(file, candidate))) {
    return import('file://' + path.resolve(file).replace(/\\/g, '/'));
  }
  // Outside-tree mutants cannot resolve relative dependencies. Rewrite import specifiers only;
  // the final product source being mutated remains otherwise byte-for-byte.
  const external = fs.readFileSync(file, 'utf8').replace(
    /from\s+(['"])([^'"]+)\1/g,
    (whole, quote, specifier) => {
      if (specifier.startsWith('node:') || specifier.startsWith('file:')) return whole;
      const target = specifier.startsWith('.')
        ? path.resolve(REPO, dependencyBase, specifier)
        : require.resolve(specifier, { paths: [REPO] });
      return 'from ' + quote + 'file:///' + target.replace(/\\/g, '/') + quote;
    },
  );
  return import('data:text/javascript;base64,' + Buffer.from(external, 'utf8').toString('base64'));
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const user = (t) => [{ role: 'user', content: t }];

function runAttributionMutant(mutantDir, mutantSource, suffix) {
  const attributionFile = path.join(mutantDir, 'attribution-' + suffix + '.mjs');
  const askPlanFile = path.join(mutantDir, 'ask-plan-' + suffix + '.mjs');
  const externalAttribution = mutantSource.replace(
    /from\s+(['"])([^'"]+)\1/g,
    (whole, quote, specifier) => {
      if (specifier.startsWith('node:') || specifier.startsWith('file:')) return whole;
      const target = specifier.startsWith('.')
        ? path.resolve(REPO, 'lib', specifier)
        : require.resolve(specifier, { paths: [REPO] });
      return 'from ' + quote + 'file:///' + target.replace(/\\/g, '/') + quote;
    },
  );
  fs.writeFileSync(attributionFile, externalAttribution, 'utf8');
  const currentAskPlan = fs.readFileSync(path.join(REPO, 'lib/ask-plan.js'), 'utf8');
  const mutantUrl = 'file:///' + attributionFile.replace(/\\/g, '/');
  fs.writeFileSync(askPlanFile,
    currentAskPlan.replace("from './attribution.js';", "from '" + mutantUrl + "';"), 'utf8');
  return spawnSync(process.execPath, [__filename, '--ask-plan-source', askPlanFile, '--mutation-run'], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}

function policyInventory(P) {
  const problems = [];
  const v = P.versions();
  if (v.policyVersion !== P.POLICY_VERSION) problems.push('policy version disagrees with its own spine');
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== 'string' || !val) problems.push('version ' + k + ' is not declared');
  }
  for (const topic of P.TOPIC_CLASSES) {
    for (const band of P.AUDIENCE_BANDS) {
      const cell = P.matrix(topic, band);
      if (!cell || cell.unreviewed === true) {
        problems.push('matrix cell missing or unreviewed: ' + topic + ' x ' + band);
      }
      else if (!P.SOURCE_POLICIES.includes(cell.sourcePolicy)) {
        problems.push('unknown source policy in ' + topic + ' x ' + band + ': ' + cell.sourcePolicy);
      }
    }
  }
  for (const topic of P.GENERAL_CHILD_BENIGN) {
    if (!P.TOPIC_CLASSES.includes(topic)) problems.push('benign list names an unknown topic: ' + topic);
    else if (P.matrix(topic, 'young').outcome !== 'ALLOW') problems.push('benign topic is not ALLOW: ' + topic);
  }
  for (const topic of ['hazardous_chemistry', 'self_harm', 'weapons_explosives', 'electrical_hazard']) {
    for (const band of P.AUDIENCE_BANDS) {
      if (P.matrix(topic, band).outcome !== 'SAFETY_REDIRECT') problems.push('hazard not redirected: ' + topic + ':' + band);
    }
  }
  return problems;
}

// Literal behavioral replacement for the deleted ambiguityOutcome helper. It remains guard-only:
// null means NONE; any ambiguous entity means CLARIFY_OR_SCOPE, regardless of its current role;
// otherwise NONE. preSearchRejection has a narrower runtime purpose and is not a parity oracle.
function ambiguityOutcomeInventory(ir) {
  if (!ir) return 'NONE';
  return (Array.isArray(ir.entities) ? ir.entities : [])
    .some((entity) => entity && entity.resolutionStatus === 'ambiguous')
    ? 'CLARIFY_OR_SCOPE' : 'NONE';
}

function rosterInventory(E, SPOL, SOURCE_REGISTRY) {
  const problems = [];
  for (const entity of E.ROSTER) {
    if (entity.targetType === 'person' && entity.era === 'historical'
      && SPOL.POLICY_ROWS.some((row) => row.ownerId === entity.canonicalId)) {
      problems.push('historical/source-policy collision:' + entity.canonicalId);
    }
  }
  for (const row of SPOL.POLICY_ROWS) {
    if (row.ownerId && E.eraOf(row.ownerId) !== 'contemporary') {
      problems.push('owner era mismatch:' + row.ownerId);
    }
    if (row.ownerId && row.health === 'enabled'
      && SOURCE_REGISTRY.SCHOLAR_SITES.some((site) => site.domain === row.domain && site.aliases.length > 0)
      && !E.CONTEMPORARY_IDS.includes(row.ownerId)) {
      problems.push('derived contemporary missing:' + row.ownerId);
    }
    if (row.ownerId && row.health === 'enabled' && SPOL.ownerOf(row.domain) !== row.ownerId) {
      problems.push('domain/owner mismatch:' + row.domain);
    }
  }
  const aliases = new Map();
  for (const entity of E.ROSTER) {
    for (const alias of entity.aliases) {
      if (aliases.has(alias) && aliases.get(alias) !== entity.canonicalId) {
        problems.push('ambiguous alias:' + alias);
      }
      aliases.set(alias, entity.canonicalId);
    }
  }
  return problems;
}

function runtimeMentions(name) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')
        && fs.readFileSync(full, 'utf8').includes(name)) found.push(path.relative(REPO, full));
    }
  };
  walk(path.join(REPO, 'api'));
  walk(path.join(REPO, 'lib'));
  return found.sort();
}

(async function main() {
  console.log('=== rfc-v05r2-guard — entities, eras, age policy, slot proof ===');

  const E = await esmFile(ENTITIES_FILE, 'lib/policy');
  const P = await esmFile(CORE_FILE, 'lib/policy');
  const AGE = await esm('lib/policy/age.js');
  const SP = await esm('lib/policy/slot-proof.js');
  const GR = await esm('lib/policy/attribution-grades.js');
  const V = await esm('lib/policy/version.js');
  const ROUTE = await esm('lib/route-classify.js');
  const SACRED = await esm('lib/policy/sacred-attribution.js');
  const SPOL = await esm('lib/ledger/source-policy.js');
  const SOURCE_REGISTRY = await esm('lib/source-registry.js');
  const { planAsk } = await esmFile(ASK_PLAN_FILE, 'lib');

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
    eq('A5 the live pre-search contract chooses clarification rather than guessing',
      (E.preSearchRejection(a5) || {}).code, 'AMBIGUOUS_ENTITY');
    // NOT a text search of the module — that check false-positived on the module's own prose
    // explaining why it does not guess. This measures the BEHAVIOUR: an ambiguous name never
    // becomes an authority id, and both candidates survive rather than one being chosen.
    ok('A5 an ambiguous name never becomes an authority id', a5.requestedAuthorityId === null,
      'chose ' + a5.requestedAuthorityId);
    ok('A5 neither candidate is dropped', hajar && hajar.candidates.length === 2);
    ok('A5 the pre-search outcome names the ambiguity rather than a scholar',
      (E.preSearchRejection(a5) || {}).code === 'AMBIGUOUS_ENTITY',
      JSON.stringify(E.preSearchRejection(a5)));
    eq('F-071 ambiguity parity: null IR is NONE', ambiguityOutcomeInventory(null), 'NONE');
    eq('F-071 ambiguity parity: a resolved/no-ambiguity IR is NONE',
      ambiguityOutcomeInventory({ entities: [{ role: 'subject', resolutionStatus: 'resolved' }] }), 'NONE');
    eq('F-071 ambiguity parity: ambiguity in any role requires clarification',
      ambiguityOutcomeInventory({ entities: [{ role: 'subject', resolutionStatus: 'ambiguous' }] }),
      'CLARIFY_OR_SCOPE');
    eq('F-071 ambiguity parity: the live authority ambiguity has the same outcome',
      ambiguityOutcomeInventory(a5), 'CLARIFY_OR_SCOPE');

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
  console.log('\n=== D9. F-069 REPHRASED HADITH STAYS ON RELIGIOUS SAFETY ===');
  {
    const effectiveRouteFor = (question, plan) => {
      const messages = user(question);
      const lexical = ROUTE.classifyRoute(messages);
      const religiousRelation = plan.claimRelation === 'ABOUT_ENTITY' || plan.claimRelation === 'BY_MADHHAB';
      return (plan.attributionMode !== 'none' || religiousRelation
        || ROUTE.isReligiousText(question) || SACRED.containsPropheticOrDivineSubject(question))
        ? 'DEEN' : lexical;
    };
    const classify = (question) => {
      const plan = planAsk(user(question), { policyEnabled: true });
      const route = effectiveRouteFor(question, plan);
      return { plan, route, topic: P.classifyTopic(question, plan, route) };
    };
    const cases = [
      classify('أعد صياغة هذا الحديث النبوي: «إنما الأعمال بالنيات»'),
      classify('اشرح قول النبي صلى الله عليه وسلم: «الدين النصيحة»'),
      classify('أعد صياغة التخريج: رواه البخاري ومسلم'),
      classify('لخّص شرح الحديث الآتي: «المؤمن للمؤمن كالبنيان»'),
    ];
    ok('F-069 hadith/takhrij rephrasing and explanation classify as hadith from structured signals',
      cases.every((entry) => entry.topic === 'hadith'), JSON.stringify(cases));
    ok('F-069 the quoted prophetic control used DEEN plus the existing structured quote subject',
      cases[1].route === 'DEEN' && cases[1].plan.claimSubject.source === 'quote'
        && cases[1].plan.claimSubject.specific === true
        && cases[1].plan.claimSubject.religiousKind === 'prophetic'
        && Number.isInteger(cases[1].plan.attribution.sacredAttribution.subjectWordEnd)
        && cases[1].plan.attribution.sacredAttribution.quoteCharStart
          === cases[1].plan.claimSubject.quoteCharStart,
      JSON.stringify(cases[1]));
    ok('F-069 a Ledger intent produces the same topic without an Arabic sentence heuristic',
      P.classifyTopic('أعد صياغة النص الآتي', { intents: ['hadith_explanation'] }, 'DEEN') === 'hadith');
    for (const band of ['young', 'adult']) {
      ok('F-069 ' + band + ' hadith rephrasing uses closed religious sources',
        cases.every((entry) => AGE.access({ topicClass: entry.topic, audienceBand: band }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'));
    }
    const linguistic = classify('صغ لغويًّا: «وصل الطالب إلى المدرسة مبكرًا»');
    const math = classify('كم يساوي ٧ ضرب ٨؟');
    const quranParaphrase = classify('أعد صياغة معنى الآية القرآنية المقتبسة: «بعد المشقة يكون التيسير»');
    const scholarParaphrase = classify('أعد صياغة قول ابن تيمية: «القلوب آنية الله في أرضه»');
    const quranNamesProphet = classify(
      'أعد صياغة معنى الآية القرآنية المقتبسة: «النبي أولى بالمؤمنين من أنفسهم»');
    const quranAddressesProphet = classify('أعد صياغة معنى الآية: «يا أيها النبي اتق الله»');
    const scholarAboutProphet = classify('أعد صياغة قول ابن تيمية عن النبي: «محبته من الإيمان»');
    const divineAboutProphet = classify('أعد صياغة ما قاله الله عن النبي: «هو على خلق عظيم»');
    const titledHumanAboutProphet = classify('أعد صياغة قول الشيخ عن النبي: «محبته من الإيمان»');
    const scholarDiscourseAboutProphet = classify(
      'أعد صياغة قول الشيخ في حديثه عن النبي: «محبته من الإيمان»');
    const divineQuoteContainingReport = classify(
      'أعد صياغة ما قاله الله: «قال النبي إن الدين النصيحة»');
    const priorPropheticThenDivine = classify(
      'قال النبي كلامًا عامًا، ثم قال الله: «اثبت على الحق»');
    const priorIntroThenDivine = classify(
      'ذُكر قول النبي في المقدمة، ثم أعد صياغة قول الله: «هو ذو خلق عظيم»');
    const priorPropheticThenPlainQuote = classify(
      'قال النبي كلامًا عامًا، ثم أعد صياغة النص: «تعلم الصبر»');
    const narratedFromProphet = classify(
      'أعد صياغة ما روي عن النبي صلى الله عليه وسلم: «المؤمن مرآة أخيه»');
    const transmittedFromProphet = classify(
      'أعد صياغة ما روى عن النبي: «المؤمن مرآة أخيه»');
    const coordinatedNarratedReports = [
      classify('أعد صياغة ما وروي عن النبي: «المؤمن مرآة أخيه»'),
      classify('أعد صياغة ما فروي عن النبي: «المؤمن مرآة أخيه»'),
    ];
    const coordinatedBareRelations = [
      classify('وعن النبي: «تعلم الصبر»'),
      classify('فعن النبي: «تعلم الصبر»'),
      classify('اكتب موضوعًا وعن النبي: «تعلم الصبر»'),
      classify('السؤال وعن النبي: «متى ولد؟»'),
      classify('روي وعن النبي: «تعلم الصبر»'),
      classify('روي فعن النبي: «تعلم الصبر»'),
      classify('اكتب كلمة روي وعن النبي: «تعلم الصبر»'),
    ];
    const severedNarrationHeads = [
      classify('روي. عن النبي: «تعلم الصبر»'),
      classify('روي؟ عن النبي: «تعلم الصبر»'),
      classify('اكتب كلمة روي. عن النبي: «تعلم الصبر»'),
    ];
    const invalidDivineComplements = [
      classify('قال النبي الله: «تعلم الصبر»'),
      classify('قال النبي، الله: «تعلم الصبر»'),
      classify('قال النبي. الله: «تعلم الصبر»'),
      classify('قال النبي الرحمن: «تعلم الصبر»'),
      classify('قال المصطفى الله: «تعلم الصبر»'),
      classify('قال النبي رب العالمين: «تعلم الصبر»'),
    ];
    const attachedPunctuationTails = [
      classify('قال النبي-المؤلف: «تعلم الصبر»'),
      classify('قال النبي/المؤلف: «تعلم الصبر»'),
      classify('قال النبي—المؤلف: «تعلم الصبر»'),
      classify('قال النبي.المؤلف: «تعلم الصبر»'),
      classify('قال النبي,المؤلف: «تعلم الصبر»'),
      classify('قال النبي;المؤلف: «تعلم الصبر»'),
      classify('قال النبي:المؤلف: «تعلم الصبر»'),
      classify('قال النبي(المؤلف): «تعلم الصبر»'),
      classify('قال النبي_المؤلف: «تعلم الصبر»'),
      classify('قال النبي+المؤلف: «تعلم الصبر»'),
      classify('قال النبي|المؤلف: «تعلم الصبر»'),
      classify('قال النبي=المؤلف: «تعلم الصبر»'),
    ];
    const literalSentinelTail = classify(
      'قال النبي attributionclausesentinel: «تعلم الصبر»');
    const materialLocationQuotes = [
      classify('من موقع النبي: «تعلم الصبر»'),
      classify('في موقع النبي: «تعلم الصبر»'),
      classify('على موقع النبي: «تعلم الصبر»'),
      classify('مادة من موقع الرسول: «تعلم الصبر»'),
      classify('أعد صياغة النص من موقع النبي: «تعلم الصبر»'),
    ];
    // These sentences are understandable to a human, but the shipped structured attribution
    // grammar does not prove that their intervening complements belong to the quote governor.
    // Leave them UNBOUND instead of growing a second verb/preposition lexicon.
    const unboundPropheticComplements = [
      classify('أعد صياغة ما روي عن النبي أنه قال: «المؤمن مرآة أخيه»'),
      classify('أعد صياغة قول النبي عن الصدق: «عليكم بالصدق»'),
      classify('أعد صياغة قول النبي في الصبر: «الصبر ضياء»'),
      classify('أعد صياغة ما قال النبي للمؤمنين: «الدين النصيحة»'),
      classify('قال النبي وصيةً جامعةً: «اتق الله»'),
      classify('قال النبي وقت الشدة: «استعن بالله»'),
      classify('قال النبي وهو يخطب: «الدين النصيحة»'),
      classify('قال النبي واصفًا المؤمن: «المؤمن مرآة أخيه»'),
      classify('قال النبي لما سئل عن الإسلام: «الدين النصيحة»'),
      classify('قال النبي موضحًا كيف يكون الصبر: «الصبر ضياء»'),
    ];
    const relationOnlyQuotes = [
      classify('أعد صياغة السؤال عن النبي: «متى ولد؟»'),
      classify('أعد صياغة عبارة عن النبي: «كان رحيمًا»'),
      classify('اكتب موضوعًا عن النبي: «رحمته بالناس»'),
      classify('أعد صياغة ما كتبه المؤلف عن النبي: «كان رحيمًا»'),
      classify('أعد صياغة المقال عن النبي: «ولد في مكة»'),
      classify('أعد صياغة النص عن النبي: «كان رحيمًا»'),
      classify('أعد صياغة نص عن النبي: «كان رحيمًا»'),
      classify('هذا نص عن النبي: «متى ولد؟»'),
      classify('أعد صياغة ما قال عن النبي: «كان رحيمًا»'),
    ];
    const priorPropheticThenRelation = [
      classify('قال النبي كلامًا عامًا، ثم أعد صياغة السؤال عن النبي: «متى ولد؟»'),
      classify('ذُكر قول النبي في المقدمة، ثم اكتب موضوعًا عن النبي: «رحمته بالناس»'),
      classify('قال النبي، ثم أعد صياغة النص: «تعلم الصبر»'),
      classify('ذُكر قول النبي، ثم اكتب موضوعًا عامًا: «أهمية القراءة»'),
    ];
    const unpunctuatedRequestBoundaries = [
      classify('قال النبي كلامًا عامًا ثم أعد صياغة النص: «تعلم الصبر»'),
      classify('ذُكر قول النبي في المقدمة ثم اكتب موضوعًا عامًا: «أهمية القراءة»'),
      classify('قال النبي كلامًا عامًا — أعد صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا عامًا: ثم أعد صياغة النص: «تعلم الصبر»'),
      classify('هذا قول النبي ثم سؤال آخر: «كم يساوي سبعة في ثمانية؟»'),
      classify('قال النبي كلامًا وبعدين أعد صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا بعدين أعد صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا وبعد ذلك أعد صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا لكن أعد صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا، أعد الآن صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا - أعد صياغة النص: «تعلم الصبر»'),
      classify('قال النبي كلامًا / أعد صياغة النص: «تعلم الصبر»'),
    ];
    const laterPropheticSpeaker = classify(
      'قال الشيخ كلامًا ثم قال النبي: «الدين النصيحة»');
    const registeredThenPropheticSpeaker = classify(
      'قال ابن تيمية كلامًا ثم قال النبي: «الدين النصيحة»');
    const laterUntrustedHumanGovernor = [
      classify('قال النبي كلامًا وكتب ابن تيمية: «تعلم الصبر»'),
      classify('قال النبي كلامًا وكتب المؤلف: «تعلم الصبر»'),
      classify('قال النبي كلامًا ونقل الباحث: «تعلم الصبر»'),
    ];
    const nonPropheticCourtesyBridges = [
      classify('ورد قول النبي. السلام عليكم: «أهمية القراءة»'),
      classify('ذُكر قول النبي. شكرًا: «تعلم الصبر»'),
      classify('ورد قول النبي، صباح الخير: «أهمية القراءة»'),
      classify('هذا قول النبي، الحمد لله: «تعلم الصبر»'),
    ];
    const declaredHonorificReports = [
      classify('اشرح قول النبي، صلى الله عليه وسلم: «الدين النصيحة»'),
      classify('أعد صياغة ما قال النبي، صلى الله عليه وسلم: «المؤمن مرآة أخيه»'),
      classify('أعد صياغة ما روي عن النبي، صلى الله عليه وسلم: «المؤمن مرآة أخيه»'),
      classify('اشرح قول النبي، عليه السلام: «الدين النصيحة»'),
      classify('قال رسول الله، صلى الله عليه وسلم: «الدين النصيحة»'),
      classify('قال النبي صلى الله عليه وسلم، «الدين النصيحة»'),
      classify('قال رسول الله صلى الله عليه وسلم، «الدين النصيحة»'),
    ];
    const undeclaredHonorificForms = [
      classify('اشرح قول النبي، عليه الصلاة والسلام: «الدين النصيحة»'),
      classify('اشرح قول النبي، ﷺ: «الدين النصيحة»'),
    ];
    const unboundDescriptiveComplements = [
      classify('قال النبي للمؤمنين، ناصحًا لهم: «الدين النصيحة»'),
      classify('روي عن النبي، في باب الصدق، أنه قال: «عليكم بالصدق»'),
      classify('اشرح قول النبي، في هذا الحديث: «الدين النصيحة»'),
    ];
    const unboundLaterGovernors = [
      classify('قال النبي كلامًا فكتب ابن تيمية: «تعلم الصبر»'),
      classify('قال النبي كلامًا فكتب المؤلف: «تعلم الصبر»'),
      classify('قال النبي كلامًا فنقل الباحث: «تعلم الصبر»'),
      classify('قال النبي كلامًا إذ كتب المؤلف: «تعلم الصبر»'),
      classify('قال النبي كلامًا بينما كتب المؤلف: «تعلم الصبر»'),
    ];
    const unquotedPropheticMention = classify('ما حكم الصلاة على النبي؟');
    ok('F-069 Qur\'anic quotation paraphrase is not classified as hadith',
      quranParaphrase.route === 'DEEN' && quranParaphrase.topic !== 'hadith',
      JSON.stringify(quranParaphrase));
    ok('F-069 quoted scholar saying is not classified as hadith',
      scholarParaphrase.route === 'DEEN' && scholarParaphrase.topic !== 'hadith',
      JSON.stringify(scholarParaphrase));
    ok('F-069 a frozen Qur\'anic quote that contains «النبي» remains tafsir',
      quranNamesProphet.route === 'DEEN' && quranNamesProphet.topic === 'tafsir'
        && quranNamesProphet.plan.claimSubject.frozen.kind === 'quran'
        && !quranNamesProphet.plan.claimSubject.religiousKind,
      JSON.stringify(quranNamesProphet));
    ok('F-069 an explicitly introduced ayah addressing the Prophet remains tafsir',
      quranAddressesProphet.route === 'DEEN' && quranAddressesProphet.topic === 'tafsir'
        && !quranAddressesProphet.plan.claimSubject.religiousKind,
      JSON.stringify(quranAddressesProphet));
    ok('F-069 a scholar quote about the Prophet stays bound to the human entity',
      scholarAboutProphet.route === 'DEEN' && scholarAboutProphet.topic !== 'hadith'
        && scholarAboutProphet.plan.claimRelation === 'ABOUT_ENTITY'
        && !scholarAboutProphet.plan.claimSubject.religiousKind,
      JSON.stringify(scholarAboutProphet));
    ok('F-069 a divine saying about the Prophet is not rebound from secondary «عن النبي»',
      divineAboutProphet.route === 'DEEN' && divineAboutProphet.topic !== 'hadith'
        && !divineAboutProphet.plan.claimSubject.religiousKind
        && !divineAboutProphet.plan.attribution.sacredAttribution,
      JSON.stringify(divineAboutProphet));
    ok('F-069 a titled human saying about the Prophet is not rebound from secondary «عن النبي»',
      titledHumanAboutProphet.route === 'DEEN' && titledHumanAboutProphet.topic !== 'hadith'
        && !titledHumanAboutProphet.plan.claimSubject.religiousKind
        && !titledHumanAboutProphet.plan.attribution.sacredAttribution,
      JSON.stringify(titledHumanAboutProphet));
    ok('F-069 a scholar discourse about the Prophet is not a Prophetic report',
      scholarDiscourseAboutProphet.route === 'DEEN' && scholarDiscourseAboutProphet.topic !== 'hadith'
        && !scholarDiscourseAboutProphet.plan.claimSubject.religiousKind
        && !scholarDiscourseAboutProphet.plan.attribution.sacredAttribution,
      JSON.stringify(scholarDiscourseAboutProphet));
    ok('F-069 a prophetic frame inside quoted divine content cannot become its governing speaker',
      divineQuoteContainingReport.route === 'DEEN' && divineQuoteContainingReport.topic !== 'hadith'
        && !divineQuoteContainingReport.plan.claimSubject.religiousKind
        && !divineQuoteContainingReport.plan.attribution.sacredAttribution
        && Number.isInteger(divineQuoteContainingReport.plan.claimSubject.quoteWordStart),
      JSON.stringify(divineQuoteContainingReport));
    ok('F-069 a Prophetic mention in a prior clause cannot govern a later divine quote',
      [priorPropheticThenDivine, priorIntroThenDivine].every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution),
      JSON.stringify({ priorPropheticThenDivine, priorIntroThenDivine }));
    ok('F-069 a prior unrelated Prophetic clause cannot govern a later plain quote',
      priorPropheticThenPlainQuote.route === 'DEEN' && priorPropheticThenPlainQuote.topic !== 'hadith'
        && !priorPropheticThenPlainQuote.plan.claimSubject.religiousKind
        && !priorPropheticThenPlainQuote.plan.attribution.sacredAttribution,
      JSON.stringify(priorPropheticThenPlainQuote));
    ok('F-069 plain about-Prophet relations are not treated as reported Prophetic speech',
      relationOnlyQuotes.every((entry) => entry.route === 'DEEN' && entry.topic !== 'hadith'
        && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution),
      JSON.stringify(relationOnlyQuotes));
    ok('F-069 a current about-Prophet relation cannot reopen an earlier Prophetic clause',
      priorPropheticThenRelation.every((entry) => entry.route === 'DEEN' && entry.topic !== 'hadith'
        && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution),
      JSON.stringify(priorPropheticThenRelation));
    ok('F-069 an explicit sequence boundary starts a new quote-introduction frame',
      unpunctuatedRequestBoundaries.every((entry) => entry.route === 'DEEN' && entry.topic !== 'hadith'
        && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution),
      JSON.stringify(unpunctuatedRequestBoundaries));
    ok('F-069 the nearest later Prophetic speaker outranks an earlier human capture',
      laterPropheticSpeaker.route === 'DEEN' && laterPropheticSpeaker.topic === 'hadith'
        && laterPropheticSpeaker.plan.attributionMode === 'none'
        && laterPropheticSpeaker.plan.claimSubject.religiousKind === 'prophetic'
        && laterPropheticSpeaker.plan.attribution.sacredAttribution.frameWordStart > 0,
      JSON.stringify(laterPropheticSpeaker));
    ok('F-069 a bound later Prophetic quote clears a stale earlier entity relation',
      registeredThenPropheticSpeaker.route === 'DEEN'
        && registeredThenPropheticSpeaker.topic === 'hadith'
        && registeredThenPropheticSpeaker.plan.claimRelation === 'NONE'
        && registeredThenPropheticSpeaker.plan.entities.length === 0
        && registeredThenPropheticSpeaker.plan.requestedAuthorityId === null,
      JSON.stringify(registeredThenPropheticSpeaker));
    ok('F-069 a later untrusted human governor fails closed instead of preserving an earlier Prophet',
      laterUntrustedHumanGovernor.every((entry) => entry.topic !== 'hadith'
        && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution),
      JSON.stringify(laterUntrustedHumanGovernor));
    ok('F-069 a primary transmitted «عن النبي» quote remains structured hadith',
      [narratedFromProphet, transmittedFromProphet, ...coordinatedNarratedReports]
        .every((entry) => entry.route === 'DEEN'
        && entry.topic === 'hadith' && entry.plan.claimSubject.religiousKind === 'prophetic'
        && entry.plan.attribution.sacredAttribution.kind === 'prophetic'
        && entry.plan.attribution.sacredAttribution.head !== 'عن'),
      JSON.stringify({ narratedFromProphet, transmittedFromProphet, coordinatedNarratedReports }));
    ok('F-069 coordinated bare «عن النبي» remains a relation, never a report',
      coordinatedBareRelations.every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(coordinatedBareRelations));
    ok('F-069 punctuation severs a narration head from a later about-Prophet relation',
      severedNarrationHeads.every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(severedNarrationHeads));
    ok('F-069 only the declared «رسول الله» composition may consume a divine complement',
      invalidDivineComplements.every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(invalidDivineComplements));
    ok('F-069 claim-gate and attribution share the raw quote boundary across attached punctuation',
      attachedPunctuationTails.every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && Number.isInteger(entry.plan.claimSubject.quoteCharStart)
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(attachedPunctuationTails));
    ok('F-069 a reader token equal to the internal sentinel remains real tail content',
      literalSentinelTail.route === 'DEEN' && literalSentinelTail.topic !== 'hadith'
        && !literalSentinelTail.plan.claimSubject.religiousKind
        && !literalSentinelTail.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: literalSentinelTail.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG',
      JSON.stringify(literalSentinelTail));
    ok('F-069 a material-from-site intent is a location, not a quoted speech governor',
      materialLocationQuotes.every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(materialLocationQuotes));
    ok('F-069 unproved Prophetic complements remain religious but explicitly UNBOUND',
      unboundPropheticComplements.every((entry) => entry.route === 'DEEN'
        && entry.topic === 'quote_verification'
        && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(unboundPropheticComplements));
    ok('F-069 generic courtesy formulas cannot bridge an unrelated Prophetic clause',
      nonPropheticCourtesyBridges.every((entry) => entry.route === 'DEEN' && entry.topic !== 'hadith'
        && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution),
      JSON.stringify(nonPropheticCourtesyBridges));
    ok('F-069 a centrally declared Prophetic honorific may bridge punctuation in the same frame',
      declaredHonorificReports.every((entry) => entry.route === 'DEEN' && entry.topic === 'hadith'
        && entry.plan.claimSubject.religiousKind === 'prophetic'
        && entry.plan.attribution.sacredAttribution.kind === 'prophetic'),
      JSON.stringify(declaredHonorificReports));
    ok('F-069 undeclared honorific spellings do not grow a hidden classification lexicon',
      undeclaredHonorificForms.every((entry) => entry.route === 'DEEN'
        && entry.topic === 'quote_verification' && !entry.plan.claimSubject.religiousKind),
      JSON.stringify(undeclaredHonorificForms));
    ok('F-069 descriptive complements stay closed-source but UNBOUND without structured grammar',
      unboundDescriptiveComplements.every((entry) => entry.route === 'DEEN'
        && entry.topic === 'quote_verification' && !entry.plan.claimSubject.religiousKind
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(unboundDescriptiveComplements));
    ok('F-069 an unrecognized later governor cannot inherit an earlier Prophetic speaker',
      unboundLaterGovernors.every((entry) => entry.route === 'DEEN'
        && entry.topic !== 'hadith' && !entry.plan.claimSubject.religiousKind
        && !entry.plan.attribution.sacredAttribution
        && AGE.access({ topicClass: entry.topic, audienceBand: 'adult' }).sourcePolicy
          === 'SHARIA_CLOSED_RAG'),
      JSON.stringify(unboundLaterGovernors));
    ok('F-069 a non-quote prophetic mention is a sharia question, not a hadith report',
      unquotedPropheticMention.route === 'DEEN' && unquotedPropheticMention.topic === 'sharia_ruling'
        && unquotedPropheticMention.plan.claimSubject.source === null
        && !unquotedPropheticMention.plan.claimSubject.religiousKind,
      JSON.stringify(unquotedPropheticMention));
    ok('F-069 a general linguistic quotation remains general knowledge',
      linguistic.route === 'GEN' && linguistic.topic === 'general_knowledge', JSON.stringify(linguistic));
    ok('F-069 a mathematics question remains general for young and adult',
      math.topic === 'general_knowledge'
        && ['young', 'adult'].every((band) => AGE.access({ topicClass: math.topic, audienceBand: band }).outcome === 'ALLOW'),
      JSON.stringify(math));
    ok('F-069 the runtime passes the already-decided route into the classifier',
      /const currentRuntime = classifyReligiousRuntime\(currentQuestionText, currentPlan, route\);/.test(read('api/ask.js'))
        && /classifyTopic\(questionText, currentPlan, effectiveRoute\)/.test(read('api/ask.js')));
    ok('F-069 Ledger passes its structured issue intents into the same classifier',
      /classifyTopic\(question, \{[\s\S]{0,160}intents: plan\.issues\.map/.test(read('lib/ledger/engine.js')));

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-'));
      const mutantFile = path.join(mutantDir, 'core-f069-mutant.mjs');
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/policy/core.js'), 'utf8');
        const positiveSignal = [
          "  const structuredPropheticSubject = effectiveRoute === 'DEEN'",
          "    && ir && ir.claimSubject && ir.claimSubject.religiousKind === 'prophetic';",
        ].join('\n');
        const broadSignal = [
          "  const structuredPropheticSubject = effectiveRoute === 'DEEN'",
          "    && ir && ir.claimSubject && ir.claimSubject.source === 'quote'",
          '    && ir.claimSubject.specific === true;',
        ].join('\n');
        const mutant = current.replace(positiveSignal, broadSignal);
        ok('F-069 fresh telemetry-era mutant was derived from the final structured signal',
          mutant !== current,
          'the structured signal moved; update the mutation seam instead of accepting stale evidence');
        if (mutant !== current) {
          fs.writeFileSync(mutantFile, mutant, 'utf8');
          const run = spawnSync(process.execPath, [__filename, '--core-source', mutantFile, '--mutation-run'], {
            cwd: REPO, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' },
          });
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 fresh quote+DEEN mutant is killed by Quran/scholar counterexamples',
            run.status !== 0 && /FAIL\s+F-069 (?:Qur'anic|quoted scholar)/.test(output),
            'status=' + run.status + '\n' + output.slice(-1600));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-secondary-'));
      const attributionMutantFile = path.join(mutantDir, 'attribution-f069-secondary-mutant.mjs');
      const askPlanMutantFile = path.join(mutantDir, 'ask-plan-f069-secondary-mutant.mjs');
      try {
        const currentAttribution = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const boundHead = '      if (capture.intent !== ATTRIBUTION_INTENT.MATERIAL_FROM_SITE\n'
          + "        && (capture.head !== norm('عن') || narrationHead)) {";
        const mutantAttribution = currentAttribution.replace(boundHead,
          '      if (capture.intent !== ATTRIBUTION_INTENT.MATERIAL_FROM_SITE && true) { '
          + '// F-069 mutant: every relation is a governing report');
        ok('F-069 fresh secondary-capture mutant was derived from the final attribution source',
          mutantAttribution !== currentAttribution,
          'the governing-head seam moved; update the mutant rather than dropping the binding proof');
        if (mutantAttribution !== currentAttribution) {
          const externalAttribution = mutantAttribution.replace(
            /from\s+(['"])([^'"]+)\1/g,
            (whole, quote, specifier) => {
              if (specifier.startsWith('node:')) return whole;
              const target = specifier.startsWith('.')
                ? path.resolve(REPO, 'lib', specifier)
                : require.resolve(specifier, { paths: [REPO] });
              return 'from ' + quote + 'file:///' + target.replace(/\\/g, '/') + quote;
            },
          );
          fs.writeFileSync(attributionMutantFile, externalAttribution, 'utf8');
          const currentAskPlan = fs.readFileSync(path.join(REPO, 'lib/ask-plan.js'), 'utf8');
          const mutantUrl = 'file:///' + attributionMutantFile.replace(/\\/g, '/');
          const mutantAskPlan = currentAskPlan.replace(
            "from './attribution.js';", "from '" + mutantUrl + "';");
          fs.writeFileSync(askPlanMutantFile, mutantAskPlan, 'utf8');
          const run = spawnSync(process.execPath,
            [__filename, '--ask-plan-source', askPlanMutantFile, '--mutation-run'], {
              cwd: REPO, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' },
            });
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 fresh secondary-«عن» capture mutant is killed by speaker-bound controls',
            run.status !== 0 && /FAIL\s+F-069 (?:a divine saying|a titled human saying|plain about-Prophet)/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-binding-'));
      const mutantFile = path.join(mutantDir, 'ask-plan-f069-global-mutant.mjs');
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/ask-plan.js'), 'utf8');
        const boundSignal = [
          '  const trustedPropheticQuote = detectedClaimSubject',
          "    && detectedClaimSubject.source === 'quote' && detectedClaimSubject.specific === true",
          "    && attribution.sacredAttribution && attribution.sacredAttribution.kind === 'prophetic'",
          '    && Number.isInteger(detectedClaimSubject.quoteCharStart)',
          '    && attribution.sacredAttribution.quoteCharStart === detectedClaimSubject.quoteCharStart',
          '    && Number.isInteger(attribution.sacredAttribution.subjectWordEnd)',
          '    && attribution.sacredAttribution.subjectWordEnd <= attribution.sacredAttribution.quoteWordStart',
          '    && attribution.sacredAttribution.frameWordStart < attribution.sacredAttribution.quoteWordStart',
          "    && (!detectedClaimSubject.frozen || detectedClaimSubject.frozen.kind !== 'quran')",
          "    && purpose !== 'tafsir';",
        ].join('\n');
        const globalSignal = [
          '  const trustedPropheticQuote = detectedClaimSubject',
          "    && detectedClaimSubject.source === 'quote' && detectedClaimSubject.specific === true",
          "    && question.includes('النبي');",
        ].join('\n');
        const mutant = current.replace(boundSignal, globalSignal);
        ok('F-069 fresh global-presence mutant was derived from the final bound planner signal',
          mutant !== current,
          'the bound signal moved; update the mutation seam instead of weakening the counterexamples');
        if (mutant !== current) {
          fs.writeFileSync(mutantFile, mutant, 'utf8');
          const run = spawnSync(process.execPath,
            [__filename, '--ask-plan-source', mutantFile, '--mutation-run'], {
              cwd: REPO, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' },
            });
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 fresh whole-question prophetic-presence mutant is killed by bound controls',
            run.status !== 0 && /FAIL\s+F-069 (?:a frozen Qur'anic|an explicitly introduced ayah|a scholar quote)/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-tail-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const tailProof = [
          '&& isPropheticSubjectSequence(',
          "          detectorWords.slice(candidate.nameWordStart, quoteWordStart).join(' '));",
        ].join('\n');
        const mutant = current.replace(tailProof,
          '&& true; // F-069 mutant: accept arbitrary words between subject and quote');
        ok('F-069 fresh subject-tail mutant was derived from the final attribution source',
          mutant !== current,
          'the structured tail-proof seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'subject-tail');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 arbitrary-tail mutant is killed by unbound/later-governor controls',
            run.status !== 0 && /FAIL\s+F-069 (?:a prior unrelated Prophetic clause|an explicit sequence boundary|unproved Prophetic complements|an unrecognized later governor)/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-governor-order-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const nearest = [
          'const governors = governingCandidates.filter(inScope)',
          '      .sort((a, b) => b.frameWordStart - a.frameWordStart || b.index - a.index);',
        ].join('\n');
        const mutant = current.replace(nearest, [
          'const governors = governingCandidates',
          '      .sort((a, b) => a.frameWordStart - b.frameWordStart || a.index - b.index);',
        ].join('\n'));
        ok('F-069 fresh governor-order mutant was derived from the final attribution source',
          mutant !== current,
          'the nearest-governor seam moved; update the mutant instead of losing two-speaker proof');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'governor-order');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 fresh earliest-speaker mutant is killed by the two-speaker control',
            run.status !== 0 && /FAIL\s+F-069 the nearest later Prophetic speaker/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-primary-relation-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const relationStart = '      if (capture.intent !== ATTRIBUTION_INTENT.MATERIAL_FROM_SITE\n'
          + "        && (capture.head !== norm('عن') || narrationHead)) {";
        const mutant = current.replace(relationStart,
          "      if (capture.intent !== ATTRIBUTION_INTENT.MATERIAL_FROM_SITE && capture.head !== norm('عن')) { "
          + '// F-069 mutant: reject every relation');
        ok('F-069 fresh primary-«عن» mutant was derived from the final attribution source',
          mutant !== current,
          'the primary relation seam moved; update the mutant instead of losing narrated reports');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'primary-relation');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 fresh blanket-«عن» rejection mutant is killed by narrated-report controls',
            run.status !== 0 && /FAIL\s+F-069 a primary transmitted «عن النبي»/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-severed-relation-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const structuralPrevious = '      const previousWord = capture.previousDetectorToken;';
        const ordinalPrevious = [
          '      const previousWord = capture.frameWordStart > 0',
          "        ? detectorWords[capture.frameWordStart - 1] || '' : '';",
        ].join('\n');
        const mutant = current.replace(structuralPrevious, ordinalPrevious);
        ok('F-069 fresh punctuation-adjacency mutant was derived from the final attribution source',
          mutant !== current,
          'the detector-token seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'severed-relation');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 punctuation-adjacency mutant is killed by severed narration controls',
            run.status !== 0 && /FAIL\s+F-069 punctuation severs a narration head/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-coordinated-head-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const canonicalHead = '    head: canonicalCaptureHead(match[0]),';
        const mutant = current.replace(canonicalHead,
          "    head: norm(match[0]).split(' ')[0] || '', // F-069 mutant: keep و/ف prefix");
        ok('F-069 fresh coordinated-head mutant was derived from the final attribution source',
          mutant !== current,
          'the canonical-head seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'coordinated-head');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 coordinated-head mutant is killed by bare-relation controls',
            run.status !== 0 && /FAIL\s+F-069 coordinated bare/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-coordinated-relation-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const relationAdjacency = "      const narrationHead = capture.head === norm('عن') && !capture.headCoordinated";
        const mutant = current.replace(relationAdjacency,
          "      const narrationHead = capture.head === norm('عن')");
        ok('F-069 fresh coordinated-relation mutant was derived from the final attribution source',
          mutant !== current,
          'the coordinated-relation seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'coordinated-relation');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 coordinated-relation mutant is killed by separated-relation controls',
            run.status !== 0 && /FAIL\s+F-069 coordinated bare/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-sentinel-collision-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const escapedSentinel =
          ".replaceAll(CLAUSE_SENTINEL, CLAUSE_SENTINEL + 'userword')";
        const mutant = current.replace(escapedSentinel,
          '.replaceAll(CLAUSE_SENTINEL, CLAUSE_SENTINEL)');
        ok('F-069 fresh sentinel-collision mutant was derived from the final attribution source',
          mutant !== current,
          'the sentinel-escape seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'sentinel-collision');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 sentinel-collision mutant is killed by literal-content control',
            run.status !== 0 && /FAIL\s+F-069 a reader token equal/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-site-intent-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const intentGate = '      if (capture.intent !== ATTRIBUTION_INTENT.MATERIAL_FROM_SITE\n'
          + "        && (capture.head !== norm('عن') || narrationHead)) {";
        const mutant = current.replace(intentGate,
          "      if (capture.head !== norm('عن') || narrationHead) { // F-069 mutant: site is speech");
        ok('F-069 fresh material-intent mutant was derived from the final attribution source',
          mutant !== current,
          'the site-intent seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'site-intent');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 material-intent mutant is killed by location controls',
            run.status !== 0 && /FAIL\s+F-069 a material-from-site/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-coordinate-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const detectorCoordinate = [
          '  const quoteWordStart = quoteCharStart >= 0',
          '    ? wordOrdinalAt(quotePrefix, quotePrefix.length) : -1;',
        ].join('\n');
        const foreignCoordinate = [
          '  const quoteWordStart = quoteCharStart >= 0',
          '    ? structuredSubject.quoteWordStart : -1;',
        ].join('\n');
        const mutant = current.replace(detectorCoordinate, foreignCoordinate);
        ok('F-069 fresh quote-coordinate mutant was derived from the final attribution source',
          mutant !== current,
          'the detector-coordinate seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'quote-coordinate');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 quote-coordinate mutant is killed by attached-punctuation controls',
            run.status !== 0 && /FAIL\s+F-069 claim-gate and attribution share/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-divine-complement-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/policy/sacred-attribution.js'), 'utf8');
        const boundComposition = '  if (firstAcceptsDivineComplement) {';
        const mutant = current.replace(boundComposition,
          '  if (true) { // F-069 mutant: every Prophetic label consumes a divine complement');
        ok('F-069 fresh divine-complement mutant was derived from the final sacred source',
          mutant !== current,
          'the composition seam moved; update the mutant instead of accepting stale evidence');
        if (mutant !== current) {
          const externalSacredFile = path.join(mutantDir, 'sacred-attribution-mutant.mjs');
          const externalSacred = mutant.replace(
            /from\s+(['"])([^'"]+)\1/g,
            (whole, quote, specifier) => {
              if (specifier.startsWith('node:')) return whole;
              const target = specifier.startsWith('.')
                ? path.resolve(REPO, 'lib/policy', specifier)
                : require.resolve(specifier, { paths: [REPO] });
              return 'from ' + quote + 'file:///' + target.replace(/\\/g, '/') + quote;
            },
          );
          fs.writeFileSync(externalSacredFile, externalSacred, 'utf8');
          const currentAttribution = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
          const sacredUrl = 'file:///' + externalSacredFile.replace(/\\/g, '/');
          const externalAttribution = currentAttribution.replace(
            "from './policy/sacred-attribution.js';", "from '" + sacredUrl + "';");
          const run = runAttributionMutant(mutantDir, externalAttribution, 'divine-complement');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 divine-complement mutant is killed by invalid composition controls',
            run.status !== 0 && /FAIL\s+F-069 only the declared/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f069-suffix-head-'));
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/attribution.js'), 'utf8');
        const exactHead = "          && relationReportHead(head) && previousWord === head) || ''";
        const mutant = current.replace(exactHead,
          "          && (relationReportHead(head) ? previousWord === head : previousWord.endsWith(head))) || ''" );
        ok('F-069 fresh suffix-head mutant was derived from the final attribution source',
          mutant !== current,
          'the exact narration-head seam moved; update the mutant instead of accepting noun suffixes');
        if (mutant !== current) {
          const run = runAttributionMutant(mutantDir, mutant, 'suffix-head');
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-069 fresh suffix-head mutant is killed by relation-noun controls',
            run.status !== 0 && /FAIL\s+F-069 plain about-Prophet relations/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }

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
    const ledger = read('lib/ledger/engine.js');
    ok('the legacy path imports the shared core',
      /^\s*import\s+[^;]+\s+from\s+['"]\.\.\/lib\/policy\/core\.js['"]\s*;/m.test(legacy));
    ok('the ledger engine independently imports the same core',
      /^\s*import\s+[^;]+\s+from\s+['"]\.\.\/policy\/core\.js['"]\s*;/m.test(ledger));
    ok('no second policy version is declared anywhere',
      P.POLICY_VERSION === V.POLICY_VERSION);
    eq('the guard-side causal inventory preserves the former drift coverage', policyInventory(P), []);

    const inventoryRejects = (name, candidate, fragment) => {
      const problems = policyInventory(candidate);
      return ok('F-071 causal parity: ' + name,
        problems.some((problem) => problem.includes(fragment)), JSON.stringify(problems));
    };
    inventoryRejects('policy version self-mismatch is detected',
      { ...P, POLICY_VERSION: 'f071-mutant-policy-version' }, 'policy version disagrees');
    inventoryRejects('an empty declared version is detected',
      { ...P, versions: () => ({ ...P.versions(), registryVersion: '' }) }, 'version registryVersion');
    inventoryRejects('an ordinary reviewed matrix cell becoming unreviewed is detected',
      {
        ...P,
        matrix: (topic, band) => topic === 'schoolwork' && band === 'teen'
          ? { ...P.matrix(topic, band), unreviewed: true } : P.matrix(topic, band),
      }, 'schoolwork x teen');
    inventoryRejects('an unknown source policy is detected',
      {
        ...P,
        matrix: (topic, band) => topic === 'schoolwork' && band === 'adult'
          ? { ...P.matrix(topic, band), sourcePolicy: 'F071_UNKNOWN_SOURCE' } : P.matrix(topic, band),
      }, 'unknown source policy');
    inventoryRejects('a benign list member outside the topic vocabulary is detected',
      { ...P, GENERAL_CHILD_BENIGN: [...P.GENERAL_CHILD_BENIGN, 'f071_unknown_benign'] },
      'benign list names an unknown topic');
    inventoryRejects('a benign young outcome that is no longer ALLOW is detected',
      {
        ...P,
        matrix: (topic, band) => topic === P.GENERAL_CHILD_BENIGN[0] && band === 'young'
          ? { ...P.matrix(topic, band), outcome: 'ALLOW_LIMITED' } : P.matrix(topic, band),
      }, 'benign topic is not ALLOW');
    for (const hazard of ['hazardous_chemistry', 'self_harm', 'weapons_explosives', 'electrical_hazard']) {
      inventoryRejects(hazard + ' losing a redirect is detected', {
        ...P,
        matrix: (topic, band) => topic === hazard && band === 'adult'
          ? { ...P.matrix(topic, band), outcome: 'ALLOW' } : P.matrix(topic, band),
      }, 'hazard not redirected: ' + hazard + ':adult');
    }

    eq('F-071 injectable roster inventory preserves every removed roster rule',
      rosterInventory(E, SPOL, SOURCE_REGISTRY), []);
    const ownerRow = SPOL.POLICY_ROWS.find((row) => row.ownerId && row.health === 'enabled'
      && SOURCE_REGISTRY.SCHOLAR_SITES.some((site) => site.domain === row.domain && site.aliases.length > 0));
    ok('F-071 roster fixtures found a real enabled owner row', !!ownerRow, JSON.stringify(ownerRow));
    if (ownerRow) {
      const historicalCollision = {
        canonicalId: ownerRow.ownerId, display: 'F071 historical collision',
        targetType: 'person', era: 'historical', aliases: ['f071-historical-collision'], candidates: [],
      };
      const historicalProblems = rosterInventory(
        { ...E, ROSTER: [...E.ROSTER, historicalCollision] }, SPOL, SOURCE_REGISTRY);
      ok('F-071 causal roster parity: historical/source-owner collision is detected',
        historicalProblems.some((problem) => problem === 'historical/source-policy collision:' + ownerRow.ownerId),
        JSON.stringify(historicalProblems));

      const eraProblems = rosterInventory({
        ...E, eraOf: (id) => id === ownerRow.ownerId ? 'historical' : E.eraOf(id),
      }, SPOL, SOURCE_REGISTRY);
      ok('F-071 causal roster parity: every owner must remain contemporary',
        eraProblems.some((problem) => problem === 'owner era mismatch:' + ownerRow.ownerId),
        JSON.stringify(eraProblems));

      const derivedProblems = rosterInventory({
        ...E, CONTEMPORARY_IDS: E.CONTEMPORARY_IDS.filter((id) => id !== ownerRow.ownerId),
      }, SPOL, SOURCE_REGISTRY);
      ok('F-071 causal roster parity: derived enabled contemporary IDs are required',
        derivedProblems.some((problem) => problem === 'derived contemporary missing:' + ownerRow.ownerId),
        JSON.stringify(derivedProblems));

      const ownerProblems = rosterInventory(E, {
        ...SPOL, ownerOf: (domain) => domain === ownerRow.domain ? 'f071-wrong-owner' : SPOL.ownerOf(domain),
      }, SOURCE_REGISTRY);
      ok('F-071 causal roster parity: enabled domain owner mapping is required',
        ownerProblems.some((problem) => problem === 'domain/owner mismatch:' + ownerRow.domain),
        JSON.stringify(ownerProblems));
    }

    const firstAliased = E.ROSTER.find((entity) => Array.isArray(entity.aliases) && entity.aliases.length);
    const aliasCollision = {
      canonicalId: 'f071-alias-collision', display: 'F071 alias collision',
      targetType: 'person', era: 'historical', aliases: [firstAliased.aliases[0]], candidates: [],
    };
    const aliasProblems = rosterInventory(
      { ...E, ROSTER: [...E.ROSTER, aliasCollision] }, SPOL, SOURCE_REGISTRY);
    ok('F-071 causal roster parity: aliases may not collide across canonical IDs',
      aliasProblems.some((problem) => problem === 'ambiguous alias:' + firstAliased.aliases[0]),
      JSON.stringify(aliasProblems));

    ok('F-071 dead policy export is absent while the live matrix remains covered',
      !Object.prototype.hasOwnProperty.call(P, 'driftProblems'));
    ok('F-071 dead ambiguity/roster exports are absent while live entity behavior remains covered',
      !Object.prototype.hasOwnProperty.call(E, 'ambiguityOutcome')
        && !Object.prototype.hasOwnProperty.call(E, 'rosterDriftProblems'));
    eq('F-071 runtime inventory proves zero callers for ambiguityOutcome', runtimeMentions('ambiguityOutcome'), []);
    eq('F-071 runtime inventory proves zero callers for rosterDriftProblems', runtimeMentions('rosterDriftProblems'), []);
    eq('F-071 runtime inventory proves zero callers for driftProblems', runtimeMentions('driftProblems'), []);

    if (!mutationRun) {
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a7-f071-'));
      const mutantFile = path.join(mutantDir, 'core-f071-mutant.mjs');
      try {
        const current = fs.readFileSync(path.join(REPO, 'lib/policy/core.js'), 'utf8');
        const mutant = current.replace('  schoolwork: BENIGN,\n',
          '  // F-071 mutant: ordinary reviewed matrix row removed.\n');
        ok('F-071 fresh matrix mutant was derived from the final policy source', mutant !== current,
          'the schoolwork row moved; update the mutation seam instead of accepting masked coverage');
        if (mutant !== current) {
          fs.writeFileSync(mutantFile, mutant, 'utf8');
          const run = spawnSync(process.execPath, [__filename, '--core-source', mutantFile, '--mutation-run'], {
            cwd: REPO, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' },
          });
          const output = String(run.stdout || '') + String(run.stderr || '');
          ok('F-071 fresh missing-row mutant is killed instead of being masked by UNKNOWN_CELL',
            run.status !== 0 && /FAIL\s+the guard-side causal inventory/.test(output)
              && /schoolwork x (?:young|teen|adult|unknown)/.test(output),
            'status=' + run.status + '\n' + output.slice(-1800));
        }
      } finally {
        fs.rmSync(mutantDir, { recursive: true, force: true });
      }
    }
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
