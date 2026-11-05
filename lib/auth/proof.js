// SEC-008: one versioned server rollout switch. Absent/unknown means OFF.
// Opt-in flows always verify proof, even while legacy compatibility is enabled.
// No deployment value is set here. Proof is returned once, never put in a URL,
// and only its digest enters the auth store. Existing sessions are untouched.
import crypto from 'node:crypto';
import { writeIfAbsent, takeOnceStrict } from './store.js';

export const PROOF_VERSION = 1;
export const CHALLENGE_TTL_SECONDS = 600;
export const proofRequired = () => process.env.AUTH_PROOF_VERSION === '1';
export const proofDigest = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
export const opaqueProof = () => crypto.randomBytes(32).toString('base64url');
export const isOpaqueProof = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const challengeKey = id => 'auth:challenge:v1:' + id;
const failure = (status, code) => ({ ok: false, status, code });

export async function issueChallenge(provider, transport, context = {}) {
  const challenge = opaqueProof(), proof = opaqueProof(), nonce = opaqueProof();
  const expiresAt = Date.now() + CHALLENGE_TTL_SECONDS * 1000;
  const record = { v: PROOF_VERSION, provider, transport, purpose: 'signin',
    digest: proofDigest(proof), nonce, createdAt: Date.now(), expiresAt, ...context };
  if (!await writeIfAbsent(challengeKey(challenge), record, CHALLENGE_TTL_SECONDS)) {
    return failure(503, 'auth-proof-unavailable');
  }
  return { ok: true, proofVersion: PROOF_VERSION, challenge, proof, nonce, expiresAt };
}

export async function consumeChallenge(id, provider, transport) {
  if (!isOpaqueProof(id)) return failure(400, 'auth-challenge-invalid');
  const taken = await takeOnceStrict(challengeKey(id));
  if (!taken.ok) return failure(503, 'auth-proof-unavailable');
  const record = taken.value;
  if (!record || record.v !== PROOF_VERSION || record.provider !== provider
    || record.transport !== transport || !Number.isFinite(record.expiresAt)
    || record.expiresAt <= Date.now()) return failure(400, 'auth-challenge-invalid');
  return { ok: true, record };
}

/** Binding comes only from the server's state/ticket/challenge, never the body. */
export function verifyClientProof(binding, body) {
  if (!binding) return proofRequired() ? failure(428, 'auth-proof-required') : { ok: true };
  if (binding.v !== PROOF_VERSION || !Number.isFinite(binding.expiresAt) || binding.expiresAt <= Date.now()
    || body.proofVersion !== PROOF_VERSION || !isOpaqueProof(body.proof)
    || typeof binding.digest !== 'string' || !/^[a-f0-9]{64}$/.test(binding.digest)) {
    return failure(403, 'auth-proof-invalid');
  }
  const equal = crypto.timingSafeEqual(Buffer.from(binding.digest, 'hex'), Buffer.from(proofDigest(body.proof), 'hex'));
  return equal ? { ok: true } : failure(403, 'auth-proof-invalid');
}

export function sendProofFailure(res, result) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(result.status).json({ ok: false, error: result.code,
    proofVersion: PROOF_VERSION, recovery: 'restart-auth-challenge' });
}
