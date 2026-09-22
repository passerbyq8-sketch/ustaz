// lib/repeated-matn.js — ONE MATN IS NOT DELIVERED TWICE IN ONE ANSWER.
//
// ── THE DEFECT, AS THE OWNER MET IT ──────────────────────────────────────────
// «ما صفة صلاة الاستخارة؟ مع تخريج حديثها.», طالب علم. In ONE answer:
//
//   * Jābir's ḥadīth and the istikhāra duʿāʾ arrived TWICE IN FULL — once in a card headed
//     «دعاء صلاة الاستخارة — حصن المسلم» without full vowelling, and once in a card headed
//     «من السنة النبوية» with the same words vowelled and carrying the grade «صحيح».
//   * The sentence describing how the prayer is performed arrived THREE times in near-identical
//     wordings: short prose, long prose, and a card headed «صِفَةُ صَلَاةِ الاسْتِخَارَة».
//
// ── SO THE RULE IS A RULE, NOT A CASE ────────────────────────────────────────
// One matn is not handed to the reader twice in one answer EVEN IF its source, its card, its
// vowelling or its punctuation differ. Round one closed the narrow half of this — a rewrite that
// restated its own head with one harakah more (lib/free-brain/loop.js, restateKey). That walk
// compares a rewrite against what was already emitted, in one block type, at one seam. This is
// the wider rule, and it is asked at the seat where every exit arrives and the WHOLE answer is
// visible: lib/finalize-reader-text.js.
//
// ── WHY HERE AND NOT IN THE REVIEWER ─────────────────────────────────────────
// Two of the four block kinds that can carry a matn are EMPTY on the wire: `<dhikr id="26">` and
// `<worship id="salah">` are resolved by the client out of adhkar.json and worship-display.json.
// A rule that cannot read those two corpora cannot see the owner's first witness at all, because
// one of its two copies is a card id. lib/output-reviewer.js deliberately reads no file and must
// go on reading none, so the comparison is made here, where reading one is ordinary.
//
// ── AND WHY REMOVING TEXT HERE WITHDRAWS NOTHING ─────────────────────────────
// Measured, not assumed: no exit in this repository supplies `options.earlyRelease` to
// lib/finalized-sse-writer.js — api/ask.js:1129 states it in the open («Without
// `options.earlyRelease` the writer holds every frame until `flush()`, so the finalizer still
// sees the whole answer before anything moves»). So at this seat no byte has been read, and a
// block dropped here was never on the reader's screen. If a later phase earns early release,
// this rule must be handed the released prefix and must refuse to touch inside it.
//
// ── THE SAFETY DIRECTION IS WRITTEN INTO EVERY DECISION ──────────────────────
// «الخطأُ في الحذفِ أشدُّ من الخطأِ في الإبقاء». A partial overlap is NOT repetition. Two
// narrations with different wordings both stay. One different letter, one negation, one added
// qualifier — both stay. Scripture is never removed, a source chip is never removed, and the
// next-question chips are never removed. Everything below fails towards keeping.

import { normalizeArabic } from './route-classify.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The problem code a dropped repeat records. A guard pins the code, not a retyped string. */
export const REPEATED_MATN = 'REPEATED_MATN';

// ── THE FLOOR, AND WHY IT IS HIGHER THAN THE IDENTIFIER'S ────────────────────
// lib/frozen-text.js answers «is this phrase the Qur'an?» and can afford 3 words / 12 chars,
// because being wrong there costs a lookup. Being wrong HERE costs the reader a block of an
// answer, so the floor is set where a shared formula cannot reach it: «وصلى الله على نبينا محمد
// وعلى آله وصحبه وسلم» is 9 words and 55 characters normalized and ends most answers in this
// app, so words alone would not do it — the pair below is what keeps a closing formula, a
// basmala or a «والله أعلم» from ever being read as a repeated matn.
export const MIN_WORDS = 12;
export const MIN_CHARS = 60;

// The ten names the client parses back out of one flat string (index.html EZIK_CARD_TAG_RE,
// mirrored in lib/output-reviewer.js CARD_TAG_NAMES). Written once, read three ways below.
const CARD_NAMES = ['verse', 'surah', 'hadith', 'steps', 'suggestions', 'source', 'board',
  'document', 'dhikr', 'worship'];
const BLOCK_RE = new RegExp(
  '<(' + CARD_NAMES.join('|') + ')\\b([^>]*?)(?:/>|>([\\s\\S]*?)</\\1\\s*>)', 'giu');

// NEVER A CANDIDATE, IN EITHER DIRECTION — not compared, not kept, not dropped:
//   verse / surah   scripture. The app's own boundary for «leave this byte for byte».
//   source          the attribution chip itself. Removing one is losing a citation.
//   suggestions     the chips under the reply are the reader's NEXT question, not an answer.
const NEVER = new Set(['verse', 'surah', 'source', 'suggestions']);

// AND NOR IS A BLOCK THAT CARRIES SCRIPTURE INSIDE IT, whatever kind it is. The ornate
// parentheses U+FD3F..U+FD3E are this application's own boundary for «this is revelation, leave
// it byte for byte» — index.html honours it, the tashkeel stripper refuses to cross it, and
// lib/output-reviewer.js quotes it by name. A prose line that quotes an āyah is a line quoting
// revelation, and this rule will not be the first thing in the tree to delete one.
const QURAN_SPAN_RE = /﴿[\s\S]*?﴾/u;

const attr = (attrs, name) => {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'iu').exec(String(attrs || ''));
  return m ? m[1].trim() : '';
};
const stripMarkup = (s) => String(s || '').replace(/<[^>]*>/gu, ' ');
const norm = (s) => normalizeArabic(stripMarkup(s));
const bigEnough = (n) => n.length >= MIN_CHARS && n.split(' ').filter(Boolean).length >= MIN_WORDS;

// ── THE TWO CORPORA THE CLIENT DRAWS THE EMPTY CARDS FROM ────────────────────
// Lazy and cached, and NOT read at all unless the answer actually carries one of the two tags:
// an answer that never mentions a dhikr must not pay to load 267 of them. The resolver is the
// repo's own idiom for a data file that must survive bundling (lib/frozen-text.js, encyclopedia).
let _dhikr = null;
let _worship = null;
function readJson(...names) {
  for (const n of names) {
    for (const p of [join(process.cwd(), n), join(HERE, '..', n), join(HERE, n)]) {
      if (existsSync(p)) {
        try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
      }
    }
  }
  return null;
}
/** Every dhikr of one category, joined as the card draws them — categoryId -> text. */
function dhikrText(categoryId) {
  if (_dhikr === null) {
    _dhikr = new Map();
    const doc = readJson('adhkar.json', 'lib/data/adhkar.json');
    const list = doc && Array.isArray(doc.adhkar) ? doc.adhkar : [];
    for (const d of list) {
      if (!d || d.text == null) continue;
      const key = String(d.categoryId);
      _dhikr.set(key, (_dhikr.get(key) ? _dhikr.get(key) + ' ' : '') + String(d.text));
    }
  }
  return _dhikr.get(String(categoryId)) || '';
}
/** Every arm of one worship cell, joined — the card draws one, and either is the same matn. */
function worshipText(id) {
  if (_worship === null) {
    _worship = new Map();
    const doc = readJson('worship-display.json');
    const cells = doc && doc.cells && typeof doc.cells === 'object' ? doc.cells : {};
    for (const [key, cell] of Object.entries(cells)) {
      const base = String(key).split(':')[0];
      const text = cell && typeof cell.text === 'string' ? cell.text : '';
      if (!text) continue;
      _worship.set(base, (_worship.get(base) ? _worship.get(base) + ' ' : '') + text);
    }
  }
  return _worship.get(String(id)) || '';
}

// ── HOW FULL A BLOCK'S SANAD IS ──────────────────────────────────────────────
// «يُبقى الأكملُ سندًا — صاحبُ التخريجِ أو الحكمِ أو المصدرِ المسمّى». Four rungs, and the
// ordering is the owner's sentence read left to right: a takhrij AND a grade beats one of them,
// which beats a named compilation, which beats prose that names nobody.
function sanad(kind, attrs, body) {
  if (kind === 'hadith') {
    const narrator = attr(attrs, 'narrator');
    const ruling = attr(attrs, 'ruling');
    if (narrator && ruling) return 3;
    if (narrator || ruling) return 2;
    return 1;
  }
  if (kind === 'dhikr' || kind === 'worship') return 1;
  return /المصدر\s*:/u.test(String(body || '')) ? 1 : 0;
}

// The name a dropped block would take with it. Only a block whose source is NAMED has one:
// prose that cites nobody takes nothing away when it goes.
function citation(kind, attrs) {
  if (kind === 'dhikr') return 'حصن المسلم';
  if (kind === 'hadith') return attr(attrs, 'ruling');
  return '';
}

// ── A BLOCK THE PROSE POINTS BACK AT IS NOT REMOVED ──────────────────────────
//
// MEASURED, 18 September 2026, on the owner’s own witness «ما صفة صلاة الاستخارة؟ مع تخريج
// حديثها.»: the model’s prose said «وكما رأيت في الوسم أعلاه». «الوسم» is this application’s
// OWN word for a card — lib/system-prompt.js teaches it («أخرِجْ وسمَ dhikr», «الوسمَ العاريَ
// <hadith>») and :360 expressly invites the model to comment on one. So the model points BACK
// at a card it has just written, and the rule below would take that card away and leave the
// pointer standing, referring the reader to something no longer on the screen.
//
// THE CHOICE BETWEEN THE TWO REPAIRS IS NOT MINE TO MAKE: the order states it — «والأسلمُ: لا
// تُحذَفْ كتلةٌ مُشارٌ إليها». Correcting the prose instead would mean rewriting the model’s own
// sentence, which costs the reader more than the repeat it would save. So the block stays, the
// answer is longer than it needs to be, and that is the direction this whole file fails in.
//
// IT IS THE NEAREST CARD ABOVE, AND ONLY THAT ONE. «أعلاه» points at the thing above it. Pinning
// every card in the answer would disarm the rule entirely for any answer that says the word
// once — and the owner’s witness is an answer that says it once and repeats a matn anyway.
// Prose is never pinned and never pins: a line pointing at a line is not what a reader means by
// «الوسم أعلاه», and prose repeating prose is the plainest repeat there is.
//
// The forms are written as `normalizeArabic` leaves them: no harakat, ة→ه, أ→ا, ى→ي.
const BACK_REFERENCE_RE = /(?:اعلاه|في الاعلي|(?:الوسم|البطاقه|الجدول|القائمه|الخطوات) (?:السابق|السابقه))/u;

/** Every block that a prose line below it points back at — the nearest card above each. */
function pinnedByBackReference(all) {
  const pinned = new Set();
  for (let i = 0; i < all.length; i += 1) {
    const line = all[i];
    if (line.kind !== 'prose') continue;
    if (!BACK_REFERENCE_RE.test(norm(line.body))) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (all[j].kind === 'prose') continue;
      pinned.add(all[j]);
      break;
    }
  }
  return pinned;
}

/**
 * Cut one answer into the blocks a reader receives: every card, and every prose line between
 * them. Prose is cut at newlines because that is how the reviewer joins its units and how the
 * client draws its paragraphs — so a «line» here is a thing the reader sees as one thing.
 */
function blocks(text) {
  const out = [];
  const src = String(text == null ? '' : text);
  let at = 0;
  const pushProse = (from, to) => {
    let line = from;
    const slice = src.slice(from, to);
    for (const piece of slice.split('\n')) {
      const start = line;
      line += piece.length + 1;
      if (piece.trim()) out.push({ kind: 'prose', start, end: start + piece.length, attrs: '', body: piece });
    }
  };
  BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = BLOCK_RE.exec(src)) !== null) {
    if (m.index > at) pushProse(at, m.index);
    out.push({ kind: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length, attrs: m[2] || '', body: m[3] || '' });
    at = m.index + m[0].length;
  }
  if (at < src.length) pushProse(at, src.length);
  return out;
}

/** The text a block actually delivers, resolved for the two kinds that are empty on the wire. */
function delivered(block) {
  if (block.kind === 'dhikr') return dhikrText(attr(block.attrs, 'id'));
  if (block.kind === 'worship') return worshipText(attr(block.attrs, 'id'));
  return block.body;
}

/**
 * ONE MATN, ONCE.
 *
 * Returns `{ text, dropped }` where `dropped` lists what was removed and why. `text` is the
 * input verbatim when nothing repeats — the common case, and it costs one pass and no file read.
 *
 * @param {string} input the assembled answer, cards inline
 * @returns {{text: string, dropped: Array<{kind: string, keptKind: string, reason: string, chars: number}>}}
 */
export function dropRepeatedMatn(input) {
  const src = String(input == null ? '' : input);
  const dropped = [];
  if (!src) return { text: src, dropped };

  // The pins are read from EVERY block, including the four in NEVER: a `<verse>` between the
  // pointer and the card is still what the pointer skipped over, so «nearest» has to be able
  // to see it. Pinning a block that was never a candidate costs nothing.
  const all = blocks(src);
  const pinned = pinnedByBackReference(all);
  const list = all.filter((b) => !NEVER.has(b.kind));
  // Nothing is resolved and no corpus is read until at least two blocks could possibly pair.
  if (list.length < 2) return { text: src, dropped };
  for (const b of list) {
    const text = delivered(b);
    b.key = norm(text);
    b.rank = sanad(b.kind, b.attrs, b.body);
    // `big` is what makes a block a CANDIDATE at all — for removal and for keeping. Scripture
    // fails it on purpose: a block holding an āyah is never compared and so is never removed,
    // and it cannot make another block removable either.
    b.big = bigEnough(b.key) && !QURAN_SPAN_RE.test(String(text));
  }

  const cut = new Set();
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.big || cut.has(a)) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.big || cut.has(b)) continue;
      // THE COMPARISON CROSSES THE KINDS AND CROSSES THE DISTANCE. Card against card, card
      // against prose, prose against prose; adjacent or half an answer apart.
      const same = a.key === b.key;
      // CONTAINMENT, AND ONLY OF A WHOLE BLOCK. A block whose every word already stands, in
      // order and unbroken, inside another block adds nothing to the reader. This is not the
      // «partial match» the order excludes: a shared opening, a shared formula or a shared
      // half leaves the rest of the shorter block outside the longer one and matches nothing
      // here. And only the CONTAINED block is ever a candidate for removal — dropping the
      // container would take the material it holds beyond the repeat with it.
      const aInB = !same && b.key.indexOf(a.key) !== -1;
      const bInA = !same && a.key.indexOf(b.key) !== -1;
      if (!same && !aInB && !bInA) continue;

      let drop = null;
      let keep = null;
      if (same) {
        // The fuller sanad stays. Equal sanad: the later copy goes, so the answer keeps the
        // shape it was written in.
        if (a.rank >= b.rank) { keep = a; drop = b; } else { keep = b; drop = a; }
      } else {
        const inner = aInB ? a : b;
        const outer = aInB ? b : a;
        // The contained block is the only removable one — and it is NOT removed when its own
        // sanad is the fuller of the two, because then removing it would trade a graded text
        // for an ungraded one. Both stay, and the answer is longer than it needs to be, which
        // is the direction this rule is required to fail in.
        if (inner.rank > outer.rank) continue;
        keep = outer; drop = inner;
      }
      // NEITHER block goes when the one that would go is pointed at. Dropping the OTHER one
      // instead is not a repair: in the `same` branch the other is the fuller sanad, and in the
      // `contained` branch the other is the container, whose material reaches past the repeat.
      if (pinned.has(drop)) continue;
      cut.add(drop);
      drop.keptKind = keep.kind;
      drop.reason = same ? 'identical' : 'contained';
      drop.keep = keep;
      if (drop === a) break;
    }
  }
  // ── BATCH 4 [b15] · BELOW THE FLOOR, ONLY WHAT IS A REPEAT BY ITS OWN SHAPE ─────────────
  // MEASURED at 2aaf987 and 92d3c7d (EZIK-CX-M111 rows 15 and 16): «اختلف علماء الحديث في درجة هذا
  // الحديث.» stood twice in one part, and «من حسن إسلام المرء تركه ما لا يعنيه» in two prose lines —
  // both under the 12-word / 60-character floor above, which is written for a SHARED FORMULA and
  // lets a short repeat through. The owner's contract: the repeated preamble stays once, the first,
  // and nothing that is not a repeat goes. So below the floor one shape is read, a repeat by its
  // shape alone: a prose line identical to an earlier prose line — three words at least, and not a
  // list item (two lists may share an item and are not a repeat): the later one goes. A pinned
  // block («الوسم أعلاه») and scripture stay, exactly as above.
  const LIST_ITEM = /^\s*(?:[-*•]|\d{1,2}[.)-]|[٠-٩]{1,2}[.)-])\s/u;
  // [111-d59] — A LINE OF DIALOGUE IS NOT A REPEATED MATN. MEASURED on the owner's battery (fix round,
  // question 11, «فضائل أبي عبيدة»): the second «قيل: ثم من؟» went as a repeat of the first, and the
  // dialogue it belonged to broke. THE OWNER'S CONTRACT: this shape is for a repeated matn — a quoted text
  // or a card — and not for a short line that a dialogue rightly says twice («قيل: ثم من؟»، «قال: نعم.»،
  // «فقال: لا.»). So a line that opens on a verb of saying with no named speaker, then its colon, and
  // carries no quotation, is never cut here. What b15 and b16 keep is kept as before.
  const DIALOGUE_LINE = /^[\s\u064B-\u065F\u0670]*[وف]?(?:قيل|قال|قالت|قلت|قلنا|قالوا|قلتم|سئل|سئلت)[\u064B-\u065F\u0670]*(?:\s+(?:له|لها|لهم|لهما)[\u064B-\u065F\u0670]*)?\s*[:：]/u;
  const isDialogueLine = (body) => DIALOGUE_LINE.test(body) && !/[«"“»”]/u.test(body);
  const prose = all.filter((b) => b.kind === 'prose' && !cut.has(b) && !QURAN_SPAN_RE.test(b.body));
  const words = (k) => k.split(' ').filter(Boolean).length;
  for (let i = 0; i < prose.length; i += 1) {
    const a = prose[i];
    const ak = norm(a.body);
    for (let j = i + 1; j < prose.length; j += 1) {
      const b = prose[j];
      if (cut.has(b) || pinned.has(b) || LIST_ITEM.test(b.body) || LIST_ITEM.test(a.body)) continue;
      if (isDialogueLine(b.body)) continue; // [111-d59]
      if (ak && ak === norm(b.body) && words(ak) >= 3) {
        cut.add(b); b.keptKind = 'prose'; b.reason = 'identical-line'; b.keep = a;
      }
    }
  }
  // ── BATCH 4 [b16] · THE MATN ONCE — IN THE CARD, WHERE THERE IS ONE ─────────────────────
  // MEASURED (EZIK-CX-M111 row 16; the battery's الحائض والقرآن and طواف الإفاضة): a matn line and
  // then a card with the same matn, and after the seal dissolved a card whose credit no page carried,
  // «…» standing alone on a line under a sentence that already quotes it. Two more shapes, each a
  // repeat by its shape alone:
  //   (2) a line that is only the matn and the words that frame it («قال رسول الله ﷺ: «…»») where a
  //       <hadith> card carries that matn: the line goes, the card stays;
  //   (3) a line that is only a quoted matn («…», four words at least) where another prose line
  //       already carries it: the bare line goes.
  // A line that carries anything more — a ruling, a grade, an argument — is not a matn line and
  // stays, whatever card follows it.
  const FRAME_ONLY = /^[\s«»"“”().،:؛]*(?:(?:[وف]?(?:قال|قوله|لقوله|لقول|يقول))\s+)?(?:(?:النبي|نبينا|رسول الله|الرسول)\s*)?(?:(?:صلى الله عليه وسلم|ﷺ|عليه الصلاة والسلام)\s*)?[:\s.،؛!؟]*$/u;
  const QUOTED_RE = /[«"“]([^«»"“”]+)[»"”]/u;
  const cards = all.filter((b) => b.kind === 'hadith' && !cut.has(b));
  for (const line of prose) {
    if (cut.has(line) || pinned.has(line)) continue;
    const q = QUOTED_RE.exec(line.body);
    if (!q) continue;
    const mk = norm(q[1]);
    if (words(mk) < 4) continue;
    const rest = line.body.slice(0, q.index) + line.body.slice(q.index + q[0].length);
    if (!FRAME_ONLY.test(norm(rest)) && !FRAME_ONLY.test(rest)) continue;
    const bare = !norm(rest).trim();
    const card = cards.find((c) => norm(c.body) === mk || norm(c.body).indexOf(mk) !== -1);
    if (card) { cut.add(line); line.keptKind = 'hadith'; line.reason = 'matn-line-beside-card'; line.keep = card; continue; }
    if (!bare) continue;
    const holder = prose.find((p) => p !== line && !cut.has(p) && norm(p.body) !== mk && norm(p.body).indexOf(mk) !== -1);
    if (holder) { cut.add(line); line.keptKind = 'prose'; line.reason = 'bare-matn-line'; line.keep = holder; }
  }
  if (!cut.size) return { text: src, dropped };

  // THE REMOVED BLOCK'S REFERRAL GOES TO THE ONE THAT STAYS, when it names a source the answer
  // would otherwise lose. «ولا تُفقَدُ نسبةٌ بحجّةِ إزالةِ تكرار»: the name is only appended
  // when it is nowhere else in what survives, so a source the answer still states is not
  // stated twice for the sake of it.
  const order = [...cut].sort((x, y) => y.start - x.start);
  let text = src;
  const carry = new Map();
  for (const block of order) {
    const name = citation(block.kind, block.attrs);
    // A block that stood alone on its line takes that line's newline with it, so removing it
    // leaves the answer's paragraphing exactly as it was rather than a gap where a card was.
    let from = block.start;
    let to = block.end;
    while (to < text.length && /[^\S\n]/u.test(text[to])) to += 1;
    while (from > 0 && /[^\S\n]/u.test(text[from - 1])) from -= 1;
    if ((from === 0 || text[from - 1] === '\n') && text[to] === '\n') to += 1;
    text = text.slice(0, from) + text.slice(to);
    dropped.push({ kind: block.kind, keptKind: block.keptKind, reason: block.reason, chars: block.end - block.start });
    // A block's keeper can itself have been cut by a later pair. Walk to the one that is still
    // standing, so a referral is never anchored to something that is no longer in the answer.
    let keep = block.keep;
    while (keep && cut.has(keep)) keep = keep.keep;
    if (name && keep) carry.set(keep, name);
  }
  for (const [keep, name] of carry) {
    if (norm(text).indexOf(norm(name)) !== -1) continue;
    // Behind the block that stayed, on its own line, in the vocabulary the reviewer already
    // uses for a source tail. Never inside a card body: a card body is drawn verbatim, so the
    // referral is placed AFTER the whole block, found by its own raw bytes in the shortened
    // text rather than by an offset the removals have moved.
    const raw = src.slice(keep.start, keep.end);
    const anchor = raw ? text.indexOf(raw) : -1;
    const at = anchor === -1 ? text.length : anchor + raw.length;
    text = text.slice(0, at) + '\n' + 'المصدر: ' + name + '.' + text.slice(at);
  }

  text = text.replace(/[^\S\n]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
  return { text, dropped };
}
