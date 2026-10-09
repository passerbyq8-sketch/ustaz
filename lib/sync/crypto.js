// lib/sync/crypto.js
// EVERY SYNC RECORD IS SEALED ON THE SERVER BEFORE IT REACHES THE STORE. AES-256-GCM, a fresh
// random 12-byte IV per record, and the record BOUND to where it lives through the additional
// authenticated data: the environment, the account space, the record id and the key id. A sealed
// record copied into another account, another id or another environment does not open -- the tag
// fails -- so a store leak or a store bug cannot move one person's text into another's hands.
//
// THE KEY is SYNC_ENC_KEY: 32 bytes, written as 64 hex characters or as base64 / base64url of 32
// bytes. ONE KEY PER ENVIRONMENT (Preview and Production each hold their own). The key id `k` is
// the first 8 hex of sha256(key) and is stored beside every record, so the key can be rotated:
// put the new key in SYNC_ENC_KEY and the old one in SYNC_ENC_KEY_PREV, and records sealed under
// either still open while new writes take the new one.
//
// NO KEY, A KEY OF THE WRONG LENGTH, A KEY THAT DOES NOT PARSE: sync is UNAVAILABLE (closed). The
// key and the plaintext are never logged, never returned, never thrown in a message.

import crypto from 'node:crypto';

export const SYNC_ENC_KEY_ENV = 'SYNC_ENC_KEY';
export const SYNC_ENC_KEY_PREV_ENV = 'SYNC_ENC_KEY_PREV';
export const SEAL_VERSION = 1;

/** 32 bytes from hex(64) or base64/base64url(32 bytes), else null. */
export function parseKey(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(s)) {
    const b = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return b.length === 32 ? b : null;
  }
  return null;
}

export function keyId(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
}

/** { current: {id, key}, all: Map(id -> key) } or null when there is no usable current key. */
export function loadKeys(env) {
  const source = (env && typeof env === 'object') ? env : process.env;
  const cur = parseKey(source[SYNC_ENC_KEY_ENV]);
  if (!cur) return null;
  const all = new Map();
  const current = { id: keyId(cur), key: cur };
  all.set(current.id, cur);
  const prev = parseKey(source[SYNC_ENC_KEY_PREV_ENV]);
  if (prev) all.set(keyId(prev), prev);
  return { current, all };
}

export function aadFor(envName, spaceId, recordId, kid) {
  return Buffer.from(['ezik-sync', 'v' + SEAL_VERSION, envName, spaceId, recordId, kid].join('|'), 'utf8');
}

/** Seal a JS value. Returns the compact JSON envelope string stored in the store. */
export function seal(keys, envName, spaceId, recordId, value) {
  const iv = crypto.randomBytes(12);
  const kid = keys.current.id;
  const c = crypto.createCipheriv('aes-256-gcm', keys.current.key, iv);
  c.setAAD(aadFor(envName, spaceId, recordId, kid));
  const ct = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return JSON.stringify({ s: SEAL_VERSION, k: kid, i: iv.toString('base64'), c: ct.toString('base64'), t: tag.toString('base64') });
}

/** Open an envelope string. Returns the value, or throws (wrong key, moved record, tampering). */
export function open(keys, envName, spaceId, recordId, envelope) {
  const e = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
  if (!e || e.s !== SEAL_VERSION || typeof e.k !== 'string') throw new Error('sync-seal-shape');
  const key = keys.all.get(e.k);
  if (!key) throw new Error('sync-seal-unknown-key');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(e.i, 'base64'));
  d.setAAD(aadFor(envName, spaceId, recordId, e.k));
  d.setAuthTag(Buffer.from(e.t, 'base64'));
  const pt = Buffer.concat([d.update(Buffer.from(e.c, 'base64')), d.final()]);
  return JSON.parse(pt.toString('utf8'));
}
