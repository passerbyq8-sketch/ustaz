// api/chat-fast.js
// FAST GENERAL CHANNEL relay — CALL mode only.
// Byte-faithful sibling of api/chat.js with one routing distinction: its unheard classifier
// resolves FAST (Haiku), while its user-visible answer resolves STANDARD (Sonnet). Everything else — CORS,
// ephemeral system-prompt caching, upstream-error passthrough, and the thin SSE relay —
// is intentionally identical to api/chat.js so the client parser needs ZERO changes.
//
// SAFETY NOTE — REWRITTEN, BECAUSE THE OLD ONE WAS THE DEFECT. It used to read: "the guarantee
// that religious / worship / Quran questions never reach this thin path lives ENTIRELY in the
// client-side classifier (index.html callAI), NOT here." A guarantee enforced by the thing being
// classified is not a guarantee — the classifier is a Haiku call over the child's own words, and
// when it says GEN the answer turn came straight here with nothing in the way.
//
// So this relay is no longer a PURE RELAY. It now runs the SAME hazard triage, the SAME age
// policy and the SAME day cap as api/chat.js, from the SAME modules (lib/policy/*, lib/daycap.js)
// — see the triage block below. It still carries no prompt and no worship text of its own, and it
// still does no ROUTING: it refuses, or it forwards. The client classifier remains a routing
// optimisation, not a safety boundary.
//
// SIBLING CONTRACT: if you ever change the caching or SSE-relay logic in api/chat.js,
// mirror it here (and vice-versa) or the two relays will drift.
//
// This relay is LIVE: index.html (callAI, FAST_CHANNEL_ENABLED=true) POSTs both the unheard
// classifier turn and GEN-classified user-visible CALL answers here.
//
// D02ب CORRECTS THE LINE THAT STOOD HERE. It used to say this relay "carries NO prompt of its
// own — the client sends the GEN system prompt". That is no longer true and was never safe: it
// meant the text telling this route to refuse every religious subject was supplied by the
// caller, who could simply not send it. Both prompts on this route now come from
// lib/system-prompt.js and the body's `system` is discarded unread.

/* 15 */
import { checkChatLimit, MAX_CHAT_BODY_BYTES, MAX_CHAT_TOKENS, applyCorsOrigin } from '../lib/ratelimit.js';
import { guardAIConsent, AI_CONSENT_ALLOW_HEADERS } from '../lib/ai-consent.js';
// THE SAME MODULES api/chat.js READS, imported — not transcribed. A hazard list that lives in
// three files is three lists, and the one that goes stale is always the one nobody is looking at.
import { guardDayCap, dayCapMessage, sendCapMessageSse } from '../lib/daycap.js';
import { classifyTopic, graveHazard, WARM_TEMPLATES, POLICY_VERSION } from '../lib/policy/core.js';
import { access, resolveAudience, repair as ageRepair, warmTemplateFor } from '../lib/policy/age.js';
// api/chat.js keeps a private copy of this; api/ask.js imports the shared one. This relay takes
// the shared one, so the third door does not become a third definition.
import { lastUserText } from '../lib/attribution.js';
// D02ب: this relay carries its two prompts now instead of taking them from the body. Which of
// the two it builds is decided by max_tokens -- the SAME discriminator this file already uses
// for isClassifierTurn below, so no new field was invented to carry the distinction.
import { CLASSIFIER_SYSTEM_PROMPT, buildFastGenPrompt } from '../lib/system-prompt.js';
import { readerFromBody, dropClientSystem } from '../lib/reader-fields.js';
import { guardEmptyAnswer } from '../lib/empty-answer.js';
import { classifyImpermissibleRequest, impermissibleCounsel } from '../lib/policy/impermissible-request.js';
import { classifyWorldIntent } from '../lib/world-intent.js';
import { liveSearchNotice } from '../lib/policy/live-search-disclosure.js';

// THE CLASSIFIER TURN, IDENTIFIED. This relay carries TWO different things: the route classifier
// (index.html:7879 — `max_tokens: 8`, one word of output, never spoken to the child) and the GEN
// answer (index.html:7933 — `max_tokens: 4096`, read aloud). They are not the same kind of event
// and two of the guards below must tell them apart:
//
//   * THE DAY CAP counts ANSWER turns only. api/chat.js:197-202 states the rule and the reason:
//     one voice question fires 2+N requests, so counting each would make DAY_CAP=10 mean ~3 voice
//     questions but 10 typed ones. That is why this relay was left uncapped entirely. Capping the
//     answer turn honours BOTH the rule and the cap.
//   * THE AGE FLOOR judges a draft that a child will HEAR. The classifier's one word is never
//     heard, so repairing it would be repairing nothing.
//
// The hazard refusal and the age policy are NOT scoped this way — they run on every turn, the
// classifier included, because a refusal is free and must never cost a question.
//
// A caller who sets max_tokens:8 by hand to dodge the day cap buys themselves eight tokens of
// output. The throttle, the global kill-switch and the input cap are untouched by the trick.
const CLASSIFIER_MAX_TOKENS = 8;

function modelForVoiceTurn(isClassifierTurn) {
  if (isClassifierTurn) {
    return process.env.MODEL_FAST || 'claude-haiku-4-5-20251001';
  }
  return process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5';
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + AI_CONSENT_ALLOW_HEADERS);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Apple 5.1.1(i). SIBLING CONTRACT with api/chat.js: the same guard, in the same place, before
  // the throttle. The classifier turn carries the reader's own words, so it is a send like any
  // other and is refused without consent.
  if (!guardAIConsent(req, res)) return;

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

  // Server-authoritative model override. The same endpoint carries two semantic roles:
  // only its unheard classifier resolves FAST; every user-visible answer resolves STANDARD.
  let outgoingBody = req.body;
  let voiceBand;
  try {
    const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : { ...req.body };

    // Output cap decided HERE, not by the client. The classifier asks for 8 and the GEN
    // answer for 4096 -- both pass through untouched. An attacker asking for 64000 does not.
    parsed.max_tokens = Math.min(Number(parsed.max_tokens) || MAX_CHAT_TOKENS, MAX_CHAT_TOKENS);
    const classifierTurnForPrompt = Number(parsed.max_tokens) <= CLASSIFIER_MAX_TOKENS;
    parsed.model = modelForVoiceTurn(classifierTurnForPrompt);
    console.log('[tier] voice-fast', {
      role: classifierTurnForPrompt ? 'classifier' : 'answer',
      model: parsed.model,
    });

    // SIBLING CONTRACT (api/chat.js A3): `output_config` is NOT accepted by /v1/messages -- its
    // mere presence 400s the whole request. This relay never added it, but it must not FORWARD
    // one either: on this path a 400 kills the classifier too, which is the thing that decides
    // whether a religious question is allowed on the thin route at all.
    if (parsed.output_config !== undefined) {
      console.warn('[chat-fast] stripped unsupported output_config from the outgoing body');
      delete parsed.output_config;
    }

    // Ephemeral caching on the system prompt, identical to api/chat.js. For the thin
    // call-mode prompt this is effectively a no-op (below the cache minimum) but it is
    // harmless, degrades gracefully, and keeps this relay byte-faithful to its sibling.
    // D02ب: BOTH prompts on this route are ours. Whatever `system` arrived is discarded unread.
    //
    // This relay serves two different turns and they need different text: the classifier, whose
    // one word nobody hears, and the thin GEN answer, which a child does hear. They are told
    // apart by max_tokens -- already clamped on the line above, and already this file's own test
    // for isClassifierTurn further down. Using the existing discriminator keeps the two decisions
    // (which prompt, and which policy) reading the same signal; a second field could disagree
    // with itself.
    const reader = readerFromBody(parsed);
    dropClientSystem(parsed, 'chat-fast');
    parsed.system = [{
      type: 'text',
      text: classifierTurnForPrompt ? CLASSIFIER_SYSTEM_PROMPT : buildFastGenPrompt(reader.age),
      cache_control: { type: 'ephemeral' },
    }];
    for (const k of ['name', 'age', 'gender', 'mode']) if (parsed[k] !== undefined) delete parsed[k];

    // SIBLING CONTRACT (api/chat.js C): `band` is a field this app adds so the policy below has
    // something to govern by, and /v1/messages 400s on an unknown top-level field. Read it, then
    // strip it, exactly as the sibling does.
    //
    //    THE HOLE NAMED HERE IS CLOSED (D02ب/م٥). It used to read: index.html sent `band` ONLY
    //    when `endpoint === '/api/chat'`, so neither body on THIS route carried it, this read
    //    `undefined`, and resolveAudience returned the unknown-reader default — 'adult'
    //    (lib/policy/age.js). The band-INDEPENDENT hazard refusal protected every reader, but
    //    the band-DEPENDENT floor below never fired for anyone. The client now sends `band` to
    //    all three routes, and `age` with it, so the floor has something real to govern by.
    //
    //    Two claims, one reader, and the NARROWER wins — same reader-fields result as the two
    //    siblings, shared by both the prompt input and this policy branch.
    voiceBand = reader.band;
    if (parsed.band !== undefined) delete parsed.band;

    outgoingBody = parsed; // messages / stream as sent. model and max_tokens are OURS.

    // قرار ٩, sibling of api/chat.js -- but NOT on the classifier turn, and the exemption is
    // explicit rather than assumed. That turn's reply is one word nobody ever sees; the client
    // reads it as a routing token and treats anything that is not exactly 'GEN' as 'DEEN'
    // (index.html). So an Arabic apology posted into that channel would be dead text at best,
    // and it is installed here, after max_tokens has told us which turn this is, rather than at
    // the top of the handler where that is not yet known.
    if (!classifierTurnForPrompt) guardEmptyAnswer(res, 'chat-fast');
  } catch (e) {
    // No raw passthrough. Same reason as api/chat.js: the old fallback handed the client
    // back control of the model and the token cap on any transform error. SIBLING CONTRACT.
    console.warn('[chat-fast] body transform failed:', e && e.message ? e.message : e);
    return res.status(400).json({ error: 'bad body' });
  }

  // ── TRIAGE, ON THE FAST TURN, BEFORE ANY MODEL CALL ───────────────────────
  //
  // THE HOLE THIS CLOSES, MEASURED. api/chat.js runs the hazard triage, the age policy and the
  // day cap; this relay ran none of them. It is not a lesser door for it: the client sends a GEN-
  // classified CALL turn straight here, so a child whose dangerous question the classifier called
  // "neutral knowledge" reached Haiku with NOTHING in the way. Three doors into the same building
  // and this one was unguarded. The SAFETY NOTE at the top of this file said the guarantee lived
  // "ENTIRELY in the client-side classifier" — a guarantee held by the thing being classified is
  // not a guarantee, and that is what this block replaces.
  //
  // IT RUNS BEFORE THE DAY CAP AS WELL AS BEFORE THE FETCH — the same order as the sibling. A
  // refusal costs nothing, and it must not cost the reader one of their questions for the day.
  const isClassifierTurn = Number(outgoingBody && outgoingBody.max_tokens) <= CLASSIFIER_MAX_TOKENS;
  const voiceText = lastUserText(outgoingBody && outgoingBody.messages);
  const voiceAudience = resolveAudience({ serverBand: null, clientBand: voiceBand });
  const impermissible = classifyImpermissibleRequest(voiceText);
  if (impermissible.blocked) {
    console.warn('[policy] IMPERMISSIBLE_REQUEST', {
      kind: impermissible.kind, band: voiceAudience.band, path: 'voice-fast',
      turn: isClassifierTurn ? 'classifier' : 'answer', policyVersion: POLICY_VERSION,
    });
    return sendCapMessageSse(res, impermissibleCounsel(voiceAudience.band));
  }
  // The classifier's one-word result is routing data, never spoken. Prefix only answer turns.
  const voiceLiveNotice = isClassifierTurn ? '' : liveSearchNotice({
    worldWanted: classifyWorldIntent(voiceText).world, answeredFromLive: false,
  });
  const voiceHazard = graveHazard(voiceText);
  if (voiceHazard) {
    // Band-independent, exactly as in api/ask.js and api/chat.js: refused for everybody, not only
    // for a reader who declared an age. On the classifier turn the client reads this back, fails
    // to see 'GEN', and returns DEEN — which sends the turn to the FULL prompt on api/chat.js,
    // where the same refusal is emitted to the child. It fails toward the guarded route.
    console.warn('[policy] SAFETY_REDIRECT', {
      topic: voiceHazard, band: voiceAudience.band, path: 'voice-fast',
      turn: isClassifierTurn ? 'classifier' : 'answer', policyVersion: POLICY_VERSION,
    });
    return sendCapMessageSse(res, WARM_TEMPLATES.SAFETY_REDIRECT);
  }

  const voiceTopic = classifyTopic(voiceText, null);
  const voiceAccess = access({ topicClass: voiceTopic, audienceBand: voiceAudience.band });
  console.log('[policy] voice-fast', {
    topicClass: voiceTopic, band: voiceAudience.band, audienceSource: voiceAudience.audienceSource,
    outcome: voiceAccess.outcome, sourcePolicy: voiceAccess.sourcePolicy,
    turn: isClassifierTurn ? 'classifier' : 'answer', policyVersion: POLICY_VERSION,
  });
  if (voiceAccess.outcome && voiceAccess.outcome !== 'ALLOW') {
    const tpl = warmTemplateFor(voiceAccess.sourcePolicy);
    if (tpl) return sendCapMessageSse(res, tpl);
  }
  // THE FLOOR, on the turn the child actually HEARS. Same rule as the sibling: it costs the SAME
  // one upstream call (the reply is taken whole instead of streamed) and it applies only to the
  // bands it is written for. The classifier's one word is excluded because nobody hears it.
  const floorThisTurn = !isClassifierTurn
    && (voiceAudience.band === 'young' || voiceAudience.band === 'teen')
    && voiceAccess.sourcePolicy === 'GENERAL_CHILD_BENIGN';

  try {
    // DAILY QUESTION CAP. Above the fetch or a capped request still costs money; below the
    // refusals above or a refusal would cost the reader a question. ANSWER TURNS ONLY — see
    // CLASSIFIER_MAX_TOKENS at the top of this file for why, and api/chat.js:197-202 for the
    // rule it preserves. guardDayCap never throws, so the surrounding try is not a bypass.
    if (!isClassifierTurn) {
      const cap = await guardDayCap(req, res);
      if (!cap.allowed) {
        // Same ruling as api/chat.js: the daily limit is a normal in-conversation message, not an
        // error, and it is emitted in the ONE frame shape index.html already consumes.
        if (cap.reason === 'day-cap-reached') {
          return sendCapMessageSse(res, dayCapMessage(cap.reason));
        }
        // cap-unavailable KEEPS its 429, for the same reason as api/chat.js.
        return res.status(429).json({ error: cap.reason, message: dayCapMessage(cap.reason) });
      }
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

    // Forward upstream errors (400 bad-model / 401 quota / 429 / 5xx) verbatim so a wrong
    // MODEL_FAST string or a credit problem fails LOUDLY in logs, not as a silent hang.
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(errText || JSON.stringify({ error: { message: `upstream ${upstream.status}` } }));
    }

    // ── THE AGE FLOOR, ON THE FAST TURN, EXACTLY AS ON THE OTHER TWO ────────
    // A draft that is merely INCOMPLETE — it forgot the patch test, it forgot to bring a parent in
    // — is completed deterministically from sentences this server owns. A draft that told a child
    // to rub lemon on their lips is discarded whole, because a warning bolted onto the end of a
    // harmful instruction is still the harmful instruction.
    if (floorThisTurn) {
      const payload = await upstream.json().catch(() => null);
      const draft = ((payload && payload.content) || [])
        .filter((b) => b && b.type === 'text').map((b) => b.text).join('').trim();
      const rep = ageRepair(draft, { topicClass: voiceTopic, audienceBand: voiceAudience.band });
      console.log('[policy] AGE_FLOOR voice-fast', {
        topicClass: voiceTopic, band: voiceAudience.band,
        ageFloorOutcome: rep.outcome, repaired: rep.repaired, problems: rep.problems,
      });
      // A DISCARDED DRAFT FALLS BACK TO THE CHILD LINE, not to the hazard redirect — the redirect
      // answers a question this child did not ask and reads to them as an accusation.
      return sendCapMessageSse(res, [voiceLiveNotice, rep.text || warmTemplateFor('GENERAL_CHILD_BENIGN')]
        .filter(Boolean).join('\n\n'));
    }

    // Thin streaming relay: forward the SSE bytes unmodified; the client parses the events.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    if (voiceLiveNotice) {
      const noticeFrame = {
        type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: voiceLiveNotice + '\n\n' },
      };
      res.write(`data: ${JSON.stringify(noticeFrame)}\n\n`);
    }
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
