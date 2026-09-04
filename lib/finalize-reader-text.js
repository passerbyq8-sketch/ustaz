import { assertsUnverifiedIdentityAbout, screenDraft } from './policy/consistency-gate.js';
import { lockTakhrij } from './takhrij-lock.js';
// E75 — BORROWED, NOT COPIED. See the block over the identity check below, and the
// export note at the foot of lib/output-reviewer.js. That module imports nothing and
// must go on importing nothing, so the edge runs this way and can never run back:
// measured with the whole static graph, 16 nodes, 0 cycles.
import {
  identityView, noticeInsertionIndex, requestedIdentityRespected,
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

const asArray = (value) => Array.isArray(value) ? value : [];

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
