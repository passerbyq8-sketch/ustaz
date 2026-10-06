// lib/lang/table.js -- THE PER-LANGUAGE PROPERTIES TABLE (item 74, ruling h1).
//
// Everything that changes with a language is read from here -- direction, digit system, script, the
// published translation set, the name the translation prompt uses -- and never from an «is it
// Arabic or not» test. A right-to-left language with non-Arabic digits (Persian) is therefore a ROW,
// not a code path. The client keeps its own copy of the visual half of these properties next to its
// language list (app.jsx EZ_LANGUAGES); lib/lang guards compare the two.
//
// `answerTranslation` is false for Arabic: an Arabic question never passes through any translation
// step, and its path after the detector is today's path unchanged (ruling h9).
export const LANG_TABLE = Object.freeze({
  ar: Object.freeze({ code: 'ar', name: 'Arabic', dir: 'rtl', script: 'arab', digits: 'arab-indic', answerTranslation: false }),
  en: Object.freeze({
    code: 'en', name: 'English', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-en.json.gz', key: 'english_saheeh' }),
    hadith: 'hadith-en.json.gz', terms: 'terms-en.json.gz',
    labels: Object.freeze({ translation: 'Translation', quranBy: 'Qur’an translation', hadithBy: 'Hadith translation' }),
  }),
});

export const LANG_CODES = Object.freeze(Object.keys(LANG_TABLE));
export const DEFAULT_KEY_LANG = 'ar';
export function langRow(code) { return LANG_TABLE[code] || null; }
export function isKnownLang(code) { return typeof code === 'string' && Object.prototype.hasOwnProperty.call(LANG_TABLE, code); }
/** The interface-language key a client sent, or the default: anything not in the table is Arabic. */
export function keyLangOf(value) { return isKnownLang(value) ? value : DEFAULT_KEY_LANG; }
