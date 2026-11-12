// lib/provider-call.js -- ORDER A2 item 8 (2026-11-11; the owner's decision of 11 November): A PROVIDER FAILURE IS TOLD HONESTLY.
//
// MEASURED on the preview capture of 11 November (BRAIN-A-CAPTURE-20261111-1353Z, server log pulled 14:57Z): for about forty
// seconds the model provider answered EVERY call of both models with HTTP 400. Five consecutive turns lost every call they
// made -- the reading, the sorter, the judge, the writer, the older path's round and its closing write -- and each reader was
// sent the sentence that no text was found in Ezik's sources, with the offer to search the web, although the sources had
// returned 14 to 24 candidates. Three things were wrong and this file holds what the three cures share:
//
//   1. the status was thrown away by every call but the older path's (the stream said `error` and nothing else);
//   2. no call was tried a second time, whatever the failure;
//   3. the reader was told something untrue.
//
// WHAT IS HERE. One fetch for a model call: it tries once more, after a short pause, a call the provider answered with 429,
// 500 or 529 or that could not connect -- never a 400, never any other status, never an aborted call -- and it keeps the
// provider's status and its error TYPE (a closed word of the provider's: `invalid_request_error`, `rate_limit_error`,
// `overloaded_error`, ...). NEVER the provider's message, never a header, never the request: a message can quote what it
// was sent, and the owner's rule of 18 August is that the reader's text is not recorded.
//
// No import: every caller of the provider loads this file (lib/request-plan.js starts before any other module of the turn).

/** The statuses that are tried once more. A 400 is the provider refusing the request as sent: asking again cannot cure it. */
export const PROVIDER_RETRY_STATUSES = Object.freeze([429, 500, 529]);
/** The pause before the one retry. */
export const PROVIDER_RETRY_PAUSE_MS = 500;
/** What the reader is told when no model call of the turn could answer. The same sentence api/ask.js holds as FREE_BRAIN_EMPTY. */
export const PROVIDER_LOST_TEXT = 'تعذَّر توليدُ الجوابِ الآن. أعِدْ إرسالَ سؤالِك من فضلك.';
/** The answer log's one closed flag for a turn lost to the provider. */
export const PROVIDER_LOST_FLAG = 'provider_lost';
/** The word kept for a call that could not connect at all (no status). */
export const PROVIDER_CONNECTION_TYPE = 'connection';
/** The word kept for a reply that arrived whole and could not be read (a body that is not JSON: a gateway's page). */
export const PROVIDER_BODY_TYPE = 'body';

const TYPE_RE = /^[a-z][a-z0-9_]{0,39}$/;
let pauseForTest = null;
/** A guard sets the pause (milliseconds) so that its rows do not wait; null restores the constant. */
export function __setProviderRetryPauseForTest(ms) {
  pauseForTest = Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** The provider's error type from an error body: the closed word under `error.type`, or '' when there is none to trust. */
export function providerErrorType(bodyText) {
  let parsed = null;
  try { parsed = JSON.parse(String(bodyText || '')); } catch { return ''; }
  const type = parsed && parsed.error && typeof parsed.error === 'object' ? parsed.error.type : '';
  return typeof type === 'string' && TYPE_RE.test(type) ? type : '';
}

/**
 * What an error thrown for a failed provider call carries: {status, type}, or null when the error is not the provider's
 * (an error with neither an HTTP status nor the mark this file puts on a call that could not connect: a parse failure, a
 * guard's own stub). status 0 = no reply at all.
 */
export function providerFailureOf(error) {
  if (!error || typeof error !== 'object') return null;
  const status = Number.isInteger(error.status) && error.status > 0 ? error.status : 0;
  const type = typeof error.providerType === 'string' && TYPE_RE.test(error.providerType) ? error.providerType : '';
  if (!status && !type) return null;
  return { status, type };
}

/** `call:status:type`, the one token a log line keeps for a failed call (ASCII: a closed call name, digits, a closed word). */
export function providerFailureToken(call, failure) {
  const f = failure && typeof failure === 'object' ? failure : {};
  return String(call || 'call') + ':' + (Number.isInteger(f.status) ? f.status : 0) + ':' + (typeof f.type === 'string' && TYPE_RE.test(f.type) ? f.type : '');
}

/** An Error for a failed provider call, carrying the status and the type (and nothing of the body). */
export function providerError(message, response) {
  const error = new Error(message);
  error.status = response && Number.isInteger(response.status) ? response.status : 0;
  error.providerType = response && typeof response.providerType === 'string' ? response.providerType : '';
  return error;
}

/**
 * A reply whose BODY could not be read to its end (the connection dropped after the headers) is the provider's failure too:
 * the error is marked as a call that could not connect. MEASURED by the refuting helper (HELPER-REFUTATION-A2.md C8.1): such an
 * error carried neither a status nor the mark, the turn was not counted as lost, and the reader was told no text was found.
 * Not an aborted call, not an error that carries a status of its own.
 * (after the second helper, D8.1: a body that arrived whole and is not JSON was left unmarked. The older path counted such a
 * turn as lost with no token; the before-writing path did not count it and told the reader no text was found. It is the
 * provider's failure on both, under its own closed word.)
 */
export function providerBodyLost(error, signal = null) {
  if (error && typeof error === 'object' && !(signal && signal.aborted)
    && !(Number.isInteger(error.status) && error.status > 0) && typeof error.providerType !== 'string') {
    try { error.providerType = error instanceof SyntaxError ? PROVIDER_BODY_TYPE : PROVIDER_CONNECTION_TYPE; } catch { /* a frozen error keeps its own fields */ }
  }
  return error;
}

const sleep = (ms, signal) => new Promise((resolve) => {
  if (!(ms > 0)) { resolve(); return; }
  const timer = setTimeout(done, ms);
  function done() { clearTimeout(timer); if (signal && typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', done); resolve(); }
  if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', done, { once: true });
});

/**
 * One model call. Resolves to the provider's response; a reply that is not 2xx comes back as a small object the caller reads
 * as it read the response before ({ok:false, status, headers, text(), json()}), with `providerType` beside it (the body is
 * read here, once). A call that could not connect rejects with the fetch error, marked `providerType: 'connection'`.
 *
 * @param {string} providerUrl
 * @param {object} init  what fetch is given (method, headers, signal, body)
 * @param {{retry?:boolean|function():boolean}} options  retry=false (or a function that says false when asked) where a second try
 *   must not happen: text of this turn is already on the reader's page
 */
export async function providerFetch(providerUrl, init, { retry = true } = {}) {
  const signal = init && init.signal;
  const aborted = () => !!(signal && signal.aborted);
  // a call that could not connect: fetch rejected, the call was not aborted, and the error carries no status of its own
  // (the platform's fetch never puts one on a rejection; an error that does is somebody's own report and is passed on as it is)
  const noConnection = (error) => !aborted() && !(error && Number.isInteger(error.status) && error.status > 0);
  const once = async () => {
    let response;
    try { response = await fetch(providerUrl, init); } catch (error) {
      return { error };
    }
    if (response && response.ok) return { response };
    let body = '';
    try { body = await response.text(); } catch { body = ''; }
    return {
      response: {
        ok: false, status: response.status, headers: response.headers, providerType: providerErrorType(body),
        text: async () => body, json: async () => JSON.parse(body),
      },
    };
  };
  let got = await once();
  // (after the second helper: `retry` may be a function, asked HERE -- when the second try is decided -- so that "nothing of the
  // turn is on the reader's page" is read after the first try failed, not when it started)
  const mayRetry = () => (typeof retry === 'function' ? retry() === true : retry === true);
  const again = !aborted() && (got.error ? noConnection(got.error) : PROVIDER_RETRY_STATUSES.includes(got.response.status)) && mayRetry();
  if (again) {
    await sleep(pauseForTest === null ? PROVIDER_RETRY_PAUSE_MS : pauseForTest, signal);
    if (!aborted()) got = await once();
  }
  if (got.error) {
    const error = got.error;
    if (error && typeof error === 'object' && noConnection(error) && typeof error.providerType !== 'string') {
      try { error.providerType = PROVIDER_CONNECTION_TYPE; } catch { /* a frozen error keeps its own fields */ }
    }
    throw error;
  }
  return got.response;
}

/**
 * The three things a caller of the provider needs, as one object a module can be HANDED instead of importing this file
 * (lib/request-plan.js and lib/front-sorter.js keep the imports their guards pin; api/ask.js hands them this).
 */
export const PROVIDER_CALLS = Object.freeze({ fetch: providerFetch, error: providerError, failureOf: providerFailureOf, lost: providerBodyLost });

/** Is this the older path's own word for a failed provider call (lib/free-brain/loop.js `failure`)? */
export function isProviderFailureWord(failure) {
  return typeof failure === 'string' && failure.startsWith('provider_error_');
}
