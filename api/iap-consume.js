import { applyCorsOrigin } from '../lib/ratelimit.js';
import { sessionState } from '../lib/auth/account.js';
import { consumeSession, IAP_SESSION_ID_RE } from '../lib/iap/store.js';

const SESSION_HEADER = 'x-ezik-session';

function bodyOf(req) {
  if (typeof req.body === 'string') {
    try { const parsed = JSON.parse(req.body); return (parsed && typeof parsed === 'object') ? parsed : {}; }
    catch { return {}; }
  }
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
}

export default async function handler(req, res) {
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
  const state = await sessionState(session);
  if (state.state === 'unknown') return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  if (state.state !== 'live' || !state.record || typeof state.record.accountKey !== 'string') {
    return res.status(401).json({ ok: false, error: 'iap-session-invalid' });
  }

  const body = bodyOf(req);
  if (typeof body.sessionId !== 'string' || !IAP_SESSION_ID_RE.test(body.sessionId)) {
    return res.status(400).json({ ok: false, error: 'iap-session-id' });
  }
  try {
    const result = await consumeSession(state.record.accountKey, body.sessionId);
    if (!result.ok && result.code === 'iap-no-credit') {
      return res.status(402).json({ ok: false, error: 'iap-no-credit' });
    }
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  }
}
