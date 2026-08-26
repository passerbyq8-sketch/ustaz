// api/auth-start.js
// GET /api/auth-start?provider=google&device=<deviceId>&cs=<clientState>
//
// THE FIRST OF THE THREE, AND THE REASON THE OTHER TWO CAN EXIST. The shell's contract
// (murabbi-shell/AUTH-CONTRACT.md) refuses to open any URL that is not `https` on `ezik.app` or
// `www.ezik.app`, matched on the whole host -- so the page CANNOT hand Google's URL to the
// shell. It hands it THIS one, and this one redirects. That single rule in the shell is what
// forces a server endpoint to exist at all.
//
// WHAT IT DOES: mints `state`, `nonce` and a PKCE verifier, writes them to the store for ten
// minutes under auth:state:v1:<state>, and 302s to the provider. The file IS the route -- Vercel
// routes by filename and vercel.json carries no route table; the GET precedent beside it is
// api/fatwa-proxy.js.
//
// 🔴 THE AI-CONSENT GATE IS DELIBERATELY NOT APPLIED HERE, AND THAT IS NOT AN OVERSIGHT.
// lib/ai-consent.js returns 403 before anything else when `x-ezik-ai-consent` is missing. Two
// reasons it must not guard this route: a top-level browser navigation CANNOT carry a custom
// header at all, so the gate would refuse every sign-in unconditionally; and signing in sends a
// reader's data to no AI vendor -- it reaches Google or Apple, which is what the consent screen
// is not about. Guarding this route would make it impossible to sign in, forever, silently.
//
// 🔴 THE PKCE VERIFIER GOES INTO THE STORE AND NOWHERE ELSE. It is not in the redirect, not in
// a cookie, not handed to the app. See lib/auth/oidc.js.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { safeId, DEVICE_HEADER } from '../lib/daycap.js';
import {
  providerConfig,
  buildAuthorizeUrl,
  newState,
  newNonce,
  newVerifier,
  challengeFor,
} from '../lib/auth/oidc.js';
import { stateKey, writeJson, STATE_TTL_SECONDS } from '../lib/auth/store.js';

export const STATE_RECORD_VERSION = 1;

/**
 * THE DEVICE THE FLOW STARTED ON, READ FROM THE HEADER WHEN THERE IS ONE.
 *
 * ⚠️ AND WHY THERE ISN'T ONE HERE. This route is reached by a TOP-LEVEL NAVIGATION inside the
 * shell's auth session -- `openAuthSessionAsync` opens a URL, it does not issue a fetch -- so
 * `x-murabbi-device` cannot arrive on this leg no matter who wants it to. The page that built
 * the start URL knows its own device id, so it puts it in the query, and the header is still
 * read first for any caller that can send one.
 *
 * THE BINDING IS ENFORCED WHERE IT WAS ORDERED TO BE: api/auth-exchange.js is a fetch from the
 * page, always carries `x-murabbi-device`, and REFUSES a ticket whose device does not match the
 * one recorded here. So a state started on one device cannot be redeemed on another, which is
 * the property; the query on this leg is only how the value gets in.
 */
/**
 * THE PAGE'S OWN STATE, CARRIED THROUGH UNREAD AND HANDED BACK BY api/auth-return.js AS `state`.
 *
 * There are two states on this path and they are not the same thing. Ours travels to the provider
 * and back and is what api/auth-return.js consumes; the page never sees it and so cannot match it.
 * THIS one is minted by the page for the press the reader just made, kept in memory there and
 * never stored, and it is what lets the page refuse an answer belonging to a different press.
 *
 * It is never interpreted here. Its SHAPE is judged and nothing else -- an opaque token this
 * server hands back exactly as it arrived, or an empty string. Judging the shape is not
 * interpretation: it stops an over-long or exotic value from riding into a URL we build.
 */
function pageState(req) {
  const q = (req && req.query) || {};
  const raw = Array.isArray(q.cs) ? q.cs[0] : q.cs;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) return '';
  return /^[A-Za-z0-9_-]+$/.test(raw) ? raw : '';
}

function startDevice(req) {
  const headers = (req && req.headers) || {};
  const fromHeader = safeId(headers[DEVICE_HEADER]);
  if (fromHeader) return fromHeader;
  const q = (req && req.query) || {};
  const raw = Array.isArray(q.device) ? q.device[0] : q.device;
  return safeId(raw);
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED -- a start we cannot count is a start we do not make. See lib/ratelimit.js.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });

  const query = (req.query && typeof req.query === 'object') ? req.query : {};
  const providerName = Array.isArray(query.provider) ? query.provider[0] : query.provider;

  // A provider with no credentials on the board is a NAMED 503, not a crash and not a 500. The
  // body says which provider and never which variable, still less what was in it.
  const conf = providerConfig(providerName, process.env);
  if (!conf.ok) {
    return res.status(conf.status).json({ ok: false, error: conf.code, provider: conf.provider });
  }
  const cfg = conf.cfg;

  const state = newState();
  const nonce = newNonce();
  const codeVerifier = newVerifier();

  const written = await writeJson(stateKey(state), {
    v: STATE_RECORD_VERSION,
    provider: cfg.name,
    nonce,
    codeVerifier,
    deviceId: startDevice(req) || '',
    clientState: pageState(req),
    createdAt: Date.now(),
  }, STATE_TTL_SECONDS);

  // A store we cannot write is a sign-in we cannot finish: the return leg would find no state,
  // no nonce and no verifier. Refuse HERE, before the reader is sent to a provider for nothing.
  if (!written) return res.status(503).json({ ok: false, error: 'auth-store-unavailable' });

  const target = buildAuthorizeUrl(cfg, {
    state,
    nonce,
    codeChallenge: challengeFor(codeVerifier),
  });

  // No-store: this response carries a URL bearing the state, and a cache that kept it would
  // serve one reader's in-flight sign-in to the next.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Location', target);
  return res.status(302).end();
}

