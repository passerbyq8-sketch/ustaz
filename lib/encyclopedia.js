// lib/encyclopedia.js
// In-process search over the Kuwaiti Fiqh Encyclopedia (3070 records). Loads a lean,
// gzipped artifact (lib/data/fiqh-search.json.gz, built offline from the 101MB source)
// and builds a MiniSearch index ONCE, lazily, on the first call — so nothing loads
// unless scholar-mode retrieval actually runs. Lives OUTSIDE api/ so Vercel does not
// route it as a function; api/ask.js imports it in the scholar branch only.
//
// GOVERNANCE (khilaf-policy §3/§6/§8): this module is a mechanism only. The caller
// (api/ask.js) is responsible for invoking it ONLY in scholar mode (depth==='scholar')
// AND adult band. It must never be reached for the ordinary user or under-18.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url)); // .../lib

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
    storeFields: ['term', 'part', 'snippet'],
    processTerm: (term) => normalizeTerm(term) || null,
  });
  mini.addAll(records);
  return mini;
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
  const norm = normalizeArabic(query || '');
  if (!norm) return { text: '', sources: [] };

  let mini;
  try {
    mini = await getIndex();
  } catch (e) {
    console.warn('[encyclopedia] index unavailable:', e.message);
    return { text: '', sources: [] };
  }

  let hits;
  try {
    hits = mini.search(norm, { prefix: true, fuzzy: 0.2, boost: { term: 3 } }).slice(0, limit);
  } catch (e) {
    console.warn('[encyclopedia] search failed:', e.message);
    return { text: '', sources: [] };
  }
  if (!hits.length) return { text: '', sources: [] };

  const divider = '\n' + '─'.repeat(40) + '\n';
  const text = hits.map((h) => `「الموسوعة الفقهية — ${h.term}」\n${h.snippet}`).join(divider);
  return { text, sources: hits.map((h) => ({ id: h.id, term: h.term, part: h.part })) };
}
