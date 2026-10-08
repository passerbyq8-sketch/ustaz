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
import { callTranslator, parseStringArray, answerSystem, noteRefusal } from './model.js';
import { findQuranRange, quranTranslation, findHadith, glossaryFor, foldArabic, quranHas, quranStretches } from './published.js';
import { langRow } from './table.js';
import { translationNotice } from './question.js';
import { surahNameIn, surahNumberOfName } from './surah-names.js';

const TAGS = ['verse', 'surah', 'hadith', 'steps', 'suggestions', 'board', 'document', 'source', 'dhikr', 'worship', 'book'];
const TAG_RE = new RegExp('<(' + TAGS.join('|') + ')([^>]*)>([\\s\\S]*?)</\\1>', 'g');
const ARABIC_LETTER = /[ء-ي]/;
// E2 (amendment 5) -- WHAT MAKES A TRANSLATION SLOW, AND THE BOUNDS. Measured on the final preview with the per-call log (x-ezik-lang-debug):
//   * a model call takes about as long as its OUTPUT: 17 s for 790 tokens (Somali, 900 characters), 35 s for 1336 (Uzbek Cyrillic, 1540 characters) -- and the
//     whole answer waited on the one call that held the long paragraph;
//   * a paragraph the checks refused ("the Arabic was given back", code a) was asked again as the next call, and the next, one after another -- five calls of
//     17 s, 85 s, and then it was delivered Arabic without a word (so_s 124 s, pt_i 100 s).
// So: a long paragraph is cut at sentence ends into pieces of CHUNK_CHARS that are translated at the same time; the retries of a piece run side by side (the first
// good one wins); every call is bounded (CALL_TIMEOUT_MS) and the whole phase has a budget (BUDGET_MS) after which no call starts. What still could not be
// translated is shown in Arabic AFTER one fixed line in the reader's language (lib/lang/question.js translationNotice).
export const BUDGET_MS = 60000;
export const CALL_TIMEOUT_MS = 28000;
const SPLIT_CHARS = 700;
const CHUNK_CHARS = 420;
const BATCH_CHARS = 1200;
const FIRST_BATCH_CHARS = 500;   // the first batch is small so the reader sees English as early as the model can write one paragraph (h8)
const MATN_MAX = 4000;
const MARKER = /\[\[[QAIU]\d+\]\]/g;
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

/** K1: a string that is nothing but markers (a paragraph that is all Qur'an) has nothing for a model to translate: it goes back as it stands */
const onlyMarkers = (s) => String(s).search(MARKER) >= 0 && !/\p{L}/u.test(String(s).replace(MARKER, ''));
/** a label template of the language row with its {names} filled (a missing name is left empty) */
const fill = (tpl, vars) => String(tpl).replace(/\{([a-z]+)\}/g, (m, k) => (vars[k] == null ? '' : String(vars[k])));
function quranLine(lang, range) {
  const tr = range && quranTranslation(lang, range.s, range.from, range.to); if (!tr) return null;
  const ref = tr.sura + ':' + tr.from + (tr.to > tr.from ? '-' + tr.to : '');
  const L = langRow(lang).labels;
  const src = fill(L.quranSrc, { by: L.quranBy, ref, full: range.partial ? L.quranFull : '', title: tr.meta.title, source: tr.meta.source, version: tr.meta.version });
  return { text: tr.text, src, notes: tr.footnotes || '', key: 'Q' + ref };
}
function hadithLine(lang, arabic) {
  const h = findHadith(lang, arabic); if (!h) return null;
  const L = langRow(lang).labels;
  return { text: h.text, src: fill(L.hadithSrc, { by: L.hadithBy, full: h.partial ? L.hadithFull : '', source: h.meta.source, grade: h.grade ? fill(L.grade, { grade: h.grade }) : '' }), key: 'H' + h.id };
}

// L (amendment 11) -- THE QUR'AN IS SHOWN ONE WAY IN EVERY LANGUAGE: a verse card (the Arabic from the mushaf, its caption, its reference, the published translation under it); a
// short fragment inside prose carries the reference of the verse it belongs to. Measured on the final link of 8fdab1d (extension test 2): the card was a <surah num from to> range
// (no translation, caption "ayahs 255-255"); a verse written in the prose stayed in the prose (Indonesian); later fragments of a verse had nothing beside them (English); the
// surah name in the caption stayed Arabic. So: the surah and numbers of a card are read once (cardRange), a card of one verse is written as a <verse> card with its translation,
// a whole verse found in the prose is lifted out of it into such a card, a card names its surah in the reader's language (lib/lang/surah-names.js), and a later fragment gets the
// reference "(2:255)" beside it instead of nothing.
const SURAH_TR_MAX = 12;
const setAttr = (attrs, k, v) => { const re = new RegExp('\\b' + k + '=["\'][^"\']*["\']'); const kv = k + '="' + v + '"'; return re.test(attrs) ? attrs.replace(re, () => kv) : attrs + ' ' + kv; };
/** {s,from,to} a verse or surah card stands for (by number, or by the Arabic name of its surah), or null */
export function cardRange(pc) {
  if (pc.name === 'surah') {
    const s = parseInt(attr(pc.attrs, 'num'), 10); const f = parseInt(attr(pc.attrs, 'from'), 10); const t = parseInt(attr(pc.attrs, 'to'), 10);
    return s >= 1 && s <= 114 && f >= 1 ? { s, from: f, to: t >= f ? t : f } : null;
  }
  let s = parseInt(attr(pc.attrs, 'surah_num'), 10); if (!(s >= 1 && s <= 114)) s = surahNumberOfName(attr(pc.attrs, 'surah')) || 0;
  const mm = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/.exec(attr(pc.attrs, 'ayah').trim());
  return s && mm ? { s, from: +mm[1], to: mm[2] ? +mm[2] : +mm[1] } : null;
}
/** the attributes of a verse card as a non-Arabic reader gets them: its surah numbered and named in the reader's language, and one verse written as one number */
export function verseAttrs(lang, attrs, range) {
  let a = attrs; const name = attr(a, 'surah'); let sn = parseInt(attr(a, 'surah_num'), 10);
  if (!(sn >= 1 && sn <= 114)) sn = (name && surahNumberOfName(name)) || (range && range.s) || 0;
  if (sn >= 1 && sn <= 114) { a = setAttr(a, 'surah_num', sn); const local = surahNameIn(lang, sn); if (local) a = setAttr(a, 'surah', local); }
  const mm = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(attr(a, 'ayah').trim()); if (mm && mm[1] === mm[2]) a = setAttr(a, 'ayah', mm[1]);
  return a;
}
function verseCardTag(lang, range, line, content = '') {
  let a = ` surah_num="${range.s}" ayah="${range.from}"`; const local = surahNameIn(lang, range.s); if (local) a += ` surah="${local}"`;
  if (line) { a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; if (line.notes) a += ` trn="${b64(line.notes)}"`; }
  return `<verse${a}>${String(content).replace(/[<>]/g, ' ')}</verse>`;
}
/** a paragraph whose whole verses were lifted out of it: the pieces of text and the cards, each card on its own lines */
export function withCards(t, cards) {
  const parts = String(t).split(/\[\[CARD(\d+)\]\]/); let o = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    o = o.replace(/[ \t]+$/, ''); o += (o && !/\n\n$/.test(o) ? '\n\n' : '') + cards[+parts[i]];
    const rest = (parts[i + 1] || '').replace(/^[ \t]+/, ''); if (rest.trim()) o += '\n\n' + rest.replace(/^\n+/, '');
  }
  return o;
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
  // K1 (amendment 10): the Qur'an written WITHOUT marks (after «قوله تعالى:», in a plain sentence) is cut out too. The model never receives a stretch of the mushaf as text to
  // translate, so it cannot trip the Arabic-run rule and the fixed line never stands over Qur'an. kind 'U': restored like a quoted verse (its reference and published translation, if found).
  s = s.split(/(\[\[[QAI]\d+\]\])/).map((seg, k) => {
    if (k % 2) return seg;
    const st = quranStretches(seg); if (!st.length) return seg;
    let o = ''; let at = 0;
    for (const r of st) { const id = 'U' + (++counter.n); spans.push({ id, kind: 'U', text: seg.slice(r.start, r.end) }); o += seg.slice(at, r.start) + `[[${id}]]`; at = r.end; }
    return o + seg.slice(at);
  }).join('');
  return { s, spans };
}
function restore(lang, s, spans, stats, printed, hints, lift = null) {
  return s.replace(MARKER, (mk) => {
    const id = mk.slice(2, -2); const sp = spans.find((x) => x.id === id); if (!sp) return mk;
    if (sp.kind === 'I') return sp.text;
    const inner = sp.kind === 'Q' ? sp.text.slice(1, -1) : sp.kind === 'U' ? sp.text : sp.inner;
    let line = null;
    const range = findQuranRange(inner, hints); if (range) { line = quranLine(lang, range); if (line) stats.quran++; }
    if (!line && sp.kind === 'A') { line = hadithLine(lang, inner); if (line) stats.hadith++; }
    if (!line) { stats.unmatched++; return sp.text; }
    // A published translation is printed ONCE in an answer: a verse quoted in pieces, or a quotation found again further down, does not carry the
    // whole of it each time (measured: the full translation of one verse, with its notes, four times in a row beside four fragments of it).
    // L: a WHOLE verse written in the prose (quoted or not) becomes a verse card, lifted out of the paragraph, unless the answer already shows that verse
    if (lift && (sp.kind === 'Q' || sp.kind === 'U') && range && range.from === range.to && !range.partial && line.key && !(printed && printed.has(line.key))) {
      if (printed) printed.add(line.key);
      lift.cards.push(verseCardTag(lang, range, line, inner)); stats.lifted++; if (sp.kind === 'U') stats.cardsAdded++;
      return `[[CARD${lift.cards.length - 1}]]`;
    }
    // L: the translation is printed once; a later quotation of the same verse carries the reference of the verse, never nothing
    if (printed && line.key) { if (printed.has(line.key)) { stats.repeated++; return `${sp.text} (${line.key.slice(1)})`; } printed.add(line.key); }
    return `${sp.text} (“${line.text}” — ${line.src}${line.notes ? fill(langRow(lang).labels.notes, { notes: line.notes.replace(/\s*\n\s*/g, ' ') }) : ''})`;
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
// ...but a scholar's text may keep a verse or a hadith it quotes in Arabic beside its own translation: what counts as "still Arabic" is a reply that kept
// most of what it was given (the paragraph that came back with its Arabic untouched), not one that kept a quotation.
const arabicLeft = (t) => (String(t).replace(MARKER, '').match(/[؀-ۿݐ-ݿ]/g) || []).length;
// A language that is itself written in Arabic script (Persian, Urdu) cannot be told from a reply that kept its Arabic by counting letters: every letter of
// a correct reply counts. Measured on the first Persian preview: every unit "kept Arabic" (code a), twelve retries, the answer delivered in Arabic. What
// is counted for such a language is the words: a reply in which most words are the source's own words, letter for letter, is the Arabic given back.
const KEPT_SAME = 0.6;
const wordsOf = (t) => foldArabic(String(t).replace(MARKER, ' ')).split(' ').filter(Boolean);
export function keptSource(src, out) {
  const a = wordsOf(src); const b = wordsOf(out); if (a.length < 6 || !b.length) return false;
  const set = new Set(a); return b.filter((w) => set.has(w)).length / b.length > KEPT_SAME;
}
// J (amendment 9) -- TWO THINGS THE OLD CHECKS LET THROUGH, both seen by a reader on the final link:
//  * the reply that TALKS ABOUT ITSELF. The model wrote a draft, then a note ("Wait, I need to reconsider the format ... Let me provide the correct translation:" /
//    "the correct answer is below"), then a second array inside the one string it was asked for; the reply had the right length, the markers and under 40 percent of
//    the Arabic, so it was taken. An array opener inside a string (["  or  "]) is never part of a translation, and neither are the model's own announcements.
//  * the Arabic SENTENCE beside its translation. Up to 40 percent of the source's Arabic letters were allowed (a short quoted name or term may stay), so a whole sentence
//    copied next to its English was taken. A run of ARABIC_RUN_MAX+1 words in a row that are still Arabic (for Persian, Urdu, Pashto and Kurdish: still the source's own
//    words, letter for letter) is a copied sentence, not a term; such a reply is refused like any other, asked again, and at the end delivered Arabic WITH the fixed line.
export const ARABIC_RUN_MAX = 5;
const ARRAY_IN_STRING = /\[\s*["“]|["”]\s*\]/;
const MODEL_TALK = /\b(?:wait[,:]|let me (?:provide|reconsider|re-?translate|redo|try again|correct|give)|i need to (?:reconsider|correct|re-?do|re-?translate|fix)|(?:here is|here's) the (?:corrected|correct|actual) |the correct translation|(?:the )?input (?:doesn.t|does not|is not|has no)|as an ai\b)/i;
/** The model's own voice inside a translation (never in the Arabic source): an array opener, or a sentence about the task. */
export function modelTalk(src, out) {
  const o = String(out || '').replace(MARKER, ' '); const s = String(src || '');
  return (ARRAY_IN_STRING.test(o) && !ARRAY_IN_STRING.test(s)) || (MODEL_TALK.test(o) && !MODEL_TALK.test(s));
}
/** The longest run of words in a row that are still Arabic in `out` (own: words that are the source's own words, for a language written in the Arabic script). */
export function arabicRun(src, out, own) {
  const set = own ? new Set(wordsOf(src)) : null; let best = 0; let run = [];
  // a run that is a stretch of the Qur'an itself (a verse fragment the translation keeps in quotation, the way the source does) is not a copied sentence
  const close = () => { if (run.length > best && !(run.length >= 3 && quranHas(foldArabic(run.join(' '))))) best = run.length; run = []; };
  for (const w of String(out || '').replace(MARKER, ' ').split(/\s+/).filter(Boolean)) {
    const hit = own ? (foldArabic(w).length >= 2 && set.has(foldArabic(w))) : /[؀-ۿݐ-ݿ]/.test(w);
    if (hit) run.push(w); else close();
  }
  close();
  return best;
}
const arabicOk = (src, out, lang) => {
  if (modelTalk(src, out)) return false;
  if (lang && langRow(lang) && langRow(lang).script === 'arab') return !keptSource(src, out) && !addedName(src, out) && arabicRun(src, out, true) <= ARABIC_RUN_MAX;
  const left = arabicLeft(out); return (left <= ARABIC_LEFT_MAX || left <= 0.4 * arabicLeft(src)) && !addedName(src, out) && arabicRun(src, out, false) <= ARABIC_RUN_MAX;
};

// A translation adds no name the Arabic does not hold. The groups and sects are the ones a gloss has been seen to invent (a stored term whose
// "meaning" was the word Tijaniyyah); the Arabic side is a stem, so a plural or a definite form of the name in the source clears it.
const NAMES = [
  [/tij+an|tidj+an|tic+an/, /تيجان|تجان/], [/\bshi['’‘ʿ]?(?:a|ite|ites|ism)\b|\bchi(?:a|ite|ites|isme)\b|\bsyi['’‘ʿ]?ah|\bsii\b|\bshii\b|rafid/, /شيع|رافض/], [/\bsufi|\bsoufi|\bsufizm|\btasawuf|\btasavvuf/, /صوف/],
  [/wahhab|wahab|vahhab|vahab/, /وهاب/], [/(?:ash|ach|asy|es|esh)['’‘ʿ]?ar(?:i|ite|ites|iyah|iyya)\b/, /اشعر/], [/maturid/, /ماتريد/],
  [/(?:mu|mou|muk|mu')['’‘ʿ]?tazil|mutezile/, /معتزل/], [/khaw?arij|kharij|harici/, /خوارج|خارج/], [/qadiani|\bahmadi|kad[iı]yani/, /قادياني|احمدي/], [/\bmurji|murcie|mourdji/, /مرجئ/],
  [/\bjahmi|cehmi|djahmi/, /جهم/], [/\bqadari|kaderiyye|kadari/, /قدري/], [/\bsalafi|\bselefi/, /سلف/], [/\bisma['’‘ʿ]?ili/, /اسماعيل/], [/\bdruze|\bdurzi|\bbahai|\balawi\b/, /درز|بهائ|علوي/],
  [/тиджани|тиджан|тидж+ан/, /تيجان|تجان/], [/шиит|шиа\b|шиизм|рафидит/, /شيع|رافض/], [/суфи|суфизм/, /صوف/], [/ваххаб|вахаб/, /وهاب/], [/ашарит|ашари\b/, /اشعر/], [/матуридит/, /ماتريد/],
  [/мутазилит|мутазил/, /معتزل/], [/хариджит|хавариджи|хаваридж/, /خوارج|خارج/], [/кадиани|ахмади/, /قادياني|احمدي/], [/мурджи/, /مرجئ/], [/джахмит|джахми/, /جهم/], [/кадарит/, /قدري/], [/салафит|салафи\b/, /سلف/], [/исмаилит/, /اسماعيل/], [/друз\b|бахаи|алавит/, /درز|بهائ|علوي/],
  [/tiyan/, /تيجان|تجان/], [/\bchii(?:es|s|ta|tas)?\b/, /شيع|رافض/], [/ismaeli|ismailies/, /اسماعيل/],
  [/\bxiit|\bschiit/, /شيع|رافض/],
  [/शिया|शीआ|रफ़ीज़ी|रफीजी/, /شيع|رافض/], [/सूफ़ी|सूफी|तसव्वुफ़/, /صوف/], [/वहाबी|वहहाबी/, /وهاب/], [/अशअरी|अशरी/, /اشعر/], [/मातुरीदी/, /ماتريد/],
  [/मुअतज़िला|मुतज़िला/, /معتزل/], [/ख़वारिज|खवारिज|ख़ारिजी/, /خوارج|خارج/], [/क़ादियानी|कादियानी|अहमदी/, /قادياني|احمدي/], [/मुर्जिआ|मुरजिआ/, /مرجئ/], [/जहमी|जह्मी/, /جهم/], [/सलफ़ी|सलफी/, /سلف/], [/इस्माईली/, /اسماعيل/], [/तिजानी|तीजानी/, /تيجان|تجان/],
  [/شیعه|شیعە|شیعہ|شیعیان|رافضی/, /شيع|رافض/], [/صوفی|صوفي|صوفیان|سۆفی/, /صوف/], [/وهابی|وهابي|وەهابی/, /وهاب/], [/اشعری|اشعري|ئەشعەری/, /اشعر/], [/معتزل[هەی]|مۆعتەزیلە/, /معتزل/], [/خوارج|خەوارج/, /خوارج|خارج/], [/قادیانی|احمدی|ئەحمەدی/, /قادياني|احمدي/], [/مرجئ[هە]|موڕجیئە/, /مرجئ/], [/سلفی|سلفي/, /سلف/], [/تیجانی|تیجانیه|تیجانیە/, /تيجان|تجان/],
  [/шиа(?:лар|нинг)?|шиъа/, /شيع|رافض/], [/суфий|сўфий|тасаввуф/, /صوف/], [/ваҳҳобий|вахабий/, /وهاب/], [/ашъарий|ашарий/, /اشعر/], [/мўътазила|мутазилий/, /معتزل/], [/хаворижлар|хавориж/, /خوارج|خارج/], [/қодиёний|ахмадий/, /قادياني|احمدي/], [/салафий/, /سلف/], [/тижоний/, /تيجان|تجان/],
  [/ሺዓ|ሺአ|ሺዐ|ሺዓዎች|ራፊዳ/, /شيع|رافض/], [/ሱፊ|ተሰዉፍ/, /صوف/], [/ዋሃቢ|ወሃቢ|ወሃብ/, /وهاب/], [/አሽዓሪ|አሸዐሪ|አሽአሪ/, /اشعر/], [/ማቱሪዲ|ማቱሪዲያ/, /ماتريد/], [/ሙዕተዚላ|ሙዐተዚላ|ሙዕተዚሊ/, /معتزل/], [/ኸዋሪጅ|ኻዋሪጅ|ኸዋሪጆች/, /خوارج|خارج/], [/ቃዲያኒ|አሕመዲ|አሕመዲያ/, /قادياني|احمدي/], [/ሙርጂዓ|ሙርጂአ|ሙርጂአህ/, /مرجئ/], [/ጀህሚ|ጀህሚያ/, /جهم/], [/ሰለፊ|ሰለፊያ/, /سلف/], [/ቲጃኒ|ቲጃኒያ|ቲጃኒያህ/, /تيجان|تجان/],
  [/ஷியா|ஷீஆ|ராஃபிழி|ரவாஃபித்/, /شيع|رافض/], [/சூஃபி|சூபி|தஸவ்வுஃப்|சூஃபிகள்/, /صوف/], [/வஹ்ஹாபி|வஹாபி|வஹ்ஹாபிகள்/, /وهاب/], [/அஷ்அரி|அஷ்அரிய்யா|அஷாஇரா/, /اشعر/], [/மாதுரீதி|மாதுரிதி/, /ماتريد/], [/முஃதஸிலா|முஅதஸிலா|முஃதசிலா/, /معتزل/], [/கவாரிஜ்|கவாரிஜ்கள்|கவாரிஜுகள்/, /خوارج|خارج/], [/காதியானி|அஹ்மதிய்யா|அஹ்மதி/, /قادياني|احمدي/], [/முர்ஜிஆ|முர்ஜிஅ/, /مرجئ/], [/ஜஹ்மிய்யா|ஜஹ்மி/, /جهم/], [/ஸலஃபி|சலஃபி|ஸலஃபிகள்/, /سلف/], [/திஜானி|திஜானிய்யா|தீஜானி/, /تيجان|تجان/],
];
/** The first name-pattern that refused a reply (its source, 40 characters), for a debug request's log; null when none. */
export function addedNameWhich(src, out) {
  const lat = String(out || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const ar = foldArabic(src);
  const hit = NAMES.find(([l, a]) => l.test(lat) && !a.test(ar));
  return hit ? hit[0].source.slice(0, 40) + ' <- ' + (hit[0].exec(lat) || [''])[0] : null;
}
export function addedName(src, out) {
  const lat = String(out || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); const ar = foldArabic(src);
  return NAMES.some(([l, a]) => l.test(lat) && !a.test(ar));
}
/**
 * J (amendment 9): A TERM IS EXPLAINED ONCE IN AN ANSWER. A parenthesis that opens with "Label:" and a definition is a glossary note; the second note with the same label
 * (measured in the Indonesian tarawih answer: the same note twice) is cut, with the space before it. `seen` is the set of labels already explained in this answer.
 */
export function dropRepeatedNotes(s, seen) {
  const t = String(s); let out = ''; let i = 0;
  while (i < t.length) {
    if (t[i] !== '(') { out += t[i++]; continue; }
    let depth = 0; let j = i;
    for (; j < t.length; j++) { if (t[j] === '(') depth++; else if (t[j] === ')') { depth--; if (depth === 0) break; } }
    if (j >= t.length) { out += t.slice(i); break; }
    const inner = t.slice(i + 1, j); const m = /^\s*([^():]{2,70}?)\s*[:：]\s+\S/.exec(inner);
    if (m && !/^\s*[“"«]/.test(inner)) {
      const key = m[1].trim().toLowerCase();
      if (seen.has(key)) { out = out.replace(/\s+$/, ''); i = j + 1; continue; }
      seen.add(key);
    } else if (isBareGloss(inner)) {
      const key = 'b:' + inner.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) { out = out.replace(/\s+$/, ''); i = j + 1; continue; }
      seen.add(key);
    }
    out += t.slice(i, j + 1); i = j + 1;
  }
  return out;
}
/**
 * L (amendment 11): the same rule for a BARE gloss. The model puts the meaning of a term in parentheses at its first mention (rule 3 of the prompt asks for it); measured in 15
 * saved answers: 68 of 136 parentheses were such glosses of its own, and the same one came back inside one answer ("(The Self-Subsisting)" three times, "(la prière)", "(singgasana)").
 * A short gloss (1-3 words, no digits, no quotation, not a blessing formula) is kept the first time and cut the next; a blessing after a name ("(peace be upon him)") is not a gloss and stays.
 */
const BLESSING = /ﷺ|pbuh|\bsaw\b|\bswt\b|sallall|rahimah|rahimahu|radi|radhi|ridwan|alayh|paix|peace|salam|shalawat|salawat|rahmat|blessing|bénédiction|benediction|مبارک|سلام|صل|درود|علیه|عليه|رحم|رضی|رضي/i;
export function isBareGloss(inner) {
  const s = String(inner).trim(); const n = s.split(/\s+/).length;
  return s.length >= 4 && s.length <= 40 && n <= 3 && !/[0-9٠-٩۰-۹:：“”"«»]/.test(s) && !BLESSING.test(s);
}
/** (Only for a language not written in Arabic script: in Persian or Urdu a parenthesis may begin with Arabic-script letters of the language itself.) A gloss the translator wrote with the Arabic term inside its parentheses: «(إقامة: meaning)» becomes «(meaning)». A bare «(Arabic)» goes. */
export function dropArabicGloss(s, whole = false) {
  return String(s).replace(/\s*\(\s*[\u0600-\u06FF\u0750-\u077F][\u0600-\u06FF\u0750-\u077F\s]*(?:[:：]\s*([^)]*))?\)/g, (m, d) => (!whole && d && d.trim() ? ' (' + d.trim() + ')' : ''));
}
/** One string asked again as its LINES: each non-empty line is one item of one call, and every line must come back whole. */
async function translateLines({ s, system, head, translate, lang }) {
  const lines = String(s).split('\n'); const idx = lines.map((l, i) => (/\S/.test(l) ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return null;     // a single line has nothing to split: the whole-array retry is its retry
  try {
    const r = await translate({ system, user: head + 'INPUT:\n' + JSON.stringify(idx.map((i) => lines[i])), maxTokens: 4096 });
    const arr = r && r.ok ? parseStringArray(r.text, idx.length) : null; if (!arr) return null;
    if (!arr.every((t, k) => sameMarkers(lines[idx[k]], t) && t.trim() && arabicOk(lines[idx[k]], t, lang))) return null;
    const out = lines.slice(); idx.forEach((i, k) => { out[i] = arr[k].replace(/\n/g, ' '); });
    return out.join('\n');
  } catch { return null; }
}

/** Cut a string at sentence ends into pieces of about \`max\` characters (a piece keeps the white space that followed it, so the pieces joined are the string). */
export function splitChunks(str, max = CHUNK_CHARS) {
  const s = String(str); const sents = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    cur += s[i]; const c = s[i]; const n = s[i + 1];
    const end = ('.!?؟۔।።'.includes(c) && (n === undefined || /\s/.test(n))) || '。！？'.includes(c) || c === '\n';
    if (end) { let j = i + 1; while (j < s.length && /\s/.test(s[j])) { cur += s[j]; j++; } i = j - 1; sents.push(cur); cur = ''; }
  }
  if (cur) sents.push(cur);
  const out = []; let acc = '';
  for (const t of sents) { if (acc && acc.length + t.length > max) { out.push(acc); acc = ''; } acc += t; }
  if (acc) out.push(acc);
  return out.length ? out : [s];
}
/** The first of several attempts that gives a result; null when every one of them gives null. The others are not waited for once one has won. */
function firstGood(list) {
  return new Promise((resolve) => { let left = list.length; if (!left) resolve(null); list.forEach((p) => { Promise.resolve(p).then((v) => { if (v != null) resolve(v); else if (--left === 0) resolve(null); }, () => { if (--left === 0) resolve(null); }); }); });
}
/** A \`translate\` that never starts a call after the deadline and never lets one run past it (a stub that ignores timeoutMs is simply not cut). */
export function budgeted(translate, deadline, now = Date.now) {
  return async (args) => {
    const left = deadline - now();
    if (left < 2500) return { ok: false, status: 408, text: '', budget: true };
    return translate({ ...args, timeoutMs: Math.min(args.timeoutMs || CALL_TIMEOUT_MS, left) });
  };
}

/**
 * ONE unit, asked alone: the whole string first, then its lines (a paragraph with line breaks), then the whole string once more with a note.
 * It is what a unit falls back to when the batch it was in came back unreadable (measured: a batch of three short paragraphs whose reply was
 * not an array of three, twice, so all three were delivered in Arabic), and what the parallel path uses. `codes` names each failure as
 * one letter -- h<status> the call, s not an array of one, m markers, e empty, a Arabic kept -- for the log; never the text.
 * @returns {Promise<{out:string|null, codes:string[]}>}
 */
async function translateOneUnit(o) {
  const chunks = o.s.length > SPLIT_CHARS ? splitChunks(o.s) : [o.s];
  if (chunks.length < 2) return translateChunk(o);
  const rs = await Promise.all(chunks.map((c) => translateChunk({ ...o, s: c })));
  const codes = rs.flatMap((r) => r.codes);
  // all pieces or none: a piece left in Arabic inside a translated paragraph is the silent Arabic this layer exists to prevent
  if (rs.some((r) => r.out == null)) return { out: null, codes };
  return { out: rs.map((r, k) => r.out.replace(/\s+$/, '') + (chunks[k].match(/\s*$/)[0] || '')).join(''), codes };
}
async function translateChunk({ s, system, head, translate, lang, tried = false }) {
  const codes = [];
  // A refused reply is asked again WITHOUT the glossary: measured (pt_o2, debug log), the refusal was the name check on a reply with no Arabic letters in it -- a name
  // the glossary's own definition carried into the translation (the Tijaniyyah rows, E3) -- and the same prompt gives the same reply.
  const whole = async (note) => {
    const user = (note ? '' : head) + 'INPUT:\n' + JSON.stringify([s]);
    const r = await translate({ system, user: (note || '') + user, maxTokens: 4096 });
    if (!r || !r.ok) { codes.push('h' + ((r && r.status) || 0)); return null; }
    const arr = parseStringArray(r.text, 1);
    if (!arr) { codes.push('s'); return null; }
    if (!sameMarkers(s, arr[0])) { codes.push('m'); return null; }
    if (!arr[0].trim()) { codes.push('e'); return null; }
    if (!arabicOk(s, arr[0], lang)) { codes.push('a'); noteRefusal('a', s.length, arr[0], addedNameWhich(s, arr[0])); return null; }
    return arr[0];
  };
  try {
    // (tried: the batch the unit was in already asked once and the reply was refused -- asking the same thing again first is a wasted call)
    let out = tried ? null : await whole();
    // the two ways out are tried at the same time, not one after the other: whichever gives a good translation first is the answer
    if (out == null) out = await firstGood([translateLines({ s, system, head: '', translate, lang }), whole('RETRY NOTE: the previous reply did not match the input. Return a JSON array of exactly one string, the whole translation' + String.fromCharCode(10))]);
    return { out, codes };
  } catch (e) { codes.push('x'); return { out: null, codes }; }
}

/**
 * ITEM 74 / THE PARALLEL TRANSLATION. While the Arabic answer is still arriving from the brain, every paragraph that is COMPLETE
 * (a blank line follows it) starts to be translated at once, so that when the answer is final its paragraphs are mostly done.
 * NOTHING a speculator produces is ever shown by itself: translateAnswer takes an entry only when the FINAL Arabic paragraph is
 * the identical string, so a paragraph a reviewer or a filter changed, cut or moved is translated again from the final text (h4,
 * h8). A speculator only spends calls; it never decides what the reader sees.
 * @param {{lang:string, translate?:Function, concurrency?:number, maxParagraphs?:number, minChars?:number}} o
 */
export function createSpeculator({ lang, translate: translateIn = callTranslator, concurrency = 3, maxParagraphs = 10, maxWhole = 6, minChars = 12 }) {
  const translate = (a) => translateIn({ timeoutMs: CALL_TIMEOUT_MS, ...a });
  const counter = { n: 0 };
  const entries = new Map(); const seenAr = []; const skipped = new Map();
  let buf = ''; let at = 0; let running = 0; const waiters = [];
  const slot = async () => { if (running >= concurrency) await new Promise((r) => waiters.push(r)); running++; };
  const free = () => { running--; const w = waiters.shift(); if (w) w(); };
  // `whole` is a scholar's text (the published fatwa block, a book passage): translated as one string with no marker in it, the way translateAnswer does
  const start = (t, whole) => {
    const p = whole ? { s: t, spans: [] } : protect(t, counter);
    const e = { ar: t, s: p.s, spans: p.spans, out: onlyMarkers(p.s) ? p.s : null, promise: null, whole: !!whole };
    const gl = glossaryFor(lang, t); const earlier = seenAr.join('\n');
    const already = gl.filter((g) => earlier.includes(g.ar)); const fresh = gl.filter((g) => !earlier.includes(g.ar));
    const head = (fresh.length ? 'GLOSSARY (Arabic => ' + langRow(lang).name + ' meaning):\n' + fresh.map((g) => `${g.ar} => ${g.en}${g.definition ? ' : ' + g.definition : ''}`).join('\n') + '\n' : '')
      + (already.length ? 'ALREADY_EXPLAINED: ' + already.map((g) => g.ar).join(', ') + '\n' : '');
    const withMarkers = !!p.s.match(MARKER);
    const system = answerSystem(lang, withMarkers);
    if (e.out != null) { e.promise = Promise.resolve(); entries.set((whole ? 'W:' : '') + t, e); return; }
    e.promise = (async () => {
      await slot();
      try {
        const r = await translateOneUnit({ s: p.s, system, head, translate, lang });
        e.out = r.out; e.codes = r.codes;
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
    /** why the parallel translations that failed failed, as short letter strings (the log carries these, never text) */
    failures() { const o = []; for (const [k, e] of entries) if (e.out == null && e.codes && e.codes.length) o.push((e.whole ? 'W' : 'P') + String(e.ar.length) + ':' + e.codes.join(',')); return o; },
    /** why a final paragraph was not taken from the parallel path, as one letter (a diagnostic: the log never carries the text) */
    why(ar) { return skipped.get(ar) || 'E'; },
  };
}

/**
 * @param {string} arabic the finished Arabic answer
 * @param {{lang:string, emit?:(s:string)=>void, translate?:Function, concurrency?:number}} o
 * @returns {Promise<{text:string, stats:object, degraded:string[]}>}
 */
export async function translateAnswer(arabic, { lang, emit = () => {}, translate: translateIn = callTranslator, concurrency = 6, spec = null, budgetMs = BUDGET_MS, now = Date.now }) {
  const translate = budgeted(translateIn, now() + budgetMs, now);
  let keptArabic = false; let noticed = false;
  const notice = () => { if (noticed) return ''; noticed = true; return translationNotice(lang) + '\n\n'; };
  // J (amendment 9): the line stands before EVERY stretch of parts that is shown in Arabic (one line at the top left the later Arabic paragraphs unmarked among translated ones)
  const notesSeen = new Set();
  let arRun = false; const noticeRun = () => { if (arRun) return ''; arRun = true; noticed = true; return translationNotice(lang) + '\n\n'; };
  const pieces = splitAnswer(String(arabic || ''));
  // K2 (amendment 10): the places the answer itself names -- its verse cards, and Ayat al-Kursi -- settle a fragment that stands in more than one place of the mushaf (findQuranRange)
  const hints = [];
  for (const pc of pieces) if (pc.type === 'tag' && pc.name === 'verse') { const sn = parseInt(attr(pc.attrs, 'surah_num'), 10); const mm = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(attr(pc.attrs, 'ayah').trim()); if (sn && mm) hints.push({ s: sn, from: +mm[1], to: mm[2] ? +mm[2] : +mm[1] }); }
  if (foldArabic(arabic).includes('ايه الكرسي')) hints.push({ s: 2, from: 255, to: 255 });
  // L: the cards of the answer (verse cards, and surah cards by their range) settle fragments too; a verse shown as a card prints its translation itself, so the prose carries its reference only
  const cardKeys = [];
  for (const pc of pieces) if (pc.type === 'tag' && (pc.name === 'verse' || pc.name === 'surah')) { const r = cardRange(pc); if (r) { hints.push(r); if (r.from === r.to) cardKeys.push('Q' + r.s + ':' + r.from); } }
  const counter = { n: 0 };
  const stats = { units: 0, batches: 0, batchRetries: 0, batchesKeptArabic: 0, unitsKeptArabic: 0, quran: 0, hadith: 0, unmatched: 0, repeated: 0, lifted: 0, cardsAdded: 0, specUnits: 0, specHits: 0, specMisses: 0 };
  const degraded = [];
  // 1. every translatable string becomes a unit; remember where it goes back.
  const units = [];
  // A scholar's text (the fatwa block, a book passage) is translated WHOLE, quotations inside it included: it is a card of its
  // own labelled as a translation and the Arabic above it holds every quotation once, so no marker rides in it -- the long
  // units are exactly where a model dropped a marker, and a dropped marker sent the whole unit back Arabic.
  const addUnit = (str, whole) => { const p = whole ? { s: str, spans: [] } : protect(str, counter); const u = { s: p.s, spans: p.spans, ar: str, out: onlyMarkers(p.s) ? p.s : null, whole: !!whole, pre: null }; units.push(u); return u; };
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
  for (const u of units.filter((x) => !x.pre && x.out == null)) {
    // a long paragraph is a batch of its own, and is cut into sentences that are translated side by side (translateOneUnit)
    if (u.s.length > SPLIT_CHARS) { if (cur.length) { batches.push(cur); cur = []; size = 0; } batches.push([u]); continue; }
    if (cur.length && size + u.s.length > (batches.length === 0 ? FIRST_BATCH_CHARS : BATCH_CHARS)) { batches.push(cur); cur = []; size = 0; } cur.push(u); size += u.s.length;
  }
  if (cur.length) batches.push(cur);
  stats.batches = batches.length;
  const seenAr = []; const promises = []; const printed = new Set(cardKeys);
  let running = 0; const waiters = [];
  const slot = async () => { if (running >= concurrency) await new Promise((r) => waiters.push(r)); running++; };
  const free = () => { running--; const w = waiters.shift(); if (w) w(); };
  const startBatch = (batch, bi, track, late) => {
    const arText = batch.map((u) => u.ar).join('\n');
    const gl = glossaryFor(lang, arText); const earlier = seenAr.join('\n'); if (track) seenAr.push(arText);
    const already = gl.filter((g) => earlier.includes(g.ar)); const fresh = gl.filter((g) => !earlier.includes(g.ar));
    const head = (fresh.length ? 'GLOSSARY (Arabic => ' + langRow(lang).name + ' meaning):\n' + fresh.map((g) => `${g.ar} => ${g.en}${g.definition ? ' : ' + g.definition : ''}`).join('\n') + '\n' : '')
      + (already.length ? 'ALREADY_EXPLAINED: ' + already.map((g) => g.ar).join(', ') + '\n' : '');
    if (batch.length === 1 && batch[0].s.length > SPLIT_CHARS) {
      const u = batch[0];
      return (async () => {
        await slot();
        try {
          const r = await translateOneUnit({ s: u.s, system: answerSystem(lang, !!u.s.match(MARKER)), head, translate, lang });
          if (r.out != null) u.out = r.out; else { stats.unitsKeptArabic++; degraded.push('lang:units_kept_arabic:' + bi + ':1:' + r.codes.slice(0, 8).join(',')); }
        } finally { free(); }
      })();
    }
    // one call per partition: strings with markers / strings without
    const partitions = [
      { withMarkers: true, idx: batch.map((u, i) => (u.s.match(MARKER) ? i : -1)).filter((i) => i >= 0) },
      { withMarkers: false, idx: batch.map((u, i) => (u.s.match(MARKER) ? -1 : i)).filter((i) => i >= 0) },
    ].filter((p) => p.idx.length);
    const doPartition = async (part) => {
      const units = part.idx.map((i) => batch[i]);
      const user = head + 'INPUT:\n' + JSON.stringify(units.map((u) => u.s));
      const system = answerSystem(lang, part.withMarkers);
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
            const okMk = sameMarkers(units[i].s, t); const full = !!t.trim(); const arOk = arabicOk(units[i].s, t, lang);
            if (!(okMk && full && arOk)) { bad.push(i); if (why.length < 3) why.push(i + ':' + (!full ? 'empty' : !okMk ? 'markers' : 'arabic') + ':src' + units[i].s.length + '/out' + t.length + ':' + (units[i].s.match(MARKER) || []).length + '>' + (t.match(MARKER) || []).length); }
          });
          // A refused unit is not asked again as the next call of this batch (measured: five calls of 17 s one after another, then Arabic): it goes at once
          // to translateOneUnit below, which cuts it into sentences and tries the lines and the whole at the same time.
          if (!best || bad.length < best.bad.length) best = { arr, bad };
          if (!bad.length || !late) break;
          degraded.push('lang:batch_try' + attempt + ':' + bi + (part.withMarkers ? 'm' : 'p') + ':units_damaged:' + bad.slice(0, 6).join('/') + ':' + why.join(','));
        } else {
          // the reason, as codes (never the text): the log is how a failed batch is told apart from a slow one
          degraded.push('lang:batch_try' + attempt + ':' + bi + (part.withMarkers ? 'm' : 'p') + ':' + (!r.ok ? 'http' + (r.status || 0) : 'shape:len' + String(r.text || '').length + '/n' + units.length));
        }
      }
      // Before a unit is given up on it is asked ALONE (and by its lines): a batch whose reply was not an array of the right length twice, or a unit that stayed
      // bad inside an otherwise good batch, is not the unit's own failure.
      const alone = async (list, tried) => {
        const left = list.slice(0, 8);
        const rs = await Promise.all(left.map((u) => translateOneUnit({ s: u.s, system, head, translate, lang, tried })));
        let kept = Math.max(0, list.length - left.length);
        rs.forEach((r, k) => { if (r.out != null) left[k].out = r.out; else kept++; });
        return kept;
      };
      if (best && best.bad.length < units.length) {
        best.arr.forEach((t, i) => { if (!best.bad.includes(i)) units[i].out = t; });
        if (best.bad.length) {
          const kept = late ? best.bad.length : await alone(best.bad.map((i) => units[i]), true);
          if (kept) { stats.unitsKeptArabic += kept; degraded.push('lang:units_kept_arabic:' + bi + ':' + kept); }
        }
        return;
      }
      const keptAll = late ? units.length : await alone(units, !!best);   // a unit the parallel path already tried alone gets ONE more ordinary attempt here, not the whole ladder again
      if (keptAll < units.length) { if (keptAll) { stats.unitsKeptArabic += keptAll; degraded.push('lang:units_kept_arabic:' + bi + ':' + keptAll); } degraded.push('lang:batch_alone:' + bi); return; }
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
      stats.specMisses++; await startBatch([u], 'late' + (++lateN), false, true);
    })();
    return u.preP;
  };
  const render = async (u, bare, lift) => { await (u.pre ? settlePre(u) : promises[batchOf.get(u)]); if (u.out == null) keptArabic = true; return u.out == null ? restoreArabic(u.s, u.spans) : restore(lang, u.whole ? u.out : (langRow(lang).script === 'arab' ? u.out : dropArabicGloss(u.out, !!bare)), u.spans, stats, printed, hints, lift); };
  // 3. emit in order.
  let full = '';
  const push = (s) => { if (!s) return; full += s; emit(s); };
  const joinLines = async (lines, bare) => { const out = []; for (const l of lines) out.push(l.raw !== undefined ? l.raw : l.bullet + (await render(l.unit, bare)).replace(/\n/g, ' ')); return out.join('\n'); };
  const deferred = new Map();
  const flushDeferred = (pi) => { if (deferred.has(pi)) { push('\n\n' + deferred.get(pi).replace(/^\n+/, '')); deferred.delete(pi); } };
  for (const [pi, p] of plan.entries()) {
    const pc = p.pc;
    if (pc.type !== 'text') arRun = false;
    if (pc.type === 'text') {
      // paragraph by paragraph: each leaves as soon as ITS batch has settled and every paragraph before it has left (h8)
      for (const part of p.parts) {
        if (part.raw !== undefined) { push(part.raw); continue; }
        const lift = part.unit.whole ? null : { cards: [] };
        const t = part.unit.whole ? await render(part.unit) : dropRepeatedNotes(await render(part.unit, false, lift), notesSeen);
        push(part.lead + (part.unit.out == null ? noticeRun() : (arRun = false, '')) + (lift && lift.cards.length ? withCards(t, lift.cards) : t) + part.trail);
      }
      if (p.fatwa) {
        // the scholar's text stays Arabic, byte for byte. L: the ORDER is the same in every language -- the source card, its translation, then the Arabic: the block waits for the card that
        // carries its translation (and is shown after it); with no card, the labelled translation paragraph comes first and the Arabic after it
        if (p.fatwa.at === null) {
          const t = (await render(p.fatwa.unit)).replace(/^\s*#+\s*/, '').replace(/[<>]/g, ' ').replace(/[\u00AB\u00BB\uFD3E\uFD3F]/g, '').trim();
          push('\n\n**' + (langRow(lang).labels.translation) + ':** ' + t + '\n\n');
          push(p.fatwa.raw);
        } else deferred.set(p.fatwa.at, p.fatwa.raw);
      }
      continue;
    }
    if (pc.name === 'verse') {
      let a = pc.attrs; const sn = parseInt(attr(a, 'surah_num'), 10); const mm = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(attr(a, 'ayah').trim());
      const range = sn && mm ? { s: sn, from: +mm[1], to: mm[2] ? +mm[2] : +mm[1] } : (pc.content.trim() ? findQuranRange(pc.content, hints) : null);
      const line = quranLine(lang, range);
      if (line) { printed.add(line.key); a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; if (line.notes) a += ` trn="${b64(line.notes)}"`; stats.quran++; }
      push(`<verse${verseAttrs(lang, a, range)}>${pc.content}</verse>`); continue;
    }
    if (pc.name === 'surah') {
      // L: a surah card of ONE verse is a verse card (with its translation and a caption of one number); a short range keeps its card and the published translation follows it
      const r = cardRange(pc); const line = r ? quranLine(lang, r) : null;
      if (r && r.from === r.to) { if (line) { printed.add(line.key); stats.quran++; } stats.cardsAdded++; push(verseCardTag(lang, r, line)); continue; }
      push(pc.raw);
      if (r && line && r.to - r.from < SURAH_TR_MAX) { printed.add(line.key); stats.quran++; push(`\n\n“${line.text}” — ${line.src}\n\n`); }
      continue;
    }
    if (pc.name === 'hadith') {
      let a = pc.attrs; const line = hadithLine(lang, pc.content);
      if (line) { printed.add(line.key); a += ` tr="${b64(line.text)}" trs="${noQuotes(line.src)}"`; stats.hadith++; }
      push(`<hadith${a}>${pc.content}</hadith>`); continue;
    }
    if (pc.name === 'book') {
      let a = pc.attrs;
      if (p.unit) a += ` tl="${b64(dropRepeatedNotes(await render(p.unit), notesSeen).trim())}"`; else if (p.matnTooLong) degraded.push('lang:matn_too_long_kept_arabic');
      if (p.tb) a += ` tb="${b64(blockText(dropRepeatedNotes(await render(p.tb), notesSeen)))}"`;
      push(`<book${a}>${pc.content}</book>`); flushDeferred(pi); continue;
    }
    if (pc.name === 'source') {
      let a = pc.attrs; if (p.unit) a += ` tl="${b64(noQuotes(dropRepeatedNotes(await render(p.unit), notesSeen)))}"`;
      if (p.tb) a += ` tb="${b64(blockText(dropRepeatedNotes(await render(p.tb), notesSeen)))}"`;
      push(`<source${a}>${pc.content}</source>`); flushDeferred(pi); continue;
    }
    if (pc.name === 'steps') {
      let a = pc.attrs; if (p.title) { const t = noQuotes(await render(p.title)); a = a.replace(/(\btitle=)["'][^"']*["']/, `$1"${t}"`); }
      push(`<steps${a}>${await joinLines(p.lines)}</steps>`); continue;
    }
    if (pc.name === 'suggestions') { push(`<suggestions${pc.attrs}>${await joinLines(p.lines, true)}</suggestions>`); continue; }
    if (pc.name === 'board' || pc.name === 'document') { push(`<${pc.name}${pc.attrs}>${p.unit ? await render(p.unit) : pc.content}</${pc.name}>`); continue; }
    push(pc.raw);
  }
  for (const pi of [...deferred.keys()]) flushDeferred(pi);   // a scholar's text whose card never came is shown where the answer ends
  if (keptArabic && !noticed) push('\n\n' + notice().trim() + '\n');
  const a = countSacred(arabic); const e = countSacred(full);
  // Beside a quotation the published translation is printed in parentheses, never as a second quotation:
  // so the count of verses and hadiths in the output is exactly the count in the Arabic.
  if (a.total + stats.cardsAdded !== e.total) degraded.push(`lang:count_mismatch:${a.total}+${stats.cardsAdded}/${e.total}`);   // a verse card made out of an unmarked stretch or a one-verse surah card is a card the Arabic did not count
  return { text: full, stats: { ...stats, sacredAr: a.total, sacredOut: e.total }, degraded };
}
