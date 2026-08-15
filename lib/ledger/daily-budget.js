// lib/ledger/daily-budget.js
//
// One paid-search unit is one Brave transport attempt. Callers reserve immediately before
// that transport; cache hits, rejected queries, fatwa-service requests and page fetches do not
// spend this budget.
//
// The v2 namespace deliberately does not read, reset or delete the former lg:dsb:* keys. Vercel's
// trusted VERCEL_ENV selects a distinct global counter, and the same atomic script also enforces
// every safe caller digest attached to the request. No raw account, device, cookie or IP value is
// accepted by this module or written to Redis.

import * as store from './redis.js';

export const SERVICE_LIMITED = 'SERVICE_LIMITED';
export const PARTIAL_SERVICE_LIMITED = 'PARTIAL_SERVICE_LIMITED';

export const SERVICE_LIMITED_TEXT =
  'تعذر تنفيذ البحث الآن ضمن الحدود التشغيلية لخدمة عزك، فلم أبحث في المصادر لهذا السؤال. '
  + 'جرّب مرّةً أخرى لاحقًا؛ وما هو محفوظٌ عندنا من القرآن والأذكار والصفات الثابتة يعمل كما هو.';

export const PARTIAL_SERVICE_LIMITED_TEXT =
  'وبقيّة سؤالك لم أبحث فيها بعدُ — لا لأنّي لم أجد، بل لأنّ البحث بلغ الحدود التشغيلية لخدمة عزك الآن. '
  + 'أعِدْ سؤالي عنها لاحقًا.';

export const BUDGET_NAMESPACE = 'ezik:search-budget:v2';
export const GLOBAL_PRODUCTION_ENV = 'SEARCH_BUDGET_GLOBAL_PRODUCTION';
export const GLOBAL_PREVIEW_ENV = 'SEARCH_BUDGET_GLOBAL_PREVIEW';
export const GLOBAL_DEVELOPMENT_ENV = 'SEARCH_BUDGET_GLOBAL_DEVELOPMENT';
export const PER_CALLER_ENV = 'SEARCH_BUDGET_PER_CALLER';

export const BUDGET_REASON = Object.freeze({
  DAY: 'day_cap_reached',
  CALLER: 'caller_cap_reached',
  STORE: 'budget_store_unavailable',
});

function finiteCap(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && Math.floor(parsed) === parsed ? parsed : null;
}

/** Only the server-provided VERCEL_ENV selects a paid-search environment. */
export function budgetEnvironment(env = process.env) {
  if (env && env.VERCEL_ENV === 'production') return 'production';
  if (env && env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

export function globalLimitEnvName(env = process.env) {
  const scope = budgetEnvironment(env);
  if (scope === 'production') return GLOBAL_PRODUCTION_ENV;
  if (scope === 'preview') return GLOBAL_PREVIEW_ENV;
  return GLOBAL_DEVELOPMENT_ENV;
}

/** Missing or malformed configuration is a hard stop, never an implicit larger allowance. */
export function configuredGlobalLimit(env = process.env) {
  return finiteCap(env && env[globalLimitEnvName(env)]);
}

export function configuredCallerLimit(env = process.env) {
  return finiteCap(env && env[PER_CALLER_ENV]);
}

// Compatibility name used by older policy gates. It now has one meaning only: the v2 global cap
// for the VERCEL_ENV selected above. DAILY_SEARCH_BUDGET is intentionally not consulted.
export function configuredLimit(env = process.env) {
  return configuredGlobalLimit(env);
}

export function isConfigured(env = process.env) {
  return configuredGlobalLimit(env) !== null && configuredCallerLimit(env) !== null;
}

export function utcDay(nowMs) {
  const d = new Date(nowMs);
  return d.getUTCFullYear()
    + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
    + '-' + String(d.getUTCDate()).padStart(2, '0');
}

export function nextUtcMidnightMs(nowMs) {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
}

/** Exact UTC reset boundary; no grace period belongs to the next day's allowance. */
export function secondsUntilUtcMidnight(nowMs) {
  return Math.max(1, Math.ceil((nextUtcMidnightMs(nowMs) - nowMs) / 1000));
}

export function dayKey(nowMs, environment = budgetEnvironment()) {
  return `${BUDGET_NAMESPACE}:${environment}:${utcDay(nowMs)}`;
}

export function callerKey(nowMs, digest, environment = budgetEnvironment()) {
  return `${dayKey(nowMs, environment)}:caller:${digest}`;
}

function safeDigests(values) {
  const out = [];
  for (const value of (Array.isArray(values) ? values : [])) {
    const digest = String(value || '');
    if (!/^[A-Za-z0-9_-]{16,128}$/u.test(digest) || out.includes(digest)) continue;
    out.push(digest);
  }
  return out.slice(0, 3);
}

/**
 * KEYS[1] is the environment-global key; KEYS[2..n] are already-digested caller keys.
 * ARGV[1] global cap, ARGV[2] per-caller cap, ARGV[3] absolute UTC-midnight epoch seconds.
 *
 * Redis runs a Lua script without interleaving. Every limit is checked before any increment,
 * then all counters increment together, so neither granted reservations nor stored counters can
 * pass their caps under concurrency. EXPIREAT pins every new key to the same UTC boundary.
 */
export const RESERVE_SCRIPT = [
  "local global_used = tonumber(redis.call('GET', KEYS[1]) or '0')",
  'local caller_max = 0',
  "if global_used >= tonumber(ARGV[1]) then return {global_used, caller_max, 0, 1} end",
  'for i = 2, #KEYS do',
  "  local caller_used = tonumber(redis.call('GET', KEYS[i]) or '0')",
  '  if caller_used > caller_max then caller_max = caller_used end',
  '  if caller_used >= tonumber(ARGV[2]) then return {global_used, caller_used, 0, 2} end',
  'end',
  "global_used = redis.call('INCR', KEYS[1])",
  "if global_used == 1 then redis.call('EXPIREAT', KEYS[1], tonumber(ARGV[3])) end",
  'caller_max = 0',
  'for i = 2, #KEYS do',
  "  local caller_used = redis.call('INCR', KEYS[i])",
  "  if caller_used == 1 then redis.call('EXPIREAT', KEYS[i], tonumber(ARGV[3])) end",
  '  if caller_used > caller_max then caller_max = caller_used end',
  'end',
  'return {global_used, caller_max, 1, 0}',
].join('\n');

export class DailySearchBudget {
  constructor(opts = {}) {
    this.env = opts.env || process.env;
    this.environment = opts.environment || budgetEnvironment(this.env);
    const explicitGlobal = opts.globalLimit !== undefined ? opts.globalLimit : opts.limit;
    this.globalLimit = explicitGlobal === undefined ? configuredGlobalLimit(this.env) : finiteCap(explicitGlobal);
    this.limit = this.globalLimit; // retained in snapshots for existing observability consumers
    const explicitCaller = opts.callerLimit !== undefined
      ? opts.callerLimit
      : (explicitGlobal !== undefined ? explicitGlobal : undefined);
    this.callerLimit = explicitCaller === undefined ? configuredCallerLimit(this.env) : finiteCap(explicitCaller);
    this.store = opts.store || store;
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    this.callerDigests = safeDigests(opts.callerDigests);
    // Existing deterministic fixtures pass an explicit store and cap. Give those fixtures an
    // opaque caller without creating a production escape hatch; default runtime construction has
    // neither explicit option and therefore still fails closed until the handler supplies digests.
    if (!this.callerDigests.length && opts.store && explicitGlobal !== undefined) {
      this.callerDigests = ['fixture_caller_digest_v2'];
    }
    this.reserved = 0;
    this.lastReason = '';
  }

  get configured() {
    return this.globalLimit !== null && this.callerLimit !== null;
  }

  async reserve() {
    if (!this.configured) {
      this.lastReason = BUDGET_REASON.STORE;
      return { ok: false, reason: this.lastReason, used: null, callerUsed: null,
        limit: this.globalLimit, callerLimit: this.callerLimit };
    }
    // A caller-less paid request cannot be charged safely. Treat missing protected identity as
    // unavailable budget infrastructure and fail closed under the same public telemetry reason.
    if (!this.callerDigests.length) {
      this.lastReason = BUDGET_REASON.STORE;
      return { ok: false, reason: this.lastReason, used: null, callerUsed: null,
        limit: this.globalLimit, callerLimit: this.callerLimit };
    }

    const nowMs = this.now();
    const keys = [dayKey(nowMs, this.environment),
      ...this.callerDigests.map((digest) => callerKey(nowMs, digest, this.environment))];
    const expiresAt = Math.ceil(nextUtcMidnightMs(nowMs) / 1000);
    let result = null;
    try {
      result = await this.store.evalScript(RESERVE_SCRIPT, keys,
        [String(this.globalLimit), String(this.callerLimit), String(expiresAt)]);
    } catch { result = null; }
    if (!Array.isArray(result) || result.length < 4) {
      this.lastReason = BUDGET_REASON.STORE;
      return { ok: false, reason: this.lastReason, used: null, callerUsed: null,
        limit: this.globalLimit, callerLimit: this.callerLimit };
    }

    const used = Number(result[0]);
    const callerUsed = Number(result[1]);
    const allowed = Number(result[2]) === 1;
    const code = Number(result[3]);
    if (!allowed) {
      this.lastReason = code === 2 ? BUDGET_REASON.CALLER : BUDGET_REASON.DAY;
      return { ok: false, reason: this.lastReason, used, callerUsed,
        limit: this.globalLimit, callerLimit: this.callerLimit };
    }
    this.reserved += 1;
    this.lastReason = '';
    return { ok: true, reason: '', used, callerUsed,
      limit: this.globalLimit, callerLimit: this.callerLimit };
  }

  snapshot() {
    return {
      configured: this.configured,
      environment: this.environment,
      namespace: BUDGET_NAMESPACE,
      limit: this.globalLimit,
      callerLimit: this.callerLimit,
      reservedThisRequest: this.reserved,
      lastReason: this.lastReason,
      // Counts are safe operational facts. The digest values themselves never enter telemetry.
      callerDimensions: this.callerDigests.length,
    };
  }
}

/** In-memory atomic-script double used only by offline gates. */
export function fakeStore(initial = 0) {
  const map = new Map();
  return {
    map,
    unavailable: false,
    async evalScript(_script, keys, args) {
      if (this.unavailable) return null;
      const globalLimit = Number(args[0]);
      const callerLimit = Number(args[1]);
      const expiresAt = Number(args[2]);
      const current = (key) => map.has(key) ? Number(map.get(key)) : Number(initial || 0);
      const globalUsed = current(keys[0]);
      if (globalUsed >= globalLimit) return [globalUsed, 0, 0, 1];
      let callerMax = 0;
      for (const key of keys.slice(1)) {
        const callerUsed = current(key);
        callerMax = Math.max(callerMax, callerUsed);
        if (callerUsed >= callerLimit) return [globalUsed, callerUsed, 0, 2];
      }
      const nextGlobal = globalUsed + 1;
      map.set(keys[0], nextGlobal);
      if (globalUsed === 0) map.set(keys[0] + ':expireAt', expiresAt);
      callerMax = 0;
      for (const key of keys.slice(1)) {
        const callerUsed = current(key);
        const nextCaller = callerUsed + 1;
        map.set(key, nextCaller);
        if (callerUsed === 0) map.set(key + ':expireAt', expiresAt);
        callerMax = Math.max(callerMax, nextCaller);
      }
      return [nextGlobal, callerMax, 1, 0];
    },
  };
}
