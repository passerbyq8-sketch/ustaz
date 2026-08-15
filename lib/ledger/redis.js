// lib/ledger/redis.js
// THE SAME UPSTASH INSTANCE THE APP ALREADY USES, REACHED THE SAME WAY.
//
// No new cloud resource, no new credential, no second client library. The explicit-credential
// shape is copied from lib/ratelimit.js and lib/daycap.js for the reason recorded there:
// Vercel injects KV_REST_API_*, while @upstash/redis's auto-env expects UPSTASH_REDIS_REST_*,
// so a client built without arguments silently points at nothing.
//
// Ledger cache keys remain namespaced `lg:`. The paid-search budget deliberately uses its own
// explicit `ezik:search-budget:v2:<environment>:<UTC-day>` namespace so its operational counters
// cannot collide with cache, rate-limit, report, or legacy budget keys.
//
// UNAVAILABILITY IS NOT AN ERROR HERE. Every helper returns null / false rather than throwing:
// a cache is an optimisation, and a kill switch that cannot be read must read as OFF. Both of
// those are answers, not failures.

import { Redis } from '@upstash/redis';

export const NAMESPACE = 'lg:';

let _redis = null;
let _forced = false;

function client() {
  if (_forced) return _redis;
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  _redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return _redis;
}

/** Test seam. Pass null to simulate an unreachable store. */
export function __setRedisForTest(r) { _redis = r; _forced = true; }
export function __resetRedis() { _redis = null; _forced = false; }

export function key(...parts) {
  return NAMESPACE + parts.map((p) => String(p).replace(/[\s:]/g, '_')).join(':');
}

export async function get(k) {
  const c = client();
  if (!c) return null;
  try { return await c.get(k); } catch { return null; }
}

export async function setex(k, ttlSeconds, value) {
  const c = client();
  if (!c) return false;
  try { await c.set(k, value, { ex: Math.max(1, Math.floor(ttlSeconds)) }); return true; } catch { return false; }
}

/**
 * ATOMIC INCREMENT, for the daily search budget.
 *
 * WHY NOT get-then-set. Two requests reading 99 against a limit of 100 both see room and both
 * spend, and the counter that exists to stop overspend has just authorised twice the ceiling.
 * INCR returns the post-increment value in one round trip, so the caller learns its OWN position
 * in the sequence and there is no window between reading and reserving.
 *
 * Returns null when the store is unreachable. The CALLER decides what that means; this module
 * does not, because "the store is down" is a different decision for a cache than for a spend cap.
 */
export async function incr(k) {
  const c = client();
  if (!c) return null;
  try { return await c.incr(k); } catch { return null; }
}

export async function expire(k, ttlSeconds) {
  const c = client();
  if (!c) return false;
  try { await c.expire(k, Math.max(1, Math.floor(ttlSeconds))); return true; } catch { return false; }
}

/**
 * RUN A SERVER-SIDE SCRIPT — the only way to make a multi-step reservation atomic.
 *
 * WHY THIS IS NEEDED AT ALL. `INCR` then `EXPIRE` is two round trips. Between them the process
 * can die, the network can drop, or the serverless invocation can be frozen — and the counter is
 * then a key with NO TTL, which never resets and silently caps the service at its ceiling
 * forever. Worse, the compare-against-limit that follows is a third step, so two requests can
 * interleave between the increment and the decision.
 *
 * Upstash exposes EVAL over its REST API (@upstash/redis 1.38), so the whole reservation —
 * increment, set the expiry on the first increment only, compare, decide — is ONE operation with
 * no window in it. No new dependency; this is the client the app already constructs.
 *
 * Returns null when the store is unreachable or the script fails. The caller decides what that
 * means; a spend cap and a cache do not want the same answer.
 */
export async function evalScript(script, keys, args) {
  const c = client();
  if (!c) return null;
  try { return await c.eval(script, keys, args); } catch { return null; }
}

export async function available() {
  return client() !== null;
}
