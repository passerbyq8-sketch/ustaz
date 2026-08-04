// lib/policy/slot-proof.js
// A NEGATIVE SENTENCE IS A CLAIM ABOUT OUR OWN WORK, AND IT NEEDS EVIDENCE LIKE ANY OTHER.
//
// ── THE DEFECT ───────────────────────────────────────────────────────────────
// «لم أعثر ضمن المصادر المتاحة على نصٍّ مباشر يثبت هذه النسبة» was emitted by the shipped ledger
// path for F6 with ZERO provider calls made — the scholar's name alone refused the issue before
// ORCHESTRATE_BATCHES ever ran. The sentence is not merely unhelpful there; it is FALSE. It
// reports a search that did not happen, and a reader has no way to tell it from the same sentence
// emitted after four real queries came back empty.
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
// Every required slot carries its own proof record. A sentence that asserts an absence for a slot
// may only be emitted when that slot's own record says a search was attempted — not the request's
// record, not another slot's. And the WORDING is chosen by the reason code, deterministically,
// because "we ran out of budget" and "we looked and found nothing" are different facts and a
// reader who cannot tell them apart has been misled by a true-sounding sentence.
//
// ── WHAT IS BANNED OUTRIGHT ──────────────────────────────────────────────────
// «لا يوجد قول», «لم يقل العالم», and a bare unqualified «لم نقف». None of them is sayable from
// what this app can know: we searched a bounded list of sources within a bounded budget, and the
// absence of a result in that window is not the absence of a position in the world.

import { POLICY_VERSION } from './version.js';

export { POLICY_VERSION };

export const REASON_CODES = Object.freeze([
  'NOT_SEARCHED_BUDGET',
  'SEARCHED_NO_RESULTS',
  'RESULTS_INELIGIBLE',
  'EVIDENCE_NOT_ENTAILED',
  'AMBIGUOUS_ENTITY',
]);

export const PROOF_ORIGINS = Object.freeze(['live', 'cache', 'none']);

/** A slot nobody has looked for yet. */
export function newSlotProof(slotId) {
  return Object.freeze({
    slotId: String(slotId || ''),
    searchAttempted: false,
    queryCount: 0,
    expansionCount: 0,
    resultsSeen: 0,
    eligiblePages: 0,
    verifiedClaims: 0,
    proofOrigin: 'none',
    outcome: 'NOT_SEARCHED_BUDGET',
    policyVersion: POLICY_VERSION,
  });
}

/**
 * Fold one search episode into a slot's record.
 *
 * THE OUTCOME IS DERIVED, NEVER PASSED IN. A caller that could name its own outcome could name
 * «SEARCHED_NO_RESULTS» for a slot it never searched, which is precisely the claim this module
 * exists to make impossible.
 */
export function record(proof, ep = {}) {
  const base = proof || newSlotProof('');
  const queryCount = base.queryCount + (Number(ep.queries) || 0);
  const next = {
    ...base,
    searchAttempted: base.searchAttempted || queryCount > 0,
    queryCount,
    expansionCount: base.expansionCount + (Number(ep.expansions) || 0),
    resultsSeen: base.resultsSeen + (Number(ep.resultsSeen) || 0),
    eligiblePages: base.eligiblePages + (Number(ep.eligiblePages) || 0),
    verifiedClaims: base.verifiedClaims + (Number(ep.verifiedClaims) || 0),
    proofOrigin: PROOF_ORIGINS.includes(ep.origin) ? ep.origin : base.proofOrigin,
  };
  next.outcome = deriveOutcome(next, ep);
  return Object.freeze(next);
}

function deriveOutcome(p, ep = {}) {
  if (ep.ambiguousEntity) return 'AMBIGUOUS_ENTITY';
  if (!p.searchAttempted) return 'NOT_SEARCHED_BUDGET';
  if (p.resultsSeen === 0) return 'SEARCHED_NO_RESULTS';
  if (p.eligiblePages === 0) return 'RESULTS_INELIGIBLE';
  if (p.verifiedClaims === 0) return 'EVIDENCE_NOT_ENTAILED';
  return 'EVIDENCE_VERIFIED';
}

/** Mark a slot as never searched because the budget was already gone. */
export function budgetBlocked(proof) {
  const base = proof || newSlotProof('');
  return Object.freeze({ ...base, searchAttempted: false, outcome: 'NOT_SEARCHED_BUDGET' });
}

/** Mark a slot as unsearchable because the entity did not resolve to one person. */
export function ambiguous(proof) {
  const base = proof || newSlotProof('');
  return Object.freeze({ ...base, outcome: 'AMBIGUOUS_ENTITY' });
}

/**
 * MAY A SENTENCE ASSERT AN ABSENCE FOR THIS SLOT?
 *
 * Only if this slot was actually searched. Budget exhaustion is a real and honest outcome — it
 * just is not an absence of evidence, and it gets its own wording below.
 */
export function negationAllowed(proof) {
  return !!(proof && proof.searchAttempted);
}

// ── the wordings ─────────────────────────────────────────────────────────────
//
// ONE PER REASON, AND EACH SAYS WHAT ACTUALLY HAPPENED. Every one of them is scoped — to our
// sources, to our budget, to this question — because an unscoped negation is a claim about the
// world that we did not check and cannot make.
const WORDING = Object.freeze({
  NOT_SEARCHED_BUDGET:
    'تعذر استكمال البحث ضمن الحدود التشغيلية لهذا السؤال، فلم يُستوفَ هذا الجزء بعد.',
  SEARCHED_NO_RESULTS:
    'لم نقف في المصادر المعتمدة المتاحة لعزك على ما يخصّ هذا الجزء من سؤالك.',
  RESULTS_INELIGIBLE:
    'وجدنا صفحاتٍ متصلةً بالموضوع، لكنها ليست من نوع المصادر التي يصحّ الاستناد إليها في هذا الجزء.',
  EVIDENCE_NOT_ENTAILED:
    'وجدنا مواد تتناول المسألة، لكن لم يثبت منها ما يكفي لإسناد هذا الجزء إسنادًا صريحًا.',
  AMBIGUOUS_ENTITY:
    'الاسم المذكور ينطبق على أكثر من عالم، ولا نختار أحدهم بالظنّ — أيّهما تقصد؟',
});

export function wordingFor(reasonCode) {
  return WORDING[reasonCode] || WORDING.EVIDENCE_NOT_ENTAILED;
}

/** The wording this slot's own record earns. */
export function wordingForProof(proof) {
  return wordingFor((proof && proof.outcome) || 'NOT_SEARCHED_BUDGET');
}

// ── the wire shape ───────────────────────────────────────────────────────────
// snake_case, because this is what telemetry and the fixtures record. It carries counters and
// codes only: no query text, no page text, no reader identity.
export function toWire(proof) {
  const p = proof || newSlotProof('');
  return {
    slot_id: p.slotId,
    search_attempted: p.searchAttempted,
    query_count: p.queryCount,
    expansion_count: p.expansionCount,
    results_seen: p.resultsSeen,
    eligible_pages: p.eligiblePages,
    verified_claims: p.verifiedClaims,
    proof_origin: p.proofOrigin,
    outcome: p.outcome,
  };
}

// ── the check ────────────────────────────────────────────────────────────────
//
// Phrases that assert we looked and came up empty. A reply carrying one of these for a slot whose
// record says nothing was searched is asserting work that was never done.
const EPISTEMIC_NEGATION = [
  'لم يمكن توثيق', 'لم نقف', 'لم نجد', 'لم أعثر', 'لم اعثر', 'تعذر توثيق',
  'لا يوجد قول', 'لم يثبت عنه', 'ليس له قول',
];

// Absolute claims that no proof can license, because they are claims about the world rather than
// about our search.
const ABSOLUTE_NEGATION = ['لا يوجد قول', 'لم يقل العالم', 'ليس له قول', 'لا قول له'];

export function assertsAbsolute(text) {
  const t = String(text || '');
  return ABSOLUTE_NEGATION.some((w) => t.includes(w));
}

/**
 * @param {{outcome:string, text:string}} reply
 * @param {object} proof the record for the SLOT this sentence is about
 * @returns {boolean} true when the reply must not be emitted as written
 */
export function violatesProof(reply, proof) {
  const text = String((reply && reply.text) || '');
  if (!text) return false;
  // An absolute negation is refused whatever the proof says.
  if (assertsAbsolute(text)) return true;
  const negates = EPISTEMIC_NEGATION.some((w) => text.includes(w));
  if (!negates) return false;
  return !negationAllowed(proof);
}
