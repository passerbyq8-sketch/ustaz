// api/sync.js
// POST /api/sync   { action, session, ... }   ->   JSON
//
// ITEM 24 -- ONE ROUTE FOR THE ACCOUNT'S SPACE. Six actions:
//
//   status   { session? }                 -> { ok, open }        is the switch open for this reader
//   pull     { session, cursor }          -> { ok, cursor, changes }
//   push     { session, changes }         -> { ok, results }      merged by lib/sync/merge.js
//   export   { session }                  -> the "download my data" file (attachment)
//   wipe     { session }                  -> { ok }               "delete all my data", server half
//   link     { session, otherSession }    -> { ok, moved }        "link your other account"
//
// THE SESSION IS THE IDENTITY, exactly as on api/auth-delete.js: nothing in the body names an
// account, a provider, a subject, an address or a space. A request reaches the space its own live
// session resolves to and no other. `link` needs TWO live sessions -- the proof of both sign-ins.
//
// BEHIND THE SWITCH (lib/sync/flag.js). Every action but `status` answers ONE refusal -- 403
// `sync-closed` -- to every account the switch is not open for, before any record is read. The
// `status` action answers { open:false } and nothing else to them.
//
// NOTHING IS LOGGED: no record id, no content, no session, no account. A failure prints its code.

import { applyCorsOrigin } from '../lib/ratelimit.js';
import { safeId, DEVICE_HEADER } from '../lib/daycap.js';
import { sessionState } from '../lib/auth/account.js';
import { syncOpenFor, syncSwitch } from '../lib/sync/flag.js';
import { PRIVACY_SYNC_HTML } from '../lib/sync/privacy-page.js';
import { envName } from '../lib/sync/store.js';
import { allowRequest } from '../lib/sync/store.js';
import { pull, push, exportAll, wipeAll, link, spaceFor, SyncError } from '../lib/sync/service.js';

export const SYNC_ACTIONS = Object.freeze(['status', 'pull', 'push', 'export', 'wipe', 'link']);
export const MAX_BODY_BYTES = 1024 * 1024;

let _deps = null;
/** Test seam: { allow(env, space) -> bool, now() }. Production passes nothing. */
export function __setSyncRouteDepsForTest(d) { _deps = d; }

// THE THREE STATES (third round). 'live' carries the account key; 'dead' is a 401 the device acts
// on (it signs itself out, quietly); 'unknown' -- no store, or a read that failed -- is a 503 and
// never a 401, because an outage must not sign anybody out. A malformed session is dead.
async function accountOf(session) {
  if (typeof session !== 'string' || session.length < 16 || session.length > 128) return { state: 'dead' };
  const st = await sessionState(session);
  if (st.state === 'live' && st.record && typeof st.record.accountKey === 'string') return { state: 'live', account: st.record.accountKey };
  return { state: st.state === 'unknown' ? 'unknown' : 'dead' };
}
const sent = (v) => typeof v === 'string' && v.length > 0;

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  // PHASE 4 -- THE NEW PRIVACY TEXT, readable while the switch is open for ANYBODY (owner or all).
  // SYNC FIX 5 (10 October): it was 'all' only, so the owner -- the one person the switch opens for
  // in production -- met a 404 from the link inside the app. With the switch off it does not exist
  // (404). The public privacy.html is not touched either way.
  if (req.method === 'GET' && req.query && req.query.page === 'privacy') {
    if (syncSwitch() === 'off') return res.status(404).json({ ok: false, error: 'not-found' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(PRIVACY_SYNC_HTML);
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  res.setHeader('Cache-Control', 'private, no-store');

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  let size = 0;
  try { size = Buffer.byteLength(JSON.stringify(body), 'utf8'); } catch (e) { size = Infinity; }
  if (size > MAX_BODY_BYTES) return res.status(413).json({ ok: false, error: 'sync-body-too-large' });

  const action = typeof body.action === 'string' ? body.action : '';
  if (!SYNC_ACTIONS.includes(action)) return res.status(400).json({ ok: false, error: 'sync-action' });

  try {
    if (action === 'status') {
      // No session sent: answered as before (the switch for a guest). A session sent and DEAD is a
      // 401, so the device learns it at once instead of caching "closed" for half an hour.
      if (!sent(body.session)) return res.status(200).json({ ok: true, open: await syncOpenFor(null) });
      const who = await accountOf(body.session);
      if (who.state === 'unknown') return res.status(503).json({ ok: false, error: 'sync-unavailable' });
      if (who.state === 'dead') return res.status(401).json({ ok: false, error: 'sync-session-invalid' });
      return res.status(200).json({ ok: true, open: await syncOpenFor(who.account) });
    }

    const device = safeId((req.headers || {})[DEVICE_HEADER]);
    if (!device) return res.status(400).json({ ok: false, error: 'sync-device-missing' });
    const who = await accountOf(body.session);
    if (who.state === 'unknown') return res.status(503).json({ ok: false, error: 'sync-unavailable' });
    if (who.state === 'dead') return res.status(401).json({ ok: false, error: 'sync-session-invalid' });
    const account = who.account;
    if (!(await syncOpenFor(account))) return res.status(403).json({ ok: false, error: 'sync-closed' });

    const env = envName();
    const space = await spaceFor(account);
    const allow = _deps && _deps.allow ? _deps.allow : allowRequest;
    if (!(await allow(env, space, Date.now()))) return res.status(429).json({ ok: false, error: 'sync-rate-limited' });

    if (action === 'pull') {
      const p = await pull(account, body.cursor);
      return res.status(200).json({ ok: true, cursor: p.cursor, changes: p.changes, bytes: p.bytes, quota: p.quota });
    }
    if (action === 'push') {
      const r = await push(account, body.changes);
      return res.status(200).json({ ok: true, results: r.results });
    }
    if (action === 'export') {
      const file = await exportAll(account);
      res.setHeader('Content-Disposition', 'attachment; filename="ezik-my-data.json"');
      return res.status(200).json(file);
    }
    if (action === 'wipe') {
      await wipeAll(account);
      return res.status(200).json({ ok: true });
    }
    // link
    const otherWho = await accountOf(body.otherSession);
    if (otherWho.state === 'unknown') return res.status(503).json({ ok: false, error: 'sync-unavailable' });
    if (otherWho.state === 'dead') return res.status(401).json({ ok: false, error: 'sync-other-session-invalid' });
    const other = otherWho.account;
    if (!(await syncOpenFor(other))) return res.status(403).json({ ok: false, error: 'sync-closed' });
    const l = await link(account, other);
    return res.status(200).json({ ok: true, moved: l.moved, already: !!l.already });
  } catch (e) {
    if (e instanceof SyncError) return res.status(e.status).json({ ok: false, error: e.code });
    console.warn('[sync] refused:', e && e.message ? String(e.message).slice(0, 60) : 'error');
    return res.status(503).json({ ok: false, error: 'sync-unavailable' });
  }
}
