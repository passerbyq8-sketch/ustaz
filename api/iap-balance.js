import { applyCorsOrigin } from '../lib/ratelimit.js';
import { sessionState } from '../lib/auth/account.js';
import { isIapEnforced, readBalance } from '../lib/iap/store.js';

const SESSION_HEADER = 'x-ezik-session';

export async function handleIapBalance(req, res, dependencies = {}) {
  const getSessionState = dependencies.sessionState || sessionState;
  const read = dependencies.readBalance || readBalance;
  const enforced = dependencies.isIapEnforced || isIapEnforced;
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', SESSION_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  res.setHeader('Cache-Control', 'private, no-store');

  const session = typeof (req.headers || {})[SESSION_HEADER] === 'string'
    ? req.headers[SESSION_HEADER] : '';
  if (session.length < 16 || session.length > 128) {
    return res.status(401).json({ ok: false, error: 'iap-session-required' });
  }

  const state = await getSessionState(session);
  if (state.state === 'unknown') return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  if (state.state !== 'live' || !state.record || typeof state.record.accountKey !== 'string') {
    return res.status(401).json({ ok: false, error: 'iap-session-invalid' });
  }

  try {
    const balance = await read(state.record.accountKey);
    return res.status(200).json({
      ...balance,
      appUserId: state.record.accountKey,
      enforced: enforced(state.record.accountKey),
    });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  }
}

export default async function handler(req, res) {
  return handleIapBalance(req, res);
}
