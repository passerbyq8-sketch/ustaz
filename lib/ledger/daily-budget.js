// lib/ledger/daily-budget.js
// THE DAILY SEARCH CEILING. A spend cap, not a rate limit, and the difference decides everything
// about how it fails.
//
// ── WHAT IT COUNTS ───────────────────────────────────────────────────────────
// ONE SEARCH UNIT = one outbound provider request. A cache hit is not a unit, because no request
// left the building. A query that returns nothing IS a unit, because it cost exactly as much as
// one that returned ten results. Pages fetched are not units — they are bounded separately by
// MAX_PAGES_FETCHED, per request, and mixing the two would let a long request quietly consume a
// day's allowance.
//
// ── WHY THE RESERVATION HAPPENS BEFORE THE I/O ───────────────────────────────
// A counter incremented AFTER a call has already authorised the call it was supposed to gate. So
// reserve() runs first and the request proceeds only if its reservation succeeded. The cost of
// that ordering is that an abandoned request may have reserved a unit it never spent; the cost of
// the other ordering is unbounded overspend, and only one of those is a bill.
//
// ── ATOMIC, BECAUSE TWO REQUESTS ARRIVE AT ONCE ──────────────────────────────
// Read-then-write is a race: two requests reading 99 against a ceiling of 100 both see room. INCR
// returns the caller's own position in the sequence in a single round trip, so each request knows
// whether IT was the one that crossed the line.
//
// ── THE DEFAULT IS A FINITE CAP ──────────────────────────────────────────────
// With DAILY_SEARCH_BUDGET absent or malformed, configuredLimit() returns the shipped finite
// default of 5000. A valid environment value overrides it, including an explicit zero hard stop.
// The runtime flag does not branch on budget configuration; the constructed budget enforces the
// resulting ceiling before any provider request.
//
// ── THE KEY CARRIES NO READER ────────────────────────────────────────────────
// `lg:dsb:YYYY-MM-DD`. No device id, no IP, no cookie, no header, no question. This is a global
// counter for the whole service; it is not, and must never become, a per-reader quota, because a
// per-reader quota is a per-reader identifier that has to be retained.

import * as store from './redis.js';

/** The reader-facing outcome when the day's allowance is gone. NEVER `NOT_FOUND`. */
export const SERVICE_LIMITED = 'SERVICE_LIMITED';

/** Part of the question was answered before the ceiling was reached. */
export const PARTIAL_SERVICE_LIMITED = 'PARTIAL_SERVICE_LIMITED';

export const SERVICE_LIMITED_TEXT =
  'تعذر تنفيذ البحث الآن ضمن الحدود التشغيلية لخدمة عزك، فلم أبحث في المصادر لهذا السؤال. '
  + 'جرّب مرّةً أخرى لاحقًا؛ وما هو محفوظٌ عندنا من القرآن والأذكار والصفات الثابتة يعمل كما هو.';

/** Appended AFTER the part that was answered. It states the reason, never an absence of evidence. */
export const PARTIAL_SERVICE_LIMITED_TEXT =
  'وبقيّة سؤالك لم أبحث فيها بعدُ — لا لأنّي لم أجد، بل لأنّ البحث بلغ الحدود التشغيلية لخدمة عزك الآن. '
  + 'أعِدْ سؤالي عنها لاحقًا.';

/**
 * THE RESERVATION, AS ONE ATOMIC SERVER-SIDE STEP.
 *
 * Increment, set the expiry on the FIRST increment only, compare against the ceiling, and return
 * both the position and the decision. Doing this as INCR + EXPIRE + compare from the client
 * leaves two windows: a crash between INCR and EXPIRE leaves a counter with no TTL that never
 * resets and caps the service permanently, and two requests can interleave between the increment
 * and the comparison. There is no window inside a script.
 *
 * Exported so the gate can assert it is one operation rather than trusting a comment.
 */
export const RESERVE_SCRIPT = [
  "local used = redis.call('INCR', KEYS[1])",
  "if used == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) end",
  'if used > tonumber(ARGV[1]) then return {used, 0} end',
  'return {used, 1}',
].join('\n');

/** Seconds until the next UTC midnight, plus a small margin so the key never outlives its day. */
export function secondsUntilUtcMidnight(nowMs) {
  const d = new Date(nowMs);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(60, Math.ceil((next - nowMs) / 1000) + 60);
}

/** `lg:dsb:2026-08-04`. Derived from the clock only — nothing about the reader enters it. */
export function dayKey(nowMs) {
  const d = new Date(nowMs);
  const iso = d.getUTCFullYear()
    + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
    + '-' + String(d.getUTCDate()).padStart(2, '0');
  return store.key('dsb', iso);
}

// ── THE CEILING THE PUBLIC GO-LIVE NEEDED (owner decision, 2026-08-05) ───────
//
// A MISSING VALUE USED TO BE A REFUSAL TO RUN, and that was right while the ledger was an
// internal rollout: `configured` false made decidePath() return `legacy`, so a feature whose cost
// ceiling nobody had decided simply did not run.
//
// It is the wrong behaviour for a public go-live, and quietly so — that is why it is changed here
// rather than left. With the flag flipped and this still null, decidePath() would have returned
// `legacy` for every reader with the reason `daily_budget_unconfigured`, and the go-live would
// have been a deploy that changed nothing while reporting success.
//
// SO THERE IS A DEFAULT NOW, AND IT IS STILL A REAL CAP. RFC v0.5-R2 §9's actual requirement is
// that the path never runs WITHOUT a ceiling — not that the ceiling must arrive by env var. This
// number is a runaway backstop, not a quota: at the engine's measured worst case of a handful of
// provider searches per question it is far above ordinary daily traffic for this app, and far
// below anything that could empty an account overnight. `DAILY_SEARCH_BUDGET` still overrides it
// in either direction, so an owner who wants 500 or 50,000 sets one env var and this is ignored.
export const DEFAULT_DAILY_SEARCH_BUDGET = 5000;

/**
 * The configured ceiling. Never null any more: an unset env var yields the default above, so the
 * public path always has a ceiling by construction. A MALFORMED value still yields the default
 * rather than being read as a number — a typo must not raise or remove a spend cap.
 */
export function configuredLimit(env = process.env) {
  const raw = env.DAILY_SEARCH_BUDGET;
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_DAILY_SEARCH_BUDGET;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) return DEFAULT_DAILY_SEARCH_BUDGET;
  return n;
}

export function isConfigured(env = process.env) {
  return configuredLimit(env) !== null;
}

/**
 * A DAILY BUDGET, WITH ITS STORE INJECTED.
 *
 * The fake store used by the gates is a plain object with the same three methods, so every test
 * in this area runs against real logic and a real race-free code path while touching no network
 * and creating no key in anybody's Upstash.
 */
export class DailySearchBudget {
  /**
   * @param {object} opts
   *   limit    number|null  — null means "not configured", and every reservation is refused
   *   store    {incr, expire}  — defaults to the shared Upstash client
   *   now      () => ms
   *   failOpen boolean — what an UNREACHABLE store means. Defaults to false: a spend cap that
   *            fails open costs real money, exactly the reasoning lib/daycap.js records for the
   *            per-reader question cap. A cache may fail open; a cap may not.
   */
  constructor(opts = {}) {
    this.limit = opts.limit === undefined ? configuredLimit() : opts.limit;
    this.store = opts.store || store;
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    this.failOpen = !!opts.failOpen;
    this.reserved = 0;
    this.lastReason = '';
  }

  get configured() { return this.limit !== null && this.limit !== undefined; }

  /**
   * RESERVE ONE SEARCH UNIT. Call this BEFORE the provider request, never after.
   *
   * @returns {Promise<{ok:boolean, reason:string, used:number|null, limit:number|null}>}
   *   ok:false with reason 'not_configured'  — no ceiling was ever set; the path must not run
   *   ok:false with reason 'day_cap_reached' — the allowance is gone; outcome is SERVICE_LIMITED
   *   ok:false with reason 'store_unavailable' — fail-closed unless failOpen was asked for
   */
  async reserve() {
    if (!this.configured) {
      this.lastReason = 'not_configured';
      return { ok: false, reason: 'not_configured', used: null, limit: null };
    }
    const key = dayKey(this.now());
    const ttl = secondsUntilUtcMidnight(this.now());
    // ONE OPERATION. The previous version issued INCR and then EXPIRE and then compared here,
    // which left a counter with no TTL if anything interrupted between the two calls — a key that
    // never resets caps the service at its ceiling permanently — and left a window in which two
    // requests could both pass the comparison.
    const res = await this.store.evalScript(RESERVE_SCRIPT, [key], [String(this.limit), String(ttl)]);
    if (!Array.isArray(res) || res.length < 2) {
      this.lastReason = 'store_unavailable';
      return { ok: !!this.failOpen, reason: 'store_unavailable', used: null, limit: this.limit };
    }
    const used = Number(res[0]);
    const allowed = Number(res[1]) === 1;
    if (!allowed) {
      this.lastReason = 'day_cap_reached';
      return { ok: false, reason: 'day_cap_reached', used, limit: this.limit };
    }
    this.reserved += 1;
    this.lastReason = '';
    return { ok: true, reason: '', used, limit: this.limit };
  }

  snapshot() {
    return { configured: this.configured, limit: this.limit, reservedThisRequest: this.reserved, lastReason: this.lastReason };
  }
}

/**
 * AN IN-MEMORY STORE WITH THE SAME CONTRACT, for gates and fixtures.
 *
 * Exported from the module it doubles rather than redefined in each guard, so a change to the
 * contract cannot leave a test asserting against a shape the real store no longer has.
 */
export function fakeStore(initial = 0) {
  const map = new Map();
  return {
    map,
    unavailable: false,
    // The SAME semantics the Lua has, so a test that passes here is testing the real contract.
    // Deliberately synchronous inside: the atomicity being modelled is the server's, and a fake
    // that yielded mid-script would be modelling a race the real one cannot have.
    async evalScript(script, keys, args) {
      if (this.unavailable) return null;
      const k = keys[0];
      const limit = Number(args[0]);
      const ttl = Number(args[1]);
      const used = (map.get(k) === undefined ? initial : map.get(k)) + 1;
      map.set(k, used);
      if (used === 1) map.set(k + ':ex', ttl);
      return [used, used <= limit ? 1 : 0];
    },
  };
}
