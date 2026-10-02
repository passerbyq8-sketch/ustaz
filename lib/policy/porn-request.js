// lib/policy/porn-request.js
// THE HARD RULE FOR PORNOGRAPHY: A REQUEST FOR THE CONTENT, NEVER A QUESTION ABOUT IT.
// (order EZIK-IMPERMISSIBLE-ORDER-2026-10-01.) Pure, deterministic, no I/O.
//
// WHY A SECOND FUNCTION BESIDE classifyImpermissibleRequest. That one blocks its pornography vocabulary
// with no request shape (its rule (c)). MEASURED at 9cb6f64: it stops «ما حكم مشاهدة الأفلام الإباحية؟»
// and «كيف أتخلّص من إدمان الإباحية؟», and lets «اكتب لي قصة جنسية» through. That is fit for the one path it
// guards (a GEN route a ruling question never reaches) and not for a rule that sits in front of every
// reader's every turn. So the distinction lives HERE, once, on the vocabulary it shares
// (PORNOGRAPHY, exported from there), and the other function is left exactly as it was: the songs and
// the films, and the minors' path, behave as they did.
//
// A CONJUNCTION OF THREE, AND DOUBT IS NOT A BLOCK:
//   (1) something is being ASKED FOR (give, send, write, describe, show, link, «ابغى»...);
//   (2) the thing is SEXUAL CONTENT (a pornography word; adult-only clips; a story/scene/clip that is
//       sexual by the adjective right after it);
//   (3) and nothing says the reader is asking ABOUT it (its ruling, its harm, quitting it, protecting a
//       child from it, an essay or a sermon on it). Any such word wins: the turn goes on to its own
//       path, whose model carries the red lines. Turning away a man who asks for help to quit is the
//       worse error.
// It decides nothing else: no kind, no music, no film.

import { fold } from './entities.js';
import { PORNOGRAPHY, classifyImpermissibleRequest } from './impermissible-request.js';

/** The fixed text. No model writes it; it is the same for every reader of every age. */
export const PORN_REFUSAL_TEXT =
  'هذا ممّا لا أُعينُ عليه، فقد أمرَنا اللهُ بغضِّ البصر. '
  + 'وإن كانَ في نفسِك سؤالٌ تريدُ فهمَه، أو أمرٌ تريدُ عونًا على تركِه، فاسألْني وأنا معك.';

const PROCLITICS = ['', 'و', 'ف', 'ب', 'ل', 'ال', 'وال', 'فال', 'بال', 'لل', 'ولل', 'وب', 'فب'];

const PORN_TERMS = [...PORNOGRAPHY, 'بورنو', 'porno', 'pornography', 'pornographic', 'sex', 'erotic', 'erotica', 'nude', 'nudes', 'اباحيين', 'اباحيون', 'سكسي', 'سكسيه', 'سكسيات', 'سكسيين', 'عاري', 'عاريه', 'عاريات', 'عراه'];

// (1) what is asked for. Whole tokens, proclitics allowed. «ابي» is also «my father», so it counts only
// when what follows is a thing or a first-person verb (below); «ابغى/اريد/ودي» are unambiguous.
const ASK_WORDS = [
  'ارسل', 'ارسلي', 'انقل', 'انقلي', 'انسخ', 'اقتبس', 'اكتب', 'صف', 'اعطني', 'عطني', 'اعطيني', 'هات', 'جيب', 'دلني', 'دليني', 'ارني', 'وريني', 'اعرض',
  'احك', 'احكي', 'اروي', 'قص', 'ولد', 'انشئ', 'ابحث', 'دور', 'رشح', 'اقترح', 'نزل', 'حمل', 'شغل', 'ابغي', 'ابغا',
  'اريد', 'ودي', 'بغيت', 'احتاج', 'رابط', 'روابط', 'لينك', 'لينكات', 'ترسل', 'تكتب', 'تعطيني', 'تدلني',
  // Gulf and Kuwaiti request verbs (order EZIK-COMPREHENSIVE-ORDER-2026-10-02 3.1a), measured at bea348b: «دزّ لي
  // مقاطع سكس» reached the model. Each is a verb of giving or sending with its imperative, suffixed and «تقدر/ممكن» forms.
  'دز', 'دزي', 'دزوا', 'دزلي', 'دزلنا', 'تدز', 'طرش', 'طرشي', 'طرشوا', 'طرشلي', 'تطرش', 'جيبلي', 'جيبوا', 'جيبي', 'تجيب',
  'عطوني', 'عطيني', 'عطنا', 'عطونا', 'اعطوني', 'اعطنا', 'هاتلي', 'هاتوا', 'هاتي', 'ابعث', 'ابعثي', 'ابعثوا', 'ابعثلي', 'تبعث',
  'ورني', 'وريني', 'ورونا', 'شاركني', 'تعطني', 'ارسلوا', 'ارسلني',
  // «ودّيني» / «ودّني» (take me to), order EZIK-FIX-48 item 1(a): the router reads «وديني» as «ديني» (my religion), so the
  // sentence never reached the old classifier either. The fold drops the shadda, so one spelling covers both.
  'وديني', 'ودني',
  'send', 'give', 'show', 'write', 'describe', 'find', 'get', 'link', 'links', 'generate', 'recommend',
];
const ASK_PHRASES = [
  'وين الاقي', 'وين اشوف', 'وين اشاهد', 'وين احمل', 'كيف احصل علي', 'كيف اشاهد', 'كيف انزل', 'كيف احمل', 'كيف اوصل الي',
  'من وين اجيب', 'سوي لي', 'جهز لي', 'حط لي', 'مرر لي', 'رسل لي', 'بعث لي', 'خلني اشوف', 'خلني اشاهد', 'where can i', 'how do i watch', 'how do i find', 'how can i watch', 'i want', 'i need', 'i wanna',
];
const WANT_AMBIGUOUS = ['ابي', 'ابا'];
const THINGS = [
  'مقاطع', 'مقطع', 'افلام', 'فيلم', 'فيديو', 'فيديوهات', 'صور', 'صوره', 'مواقع', 'موقع', 'محتوي', 'قنوات', 'قناه',
  'مجلات', 'روايات', 'قصص', 'قصه', 'مشهد', 'مشاهد', 'روايه', 'حكايه', 'clips', 'clip', 'videos', 'video', 'movies',
  'pics', 'pictures', 'photos', 'sites', 'site', 'stories', 'story', 'scene', 'scenes', 'content', 'websites',
];
const FIRST_PERSON_VERBS = ['اشوف', 'اشاهد', 'احمل', 'انزل', 'اقرا', 'اسمع', 'اطلع', 'اتفرج', 'اكتب'];

// (2b) adult-only clips, with no pornography word in the sentence
const ADULT_MARKS = ['للكبار', 'للبالغين', 'adult', 'adults'];
const ADULT_MARK_DIGITS = /(?:^|[^\d٠-٩])(?:18|21|١٨|٢١)\s*\+|\+\s*(?:18|21|١٨|٢١)(?![\d٠-٩])/u;
// (2c) sexual by the adjective that follows the noun directly: «قصة جنسية», «مشهدًا جنسيًّا». «جنسية» alone
// is «nationality», so the adjective counts only right after one of these nouns.
const SEXUAL_ADJ = ['جنسي', 'جنسيه', 'جنسيا', 'جنسيين', 'حميم', 'حميمه', 'حميما', 'sexual', 'explicit', 'erotic'];
const SEXUAL_NOUNS = [
  'قصه', 'قصص', 'روايه', 'روايات', 'حكايه', 'مشهد', 'مشاهد', 'صور', 'صوره', 'فيديو', 'فيديوهات', 'مقاطع', 'مقطع', 'محتوي', 'حوار',
  'story', 'stories', 'scene', 'scenes', 'content', 'video', 'videos', 'pictures', 'photos', 'images', 'roleplay',
];

// (3) the reader is asking ABOUT it
const ABOUT_WORDS = [
  'حكم', 'يجوز', 'جايز', 'يحل', 'حلال', 'حرام', 'يحرم', 'تحريم', 'اثم', 'ذنب', 'ضرر', 'اضرار', 'مضار', 'مضره', 'اثار', 'تاثير',
  'تاثيرات', 'خطر', 'مخاطر', 'سلبيات', 'ادمان', 'مدمن', 'مدمنه', 'اقلاع', 'اقلع', 'اتخلص', 'تخلص', 'التخلص', 'اترك', 'ترك',
  'اتوقف', 'التوقف', 'توقف', 'اقاوم', 'مقاومه', 'اتغلب', 'التغلب', 'اخرج', 'اتعافي', 'تعافي', 'علاج', 'اعالج', 'معالجه', 'وقايه',
  'اتجنب', 'تجنب', 'ابتعد', 'الابتعاد', 'اهجر', 'احمي', 'حمايه', 'احجب', 'حجب', 'امنع', 'منع', 'فلتر', 'توبه', 'اتوب', 'تاب',
  'نصيحه', 'نصيحت', 'انصح', 'تربيه', 'توعيه', 'تثقيف', 'اثقف', 'اوعي', 'اتعامل', 'التعامل', 'تعامل', 'لماذا', 'ليش', 'رايك',
  'اسباب', 'تعريف', 'معني',
  'ruling', 'halal', 'haram', 'permissible', 'harm', 'harms', 'effects', 'addiction', 'addicted', 'quit', 'overcome', 'recover',
  'recovery', 'treatment', 'avoid', 'prevent', 'protect', 'block', 'filter', 'parental', 'why',
];
const ABOUT_PHRASES = [
  'ما هو', 'ما هي', 'ما الفرق', 'كيف اشرح', 'كيف احدث', 'كيف اعلم', 'كيف اكلم', 'كيف اوعي', 'كيف اثقف',
  'how to stop', 'how to quit', 'how to talk', 'my son', 'my daughter', 'what is', 'what are',
];
// an essay, a lecture, a sermon ABOUT it: only together with «عن/حول/بخصوص»
const WRITING_ABOUT = ['مقال', 'مقاله', 'بحث', 'خطبه', 'كلمه', 'موضوع', 'تقرير', 'دراسه', 'محاضره', 'ورقه', 'تعبير', 'منشور', 'article', 'essay', 'report', 'speech', 'sermon', 'paper'];
const ABOUT_PREPOSITIONS = ['عن', 'حول', 'بخصوص', 'about'];

const wordsOf = (t) => t.split(/[^\p{L}]+/u).filter(Boolean);
// an accusative tanween leaves a trailing alif after folding («مشهدًا» -> «مشهدا»): the noun with it counts
const matches = (tok, w) => PROCLITICS.some((p) => tok === p + w || tok === p + w + 'ا');
// the "about" stems of four letters or more may carry a pronoun suffix («أضرارها», «نصيحته»)
const SUFFIXES = ['ه', 'ها', 'هم', 'ك', 'ي', 'نا', 'كم'];
const matchesAbout = (tok, w) => matches(tok, w) || (w.length >= 4 && SUFFIXES.some((s) => PROCLITICS.some((p) => tok === p + w + s)));
const indicesOf = (toks, list, test = matches) => {
  const words = list.map((w) => fold(w).toLowerCase());
  const out = [];
  toks.forEach((tok, i) => { if (words.some((w) => test(tok, w))) out.push(i); });
  return out;
};
const hasPhrase = (padded, list) => list.some((p) => padded.includes(' ' + fold(p).toLowerCase() + ' '));

/**
 * IS THIS A REQUEST FOR SEXUAL CONTENT -- AND NOT A QUESTION ABOUT IT?
 * @param {string} raw the reader's own words
 * @returns {{blocked:boolean}} nothing of the text is returned: no kind, no matched word.
 */
export function classifyPornographyRequest(raw) {
  const t = fold(raw || '').toLowerCase();
  if (!t) return { blocked: false };
  const toks = wordsOf(t);
  const padded = ' ' + toks.join(' ') + ' ';

  // (2) the thing
  const porn = indicesOf(toks, PORN_TERMS);
  const adjs = indicesOf(toks, SEXUAL_ADJ);
  const sexualPair = indicesOf(toks, SEXUAL_NOUNS).some((i) => adjs.includes(i + 1));
  const things = indicesOf(toks, THINGS);
  const marks = indicesOf(toks, ADULT_MARKS);
  const digits = ADULT_MARK_DIGITS.test(t);
  const adultClip = things.length > 0 && (digits || marks.some((m) => things.some((i) => Math.abs(i - m) <= 3)));
  if (!(porn.length || sexualPair || adultClip)) return { blocked: false };

  // (3) about it: any one of these and the turn goes on to its own path
  if (indicesOf(toks, ABOUT_WORDS, matchesAbout).length || hasPhrase(padded, ABOUT_PHRASES)) return { blocked: false };
  if (indicesOf(toks, WRITING_ABOUT).length && indicesOf(toks, ABOUT_PREPOSITIONS).length) return { blocked: false };

  // (1) asked for
  if (indicesOf(toks, ASK_WORDS).length || hasPhrase(padded, ASK_PHRASES)) return { blocked: true };
  const next = indicesOf(toks, [...THINGS, ...FIRST_PERSON_VERBS]);
  if (indicesOf(toks, WANT_AMBIGUOUS).some((i) => next.includes(i + 1))) return { blocked: true };
  return { blocked: false };
}

// -- THE YOUNG AND THE TEEN: A DOUBT IS A BLOCK, WHEN NOTHING ASKS AND NOTHING SEEKS HELP ------------------
//
// (order EZIK-FIX-48 item 1(b).) For a reader under eighteen, a sentence the rule above did not catch -- because
// it names a request verb the list does not hold -- is still turned away with the fixed text when ALL FOUR hold,
// and the four are closed lists written here, not sentences:
//   (a) a pornography word of the old classifier's own vocabulary (its `pornography` kind);
//   (b) it is not an explicit question: no «؟» at the end, no interrogative word first;
//   (c) it names a thing (a site, a clip, a picture, a story, a link, a channel, an account);
//   (d) and carries no word of repentance, treatment, quitting, asking for help, a ruling or writing about it.
// Which reader this is decided by is NOT decided here: the function takes the sentence alone; the one caller chooses.
const QUESTION_OPENERS = ['ما', 'ماذا', 'هل', 'كيف', 'لماذا', 'ليش', 'متى', 'اين', 'من', 'كم', 'وش', 'شو'];
const THING_NOUNS = [
  'موقع', 'مواقع', 'فيديو', 'فيديوهات', 'صوره', 'صور', 'مقطع', 'مقاطع', 'فلم', 'فيلم', 'افلام', 'رابط', 'روابط',
  'قصه', 'قصص', 'قناه', 'حساب',
];
const HELP_OR_ABOUT = [
  'توبه', 'اتوب', 'تبت', 'علاج', 'اتعالج', 'ادمان', 'اقلاع', 'اقلع', 'اترك', 'ترك', 'ابطل', 'اتخلص', 'مساعده', 'ساعدني',
  'ساعدوني', 'تساعدني', 'نصيحه', 'نصيحته', 'انصحني', 'حكم', 'حرام', 'مقال', 'خطبه', 'بحث', 'اضرار', 'خطر', 'حمايه', 'احمي', 'احجب',
];

/**
 * @param {string} raw the reader's own words
 * @returns {boolean} true when the four conditions above all hold (a block for a young or teen reader).
 */
export function classifyYoungPornographyDoubt(raw) {
  const text = String(raw || '').trim();
  if (!text) return false;
  if (classifyImpermissibleRequest(text).kind !== 'pornography') return false;
  const t = fold(text).toLowerCase();
  const toks = wordsOf(t);
  if (/[?؟]\s*$/u.test(text) || QUESTION_OPENERS.some((w) => toks[0] === fold(w))) return false;
  if (!indicesOf(toks, THING_NOUNS).length) return false;
  if (indicesOf(toks, HELP_OR_ABOUT, matchesAbout).length) return false;
  return true;
}

// -- IMPERMISSIBLE_EARLY_V1 -----------------------------------------------------------------------
//
// ON in code, like FRONT_SORTER_V1 and the other switches of lib/free-brain/flag.js: only the words that
// plainly mean off take it down, and with it down the handler behaves as it did at 9cb6f64, byte for byte
// (no check, no stand-down, the field says `none`).
//
//   IMPERMISSIBLE_EARLY_V1=off|false|0   today's behaviour
//   anything else, including unset       on
export function impermissibleEarlyDecision(env = process.env) {
  const raw = String((env && env.IMPERMISSIBLE_EARLY_V1) ?? '').trim().toLowerCase();
  return { enabled: !(raw === 'off' || raw === 'false' || raw === '0') };
}
export const IMPERMISSIBLE_EARLY_DEFAULT = true;

/** The closed vocabulary of the one telemetry field. */
export const IMPERMISSIBLE_STATES = Object.freeze(['none', 'porn_blocked']);
