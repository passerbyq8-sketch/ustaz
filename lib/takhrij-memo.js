// lib/takhrij-memo.js -- ITEM D4 (147) -- 2026-10-15 brain-line
//
// THE TAKHRIJ MEMORY OF THE SERVER: the in-memory store of lib/takhrij.js in front, Upstash behind it under tk:v1:
// (24 h) when the store is configured (KV_REST_API_URL / KV_REST_API_TOKEN, lib/ledger/redis.js). With no store it is
// the in-memory one alone, and nothing fails. What is kept is a matn's lookup state -- ladder ids, rulings, Companion
// candidates -- never the question and never the answer.
import { createTakhrijMemo, TAKHRIJ_MEMO_TTL_SECONDS } from './takhrij.js';
import { get as redisGet, setex as redisSetex } from './ledger/redis.js';

const local = createTakhrijMemo();
// Active only where the store is configured -- a deployment. A test process, which drives one matn through many
// fixture libraries, gets no memory at all and every pass looks up afresh, as before.
const active = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export const takhrijMemo = Object.freeze({
  async get(k) {
    if (!active()) return null;
    const hit = await local.get(k);
    if (hit) return hit;
    const raw = await redisGet(k);
    if (!raw) return null;
    let value = null;
    try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
    if (!value || !Array.isArray(value.confirmed)) return null;
    await local.set(k, value);
    return value;
  },
  async set(k, value) {
    if (!active()) return;
    await local.set(k, value);
    await redisSetex(k, TAKHRIJ_MEMO_TTL_SECONDS, JSON.stringify(value));
  },
});
