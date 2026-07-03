// lib/ratelimit.js
// Per-IP ask throttle backed by Upstash (Redis REST). Two sliding windows:
//   day = 25 requests / 1 day   (prefix "ask:day")
//   min =  6 requests / 1 minute (prefix "ask:min")
//
// Mirrors the Phase-1 spike (spike/ratelimit-probe.mjs): the Redis client is
// built by PASSING url/token EXPLICITLY from the KV_REST_API_* vars Vercel
// injects — we do NOT rely on @upstash/redis auto-env (which expects the
// UPSTASH_REDIS_REST_* names). analytics stays off.
//
// checkAskLimit() FAILS OPEN: any Redis/network error returns { ok: true } so a
// throttle-backend outage never blocks a child from asking.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const day = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(25, '1 d'),
  prefix: 'ask:day',
});

const min = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, '1 m'),
  prefix: 'ask:min',
});

// Returns { ok:false } if EITHER window is exceeded, else { ok:true }.
// Wrapped in try/catch — on ANY error we fail open ({ ok:true }) and never throw.
export async function checkAskLimit(ip) {
  try {
    const [dayRes, minRes] = await Promise.all([day.limit(ip), min.limit(ip)]);
    if (!dayRes.success || !minRes.success) return { ok: false };
    return { ok: true };
  } catch (e) {
    console.warn('[ratelimit] failing open:', e && e.message ? e.message : e);
    return { ok: true };
  }
}
