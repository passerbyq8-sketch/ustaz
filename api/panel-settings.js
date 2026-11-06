import { Redis } from '@upstash/redis';
import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { resolveActorState, ROLE_OWNER } from '../lib/articles/roles.js';
import { readPanelSettings, savePanelSettings } from '../lib/panel-settings.js';
const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
export async function handlePanelSettings(req, res, deps = {}) {
  const store = deps.store || redis, actorState = deps.actorState || resolveActorState, limit = deps.limit || checkAuthLimit;
  applyCorsOrigin(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); return res.status(204).end(); }
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  try {
    if (req.method === 'GET') return res.status(200).json((await readPanelSettings(store)).document);
    if (!(await limit(clientAddress(req, 'unknown'))).ok) return res.status(429).json({ ok: false, error: 'panel-settings-limit' });
    const resolved = await actorState(req);
    if (resolved.state === 'unknown') return res.status(503).json({ ok: false, error: 'panel-settings-store' });
    if (!resolved.actor || resolved.actor.role !== ROLE_OWNER) return res.status(401).json({ ok: false, error: 'panel-settings-unauthenticated' });
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 16384) return res.status(413).json({ ok: false, error: 'panel-settings-invalid' });
    if (req.body?.action === 'read') return res.status(200).json({ ok: true, document: (await readPanelSettings(store)).document });
    if (req.body?.action !== 'save') return res.status(400).json({ ok: false, error: 'panel-settings-action' });
    const result = await savePanelSettings(store, req.body.document);
    return res.status(result.ok ? 200 : result.error.endsWith('conflict') ? 409 : 400).json(result);
  } catch { return res.status(503).json({ ok: false, error: 'panel-settings-store' }); }
}
export default handlePanelSettings;
