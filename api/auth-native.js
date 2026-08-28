// api/auth-native.js
// POST /api/auth-native   { provider, identityToken, rawNonce }   ->   { ok, session, email, provider }
//
// THE DOOR FOR A TOKEN THE DEVICE ALREADY HOLDS, and the reason it exists is not architectural.
// The web door (api/auth-start.js -> api/auth-return.js -> api/auth-exchange.js) sends the reader
// out to the provider through a Services ID whose domain binding CANNOT BE SAVED in the provider's
// own console: the field does not accept the press, so the provider shows a null application name
// and then refuses the exchange. That door is untouched and is still the whole of the web flow --
// it starts working again the day the console does. This one is BESIDE it, not instead of it.
//
// WHAT CHANGES, AND IT IS ONLY THE FIRST THREE LINES OF THE FLOW. The native sheet on the device
// obtains the identity token itself, from the app's own bundle identifier, without a Services ID
// or a redirect anywhere in it. So there is no authorization code to exchange, no client secret to
// spend, no PKCE verifier to hold and no state to consume -- the request arrives already carrying
// the only thing the web flow was walking three legs to obtain. Everything AFTER the token is the
// same code: the same key fetch, the same verifier, the same account writer, the same email seam
// and the same session minter that api/auth-exchange.js calls.
//
// 🔑 THE NONCE IS COMPARED RAW. Apple returns the `nonce` claim EXACTLY as the app handed it to
// the native sheet -- verbatim, never hashed. Hashing is the Firebase convention, in which the
// CLIENT hashes before the request and posts the raw value to its own server; Apple is no party
// to it. So the raw value the app chose arrives in the body and IS the comparand -- the token's
// claim is compared with the string the caller sent. A token whose claim is absent fails that
// comparison like any other mismatch, which is why the absent case needs no branch of its own.
//
// 🔴 THE SESSION IS MINTED, NOT A TICKET. The web path hands the device a sixty-second ticket
// because its middle leg is a REDIRECT -- the value has to survive a trip through the operating
// system's browser, where a session would be readable. Nothing on this path travels through
// anything: the device posted here itself, over TLS, and reads the answer itself. So the answer is
// the session, in the shape api/auth-exchange.js returns it, minted by the same mintSession().
//
// 🔴 THE AI-CONSENT GATE IS DELIBERATELY NOT APPLIED HERE, for the reason recorded on the other
// three legs: sign-in comes before the consent screen in the app, so guarding this route would
// make consent a prerequisite for signing in and signing in a prerequisite for consent. Nothing
// on this path reaches an AI vendor -- it is one public key fetch and three store operations.
//
// ZERO SECRETS AND ZERO READER TEXT LEAVE THIS FILE. No token, no nonce, no address and no subject
// is written to a console line or returned in a field. Every refusal is one short fixed code from
// the same vocabulary the web path already uses, and never carries a value.

import crypto from 'node:crypto';

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { nativeConfig, fetchJwks, verifyIdToken } from '../lib/auth/oidc.js';
import { upsertAccount, indexVerifiedEmail, mintSession } from '../lib/auth/account.js';

/**
 * THE THREE FIELDS ARE BOUNDED BEFORE THEY ARE USED.
 *
 * An identity token is under a kilobyte and a nonce is a few dozen characters; a megabyte of
 * either is not a sign-in, it is a bill. The ceilings are generous multiples of the real values
 * rather than tight fits, so a provider that lengthens its token does not close the door.
 */
export const MAX_TOKEN_CHARS = 8192;
export const MIN_NONCE_CHARS = 16;
export const MAX_NONCE_CHARS = 512;

/**
 * The body, however the platform delivered it. It arrives parsed for a JSON content type, but a
 * raw string is handled rather than assumed away -- a route that only works when something
 * upstream happened to parse for it is a route with an undeclared dependency.
 */
function bodyOf(req) {
  const body = req.body;
  if (typeof body === 'string') {
    try { const parsed = JSON.parse(body); return (parsed && typeof parsed === 'object') ? parsed : {}; }
    catch (e) { return {}; }
  }
  return (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
}

/** A field is the field only when it is a string of a sane length. */
function bounded(v, min, max) {
  return typeof v === 'string' && v.length >= min && v.length <= max ? v : '';
}

/**
 * KEPT FOR A COMING HARDENING, AND NOT ON THE COMPARISON PATH: sha256 of a nonce, hexadecimal.
 *
 * The day the shell hashes the nonce before `signInAsync` and posts the raw value beside it, the
 * comparison below returns to a digest and this is the function it returns to. Lower case and
 * unpadded, which is what `digest('hex')` produces. Exported because the probe imports it.
 */
export function nonceDigest(rawNonce) {
  return crypto.createHash('sha256').update(String(rawNonce), 'utf8').digest('hex');
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED, like the other three legs -- see the note on AUTH_FAIL_OPEN in lib/ratelimit.js.
  // A sign-in we cannot count is a sign-in we do not make.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });

  const body = bodyOf(req);
  const identityToken = bounded(body.identityToken, 1, MAX_TOKEN_CHARS);
  const rawNonce = bounded(body.rawNonce, MIN_NONCE_CHARS, MAX_NONCE_CHARS);
  // A MALFORMED REQUEST IS A 400, NOT A 401. 401 means "this credential was refused"; a body with
  // a field missing carries no credential to refuse, and telling the caller apart from a rejected
  // reader is what lets the shell distinguish its own bug from a reader's failed sign-in.
  if (!identityToken || !rawNonce) return res.status(400).json({ ok: false, error: 'auth-native-body' });

  // The provider name is DATA looked up in the table, never a literal compared here. A provider
  // with no native audience of its own is refused by name inside nativeConfig().
  const conf = nativeConfig(body.provider, process.env);
  if (!conf.ok) return res.status(conf.status).json({ ok: false, error: conf.code });
  const cfg = conf.cfg;

  // The provider's public keys -- the one outbound request on this path, and cached six hours in
  // the store by the same helper the web path uses. A key endpoint we cannot reach is an outage,
  // so it is a 503: refusing it as 401 would tell a reader holding a perfectly good token that
  // their credential was rejected, and the app would sign them out rather than retry.
  const jwks = await fetchJwks(cfg);
  if (!jwks.ok) return res.status(503).json({ ok: false, error: jwks.code });

  // SIGNATURE, ISSUER, AUDIENCE, EXPIRY, ISSUED-AT, NONCE -- in that order, all of them required,
  // and every one of them inside the SAME verifier the web path is measured on. The nonce goes in
  // exactly as the body carried it, because that is the value the provider put in the claim.
  const verified = verifyIdToken(cfg, identityToken, {
    keys: jwks.keys,
    nonce: rawNonce,
  });
  if (!verified.ok) return res.status(401).json({ ok: false, error: verified.code });

  const claims = verified.claims;

  // THE SAME ACCOUNT WRITER, WITH THE SAME FOUR FIELDS. `sub` is the stable identifier and is
  // enough on its own: a reader who hid their address has an account keyed by subject like anyone
  // else, and simply does not get the email seam below.
  const account = await upsertAccount({
    provider: cfg.name,
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.emailVerified,
  });
  if (!account.ok) return res.status(503).json({ ok: false, error: account.code });

  // THE SEAM BETWEEN TWO PROVIDERS, AND THE SAME ONE -- not a second rule that happens to agree.
  // It opens on a PROVED address only, and the proving is inside the function, not at this line.
  await indexVerifiedEmail(claims.email, claims.emailVerified, account.key);

  const minted = await mintSession(account.key);
  if (!minted.ok) return res.status(503).json({ ok: false, error: minted.code });

  // FOUR FIELDS, THE SAME FOUR api/auth-exchange.js RETURNS, named one at a time so a field added
  // to the account record later cannot arrive here on its own.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    ok: true,
    session: minted.session,
    email: typeof account.record.email === 'string' ? account.record.email : '',
    provider: typeof account.record.provider === 'string' ? account.record.provider : '',
  });
}
