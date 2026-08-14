// lib/encyclopedia.js
// In-process candidate search over the Kuwaiti Fiqh Encyclopedia (3070 records).
// The artifact is immutable and local. This module may rank candidates; it never declares
// one relevant evidence. That decision belongs to lib/stored-deen.js and happens before a
// record is exposed to an answer model or a source card.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url)); // .../lib
const STORED_RECORD_MARK = Symbol('ustaz.stored-fiqh-record');

export function isStoredCorpusRecord(record) {
  return !!(record && record[STORED_RECORD_MARK] === true);
}

// Normalize Arabic to EXACTLY match how the source `search` field was normalized:
// strip harakat + superscript-alef + tatweel; fold أ إ آ ٱ -> ا; ة -> ه; ى -> ي.
// Hamza forms (ء ئ ؤ) are PRESERVED, matching the source. Applied identically to the
// incoming query so query tokens line up with indexed tokens (silent-mismatch guard).
function normalizeArabic(s) {
  return (s || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')       // ً ٌ ٍ َ ُ ِ ّ ْ + ٰ + ـ
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')  // أ إ آ ٱ -> ا
    .replace(/\u0629/g, '\u0647')                      // ة -> ه
    .replace(/\u0649/g, '\u064A')                      // ى -> ي
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeTerm(term) {
  return normalizeArabic(String(term)).toLowerCase();
}

function resolveGzPath() {
  const candidates = [
    join(process.cwd(), 'lib', 'data', 'fiqh-search.json.gz'), // Vercel (includeFiles) + local dev
    join(HERE, 'data', 'fiqh-search.json.gz'),                 // module-relative fallback
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return candidates[0]; // let read throw a clear ENOENT if truly absent
}

let _indexPromise = null;

async function buildIndex() {
  const { default: MiniSearch } = await import('minisearch');
  const gzPath = resolveGzPath();
  const records = JSON.parse(gunzipSync(readFileSync(gzPath)).toString('utf8'));
  const mini = new MiniSearch({
    idField: 'id',
    fields: ['search', 'term'],
    storeFields: ['term', 'part', 'snippet', 'search'],
    processTerm: (term) => normalizeTerm(term) || null,
  });
  mini.addAll(records);
  return { mini, recordCount: records.length };
}

function getIndex() {
  if (!_indexPromise) {
    _indexPromise = buildIndex().catch((e) => {
      _indexPromise = null; // allow a retry on the next call after a failed build
      throw e;
    });
  }
  return _indexPromise;
}

// Public API. Returns { text, sources }. NEVER throws: on any failure (missing artifact
// on Vercel, parse error, search error) it degrades to empty so the caller keeps the
// web-only result and the model is never handed fabricated context.
export async function retrieveEncyclopedia(query, { limit = 3 } = {}) {
  const found = await searchStoredCorpus(query, { limit });
  if (!found.records.length) return { text: '', sources: [] };

  const divider = '\n' + '─'.repeat(40) + '\n';
  const text = found.records
    .map((record) => `「الموسوعة الفقهية — ${record.term}」\n${record.snippet}`)
    .join(divider);
  return {
    text,
    sources: found.records.map((record) => ({
      id: record.id,
      term: record.term,
      part: record.part,
    })),
  };
}

/**
 * Return authentic local candidates only. MiniSearch scores, fuzzy matches and rank are not
 * evidence and are deliberately absent from the acceptance contract. The caller must run every
 * candidate through topical relevance/answerability before constructing an Evidence Pack.
 */
export async function searchStoredCorpus(query, { limit = 18 } = {}) {
  const norm = normalizeArabic(query || '');
  if (!norm) return { records: [], queryTokens: [], recordCount: 0 };

  let store;
  try {
    store = await getIndex();
  } catch (e) {
    console.warn('[encyclopedia] index unavailable:', e.message);
    return { records: [], queryTokens: norm.split(/\s+/u).filter(Boolean), recordCount: 0 };
  }

  let hits;
  try {
    const cap = Math.max(1, Math.min(40, Number.isFinite(limit) ? Math.floor(limit) : 18));
    hits = store.mini.search(norm, {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR',
      boost: { term: 4 },
    }).slice(0, cap);
  } catch (e) {
    console.warn('[encyclopedia] search failed:', e.message);
    return { records: [], queryTokens: norm.split(/\s+/u).filter(Boolean), recordCount: store.recordCount };
  }
  const records = hits.map((hit) => {
    const record = {
      id: String(hit.id || ''),
      term: String(hit.term || ''),
      part: Number(hit.part),
      snippet: String(hit.snippet || ''),
      text: String(hit.search || ''),
      sourceType: 'stored_fiqh_encyclopedia_record',
      publisher: 'الموسوعة الفقهية الكويتية',
      attributedTo: null,
    };
    Object.defineProperty(record, STORED_RECORD_MARK, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return Object.freeze(record);
  });
  return {
    records,
    queryTokens: norm.split(/\s+/u).filter(Boolean),
    recordCount: store.recordCount,
  };
}
