// lib/ledger/query-ir.js
// THE QUERY PLAN IR — the only shape a model is allowed to hand this engine, and the
// validator that decides whether what came back is that shape.
//
// THE RULE THIS FILE ENFORCES: THE MODEL PROPOSES A DESCRIPTION, NEVER AN INSTRUCTION.
// It may say "this question has two issues, one is a ruling, the reader named Ibn Baz, these
// words are load-bearing". It may NOT hand back an executable search string, a domain, a site:
// filter, a URL, or a source id. lib/ledger/query-build.js turns the description into queries
// deterministically, so a prompt-injected page or a hallucinated domain has nothing to steer.
//
// EVERYTHING IS CHECKED IN CODE, NOT IN THE PROMPT: the enum values, the array bounds, the
// string lengths, the id shapes, the dependency graph, and — the one that matters most — that
// `requested_authority_id` names somebody the registry actually knows. A prompt that asks
// nicely for valid output is a suggestion; this is the gate.

import { INTENTS, isIntent } from './capability.js';
import { primaryOpinionAdapter } from './source-policy.js';

// ── bounds ───────────────────────────────────────────────────────────────────
// Chosen so a genuine compound question fits and a runaway one is refused rather than
// silently truncated. Every one of these is asserted by ledger-contract-guard.cjs.
export const MAX_ISSUES = 3;
export const MAX_TERMS_PER_FIELD = 12;
export const MAX_TERM_CHARS = 60;
export const MAX_SLOTS_PER_ISSUE = 6;
export const MAX_PHRASE_CHARS = 160;

export const TEMPORAL_SCOPES = Object.freeze([
  'unknown', 'dated_fact', 'current_context', 'historical_context',
]);
export const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);

// Answer slots. A slot is a part of the question the reader will notice is missing — so the
// planner declares them up front and the ledger tracks which ones verified evidence filled.
// Deterministic templates (below) add the ones a model is prone to drop.
// A SINGLE `ruling` SLOT CAN HIDE A HALF-ANSWERED QUESTION. «ما رأي الشيخ ابن عثيمين فيمن أسقطت
// قبل ثمانين يومًا؟ وهل تصلي وتصوم؟» asks four separable things: the condition that ties the
// ruling to her case, the ruling on PRAYER, the ruling on FASTING, and whose position it is.
// With one generic `ruling` slot, evidence covering prayer alone filled it and the reply reported
// FULL — complete by its own bookkeeping and half-complete to the reader. So the acts a reader
// asks about separately are tracked separately.
export const SLOTS = Object.freeze([
  'ruling',                 // the verdict itself, where the question asks for only one
  'condition_context',      // the circumstance that makes this ruling the reader's ruling
  'prayer_ruling',          // the ruling on prayer, when prayer is asked about in its own right
  'fasting_ruling',         // the ruling on fasting, likewise
  'condition',              // when it applies
  'exception',              // when it does not
  'evidence',               // the Quranic/prophetic basis, where the source gives one
  'attribution',            // whose position this is
  'hadith_wording',         // the narration as published
  'hadith_grading',         // its grade, as published
  'meaning',                // what a verse or a narration means
  'practical_steps',        // how to actually do it
]);
const SLOT_SET = new Set(SLOTS);

// Bare identifiers only: lower-case, digits, underscore, hyphen. Owner ids in the source policy
// are hyphenated (`ibn-baz`, `al-abbaad`), so the hyphen is admitted — but nothing else is, which
// is what stops a model returning a name, a domain or a URL where an id belongs.
const ID_RE = /^[a-z][a-z0-9_-]{0,39}$/;

// ── deterministic slot templates ─────────────────────────────────────────────
// WHY THESE ARE NOT LEFT TO THE MODEL. A planner that forgets a slot produces an answer that
// is complete by its own lights and incomplete by the reader's — «كيف أصلي في الطائرة؟» whose
// answer never says HOW. These are added to whatever the model asked for; they are never
// subtracted, so a model that asks for more still gets more.
const REQUIRED_SLOTS_BY_INTENT = Object.freeze({
  fatwa: ['ruling'],
  tafsir: ['meaning'],
  hadith_text: ['hadith_wording'],
  hadith_grading: ['hadith_wording', 'hadith_grading'],
  hadith_explanation: ['meaning'],
  scholar_opinion: ['ruling', 'attribution'],
  general: [],
});

// A question that asks HOW gets a practical-steps slot whether or not the planner noticed.
const HOW_MARKERS = ['كيف', 'صفة', 'كيفية', 'طريقة', 'ماذا افعل', 'ماذا أفعل'];

// AN ACT NAMED IN THE QUESTION IS A COVERAGE OF ITS OWN. A reader who writes «وهل تصلي وتصوم؟»
// has asked two things, and an answer that establishes one of them has answered half. These are
// added deterministically, from the reader's own words, so the planner cannot collapse them into
// one `ruling` by labelling them that way.
const ACT_SLOTS = [
  { slot: 'prayer_ruling', markers: ['تصلي', 'الصلاة', 'يصلي', 'أصلي', 'اصلي', 'صلاتها'] },
  { slot: 'fasting_ruling', markers: ['تصوم', 'الصيام', 'الصوم', 'يصوم', 'أصوم', 'اصوم', 'تفطر'] },
];
// The circumstance a ruling hangs on. A duration or a stated case is a condition the answer must
// actually address, not an assumption it may quietly make.
const CONDITION_MARKERS = ['قبل', 'بعد', 'دون', 'إذا', 'اذا', 'حال', 'بسبب', 'لأجل', 'لاجل'];
const HAS_NUMBER = /[0-9٠-٩]|ثمانين|أربعين|اربعين|عشرين|ثلاثين|مئة|ماىة/;

export function templateSlots(intent, questionText) {
  const base = REQUIRED_SLOTS_BY_INTENT[intent] || [];
  const out = new Set(base);
  const t = String(questionText || '');
  if (HOW_MARKERS.some((m) => t.includes(m))) out.add('practical_steps');

  // Only for questions that actually ask for a ruling. A tafsir or hadith-wording question that
  // happens to mention prayer is not asking for the ruling on prayer.
  const wantsRuling = intent === 'fatwa' || intent === 'scholar_opinion';
  if (wantsRuling) {
    const acts = ACT_SLOTS.filter((a) => a.markers.some((m) => t.includes(m)));
    for (const a of acts) out.add(a.slot);
    // Naming the acts REPLACES the generic slot: keeping both would let evidence about prayer
    // fill `ruling` and make the reply look complete while fasting is still unanswered.
    if (acts.length) out.delete('ruling');
    if (CONDITION_MARKERS.some((m) => t.includes(m)) && HAS_NUMBER.test(t)) out.add('condition_context');
  }
  return Array.from(out);
}

// ── validation ───────────────────────────────────────────────────────────────
const isStr = (v) => typeof v === 'string';

function strArray(value, field, problems, { maxItems = MAX_TERMS_PER_FIELD, maxChars = MAX_TERM_CHARS } = {}) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) { problems.push(field + ': not an array'); return []; }
  if (value.length > maxItems) { problems.push(field + ': more than ' + maxItems + ' entries'); return []; }
  const out = [];
  for (const v of value) {
    if (!isStr(v)) { problems.push(field + ': non-string entry'); continue; }
    const s = v.trim();
    if (!s) continue;
    if (s.length > maxChars) { problems.push(field + ': entry longer than ' + maxChars + ' chars'); continue; }
    out.push(s);
  }
  return out;
}

/**
 * Validate ONE issue. Returns { issue, problems }. A problem list that is non-empty means the
 * issue is rejected — there is no partial acceptance of an issue, because a half-understood
 * question is the thing that produces a half-right ruling.
 */
function validateIssue(raw, index, questionText) {
  const problems = [];
  const p = (m) => problems.push('issue[' + index + '] ' + m);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { issue: null, problems: ['issue[' + index + '] is not an object'] };
  }

  const issueId = isStr(raw.issue_id) && ID_RE.test(raw.issue_id) ? raw.issue_id : null;
  if (!issueId) p('issue_id missing or not a bare identifier');

  if (!isIntent(raw.intent)) p('intent is not one of ' + INTENTS.join('|'));

  // AUTHORITY. Two separate refusals, and they are not the same refusal:
  //   * a value that is not a registered owner id at all — the model invented somebody;
  //   * a registered owner with no primary-opinion adapter — we know who he is and we have no
  //     corpus of his to read. That one is refused HERE, before a search is planned, which is
  //     what makes it cost nothing.
  let authority = null;
  if (raw.requested_authority_id !== undefined && raw.requested_authority_id !== null) {
    if (!isStr(raw.requested_authority_id) || !ID_RE.test(raw.requested_authority_id)) {
      p('requested_authority_id is not a bare identifier');
    } else {
      authority = raw.requested_authority_id;
    }
  }

  const protectedEntities = strArray(raw.protected_entities, 'issue[' + index + '].protected_entities', problems);
  const coreTerms = strArray(raw.core_terms, 'issue[' + index + '].core_terms', problems);
  const contextVars = strArray(raw.context_vars, 'issue[' + index + '].context_vars', problems);
  const exactPhrases = strArray(raw.exact_user_phrases, 'issue[' + index + '].exact_user_phrases',
    problems, { maxChars: MAX_PHRASE_CHARS });

  const askedSlots = Array.isArray(raw.required_slots) ? raw.required_slots : [];
  if (askedSlots.length > MAX_SLOTS_PER_ISSUE) p('required_slots exceeds ' + MAX_SLOTS_PER_ISSUE);
  const slots = new Set();
  for (const s of askedSlots.slice(0, MAX_SLOTS_PER_ISSUE)) {
    if (!isStr(s) || !SLOT_SET.has(s)) { p('unknown slot: ' + String(s).slice(0, 24)); continue; }
    slots.add(s);
  }
  // The deterministic templates are UNION'd in, never used to replace what was asked.
  if (isIntent(raw.intent)) for (const s of templateSlots(raw.intent, questionText)) slots.add(s);

  const deps = strArray(raw.dependencies, 'issue[' + index + '].dependencies', problems, { maxItems: MAX_ISSUES });
  for (const d of deps) if (!ID_RE.test(d)) p('dependency is not a bare identifier: ' + d.slice(0, 24));

  const temporal = TEMPORAL_SCOPES.includes(raw.temporal_scope) ? raw.temporal_scope : null;
  if (!temporal) p('temporal_scope is not one of ' + TEMPORAL_SCOPES.join('|'));

  // A question with no substantive term is not a plan. Refuse rather than search for nothing.
  if (!problems.length && !coreTerms.length && !protectedEntities.length && !exactPhrases.length) {
    p('carries no core term, protected entity or exact phrase');
  }

  if (problems.length) return { issue: null, problems };
  return {
    issue: Object.freeze({
      issueId,
      intent: raw.intent,
      requestedAuthorityId: authority,
      protectedEntities: Object.freeze(protectedEntities),
      coreTerms: Object.freeze(coreTerms),
      contextVars: Object.freeze(contextVars),
      exactUserPhrases: Object.freeze(exactPhrases),
      requiredSlots: Object.freeze(Array.from(slots)),
      dependencies: Object.freeze(deps),
      temporalScope: temporal,
    }),
    problems: [],
  };
}

/**
 * VALIDATE A WHOLE PLAN.
 *
 * @param {object} raw            what the model returned, already JSON-parsed
 * @param {string} questionText   the reader's own words, used only for slot templating
 * @returns {{ok:boolean, plan:object|null, problems:string[], authorityRefusals:object[]}}
 *
 * `authorityRefusals` is separated from `problems` on purpose. A named scholar with no
 * registered adapter is NOT a malformed plan — the model did its job correctly and the honest
 * outcome is a refusal of that ISSUE, with the rest of the question still answerable. Folding
 * it into `problems` would throw away a compound question because one half of it cannot be
 * attributed.
 */
export function validateQueryPlan(raw, questionText = '') {
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, plan: null, problems: ['plan is not an object'], authorityRefusals: [] };
  }
  // UNKNOWN TOP-LEVEL KEYS ARE A REFUSAL, not something to ignore. A model that invents a
  // field is a model that thinks it is allowed to; the next invented field might be `sites`.
  const ALLOWED_TOP = new Set(['issues', 'missing_qualifiers', 'confidence']);
  for (const k of Object.keys(raw)) {
    if (!ALLOWED_TOP.has(k)) problems.push('unknown top-level field: ' + k);
  }

  if (!Array.isArray(raw.issues) || raw.issues.length === 0) {
    problems.push('issues must be a non-empty array');
  } else if (raw.issues.length > MAX_ISSUES) {
    problems.push('more than ' + MAX_ISSUES + ' issues');
  }

  const missing = strArray(raw.missing_qualifiers, 'missing_qualifiers', problems);
  const confidence = CONFIDENCE.includes(raw.confidence) ? raw.confidence : null;
  if (!confidence) problems.push('confidence is not one of ' + CONFIDENCE.join('|'));

  const issues = [];
  const authorityRefusals = [];
  if (Array.isArray(raw.issues)) {
    const seen = new Set();
    raw.issues.slice(0, MAX_ISSUES).forEach((r, i) => {
      const { issue, problems: ip } = validateIssue(r, i, questionText);
      if (ip.length) { problems.push(...ip); return; }
      if (seen.has(issue.issueId)) { problems.push('duplicate issue_id: ' + issue.issueId); return; }
      seen.add(issue.issueId);
      issues.push(issue);
    });
    // Dependencies must point at issues that exist in THIS plan, and the graph must be acyclic.
    for (const iss of issues) {
      for (const d of iss.dependencies) {
        if (!seen.has(d)) problems.push('issue ' + iss.issueId + ' depends on unknown issue ' + d);
        if (d === iss.issueId) problems.push('issue ' + iss.issueId + ' depends on itself');
      }
    }
    const cyc = firstCycle(issues);
    if (cyc) problems.push('dependency cycle: ' + cyc.join(' -> '));
  }

  // AUTHORITY RESOLUTION, after the shape is known good. A scholar we cannot read is refused
  // as an issue rather than as a plan.
  for (const iss of issues) {
    if (!iss.requestedAuthorityId) continue;
    const adapter = primaryOpinionAdapter(iss.requestedAuthorityId);
    if (!adapter) {
      authorityRefusals.push({
        issueId: iss.issueId,
        authorityId: iss.requestedAuthorityId,
        reason: 'no_registered_primary_opinion_adapter',
      });
    }
  }

  if (problems.length || !issues.length) {
    return { ok: false, plan: null, problems, authorityRefusals };
  }
  return {
    ok: true,
    plan: Object.freeze({
      issues: Object.freeze(issues),
      missingQualifiers: Object.freeze(missing),
      confidence,
    }),
    problems: [],
    authorityRefusals,
  };
}

// Kahn-style cycle probe. Returns the first cycle found as a list of ids, or null.
function firstCycle(issues) {
  const byId = new Map(issues.map((i) => [i.issueId, i]));
  const state = new Map();                       // 0 unvisited, 1 on stack, 2 done
  const stack = [];
  let found = null;
  const walk = (id) => {
    if (found) return;
    const s = state.get(id) || 0;
    if (s === 2) return;
    if (s === 1) { found = stack.slice(stack.indexOf(id)).concat(id); return; }
    state.set(id, 1); stack.push(id);
    for (const d of (byId.get(id)?.dependencies) || []) if (byId.has(d)) walk(d);
    stack.pop(); state.set(id, 2);
  };
  for (const i of issues) walk(i.issueId);
  return found;
}

/**
 * Does this plan need a follow-up question rather than a search?
 *
 * Low confidence, or a qualifier the planner itself says is missing and material, means the
 * honest next move is to ask — not to assume. A plan that assumes is a plan that will produce
 * a confident ruling on a question nobody asked.
 */
export function needsFollowUp(plan) {
  if (!plan) return false;
  if (plan.confidence === 'low') return true;
  return plan.missingQualifiers.length > 0;
}

// The issues in an order that respects dependencies. Stable: equal-depth issues keep the
// order the planner gave them.
export function orderedIssues(plan) {
  const list = plan ? plan.issues.slice() : [];
  const byId = new Map(list.map((i) => [i.issueId, i]));
  const depth = new Map();
  const measure = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = byId.get(id)?.dependencies || [];
    const d = deps.length ? 1 + Math.max(...deps.map((x) => measure(x, seen))) : 0;
    depth.set(id, d);
    return d;
  };
  list.forEach((i) => measure(i.issueId));
  return list
    .map((i, idx) => ({ i, idx, d: depth.get(i.issueId) || 0 }))
    .sort((a, b) => a.d - b.d || a.idx - b.idx)
    .map((x) => x.i);
}

/** The JSON Schema the model is shown. Exported so the prompt and the validator cannot drift. */
export const QUERY_PLAN_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['issues', 'confidence'],
  properties: {
    issues: {
      type: 'array', minItems: 1, maxItems: MAX_ISSUES,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['issue_id', 'intent', 'temporal_scope'],
        properties: {
          issue_id: { type: 'string' },
          intent: { type: 'string', enum: INTENTS.slice() },
          requested_authority_id: { type: ['string', 'null'] },
          protected_entities: { type: 'array', items: { type: 'string' }, maxItems: MAX_TERMS_PER_FIELD },
          core_terms: { type: 'array', items: { type: 'string' }, maxItems: MAX_TERMS_PER_FIELD },
          context_vars: { type: 'array', items: { type: 'string' }, maxItems: MAX_TERMS_PER_FIELD },
          exact_user_phrases: { type: 'array', items: { type: 'string' }, maxItems: MAX_TERMS_PER_FIELD },
          required_slots: { type: 'array', items: { type: 'string', enum: SLOTS.slice() }, maxItems: MAX_SLOTS_PER_ISSUE },
          dependencies: { type: 'array', items: { type: 'string' }, maxItems: MAX_ISSUES },
          temporal_scope: { type: 'string', enum: TEMPORAL_SCOPES.slice() },
        },
      },
    },
    missing_qualifiers: { type: 'array', items: { type: 'string' }, maxItems: MAX_TERMS_PER_FIELD },
    confidence: { type: 'string', enum: CONFIDENCE.slice() },
  },
});
