// lib/free-brain/flag.js — THE SWITCH FOR THE FREE BRAIN (جولة «الاستعادة»، الفرع أ).
//
// WHY A FLAG AT ALL, when everything below it is a repair. Because this one is NOT a repair: it
// moves the constraints from the INPUT to the OUTPUT, and the output checker is branch ب's work,
// which does not exist yet. Until it does, the free path answers with the persona and the sources
// but WITHOUT the truncating cleaner that stands between the model and the reader today. That is a
// deliberate, owner-ordered trade, and it may not be made silently in production while half the
// contract is missing — so production is OFF and preview is ON, and flipping one environment
// variable puts either environment on either path.
//
// THE OLD PATH IS NOT DELETED. Everything api/ask.js did on 40f540e is still there and still
// reachable: this flag chooses between two branches, it does not replace one with the other. That
// is the whole reason the round is safe to ship — a bad answer on the free path is one env write
// away from being the shipped answer again.
//
// READ IT LIKE THE LEDGER'S: an unrecognised value is OFF, never a guess. A typo must not be an
// activation, and OFF is the only safe reading of a word nobody defined.
//
//   FREE_BRAIN_V1=on|true|1     every reader on this deployment
//   FREE_BRAIN_V1=off|false|0   nobody, unconditionally
//   FREE_BRAIN_V1 unset         preview ON, everything else OFF
//
// NOTHING HERE TOUCHES THE STORE. The ledger's switch reads Upstash because it had a rollback arm
// to serve; this one has no brake to fail closed on, so it is a pure function of the environment
// and cannot cost the request a network round-trip or a timeout.

/**
 * @param {object} env  process.env, injectable so a test states the environment instead of
 *                      mutating the real one.
 * @returns {{enabled:boolean, reason:string}}  `reason` is telemetry only and never reaches a reader.
 */
export function freeBrainDecision(env = process.env) {
  const raw = String(env.FREE_BRAIN_V1 ?? '').trim().toLowerCase();
  if (raw === 'on' || raw === 'true' || raw === '1') return { enabled: true, reason: 'env_on' };
  if (raw === 'off' || raw === 'false' || raw === '0') return { enabled: false, reason: 'env_off' };
  if (raw !== '') return { enabled: false, reason: 'env_malformed' };
  // UNSET. Only the platform-provided VERCEL_ENV may open this, and only for preview: a local
  // `vercel dev` reports 'development' and a production deployment reports 'production', and
  // neither of them is the place to test an answer path with no output checker behind it.
  if (String(env.VERCEL_ENV || '') === 'preview') return { enabled: true, reason: 'preview_default' };
  return { enabled: false, reason: 'production_default' };
}

/** The default, stated as a value so a test asserts it rather than infers it. */
export const FREE_BRAIN_DEFAULT_IN_PRODUCTION = false;
