// lib/ledger/redis.js
// THE SAME UPSTASH INSTANCE THE APP ALREADY USES, REACHED THE SAME WAY.
//
// No new cloud resource, no new credential, no second client library. The explicit-credential
// shape is copied from lib/ratelimit.js and lib/daycap.js for the reason recorded there:
// Vercel injects KV_REST_API_*, while @upstash/redis's auto-env expects UPSTASH_REDIS_REST_*,
// so a client built without arguments silently points at nothing.
//
// EVERY KEY THIS ENGINE WRITES IS NAMESPACED `lg:`. The prefixes already in use are `ask:`,
// `chat:`, `aud:`, `report:` and the day-cap keys; `lg:` collides with none of them, so a
// mistake here cannot corrupt a rate-limit window or a report queue.
//
// UNAVAILABILITY IS NOT AN ERROR HERE. Every helper returns null / false rather than throwing:
// a cache is an optimisation, and a kill switch that cannot be read must read as OFF. Both of
// those are answers, not failures.

import { Redis } from '@upstash/redis';

export const NAMESPACE = 'lg:';

let _redis = null;
let _forced = false;

function client() {
  if (_forced) return _redis;
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  _redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return _redis;
}

/** Test seam. Pass null to simulate an unreachable store. */
export function __setRedisForTest(r) { _redis = r; _forced = true; }
export function __resetRedis() { _redis = null; _forced = false; }

export function key(...parts) {
  return NAMESPACE + parts.map((p) => String(p).replace(/[\s:]/g, '_')).join(':');
}

export async function get(k) {
  const c = client();
  if (!c) return null;
  try { return await c.get(k); } catch { return null; }
}

export async function setex(k, ttlSeconds, value) {
  const c = client();
  if (!c) return false;
  try { await c.set(k, value, { ex: Math.max(1, Math.floor(ttlSeconds)) }); return true; } catch { return false; }
}

export async function available() {
  return client() !== null;
}
