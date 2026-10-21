import { applyCorsOrigin } from '../lib/ratelimit.js';
import { sessionState } from '../lib/auth/account.js';
import { readBalance } from '../lib/iap/store.js';

const SESSION_HEADER = 'x-ezik-session';

export default async function handler(req, res) {
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

  const state = await sessionState(session);
  if (state.state === 'unknown') return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  if (state.state !== 'live' || !state.record || typeof state.record.accountKey !== 'string') {
    return res.status(401).json({ ok: false, error: 'iap-session-invalid' });
  }

  try {
    const balance = await readBalance(state.record.accountKey);
    return res.status(200).json({ ...balance, appUserId: state.record.accountKey });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  }
}
