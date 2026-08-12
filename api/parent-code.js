// api/parent-code.js
// THE PARENT PANEL CODE, JUDGED ON THE SERVER. Directive 12.
//
// ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
// The code that stands in front of the parents-only panel used to be verified entirely in the
// browser: index.html held SHA-256(code) in localStorage and compared a freshly hashed input
// against it. Three separate problems, and only the first is the obvious one.
//   1. The verifier and the secret were both in the reader's hands. Anyone who opens devtools
//      reads the stored digest, and a four-digit code has ten thousand possibilities -- a
//      digest of one is a lookup table, not a hash. Seconds of work, no network, no trace.
//   2. There was nothing to rate limit. A client-side compare has no attempt counter that the
//      client cannot also reset, so "how many tries do they get" had no answer at all.
//   3. Whoever changed the localStorage value changed the code. Not "knew the code" -- just
//      reached the storage.
//
// ── WHAT CHANGED, AND WHAT DID NOT ───────────────────────────────────────────
// ONLY the place of judgment. The code still belongs to ONE DEVICE, exactly as it did when it
// lived in that device's localStorage: the server record is keyed by the same device id the day
// cap counts by, so a code set on the family tablet does not open the panel on a phone. That is
// not a new rule, it is the old rule with a verifier the browser cannot reach.
//
// The mechanism is the one api/unlock.js already uses for the founder PIN and NOT a second
// invention: scrypt over a per-record random salt, compared with timingSafeEqual. A short
// numeric code needs the salt and the work factor far more than a long one does.
//
// ── THE MIGRATION, AND ITS HONEST LIMIT ──────────────────────────────────────
// A parent who already has a code holds SHA-256(code) in localStorage and nothing else. So the
// first server verification on such a device carries that digest alongside the typed code, and
// this endpoint enrols the device only if the two genuinely correspond. It is silent: the
// parent types the code they have always typed and never learns anything happened.
//
// The limit, stated plainly: a caller who controls the browser can send any pair (code, digest
// of that code) and enrol a device id of their choosing. That grants NOTHING NEW, and this is
// the reason the migration is safe rather than a hole -- a device id with no record is in
// create mode anyway, where anyone reaching the screen may set the code. That was true before
// this file existed and it is the model the product ships. The migration path is exactly as
// strong as the create path, never weaker, and both are strictly stronger afterwards, because
// from the enrolment onward the only thing that opens the panel is knowledge of the code.
//
// ── FAIL-CLOSED, EVERYWHERE ──────────────────────────────────────────────────
// A store we cannot READ is not an empty store, and an empty store is create mode. So an
// unreadable record answers "unavailable" and the browser keeps showing the verify form; a
// reachable attacker must never be able to break the store into offering them a fresh code.
//
// Every Arabic character below is a \uXXXX escape and this file holds ZERO raw Arabic code
// points -- the same rule lib/daycap.js and api/unlock.js are under: a raw right-to-left string
// renders reversed in many editors and is silently corrupted by anyone retyping what they see.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { safeId } from '../lib/daycap.js';
import { ATTEMPT_MESSAGES, ipDigest, checkAttempts, noteFailedAttempt } from '../lib/attempts.js';
import { applyCorsOrigin } from '../lib/ratelimit.js';

// D13's two dimensions, and DELIBERATELY NO GLOBAL ONE. The founder PIN has an app-wide ceiling
// because it is a single shared secret; this code is per-device, so an app-wide ceiling would
// hand one attacker a way to lock every parent in the app out of their own panel by grinding
// their own device. Device and address are the dimensions that describe the attacker here.
const ATTEMPT_NS = 'pc:v1';
const PER_DEVICE_ATTEMPTS = 5;
const PER_IP_ATTEMPTS = 10;

// Same shape rule the browser has always enforced: at least four digits. Re-checked here
// because a rule only the client applies is a rule the client can skip.
const CODE_SHAPE = /^[0-9]{4,64}$/;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
// Used when there is NO record, so the verify path does the same scrypt work whether this device
// has a code or not. Its digest can never match: nothing hashes to 32 zero bytes.
const DUMMY_SALT = '0'.repeat(32);
const scryptHash = (code, saltHex) =>
  crypto.scryptSync(String(code), Buffer.from(saltHex, 'hex'), 32, SCRYPT);

const recordKey = (deviceId) => `${ATTEMPT_NS}:rec:${deviceId}`;

// Defined once. A wrong code, a device with no record and an unusable device id all return the
// SAME refusal, so probing cannot learn which part it got wrong. The wording is the wording the
// browser has always shown for these situations -- D12 moved the judgment, not the words.
export const PARENT_MESSAGES = {
  'parent-refused': '\u0631\u0645\u0632 \u062E\u0627\u0637\u0626',
  'parent-weak': '\u0627\u062E\u062A\u0631 \u0664 \u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644',
  'parent-save-failed': '\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062D\u0641\u0638',
  // Imported, not restated: this lockout is the LIMITER's, and api/unlock.js shows the same two
  // lines for the same two situations. One mechanism must not describe itself in two ways.
  'parent-locked': ATTEMPT_MESSAGES.locked,
  'parent-unavailable': ATTEMPT_MESSAGES.unavailable,
};

let _redis = null;
function client() {
  if (_redis) return _redis;
  // Same explicit-credential shape as lib/ratelimit.js and lib/daycap.js: Vercel injects
  // KV_REST_API_*, while @upstash/redis auto-env expects UPSTASH_REDIS_REST_*.
  _redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  return _redis;
}

// Test seam, mirroring lib/daycap.js and api/unlock.js.
export function __setRedisForTest(r) { _redis = r; }

// -> { ok:true, rec } | { ok:true, rec:null } | { ok:false }
// A malformed record is treated as ABSENT rather than as a reason to crash, but an UNREADABLE
// store is ok:false, which every caller turns into a refusal.
async function loadRecord(deviceId) {
  try {
    const raw = await client().get(recordKey(deviceId));
    if (raw === null || raw === undefined || raw === '') return { ok: true, rec: null };
    const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;   // Upstash may return it parsed
    const usable = rec && typeof rec.salt === 'string' && typeof rec.hash === 'string'
      && /^[0-9a-f]{32}$/.test(rec.salt) && /^[0-9a-f]{64}$/.test(rec.hash);
    return { ok: true, rec: usable ? rec : null };
  } catch (e) {
    // No device id and no code in this line -- only the transport failure.
    console.warn('[parent-code] record store unreadable, fail-CLOSED:', e && e.message ? e.message : e);
    return { ok: false, rec: null };
  }
}

// true only when the write is CONFIRMED. Telling a parent their code was saved when it was not
// would lock them out of their own panel on the next visit.
async function storeRecord(deviceId, saltHex, hashHex) {
  try {
    await client().set(recordKey(deviceId), JSON.stringify({ v: 1, alg: 'scrypt', salt: saltHex, hash: hashHex }));
    return true;
  } catch (e) {
    console.warn('[parent-code] record write failed, fail-CLOSED:', e && e.message ? e.message : e);
    return false;
  }
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-murabbi-device');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { body = null; }

  const refuse = () => res.status(401).json({ error: 'parent-refused', message: PARENT_MESSAGES['parent-refused'] });
  const unavailable = () => res.status(429).json({ error: 'parent-unavailable', message: PARENT_MESSAGES['parent-unavailable'] });

  // The SAME rule the cap counts by (imported, never re-implemented): an id we would not count
  // is an id we cannot rate-limit, so it must not get an unlimited attempt path.
  const deviceId = safeId(body && body.deviceId);
  if (!deviceId) return refuse();

  const action = body && typeof body.action === 'string' ? body.action : 'verify';

  // STATUS COSTS NOTHING. The browser probes this every time the gate screen opens, so charging
  // it an attempt would mean opening the panel screen five times locks a parent out of their own
  // panel without a single code ever being typed. It answers only "does this device have a
  // code?", which reveals nothing about what the code is.
  if (action === 'status') {
    const store = await loadRecord(deviceId);
    if (!store.ok) return unavailable();
    return res.status(200).json({ hasCode: !!store.rec });
  }

  if (action !== 'verify' && action !== 'set') return refuse();

  // Check before comparing, but consume only after a failed credential decision. The atomic
  // consume below remains authoritative if concurrent requests both pass this read-only check.
  const attempt = {
    ns: ATTEMPT_NS,
    deviceId,
    ipHash: ipDigest(req),
    perDevice: PER_DEVICE_ATTEMPTS,
    perIp: PER_IP_ATTEMPTS,
    perGlobal: null,
  };
  const gate = await checkAttempts(client(), attempt);
  if (gate.unavailable) return unavailable();
  if (gate.locked) {
    return res.status(429).json({ error: 'parent-locked', message: PARENT_MESSAGES['parent-locked'] });
  }
  const failedAttempt = async (status, error, message) => {
    const spent = await noteFailedAttempt(client(), attempt);
    if (spent.unavailable) return unavailable();
    if (spent.locked) {
      return res.status(429).json({ error: 'parent-locked', message: PARENT_MESSAGES['parent-locked'] });
    }
    return res.status(status).json({ error, message });
  };

  const store = await loadRecord(deviceId);
  if (!store.ok) return unavailable();
  const rec = store.rec;
  const supplied = typeof (body && body.pin) === 'string' ? body.pin : '';

  // ============================================================
  // SET -- only onto a device that has NO code. This endpoint never overwrites one: changing a
  // code you cannot produce is indistinguishable from taking a panel that is not yours. A device
  // that already has a record gets the ordinary refusal, which tells a prober nothing.
  // ============================================================
  if (action === 'set') {
    const shapeOk = CODE_SHAPE.test(supplied);
    // CONSTANT WORK: the salt is drawn and the scrypt is run whatever the answers are, so a
    // caller aiming at an occupied device costs the same as a real first-time save.
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = scryptHash(shapeOk ? supplied : '0000', salt).toString('hex');
    if (rec) return failedAttempt(401, 'parent-refused', PARENT_MESSAGES['parent-refused']);
    if (!shapeOk) return failedAttempt(400, 'parent-weak', PARENT_MESSAGES['parent-weak']);
    if (!(await storeRecord(deviceId, salt, hash))) {
      return res.status(429).json({ error: 'parent-save-failed', message: PARENT_MESSAGES['parent-save-failed'] });
    }
    // No code, no hash, no salt in the body. Only that it happened.
    return res.status(200).json({ ok: true });
  }

  // ============================================================
  // VERIFY -- CONSTANT WORK from here down. Both halves (the stored-record comparison and the
  // one-time legacy migration) are computed on EVERY call, so a device with a record and a
  // device without one do the same scrypt and the same digests. Nothing branches on a comparison
  // until the single decision below, so response timing cannot reveal which case this was.
  // ============================================================
  const suppliedScrypt = scryptHash(supplied, (rec && rec.salt) || DUMMY_SALT);
  const recHash = Buffer.from((rec && rec.hash) || '0'.repeat(64), 'hex');
  const storedOk = !!rec && crypto.timingSafeEqual(suppliedScrypt, recHash);

  // The migration half. The digest the browser has been holding since before this endpoint
  // existed, checked in constant time against the digest of what was just typed -- so the device
  // is enrolled only by someone who can produce a code matching the digest that device already
  // held. Only ever consulted when there is NO record: once enrolled, the legacy value is
  // meaningless and this branch can never fire again for that device.
  const legacy = typeof (body && body.legacyHash) === 'string' ? body.legacyHash.trim().toLowerCase() : '';
  const legacyShaped = /^[0-9a-f]{64}$/.test(legacy);
  const suppliedSha = crypto.createHash('sha256').update(supplied, 'utf8').digest();
  const legacyBuf = Buffer.from(legacyShaped ? legacy : '0'.repeat(64), 'hex');
  const legacyOk = !rec && legacyShaped && supplied.length > 0
    && crypto.timingSafeEqual(suppliedSha, legacyBuf);

  if (storedOk) return res.status(200).json({ ok: true });

  if (legacyOk) {
    // Enrol, and only then admit. If the write cannot be confirmed we refuse rather than let
    // them in: the browser clears its legacy digest on a success, so admitting on an unconfirmed
    // write would throw away the only credential this device still has.
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = scryptHash(supplied, salt).toString('hex');
    if (!(await storeRecord(deviceId, salt, hash))) return unavailable();
    return res.status(200).json({ ok: true, migrated: true });
  }

  return failedAttempt(401, 'parent-refused', PARENT_MESSAGES['parent-refused']);
}
