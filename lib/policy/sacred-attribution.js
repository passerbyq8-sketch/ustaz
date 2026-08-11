// lib/policy/sacred-attribution.js
// One lexical source for sacred subjects used by attribution and bounded name presence.
// It classifies only explicit grammatical frames; it does not infer doctrine or identity.

import { normalizeArabic } from '../route-classify.js';

const norm = (s) => normalizeArabic(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();

const PROPHETIC_SUBJECTS = [
  'النبي', 'نبي', 'الرسول', 'رسول', 'المصطفى',
  'صلى الله عليه', 'صلى الله عليه وسلم',
].map(norm);

const DIVINE_SUBJECTS = [
  'الله', 'الرحمن', 'الرحيم', 'العزيز', 'رب العالمين', 'الخالق',
].map(norm);

// This is the detector's one speech-head vocabulary.  Contextual sacred frames (notably
// «قال تعالى») and attribution capture boundaries consume the same list, so adding a detector
// head cannot silently leave the sacred veto behind.
export const ATTRIBUTION_SPEECH_HEADS = Object.freeze([
  'قال', 'يقول', 'ذكر', 'افتي', 'أفتى', 'افتى', 'رجح', 'اختار', 'نص', 'عن', 'روي', 'روى', 'رواه',
].map(norm));
export const ATTRIBUTION_SPEECH_HEAD_ALT = ATTRIBUTION_SPEECH_HEADS.join('|');

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
