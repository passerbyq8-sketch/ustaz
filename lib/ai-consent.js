// lib/ai-consent.js
// THE SERVER SIDE OF THE AI-CONSENT GATE  (Apple 5.1.1(i) / 5.1.2(i)).
//
// Hiding a button is not a gate. Every route that forwards a reader's data to Anthropic,
// ElevenLabs or Brave re-checks the consent header HERE, before it reads a key, opens a socket
// or spends a token -- so a request built by hand, replayed from a log, or issued by a client
// build that predates the consent screen reaches no vendor either.
//
// ONE MODULE, ONE VERSION STRING. The client's EZ_AI_CONSENT_VERSION in index.html and the
// constant below are the same value by construction: tools/ai-consent-probe.cjs reads both files
// and fails on any drift, the same shape the body-cap mirror is held to.
//
// WHAT THIS HEADER IS, AND IS NOT. It is a statement by the client that the reader has been
// shown the current disclosure and agreed to it. It is not authentication and it is not claimed
// to be: it stops the accidental and the stale, not a determined forger, and the record of the
// choice lives on the reader's own device where they can revoke it. What it guarantees is the
// thing Apple asked for -- that no path in this app sends a reader's data onward without the
// disclosure having been accepted, and that the refusal is enforced in two independent places.
//
// Every Arabic character below is a \uXXXX escape and this file holds ZERO raw Arabic code
// points -- the rule lib/daycap.js and api/unlock.js already follow, for the same reason: a raw
// right-to-left string renders reversed in many editors and gets silently corrupted by anyone
// retyping what they see.

export const AI_CONSENT_VERSION = '2026-08-06-1';
export const AI_CONSENT_HEADER = 'x-ezik-ai-consent';

// Every AI route must advertise the header, or a browser preflight strips it and every request
// arrives looking un-consented. Appended to the CORS allow-list each route already sets.
export const AI_CONSENT_ALLOW_HEADERS = AI_CONSENT_HEADER;

export const AI_CONSENT_REFUSAL = {
  error: 'ai-consent-required',
  // "There is no consent to share data with the AI services."
  message: '\u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0639 \u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A.',
  requiredVersion: AI_CONSENT_VERSION,
};

// FAIL-CLOSED. Absent, empty, wrong version, an array of values, a non-object req -- all false.
export function hasAIConsent(req) {
  try {
    const h = req && req.headers;
    if (!h) return false;
    let v = h[AI_CONSENT_HEADER];
    if (v === undefined) v = h[AI_CONSENT_HEADER.toUpperCase()];
    if (Array.isArray(v)) v = v[0];
    if (typeof v !== 'string') return false;
    return v.trim() === AI_CONSENT_VERSION;
  } catch (e) {
    return false;
  }
}

// The one line each route runs. Returns false having ALREADY sent 403 -- the caller returns
// immediately and does no work. Place it after the OPTIONS preflight (which must still be
// answered, or the browser never learns the header is allowed) and before every vendor call.
export function guardAIConsent(req, res) {
  if (hasAIConsent(req)) return true;
  try { res.status(403).json(AI_CONSENT_REFUSAL); } catch (e) {}
  return false;
}
