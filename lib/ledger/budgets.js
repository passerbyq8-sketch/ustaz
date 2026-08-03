// lib/ledger/budgets.js
// EVERY LIMIT THIS ENGINE OBEYS, IN ONE PLACE, AND A LEDGER THAT SPENDS AGAINST THEM.
//
// WHY ONE MODULE. The defect that took adult retrieval down on 2026-08-03 was a query built in
// one file and measured in none. Numbers scattered across a request path are numbers nobody
// can check: the scheduler cannot ask "can I afford this" if the answer lives in five files.
// So the constants are here, the SPENDING is here, and every call site asks before it pays.
//
// THESE ARE INITIAL, MEASURED-AGAINST BOUNDS, NOT ASPIRATIONS. If a bound turns out to be too
// tight, it is raised HERE, deliberately, with the measurement recorded — never widened
// silently at a call site, and never worked around by splitting one call into two.
//
// THE PROVIDER'S CEILING AND OURS ARE BOTH DECLARED, and ours is strictly below. The provider
// numbers are re-exported from lib/brave-query.js rather than restated, because two copies of
// a number is one number waiting to drift.

import { HARD_MAX_CHARS, HARD_MAX_WORDS, measureQuery } from '../brave-query.js';

// ── provider bounds (theirs — we must never reach them) ──────────────────────
export const PROVIDER_MAX_QUERY_CHARS = HARD_MAX_CHARS;   // 400
export const PROVIDER_MAX_QUERY_WORDS = HARD_MAX_WORDS;   // 50

// ── internal bounds (ours — what we actually build to) ───────────────────────
export const INTERNAL_MAX_QUERY_CHARS = 380;
export const INTERNAL_MAX_QUERY_WORDS = 45;

// ── network and model budgets, per request ───────────────────────────────────
export const MAX_BRAVE_CALLS = 4;
export const MAX_PAGES_FETCHED = 5;
export const MAX_FETCH_CONCURRENCY = 3;
export const MAX_VERIFIED_CYCLES = 2;

// THE SEVEN, ITEMISED. The engine's state machine cannot make an eighth call because there is
// no eighth thing to call:
//     1  query IR
//     2  claim extraction        (max, one per verified cycle)
//     2  claim verification      (max, one per verified cycle — INDEPENDENT of extraction)
//     1  drafting
//     1  sentence verification
//   = 7
export const MAX_MODEL_CALLS = 7;
export const MODEL_CALL_BUDGET = Object.freeze({
  query_ir: 1,
  claim_extraction: MAX_VERIFIED_CYCLES,
  claim_verification: MAX_VERIFIED_CYCLES,
  drafting: 1,
  sentence_verification: 1,
});

export const MAX_MODEL_INPUT_TOKENS = 15000;
export const MAX_MODEL_OUTPUT_TOKENS = 3000;
export const GLOBAL_TIMEOUT_MS = 25000;

// Per-operation timeouts, all strictly inside GLOBAL_TIMEOUT_MS so no single step can eat the
// whole request. The engine also enforces the global deadline independently, because a sum of
// individually-legal waits is still an illegal total.
export const SEARCH_TIMEOUT_MS = 6000;
export const FETCH_TIMEOUT_MS = 8000;
export const MODEL_TIMEOUT_MS = 12000;

// Response-size ceiling for a fetched page. A 635 KB forum thread is not evidence, and reading
// it costs the request its deadline.
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = Object.freeze([
  'text/html', 'application/xhtml+xml', 'text/plain',
]);

// ── the spend ledger ─────────────────────────────────────────────────────────
// A budget nobody checks is a comment. This is the object the scheduler consults BEFORE every
// call, and it refuses rather than throwing — a refusal degrades to a partial answer, an
// exception degrades to a 500.

export class Budget {
  constructor(opts = {}) {
    this.limits = Object.freeze({
      braveCalls: opts.braveCalls ?? MAX_BRAVE_CALLS,
      pagesFetched: opts.pagesFetched ?? MAX_PAGES_FETCHED,
      modelCalls: opts.modelCalls ?? MAX_MODEL_CALLS,
      verifiedCycles: opts.verifiedCycles ?? MAX_VERIFIED_CYCLES,
      inputTokens: opts.inputTokens ?? MAX_MODEL_INPUT_TOKENS,
      outputTokens: opts.outputTokens ?? MAX_MODEL_OUTPUT_TOKENS,
      timeoutMs: opts.timeoutMs ?? GLOBAL_TIMEOUT_MS,
    });
    this.spent = { braveCalls: 0, pagesFetched: 0, modelCalls: 0, verifiedCycles: 0, inputTokens: 0, outputTokens: 0 };
    this.byPurpose = Object.create(null);
    // Injected so tests are deterministic and the module needs no clock of its own.
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    this.startedAt = this.now();
    this.breaches = [];
  }

  elapsedMs() { return this.now() - this.startedAt; }
  remainingMs() { return Math.max(0, this.limits.timeoutMs - this.elapsedMs()); }
  deadlineReached() { return this.remainingMs() <= 0; }

  /** Can we afford `n` more of `kind`, and is there time left? Never throws. */
  canAfford(kind, n = 1) {
    if (this.deadlineReached()) return false;
    const limit = this.limits[kind];
    if (limit === undefined) return false;
    return (this.spent[kind] + n) <= limit;
  }

  /**
   * Record a spend. Returns true if it was within budget, false if it was a BREACH — and a
   * breach is recorded rather than hidden, so the telemetry can report it and the guard can
   * assert it never happens on a normal path.
   */
  spend(kind, n = 1, purpose = '') {
    if (this.spent[kind] === undefined) return false;
    const within = this.canAfford(kind, n);
    this.spent[kind] += n;
    if (purpose) {
      const key = kind + ':' + purpose;
      this.byPurpose[key] = (this.byPurpose[key] || 0) + n;
    }
    if (!within) this.breaches.push({ kind, n, spent: this.spent[kind], limit: this.limits[kind] });
    return within;
  }

  /** A model call is only affordable if BOTH the count and the token budget allow it. */
  canAffordModelCall(estimatedInputTokens = 0) {
    return this.canAfford('modelCalls', 1)
      && (this.spent.inputTokens + estimatedInputTokens) <= this.limits.inputTokens;
  }

  snapshot() {
    return {
      limits: { ...this.limits },
      spent: { ...this.spent },
      byPurpose: { ...this.byPurpose },
      elapsedMs: this.elapsedMs(),
      breaches: this.breaches.slice(),
    };
  }
}

// ── measurement, in the units the provider counts ────────────────────────────
export { measureQuery };

export function withinInternalBounds(q) {
  const m = measureQuery(q);
  return m.chars <= INTERNAL_MAX_QUERY_CHARS && m.words <= INTERNAL_MAX_QUERY_WORDS;
}
export function withinProviderBounds(q) {
  const m = measureQuery(q);
  return m.chars <= PROVIDER_MAX_QUERY_CHARS && m.words <= PROVIDER_MAX_QUERY_WORDS;
}

/**
 * The verdict a boundary test reads. Three outcomes, not two, because "too long" has two very
 * different meanings: inside our own limit it is sendable; between ours and the provider's it
 * must be split or refused BY US; past the provider's it is a bug we refuse to put on the wire.
 */
export function queryVerdict(q) {
  const m = measureQuery(q);
  if (m.chars <= INTERNAL_MAX_QUERY_CHARS && m.words <= INTERNAL_MAX_QUERY_WORDS) return 'PASS';
  if (m.chars <= PROVIDER_MAX_QUERY_CHARS && m.words <= PROVIDER_MAX_QUERY_WORDS) return 'SPLIT_OR_REJECT';
  return 'BLOCKED';
}
