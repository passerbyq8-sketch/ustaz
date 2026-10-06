// lib/lang/detect.js -- THE QUESTION-LANGUAGE DETECTOR (item 74, ruling h2). One function, one place.
//
// It returns a code from the table in ./table.js and knows exactly two languages today: Arabic and English.
//   * any character of the Arabic script  -> 'ar'  (so every question that is written in Arabic letters is
//     Arabic, exactly as it is today -- Persian and Urdu in the Arabic script are Arabic here, by design,
//     until their own rows exist);
//   * Latin-only text that reads as English (function words, not a guess from a single word) -> 'en';
//   * everything else -- one word, digits, another Latin-script language, a mixed fragment -- is ambiguous,
//     and ambiguity resolves to the key language (the interface language the reader chose).
import { keyLangOf, isKnownLang } from './table.js';

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const EN_WORDS = new Set(('the is are was were be been what how why when where who whom which can could do does did i my me mine you your '
  + 'we our he she it they them his her its of to in on at for with without from by about and or but not no if then that this these those '
  + 'a an should would shall will may might must please tell explain give write say ask there here as so than also just').split(' '));

const EN_OPENERS = new Set('what how why when where who whom which is are can could do does did should would will may please tell explain give write say ask'.split(' '));

export function hasArabicScript(text) { return ARABIC_SCRIPT.test(String(text == null ? '' : text)); }

/** @returns {'ar'|'en'} a code present in the language table */
export function detectQuestionLang(text, keyLang) {
  const key = keyLangOf(keyLang);
  const s = String(text == null ? '' : text);
  if (ARABIC_SCRIPT.test(s)) return 'ar';
  const words = (s.toLowerCase().match(/[a-z']+/g) || []);
  if (words.length === 0) return key;
  let hits = 0; for (const w of words) if (EN_WORDS.has(w)) hits++;
  // two function words, or one that opens a question/request: a lone «for» or «the» is not enough to take a text away from the key language
  const english = hits >= 2 || (words.length <= 12 && EN_OPENERS.has(words[0]));
  if (english && isKnownLang('en')) return 'en';
  return key;
}
