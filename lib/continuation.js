// lib/continuation.js -- ITEM O2 (32) -- 2026-10-15 brain-line
//
// AN ANSWER THAT STOPPED ON max_tokens IS CONTINUED, NOT MARKED. Measured on 7ba44481 (side-brain-line-2026-10-15/
// items/32.md): an answer cut by the output budget reached the reader half-written with `<incomplete/>` (free brain,
// before writing) or with nothing at all (the legacy stream, whose `stop_reason` nobody read).
//
// THE RULE (the order, O2). On `max_tokens`, up to MAX_CONTINUATIONS more calls with the same system and the same
// history, the text so far as the assistant's turn and CONTINUE_MESSAGE as the reader's; each call's text is joined to
// what went before through the same reviewers and lock as the first call's (the caller's own push), and the loop stops
// at `end_turn` (or any stop that is not max_tokens), at the third call, or when CONTINUATION_BUDGET_MS of the whole
// answer have passed. Only an answer still cut after that carries the mark.
//
// THE SEAM. The model is asked not to repeat itself, and is not trusted to: the opening of each continuation is held
// until it can be compared with the end of the text so far, and any overlap (OVERLAP_MIN..OVERLAP_MAX characters) is
// dropped once, at the seam.

export const CONTINUE_MESSAGE = 'كمّل من آخر نقطة من غير إعادة ما سبق';
export const MAX_CONTINUATIONS = 3;
export const CONTINUATION_BUDGET_MS = 240000;
const OVERLAP_MIN = 12;
const OVERLAP_MAX = 400;

/** The stop that asks for a continuation. Only the output budget: a refusal, a stop sequence or a cut stream is not one. */
export function needsContinuation(stop) {
  return stop === 'max_tokens';
}

/** The two turns a continuation call appends to the history. */
export function continuationTail(soFar) {
  return [
    { role: 'assistant', content: String(soFar || '') },
    { role: 'user', content: CONTINUE_MESSAGE },
  ];
}

/** How many leading characters of `next` repeat the end of `soFar` (0 below OVERLAP_MIN). */
export function overlapLength(soFar, next) {
  const a = String(soFar || '');
  const b = String(next || '');
  const top = Math.min(OVERLAP_MAX, a.length, b.length);
  for (let k = top; k >= OVERLAP_MIN; k -= 1) {
    if (a.endsWith(b.slice(0, k))) return k;
  }
  return 0;
}

/**
 * The seam of one continuation. `push(delta)` for a streamed call, `end(full)` for both: the opening is held until
 * OVERLAP_MAX characters (or the end) are in hand, the overlap is dropped, and everything after goes to `emit` as it
 * arrives. Returns the text actually added.
 */
export function createContinuationJoiner(soFar, emit) {
  let held = '';
  let open = true;
  let added = '';
  const out = (t) => { if (!t) return; added += t; if (emit) emit(t); };
  const release = () => {
    if (!open) return;
    open = false;
    out(held.slice(overlapLength(soFar, held)));
    held = '';
  };
  return {
    push(delta) {
      const t = String(delta == null ? '' : delta);
      if (!open) { out(t); return; }
      held += t;
      if (held.length >= OVERLAP_MAX) release();
    },
    end(full) {
      // A buffered call hands its whole text at the end; a streamed one has already pushed it.
      if (open && !held && typeof full === 'string') held = full;
      release();
      return added;
    },
  };
}

/**
 * Continue while the stop is max_tokens.
 *   firstStop  the first call's stop_reason       soFar   the text the first call wrote (as the reader got it)
 *   startedAt  the answer's start (the budget is the whole answer's)
 *   call({ tail, push, n }) -> { text?, stop }   one more call: `tail` appended to the history, deltas to `push`
 *   emit(text)  where the joined text goes (the same releaser / lock / stream as the first call's)
 * Returns { text: soFar + everything added, stop: the last stop, continued: calls made }.
 */
export async function runContinuations({ firstStop, soFar = '', startedAt, now = Date.now, signal, call, emit, onStart } = {}) {
  let stop = firstStop;
  let text = String(soFar || '');
  let continued = 0;
  const began = Number.isFinite(startedAt) ? startedAt : now();
  while (needsContinuation(stop) && continued < MAX_CONTINUATIONS && now() - began < CONTINUATION_BUDGET_MS
    && !(signal && signal.aborted) && text) {
    continued += 1;
    if (onStart) { try { onStart(continued); } catch { /* a status frame never stops a continuation */ } }
    const joiner = createContinuationJoiner(text, emit);
    let result = null;
    try {
      result = await call({ tail: continuationTail(text), push: (d) => joiner.push(d), n: continued });
    } catch {
      // The call could not be made: what was written stands, and the answer is still cut (the stop stays max_tokens).
      joiner.end(null);
      break;
    }
    text += joiner.end(result && typeof result.text === 'string' ? result.text : null);
    stop = result && typeof result.stop === 'string' ? result.stop : null;
  }
  return { text, stop, continued };
}

// -- THE LEGACY STREAM'S RELAY ---------------------------------------------------------------------------------------
//
// The legacy routes relay the provider's own SSE frames to the sealed writer. To continue one, the relay holds the last
// text block's `content_block_stop` and the `message_delta` until it knows the stop: on max_tokens the continuation's
// text is written as deltas of that same block, then the held frames follow, the message_delta carrying the last stop.
// A stream still cut after the continuations gets `mark` as the block's last delta. Every other frame passes as it came.

const textFrame = (index, text) => 'data: ' + JSON.stringify({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } }) + '\n\n';

export function createContinuationRelay({ write, continueWith, mark = '', startedAt, now = Date.now, signal, onStop, onStart } = {}) {
  let buffer = '';
  let text = '';
  let textIndex = 0;
  let heldStop = null;
  let reported = false;
  const decoder = new TextDecoder();
  const flushHeld = () => { if (heldStop) { write(heldStop); heldStop = null; } };
  const frame = async (raw) => {
    const data = raw.split(/\r?\n/).find((l) => l.startsWith('data:'));
    let e = null;
    if (data) { try { e = JSON.parse(data.slice(5).trim()); } catch { e = null; } }
    const whole = raw + '\n\n';
    if (e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta' && typeof e.delta.text === 'string') {
      text += e.delta.text;
      textIndex = e.index;
      write(whole);
      return;
    }
    if (e && e.type === 'content_block_stop' && e.index === textIndex && text) { heldStop = whole; return; }
    if (e && e.type === 'message_delta' && e.delta && typeof e.delta === 'object') {
      let stop = typeof e.delta.stop_reason === 'string' ? e.delta.stop_reason : null;
      let continued = 0;
      if (needsContinuation(stop) && heldStop && continueWith) {
        const r = await runContinuations({
          firstStop: stop, soFar: text, startedAt, now, signal, onStart,
          call: ({ tail, push }) => continueWith(tail, push),
          emit: (t) => write(textFrame(textIndex, t)),
        });
        text = r.text; stop = r.stop; continued = r.continued;
      }
      if (needsContinuation(stop) && heldStop && mark) write(textFrame(textIndex, mark));
      flushHeld();
      reported = true;
      if (onStop) { try { onStop(stop, continued); } catch { /* the log never stops a stream */ } }
      write('data: ' + JSON.stringify({ ...e, delta: { ...e.delta, stop_reason: stop } }) + '\n\n');
      return;
    }
    flushHeld();
    write(whole);
  };
  const drain = async (final) => {
    let i;
    while ((i = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const m = buffer.slice(i).match(/^\r?\n\r?\n/);
      const raw = buffer.slice(0, i);
      buffer = buffer.slice(i + m[0].length);
      if (raw.trim()) await frame(raw);
    }
    if (final && buffer.trim()) { const raw = buffer; buffer = ''; await frame(raw); }
  };
  return {
    async push(chunk) {
      buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      await drain(false);
    },
    async end() {
      buffer += decoder.decode();
      await drain(true);
      flushHeld();
      // A stream that ended without a message_delta never said how it stopped; it is reported as such.
      if (!reported && onStop) { try { onStop('stream_cut', 0); } catch { /* idem */ } }
    },
    get text() { return text; },
  };
}
