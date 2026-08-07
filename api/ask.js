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

import { checkAskLimit, MAX_CHAT_BODY_BYTES, MAX_CHAT_TOKENS, applyCorsOrigin } from '../lib/ratelimit.js';
import { guardAIConsent, AI_CONSENT_ALLOW_HEADERS } from '../lib/ai-consent.js';
import { guardDayCap, dayCapMessage, hasValidFounderToken } from '../lib/daycap.js';
import { ASK_LIMIT_MESSAGE } from '../lib/limit-message.js';
import { classifyRoute, createSourceFilter, isReligiousText } from '../lib/route-classify.js';
import { verifyAttributedReply } from '../lib/attribution.js';
import { planAsk, unattributedNote, REASON, ambiguousScholarPrompt, NEEDS_MATERIAL } from '../lib/ask-plan.js';
import { consistencyProblems, screenDraft, NO_ATTRIBUTION_AVAILABLE } from '../lib/policy/consistency-gate.js';
import { sourcesAddressingSubject, phraseVariants, buildClaimInstruction, verifyClaims, CLAIM_REFUSAL } from '../lib/claim-gate.js';
// THE PARALLEL PATH'S SWITCH, AND ONLY THE SWITCH. lib/ledger/flag.js is a few env reads and,
// when the env floor is open, one short-TTL Redis read; the ENGINE itself (and linkedom,
// Readability, the planner) is imported lazily inside the branch below, so a request that takes
// the shipped path loads none of it.
import { decidePath } from '../lib/ledger/flag.js';
// Deliberately a SECOND import from the same module rather than widening the line above:
// ledger-contract-guard.cjs pins that import verbatim, and the pin is worth more than the tidiness.
import { envMode } from '../lib/ledger/flag.js';
// THE SHARED POLICY CORE (RFC v0.5-R2 §3). The SAME tables the ledger path reads — not a copy,
// and not a second opinion. What lives here is data and pure evaluators: the topic x audience
// matrix, the deterministic child floor, and the sentence shapes an attribution grade may take.
// guards/rfc-v05r2-guard.cjs asserts both paths consume one policy_version.
import { classifyTopic, graveHazard, WARM_TEMPLATES, POLICY_VERSION } from '../lib/policy/core.js';
import { access, resolveAudience, repair as ageRepair, warmTemplateFor } from '../lib/policy/age.js';
import { violatesTemplate } from '../lib/policy/attribution-grades.js';
// WHO THE PAGES IN HAND LICENSE NAMING. Four ordered tiers — extracted byline, domain owner, the
// name in the text, nobody — and no model call anywhere in it. The ledger's Gate 3 reads the same
// module, so the two paths cannot disagree about the same result set.
import { attributionLicence } from '../lib/policy/source-attribution.js';
// THE REFERRAL TO AHL AL-'ILM, OWNED BY THE SERVER. The system prompt has always ASKED the model
// for it, and an instruction is a request — it was omitted most reliably on the answers that read
// most confidently. It is appended here instead, rotated so successive answers do not end
// identically, and NEVER on the frozen acts of worship.
import { referralTail, referralOnce } from '../lib/policy/referral-tail.js';
// The registry's Arabic publisher name, so the transmission can be checked for naming the source
// it transmits from rather than gesturing at "some websites".
import { findSource } from '../lib/source-registry.js';
import { unregisteredNameInQuestion, stripEntityFromQuery } from '../lib/policy/entity-knowledge.js';
// DOES THIS NAME EXIST AT ALL? A replacement BY EVIDENCE for the deleted model-verdict identity
// check: one bounded look-up on the app's own world list, read as a page with a card and never as
// a verdict. It grants nothing — no attribution, no grade, no list membership. See the module head
// for the exhaustive list of the two things a found page is allowed to change.
import {
  probeShape, firstPageBearing, presenceLine, buildIdentityInstruction, PRESENCE,
} from '../lib/policy/name-presence.js';
import { lastUserText } from '../lib/attribution.js';
// THE ROLLOUT SWITCH FOR THE LEGACY REPAIRS. Default OFF, same shape as the ledger switch, and
// it reads nothing from the store for a reader who is not an internal tester.
import { decideLegacyPolicy } from '../lib/legacy-policy-flag.js';
// LIVE WORLD RETRIEVAL — the news/current-affairs classifier. Pure and lexical, like
// lib/route-classify.js: it decides whether a question the router already called GENERAL is
// one a live search can answer. It never sees a religious turn (those are DEEN), and refuses
// one on its own account if it ever did.
import { classifyWorldIntent } from '../lib/world-intent.js';
// A takhrij nobody published is never emitted. See lib/takhrij-lock.js for the measured incident.
import { lockTakhrij } from '../lib/takhrij-lock.js';

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

// THE BOUNDED EDUCATIONAL BLOCK FOR A BENIGN CHILD QUESTION (RFC v0.5-R2 §10).
//
// IT IS NOT THE SAFETY GUARANTEE, and that separation is the point. This asks for the answer we
// want; lib/policy/age.js's deterministic floor decides whether we got it. A prompt cannot be the
// guarantee, because the thing being asked to obey it is the thing being bounded by it — and the
// measured failure was in the other direction anyway: a seven-year-old asking how to make a lip
// balm was met with «اسألي والدتك» and nothing else, which is not safety, it is abandonment.
const CHILD_BENIGN_INSTRUCTION = [
  'هذا سؤالٌ يوميٌّ بسيطٌ من طفل، وليس سؤالًا شرعيًّا. أجِبْ عنه إجابةً نافعةً دافئةً قصيرةً بلغةٍ سهلة.',
  '- أجِبْ فعلًا عن السؤال. لا تكتفِ بإحالته إلى أهله، ولا تردّه ردًّا باردًا.',
  '- جملتان إلى أربع جُمَل، بكلماتٍ يفهمها طفل.',
  '- اقتصِرْ على موادَّ لطيفةٍ ومتوفّرةٍ في البيت وآمنةٍ على جلد الطفل.',
  '- ممنوعٌ منعًا باتًّا: الليمون، القرفة، الخلّ، الزيوت العطريّة، بيكربونات الصوديوم، الكحول، وأيُّ فركٍ قاسٍ أو موادَّ خشنة.',
  '- ممنوعٌ ذكرُ أيِّ دواءٍ أو جرعةٍ أو مقدارٍ علاجيٍّ أو عددِ مرّاتٍ في اليوم.',
  '- نبِّهْ على تجربة أيِّ شيءٍ جديدٍ على جزءٍ صغيرٍ من الجلد أوّلًا خشيةَ الحساسيّة.',
  '- واذكرْ إشراكَ أحدِ الوالدين قبل أيِّ مادّةٍ جديدة — إشراكًا داعمًا لا صدًّا.',
  '- لا تُصدِرْ حكمًا شرعيًّا، ولا تُعطِ تشخيصًا، ولا تكتبْ وسمَ <source> ولا أيَّ رابط.',
].join('\n');

// ── THE WORLD-SEARCH DRAFTING NOTE (P0, live world retrieval) ────────────────
//
// WHAT IT REPLACES. Nothing was ever instructed to apologise for a training cut-off — no such
// sentence exists anywhere in this repository, and the shipped system prompt says nothing
// about dates, the internet or the model's own limits. The apology was the model's own
// default, reached because the general route runs with NO tools and there was therefore
// nothing else to say. The fix is not a deletion, then; it is this: the material is fetched
// first, and the model is told plainly that it is holding it.
//
// THE SECOND HALF IS THE IMPORTANT ONE. These pages are news and encyclopedia pages, and the
// single thing that must never happen is a religious ruling being derived from one. That is
// forbidden here in as many words — and it is not the only line of defence: every one of these
// domains carries `scopes: []` in lib/source-registry.js, so it is refused for every religious
// purpose the retrieval layer knows, and the religious lists are never searched on this branch.
// This instruction is the third layer, and the only one the reader's eye ever meets.
//
// Injected per-request into the messages array, NOT into the cached system prefix, for the same
// reason the depth instruction is: it varies per request and would otherwise bust the cache.
function buildWorldSearchInstruction(material, band) {
  const childNote = (band === 'young' || band === 'teen')
    ? ['- المخاطَبُ صغيرٌ أو يافع: انقلِ الخبرَ بلغةٍ بسيطةٍ هادئة، ولا تصفْ مشاهدَ عنفٍ أو دماءٍ أو تفاصيلَ مروّعة، واقتصِرْ على أصلِ الخبر.']
    : [];
  return [
    'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
    'أنت الآن تُجيب من مصادرَ إخباريّةٍ وعامّةٍ مُعتمَدةٍ استُرجِعت للتوّ، لا من ذاكرتك. وهذه هي المادّةُ المسترجَعة:',
    '',
    material,
    '',
    'اكتبْ جوابًا يلتزم بما يلي حرفيًّا:',
    '- ⛔ يُمنع منعًا باتًّا استنباطُ أو إصدارُ أيِّ حكمٍ شرعيٍّ أو دينيٍّ أو فتوى من هذه المصادر العامّة. فإنِ انجرَّ السؤالُ إلى حكمٍ شرعيّ، فقلْ إنّ ذلك سؤالٌ مستقلٌّ يُبحَثُ في المصادرِ الشرعيّةِ المعتمدة، وادعُ السائلَ إلى طرحِه وحدَه.',
    '- ⛔ ولا تنسبْ إلى عالمٍ ولا إلى هيئةٍ شرعيّةٍ قولًا أو فتوى من هذه المصادر البتّة.',
    '- أجِبْ في حدودِ المعلومةِ المجلوبةِ أعلاه وحدَها، ولا تُكمِلْ من معرفتِك السابقة، ولا تُضِفْ رقمًا ولا تاريخًا ولا اسمًا لم يَرِدْ فيها.',
    '- انسبِ الخبرَ إلى المصدرِ الذي ورد فيه باسمِه («بحسب الجزيرة نت…»)، واذكرْ تاريخَه إن ورد.',
    '- لا تعتذرْ بأنّ معرفتَك تتوقّفُ عند تاريخٍ معيّن، ولا تقلْ إنّك لا تستطيعُ الوصولَ إلى الإنترنت أو تصفُّحَ الأخبار؛ فالمادّةُ بين يديك الآن. ولا تصفْ عمليّةَ بحثِك.',
    '- إن كانتِ المادّةُ لا تُجيبُ عن السؤال، فقلْ ذلك صراحةً ولا تخترعْ خبرًا.',
    ...childNote,
    '- لا تكتبْ وسمَ <source> ولا أيَّ رابط؛ التطبيقُ يُضيفُ بطاقةَ المصدر بنفسه.',
  ].join('\n');
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

// ── ATTRIBUTED-SOURCE RANKING ────────────────────────────────────────────────
// Chooses WHICH of the Shaykh's own pages a question is about. Nothing more.
//
// WHY A MODEL CALL IS HERE AT ALL, given that this whole feature exists because the model's
// memory produced a false fatwa. Two different jobs are being kept apart:
//   * WHAT HE RULED is decided by the retrieved text and by the programmatic gates in
//     lib/binothaimeen.js and lib/attribution.js. The model may not contribute a word of it.
//   * WHICH PAGE IS ABOUT THIS QUESTION is a relevance judgement over titles the site itself
//     returned. MEASURED: the question "فيمن أسقطت دون 80 يوم" reduces to the search words
//     "فيمن أسقطت", which six of his fatwas match equally — the discriminating fact is that
//     eighty days falls inside the second month, and no string comparison knows that.
// The ranker sees titles only, can only name an id the site already returned, and whatever it
// names still has to clear every gate afterwards. If it fails, times out, or answers with
// something that is not in the pool, the deterministic ordering stands — and that ordering
// refuses outright when the top two candidates are indistinguishable.
const RANK_TIMEOUT_MS = 8000;
async function rankCandidates(question, candidates, model, headers) {
  if (!Array.isArray(candidates) || candidates.length < 2) return undefined;
  const list = candidates.map((c, i) => `${i + 1}. ${c.title}`).join('\n');
  const prompt = [
    'السؤال:',
    String(question || '').slice(0, 600),
    '',
    'وهذه عناوينُ فتاوى منشورةٍ للشيخ:',
    list,
    '',
    'أيُّ عنوانٍ منها يُعالِج المسألةَ المسؤولَ عنها بعينِها؟',
    'أجِبْ برقمِ العنوان وحدَه، أو بكلمة NONE إن لم يكن فيها ما يُعالِجُها.',
    'لا تشرحْ، ولا تذكرْ حكمًا، ولا تختَرْ عنوانًا قريبَ الموضوعِ لكنّه في مسألةٍ أخرى.',
  ].join('\n');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), RANK_TIMEOUT_MS);
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      signal: ctl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 16,
        system: 'أنت مُصنِّفٌ يختارُ عنوانًا واحدًا من قائمة. لا تُفتِ ولا تشرح.',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    clearTimeout(timer);
    if (!r.ok) { console.warn('[attribution] ranker HTTP', r.status); return undefined; }
    const payload = await r.json();
    const said = (payload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (/NONE/i.test(said)) return null;            // an explicit "none of these" ⇒ refuse
    const m = said.match(/\d+/);
    if (!m) return undefined;                        // unparseable ⇒ deterministic order stands
    const idx = parseInt(m[0], 10) - 1;
    if (!(idx >= 0 && idx < candidates.length)) return undefined;
    console.log('[attribution] ranker chose', idx + 1, candidates[idx].title);
    return candidates[idx].id;
  } catch (e) {
    clearTimeout(timer);
    console.warn('[attribution] ranker failed:', e && e.message);
    return undefined;
  }
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
// A refusal that says why, and about which page. MEASURED, batch 4: an answer came back
// with zero cards and the log held nothing at all, so "the provider returned nothing" and
// "we fetched three good pages and could not encode any of them" looked identical from the
// outside. They are opposite bugs. The return value is unchanged — a refused card is still
// exactly `null`, which is the contract source-registry-guard.cjs depends on; the only thing
// added is the line.
function dropCard(reason, raw) {
  const where = raw == null ? '(no url)' : String(raw).slice(0, 200);
  console.warn(`[card] drop ${reason} — ${where}`);
  return null;
}

export function buildSourceTag(src) {
  if (!src || typeof src.url !== 'string') return dropCard('no-url', src && src.url);
  const raw = src.url.trim();
  if (!raw) return dropCard('empty-url', src.url);

  let u;
  try { u = new URL(raw); } catch { return dropCard('unparseable-url', raw); }
  // https ONLY. This is also what rejects javascript:, data:, file: and bare http:.
  if (u.protocol !== 'https:') return dropCard('not-https', raw);

  const host = (u.hostname || '').toLowerCase().replace(/^www\./, '');
  // Plain dotted hostname. No userinfo, no IP-literal brackets, no stray punctuation.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return dropCard('bad-host', raw);
  }
  if (u.username || u.password) return dropCard('userinfo-in-url', raw);

  // WHATWG href already percent-encodes " < > and whitespace; the apostrophe is not
  // encoded but WOULD close the attribute early under the client's [^"']+ class, so
  // encode it explicitly, then refuse anything still hostile to the grammar.
  const url = u.href.replace(/'/g, '%27');
  if (/["'<>\s]/.test(url)) return dropCard('hostile-char-in-url', raw);

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
  const input = sources || [];
  let considered = 0;
  for (const s of input) {
    if (out.length >= limit) break;
    considered++;
    const built = buildSourceTag(s);   // says its own reason if it refuses
    if (!built) continue;
    const key = canonicalKey(built.url);
    if (!key) { console.warn(`[card] drop uncanonicalisable — ${built.url}`); continue; }
    if (seen.has(key)) { console.warn(`[card] drop duplicate — ${built.url}`); continue; }
    seen.add(key);
    out.push(built);
  }
  // THE LINE THAT TELLS THE TWO ZEROES APART. Zero cards from zero pages is a search that
  // found nothing — normal, and already logged upstream by lib/retrieve.js. Zero cards from
  // N pages is OUR encoder throwing away material a working search paid for, and before this
  // line it left no trace anywhere.
  if (considered > 0 && out.length === 0) {
    console.warn(`[card] none — ${considered} retrieved page(s) reached card-build and NOT ONE could be encoded`);
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
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-murabbi-device, x-murabbi-founder, ' + AI_CONSENT_ALLOW_HEADERS);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Apple 5.1.1(i). THIS is the route that reaches the most vendors: Anthropic for the answer,
  // and Brave for the search phrases derived from the reader's question. The guard runs before
  // the throttle, before the key is read, and before any planner or retrieval module is even
  // imported -- so an un-consented request produces no outbound call of any kind.
  if (!guardAIConsent(req, res)) return;

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
  // Anthropic call. MAX_CHAT_BODY_BYTES is the same measured 2MiB ceiling chat.js uses.
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
  // ── THE AGE BAND THAT GOVERNS POLICY, WHICH IS NOT THE ONE THAT GOVERNS SOURCES ──
  //
  // `band` above still does exactly what it did: it picks the retrieval allow-list, and an absent
  // or garbled value still fails CLOSED to the minor list. That is deliberately NOT touched here,
  // because widening a minor's sources is the one regression this whole RFC must not cause.
  //
  // `audienceBand` is a SEPARATE value used only by the policy core.
  //
  // AND IT IS A CLIENT CLAIM, WHICH IS WHAT IT IS NOW CALLED. This line used to read
  // `band ? 'account_profile' : 'unknown'`, which asserted a verification that never happened:
  // `band` is `deriveCaps(p.age).band` computed in the browser from `localStorage.child_profile`
  // and posted in the request body, so anyone with devtools can set it. This app has NO
  // server-authenticated age — the only server-verified identity is the founder HMAC, and it
  // carries no age at all.
  //
  // So the claim RESTRICTS and never RELEASES. A claimed `young`/`teen` is honoured, because
  // being wrong that way costs a misidentified adult a simpler answer while ignoring it costs a
  // real child their protection. A claimed `adult` gets exactly what `unknown` gets, so an
  // unverified claim can never be the reason anything opened. Nothing is inferred from the text.
  const audience = resolveAudience({ serverBand: null, clientBand: band });
  const audienceBand = audience.band;
  const audienceSource = audience.audienceSource;
  // ATTRIBUTION GATE (lib/attribution.js). Decided here, on the server, from the question's own
  // SHAPE — "ما رأي الشيخ فلان", "قال فلان", "هل أفتى فلان". It is computed BEFORE anything is
  // sent upstream because it overrides the route: an attributed question can never take the GEN
  // path, which is exactly how the reported defect happened. "ما رأي الشيخ ابن عثيمين فيمن
  // أسقطت دون ٨٠ يوم؟" contains not one word of DEEN_WORDS, so it classified GEN, ran with no
  // tools and no retrieval, and the model answered a fatwa from memory — inverted, and with no
  // card, because the GEN branch strips every source tag.
  // STAGE A — a DESCRIPTION of the request, not a decision about it (lib/ask-plan.js). It
  // composes the classifiers this project already has: purpose, attribution shape, the
  // specific-expression subject, and the scholar-to-domain mapping. Reading a name out of the
  // question no longer ends the search; it starts a more specific one.
  // ── THE ROLLOUT SWITCH, AND WHAT IT NO LONGER HOLDS BACK ──────────────────
  //
  // It was written to stage a rollout: env floor, server-verified founder credential, runtime value
  // in the store, short TTL, bounded read, every failure reads as OFF. That is the right shape for
  // shipping a NEW BEHAVIOUR to readers in stages — a new child policy, a new safety triage.
  //
  // IT IS THE WRONG SHAPE FOR A REPAIR. Everything below it was also a correction of a measured
  // defect: a mosque asked to name which shaykh it meant, a seven-century-dead scholar asked for
  // «رابط موقعه الرسمي», an answer that credited a man and disclaimed him in the same breath. With
  // the flag default-OFF and off on every failure to read it, fresh production — zero env, no
  // store — served every one of those defects, and the repair sat behind a switch nobody had
  // thrown. A staged rollout of a bug fix is a bug that is still shipping.
  //
  // So the corrections are unconditional and the flag governs the Ledger engine alone. The value is
  // still decided and still reported in telemetry below, because "which readers were on which
  // path" must stay measurable — it simply no longer decides whether a wrong answer goes out.
  const legacyPolicy = await decideLegacyPolicy(req);
  const plan = planAsk(body.messages, { policyEnabled: true });
  const attribution = plan.attribution;
  const claimSubject = plan.claimSubject;
  // A NAME OVERRIDES THE ROUTE, BUT IT DOES NOT REPLACE THE SEARCH. «ما رأي الشيخ ابن عثيمين
  // فيمن أسقطت دون ٨٠ يوم؟» contains not one DEEN word, so the lexical router calls it GEN —
  // and GEN runs with no tools and no retrieval, which is how the original inverted fatwa was
  // produced. Anything naming a scholar or a scholar's site is therefore forced onto the
  // sourced route, whichever way it ends.
  // A QUESTION ABOUT A SCHOLAR IS A SOURCED QUESTION TOO. «هل خالف ابن تيمية أهل السنة؟» asks
  // something the app must answer from a page, not from the model's recollection of a polemic —
  // so ABOUT_ENTITY joins the named-opinion shapes in forcing the sourced route, even though it
  // attributes nothing to anybody and takes none of the attribution branches below.
  // THE TWO NEW RELATIONS ARE NOT BEHIND THE FLAG EITHER, and specifically because the branch that
  // consumes them is not: with the flag off «هل خالف ابن تيمية أهل السنة؟» took the GEN route and
  // returned from it long before reaching the buffered ABOUT_ENTITY handler below, which made that
  // handler unreachable code dressed up as a safeguard. Routing and handling are one repair.
  // ── A RELIGIOUS QUESTION DOES NOT TRAVEL A PATH WITH NO SOURCE ────────────
  //
  // MEASURED: explicit religious questions — «ما معنى الإحسان؟», «اشرح لي معنى التوكل» — were
  // classified GEN, and the GEN branch runs ONE streamed model call with no tools and strips every
  // <source> tag on the way out. So the reader got a religious answer from the model's memory, with
  // no retrieval and no card, on exactly the subjects this app exists to transmit rather than
  // compose.
  //
  // THE SAME PREDICATE lib/world-intent.js ALREADY TRUSTS. There, isReligiousText() is rule 1 and
  // it OVERRIDES every news trigger: a message that names a religious subject is not a world
  // question whatever else it says. Here it does the mirror job — a message that names a religious
  // subject is not a sourceless question whatever the lexical router made of the sentence. One
  // predicate, both directions, so the two cannot drift into disagreeing about the same message.
  //
  // It reads the LAST USER MESSAGE, which is what world-intent.js is handed too. classifyRoute()
  // above additionally inherits context across turns and is unchanged; this only ever ADDS to what
  // it decided, and can never turn a DEEN turn into a GEN one.
  const effectiveRoute = (plan.attributionMode !== 'none'
    || plan.claimRelation === 'ABOUT_ENTITY' || plan.claimRelation === 'BY_MADHHAB'
    || isReligiousText(lastUserText(body.messages)))
    ? 'DEEN' : route;
  console.log('[route]', {
    route: effectiveRoute, lexicalRoute: route, band,
    purpose: plan.purpose, mode: plan.attributionMode,
    entity: plan.namedEntity || null, officialDomain: plan.officialDomain || null,
  });

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

  // ONE WAY OUT, USED BY EVERY DETERMINISTIC BRANCH BELOW. The headers are already committed at
  // this point, so this is not sendSynthesizedText(): it writes one text delta, one message_stop
  // and closes ONCE. Every early return in this handler goes through it, which is what keeps the
  // SSE contract identical no matter how many new branches exist.
  // ── EVERY PAGE THIS REQUEST ACTUALLY FETCHED, IN ONE PLACE ────────────────
  // The takhrij lock turns on one question — is this attribution ON a page we read? — and that
  // question has nowhere to be asked unless the pages are reachable from the emission point.
  // Every retrieval below hands its result to `remember()`, which returns it unchanged.
  const fetchedPages = [];
  // COUNTED, NEVER ACTED ON — the shipped path's answer to the ledger's `injection_markers_seen`
  // (lib/ledger/schema.js). lib/retrieve.js fences every retrieved page in wrapUntrusted and
  // reports which marker shapes it saw; this is where the request as a whole adds them up, so a
  // page that tried to talk to the model leaves a number in the log instead of only a fence.
  const injectionMarkersSeen = [];
  const remember = (r) => {
    if (r && Array.isArray(r.sources)) fetchedPages.push(...r.sources);
    if (r && Array.isArray(r.injectionMarkers)) injectionMarkersSeen.push(...r.injectionMarkers);
    return r;
  };

  // ── THE SEAL ON EVERY BUFFERED REPLY ──────────────────────────────────────
  // A hadith left this app marked «رواه البخاري ومسلم» over pages that never said so. Nothing
  // between the draft and the wire asked whether the attribution was published anywhere, so it is
  // asked here, on the finished text, deterministically and at no cost. It strips the unsupported
  // credit and keeps the matn; the frozen texts are exempt inside lib/takhrij-lock.js.
  //
  // A template, a refusal or a card carries no takhrij, so for those this returns its input
  // byte-for-byte — which is why it is safe to put on the one path they all share.
  const seal = (text) => {
    const locked = lockTakhrij(String(text == null ? '' : text), fetchedPages);
    if (locked.removed.length || locked.droppedSentences.length) {
      console.warn('[takhrij] unsupported takhrij removed:', {
        removed: locked.removed.map((r) => r.kind).join(','),
        dropped: locked.droppedSentences.length,
      });
    }
    return locked.text;
  };

  const emitOnce = (text) => {
    clearKeepAlive();
    res.write(`data: ${JSON.stringify({
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: seal(text) },
    })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
    return res.end();
  };

  try {
    // ── NARROW_SAFETY_TRIAGE (RFC v0.5-R2 §4) ──────────────────────────────
    //
    // THE ONLY THING ALLOWED TO DECIDE ANYTHING BEFORE THE QUESTION IS UNDERSTOOD, and it is kept
    // narrow enough to earn that: it fires only on a CONJUNCTION — an action and a hazardous
    // material, or an explicit self-harm phrase. It cannot fire on «ما حكم قتل النمل؟», because a
    // single alarming word satisfies no conjunction. That is the whole difference between this
    // and a keyword blocklist, and it is why «قتل» no longer costs a seven-year-old a fiqh answer.
    //
    // A grave hazard is redirected for EVERY band. An adult asking how to make chlorine gas in a
    // kitchen has not asked a different question by being an adult.
    // ── WHICH PATH, DECIDED FIRST ──────────────────────────────────────────
    //
    // decidePath is read BEFORE the safety triage now, and that ordering is the P0-1 fix: the
    // triage has to know whether this request is going to the ledger, because the ledger's own
    // safety cannot depend on an unrelated legacy flag being switched on as well.
    //
    // THE CLOCK STARTS HERE, before the runtime flag is read. decidePath() talks to Upstash, and a
    // budget constructed afterwards would leave that read outside the deadline it exists to
    // enforce. lib/ledger/flag.js bounds the read itself; this makes it COUNTED as well.
    const ledgerStartedAt = Date.now();
    const ledgerPath = await decidePath(req);
    const toLedger = ledgerPath.path === 'ledger';

    // ── THE PATH INDICATOR, FOR AN INTERNAL TESTER ─────────────────────────
    //
    // A tester could not tell which engine answered. The source card does not say — both paths
    // emit one — so a routing failure and an identity failure looked identical, and the wrong one
    // got debugged. This states the engine outright.
    //
    // It is an SSE COMMENT, which is the same channel the keepalive uses: the client parser
    // ignores any block with no `data:` line (index.html handleEvent), so no reader ever sees it
    // and no client behaviour changes. `curl` shows it immediately.
    //
    // NOTHING SECRET CROSSES IT. Two constant words — `legacy` or `ledger` — and never the
    // question, the credential, the flag value, or the reason code, because telling an
    // unauthenticated prober WHY a request stayed on the shipped path is telling them what to
    // forge. It is emitted only while the rollout mode is `internal`, so the public build has no
    // such line at all.
    if (envMode() === 'internal') {
      try { res.write(`: rfc-path=${toLedger ? 'ledger' : 'legacy'}\n\n`); } catch {}
    }

    // ── THE PROTECTIONS ARE NOT CONDITIONAL ON ANYTHING ────────────────────
    //
    // There used to be a `policyActive = legacyPolicy.enabled || toLedger` in front of the hazard
    // triage, the health referral and the child floor. Both halves of that disjunction are
    // ROLLOUT facts — which cohort this reader is in, which engine took the request — and neither
    // has anything to do with whether a seven-year-old should be told how to make chlorine gas.
    //
    // MEASURED, NOT ARGUED. With `LEDGER_RAG=off` — the documented brake, an operator's normal
    // move — `toLedger` is false and the flag is default-off, so `policyActive` was false and ALL
    // THREE branches were skipped: «كيف أخلط مواد التنظيف عشان تسوي فوران؟» from a young reader
    // reached the model unfiltered and came back answered. Pulling one lever about search engines
    // silently disabled child safety.
    //
    // So they run on the question and the band alone. No env var, no store value, no path, no
    // cohort. `toLedger` still decides which ENGINE answers; it no longer decides whether anyone
    // is looking after the reader.
    const questionText = lastUserText(body.messages);
    const hazard = graveHazard(questionText);
    if (hazard) {
      console.warn('[policy] SAFETY_REDIRECT', {
        topic: hazard, band: audienceBand, path: ledgerPath.path, policyVersion: POLICY_VERSION,
      });
      return emitOnce(WARM_TEMPLATES.SAFETY_REDIRECT);
    }

    // ── AGE_ACCESS_POLICY, AFTER IR_BUILD AND BEFORE THE ROUTE ─────────────
    //
    // planAsk() ran above, so the question is understood by the time this decides anything —
    // which is what lets «ما حكم قتل النمل؟» be classified as a ruling a child may have rather
    // than blocked on a word. It used to sit AFTER the ledger branch, so the engine swallowed a
    // child's benign or health question before any age policy saw it.
    // ── IS THE NAME IN THIS QUESTION ONE THE REGISTRY KNOWS? ───────────────
    //
    // WHAT USED TO BE HERE. One model call asking open world knowledge «is this name a scholar?»,
    // whose confident «no» removed the attribution path and told the reader who the man really was.
    //
    // WHY IT IS GONE. Only the «not a scholar» branch was ever hardened. When the call said,
    // wrongly, «yes, he is a scholar», nothing doubted it — and that is the direction it was
    // measured failing in: «ما رأي طارق العلي في أحكام العدة؟» came back «داعية وخطيب كويتي معروف
    // من أهل العلم … يتبنّى المذهب الحنفي», over a khutbah page that does not contain his name. He
    // is a comic actor. A yes/no oracle checked on one of its two answers is not a safety
    // mechanism, and its safety has moved somewhere that reads pages instead of recollections:
    // lib/policy/source-attribution.js, wired into every buffered exit above.
    //
    // WHAT IS LEFT IS DETERMINISTIC AND COSTS NOTHING. A name no registry and no roster knows is
    // stripped out of the search query, because the sources hold the ruling and nobody publishes
    // what an unregistered name thinks of it.
    const unregisteredName = unregisteredNameInQuestion(plan);
    if (unregisteredName) console.log('[entity] unregistered name — it will not travel in the query');

    const topicClass = classifyTopic(questionText, plan);
    const ageAccess = access({ topicClass, audienceBand });
    console.log('[policy]', {
      topicClass, audienceBand, audienceSource, outcome: ageAccess.outcome,
      sourcePolicy: ageAccess.sourcePolicy, relation: plan.claimRelation, path: ledgerPath.path,
      policyVersion: POLICY_VERSION, policyEnabled: legacyPolicy.enabled, flag: legacyPolicy.reason,
    });

    // ── THE REFERRAL THE SERVER OWNS ───────────────────────────────────────
    //
    // Computed once, here, because it depends only on the question and the class the server has
    // just decided — never on what the model produced. It is appended at the exits that carry a
    // real sourced answer, ahead of the source cards; a template, a refusal and a safety redirect
    // get nothing, because there is no ruling under them to refer.
    //
    // ROTATED ON THE CONVERSATION'S OWN TURN COUNT. Two answers in a row must not end with the
    // same sentence, or the sentence stops being read — which is the whole failure a fixed footer
    // walks into. Deterministic, no store, no model call.
    const answersSoFar = (body.messages || []).filter((m) => m && m.role === 'assistant').length;
    const referral = referralTail(questionText, topicClass, answersSoFar);
    // ── APPENDED ONCE, HOWEVER MANY EXITS THERE ARE ───────────────────────
    // MEASURED: «ما حكم بيع الذهب بالتقسيط؟» ended with the referral TWICE — the system prompt
    // still asks the model for one, and the server appended its own on top of it. So the block is
    // no longer a fixed string that every exit concatenates blindly; it is a function OF THE DRAFT,
    // and it returns '' when that draft already sends the reader to ahl al-'ilm. Every exit below
    // calls it, which is what makes "once" a property of the reply rather than of the branch.
    const referralBlockFor = (draft) => referralOnce(draft, referral);
    if (referral) console.log('[referral] appending the server\'s tail', { topicClass, turn: answersSoFar });

    // ── GENERAL_HEALTH_INTERIM ─────────────────────────────────────────────
    // Until this app has a health ledger of its own, a dose, a diagnosis and a child's symptoms
    // are not answered from a model. The referral is WARM and explains itself: a wall teaches a
    // child nothing and sends them to a worse source, which is the opposite of safety.
    if (ageAccess.outcome === 'REFER_ADULT') {
      console.warn('[policy] GENERAL_HEALTH_INTERIM referral', { topicClass, band: audienceBand });
      return emitOnce(warmTemplateFor('GENERAL_HEALTH_INTERIM'));
    }

    // ── GENERAL_CHILD_BENIGN (RFC v0.5-R2 §10) ─────────────────────────────
    //
    // A small, reviewed list of low-risk everyday topics, answered in ONE model call — the same
    // one the GEN route already spends, not an extra one — and then put through the deterministic
    // floor. The reply is BUFFERED for exactly the reason the attributed route is: bytes already
    // on a child's screen cannot be withdrawn when the floor refuses them.
    //
    // It runs BEFORE the ledger branch. A seven-year-old asking how to make a lip balm has not
    // asked a question the retrieval engine can answer, and letting the engine take it spends
    // provider calls to arrive at «لم أعثر».
    //
    // A floor failure does not automatically cost the child the answer. A draft that is merely
    // INCOMPLETE — it forgot the patch test, it forgot to bring a parent in — is completed
    // deterministically from fixed sentences this server owns. A draft that told them to rub
    // lemon on their lips is discarded whole, because a warning bolted onto the end of a harmful
    // instruction is still the harmful instruction.
    // 🩸 THE THIRD CLAUSE IS GONE, AND IT WAS THE DEFECT. It read
    // `&& (toLedger || effectiveRoute === 'GEN')`, and `toLedger` (line ~739) is decidePath() —
    // an env flag AND an Upstash read. So the floor a child gets was a function of which engine
    // the request happened to be routed to and whether a store answered. A seven-year-old asking
    // «كيف أرتب غرفتي وأنا في رمضان؟» classifies GENERAL_CHILD_BENIGN, but the word رمضان routes
    // it DEEN — so with the ledger off, the third clause was false and the child fell through to
    // the adult path with NO floor at all. Two children, same question, different protection,
    // decided by a flag neither of them can see.
    //
    // A safety floor may not be conditional on infrastructure. It now depends on exactly what it
    // is about: this is a child, and the policy called the topic benign. Nothing else. The rest of
    // the condition is untouched, and this branch still runs BEFORE the ledger branch and before
    // the streamed GEN branch, so neither can shadow it.
    if (ageAccess.sourcePolicy === 'GENERAL_CHILD_BENIGN'
      && (audienceBand === 'young' || audienceBand === 'teen')) {
      const gc = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: appendDepthBlock(system, CHILD_BENIGN_INSTRUCTION),
          messages: body.messages,
          stream: false,
        }),
      });
      if (!gc.ok) {
        const errText = await gc.text().catch(() => '');
        console.error('[policy] child upstream', gc.status, errText.slice(0, 200));
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${gc.status}` } })}\n\n`);
        return res.end();
      }
      const gcPayload = await gc.json();
      const gcDraft = (gcPayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
        .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
        .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
        .trim();
      const rep = ageRepair(gcDraft, { topicClass, audienceBand });
      // THE FLOOR STAMP. A benign child reply that cannot show the floor ran is indistinguishable
      // from one that skipped it, so the outcome is recorded on every single one.
      console.log('[policy] AGE_FLOOR', {
        topicClass, band: audienceBand, ageFloorOutcome: rep.outcome,
        repaired: rep.repaired, problems: rep.problems,
      });
      // A DISCARDED DRAFT FALLS BACK TO THE CHILD LINE, not to the hazard redirect. The redirect
      // answers a question this child did not ask and reads to them as an accusation.
      return emitOnce(rep.text || warmTemplateFor('GENERAL_CHILD_BENIGN'));
    }

    // ── DOES THIS NAME EXIST AT ALL? ONE BOUNDED LOOK-UP, READ AS A PAGE ───
    //
    // THE MEASURED DEFECT. A name nobody knows — including one invented on the spot — was treated
    // as a shaykh: «ما رأي الشيخ فلان الفلاني في كذا؟» came back «لم أقف على قولٍ للشيخ…», which
    // concedes the title in the sentence that withholds the fatwa. And the shared refusal said «لا
    // أنسبُ إلى هذا العالِم قولًا…» about a singer and about a comic actor.
    //
    // AND THE CONSTRAINT IT IS BUILT UNDER. The old identity check was DELETED because it asked a
    // model «is this name a scholar?» with nothing behind the answer, and the measured failure was
    // a confident wrong «yes» that nothing doubted. This is not that check returning. There is no
    // model call: the app's own world list is searched ONCE for the name, and the result is read
    // as a page — does a page carry this name, yes or no.
    //
    // WHAT A FOUND PAGE BUYS, AND IT IS THE WHOLE LIST: «من هو فلان؟» may be answered from that
    // page with its card instead of being pushed at a religious corpus that never held him; and a
    // refusal may say «ليس ممّن تُؤخَذ عنه الفتوى في مصادرنا» rather than «هذا العالِم». It opens no
    // attribution, raises no provenance grade and adds no domain to any list — the rule of the
    // third batch stands exactly where it stood.
    //
    // WHERE IT SITS, AND WHY. After the hazard triage, the age access policy and the child-benign
    // floor have all had their say, so a child's benign question never pays for it and no age rule
    // is bypassed; before the ledger and DEEN branches, because both of them RETURN.
    //
    // COST. It fires only on a name NO registry knows, in a question shaped as an attribution or
    // as «من هو». One search, one wave. A registered name (ابن باز) never reaches it at all.
    //
    // AND A SEARCH THAT NEVER RAN MAY NOT BECOME AN ABSENCE. Without a provider key, retrieval
    // returns an empty result set that is indistinguishable from a real empty search — and saying
    // «لا أعرف هذا الاسم» on that would be the negation-without-search this codebase refuses
    // everywhere else. So the probe is skipped outright and no line is emitted either way.
    const nameShape = probeShape(questionText, unregisteredName);
    let namePresence = { probed: false, name: '', kind: PRESENCE.NOT_PROBED, found: false, page: null };
    if (nameShape.probe && process.env.BRAVE_API_KEY) {
      let page = null;
      let ran = true;
      try {
        const { retrieveWorld } = await import('../lib/retrieve.js');
        // ONE wave, three candidates. The bound IS the feature: this look-up may never grow into a
        // second retrieval budget beside the one the answer itself spends.
        //
        // AND DELIBERATELY NOT `remember()`ed. `fetchedPages` is the pool of RELIGIOUS evidence the
        // takhrij lock and the ترجيح screen read; a news or encyclopedia page is «دليلٌ لا حكم» and
        // must never end up in it, or a preference printed on Wikipedia could license one in a
        // fatwa. This page reaches exactly one place — the identity answer below — and no further.
        const w = await retrieveWorld(nameShape.name, { maxWaves: 1, maxResults: 3 });
        page = firstPageBearing(nameShape.name, (w && w.sources) || []);
      } catch (e) {
        console.warn('[name-presence] probe threw:', e.message);
        ran = false;
      }
      if (ran) {
        namePresence = {
          probed: true, name: nameShape.name, kind: nameShape.kind, found: !!page, page,
        };
      }
    }
    console.log('[name-presence]', {
      probed: namePresence.probed, kind: namePresence.kind,
      found: namePresence.found, band: audienceBand,
      host: namePresence.page ? (() => { try { return new URL(namePresence.page.url).hostname; } catch { return '?'; } })() : '',
    });

    // ── «من هو فلان؟» ANSWERED FROM THE PAGE THAT CARRIES HIM ──────────────
    //
    // THE MEASURED DEFECT THIS CLOSES. «من هو محمد صلاح؟» was answered correctly and then had «النقطة
    // الشرعية» about players' salaries bolted onto the end of it, carrying an islamqa card. A
    // worldly identity question was never a request for a ruling, and a ruling nobody asked for is
    // not a bonus — it is an unasked-for fatwa with a citation under it.
    //
    // BUFFERED, like every other checked exit, and carrying NO referral tail: the referral belongs
    // under a religious answer, and this is not one.
    if (namePresence.probed && namePresence.kind === PRESENCE.IDENTITY_SHAPE && namePresence.found) {
      const idCards = pickVerifiedSources([namePresence.page], 1);
      if (!idCards.length) {
        console.warn('[name-presence] identity page carries no encodable card — falling through');
      } else {
        const ir = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [
              ...body.messages,
              { role: 'user', content: buildIdentityInstruction(namePresence.page.passage, namePresence.name) },
            ],
            stream: false,
          }),
        });
        if (!ir.ok) {
          const errText = await ir.text().catch(() => '');
          console.error('[name-presence] upstream', ir.status, errText.slice(0, 200));
          clearKeepAlive();
          res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${ir.status}` } })}\n\n`);
          return res.end();
        }
        const iPayload = await ir.json();
        // The model contributes no card on this route either.
        const iDraft = (iPayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
          .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
          .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
          .trim();
        if (iDraft) {
          console.log('[name-presence] identity answered', { hosts: idCards.map((c) => c.host) });
          return emitOnce(iDraft + '\n' + idCards.map((c) => c.tag).join('\n'));
        }
        console.warn('[name-presence] empty identity draft — falling through');
      }
    }

    // THE ONE SENTENCE THE SERVER OWNS ABOUT AN UNREGISTERED NAME. Emitted only on the attribution
    // shape — the identity shape has already been answered above or falls through unchanged — and
    // it makes no religious claim, so it is safe on every exit that carries one.
    const presenceLead = namePresence.probed && namePresence.kind === PRESENCE.ATTRIBUTION_SHAPE
      ? presenceLine(namePresence)
      : '';

    // ── AND IT RIDES ON THE REFUSALS TOO, WHICH IS WHERE IT MATTERS MOST ────
    //
    // MEASURED ON THE LIVE SERVICE after this batch's first deploy: «ما رأي خالد عبدالرحمن في قصر
    // الصلاة؟» returned NO_ATTRIBUTION_AVAILABLE alone. The reworded refusal did its job — it
    // called him nothing — but the reader was still left holding the premise he arrived with,
    // because a sentence that declines to attribute says nothing about whether there is anybody to
    // attribute TO. The drop-whole exits are precisely the ones where the reader most needs to be
    // told «لا أعرف هذا الاسم», and they were the ones not carrying it.
    const withPresence = (text) => (presenceLead ? presenceLead + '\n\n' + text : text);

    // ── LIVE WORLD RETRIEVAL: a general question may still need TODAY'S facts ──
    //
    // THE HOLE THIS CLOSES. The general route runs with NO tools, deliberately — that is what
    // makes it safe to stream. But "no tools" also meant "no facts newer than the model", so
    // «ما آخر أخبار غزة اليوم؟» was met with an apology about a training cut-off and an
    // inability to browse. Nothing was refusing the question; nothing was answering it either.
    //
    // WHY IT SITS ABOVE THE LEDGER BRANCH, AND NOT WHERE IT WAS WRITTEN. It used to sit just
    // before the streamed GEN route, which was correct while the ledger was an internal rollout
    // reaching almost nobody. The public go-live inverted that: the ledger branch RETURNS, so
    // once every reader takes it, every line below it — this one included — becomes unreachable.
    // A news question would have gone to an engine whose entire corpus is the approved Islamic
    // sources, and got «لم أعثر» from sites that never carried the answer. So the world check
    // runs FIRST, and the ledger keeps everything it does not claim.
    //
    // IT STILL CLAIMS ALMOST NOTHING. Everything above has already had its say — the hazard
    // triage, the age access policy and the child-benign branch — and the condition below is
    // narrow twice over: the lexical router must have said GENERAL, and the world classifier
    // must have found a news/recency frame. Anything religious went to DEEN long ago; anything
    // naming a scholar was forced there too. Every other request falls straight through to the
    // ledger exactly as if this block were not here.
    //
    // THE RELIGIOUS PERIMETER IS UNCHANGED, AND THAT IS CHECKABLE RATHER THAN PROMISED:
    //   1. it runs ONLY on the GEN route, so no religious turn can reach it;
    //   2. classifyWorldIntent() refuses on its own account anything isReligiousText() names;
    //   3. retrieveWorld() searches lib/retrieve.js's SITES_GENERAL and nothing else — it takes
    //      no band, no purpose and no onlySites, and it refuses outright if that list ever
    //      overlaps a religious one;
    //   4. every world domain carries `scopes: []` in the registry, so it is refused for
    //      fatwa, tafsir, hadith and general alike;
    //   5. the drafting note forbids deriving any ruling from what comes back.
    //
    // FAILURE IS A FALL-THROUGH, NEVER A REFUSAL. No key, no results, a blocked host, a throw —
    // any of them leaves worldPass null and the request takes the ordinary GEN branch below,
    // byte-for-byte as it does today. Live retrieval can only ever ADD to this route.
    const worldIntent = effectiveRoute === 'GEN'
      ? classifyWorldIntent(questionText)
      : { world: false, reason: 'NOT_GEN', matched: '' };
    let worldPass = null;
    if (worldIntent.world) {
      try {
        const { retrieveWorld } = await import('../lib/retrieve.js');
        // No band, no depth, no purpose: none of them means anything on this list, and passing
        // one would suggest it did.
        const w = remember(await retrieveWorld(questionText));
        if (w && Array.isArray(w.sources) && w.sources.length) worldPass = w;
      } catch (e) {
        console.warn('[world-search] threw, falling through to the ordinary general route:', e.message);
      }
    }
    console.log('[world-search]', {
      route: effectiveRoute, intent: worldIntent.world, reason: worldIntent.reason,
      matched: worldIntent.matched, sources: worldPass ? worldPass.sources.length : 0,
      hosts: worldPass ? worldPass.sources.map((s) => { try { return new URL(s.url).hostname; } catch { return '?'; } }) : [],
    });

    if (worldPass) {
      // BUFFERED, not streamed — the same trade the attributed and claim routes make. The cards
      // are appended by the server after the model has finished, and a card cannot be appended
      // to bytes that already left. It costs the same ONE model call the GEN branch costs.
      const worldCards = pickVerifiedSources(worldPass.sources);
      if (!worldCards.length) {
        // Every retrieved page failed buildSourceTag (non-https, unencodable). Rather than
        // present live material with nothing to check it against, drop back to the plain route.
        console.warn('[world-search] no encodable card — falling through');
      } else {
        const wr = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [
              ...body.messages,
              { role: 'user', content: buildWorldSearchInstruction(worldPass.text, band) },
            ],
            stream: false,
          }),
        });
        if (!wr.ok) {
          const errText = await wr.text().catch(() => '');
          console.error('[world-search] upstream', wr.status, errText.slice(0, 200));
          clearKeepAlive();
          res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${wr.status}` } })}\n\n`);
          return res.end();
        }
        const wPayload = await wr.json();
        // The model contributes no card here either, on any route.
        const wDraft = (wPayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
          .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
          .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
          .trim();
        if (wDraft) {
          console.log('[world-search] answered', { cards: worldCards.length, hosts: worldCards.map((c) => c.host) });
          return emitOnce(wDraft + '\n' + worldCards.map((c) => c.tag).join('\n'));
        }
        console.warn('[world-search] empty draft — falling through');
      }
    }

    // ── LEDGER RAG — NOW THE PATH EVERY READER TAKES ───────────────────────
    //
    // PUBLIC AS OF 2026-08-05 (owner decision, lib/ledger/flag.js PUBLIC_GO_LIVE). It was a
    // parallel path behind three independent conditions — an env floor, a server-verified
    // internal credential, and a runtime value in Upstash. The credential requirement is gone
    // and the defaults are open, so this is the ordinary path, not the exception.
    //
    // WHAT SURVIVED THE GO-LIVE, because a go-live that removed the brakes would be a one-way
    // door: `LEDGER_RAG=off` still closes the floor for everybody, `RFC_V05_MODE=off|internal`
    // still stops or narrows it, the Upstash kill switch still stops it in seconds without a
    // build, and the day's search ceiling is still a precondition of ever reaching here.
    //
    // The engine still never falls back INTO the legacy path mid-request: a ledger request that
    // cannot verify a source answers with its own refusal rather than quietly re-asking an
    // unguarded route, because a fallback that answers is a fallback that defeats the gate it
    // fell back from.
    //
    // The path and the clock were decided at the top of this handler, so the policy router above
    // could see which one this request is taking. The condition is spelled out rather than using
    // the `toLedger` alias: ledger-seam-guard locates this branch by it in order to prove the
    // engine's question does not come from the legacy classifier, and a branch a gate cannot find
    // is a branch nothing checks.
    if (ledgerPath.path === 'ledger') {
      // The seam is a module, not ten lines here, so this exact code path is what
      // ledger-seam-guard.cjs drives with req/res doubles. A branch that only the handler can
      // reach is a branch only a regex can check.
      const { runLedgerTurn } = await import('../lib/ledger/seam.js');
      const { braveSearch } = await import('../lib/ledger/search.js');
      const { SITES_ADULT, SITES_MINOR, SITES_MINOR_FALLBACK } = await import('../lib/retrieve.js');
      // THE KEEPALIVE STAYS UP FOR THE WHOLE OF THE ENGINE'S WORK. The ledger path is
      // byte-silent for up to its full 25-second budget — the same reason round 1 of the shipped
      // path is — and mobile carriers reset an idle socket at about thirty seconds. Clearing it
      // here, as the first version did, removed the protection for exactly the interval it
      // exists to cover. The seam fires `beforeFirstOutput` immediately before its first byte,
      // so there is one owner, one timer, and no keepalive can interleave with a content frame.
      // THE READER'S OWN WORDS. Deliberately NOT plan.attribution.question: that is a field of
      // the legacy attribution classifier — the one measured mis-reading the verb «ذهب» — and
      // an engine fed from it inherits whatever that classifier starts doing to the text.
      // runLedgerTurn() reads the last user turn itself, with type/length checks only.
      const out = await runLedgerTurn(res, {
        messages: body.messages,
        band,
        // The POLICY band, resolved by the shared core. `band` above still picks the source
        // allow-list; this is what the engine's age access and floor read.
        audienceBand,
        audienceSource,
        // ── THE CHILD'S FOURTH DOMAIN ──────────────────────────────────────
        //
        // `SITES_MINOR` alone was three domains; `retrieve()` builds a minor's search as TWO tiers
        // — `[SITES_MINOR, SITES_MINOR_FALLBACK]` — so the legacy path always had four. The
        // difference is not decorative: eftaa.awqaf.gov.kw is the Kuwaiti fatwa department, and it
        // is on the minor list precisely because it answers what Ibn Baz did not live to be asked
        // — banking, crypto, contemporary transactions. A child who took the ledger path asked
        // about those and was searched over three sources that predate the question.
        //
        // Flattened, because the engine's `bandSites` is a flat allow-list it filters against
        // (lib/ledger/query-build.js), not a tier ladder. Tiering is retrieve()'s own ordering
        // concern; what must match across the two paths is WHICH domains a child may reach.
        bandSites: band === 'adult' ? SITES_ADULT : [...SITES_MINOR, ...SITES_MINOR_FALLBACK],
        buildSourceTag,
        search: (q, sites) => braveSearch(q, sites),
        startedAt: ledgerStartedAt,
        beforeFirstOutput: clearKeepAlive,
      });
      // Counts and codes only. No question, no answer, no page text, no reader identity.
      console.log('[ledger]', {
        trace: out.ledger ? out.ledger.traceId : null, outcome: out.outcome,
        model: out.budget.snapshot().spent.modelCalls,
        brave: out.budget.snapshot().spent.braveCalls,
        fetch: out.budget.snapshot().spent.pagesFetched,
        ms: out.budget.snapshot().elapsedMs,
      });
      return;
    }


    // ── ATTRIBUTED ROUTE: no source by that scholar ⇒ no attributed ruling ──
    //
    // This branch owns every question that asks what a named scholar held. It runs BEFORE the
    // GEN and DEEN routes and takes precedence over both.
    //
    // FOUR THINGS MAKE IT DIFFERENT FROM THE ORDINARY SOURCED PATH:
    //   1. The source is fetched FIRST, from the scholar's own corpus, before a single token is
    //      generated. If there is none, the model is never called at all — the refusal costs
    //      nothing and cannot be talked out of by a fluent draft.
    //   2. The published text is handed to the model as the ONLY permitted basis, with an
    //      instruction that names refusal as the correct outcome when the text falls short.
    //   3. The answer is BUFFERED, not streamed. Streaming and verification are incompatible:
    //      bytes already on the reader's screen cannot be withdrawn when the check fails. An
    //      attributed fatwa is the one place in this app where correctness outranks the
    //      appearance of speed.
    //   4. The answer is then verified against the source — polarity on the decisive fiqh terms,
    //      every stated duration, and named criteria the source never used — and dropped whole if
    //      it disagrees.
    // ── A CLAIM WITH NOBODY NAMED ──────────────────────────────────────────
    // «قال الشيخ إن كذا» / «ما حكم ما قاله الشيخ في المقطع؟». Something is credited to somebody,
    // and there is no somebody.
    //
    // MATERIAL WE WERE NEVER GIVEN IS STILL A DEAD END, and honestly so: a clip or an article that
    // is not in the conversation cannot be fetched, guessed at, or searched for by description.
    // That exit stays.
    //
    // A MISSING NAME IS NOT A DEAD END. «قال لي صاحبي إن الصلاة على وقتها» is, underneath the
    // frame, a question about the ruling — and the ruling is documented. Ending the request to ask
    // WHICH shaykh was meant answered a question the reader did not ask and refused the one he did.
    // So only the material case still asks; a nameless claim falls through to the sourced route and
    // is answered from the sources, crediting nobody.
    if (plan.needsClarification) {
      const wantsMaterial = /مقطع|فيديو|الفيديو|تسجيل|المقال|مقال|رابط|كلام/u.test(plan.topic || '');
      if (wantsMaterial) {
        console.warn('[attribution]', REASON.CLARIFICATION_REQUIRED, 'material');
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({
          type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: NEEDS_MATERIAL },
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
        return res.end();
      }
      console.warn('[attribution]', REASON.CLARIFICATION_REQUIRED, 'name — answering the question instead');
    }

    // ── A NAME THAT DOES NOT IDENTIFY ANYBODY ──────────────────────────────
    //
    // TWO SITUATIONS THAT USED TO SHARE ONE ANSWER, AND MUST NOT.
    //
    //   AMBIGUOUS — «ابن حجر» matches more than one man we hold a corpus for. Choosing is guessing
    //     and searching both answers a question nobody asked, so asking is the honest move. It is
    //     honest here specifically because we can NAME the candidates; the reader is choosing from
    //     a list, not being sent away to do our work.
    //
    //   UNRESOLVED — «الشيخ فلان الفلاني» matches nobody. There is no list to offer, so the old
    //     template asked for «اسمَه كاملًا أو رابطَ موقعِه» and ended the request WITH NOTHING
    //     SEARCHED. That is the defect: a reader who asks what the ruling is, and is asked for a
    //     website instead, has been refused the question he actually asked. Not knowing who
    //     somebody is has never been a reason not to look up the ruling.
    //
    // So the unresolved case falls THROUGH. The name is bound into the query and searched over the
    // band's ordinary approved list below; only after that search may anything be refused, and
    // lib/policy/consistency-gate.js will not let a «لم أقف» be written without it. Nothing here
    // credits him with anything — that still requires a page, and the grade caps are untouched.
    // AMBIGUITY ALONE, and no second condition on top of it. `needsScholarIdentity` used to be
    // required here as well, and it is a question about whether we hold a CORPUS for the man —
    // which has nothing to do with whether we know which man he is. MEASURED: «ابن حجر» came
    // through with both facts true, so the branch was reachable; the reason it was not reached is
    // recorded in lib/ask-plan.js, where a narrower resolver was overwriting the ambiguity. Two
    // conditions guarding one honest question is one more than it can carry.
    if (plan.scholarStatus === 'ambiguous') {
      console.warn('[attribution]', REASON.SCHOLAR_IDENTITY_AMBIGUOUS,
        { entity: plan.namedEntity, candidates: plan.scholarCandidates });
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: ambiguousScholarPrompt(plan.scholarCandidates) },
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      return res.end();
    }
    if (plan.needsScholarIdentity) {
      console.warn('[attribution]', REASON.SCHOLAR_IDENTITY_UNRESOLVED,
        { entity: plan.namedEntity, action: 'searching before refusing' });
    }

    // ── ASKED FOR A NAMED SCHOLAR'S OWN POSITION ───────────────────────────
    //
    // WHAT CHANGED, AND WHY. This used to be a barrier: a name was detected, one adapter was
    // consulted, and anything else emitted a fixed sentence — no search, no ruling, nothing.
    // A reader asking about Shaykh al-Abbaad's view got that sentence though the general
    // ruling was documented and citable, and a transient failure of the Ibn Uthaymeen adapter
    // produced it too.
    //
    // It is now a SEARCH, in two steps, and a failure at either step falls THROUGH to the
    // ordinary sourced route rather than ending the request:
    //   1. the scholar's own corpus — the purpose-built adapter where one exists, otherwise a
    //      search restricted to the domain the registry says publishes him;
    //   2. verification of the draft against that text (unchanged, and still absolute).
    //
    // The guarantee is exactly what it was: no position is attributed to a man without a page
    // of his that says it. What is no longer true is that failing to find one costs the reader
    // the answer to the question he actually asked.
    let attributionNote = '';          // appended to the general answer, never emitted alone
    // ── DID A SEARCH FOR HIS OWN TEXT ACTUALLY RUN? ────────────────────────
    //
    // «لم أقف على نصٍّ له» is a statement about work that was done, and a historical scholar has
    // neither an adapter nor an official domain — so for him the block below searches NOTHING and
    // then said it anyway. «I did not find» and «I did not look» are different claims, and only
    // the first may be made after actually looking. This flag tells them apart, and
    // lib/policy/consistency-gate.js refuses the negation without it. It is set at each of the two
    // places that actually search, and read where the note is composed.
    //
    // `attributionUnverified` is SEPARATE from the note: the note may not always be sayable, while
    // the fact that no text of his was verified always governs what the reply may claim. Both are
    // assigned tersely below on purpose — attribution-guard.cjs pins the distance between
    // `if (!attributedSources.length) {` and what follows it, and the pin is worth the terseness.
    let attributionSearched = false;
    let attributionUnverified = false;
    // ── NO CORPUS TO SEARCH IS NOT PERMISSION TO SPEAK FOR HIM ─────────────
    //
    // This used to be armed by the world check: «he is not a scholar» was read as «so there is
    // nothing to check», and the flag that arms every downstream gate was left false. That is how
    // «الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم» reached a reader — the verdict meant to
    // protect him from a fabricated fatwa disarmed the check that would have caught a fabricated
    // obituary.
    //
    // With the verdict gone, nothing here decides who anybody is. An UNREGISTERED name simply has
    // no corpus to search: the hunt below cannot reach one for him, and nothing of his is verified
    // — which is what the flag records. The gates stay armed either way.
    if (unregisteredName) attributionUnverified = true;
    const attributionActive = (plan.attributionMode === 'namedScholarOpinion') && !unregisteredName;
    if (attributionActive) {
      let attributedSources = [];
      if (plan.hasDirectAdapter) {
        attributionSearched = true;
        const { retrieveIbnUthaymeen } = await import('../lib/binothaimeen.js');
        attributedSources = await retrieveIbnUthaymeen(attribution.question, {
          excludeWords: String(attribution.scholarName || '').split(' '),
          rank: (q, cands) => rankCandidates(q, cands, model, headers),
        });
      } else if (plan.officialDomain) {
        // ── HIS DOMAIN AT THE FRONT OF THE SEARCH, NOT A CAGE AROUND IT ────
        //
        // This used to be `onlySites: [plan.officialDomain]` — a search LOCKED to his own site,
        // which returned silence whenever his site had nothing on the issue. The reader then lost
        // the ruling because of whose name he had put in front of it, and «ما رأي فلان في كذا» is
        // a question about the ISSUE with a preference attached.
        //
        // So it is a preference: his domain is asked about first and alone, and an empty answer
        // there carries on down the band's ordinary list instead of ending the search. Every page
        // gate, listing refusal and role rule applies unchanged either way, and only a fetched,
        // gated page reaches this array — a title or a snippet is not evidence here any more than
        // anywhere else.
        //
        // WHAT MAKES THAT SAFE is one branch below: the lock used to be the only guarantee that a
        // page belonged to the man it was about to be drafted for, and that guarantee now comes
        // from the page's own source class. A page on his own domain reproducing the Standing
        // Committee's fatwa was never his either, and the lock could not tell.
        try {
          attributionSearched = true;
          const { retrieve } = await import('../lib/retrieve.js');
          const scoped = await retrieve(plan.topic || attribution.question, {
            band, depth: effectiveDepth, preferDomain: plan.officialDomain,
          });
          attributedSources = (scoped.sources || []).map((s) => ({
            scholar: plan.namedEntity,
            publisher: (plan.officialDomain || ''),
            title: s.title, exactText: s.passage, canonicalUrl: s.url, sourceId: s.url,
          }));
        } catch (e) {
          console.warn('[attribution] preferred search threw:', e.message);
        }
      } else {
        console.warn('[attribution] no approved domain is registered for', plan.namedEntity);
      }

      if (!attributedSources.length) {
        // FALL THROUGH, do not refuse. The reader still gets the documented general ruling
        // below, with one line saying it is not his.
        console.warn('[attribution]', REASON.DIRECT_CORPUS_SEARCHED_NO_EVIDENCE, plan.namedEntity, plan.officialDomain || 'adapter');
        attributionUnverified = true;
        if (attributionSearched) attributionNote = unattributedNote(plan.namedEntity);
      } else {
      const src = attributedSources[0];
      const grounding = [
        'النصُّ المنشورُ التالي هو المصدرُ الوحيدُ المسموحُ بالاعتماد عليه في هذا الجواب.',
        'العالِم: ' + src.scholar,
        'الجهةُ الناشرة: ' + src.publisher,
        'عنوانُ المادّة: ' + src.title,
        '',
        '«' + src.exactText + '»',
        '',
        'اكتبْ جوابًا قصيرًا يلتزم بما يلي حرفيًّا:',
        '- انسبْ إلى الشيخ ما في النصِّ أعلاه وحدَه، ولا تُكمِلْ من عندك.',
        '- لا تذكرْ مُدّةً ولا عددًا ولا معيارًا لم يَرِدْ في النصّ.',
        '- لا تنقلْ حديثًا ولا لفظًا نبويًّا ولا تخريجًا ولا درجةً لحديثٍ لم يَرِدْ في النصِّ أعلاه.',
        '- إن كان النصُّ لا يُجيب عن السؤال المطروح، فقلْ ذلك صراحةً ولا تنسبْ إليه شيئًا.',
        '- إن كانت تفاصيلُ الحالة قد تُغيّرُ الحكم، فنبِّهْ على سؤال أهلِ العلم مباشرةً.',
        '- لا تكتبْ وسمَ <source> ولا أيَّ رابط؛ التطبيقُ يُضيفُ بطاقةَ المصدر بنفسه.',
      ].join('\n');

      const ra = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [...body.messages, { role: 'user', content: grounding }],
          stream: false,
        }),
      });
      if (!ra.ok) {
        const errText = await ra.text().catch(() => '');
        console.error('[attribution] upstream', ra.status, errText.slice(0, 200));
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${ra.status}` } })}\n\n`);
        return res.end();
      }
      const payload = await ra.json();
      const drafted = (payload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      // The model may never contribute a card here, exactly as on every other route.
      const draft = drafted
        .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
        .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
        .trim();

      // ── AND THE PAGE MUST LICENSE NAMING HIM, NOT MERELY BE ON HIS DOMAIN ──
      //
      // MEASURED as a rule, not as an incident: a scholar's own archive republishes other people
      // constantly. A Standing Committee fatwa reproduced on binbaz.org.sa passes every check
      // below — it is his domain, the text is real, the wording is faithful — and the reply that
      // comes out of it credits Ibn Baz with a decision that is not his. The domain says whose
      // SITE this is; the source-class rule is what says whose WORDS these are, and when the page
      // is transmitting somebody else it drops the attribution to the site.
      const attrLicence = attributionLicence(attributedSources.map((s) => ({
        url: s.canonicalUrl, author: '', text: s.exactText,
      }))).personIds;
      const ownedByHim = !plan.requestedAuthorityId || attrLicence.includes(plan.requestedAuthorityId);
      const verdict = ownedByHim
        ? verifyAttributedReply(draft, attribution, attributedSources)
        : { ok: false, problems: ['source-class:' + REASON.PAGE_NOT_DIRECT_EVIDENCE + ':transmits-another'] };
      if (!verdict.ok) {
        // THE DRAFT IS DISCARDED IN FULL — unchanged, and non-negotiable. A partially-correct
        // attributed fatwa is not a partially-correct answer; it is a wrong one with a
        // citation attached.
        //
        // What IS different: discarding the draft no longer ends the request. The reader asked
        // a real question, and the general ruling for it is very often documented elsewhere on
        // the approved list. So we fall through with a note, exactly as when no text of his was
        // found at all. Nothing of the rejected draft survives; only the QUESTION does.
        console.warn('[attribution]', REASON.PAGE_NOT_DIRECT_EVIDENCE, verdict.problems.join(' | '));
        attributionUnverified = true;
        // A page of his WAS fetched and read here, so the negation is earned.
        attributionNote = unattributedNote(plan.namedEntity);
      } else {
        const card = buildSourceTag({ url: src.canonicalUrl, title: src.title });
        console.log('[attribution]', REASON.DIRECT_ATTRIBUTION_CONFIRMED, { scholar: src.scholar, id: src.sourceId });
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({
          type: 'content_block_delta', index: 0,
          delta: { type: 'text_delta', text: seal(draft) + referralBlockFor(draft) + (card ? '\n' + card.tag : '') },
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
        return res.end();
      }
      }
    }

    // ── CONSISTENCY_GATE, AS ONE FUNCTION GUARDING EVERY BUFFERED EXIT ─────
    //
    // The handler has several places a finished reply can leave from, and the defect escaped
    // through the one nobody was watching: round 1 answered without calling the search tool, so
    // the draft went straight out and never met the check that sits before round 2. A gate with
    // one entrance and four exits is not a gate. This is called at every exit that has a complete
    // draft in hand; the streaming exit cannot be one of them, which is exactly why a request in
    // this state is forced onto a buffered path above.
    //
    // Returns the problems, or null when there is nothing to enforce.
    //
    // Declared before the encyclopedic branch below and read after it, so the publishers that
    // branch actually fetched are in hand by the time any exit calls this.
    let encyclopedicPublishers = [];
    // ── WHO THE PAGES LICENSE NAMING ───────────────────────────────────────
    //
    // NULL UNTIL PAGES EXIST, AND THAT DISTINCTION IS LOAD-BEARING. `null` means no result set has
    // been gathered yet, and the source-class rule stays off; `[]` means pages were gathered and
    // they license nobody — the Tariq al-Ali case, where every sentence naming him must go. A
    // screen that read the two the same way would either refuse every early draft or refuse
    // nothing at the one exit that mattered. Assigned at each place that finishes retrieving.
    let sourceLicence = null;
    // ── ARMED BY THE DRAFT, NOT BY THE PLAN ────────────────────────────────
    //
    // `if (!attributionUnverified) return null` used to stand here, and it meant the gate ran only
    // when the PLANNER had decided this was an attribution request. Two ways past it, both
    // measured:
    //
    //   * a `non_scholar` verdict cleared the whole attributed block, so the flag was never set —
    //     and «الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم» went out through a gate that
    //     had been switched off on the grounds that he was not a scholar;
    //   * a reply that reached for a scholar the reader never named was not an attribution
    //     request by the plan, and met nothing at all.
    //
    // What a reply may say about a man is a property of THE TEXT GOING OUT. So every buffered
    // draft is screened, whatever the plan thought the question was.
    const attributionProblems = (draft) => {
      const verdict = screenDraft(draft, {
        entity: plan.namedEntity,
        // No text of his was verified on any path that still reaches here: the attributed route
        // returns directly when it verifies one.
        notDirectlyVerified: true,
        searchProven: attributionSearched,
        allowSourcedPosition: true,
        // NOBODY DESCRIBED HIM TO US. No branch in this handler fetches a biography, so an
        // assertion about who he is has no source on any path — which is why this is a constant
        // and not a variable pretending to be a decision.
        identityVerified: false,
        // The man the READER asked about. An offence in a sentence naming him is the substance of
        // the answer, and what is left after trimming it answers a different question.
        subjectEntity: plan.namedEntity,
        // ONCE WE KNOW WHICH PUBLISHERS WE ACTUALLY FETCHED, every later exit must hold a
        // transmission to naming one of them. Without this the encyclopedic branch refused
        // «ذكرت بعض المواقع أنّ ابن تيمية يرى…» and the fall-through then served it, which made the
        // stricter check decorative.
        transmissionPublishers: encyclopedicPublishers,
        // THE SOURCE-CLASS RULE. A صفة or a موقف may be credited to a man only when one of the
        // pages actually in hand licenses naming him. Read at call time, not at declaration time,
        // so every exit gets the licence for the pages THAT exit was drafted over.
        sourceLicence,
        // THE ترجيح RULE'S EVIDENCE. `fetchedPages` is every RELIGIOUS page this request actually
        // read — the world look-up is deliberately kept out of it — so «الراجح …» survives only
        // when one of those pages says it and the draft credits somebody with it. Read at call
        // time for the same reason `sourceLicence` is: an exit is judged on its own pages.
        pageTexts: fetchedPages.map((p) => (p && p.passage) || ''),
      });
      if (!verdict.problems.length) return null;
      console.warn('[consistency] draft screened', {
        entity: plan.requestedAuthorityId || '', searched: attributionSearched,
        problems: verdict.problems, dropWhole: verdict.dropWhole,
        droppedSentences: verdict.droppedSentences.length,
      });
      // A SENTENCE-LEVEL REPAIR IS REPORTED BACK, not applied silently: the caller decides
      // between sending what survived and sending the replacement.
      return verdict;
    };

    // WHICH REFUSAL FITS WHICH FAILURE. Two different things go wrong at these exits and they
    // are not interchangeable sentences:
    //
    //   * a draft that credits a MAN we could not verify -> NO_ATTRIBUTION_AVAILABLE, which is
    //     about the attribution and offers to bring the ruling from its own sources instead;
    //   * a draft whose every RULING sits on no page we fetched -> NO_VERIFIED_SOURCE_MESSAGE,
    //     which is the one that says, in as many words, that no ruling is given without a
    //     source. There is no person in this failure, and answering it with a sentence about
    //     attribution would tell the reader we declined to name somebody he never asked about.
    const refusalFor = (verdict) =>
      (verdict && verdict.rulingUnsourced) ? NO_VERIFIED_SOURCE_MESSAGE : NO_ATTRIBUTION_AVAILABLE;

    // ── ENCYCLOPEDIC TRANSMISSION: SEARCH BEFORE APOLOGISING ───────────────
    //
    // THE COMPLAINT THIS ANSWERS. «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا؟» was met with an
    // apology for finding no direct text of his — while the ruling is written out on الإسلام سؤال
    // وجواب, which is on our own approved list. The apology was not caused by an absence of
    // material; it was caused by never looking. The attributed block above only knows two ways to
    // look for a man — a purpose-built adapter, or his own official domain — and a scholar dead
    // seven centuries has neither, so it fell straight through to "unverified" without a search.
    //
    // WHAT RUNS HERE. The band's ordinary approved list, through the ordinary retrieval path, with
    // the scholar's NAME bound into the query so the pages that come back are the ones that discuss
    // his position rather than the topic in general. Every page gate, role rule and age rule that
    // governs any other search governs this one; nothing new is admitted.
    //
    // WHAT IT MAY THEN SAY. A TRANSMISSION, not a quotation: «بحسب ما وثّقه موقع الإسلام سؤال
    // وجواب، فإنّ رأي ابن تيمية…». The intermediate source carries the claim and is named, so the
    // reader can check it. «قال ابن تيمية» stays forbidden — we are reading a page ABOUT his
    // position, not a page BY him — and so does any quotation of him. That is exactly grade C.
    // WIDENED FROM «historical» TO «nobody searched his own corpus». The branch was written for a
    // seven-century-dead scholar, who has neither an adapter nor an official domain — but that is
    // a DESCRIPTION of the state, not the state itself. An unregistered contemporary name reaches
    // exactly the same place: no adapter, no domain, nothing searched. It used to be sent away
    // with the identity template; now it gets the same real search, and the same refusal only if
    // the search comes back empty. `!attributionSearched` is what keeps this from re-searching for
    // a scholar whose own site was already read and found wanting.
    // `!unregisteredName` because a name no registry knows has no corpus to search: binding it into
    // the query would spend a search on a phrase that cannot match, and the empty result would then
    // be read as an absence of evidence about the ruling itself. The reader still gets the ruling
    // from the ordinary sourced route below — with nothing at all attributed to him.
    if (attributionUnverified && plan.namedEntity && !attributionSearched && !unregisteredName) {
      try {
        const { retrieve } = await import('../lib/retrieve.js');
        // The name is BOUND INTO the query, not merely hoped for: `topic` has had the name frame
        // stripped out of it by planAsk, so searching `topic` alone would look for the ruling and
        // not for HIS ruling.
        // THE READER'S OWN SENTENCE IS THE QUERY, because it already carries the name the way he
        // wrote it. `topic` has had the name frame stripped, and stripping is not always clean —
        // «ابن تيمية» left «تيمية» behind — so prepending the FOLDED surface to it produced
        // «ابن تيميه تيمية فيمن ترك…», a worse query than either half. The name is bound either
        // way; this way it is also spelled the way the sources spell it.
        const asked = lastUserText(body.messages) || attribution.question || '';
        const encQuery = (asked.trim() || `${plan.namedEntity} ${plan.topic || ''}`).trim();
        const enc = remember(await retrieve(encQuery, { band, depth: effectiveDepth }));
        const encSources = (enc.sources || []).slice(0, MAX_SOURCES);
        // Pages exist now, so the source-class rule is armed for every exit below — including the
        // fall-through, which used to be the looser of the two and is the one that actually served
        // «طارق العلي داعية وخطيب كويتي … من أهل العلم» over a khutbah page that never named him.
        sourceLicence = attributionLicence(encSources).personIds;
        // WE LOOKED. Whatever happens next, the negation below is now an earned one — and the
        // note that says so is composed here, because the earlier assignment ran before this
        // search and correctly declined to claim a search that had not happened yet.
        attributionSearched = true;
        attributionNote = unattributedNote(plan.namedEntity);
        // ── MAY WE TRANSMIT A POSITION TO THIS MAN AT ALL? ──────────────────
        //
        // Only if the entity layer RECOGNISES him. For ابن تيمية the name is bound into the query
        // and the pages that come back genuinely discuss his position, so «بحسب ما وثّقه موقع…
        // فإنّ رأيه هو…» is a transmission of something a page really says.
        //
        // For «الشيخ فلان الفلاني» the same search returns pages about the TOPIC — nobody by that
        // name is in them — and drafting the same sentence would credit an unidentified person
        // with a position no source ever ascribed to him. That is a fabrication with a citation
        // attached, and it would pass the consistency gate, because the gate checks that a
        // publisher is named and cannot check that the publisher mentioned this man.
        //
        // So an unrecognised name gets the SEARCH, which is what makes the refusal honest, and
        // not the transmission. The reader still receives the documented general ruling below,
        // with the note saying plainly that it is not being credited to him.
        const mayTransmitPosition = !!plan.requestedAuthorityId || plan.authorityEra === 'historical';
        console.log('[encyclopedic]', {
          entity: plan.requestedAuthorityId || '', found: encSources.length, mayTransmitPosition,
        });
        if (encSources.length && mayTransmitPosition) {
          const cards = encSources.map((s) => buildSourceTag({ url: s.url, title: s.title })).filter(Boolean);
          encyclopedicPublishers = [...new Set(cards.flatMap((c) => {
            const reg = findSource(c.host);
            return [c.host, reg && reg.name].filter(Boolean);
          }))];
          const grounding = [
            'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
            'بحثنا عن رأي «' + plan.namedEntity + '» في موسوعاتِ فتاوى معتمدةٍ لدينا، وهذه هي المادّةُ التي وردت:',
            '',
            enc.text,
            '',
            'اكتبْ جوابًا يلتزم بما يلي حرفيًّا:',
            '- صُغْه بأسلوبِ النقلِ الموثَّق: «بحسب ما نقله ووثَّقه موقعُ (اسمُ الموقع) المعتمد، فإنّ رأيَ '
              + plan.namedEntity + ' هو…»، وسمِّ الموقعَ باسمِه صراحةً.',
            '- ممنوعٌ «قال ' + plan.namedEntity + '» أو «صرّح» أو أيُّ صيغةٍ تجعلُ كلامَ الموقعِ كلامًا له؛ '
              + 'نحن ننقلُ من مصدرٍ وسيطٍ لا من نصٍّ له.',
            '- ممنوعٌ إيرادُ اقتباسٍ حرفيٍّ منسوبٍ إليه بين قوسين.',
            '- لا تُضفْ ترجيحًا ولا تضعيفًا لقولِه ولا «الأحوط» ولا نصيحةً بالقضاء إلّا إن وردت بدليلِها في المادّةِ أعلاه.',
            '- إن لم تُجبِ المادّةُ عن السؤال، فقلْ ذلك صراحةً ولا تنسبْ إليه شيئًا.',
            '- لا تكتبْ وسمَ <source> ولا أيَّ رابط؛ التطبيقُ يُضيفُ بطاقةَ المصدر بنفسه.',
          ].join('\n');
          const re = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model, max_tokens: maxTokens, system,
              messages: [...body.messages, { role: 'user', content: grounding }],
              stream: false,
            }),
          });
          if (re.ok) {
            const ePayload = await re.json();
            const eDraft = (ePayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
              .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
              .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
              .trim();
            // THE SAME GATE, WITH TRANSMISSION ALLOWED. A position credited to him passes only when
            // the sentence transmits it AND names one of the publishers we actually fetched.
            const eProblems = eDraft ? consistencyProblems(eDraft, {
              entity: plan.namedEntity,
              notDirectlyVerified: true,
              searchProven: true,
              allowSourcedPosition: true,
              transmissionPublishers: encyclopedicPublishers,
              // The transmission may name the SITE. Whether it may name the MAN is the
              // source-class question, and these are the pages it is answered from.
              sourceLicence,
            }) : ['EMPTY_DRAFT'];
            console.log('[encyclopedic] gate', { problems: eProblems, publishers: encyclopedicPublishers.length });
            if (!eProblems.length) {
              return emitOnce(eDraft + referralBlockFor(eDraft) + '\n' + cards.map((c) => c.tag).join('\n'));
            }
          } else {
            console.error('[encyclopedic] upstream', re.status);
          }
        }
      } catch (e) {
        console.warn('[encyclopedic] fallback threw:', e.message);
      }
    }

    // ── GEN ROUTE: ONE streamed round, NO tools ────────────────────────────
    // Same model, same system prompt, same token cap, same effort the final round uses
    // today. The ONLY difference from the old path is that `tools` is absent — so there is
    // no decision round to wait out, no retrieval, and no possibility of a tool_use block.
    // That last part is what makes streaming safe here: with no tools in the request the
    // model cannot switch to a search half-way, so no draft can ever be shown and then
    // replaced. Every text delta is forwarded as it arrives.
    if (effectiveRoute === 'GEN') {
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
      // THE EXIT THE DEFECT ESCAPED THROUGH. No tool was called here, so nothing of his was
      // searched and nothing was retrieved — which makes any position credited to him in this
      // draft the app's own invention rather than a transmission from anywhere.
      // NOTHING WAS RETRIEVED ON THIS PATH, so `pageTexts` is the empty array — which is the
      // armed state, not the unwired one. A ruling drafted here rests on nothing at all, and
      // `rulingUnsourced` is what turns that into the «no verified source» reply.
      const screened = attributionProblems(clean);
      if (screened && screened.dropWhole) return emitOnce(withPresence(refusalFor(screened)));
      const cleanOut = screened ? screened.text : clean;
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: seal(cleanOut) } })}\n\n`);
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
        const rawQ = (block.input && block.input.query) || '';
        // AN UNREGISTERED NAME IS REMOVED FROM THE QUERY, DETERMINISTICALLY. The model writes its
        // own search query and will happily put a name in it, hunting a fatwa nobody published.
        // «ما رأي خالد عبدالرحمن في قصر الصلاة» has to reach the provider as «قصر الصلاة», or the
        // search cannot match and the empty result gets read as an absence of evidence about the
        // ruling itself. The test is the registry — no model call, and no opinion about the man.
        const q = unregisteredName ? stripEntityFromQuery(rawQ, unregisteredName) : rawQ;
        if (unregisteredName && q !== rawQ) console.log('[entity] query stripped of the unregistered name');
        let webText;
        try {
          // `depth` is passed for RETRIEVAL TARGETING only (lib/source-intent.js reads it).
          // It does not reach the model, and effectiveDepth is already the server-decided
          // value, not the client's claim.
          const out = remember(await retrieve(q, { band, depth: effectiveDepth }));
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

    // THE STAMP. Every tool_result above carries page text that is now fenced by wrapUntrusted
    // inside lib/retrieve.js. This says how many marker shapes those pages used — a page talking
    // to the model rather than to a reader is a thing an operator must be able to SEE, and a
    // silent fence looks exactly like a page that never tried.
    console.log('[retrieve] injection_markers_seen', {
      count: injectionMarkersSeen.length,
      markers: [...new Set(injectionMarkersSeen)],
    });

    // ── FAIL CLOSED: no verified source => no ruling ───────────────────────
    // Decided BEFORE round 2, so an unsourceable question costs one model call instead of
    // two and can never come back as a confident answer with nothing behind it. This is
    // the whole guarantee: on the DEEN route the reader either gets a verified card or
    // gets told plainly that we could not verify one.
    const canonicalSources = pickVerifiedSources(retrievedSources.filter(Boolean).flat());
    // THE PAGES THIS REPLY WILL BE DRAFTED OVER decide who it may name. Computed from the gated
    // pages themselves — their extracted byline, their host, their extracted text — and never from
    // the question, the plan, or anything the model said.
    sourceLicence = attributionLicence(retrievedSources.filter(Boolean).flat()).personIds;
    console.log('[licence]', { pages: retrievedSources.filter(Boolean).flat().length, persons: sourceLicence });
    if (canonicalSources.length === 0) {
      console.warn('[source] no verified structured source — refusing to answer unsourced');
      clearKeepAlive();
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0,
        // The unknown-name line rides AHEAD of the refusal, because the two say different things:
        // one is about this name, the other about this search. Emitting only the second let the
        // reader keep the assumption the first one exists to remove.
        delta: { type: 'text_delta', text: (presenceLead ? presenceLead + '\n\n' : '') + NO_VERIFIED_SOURCE_MESSAGE },
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      return res.end();
    }

    // ── THE GENERAL RULING, WHEN THE SCHOLAR'S OWN TEXT WAS NOT FOUND ──────
    // attributionNote is set only when the reader asked for a named scholar's position and
    // step 1 or step 2 above came up empty. The answer that follows is the ordinary sourced
    // answer to the same question — and this instruction is what keeps it from quietly
    // becoming his. The note itself is appended after the answer, not instead of it.
    // ── AND THE NOTE THAT USED TO SAY WHO HE IS IS GONE WITH THE CHECK ─────
    //
    // It opened the reply with a sentence about the man — «هذا الاسم ليس ممّن تُؤخَذ عنهم الفتوى»
    // — on the strength of a model call, and the model call was wrong in the direction nobody was
    // watching. Nothing sourced it, so nothing says it. The reader gets the ruling he asked for,
    // and the instruction below is what keeps it from quietly becoming his.
    if (attributionUnverified) {
      console.warn('[attribution]', REASON.GENERAL_RULING_SUBSTITUTED, plan.namedEntity);
      toolResults.push({
        type: 'text',
        text: [
          'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
          'سألَ القارئُ عن رأيِ الشيخ «' + plan.namedEntity + '» بعينِه، ولم يُعثَرْ على نصٍّ منشورٍ له في هذه المسألة.',
          '- لا تقلْ «قال» ولا «صرّح» ولا تنقلْ عنه لفظًا بين قوسين البتّة؛ لم يُتحقَّقْ من نصٍّ له.',
          '- إن ذكرتِ المصادرُ المسترجَعةُ رأيَه، فانسبِ النقلَ إلى المصدرِ نفسِه بصيغةِ «ذكر موقعُ كذا أنّ رأيَه…»، لا إليه مباشرةً.',
          '- ولا تُضفْ ترجيحًا ولا تضعيفًا لقولِه ولا «الأحوط» ولا نصيحةً بالقضاء إلّا إن ورد ذلك بدليلِه في المصادرِ أعلاه.',
          '- لا تنسبْ إليه شيئًا البتّةَ: لا قولًا ولا اختيارًا ولا ترجيحًا، ولو كنتَ تظنُّ أنّه يقول به.',
          '- أجبْ عن المسألةِ نفسِها من المصادرِ المسترجَعةِ أعلاه وحدَها، إجابةً كاملةً مفيدةً كأيِّ سؤالٍ آخر.',
          '- انسبِ الحكمَ إلى المصدرِ الذي ورد فيه، لا إلى الشيخِ المذكور.',
          '- لا تعتذرْ ولا تجعلْ عدمَ وجودِ نصِّه هو الجواب؛ التطبيقُ يُضيفُ تنبيهًا مختصرًا بذلك بنفسه في آخر الجواب.',
        ].join('\n'),
      });
    }

    const round2Messages = [
      ...body.messages,
      { role: 'assistant', content: round1.content },
      { role: 'user', content: toolResults },
    ];

    // ── SPECIFIC-CLAIM ROUTE: a verdict on THIS expression needs a page about THIS expression ──
    //
    // Runs only when the question turns on a named expression or a named incident — «حكم قول كذا»,
    // a phrase in quotation marks, «هل هذه العبارة بدعة؟». A question about a RULE
    // («هل يجوز أن أدعو الله بأسمائه الحسنى؟») is not this, takes the ordinary streamed path
    // below, and is answered from the general source exactly as it always was.
    //
    // WHY IT BUFFERS, and why only here. Verification and streaming cannot both be true: bytes on
    // the reader's screen cannot be recalled when the check fails. Buffering every religious
    // answer would cost every reader the whole generation time in silence, so the trade is made
    // where the danger is — these answers are short verdicts, and they are the ones that were
    // wrong.
    const retrievedPages = retrievedSources.filter(Boolean).flat();
    if (claimSubject.specific) {
      let supporting = claimSubject.subject
        ? sourcesAddressingSubject(claimSubject.subject, retrievedPages)
        : [];

      // ONE extra search, and only when the model's own angles missed the expression. The query
      // is the reader's WORDING, not a normalised form of it — the normalisation exists to widen
      // what counts as a match, never to become the thing we searched for. The first dialect
      // variant rides along so a page spelling it «تبطئ» is reachable from a reader who typed
      // «تبطي».
      if (!supporting.length && claimSubject.subject) {
        const variants = phraseVariants(claimSubject.subject);
        const probe = variants.length > 1 ? variants[0] + ' ' + variants[1] : claimSubject.subject;
        try {
          const extra = remember(await retrieve(probe, { band, depth: effectiveDepth }));
          if (Array.isArray(extra.sources) && extra.sources.length) {
            retrievedPages.push(...extra.sources);
            supporting = sourcesAddressingSubject(claimSubject.subject, retrievedPages);
            // The probe added pages, so it may have added a licence with them.
            sourceLicence = attributionLicence(retrievedPages).personIds;
          }
        } catch (e) {
          console.warn('[claim] phrase probe threw:', e.message);
        }
      }
      console.log('[claim]', {
        subject: claimSubject.subject || null,
        source: claimSubject.source,
        pages: retrievedPages.length,
        supporting: supporting.length,
      });

      const rc = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [
            ...round2Messages,
            { role: 'user', content: buildClaimInstruction(claimSubject, supporting) },
          ],
          stream: false,
        }),
      });
      if (!rc.ok) {
        const errText = await rc.text().catch(() => '');
        console.error('[claim] upstream', rc.status, errText.slice(0, 200));
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${rc.status}` } })}\n\n`);
        return res.end();
      }
      const cPayload = await rc.json();
      const cDrafted = (cPayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      // The model contributes no card here either, on any route.
      const cDraft = cDrafted
        .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
        .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
        .trim();

      const cVerdict = verifyClaims(cDraft, claimSubject, retrievedPages);
      clearKeepAlive();
      if (!cVerdict.ok) {
        console.warn('[claim] draft rejected:', cVerdict.problems.join(' | '));
        res.write(`data: ${JSON.stringify({
          type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: CLAIM_REFUSAL },
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
        return res.end();
      }
      // ONE card, and it is the page that actually addresses the expression when there is one.
      // Otherwise it is the general source the reply was told to present AS a general principle.
      const cardFrom = pickVerifiedSources(supporting.length ? supporting : retrievedPages, 1);
      const cCard = cardFrom.length ? '\n' + cardFrom[0].tag : '';
      console.log('[claim] verified', { supporting: supporting.length, card: cardFrom.length });
      // Same rule as the streaming branch: the note follows a real sourced answer, never
      // replaces one.
      const cNote = attributionNote ? '\n\n' + attributionNote : '';
      const cScreened = attributionProblems(cDraft + cNote);
      if (cScreened && cScreened.dropWhole) return emitOnce(withPresence(refusalFor(cScreened)));
      const cBody = cScreened ? cScreened.text : (cDraft + cNote);
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: seal(cBody) + referralBlockFor(cBody) + cCard },
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      return res.end();
    }

    // ── ABOUT_ENTITY: a page ABOUT a man never becomes a page BY him ────────
    //
    // WHY THIS BRANCH EXISTS AT ALL. Routing «هل خالف ابن تيمية أهل السنة؟» to the ordinary
    // sourced answer is the fix — the shipped path refused it outright, unsearched. But the
    // ordinary sourced answer STREAMS, and a streamed reply cannot be checked before the reader
    // sees it. So the one class of question where the failure mode is specifically "the model
    // writes «قال ابن تيمية» about a page that merely discusses him" is buffered instead, and
    // lib/policy/attribution-grades.js decides deterministically whether the draft crossed that
    // line. Same single model call round 2 would have cost; `stream: false` is the only change.
    //
    // FAIL-CLOSED, AND NOT SILENTLY. A draft that attributes speech is dropped whole rather than
    // edited down, and the reader is told plainly that we can report what sources SAY ABOUT him
    // and will not put words in his mouth.
    if (plan.claimRelation === 'ABOUT_ENTITY') {
      const aboutInstruction = [
        'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
        'السؤالُ هنا عن العالِمِ نفسِه — عن حالِه أو موقفِه أو ما قيل فيه — وليس طلبًا لفتواه.',
        '- انقلْ ما تقولُه المصادرُ المسترجَعةُ عنه، منسوبًا إلى المصدرِ الذي قاله.',
        '- لا تكتبْ «قال الشيخ» ولا «يرى الشيخ» ولا أيَّ صيغةٍ تجعلُ كلامَ المصدرِ كلامًا له.',
        '- لا تُصدرْ حكمًا على شخصٍ حيٍّ بتكفيرٍ أو تبديعٍ أو تفسيقٍ ولا تتحدّثْ عن نيّته.',
        '- إن اختلفتِ المصادر، فاذكرِ الاختلافَ منسوبًا لأصحابه دون ترجيح.',
      ].join('\n');
      const ra2 = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [...round2Messages, { role: 'user', content: aboutInstruction }],
          stream: false,
        }),
      });
      if (!ra2.ok) {
        const errText = await ra2.text().catch(() => '');
        console.error('[about] upstream', ra2.status, errText.slice(0, 200));
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${ra2.status}` } })}\n\n`);
        return res.end();
      }
      const aPayload = await ra2.json();
      const aDraft = (aPayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
        .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
        .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
        .trim();
      const crossed = violatesTemplate(aDraft, { relation: 'ABOUT_ENTITY', grade: 'C' });
      console.log('[about]', { entity: plan.requestedAuthorityId || (plan.entities[0] || {}).canonicalId || '', crossed });
      if (crossed || !aDraft) {
        // «إلى أحدٍ», not «إلى العالِم»: this sentence must not confer the standing it is in the
        // middle of declining to act on. Same correction as NO_ATTRIBUTION_AVAILABLE, same reason.
        return emitOnce('أستطيع أن أنقل لك ما ذكرته المصادر المعتمدة عن هذه المسألة، لكنّي لا أنسب إلى أحدٍ قولًا لم أقف عليه في نصٍّ له. أعِدْ صياغة سؤالك عمّا تريد معرفته بالتحديد وأنقل لك ما في المصادر بمصدره.');
      }
      return emitOnce(aDraft + '\n' + canonicalSources.map((c) => c.tag).join('\n'));
    }

    // ── CONSISTENCY_GATE: credited AND disclaimed cannot both be true ───────
    //
    // THE MEASURED FAILURE. «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا؟» came back with his position
    // stated as fact, a quotation attributed to مجموع الفتاوى, the majority view, his view called
    // weak and a recommendation to make up the prayer — and then «لم أقف على نصٍّ مباشرٍ للشيخ ابن
    // تيميه» in the same reply. Both halves cannot be true, and the authoritative-sounding half was
    // the unsupported one.
    //
    // The handler already INSTRUCTS the model not to attribute anything here. It attributed anyway.
    // An instruction is a request; this is a gate — and like the ABOUT_ENTITY branch above it
    // buffers, because a streamed reply cannot be checked before the reader has already read it.
    //
    // WHAT SURVIVES: a grade-C transmission that credits the SOURCE — «ذكر موقع إسلام ويب أن ابن
    // تيمية يرى…». What does not: his speech, a quotation of him, a bare «يرى ابن تيمية», and any
    // «لم أقف» in a branch where nothing of his was ever searched.
    if (attributionUnverified) {
      const r2b = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model, max_tokens: maxTokens, system, messages: round2Messages, stream: false,
        }),
      });
      if (!r2b.ok) {
        const errText = await r2b.text().catch(() => '');
        console.error('[consistency] upstream', r2b.status, errText.slice(0, 200));
        clearKeepAlive();
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `upstream ${r2b.status}` } })}\n\n`);
        return res.end();
      }
      const bPayload = await r2b.json();
      const bDraft = (bPayload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
        .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '')
        .replace(/<source\b[^>]*>?[\s\S]*$/i, '')
        .trim();
      const bScreened = attributionProblems(bDraft);
      if (!bDraft || (bScreened && bScreened.dropWhole)) {
        // DROPPED WHOLE when the credit IS the answer. A reply that credits him with a position we
        // never verified is not partly right; trimming it would leave the same claim in a shorter
        // form, and what remained would answer a question the reader did not ask.
        return emitOnce(withPresence(refusalFor(bScreened)));
      }
      // TRIMMED when the offence was an aside. The reader asked about the ruling and the ruling is
      // sourced; losing the whole answer over one invented clause costs him the thing he came for.
      const bBody = bScreened ? bScreened.text : bDraft;
      const bNote = attributionNote ? '\n\n' + attributionNote : '';
      const bCards = canonicalSources.length ? '\n' + canonicalSources.map((c) => c.tag).join('\n') : '';
      // FIRST, not last. «لا أعرف هذا الاسم» is the correction of a premise the reader is holding
      // while he reads the answer; placed at the end it arrives after he has already read the
      // ruling as though it were somebody's.
      return emitOnce((presenceLead ? presenceLead + '\n\n' : '') + bBody + bNote + referralBlockFor(bBody + bNote) + bCards);
    }

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

    // EVERY BYTE THE READER GETS, KEPT. The streamed route cannot look at a finished draft before
    // deciding what to append to it — there is no finished draft until the stream is over — so the
    // prose is accumulated as it goes and the referral decision is taken at the end, against what
    // was actually said. Bounded, because an unbounded accumulator on a streaming path is a leak:
    // the tail-detection phrases are short, and the last few kilobytes are where a closing sentence
    // lives.
    const SEEN_TAIL_MAX = 8192;
    let seenText = '';
    const writeText = (t) => {
      if (!t) return;
      seenText = (seenText + t).slice(-SEEN_TAIL_MAX);
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t },
      })}\n\n`);
    };
    // THE UNREGISTERED-NAME LINE GOES OUT BEFORE THE FIRST TOKEN OF THE ANSWER. On the streamed
    // route there is no "prepend" available after the fact, and appending it would put the
    // correction after the reader has already read the ruling as somebody's opinion.
    if (presenceLead) writeText(presenceLead + '\n\n');
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
      // The unattributed note rides ahead of the cards, so the reader reaches it having
      // already read the ruling: "here is the ruling and its source — and it is not his".
      // It is appended ONLY here, i.e. only on a reply that actually carried a verified
      // source, which is what stops it from ever becoming the whole answer.
      // The referral rides between the note and the cards, so the reader reaches it having read
      // the ruling and before the sources — and the cards stay the last thing in the reply, which
      // the client's tag scanner depends on.
      // ...and it is appended ONCE. `seenText` is what the reader has actually been sent, so a
      // draft that already ended at ahl al-'ilm gets nothing further — the measured double tail on
      // «حكم بيع الذهب بالتقسيط» was the model's sentence and the server's arriving together.
      const rTail = referralBlockFor(seenText);
      writeText((attributionNote ? '\n\n' + attributionNote + '\n' : '')
        + (rTail ? rTail + '\n' : '')
        + canonicalSources.map((c) => c.tag).join('\n'));
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
