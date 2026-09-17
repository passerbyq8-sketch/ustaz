// ============================================================
// The owner's inbox — صندوقُ رسائلِ المالك  (api/inbox.js)
// ============================================================
// ONE DOOR, SIX ACTIONS, TWO AUDIENCES. The owner reads what readers sent and answers it; a
// reader reads the answer to their own message and nothing else. Both halves are here because
// they are one feature and a reply written on one route and read on another is two routes that
// eventually disagree about what a reply is.
//
// SHAPE COPIED FROM api/roles-admin.js, LETTER FOR LETTER WHERE IT COULD BE: the same
// applyCorsOrigin, the same OPTIONS answer, the same method guard, the same checkAuthLimit over
// clientAddress, the same `action` dispatch out of the body, the same Cache-Control, and the same
// single 401 for everybody who is not the owner. What is NOT copied is that file's store: roles
// live behind lib/articles/store.js and these five keys live in the same Upstash instance
// api/feedback.js already writes its list into, reached the way api/feedback.js reaches it.
//
// 🔴 ONE REFUSAL FOR A STRANGER AND FOR A SIGNED-IN READER ALIKE, and it is one `return`
// statement rather than two that happen to match today. This is DECISION D-5, taken by the owner
// on 2026-09-07 for api/roles-admin.js and restated here because the reasoning did not change
// with the surface: two different statuses would tell whoever asks that this address is a
// privilege surface and would let them use their own session as an oracle for which rank they
// hold. A reader who never learns that an owner's inbox exists cannot be phished at it.
//
// 🔴 THE MESSAGE RECORD CARRIES NO ADDRESS AND NO NAME -- DECISION ج١. What api/feedback.js
// stores is an `accountKey` and nothing else about the person; the address the owner reads is
// fetched HERE, at display time, out of the account record, and only for the one message he
// actually opened. So the list he scrolls carries no address at all, the store holds none, and
// deleting an account takes the only copy of it with it.
//
// 🔴 AND THE STATE IS DERIVED, NEVER STORED TWICE -- DECISION ج٨. A reply exists => answered; else
// a read mark exists => read; else new. Three states out of two keys, so there is no fourth state
// to get into and no pair of fields that can contradict each other.
//
// 🔴 FAIL CLOSED, AND AN EMPTY INBOX IS NEVER SHOWN FOR A DEAD STORE. Every store fault on every
// action answers 503 with a named code. Returning `[]` when the store could not be read would
// make "nobody has written to you" and "your store is gone" the same sentence on the same screen,
// which is the one outcome this route is forbidden to produce.
//
// 🔴 AND `delete` ERASES, IT DOES NOT HIDE -- RULINGS م١..م٤ OF 2026-09-13. There is no
// "deleted for the owner, still in the store" state, because a record nobody can see is a record
// nobody sweeps and it would sit in that list until the 5000-element trim happened to reach it.
// A delete therefore takes the element OUT of the list and takes its three dependent keys with it
// (م٢), which means THE SENDER LOSES THEIR COPY TOO -- their message and its reply both leave
// `mine`, because there is one record and it is gone (م٣). Nothing is recoverable and there is no
// second store holding a shadow of it (م٤). The owner was told all of this in those words before
// the action existed, and the screen says it again in the sentence it asks before it runs.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { DEVICE_HEADER } from '../lib/daycap.js';
import { resolveActor, ROLE_OWNER } from '../lib/articles/roles.js';
import { touchSession } from '../lib/auth/account.js';
import { readJson as readAuthJson } from '../lib/auth/store.js';
import { TEXT_CAP } from './feedback.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export const INBOX_ACTIONS = Object.freeze(['list', 'read', 'reply', 'delete', 'mine', 'seen']);

/** The four that are the owner's alone. Named once, so the gate below cannot drift from them. */
export const OWNER_ACTIONS = Object.freeze(['list', 'read', 'reply', 'delete']);

/**
 * The two lists, and they are the two keys that already exist. 'feedback' is api/feedback.js's
 * FEEDBACK_KEY and 'reports' is api/report.js's REPORTS_KEY -- neither is created here and
 * neither is written here except by `reply`, which writes a key of its own beside them.
 *
 * 🔴 'reports' IS READ-ONLY ON THIS ROUTE -- DECISION ج١٠. api/report.js is not opened for edit
 * (item 106 opened it for the `appv` version field, item 107 for the `source` tag), its records carry no account, and
 * no branch below can write into that list or answer one of its items. The refusal is STRUCTURAL
 * rather than a flag: `reply` searches the feedback list and only the feedback list, so an id that
 * belongs to a report is an id this route cannot find.
 */
const KINDS = Object.freeze(['feedback', 'reports']);

// How far back a single request looks. The lists are trimmed to 5000 by the two routes that write
// them, and 5000 records is not a page -- it is a download. This is the WINDOW every answer is
// computed over: the items, the states and the unread count all describe these newest 200 and
// nothing older, which is why the answer names the window rather than implying it covers the list.
const LIST_WINDOW = 200;

const REPLY_PREFIX = 'reply:v1:';
const READ_PREFIX = 'inbox:v1:read:';
const SEEN_PREFIX = 'inbox:v1:seen:';

/**
 * EVERYTHING THAT HANGS OFF ONE MESSAGE, NAMED ONCE -- RULING م٢. `delete` erases the record and
 * then erases these, and it reads this list rather than re-typing three prefixes, so a FOURTH
 * per-message key invented later is deleted by the act of being added here and cannot be left
 * behind as an orphan by a delete path that was written before it existed.
 */
const DEPENDENT_PREFIXES = Object.freeze([REPLY_PREFIX, READ_PREFIX, SEEN_PREFIX]);

/**
 * THE CEILING ON ONE `delete` REQUEST, AND IT IS THE DISPLAY WINDOW ITSELF rather than a second
 * number that happens to equal it today. The owner selects rows on a screen that shows at most
 * LIST_WINDOW of them, so a batch larger than the window could not have come from that screen.
 */
const DELETE_IDS_CAP = LIST_WINDOW;

// How many keys travel in one DEL. The whole-tab erase can hold 5000 messages x 3 keys, and one
// command carrying fifteen thousand arguments is a request the REST door is entitled to refuse.
const DELETE_KEY_BATCH = 60;

// The three states, derived. They are strings rather than numbers because they cross to a client
// that has to write them into a sentence, and a client translating 0/1/2 back into words is a
// second copy of this decision living somewhere nobody audits.
const STATE_NEW = 'new';
const STATE_READ = 'read';
const STATE_ANSWERED = 'answered';

// THE REPLY'S CEILING IS THE MESSAGE'S CEILING, IMPORTED AND NOT RETYPED. api/feedback.js owns
// that number; a copy of it here would be a second cap that drifts the day the first one moves,
// and the owner would discover the drift by having a sentence cut in half.
const REPLY_CAP = TEXT_CAP;

// An id that may be interpolated into a key. Two shapes reach this: the `id` minted at save time
// by api/feedback.js, and the `lg:` digest derived below for a record that predates the field.
// Anything else is refused rather than interpolated -- the discipline lib/daycap.js safeId() and
// lib/articles/store.js safeAccountKey() already apply, for the same reason: a value carrying an
// unexpected separator could otherwise name a key this route never meant to touch.
function safeInboxId(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^(lg:)?[A-Za-z0-9_.-]{1,64}$/.test(s) ? s : null;
}

/** Coerce to string and hard-cut to `n` characters. Copied from api/feedback.js so both cut identically. */
function cut(v, n) {
  if (typeof v !== 'string') return '';
  return v.length > n ? v.slice(0, n) : v;
}

/**
 * ONE STORED ELEMENT -> { text, obj }, OR null.
 *
 * WHY THE TEXT IS KEPT BESIDE THE OBJECT. The id of a record that predates the `id` field is
 * DERIVED FROM ITS OWN BODY (see idOf), so the exact string the store handed back is the thing
 * that must be hashed -- not a re-serialisation of a parsed object, whose key order would be an
 * accident of this code rather than a fact about the record.
 *
 * BOTH SHAPES ARE ACCEPTED BECAUSE BOTH ARE LAWFUL. The client's automatic deserialisation hands
 * back the string api/feedback.js pushed; a differently-configured client, or a value written by
 * some other hand, could hand back an object already. One path reads both, and a stored element
 * that is neither is dropped rather than becoming a half-record on the owner's screen.
 */
function recordOf(raw) {
  if (raw === null || raw === undefined) return null;
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  if (typeof text !== 'string' || text.length === 0) return null;
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { return null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return { text, obj };
}

/**
 * THE IDENTITY OF A MESSAGE -- DECISION ج٦ AND DECISION ج٢.
 *
 * 🔴 NEVER THE INDEX IN THE LIST. These are LPUSH lists: every new message shifts every older
 * message down by one, so an index identifies a different record on every read. A reply filed
 * against index 3 would answer somebody else's message by lunchtime.
 *
 * A record saved since the field landed carries its own `id`, minted at save time. A record
 * saved BEFORE it is given `lg:` + the first twelve hex of the sha256 of its own stored text --
 * a value that is a fact about that record's bytes and therefore does not move when a message is
 * pushed above it, when the list is trimmed, or when this code is deployed again.
 */
function idOf(rec) {
  const own = safeInboxId(rec.obj && rec.obj.id);
  if (own) return own;
  return 'lg:' + crypto.createHash('sha256').update(rec.text, 'utf8').digest('hex').slice(0, 12);
}

/** The account that sent a record, or '' for one that predates the field (decision ج٢). */
function senderOf(rec) {
  const k = rec.obj && rec.obj.accountKey;
  return (typeof k === 'string' && k.length > 0) ? k : '';
}

/**
 * THE WHOLE WINDOW OF ONE LIST, READ AND PARSED. Throws on a store fault so that every caller
 * answers 503 through one path instead of each deciding for itself what an unreadable list means.
 *
 * `text` IS THE STORED ELEMENT AS THE STORE HOLDS IT, and it is carried out of here for one
 * caller: `delete`, which removes a message by LREM ON THAT MEMBER and would remove the wrong
 * message -- or none -- if it were handed a re-serialisation instead. Every other caller ignores
 * it. See recordOf() above on why the string and the object travel together.
 */
async function readWindow(kind) {
  const raw = await redis.lrange(kind, 0, LIST_WINDOW - 1);
  if (!Array.isArray(raw)) throw new Error('list did not answer with a list');
  const out = [];
  for (const element of raw) {
    const rec = recordOf(element);
    if (!rec) continue;
    out.push({ id: idOf(rec), sender: senderOf(rec), obj: rec.obj, text: rec.text });
  }
  return out;
}

/**
 * THE THREE MARKS FOR A WHOLE WINDOW, IN THREE ROUND TRIPS RATHER THAN THREE HUNDRED. MGET over
 * the reply, read and seen keys of every item in hand. An absent key is the absence of that mark,
 * which is what makes "new" the state of a message nobody has touched.
 */
async function marksFor(items) {
  if (items.length === 0) return { replies: new Map(), reads: new Map(), seens: new Map() };
  const ids = items.map((it) => it.id);
  const [replies, reads, seens] = await Promise.all([
    redis.mget(...ids.map((id) => REPLY_PREFIX + id)),
    redis.mget(...ids.map((id) => READ_PREFIX + id)),
    redis.mget(...ids.map((id) => SEEN_PREFIX + id)),
  ]);
  const asMap = (values) => {
    const m = new Map();
    const list = Array.isArray(values) ? values : [];
    for (let i = 0; i < ids.length; i += 1) {
      const v = list[i];
      if (v !== null && v !== undefined && v !== '') m.set(ids[i], v);
    }
    return m;
  };
  return { replies: asMap(replies), reads: asMap(reads), seens: asMap(seens) };
}

/** A stored reply -> { text, at }, or null. A malformed one is no reply rather than half of one. */
function replyOf(raw) {
  if (raw === null || raw === undefined) return null;
  let o = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch (e) { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const text = typeof o.text === 'string' ? o.text : '';
  if (!text) return null;
  return { text, at: typeof o.at === 'string' ? o.at : '' };
}

/** Decision ج٨, in the one place it is decided. */
function stateOf(id, marks) {
  if (marks.replies.has(id)) return STATE_ANSWERED;
  if (marks.reads.has(id)) return STATE_READ;
  return STATE_NEW;
}

/**
 * WHAT THE OWNER'S LIST CARRIES, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * 🔴 NO ADDRESS ON THIS PATH. Decision ج١ says the address is fetched at DISPLAY time from the
 * account record, and a list of two hundred rows is not the display that needs it: what the owner
 * is doing there is choosing which message to open. `hasSender` is the one fact the list needs --
 * it is what decides whether a row can be answered at all -- and it is a boolean, so a scroll
 * through the inbox reads nobody's address and a screenshot of it discloses none.
 */
function listRow(item, marks) {
  const o = item.obj;
  return {
    id: item.id,
    state: stateOf(item.id, marks),
    hasSender: item.sender.length > 0,
    type: typeof o.type === 'string' ? o.type : '',
    reason: typeof o.reason === 'string' ? o.reason : '',
    text: typeof o.text === 'string' ? o.text : (typeof o.note === 'string' ? o.note : ''),
    contact: typeof o.contact === 'string' ? o.contact : '',
    ts: typeof o.ts === 'string' ? o.ts : '',
    // ITEM 106-B -- which build the message came from. '' for a record that predates the field;
    // the panel draws a dash for it rather than a blank.
    appv: typeof o.appv === 'string' ? o.appv : '',
    // ITEM 107 -- where a report was raised (api/report.js SOURCES). '' for a record that predates
    // the field and for every message in the feedback list; the panel draws a dash for it.
    source: typeof o.source === 'string' ? o.source : '',
  };
}

/**
 * ITEM 107 -- THE REPORTED QUESTION AND ANSWER, FOR THE ONE REPORT THE OWNER OPENED.
 *
 * A report without the exchange it is about cannot be acted on, so `read` hands back `user` and `ai`
 * as api/report.js stored them -- no cap raised, no text cut. They travel on this path ONLY and for the
 * reports list ONLY: the list row above stays light (two hundred rows of up to 6810 characters twice
 * over is a download, not a list), and the feedback list has no such fields to carry.
 */
function reportExchangeOf(item) {
  const o = item.obj;
  return {
    user: typeof o.user === 'string' ? o.user : '',
    ai: typeof o.ai === 'string' ? o.ai : '',
  };
}

/**
 * THE ADDRESS, FETCHED AT DISPLAY TIME AND FOR ONE MESSAGE ONLY -- DECISION ج١.
 *
 * It answers '' for every reason a lookup can fail: no account key on the record, a record the
 * store will not hand back, an account that has since been deleted, or a record with no address
 * on it. All four are one answer on the owner's screen -- «بلا عنوان» -- because all four mean
 * the same thing to him: there is nobody here to write back to.
 *
 * AND IT NEVER THROWS. A store fault while reading an address must not turn "here is your
 * message" into a 503: the message itself was read successfully, and the address is the one field
 * on this screen whose absence is already a lawful, displayable state.
 */
async function addressOf(accountKey) {
  if (!accountKey) return '';
  try {
    const account = await readAuthJson(accountKey);
    if (!account || typeof account !== 'object') return '';
    return typeof account.email === 'string' ? account.email : '';
  } catch (e) {
    return '';
  }
}

/**
 * THE ACCOUNT BEHIND A LIVE SESSION, OR ''.
 *
 * 🔴 WHY THIS IS NOT resolveActor(). That function is the WRITER'S door and it answers null for
 * the role `none` -- by design, and see its own header: "an actor object is a permission and
 * `none` is the absence of one". Every ordinary reader of this application holds `none`. So
 * resolving `mine` and `seen` through it would have closed the sender's own half of this feature
 * to every sender, and the only people who could read a reply would be the owner and the editors.
 *
 * 🔴 AND IT IS NOT A SECOND SESSION MECHANISM EITHER. It is touchSession() -- the very function
 * resolveActor() itself calls, over the very field it reads, `body.session` -- and it is the
 * shape api/auth-delete.js has used since that route landed, for the same reason: an action that
 * needs a person and not a privilege asks the session seam and stops there. No Authorization
 * header is read here and no second notion of "live" is written.
 *
 * The key is never interpolated into a store key on this route -- it is compared, and it is
 * written into a record VALUE by api/feedback.js -- so it travels as the session seam minted it.
 */
async function sessionAccount(req) {
  try {
    const body = (req && req.body && typeof req.body === 'object') ? req.body : {};
    const session = typeof body.session === 'string' ? body.session : '';
    if (session.length === 0) return '';
    const record = await touchSession(session);
    if (!record || typeof record.accountKey !== 'string') return '';
    return record.accountKey;
  } catch (e) {
    return '';
  }
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'inbox-rate-limited' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const action = typeof body.action === 'string' ? body.action : '';
  if (!INBOX_ACTIONS.includes(action)) return res.status(400).json({ ok: false, error: 'inbox-action' });

  res.setHeader('Cache-Control', 'private, no-store');

  // ONE STATEMENT, THREE ACTIONS, ONE REPLY. A stranger with no session, a reader with a live one,
  // and an editor all leave here through this single return, so what they receive is identical by
  // CONSTRUCTION and not by three literals that agree today. See the head of this file.
  if (OWNER_ACTIONS.includes(action)) {
    const actor = await resolveActor(req);
    if (!actor || actor.role !== ROLE_OWNER) {
      return res.status(401).json({ ok: false, error: 'inbox-unauthenticated' });
    }
    return ownerAction(req, res, body, action);
  }

  const accountKey = await sessionAccount(req);
  if (!accountKey) return res.status(401).json({ ok: false, error: 'inbox-signin-required' });
  return senderAction(res, body, action, accountKey);
}

/** `list`, `read` and `reply`. The caller is already proved to be the owner. */
async function ownerAction(req, res, body, action) {
  if (action === 'list') {
    const kind = typeof body.kind === 'string' ? body.kind : '';
    if (!KINDS.includes(kind)) return res.status(400).json({ ok: false, error: 'inbox-kind' });
    // The window is always scanned whole -- the unread count describes it whole -- and `limit`
    // bounds only what travels. The menu's badge asks for one item and is told the true count of
    // the two hundred; the panel asks for all of them and is told the same number.
    const asked = Number.isInteger(body.limit) ? body.limit : LIST_WINDOW;
    const limit = Math.max(0, Math.min(LIST_WINDOW, asked));
    try {
      const items = await readWindow(kind);
      const marks = await marksFor(items);
      let unread = 0;
      for (const it of items) { if (stateOf(it.id, marks) === STATE_NEW) unread += 1; }
      // `stored` IS THE WHOLE LIST'S LENGTH AND `total` IS THE WINDOW'S -- and the difference
      // between them is the reason this field exists. Ruling م٦ makes the erase-everything
      // question name its number, and the number that question is about is how many records the
      // list HOLDS, not how many of them this screen is showing. Naming `total` there would ask
      // the owner to approve deleting two hundred and then delete five thousand.
      const stored = await redis.llen(kind);
      return res.status(200).json({
        ok: true,
        kind,
        window: LIST_WINDOW,
        unread,
        total: items.length,
        stored: Number.isInteger(stored) ? stored : items.length,
        items: items.slice(0, limit).map((it) => listRow(it, marks)),
      });
    } catch (e) {
      console.error('[inbox] list FAILED, fail-CLOSED:', e && e.message ? e.message : e);
      return res.status(503).json({ ok: false, error: 'inbox-store' });
    }
  }

  // ---- delete ----
  //
  // 🔴 IT SITS ABOVE THE SINGLE-ID GUARD ON PURPOSE. `read` and `reply` are about one message and
  // are refused without one; `delete` names a SET of them -- `ids`, or `all` -- so the id it is
  // given is a list and there is no single `body.id` for the line below to find. Falling through
  // that guard would have answered `inbox-id` to a perfectly well-formed erase of forty rows.
  if (action === 'delete') {
    const kind = typeof body.kind === 'string' ? body.kind : '';
    if (!KINDS.includes(kind)) return res.status(400).json({ ok: false, error: 'inbox-kind' });
    // BOTH TABS ERASE, AND THE READ-ONLY RULE IS NOT WEAKENED BY THAT. Decision ج١٠ forbids
    // ANSWERING a report, which is a thing this route writes INTO the sender's view; erasing one
    // writes nothing anywhere and leaves api/report.js untouched (ruling م٧) -- it is the same
    // act the owner performs on his own inbox, performed on the other list.
    if (body.all === true) return deleteWholeList(res, kind);

    const raw = Array.isArray(body.ids) ? body.ids : null;
    if (!raw || raw.length === 0) return res.status(400).json({ ok: false, error: 'inbox-ids' });
    if (raw.length > DELETE_IDS_CAP) return res.status(400).json({ ok: false, error: 'inbox-ids-cap' });
    // A MALFORMED ID IS DROPPED RATHER THAN FATAL, which is the rule for an id that names nothing
    // applied one step earlier: both are "there is no such message", both leave the rest of the
    // batch alone, and neither is counted as a deletion. Duplicates collapse here too, so an id
    // sent twice erases one message and is reported as one.
    const wanted = [];
    const seen = new Set();
    for (const v of raw) {
      const id = safeInboxId(v);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      wanted.push(id);
    }
    return deleteSelected(res, kind, wanted);
  }

  const id = safeInboxId(body.id);
  if (!id) return res.status(400).json({ ok: false, error: 'inbox-id' });

  if (action === 'read') {
    // THE KIND IS A HINT AND NOT A REQUIREMENT. The contract is `{ id }`; a caller that knows
    // which tab it is looking at may say so and save a lookup, and one that does not is answered
    // by searching both lists in the order the owner reads them.
    const hinted = typeof body.kind === 'string' && KINDS.includes(body.kind) ? body.kind : '';
    const order = hinted ? [hinted].concat(KINDS.filter((k) => k !== hinted)) : KINDS.slice();
    try {
      for (const kind of order) {
        const items = await readWindow(kind);
        const found = items.find((it) => it.id === id);
        if (!found) continue;
        // THE MARK IS LAID BEFORE THE ANSWER IS BUILT, so a message the owner has on screen is a
        // message the badge has already stopped counting. It is written unconditionally: a second
        // opening re-stamps the time, which is the honest record of when he last looked at it.
        await redis.set(READ_PREFIX + id, new Date().toISOString());
        const [replyRaw, seenRaw] = await Promise.all([
          redis.get(REPLY_PREFIX + id),
          redis.get(SEEN_PREFIX + id),
        ]);
        const reply = replyOf(replyRaw);
        // The state is read off the two marks this branch is holding rather than off a second
        // round trip: the read mark was just written, so it exists by construction, and the reply
        // was just fetched. It is still stateOf()'s rule and not a second copy of it.
        const marks = {
          replies: new Map(reply ? [[id, 1]] : []),
          reads: new Map([[id, 1]]),
          seens: new Map(),
        };
        return res.status(200).json({
          ok: true,
          kind,
          item: Object.assign(
            listRow(found, marks),
            { from: await addressOf(found.sender) },
            kind === 'reports' ? reportExchangeOf(found) : null,
          ),
          reply,
          seenBySender: !!(seenRaw !== null && seenRaw !== undefined && seenRaw !== ''),
        });
      }
      return res.status(404).json({ ok: false, error: 'inbox-not-found' });
    } catch (e) {
      console.error('[inbox] read FAILED, fail-CLOSED:', e && e.message ? e.message : e);
      return res.status(503).json({ ok: false, error: 'inbox-store' });
    }
  }

  // ---- reply ----
  //
  // The text is cut FIRST and judged after, exactly as api/feedback.js judges a message: a reply
  // of 1200 spaces is not an answer, and neither is one that was whitespace to begin with.
  const text = cut(body.text, REPLY_CAP).trim();
  if (!text) return res.status(400).json({ ok: false, error: 'inbox-empty' });

  try {
    // ONLY THE FEEDBACK LIST IS SEARCHED. That is decision ج١٠ expressed as a structure rather
    // than as a check: a report is not in this list, so a report cannot be answered from here,
    // and no later edit can soften that by forgetting a flag.
    const items = await readWindow('feedback');
    const found = items.find((it) => it.id === id);
    if (!found) return res.status(404).json({ ok: false, error: 'inbox-not-found' });
    // DECISION ج٢. A message that arrived before the sender was recorded has nobody to deliver an
    // answer to, and writing one would put a reply in the store that no screen anywhere could
    // ever show. The owner is told exactly that, by name, rather than being told it succeeded.
    if (!found.sender) return res.status(409).json({ ok: false, error: 'inbox-no-sender' });

    // DECISION ج٧. The reply lives in a key of its OWN and is never written back into the message
    // record. Two reasons, and the second is not theoretical: the record sits inside a trimmed
    // LPUSH list, so rewriting one element in place means rewriting the list, and a list rewritten
    // under a concurrent LPUSH loses whatever arrived while it was being rebuilt.
    const record = { text, at: new Date().toISOString() };
    await redis.set(REPLY_PREFIX + id, JSON.stringify(record));
    // A NEW ANSWER IS A NEW THING FOR THE SENDER TO SEE. The seen mark is dropped so the sender's
    // dot lights again -- without it, editing a reply would deliver silently to somebody who had
    // already dismissed the first one.
    await redis.del(SEEN_PREFIX + id);
    return res.status(200).json({ ok: true, id, reply: record, state: STATE_ANSWERED });
  } catch (e) {
    console.error('[inbox] reply FAILED, fail-CLOSED:', e && e.message ? e.message : e);
    return res.status(503).json({ ok: false, error: 'inbox-store' });
  }
}

/**
 * THE UNREAD COUNT OF ONE TAB, RE-MEASURED AFTER AN ERASE -- and it answers `null` rather than
 * throwing.
 *
 * 🔴 WHY IT CANNOT BE ALLOWED TO FAIL THE REQUEST. It runs AFTER records have already left the
 * store, so a fault here is a fault in a count and not in the deletion. Turning it into the 503
 * of the enclosing action would tell the owner "nothing was deleted" about messages that are
 * gone -- the exact lie the closed-failure rule exists to prevent, told in the other direction.
 * `null` travels instead, and the client leaves its badge alone and re-reads it on the next open.
 */
async function unreadAfter(kind) {
  try {
    const items = await readWindow(kind);
    const marks = await marksFor(items);
    let unread = 0;
    for (const it of items) { if (stateOf(it.id, marks) === STATE_NEW) unread += 1; }
    return unread;
  } catch (e) {
    return null;
  }
}

/**
 * ERASE THE NAMED MESSAGES OF ONE TAB.
 *
 * 🔴 BY MEMBER, NEVER BY INDEX. `LREM <key> 1 <member>` names the record by the bytes the store
 * is holding. The index form -- read row 7, delete row 7 -- is a race with a name: these are
 * LPUSH lists, so one message arriving between the read and the write shifts every row down by
 * one and row 7 becomes somebody else's. That is the same reasoning idOf() is written on, and it
 * is why the stored text is carried out of readWindow() at all.
 *
 * THE RECORD LEAVES FIRST AND ITS DEPENDENTS FOLLOW (ruling م٢, in the order the order gives).
 * A fault between the two steps leaves keys with no message, which is recoverable and invisible;
 * the reverse order would leave a message whose reply had silently evaporated, which the owner
 * would read as a delivered answer that never existed.
 *
 * AND THE COUNT IS WHAT THE STORE DID, NOT WHAT WAS ASKED. LREM answers how many elements it
 * actually removed; an id that named nothing adds nothing to `deleted` and does not stop the
 * batch, and a fault halfway through reports the messages that really went.
 */
async function deleteSelected(res, kind, ids) {
  let deleted = 0;
  try {
    const items = await readWindow(kind);
    const byId = new Map();
    for (const it of items) { if (!byId.has(it.id)) byId.set(it.id, it); }
    for (const id of ids) {
      const found = byId.get(id);
      if (!found) continue;
      const removed = await redis.lrem(kind, 1, found.text);
      if (!Number.isInteger(removed) || removed < 1) continue;
      await redis.del(...DEPENDENT_PREFIXES.map((p) => p + id));
      deleted += 1;
    }
  } catch (e) {
    console.error('[inbox] delete FAILED, fail-CLOSED:', e && e.message ? e.message : e);
    return res.status(503).json({ ok: false, error: 'inbox-store', kind, deleted });
  }
  return res.status(200).json({ ok: true, kind, deleted, unread: await unreadAfter(kind) });
}

/**
 * ERASE A WHOLE TAB -- ruling م٦'s "all", and ONE TAB ONLY: `kind` is the key, the other list is
 * never named by this function and cannot be reached from it.
 *
 * 🔴 THE ORDER OF THE THREE STEPS IS THE WHOLE OF THIS FUNCTION. The ids are collected out of the
 * list BEFORE anything is deleted, the dependent keys go next, and the list itself goes LAST.
 * Deleting the list first would be one command shorter and would destroy the only copy of the ids
 * -- every reply, read mark and seen mark in it would then be unreachable and unsweepable for as
 * long as the store lives, which is precisely the orphan ruling م٢ forbids.
 *
 * IT READS THE LIST WHOLE (`0, -1`) AND NOT THE 200-ROW WINDOW, because this erases the tab and
 * not the screen. The read is bounded anyway: api/feedback.js LTRIMs to 5000 and api/report.js
 * does the same, so "whole" has a ceiling that is enforced by the writers.
 */
async function deleteWholeList(res, kind) {
  let deleted = 0;
  try {
    const raw = await redis.lrange(kind, 0, -1);
    if (!Array.isArray(raw)) throw new Error('list did not answer with a list');
    const keys = [];
    for (const element of raw) {
      const rec = recordOf(element);
      if (!rec) continue;
      const id = idOf(rec);
      for (const p of DEPENDENT_PREFIXES) keys.push(p + id);
    }
    for (let i = 0; i < keys.length; i += DELETE_KEY_BATCH) {
      await redis.del(...keys.slice(i, i + DELETE_KEY_BATCH));
    }
    await redis.del(kind);
    // EVERY ELEMENT THE LIST HELD IS GONE, INCLUDING ANY THIS ROUTE COULD NOT PARSE -- so the
    // count is the list's length and not the number of readable records in it. A message LPUSHed
    // between the read above and the DEL is erased by it and is NOT counted; undercounting a
    // deletion nobody asked for is the honest direction for that race to fall.
    deleted = raw.length;
  } catch (e) {
    console.error('[inbox] delete-all FAILED, fail-CLOSED:', e && e.message ? e.message : e);
    return res.status(503).json({ ok: false, error: 'inbox-store', kind, deleted });
  }
  return res.status(200).json({ ok: true, kind, deleted, unread: await unreadAfter(kind) });
}

/**
 * `mine` and `seen`. The caller is proved to hold a live session and is answered ABOUT THAT
 * SESSION'S ACCOUNT AND NOTHING ELSE -- there is no field in the body that names an account, so
 * there is no door here for asking about somebody else's messages.
 */
async function senderAction(res, body, action, accountKey) {
  if (action === 'mine') {
    try {
      const items = (await readWindow('feedback')).filter((it) => it.sender === accountKey);
      const marks = await marksFor(items);
      let unseen = 0;
      const out = [];
      for (const it of items) {
        const reply = replyOf(marks.replies.get(it.id));
        // DECISION ج١٣. The dot is about a reply the sender has not seen, so it counts exactly
        // that: an answer that exists and carries no seen mark. A message with no answer yet is
        // not something to be notified about.
        if (reply && !marks.seens.has(it.id)) unseen += 1;
        const o = it.obj;
        out.push({
          id: it.id,
          type: typeof o.type === 'string' ? o.type : '',
          text: typeof o.text === 'string' ? o.text : '',
          ts: typeof o.ts === 'string' ? o.ts : '',
          reply,
          seen: marks.seens.has(it.id),
        });
      }
      return res.status(200).json({ ok: true, unseen, items: out });
    } catch (e) {
      console.error('[inbox] mine FAILED, fail-CLOSED:', e && e.message ? e.message : e);
      return res.status(503).json({ ok: false, error: 'inbox-store' });
    }
  }

  // ---- seen ----
  const id = safeInboxId(body.id);
  if (!id) return res.status(400).json({ ok: false, error: 'inbox-id' });
  try {
    const items = await readWindow('feedback');
    const found = items.find((it) => it.id === id);
    // A MESSAGE THIS SESSION DID NOT SEND IS REFUSED WITH THE SAME 401 AS A DEAD SESSION, and an
    // id that names nothing is refused with it too. Telling the two apart would turn this into a
    // door for asking whether a given message exists, which is a question nobody but its sender
    // and the owner has any business having answered.
    if (!found || found.sender !== accountKey) {
      return res.status(401).json({ ok: false, error: 'inbox-not-yours' });
    }
    await redis.set(SEEN_PREFIX + id, new Date().toISOString());
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error('[inbox] seen FAILED, fail-CLOSED:', e && e.message ? e.message : e);
    return res.status(503).json({ ok: false, error: 'inbox-store' });
  }
}
