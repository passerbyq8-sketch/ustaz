import { assertsUnverifiedIdentityAbout, screenDraft } from './policy/consistency-gate.js';
import { lockTakhrij } from './takhrij-lock.js';

export const FINALIZER_REFUSAL =
  '\u0644\u0627 \u0623\u0633\u062a\u0637\u064a\u0639 \u0625\u0631\u0633\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u062c\u0648\u0627\u0628 \u0644\u0623\u0646 \u0628\u0639\u0636 \u0645\u0627 \u0641\u064a\u0647 \u0644\u0645 \u064a\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u062a\u0627\u062d\u0629.';

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
