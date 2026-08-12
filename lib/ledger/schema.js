// lib/ledger/schema.js
// THE CLAIM–EVIDENCE LEDGER. One normalised record of everything this request knows, and the
// only thing the drafter is ever allowed to read.
//
// WHY IT IS NORMALISED RATHER THAN A BAG OF OBJECTS. Every relationship this engine has to be
// able to CHECK is a join: a claim's spans must share one answer unit; a sentence must rest on
// claims from one view; a slot is filled only by a verified claim. Nesting the data would make
// each of those a tree walk over structures that could disagree with each other. Here every
// entity has an id, every reference is an id, and a dangling id is a deterministic failure
// rather than an undefined that reads as false.
//
// THE ORDER OF THE STATE MACHINE IS PART OF THE SCHEMA. `transition()` refuses a move that is
// not on the declared graph, so "the ledger was written after the answer was decided" is
// impossible rather than merely discouraged.

// THE SHARED POLICY CORE OWNS THE PROOF SHAPE, not this file. The same record is consumed by the
// legacy path and by the fixtures, so there is one definition of "what counts as having looked".
import {
  newSlotProof, record as recordSlotEpisode, toWire as slotProofToWire,
} from '../policy/slot-proof.js';
import { classifyProvenance, gradeWithinCap } from '../policy/attribution-grades.js';

export const STATES = Object.freeze([
  'ANALYZE_QUERY_IR',
  'ORCHESTRATE_BATCHES',
  'EXECUTE_BATCH',
  'FETCH_CANDIDATES',
  'SEGMENT_AUTHORIAL_CONTENT',
  'EXTRACT_RAW_CLAIMS',
  'GATE_1_EVIDENCE_EXISTS',
  'GATE_2_CLAIM_ENTAILMENT',
  'UPDATE_VERIFIED_SLOTS',
  'DRAFT_FROM_VERIFIED_LEDGER_ONLY',
  'GATE_3_SENTENCE_ENTAILMENT',
  'DETERMINISTIC_FINAL_ASSEMBLY',
  'DONE',
]);

// The legal moves. The loop is explicit; so is the fact that nothing may be added to the
// ledger after DRAFT begins — there is no edge back from DRAFT to EXECUTE_BATCH.
const EDGES = Object.freeze({
  ANALYZE_QUERY_IR: ['ORCHESTRATE_BATCHES', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  ORCHESTRATE_BATCHES: ['EXECUTE_BATCH', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  EXECUTE_BATCH: ['FETCH_CANDIDATES', 'EXECUTE_BATCH', 'DRAFT_FROM_VERIFIED_LEDGER_ONLY', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  FETCH_CANDIDATES: ['SEGMENT_AUTHORIAL_CONTENT', 'EXECUTE_BATCH', 'DRAFT_FROM_VERIFIED_LEDGER_ONLY', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  SEGMENT_AUTHORIAL_CONTENT: ['EXTRACT_RAW_CLAIMS', 'EXECUTE_BATCH', 'DRAFT_FROM_VERIFIED_LEDGER_ONLY', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  EXTRACT_RAW_CLAIMS: ['GATE_1_EVIDENCE_EXISTS', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  GATE_1_EVIDENCE_EXISTS: ['GATE_2_CLAIM_ENTAILMENT', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  GATE_2_CLAIM_ENTAILMENT: ['UPDATE_VERIFIED_SLOTS', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  UPDATE_VERIFIED_SLOTS: ['EXECUTE_BATCH', 'DRAFT_FROM_VERIFIED_LEDGER_ONLY', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  DRAFT_FROM_VERIFIED_LEDGER_ONLY: ['GATE_3_SENTENCE_ENTAILMENT', 'DETERMINISTIC_FINAL_ASSEMBLY'],
  GATE_3_SENTENCE_ENTAILMENT: ['DETERMINISTIC_FINAL_ASSEMBLY'],
  DETERMINISTIC_FINAL_ASSEMBLY: ['DONE'],
  DONE: [],
});

// Internal reason codes. NONE of these ever reaches a reader; the reader-facing wording is
// assembled in lib/ledger/assemble.js and is deliberately shorter and vaguer than these.
export const REJECTION = Object.freeze({
  NO_SUFFICIENT_DIRECT_EVIDENCE: 'no_sufficient_direct_evidence_found_within_searched_sources',
  NO_ELIGIBLE_SOURCE: 'no_eligible_source_for_this_capability',
  NO_REGISTERED_PRIMARY_ADAPTER: 'no_registered_primary_opinion_adapter_for_requested_authority',
  PROTECTED_TERMS_TOO_LONG: 'protected_terms_exceed_query_budget',
  QUALIFIER_MISSING: 'material_qualifier_missing_follow_up_required',
  PLAN_INVALID: 'query_plan_failed_schema_validation',
  // NOT A REFUSAL OF THE REQUEST — a refusal of one VALUE the model sent. The plan survived and
  // searched; this records that a field could not be taken as written and what replaced it, by
  // field name, so «which field does this model keep getting wrong» is a question the store can
  // answer. Deliberately short: it is one of the two codes that carries a field suffix, and
  // `code:field` has to stay inside the metrics allow-list's 64-character value bound.
  PLAN_FIELD_REPAIRED: 'query_plan_field_repaired',
  // ALSO NOT A REFUSAL. Which arm of lib/ledger/planner.js produced the plan this request ran:
  // `repair_call` (the model corrected itself when shown its violations) or
  // `deterministic_floor` (neither reply validated and the plan was built from the question with
  // no model at all). Absent means the first reply was valid.
  PLAN_DEGRADED: 'query_plan_degraded',
  GATE1_FAILED: 'evidence_reference_did_not_resolve',
  GATE2_FAILED: 'claim_not_entailed_by_its_evidence',
  GATE3_FAILED: 'sentence_not_entailed_by_its_claim',
  BUDGET_EXHAUSTED: 'budget_or_deadline_exhausted',
  MODEL_UNAVAILABLE: 'model_call_failed_or_timed_out',
  INJECTION_MARKERS: 'retrieved_page_contains_instruction_markers',
  PAGE_MATCH_UNVERIFIED: 'page_match_candidate_not_verified',
  SLOT_UNFILLED: 'required_slot_never_filled_by_verified_evidence',
});

export const OUTCOMES = Object.freeze(['FULL', 'PARTIAL', 'SAFE_REJECTION']);

let counter = 0;

/**
 * PER-PROCESS ENTROPY, BECAUSE THE COUNTER ALONE COLLIDES ON EVERY COLD START.
 *
 * The counter is module state, so it restarts at zero in every serverless instance: instance A's
 * first request and instance B's first request were BOTH `tr_000001`. That cost nothing while
 * telemetry was written only for internal testers — two staff requests rarely race — but since
 * 2026-08-07 a record is written for every request, keyed `lg:t:<trace_id>`, and identical ids
 * mean each instance's first request silently overwrites every other instance's first request.
 * The group test would then be counting keys, not requests, and would undercount by roughly the
 * instance fan-out — invisibly, because an overwrite looks exactly like a request that never came.
 *
 * NOT A CLOCK AND NOT A HASH. The original contract holds: no user data, no timestamp, and
 * nothing derived from the question, because a hash of a question is still a fingerprint of one
 * and this id goes into logs. Random bytes carry none of those.
 */
const INSTANCE = Math.random().toString(36).slice(2, 8).padEnd(6, '0');

/**
 * A trace id with no user data and no clock. Deliberately NOT derived from the question: a
 * hash of a question is still a fingerprint of a question, and this id goes into logs.
 *
 * `seed` keeps the old fully-deterministic form for fixtures and guards that pin an id.
 */
export function newTraceId(seed) {
  counter = (counter + 1) % 1e6;
  if (seed !== undefined) return 'tr_' + String(seed).padStart(6, '0');
  return 'tr_' + INSTANCE + '_' + String(counter).padStart(6, '0');
}

export class Ledger {
  constructor(traceId) {
    this.traceId = traceId || newTraceId();
    this.state = 'ANALYZE_QUERY_IR';
    this.transitions = ['ANALYZE_QUERY_IR'];

    this.issues = [];              // validated IR issues
    this.requiredSlots = [];       // {issueId, slot}
    this.slotStatus = new Map();   // "issueId:slot" -> {status, claimIds[]}
    this.sources = new Map();      // sourceId -> {sourceId, canonicalUrl, host, ownerId, adapterVersion, title, author, attributionType, dates}
    // The authorial text, kept ONLY so Gate 1 can re-derive every span from its byte offsets.
    // Deliberately a separate map rather than a field on the source row: telemetryShape()
    // serialises `sources`, and page text must never be able to travel with it by accident.
    this.pageText = new Map();     // sourceId -> string
    this.answerUnits = new Map();  // answerUnitId(global) -> {...}
    this.spans = new Map();        // spanId(global)      -> {...}
    this.claims = [];
    this.claimComponents = [];
    this.evidenceBundles = new Map(); // claimId -> spanIds[]
    this.views = [];               // {viewId, issueId, ownerId|null, claimIds[]}
    this.conflictSets = [];
    this.searchAttempts = [];
    // Includes instruction-bearing pages rejected before source admission. Deriving this count
    // from `sources` made the telemetry incapable of describing the very pages it must exclude.
    this.injectionMarkersSeen = 0;
    // ── PER-SLOT SEARCH PROOF (RFC v0.5-R2 §7) ──
    // `searchAttempts` above records what the REQUEST did. That is not the same fact as what was
    // done for a particular SLOT, and conflating them is how «لم أعثر على نصٍّ يثبت هذه النسبة»
    // came to be emitted for F6 with zero provider calls: the request had done plenty of work,
    // and the attribution slot had had none of it. Every negative sentence now has to point at
    // the record for its OWN slot. Keyed "issueId:slot".
    this.slotProofs = new Map();
    this.gateResults = [];
    this.sentences = [];
    this.rejections = [];
  }

  // ── state machine ──────────────────────────────────────────────────────────
  canTransition(to) { return (EDGES[this.state] || []).includes(to); }
  transition(to) {
    if (!STATES.includes(to)) throw new Error('unknown state: ' + to);
    if (!this.canTransition(to)) {
      throw new Error('illegal transition ' + this.state + ' -> ' + to);
    }
    this.state = to;
    this.transitions.push(to);
    return this;
  }

  // ── writes ─────────────────────────────────────────────────────────────────
  setIssues(issues, policy) {
    this.issues = issues.slice();
    // The plan-level policy block, so an issue that somehow lacks its own still resolves one.
    this.policy = policy || (issues[0] && issues[0].policy) || null;
    for (const iss of issues) {
      for (const slot of iss.requiredSlots) {
        this.requiredSlots.push({ issueId: iss.issueId, slot });
        this.slotStatus.set(iss.issueId + ':' + slot, { status: 'unfilled', claimIds: [] });
        // Every declared slot starts with an EMPTY proof, not with no proof. "Nobody has looked
        // for this yet" is a fact worth being able to state, and it is the one that makes a
        // negative sentence about the slot refusable.
        this.slotProofs.set(iss.issueId + ':' + slot, newSlotProof(slot));
      }
    }
    return this;
  }

  /** The proof record for one slot. Never undefined for a declared slot. */
  slotProof(issueId, slot) {
    return this.slotProofs.get(issueId + ':' + slot) || newSlotProof(slot);
  }

  /**
   * Fold one search episode into a slot's proof.
   *
   * The OUTCOME is derived inside lib/policy/slot-proof.js from the counters, never passed in —
   * a caller that could name its own outcome could claim SEARCHED_NO_RESULTS for a slot it never
   * searched, which is the exact claim this record exists to make impossible.
   */
  recordSlotProof(issueId, slot, episode) {
    const key = issueId + ':' + slot;
    if (!this.slotProofs.has(key)) this.slotProofs.set(key, newSlotProof(slot));
    this.slotProofs.set(key, recordSlotEpisode(this.slotProofs.get(key), episode));
    return this;
  }

  /** Every slot proof for an issue, in declaration order, in wire shape. */
  slotProofsFor(issueId) {
    return this.requiredSlots
      .filter((r) => r.issueId === issueId)
      .map((r) => slotProofToWire(this.slotProof(r.issueId, r.slot)));
  }

  recordSearchAttempt(a) {
    this.searchAttempts.push({
      issueId: a.issueId, batchIndex: a.batchIndex, sites: (a.sites || []).slice(),
      chars: a.chars, words: a.words, resultCount: a.resultCount || 0,
      refusedCount: a.refusedCount || 0, cache: a.cache || 'miss', ok: !!a.ok,
    });
    return this;
  }

  recordInjectionMarkers(markers) {
    this.injectionMarkersSeen += Array.isArray(markers) ? markers.length : 0;
    return this;
  }

  /**
   * Add a segmented page. Span and unit ids are namespaced by sourceId, so two pages both
   * carrying `u1s1` cannot collide — which is exactly the collision that would let a claim
   * appear to draw on one unit while drawing on two.
   */
  addSegmentedPage(seg, meta = {}) {
    const sid = seg.sourceId;
    this.recordInjectionMarkers(seg.injectionMarkers);
    this.sources.set(sid, {
      sourceId: sid,
      canonicalUrl: seg.canonicalUrl,
      host: meta.host || '',
      ownerId: meta.ownerId || null,
      capability: meta.capability || '',
      adapterVersion: seg.adapterVersion,
      extractionSchemaVersion: seg.extractionSchemaVersion,
      title: seg.title,
      author: seg.author,
      attributionType: seg.attributionType,
      dates: seg.dates,
      contentSha256: seg.contentSha256,
      injectionMarkers: seg.injectionMarkers.slice(),
    });
    this.pageText.set(sid, seg.authorialText);
    for (const u of seg.answerUnits) {
      this.answerUnits.set(sid + '#' + u.answerUnitId, {
        globalId: sid + '#' + u.answerUnitId,
        answerUnitId: u.answerUnitId, sourceId: sid,
        startOffsetUtf8Bytes: u.startOffsetUtf8Bytes, endOffsetUtf8Bytes: u.endOffsetUtf8Bytes,
        contentSha256: u.contentSha256,
      });
    }
    for (const s of seg.spans) {
      this.spans.set(sid + '#' + s.spanId, {
        globalId: sid + '#' + s.spanId,
        spanId: s.spanId, sourceId: sid, canonicalUrl: s.canonicalUrl,
        answerUnitId: s.answerUnitId, exactText: s.exactText,
        startOffsetUtf8Bytes: s.startOffsetUtf8Bytes, endOffsetUtf8Bytes: s.endOffsetUtf8Bytes,
        contentSha256: s.contentSha256, adapterVersion: s.adapterVersion,
      });
    }
    return this;
  }

  span(globalId) { return this.spans.get(globalId) || null; }
  source(sourceId) { return this.sources.get(sourceId) || null; }

  /**
   * A CLAIM CARRIES THE POLICY FACTS OF ITS OWN ISSUE.
   *
   * They are stamped HERE rather than left to the extractor, for the same reason the attribution
   * slot is filled from the registry rather than from a claim label: the extractor reads pages,
   * and a page cannot tell you what relation the READER asked about. Gate 3 and the assembly then
   * read the fields off the claim instead of re-deriving them and possibly disagreeing.
   */
  addClaim(claim) {
    const issue = this.issues.find((i) => i.issueId === claim.issueId);
    const p = (issue && issue.policy) || this.policy || null;
    if (p) {
      claim.claimRelation = p.claimRelation;
      claim.targetType = p.targetType;
      claim.era = p.era;
      claim.provenanceCap = p.provenanceCap;
      // ── THE GRADE IS CLASSIFIED FROM THE EVIDENCE, not from the hostname ──
      //
      // This used to be `owned ? 'A' : 'C'`, where `owned` meant nothing more than "the page's
      // domain is registered to this scholar". An official site publishes more than its scholar's
      // answers, so a research-department article became grade A; and grade B — a bounded
      // quotation with a book and a locator — could never be reached at all.
      //
      // lib/policy/attribution-grades.js now reads the source row and the span text: the answer
      // unit's own attribution decides A, a verbatim run with a named book and a checkable locator
      // decides B, and a contemporary with no readable corpus stays NONE whatever the page says.
      // THE SPANS GO IN SEPARATELY, NOT JOINED. Joining them let grade B be assembled from
      // three spans that each carried one third of a citation — a quotation here, a book title
      // there, a locator somewhere else — producing a reference nobody wrote. The classifier
      // requires all three inside ONE span, and it can only do that if it can still see where
      // each span ends.
      const src = this.source(claim.sourceId);
      const evidenceSpans = (claim.spanIds || [])
        .map((id) => this.span(id)).filter(Boolean).map((s) => s.exactText);
      const verdict = classifyProvenance({
        source: src || {},
        evidenceSpans,
        policy: p,
      });
      // THE CAP IS ENFORCED HERE, not merely compared later, and against the cap this ISSUE
      // computed rather than one re-derived from era and adapter. A grade outside the cap is not
      // a weaker claim — it is no attribution at all.
      claim.provenanceGrade = gradeWithinCap(verdict.grade, p.provenanceCap) ? verdict.grade : 'NONE';
      claim.provenanceReason = verdict.reason;
      claim.provenanceLocator = verdict.locator || '';
    }
    this.claims.push(claim);
    this.evidenceBundles.set(claim.claimId, (claim.spanIds || []).slice());
    for (const c of claim.components || []) {
      this.claimComponents.push({ ...c, claimId: claim.claimId });
    }
    return this;
  }

  claim(id) { return this.claims.find((c) => c.claimId === id) || null; }
  componentsOf(claimId) { return this.claimComponents.filter((c) => c.claimId === claimId); }

  recordGate(gate, subjectId, pass, detail) {
    this.gateResults.push({ gate, subjectId, pass: !!pass, detail: detail || '' });
    return this;
  }

  /**
   * @param {string} code    a REJECTION constant
   * @param {string} detail  prose, for a log. NEVER reaches the metrics record.
   * @param {string} issueId which issue, when the refusal is one issue's rather than the plan's
   * @param {string[]} fields  BARE IDENTIFIERS naming what broke — and the only part of a
   *   rejection that telemetryShape() is allowed to publish beside the code.
   *
   * WHY `fields` IS FILTERED HERE AND NOT AT THE CALLER. `detail` is prose and is dropped by the
   * metrics allow-list, which is correct and is also why «PLAN_INVALID / schema» was the only
   * thing production could ever say. `fields` is the narrow channel that fixes that, so it is
   * exactly the channel a future caller would be tempted to widen — one `String(e.message)` and
   * a question is in the store. It is therefore constrained at the LEDGER boundary, not by the
   * discipline of every call site: anything that is not a short bare identifier is dropped here,
   * before it can be recorded at all.
   */
  reject(code, detail, issueId, fields) {
    const named = (Array.isArray(fields) ? fields : [])
      .filter((f) => typeof f === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(f))
      .slice(0, 8);
    this.rejections.push({ code, detail: detail || '', issueId: issueId || null, fields: named });
    return this;
  }

  markSlot(issueId, slot, status, claimId) {
    const key = issueId + ':' + slot;
    const cur = this.slotStatus.get(key);
    if (!cur) return this;
    cur.status = status;
    if (claimId && !cur.claimIds.includes(claimId)) cur.claimIds.push(claimId);
    return this;
  }

  slotsFor(issueId) {
    return this.requiredSlots.filter((r) => r.issueId === issueId)
      .map((r) => ({ ...r, ...this.slotStatus.get(r.issueId + ':' + r.slot) }));
  }

  allSlotsFilled() {
    if (!this.requiredSlots.length) return false;
    return this.requiredSlots.every((r) => this.slotStatus.get(r.issueId + ':' + r.slot)?.status === 'filled');
  }

  /**
   * Is every required slot of this issue filled?
   *
   * VACUOUSLY TRUE FOR AN ISSUE WITH NO REQUIRED SLOTS. «ما فضل الصلاة؟» is a `general` issue
   * and declares none — there is no part of it a reader would notice missing — so "all of them
   * are filled" is true of an empty set. The earlier `s.length > 0` guard made such an issue
   * permanently incomplete, which downgraded a perfectly complete answer to PARTIAL.
   *
   * It answers ONLY the slot question. Whether the issue produced any evidence at all is a
   * different question, and the caller that needs both asks both — see the engine's early stop.
   */
  issueComplete(issueId) {
    return this.slotsFor(issueId).every((x) => x.status === 'filled');
  }

  verifiedClaims() { return this.claims.filter((c) => c.verified === true); }

  addSentence(s) { this.sentences.push(s); return this; }

  addView(v) { this.views.push(v); return this; }
  addConflictSet(c) { this.conflictSets.push(c); return this; }

  /**
   * Structural problems that mean this ledger is not internally consistent. Empty = sound.
   *
   * @param {'all'|'answer'} scope
   *   'all'    — every claim ever extracted, including ones the gates refused. What a test wants:
   *              it can then assert that a deliberately malformed claim WAS seen as malformed.
   *   'answer' — only the claims that actually back the reply. What assembly wants.
   *
   * THE DISTINCTION IS NOT COSMETIC. Gate 1's whole job is to refuse a malformed claim, and a
   * refused claim backs nothing. Checking every candidate at assembly meant one bad extraction
   * — already caught, already dropped — turned an otherwise well-evidenced answer into a
   * refusal. The gate would have done its job and the reader would still have lost the answer.
   */
  integrityProblems(scope = 'all') {
    const problems = [];
    const claims = scope === 'answer' ? this.verifiedClaims() : this.claims;
    for (const c of claims) {
      const spanIds = this.evidenceBundles.get(c.claimId) || [];
      if (!spanIds.length) { problems.push('claim ' + c.claimId + ' has no evidence bundle'); continue; }
      const spans = spanIds.map((id) => this.span(id));
      if (spans.some((s) => !s)) { problems.push('claim ' + c.claimId + ' references a span that does not exist'); continue; }
      const units = new Set(spans.map((s) => s.sourceId + '#' + s.answerUnitId));
      const sources = new Set(spans.map((s) => s.sourceId));
      const urls = new Set(spans.map((s) => s.canonicalUrl));
      if (sources.size > 1) problems.push('claim ' + c.claimId + ' mixes ' + sources.size + ' sources');
      if (urls.size > 1) problems.push('claim ' + c.claimId + ' mixes ' + urls.size + ' canonical urls');
      if (units.size > 1) problems.push('claim ' + c.claimId + ' mixes ' + units.size + ' answer units');
      for (const comp of this.componentsOf(c.claimId)) {
        const bad = (comp.spanIds || []).filter((id) => !spanIds.includes(id));
        if (bad.length) problems.push('component ' + comp.componentId + ' cites spans outside its claim bundle');
      }
    }
    for (const s of this.sentences) {
      for (const cid of s.claimIds || []) {
        if (!this.claim(cid)) problems.push('sentence ' + s.sentenceId + ' references unknown claim ' + cid);
      }
      const views = new Set((s.claimIds || []).map((cid) => this.claim(cid)?.viewId).filter(Boolean));
      if (views.size > 1) problems.push('sentence ' + s.sentenceId + ' spans ' + views.size + ' views');
    }
    return problems;
  }

  /** The metrics-only view. No question text, no page text, no draft, no reader identity. */
  telemetryShape() {
    return {
      trace_id: this.traceId,
      states: this.transitions.slice(),
      issue_count: this.issues.length,
      intents: this.issues.map((i) => i.intent),
      required_slot_count: this.requiredSlots.length,
      filled_slot_count: this.requiredSlots.filter((r) => this.slotStatus.get(r.issueId + ':' + r.slot)?.status === 'filled').length,
      source_count: this.sources.size,
      span_count: this.spans.size,
      claim_count: this.claims.length,
      verified_claim_count: this.verifiedClaims().length,
      sentence_count: this.sentences.length,
      surviving_sentence_count: this.sentences.filter((s) => s.verified).length,
      gate_pass: this.gateResults.filter((g) => g.pass).length,
      gate_fail: this.gateResults.filter((g) => !g.pass).length,
      gate_fail_by_gate: this.gateResults.filter((g) => !g.pass)
        .reduce((a, g) => { a[g.gate] = (a[g.gate] || 0) + 1; return a; }, {}),
      // THE CODE, AND WHAT BROKE. This used to be `r.code` alone, and that single `.map` is why
      // the planner defect of 2026-08-07 was undiagnosable from production: every malformed
      // reply recorded `query_plan_failed_schema_validation` and nothing else, while
      // lib/ledger/engine.js was building the field name one layer up and handing it to a
      // rejection whose only published half discarded it. A named field costs nine characters
      // and turns «the plan failed» into «`intent` failed».
      //
      // `code:field`, one entry per field, because a metrics store's array of short codes is a
      // thing you can count — `rejection_codes` grouped by value answers «which field is
      // breaking most» without a single word anybody typed being retained. `detail` is still
      // never published: it is prose, and prose is where a question hides.
      rejection_codes: this.rejections.flatMap((r) => (
        r.fields && r.fields.length ? r.fields.map((f) => r.code + ':' + f) : [r.code]
      )),
      search_attempts: this.searchAttempts.map((a) => ({
        issue: a.issueId, batch: a.batchIndex, sites: a.sites.length,
        chars: a.chars, words: a.words, results: a.resultCount, refused: a.refusedCount, cache: a.cache,
      })),
      injection_markers_seen: this.injectionMarkersSeen,
    };
  }
}
