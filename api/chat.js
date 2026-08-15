// Retired voice relay. All user-visible conversation traffic is served by /api/ask.
// Keep this file as an explicit tombstone so stale or direct clients fail closed instead
// of reviving the old model-only religious-answer path.
import { applyCorsOrigin } from '../lib/ratelimit.js';
import { guardAIConsent, AI_CONSENT_ALLOW_HEADERS } from '../lib/ai-consent.js';

export const RETIRED_CHAT_REPLACEMENT = '/api/ask';

export default function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, x-murabbi-device, x-murabbi-founder, ' + AI_CONSENT_ALLOW_HEADERS);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });
  if (!guardAIConsent(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'endpoint retired',
    replacement: RETIRED_CHAT_REPLACEMENT,
  });
}
