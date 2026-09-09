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
// because a shipped secret cannot be un-shipped. So the token is read from the environment on
// the SERVER and never travels to the browser: not into a response body, not into a header the
// browser can see, not into a log line, not into the repo.
//
// ── ITEM 37/① — AND THE FUNCTION NOW HAS A SECOND, IN-PROCESS CALLER ────────
// `search_lessons` in lib/free-brain/tools.js reaches the service THROUGH THIS FILE and never
// around it: `fetchLessonsPayload` below is the whole outbound call, and the free-brain tool
// imports it rather than opening a socket of its own. That is what keeps the header sentence
// above true — this file is still the ONLY caller of the lessons service — and it is why the
// tool needs no token of its own and no second address.
//
// WHAT MOVED, SAID PLAINLY. The token used to be read INSIDE the HTTP handler and could not
// leave it. It is now a PARAMETER of `fetchLessonsPayload`: this handler still reads it from
// `process.env` for its own call, and api/ask.js — which already reads the SAME variable for
// the library at api/ask.js:844 — hands it down for the brain's call. So the number of readers
// of the environment variable went from one to two and the number of PROCESSES holding it did
// not change: both are this server. It still reaches no client, no log line and no repo file.
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
// NOTE FOR THE GUARD, AND FOR ANYONE ADDING A SECOND ONE: this file imports exactly ONE module
// and section 6 of guards/lessons-search-guard.cjs asserts that by name. The free-brain tool
// imports THIS file; this file imports nothing of the free brain's, so the dependency has one
// direction and no cycle.

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

/**
 * Shape a raw payload for the FREE BRAIN, which is not the client.
 *
 * THE ONE DIFFERENCE FROM `shapeSearchResponse` IS `snippet`, AND IT IS THE ITEM'S WHOLE POINT.
 * The served index carries 90,091 units with a transcribed matn — the scholars' own words — and
 * until item 37 that matn was closed to the model completely. The owner's order of 2026-09-09
 * names FIVE things `search_lessons` returns per hit, and «مقتطفٌ قصير» is the fourth of them.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT. The READER'S SCREEN still gets no lesson text at all: the
 * HTTP handler below still answers with `shapeSearchResponse`, and lib/lessons-source-card.js
 * still has no place for the field. This shaper is reachable only from a server-side import,
 * never from the route, so a browser cannot ask for it.
 *
 * Pure — exported so the guard can prove the difference without a network call.
 */
export function shapeBrainResponse(payload) {
  const out = pickFields(payload, RESPONSE_FIELDS);
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

// ── THE PARENT-PLUS-CEILING SIGNAL, COPIED FROM lib/lib-service.js:67 ────────
// Carried across letter for letter rather than re-invented, because the two halves are the same
// promise: a caller may cut the call at any moment, AND the call gives up on its own at the
// ceiling even when the caller never cuts it. A bare `options.signal` would drop the ceiling; a
// bare timeout would ignore the caller. Nothing here is new; only the file it lives in is.
function signalFor(parent) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

/**
 * THE OUTBOUND CALL, AND THE ONLY ONE IN THIS TREE.
 *
 * Both callers pass through here: the HTTP handler below (for the reader's browser) and
 * `search_lessons` in lib/free-brain/tools.js (for the model). The failure classes are RETURNED
 * rather than logged, so each caller says what its own reader is owed — the handler turns them
 * into one sentence and a status code, the tool turns them into a `degraded` note and a line the
 * model can read.
 *
 * NEVER THROWS, on the rule lib/lib-service.js states for itself: this sits in the answer path of
 * someone asking about their religion, and a search that could not run must degrade to silence.
 *
 * @returns {Promise<{ok:true, payload:object}|{ok:false, reason:string, detail?:string}>}
 */
export async function fetchLessonsPayload(q, options = {}) {
  const query = typeof q === 'string' ? q.trim() : '';
  if (!query) return { ok: false, reason: 'bad_request' };
  const token = typeof options.token === 'string' ? options.token : '';
  if (token.length === 0) return { ok: false, reason: 'search_api_token_missing' };
  const limit = normalizeLimit(options.limit);
  // Read at CALL time and never captured at module load: guards stub `globalThis.fetch` to drive
  // this function with no socket, and a captured reference would hold the real one.
  const call = typeof options.fetchImpl === 'function' ? options.fetchImpl : globalThis.fetch;

  let response;
  try {
    response = await call(SEARCH_URL, {
      method: 'POST',
      redirect: 'error',
      signal: signalFor(options.signal),
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [AUTH_HEADER_NAME]: AUTH_VALUE_PREFIX + token
      },
      body: JSON.stringify({ q: query.slice(0, MAX_Q_CHARS), limit })
    });
  } catch (error) {
    return { ok: false, reason: 'upstream_unreachable', detail: String(error?.message || error) };
  }

  // A 401 means the token we hold is not the token the service wants. There is exactly one call
  // and no second one: retrying without the token would only earn a guaranteed 401, and
  // retrying with it would earn the same 401 twice.
  if (response.status === 401) return { ok: false, reason: 'upstream_unauthorized' };
  if (!response.ok) return { ok: false, reason: 'upstream_error', detail: 'status_' + response.status };

  try {
    const declared = Number(response.headers?.get?.('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('body_too_large');
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return { ok: false, reason: 'upstream_unreadable', detail: String(error?.message || error) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json(METHOD_BODY);

  const body = readBody(req);
  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (!q) return res.status(400).json(BAD_REQUEST_BODY);

  const out = await fetchLessonsPayload(q, {
    token: process.env.SEARCH_API_TOKEN,
    limit: body.limit
  });

  if (out.ok !== true) {
    if (out.reason === 'search_api_token_missing') {
      // Server log only. The reason names the missing configuration for whoever reads the
      // function's logs; the client is told nothing beyond "not available".
      console.warn('[lessons-search] unavailable', { reason: 'search_api_token_missing' });
      return res.status(503).json(UNAVAILABLE_BODY);
    }
    if (out.reason === 'upstream_unreachable') {
      console.warn('[lessons-search] upstream unreachable', { reason: out.detail });
      return res.status(502).json(UPSTREAM_BODY);
    }
    if (out.reason === 'upstream_unauthorized') {
      console.warn('[lessons-search] upstream rejected credentials', { outcome: 'upstream_unauthorized' });
      return res.status(502).json(UPSTREAM_BODY);
    }
    if (out.reason === 'upstream_error') {
      console.warn('[lessons-search] upstream error', { outcome: 'upstream_error', reason: out.detail });
      return res.status(502).json(UPSTREAM_BODY);
    }
    console.warn('[lessons-search] upstream body unreadable', { reason: out.detail });
    return res.status(502).json(UPSTREAM_BODY);
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json(shapeSearchResponse(out.payload));
}
