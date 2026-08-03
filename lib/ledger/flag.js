// lib/ledger/flag.js
// THE SWITCH. Default OFF, and every way of failing to read it is also OFF.
//
// ── WHY THE SWITCH IS NOT AN ENVIRONMENT VARIABLE ────────────────────────────
// An env var is a DEPLOY, and a deploy is minutes. A kill switch whose response time is a
// build is not a kill switch — it is a plan. The runtime value therefore lives in the Upstash
// instance the app already uses, under its own `lg:` namespace, and is re-read every few
// seconds. An env var still exists (`LEDGER_RAG`) but only as a floor: it can keep the engine
// off, and it can never turn it on by itself.
//
// ── EVERY FAILURE IS "LEGACY" ────────────────────────────────────────────────
// Store unreachable, key absent, value unparseable, value of the wrong type, secret missing,
// caller not authenticated — all of them return the same thing, which is the shipped path.
// There is exactly one arrangement of facts that produces the new engine, and it is spelled
// out in one boolean expression below.
//
// ── WHO IS AN INTERNAL TESTER ────────────────────────────────────────────────
// The existing founder credential, and nothing new. It is an HMAC over a device id keyed by
// FOUNDER_SECRET, verified SERVER-SIDE by lib/daycap.js, and it is already the mechanism this
// app trusts to unlock a paid tier. Reusing it means:
//   * no query-string flag, no URL token, no localStorage boolean — none of which is a
//     credential, all of which a reader can set;
//   * no new secret to distribute, and no weaker second mechanism invented for convenience.
// The token's VALUE is never logged, never cached, never put in a key, and never returned.

import { hasValidFounderToken } from '../daycap.js';
import * as store from './redis.js';

export const FLAG_KEY = 'ledger_rag_enabled';
export const RUNTIME_KEY = store.key('flag', FLAG_KEY);

// A few seconds. Long enough that a warm instance is not re-reading Redis on every request,
// short enough that flipping the switch takes effect before anybody can ask what went wrong.
export const FLAG_TTL_MS = 5000;

let cached = { value: false, readAt: 0, source: 'unread' };

export function __resetFlagCacheForTest() { cached = { value: false, readAt: 0, source: 'unread' }; }

/** The env floor. `LEDGER_RAG=off` (or anything but 'on') keeps the engine off unconditionally. */
export function envAllows() {
  const v = String(process.env.LEDGER_RAG ?? '').trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

/**
 * Read the runtime flag, with a short in-memory TTL.
 *
 * @returns {Promise<{enabled:boolean, source:'cache'|'store'|'unavailable'|'absent'|'malformed'}>}
 */
export async function readRuntimeFlag(now = Date.now()) {
  if (now - cached.readAt < FLAG_TTL_MS && cached.source !== 'unread') {
    return { enabled: cached.value, source: 'cache' };
  }
  if (!(await store.available())) {
    cached = { value: false, readAt: now, source: 'unavailable' };
    return { enabled: false, source: 'unavailable' };
  }
  const raw = await store.get(RUNTIME_KEY);
  if (raw === null || raw === undefined) {
    cached = { value: false, readAt: now, source: 'absent' };
    return { enabled: false, source: 'absent' };
  }
  // ONLY these exact values mean on. A truthy object, a non-empty string, a 2 — none of them.
  const enabled = raw === true || raw === 1 || raw === 'on' || raw === 'true' || raw === '1';
  const known = enabled || raw === false || raw === 0 || raw === 'off' || raw === 'false' || raw === '0';
  const source = known ? 'store' : 'malformed';
  const value = known ? enabled : false;
  cached = { value, readAt: now, source };
  return { enabled: value, source };
}

/** Does this request carry a credential that makes its sender an internal tester? */
export function isInternalTester(req) {
  try { return hasValidFounderToken(req); } catch { return false; }
}

/**
 * THE ONE DECISION.
 *
 * @returns {Promise<{path:'ledger'|'legacy', reason:string}>}
 *
 * `reason` is a code for telemetry. It never reaches a reader, and it never says whether the
 * flag is on — telling an unauthenticated prober which requests WOULD have taken the new path
 * is telling them what to forge.
 */
export async function decidePath(req, now = Date.now()) {
  if (!envAllows()) return { path: 'legacy', reason: 'env_floor_off' };
  if (!isInternalTester(req)) return { path: 'legacy', reason: 'not_internal' };
  const flag = await readRuntimeFlag(now);
  if (!flag.enabled) return { path: 'legacy', reason: 'flag_' + flag.source };
  return { path: 'ledger', reason: 'enabled' };
}

/** The default, stated as a value so a test can assert it rather than infer it. */
export const DEFAULT_ENABLED = false;
