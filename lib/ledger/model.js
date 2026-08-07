// lib/ledger/model.js
// THE ONLY PLACE THIS ENGINE TALKS TO A MODEL, AND THE ONLY PLACE IT COUNTS THE COST.
//
// It exists so three properties hold everywhere rather than at each call site's discretion:
//   * every call is charged to the request's Budget BEFORE it is made, so an eighth call is
//     impossible rather than merely unlikely;
//   * every call has a timeout strictly inside the request's remaining time;
//   * a malformed or timed-out reply is a VALUE, not an exception. A verification step that
//     throws takes the whole request with it, and the correct behaviour when a verifier fails
//     is to drop what it could not verify — never to lose the request.
//
// THE MODEL TIER IS READ, NOT CHOSEN. It uses the same MODEL_STANDARD / MODEL_PREMIUM the
// shipped route uses, and never touches a subscription ceiling.
//
// ONE CALL IS PINNED, AND IT IS NOT THE ANSWER (2026-08-07). This paragraph used to say the
// engine «never upgrades a tier, never unlocks a premium model», full stop. That is still true of
// every call whose output the reader receives — extraction, verification, drafting, sentence
// verification all run on the tier the caller passed. It is NOT true of the query-IR call:
// lib/ledger/planner.js pins that one to `premium`, because its output is a description of the
// question consumed by code, no word of it reaches the reader, and running it on the weakest
// model was what made the engine refuse without searching. The rule is stated with its exception
// rather than left as a sentence the code contradicts.
//
// NO AUTOMATIC RETRY ON A VERDICT. A verifier that says FAIL is not asked again in the hope of
// a PASS; that is not resilience, it is sampling until the answer is convenient. Transport
// retries are equally absent for the same reason: a second identical call is a second chance
// for a different verdict.

import {
  MODEL_TIMEOUT_MS, MAX_MODEL_OUTPUT_TOKENS,
} from './budgets.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/** The tier this engine uses. Never premium unless the caller was already entitled to it. */
export function modelFor(tier) {
  if (tier === 'premium') {
    return process.env.MODEL_PREMIUM || process.env.MODEL || 'claude-opus-4-8';
  }
  return process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5';
}

/**
 * Rough token estimate for budgeting only. Deliberately pessimistic on Arabic — one token per
 * ~2.5 characters — because under-estimating the input budget is what lets a request creep
 * past a ceiling nobody sees.
 */
export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 2.5);
}

/**
 * ONE model call.
 *
 * @returns {{ok:true, text:string, usage:object} | {ok:false, reason:string}}
 *   reason ∈ 'budget' | 'timeout' | 'http-NNN' | 'transport' | 'no-key'
 */
export async function callModel({ system, user, budget, purpose, tier = 'standard', maxTokens, fetchImpl }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no-key' };

  const inputEstimate = estimateTokens(system) + estimateTokens(user);
  if (!budget.canAffordModelCall(inputEstimate)) return { ok: false, reason: 'budget' };

  const remaining = budget.remainingMs();
  if (remaining <= 0) return { ok: false, reason: 'budget' };
  const timeoutMs = Math.min(MODEL_TIMEOUT_MS, remaining);

  budget.spend('modelCalls', 1, purpose);
  budget.spend('inputTokens', inputEstimate, purpose);

  const doFetch = fetchImpl || globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await doFetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: modelFor(tier),
        max_tokens: Math.min(maxTokens || MAX_MODEL_OUTPUT_TOKENS, MAX_MODEL_OUTPUT_TOKENS),
        system,
        messages: [{ role: 'user', content: user }],
        stream: false,
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
    return { ok: false, reason: aborted ? 'timeout' : 'transport' };
  }
  clearTimeout(timer);

  if (!res.ok) return { ok: false, reason: 'http-' + res.status };

  let payload;
  try { payload = await res.json(); } catch { return { ok: false, reason: 'transport' }; }
  const text = (payload.content || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('');
  const usage = payload.usage || {};
  if (Number.isFinite(usage.output_tokens)) budget.spend('outputTokens', usage.output_tokens, purpose);
  return { ok: true, text, usage };
}

/**
 * Parse a JSON object out of a model reply.
 *
 * Tolerant of a fenced block and of prose around the JSON, and INTOLERANT of everything else:
 * no repair, no "fix the trailing comma", no second attempt. A reply that is not parseable is a
 * reply that did not answer, and the caller fails the batch closed.
 */
export function parseJsonReply(text) {
  const s = String(text == null ? '' : text).trim();
  if (!s) return null;
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const v = JSON.parse(body.slice(start, end + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}
