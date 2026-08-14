// Deterministic answers for religious material the application already owns.
//
// These turns must not spend a Brave unit, call the fatwa service, or enter the
// 3,070-record fiqh corpus.  The browser expands the returned tags from its
// frozen Quran, adhkar and worship data, so no model is allowed to reproduce or
// improvise those texts.

import { normalizeArabic } from './route-classify.js';

export const CLOSED_DEEN_ZERO_METRICS = Object.freeze({
  storedCorpusCalls: 0,
  fatwaSearchCalls: 0,
  braveSearchCalls: 0,
  livePageFetchCalls: 0,
  publicSourceSearchCalls: 0,
  publicSourceFetchCalls: 0,
  externalSourceAdapterCalls: 0,
  modelCallsForReligiousAnswer: 0,
});

const SURAH_NAMES = Object.freeze([
  '', 'الفاتحه', 'البقره', 'ال عمران', 'النساء', 'المايده', 'الانعام', 'الاعراف', 'الانفال', 'التوبه',
  'يونس', 'هود', 'يوسف', 'الرعد', 'ابراهيم', 'الحجر', 'النحل', 'الاسراء', 'الكهف', 'مريم',
  'طه', 'الانبياء', 'الحج', 'المومنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت',
  'الروم', 'لقمان', 'السجده', 'الاحزاب', 'سبا', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر',
  'غافر', 'فصلت', 'الشوري', 'الزخرف', 'الدخان', 'الجاثيه', 'الاحقاف', 'محمد', 'الفتح', 'الحجرات',
  'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعه', 'الحديد', 'المجادله', 'الحشر',
  'الممتحنه', 'الصف', 'الجمعه', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقه',
  'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامه', 'الانسان', 'المرسلات', 'النبا', 'النازعات',
  'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الاعلي', 'الغاشيه', 'الفجر',
  'البلد', 'الشمس', 'الليل', 'الضحي', 'الشرح', 'التين', 'العلق', 'القدر', 'البينه', 'الزلزله',
  'العاديات', 'القارعه', 'التكاثر', 'العصر', 'الهمزه', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون',
  'النصر', 'المسد', 'الاخلاص', 'الفلق', 'الناس',
]);

const SURAH_ALIASES = Object.freeze(new Map([
  ['براءه', 9], ['بني اسراييل', 17], ['المومن', 40], ['حم السجده', 41],
  ['الانشراح', 94], ['تبارك', 67], ['عم', 78],
]));

const HADITH_INTENTIONS_EVIDENCE = Object.freeze({
  id: 'local:hadith:intentions',
  kind: 'local_hadith_registry',
  title: 'حديث إنما الأعمال بالنيات',
  publisher: 'صحيح البخاري وصحيح مسلم',
  url: '',
  passage: [
    'عن عمر بن الخطاب رضي الله عنه: إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى.',
    'حديث صحيح متفق عليه؛ أخرجه البخاري (1) ومسلم (1907).',
  ].join(' '),
});

function normalized(value) {
  return normalizeArabic(String(value == null ? '' : value));
}

function westernDigits(value) {
  return String(value || '').replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function closed(text, sourceIds = [], finalizerSources = []) {
  return {
    outcome: 'LOCAL_CLOSED',
    text,
    cards: [],
    usedEvidence: [],
    acceptedEvidence: [],
    evidencePackIds: sourceIds,
    validatedUsedEvidenceIds: sourceIds,
    sourceIds,
    finalizerSources,
    degraded: [],
    ...CLOSED_DEEN_ZERO_METRICS,
  };
}

function namedSurah(question) {
  const aliases = [...SURAH_ALIASES.entries()];
  const names = SURAH_NAMES.map((name, number) => [name, number]).filter(([name]) => name);
  for (const [name, number] of [...aliases, ...names].sort((a, b) => b[0].length - a[0].length)) {
    if (question.includes(`سوره ${name}`) || question.includes(`سورة ${name}`)) return number;
  }
  const numeric = westernDigits(question).match(/سور[هة]\s+(?:رقم\s+)?([0-9]{1,3})/u);
  if (!numeric) return 0;
  const number = Number(numeric[1]);
  return number >= 1 && number <= 114 ? number : 0;
}

function quranAnswer(question) {
  const q = normalized(question);
  if (/ايه\s+الكرسي/u.test(q)) {
    return closed('تفضّل، هذه آية الكرسي من المصحف المحلي المعتمد:\n<verse surah_num="2" ayah="255"></verse>', ['local:quran:2:255']);
  }
  if (/(?:اخر|خواتيم)\s+(?:ايتين\s+من\s+)?سوره\s+البقره/u.test(q)) {
    return closed('تفضّل، هاتان خاتمتا سورة البقرة من المصحف المحلي المعتمد:\n<surah num="2" from="285" to="286"></surah>', ['local:quran:2:285-286']);
  }
  const surah = namedSurah(q);
  if (!surah) return null;
  const ayahMatch = westernDigits(q).match(/(?:ايه|الايه)\s+(?:رقم\s+)?([0-9]{1,3})/u);
  if (ayahMatch) {
    const ayah = Number(ayahMatch[1]);
    if (ayah >= 1 && ayah <= 300) {
      return closed(`تفضّل، هذه الآية من المصحف المحلي المعتمد:\n<verse surah_num="${surah}" ayah="${ayah}"></verse>`, [`local:quran:${surah}:${ayah}`]);
    }
  }
  return closed(`تفضّل، هذه السورة من المصحف المحلي المعتمد:\n<surah num="${surah}"></surah>`, [`local:quran:surah:${surah}`]);
}

function adhkarAnswer(question) {
  const q = normalized(question);
  if (q.includes('الصباح') || q.includes('المساء')) {
    const label = q.includes('المساء') ? 'المساء' : 'الصباح';
    return closed(`هذه أذكار ${label} من مجموعة حصن المسلم المحلية:\n<dhikr id="27"></dhikr>`, ['local:adhkar:27']);
  }
  if (q.includes('الاستيقاظ')) {
    return closed('هذه أذكار الاستيقاظ من مجموعة حصن المسلم المحلية:\n<dhikr id="1"></dhikr>', ['local:adhkar:1']);
  }
  if (q.includes('النوم')) {
    return closed('هذه أذكار النوم من مجموعة حصن المسلم المحلية:\n<dhikr id="28"></dhikr>', ['local:adhkar:28']);
  }
  return null;
}

function worshipAnswer(question) {
  const q = normalized(question);
  if (/(?:تيمم|التيمم|اتيمم)/u.test(q)) return closed('<worship id="tayammum"></worship>', ['local:worship:tayammum']);
  if (/(?:غسل|الغسل|جنابه|اغتسل|الاغتسال)/u.test(q)) return closed('<worship id="ghusl"></worship>', ['local:worship:ghusl']);
  if (/(?:وضوء|الوضوء|اتوضا|وضويي)/u.test(q)) return closed('<worship id="wudu"></worship>', ['local:worship:wudu']);
  if (/(?:صلاه|الصلاه|اصلي|يصلي|نصلي|صلاتي)/u.test(q)) return closed('<worship id="salah"></worship>', ['local:worship:salah']);
  return null;
}

function hadithAnswer(question) {
  const q = normalized(question);
  // This registry answers the direct, self-contained grading request only.  A
  // longer sacred quotation, an attribution comparison, or a request for a
  // named scholar's position must continue to the attributed retrieval gates.
  if (!/^(?:(?:ما\s+صحه|ما\s+درجه|هل\s+يصح|تخريج)\s+)?(?:هذا\s+)?حديث\s+انما\s+الاعمال\s+بالنيات$/u.test(q)) return null;
  const text = [
    'الحديث صحيح متفق عليه.',
    '<hadith narrator="عمر بن الخطاب رضي الله عنه" ruling="أخرجه البخاري (1) ومسلم (1907)">إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى</hadith>',
  ].join('\n');
  return closed(text, [HADITH_INTENTIONS_EVIDENCE.id], [HADITH_INTENTIONS_EVIDENCE]);
}

/**
 * Return a complete server-owned answer for a closed local runtime, or null when
 * the HADITH runtime needs the existing attributed retrieval path.
 */
export function runClosedDeenTurn(context = {}) {
  const runtime = String(context.runtime || '');
  const question = context.currentQuestion || '';
  if (context.resolvedScholar) return null;
  if (runtime === 'LOCAL_QURAN') return quranAnswer(question);
  if (runtime === 'LOCAL_ADHKAR') return adhkarAnswer(question);
  if (runtime === 'LOCAL_WORSHIP') return worshipAnswer(question);
  if (runtime === 'HADITH') return hadithAnswer(question);
  return null;
}

export const __closedDeenTest = Object.freeze({
  adhkarAnswer, hadithAnswer, namedSurah, quranAnswer, worshipAnswer,
});
