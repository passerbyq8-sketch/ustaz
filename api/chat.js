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

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
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
