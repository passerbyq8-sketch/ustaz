// lib/lang/published.js -- THE PUBLISHED TRANSLATIONS (item 74, rulings h3 and h5).
//
// Verses, hadiths and glossary terms are never translated by a model. They are LOOKED UP in the three
// encyclopedias' published snapshots (lib/data/translations/*.json.gz, built by tools/build-translations.mjs)
// and shown UNMODIFIED with their publisher, source and version number -- the published conditions. A
// quotation with no published translation returns null here, and the caller then leaves it Arabic with no
// translation label (the answer's own prose explains the meaning).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { langRow } from './table.js';

// THE FILES ARE NAMED WHERE THEY ARE READ. The serverless bundler follows fs.readFileSync(new URL('<literal>', import.meta.url))
// when the call is written out in full, and follows nothing that goes through a variable or a function that returns the
// URL -- a data file reached that way is simply not in the deployed function (measured on the first preview: every
// published translation silently absent). vercel.json, a platform file, is not touched for this.
const cache = new Map();
function readData(name) {
  switch (name) {
    case 'quran-en.json.gz': return fs.readFileSync(new URL('../data/translations/quran-en.json.gz', import.meta.url));
    case 'hadith-en.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-en.json.gz', import.meta.url));
    case 'terms-en.json.gz': return fs.readFileSync(new URL('../data/translations/terms-en.json.gz', import.meta.url));
    case 'quran-fa.json.gz': return fs.readFileSync(new URL('../data/translations/quran-fa.json.gz', import.meta.url));
    case 'hadith-fa.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-fa.json.gz', import.meta.url));
    case 'terms-fa.json.gz': return fs.readFileSync(new URL('../data/translations/terms-fa.json.gz', import.meta.url));
    default: return null;
  }
}
/** Names of the data files that could not be read in this process: the gate logs them, so an absent file is never silent. */
export const MISSING_DATA = new Set();
function loadGz(name) {
  if (cache.has(name)) return cache.get(name);
  let v = null;
  try { v = JSON.parse(zlib.gunzipSync(readData(name)).toString('utf8')); } catch (e) { v = null; MISSING_DATA.add(name); }
  cache.set(name, v);
  return v;
}

/** Arabic letters only, one spelling per letter: the key both the quotation and the stored text are reduced to. */
export function foldArabic(s) {
  return String(s == null ? '' : s)
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱآأإ]/g, 'ا')
    .replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك').replace(/ة/g, 'ه')
    .replace(/[^ء-ي ]/g, ' ').replace(/\s+/g, ' ').trim();
}

let quranIndex = null;
function quranAr() {
  if (quranIndex) return quranIndex;
  let raw = {}; try { raw = JSON.parse(fs.readFileSync(new URL('../../quran-uthmani.json', import.meta.url), 'utf8')); } catch (e) { raw = {}; MISSING_DATA.add('quran-uthmani.json'); }
  quranIndex = Object.keys(raw).map((k) => { const [s, a] = k.split(':').map(Number); return { s, a, n: foldArabic(raw[k]) }; });
  return quranIndex;
}

/** The published Quran translation of one or more consecutive verses, or null. */
export function quranTranslation(lang, sura, from, to) {
  const row = langRow(lang); const db = row && row.quran ? loadGz(row.quran.file) : null;
  const S = db && db.suras[sura - 1]; if (!S) return null;
  const a = Math.max(1, from | 0), b = Math.max(a, (to || from) | 0); const parts = []; const notes = [];
  for (let i = a; i <= b; i++) { const r = S[i - 1]; if (!r) return null; parts.push(r[0]); if (r[1]) notes.push(r[1]); }
  return { sura, from: a, to: b, text: parts.join(' '), footnotes: notes.join('\n'), meta: db.meta };
}

/** Which verse(s) does an Arabic quotation come from? [{s,from,to}] or null. Needs ≥ 3 words. */
export function findQuranRange(arabic) {
  const q = foldArabic(arabic); if (q.split(' ').length < 3) return null;
  const idx = quranAr(); if (!idx.length) return null;
  const inside = idx.filter((v) => v.n.length >= 6 && q.includes(v.n));      // whole verses inside the quotation
  if (inside.length) {
    const first = inside[0]; let last = first;
    for (const v of inside.slice(1)) if (v.s === last.s && v.a === last.a + 1) last = v; else break;
    return { s: first.s, from: first.a, to: last.a };
  }
  const part = idx.filter((v) => v.n.includes(q));                           // a part of one verse
  return part.length === 1 ? { s: part[0].s, from: part[0].a, to: part[0].a, partial: true } : null;
}

let hadithIdx = null;
function hadithRows(lang) {
  const row = langRow(lang); const db = row && row.hadith ? loadGz(row.hadith) : null; if (!db) return null;
  if (!hadithIdx) hadithIdx = new Map();
  if (!hadithIdx.has(lang)) hadithIdx.set(lang, { meta: db.meta, rows: db.rows.map((r) => ({ id: r[0], n: foldArabic(r[1]), text: r[2], attribution: r[3], grade: r[4] })) });
  return hadithIdx.get(lang);
}
/** The published hadith translation whose Arabic text contains this quotation (≥ 5 words), or null. */
export function findHadith(lang, arabic) {
  const q = foldArabic(arabic); if (q.split(' ').length < 5) return null;
  const db = hadithRows(lang); if (!db) return null;
  let best = null; for (const r of db.rows) if (r.n.includes(q) && (!best || r.n.length < best.n.length)) best = r;
  if (!best) return null;
  // A short phrase that merely OCCURS inside a long hadith (a verse the hadith quotes, a stock phrase) is not that hadith: the quotation must
  // be a real part of it (a quarter of its text) or long enough to be a sentence of its own (eight words). Measured: four words of the
  // Throne Verse printed beside the whole hadith of Ubayy that quotes it.
  const coverage = q.length / Math.max(1, best.n.length);
  if (!(coverage >= 0.25 || q.split(' ').length >= 8)) return null;
  return { id: best.id, text: best.text, attribution: best.attribution, grade: best.grade, meta: db.meta, partial: coverage < 0.7 };
}

let termIdx = null;
/** Published term meanings for the Arabic terms that occur in `arabicText`: [{ar,en,definition}] (≤ max). */
export function glossaryFor(lang, arabicText, max = 20) {
  const row = langRow(lang); const db = row && row.terms ? loadGz(row.terms) : null; if (!db) return [];
  if (!termIdx) termIdx = new Map();
  if (!termIdx.has(lang)) termIdx.set(lang, db.rows.map((r) => ({ en: r[1], ar: r[2], n: foldArabic(r[2]), def: r[3] })).filter((t) => t.n.length >= 3));
  const text = ' ' + foldArabic(arabicText) + ' ';
  const hits = termIdx.get(lang).filter((t) => text.includes(' ' + t.n + ' ')).sort((a, b) => b.n.length - a.n.length);
  return hits.slice(0, max).map((t) => ({ ar: t.ar, en: t.en, definition: String(t.def || '').slice(0, 160) }));
}

export function publishedMeta(lang) {
  const row = langRow(lang); if (!row) return null;
  const q = row.quran ? loadGz(row.quran.file) : null; const h = row.hadith ? loadGz(row.hadith) : null; const t = row.terms ? loadGz(row.terms) : null;
  return { quran: q && q.meta, hadith: h && h.meta, terms: t && t.meta };
}
