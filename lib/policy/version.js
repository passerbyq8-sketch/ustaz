// lib/policy/version.js
// THE VERSION SPINE OF THE SHARED POLICY CORE.
//
// WHY VERSIONS ARE A MODULE AND NOT A COMMENT. Two request paths — the shipped legacy route in
// api/ask.js and the ledger state machine in lib/ledger/ — now decide age access, topic class
// and attribution grade from ONE table. The failure mode of a shared table is not that it is
// wrong; it is that one consumer quietly keeps an old copy. So every consumer reads its version
// from here, guards/policy-core-guard.cjs asserts they agree, and a cache key that was computed
// under an older table is a MISS rather than a stale hit.
//
// WHAT EACH VERSION GOVERNS, AND WHEN TO BUMP IT:
//
//   POLICY_VERSION        the topic x audience matrix, the child rubric, the benign topic list,
//                         the health split, the entity-role rules, the era policy. Bump when a
//                         DECISION changes — when something that was allowed is now limited, or
//                         a topic moves between classes.
//
//   SYNONYM_TABLE_VERSION the reviewed fiqh synonym table in ./synonyms.js. Bump when a term is
//                         added, removed or re-scoped. A query expanded under an old table is a
//                         different query, so this is part of every search cache key.
//
//   NORMALIZATION_VERSION the Arabic folding applied before matching and before keying. Bump
//                         when the folding changes — «ة»->«ه» and friends decide what counts as
//                         the same question, so an entry keyed under the old folding must not be
//                         served under the new one.
//
//   REGISTRY_VERSION      the set of domains and their capabilities. Bump when a source is
//                         added, removed, or has a capability changed. Deliberately NOT derived
//                         from a hash of the registry file: a comment edit must not invalidate
//                         every cached search, and a capability change must invalidate them even
//                         if the file's byte count happens to match.
//
// NONE OF THESE IS A FEATURE FLAG. Bumping a version never turns anything on; it only means
// "what was decided before was decided under different rules". Enabling a source, a capability
// or the ledger itself is a separate, explicit act elsewhere.

export const POLICY_VERSION = 'ezik-policy-v0.5-r2-2026-08-04';

export const SYNONYM_TABLE_VERSION = 'syn-v1-2026-08-04';

export const NORMALIZATION_VERSION = 'norm-v1-2026-08-04';

// Matches the source set frozen at RFC v0.5-R2. No domain was added, removed or re-scoped by
// this RFC — the version exists so a future change to that set invalidates the caches that were
// filled under it.
export const REGISTRY_VERSION = 'registry-v1-2026-08-03';

/**
 * The material every cache key must carry, in a fixed order.
 *
 * ORDER IS PART OF THE CONTRACT: the string is hashed, so reordering the fields would silently
 * invalidate every entry without anybody having decided to. Callers append their own subject
 * (a normalised query, a canonical URL) and never interleave it with these.
 */
export function versionMaterial(extra = {}) {
  return [
    'p=' + POLICY_VERSION,
    'r=' + REGISTRY_VERSION,
    'y=' + SYNONYM_TABLE_VERSION,
    'n=' + NORMALIZATION_VERSION,
    'a=' + String(extra.adapterVersion || ''),
  ].join('|');
}

/** Every version this core declares, for telemetry and for the drift guard. */
export function versions() {
  return Object.freeze({
    policyVersion: POLICY_VERSION,
    registryVersion: REGISTRY_VERSION,
    synonymTableVersion: SYNONYM_TABLE_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
  });
}
