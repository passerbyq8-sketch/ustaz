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
  // UNSET. Preview opens, everything else does not: a local `vercel dev` reports 'development'
  // and a production deployment reports 'production', and neither is the place to run an answer
  // path whose output checker is still a passthrough.
  //
  // ── AND `VERCEL_ENV` ALONE IS NOT A DEPLOYMENT, IT IS A STRING ────────────
  // MEASURED, and it cost nine gates on the first run of this branch. Eight guards
  // (guards/identity-guard.cjs, guards/name-presence-guard.cjs and six others) set
  // `process.env.VERCEL_ENV = 'preview'` in-process as a fixture for something else entirely —
  // lib/ledger/daily-budget.js picks the paid-search counter off that variable, and a test that
  // wants the preview counter has to say so. Reading it as "this is a preview deployment" handed
  // those guards the free answer path in the middle of asserting the shipped one, and the failures
  // read as though the new path had broken them.
  //
  // A REAL DEPLOYMENT ALSO CARRIES `VERCEL_URL`, which the platform sets per deployment and no
  // fixture in this repository sets at all. Requiring both makes the default mean what it was
  // ordered to mean — ON in preview, OFF in production — while a unit test that names a budget
  // environment can no longer change which brain answers a reader.
  const isPreview = String(env.VERCEL_ENV || '') === 'preview';
  const onPlatform = String(env.VERCEL_URL || '').trim() !== '';
  if (isPreview && onPlatform) return { enabled: true, reason: 'preview_default' };
  if (isPreview) return { enabled: false, reason: 'preview_env_without_deployment' };
  return { enabled: false, reason: 'production_default' };
}

/** The default, stated as a value so a test asserts it rather than infers it. */
export const FREE_BRAIN_DEFAULT_IN_PRODUCTION = false;

// ── STREAM_V1 — THE SWITCH FOR SENTENCE-LEVEL DELIVERY ───────────────────────
//
// READ IT LIKE THE ONE ABOVE: an unrecognised value is OFF, never a guess.
//
// AND UNLIKE THE ONE ABOVE, THERE IS NO ENVIRONMENT THAT OPENS IT BY DEFAULT.
// `FREE_BRAIN_V1` opens itself on preview because the path it guards was ordered
// shipped there. This one guards a path whose last stage is not built: the writer
// still holds every frame until end-of-stream, so nothing a reader can see changes
// yet. A default that opened it anywhere would be claiming a delivery that does not
// happen. It is opened by hand, locally, and nowhere else.
//
//   STREAM_V1=on|true|1     this deployment streams the writing call
//   STREAM_V1 anything else OFF, including unset
//
/**
 * @param {object} env  process.env, injectable so a test states the environment.
 * @returns {{enabled:boolean, reason:string}}  `reason` is telemetry only.
 */
export function streamDecision(env = process.env) {
  const raw = String(env.STREAM_V1 ?? '').trim().toLowerCase();
  if (raw === 'on' || raw === 'true' || raw === '1') return { enabled: true, reason: 'env_on' };
  if (raw === '') return { enabled: false, reason: 'unset_default_off' };
  if (raw === 'off' || raw === 'false' || raw === '0') return { enabled: false, reason: 'env_off' };
  return { enabled: false, reason: 'env_malformed' };
}

/** The default, stated as a value so a test asserts it rather than infers it. */
export const STREAM_V1_DEFAULT = false;

// ── PROPHET_ASCRIPTION_BLOCK — البند ٣٦ · الباب (ب) ──────────────────────────
//
// THE DOOR IT OPENS. A description of someone else must not reach the reader as
// news about the Prophet ﷺ. lib/free-brain/loop.js runs the rule in
// lib/prophet-ascription.js over the answer before it is delivered, asks for one
// rewrite when it catches, and drops the one sentence when the rewrite catches too.
//
// ── AND THIS ONE READS INVERTED, WHICH IS NOT AN OVERSIGHT ─────────────────
//
// THE TWO SWITCHES ABOVE FAIL OFF because each guards a PATH — a different brain,
// a different delivery — and a typo must not activate a path nobody chose. This
// one guards a REFUSAL. Its failure mode is the exact opposite: an unrecognised
// value that read as OFF would silently retire a protection, and the thing it
// protects against is an answer the reader has no way to check. So a value nobody
// defined leaves the door STANDING, under its own name in the log, and only the
// words that plainly mean «off» take it down.
//
//   PROPHET_ASCRIPTION_BLOCK=off|false|0   the door is down, answers pass unread
//   PROPHET_ASCRIPTION_BLOCK anything else the door stands, including unset
//
// ── THE VALUE ON THIS BRANCH IS OPEN, AND THE VALUE AT MERGE IS NOT MINE ───
//
// The order of ١٥ سبتمبر says so in as many words: «وقيمتُه في هذا الفرع: مفتوحٌ
// افتراضيًّا لتُجرَّبَ البطّاريّةُ عليه. وقرارُ قيمتِه عندَ الدمجِ للمالكِ وحدَه».
// Nothing in this tree sets the variable, so every gate in the battery exercises
// the door rather than the bypass — which is the only way a battery can report on
// a door at all. Turning it off in production is one environment write and needs
// no deploy, and that is the whole of «يُطفَأُ بلحظة».
//
// AND THE FLAG IS NOT THE ONLY WAY OUT. A detector that THROWS also passes the
// answer through untouched — «وإن تعطَّلَ الكشفُ نفسُه يمرُّ الجوابُ كما هو» — and
// that arm lives at the call site in loop.js, because this function is pure and
// cannot know whether the rule ran. The two are different failures and are
// recorded under different names.
/**
 * @param {object} env  process.env, injectable so a test states the environment.
 * @returns {{enabled:boolean, reason:string}}  `reason` is telemetry only.
 */
export function prophetAscriptionDecision(env = process.env) {
  const raw = String(env.PROPHET_ASCRIPTION_BLOCK ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0') return { enabled: false, reason: 'env_off' };
  if (raw === '') return { enabled: true, reason: 'unset_default_on' };
  if (raw === 'on' || raw === 'true' || raw === '1') return { enabled: true, reason: 'env_on' };
  return { enabled: true, reason: 'env_malformed_kept_on' };
}

/** The default, stated as a value so a test asserts it rather than infers it. */
export const PROPHET_ASCRIPTION_BLOCK_DEFAULT = true;

// -- BEFORE_WRITING_V2 -- SPEED ITEM 17: RETRIEVE, JUDGE, THEN ONE WRITER ROUND --------------------
//
// The approved before-writing path (lib/before-writing-v2.js). It reads like the refusal above and
// not like the two paths at the top of this file, BY ORDER: the owner approved the design on
// 2026-09-27 and ordered it ON in code, so only the words that plainly mean off take it down, and a
// value nobody defined leaves it standing under its own name in the log.
//
//   BEFORE_WRITING_V2=off|false|0   today's free-brain path, unchanged
//   BEFORE_WRITING_V2 anything else the before-writing path, including unset
//
// IT CHOOSES ONLY INSIDE THE FREE-BRAIN SEAT. api/ask.js asks it after the frozen dispatcher and
// after the reserved child path, where FREE_BRAIN_V1 already decided the free brain answers; with
// FREE_BRAIN_V1 off this switch is never read and the pre-free-brain path runs as it did.
/**
 * @param {object} env  process.env, injectable so a test states the environment.
 * @returns {{enabled:boolean, reason:string}}  `reason` is telemetry only.
 */
export function beforeWritingV2Decision(env = process.env) {
  const raw = String(env.BEFORE_WRITING_V2 ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0') return { enabled: false, reason: 'env_off' };
  if (raw === '') return { enabled: true, reason: 'unset_default_on' };
  if (raw === 'on' || raw === 'true' || raw === '1') return { enabled: true, reason: 'env_on' };
  return { enabled: true, reason: 'env_malformed_kept_on' };
}

/** The default, stated as a value so a test asserts it rather than infers it. */
export const BEFORE_WRITING_V2_DEFAULT = true;
/**
 * The religious runtimes the before-writing path takes (classifyReligiousRuntime,
 * lib/stored-deen.js:361-394).
 *   STORED_FIQH  a ruling question -- the path exists for it.
 *   HADITH       a hadith question -- the library and the takhrij runner are its sources.
 * Left out, with the reason:
 *   LOCAL_QURAN, LOCAL_ADHKAR, LOCAL_WORSHIP  requests for frozen text (an ayah, a dhikr, a worship
 *     procedure). The frozen dispatcher owns them; when it has no exact match the free-brain path
 *     answers with the verse/dhikr/worship cards drawn from the bundled canonical stores, which no
 *     before-writing source carries -- the path would end most of them in the not-covered sentence.
 *   GENERAL  stays out by order (a lexically mixed turn is reported by the runtime as GENERAL or
 *     STORED_FIQH, and is taken only in the second case).
 */
export const BEFORE_WRITING_V2_RUNTIMES = Object.freeze(['STORED_FIQH', 'HADITH']);

/** liveSearch is a boolean true or nothing (order 3.7): any other value is ignored. */
export function readLiveSearch(body) {
  return !!body && typeof body === 'object' && body.liveSearch === true;
}

/**
 * Does the before-writing path take this request? api/ask.js asks only inside the free-brain seat:
 * after the frozen dispatcher returned nothing and outside the reserved child path.
 *
 * `excluded` (speed fix 1, R1/R2) is lib/bw2-scope.js bw2ScopeExclusion(question): 'canonical_store'
 * (adhkar, Quran text, the manner of an act of worship -- today's path answers from the bundled
 * canonical stores) or 'estate_division' (computation over fixed shares). Either one leaves the
 * question on today's free-brain path, whatever its runtime. It is computed by the caller so this
 * file keeps importing nothing.
 * @returns {{takes:boolean, reason:string}}  `reason` is a closed enum, telemetry only.
 */
export function beforeWritingV2Takes({ enabled, band, runtime, liveSearch, excluded = '' } = {}) {
  if (!enabled) return { takes: false, reason: 'flag_off' };
  if (liveSearch === true) return { takes: false, reason: 'live_search' };
  if (band !== 'adult') return { takes: false, reason: 'not_adult' };
  if (!BEFORE_WRITING_V2_RUNTIMES.includes(runtime)) return { takes: false, reason: 'runtime' };
  if (excluded === 'canonical_store' || excluded === 'estate_division') return { takes: false, reason: excluded };
  return { takes: true, reason: 'taken' };
}

// -- BW2_HOLD_UNCITED_RULINGS -- SPEED FIX 1, R4(b) ----------------------------------------------
//
// In a STORED_FIQH answer, hold a unit that states a ruling without a valid [[n]]. The order made it
// conditional on an offline measurement (<= 10% of the ruling units of the preview's answers held);
// that measurement could not show it (the delivered text carries no [[n]] markers -- they are stripped
// before release), so it ships OFF and turns on only by name:
//
//   BW2_HOLD_UNCITED_RULINGS=on|true|1   hold uncited ruling units
//   anything else, including unset       off
export function bw2HoldUncitedRulingsDecision(env = process.env) {
  const raw = String(env.BW2_HOLD_UNCITED_RULINGS ?? '').trim().toLowerCase();
  return { enabled: raw === 'on' || raw === 'true' || raw === '1' };
}
export const BW2_HOLD_UNCITED_RULINGS_DEFAULT = false;
