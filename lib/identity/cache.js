// lib/identity/cache.js — WHO SOMEBODY IS DOES NOT CHANGE BETWEEN TWO QUESTIONS.
//
// Same shape as lib/ledger/cache.js, and for the same reasons: the key is an HMAC so no readable
// fragment of what a reader typed is ever stored, a missing secret DISABLES the cache rather than
// falling back to a plaintext key, and the store is the one the rest of the app already uses.
//
// ── WHY THE TTL IS DAYS AND NOT HOURS ────────────────────────────────────────
// The search cache holds a day because what a search returns genuinely moves. An identity does
// not: عبدالله الرويشد will still be a singer next month. قرار ٣ asks for «بعمرِ أيام», and the
// value of a long TTL here is not the saved fetch — it is that the SECOND reader to ask about a
// name gets the same answer as the first, instead of a different one because a page moved.
//
// ── AND A MISS IS CACHED TOO ─────────────────────────────────────────────────
// A name nothing could place is the most expensive outcome in the cascade: it is the only one
// that runs all three stages. Not remembering it means every reader who asks about the same
// unknown name pays for all three again. It is stored under a SHORTER life, because «nobody by
// that name is known» ages faster than «here is who he is» — an unknown person today may have an
// article next month, and the app should be able to find it.

import { createHmac } from 'node:crypto';
import * as store from '../ledger/redis.js';
import { identityKey } from './whitelist.js';
import { IDENTITY, IDENTITY_TTL_SECONDS, isHumanIdentityCandidate } from './index.js';

// A placed identity: 30 days (lib/identity/index.js owns the number).
export const FOUND_TTL_SECONDS = IDENTITY_TTL_SECONDS;
// An unplaced one: 3 days. Long enough to spare the repeated cascade, short enough that a new
// article is picked up in a week rather than a month.
export const MISS_TTL_SECONDS = 3 * 24 * 60 * 60;

// The version block. Bump anything that changes what a stored verdict MEANS — the classifier's
// word lists, the whitelist's shape — and yesterday's entry becomes a different key, so it is not
// found rather than found and quietly wrong. Same rule as the ledger cache's version material.
export const IDENTITY_CACHE_SCHEMA = 2;
export const IDENTITY_CACHE_VERSION = 'identity-v2-2026-08-12';

function humanIdentityKey(nameRaw) {
  return isHumanIdentityCandidate(nameRaw) ? identityKey(nameRaw) : '';
}

function validIdentity(value) {
  if (!value || typeof value !== 'object' || !Object.values(IDENTITY).includes(value.kind)) return false;
  if (!humanIdentityKey(value.display)) return false;
  return !Array.isArray(value.candidates)
    || value.candidates.every((candidate) => candidate && humanIdentityKey(candidate.display));
}

function secret() {
  return process.env.LEDGER_CACHE_SECRET || process.env.FOUNDER_SECRET || '';
}

export function identityCacheEnabled() { return !!secret(); }

/** Key for one name. Contains no readable fragment of it. */
export function cacheKeyFor(nameRaw) {
  const s = secret();
  const identity = humanIdentityKey(nameRaw);
  if (!s || !identity) return '';
  const material = identity + ' ' + IDENTITY_CACHE_VERSION;
  return store.key('id', createHmac('sha256', s).update(material, 'utf8').digest('hex').slice(0, 40));
}

/**
 * The {get, put} pair lib/identity/index.js expects.
 *
 * Returns a cache that is a NO-OP when there is no secret, rather than a cache that throws or one
 * that invents a key — so an environment without a store degrades to "look it up every time",
 * which is slower and never wrong.
 */
export function identityCache(backend = store) {
  return {
    async get(nameRaw) {
      const identity = humanIdentityKey(nameRaw);
      const k = cacheKeyFor(nameRaw);
      if (!k) return null;
      let envelope = null;
      try { envelope = await backend.get(k); } catch { return null; }
      // Both the schema and the normalised lookup key are stored in the envelope. Consequently a
      // legacy value, an entry returned for a different name, or a sacred/title-only capture is a
      // miss rather than a human identity verdict.
      if (!envelope || envelope.schema !== IDENTITY_CACHE_SCHEMA
        || envelope.identityKey !== identity || !validIdentity(envelope.value)) return null;
      return envelope.value;
    },
    async put(nameRaw, value) {
      const identity = humanIdentityKey(nameRaw);
      const k = cacheKeyFor(nameRaw);
      if (!k || !validIdentity(value)) return false;
      const ttl = value.kind === IDENTITY.UNKNOWN ? MISS_TTL_SECONDS : FOUND_TTL_SECONDS;
      try {
        const stored = await backend.setex(k, ttl, {
          schema: IDENTITY_CACHE_SCHEMA,
          identityKey: identity,
          value,
        });
        return stored !== false && stored != null;
      } catch { return false; }
    },
  };
}
