// Public rollout policy only. No account, provider, Redis or auth-quota work.
// A successful challenge is not discovery: opt-in challenges also exist OFF.
import { applyCorsOrigin } from '../lib/ratelimit.js';
import { proofRequired } from '../lib/auth/proof.js';

export default function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  return res.status(200).json({ ok: true, proofVersion: proofRequired() ? 1 : 0 });
}
