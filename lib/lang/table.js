// lib/lang/table.js -- THE PER-LANGUAGE PROPERTIES TABLE (item 74, ruling h1).
//
// Everything that changes with a language is read from here -- direction, digit system, script, the
// published translation set, the name the translation prompt uses, the words printed beside a published
// translation, the three language-specific lines of the translation prompt -- and never from an «is it
// Arabic or not» test. A right-to-left language with non-Arabic digits (Persian) is therefore a ROW,
// not a code path. The client keeps its own copy of the visual half of these properties next to its
// language list (app.jsx EZ_LANGUAGES); lib/lang guards compare the two.
//
// `answerTranslation` is false for Arabic: an Arabic question never passes through any translation
// step, and its path after the detector is today's path unchanged (ruling h9).
//
// `labels` are the words this layer prints INSIDE the reader's paragraph beside a published translation. `{...}` are filled by
// lib/lang/answer.js; the publisher's own title and source name are printed exactly as published, never translated.
//   quranSrc / hadithSrc  the source line;  full  the mark for "the whole verse / hadith is shown";  grade  and  notes  the optional tails.
// `prompt` holds the three lines of the answer-translation prompt that are about the language itself (lib/lang/model.js).
const row = (r) => Object.freeze(r);
export const LANG_TABLE = Object.freeze({
  ar: row({ code: 'ar', name: 'Arabic', dir: 'rtl', script: 'arab', digits: 'arab-indic', answerTranslation: false }),
  en: row({
    code: 'en', name: 'English', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-en.json.gz', key: 'english_saheeh' }),
    hadith: 'hadith-en.json.gz', terms: 'terms-en.json.gz',
    labels: Object.freeze({
      translation: 'Translation', quranBy: 'Qur’an translation', hadithBy: 'Hadith translation',
      quranSrc: '{by} {ref}{full}: {title}, via {source}, v{version}', quranFull: ' (the verse in full)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (the hadith in full)',
      grade: '; grade as published: {grade}', notes: '. Notes as published: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters (standard scholarly transliteration: salah, zakah, wudu, fiqh, hadith) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its English for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: transliterate only.',
      honorifics: 'ﷺ after the Prophet’s name -> (peace and blessings be upon him); رضي الله عنه -> (may Allah be pleased with him); رحمه الله -> (may Allah have mercy on him). Scholars’ names, book titles and places are transliterated.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  fa: row({
    code: 'fa', name: 'Persian', dir: 'rtl', script: 'arab', digits: 'arab-ext', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-fa.json.gz', key: 'persian_ih' }),
    hadith: 'hadith-fa.json.gz', terms: 'terms-fa.json.gz',
    labels: Object.freeze({
      translation: 'ترجمه', quranBy: 'ترجمهٔ قرآن', hadithBy: 'ترجمهٔ حدیث',
      quranSrc: '{by} {ref}{full}: {title}، از {source}، نسخهٔ {version}', quranFull: ' (آیه به‌طور کامل)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (حدیث به‌طور کامل)',
      grade: '؛ درجهٔ حدیث بنا بر منبع: {grade}', notes: '. توضیحات منتشرشده: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the term in Persian letters the way Persian-speaking Muslims write it (نماز، زکات، وضو، فقه، حدیث) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Persian for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (صلی‌الله‌علیه‌وسلم); رضي الله عنه -> (رضی‌الله‌عنه); رحمه الله -> (رحمه‌الله). Scholars’ names, book titles and places are written in Persian letters.',
      numbers: 'Write numbers with Persian digits (۰۱۲۳۴۵۶۷۸۹).',
    }),
  }),
  fr: row({
    code: 'fr', name: 'French', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-fr.json.gz', key: 'french_rashid' }),
    hadith: 'hadith-fr.json.gz', terms: 'terms-fr.json.gz',
    labels: Object.freeze({
      translation: 'Traduction', quranBy: 'Traduction du Coran', hadithBy: 'Traduction du hadith',
      quranSrc: '{by} {ref}{full} : {title}, via {source}, v{version}', quranFull: ' (le verset en entier)',
      hadithSrc: '{by}{full} : {source}{grade}', hadithFull: ' (le hadith en entier)',
      grade: ' ; degré selon la source : {grade}', notes: '. Notes publiées : {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in French (salat, zakat, woudou, fiqh, hadith) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its French for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: transliterate only.',
      honorifics: 'ﷺ after the Prophet’s name -> (que la paix et les bénédictions d’Allah soient sur lui); رضي الله عنه -> (qu’Allah l’agrée); رحمه الله -> (qu’Allah lui fasse miséricorde). Scholars’ names, book titles and places are transliterated.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  id: row({
    code: 'id', name: 'Indonesian', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-id.json.gz', key: 'indonesian_sabiq' }),
    hadith: 'hadith-id.json.gz', terms: 'terms-id.json.gz',
    labels: Object.freeze({
      translation: 'Terjemahan', quranBy: 'Terjemahan Al-Qur’an', hadithBy: 'Terjemahan hadis',
      quranSrc: '{by} {ref}{full}: {title}, melalui {source}, v{version}', quranFull: ' (ayat lengkap)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (hadis lengkap)',
      grade: '; derajat menurut sumber: {grade}', notes: '. Catatan sebagaimana diterbitkan: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Indonesian (salat, zakat, wudu, fikih, hadis) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Indonesian for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: transliterate only.',
      honorifics: 'ﷺ after the Prophet’s name -> (semoga shalawat dan salam tercurah kepadanya); رضي الله عنه -> (semoga Allah meridainya); رحمه الله -> (semoga Allah merahmatinya). Scholars’ names, book titles and places are transliterated.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  ur: row({
    code: 'ur', name: 'Urdu', dir: 'rtl', script: 'arab', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-ur.json.gz', key: 'urdu_junagarhi' }),
    hadith: 'hadith-ur.json.gz', terms: 'terms-ur.json.gz',
    labels: Object.freeze({
      translation: 'ترجمہ', quranBy: 'ترجمۂ قرآن', hadithBy: 'ترجمۂ حدیث',
      quranSrc: '{by} {ref}{full}: {title}، بذریعہ {source}، نسخہ {version}', quranFull: ' (پوری آیت)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (پوری حدیث)',
      grade: '؛ مصدر کے مطابق درجہ: {grade}', notes: '۔ شائع شدہ حواشی: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the term in Urdu letters the way Urdu-speaking Muslims write it (نماز، زکوٰۃ، وضو، فقہ، حدیث) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Urdu for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (صلی اللہ علیہ وسلم); رضي الله عنه -> (رضی اللہ عنہ); رحمه الله -> (رحمہ اللہ). Scholars’ names, book titles and places are written in Urdu letters.',
      numbers: 'Write numbers with Latin digits (0123456789).',
    }),
  }),
  bn: row({
    code: 'bn', name: 'Bengali', dir: 'ltr', script: 'beng', digits: 'beng', answerTranslation: true,
    hadith: 'hadith-bn.json.gz', terms: 'terms-bn.json.gz',
    labels: Object.freeze({
      translation: 'অনুবাদ', quranBy: 'কুরআনের অনুবাদ', hadithBy: 'হাদিসের অনুবাদ',
      quranSrc: '{by} {ref}{full}: {title}, {source}-এর মাধ্যমে, সংস্করণ {version}', quranFull: ' (সম্পূর্ণ আয়াত)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (সম্পূর্ণ হাদিস)',
      grade: '; উৎস অনুযায়ী মান: {grade}', notes: '। প্রকাশিত টীকা: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Bengali letters the way Bengali-speaking Muslims write it (নামাজ, যাকাত, ওযু, ফিকহ, হাদিস) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Bengali for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম); رضي الله عنه -> (রাদিয়াল্লাহু আনহু); رحمه الله -> (রাহিমাহুল্লাহ). Scholars’ names, book titles and places are written in Bengali letters.',
      numbers: 'Write numbers with Bengali digits (০১২৩৪৫৬৭৮৯).',
    }),
  }),
  tr: row({
    code: 'tr', name: 'Turkish', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-tr.json.gz', key: 'turkish_rwwad' }),
    hadith: 'hadith-tr.json.gz', terms: 'terms-tr.json.gz',
    labels: Object.freeze({
      translation: 'Çeviri', quranBy: 'Kur’an meali', hadithBy: 'Hadis çevirisi',
      quranSrc: '{by} {ref}{full}: {title}, {source} üzerinden, sürüm {version}', quranFull: ' (ayetin tamamı)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (hadisin tamamı)',
      grade: '; kaynağa göre derece: {grade}', notes: '. Yayımlanan notlar: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Turkish (namaz, zekât, abdest, fıkıh, hadis) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Turkish for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (sallallâhü aleyhi ve sellem); رضي الله عنه -> (radıyallâhü anh); رحمه الله -> (rahimehullâh). Scholars’ names, book titles and places are written in Turkish spelling.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  ha: row({
    code: 'ha', name: 'Hausa', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-ha.json.gz', key: 'hausa_gummi' }),
    hadith: 'hadith-ha.json.gz',
    labels: Object.freeze({
      translation: 'Fassara', quranBy: 'Fassarar Alƙur’ani', hadithBy: 'Fassarar hadisi',
      quranSrc: '{by} {ref}{full}: {title}, ta {source}, sigar {version}', quranFull: ' (cikakkiyar aya)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (cikakken hadisi)',
      grade: '; daraja bisa tushe: {grade}', notes: '. Bayanan da aka wallafa: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Hausa (sallah, zakka, alwala, fiqhu, hadisi) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Hausa: give the meaning yourself in plain words. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (tsira da amincin Allah su tabbata a gare shi); رضي الله عنه -> (Allah ya yarda da shi); رحمه الله -> (Allah ya yi masa rahama). Scholars’ names, book titles and places are written in Hausa spelling.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  ms: row({
    code: 'ms', name: 'Malay', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    hadith: 'hadith-ms.json.gz',
    labels: Object.freeze({
      translation: 'Terjemahan', quranBy: 'Terjemahan Al-Quran', hadithBy: 'Terjemahan hadis',
      quranSrc: '{by} {ref}{full}: {title}, melalui {source}, v{version}', quranFull: ' (ayat penuh)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (hadis penuh)',
      grade: '; taraf menurut sumber: {grade}', notes: '. Catatan seperti diterbitkan: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Malay (solat, zakat, wuduk, fiqh, hadis) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Malay: give the meaning yourself in plain words. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (sallallahu alaihi wasallam); رضي الله عنه -> (radhiyallahu anhu); رحمه الله -> (rahimahullah). Scholars’ names, book titles and places are written in Malay spelling.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  sw: row({
    code: 'sw', name: 'Swahili', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-sw.json.gz', key: 'swahili_rwwad' }),
    hadith: 'hadith-sw.json.gz',
    labels: Object.freeze({
      translation: 'Tafsiri', quranBy: 'Tafsiri ya Kurani', hadithBy: 'Tafsiri ya hadithi',
      quranSrc: '{by} {ref}{full}: {title}, kupitia {source}, v{version}', quranFull: ' (aya kamili)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (hadithi kamili)',
      grade: '; daraja kulingana na chanzo: {grade}', notes: '. Maelezo kama yalivyochapishwa: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Swahili (swala, zakati, udhu, fiqhi, hadithi) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Swahili: give the meaning yourself in plain words. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (swallallahu alayhi wasallam); رضي الله عنه -> (radhiyallahu anhu); رحمه الله -> (rahimahullah). Scholars’ names, book titles and places are written in Swahili spelling.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
});

export const LANG_CODES = Object.freeze(Object.keys(LANG_TABLE));
export const DEFAULT_KEY_LANG = 'ar';
export function langRow(code) { return LANG_TABLE[code] || null; }
export function isKnownLang(code) { return typeof code === 'string' && Object.prototype.hasOwnProperty.call(LANG_TABLE, code); }
/** The interface-language key a client sent, or the default: anything not in the table is Arabic. */
export function keyLangOf(value) { return isKnownLang(value) ? value : DEFAULT_KEY_LANG; }
