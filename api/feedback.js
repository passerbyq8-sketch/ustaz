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
// 🔴 SIGNING IN IS NOW THE PRICE OF SENDING, AND THAT REVERSES WHAT THIS FILE USED TO SAY.
// Until 2026-09-13 this route took no session at all, on the reasoning written here in full: «a
// complaint that costs an account is a complaint that is never made». THE OWNER OVERRULED IT, and
// the reason is the half that reasoning never had — THERE WAS NOWHERE TO SEND THE ANSWER. A
// message from nobody can be read and cannot be replied to, so every reader who wrote one got
// silence back, and silence is its own way of never being complained to. The account is what
// makes «اقتراح أو شكوى» a conversation instead of a suggestion box with no lid.
//
// THE CLIENT AND THIS ROUTE AGREE ON ONE WORD FOR IT. A caller with no live session is answered
// 401 `feedback-signin-required`, and app.jsx opens the sign-in panel on that exact code — and on
// its own prior check, so the ordinary path never spends a request to be told this.
//
// PRIVACY — and what is persisted is ONE opaque account key more than before, never an identity.
//   * No name, no address, no IP and no device id. The `accountKey` is `acct:v1:<provider>:<sub>`,
//     an opaque string no screen in this application has ever shown a human — see
//     lib/articles/roles.js on exactly that point. The address the owner reads beside a message
//     is fetched at DISPLAY time from the account record by api/inbox.js and is stored nowhere
//     here, so deleting an account takes the only copy of it with it. That is decision ج١.
//   * No question, no answer, no conversation, no excerpt, no band and no mode. The reader's
//     words reach this route only as the sentence they typed INTO THIS FORM.
//   * The device id is an EPHEMERAL THROTTLE KEY and never enters `record` — the rule
//     api/report.js:80 states for the IP, restated here for the device. It is the throttle key
//     precisely BECAUSE it is not the IP: the IP is a fact about a network, the device id is an
//     opaque random string the client minted for itself and can throw away.
//
// AND THERE IS NO FOUNDER BYPASS AND NO OWNER EXEMPTION — DECISION ج٤. Three a day is the owner's
// ceiling too. A cap whose author is exempt is a cap its author has never actually met, and no
// branch below reads a role, a rank or a founder token before counting.
//
// NOT IN vercel.json, on purpose: fifteen of the twenty-three routes are not, and the two reasons
// to be listed there — a longer maxDuration, or bundling an extra file in — are neither of them
// true for a handler that writes one short string to a list.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { applyCorsOrigin } from '../lib/ratelimit.js';
import { DEVICE_HEADER, DAY_CAP_TTL_SECONDS, kuwaitDayStamp, safeId } from '../lib/daycap.js';
import { touchSession } from '../lib/auth/account.js';
import appVersionFile from '../config/app-version.json' with { type: 'json' };

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// The three kinds the menu offers, and nothing else is a kind. An unknown type is a malformed
// submission rather than a submission to file under a fourth heading nobody reads.
const TYPES = new Set(['suggestion', 'complaint', 'bug']);

// EXPORTED BECAUSE api/inbox.js REPLIES UNDER THIS CEILING AND MUST NOT RE-TYPE IT. A reply and
// the message it answers are the same kind of thing at the same length, and two constants holding
// 1200 in two files is one edit away from an owner discovering the drift by having a sentence cut
// in half. One number, one owner, imported by the other route.
export const TEXT_CAP = 1200;      // characters. The form's own maxLength is the same number.
const CONTACT_CAP = 120;    // characters, and OPTIONAL — its absence is not an error.

// Body cap — DERIVED, not guessed, from the two caps above:
//   (1200 + 120) characters  x  2 bytes/character (the UTF-8 upper bound for Arabic)  = 2640
//   + the small `type` field and the JSON frame, with room to spare                   = 8192
// A body over this is not a long complaint, it is a caller that is not the form.
// THE SESSION TRAVELS INSIDE THIS SAME CAP AND DID NOT MOVE IT: it is a base64url store key of
// about forty characters, which is inside the "room to spare" the line above already held.
const BODY_BYTES_CAP = 8192;

// Three a day. Kuwait's calendar day, because that is the day the whole app counts in
// (lib/daycap.js kuwaitDayStamp) and two notions of "today" in one app is one too many.
//
// 🔴 TWO COUNTERS NOW, AND THE LARGER ONE WINS — DECISION ج٣. The ceiling moved ONTO THE ACCOUNT,
// because that is what a person is here now and a device is not: three messages a day from one
// person stayed three no matter how many browsers they opened. The DEVICE counter is kept beside
// it as a second guard rather than replaced by it — it is the one that still counts when a person
// holds several accounts — and passing EITHER is a 429. That is the same both-counters-judged-by-
// the-larger shape lib/daycap.js already uses for the question cap, and it is deliberately the
// same shape: one idea of "the day's allowance" in this application, not two.
const DEVICE_CAP = 3;
const ACCOUNT_CAP = 3;

const FEEDBACK_KEY = 'feedback';
const FEEDBACK_KEEP = 5000; // LTRIM 0 4999 — the newest 5000 only; bounded on the free tier.

// THE VERSION FIELD -- ITEM 106. One source of truth, config/app-version.json, read by both ends:
// tools/build-app.cjs writes it into app.js and the client sends it as `appv`; this route imports
// the same file. The client's value is kept only if it has the shape a build writes.
//
// ITEM 107 -- AND ANYTHING ELSE IS STORED AS '', NO LONGER REPLACED BY THE SERVER'S COPY. A message
// often comes from an old bundle cached on a returning reader, and stamping THIS build on it recorded
// a version that reader was not running. '' says "unknown", and the owner's inbox draws it as a dash.
// APP_VERSION is now read by nothing on this route. It stays, with its import, because
// tools/build-app.cjs states that this route imports the same file, and removing it is that tool's
// comment going false in a change that was not allowed to open it.
const APP_VERSION = typeof appVersionFile.app_version === 'string' ? appVersionFile.app_version : '';
const APPV_RE = /^[A-Za-z0-9._-]{1,40}$/;
// ONE RULE FOR THE VERSION IN BOTH ROUTES (api/report.js record.appv): the client's value if it has a build's shape, else ''.
function appvOf(v) {
  return typeof v === 'string' && APPV_RE.test(v) ? v : '';
}

// Coerce to string and hard-cut to `n` characters. Non-strings collapse to ''. Copied from
// api/report.js so the two routes cut identically.
function cut(v, n) {
  if (typeof v !== 'string') return '';
  return v.length > n ? v.slice(0, n) : v;
}

/**
 * THE MESSAGE'S OWN NAME, MINTED AT SAVE TIME — DECISION ج٦.
 *
 * 🔴 AND NEVER THE INDEX IN THE LIST. This is an LPUSH list: every new message shifts every older
 * one down by one, so an index names a different record on every read and a reply filed against
 * index 3 would answer somebody else's message by lunchtime. The id is minted here, once, and
 * travels with the record for as long as it exists.
 *
 * IT IS randomUUID AND NOT A GENERATOR LIFTED FROM lib/, AND THAT WAS MEASURED RATHER THAN
 * ASSUMED. lib/ holds exactly two id minters -- newArticleId() in lib/articles/store.js and
 * newSessionId() in lib/auth/account.js -- and both are DOMAIN-BOUND: one names an article, the
 * other is 32 bytes of secret standing in for a signed-in person. A message is neither, and
 * importing the articles store into this route would drag a sorted-set index and a slug table in
 * behind one line. node:crypto is already the source both of those minters draw on.
 */
function newMessageId() {
  return crypto.randomUUID();
}

/**
 * THE ACCOUNT'S DAY COUNTER IS KEYED BY A DIGEST OF THE ACCOUNT, NOT BY THE ACCOUNT.
 *
 * Every value that lands inside a key in this repository is validated rather than trusted --
 * lib/daycap.js safeId() and lib/articles/store.js safeAccountKey() both say so in their own
 * words. A digest satisfies that rule by CONSTRUCTION instead of by a test: sixty-four hex
 * characters cannot carry a separator, so no account key, however malformed, can name a key this
 * route did not mean to touch. It also means the key space itself holds no account identifiers,
 * so a person reading the store's key list learns how many people wrote today and nothing about
 * who any of them are.
 */
function accountDayKey(accountKey) {
  const digest = crypto.createHash('sha256').update(accountKey, 'utf8').digest('hex').slice(0, 32);
  return 'fb:v1:a:' + digest + ':' + kuwaitDayStamp();
}

/**
 * ONE DAY COUNTER, READ AND JUDGED. Returns 'ok', 'over' or 'unreadable'.
 *
 * FAIL CLOSED ON 'unreadable', and that is the same rule the device counter has always had here:
 * a MISSING key is zero -- the normal first message of the day -- while a key that EXISTS and will
 * not parse is a number we are holding and cannot read, and calling that zero would hand out an
 * unlimited allowance. Written once and called twice so the two counters cannot come to disagree
 * about what an unreadable number means.
 */
async function dayCount(key, cap) {
  const used = await redis.get(key);
  if (used === null || used === undefined || used === '') return 'ok';
  const n = typeof used === 'number' ? used : Number.parseInt(String(used), 10);
  if (!Number.isFinite(n)) return 'unreadable';
  return n >= cap ? 'over' : 'ok';
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

  // ---- THE SESSION, AND IT IS NOW A CONDITION OF SENDING. ----
  //
  // 🔴 IT IS touchSession() AND NOT resolveActor(). That function is the WRITER'S door and it
  // answers null for the role `none` -- by design, and see its own header: «an actor object is a
  // permission and `none` is the absence of one». EVERY ORDINARY READER OF THIS APPLICATION HOLDS
  // `none`, so resolving here through it would have closed this form to everybody except the
  // owner and the editors -- which is the opposite of what a complaint box is for. What is asked
  // at this door is «is there a person here», not «what may this person do», and touchSession()
  // is the seam that already answers exactly that question. api/auth-delete.js asks it the same
  // way, over the same `body.session`, for the same reason.
  //
  // NO SECOND SESSION MECHANISM IS CREATED AND NO Authorization HEADER IS READ: the session
  // arrives in the body, as it does at every other door in this tree.
  const session = typeof body.session === 'string' ? body.session : '';
  let accountKey = '';
  if (session) {
    try {
      const held = await touchSession(session);
      if (held && typeof held.accountKey === 'string') accountKey = held.accountKey;
    } catch (e) {
      // A store fault while resolving a session is NOT a signed-out reader, and must not be
      // reported as one: telling a signed-in person to sign in again would send them round a loop
      // that cannot end while the store is down. It is the same 503 every other fault here gets.
      console.warn('[feedback] session unreachable, fail-CLOSED:', e && e.message ? e.message : e);
      return res.status(503).json({ error: 'could not save feedback; please try again later' });
    }
  }
  // THE ONE CODE THE CLIENT OPENS THE SIGN-IN PANEL ON. It is spelled out rather than generic
  // precisely so app.jsx can act on it without parsing prose, and both ends name it in one word.
  if (!accountKey) {
    return res.status(401).json({ error: 'feedback-signin-required' });
  }

  // ---- THE TWO THROTTLES. The device id is used HERE and is not referenced again below. ----
  //
  // FAIL CLOSED, like everything else on this route. A store we cannot count against is a store
  // we cannot write to either, and the caller is about to be told so; refusing here rather than
  // waving the message through keeps one outcome for one fault instead of two.
  const device = safeId(req.headers[DEVICE_HEADER]);
  if (!device) {
    return res.status(400).json({ error: 'device id required' });
  }
  const dayKey = 'fb:v1:d:' + device + ':' + kuwaitDayStamp();
  const acctKey = accountDayKey(accountKey);
  try {
    // DECISION ج٣: EITHER counter over its ceiling is a 429, so the ceiling a reader actually
    // meets is the LOWER of the two allowances rather than their sum. Read together, judged
    // together, and neither of them consults a role -- decision ج٤ is enforced by the ABSENCE of
    // a branch here, which is the only way an exemption can be absent for good.
    const [byDevice, byAccount] = await Promise.all([
      dayCount(dayKey, DEVICE_CAP),
      dayCount(acctKey, ACCOUNT_CAP),
    ]);
    if (byDevice === 'unreadable' || byAccount === 'unreadable') {
      console.warn('[feedback] day counter unreadable, fail-CLOSED');
      return res.status(503).json({ error: 'could not save feedback; please try again later' });
    }
    if (byDevice === 'over' || byAccount === 'over') {
      return res.status(429).json({ error: 'daily feedback limit reached' });
    }
  } catch (e) {
    console.warn('[feedback] day counter unreachable, fail-CLOSED:', e && e.message ? e.message : e);
    return res.status(503).json({ error: 'could not save feedback; please try again later' });
  }

  // The ONLY thing persisted. A whitelist and not a filtered copy of the body: a field the client
  // invents cannot arrive here by being spelled unexpectedly, because nothing is copied across.
  // No device, no IP, no place, no name, no address, and not one character of any conversation.
  //
  // SEVEN FIELDS, AND THE TWO NEW ONES ARE `id` AND `accountKey` -- DECISIONS ج٦ AND ج١. The id
  // is minted here so a reply can name this message for as long as it exists; the account key is
  // an opaque store key, not an identity, and it is what lets an answer find its way back. The
  // address that answer is addressed to is never written here: api/inbox.js fetches it from the
  // account record at display time, so deleting an account takes the only copy of it.
  const record = {
    id: newMessageId(),
    type: body.type,
    text,
    contact,
    appv: appvOf(body.appv),
    ts: new Date().toISOString(),
    accountKey,
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
  // charge them for the attempt the store lost. BOTH counters move together, for the same reason
  // they are read together: a device counted without its account, or the reverse, is an allowance
  // one of the two guards has silently stopped guarding.
  try {
    await redis.incr(dayKey);
    await redis.expire(dayKey, DAY_CAP_TTL_SECONDS);
    await redis.incr(acctKey);
    await redis.expire(acctKey, DAY_CAP_TTL_SECONDS);
  } catch (e) {
    // The message IS saved. Saying otherwise now would be the lie this route exists to avoid, so
    // the ceiling is what degrades here, and it degrades loudly rather than silently.
    console.warn('[feedback] saved but NOT counted:', e && e.message ? e.message : e);
  }

  return res.status(200).json({ ok: true });
}
