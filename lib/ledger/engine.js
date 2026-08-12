// lib/ledger/engine.js
// THE STATE MACHINE. The order below is the guarantee, not a suggestion, and lib/ledger/schema.js
// refuses any move that is not on the graph.
//
//   ANALYZE_QUERY_IR
//     -> ORCHESTRATE_BATCHES
//     -> LOOP:
//          EXECUTE_BATCH
//          FETCH_CANDIDATES
//          SEGMENT_AUTHORIAL_CONTENT
//          EXTRACT_RAW_CLAIMS            (new pages only)
//          GATE_1_EVIDENCE_EXISTS
//          GATE_2_CLAIM_ENTAILMENT       (independent, batched)
//          UPDATE_VERIFIED_SLOTS
//          IF slots complete: BREAK
//          IF budgets/deadline exhausted: BREAK
//     -> DRAFT_FROM_VERIFIED_LEDGER_ONLY
//     -> GATE_3_SENTENCE_ENTAILMENT      (batched)
//     -> DETERMINISTIC_FINAL_ASSEMBLY
//     -> FULL | PARTIAL | SAFE_REJECTION
//
// ── WHAT A "VERIFIED CYCLE" COSTS, AND WHAT IT DOES NOT ──────────────────────
// A cycle is one extraction call plus one verification call. There are two. A THIRD batch of
// search results is reachable — but only if an earlier batch never spent a cycle, which happens
// when a search returns nothing or every candidate is refused before a model is ever involved.
// So the rule is not "three batches maximum"; it is "two verified cycles maximum", and a batch
// that produced no pages costs none of them.
//
// ── NOTHING IS ADDED TO THE LEDGER AFTER THE DRAFT BEGINS ────────────────────
// There is no edge from DRAFT back to EXECUTE_BATCH. A drafter that could trigger a search
// would be a drafter that decides what evidence it wants, which is the inversion this whole
// design exists to prevent.

import { Budget } from './budgets.js';
import { Ledger, REJECTION, newTraceId } from './schema.js';
import { needsFollowUp, orderedIssues, validateQueryPlan } from './query-ir.js';
import { planQuestion } from './planner.js';
import { planIssueBatches, isSendable } from './query-build.js';
import { rankPreFetch, admitPostFetch } from './rank.js';
import { FetchLedger, canonicalKey } from './canonical.js';
import { loadPage, pageFromCache } from './page.js';
import { runExtraction } from './extract.js';
import { gate1, runGate2, runGate3 } from './gates.js';
import { callModel, parseJsonReply } from './model.js';
import { MATCH_SYSTEM, buildMatchPrompt, readMatchReply } from '../page-match.js';
import { lockTakhrij } from '../takhrij-lock.js';
import { runDraft } from './draft.js';
import { buildViews, findConflicts } from './views.js';
import { adapterOnlyCorpusFor, readDirectCorpus, adaptedCorpusConsultFor } from './direct-corpus.js';
import { assemble, followUpText, selectClaimsForAnswer, READER } from './assemble.js';
import { SOURCE_POLICY_VERSION, primaryOpinionAdapter, expectedAdapterVersion } from './source-policy.js';
// THE SHARED POLICY CORE (RFC v0.5-R2 §3). The ledger and the legacy path must run under ONE
// policy_version, and the version travels out with every result so a reviewer can tell which
// rules produced an answer. guards/rfc-v05r2-guard.cjs asserts the two paths agree.
import { POLICY_VERSION } from '../policy/version.js';
import { resolveAudience, floor as ageFloor, access, warmTemplateFor } from '../policy/age.js';
import { classifyTopic, WARM_TEMPLATES } from '../policy/core.js';
import {
  SERVICE_LIMITED, PARTIAL_SERVICE_LIMITED, SERVICE_LIMITED_TEXT, PARTIAL_SERVICE_LIMITED_TEXT,
} from './daily-budget.js';
import * as cache from './cache.js';
// THE METRICS RECORD. Built here — the engine is the only thing that knows what a request did —
// and WRITTEN by the seam, after the reader's last byte. See buildTelemetry() below for why the
// two halves are split rather than done in one place.
import { fromLedger } from './telemetry.js';

const MAX_CANDIDATES_PER_BATCH = 3;

/** The domain that publishes this authority's own position, or '' when nobody does. */
function SP_primaryDomain(authorityId) {
  const a = primaryOpinionAdapter(authorityId);
  return a ? a.domain : '';
}

/**
 * Run the engine.
 *
 * @param {string} question
 * @param {object} opts
 *   band        'adult'|'teen'|'young' — the age-scoped allow-list, unchanged from the shipped path
 *   bandSites   the band's domains (caller supplies; the engine never widens them)
 *   search      async (q, sites) => [{url,title,snippet}]  — provider adapter, injected
 *   fetchImpl   optional fetch, for tests
 *   now         optional clock, for tests
 *   flagState   the path decision that routed here ('mode_public', 'enabled', …), recorded in
 *               telemetry so a bad day can be read per rollout arm. Absent means a direct call.
 * @returns {Promise<{outcome, text, cards, ledger, budget, telemetry}>}
 *   `telemetry` is `{ record, dropped }` from lib/ledger/telemetry.js, or null if it could not be
 *   built. It is metrics only, it is never written here, and it never affects the answer.
 */
export async function runEngine(question, opts = {}) {
  // The caller may hand in a budget whose clock started EARLIER — at the moment the request
  // decided to try this path, before the runtime flag was read. Without that, the switch sits
  // outside the deadline it is supposed to be inside.
  const budget = opts.budget || new Budget({ now: opts.now, startedAt: opts.startedAt });
  const ledger = new Ledger(opts.traceId || newTraceId());
  const fetchLedger = new FetchLedger();
  // Pages already fetched THIS request, so a second issue can rest on one without paying for it
  // again. Keyed by canonicalKey, so www./trailing-slash/tracking variants are one page.
  const loadedPages = new Map();
  // Which sources have already been extracted FOR EACH ISSUE. Not a global set: one page can
  // legitimately answer two issues, and each needs its own extraction.
  const extractedFor = new Map();
  const stage = {};
  let cacheHits = 0;
  let cacheMisses = 0;
  // ── THE DAY'S CEILING IS MANDATORY IN RUNTIME MODE ────────────────────────
  //
  // `opts.dailyBudget || null` used to be the whole of this, and it meant an omitted ceiling was
  // indistinguishable from a deliberate one — a production caller looked exactly like a fixture,
  // and searched freely. Now an absent budget is a REFUSAL unless the caller says, by name, that
  // it is a fixture. The nine scripted fixtures pass `dailyBudgetMode: 'fixture'`; nothing else
  // may, and silence is fail-closed.
  const fixtureMode = opts.dailyBudgetMode === 'fixture';
  const dailyBudget = opts.dailyBudget || null;
  let serviceLimited = '';
  // Published on every result so a reviewer can see the floor ran, and on what. Null until the
  // draft stage, because a request refused before it has claims never reached the floor at all —
  // and saying "PASS" for a check that did not run is the kind of stamp that means nothing.
  let ageFloorStamp = null;
  if (!dailyBudget && !fixtureMode) serviceLimited = 'not_configured';
  const mark = (name, ms) => { stage[name] = (stage[name] || 0) + ms; };
  const clock = typeof opts.now === 'function' ? opts.now : () => Date.now();

  /**
   * SERVICE_LIMITED IS AN OUTCOME, NOT AN ANNOTATION.
   *
   * The first round added `serviceLimited` as a side field beside an outcome that still read
   * PARTIAL or SAFE_REJECTION. A reviewer reading the outcome would conclude the engine had
   * looked and come up short, when it had not looked at all — the same conflation §7 forbids in
   * the reader-facing wording, one layer down. So the outcome itself changes:
   *
   *   nothing verified  -> SERVICE_LIMITED, with the operational text and no cards
   *   something verified -> PARTIAL_SERVICE_LIMITED, the supported part plus a line saying the
   *                         REST was not searched because of the limit — never «لم نجد».
   */
  const applyServiceLimit = (result) => {
    if (!serviceLimited) return result;
    const answered = ledger.verifiedClaims().length > 0
      && typeof result.text === 'string' && result.text.trim().length > 0
      && result.outcome !== 'SAFE_REJECTION';
    if (!answered) {
      return {
        ...result,
        outcome: SERVICE_LIMITED,
        text: SERVICE_LIMITED_TEXT,
        cards: [],
      };
    }
    return {
      ...result,
      outcome: PARTIAL_SERVICE_LIMITED,
      text: result.text + '\n\n' + PARTIAL_SERVICE_LIMITED_TEXT,
    };
  };

  /**
   * THE METRICS RECORD FOR THIS REQUEST — BUILT, NEVER WRITTEN, HERE.
   *
   * WHY THE BUILD AND THE WRITE ARE SPLIT. finish() is the last thing that runs before the answer
   * is handed back, and lib/ledger/seam.js turns that answer into bytes on the socket. Putting the
   * Upstash round trip here would put a network call in FRONT of the reader's first byte — a
   * measurable latency change on the answer path, which is exactly what "zero behaviour change"
   * forbids. So the engine builds (pure, synchronous, no I/O) and the seam writes, after
   * wire.close(). The reader has already been served by the time the store is touched.
   *
   * WHY IT IS BUILT FROM THE FINAL RESULT rather than from `result0`. applyServiceLimit() can
   * change FULL or PARTIAL into SERVICE_LIMITED, and a metrics store whose `outcome` disagrees
   * with what the reader actually got is worse than no metrics at all — it would report the engine
   * as having answered on a day it never searched.
   *
   * TELEMETRY IS NEVER ALLOWED TO COST AN ANSWER, so the whole thing is inside a catch. A record
   * that cannot be built is a null record and nothing else; the reply is unaffected.
   */
  const buildTelemetry = (result) => {
    try {
      return fromLedger(ledger, {
        budget,
        latencyByStage: stage,
        cacheHits,
        cacheMisses,
        outcome: result.outcome,
        // WHY NOT 'legacy'. fromLedger() defaults an absent flag state to 'legacy', which is the
        // right default for a caller that never ran the engine and a plain untruth for one that
        // did — every record from a guard or a fixture would claim the legacy path produced it.
        // A direct call is not a flag state, so it is named as what it is.
        flagState: opts.flagState || 'direct',
        sourcePolicyVersion: SOURCE_POLICY_VERSION,
      });
    } catch (e) {
      console.warn('[ledger] telemetry build failed:',
        e && e.message ? String(e.message).slice(0, 120) : 'unknown');
      return null;
    }
  };

  const finish = (result0) => {
    const result = {
    ...applyServiceLimit(result0),
    ledger,
    budget,
    latencyByStage: stage,
    cacheHits,
    cacheMisses,
    sourcePolicyVersion: SOURCE_POLICY_VERSION,
    policyVersion: POLICY_VERSION,
    // THE POLICY THE ANSWER WAS PRODUCED UNDER, published rather than inferred. A reviewer can
    // read the relation, the roles, the era and the cap that actually governed this request.
    policy: ledger.policy || null,
    ageFloor: ageFloorStamp,
    ageAccess: result0 && result0.ageAccess ? result0.ageAccess : null,
    audienceBand: ledger.audienceBand || null,
    audienceSource: ledger.audienceSource || null,
    // SERVICE_LIMITED IS ITS OWN OUTCOME, and it deliberately outranks the assembled one. A day
    // whose allowance is gone did not fail to find evidence — it never looked — and reporting
    // that as a normal rejection is the exact conflation RFC v0.5-R2 §7 forbids. What was already
    // verified before the ceiling was hit still reaches the reader; only the label changes.
    ...(serviceLimited ? { serviceLimited: SERVICE_LIMITED, serviceLimitedReason: serviceLimited } : {}),
    };
    // `{ record, dropped }`, or null if the build failed. `dropped` is kept rather than discarded
    // so a guard can assert exactly which fields the allow-list refused, instead of inferring it
    // from an absence.
    return { ...result, telemetry: buildTelemetry(result) };
  };

  // ── FAIL CLOSED BEFORE THE FIRST MODEL CALL ───────────────────────────────
  // Refusing here rather than at the first search matters: planning costs a model call, and a
  // request that can never search must not pay for a plan it cannot act on.
  if (serviceLimited === 'not_configured') {
    ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'daily:not_configured');
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish({
      outcome: SERVICE_LIMITED, text: SERVICE_LIMITED_TEXT, cards: [],
      serviceLimited: SERVICE_LIMITED, serviceLimitedReason: 'not_configured',
    });
  }

  // ── ANALYZE_QUERY_IR ───────────────────────────────────────────────────────
  // `plannerOverride` supplies the RAW IR a model would have returned, so a test can pin the
  // plan without pinning the planner's prose. It is NOT a bypass: it goes through
  // validateQueryPlan() exactly as a model reply does, so an override that breaks the contract
  // is rejected the same way a model that breaks it would be.
  let t0 = clock();
  const planned = opts.plannerOverride
    ? validateQueryPlan(opts.plannerOverride, question)
    // `tier` is deliberately NOT passed. The plan call pins itself to the strongest configured
    // channel — see PLANNER_TIER in lib/ledger/planner.js for why this one call is not the
    // reader's tier, and why every call AFTER it still is.
    //
    // `bandSites` IS passed, and only the deterministic floor reads it: it checks the intent it
    // classified against the sources this band can actually serve, so the fallback plan cannot
    // name a capability nothing could answer and refuse without a request.
    : await planQuestion(question, {
      budget, fetchImpl: opts.fetchImpl, bandSites: opts.bandSites,
    });
  mark('plan', clock() - t0);

  // ── WHICH ARM OF THE PLANNER PRODUCED THIS PLAN ───────────────────────────
  //
  // A degraded plan is still a plan and still searches, so this changes no answer. It is recorded
  // because the two arms mean very different things about the model: `repair` says the first
  // reply was malformed and the second was not; `minimal` says BOTH were, and the request is
  // running on a plan nobody described — one issue, the reader's own words, a lexically
  // classified intent. A store that cannot tell those apart cannot answer «is the planner
  // healthy», which is the question this whole round was opened to answer.
  if (planned.degraded) {
    ledger.reject(REJECTION.PLAN_DEGRADED, planned.reason || planned.degraded, null,
      [planned.degraded === 'repair' ? 'repair_call' : 'deterministic_floor']);
  }

  if (!planned.ok) {
    // NAME THE FIELD. `planned.reason` is the constant 'schema' whenever validation failed, so
    // `reason || problems` discarded the problems EVERY time: the ledger recorded «PLAN_INVALID /
    // schema» and never once said which field broke. That is the whole reason this defect cost
    // hours instead of minutes — the same silent-drop lesson as lib/retrieve.js, in the engine.
    //
    // AND THE NAME NOW SURVIVES THE TRIP. The line above was only ever half the fix: the detail
    // it builds is prose, and prose is dropped by the metrics allow-list, so production still
    // could not answer «which field». `problemFields` is the same failure in bare identifiers
    // and it is what lib/ledger/schema.js publishes beside the code. The prose stays for a log
    // reader; the tokens are what a store can keep.
    ledger.reject(REJECTION.PLAN_INVALID,
      [planned.reason, ...(planned.problems || []).slice(0, 3)].filter(Boolean).join('; '),
      null, planned.problemFields);
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish({ outcome: 'SAFE_REJECTION', text: READER.NO_EVIDENCE_GENERAL, cards: [] });
  }

  // ── WHAT THE VALIDATOR HAD TO MEND, RECORDED BEFORE ANYTHING USES IT ──────
  //
  // A repaired plan is a plan that searched, so none of this changes the answer. It is recorded
  // because the alternative is a silent substitution: `confidence` quietly becoming `medium`, an
  // invented key quietly vanishing. A metrics record that says «this ran clean» about a request
  // whose plan needed three fields replaced is the same class of untruth as the missing counts
  // line — an instrument reading healthy while something is wrong.
  if (planned.repairs && planned.repairs.length) {
    ledger.reject(REJECTION.PLAN_FIELD_REPAIRED,
      (planned.repairMessages || []).slice(0, 3).join('; '), null, planned.repairs);
  }

  const plan = planned.plan;
  ledger.setIssues(plan.issues, plan.policy);
  // The band the answer is FOR, carried on the ledger so Gate 3's deterministic half can read it
  // without every call site threading it through. Resolved by the shared policy core, so the
  // ledger and the legacy path treat an unverified claim the same way.
  const audience = resolveAudience({ serverBand: opts.serverBand, clientBand: opts.audienceBand });
  ledger.audienceBand = audience.band;
  ledger.audienceSource = audience.audienceSource;
  ledger.topicClass = classifyTopic(question, {
    ...plan.policy,
    intents: plan.issues.map((issue) => issue.intent),
  }, 'DEEN');

  // ── AGE_ACCESS_POLICY, INSIDE THE ENGINE, IMMEDIATELY AFTER IR_BUILD ──────
  //
  // The handler routes on this too, and that is not redundancy for its own sake: the handler is
  // one caller, and a policy that only one caller enforces is a policy the next caller forgets.
  // Running it here means the ENGINE cannot be made to search a grave hazard or answer a child's
  // dosage question no matter who calls it or what they omit.
  //
  // Placed after IR_BUILD, never before — that ordering is what lets «ما حكم قتل النمل؟» be
  // understood as a ruling a child may have rather than blocked on a word.
  const ageAccess = access({ topicClass: ledger.topicClass, audienceBand: ledger.audienceBand });
  if (ageAccess.outcome === 'SAFETY_REDIRECT' || ageAccess.outcome === 'REFER_ADULT') {
    ledger.reject(REJECTION.NO_ELIGIBLE_SOURCE, 'age_access:' + ageAccess.outcome);
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish({
      outcome: ageAccess.outcome,
      text: warmTemplateFor(ageAccess.sourcePolicy) || WARM_TEMPLATES.SAFETY_REDIRECT,
      cards: [],
      ageAccess,
    });
  }

  // ── SEARCH FIRST (RFC v0.5-R2 §6/§7). THIS USED TO BE A PRE-SEARCH REFUSAL ─────────────────
  //
  // WHAT IT USED TO DO, AND WHY THAT WAS WRONG. A named scholar with no registered primary corpus
  // had his whole ISSUE refused here, before ORCHESTRATE_BATCHES, before a single provider call.
  // For F6 — «ما رأي الشيخ عبدالمحسن العباد في بيع الذهب بالتقسيط؟» — the reader got
  // «لم أعثر ضمن المصادر المتاحة على نصٍّ مباشر يثبت هذه النسبة» with brave_calls = 0. Two
  // separate faults in one line: the general ruling on selling gold by instalments IS documented
  // and citable and the reader lost it; and the sentence reports a search that never happened.
  //
  // WHAT HAPPENS NOW. The issue proceeds. The search runs against the ordinary band sources for
  // the underlying ruling, and what changes is only the ATTRIBUTION: the provenance ceiling for
  // that authority is NONE, so zero claims may be credited to him, the `attribution` slot can
  // never be filled, and the reply comes out PARTIAL with a slot-level proof saying exactly what
  // was looked for and why it could not be his. The reader gets the ruling and an honest account
  // of whose it is not — which is the answer they were entitled to all along.
  //
  // NOTHING IS LOOSENED. He is still never quoted from a third-party page: that is enforced by
  // the cap below and by lib/policy/attribution-grades.js, not by refusing to look.
  const refusedIssues = new Set();
  const attributionCapped = new Map();      // issueId -> authorityId
  for (const r of planned.authorityRefusals) {
    ledger.reject(REJECTION.NO_REGISTERED_PRIMARY_ADAPTER, r.authorityId, r.issueId);
    attributionCapped.set(r.issueId, r.authorityId);
  }

  if (needsFollowUp(plan)) {
    ledger.reject(REJECTION.QUALIFIER_MISSING, plan.missingQualifiers.join('; '));
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish({ outcome: 'SAFE_REJECTION', text: followUpText(plan), cards: [] });
  }

  // ── ORCHESTRATE_BATCHES ────────────────────────────────────────────────────
  ledger.transition('ORCHESTRATE_BATCHES');
  const bandSites = Array.isArray(opts.bandSites) ? opts.bandSites : [];
  const work = [];
  for (const issue of orderedIssues(plan)) {
    if (refusedIssues.has(issue.issueId)) continue;

    // ── AN ADAPTER-ONLY CORPUS IS READ, NOT SEARCHED ──
    // The scholar has a registered corpus that was never in the provider's index, so there is
    // no query to build and no request to spend. It still produces ordinary pages that go
    // through the ordinary gates.
    if (issue.requestedAuthorityId && adapterOnlyCorpusFor(issue.requestedAuthorityId)) {
      work.push({ issue, batches: [{ index: 1, direct: true, sites: [], chars: 0, words: 0 }] });
      continue;
    }

    // A CAPPED ISSUE IS SEARCHED AS THE GENERAL QUESTION IT ALSO IS.
    //
    // «ما رأي الشيخ فلان في بيع الذهب بالتقسيط؟» contains a ruling question inside it. With no
    // corpus of his to read, restricting the search to his (non-existent) domain would produce
    // no eligible source and refuse the issue — the old behaviour wearing a new name. So the
    // domain restriction is dropped and the capability becomes the underlying one, which is what
    // lets the documented general ruling be found and cited to ITS OWN source.
    // THE AUTHORITY IS DROPPED FROM THE SEARCH ISSUE, and that is not a loophole — it is the
    // accurate description of what this search is. lib/ledger/rank.js refuses, both pre-fetch and
    // post-fetch, any page whose owner is not the requested authority; that rule is exactly right
    // for an attributed search and would refuse EVERY page here, leaving the capped issue with
    // nothing and reproducing the old refusal under a new name. What is being looked for now is
    // the general ruling, which belongs to whoever published it.
    //
    // The cap is enforced where it belongs and nowhere near the ranker: no claim may be credited
    // to him (below), the attribution slot can never fill (below), and the ORIGINAL issue — the
    // one holding his id — is what the ledger recorded via setIssues(), so the reply still knows
    // an attribution was asked for and still reports that it could not be made.
    const capped = attributionCapped.has(issue.issueId);
    const searchIssue = capped
      ? Object.freeze({
        ...issue,
        intent: issue.intent === 'scholar_opinion' ? 'fatwa' : issue.intent,
        requestedAuthorityId: null,
      })
      : issue;

    const planned2 = planIssueBatches(searchIssue, bandSites, {
      form: opts.filterForm,
      // A named authority whose corpus IS searchable is searched at his own domain and nowhere
      // else. A general article about him on another site is not his position.
      onlySites: (!capped && issue.requestedAuthorityId)
        ? [(SP_primaryDomain(issue.requestedAuthorityId) || '')].filter(Boolean)
        : undefined,
    });
    if (!planned2.ok) {
      ledger.reject(
        planned2.reason === 'no_eligible_source' ? REJECTION.NO_ELIGIBLE_SOURCE : REJECTION.PROTECTED_TERMS_TOO_LONG,
        planned2.reason, issue.issueId,
      );
      refusedIssues.add(issue.issueId);
      continue;
    }
    if (planned2.uncoveredSites && planned2.uncoveredSites.length) {
      // NOT A SILENT CAP. Named so telemetry can report what was never searched.
      ledger.reject('coverage_truncated', String(planned2.uncoveredSites.length), issue.issueId);
    }
    // ── THE ADAPTED CORPUS, CONSULTED ALONGSIDE THE ORDINARY SEARCH ────────
    //
    // A question that names nobody still deserves the best source the app owns. binothaimeen.net
    // is the highest-rated primary-opinion corpus in the policy table and, being `searchable:
    // false`, was reachable only by naming the man. So it is READ — never searched, never added
    // to a `site:` filter — and its pages enter the candidate pool below to compete under exactly
    // the rules every other page faces.
    //
    // IT IS QUEUED LAST, and that ordering is the budget clause: the ordinary search spends first,
    // and readDirectCorpus() reserves each of its own network units against the same ceiling and
    // refuses when there is none left. So the consultation costs what is spare and never more.
    const batches = planned2.batches.slice();
    const consult = adaptedCorpusConsultFor(searchIssue);
    if (consult) {
      batches.push({
        index: batches.length + 1, direct: true, consult: true,
        corpusAuthorityId: consult.authorityId, sites: [], chars: 0, words: 0,
      });
    }
    // `issue` from here on is the SEARCH issue: same id, same slots, and — when capped — the
    // underlying capability instead of scholar_opinion_primary. `capped` travels with it so the
    // attribution slot can be refused no matter what a page turns out to say.
    work.push({ issue: searchIssue, capped, batches });
  }

  if (!work.length) {
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    const attributed = plan.issues.some((i) => i.requestedAuthorityId);
    return finish({
      outcome: 'SAFE_REJECTION',
      text: attributed ? READER.NO_DIRECT_EVIDENCE : READER.NO_EVIDENCE_GENERAL,
      cards: [],
    });
  }

  // ── THE LOOP ───────────────────────────────────────────────────────────────
  const queue = [];
  for (const w of work) for (const b of w.batches) queue.push({ issue: w.issue, capped: w.capped, batch: b });

  let qi = 0;
  while (qi < queue.length) {
    if (budget.deadlineReached()) {
      ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'deadline');
      // NOT A SILENT STOP. Every slot that never got its search says so in its own record, so
      // the wording chosen later is «تعذر استكمال البحث ضمن الحدود التشغيلية» and not an
      // absence of evidence. Dressing budget exhaustion up as "we looked and found nothing" is
      // the specific dishonesty RFC v0.5-R2 §7 forbids.
      for (const q of queue.slice(qi)) {
        for (const slot of q.issue.requiredSlots) {
          const p = ledger.slotProof(q.issue.issueId, slot);
          if (!p.searchAttempted) ledger.recordSlotProof(q.issue.issueId, slot, {});
        }
      }
      break;
    }

    ledger.transition('EXECUTE_BATCH');
    const { issue, capped, batch } = queue[qi++];

    // WHAT THIS BATCH DID, in the units a slot proof records. Accumulated as the batch runs and
    // folded into every one of the issue's slots below, so a negative sentence about any of them
    // can be traced to the work that was actually performed for it.
    let epQueries = 0;
    let epResultsSeen = 0;
    let epOrigin = 'live';

    // ── EXECUTE_BATCH: a direct corpus read, costing no provider call ──
    let directPages = null;
    if (batch.direct) {
      // A CONSULT batch reads somebody's corpus for a question that named nobody; a REQUESTED
      // batch reads the corpus of the man the reader asked about. Same reader, same gates, two
      // very different meanings when it comes back empty — see below.
      const corpusAuthorityId = batch.corpusAuthorityId || issue.requestedAuthorityId;

      // THE BUDGET CLAUSE, STATED RATHER THAN IMPLIED. The consultation is an ADDITION to the
      // ordinary search, so when the ceiling is nearly spent it may only run if the ordinary
      // search has not already produced verified evidence for this issue. A corpus read that
      // starves the rest of the request of its page budget would trade one source for another.
      if (batch.consult) {
        const alreadyAnswered = ledger.verifiedClaims().some((c) => c.issueId === issue.issueId);
        if (alreadyAnswered && !budget.canAfford('pagesFetched', 2)) {
          console.warn('[ledger] adapted-corpus consult skipped — issue already answered and the page budget is spent');
          continue;
        }
        if (!budget.canAfford('pagesFetched')) continue;
      }

      t0 = clock();
      const direct = await readDirectCorpus(corpusAuthorityId, issue, {
        // The reader's own words, not a bag of IR terms. The adapter's own gates read this
        // string, and a term bag silently drops the qualifiers those gates turn on.
        question,
        reader: opts.directReader,
        // With no `directReader` the REAL adapter runs, and this is what lets a test drive it
        // deterministically rather than replacing it.
        fetchImpl: opts.adapterFetchImpl,
        // The SAME budget the searched path spends from, so one ceiling governs both.
        budget, purpose: issue.intent,
      });
      directPages = direct.pages;
      epQueries = 1;
      epResultsSeen = directPages.length;
      mark('direct', clock() - t0);
      ledger.recordSearchAttempt({
        issueId: issue.issueId, batchIndex: batch.index || 1,
        sites: [SP_primaryDomain(corpusAuthorityId) || (adapterOnlyCorpusFor(corpusAuthorityId) || {}).domain || ''],
        chars: 0, words: 0, resultCount: directPages.length, refusedCount: 0, cache: 'n/a', ok: !direct.threw,
      });
      if (!directPages.length) {
        // ── AN EMPTY CONSULTATION CHANGES NOTHING ──
        // For a REQUESTED corpus, an empty read is the answer: the man's own site has nothing, and
        // a timeout, a throw and an empty corpus are three different facts recorded as three.
        // For a CONSULTATION the reader never asked for, it is not a finding at all — recording it
        // as an absence of direct evidence would let an optional extra source narrate the outcome
        // of a question it was only ever invited to help with.
        if (!batch.consult) {
          ledger.reject(
            direct.timedOut ? REJECTION.BUDGET_EXHAUSTED
              : direct.threw ? REJECTION.MODEL_UNAVAILABLE
                : REJECTION.NO_SUFFICIENT_DIRECT_EVIDENCE,
            direct.timedOut ? 'direct-corpus-timeout'
              : direct.threw ? 'direct-corpus-threw' : 'direct-corpus-empty',
            issue.issueId,
          );
        }
        continue;
      }
    }

    // ── EXECUTE_BATCH: search ──
    const admitted = [];
    if (!batch.direct) {
      if (!isSendable(batch.q)) {
        ledger.recordSearchAttempt({ issueId: issue.issueId, batchIndex: batch.index, sites: batch.sites, chars: batch.chars, words: batch.words, ok: false });
        continue;
      }
      if (!budget.canAfford('braveCalls')) { ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'brave'); break; }

      let results = [];
      let cacheState = 'miss';
      t0 = clock();
      const cached = await cache.getSearch(batch.q, { sites: batch.sites });
      if (cached.hit) { results = cached.value; cacheState = 'hit'; cacheHits++; }
      else {
        // ── THE DAILY CEILING, RESERVED BEFORE THE REQUEST LEAVES ──────────
        //
        // A counter incremented after the call has authorised the call it was meant to gate, so
        // the reservation is taken FIRST and the request proceeds only if it succeeded. It sits
        // below the cache lookup on purpose: a cache hit costs the provider nothing and must not
        // consume a day's unit. When the day is gone the outcome is SERVICE_LIMITED — never
        // NOT_FOUND, because running out of allowance is not an absence of evidence, and every
        // unsearched slot below records NOT_SEARCHED_BUDGET so no sentence can pretend otherwise.
        if (dailyBudget) {
          const res = await dailyBudget.reserve();
          if (!res.ok) {
            serviceLimited = res.reason;
            ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'daily:' + res.reason, issue.issueId);
            for (const slot of issue.requiredSlots) {
              if (!ledger.slotProof(issue.issueId, slot).searchAttempted) {
                ledger.recordSlotProof(issue.issueId, slot, {});
              }
            }
            break;
          }
        }
        cacheMisses++;
        budget.spend('braveCalls', 1, issue.intent);
        try {
          results = await opts.search(batch.q, batch.sites);
        } catch { results = []; }
        // THE EMPTY ANSWER IS STORED TOO (RFC v0.5-R2 §8), under the short negative TTL. It used
        // to be the one outcome never remembered, which made an unanswerable question the most
        // expensive kind: it cost a provider call every single time anybody asked it.
        await cache.putSearch(batch.q, results, { sites: batch.sites });
      }
      mark('search', clock() - t0);

      epQueries = 1;
      epResultsSeen = results.length;
      // A CACHE HIT IS NOT A FRESH SEARCH, AND THE PROOF SAYS SO. RFC v0.5-R2 §8: a reply may not
      // claim it looked just now when it is reading yesterday's answer.
      epOrigin = cacheState === 'hit' ? 'cache' : 'live';

      const { ranked, refused } = rankPreFetch(issue, results);
      ledger.recordSearchAttempt({
        issueId: issue.issueId, batchIndex: batch.index, sites: batch.sites,
        chars: batch.chars, words: batch.words, resultCount: results.length,
        refusedCount: refused.length, cache: cacheState, ok: true,
      });
      if (!ranked.length) continue;

      // ── FETCH_CANDIDATES ──
      ledger.transition('FETCH_CANDIDATES');
      // DEDUP MEANS "DO NOT FETCH IT TWICE", NOT "DO NOT USE IT TWICE". Brave returns the same
      // page under two different site: filters routinely, and a compound question's two issues
      // can legitimately rest on one page. Paying for it twice is the waste this prevents;
      // refusing the second issue the page it needs would be a different and worse bug — it is
      // how «ما رأي الشيخ ابن باز» silently loses its answer because the general half of the
      // question happened to be searched first.
      const wanted = [];
      for (const r of ranked) {
        if (fetchLedger.claim(r.url, issue.issueId)) { wanted.push({ cand: r, fresh: true }); continue; }
        const already = loadedPages.get(canonicalKey(r.url));
        if (already) wanted.push({ cand: r, fresh: false, loaded: already });
        if (wanted.length >= MAX_CANDIDATES_PER_BATCH) break;
      }
      t0 = clock();
      for (const w of wanted.slice(0, MAX_CANDIDATES_PER_BATCH)) {
        let loaded = w.loaded;
        if (w.fresh) {
          if (!budget.canAfford('pagesFetched')) { ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'fetch'); break; }
          // THE VERSION IS DECIDED BEFORE THE READ, from the policy row, so the cache is
          // addressed by the adapter that would produce the extraction. Passing `undefined`
          // here made every lookup a miss AND made the invalidation rule unexercisable.
          const wantVersion = expectedAdapterVersion(w.cand.url);
          const ck = wantVersion
            ? await cache.getExtraction(w.cand.url, { adapterVersion: wantVersion })
            : { hit: false, value: null };
          if (ck.hit) { cacheHits++; loaded = pageFromCache(w.cand.url, ck.value); }
          else {
            cacheMisses++;
            budget.spend('pagesFetched', 1, issue.intent);
            loaded = await loadPage(w.cand.url, { fetchImpl: opts.fetchImpl });
            if (loaded.ok) {
              await cache.putExtraction(loaded.page.canonicalUrl, loaded.page, { adapterVersion: loaded.page.adapterVersion });
            }
          }
          if (loaded.ok) loadedPages.set(canonicalKey(loaded.page.canonicalUrl), loaded);
        }
        if (!loaded || !loaded.ok) continue;
        if (loaded.segmented.injectionMarkers.length) {
          ledger.recordInjectionMarkers(loaded.segmented.injectionMarkers);
          ledger.reject(REJECTION.INJECTION_MARKERS,
            loaded.page.canonicalUrl || loaded.page.url, issue.issueId);
          continue;
        }
        // The page is re-admitted for THIS issue: eligibility is per-capability, so a page
        // that answered a fatwa question may be inadmissible for an attributed one.
        const verdict = admitPostFetch(issue, loaded.page, { question });
        if (!verdict.ok) continue;
        admitted.push({ ...loaded, score: verdict.score, match: verdict.match });
      }
      mark('fetch', clock() - t0);
    } else {
      // The adapter's pages go through the SAME post-fetch admission as a searched page. The
      // adapter chose which page; it did not earn the page an exemption.
      ledger.transition('FETCH_CANDIDATES');
      for (const d of directPages) {
        if (!fetchLedger.claim(d.page.canonicalUrl, issue.issueId)) continue;
        if (d.segmented.injectionMarkers.length) {
          ledger.recordInjectionMarkers(d.segmented.injectionMarkers);
          ledger.reject(REJECTION.INJECTION_MARKERS,
            d.page.canonicalUrl || d.page.url, issue.issueId);
          continue;
        }
        const verdict = admitPostFetch(issue, d.page, { question });
        if (!verdict.ok) continue;
        admitted.push({ ...d, score: verdict.score, match: verdict.match });
      }
    }
    // ── THE MATCH CHECK'S MODEL LAYER — ONE CALL, ONLY ON AMBIGUITY ────────
    //
    // The deterministic layer in lib/page-match.js has already refused every page that plainly
    // answers a different question, and confirmed every page that plainly answers this one. What
    // is left is the middle: a page whose vocabulary overlaps but which names no ḥāl at all, or
    // answers in words the reader did not use. That is the only case a model is asked about, and
    // it is asked ONCE for ALL of them — one call per page would multiply a request's cost by its
    // candidate count and would be the first thing dropped under load.
    //
    // THE CEILING IS NOT RAISED. This call is taken only when
    // five more still fit: this one, extraction, verification, drafting and sentence
    // verification. An UNSURE page is not verified evidence: if this check cannot run or cannot
    // answer, that candidate alone is removed while confirmed candidates remain untouched.
    if (admitted.length) {
      const confirmed = admitted.filter((a) => a.match && a.match.verdict === 'match');
      const unsure = admitted.filter((a) => a.match && a.match.verdict === 'unsure');
      const keep = new Set();
      const explicitFalse = new Set();
      let matchCheckRan = false;
      let matchFailure = '';
      if (!confirmed.length && unsure.length && budget.canAfford('modelCalls', 5)) {
        matchCheckRan = true;
        t0 = clock();
        const cands = unsure.map((a, i) => ({
          id: 'c' + (i + 1), title: a.page.title || '', text: String(a.page.authorialText || ''),
        }));
        const res = await callModel({
          system: MATCH_SYSTEM, user: buildMatchPrompt(question, cands),
          budget, purpose: 'page_match', tier: opts.tier, fetchImpl: opts.fetchImpl,
        });
        mark('page_match', clock() - t0);
        if (res.ok) {
          const verdicts = readMatchReply(res.text, cands.map((c) => c.id), parseJsonReply);
          // AN ABSENT VERDICT IS A REFUSAL. The page reached this layer because the free check
          // could not settle it; silence settles nothing.
          cands.forEach((c, i) => {
            if (verdicts.get(c.id) === true) keep.add(unsure[i]);
            if (verdicts.get(c.id) === false) explicitFalse.add(unsure[i]);
          });
        } else matchFailure = res.reason || 'unavailable';
      }
      for (const a of unsure) {
        if (keep.has(a)) continue;
        ledger.reject(explicitFalse.has(a) ? 'page_does_not_answer' : REJECTION.PAGE_MATCH_UNVERIFIED,
          a.page.canonicalUrl || a.page.url, issue.issueId);
      }
      for (let i = admitted.length - 1; i >= 0; i--) {
        if (unsure.includes(admitted[i]) && !keep.has(admitted[i])) admitted.splice(i, 1);
      }
      if (unsure.length && !confirmed.length && !matchCheckRan) {
        ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'page_match', issue.issueId);
      } else if (matchFailure) {
        ledger.reject(matchFailure === 'budget' ? REJECTION.BUDGET_EXHAUSTED : REJECTION.MODEL_UNAVAILABLE,
          'page_match:' + matchFailure, issue.issueId);
      }
    }

    // ── THE SLOT PROOFS FOR THIS BATCH ─────────────────────────────────────
    // Recorded whether or not anything was admitted, and BEFORE the `continue` below — a batch
    // that found nothing is exactly the case whose proof matters most, because it is the one a
    // negative sentence will later want to rest on.
    //
    // The attribution slot of a CAPPED issue is recorded with zero eligible pages however many
    // pages the search admitted. That is not bookkeeping: no page on the open list is eligible to
    // carry that man's primary opinion, so the honest outcome for that slot is RESULTS_INELIGIBLE
    // — "we found material on the subject, it is not the kind of source that can be his word".
    for (const slot of issue.requiredSlots) {
      ledger.recordSlotProof(issue.issueId, slot, {
        queries: epQueries,
        resultsSeen: epResultsSeen,
        eligiblePages: (capped && slot === 'attribution') ? 0 : admitted.length,
        origin: epOrigin,
      });
    }

    if (!admitted.length) continue;

    // ── SEGMENT_AUTHORIAL_CONTENT ──
    ledger.transition('SEGMENT_AUTHORIAL_CONTENT');
    admitted.sort((a, b) => b.score - a.score);
    // "NEW PAGE" MEANS NEW TO THIS ISSUE, not new to the ledger. A compound question's second
    // issue may rest on a page the first issue already read — the same fatwa page can carry the
    // general ruling and the named shaykh's own answer — and skipping extraction because the
    // SOURCE was already recorded silently loses the second half of the answer. Segmentation is
    // idempotent (deterministic ids), so the page is added once and extracted once per issue.
    if (!extractedFor.has(issue.issueId)) extractedFor.set(issue.issueId, new Set());
    const doneForIssue = extractedFor.get(issue.issueId);
    const fresh = [];
    for (const a of admitted) {
      const sid = a.segmented.sourceId;
      if (doneForIssue.has(sid)) continue;
      doneForIssue.add(sid);
      if (!ledger.source(sid)) {
        ledger.addSegmentedPage(a.segmented, {
          host: a.page.host, ownerId: a.page.ownerId, capability: issue.intent,
        });
      }
      fresh.push({ sourceId: sid, segmented: a.segmented });
    }
    if (!fresh.length) continue;

    // ── EXTRACT_RAW_CLAIMS: NEW PAGES ONLY, and only if a cycle is left ──
    if (!budget.canAfford('verifiedCycles')) { ledger.reject(REJECTION.BUDGET_EXHAUSTED, 'cycles'); break; }
    budget.spend('verifiedCycles', 1, issue.intent);

    ledger.transition('EXTRACT_RAW_CLAIMS');
    t0 = clock();
    const extracted = await runExtraction(ledger, issue, fresh, {
      budget, fetchImpl: opts.fetchImpl, tier: opts.tier, cycle: budget.spent.verifiedCycles,
    });
    mark('extract', clock() - t0);
    if (!extracted.ok || !extracted.claims.length) {
      ledger.transition('GATE_1_EVIDENCE_EXISTS').transition('GATE_2_CLAIM_ENTAILMENT').transition('UPDATE_VERIFIED_SLOTS');
      continue;
    }
    for (const c of extracted.claims) ledger.addClaim(c);

    // ── GATE 1 ──
    ledger.transition('GATE_1_EVIDENCE_EXISTS');
    const survivedG1 = [];
    for (const c of extracted.claims) {
      const g = gate1(ledger, c, issue);
      ledger.recordGate('gate1', c.claimId, g.ok, g.problems.join(','));
      if (g.ok) survivedG1.push(c); else c.verified = false;
    }

    // ── GATE 2 ──
    ledger.transition('GATE_2_CLAIM_ENTAILMENT');
    t0 = clock();
    await runGate2(ledger, survivedG1, { budget, fetchImpl: opts.fetchImpl, tier: opts.tier });
    mark('gate2', clock() - t0);

    // ── UPDATE_VERIFIED_SLOTS ──
    ledger.transition('UPDATE_VERIFIED_SLOTS');
    for (const c of ledger.verifiedClaims()) {
      // A CAPPED AUTHORITY'S ATTRIBUTION SLOT CAN NEVER BE FILLED, by any route. The extractor is
      // free to label a claim `attribution` — it reads pages, not policy — and if that label
      // could fill the slot then a general article would have re-established the very attribution
      // the cap exists to refuse, and the reply would come out FULL. provenance_cap = NONE means
      // NONE, including by bookkeeping.
      if (capped && c.slot === 'attribution') continue;
      if (c.slot && issue.requiredSlots.includes(c.slot)) {
        ledger.markSlot(issue.issueId, c.slot, 'filled', c.claimId);
      }
      // THE ATTRIBUTION SLOT IS FILLED BY THE REGISTRY, NEVER BY A CLAIM. "Whose position is
      // this" is established by the owner of the page the evidence came from — which Gate 1
      // already refuses to let a model supply — so waiting for the extractor to label a claim
      // `attribution` would leave the slot unfilled on a page that proves it perfectly.
      if (!capped && issue.requestedAuthorityId && issue.requiredSlots.includes('attribution')
        && c.issueId === issue.issueId) {
        const src = ledger.source(c.sourceId);
        if (src && src.ownerId === issue.requestedAuthorityId) {
          ledger.markSlot(issue.issueId, 'attribution', 'filled', c.claimId);
        }
      }
    }
    // A claim with no declared slot still proves the issue was answerable; the primary slot for
    // the intent is credited so a source that answers without naming a slot is not wasted.
    if (ledger.verifiedClaims().some((c) => c.issueId === issue.issueId)) {
      // The same exclusion applies to the fallback credit: a capped issue may never have
      // `attribution` credited to it even as "the primary slot for the intent".
      const primary = issue.requiredSlots.find((s) => !(capped && s === 'attribution'));
      if (primary && !ledger.slotsFor(issue.issueId).find((s) => s.slot === primary && s.status === 'filled')) {
        const any = ledger.verifiedClaims().find((c) => c.issueId === issue.issueId);
        if (any) ledger.markSlot(issue.issueId, primary, 'filled', any.claimId);
      }
    }
    // Fold the verified count into each filled slot's proof, so a slot that DID verify reads
    // EVIDENCE_VERIFIED rather than EVIDENCE_NOT_ENTAILED.
    for (const s of ledger.slotsFor(issue.issueId)) {
      if (s.status === 'filled' && ledger.slotProof(issue.issueId, s.slot).verifiedClaims === 0) {
        ledger.recordSlotProof(issue.issueId, s.slot, { verifiedClaims: 1 });
      }
    }

    // Early stop is decided on VERIFIED SLOTS, never on a promising title or snippet — AND on
    // the issue having produced verified evidence at all. issueComplete() is vacuously true for
    // an issue that declares no slots, so on its own it would stop the loop before such an
    // issue had been searched even once.
    const remaining = work.filter((w) => !refusedIssues.has(w.issue.issueId));
    const answered = (id) => ledger.verifiedClaims().some((c) => c.issueId === id);
    if (remaining.every((w) => answered(w.issue.issueId) && ledger.issueComplete(w.issue.issueId))) break;
    if (!budget.canAfford('verifiedCycles') && !budget.canAfford('modelCalls', 3)) break;
  }

  // ── DRAFT ──────────────────────────────────────────────────────────────────
  const verified = ledger.verifiedClaims();
  if (!verified.length) {
    if (!ledger.rejections.length) ledger.reject(REJECTION.NO_SUFFICIENT_DIRECT_EVIDENCE, '');
    // ── A DRAFT STATE IS A CLAIM THAT A DRAFT HAPPENED ────────────────────
    //
    // This line unconditionally walked ORCHESTRATE_BATCHES -> DRAFT -> ASSEMBLY, and there is no
    // such edge on the graph. It never fired because the loop always entered EXECUTE_BATCH at
    // least once — until the deterministic floor in lib/ledger/planner.js meant a request whose
    // DEADLINE was already blown still arrived here with a plan. It then broke out of the queue
    // before executing anything, and the walk threw: «illegal transition ORCHESTRATE_BATCHES ->
    // DRAFT_FROM_VERIFIED_LEDGER_ONLY». Caught by ledger-seam-guard.cjs's hung-dependency case.
    //
    // ASSEMBLY IS A LEGAL EDGE FROM ORCHESTRATE_BATCHES, and it is also the true one: with no
    // batch executed there is no verified ledger, so there was nothing to draft FROM. Recording
    // the draft state anyway would put a stage in `states` that never ran — the same class of
    // untruth as a refusal reporting a search it never made.
    if (ledger.state !== 'ORCHESTRATE_BATCHES') ledger.transition('DRAFT_FROM_VERIFIED_LEDGER_ONLY');
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish(assemble(ledger, []));
  }

  buildViews(ledger);
  for (const w of work) findConflicts(ledger, w.issue.issueId);

  const selected = [];
  for (const w of work) selected.push(...selectClaimsForAnswer(ledger, w.issue));

  // ── AGE_FLOOR ON VERIFIED CLAIMS, BEFORE THE DRAFT (RFC v0.5-R2 §5) ────────
  //
  // The order in the RFC is deliberate and this is it: verified claims -> deterministic floor ->
  // draft -> the existing batched Gate 3. Filtering here rather than after drafting means the
  // drafter never SEES a claim it may not use, so it cannot paraphrase one into the answer and
  // rely on Gate 3 to catch it. Gate 3's deterministic half still checks the sentences, because
  // two independent checks on a child's answer is the right number.
  //
  // This costs no model call: lib/policy/age.js is pure.
  const ageWithheld = [];
  // A COPY, NOT THE ARRAY ITSELF. With no filtering to do (an adult reader), the unbranched
  // version left `ageSelected` aliasing `selected`, and the splice below then emptied the array it
  // was about to read from — every fixture lost its whole answer to «no relevant verified claim».
  let ageSelected = selected.slice();
  if (ledger.audienceBand === 'young' || ledger.audienceBand === 'teen') {
    ageSelected = selected.filter((c) => {
      const v = ageFloor(c.text, { topicClass: ledger.topicClass, audienceBand: ledger.audienceBand });
      const blocking = v.problems.filter((p) => !p.startsWith('missing:') && p !== 'cold-refusal');
      if (!blocking.length) return true;
      ageWithheld.push({ claimId: c.claimId, problems: blocking });
      ledger.recordGate('age_floor', c.claimId, false, blocking.join(','));
      return false;
    });
    for (const c of ageSelected) ledger.recordGate('age_floor', c.claimId, true, '');
  }
  ageFloorStamp = Object.freeze({
    ran: ledger.audienceBand === 'young' || ledger.audienceBand === 'teen',
    audienceBand: ledger.audienceBand,
    topicClass: ledger.topicClass,
    withheld: Object.freeze(ageWithheld),
    outcome: ageWithheld.length ? 'WITHHELD' : 'PASS',
  });
  selected.length = 0;
  selected.push(...ageSelected);

  if (!selected.length) {
    ledger.reject(REJECTION.SLOT_UNFILLED, 'no relevant verified claim');
    ledger.transition('DRAFT_FROM_VERIFIED_LEDGER_ONLY').transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish(assemble(ledger, []));
  }

  ledger.transition('DRAFT_FROM_VERIFIED_LEDGER_ONLY');
  t0 = clock();
  const drafted = await runDraft(ledger, selected, work.map((w) => w.issue), {
    budget, fetchImpl: opts.fetchImpl, tier: opts.tier,
  });
  mark('draft', clock() - t0);
  if (!drafted.ok || !drafted.sentences.length) {
    ledger.reject(REJECTION.MODEL_UNAVAILABLE, drafted.reason || 'empty-draft');
    ledger.transition('GATE_3_SENTENCE_ENTAILMENT').transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish(assemble(ledger, []));
  }
  // ── THE TAKHRIJ LOCK, ON EVERY DRAFTED SENTENCE BEFORE IT IS STORED ────────
  //
  // A hadith reached a reader marked «رواه البخاري ومسلم» over pages that never said so. Gate 2
  // and Gate 3 could not catch it: they ask whether a sentence is entailed by its CLAIM, and a
  // claim that carries the false attribution entails a sentence that repeats it perfectly. The
  // one question a takhrij turns on — is this attribution on a page we actually fetched? — was
  // asked nowhere, so it is asked here, deterministically, before the sentence is stored.
  //
  // The frozen texts are exempt inside lib/takhrij-lock.js itself, scoped to the frozen run and
  // not to the sentence, so quoting an āyah beside a false attribution is not a way through.
  const pageTexts = Array.from(ledger.pageText.values());
  const lockedSentences = [];
  for (const s of drafted.sentences) {
    const locked = lockTakhrij(s.text, pageTexts);
    if (!locked.text.trim()) {
      // The takhrij WAS the sentence. Dropping it is the only honest option — the alternative is
      // a stub that asserts nothing and still looks like evidence.
      ledger.reject('unsourced_takhrij_sentence_dropped',
        (locked.droppedSentences[0] ? locked.droppedSentences[0].spans : []).join(','));
      continue;
    }
    if (locked.removed.length || locked.droppedSentences.length) {
      ledger.reject('unsourced_takhrij_stripped',
        locked.removed.map((r) => r.kind + ':' + r.phrase).join('; ').slice(0, 200));
      s.text = locked.text;
    }
    lockedSentences.push(s);
  }
  drafted.sentences = lockedSentences;
  if (!drafted.sentences.length) {
    ledger.reject(REJECTION.GATE3_FAILED, 'every-sentence-was-unsourced-takhrij');
    ledger.transition('GATE_3_SENTENCE_ENTAILMENT').transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish(assemble(ledger, []));
  }
  for (const s of drafted.sentences) ledger.addSentence(s);

  // ── GATE 3 ─────────────────────────────────────────────────────────────────
  ledger.transition('GATE_3_SENTENCE_ENTAILMENT');
  t0 = clock();
  const g3 = await runGate3(ledger, drafted.sentences, { budget, fetchImpl: opts.fetchImpl, tier: opts.tier });
  mark('gate3', clock() - t0);
  if (g3.voided) ledger.reject(REJECTION.GATE3_FAILED, g3.reason || 'void');

  // ── ASSEMBLY ───────────────────────────────────────────────────────────────
  ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY');
  const out = assemble(ledger, g3.survived);
  ledger.transition('DONE');
  return finish(out);
}
