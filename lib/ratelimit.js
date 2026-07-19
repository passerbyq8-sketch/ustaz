// lib/ratelimit.js
// Per-IP ask throttle backed by Upstash (Redis REST). Two per-IP sliding windows
// PLUS one GLOBAL daily kill-switch across all users (mirrors chat/audio):
//   min = 20 requests / 1 minute         (prefix "ask:min")
//   day = 300 requests / 1 day           (prefix "ask:day")
//   all = 800 requests / 1 day, ALL users (prefix "ask:all:day")
//
// Mirrors the Phase-1 spike (spike/ratelimit-probe.mjs): the Redis client is
// built by PASSING url/token EXPLICITLY from the KV_REST_API_* vars Vercel
// injects — we do NOT rely on @upstash/redis auto-env (which expects the
// UPSTASH_REDIS_REST_* names). analytics stays off.
//
// checkAskLimit() FAILS OPEN: any Redis/network error returns { ok: true } so a
// throttle-backend outage never blocks a child from asking. The GLOBAL cap, when
// tripped, SCREAMS (console.error) — it is the switch that turns the app off for
// every child at once.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Per-IP minute+day windows, plus a GLOBAL daily kill-switch across all users.
// The two per-IP prefixes are UNCHANGED ('ask:min' / 'ask:day') so existing keys
// keep counting; only the global window ('ask:all:day') is new. Shape copied
// verbatim from CHAT_WINDOWS below.
//
// 🩸 ASK_GLOBAL_DAY was probed live at 5 on 2026-07-11 and it FIRED: /api/ask does
//    NOT return 429 -- the throttle opens an SSE stream and sends the child a gentle
//    message, so a throttled request reads 200. The probe is the FLIP (400 -> 200),
//    never the status code. Do not write a 429 probe for this route again.
const ASK_FAIL_OPEN  = true;
const ASK_PER_IP_MIN = 20;
const ASK_PER_IP_DAY = 300;
const ASK_GLOBAL_DAY = 800; // 20 testers x 40 msgs/day. CLOSED-TEST figure -- re-derive before public launch.

const ASK_WINDOWS = {
  min: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(ASK_PER_IP_MIN, '1 m'), prefix: 'ask:min' }),
  day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(ASK_PER_IP_DAY, '1 d'), prefix: 'ask:day' }),
  all: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(ASK_GLOBAL_DAY, '1 d'), prefix: 'ask:all:day' }),
};

// Returns { ok:false } if the per-IP minute OR per-IP day OR the GLOBAL day window is
// exceeded, else { ok:true }. Wrapped in try/catch — on ANY error we fail open and never
// throw. When the GLOBAL cap trips it SCREAMS: that is the switch that takes the app down
// for every child at once, so the operator must see it in the logs the moment it happens.
export async function checkAskLimit(ip) {
  try {
    const [m, d, g] = await Promise.all([
      ASK_WINDOWS.min.limit(ip),
      ASK_WINDOWS.day.limit(ip),
      ASK_WINDOWS.all.limit('all'),
    ]);
    if (!g.success) {
      console.error('[ratelimit] ASK GLOBAL DAILY CAP HIT — app is DOWN for every user');
    }
    if (!m.success || !d.success || !g.success) return { ok: false };
    return { ok: true };
  } catch (e) {
    console.warn(`[ratelimit] ask error, fail-${ASK_FAIL_OPEN ? 'open' : 'closed'}:`, e && e.message ? e.message : e);
    return { ok: ASK_FAIL_OPEN };
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
const AUDIO_PER_IP_MIN = 80;   // per IP, per minute
const AUDIO_PER_IP_DAY = 900;  // per IP, per day
const AUDIO_GLOBAL_DAY = 4000; // ALL users combined, per day (kill-switch)

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
    if (!g.success) console.error(`[ratelimit] AUDIO(${kind}) GLOBAL DAILY CAP HIT — audio is DOWN for every user`);
    if (!m.success || !d.success || !g.success) return { ok: false };
    return { ok: true };
  } catch (e) {
    console.warn(`[ratelimit] audio(${kind}) error, fail-${AUDIO_FAIL_OPEN ? 'open' : 'closed'}:`, e && e.message ? e.message : e);
    return { ok: AUDIO_FAIL_OPEN };
  }
}

/* 15 */
// ---------------------------------------------------------------------------
// Chat throttle + cost caps for api/chat.js and api/chat-fast.js.
//
// WHY THIS EXISTS
//   Those two relays were BARE. Proven live against production: eight consecutive
//   POSTs to each, zero throttle. CORS is '*', and the client supplies `system`,
//   `messages` AND `max_tokens` verbatim. That is a free, unmetered Claude proxy on
//   our key, reachable by anyone who finds the path.
//
// WHY THEY CANNOT REUSE checkAskLimit (6/min)
//   ONE voice turn fires at least TWO requests here: the classifier ALWAYS runs,
//   then the answer. A child talking at 4 turns/min makes 8 requests/min.
//   checkAskLimit would kill a live call at the third turn. So: a separate, looser
//   window -- plus a GLOBAL daily kill-switch, because per-IP windows cannot stop a
//   distributed attack and the global one can.
//
// FAIL-OPEN, like its siblings. A Redis blip must never cut a child's live call.
// That trade means THESE WINDOWS ARE NOT A MONEY CAP. The only ceiling that
// survives a Redis outage is the monthly spend limit in the Anthropic Console.
// It is set. Keep it set. Everything here is the first line, not the last.
const CHAT_FAIL_OPEN  = true;
const CHAT_PER_IP_MIN = 90;    // a normal call is ~8/min. This is ~11x headroom.
const CHAT_PER_IP_DAY = 900;
const CHAT_GLOBAL_DAY = 2500;  // ALL users combined. The circuit breaker.

const CHAT_WINDOWS = {
  min: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(CHAT_PER_IP_MIN, '1 m'), prefix: 'chat:ip:min' }),
  day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(CHAT_PER_IP_DAY, '1 d'), prefix: 'chat:ip:day' }),
  all: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(CHAT_GLOBAL_DAY, '1 d'), prefix: 'chat:all:day' }),
};

// A 429 from here is SAFE on BOTH call paths -- it fails toward the guarded route,
// never away from it:
//   * the classifier reads `!__resp.ok` and returns DEEN, so the turn falls back to
//     the FULL system prompt (worship lock, referral protocol, khilaf policy).
//   * the answer path surfaces a gentle rate-limit message to the child.
export async function checkChatLimit(ip) {
  try {
    const [m, d, g] = await Promise.all([
      CHAT_WINDOWS.min.limit(ip),
      CHAT_WINDOWS.day.limit(ip),
      CHAT_WINDOWS.all.limit('all'),
    ]);
    if (!g.success) console.error('[ratelimit] CHAT GLOBAL DAILY CAP HIT — chat is DOWN for every user');
    if (!m.success || !d.success || !g.success) return { ok: false };
    return { ok: true };
  } catch (e) {
    console.warn(`[ratelimit] chat error, fail-${CHAT_FAIL_OPEN ? 'open' : 'closed'}:`, e && e.message ? e.message : e);
    return { ok: CHAT_FAIL_OPEN };
  }
}

// ---------------------------------------------------------------------------
// Report throttle (step 2a): guards the abuse-report endpoint (api/report.js).
// Two per-IP sliding windows, and DELIBERATELY NO GLOBAL CAP.
//
// WHY NO GLOBAL CAP: a global ceiling on the report button would kill a MANDATORY
// SAFETY feature for every child at once the instant it tripped. The harm of one
// silenced report outweighs the spam a global cap would stop. The chat/audio
// kill-switch reasoning above is deliberately INVERTED here.
//
// FAIL-OPEN: if Redis is unreachable the throttle allows the request through. That
// is safe because the WRITE in api/report.js then fails on its own (LPUSH throws) and
// the endpoint returns 503 -- the report path fails CLOSED at the storage layer, which
// is the only place honesty matters (the child must be told it did NOT send).
const REPORT_FAIL_OPEN  = true;
const REPORT_PER_IP_MIN = 10;
const REPORT_PER_IP_DAY = 30;

const REPORT_WINDOWS = {
  min: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(REPORT_PER_IP_MIN, '1 m'), prefix: 'report:ip:min' }),
  day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(REPORT_PER_IP_DAY, '1 d'), prefix: 'report:ip:day' }),
};

// Blocks if the per-IP minute OR per-IP day window is exceeded. No global window.
// On Redis error obeys REPORT_FAIL_OPEN (true) -- the write in api/report.js is the
// real gate and fails closed on its own.
export async function checkReportLimit(ip) {
  try {
    const [m, d] = await Promise.all([
      REPORT_WINDOWS.min.limit(ip),
      REPORT_WINDOWS.day.limit(ip),
    ]);
    if (!m.success || !d.success) return { ok: false };
    return { ok: true };
  } catch (e) {
    console.warn(`[ratelimit] report error, fail-${REPORT_FAIL_OPEN ? 'open' : 'closed'}:`, e && e.message ? e.message : e);
    return { ok: REPORT_FAIL_OPEN };
  }
}

// ---------------------------------------------------------------------------
// The two cost caps for those same relays. They live HERE, in one place, because
// api/chat-fast.js carries a SIBLING CONTRACT with api/chat.js -- "mirror it here
// or the two relays will drift". A shared import honours that contract
// STRUCTURALLY instead of by convention. Two copies of a number is one number
// waiting to drift. (The duplicated adhkar.json taught us that.)
//
// These two caps do NOT depend on Redis. They hold even when the throttle above
// fails open, which is exactly when they matter most.

// INPUT cap. The client controls `system` and `messages` on both relays, so an
// oversized body is pure cost -- the input side of the bill was as unbounded as the
// output side.
//
// 🩸 96 KB WAS WRONG AND IT BROKE PRODUCTION on 2026-07-11. It was a guess. The comment
//    that used to sit here said "a real request sits far below this" -- nobody had
//    measured. Every religious voice turn 413'd, and the child was told
//    "sorry, I did not understand your question". The MEASURED truth:
//
//      buildSystemPrompt, call mode, age 7   ->  111.2 KB   (the client ships it EVERY turn)
//      buildSystemPrompt, chat mode          ->  100.5 KB
//      full POST body, 1 turn of history     ->  112.0 KB
//      full POST body, 40 turns of history   ->  128.3 KB   <- the worst real request
//
//    So the cap is 256 KB: 2x the worst real body, and still a hard bound on the input
//    side of a single request (Vercel would otherwise accept 4.5 MB, ~1.1M tokens).
//
//    DO NOT tighten this without re-running the measurement. The system prompt is the
//    thing that grows -- every new worship card, every policy block. The relays warn at
//    80% precisely so the NEXT person is told before it breaks, not after.
//
//    The real fix is session 16: build the prompt SERVER-side. Then the body is just the
//    messages (a few KB), this cap can be tight, and the prompt cannot be tampered with.
export const MAX_CHAT_BODY_BYTES = 2 * 1024 * 1024; // DELIBERATE DECISION (item 8), no longer an open defect: 2MB holds the worst real body (one ~600KB base64 image + the ~111KB prompt + 40 turns of history) while staying a hard bound under Vercel's 4.5MB platform limit. The real money ceiling is the Anthropic Console monthly cap, not this number. index.html mirrors it as SERVER_MAX_CHAT_BODY_BYTES and now measures the body in the server's OWN byte unit -- it refuses or trims BEFORE a 413, so the client no longer guesses at what the server enforces. recon-audit section 15 fails on any divergence between the two. Lowering it later is a deliberate TWO-FILE change (here + index.html's mirror) that the gate polices.

// OUTPUT cap. The app asks for 4096 (and 8 for the classifier). An attacker asks for
// 64000 and multiplies the bill by 16 on a SINGLE request. The server decides this.
export const MAX_CHAT_TOKENS = 4096;
