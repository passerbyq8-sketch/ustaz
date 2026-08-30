// The library service (the Shamela atom index) is a read-only corpus behind one
// fixed server-side origin. This file carries only its contract: origin, paths,
// limits and the readiness figure. It performs NO network I/O and reads NO
// environment, so routing, the adapter and a guard can all import it without a
// socket -- the same shape lib/fatwa-contract.js has, and for the same reason.
//
// PROVENANCE OF EVERY VALUE BELOW. Read this before changing one.
//
//   MEASURED in api/lib-search.js at 66cc9f1:
//     :57     SEARCH_URL      'https://lib.ezik.app/search'
//     :71     AUTH_HEADER_NAME 'authorization'
//     :72     AUTH_VALUE_PREFIX 'Bearer '
//     :74-78  LIMIT_MAX 10, LIMIT_DEFAULT 10, MAX_Q_CHARS 400,
//             TIMEOUT_MS 12000, MAX_BYTES 4 MiB
//     :209    process.env.SEARCH_API_TOKEN
//
//   MEASURED against the live service on 2026-08-30:
//     GET  /ready   -> atom_count 6796649, index_data_errors 0
//     GET  /health  -> 200
//     POST /search  -> 401 without a token
//
//   MEASURED in C:\EZIK-LIB\service\src\contract.mjs:5-6,10,106-114:
//     max_chars_per_hit  default 1200, ceiling 2000
//
//   OURS, measured nowhere because we are naming it now. Declared here so the
//   adapter, the wiring and the guards read ONE copy and cannot drift apart:
//     LIB_RECORD_KIND, LIB_SOURCE_KIND, LIB_FLAG_ENV, LIB_FLAG_ON
//
// WHAT THIS FILE IS NOT. It is not a row in lib/source-registry.js and it never
// becomes one: that registry holds 31 web DOMAINS, normalizeDomain refuses
// anything that is not a dotted host, and the file states in its own words that a
// built corpus enters as sourceKind='corpus' instead. lib/fatwa-service.js is the
// standing precedent -- zero rows, a fixed base in lib/fatwa-contract.js, and
// sourceKind 'corpus' at lib/fatwa-service.js:322.

export const LIB_BASE = 'https://lib.ezik.app';
export const LIB_SEARCH_PATH = '/search';
export const LIB_READY_PATH = '/ready';
export const LIB_HEALTH_PATH = '/health';

export const LIB_AUTH_HEADER = 'authorization';
export const LIB_AUTH_PREFIX = 'Bearer ';
export const LIB_TOKEN_ENV = 'SEARCH_API_TOKEN';

export const LIB_EXPECTED_ATOMS = 6796649;

export const LIB_MAX_Q_CHARS = 400;
export const LIB_LIMIT_MAX = 10;
export const LIB_LIMIT_DEFAULT = 10;
export const LIB_TIMEOUT_MS = 12000;
export const LIB_MAX_JSON_BYTES = 4 * 1024 * 1024;
export const LIB_MAX_CHARS_PER_HIT_DEFAULT = 1200;
export const LIB_MAX_CHARS_PER_HIT_CEILING = 2000;

// OURS. The kind a normalised record carries, mirroring 'fatwa_service'.
export const LIB_RECORD_KIND = 'lib_service';

// OURS. What retrieval files it under. Mirrors lib/fatwa-service.js:322.
export const LIB_SOURCE_KIND = 'corpus';

// OURS, and it is the whole safety of this round: the call happens only when this
// variable is EXACTLY this string. 'on' is not a taste -- it is the literal
// api/ask.js already compares against for DEPTH_FREE_TRIAL, and there is exactly
// one `=== 'on'` in that file today. Declared here; read nowhere in this file.
export const LIB_FLAG_ENV = 'SHAMELA_BRAIN';
export const LIB_FLAG_ON = 'on';

/**
 * The one URL the adapter may call. No caller supplies a path, so no caller can
 * walk this origin somewhere else. Same refusal shape as fatwa-service.js:41-42.
 */
export function libSearchUrl() {
  return new URL(LIB_SEARCH_PATH, LIB_BASE);
}

/**
 * True only for the exact flag string. Every other value -- absent, '1', 'true',
 * 'ON', '' -- is off. The caller passes the value; this file reads no env itself,
 * which is what lets a guard import it and a fixture set it either way.
 */
export function libFlagIsOn(value) {
  return value === LIB_FLAG_ON;
}
