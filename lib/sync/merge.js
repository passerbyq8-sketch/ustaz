// lib/sync/merge.js
// THE CONFLICT RULES BETWEEN TWO DEVICES OF ONE ACCOUNT (item 24, Claude's ruling 4-b), and they
// are the ONLY place those rules are written. Pure: no store, no clock, no crypto, no imports.
//
// A RECORD is { u, del, val }:
//   u    the time (ms) the device last changed it -- the device's own clock
//   del  true for a TOMBSTONE: the record was deleted, and the mark is kept so it never returns
//   val  the content
//
// THE KIND IS THE PREFIX OF THE RECORD ID, and it decides the rule:
//
//   chat:<id>  conversations JOIN. Every message of both sides is kept, none is written over
//              another: a message is known by its role, its timestamp and its text, and two
//              copies of the same message are one message. Title and pin follow the newer side.
//   ctr:<key>  counters: THE LARGER WINS, leaf by leaf (numbers take the max, objects merge key by
//              key, arrays join without duplicates, any other leaf follows the newer side).
//   kv:<key>   settings and positions: THE LAST CHANGE WINS (the larger `u`; a tie keeps what the
//              server already holds, so the answer never depends on which device spoke first).
//   note:<id>  one library note: the last change wins.
//   res:<...>  RESERVED -- the account's future purchases (Kunuz). Named so the space keeps room
//              for them; no device may write here, and nothing reads it yet.
//
// DELETION IS FINAL. A tombstone beats every later write of the same id: the record does not come
// back because another device that never saw the deletion still holds it.

export const KINDS = Object.freeze(['chat', 'ctr', 'kv', 'note']);
export const RESERVED_PREFIX = 'res:';
export const PURCHASES_ID = 'res:purchases';
export const MAX_ID_CHARS = 120;

// A CONVERSATION LARGER THAN ONE RECORD (sync fix, 10 October). A record is capped at 256 KB, so a
// device splits a long conversation: the record chat:<id> keeps the title, the pin and the time
// with no messages, and the messages travel in chat:<id>.p1, chat:<id>.p2, ... -- each one an
// ordinary chat record, merged by the same rules. A conversation id never holds a dot, so the
// suffix cannot be mistaken for one.
const CHAT_PART_RE = /^(chat:[^.]+)\.p([1-9][0-9]{0,3})$/;
/** The conversation a part belongs to ('chat:<id>'), or null when the id is not a part. */
export function chatBaseOf(id) { const x = CHAT_PART_RE.exec(String(id || '')); return x ? x[1] : null; }
export function chatPartNo(id) { const x = CHAT_PART_RE.exec(String(id || '')); return x ? Number(x[2]) : 0; }

/** The kind of a record id, or null for an id no device may write. */
export function kindOf(id) {
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_CHARS) return null;
  if (!/^[a-z]+:[A-Za-z0-9._:-]{1,110}$/.test(id)) return null;
  const k = id.slice(0, id.indexOf(':'));
  return KINDS.includes(k) ? k : null;
}

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

/** A small stable hash of a string (FNV-1a, 32 bit, hex). Identity only, never security. */
export function textHash(s) {
  let h = 0x811c9dc5;
  const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

export const IMAGE_ELSEWHERE = '\u{1F4F7} [صورة على جهاز آخر]';

/** The text of a message's content, images left out. */
export function messageText(m) {
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

/** A message with every non-text block replaced by the "image on another device" mark. */
export function textOnlyMessage(m) {
  if (!isObj(m)) return null;
  const out = {};
  for (const k of Object.keys(m)) if (k !== 'content') out[k] = m[k];
  if (typeof m.content === 'string') { out.content = m.content; return out; }
  if (Array.isArray(m.content)) {
    const blocks = [];
    let hadImage = false;
    for (const b of m.content) {
      if (b && b.type === 'text' && typeof b.text === 'string') blocks.push({ type: 'text', text: b.text });
      else hadImage = true;
    }
    if (hadImage) blocks.unshift({ type: 'text', text: IMAGE_ELSEWHERE });
    out.content = blocks;
    return out;
  }
  out.content = '';
  return out;
}

export function messageKey(m) {
  const text = messageText(m).split(IMAGE_ELSEWHERE).join('').trim();
  return String((m && m.role) || '') + '|' + String((m && m.timestamp) || '') + '|' + textHash(text);
}

function tsOf(m) {
  const t = m && m.timestamp ? Date.parse(m.timestamp) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Union of two message lists. Existing copies win (no message is written over another). */
export function joinMessages(a, b) {
  const seen = new Map();
  const order = [];
  const add = (m, from) => {
    if (!isObj(m)) return;
    const k = messageKey(m);
    if (seen.has(k)) return;
    seen.set(k, m);
    order.push({ m, from, i: order.length });
  };
  (Array.isArray(a) ? a : []).forEach((m) => add(m, 0));
  (Array.isArray(b) ? b : []).forEach((m) => add(m, 1));
  // Stable by timestamp; messages without one keep their place relative to their own side.
  return order.slice().sort((x, y) => (tsOf(x.m) - tsOf(y.m)) || (x.i - y.i)).map((x) => x.m);
}

/** Deep "largest wins" for counters. */
export function maxMerge(a, b, bNewer) {
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (isObj(a) && isObj(b)) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out[k] = b[k];
      else if (!(k in b)) out[k] = a[k];
      else out[k] = maxMerge(a[k], b[k], bNewer);
    }
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Set();
    const out = [];
    for (const v of a.concat(b)) { const s = JSON.stringify(v); if (!seen.has(s)) { seen.add(s); out.push(v); } }
    return out;
  }
  if (a === undefined) return b;
  if (b === undefined) return a;
  return bNewer ? b : a;
}

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }

/**
 * Merge an incoming record into the one the server holds. Returns the record to store.
 * `held` may be null (first write). Both are { u, del, val }.
 */
export function mergeRecord(id, held, incoming) {
  const kind = kindOf(id);
  if (!kind) throw new Error('sync-id-refused');
  const inc = { u: num(incoming && incoming.u), del: !!(incoming && incoming.del), val: incoming ? incoming.val : null };
  if (!held) return inc.del ? { u: inc.u, del: true, val: null } : { u: inc.u, del: false, val: kind === 'chat' ? cleanChat(inc.val) : inc.val };
  const h = { u: num(held.u), del: !!held.del, val: held.val };
  // DELETION IS FINAL -- whichever side carries it.
  if (h.del) return { u: Math.max(h.u, inc.u), del: true, val: null };
  if (inc.del) return { u: Math.max(h.u, inc.u), del: true, val: null };
  const incNewer = inc.u > h.u;
  const u = Math.max(h.u, inc.u);
  if (kind === 'kv' || kind === 'note') return incNewer ? { u, del: false, val: inc.val } : { u, del: false, val: h.val };
  if (kind === 'ctr') return { u, del: false, val: maxMerge(h.val, inc.val, incNewer) };
  // chat
  const hv = isObj(h.val) ? h.val : {};
  const iv = isObj(inc.val) ? cleanChat(inc.val) : {};
  const newer = incNewer ? iv : hv;
  const older = incNewer ? hv : iv;
  return {
    u,
    del: false,
    val: {
      title: typeof newer.title === 'string' ? newer.title : (older.title || ''),
      pinned: typeof newer.pinned === 'boolean' ? newer.pinned : !!older.pinned,
      at: Math.max(num(hv.at), num(iv.at)),
      msgs: joinMessages(hv.msgs, iv.msgs),
    },
  };
}

/** A conversation as text: every image block becomes the mark, nothing else is kept. */
export function cleanChat(v) {
  if (!isObj(v)) return { title: '', pinned: false, at: 0, msgs: [] };
  return {
    title: typeof v.title === 'string' ? v.title.slice(0, 200) : '',
    pinned: v.pinned === true,
    at: num(v.at),
    msgs: (Array.isArray(v.msgs) ? v.msgs : []).map(textOnlyMessage).filter(Boolean),
  };
}

/**
 * One conversation per id again: every part folded into its conversation (messages joined, in part
 * order, duplicates as one), the part ids gone. A part whose conversation is absent is dropped.
 * Takes and returns { id: val } of live records -- the shape of the export.
 */
export function foldChatParts(records) {
  const out = {};
  const parts = [];
  for (const id of Object.keys(records || {})) {
    if (chatBaseOf(id)) parts.push(id); else out[id] = records[id];
  }
  parts.sort((a, b) => chatPartNo(a) - chatPartNo(b));
  for (const id of parts) {
    const base = chatBaseOf(id);
    const head = out[base];
    if (!isObj(head)) continue;
    const pv = records[id];
    out[base] = Object.assign({}, head, { msgs: joinMessages(head.msgs, isObj(pv) ? pv.msgs : []) });
  }
  return out;
}
