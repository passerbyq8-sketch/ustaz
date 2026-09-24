// lib/full-answer.js — PROGRAM ORDER 2026-09-24, م٣-أ (FULL_ANSWER_V1): the clock a continuation is
// allowed to spend.
//
// THE DEFECT (item 32, confirmed live by the owner on 24 September): both «طالب علم» answers were
// cut mid-sentence or on an empty heading and skipped whole parts of the question. MEASURED on the
// production log: the tools-removed write stopped on `max_tokens` at 6144 tokens, after 60.9 s and
// 103.9 s (program-2026-09-24/01-item32/prod-log-extract.txt). The reader got «لم يكتملْ» and a
// «كمّل» button.
//
// THE REPAIR lives in lib/free-brain/loop.js: the capped draft is cut back to its last whole
// sentence, and that head goes back to the model with a note asking for the rest. The assistant
// turn is followed by a user turn, and this is the only shape open here. The two writing models
// (claude-opus-5 and claude-sonnet-5) answer a last-turn assistant prefill with a 400, so the four
// rewrite doors in that file already use this shape (03-answer/measure/A-continue.md §0).
//
// THIS FILE IS ONLY THE CLOCK. A continuation that starts too late is killed with the whole function
// at 300 s (vercel.json `maxDuration`). The reader then gets nothing, which is worse than the
// «لم يكتملْ» it was meant to replace. So every continuation, and every whole-answer rewrite after a
// continued draft, first asks whether it still fits.

// The function is killed at 300 s. A finish at 299,556 ms has been seen (lib/free-brain/tools.js),
// so 15 s is kept back from the kill.
export const FULL_ANSWER_HARD_MS = 285_000;
// Time after the last writing call: the takhrij pass (p95 1,820 ms against the real library), the
// reviewer, finalizer and writer (≤ 0.8 s in-process), and the SSE close. Rounded up.
export const FULL_ANSWER_POST_MS = 5_000;
// The fast-model ruling review that follows a before-writing fiqh write (RULING_REVIEW_MAX_TOKENS
// 2000 on claude-haiku-4-5). It is reserved only on such a turn.
export const FULL_ANSWER_RULING_RESERVE_MS = 20_000;
// Time to first token: 1,364 ms was measured at ~39k input tokens. A continuation reads ~49k.
export const FULL_ANSWER_TTFT_MS = 2_000;
// A continuation shorter than this is not worth a call, and it is not what the reader is missing.
export const FULL_ANSWER_MIN_TOKENS = 512;
// Two continuations: the slower measured witness (59 tok/s) has time for one, the faster one for two.
export const FULL_ANSWER_MAX_CONTINUATIONS = 2;
// Tokens per millisecond when the capped call reported no usable speed. 30 tok/s is below both
// measured witnesses, so an unknown speed plans a shorter continuation, never a longer one.
export const FULL_ANSWER_FALLBACK_RATE = 0.03;

/** The measured writing speed of the call that just capped, in tokens per millisecond. */
export function writingRate(outTokens, ms) {
  const out = Number(outTokens);
  const took = Number(ms);
  if (!(out > 0) || !(took > 0)) return FULL_ANSWER_FALLBACK_RATE;
  return out / took;
}

/**
 * Whether one more continuation fits before the kill, and how many tokens it may ask for.
 *
 * @param {{startedAt:number, now:number, rate:number, maxTokens:number, reserveMs?:number}} input
 * @returns {{ok:boolean, elapsedMs:number, availableMs:number, maxTokens?:number}}
 */
export function continuationClock({ startedAt, now, rate, maxTokens, reserveMs = 0 }) {
  const elapsedMs = Math.max(0, Number(now) - Number(startedAt));
  const availableMs = FULL_ANSWER_HARD_MS - FULL_ANSWER_POST_MS - Number(reserveMs || 0) - elapsedMs;
  const speed = Number(rate) > 0 ? Number(rate) : FULL_ANSWER_FALLBACK_RATE;
  if (!(availableMs >= FULL_ANSWER_TTFT_MS + FULL_ANSWER_MIN_TOKENS / speed)) {
    return { ok: false, elapsedMs, availableMs };
  }
  const fit = Math.floor((availableMs - FULL_ANSWER_TTFT_MS) * speed);
  return { ok: true, elapsedMs, availableMs, maxTokens: Math.max(FULL_ANSWER_MIN_TOKENS, Math.min(Number(maxTokens), fit)) };
}

/**
 * Whether a whole-answer rewrite (citation, reject, empty, ascription) still fits after a continued
 * draft. Such a rewrite may write up to the full budget again, so it is timed at the full budget.
 *
 * @param {{startedAt:number, now:number, rate:number, maxTokens:number, reserveMs?:number}} input
 * @returns {{ok:boolean, elapsedMs:number, availableMs:number}}
 */
export function rewriteClock({ startedAt, now, rate, maxTokens, reserveMs = 0 }) {
  const elapsedMs = Math.max(0, Number(now) - Number(startedAt));
  const availableMs = FULL_ANSWER_HARD_MS - FULL_ANSWER_POST_MS - Number(reserveMs || 0) - elapsedMs;
  const speed = Number(rate) > 0 ? Number(rate) : FULL_ANSWER_FALLBACK_RATE;
  return { ok: availableMs >= FULL_ANSWER_TTFT_MS + Number(maxTokens) / speed, elapsedMs, availableMs };
}
