// Cohere-only production graph. No measurement tools or ONNX provider imports.
import { createCohereReranker, CohereRerankError } from './cohere.js';
import * as kv from '../ledger/redis.js';
import { AI_CONSENT_VERSION } from '../ai-consent.js';

export const RERANK_MODEL = 'rerank-v5.0-fast';
// tools/qaf-gap/item-8-measurement.json SHA-256:
// 06925202d1242174c9b9622d47a19b60f67013ddbae4c42e3fcb137d176587f3
// Highest X raw relevance_score 0.6824669, multiplied by 10 in cohere.js.
export const RERANK_CARD_MIN = 6.824669;
export const RERANK_CONSENT_VERSION = AI_CONSENT_VERSION;
export const RERANK_DAILY_CAP = 200000000; // $4 / ($0.02 per million tokens).
export const RERANK_DEADLINE_MS = 1500;
export const RERANK_FALLBACK = Object.freeze({ off: 0, consent: 1, missing_key: 2, timeout: 3, cap: 4, kv: 5, error: 6, training: 7 });
const int = (v, fallback) => v === undefined || v === '' ? fallback : Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0;
export const rerankEnabled = (env = process.env) => env.RERANK_V1 === 'on';
export function rerankPreflight(env, consentVersion) {
  if (!rerankEnabled(env)) return RERANK_FALLBACK.off;
  if (consentVersion !== RERANK_CONSENT_VERSION) return RERANK_FALLBACK.consent;
  if (!process.env.COHERE_API_KEY?.trim()) return RERANK_FALLBACK.missing_key;
  // Cohere's account-level no-training setting cannot be set in a rerank body.
  // No send until deployment configuration attests that the account opted out.
  if (env.COHERE_NO_TRAINING_CONFIRMED !== 'true') return RERANK_FALLBACK.training;
  return null;
}
// Atomic date-scoped reservation, shared by all environments on the same KV.
// Reserve the UTF-8 byte bound for each query/document pair actually sent,
// plus 64 tokens of framing per pair. Missing/mismatched billing keeps this bound.
// A timeout/error may still have been billed, so its reservation is never refunded.
export function reservationFor(question, candidates) {
  const queryBytes = Buffer.byteLength(question, 'utf8');
  return candidates.reduce((sum, row) => sum + queryBytes + Buffer.byteLength(row.text, 'utf8') + 64, 0);
}
export const RESERVE = `local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used + tonumber(ARGV[1]) > tonumber(ARGV[2]) then return 0 end
redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('EXPIREAT', KEYS[1], ARGV[3])
return 1`;
export const SETTLE = `if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('INCRBY', KEYS[1], ARGV[1])
return 1`;
const passageOf = (row) => String(row.text || row.fullText || row.passage || row.snippet || '');
const sourceKey = (row) => row.url || row.recordId || row.title + '|' + String(row.text || '').slice(0, 60);

export async function rerankPools({ pools, env = process.env, consentVersion = '', deadlineMs = RERANK_DEADLINE_MS,
  fetchImpl = globalThis.fetch, store = kv, now = Date.now }) {
  const started = now();
  const telemetry = { rerank_used: 0, rerank_ms: 0, rerank_units: 0, rerank_fallback_code: 0, rerank_timeouts: 0, rerank_errors: 0 };
  const fallback = (code, detail = {}) => {
    telemetry.rerank_fallback_code = code;
    telemetry.rerank_ms = Math.max(0, now() - started);
    telemetry.rerank_timeouts = code === RERANK_FALLBACK.timeout ? 1 : 0;
    telemetry.rerank_errors = code === RERANK_FALLBACK.error ? 1 : 0;
    if (code === RERANK_FALLBACK.error) {
      const status = detail.error instanceof CohereRerankError ? detail.error.status : detail.status;
      // Existing telemetry names only: candidates is the failed request's document
      // count; count is its top_n. Never log a transport error message or cause.
      console.warn('[rerank]', {
        rerank_fallback_code: code, ...(status ? { status } : {}),
        errorName: ['CohereRerankError', 'Error', 'TypeError', 'RangeError', 'SyntaxError'].includes(detail.error?.name) ? detail.error.name : 'Error',
        candidates: detail.documents || 0, count: detail.topN || 0,
        rerank_units: telemetry.rerank_units, rerank_ms: telemetry.rerank_ms,
        ...(detail.error instanceof CohereRerankError && detail.error.providerMessage ? { error: detail.error.providerMessage } : {}),
      });
    }
    return { ok: false, telemetry };
  };
  const preflight = rerankPreflight(env, consentVersion);
  if (preflight !== null) return fallback(preflight);
  // One independent deadline after retrieval, shared by all concurrent issues.
  const budget = Math.min(RERANK_DEADLINE_MS, Math.floor(deadlineMs));
  if (!(budget > 0)) return fallback(RERANK_FALLBACK.timeout);
  const expires = started + budget;
  let timer;
  const expired = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('RERANK_DEADLINE'), { code: 'timeout' })), budget); });
  const bounded = (promise) => Promise.race([promise, expired]);
  const cap = int(env.RERANK_DAILY_CAP, RERANK_DAILY_CAP);
  const minimum = env.RERANK_CARD_MIN === undefined || env.RERANK_CARD_MIN === '' ? RERANK_CARD_MIN : Number(env.RERANK_CARD_MIN);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 10) { clearTimeout(timer); return fallback(RERANK_FALLBACK.error); }
  const day = new Date(started).toISOString().slice(0, 10);
  const key = `ezik:rerank-budget:v1:${day}`;
  const midnight = Math.floor(Date.parse(day + 'T00:00:00Z') / 1000) + 86400;
  try {
    const output = await Promise.all(pools.map(async (pool) => {
      // Each issue keeps its atomic reservation and settlement. Collect all
      // outcomes before returning, so siblings cannot mutate returned telemetry.
      let documents = 0, topN = 0, status;
      try {
        if (now() >= expires) throw Object.assign(new Error('RERANK_DEADLINE'), { code: 'timeout' });
        const providerRows = (pool.providerRows || pool.rows).slice(0, 50);
        documents = providerRows.length; topN = Math.min(10, documents);
        const candidates = providerRows.map((row, index) => ({ id: String(index), text: passageOf(row) }));
        if (!candidates.length) return { pool: { ...pool, rows: pool.rows.map((row) => ({ ...row, rerankCardMin: minimum })) } };
        const reserved = reservationFor(pool.question, candidates);
        let reservation;
        try { reservation = await bounded(store.evalScript(RESERVE, [key], [reserved, cap, midnight])); }
        catch (e) { if (e.code === 'timeout') throw e; return { code: RERANK_FALLBACK.kv }; }
        if (reservation === 0) return { code: RERANK_FALLBACK.cap };
        if (reservation !== 1) return { code: RERANK_FALLBACK.kv };
        telemetry.rerank_units += reserved;
        if (now() >= expires) throw Object.assign(new Error('RERANK_DEADLINE'), { code: 'timeout' });
        const run = createCohereReranker({ model: RERANK_MODEL, timeoutMs: Math.max(1, expires - now()), fetchImpl });
        // J2 keeps bd21873a's wire contract. Evidence preservation is local.
        const ranking = await bounded(run(pool.question, candidates, { topK: 10 }));
        status = ranking.meta.status;
        const billed = ranking.meta.billed_units;
        const tokens = Number.isSafeInteger(billed?.tokens) ? billed.tokens
          : Number.isSafeInteger(billed?.input_tokens) ? billed.input_tokens + (billed.output_tokens ?? 0) : null;
        const counted = tokens ?? reserved;
        telemetry.rerank_units += counted - reserved;
        if (tokens !== null) {
          let settled;
          try { settled = await bounded(store.evalScript(SETTLE, [key], [tokens - reserved])); }
          catch (e) { if (e.code === 'timeout') throw e; return { code: RERANK_FALLBACK.kv }; }
          if (settled !== 1) return { code: RERANK_FALLBACK.kv };
        }
        const scored = new Set(), ordered = [];
        for (const r of ranking) {
          const source = providerRows[Number(r.id)];
          // An expanded passage may share a URL with different original text.
          // Never transfer its score to text the provider did not score.
          const index = pool.rows.findIndex((row, i) => !scored.has(i)
            && sourceKey(row) === sourceKey(source) && passageOf(row) === passageOf(source));
          if (index < 0) continue;
          scored.add(index);
          ordered.push({ ...pool.rows[index], rerankScore: r.score, rerankCardMin: minimum });
        }
        return { pool: { ...pool, rows: [...ordered,
          ...pool.rows.filter((_, i) => !scored.has(i)).map((row) => ({ ...row, rerankCardMin: minimum })),
        ] } };
      } catch (error) { return { code: error.code === 'timeout' ? RERANK_FALLBACK.timeout : RERANK_FALLBACK.error, error, documents, topN, status }; }
    }));
    const failed = output.find((result) => result.code !== undefined);
    if (failed) return fallback(failed.code, failed);
    telemetry.rerank_used = 1; telemetry.rerank_ms = Math.max(0, now() - started);
    return { ok: true, pools: output.map((result) => result.pool), telemetry };
  } catch (error) { return fallback(error.code === 'timeout' ? RERANK_FALLBACK.timeout : RERANK_FALLBACK.error, { error }); }
  finally { clearTimeout(timer); }
}
