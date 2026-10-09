// lib/sync/flag.js
// THE SWITCH IN FRONT OF ITEMS 24 + 58 -- account sync, the server-side wipe, "download my data",
// "link your other account", the account-level day cap, the new privacy page and the address line
// of item 58. One environment row decides it, and it FAILS CLOSED:
//
//   SYNC_SWITCH = off    closed for everybody
//   SYNC_SWITCH = owner  open for the owner's accounts only: the accounts EZIK_OWNER_ACCOUNTS
//                        already names (lib/articles/roles.js isRootOwner, the gate of the owner's
//                        inbox, re-used and not re-typed) plus the test accounts SYNC_TEST_ACCOUNTS
//                        names, in the same shape: comma-separated sha256 hex digests of the
//                        lower-cased, trimmed, PROVED address.
//   SYNC_SWITCH = all    open for everybody, guests included (the preview of the sync branch)
//
// An absent row, an empty row, a value that is none of the three, a test row that does not parse,
// a store that cannot be read: every one of them is CLOSED. Nothing in a request can open it.
//
// The value is read at CALL TIME, never cached, so removing the row and redeploying closes the
// switch on the very next request -- the rollback is turning it off.

import { emailDigest } from '../auth/account.js';
import { readJson as readAuthJson } from '../auth/store.js';
import { isRootOwner } from '../articles/roles.js';

export const SYNC_SWITCH_ENV = 'SYNC_SWITCH';
export const SYNC_TEST_ACCOUNTS_ENV = 'SYNC_TEST_ACCOUNTS';
export const SYNC_MODES = Object.freeze(['off', 'owner', 'all']);

/** 'off' | 'owner' | 'all'. Anything that is not exactly one of the three is 'off'. */
export function syncSwitch(env) {
  try {
    const source = (env && typeof env === 'object') ? env : process.env;
    const raw = typeof source[SYNC_SWITCH_ENV] === 'string' ? source[SYNC_SWITCH_ENV].trim() : '';
    return raw === 'owner' || raw === 'all' ? raw : 'off';
  } catch (e) { return 'off'; }
}

/** The test digests. Malformed tokens are dropped; an absent row is ZERO test accounts. */
export function testDigests(env) {
  const source = (env && typeof env === 'object') ? env : process.env;
  const raw = typeof source[SYNC_TEST_ACCOUNTS_ENV] === 'string' ? source[SYNC_TEST_ACCOUNTS_ENV] : '';
  const out = new Set();
  for (const part of raw.split(',')) {
    const t = part.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(t)) out.add(t);
  }
  return out;
}

/** True only for an account whose PROVED address hashes into SYNC_TEST_ACCOUNTS. */
export async function isTestAccount(accountKey, env) {
  const digests = testDigests(env);
  if (digests.size === 0) return false;
  if (typeof accountKey !== 'string' || !accountKey.startsWith('acct:v1:')) return false;
  const record = await readAuthJson(accountKey);
  if (!record || typeof record !== 'object' || record.emailVerified !== true) return false;
  const email = typeof record.email === 'string' ? record.email : '';
  if (!email.trim()) return false;
  return digests.has(emailDigest(email));
}

/**
 * Is the switch open for THIS account? `accountKey` may be null (a guest): only `all` opens for a
 * guest. Every throw is closed.
 */
export async function syncOpenFor(accountKey, env) {
  try {
    const mode = syncSwitch(env);
    if (mode === 'all') return true;
    if (mode !== 'owner') return false;
    if (typeof accountKey !== 'string' || !accountKey) return false;
    if (await isRootOwner(accountKey)) return true;
    return await isTestAccount(accountKey, env);
  } catch (e) { return false; }
}
