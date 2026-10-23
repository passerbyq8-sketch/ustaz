import { applyCorsOrigin } from '../lib/ratelimit.js';
import { sessionState } from '../lib/auth/account.js';
import { isIapEnforced, readBalance, startTrial } from '../lib/iap/store.js';

const SESSION_HEADER = 'x-ezik-session';

export async function handleIapTrialStart(req, res, dependencies = {}) {
  const getSessionState = dependencies.sessionState || sessionState;
  const start = dependencies.startTrial || startTrial;
  const read = dependencies.readBalance || readBalance;
  const enforced = dependencies.isIapEnforced || isIapEnforced;
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + SESSION_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
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

  const accountKey = state.record.accountKey;
  if (!enforced(accountKey)) return res.status(200).json({ ok: true, enforced: false, trial: null });
  try {
    const result = await start(accountKey);
    const balance = await read(accountKey);
    return res.status(200).json({ ok: true, enforced: true, created: result.created === true, trial: balance.trial });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  }
}

export default async function handler(req, res) {
  return handleIapTrialStart(req, res);
}
