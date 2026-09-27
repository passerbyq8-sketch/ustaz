// lib/bw2-units.js -- SPEED ITEM 17, STAGE 3: THE WRITER'S TEXT, RELEASED UNIT BY UNIT.
//
// THE OWNER'S CONDITIONS 2 AND 3, IN ONE PLACE. The before-writing path (lib/before-writing-v2.js)
// makes exactly one streamed writer call. Everything that call writes passes through here, one unit
// at a time, in order:
//
//   * a unit is RELEASED the moment it is complete and passes its own check, and what is released is
//     never changed, replaced or sent again;
//   * a unit that fails is HELD -- never sent -- and the stream CONTINUES with the next unit. This is
//     the one deliberate difference from lib/sentence-stream.js:203,210, which stops the rest of the
//     answer at the first unsafe unit;
//   * every normalization (citation syntax, orphan reference numbers, model-written card markup, the
//     takhrij lock, unsourced grades, list renumbering) happens to the unit BEFORE it is released;
//   * a lead-in that ends on a colon waits for the unit it introduces and goes out with it, or is
//     held with it;
//   * a unit carrying a hadith matn is looked up (today's takhrij runner) BEFORE release, and the
//     units behind it wait in order;
//   * right after a released unit that cites a pinned row, that row's card goes out as one whole tag.
//
// WHAT A UNIT IS. A sentence: text up to a full stop / question mark / exclamation mark followed by
// whitespace, or up to a line break -- never inside a card tag (<verse ...>...</verse> and its ten
// siblings) and never inside guillemets or the Quranic ornate parentheses. A citation marker written
// after the full stop (`... . [[2]]`) belongs to the sentence before it.
//
// THE PER-UNIT CHECK (order 3.6). A unit that attributes -- to a scholar, a book, a madhhab, the
// majority, consensus, the Prophet, or a grading -- must carry a reference ([[n]], today's CITE_RE)
// to a pinned row that supports it. "Supports" is decided by today's own test: lib/output-reviewer.js
// reviewAnswer, the sourced-attribution branch (:3264-3285 and generalAttributionReview :2884-2948),
// run on the single unit against ONLY the rows that unit cites, with each row's pinned text as its
// snippet. Any verdict other than kept-sourced (or no attribution at all) holds the unit. Three kinds
// of attribution the reviewer does not treat as a removable credit are checked here directly against
// the cited rows' pinned text: the Prophet (a quoted matn must be carried by a cited row, or proved by
// the takhrij runner), consensus, and a named school / the majority.
//
// SPEED FIX 1 (order EZIK-SPEED-FIX1-ORDER-2026-09-27, measured on the preview of 8ff21fa):
//   R3  the writer never writes the not-covered sentence: it writes BW2_NOT_COVERED_MARKER alone, and
//       from the marker on nothing more is released (a writer unit that carries the sentence itself is
//       read as the marker). The server writes the sentence, once, compared on foldNotCovered.
//   R4a the group families of GROUP_FAMILIES are attribution: uncited -> held; cited to rows none of
//       which names the family -> held. R4b behind BW2_HOLD_UNCITED_RULINGS (default off): an uncited
//       unit that states a ruling (RULING_WORDS) is held.
//   R5  a unit that leans on the one before it (dependentKind) is held when that one was held, and no
//       answer opens on a speech verb without its speaker, a bare quotation or a connector.
//
// SPEED FIX 2 (order EZIK-SPEED-FIX2B-ORDER-2026-09-27, measured on the preview of d002595):
//   C1  a cited pinned row CARRIES a quoted matn when today's word test (lib/takhrij.js atomCarriesMatn)
//       says so, or when the matn's letters -- diacritics, tatweel, punctuation, quote marks and spacing
//       removed (rowCarriesMatn) -- stand inside the row's letters folded the same way, with at least
//       MIN_CARRIED_LETTERS of them. Such a unit is released on that row even when the takhrij lookup
//       matches nothing; the lookup still runs first and adds its parenthetical only when it matches.
//   C3  the summary counts holds before the first release, the takhrij lookups, their summed duration
//       and the matns they matched; every hold reason is one of BW2_HOLD_REASONS.
//
// PURE EXCEPT FOR ITS COLLABORATORS. No network, no environment, no clock read that is not injected:
// the takhrij lookup, the card builders and the delta sink are all handed in, so
// guards/speed-bw2-guard.cjs drives this file with fixtures only.

import {
  collectCited, stripCitations, dropOrphanRefNumbers, isToolAnnouncement, reviewerEvidence,
  pickReaderCards, pickBookCards, pickEncyclopediaCards,
} from './free-brain/loop.js';
import { reviewAnswer, stripReaderTags, frameNamesProphet } from './output-reviewer.js';
import { lockTakhrij, dropUnsourcedGrades, bareGradeSpans, carriesGeneralSpeakerGrade, takhrijSpans } from './takhrij-lock.js';
import { stripUnownedSourceCards } from './finalized-sse-writer.js';
import { COLON_RE } from './colon-preamble.js';
import { findTargets, atomCarriesMatn, foldArabic } from './takhrij.js';
import { normalizeArabic } from './route-classify.js';

// -- THE CUTTER ---------------------------------------------------------------------------------

const CARD_NAMES = ['verse', 'surah', 'hadith', 'steps', 'suggestions', 'source', 'board', 'document',
  'dhikr', 'worship', 'book'];
const OPEN_CARD_RE = new RegExp('^<\\s*(' + CARD_NAMES.join('|') + ')\\b', 'iu');
const CLOSE_TAG_RE = /^<\/\s*([a-z]+)\s*>/iu;
// Full stop, exclamation, Latin question mark, Arabic question mark (U+061F).
const TERMINATORS = new Set(['.', '!', '?', '\u061f']);
// Guillemets and the Quranic ornate parentheses (opening U+FD3F, closing U+FD3E, the client's own
// scripture boundary, app.jsx QURAN_SPAN_RE).
const QUOTE_CLOSER = { '\u00ab': '\u00bb', '\ufd3f': '\ufd3e' };
// The text of a line before a full stop that is only a list marker: "1." "\u0662." "-" -- not a sentence.
const LIST_HEAD_RE = /^\s*(?:[-*\u2022]\s*)?(?:[0-9\u0660-\u0669]+)?\s*$/u;
const HSPACE_RE = /[ \t\u00a0]/u;

function lineHeadBefore(s, i) {
  const nl = s.lastIndexOf('\n', i - 1);
  return s.slice(nl + 1, i);
}

/**
 * Where the unit that starts at s[0] ends (exclusive), or -1 when more text is needed first.
 * `s` starts with a non-space character.
 */
export function findUnitEnd(s, final = false) {
  let tag = null;
  const quotes = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (tag) {
      if (c === '<') {
        const m = CLOSE_TAG_RE.exec(s.slice(i, i + 40));
        if (m && m[1].toLowerCase() === tag) { tag = null; i += m[0].length - 1; }
      }
      continue;
    }
    if (c === '<') {
      const m = OPEN_CARD_RE.exec(s.slice(i, i + 24));
      if (m) { tag = m[1].toLowerCase(); continue; }
      // A '<' at the very end may be the start of a card name still arriving.
      if (!final && s.length - i < 12 && /^<\s*[a-z]*$/iu.test(s.slice(i))) return -1;
    }
    if (c === '\n') return i;
    if (quotes.length) {
      if (c === quotes[quotes.length - 1]) quotes.pop();
      else if (QUOTE_CLOSER[c]) quotes.push(QUOTE_CLOSER[c]);
      continue;
    }
    if (QUOTE_CLOSER[c]) { quotes.push(QUOTE_CLOSER[c]); continue; }
    if (!TERMINATORS.has(c)) continue;
    let j = i + 1;
    while (j < s.length && TERMINATORS.has(s[j])) j += 1;
    if (j >= s.length) return final ? s.length : -1;
    if (!HSPACE_RE.test(s[j]) && s[j] !== '\n') { i = j - 1; continue; }
    if (LIST_HEAD_RE.test(lineHeadBefore(s, i))) { i = j - 1; continue; }
    // Citations written after the stop belong to this sentence.
    let end = j;
    let k = j;
    for (;;) {
      while (k < s.length && HSPACE_RE.test(s[k])) k += 1;
      if (k >= s.length) return final ? end : -1;
      if (s.startsWith('[[', k)) {
        const close = s.indexOf(']]', k);
        if (close === -1) return final ? s.length : -1;
        end = close + 2;
        k = end;
        continue;
      }
      if (s[k] === '[' && k + 1 >= s.length) return final ? end : -1;
      break;
    }
    return end;
  }
  if (tag && !final) return -1;
  return final ? s.length : -1;
}

/**
 * Feed it deltas, get whole units back. Each unit is `{ sep, body }`: `sep` is the whitespace that
 * stood before it in the writer's text, `body` the unit without trailing horizontal space.
 */
export function createUnitCutter() {
  let buf = '';
  const drain = (final) => {
    const units = [];
    for (;;) {
      const lead = /^\s*/u.exec(buf)[0];
      const rest = buf.slice(lead.length);
      if (!rest) break;
      const end = findUnitEnd(rest, final);
      if (end < 0) break;
      const body = rest.slice(0, end).replace(/[ \t\u00a0]+$/u, '');
      buf = rest.slice(end);
      if (body) units.push({ sep: lead, body });
      else if (!buf) break;
    }
    if (final) buf = '';
    return units;
  };
  return {
    push(delta) { buf += String(delta == null ? '' : delta); return drain(false); },
    end() { return drain(true); },
  };
}

// -- THE CHECK ----------------------------------------------------------------------------------

// Reviewer verdicts that mean the unit may not go out as written.
const HOLD_ACTIONS = new Set([
  'removed-unsupported-attribution',
  'kept-unsupported-attribution-marked',
  'kept-attribution-pronoun-tail',
  'replaced-unsupported-dynamic-claim',
  'last-resort-no-reliable-text',
]);
// Reviewer verdicts that mean the unit attributes to somebody.
const ATTRIBUTING_ACTIONS = new Set(['kept-sourced-attribution', 'removed-unsupported-attribution',
  'kept-unsupported-attribution-marked', 'kept-attribution-pronoun-tail']);

// Consensus and agreement, on normalizeArabic's folded letters: ajma' / ijma' / ittifaq.
const CONSENSUS_KEYS = ['\u0627\u062c\u0645\u0627\u0639', '\u0627\u062c\u0645\u0639', '\u0627\u062a\u0641\u0627\u0642',
  '\u0627\u062a\u0641\u0642'];
// Schools and the majority, folded: hanafiyya, ahnaf, malikiyya, shafi'iyya, hanabila, jumhur.
const SCHOOL_KEYS = ['\u062d\u0646\u0641\u064a\u0647', '\u0627\u062d\u0646\u0627\u0641', '\u0645\u0627\u0644\u0643\u064a\u0647',
  '\u0634\u0627\u0641\u0639\u064a\u0647', '\u062d\u0646\u0627\u0628\u0644\u0647', '\u062c\u0645\u0647\u0648\u0631'];
// The Arabic letter alef on a line of its own: the carrier lib/sentence-stream.js:131 judges a unit
// under, because a lone grade sentence is never emptied by the grade rule.
const GRADE_CARRIER = '\u0627\n';

// SPEED FIX 1, R4(a): how scholars and readers name a GROUP. Each family is claimed by any of its
// `claim` phrases and supported when a cited row's pinned text carries any of its `support` phrases.
const GROUP_FAMILIES = [
  { claim: ['\u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645', '\u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u0627\u0644\u0641\u0642\u0647\u0627\u0621'], support: ['\u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645', '\u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u0627\u0644\u0641\u0642\u0647\u0627\u0621'] },
  { claim: ['\u062c\u0645\u0647\u0648\u0631 \u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u062c\u0645\u0647\u0648\u0631 \u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645', '\u062c\u0645\u0647\u0648\u0631 \u0627\u0644\u0641\u0642\u0647\u0627\u0621', '\u0623\u0643\u062b\u0631 \u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645', '\u0623\u0643\u062b\u0631 \u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u0623\u0643\u062b\u0631 \u0627\u0644\u0641\u0642\u0647\u0627\u0621', '\u0627\u0644\u062c\u0645\u0647\u0648\u0631'],
    support: ['\u062c\u0645\u0647\u0648\u0631', '\u0627\u0644\u062c\u0645\u0647\u0648\u0631', '\u0623\u0643\u062b\u0631 \u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645', '\u0623\u0643\u062b\u0631 \u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u0623\u0643\u062b\u0631 \u0627\u0644\u0641\u0642\u0647\u0627\u0621'] },
  { claim: ['\u0627\u0644\u0623\u0626\u0645\u0629 \u0627\u0644\u0623\u0631\u0628\u0639\u0629', '\u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0623\u0631\u0628\u0639\u0629'], support: ['\u0627\u0644\u0623\u0626\u0645\u0629 \u0627\u0644\u0623\u0631\u0628\u0639\u0629', '\u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0623\u0631\u0628\u0639\u0629'] },
  { claim: ['\u0627\u0644\u0633\u0644\u0641'], support: ['\u0627\u0644\u0633\u0644\u0641'] },
  { claim: ['\u0627\u0644\u0635\u062d\u0627\u0628\u0629'], support: ['\u0627\u0644\u0635\u062d\u0627\u0628\u0629'] },
];
// SPEED FIX 1, R4(b): the words that state a ruling.
const RULING_WORDS = ['\u064a\u062c\u0628', '\u0648\u0627\u062c\u0628', '\u0644\u0627 \u064a\u062c\u0628', '\u064a\u062d\u0631\u0645', '\u062d\u0631\u0627\u0645', '\u064a\u062c\u0648\u0632', '\u0644\u0627 \u064a\u062c\u0648\u0632', '\u064a\u0643\u0631\u0647', '\u0645\u0643\u0631\u0648\u0647', '\u064a\u0633\u062a\u062d\u0628', '\u0645\u0633\u062a\u062d\u0628',
  '\u0633\u0646\u0629', '\u0641\u0631\u0636', '\u0631\u0643\u0646', '\u0634\u0631\u0637', '\u064a\u0628\u0637\u0644', '\u0628\u0627\u0637\u0644', '\u064a\u0635\u062d', '\u0644\u0627 \u064a\u0635\u062d', '\u064a\u0644\u0632\u0645', '\u0639\u0644\u064a\u0647 \u062f\u0645', '\u0639\u0644\u064a\u0647 \u0643\u0641\u0627\u0631\u0629', '\u0639\u0644\u064a\u0647 \u0627\u0644\u0642\u0636\u0627\u0621',
  '\u0644\u0627 \u0634\u064a\u0621 \u0639\u0644\u064a\u0647', '\u064a\u0633\u0642\u0637'];
// SPEED FIX 1, R5: how a unit leans on the one before it.
const SPEECH_VERBS = ['\u0642\u0627\u0644', '\u0642\u0627\u0644\u062a', '\u0642\u0627\u0644\u0648\u0627', '\u064a\u0642\u0648\u0644', '\u062a\u0642\u0648\u0644', '\u064a\u0642\u0648\u0644\u0648\u0646', '\u0642\u0644\u0646\u0627', '\u0642\u0644\u062a'];
const QAWLUHU = '\u0642\u0648\u0644\u0647';
const QAWLUHU_NAMED = ['\u062a\u0639\u0627\u0644\u0649', '\u0633\u0628\u062d\u0627\u0646\u0647', '\u0639\u0632', '\u062c\u0644', '\u0635\u0644\u0649', '\u0639\u0644\u064a\u0647'];
const PRONOUNS = ['\u0647\u0648', '\u0647\u064a', '\u0647\u0645', '\u0647\u0645\u0627', '\u0647\u0646', '\u0647\u0630\u0627', '\u0647\u0630\u0647', '\u0647\u0630\u0627\u0646', '\u0647\u0627\u062a\u0627\u0646', '\u0647\u0624\u0644\u0627\u0621', '\u0630\u0644\u0643', '\u062a\u0644\u0643', '\u0630\u0627\u0643', '\u0623\u0648\u0644\u0626\u0643', '\u0623\u064a', '\u064a\u0639\u0646\u064a'];
const CONNECTORS = ['\u0644\u0630\u0644\u0643', '\u0648\u0644\u0630\u0644\u0643', '\u0644\u0647\u0630\u0627', '\u0648\u0644\u0647\u0630\u0627', '\u0648\u0639\u0644\u064a\u0647', '\u0641\u0639\u0644\u064a\u0647', '\u0643\u0645\u0627', '\u0648\u0643\u0645\u0627', '\u0643\u0630\u0644\u0643', '\u0648\u0643\u0630\u0644\u0643', '\u0623\u064a\u0636\u0627', '\u0648\u0623\u064a\u0636\u0627',
  '\u062b\u0645', '\u0644\u0623\u0646\u0647', '\u0644\u0623\u0646\u0647\u0627', '\u0644\u0623\u0646\u0647\u0645', '\u0644\u0623\u0646', '\u0625\u0630', '\u0628\u0644', '\u0644\u0643\u0646', '\u0644\u0643\u0646\u0647', '\u0644\u0643\u0646\u0647\u0627', '\u0648\u0644\u0643\u0646', '\u0648\u0644\u0643\u0646\u0647', '\u0648\u0645\u0646\u0647', '\u0648\u0645\u0646\u0647\u0627', '\u0648\u0641\u064a\u0647',
  '\u0648\u0641\u064a\u0647\u0627', '\u0648\u0628\u0647', '\u0648\u0628\u0647\u0627', '\u0648\u0639\u0646\u0647', '\u0648\u0639\u0646\u0647\u0627', '\u0648\u0645\u0639\u0646\u0627\u0647'];
const CONNECTOR_PAIRS = ['\u0625\u0644\u0627 \u0623\u0646', '\u063a\u064a\u0631 \u0623\u0646'];

// A phrase on folded text, as whole words: optionally behind one conjunction (wa/fa), one preposition
// (bi/li/ka) and the article; an article-led phrase also matches its li+l contraction ("lil-").
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = (phrase) => {
  const p = normalizeArabic(phrase);
  const al = '\u0627\u0644';
  const head = p.startsWith(al)
    ? '(?:[\u0648\u0641])?(?:[\u0628\u0643]?' + al + '|\u0644\u0644)' + escapeRe(p.slice(2))
    : '(?:[\u0648\u0641])?(?:[\u0628\u0644\u0643])?(?:' + al + ')?' + escapeRe(p);
  return new RegExp('(?:^| )' + head + '(?= |$)', 'u');
};
const compileFamilies = (families) => families.map((f) => ({
  claim: f.claim.map(phraseRe), support: f.support.map(phraseRe),
}));
const GROUPS = compileFamilies(GROUP_FAMILIES);
const RULING_RES = RULING_WORDS.map(phraseRe);
/** The group families a folded text names (R4a). */
export function groupFamiliesIn(folded) {
  return GROUPS.filter((f) => f.claim.some((re) => re.test(folded)));
}
/** Does a folded text state a ruling (R4b)? */
export function statesRuling(folded) {
  return RULING_RES.some((re) => re.test(folded));
}

const foldSet = (words) => new Set(words.map((w) => normalizeArabic(w)));
const SPEECH_SET = foldSet(SPEECH_VERBS);
const QAWLUHU_F = normalizeArabic(QAWLUHU);
const QAWLUHU_NAMED_SET = foldSet(QAWLUHU_NAMED);
const PRONOUN_SET = foldSet(PRONOUNS);
const CONNECTOR_SET = foldSet(CONNECTORS);
const CONNECTOR_PAIR_SET = foldSet(CONNECTOR_PAIRS);
const QUOTE_OPEN_RE = /^[\u00ab"\u201c\u201d\ufd3f]/u;
const MARKS_RE = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu;

/**
 * How a unit leans on the one before it (R5), from its opening words:
 *   'speech'     a speech verb with no named speaker after it (qala: / qala <<...), or qawluhu
 *                not followed by the name of God or the Prophet's salutation
 *   'quote'      it opens with a quotation mark or the Quranic ornate parenthesis
 *   'connector'  a connector, or a pronoun / demonstrative with wa/fa welded on
 *   'pronoun'    a bare pronoun or demonstrative (at the start of an answer it points at the question)
 *   ''           none of these
 */
export function dependentKind(text) {
  const raw = String(text || '').replace(MARKS_RE, '').replace(/^[\s\-*\u2022]+/u, '');
  if (!raw) return '';
  if (QUOTE_OPEN_RE.test(raw)) return 'quote';
  const words = normalizeArabic(raw).split(' ');
  const first = words[0] || '';
  const bare = /^[\u0648\u0641]./u.test(first) ? first.slice(1) : first;
  if (SPEECH_SET.has(first) || SPEECH_SET.has(bare)) {
    const head = /^[^\s:\uff1a\u00ab"\u201c\ufd3f]*/u.exec(raw)[0];
    const after = raw.slice(head.length).trimStart();
    if (!after || /^[:\uff1a\u00ab"\u201c\ufd3f]/u.test(after)) return 'speech';
  }
  if (first === QAWLUHU_F || bare === QAWLUHU_F) {
    if (!QAWLUHU_NAMED_SET.has(words[1] || '')) return 'speech';
  }
  if (CONNECTOR_SET.has(first) || CONNECTOR_PAIR_SET.has(words.slice(0, 2).join(' '))) return 'connector';
  if (first !== bare && PRONOUN_SET.has(bare)) return 'connector';
  if (PRONOUN_SET.has(first)) return 'pronoun';
  return '';
}

// SPEED FIX 1, R3: the writer's not-covered MARKER. Rule 6 tells the writer to write it alone when the
// pinned table does not cover the issue; the server, not the writer, then writes the sentence. Two
// commercial-at signs and ASCII capitals cannot occur in Arabic prose.
export const BW2_NOT_COVERED_MARKER = '@@EZIK_NOT_COVERED@@';
/** The comparison fold for the not-covered sentence: diacritics, tatweel, spaces and punctuation removed. */
export function foldNotCovered(text) {
  return String(text || '').replace(MARKS_RE, '').replace(/[\s\p{P}\p{S}]/gu, '');
}
/** Does `text` already carry `sentence`, compared on that fold? */
export function carriesNotCovered(text, sentence) {
  const needle = foldNotCovered(sentence);
  return needle.length > 0 && foldNotCovered(text).includes(needle);
}

// SPEED FIX 2, C1. The fewest letters (after foldCarried) a matn must have to be carried by the
// spacing-free comparison. With the spaces gone a short needle can also match across a word boundary
// by accident; twelve letters is three to four words, and the shortest whole hadith the preview asked
// about, al-din al-nasiha, is thirteen. A shorter matn is still carried by today's word test alone.
export const MIN_CARRIED_LETTERS = 12;
/** C1's fold: today's letter fold (lib/takhrij.js foldArabic), then every space, punctuation mark and
 *  symbol removed -- the quote marks, the ellipsis, the ornate parentheses included. Comparison only. */
export function foldCarried(text) {
  return foldNotCovered(foldArabic(text));
}
/** Does a pinned row's text carry this matn? Today's word test, or C1's spacing-free test. */
export function rowCarriesMatn(rowText, matn, foldedRow = null) {
  if (atomCarriesMatn(rowText, matn)) return true;
  const needle = foldCarried(matn);
  if (needle.length < MIN_CARRIED_LETTERS) return false;
  return (foldedRow === null ? foldCarried(rowText) : foldedRow).includes(needle);
}

// SPEED FIX 2, C3: every reason a unit is held, as the code names it. Telemetry reports one count per
// reason under heldFieldOf(reason) (lib/before-writing-v2.js), so this list is closed.
export const BW2_HOLD_REASONS = Object.freeze([
  'empty', 'tool_announcement', 'review_failed',
  'unsupported_attribution', 'uncited_attribution', 'uncited_ruling',
  'unsupported_group', 'unsupported_consensus', 'unsupported_school',
  'unsupported_matn', 'takhrij_refused', 'takhrij_emptied', 'grade_rule_failed', 'grade_emptied', 'repeat',
  'dependent_on_held', 'dependent_opening', 'dangling_lead_in',
  'not_covered', 'not_covered_sentence',
]);
/** unsupported_matn -> heldUnsupportedMatn */
export function heldFieldOf(reason) {
  return 'held' + String(reason).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

export function pinnedTextOf(row) {
  return String((row && (row.writerText || row.fullText || row.text)) || '');
}

function evidenceOf(row) {
  return { ...reviewerEvidence(row), snippet: pinnedTextOf(row) };
}

function pageOf(row) {
  return { url: row.url || '', title: row.title || row.bookTitle || '', passage: pinnedTextOf(row) };
}

const foldedKeysIn = (folded, keys) => keys.filter((key) => folded.includes(key));

// Model-written card markup the server owns: a <source> or <book> in the writer's prose is never a
// card (only the server builds those); the markup is removed, the prose around it kept.
function stripModelCards(text) {
  return stripUnownedSourceCards(text)
    .replace(/<book\b[^>]*>[\s\S]*?<\/book>/giu, '')
    .replace(/<\/?book\b[^>]*>?/giu, '');
}

const LIST_ITEM_RE = /^([ \t]*)([0-9]+|[\u0660-\u0669]+)(\s*[.)\-]\s)/u;
const toWestern = (digits) => Number(String(digits).replace(/[\u0660-\u0669]/gu, (d) => String(d.charCodeAt(0) - 0x0660)));
const likeDigits = (n, sample) => (/[\u0660-\u0669]/u.test(sample)
  ? String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
  : String(n));

const substanceWords = (text) => normalizeArabic(String(text || '')).split(' ').filter((w) => w.length >= 2);

/**
 * @param {object} o
 * @param {Array<object>} o.rows          the pinned table; each row has a `ref`
 * @param {string} o.mode                 the reader's mode, for the reviewer's record only
 * @param {(piece:string)=>boolean} o.emit  send one delta; false when the wire is gone
 * @param {null|((text:string)=>Promise<{text:string, proofs:Array<object>, sourced:Array<string>}>)} o.takhrij
 * @param {{buildSourceTag:Function, buildBookTag:Function, encyclopediaCards:boolean, max:number}} o.cards
 * @param {string} o.notCoveredSentence   the server's not-covered sentence; a writer unit carrying it is
 *                                        read as the marker (R3)
 * @param {boolean} o.holdUncitedRulings  R4(b): hold a unit that states a ruling with no valid [[n]]
 * @param {()=>number} o.now             the clock the takhrij durations are read on (C3); injected
 */
export function createBw2Releaser({ rows = [], mode = '', emit, takhrij = null, cards = null,
  notCoveredSentence = '', holdUncitedRulings = false, now = () => 0 } = {}) {
  const byRef = new Map(rows.map((row) => [Number(row.ref), row]));
  const cutter = createUnitCutter();
  const proofs = [];
  const citedOrder = [];
  const citedSet = new Set();
  const emittedPageTags = new Set();
  const emittedBookKeys = new Set();
  const emittedEncyc = new Set();
  const holds = {};
  let chain = Promise.resolve();
  let pendingLead = null;
  let pendingSep = '';
  let forceNewline = false;
  let released = 0;
  let substantive = 0;
  let held = 0;
  let cardsSent = 0;
  let bookCards = 0;
  let encycCards = 0;
  let lastListNumber = 0;
  let text = '';
  let dead = false;
  let foldedReleased = '';
  // R3: the writer's raw text, how much of it the cutter has seen, and whether the marker came.
  let raw = '';
  let fed = 0;
  let notCovered = false;
  // R5: did the unit handled last get held?
  let prevHeld = false;
  // C3: holds before the first release, and the takhrij lookups.
  let heldBeforeFirst = 0;
  let takhrijLookups = 0;
  let takhrijMs = 0;
  let takhrijMatched = 0;
  // C1: each cited row folded once.
  const carriedFolds = new Map();
  const carriedFoldOf = (row) => {
    if (!carriedFolds.has(row)) carriedFolds.set(row, foldCarried(pinnedTextOf(row)));
    return carriedFolds.get(row);
  };

  const send = (piece) => {
    if (dead || !piece) return !dead;
    if (!emit(piece)) { dead = true; return false; }
    text += piece;
    return true;
  };
  const hold = (reason, unit) => {
    held += 1;
    if (released === 0) heldBeforeFirst += 1;
    prevHeld = true;
    holds[reason] = (holds[reason] || 0) + 1;
    if (unit && /\n/u.test(unit.sep) && (pendingSep.match(/\n/gu) || []).length < (unit.sep.match(/\n/gu) || []).length) {
      pendingSep = unit.sep;
    }
  };

  const sepFor = (unit) => {
    if (!text) return '';
    let sep = unit.sep || ' ';
    if ((pendingSep.match(/\n/gu) || []).length > (sep.match(/\n/gu) || []).length) sep = pendingSep;
    if (forceNewline && !/\n/u.test(sep)) sep = '\n';
    sep = sep.replace(/[ \t\u00a0]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n');
    if (/\n/u.test(sep)) sep = sep.replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/gu, '');
    return sep || ' ';
  };

  const renumber = (value, startsLine) => {
    const m = LIST_ITEM_RE.exec(value);
    if (!m || !startsLine) {
      if (startsLine) lastListNumber = 0;
      return value;
    }
    const n = toWestern(m[2]);
    let next = n;
    if (lastListNumber > 0 && n > lastListNumber + 1) next = lastListNumber + 1;
    lastListNumber = next;
    return next === n ? value : m[1] + likeDigits(next, m[2]) + m[3] + value.slice(m[0].length);
  };

  const emitCards = (fresh) => {
    if (!cards || !fresh.length) return;
    const max = Number.isInteger(cards.max) && cards.max > 0 ? cards.max : 3;
    const pieces = [];
    for (const card of pickReaderCards(citedOrder, max, cards.buildSourceTag)) {
      if (card && card.tag && !emittedPageTags.has(card.tag)) { emittedPageTags.add(card.tag); pieces.push(card.tag); }
    }
    for (const row of fresh) {
      if (row.kind !== 'lib_book' || bookCards >= max) continue;
      const key = String(row.bookTitle || row.title || '') + '|' + String(row.author || '');
      if (emittedBookKeys.has(key)) continue;
      const card = pickBookCards([row], 1, cards.buildBookTag)[0];
      if (card && card.tag) { emittedBookKeys.add(key); bookCards += 1; pieces.push(card.tag); }
    }
    if (cards.encyclopediaCards) {
      for (const row of fresh) {
        if (row.kind !== 'encyclopedia' || encycCards >= max) continue;
        const key = String(row.recordId || '') || 'ref:' + row.ref;
        if (emittedEncyc.has(key)) continue;
        const card = pickEncyclopediaCards([row], 1, cards.buildBookTag)[0];
        if (card && card.tag) { emittedEncyc.add(key); encycCards += 1; pieces.push(card.tag); }
      }
    }
    for (const tag of pieces) {
      if (!send('\n' + tag)) return;
      cardsSent += 1;
      forceNewline = true;
    }
  };

  async function check(body) {
    const refs = collectCited(body);
    const cited = refs.map((ref) => byRef.get(ref)).filter(Boolean);
    let value = dropOrphanRefNumbers(stripCitations(body));
    value = stripReaderTags(stripModelCards(value)).trim();
    if (!value) return { ok: false, reason: 'empty' };
    if (isToolAnnouncement(value)) return { ok: false, reason: 'tool_announcement' };

    // A lead-in and the quote it introduces are judged as ONE sentence: the reviewer splits on line
    // breaks, and a lone line ending in a colon asserts nothing, so the credit would never be seen.
    const reviewText = value.replace(/([:\uFF1A])[ \t]*\n[ \t]*/gu, '$1 ');
    let review;
    try {
      review = reviewAnswer({ text: reviewText, evidence: cited.map(evidenceOf), domain: 'fiqh', mode });
    } catch {
      return { ok: false, reason: 'review_failed' };
    }
    const folded = normalizeArabic(value);
    const pinnedFolded = cited.map((row) => normalizeArabic(pinnedTextOf(row)));
    // TODAY'S TEST HAS NO RUNG FOR A GROUP. attributedEvidenceFor (lib/output-reviewer.js:2816-2843)
    // keeps a credit only when the evidence's scholar IS the claimed person (or the book's author), so a
    // school, the majority or consensus can never pass it, even when the cited row says exactly that.
    // For a GROUP claim the support test is the cited rows' own words: every school / consensus word in
    // the claim must stand in a cited row's pinned text. A person's credit gets today's test unchanged.
    // SPEED FIX 1, R4(a): the families of GROUP_FAMILIES (the scholars, the majority, the four imams,
    // the salaf, the Companions) are group claims too; a family is supported when a cited row's pinned
    // text names any member of it.
    const familySupported = (family) => pinnedFolded.some((t) => family.support.some((re) => re.test(t)));
    const groupKeys = [...SCHOOL_KEYS, ...CONSENSUS_KEYS];
    const groupSupported = (claimed) => {
      const foldedClaim = normalizeArabic(claimed);
      const keys = foldedKeysIn(foldedClaim, groupKeys);
      const families = groupFamiliesIn(foldedClaim);
      if (!keys.length && !families.length) return false;
      return families.every(familySupported) && keys.every((key) => pinnedFolded.some((t) => (CONSENSUS_KEYS.includes(key)
        ? foldedKeysIn(t, CONSENSUS_KEYS).length > 0 : t.includes(key))));
    };
    for (const note of review.annotations) {
      if (!HOLD_ACTIONS.has(note.action)) continue;
      if (note.claimedAuthority && groupSupported(String(note.claimedAuthority))) continue;
      return { ok: false, reason: 'unsupported_attribution' };
    }
    const actions = review.verdict.sentences.map((sentence) => sentence.action);
    const consensus = foldedKeysIn(folded, CONSENSUS_KEYS);
    const schools = foldedKeysIn(folded, SCHOOL_KEYS);
    const prophet = frameNamesProphet(value);
    const grading = bareGradeSpans(value).length > 0 || carriesGeneralSpeakerGrade(value) || takhrijSpans(value).length > 0;
    const quotesMatn = findTargets(value).targets.length > 0;
    const groups = groupFamiliesIn(folded);
    const attributes = actions.some((action) => ATTRIBUTING_ACTIONS.has(action))
      || consensus.length > 0 || schools.length > 0 || groups.length > 0 || prophet || grading || quotesMatn;
    if (attributes && !cited.length) return { ok: false, reason: 'uncited_attribution' };
    if (holdUncitedRulings && !cited.length && statesRuling(folded)) return { ok: false, reason: 'uncited_ruling' };
    if (!groups.every(familySupported)) return { ok: false, reason: 'unsupported_group' };
    if (consensus.length && !pinnedFolded.some((t) => foldedKeysIn(t, CONSENSUS_KEYS).length)) {
      return { ok: false, reason: 'unsupported_consensus' };
    }
    if (schools.length && !schools.every((key) => pinnedFolded.some((t) => t.includes(key)))) {
      return { ok: false, reason: 'unsupported_school' };
    }

    let sourcedMatns = [];
    if (takhrij && quotesMatn) {
      takhrijLookups += 1;
      const lookupStarted = now();
      try {
        const pass = await takhrij(value);
        if (pass && typeof pass.text === 'string' && pass.text.trim()) value = pass.text;
        if (pass && Array.isArray(pass.proofs)) proofs.push(...pass.proofs);
        if (pass && Array.isArray(pass.sourced)) sourcedMatns = pass.sourced;
      } catch { /* the lookup failed: the unit is judged on the rows alone, as the runner would */ }
      takhrijMs += Math.max(0, now() - lookupStarted);
      takhrijMatched += sourcedMatns.length;
    }
    // A quoted matn is an attribution to the Prophet (or a Companion) whether or not the frame names
    // him: a cited row must carry it, or the takhrij runner must have proved it. SPEED FIX 2, C1: "carry"
    // is rowCarriesMatn, so a row that quotes the matn with other spacing or punctuation carries it.
    if (quotesMatn) {
      for (const target of findTargets(value).targets) {
        const carried = cited.some((row) => rowCarriesMatn(pinnedTextOf(row), target.matn, carriedFoldOf(row)))
          || sourcedMatns.includes(target.matn);
        if (!carried) return { ok: false, reason: 'unsupported_matn' };
      }
    }

    const locked = lockTakhrij(value, [...cited.map(pageOf), ...proofs]);
    if (locked.outcome === 'REFUSED') return { ok: false, reason: 'takhrij_refused' };
    value = String(locked.text || '').trim();
    if (!value) return { ok: false, reason: 'takhrij_emptied' };
    const probe = GRADE_CARRIER + value;
    const graded = dropUnsourcedGrades(probe, { followedByCard: cited.length > 0 }).text;
    if (!graded.startsWith(GRADE_CARRIER)) return { ok: false, reason: 'grade_rule_failed' };
    value = graded.slice(GRADE_CARRIER.length).trim();
    if (!value) return { ok: false, reason: 'grade_emptied' };

    const words = substanceWords(value);
    if (words.length >= 6 && foldedReleased.includes(words.join(' '))) return { ok: false, reason: 'repeat' };
    return { ok: true, text: value, cited };
  }

  // R3: the marker came (or the writer wrote the sentence itself). Nothing not yet released is released
  // after this: units still queued are dropped, the rest of the stream is not cut.
  const markNotCovered = () => { notCovered = true; pendingLead = null; };

  async function handle(unit) {
    if (dead) return;
    if (notCovered) { hold('not_covered', unit); return; }
    let current = unit;
    if (pendingLead) {
      current = { sep: pendingLead.sep, body: pendingLead.body + (unit.sep || ' ') + unit.body, lead: true };
      pendingLead = null;
    }
    if (notCoveredSentence && carriesNotCovered(stripCitations(current.body), notCoveredSentence)) {
      markNotCovered();
      hold('not_covered_sentence', current);
      return;
    }
    if (COLON_RE.test(stripCitations(current.body).trim())) { pendingLead = current; return; }
    // R5: a unit that leans on the one before it goes with that one: held when it was held; and no
    // answer opens on a speech verb without its speaker, a bare quotation or a connector.
    const leans = dependentKind(stripCitations(current.body));
    if (leans && prevHeld) { hold('dependent_on_held', current); return; }
    if (leans && leans !== 'pronoun' && !text) { hold('dependent_opening', current); return; }
    const verdict = await check(current.body);
    if (notCovered) { hold('not_covered', current); return; }
    if (!verdict.ok) { hold(verdict.reason, current); return; }
    const sep = sepFor(current);
    const startsLine = !text || /\n/u.test(sep);
    const value = renumber(verdict.text, startsLine);
    if (!send(sep + value)) return;
    released += 1;
    prevHeld = false;
    pendingSep = '';
    forceNewline = false;
    foldedReleased += ' ' + substanceWords(value).join(' ');
    if (verdict.cited.length) substantive += 1;
    const fresh = [];
    for (const row of verdict.cited) {
      if (citedSet.has(row)) continue;
      citedSet.add(row);
      citedOrder.push(row);
      fresh.push(row);
    }
    emitCards(fresh);
  }

  const enqueue = (units) => {
    for (const unit of units) chain = chain.then(() => handle(unit));
    return chain;
  };

  // R3: the cutter is fed the raw text up to the marker, never past it. A tail that may be the start
  // of the marker still arriving waits for the next delta.
  const feed = () => {
    const at = raw.indexOf(BW2_NOT_COVERED_MARKER);
    if (at >= 0) {
      // At once, not through the queue: a unit still queued or still being checked is not released.
      markNotCovered();
      fed = raw.length;
      return;
    }
    let safe = raw.length;
    for (let k = Math.min(BW2_NOT_COVERED_MARKER.length - 1, raw.length); k > 0; k -= 1) {
      if (BW2_NOT_COVERED_MARKER.startsWith(raw.slice(raw.length - k))) { safe = raw.length - k; break; }
    }
    if (safe > fed) { enqueue(cutter.push(raw.slice(fed, safe))); fed = safe; }
  };
  let markerSeen = false;

  return {
    push(delta) {
      if (markerSeen) return;
      raw += String(delta == null ? '' : delta);
      markerSeen = raw.includes(BW2_NOT_COVERED_MARKER);
      feed();
    },
    async end() {
      if (!markerSeen && fed < raw.length) { enqueue(cutter.push(raw.slice(fed))); fed = raw.length; }
      await enqueue(cutter.end());
      if (pendingLead) { hold(notCovered ? 'not_covered' : 'dangling_lead_in', pendingLead); pendingLead = null; }
      return this.summary();
    },
    /** Send a whole server-owned line (the not-covered sentence, a footer). Always an append. */
    append(line, sep = '\n\n') {
      const value = String(line || '');
      if (!value) return !dead;
      return send((text ? sep : '') + value);
    },
    summary() {
      return {
        text, released, held, substantive, cardsSent, holds: { ...holds },
        heldBeforeFirst, takhrijLookups, takhrijMs, takhrijMatched,
        cited: [...citedOrder], proofs: [...proofs], dead, notCovered,
      };
    },
    get text() { return text; },
    get dead() { return dead; },
  };
}
