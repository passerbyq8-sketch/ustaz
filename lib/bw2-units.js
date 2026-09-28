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
// SPEED FIX 3 (order EZIK-SPEED-FIX3-ORDER-2026-09-27, measured on the preview of c38aa44):
//   C4  a unit that attributes a hadith to a collection or a narrator (hadithClaimOf) is proved BEFORE the
//       attribution and citation holds: (a) a kept row carries the hadith's text (rowCarriesMatn) and
//       names every collection and narrator the unit names -- released on that row as its citation, even
//       uncited; or (b) the takhrij proves the text, every collection and every narrator -- released with
//       its parenthetical, as today. A proved unit counts as covered (no not-covered sentence because of
//       it) and in unitsProvedHadith. What neither proves is held exactly as before, under today's reasons.
//
// SPEED FIX 4 (order EZIK-SPEED-FIX4-ORDER-2026-09-27, measured on the preview of 142a100):
//   C5  a unit that opens by pointing back (BACKREF_ANY / BACKREF_JOINED: "and in this meaning", "and like
//       it", "and in a narration" ...) is dependent ('backref'): held as dependent_opening while nothing
//       substantive has gone out, as dependent_on_held after a held unit; after a released unit it is checked.
//   C6  what the evidence carries is not held: a credit that ends on "'an" before its narrator, a Companion
//       named as the subject of "rawahu" with the prayer, and a narrator named with a nisba or title the
//       row does not write (textNamesNarrator). A narrator whose name holds a collection's word ("Anas ibn
//       Malik") is read as a narrator, so the row must name him too; and a hadith claim that no proof
//       carried counts as an attribution (uncited, it is held as uncited_attribution).
//
// SPEED FIX 5 (order EZIK-SPEED-FIX5-ORDER-2026-09-27, measured on the preview of 4d353de):
//   C7  a question about a hadith's source (asksHadithSource: it names a hadith and asks where it is, who narrated it,
//       which book has it, or its takhrij) is answered first, or not at all. Until a unit proved on the asked hadith by
//       C4's (a) or (b) has gone out, every other unit is held: as dependent_opening where today's checks would have
//       released it, under today's reason where they hold it. A lead-in goes out with the proved unit it introduces; a
//       unit opening "hadha al-hadith" or "al-hadith" means the asked hadith and may go out first, after a held unit
//       too. After the first proved unit, today's checks. With no proved unit the answer is the not-covered sentence
//       and the offer, as today.
//   C8  readers stricter than the evidence: a kunya whose second word is a collection's ("Abu Malik al-Ash'ari") names
//       a narrator, not the Muwatta; a kunya's case (Abu / Abi / Aba) does not change the name; "rawahu huwa X" and
//       "rawa hadha al-hadith X" name X; and the question's hadith stops before a credit the question adds to it ("...
//       fi al-sahihayn").
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
const SPEECH_VERBS = ['\u0642\u0627\u0644', '\u0642\u0627\u0644\u062a', '\u0642\u0627\u0644\u0648\u0627', '\u064a\u0642\u0648\u0644', '\u062a\u0642\u0648\u0644', '\u064a\u0642\u0648\u0644\u0648\u0646', '\u0642\u0644\u0646\u0627', '\u0642\u0644\u062a',
  // SPEED PIPES2 fix 9: "fa-ajaba:" (he answered) with no speaker named -- round 7, question 16.
  '\u0623\u062c\u0627\u0628', '\u0623\u062c\u0627\u0628\u062a', '\u0623\u062c\u0627\u0628\u0648\u0627'];
const QAWLUHU = '\u0642\u0648\u0644\u0647';
const QAWLUHU_NAMED = ['\u062a\u0639\u0627\u0644\u0649', '\u0633\u0628\u062d\u0627\u0646\u0647', '\u0639\u0632', '\u062c\u0644', '\u0635\u0644\u0649', '\u0639\u0644\u064a\u0647'];
const PRONOUNS = ['\u0647\u0648', '\u0647\u064a', '\u0647\u0645', '\u0647\u0645\u0627', '\u0647\u0646', '\u0647\u0630\u0627', '\u0647\u0630\u0647', '\u0647\u0630\u0627\u0646', '\u0647\u0627\u062a\u0627\u0646', '\u0647\u0624\u0644\u0627\u0621', '\u0630\u0644\u0643', '\u062a\u0644\u0643', '\u0630\u0627\u0643', '\u0623\u0648\u0644\u0626\u0643', '\u0623\u064a', '\u064a\u0639\u0646\u064a'];
const CONNECTORS = ['\u0644\u0630\u0644\u0643', '\u0648\u0644\u0630\u0644\u0643', '\u0644\u0647\u0630\u0627', '\u0648\u0644\u0647\u0630\u0627', '\u0648\u0639\u0644\u064a\u0647', '\u0641\u0639\u0644\u064a\u0647', '\u0643\u0645\u0627', '\u0648\u0643\u0645\u0627',
  '\u062b\u0645', '\u0644\u0623\u0646\u0647', '\u0644\u0623\u0646\u0647\u0627', '\u0644\u0623\u0646\u0647\u0645', '\u0644\u0623\u0646', '\u0625\u0630', '\u0628\u0644', '\u0644\u0643\u0646', '\u0644\u0643\u0646\u0647', '\u0644\u0643\u0646\u0647\u0627', '\u0648\u0644\u0643\u0646', '\u0648\u0644\u0643\u0646\u0647', '\u0648\u0645\u0646\u0647', '\u0648\u0645\u0646\u0647\u0627', '\u0648\u0641\u064a\u0647',
  '\u0648\u0641\u064a\u0647\u0627', '\u0648\u0628\u0647', '\u0648\u0628\u0647\u0627', '\u0648\u0639\u0646\u0647', '\u0648\u0639\u0646\u0647\u0627', '\u0648\u0645\u0639\u0646\u0627\u0647'];
const CONNECTOR_PAIRS = ['\u0625\u0644\u0627 \u0623\u0646', '\u063a\u064a\u0631 \u0623\u0646'];
// SPEED FIX 4, C5: an opening that points back -- a preposition or a conjunction joined to a demonstrative
// or a reference noun at the unit's head. BACKREF_ANY points back by itself (its demonstrative or its
// pronoun suffix does), bare or behind wa/fa; BACKREF_JOINED only behind wa/fa (the noun alone does not).
const BACKREF_ANY = [
  '\u0641\u064a \u0647\u0630\u0627', '\u0641\u064a \u0647\u0630\u0647', '\u0641\u064a \u0630\u0644\u0643', '\u0641\u064a \u062a\u0644\u0643', // "in this / in that"
  '\u0641\u064a \u0645\u0639\u0646\u0627\u0647', '\u0641\u064a \u0645\u0639\u0646\u0627\u0647\u0627', '\u0628\u0645\u0639\u0646\u0627\u0647', '\u0628\u0645\u0639\u0646\u0627\u0647\u0627', // "in its meaning", "with its meaning"
  '\u0628\u0647\u0630\u0627', '\u0628\u0647\u0630\u0647', '\u0628\u0630\u0644\u0643', // "by this"
  '\u0645\u062b\u0644\u0647', '\u0645\u062b\u0644\u0647\u0627', '\u0645\u062b\u0644 \u0630\u0644\u0643', '\u0645\u062b\u0644 \u0647\u0630\u0627', // "like it"
  '\u0646\u062d\u0648\u0647', '\u0646\u062d\u0648\u0647\u0627', '\u0646\u062d\u0648 \u0630\u0644\u0643', '\u0646\u062d\u0648 \u0647\u0630\u0627', // "similar to it"
  '\u0639\u0644\u0649 \u0647\u0630\u0627', '\u0639\u0644\u0649 \u0630\u0644\u0643', '\u0645\u0646 \u0630\u0644\u0643', '\u0645\u0646 \u0647\u0630\u0627', // "on this (basis)", "of that (kind)"
  '\u0643\u0630\u0644\u0643', '\u0623\u064a\u0636\u0627', // "likewise", "also" (were CONNECTORS)
  '\u0648\u062c\u0647 \u0627\u0644\u062f\u0644\u0627\u0644\u0629', // SPEED PIPES fix 6: "the point of evidence (in it)" -- round 6, question 15
];
// SPEED PIPES fix 6: a credit line that names who narrated a hadith without the hadith -- "from the hadith
// of X", "in X's narration". MEASURED (round 6, question 15): each hadith of the Sunna part was held and the
// line after it went out alone, six lines crediting Companions with nothing. Such a line goes with the unit
// before it: held when it was held, checked as today when it went out. "rawahu X" is not one of them: it
// answers a source question by itself (FIX5, C7).
const CREDIT_OPENINGS = ['\u0645\u0646 \u062d\u062f\u064a\u062b', '\u0645\u0646 \u0631\u0648\u0627\u064a\u0629'];
const BACKREF_JOINED = [
  '\u0641\u064a \u0627\u0644\u0645\u0639\u0646\u0649', '\u0641\u064a \u0645\u0639\u0646\u0649', // "and in the (same) meaning", "and in the meaning of"
  '\u0641\u064a \u0627\u0644\u0628\u0627\u0628', // "and in the chapter"
  '\u0641\u064a \u0631\u0648\u0627\u064a\u0629', '\u0641\u064a \u0644\u0641\u0638', // "and in a narration", "and in a wording"
  '\u0641\u064a \u062d\u062f\u064a\u062b', '\u0641\u064a \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0622\u062e\u0631', // "and in the hadith of ...", "and in the other hadith"
  '\u0642\u0631\u064a\u0628 \u0645\u0646\u0647', '\u0643\u0630\u0627', '\u0647\u0643\u0630\u0627', // "and close to it", "and thus"
];

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
const phraseWords = (list) => list.map((p) => normalizeArabic(p).split(' '));
const BACKREF_ANY_W = phraseWords(BACKREF_ANY);
const BACKREF_JOINED_W = phraseWords(BACKREF_JOINED);
const CREDIT_W = phraseWords(CREDIT_OPENINGS);
const opensWith = (words, phrase) => phrase.every((w, i) => words[i] === w);
// SPEED PIPES2 fix 9: the demonstratives that point back as an object, the picks, and "qad".
// Distal only: "dhalika / tilka" point back at what was said; the proximal "hadha" as often means the question's own subject
// ("warada hadha al-hadith" -- the hadith the question names), and "this hadith" is pointsToHadith's.
const POINTER_OBJECT_SET = foldSet(['\u0630\u0644\u0643', '\u062a\u0644\u0643', '\u0630\u0627\u0643']);
const PICK_SET = foldSet(['\u0627\u0644\u0623\u0648\u0644', '\u0627\u0644\u062b\u0627\u0646\u064a', '\u0627\u0644\u062b\u0627\u0644\u062b', '\u0627\u0644\u0631\u0627\u0628\u0639', '\u0627\u0644\u0623\u062e\u064a\u0631', '\u0627\u0644\u0622\u062e\u0631', '\u0627\u0644\u0623\u062e\u064a\u0631\u0629']);
// A unit that names somebody: a kunya, a lineage, a title, the Prophet (folded words).
const NAMES_SOMEBODY_RE = / (?:\u0627\u0628\u0648|\u0627\u0628\u064a|\u0627\u0628\u0627|\u0627\u0628\u0646|\u0628\u0646|\u0627\u0644\u0634\u064a\u062e|\u0627\u0644\u0627\u0645\u0627\u0645|\u0627\u0644\u0646\u0628\u064a|\u0631\u0633\u0648\u0644|\u0633\u0626\u0644|\u0633\u0627\u0644|\u0633\u0627\u0644\u062a) /u;
// A "fa-" welded to an article-led word, to "inna" or to "qad" (PIPES2 fix 10); group 1 is the word without it.
const OPENING_FA_RE = /^\u0641(\u0627\u0644[^\s]{2,}|[\u0625\u0627]\u0646(?:\u0647|\u0647\u0627|\u0647\u0645)?(?=\s)|\u0642\u062f(?=\s)|\u0644\u0642\u062f(?=\s))/u;
const QAD_SET = foldSet(['\u0648\u0642\u062f', '\u0641\u0642\u062f', '\u0642\u062f', '\u0648\u0644\u0642\u062f']);
// A plural past verb, folded: it ends in "-wa" (\u0639\u0644\u0644\u0648\u0627, \u0627\u0633\u062a\u062f\u0644\u0648\u0627).
const PLURAL_PAST_RE = /..\u0648\u0627$/u;
// A unit that names "this hadith" near its head points at a hadith: one must have gone out, or the question name it.
const THIS_HADITH_RE = /(?:^| )(?:[\u0648\u0641\u0628]?\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b|[\u0648\u0641\u0628]?\u0630\u0644\u0643 \u0627\u0644\u062d\u062f\u064a\u062b|\u0627\u0644\u062d\u062f\u064a\u062b \u0646\u0641\u0633\u0647|\u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0645\u0630\u0643\u0648\u0631)(?= |$)/u;
export function pointsToHadith(text) {
  const words = normalizeArabic(String(text || '').replace(MARKS_RE, '')).split(' ').filter(Boolean).slice(0, 6).join(' ');
  return THIS_HADITH_RE.test(words);
}
const QUOTE_OPEN_RE = /^[\u00ab"\u201c\u201d\ufd3f]/u;
const MARKS_RE = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu;

/**
 * How a unit leans on the one before it (R5), from its opening words:
 *   'speech'     a speech verb with no named speaker after it (qala: / qala <<...), or qawluhu
 *                not followed by the name of God or the Prophet's salutation
 *   'quote'      it opens with a quotation mark or the Quranic ornate parenthesis
 *   'connector'  a connector, or a pronoun / demonstrative with wa/fa welded on
 *   'pronoun'    a bare pronoun or demonstrative (at the start of an answer it points at the question)
 *   'backref'    a preposition or conjunction joined to a demonstrative or a reference noun (C5); a
 *                demonstrative later in the unit (its own matn first, then "this hadith") is not one
 *   'credit'     "from the hadith of X" / "in X's narration" at the head (SPEED PIPES fix 6): held after a
 *                held unit only
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
  // C5: read at the head only -- the unit's opening words, bare or with wa/fa taken off.
  const joined = first !== bare ? [bare, ...words.slice(1)] : null;
  if (BACKREF_ANY_W.some((p) => opensWith(words, p) || (joined && opensWith(joined, p)))
    || (joined && BACKREF_JOINED_W.some((p) => opensWith(joined, p)))) return 'backref';
  if (CREDIT_W.some((p) => opensWith(words, p) || (joined && opensWith(joined, p)))) return 'credit';
  // SPEED PIPES2 fix 9 (item 5): an opening whose subject or object is only in the unit before it -- 'implicit'.
  // MEASURED (round 7): 10-a opened on "wa-'allalu dhalika bi-annahu" (a plural verb with no subject, and "that");
  // 16 had "wa-rajjaha al-thani." and "wa-qarrara dhalika" citing another book than the unit before; 7 had
  // "wa-qad istadalla bi-hadha al-hadith nafsihi" with no hadith before it.
  //   * wa/fa + a plural past verb;  * wa/fa + a word, then a demonstrative or a pick ("al-thani");
  //   * "qad" + a verb, then a pointer (C5's BACKREF_ANY or a demonstrative) -- 'backref'.
  if (first !== bare && bare.length >= 4 && PLURAL_PAST_RE.test(bare)) return 'implicit';
  // A noun before the demonstrative (\u00aband the meaning of THIS\u00bb, \u00aband the proof of THAT\u00bb) points at a thing, not a speaker.
  if (first !== bare && PICK_SET.has(words[1] || '')) return 'implicit';
  if (first !== bare && POINTER_OBJECT_SET.has(words[1] || '')) return 'backref';
  if (QAD_SET.has(first) && words.length > 2 && (BACKREF_ANY_W.some((p) => opensWith(words.slice(2), p)) || POINTER_OBJECT_SET.has(words[2]))) return 'backref';
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

// SPEED PIPES2 fix 3 (order EZIK-SPEED-PIPES2-ORDER-2026-09-28, item 2): a text that does not answer the asked
// question is not coverage. MEASURED (round 7, question 5, crypto trading): the judge kept four candidates on
// currency exchange, none on the currency asked about, and the writer's first unit said so itself -- "bitcoin and
// the digital currencies have no direct text in what is before me of these sources, but the texts treat what is
// close to them" -- and went out, followed by the exchange rules. A first unit that says OUR texts (before me,
// these sources, the texts gathered) do not treat the question is the writer's not-covered marker in other words:
// nothing after it is released, and the path goes on by itself (PIPES fix 3). A unit that says they treat it only
// in part ("not in full", "only parts of it", "not the details of") is not one: the partial answer goes on.
const ADMIT_OURS_RE = /(?:\u0628\u064a\u0646 \u064a\u062f\u064a|\u0647\u0630\u0647 \u0627\u0644\u0645\u0635\u0627\u062f\u0631|\u0647\u0630\u0647 \u0627\u0644\u0646\u0635\u0648\u0635|\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062a\u0627\u062d\u0647|\u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u062a\u0627\u062d\u0647|\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0647|\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u0631\u0641\u0642\u0647|\u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u062a\u064a \u0628\u064a\u0646)/u;
const ADMIT_NONE_RE = /(?:\u0644\u0645 \u064a\u0631\u062f|\u0644\u0627 \u064a\u0648\u062c\u062f|\u0644\u0627 \u062a\u0648\u062c\u062f|\u0644\u0645 \u0627\u0642\u0641|\u0644\u0645 \u0627\u062c\u062f|\u0644\u0627 \u062a\u062a\u0646\u0627\u0648\u0644|\u0644\u0645 \u062a\u062a\u0646\u0627\u0648\u0644|\u0644\u0627 \u062a\u0630\u0643\u0631|\u0644\u0645 \u062a\u0630\u0643\u0631|\u0644\u064a\u0633 \u0641\u064a\u0647\u0627|\u062e\u0644\u062a|\u0644\u0627 \u062a\u062c\u064a\u0628|\u0644\u0645 \u062a\u062c\u0628|\u0644\u0627 \u062a\u062a\u062d\u062f\u062b|\u0644\u0645 \u062a\u062a\u062d\u062f\u062b|\u0644\u0627 \u062a\u063a\u0637\u064a|\u0644\u0645 \u062a\u063a\u0637)/u;
const ADMIT_PART_RE = /(?:\u0643\u0627\u0645\u0644\u0647|\u0643\u0627\u0645\u0644\u0627|\u062a\u0633\u062a\u0648\u0641\u064a|\u064a\u0633\u062a\u0648\u0641\u064a|\u062a\u0633\u062a\u0648\u0639\u0628|\u0628\u0639\u0636|\u062a\u0641\u0635\u064a\u0644|\u062a\u0641\u0627\u0635\u064a\u0644|\u0648\u0627\u0646\u0645\u0627|\u0627\u0646\u0645\u0627|\u0627\u0637\u0631\u0627\u0641|\u0627\u0637\u0631\u0627\u0641\u0627|\u0645\u062a\u0641\u0631\u0642\u0647|\u0627\u0644\u0627 \u0627\u0646|\u063a\u064a\u0631 \u0627\u0646)/u;
/** Does a unit say that the gathered texts do not treat the question (in whole, not in part)? */
export function admitsNotCovered(text) {
  const folded = ' ' + normalizeArabic(stripCitations(String(text || ''))) + ' ';
  return ADMIT_OURS_RE.test(folded) && ADMIT_NONE_RE.test(folded) && !ADMIT_PART_RE.test(folded);
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

// SPEED FIX 3, C4. A unit that attributes a hadith to a collection or a narrator goes through the hadith
// proofs BEFORE the attribution and citation holds. What it names is read here, on normalizeArabic's
// folded words, outside every quotation (a matn's own words never name a collection). Reading too much
// only makes a proof harder -- the unit then goes today's way -- and a name these lists do not know is
// left over, so no credit that holds one is waived (claimOnlyNames).
const fold = (w) => normalizeArabic(w);
const COLLECTIONS_ONE = new Map(['\u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0627\u0644\u062a\u0631\u0645\u0630\u064a', '\u0627\u0644\u0646\u0633\u0627\u0626\u064a', '\u0627\u0644\u062f\u0627\u0631\u0645\u064a', '\u0627\u0644\u062f\u0627\u0631\u0642\u0637\u0646\u064a', '\u0627\u0644\u0628\u064a\u0647\u0642\u064a', '\u0627\u0644\u0637\u0628\u0631\u0627\u0646\u064a']
  .map((w) => [fold(w), fold(w)]));
// A word that is also an ordinary word (a Muslim, a ruler) names the collection only after a word that
// introduces one, or joined by "wa" to a collection named just before it.
const COLLECTIONS_AFTER_CONTEXT = new Map(['\u0645\u0633\u0644\u0645', '\u0623\u062d\u0645\u062f', '\u0645\u0627\u0644\u0643', '\u0627\u0644\u062d\u0627\u0643\u0645'].map((w) => [fold(w), fold(w)]));
const COLLECTIONS_TWO = new Map([['\u0623\u0628\u0648 \u062f\u0627\u0648\u062f', '\u0623\u0628\u0648 \u062f\u0627\u0648\u062f'], ['\u0623\u0628\u064a \u062f\u0627\u0648\u062f', '\u0623\u0628\u0648 \u062f\u0627\u0648\u062f'], ['\u0627\u0628\u0646 \u0645\u0627\u062c\u0647', '\u0627\u0628\u0646 \u0645\u0627\u062c\u0647'],
  ['\u0627\u0628\u0646 \u0645\u0627\u062c\u0629', '\u0627\u0628\u0646 \u0645\u0627\u062c\u0647'], ['\u0627\u0628\u0646 \u062d\u0628\u0627\u0646', '\u0627\u0628\u0646 \u062d\u0628\u0627\u0646'], ['\u0627\u0628\u0646 \u062e\u0632\u064a\u0645\u0629', '\u0627\u0628\u0646 \u062e\u0632\u064a\u0645\u0629']].map(([w, k]) => [fold(w), fold(k)]));
const BOTH_SHAYKHS = new Set(['\u0627\u0644\u0635\u062d\u064a\u062d\u064a\u0646', '\u0627\u0644\u0634\u064a\u062e\u0627\u0646'].map(fold));
const AGREED_UPON = fold('\u0645\u062a\u0641\u0642 \u0639\u0644\u064a\u0647');
const JURISTS_AFTER = new Set(['\u0639\u0646\u062f', '\u0628\u064a\u0646'].map(fold));
const COLLECTION_CONTEXT = new Set(['\u0627\u0644\u0625\u0645\u0627\u0645', '\u0635\u062d\u064a\u062d', '\u0645\u0633\u0646\u062f', '\u0645\u0648\u0637\u0623', '\u0627\u0644\u0645\u0648\u0637\u0623', '\u0633\u0646\u0646', '\u0639\u0646\u062f', '\u0631\u0648\u0627\u064a\u0629', '\u0644\u0641\u0638',
  '\u0631\u0648\u0627\u0647', '\u0631\u0648\u0627\u0647\u0627', '\u0631\u0648\u0627\u0647\u0645\u0627', '\u0623\u062e\u0631\u062c\u0647', '\u0623\u062e\u0631\u062c\u0647\u0627', '\u0623\u062e\u0631\u062c\u0627\u0647', '\u062e\u0631\u062c\u0647', '\u0631\u0648\u0649', '\u0623\u062e\u0631\u062c'].map(fold));
const BUKHARI = fold('\u0627\u0644\u0628\u062e\u0627\u0631\u064a');
const MUSLIM = fold('\u0645\u0633\u0644\u0645');
const dropJoin = (w) => (/^[\u0648\u0641]../u.test(w) ? w.slice(1) : w);

/** The collections a text names, as folded keys. `loose`: a text that only names books (a takhrij's
 *  parenthetical, its proof list), where every known name counts. */
export function collectionsNamed(text, loose = false) {
  const words = normalizeArabic(String(text || '')).split(' ').filter(Boolean);
  const out = [];
  const add = (key) => { if (!out.includes(key)) out.push(key); };
  let prevNamed = false;
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const forms = [word];
    if (/^[\u0648\u0641]../u.test(word)) forms.push(word.slice(1));
    if (word.startsWith('\u0644\u0644')) forms.push('\u0627\u0644' + word.slice(2));
    let named = false;
    for (const form of forms) {
      const two = COLLECTIONS_TWO.get(form + ' ' + (words[i + 1] || ''));
      if (two) { add(two); i += 1; named = true; break; }
      if (form + ' ' + (words[i + 1] || '') === AGREED_UPON && !JURISTS_AFTER.has(words[i + 2] || '')) {
        add(BUKHARI); add(MUSLIM); i += 1; named = true; break;
      }
      if (BOTH_SHAYKHS.has(form)) { add(BUKHARI); add(MUSLIM); named = true; break; }
      if (COLLECTIONS_ONE.has(form)) { add(COLLECTIONS_ONE.get(form)); named = true; break; }
      if (COLLECTIONS_AFTER_CONTEXT.has(form)
        && (loose || COLLECTION_CONTEXT.has(dropJoin(words[i - 1] || '')) || (form !== word && prevNamed))) {
        add(COLLECTIONS_AFTER_CONTEXT.get(form)); named = true; break;
      }
    }
    prevNamed = named;
  }
  return out;
}

// A narrator is named "min hadith / min riwayat X", or "an X" with the Companion's prayer after the name.
const NARRATOR_STOP = new Set(['\u0631\u0636\u064a', '\u0623\u0646', '\u0623\u0646\u0647', '\u0642\u0627\u0644', '\u0642\u0627\u0644\u062a', '\u0639\u0646', '\u0641\u064a', '\u0639\u0646\u062f', '\u0631\u0648\u0627\u0647', '\u0623\u062e\u0631\u062c\u0647', '\u064a\u0642\u0648\u0644', '\u0633\u0645\u0639\u062a',
  '\u0645\u0631\u0641\u0648\u0639\u0627', '\u0627\u0644\u0646\u0628\u064a', '\u0631\u0633\u0648\u0644'].map(fold));
const NOT_A_NARRATOR = new Set(['\u0627\u0644\u0646\u0628\u064a', '\u0631\u0633\u0648\u0644', '\u0627\u0644\u0644\u0647', '\u0623\u0628\u064a\u0647', '\u0647\u0630\u0627', '\u0630\u0644\u0643', '\u0627\u0644\u0625\u0645\u0627\u0645', '\u0627\u0644\u0634\u064a\u062e'].map(fold));
const MIN = fold('\u0645\u0646');
const MIN_HADITH = new Set(['\u062d\u062f\u064a\u062b', '\u0631\u0648\u0627\u064a\u0629'].map(fold));
const AN = fold('\u0639\u0646');
const RADIYA = fold('\u0631\u0636\u064a');
// C6: "rawahu / rawa X" with the Companion's prayer after the name names X as the narrator.
// C8: "hadha al-hadith" between the verb and the name ("rawa hadha al-hadith Abu Malik ...").
const NAME_THIS = ['\u0647\u0630\u0627', '\u0627\u0644\u062d\u062f\u064a\u062b'].map(fold);
// C8: a pronoun between the verb and the name ("rawahu huwa Anas ...").
const NAME_PRONOUNS = new Set(['\u0647\u0648', '\u0647\u064a'].map(fold));
const NARRATED_BY = new Set(['\u0631\u0648\u0627\u0647', '\u0631\u0648\u0649'].map(fold));
const CLAUSE_RE = /[.,\u060c\u061b;:!?\u061f\n\u00ab\u00bb()\ufd3e\ufd3f]/u;

/** The narrators a text names, each as its folded words joined by one space. */
export function narratorsNamed(text) {
  const out = [];
  for (const clause of String(text || '').split(CLAUSE_RE)) {
    const words = normalizeArabic(clause).split(' ').filter(Boolean);
    for (let i = 0; i < words.length; i += 1) {
      const head = dropJoin(words[i]);
      let from = -1;
      if (head === MIN && MIN_HADITH.has(words[i + 1] || '')) from = i + 2;
      else if (head === AN || NARRATED_BY.has(head)) from = i + 1;
      if (from < 0) continue;
      // C8: "rawahu huwa Anas ...", "rawa hadha al-hadith Anas ..." -- what stands between the verb and the name is not it.
      if (NAME_PRONOUNS.has(words[from] || '')) from += 1;
      else if (words[from] === NAME_THIS[0] && words[from + 1] === NAME_THIS[1]) from += 2;
      const name = [];
      let k = from;
      while (k < words.length && name.length < 4 && !NARRATOR_STOP.has(words[k])) { name.push(words[k]); k += 1; }
      if (!name.length || NOT_A_NARRATOR.has(name[0])) continue;
      const prayed = words[k] === RADIYA;
      if ((head === AN || NARRATED_BY.has(head)) && !prayed) continue;
      if (!prayed && k < words.length && !NARRATOR_STOP.has(words[k])) continue;
      const joined = name.join(' ');
      // C6: a collection at the name's head ("an al-Bukhari") is not a narrator; a collection's word later in
      // it is his lineage ("Anas ibn Malik").
      // C8: the head is the name's first word, or a two-word collection ("Abu Dawud"); a kunya or a lineage whose
      // second word is a collection's ("Abu Malik al-Ash'ari", "ibn Malik") is a name.
      if (collectionsNamed(name[0], true).length || COLLECTIONS_TWO.has(name.slice(0, 2).join(' '))) continue;
      if (!out.includes(joined)) out.push(joined);
    }
  }
  return out;
}

// C6: does a folded text name this narrator? His whole name, or its head: the text may leave out a title
// before it (al-sahabi al-jalil, sayyiduna) and the nisba or epithet after his lineage, but never a
// lineage ("ibn X") the unit gives, and the text's name must end where that head ends (no other "ibn").
const LINEAGE = new Set(['\u0628\u0646', '\u0627\u0628\u0646', '\u0628\u0646\u062a'].map(fold));
const KUNYA = new Set(['\u0623\u0628\u0648', '\u0623\u0628\u064a', '\u0623\u0628\u0627', '\u0623\u0645', '\u0627\u0628\u0646'].map(fold));
const TITLES = new Set(['\u0627\u0644\u0635\u062d\u0627\u0628\u064a', '\u0627\u0644\u062c\u0644\u064a\u0644', '\u0633\u064a\u062f\u0646\u0627'].map(fold));
// C8: a kunya in any case -- abu, abi, aba -- is one word.
const kunyaCase = (text) => String(text || '').replace(/(^| )\u0627\u0628[\u064a\u0627](?= |$)/gu, '$1\u0627\u0628\u0648');
export function textNamesNarrator(folded, name) {
  const padded = ' ' + kunyaCase(folded) + ' ';
  let parts = kunyaCase(name).split(' ').filter(Boolean);
  while (parts.length > 1 && TITLES.has(parts[0])) parts = parts.slice(1);
  if (!parts.length) return false;
  let least = KUNYA.has(parts[0]) ? 2 : 1;
  parts.forEach((word, i) => { if (LINEAGE.has(word)) least = Math.max(least, i + 2); });
  for (let n = parts.length; n >= Math.min(least, parts.length); n -= 1) {
    const head = ' ' + parts.slice(0, n).join(' ') + ' ';
    if (n === parts.length && padded.includes(head)) return true;
    for (let at = padded.indexOf(head); at >= 0; at = padded.indexOf(head, at + 1)) {
      if (!LINEAGE.has(padded.slice(at + head.length).split(' ')[0])) return true;
    }
  }
  return false;
}

const QUOTED_RUN_RE = /\u00ab[^\u00ab\u00bb]*\u00bb|\u201c[^\u201c\u201d]*\u201d|\ufd3f[^\ufd3e\ufd3f]*\ufd3e/gu;
const HADITH_WORD_RE = /^[\u0648\u0641\u0628\u0644]?(?:\u0627\u0644)?\u062d\u062f\u064a\u062b$/u;
const HADITH_VERBS = new Set(['\u0631\u0648\u0627\u0647', '\u0631\u0648\u0627\u0647\u0627', '\u0631\u0648\u0627\u0647\u0645\u0627', '\u0623\u062e\u0631\u062c\u0647', '\u0623\u062e\u0631\u062c\u0647\u0627', '\u0623\u062e\u0631\u062c\u0627\u0647', '\u062e\u0631\u062c\u0647', '\u0631\u0648\u0649', '\u0623\u062e\u0631\u062c', '\u0648\u0631\u062f'].map(fold));

/**
 * The hadith claim of one unit, or null when it attributes nothing to a hadith: it names a collection or
 * a narrator, and it carries the hadith's text -- its own quoted matn(s), or, when it quotes none but
 * speaks of "the hadith" or credits one ("rawahu ..."), the `referent`: the matn the answer quoted last,
 * else the hadith the question names.
 */
export function hadithClaimOf(text, ownMatns = [], referent = []) {
  const bare = String(text || '').replace(QUOTED_RUN_RE, ' ');
  const collections = collectionsNamed(bare);
  const narrators = narratorsNamed(bare);
  if (!collections.length && !narrators.length) return null;
  const own = ownMatns.length > 0;
  const words = normalizeArabic(bare).split(' ').filter(Boolean);
  const speaksOfOne = words.some((w) => HADITH_WORD_RE.test(w) || HADITH_VERBS.has(dropJoin(w)));
  const matns = own ? [...ownMatns] : (speaksOfOne ? referent.filter(Boolean) : []);
  if (!matns.length) return null;
  return { matns, collections, narrators, own };
}

// The words a credit may hold beside the names it gives and still be nothing but those names.
const CREDIT_FILLER = new Set(['\u0641\u064a', '\u0635\u062d\u064a\u062d\u0647', '\u0635\u062d\u064a\u062d\u064a\u0647\u0645\u0627', '\u0627\u0644\u0635\u062d\u064a\u062d', '\u0635\u062d\u064a\u062d', '\u0633\u0646\u0646\u0647', '\u0645\u0633\u0646\u062f\u0647', '\u0627\u0644\u0625\u0645\u0627\u0645', '\u0639\u0646\u062f', '\u0645\u0646',
  '\u062d\u062f\u064a\u062b', '\u0631\u0648\u0627\u064a\u0629', '\u0631\u0636\u064a', '\u0627\u0644\u0644\u0647', '\u0639\u0646\u0647', '\u0639\u0646\u0647\u0627', '\u0639\u0646\u0647\u0645\u0627', '\u0639\u0646\u0647\u0645', '\u0648', '\u0631\u0648\u0627\u0647', '\u0631\u0648\u0627\u0647\u0627', '\u0631\u0648\u0627\u0647\u0645\u0627', '\u0623\u062e\u0631\u062c\u0647', '\u0623\u062e\u0631\u062c\u0647\u0627',
  '\u0623\u062e\u0631\u062c\u0627\u0647', '\u062e\u0631\u062c\u0647', '\u0631\u0648\u0649', '\u0623\u062e\u0631\u062c', '\u0648\u0631\u062f', '\u0643\u062a\u0627\u0628\u0647', '\u0644\u0641\u0638\u0647', '\u0628\u0644\u0641\u0638\u0647', '\u0647\u0630\u0627', '\u0627\u0644\u062d\u062f\u064a\u062b',
  // C6: the credit span ends on "'an" when the narrator follows it ("rawahu al-Bukhari wa-Muslim 'an").
  '\u0639\u0646'].map(fold));

/** Does `credit` name nothing but the collections and narrators `claim` proved (at least one of them)? */
export function claimOnlyNames(credit, claim) {
  const words = normalizeArabic(String(credit || '')).split(' ').filter(Boolean);
  let named = 0;
  for (let i = 0; i < words.length;) {
    const pair = words.slice(i, i + 2).join(' ');
    const pairKeys = i + 1 < words.length ? collectionsNamed(pair, true) : [];
    if (pairKeys.length && pairKeys.every((k) => claim.collections.includes(k)) && collectionsNamed(words[i], true).length === 0) {
      named += 1; i += 2; continue;
    }
    const keys = collectionsNamed(words[i], true);
    if (keys.length) {
      if (!keys.every((k) => claim.collections.includes(k))) return false;
      named += 1; i += 1; continue;
    }
    const narrator = claim.narrators.find((n) => words.slice(i, i + n.split(' ').length).join(' ') === n
      || words.slice(i, i + n.split(' ').length).map(dropJoin).join(' ') === n);
    if (narrator) { named += 1; i += narrator.split(' ').length; continue; }
    if (CREDIT_FILLER.has(words[i]) || CREDIT_FILLER.has(dropJoin(words[i]))) { i += 1; continue; }
    return false;
  }
  return named > 0;
}

/** Two matns are one hadith on C1's fold: equal, or one inside the other. */
export function sameCarriedMatn(a, b) {
  const one = foldCarried(a);
  const two = foldCarried(b);
  return one.length > 0 && two.length > 0 && (one === two || one.includes(two) || two.includes(one));
}

const ASKED_QUOTE_RE = /\u00ab([^\u00ab\u00bb]{2,300})\u00bb/u;
const ASKED_HADITH_RE = /(?:^|[^\u0621-\u064a])[\u0648\u0641\u0628\u0644]?(?:\u0627\u0644)?\u062d\u062f\u064a\u062b\s*[:\uff1a]?\s*([^\u061f?!.\n\u060c\u00ab\u00bb]{2,300})/u;
/** The hadith the question names -- quoted, or after the word "hadith" -- or '' (never logged). */
export function askedHadithOf(question) {
  const q = String(question || '');
  const m = (findTargets(q).targets[0] || {}).matn || (ASKED_QUOTE_RE.exec(q) || [])[1] || (ASKED_HADITH_RE.exec(q) || [])[1] || '';
  const matn = withoutAskedCredit(m.trim());
  return foldCarried(matn).length >= MIN_CARRIED_LETTERS ? matn : '';
}
// C8: a credit the question adds after the hadith ("... fi al-sahihayn", "... 'inda Muslim") is not the hadith's text:
// the matn stops before "fi" / "'inda" when all that follows names collections (claimOnlyNames).
const CREDIT_LEAD = new Set(['\u0641\u064a', '\u0639\u0646\u062f'].map(fold));
function withoutAskedCredit(matn) {
  const words = String(matn || '').split(/\s+/u);
  for (let i = 1; i < words.length; i += 1) {
    if (!CREDIT_LEAD.has(dropJoin(fold(words[i])))) continue;
    const rest = words.slice(i).join(' ');
    const keys = collectionsNamed(rest, true);
    if (keys.length && claimOnlyNames(rest, { collections: keys, narrators: [] })) return words.slice(0, i).join(' ');
  }
  return String(matn || '');
}

// SPEED FIX 5, C7. The question asks for the source of the hadith it names: "man rawa / man rawahu / man akhrajahu /
// man al-sahabi alladhi rawahu", "ayna", "fi ayy kitab", "masdaruhu", "takhrijuhu", or "hal ... fi al-sahihayn / fi
// sahih Muslim" (a collection named after "hal", when it asks for no grading). A grading question ("ma sihhat hadith
// ...", "hal hadith ... sahih") is not one, and neither is a question that names no hadith.
const SOURCE_AFTER_MAN = new Set(['\u0631\u0648\u0649', '\u0631\u0648\u0627\u0647', '\u0631\u0648\u0627\u0647\u0627', '\u064a\u0631\u0648\u064a', '\u0627\u062e\u0631\u062c', '\u0627\u062e\u0631\u062c\u0647', '\u0627\u062e\u0631\u062c\u0647\u0627', '\u062e\u0631\u062c', '\u062e\u0631\u062c\u0647', '\u0627\u0644\u0631\u0627\u0648\u064a', '\u0631\u0627\u0648\u064a', '\u0631\u0627\u0648\u064a\u0647', '\u0627\u0644\u0635\u062d\u0627\u0628\u064a'].map(fold));
const SOURCE_WORDS = new Set(['\u0627\u064a\u0646', '\u062a\u062e\u0631\u064a\u062c', '\u062a\u062e\u0631\u064a\u062c\u0647', '\u0645\u0635\u062f\u0631', '\u0645\u0635\u062f\u0631\u0647', '\u0645\u0635\u062f\u0631\u0647\u0627'].map(fold));
const WHICH_BOOK = new Set(['\u0643\u062a\u0627\u0628', '\u0643\u062a\u0628', '\u0627\u0644\u0643\u062a\u0628', '\u0645\u0635\u062f\u0631', '\u0635\u062d\u0627\u0628\u064a', '\u0627\u0644\u0635\u062d\u0627\u0628\u0647'].map(fold));
const GRADING_WORDS = new Set(['\u0635\u062d\u0647', '\u062f\u0631\u062c\u0647', '\u0636\u0639\u064a\u0641', '\u0636\u0639\u0641', '\u0645\u0648\u0636\u0648\u0639', '\u064a\u0635\u062d', '\u0635\u062d\u064a\u062d', '\u062b\u0627\u0628\u062a'].map(fold));
const MAN_W = fold('\u0645\u0646');
const WHICH_W = fold('\u0627\u064a');
const HAL_W = fold('\u0647\u0644');
export function asksHadithSource(question) {
  const q = String(question || '');
  const matn = askedHadithOf(q);
  if (!matn) return false;
  const rest = q.replace(matn, ' ');
  const words = normalizeArabic(rest).split(' ').filter(Boolean).map(dropJoin);
  const asks = words.some((w, i) => SOURCE_WORDS.has(w)
    || (w === MAN_W && (SOURCE_AFTER_MAN.has(words[i + 1] || '') || SOURCE_AFTER_MAN.has(words[i + 2] || '')))
    || (w === WHICH_W && WHICH_BOOK.has(words[i + 1] || '')));
  if (asks) return true;
  // "sahih" before a collection is the book's name ("sahih Muslim"), not a grade.
  const grades = words.some((w, i) => GRADING_WORDS.has(w) && !(w === fold('\u0635\u062d\u064a\u062d') && collectionsNamed(words[i + 1] || '', true).length));
  return words[0] === HAL_W && !grades && collectionsNamed(rest).length > 0;
}
// SPEED PIPES2 fix 4 (item 2): "what did X narrate about Y?" asks for X's narration. MEASURED (round 7, question 9,
// "what did Abu Hurayra narrate about his keeping to the Prophet?"): the judge kept seven texts on why he narrated
// much and none with his narration, and the answer gave the reasons without the narration; round 6's question 22
// (Anas and his service) is the same shape. The question's narrator, or '' -- a collection is not a narrator.
const NARRATION_ASK = new Set(['\u0645\u0627', '\u0645\u0627\u0630\u0627', '\u0648\u0645\u0627', '\u0641\u0645\u0627'].map(fold));
const NARRATION_REL = new Set(['\u0627\u0644\u0630\u064a', '\u0627\u0644\u062a\u064a', '\u0627\u0644\u062d\u062f\u064a\u062b', '\u0627\u0644\u0627\u062d\u0627\u062f\u064a\u062b', '\u0627\u0644\u0631\u0648\u0627\u064a\u0647', '\u0627\u0644\u0631\u0648\u0627\u064a\u0627\u062a'].map(fold));
const NARRATION_VERBS = new Set(['\u0631\u0648\u0627\u0647', '\u0631\u0648\u0627\u0647\u0627', '\u0631\u0648\u0649', '\u064a\u0631\u0648\u064a'].map(fold));
const NARRATOR_END = new Set(['\u0639\u0646', '\u0641\u064a', '\u0645\u0646', '\u0631\u0636\u064a', '\u062d\u0648\u0644', '\u0628\u0634\u0627\u0646', '\u0628\u062e\u0635\u0648\u0635', '\u0639\u0644\u064a\u0647', '\u0644\u0646\u0627'].map(fold));
export function askedNarratorOf(question) {
  const words = normalizeArabic(String(question || '')).split(' ').filter(Boolean);
  if (!NARRATION_ASK.has(words[0] || '')) return '';
  for (let i = 1; i < Math.min(words.length, 5); i += 1) {
    if (!NARRATION_VERBS.has(words[i])) continue;
    if (!words.slice(1, i).every((w) => NARRATION_REL.has(w))) return '';
    const name = [];
    for (let k = i + 1; k < words.length && name.length < 4 && !NARRATOR_END.has(words[k]); k += 1) name.push(words[k]);
    if (!name.length || collectionsNamed(name[0], true).length || NOT_A_NARRATOR.has(name[0])) return '';
    return name.join(' ');
  }
  return '';
}
/** Does a unit quote a narration of `narrator`: a quoted text, and the narrator named in it or in a row it cites? */
function quotesNarrationOf(text, cited, narrator) {
  const runs = String(text || '').match(QUOTED_RUN_RE) || [];
  if (!runs.some((run) => foldCarried(run).length >= MIN_CARRIED_LETTERS)) return false;
  return [String(text || ''), ...cited.map((row) => pinnedTextOf(row))].some((t) => textNamesNarrator(normalizeArabic(t), narrator));
}

const HADHA_W = fold('\u0647\u0630\u0627');
const AL_HADITH_W = fold('\u0627\u0644\u062d\u062f\u064a\u062b');
/** C7: does the unit open with "hadha al-hadith" or "al-hadith" (bare: behind wa/fa it is R5's connector)? */
export function opensWithThisHadith(text) {
  const words = normalizeArabic(String(text || '').replace(MARKS_RE, '')).split(' ').filter(Boolean);
  return words[0] === AL_HADITH_W || (words[0] === HADHA_W && words[1] === AL_HADITH_W);
}

// The sentence a hadith named only by reference is looked up in.
const PROPHET_SAID = '\u0642\u0627\u0644 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: ';

// SPEED FIX 2, C3: every reason a unit is held, as the code names it. Telemetry reports one count per
// reason under heldFieldOf(reason) (lib/before-writing-v2.js), so this list is closed.
export const BW2_HOLD_REASONS = Object.freeze([
  'empty', 'tool_announcement', 'review_failed',
  'unsupported_attribution', 'uncited_attribution', 'uncited_ruling',
  'unsupported_group', 'unsupported_consensus', 'unsupported_school',
  'unsupported_matn', 'takhrij_refused', 'takhrij_emptied', 'grade_rule_failed', 'grade_emptied', 'repeat',
  'dependent_on_held', 'dependent_opening', 'dangling_lead_in',
  'not_covered', 'not_covered_sentence',
  // SPEED PIPES fix 7: a heading nothing released came under.
  'empty_heading',
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

// SPEED PIPES fix 7: a heading -- one short line with no sentence end, opened by an ordinal ("first",
// "second" ... "tenth") or a markdown mark, or wholly bold. MEASURED (round 6, question 27): "second:
// what the texts state on the conditions, pillars, duties and sunnas of hajj" went out with nothing under it,
// and so did "fourth"; the units under them were held. A heading now waits for the first unit under it
// that goes out, and goes out with it; the next heading or the end drops it (held as empty_heading).
const ORDINALS = ['\u0623\u0648\u0644\u0627', '\u062b\u0627\u0646\u064a\u0627', '\u062b\u0627\u0644\u062b\u0627', '\u0631\u0627\u0628\u0639\u0627', '\u062e\u0627\u0645\u0633\u0627', '\u0633\u0627\u062f\u0633\u0627', '\u0633\u0627\u0628\u0639\u0627', '\u062b\u0627\u0645\u0646\u0627', '\u062a\u0627\u0633\u0639\u0627', '\u0639\u0627\u0634\u0631\u0627'].map((w) => normalizeArabic(w));
export function isHeadingUnit(body) {
  const line = stripCitations(String(body || '')).trim();
  if (!line || /\n/u.test(line) || line.length > 120 || /[.!?\u061f\u06d4]$/u.test(line)) return false;
  if (/^#{1,6}\s/u.test(line) || /^\*\*[^*]+\*\*:?$/u.test(line)) return true;
  const first = normalizeArabic(line).split(' ')[0] || '';
  return ORDINALS.includes(first);
}
// SPEED PIPES2 fix 12 (item 7): a heading whose only content is the khilaf tail or the source line is an empty heading.
// MEASURED (round 7): question 2 showed "tanbih 'ala hudud al-nusus" and question 8 "ma lam aqif 'alayh" with nothing
// under them but the khilaf tail and the source line -- plain title lines (no ordinal, no markdown), so isHeadingUnit
// did not know them and they went out as units; a heading it knows cannot reach the screen empty (PIPES fix 7). A
// short line of two to eight words, uncited, with no sentence end, no list mark, no quotation, not opening on "wa"
// and stating no ruling, is a title: it waits for the first unit under it that goes out, as a heading does.
export function isPlainTitleUnit(body) {
  if (collectCited(String(body || '')).length) return false;
  const line = stripCitations(String(body || '')).trim();
  if (!line || /\n/u.test(line) || line.length > 70 || /[.!?\u061f\u06d4:\uff1a]$/u.test(line)) return false;
  if (/^[-*\u2022\d\u0660-\u0669]/u.test(line) || /[\u00ab\u00bb\ufd3f"]/u.test(line)) return false;
  const folded = normalizeArabic(line);
  const words = folded.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 8 || /^\u0648/u.test(words[0])) return false;
  return !statesRuling(folded);
}

// SPEED PIPES2 fix 11 (item 6): the ordinals that go out are numbered in sequence. MEASURED (round 7): question 1 showed
// "second, third, fourth, sixth" and question 8 "first, second, fourth" -- the headings between were empty and
// dropped (PIPES fix 7), the ones after kept the writer's numbers. The first word of a released line that is an
// ordinal is rewritten to the next in sequence; its tanween and what follows it (the colon, the title) stay.
const ORDINAL_WORDS = ['\u0623\u0648\u0644\u0627', '\u062b\u0627\u0646\u064a\u0627', '\u062b\u0627\u0644\u062b\u0627', '\u0631\u0627\u0628\u0639\u0627', '\u062e\u0627\u0645\u0633\u0627', '\u0633\u0627\u062f\u0633\u0627', '\u0633\u0627\u0628\u0639\u0627', '\u062b\u0627\u0645\u0646\u0627', '\u062a\u0627\u0633\u0639\u0627', '\u0639\u0627\u0634\u0631\u0627'];
const ORDINAL_HEAD_RE = /^([\u0600-\u06ff]+)/u;
export function renumberOrdinal(value, index) {
  const m = ORDINAL_HEAD_RE.exec(String(value || ''));
  if (!m) return { value, ordinal: false };
  const at = ORDINALS.indexOf(normalizeArabic(m[1].replace(MARKS_RE, '')));
  if (at < 0) return { value, ordinal: false };
  if (index >= ORDINAL_WORDS.length) return { value, ordinal: true };
  const tanween = /\u064b/u.test(m[1]) ? '\u064b' : '';
  return { value: ORDINAL_WORDS[index] + tanween + String(value).slice(m[1].length), ordinal: true };
}
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
 * @param {string} o.askedMatn           the hadith the question names (askedHadithOf), or ''; C4 reads it
 *                                        as the referent of a unit that names "this hadith" before any
 *                                        unit has quoted one. Never logged.
 * @param {boolean} o.sourceQuestion      C7: the question asks for the asked hadith's source (asksHadithSource); until
 *                                        a unit proved on that hadith goes out, nothing else does
 */
export function createBw2Releaser({ rows = [], mode = '', emit, takhrij = null, cards = null,
  notCoveredSentence = '', holdUncitedRulings = false, now = () => 0, askedMatn = '', sourceQuestion = false,
  askedNarrator = '' } = {}) {
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
  // C4: units released by a hadith proof, and the matns the answer quoted last (the referent of a unit
  // that names "the hadith" without quoting it).
  let unitsProvedHadith = 0;
  let lastMatns = [];
  // C7: units released on a proof of the asked hadith.
  let provedAsked = 0;
  // SPEED PIPES fix 7: the heading waiting for its first released unit ({unit, value}), or null.
  let pendingHeading = null;
  // SPEED PIPES2 fix 4: has a unit quoting the asked narrator's narration gone out?
  let narrationOut = false;
  // SPEED PIPES2 fix 9: the rows the last released unit cited, and how many released units quoted a text.
  let lastCited = [];
  // SPEED PIPES2 fix 11: how many ordinal-led lines have gone out.
  let ordinalsOut = 0;
  let lastReleased = '';
  let matnsOut = 0;

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

  // SPEED FIX 2, C3 (and SPEED FIX 3, C4): one takhrij lookup, counted; null when it failed or timed out
  // -- the unit is then judged on the rows alone, as the runner would.
  const lookup = async (probe) => {
    takhrijLookups += 1;
    const lookupStarted = now();
    let pass = null;
    try { pass = await takhrij(probe); } catch { pass = null; }
    takhrijMs += Math.max(0, now() - lookupStarted);
    if (pass && Array.isArray(pass.sourced)) takhrijMatched += pass.sourced.length;
    return pass;
  };
  // SPEED FIX 3, C4 (a): the kept row that carries the hadith's text (C1's rowCarriesMatn) and names every
  // collection and narrator the unit names, all in that one row -- a row the unit cites first, then the
  // pinned table in its order.
  const rowProving = (claim, cited) => {
    for (const row of [...cited, ...rows.filter((r) => !cited.includes(r))]) {
      const pinnedText = pinnedTextOf(row);
      if (!claim.matns.every((matn) => rowCarriesMatn(pinnedText, matn, carriedFoldOf(row)))) continue;
      const named = collectionsNamed(pinnedText);
      if (!claim.collections.every((key) => named.includes(key))) continue;
      const folded = normalizeArabic(pinnedText);
      // C6: the row names each narrator (textNamesNarrator: a title or a nisba the row does not write is fine).
      if (!claim.narrators.every((name) => textNamesNarrator(folded, name))) continue;
      return row;
    }
    return null;
  };
  // (b): the takhrij proved every matn of the claim (it named a book for it), every collection the unit
  // names is among the books it named, and every narrator is the Companion it named.
  const takhrijProves = (claim, pass) => {
    const entries = pass && Array.isArray(pass.entries) ? pass.entries : [];
    const books = [];
    const companions = [];
    for (const matn of claim.matns) {
      const mine = entries.filter((entry) => entry && sameCarriedMatn(entry.matn, matn));
      const named = collectionsNamed(mine.flatMap((entry) => (Array.isArray(entry.books) ? entry.books : [])).join(' \u0648'), true);
      if (!named.length) return false;
      books.push(...named);
      companions.push(...mine.map((entry) => normalizeArabic(String(entry.companion || ''))).filter(Boolean));
    }
    return claim.collections.every((key) => books.includes(key))
      && claim.narrators.every((name) => companions.some((c) => textNamesNarrator(c, name)));
  };
  // A credit span of the unit that names nothing but proved collections -- C6: or proved narrators ("rawahu
  // Anas ibn Malik"); claimOnlyNames requires one name at least -- is handed to the lock as proved, beside
  // the matn it credits; the lock then keeps it as it keeps a credit a page carries.
  const provedSpan = (span, claim) => span.kind === 'attribution' && claimOnlyNames(span.phrase, claim);

  async function check(body, askedFirst = false) {
    const refs = collectCited(body);
    let cited = refs.map((ref) => byRef.get(ref)).filter(Boolean);
    let value = dropOrphanRefNumbers(stripCitations(body));
    value = stripReaderTags(stripModelCards(value)).trim();
    if (!value) return { ok: false, reason: 'empty' };
    if (isToolAnnouncement(value)) return { ok: false, reason: 'tool_announcement' };

    // SPEED FIX 3, C4: the hadith proofs come first. (a) a kept row carries it -- released on that row as
    // its citation, cited or not; else (b) the takhrij proves it -- released with the takhrij's
    // parenthetical, as today. What neither proves goes on below exactly as before, under today's reasons.
    const ownMatns = findTargets(value).targets.map((target) => target.matn);
    // C7: a unit that opens "this hadith" while the answer awaits its first proof means the asked hadith.
    const referent = askedFirst && askedMatn ? [askedMatn] : (lastMatns.length ? lastMatns : (askedMatn ? [askedMatn] : []));
    if (ownMatns.length) lastMatns = ownMatns;
    const claim = hadithClaimOf(value, ownMatns, referent);
    let proof = null;
    let pass;
    if (claim) {
      const row = rowProving(claim, cited);
      if (row) {
        proof = 'row';
        cited = [row, ...cited.filter((other) => other !== row)];
      } else if (takhrij) {
        const lookupText = claim.own ? value : claim.matns.map((matn) => PROPHET_SAID + '\u00ab' + matn + '\u00bb.').join('\n');
        const got = await lookup(lookupText);
        if (claim.own) pass = got;
        if (takhrijProves(claim, got)) proof = 'takhrij';
      }
    }
    const waived = (note) => proof !== null && claimOnlyNames(String(note.claimedAuthority || ''), claim);

    // A lead-in and the quote it introduces are judged as ONE sentence: the reviewer splits on line
    // breaks, and a lone line ending in a colon asserts nothing, so the credit would never be seen.
    const reviewText = value.replace(/([:\uff1a])[ \t]*\n[ \t]*/gu, '$1 ');
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
      // C4: a credit naming nothing but what the proof proved is not held for want of a scholar's row.
      if (waived(note)) continue;
      return { ok: false, reason: 'unsupported_attribution' };
    }
    const actions = review.verdict.sentences.map((sentence) => sentence.action);
    const consensus = foldedKeysIn(folded, CONSENSUS_KEYS);
    const schools = foldedKeysIn(folded, SCHOOL_KEYS);
    const prophet = frameNamesProphet(value);
    const quotesMatn = ownMatns.length > 0;
    const groups = groupFamiliesIn(folded);
    // C4: on a proved unit, the Prophet, its matn and the credits naming only what was proved need no
    // other citation; any other attribution in it still does.
    const grading = bareGradeSpans(value).length > 0 || carriesGeneralSpeakerGrade(value)
      || takhrijSpans(value).some((span) => proof === null || !provedSpan(span, claim));
    // C6: a hadith claim (hadithClaimOf) that no proof carried attributes, even where the reviewer and the credit
    // spans do not read it ("rawa hadha al-hadith al-Bukhari ..."): uncited, it is held as today's uncited attribution.
    const attributes = (proof === null
      ? actions.some((action) => ATTRIBUTING_ACTIONS.has(action)) || prophet || quotesMatn || claim !== null
      : review.annotations.some((note) => ATTRIBUTING_ACTIONS.has(note.action) && !waived(note)))
      || consensus.length > 0 || schools.length > 0 || groups.length > 0 || grading;
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
      // C4: the lookup (b) already made on this very text is the unit's one lookup, not a second.
      if (pass === undefined) pass = await lookup(value);
      if (pass && typeof pass.text === 'string' && pass.text.trim()) value = pass.text;
      if (pass && Array.isArray(pass.proofs)) proofs.push(...pass.proofs);
      if (pass && Array.isArray(pass.sourced)) sourcedMatns = pass.sourced;
    }
    // A quoted matn is an attribution to the Prophet (or a Companion) whether or not the frame names
    // him: a cited row must carry it, or the takhrij runner must have proved it. SPEED FIX 2, C1: "carry"
    // is rowCarriesMatn, so a row that quotes the matn with other spacing or punctuation carries it.
    if (quotesMatn) {
      for (const target of findTargets(value).targets) {
        const carried = cited.some((row) => rowCarriesMatn(pinnedTextOf(row), target.matn, carriedFoldOf(row)))
          || sourcedMatns.includes(target.matn)
          || (proof !== null && claim.matns.some((matn) => sameCarriedMatn(matn, target.matn)));
        if (!carried) return { ok: false, reason: 'unsupported_matn' };
      }
    }

    // C4: each credit span that names only what the proof proved goes to the lock as a proved page (the
    // span beside each matn of the claim), for this unit alone.
    const provedPages = proof === null ? [] : takhrijSpans(value).filter((span) => provedSpan(span, claim))
      .flatMap((span) => claim.matns.map((matn) => ({ title: '', passage: value.slice(span.start, span.end) + ' ' + matn })));
    const locked = lockTakhrij(value, [...cited.map(pageOf), ...proofs, ...provedPages]);
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
    return { ok: true, text: value, cited, proved: proof !== null,
      provedAsked: proof !== null && askedMatn !== '' && claim.matns.some((matn) => sameCarriedMatn(matn, askedMatn)) };
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
    // PIPES2 fix 3: an opening that says the gathered texts do not treat the question is the marker.
    if (released === 0 && !pendingHeading && admitsNotCovered(current.body)) {
      markNotCovered();
      hold('not_covered_sentence', current);
      return;
    }
    // R5: a unit that leans on the one before it goes with that one: held when it was held; and no
    // answer opens on a speech verb without its speaker, a bare quotation or a connector.
    const leans = dependentKind(stripCitations(current.body));
    // C7: a question about the asked hadith's source, whose answer has not yet given a unit proved on that hadith.
    const awaiting = sourceQuestion && askedMatn !== '' && provedAsked === 0;
    const askedFirst = awaiting && opensWithThisHadith(stripCitations(current.body));
    if (leans && prevHeld && !askedFirst) { hold('dependent_on_held', current); return; }
    // C5: an opening that points back needs something substantive (cited or proved) before it.
    if (leans === 'backref' && substantive === 0) { hold('dependent_opening', current); return; }
    // SPEED PIPES2 fix 9: the first unit never points back; "this hadith" needs a hadith out (or named by the question).
    if (leans === 'implicit' && substantive === 0) { hold('dependent_opening', current); return; }
    if (pointsToHadith(stripCitations(current.body)) && matnsOut === 0 && !askedMatn) { hold('dependent_opening', current); return; }
    if (leans && leans !== 'pronoun' && leans !== 'credit' && !text && !pendingHeading) { hold('dependent_opening', current); return; }
    const verdict = await check(current.body, askedFirst);
    if (notCovered) { hold('not_covered', current); return; }
    // C7: nothing goes out before the first unit proved on the asked hadith. What today's checks hold keeps its reason.
    if (awaiting && !(verdict.ok && verdict.provedAsked)) {
      hold(leans && prevHeld ? 'dependent_on_held' : (verdict.ok ? 'dependent_opening' : verdict.reason), current);
      return;
    }
    // SPEED PIPES2 fix 4: "what did X narrate" is answered with X's narration first, or not at all (then the path goes on).
    if (askedNarrator && !narrationOut) {
      if (!(verdict.ok && quotesNarrationOf(verdict.text, verdict.cited, askedNarrator))) {
        hold(leans && prevHeld ? 'dependent_on_held' : (verdict.ok ? 'dependent_opening' : verdict.reason), current);
        return;
      }
      narrationOut = true;
    }
    if (!verdict.ok) { hold(verdict.reason, current); return; }
    // SPEED PIPES2 fix 9: an implicit subject is the speaker of the unit before it; a unit citing none of that unit's
    // rows puts somebody else under it (16: "wa-rajjaha al-thani" cites Ibn Rajab after a unit citing Ibn 'Uthaymin).
    if (leans === 'implicit' && !verdict.cited.some((row) => lastCited.includes(row))) { hold('dependent_opening', current); return; }
    // A speech verb with no speaker after it ("fa-ajaba:") answers the unit before it: after a question that names
    // nobody (16: "an appended question: which knowledge does the verse mean?") there is no one to have answered.
    if (leans === 'speech' && /[?\u061f]$/u.test(lastReleased.trim()) && !NAMES_SOMEBODY_RE.test(' ' + normalizeArabic(lastReleased) + ' ')) {
      hold('dependent_opening', current);
      return;
    }
    // SPEED PIPES fix 7: a heading waits; the one before it, if nothing came under it, is dropped.
    if (isHeadingUnit(current.body) || isPlainTitleUnit(current.body)) {
      if (pendingHeading) hold('empty_heading', pendingHeading.unit);
      pendingHeading = { unit: current, value: verdict.text };
      prevHeld = false;
      return;
    }
    if (pendingHeading) {
      const heading = pendingHeading;
      pendingHeading = null;
      const hsep = sepFor(heading.unit);
      const numbered = renumberOrdinal(heading.value, ordinalsOut);
      if (numbered.ordinal) ordinalsOut += 1;
      if (!send(hsep + renumber(numbered.value, !text || /\n/u.test(hsep)))) return;
      released += 1;
      pendingSep = '';
      forceNewline = false;
      foldedReleased += ' ' + substanceWords(heading.value).join(' ');
    }
    const sep = sepFor(current);
    const startsLine = !text || /\n/u.test(sep);
    // SPEED PIPES2 fix 10 (item 5): the answer does not open on "fa-" welded to its first word ("fa-l-hukmu annahu",
    // "fa-qad qala" -- round 7, 11-a and 10-a): the unit stands by itself, only the letter points back. Taken off
    // before release, as every normalization here, and only at the answer's head.
    const opened = text ? verdict.text : verdict.text.replace(OPENING_FA_RE, '$1');
    // Every line of the unit that starts on an ordinal counts (a lead-in may carry the first heading on its second line).
    const counted = opened.split('\n').map((line, i) => {
      if (i === 0 && !startsLine) return line;
      const n = renumberOrdinal(line, ordinalsOut);
      if (n.ordinal) ordinalsOut += 1;
      return n.value;
    }).join('\n');
    const value = renumber(counted, startsLine);
    if (!send(sep + value)) return;
    released += 1;
    prevHeld = false;
    pendingSep = '';
    forceNewline = false;
    foldedReleased += ' ' + substanceWords(value).join(' ');
    // C4: a unit released by a hadith proof counts as covered, cited or not.
    if (verdict.proved) unitsProvedHadith += 1;
    if (verdict.provedAsked) provedAsked += 1;
    if (verdict.cited.length || verdict.proved) substantive += 1;
    lastCited = verdict.cited;
    lastReleased = value;
    if (findTargets(value).targets.length || (value.match(QUOTED_RUN_RE) || []).some((run) => foldCarried(run).length >= MIN_CARRIED_LETTERS)) matnsOut += 1;
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
      if (pendingHeading) { hold('empty_heading', pendingHeading.unit); pendingHeading = null; }
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
        heldBeforeFirst, takhrijLookups, takhrijMs, takhrijMatched, unitsProvedHadith,
        cited: [...citedOrder], proofs: [...proofs], dead, notCovered,
      };
    },
    get text() { return text; },
    get dead() { return dead; },
  };
}
