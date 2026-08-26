// lib/auth/oidc.js
// THE PROVIDER SIDE OF SIGN-IN: configuration, the authorization URL, the code exchange, the
// signing keys, and the verification of the id_token -- with NO NEW DEPENDENCY.
//
// WHY NO `jose` AND NO `jsonwebtoken`. node:crypto imports a JWK directly
// (`createPublicKey({ key, format: 'jwk' })`, Node >= 15) and verifies RSASSA-PKCS1-v1_5 with
// `crypto.verify` (Node >= 12). Both are in the 22.x this project declares. Adding a package
// would also turn the `chatux` gate red, which pins the five dependencies by name -- but the
// real reason is smaller: a JWT verified in twenty lines we can read is a JWT we can reason
// about, and the twenty lines are below.
//
// THE PROVIDER IS A PARAMETER, NOT A DUPLICATED BRANCH. Everything that differs between Google
// and Apple is a field in PROVIDERS below: the endpoints, the issuer strings, the scope, and the
// names of the two environment variables that carry the credentials. Adding a provider is DATA.
// (One honest exception is recorded in the build report: Apple requires `response_mode=form_post`
// when `email` is in scope, which makes its redirect a POST -- and api/auth-return.js is GET, as
// ordered. That difference is named, not silently papered over.)
//
// A PROVIDER WITHOUT ITS ENVIRONMENT VARIABLES IS A NAMED 503, NOT A CRASH. `providerConfig`
// returns a refusal object rather than throwing, so a misconfigured board produces one clear
// sentence in the response and the deploy is diagnosable from the outside.
//
// ZERO SECRETS LEAVE THIS FILE. No client secret, no authorization code, no id_token and no PKCE
// verifier is ever written to a console line, a thrown message or a returned field -- including
// on the error branches, where the temptation is greatest and the value is right there in hand.
// Every failure is a short fixed CODE. tools/auth-server-measure.cjs proves this by capturing
// every console call and every response body and searching them for the fixture secrets.

import crypto from 'node:crypto';

import {
  jwksKey,
  readJson,
  writeJson,
  JWKS_TTL_SECONDS,
} from './store.js';

/**
 * THE REDIRECT URI IS A CONSTANT IN THE SOURCE, AND IS NEVER BUILT FROM THE `Host` HEADER.
 *
 * `Host` is attacker-controlled on any request that reaches us -- a proxy, a preview alias, a
 * hand-written curl. Building the redirect from it hands an attacker a redirect_uri of their
 * choosing, and the provider will happily send the authorization code there. It is also the
 * value the provider console has registered, so it is not ours to vary at run time anyway.
 * One string, written once, matching what is registered.
 */
export const REDIRECT_URI = 'https://ezik.app/api/auth-return';

/** RS256 and nothing else. `none` and the HMAC family are not "another algorithm", they are the
 *  two classic ways to make signature verification a no-op. */
export const ALLOWED_ALG = 'RS256';

export const PROVIDERS = Object.freeze({
  google: Object.freeze({
    name: 'google',
    // Google publishes both spellings of its issuer across products; both are Google.
    issuers: Object.freeze(['https://accounts.google.com', 'accounts.google.com']),
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    scope: 'openid email',
    clientIdVar: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretVar: 'GOOGLE_OAUTH_CLIENT_SECRET',
  }),
  apple: Object.freeze({
    name: 'apple',
    issuers: Object.freeze(['https://appleid.apple.com']),
    authorizeUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    scope: 'openid email',
    clientIdVar: 'APPLE_OAUTH_CLIENT_ID',
    clientSecretVar: 'APPLE_OAUTH_CLIENT_SECRET',
  }),
});

export const PROVIDER_NAMES = Object.freeze(Object.keys(PROVIDERS));

/** A provider name arriving from a query string. Anything not on the list is not a provider. */
export function isProviderName(v) {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, v);
}

/**
 * Returns { ok: true, cfg } or { ok: false, status, code, provider }.
 * The 503 names WHICH provider is unconfigured and never which variable held what.
 */
export function providerConfig(name, env) {
  const source = env || process.env;
  if (!isProviderName(name)) {
    return { ok: false, status: 400, code: 'auth-provider-unknown', provider: String(name || '') };
  }
  const base = PROVIDERS[name];
  const clientId = source[base.clientIdVar];
  const clientSecret = source[base.clientSecretVar];
  if (typeof clientId !== 'string' || clientId.length === 0
    || typeof clientSecret !== 'string' || clientSecret.length === 0) {
    return { ok: false, status: 503, code: 'auth-provider-unconfigured', provider: name };
  }
  return { ok: true, cfg: Object.assign({}, base, { clientId, clientSecret }) };
}

// ---------------------------------------------------------------------------
// PKCE -- MANDATORY, S256, AND THE VERIFIER NEVER LEAVES THE SERVER.
//
// The verifier lives in the state record in the store for the ten minutes the flow is open, and
// is read back only by api/auth-return.js when it exchanges the code. It is not in the redirect,
// not in the app, not on the device: the phone that carried the reader to Google never holds the
// value that redeems the code, so a code intercepted on the way back is not redeemable by
// whoever intercepted it.
// ---------------------------------------------------------------------------

/** 32 random bytes as base64url == 43 characters, inside RFC 7636's 43..128. */
export function newVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

export function challengeFor(verifier) {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function newState() { return crypto.randomBytes(32).toString('base64url'); }
export function newNonce() { return crypto.randomBytes(32).toString('base64url'); }

export function buildAuthorizeUrl(cfg, parts) {
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('scope', cfg.scope);
  u.searchParams.set('state', parts.state);
  u.searchParams.set('nonce', parts.nonce);
  u.searchParams.set('code_challenge', parts.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

// ---------------------------------------------------------------------------
// THE CODE EXCHANGE.
// ---------------------------------------------------------------------------

const EXCHANGE_TIMEOUT_MS = 12000;

/**
 * Returns { ok: true, idToken } or { ok: false, code }. The provider's response body is read for
 * the id_token and for NOTHING else -- no access token is kept, no refresh token is asked for,
 * and the body is never logged even when the provider refused, because on that branch it
 * contains the code and the client secret we just sent.
 */
export async function exchangeCode(cfg, args) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', args.code);
  body.set('redirect_uri', REDIRECT_URI);
  body.set('client_id', cfg.clientId);
  body.set('client_secret', cfg.clientSecret);
  body.set('code_verifier', args.codeVerifier);

  let response;
  try {
    response = await fetch(cfg.tokenUrl, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
  } catch (e) {
    // The message is dropped on purpose: a fetch error message can quote the request.
    return { ok: false, code: 'auth-token-unreachable' };
  }

  if (!response || typeof response.status !== 'number' || response.status < 200 || response.status >= 300) {
    return { ok: false, code: 'auth-token-refused' };
  }

  let payload = null;
  try { payload = await response.json(); } catch (e) { return { ok: false, code: 'auth-token-unreadable' }; }
  const idToken = payload && typeof payload.id_token === 'string' ? payload.id_token : '';
  if (!idToken) return { ok: false, code: 'auth-token-no-id-token' };
  return { ok: true, idToken };
}

// ---------------------------------------------------------------------------
// THE SIGNING KEYS.
// ---------------------------------------------------------------------------

const JWKS_TIMEOUT_MS = 8000;

/**
 * The provider's public keys, cached in the store for six hours under auth:jwks:v1:<provider>.
 *
 * WHY CACHE AT ALL: without it every single sign-in makes a second outbound request before it
 * can verify anything, and a provider that rate-limits its own key endpoint would fail sign-ins
 * at exactly the busy moments. Six hours is short against the days these keys live and long
 * against the seconds a sign-in takes.
 *
 * A CACHE MISS IS NOT A FAILURE and a store outage is not one either -- both simply fetch.
 */
export async function fetchJwks(cfg) {
  const cached = await readJson(jwksKey(cfg.name));
  if (cached && Array.isArray(cached.keys) && cached.keys.length > 0) {
    return { ok: true, keys: cached.keys, cached: true };
  }
  let response;
  try {
    response = await fetch(cfg.jwksUrl, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(JWKS_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return { ok: false, code: 'auth-jwks-unreachable' };
  }
  if (!response || response.status !== 200) return { ok: false, code: 'auth-jwks-refused' };
  let payload = null;
  try { payload = await response.json(); } catch (e) { return { ok: false, code: 'auth-jwks-unreadable' }; }
  const keys = payload && Array.isArray(payload.keys) ? payload.keys : null;
  if (!keys || keys.length === 0) return { ok: false, code: 'auth-jwks-empty' };
  await writeJson(jwksKey(cfg.name), { keys }, JWKS_TTL_SECONDS);
  return { ok: true, keys, cached: false };
}

// ---------------------------------------------------------------------------
// THE VERIFICATION.
// ---------------------------------------------------------------------------

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * `email_verified` IS A BOOLEAN QUESTION AND IT IS ASKED STRICTLY.
 *
 * Google sends the JSON boolean; Apple sends the STRING "true". Both are yes. Everything else is
 * no -- and in particular the string "false" is NO, which is the whole point: a rule of the shape
 * "if it is a string, believe it" reads "false" as proof and hands the email index -- the one
 * seam that joins two providers into one account -- to an address nobody proved.
 */
export function isEmailVerified(v) {
  if (v === true) return true;
  if (v === 'true') return true;
  return false;
}

/**
 * Verify signature, issuer, audience, expiry and nonce -- in that order, all five required.
 * Returns { ok: true, claims: { sub, email, emailVerified } } or { ok: false, code }.
 *
 * `claims` carries THREE FIELDS AND NO MORE. Whatever else the provider chose to put in the
 * token -- a name, a picture, a locale, a hosted domain -- stops here and is never handed to the
 * account writer, because a field that is never carried cannot be accidentally stored.
 */
export function verifyIdToken(cfg, idToken, expected) {
  if (typeof idToken !== 'string') return { ok: false, code: 'auth-idtoken-malformed' };
  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, code: 'auth-idtoken-malformed' };

  let header;
  let claims;
  try {
    header = decodeSegment(parts[0]);
    claims = decodeSegment(parts[1]);
  } catch (e) { return { ok: false, code: 'auth-idtoken-malformed' }; }
  if (!header || typeof header !== 'object' || !claims || typeof claims !== 'object') {
    return { ok: false, code: 'auth-idtoken-malformed' };
  }

  // ONE ALGORITHM. `alg: none` and a switch that trusts the header are the two textbook ways a
  // JWT verifier is turned off by the token it is verifying.
  if (header.alg !== ALLOWED_ALG) return { ok: false, code: 'auth-idtoken-alg' };

  const keys = (expected && Array.isArray(expected.keys)) ? expected.keys : [];
  const candidates = header.kid
    ? keys.filter((k) => k && k.kid === header.kid)
    : keys.slice();
  if (candidates.length === 0) return { ok: false, code: 'auth-idtoken-unknown-key' };

  const signed = Buffer.from(parts[0] + '.' + parts[1], 'ascii');
  let signature;
  try { signature = Buffer.from(parts[2], 'base64url'); }
  catch (e) { return { ok: false, code: 'auth-idtoken-malformed' }; }

  let verified = false;
  for (const jwk of candidates) {
    try {
      const pub = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      if (crypto.verify('RSA-SHA256', signed, pub, signature)) { verified = true; break; }
    } catch (e) { /* a key that will not import is a key that did not sign this token */ }
  }
  if (!verified) return { ok: false, code: 'auth-idtoken-signature' };

  const issuers = Array.isArray(cfg.issuers) ? cfg.issuers : [];
  if (typeof claims.iss !== 'string' || !issuers.includes(claims.iss)) {
    return { ok: false, code: 'auth-idtoken-issuer' };
  }

  // `aud` may be a string or an array of strings; ours must be in it either way.
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(cfg.clientId)) return { ok: false, code: 'auth-idtoken-audience' };

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || !(claims.exp > now)) {
    return { ok: false, code: 'auth-idtoken-expired' };
  }

  // THE NONCE TIES THIS TOKEN TO THE START WE MINTED. Without it a token issued for a different
  // sign-in of the same reader -- replayed by anyone who obtained one -- verifies perfectly:
  // right signature, right issuer, right audience, unexpired, and completely unrelated to the
  // press that is being answered.
  if (typeof expected.nonce !== 'string' || expected.nonce.length === 0) {
    return { ok: false, code: 'auth-idtoken-nonce' };
  }
  if (claims.nonce !== expected.nonce) return { ok: false, code: 'auth-idtoken-nonce' };

  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  if (!sub) return { ok: false, code: 'auth-idtoken-no-subject' };

  const email = typeof claims.email === 'string' ? claims.email : '';
  return {
    ok: true,
    claims: { sub, email, emailVerified: isEmailVerified(claims.email_verified) },
  };
}
