// lib/diag-trace.js -- DIAG_TRACE_V1: the diagnostic trace of one /api/ask turn (order د-١, 2026-09-25).
//
// WHAT IT IS FOR. The platform log keeps tool names and row counts, and nothing else of a turn: not
// the query, not what came back, not the judge's raw reply, not the pinned citation table, not what
// the writer cited, not the sentence door's decisions, not what the phrase filters removed. So a
// failed answer could only be diagnosed by inference. This module writes all of it, for one turn, to
// the platform's own runtime log, so the owner can ask a question on the preview and then read, in
// order, everything the turn did.
//
// WHERE IT CAN RUN. Only where `DIAG_TRACE_V1` says on|true|1 AND `VERCEL_ENV` is not 'production'.
// The production half is not a default that a row could flip: a production deployment returns
// `enabled:false` whatever DIAG_TRACE_V1 or any other flag says, and then nothing below runs at all
// -- no context is opened, no fetch is observed, no write is wrapped, no line is written.
//
// IT CHANGES NO BYTE THE READER RECEIVES. Every hook is `diagTrace(stage, () => data)`: with no turn
// open it returns before calling the thunk. The fetch observer passes the same arguments to the same
// fetch and returns the same Response object; it reads a clone. The reply's write/end are wrapped to
// COPY what passes through, and call the originals with the same arguments. Nothing here is read by
// the answer path. Gate `diagtrace` drives a simulated turn with the switch on and off and compares
// what reaches the reader byte for byte, unstreamed and streamed.
//
// THE QUESTION IS WRITTEN. The standing rule (guards/telemetry-text-guard.cjs) is that the reader's
// question never reaches the log. This trace writes it, by the owner's order for this switch: the
// preview is used by the owner alone. That is exactly why the switch cannot open in production.
//
// NO SECRET IS WRITTEN. No request header is ever read. URL parameters that look like credentials are
// masked, and every environment value whose NAME looks like a credential is replaced wherever it
// appears in a record, before the record is serialised.
//
// THE CHANNEL (measured, order د-١ §٢ row 13; the numbers are in the trace report). Vercel keeps at
// most 256 log lines and 1 MB per request, 256 KB per line. A turn's records are written as ONE byte
// stream -- each record a JSON line -- cut into numbered lines of at most LINE_BYTES, each carrying its
// own sha256 prefix; the last line carries the count and the sha256 of the whole stream. So
// tools/trace-read.mjs joins them back with no loss, and says so when a line is missing.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes } from 'node:crypto';

export const DIAG_TRACE_TAG = '[diag-trace]';
export const DIAG_TRACE_VERSION = 1;
// One log line's payload, in UTF-8 bytes, and the request's budget. The platform's ceilings are 256 KB
// a line, 256 lines and 1 MB a request; the handler's own lines take ~15 lines and ~5 KB of that.
export const LINE_BYTES = 48 * 1024;
export const MAX_LINES = 200;
export const MAX_BYTES = 900 * 1024;
// A record is flushed at once when the buffer holds a full line, and at most FLUSH_MS after it was
// written otherwise, so a turn the platform kills at its limit loses at most FLUSH_MS of records.
export const FLUSH_MS = 2000;
// One string field is kept whole up to this many characters; past it the record says so.
export const FIELD_CHARS = 60000;

const als = new AsyncLocalStorage();

export function diagTraceDecision(env = process.env) {
  if (String(env.VERCEL_ENV || '').trim().toLowerCase() === 'production') return { enabled: false, reason: 'production' };
  const raw = String(env.DIAG_TRACE_V1 ?? '').trim().toLowerCase();
  if (raw === 'on' || raw === 'true' || raw === '1') return { enabled: true, reason: 'env_on' };
  return { enabled: false, reason: raw ? 'env_off' : 'unset' };
}

export function diagTraceActive() { return !!als.getStore(); }

const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|BYPASS|PRIVATE|SIGNING|SALT|DSN/i;
const SECRET_PARAM = /key|token|secret|sig|auth|password|bypass/i;
function secretsOf(env) {
  const out = [];
  for (const [name, value] of Object.entries(env || {})) {
    const v = String(value || '');
    if (SECRET_NAME.test(name) && v.length >= 8) out.push(v);
  }
  return out.sort((a, b) => b.length - a.length);
}

function scrub(text, secrets) {
  let out = text;
  for (const s of secrets) if (out.includes(s)) out = out.split(s).join('[redacted]');
  return out;
}

// A plain copy of one record: no function, no cycle (an object inside ITSELF -- the same object twice side by
// side is written twice), and no string longer than FIELD_CHARS.
function plain(value, ancestors) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > FIELD_CHARS ? value.slice(0, FIELD_CHARS) + `…[diag-trace: ${value.length - FIELD_CHARS} more chars not written]` : value;
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object') return undefined;
  if (ancestors.includes(value)) return '[cycle]';
  if (value instanceof Error) return { error: String(value.message || value) };
  if (typeof value.toJSON === 'function' && !(value instanceof Map) && !(value instanceof Set)) {
    try { return plain(value.toJSON(), ancestors); } catch { return String(value); }
  }
  const next = [...ancestors, value];
  if (value instanceof Map) value = Object.fromEntries(value);
  else if (value instanceof Set) value = [...value];
  if (Array.isArray(value)) return value.map((item) => { const v = plain(item, next); return v === undefined ? null : v; });
  const out = {};
  for (const [k, v] of Object.entries(value)) { const p = plain(v, next); if (p !== undefined) out[k] = p; }
  return out;
}
function serialise(record) {
  return JSON.stringify(plain(record, []));
}

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

// Cut `s` into pieces of at most `max` UTF-8 bytes, never inside a surrogate pair.
function cut(s, max) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    let lo = i + 1, hi = Math.min(s.length, i + max);
    // Binary search the longest slice that fits: Arabic is two bytes a char, Latin one.
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (bytes(s.slice(i, mid)) <= max) lo = mid; else hi = mid - 1;
    }
    let end = lo;
    const c = s.charCodeAt(end - 1);
    if (end < s.length && c >= 0xd800 && c <= 0xdbff) end -= 1;
    out.push(s.slice(i, end));
    i = end;
  }
  return out;
}

function createTurn({ env, write, now, meta }) {
  const t0 = now();
  const turn = {
    id: `${new Date(t0).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomBytes(4).toString('hex')}`,
    t0, seq: 0, now, write, secrets: secretsOf(env),
    buffer: '', line: 0, sentBytes: 0, streamHash: createHash('sha256'), streamBytes: 0,
    overflow: null, ended: false, timer: null, lastFlush: t0, meta,
  };
  return turn;
}

function emitLine(turn, payload, extra = {}) {
  turn.line += 1;
  const line = `${DIAG_TRACE_TAG} ${JSON.stringify({ v: DIAG_TRACE_VERSION, turn: turn.id, n: turn.line, sha: sha(payload).slice(0, 16), ...extra, d: payload })}`;
  turn.sentBytes += bytes(line);
  turn.write(line);
}

function flush(turn, all) {
  if (turn.overflow) { turn.buffer = ''; return; }
  const pieces = cut(turn.buffer, LINE_BYTES);
  const keep = all ? 0 : (pieces.length && bytes(pieces[pieces.length - 1]) < LINE_BYTES ? 1 : 0);
  const send = pieces.slice(0, pieces.length - keep);
  for (const piece of send) {
    // One line and ~1 KB stay reserved for the closing line.
    if (turn.line + 2 > MAX_LINES || turn.sentBytes + bytes(piece) + 1024 > MAX_BYTES) {
      turn.overflow = { atLine: turn.line, unsentBytes: bytes(turn.buffer) };
      turn.buffer = '';
      return;
    }
    emitLine(turn, piece);
    turn.buffer = turn.buffer.slice(piece.length);
  }
  turn.lastFlush = turn.now();
}

function push(turn, stage, data) {
  if (turn.ended) return;
  turn.seq += 1;
  const record = { seq: turn.seq, t: turn.now() - turn.t0, stage, data };
  let json;
  try { json = serialise(record); } catch (e) { json = serialise({ seq: turn.seq, t: record.t, stage, data: { unserialisable: String(e && e.message) } }); }
  json = scrub(json, turn.secrets) + '\n';
  turn.streamHash.update(json, 'utf8');
  turn.streamBytes += bytes(json);
  if (turn.overflow) { turn.overflow.unsentBytes += bytes(json); return; }
  turn.buffer += json;
  if (bytes(turn.buffer) >= LINE_BYTES || turn.now() - turn.lastFlush >= FLUSH_MS) flush(turn, bytes(turn.buffer) < LINE_BYTES);
}

function endTurn(turn, reason) {
  if (turn.ended) return;
  push(turn, 'trace-end', { reason, records: turn.seq + 1 });
  turn.ended = true;
  if (turn.timer) clearInterval(turn.timer);
  flush(turn, true);
  const payload = '';
  turn.line += 1;
  const line = `${DIAG_TRACE_TAG} ${JSON.stringify({
    v: DIAG_TRACE_VERSION, turn: turn.id, n: turn.line, end: true, lines: turn.line - 1,
    streamBytes: turn.streamBytes, streamSha: turn.streamHash.digest('hex'),
    overflow: turn.overflow, d: payload,
  })}`;
  turn.write(line);
}

/** Record one stage of the open turn. `data` may be a thunk; it is not called when no turn is open. */
export function diagTrace(stage, data) {
  const turn = als.getStore();
  if (!turn) return;
  try {
    push(turn, stage, typeof data === 'function' ? data() : data);
  } catch (error) {
    try { push(turn, 'trace-error', { stage, error: String(error && error.message || error) }); } catch { /* never throws */ }
  }
}

/**
 * Only while tracing: every `push` onto `list` is also a record, with its time. The array stays the
 * same array; `push` is an own, non-enumerable property, so JSON and spreading see what they saw.
 */
export function diagTraceWatch(list, stage) {
  const turn = als.getStore();
  if (!turn || !Array.isArray(list)) return list;
  Object.defineProperty(list, 'push', {
    configurable: true, enumerable: false, writable: true,
    value(...items) {
      try { for (const item of items) push(turn, stage, item); } catch { /* never throws */ }
      return Array.prototype.push.apply(this, items);
    },
  });
  return list;
}

// ── THE FETCH OBSERVER ────────────────────────────────────────────────────────────────────────────
const OBSERVED = Symbol.for('ustaz.diagTrace.observedFetch');

function safeUrl(input) {
  try {
    const u = new URL(typeof input === 'string' ? input : (input && (input.href || input.url)) || String(input));
    for (const k of [...u.searchParams.keys()]) if (SECRET_PARAM.test(k)) u.searchParams.set(k, '[redacted]');
    return u;
  } catch { return null; }
}

function textOfContent(content) {
  if (typeof content === 'string') return content;
  return (Array.isArray(content) ? content : []).filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
}

function requestSummary(url, init) {
  const out = { url: url ? url.origin + url.pathname + (url.search || '') : '', method: String(init?.method || 'GET') };
  let body = null;
  if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { out.bodyChars = init.body.length; } }
  if (body && Array.isArray(body.messages) && body.model) {
    out.kind = 'provider';
    const sys = Array.isArray(body.system) ? textOfContent(body.system) : String(body.system || '');
    const last = body.messages[body.messages.length - 1];
    Object.assign(out, {
      model: body.model, maxTokens: body.max_tokens, stream: body.stream === true,
      systemHead: sys.slice(0, 160), systemChars: sys.length, systemSha: sha(sys).slice(0, 16),
      tools: Array.isArray(body.tools) ? body.tools.map((t) => t && t.name) : [],
      messages: body.messages.length,
      lastRole: last && last.role,
      lastText: textOfContent(last && last.content).slice(0, 6000),
    });
  } else if (body) {
    out.kind = 'service';
    out.body = body;
  } else if (url) {
    out.kind = 'service';
    out.query = Object.fromEntries(url.searchParams);
  }
  return out;
}

function sseText(raw) {
  let text = '';
  let stop = null;
  let usage = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    try {
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === 'content_block_delta' && ev.delta && typeof ev.delta.text === 'string') text += ev.delta.text;
      if (ev.type === 'message_delta') { stop = ev.delta?.stop_reason ?? stop; usage = { ...(usage || {}), ...(ev.usage || {}) }; }
      if (ev.type === 'message_start') usage = { ...(ev.message?.usage || {}) };
    } catch { /* a partial line */ }
  }
  return { text, stop, usage };
}

const head120 = (s) => String(s || '').replace(/\s+/gu, ' ').trim().slice(0, 120);

function responseSummary(req, raw) {
  const out = { bytes: bytes(raw) };
  if (req.kind === 'provider') {
    if (req.stream) {
      Object.assign(out, sseText(raw));
      if (!(Number(req.maxTokens) <= 2000)) { out.textChars = out.text.length; delete out.text; }
      return out;
    }
    try {
      const j = JSON.parse(raw);
      Object.assign(out, {
        stop: j.stop_reason ?? null, usage: j.usage || null,
        blocks: Array.isArray(j.content) ? j.content.map((b) => b && b.type) : [],
        text: textOfContent(j.content),
        toolUse: Array.isArray(j.content) ? j.content.filter((b) => b && b.type === 'tool_use').map((b) => ({ name: b.name, input: b.input })) : [],
        error: j.error || undefined,
      });
    } catch { out.text = raw.slice(0, 4000); }
    // A writing-size call's text is already in its `call` record (the loop's ledger names its phase);
    // here only the short calls keep theirs -- the resolver, the judge, the reviewers, takhrij's own.
    if (!(Number(req.maxTokens) <= 2000) && typeof out.text === 'string') { out.textChars = out.text.length; delete out.text; }
    return out;
  }
  let j = null;
  try { j = JSON.parse(raw); } catch { out.head = raw.slice(0, 600); return out; }
  if (j && Array.isArray(j.hits)) {
    // The library: every passage that came back, as the order names it.
    const top = {};
    for (const [k, v] of Object.entries(j)) if (k !== 'hits' && (v == null || typeof v !== 'object')) top[k] = v;
    Object.assign(out, top, {
      refused: j.refused === true,
      hits: j.hits.map((h) => ({
        id: h.atom_id, book: h.subject_id, title: h.book_title, author: h.author, volume: h.volume,
        page: h.page_start, pageEnd: h.page_end, citable: h.page_citable, heading: h.heading_path,
        score: h.score, chars: String(h.text || '').length, head: head120(h.text),
      })),
    });
    return out;
  }
  if (j && Array.isArray(j.results)) {
    Object.assign(out, {
      total: j.pagination?.total,
      results: j.results.map((r) => ({
        id: r.id, title: r.title, scholar: r.scholar?.name || r.scholar_name || r.scholar,
        url: r.url || r.source_url, head: head120(r.answer || r.text || r.question || ''),
      })),
    });
    return out;
  }
  out.keys = j && typeof j === 'object' ? Object.keys(j).slice(0, 30) : typeof j;
  out.head = raw.slice(0, 600);
  return out;
}

// The limiter's and the day cap's store (Upstash/KV) is not evidence, and its keys name a device or an
// address: its calls are never written.
function isStoreCall(input, init) {
  const u = safeUrl(input);
  const hosts = [process.env.KV_REST_API_URL, process.env.UPSTASH_REDIS_REST_URL]
    .map((v) => { try { return new URL(String(v || '')).host; } catch { return ''; } }).filter(Boolean);
  if (u && (hosts.includes(u.host) || /\.upstash\.io$/i.test(u.host))) return true;
  if (!u && typeof init?.body === 'string' && init.body.trim().startsWith('[')) return true;
  return false;
}

function observe(inner) {
  const observed = async function observedFetch(input, init) {
    const turn = als.getStore();
    if (!turn || isStoreCall(input, init)) return inner.call(this, input, init);
    const started = turn.now();
    let req;
    try { req = requestSummary(safeUrl(input), init); } catch (e) { req = { error: String(e && e.message) }; }
    let response;
    try {
      response = await inner.call(this, input, init);
    } catch (error) {
      push(turn, 'fetch', { req, ms: turn.now() - started, error: String(error && (error.name + ': ' + error.message)) });
      throw error;
    }
    const head = { req, status: response && response.status, ms: turn.now() - started };
    let copy = null;
    try { copy = response && typeof response.clone === 'function' && response.body ? response.clone() : null; } catch { copy = null; }
    if (!copy) { push(turn, 'fetch', head); return response; }
    copy.text().then(
      (raw) => { try { push(turn, 'fetch', { ...head, bodyMs: turn.now() - started, res: responseSummary(req, raw) }); } catch { /* never throws */ } },
      (error) => { try { push(turn, 'fetch', { ...head, bodyError: String(error && error.message) }); } catch { /* never throws */ } },
    );
    return response;
  };
  observed[OBSERVED] = inner;
  return observed;
}

function installFetchObserver() {
  const current = globalThis.fetch;
  if (typeof current !== 'function' || current[OBSERVED]) return;
  globalThis.fetch = observe(current);
}

// ── THE REPLY, COPIED ─────────────────────────────────────────────────────────────────────────────
function chunkText(chunk, encoding) {
  if (chunk == null) return '';
  if (typeof chunk === 'string') return chunk;
  try { return Buffer.from(chunk).toString(typeof encoding === 'string' ? encoding : 'utf8'); } catch { return ''; }
}

export function readerTextOfSse(raw) {
  let text = '';
  for (const block of String(raw || '').split('\n\n')) {
    const line = block.split('\n').find((l) => l.startsWith('data: '));
    if (!line) continue;
    try {
      const ev = JSON.parse(line.slice(6));
      if (ev.type === 'content_block_delta' && ev.delta && typeof ev.delta.text === 'string') text += ev.delta.text;
    } catch { /* not a frame */ }
  }
  return text;
}

function wrapReply(res, turn) {
  if (!res || typeof res.write !== 'function' || typeof res.end !== 'function') return;
  let sent = '';
  const write = res.write;
  const end = res.end;
  res.write = function tracedWrite(chunk, ...rest) {
    try { sent += chunkText(chunk, rest[0]); } catch { /* never throws */ }
    return write.call(this, chunk, ...rest);
  };
  res.end = function tracedEnd(chunk, ...rest) {
    try {
      if (chunk != null && typeof chunk !== 'function') sent += chunkText(chunk, rest[0]);
      push(turn, 'delivered', {
        status: res.statusCode, sseBytes: bytes(sent), sseSha: sha(sent).slice(0, 16),
        frames: sent.split('\n\n').filter((b) => b.startsWith('data: ')).length, readerText: readerTextOfSse(sent),
        // A reply that is not a server-sent stream (a JSON refusal, a 4xx) is kept as it was written.
        other: sent.includes('data: ') ? undefined : sent.slice(0, 4000),
        elapsedMs: turn.now() - turn.t0,
      });
      endTurn(turn, 'reply_end');
    } catch { /* never throws */ }
    return end.call(this, chunk, ...rest);
  };
}

/**
 * Run `fn` as one traced turn. With the switch off this is `fn()` and nothing else.
 * `options.write` and `options.now` are for the guard; the platform uses console.log and Date.now.
 */
export async function runDiagTraced(req, res, fn, options = {}) {
  const env = options.env || process.env;
  if (!diagTraceDecision(env).enabled) return fn();
  const turn = createTurn({
    env, write: options.write || ((line) => console.log(line)), now: options.now || (() => Date.now()),
  });
  installFetchObserver();
  wrapReply(res, turn);
  turn.timer = setInterval(() => { try { if (!turn.ended && turn.buffer) flush(turn, true); } catch { /* never throws */ } }, FLUSH_MS);
  if (turn.timer && typeof turn.timer.unref === 'function') turn.timer.unref();
  return als.run(turn, async () => {
    push(turn, 'trace-start', {
      method: req && req.method, path: req && req.url ? String(req.url).split('?')[0] : '',
      deployment: env.VERCEL_URL || '', env: env.VERCEL_ENV || '', commit: String(env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12),
      lineBytes: LINE_BYTES, maxLines: MAX_LINES, maxBytes: MAX_BYTES,
    });
    try {
      return await fn();
    } catch (error) {
      push(turn, 'handler-threw', { error: String(error && error.message || error) });
      throw error;
    } finally {
      endTurn(turn, 'handler_returned');
    }
  });
}

/** For tools/trace-read.mjs and the guard: join one turn's lines back into its records. */
export function joinTraceLines(lines) {
  const byTurn = new Map();
  for (const raw of lines) {
    const at = String(raw).indexOf(DIAG_TRACE_TAG + ' ');
    if (at < 0) continue;
    let j;
    try { j = JSON.parse(String(raw).slice(at + DIAG_TRACE_TAG.length + 1)); } catch { continue; }
    if (!j || !j.turn) continue;
    if (!byTurn.has(j.turn)) byTurn.set(j.turn, { turn: j.turn, lines: new Map(), end: null, badSha: [] });
    const t = byTurn.get(j.turn);
    if (j.end) { t.end = j; continue; }
    if (sha(String(j.d || '')).slice(0, 16) !== j.sha) t.badSha.push(j.n);
    t.lines.set(j.n, String(j.d || ''));
  }
  const out = [];
  for (const t of byTurn.values()) {
    const nums = [...t.lines.keys()].sort((a, b) => a - b);
    const last = t.end ? t.end.lines : (nums.length ? nums[nums.length - 1] : 0);
    const missing = [];
    for (let n = 1; n <= last; n += 1) if (!t.lines.has(n)) missing.push(n);
    const stream = nums.map((n) => t.lines.get(n)).join('');
    const records = [];
    const broken = [];
    for (const l of stream.split('\n')) {
      if (!l) continue;
      try { records.push(JSON.parse(l)); } catch { broken.push(l.slice(0, 80)); }
    }
    const streamSha = sha(stream);
    out.push({
      turn: t.turn, records, missingLines: missing, badShaLines: t.badSha, brokenRecords: broken.length,
      ended: !!t.end, overflow: t.end ? t.end.overflow : null,
      complete: !!t.end && !missing.length && !t.badSha.length && streamSha === t.end.streamSha && bytes(stream) === t.end.streamBytes,
      streamBytes: bytes(stream), streamSha,
    });
  }
  return out;
}

// ── THE CHANNEL PROBE (order د-١ §٢ row 13: the platform's limits are measured, not assumed) ─────────
//
// `GET /api/ask?diag_trace_probe=<mode>` on a deployment where the switch is on. It asks no model and
// no library, touches no store and no limiter, and answers 200 with what it wrote, so the reader can
// compare what the platform kept. Anywhere the switch is off it is not reached: the handler's first
// line only calls it inside `diagTraceDecision(...).enabled`.
//   sizes  one line each of 1, 8, 32, 64, 128, 200, 250, 262144-64 and 300 KB (Arabic and Latin mixed)
//   count  300 short numbered lines
//   total  24 lines of 64 KB (1.5 MB)
//   turn   a synthetic long turn through the real trace writer (~700 KB of records)
const PROBE_FILL = 'نصٌّ عربيٌّ للقياس — Latin 0123456789 ';
function probeLine(id, label, size) {
  const headOf = (fill) => `[diag-probe] ${JSON.stringify({ probe: id, label, size, fillSha: sha(fill).slice(0, 16) })} `;
  let fill = '';
  while (bytes(fill) < size) fill += PROBE_FILL;
  fill = cut(fill, Math.max(1, size - bytes(headOf(fill))))[0];
  const line = headOf(fill) + fill;
  return { line, bytes: bytes(line), fillSha: sha(fill).slice(0, 16) };
}

export async function diagTraceProbe(req, res, options = {}) {
  const env = options.env || process.env;
  if (!diagTraceDecision(env).enabled) return false;
  if (!req || String(req.method || '').toUpperCase() !== 'GET') return false;
  let mode = '';
  try { mode = new URL(String(req.url || ''), 'http://x').searchParams.get('diag_trace_probe') || ''; } catch { return false; }
  if (!mode) return false;
  const write = options.write || ((line) => console.log(line));
  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const sent = [];
  if (mode === 'sizes') {
    for (const kb of [1, 8, 32, 64, 128, 200, 250, 255.9375, 300]) {
      const p = probeLine(id, `size-${kb}k`, Math.round(kb * 1024));
      write(p.line); sent.push({ label: `size-${kb}k`, bytes: p.bytes, fillSha: p.fillSha });
    }
  } else if (mode === 'count') {
    for (let i = 1; i <= 300; i += 1) {
      const p = probeLine(id, `count-${i}`, 100);
      write(p.line); sent.push({ label: `count-${i}`, bytes: p.bytes });
    }
  } else if (mode === 'total') {
    for (let i = 1; i <= 24; i += 1) {
      const p = probeLine(id, `total-${i}`, 64 * 1024);
      write(p.line); sent.push({ label: `total-${i}`, bytes: p.bytes, fillSha: p.fillSha });
    }
  } else if (mode === 'turn') {
    const lines = [];
    await runDiagTraced(req, null, async () => {
      diagTrace('probe-turn', { probe: id });
      let body = '';
      while (bytes(body) < 40 * 1024) body += PROBE_FILL;
      for (let i = 1; i <= 16; i += 1) diagTrace('probe-record', { i, text: body, sha: sha(body).slice(0, 16) });
    }, { env, write: (line) => { lines.push(line); write(line); } });
    sent.push(...lines.map((l) => ({ bytes: bytes(l), n: (JSON.parse(l.slice(DIAG_TRACE_TAG.length + 1)).n) })));
  } else {
    return false;
  }
  const body = JSON.stringify({ probe: id, mode, lines: sent.length, totalBytes: sent.reduce((a, s) => a + s.bytes, 0), sent });
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
  return true;
}
