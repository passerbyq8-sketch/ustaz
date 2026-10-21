import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

import { envName } from '../sync/store.js';

export const IAP_PRODUCTS = Object.freeze({
  ezik_games_3: Object.freeze({ credits: 3, months: 0 }),
  ezik_month_1: Object.freeze({ credits: 0, months: 1 }),
  ezik_year_1: Object.freeze({ credits: 0, months: 12 }),
});

export const IAP_SESSION_ID_RE = /^[A-Za-z0-9_-]{16,128}$/;

let _redis = null;
function client() {
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  _redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  return _redis;
}

const digest = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const accountBase = (accountKey) => `iap:v1:${envName()}:a:${digest(accountKey)}:`;
const transactionKey = (store, transactionId) => `iap:v1:${envName()}:tx:${digest(`${store}\u0000${transactionId}`)}`;
const emptyBalance = () => ({ credits: 0, subscriptionExpiresAt: null, freeFirstUsed: false });

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizedBalance(value) {
  const raw = (value && typeof value === 'object') ? value : {};
  const credits = Number(raw.credits);
  const expires = Number(raw.subscriptionExpiresAt);
  return {
    credits: Number.isSafeInteger(credits) && credits > 0 ? credits : 0,
    subscriptionExpiresAt: Number.isFinite(expires) && expires > 0 ? expires : null,
    freeFirstUsed: raw.freeFirstUsed === true,
  };
}

export function iapStoreConfigured() { return client() !== null; }

export async function readBalance(accountKey) {
  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  try {
    return normalizedBalance(parseJson(await c.get(accountBase(accountKey) + 'balance')));
  } catch (e) {
    throw new Error('iap-store-unavailable');
  }
}

const CONSUME_SCRIPT = [
  "local prior = redis.call('GET', KEYS[2])",
  "if prior then return prior end",
  "local raw = redis.call('GET', KEYS[1])",
  "local b = raw and cjson.decode(raw) or {credits=0, subscriptionExpiresAt=cjson.null, freeFirstUsed=false}",
  "local credits = tonumber(b.credits or 0) or 0",
  "local expires = tonumber(b.subscriptionExpiresAt) or 0",
  "local freeUsed = b.freeFirstUsed == true",
  "local now = tonumber(ARGV[1])",
  "local mode = ''",
  "if expires > now then mode = 'subscription'",
  "elseif not freeUsed then mode = 'free'; freeUsed = true",
  "elseif credits > 0 then mode = 'credit'; credits = credits - 1",
  "else return cjson.encode({ok=false, code='iap-no-credit'}) end",
  "b.credits = credits",
  "b.subscriptionExpiresAt = (expires > 0 and expires or cjson.null)",
  "b.freeFirstUsed = freeUsed",
  "local result = {ok=true, mode=mode, balance=b}",
  "redis.call('SET', KEYS[1], cjson.encode(b))",
  "local encoded = cjson.encode(result)",
  "redis.call('SET', KEYS[2], encoded)",
  "return encoded",
].join('\n');

export async function consumeSession(accountKey, sessionId, now = Date.now()) {
  if (!IAP_SESSION_ID_RE.test(sessionId)) return { ok: false, code: 'iap-session-id' };
  const c = client();
  if (!c) throw new Error('iap-store-unconfigured');
  const base = accountBase(accountKey);
  try {
    const raw = await c.eval(CONSUME_SCRIPT, [base + 'balance', base + 'session:' + digest(sessionId)], [String(now)]);
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
  "local b = balRaw and cjson.decode(balRaw) or {credits=0, subscriptionExpiresAt=cjson.null, freeFirstUsed=false}",
  "if (tonumber(b.credits or 0) or 0) ~= tonumber(ARGV[2]) then return 'RETRY' end",
  "if (tonumber(b.subscriptionExpiresAt) or 0) ~= tonumber(ARGV[3]) then return 'RETRY' end",
  "if (b.freeFirstUsed == true) ~= (ARGV[4] == '1') then return 'RETRY' end",
  "redis.call('SET', KEYS[1], ARGV[5])",
  "redis.call('SET', KEYS[2], ARGV[6])",
  "redis.call('SET', KEYS[4], '1')",
  "redis.call('RPUSH', KEYS[3], ARGV[7])",
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
        creditsGranted: rule.credits, monthsGranted: rule.months,
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
        nextTx.monthsGranted = rule.months;
        if (nextTx.refundApplied !== true) {
          if (rule.credits > 0) {
            nextBalance.credits += rule.credits;
            creditDelta = rule.credits;
          }
          if (rule.months > 0) {
            const baseExpiry = Math.max(now, balance.subscriptionExpiresAt || 0);
            nextBalance.subscriptionExpiresAt = addCalendarMonths(baseExpiry, rule.months);
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
          if (rule.months > 0 && nextBalance.subscriptionExpiresAt) {
            if (nextBalance.subscriptionExpiresAt > now) {
              nextBalance.subscriptionExpiresAt = Math.max(now, addCalendarMonths(nextBalance.subscriptionExpiresAt, -rule.months));
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
            if (rule.months > 0) {
              const baseExpiry = Math.max(now, balance.subscriptionExpiresAt || 0);
              nextBalance.subscriptionExpiresAt = addCalendarMonths(baseExpiry, rule.months);
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
        [expectedTx, String(balance.credits), String(expiry), balance.freeFirstUsed ? '1' : '0',
          JSON.stringify(nextBalance), JSON.stringify(nextTx), JSON.stringify(ledger)]);
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
