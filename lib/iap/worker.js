import crypto from 'node:crypto';
import { sessionState } from '../auth/account.js';
import { authSnapshot, authCompareWrite, generationKey, sessionKey, LEGACY_GENERATION } from '../auth/store.js';
import { iapEnforcementMode, iapSignInRule, isIapEnforced, TRIAL_DAYS } from './store.js';
import { entitlementNamespace, ledgerNamespace } from './environment.js';

export const WORKER_AUDIENCE = 'ezik-games-worker-v1';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const workerSignature = (secret, domain, value) => crypto.createHmac('sha256', secret)
  .update(domain + '\n' + JSON.stringify(value)).digest('hex');
export function validWorkerSignature(secret, domain, value, supplied) {
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(workerSignature(secret, domain, value), 'hex'));
}
export function validWorkerRequest(b, now = Date.now()) {
  return b && b.v === 1 && b.aud === WORKER_AUDIENCE
    && ['hanna', 'harb', 'board'].includes(b.gameId)
    && ['create', 'connect', 'start'].includes(b.action) && ['host', 'join'].includes(b.role)
    && (b.role === 'host' || b.action === 'connect')
    && typeof b.roomId === 'string' && /^[a-f0-9]{24}$/.test(b.roomId)
    && typeof b.nonce === 'string' && /^[a-f0-9]{32}$/.test(b.nonce)
    && Number.isSafeInteger(b.issuedAt) && Math.abs(now - b.issuedAt) <= 30000
    && typeof b.session === 'string' && (b.session === '' || /^[A-Za-z0-9_-]{16,128}$/.test(b.session))
    && typeof b.subject === 'string' && /^(?:|anon|[a-f0-9]{64})$/.test(b.subject)
    && typeof b.transitionId === 'string'
    && (b.action === 'start' ? /^start:[1-9][0-9]{0,9}$/.test(b.transitionId) : b.transitionId === b.action);
}
const denied = (status, error) => ({ ok: false, status, error });

/** Called only by the authenticated worker. The browser's consume receipt is never authority. */
export async function authorizeWorker(b, secret) {
  const signin = iapSignInRule(), mode = iapEnforcementMode();
  const required = signin === 'all' || signin === 'host' && b.role === 'host' || mode === 'all' && b.role === 'host';
  let identity = null;
  if (b.session) {
    const state = await sessionState(b.session);
    if (state.state === 'unknown') return denied(503, 'iap-unavailable');
    if (state.state !== 'live') return denied(401, 'iap-session-invalid');
    identity = state.record;
  } else if (required) return denied(401, 'iap-session-required');
  const key = identity?.accountKey;
  const subject = key ? workerSignature(secret, 'subject-v1', [key, identity.generation ?? LEGACY_GENERATION]) : 'anon';
  const account = key ? workerSignature(secret, 'account-v1', key) : 'anon';
  if (b.subject && b.subject !== subject) return denied(403, 'iap-account-conflict');
  const paid = b.action === 'start' && b.role === 'host' && isIapEnforced(key);
  if (paid && process.env.IAP_WORKER_SALES_VERSION !== '1') return denied(503, 'iap-sales-disabled');
  if (paid && !key) return denied(401, 'iap-session-required');

  const scope = digest(JSON.stringify([b.aud, b.roomId, b.transitionId, b.gameId, subject]));
  const namespace = ledgerNamespace(entitlementNamespace(key));
  const transition = digest(JSON.stringify([b.aud, b.roomId, b.transitionId]));
  const base = 'iap:v1:' + namespace + ':';
  const spentKey = base + 'worker:spent:' + transition;
  const receiptKey = base + 'worker:receipt:' + transition;
  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now(), rows = [];
    if (key) {
      const session = await authSnapshot(sessionKey(b.session)), stored = await authSnapshot(key), generation = await authSnapshot(generationKey(key));
      if (![session, stored, generation].every(x => x.ok)) return denied(503, 'iap-unavailable');
      if (!session.value || session.value.accountKey !== key || session.value.expiresAt <= now || !stored.value
        || (session.value.generation ?? LEGACY_GENERATION) !== (generation.value?.id ?? LEGACY_GENERATION)
        || (identity.generation ?? LEGACY_GENERATION) !== (generation.value?.id ?? LEGACY_GENERATION)) return denied(401, 'iap-session-invalid');
      rows.push(session, stored, generation);
    }
    let paymentMode = 'free', receipt = '';
    if (paid) {
      const spent = await authSnapshot(spentKey), full = await authSnapshot(receiptKey);
      if (!spent.ok || !full.ok) return denied(503, 'iap-unavailable');
      rows.push(spent, full);
      if (spent.value) {
        if (spent.value.scope !== scope) return denied(409, 'iap-transition-conflict');
        if (!full.value || full.value.expiresAt <= now) return denied(409, 'iap-transition-expired');
        paymentMode = spent.value.mode;
        receipt = transition;
      } else {
        const balance = await authSnapshot(base + 'a:' + digest(key) + ':balance');
        if (!balance.ok) return denied(503, 'iap-unavailable');
        const value = balance.value || {};
        const credits = Number(value.credits) || 0, trial = Number(value.trialStartedAt) || 0;
        if (trial > 0 && now >= trial && now <= trial + TRIAL_DAYS * 86400000 + 1800000) paymentMode = 'trial';
        else if (Number(value.subscriptionExpiresAt) > now) paymentMode = 'subscription';
        else if (credits > 0) paymentMode = 'credit';
        else return denied(402, 'iap-no-credit');
        rows.push({ ...balance, next: { ...value, credits: paymentMode === 'credit' ? credits - 1 : credits } });
        spent.next = { v: 1, scope, mode: paymentMode };
        full.next = { v: 1, scope, mode: paymentMode, issuedAt: now, expiresAt: now + 30 * 86400000 };
        full.ttl = 30 * 86400;
        receipt = transition;
      }
    }
    const written = rows.length ? await authCompareWrite(rows) : 'OK';
    if (written === 'RETRY') continue;
    if (written !== 'OK') return denied(503, 'iap-unavailable');
    const issuedAt = Date.now();
    const permission = { v: 1, aud: b.aud, action: b.action, role: b.role, gameId: b.gameId,
      roomId: b.roomId, transitionId: b.transitionId, nonce: b.nonce, subject, account,
      mode: paymentMode, receipt, issuedAt, expiresAt: issuedAt + 30000 };
    return { ok: true, permission, signature: workerSignature(secret, 'permission-v1', permission) };
  }
  return denied(503, 'iap-unavailable');
}
