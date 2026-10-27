// lib/answer-log.js -- ITEM O1 (91) -- 2026-10-15 brain-line
//
// ONE RECORD FOR EVERY ANSWER. Measured on 7ba44481 (side-brain-line-2026-10-15/items/91.md): what one answer did --
// which path, how many rows each source returned, what was cited, what was held and why, whether the model stopped on
// max_tokens, how long the reader waited for the first word -- lived only in scattered stdout lines that expire with
// the platform's log retention, and nothing joined them to one answer.
//
// THE RECORD. `al:v1:<trace>` in the app's own Upstash (lib/ledger/redis.js -- no new resource, no new credential), 30
// days, and a daily index `al:v1:d:<yyyymmdd>` of trace ids trimmed to the newest 3000. Its fields are ANSWER_LOG_FIELDS
// and nothing else. NO QUESTION TEXT AND NO ANSWER TEXT: every string value must match SAFE_TOKEN (ASCII letters, digits
// and _ : . -, at most 40 characters), so a sentence in any language cannot be stored even by mistake. The question
// enters only as its length, its word count and `fp` -- an HMAC-SHA256 of its normalised text under ANSWER_LOG_KEY,
// first 16 hex digits (the owner's decision b: a keyed fingerprint, not the text). Without the key the field is
// omitted, never computed with a default key.
//
// NOTHING HERE MAY FAIL AN ANSWER. Every store call is the helpers' null-on-failure; a record that cannot be written is
// a missing record.
import { createHmac, randomBytes } from 'node:crypto';
import { setex, get, lpushCapped, lrange, mget } from './ledger/redis.js';

export const ANSWER_LOG_PREFIX = 'al:v1:';
export const ANSWER_LOG_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ANSWER_LOG_DAY_CAP = 3000;
// POSTSHIP ITEM 5 -- 2026-10-24: records per store request when a day is read (readAnswerLog).
export const ANSWER_LOG_READ_BATCH = 100;
export const ANSWER_LOG_PATHS = Object.freeze(['bw2', 'free-brain', 'legacy-gen', 'legacy-deen', 'stored', 'hybrid', 'ledger', 'world', 'closed', 'canned']);
export const ANSWER_LOG_FIELDS = Object.freeze([
  'trace', 'day', 'at', 'route', 'runtime', 'path', 'depth', 'lang', 'translated', 'status',
  'q_chars', 'q_words', 'fp', 'hits', 'cited', 'held', 'stop_reason', 'truncated', 'continued',
  'out_chars', 'out_tokens', 'first_byte_ms', 'max_gap_ms', 'status_events', 'flags',
]);
// The fields an api/ask.js site may hand to note(); the rest are the log's own (trace, day, at, the question's measures,
// the stream tap's measures).
export const ANSWER_LOG_NOTE_FIELDS = Object.freeze([
  'route', 'runtime', 'path', 'depth', 'hits', 'cited', 'held', 'stop_reason', 'truncated', 'continued', 'out_tokens', 'flags',
]);
const SAFE_TOKEN = /^[A-Za-z0-9_:.-]{0,40}$/;
const COUNT_FIELDS = new Set(['q_chars', 'q_words', 'cited', 'continued', 'out_chars', 'out_tokens', 'first_byte_ms', 'max_gap_ms', 'status_events', 'at']);
const MAP_FIELDS = new Set(['hits', 'held']);

const token = (v) => (typeof v === 'string' && SAFE_TOKEN.test(v) ? v : null);
const count = (v) => {
  if (Array.isArray(v)) return v.length;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const countMap = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const [k, raw] of Object.entries(v)) {
    const n = count(raw);
    if (token(k) && k && n !== null) out[k] = n;
  }
  return out;
};

/** The question, normalised for the fingerprint: NFKC, no tashkeel or tatweel, one alef, one ya, single spaces, lower case. */
export function normalizeForFingerprint(text) {
  return String(text == null ? '' : text).normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 16 hex digits of HMAC-SHA256 under the key; null when there is no key. */
export function questionFingerprint(text, key) {
  if (typeof key !== 'string' || !key) return null;
  return createHmac('sha256', key).update(normalizeForFingerprint(text), 'utf8').digest('hex').slice(0, 16);
}

/** The record as it is stored: the closed field list, every value a count, a boolean, a safe token or a map of counts. */
export function sanitizeRecord(raw) {
  const out = {};
  for (const field of ANSWER_LOG_FIELDS) {
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, field)) continue;
    const v = raw[field];
    let clean;
    if (field === 'translated' || field === 'truncated') clean = typeof v === 'boolean' ? v : null;
    else if (COUNT_FIELDS.has(field)) clean = count(v);
    else if (MAP_FIELDS.has(field)) clean = countMap(v);
    else if (field === 'flags') clean = Array.isArray(v) ? [...new Set(v.map(token).filter(Boolean))] : null;
    else if (field === 'path') clean = ANSWER_LOG_PATHS.includes(v) ? v : null;
    else if (field === 'fp') clean = typeof v === 'string' && /^[0-9a-f]{16}$/.test(v) ? v : null;
    else clean = token(v);
    if (clean !== null && clean !== undefined) out[field] = clean;
  }
  // The whole schema, every time: a field the answer did not reach is null, not missing -- except `fp`, which is absent
  // without the key so that a record never suggests a fingerprint it does not have.
  for (const field of ANSWER_LOG_FIELDS) if (field !== 'fp' && !(field in out)) out[field] = null;
  return out;
}

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

// THE TAP ON THE READER'S STREAM. Every path writes the same SSE frames, so what the reader received is measured in one
// place: the text's length, the wait for its first piece, the longest silence between two pieces, the status frames,
// and the provider's own stop_reason and output tokens where a path forwards them.
function createStreamTap(now, startedAt) {
  let buffer = '';
  const m = { out_chars: 0, first_byte_ms: null, max_gap_ms: 0, status_events: 0, stop_reason: null, out_tokens: null };
  let lastText = null;
  const frame = (line) => {
    if (!line.startsWith('data:')) return;
    let e;
    try { e = JSON.parse(line.slice(5).trim()); } catch { return; }
    if (!e || typeof e !== 'object') return;
    if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta' && typeof e.delta.text === 'string') {
      const t = now();
      if (m.first_byte_ms === null) m.first_byte_ms = t - startedAt;
      else m.max_gap_ms = Math.max(m.max_gap_ms, t - lastText);
      lastText = t;
      m.out_chars += e.delta.text.length;
    } else if (e.type === 'ezik_status') {
      m.status_events += 1;
    } else if (e.type === 'message_delta') {
      if (e.delta && typeof e.delta.stop_reason === 'string') m.stop_reason = e.delta.stop_reason;
      if (e.usage && Number.isFinite(e.usage.output_tokens)) m.out_tokens = e.usage.output_tokens;
    }
  };
  return {
    measures: m,
    write(chunk) {
      if (chunk == null) return;
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) { frame(buffer.slice(0, i).replace(/\r$/, '')); buffer = buffer.slice(i + 1); }
    },
  };
}

/**
 * One answer's record, from the request's start to its flush.
 *   createAnswerLog({ question, lang, translated, key, now, trace })
 *   .note({...})          a site's facts (ANSWER_LOG_NOTE_FIELDS; later notes win, maps and flags merge)
 *   .tap(res)             measure what the reader receives (wraps res.write / res.end once)
 *   .record()             the sanitised record
 *   .flush(deps)          write it once (deps.store for a test store)
 */
export function createAnswerLog({ question = '', lang = 'ar', translated = false, key = process.env.ANSWER_LOG_KEY, now = Date.now, trace } = {}) {
  const startedAt = now();
  const id = token(trace) && trace ? trace : randomBytes(8).toString('hex');
  const q = String(question == null ? '' : question);
  const state = {
    trace: id, day: dayOf(startedAt), at: startedAt, lang, translated: translated === true, status: 'open', cited: 0,
    q_chars: q.length, q_words: q.trim() ? q.trim().split(/\s+/).length : 0, continued: 0, hits: {}, held: {}, flags: [],
  };
  const fp = questionFingerprint(q, key);
  if (fp) state.fp = fp;
  const tapper = createStreamTap(now, startedAt);
  let flushed = false;
  const api = {
    trace: id,
    note(fields) {
      if (!fields || typeof fields !== 'object') return api;
      for (const [k, v] of Object.entries(fields)) {
        if (!ANSWER_LOG_NOTE_FIELDS.includes(k) || v === undefined) continue;
        if (k === 'hits' || k === 'held') state[k] = { ...state[k], ...(countMap(v) || {}) };
        else if (k === 'flags') state.flags = [...state.flags, ...(Array.isArray(v) ? v : [v])];
        else state[k] = v;
      }
      return api;
    },
    tap(res) {
      if (!res || res.__answerLogTapped) return res;
      res.__answerLogTapped = true;
      const write = res.write && res.write.bind(res);
      const end = res.end && res.end.bind(res);
      if (write) res.write = (chunk, ...rest) => { try { tapper.write(chunk); } catch { /* the tap never fails a write */ } return write(chunk, ...rest); };
      if (end) res.end = (chunk, ...rest) => { try { if (chunk && typeof chunk !== 'function') tapper.write(chunk); } catch { /* idem */ } state.status = 'ended'; return end(chunk, ...rest); };
      return res;
    },
    record() {
      const m = tapper.measures;
      const merged = { ...state, out_chars: m.out_chars, first_byte_ms: m.first_byte_ms, max_gap_ms: m.max_gap_ms, status_events: m.status_events };
      if (merged.stop_reason == null && m.stop_reason) merged.stop_reason = m.stop_reason;
      if (merged.out_tokens == null && m.out_tokens != null) merged.out_tokens = m.out_tokens;
      if (!merged.path) merged.path = merged.route === 'GEN' ? 'legacy-gen' : 'legacy-deen';
      return sanitizeRecord(merged);
    },
    async flush(deps = {}) {
      if (flushed) return false;
      flushed = true;
      return writeAnswerLog(api.record(), deps);
    },
  };
  return api;
}

/** Before writing's hold counters (`held<Reason>` on its telemetry) as the record's `held` map; zeros left out. */
export function heldFromTelemetry(t) {
  const out = {};
  for (const [k, v] of Object.entries(t || {})) {
    const m = /^held([A-Z]\w*)$/.exec(k);
    const n = count(v);
    if (m && n) out[m[1].charAt(0).toLowerCase() + m[1].slice(1)] = n;
  }
  return out;
}

/** The free brain's spend (`{tool, results}` per call) as the record's `hits` map, summed per tool. */
export function hitsFromSpend(spend) {
  const out = {};
  for (const s of Array.isArray(spend) ? spend : []) {
    if (!s || !token(s.tool) || !s.tool) continue;
    out[s.tool] = (out[s.tool] || 0) + (count(s.results) || 0);
  }
  return out;
}

/** The request's record: the last user turn measured (never kept), the language decision's two facts. */
export function answerLogFor(req, decision = {}) {
  let question = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const turns = body && Array.isArray(body.messages) ? body.messages : [];
    const last = [...turns].reverse().find((m) => m && m.role === 'user');
    const c = last ? last.content : '';
    question = typeof c === 'string' ? c
      : Array.isArray(c) ? c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n') : '';
  } catch { question = ''; }
  return createAnswerLog({ question, lang: token(decision.lang) || 'ar', translated: decision.translate === true });
}

/** Safe diagnostic for an answer-log write failure; it contains only the trace token. */
export function answerLogFailureLine(record) {
  const trace = token(record && record.trace) || 'none';
  return '[answer-log] write_failed trace=' + trace;
}

/**
 * Run one answer with its record: opened before `run`, the stream tapped, written once after it, whatever way it ends.
 * `decide` is the language gate's own decision (lang, translate). A request that is not a POST runs without one.
 */
export async function withAnswerLog(req, res, run, decide, deps = {}) {
  if (!req || req.method !== 'POST') return run();
  let decision = {};
  try { decision = decide ? decide(req) || {} : {}; } catch { decision = {}; }
  const log = answerLogFor(req, decision);
  req.__answerLog = log;
  log.tap(res);
  try { return await run(); } finally {
    let written = false;
    try { written = await log.flush(deps); } catch { written = false; }
    if (!written) console.warn(answerLogFailureLine(log.record()));
  }
}

/** Write one record and its place in the day's index. False when the record store or day index is absent or refuses. */
export async function writeAnswerLog(record, deps = {}) {
  const store = deps.store || { setex, lpushCapped };
  const clean = sanitizeRecord(record);
  if (!clean.trace || !clean.day) return false;
  let stored = false;
  try { stored = await store.setex(ANSWER_LOG_PREFIX + clean.trace, ANSWER_LOG_TTL_SECONDS, JSON.stringify(clean)); } catch { return false; }
  if (!stored) return false;
  try {
    const indexed = await store.lpushCapped(ANSWER_LOG_PREFIX + 'd:' + clean.day, clean.trace, ANSWER_LOG_DAY_CAP, ANSWER_LOG_TTL_SECONDS);
    return indexed !== false;
  } catch { return false; }
}

/**
 * Read a day's records, newest first, for the inbox: { day: 'yyyymmdd', path?, status?, limit? }.
 * `status` filters on the closed words held (any hold), truncated, incomplete (a flag), clean (none of these).
 */
export async function readAnswerLog({ day, path = '', status = '', limit = 100 } = {}, deps = {}) {
  const store = deps.store || { get, lrange, mget };
  if (!/^\d{8}$/.test(String(day || ''))) return [];
  const cap = Math.max(1, Math.min(ANSWER_LOG_DAY_CAP, Number(limit) || 100));
  const ids = await store.lrange(ANSWER_LOG_PREFIX + 'd:' + day, 0, ANSWER_LOG_DAY_CAP - 1);
  const out = [];
  // POSTSHIP ITEM 5 -- 2026-10-24: the records are read ANSWER_LOG_READ_BATCH at a time, one store request each (mget),
  // not one request per record: 200 records were 201 requests and 13-20 s on production, past the app's 12. Same order,
  // same filters, same cap; a store without mget is read one key at a time, as before.
  const valid = (Array.isArray(ids) ? ids : []).filter((id) => token(id));
  for (let at = 0; at < valid.length && out.length < cap; at += ANSWER_LOG_READ_BATCH) {
    const batch = valid.slice(at, at + ANSWER_LOG_READ_BATCH);
    let got;
    if (typeof store.mget === 'function') got = await store.mget(batch.map((id) => ANSWER_LOG_PREFIX + id));
    else { got = []; for (const id of batch) got.push(await store.get(ANSWER_LOG_PREFIX + id)); }
    for (let i = 0; i < batch.length; i += 1) {
      if (out.length >= cap) break;
      const raw = Array.isArray(got) ? got[i] : null;
      if (!raw) continue;
      let rec;
      try { rec = sanitizeRecord(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch { continue; }
      if (path && rec.path !== path) continue;
      if (status && answerStatusOf(rec) !== status && !(status === 'held' && Object.keys(rec.held || {}).length)) continue;
      out.push(rec);
    }
  }
  return out;
}

/** The one closed word the inbox filters a record by. */
export function answerStatusOf(rec) {
  if (!rec) return 'clean';
  if (rec.truncated === true || rec.stop_reason === 'max_tokens') return 'truncated';
  if (Array.isArray(rec.flags) && rec.flags.includes('incomplete')) return 'incomplete';
  if (rec.held && Object.keys(rec.held).length) return 'held';
  return 'clean';
}
