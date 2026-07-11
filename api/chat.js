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

  // Throttle. This relay was bare -- eight unthrottled POSTs to production proved it.
  // Runs before ANY work, so a throttled request costs nothing. callAI already handles
  // a 429 (getFriendlyError('rateLimit')), so no client change is needed.
  const ip = req.headers['x-real-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || 'unknown';
  const { ok } = await checkChatLimit(ip);
  if (!ok) {
    return res.status(429).json({ error: 'rate limit' });
  }

  // Hard INPUT cap. Also before any upstream call. Does not depend on Redis, so it
  // holds even when the throttle above fails open.
  const bodyBytes = Buffer.byteLength(
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    'utf8'
  );
  // Warn LONG before we break. The client ships the whole ~111 KB system prompt on every
  // turn, so this cap sits close to real traffic by nature. If the prompt ever grows past
  // 80% of the cap, say so -- otherwise the next person to add a worship card discovers it
  // as a silent 413 on every religious voice turn, which is exactly what happened once.
  if (bodyBytes > MAX_CHAT_BODY_BYTES * 0.8) {
    console.warn('[chat] body ' + bodyBytes + 'B is at ' + Math.round((bodyBytes / MAX_CHAT_BODY_BYTES) * 100) +
      '% of MAX_CHAT_BODY_BYTES. RAISE THE CAP in lib/ratelimit.js BEFORE it starts rejecting real turns.');
  }
  if (bodyBytes > MAX_CHAT_BODY_BYTES) {
    return res.status(413).json({ error: 'body too large' });
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

    // (A) Model is decided here, not by the client. The hardcoded fallback is SONNET,
    //     not Opus: if MODEL_STANDARD ever goes missing from the Vercel env, this relay
    //     must degrade to the tier the voice route is SUPPOSED to run (sonnet-5), not
    //     silently UPGRADE to the most expensive model in the account. A fallback that
    //     costs 5x more than the intended path is not a fallback; it is a trap.
    parsed.model = process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5';
    console.log('[tier] voice', { model: parsed.model });

    // (A2) Output cap decided HERE, not by the client. The app asks for 4096; an
    //      attacker asks for 64000 and multiplies the bill by 16 on one request.
    parsed.max_tokens = Math.min(Number(parsed.max_tokens) || MAX_CHAT_TOKENS, MAX_CHAT_TOKENS);
    // NOTE: no effort cap is set on this voice relay; it runs at the API default
    //     (effort high). Graduated effort lives in api/ask.js (the text path), not here.
    //     A 'medium' cap to cut call latency is a candidate change, but it alters
    //     behavior and needs a live voice-quality check, so it is intentionally unset here.

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

    outgoingBody = parsed; // messages / stream as sent. model and max_tokens are OURS.
  } catch (e) {
    // We do NOT pass the raw client body through any more. The old "graceful
    // passthrough" was a bypass of the very thing it guarded: on any transform error
    // the client's OWN model and max_tokens went upstream untouched. A relay that
    // cannot enforce its own policy must not relay. Fail, loudly, for zero cost.
    console.warn('[chat] body transform failed:', e && e.message ? e.message : e);
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
