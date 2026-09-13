// ============================================================
// Suggestions and complaints — نقطةُ الاقتراحِ والشكوى  (api/feedback.js)
// ============================================================
// A reader presses «اقتراح أو شكوى» in the side menu, types a sentence and sends it. That is the
// whole of the feature and the whole of what this route is allowed to know about them.
//
// SHAPE COPIED FROM api/report.js, STORE DELIBERATELY NOT. Same CORS, same method guard, same
// Redis wiring through the KV_REST_API_* vars Vercel injects, same measured body cap, same
// fail-CLOSED answer. But the list is its own — 'feedback', never 'reports' — because the two
// carry different things and are read by different eyes: a report is a SAFETY signal about one
// reply and the abuse queue is where a human has to look for it; a suggestion is product post.
// Mixing them would bury the first under the second.
//
// PRIVACY — and this route persists LESS than the report route, not the same.
//   * No name, no id, no account, no session and no IP. There is no sign-in step anywhere in
//     front of this: a complaint that costs an account is a complaint that is never made.
//   * No question, no answer, no conversation, no excerpt, no band and no mode. The reader's
//     words reach this route only as the sentence they typed INTO THIS FORM.
//   * The device id is an EPHEMERAL THROTTLE KEY and never enters `record` — the rule
//     api/report.js:80 states for the IP, restated here for the device. It is the throttle key
//     precisely BECAUSE it is not the IP: the IP is a fact about a network, the device id is an
//     opaque random string the client minted for itself and can throw away.
//
// AND THERE IS NO FOUNDER BYPASS. Three a day is the owner's ceiling too. A cap whose author is
// exempt is a cap its author has never actually met.
//
// NOT IN vercel.json, on purpose: fifteen of the twenty-three routes are not, and the two reasons
// to be listed there — a longer maxDuration, or bundling an extra file in — are neither of them
// true for a handler that writes one short string to a list.

import { Redis } from '@upstash/redis';
import { applyCorsOrigin } from '../lib/ratelimit.js';
import { DEVICE_HEADER, DAY_CAP_TTL_SECONDS, kuwaitDayStamp, safeId } from '../lib/daycap.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// The three kinds the menu offers, and nothing else is a kind. An unknown type is a malformed
// submission rather than a submission to file under a fourth heading nobody reads.
const TYPES = new Set(['suggestion', 'complaint', 'bug']);

const TEXT_CAP = 1200;      // characters. The form's own maxLength is the same number.
const CONTACT_CAP = 120;    // characters, and OPTIONAL — its absence is not an error.

// Body cap — DERIVED, not guessed, from the two caps above:
//   (1200 + 120) characters  x  2 bytes/character (the UTF-8 upper bound for Arabic)  = 2640
//   + the small `type` field and the JSON frame, with room to spare                   = 8192
// A body over this is not a long complaint, it is a caller that is not the form.
const BODY_BYTES_CAP = 8192;

// Three a day, per device. Kuwait's calendar day, because that is the day the whole app counts in
// (lib/daycap.js kuwaitDayStamp) and two notions of "today" in one app is one too many.
const DEVICE_CAP = 3;

const FEEDBACK_KEY = 'feedback';
const FEEDBACK_KEEP = 5000; // LTRIM 0 4999 — the newest 5000 only; bounded on the free tier.

// THE VERSION FIELD, AND IT IS HONESTLY EMPTY. This app declares no version constant anywhere —
// not in app.jsx, not in index.html, and package.json's 1.0.0 has never been bumped or shipped,
// so it names nothing. `appv` is kept as a field because the day a real version constant exists
// it belongs here and the stored records should be one shape throughout; it is '' until then,
// because a fabricated version on a bug report is worse than no version at all.
const APP_VERSION = '';

// Coerce to string and hard-cut to `n` characters. Non-strings collapse to ''. Copied from
// api/report.js so the two routes cut identically.
function cut(v, n) {
  if (typeof v !== 'string') return '';
  return v.length > n ? v.slice(0, n) : v;
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Hard INPUT cap. Measured on the same byteLength as api/report.js and api/chat.js.
  const bodyBytes = Buffer.byteLength(
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    'utf8'
  );
  if (bodyBytes > BODY_BYTES_CAP) {
    return res.status(413).json({ error: 'feedback too large' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  if (!TYPES.has(body.type)) {
    return res.status(400).json({ error: 'invalid type' });
  }

  // The text is cut FIRST and judged after. A body of 1200 spaces is not a message, and neither
  // is a body that was nothing but whitespace to begin with.
  const text = cut(body.text, TEXT_CAP).trim();
  if (!text) {
    return res.status(400).json({ error: 'empty text' });
  }

  // Optional, and its absence is not an error — that is the whole contract of this field.
  const contact = cut(body.contact, CONTACT_CAP).trim();

  // ---- THE THROTTLE. The device id is used HERE and is not referenced again below. ----
  //
  // FAIL CLOSED, like everything else on this route. A store we cannot count against is a store
  // we cannot write to either, and the caller is about to be told so; refusing here rather than
  // waving the message through keeps one outcome for one fault instead of two.
  const device = safeId(req.headers[DEVICE_HEADER]);
  if (!device) {
    return res.status(400).json({ error: 'device id required' });
  }
  const dayKey = 'fb:v1:d:' + device + ':' + kuwaitDayStamp();
  try {
    const used = await redis.get(dayKey);
    // A MISSING key is zero — the normal first message of the day. A key that EXISTS and will not
    // parse is a number we are holding and cannot read, and calling that zero would hand out an
    // unlimited allowance. lib/daycap.js fails closed on exactly this case; so does this.
    if (used !== null && used !== undefined && used !== '') {
      const n = typeof used === 'number' ? used : Number.parseInt(String(used), 10);
      if (!Number.isFinite(n)) {
        console.warn('[feedback] day counter unreadable, fail-CLOSED');
        return res.status(503).json({ error: 'could not save feedback; please try again later' });
      }
      if (n >= DEVICE_CAP) {
        return res.status(429).json({ error: 'daily feedback limit reached' });
      }
    }
  } catch (e) {
    console.warn('[feedback] day counter unreachable, fail-CLOSED:', e && e.message ? e.message : e);
    return res.status(503).json({ error: 'could not save feedback; please try again later' });
  }

  // The ONLY thing persisted. A whitelist and not a filtered copy of the body: a field the client
  // invents cannot arrive here by being spelled unexpectedly, because nothing is copied across.
  // No device, no IP, no place, no name, and not one character of any conversation.
  const record = {
    type: body.type,
    text,
    contact,
    appv: APP_VERSION,
    ts: new Date().toISOString(),
  };

  // FAIL CLOSED. If the store is down, LPUSH throws, we catch, and the caller is told the truth.
  // Telling a reader «أُرسِلَتْ» about a message that evaporated is the one answer this route is
  // forbidden to give: they would stop typing it and nobody would ever read it.
  try {
    await redis.lpush(FEEDBACK_KEY, JSON.stringify(record));
    await redis.ltrim(FEEDBACK_KEY, 0, FEEDBACK_KEEP - 1);
  } catch (e) {
    console.error('[feedback] STORE FAILED — feedback NOT saved:', e && e.message ? e.message : e);
    return res.status(503).json({ error: 'could not save feedback; please try again later' });
  }

  // COUNTED ONLY AFTER IT LANDED. A message that failed to save must not spend one of the three:
  // the reader is being asked to send it again, and a counter incremented before the write would
  // charge them for the attempt the store lost.
  try {
    await redis.incr(dayKey);
    await redis.expire(dayKey, DAY_CAP_TTL_SECONDS);
  } catch (e) {
    // The message IS saved. Saying otherwise now would be the lie this route exists to avoid, so
    // the ceiling is what degrades here, and it degrades loudly rather than silently.
    console.warn('[feedback] saved but NOT counted:', e && e.message ? e.message : e);
  }

  return res.status(200).json({ ok: true });
}
