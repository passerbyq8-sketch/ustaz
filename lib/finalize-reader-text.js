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
  if (original.includes('<source')) problems.push('UNSTRUCTURED_SOURCE_CARD');
  const locked = lockTakhrij(original, sources);
  let text = locked.text;
  if (locked.removed.length || locked.droppedSentences.length) {
    problems.push('UNSUPPORTED_TAKHRIJ');
  }

  if (input.consistencyContext) {
    const entity = String(input.consistencyContext.entity || '');
    const screenInput = entity
      ? text.split('\u00ab' + entity + '\u00bb').join(entity)
      : text;
    const screened = screenDraft(screenInput, input.consistencyContext);
    if (screened.problems.length) problems.push(...screened.problems);
    if (screened.dropWhole) problems.push('CONSISTENCY_DROP_WHOLE');
    else if (screened.problems.length) text = screened.text;
    if (input.consistencyContext.identityStatus === 'unknown'
      && !input.consistencyContext.identityVerified
      && assertsUnverifiedIdentityAbout(screenInput, input.consistencyContext.entity)) {
      problems.push('IDENTITY_WITHOUT_EVIDENCE', 'CONSISTENCY_DROP_WHOLE');
    }
  }

  // F-010 is a sanitising lock, not a refusal gate: an unsupported collector/grade is removed
  // while the independently safe body remains. Structural cards and consistency failures are
  // still fail-closed because their unsafe text cannot be repaired locally.
  const fatal = problems.some((problem) => problem !== 'UNSUPPORTED_TAKHRIJ');
  if (fatal) {
    const fallback = String(input.fallbackText || FINALIZER_REFUSAL);
    return { ok: false, text: fallback, problems: [...new Set(problems)], replaced: true };
  }
  const finalText = text;
  return {
    ok: true,
    text: finalText,
    problems: [...new Set(problems)],
    replaced: finalText !== original,
  };
}
