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
import { runDraft } from './draft.js';
import { buildViews, findConflicts } from './views.js';
import { adapterOnlyCorpusFor, readDirectCorpus } from './direct-corpus.js';
import { assemble, followUpText, selectClaimsForAnswer, READER } from './assemble.js';
import { SOURCE_POLICY_VERSION, primaryOpinionAdapter, expectedAdapterVersion } from './source-policy.js';
// THE SHARED POLICY CORE (RFC v0.5-R2 §3). The ledger and the legacy path must run under ONE
// policy_version, and the version travels out with every result so a reviewer can tell which
// rules produced an answer. guards/rfc-v05r2-guard.cjs asserts the two paths agree.
import { POLICY_VERSION } from '../policy/version.js';
import { SERVICE_LIMITED } from './daily-budget.js';
import * as cache from './cache.js';

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
 * @returns {Promise<{outcome, text, cards, ledger, budget, telemetry}>}
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
  // Injected, so a gate can drive a real reservation against a fake store without touching any
  // network and without creating a key in anybody's Upstash. Absent means "no daily ceiling is
  // being enforced on this call", which is what every existing fixture relies on.
  const dailyBudget = opts.dailyBudget || null;
  let serviceLimited = '';
  const mark = (name, ms) => { stage[name] = (stage[name] || 0) + ms; };
  const clock = typeof opts.now === 'function' ? opts.now : () => Date.now();

  const finish = (result) => ({
    ...result,
    ledger,
    budget,
    latencyByStage: stage,
    cacheHits,
    cacheMisses,
    sourcePolicyVersion: SOURCE_POLICY_VERSION,
    policyVersion: POLICY_VERSION,
    // SERVICE_LIMITED IS ITS OWN OUTCOME, and it deliberately outranks the assembled one. A day
    // whose allowance is gone did not fail to find evidence — it never looked — and reporting
    // that as a normal rejection is the exact conflation RFC v0.5-R2 §7 forbids. What was already
    // verified before the ceiling was hit still reaches the reader; only the label changes.
    ...(serviceLimited ? { serviceLimited: SERVICE_LIMITED, serviceLimitedReason: serviceLimited } : {}),
  });

  // ── ANALYZE_QUERY_IR ───────────────────────────────────────────────────────
  // `plannerOverride` supplies the RAW IR a model would have returned, so a test can pin the
  // plan without pinning the planner's prose. It is NOT a bypass: it goes through
  // validateQueryPlan() exactly as a model reply does, so an override that breaks the contract
  // is rejected the same way a model that breaks it would be.
  let t0 = clock();
  const planned = opts.plannerOverride
    ? validateQueryPlan(opts.plannerOverride, question)
    : await planQuestion(question, { budget, fetchImpl: opts.fetchImpl, tier: opts.tier });
  mark('plan', clock() - t0);

  if (!planned.ok) {
    ledger.reject(REJECTION.PLAN_INVALID, planned.reason || (planned.problems || []).slice(0, 3).join('; '));
    ledger.transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish({ outcome: 'SAFE_REJECTION', text: READER.NO_EVIDENCE_GENERAL, cards: [] });
  }

  const plan = planned.plan;
  ledger.setIssues(plan.issues);

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
    // `issue` from here on is the SEARCH issue: same id, same slots, and — when capped — the
    // underlying capability instead of scholar_opinion_primary. `capped` travels with it so the
    // attribution slot can be refused no matter what a page turns out to say.
    work.push({ issue: searchIssue, capped, batches: planned2.batches });
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
      t0 = clock();
      const direct = await readDirectCorpus(issue.requestedAuthorityId, issue, {
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
        issueId: issue.issueId, batchIndex: 1, sites: [SP_primaryDomain(issue.requestedAuthorityId)],
        chars: 0, words: 0, resultCount: directPages.length, refusedCount: 0, cache: 'n/a', ok: !direct.threw,
      });
      if (!directPages.length) {
        // A timeout, a throw and an empty corpus are three different facts and are recorded as
        // three. None of them starts a general search: answering "what does this man hold" from
        // somebody else's page is the failure this path exists to prevent.
        ledger.reject(
          direct.timedOut ? REJECTION.BUDGET_EXHAUSTED
            : direct.threw ? REJECTION.MODEL_UNAVAILABLE
              : REJECTION.NO_SUFFICIENT_DIRECT_EVIDENCE,
          direct.timedOut ? 'direct-corpus-timeout'
            : direct.threw ? 'direct-corpus-threw' : 'direct-corpus-empty',
          issue.issueId,
        );
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
        // The page is re-admitted for THIS issue: eligibility is per-capability, so a page
        // that answered a fatwa question may be inadmissible for an attributed one.
        const verdict = admitPostFetch(issue, loaded.page);
        if (!verdict.ok) continue;
        admitted.push({ ...loaded, score: verdict.score });
      }
      mark('fetch', clock() - t0);
    } else {
      // The adapter's pages go through the SAME post-fetch admission as a searched page. The
      // adapter chose which page; it did not earn the page an exemption.
      ledger.transition('FETCH_CANDIDATES');
      for (const d of directPages) {
        if (!fetchLedger.claim(d.page.canonicalUrl, issue.issueId)) continue;
        const verdict = admitPostFetch(issue, d.page);
        if (!verdict.ok) continue;
        admitted.push({ ...d, score: verdict.score });
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
    ledger.transition('DRAFT_FROM_VERIFIED_LEDGER_ONLY').transition('DETERMINISTIC_FINAL_ASSEMBLY').transition('DONE');
    return finish(assemble(ledger, []));
  }

  buildViews(ledger);
  for (const w of work) findConflicts(ledger, w.issue.issueId);

  const selected = [];
  for (const w of work) selected.push(...selectClaimsForAnswer(ledger, w.issue));
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
