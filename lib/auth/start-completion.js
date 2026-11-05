import { proofRequired, sendProofFailure } from './proof.js';

// ON browser navigations must reach the initiating auth session even when start
// fails before a provider callback. OFF keeps every existing JSON response.
export function sendStartFailure(req, res, result) {
  const query = req.query || {};
  const cs = query.cs;
  if (proofRequired() && typeof cs === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(cs)) {
    const web = Array.isArray(query.web) ? query.web[0] : query.web;
    const url = new URL(web === '1' ? 'https://ezik.app/' : 'ezik://auth/return');
    url.searchParams.set('error', result.code);
    url.searchParams.set('state', cs);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Location', url.toString());
    return res.status(302).end();
  }
  if (result.proof) return sendProofFailure(res, result);
  return res.status(result.status).json({ ok: false, error: result.code,
    ...(result.provider !== undefined ? { provider: result.provider } : {}) });
}
