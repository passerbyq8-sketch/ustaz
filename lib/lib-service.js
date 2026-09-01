// Server-side adapter for the library service (the Shamela atom index). It is the
// SECOND module in this tree to reach a corpus that has no row in
// lib/source-registry.js and no domain of its own. lib/fatwa-service.js is the
// first, and this file copies its shape deliberately: a fixed base no caller can
// supply, an INJECTABLE fetch so a fixture can drive it with no socket, and the
// origin refused twice -- before the request and again after the redirect.
//
// THREE PROPERTIES THIS FILE HOLDS BY ITSELF, so no caller can lose them:
//
//   1. NO NETWORK WITHOUT THE FLAG. searchLibrary refuses before it builds a
//      request unless the flag value it is HANDED equals LIB_FLAG_ON and a token
//      came with it. A wiring mistake upstream therefore cannot switch the call
//      on. That is what lets guards takhrij and rfcworld keep asserting
//      publicSearch=0, publicFetch=0, adapters=0 on the stored path with the flag
//      off -- their contracts are not touched, and they do not need to be.
//
//   2. NO ENVIRONMENT READ HERE. The caller passes flagValue and token; there is
//      no process.env in this file. A guard can import it and set either one, both
//      ways, without an environment at all.
//
//   3. IT NEVER THROWS. Every failure returns { ok: false, reason } with zero
//      records. This module sits in the answer path of someone asking about their
//      religion: a search that could not run must degrade to silence, never to a
//      broken answer.
//
// WHAT IT DOES NOT DO, BY THE OWNER'S FIRST RULING. It builds NO source card and
// prints nothing -- buildSourceCard is imported nowhere here. The library is a
// silent source behind the answer. What a later question ("where did you get that
// from?") would need is carried on each record under `provenance`, for the brain
// to hold and not for a screen to show. It also sends no max_chars_per_hit: the
// whole-text door is a separate item and is not opened by this file.

import {
  LIB_AUTH_HEADER,
  LIB_AUTH_PREFIX,
  LIB_BASE,
  LIB_LIMIT_DEFAULT,
  LIB_LIMIT_MAX,
  LIB_MAX_JSON_BYTES,
  LIB_MAX_Q_CHARS,
  LIB_RECORD_KIND,
  LIB_SOURCE_KIND,
  LIB_TIMEOUT_MS,
  libFlagIsOn,
  libSearchUrl,
} from './lib-contract.js';

// The two measured field lists, imported and never repeated. They are the same
// lists api/lib-search.js whitelists against, so the reader's endpoint and this
// adapter cannot come to disagree about what the service sends.
import { HIT_FIELDS, RESPONSE_FIELDS } from './lib-source-card.js';

// WHICH FIELDS MAY TRAVEL AS PROVENANCE, AND IT IS NOT A NEW DECISION. It is the
// one buildSourceCard already makes: a page nobody can look up is not printed, so
// it is not carried either. Citable -> volume and pages. Not citable -> the
// heading path instead. The identifiers ride along in both cases.
const PROVENANCE_ALWAYS = ['book_title', 'author', 'hadith_no'];
// `numbering` rides with the citable half because the owner's page rule has TWO conditions and
// this file only ever carried one: the page is shown when the service called it citable AND the
// numbering is a printed one. Without the field on the record, the second condition could not be
// asked downstream at all, and an automatically numbered atom would have printed a page nobody
// can look up. Measured values on the contract: 'print' and 'none'.
const PROVENANCE_CITABLE = ['volume', 'page_start', 'page_end', 'numbering'];
const PROVENANCE_UNCITABLE = ['heading_path', 'heading_kind'];
const PROVENANCE_IDS = ['atom_id', 'subject_id'];

function signalFor(parent, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(250, Number(timeoutMs) || LIB_TIMEOUT_MS));
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

// Present stays present, absent stays absent, unknown is dropped in silence. The
// twin of pickFields at api/lib-search.js:103-112, and it must stay its twin.
function pick(source, allowed) {
  const out = {};
  if (source == null || typeof source !== 'object') return out;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

function carry(target, hit, key) {
  if (hit != null && Object.prototype.hasOwnProperty.call(hit, key) && hit[key] != null) {
    target[key] = hit[key];
  }
}

function clampLimit(value) {
  if (value === undefined || value === null || value === '') return LIB_LIMIT_DEFAULT;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return LIB_LIMIT_DEFAULT;
  const whole = Math.trunc(numeric);
  if (whole < 1) return LIB_LIMIT_DEFAULT;
  return Math.min(whole, LIB_LIMIT_MAX);
}

function provenanceOf(hit) {
  const out = {};
  for (const key of PROVENANCE_ALWAYS) carry(out, hit, key);
  if (hit.page_citable === true) {
    out.page_citable = true;
    for (const key of PROVENANCE_CITABLE) carry(out, hit, key);
  } else {
    out.page_citable = false;
    for (const key of PROVENANCE_UNCITABLE) carry(out, hit, key);
  }
  for (const key of PROVENANCE_IDS) carry(out, hit, key);
  return out;
}

/**
 * One whitelisted hit -> one record, or null when it carries no passage. The
 * passage is `text` and it is never rewritten here: not trimmed of its own words,
 * not merged, not summarised. `truncated` rides along only when the service says
 * exactly true, so a cut quotation can never read as a whole one.
 */
export function normalizeLibRecord(rawHit) {
  const hit = pick(rawHit, HIT_FIELDS);
  const text = typeof hit.text === 'string' ? hit.text.trim() : '';
  if (!text) return null;
  if (hit.atom_id == null) return null;

  const record = {
    id: 'lib:' + String(hit.atom_id),
    kind: LIB_RECORD_KIND,
    sourceKind: LIB_SOURCE_KIND,
    silent: true,
    text,
    truncated: hit.truncated === true,
    provenance: provenanceOf(hit),
  };
  if (typeof hit.score === 'number' && Number.isFinite(hit.score)) record.score = hit.score;
  if (typeof hit.matn_chars === 'number') record.matnChars = hit.matn_chars;
  return record;
}

/**
 * The one entry point, and the only place a request is made.
 *
 *   flagValue  the raw environment value, handed in. Anything but LIB_FLAG_ON is off.
 *   token      the service token, handed in. Absent or empty is off.
 *   fetchImpl  injectable; defaults to the global fetch. A fixture passes its own.
 *   limit      clamped to the measured ceiling.
 *
 * Returns { ok, reason, records, refused, ... } and never throws. The service's own
 * top-level fields ride back untouched, so a caller can tell a refusal from a
 * shortfall from a genuinely empty answer without re-reading the raw body.
 */
export async function searchLibrary(query, options = {}) {
  const empty = { ok: false, reason: '', records: [], refused: false, hitsSeen: 0, dropped: 0 };

  if (!libFlagIsOn(options.flagValue)) return { ...empty, reason: 'lib_flag_off' };
  const token = options.token;
  if (typeof token !== 'string' || token.length === 0) return { ...empty, reason: 'lib_token_missing' };

  const q = String(query == null ? '' : query).trim().slice(0, LIB_MAX_Q_CHARS);
  if (!q) return { ...empty, reason: 'lib_query_empty' };

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return { ...empty, reason: 'lib_no_fetch' };

  const url = libSearchUrl();
  if (url.origin !== LIB_BASE) return { ...empty, reason: 'lib_origin_refused' };

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      signal: signalFor(options.signal, options.timeoutMs),
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [LIB_AUTH_HEADER]: LIB_AUTH_PREFIX + token,
      },
      body: JSON.stringify({ q, limit: clampLimit(options.limit) }),
    });
  } catch {
    return { ...empty, reason: 'lib_unreachable' };
  }

  let payload;
  try {
    if (!response || !response.ok) return { ...empty, reason: 'lib_http_' + (response && response.status) };
    const final = new URL(response.url || url.href);
    if (final.origin !== LIB_BASE) return { ...empty, reason: 'lib_redirect_refused' };
    const type = String(response.headers?.get?.('content-type') || '').toLowerCase();
    if (!type.includes('application/json')) return { ...empty, reason: 'lib_content_type' };
    const declared = Number(response.headers?.get?.('content-length') || 0);
    if (declared > LIB_MAX_JSON_BYTES) return { ...empty, reason: 'lib_body_too_large' };
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > LIB_MAX_JSON_BYTES) return { ...empty, reason: 'lib_body_too_large' };
    payload = JSON.parse(text);
  } catch {
    return { ...empty, reason: 'lib_invalid_json' };
  }
  if (payload == null || typeof payload !== 'object') return { ...empty, reason: 'lib_bad_contract' };

  const body = pick(payload, RESPONSE_FIELDS);
  delete body.hits;
  const rawHits = Array.isArray(payload.hits) ? payload.hits : [];
  const seen = new Set();
  const records = [];
  for (const rawHit of rawHits) {
    const record = normalizeLibRecord(rawHit);
    if (!record) continue;
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    records.push(record);
  }

  return {
    ...body,
    ok: true,
    reason: '',
    refused: payload.refused === true,
    records,
    hitsSeen: rawHits.length,
    dropped: rawHits.length - records.length,
  };
}

export const __libTest = Object.freeze({ carry, clampLimit, pick, provenanceOf, signalFor });
