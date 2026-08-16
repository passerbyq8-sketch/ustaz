// lib/free-brain/review.js — THE CONTRACT WITH BRANCH ب, AND NOTHING ELSE.
//
// §٧ of the directive states the seam in one line and forbids either branch from changing it
// alone:
//
//   reviewAnswer({ text, evidence, domain, mode }) -> { text, annotations, verdict }
//
// WHAT THIS FILE IS. The call site. Branch أ owns the answer and calls this from EXACTLY ONE
// place (lib/free-brain/loop.js, `composeAnswer`), so when branch ب's module lands, the wiring
// is one import inside this file and not a hunt through a three-thousand-line handler for the
// eleven exits that would each have needed it.
//
// WHAT THIS FILE IS NOT. It is not a reviewer. It does not judge, trim, annotate or refuse, and
// it must never grow a rule of its own — the moment it does, there are two output policies and
// the one that ships is whichever file the reader's request happened to touch. That is precisely
// the defect §٧ exists to prevent.
//
// UNTIL BRANCH ب LANDS, THIS RETURNS THE TEXT AS IT CAME. The directive says so in as many words
// («استدعِ عبر واجهةٍ مؤقتة تُرجع النص كما هو»), and the honesty of the arrangement rests on the
// flag in ./flag.js: a passthrough reviewer is only safe because the free path is OFF in
// production. `verdict` says `unreviewed` rather than `ok` so no caller can mistake "nobody
// looked" for "somebody looked and approved" — those are different facts and a checker that
// cannot tell them apart is worse than none.
//
// THE MODULE IS LOADED LAZILY AND ITS ABSENCE IS NORMAL. Branch ب owns the file and it is not in
// this worktree; a static import would make this branch unloadable, which is the one failure a
// seam must never cause.

/** Where branch ب's module is expected. Named once so both branches can point at one string. */
export const REVIEWER_MODULE = '../policy/review-answer.js';

let cached;          // the resolved module, or `null` once we know there isn't one
let attempted = false;

async function loadReviewer() {
  if (attempted) return cached;
  attempted = true;
  try {
    const mod = await import(REVIEWER_MODULE);
    cached = mod && typeof mod.reviewAnswer === 'function' ? mod : null;
    if (!cached) console.warn('[free-brain/review] module present but exports no reviewAnswer');
  } catch {
    // Absent is the expected state on this branch. Not an error, and not logged as one.
    cached = null;
  }
  return cached;
}

/**
 * @param {object} input
 * @param {string} input.text      the drafted reply, exactly as it will be read
 * @param {Array}  input.evidence  the CITED results with their identity (title/url/scholar)
 * @param {'fiqh'|'general'|'mixed'} input.domain
 * @param {string} input.mode      the reader's mode, verbatim from the request
 * @returns {Promise<{text:string, annotations:Array, verdict:string}>}
 */
export async function reviewAnswer(input = {}) {
  const text = String(input.text == null ? '' : input.text);
  const passthrough = { text, annotations: [], verdict: 'unreviewed' };

  const reviewer = await loadReviewer();
  if (!reviewer) return passthrough;

  try {
    const out = await reviewer.reviewAnswer({
      text,
      evidence: Array.isArray(input.evidence) ? input.evidence : [],
      domain: input.domain === 'fiqh' || input.domain === 'general' || input.domain === 'mixed'
        ? input.domain : 'general',
      mode: String(input.mode || ''),
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
      verdict: typeof out.verdict === 'string' && out.verdict ? out.verdict : 'unreviewed',
    };
  } catch (error) {
    // A THROWING REVIEWER IS NOT AN APPROVAL EITHER. The text is returned unchanged and the
    // verdict still says nobody reviewed it, so the caller's telemetry records the truth.
    console.warn('[free-brain/review] reviewer threw:', String(error?.message || error));
    return passthrough;
  }
}
