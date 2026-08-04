// lib/ledger/cache.js
// TWO CACHES, AND NEITHER OF THEM MAY EVER CHANGE AN ANSWER.
//
//   SEARCH CACHE      — what the provider returned for a query. Saves a request.
//   EXTRACTION CACHE  — what an adapter made of a page. Saves a fetch AND a parse.
//
// ── THE KEY IS AN HMAC, AND THE REASON IS NOT SECRECY ────────────────────────
// A cache key is a durable, enumerable string sitting in a shared store. A raw query as a key
// is the reader's question, verbatim, retained for as long as the TTL — and readable by anyone
// who can list keys. So the key is HMAC(server_secret, normalised_query + policy_version): it
// still collides only for identical queries, and it reveals nothing about any of them. The raw
// query is never written to the key, never to the value, and never to a log line.
//
// ── WHAT INVALIDATES AN EXTRACTION ───────────────────────────────────────────
// The key carries canonical_url + adapter_version + source_registry_version +
// extraction_schema_version. Bump any of those and yesterday's extraction is a different key,
// so it is not found rather than found-and-wrong. This matters more than it sounds: the span
// offsets in a cached extraction are only meaningful under the adapter that produced them, and
// Gate 1 would fail a stale one — correctly, but at the cost of the whole request.
//
// ── NOT EVERY FATWA IS STABLE ────────────────────────────────────────────────
// A TTL is taken from the source's own policy and the page kind, not from the assumption that
// a religious ruling never changes. Pages are edited, answers are corrected, and a contemporary
// nāzilah is exactly the material most likely to move.
//
// ── FAILURE DIRECTION ────────────────────────────────────────────────────────
// A cache miss, a store outage, or a corrupt value all degrade to "fetch it again". None of
// them may widen a source's eligibility, skip a gate, or supply an answer. There is no path
// through this module that produces evidence.

import { createHmac } from 'crypto';
import { normalizeArabic } from '../route-classify.js';
import { SOURCE_POLICY_VERSION, policyFor } from './source-policy.js';
import { EXTRACTION_SCHEMA_VERSION } from './segment.js';
// EVERY VERSION THAT COULD CHANGE WHAT A QUERY MEANS IS PART OF ITS KEY (RFC v0.5-R2 §8).
// policy_version alone was not enough: the synonym table decides what a query EXPANDS to and the
// normalisation decides what counts as the same question, so an entry filled under either of
// their older values answers a question that is no longer the one being asked.
import { versionMaterial } from '../policy/version.js';
import * as store from './redis.js';

export const SEARCH_TTL_SECONDS = 24 * 60 * 60;

// ── THE NEGATIVE CACHE, AND WHY ITS TTL IS SHORT ─────────────────────────────
// An empty result set is expensive to discover and cheap to remember, and NOT remembering it is
// how a question nobody can answer costs a provider call every single time it is asked. But an
// absence is the least durable fact this cache holds: a page gets published, an index catches up,
// a source is re-enabled — and unlike a fetched fatwa, nothing about "we found nothing" is
// intrinsically stable. One hour is the ceiling RFC v0.5-R2 §8 sets, and it is a ceiling rather
// than a target.
export const NEGATIVE_TTL_SECONDS = 60 * 60;

// Per page-kind ceilings. `answer` is the longest because a published fatwa page is the most
// stable thing here; `unknown` is the shortest because we do not know what we are holding.
export const PAGE_TTL_SECONDS = Object.freeze({
  answer: 7 * 24 * 60 * 60,
  article: 3 * 24 * 60 * 60,
  unknown: 6 * 60 * 60,
});

/**
 * The HMAC secret. Falls back to FOUNDER_SECRET, and then refuses.
 *
 * A MISSING SECRET DISABLES THE CACHE. It does not fall back to a plaintext key, and it does
 * not invent a constant: either the key is unreadable or there is no key.
 */
function secret() {
  return process.env.LEDGER_CACHE_SECRET || process.env.FOUNDER_SECRET || '';
}

export function cacheEnabled() { return !!secret(); }

/**
 * Normalise a query for keying: fold Arabic orthography, collapse whitespace, lower-case Latin.
 * Two readers asking the same thing differently spelled should share a cache entry; nothing
 * here is reversible and nothing here is stored.
 */
export function normalizeForKey(q) {
  return normalizeArabic(String(q == null ? '' : q)).replace(/\s+/g, ' ').trim().toLowerCase();
}

function hmac(material) {
  const s = secret();
  if (!s) return '';
  return createHmac('sha256', s).update(material, 'utf8').digest('hex').slice(0, 40);
}

/**
 * Key for a search. Contains no readable fragment of the query.
 *
 * THE VERSION BLOCK IS NOT DECORATION. Bump the policy, the registry, the synonym table or the
 * normalisation and yesterday's entry is a different key — so it is not found, rather than found
 * and quietly wrong. The alternative is worse than a stale answer: a query expanded under an old
 * synonym table is a query about a slightly different question, and serving its results is
 * answering something nobody asked.
 */
export function searchKey(query, { sites = [], policyVersion = SOURCE_POLICY_VERSION } = {}) {
  const material = normalizeForKey(query)
    + ' ' + sites.slice().sort().join(',')
    + ' ' + policyVersion
    + ' ' + versionMaterial();
  const h = hmac(material);
  return h ? store.key('s', h) : '';
}

/** Key for an extraction. Every version that could change the OFFSETS is in it. */
export function extractionKey(canonicalUrl, { adapterVersion, policyVersion = SOURCE_POLICY_VERSION } = {}) {
  const material = String(canonicalUrl) + ' ' + String(adapterVersion)
    + ' ' + policyVersion + ' ' + EXTRACTION_SCHEMA_VERSION;
  const h = hmac(material);
  return h ? store.key('p', h) : '';
}

export function ttlForPage(url, kind) {
  const row = policyFor(url);
  const base = PAGE_TTL_SECONDS[kind] ?? PAGE_TTL_SECONDS.unknown;
  // A source whose material is time-sensitive gets the short TTL whatever the page kind says.
  if (row && row.datePolicy && row.datePolicy.dateSource === 'published') return Math.min(base, PAGE_TTL_SECONDS.article);
  return base;
}

// ── the two operations ───────────────────────────────────────────────────────

/**
 * @returns {{hit:boolean, value:Array|null, negative:boolean}}
 *
 * `negative: true` is a HIT whose value is an empty array — we looked, recently, and there was
 * nothing. The caller must treat it as a hit (so no provider call is made) and as evidence of
 * nothing (so the slot proof records origin `cache` and zero results).
 */
export async function getSearch(query, opts) {
  const k = searchKey(query, opts);
  if (!k) return { hit: false, value: null, negative: false };
  const v = await store.get(k);
  if (!v || typeof v !== 'object' || !Array.isArray(v.results)) {
    return { hit: false, value: null, negative: false };
  }
  return { hit: true, value: v.results, negative: v.results.length === 0 };
}

/**
 * THE EMPTY RESULT IS STORED TOO, and that is the change.
 *
 * The engine used to write only non-empty result sets, so the most expensive outcome — a query
 * that costs a provider call and returns nothing — was the one outcome never remembered, and the
 * next reader asking the same unanswerable question paid for it again. It is stored under a
 * strictly shorter TTL, because "nothing exists" ages far faster than "here is the page".
 */
export async function putSearch(query, results, opts) {
  const k = searchKey(query, opts);
  if (!k) return false;
  const list = Array.isArray(results) ? results : [];
  const ttl = list.length ? SEARCH_TTL_SECONDS : NEGATIVE_TTL_SECONDS;
  return store.setex(k, ttl, { results: list, v: SOURCE_POLICY_VERSION });
}

export async function getExtraction(canonicalUrl, opts) {
  // AN UNKNOWN VERSION IS A MISS, NOT A WILDCARD. A caller that cannot name the adapter it
  // would extract with must not be handed an extraction produced by one it cannot name either:
  // the span byte-offsets in a cached entry are only meaningful under the adapter that computed
  // them. Refusing here also stops a caller passing `undefined` and then claiming invalidation
  // works because nothing ever hit.
  if (!opts || typeof opts.adapterVersion !== 'string' || !opts.adapterVersion) {
    return { hit: false, value: null, reason: 'no-adapter-version' };
  }
  const k = extractionKey(canonicalUrl, opts);
  if (!k) return { hit: false, value: null };
  const v = await store.get(k);
  if (!v || typeof v !== 'object' || typeof v.authorialText !== 'string') return { hit: false, value: null };
  // Version fields are re-checked on read, not merely encoded in the key. Belt and braces:
  // a key collision or a hand-written value cannot deliver an extraction from another schema.
  if (v.extractionSchemaVersion !== EXTRACTION_SCHEMA_VERSION) return { hit: false, value: null };
  if (opts && v.adapterVersion !== opts.adapterVersion) return { hit: false, value: null };
  return { hit: true, value: v };
}

export async function putExtraction(canonicalUrl, payload, opts) {
  const k = extractionKey(canonicalUrl, opts);
  if (!k) return false;
  const ttl = ttlForPage(canonicalUrl, payload.kind);
  return store.setex(k, ttl, {
    authorialText: payload.authorialText,
    title: payload.title || '',
    author: payload.author || '',
    attributionType: payload.attributionType || '',
    kind: payload.kind || 'unknown',
    dates: payload.dates || {},
    adapterVersion: (opts && opts.adapterVersion) || '',
    extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
    sourcePolicyVersion: SOURCE_POLICY_VERSION,
  });
}

/** Proof helper for the gate: a key must contain no readable fragment of its input. */
export function keyLeaks(keyString, input) {
  const k = String(keyString || '');
  const norm = normalizeForKey(input);
  if (!norm) return false;
  for (const tok of norm.split(' ')) {
    if (tok.length >= 3 && k.includes(tok)) return true;
  }
  return k.includes(String(input));
}
