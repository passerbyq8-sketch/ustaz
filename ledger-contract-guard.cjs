// ledger-contract-guard.cjs — the contracts the ledger engine rests on, and the three things
// the source policy may never do.
//
// WHAT THIS GATE IS FOR. The engine's whole safety argument is "a source may only back what it
// is declared fit to back, and a model may only propose a description that code validated".
// Both halves are data-driven, and data drifts silently. So:
//
//   * the searchable set here is asserted EQUAL to lib/source-registry.js's active domains — a
//     domain cannot be smuggled in by adding a row, and cannot be lost by forgetting one;
//   * a domain the registry blocks may not be enabled here, and a purpose the registry
//     withholds may not be granted here;
//   * a scholar's primary opinion requires a REGISTERED adapter, and the refusal when there is
//     none happens at plan time, before a search is planned and therefore before it costs
//     anything;
//   * the IR validator is exercised against the malformed shapes a model actually produces —
//     unknown enum, unknown field, invented id, dependency cycle, over-long list.
//
// Offline and deterministic. No network, no model, no key.
//
// Usage: node ledger-contract-guard.cjs
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
// The planner's example is the first BALANCED JSON object in the prompt. Taken by brace depth
// rather than by the prose that follows it, so adding a paragraph between the example and the
// filling rules cannot silently change what this gate measures.
const templateOf = (p) => {
  const a = String(p || '').indexOf('{');
  if (a === -1) return '';
  let d = 0;
  for (let i = a; i < p.length; i++) {
    if (p[i] === '{') d++;
    else if (p[i] === '}') { d--; if (d === 0) return p.slice(a, i + 1); }
  }
  return '';
};

(async function main() {
  console.log('=== ledger-contract-guard — capabilities, source policy, and the query IR ===');

  const C = await esm('lib/ledger/capability.js');
  const SP = await esm('lib/ledger/source-policy.js');
  const IR = await esm('lib/ledger/query-ir.js');
  const R = await esm('lib/source-registry.js');
  const PLAN = await esm('lib/ledger/planner.js');

  // =========================================================================
  console.log('\n=== A. THE SEVEN CAPABILITIES ===');
  eq('the declared set', C.CAPABILITIES.slice(), [
    'fatwa', 'tafsir', 'hadith_text', 'hadith_grading', 'hadith_explanation',
    'scholar_opinion_primary', 'general_article',
  ]);
  ok('hadith is THREE capabilities, not one',
    C.CAPABILITIES.filter((x) => x.startsWith('hadith_')).length === 3);
  ok('an unknown capability is not a capability', !C.isCapability('fatwaa') && !C.isCapability(''));
  // Absence is a refusal. A policy that forgets a capability must not inherit one.
  {
    const p = C.policy({ fatwa: 90 });
    eq('a capability absent from a row is INELIGIBLE', p.tafsir, { eligible: false, priority: 0 });
    eq('...and the one named is eligible with its priority', p.fatwa, { eligible: true, priority: 90 });
    ok('an out-of-range priority is rejected outright', (() => {
      try { C.policy({ fatwa: 0 }); return false; } catch { return true; }
    })());
    ok('an unknown capability name is rejected outright', (() => {
      try { C.policy({ nope: 50 }); return false; } catch { return true; }
    })());
  }
  eq('every intent maps to exactly one capability',
    C.INTENTS.filter((i) => !C.capabilityForIntent(i)), []);
  eq('scholar_opinion maps to the PRIMARY capability',
    C.capabilityForIntent('scholar_opinion'), 'scholar_opinion_primary');

  // =========================================================================
  console.log('\n=== B. THE POLICY MAY NOT ADD, ACTIVATE OR RELAX ===');
  eq('no conformance problems', SP.conformanceProblems(), []);
  {
    const registryActive = R.activeSources().map((s) => s.domain).sort();
    eq('the searchable set IS the registry\'s active set', SP.searchableDomains().slice().sort(), registryActive);
    // 24 until 2026-08-05; 22 since dorar.net, tafsir.app and ferkous.com were DEFERRED and
    // ferkous.app admitted in their place (net -2). The number is pinned DELIBERATELY so that a
    // domain appearing or vanishing is a failing gate rather than a quiet drift.
    ok('...and that is 22 domains', registryActive.length === 22, String(registryActive.length));
  }
  // The one adapter-only host: declared, and deliberately unsearchable.
  {
    const r = SP.policyFor('binothaimeen.net');
    ok('the Ibn Uthaymeen adapter host has a row', !!r);
    eq('...and it is NOT searchable', r.searchable, false);
    ok('...so it never enters a site list', !SP.searchableDomains().includes('binothaimeen.net'));
    ok('...and the shipped adapter still does not use Brave',
      !/brave|BRAVE/i.test(read('lib/binothaimeen.js')));
  }
  // A blocked domain reaches nothing.
  {
    eq('shkhudheir.com is disabled here', SP.policyFor('shkhudheir.com').health, 'disabled');
    for (const c of C.CAPABILITIES) {
      eq('...and ineligible for ' + c, SP.capabilityEligible('shkhudheir.com', c), false);
    }
    ok('...and on no capability list',
      C.CAPABILITIES.every((c) => !SP.domainsForCapability(c).includes('shkhudheir.com')));
  }
  // shamela.ws was removed from the shipped path and must not reappear.
  ok('shamela.ws is on no list and has no row',
    !SP.policyFor('shamela.ws') && !SP.searchableDomains().includes('shamela.ws'));
  // An unknown domain is ineligible for everything — the OPPOSITE default from the registry's
  // scope filter, and deliberately so.
  ok('an unknown domain is eligible for nothing',
    C.CAPABILITIES.every((c) => !SP.capabilityEligible('evil.example.com', c)));
  ok('...while the shipped scope filter still lets an unknown domain through (unchanged)',
    R.sourceAllowsPurpose('evil.example.com', 'fatwa'));

  // =========================================================================
  console.log('\n=== C. THE RESTRICTIONS THE BRIEF NAMES, EACH ONE ASSERTED ===');
  const CASES = [
    // DEFERRED 2026-08-05 (HTTP 403 for every server-side client, including its own published API).
    // The restriction the brief named — a hadith source, never a tafsir source, never a primary
    // opinion — is still asserted, and now the deferral is asserted on top of it: a non-enabled row
    // grants NOTHING, so the two former grants must have gone too.
    ['dorar.net', { hadith_grading: false, hadith_text: false, tafsir: false, scholar_opinion_primary: false }],
    ['tafsir.net', { tafsir: true, fatwa: false, hadith_grading: false, scholar_opinion_primary: false }],
    // DEFERRED 2026-08-05 (client-rendered, zero extractable characters). Same shape as dorar.net:
    // the original refusals stand, and the former grant is gone with the deferral.
    ['tafsir.app', { tafsir: false, fatwa: false, hadith_grading: false }],
    ['al-abbaad.com', { hadith_text: true, hadith_explanation: true, fatwa: false, tafsir: false, scholar_opinion_primary: false }],
    ['saleh.af.org.sa', { general_article: true, fatwa: false, tafsir: false, hadith_text: false }],
    ['khaledalsabt.com', { tafsir: true, general_article: true, fatwa: false, hadith_grading: false }],
    ['ibn-jebreen.com', { fatwa: true, scholar_opinion_primary: false }],
    ['mostafaaladwy.com', { fatwa: true, scholar_opinion_primary: false }],
    ['almunajjid.com', { general_article: true, fatwa: false }],
    ['khutabaa.com', { general_article: true, fatwa: false, tafsir: false }],
    ['salafcenter.org', { general_article: true, fatwa: false, hadith_grading: false }],
    ['eftaa.awqaf.gov.kw', { fatwa: true, scholar_opinion_primary: false }],
    ['dr-mutlaq.com', { general_article: true, hadith_grading: false, scholar_opinion_primary: false }],
    ['binbaz.org.sa', { fatwa: true, scholar_opinion_primary: true }],
  ];
  for (const [domain, want] of CASES) {
    for (const [capability, expected] of Object.entries(want)) {
      eq(domain + ' / ' + capability, SP.capabilityEligible(domain, capability), expected);
    }
  }
  // Capability gates keep the three families apart across the WHOLE table.
  {
    const fatwaOnly = SP.domainsForCapability('fatwa');
    const tafsirOnly = SP.domainsForCapability('tafsir');
    const gradingOnly = SP.domainsForCapability('hadith_grading');
    ok('a khutbah archive backs no ruling', !fatwaOnly.includes('khutabaa.com'));
    ok('a tafsir centre backs no ruling', !fatwaOnly.includes('tafsir.net'));
    ok('a hadith encyclopedia is not a tafsir source', !tafsirOnly.includes('dorar.net'));
    ok('a Quran-studies centre grades no hadith', !gradingOnly.includes('tafsir.net'));
    ok('an audio-only corpus backs no ruling', !fatwaOnly.includes('saleh.af.org.sa'));
    ok('every capability list is non-empty', C.CAPABILITIES.every((c) => SP.domainsForCapability(c).length > 0),
      C.CAPABILITIES.map((c) => c + '=' + SP.domainsForCapability(c).length).join(' '));
  }
  // eligibleSites RETURNS EMPTY rather than falling back: here an empty list means "refuse", not
  // "search everything".
  //
  // THE TWO FILTERS NOW AGREE, AND THAT IS THE FIX, NOT A LOST ASSERTION. This block used to
  // record a DIVERGENCE — the ledger refused, the shipped scope filter fell back to the unfiltered
  // list — and the divergence was the defect. MEASURED: filterSitesForPurpose(SITES_GENERAL,
  // 'fatwa') handed back all four news domains, every one of which carries `scopes: []` precisely
  // so that a news page can never back a ruling. The fallback returned exactly what the rule had
  // refused. It is gone, and the assertion below is now that both halves of the app refuse the
  // same thing rather than that one of them does.
  {
    const none = SP.eligibleSites(['khutabaa.com', 'salafcenter.org'], 'fatwa');
    eq('an all-ineligible list narrows to nothing (no fallback)', none, []);
    eq('...and the shipped filter now refuses it too, instead of falling back',
      R.filterSitesForPurpose(['khutabaa.com', 'salafcenter.org'], 'fatwa'), []);
    // The narrowing is still a NARROWING, not a wipe: an eligible member survives.
    eq('...while a list with an eligible member keeps exactly that member',
      R.filterSitesForPurpose(['khutabaa.com', 'islamqa.info'], 'fatwa'), ['islamqa.info']);
  }

  // =========================================================================
  console.log('\n=== D. A PRIMARY OPINION NEEDS A REGISTERED ADAPTER ===');
  {
    ok('Ibn Uthaymeen has one', !!SP.primaryOpinionAdapter('ibn-uthaymeen'));
    ok('Ibn Baz has one', !!SP.primaryOpinionAdapter('ibn-baz'));
    for (const who of ['al-abbaad', 'khaled-alsabt', 'almunajjid', 'saleh-al-sheikh',
      'eftaa-committee-kw', 'mostafa-aladwy', 'ibn-jebreen', 'al-barrak', 'ferkous', 'dorar']) {
      eq('«' + who + '» has NO primary-opinion adapter', SP.primaryOpinionAdapter(who), null);
    }
    eq('an invented owner has none', SP.primaryOpinionAdapter('nobody-at-all'), null);
    eq('a null owner has none', SP.primaryOpinionAdapter(null), null);
  }
  // The name -> owner path goes through the shipped resolver, so its ambiguity rule holds.
  {
    eq('«ابن باز» resolves to ibn-baz', SP.authorityIdForScholarName('ابن باز'), 'ibn-baz');
    eq('«عبدالمحسن العباد» resolves to al-abbaad', SP.authorityIdForScholarName('عبدالمحسن العباد'), 'al-abbaad');
    eq('...but he has no adapter, so his opinion is unreadable', SP.primaryOpinionAdapter('al-abbaad'), null);
    for (const bare of ['عبدالله', 'محمد', 'الشيخ', 'خالد']) {
      eq('a bare fragment «' + bare + '» resolves nobody', SP.authorityIdForScholarName(bare), null);
    }
    eq('an ambiguous name resolves nobody', SP.authorityIdForScholarName('ابن باز ابن جبرين'), null);
  }
  // Every id the planner shows the model is one the validator will accept.
  {
    const shown = PLAN.knownAuthorityIds();
    ok('the planner shows only registered owner ids',
      shown.every((id) => SP.POLICY_ROWS.some((r) => r.ownerId === id && r.health === 'enabled')));
    ok('...and shows no domain, url or site name',
      shown.every((id) => !/[./:]/.test(id)), JSON.stringify(shown.filter((id) => /[./:]/.test(id))));
  }

  // =========================================================================
  // THE PROMPT MUST ASK FOR SOMETHING THE VALIDATOR ACCEPTS
  //
  // MEASURED, batch 5: every ledger request came back PLAN_INVALID -> SAFE_REJECTION with
  // `model: 1, brave: 0, fetch: 0` — one planner call, then a refusal, without ever searching.
  //
  // DIAGNOSED HERE. The prompt prints a JSON TEMPLATE and says «صِفْه بهذا الشكلِ حرفيًّا», and
  // that template is itself invalid three ways over:
  //
  //   1. it prints the ALTERNATIONS AS VALUES — "intent": "fatwa|tafsir|…" and "temporal_scope":
  //      "unknown|dated_fact|…" — so a model reproducing the shape literally, as instructed,
  //      sends a pipe-joined string that validateIssue() refuses on both fields;
  //   2. every array is printed EMPTY, and an issue with no core term, protected entity or exact
  //      phrase is refused — while `core_terms` is the one field the filling rules never mention;
  //   3. any extra top-level key is a hard refusal, and the only instruction against one says «no
  //      TEXT outside the object», which a model obeys while adding a field INSIDE it.
  //
  // The validator is right in all three cases and is not relaxed. The example it was given is
  // what has to change. These assertions pin the two sides into agreement.
  console.log('\n=== D2. THE PLANNER ASKS FOR WHAT THE VALIDATOR ACCEPTS ===');
  {
    const prompt = PLAN.buildPlannerPrompt('ما حكم صيام يوم عرفة لغير الحاج؟');
    const tpl = templateOf(prompt);

    // 1. No alternation may appear as a VALUE in the template.
    const alternations = (tpl.match(/"[a-z_]+"\s*:\s*"[^"]*\|[^"]*"/g) || []);
    ok('the template shows no pipe-alternation as a field value',
      alternations.length === 0, JSON.stringify(alternations));

    // 2. The template, taken literally, must PARSE and VALIDATE. A shape a model is told to
    //    reproduce «حرفيًّا» and that cannot pass is a prompt that guarantees its own refusal.
    let parsed = null;
    try { parsed = JSON.parse(tpl.trim()); } catch (e) { /* reported below */ }
    ok('the template the prompt prints is itself parseable JSON', !!parsed,
      'a model told to reproduce it literally cannot produce valid JSON from it');
    if (parsed) {
      const v = IR.validateQueryPlan(parsed, 'ما حكم صيام يوم عرفة لغير الحاج؟');
      ok('...and it is itself a VALID plan', v.ok, JSON.stringify(v.problems));
    } else { checks++; failures++; console.log('  FAIL  ...and it is itself a VALID plan'); }

    // 3. The one field whose emptiness is fatal must be named in the filling rules.
    ok('the filling rules tell the model core_terms may not be empty',
      /core_terms/.test(prompt) && /core_terms[\s\S]{0,200}/.test(prompt)
      && prompt.indexOf('core_terms') !== prompt.lastIndexOf('core_terms'),
      'core_terms appears only in the template, never in the rules');

    // 4. The refusal on unknown fields is a real security rule («the next invented field might be
    //    `sites`»), so it is NOT relaxed — it is STATED, where the model can obey it.
    ok('the prompt forbids inventing a field, not merely prose outside the object',
      /حقل|حقول/.test(prompt) && /لا تُضِفْ|لا تزد|ولا تزيد|بلا حقول/.test(prompt),
      'the validator refuses unknown keys and nothing tells the model so');
    const IRSRC = read('lib/ledger/query-ir.js');
    ok('...and the validator still refuses them',
      /unknown top-level field: /.test(IRSRC), 'the strictness must not be traded away');
  }

  // =========================================================================
  // THE STRICTEST TASK DOES NOT RUN ON THE WEAKEST MODEL
  //
  // MEASURED, 2026-08-07: lib/ledger/seam.js never passed `tier`, so every request through the
  // seam reached callModel() with `tier === undefined`, which defaults to 'standard', which
  // production sets to Haiku. The one call that decides whether the request searches at all ran
  // on the cheapest channel for everybody — including a reader entitled to more.
  //
  // DRIVEN, NOT GREPPED. The stub reads the model out of the request body the planner actually
  // built, so deleting the pin fails this section rather than a regex.
  console.log('\n=== D2b. THE PLAN CALL PINS THE STRONGEST CHANNEL ===');
  {
    const MODEL = await esm('lib/ledger/model.js');
    const BG = await esm('lib/ledger/budgets.js');
    const env = ['MODEL_PREMIUM', 'MODEL_STANDARD', 'MODEL', 'ANTHROPIC_API_KEY'];
    const saved = env.map((k) => [k, Object.prototype.hasOwnProperty.call(process.env, k), process.env[k]]);
    process.env.MODEL_PREMIUM = 'test-premium-channel';
    process.env.MODEL_STANDARD = 'test-standard-channel';
    delete process.env.MODEL;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
    const sent = [];
    const stubFetch = async (_url, init) => {
      sent.push(JSON.parse(init.body).model);
      return {
        ok: true, status: 200,
        json: async () => ({ content: [{ type: 'text', text: '{}' }] }),
        text: async () => '{}',
      };
    };
    try {
      eq('the tier constant names the strongest configured channel', PLAN.PLANNER_TIER, 'premium');
      // The seam's own shape: no `tier` anywhere. This is the case that was broken.
      await PLAN.planQuestion('ما حكم بيع الذهب بالتقسيط؟', {
        budget: new BG.Budget({ now: () => 1770000000000 }), fetchImpl: stubFetch,
      });
      // And a caller that hands in the reader's ordinary tier must not drag it back down.
      await PLAN.planQuestion('ما حكم بيع الذهب بالتقسيط؟', {
        budget: new BG.Budget({ now: () => 1770000000000 }), fetchImpl: stubFetch, tier: 'standard',
      });
      eq('both plan calls went out on MODEL_PREMIUM', sent, ['test-premium-channel', 'test-premium-channel']);
      eq('...and the standard channel is a DIFFERENT string, so the check is not vacuous',
        MODEL.modelFor('standard'), 'test-standard-channel');
    } finally {
      for (const [k, had, v] of saved) { if (had) process.env[k] = v; else delete process.env[k]; }
    }
    // THE ANSWER'S TIER IS UNTOUCHED. Pinning the plan call is not «the engine upgrades a tier»:
    // every call whose output the reader receives still runs on whatever the caller passed.
    const ENGSRC = read('lib/ledger/engine.js');
    for (const site of ['runExtraction', 'runGate2', 'runGate3', 'runDraft']) {
      const i = ENGSRC.indexOf(site + '(');
      ok(site + ' still runs on the CALLER\'s tier', i !== -1
        && /tier: opts\.tier/.test(ENGSRC.slice(i, i + 400)), 'no `tier: opts.tier` near ' + site);
    }
    ok('...and the plan call no longer takes one at all',
      /planQuestion\(question, \{[^}]*\}\)/.test(ENGSRC)
      && !/planQuestion\(question, \{[^}]*tier/.test(ENGSRC));
  }

  // =========================================================================
  // AND THE REFUSAL MUST SAY WHICH FIELD BROKE
  console.log('\n=== D3. PLAN_INVALID NAMES THE FIELD ===');
  {
    const ENGSRC = read('lib/ledger/engine.js');
    // `planned.reason` is the constant string 'schema' whenever validation failed, so
    // `planned.reason || problems` discarded the problems every single time. The ledger recorded
    // «PLAN_INVALID / schema» and never once said which field — which is exactly why this cost
    // hours to find. Same lesson as batch 5 step 1, in the engine instead of the retriever.
    ok('the PLAN_INVALID rejection carries the validator problems, not just the word "schema"',
      !/REJECTION\.PLAN_INVALID, planned\.reason \|\| \(planned\.problems/.test(ENGSRC),
      'planned.reason is always truthy on failure, so the problems were never recorded');
    ok('...and the problems are actually in the reason it records',
      /REJECTION\.PLAN_INVALID,[\s\S]{0,240}planned\.problems/.test(ENGSRC));
  }

  // =========================================================================
  // DRIVEN, NOT GREPPED — the engine, locally, with a stubbed model. RFC_V05_MODE is not read
  // here and is not touched: runEngine() is called directly, exactly as the other guards do.
  console.log('\n=== D4. THE ENGINE, DRIVEN, ON A REPLY SHAPED LIKE THE TEMPLATE ===');
  {
    const ENG = await esm('lib/ledger/engine.js');
    const DB = await esm('lib/ledger/daily-budget.js').catch(() => null);
    const Q = 'ما حكم صيام يوم عرفة لغير الحاج؟';
    const prompt = PLAN.buildPlannerPrompt(Q);
    const tpl = templateOf(prompt);

    // A model that returns EXACTLY the shape it was shown. This is the reply the live service was
    // getting, and the whole point of the fix is that it must no longer be self-refuting.
    const stubFetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: tpl }] }),
      text: async () => JSON.stringify({ content: [{ type: 'text', text: tpl }] }),
    });
    // callModel() refuses with `no-key` before it ever reaches fetchImpl, so the key is set for
    // the duration of the drive and removed after. Nothing leaves the machine: every HTTP call in
    // this block is the stub above, and RFC_V05_MODE is neither read nor written — runEngine() is
    // called directly, exactly as the other engine guards call it.
    const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-credential';
    let searched = 0;
    let out;
    try {
      out = await ENG.runEngine(Q, {
        band: 'adult', audienceBand: 'adult', bandSites: ['islamqa.info'],
        fetchImpl: stubFetch,
        search: async () => { searched++; return []; },
        ...(DB ? { dailyBudget: new DB.DailySearchBudget({ limit: 100, now: () => 1770000000000, store: DB.fakeStore() }) } : {}),
      });
    } finally {
      if (hadKey) process.env.ANTHROPIC_API_KEY = prevKey;
      else delete process.env.ANTHROPIC_API_KEY;
    }
    ok('a reply in the prompt\'s own shape no longer dies at the planner',
      JSON.stringify(out).indexOf('PLAN_INVALID') === -1,
      'outcome=' + out.outcome + ' — the example the model is shown must not refute itself');
    ok('...and the engine got as far as trying to search',
      searched > 0, 'searches=' + searched + ' — a plan that validates must reach the search stage');
  }

  // =========================================================================
  console.log('\n=== E. THE IR VALIDATOR REFUSES WHAT A MODEL ACTUALLY DOES ===');
  const goodIssue = () => ({
    issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
    protected_entities: ['بيع الذهب'], core_terms: ['التقسيط'], context_vars: [],
    exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
  });
  const wrap = (issues, extra) => Object.assign({ issues, missing_qualifiers: [], confidence: 'high' }, extra || {});

  {
    const v = IR.validateQueryPlan(wrap([goodIssue()]), 'ما حكم بيع الذهب بالتقسيط؟');
    ok('a well-formed plan validates', v.ok, JSON.stringify(v.problems));
    eq('...and the deterministic slot template is UNIONED in', v.plan.issues[0].requiredSlots.slice(), ['ruling']);
  }
  {
    // A «كيف» question gets practical_steps whether or not the model asked for it.
    const iss = goodIssue(); iss.required_slots = ['ruling'];
    const v = IR.validateQueryPlan(wrap([iss]), 'كيف أصلي في الطائرة؟');
    ok('a HOW question always gets practical_steps', v.plan.issues[0].requiredSlots.includes('practical_steps'),
      JSON.stringify(v.plan.issues[0].requiredSlots));
    ok('...and never loses the slot the model asked for', v.plan.issues[0].requiredSlots.includes('ruling'));
  }
  const REJECTS = [
    ['unknown intent', wrap([Object.assign(goodIssue(), { intent: 'ruling' })])],
    ['unknown temporal_scope', wrap([Object.assign(goodIssue(), { temporal_scope: 'soon' })])],
    ['unknown confidence', wrap([goodIssue()], { confidence: 'certain' })],
    ['unknown top-level field', wrap([goodIssue()], { sites: ['islamqa.info'] })],
    ['a search string smuggled in', wrap([goodIssue()], { query: 'x (site:a.com)' })],
    ['unknown slot', wrap([Object.assign(goodIssue(), { required_slots: ['verdict'] })])],
    ['bad issue_id shape', wrap([Object.assign(goodIssue(), { issue_id: 'Iss 1!' })])],
    ['no issues at all', wrap([])],
    ['too many issues', wrap([goodIssue(), goodIssue(), goodIssue(), goodIssue()])],
    ['duplicate issue ids', wrap([goodIssue(), goodIssue()])],
    ['a dependency on an issue that does not exist',
      wrap([Object.assign(goodIssue(), { dependencies: ['iss_9'] })])],
    ['a self-dependency', wrap([Object.assign(goodIssue(), { dependencies: ['iss_1'] })])],
    ['a claim with no substantive term',
      wrap([Object.assign(goodIssue(), { protected_entities: [], core_terms: [], exact_user_phrases: [] })])],
    ['an over-long term list',
      wrap([Object.assign(goodIssue(), { core_terms: Array.from({ length: 20 }, (_, i) => 't' + i) })])],
    ['a non-object plan', []],
  ];
  for (const [label, payload] of REJECTS) {
    const v = IR.validateQueryPlan(payload, 'س');
    eq('REJECTS: ' + label, v.ok, false);
  }
  {
    // A two-issue cycle.
    const a = Object.assign(goodIssue(), { issue_id: 'iss_1', dependencies: ['iss_2'] });
    const b = Object.assign(goodIssue(), { issue_id: 'iss_2', dependencies: ['iss_1'] });
    eq('REJECTS: a dependency cycle', IR.validateQueryPlan(wrap([a, b]), 'س').ok, false);
  }
  {
    // A legitimate DAG is accepted and ordered.
    const a = Object.assign(goodIssue(), { issue_id: 'iss_1' });
    const b = Object.assign(goodIssue(), { issue_id: 'iss_2', dependencies: ['iss_1'] });
    const v = IR.validateQueryPlan(wrap([b, a]), 'س');
    ok('a real DAG validates', v.ok, JSON.stringify(v.problems));
    eq('...and orderedIssues puts the dependency first',
      IR.orderedIssues(v.plan).map((i) => i.issueId), ['iss_1', 'iss_2']);
  }
  {
    // TWO OPINIONS ON ONE TOPIC ARE NOT A DEPENDENCY. Declaring them independent must remain
    // legal, or the planner is pushed into inventing an order that does not exist.
    const a = Object.assign(goodIssue(), { issue_id: 'iss_1', intent: 'general' });
    const b = Object.assign(goodIssue(), { issue_id: 'iss_2', intent: 'scholar_opinion', requested_authority_id: 'ibn-baz' });
    const v = IR.validateQueryPlan(wrap([a, b]), 'س');
    ok('a general issue and an attributed issue coexist without a false dependency', v.ok);
    eq('...and neither depends on the other', v.plan.issues.map((i) => i.dependencies.length), [0, 0]);
  }

  // =========================================================================
  console.log('\n=== F. A NAMED SCHOLAR WITH NO ADAPTER IS REFUSED AT PLAN TIME ===');
  {
    const iss = Object.assign(goodIssue(), { intent: 'scholar_opinion', requested_authority_id: 'al-abbaad' });
    const v = IR.validateQueryPlan(wrap([iss]), 'ما رأي الشيخ عبدالمحسن العباد في بيع الذهب بالتقسيط؟');
    ok('the PLAN is still valid (the model did its job)', v.ok, JSON.stringify(v.problems));
    eq('...and the issue carries an authority refusal', v.authorityRefusals.length, 1);
    eq('...naming the reason', v.authorityRefusals[0].reason, 'no_registered_primary_opinion_adapter');
    ok('...and the refusal is NOT a plan problem, so a compound question survives it',
      v.problems.length === 0);
  }
  {
    const iss = Object.assign(goodIssue(), { intent: 'scholar_opinion', requested_authority_id: 'ibn-baz' });
    const v = IR.validateQueryPlan(wrap([iss]), 'ما رأي الشيخ ابن باز؟');
    eq('a scholar WITH an adapter is not refused', v.authorityRefusals.length, 0);
  }
  {
    const iss = Object.assign(goodIssue(), { intent: 'scholar_opinion', requested_authority_id: 'shaykh_invented' });
    const v = IR.validateQueryPlan(wrap([iss]), 'س');
    ok('an invented authority id is refused', v.authorityRefusals.length === 1 || v.ok === false);
  }
  {
    // SEARCH FIRST (RFC v0.5-R2 §6/§7). This block used to assert the OPPOSITE: that the issue
    // was skipped entirely before a single provider call. That behaviour cost the reader the
    // documented general ruling AND produced a sentence claiming a search that never ran, so the
    // owner's decision replaced it. What is asserted now is the part that never changed — he is
    // still never attributed anything — plus the part that did: the question still gets answered.
    const eng = read('lib/ledger/engine.js');
    ok('the engine CAPS the attribution rather than skipping the issue',
      /for \(const r of planned\.authorityRefusals\)[\s\S]{0,400}attributionCapped\.set/.test(eng));
    ok('...and the refusal reason is still recorded in the ledger',
      /ledger\.reject\(REJECTION\.NO_REGISTERED_PRIMARY_ADAPTER/.test(eng));
    ok('...the capped issue drops the domain restriction so the general ruling is reachable',
      /onlySites: \(!capped && issue\.requestedAuthorityId\)/.test(eng));
    ok('...and its attribution slot can never be filled, by any route',
      /if \(capped && c\.slot === 'attribution'\) continue;/.test(eng)
      && /if \(!capped && issue\.requestedAuthorityId && issue\.requiredSlots\.includes\('attribution'\)/.test(eng));
  }

  // =========================================================================
  console.log('\n=== G. «الذهب» IS A COMMODITY, «ابن باز» IS A PERSON ===');
  {
    const { planAsk } = await esm('lib/ask-plan.js');
    const user = (t) => [{ role: 'user', content: t }];
    // NEGATIVE — the commodity sense. «الذهب» is gold, and no amount of it is a person.
    for (const q of ['ما حكم بيع الذهب بالتقسيط؟', 'حكم شراء الذهب بالتقسيط',
      'ما حكم زكاة الذهب؟', 'هل يجوز لبس الذهب للرجال؟']) {
      eq('«' + q + '» is NOT an attribution', planAsk(user(q)).attributionMode, 'none');
      eq('...and names no entity', planAsk(user(q)).namedEntity, '');
    }
    // POSITIVE — a request for a named man's position.
    for (const [q, who] of [
      ['ما رأي ابن باز في بيع الذهب بالتقسيط؟', 'ابن باز'],
      ['ما رأي الشيخ ابن باز في ذلك؟', 'ابن باز'],
      ['ما رأي الشيخ عبدالمحسن العباد في بيع الذهب بالتقسيط؟', 'عبدالمحسن العباد'],
    ]) {
      const p = planAsk(user(q));
      eq('«' + q.slice(0, 32) + '…» IS an attribution', p.attributionMode, 'namedScholarOpinion');
      ok('...and names ' + who, p.namedEntity.includes(who.split(' ').pop()), p.namedEntity);
    }
    // And the two ends join up: the resolved name becomes a registered owner id.
    eq('«ابن باز» becomes a registered authority id',
      SP.authorityIdForScholarName(planAsk(user('ما رأي ابن باز في بيع الذهب بالتقسيط؟')).namedEntity), 'ibn-baz');
    // The commodity never becomes one.
    eq('«الذهب» resolves to no authority', SP.authorityIdForScholarName('الذهب'), null);
    eq('«ذهب» resolves to no authority', SP.authorityIdForScholarName('ذهب'), null);

    // ── A MEASURED DEFECT IN THE SHIPPED SHAPE-DETECTOR, AND THE LAYER THAT ABSORBS IT ──
    //
    // «ذهب إلى المسجد فهل يصح؟» uses ذهب as the VERB "he went". lib/attribution.js's shape
    // patterns read it as the «قول فلان» frame and capture «الي المسجد فهل يصح» as a scholar's
    // name. That is a live false positive on the shipped path as of 2026-08-04, and it is NOT
    // fixed here: this batch is required to leave the default path byte-identical, and the
    // repair belongs in its own change with the attribution goldens re-run.
    //
    // What IS asserted is that the ledger path cannot be hurt by it. The engine never consults
    // the shape detector; an authority reaches it only as a `requested_authority_id` that must
    // be a REGISTERED owner id, and a captured fragment of a sentence is not one. So the
    // mis-capture cannot become an attribution however it arrives.
    {
      // FIXED, and this assertion is inverted to say so. The note above predicted the repair
      // would land in its own change with the entity IR; RFC v0.5-R2 is that change, and
      // lib/policy/entities.js now vetoes the lexical capture because «المسجد» is not a
      // registered entity. The defence below is UNCHANGED and still asserted: the ledger path
      // never consulted the shape detector, so it could not have been hurt either way.
      // BOTH SIDES OF THE ROLLOUT FLAG. The repair is behind lib/legacy-policy-flag.js, so the
      // shipped behaviour for an ordinary reader is still the OLD mis-read — recorded here rather
      // than hidden, because a fix nobody has switched on is not a fix that is live.
      const misOff = planAsk(user('ذهب إلى المسجد فهل يصح؟'));
      eq('with the policy flag OFF the shipped mis-read is unchanged', misOff.attributionMode, 'namedScholarOpinion');
      const mis = planAsk(user('ذهب إلى المسجد فهل يصح؟'), { policyEnabled: true });
      eq('the VERB «ذهب» no longer mis-reads as a scholar', mis.attributionMode, 'none');
      eq('...and the sentence attributes nothing at all', mis.claimRelation, 'NONE');
      eq('...the fragment still resolves to NO registered authority',
        SP.authorityIdForScholarName(mis.namedEntity), null);
      eq('...and has no primary-opinion adapter either',
        SP.primaryOpinionAdapter(mis.namedEntity), null);
      const iss = Object.assign(goodIssue(), {
        intent: 'scholar_opinion', requested_authority_id: 'al-abbaad',
      });
      // Whatever a planner proposes, only a registered id survives validation, and only a
      // registered id WITH an adapter escapes the refusal list.
      const v = IR.validateQueryPlan(wrap([
        Object.assign(goodIssue(), { intent: 'scholar_opinion', requested_authority_id: 'ذهب' }),
      ]), 'ذهب إلى المسجد فهل يصح؟');
      eq('...and a non-identifier authority is rejected by the IR validator outright', v.ok, false);
      eq('...while a registered-but-unreadable one is refused as an issue, not as a plan',
        IR.validateQueryPlan(wrap([iss]), 'س').authorityRefusals.length, 1);
    }
  }

  // =========================================================================
  console.log('\n=== H. THE PLANNER DESCRIBES; IT DOES NOT COMMAND ===');
  {
    const src = read('lib/ledger/planner.js');
    ok('the system prompt forbids emitting a query, a domain or a link',
      /ممنوعٌ أن تُخرِجَ استعلامَ بحثٍ أو نطاقًا أو رابطًا/.test(src));
    ok('...and forbids emitting a ruling', /ممنوعٌ أن تذكرَ حكمًا أو دليلًا أو رأيًا/.test(src));
    ok('the planner never builds a site: filter itself', !/site:/.test(src.replace(/'site:'/g, '')));
    const qb = read('lib/ledger/query-build.js');
    ok('the query is assembled ONLY in query-build.js', /export function assembleQuery/.test(qb));
    ok('...and no other ledger module assembles one',
      ['lib/ledger/engine.js', 'lib/ledger/planner.js', 'lib/ledger/extract.js', 'lib/ledger/draft.js']
        .every((f) => !/'site:'/.test(read(f))));
  }

  // =========================================================================
  console.log('\n=== I. WIRING ===');
  ok('gates.json lists this guard', /ledger-contract-guard\.cjs/.test(read('gates.json')));
  ok('api/ask.js imports only the FLAG at module scope',
    /^import \{ decidePath \} from '\.\.\/lib\/ledger\/flag\.js';$/m.test(read('api/ask.js')));
  ok('...and the seam (and through it the engine) is imported lazily, inside the branch',
    /await import\('\.\.\/lib\/ledger\/seam\.js'\)/.test(read('api/ask.js')));
  ok('...so nothing from lib/ledger/ except the flag is loaded at module scope',
    (read('api/ask.js').match(/^import .*lib\/ledger\/.*$/gm) || [])
      .every((l) => l.includes('flag.js')),
    JSON.stringify(read('api/ask.js').match(/^import .*lib\/ledger\/.*$/gm)));

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ledger-contract-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
