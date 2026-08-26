// api/auth-return.js
// GET /api/auth-return?code=...&state=...   -- the redirect_uri registered with the provider.
//
// THE PROVIDER'S CODE STOPS HERE. It is exchanged on this server, against our client secret,
// and what continues to the device is a TICKET: 32 random bytes naming a record that lives sixty
// seconds and is spent once. So the authorization code -- the thing that is worth stealing --
// never enters the phone, never enters the app, and never appears in a URL the operating system,
// another app or a screenshot could see. The device receives a value that is useless anywhere
// except at api/auth-exchange.js, from the device that started the flow, within a minute.
//
// AND THE SHELL DOES NOT CARE WHICH PARAMETER IT IS. murabbi-shell/AUTH-CONTRACT.md is explicit
// that the shell is a pipe: it returns the URL "as it arrived, without parsing, truncating or
// logging", and its own proof asserts that `ezik://auth/return?a=1` comes back byte for byte.
// The `?code=...` in the contract's example is an example; the web half reads it, not the shell.
//
// 🔴 THE AI-CONSENT GATE IS DELIBERATELY NOT APPLIED HERE. This request is issued by GOOGLE (or
// Apple), not by our page. It carries no `x-ezik-ai-consent` and could not be made to. Guarding
// it would 403 every sign-in at the moment of return, after the reader had already consented at
// the provider. And nothing on this path reaches an AI vendor.
//
// 🔴 EVERY EXIT IS A REDIRECT TO ezik://auth/return. Including the failures. The shell's auth
// session resolves ONLY when it sees that URL; an error page here leaves the reader staring at
// a browser sheet until they close it, which the contract then reports as `dismissed` -- a
// silent, unattributable failure. So a refusal travels as `?error=<code>&state=<state>` and the
// page can say what happened. The codes are short fixed strings and never carry a value.

import crypto from 'node:crypto';

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import {
  providerConfig,
  exchangeCode,
  fetchJwks,
  verifyIdToken,
} from '../lib/auth/oidc.js';
import {
  stateKey,
  ticketKey,
  takeOnce,
  writeJson,
  TICKET_TTL_SECONDS,
} from '../lib/auth/store.js';
import { upsertAccount, indexVerifiedEmail } from '../lib/auth/account.js';

// The ticket is OURS, not the protocol's, so it is minted here rather than in lib/auth/oidc.js.
// Same source of randomness as everything else on this path: node:crypto, never Math.random.
function randomTicket() { return crypto.randomBytes(32).toString('base64url'); }

/** The one destination, built from the shell's scheme. Everything leaves through here. */
export const APP_RETURN_URL = 'ezik://auth/return';

export const TICKET_RECORD_VERSION = 1;

function scalar(v) { return Array.isArray(v) ? v[0] : v; }

/**
 * 302 to the app. `state` rides along on BOTH branches so the page can match the answer to the
 * press it made -- exactly as the contract requires the web half to do -- and a failure carries
 * a code and never a value.
 */
function toApp(res, params) {
  const u = new URL(APP_RETURN_URL);
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.length > 0) u.searchParams.set(k, v);
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Location', u.toString());
  return res.status(302).end();
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED. This is the leg that spends OUR credentials at the provider; see the note on
  // AUTH_FAIL_OPEN in lib/ratelimit.js for why this family is the one that refuses.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });

  const query = (req.query && typeof req.query === 'object') ? req.query : {};
  const state = typeof scalar(query.state) === 'string' ? scalar(query.state) : '';
  const code = typeof scalar(query.code) === 'string' ? scalar(query.code) : '';

  if (!state) return toApp(res, { error: 'auth-state-missing' });

  // The reader pressed "cancel" at the provider, or the provider refused. Its `error` value is
  // NOT echoed -- it is provider-controlled text arriving in a URL we are about to build.
  if (typeof scalar(query.error) === 'string' && scalar(query.error).length > 0) {
    return toApp(res, { error: 'auth-provider-denied', state });
  }

  // CONSUMED ONCE, ATOMICALLY. A replay of this exact URL finds nothing: the read and the delete
  // are one script (lib/auth/store.js TAKE_ONCE_SCRIPT), so two simultaneous deliveries cannot
  // both see the record. An expired state is the same answer as a spent one.
  const record = await takeOnce(stateKey(state));
  if (!record || typeof record !== 'object') return toApp(res, { error: 'auth-state-invalid', state });
  if (!code) return toApp(res, { error: 'auth-code-missing', state });

  const conf = providerConfig(record.provider, process.env);
  if (!conf.ok) return toApp(res, { error: conf.code, state });
  const cfg = conf.cfg;

  // THE EXCHANGE. The verifier comes out of the state record -- it never travelled with the
  // reader -- and the client secret never leaves this process.
  const exchanged = await exchangeCode(cfg, { code, codeVerifier: record.codeVerifier });
  if (!exchanged.ok) return toApp(res, { error: exchanged.code, state });

  const jwks = await fetchJwks(cfg);
  if (!jwks.ok) return toApp(res, { error: jwks.code, state });

  // Signature, issuer, audience, expiry, nonce. The nonce is the one that ties this token to
  // the start WE minted; without it any valid token for this client would be accepted here.
  const verified = verifyIdToken(cfg, exchanged.idToken, { keys: jwks.keys, nonce: record.nonce });
  if (!verified.ok) return toApp(res, { error: verified.code, state });

  const claims = verified.claims;

  // FIVE FIELDS. `sub`, `email` and `emailVerified` are all that crosses from the token into the
  // record; `provider` and `v` are ours. Nothing else the provider sent is carried this far.
  const account = await upsertAccount({
    provider: cfg.name,
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.emailVerified,
  });
  if (!account.ok) return toApp(res, { error: account.code, state });

  // The seam between two providers, and it opens on a PROVED address only. An unverified sign-in
  // reaches this line and writes nothing -- it still has its own account.
  await indexVerifiedEmail(claims.email, claims.emailVerified, account.key);

  // THE TICKET. Sixty seconds, spent once, bound to the device the flow started on.
  const ticket = randomTicket();
  const written = await writeJson(ticketKey(ticket), {
    v: TICKET_RECORD_VERSION,
    accountKey: account.key,
    deviceId: typeof record.deviceId === 'string' ? record.deviceId : '',
    createdAt: Date.now(),
  }, TICKET_TTL_SECONDS);
  if (!written) return toApp(res, { error: 'auth-store-unavailable', state });

  return toApp(res, { ticket, state });
}
