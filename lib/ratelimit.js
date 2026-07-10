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

// ---------------------------------------------------------------------------
// Audio throttle (#7): protects the expensive audio endpoints (tts + tashkeel).
// Two per-IP sliding windows PLUS one GLOBAL daily kill-switch across all users
// (per-IP windows can't stop a distributed attack; the global one can).
//
// FAIL-OPEN by default: call mode fires /api/tts per prose segment, so failing
// closed would kill a child's LIVE call on any Redis blip. ElevenLabs is quota-
// capped (auto-top-up off) so allowing audio during a Redis outage is bounded.
// Flip AUDIO_FAIL_OPEN to false to fail closed (blocks audio, incl. live calls,
// whenever Redis is unreachable).
//
// Limits are deliberately LOOSE per-IP so a normal call (~1-4 tts/min) is never
// throttled; they only stop a runaway single client. The global cap is the real
// aggregate ceiling. All four numbers are tunable here.
const AUDIO_FAIL_OPEN = true;
const AUDIO_PER_IP_MIN = 40;   // per IP, per minute
const AUDIO_PER_IP_DAY = 400;  // per IP, per day
const AUDIO_GLOBAL_DAY = 2000; // ALL users combined, per day (kill-switch)

function makeAudioWindows(tag) {
  return {
    min: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(AUDIO_PER_IP_MIN, '1 m'), prefix: `aud:${tag}:ip:min` }),
    day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(AUDIO_PER_IP_DAY, '1 d'), prefix: `aud:${tag}:ip:day` }),
    all: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(AUDIO_GLOBAL_DAY, '1 d'), prefix: `aud:${tag}:all:day` }),
  };
}
const AUDIO_WINDOWS = { tts: makeAudioWindows('tts'), tashkeel: makeAudioWindows('tk') };

// checkAudioLimit(ip, kind): kind is 'tts' or 'tashkeel'. Blocks if the per-IP
// minute OR per-IP day OR the global day window is exceeded. On Redis error,
// obeys AUDIO_FAIL_OPEN (default true -> allow, so calls never break on a
// transient outage).
export async function checkAudioLimit(ip, kind) {
  const W = AUDIO_WINDOWS[kind];
  if (!W) return { ok: true }; // unknown kind: don't block
  try {
    const [m, d, g] = await Promise.all([W.min.limit(ip), W.day.limit(ip), W.all.limit('all')]);
    if (!m.success || !d.success || !g.success) return { ok: false };
    return { ok: true };
  } catch (e) {
    console.warn(`[ratelimit] audio(${kind}) error, fail-${AUDIO_FAIL_OPEN ? 'open' : 'closed'}:`, e && e.message ? e.message : e);
    return { ok: AUDIO_FAIL_OPEN };
  }
}
