// tools/ledger-live-eval.cjs — the LIVE evaluation harness. DELIBERATELY NOT A GIT GATE.
//
// WHY IT IS NOT IN gates.json. It needs a provider key, a model key and a network. A gate that
// depends on any of those goes red for reasons that have nothing to do with the code, and a
// gate that goes red for unrelated reasons is a gate people learn to ignore. Worse, an LLM's
// judgement is not deterministic, so the same commit would pass and fail on alternate runs. The
// deterministic properties are gated in ledger-fixtures-guard.cjs; the probabilistic ones are
// MEASURED here, on demand, and reported as numbers.
//
// AND IT REPORTS VOID, NOT PASS. A metric that could not be measured is VOID. A harness that
// prints PASS when it did not run is worse than no harness.
//
// THE ONE MEASUREMENT THAT IS EASY TO FAKE: an engine that refuses everything scores zero
// unsupported claims, zero wrong attributions and zero ineligible sources. So false-rejection
// rate and answerable-golden success are measured alongside them, and a run that refuses the
// answerable questions is a FAILING run however clean its other numbers are.
//
// Usage:
//   node tools/ledger-live-eval.cjs                 # the nine fixtures, live
//   node tools/ledger-live-eval.cjs --or-contract   # only the provider OR-form contract test
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const VOID = 'VOID';

function line(k, v) { console.log('  ' + String(k).padEnd(34) + ' ' + v); }

(async function main() {
  const args = process.argv.slice(2);
  console.log('=== ledger live eval — measured, not gated ===');

  const haveBrave = !!process.env.BRAVE_API_KEY;
  const haveModel = !!process.env.ANTHROPIC_API_KEY;
  line('BRAVE_API_KEY', haveBrave ? 'present' : 'ABSENT');
  line('ANTHROPIC_API_KEY', haveModel ? 'present' : 'ABSENT');
  let dailyBudget = null;
  if (haveBrave) {
    const { DailySearchBudget } = await esm('lib/ledger/daily-budget.js');
    // This harness spends real provider units when enabled, so it shares the production daily
    // reservation contract instead of silently treating an evaluation as unmetered traffic.
    dailyBudget = new DailySearchBudget();
  }

  // ── the provider contract test ────────────────────────────────────────────
  // A unit test with a mocked provider proves we BUILT `site:A OR site:B`. It cannot prove the
  // provider HONOURS it. Only this can.
  {
    console.log('\n--- provider OR-form contract ---');
    if (!haveBrave) {
      line('or_form_honoured', VOID + ' (no BRAVE_API_KEY)');
    } else {
      const { probeOrContract } = await esm('lib/ledger/search.js');
      const r = await probeOrContract(
        ['islamqa.info', 'islamweb.net'], 'حكم صيام عرفة', { dailyBudget });
      line('or_form_ran', String(r.ran));
      line('or_form_honoured', r.ran ? String(r.orHonoured) : VOID);
      line('detail', r.detail);
      if (r.ran && !r.orHonoured) {
        console.log('  >> the OR form is NOT honoured. Switch DEFAULT_FILTER_FORM to \'single\' in');
        console.log('     lib/ledger/query-build.js; the fallback is implemented and gated.');
      }
    }
    if (args.includes('--or-contract')) process.exit(0);
  }

  // ── the nine, live ────────────────────────────────────────────────────────
  console.log('\n--- the nine golden questions ---');
  if (!haveBrave || !haveModel) {
    for (const k of ['unsupported_claim_rate', 'wrong_attribution_rate', 'ineligible_source_rate',
      'false_rejection_rate', 'answerable_golden_success', 'p50_latency_ms', 'p95_latency_ms',
      'timeout_rate', 'model_calls_mean', 'input_tokens_mean', 'output_tokens_mean',
      'full_partial_reject']) line(k, VOID);
    console.log('\nRESULT: VOID — the live evaluation did not run.');
    process.exit(0);
  }

  const { runEngine } = await esm('lib/ledger/engine.js');
  const { braveSearch } = await esm('lib/ledger/search.js');
  const { searchableDomains, capabilityEligible } = await esm('lib/ledger/source-policy.js');
  const { capabilityForIntent } = await esm('lib/ledger/capability.js');
  const FIX = JSON.parse(read('data/ledger-fixtures.json'));
  const bandSites = searchableDomains();

  const rows = [];
  for (const f of FIX.fixtures) {
    const started = Date.now();
    let out;
    try {
      out = await runEngine(f.question, {
        band: 'adult', bandSites, search: braveSearch,
        dailyBudget, searchHandlesDailyBudget: true,
      });
    } catch (e) {
      rows.push({ id: f.id, error: (e && e.message) || 'threw', ms: Date.now() - started });
      continue;
    }
    const snap = out.budget.snapshot();
    // "Unsupported" here means STRUCTURALLY unsupported — a surviving sentence whose claims do
    // not all resolve. A semantic judgement would need a second model and is out of scope.
    const unsupported = out.ledger.sentences.filter((s) => s.verified && s.carriesClaim)
      .filter((s) => (s.claimIds || []).some((id) => !out.ledger.claim(id)?.verified)).length;
    const wrongAttribution = out.ledger.verifiedClaims().filter((c) => {
      const iss = out.ledger.issues.find((i) => i.issueId === c.issueId);
      if (!iss || !iss.requestedAuthorityId) return false;
      return out.ledger.source(c.sourceId)?.ownerId !== iss.requestedAuthorityId;
    }).length;
    const ineligible = out.cards.filter((c) => {
      const claim = out.ledger.verifiedClaims().find((x) => out.ledger.source(x.sourceId)?.canonicalUrl === c.url);
      const iss = claim && out.ledger.issues.find((i) => i.issueId === claim.issueId);
      return !iss || !capabilityEligible(c.url, capabilityForIntent(iss.intent));
    }).length;
    rows.push({
      id: f.id, outcome: out.outcome, expected: f.expect_outcome,
      ms: Date.now() - started, cards: out.cards.length,
      model: snap.spent.modelCalls, brave: snap.spent.braveCalls, fetch: snap.spent.pagesFetched,
      inTok: snap.spent.inputTokens, outTok: snap.spent.outputTokens,
      breaches: snap.breaches.length, unsupported, wrongAttribution, ineligible,
      timedOut: snap.elapsedMs >= 25000,
    });
    console.log('  ' + f.id.padEnd(28) + ' ' + String(out.outcome).padEnd(15)
      + ' ' + String(rows[rows.length - 1].ms) + 'ms  cards=' + out.cards.length);
  }

  const good = rows.filter((r) => !r.error);
  const answerable = FIX.fixtures.filter((f) => f.expect_outcome === 'FULL').map((f) => f.id);
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const sorted = good.map((r) => r.ms).sort((a, b) => a - b);
  const at = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

  console.log('\n--- metrics ---');
  line('unsupported_claim_rate', pct(good.reduce((n, r) => n + r.unsupported, 0), good.length) + '%');
  line('wrong_attribution_rate', pct(good.reduce((n, r) => n + r.wrongAttribution, 0), good.length) + '%');
  line('ineligible_source_rate', pct(good.reduce((n, r) => n + r.ineligible, 0), good.length) + '%');
  // FALSE REJECTION: a question the fixtures say is answerable that came back refused. This is
  // the number that stops "refuse everything" from looking like success.
  const falseRejects = good.filter((r) => answerable.includes(r.id) && r.outcome === 'SAFE_REJECTION');
  line('false_rejection_rate', pct(falseRejects.length, answerable.length) + '%'
    + (falseRejects.length ? '  <- ' + falseRejects.map((r) => r.id).join(', ') : ''));
  line('answerable_golden_success',
    good.filter((r) => answerable.includes(r.id) && r.outcome !== 'SAFE_REJECTION').length + '/' + answerable.length);
  line('golden_outcome_match', good.filter((r) => r.outcome === r.expected).length + '/' + FIX.fixtures.length);
  line('p50_latency_ms', at(0.5));
  line('p95_latency_ms', at(0.95));
  line('timeout_rate', pct(good.filter((r) => r.timedOut).length, good.length) + '%');
  line('errors', rows.filter((r) => r.error).length);
  line('model_calls_mean', good.length ? (good.reduce((n, r) => n + r.model, 0) / good.length).toFixed(1) : VOID);
  line('brave_calls_mean', good.length ? (good.reduce((n, r) => n + r.brave, 0) / good.length).toFixed(1) : VOID);
  line('input_tokens_mean', good.length ? Math.round(good.reduce((n, r) => n + r.inTok, 0) / good.length) : VOID);
  line('output_tokens_mean', good.length ? Math.round(good.reduce((n, r) => n + r.outTok, 0) / good.length) : VOID);
  line('budget_breaches', good.reduce((n, r) => n + r.breaches, 0));
  const dist = good.reduce((a, r) => { a[r.outcome] = (a[r.outcome] || 0) + 1; return a; }, {});
  line('full_partial_reject', JSON.stringify(dist));
  // COST IS NOT ESTIMATED FROM A PRICE LIST NOBODY CHECKED. Tokens are reported; a currency
  // figure needs the current published prices and is VOID until somebody supplies them.
  line('cost_per_question', VOID + ' (report tokens; prices are not hard-coded here)');

  console.log('\n--- go / no-go ---');
  const gate = [
    ['unsupported claims == 0', good.every((r) => r.unsupported === 0)],
    ['wrong attribution == 0', good.every((r) => r.wrongAttribution === 0)],
    ['ineligible sources == 0', good.every((r) => r.ineligible === 0)],
    ['budget breaches == 0', good.every((r) => r.breaches === 0)],
    ['model calls <= 7', good.every((r) => r.model <= 7)],
    ['brave calls <= 4', good.every((r) => r.brave <= 4)],
    ['fetches <= 5', good.every((r) => r.fetch <= 5)],
    ['golden outcomes 9/9', good.filter((r) => r.outcome === r.expected).length === FIX.fixtures.length],
    ['no false rejection of an answerable question', falseRejects.length === 0],
  ];
  for (const [label, pass] of gate) line(label, pass ? 'PASS' : 'FAIL');
  console.log('\nRESULT: ' + (gate.every(([, p]) => p) ? 'GO' : 'NO-GO'));
  process.exit(0);
})().catch((e) => {
  console.error('ledger-live-eval CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
