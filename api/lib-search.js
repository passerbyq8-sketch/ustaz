// api/lib-search.js — the ONLY caller of the library search service (البند ١٦-أ)
//
// ══ WHY THIS IS A SERVER FUNCTION AND NOT A FETCH IN THE CLIENT ══════════════
// `/search` on the library service is token-gated: with the token it answers 200,
// without it 401. The token is the whole gate. Put it in client code — in a bundle,
// in an inline script, in a build-time constant — and the library is open to the
// world, permanently, because a shipped secret cannot be un-shipped. So the token is
// read HERE, from the environment, and never leaves this function: not into a
// response body, not into a header the browser can see, not into a log line, not
// into the repo.
//
// ══ THE AUTH HEADER IS MEASURED, NOT GUESSED ═════════════════════════════════
// Read out of the service's own source, C:\EZIK-LIB\service\src\server.mjs:
//
//   365:  if (!authorized(request.headers.authorization, config.token)) throw new UnauthorizedError();
//   165:  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
//   166:  const supplied = header.slice('Bearer '.length);
//
// So the header is `authorization` and the value is the token behind the exact
// prefix `Bearer ` — raw token, no prefix, would be a silent 401 in production, and
// so would any header name invented from habit.
//
// ══ THE MEASURED CONTRACT ════════════════════════════════════════════════════
//   GET  /health   no token   {"status":"ok"}
//   GET  /ready    no token   readiness body
//   POST /search   TOKEN      200 with it, 401 without it
//   anything else             404
// Request body: {"q": "<arabic text>", "limit": 10}, content-type application/json.
//
// ══ WHAT REACHES THE CLIENT ══════════════════════════════════════════════════
// The eleven response fields and, inside every hit, the seventeen hit fields — no
// more and no fewer. A field the service adds later is dropped in silence rather
// than forwarded blind; a field it omits stays omitted rather than filled in with an
// invented value. Both lists are imported from lib/lib-source-card.js so the card
// builder and this whitelist cannot drift apart, and neither of them knows a field
// called `book_id`.
//
// This round is purely additive: nothing in the answer path calls this endpoint yet.

import { RESPONSE_FIELDS, HIT_FIELDS } from '../lib/lib-source-card.js';

const SEARCH_URL = 'https://lib.ezik.app/search';

// Measured at server.mjs:365 and server.mjs:165-166. Do not "tidy" either of these.
const AUTH_HEADER_NAME = 'authorization';
const AUTH_VALUE_PREFIX = 'Bearer ';

const LIMIT_MAX = 10;
const LIMIT_DEFAULT = 10;
const MAX_Q_CHARS = 400;
const TIMEOUT_MS = 12000;
const MAX_BYTES = 4 * 1024 * 1024;

// One sentence per failure class, and each says only that the search did not happen.
// A client that could tell "no token configured" from "the service rejected our
// token" would be telling an attacker where the gate is. The distinction lives in
// the server log, which the browser never reads.
const UNAVAILABLE_BODY = Object.freeze({
  ok: false,
  error: { code: 'LIB_SEARCH_UNAVAILABLE', message: 'البحثُ في المكتبةِ غيرُ متاحٍ الآن.' }
});
const UPSTREAM_BODY = Object.freeze({
  ok: false,
  error: { code: 'LIB_SEARCH_UPSTREAM_UNAVAILABLE', message: 'تعذّرَ البحثُ في المكتبةِ الآن.' }
});
const BAD_REQUEST_BODY = Object.freeze({
  ok: false,
  error: { code: 'LIB_SEARCH_BAD_REQUEST', message: 'نصُّ البحثِ مطلوب.' }
});
const METHOD_BODY = Object.freeze({
  ok: false,
  error: { code: 'METHOD_NOT_ALLOWED', message: 'الطريقةُ غيرُ مسموحة.' }
});

// Copy only the named fields, and only those the source actually carries. Present
// stays present, absent stays absent, unknown is dropped without comment.
function pickFields(source, allowed) {
  const out = {};
  if (source == null || typeof source !== 'object') return out;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

/**
 * Shape a raw `/search` payload into what the client is allowed to see.
 * Pure — exported so the guard can prove the whitelist without a network call.
 */
export function shapeSearchResponse(payload) {
  const out = pickFields(payload, RESPONSE_FIELDS);
  // `hits` was copied by name above; replace it with the per-hit whitelist, and drop
  // it entirely if it came back as something other than a list.
  if (Array.isArray(payload?.hits)) {
    out.hits = payload.hits.map((hit) => pickFields(hit, HIT_FIELDS));
  } else {
    delete out.hits;
  }
  return out;
}

/** `limit`: an integer, ceiling 10, default 10. Anything unusable falls to default. */
export function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return LIMIT_DEFAULT;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return LIMIT_DEFAULT;
  const whole = Math.trunc(numeric);
  if (whole < 1) return LIMIT_DEFAULT;
  return Math.min(whole, LIMIT_MAX);
}

function readBody(req) {
  const raw = req?.body;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json(METHOD_BODY);

  const body = readBody(req);
  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (!q) return res.status(400).json(BAD_REQUEST_BODY);
  const limit = normalizeLimit(body.limit);

  const token = process.env.SEARCH_API_TOKEN;
  if (typeof token !== 'string' || token.length === 0) {
    // Server log only. The reason names the missing configuration for whoever reads
    // the function's logs; the client is told nothing beyond "not available".
    console.warn('[lib-search] unavailable', { reason: 'search_api_token_missing' });
    return res.status(503).json(UNAVAILABLE_BODY);
  }

  let response;
  try {
    response = await fetch(SEARCH_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [AUTH_HEADER_NAME]: AUTH_VALUE_PREFIX + token
      },
      body: JSON.stringify({ q: q.slice(0, MAX_Q_CHARS), limit })
    });
  } catch (error) {
    console.warn('[lib-search] upstream unreachable', { reason: String(error?.message || error) });
    return res.status(502).json(UPSTREAM_BODY);
  }

  // A 401 means the token we hold is not the token the service wants. There is
  // exactly one call and no second one: retrying without the token would only earn a
  // guaranteed 401, and retrying with it would earn the same 401 twice.
  if (response.status === 401) {
    console.warn('[lib-search] upstream rejected credentials', { outcome: 'upstream_unauthorized' });
    return res.status(502).json(UPSTREAM_BODY);
  }
  if (!response.ok) {
    console.warn('[lib-search] upstream error', { outcome: 'upstream_error', reason: 'status_' + response.status });
    return res.status(502).json(UPSTREAM_BODY);
  }

  let payload;
  try {
    const declared = Number(response.headers?.get?.('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('body_too_large');
    payload = await response.json();
  } catch (error) {
    console.warn('[lib-search] upstream body unreadable', { reason: String(error?.message || error) });
    return res.status(502).json(UPSTREAM_BODY);
  }

  // `refused: true` (the postings ceiling) and `degraded_reason: 'over_budget'` are
  // not failures and are not rewritten here — they travel to the client as measured
  // fields, and the view says the matching sentence.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json(shapeSearchResponse(payload));
}
