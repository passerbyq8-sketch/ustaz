// lib/policy/live-search-disclosure.js
// WHEN THE READER ASKED ABOUT THE LIVE WORLD AND WE COULD NOT LOOK, WE SAY SO BEFORE ANSWERING.
//
// ── THE MEASURED FAILURE ─────────────────────────────────────────────────────
// The live-world path is a FALL-THROUGH by design: no key, no results, a blocked host, a page
// with no encodable card, an empty draft, a throw — every one of them leaves `worldPass` null and
// the request continues into the ordinary GEN route. That design is right, and api/ask.js records
// why: gating on the INTENT instead of the MATERIAL would have cost a child their age floor
// whenever a search failed.
//
// What was missing is what the READER was told. «كم سعر صرف الدولار مقابل الدينار؟» with a failed
// search produced a fluent, confident answer out of the model's memory — with no indication that
// nothing had been looked up, and no indication that the number might be a year stale. The reader
// asked for today and was given whatever the weights remember, in a voice indistinguishable from
// a live quote. Measured live by the owner.
//
// ── WHAT THIS SAYS, AND WHAT IT REFUSES TO DO ────────────────────────────────
// ONE fixed sentence, server-owned, written before the model's first byte. It is the same shape
// as lib/policy/takhrij-disclosure.js and follows the rule stated there: it does NOT hedge the
// answer, apologise for it, or withdraw it — a tail that undermines what it introduces is worse
// than none, because the reader then trusts neither. It states two facts and stops: no live
// results were obtained, and what follows is general knowledge that may be out of date.
//
// IT IS NOT WRITTEN BY THE MODEL, and that is the point of putting it here. A line the model is
// asked to produce is a line the model can decline to produce, soften, or contradict two sentences
// later. This one is a server write on a path the model has no say in.
//
// NO I/O, NO MODEL CALL, NO STATE.

// ── THE SENTENCE ─────────────────────────────────────────────────────────────
// «حيّة» rather than «مباشرة» to match the vocabulary the rest of this path already uses for the
// live world. It names no cause — a missing key and a blocked host are the same fact to a reader —
// and it does not promise a retry.
export const NO_LIVE_RESULTS_DISCLOSURE =
  'لم أعثرْ على نتائجِ بحثٍ حيّةٍ لهذا السؤال، وما يلي معلوماتٌ عامّةٌ قد لا تكونُ محدَّثة.';

/**
 * THE ONE DECISION, kept as a function rather than an inline `&&` so both directions can be
 * tested without driving a handler, a socket and a model stub to find out.
 *
 * @param {object} o
 *   worldWanted       true when classifyWorldIntent() said this question is about the live world.
 *                     A question that never wanted live facts must never get this line — it would
 *                     be an apology for not doing something nobody asked for, and it would attach
 *                     itself to every ordinary general answer in the app.
 *   answeredFromLive  true when live material actually reached the reader. Fail-closed is WRONG
 *                     here and deliberately so: the caller reaches this only on the fall-through,
 *                     so the honest default is that we did not answer from live results.
 * @returns {string} the sentence, or '' — never null, so a caller can concatenate it blind.
 */
export function liveSearchNotice({ worldWanted, answeredFromLive } = {}) {
  if (!worldWanted) return '';
  if (answeredFromLive) return '';
  return NO_LIVE_RESULTS_DISCLOSURE;
}
