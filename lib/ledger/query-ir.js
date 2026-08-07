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
// THE ENTITY FACTS ARE DERIVED HERE, DETERMINISTICALLY, FROM THE READER'S OWN WORDS.
//
// WHY NOT ASK THE MODEL FOR THEM. This file's whole premise is that the model proposes a
// DESCRIPTION and never an instruction, and "whose claim is this" is the single most
// consequential instruction in the system — it is the difference between reporting what a page
// says about a man and reporting it as his fatwa. A model that could label the relation could
// relabel ABOUT_ENTITY as BY_ENTITY and the attribution rules would obey it. So the relation, the
// roles, the target type and the era come from lib/policy/entities.js, which reads a registered
// roster, and the model's `requested_authority_id` is only ever allowed to AGREE or be dropped.
import { readEntities, eraOf, fold as foldArabic } from '../policy/entities.js';
import { provenanceCap } from '../policy/attribution-grades.js';

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

// ── EVERY PROBLEM NAMES A FIELD, IN A TOKEN A METRICS STORE CAN KEEP ─────────
//
// WHY THIS EXISTS. lib/ledger/engine.js builds a rejection detail that names the broken field,
// and lib/ledger/schema.js's telemetryShape() emitted `rejections.map(r => r.code)` — so the
// name was built and then dropped one layer later. In production the answer to «which field
// broke?» was unobtainable: the record said `query_plan_failed_schema_validation` and nothing
// else, for every malformed reply, forever. The batch-5 lesson («name the field») was
// implemented at the reject() call and not at the boundary that is actually read.
//
// WHY A CLOSED SET RATHER THAN THE MESSAGE. The prose messages below are prose: they carry
// spaces, Arabic, and — for an invented key — A STRING THE MODEL WROTE. None of that may reach
// a metrics store, and lib/ledger/telemetry.js would refuse it anyway. So each problem also
// carries a TOKEN from this frozen list, and an invented key reports the CLASS (`unknown_field`)
// and never the key itself. The token is a bare identifier by construction, which is what lets
// it survive the allow-list without the allow-list being loosened for it.
export const IR_FIELDS = Object.freeze([
  'plan', 'issues', 'issue_id', 'intent', 'requested_authority_id',
  'protected_entities', 'core_terms', 'context_vars', 'exact_user_phrases',
  'required_slots', 'dependencies', 'temporal_scope', 'missing_qualifiers',
  'confidence', 'unknown_field',
]);
const IR_FIELD_SET = new Set(IR_FIELDS);

// ── FIELD-LEVEL REFUSAL, NOT PLAN-LEVEL ──────────────────────────────────────
//
// WHAT THIS FILE USED TO DO. Every fault, however small, went into one `problems` list, and
// `problems.length` at the end returned `ok: false` for the whole plan. One invented key, one
// mistyped enum, one dependency pointing at nothing — and a reader's entire compound question was
// thrown away, before a single search. That is the defect measured on 2026-08-07: every ledger
// request came back PLAN_INVALID with `brave: 0`.
//
// THE ASYMMETRY WAS ALREADY ARGUED IN THIS FILE, for `authorityRefusals`: «folding it into
// `problems` would throw away a compound question because one half of it cannot be attributed».
// The same argument applies to a malformed enum on one issue, and was not applied there. It is
// now, consistently.
//
// THE THREE CATEGORIES, AND WHAT PUTS A FAULT IN EACH:
//
//   REPAIRED  the model's value is refused, a measured-safe value takes its place, and the
//             substitution is RECORDED by field. Used where the value cannot steer anything —
//             an unknown top-level key is read by nothing, an unknown slot can never be filled,
//             a dangling dependency changes only ordering.
//   FATAL, PER ISSUE   the issue is dropped and the rest of the plan proceeds. Used where no
//             substitute exists that would not change what the reader asked.
//   FATAL, PER PLAN    nothing survives. Reserved for a plan that is not a plan at all.
//
// NOTHING IS LOOSENED BY REPAIRING. The security rule behind refusing an unknown key was «the
// next invented field might be `sites`» — and a stripped key steers exactly as much as a refused
// one: nothing. What the old behaviour added on top was destroying the legitimate half of the
// question, which protected nobody. Stripping keeps the defence and drops the collateral.
//
// THE SAFE VALUES ARE MEASURED, NOT GUESSED — see IR_DEFAULTS.
export const IR_DEFAULTS = Object.freeze({
  // MEASURED: `temporalScope` is read in exactly one place, lib/ledger/rank.js, where
  // `dated_fact` and `current_context` grant a fetched page +10 for being recent. `unknown`
  // grants nothing, and the comment beside that line says why the absence is the safe side:
  // «rewarding recency on a timeless fiqh question is how «آخر فتوى» gets written». So the
  // default withholds a bonus rather than inventing one, and it is the same value the prompt's
  // own worked example prints.
  temporal_scope: 'unknown',
  // MEASURED: `confidence` is read in exactly one place, needsFollowUp(), and only `low` is
  // consequential — it turns the answer into a clarifying question instead of a search.
  //
  // WHY NOT DEFAULT TO `low`. That would infer «the reader's question is ambiguous» from «the
  // model mistyped an enum», which are unrelated facts, and it would reproduce the very failure
  // this round exists to remove: a refusal that never searched. `medium` is the honest reading of
  // a value that carried no signal.
  //
  // AND THE AMBIGUITY SIGNAL IS NOT LOST WITH IT. `missing_qualifiers` is the field that names
  // an actual missing qualifier, it is independent of this one, and it still forces the follow-up
  // on its own — so a planner that noticed a real ambiguity still gets its question asked.
  confidence: 'medium',
});

/**
 * A sink that keeps three things side by side: the sentence, the field token, and whether the
 * fault was FATAL or REPAIRED.
 *
 * `fields()` and `repairs()` are deduped and ordered by first appearance — the first field to
 * break is the one a reader of the record wants named first.
 */
function problemSink() {
  const messages = [];
  // THE SUBSET THAT KILLS THE WHOLE PLAN — and the distinction this file did not have.
  // `messages` holds every fatal fault including the ones that only cost ONE ISSUE; this holds
  // the strictly smaller set that leaves nothing to run. The final gate reads THIS, which is why
  // a compound question now survives one bad half. Both still reach the record.
  const planFatal = [];
  const repairMessages = [];
  const seen = [];
  const mended = [];
  const add = (list, field) => {
    if (IR_FIELD_SET.has(field) && !list.includes(field)) list.push(field);
  };
  return {
    messages,
    repairMessages,
    planFatal,
    /** A fault with no safe substitute, at the level of the PLAN. Nothing survives it. */
    push(field, message) { messages.push(message); planFatal.push(message); add(seen, field); },
    /** A fault that refuses ONE issue. Recorded and named; the rest of the plan proceeds. */
    dropIssue(field, message) { messages.push(message); add(seen, field); },
    /** A fault whose value was refused and replaced. The plan survives; the swap is recorded. */
    repair(field, message) { repairMessages.push(message); add(mended, field); },
    /** Fold another sink's tokens in without re-stating its sentences. */
    addFields(list) { for (const f of list || []) add(seen, f); },
    addRepairs(list) { for (const f of list || []) add(mended, f); },
    fields: () => seen.slice(),
    repairs: () => mended.slice(),
  };
}

/**
 * A term list, cleaned rather than refused.
 *
 * EVERY FAULT HERE IS A REPAIR, and the reason is the same one throughout: a bad entry in a term
 * list cannot steer anything — lib/ledger/query-build.js builds the query from what survives —
 * so refusing the plan over one only cost the reader the terms that were fine.
 *
 * OVER-LENGTH TRUNCATES RATHER THAN EMPTYING. This used to `return []` on an over-long list,
 * which threw away TWELVE good terms because a thirteenth existed. Truncation keeps the bound and
 * keeps the terms. It is safe for attribution specifically because `protectedEntities` is not
 * what decides who is credited: lib/ledger/query-ir.js's buildPolicyBlock() re-derives the
 * entities from the reader's own words through lib/policy/entities.js, and the model's list is
 * only ever allowed to agree.
 */
function strArray(value, field, label, sink, { maxItems = MAX_TERMS_PER_FIELD, maxChars = MAX_TERM_CHARS } = {}) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) { sink.repair(field, label + ': not an array — dropped'); return []; }
  let items = value;
  if (items.length > maxItems) {
    sink.repair(field, label + ': more than ' + maxItems + ' entries — truncated');
    items = items.slice(0, maxItems);
  }
  const out = [];
  for (const v of items) {
    if (!isStr(v)) { sink.repair(field, label + ': non-string entry — dropped'); continue; }
    const s = v.trim();
    if (!s) continue;
    if (s.length > maxChars) { sink.repair(field, label + ': entry longer than ' + maxChars + ' chars — dropped'); continue; }
    out.push(s);
  }
  return out;
}

/**
 * Validate ONE issue. Returns { issue, problems, repairMessages, fields, repairs }.
 *
 * A non-empty `problems` means this ISSUE is refused — there is no partial acceptance of an
 * issue, because a half-understood question is the thing that produces a half-right ruling. The
 * REST OF THE PLAN is unaffected: that is the difference from what this file used to do.
 *
 * ── WHY EXACTLY THESE THREE ARE FATAL, AND NOTHING ELSE IS ───────────────────
 *
 * `issue_id`   identity. The ledger keys slots, proofs, claims and rejections by it, so an issue
 *              without one cannot be recorded, tracked or reported on. Nothing to substitute.
 *
 * `intent`     THE ONE THE DIRECTIVE SENDS TO THE OWNER. A default here would decide, without
 *              being asked, WHICH VETTED SOURCES may answer (capabilityForIntent → eligibleSites,
 *              measured: 14 domains for `fatwa`, 13 for `hadith_text`, 2 for `hadith_grading`,
 *              1 for `scholar_opinion`, 22 for `general`) and WHICH SLOTS a complete answer must
 *              fill (REQUIRED_SLOTS_BY_INTENT). Reading a ruling question as `general` drops the
 *              `ruling` slot and widens the source set; reading a general question as `fatwa`
 *              narrows it. Either direction changes what may be said and on whose authority —
 *              a change in religious meaning. So NO DEFAULT IS TAKEN HERE: rule-9, this field
 *              alone, recorded for the owner. The issue is refused and lib/ledger/planner.js's
 *              deterministic fallback re-derives an intent from a MEASURED classifier instead of
 *              this file inventing one.
 *
 * `core_terms` (and its two siblings) — an issue carrying no substantive term is not a question
 *              this engine can search. There is nothing to look for, so there is nothing to fix.
 */
function validateIssue(raw, index, questionText) {
  const sink = problemSink();
  const problems = sink.messages;
  const p = (field, m) => sink.push(field, 'issue[' + index + '] ' + m);
  const r = (field, m) => sink.repair(field, 'issue[' + index + '] ' + m);
  const done = (issue) => ({
    issue, problems, repairMessages: sink.repairMessages,
    fields: sink.fields(), repairs: sink.repairs(),
  });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    p('issues', 'is not an object');
    return done(null);
  }

  const issueId = isStr(raw.issue_id) && ID_RE.test(raw.issue_id) ? raw.issue_id : null;
  if (!issueId) p('issue_id', 'issue_id missing or not a bare identifier');

  if (!isIntent(raw.intent)) p('intent', 'intent is not one of ' + INTENTS.join('|'));

  // AUTHORITY. Two separate refusals, and they are not the same refusal:
  //   * a value that is not a registered owner id at all — the model invented somebody;
  //   * a registered owner with no primary-opinion adapter — we know who he is and we have no
  //     corpus of his to read. That one is refused HERE, before a search is planned, which is
  //     what makes it cost nothing.
  //
  // A MALFORMED ONE IS DROPPED, NOT FATAL — and that is this file's OWN rule applied, not a
  // relaxation of it. buildPolicyBlock() below already says «the model may AGREE, or be dropped»:
  // a `requested_authority_id` is honoured only when the deterministic entity reading of the
  // question independently found that authority. A value that is not even a bare identifier can
  // never be agreed with, so dropping it to null lands in exactly the state the file already
  // guarantees for every value it does not recognise.
  let authority = null;
  if (raw.requested_authority_id !== undefined && raw.requested_authority_id !== null) {
    if (!isStr(raw.requested_authority_id) || !ID_RE.test(raw.requested_authority_id)) {
      r('requested_authority_id', 'requested_authority_id is not a bare identifier — dropped');
    } else {
      authority = raw.requested_authority_id;
    }
  }

  const pre = 'issue[' + index + '].';
  const protectedEntities = strArray(raw.protected_entities, 'protected_entities', pre + 'protected_entities', sink);
  const coreTerms = strArray(raw.core_terms, 'core_terms', pre + 'core_terms', sink);
  const contextVars = strArray(raw.context_vars, 'context_vars', pre + 'context_vars', sink);
  const exactPhrases = strArray(raw.exact_user_phrases, 'exact_user_phrases', pre + 'exact_user_phrases',
    sink, { maxChars: MAX_PHRASE_CHARS });

  // AN UNKNOWN SLOT IS STRIPPED, NOT FATAL. A slot the engine has never heard of can never be
  // FILLED — nothing marks it, so it would sit unfilled forever and pin the reply to PARTIAL on
  // a coverage requirement nobody can satisfy. And the slots that actually matter are added
  // deterministically below whatever the model asked for, so stripping loses no coverage.
  const askedSlots = Array.isArray(raw.required_slots) ? raw.required_slots : [];
  if (askedSlots.length > MAX_SLOTS_PER_ISSUE) {
    r('required_slots', 'required_slots exceeds ' + MAX_SLOTS_PER_ISSUE + ' — truncated');
  }
  const slots = new Set();
  for (const s of askedSlots.slice(0, MAX_SLOTS_PER_ISSUE)) {
    if (!isStr(s) || !SLOT_SET.has(s)) {
      r('required_slots', 'unknown slot: ' + String(s).slice(0, 24) + ' — dropped');
      continue;
    }
    slots.add(s);
  }
  // The deterministic templates are UNION'd in, never used to replace what was asked.
  if (isIntent(raw.intent)) for (const s of templateSlots(raw.intent, questionText)) slots.add(s);

  // A MALFORMED DEPENDENCY IS DROPPED. Dependencies are read by orderedIssues() and nowhere else:
  // they decide the ORDER issues are searched in, never whether one is. An edge that names
  // something that is not an identifier cannot order anything, so dropping it costs a tie-break
  // and refusing the plan over it cost the reader the whole question.
  const deps = strArray(raw.dependencies, 'dependencies', pre + 'dependencies', sink, { maxItems: MAX_ISSUES })
    .filter((d) => {
      if (ID_RE.test(d)) return true;
      r('dependencies', 'dependency is not a bare identifier: ' + d.slice(0, 24) + ' — dropped');
      return false;
    });

  const temporal = TEMPORAL_SCOPES.includes(raw.temporal_scope)
    ? raw.temporal_scope
    : (r('temporal_scope', 'temporal_scope is not one of ' + TEMPORAL_SCOPES.join('|')
      + ' — defaulted to ' + IR_DEFAULTS.temporal_scope), IR_DEFAULTS.temporal_scope);

  // A question with no substantive term is not a plan. Refuse rather than search for nothing.
  if (!problems.length && !coreTerms.length && !protectedEntities.length && !exactPhrases.length) {
    p('core_terms', 'carries no core term, protected entity or exact phrase');
  }

  if (problems.length) return done(null);
  return done(Object.freeze({
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
  }));
}

/**
 * VALIDATE A WHOLE PLAN.
 *
 * @param {object} raw            what the model returned, already JSON-parsed
 * @param {string} questionText   the reader's own words, used only for slot templating
 * @returns {{ok:boolean, plan:object|null, problems:string[], problemFields:string[],
 *            repairs:string[], repairMessages:string[], authorityRefusals:object[]}}
 *
 * `problemFields` is the same failure as `problems`, in tokens from IR_FIELDS rather than in
 * prose. It is what reaches the metrics record, so «which field broke» survives the trip to the
 * store — see IR_FIELDS above for why the prose does not and must not.
 *
 * `repairs` is the same thing for faults that did NOT kill anything: the model's value was
 * refused, a measured-safe value took its place, and the swap is named by field so a store can
 * count it. A repaired plan is `ok: true` — the repairs are how it says what it had to change.
 *
 * `authorityRefusals` is separated from `problems` on purpose. A named scholar with no
 * registered adapter is NOT a malformed plan — the model did its job correctly and the honest
 * outcome is a refusal of that ISSUE, with the rest of the question still answerable. Folding
 * it into `problems` would throw away a compound question because one half of it cannot be
 * attributed.
 */
export function validateQueryPlan(raw, questionText = '') {
  const sink = problemSink();
  const problems = sink.messages;
  const out = (extra) => ({
    problems, problemFields: sink.fields(),
    repairs: sink.repairs(), repairMessages: sink.repairMessages,
    ...extra,
  });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    sink.push('plan', 'plan is not an object');
    return out({ ok: false, plan: null, authorityRefusals: [] });
  }
  // AN UNKNOWN TOP-LEVEL KEY IS STRIPPED AND RECORDED, not a refusal of the plan.
  //
  // THE DEFENCE IS UNCHANGED, and it is worth being exact about why. The rule was written as
  // «the next invented field might be `sites`» — and that danger is real. But the danger was
  // never that the key EXISTED; it was that something downstream might read it. Nothing does:
  // three keys are read below and the plan is built from those three alone, so an invented key
  // steers precisely as much after this loop as it would have after a refusal — nothing. What a
  // refusal added on top was destroying the reader's legitimate question along with it.
  //
  // THE KEY ITSELF IS NOT THE TOKEN. `k` is a string the model wrote and may be anything at all;
  // the record gets the class (`unknown_field`) and the sentence keeps the key for the log.
  const ALLOWED_TOP = new Set(['issues', 'missing_qualifiers', 'confidence']);
  for (const k of Object.keys(raw)) {
    if (!ALLOWED_TOP.has(k)) sink.repair('unknown_field', 'unknown top-level field: ' + k + ' — stripped');
  }

  if (!Array.isArray(raw.issues) || raw.issues.length === 0) {
    sink.push('issues', 'issues must be a non-empty array');
  } else if (raw.issues.length > MAX_ISSUES) {
    // FATAL, AND DELIBERATELY NOT TRUNCATED. Every other over-length list in this file is cut to
    // its bound, because dropping a spare TERM loses precision. Dropping a spare ISSUE loses a
    // part of the reader's question — and the reply would then report itself complete while a
    // quarter of what was asked had never been searched. The bounds comment at the top of this
    // file already promised this: «a runaway one is refused rather than silently truncated».
    sink.push('issues', 'more than ' + MAX_ISSUES + ' issues');
  }

  const missing = strArray(raw.missing_qualifiers, 'missing_qualifiers', 'missing_qualifiers', sink);
  const confidence = CONFIDENCE.includes(raw.confidence)
    ? raw.confidence
    : (sink.repair('confidence', 'confidence is not one of ' + CONFIDENCE.join('|')
      + ' — defaulted to ' + IR_DEFAULTS.confidence), IR_DEFAULTS.confidence);

  const issues = [];
  const authorityRefusals = [];
  if (Array.isArray(raw.issues)) {
    const seen = new Set();
    raw.issues.slice(0, MAX_ISSUES).forEach((r, i) => {
      const { issue, problems: ip, repairMessages: irm, fields: ifs, repairs: irs } = validateIssue(r, i, questionText);
      // An issue's repairs are carried up whether or not it survived — a plan that had to mend
      // two fields on an issue it then refused should say both things.
      sink.repairMessages.push(...irm);
      sink.addRepairs(irs);
      if (ip.length) {
        // The issue's sentences and its field tokens are carried up UNCHANGED, so the plan
        // reports the field the issue actually broke on rather than a generic `issues`.
        // AND THE PLAN IS NOT KILLED BY IT: `dropIssue` records the fault without adding it to
        // the set the final gate reads, so a refused issue is one issue lost and the loop carries
        // on to the next. That is the whole of the plan-level/issue-level asymmetry this file
        // already argued for authorityRefusals, applied where it was missing.
        for (const m of ip) sink.dropIssue('', m);
        sink.addFields(ifs);
        return;
      }
      // A DUPLICATE ID IS FATAL FOR THE PLAN, not repaired. Renaming the second issue would keep
      // both, but every dependency edge naming that id becomes ambiguous, and DROPPING it would
      // silently delete a part of the question — the same objection as truncating `issues`.
      if (seen.has(issue.issueId)) { sink.push('issue_id', 'duplicate issue_id: ' + issue.issueId); return; }
      seen.add(issue.issueId);
      issues.push(issue);
    });
    // ── EDGES THAT POINT AT NOTHING ARE PRUNED ─────────────────────────────
    // A dependency on an issue that does not exist in this plan — including one the loop above
    // just refused — and a self-dependency are both ORDERING faults and nothing more. They are
    // dropped and recorded; orderedIssues() then sorts what is left. A CYCLE stays fatal: there
    // is no correct order to fall back to, and inventing one would run a dependent issue before
    // the thing it declared it depends on.
    for (let i = 0; i < issues.length; i++) {
      const iss = issues[i];
      const kept = iss.dependencies.filter((d) => {
        if (d === iss.issueId) {
          sink.repair('dependencies', 'issue ' + iss.issueId + ' depends on itself — dropped');
          return false;
        }
        if (!seen.has(d)) {
          sink.repair('dependencies', 'issue ' + iss.issueId + ' depends on unknown issue ' + d + ' — dropped');
          return false;
        }
        return true;
      });
      if (kept.length !== iss.dependencies.length) {
        issues[i] = Object.freeze({ ...iss, dependencies: Object.freeze(kept) });
      }
    }
    const cyc = firstCycle(issues);
    if (cyc) sink.push('dependencies', 'dependency cycle: ' + cyc.join(' -> '));
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

  // ── THE LINE THAT USED TO FAIL ON ANY ACCUMULATION AT ALL ─────────────────
  //
  // `if (problems.length || !issues.length)` was the whole-question cliff: ANY entry in one flat
  // list — an invented key, a mistyped enum, one bad issue out of three — returned `ok: false`
  // and the reader's entire question was thrown away before a single search.
  //
  // TWO THINGS NARROW IT NOW. Everything recoverable left through `repairs` and never reached
  // this list at all; and of what remains, only `planFatal` — the faults that leave NOTHING to
  // run — can kill the plan. An issue refused on its own merits is recorded, named, and skipped,
  // and the other half of a compound question still gets searched.
  if (sink.planFatal.length || !issues.length) {
    // `!issues.length` on its own is a plan that named nothing this engine can search, and it
    // has no field of its own to blame — so it is reported against `issues`.
    if (!issues.length) sink.addFields(['issues']);
    return out({ ok: false, plan: null, authorityRefusals });
  }
  // ── ONE POLICY BLOCK PER ISSUE ────────────────────────────────────────────
  //
  // This used to compute ONE block for the whole question and spread it across every issue. In a
  // compound question that leaks: «ما حكم صلاة المسافر في الطائرة، وما رأي ابن باز فيها؟» gave the
  // GENERAL ruling Ibn Baz's `requested_authority_id`, his era and his cap — so a claim about the
  // general ruling inherited an attribution nobody asked for, which is the misattribution this
  // engine exists to prevent arriving through the back door.
  const withPolicy = issues.map((i) => Object.freeze({
    ...i, policy: buildPolicyBlock(questionText, [i]),
  }));
  // The plan-level block is kept for TELEMETRY ONLY. It is deliberately not what claims or Gate 3
  // read — each of those reads the issue's own block — and nothing downstream may fall back to it
  // when an issue has one.
  const planPolicyShared = buildPolicyBlock(questionText, issues);
  return out({
    ok: true,
    plan: Object.freeze({
      issues: Object.freeze(withPolicy),
      missingQualifiers: Object.freeze(missing),
      confidence,
      policy: planPolicyShared,
    }),
    authorityRefusals,
  });
}

/**
 * THE POLICY BLOCK CARRIED BY THE PLAN AND BY EVERY ISSUE.
 *
 * One derivation, attached where the ledger, the gates and the assembly can all read it, so no
 * consumer re-derives it and none of them can disagree about who was named.
 *
 * @returns {{claimRelation, targetType, era, requestedAuthorityId, provenanceCap,
 *            verbatimRequired, entities}}
 */
export function buildPolicyBlock(questionText, issues = []) {
  const ir = readEntities(questionText);

  // ── WHICH ENTITIES BELONG TO THIS ISSUE ───────────────────────────────────
  //
  // The reader's question is one string; the ISSUES are the parts of it. An entity belongs to an
  // issue when that issue's own terms name it, or when the planner asked for it as that issue's
  // authority. Everything else in the question belongs to somebody else's issue and may not
  // colour this one — that is the whole of the leak this scoping fixes.
  //
  // THE SAME ORTHOGRAPHIC FOLDING THE ENTITY READER USES. `readEntities` returns folded surfaces
  // («ابن تيميه»), so comparing them against a planner's raw term («ابن تيمية») matches nothing —
  // the ta-marbuta alone is enough to lose the entity, and losing it silently drops a SUBJECT out
  // of the issue that names him.
  const fold = (s) => foldArabic(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();
  const issueTerms = issues.flatMap((i) => [
    ...(i.protectedEntities || []), ...(i.coreTerms || []), ...(i.exactUserPhrases || []),
  ]).map(fold).filter(Boolean);
  const namesEntity = (e) => issueTerms.some((t) => t.includes(e.surface) || e.surface.includes(t));

  const askedIds = new Set(issues.map((i) => i.requestedAuthorityId).filter(Boolean));
  // With no terms at all (a bare issue) fall back to the whole question's entities, so a
  // single-issue plan behaves exactly as before.
  const scoped = issueTerms.length || askedIds.size
    ? ir.entities.filter((e) => namesEntity(e) || askedIds.has(e.canonicalId))
    : ir.entities;

  // ── THE MODEL MAY AGREE, OR BE DROPPED ────────────────────────────────────
  //
  // A `requested_authority_id` is honoured only when the DETERMINISTIC reading of the question
  // found that entity AND gave it an authority role. So a planner cannot turn «هل خالف ابن تيمية
  // أهل السنة؟» into a request for anybody's fatwa, and cannot name an authority the question
  // never mentioned.
  const authorityEntity = scoped.find((e) => e.role === 'authority' && e.targetType === 'person');
  const requestedAuthorityId = (authorityEntity && authorityEntity.resolutionStatus === 'resolved')
    ? authorityEntity.canonicalId
    : null;

  const subject = scoped.find((e) => e.role === 'subject');
  const madhhab = scoped.find((e) => e.targetType === 'madhhab');

  // ── THE QUOTE BELONGS TO ONE ISSUE, NOT TO THE QUESTION ───────────────────
  //
  // `ir.verbatimRequired` is a fact about the whole sentence the reader typed, and using it
  // directly made every issue with an authority a wording verification. In «هل قال ابن تيمية:
  // "..."؟ وما رأي ابن باز في الطلاق؟» that turned Ibn Baz's ordinary opinion question into a
  // demand to confirm a wording he was never quoted saying — and a QUOTE_VERIFICATION that
  // cannot be satisfied refuses an answer that was perfectly answerable.
  //
  // readEntities() already attached the quotation to the scholar it was asked about. So the
  // requirement lands on the issue whose OWN authority is that scholar, or on an issue that
  // carries the quoted words in its own phrases. Everyone else is unaffected.
  const quoteAuthority = ir.verbatimRequired ? (ir.requestedAuthorityId || null) : null;
  const quotedFolded = fold(ir.quotedText || '');
  const carriesQuote = !!quotedFolded && issueTerms.some((t) => t.includes(quotedFolded));
  const verbatimForThisIssue = !!ir.verbatimRequired && !!authorityEntity
    && (carriesQuote || (!!quoteAuthority && authorityEntity.canonicalId === quoteAuthority));

  // The relation is this ISSUE's relation, derived from this issue's entities.
  let claimRelation = 'NONE';
  if (verbatimForThisIssue) claimRelation = 'QUOTE_VERIFICATION';
  else if (authorityEntity) claimRelation = 'BY_ENTITY';
  else if (madhhab) claimRelation = 'BY_MADHHAB';
  else if (subject) claimRelation = 'ABOUT_ENTITY';

  // The era that governs the CAP is the era of whoever would be attributed to. With nobody
  // attributed, the subject's era is still reported so the assembly can word things correctly.
  const era = requestedAuthorityId
    ? eraOf(requestedAuthorityId)
    : (subject ? subject.era : (madhhab ? madhhab.era : 'unknown'));

  const targetType = madhhab ? 'madhhab'
    : (authorityEntity || subject ? (authorityEntity || subject).targetType : '');

  // A living person being DISCUSSED is the sensitivity that changes what may be said about him.
  const sensitivity = (subject && subject.era === 'contemporary' && claimRelation === 'ABOUT_ENTITY')
    ? 'living_person'
    : (claimRelation === 'ABOUT_ENTITY' ? 'polemic' : 'none');

  return Object.freeze({
    issueIds: Object.freeze(issues.map((i) => i.issueId)),
    claimRelation,
    targetType,
    era,
    requestedAuthorityId,
    verbatimRequired: verbatimForThisIssue,
    sensitivity,
    provenanceCap: provenanceCap({
      era,
      hasPrimaryAdapter: !!(requestedAuthorityId && primaryOpinionAdapter(requestedAuthorityId)),
    }),
    entities: Object.freeze(scoped),
  });
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
