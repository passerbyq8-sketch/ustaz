// lib/auth/store.js
// THE FIVE KEY FAMILIES THE SIGN-IN PATH OWNS -- built, read, written and consumed in one place.
//
// THE SAME UPSTASH INSTANCE THE APP ALREADY USES, REACHED THE SAME WAY. The explicit-credential
// shape is copied verbatim from api/parent-code.js and lib/ledger/redis.js for the reason
// recorded there: Vercel injects KV_REST_API_*, while @upstash/redis's auto-env expects
// UPSTASH_REDIS_REST_*, so a client built without arguments silently points at nothing.
// ZERO NEW STORE VARIABLES: this module reads KV_REST_API_URL and KV_REST_API_TOKEN and nothing
// else. A namespace in this store is TEXT IN A KEY -- not a table, not a resource, not a bill.
// Ten key families already share this one instance (pc:, ul:, dc:, fnd:, lg:, ezik:search-budget:,
// ask:, chat:, aud:, report:, and the bare `reports` list); these five join them the same way.
//
// THE KEY SHAPES, AND WHY EACH IS SHAPED THAT WAY:
//
//   auth:state:v1:<state>              the in-flight authorization. Holds the nonce, the PKCE
//                                      verifier and the device the flow started on. TEN MINUTES.
//   auth:ticket:v1:<ticket>            the one-shot handoff between the provider's redirect and
//                                      the app. SIXTY SECONDS.
//   auth:jwks:v1:<provider>            the provider's signing keys, cached SIX HOURS.
//   acct:v1:<provider>:<sub>           the account record. THE PROVIDER IS PART OF THE KEY and
//                                      is never omitted: `sub` is unique only WITHIN one issuer,
//                                      so two providers that both hand out the numeric subject
//                                      "12345" would collide onto one record and two strangers
//                                      would share an account. Two doors, one key.
//   acctidx:v1:email:<sha256(email)>   the verified-email index -- the ONLY seam between two
//                                      providers. It stores the sha256 of the lowercased address
//                                      rather than the address, so the key space itself is not a
//                                      readable list of the readers we have.
//   sess:v1:<32 random bytes>          the session. AN OPAQUE KEY IN THE STORE, NOT A SIGNED
//                                      TOKEN: no new secret to hold, no JWT to verify, and
//                                      revocation is DELETING THE KEY rather than maintaining
//                                      the deny-list a signed token would need. The same
//                                      discipline the `pc:` and `ul:` records already follow.
//
// A STORE THAT CANNOT BE READ IS NOT AN EMPTY STORE. Every helper here returns null / false on
// failure and the CALLERS fail closed on that -- the opposite of lib/ledger/redis.js, where the
// same shape means "a cache is an optimisation". A sign-in that cannot read its own state record
// must refuse, not proceed.

import { Redis } from '@upstash/redis';

export const STATE_PREFIX = 'auth:state:v1:';
export const TICKET_PREFIX = 'auth:ticket:v1:';
export const JWKS_PREFIX = 'auth:jwks:v1:';
export const ACCOUNT_PREFIX = 'acct:v1:';
export const EMAIL_INDEX_PREFIX = 'acctidx:v1:email:';
export const SESSION_PREFIX = 'sess:v1:';

// Ten minutes for a flow a reader walks through by hand; sixty seconds for a handoff that happens
// between two machines; six hours for keys a provider rotates on the order of days; ninety days
// for the session, renewed by sliding on every use.
export const STATE_TTL_SECONDS = 10 * 60;
export const TICKET_TTL_SECONDS = 60;
export const JWKS_TTL_SECONDS = 6 * 60 * 60;
export const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;

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

/** Test seam, the shape lib/ledger/redis.js already uses. Pass null for an unreachable store. */
export function __setAuthStoreForTest(r) { _redis = r; _forced = true; }
export function __resetAuthStore() { _redis = null; _forced = false; }

export async function storeAvailable() { return client() !== null; }

// ---------------------------------------------------------------------------
// KEY BUILDERS. Every id that reaches a key is minted here from randomBytes, with one exception:
// `provider` and `sub` below arrive from the provider, so their caller shape-checks them before
// they are ever interpolated -- the discipline lib/daycap.js safeId() already applies to the
// device id for the same reason (a value carrying ':' could otherwise forge another key).
// ---------------------------------------------------------------------------
export const stateKey = (state) => STATE_PREFIX + state;
export const ticketKey = (ticket) => TICKET_PREFIX + ticket;
export const jwksKey = (provider) => JWKS_PREFIX + provider;
export const sessionKey = (id) => SESSION_PREFIX + id;

/**
 * acct:v1:<provider>:<sub> -- NEVER `sub` on its own. See the head of this file: two issuers can
 * mint the same subject string, and the two readers behind them are not the same person.
 */
export const accountKey = (provider, sub) => ACCOUNT_PREFIX + provider + ':' + sub;

export const emailIndexKey = (digest) => EMAIL_INDEX_PREFIX + digest;

// ---------------------------------------------------------------------------
// READ / WRITE.
// ---------------------------------------------------------------------------

/** Null when absent OR when the store cannot be reached. The caller fails closed on both. */
export async function readJson(k) {
  const c = client();
  if (!c) return null;
  try {
    const raw = await c.get(k);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw;
    return JSON.parse(String(raw));
  } catch (e) { return null; }
}

/**
 * Writes JSON, with an expiry when one is given.
 *
 * FOUR OF THE SIX FAMILIES ALWAYS PASS ONE -- the state, the ticket, the cached keys and the
 * session all have a stated lifetime. The account record and its email index deliberately pass
 * NOTHING, and that is a decision this module refuses to make silently: how long a signed-in
 * reader's row should outlive their last visit is an owner's question about a record that holds
 * an email address, and it is written up as an open one rather than answered here by a number
 * nobody chose. Today they behave like `pc:v1:rec:`, the record already in this store that is
 * written once and never expires.
 */
export async function writeJson(k, value, ttlSeconds) {
  const c = client();
  if (!c) return false;
  try {
    if (ttlSeconds) await c.set(k, JSON.stringify(value), { ex: Math.max(1, Math.floor(ttlSeconds)) });
    else await c.set(k, JSON.stringify(value));
    return true;
  } catch (e) { return false; }
}

/**
 * WRITE ONLY IF THE KEY IS NOT THERE -- the verified-email index, and only it.
 *
 * WHY IT MUST NOT OVERWRITE. The index points at the FIRST account that proved this address. A
 * plain SET would let a later sign-in re-point an existing address at a different account --
 * which is precisely the account takeover this index exists to prevent, performed by the index
 * itself. NX is one round trip with no window in it, so two simultaneous first sign-ins cannot
 * both believe they were first.
 */
export async function writeIfAbsent(k, value, ttlSeconds) {
  const c = client();
  if (!c) return false;
  try {
    const opts = { nx: true };
    if (ttlSeconds) opts.ex = Math.max(1, Math.floor(ttlSeconds));
    const reply = await c.set(k, JSON.stringify(value), opts);
    return reply !== null && reply !== undefined && reply !== false;
  } catch (e) { return false; }
}

/** Revocation is deleting the key. There is no deny-list to keep, because there is no token. */
export async function deleteKey(k) {
  const c = client();
  if (!c) return false;
  try { await c.del(k); return true; } catch (e) { return false; }
}

/** Extends an existing key's expiry -- the sliding half of the ninety-day session. */
export async function touchExpiry(k, ttlSeconds) {
  const c = client();
  if (!c) return false;
  try { await c.expire(k, Math.max(1, Math.floor(ttlSeconds))); return true; } catch (e) { return false; }
}

/**
 * READ AND DELETE IN ONE SCRIPT -- the only way to consume something EXACTLY ONCE.
 *
 * WHY NOT GET-THEN-DEL. Those are two round trips with a window between them. Two deliveries of
 * the same provider redirect -- a double tap, a retried request, a replay by anyone who saw the
 * URL -- can both read the state record before either deletes it, and both then proceed. The
 * state, the PKCE verifier and the ticket exist precisely to be spendable ONCE, and a consume
 * with a window in it is not a consume. Upstash exposes EVAL over its REST API
 * (@upstash/redis 1.38) -- the same client this file already builds, and the same pattern
 * lib/ledger/redis.js:94 uses for the search-budget reservation. No new dependency.
 *
 * Returns null when the key was absent, already consumed, expired, or the store is unreachable.
 * All four are the same answer to the caller: you may not proceed.
 */
export const TAKE_ONCE_SCRIPT = [
  "local v = redis.call('GET', KEYS[1])",
  "if v then redis.call('DEL', KEYS[1]) end",
  'return v',
].join('\n');

export async function takeOnce(k) {
  const c = client();
  if (!c) return null;
  try {
    const raw = await c.eval(TAKE_ONCE_SCRIPT, [k], []);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw;
    return JSON.parse(String(raw));
  } catch (e) { return null; }
}
