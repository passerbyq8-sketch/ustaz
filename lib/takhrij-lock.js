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
