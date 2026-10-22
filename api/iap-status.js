import { applyCorsOrigin } from '../lib/ratelimit.js';
import { iapEnforcementMode } from '../lib/iap/store.js';

export default function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
  return res.status(200).json({ mode: iapEnforcementMode() });
}
