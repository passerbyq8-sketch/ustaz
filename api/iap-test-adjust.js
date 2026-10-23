import { applyCorsOrigin } from '../lib/ratelimit.js';
import { sessionState } from '../lib/auth/account.js';
import {
  iapEnforcementMode,
  isIapEnforced,
  readBalance,
  testAdjustBalance,
} from '../lib/iap/store.js';

const SESSION_HEADER = 'x-ezik-session';
const ALLOWED_FIELDS = new Set(['trialDays', 'clearTrial', 'credits']);

function bodyOf(req) {
  if (typeof req.body === 'string') {
    try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
    catch { return {}; }
  }
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
}

export async function handleIapTestAdjust(req, res, dependencies = {}) {
  const getSessionState = dependencies.sessionState || sessionState;
  const mode = dependencies.iapEnforcementMode || iapEnforcementMode;
  const enforced = dependencies.isIapEnforced || isIapEnforced;
  const adjust = dependencies.testAdjustBalance || testAdjustBalance;
  const read = dependencies.readBalance || readBalance;
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + SESSION_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  res.setHeader('Cache-Control', 'private, no-store');
  if (mode() !== 'test') return res.status(403).json({ ok: false, error: 'iap-test-adjust-forbidden' });

  const session = typeof (req.headers || {})[SESSION_HEADER] === 'string'
    ? req.headers[SESSION_HEADER] : '';
  if (session.length < 16 || session.length > 128) {
    return res.status(403).json({ ok: false, error: 'iap-test-adjust-forbidden' });
  }
  const state = await getSessionState(session);
  if (state.state === 'unknown') return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  if (state.state !== 'live' || !state.record || typeof state.record.accountKey !== 'string'
    || !enforced(state.record.accountKey)) {
    return res.status(403).json({ ok: false, error: 'iap-test-adjust-forbidden' });
  }

  const body = bodyOf(req);
  const keys = Object.keys(body);
  const hasTrialDays = Object.prototype.hasOwnProperty.call(body, 'trialDays');
  const hasClearTrial = Object.prototype.hasOwnProperty.call(body, 'clearTrial');
  const hasCredits = Object.prototype.hasOwnProperty.call(body, 'credits');
  if (keys.some((key) => !ALLOWED_FIELDS.has(key))
    || hasTrialDays && hasClearTrial
    || hasClearTrial && body.clearTrial !== true
    || hasTrialDays && (!Number.isInteger(body.trialDays) || body.trialDays < 0 || body.trialDays > 8)
    || hasCredits && (!Number.isInteger(body.credits) || body.credits < 0 || body.credits > 20)
    || !hasTrialDays && !hasClearTrial && !hasCredits) {
    return res.status(400).json({ ok: false, error: 'iap-test-adjust-shape' });
  }

  const accountKey = state.record.accountKey;
  try {
    const adjusted = await adjust(accountKey, {
      ...(hasTrialDays ? { trialDays: body.trialDays } : {}),
      ...(hasClearTrial ? { clearTrial: true } : {}),
      ...(hasCredits ? { credits: body.credits } : {}),
    });
    if (!adjusted || adjusted.ok !== true) return res.status(400).json({ ok: false, error: adjusted && adjusted.code || 'iap-test-adjust-shape' });
    const balance = await read(accountKey);
    return res.status(200).json({ ok: true, credits: balance.credits, trial: balance.trial });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  }
}

export default async function handler(req, res) {
  return handleIapTestAdjust(req, res);
}
