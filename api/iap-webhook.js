import crypto from 'node:crypto';

import { readJsonStrict } from '../lib/auth/store.js';
import { IAP_PRODUCTS, applyTransactionEvent } from '../lib/iap/store.js';

export const MAX_WEBHOOK_BYTES = 64 * 1024;

function bodyOf(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
}

function sharedSecretMatches(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function purchaseEvent(productId, type) {
  if (productId === 'ezik_games_3') return type === 'NON_RENEWING_PURCHASE';
  return type === 'INITIAL_PURCHASE' || type === 'RENEWAL' || type === 'NON_RENEWING_PURCHASE';
}

function refundEvent(productId, event) {
  if (event.type !== 'CANCELLATION') return false;
  if (productId === 'ezik_games_3') return true;
  return event.cancel_reason === 'CUSTOMER_SUPPORT' || Number(event.price) < 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ ok: false, error: 'iap-webhook-unconfigured' });
  if (!sharedSecretMatches((req.headers || {}).authorization, secret)) {
    return res.status(401).json({ ok: false, error: 'iap-webhook-unauthorized' });
  }

  const body = bodyOf(req);
  let size = Infinity;
  try { size = Buffer.byteLength(JSON.stringify(body), 'utf8'); } catch { /* invalid body */ }
  if (!body || size > MAX_WEBHOOK_BYTES || !body.event || typeof body.event !== 'object') {
    return res.status(400).json({ ok: false, error: 'iap-webhook-body' });
  }

  const event = body.event;
  if (event.type === 'TEST') return res.status(200).json({ ok: true, status: 'test' });
  const productId = typeof event.product_id === 'string' ? event.product_id : '';
  if (!Object.prototype.hasOwnProperty.call(IAP_PRODUCTS, productId)) {
    return res.status(200).json({ ok: true, status: 'ignored' });
  }

  let action = '';
  if (purchaseEvent(productId, event.type)) action = 'purchase';
  else if (refundEvent(productId, event)) action = 'refund';
  else if (event.type === 'REFUND_REVERSED') action = 'refund-reversed';
  else return res.status(200).json({ ok: true, status: 'ignored' });

  const accountKey = typeof event.app_user_id === 'string' ? event.app_user_id : '';
  if (!accountKey.startsWith('acct:v1:')) {
    return res.status(200).json({ ok: true, status: 'ignored' });
  }
  const account = await readJsonStrict(accountKey);
  if (!account.ok) return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  if (!account.value || typeof account.value !== 'object') {
    return res.status(200).json({ ok: true, status: 'unknown-account' });
  }

  if (typeof event.store !== 'string' || typeof event.transaction_id !== 'string'
    || event.transaction_id.length === 0) {
    return res.status(400).json({ ok: false, error: 'iap-webhook-transaction' });
  }

  try {
    const applied = await applyTransactionEvent({
      accountKey,
      store: event.store,
      transactionId: event.transaction_id,
      productId,
      action,
      eventType: event.type,
      time: Number(event.event_timestamp_ms),
    });
    if (!applied.ok) return res.status(400).json(applied);
    return res.status(200).json({ ok: true, status: applied.status });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'iap-unavailable' });
  }
}
