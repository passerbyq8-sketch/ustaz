// lib/lessons-source-card.js — بطاقةُ مصدرِ الدرسِ من إصابةِ خدمةِ الدروس
//
// This module is the LESSONS twin of lib/lib-source-card.js. It was written by reading that
// file and carrying its rule across unchanged; the rule is quoted below in the same words,
// because a paraphrase of an ethical rule is a weaker rule.
//
// ══ THREE TRAPS IN THE MEASURED CONTRACT, WRITTEN AT THE HEAD BY ORDER ═══════
//
//   1. `scholar_id` IS NOT AN IDENTIFIER. It is the scholar's Arabic display name. The service
//      calls it `_id` for historical reasons inside its own contract, and the value is Arabic
//      text meant to be shown. Anyone who treats it as a key — joins on it, slugs it, looks it
//      up in a table — has built on something that was never there.
//
//   2. `snippet` IS NEVER READ, NEVER PASSED, NEVER STORED. The service sends it empty in
//      97.6% of hits and filled in 2.4%, and the owner's ruling is that lesson text is not
//      displayed at all. The field is deleted at the edge of this tree, inside
//      api/lessons-search.js, and no internal structure — this card included — has a place
//      for it.
//
//   3. `content_type` IS ONE OF ELEVEN MEASURED KINDS. They are listed below verbatim and are
//      not translated here: how a kind is worded on a screen is the interface's business, and
//      there is no interface in this round. A value outside the eleven is treated as an
//      ABSENCE, not as a twelfth kind — a name this repo cannot vouch for is a name it does
//      not repeat.
//
// ══ ZERO DERIVATION — CARRIED WORD FOR WORD FROM lib/lib-source-card.js ══════
// A card never manufactures a value it was not given: no book name built out of an
// identifier, no author inferred from a title, no page number reconstructed from a
// volume. A field the service did not send stays absent from the card. An absent
// field is honest; an invented one is a false citation.
//
// This module is PURE — no network, no clock, no environment. api/lessons-search.js imports
// the field lists from here so the whitelist and the card cannot drift apart.

// The ten fields of a single lessons hit, measured. There are ten and no eleventh.
export const HIT_FIELDS = Object.freeze([
  'unit_id',
  'scholar_id',
  'title',
  'url',
  'tier',
  'usage',
  'citation_allowed',
  'content_type',
  'snippet',
  'score'
]);

// The one hit field that is deleted at the edge of this tree and never travels further.
// Named here so a guard can assert the deletion against the contract rather than against a
// literal it keeps its own copy of.
export const DROPPED_HIT_FIELD = 'snippet';

// The four fields a lessons card carries. There is no fifth, and the six names below it are
// the ones a reader might expect to find here and will not.
export const CARD_FIELDS = Object.freeze([
  'title',
  'scholar_id',
  'url',
  'content_type'
]);

// Named so the guard counts the card's keys against a list instead of against a habit.
export const CARD_FORBIDDEN_FIELDS = Object.freeze([
  'snippet',
  'unit_id',
  'tier',
  'usage',
  'citation_allowed',
  'score'
]);

// The eleven measured kinds. Not translated, not extended, not reordered.
export const CONTENT_TYPES = Object.freeze([
  'lesson',
  'fatwa',
  'benefit',
  'explanation',
  'lecture',
  'video',
  'audio',
  'clip',
  'sermon',
  'discussion',
  'live'
]);

const has = (object, key) =>
  object != null && Object.prototype.hasOwnProperty.call(object, key) && object[key] != null;

// Copy `key` from `hit` into `card` only when the hit actually carries it. This is
// the whole no-invention rule in one function: absent in, absent out.
const carry = (card, hit, key) => {
  if (has(hit, key)) card[key] = hit[key];
};

/** `true` only for one of the eleven measured kinds. Everything else is an absence. */
export function isKnownContentType(value) {
  return typeof value === 'string' && CONTENT_TYPES.indexOf(value) !== -1;
}

/**
 * Build the source card for one lessons hit.
 *
 * Every key of the returned object is one of CARD_FIELDS — the card does not rename, merge or
 * compute anything, and it holds none of CARD_FORBIDDEN_FIELDS even when the hit carries them.
 *
 * `content_type` is the one field with a decision attached, and the decision is only whether
 * the value is a kind this repo has measured. An unmeasured kind is dropped in silence, which
 * leaves the card saying nothing about the kind — the honest outcome, and the same direction
 * of safety the page rule takes in lib/lib-source-card.js.
 */
export function buildLessonCard(hit) {
  if (hit == null || typeof hit !== 'object') return null;

  const card = {};
  carry(card, hit, 'title');
  carry(card, hit, 'scholar_id');
  carry(card, hit, 'url');
  if (isKnownContentType(hit && hit.content_type)) card.content_type = hit.content_type;

  return card;
}
