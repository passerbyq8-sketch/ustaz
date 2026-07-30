// lib/daycap.js
// SERVER-SIDE DAILY QUESTION CAP. Directive 78, phase 1.
//
// NO IP. EVER. This module does not read, hash, store or bucket any IP address, and it
// must never start. The per-IP windows in lib/ratelimit.js are a DIFFERENT mechanism with
// a different purpose (burst throttling) and are deliberately untouched by this file.
//
// IDENTITY -- two counters, judged by the LARGER of the two:
//   dc:v1:d:<deviceId>:<YYYY-MM-DD>   from header  x-murabbi-device  (client localStorage uuid)
//   dc:v1:c:<cookieId>:<YYYY-MM-DD>   from cookie  mrb_did           (httpOnly, minted server-side)
// Both are incremented on an ALLOWED request only. TTL 129600s (36h) -- the date already
// lives in the key, so the TTL is garbage collection, not the window.
//
// ACCEPTED DELIBERATELY (the ceiling of a no-IP design, not a defect):
//   clearing localStorage alone   -> does NOT reset (the cookie still counts)
//   clearing cookies alone        -> does NOT reset (the device id still counts)
//   clearing BOTH                 -> resets to a fresh day's allowance
//
// FAIL-CLOSED, HERE ONLY. On any Redis error this returns allowed:false with
// reason 'cap-unavailable' and the route answers 429. That is the OPPOSITE of every
// limiter in lib/ratelimit.js, all four of which fail OPEN on purpose (a Redis blip must
// never cut a child's live call). Those four are byte-untouched by this change. The
// asymmetry is intentional: a burst throttle that fails open costs a little money, but a
// spend cap that fails open costs all of it.
//
// FOUNDER BYPASS: the PIN is the key but the PIN NEVER travels on a request. The client
// sends only base64url(HMAC-SHA256(FOUNDER_SECRET, deviceId)). If FOUNDER_SECRET is unset
// verification ALWAYS FAILS -- an absent secret means nobody bypasses, never everybody.
// Neither the token nor the PIN is ever logged.
//
// The module is PURE ON IMPORT: the Redis client is built lazily on first use, so importing
// this file performs no I/O and reads no env var.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

// 36 hours. The YYYY-MM-DD in the key is what bounds the day; this only reaps dead keys.
export const DAY_CAP_TTL_SECONDS = 129600;

// Asia/Kuwait is UTC+3 with no DST, so the offset is arithmetic -- no timezone library.
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Used when DAY_CAP is unset or unparseable.
export const DAY_CAP_DEFAULT = 10;

export const DAY_CAP_COOKIE = 'mrb_did';
export const DEVICE_HEADER = 'x-murabbi-device';
export const FOUNDER_HEADER = 'x-murabbi-founder';
export const REMAINING_HEADER = 'X-Murabbi-Remaining';

// Child-facing Arabic, truthful in both cases. NEVER "check your connection" -- when the
// cap store is unreachable that is OUR failure, and saying otherwise blames the child for
// a server problem and sends them chasing a working network.
// These are the ONLY definitions of this wording in the repo. Both routes import them, so the
// two cannot drift into saying different things to the same child.
//
// EVERY Arabic character here is a \uXXXX escape, and the file must contain ZERO raw Arabic
// code points -- comments included. Arabic is stored logical-first but RENDERS right-to-left,
// so a raw string looks reversed in many editors, terminals and diff views. Anyone 'helpfully'
// retyping what they see writes the reversed bytes back and silently corrupts the wording. An
// escape sequence is plain ASCII: no copy, paste, terminal or diff can reorder it. Directive 80
// measured this file as LOGICAL before converting, so these escapes are byte-identical to the
// wording that was already here -- the conversion changed representation, never meaning.
//
// day-cap-reached carries NO NUMBER of any kind -- not the cap, not how many were used, not how
// many are left, not how many hours remain. A child who is told "3 left" starts rationing and
// counting instead of asking. It DOES name Kuwait time, because the day boundary is UTC+3 and
// "after midnight" is meaningless to a reader who assumes their own timezone.
export const DAY_CAP_MESSAGES = {
  // The allowance is genuinely spent. Says so, says when it reopens, and nothing more.
  'day-cap-reached': '\u0627\u0646\u062A\u0647\u062A \u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u064A\u0648\u0645. \u064A\u0641\u062A\u062D \u0627\u0644\u0628\u0627\u0628\u064F \u0645\u0646 \u062C\u062F\u064A\u062F \u0628\u0639\u062F \u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u0644\u064A\u0644 \u0628\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0643\u0648\u064A\u062A\u060C \u0625\u0646 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647.',
  // We could not verify the allowance, so we stopped. Names it as OUR side, not theirs -- never
  // "check your connection", which blames the child for a server failure.
  'cap-unavailable': '\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0631\u0635\u064A\u062F \u0627\u0644\u064A\u0648\u0645 \u0639\u0646\u062F\u0646\u0627\u060C \u0641\u0623\u0648\u0642\u0641\u0646\u0627 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0645\u0624\u0642\u062A\u064B\u0627. \u062C\u0631\u0651\u0628 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.',
  // No countable identity at all. Same our-side voice: it is our recognition that failed, not
  // the child's device that is at fault, and the very next request normally succeeds because
  // the refusal still carries the cookie.
  'identity-required': '\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u0639\u0631\u0651\u0641 \u0639\u0644\u0649 \u062C\u0647\u0627\u0632\u0643 \u0639\u0646\u062F\u0646\u0627\u060C \u0641\u0623\u0648\u0642\u0641\u0646\u0627 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0645\u0624\u0642\u062A\u064B\u0627. \u062C\u0631\u0651\u0628 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.',
};

export function dayCapMessage(reason) {
  return DAY_CAP_MESSAGES[reason] || DAY_CAP_MESSAGES['cap-unavailable'];
}

// Delivers the day-cap message as a NORMAL in-conversation reply: HTTP 200 plus the one SSE
// shape index.html:3666 actually consumes -- content_block_delta / text_delta, then
// message_stop. That parser accepts nothing else except 'error', so no frame type is invented
// here; this is the same shape api/ask.js:92 sendSynthesizedText already emits for the per-IP
// throttle.
//
// api/ask.js does NOT call this. It reuses its OWN sendSynthesizedText, so that route keeps
// exactly one gentle path. This exists for api/chat.js, which is a raw upstream byte pipe and
// had no gentle path of its own to reuse.
export function sendCapMessageSse(res, text) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const frame = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text || '' } };
  res.write(`data: ${JSON.stringify(frame)}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
  res.end();
}

let _redis = null;
function client() {
  if (_redis) return _redis;
  // Same explicit-credential shape as lib/ratelimit.js: Vercel injects KV_REST_API_*, while
  // @upstash/redis auto-env expects UPSTASH_REDIS_REST_*. Pass them by hand or it silently
  // builds a client pointed at nothing.
  _redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return _redis;
}

// Test seam: lets the probe force a known-unreachable client without touching real creds.
export function __setRedisForTest(r) { _redis = r; }

// The Kuwait calendar date as YYYY-MM-DD. Shift the instant by +3h, then slice the ISO
// date -- the shifted Date is only a carrier for the arithmetic, never a local time.
export function kuwaitDayStamp(nowMs = Date.now()) {
  return new Date(nowMs + KUWAIT_OFFSET_MS).toISOString().slice(0, 10);
}

// The limit comes from the SERVER ENVIRONMENT and nowhere else. It is never read from the
// request -- not from a header, not from the body, not from a query param. A cap a client
// can raise is not a cap. (R124 exists to prove this line is honest.)
export function dayCapLimit() {
  const n = Number.parseInt(String(process.env.DAY_CAP ?? '').trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : DAY_CAP_DEFAULT;
}

// Both ids land inside a Redis key, so they are validated, not trusted. A client-supplied
// device id containing ':' could otherwise forge another identity's counter key. Anything
// that does not match is treated as ABSENT (the other counter still applies), never as a
// pass -- and never interpolated.
export function safeId(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

// base64url(HMAC-SHA256(FOUNDER_SECRET, deviceId)). Exported so the phase-1 proof can mint
// a token through the SAME code path the server verifies with -- two copies of an HMAC is
// one HMAC waiting to drift. This is NOT an endpoint; the PIN screen and the issuing route
// are deliberately out of scope for this phase.
export function founderTokenFor(deviceId) {
  const secret = process.env.FOUNDER_SECRET;
  if (!secret || !deviceId) return null;
  return crypto.createHmac('sha256', secret).update(String(deviceId)).digest('base64url');
}

// Constant-time compare. Length is compared first because timingSafeEqual throws on a
// length mismatch; a token's LENGTH is not a secret, its BYTES are.
export function verifyFounder(deviceId, token) {
  if (typeof token !== 'string' || !token || !deviceId) return false;
  const expected = founderTokenFor(deviceId);
  if (!expected) return false; // FOUNDER_SECRET unset -> nobody bypasses.
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// -> { allowed, remaining, reason }
//   reason 'founder'          allowed, uncounted, remaining null
//   reason 'ok'               allowed and counted
//   reason 'day-cap-reached'  the allowance is spent
//   reason 'cap-unavailable'  we could not verify -> fail CLOSED
//
// Read-then-increment, so requests 1..N return remaining N-1..0 exactly and request N+1 is
// refused. Under genuinely simultaneous requests two callers can read the same `used` and
// both be allowed, overshooting by at most the number of in-flight requests. That is
// accepted: this is a daily spend ceiling, not a ledger, and the alternative (increment
// first, refund on refusal) counts requests it then refuses.
// The ONE place anything asks "is this request carrying a valid founder token?". Both the
// cap bypass and the tier lock in api/ask.js read this, so a change to how a token is
// judged cannot apply to one and miss the other.
export function hasValidFounderToken(req) {
  const headers = (req && req.headers) || {};
  return verifyFounder(safeId(headers[DEVICE_HEADER]), headers[FOUNDER_HEADER]);
}

export async function checkDayCap({ deviceId, cookieId, founderToken } = {}) {
  const device = safeId(deviceId);
  const cookie = safeId(cookieId);

  // Checked BEFORE any Redis work: a founder must get through even when the cap store is
  // down, and must leave no trace in the counters.
  if (verifyFounder(device, founderToken)) {
    return { allowed: true, remaining: null, reason: 'founder' };
  }

  const limit = dayCapLimit();
  const day = kuwaitDayStamp();
  const keys = [];
  if (device) keys.push(`dc:v1:d:${device}:${day}`);
  if (cookie) keys.push(`dc:v1:c:${cookie}:${day}`);

  // No usable identity at all. guardDayCap() refuses this case before we are reached, so this
  // is only hit by a direct caller -- and an uncountable request fails CLOSED, not open.
  if (keys.length === 0) {
    return { allowed: false, remaining: 0, reason: 'identity-required' };
  }

  try {
    const r = client();
    const current = await r.mget(...keys);
    // A MISSING key means zero -- that is a normal first request of the day. But a key that
    // EXISTS and will not parse means we are holding a number we cannot read, and treating
    // that as zero would silently hand out an unlimited allowance. Fail CLOSED instead.
    let used = 0;
    for (const v of current) {
      if (v === null || v === undefined || v === '') continue;
      const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
      if (!Number.isFinite(n)) {
        console.warn('[daycap] counter unreadable, fail-CLOSED');
        return { allowed: false, remaining: 0, reason: 'cap-unavailable' };
      }
      if (n > used) used = n;
    }
    if (used >= limit) {
      return { allowed: false, remaining: 0, reason: 'day-cap-reached' };
    }
    const p = r.pipeline();
    for (const k of keys) { p.incr(k); p.expire(k, DAY_CAP_TTL_SECONDS); }
    const out = await p.exec();
    const counts = [];
    for (let i = 0; i < out.length; i += 2) counts.push(Number(out[i]) || 0);
    const after = Math.max(0, ...counts);
    return { allowed: true, remaining: Math.max(0, limit - after), reason: 'ok' };
  } catch (e) {
    // No identity and no token in this line -- only the transport failure.
    console.warn('[daycap] store unreachable, fail-CLOSED:', e && e.message ? e.message : e);
    return { allowed: false, remaining: 0, reason: 'cap-unavailable' };
  }
}

function readCookie(req, name) {
  const raw = req && req.headers ? req.headers.cookie : '';
  if (!raw || typeof raw !== 'string') return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// The ONE call a costly route makes. Resolves both identities (minting the httpOnly cookie
// when absent), applies the cap, and publishes `remaining` as a response header -- a header
// and not a body field because both guarded routes answer with an SSE stream the client
// reads incrementally.
//
// Must be called BEFORE the route writes any byte: Set-Cookie cannot be added once headers
// are flushed. On both wired routes the guard sits after body parse and before the first
// Anthropic call, which is also before the SSE commit.
export async function guardDayCap(req, res) {
  const headers = (req && req.headers) || {};
  const deviceId = safeId(headers[DEVICE_HEADER]);

  // A RETURNING cookie is one the browser actually sent back. A freshly minted id proves
  // nothing about the caller -- it is merely what we are about to hand out.
  const returningCookieId = safeId(readCookie(req, DAY_CAP_COOKIE));
  let cookieId = returningCookieId;
  let mintedCookie = false;
  if (!cookieId) {
    cookieId = crypto.randomUUID();
    mintedCookie = true;
  }

  // Publishes the response headers for a verdict. Runs on EVERY path, the identity refusal
  // included, so a refused browser still receives its cookie and succeeds on the next request.
  const publish = (v) => {
    if (!res || typeof res.setHeader !== 'function' || res.headersSent) return v;
    if (mintedCookie) {
      // httpOnly so page script cannot read or forge it; SameSite=Lax is enough because
      // both guarded routes are same-origin POSTs from our own page.
      res.setHeader(
        'Set-Cookie',
        `${DAY_CAP_COOKIE}=${cookieId}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`
      );
    }
    if (v.remaining !== null && v.remaining !== undefined) {
      res.setHeader(REMAINING_HEADER, String(v.remaining));
    }
    // Both guarded routes send Access-Control-Allow-Origin '*'. Without this the browser hides
    // REMAINING_HEADER from page script on any cross-origin call. It is an OPERATIONS witness
    // for the live deploy check ONLY -- no user is ever shown a number.
    res.setHeader('Access-Control-Expose-Headers', REMAINING_HEADER);
    return v;
  };

  // IDENTITY FAIL-CLOSED. With no device header AND no returning cookie there is nothing to
  // count against, so a client that simply ignores Set-Cookie would present a permanently
  // fresh identity on every request -- an uncapped path straight to the paid models. Refuse
  // instead. The cookie is still issued on this refusal, so a real browser's very next
  // request carries one and is served normally.
  //
  // This excludes no real user: the app already requires localStorage for the child profile,
  // so any client that can use the app at all can hold both a device id and a cookie.
  if (!deviceId && !returningCookieId) {
    return publish({ allowed: false, remaining: 0, reason: 'identity-required' });
  }

  const verdict = await checkDayCap({
    deviceId,
    cookieId,
    founderToken: headers[FOUNDER_HEADER],
  });

  return publish(verdict);
}
