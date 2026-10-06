// lib/lang/answer.js -- THE ARABIC ANSWER, CARRIED INTO THE QUESTION'S LANGUAGE (item 74, rulings h3 h4 h5 h8).
//
// Input: the FINISHED Arabic answer -- what came out of the brain's reviewers and filters (h4: we translate
// what survived them, never what came before). Output: the same answer in the reader's language, built so that
//   * every verse, hadith and quotation is cut OUT before the model sees the text and put back after it, byte
//     for byte (h3) -- the model never translates and never touches them;
//   * the published translation (lib/lang/published.js) is printed beside a quotation that has one, and
//     nothing is printed beside one that has none (no «Translation» label without a published source);
//   * the number of verses and hadiths in the output equals the number in the Arabic (h5) -- a unit whose
//     markers do not come back intact is retried once and then delivered ARABIC rather than wrong;
//   * the tags the client renders (<verse> <hadith> <book> <source> <steps> <suggestions> ...) keep their shape.
// Paragraph batches are translated in parallel and EMITTED IN ORDER as each one settles (h8).
import { callTranslator, parseStringArray, ANSWER_TO_ENGLISH_SYSTEM, ANSWER_TO_ENGLISH_NO_MARKERS_SYSTEM } from './model.js';
import { findQuranRange, quranTranslation, findHadith, glossaryFor, foldArabic } from './published.js';
import { langRow } from './table.js';

const TAGS = ['verse', 'surah', 'hadith', 'steps', 'suggestions', 'board', 'document', 'source', 'dhikr', 'worship', 'book'];
const TAG_RE = new RegExp('<(' + TAGS.join('|') + ')([^>]*)>([\\s\\S]*?)</\\1>', 'g');
const ARABIC_LETTER = /[ء-ي]/;
const BATCH_CHARS = 2400;
const FIRST_BATCH_CHARS = 700;   // the first batch is small so the reader sees English as early as the model can write one paragraph (h8)
const MATN_MAX = 4000;
const MARKER = /\[\[[QAI]\d+\]\]/g;
// The server-owned block that carries a scholar's published text (lib/full-fatwa.js HEADING_TEXT). It is kept in
// Arabic, verbatim, and its translation rides on the source/book card that follows it as `tb` (no new tag: a guard pins the
// tag registry); with no such card it follows as a labelled paragraph (item 74).
const FATWA_HEAD = /(^|\n)## نص الفتوى[ \t]*\n/;

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const unb64 = (s) => { try { return Buffer.from(String(s || ''), 'base64').toString('utf8'); } catch { return ''; } };
const noQuotes = (s) => String(s).replace(/["'<>]/g, '’').replace(/\s+/g, ' ').trim();
const attr = (attrs, k) => { const m = new RegExp('\\b' + k + '=["\']([^"\']+)["\']').exec(attrs || ''); return m ? m[1] : ''; };

/** @returns {Array<{type:'text',s:string}|{type:'tag',name:string,attrs:string,content:string,raw:string}>} pieces in order */
export function splitAnswer(text) {
  const out = []; let last = 0; let m; TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', s: text.slice(last, m.index) });
    out.push({ type: 'tag', name: m[1], attrs: m[2] || '', content: m[3] || '', raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', s: text.slice(last) });
  return out;
}

/** What the h5 rule counts: verses and hadiths -- tags plus quoted runs in prose. */
export function countSacred(text) {
  const t = String(text || '');
  const tags = (t.match(/<(verse|hadith)\b/g) || []).length;
  const quran = (t.match(/﴿[^﴾]*﴾/g) || []).length;
  const quoted = (t.match(/«[^»]*»/g) || []).filter((q) => foldArabic(q).split(' ').filter(Boolean).length >= 4 && ARABIC_LETTER.test(q)).length;
  return { tags, quran, quoted, total: tags + quran + quoted };
}

function quranLine(lang, range) {
  const tr = range && quranTranslation(lang, range.s, range.from, range.to); if (!tr) return null;
  const ref = tr.sura + ':' + tr.from + (tr.to > tr.from ? '-' + tr.to : '');
  const src = `${langRow(lang).labels.quranBy} ${ref}${range.partial ? ' (the verse in full)' : ''}: ${tr.meta.title}, via ${tr.meta.source}, v${tr.meta.version}`;
  return { text: tr.text, src, notes: tr.footnotes || '', key: 'Q' + ref };
}
function hadithLine(lang, arabic) {
  const h = findHadith(lang, arabic); if (!h) return null;
  return { text: h.text, src: `${langRow(lang).labels.hadithBy}${h.partial ? ' (the hadith in full)' : ''}: ${h.meta.source}${h.grade ? '; grade as published: ' + h.grade : ''}`, key: 'H' + h.id };
}

/** Cut the verbatim quotations out of one paragraph; returns the marked text and the spans to restore. */
function protect(par, counter) {
  const spans = [];
  let s = par.replace(/<incomplete\s*\/>/g, (m) => { const id = 'I' + (++counter.n); spans.push({ id, kind: 'I', text: m }); return `[[${id}]]`; });
  s = s.replace(/﴿([^﴾]+)﴾/g, (m) => { const id = 'Q' + (++counter.n); spans.push({ id, kind: 'Q', text: m }); return `[[${id}]]`; });
  s = s.replace(/«([^»]+)»/g, (m, inner) => {
    if (foldArabic(inner).split(' ').filter(Boolean).length < 4) return m;
    const id = 'A' + (++counter.n); spans.push({ id, kind: 'A', text: m, inner }); return `[[${id}]]`;
  });
  return { s, spans };
}
function restore(lang, s, spans, stats, printed) {
  return s.replace(MARKER, (mk) => {
    const id = mk.slice(2, -2); const sp = spans.find((x) => x.id === id); if (!sp) return mk;
    if (sp.kind === 'I') return sp.text;
    const inner = sp.kind === 'Q' ? sp.text.slice(1, -1) : sp.inner;
    let line = null;
    const range = findQuranRange(inner); if (range) { line = quranLine(lang, range); if (line) stats.quran++; }
    if (!line && sp.kind === 'A') { line = hadithLine(lang, inner); if (line) stats.hadith++; }
    if (!line) { stats.unmatched++; return sp.text; }
    // A published translation is printed ONCE in an answer: a verse quoted in pieces, or a quotation found again further down, does not carry the
    // whole of it each time (measured: the full translation of one verse, with its notes, four times in a row beside four fragments of it).
    if (printed && line.key) { if (printed.has(line.key)) { stats.repeated++; return sp.text; } printed.add(line.key); }
    return `${sp.text} (“${line.text}” — ${line.src}${line.notes ? '. Notes as published: ' + line.notes.replace(/\s*\n\s*/g, ' ') : ''})`;
  });
}
function restoreArabic(s, spans) { return s.replace(MARKER, (mk) => { const sp = spans.find((x) => x.id === mk.slice(2, -2)); return sp ? sp.text : mk; }); }

const sameMarkers = (a, b) => { const x = (a.match(MARKER) || []).sort().join(','); const y = (b.match(MARKER) || []).sort().join(','); return x === y; };
// the scholar's text translated, as the card shows it: no heading marks, no angle brackets, quotations plain (the Arabic holds them once)
const blockText = (t) => String(t).replace(/^\s*#+\s*/, '').replace(/[<>]/g, ' ').replace(/[\u00AB\u00BB\uFD3E\uFD3F]/g, '').trim();
const bulletOf = (l) => (l.match(/^\s*[-•*]\s*/) || [''])[0];

// A translation that still carries its Arabic is not a translation. Measured: on a long paragraph of nine quotations the model gave the
// paragraph back with every marker intact and its Arabic untouched, only adding English glosses beside the terms -- the old checks (markers
// equal, not empty) took it. The Arabic of the markers is not in the string, so what is counted here is Arabic written outside them.
const ARABIC_LEFT_MAX = 12;
const arabicLeft = (t) => (String(t).replace(MARKER, '').match(/[؀-ۿݐ-ݿ]/g) || []).length;
/** One string asked again as its LINES: each non-empty line is one item of one call, and every line must come back whole. */
async function translateLines({ s, system, head, translate }) {
  const lines = String(s).split('\n'); const idx = lines.map((l, i) => (/\S/.test(l) ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return null;     // a single line has nothing to split: the whole-array retry is its retry
  try {
    const r = await translate({ system, user: head + 'INPUT:\n' + JSON.stringify(idx.map((i) => lines[i])), maxTokens: 4096 });
    const arr = r && r.ok ? parseStringArray(r.text, idx.length) : null; if (!arr) return null;
    if (!arr.every((t, k) => sameMarkers(lines[idx[k]], t) && t.trim() && arabicLeft(t) <= ARABIC_LEFT_MAX)) return null;
    const out = lines.slice(); idx.forEach((i, k) => { out[i] = arr[k].replace(/\n/g, ' '); });
    return out.join('\n');
  } catch { return null; }
}

/**
 * ITEM 74 / THE PARALLEL TRANSLATION. While the Arabic answer is still arriving from the brain, every paragraph that is COMPLETE
 * (a blank line follows it) starts to be translated at once, so that when the answer is final its paragraphs are mostly done.
 * NOTHING a speculator produces is ever shown by itself: translateAnswer takes an entry only when the FINAL Arabic paragraph is
 * the identical string, so a paragraph a reviewer or a filter changed, cut or moved is translated again from the final text (h4,
 * h8). A speculator only spends calls; it never decides what the reader sees.
 * @param {{lang:string, translate?:Function, concurrency?:number, maxParagraphs?:number, minChars?:number}} o
 */
export function createSpeculator({ lang, translate = callTranslator, concurrency = 3, maxParagraphs = 10, maxWhole = 6, minChars = 12 }) {
  const counter = { n: 0 };
  const entries = new Map(); const seenAr = []; const skipped = new Map();
  let buf = ''; let at = 0; let running = 0; const waiters = [];
  const slot = async () => { if (running >= concurrency) await new Promise((r) => waiters.push(r)); running++; };
  const free = () => { running--; const w = waiters.shift(); if (w) w(); };
  // `whole` is a scholar's text (the published fatwa block, a book passage): translated as one string with no marker in it, the way translateAnswer does
  const start = (t, whole) => {
    const p = whole ? { s: t, spans: [] } : protect(t, counter);
    const e = { ar: t, s: p.s, spans: p.spans, out: null, promise: null, whole: !!whole };
    const gl = glossaryFor(lang, t); const earlier = seenAr.join('\n');
    const already = gl.filter((g) => earlier.includes(g.ar)); const fresh = gl.filter((g) => !earlier.includes(g.ar));
    const head = (fresh.length ? 'GLOSSARY (Arabic => English meaning):\n' + fresh.map((g) => `${g.ar} => ${g.en}${g.definition ? ' : ' + g.definition : ''}`).join('\n') + '\n' : '')
      + (already.length ? 'ALREADY_EXPLAINED: ' + already.map((g) => g.ar).join(', ') + '\n' : '');
    const withMarkers = !!p.s.match(MARKER);
    const system = withMarkers ? ANSWER_TO_ENGLISH_SYSTEM : ANSWER_TO_ENGLISH_NO_MARKERS_SYSTEM;
    const user = head + 'INPUT:\n' + JSON.stringify([p.s]);
    e.promise = (async () => {
      await slot();
      try {
        for (let attempt = 0; attempt < 2 && e.out == null; attempt++) {
          if (attempt === 1) { const byLines = await translateLines({ s: p.s, system, head, translate }); if (byLines != null) { e.out = byLines; break; } }
          const r = await translate({ system, user, maxTokens: 4096 });
          const arr = r && r.ok ? parseStringArray(r.text, 1) : null;
          if (arr && sameMarkers(p.s, arr[0]) && arr[0].trim() && arabicLeft(arr[0]) <= ARABIC_LEFT_MAX) e.out = arr[0];
        }
      } catch { /* a failed speculation is only a miss */ } finally { free(); }
    })();
    entries.set((whole ? 'W:' : '') + t, e);
  };
  const seen = new Set(); let wholeN = 0;
  const considerWhole = (text) => {
    const t = String(text).trim();
    if (!t || !ARABIC_LETTER.test(t) || seen.has('W:' + t) || wholeN >= maxWhole) return;
    seen.add('W:' + t); wholeN++; start(t, true);
  };
  const consider = (para) => {
    const t = para.trim();
    if (!t || !ARABIC_LETTER.test(t) || seen.has(t)) return;
    seen.add(t);
    if (t.length >= minChars && !t.includes('<') && !entries.has(t) && entries.size < maxParagraphs) start(t);
    else if (!entries.has(t)) skipped.set(t, t.length < minChars ? 'S' : t.includes('<') ? 'T' : 'C');
    seenAr.push(t);
  };
  // What has arrived is read the way translateAnswer will read the final text: prose pieces between the cards (a complete tag closes the
  // prose before it), the paragraphs of a piece apart at blank lines, a scholar's published block cut off at its heading. A paragraph is
  // closed when something follows it -- a blank line, a card, the heading -- never merely because the text so far ends.
  const scan = () => {
    const pieces = splitAnswer(buf.slice(at)); let off = 0;
    pieces.forEach((pc, i) => {
      const lastPiece = i === pieces.length - 1;
      if (pc.type === 'tag') {
        off += pc.raw.length;
        if (pc.name === 'book') { const matn = unb64(attr(pc.attrs, 'matn')); if (matn && matn.length <= MATN_MAX) considerWhole(matn); }
        if (pc.name === 'source' && ARABIC_LETTER.test(pc.content)) consider(pc.content);
        return;
      }
      const fm = FATWA_HEAD.exec(pc.s); const cut = fm ? fm.index + fm[1].length : -1;
      if (cut >= 0 && !lastPiece) considerWhole(pc.s.slice(cut));
      const lead = cut >= 0 ? pc.s.slice(0, cut) : pc.s;
      const paras = lead.split(/\n\s*\n/);
      const closed = cut >= 0 || !lastPiece ? paras : paras.slice(0, -1);
      closed.forEach(consider);
      off += pc.s.length;
    });
    // everything before the last piece is finished with; the last one is read again when more arrives (dedupe keeps that free)
    if (pieces.length > 1) { const lastPc = pieces[pieces.length - 1]; at += off - (lastPc.type === 'tag' ? lastPc.raw.length : lastPc.s.length); }
  };
  return {
    /** the next piece of the Arabic answer, as it arrives */
    feed(text) { if (text) { buf += String(text); scan(); } },
    /** the entry for a final Arabic paragraph, or null */
    take(ar, whole) { return entries.get((whole ? 'W:' : '') + ar) || null; },
    get started() { return entries.size; },
    /** why a final paragraph was not taken from the parallel path, as one letter (a diagnostic: the log never carries the text) */
    why(ar) { return skipped.get(ar) || 'E'; },
  };
}

/**
 * @param {string} arabic the finished Arabic answer
 * @param {{lang:string, emit?:(s:string)=>void, translate?:Function, concurrency?:number}} o
 * @returns {Promise<{text:string, stats:object, degraded:string[]}>}
 */
export async function translateAnswer(arabic, { lang, emit = () => {}, translate = callTranslator, concurrency = 4, spec = null }) {
  const pieces = splitAnswer(String(arabic || ''));
  const counter = { n: 0 };
  const stats = { units: 0, batches: 0, batchRetries: 0, batchesKeptArabic: 0, unitsKeptArabic: 0, quran: 0, hadith: 0, unmatched: 0, repeated: 0, specUnits: 0, specHits: 0, specMisses: 0 };
  const degraded = [];
  // 1. every translatable string becomes a unit; remember where it goes back.
  const units = [];
  // A scholar's text (the fatwa block, a book passage) is translated WHOLE, quotations inside it included: it is a card of its
  // own labelled as a translation and the Arabic above it holds every quotation once, so no marker rides in it -- the long
  // units are exactly where a model dropped a marker, and a dropped marker sent the whole unit back Arabic.
  const addUnit = (str, whole) => { const p = whole ? { s: str, spans: [] } : protect(str, counter); const u = { s: p.s, spans: p.spans, ar: str, out: null, whole: !!whole, pre: null }; units.push(u); return u; };
  const lineUnits = (content) => content.split('\n').map((l) => (ARABIC_LETTER.test(l) ? { unit: addUnit(l.replace(/^\s*[-•*]\s*/, '').trim()), bullet: bulletOf(l) } : { raw: l }));
  const plan = pieces.map((pc) => {
    if (pc.type === 'text') {
      const fm = FATWA_HEAD.exec(pc.s);
      const cut = fm ? fm.index + fm[1].length : -1;
      const lead = cut >= 0 ? pc.s.slice(0, cut) : pc.s;
      const block = cut >= 0 ? pc.s.slice(cut) : '';
      const fatwa = block && ARABIC_LETTER.test(block) ? { raw: block, unit: addUnit(block.trim(), true), at: null } : null;
      const parts = lead.split(/(\n\s*\n)/); // keep the separators
      return { pc, fatwa, parts: parts.map((p) => ((/\S/.test(p) && ARABIC_LETTER.test(p)) ? { unit: addUnit(p.trim()), lead: p.match(/^\s*/)[0], trail: p.match(/\s*$/)[0] } : { raw: p })) };
    }
    if (pc.name === 'steps') return { pc, title: attr(pc.attrs, 'title') ? addUnit(attr(pc.attrs, 'title')) : null, lines: lineUnits(pc.content) };
    if (pc.name === 'suggestions') return { pc, lines: lineUnits(pc.content) };
    if (pc.name === 'board' || pc.name === 'document') return { pc, unit: ARABIC_LETTER.test(pc.content) ? addUnit(pc.content) : null };
    if (pc.name === 'source') return { pc, unit: ARABIC_LETTER.test(pc.content) ? addUnit(pc.content.trim()) : null };
    if (pc.name === 'book') {
      const matn = unb64(attr(pc.attrs, 'matn'));
      return { pc, unit: matn && ARABIC_LETTER.test(matn) && matn.length <= MATN_MAX ? addUnit(matn, true) : null, matnTooLong: matn.length > MATN_MAX };
    }
    return { pc };
  });
  // the card that carries a scholar's translation: the next source or book tag after the block's text piece
  plan.forEach((p, pi) => { if (p.fatwa) { for (let j = pi + 1; j < plan.length; j++) { const n = plan[j].pc; if (n.type === 'tag' && (n.name === 'source' || n.name === 'book')) { p.fatwa.at = j; plan[j].tb = p.fatwa.unit; break; } if (n.type === 'tag' && n.name === 'verse') break; } } });
  stats.units = units.length;
  // 1b. A paragraph that was already being translated while the Arabic answer was still being written (createSpeculator)
  // is taken as it stands -- but ONLY when the final Arabic paragraph is the very same string (h4: what survived the
  // filters is what is shown; a paragraph a filter changed is not here and is translated afresh below).
  if (spec) for (const u of units) { const e = spec.take(u.ar, u.whole); if (e) { u.pre = e; stats.specUnits++; } }
  // The shape of the first units, as letters (never the text): H taken from the parallel path, W a scholar's whole text (V: taken from the parallel path), and for the rest why
  // not -- S too short, T holds a tag, F after the scholar's block, C over the cap, E not seen closed while the brain wrote (the last
  // paragraph, or one a filter changed), n no parallel path at all.
  stats.shape = units.slice(0, 16).map((u) => (u.whole ? (u.pre ? 'V' : 'W') : u.pre ? 'H' : spec ? spec.why(u.ar) : 'n')).join('');
  // 2. batch the units, translate the batches in parallel (bounded).
  const batches = []; let cur = []; let size = 0;
  for (const u of units.filter((x) => !x.pre)) { if (cur.length && size + u.s.length > (batches.length === 0 ? FIRST_BATCH_CHARS : BATCH_CHARS)) { batches.push(cur); cur = []; size = 0; } cur.push(u); size += u.s.length; }
  if (cur.length) batches.push(cur);
  stats.batches = batches.length;
  const seenAr = []; const promises = []; const printed = new Set();
  let running = 0; const waiters = [];
  const slot = async () => { if (running >= concurrency) await new Promise((r) => waiters.push(r)); running++; };
  const free = () => { running--; const w = waiters.shift(); if (w) w(); };
  const startBatch = (batch, bi, track) => {
    const arText = batch.map((u) => u.ar).join('\n');
    const gl = glossaryFor(lang, arText); const earlier = seenAr.join('\n'); if (track) seenAr.push(arText);
    const already = gl.filter((g) => earlier.includes(g.ar)); const fresh = gl.filter((g) => !earlier.includes(g.ar));
    const head = (fresh.length ? 'GLOSSARY (Arabic => English meaning):\n' + fresh.map((g) => `${g.ar} => ${g.en}${g.definition ? ' : ' + g.definition : ''}`).join('\n') + '\n' : '')
      + (already.length ? 'ALREADY_EXPLAINED: ' + already.map((g) => g.ar).join(', ') + '\n' : '');
    // one call per partition: strings with markers / strings without
    const partitions = [
      { withMarkers: true, idx: batch.map((u, i) => (u.s.match(MARKER) ? i : -1)).filter((i) => i >= 0) },
      { withMarkers: false, idx: batch.map((u, i) => (u.s.match(MARKER) ? -1 : i)).filter((i) => i >= 0) },
    ].filter((p) => p.idx.length);
    const doPartition = async (part) => {
      const units = part.idx.map((i) => batch[i]);
      const user = head + 'INPUT:\n' + JSON.stringify(units.map((u) => u.s));
      const system = part.withMarkers ? ANSWER_TO_ENGLISH_SYSTEM : ANSWER_TO_ENGLISH_NO_MARKERS_SYSTEM;
      let best = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) stats.batchRetries++;
        const retryNote = attempt ? 'RETRY NOTE: the previous reply did not match the input exactly. Return one string per input string, in order' + (part.withMarkers ? ', and use exactly the markers that appear in each input string and no other.' : '.') + String.fromCharCode(10) : '';
        const r = await translate({ system, user: retryNote + user, maxTokens: 4096 });
        const arr = r.ok ? parseStringArray(r.text, units.length) : null;
        if (arr) {
          // a unit is accepted on its own: its markers came back exactly and it is not empty. A damaged unit stays Arabic
          // (restored from its own markers); the rest is kept.
          const bad = []; const why = [];
          arr.forEach((t, i) => {
            const okMk = sameMarkers(units[i].s, t); const full = !!t.trim(); const arOk = arabicLeft(t) <= ARABIC_LEFT_MAX;
            if (!(okMk && full && arOk)) { bad.push(i); if (why.length < 3) why.push(i + ':' + (!full ? 'empty' : !okMk ? 'markers' : 'arabic') + ':src' + units[i].s.length + '/out' + t.length + ':' + (units[i].s.match(MARKER) || []).length + '>' + (t.match(MARKER) || []).length); }
          });
          // A unit that came back with its Arabic still in it (the model gave the paragraph back with only glosses added, measured on
          // a long paragraph of nine quotations) is asked again LINE BY LINE: short strings with one marker each are what it does well.
          if (attempt === 0 && bad.length && bad.length <= 4) {
            stats.batchRetries++;
            degraded.push('lang:batch_try0:' + bi + (part.withMarkers ? 'm' : 'p') + ':units_damaged:' + bad.slice(0, 6).join('/') + ':' + why.join(',') + ':by_lines');
            const todo = bad.slice();
            const fixed = await Promise.all(todo.map((i) => translateLines({ s: units[i].s, system, head, translate })));
            todo.forEach((i, k) => { if (fixed[k] != null) { arr[i] = fixed[k]; bad.splice(bad.indexOf(i), 1); } });
            if (!bad.length) { best = { arr, bad }; break; }
          }
          if (!best || bad.length < best.bad.length) best = { arr, bad };
          if (!bad.length) break;
          degraded.push('lang:batch_try' + attempt + ':' + bi + (part.withMarkers ? 'm' : 'p') + ':units_damaged:' + bad.slice(0, 6).join('/') + ':' + why.join(','));
        } else {
          // the reason, as codes (never the text): the log is how a failed batch is told apart from a slow one
          degraded.push('lang:batch_try' + attempt + ':' + bi + (part.withMarkers ? 'm' : 'p') + ':' + (!r.ok ? 'http' + (r.status || 0) : 'shape:len' + String(r.text || '').length + '/n' + units.length));
        }
      }
      if (best && best.bad.length < units.length) {
        best.arr.forEach((t, i) => { if (!best.bad.includes(i)) units[i].out = t; });
        if (best.bad.length) { stats.unitsKeptArabic += best.bad.length; degraded.push('lang:units_kept_arabic:' + bi + ':' + best.bad.length); }
        return;
      }
      stats.batchesKeptArabic++; degraded.push('lang:batch_kept_arabic:' + bi);
    };
    return (async () => {
      await slot();
      try { await Promise.all(partitions.map(doPartition)); } finally { free(); }
    })();
  };
  batches.forEach((batch, bi) => promises.push(startBatch(batch, bi, true)));
  const batchOf = new Map(); batches.forEach((b, bi) => b.forEach((u) => batchOf.set(u, bi)));
  let lateN = 0;
  // A unit translated ahead of time is awaited where it is used; if that attempt failed it goes through the ordinary path alone.
  const settlePre = (u) => {
    if (!u.preP) u.preP = (async () => {
      await u.pre.promise;
      if (u.pre.out != null) { u.s = u.pre.s; u.spans = u.pre.spans; u.out = u.pre.out; stats.specHits++; return; }
      stats.specMisses++; await startBatch([u], 'late' + (++lateN), false);
    })();
    return u.preP;
  };
  const render = async (u) => { await (u.pre ? settlePre(u) : promises[batchOf.get(u)]); return u.out == null ? restoreArabic(u.s, u.spans) : restore(lang, u.out, u.spans, stats, printed); };
  // 3. emit in order.
  let full = '';
  const push = (s) => { if (!s) return; full += s; emit(s); };
  const joinLines = async (lines) => { const out = []; for (const l of lines) out.push(l.raw !== undefined ? l.raw : l.bullet + (await render(l.unit)).replace(/\n/g, ' ')); return out.join('\n'); };
  for (const p of plan) {
    const pc = p.pc;
    if (pc.type === 'text') {
      // paragraph by paragraph: each leaves as soon as ITS batch has settled and every paragraph before it has left (h8)
      for (const part of p.parts) push(part.raw !== undefined ? part.raw : part.lead + await render(part.unit) + part.trail);
      if (p.fatwa) {
        // the scholar's text stays Arabic, byte for byte; its translation rides in its own card under it
        push(p.fatwa.raw);
        if (p.fatwa.at === null) {
          // no card follows: the translation is a labelled paragraph, its quotations plain (the Arabic above holds them once)
          const t = (await render(p.fatwa.unit)).replace(/^\s*#+\s*/, '').replace(/[<>]/g, ' ').replace(/[\u00AB\u00BB\uFD3E\uFD3F]/g, '').trim();
          push('\n\n**' + (langRow(lang).labels.translation) + ':** ' + t + '\n');
        }
      }
      continue;
    }
    if (pc.name === 'verse') {
      let a = pc.attrs; const sn = parseInt(attr(a, 'surah_num'), 10); const mm = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(attr(a, 'ayah').trim());
      const range = sn && mm ? { s: sn, from: +mm[1], to: mm[2] ? +mm[2] : +mm[1] } : (pc.content.trim() ? findQuranRange(pc.content) : null);
      const line = quranLine(lang, range);
      if (line) { printed.add(line.key); a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; if (line.notes) a += ` trn="${b64(line.notes)}"`; stats.quran++; }
      push(`<verse${a}>${pc.content}</verse>`); continue;
    }
    if (pc.name === 'hadith') {
      let a = pc.attrs; const line = hadithLine(lang, pc.content);
      if (line) { printed.add(line.key); a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; stats.hadith++; }
      push(`<hadith${a}>${pc.content}</hadith>`); continue;
    }
    if (pc.name === 'book') {
      let a = pc.attrs;
      if (p.unit) a += ` tl="${b64((await render(p.unit)).trim())}"`; else if (p.matnTooLong) degraded.push('lang:matn_too_long_kept_arabic');
      if (p.tb) a += ` tb="${b64(blockText(await render(p.tb)))}"`;
      push(`<book${a}>${pc.content}</book>`); continue;
    }
    if (pc.name === 'source') {
      let a = pc.attrs; if (p.unit) a += ` tl="${b64(noQuotes(await render(p.unit)))}"`;
      if (p.tb) a += ` tb="${b64(blockText(await render(p.tb)))}"`;
      push(`<source${a}>${pc.content}</source>`); continue;
    }
    if (pc.name === 'steps') {
      let a = pc.attrs; if (p.title) { const t = noQuotes(await render(p.title)); a = a.replace(/(\btitle=)["'][^"']*["']/, `$1"${t}"`); }
      push(`<steps${a}>${await joinLines(p.lines)}</steps>`); continue;
    }
    if (pc.name === 'suggestions') { push(`<suggestions${pc.attrs}>${await joinLines(p.lines)}</suggestions>`); continue; }
    if (pc.name === 'board' || pc.name === 'document') { push(`<${pc.name}${pc.attrs}>${p.unit ? await render(p.unit) : pc.content}</${pc.name}>`); continue; }
    push(pc.raw);
  }
  const a = countSacred(arabic); const e = countSacred(full);
  // Beside a quotation the published translation is printed in parentheses, never as a second quotation:
  // so the count of verses and hadiths in the output is exactly the count in the Arabic.
  if (a.total !== e.total) degraded.push(`lang:count_mismatch:${a.total}/${e.total}`);
  return { text: full, stats: { ...stats, sacredAr: a.total, sacredOut: e.total }, degraded };
}
