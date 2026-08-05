// lib/ledger/flag.js
// THE SWITCH. Default OFF, and every way of failing to read it is also OFF.
//
// ── WHY THE SWITCH IS NOT AN ENVIRONMENT VARIABLE ────────────────────────────
// An env var is a DEPLOY, and a deploy is minutes. A kill switch whose response time is a
// build is not a kill switch — it is a plan. The runtime value therefore lives in the Upstash
// instance the app already uses, under its own `lg:` namespace, and is re-read every few
// seconds. An env var still exists (`LEDGER_RAG`) but only as a floor: it can keep the engine
// off, and it can never turn it on by itself.
//
// ── EVERY FAILURE IS "LEGACY" ────────────────────────────────────────────────
// Store unreachable, key absent, value unparseable, value of the wrong type, secret missing,
// caller not authenticated — all of them return the same thing, which is the shipped path.
// There is exactly one arrangement of facts that produces the new engine, and it is spelled
// out in one boolean expression below.
//
// ── WHO IS AN INTERNAL TESTER ────────────────────────────────────────────────
// The existing founder credential, and nothing new. It is an HMAC over a device id keyed by
// FOUNDER_SECRET, verified SERVER-SIDE by lib/daycap.js, and it is already the mechanism this
// app trusts to unlock a paid tier. Reusing it means:
//   * no query-string flag, no URL token, no localStorage boolean — none of which is a
//     credential, all of which a reader can set;
//   * no new secret to distribute, and no weaker second mechanism invented for convenience.
// The token's VALUE is never logged, never cached, never put in a key, and never returned.

import { hasValidFounderToken } from '../daycap.js';
import { isConfigured } from './daily-budget.js';
import * as store from './redis.js';

export const FLAG_KEY = 'ledger_rag_enabled';
export const RUNTIME_KEY = store.key('flag', FLAG_KEY);

// A few seconds. Long enough that a warm instance is not re-reading Redis on every request,
// short enough that flipping the switch takes effect before anybody can ask what went wrong.
export const FLAG_TTL_MS = 5000;

// THE READ IS BOUNDED, AND THE BOUND IS THE POINT. decidePath() runs before the request's
// deadline clock exists, so an Upstash read that hangs is time nobody is counting — the reader
// waits, the 25-second engine budget has not started, and no timeout anywhere covers it. A slow
// store therefore reads as OFF, which is the same answer every other failure gives.
export const FLAG_READ_TIMEOUT_MS = 800;

/** Resolve to `fallback` if `p` has not settled within `ms`. Never rejects. */
function withTimeout(p, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    // unref() where available so a pending timer cannot hold a serverless invocation open.
    if (timer && typeof timer.unref === 'function') timer.unref();
    Promise.resolve(p).then(
      (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(timer); resolve(fallback); } },
    );
  });
}

let cached = { value: false, readAt: 0, source: 'unread' };

export function __resetFlagCacheForTest() { cached = { value: false, readAt: 0, source: 'unread' }; }

// ── PUBLIC GO-LIVE (owner decision, 2026-08-05) ──────────────────────────────
//
// THE DEFAULT IS NOW ON. Until this line the engine was off unless THREE independent things were
// arranged — an env floor, a server-verified internal credential, and a runtime value in a store
// this project cannot write. That was a rollout plan, and the owner has ended the rollout: the
// ledger is the path every reader takes.
//
// WHAT THIS CONSTANT CHANGES: the answer to "nobody said anything". Unset env, no credential, no
// store value now mean PUBLIC instead of OFF.
//
// WHAT IT DELIBERATELY DOES NOT CHANGE — and this is why it is a constant rather than a deletion:
//   * `LEDGER_RAG=off` still closes the floor, instantly, for everybody;
//   * `RFC_V05_MODE=off` still stops it, and `=internal` still narrows it back to testers;
//   * the Upstash kill switch below still stops it in seconds without a build;
//   * the day's search ceiling is still a precondition of the path.
// A go-live that also removed the stop button would not be a go-live, it would be a one-way door.
// Flipping this back to `false` restores the shipped rollout model exactly.
export const PUBLIC_GO_LIVE = true;

/**
 * The env floor.
 *
 * `LEDGER_RAG=off` (or `false`/`0`) keeps the engine off unconditionally — that is unchanged and
 * is the fastest brake there is. What changed is the UNSET case: it used to mean off, and now
 * means whatever PUBLIC_GO_LIVE says. An explicitly written value always beats the default, in
 * both directions, so an operator who has set this env var keeps exactly the behaviour they set.
 */
export function envAllows() {
  const v = String(process.env.LEDGER_RAG ?? '').trim().toLowerCase();
  if (v === '') return PUBLIC_GO_LIVE;
  return v === 'on' || v === 'true' || v === '1';
}

// ── THE THREE MODES ──────────────────────────────────────────────────────────
// MEASURED, NOT ASSUMED: the store credential for this project is write-only — every secret
// reads back empty — so the runtime value this switch was built around cannot be written at all.
// An internal rollout that needs it is therefore not merely unset; it is unreachable. The owner's
// decision is that the ENVIRONMENT carries the authority and the store becomes an optional brake.
//
//   unset     the shipped model, unchanged: credential + store value + ceiling. In production,
//             with no store value writable, this is OFF — which is why it stays the default.
//   off       nobody, unconditionally.
//   internal  a server-verified internal tester only.
//   public    every reader.
//
// AN UNRECOGNISED VALUE IS `off`, NEVER A GUESS. A typo must not be an activation, and `off` is
// the only safe reading of a word nobody defined.
// SINCE THE GO-LIVE, AN UNSET MODE IS `public`. It used to be `unset`, which fell through to the
// credential-plus-store arm below and was therefore OFF in production. The three written values
// mean exactly what they always did, so an operator who has set one is unaffected — and `off` is
// still the reading of a word nobody defined, because a typo must never be an activation.
export function envMode() {
  const raw = String(process.env.RFC_V05_MODE ?? '').trim().toLowerCase();
  if (raw === '') return PUBLIC_GO_LIVE ? 'public' : 'unset';
  if (raw === 'off' || raw === 'internal' || raw === 'public') return raw;
  return 'off';
}

// ── THE BRAKE ────────────────────────────────────────────────────────────────
// The store can still STOP this path even though it can no longer start it, and that asymmetry is
// deliberate: a brake that fails to engage must never be the thing that also grants permission.
//
//   explicitly affirmative  → running
//   explicitly anything else → STOP (a value somebody wrote that is not "on" is an instruction)
//   absent / unreachable / slow → the environment governs, per the owner's decision
//
// So an operator who can reach the store gets an instant kill; an operator who cannot still has
// one, because re-pointing the production alias at the previous deployment takes seconds and no
// build. The env var is the slow path and was never the only one.
export async function killSwitchEngaged(now = Date.now()) {
  const flag = await readRuntimeFlag(now);
  // `origin`, NOT `source`. A cache hit reports source 'cache', which says only that the value was
  // read recently and nothing about whether the store ever answered. Deciding on `source` meant an
  // UNREACHABLE store engaged the brake as soon as its result was cached — the first read said
  // 'unavailable' and ran, every read for the next few seconds said 'cache' and stopped. A brake
  // that grabs on its own after five seconds is worse than no brake, because it looks like one.
  const origin = flag.origin || flag.source;
  if (origin === 'unavailable' || origin === 'timeout' || origin === 'absent') return false;
  return !flag.enabled;
}

/**
 * Read the runtime flag, with a short in-memory TTL.
 *
 * @returns {Promise<{enabled:boolean, source:'cache'|'store'|'unavailable'|'absent'|'malformed'}>}
 */
export async function readRuntimeFlag(now = Date.now()) {
  if (now - cached.readAt < FLAG_TTL_MS && cached.source !== 'unread') {
    // `source` stays 'cache' — callers and gates distinguish a cached read from a fresh one by it.
    // `origin` carries WHY the cached value is what it is, because 'cache' alone cannot tell an
    // explicit stored `off` from a store that was simply unreachable, and the brake below must
    // never treat the second as the first.
    return { enabled: cached.value, source: 'cache', origin: cached.source };
  }
  if (!(await store.available())) {
    cached = { value: false, readAt: now, source: 'unavailable' };
    return { enabled: false, source: 'unavailable', origin: 'unavailable' };
  }
  // A store that is reachable but slow is treated exactly like a store that is not reachable.
  // TIMEOUT is a distinct source code so telemetry can tell "Redis is down" from "Redis is
  // struggling" — both run legacy, and the operator needs to know which.
  const TIMED_OUT = Symbol('flag-read-timeout');
  const raw = await withTimeout(store.get(RUNTIME_KEY), FLAG_READ_TIMEOUT_MS, TIMED_OUT);
  if (raw === TIMED_OUT) {
    cached = { value: false, readAt: now, source: 'timeout' };
    return { enabled: false, source: 'timeout', origin: 'timeout' };
  }
  if (raw === null || raw === undefined) {
    cached = { value: false, readAt: now, source: 'absent' };
    return { enabled: false, source: 'absent', origin: 'absent' };
  }
  // ONLY these exact values mean on. A truthy object, a non-empty string, a 2 — none of them.
  const enabled = raw === true || raw === 1 || raw === 'on' || raw === 'true' || raw === '1';
  const known = enabled || raw === false || raw === 0 || raw === 'off' || raw === 'false' || raw === '0';
  const source = known ? 'store' : 'malformed';
  const value = known ? enabled : false;
  cached = { value, readAt: now, source };
  return { enabled: value, source, origin: source };
}

/** Does this request carry a credential that makes its sender an internal tester? */
export function isInternalTester(req) {
  try { return hasValidFounderToken(req); } catch { return false; }
}

/**
 * THE ONE DECISION.
 *
 * @returns {Promise<{path:'ledger'|'legacy', reason:string}>}
 *
 * `reason` is a code for telemetry. It never reaches a reader, and it never says whether the
 * flag is on — telling an unauthenticated prober which requests WOULD have taken the new path
 * is telling them what to forge.
 */
export async function decidePath(req, now = Date.now()) {
  if (!envAllows()) return { path: 'legacy', reason: 'env_floor_off' };
  const mode = envMode();
  if (mode === 'off') return { path: 'legacy', reason: 'mode_off' };
  if (mode !== 'unset') {
    // THE MODE PATH. The floor above still governs — a mode alone activates nothing — and the
    // day's ceiling is still a precondition, because a path with no spend cap is the one failure
    // that costs money rather than correctness.
    if (mode === 'internal' && !isInternalTester(req)) return { path: 'legacy', reason: 'not_internal' };
    if (!isConfigured()) return { path: 'legacy', reason: 'daily_budget_unconfigured' };
    if (await killSwitchEngaged(now)) return { path: 'legacy', reason: 'kill_switch' };
    return { path: 'ledger', reason: 'mode_' + mode };
  }
  // NO MODE SET: the shipped rollout model, byte-for-byte. Credential, then ceiling, then the
  // store value — and with no store value writable in this project, this arm is OFF in production.
  if (!isInternalTester(req)) return { path: 'legacy', reason: 'not_internal' };
  // ── A FOURTH CONDITION: THE DAY'S CEILING MUST EXIST ──────────────────────
  //
  // RFC v0.5-R2 §9 says that with no production value for the daily search budget the ledger is
  // NOT ACTIVATABLE. That was written down and then not enforced: the engine took the ceiling as
  // an optional argument, so a caller that simply omitted it searched without one. Making it a
  // precondition of the PATH is the only place the promise can actually be kept — after this
  // line, every ledger request has a ceiling by construction.
  //
  // Deliberately read here rather than imported as a constant: the value is environment, and an
  // env read at module load would freeze whatever was set when the instance warmed.
  if (!isConfigured()) return { path: 'legacy', reason: 'daily_budget_unconfigured' };
  const flag = await readRuntimeFlag(now);
  if (!flag.enabled) return { path: 'legacy', reason: 'flag_' + flag.source };
  return { path: 'ledger', reason: 'enabled' };
}

/** The default, stated as a value so a test can assert it rather than infer it. */
export const DEFAULT_ENABLED = PUBLIC_GO_LIVE;
