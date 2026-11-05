// POST /api/auth-delete { session }. Session/account/generation comparisons are
// atomic. Existing valid sessions keep their 400-day sliding lifetime. Unknown
// storage state returns 503 and never tells a signed-in reader to sign out.
// Sync erasure completes first; account, matching email index, stored grant and
// caller session are then erased together with a persistent generation rotation.
// Other sessions cannot survive deletion or same-subject recreation. Financial
// records, device data and parental locks keep their existing retention policies.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { safeId, DEVICE_HEADER } from '../lib/daycap.js';
import { requireReauthentication } from '../lib/auth/reauth.js';
import { sendProofFailure } from '../lib/auth/proof.js';
import { sessionState, deleteAccount } from '../lib/auth/account.js';
// ITEM 24 -- DELETING THE ACCOUNT ERASES ITS SYNCED DATA WITH IT, immediately (owner decision 4).
// The account's sync space and every link into it are erased BEFORE the account record, so a
// store that refuses leaves the account standing and a retry still finishes the job. This runs
// whatever the switch says: data written while the switch was open must not outlive a delete
// made after it was closed. An account that never synced has an empty space and loses nothing.
import { eraseForAccountDelete } from '../lib/sync/service.js';

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED -- see lib/ratelimit.js. A delete we cannot count is one we do not make.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const session = typeof body.session === 'string' ? body.session : '';
  if (!session) return res.status(400).json({ ok: false, error: 'auth-session-missing' });

  const device = safeId((req.headers || {})[DEVICE_HEADER]);
  if (!device) return res.status(400).json({ ok: false, error: 'auth-device-missing' });

  // Identity comes only from the live session.
  const state = await sessionState(session);
  if (state.state === 'unknown') return res.status(503).json({ ok: false, error: 'auth-unavailable' });
  const record = state.state === 'live' ? state.record : null;
  if (!record || typeof record.accountKey !== 'string') {
    // Only a confirmed dead session is a sign-in refusal.
    return res.status(401).json({ ok: false, error: 'auth-session-invalid' });
  }

  const proved = await requireReauthentication(body, 'account-delete');
  if (!proved.ok) return sendProofFailure(res, proved);

  try { await eraseForAccountDelete(record.accountKey); }
  catch (e) { return res.status(503).json({ ok: false, error: 'auth-delete-sync' }); }

  const done = await deleteAccount(record.accountKey, session);
  if (!done.ok) {
    // A lifecycle race can make the session dead after the first check.
    if (done.code === 'auth-session-invalid') {
      return res.status(401).json({ ok: false, error: 'auth-session-invalid' });
    }
    // Everything else is a store that refused a delete. Named, and never dressed as a success.
    return res.status(503).json({ ok: false, error: done.code });
  }

  // ONE FIELD. Which of the three keys were removed is not reported: whether an index entry
  // existed is a fact about whether this address was proved and shared with another provider,
  // and that is not something a response body needs to carry.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ ok: true });
}
