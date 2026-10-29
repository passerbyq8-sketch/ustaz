// lib/openrouter-writer.js -- SIDE SESSION "GEMMA 4 IN THE MOUJAZ LAYER" (2026-10-29), STEP 2: THE BW2 WRITER SEAT ONLY.
//
// A provider switch for the one writer call of lib/before-writing-v2.js (and its continuations), read from the
// environment at call time:
//
//   MOUJAZ_PROVIDER unset | unknown   the Anthropic writer (callProviderStream), unchanged
//   MOUJAZ_PROVIDER=anthropic         the Anthropic writer; MOUJAZ_MODEL replaces the model when set
//   MOUJAZ_PROVIDER=openrouter        callOpenRouterStream below, MOUJAZ_MODEL routed to OPENROUTER_PROVIDER only
//
// Only a brief turn is switched (the test before-writing-v2.js already uses: mode is neither 'deep' nor 'scholar').
// openrouter with a missing key, model or provider, or with any non-text block in the conversation, falls back to the
// unchanged Anthropic writer for that call (fallback 'config' / 'nontext'). A runtime failure of OpenRouter (HTTP, stream
// error, empty answer) is NOT replaced: it throws, so the existing writer-failed path runs and is counted.
//
// PRIVACY. One `[bw2-writer]` console line per writer call: provider, model, upstream, fallback, tokens, times, finish.
// Never the question, the answer or a key. Nothing is written to the answer record or to any store (shared with production).

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const THOUGHT_OPEN = '<|channel>';
const THOUGHT_CLOSE = '<channel|>';

function textOfBlocks(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text').map((b) => String(b.text || '')).join('\n\n');
}

function hasNonTextBlock(messages) {
  for (const m of Array.isArray(messages) ? messages : []) {
    if (m && Array.isArray(m.content) && m.content.some((b) => !b || b.type !== 'text')) return true;
  }
  return false;
}

/** The Anthropic body, translated to the Chat Completions body. Nothing is added that the Anthropic body does not carry. */
export function openRouterBody(body, { model, provider }) {
  const system = textOfBlocks(body && body.system);
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...(Array.isArray(body && body.messages) ? body.messages : []).map((m) => ({ role: m.role, content: textOfBlocks(m.content) })),
  ];
  return {
    model,
    messages,
    max_tokens: body && body.max_tokens,
    reasoning: { effort: 'none' },
    stream: true,
    provider: { order: [provider], allow_fallbacks: false },
  };
}

function stopReasonOf(finish) {
  if (finish === 'stop') return 'end_turn';
  if (finish === 'length') return 'max_tokens';
  return finish;
}

function scrub(text, key) {
  const s = String(text == null ? '' : text);
  return key ? s.split(key).join('[redacted]') : s;
}

/**
 * The same call signature and resolved shape as callProviderStream (lib/free-brain/loop.js), against OpenRouter.
 * `providerUrl` and `headers` (Anthropic's) are not used. Resolves to
 * { content:[{type:'text', text}], stop_reason, usage:{input_tokens, output_tokens}, model, upstream, thoughtMarkerDropped }.
 */
export async function callOpenRouterStream({ signal, body, onText }, { apiKey, model, provider, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const response = await doFetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(openRouterBody(body, { model, provider })),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = '';
    try { message = String((JSON.parse(raw).error || {}).message || ''); } catch { message = raw; }
    const error = new Error(scrub(`openrouter ${response.status}: ${message.slice(0, 300)}`, apiKey));
    error.status = response.status;
    throw error;
  }
  if (!response.body) throw new Error('openrouter stream had no body');

  let text = '';
  let finish = null;
  let usage = null;
  let seenModel = '';
  let upstream = null;
  // The Gemma thought marker: undecided until the first content shows whether it opens with it.
  let pending = '';
  let decided = false;
  let thoughtMarkerDropped = false;
  const emit = (t) => {
    if (!t) return;
    text += t;
    if (onText) onText(t);
  };
  const take = (piece) => {
    if (decided) { emit(piece); return; }
    pending += piece;
    if (pending.startsWith(THOUGHT_OPEN)) {
      const close = pending.indexOf(THOUGHT_CLOSE);
      if (close === -1) return;
      thoughtMarkerDropped = true;
      decided = true;
      const rest = pending.slice(close + THOUGHT_CLOSE.length);
      pending = '';
      emit(rest);
    } else if (!THOUGHT_OPEN.startsWith(pending)) {
      decided = true;
      const all = pending;
      pending = '';
      emit(all);
    }
  };
  const apply = (event) => {
    if (!event || typeof event !== 'object') return;
    if (event.error) {
      const error = new Error(scrub(`openrouter stream error: ${String(event.error.message || event.error.code || 'unknown').slice(0, 300)}`, apiKey));
      error.status = event.error.code;
      throw error;
    }
    if (typeof event.model === 'string' && event.model) seenModel = event.model;
    if (typeof event.provider === 'string' && event.provider) upstream = event.provider;
    if (event.usage && typeof event.usage === 'object') usage = event.usage;
    const choice = Array.isArray(event.choices) ? event.choices[0] : null;
    if (!choice) return;
    if (choice.finish_reason === 'error') throw new Error('openrouter stream error: finish_reason error');
    if (choice.finish_reason != null) finish = choice.finish_reason;
    const content = choice.delta && choice.delta.content;
    if (typeof content === 'string' && content) take(content);
  };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;
  while (!done) {
    // eslint-disable-next-line no-await-in-loop
    const chunk = await reader.read();
    if (chunk.done) { buffer += decoder.decode(); done = true; } else buffer += decoder.decode(chunk.value, { stream: true });
    let cut = buffer.indexOf('\n');
    while (cut !== -1 || (done && buffer)) {
      const line = (cut === -1 ? buffer : buffer.slice(0, cut)).replace(/\r$/, '');
      buffer = cut === -1 ? '' : buffer.slice(cut + 1);
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { done = true; buffer = ''; reader.cancel().catch(() => {}); break; }
        if (payload) {
          let event;
          try { event = JSON.parse(payload); } catch { event = null; }
          apply(event);
        }
      } // a ':' line is a comment (": OPENROUTER PROCESSING"); a blank line ends a frame
      cut = buffer.indexOf('\n');
    }
  }
  if (!decided && pending && !pending.startsWith(THOUGHT_OPEN)) emit(pending);
  if (!text) throw new Error('openrouter empty answer');
  return {
    content: [{ type: 'text', text }],
    stop_reason: stopReasonOf(finish),
    usage: {
      input_tokens: Number(usage && usage.prompt_tokens) || 0,
      output_tokens: Number(usage && usage.completion_tokens) || 0,
    },
    model: seenModel || model,
    upstream,
    thoughtMarkerDropped,
  };
}

/**
 * The writer the BW2 seat calls for this turn: callProviderStream's signature, with the env read at each call.
 * `anthropicWriter` is callProviderStream; `now` and `log` are seams for the self-test.
 */
export function bw2Writer({ mode = '', env = process.env, anthropicWriter, now = Date.now, log = console.log, fetchImpl } = {}) {
  return async function writer(args) {
    const started = now();
    const brief = mode !== 'deep' && mode !== 'scholar';
    const choice = brief ? String(env.MOUJAZ_PROVIDER || '').trim().toLowerCase() : '';
    const moujazModel = String(env.MOUJAZ_MODEL || '').trim();
    let provider = 'anthropic';
    let fallback = null;
    if (choice === 'openrouter') {
      if (!String(env.OPENROUTER_API_KEY || '').trim() || !moujazModel || !String(env.OPENROUTER_PROVIDER || '').trim()) fallback = 'config';
      else if (hasNonTextBlock(args && args.body && args.body.messages)) fallback = 'nontext';
      else provider = 'openrouter';
    }
    const body = choice === 'anthropic' && moujazModel ? { ...args.body, model: moujazModel } : args.body;
    let firstTokenMs = null;
    const onText = (delta) => {
      if (firstTokenMs === null && delta) firstTokenMs = Math.max(0, now() - started);
      if (args.onText) args.onText(delta);
    };
    const line = { provider, model: provider === 'openrouter' ? moujazModel : String(body && body.model || ''), upstream: null, fallback,
      inTokens: 0, outTokens: 0, firstTokenMs: null, totalMs: 0, finish: 'error', thoughtMarkerDropped: provider === 'openrouter' ? false : null };
    try {
      const payload = provider === 'openrouter'
        ? await callOpenRouterStream({ ...args, body, onText }, {
          apiKey: String(env.OPENROUTER_API_KEY).trim(), model: moujazModel, provider: String(env.OPENROUTER_PROVIDER).trim(), fetchImpl,
        })
        : await anthropicWriter({ ...args, body, onText });
      const usage = (payload && payload.usage) || {};
      line.inTokens = Number(usage.input_tokens) || 0;
      line.outTokens = Number(usage.output_tokens) || 0;
      line.finish = payload && payload.stop_reason != null ? payload.stop_reason : null;
      if (provider === 'openrouter') {
        line.model = payload.model || moujazModel;
        line.upstream = payload.upstream || null;
        line.thoughtMarkerDropped = payload.thoughtMarkerDropped === true;
      }
      return payload;
    } finally {
      line.firstTokenMs = firstTokenMs;
      line.totalMs = Math.max(0, now() - started);
      try { log('[bw2-writer]', line); } catch { /* a log line never changes the answer */ }
    }
  };
}
