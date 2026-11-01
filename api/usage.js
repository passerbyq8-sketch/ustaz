import { applyCorsOrigin, ALLOWED_ORIGINS, checkUsageLimit } from '../lib/ratelimit.js';
import { validUsageEvent, writeUsage } from '../lib/usage.js';

// Anonymous, best effort and deliberately silent. Never read an account, IP or user-agent.
export async function handleUsage(req, res, { limit = checkUsageLimit, write = writeUsage } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  applyCorsOrigin(req, res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  try {
    if (req.headers?.origin && !ALLOWED_ORIGINS.includes(req.headers.origin)) return res.status(204).end();
    let body = req.body;
    if (typeof body === 'string') {
      if (body.length > 256) return res.status(204).end();
      body = JSON.parse(body);
    }
    if (!validUsageEvent(body)) return res.status(204).end();
    const allowed = await limit(body.anon);
    if (allowed.ok) await write(body);
  } catch { /* No request content or identifying header is ever logged. */ }
  return res.status(204).end();
}

export default handleUsage;
