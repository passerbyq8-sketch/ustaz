// SEC-013: a recent, nonce-bound provider proof for one sensitive operation.
// Separate short-lived records preserve the established session schema/lifetime.
import { sessionState } from './account.js';
import { authSnapshot, authCompareWrite, sessionKey, generationKey, LEGACY_GENERATION } from './store.js';
import { proofRequired, proofDigest, opaqueProof, isOpaqueProof } from './proof.js';

export const REAUTH_TTL_SECONDS = 300;
const fail = (status, code) => ({ ok: false, status, code });
const invalid = () => fail(403, 'auth-reauth-invalid');
const unavailable = () => fail(503, 'auth-reauth-unavailable');
const reauthKey = proof => 'auth:reauth:v1:' + proofDigest(proof);

function scopeFor(action, target = {}) {
  if (action === 'account-delete') return proofDigest(JSON.stringify([action]));
  if (!['roles-grant', 'roles-revoke'].includes(action) || !target || typeof target.accountKey !== 'string'
    || target.accountKey.length < 1 || target.accountKey.length > 180) return null;
  if (action === 'roles-revoke') return proofDigest(JSON.stringify([action, target.accountKey]));
  if (!Array.isArray(target.sections) || target.sections.length < 1 || target.sections.length > 16
    || target.sections.some(s => typeof s !== 'string' || s.length < 1 || s.length > 40)) return null;
  return proofDigest(JSON.stringify([action, target.accountKey, [...new Set(target.sections)].sort()]));
}

export async function prepareReauthentication(body) {
  const scope = scopeFor(body.action, body.target);
  if (!scope || typeof body.session !== 'string' || body.session.length < 1 || body.session.length > 128) {
    return fail(400, 'auth-reauth-body');
  }
  const state = await sessionState(body.session);
  if (state.state === 'unknown') return unavailable();
  if (state.state !== 'live') return invalid();
  if (!state.record.accountKey.startsWith('acct:v1:' + body.provider + ':')) return fail(403, 'auth-reauth-provider');
  return { ok: true, context: { purpose: 'reauth', reauth: {
    accountKey: state.record.accountKey, generation: state.record.generation ?? LEGACY_GENERATION,
    sessionHash: proofDigest(body.session), action: body.action, scope,
  } } };
}

/** Snapshots are checked again atomically with the proof write/consume. */
async function liveRows(session, expected) {
  if (!expected || typeof session !== 'string' || session.length < 1 || session.length > 128
    || expected.sessionHash !== proofDigest(session)) return invalid();
  const held = await authSnapshot(sessionKey(session));
  if (!held.ok) return unavailable();
  if (!held.value || held.value.accountKey !== expected.accountKey || held.value.expiresAt <= Date.now()
    || (held.value.generation ?? LEGACY_GENERATION) !== expected.generation) return invalid();
  const account = await authSnapshot(expected.accountKey), generation = await authSnapshot(generationKey(expected.accountKey));
  if (!account.ok || !generation.ok) return unavailable();
  if (!account.value || (generation.value?.id ?? LEGACY_GENERATION) !== expected.generation) return invalid();
  return { ok: true, rows: [held, account, generation] };
}

/** Called only after OIDC signature, nonce, freshness and exact subject checks. */
export async function issueReauthentication(binding, session) {
  if (!binding || binding.purpose !== 'reauth' || !binding.reauth || !Number.isFinite(binding.verifiedAt)
    || binding.verifiedAt > Date.now() || binding.verifiedAt + REAUTH_TTL_SECONDS * 1000 <= Date.now()) return invalid();
  const proof = opaqueProof(), expiresAt = binding.verifiedAt + REAUTH_TTL_SECONDS * 1000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const live = await liveRows(session, binding.reauth);
    if (!live.ok) return live;
    const prior = await authSnapshot(reauthKey(proof));
    if (!prior.ok || prior.value) return unavailable();
    const result = await authCompareWrite([...live.rows, { ...prior,
      next: { v: 1, ...binding.reauth, verifiedAt: binding.verifiedAt, expiresAt },
      ttl: Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000)),
    }]);
    if (result === 'OK') return { ok: true, proofVersion: 1, reauthProof: proof, expiresAt, action: binding.reauth.action };
    if (result !== 'RETRY') return unavailable();
  }
  return unavailable();
}

/** Missing proof keeps legacy behavior only while the single version switch is off. */
export async function requireReauthentication(body, action, target) {
  if (!proofRequired() && body.reauthProof === undefined && body.proofVersion === undefined) return { ok: true };
  if (body.reauthProof === undefined) return fail(428, 'auth-reauth-required');
  const scope = scopeFor(action, target);
  if (body.proofVersion !== 1 || !isOpaqueProof(body.reauthProof) || !scope) return invalid();
  for (let attempt = 0; attempt < 8; attempt++) {
    const proof = await authSnapshot(reauthKey(body.reauthProof));
    if (!proof.ok) return unavailable();
    const record = proof.value;
    if (!record || record.v !== 1 || record.action !== action || record.scope !== scope
      || !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) return invalid();
    const live = await liveRows(body.session, record);
    if (!live.ok) return live;
    const result = await authCompareWrite([...live.rows, { ...proof, remove: true }]);
    if (result === 'OK') return { ok: true };
    if (result !== 'RETRY') return unavailable();
  }
  return unavailable();
}
