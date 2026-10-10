// lib/sync/service.js
// THE FIVE THINGS AN ACCOUNT CAN ASK OF ITS SPACE -- pull, push, export, wipe, link -- plus the
// erasure the account delete performs. Every function takes an ACCOUNT KEY that the route resolved
// from a live session; nothing here reads a request, and no function accepts a space id from a
// caller. Isolation is therefore structural: the only space a caller can reach is the one its own
// session names (or the one that identity was linked into by proof of both sessions).

import { loadKeys, seal, open } from './crypto.js';
import { mergeRecord, kindOf, RESERVED_PREFIX, chatBaseOf, foldChatParts } from './merge.js';
import {
  envName, spaceIdOf, readSpace, readOne, casWrite, wipeSpace, primaryOf, writeLink, dropLinks, membersOf,
  QUOTA_BYTES, storeConfigured,
} from './store.js';
import { syncSwitch, syncOpenFor } from './flag.js';
import { accountForVerifiedEmail, emailDigest } from '../auth/account.js';
import { readJson as readAuthJson } from '../auth/store.js';

export const MAX_CHANGES = 200;
export const MAX_RECORD_BYTES = 256 * 1024;
const CAS_TRIES = 4;

export class SyncError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status || 400; }
}

function keysOrThrow(env) {
  const keys = loadKeys(env);
  if (!keys) throw new SyncError('sync-unavailable', 503);
  return keys;
}

/** The space an account's data lives in. */
export async function spaceFor(accountKey, env) {
  return primaryOf(envName(env), spaceIdOf(accountKey));
}

/** Records changed after `cursor`, opened. */
export async function pull(accountKey, cursor, env) {
  const keys = keysOrThrow(env);
  const E = envName(env);
  const space = await spaceFor(accountKey, env);
  const s = await readSpace(E, space);
  const since = Number.isFinite(Number(cursor)) ? Number(cursor) : 0;
  const changes = [];
  for (const id of Object.keys(s.records)) {
    const r = s.records[id];
    if (r.seq <= since) continue;
    if (id.startsWith(RESERVED_PREFIX)) continue;
    changes.push({ id, ver: r.ver, seq: r.seq, rec: open(keys, E, space, id, r.env) });
  }
  changes.sort((a, b) => a.seq - b.seq);
  return { cursor: s.cursor, changes, bytes: s.bytes, quota: QUOTA_BYTES };
}

/** Merge one incoming record into the space, compare-and-set, retried on a race. */
async function pushOne(keys, E, space, id, rec) {
  for (let i = 0; i < CAS_TRIES; i++) {
    const held = await readOne(E, space, id);
    const heldRec = held ? open(keys, E, space, id, held.env) : null;
    const merged = mergeRecord(id, heldRec, rec);
    const envlp = seal(keys, E, space, id, merged);
    const w = await casWrite(E, space, id, held ? held.ver : 0, envlp, QUOTA_BYTES);
    if (w.ok) return { id, ver: w.ver, seq: w.seq, rec: merged };
    if (w.why === 'quota') return { id, refused: 'quota' };
  }
  return { id, refused: 'busy' };
}

/** Push a batch. Each change: { id, rec: { u, del, val } }. Returns the merged records. */
export async function push(accountKey, changes, env) {
  const keys = keysOrThrow(env);
  const E = envName(env);
  if (!Array.isArray(changes)) throw new SyncError('sync-changes-shape', 400);
  if (changes.length > MAX_CHANGES) throw new SyncError('sync-too-many', 413);
  const space = await spaceFor(accountKey, env);
  const out = [];
  for (const c of changes) {
    const id = c && typeof c.id === 'string' ? c.id : '';
    if (!kindOf(id)) { out.push({ id, refused: 'id' }); continue; }
    const rec = c.rec && typeof c.rec === 'object' ? c.rec : null;
    if (!rec) { out.push({ id, refused: 'shape' }); continue; }
    let bytes = 0;
    try { bytes = Buffer.byteLength(JSON.stringify(rec), 'utf8'); } catch (e) { bytes = Infinity; }
    if (bytes > MAX_RECORD_BYTES) { out.push({ id, refused: 'size' }); continue; }
    let incoming = { u: rec.u, del: rec.del === true, val: rec.val };
    // A PART OF A DELETED CONVERSATION IS DELETED TOO: it is stored as a tombstone, never as text.
    const base = chatBaseOf(id);
    if (base && !incoming.del) {
      const heldBase = await readOne(E, space, base);
      if (heldBase && open(keys, E, space, base, heldBase.env).del) incoming = { u: incoming.u, del: true, val: null };
    }
    out.push(await pushOne(keys, E, space, id, incoming));
    // AND A CONVERSATION DELETED BY HAND TAKES EVERY PART IT HAS IN THE SPACE WITH IT -- no message
    // of a deleted conversation stays on the server because a part tombstone was never sent.
    if (!base && incoming.del && id.indexOf('chat:') === 0) {
      const sp = await readSpace(E, space);
      for (const pid of Object.keys(sp.records)) {
        if (chatBaseOf(pid) === id) out.push(await pushOne(keys, E, space, pid, { u: incoming.u, del: true, val: null }));
      }
    }
  }
  return { results: out };
}

/** Everything the account holds, opened -- the "download my data" file. Tombstones left out. */
export async function exportAll(accountKey, env) {
  const p = await pull(accountKey, 0, env);
  const records = {};
  for (const c of p.changes) if (!c.rec.del) records[c.id] = c.rec.val;
  // A long conversation travels in parts; the file holds it as ONE conversation.
  return { ezik: 'account-data', v: 1, exportedAt: new Date().toISOString(), records: foldChatParts(records) };
}

/** "Delete all my data": the space is emptied, the account and its links stay. */
export async function wipeAll(accountKey, env) {
  const E = envName(env);
  const space = await spaceFor(accountKey, env);
  await wipeSpace(E, space);
  return { ok: true };
}

/** Deleting the account: the space AND every link into it go. Needs no key (it opens nothing). */
export async function eraseForAccountDelete(accountKey, env) {
  // No store configured (a machine without KV_REST_API_*): no sync record can exist, so there is
  // nothing to erase. A CONFIGURED store that fails still throws, and the route answers 503.
  if (!storeConfigured()) return { ok: true, skipped: true };
  const E = envName(env);
  const own = spaceIdOf(accountKey);
  const space = await primaryOf(E, own);
  await wipeSpace(E, space);
  if (space !== own) await wipeSpace(E, own);
  await dropLinks(E, space);
  return { ok: true };
}

/**
 * LINK THE OTHER ACCOUNT. Both sessions were proved live by the route. The second identity's space
 * is merged into the first's by the same rules a push uses, emptied, and pointed at the first --
 * from then on either sign-in reaches one space.
 */
export async function link(accountKeyA, accountKeyB, env) {
  const keys = keysOrThrow(env);
  const E = envName(env);
  if (accountKeyA === accountKeyB) throw new SyncError('sync-link-same', 400);
  const a = await spaceFor(accountKeyA, env);
  const b = await spaceFor(accountKeyB, env);
  if (a === b) return { ok: true, already: true, moved: 0 };
  const sb = await readSpace(E, b);
  let moved = 0;
  for (const id of Object.keys(sb.records)) {
    if (!kindOf(id)) continue;
    const rec = open(keys, E, b, id, sb.records[id].env);
    const r = await pushOne(keys, E, a, id, rec);
    if (r.refused) throw new SyncError('sync-link-' + r.refused, r.refused === 'quota' ? 413 : 503);
    moved++;
  }
  // Every identity already joined to b follows b into a.
  const bMembers = await membersOf(E, b);
  await wipeSpace(E, b);
  await dropLinks(E, b);
  await writeLink(E, b, a);
  for (const m of bMembers) await writeLink(E, m, a);
  return { ok: true, moved };
}

/**
 * SYNC FIX 4 (10 October) -- THE WELD BY A PROVED ADDRESS. Owner's ruling of 25 August: a reader who
 * signs in with a second provider whose address that provider PROVED, and which equals the proved
 * address of an account that already exists, enters THAT account. It is done on the road «اربط
 * حسابك الآخر» already built -- link() above: the new identity's space is merged into the first
 * account's by the push rules and pointed at it, so the two sign-ins are one account with ONE
 * sync space. The sign-in itself, its session and its account record are untouched.
 *
 * IT WELDS ONLY WHEN ALL OF THESE HOLD, and each is checked here, not at a call site:
 *   - the switch is not off, and it is open for BOTH accounts (a closed switch welds nothing);
 *   - the address of THIS sign-in is proved by its provider (an unproved address never welds);
 *   - it is not Apple's hidden relay address (a reader who hid their address keeps the link button);
 *   - the verified-address index names a DIFFERENT account, whose own record is proved and holds
 *     the same address.
 * Returns { welded, why }. Never throws on a refusal; a store failure throws and the caller, which
 * must not fail a sign-in over it, swallows it.
 */
export const HIDDEN_RELAY_DOMAIN = 'privaterelay.appleid.com';
export function isHiddenRelay(email) {
  const at = String(email || '').trim().toLowerCase().lastIndexOf('@');
  return at !== -1 && String(email).trim().toLowerCase().slice(at + 1) === HIDDEN_RELAY_DOMAIN;
}
export async function weldByVerifiedEmail(accountKey, email, emailVerified, env) {
  if (syncSwitch(env) === 'off') return { welded: false, why: 'closed' };
  if (emailVerified !== true) return { welded: false, why: 'unproved' };
  if (typeof email !== 'string' || !email.trim()) return { welded: false, why: 'no-address' };
  if (isHiddenRelay(email)) return { welded: false, why: 'hidden' };
  if (typeof accountKey !== 'string' || !accountKey) return { welded: false, why: 'no-account' };
  const first = await accountForVerifiedEmail(email);
  if (!first || first === accountKey) return { welded: false, why: 'first' };
  const rec = await readAuthJson(first);
  if (!rec || typeof rec !== 'object' || rec.emailVerified !== true || typeof rec.email !== 'string'
    || emailDigest(rec.email) !== emailDigest(email)) return { welded: false, why: 'unproved' };
  if (!(await syncOpenFor(first, env)) || !(await syncOpenFor(accountKey, env))) return { welded: false, why: 'closed' };
  const l = await link(first, accountKey, env);
  return { welded: true, why: l.already ? 'already' : 'linked', moved: l.moved || 0 };
}
