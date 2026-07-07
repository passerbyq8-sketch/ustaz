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

  // Server-authoritative transforms — the proxy, not the client, decides the model and
  // adds prompt caching. Degrades gracefully to the original body if anything goes wrong,
  // so a parse/shape surprise can never crash the relay.
  let outgoingBody = req.body;
  try {
    // req.body is an object on Vercel Node functions, but tolerate a raw string too.
    const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : { ...req.body };

    // (A) Model is decided here, not by the client. Default stays Opus; the cheaper dev
    //     model is chosen ONLY via the Vercel env var MODEL (set in the dashboard).
    parsed.model = process.env.MODEL_STANDARD || process.env.MODEL || 'claude-opus-4-8';
    console.log('[tier] voice', { model: parsed.model });
    // (A2) Cut latency on call turns + the greeting by capping overall effort. `effort`
    //     is GA (no beta header) and lives inside output_config; default is 'high' (slow).
    //     'medium' keeps replies coherent while spending fewer tokens than the default.

    // (B) Ephemeral prompt caching on the system prompt (the bulk of input cost). The client
    //     sends `system` as a plain string; wrap it in a single cached text block. If it is
    //     already an array (future-proof), just ensure the LAST text block carries
    //     cache_control without double-adding. Prompt caching is GA on anthropic-version
    //     2023-06-01 — no beta header required.
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

    outgoingBody = parsed; // messages / max_tokens / stream are left exactly as the client sent them
  } catch (e) {
    outgoingBody = req.body; // graceful passthrough — never crash the proxy on a body surprise
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

    // Upstream error (429 / credit exhausted / 5xx): forward body + status as-is so the
    // client can show a real reason. This separates a credit/rate-limit error from a
    // network drop (no more misleading "weak connection").
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
    res.setHeader('X-Accel-Buffering', 'no'); // disable any proxy buffering
    res.flushHeaders?.();
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value); // Uint8Array — res.write accepts it
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
