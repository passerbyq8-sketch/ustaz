import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

import { envName } from '../sync/store.js';

export const IAP_PRODUCTS = Object.freeze({
  ezik_games_3: Object.freeze({ credits: 3, months: 0, nonRenewing: true }),
  ezik_pass_week_1: Object.freeze({ credits: 0, days: 7, months: 0, nonRenewing: true }),
  ezik_pass_month_1: Object.freeze({ credits: 0, months: 1, nonRenewing: true }),
  ezik_pass_year_1: Object.freeze({ credits: 0, months: 12, nonRenewing: true }),
  ezik_month_1: Object.freeze({ credits: 0, months: 1, nonRenewing: false }),
  ezik_year_1: Object.freeze({ credits: 0, months: 12, nonRenewing: false }),
});

export const IAP_GAME_IDS = Object.freeze(['ghaws', 'harb', 'test', 'board', 'hanna']);
export const FREE_SESSIONS_PER_GAME = 0;
export const TRIAL_DAYS = 7;
export const IAP_SESSION_ID_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** The rollout mode is read here only; unknown or missing values safely disable enforcement. */
export function iapEnforcementMode() {
  const configured = process.env.IAP_ENFORCE;
  return configured === 'test' || configured === 'all' || configured === 'free' ? configured : 'off';
}

/** In free mode, only authenticated account keys listed by the server may see the entry. */
export function canShowIapPurchaseEntry(accountKey) {
  if (iapEnforcementMode() !== 'free' || typeof accountKey !== 'string' || !accountKey) return false;
  const entryAccounts = new Set((process.env.IAP_ENTRY_ACCOUNTS || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
  return entryAccounts.has(accountKey);
}

/** Ezik account keys in IAP_TEST_ACCOUNTS are private server configuration, never returned. */
export function isIapEnforced(accountKey) {
  const mode = iapEnforcementMode();
  if (mode === 'all') return true;
  if (mode !== 'test' || typeof accountKey !== 'string') return false;
  const testAccounts = new Set((process.env.IAP_TEST_ACCOUNTS || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
  return testAccounts.has(accountKey);
}

let _redis = null;
let _redisForced = false;
function client() {
  if (_redisForced) return _redis;
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  _redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  return _redis;
}

/** Test seam matching the auth store; it does not affect deployed requests. */
export function __setIapStoreForTest(redis) { _redis = redis; _redisForced = true; }
export function __resetIapStore() { _redis = null; _redisForced = false; }

const digest = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const accountBase = (accountKey) => `iap:v1:${envName()}:a:${digest(accountKey)}:`;
const transactionKey = (store, transactionId) => `iap:v1:${envName()}:tx:${digest(`${store}\u0000${transactionId}`)}`;
const gameIdSet = new Set(IAP_GAME_IDS);

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizedBalance(value) {
  const raw = (value && typeof value === 'object') ? value : {};
  const credits = Number(raw.credits);
  const expires = Number(raw.subscriptionExpiresAt);
  const legacyFreeUsed = raw.freeFirstUsed === true;
  const storedByGame = raw.freeUsedByGame && typeof raw.freeUsedByGame === 'object'
    ? raw.freeUsedByGame : {};
  const freeUsedByGame = Object.fromEntries(IAP_GAME_IDS.map((gameId) => {
    const rawCount = storedByGame[gameId];
    const n = (typeof rawCount === 'number' || typeof rawCount === 'string' && rawCount.trim() !== '')
      ? Number(rawCount) : NaN;
    const migrated = gameId === 'hanna' && legacyFreeUsed ? 1 : 0;
    const used = Number.isFinite(n) ? Math.max(Math.floor(n), migrated) : migrated;
    return [gameId, Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, used))];
  }));
  const trialStarted = Number(raw.trialStartedAt);
  return {
    credits: Number.isSafeInteger(credits) && credits > 0 ? credits : 0,
    subscriptionExpiresAt: Number.isFinite(expires) && expires > 0 ? expires : null,
    freeUsedByGame,
    trialStartedAt: Number.isSafeInteger(trialStarted) && trialStarted > 0 ? trialStarted : null,
  };
}

function balanceForResponse(value, now = Date.now()) {
  const normalized = normalizedBalance(value);
  const freeTotalPerGame = Object.fromEntries(IAP_GAME_IDS.map((gameId) => [gameId, FREE_SESSIONS_PER_GAME]));
  const freeRemainingByGame = Object.fromEntries(IAP_GAME_IDS.map((gameId) => [gameId, 0]));
  let trial = null;
  if (normalized.trialStartedAt) {
    const endsAt = normalized.trialStartedAt + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const active = now < endsAt;
    trial = {
      startedAt: normalized.trialStartedAt,
      endsAt,
      active,
      daysLeft: active ? Math.max(1, Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000))) : 0,
    };
  }
  return {
    credits: normalized.credits,
    subscriptionExpiresAt: normalized.subscriptionExpiresAt,
    freeUsedByGame: normalized.freeUsedByGame,
    freeFirstUsed: normalized.freeUsedByGame.hanna >= 1,
    freeTotalPerGame,
    freeRemainingByGame,
    trial,
  };
}

export function iapStoreConfigured() { return client() !== null; }

export async function readBalance(accountKey, now = Date.now()) {
  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  try {
    return balanceForResponse(parseJson(await c.get(accountBase(accountKey) + 'balance')), now);
  } catch (e) {
    throw new Error('iap-store-unavailable');
  }
}

const START_TRIAL_SCRIPT = [
  "local raw = redis.call('GET', KEYS[1])",
  "local b = raw and cjson.decode(raw) or {credits=0, subscriptionExpiresAt=cjson.null, freeUsedByGame={}}",
  "local started = tonumber(b.trialStartedAt) or 0",
  "if started > 0 then return cjson.encode({ok=true, created=false, startedAt=started}) end",
  "local now = tonumber(ARGV[1])",
  "b.trialStartedAt = now",
  "redis.call('SET', KEYS[1], cjson.encode(b))",
  "local event = {id='trial-start:' .. ARGV[2], account=ARGV[2], event='trial_started', time=now, creditsDelta=0}",
  "redis.call('RPUSH', KEYS[2], cjson.encode(event))",
  "return cjson.encode({ok=true, created=true, startedAt=now})",
].join('\n');

const TEST_ADJUST_SCRIPT = [
  "local raw = redis.call('GET', KEYS[1])",
  "local b = raw and cjson.decode(raw) or {credits=0, subscriptionExpiresAt=cjson.null, freeUsedByGame={}}",
  "local creditsBefore = tonumber(b.credits or 0) or 0",
  "if ARGV[1] ~= '' then b.credits = tonumber(ARGV[1]) end",
  "if ARGV[2] == 'clear' then b.trialStartedAt = cjson.null",
  "elseif ARGV[2] ~= '' then b.trialStartedAt = tonumber(ARGV[2]) end",
  "if ARGV[6] == 'clear' then b.subscriptionExpiresAt = cjson.null end",
  "redis.call('SET', KEYS[1], cjson.encode(b))",
  "local now = tonumber(ARGV[3])",
  "local event = {id=ARGV[5], account=ARGV[4], event='test_adjust', time=now, creditsDelta=(tonumber(b.credits or 0) or 0) - creditsBefore, trialStartedAt=b.trialStartedAt, clearPass=(ARGV[6] == 'clear'), subscriptionExpiresAt=b.subscriptionExpiresAt}",
  "redis.call('RPUSH', KEYS[2], cjson.encode(event))",
  "return cjson.encode({ok=true})",
].join('\n');

export async function startTrial(accountKey, now = Date.now()) {
  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  const base = accountBase(accountKey);
  try {
    const raw = await c.eval(START_TRIAL_SCRIPT, [base + 'balance', base + 'ledger'], [String(now), accountKey]);
    const result = parseJson(raw);
    if (!result || typeof result !== 'object' || result.ok !== true) throw new Error('iap-store-result');
    return result;
  } catch (e) {
    if (e && e.message === 'iap-store-result') throw e;
    throw new Error('iap-store-unavailable');
  }
}

export async function testAdjustBalance(accountKey, adjustment, now = Date.now()) {
  const value = adjustment && typeof adjustment === 'object' ? adjustment : {};
  const hasTrialChange = value.clearTrial === true || Number.isInteger(value.trialDays);
  const hasCreditChange = value.credits !== undefined;
  const hasPassChange = value.clearPass === true;
  if (value.clearTrial === true && value.trialDays !== undefined) return { ok: false, code: 'iap-test-adjust-shape' };
  if (value.clearPass !== undefined && value.clearPass !== true) return { ok: false, code: 'iap-test-adjust-shape' };
  if (value.trialDays !== undefined && (!Number.isInteger(value.trialDays) || value.trialDays < 0 || value.trialDays > 8)) {
    return { ok: false, code: 'iap-test-adjust-trial' };
  }
  if (value.credits !== undefined && (!Number.isInteger(value.credits) || value.credits < 0 || value.credits > 20)) {
    return { ok: false, code: 'iap-test-adjust-credits' };
  }
  if (!hasTrialChange && !hasCreditChange && !hasPassChange) return { ok: false, code: 'iap-test-adjust-shape' };

  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  const trialValue = value.clearTrial === true ? 'clear'
    : Number.isInteger(value.trialDays) ? String(now - value.trialDays * 24 * 60 * 60 * 1000) : '';
  const eventId = 'test-adjust:' + String(now) + ':' + crypto.randomBytes(8).toString('hex');
  const base = accountBase(accountKey);
  try {
    const raw = await c.eval(TEST_ADJUST_SCRIPT, [base + 'balance', base + 'ledger'], [
      hasCreditChange ? String(value.credits) : '', trialValue, String(now), accountKey, eventId,
      hasPassChange ? 'clear' : '',
    ]);
    const result = parseJson(raw);
    if (!result || typeof result !== 'object' || result.ok !== true) throw new Error('iap-store-result');
    return { ok: true };
  } catch (e) {
    if (e && e.message === 'iap-store-result') throw e;
    throw new Error('iap-store-unavailable');
  }
}

const CONSUME_SCRIPT = [
  "local prior = redis.call('GET', KEYS[2])",
  "if prior then",
  "  local old = cjson.decode(prior)",
  "  if old.gameId and old.gameId ~= ARGV[2] then return cjson.encode({ok=false, code='iap-session-conflict'}) end",
  "  return prior",
  "end",
  "local raw = redis.call('GET', KEYS[1])",
  "local b = raw and cjson.decode(raw) or {credits=0, subscriptionExpiresAt=cjson.null, freeUsedByGame={}}",
  "local credits = tonumber(b.credits or 0) or 0",
  "local expires = tonumber(b.subscriptionExpiresAt) or 0",
  "local gameIds = cjson.decode(ARGV[5])",
  "local usage = type(b.freeUsedByGame) == 'table' and b.freeUsedByGame or {}",
  "for _, id in ipairs(gameIds) do",
  "  local used = tonumber(usage[id])",
  "  local migrated = (id == 'hanna' and b.freeFirstUsed == true) and 1 or 0",
  "  if not used or used < migrated then used = migrated end",
  "  used = math.floor(used)",
  "  if used < 0 then used = 0 end",
  "  usage[id] = used",
  "end",
  "local gameId = ARGV[2]",
  "local now = tonumber(ARGV[1])",
  "local trialStarted = tonumber(b.trialStartedAt) or 0",
  "local trialEndsAt = trialStarted + (tonumber(ARGV[4]) or 0) * 86400000",
  "local mode = ''",
  "if trialStarted > 0 and now >= trialStarted and now <= trialEndsAt + 1800000 then mode = 'trial'",
  "elseif expires > now then mode = 'subscription'",
  "elseif credits > 0 then mode = 'credit'; credits = credits - 1",
  "else return cjson.encode({ok=false, code='iap-no-credit'}) end",
  "b.credits = credits",
  "b.subscriptionExpiresAt = (expires > 0 and expires or cjson.null)",
  "b.freeUsedByGame = usage",
  "b.freeFirstUsed = nil",
  "local resultBalance = {credits=credits, subscriptionExpiresAt=b.subscriptionExpiresAt, freeUsedByGame=usage, freeFirstUsed=((tonumber(usage['hanna']) or 0) >= 1)}",
  "local result = {ok=true, mode=mode, gameId=gameId, balance=resultBalance}",
  "redis.call('SET', KEYS[1], cjson.encode(b))",
  "local encoded = cjson.encode(result)",
  "redis.call('SET', KEYS[2], encoded)",
  "return encoded",
].join('\n');

export async function consumeSession(accountKey, sessionId, gameId, intent = 'automatic', now = Date.now()) {
  if (!IAP_SESSION_ID_RE.test(sessionId)) return { ok: false, code: 'iap-session-id' };
  if (!gameIdSet.has(gameId)) return { ok: false, code: 'iap-game-id' };
  if (!['automatic', 'free', 'credit'].includes(intent)) return { ok: false, code: 'iap-consume-intent' };
  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  const base = accountBase(accountKey);
  try {
    const raw = await c.eval(CONSUME_SCRIPT,
      [base + 'balance', base + 'session:' + digest(sessionId), base + 'ledger'],
      [String(now), gameId, intent, String(TRIAL_DAYS), JSON.stringify(IAP_GAME_IDS), accountKey, sessionId]);
    const result = parseJson(raw);
    if (!result || typeof result !== 'object') throw new Error('iap-store-result');
    return result;
  } catch (e) {
    if (e && e.message === 'iap-store-result') throw e;
    throw new Error('iap-store-unavailable');
  }
}

const APPLY_EVENT_SCRIPT = [
  "local marker = redis.call('GET', KEYS[4])",
  "if marker then return 'DUPLICATE' end",
  "local txRaw = redis.call('GET', KEYS[2]) or ''",
  "if txRaw ~= ARGV[1] then return 'RETRY' end",
  "local balRaw = redis.call('GET', KEYS[1])",
  "local b = balRaw and cjson.decode(balRaw) or {credits=0, subscriptionExpiresAt=cjson.null, freeUsedByGame={}}",
  "if (tonumber(b.credits or 0) or 0) ~= tonumber(ARGV[2]) then return 'RETRY' end",
  "if (tonumber(b.subscriptionExpiresAt) or 0) ~= tonumber(ARGV[3]) then return 'RETRY' end",
  "local gameIds = cjson.decode(ARGV[4])",
  "local usage = type(b.freeUsedByGame) == 'table' and b.freeUsedByGame or {}",
  "for i, id in ipairs(gameIds) do",
  "  local used = tonumber(usage[id])",
  "  local migrated = (id == 'hanna' and b.freeFirstUsed == true) and 1 or 0",
  "  if not used or used < migrated then used = migrated end",
  "  used = math.floor(used)",
  "  if used < 0 then used = 0 end",
  "  if used ~= tonumber(ARGV[5 + i]) then return 'RETRY' end",
  "end",
  "if (tonumber(b.trialStartedAt) or 0) ~= tonumber(ARGV[9 + #gameIds]) then return 'RETRY' end",
  "redis.call('SET', KEYS[1], ARGV[6 + #gameIds])",
  "redis.call('SET', KEYS[2], ARGV[7 + #gameIds])",
  "redis.call('SET', KEYS[4], '1')",
  "redis.call('RPUSH', KEYS[3], ARGV[8 + #gameIds])",
  "return 'APPLIED'",
].join('\n');

function addCalendarMonths(timestamp, months) {
  const d = new Date(timestamp);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.getTime();
}

function addPassDuration(timestamp, rule) {
  let result = timestamp;
  if (rule.months > 0) result = addCalendarMonths(result, rule.months);
  if (rule.days > 0) result += rule.days * 24 * 60 * 60 * 1000;
  return result;
}

function subtractPassDuration(timestamp, rule) {
  let result = timestamp;
  if (rule.days > 0) result -= rule.days * 24 * 60 * 60 * 1000;
  if (rule.months > 0) result = addCalendarMonths(result, -rule.months);
  return result;
}

function rawTransaction(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function eventSuffix(action) {
  if (action === 'purchase') return 'purchase';
  if (action === 'refund') return 'refund';
  return 'refund-reversed';
}

/**
 * Apply one purchase/refund webhook event atomically with the balance and its append-only ledger row.
 * The event marker is per store transaction and action; retries cannot grant or reverse twice.
 */
export async function applyTransactionEvent(input) {
  const { accountKey, store, transactionId, productId, action, eventType, time } = input;
  const rule = IAP_PRODUCTS[productId];
  if (!rule || !['purchase', 'refund', 'refund-reversed'].includes(action)) {
    return { ok: false, code: 'iap-event-shape' };
  }
  if (typeof store !== 'string' || !/^[A-Z0-9_]{2,32}$/.test(store)
    || typeof transactionId !== 'string' || transactionId.length < 1 || transactionId.length > 256) {
    return { ok: false, code: 'iap-transaction-shape' };
  }

  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  const txKey = transactionKey(store, transactionId);
  const base = accountBase(accountKey);
  const markerKey = txKey + ':' + eventSuffix(action);
  const ledgerKey = base + 'ledger';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const [currentBalanceRaw, currentTxValue, already] = await Promise.all([
        c.get(base + 'balance'), c.get(txKey), c.get(markerKey),
      ]);
      if (already !== null && already !== undefined) return { ok: true, status: 'duplicate' };

      const balance = normalizedBalance(parseJson(currentBalanceRaw));
      const oldTxRaw = rawTransaction(currentTxValue);
      const tx = parseJson(currentTxValue, {
        accountKey, productId, store, transactionId,
        creditsGranted: rule.credits, daysGranted: rule.days || 0, monthsGranted: rule.months,
        purchaseApplied: false, refundApplied: false, refundReversed: false,
      });
      if (tx.accountKey !== accountKey || tx.productId !== productId || tx.store !== store
        || tx.transactionId !== transactionId) {
        return { ok: false, code: 'iap-transaction-conflict' };
      }

      const nextBalance = { ...balance };
      const nextTx = { ...tx };
      const now = Date.now();
      let creditDelta = 0;

      if (action === 'purchase') {
        if (nextTx.purchaseApplied === true) return { ok: true, status: 'duplicate' };
        nextTx.purchaseApplied = true;
        nextTx.creditsGranted = rule.credits;
        nextTx.daysGranted = rule.days || 0;
        nextTx.monthsGranted = rule.months;
        if (nextTx.refundApplied !== true) {
          if (rule.credits > 0) {
            nextBalance.credits += rule.credits;
            creditDelta = rule.credits;
          }
          if (rule.months > 0 || rule.days > 0) {
            const baseExpiry = Math.max(now, balance.subscriptionExpiresAt || 0);
            nextBalance.subscriptionExpiresAt = addPassDuration(baseExpiry, rule);
          }
        }
      } else if (action === 'refund') {
        if (nextTx.refundApplied === true) return { ok: true, status: 'duplicate' };
        nextTx.refundApplied = true;
        if (nextTx.purchaseApplied === true && nextTx.refundReversed !== true) {
          if (rule.credits > 0) {
            const removed = Math.min(nextBalance.credits, rule.credits);
            nextBalance.credits -= removed;
            creditDelta = -removed;
          }
          if ((rule.months > 0 || rule.days > 0) && nextBalance.subscriptionExpiresAt) {
            if (nextBalance.subscriptionExpiresAt > now) {
              nextBalance.subscriptionExpiresAt = Math.max(now, subtractPassDuration(nextBalance.subscriptionExpiresAt, rule));
            }
          }
        }
      } else {
        if (nextTx.refundReversed === true) return { ok: true, status: 'duplicate' };
        nextTx.refundReversed = true;
        if (nextTx.refundApplied === true) {
          nextTx.refundApplied = false;
          if (nextTx.purchaseApplied === true) {
            if (rule.credits > 0) {
              nextBalance.credits += rule.credits;
              creditDelta = rule.credits;
            }
            if (rule.months > 0 || rule.days > 0) {
              const baseExpiry = Math.max(now, balance.subscriptionExpiresAt || 0);
              nextBalance.subscriptionExpiresAt = addPassDuration(baseExpiry, rule);
            }
          }
        }
      }

      const ledger = {
        id: `${store}:${transactionId}:${eventType}`,
        account: accountKey,
        product: productId,
        event: eventType,
        time: Number.isFinite(time) && time > 0 ? time : now,
        store,
        transactionId,
        creditsDelta: creditDelta,
      };
      const expiry = balance.subscriptionExpiresAt || 0;
      const expectedTx = oldTxRaw;
      const response = await c.eval(APPLY_EVENT_SCRIPT,
        [base + 'balance', txKey, ledgerKey, markerKey],
        [expectedTx, String(balance.credits), String(expiry), JSON.stringify(IAP_GAME_IDS),
          String(FREE_SESSIONS_PER_GAME), ...IAP_GAME_IDS.map((gameId) => String(balance.freeUsedByGame[gameId])),
          JSON.stringify(nextBalance), JSON.stringify(nextTx), JSON.stringify(ledger), String(balance.trialStartedAt || 0)]);
      if (response === 'RETRY') continue;
      if (response === 'DUPLICATE') return { ok: true, status: 'duplicate' };
      if (response === 'APPLIED') return { ok: true, status: 'applied' };
      throw new Error('iap-store-result');
    } catch (e) {
      if (e && e.message === 'iap-store-result') throw e;
      if (e && e.message === 'iap-transaction-conflict') throw e;
      throw new Error('iap-store-unavailable');
    }
  }
  throw new Error('iap-store-contention');
}
