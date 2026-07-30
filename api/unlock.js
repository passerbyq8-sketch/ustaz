// api/unlock.js
// PIN -> founder token. Phase 3 (directive 82).
//
// THE PIN NEVER LEAVES THE SERVER ENVIRONMENT. It is compared here against UNLOCK_PIN and is
// never logged, never echoed into an error body, and never placed in a URL or a query string.
// What the client receives back is only the token lib/daycap.js already verifies -- so the one
// secret that lifts the daily cap also unlocks the deep tiers, with exactly one verifier for
// both and no second implementation to drift.
//
// NO IP, here as everywhere: the attempt limit is keyed by deviceId alone.
//
// Every Arabic character below is a \uXXXX escape and this file holds ZERO raw Arabic code
// points -- the same rule directive 80 fixed lib/daycap.js under, for the same reason: a raw
// right-to-left string renders reversed in many editors and gets silently corrupted by anyone
// retyping what they see.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { safeId, founderTokenFor, kuwaitDayStamp, DAY_CAP_TTL_SECONDS } from '../lib/daycap.js';

// Attempts per device per Kuwait day, and across all devices per Kuwait day. The global one
// exists because a per-device limit cannot stop an attacker who mints a new device id per try.
const PER_DEVICE_ATTEMPTS = 5;
const GLOBAL_ATTEMPTS = 50;

// Defined once. Never printed to a console, and never told apart by the caller: a wrong PIN, an
// unusable device id and an unset FOUNDER_SECRET all return the SAME refusal, so probing cannot
// learn which part it got wrong.
export const UNLOCK_MESSAGES = {
  'unlock-refused': '\u0627\u0644\u0631\u0645\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.',
  'unlock-locked': '\u0623\u0648\u0642\u0641\u0646\u0627 \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0641\u062A\u062D \u0627\u0644\u064A\u0648\u0645. \u062C\u0631\u0651\u0628 \u0628\u0639\u062F \u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u0644\u064A\u0644 \u0628\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0643\u0648\u064A\u062A.',
  'unlock-unavailable': '\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0639\u0646\u062F\u0646\u0627\u060C \u0641\u0623\u0648\u0642\u0641\u0646\u0627 \u0627\u0644\u0641\u062A\u062D \u0645\u0624\u0642\u062A\u064B\u0627. \u062C\u0631\u0651\u0628 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.',
};

let _redis = null;
function client() {
  if (_redis) return _redis;
  // Same explicit-credential shape as lib/ratelimit.js and lib/daycap.js: Vercel injects
  // KV_REST_API_*, while @upstash/redis auto-env expects UPSTASH_REDIS_REST_*.
  _redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  return _redis;
}

// Test seam, mirroring lib/daycap.js.
export function __setRedisForTest(r) { _redis = r; }

// Counts this attempt and reports whether the caller is locked out. FAIL-CLOSED: if the store
// cannot be read the answer is "unavailable", which the handler turns into a refusal. An
// attempt limiter that fails open is not a limiter -- it is an invitation to brute force.
async function noteAttempt(deviceId) {
  const day = kuwaitDayStamp();
  const deviceKey = `ul:v1:d:${deviceId}:${day}`;
  const globalKey = `ul:v1:all:${day}`;
  try {
    const r = client();
    const current = await r.mget(deviceKey, globalKey);
    const num = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
      return Number.isFinite(n) ? n : NaN;
    };
    const used = num(current[0]);
    const usedAll = num(current[1]);
    // A counter we cannot read is not a zero. Refuse rather than hand out free attempts.
    if (!Number.isFinite(used) || !Number.isFinite(usedAll)) return { unavailable: true };
    if (used >= PER_DEVICE_ATTEMPTS || usedAll >= GLOBAL_ATTEMPTS) return { locked: true };
    const p = r.pipeline();
    p.incr(deviceKey); p.expire(deviceKey, DAY_CAP_TTL_SECONDS);
    p.incr(globalKey); p.expire(globalKey, DAY_CAP_TTL_SECONDS);
    await p.exec();
    return {};
  } catch (e) {
    // No device id and no PIN in this line -- only the transport failure.
    console.warn('[unlock] attempt store unreachable, fail-CLOSED:', e && e.message ? e.message : e);
    return { unavailable: true };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { body = null; }

  // The SAME rule the cap counts by (imported, never re-implemented): an id we would not count
  // is an id we will not rate-limit, so it must not get an unlimited attempt path.
  const deviceId = safeId(body && body.deviceId);
  if (!deviceId) {
    return res.status(401).json({ error: 'unlock-refused', message: UNLOCK_MESSAGES['unlock-refused'] });
  }

  // Attempt accounting runs BEFORE the comparison, so a wrong PIN is always counted and a
  // locked-out device never reaches the compare at all -- a correct PIN after lockout stays
  // refused for the rest of the Kuwait day.
  const gate = await noteAttempt(deviceId);
  if (gate.unavailable) {
    return res.status(429).json({ error: 'unlock-unavailable', message: UNLOCK_MESSAGES['unlock-unavailable'] });
  }
  if (gate.locked) {
    return res.status(429).json({ error: 'unlock-locked', message: UNLOCK_MESSAGES['unlock-locked'] });
  }

  // CONSTANT WORK from here down. Both the right and the wrong PIN hash two values, run one
  // timingSafeEqual over two 32-byte digests, and compute the HMAC. Nothing branches on the
  // comparison until the single return below, so response timing cannot reveal the answer.
  // Hashing first also means timingSafeEqual never throws on a length mismatch, and the PIN
  // LENGTH cannot leak either -- only its bytes are secret, but its length need not be given away.
  const expected = String(process.env.UNLOCK_PIN || '');
  const supplied = typeof (body && body.pin) === 'string' ? body.pin : '';
  const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();
  const equal = crypto.timingSafeEqual(digest(supplied), digest(expected));
  // An unset or empty UNLOCK_PIN fails here regardless of what was sent, the empty string
  // included: an absent secret means NOBODY unlocks, never everybody.
  const pinOk = expected.length > 0 && equal;
  // Computed unconditionally so the success path does no extra work. null when FOUNDER_SECRET
  // is unset -- and then we refuse exactly as for a wrong PIN, rather than issue nothing with a
  // success status.
  const token = founderTokenFor(deviceId);

  if (!pinOk || !token) {
    return res.status(401).json({ error: 'unlock-refused', message: UNLOCK_MESSAGES['unlock-refused'] });
  }
  // The token, and nothing else. The PIN is never echoed back.
  return res.status(200).json({ token });
}
