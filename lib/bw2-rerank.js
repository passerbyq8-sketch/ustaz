import { searchFatwas } from './fatwa-service.js';
import { searchStoredCorpus } from './encyclopedia.js';
import { runTool, encyclopediaRow } from './free-brain/tools.js';
import { LIB_LIMIT_MAX, LIB_MAX_CHARS_PER_HIT_CEILING } from './lib-contract.js';
import { normalizeArabic } from './route-classify.js';

const keyOf = (row) => row.url || row.recordId || row.title + '|' + String(row.text || '').slice(0, 60);
function lexicalScore(question, row) {
  const terms = [...new Set(normalizeArabic(question).split(' ').filter((t) => t.length >= 3))];
  const title = normalizeArabic(row.title), text = normalizeArabic(row.text || row.fullText || row.snippet);
  return terms.reduce((score, term) => score + (title.includes(term) ? 5 : 0) + (text.includes(term) ? 1 : 0), 0);
}
export function mergeRerankRows(...groups) {
  const seen = new Set();
  return groups.flat().filter((row) => {
    const key = keyOf(row);
    if (seen.has(key) || !String(row.text || row.fullText || row.passage || row.snippet || '').trim()) return false;
    seen.add(key); return true;
  });
}
// The legacy candidates are evidence, not replaceable search suggestions. Keep
// every original passage (including distinct rows sharing a URL), then add only
// expanded sources that are not already represented.
export function preserveRerankRows(original, ...expanded) {
  const seen = new Set(original.map(keyOf));
  return [...original, ...mergeRerankRows(...expanded).filter((row) => {
    const key = keyOf(row);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  })];
}
// Expanded pools run beside existing retrieval under the SAME deadline. Nothing
// mutates the old gathered rows, so every fallback retains the original path.
export async function gatherRerankPools({ question, parts, queryFor, budgetMs, band, libFlagValue, libToken, signal, deps = {} }) {
  const abort = new AbortController();
  const memberSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
  let timer;
  const pools = (parts.length > 1 ? parts : [{ text: question }]).map((p) => ({ question: p.text, rows: [] }));
  const work = Promise.all(pools.map(async (pool, partIndex) => {
    const query = queryFor(pool.question);
    const add = (rows) => { if (!abort.signal.aborted) pool.rows.push(...rows.map((row) => ({ ...row, ...(parts.length > 1 ? { qpart: partIndex } : {}) }))); };
    await Promise.allSettled([
      Promise.resolve().then(() => (deps.searchFatwas || searchFatwas)({ resolvedTopic: query, currentQuestion: pool.question },
        { rerankPool: true, signal: memberSignal, fetchImpl: deps.fetchImpl })).then((found) => add((found.records || []).map((r) => ({
          kind: 'fatwa', title: r.title, url: r.url, publisher: r.publisher, recordId: r.id,
          text: [r.question, r.answer].filter(Boolean).join('\n'), fullText: r.passage || r.answer, fatwaRecord: r,
        })))),
      Promise.resolve().then(() => (deps.searchStoredCorpus || searchStoredCorpus)(query, { limit: 50 })).then((found) => add((found.records || []).map((r) => ({ ...(deps.encyclopediaRow || encyclopediaRow)(r), fullText: r.text || r.snippet })))),
      libFlagValue === 'on' && libToken ? (async () => {
        const rows = [];
        await (deps.runTool || runTool)('search_library', { query }, { band, signal: memberSignal, fetchImpl: deps.fetchImpl, dailyBudget: null, question: pool.question,
          libFlagValue, libToken, resultCap: LIB_LIMIT_MAX, maxCharsPerHit: LIB_MAX_CHARS_PER_HIT_CEILING, keepFullText: true,
          table: { add(row) { rows.push(row); return row; }, rows }, spend: [], degraded: [] });
        add(rows);
      })() : Promise.resolve(),
    ]);
  }));
  try { await Promise.race([work, new Promise((resolve) => { timer = setTimeout(resolve, Math.max(0, budgetMs)); })]); }
  finally { clearTimeout(timer); abort.abort(); }
  return pools.map((p) => ({ ...p, rows: mergeRerankRows(p.rows)
    .sort((a, b) => lexicalScore(queryFor(p.question), b) - lexicalScore(queryFor(p.question), a) || keyOf(a).localeCompare(keyOf(b))) }));
}
