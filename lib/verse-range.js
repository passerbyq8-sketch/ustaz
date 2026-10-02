// lib/verse-range.js -- THE VERSE CARD SHOWS THE VERSES THE ANSWER QUOTES (order EZIK-COMPREHENSIVE-ORDER-2026-10-02, 3.4g).
//
// THE OWNER'S NOTE 9: «Al-'Asr shown by its first verse only for quoting three» (and «Al-Ma'ida 2 shown whole for quoting one sentence of it»): the card is
// whatever the model's <verse surah_num ayah> says, and the client expands that one verse from the mushaf (never from the model). Nothing on the server
// compared the card with the verses the answer's own prose quotes. MEASURED: an answer that quotes 103:1-3 in a sentence and carries <verse surah_num="103"
// ayah="1"> showed verse 1 only.
//
// WHAT THIS DOES, AND ONLY THIS. It reads the Qur'anic runs of the answer's PROSE (lib/frozen-text.js, the mushaf's own index, exact and rasm) and, for each
// surah the answer carries <verse> cards of, finds the verses of THAT surah the prose quotes. The cards of the surah become one card per verse from the
// first to the last of {the verses quoted, the verses the model's own cards named}. It only WIDENS: a card is never removed for lack of a match (a one-word
// verse such as «والعصر» is below the matcher's floor, and the model's own card is what anchors it); nothing about a verse is ever written by the model or by
// this file -- the tag carries numbers only, as the system prompt requires, and the client reads the text from the mushaf. A range wider than MAX_VERSES is
// left as the model wrote it. A tag with no numeric surah or ayah is left alone. Idempotent.
//
// WHAT IT DOES NOT DO: show part of a verse. A card is a whole verse, and a sentence of a long verse (5:2) is still that verse's card.
//
// Pure: the mushaf index it reads is the one frozen-text.js already loads.
import { quranRunsIn } from './frozen-text.js';

export const MAX_VERSES = 10;
const VERSE_TAG_RE = /<verse\b([^>]*?)(?:>\s*<\/verse\s*>|\/>)/giu;
const ANY_CARD_RE = /<([a-z]+)\b[^>]*>[\s\S]*?<\/\1\s*>|<[a-z]+\b[^>]*\/>/giu;

// the numbers of one attribute: ayah="1" or ayah="1-3" (a range, with a hyphen or an en dash) -> [from, to]
const numbersOf = (attrs, name) => {
  const m = new RegExp(name + '\\s*=\\s*["\']?(\\d+)(?:\\s*[-–]\\s*(\\d+))?', 'u').exec(attrs);
  return m ? [Number(m[1]), m[2] ? Number(m[2]) : Number(m[1])] : null;
};

/**
 * @param {string} text  the reader's text, cards inline
 * @returns {{text:string, widened:Array<{surah:number, from:number, to:number}>}}
 */
export function widenVerseCards(text) {
  const value = String(text == null ? '' : text);
  if (!/<verse\b/iu.test(value)) return { text: value, widened: [] };
  const tags = [];
  VERSE_TAG_RE.lastIndex = 0;
  let m;
  while ((m = VERSE_TAG_RE.exec(value)) !== null) {
    const surah = numbersOf(m[1], 'surah_num');
    const ayah = numbersOf(m[1], 'ayah');
    if (surah && ayah) tags.push({ start: m.index, end: m.index + m[0].length, surah: surah[0], from: Math.min(ayah[0], ayah[1]), to: Math.max(ayah[0], ayah[1]) });
  }
  if (!tags.length) return { text: value, widened: [] };
  const runs = quranRunsIn(value.replace(ANY_CARD_RE, ' '));
  const bySurah = new Map();
  for (const tag of tags) {
    if (!bySurah.has(tag.surah)) bySurah.set(tag.surah, []);
    bySurah.get(tag.surah).push(tag);
  }
  const edits = [];
  const widened = [];
  for (const [surah, own] of bySurah) {
    const quoted = [];
    for (const run of runs) {
      for (const ref of run.refs) {
        const [s, a] = ref.split(':').map(Number);
        if (s === surah) quoted.push(a);
      }
    }
    if (!quoted.length) continue;
    const lo = Math.min(...quoted, ...own.map((t) => t.from));
    const hi = Math.max(...quoted, ...own.map((t) => t.to));
    if (hi - lo + 1 > MAX_VERSES) continue;
    const have = new Set();
    for (const t of own) for (let a = t.from; a <= t.to; a += 1) have.add(a);
    let same = have.size === hi - lo + 1;
    for (let a = lo; a <= hi && same; a += 1) if (!have.has(a)) same = false;
    // already one single-verse card per verse of the range: nothing to do (a range written in one tag is split: the client reads the first number only)
    if (same && own.length === hi - lo + 1 && own.every((t) => t.from === t.to)) continue;
    const cards = [];
    for (let a = lo; a <= hi; a += 1) cards.push('<verse surah_num="' + surah + '" ayah="' + a + '"></verse>');
    edits.push({ start: own[0].start, end: own[0].end, text: cards.join('\n') });
    for (const t of own.slice(1)) edits.push({ start: t.start, end: t.end, text: '' });
    widened.push({ surah, from: lo, to: hi });
  }
  if (!edits.length) return { text: value, widened: [] };
  let out = value;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { text: out, widened };
}
