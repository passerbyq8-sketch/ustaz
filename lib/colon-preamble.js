// lib/colon-preamble.js - detector D1 (COLON ORPHAN).
//
// ── NOT A SECOND DETECTOR. THIS IS THE ONE THAT ALREADY EXISTED ─────────────
// The body below is the measurement module `tools/raw-corpus/orphans.mjs`, adopted byte for byte
// and only re-headed. It is what measured D1 33 -> 25 across 1827b9c, cfb6a74 and 974f6624, and
// writing a second lead-in detector beside it would be the defect, not the repair. The only edit
// is this comment and the line numbers it cites, re-anchored to this worktree.
//
// ── THE DEFINITION IS NOT NEW ───────────────────────────────────────────────
// It is D1 as stated in EZIK-ORPHAN-DIAG-2026-08-19.md section 4, reproduced here word for word,
// so that this round's numbers and the 33/25 of that round are the same measurement and not two:
//
//   "each non-empty archived reader line is a block. Its last non-space codepoint is one of
//    U+003A, U+FF1A, and the next block is absent or is not a quote, ayah, card, or list item."
//
// The four constants are read out of the product, not invented:
//   quote delimiters  U+00AB U+00BB U+201C U+201D U+0022   `updateQuoteChar`  lib/output-reviewer.js:737-742
//   ayah wrappers     U+FD3F ... U+FD3E                     `QURAN_SPAN_RE`    lib/output-reviewer.js:327
//   card names        verse|surah|hadith|...                `CARD_TAG_NAMES`   lib/output-reviewer.js:320
//   list bullet       -  *  U+2022  and `n.` / `n)`         `deliverableText`  lib/free-brain/loop.js:944
//   U+FF1A itself                                           `QUESTION_START`   lib/ledger/segment.js:62
//
// A CLOSING BLOCK is such a preamble when no block follows it at all - a promise made where
// nothing can come after it. It is a sub-kind of D1, reported separately and counted once.
//
// WHAT IT IS FOR, AND WHAT IT IS NOT. It ANSWERS a question; it never decides a deletion on its
// own. lib/takhrij-lock.js asks it the same question twice - before its cut and after it - and
// acts only on a preamble that was healthy before and is orphaned after. A preamble already
// orphaned in the input is left exactly as the model wrote it: this module is not a tidier.

/** `deliverableText` list bullets, lib/free-brain/loop.js:944. */
const LIST_ITEM_RE = /^(?:[-*•]\s+|\d+[.)]\s+)/u;
/** `CARD_TAG_NAMES`, lib/output-reviewer.js:320. */
const CARD_TAG_NAMES = 'verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship';
const CARD_OPEN_RE = new RegExp('^<\\s*(?:' + CARD_TAG_NAMES + ')\\b', 'iu');
/** `updateQuoteChar`, lib/output-reviewer.js:737-742. */
const QUOTE_OPENERS = ['«', '“', '"'];
/** `QURAN_SPAN_RE`, lib/output-reviewer.js:327. */
const AYAH_OPENER = '﴿';
/** The two colons D1 names, and only those two. */
export const COLON_RE = /[:：]$/u;

const isQuote = (block) => QUOTE_OPENERS.some((q) => block.startsWith(q));
const isAyah = (block) => block.startsWith(AYAH_OPENER) || block.includes(AYAH_OPENER);
const isCard = (block) => CARD_OPEN_RE.test(block);
const isListItem = (block) => LIST_ITEM_RE.test(block);

/**
 * @returns {Array<{line:string,index:number,orphaned:boolean,closing:boolean,next:string,reason:string}>}
 */
export function colonPreambles(text) {
  const lines = String(text || '').split('\n');
  // The blocks are the non-empty lines, in order; the index is kept so a report can point at one.
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed) blocks.push({ text: trimmed, index: i });
  }
  const out = [];
  for (let b = 0; b < blocks.length; b += 1) {
    const block = blocks[b];
    // "Its last non-space codepoint is one of U+003A, U+FF1A".
    if (!COLON_RE.test(block.text)) continue;
    const next = blocks[b + 1];
    let orphaned; let reason;
    if (!next) { orphaned = true; reason = 'no-next-block'; }
    else {
      const accepted = isQuote(next.text) || isAyah(next.text) || isCard(next.text)
        || isListItem(next.text);
      orphaned = !accepted;
      reason = accepted ? '' : 'next-block-is-not-quote-ayah-card-or-list-item';
    }
    out.push({
      line: block.text,
      index: block.index,
      orphaned,
      closing: !next,
      next: next ? next.text : '',
      reason,
    });
  }
  return out;
}
