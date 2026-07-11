// ============================================================
// Abuse-report intake — نقطةُ التبليغ  (api/report.js)
// ============================================================
// A child (or parent) flags a tutor reply as wrong or inappropriate. This is a
// MANDATORY SAFETY feature, so unlike the throttles it FAILS CLOSED: if the store
// is unreachable we return 503 and tell the caller the truth. A silent success --
// the child believing the report was sent while it vanished -- is worse than useless.
//
// PRIVACY: we persist ONLY the whitelisted fields below. No name, no id, and NO IP.
// The IP is used solely as an ephemeral throttle key; it is never written to Redis.
// A child reports; a child is not logged.
//
// Shape mirrors api/tashkeel.js: same CORS, same method guard, same Redis wiring via
// the KV_REST_API_* vars Vercel injects. The throttle lives in lib/ratelimit.js.

import { Redis } from '@upstash/redis';
import { checkReportLimit } from '../lib/ratelimit.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Body cap — MEASURED, not guessed (step 2a-d):
//   longest worship card = 3405 codepoints (adult "صفةُ الصلاة", worship-golden.json)
//   cap = (3405 chars  x  2 fields [ai, user]  x  2 bytes/char)  +  8 KB margin
//       =  13620  +  8192  =  21812 bytes
// The two large fields (ai, user) can each carry a full worship card back; 2 bytes/char
// is the UTF-8 upper bound for Arabic (measured ratio ~1.83). The small fields
// (reason/band/mode/note) fit inside the 8 KB margin. Re-derive if a longer card is ever
// added -- do not nudge this by hand.
const LONGEST_CARD_CHARS = 3405;
const MAX_REPORT_BODY_BYTES = (LONGEST_CARD_CHARS * 2 * 2) + 8 * 1024; // 21812

const AI_USER_CAP = LONGEST_CARD_CHARS * 2; // 6810 — a reply may quote a whole card
const NOTE_CAP = 500;
const MODE_CAP = 40;

const REASONS = new Set(['wrong_info', 'wrong_ruling', 'inappropriate', 'other']);
const BANDS = new Set(['young', 'teen', 'adult']);

const REPORTS_KEY = 'reports';
const REPORTS_KEEP = 5000; // LTRIM 0 4999 — newest 5000 only; bounded on the free tier

// Coerce to string and hard-cut to `n` characters. Non-strings collapse to ''.
function cut(v, n) {
  if (typeof v !== 'string') return '';
  return v.length > n ? v.slice(0, n) : v;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Hard INPUT cap (measured). Mirrors api/chat.js: same byteLength measure, 413 on over.
  const bodyBytes = Buffer.byteLength(
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    'utf8'
  );
  if (bodyBytes > MAX_REPORT_BODY_BYTES) {
    return res.status(413).json({ error: 'report too large' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  // reason is the one strict gate: an unknown reason is a malformed report -> 400.
  if (!REASONS.has(body.reason)) {
    return res.status(400).json({ error: 'invalid reason' });
  }
  // band is validated but soft: an unknown band is dropped, not rejected.
  const band = BANDS.has(body.band) ? body.band : '';

  // The IP is an EPHEMERAL throttle key ONLY. It never enters `record`.
  const ip = req.headers['x-real-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || 'unknown';
  const rl = await checkReportLimit(ip);
  if (!rl.ok) {
    return res.status(429).json({ error: 'report rate limit exceeded' });
  }

  // The ONLY thing persisted. Whitelist -- nothing outside these keys reaches Redis.
  const record = {
    reason: body.reason,
    note: cut(body.note, NOTE_CAP),
    ai: cut(body.ai, AI_USER_CAP),
    user: cut(body.user, AI_USER_CAP),
    band,
    mode: cut(body.mode, MODE_CAP),
    ts: new Date().toISOString(),
  };

  // FAIL CLOSED. If Redis is down, LPUSH throws -> we catch -> 503 + a loud log. We do
  // NOT swallow it: a report that silently evaporates is a dead safety feature, and the
  // caller must learn the truth so it can retry or tell a human.
  try {
    await redis.lpush(REPORTS_KEY, JSON.stringify(record));
    await redis.ltrim(REPORTS_KEY, 0, REPORTS_KEEP - 1);
  } catch (e) {
    console.error('[report] STORE FAILED — report NOT saved:', e && e.message ? e.message : e);
    return res.status(503).json({ error: 'could not save report; please try again' });
  }

  return res.status(200).json({ ok: true });
}
