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
import { safeId, founderTokenFor, hasValidFounderToken, kuwaitDayStamp, DAY_CAP_TTL_SECONDS } from '../lib/daycap.js';
import { applyCorsOrigin } from '../lib/ratelimit.js';

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
  // D89. The ONE refusal on this endpoint that is deliberately distinguishable, because it is
  // about the caller's OWN new code and gives away nothing about the secret. The count is
  // spelled as a word, never as a numeral: no digit is shown to any user anywhere.
  'pin-weak': '\u0627\u0644\u0631\u0645\u0632 \u0642\u0635\u064A\u0631. \u0627\u062C\u0639\u0644\u0647 \u0633\u062A\u0629 \u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.',
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

// ============================================================
// D89 -- the owner-set PIN.
// ============================================================
// What lands in Redis is a SALTED SCRYPT DIGEST and a random salt. The PIN itself is never
// written to the store, never logged, never returned in a body and never placed in a URL.
// A six-digit code has only a million possibilities, so a bare SHA-256 of it is a lookup, not
// a hash: scrypt with a per-PIN random salt is what makes a stolen store dump worthless.
const PIN_KEY = 'ul:v1:pin';
const MIN_PIN_DIGITS = 6;
const PIN_SHAPE = /^[0-9]{6,64}$/;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
// Used when there is NO stored record, so the verify path does the same scrypt work whether a
// PIN has ever been set or not. Its digest can never match: nothing hashes to 32 zero bytes.
const DUMMY_SALT = '0'.repeat(32);
const scryptHash = (pin, saltHex) => crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), 32, SCRYPT);

// -> { ok:true, rec } | { ok:true, rec:null } | { ok:false }
// A store we cannot READ is not an empty store. ok:false becomes a refusal, never a fallback
// to the bootstrap env PIN: a reachable attacker must not be able to force the older secret.
async function loadStoredPin() {
  try {
    const raw = await client().get(PIN_KEY);
    if (raw === null || raw === undefined || raw === '') return { ok: true, rec: null };
    const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;   // Upstash may return it parsed
    const usable = rec && typeof rec.salt === 'string' && typeof rec.hash === 'string'
      && /^[0-9a-f]{32}$/.test(rec.salt) && /^[0-9a-f]{64}$/.test(rec.hash);
    return { ok: true, rec: usable ? rec : null };
  } catch (e) {
    // No PIN and no device id in this line -- only the transport failure.
    console.warn('[unlock] pin store unreadable, fail-CLOSED:', e && e.message ? e.message : e);
    return { ok: false, rec: null };
  }
}

// true only when the write is confirmed. A write we cannot confirm is a refusal: telling the
// owner the code changed when it did not would lock them out of their own app.
async function storePinHash(saltHex, hashHex) {
  try {
    await client().set(PIN_KEY, JSON.stringify({ v: 1, alg: 'scrypt', salt: saltHex, hash: hashHex }));
    return true;
  } catch (e) {
    console.warn('[unlock] pin store write failed, fail-CLOSED:', e && e.message ? e.message : e);
    return false;
  }
}

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
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-murabbi-device, x-murabbi-founder');

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

  // ============================================================
  // D89 -- SET A NEW PIN. Requires a VALID FOUNDER TOKEN and nothing else: never the old PIN
  // alone, never an env check, never an IP. The attempt limiter above has ALREADY run and
  // counted this call, so this path cannot be used to grind the store either.
  // ============================================================
  if (body && body.action === 'set-pin') {
    const authorised = hasValidFounderToken(req);          // the ONE verifier, imported not re-written
    const next = typeof body.pin === 'string' ? body.pin : '';
    const shapeOk = PIN_SHAPE.test(next);
    // CONSTANT WORK: the salt is drawn and the scrypt is run whatever the answers are, so an
    // unauthorised caller and a bad-shape caller cost the same as a real change.
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = scryptHash(shapeOk ? next : '0'.repeat(MIN_PIN_DIGITS), salt).toString('hex');
    // Authorisation is judged BEFORE shape, so a caller without a token cannot even learn the
    // shape rule: it gets the SAME refusal a wrong PIN gets, byte for byte.
    if (!authorised) {
      return res.status(401).json({ error: 'unlock-refused', message: UNLOCK_MESSAGES['unlock-refused'] });
    }
    if (!shapeOk) {
      return res.status(400).json({ error: 'pin-weak', message: UNLOCK_MESSAGES['pin-weak'] });
    }
    const wrote = await storePinHash(salt, hash);
    if (!wrote) {
      return res.status(429).json({ error: 'unlock-unavailable', message: UNLOCK_MESSAGES['unlock-unavailable'] });
    }
    // No PIN, no hash, no salt in the body. Only that it happened.
    return res.status(200).json({ ok: true });
  }

  // CONSTANT WORK from here down. Both the stored-hash comparison and the bootstrap-env
  // comparison are computed on EVERY call -- the right PIN and the wrong one do the same scrypt,
  // the same two sha256 digests and the same two timingSafeEqual calls. Nothing branches on a
  // comparison until the single return below, so response timing cannot reveal the answer.
  // Hashing first also means timingSafeEqual never throws on a length mismatch, and the PIN
  // LENGTH cannot leak either -- only its bytes are secret, but its length need not be given away.
  //
  // ORDER (D89): a hash stored in Redis WINS if one exists; process.env.UNLOCK_PIN is only the
  // bootstrap for an owner who has not set one yet. Once set, the env value stops mattering --
  // which is the whole point: the owner never opens the dashboard again. A store we could not
  // READ refuses outright rather than falling back, or an attacker who can break the store
  // could force the app back onto the older secret.
  const store = await loadStoredPin();
  if (!store.ok) {
    return res.status(429).json({ error: 'unlock-unavailable', message: UNLOCK_MESSAGES['unlock-unavailable'] });
  }
  const rec = store.rec;
  const expected = String(process.env.UNLOCK_PIN || '');
  const supplied = typeof (body && body.pin) === 'string' ? body.pin : '';
  const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();
  const suppliedScrypt = scryptHash(supplied, (rec && rec.salt) || DUMMY_SALT);
  const recHash = Buffer.from((rec && rec.hash) || '0'.repeat(64), 'hex');
  const storedOk = !!rec && crypto.timingSafeEqual(suppliedScrypt, recHash);
  const equal = crypto.timingSafeEqual(digest(supplied), digest(expected));
  const envOk = expected.length > 0 && equal;
  // An unset or empty UNLOCK_PIN fails here regardless of what was sent, the empty string
  // included: an absent secret means NOBODY unlocks, never everybody. With no stored record AND
  // no env value, both halves are false and nobody unlocks -- unchanged from before this phase.
  const pinOk = rec ? storedOk : envOk;
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
