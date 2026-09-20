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

// ── §١ (2026-09-20) · THE ONE FACT A COLLAPSE CANNOT BE READ WITHOUT ─────────
//
// WHAT WAS MEASURED, AND WHY A COUNTER IS THE ANSWER TO IT. Twice on the preview the reader was
// handed the apology above and the platform log held twenty `info` entries with no `warn`, no
// `error` and no timeout in any of them. Both times it was the SECOND question of a fast pair,
// and both times the same question answered normally when it was sent again on its own. So the
// owner's fourth question about a collapse — «هل سبقَه طلبٌ لم يُغلَقْ» — is a question about
// this process's OTHER requests, and nothing on the failing request can answer it.
//
// THIS IS THE ONE SEAT THAT CAN COUNT THEM. `guardEmptyAnswer` is installed at the top of the
// handler, once per request, before the body is parsed — and it already owns `res.end`, which is
// where a request stops being in flight. A counter anywhere else would need a second call site
// to keep in step with this one.
//
// IT IS PROCESS-LOCAL AND SAYS SO. A serverless instance serves what it serves; a second
// container's requests are invisible here and the number is honest about being this container's
// own. It is a small integer, it is never sent to a reader, and nothing about it is derived from
// anything anybody typed.
let inFlight = 0;

/**
 * How many requests this process has open right now, INCLUDING the caller's own.
 * Read by api/ask.js for the collapse trace; it is telemetry and nothing branches on it.
 * @returns {number}
 */
export function askInFlight() { return inFlight; }

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
  // §١ — whether ANY byte at all went down the wire before the end, which is how a stream that
  // said nothing is told apart from a stream that was never opened. It is not the same question
  // as `sawText`: a stream can carry a message_start and a message_stop and no prose.
  let wroteAnything = false;
  // Tracked here rather than read back off the response, because the shape of that readback is
  // not the same on a Vercel response and on a guard's double, and a check that only works
  // against one of them is a check that is never exercised by the other.
  let code = 0;
  let contentType = '';

  const realWrite = typeof res.write === 'function' ? res.write.bind(res) : null;
  const realEnd = typeof res.end === 'function' ? res.end.bind(res) : null;
  const realStatus = typeof res.status === 'function' ? res.status.bind(res) : null;
  const realSetHeader = typeof res.setHeader === 'function' ? res.setHeader.bind(res) : null;
  // BELOW the bail-out, so a response this wrapper declines to wrap is never counted — it has no
  // `end` of ours to decrement on, and a count that only goes up is worse than no count.
  if (!realWrite || !realEnd) return res;

  // §١ — taken at INSTALL, not at end: the number of requests this container already had open
  // when this one arrived. That is «هل سبقَه طلبٌ لم يُغلَقْ» stated as a number, and reading it
  // at the end would answer a different question — how many are open now, after the wait.
  inFlight += 1;
  const openedBeside = inFlight - 1;
  // Decremented EXACTLY ONCE, whichever way the request leaves: through `res.end` below, or
  // through the socket closing under a handler that returned without ending. A counter that can
  // be decremented twice is a counter that goes negative and lies in the other direction.
  let counted = true;
  const release = () => { if (counted) { counted = false; inFlight -= 1; } };
  res.once?.('close', release);

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
    try { wroteAnything = true; scan(decodeChunk(chunk)); } catch { /* observation must never break the relay */ }
    return realWrite(chunk, ...rest);
  };

  res.end = function wrappedEnd(...args) {
    if (closed) { release(); return realEnd(...args); }
    closed = true;
    try {
      if (args.length && typeof args[0] !== 'function') scan(decodeChunk(args[0]));
      evaluate(carry);            // a stream may end on a frame with no trailing blank line
      const sse = contentType.indexOf('text/event-stream') !== -1;
      const okStatus = code === 200 || (code === 0 && res.statusCode === 200);
      if (sse && okStatus && !sawText && !sawError) {
        // ── §١ · THE LINE THAT WAS NOT THERE (2026-09-20) ──────────────────
        //
        // WHAT THIS USED TO SAY: `{ path }`. One word, and it answered none of the four questions
        // an autopsy of a collapse actually asks. The owner asked for those four by name and this
        // is them, in the order he asked: the CLASS of text the reader is about to be handed, the
        // PHASE this response had reached, whether BYTES WERE ALREADY FLOWING, and whether a
        // request that never closed was open beside this one.
        //
        // NOT ONE OF THEM IS READER TEXT. `kind` and `stage` are fixed literals chosen here;
        // `streaming` and `sawError` are single bits about this response's own wire; `inFlight`
        // and `openedBeside` are integers this module counted. The apology's own words are not
        // printed either — they are a constant in this file, and printing a constant back is
        // noise that makes a log line look like it carries content when it does not.
        console.warn('[empty-answer]', {
          path,
          kind: 'apology-substituted',
          stage: wroteAnything ? 'stream-opened-and-said-nothing' : 'stream-never-opened',
          streaming: wroteAnything,
          sawError,
          inFlight,
          openedBeside,
        });
        realWrite(APOLOGY_FRAME);
        realWrite(STOP_FRAME);
      }
    } catch { /* never turn a silent reply into a crashed one */ }
    release();
    return realEnd(...args);
  };

  return res;
}
