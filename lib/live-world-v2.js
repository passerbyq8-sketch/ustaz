// lib/live-world-v2.js
// THE ONE SWITCH FOR THE 2026-09-19 LIVE-WORLD ROUND, AND THERE IS NO SECOND ONE.
//
// ── WHY A MODULE FOR ONE `process.env` READ ─────────────────────────────────
// Because a flag read in two places is two flags. The moment a second reader of this variable
// appears anywhere in the tree, the two readings can disagree about what "off" means — one
// accepting '0' as on, one not; one reading at import time, one per call — and a kill switch that
// can half-fire is worse than none, because the person pulling it believes the round is off.
// guards/live-world-v2-killswitch-guard.cjs asserts that this file is the ONLY place the name
// appears outside a guard, so a second reader is a failing gate rather than a discovery.
//
// ── WHAT IT GOVERNS ─────────────────────────────────────────────────────────
// Everything the round shipped, without exception:
//   * the two new classifier reasons, FX_RATE and CLOCK_DATE   (lib/world-intent.js)
//   * the fifth world source, the Central Bank of Kuwait        (lib/source-registry.js)
//   * the refusal to take a LIVE NUMBER from an encyclopedia    (lib/retrieve.js, api/ask.js)
//   * the date block on the system prompt                        (api/ask.js, lib/today-line.js)
//   * the print contract on live numbers                         (lib/live-number-source.js)
//
// ── THE DEFAULT IS OFF, AND "OFF" MEANS BYTE-IDENTICAL ──────────────────────
// An ABSENT variable is off. A misspelt value is off. An empty string is off. The only way to
// turn the round on is to say so, and that asymmetry is deliberate: a deployment that loses its
// environment must fall back to the behaviour that was measured working, never to the new one.
//
// ── READ PER CALL, NOT AT IMPORT ────────────────────────────────────────────
// Two reasons, both practical. A guard has to be able to drive BOTH states inside one process
// without re-importing the module graph; and a serverless container that is warm across a
// configuration change must not keep serving the old answer because it cached the flag at boot.

/** The accepted spellings of "on". Everything else, including absence, is off. */
const ON = new Set(['1', 'on', 'true', 'yes', 'enabled']);

/**
 * Is the 2026-09-19 live-world round enabled?
 * @returns {boolean} false unless LIVE_WORLD_V2 explicitly says otherwise.
 */
export function liveWorldV2Enabled() {
  return ON.has(String(process.env.LIVE_WORLD_V2 ?? '').trim().toLowerCase());
}

/** The env var's name, exported so a guard or a log line never spells it a second time. */
export const LIVE_WORLD_V2_FLAG = 'LIVE_WORLD_V2';
