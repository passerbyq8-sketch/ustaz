// lib/ledger/capability.js
// THE SEVEN CAPABILITIES, AND WHY A SCOPE COLUMN WAS NOT ENOUGH.
//
// lib/source-registry.js already carries `scopes` — four purposes: fatwa, tafsir, hadith,
// general. That column answers "may this site be searched for this KIND of question", and it
// is the right answer to that question. It cannot answer the one this file exists for:
//
//   * «hadith» is three different jobs. Quoting a narration's WORDING, grading its ISNAD,
//     and EXPLAINING its meaning are performed by different people on different pages, and a
//     site fit for one is routinely unfit for another. al-abbaad.com explains hadith and does
//     not issue gradings; dorar.net grades and is not a tafsir source.
//   * «scholar_opinion_primary» — "what did THIS man hold" — is not a purpose at all. It is a
//     claim about authorship, and a site being on the allow-list says nothing about it. The
//     whole class of defect this engine exists to prevent is a general article being read as
//     a named scholar's position, so it gets its own capability with its own hard rule.
//
// ELIGIBILITY IS A HARD GATE, NOT A WEIGHT. A source that is not eligible for the capability
// a question needs never reaches the evidence model — not at a lower rank, not with a
// penalty that a good title could outscore. `priority` orders only what is already eligible.
//
// This module is data and predicates. It performs no I/O, holds no policy of its own, and
// never decides what a ruling is.

export const CAPABILITIES = Object.freeze([
  'fatwa',
  'tafsir',
  'hadith_text',
  'hadith_grading',
  'hadith_explanation',
  'scholar_opinion_primary',
  'general_article',
]);

const CAP_SET = new Set(CAPABILITIES);

export function isCapability(c) {
  return typeof c === 'string' && CAP_SET.has(c);
}

// HEALTH. Three states, deliberately distinguished:
//   enabled  — on a production allow-list and usable now.
//   disabled — deliberately not usable, with the reason recorded (a parked domain, an edge
//              that refuses server-side clients). Re-admitting it is a one-word change.
//   deferred — the material exists but is not citable yet (audio with no transcript, an index
//              that never surfaced a citable page). NOT the same as disabled: nothing is
//              wrong with the site, we simply cannot stand behind a citation to it.
// Only 'enabled' may ever supply evidence. `deferred` is never silently promoted.
export const HEALTH = Object.freeze(['enabled', 'disabled', 'deferred']);

export function isHealth(h) {
  return typeof h === 'string' && HEALTH.includes(h);
}

// The empty policy: eligible for nothing. Used as the base every row is built from, so a
// capability a row forgets to mention is REFUSED rather than inherited.
export function emptyPolicy() {
  const out = {};
  for (const c of CAPABILITIES) out[c] = { eligible: false, priority: 0 };
  return out;
}

// Build a full policy from a sparse `{cap: priority}` map. A capability absent from the map
// is ineligible — absence is a refusal, which is the only safe default when the question is
// "may this page back a religious claim".
export function policy(map) {
  const out = emptyPolicy();
  for (const [k, v] of Object.entries(map || {})) {
    if (!isCapability(k)) throw new Error('unknown capability: ' + k);
    const p = Number(v);
    if (!Number.isFinite(p) || p < 1 || p > 100) throw new Error('priority out of range for ' + k + ': ' + v);
    out[k] = { eligible: true, priority: p };
  }
  return Object.freeze(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.freeze(v)])));
}

// ── the question's INTENT, and the capability that answers it ────────────────
// lib/ledger/query-ir.js speaks in intents because that is what a reader's question has.
// This is the one place the two vocabularies are joined, so no caller invents a mapping.
export const INTENTS = Object.freeze([
  'fatwa', 'tafsir', 'hadith_text', 'hadith_grading', 'hadith_explanation',
  'scholar_opinion', 'general',
]);

const INTENT_TO_CAPABILITY = Object.freeze({
  fatwa: 'fatwa',
  tafsir: 'tafsir',
  hadith_text: 'hadith_text',
  hadith_grading: 'hadith_grading',
  hadith_explanation: 'hadith_explanation',
  scholar_opinion: 'scholar_opinion_primary',
  general: 'general_article',
});

export function isIntent(i) {
  return typeof i === 'string' && INTENTS.includes(i);
}

export function capabilityForIntent(intent) {
  return INTENT_TO_CAPABILITY[intent] || null;
}
