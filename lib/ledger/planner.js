// lib/ledger/planner.js
// THE ONE MODEL CALL THAT READS THE READER'S QUESTION, AND THE ONE WHOSE OUTPUT IS A
// DESCRIPTION RATHER THAN AN INSTRUCTION.
//
// It is asked what the question IS — how many distinct issues, what kind each one is, which
// words may not be dropped, whose position was asked for, what a complete answer would have to
// contain. It is never asked what to search for. lib/ledger/query-build.js does that, in code,
// from the answer.
//
// THE AUTHORITY ROSTER IS SHOWN, NOT GUESSED AT. A model asked to name a scholar will name one;
// showing it the exact set of owner ids the registry knows turns "who did he mean" from a
// generation problem into a selection problem, and anything outside the set is rejected by
// lib/ledger/query-ir.js regardless.

import { INTENTS, capabilityForIntent } from './capability.js';
import {
  SLOTS, TEMPORAL_SCOPES, CONFIDENCE, MAX_ISSUES, MAX_TERMS_PER_FIELD, MAX_TERM_CHARS,
  IR_DEFAULTS, validateQueryPlan, buildPolicyBlock,
} from './query-ir.js';
import { POLICY_ROWS, eligibleSites } from './source-policy.js';
import { substantiveTerms } from './query-build.js';
import { classifyTopic } from '../policy/core.js';
import { isReligiousText } from '../route-classify.js';
import { callModel, parseJsonReply } from './model.js';

export const PLANNER_VERSION = 'plan-v1';

/** The owner ids a question may legitimately name. Derived, never hand-listed. */
export function knownAuthorityIds() {
  return Array.from(new Set(POLICY_ROWS
    .filter((r) => r.health === 'enabled' && r.ownerId)
    .map((r) => r.ownerId))).sort();
}

const SYSTEM = [
  'أنت مُحلِّلُ أسئلةٍ شرعيّة. مهمَّتُك وصفُ السؤالِ فقط، لا الإجابةُ عنه ولا البحثُ له.',
  'ممنوعٌ أن تُخرِجَ استعلامَ بحثٍ أو نطاقًا أو رابطًا أو اسمَ موقع. أنت تصفُ، ولا تأمر.',
  'ممنوعٌ أن تذكرَ حكمًا أو دليلًا أو رأيًا.',
  'وإن كان السؤالُ يحتملُ معنيين، أو ينقصُه قيدٌ يتغيَّرُ به الحكم، فقُلْ ذلك في missing_qualifiers واخفِضِ الثقة.',
  'أجِبْ بـ JSON فقط، بلا شرحٍ ولا نصٍّ خارجَ الكائن.',
].join('\n');

// ── THE EXAMPLE MUST BE A VALID ANSWER ───────────────────────────────────────
//
// MEASURED, batch 5: EVERY ledger request came back PLAN_INVALID -> SAFE_REJECTION with
// `model: 1, brave: 0, fetch: 0` — one planner call and then a refusal, without ever searching.
// The cause was here, in the request rather than in the reply. The prompt printed a template and
// told the model to reproduce it «حرفيًّا», and that template was itself refused by
// lib/ledger/query-ir.js three separate ways:
//
//   1. THE ALTERNATIONS WERE PRINTED AS VALUES. `"intent": "fatwa|tafsir|…"` is not one of the
//      intents; it is all of them joined by a pipe. A model doing exactly as it was told sent
//      that string back and failed on `intent` and on `temporal_scope` and on `confidence`.
//   2. EVERY ARRAY WAS PRINTED EMPTY, and an issue carrying no core term, protected entity or
//      exact phrase is refused — while `core_terms`, the field whose emptiness is fatal, was the
//      one field the filling rules never mentioned at all.
//   3. AN INVENTED FIELD IS A HARD REFUSAL, and the only instruction against one said «no TEXT
//      outside the object» — which a model obeys while adding a `reasoning` key INSIDE it.
//
// The validator is right on all three counts and is NOT relaxed: refusing an unknown key is a
// real defence («the next invented field might be `sites`»). What changes is that the model is
// now shown a template that would pass, and told the rules it was being judged by.
//
// The example is built from a fixed, obviously-fake question so no reader's words leak into it,
// and its values are read from the same constants the validator reads.
export function buildPlannerPrompt(question) {
  return [
    'السؤال:',
    String(question || '').slice(0, 1200),
    '',
    'أعِدْ كائنَ JSON بهذه الحقولِ بالضبط — لا حقلَ زيادةً ولا حقلَ نقصًا:',
    '{',
    '  "issues": [{',
    '    "issue_id": "iss_1",',
    '    "intent": "fatwa",',
    '    "requested_authority_id": null,',
    '    "protected_entities": ["صيام يوم عرفة"],',
    '    "core_terms": ["حكم", "صيام"],',
    '    "context_vars": ["لغير الحاج"],',
    '    "exact_user_phrases": [],',
    '    "required_slots": ["ruling"],',
    '    "dependencies": [],',
    '    "temporal_scope": "unknown"',
    '  }],',
    '  "missing_qualifiers": [],',
    '  "confidence": "high"',
    '}',
    '',
    'هذا مثالٌ مملوءٌ لسؤالٍ آخر. املأْ حقولَه من سؤالِ صاحبِنا أعلاه، والقيمُ المسموحةُ:',
    '- intent: واحدةٌ فقط من: ' + INTENTS.join('، ') + '.',
    '- temporal_scope: واحدةٌ فقط من: ' + TEMPORAL_SCOPES.join('، ') + '.',
    '- confidence: واحدةٌ فقط من: ' + CONFIDENCE.join('، ') + '.',
    '',
    'قواعدُ التعبئة:',
    '- عددُ المسائلِ بحسبِ بنيةِ السؤالِ لا طولِه، وبحدٍّ أقصى ' + MAX_ISSUES + '.',
    '- core_terms: كلماتُ السؤالِ الجوهريّة. لا يجوزُ أن تكونَ فارغةً — مسألةٌ بلا core_terms'
      + ' ولا protected_entities ولا exact_user_phrases مسألةٌ مرفوضة.',
    '- protected_entities: ما لا يجوزُ حذفُه من السؤالِ — اسمُ العالِمِ أو الجهةِ أو الشيءِ محلِّ الحكم.',
    '- exact_user_phrases: العبارةُ التي سألَ عنها بنصِّها إن كان السؤالُ عن عبارةٍ بعينِها.',
    '- required_slots من هذه القائمةِ فقط: ' + SLOTS.join('، ') + '.',
    '- requested_authority_id لا يكونُ إلا واحدًا من: ' + knownAuthorityIds().join('، ') + '، وإلا فاجعلْه null.',
    '- إن سُئلَ عن رأيِ شيخٍ ولم يُسمِّه، أو سُئلَ عن مقطعٍ لم يُرسِلْه، فاذكرْ ذلك في missing_qualifiers.',
    '- «بيع الذهب» و«ذهب إلى المسجد» ليسا نسبةً إلى أحد؛ النسبةُ أن يُطلبَ رأيُ شخصٍ بعينِه.',
    '- لا تُضِفْ أيَّ حقلٍ غيرَ الحقولِ المذكورةِ أعلاه — لا "reasoning" ولا "notes" ولا غيرَهما.'
      + ' حقلٌ زائدٌ يُبطِلُ الجوابَ كلَّه.',
  ].join('\n');
}

// ── THE PLAN CALL USES THE REQUEST'S SERVER-OWNED TIER ───────────────────────
//
// api/ask.js decides entitlement once, after the founder-token check, and the seam and engine
// carry that primitive here. The planner neither reads a request body nor infers entitlement from
// depth, prose or model names. Only an own, exact `premium` value survives this boundary; missing,
// inherited and malformed values fail closed to Standard. The same immutable value is reused by
// the one repair call, so retrying a malformed plan cannot change the request's tier.

// ── THE REPAIR CALL: ONE, CONSTRAINED, NAMING THE VIOLATIONS BY THEIR TEXT ───
//
// The first call already produced a reply; what it did not produce was a valid one. Asking again
// with the SAME prompt would be sampling until the answer is convenient — lib/ledger/model.js
// forbids that by name, and rightly. This is a different request: it shows the model its own
// output, names each violation in the validator's own words, and asks for a correction. It runs
// AT MOST ONCE, so there is no loop and no ladder of retries.
export function buildRepairPrompt(question, badReply, problems) {
  return [
    'أعدتَ كائنَ JSON لا يقبلُه المدقِّق. صحِّحْه.',
    '',
    'السؤالُ الأصليّ:',
    String(question || '').slice(0, 1200),
    '',
    'ما أعدتَه:',
    String(badReply || '').slice(0, 4000),
    '',
    'المخالفاتُ بنصِّها كما سجّلها المدقِّق:',
    ...(problems || []).slice(0, 8).map((p) => '- ' + String(p).slice(0, 200)),
    '',
    // THE THREE RECORDED SIGNATURES, restated where they can be acted on. These are the failure
    // modes measured in batch 5 and recorded in this file's own header; a repair prompt that did
    // not name them would be inviting the same reply a second time.
    'وهذه أشهرُ ثلاثِ عللٍ مسجَّلةٍ في هذا النظام، فتفقَّدْها في جوابِك:',
    '١) لا تكتبْ قائمةَ الخياراتِ قيمةً. «fatwa|tafsir|…» ليست نيّةً، بل كلُّ النيّاتِ'
      + ' موصولةً بخطّ. اخترْ واحدةً بعينِها.',
    '٢) لا تتركِ المصفوفاتِ فارغةً كلَّها. مسألةٌ بلا core_terms ولا protected_entities ولا'
      + ' exact_user_phrases مسألةٌ مرفوضة.',
    '٣) لا تُضِفْ حقلًا لم يُذكَرْ — ولا "reasoning" ولا "notes". «لا نصَّ خارجَ الكائن» لا'
      + ' تعني «أضِفْ حقلًا داخلَه».',
    '',
    'أعِدْ كائنَ JSON المصحَّحَ وحدَه، بلا شرحٍ ولا اعتذار.',
  ].join('\n');
}

// ── THE DETERMINISTIC FLOOR: A PLAN BUILT FROM THE QUESTION, WITH NO MODEL ───
//
// WHAT THIS EXISTS FOR. Until 2026-08-07 `!planned.ok` in lib/ledger/engine.js jumped straight
// over ORCHESTRATE_BATCHES to the assembly and refused — so a malformed model reply became
// «لم أعثر ضمن المصادر المتاحة» with `brave_calls: 0`, a sentence reporting a search that never
// happened. That is the specific dishonesty RFC v0.5-R2 §7 forbids. With this floor in place the
// engine ALWAYS has a plan to run, so a refusal is always a refusal AFTER looking.
//
// NOTHING HERE IS GUESSED:
//   * the terms are the reader's own substantive words (lib/ledger/query-build.js owns the
//     stop-list, so there is exactly one);
//   * the intent comes from lib/policy/core.js's deterministic classifier, the same one the
//     engine already runs on every request — not from a model and not from a default;
//   * the classified intent is then CHECKED against the band's actual eligible sources, and only
//     falls back when the measurement says nothing could answer it.
//
// WHAT IT DELIBERATELY DOES NOT DO. It names no authority: `requested_authority_id` stays null,
// so the search is the broad one and attribution stays governed by the policy block, which
// buildPolicyBlock() derives from the reader's words independently of anything here. It declares
// no missing qualifier and does not claim low confidence — either would re-open the door this
// whole arm exists to close, a refusal that never searched.
const TOPIC_TO_INTENT = Object.freeze({
  tafsir: 'tafsir',
  hadith: 'hadith_text',
  sharia_ruling: 'fatwa',
  // A named authority still gets a RULING search, not a `scholar_opinion` one. Measured:
  // `scholar_opinion` maps to the `scholar_opinion_primary` capability, for which exactly ONE
  // domain is eligible — so a fallback that chose it would usually plan a search of nothing and
  // refuse without looking, which is the failure this arm exists to remove. The general ruling IS
  // documented and citable; whose it is stays governed by the policy block and the provenance cap.
  // This is the same trade lib/ledger/engine.js already makes for a capped authority.
  scholar_position: 'fatwa',
  quote_verification: 'fatwa',
});
// Tried in order when the classified intent has no eligible source in this band. Widest first,
// measured against the full enabled registry: general_article 22 domains, fatwa 14.
const INTENT_FALLBACK_ORDER = Object.freeze(['fatwa', 'general']);

export function deterministicPlanIR(question, { bandSites } = {}) {
  const text = String(question || '');
  const topic = classifyTopic(text, buildPolicyBlock(text, []));
  // A SECOND MEASURED CLASSIFIER, AND IT NARROWS RATHER THAN WIDENS. classifyTopic() answers
  // «what is this about» from topic vocabulary, and «كيف أصلي في الطائرة؟» carries no ruling
  // word — measured: it comes back `general_knowledge`, which would plan against the widest
  // capability there is. lib/route-classify.js's isReligiousText() is the deterministic reader
  // the shipped text path already routes on, it says yes to that sentence, and `fatwa` restricts
  // the search to the fatwa-eligible sources rather than every general article. Using it is
  // reading a measurement the system already takes; guessing an intent here is what rule-9
  // forbids, and this is not that.
  const classified = TOPIC_TO_INTENT[topic]
    || (isReligiousText(text) ? 'fatwa' : 'general');

  // MEASURED, NOT ASSUMED: an intent whose capability nothing in this band can serve would plan
  // a search of zero domains and refuse without a request. Only a band that can serve NOTHING is
  // left unanswerable, and that is a fact about the band rather than about this plan.
  const sites = Array.isArray(bandSites) ? bandSites : [];
  const servable = (i) => !sites.length || eligibleSites(sites, capabilityForIntent(i)).length > 0;
  const intent = [classified, ...INTENT_FALLBACK_ORDER].find(servable) || classified;

  // EVERYTHING GOES IN core_terms, none of it in protected_entities, and that is a robustness
  // choice rather than an oversight: lib/ledger/query-build.js may never drop a protected term,
  // so a long question with everything protected would refuse with `protected_terms_too_long` —
  // a refusal without a search, through the last door left open. Core terms give ground until
  // the query fits.
  let terms = substantiveTerms(text, { maxTerms: MAX_TERMS_PER_FIELD, maxChars: MAX_TERM_CHARS });
  // A question that is ALL filler still gets searched, on its own words. Only an empty question
  // has nothing to look for, and the validator refuses that on its own.
  if (!terms.length && text.trim()) terms = [text.trim().slice(0, MAX_TERM_CHARS)];

  return {
    issues: [{
      issue_id: 'iss_1',
      intent,
      requested_authority_id: null,
      protected_entities: [],
      core_terms: terms,
      context_vars: [],
      exact_user_phrases: [],
      required_slots: [],
      dependencies: [],
      temporal_scope: IR_DEFAULTS.temporal_scope,
    }],
    missing_qualifiers: [],
    confidence: IR_DEFAULTS.confidence,
  };
}

/**
 * @returns {{ok:boolean, plan:object|null, problems:string[], problemFields:string[],
 *            repairs:string[], repairMessages:string[], authorityRefusals:Array,
 *            reason?:string, degraded:''|'repair'|'minimal'}}
 *
 * A model failure and a schema failure are reported separately, because the first is transient
 * and the second is the model doing something it was told not to.
 *
 * ── THREE ARMS, AND THE LAST ONE CANNOT FAIL ─────────────────────────────────
 *   1. the plan call. Valid → done, `degraded: ''`.
 *   2. ONE repair call, naming the violations by their text. Valid → `degraded: 'repair'`.
 *   3. the deterministic floor, no model at all → `degraded: 'minimal'`.
 *
 * Arm 3 is what makes «refused without searching» structurally impossible FOR A PLAN: it needs no
 * network, no key, no budget and no model, so no shape of model reply can end a request before the
 * first query. That is the whole of what arm 3 buys, and this paragraph used to claim more.
 *
 * ── THE FOURTH EXIT, AND THE THREE-SURVIVOR CLAIM WAS INCOMPLETE (measured 2026-08-08) ───────
 *
 * The sentence this replaces ended: «the only remaining reasons a request does not search are the
 * day's ceiling, an empty question, and a band with no eligible source». It was an enumeration, it
 * was wrong by omission, and the FIRST public probe of the opened engine landed on the term it
 * omitted. Against production with `RFC_V05_MODE=public`, «ما حكم شراء الذهب بالتقسيط؟» returned
 * `[ledger] { outcome: 'SAFE_REJECTION', model: 1, brave: 0, fetch: 0 }` — no search, no cards —
 * and none of the three listed reasons applied to it.
 *
 * The fourth is lib/ledger/engine.js's `needsFollowUp(plan)` branch. It sits ABOVE
 * ORCHESTRATE_BATCHES and returns `{outcome:'SAFE_REJECTION', text: followUpText(plan), cards: []}`
 * whenever the plan carries `confidence: 'low'` or a non-empty `missing_qualifiers`. A request that
 * takes it never reaches a query, so `brave: 0` is its NORMAL reading, not a symptom.
 *
 * ── AND IT IS LEGAL, WHICH IS WHY IT IS LISTED RATHER THAN CLOSED ────────────────────────────
 *
 * It is not arm 3 failing, and it cannot be: deterministicPlanIR() hardcodes
 * `missing_qualifiers: []` and `confidence: IR_DEFAULTS.confidence` (`medium`), so the floor can
 * never reach that branch. A follow-up question therefore PROVES a model plan rather than a
 * degraded one, and `model: 1` on the counts line then pins it to arm 1 — the two degraded arms
 * cost a second call, and lib/ledger/model.js spends `modelCalls` before the fetch, so even a
 * failed call is counted. The reader is asked a question because the planner did its job and
 * found a real ambiguity. That is a different event from a refusal, and reading it as one is what
 * this comment now exists to prevent.
 *
 * So the honest enumeration is FOUR: the day's ceiling, an empty question, a band with no eligible
 * source, and a plan that names a missing qualifier. Only the first three are failures.
 */
export async function planQuestion(question, options = {}) {
  const opts = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const { budget, fetchImpl, bandSites } = opts;
  const tier = Object.prototype.hasOwnProperty.call(opts, 'tier') && opts.tier === 'premium'
    ? 'premium' : 'standard';
  const floor = () => {
    const v = validateQueryPlan(deterministicPlanIR(question, { bandSites }), question);
    return { ...v, reason: v.ok ? '' : 'minimal-plan-invalid', degraded: 'minimal' };
  };

  const res = await callModel({
    system: SYSTEM, user: buildPlannerPrompt(question),
    budget, purpose: 'query_ir', tier, fetchImpl, maxTokens: 900,
  });
  // A MODEL THAT NEVER ANSWERED SKIPS THE REPAIR CALL. There is nothing to repair — no reply to
  // show it and no violation to name — and a second call under a budget or a timeout that just
  // refused the first is a call that will refuse again. Straight to the floor.
  if (!res.ok) return { ...floor(), reason: 'model:' + res.reason };

  const raw = parseJsonReply(res.text);
  const first = raw
    ? validateQueryPlan(raw, question)
    : { ok: false, problems: ['reply was not JSON'], problemFields: ['plan'] };
  if (first.ok) return { ...first, reason: '', degraded: '' };

  // ── ARM 2 ──
  const fixed = await callModel({
    system: SYSTEM,
    user: buildRepairPrompt(question, res.text, first.problems),
    budget, purpose: 'query_ir', tier, fetchImpl, maxTokens: 900,
  });
  if (fixed.ok) {
    const rawFixed = parseJsonReply(fixed.text);
    if (rawFixed) {
      const second = validateQueryPlan(rawFixed, question);
      if (second.ok) return { ...second, reason: 'repaired', degraded: 'repair' };
    }
  }

  // ── ARM 3 ──
  return floor();
}
