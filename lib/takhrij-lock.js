// lib/takhrij-lock.js
// A TAKHRIJ NOBODY PUBLISHED IS NEVER EMITTED. Deterministic, pure, and it costs nothing.
//
// ── THE MEASURED FAILURE ─────────────────────────────────────────────────────
// Inside an ordinary fiqh answer about travelling alone, the app produced:
//     «نهى النبي ﷺ عن السفر وحده، وقال: الراكب شيطان والراكبان شيطانان والثلاثة ركب»
//     — رواه البخاري ومسلم / متفق عليه
// The matn is a real narration. The attribution is false — it is not in the Ṣaḥīḥayn — and it did
// not come from any page that was fetched. It came from the model's memory, and it arrived
// wearing the two names that end an argument in this subject.
//
// ── WHY NOTHING CAUGHT IT ────────────────────────────────────────────────────
// lib/policy/consistency-gate.js checks scholars' names and ruling verbs. Gate 2 and Gate 3 check
// entailment between a claim and its evidence — and «رواه البخاري ومسلم» entails perfectly well
// from a claim that also says it. Nothing anywhere asked the one question a takhrij turns on: is
// this attribution ON THE PAGE? So a grading and a collector attached from memory travelled
// through every gate the app has.
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
// Any ATTRIBUTION («رواه فلان»، «أخرجه فلان»، «متفق عليه»، «في الصحيحين») or GRADE («صححه فلان»،
// «حسّنه فلان»، «ضعّفه فلان») must be present in the extracted text of a page that was actually
// fetched. When it is not, THE WHOLE SENTENCE CARRYING IT IS DROPPED.
// Nothing is repaired, nothing is re-attributed, and no correct attribution is ever supplied from
// this module's own knowledge.
//
// And when that dropped sentence was a BLOCK some earlier line existed only to introduce, the
// introducing line goes with it — see `orphanedLeadInCuts`. Leaving it behind hands the reader a
// promise with nothing after it, which is the orphaned-lead-in defect of 974f6624 one phase later.
//
// ── X-013/ز: WHY THE SENTENCE, AND NOT JUST THE CREDIT ───────────────────────
// This module used to strip the attribution and let the matn stand, on the reasoning that "the
// narration is not the lie, the credit is". That reasoning does not survive contact with what the
// reader is left holding. Cut «رواه البخاري ومسلم» out of «والحديث صحيح رواه البخاري ومسلم» and
// the sentence does not become weaker — it becomes «والحديث صحيح», a grading now asserted in this
// answer's own voice, with the single attribution a reader could have gone and checked quietly
// deleted. That is a STRONGER and falser claim than the one that failed the check.
//
// So the sentence goes whole, and what remains is REBUILT from the sentences that survived; if
// nothing survives, the lock REFUSES explicitly. Either way it returns a `degraded` record, so no
// caller can ship a shortened answer without knowing it was shortened. hybrid-deen's §7 majority
// gate already reasons exactly this way about جمهور/ترجيح claims; this is that rule generalised.
//
// ── THE ONE EXEMPTION, SCOPED TO EXACTLY WHAT IT COVERS ──────────────────────
// The frozen texts — the worship cards, the adhkār and the āyāt — carry attributions pinned in
// their golden files and asserted by their own guards. They do not enter this check.
//
// It is applied to the FROZEN RUN, not to the whole sentence, and that scoping is deliberate.
// Exempting an entire sentence because it happens to quote an āyah would hand any unsourced
// takhrij a way through: quote a verse beside it and the check never runs. So a span is skipped
// only when it OVERLAPS the frozen text itself, which is what "the frozen text is not touched"
// actually means.

import { normalizeArabic } from './route-classify.js';
import { containsFrozenRun } from './frozen-text.js';
import { colonPreambles } from './colon-preamble.js';

const norm = (s) => normalizeArabic(String(s == null ? '' : s));

// ── Tokens, with their offsets in the ORIGINAL string ────────────────────────
// Matching happens on folded forms so that «صحَّحه» and «صححه» are one word; splicing happens on
// the original offsets so that the reply keeps its tashkīl. Doing either one alone is how a check
// like this either misses vocalised text or returns it stripped.
const WORD_RE = /[ء-ْٰٱـ]+/g;

function tokenize(text) {
  const toks = [];
  let m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    toks.push({ raw: m[0], bare: norm(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

// ── What a takhrij looks like ────────────────────────────────────────────────
// Folded forms, because that is what tokenize() produces.
const ATTRIB_VERBS = new Set(['رواه', 'رواها', 'رواهما', 'اخرجه', 'اخرجها', 'اخرجهما', 'خرجه', 'خرجهما', 'رواه', 'اورده']);
const GRADE_VERBS = new Set(['صححه', 'صححها', 'حسنه', 'حسنها', 'ضعفه', 'ضعفها', 'صححهما', 'جوده', 'وثقه']);
const SAHIH_BOOKS = new Set(['البخاري', 'مسلم', 'الترمذي', 'النساىي', 'ابوداود', 'داود', 'ابن ماجه', 'ماجه', 'احمد']);
// How many words after «رواه» may belong to the attribution. Three covers «البخاري ومسلم» and
// «ابن حبان في صحيحه»; more would start swallowing the sentence that follows.
const MAX_NAME_WORDS = 3;

/**
 * Every takhrij span in `text`, as {start, end, kind, phrase}.
 * `phrase` is the folded form — that is what gets looked for on the page.
 */
export function takhrijSpans(text) {
  const s = String(text == null ? '' : text);
  const toks = tokenize(s);
  const spans = [];

  const contiguous = (i, j) => {
    // Only whitespace may sit between the words of one attribution. A comma or a full stop ends
    // it, which is what stops «رواه البخاري، وهذا حديث عظيم» from swallowing the second clause.
    for (let k = i; k < j; k++) {
      if (/[^\s]/.test(s.slice(toks[k].end, toks[k + 1].start))) return false;
    }
    return true;
  };
  const push = (i, j, kind) => {
    const words = [];
    for (let k = i; k <= j; k++) words.push(toks[k].bare);
    spans.push({ start: toks[i].start, end: toks[j].end, kind, phrase: words.join(' ') });
  };

  for (let i = 0; i < toks.length; i++) {
    const b = toks[i].bare;

    // «متفق عليه»
    if (b === 'متفق' && toks[i + 1] && toks[i + 1].bare === 'عليه' && contiguous(i, i + 1)) {
      push(i, i + 1, 'attribution'); i += 1; continue;
    }
    // «في الصحيحين» / «الصحيحين»
    if (b === 'الصحيحين') {
      const from = (i > 0 && toks[i - 1].bare === 'في' && contiguous(i - 1, i)) ? i - 1 : i;
      push(from, i, 'attribution'); continue;
    }
    // «صحيح البخاري» / «صحيح مسلم» — the BOOK named as the source, not the grade word alone.
    if (b === 'صحيح' && toks[i + 1] && SAHIH_BOOKS.has(toks[i + 1].bare) && contiguous(i, i + 1)) {
      push(i, i + 1, 'attribution'); i += 1; continue;
    }
    // «رواه فلان» / «أخرجه فلان» and «صححه فلان» / «حسّنه فلان» / «ضعّفه فلان»
    const isAttrib = ATTRIB_VERBS.has(b);
    const isGrade = GRADE_VERBS.has(b);
    if (isAttrib || isGrade) {
      let j = i;
      while (j + 1 < toks.length && j - i < MAX_NAME_WORDS && contiguous(j, j + 1)) j++;
      if (j > i) { push(i, j, isAttrib ? 'attribution' : 'grade'); i = j; }
      continue;
    }
  }
  return spans;
}

// ── AA-83 · A GRADE STANDS ONLY WHERE A SOURCE STANDS WITH IT ───────────────
//
// MEASURED IN PRODUCTION, reported by the owner: the word for «authentic» printed under
// prophetic texts with no narrator and no source — three times in one answer about the merit of
// congregational prayer, and once under a text well known to be weak. And it FLUCTUATES: it
// appears in one mode and vanishes in another for the same question.
//
// THE FLUCTUATION IS NOT A MYSTERY, AND IT REPRODUCES FROM CODE. A grade written as the
// STRUCTURED field — `<hadith ruling="صحيح">` — is emptied on exactly one route, the anchored
// one, by `honestTakhrijInDraft` (lib/anchor/units.js:181, called at api/ask.js:3857). Every
// other exit reaches lib/finalize-reader-text.js instead, and nothing there looked at the field
// at all. Same question, two routes, two answers — which is the fluctuation, exactly.
//
// AND A GRADE WRITTEN AS PROSE WAS INVISIBLE EVERYWHERE. `takhrijSpans` above reads an
// attribution («رواه فلان») and a grade ATTRIBUTED TO A MAN («صححه فلان»). A BARE grade —
// «وهو حديثٌ صحيحٌ»، «إسنادُه صحيحٌ»، «صحيحُ الإسناد» — names nobody, so it opens no span, and
// the lock never saw it. That is the shape the owner received.
//
// THE RULE, AND ITS TWO HALVES ARE EQUALLY BINDING.
//   A grade may stand when a source stands with it. A grade with no source attached does not
//   reach the reader: THE GRADE GOES, THE TEXT STAYS.
// The prophetic text is NEVER removed. Deleting a hadith in order to delete its grade would be
// a far worse defect than the one being repaired, and it is why this rule cuts a WORD where the
// lock above cuts a SENTENCE: the lock removes a claim that is false, this removes a claim that
// is unsupported while leaving the narration the reader was entitled to.
//
// WHAT COUNTS AS A GRADE IS DELIBERATELY NARROW. «صحيح» is an ordinary Arabic word meaning
// «correct», and «هذا كلامٌ صحيحٌ» is not a grading. A word in GRADE_WORDS counts only when it
// is ADJACENT — nothing but whitespace between — to a word naming the thing graded: a matn noun
// («حديث»، «رواية»، «أثر») before it, or a chain noun («إسناده»، «السند») on either side. And
// «صحيح البخاري» is a BOOK, not a grade: the same exclusion `takhrijSpans` already makes.
//
// AND THE SOURCE IS LOOKED FOR IN THE BLOCK, NOT IN THE SENTENCE. «قال النبيُّ ﷺ: «…» رواه
// البخاريُّ. وهو حديثٌ صحيحٌ.» puts the grade in its own sentence and the collection in the one
// before it, and the source does stand with it there. Scoping to the sentence would cut that,
// which is the false positive this phase names as the whole risk. The block is the line, the
// same unit lib/colon-preamble.js reads, and the card a line introduces counts as its source.
const GRADE_WORDS = new Set([
  'صحيح', 'الصحيح', 'صحيحه', 'صحيحا', 'صحاح',
  'حسن', 'الحسن', 'حسنه', 'حسان',
  'ضعيف', 'الضعيف', 'ضعيفه', 'ضعاف',
  'موضوع', 'الموضوع', 'موضوعه',
  'منكر', 'المنكر', 'شاذ', 'الشاذ', 'متواتر', 'المتواتر', 'ثابت', 'الثابت',
]);
/** The thing a grade is a grade OF, when the text is what is graded. The noun survives. */
const MATN_NOUNS = new Set(['حديث', 'الحديث', 'حديثا', 'حديثان', 'احاديث', 'الاحاديث',
  'روايه', 'الروايه', 'اثر', 'الاثر', 'خبر', 'الخبر']);
/** ...and when the CHAIN is what is graded. «إسنادُه» alone is not a sentence, so both go. */
const CHAIN_NOUNS = new Set(['اسناده', 'اسنادها', 'اسنادهما', 'اسناد', 'الاسناد',
  'سنده', 'سندها', 'سند', 'السند']);
// «وحديثٌ صحيحٌ» and «وإسنادُه صحيحٌ» are the same two shapes with the conjunction attached: the
// tokenizer takes whole words, so «وحديث» is not «حديث» and the adjacency test missed them. The
// leading و/ف is stripped for the NOUN test only. It is not stripped for the grade word, where
// it would buy nothing and widen a list that is deliberately narrow.
const withoutConjunction = (bare) => (/^[وف]./u.test(bare) ? bare.slice(1) : bare);

/** A word after a grade that makes it the title of a BOOK rather than a grading. */
const BOOK_AFTER_GRADE = new Set(['ابن', 'الجامع', 'السنن', 'المسند']);

/**
 * Every BARE grade in `text` — one that names nobody and opens no takhrij span.
 *
 * @returns {Array<{start:number,end:number,phrase:string,shape:string}>}
 *   shape 'matn'  — only the grade word is in the span; the noun before it stays.
 *   shape 'chain' — the chain noun is in the span too; «إسنادُه» with its grade removed is not
 *                   a sentence, and leaving it would be a fragment, not a repair.
 */
export function bareGradeSpans(text) {
  const s = String(text == null ? '' : text);
  const toks = tokenize(s);
  const out = [];
  const adjacent = (i, j) => i >= 0 && j < toks.length
    && !/[^\s]/u.test(s.slice(toks[i].end, toks[j].start));
  const push = (i, j, shape) => {
    const words = [];
    for (let k = i; k <= j; k += 1) words.push(toks[k].bare);
    out.push({ start: toks[i].start, end: toks[j].end, phrase: words.join(' '), shape });
  };
  for (let i = 0; i < toks.length; i += 1) {
    if (!GRADE_WORDS.has(toks[i].bare)) continue;
    const next = toks[i + 1];
    // «صحيح البخاري» / «صحيح ابن حبان» — the book, and `takhrijSpans` already reads it as one.
    if (next && adjacent(i, i + 1)
      && (SAHIH_BOOKS.has(next.bare) || BOOK_AFTER_GRADE.has(next.bare))) { i += 1; continue; }
    const prev = toks[i - 1];
    const before = prev && adjacent(i - 1, i) ? withoutConjunction(prev.bare) : null;
    const after = next && adjacent(i, i + 1) ? withoutConjunction(next.bare) : null;
    if (before && CHAIN_NOUNS.has(before)) { push(i - 1, i, 'chain'); continue; }
    if (before && MATN_NOUNS.has(before)) { push(i, i, 'matn'); continue; }
    if (after && CHAIN_NOUNS.has(after)) { push(i, i + 1, 'chain'); i += 1; }
  }
  return out;
}

/** A card, a link or a numbered citation — the shapes a source takes that are not a takhrij. */
const CARD_IN_BLOCK = /<\s*(?:hadith|source|book|verse|surah|document)\b/iu;
const LINK_IN_BLOCK = /https?:\/\//u;
/** «(البخاري ١٢٣)» — a citation is a bracket with a number in it. */
const CITATION_IN_BLOCK = /[(\uFF08][^)\uFF09]*[0-9\u0660-\u0669][^)\uFF09]*[)\uFF09]/u;

/** Does a source stand with anything in this block? */
function blockCarriesSource(block) {
  return takhrijSpans(block).length > 0
    || CARD_IN_BLOCK.test(block)
    || LINK_IN_BLOCK.test(block)
    || CITATION_IN_BLOCK.test(block);
}

/** The sentence of `block` that contains [start,end). */
function sentenceAround(block, start) {
  for (const sen of sentences(block)) if (start >= sen.start && start < sen.end) return sen;
  return { start: 0, end: block.length };
}

// ── AND THE SAME RULE ON THE STRUCTURED FIELD ───────────────────────────────
//
// «with no narrator and no source» is not only a prose shape. `<hadith ruling="صحيح">متن</hadith>`
// with no `narrator` is a grade with no chain, printed as a grade: index.html’s
// `resolveHadithAttribution` renders no «رَوَى …» line for an empty narrator and still prints the
// grade under the matn. `honestTakhrijInDraft` (lib/anchor/units.js:181) already empties such a
// field, but it is called from ONE route (api/ask.js:3857) and it needs the fetched pages to
// decide. This asks the narrower question that needs no pages at all: is there a chain or a
// source in the tag itself?
//
// AND THE TAG IS NEVER DROPPED. The attribute is emptied, exactly as `honestTakhrijInDraft`
// empties it and for the same stated reason: the matn survives. A ruling that IS a source
// («أخرجه البخاري (1) ومسلم (1907)», the frozen shape at lib/closed-deen.js:141) names a
// collection or carries a number, and is left exactly as it is.
const HADITH_TAG_RE = /<hadith\b([^>]*)>/giu;
const attrOf = (attrs, name) => {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'u').exec(attrs);
  return m ? m[1].trim() : '';
};
/** A ruling that is itself an attribution — a collection named, or a hadith number. */
const rulingIsItsOwnSource = (ruling) => takhrijSpans(ruling).length > 0
  || /[0-9\u0660-\u0669]/u.test(ruling);

/** @returns {{text:string, blanked:string[]}} */
export function blankChainlessRulings(textRaw) {
  const s = String(textRaw == null ? '' : textRaw);
  const blanked = [];
  HADITH_TAG_RE.lastIndex = 0;
  const out = s.replace(HADITH_TAG_RE, (whole, attrs) => {
    const ruling = attrOf(attrs, 'ruling');
    const narrator = attrOf(attrs, 'narrator');
    if (!ruling) return whole;
    if (narrator) return whole;
    if (rulingIsItsOwnSource(ruling)) return whole;
    blanked.push(ruling);
    return '<hadith' + attrs.replace(/ruling\s*=\s*"[^"]*"/u, 'ruling=""') + '>';
  });
  return { text: out, blanked };
}

/**
 * THE GRADE GOES, THE TEXT STAYS.
 *
 * @param {string} textRaw          the prose destined for the reader
 * @param {object} opts
 *   followedByCard  the writer still has a card to append after this text, so the LAST block
 *                   may have its source behind it on the wire and is left alone — the same
 *                   reasoning lib/finalize-reader-text.js applies to a dangling lead-in.
 * @returns {{text:string, removed:Array<{phrase:string,shape:string}>}}
 */
export function dropUnsourcedGrades(textRaw, { followedByCard = false } = {}) {
  const s = String(textRaw == null ? '' : textRaw);
  if (!s.trim()) return { text: s, removed: [] };
  // The structured field first, and unconditionally: a block holding a card counts as SOURCED
  // for the prose pass below, so asking about the tag afterwards would never happen.
  const structured = blankChainlessRulings(s);
  const removedStructured = structured.blanked.map((phrase) => ({ phrase, shape: 'tag-ruling' }));
  const lines = structured.text.split('\n');
  let lastNonEmpty = -1;
  for (let i = 0; i < lines.length; i += 1) if (lines[i].trim()) lastNonEmpty = i;
  const removed = [...removedStructured];
  for (let i = 0; i < lines.length; i += 1) {
    const block = lines[i];
    if (!block.trim()) continue;
    if (followedByCard && i === lastNonEmpty) continue;
    if (blockCarriesSource(block)) continue;
    // The card a line introduces is that line’s source, so the next block is consulted too.
    let next = '';
    for (let j = i + 1; j < lines.length; j += 1) if (lines[j].trim()) { next = lines[j]; break; }
    if (next && CARD_IN_BLOCK.test(next)) continue;
    const frozen = containsFrozenRun(block);
    const spans = bareGradeSpans(block)
      .filter((sp) => !(frozen && sp.start < frozen.end && sp.end > frozen.start));
    if (!spans.length) continue;
    // A sentence whose whole substance was the grade is removed with it — «إسنادُه صحيحٌ.»
    // leaves no text to stand. A sentence with a matn in it keeps every other word.
    const cuts = [];
    for (const sp of spans) {
      const sen = sentenceAround(block, sp.start);
      const within = spans.filter((x) => x.start >= sen.start && x.end <= sen.end);
      let rest = block.slice(sen.start, sen.end);
      for (let k = within.length - 1; k >= 0; k -= 1) {
        rest = rest.slice(0, within[k].start - sen.start) + rest.slice(within[k].end - sen.start);
      }
      cuts.push(/[\u0621-\u064A]/u.test(rest) ? { start: sp.start, end: sp.end }
        : { start: sen.start, end: sen.end });
      removed.push({ phrase: sp.phrase, shape: sp.shape });
    }
    cuts.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const c of cuts) {
      const last = merged[merged.length - 1];
      if (last && c.start <= last.end) last.end = Math.max(last.end, c.end);
      else merged.push({ start: c.start, end: c.end });
    }
    let out = block;
    for (let k = merged.length - 1; k >= 0; k -= 1) {
      out = out.slice(0, merged[k].start) + out.slice(merged[k].end);
    }
    // Whitespace and orphaned separators only. No word is ever added, and no word is moved.
    lines[i] = out
      .replace(/[ \t]{2,}/gu, ' ')
      .replace(/[ \t]+([،؛,.؟!])/gu, '$1')
      .replace(/([،؛,])\s*([.؟!])/gu, '$2')
      .replace(/^[\s،؛,.؟!]+$/u, '')
      .trimEnd();
  }
  // AND IT NEVER EMPTIES AN ANSWER. «إسنادُه صحيحٌ.» alone is a whole reply whose only substance
  // is the grade, and removing it would hand lib/finalized-sse-writer.js:467 an empty approval —
  // the same reasoning that stops the seat cutting a lead-in that is the whole answer. Where
  // nothing would be left, the text is returned exactly as it arrived and nothing is recorded.
  const out = lines.join('\n');
  if (!/[\u0621-\u064A]/u.test(out)) return { text: s, removed: [] };
  return { text: out, removed };
}
// The extracted text of every page that was actually fetched, as one folded haystack.
function haystack(sources) {
  return ' ' + (Array.isArray(sources) ? sources : [])
    .map((x) => (typeof x === 'string' ? x : norm(String((x && (x.passage || x.text || x.authorialText)) || '') + ' ' + String((x && x.title) || ''))))
    .map((x) => (typeof x === 'string' ? norm(x) : x))
    .join(' \n ') + ' ';
}

// A span counts as SUPPORTED when the page says the same thing. Both directions are allowed on
// purpose: the reply may write «رواه البخاري» where the page wrote «رواه البخاري ومسلم» (the page
// contains the reply's phrase), and the reply may write «رواه البخاري ومسلم» where the page wrote
// exactly that. What is never allowed is a phrase the page does not contain at all.
function supported(phrase, hay) {
  const p = norm(phrase);
  if (!p) return true;
  if (hay.indexOf(' ' + p + ' ') !== -1 || hay.indexOf(p) !== -1) return true;
  // A bare «متفق عليه» is also established by the page naming both Ṣaḥīḥs.
  if (p === 'متفق عليه' || p === 'في الصحيحين' || p === 'الصحيحين') {
    return hay.indexOf('البخاري') !== -1 && hay.indexOf('مسلم') !== -1;
  }
  return false;
}

// Split into sentences, keeping each one's offsets so a whole sentence can be dropped.
function sentences(text) {
  const s = String(text == null ? '' : text);
  const out = [];
  let start = 0;
  const re = /[.؟!\n]+/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({ start, end: m.index + m[0].length });
    start = m.index + m[0].length;
  }
  if (start < s.length) out.push({ start, end: s.length });
  return out;
}

// What is left of a sentence once its takhrij is gone. Below this, the sentence WAS the takhrij.
const MIN_WORDS_AFTER = 4;

/**
 * ── THE SENTENCE THAT LED INTO THE DROPPED BLOCK GOES WITH IT ────────────────
 *
 * MEASURED, turn F03 of EZIK-RAW-CORPUS-2026-08-19.jsonl. The reply reached this lock shaped like
 * this: a line ending in a colon, then the card that line existed to introduce, then the prose
 * that comments on it. The card was a `<hadith>` whose own `narrator` attribute carried a takhrij
 * no fetched page published, so the rule above dropped the card's line — correctly. The colon line
 * stayed. What the reader received was a promise («…is established by the text:») with nothing
 * behind it, followed by a sentence that says «and this is explicit in…» about a quotation that is
 * no longer there.
 *
 * IT IS THE ORPHANED-LEAD-IN FAMILY OF 974f6624, ONE PHASE LATER. That round fixed it inside
 * `deliverableText` (lib/free-brain/loop.js:932) by making the foreign-script rule stop eating card
 * lines. Here the deletion is not a mistake to be stopped — an unpublished takhrij must go — so the
 * repair is the other half: the sentence whose only job was to introduce the deleted block goes too.
 *
 * WHICH SENTENCE IS DECIDED BY THE DETECTOR THAT ALREADY EXISTS, AND BY NOTHING ELSE.
 * `colonPreambles` (lib/colon-preamble.js) is asked the same question twice — on the text as it
 * arrived, and on the text this lock's cut leaves. A preamble is removed ONLY when it was HEALTHY
 * before and is ORPHANED after. That difference IS the evidence that this cut is what orphaned it,
 * which is what keeps a preamble the model already wrote orphaned exactly where it was: this is not
 * a tidier, and it repairs nothing it did not break.
 *
 * NO VOCABULARY, NO WIDENING, NO SECOND OPINION ON THE CARD. The lead-in is identified by
 * structure; the whole LINE is taken and never a fragment of one; and the decision to drop the
 * card is the loop above's alone and is not consulted, weakened or extended here.
 *
 * @param {string} s        the text as it arrived
 * @param {Array}  cuts     the ranges the takhrij rule decided to remove
 * @returns {Array<{start:number,end:number}>} whole-line ranges, in `s`'s own offsets
 */
function orphanedLeadInCuts(s, cuts) {
  // The text the cuts leave, and where every surviving character landed in it.
  const dropped = new Uint8Array(s.length);
  for (const c of cuts) {
    for (let k = Math.max(0, c.start); k < Math.min(s.length, c.end); k += 1) dropped[k] = 1;
  }
  let after = '';
  const moved = new Array(s.length + 1);
  for (let k = 0; k < s.length; k += 1) { moved[k] = after.length; if (!dropped[k]) after += s[k]; }
  moved[s.length] = after.length;

  // The two readings are correlated through the LINE each preamble sits on and not through its
  // text: a line whose tail was cut is still the same line, and `colonPreambles` reports a line
  // index. `lineStart` indexes the arriving text; `lineOf` the text the cut left.
  const lineStart = [0];
  for (let k = 0; k < s.length; k += 1) if (s[k] === '\n') lineStart.push(k + 1);
  const lineOf = [0];
  for (let k = 0; k < after.length; k += 1) lineOf.push(lineOf[k] + (after[k] === '\n' ? 1 : 0));

  // Healthy before, keyed by the line it occupies after. If a cut merged two lines and two healthy
  // preambles claim one key, the key is abandoned rather than guessed: this may only ever remove
  // what it can point at.
  const healthy = new Map();
  const ambiguous = new Set();
  for (const p of colonPreambles(s)) {
    if (p.orphaned) continue;
    const key = lineOf[moved[lineStart[p.index]]];
    if (healthy.has(key)) ambiguous.add(key); else healthy.set(key, p.index);
  }

  const out = [];
  for (const p of colonPreambles(after)) {
    if (!p.orphaned || ambiguous.has(p.index) || !healthy.has(p.index)) continue;
    const line = healthy.get(p.index);
    out.push({
      start: lineStart[line],
      end: line + 1 < lineStart.length ? lineStart[line + 1] : s.length,
    });
  }
  return out;
}

/**
 * THE LOCK.
 *
 * @param {string} text          the drafted reply, or one drafted sentence
 * @param {Array} sources        the retrieved pages ({passage|text|authorialText, title} or strings)
 * @returns {{text:string, removed:Array, droppedSentences:Array}}
 */
export function lockTakhrij(text, sources) {
  const s = String(text == null ? '' : text);
  if (!s.trim()) return { text: s, removed: [], droppedSentences: [], outcome: 'CLEAN', degraded: [], repairAttempted: false };
  const hay = haystack(sources);

  const removed = [];
  const droppedSentences = [];
  // Every edit is collected as an offset range first and applied once, from the end backwards, so
  // that no edit can move the offsets of another.
  const cuts = [];

  for (const sen of sentences(s)) {
    const body = s.slice(sen.start, sen.end);
    const spans = takhrijSpans(body);
    if (!spans.length) continue;

    // THE FROZEN EXEMPTION, scoped to the frozen run itself. A span overlapping an āyah or a
    // known dhikr is left exactly where it is.
    const frozen = containsFrozenRun(body);
    const overlapsFrozen = (sp) => !!frozen && sp.start < frozen.end && sp.end > frozen.start;

    const unsupported = spans.filter((sp) => !overlapsFrozen(sp) && !supported(sp.phrase, hay));
    if (!unsupported.length) continue;

    // X-013/ز — THE WHOLE SENTENCE GOES, AND MID-SENTENCE SURGERY IS GONE WITH IT.
    // This used to ask whether the sentence would survive losing its takhrij, and if it would, cut
    // out the offending phrase and ship the remainder. That is the defect. «رواه الترمذيُّ» removed
    // from «وحديثُ صلاةِ الليلِ حديثٌ صحيحٌ ثابتٌ رواه الترمذيُّ» does not leave a weaker claim —
    // it leaves «وحديثُ صلاةِ الليلِ حديثٌ صحيحٌ ثابتٌ», a grading that now reads as this answer's
    // own settled position, with the one attribution a reader could have checked quietly deleted.
    // Stronger, and falser, than the claim that failed. hybrid-deen's §7 majority gate already
    // reasons this way and rebuilds its whole summary rather than deleting the offending clause;
    // this is that rule generalised. The sentence is dropped whole, and what remains is REBUILT.
    cuts.push({ start: sen.start, end: sen.end });
    droppedSentences.push({ text: body.trim(), spans: unsupported.map((x) => x.phrase) });
    for (const sp of unsupported) removed.push({ kind: sp.kind, phrase: sp.phrase });
  }

  if (!cuts.length) {
    return { text: s, removed, droppedSentences, outcome: 'CLEAN', degraded: [], repairAttempted: false };
  }

  // THE ONE MARKED REPAIR ATTEMPT: rebuild the reply from the sentences that survived. It is a
  // single deterministic pass, and whatever comes out of it is either sent WITH a degraded record
  // or refused outright — there is no third path where a shortened text leaves quietly.
  const degraded = [`takhrij-unsupported:${droppedSentences.length}`];
  // The lead-in of a block this cut removes goes with it — see `orphanedLeadInCuts`. It is added
  // AFTER the record above, because `takhrij-unsupported` counts unsupported takhrij and a lead-in
  // carries none: two different removals, counted separately, neither hidden inside the other.
  const leadIns = orphanedLeadInCuts(s, cuts);
  if (leadIns.length) {
    cuts.push(...leadIns);
    degraded.push(`takhrij-orphaned-lead-in:${leadIns.length}`);
  }
  // Overlapping ranges are merged before a character is spliced. `sentences()` returns its ranges
  // disjoint, so for the takhrij cuts alone this is the same removal it always was; a lead-in cut
  // is a whole LINE and may contain one of them, and splicing the same characters twice would eat
  // the text that followed them.
  cuts.sort((a, b) => a.start - b.start);
  const spans = [];
  for (const c of cuts) {
    const last = spans[spans.length - 1];
    if (last && c.start <= last.end) last.end = Math.max(last.end, c.end);
    else spans.push({ start: c.start, end: c.end });
  }
  let out = s;
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
  }
  // Tidy the punctuation the removal left behind — «… ركب»، .» is not a sentence a reader should
  // be shown. Whitespace and orphaned separators only; no word is ever added.
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([،؛,.])/g, '$1')
    .replace(/([،؛,])\s*([.؟!])/g, '$2')
    .replace(/([،؛,])\s*$/gm, '.')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

  // AND THE EXPLICIT REFUSAL. If the rebuild left nothing a reader could call an answer, saying so
  // is the honest end of this path. Returning the stub would be the silent deletion in its last
  // and worst form: a reply that looks whole and has had its entire substance removed.
  // "Nothing substantive" means nothing at all. MIN_WORDS_AFTER is deliberately NOT reused here:
  // it measures what is left of ONE SENTENCE after an excision, and borrowing it as a whole-reply
  // floor refuses perfectly good short answers — «جوابٌ مفيد.» is two words and is an answer.
  if (!out.trim()) {
    degraded.push('takhrij-rebuild-empty');
    return { text: '', removed, droppedSentences, outcome: 'REFUSED', degraded, repairAttempted: true };
  }
  return { text: out, removed, droppedSentences, outcome: 'REBUILT', degraded, repairAttempted: true };
}
