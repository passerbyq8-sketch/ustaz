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

export function buildPlannerPrompt(question) {
  return [
    'السؤال:',
    String(question || '').slice(0, 1200),
    '',
    'صِفْه بهذا الشكلِ حرفيًّا:',
    '{',
    '  "issues": [{',
    '    "issue_id": "iss_1",',
    '    "intent": "' + INTENTS.join('|') + '",',
    '    "requested_authority_id": null,',
    '    "protected_entities": [],',
    '    "core_terms": [],',
    '    "context_vars": [],',
    '    "exact_user_phrases": [],',
    '    "required_slots": [],',
    '    "dependencies": [],',
    '    "temporal_scope": "' + TEMPORAL_SCOPES.join('|') + '"',
    '  }],',
    '  "missing_qualifiers": [],',
    '  "confidence": "' + CONFIDENCE.join('|') + '"',
    '}',
    '',
    'قواعدُ التعبئة:',
    '- عددُ المسائلِ بحسبِ بنيةِ السؤالِ لا طولِه، وبحدٍّ أقصى ' + MAX_ISSUES + '.',
    '- protected_entities: ما لا يجوزُ حذفُه من السؤالِ — اسمُ العالِمِ أو الجهةِ أو الشيءِ محلِّ الحكم.',
    '- exact_user_phrases: العبارةُ التي سألَ عنها بنصِّها إن كان السؤالُ عن عبارةٍ بعينِها.',
    '- required_slots من هذه القائمةِ فقط: ' + SLOTS.join('، ') + '.',
    '- requested_authority_id لا يكونُ إلا واحدًا من: ' + knownAuthorityIds().join('، ') + '، وإلا فاجعلْه null.',
    '- إن سُئلَ عن رأيِ شيخٍ ولم يُسمِّه، أو سُئلَ عن مقطعٍ لم يُرسِلْه، فاذكرْ ذلك في missing_qualifiers.',
    '- «بيع الذهب» و«ذهب إلى المسجد» ليسا نسبةً إلى أحد؛ النسبةُ أن يُطلبَ رأيُ شخصٍ بعينِه.',
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
