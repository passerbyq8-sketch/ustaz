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

// ---------------------------------------------------------------------------
// SH-6 -- DEFERRED ATTRIBUTION. The owner's rule (d) in two halves: a matn is
// never named on the app's own initiative, and it IS named the moment the
// reader asks where the words came from. His ruling of 2026-08-31 sets two
// grades for the naming, and only two:
//
//   a plain ask ("from which book?")     -> book title and author
//   an ask for the details on top of it  -> volume and page as well
//
// The detector lives in THIS file and not in lib/route-classify.js. That module
// is a guarded contract deciding DEEN vs GEN for the whole application, and the
// measurement of 2026-08-31 showed a single word inside it moving an unrelated
// question across the line. Nothing added here reads the environment or opens a
// socket, so a guard and a fixture may both import it exactly as before.

import { normalizeArabic } from './route-classify.js';

// Folded the same way the router folds, plus the three letter forms a reader
// varies freely and one collapse of punctuation to space. Idempotent: folding an
// already folded string changes nothing.
function foldAsk(raw) {
  return normalizeArabic(String(raw || ''))
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/ +/gu, ' ')
    .trim();
}

// Deliberately narrow, and narrow is the whole safety of it. Every phrase names
// a SOURCE outright; not one of them can open a fresh fiqh question, so a new
// question can never be mistaken for an attribution turn and pull a book title
// into an answer that was not asked for one.
const PROVENANCE_ASK = Object.freeze([
  'من اي كتاب',
  'من اي مصدر',
  'من اي مرجع',
  'اي كتاب اخذت',
  'اي كتاب نقلت',
  'من وين جبت',
  'منين جبت',
  'وين لقيت',
  'وين حصلت',
  'ما هو المصدر',
  'ماهو المصدر',
  'شنو المصدر',
  'ايش المصدر',
  'وش المصدر',
  'ما مصدرك',
  'مصدر كلامك',
  'مصدر الكلام',
  'مصدر هذا',
  'مصدر هذه',
  'من اين نقلت',
  'من اين اخذت',
  'من اين هذا',
]);

// A detail ask rides ON TOP of an attribution ask and never stands alone: it is
// read only after isProvenanceQuestion has already said yes.
const PROVENANCE_DETAIL = Object.freeze([
  'التفاصيل',
  'بالتفصيل',
  'تفاصيل',
  'الجزء',
  'الصفحه',
  'رقم الصفحه',
  'كامل',
  'كامله',
  'بالكامل',
]);

/**
 * True when the reader is asking where a paragraph came from. Fold first, then
 * a plain substring test -- no anchoring, because the ask arrives inside every
 * shape of sentence a person writes.
 */
export function isProvenanceQuestion(raw) {
  const text = foldAsk(raw);
  if (!text) return false;
  return PROVENANCE_ASK.some((phrase) => text.includes(phrase));
}

/**
 * True when that same ask wants the locator as well. Meaningless on its own.
 */
export function wantsProvenanceDetail(raw) {
  const text = foldAsk(raw);
  if (!text) return false;
  return PROVENANCE_DETAIL.some((phrase) => text.includes(phrase));
}

/**
 * The sentence that names the book, built ONLY from what lib-service.js:95-106
 * already carries on the record. A field that is absent is skipped and never
 * printed empty: an unknown page must not become a page number the reader would
 * go and check. An absent book title yields an empty string, and an empty string
 * means the caller says nothing at all -- silence, not a guess.
 */
export function provenanceLine(provenance, detailed = false) {
  const source = provenance || {};
  const book = String(source.book_title || '').trim();
  if (!book) return '';
  const author = String(source.author || '').trim();
  const head = author ? (book + ' — ' + author) : book;
  if (!detailed) return head;
  const parts = [];
  const volume = String(source.volume || '').trim();
  if (volume) parts.push('ج ' + volume);
  const start = String(source.page_start || '').trim();
  const end = String(source.page_end || '').trim();
  if (start && end && start !== end) parts.push('ص ' + start + '-' + end);
  else if (start) parts.push('ص ' + start);
  const hadith = String(source.hadith_no || '').trim();
  if (hadith) parts.push('رقم ' + hadith);
  return parts.length ? (head + ' (' + parts.join(' · ') + ')') : head;
}
