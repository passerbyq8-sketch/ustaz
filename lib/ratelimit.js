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

import crypto from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { DAY_CAP_COOKIE, DEVICE_HEADER, safeId } from './daycap.js';

// Paid-search caller identity. The app has no server-side account database today, but this seam
// prefers a framework-authenticated account as soon as one exists. Otherwise it charges BOTH the
// validated device header and the server-minted httpOnly cookie. Clearing just one therefore does
// not reset the caller allowance. Only HMAC digests leave this function; raw identifiers are never
// returned, stored, or logged.
const SEARCH_BUDGET_IDENTITY_SECRET_ENV = 'SEARCH_BUDGET_IDENTITY_SECRET';

function ownObject(parent, key) {
  return parent && Object.prototype.hasOwnProperty.call(parent, key)
    && parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key])
    ? parent[key] : null;
}

function safeAccountId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const out = String(value).trim();
  return out && out.length <= 256 && !/[\u0000-\u001F\u007F]/u.test(out) ? out : '';
}

function authenticatedAccountId(req) {
  const auth = ownObject(req, 'auth');
  if (auth) {
    for (const field of ['accountId', 'userId', 'sub']) {
      const value = safeAccountId(auth[field]);
      if (value) return value;
    }
  }
  const user = ownObject(req, 'user');
  if (user && user.authenticated === true) return safeAccountId(user.accountId || user.id);
  const session = ownObject(req, 'session');
  const sessionUser = session && ownObject(session, 'user');
  if (sessionUser && sessionUser.authenticated === true) {
    return safeAccountId(sessionUser.accountId || sessionUser.id);
  }
  return '';
}

function cookieValue(req, name) {
  const raw = req && req.headers && typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  for (const part of raw.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(at + 1).trim()); } catch { return ''; }
  }
  return '';
}

function identityDigest(kind, raw, secret) {
  return crypto.createHmac('sha256', secret)
    .update(`ezik-search-budget-v2|${kind}|${raw}`)
    .digest('base64url');
}

export function searchBudgetCallerDigests(req, env = process.env) {
  const secret = String((env && env[SEARCH_BUDGET_IDENTITY_SECRET_ENV])
    || (env && env.FOUNDER_SECRET) || '');
  if (!secret) return [];
  const account = authenticatedAccountId(req);
  if (account) return [identityDigest('account', account, secret)];

  const headers = (req && req.headers) || {};
  const rawDevice = Array.isArray(headers[DEVICE_HEADER]) ? headers[DEVICE_HEADER][0] : headers[DEVICE_HEADER];
  const device = safeId(rawDevice);
  const cookie = safeId(cookieValue(req, DAY_CAP_COOKIE));
  const digests = [];
  if (device) digests.push(identityDigest('device', device, secret));
  if (cookie) digests.push(identityDigest('cookie', cookie, secret));
  return [...new Set(digests)];
}

// ---------------------------------------------------------------------------
// CORS ORIGIN WHITELIST — ONE PLACE, EIGHT DOORS.
//
// Every endpoint under api/ used to answer `Access-Control-Allow-Origin: '*'`,
// eight separate literals in eight files: ask, chat, chat-fast, tts, stt,
// tashkeel, report, unlock. '*' tells every browser on the internet that any
// page may read our replies, so any site could drive the relays from a visitor's
// browser and read what came back. Eight copies of a decision is one decision
// waiting to drift, so the decision lives HERE — beside MAX_CHAT_BODY_BYTES, for
// the same reason that one does.
//
// WHAT THIS IS NOT: CORS is a BROWSER protection, not a server one. curl, a
// script, or anything that is not a browser ignores every header below. This
// stops a hostile PAGE from reading our responses in a visitor's browser; it
// does not stop a determined caller. The throttles, the day cap and the consent
// guard are what stop those, and none of them change here.
//
// Consequently a request with NO `Origin` header at all is NOT blocked — it is
// simply answered without an ACAO header. Same-origin fetches, server-to-server
// calls and the app's own service worker all arrive that way; refusing them
// would break the app while stopping nothing.
export const ALLOWED_ORIGINS = Object.freeze([
  'https://ezik.app',
  'https://almurabbi.app',
  'https://ustaz-two.vercel.app',
]);

// Sets `Vary: Origin` ALWAYS (the response body-visibility genuinely varies by
// Origin, so a shared cache must not serve one origin's answer to another), and
// echoes the origin back in `Access-Control-Allow-Origin` ONLY when it is on the
// list above. A non-listed origin gets NO ACAO header at all — not `null`, not
// '*', absent — which is what makes the browser refuse to hand the body to the
// calling page. Returns true when the origin was allowed, for callers that want
// to log it. Never throws and never ends the response: the status ladder
// (403 consent -> 400 shape -> 429 throttle) is untouched by this function.
export function applyCorsOrigin(req, res) {
  res.setHeader('Vary', 'Origin');
  const origin = req && req.headers ? req.headers.origin : undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    return true;
  }
  return false;
}

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
// د-٢ — سقفا الشخصِ بعد «الدفعة»: 20 ⟶ 40 في الدقيقة، و300 ⟶ 400 في اليوم.
//
// السببُ سلوكيٌّ لا سخاء. رسالةٌ واحدةٌ فيها عشرون سؤالًا مرقّمًا صارت عشرين طلبَ /api/ask
// متتابعًا (د-١ في index.html)، فما كان «رسالةً واحدة» في حسابِ المستخدمِ صار عشرين في حسابِ
// السقف. وسقفُ العشرينِ في الدقيقةِ كان سيقطعُ اللصقةَ الواحدةَ في منتصفِها — لا لأنّ صاحبَها
// أساءَ، بل لأنّه فعلَ بالضبطِ ما فُتحت له الشاشة. والأربعون تُبقي لَصقةَ العشرينِ كاملةً ومعها
// متّسعٌ لسؤالٍ عاديٍّ بعدَها في الدقيقةِ نفسِها.
//
// والأربعُمئةِ يوميًّا هي عشرون لصقةً كاملةً في اليوم، أو مزيجُها بالأسئلةِ المفردة.
// الرقمان اجتهادُ Claude لا أمرُ مالك: تبديلُهما كلمةٌ منه، لا مراجعةُ تصميم.
//
// ولم يُمَسَّ شيءٌ آخر: fail-open كما هو، والسقفُ العامُّ (ASK_GLOBAL_DAY) وسقوفُ الصوتِ
// والتقاريرِ على حالِها — الدفعةُ لم تُغيّر شيئًا من أسبابِها.
const ASK_PER_IP_MIN = 40;
const ASK_PER_IP_DAY = 400;
// THE GLOBAL KILL-SWITCH, AND IT IS NOW A NUMBER SOMEBODY CAN SET.
//
// It was a hard-coded 800: twenty closed testers at forty messages a day. The app is open now, so
// that figure is not a ceiling on abuse — it is a ceiling on USE, and it is the one switch that
// takes the service down for every reader at once. Moving it required a deploy.
//
// The default is re-derived for an open app rather than merely raised out of the way, and an
// operator can now set ASK_GLOBAL_DAY without a build. NO ENVIRONMENT VARIABLE IS SET BY THE
// CHANGE THAT INTRODUCED THIS: the default in the code is the whole of it.
//
// `|| 20000` and not `??` on purpose — an empty string, a non-numeric value or an explicit 0 all
// mean "not configured" here, and a global cap of zero would take the app down on the first
// request of the day. A deliberate zero is not something this switch should be able to express.
const ASK_GLOBAL_DAY = Number(process.env.ASK_GLOBAL_DAY) || 20000;

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
//   POSTs to each, zero throttle. CORS was '*' (now an origin whitelist, above), and the client supplies `system`,
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
//    So the cap was set at 2x the worst real body above. It is 2MiB today, not that first
//    figure: an inline base64 image has to fit too -- see the DELIBERATE DECISION on the export
//    line below. Still a hard bound on the input side of a single request (Vercel would
//    otherwise accept 4.5 MB, ~1.1M tokens).
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
