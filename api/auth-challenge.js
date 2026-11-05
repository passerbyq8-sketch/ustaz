// POST: fetch before opening the provider. Keep proof on the initiating client.
// This route sends no data to an AI vendor and does not use the AI-consent gate.
import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { prepareReauthentication } from '../lib/auth/reauth.js';
import { isProviderName, PROVIDERS } from '../lib/auth/oidc.js';
import { issueChallenge, sendProofFailure, PROOF_VERSION } from '../lib/auth/proof.js';

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  const limit = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (body.proofVersion !== PROOF_VERSION || !isProviderName(body.provider)
    || !['redirect', 'native'].includes(body.transport)
    || body.purpose !== undefined && !['signin', 'reauth'].includes(body.purpose)
    || body.transport === 'native' && PROVIDERS[body.provider].nativeAudiences.length === 0) {
    return res.status(400).json({ ok: false, error: 'auth-challenge-body' });
  }
  let context = {};
  if (body.purpose === 'reauth') {
    const prepared = await prepareReauthentication(body);
    if (!prepared.ok) return sendProofFailure(res, prepared);
    context = prepared.context;
  }
  const result = await issueChallenge(body.provider, body.transport, context);
  if (!result.ok) return sendProofFailure(res, result);
  return res.status(200).json(result);
}
