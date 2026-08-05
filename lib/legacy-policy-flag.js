// lib/legacy-policy-flag.js
// THE SWITCH FOR THE LEGACY POLICY REPAIRS. Default OFF, and every way of failing to read it is
// also OFF.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// The ledger has always been behind lib/ledger/flag.js, so nothing it does can reach a reader
// until three independent facts are all true. The RFC v0.5-R2 repairs to the LEGACY path had no
// such guard: the safety triage, the child-benign branch, the health referral and the buffered
// ABOUT_ENTITY branch would have gone live for every reader the moment the branch was pushed.
// That skips the whole rollout the owner requires — preview, internal shadow, internal canary,
// approval, public — for changes that alter what a child is told.
//
// ── IT IS THE SAME SHAPE AS THE LEDGER SWITCH, ON PURPOSE ────────────────────
// Same env floor, same server-verified founder credential, same Upstash abstraction, same short
// in-memory TTL, same bounded read, same "every failure is OFF". A second mechanism invented for
// convenience is a second mechanism to get wrong, and the properties that matter here are exactly
// the ones lib/ledger/flag.js already reasons through.
//
// ── WHAT IS NOT A CREDENTIAL ─────────────────────────────────────────────────
// A query-string parameter, a URL path, a localStorage boolean, a plain header a reader can type.
// None of them is checked here and none of them can turn anything on. The only thing that
// identifies an internal tester is the HMAC over a device id keyed by FOUNDER_SECRET, verified
// server-side by lib/daycap.js.
//
// THIS MODULE CHANGES NO VALUE. It reads. Turning the flag on is a deliberate, separate act.

import { hasValidFounderToken } from './daycap.js';
import * as store from './ledger/redis.js';
import { envMode, killSwitchEngaged } from './ledger/flag.js';

export const FLAG_KEY = 'rfc_v05_legacy_policy';
export const RUNTIME_KEY = store.key('flag', FLAG_KEY);

/** The default, stated as a value so a test asserts it rather than infers it. */
export const DEFAULT_ENABLED = false;

// Same reasoning as the ledger switch: long enough that a warm instance is not re-reading the
// store every request, short enough that flipping it takes effect before anybody asks why not.
export const FLAG_TTL_MS = 5000;

// A bounded read. This runs before the request has any deadline of its own, so a store that hangs
// is time nobody is counting. A slow store reads as OFF, like every other failure.
export const FLAG_READ_TIMEOUT_MS = 800;

function withTimeout(p, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    if (timer && typeof timer.unref === 'function') timer.unref();
    Promise.resolve(p).then(
      (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(timer); resolve(fallback); } },
    );
  });
}

let cached = { value: false, readAt: 0, source: 'unread' };

export function __resetLegacyFlagCacheForTest() { cached = { value: false, readAt: 0, source: 'unread' }; }

/** The env floor. Anything but an explicit on keeps the repairs off unconditionally. */
export function envAllows() {
  const v = String(process.env.RFC_V05_LEGACY_POLICY ?? '').trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

// ── THE THREE MODES ──────────────────────────────────────────────────────────
// The SAME variable the ledger switch reads, and deliberately not a second one: these two paths
// are rolled out by ONE decision, and two independent mode variables would make it possible to
// activate half of it — the child policy on with the ledger off, or the reverse — which is a state
// nobody asked for and nobody would be watching.
//
// Imported from lib/ledger/flag.js rather than re-implemented, so "what does `public` mean"
// cannot drift into two answers. Same values, same unset-is-the-shipped-model, same
// unrecognised-is-off. Re-exported so a test can reach it through either switch.
export { envMode, killSwitchEngaged };

/** Does this request carry a server-verified internal credential? */
export function isInternalTester(req) {
  try { return hasValidFounderToken(req); } catch { return false; }
}

/**
 * Read the runtime flag, with a short in-memory TTL.
 *
 * @returns {Promise<{enabled:boolean, source:'cache'|'store'|'unavailable'|'absent'|'malformed'|'timeout'}>}
 */
export async function readRuntimeFlag(now = Date.now()) {
  if (now - cached.readAt < FLAG_TTL_MS && cached.source !== 'unread') {
    return { enabled: cached.value, source: 'cache' };
  }
  if (!(await store.available())) {
    cached = { value: false, readAt: now, source: 'unavailable' };
    return { enabled: false, source: 'unavailable' };
  }
  const TIMED_OUT = Symbol('legacy-flag-read-timeout');
  const raw = await withTimeout(store.get(RUNTIME_KEY), FLAG_READ_TIMEOUT_MS, TIMED_OUT);
  if (raw === TIMED_OUT) {
    cached = { value: false, readAt: now, source: 'timeout' };
    return { enabled: false, source: 'timeout' };
  }
  if (raw === null || raw === undefined) {
    cached = { value: false, readAt: now, source: 'absent' };
    return { enabled: false, source: 'absent' };
  }
  // ONLY these exact values mean on. A truthy object, a stray string, a 2 — none of them.
  const enabled = raw === true || raw === 1 || raw === 'on' || raw === 'true' || raw === '1';
  const known = enabled || raw === false || raw === 0 || raw === 'off' || raw === 'false' || raw === '0';
  const source = known ? 'store' : 'malformed';
  const value = known ? enabled : false;
  cached = { value, readAt: now, source };
  return { enabled: value, source };
}

/**
 * THE ONE DECISION.
 *
 * @returns {Promise<{enabled:boolean, reason:string}>}
 *
 * `reason` is a telemetry code. It never reaches a reader, and it never reveals whether the flag
 * is on — telling an unauthenticated prober which requests WOULD have behaved differently is
 * telling them what to forge.
 *
 * THE READ IS SKIPPED FOR ANYONE UNQUALIFIED. The env floor and the credential are both checked
 * before the store is touched, so an ordinary reader's request costs no Upstash round trip and
 * leaves no trace of having been evaluated.
 */
export async function decideLegacyPolicy(req, now = Date.now()) {
  if (!envAllows()) return { enabled: false, reason: 'env_floor_off' };
  const mode = envMode();
  if (mode === 'off') return { enabled: false, reason: 'mode_off' };
  if (mode !== 'unset') {
    // THE MODE PATH. `public` is the point of the whole repair: the cold refusal a seven-year-old
    // got, and the «which shaykh do you mean» template for a question about a historical scholar,
    // are both in the SHIPPED path and go on being served until this is set.
    if (mode === 'internal' && !isInternalTester(req)) return { enabled: false, reason: 'not_internal' };
    if (await killSwitchEngaged(now)) return { enabled: false, reason: 'kill_switch' };
    return { enabled: true, reason: 'mode_' + mode };
  }
  // NO MODE SET: the shipped rollout model, byte-for-byte.
  if (!isInternalTester(req)) return { enabled: false, reason: 'not_internal' };
  const flag = await readRuntimeFlag(now);
  if (!flag.enabled) return { enabled: false, reason: 'flag_' + flag.source };
  return { enabled: true, reason: 'enabled' };
}
