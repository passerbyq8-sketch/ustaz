/* 15 */
import { checkChatLimit, MAX_CHAT_BODY_BYTES, MAX_CHAT_TOKENS } from '../lib/ratelimit.js';
import { guardDayCap, dayCapMessage, sendCapMessageSse } from '../lib/daycap.js';
import { guardAIConsent, AI_CONSENT_ALLOW_HEADERS } from '../lib/ai-consent.js';
// THE SAME POLICY CORE THE TEXT PATH READS, not a second copy of it. A hazard list that lives in
// two files is two lists, and the one that goes stale is always the one nobody is looking at.
import { classifyTopic, graveHazard, WARM_TEMPLATES, POLICY_VERSION } from '../lib/policy/core.js';
import { access, resolveAudience, repair as ageRepair, warmTemplateFor } from '../lib/policy/age.js';

// The reader's own words for THIS turn. Same shape api/ask.js reads: the content may be a plain
// string or the block array the voice client sends.
function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content.filter((c) => c && c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text).join(' ');
    }
  }
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-murabbi-device, x-murabbi-founder, ' + AI_CONSENT_ALLOW_HEADERS);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Apple 5.1.1(i): the voice route carries the reader's name, age, gender and every previous
  // turn to Anthropic. It runs BEFORE the throttle, so an un-consented request touches neither
  // Redis nor the vendor.
  if (!guardAIConsent(req, res)) return;

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
  let voiceBand;
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
    // (A3) EFFORT IS PERMANENTLY OFF. `output_config` (and its `effort` field) is NOT a
    //      parameter this endpoint's upstream accepts: /v1/messages rejects the whole
    //      request with a 400 the moment it appears. The old ENV gate (CALL_EFFORT) meant
    //      one env var set in Vercel turned EVERY call turn into a 400 -- which the client
    //      then rendered as "لم أفهم سؤالك", blaming the child for our own bad request.
    //      So we do not read CALL_EFFORT, and we STRIP any output_config the client sent:
    //      the relay must never forward a field that cannot be accepted. Do not
    //      reintroduce this without first proving the upstream accepts it.
    if (parsed.output_config !== undefined) {
      console.warn('[chat] stripped unsupported output_config from the outgoing body');
      delete parsed.output_config;
    }
    // Thinking stays ENV-gated: `thinking` IS an accepted parameter. Unset = API default.
    if (String(process.env.CALL_THINKING || '').trim() === 'disabled') {
      parsed.thinking = { type: 'disabled' };
    }
    console.log('[effort] voice', {
      effort: 'unset(never sent)',
      thinking: (parsed.thinking && parsed.thinking.type) || 'default(adaptive)'
    });

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

    // (C) THE AGE BAND IS OURS TO READ AND NOT ANTHROPIC'S TO RECEIVE. `band` is a field this app
    //     adds so the policy below has something to govern by; /v1/messages rejects the whole
    //     request on an unknown top-level field, exactly as `output_config` above does.
    voiceBand = typeof parsed.band === 'string' ? parsed.band : undefined;
    if (parsed.band !== undefined) delete parsed.band;

    outgoingBody = parsed; // messages / stream as sent. model and max_tokens are OURS.
  } catch (e) {
    // We do NOT pass the raw client body through any more. The old "graceful
    // passthrough" was a bypass of the very thing it guarded: on any transform error
    // the client's OWN model and max_tokens went upstream untouched. A relay that
    // cannot enforce its own policy must not relay. Fail, loudly, for zero cost.
    console.warn('[chat] body transform failed:', e && e.message ? e.message : e);
    return res.status(400).json({ error: 'bad body' });
  }

  // ── TRIAGE, ON THE VOICE TURN, BEFORE ANY MODEL CALL ──────────────────────
  //
  // THE HOLE THIS CLOSES, MEASURED. This relay had no hazard triage, no age policy and no source:
  // it throttled, capped and forwarded. So a child asking BY VOICE how to mix cleaning chemicals
  // reached the vendor and came back answered — while the identical question TYPED was refused,
  // because `graveHazard` is unconditional in api/ask.js AND NOWHERE ELSE. Two doors into the
  // same building and one of them unguarded.
  //
  // IT RUNS BEFORE THE DAY CAP AS WELL AS BEFORE THE FETCH. A refusal costs nothing, and it must
  // not cost the reader one of their questions for the day either.
  //
  // WHAT THIS IS NOT: the voice path is still NOT routed through api/ask.js. That is a larger
  // batch — it needs retrieval, source cards and the consistency screen on a streamed reply — and
  // doing half of it here would be worse than either end of it.
  const voiceText = lastUserText(outgoingBody && outgoingBody.messages);
  const voiceAudience = resolveAudience({ serverBand: null, clientBand: voiceBand });
  const voiceHazard = graveHazard(voiceText);
  if (voiceHazard) {
    // The SAME redirect the text path emits, from the same constant. Band-independent, exactly as
    // it is in api/ask.js: this is refused for everybody, not only for a reader who declared a age.
    console.warn('[policy] SAFETY_REDIRECT', {
      topic: voiceHazard, band: voiceAudience.band, path: 'voice', policyVersion: POLICY_VERSION,
    });
    return sendCapMessageSse(res, WARM_TEMPLATES.SAFETY_REDIRECT);
  }

  const voiceTopic = classifyTopic(voiceText, null);
  const voiceAccess = access({ topicClass: voiceTopic, audienceBand: voiceAudience.band });
  console.log('[policy] voice', {
    topicClass: voiceTopic, band: voiceAudience.band, audienceSource: voiceAudience.audienceSource,
    outcome: voiceAccess.outcome, sourcePolicy: voiceAccess.sourcePolicy, policyVersion: POLICY_VERSION,
  });
  // An access decision that is not "answer it" is answered by the warm template the policy names,
  // and never by the model. Same rule, same templates, same wording as the typed path.
  if (voiceAccess.outcome && voiceAccess.outcome !== 'ALLOW') {
    const tpl = warmTemplateFor(voiceAccess.sourcePolicy);
    if (tpl) return sendCapMessageSse(res, tpl);
  }
  // THE FLOOR. A benign question from a child gets a reply that is checked before it is spoken:
  // the patch test, the parent loop, the refusal of a harmful instruction. It costs the SAME one
  // upstream call — the reply is taken whole instead of streamed — and it applies only to the
  // bands it is written for, so an adult's voice turn is the byte relay it always was.
  const floorThisTurn = (voiceAudience.band === 'young' || voiceAudience.band === 'teen')
    && voiceAccess.sourcePolicy === 'GENERAL_CHILD_BENIGN';

  try {
    // DAILY QUESTION CAP (directive 78). One guard call, after body parse, before the
    // first Anthropic call. Counts the ANSWER turn only: api/chat-fast.js (the classifier)
    // and api/tashkeel.js are deliberately NOT capped, because one voice question fires
    // 2+N requests and counting each would make DAY_CAP=10 mean ~3 voice questions but 10
    // text ones. FAIL-CLOSED. guardDayCap never throws, so the surrounding try is not a
    // bypass -- but it must stay ABOVE the fetch or a capped request still costs money.
    const cap = await guardDayCap(req, res);
    if (!cap.allowed) {
      // Same ruling as api/ask.js: the daily limit is a normal in-conversation message, not
      // an error. This relay is a raw upstream byte pipe with no gentle path of its own, so
      // it emits the ONE shape index.html:3666 consumes (content_block_delta / text_delta),
      // identical in form to api/ask.js sendSynthesizedText. No invented frame type.
      if (cap.reason === 'day-cap-reached') {
        return sendCapMessageSse(res, dayCapMessage(cap.reason));
      }
      // cap-unavailable KEEPS its 429, for the same reason as api/ask.js.
      return res.status(429).json({ error: cap.reason, message: dayCapMessage(cap.reason) });
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      // The floor needs a whole draft to judge, so that one case asks for the reply in one piece.
      // Everything else streams exactly as it did.
      body: JSON.stringify(floorThisTurn ? { ...outgoingBody, stream: false } : outgoingBody),
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

    // ── THE AGE FLOOR, ON THE VOICE TURN, EXACTLY AS ON THE TYPED ONE ───────
    // A draft that is merely INCOMPLETE — it forgot the patch test, it forgot to bring a parent in
    // — is completed deterministically from sentences this server owns. A draft that told a child
    // to rub lemon on their lips is discarded whole, because a warning bolted onto the end of a
    // harmful instruction is still the harmful instruction. Emitted in the one frame shape the
    // live client already consumes, so no client change is needed.
    if (floorThisTurn) {
      const payload = await upstream.json().catch(() => null);
      const draft = ((payload && payload.content) || [])
        .filter((b) => b && b.type === 'text').map((b) => b.text).join('').trim();
      const rep = ageRepair(draft, { topicClass: voiceTopic, audienceBand: voiceAudience.band });
      console.log('[policy] AGE_FLOOR voice', {
        topicClass: voiceTopic, band: voiceAudience.band,
        ageFloorOutcome: rep.outcome, repaired: rep.repaired, problems: rep.problems,
      });
      // A DISCARDED DRAFT FALLS BACK TO THE CHILD LINE, not to the hazard redirect — the redirect
      // answers a question this child did not ask and reads to them as an accusation.
      return sendCapMessageSse(res, rep.text || warmTemplateFor('GENERAL_CHILD_BENIGN'));
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
