// lib/frozen-text.js
// IS THIS PHRASE THE QUR'AN, OR A KNOWN DHIKR? — deterministic, pure, no model, no network.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────
// Two defects, one missing fact.
//
//   * «ما تفسير «فإن مع العسر يسرًا»؟» was REFUSED. A phrase in quotation marks with no «قوله
//     تعالى» in front of it lit the specific-claim path in lib/claim-gate.js, which asks whether
//     any retrieved page rules on THIS expression — the right question for «يا معطي لا تبطي» and
//     the wrong one for an āyah. The reader quoted the Book and was told nothing had been found
//     about the expression.
//
//   * A drafted sentence quoting a verse or a dhikr must never be run through the hadith takhrij
//     lock in lib/takhrij-lock.js. Those texts carry attributions pinned in worship-golden.json
//     and adhkar.json and asserted by their own guards; a second, weaker check over them could
//     only ever damage what is already proven.
//
// One fact answers both: BEFORE anything decides a quoted phrase is unknown, ask the mushaf.
// 6,236 āyāt and 267 adhkār, matched deterministically, at no cost and with no model.
//
// ── WHAT COUNTS AS A MATCH ───────────────────────────────────────────────────
// The whole phrase, or a CONTIGUOUS run of it, inside ONE āyah or ONE dhikr. Contiguity is the
// whole of the rule: a bag of words drawn from across the mushaf is not a quotation, and treating
// it as one would let any pious-sounding sentence claim to be revelation.
//
// ── THE FLOOR, AND WHY IT IS NOT OPTIONAL ────────────────────────────────────
// «الحمد لله» is an āyah, half of another, and something a person says fifty times a day. Short
// runs of ordinary Arabic appear somewhere in the mushaf almost without exception, so a matcher
// with no floor answers "Qur'an" to everything and is worse than no matcher. Below MIN_WORDS and
// MIN_CHARS the answer is null — not "no", but "this phrase is too short to be an identification".
//
// ── WHY IT IS INDEXED AND LAZY ───────────────────────────────────────────────
// A window scan over 6,236 āyāt for every candidate run of a sentence is millions of substring
// searches, i.e. a check that would be measured once and then disabled. Instead a word TRIGRAM
// index is built on first use — the same lazy shape lib/encyclopedia.js uses, and for the same
// reason: a request that never asks must not pay to load a corpus.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeArabic } from './route-classify.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const norm = (s) => normalizeArabic(String(s == null ? '' : s));

// A quotation shorter than this is not an identification. Measured against the failure mode it
// prevents: «الحمد لله» is two words and eight characters, and is not a citation of 1:2.
export const MIN_WORDS = 3;
export const MIN_CHARS = 12;

// The repo's own idiom for a data file that must survive bundling (lib/encyclopedia.js): try the
// deploy layout first, then module-relative. Nothing here throws at import time — a missing corpus
// degrades to "cannot identify", never to a broken request path.
function resolveData(...names) {
  for (const n of names) {
    for (const p of [join(process.cwd(), n), join(HERE, '..', n), join(HERE, n)]) {
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function readJson(...names) {
  const p = resolveData(...names);
  if (!p) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// ── The index ────────────────────────────────────────────────────────────────
// entries : [{ kind, ref|id, category, n, words }]
// tri     : Map<'w1 w2 w3', number[]>   — trigram -> entry indexes
let _index = null;

function buildIndex() {
  const entries = [];
  const quran = readJson('quran-uthmani.json');
  if (quran && typeof quran === 'object') {
    for (const [ref, text] of Object.entries(quran)) {
      const n = norm(text);
      if (n) entries.push({ kind: 'quran', ref, n, words: n.split(' ') });
    }
  }
  // The ROOT adhkar.json is the golden-pinned copy; lib/data/adhkar.json is the duplicate the
  // codebase already knows about. Either will do for identification, and taking whichever exists
  // means a deploy that ships only one of them still recognises a dhikr.
  const adhkarDoc = readJson('adhkar.json', 'lib/data/adhkar.json');
  const list = adhkarDoc && Array.isArray(adhkarDoc.adhkar) ? adhkarDoc.adhkar : [];
  for (const d of list) {
    const n = norm(d && d.text);
    if (n) entries.push({ kind: 'dhikr', id: d.id, category: (d && d.category) || '', n, words: n.split(' ') });
  }

  const tri = new Map();
  entries.forEach((e, i) => {
    for (let k = 0; k + 3 <= e.words.length; k++) {
      const key = e.words[k] + ' ' + e.words[k + 1] + ' ' + e.words[k + 2];
      let arr = tri.get(key);
      if (!arr) { arr = []; tri.set(key, arr); }
      // The same trigram twice in one āyah adds nothing: the entry is already a candidate.
      if (arr[arr.length - 1] !== i) arr.push(i);
    }
  });
  return { entries, tri };
}

function index() {
  if (!_index) _index = buildIndex();
  return _index;
}

// ── [111-b4b-50] · AN ĀYAH IN THE RASM THE MODEL WRITES ─────────────────────────────────────
//
// MEASURED at eca359e: «إن الصلاة كانت على المؤمنين كتابا موقوتا» is not 4:103 to this file — the
// muṣḥaf writes ٱلصَّلَوٰةَ and كِتَـٰبًا, the model الصلاة and كتابا, and once the harakāt are off the
// words differ. Only a three-word run inside it matched. «وأقيموا الصلاة وآتوا الزكاة», «حافظوا على
// الصلوات والصلاة الوسطى» and «يا أيها الذين آمنوا كتب عليكم الصيام…» matched no whole either, and
// after a sentence naming the Prophet ﷺ the takhrij pass took each for a hadith and bracketed it.
//
// THE MATCH IS ASYMMETRIC, BECAUSE THE DISAGREEMENT IS. The muṣḥaf leaves out an alif the model
// writes only where it writes a dagger alif instead (كِتَـٰبًا، ٱلرَّحْمَـٰنِ) or carries it on a waw
// or a yā (ٱلصَّلَوٰة، ٱلتَّوْرَىٰة) — never the alif of a dual: «رضي الله عنهما» is not «رضي الله
// عنهم» (MEASURED: an alif-blind first version read it as 5:119). So the muṣḥaf keeps its dagger as a
// mark, a model alif may stand against an alif, a dagger, or وٰ/ىٰ, and a dagger the model did not
// write is passed over. The bare hamza (ءامنوا) is read past on both sides, a model space may be
// absent («يا أيها» is one word in the muṣḥaf), and the run begins and ends on the muṣḥaf's own
// word boundaries. A consonant key only nominates āyāt; the pattern decides. It is a SECOND needle,
// tried only where the exact one found nothing, and the floor above is unchanged.
const DAGGER = '\u06D5';
const RASM_KEY_CHARS = 5;
const RASM_MIN_KEY = 6;
const consonantKey = (normalised) => String(normalised).replace(/[\u0627\u06D5\u0648\u064A\u0621\s]/gu, '');
const mushafRasm = (uthmani) => norm(String(uthmani).replace(/\u0670/gu, DAGGER)).replace(/\u0621/gu, '');
const escapeRe = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
function rasmPattern(normalised) {
  const parts = [];
  for (const ch of normalised.replace(/\u0621/gu, '')) {
    if (ch === ' ') parts.push(' ?');
    else if (ch === '\u0627') parts.push('(?:\u0627|[\u0648\u064A]?' + DAGGER + '\u0627?)'); // «ٱلرِّبَوٰا» too
    else parts.push(escapeRe(ch));
  }
  return new RegExp('(?:^| )' + parts.join(DAGGER + '?') + DAGGER + '?(?= |$)', 'u');
}
let _rasm = null;
function rasmIndex() {
  if (_rasm) return _rasm;
  const quran = readJson('quran-uthmani.json');
  const entries = [];
  const keys = new Map();
  if (quran && typeof quran === 'object') {
    for (const [ref, text] of Object.entries(quran)) {
      const rasm = mushafRasm(text);
      const key = consonantKey(rasm);
      if (!key) continue;
      const i = entries.push({ ref, rasm, key }) - 1;
      for (let k = 0; k + RASM_KEY_CHARS <= key.length; k++) {
        const gram = key.slice(k, k + RASM_KEY_CHARS);
        let arr = keys.get(gram);
        if (!arr) { arr = []; keys.set(gram, arr); }
        if (arr[arr.length - 1] !== i) arr.push(i);
      }
    }
  }
  _rasm = { entries, keys };
  return _rasm;
}
function lookupQuranRasm(phrase) {
  if (!longEnough(phrase)) return null;
  const n = norm(phrase);
  const key = consonantKey(n);
  if (key.length < RASM_MIN_KEY) return null;
  const { entries, keys } = rasmIndex();
  const cands = keys.get(key.slice(0, RASM_KEY_CHARS));
  if (!cands) return null;
  const re = rasmPattern(n);
  for (const i of cands) {
    if (entries[i].key.indexOf(key) !== -1 && re.test(entries[i].rasm)) return { ref: entries[i].ref };
  }
  return null;
}

/** Long enough to be an identification rather than a coincidence? */
export function longEnough(phrase) {
  const n = norm(phrase);
  if (!n) return false;
  return n.split(' ').filter(Boolean).length >= MIN_WORDS && n.length >= MIN_CHARS;
}

// The one lookup both public matchers share. Returns the matching entry, or null.
function lookup(phrase, kind) {
  const n = norm(phrase);
  if (!longEnough(n)) return null;
  const w = n.split(' ').filter(Boolean);
  const { entries, tri } = index();
  const cands = tri.get(w[0] + ' ' + w[1] + ' ' + w[2]);
  if (!cands) return null;
  for (const i of cands) {
    const e = entries[i];
    if (kind && e.kind !== kind) continue;
    // The trigram only nominates. Containment is what decides, and it is what makes the match
    // CONTIGUOUS rather than a bag of shared words.
    if (e.n.indexOf(n) !== -1) return e;
  }
  return null;
}

/**
 * Is this phrase — whole, or as a contiguous run inside one āyah — Qur'an?
 * @returns {{ref:string}|null}
 */
export function findQuran(phrase) {
  const e = lookup(phrase, 'quran');
  if (e) return { ref: e.ref };
  return lookupQuranRasm(phrase); // [111-b4b-50]
}

/**
 * Is this phrase a known dhikr, whole or as a contiguous run inside one entry?
 * @returns {{id:number, category:string}|null}
 */
export function findDhikr(phrase) {
  const e = lookup(phrase, 'dhikr');
  return e ? { id: e.id, category: e.category } : null;
}

/**
 * THE ONE CALL EVERY CONSUMER MAKES.
 *
 * QUR'AN IS TESTED FIRST, and the order is not arbitrary: a great many adhkār are built out of
 * āyāt (āyat al-Kursī is dhikr #75 and is also 2:255), so testing dhikr first would file the Book
 * under "supplication" and route a tafsir question to the wrong place.
 *
 * @returns {{kind:'quran', ref:string} | {kind:'dhikr', id:number, category:string} | null}
 */
export function classifyFrozenPhrase(phrase) {
  const q = findQuran(phrase);
  if (q) return { kind: 'quran', ref: q.ref };
  const d = findDhikr(phrase);
  if (d) return { kind: 'dhikr', id: d.id, category: d.category };
  return null;
}

/**
 * Does any contiguous run of `text` identify as a frozen text?
 *
 * LONGEST RUN FIRST. An eight-word run that is an āyah is a better answer than the three-word run
 * inside it, and it is the one a reader would recognise. Bounded by MAX_RUN so a long paragraph
 * cannot turn this into a quadratic scan.
 */
export const MAX_RUN = 24;
export function containsFrozenPhrase(text) {
  const r = containsFrozenRun(text);
  return r ? { kind: r.kind, ref: r.ref, id: r.id, category: r.category, phrase: r.phrase } : null;
}

// Arabic letters, the harakāt, tatwīl and alif wasla. Kept as \u escapes ON PURPOSE: a literal
// Arabic character range in a regex is unreadable in an editor and can byte-reverse on a paste.
export const AR_WORD_RE = /[ء-ْٰٱـ]+/g;

/**
 * The same search, but reporting the run's offsets IN THE ORIGINAL STRING.
 *
 * lib/takhrij-lock.js needs the offsets, not just the fact: its exemption is scoped to the frozen
 * run itself rather than to the sentence containing it, and "this span overlaps an āyah" is a
 * question about positions.
 *
 * @returns {{kind, ref?, id?, category?, phrase, start, end}|null}
 */
export function containsFrozenRun(text) {
  const s = String(text == null ? '' : text);
  const toks = [];
  let m;
  AR_WORD_RE.lastIndex = 0;
  while ((m = AR_WORD_RE.exec(s)) !== null) {
    const b = norm(m[0]);
    if (b) toks.push({ b, start: m.index, end: m.index + m[0].length });
  }
  if (toks.length < MIN_WORDS) return null;
  for (let len = Math.min(toks.length, MAX_RUN); len >= MIN_WORDS; len--) {
    for (let i = 0; i + len <= toks.length; i++) {
      const phrase = toks.slice(i, i + len).map((t) => t.b).join(' ');
      const v = classifyFrozenPhrase(phrase);
      if (v) return { ...v, phrase, start: toks[i].start, end: toks[i + len - 1].end };
    }
  }
  return null;
}
