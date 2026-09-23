import { assertsUnverifiedIdentityAbout, screenDraft } from './policy/consistency-gate.js';
import { lockTakhrij, dropUnsourcedGrades } from './takhrij-lock.js';
import { colonPreambles } from './colon-preamble.js';
import { dropRepeatedMatn, REPEATED_MATN } from './repeated-matn.js';
import { repairOrphanedOpeners } from './orphan-openers.js';
// E75 — BORROWED, NOT COPIED. See the block over the identity check below, and the
// export note at the foot of lib/output-reviewer.js. That module imports nothing and
// must go on importing nothing, so the edge runs this way and can never run back:
// measured with the whole static graph, 16 nodes, 0 cycles.
import {
  carriesReaderSubstance, foldReaderMarks, identityView, noticeInsertionIndex, stripReaderTags,
  requestedIdentityRespected,
} from './output-reviewer.js';

export const FINALIZER_REFUSAL =
  '\u0644\u0627 \u0623\u0633\u062a\u0637\u064a\u0639 \u0625\u0631\u0633\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u062c\u0648\u0627\u0628 \u0644\u0623\u0646 \u0628\u0639\u0636 \u0645\u0627 \u0641\u064a\u0647 \u0644\u0645 \u064a\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u062a\u0627\u062d\u0629.';

/**
 * The problem code an appended identity notice records. Named as a constant so a guard
 * pins the code rather than a string retyped in two places.
 */
export const IDENTITY_NOT_RESPECTED = 'REQUESTED_IDENTITY_NOT_RESPECTED';

/**
 * The problem code a stray `</source>` records (AA-30). Named as a constant for the same reason as
 * the one above: a guard pins the code, not a string retyped in two places.
 */
export const ORPHAN_SOURCE_CLOSER = 'ORPHAN_SOURCE_CLOSER';

/**
 * The problem code a lead-in with nothing behind it records (AA-85). Named for the same
 * reason as the two above: a guard pins the code, not a string retyped in two places.
 */
export const DANGLING_LEAD_IN = 'DANGLING_LEAD_IN';

/**
 * The problem code a grade with no source standing with it records (AA-83). Named for the
 * same reason as the three above.
 */
export const UNSOURCED_GRADE = 'UNSOURCED_GRADE';

// ── [111-log] · WHAT THIS SEAT REMOVED, SAID OUT LOUD ────────────────────────
//
// MEASURED (EZIK-111-BATTERY-MEASURE-REPORT-2026-09-21 §2): of the stages that can take a
// sentence out of an answer, the ones in this function printed nothing, so two of the owner's
// complaints could only be judged by elimination. Every cut below is now recorded on the return
// value, and api/ask.js prints it under `[finalize/drop]`. THE TEXT IS NOT TOUCHED: `drops` is
// computed from the before and after of each stage and read by nobody inside this function.
//
// [111-log2] · ONE LINE PER CUT, AND `removed` IS THE CUT ITSELF. It used to be the span between
// the common head and tail of the two texts, so two cuts far apart in one stage printed everything
// between them — measured on the preview at 6119411 (21:13:31Z): the grade rule took «الضعيف» and
// a second word a paragraph later, and the line began at «الضعيف…» and ran into the next paragraph,
// so nobody could tell what the second cut was. Now the two texts are compared word by word, and
// every run of words that is in `before` and not in `after` is one cut and one entry. Capped at 200
// characters here, so no caller can print more.
export const DROP_REMOVED_MAX = 200;
// Past this many cells the word table is not built, and the stage reports the one span between the
// common head and tail, exactly as before [111-log2]. A stage cuts sentences, not whole answers, so
// the middle that reaches the table is small; this is a ceiling on memory, not a working limit.
const DROP_DIFF_MAX_CELLS = 4_000_000;
function removedPieces(before, after) {
  const a = String(before == null ? '' : before);
  const b = String(after == null ? '' : after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  // Widen the middle to whole words, so a cut that begins or ends inside a word is read whole.
  while (head > 0 && !/\s/u.test(a[head - 1])) head -= 1;
  while (tail > 0 && !/\s/u.test(a[a.length - tail])) tail -= 1;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(Math.min(head, b.length), Math.max(head, b.length - tail));
  const wa = midA.split(/(\s+)/u).filter(Boolean);
  const wb = midB.split(/(\s+)/u).filter(Boolean);
  const piece = (words) => words.join('').trim().slice(0, DROP_REMOVED_MAX);
  if (!wa.length) return [];
  if (!wb.length || (wa.length + 1) * (wb.length + 1) > DROP_DIFF_MAX_CELLS) {
    const whole = piece(wa);
    return whole ? [whole] : [];
  }
  // Longest common subsequence of words, then every run of `before` words outside it is a cut.
  const cols = wb.length + 1;
  const lcs = new Int32Array((wa.length + 1) * cols);
  for (let i = wa.length - 1; i >= 0; i -= 1) {
    for (let j = wb.length - 1; j >= 0; j -= 1) {
      lcs[i * cols + j] = wa[i] === wb[j]
        ? lcs[(i + 1) * cols + j + 1] + 1
        : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
    }
  }
  const pieces = [];
  let run = [];
  const close = () => {
    const text = piece(run);
    if (text) pieces.push(text);
    run = [];
  };
  let i = 0;
  let j = 0;
  while (i < wa.length) {
    if (j < wb.length && wa[i] === wb[j]) {
      // Whitespace alone between two removed words does not separate two cuts.
      if (run.length && !/^\s+$/u.test(wa[i])) close();
      else if (run.length) run.push(wa[i]);
      i += 1; j += 1;
    } else if (j < wb.length && lcs[i * cols + j + 1] >= lcs[(i + 1) * cols + j]) {
      j += 1;
    } else {
      run.push(wa[i]);
      i += 1;
    }
  }
  close();
  return pieces;
}

/**
 * The problem code an answer left with nothing but the reviewer's own marks records
 * (AA-86). It is deliberately NOT added to `repaired` anywhere: an answer whose whole
 * substance was removed is one that cannot be sent, and the refusal at the foot of
 * finalizeReaderText is the existing machinery for saying so.
 */
export const ANSWER_WITHOUT_SUBSTANCE = 'ANSWER_WITHOUT_SUBSTANCE';

/**
 * The problem code an answer this function emptied down to a bare promise records (AA-90).
 * Named for the same reason as the four above: a guard pins the code, not a string retyped in
 * two places. Like ANSWER_WITHOUT_SUBSTANCE it is deliberately NOT added to `repaired` — an
 * answer whose promise has nothing left behind it is one that cannot be sent, and the refusal
 * at the foot of finalizeReaderText is the existing machinery for saying so.
 */
export const ANSWER_IS_ONLY_A_PROMISE = 'ANSWER_IS_ONLY_A_PROMISE';

const asArray = (value) => Array.isArray(value) ? value : [];

// ── AA-85 · A LEAD-IN WITH NOTHING BEHIND IT ────────────────────────────────
//
// MEASURED (BOOK-TEXT-REPORT-2026-09-04.md section 6): SEVEN of the nine places an answer can be
// cut after generation can delete what a line announced while leaving the line — the whole line
// emptied by `deliverableText` (loop.js:1018, :1024-1031, :855), the card removed whole by
// `stripUnownedSourceCards` (finalized-sse-writer.js:46) with the list marker of AA-32 on top of
// it, and the sentence dropped by `screenDraft` (consistency-gate.js:894). Exactly ONE runtime
// module in the tree ever asked whether they did: lib/takhrij-lock.js:308, for its own cut only.
//
// SO THE DETECTOR IS ASKED HERE TOO, AT THE SEAT, WHERE EVERY EXIT ARRIVES. That is the point of
// putting it here rather than in each of the seven: a repair in the seven closes the seven, and
// an eighth path nobody enumerated goes on shipping a promise with nothing behind it.
//
// ── AND IT IS THE NARROW HALF OF D1, NOT THE WIDE ONE ──
// `colonPreambles` calls a preamble ORPHANED when the next block is not a quote, an ayah, a card
// or a list item — which ordinary prose after a colon is not. That reading is right for the
// takhrij lock, which owns a before-and-after of its OWN cut and repairs only what its cut
// orphaned. Here there is no before: the cut happened upstream and this function is handed the
// result. So the only shape acted on is the one that cannot be misread — `closing`: the preamble
// is the LAST block, and nothing whatever follows it. A colon with real content behind it, a
// list introduced by a colon, a heading with a body: all three keep every byte.
//
// ── AND NOTHING IS CUT WHEN SOMETHING IS STILL TO BE APPENDED ──
// lib/finalized-sse-writer.js:452 appends `approvedAttachmentSuffix` — the owned card suffix and
// the reader cards — AFTER this function returns. A lead-in that is last HERE may therefore have
// its card behind it on the wire, and cutting it would delete the introduction of a card that
// did arrive. Both lists reach this input (`cards` at :431, `readerCards` on the context), and a
// server-owned `readerSuffix` is inside the text for the same reason, so all three are consulted
// before a byte is removed.
//
// ── AND AN ANSWER THAT IS NOTHING BUT A PROMISE IS LEFT ALONE ──
// Removing the only line there is would hand the writer an empty approval, and
// lib/finalized-sse-writer.js:467 already has a name for that. Whether such an answer should be
// refused outright is a product decision and is not taken here; it is left exactly as it arrived.
// ── AA-89 · A MARK IS NOT THE CONTENT A LEAD-IN PROMISED ────────────────────
//
// MEASURED (PRE-MERGE-AUDIT-2026-09-04.md §4/C2). The reviewer welds
// `TAGS.ATTRIBUTION_REMOVED` onto the sentence it stripped a credit from. When that sentence
// was a lead-in, the line no longer ENDS in a colon, `colonPreambles` returns nothing, and the
// reader keeps a promise with nothing behind it:
//
//   in       «المسح على الخفين جائز للمسافر ثلاثة أيام بلياليها.»
//            «وقد ذكر ابن قدامة أن الدليل على ذلك:»
//   reviewed the ruling, then the fiqh notice on its own line, then
//            «الدليل على ذلك: » with the tag welded after the colon
//   seat     colonPreambles(reviewed) = []   —   out = in, byte for byte
//
// ── SO THE LINE IS READ AS THE READER READS IT ──
// A trailing mark is not content, and a line that is nothing BUT a mark is not the content a
// line above it announced. Both follow from one act: the question is asked over the text with
// every mark this product welds on folded away. `foldReaderMarks` is lib/output-reviewer.js's,
// borrowed exactly as `carriesReaderSubstance` is and for the same stated reason — that file
// owns the wording, this one owns neither a copy of it nor a second list.
//
// ── AND THE CUT IS STILL MADE ON THE ORIGINAL ──
// Only the READING is folded. No mark contains a newline, so the folded text has the same lines
// in the same order, and the index the detector points at is the index of the line as it
// actually stands. That line is removed whole, tag and all, which is right: the tag was welded
// onto the sentence being removed and has nothing left to qualify.
//
// ── WHAT THIS IS NOT ──
// It is not a widening of what counts as a lead-in. A line carrying a mark now behaves EXACTLY
// as the same line behaves without one — no more and no less — and every negative the rule
// already had still holds: a colon with real content behind it, a list, a heading with a body,
// and an answer that is nothing but a promise.
//
// ── AND IT IS A GAP, NOT A REGRESSION ──
// On `main` this answer shipped identically; AA-85 did not exist at the seat at all. The bar is
// improvement with no collateral, which is why the equivalence above is asserted as a guard row
// rather than described here.
// ── AND IT REPORTS THE SHAPE IT ALREADY MEASURED ───────────────────────────
// `onlyPromise` is the answer to «is this whole text nothing but a promise with nothing behind
// it?», and this function has always computed it — it is the `!kept.trim()` branch, the one
// that declines to cut. It was thrown away. AA-90 below needs exactly that fact, of two
// different texts, and deriving it a second time elsewhere would be a second answer to one
// question the day either copy is edited.
function dropDanglingLeadIn(text, mayBeFollowed) {
  if (mayBeFollowed) return { text, removed: '', onlyPromise: false };
  const closing = colonPreambles(foldReaderMarks(text)).find((preamble) => preamble.closing);
  if (!closing) return { text, removed: '', onlyPromise: false };
  const lines = text.split('\n');
  const kept = lines.filter((_, index) => index !== closing.index).join('\n');
  if (!kept.trim()) return { text, removed: '', onlyPromise: true };
  return { text: kept, removed: closing.line, onlyPromise: false };
}

/** Pure, deterministic final check over the exact prose destined for the reader. */
export function finalizeReaderText(input = {}) {
  const original = String(input.text == null ? '' : input.text);
  if (input.kind && input.kind !== 'answer') {
    return { ok: true, text: original, problems: [], replaced: false };
  }

  // ── ١١١ · THE SEAT READS THE PROOF THE SEAL READ ─────────────────────────────
  //
  // MEASURED 21 September 2026, on the twin: the seal in api/ask.js keeps «(متفق عليه)» because
  // the takhrij pass handed it the library rows that proved it (`takhrijProvenRows`), and the lock
  // below — run a second time, over the pages alone — could not see those rows, so it deleted the
  // sentence and salvaged the matn bare, in three of four shapes and without a line in the log.
  // The one parenthetical the pass could PROVE was the one that never reached the reader.
  //
  // So the same rows arrive as `takhrijProven` and join the pages here. In this function `sources`
  // feeds that lock and nothing else; api/ask.js keeps the rows out of its own `sources` field
  // (guards/takhrij-contract-guard.cjs 10d). A parenthetical the MODEL wrote has no row behind it
  // and goes exactly as it did.
  const proven = asArray(input.takhrijProven);
  const sources = proven.length ? [...asArray(input.sources), ...proven] : asArray(input.sources);
  const problems = [];
  const degraded = [];
  const drops = [];
  const dropped = (stage, kind, before, after) => {
    if (before === after) return;
    const pieces = removedPieces(before, after);
    // A stage that changed the text and removed no word still says so, once, as it always did.
    for (const removed of pieces.length ? pieces : ['']) drops.push({ stage, kind, removed });
  };
  // A problem code is FATAL unless it is recorded here as already repaired. Membership is added
  // by the branch that performed the repair, so a code can never be excused by a list written
  // somewhere else that has drifted from what the code actually did.
  const repaired = new Set(['UNSUPPORTED_TAKHRIJ']);
  let outcome = 'CLEAN';
  if (original.includes('<source')) problems.push('UNSTRUCTURED_SOURCE_CARD');
  const locked = lockTakhrij(original, sources);
  let text = locked.text;
  dropped('lock', [...new Set([
    ...locked.removed.map((r) => r.kind),
    ...(locked.droppedSentences.length ? ['sentence'] : []),
  ])].join(',') || 'rewrite', original, text);
  // AA-30 -- A CLOSER WITH NO OPENER IS A STRAY BRACKET, NOT A CARD, AND IT IS REPAIRED, NOT
  // REFUSED. The test above cannot see it: '</source>'.includes('<source') is false, because the
  // slash sits where the 's' is looked for. So an orphan closer passed this net untouched and
  // reached the reader as raw markup.
  //
  // WHY IT IS NOT FATAL. The discriminator is the one the comment over `fatal` below already
  // states: an unstructured card carries a site and a url -- an attribution this code cannot
  // verify -- so its text is unsafe and cannot be repaired locally, and the refusal at the foot of
  // this function replaces the WHOLE answer with FINALIZER_REFUSAL. A bare `</source>` carries no
  // site, no url, no title and no claim. Refusing it would trade a stray bracket for a lost
  // answer, which is the worse outcome for the reader. It is removed and the body ships, exactly
  // as UNSUPPORTED_TAKHRIJ and IDENTITY_NOT_RESPECTED are removed-and-shipped.
  //
  // A well-formed pair is untouched here: it contains '<source', so it is already FATAL one line
  // above and never reaches this branch.
  if (/<\/source>/iu.test(text)) {
    const beforeCloser = text;
    text = text.replace(/<\/source>/giu, '');
    dropped('orphan-closer', 'source-closer', beforeCloser, text);
    problems.push(ORPHAN_SOURCE_CLOSER);
    repaired.add(ORPHAN_SOURCE_CLOSER);
    degraded.push('source:orphan-closer');
  }
  if (locked.removed.length || locked.droppedSentences.length) {
    problems.push('UNSUPPORTED_TAKHRIJ');
  }
  degraded.push(...asArray(locked.degraded));
  if (locked.outcome && locked.outcome !== 'CLEAN') outcome = locked.outcome;

  // ── ONE MATN IS NOT DELIVERED TWICE IN ONE ANSWER ───────────────────────────
  //
  // MEASURED on the owner's «ما صفة صلاة الاستخارة؟ مع تخريج حديثها.» in طالب علم: Jābir's
  // ḥadīth and the istikhāra duʿāʾ arrived TWICE IN FULL — once as the card «دعاء صلاة
  // الاستخارة — حصن المسلم» and once inside a graded `<hadith>` — and the sifa sentence three
  // times over. The rule and its whole reasoning live in lib/repeated-matn.js; what belongs
  // HERE is why it is asked at this seat and in this position.
  //
  // WHY THIS SEAT. It is the one place the WHOLE answer is visible with its cards inline, and
  // AA-85 above already states the principle for a rule of this shape: a repair asked in each
  // of the exits closes the exits, and a repair asked at the seat closes the class. The
  // reviewer cannot ask it: two of the four block kinds that carry a matn — `<dhikr id>` and
  // `<worship id>` — are EMPTY on the wire and are drawn by the client out of adhkar.json and
  // worship-display.json, and lib/output-reviewer.js reads no file and must go on reading none.
  //
  // WHY AFTER THE LOCK AND BEFORE THE SCREEN. After, because a matn the takhrij lock has
  // already dropped is not a repeat and must not be counted as one — the comparison is made on
  // the text as the lock left it. Before, because the screen's own cut is decided sentence by
  // sentence and a duplicate block removed first is one fewer sentence for it to judge.
  //
  // IT IS RECORDED, AND IT IS NOT FATAL. A repeat removed is a repair, exactly as
  // ORPHAN_SOURCE_CLOSER and UNSUPPORTED_TAKHRIJ are: the body ships. Refusing an answer for
  // having said one thing twice would be the worse outcome for the reader by a long way.
  const deduped = dropRepeatedMatn(text);
  if (deduped.dropped.length) {
    dropped('repeated-matn', deduped.dropped.map((cut) => cut.reason + ':' + cut.kind).join(','), text, deduped.text);
    text = deduped.text;
    problems.push(REPEATED_MATN);
    repaired.add(REPEATED_MATN);
    for (const cut of deduped.dropped) degraded.push('matn:repeat-' + cut.reason + ':' + cut.kind);
  }

  if (input.consistencyContext) {
    const entity = String(input.consistencyContext.entity || '');
    const screenInput = entity
      ? text.split('\u00ab' + entity + '\u00bb').join(entity)
      : text;
    const screened = screenDraft(screenInput, input.consistencyContext);
    if (screened.problems.length) problems.push(...screened.problems);
    degraded.push(...asArray(screened.degraded));
    // \u2500\u2500 THE REBUILD IS THE REPAIR, NOT A REASON TO REFUSE (\u0623-\u0666/\u0664) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    //
    // `text = screened.text` was DEAD CODE. It ran only when screenDraft reported problems, and
    // every one of those codes then made `fatal` true one branch later \u2014 so the rebuilt text was
    // computed, assigned, and thrown away in favour of the blanket refusal, on every single path.
    //
    // But those codes are the screen's account of a cut it ALREADY MADE. `outcome: 'REBUILT'`
    // (dropWhole false) means the offending sentences are gone from `screened.text` and what
    // remains is the material that passed. Refusing it discards a safe, sourced, shorter answer
    // and replaces it with \u00ab\u0644\u0627 \u0623\u0633\u062a\u0637\u064a\u0639 \u0625\u0631\u0633\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u062c\u0648\u0627\u0628\u00bb \u2014 the reader loses an answer the gate had
    // already made safe. Only `dropWhole` \u2014 the screen's own verdict that NOTHING survives \u2014 and
    // the unverified-identity escalation are fatal, because there the unsafe text cannot be
    // repaired locally, which is exactly what the original comment said the rule was.
    if (screened.dropWhole) {
      problems.push('CONSISTENCY_DROP_WHOLE');
      outcome = 'REFUSED';
    } else if (screened.problems.length) {
      const rebuilt = String(screened.text || '');
      if (rebuilt.trim()) {
        dropped('screen', 'rebuilt', text, rebuilt);
        text = rebuilt;
        for (const problem of screened.problems) repaired.add(problem);
        outcome = 'REBUILT';
      } else {
        // A REBUILT verdict with nothing left in it is a REFUSED verdict that mislabelled itself.
        problems.push('CONSISTENCY_DROP_WHOLE');
        outcome = 'REFUSED';
      }
    }
    if (input.consistencyContext.identityStatus === 'unknown'
      && !input.consistencyContext.identityVerified
      && assertsUnverifiedIdentityAbout(screenInput, input.consistencyContext.entity)) {
      problems.push('IDENTITY_WITHOUT_EVIDENCE', 'CONSISTENCY_DROP_WHOLE');
      outcome = 'REFUSED';
    }
  }

  // ── AA-85 · THE LEAD-IN GOES WHEN ITS CONTENT DID NOT ARRIVE ──────────────
  // Placed after every cut this function makes and before the identity notice, so that the
  // notice is never mistaken for the content a lead-in announced, and so `noticeInsertionIndex`
  // places it into the text the reader actually receives.
  const mayBeFollowed = asArray(input.cards).length > 0
    || asArray(input.sourceCards).length > 0
    || asArray(input.readerCards).length > 0
    || String(input.readerSuffix || '').trim() !== '';
  // ── AA-83 · A GRADE STANDS ONLY WHERE A SOURCE STANDS WITH IT ─────────────
  // Placed HERE, at the seat, for the reason AA-85 is here: the one route that already governed
  // a grade governed only the STRUCTURED field and only on its own path (lib/anchor/units.js:181
  // from api/ask.js:3857), so the same question answered by any other exit shipped the grade. A
  // grade written as prose was governed nowhere at all.
  //
  // AFTER THE LOCK AND AFTER THE SCREEN, DELIBERATELY. Both of them drop whole sentences, and a
  // sentence they drop may be the one that carried the source for a grade in the sentence beside
  // it. Asking before their cuts would license a grade whose source is about to be removed.
  //
  // THE TEXT IS NEVER REMOVED FOR ITS GRADE. What leaves is the grading word; the narration, the
  // ayah and every other word of the block stay exactly as they arrived. Deleting a hadith in
  // order to delete its grade would be a far worse defect than the one being repaired.
  const grades = dropUnsourcedGrades(text, { followedByCard: mayBeFollowed });
  if (grades.removed.length) {
    dropped('grades', [...new Set(grades.removed.map((r) => r.shape))].join(','), text, grades.text);
    text = grades.text;
    problems.push(UNSOURCED_GRADE);
    repaired.add(UNSOURCED_GRADE);
    degraded.push('grade:no-source-with-it');
  }

  const leadIn = dropDanglingLeadIn(text, mayBeFollowed);
  if (leadIn.removed) {
    dropped('lead-in', 'nothing-behind-it', text, leadIn.text);
    text = leadIn.text;
    problems.push(DANGLING_LEAD_IN);
    repaired.add(DANGLING_LEAD_IN);
    degraded.push('lead-in:nothing-behind-it');
  }

  // [111-close-5] — a sentence that leaned on one these cuts took does not open on its connective, its frame
  // or its back-reference (lib/orphan-openers.js). Read against `original`, so an untouched answer is untouched.
  const orphans = repairOrphanedOpeners(original, text);
  if (orphans.repaired.length) {
    dropped('orphan', [...new Set(orphans.repaired.map((r) => r.kind))].join(','), text, orphans.text);
    text = orphans.text;
    degraded.push('orphan-opener:' + orphans.repaired.length);
  }

  // ── AA-90 · A PROMISE THIS SEAT EMPTIED IS NOT HANDED OVER BARE ───────────
  //
  // MEASURED, 20 Sep 2026, on the audit witness the AA-86 block below is built from, driving
  // this function alone on the tree as it stands:
  //
  //   in   «قال ابن قدامة إن إسناده صحيح.</source>» + «والدليل على ذلك:»
  //   out  «\nوالدليل على ذلك:»        ok=true   outcome=CLEAN
  //        problems=[ORPHAN_SOURCE_CLOSER, UNSOURCED_GRADE]
  //
  // A blank line and a naked colon, and this function called it CLEAN. The one sentence that
  // answer had was removed HERE, by `dropUnsourcedGrades` a few lines above, and what was left
  // standing is the line whose whole job was to introduce it. guards/takhrij-lock-guard.cjs
  // recorded this same measurement on 18 Sep, in the AA-86 block, and left it open in so many
  // words — «it is NOT repaired here, because every repair for it is in lib/**». This is that
  // repair, at that seat.
  //
  // ── WHY EVERY EXISTING NET MISSES IT ──
  // `dropDanglingLeadIn` immediately above FOUND the lead-in and declined to cut it, and was
  // right to: cutting it would leave nothing at all. AA-86 below asks whether any SUBSTANCE
  // survived, and a promise is substance by that test — it carries letters. So one net saw the
  // shape and would not act, the other acted on a shape this is not, and between them a naked
  // colon shipped with ok=true.
  //
  // ── AND IT IS THE TRANSITION THAT IS FORBIDDEN, NOT THE SHAPE ──
  // Exactly as AA-86 states it for substance, and for the same reason. An answer that ARRIVED
  // as nothing but a promise is still left alone: this function had no hand in shaping it, the
  // AA-85 block at the head of this file took that product decision deliberately, and it is not
  // reopened here. What is forbidden is TURNING an answer that had something behind its promise
  // into one that has nothing. So the one question is asked twice — of `original` and of the
  // text as it now stands — and the rule fires only where the answer has changed.
  //
  // ── AND A MARK IS NOT WHAT CHANGES IT ──
  // Both askings go through `dropDanglingLeadIn`, which reads its input with the marks folded
  // away. So «promise + mark» in and «promise» out is NOT a transition: it is one answer read
  // the way the reader reads it, which is what AA-89 above establishes in a line — a line
  // carrying a mark behaves exactly as the same line behaves without one, no more and no less.
  //
  // ── AND IT REFUSES RATHER THAN CUTTING, AND REMOVES NOTHING ──
  // There is nothing left to cut. The precedent is AA-86’s and the screen’s: the code is
  // recorded, it is NOT marked repaired, and the refusal at the foot of this function returns
  // the caller’s fallback line, which is a sentence. This rule deletes no byte of any answer at
  // any point — no matn, no ayah, no ruling passes through it — it only declines to send a
  // promise that this seat itself emptied.
  //
  // ── AND IT IS ASKED BEFORE THE IDENTITY NOTICE, DELIBERATELY ──
  // For the reason the AA-85 block gives a few lines above: a notice is never the content a
  // lead-in announced. Asked after, an appended notice would be standing behind the colon and
  // the naked promise would ship with a disclaimer for a body.
  const onlyPromiseNow = dropDanglingLeadIn(text, mayBeFollowed).onlyPromise;
  const onlyPromiseOnArrival = dropDanglingLeadIn(original, mayBeFollowed).onlyPromise;
  if (onlyPromiseNow && !onlyPromiseOnArrival) {
    problems.push(ANSWER_IS_ONLY_A_PROMISE);
    degraded.push('lead-in:all-that-is-left');
  }

  // ── E75 · THE PERSON ASKED ABOUT, CHECKED WHERE EVERY READER PASSES ────────
  //
  // ── WHY IT IS HERE AND NOT ONLY IN THE REVIEWER ──
  // MEASURED (PATH-TAKEN-REPORT-2026-09-04.md §1, §6): lib/output-reviewer.js is reachable
  // from EXACTLY ONE of api/ask.js's fifty-seven exits — the free brain's, at api/ask.js:1754
  // — because it is imported only by lib/free-brain/review.js:39 and lib/sentence-stream.js:52,
  // those only by lib/free-brain/loop.js:55 and :67, and that file only by api/ask.js:1522.
  // Every other exit reaches THIS function instead. The stored path has been carrying the
  // answer to «who was asked about» into this very input object since api/ask.js:1766 set
  // `finalizerContext.requestedIdentity`, and until now no line in this file read it.
  //
  // ── AND IT SITS OUTSIDE THE BLOCK ABOVE, DELIBERATELY ──
  // `if (input.consistencyContext)` at the top of this function is nulled ON PURPOSE by three
  // exits — api/ask.js:1408 (the frozen local turn), :1538 (the free brain) and :1769 (the
  // stored path) — for a reason that has nothing to do with identity: the sentence-dropping
  // cleaner is the wrong instrument on those paths. Reading the identity inside that block
  // would mean the exits that answer the most readers get no identity check because a
  // DIFFERENT check was switched off. So it carries its own condition and reads its own field.
  //
  // ── THE FIRING RULE IS THE DETECTOR'S OWN, BORROWED WHOLE ──
  // `identityView` (lib/output-reviewer.js:449-463) returns null for anything that is not an
  // object carrying a non-empty name AND one of the three known statuses, and
  // `requestedIdentityRespected` (lib/output-reviewer.js:1306) returns «respected» for an
  // answer that names the right man and for an answer that names no registered man at all
  // (:1340-1345, :1358-1364). That is not a detail. Twelve of the twenty-one rows in that
  // file's registry carry no identity a reader can be told about, and an over-refusal here
  // would answer a question about one of them with «the system does not know him». SILENCE IS
  // THE GOVERNING DEFAULT, and the absent field is the commonest case by far.
  //
  // ── APPEND, NEVER REPLACE, AND NEVER TWICE ──
  // The same discipline as lib/output-reviewer.js:1878-1881: the notice is skipped when the
  // text already carries it — which is what keeps a reply from being told twice on any path
  // that later reaches both the reviewer and this seat — and it is placed by that file's own
  // `noticeInsertionIndex` over the same '\n'-separated chunks the reviewer splices into, so
  // there is one placement rule in the product and not two. The code is recorded and marked
  // repaired in the same breath: an appended notice is an ADDITION to an otherwise safe
  // answer, and must never become the reason one is refused.
  // ── AND NOTHING IS SAID ABOUT AN ANSWER THAT WAS NEVER GIVEN ──
  //
  // MEASURED, on the first run of this change: guards/shipped-reality-guard.cjs:301 and
  // guards/stored-deen-sub-suite.cjs:500 both went red, and both were RIGHT. They drive the real
  // handler with «ما رأي خالد المصلح خالد السبت في الجمع بين الصلاتين للمسافر؟» — a genuinely
  // ambiguous name — and assert that the reply is the stored path's «no evidence» line and
  // NOTHING ELSE: not a chosen candidate, and not the deterministic interrogation that was
  // retired from this product. The ambiguity notice ends in a question, so appending it to that
  // line put the retired interrogation back on the reader's screen under a new name.
  //
  // The rule that stops it is not «except when a guard is watching». A notice of this family is a
  // statement ABOUT a ruling — who it is and is not about — and a refusal carries no ruling to be
  // about. So when the finalized prose is nothing but the caller's own fallback line, there is
  // nothing here to qualify and the seat says nothing. That is the same reasoning
  // lib/output-reviewer.js:1238-1242 uses in the other direction: it fires on a TRUNCATED answer
  // because a half-written answer about the wrong man is still about a man.
  const fallbackLine = String(input.fallbackText || FINALIZER_REFUSAL).trim();
  const carriesARuling = text.trim() !== ''
    && text.trim() !== fallbackLine
    && text.trim() !== FINALIZER_REFUSAL;
  const askedIdentity = carriesARuling ? identityView(input.requestedIdentity) : null;
  if (askedIdentity) {
    const identity = requestedIdentityRespected(text, askedIdentity);
    if (!identity.respected && identity.notice && !text.includes(identity.notice)) {
      const chunks = text.split('\n');
      chunks.splice(noticeInsertionIndex(chunks), 0, identity.notice);
      text = chunks.join('\n');
      problems.push(IDENTITY_NOT_RESPECTED);
      repaired.add(IDENTITY_NOT_RESPECTED);
      degraded.push('identity:' + identity.reason);
    }
  }

  // F-010 is a sanitising lock, not a refusal gate: an unsupported collector/grade is removed
  // while the independently safe body remains. Structural cards and consistency failures are
  // still fail-closed because their unsafe text cannot be repaired locally.
  // ── AA-86 · A REMOVAL MUST NOT LEAVE AN ANSWER THAT IS ONLY ITS OWN MARKS ──
  //
  // MEASURED (PRE-MERGE-AUDIT-2026-09-04.md §4, case C4), driving the real modules in the
  // order a reader's request drives them — lib/output-reviewer.js and then this function:
  //
  //   in   «قال ابن قدامة إن إسناده صحيح.</source>» + «والدليل على ذلك:»          91 bytes
  //   out  the ATTRIBUTION_REMOVED tag alone + the fiqh notice              224 bytes
  //        ok=true  outcome=CLEAN  problems=[ORPHAN_SOURCE_CLOSER, UNSOURCED_GRADE,
  //                                          DANGLING_LEAD_IN]
  //
  // Two hundred and twenty-four bytes, and not one of them an answer. The reader was handed
  // two disclaimers about a ruling that no longer existed, and this function called it CLEAN.
  //
  // ── WHY EVERY EXISTING NET MISSED IT ──
  // Each of the three removals above refuses to empty an answer, and each was right on its own
  // terms: `dropUnsourcedGrades` hands back the original where nothing would be left,
  // `dropDanglingLeadIn` refuses to cut a lead-in that is the whole reply, and the screen's
  // rebuilt-with-nothing-left branch a hundred lines above already says in words that such a
  // verdict is «a REFUSED verdict that mislabelled itself». All three ask «is anything left?»
  // of the WHOLE text, and a reviewer's mark is text. So three passes each left the answer
  // non-empty, and between them they left it empty of everything but marks.
  //
  // ── THE RULE, AND WHY IT IS THIS ONE ──
  // What is forbidden is not «an answer with no substance» — this function is handed those and
  // must not invent a refusal for them — but TURNING an answer that had substance into one
  // that has none. So both ends are measured and the rule fires only on the transition. An
  // answer that arrived as marks alone leaves exactly as it arrived.
  //
  // ── AND IT REFUSES RATHER THAN UNDOING ──
  // The other repair available was to hand back `original`, which is what each individual net
  // does. It is wrong here: `original` is the text that carried the stray closer, the
  // unsourced grade and the promise with nothing behind it, and undoing all three would ship
  // the reader every defect this batch closed in order to avoid shipping him a blank. The
  // precedent inside this very function is the other one — the screen's own
  // rebuilt-with-nothing-left branch pushes CONSISTENCY_DROP_WHOLE and refuses — and it is
  // followed here: the code is recorded, it is NOT marked repaired, and the refusal path at
  // the foot of this function returns the caller's fallback line, which is a sentence.
  if (carriesReaderSubstance(original) && !carriesReaderSubstance(text)) {
    problems.push(ANSWER_WITHOUT_SUBSTANCE);
    degraded.push('answer:marks-only');
  }

  const finalText = stripReaderTags(text);
  // ── AND AN ANSWER THAT WAS NOTHING BUT MARKS IS NOW NOTHING AT ALL ─────────────
  //
  // AA-86 above rules that an answer which ARRIVED as marks alone «leaves exactly as it
  // arrived» — this function had no hand in shaping it and must not invent a refusal for it.
  // That rule was written when a mark was still deliverable text. With البند ٣ it is not, so
  // «exactly as it arrived» would now mean the empty string, and the reader would be handed a
  // blank reply. That is not what removing a mark alone means.
  //
  // SO THE SEAT GIVES ITS OWN ANSWER TO «NOTHING IS LEFT», the one it already gives six lines
  // above and the one guards/takhrij-lock-guard.cjs affirms in the row «an answer stripped down
  // to its own marks is REFUSED, not delivered»: the code is recorded, it is NOT marked
  // repaired, and the refusal at the foot of this function returns the caller’s fallback — a
  // sentence. A blank reply and a plain sentence were the only two outcomes available here, and
  // between them the sentence is not a close call.
  //
  // IT CANNOT FIRE ON AN ANSWER THAT HAD ANY SUBSTANCE: the marks are the only thing this
  // removes, so a text that still holds a letter or a digit still holds it afterwards.
  // AND IT IS SCOPED TO THE BRANCH AA-86 EXCLUDES, NOT TO ITS OWN. The test six lines above
  // owns «an answer that HAD substance and lost it», and guards/takhrij-lock-guard.cjs mutates
  // it to prove the seat still asks. A second net that also caught that case would let the
  // mutation pass unnoticed -- the answer would still be refused, by the wrong rule -- so this
  // one fires ONLY where the other declines to: on an answer that arrived carrying no substance
  // at all. The two are complements, and neither covers the other.
  if (!carriesReaderSubstance(original) && original.trim() && !finalText.trim()
    && !problems.includes(ANSWER_WITHOUT_SUBSTANCE)) {
    problems.push(ANSWER_WITHOUT_SUBSTANCE);
    degraded.push('answer:marks-only-removed');
  }

  const fatal = problems.some((problem) => !repaired.has(problem));
  if (fatal) {
    const fallback = String(input.fallbackText || FINALIZER_REFUSAL);
    return {
      ok: false,
      text: fallback,
      problems: [...new Set(problems)],
      replaced: true,
      // \u0623-\u0666/\u0665 \u2014 both were computed and both were dropped on the floor. A caller that cannot see
      // WHETHER the text it is about to ship was degraded cannot report it, log it, or decide
      // against it.
      degraded: [...new Set(degraded)],
      drops,
      outcome: 'REFUSED',
    };
  }
  // ── البند ٣ · NO MARK OF THE FIVE LEAVES THIS SEAT ───────────────────────
  //
  // MEASURED and recorded in the round-two report §٨-أ/٤: no system text in this tree asks the
  // model for any of the five, but `dropRepeatedIncomingTags` drops the SECOND copy onward and
  // passes the FIRST — so a mark the model writes of its own accord reaches the reader.
  //
  // WHY THE SEAT AND NOT THAT LEDGER. The ledger is asked per prose part inside the reviewer,
  // and a card run never reaches it at all: lib/output-reviewer.js pushes `run.kind === 'card'`
  // straight to the output without consulting it. Closing the ledger would therefore close one
  // route and leave another, and the order asks for «بأيِّ طريق». This is the one place the whole
  // answer is visible with its cards inline and every exit has already arrived — the same reason
  // البند ٢ of the previous round put the repetition rule here.
  //
  // AND IT IS THE LAST THING DONE, DELIBERATELY. Every judgement above — AA-86’s
  // substance test, the screen, the lead-in, the takhrij lock — goes on reading the text with
  // the mark in it, because a mark is what several of them are measuring. Only what LEAVES is
  // stripped. Moving this line above them would change verdicts, which this item must not do.
  return {
    ok: true,
    text: finalText,
    problems: [...new Set(problems)],
    replaced: finalText !== original,
    degraded: [...new Set(degraded)],
    drops,
    outcome,
  };
}
