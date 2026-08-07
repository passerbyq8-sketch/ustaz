// lib/ledger/telemetry.js
// METRICS, AND NOTHING THAT COULD IDENTIFY A READER OR REPRODUCE AN ANSWER.
//
// THE ALLOW-LIST IS THE MECHANISM. A deny-list of sensitive fields fails the moment somebody
// adds a field — and the field somebody adds under pressure, at 2am, is the one carrying the
// question text. So this module builds its record from a FIXED set of keys and drops
// everything else, including keys it has never heard of.
//
// SPECIFICALLY FORBIDDEN, and asserted by the guard rather than merely intended:
//   the reader's question, any page's extracted text, any span's exactText, the draft, any
//   surviving sentence, a device id, a cookie, an IP, a header, a token, a cache key's input.
//
// WHAT IS KEPT is the shape of the request: how many issues, which intents, how many calls,
// how long, which gates failed, which reason codes fired. That is enough to answer "is the
// engine refusing too much" without retaining a single word anybody typed.
//
// TTL IS 48 HOURS, MAXIMUM. Long enough to debug a bad day; short enough that the store is not
// a record of anything.
//
// SINCE 2026-08-07 THIS IS WRITTEN FOR EVERY REQUEST, not only an internal tester's (owner
// decision). The allow-list below is therefore the ONLY thing standing between this store and a
// reader's words — see record() for why that was always true and is now simply stated plainly.

import * as store from './redis.js';

export const TELEMETRY_TTL_SECONDS = 48 * 60 * 60;
export const TELEMETRY_SCHEMA_VERSION = 'lg-telem-v1';

// Every key that may appear in a telemetry record. Anything else is dropped, silently and
// completely — including nested objects, which are flattened by the shapers below.
export const ALLOWED_FIELDS = Object.freeze([
  'schema', 'trace_id', 'states', 'issue_count', 'intents',
  'required_slot_count', 'filled_slot_count', 'slot_coverage',
  'source_count', 'span_count', 'claim_count', 'verified_claim_count',
  'sentence_count', 'surviving_sentence_count',
  'gate_pass', 'gate_fail', 'gate_fail_by_gate', 'rejection_codes',
  'search_attempts', 'injection_markers_seen',
  'query_chars', 'query_words', 'brave_calls', 'fetch_count', 'model_calls',
  'input_tokens', 'output_tokens',
  'cache_hits', 'cache_misses',
  'latency_ms', 'latency_by_stage',
  'adapter_versions', 'source_policy_version', 'flag_state',
  'outcome', 'budget_breaches',
]);

const ALLOWED = new Set(ALLOWED_FIELDS);

// Values are scalars, arrays of scalars, or ONE level of {string: number}. A nested object of
// arbitrary depth is where free text hides.
function sanitizeValue(v, depth = 0) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    // Strings are bounded and must look like a code, not like prose. A value carrying a space
    // or a non-ASCII character is refused: reason codes, versions and state names have neither.
    if (v.length > 64) return null;
    if (!/^[A-Za-z0-9_.:\-/]+$/.test(v)) return null;
    return v;
  }
  if (Array.isArray(v)) {
    if (depth >= 2) return null;
    return v.slice(0, 32).map((x) => sanitizeValue(x, depth + 1)).filter((x) => x !== null);
  }
  if (typeof v === 'object' && depth < 1) {
    const out = {};
    for (const [k, val] of Object.entries(v).slice(0, 32)) {
      if (!/^[A-Za-z0-9_.:\-#]+$/.test(k) || k.length > 40) continue;
      const s = sanitizeValue(val, depth + 1);
      if (s !== null) out[k] = s;
    }
    return out;
  }
  return null;
}

/**
 * Build the record. Returns { record, dropped } so a test can assert exactly what was refused.
 */
export function buildRecord(raw) {
  const record = { schema: TELEMETRY_SCHEMA_VERSION };
  const dropped = [];
  for (const [k, v] of Object.entries(raw || {})) {
    if (!ALLOWED.has(k)) { dropped.push(k); continue; }
    const s = sanitizeValue(v);
    if (s === null) { dropped.push(k); continue; }
    record[k] = s;
  }
  return { record, dropped };
}

/**
 * Assemble a record from a ledger plus the request's budget and timings.
 * The ledger's own telemetryShape() is already metrics-only; this adds the runtime numbers.
 */
export function fromLedger(ledger, { budget, latencyByStage, cacheHits, cacheMisses, outcome, flagState, sourcePolicyVersion } = {}) {
  const base = ledger.telemetryShape();
  const snap = budget ? budget.snapshot() : null;
  const searchAttempts = base.search_attempts || [];
  return buildRecord({
    ...base,
    // The per-attempt objects carry a query LENGTH, never a query.
    search_attempts: searchAttempts.length,
    query_chars: searchAttempts.map((a) => a.chars),
    query_words: searchAttempts.map((a) => a.words),
    slot_coverage: base.required_slot_count
      ? Math.round((base.filled_slot_count / base.required_slot_count) * 100)
      : 0,
    brave_calls: snap ? snap.spent.braveCalls : 0,
    fetch_count: snap ? snap.spent.pagesFetched : 0,
    model_calls: snap ? snap.spent.modelCalls : 0,
    input_tokens: snap ? snap.spent.inputTokens : 0,
    output_tokens: snap ? snap.spent.outputTokens : 0,
    budget_breaches: snap ? snap.breaches.length : 0,
    latency_ms: snap ? snap.elapsedMs : 0,
    latency_by_stage: latencyByStage || {},
    cache_hits: cacheHits || 0,
    cache_misses: cacheMisses || 0,
    outcome: outcome || 'UNKNOWN',
    flag_state: flagState || 'legacy',
    source_policy_version: sourcePolicyVersion || '',
  });
}

/**
 * Write a record. EVERY REQUEST, NOT ONLY AN INTERNAL TESTER'S (owner decision, 2026-08-07).
 *
 * WHAT THE GATE USED TO BE, AND WHY REMOVING IT IS NOT A LOOSENING. This function used to refuse
 * unless the caller passed `internal: true`, which made the store a record of a handful of staff
 * requests. The group test needs the opposite: a request nobody can observe is a request that
 * cannot be counted, and a rollout judged on the few sessions that happened to be staff is a
 * rollout judged on the wrong sample.
 *
 * THE ALLOW-LIST IS WHAT MAKES THIS SAFE, and it is now the ONLY thing that does. That is a
 * deliberate concentration of the argument, not an oversight: the second gate was never a privacy
 * mechanism — it limited the VOLUME of records, not their contents. A record that would have been
 * unsafe to keep about a tester would have been equally unsafe to keep about anybody. So the
 * protection lives where it always actually lived: buildRecord() constructs from a FIXED key set
 * and drops everything else, including keys it has never heard of, and sanitizeValue() refuses any
 * string that looks like prose rather than a code. Nothing reaching this line can carry a
 * question, a page, a draft, a device id, a cookie, an IP, a header or a token.
 *
 * WHAT DID NOT CHANGE. The 48-hour TTL still bounds how long any of it exists, the trace id is
 * still not derived from anything the reader typed, and a store outage is still not an error —
 * telemetry is never allowed to affect an answer.
 */
export async function record(rec) {
  const traceId = rec && rec.trace_id;
  if (!traceId || !/^[A-Za-z0-9_-]{3,48}$/.test(traceId)) return { written: false, reason: 'bad-trace-id' };
  const ok = await store.setex(store.key('t', traceId), TELEMETRY_TTL_SECONDS, rec);
  return { written: ok, reason: ok ? '' : 'store-unavailable' };
}
