// Cohere transport only. Measurement/runtime consumers import this file directly so
// the local ONNX measurement dependency never enters a server function bundle.
const ENDPOINT = 'https://api.cohere.com/v2/rerank';

export class CohereRerankError extends Error {
  constructor(code) {
    super('RERANK_COHERE_' + code);
    this.name = 'CohereRerankError';
    this.code = code;
  }
}

function documentsFor(question, candidates, topK) {
  if (typeof question !== 'string' || !question.trim()) throw new Error('RERANK_QUESTION_REQUIRED');
  if (!Array.isArray(candidates) || candidates.length > 50) throw new Error('RERANK_CANDIDATES_LIMIT');
  if (!Number.isInteger(topK) || topK < 0) throw new Error('RERANK_TOPK_INVALID');
  const seen = new Set();
  return candidates.map((row) => {
    if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id)) throw new Error('RERANK_IDS_INVALID');
    seen.add(row.id);
    const text = row.text || row.snippet;
    if (typeof text !== 'string' || !text.trim()) throw new Error('RERANK_PASSAGE_REQUIRED');
    return text;
  });
}

function withBilling(ranking, billedUnits, status) {
  // Preserve the existing array interface. Billing is explicitly accessible as
  // ranking.meta.billed_units (including literal v5 token fields), without a
  // synthetic ranked row. Missing billing remains null for conservative accounting.
  Object.defineProperty(ranking, 'meta', {
    value: Object.freeze({ billed_units: billedUnits === null ? null : Object.freeze({ ...billedUnits }), ...(status ? { status } : {}) }),
  });
  return ranking;
}

function parseRanking(payload, candidates, count, status) {
  const units = payload?.meta?.billed_units ?? null;
  if (!payload || !Array.isArray(payload.results) || payload.results.length !== count
      || (units !== null && (typeof units !== 'object' || Array.isArray(units)
        || Object.values(units).some((n) => !Number.isSafeInteger(n) || n < 0)))) throw new CohereRerankError('bad_response');
  const seen = new Set();
  const ranking = payload.results.map((row) => {
    if (!row || !Number.isInteger(row.index) || row.index < 0 || row.index >= candidates.length
        || seen.has(row.index) || typeof row.relevance_score !== 'number'
        || !Number.isFinite(row.relevance_score) || row.relevance_score < 0 || row.relevance_score > 1) {
      throw new CohereRerankError('bad_response');
    }
    seen.add(row.index);
    return { id: candidates[row.index].id, score: row.relevance_score * 10, index: row.index };
  });
  ranking.sort((a, b) => b.score - a.score || a.index - b.index);
  return withBilling(ranking.map(({ id, score }) => ({ id, score })), units, status);
}

function providerMessage(text, sensitive) {
  // The provider can echo any part of its input, including the credential. Remove
  // every input word before admitting printable ASCII to the operational log.
  const denied = new Set(sensitive.flatMap((s) => s.match(/[a-z0-9]+/gi) || []).map((s) => s.toLowerCase()));
  return text.replace(/[^\x20-\x7e]/g, ' ').replace(/[a-z0-9]+/gi,
    (word) => denied.has(word.toLowerCase()) ? '[redacted]' : word).replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function createCohereReranker({ model = 'rerank-v3.5', timeoutMs = 1500, fetchImpl = globalThis.fetch } = {}) {
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(model)) throw new Error('RERANK_MODEL_INVALID');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) throw new Error('RERANK_TIMEOUT_INVALID');
  return async function rerank(question, candidates, { topK = 10 } = {}) {
    const documents = documentsFor(question, candidates, topK);
    const count = Math.min(topK, candidates.length);
    if (!count) return withBilling([], { search_units: 0 });
    // The credential has exactly one source. Bodies, headers and transport causes
    // never escape; J4 admits only the bounded, input-redacted provider message.
    const key = process.env.COHERE_API_KEY?.trim();
    if (!key) throw new CohereRerankError('missing_key');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    let status;
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, query: question, documents, top_n: count }),
      });
      status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599 ? response.status : undefined;
      if (!response?.ok) {
        const error = new CohereRerankError(Number.isInteger(status) && status >= 100 && status <= 599 ? 'http_' + status : 'bad_response');
        try {
          const text = await response.text();
          let message = text;
          try { message = JSON.parse(text)?.message; } catch { /* plain provider error text */ }
          if (typeof message === 'string') error.providerMessage = providerMessage(message, [key, question, ...documents]);
        } catch { /* the classified HTTP status remains available */ }
        throw error;
      }
      if (!/(?:application\/json|\+json)(?:\s*;|$)/i.test(response.headers?.get?.('content-type') || '')) {
        throw new CohereRerankError('bad_response');
      }
      const payload = await response.json();
      if (controller.signal.aborted) throw new CohereRerankError('timeout');
      return parseRanking(payload, candidates, count, status);
    } catch (error) {
      if (controller.signal.aborted) throw new CohereRerankError('timeout');
      const classified = error instanceof CohereRerankError ? error : new CohereRerankError('bad_response');
      if (status) classified.status = status;
      throw classified;
    } finally {
      clearTimeout(timer);
    }
  };
}
