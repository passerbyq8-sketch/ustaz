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
import { callTranslator, parseStringArray, ANSWER_TO_ENGLISH_SYSTEM } from './model.js';
import { findQuranRange, quranTranslation, findHadith, glossaryFor, foldArabic } from './published.js';
import { langRow } from './table.js';

const TAGS = ['verse', 'surah', 'hadith', 'steps', 'suggestions', 'board', 'document', 'source', 'dhikr', 'worship', 'book'];
const TAG_RE = new RegExp('<(' + TAGS.join('|') + ')([^>]*)>([\\s\\S]*?)</\\1>', 'g');
const ARABIC_LETTER = /[ء-ي]/;
const BATCH_CHARS = 2400;
const MATN_MAX = 4000;
const MARKER = /\[\[[QAI]\d+\]\]/g;

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
  return { text: tr.text, src };
}
function hadithLine(lang, arabic) {
  const h = findHadith(lang, arabic); if (!h) return null;
  return { text: h.text, src: `${langRow(lang).labels.hadithBy}: ${h.meta.source}${h.grade ? '; grade as published: ' + h.grade : ''}` };
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
function restore(lang, s, spans, stats) {
  return s.replace(MARKER, (mk) => {
    const id = mk.slice(2, -2); const sp = spans.find((x) => x.id === id); if (!sp) return mk;
    if (sp.kind === 'I') return sp.text;
    const inner = sp.kind === 'Q' ? sp.text.slice(1, -1) : sp.inner;
    let line = null;
    const range = findQuranRange(inner); if (range) { line = quranLine(lang, range); if (line) stats.quran++; }
    if (!line && sp.kind === 'A') { line = hadithLine(lang, inner); if (line) stats.hadith++; }
    if (!line) { stats.unmatched++; return sp.text; }
    return `${sp.text} (“${line.text}” — ${line.src})`;
  });
}
function restoreArabic(s, spans) { return s.replace(MARKER, (mk) => { const sp = spans.find((x) => x.id === mk.slice(2, -2)); return sp ? sp.text : mk; }); }

const sameMarkers = (a, b) => { const x = (a.match(MARKER) || []).sort().join(','); const y = (b.match(MARKER) || []).sort().join(','); return x === y; };
const bulletOf = (l) => (l.match(/^\s*[-•*]\s*/) || [''])[0];

/**
 * @param {string} arabic the finished Arabic answer
 * @param {{lang:string, emit?:(s:string)=>void, translate?:Function, concurrency?:number}} o
 * @returns {Promise<{text:string, stats:object, degraded:string[]}>}
 */
export async function translateAnswer(arabic, { lang, emit = () => {}, translate = callTranslator, concurrency = 4 }) {
  const pieces = splitAnswer(String(arabic || ''));
  const counter = { n: 0 };
  const stats = { units: 0, batches: 0, batchRetries: 0, batchesKeptArabic: 0, quran: 0, hadith: 0, unmatched: 0 };
  const degraded = [];
  // 1. every translatable string becomes a unit; remember where it goes back.
  const units = [];
  const addUnit = (str) => { const p = protect(str, counter); const u = { s: p.s, spans: p.spans, ar: str, out: null }; units.push(u); return u; };
  const lineUnits = (content) => content.split('\n').map((l) => (ARABIC_LETTER.test(l) ? { unit: addUnit(l.replace(/^\s*[-•*]\s*/, '').trim()), bullet: bulletOf(l) } : { raw: l }));
  const plan = pieces.map((pc) => {
    if (pc.type === 'text') {
      const parts = pc.s.split(/(\n\s*\n)/); // keep the separators
      return { pc, parts: parts.map((p) => ((/\S/.test(p) && ARABIC_LETTER.test(p)) ? { unit: addUnit(p.trim()), lead: p.match(/^\s*/)[0], trail: p.match(/\s*$/)[0] } : { raw: p })) };
    }
    if (pc.name === 'steps') return { pc, title: attr(pc.attrs, 'title') ? addUnit(attr(pc.attrs, 'title')) : null, lines: lineUnits(pc.content) };
    if (pc.name === 'suggestions') return { pc, lines: lineUnits(pc.content) };
    if (pc.name === 'board' || pc.name === 'document') return { pc, unit: ARABIC_LETTER.test(pc.content) ? addUnit(pc.content) : null };
    if (pc.name === 'source') return { pc, unit: ARABIC_LETTER.test(pc.content) ? addUnit(pc.content.trim()) : null };
    if (pc.name === 'book') {
      const matn = unb64(attr(pc.attrs, 'matn'));
      return { pc, unit: matn && ARABIC_LETTER.test(matn) && matn.length <= MATN_MAX ? addUnit(matn) : null, matnTooLong: matn.length > MATN_MAX };
    }
    return { pc };
  });
  stats.units = units.length;
  // 2. batch the units, translate the batches in parallel (bounded).
  const batches = []; let cur = []; let size = 0;
  for (const u of units) { if (cur.length && size + u.s.length > BATCH_CHARS) { batches.push(cur); cur = []; size = 0; } cur.push(u); size += u.s.length; }
  if (cur.length) batches.push(cur);
  stats.batches = batches.length;
  const seenAr = []; const promises = [];
  let running = 0; const waiters = [];
  const slot = async () => { if (running >= concurrency) await new Promise((r) => waiters.push(r)); running++; };
  const free = () => { running--; const w = waiters.shift(); if (w) w(); };
  batches.forEach((batch, bi) => {
    const arText = batch.map((u) => u.ar).join('\n');
    const gl = glossaryFor(lang, arText); const earlier = seenAr.join('\n'); seenAr.push(arText);
    const already = gl.filter((g) => earlier.includes(g.ar)); const fresh = gl.filter((g) => !earlier.includes(g.ar));
    const user = (fresh.length ? 'GLOSSARY (Arabic => English meaning):\n' + fresh.map((g) => `${g.ar} => ${g.en}${g.definition ? ' : ' + g.definition : ''}`).join('\n') + '\n' : '')
      + (already.length ? 'ALREADY_EXPLAINED: ' + already.map((g) => g.ar).join(', ') + '\n' : '') + 'INPUT:\n' + JSON.stringify(batch.map((u) => u.s));
    promises.push((async () => {
      await slot();
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt) stats.batchRetries++;
          const r = await translate({ system: ANSWER_TO_ENGLISH_SYSTEM, user, maxTokens: 4096 });
          const arr = r.ok ? parseStringArray(r.text, batch.length) : null;
          if (arr && arr.every((t, i) => sameMarkers(batch[i].s, t) && t.trim())) { arr.forEach((t, i) => { batch[i].out = t; }); return; }
          // the reason, as codes (never the text): the log is how a failed batch is told apart from a slow one
          const why = !r.ok ? 'http' + (r.status || 0) : !arr ? 'shape' : 'markers';
          degraded.push('lang:batch_try' + attempt + ':' + bi + ':' + why + (r.ok ? ':len' + String(r.text || '').length + '/n' + batch.length + ':' + String(r.text || '').replace(/[^ -~]/g, '').slice(0, 60).split(' ').filter(Boolean).join(' ') : ''));
        }
        stats.batchesKeptArabic++; degraded.push('lang:batch_kept_arabic:' + bi);
      } finally { free(); }
    })());
  });
  const batchOf = new Map(); batches.forEach((b, bi) => b.forEach((u) => batchOf.set(u, bi)));
  const render = async (u) => { await promises[batchOf.get(u)]; return u.out == null ? restoreArabic(u.s, u.spans) : restore(lang, u.out, u.spans, stats); };
  // 3. emit in order.
  let full = '';
  const push = (s) => { if (!s) return; full += s; emit(s); };
  const joinLines = async (lines) => { const out = []; for (const l of lines) out.push(l.raw !== undefined ? l.raw : l.bullet + (await render(l.unit)).replace(/\n/g, ' ')); return out.join('\n'); };
  for (const p of plan) {
    const pc = p.pc;
    if (pc.type === 'text') {
      // paragraph by paragraph: each leaves as soon as ITS batch has settled and every paragraph before it has left (h8)
      for (const part of p.parts) push(part.raw !== undefined ? part.raw : part.lead + await render(part.unit) + part.trail);
      continue;
    }
    if (pc.name === 'verse') {
      let a = pc.attrs; const sn = parseInt(attr(a, 'surah_num'), 10); const mm = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(attr(a, 'ayah').trim());
      const range = sn && mm ? { s: sn, from: +mm[1], to: mm[2] ? +mm[2] : +mm[1] } : (pc.content.trim() ? findQuranRange(pc.content) : null);
      const line = quranLine(lang, range);
      if (line) { a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; stats.quran++; }
      push(`<verse${a}>${pc.content}</verse>`); continue;
    }
    if (pc.name === 'hadith') {
      let a = pc.attrs; const line = hadithLine(lang, pc.content);
      if (line) { a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; stats.hadith++; }
      push(`<hadith${a}>${pc.content}</hadith>`); continue;
    }
    if (pc.name === 'book') {
      let a = pc.attrs;
      if (p.unit) a += ` tl="${b64((await render(p.unit)).trim())}"`; else if (p.matnTooLong) degraded.push('lang:matn_too_long_kept_arabic');
      push(`<book${a}>${pc.content}</book>`); continue;
    }
    if (pc.name === 'source') {
      let a = pc.attrs; if (p.unit) a += ` tl="${b64(noQuotes(await render(p.unit)))}"`;
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
