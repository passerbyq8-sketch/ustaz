// lib/attempts.js
// THE ATTEMPT LIMITER, ONCE. Directive 13 / directive 12.
//
// This started life inside api/unlock.js and moved here the moment a SECOND secret needed the
// same protection. Two copies of a limiter is one limiter waiting to drift, and the way that
// drift shows up is the worst kind: nothing breaks, one door is simply softer than the other,
// and nobody notices until it is ground open.
//
// The client is PASSED IN rather than built here. Each endpoint already owns a Redis client and
// a test seam for it, and a second lazily-built client in this module would mean a probe has to
// find and stub two of them -- so the one it stubs looks limited while the one it missed is not.
//
// NAMESPACED, DELIBERATELY. Every caller brings its own key prefix, so the founder PIN and the
// parent-panel code count against SEPARATE budgets. They are different secrets protecting
// different things: a parent mistyping their own panel code must not spend the allowance that
// stands between an attacker and the founder PIN, and the reverse.
//
// NO IP, EXCEPT HERE AND api/unlock.js's caller of it. lib/daycap.js reads no address and must
// never start: a day cap asks "how much has this child used?", where a household or school NAT
// collapses many children onto one bucket and cuts off children who did nothing. An attempt
// limiter asks "is someone grinding a secret?", where a shared exit address is exactly the
// signal wanted. Same input, opposite consequence.
//
// Every Arabic character below is a \uXXXX escape and this file holds ZERO raw Arabic code
// points -- the same rule lib/daycap.js and api/unlock.js are under, for the same reason: a raw
// right-to-left string renders reversed in many editors and gets silently corrupted by anyone
// retyping what they see.

import crypto from 'node:crypto';
import { DAY_CAP_TTL_SECONDS, kuwaitDayStamp } from './daycap.js';

// The two refusals every limited endpoint can produce. Defined ONCE so the founder unlock and
// the parent panel cannot start telling the same reader two different things about the same
// mechanism. The noun the lockout line uses -- "the opening" -- is true of both doors, which is
// why one wording can serve the founder unlock and the parent panel without lying about either.
export const ATTEMPT_MESSAGES = {
  locked: '\u0623\u0648\u0642\u0641\u0646\u0627 \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0641\u062A\u062D \u0627\u0644\u064A\u0648\u0645. \u062C\u0631\u0651\u0628 \u0628\u0639\u062F \u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u0644\u064A\u0644 \u0628\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0643\u0648\u064A\u062A.',
  unavailable: '\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0639\u0646\u062F\u0646\u0627\u060C \u0641\u0623\u0648\u0642\u0641\u0646\u0627 \u0627\u0644\u0641\u062A\u062D \u0645\u0624\u0642\u062A\u064B\u0627. \u062C\u0631\u0651\u0628 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.',
};

// D13. The caller's address, reduced to a counter label and nothing else. Vercel puts the real
// client address first in x-forwarded-for at the edge; x-real-ip is the fallback for a runtime
// that sets only that. Returns null when neither is present, and then the address dimension is
// simply ABSENT -- the other dimensions still apply, so a missing header buys a caller a looser
// limit but never an unlimited one. Refusing outright instead would take the app down on any
// platform that stops setting the header.
//
// Truncated to 128 bits: far past any collision that matters for a per-day counter, and short
// enough to keep the key small. The digest is one-way, so a stolen store dump holds no readable
// address. The raw value is never logged, never echoed and never interpolated into a key.
export function ipDigest(req) {
  const h = (req && req.headers) || {};
  const fwd = typeof h['x-forwarded-for'] === 'string' ? h['x-forwarded-for'].split(',')[0] : '';
  const real = typeof h['x-real-ip'] === 'string' ? h['x-real-ip'] : '';
  const raw = (fwd || real || '').trim();
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
}

// Counts this attempt and reports whether the caller is locked out.
//   -> {}                     go ahead, and every dimension has been incremented
//   -> { locked: true }       some dimension is spent; NOTHING was incremented
//   -> { unavailable: true }  the store could not be read or written
//
// FAIL-CLOSED. A counter we cannot read is not a zero, and a store we cannot reach is not an
// empty one: both answer "unavailable", which every caller turns into a refusal. An attempt
// limiter that fails open is not a limiter, it is an invitation to brute force.
//
// EVERY dimension is judged BEFORE ANY of them is incremented. That ordering is the whole
// substance of D13's promise that an exhausted address "leaves the global untouched": if the
// check and the increment were interleaved, a locked-out grinder would still be burning the
// app-wide allowance on every refused try and would take the owner down with it.
//
// perGlobal is OPTIONAL and null means "this secret has no global dimension". The parent panel
// code passes null on purpose: that code is per-device, so an app-wide ceiling on it would hand
// any single attacker a way to lock every parent in the app out of their own panel. A global
// ceiling only makes sense for a secret that is genuinely shared, which the founder PIN is.
export async function noteAttempt(redis, opts) {
  const { ns, deviceId, ipHash, perDevice, perIp, perGlobal = null } = opts || {};
  if (!redis || !ns || !deviceId) return { unavailable: true };
  const day = kuwaitDayStamp();
  const deviceKey = `${ns}:d:${deviceId}:${day}`;
  const ipKey = ipHash ? `${ns}:ip:${ipHash}:${day}` : null;
  const globalKey = perGlobal === null ? null : `${ns}:all:${day}`;
  try {
    const keys = [deviceKey];
    if (ipKey) keys.push(ipKey);
    if (globalKey) keys.push(globalKey);
    const current = await redis.mget(...keys);
    const num = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
      return Number.isFinite(n) ? n : NaN;
    };
    const counts = current.map(num);
    if (counts.some((n) => !Number.isFinite(n))) return { unavailable: true };
    const ceilings = [perDevice];
    if (ipKey) ceilings.push(perIp);
    if (globalKey) ceilings.push(perGlobal);
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] >= ceilings[i]) return { locked: true };
    }
    const p = redis.pipeline();
    for (const k of keys) { p.incr(k); p.expire(k, DAY_CAP_TTL_SECONDS); }
    await p.exec();
    return {};
  } catch (e) {
    // No device id, no address and no secret in this line -- only the transport failure.
    console.warn('[attempts] store unreachable, fail-CLOSED:', e && e.message ? e.message : e);
    return { unavailable: true };
  }
}
