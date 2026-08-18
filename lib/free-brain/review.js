// lib/free-brain/review.js — THE CONTRACT WITH BRANCH ب, AND NOTHING ELSE.
//
// §٧ of branch أ's directive stated the seam in one line and forbade either branch from changing
// it alone:
//
//   reviewAnswer({ text, evidence, domain, mode }) -> { text, annotations, verdict }
//
// WHAT THIS FILE IS. The call site. Branch أ owns the answer and calls this from EXACTLY ONE
// place (lib/free-brain/loop.js), so when branch ب's module landed the wiring was one import
// inside this file and not a hunt through a three-thousand-line handler for the eleven exits that
// would each have needed it.
//
// WHAT THIS FILE IS NOT. It is not a reviewer. It does not judge, trim, annotate or refuse, and
// it must never grow a rule of its own — the moment it does, there are two output policies and
// the one that ships is whichever file the reader's request happened to touch.
//
// ── WHAT THE MERGE ROUND FIXED, AND WHY IT WAS INVISIBLE ────────────────────
// MEASURED on the merged tree before this edit: `verdict: "unreviewed"` on EVERY case of أ-٣,
// with branch ب's module sitting in the tree, complete and green on six of its own gates. Two
// independent defects, either of which alone was enough:
//
//   1. THE PATH POINTED AT A FILE THAT DOES NOT EXIST. `REVIEWER_MODULE` was
//      '../policy/review-answer.js' — the address branch ب was EXPECTED to use. Branch ب shipped
//      `lib/output-reviewer.js`. The loader below caught the resolution failure and returned the
//      passthrough, exactly as designed, so nothing logged, nothing threw, and every answer went
//      to the reader unreviewed with a verdict that said so and nobody reading.
//   2. THE VERDICT TYPE DID NOT MATCH. The old guard here was `typeof out.verdict === 'string'`.
//      Branch ب returns a verdict OBJECT (`{version, domain, mode, sentences, counts,
//      usedLastResort}`). So even had the path resolved, a real review would have been downgraded
//      to the string 'unreviewed' and its sentence-level record thrown away.
//
// ── THE IMPORT IS STATIC NOW, AND THAT IS THE POINT ─────────────────────────
// The lazy `await import()` existed for one reason branch أ stated honestly: branch ب owned the
// file and it was not in that worktree, so a static import would have made the branch unloadable.
// It is in this tree. Keeping the dynamic form would keep the failure mode that hid defect (1):
// a mistyped path degrading SILENTLY to "nobody reviewed it" instead of failing loudly at load.
// A missing reviewer is now a module-resolution error at import time, which is the only way a
// wiring mistake can be seen before a reader pays for it.
import { reviewAnswer as reviewAnswerPure } from '../output-reviewer.js';

/** Where branch ب's module actually is. Named once so both sides point at one string. */
export const REVIEWER_MODULE = '../output-reviewer.js';

/**
 * @param {object} input
 * @param {string} input.text      the drafted reply, exactly as it will be read
 * @param {Array}  input.evidence  the CITED results with their identity (title/url/id/scholar/
 *                                 snippet/date), normalised by the caller
 * @param {'fiqh'|'general'|'mixed'} input.domain
 * @param {string} input.mode      the reader's mode, verbatim from the request
 * @param {true|false|null} [input.khilafFromOpinions]  §١ prong one. `null` is «I do not know».
 * @param {number|null} [input.opinionCount]            §١/١. Distinct sources behind the answer.
 * @param {true|false|null} [input.truncated]           §٢ (C). `null` is «I do not know».
 * @returns {Promise<{text:string, annotations:Array, verdict:(object|string)}>}
 */
export async function reviewAnswer(input = {}) {
  const text = String(input.text == null ? '' : input.text);
  const passthrough = { text, annotations: [], verdict: 'unreviewed' };

  try {
    const out = await reviewAnswerPure({
      text,
      evidence: Array.isArray(input.evidence) ? input.evidence : [],
      domain: input.domain === 'fiqh' || input.domain === 'general' || input.domain === 'mixed'
        ? input.domain : 'general',
      mode: String(input.mode || ''),
      // ── §١ — THE KHILAF SIGNAL CROSSES THE SEAM HERE, AND NOWHERE ELSE ────
      // The seam normalises rather than forwards, for the reason every other field on this call
      // is normalised: a value that arrives in a shape the reviewer does not expect is not
      // rejected by it, it is silently misread. `null` is the ONLY reading of anything that is
      // not literally `true` or `false` — «I do not know» — because the one thing this must never
      // do is let an absent signal, an `undefined`, or a truthy string become a `false` that
      // suppresses the khilaf tail on a matter that really is disputed.
      khilafFromOpinions: input.khilafFromOpinions === true || input.khilafFromOpinions === false
        ? input.khilafFromOpinions : null,
      // And a count is a whole number or it is nothing. A negative, a fraction or a NaN is not a
      // count of sources, and passing one on as though it were would be inventing evidence.
      opinionCount: Number.isInteger(input.opinionCount) && input.opinionCount >= 0
        ? input.opinionCount : null,
      // ── §٢ (C) — DID THE ANSWER FINISH. SAME SEAM, SAME DISCIPLINE ────────
      // Normalised exactly as `khilafFromOpinions` is, and for exactly the same reason: the only
      // reading of anything that is not literally `true` or `false` is `null`. An absent field, an
      // `undefined`, or a truthy string quietly becoming `false` would tell the reviewer — and
      // through it the reader — that a half-written answer is whole. That is the defect §٢ names,
      // reintroduced one layer below where it was measured.
      truncated: input.truncated === true || input.truncated === false ? input.truncated : null,
    });
    // A REVIEWER THAT ANSWERS IN A SHAPE NOBODY AGREED TO IS A REVIEWER THAT DID NOT ANSWER.
    // Branch أ must not "helpfully" repair a malformed verdict into an approval — that would turn
    // a broken checker into a silent green light, which is the exact failure mode this seam is
    // meant to make impossible.
    if (!out || typeof out.text !== 'string') {
      console.warn('[free-brain/review] malformed reviewer result — text kept, verdict unreviewed');
      return passthrough;
    }
    return {
      text: out.text,
      annotations: Array.isArray(out.annotations) ? out.annotations : [],
      // THE VERDICT IS AN OBJECT AND IS CARRIED AS ONE. A non-empty string is still accepted, so
      // a future reviewer that reports a bare word is not silently discarded; anything else —
      // null, a number, an empty string — means the checker said nothing, and 'unreviewed' is the
      // only honest reading of nothing.
      verdict: verdictOrUnreviewed(out.verdict),
    };
  } catch (error) {
    // A THROWING REVIEWER IS NOT AN APPROVAL EITHER. The text is returned unchanged and the
    // verdict still says nobody reviewed it, so the caller's telemetry records the truth.
    console.warn('[free-brain/review] reviewer threw:', String(error?.message || error));
    return passthrough;
  }
}

function verdictOrUnreviewed(verdict) {
  if (verdict && typeof verdict === 'object') return verdict;
  if (typeof verdict === 'string' && verdict) return verdict;
  return 'unreviewed';
}
