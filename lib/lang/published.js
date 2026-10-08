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
    case 'quran-fr.json.gz': return fs.readFileSync(new URL('../data/translations/quran-fr.json.gz', import.meta.url));
    case 'hadith-fr.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-fr.json.gz', import.meta.url));
    case 'terms-fr.json.gz': return fs.readFileSync(new URL('../data/translations/terms-fr.json.gz', import.meta.url));
    case 'hadith-id.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-id.json.gz', import.meta.url));
    case 'quran-id.json.gz': return fs.readFileSync(new URL('../data/translations/quran-id.json.gz', import.meta.url));
    case 'terms-id.json.gz': return fs.readFileSync(new URL('../data/translations/terms-id.json.gz', import.meta.url));
    case 'hadith-ur.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ur.json.gz', import.meta.url));
    case 'quran-ur.json.gz': return fs.readFileSync(new URL('../data/translations/quran-ur.json.gz', import.meta.url));
    case 'terms-ur.json.gz': return fs.readFileSync(new URL('../data/translations/terms-ur.json.gz', import.meta.url));
    case 'hadith-bn.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-bn.json.gz', import.meta.url));
    case 'terms-bn.json.gz': return fs.readFileSync(new URL('../data/translations/terms-bn.json.gz', import.meta.url));
    case 'hadith-tr.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-tr.json.gz', import.meta.url));
    case 'quran-tr.json.gz': return fs.readFileSync(new URL('../data/translations/quran-tr.json.gz', import.meta.url));
    case 'terms-tr.json.gz': return fs.readFileSync(new URL('../data/translations/terms-tr.json.gz', import.meta.url));
    case 'hadith-ha.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ha.json.gz', import.meta.url));
    case 'quran-ha.json.gz': return fs.readFileSync(new URL('../data/translations/quran-ha.json.gz', import.meta.url));
    case 'hadith-ms.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ms.json.gz', import.meta.url));
    case 'hadith-sw.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-sw.json.gz', import.meta.url));
    case 'quran-sw.json.gz': return fs.readFileSync(new URL('../data/translations/quran-sw.json.gz', import.meta.url));
    case 'hadith-ru.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ru.json.gz', import.meta.url));
    case 'terms-ru.json.gz': return fs.readFileSync(new URL('../data/translations/terms-ru.json.gz', import.meta.url));
    case 'hadith-zh.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-zh.json.gz', import.meta.url));
    case 'quran-zh.json.gz': return fs.readFileSync(new URL('../data/translations/quran-zh.json.gz', import.meta.url));
    case 'terms-zh.json.gz': return fs.readFileSync(new URL('../data/translations/terms-zh.json.gz', import.meta.url));
    case 'hadith-es.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-es.json.gz', import.meta.url));
    case 'quran-es.json.gz': return fs.readFileSync(new URL('../data/translations/quran-es.json.gz', import.meta.url));
    case 'terms-es.json.gz': return fs.readFileSync(new URL('../data/translations/terms-es.json.gz', import.meta.url));
    case 'hadith-pt.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-pt.json.gz', import.meta.url));
    case 'quran-pt.json.gz': return fs.readFileSync(new URL('../data/translations/quran-pt.json.gz', import.meta.url));
    case 'terms-pt.json.gz': return fs.readFileSync(new URL('../data/translations/terms-pt.json.gz', import.meta.url));
    case 'hadith-de.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-de.json.gz', import.meta.url));
    case 'quran-de.json.gz': return fs.readFileSync(new URL('../data/translations/quran-de.json.gz', import.meta.url));
    case 'hadith-hi.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-hi.json.gz', import.meta.url));
    case 'quran-hi.json.gz': return fs.readFileSync(new URL('../data/translations/quran-hi.json.gz', import.meta.url));
    case 'terms-hi.json.gz': return fs.readFileSync(new URL('../data/translations/terms-hi.json.gz', import.meta.url));
    case 'hadith-so.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-so.json.gz', import.meta.url));
    case 'quran-so.json.gz': return fs.readFileSync(new URL('../data/translations/quran-so.json.gz', import.meta.url));
    case 'hadith-ps.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ps.json.gz', import.meta.url));
    case 'quran-ps.json.gz': return fs.readFileSync(new URL('../data/translations/quran-ps.json.gz', import.meta.url));
    case 'hadith-ku.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ku.json.gz', import.meta.url));
    case 'quran-ku.json.gz': return fs.readFileSync(new URL('../data/translations/quran-ku.json.gz', import.meta.url));
    case 'hadith-uz.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-uz.json.gz', import.meta.url));
    case 'quran-uz.json.gz': return fs.readFileSync(new URL('../data/translations/quran-uz.json.gz', import.meta.url));
    case 'hadith-am.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-am.json.gz', import.meta.url));
    case 'quran-am.json.gz': return fs.readFileSync(new URL('../data/translations/quran-am.json.gz', import.meta.url));
    case 'hadith-ta.json.gz': return fs.readFileSync(new URL('../data/translations/hadith-ta.json.gz', import.meta.url));
    case 'quran-ta.json.gz': return fs.readFileSync(new URL('../data/translations/quran-ta.json.gz', import.meta.url));
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

/** Every word of `w` occurs in `hay` in the same order, no more than two hay words skipped between two consecutive ones. */
export function inOrder(w, hay) { return orderedMatch(w, hay, 0) > 0; }

/**
 * How many words of `w` occur in `hay` in the same order (no more than two hay words skipped between two consecutive ones), when at most `maxSkip`
 * words of `w` may be left out (a word the writer swapped or added); 0 when the quotation does not fit. (H2, amendment 8: a hadith card that
 * says «رسول الله» where the published text has «عبده ورسوله» got no translation.)
 */
export function orderedMatch(w, hay, maxSkip = 0, span = null) {
  const h = Array.isArray(hay) ? hay : String(hay).split(' '); let pos = -1; let left = maxSkip; let matched = 0;
  for (let k = 0; k < w.length; k++) {
    let at = -1; const lim = pos < 0 ? h.length : Math.min(h.length, pos + 4);
    for (let i = pos + 1; i < lim; i++) if (h[i] === w[k]) { at = i; break; }
    if (at < 0) { if (left > 0) { left--; continue; } return 0; }
    pos = at; matched++; if (span) { if (span[0] === undefined) span[0] = at; span[1] = at; }
  }
  return matched;
}

let hadithIdx = null;
function hadithRows(lang) {
  const row = langRow(lang); const db = row && row.hadith ? loadGz(row.hadith) : null; if (!db) return null;
  if (!hadithIdx) hadithIdx = new Map();
  if (!hadithIdx.has(lang)) hadithIdx.set(lang, { meta: db.meta, rows: db.rows.map((r) => ({ id: r[0], n: foldArabic(r[1]), w: null, text: r[2], attribution: r[3], grade: r[4] })) });
  return hadithIdx.get(lang);
}
/** The published hadith translation whose Arabic text contains this quotation (≥ 5 words), or null. */
export function findHadith(lang, arabic) {
  const q = foldArabic(arabic); if (q.split(' ').length < 5) return null;
  const db = hadithRows(lang); if (!db) return null;
  let best = null; for (const r of db.rows) if (r.n.includes(q) && (!best || r.n.length < best.n.length)) best = r;
  // A writer quotes a hadith from memory and drops or swaps a word (measured: «يا أبا المنذر أي آية من كتاب الله معك أعظم» for «يا أبا المنذر أتدري أي آية ...»,
  // so the hadith that IS in the published set was printed with no translation). A quotation of eight words or more whose words all occur IN ORDER in one
  // hadith, with no more than two words missing between two of them, is that hadith: the same coverage rule below still applies.
  // H2 (amendment 8): such a quotation may also leave out up to three of its own words (at most a quarter of them: a word swapped or added, «رسول الله» for «عبده ورسوله»).
  // When more than one hadith passes, the one that matches the most quotation words is taken; when hadiths with DIFFERENT Arabic texts tie, no translation is shown.
  if (!best && q.split(' ').length >= 8) {
    const w = q.split(' '); const maxSkip = Math.min(3, Math.floor(w.length * 0.25)); let top = 0; let tops = [];
    for (const r of db.rows) { const m = orderedMatch(w, r.w || (r.w = r.n.split(' ')), maxSkip); if (!m) continue; if (m > top) { top = m; tops = [r]; } else if (m === top) tops.push(r); }
    // hadiths with different Arabic texts that tie are told apart by the words the quotation actually matched: the same run of words in all of them (two chains of narration
    // for one wording: 66512 and 65000) is one wording, and the shortest text is shown; a different run in any of them is a real tie, and no translation is shown
    if (new Set(tops.map((r) => r.n)).size > 1) {
      const runs = new Set(tops.map((r) => { const sp = []; orderedMatch(w, r.w, maxSkip, sp); return r.w.slice(sp[0], sp[1] + 1).join(' '); }));
      if (runs.size > 1) return null;
    }
    for (const r of tops) if (!best || r.n.length < best.n.length) best = r;
  }
  if (!best) return null;
  // A short phrase that merely OCCURS inside a long hadith (a verse the hadith quotes, a stock phrase) is not that hadith: the quotation must
  // be a real part of it (a quarter of its text) or long enough to be a sentence of its own (eight words). Measured: four words of the
  // Throne Verse printed beside the whole hadith of Ubayy that quotes it.
  const coverage = q.length / Math.max(1, best.n.length);
  if (!(coverage >= 0.25 || q.split(' ').length >= 8)) return null;
  return { id: best.id, text: best.text, attribution: best.attribution, grade: best.grade, meta: db.meta, partial: coverage < 0.7 };
}

const DEF_REPEAT_MAX = 5;
let termIdx = null;
/** Published term meanings for the Arabic terms that occur in `arabicText`: [{ar,en,definition}] (≤ max). */
export function glossaryFor(lang, arabicText, max = 20) {
  const row = langRow(lang); const db = row && row.terms ? loadGz(row.terms) : null; if (!db) return [];
  if (!termIdx) termIdx = new Map();
  if (!termIdx.has(lang)) {
    // A stored `definition` that is the SAME string on many terms is not a definition of any of them (measured: 102 of 2370 English rows carry the one word
    // "Tījāniyyah", and the translator, handed it as the meaning of «إقامة», wrote it into a suggestion line). The data is not edited here; the string is not passed on.
    const seen = new Map(); for (const r of db.rows) { const d = String(r[3] || '').trim(); seen.set(d, (seen.get(d) || 0) + 1); }
    termIdx.set(lang, db.rows.map((r) => ({ en: r[1], ar: r[2], n: foldArabic(r[2]), def: (seen.get(String(r[3] || '').trim()) || 0) >= DEF_REPEAT_MAX ? '' : r[3] })).filter((t) => t.n.length >= 3));
  }
  const text = ' ' + foldArabic(arabicText) + ' ';
  const hits = termIdx.get(lang).filter((t) => text.includes(' ' + t.n + ' ')).sort((a, b) => b.n.length - a.n.length);
  return hits.slice(0, max).map((t) => ({ ar: t.ar, en: t.en, definition: String(t.def || '').slice(0, 160) }));
}

export function publishedMeta(lang) {
  const row = langRow(lang); if (!row) return null;
  const q = row.quran ? loadGz(row.quran.file) : null; const h = row.hadith ? loadGz(row.hadith) : null; const t = row.terms ? loadGz(row.terms) : null;
  return { quran: q && q.meta, hadith: h && h.meta, terms: t && t.meta };
}
