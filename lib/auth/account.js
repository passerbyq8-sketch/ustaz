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
// that holds { accountKey, createdAt, expiresAt }, ninety days, renewed by sliding on each use.
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
  writeJson,
  writeIfAbsent,
  deleteKey,
  touchExpiry,
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
  const now = Date.now();
  const existing = await readJson(key);

  if (existing && typeof existing === 'object') {
    // ONLY `lastSeenAt` MOVES. Every other field keeps the value the first sign-in wrote.
    const record = onlyKnownFields(existing);
    record.lastSeenAt = now;
    const written = await writeJson(key, record);
    if (!written) return { ok: false, code: 'auth-account-unwritable' };
    return { ok: true, key, record, created: false };
  }

  const record = {
    v: ACCOUNT_RECORD_VERSION,
    provider,
    sub,
    email: typeof input.email === 'string' ? input.email : '',
    emailVerified: input.emailVerified === true,
    createdAt: now,
    lastSeenAt: now,
  };
  const written = await writeJson(key, record);
  if (!written) return { ok: false, code: 'auth-account-unwritable' };
  return { ok: true, key, record, created: true };
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
 * NX, never overwrite: the entry keeps pointing at the FIRST account that proved this address.
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
export async function indexVerifiedEmail(email, emailVerified, key) {
  if (emailVerified !== true) return { written: false, key: null };
  if (!(typeof email === 'string') || email.trim().length === 0) return { written: false, key: null };
  const idxKey = emailIndexKey(emailDigest(email));
  const written = await writeIfAbsent(idxKey, { v: 1, accountKey: key, createdAt: Date.now() });
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
export async function mintSession(key) {
  const id = newSessionId();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const written = await writeJson(sessionKey(id), { accountKey: key, createdAt: now, expiresAt },
    SESSION_TTL_SECONDS);
  if (!written) return { ok: false, code: 'auth-session-unwritable' };
  return { ok: true, session: id, expiresAt };
}

/**
 * Read a session and SLIDE its ninety days forward. Returns the record or null.
 *
 * Sliding on use is what makes ninety days mean "ninety days of silence" rather than "ninety
 * days from your first sign-in" -- a reader who opens the app every week is never signed out,
 * and a session that stops being used dies on its own without anything having to sweep it.
 */
export async function touchSession(id) {
  if (typeof id !== 'string' || id.length === 0) return null;
  const k = sessionKey(id);
  const record = await readJson(k);
  if (!record || typeof record.accountKey !== 'string') return null;
  const now = Date.now();
  if (typeof record.expiresAt === 'number' && record.expiresAt <= now) return null;
  record.expiresAt = now + SESSION_TTL_SECONDS * 1000;
  await writeJson(k, record, SESSION_TTL_SECONDS);
  await touchExpiry(k, SESSION_TTL_SECONDS);
  return record;
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

/**
 * THREE ERASURES, NOT ONE, AND THE ORDER BETWEEN THEM IS THE WHOLE DESIGN.
 *
 * WHY THE INDEX GOES FIRST. `acctidx:v1:email:<sha256>` is the only pointer to an account that
 * is not the account's own key, and it is the seam a second provider signs in through. An index
 * entry left standing after its record is gone is AN ARROW TO A DEAD ACCOUNT: the next sign-in
 * that proves the same address reads it, is handed a key nothing answers, and welds a live
 * reader onto a ghost. So it is removed BEFORE the record it points at -- because if this step
 * fails, the record is still there, the address can still be derived from it, and a retry can
 * still finish the job. Delete the record first and a failure here strands the arrow with
 * nothing left in the store that can tell you which address to look under.
 *
 * THE ADDRESS COMES FROM THE RECORD THAT WAS JUST READ, NEVER FROM A CALLER. A digest computed
 * from an address someone submitted would let them aim this delete at any index entry they can
 * guess an address for -- which is the one thing the index exists to make impossible.
 *
 * AND THE ENTRY IS ONLY REMOVED IF IT POINTS AT *THIS* ACCOUNT. The index is written NX and
 * keeps pointing at the FIRST account that proved an address, so a second account can carry the
 * same address while the entry names the first. Deleting by digest alone would then tear the
 * seam out from under an account that is still alive and still signing in through it. The
 * equality check below is what keeps a delete from becoming someone else's outage; an entry
 * naming another key is LEFT EXACTLY WHERE IT IS, and that is a success, not a skipped step.
 *
 * THE SESSION GOES LAST, and it goes: an account erased from the store with a ninety-day session
 * still standing is a contradiction that would ship as a feature. revokeSession() has been
 * loaded since the sign-in path landed and this is the call it was waiting for.
 *
 * EVERY STEP IS CHECKED. A store that says it did not delete is not a store that deleted; each
 * refusal returns a named code and the caller must not claim an erasure that did not happen.
 *
 * Returns { ok: true, removed: { index, account, session } } or { ok: false, code }.
 */
export async function deleteAccount(key, sessionId) {
  if (typeof key !== 'string' || key.length === 0) return { ok: false, code: 'auth-delete-key' };
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return { ok: false, code: 'auth-delete-session-missing' };
  }

  // A record we cannot read is a record we cannot finish deleting: its address is the only place
  // the index digest can come from. Absent and unreachable are one answer here for the same
  // reason they are one answer at api/auth-exchange.js -- and both mean "do not claim a delete".
  const record = await readJson(key);
  if (!record || typeof record !== 'object') return { ok: false, code: 'auth-account-unreadable' };

  // 1. THE INDEX.
  let index = false;
  const email = typeof record.email === 'string' ? record.email : '';
  if (email.trim().length > 0) {
    const idxKey = emailIndexKey(emailDigest(email));
    // The probe is on ANY non-empty address, not on `emailVerified` -- mirroring the write
    // condition here would mean an entry written under a rule that later changed could never be
    // found again. Probing wider is safe precisely because of the equality test below.
    const entry = await readJson(idxKey);
    // A null entry is "there is nothing to remove". It cannot be an unreachable store: the read
    // above it succeeded, so the store answered this request.
    if (entry && typeof entry === 'object' && entry.accountKey === key) {
      if (!(await deleteKey(idxKey))) return { ok: false, code: 'auth-delete-index' };
      index = true;
    }
  }

  // 2. THE RECORD.
  if (!(await deleteKey(key))) return { ok: false, code: 'auth-delete-account' };

  // 3. THE SESSION.
  if (!(await revokeSession(sessionId))) return { ok: false, code: 'auth-delete-session' };

  return { ok: true, removed: { index, account: true, session: true } };
}
