// lib/lessons-service.js -- the BRAIN-side caller of the lessons search service.
//
// WHY THIS FILE EXISTS, AND HOW IT STANDS BESIDE api/lessons-search.js.
// api/lessons-search.js is the BROWSER's edge: an HTTP endpoint the screen posts to, whose whole
// job is to keep SEARCH_API_TOKEN off the client. This module is the ANSWER PATH's edge:
// lib/free-brain/ runs inside the same server function as api/ask.js, so reaching the service
// through another function of the same deployment would be an HTTP hop to ourselves.
//
// ONE CONTRACT, STATED ONCE. Both edges import their field lists from lib/lessons-source-card.js.
// Nothing here is a second copy of a list that already exists there.
//
// ---- THREE RULES CARRIED FROM THE MEASURED CONTRACT, NOT SOFTENED HERE ----------------------
//   1. NO TEXT REACHES THE MODEL. The upstream sends `snippet` empty on 97.6% of hits and the
//      owner's ruling is that lesson text is not displayed at all. This module never reads it,
//      never returns it and has no field for it. What the model is handed is a TITLE and a
//      SCHOLAR NAME and a LINK -- so it can cite a lesson and cannot quote one. That is the
//      whole of `citation_allowed = 0` expressed as a shape rather than as a rule to remember.
//   2. `scholar_id` IS NOT AN IDENTIFIER. It is the scholar's Arabic display name; the upstream
//      names the field that way for reasons inside its own contract. It is carried through to be
//      SHOWN -- never joined on, slugged, or looked up.
//   3. `content_type` OUTSIDE THE ELEVEN MEASURED KINDS IS AN ABSENCE, not a twelfth kind.
//
// NEVER THROWS. An unreachable service is a fact the caller must be told about, not a lost turn:
// every failure returns an empty record list and names itself in `degraded`.
//
// PURE OF SECRETS. The token is read from the environment inside the call and never leaves it:
// not into a return value, not into `degraded`, not into a log line.

import { HIT_FIELDS, DROPPED_HIT_FIELD, isKnownContentType } from './lessons-source-card.js';

const SEARCH_URL = 'https://lib.ezik.app/lessons/search';

// Measured at the library service and unchanged for this route: the header is `authorization`
// and the value sits behind the exact prefix `Bearer `. A raw token, or a header name invented
// from habit, is a silent 401 in production.
const AUTH_HEADER_NAME = 'authorization';
const AUTH_VALUE_PREFIX = 'Bearer ';

// The ceiling of ten is enforced in the service itself (MAX_LIMIT=10): a larger number is cut
// there in silence, so asking for more is asking for something that will not come back.
const LIMIT_MAX = 10;
const LIMIT_DEFAULT = 10;
const MAX_Q_CHARS = 400;
const TIMEOUT_MS = 12000;
const MAX_BYTES = 4 * 1024 * 1024;

/** The nine names that may leave the upstream: the measured ten, less the one that is dropped. */
export const UPSTREAM_HIT_FIELDS = Object.freeze(HIT_FIELDS.filter((f) => f !== DROPPED_HIT_FIELD));

/** The four names a brain record carries. There is no fifth, and none of them is text. */
export const BRAIN_RECORD_FIELDS = Object.freeze(['title', 'scholarId', 'url', 'contentType']);

/** `limit`: an integer, ceiling 10, default 10. Anything unusable falls to the default. */
export function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return LIMIT_DEFAULT;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return LIMIT_DEFAULT;
  const whole = Math.trunc(numeric);
  if (whole < 1) return LIMIT_DEFAULT;
  return Math.min(whole, LIMIT_MAX);
}

/**
 * Reduce a raw upstream payload to what the brain may see.
 *
 * A hit with no title, or with no http(s) link, is DROPPED rather than carried as a half record:
 * a lesson the reader cannot open is a citation that cannot be checked, and an unopenable
 * citation is worse than none. Pure -- exported so a guard can prove the shape with no network.
 */
export function toBrainRecords(payload) {
  const hits = Array.isArray(payload && payload.hits) ? payload.hits : [];
  const records = [];
  for (const hit of hits) {
    if (!hit || typeof hit !== 'object') continue;
    const title = typeof hit.title === 'string' ? hit.title.trim() : '';
    const url = typeof hit.url === 'string' ? hit.url.trim() : '';
    const scholarId = typeof hit.scholar_id === 'string' ? hit.scholar_id.trim() : '';
    if (!title) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    const record = { title, scholarId, url };
    if (isKnownContentType(hit && hit.content_type)) record.contentType = hit.content_type;
    records.push(record);
  }
  return records;
}

/**
 * Search the lessons store for the ANSWER PATH.
 *
 * @param {{query:string, limit?:number}} input
 * @param {{signal?:AbortSignal, fetchImpl?:Function}} [options]
 * @returns {Promise<{records:Array<object>, degraded:string}>} `degraded` is '' on success.
 */
export async function searchLessons(input, options) {
  const opts = options || {};
  const query = String((input && input.query) || '').replace(/\s+/gu, ' ').trim().slice(0, MAX_Q_CHARS);
  if (!query) return { records: [], degraded: 'empty_query' };
  const limit = normalizeLimit(input && input.limit);

  const token = process.env.SEARCH_API_TOKEN;
  if (typeof token !== 'string' || token.length === 0) {
    return { records: [], degraded: 'search_api_token_missing' };
  }

  const doFetch = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : fetch;
  let response;
  try {
    response = await doFetch(SEARCH_URL, {
      method: 'POST',
      redirect: 'error',
      signal: opts.signal || AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [AUTH_HEADER_NAME]: AUTH_VALUE_PREFIX + token,
      },
      body: JSON.stringify({ q: query, limit }),
    });
  } catch (error) {
    return { records: [], degraded: 'unreachable' };
  }

  // A 401 means the token we hold is not the token the service wants. There is exactly one call
  // and no second one: a retry would earn the same 401 twice.
  if (!response || response.status === 401) return { records: [], degraded: 'unauthorized' };
  if (!response.ok) return { records: [], degraded: 'status_' + response.status };

  let payload;
  try {
    const declared = Number((response.headers && response.headers.get && response.headers.get('content-length')) || 0);
    if (declared > MAX_BYTES) return { records: [], degraded: 'body_too_large' };
    payload = await response.json();
  } catch (error) {
    return { records: [], degraded: 'body_unreadable' };
  }

  return { records: toBrainRecords(payload), degraded: '' };
}