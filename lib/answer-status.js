// lib/answer-status.js -- ITEM O3a (132) -- 2026-10-15 brain-line
//
// THE READER SEES THAT SOMETHING IS HAPPENING. Measured on 7ba44481 (side-brain-line-2026-10-15/items/132.md): only
// before writing sent `ezik_status` frames; the free brain, the stored and the legacy paths left the reader in silence
// until the first word -- tens of seconds on a deep question -- and nothing said the answer was still being worked on.
//
// THE RULE (the order, O3a).
//   (1) a stage status from every path: retrieve, judge, write, continue (translate comes from the language gate); and
//       on a path that names none, one `write` status goes out just before its first text;
//   (2) THE SILENCE TIMER: every SILENCE_STATUS_MS without text, {type:'ezik_status',stage:'working',ms:<n>} on every
//       path, the legacy ones included; it stops at the first text and at the end.
// Only on an event-stream response: a JSON reply (a refusal, a 4xx) never receives a frame.

export const SILENCE_STATUS_MS = 5000;
export const ANSWER_STAGES = Object.freeze(['retrieve', 'judge', 'write', 'continue', 'translate', 'working']);
const TEXT_FRAME = /"type"\s*:\s*"content_block_delta"[\s\S]*"text_delta"/;

export const statusFrame = (stage, extra = {}) => 'data: ' + JSON.stringify({ type: 'ezik_status', stage, ...extra }) + '\n\n';

/**
 * Install on the response the answer is written to. Returns { status(stage), stop() }.
 *   deps: now, setTimer(fn, ms) -> handle, clearTimer(handle)   (a test clock)
 */
export function installAnswerStatus(res, { now = Date.now, setTimer, clearTimer, everyMs = SILENCE_STATUS_MS } = {}) {
  const noop = { status() { return false; }, stop() {} };
  if (!res || typeof res.write !== 'function' || res.__answerStatus) return res && res.__answerStatus ? res.__answerStatus : noop;
  const set = setTimer || ((fn, ms) => { const h = setInterval(fn, ms); if (h && h.unref) h.unref(); return h; });
  const clear = clearTimer || ((h) => clearInterval(h));
  const startedAt = now();
  const rawWrite = res.write.bind(res);
  let textSeen = false;
  let statusSeen = false;
  let stopped = false;
  let timer = null;
  const isStream = () => {
    try { return /text\/event-stream/i.test(String((res.getHeader && res.getHeader('Content-Type')) || '')); } catch { return false; }
  };
  const stop = () => { stopped = true; if (timer !== null) { clear(timer); timer = null; } };
  const send = (stage, extra) => {
    if (res.writableEnded || res.finished || !isStream()) return false;
    statusSeen = true;
    try { return rawWrite(statusFrame(stage, extra)) !== false; } catch { return false; }
  };
  res.write = (chunk, ...rest) => {
    const piece = typeof chunk === 'string' ? chunk : (chunk && chunk.toString ? chunk.toString('utf8') : '');
    if (/"type"\s*:\s*"ezik_status"/.test(piece)) statusSeen = true;
    if (!textSeen && TEXT_FRAME.test(piece)) {
      textSeen = true;
      stop();
      if (!statusSeen) send('write');
    }
    return rawWrite(chunk, ...rest);
  };
  const end = res.end && res.end.bind(res);
  if (end) res.end = (...args) => { stop(); return end(...args); };
  timer = set(() => {
    if (stopped || textSeen) { stop(); return; }
    send('working', { ms: Math.max(0, now() - startedAt) });
  }, everyMs);
  const api = {
    status(stage) {
      if (!ANSWER_STAGES.includes(stage) || stage === 'working') return false;
      // after the first text only `continue` still means something to the reader
      if (textSeen && stage !== 'continue') return false;
      return send(stage);
    },
    stop,
  };
  res.__answerStatus = api;
  return api;
}
