// lib/lib-source-card.js — بنّاءُ بطاقةِ المصدرِ من إصابةِ المكتبة (البند ١٦-أ)
//
// ══ WHAT THIS FILE MAY READ ══════════════════════════════════════════════════
// The library service contract is measured, not guessed. A `/search` response
// carries ELEVEN top-level fields, and every hit inside `hits` carries SEVENTEEN.
// Those two lists are written out below and are the ONLY names this repo is
// allowed to read from a hit or write into a card.
//
// There is no `book_id`. An earlier probe read a field by that name, got a single
// identifier back for five different hits, and reported "one book" for five books.
// The book's name is `book_title` and it is the only place a book's name comes from.
//
// ══ ZERO DERIVATION ══════════════════════════════════════════════════════════
// A card never manufactures a value it was not given: no book name built out of an
// identifier, no author inferred from a title, no page number reconstructed from a
// volume. A field the service did not send stays absent from the card. An absent
// field is honest; an invented one is a false citation.
//
// ══ THE PAGE RULE, AND WHY IT IS THE SHARP EDGE ══════════════════════════════
// On the fatwa surface 78.2% of hits are page-citable and 21.8% are not. When
// `page_citable === false` the card names the book, the author and the chapter path
// (`heading_path`) and NAMES NO PAGE AT ALL — even when `page_start`/`page_end` are
// present in the hit. A page number that is present but not citable is a page number
// that does not survive being looked up, and printing it turns a real source into a
// citation a reader cannot verify. This file therefore branches on `page_citable`
// alone, and anything that is not exactly `true` takes the no-page branch: the safe
// direction of an unknown is silence about the page, never a guess at it.
//
// This module is PURE — no network, no clock, no environment. `api/lib-search.js`
// imports the two field lists from here so the whitelist and the card can never
// drift apart.

// The eleven top-level fields of a `/search` response, measured.
export const RESPONSE_FIELDS = Object.freeze([
  'index_version',
  'took_ms',
  'queue_ms',
  'candidates_examined',
  'candidates_truncated',
  'refused',
  'refused_reason',
  'degraded_reason',
  'estimated_postings',
  'hits_dropped',
  'hits'
]);

// The seventeen fields of a single hit, measured. Note the absence of `book_id`.
export const HIT_FIELDS = Object.freeze([
  'atom_id',
  'author',
  'book_title',
  'hadith_no',
  'heading_kind',
  'heading_path',
  'matn_chars',
  'matn_spans',
  'numbering',
  'page_citable',
  'page_end',
  'page_start',
  'score',
  'subject_id',
  'text',
  'truncated',
  'volume'
]);

// The service refuses to widen a search once the estimated postings pass its own
// ceiling: `refused: true` with `refused_reason: 'estimated_postings_exceed_ceiling'`.
// That is the ceiling working, not a fault — it gets a sentence, not an error screen
// and not a fault log. The sentence lives here so the view layer (item 16-ب) reads it
// instead of writing its own.
export const REFUSED_TEXT = 'تعذّرَ توسيعُ البحث.';

// `degraded_reason: 'over_budget'` means the results came back cut short at the
// budget ceiling. They ARE shown, and the shortfall is said out loud.
export const DEGRADED_TEXT = 'النتائجُ مبتورةٌ عندَ سقفِ البحث.';

// A search that ran, was not refused, and matched nothing. It is not a failure and not a
// ceiling: the index answered, and the answer was none. It needs a sentence for the same
// reason the two above do -- a screen that shows an empty box cannot tell a reader whether
// the search found nothing or was never sent, and a silence that could mean either is the
// defect, not the absence of results.
export const EMPTY_TEXT = 'لا نتيجةَ لهذا البحث.';

// `truncated === true` on a hit: the matn itself came back cut. The card carries a
// visible mark so a reader never mistakes a cut quotation for a whole one.
export const TRUNCATED_TAG = '(النصُّ مبتور)';

const has = (object, key) =>
  object != null && Object.prototype.hasOwnProperty.call(object, key) && object[key] != null;

// Copy `key` from `hit` into `card` only when the hit actually carries it. This is
// the whole no-invention rule in one function: absent in, absent out.
const carry = (card, hit, key) => {
  if (has(hit, key)) card[key] = hit[key];
};

/**
 * Build the source card for one hit.
 *
 * Every key of the returned object is a field name from HIT_FIELDS — the card does
 * not rename, merge or compute anything. What it does is DECIDE WHICH fields may
 * appear, and that decision is `page_citable`.
 *
 * page_citable === true  -> book_title · author · volume · page_start · page_end
 * page_citable !== true  -> book_title · author · heading_path      (never a page)
 *
 * `hadith_no` rides along when the hit has one and is never derived. `truncated`
 * rides along only when it is exactly `true`.
 */
export function buildSourceCard(hit) {
  if (hit == null || typeof hit !== 'object') return null;

  const citable = hit.page_citable === true;
  const card = { page_citable: citable };

  carry(card, hit, 'book_title');
  carry(card, hit, 'author');

  if (citable) {
    carry(card, hit, 'volume');
    carry(card, hit, 'page_start');
    carry(card, hit, 'page_end');
  } else {
    // No volume, no page_start, no page_end — not even when the hit carries them.
    carry(card, hit, 'heading_path');
  }

  carry(card, hit, 'hadith_no');
  if (hit.truncated === true) card.truncated = true;

  return card;
}

// `heading_path` may arrive as a chapter path in one string or as its segments in an
// array. Rendering the segments is not deriving a value — every piece printed is a
// piece that was sent.
const renderHeadingPath = (value) =>
  Array.isArray(value) ? value.filter((part) => part != null && part !== '').join(' ← ') : String(value);

/**
 * Render a card as one display line. Item 16-ب attaches this to the view; nothing in
 * item 16-أ calls it from a render path. Kept beside `buildSourceCard` so the page
 * rule is enforced once: this function reads the CARD, which already had the page
 * stripped, so it cannot print a page the card does not carry.
 */
export function renderSourceCard(card) {
  if (card == null || typeof card !== 'object') return '';

  const parts = [];
  if (has(card, 'book_title')) parts.push(String(card.book_title));
  if (has(card, 'author')) parts.push(String(card.author));

  if (card.page_citable === true) {
    if (has(card, 'volume')) parts.push('ج ' + card.volume);
    if (has(card, 'page_start') && has(card, 'page_end') && card.page_end !== card.page_start) {
      parts.push('ص ' + card.page_start + '-' + card.page_end);
    } else if (has(card, 'page_start')) {
      parts.push('ص ' + card.page_start);
    } else if (has(card, 'page_end')) {
      parts.push('ص ' + card.page_end);
    }
  } else if (has(card, 'heading_path')) {
    parts.push(renderHeadingPath(card.heading_path));
  }

  if (has(card, 'hadith_no')) parts.push('حديث ' + card.hadith_no);
  if (card.truncated === true) parts.push(TRUNCATED_TAG);

  return parts.join(' · ');
}
