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
  ru: row({
    code: 'ru', name: 'Russian', dir: 'ltr', script: 'cyrl', digits: 'latn', answerTranslation: true,
    hadith: 'hadith-ru.json.gz', terms: 'terms-ru.json.gz',
    labels: Object.freeze({
      translation: 'Перевод', quranBy: 'Перевод Корана', hadithBy: 'Перевод хадиса',
      quranSrc: '{by} {ref}{full}: {title}, через {source}, v{version}', quranFull: ' (аят полностью)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (хадис полностью)',
      grade: '; степень по источнику: {grade}', notes: '. Примечания, как опубликовано: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Cyrillic letters the way Russian-speaking Muslims write it (намаз, закят, вуду, фикх, хадис) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Russian for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (мир ему и благословение Аллаха); رضي الله عنه -> (да будет доволен им Аллах); رحمه الله -> (да смилуется над ним Аллах). Scholars’ names, book titles and places are written in Cyrillic letters.',
      numbers: 'Write numbers with Latin digits (0123456789).',
    }),
  }),
  zh: row({
    code: 'zh', name: 'Chinese', dir: 'ltr', script: 'hans', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-zh.json.gz', key: 'chinese_suliman' }),
    hadith: 'hadith-zh.json.gz', terms: 'terms-zh.json.gz',
    labels: Object.freeze({
      translation: '译文', quranBy: '古兰经译文', hadithBy: '圣训译文',
      quranSrc: '{by} {ref}{full}:{title},经由 {source},v{version}', quranFull: '(整节经文)',
      hadithSrc: '{by}{full}:{source}{grade}', hadithFull: '(整段圣训)',
      grade: ';据来源的级别:{grade}', notes: '。已发布的说明:{notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Simplified Chinese the way Chinese-speaking Muslims write it (礼拜, 天课, 小净, 教法, 圣训) and, the first time it appears, give its meaning in parentheses when it is not obvious. When a GLOSSARY is supplied, use its Chinese for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (愿真主赐他平安); رضي الله عنه -> (愿真主喜悦他); رحمه الله -> (愿真主怜悯他). Scholars’ names, book titles and places are written in Simplified Chinese characters (a transliteration the way Chinese-language Islamic books write them, e.g. 伊本·巴兹).',
      numbers: 'Write numbers with Latin digits (0123456789).',
    }),
  }),
  es: row({
    code: 'es', name: 'Spanish', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-es.json.gz', key: 'spanish_garcia' }),
    hadith: 'hadith-es.json.gz', terms: 'terms-es.json.gz',
    labels: Object.freeze({
      translation: 'Traducción', quranBy: 'Traducción del Corán', hadithBy: 'Traducción del hadiz',
      quranSrc: '{by} {ref}{full}: {title}, a través de {source}, v{version}', quranFull: ' (aleya completa)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (hadiz completo)',
      grade: '; grado según la fuente: {grade}', notes: '. Notas tal como se publicaron: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Spanish (oración, zakat, wudu, fiqh, hadiz) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Spanish for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (la paz y las bendiciones de Alá sean con él); رضي الله عنه -> (que Alá esté complacido con él); رحمه الله -> (que Alá tenga misericordia de él). Scholars’ names, book titles and places are written in their usual Spanish spelling or transliterated.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  pt: row({
    code: 'pt', name: 'Portuguese', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-pt.json.gz', key: 'portuguese_nasr' }),
    hadith: 'hadith-pt.json.gz', terms: 'terms-pt.json.gz',
    labels: Object.freeze({
      translation: 'Tradução', quranBy: 'Tradução do Alcorão', hadithBy: 'Tradução do hadith',
      quranSrc: '{by} {ref}{full}: {title}, via {source}, v{version}', quranFull: ' (versículo completo)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (hadith completo)',
      grade: '; grau segundo a fonte: {grade}', notes: '. Notas conforme publicadas: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Brazilian Portuguese (oração, zakat, wudu, fiqh, hadith) and, the first time it appears, give its meaning in parentheses. When a GLOSSARY is supplied, use its Portuguese for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (que a paz e as bênçãos de Alá estejam com ele); رضي الله عنه -> (que Alá esteja satisfeito com ele); رحمه الله -> (que Alá tenha misericórdia dele). Scholars’ names, book titles and places are written in their usual Portuguese spelling or transliterated.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  de: row({
    code: 'de', name: 'German', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-de.json.gz', key: 'german_rwwad' }),
    hadith: 'hadith-de.json.gz',
    labels: Object.freeze({
      translation: 'Übersetzung', quranBy: 'Koran-Übersetzung', hadithBy: 'Hadith-Übersetzung',
      quranSrc: '{by} {ref}{full}: {title}, über {source}, v{version}', quranFull: ' (ganzer Vers)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (ganzer Hadith)',
      grade: '; Grad laut Quelle: {grade}', notes: '. Anmerkungen wie veröffentlicht: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in German (Gebet/Salat, Zakat, Wudu, Fiqh, Hadith) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for German: give the meaning yourself in plain words. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (Friede und Segen Allahs seien auf ihm); رضي الله عنه -> (möge Allah mit ihm zufrieden sein); رحمه الله -> (möge Allah ihm barmherzig sein). Scholars’ names, book titles and places are written in their usual German spelling or transliterated.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  hi: row({
    code: 'hi', name: 'Hindi', dir: 'ltr', script: 'deva', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-hi.json.gz', key: 'hindi_omari' }),
    hadith: 'hadith-hi.json.gz', terms: 'terms-hi.json.gz',
    labels: Object.freeze({
      translation: 'अनुवाद', quranBy: 'क़ुरआन का अनुवाद', hadithBy: 'हदीस का अनुवाद',
      quranSrc: '{by} {ref}{full}: {title}, {source} के माध्यम से, v{version}', quranFull: ' (पूरी आयत)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (पूरी हदीस)',
      grade: '; स्रोत के अनुसार दर्जा: {grade}', notes: '। प्रकाशित टिप्पणियाँ: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Devanagari the way Hindi-speaking Muslims write it (नमाज़, ज़कात, वुज़ू, फ़िक़्ह, हदीस) and, the first time it appears, give its meaning in parentheses when it is not obvious. When a GLOSSARY is supplied, use its Hindi for the meaning. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (सल्लल्लाहु अलैहि व सल्लम); رضي الله عنه -> (रज़ियल्लाहु अन्हु); رحمه الله -> (रहमतुल्लाह अलैह). Scholars’ names, book titles and places are written in Devanagari.',
      numbers: 'Write numbers with Latin digits (0123456789).',
    }),
  }),
  so: row({
    code: 'so', name: 'Somali', dir: 'ltr', script: 'latn', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-so.json.gz', key: 'somali_yacob' }),
    hadith: 'hadith-so.json.gz',
    labels: Object.freeze({
      translation: 'Tarjumaad', quranBy: 'Tarjumaadda Quraanka', hadithBy: 'Tarjumaadda xadiiska',
      quranSrc: '{by} {ref}{full}: {title}, iyada oo loo marayo {source}, v{version}', quranFull: ' (aayadda oo dhan)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (xadiiska oo dhan)',
      grade: '; darajada sida ilaha ku sheegay: {grade}', notes: '. Tix-raacyo sida la daabacay: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Latin letters the way it is usually written in Somali (salaad, sakaad, aburaha/udhuu, fiqhi, xadiis) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Somali: give the meaning yourself in plain words. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (nabadgelyo iyo naxariis Eebe korkiisa ha ahaato); رضي الله عنه -> (Eebe ha ka raalli noqdo); رحمه الله -> (Eebe ha u naxariisto). Scholars’ names, book titles and places are written in Somali spelling.',
      numbers: 'Write numbers with Latin digits.',
    }),
  }),
  ps: row({
    code: 'ps', name: 'Pashto', dir: 'rtl', script: 'arab', digits: 'arab-ext', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-ps.json.gz', key: 'pashto_rwwad' }),
    hadith: 'hadith-ps.json.gz',
    labels: Object.freeze({
      translation: 'ژباړه', quranBy: 'د قرآن ژباړه', hadithBy: 'د حدیث ژباړه',
      quranSrc: '{by} {ref}{full}: {title}، د {source} له لارې، v{version}', quranFull: ' (بشپړ آیت)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (بشپړ حدیث)',
      grade: '؛ د سرچینې له مخې درجه: {grade}', notes: '. خپرې شوې یادونې: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Pashto letters the way it is usually written in Pashto (لمونځ, زکات, اودس, فقه, حدیث) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Pashto: give the meaning yourself in plain words. Use the Pashto letters ې ۍ ټ ډ ړ ږ ښ ګ ڼ ځ څ where Pashto writes them, never the Arabic or Persian look-alikes. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (صلی الله علیه وسلم); رضي الله عنه -> (رضي الله عنه); رحمه الله -> (رحمه الله). Scholars’ names, book titles and places are written in Pashto spelling.',
      numbers: 'Write numbers with the Persian-Pashto digits (۰۱۲۳۴۵۶۷۸۹).',
    }),
  }),
  ku: row({
    code: 'ku', name: 'Kurdish (Sorani)', dir: 'rtl', script: 'arab', digits: 'arab-indic', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-ku.json.gz', key: 'kurdish_bamoki' }),
    hadith: 'hadith-ku.json.gz',
    labels: Object.freeze({
      translation: 'وەرگێڕان', quranBy: 'وەرگێڕانی قورئان', hadithBy: 'وەرگێڕانی حەدیس',
      quranSrc: '{by} {ref}{full}: {title}، لە ڕێگەی {source}ەوە، v{version}', quranFull: ' (ئایەتی تەواو)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (حەدیسی تەواو)',
      grade: '؛ پلە بەپێی سەرچاوە: {grade}', notes: '. تێبینییە بڵاوکراوەکان: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Sorani Kurdish letters the way it is usually written in Sorani (نوێژ, زەکات, دەستنوێژ, فیقه, حەدیس) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Kurdish: give the meaning yourself in plain words. Use the Kurdish letters ی ک ە ێ ۆ ڕ ڵ ڤ where Kurdish writes them, never the Arabic look-alikes (ي ك ه). Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (درود و سڵاوی خوای لەسەر بێت); رضي الله عنه -> (خوا لێی ڕازی بێت); رحمه الله -> (ڕەحمەتی خوای لێبێت). Scholars’ names, book titles and places are written in Sorani Kurdish spelling.',
      numbers: 'Write numbers with the Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩).',
    }),
  }),
  uz: row({
    code: 'uz', name: 'Uzbek', dir: 'ltr', script: 'cyrl', digits: 'latn', answerTranslation: true,
    quran: Object.freeze({ file: 'quran-uz.json.gz', key: 'uzbek_rwwad' }),
    hadith: 'hadith-uz.json.gz',
    labels: Object.freeze({
      translation: 'Таржима', quranBy: 'Қуръон таржимаси', hadithBy: 'Ҳадис таржимаси',
      quranSrc: '{by} {ref}{full}: {title}, {source} орқали, v{version}', quranFull: ' (оят тўлиқ)',
      hadithSrc: '{by}{full}: {source}{grade}', hadithFull: ' (ҳадис тўлиқ)',
      grade: '; манбага кўра даража: {grade}', notes: '. Эълон қилинган изоҳлар: {notes}',
    }),
    prompt: Object.freeze({
      terms: 'write the Arabic term in Uzbek Cyrillic letters the way it is usually written in Uzbek (намоз, закот, таҳорат, фиқҳ, ҳадис) and, the first time it appears, give its meaning in parentheses. No glossary of published term meanings exists for Uzbek: give the meaning yourself in plain words. Use the Uzbek letters ў қ ғ ҳ where Uzbek writes them. Terms listed under ALREADY_EXPLAINED were explained in an earlier part: write the term only.',
      honorifics: 'ﷺ after the Prophet’s name -> (соллаллоҳу алайҳи ва саллам); رضي الله عنه -> (розияллоҳу анҳу); رحمه الله -> (раҳматуллоҳи алайҳ). Scholars’ names, book titles and places are written in Uzbek Cyrillic spelling.',
      numbers: 'Write numbers with Latin digits (0123456789).',
    }),
  }),
});

export const LANG_CODES = Object.freeze(Object.keys(LANG_TABLE));
export const DEFAULT_KEY_LANG = 'ar';
export function langRow(code) { return LANG_TABLE[code] || null; }
export function isKnownLang(code) { return typeof code === 'string' && Object.prototype.hasOwnProperty.call(LANG_TABLE, code); }
/** The interface-language key a client sent, or the default: anything not in the table is Arabic. */
export function keyLangOf(value) { return isKnownLang(value) ? value : DEFAULT_KEY_LANG; }
