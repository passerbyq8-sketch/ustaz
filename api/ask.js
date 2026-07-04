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

import { checkAskLimit } from '../lib/ratelimit.js';
import { ASK_LIMIT_MESSAGE } from '../lib/limit-message.js';

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

// Depth-based instruction. Returns '' for brief (no injection), or the Arabic
// instruction text for 'deep' (مفصّل) / 'scholar' (طالب العلم). Approved verbatim.
function buildDepthInstruction(depth) {
  if (depth === 'deep') {
    return 'وسِّعِ الشرحَ في هذا الجواب: فصّلْ أكثرَ، واذكرْ أدلّةً إضافيّةً من الكتاب والسنّة حيث تناسب، مع بقاءِ الجوابِ على القول المعتمَد دون سردِ خلاف.';
  }
  if (depth === 'scholar') {
    return [
      'هذا سؤالٌ في وضع طالب العلم. لا تُعطِ حكمًا مباشرًا ولا تُرجّح من عندك؛ مهمّتُك أن تعرِض ما قاله العلماءُ في المسألة مادّةَ دراسةٍ للطالب، لا فتوى.',
      'اعرِض في هذه الإجابة حتّى أربعةَ أقوالٍ متمايزةٍ في المسألة — بتمايز المضمون لا بتعدّد الأسماء — لكلّ قولٍ دليلُه من الكتاب والسنّة، ومن قال به من العلماء ومذاهبهم. واحرِصْ، إن سمحت المصادرُ، أن تُمثِّل الأقوالَ بشواهدَ من العلماء المتقدّمين والمعاصرين معًا. وانقُلْ ما ورد في المصادر من ترجيحٍ وقولِ الجمهور نقلًا منسوبًا لقائله، دون أن تُرجّح أنت.',
      'فإن كانت أقوالُ المسألة أكثرَ من أربعة، فاذكُرْ ذلك واسأل الطالبَ صراحةً: هل تريد أن أزيدك من الأقوال؟ — فإن طلب، اسرِدِ الباقيَ.',
      'وإن لم تكن المسألةُ خلافيّةً أصلًا (فيها إجماعٌ أو حقيقةٌ مستقرّة)، فبيِّن ذلك واعرِضِ القولَ المستقرَّ بدليله، ولا تصطنع خلافًا.',
      'اعتمِدْ حصرًا على ما استرجعتَه من المصادر المعتمدة؛ وما لم تجده فيها، قُلْ صراحةً "لم أقف عليه في المراجع المتاحة" ولا تملأ الفراغَ من معرفتك.',
    ].join(' ');
  }
  return '';
}

// Append the depth instruction as a SEPARATE text block WITHOUT cache_control,
// so it varies per-request and never busts the cached static system prefix.
// Mirrors the retrieval principle (per-request content stays out of the cached prefix).
function appendDepthBlock(systemBlocks, instruction) {
  if (!instruction) return systemBlocks;
  if (Array.isArray(systemBlocks)) {
    return [...systemBlocks, { type: 'text', text: instruction }];
  }
  // string or other: build a fresh array — cached prefix (if string) + uncached instruction
  if (typeof systemBlocks === 'string') {
    return [
      { type: 'text', text: systemBlocks, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: instruction },
    ];
  }
  return systemBlocks;
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

  // Per-IP ask throttle (fail-open). Runs before any work — body parse, retrieval,
  // or upstream call — so a throttled request costs nothing. On limit hit we emit the
  // gentle Arabic message via the existing SSE synthesizer (HTTP 200, no client change).
  const ip = req.headers['x-real-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || 'unknown';
  const { ok } = await checkAskLimit(ip);
  if (!ok) { return sendSynthesizedText(res, ASK_LIMIT_MESSAGE); }

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
  const maxTokens = body.max_tokens || 4096;
  // depth: undefined/'normal' = brief (default), 'deep' = مفصّل, 'scholar' = طالب العلم
  const round2Effort = (body.depth === 'deep' || body.depth === 'scholar') ? 'high' : 'medium';
  const depthInstruction = buildDepthInstruction(body.depth);
  const system = appendDepthBlock(wrapSystem(body.system), depthInstruction);

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
        output_config: { effort: 'low' },
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

    // (a) No search needed — synthesize text frames for the client.
    if (round1.stop_reason !== 'tool_use') {
      const text = (round1.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      // HARD GUARD: branch (a) means the model answered WITHOUT calling the search tool, so any
      // <source> card it emitted is fabricated — not backed by real retrieval. Strip every
      // <source>…</source> pair, plus any dangling '<source…' with no close (defensive vs a
      // truncated stream), so a no-search answer reaches the client with ZERO source cards.
      // (Only branch (b) below, where retrieve() actually ran, may legitimately carry <source>.)
      const clean = text
        .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
        .replace(/<source\b[^>]*>?[\s\S]*$/i, '');
      return sendSynthesizedText(res, clean);
    }

    // (b) tool_use — run retrieval for the first 2 tool_use blocks CONCURRENTLY, then round 2.
    const toolUses = (round1.content || []).filter((b) => b.type === 'tool_use').slice(0, 2);

    // Lazy import — only reached in the tool_use branch, so a greeting never loads
    // retrieve/linkedom. Imported ONCE here, shared by the concurrent branches below.
    const { retrieve } = await import('../lib/retrieve.js');

    // Run every angle's retrieve() concurrently: ~A+B collapses to ~max(A,B).
    // Promise.all preserves input order, so toolResults stays aligned 1:1 with
    // toolUses (each tool_result carries its own block.id). The try/catch is INSIDE
    // each branch so one angle throwing degrades to the "no source" text without
    // rejecting the batch or 500-ing — the other angle still returns real sources.
    const toolResults = await Promise.all(
      toolUses.map(async (block) => {
        let retrievedText;
        try {
          const q = (block.input && block.input.query) || '';
          const out = await retrieve(q);
          retrievedText = out.text;
        } catch (e) {
          // Never 500 on a retrieval error — degrade gracefully so the model won't fabricate.
          console.warn('[ask] retrieval threw:', e.message);
          retrievedText = 'لم يُعثر على مصدرٍ موثوقٍ في المواقع المعتمدة للإجابة عن هذا السؤال.';
        }
        return { type: 'tool_result', tool_use_id: block.id, content: retrievedText };
      })
    );

    const round2Messages = [
      ...body.messages,
      { role: 'assistant', content: round1.content },
      { role: 'user', content: toolResults },
    ];

    // ── ROUND 2: streamed, WITHOUT tools (guarantees a streamable text answer) ──
    const r2 = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        output_config: { effort: round2Effort },
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
