// lib/empty-answer.js — A 200 THAT SAYS NOTHING IS STILL A FAILURE, AND THE READER MUST BE TOLD.
//
// ── THE DEFECT (قرار ٩) ──────────────────────────────────────────────────────
// The model occasionally ends a stream having emitted no text at all: a clean 200, a well-formed
// SSE body, `message_stop`, and not one `text_delta` carrying a character. The client parses that
// faithfully and renders exactly what arrived — an empty bubble. To the reader this is
// indistinguishable from the app being broken, and it is worse than an error, because an error at
// least says something. Nothing in the pipeline noticed, because at every layer the request
// SUCCEEDED.
//
// ── WHY THIS IS A RESPONSE WRAPPER AND NOT A CHECK AT EACH EXIT ──────────────
// api/ask.js alone has fifteen `emitOnce` returns and eleven further direct `text_delta` writes,
// across the triage, floor, world, encyclopedic, claim, attributed and streamed routes. Adding an
// emptiness check to each is twenty-six chances to add it wrongly and, worse, a rule that the
// TWENTY-SEVENTH branch — the one written next month — silently will not follow.
//
// The invariant is a property of the RESPONSE, not of any branch: no 200 event-stream may end
// having carried zero visible text. Stated once, at the one place every branch must pass through
// to finish, it also covers the branches that do not exist yet.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────
// It does not fire on a reply that carried an `error` frame. That stream is not silently empty —
// it said something, the client has its own handling for it, and speaking over that would replace
// a real diagnosis with a generic apology. The target is the SUCCESSFUL-LOOKING silence only.
//
// It does not fire on a non-SSE response. A 429 JSON body, a 405, a CORS preflight and an upstream
// error forwarded verbatim are all responses with no text delta by design.

// The apology, صنف (ب): the system declaring a limit, not answering. Two sentences, no greeting
// and no preamble — guards/answer-shape-guard.cjs runs its detector over this very constant, so it
// is bound by the same shape rule as every other class (ب) text in the app.
export const EMPTY_ANSWER_APOLOGY =
  'تعذَّر توليدُ الجوابِ الآن. أعِدْ إرسالَ سؤالِك من فضلك.';

const APOLOGY_FRAME = `data: ${JSON.stringify({
  type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: EMPTY_ANSWER_APOLOGY },
})}\n\n`;
const STOP_FRAME = `data: ${JSON.stringify({ type: 'message_stop' })}\n\n`;

// A partial frame at a chunk boundary is normal on a relayed stream. Only the tail is kept: a
// frame is a few hundred bytes, and an unbounded accumulator on a streaming path is a leak.
const MAX_CARRY = 1 << 16;

function decodeChunk(chunk) {
  if (chunk == null) return '';
  if (typeof chunk === 'string') return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
  // api/chat.js relays the upstream reader's Uint8Array views verbatim.
  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString('utf8');
  }
  return '';
}

/**
 * Wrap `res` so that a 200 event-stream which ends having carried no visible text emits the
 * class (ب) apology before it closes. Idempotent; returns the same `res`.
 *
 * @param {object} res   the response, real or a test double
 * @param {string} path  route label for the log line
 */
export function guardEmptyAnswer(res, path) {
  if (!res || res.__emptyAnswerGuarded) return res;
  res.__emptyAnswerGuarded = true;

  let sawText = false;      // a text_delta carrying at least one non-space character
  let sawError = false;     // an error frame — this stream is not silently empty
  let carry = '';
  let closed = false;
  // Tracked here rather than read back off the response, because the shape of that readback is
  // not the same on a Vercel response and on a guard's double, and a check that only works
  // against one of them is a check that is never exercised by the other.
  let code = 0;
  let contentType = '';

  const realWrite = typeof res.write === 'function' ? res.write.bind(res) : null;
  const realEnd = typeof res.end === 'function' ? res.end.bind(res) : null;
  const realStatus = typeof res.status === 'function' ? res.status.bind(res) : null;
  const realSetHeader = typeof res.setHeader === 'function' ? res.setHeader.bind(res) : null;
  if (!realWrite || !realEnd) return res;

  if (realStatus) res.status = (c) => { code = c; return realStatus(c); };
  if (realSetHeader) {
    res.setHeader = (k, v) => {
      if (String(k).toLowerCase() === 'content-type') contentType = String(v);
      return realSetHeader(k, v);
    };
  }

  // One frame, already split off its separator.
  const evaluate = (frame) => {
    if (!frame || frame.indexOf('data:') === -1) return;
    let data = '';
    for (const line of frame.split('\n')) {
      const l = line.trim();
      if (l.startsWith('data:')) data += l.slice(5).trim();
    }
    if (!data) return;
    let evt = null;
    try { evt = JSON.parse(data); } catch { return; }
    if (!evt) return;
    if (evt.type === 'error') { sawError = true; return; }
    if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta'
      && String(evt.delta.text == null ? '' : evt.delta.text).trim() !== '') sawText = true;
  };

  const scan = (s) => {
    if (!s) return;
    carry += s;
    let idx;
    while ((idx = carry.indexOf('\n\n')) !== -1) {
      evaluate(carry.slice(0, idx));
      carry = carry.slice(idx + 2);
    }
    if (carry.length > MAX_CARRY) carry = carry.slice(-MAX_CARRY);
  };

  res.write = function wrappedWrite(chunk, ...rest) {
    try { scan(decodeChunk(chunk)); } catch { /* observation must never break the relay */ }
    return realWrite(chunk, ...rest);
  };

  res.end = function wrappedEnd(...args) {
    if (closed) return realEnd(...args);
    closed = true;
    try {
      if (args.length) scan(decodeChunk(args[0]));
      evaluate(carry);            // a stream may end on a frame with no trailing blank line
      const sse = contentType.indexOf('text/event-stream') !== -1;
      const okStatus = code === 200 || (code === 0 && res.statusCode === 200);
      if (sse && okStatus && !sawText && !sawError) {
        console.warn('[empty-answer]', { path });
        realWrite(APOLOGY_FRAME);
        realWrite(STOP_FRAME);
      }
    } catch { /* never turn a silent reply into a crashed one */ }
    return realEnd(...args);
  };

  return res;
}
