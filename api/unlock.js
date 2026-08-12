// api/unlock.js
// PIN -> founder token. Phase 3 (directive 82).
//
// THE PIN NEVER LEAVES THE SERVER ENVIRONMENT. It is compared here against UNLOCK_PIN and is
// never logged, never echoed into an error body, and never placed in a URL or a query string.
// What the client receives back is only the token lib/daycap.js already verifies -- so the one
// secret that lifts the daily cap also unlocks the deep tiers, with exactly one verifier for
// both and no second implementation to drift.
//
// D13 -- THIS FILE IS THE ONE EXCEPTION TO THE NO-IP RULE, and it is deliberate. The attempt
// limit used to be keyed by deviceId alone, which an attacker defeats for free: a device id is
// a string the caller invents, so minting a fresh one per try buys five more attempts every
// time, and the only thing that ever really stood in the way was the global 50. That global is
// a blunt instrument -- once it trips, NOBODY unlocks for the rest of the Kuwait day, the owner
// included. A per-IP dimension is what makes the grinder pay for its own attempts instead of
// spending the whole app's allowance.
//
// lib/daycap.js still reads no IP and MUST NOT START. The two questions are not the same one:
// the day cap asks "how much has this child used?", where a household or school NAT would
// collapse many children onto one bucket and cut off children who did nothing. An unlock
// attempt asks "is someone grinding the secret?", where sharing an exit address is exactly the
// signal wanted. Same word, opposite consequence.
//
// What is stored is a SHA-256 PREFIX of the address, never the address itself: the counter only
// ever has to answer "the same caller as a moment ago?", which a digest answers, and a stolen
// store dump then holds no readable address. The raw value is never logged, never echoed and
// never interpolated into a key.
//
// Every Arabic character below is a \uXXXX escape and this file holds ZERO raw Arabic code
// points -- the same rule directive 80 fixed lib/daycap.js under, for the same reason: a raw
// right-to-left string renders reversed in many editors and gets silently corrupted by anyone
// retyping what they see.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { safeId, founderTokenFor, hasUnrevokedFounderToken } from '../lib/daycap.js';
import { ATTEMPT_MESSAGES, ipDigest, checkAttempts, noteFailedAttempt } from '../lib/attempts.js';
import { applyCorsOrigin } from '../lib/ratelimit.js';

// Attempts per device, per IP, and across everybody -- each per Kuwait day. The device limit is
// the courteous one (a real owner mistyping their own PIN). The IP limit is the one that costs
// an attacker something, because it is the only dimension they cannot mint more of for free.
// The global one stays LAST RESORT: it stops a distributed attempt but it also stops the owner,
// so the two narrower dimensions exist to keep it from ever being the thing that trips.
const PER_DEVICE_ATTEMPTS = 5;
const PER_IP_ATTEMPTS = 10;
const GLOBAL_ATTEMPTS = 50;

// Defined once. Never printed to a console, and never told apart by the caller: a wrong PIN, an
// unusable device id and an unset FOUNDER_SECRET all return the SAME refusal, so probing cannot
// learn which part it got wrong.
export const UNLOCK_MESSAGES = {
  'unlock-refused': '\u0627\u0644\u0631\u0645\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.',
  // D12: these two are the LIMITER's refusals, not this endpoint's, and api/parent-code.js shows
  // the same two words for the same two situations. They are imported from the module that owns
  // the mechanism rather than restated here, so the two doors cannot start describing one
  // lockout in two ways. The wording is byte-identical to what shipped before the move.
  'unlock-locked': ATTEMPT_MESSAGES.locked,
  'unlock-unavailable': ATTEMPT_MESSAGES.unavailable,
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

// D12. The limiter itself now lives in lib/attempts.js, because api/parent-code.js needs the
// same three-dimension accounting for a DIFFERENT secret. It is imported, never re-implemented:
// two copies of a limiter is one limiter waiting to drift, and that drift is invisible -- one
// door simply becomes softer than the other and nobody notices until it is ground open.
//
// The key prefix is UNCHANGED ('ul:v1'), so the counters this endpoint already wrote in
// production keep counting the same attempts against the same callers across the deploy.
const ATTEMPT_NS = 'ul:v1';
const attemptOptions = (deviceId, ipHash) => ({
  ns: ATTEMPT_NS,
  deviceId,
  ipHash,
  perDevice: PER_DEVICE_ATTEMPTS,
  perIp: PER_IP_ATTEMPTS,
  perGlobal: GLOBAL_ATTEMPTS,
});

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

  // The read-only check runs BEFORE the comparison; only the failure branch below atomically
  // consumes allowance. A correct PIN is therefore free, while a caller already at the ceiling
  // still never reaches the comparison.
  const attempt = attemptOptions(deviceId, ipDigest(req));
  const gate = await checkAttempts(client(), attempt);
  if (gate.unavailable) {
    return res.status(429).json({ error: 'unlock-unavailable', message: UNLOCK_MESSAGES['unlock-unavailable'] });
  }
  if (gate.locked) {
    return res.status(429).json({ error: 'unlock-locked', message: UNLOCK_MESSAGES['unlock-locked'] });
  }
  const failedAttempt = async (status, error, message) => {
    const spent = await noteFailedAttempt(client(), attempt);
    if (spent.unavailable) {
      return res.status(429).json({ error: 'unlock-unavailable', message: UNLOCK_MESSAGES['unlock-unavailable'] });
    }
    if (spent.locked) {
      return res.status(429).json({ error: 'unlock-locked', message: UNLOCK_MESSAGES['unlock-locked'] });
    }
    return res.status(status).json({ error, message });
  };

  // ============================================================
  // D89 -- SET A NEW PIN. Requires a VALID FOUNDER TOKEN and nothing else: never the old PIN
  // alone, never an env check, never an IP. Failed authorisation or shape checks spend the same
  // allowance; a successful change does not.
  // ============================================================
  if (body && body.action === 'set-pin') {
    // D06: the FULL check. Changing the PIN is the most privileged thing this app can do -- it
    // is the act that decides who unlocks tomorrow -- so a revoked token must not be able to do
    // it. Imported, never re-written: one verifier for the cap bypass, the tier lock and this.
    const authorised = await hasUnrevokedFounderToken(req);
    const next = typeof body.pin === 'string' ? body.pin : '';
    const shapeOk = PIN_SHAPE.test(next);
    // CONSTANT WORK: the salt is drawn and the scrypt is run whatever the answers are, so an
    // unauthorised caller and a bad-shape caller cost the same as a real change.
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = scryptHash(shapeOk ? next : '0'.repeat(MIN_PIN_DIGITS), salt).toString('hex');
    // Authorisation is judged BEFORE shape, so a caller without a token cannot even learn the
    // shape rule: it gets the SAME refusal a wrong PIN gets, byte for byte.
    if (!authorised) {
      return failedAttempt(401, 'unlock-refused', UNLOCK_MESSAGES['unlock-refused']);
    }
    if (!shapeOk) {
      return failedAttempt(400, 'pin-weak', UNLOCK_MESSAGES['pin-weak']);
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
    return failedAttempt(401, 'unlock-refused', UNLOCK_MESSAGES['unlock-refused']);
  }
  // The token, and nothing else. The PIN is never echoed back.
  return res.status(200).json({ token });
}
