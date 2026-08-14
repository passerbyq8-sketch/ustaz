// lib/encyclopedia.js
// In-process search over the one religious corpus shipped with this repository: the
// 3070-record Kuwaiti Fiqh Encyclopedia artifact. The artifact is loaded and indexed lazily,
// once per warm process. This module opens no socket and has no public-source fallback.
//
// The stored-evidence path uses `searchStoredCorpus()` for every answer depth. The older
// `retrieveEncyclopedia()` export remains as a compatibility wrapper for code outside that path;
// both exports read the same immutable records and neither can create a source.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORED_RECORD_MARK = Symbol('stored-fiqh-record');

export function isStoredCorpusRecord(record) {
  return !!(record && record[STORED_RECORD_MARK] === true);
}

// Match the normalisation used by the stored `search` field.
function normalizeArabic(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTerm(term) {
  return normalizeArabic(term).toLowerCase();
}

function tokensOf(value) {
  return normalizeTerm(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean);
}

function titleKey(token) {
  let value = String(token || '');
  value = value.replace(/^(?:وال|فال|بال|كال|لل|ال)/u, '');
  value = value.replace(/^(?:و|ف|ب|ك|ل)/u, '');
  for (const suffix of ['هما', 'هم', 'هن', 'كم', 'نا', 'ات', 'ين', 'ون', 'ان', 'ه', 'ي', 'ك']) {
    if (value.length > suffix.length + 2 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value;
}

function resolveGzPath() {
  const candidates = [
    join(process.cwd(), 'lib', 'data', 'fiqh-search.json.gz'),
    join(HERE, 'data', 'fiqh-search.json.gz'),
  ];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return candidates[0];
}

let indexPromise = null;

async function buildIndex() {
  const { default: MiniSearch } = await import('minisearch');
  const records = JSON.parse(gunzipSync(readFileSync(resolveGzPath())).toString('utf8'));
  if (!Array.isArray(records)) throw new Error('stored corpus is not an array');
  const mini = new MiniSearch({
    idField: 'id',
    fields: ['search', 'term'],
    storeFields: ['term', 'part', 'snippet', 'search'],
    processTerm: (term) => normalizeTerm(term) || null,
  });
  mini.addAll(records);
  const documentFrequency = new Map();
  for (const record of records) {
    for (const token of new Set(tokensOf(record.search))) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }
  return { mini, recordCount: records.length, documentFrequency };
}

function getIndex() {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

/**
 * Search only the stored artifact and return record-shaped evidence.
 *
 * Relevance is based on how many distinct query tokens occur in the stored record before the
 * MiniSearch score is considered. This prevents one high-frequency word from turning an
 * unrelated article into evidence. The best record is always eligible; additional records must
 * also have a title related to the query, so a card cannot be padded with incidental hits.
 */
export async function searchStoredCorpus(query, { limit = 3 } = {}) {
  const queryTokens = [...new Set(tokensOf(query))].slice(0, 24);
  if (!queryTokens.length) return { records: [], queryTokens: [], recordCount: 0 };

  let store;
  try {
    store = await getIndex();
  } catch (error) {
    console.warn('[encyclopedia] index unavailable:', error.message);
    return { records: [], queryTokens, recordCount: 0 };
  }

  let hits;
  try {
    hits = store.mini.search(queryTokens.join(' '), {
      prefix: false,
      fuzzy: false,
      combineWith: 'OR',
      boost: { term: 4 },
    }).slice(0, 80);
  } catch (error) {
    console.warn('[encyclopedia] search failed:', error.message);
    return { records: [], queryTokens, recordCount: store.recordCount };
  }
  if (!hits.length) return { records: [], queryTokens, recordCount: store.recordCount };

  const idf = (token) => Math.log(1 + (store.recordCount + 1) / ((store.documentFrequency.get(token) || 0) + 1));
  const ranked = hits.map((hit) => {
    const recordTokens = new Set(tokensOf(hit.search));
    const matchedTokens = queryTokens.filter((token) => recordTokens.has(token));
    const recordTitleKeys = new Set(tokensOf(hit.term).map(titleKey).filter((token) => token.length >= 3));
    const titleMatchedTokens = queryTokens.filter((token) => recordTitleKeys.has(titleKey(token)));
    const titleMatches = [...new Set(titleMatchedTokens.map(titleKey))];
    const matchedWeight = matchedTokens.reduce((total, token) => total + idf(token), 0);
    const titleWeight = titleMatchedTokens.reduce((total, token) => total + idf(token), 0);
    const record = {
      id: String(hit.id),
      term: String(hit.term || ''),
      part: Number(hit.part),
      snippet: String(hit.snippet || ''),
      text: String(hit.search || ''),
      score: Number(hit.score) || 0,
      relevanceScore: matchedWeight + (2 * titleWeight),
      matchedTokens,
      titleMatches,
      sourceType: 'stored_fiqh_encyclopedia_record',
      publisher: 'الموسوعة الفقهية الكويتية',
      attributedTo: null,
    };
    Object.defineProperty(record, STORED_RECORD_MARK, { value: true });
    return record;
  }).sort((a, b) => (
    b.matchedTokens.length - a.matchedTokens.length
    || b.titleMatches.length - a.titleMatches.length
    || b.relevanceScore - a.relevanceScore
    || b.score - a.score
    || a.id.localeCompare(b.id)
  ));

  const tokenCount = queryTokens.length;
  const minimumCoverage = tokenCount <= 2 ? 1 : Math.min(3, Math.ceil(tokenCount * 0.6));
  const eligible = ranked.filter((candidate) => (
    candidate.matchedTokens.length >= minimumCoverage
    || (candidate.titleMatches.length > 0 && candidate.matchedTokens.length > 0)
  ));
  const best = eligible[0];
  if (!best) {
    return { records: [], queryTokens, recordCount: store.recordCount };
  }

  const cap = Math.max(1, Math.min(3, Number.isFinite(limit) ? Math.floor(limit) : 3));
  const records = [best];
  for (const candidate of eligible.slice(1)) {
    if (records.length >= cap) break;
    if (!candidate.titleMatches.length) continue;
    records.push(candidate);
  }
  return { records, queryTokens, recordCount: store.recordCount };
}

// Compatibility shape used by the pre-cleanup code. It still reads only stored records.
export async function retrieveEncyclopedia(query, { limit = 3 } = {}) {
  const found = await searchStoredCorpus(query, { limit });
  if (!found.records.length) return { text: '', sources: [] };
  const divider = '\n' + '─'.repeat(40) + '\n';
  return {
    text: found.records
      .map((record) => `「الموسوعة الفقهية — ${record.term}」\n${record.snippet}`)
      .join(divider),
    sources: found.records.map((record) => ({
      id: record.id,
      term: record.term,
      part: record.part,
    })),
  };
}
