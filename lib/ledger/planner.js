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

import { INTENTS } from './capability.js';
import { SLOTS, TEMPORAL_SCOPES, CONFIDENCE, MAX_ISSUES, validateQueryPlan } from './query-ir.js';
import { POLICY_ROWS } from './source-policy.js';
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

/**
 * @returns {{ok:boolean, plan:object|null, problems:string[], authorityRefusals:Array, reason?:string}}
 * A model failure and a schema failure are reported separately, because the first is transient
 * and the second is the model doing something it was told not to.
 */
export async function planQuestion(question, { budget, fetchImpl, tier } = {}) {
  const res = await callModel({
    system: SYSTEM, user: buildPlannerPrompt(question),
    budget, purpose: 'query_ir', tier, fetchImpl, maxTokens: 900,
  });
  if (!res.ok) return { ok: false, plan: null, problems: [], authorityRefusals: [], reason: 'model:' + res.reason };

  const raw = parseJsonReply(res.text);
  if (!raw) return { ok: false, plan: null, problems: ['reply was not JSON'], authorityRefusals: [], reason: 'unparseable' };

  const v = validateQueryPlan(raw, question);
  return { ...v, reason: v.ok ? '' : 'schema' };
}
