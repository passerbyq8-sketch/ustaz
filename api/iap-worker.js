import { authorizeWorker, validWorkerRequest, validWorkerSignature } from '../lib/iap/worker.js';

/** Internal service endpoint. No CORS, cookies, client receipt or client-selected start authority. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  const secret = process.env.IAP_WORKER_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw, 'utf8') > 4096) throw Error('body');
    body = JSON.parse(raw);
  } catch { return res.status(400).json({ ok: false, error: 'iap-worker-shape' }); }
  if (!validWorkerSignature(secret, 'request-v1', body, req.headers?.['x-ezik-worker-signature']))
    return res.status(401).json({ ok: false, error: 'iap-worker-auth' });
  if (!validWorkerRequest(body)) return res.status(400).json({ ok: false, error: 'iap-worker-shape' });
  try {
    const result = await authorizeWorker(body, secret);
    if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error });
    return res.status(200).json(result);
  } catch { return res.status(503).json({ ok: false, error: 'iap-unavailable' }); }
}
