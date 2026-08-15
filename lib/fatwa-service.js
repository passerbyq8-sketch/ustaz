// Server-side adapter for the existing fatwa UI contract.  The base is fixed and
// cannot be supplied by a reader. Returned records remain untrusted data until they
// pass schema, scholar, host and topical-relevance checks below.

import { normalizeArabic } from './route-classify.js';
import { hostMatches } from './source-registry.js';
import { canonicalToken, isFaceVeilTopic, topicTerms } from './stored-deen.js';
import {
  FATWA_BASE,
  FATWA_EXPECTED_IBN_BAZ_TOTAL,
  FATWA_EXPECTED_SCHOLARS,
  FATWA_EXPECTED_TOTAL,
  FATWA_SCHEMA,
  FATWA_SCHOLARS,
  fatwaContractTotals,
  resolveFatwaScholar,
} from './fatwa-contract.js';

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 9000;
const VERIFY_TTL_MS = 5 * 60 * 1000;
const MAX_RESULTS = 12;
const MAX_EVIDENCE_TEXT = 6000;
let verificationCache = null;

function signalFor(parent, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(250, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function cleanText(value, max = MAX_EVIDENCE_TEXT) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/<\/?source\b[^>]*>/giu, ' ')
    .replace(/\s+/gu, ' ').trim().slice(0, max);
}

async function readJson(path, { fetchImpl = globalThis.fetch, signal, timeoutMs } = {}) {
  const url = new URL(path, FATWA_BASE);
  if (url.origin !== FATWA_BASE || !url.pathname.startsWith('/api/v1/')) throw new Error('fatwa_path_refused');
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'error', signal: signalFor(signal, timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!response || !response.ok) throw new Error(`fatwa_http_${response && response.status}`);
  const final = new URL(response.url || url.href);
  if (final.origin !== FATWA_BASE) throw new Error('fatwa_redirect_refused');
  const type = String(response.headers?.get?.('content-type') || '').toLowerCase();
  if (!type.includes('application/json')) throw new Error('fatwa_content_type');
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > MAX_JSON_BYTES) throw new Error('fatwa_body_too_large');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new Error('fatwa_body_too_large');
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('fatwa_invalid_json'); }
  if (!payload || payload.ok !== true || payload.schemaVersion !== FATWA_SCHEMA) throw new Error('fatwa_bad_contract');
  return payload;
}

export async function verifyFatwaService(options = {}) {
  const now = Date.now();
  if (!options.force && verificationCache && verificationCache.expiresAt > now) return verificationCache.value;
  const [health, registry] = await Promise.all([
    readJson('/api/v1/health', options),
    readJson('/api/v1/scholars', options),
  ]);
  const scholars = Array.isArray(registry.scholars) ? registry.scholars : [];
  const expected = new Map(FATWA_SCHOLARS.map((entry) => [entry.id, entry]));
  const failures = [];
  for (const item of scholars) {
    const wanted = expected.get(String(item && item.id || ''));
    const count = Number(item && item.snapshot && item.snapshot.records);
    if (!wanted || count !== wanted.count) failures.push(String(item && item.id || 'unknown'));
  }
  for (const id of expected.keys()) {
    if (!scholars.some((item) => item && item.id === id)) failures.push(`missing:${id}`);
  }
  const totals = fatwaContractTotals();
  const reportedTotal = scholars.reduce((sum, item) => sum + Number(item?.snapshot?.records || 0), 0);
  const healthCount = Array.isArray(health?.scholars)
    ? health.scholars.length
    : Number(health?.counts?.scholars || 0);
  if (scholars.length !== FATWA_EXPECTED_SCHOLARS) failures.push('scholar_count');
  if (reportedTotal !== FATWA_EXPECTED_TOTAL) failures.push('fatwa_total');
  if (healthCount !== FATWA_EXPECTED_SCHOLARS) failures.push('health_scholar_count');
  if (totals.total !== FATWA_EXPECTED_TOTAL || totals.ibnBaz !== FATWA_EXPECTED_IBN_BAZ_TOTAL) failures.push('pinned_contract');
  const value = Object.freeze({
    status: failures.length ? 'DEGRADED' : 'OK',
    scholars: scholars.length,
    total: reportedTotal,
    ibnBaz: Number(scholars.find((item) => item.id === 'binbaz')?.snapshot?.records || 0),
    failures: Object.freeze(failures),
  });
  if (failures.length) throw Object.assign(new Error('fatwa_snapshot_mismatch'), { verification: value });
  verificationCache = { expiresAt: now + VERIFY_TTL_MS, value };
  return value;
}

function searchQueriesFor(context) {
  const raw = cleanText(context?.resolvedTopic || context?.currentQuestion || '', 240);
  const folded = normalizeArabic(raw);
  // The service currently indexes the Ibn-Uthaymeen record under the noun form, while the
  // reader's common wording uses the verb form. This is a query synonym, not a new endpoint.
  if (/(?:اسقطت|سقط)\s+.*(?:ثمانين|80)/u.test(folded)) return ['سقط الجنين قبل ثمانين يوما'];
  if (isFaceVeilTopic(raw) || isFaceVeilTopic(context?.currentQuestion || '')) {
    return ['هل النقاب واجب؟', 'حكم تغطية وجه المرأة'];
  }
  return raw ? [raw] : [];
}

function searchQueryFor(context) {
  return searchQueriesFor(context)[0] || '';
}

function expectedHost(record, scholar) {
  let url;
  try { url = new URL(record?.source?.canonicalUrl || record?.source?.url || ''); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./u, '');
  if (scholar.id === 'aljasser') {
    if (!['youtube.com', 'youtu.be', 'dr-mutlaq.com'].some((domain) => hostMatches(host, domain))) return null;
  } else if (!hostMatches(host, scholar.sourceDomain)) return null;
  return url.href;
}

function topicalScore(record, context) {
  const terms = topicTerms(context?.resolvedTopic || context?.currentQuestion || '', context?.resolvedScholar)
    .map((term) => term.key).filter((key, index, all) => key && all.indexOf(key) === index).slice(0, 5);
  if (!terms.length) return { accepted: false, score: 0, matched: [] };
  const title = normalizeArabic(record.title || '');
  const question = normalizeArabic(record.content?.question || '');
  const answer = normalizeArabic(record.content?.answer || record.content?.answerExcerpt || '');
  // Match canonical word tokens, never substrings.  In particular, «الجمعة»
  // is not evidence for «الجمع بين الصلاتين» merely because it contains the
  // three letters جمع.
  const wordKeys = (value) => value.split(/\s+/u).map(canonicalToken).filter(Boolean);
  const titleWords = wordKeys(title);
  const questionWords = wordKeys(question);
  const answerWords = wordKeys(answer);
  const has = (words, term) => words.includes(term);
  const matched = terms.filter((term) => has(titleWords, term)
    || has(questionWords, term) || has(answerWords, term));
  const need = terms.length === 1 ? 1 : Math.min(2, terms.length);
  const titleHits = terms.filter((term) => has(titleWords, term)).length;
  const questionHits = terms.filter((term) => has(questionWords, term)).length;
  const answerHits = terms.filter((term) => has(answerWords, term)).length;
  const proximity = (words) => {
    const positions = [];
    for (const term of terms) {
      const at = words.findIndex((word) => word === term);
      if (at >= 0) positions.push(at);
    }
    return positions.length >= need ? Math.max(...positions) - Math.min(...positions) + 1 : Infinity;
  };
  const titleWindow = proximity(titleWords);
  const questionWindow = proximity(questionWords);
  const directlyFramed = titleWindow <= 12 || questionWindow <= 32;
  return {
    // Answer-only coincidence is not answerability. A result must frame this topic in
    // its own title or published question, with the core terms reasonably close.
    accepted: matched.length >= need && directlyFramed,
    score: titleHits * 9 + questionHits * 5 + answerHits * 2 + matched.length
      + (titleWindow <= 8 ? 18 : titleWindow <= 12 ? 8 : 0)
      + (questionWindow <= 20 ? 5 : 0),
    matched,
  };
}

function normalizeRecord(record, context) {
  if (!record || typeof record !== 'object') return null;
  const scholar = FATWA_SCHOLARS.find((entry) => entry.id === String(record?.scholar?.id || ''));
  if (!scholar || !/^[-a-z0-9_]+$/u.test(scholar.id)) return null;
  const url = expectedHost(record, scholar);
  const title = cleanText(record.title, 180);
  const answer = cleanText(record?.content?.answer || record?.content?.answerExcerpt);
  const question = cleanText(record?.content?.question || record?.content?.questionExcerpt, 1600);
  if (!url || !title || !answer) return null;
  const relevance = topicalScore(record, context);
  if (!relevance.accepted) return null;
  const actualMode = String(record?.content?.type || 'question_answer');
  const contentMode = actualMode === 'auto_transcript_official_video'
    ? 'transcript_official_video'
    : 'written_fatwa';
  return Object.freeze({
    id: `fatwa:${String(record.uid || `${scholar.id}:${record.id}`)}`,
    kind: 'fatwa_service',
    title,
    url,
    publisher: scholar.name,
    authorityId: scholar.canonicalId,
    scholarId: scholar.id,
    directAttribution: true,
    contentMode,
    actualContentType: actualMode,
    question,
    supportText: answer,
    passage: [question ? `السؤال المنشور: ${question}` : '', `النص المنشور: ${answer}`].filter(Boolean).join('\n'),
    score: relevance.score - (contentMode === 'transcript_official_video' ? 3 : 0),
    raw: record,
  });
}

export async function searchFatwas(context, options = {}) {
  const verification = await verifyFatwaService(options);
  const named = resolveFatwaScholar(
    context?.resolvedScholar?.display || context?.currentQuestion || '',
    context?.resolvedScholar?.id || '',
  );
  const queries = searchQueriesFor(context);
  if (!queries.length) return { verification, query: '', queries: [], scholar: named, records: [], calls: 0, rejected: 0 };
  const payloads = await Promise.all(queries.map(async (query) => {
    const url = new URL('/api/v1/fatwas/search', FATWA_BASE);
    url.searchParams.set('q', query);
    url.searchParams.set('scholar', named ? named.id : 'all');
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', String(MAX_RESULTS));
    url.searchParams.set('view', 'full');
    return readJson(url.pathname + url.search, options);
  }));
  const raw = payloads.flatMap((payload) => Array.isArray(payload.results) ? payload.results : []);
  // Every variant is admitted against the one resolved topic, not against its own looser words.
  const relevanceContext = { ...context, resolvedTopic: context?.resolvedTopic || queries[0] };
  const normalized = raw.map((item) => normalizeRecord(item, relevanceContext)).filter(Boolean)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    verification,
    query: queries[0],
    queries,
    scholar: named,
    records: normalized.slice(0, 4),
    calls: queries.length,
    rejected: raw.length - normalized.length,
    totalMatches: payloads.reduce((sum, payload) => sum + Number(payload?.pagination?.total || 0), 0),
  };
}

export const __fatwaTest = Object.freeze({ cleanText, normalizeRecord, searchQueriesFor, searchQueryFor, topicalScore });
