import { assertsUnverifiedIdentityAbout, screenDraft } from './policy/consistency-gate.js';
import { lockTakhrij, dropUnsourcedGrades } from './takhrij-lock.js';
import { colonPreambles } from './colon-preamble.js';
// E75 — BORROWED, NOT COPIED. See the block over the identity check below, and the
// export note at the foot of lib/output-reviewer.js. That module imports nothing and
// must go on importing nothing, so the edge runs this way and can never run back:
// measured with the whole static graph, 16 nodes, 0 cycles.
import {
  carriesReaderSubstance, identityView, noticeInsertionIndex, requestedIdentityRespected,
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

/**
 * The problem code an answer left with nothing but the reviewer's own marks records
 * (AA-86). It is deliberately NOT added to `repaired` anywhere: an answer whose whole
 * substance was removed is one that cannot be sent, and the refusal at the foot of
 * finalizeReaderText is the existing machinery for saying so.
 */
export const ANSWER_WITHOUT_SUBSTANCE = 'ANSWER_WITHOUT_SUBSTANCE';

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
function dropDanglingLeadIn(text, mayBeFollowed) {
  if (mayBeFollowed) return { text, removed: '' };
  const closing = colonPreambles(text).find((preamble) => preamble.closing);
  if (!closing) return { text, removed: '' };
  const lines = text.split('\n');
  const kept = lines.filter((_, index) => index !== closing.index).join('\n');
  if (!kept.trim()) return { text, removed: '' };
  return { text: kept, removed: closing.line };
}

/** Pure, deterministic final check over the exact prose destined for the reader. */
export function finalizeReaderText(input = {}) {
  const original = String(input.text == null ? '' : input.text);
  if (input.kind && input.kind !== 'answer') {
    return { ok: true, text: original, problems: [], replaced: false };
  }

  const sources = asArray(input.sources);
  const problems = [];
  const degraded = [];
  // A problem code is FATAL unless it is recorded here as already repaired. Membership is added
  // by the branch that performed the repair, so a code can never be excused by a list written
  // somewhere else that has drifted from what the code actually did.
  const repaired = new Set(['UNSUPPORTED_TAKHRIJ']);
  let outcome = 'CLEAN';
  if (original.includes('<source')) problems.push('UNSTRUCTURED_SOURCE_CARD');
  const locked = lockTakhrij(original, sources);
  let text = locked.text;
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
    text = text.replace(/<\/source>/giu, '');
    problems.push(ORPHAN_SOURCE_CLOSER);
    repaired.add(ORPHAN_SOURCE_CLOSER);
    degraded.push('source:orphan-closer');
  }
  if (locked.removed.length || locked.droppedSentences.length) {
    problems.push('UNSUPPORTED_TAKHRIJ');
  }
  degraded.push(...asArray(locked.degraded));
  if (locked.outcome && locked.outcome !== 'CLEAN') outcome = locked.outcome;

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
    text = grades.text;
    problems.push(UNSOURCED_GRADE);
    repaired.add(UNSOURCED_GRADE);
    degraded.push('grade:no-source-with-it');
  }

  const leadIn = dropDanglingLeadIn(text, mayBeFollowed);
  if (leadIn.removed) {
    text = leadIn.text;
    problems.push(DANGLING_LEAD_IN);
    repaired.add(DANGLING_LEAD_IN);
    degraded.push('lead-in:nothing-behind-it');
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
      outcome: 'REFUSED',
    };
  }
  const finalText = text;
  return {
    ok: true,
    text: finalText,
    problems: [...new Set(problems)],
    replaced: finalText !== original,
    degraded: [...new Set(degraded)],
    outcome,
  };
}
