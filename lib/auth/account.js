// lib/auth/account.js
// THE ACCOUNT RECORD, THE VERIFIED-EMAIL INDEX, AND THE SESSION.
//
// FIVE FIELDS AND TWO TIMESTAMPS. `v`, `provider`, `sub`, `email`, `emailVerified`, plus
// `createdAt` and `lastSeenAt`. THERE IS NO EIGHTH FIELD, and the writer below does not copy an
// incoming object -- it names each key it writes, so a provider that starts including a display
// name, a picture, a locale or a hosted domain in its id_token cannot get any of it stored by
// arriving with it. What is not carried cannot be leaked, cannot be asked about under a data
// request, and cannot quietly become a dependency.
//
// THE MERGE DOES NOT DESTROY. A first sign-in CREATES. Every sign-in after it moves `lastSeenAt`
// and nothing else. A record is therefore never damaged by a later sign-in that happened to
// carry less than the first one did -- a provider that omits `email` on a repeat consent, or an
// Apple sign-in after the reader hid their address, cannot blank a field that is already there.
// AND THERE IS NO DELETE ON THE SIGN-IN PATH AT ALL. Nothing in upsertAccount, in the index
// writer or in the session minter removes an account, an index entry or anything else. The ONE
// delete this module holds is deleteAccount() at the foot of the file, which no sign-in reaches:
// it exists for the reader who asks to be forgotten, and it is called from api/auth-delete.js
// and from nowhere else.
//
// THE SESSION IS AN OPAQUE KEY, NOT A SIGNED TOKEN. 32 random bytes naming a record in the store
// that holds { accountKey, createdAt, expiresAt, generation }, four hundred days, renewed by sliding on each use.
// WHY NOT A SIGNED TOKEN: a signed token needs a new secret to hold and rotate, and revoking one
// before its expiry needs a deny-list -- which is a store lookup, which is the thing the
// signature was supposed to avoid. An opaque key needs no secret at all and revocation is
// deleting the key. `pc:` and `ul:` already work this way. FOUNDER_SECRET is NOT reused for any
// of it: that secret today buys past the daily cap, the deep layers and the call together, so
// hanging an ordinary reader's session on it would make every reader who signs in a founder.

import crypto from 'node:crypto';

import {
  accountKey,
  emailIndexKey,
  sessionKey,
  readJson,
  deleteKey,
  authSnapshot,
  authCompareWrite,
  generationKey,
  LEGACY_GENERATION,
  SESSION_TTL_SECONDS,
} from './store.js';

export const ACCOUNT_RECORD_VERSION = 1;

/** The seven keys a record may have, in order. Anything else is not written and not kept. */
export const ACCOUNT_FIELDS = Object.freeze([
  'v', 'provider', 'sub', 'email', 'emailVerified', 'createdAt', 'lastSeenAt',
]);

/**
 * The subject lands inside a Redis key, so it is validated, not trusted -- the same rule
 * lib/daycap.js safeId() applies to the device id, for the same reason: a value carrying ':'
 * could otherwise reach across into another key. Google's subjects are digits and Apple's are
 * digits with dots; this accepts those and refuses separators and whitespace.
 */
export function safeSubject(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^[A-Za-z0-9._@|-]{1,128}$/.test(s) ? s : null;
}

/** sha256 of the LOWERCASED address. The address itself is never a key. */
export function emailDigest(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase(), 'utf8').digest('hex');
}

/** Keeps exactly the seven fields, in order, and drops anything a stored record grew elsewhere. */
function onlyKnownFields(record) {
  const out = {};
  for (const field of ACCOUNT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) out[field] = record[field];
  }
  return out;
}

/**
 * Create on first sign-in, touch `lastSeenAt` on every one after.
 *
 * Returns { ok: true, key, record, created } or { ok: false, code }.
 * A store that cannot be written is a refusal, not a silent success: the caller must not mint a
 * session for an account it did not manage to record.
 */
export async function upsertAccount(input) {
  const provider = typeof input.provider === 'string' ? input.provider : '';
  const sub = safeSubject(input.sub);
  if (!provider || !sub) return { ok: false, code: 'auth-account-subject' };
  const key = accountKey(provider, sub);
  const generation = await authSnapshot(generationKey(key));
  if (!generation.ok) return { ok: false, code: 'auth-account-unwritable' };
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await authSnapshot(key);
    if (!existing.ok) break;
    const now = Date.now();
    const created = !existing.value;
    const record = created ? {
      v: ACCOUNT_RECORD_VERSION, provider, sub,
      email: typeof input.email === 'string' ? input.email : '',
      emailVerified: input.emailVerified === true,
      createdAt: now, lastSeenAt: now,
    } : { ...onlyKnownFields(existing.value), lastSeenAt: now };
    const result = await authCompareWrite([generation, { ...existing, next: record }]);
    if (result === 'OK') return { ok: true, key, record, created, generation: generation.value?.id ?? LEGACY_GENERATION };
    if (result !== 'RETRY') break;
    // Retain the original generation: an in-flight sign-in may not recreate a
    // deleted account. A fresh verified sign-in can deliberately create it again.
  }
  return { ok: false, code: 'auth-account-unwritable' };
}

/**
 * THE ONLY SEAM BETWEEN TWO PROVIDERS, AND IT OPENS ONLY ON A PROVED ADDRESS.
 *
 * Written when -- and ONLY when -- `emailVerified` is true and the address is non-empty. An
 * unproved address joining two accounts is the classic takeover: anyone who can make a provider
 * assert an address they do not own inherits the account that address already unlocked. So an
 * unverified sign-in writes NOTHING here; it still gets its own account, it simply does not get
 * the seam.
 *
 * Atomic absent-key comparison, never overwrite: the FIRST proved account keeps the entry.
 *
 * APPLE'S RELAY ADDRESS IS AN ADDRESS LIKE ANY OTHER. `...@privaterelay.appleid.com` is stored
 * and indexed exactly as it arrived. It is not unwrapped, not guessed at, and not treated as a
 * lesser proof -- Apple verified it, and the reader chose it.
 *
 * THE VERIFIED CHECK IS INSIDE THIS FUNCTION, not at its call site. A rule that matters this
 * much does not get to depend on every future caller remembering it.
 *
 * Returns { written: boolean, key: string|null }.
 */
export async function indexVerifiedEmail(email, emailVerified, key, expectedGeneration) {
  if (emailVerified !== true) return { written: false, key: null };
  if (!(typeof email === 'string') || email.trim().length === 0) return { written: false, key: null };
  const idxKey = emailIndexKey(emailDigest(email));
  const account = await authSnapshot(key), generation = await authSnapshot(generationKey(key));
  const prior = await authSnapshot(idxKey);
  if (!account.ok || !account.value || account.value.emailVerified !== true
    || emailDigest(account.value.email) !== emailDigest(email) || !generation.ok || !prior.ok || prior.value
    || expectedGeneration !== undefined && expectedGeneration !== (generation.value?.id ?? LEGACY_GENERATION)) return { written: false, key: idxKey };
  const written = await authCompareWrite([account, generation,
    { ...prior, next: { v: 1, accountKey: key, createdAt: Date.now() } }]) === 'OK';
  return { written, key: idxKey };
}

/** The account this verified address was first seen on, or null. */
export async function accountForVerifiedEmail(email) {
  const record = await readJson(emailIndexKey(emailDigest(email)));
  return record && typeof record.accountKey === 'string' ? record.accountKey : null;
}

// ---------------------------------------------------------------------------
// THE SESSION.
// ---------------------------------------------------------------------------

export function newSessionId() { return crypto.randomBytes(32).toString('base64url'); }

/** Returns { ok: true, session, expiresAt } or { ok: false, code }. */
export async function mintSession(key, expectedGeneration) {
  const generation = await authSnapshot(generationKey(key));
  if (!generation.ok) return { ok: false, code: 'auth-session-unwritable' };
  const current = generation.value?.id ?? LEGACY_GENERATION;
  if (expectedGeneration !== undefined && expectedGeneration !== current) return { ok: false, code: 'auth-session-unwritable' };
  const id = newSessionId();
  for (let attempt = 0; attempt < 8; attempt++) {
    const account = await authSnapshot(key), prior = await authSnapshot(sessionKey(id));
    if (!account.ok || !account.value || !prior.ok || prior.value) break;
    const now = Date.now(), expiresAt = now + SESSION_TTL_SECONDS * 1000;
    const record = { accountKey: key, createdAt: now, expiresAt, generation: current };
    const result = await authCompareWrite([generation, account, { ...prior, next: record, ttl: SESSION_TTL_SECONDS }]);
    if (result === 'OK') return { ok: true, session: id, expiresAt };
    if (result !== 'RETRY') break;
  }
  return { ok: false, code: 'auth-session-unwritable' };
}

/**
 * Read a session and SLIDE its four hundred days forward. Returns the record or null.
 *
 * Sliding on use is what makes four hundred days mean "four hundred days of silence" rather than
 * "four hundred days from your first sign-in" -- a reader who opens the app every week is never signed out,
 * and a session that stops being used dies on its own without anything having to sweep it.
 */
export async function touchSession(id) {
  const result = await sessionState(id);
  if (result.state === 'unknown') throw new Error('auth-unavailable');
  return result.state === 'live' ? result.record : null;
}

/** Live/dead/unknown; sliding compares session, account and generation atomically. */
export async function sessionState(id) {
  if (typeof id !== 'string' || id.length === 0) return { state: 'dead' };
  for (let attempt = 0; attempt < 8; attempt++) {
    const session = await authSnapshot(sessionKey(id));
    if (!session.ok) return { state: 'unknown' };
    const record = session.value;
    if (!record || typeof record.accountKey !== 'string' || typeof record.expiresAt !== 'number' || record.expiresAt <= Date.now()) return { state: 'dead' };
    const account = await authSnapshot(record.accountKey);
    const generation = await authSnapshot(generationKey(record.accountKey));
    if (!account.ok || !generation.ok) return { state: 'unknown' };
    if (!account.value || (record.generation ?? LEGACY_GENERATION) !== (generation.value?.id ?? LEGACY_GENERATION)) {
      const removed = await authCompareWrite([account, generation, { ...session, remove: true }]);
      if (removed === 'OK') return { state: 'dead' };
      if (removed === 'RETRY') continue;
      return { state: 'unknown' };
    }
    const next = { accountKey: record.accountKey, createdAt: record.createdAt,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000, generation: record.generation ?? LEGACY_GENERATION };
    const result = await authCompareWrite([account, generation, { ...session, next, ttl: SESSION_TTL_SECONDS }]);
    if (result === 'OK') return { state: 'live', record: next };
    if (result !== 'RETRY') return { state: 'unknown' };
  }
  return { state: 'unknown' };
}

/** Revocation is deleting the key -- there is no token to deny-list and no secret to rotate. */
export async function revokeSession(id) {
  if (typeof id !== 'string' || id.length === 0) return false;
  return deleteKey(sessionKey(id));
}

// ---------------------------------------------------------------------------
// THE COMPOUND DELETE -- the one erasure this module performs, and the only caller is
// api/auth-delete.js. Apple requires that an application which creates an account can delete it
// from inside itself; this is the half of that requirement which lives in the store.
// ---------------------------------------------------------------------------

/** Atomically rotate the persistent generation and erase account, matching index, grant and caller session. */
export async function deleteAccount(key, sessionId) {
  if (typeof key !== 'string' || !key) return { ok: false, code: 'auth-delete-key' };
  if (typeof sessionId !== 'string' || !sessionId) return { ok: false, code: 'auth-delete-session-missing' };
  for (let attempt = 0; attempt < 8; attempt++) {
    const account = await authSnapshot(key), session = await authSnapshot(sessionKey(sessionId));
    const generation = await authSnapshot(generationKey(key));
    if (!account.ok || !session.ok || !generation.ok) return { ok: false, code: 'auth-delete-unavailable' };
    if (!account.value || !session.value || session.value.accountKey !== key || session.value.expiresAt <= Date.now()
      || (session.value.generation ?? LEGACY_GENERATION) !== (generation.value?.id ?? LEGACY_GENERATION)) return { ok: false, code: 'auth-session-invalid' };
    const grant = await authSnapshot('role:v1:' + key);
    const rows = [{ ...generation, next: { v: 1, id: crypto.randomBytes(24).toString('hex') } }];
    let index = false;
    const email = typeof account.value.email === 'string' ? account.value.email : '';
    if (email.trim()) {
      const entry = await authSnapshot(emailIndexKey(emailDigest(email)));
      if (!entry.ok) return { ok: false, code: 'auth-delete-index' };
      index = entry.value?.accountKey === key;
      rows.push({ ...entry, remove: index });
    }
    rows.push({ ...grant, remove: true }, { ...account, remove: true }, { ...session, remove: true });
    const result = await authCompareWrite(rows);
    if (result === 'OK') return { ok: true, removed: { index, account: true, session: true } };
    if (result !== 'RETRY') return { ok: false, code: 'auth-delete-unavailable' };
  }
  return { ok: false, code: 'auth-delete-unavailable' };
}
