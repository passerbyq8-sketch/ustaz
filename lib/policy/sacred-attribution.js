// lib/policy/sacred-attribution.js
// One lexical source for sacred subjects used by attribution and bounded name presence.
// It classifies only explicit grammatical frames; it does not infer doctrine or identity.

import { normalizeArabic, stripPropheticHonorifics } from '../route-classify.js';

const norm = (s) => normalizeArabic(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();

// One subject declaration also owns the only permitted divine-name composition. This is
// metadata on the existing vocabulary, not a second list: «رسول الله» composes, while an
// arbitrary «النبي الله» sequence is not silently promoted into a Prophetic attribution.
const PROPHETIC_SUBJECT_DEFINITIONS = Object.freeze([
  ['النبي', false], ['نبي', false], ['الرسول', true], ['رسول', true], ['المصطفى', false],
  ['صلى الله عليه', false], ['صلى الله عليه وسلم', false],
].map(([text, acceptsDivineComplement]) => Object.freeze({
  text: norm(text), acceptsDivineComplement,
})));
const PROPHETIC_SUBJECTS = PROPHETIC_SUBJECT_DEFINITIONS.map((entry) => entry.text);

const DIVINE_SUBJECTS = [
  'الله', 'الرحمن', 'الرحيم', 'العزيز', 'رب العالمين', 'الخالق',
].map(norm);

// This is the detector's one speech-head vocabulary.  Contextual sacred frames (notably
// «قال تعالى») and attribution capture boundaries consume the same list, so adding a detector
// head cannot silently leave the sacred veto behind.
const ATTRIBUTION_HEAD_DEFINITIONS = Object.freeze([
  ['قال', false], ['يقول', false], ['ذكر', false], ['افتي', false], ['أفتى', false],
  ['افتى', false], ['رجح', false], ['اختار', false], ['نص', false], ['عن', false],
  ['روي', true], ['روى', true], ['رواه', true],
].map(([text, governsRelationReport]) => Object.freeze({
  text: norm(text), governsRelationReport,
})));
export const ATTRIBUTION_SPEECH_HEADS = Object.freeze(
  ATTRIBUTION_HEAD_DEFINITIONS.map((entry) => entry.text));
export const ATTRIBUTION_SPEECH_HEAD_ALT = ATTRIBUTION_SPEECH_HEADS.join('|');

/** Exact grammar metadata for «رُوي عن النبي»; ordinary saying/about heads do not qualify. */
export function relationReportHead(raw) {
  const value = norm(raw);
  const entry = ATTRIBUTION_HEAD_DEFINITIONS.find((candidate) => candidate.text === value);
  return entry && entry.governsRelationReport ? entry.text : '';
}

const OTHER_SACRED_FRAMES = [
  'المرسلين', 'الانبياء', 'انبياء',
  'الصحابي', 'صحابي', 'الصحابه', 'صحابه', 'التابعي', 'تابعي',
  'الخليفه', 'خليفه', 'امير المومنين', 'ام المومنين', 'امهات المومنين',
  'الصديق', 'الفاروق', 'ذو النورين', 'المرتضي',
  'عليه السلام', 'عليها السلام', 'رضي الله عنه', 'رضي الله عنها',
  'الامام', 'العلامه', 'الحافظ', 'شيخ الاسلام', 'المفتي', 'الفقيه',
].map(norm);

const OTHER_SACRED_NAMES = [
  'جبريل', 'جبرائيل', 'ميكائيل', 'اسرافيل', 'عزرائيل', 'مالك خازن',
  'ابليس', 'الشيطان', 'الدجال', 'المسيح الدجال', 'المهدي المنتظر',
].map(norm);

const SACRED_FRAMES = Object.freeze([...PROPHETIC_SUBJECTS, ...OTHER_SACRED_FRAMES]);
const SACRED_NAMES = Object.freeze([...DIVINE_SUBJECTS, ...OTHER_SACRED_NAMES]);
const ALL_SACRED = Object.freeze([...SACRED_FRAMES, ...SACRED_NAMES]);
const PROPHETIC_OR_DIVINE = Object.freeze([...PROPHETIC_SUBJECTS, ...DIVINE_SUBJECTS]);
const DIVINE_SET = new Set(DIVINE_SUBJECTS);

function words(raw) { return norm(raw).split(' ').filter(Boolean); }
function phraseWords(phrase) { return phrase.split(' ').filter(Boolean); }

function phraseAt(hay, at, phrase) {
  const needle = phraseWords(phrase);
  if (!needle.length || at + needle.length > hay.length) return false;
  return needle.every((word, i) => hay[at + i] === word);
}

function containsSacredPhrase(hay, phrase) {
  for (let i = 0; i < hay.length; i++) {
    if (!phraseAt(hay, i, phrase)) continue;
    // A divine name immediately governed by «عبد» is a human compound name: عبد الله، عبد
    // الرحمن، عبد الرحيم، عبد العزيز.  Connected spellings never match a standalone token,
    // and the separated spelling receives the same treatment here.
    if (DIVINE_SET.has(phrase) && i > 0 && hay[i - 1] === norm('عبد')) continue;
    return true;
  }
  return false;
}

function hasContextualDivineFrame(raw, candidate = '') {
  const target = norm(candidate);
  if (target && target !== norm('تعالى')) return false;
  const hay = words(raw);
  const taala = norm('تعالى');
  for (let i = 1; i < hay.length; i++) {
    if (hay[i] === taala && ATTRIBUTION_SPEECH_HEADS.includes(hay[i - 1])) return true;
  }
  return false;
}

/** Does a subject contain one of the repository's declared sacred names/frames? */
export function containsSacredSubject(raw) {
  const hay = words(raw);
  if (!hay.length) return false;
  return ALL_SACRED.some((phrase) => containsSacredPhrase(hay, phrase));
}

/** Narrow identity veto: prophetic/divine subjects, never ordinary human honorifics. */
export function containsPropheticOrDivineSubject(raw) {
  const hay = words(raw);
  if (!hay.length) return false;
  return PROPHETIC_OR_DIVINE.some((phrase) => containsSacredPhrase(hay, phrase))
    || hasContextualDivineFrame(raw);
}

/**
 * Positive prophetic signal for structured request planning. This deliberately reuses the
 * detector's existing prophetic vocabulary: it neither treats every DEEN quotation as hadith
 * nor grows a second list that could drift from the sacred-attribution veto.
 */
export function containsPropheticSubject(raw) {
  return propheticSubjectSpan(raw) !== null;
}

/**
 * Word span of the first declared Prophetic subject inside one detector capture. Attribution
 * uses the end of this span—not the end of an over-wide name capture—to decide whether a comma
 * immediately follows the subject. The vocabulary remains the single list above.
 */
export function propheticSubjectSpan(raw) {
  const hay = words(raw);
  let selected = null;
  for (let at = 0; at < hay.length; at++) {
    for (const phrase of PROPHETIC_SUBJECTS) {
      const needle = phraseWords(phrase);
      if (!phraseAt(hay, at, phrase)) continue;
      const candidate = { wordStart: at, wordCount: needle.length };
      if (!selected || at + needle.length > selected.wordStart + selected.wordCount
        || (at + needle.length === selected.wordStart + selected.wordCount
          && needle.length > selected.wordCount)) selected = candidate;
    }
  }
  return selected ? Object.freeze(selected) : null;
}

/**
 * Does a detector-owned subject tail contain only a Prophetic subject and an already-declared
 * Prophetic honorific? This is deliberately total over the tail up to the quote: a
 * word such as «المقال», «السؤال» or «ثم» cannot be skipped to reconnect an earlier speaker.
 */
export function isPropheticSubjectSequence(raw) {
  const hay = words(raw);
  if (!hay.length) return false;
  let cursor = 0;
  let firstLength = 0;
  let firstAcceptsDivineComplement = false;
  for (const entry of PROPHETIC_SUBJECT_DEFINITIONS) {
    const needle = phraseWords(entry.text);
    if (phraseAt(hay, 0, entry.text) && needle.length > firstLength) {
      firstLength = needle.length;
      firstAcceptsDivineComplement = entry.acceptsDivineComplement;
    }
  }
  if (!firstLength) return false;
  cursor = firstLength;

  // «رسول الله» composes two declarations already owned here: Prophetic «رسول» followed by
  // the divine name. No other Prophetic label may consume a divine phrase after itself.
  if (firstAcceptsDivineComplement) {
    for (;;) {
      let length = 0;
      for (const phrase of DIVINE_SUBJECTS) {
        const needle = phraseWords(phrase);
        if (phraseAt(hay, cursor, phrase) && needle.length > length) length = needle.length;
      }
      if (!length) break;
      cursor += length;
    }
  }
  if (cursor >= hay.length) return true;
  return stripPropheticHonorifics(hay.slice(cursor).join(' ')) === '';
}

/** Positive divine signal from the same declared sacred vocabulary. */
export function containsDivineSubject(raw) {
  const hay = words(raw);
  if (!hay.length) return false;
  return DIVINE_SUBJECTS.some((phrase) => containsSacredPhrase(hay, phrase))
    || hasContextualDivineFrame(raw);
}

/** Is the entire candidate a generic sacred label rather than a person's identifying name? */
export function isBareSacredLabel(raw) {
  const value = norm(raw);
  return !!value && ALL_SACRED.includes(value);
}

/**
 * Veto the candidate selected by attribution's own regex, independent of which detector head
 * selected it. This covers every existing head without maintaining a second trigger lexicon and
 * does not veto «ابن باز» merely because «قول الله» appears later in the same question.
 */
export function isSacredAttributionCapture(rawCapture, cleanedName = '', context = {}) {
  const cleaned = String(cleanedName || '').trim();
  // Cleaning deliberately removes devotional suffixes such as «رحمه الله». When a real candidate
  // survived cleaning, judge that candidate—not discarded suffix text around it.
  const candidate = cleaned || String(rawCapture || '').trim();
  const frameText = String(context.frameText || context.question || rawCapture || '');
  return containsSacredSubject(candidate) || isBareSacredLabel(candidate)
    || hasContextualDivineFrame(frameText, candidate);
}
