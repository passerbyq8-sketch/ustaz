// api/chat-fast.js
// FAST GENERAL CHANNEL relay — CALL mode only.
// Byte-faithful sibling of api/chat.js with ONE behavioural change: it resolves the
// FAST model (Haiku) instead of the STANDARD model (Sonnet). Everything else — CORS,
// ephemeral system-prompt caching, upstream-error passthrough, and the thin SSE relay —
// is intentionally identical to api/chat.js so the client parser needs ZERO changes.
//
// SAFETY NOTE: this is a PURE RELAY. It carries NO prompt and NO worship text; it
// faithfully forwards whatever `system` / `messages` the client sends. The guarantee
// that religious / worship / Quran questions never reach this thin path lives ENTIRELY
// in the client-side classifier (index.html callAI), NOT here. Do NOT add routing here.
//
// SIBLING CONTRACT: if you ever change the caching or SSE-relay logic in api/chat.js,
// mirror it here (and vice-versa) or the two relays will drift.
//
// This relay is LIVE: index.html (callAI, FAST_CHANNEL_ENABLED=true) POSTs GEN-
// classified CALL turns here. It still carries NO prompt of its own (see SAFETY NOTE);
// the client sends the GEN system prompt + messages, and this relay swaps in Haiku.

/* 15 */
import { checkChatLimit, MAX_CHAT_BODY_BYTES, MAX_CHAT_TOKENS } from '../lib/ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Throttle. SIBLING CONTRACT: mirrors api/chat.js exactly. This relay was bare too --
  // and it is hit on EVERY voice turn, because the classifier lives here.
  // A 429 makes the classifier return DEEN, which falls back to the FULL system prompt.
  // It fails TOWARD the guarded route. That is the correct direction.
  const ip = req.headers['x-real-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || 'unknown';
  const { ok } = await checkChatLimit(ip);
  if (!ok) {
    return res.status(429).json({ error: 'rate limit' });
  }

  // Hard INPUT cap. Does not depend on Redis, so it holds when the throttle fails open.
  const bodyBytes = Buffer.byteLength(
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    'utf8'
  );
  // Same warning as api/chat.js. SIBLING CONTRACT.
  if (bodyBytes > MAX_CHAT_BODY_BYTES * 0.8) {
    console.warn('[chat-fast] body ' + bodyBytes + 'B is at ' + Math.round((bodyBytes / MAX_CHAT_BODY_BYTES) * 100) +
      '% of MAX_CHAT_BODY_BYTES. RAISE THE CAP in lib/ratelimit.js BEFORE it starts rejecting real turns.');
  }
  if (bodyBytes > MAX_CHAT_BODY_BYTES) {
    return res.status(413).json({ error: 'body too large' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY غير مضبوط' });
  }

  // Server-authoritative model override. Unlike api/chat.js (which resolves the STANDARD
  // tier), this relay ALWAYS resolves the FAST tier. The hardcoded fallback is the
  // documented Haiku string, so the fast path stays fast even if MODEL_FAST is unset —
  // it never silently falls back to the slower Sonnet/Opus model.
  let outgoingBody = req.body;
  try {
    const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : { ...req.body };

    parsed.model = process.env.MODEL_FAST || 'claude-haiku-4-5-20251001';
    console.log('[tier] voice-fast', { model: parsed.model });

    // Output cap decided HERE, not by the client. The classifier asks for 8 and the GEN
    // answer for 4096 -- both pass through untouched. An attacker asking for 64000 does not.
    parsed.max_tokens = Math.min(Number(parsed.max_tokens) || MAX_CHAT_TOKENS, MAX_CHAT_TOKENS);

    // Ephemeral caching on the system prompt, identical to api/chat.js. For the thin
    // call-mode prompt this is effectively a no-op (below the cache minimum) but it is
    // harmless, degrades gracefully, and keeps this relay byte-faithful to its sibling.
    if (typeof parsed.system === 'string' && parsed.system.trim()) {
      parsed.system = [{ type: 'text', text: parsed.system, cache_control: { type: 'ephemeral' } }];
    } else if (Array.isArray(parsed.system)) {
      for (let i = parsed.system.length - 1; i >= 0; i--) {
        if (parsed.system[i] && parsed.system[i].type === 'text') {
          if (!parsed.system[i].cache_control) parsed.system[i].cache_control = { type: 'ephemeral' };
          break;
        }
      }
    }

    outgoingBody = parsed; // messages / stream as sent. model and max_tokens are OURS.
  } catch (e) {
    // No raw passthrough. Same reason as api/chat.js: the old fallback handed the client
    // back control of the model and the token cap on any transform error. SIBLING CONTRACT.
    console.warn('[chat-fast] body transform failed:', e && e.message ? e.message : e);
    return res.status(400).json({ error: 'bad body' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(outgoingBody),
    });

    // Forward upstream errors (400 bad-model / 401 quota / 429 / 5xx) verbatim so a wrong
    // MODEL_FAST string or a credit problem fails LOUDLY in logs, not as a silent hang.
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(errText || JSON.stringify({ error: { message: `upstream ${upstream.status}` } }));
    }

    // Thin streaming relay: forward the SSE bytes unmodified; the client parses the events.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    res.end();
  }
}
