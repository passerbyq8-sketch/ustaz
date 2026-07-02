// api/ask.js
// Live-fetch RAG as a server-side, two-round tool loop. Same runtime style as
// api/chat.js (Node req/res, ESM export default). The client sends only
// { system, messages, max_tokens? }; the search tool is server-injected.
//
// ROUND 1 (non-streamed, WITH tools): let the model decide whether to search.
//   - no tool_use  -> synthesize SSE text frames the client parser accepts.
//   - tool_use     -> retrieve() each query, then...
// ROUND 2 (streamed, WITHOUT tools): stream the sourced answer, bytes relayed
//   verbatim exactly like chat.js. Omitting tools caps retrieval at one round.

// NOTE: retrieve() (and its jsdom/readability deps) is imported LAZILY inside the
// tool_use branch, not at module top — so a greeting (no search) never loads jsdom,
// and any jsdom load failure is contained to retrieval instead of crashing the whole
// function at invocation.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Server-declared tool. The client never sends this.
const tools = [
  {
    name: 'search_islamic_sources',
    description:
      'ابحث في المواقع الشرعية المعتمدة (islamweb.net، binbaz.org.sa، alukah.net، islamqa.info) عن الأدلّة والفتاوى والتخريج لإجابة سؤالٍ فقهيٍّ أو حديثيٍّ أو تفسيريٍّ يحتاج نسبةً إلى مصدر. استدعِ هذه الأداة فقط حين يحتاج السؤالُ دليلًا منسوبًا؛ لا تستدعِها للتحيّة أو الأسئلة البسيطة أو أسئلة الأطفال العامّة.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'استعلامُ بحثٍ عربيٌّ مركّزٌ يلخّص المسألة الفقهيّة.',
        },
      },
      required: ['query'],
    },
  },
];

// Wrap the client's `system` string in a single cached text block — byte-identical
// to api/chat.js so round 2 (no tools) shares the cached system prefix with /api/chat.
function wrapSystem(system) {
  if (typeof system === 'string' && system.trim()) {
    return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  }
  if (Array.isArray(system)) {
    for (let i = system.length - 1; i >= 0; i--) {
      if (system[i] && system[i].type === 'text') {
        if (!system[i].cache_control) system[i].cache_control = { type: 'ephemeral' };
        break;
      }
    }
    return system;
  }
  return system;
}

// Emit the client-parser-accepted SSE shape: `data: {json}\n\n`, only
// content_block_delta/text_delta events (see index.html handleEvent).
function sendSynthesizedText(res, text) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const frame = {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: text || '' },
  };
  res.write(`data: ${JSON.stringify(frame)}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
  res.end();
}

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

  // TEMP DIAGNOSTIC (remove in 5B): surface the real jsdom/retrieve load error.
  // POST {"__diag":true} to probe which import fails in the Vercel runtime.
  if (req.body && (req.body.__diag === true || (typeof req.body === 'string' && req.body.includes('"__diag"')))) {
    const out = {};
    try {
      await import('jsdom');
      out.jsdom = 'ok';
    } catch (e) {
      out.jsdom = `FAIL: ${e.message}`;
    }
    try {
      await import('@mozilla/readability');
      out.readability = 'ok';
    } catch (e) {
      out.readability = `FAIL: ${e.message}`;
    }
    try {
      const m = await import('../lib/retrieve.js');
      out.retrieve = typeof m.retrieve === 'function' ? 'ok' : 'loaded-but-no-export';
    } catch (e) {
      out.retrieve = `FAIL: ${e.message}`;
    }
    return res.status(200).json(out);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY غير مضبوط' });
  }

  // Parse + validate body.
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (typeof body.system !== 'string' && !Array.isArray(body.system)) {
    return res.status(400).json({ error: 'system string required' });
  }

  const model = process.env.MODEL || 'claude-opus-4-8';
  const maxTokens = body.max_tokens || 32768;
  const system = wrapSystem(body.system);

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  try {
    // ── ROUND 1: non-streamed, WITH tools ──────────────────────────────────
    const r1 = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: body.messages,
        tools,
        stream: false,
      }),
    });

    if (!r1.ok) {
      const errText = await r1.text().catch(() => '');
      res.status(r1.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(errText || JSON.stringify({ error: { message: `upstream ${r1.status}` } }));
    }

    const round1 = await r1.json();
    console.log('[ask] round-1 stop_reason:', round1.stop_reason);

    // (a) No search needed — synthesize text frames for the client.
    if (round1.stop_reason !== 'tool_use') {
      const text = (round1.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return sendSynthesizedText(res, text);
    }

    // (b) tool_use — run retrieval for the first 2 tool_use blocks, then round 2.
    const toolUses = (round1.content || []).filter((b) => b.type === 'tool_use').slice(0, 2);
    console.log('[ask] tool queries:', toolUses.map((t) => t.input && t.input.query));

    const toolResults = [];
    for (const block of toolUses) {
      let retrievedText;
      try {
        const q = (block.input && block.input.query) || '';
        const { retrieve } = await import('../lib/retrieve.js');
        const out = await retrieve(q);
        retrievedText = out.text;
      } catch (e) {
        // Never 500 on a retrieval error — degrade gracefully so the model won't fabricate.
        console.warn('[ask] retrieval threw:', e.message);
        retrievedText = 'لم يُعثر على مصدرٍ موثوقٍ في المواقع المعتمدة للإجابة عن هذا السؤال.';
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: retrievedText });
    }

    const round2Messages = [
      ...body.messages,
      { role: 'assistant', content: round1.content },
      { role: 'user', content: toolResults },
    ];

    console.log('[ask] round-2 start');

    // ── ROUND 2: streamed, WITHOUT tools (guarantees a streamable text answer) ──
    const r2 = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: round2Messages,
        stream: true,
      }),
    });

    if (!r2.ok) {
      const errText = await r2.text().catch(() => '');
      res.status(r2.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(errText || JSON.stringify({ error: { message: `upstream ${r2.status}` } }));
    }

    // Thin streaming relay — identical byte-pipe to chat.js.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const reader = r2.body.getReader();
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
