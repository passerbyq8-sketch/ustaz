// Same-origin, read-only proxy for the existing fatwa screen contract.  The browser
// can request /api/v1/* from Ezik; only this server function contacts the fixed service.

import { applyCorsOrigin } from '../lib/ratelimit.js';
import { FATWA_BASE } from '../lib/fatwa-contract.js';

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const ALLOWED_QUERY = new Set(['q', 'scholar', 'page', 'limit', 'view', 'audio', 'collection']);
const ALLOWED_PATH = /^(?:health|scholars|fatwas\/(?:search|browse|[-a-z0-9_]+\/[0-9]+))$/u;

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  const path = String(req.query?.path || '').replace(/^\/+|\/+$/gu, '');
  if (!ALLOWED_PATH.test(path)) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND' } });
  const upstream = new URL(`/api/v1/${path}`, FATWA_BASE);
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (!ALLOWED_QUERY.has(key)) return res.status(400).json({ ok: false, error: { code: 'BAD_QUERY' } });
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar != null) upstream.searchParams.set(key, String(scalar).slice(0, 400));
  }
  try {
    const response = await fetch(upstream, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    const final = new URL(response.url || upstream.href);
    if (final.origin !== FATWA_BASE) throw new Error('redirect_refused');
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('application/json')) throw new Error('content_type');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('body_too_large');
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_BYTES) throw new Error('body_too_large');
    res.status(response.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', path === 'health' || path === 'scholars'
      ? 'public, s-maxage=300, stale-while-revalidate=600'
      : 'private, no-store');
    return res.send(Buffer.from(body));
  } catch (error) {
    console.warn('[fatwa-proxy] degraded', { path, reason: String(error?.message || error) });
    return res.status(502).json({ ok: false, error: { code: 'FATWA_UPSTREAM_UNAVAILABLE' } });
  }
}
