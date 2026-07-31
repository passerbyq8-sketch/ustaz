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

import { checkAskLimit, MAX_CHAT_BODY_BYTES, MAX_CHAT_TOKENS } from '../lib/ratelimit.js';
import { guardDayCap, dayCapMessage, hasValidFounderToken } from '../lib/daycap.js';
import { ASK_LIMIT_MESSAGE } from '../lib/limit-message.js';
import { classifyRoute, createSourceFilter } from '../lib/route-classify.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Server-declared tool. The client never sends this.
const tools = [
  {
    name: 'search_islamic_sources',
    description:
      'ابحث في المواقع الشرعية المعتمدة عن الأدلّة والفتاوى والتخريج لإجابة سؤالٍ فقهيٍّ أو حديثيٍّ أو تفسيريٍّ يحتاج نسبةً إلى مصدر. استدعِ هذه الأداة فقط حين يحتاج السؤالُ دليلًا منسوبًا؛ لا تستدعِها للتحيّة أو الأسئلة البسيطة أو أسئلة الأطفال العامّة.\n\nعددُ الاستدعاءات يتبع بِنيةَ السؤال لا طولَه: السؤالُ البسيط الذي يكفيه حكمٌ واحدٌ أو مرجعٌ واحد يُستدعى له مرّةً واحدةً فقط. وإذا كان السؤال مركّبًا حقًّا — أي ينحلّ إلى مسألتين أو ثلاثِ مسائلَ متمايزةٍ لكلٍّ منها حكمُها أو مرجعُها المستقلّ (مثل: حكمُ الفعل، وتخريجُ الحديث المستدَلِّ به، وما يترتّب عليه) — فاستدعِ الأداةَ مرّةً لكلِّ مسألةٍ منها، بحدٍّ أقصى ثلاثُ استدعاءات، ولكلِّ استدعاءٍ استعلامٌ مستقلٌّ يخصُّ زاويتَه وحدَها. لا تُكرِّر الاستعلامَ نفسَه بصياغتين، ولا تُقسِّم مسألةً واحدةً إلى استدعاءين.',
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
    return "وسّعِ الجوابَ في هذا الوضع (مفصّل) وابْنِه بعناوينَ ظاهرةٍ، أعمقَ بوضوحٍ من الجوابِ المعتاد، على القولِ المعتمَدِ دون سردِ خلاف. رتّبِ الجوابَ في هذه الأقسامِ بعناوينَ صريحةٍ كلٌّ في سطرِه:\n**تمهيد:** جملةٌ أو جملتان تُؤطِّرانِ المسألةَ وتُحرِّرانِ محلَّ السؤال.\n**التفصيل:** اشرحِ الحكمَ وتفريعاتِه المتّصلةَ بالسؤالِ شرحًا وافيًا مترابطًا، لا مجردَ إشارة.\n**الأدلّة:** اذكرْ أدلّةَ القولِ من الكتابِ والسنّةِ بنصِّها أو معناها القريب، وبيِّنْ لكلِّ دليلٍ **وجهَ دلالتِه** على الحكمِ لا مجردَ إيرادِه، وأضِفْ ما تيسّرَ من قولِ أهلِ العلمِ في تقريرِه.\n**تطبيقٌ وخلاصة:** اختمْ بخلاصةٍ عمليّةٍ موجزةٍ تُعينُ السائلَ على العمل.\nليكنِ العمقُ في المضمونِ لا في الحشو: لا تُكرّرْ، ولا تُطِلْ بلا فائدة، وابْقَ في صلبِ المسألة.\nوعند تعارُضِ المصادرِ المسترجَعةِ في مسألةٍ اجتهاديّة، اعتمِدِ القولَ الأقوى نقلًا وسلطةً على هذا الترتيب: أوّلًا المجامعُ الفقهيّةُ وهيئاتُ الإفتاءِ الجماعيّة، ثمّ كبارُ المفتين المعاصرين المعتمَدين، ثمّ الموسوعةُ الفقهيّةُ الكويتيّة، ثمّ المواقعُ العلميّةُ الجامعة، وابْنِ جوابَك على المعتمَدِ منها. التزمْ هذا الوضعَ في جوابِك الحاليِّ مهما كان أسلوبُ ردودِك السابقة في المحادثة.";
  }
  if (depth === 'scholar') {
    return "هذا سؤالٌ في وضع طالب العلم. لا تُعطِ حكمًا مباشرًا ولا تُرجّح من عندك؛ مهمّتُك أن تعرِض ما قاله العلماءُ في المسألة مادّةَ دراسةٍ للطالب، لا فتوى. اعرِض في هذه الإجابة حتّى أربعةَ أقوالٍ متمايزةٍ في المسألة — بتمايز المضمون لا بتعدّد الأسماء — لكلّ قولٍ دليلُه من الكتاب والسنّة، ومن قال به من العلماء ومذاهبهم. واحرِصْ، إن سمحت المصادرُ، أن تُمثِّل الأقوالَ بشواهدَ من العلماء المتقدّمين والمعاصرين معًا. وانقُلْ ما ورد في المصادر من ترجيحٍ وقولِ الجمهور نقلًا منسوبًا لقائله، دون أن تُرجّح أنت. فإن كانت أقوالُ المسألة أكثرَ من أربعة، فاذكُرْ ذلك واسأل الطالبَ صراحةً: هل تريد أن أزيدك من الأقوال؟ — فإن طلب، اسرِدِ الباقيَ. وإن لم تكن المسألةُ خلافيّةً أصلًا (فيها إجماعٌ أو حقيقةٌ مستقرّة)، فبيِّن ذلك واعرِضِ القولَ المستقرَّ بدليله، ولا تصطنع خلافًا. استثناءٌ حاكمٌ يعلو ما سبق: صفةُ العباداتِ المقفلةِ (الصلاة، الوضوء، الغُسل، التيمّم، الأذكار) لا يُعرَضُ فيها خلافٌ البتّةَ ولو ورد في المصادر؛ بل تُعرَضُ صفةً واحدةً ثابتةً كما هي مقرَّرةٌ في التطبيق. وقاعدةُ الأقوالِ الأربعةِ لا تنطبقُ على صفةِ عبادةٍ أبدًا. إن سُئلتَ في وضع طالب العلم عن كيفيّةِ أداءِ عبادةٍ من هذه، فاعرِضِ الصفةَ الثابتةَ الواحدةَ بلا أقوالٍ متعدّدةٍ ولا اختلاف. اعتمِدْ حصرًا على ما استرجعتَه من المصادر المعتمدة؛ وما لم تجده فيها، قُلْ صراحةً \"لم أقف عليه في المراجع المتاحة\" ولا تملأ الفراغَ من معرفتك. وعند تعارُضِ المصادرِ المسترجَعةِ في مسألةٍ اجتهاديّة، اعرِضِ الأقوالَ مرتّبةً بحسبِ قوّةِ النقلِ والثقةِ على هذا الترتيب: أوّلًا المجامعُ الفقهيّةُ وهيئاتُ الإفتاءِ الجماعيّة، ثمّ كبارُ المفتين المعاصرين المعتمَدين، ثمّ الموسوعةُ الفقهيّةُ الكويتيّةُ عارضةً للمذاهبِ منسوبةً لأصحابها، ثمّ المواقعُ العلميّةُ الجامعة. وهذا ترتيبُ عرضٍ وثقةٍ في النقلِ فقط — لا تُرجّح بينها، فوضعُ طالبِ العلمِ عرضٌ لا فتوى. التزمْ هذا الوضعَ في جوابِك الحاليِّ مهما كان أسلوبُ ردودِك السابقة في المحادثة.";
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

// ── VERIFIED SOURCE ENFORCEMENT ──────────────────────────────────────────────
// retrieve() returns a STRUCTURED sources array (lib/retrieve.js:332) whose every entry
// survived the hard band allow-list check on its FINAL post-redirect host
// (lib/retrieve.js:298-304). That array is the ONLY thing allowed to become a card.
//
// A religious reply now ends with ONE TO THREE cards, and every one of them is verified:
//   * every <source> the model typed in round 2 is stripped from the stream, no matter
//     which host it names -- an allow-listed domain in model prose is still an unchecked
//     URL, so model prose can never contribute a card even when the URL it names is one
//     we did in fact retrieve;
//   * the verified cards are then appended once, last, in answer order;
//   * HOW MANY is decided by the question, not by a quota: one card per retrieval angle
//     that actually came back with a usable page, capped at MAX_SOURCES. A single-part
//     question searches once and ends with exactly one card, as it always has. Duplicates
//     are folded by canonicalKey() so www./trailing-slash/%xx variants of one page cannot
//     occupy two slots -- but two DIFFERENT pages on the same host are kept, because they
//     can support two different parts of the answer;
//   * and if retrieval produced no usable structured source, round 2 never runs at all —
//     the route answers with a plain "I could not verify a source" line instead of an
//     unsourced ruling. Fail closed, no extra model or retrieval call.
//
// SCOPE NOTE: the allow-list itself is deliberately NOT re-declared here. lib/retrieve.js
// keeps ONE list object driving both the query filter and the post-fetch host enforcement
// (see its comment at lines 38-42); a second copy in this file is exactly the drift that
// comment forbids. So this file re-validates SHAPE and SCHEME only and leans on the
// upstream hard gate for host trust.

// Longest title we will put inside a card. Keeps the chip readable; the client falls
// back to the hostname when the title is empty (index.html:6594).
const SOURCE_TITLE_MAX = 120;

// Shown INSTEAD of a ruling when retrieval came back with nothing we can stand behind.
// Deliberately not a fatwa and deliberately carries no source card: it makes no religious
// claim at all, so there is nothing to attribute.
const NO_VERIFIED_SOURCE_MESSAGE =
  'تعذّر عليّ التحقق من مصدر موثوق لهذه الإجابة الآن، لذلك لن أعطيك حكماً بلا مصدر. حاول مرة أخرى بعد قليل أو أعد صياغة السؤال.';

// Build the canonical card for ONE structured source, or null when it cannot be encoded
// safely. The output must satisfy the EXACT grammar the live client parses:
//   index.html:1264  /<(...|source|...)([^>]*)>([\s\S]*?)<\/\1>/g   -> attrs may not hold '>'
//   index.html:1320-1321  site=["']([^"']+)["'] and url=["']([^"']+)["']  -> values hold no quote
// Anything that will not fit that grammar is REJECTED rather than escaped into something
// the parser would silently truncate.
export function buildSourceTag(src) {
  if (!src || typeof src.url !== 'string') return null;
  const raw = src.url.trim();
  if (!raw) return null;

  let u;
  try { u = new URL(raw); } catch { return null; }
  // https ONLY. This is also what rejects javascript:, data:, file: and bare http:.
  if (u.protocol !== 'https:') return null;

  const host = (u.hostname || '').toLowerCase().replace(/^www\./, '');
  // Plain dotted hostname. No userinfo, no IP-literal brackets, no stray punctuation.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
  if (u.username || u.password) return null;

  // WHATWG href already percent-encodes " < > and whitespace; the apostrophe is not
  // encoded but WOULD close the attribute early under the client's [^"']+ class, so
  // encode it explicitly, then refuse anything still hostile to the grammar.
  const url = u.href.replace(/'/g, '%27');
  if (/["'<>\s]/.test(url)) return null;

  const title = String(src.title == null ? '' : src.title)
    .replace(/[<>]/g, ' ')       // never let the card's own text open or close a tag
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SOURCE_TITLE_MAX)
    .trim();

  return { url, host, tag: `<source site="${host}" url="${url}">${title || host}</source>` };
}

// Hard ceiling on cards in one reply. Three is the number of distinct rulings/references
// a compound question is allowed to rest on; past that a reply stops citing and starts
// listing. Also the cap on retrieval angles below, so the two can never disagree.
const MAX_SOURCES = 3;

// Dedup key for "is this the SAME page?". Folds exactly the differences that are not
// differences: scheme+userinfo/port noise, a leading www., a trailing slash, a #fragment,
// and lower-vs-upper percent escapes (Arabic slugs arrive both ways from different
// referrers). Query string is KEPT — on these sites it selects content, so dropping it
// would collapse two genuinely different pages into one.
// NOT folded: the path itself. Two different pages on one host are two sources, because
// they can support two different parts of the answer.
export function canonicalKey(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/%[0-9a-fA-F]{2}/g, (m) => m.toUpperCase()).replace(/\/+$/, '');
    return host + (path || '/') + u.search;
  } catch {
    return '';
  }
}

// SELECTION RULE: walk the structured sources in retrieval order and keep the first
// MAX_SOURCES distinct, structurally valid pages.
//
// Retrieval order IS answer order: retrieve() keeps at most ONE clean source per query
// (lib/retrieve.js), Promise.all preserves tool order, and the caller stores each angle's
// result at its own index. So source N is the source for question-part N, and the cards
// come out in the order the parts were asked. That is also why the count is not padded:
// one successful angle yields one card, two yield two, three yield three. A simple
// question searches once and gets exactly one card, at exactly today's cost.
//
// Invalid entries are skipped, not fatal; if none can be encoded, we emit nothing and the
// caller refuses to answer.
export function pickVerifiedSources(sources, limit = MAX_SOURCES) {
  const out = [];
  const seen = new Set();
  for (const s of sources || []) {
    if (out.length >= limit) break;
    const built = buildSourceTag(s);
    if (!built) continue;
    const key = canonicalKey(built.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(built);
  }
  return out;
}

// Read ONE complete SSE frame exactly the way the live client reads it
// (index.html:5198-5206): concatenate every `data:` line, JSON.parse, ignore the rest.
// Returns null for keepalive comments and anything unparseable.
function readSseFrame(buf) {
  const s = buf.toString('utf8');
  if (s.indexOf('data:') === -1) return null;
  let dataStr = '';
  for (const line of s.split('\n')) {
    const l = line.trim();
    if (l.startsWith('data:')) dataStr += l.slice(5).trim();
  }
  if (!dataStr) return null;
  try { return JSON.parse(dataStr); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-murabbi-device, x-murabbi-founder');

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

  // Body-size cap (bug 6): the client controls system+messages verbatim, so an
  // oversized body is pure upstream cost. Reject before the SSE commit + the
  // Anthropic call. MAX_CHAT_BODY_BYTES is the same measured 256 KB ceiling chat.js uses.
  const bodyBytes = typeof req.body === 'string'
    ? Buffer.byteLength(req.body, 'utf8')
    : Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (bodyBytes > MAX_CHAT_BODY_BYTES) {
    return res.status(413).json({ error: 'Request body too large' });
  }

  // DAILY QUESTION CAP (directive 78). Sits AFTER body parse + the size cap and BEFORE the
  // first Anthropic call, so a capped request costs nothing. NO IP: identity is the device
  // header plus an httpOnly cookie. FAIL-CLOSED, unlike checkAskLimit above -- a burst
  // throttle that fails open costs a little money, a spend cap that fails open costs all of
  // it. This route normally answers a throttle with a 200 SSE message (see the note in
  // lib/ratelimit.js), but the cap answers 429 so the client can surface the real reason
  // instead of a generic "try again".
  const cap = await guardDayCap(req, res);
  if (!cap.allowed) {
    // Reaching the daily limit is NOT an error screen. It arrives as a normal reply in the
    // conversation, through this route's OWN gentle path -- sendSynthesizedText above, the
    // same HTTP 200 SSE mechanism the per-IP throttle already answers with. No second
    // mechanism, and no number in the wording.
    if (cap.reason === 'day-cap-reached') {
      return sendSynthesizedText(res, dayCapMessage(cap.reason));
    }
    // cap-unavailable KEEPS its 429: the store being down is a real failure and must look
    // like one, carrying our own truthful wording rather than a generic line.
    return res.status(429).json({ error: cap.reason, message: dayCapMessage(cap.reason) });
  }

  const maxTokens = Math.min(body.max_tokens || MAX_CHAT_TOKENS, MAX_CHAT_TOKENS);
  // TIER LOCK (directive 82). The UI cannot be the lock: anyone can POST here directly with
  // depth:"scholar" and get the premium model on our bill. So the SERVER decides -- without a
  // valid founder token the requested depth is dropped and the default tier is served.
  // Deliberately silent: no error and no "you were downgraded" field, because telling a prober
  // which requests would have been expensive is telling them what to forge. The downgrade is
  // recorded server-side in the [tier] line below instead.
  const founderUnlocked = hasValidFounderToken(req);
  const effectiveDepth = founderUnlocked ? body.depth : undefined;
  // depth: undefined/'normal' = brief (default), 'deep' = مفصّل, 'scholar' = طالب العلم
  const round2Effort = (effectiveDepth === 'deep' || effectiveDepth === 'scholar') ? 'high' : 'medium';
  // Age band for RAG source-gating (khilaf-policy §6). Optional; absent/garbled => undefined => retrieve() fails CLOSED to the minor list (NOT adult).
  const band = (body.band === 'young' || body.band === 'teen' || body.band === 'adult') ? body.band : undefined;
  // BAND GATE (khilaf-policy §1/§2/§3). The depth instruction is ADULT-ONLY. 'scholar' orders the model
  // to present up to FOUR differing scholarly opinions with evidence; injecting that into a child's
  // system prompt is a direct policy breach. Mirrors usePremium (next line) and scholarMode (round 2),
  // both of which already check the band. Fail-CLOSED: an absent or garbled band gets NO instruction.
  const depthInstruction = band === 'adult' ? buildDepthInstruction(effectiveDepth) : '';
  const usePremium = band === 'adult' && (effectiveDepth === 'deep' || effectiveDepth === 'scholar');
  const model = usePremium
    ? (process.env.MODEL_PREMIUM  || process.env.MODEL || 'claude-opus-4-8')
    : (process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5');
  console.log('[tier]', { band, requestedDepth: body.depth, effectiveDepth, founderUnlocked, usePremium, model });
  const system = appendDepthBlock(wrapSystem(body.system), depthInstruction);

  // DETERMINISTIC ROUTE (lib/route-classify.js). Decided HERE, on the server, from the
  // messages themselves -- never from a client-supplied field, because the whole point is
  // that a religious turn cannot opt out of being sourced.
  //   GEN  -> one streamed round, no tools: general questions stop paying for a decision
  //           round they never needed, and text appears while it is still being written.
  //   DEEN -> round 1 with the search tool FORCED, so the same fatwa searches every time
  //           instead of depending on the model's mood.
  // It changes neither the model, the system prompt, the effort, the token cap, the band,
  // nor the allow-list. Real doubt resolves to DEEN.
  const route = classifyRoute(body.messages);
  console.log('[route]', { route, band });

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // -- Commit to SSE now, then keep the socket warm during the byte-silent phase --
  // Round 1 is non-streamed, so a long fully-vocalized answer (e.g. the salah card)
  // generates for ~35s with NO bytes reaching the client. Mobile carriers reset an
  // idle socket (~30s) -> ERR_CONNECTION_RESET, so the finished answer never arrives
  // (exactly why the shorter wudu card survived and the longer salah card did not).
  // A periodic SSE comment keeps the socket alive; the client parser ignores any
  // block with no `data:` line (index.html handleEvent), so it stays invisible to it.
  // Round 2 streams real deltas, so keepalive is cleared right before that relay.
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  let keepAlive = setInterval(() => { try { res.write(': keepalive\n\n'); } catch {} }, 10000);
  const clearKeepAlive = () => { if (keepAlive) { clearInterval(keepAlive); keepAlive = null; } };

  try {
    // ── GEN ROUTE: ONE streamed round, NO tools ────────────────────────────
    // Same model, same system prompt, same token cap, same effort the final round uses
    // today. The ONLY difference from the old path is that `tools` is absent — so there is
    // no decision round to wait out, no retrieval, and no possibility of a tool_use block.
    // That last part is what makes streaming safe here: with no tools in the request the
    // model cannot switch to a search half-way, so no draft can ever be shown and then
    // replaced. Every text delta is forwarded as it arrives.
    if (route === 'GEN') {
      const g = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          ...(usePremium ? { output_config: { effort: round2Effort } } : {}),
          system,
          messages: body.messages,
          stream: true,
        }),
      });

      if (!g.ok) {
        const errText = await g.text().catch(() => '');
        console.error('[ask] gen upstream', g.status, errText.slice(0, 300));
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${g.status}` } })}\n\n`);
        return res.end();
      }

      // GEN never retrieves, so ANY <source> card here is unbacked. createSourceFilter()
      // removes them across chunk and frame boundaries while holding back only a few
      // bytes — byte-identical to the branch-(a) regex, never buffering the answer.
      clearKeepAlive();
      const filter = createSourceFilter();
      const reader = g.body.getReader();
      const SEP = Buffer.from('\n\n');
      const MAX_PENDING = 1 << 20;
      let pending = Buffer.alloc(0);
      const writeText = (t) => {
        if (!t) return;
        res.write(`data: ${JSON.stringify({
          type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t },
        })}\n\n`);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
          pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
          let idx;
          while ((idx = pending.indexOf(SEP)) !== -1) {
            const whole = pending.subarray(0, idx + SEP.length);
            const evt = readSseFrame(pending.subarray(0, idx));
            pending = pending.subarray(idx + SEP.length);
            if (evt && evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
              writeText(filter.push(evt.delta.text));   // filtered text replaces this frame
            } else {
              if (evt && evt.type === 'message_stop') writeText(filter.end());
              res.write(whole);                          // every other frame relayed verbatim
            }
          }
          if (pending.length > MAX_PENDING) { res.write(pending); pending = Buffer.alloc(0); }
        }
        writeText(filter.end());        // stream ended without a completion frame
        if (pending.length) res.write(pending);
      } finally {
        res.end();
      }
      return;
    }

    // ── ROUND 1 (DEEN): non-streamed, WITH tools, search FORCED ────────────
    const r1 = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(usePremium ? { output_config: { effort: 'low' } } : {}),
        system,
        messages: body.messages,
        tools,
        // FORCED, not suggested. This is the whole point of the DEEN route: the same
        // religious question must search every time instead of depending on the model
        // choosing to. Forcing the tool also means round 1 emits no prose at all, so
        // there is nothing from it that could reach the reader.
        tool_choice: { type: 'tool', name: tools[0].name },
        stream: false,
      }),
    });

    if (!r1.ok) {
      const errText = await r1.text().catch(() => '');
      console.error('[ask] round1 upstream', r1.status, errText.slice(0, 300));
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${r1.status}` } })}\n\n`);
      return res.end();
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
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: clean } })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      return res.end();
    }

    // (b) tool_use — run retrieval for the first MAX_SOURCES tool_use blocks CONCURRENTLY,
    // then round 2. The model emits one block per distinct part of the question (see the
    // tool description), so the angle count is the question's own structure, not a knob:
    // a simple question still produces one block and costs one search, exactly as before.
    // The slice is the hard ceiling on that, and it is the SAME constant that caps cards.
    const toolUses = (round1.content || []).filter((b) => b.type === 'tool_use').slice(0, MAX_SOURCES);
    console.log('[angles]', { requested: (round1.content || []).filter((b) => b.type === 'tool_use').length, used: toolUses.length });

    // Lazy import — only reached in the tool_use branch, so a greeting never loads
    // retrieve/linkedom. Imported ONCE here, shared by the concurrent branches below.
    const { retrieve } = await import('../lib/retrieve.js');

    // GOVERNANCE GATE (khilaf-policy §3/§6/§8): the Kuwaiti Fiqh Encyclopedia is
    // multi-madhhab (raw اختلاف الحكم) and is therefore SCHOLAR-ONLY background material.
    // Fire it ONLY for depth==='scholar' AND adult band. Any other case (ordinary user,
    // under-18, or an absent band) leaves scholarMode false and the encyclopedia untouched.
    const scholarMode = effectiveDepth === 'scholar' && band === 'adult';
    let retrieveEncyclopedia = null;
    if (scholarMode) {
      // Lazy: non-scholar requests never load the encyclopedia module or MiniSearch.
      ({ retrieveEncyclopedia } = await import('../lib/encyclopedia.js'));
    }

    // Run every angle's retrieve() concurrently: ~A+B collapses to ~max(A,B).
    // Promise.all preserves input order, so toolResults stays aligned 1:1 with
    // toolUses (each tool_result carries its own block.id). The try/catch is INSIDE
    // each branch so one angle throwing degrades to the "no source" text without
    // rejecting the batch or 500-ing — the other angle still returns real sources.
    // Structured sources, kept per-angle so the order matches toolUses 1:1 (Promise.all
    // preserves input order). This is the ONLY place a verified source can enter the
    // response: nothing here is ever reconstructed from model prose.
    const retrievedSources = [];
    const toolResults = await Promise.all(
      toolUses.map(async (block, angle) => {
        const q = (block.input && block.input.query) || '';
        let webText;
        try {
          // `depth` is passed for RETRIEVAL TARGETING only (lib/source-intent.js reads it).
          // It does not reach the model, and effectiveDepth is already the server-decided
          // value, not the client's claim.
          const out = await retrieve(q, { band, depth: effectiveDepth });
          webText = out.text;
          // PRESERVE (was: dropped). Allow-list trust is already established upstream.
          if (Array.isArray(out.sources) && out.sources.length) {
            retrievedSources[angle] = out.sources;
          }
        } catch (e) {
          // Never 500 on a retrieval error — degrade gracefully so the model won't fabricate.
          console.warn('[ask] retrieval threw:', e.message);
          webText = 'لم يُعثر على مصدرٍ موثوقٍ في المواقع المعتمدة للإجابة عن هذا السؤال.';
        }
        // Scholar mode (18+) only: append the encyclopedia as clearly-labelled study
        // background. Soft-fail — any error keeps the web-only result. This content lands
        // in round2Messages (the messages array), i.e. AFTER the cached system prefix, so
        // the prompt cache is never busted.
        let content = webText;
        if (scholarMode && retrieveEncyclopedia) {
          try {
            const enc = await retrieveEncyclopedia(q);
            if (enc.text) {
              content = webText
                + '\n' + '═'.repeat(40) + '\n'
                + '【مادّةٌ مرجعيّةٌ للدراسة — الموسوعة الفقهية الكويتية. خلفيّةٌ لطالب العلم تُعرَض منسوبةً لأصحابها لا حكمًا، ولا تُستعمَل في صفة عبادةٍ مقفلة.】\n'
                + enc.text;
            }
          } catch (e) {
            console.warn('[ask] encyclopedia retrieval threw:', e.message);
          }
        }
        return { type: 'tool_result', tool_use_id: block.id, content };
      })
    );

    // ── FAIL CLOSED: no verified source => no ruling ───────────────────────
    // Decided BEFORE round 2, so an unsourceable question costs one model call instead of
    // two and can never come back as a confident answer with nothing behind it. This is
    // the whole guarantee: on the DEEN route the reader either gets a verified card or
    // gets told plainly that we could not verify one.
    const canonicalSources = pickVerifiedSources(retrievedSources.filter(Boolean).flat());
    if (canonicalSources.length === 0) {
      console.warn('[source] no verified structured source — refusing to answer unsourced');
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: NO_VERIFIED_SOURCE_MESSAGE },
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      return res.end();
    }

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
        ...(usePremium ? { output_config: { effort: round2Effort } } : {}),
        system,
        messages: round2Messages,
        stream: true,
      }),
    });

    if (!r2.ok) {
      const errText = await r2.text().catch(() => '');
      console.error('[ask] round2 upstream', r2.status, errText.slice(0, 300));
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${r2.status}` } })}\n\n`);
      return res.end();
    }

    // Streaming relay, FRAMED, with the source layer owned entirely by the server.
    //
    // Frames are split on the same '\n\n' the client parser uses (index.html:5221), which
    // costs no visible latency — a partial frame is not actionable by the client either.
    // Text frames are re-emitted through createSourceFilter(), which deletes every
    // model-written <source>…</source> across chunk and frame boundaries while holding
    // back only a few bytes. Everything that is not a source tag survives byte for byte,
    // and the answer is never buffered.
    //
    // On the upstream message_stop we flush the filter and emit ONE text_delta carrying
    // every verified card, then relay the stop frame. So the cards are always the last
    // thing in the reply, emitted exactly once, and they are the only cards that can appear.
    clearKeepAlive();
    const filter = createSourceFilter();
    const reader = r2.body.getReader();
    const SEP = Buffer.from('\n\n');
    // Pathological-framing backstop: if a separator never arrives, flush rather than grow.
    const MAX_PENDING = 1 << 20;
    let pending = Buffer.alloc(0);
    let emitted = false;

    const writeText = (t) => {
      if (!t) return;
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t },
      })}\n\n`);
    };
    // All cards, in answer order, as ONE trailing text delta. Nothing is written after
    // this, so the cards are always the tail of the reply. The client's tag scanner is a
    // global regex (index.html:1264-1267), so adjacent tags each become their own chip;
    // the '\n' between them is trimmed to empty and never becomes a text segment.
    const emitCanonicalSources = () => {
      if (emitted) return;
      emitted = true;
      console.log('[source] appending verified cards', {
        count: canonicalSources.length,
        hosts: canonicalSources.map((c) => c.host),
      });
      writeText(canonicalSources.map((c) => c.tag).join('\n'));
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        let idx;
        // '\n' (0x0A) can never occur inside a UTF-8 multi-byte sequence, so splitting on
        // the raw bytes can never cut a character in half.
        while ((idx = pending.indexOf(SEP)) !== -1) {
          const whole = pending.subarray(0, idx + SEP.length);   // frame + its separator
          const evt = readSseFrame(pending.subarray(0, idx));
          pending = pending.subarray(idx + SEP.length);
          if (evt && evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
            writeText(filter.push(evt.delta.text));   // model <source> tags never survive this
          } else {
            if (evt && evt.type === 'message_stop') {
              writeText(filter.end());
              emitCanonicalSources();
            }
            res.write(whole);                          // every other frame relayed verbatim
          }
        }
        if (pending.length > MAX_PENDING) { res.write(pending); pending = Buffer.alloc(0); }
      }
      // Unexpected end (no completion frame). Flush the prose the filter still holds, but
      // do NOT append a card: a source under a possibly truncated answer would read as a
      // completed, attributed ruling that we cannot stand behind.
      writeText(filter.end());
      if (pending.length) res.write(pending);
    } finally {
      res.end();
    }
  } catch (error) {
    console.error('[ask] handler error', error?.message);
    clearKeepAlive();
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    try { res.write(`data: ${JSON.stringify({ type: 'error', error: { message: 'server error' } })}\n\n`); } catch {}
    res.end();
  }
}
