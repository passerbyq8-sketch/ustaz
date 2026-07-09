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
// This file is DORMANT until the client is wired to POST here (Step 2). Deploying it
// alone changes nothing live.

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

    outgoingBody = parsed; // messages / max_tokens / stream left exactly as the client sent them
  } catch (e) {
    outgoingBody = req.body; // graceful passthrough — never crash the relay on a body surprise
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
