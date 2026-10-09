// lib/sync/store.js
// THE ACCOUNT SPACE IN THE STORE THE APP ALREADY USES (Upstash, KV_REST_API_*), and nothing but
// sealed records in it.
//
// ONE NAMESPACE PER ENVIRONMENT. Preview and Production read the SAME store (one KV_REST_API_* row
// spans both), so every key carries the environment: a preview's data can never land in the
// production space, nor the other way round.
//
//   sync:v1:<env>:s:<space>:r      HASH  record id -> sealed envelope (lib/sync/crypto.js)
//   sync:v1:<env>:s:<space>:q      HASH  record id -> the sequence number of its last change
//   sync:v1:<env>:s:<space>:v      HASH  record id -> its version (compare-and-set)
//   sync:v1:<env>:s:<space>:m      HASH  seq (the space's cursor), bytes (its size)
//   sync:v1:<env>:link:<space>     STRING  a linked identity's space -> the space it was joined to
//   sync:v1:<env>:members:<space>  SET   the spaces joined to this one
//   sync:v1:<env>:rl:<space>:<min> COUNTER  requests this minute
//
// <space> is sha256(accountKey)[0:40] -- the account key itself (provider and subject) is never
// written into a sync key. The record ids are the app's own names (chat:<id>, kv:<key>, ...); the
// content is sealed. Nothing here is ever logged.
//
// EVERY WRITE IS COMPARE-AND-SET in one Lua script, so two devices pushing the same record at the
// same moment cannot write over each other: the loser re-reads, re-merges and tries again.
//
// A STORE THAT CANNOT BE READ IS NOT AN EMPTY SPACE: every helper throws, and the route answers
// 503 -- never "you have no data".

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

export const QUOTA_BYTES = 2 * 1024 * 1024;        // per account space, sealed bytes
export const RATE_PER_MINUTE = 60;

let _redis = null;
let _forced = false;
function client() {
  if (_forced) return _redis;
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  _redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  return _redis;
}
/** Test seam: an object with the five methods below' needs (hget/hgetall/del/eval/get/set/...). */
export function __setSyncStoreForTest(r) { _redis = r; _forced = true; }
export function __resetSyncStore() { _redis = null; _forced = false; }

/** Is there a store at all? Without KV_REST_API_* nothing can ever have been synced. */
export function storeConfigured() { return client() !== null; }

function need() {
  const c = client();
  if (!c) throw new Error('sync-store-unconfigured');
  return c;
}

/** 'production' | 'preview' | 'development' -- the platform's own word, never a request's. */
export function envName(env) {
  const source = (env && typeof env === 'object') ? env : process.env;
  const v = typeof source.VERCEL_ENV === 'string' ? source.VERCEL_ENV : '';
  return v === 'production' || v === 'preview' ? v : 'development';
}

export function spaceIdOf(accountKey) {
  return crypto.createHash('sha256').update('ezik-sync-space|' + String(accountKey), 'utf8').digest('hex').slice(0, 40);
}

const base = (env, space) => 'sync:v1:' + env + ':s:' + space + ':';
export const keysOf = (env, space) => ({
  r: base(env, space) + 'r', q: base(env, space) + 'q', v: base(env, space) + 'v', m: base(env, space) + 'm',
});
export const linkKey = (env, space) => 'sync:v1:' + env + ':link:' + space;
export const membersKey = (env, space) => 'sync:v1:' + env + ':members:' + space;

export const CAS_SCRIPT = [
  "local cur = redis.call('HGET', KEYS[3], ARGV[1])",
  "if (cur or '0') ~= ARGV[2] then return {-1, tonumber(cur or '0')} end",
  "local old = redis.call('HSTRLEN', KEYS[1], ARGV[1])",
  "local delta = string.len(ARGV[3]) - old",
  "local total = tonumber(redis.call('HGET', KEYS[4], 'bytes') or '0')",
  "if delta > 0 and total + delta > tonumber(ARGV[4]) then return {-2, total} end",
  "local seq = redis.call('HINCRBY', KEYS[4], 'seq', 1)",
  "redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])",
  "redis.call('HSET', KEYS[2], ARGV[1], seq)",
  "local nv = tonumber(ARGV[2]) + 1",
  "redis.call('HSET', KEYS[3], ARGV[1], nv)",
  "redis.call('HINCRBY', KEYS[4], 'bytes', delta)",
  'return {seq, nv}',
].join('\n');

function plainHash(h) {
  if (!h) return {};
  if (Array.isArray(h)) { const o = {}; for (let i = 0; i + 1 < h.length; i += 2) o[h[i]] = h[i + 1]; return o; }
  return h;
}
const str = (v) => (v === null || v === undefined ? null : (typeof v === 'string' ? v : JSON.stringify(v)));

/** The whole space: { id: { env: string, seq: number, ver: number } } plus the cursor. */
export async function readSpace(env, space) {
  const c = need();
  const k = keysOf(env, space);
  const [r, q, v, m] = await Promise.all([c.hgetall(k.r), c.hgetall(k.q), c.hgetall(k.v), c.hgetall(k.m)]);
  const R = plainHash(r), Q = plainHash(q), V = plainHash(v), M = plainHash(m);
  const out = {};
  for (const id of Object.keys(R)) out[id] = { env: str(R[id]), seq: Number(Q[id]) || 0, ver: Number(V[id]) || 0 };
  return { records: out, cursor: Number(M.seq) || 0, bytes: Number(M.bytes) || 0 };
}

/** One record, or null. */
export async function readOne(env, space, id) {
  const c = need();
  const k = keysOf(env, space);
  const [e, v] = await Promise.all([c.hget(k.r, id), c.hget(k.v, id)]);
  if (e === null || e === undefined) return null;
  return { env: str(e), ver: Number(v) || 0 };
}

/** Compare-and-set. { ok:true, seq, ver } | { ok:false, why:'conflict'|'quota' }. */
export async function casWrite(env, space, id, expectedVer, envelope, quota) {
  const c = need();
  const k = keysOf(env, space);
  const res = await c.eval(CAS_SCRIPT, [k.r, k.q, k.v, k.m], [id, String(expectedVer || 0), envelope, String(quota || QUOTA_BYTES)]);
  const a = Array.isArray(res) ? res.map(Number) : [];
  if (a[0] === -1) return { ok: false, why: 'conflict', ver: a[1] };
  if (a[0] === -2) return { ok: false, why: 'quota' };
  if (!(a[0] > 0)) throw new Error('sync-store-cas');
  return { ok: true, seq: a[0], ver: a[1] };
}

/** Erase the space whole. True when the store said it deleted. */
export async function wipeSpace(env, space) {
  const c = need();
  const k = keysOf(env, space);
  await c.del(k.r, k.q, k.v, k.m);
  return true;
}

/** The space this identity's data lives in: itself, or the space it was linked into. */
export async function primaryOf(env, space) {
  const c = need();
  const p = await c.get(linkKey(env, space));
  // Stored as 'p:<hex>' so the store's JSON auto-parsing can never turn an all-digit id into a number.
  return typeof p === 'string' && /^p:[0-9a-f]{40}$/.test(p) ? p.slice(2) : space;
}

export async function membersOf(env, space) {
  const c = need();
  const m = await c.smembers(membersKey(env, space));
  return Array.isArray(m) ? m.filter((x) => typeof x === 'string') : [];
}

export async function writeLink(env, member, primary) {
  const c = need();
  await c.set(linkKey(env, member), 'p:' + primary);
  await c.sadd(membersKey(env, primary), member);
}

/** Remove every link that points into `primary`, and the member set itself. */
export async function dropLinks(env, primary) {
  const c = need();
  const members = await membersOf(env, primary);
  for (const m of members) await c.del(linkKey(env, m));
  await c.del(membersKey(env, primary));
  // An identity that was itself joined elsewhere: its own link goes too.
  await c.del(linkKey(env, primary));
  return members.length;
}

/** Per-space throttle. FAILS CLOSED: a request we cannot count is refused. */
export async function allowRequest(env, space, nowMs) {
  try {
    const c = need();
    const minute = Math.floor((nowMs || Date.now()) / 60000);
    const key = 'sync:v1:' + env + ':rl:' + space + ':' + minute;
    const n = await c.incr(key);
    if (Number(n) === 1) await c.expire(key, 120);
    return Number(n) <= RATE_PER_MINUTE;
  } catch (e) { return false; }
}
