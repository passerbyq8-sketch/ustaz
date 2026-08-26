// api/auth-exchange.js
// POST /api/auth-exchange   { ticket }   ->   { ok, session, email, provider }
//
// THE LAST LEG, AND THE ONE THE DEVICE ACTUALLY CALLS. api/auth-return.js already did the work
// against the provider; this turns the sixty-second ticket it left behind into a ninety-day
// session. Four fields come back AND NO FIFTH: the session key, the address, and which door was
// used. No name, no picture, no id_token, no claim the provider happened to include -- none of
// it was carried this far, so none of it can be returned by accident.
//
// 🔴 THE DEVICE BINDING IS ENFORCED HERE. `x-murabbi-device` is read from THIS request -- a
// fetch from our own page, which always carries it -- and compared with the device recorded when
// the flow started. A ticket lifted out of a redirect and replayed from somewhere else is
// refused even inside its sixty seconds. This is the leg the binding was specified for, because
// it is the only one of the three that can carry a header at all.
//
// 🔴 THE AI-CONSENT GATE IS DELIBERATELY NOT APPLIED HERE. lib/ai-consent.js 403s before
// anything else, and the reader may well not have reached the consent screen yet -- sign-in
// comes first in the app. Guarding this route would make consent a prerequisite for signing in
// and signing in a prerequisite for consent. Nothing here reaches an AI vendor: the exchange is
// a store read and a store write.
//
// THE SESSION IS AN OPAQUE STORE KEY, NOT A SIGNED TOKEN -- no new secret, and revocation is a
// delete. FOUNDER_SECRET is not reused for it; see lib/auth/account.js.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { safeId, DEVICE_HEADER } from '../lib/daycap.js';
import { ticketKey, takeOnce, readJson } from '../lib/auth/store.js';
import { mintSession } from '../lib/auth/account.js';

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED -- see lib/ratelimit.js. An exchange we cannot count is one we do not make.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const ticket = typeof body.ticket === 'string' ? body.ticket : '';
  if (!ticket) return res.status(400).json({ ok: false, error: 'auth-ticket-missing' });

  // CONSUMED ONCE, ATOMICALLY, AND BEFORE ANY OTHER CHECK. Reading it first and deleting it
  // later would leave a window a second caller could ride through; and consuming it even when
  // the device turns out to be wrong is deliberate -- a ticket someone else tried to spend is
  // burnt, not left lying there for them to try again with a better guess.
  const record = await takeOnce(ticketKey(ticket));
  if (!record || typeof record !== 'object' || typeof record.accountKey !== 'string') {
    // Absent, already spent, expired, or a store we could not read. One answer for all four:
    // telling them apart would tell a caller which of their guesses was closest.
    return res.status(400).json({ ok: false, error: 'auth-ticket-invalid' });
  }

  const device = safeId((req.headers || {})[DEVICE_HEADER]);
  const startedOn = typeof record.deviceId === 'string' ? record.deviceId : '';
  if (startedOn && device !== startedOn) {
    return res.status(403).json({ ok: false, error: 'auth-device-mismatch' });
  }

  const account = await readJson(record.accountKey);
  if (!account || typeof account !== 'object') {
    return res.status(503).json({ ok: false, error: 'auth-account-unreadable' });
  }

  const minted = await mintSession(record.accountKey);
  if (!minted.ok) return res.status(503).json({ ok: false, error: minted.code });

  // FOUR FIELDS. Named one at a time -- the account record is never spread into the response,
  // so a field added to it later cannot arrive here on its own.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    ok: true,
    session: minted.session,
    email: typeof account.email === 'string' ? account.email : '',
    provider: typeof account.provider === 'string' ? account.provider : '',
  });
}
