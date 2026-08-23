// api/lessons-search.js — the ONLY caller of the lessons search service.
//
// ══ THREE TRAPS IN THE MEASURED CONTRACT, WRITTEN AT THE HEAD BY ORDER ═══════
//
//   1. `scholar_id` IS NOT AN IDENTIFIER. It is the scholar's Arabic display name; the service
//      names the field that way for historical reasons inside its own contract. Treating it as
//      a key — joining on it, slugging it, looking it up — builds on something that is not
//      there.
//
//   2. `snippet` IS NEVER READ, NEVER PASSED, NEVER STORED. The service sends it empty in 97.6%
//      of hits and filled in 2.4%, and the owner's ruling is that lesson text is not displayed
//      at all. THIS FILE IS THE EDGE OF THE TREE, so the deletion happens HERE: the field is
//      cut off every hit before the hit is returned, whether it arrived empty or filled, and no
//      structure behind this function has a place for it.
//
//   3. `content_type` IS ONE OF ELEVEN MEASURED KINDS (lib/lessons-source-card.js lists them).
//      They are not translated here — wording a kind for a screen is the interface's business,
//      and there is no interface in this round. A value outside the eleven is an ABSENCE, not a
//      twelfth kind.
//
// ══ WHY THIS IS A SERVER FUNCTION AND NOT A FETCH IN THE CLIENT ══════════════
// `/lessons/search` is token-gated on the same variable api/lib-search.js already uses,
// SEARCH_API_TOKEN. The token is the whole gate. Put it in client code — in a bundle, in an
// inline script, in a build-time constant — and the service is open to the world permanently,
// because a shipped secret cannot be un-shipped. So the token is read HERE, from the
// environment, and never leaves this function: not into a response body, not into a header the
// browser can see, not into a log line, not into the repo.
//
// ══ THE MEASURED CONTRACT ════════════════════════════════════════════════════
//   POST https://lib.ezik.app/lessons/search
//   header  authorization: Bearer <SEARCH_API_TOKEN>
//   body    {"q": "<question text>", "limit": <1..10>}
//   reply   an object carrying `hits`, an array; every hit carries TEN fields and no eleventh:
//           unit_id · scholar_id · title · url · tier · usage · citation_allowed ·
//           content_type · snippet · score
//
// THE CEILING OF TEN IS ENFORCED IN THE SERVICE ITSELF (MAX_LIMIT=10): a larger limit is cut
// there in silence, so asking for more is asking for a number that will not come back. This
// function refuses to send one.
//
// ══ WHAT REACHES THE CLIENT ══════════════════════════════════════════════════
// NINE of the ten hit fields — the ten minus `snippet` — and nothing added. This function does
// not attach a card, does not add a sentence, and does not invent a field: the response is the
// measured contract with one field removed. A field the service adds later is dropped in
// silence rather than forwarded blind; a field it omits stays omitted rather than filled in.
// The field lists are imported from lib/lessons-source-card.js so the whitelist here and the
// card there cannot drift apart.
//
// This round is purely additive and has NO INTERFACE: nothing in the answer path and nothing in
// index.html calls this endpoint.
import { HIT_FIELDS, DROPPED_HIT_FIELD } from '../lib/lessons-source-card.js';

const SEARCH_URL = 'https://lib.ezik.app/lessons/search';

// The nine names that may reach the client: the measured ten, less the one deleted at this
// edge. Derived from the contract rather than typed out a second time, so a change to the
// contract cannot leave a stale copy behind here.
export const RETURNED_HIT_FIELDS = Object.freeze(HIT_FIELDS.filter((f) => f !== DROPPED_HIT_FIELD));

// The only top-level name this repo has MEASURED on a `/lessons/search` reply. The rest of the
// envelope is unmeasured, and an unmeasured field is dropped rather than forwarded blind — the
// same rule api/lib-search.js applies to its own eleven.
export const RESPONSE_FIELDS = Object.freeze(['hits']);

// Measured at the library service, server.mjs:365 and server.mjs:165-166, and unchanged for
// this route: the header is `authorization` and the value is the token behind the exact prefix
// `Bearer `. A raw token, or a header name invented from habit, is a silent 401 in production.
const AUTH_HEADER_NAME = 'authorization';
const AUTH_VALUE_PREFIX = 'Bearer ';

const LIMIT_MAX = 10;
const LIMIT_DEFAULT = 10;
const MAX_Q_CHARS = 400;
const TIMEOUT_MS = 12000;
const MAX_BYTES = 4 * 1024 * 1024;

// One sentence per failure class, and each says only that the search did not happen. A client
// that could tell "no token configured" from "the service rejected our token" would be telling
// an attacker where the gate is. The distinction lives in the server log, which the browser
// never reads.
const UNAVAILABLE_BODY = Object.freeze({
  ok: false,
  error: { code: 'LESSONS_SEARCH_UNAVAILABLE', message: 'البحثُ في الدروسِ غيرُ متاحٍ الآن.' }
});
const UPSTREAM_BODY = Object.freeze({
  ok: false,
  error: { code: 'LESSONS_SEARCH_UPSTREAM_UNAVAILABLE', message: 'تعذّرَ البحثُ في الدروسِ الآن.' }
});
const BAD_REQUEST_BODY = Object.freeze({
  ok: false,
  error: { code: 'LESSONS_SEARCH_BAD_REQUEST', message: 'نصُّ البحثِ مطلوب.' }
});
const METHOD_BODY = Object.freeze({
  ok: false,
  error: { code: 'METHOD_NOT_ALLOWED', message: 'الطريقةُ غيرُ مسموحة.' }
});

// Copy only the named fields, and only those the source actually carries. Present stays
// present, absent stays absent, unknown is dropped without comment.
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
 * Shape a raw `/lessons/search` payload into what the client is allowed to see.
 *
 * THE SNIPPET IS CUT HERE AND NOWHERE ELSE. RETURNED_HIT_FIELDS is the contract's ten with
 * `snippet` removed, so the cut is a consequence of the whitelist rather than a second pass
 * over the object — there is no branch that could forget to run, and a hit that arrives with a
 * FILLED snippet loses it by exactly the same code path as one that arrives with an empty one.
 *
 * Pure — exported so the guard can prove the whitelist without a network call.
 */
export function shapeSearchResponse(payload) {
  const out = pickFields(payload, RESPONSE_FIELDS);
  // `hits` was copied by name above; replace it with the per-hit whitelist, and drop it
  // entirely if it came back as something other than a list.
  if (Array.isArray(payload?.hits)) {
    out.hits = payload.hits.map((hit) => pickFields(hit, RETURNED_HIT_FIELDS));
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
    // Server log only. The reason names the missing configuration for whoever reads the
    // function's logs; the client is told nothing beyond "not available".
    console.warn('[lessons-search] unavailable', { reason: 'search_api_token_missing' });
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
    console.warn('[lessons-search] upstream unreachable', { reason: String(error?.message || error) });
    return res.status(502).json(UPSTREAM_BODY);
  }

  // A 401 means the token we hold is not the token the service wants. There is exactly one call
  // and no second one: retrying without the token would only earn a guaranteed 401, and
  // retrying with it would earn the same 401 twice.
  if (response.status === 401) {
    console.warn('[lessons-search] upstream rejected credentials', { outcome: 'upstream_unauthorized' });
    return res.status(502).json(UPSTREAM_BODY);
  }
  if (!response.ok) {
    console.warn('[lessons-search] upstream error', { outcome: 'upstream_error', reason: 'status_' + response.status });
    return res.status(502).json(UPSTREAM_BODY);
  }

  let payload;
  try {
    const declared = Number(response.headers?.get?.('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('body_too_large');
    payload = await response.json();
  } catch (error) {
    console.warn('[lessons-search] upstream body unreadable', { reason: String(error?.message || error) });
    return res.status(502).json(UPSTREAM_BODY);
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json(shapeSearchResponse(payload));
}
