// lib/bw2-scope.js -- SPEED ITEM 17, FIX 1 (R1, R2): QUESTIONS THE BEFORE-WRITING PATH DOES NOT TAKE.
//
// MEASURED on the preview of side/speed-20260927 (8ff21fa), questions 16 and 9: both reached the
// before-writing path as STORED_FIQH (classifyReligiousRuntime, lib/stored-deen.js:361-394), and both
// lost what production answers.
//
//   R1  An adhkar question. ADHKAR_REQUEST (lib/stored-deen.js:56) is a whole-sentence grammar for the
//       four time-of-day collections only, so «the adhkar after the obligatory prayer» fell through to
//       STORED_FIQH. Today's free-brain path answers it from the bundled canonical stores (the <dhikr>,
//       <verse>/<surah> and <worship> cards the client expands from frozen data); no before-writing
//       source carries those texts, so BW2 ended it in the not-covered sentence.
//   R2  An estate division. Dividing an estate is computation over fixed shares, not attribution to a
//       source; today's path computes it. Today's code has NO estate-division recogniser: the only
//       inheritance words it knows are the topic entries «ميراث»/«ورث» of the DEEN vocabulary
//       (lib/route-classify.js:150, lib/source-purpose.js:96), which make such a question STORED_FIQH
//       and nothing more. So the rule below is new, deterministic and stated here.
//
// THE RULES (all on normalizeArabic's folded tokens; a token is also tried without one leading
// conjunction و/ف, one preposition ب/ل/ك and the article ال, and «لل» is read as «ال»):
//
//   canonical_store -- any of:
//     (a) a dhikr noun: اذكار، ادعيه، دعاء، اوراد، or the phrase «حصن المسلم»;
//     (b) a request for Quran TEXT: a request verb (اكتب، اقرا، اتل، اعطني، هات، اذكر، انقل، اسرد)
//         or the noun «نص» together with ايه/ايات/سوره, or the phrase «ايه الكرسي», or «خواتيم»
//         with «سوره» -- and none of تفسير، معني، اعراب، نزول، شرح، فسر (an exegesis question stays);
//     (c) a request for the MANNER of an act of worship: كيفيه/صفه/طريقه/خطوات immediately followed by
//         صلاه/وضوء/غسل/تيمم, or «كيف» immediately followed by a first/second/third-person verb of
//         praying, ablution, bathing or tayammum.
//   estate_division -- a death or estate word (توفي، توفيت، مات، ماتت، هلك، هلكت، ميت، متوفي، تركه،
//     ميراث، مواريث، ارث، ورثه، فرائض) AND either a division ask (تقسم، يقسم، نقسم، قسمه، تقسيم،
//     نصيب، انصبه، حصه، يرث، ترث، يرثه، يرثها، ورث) or at least two distinct heir words
//     (زوج، زوجه، ام، اب، ابن، بنت، اخ، اخت، جد، جده and their duals and plurals).
//
// PURE: no network, no environment, no clock. api/ask.js calls it once per request that reaches the
// free-brain seat; the result is a closed enum and is never logged with the question.

import { normalizeArabic } from './route-classify.js';

const set = (words) => new Set(words.map((w) => normalizeArabic(w)));

const DHIKR_NOUNS = set(['اذكار', 'ادعيه', 'دعاء', 'اوراد']);
const HISN = normalizeArabic('حصن المسلم');
const QURAN_VERBS = set(['اكتب', 'اقرا', 'اتل', 'اعطني', 'هات', 'اذكر', 'انقل', 'اسرد', 'نص']);
const QURAN_NOUNS = set(['ايه', 'ايات', 'سوره']);
const EXEGESIS = set(['تفسير', 'معني', 'اعراب', 'نزول', 'شرح', 'فسر']);
const KURSI = normalizeArabic('ايه الكرسي');
const KHAWATIM = normalizeArabic('خواتيم');
const SURAH = normalizeArabic('سوره');
const MANNER_NOUNS = set(['كيفيه', 'صفه', 'طريقه', 'خطوات']);
const WORSHIP_ACTS = set(['صلاه', 'وضوء', 'غسل', 'تيمم']);
const HOW = normalizeArabic('كيف');
const WORSHIP_VERBS = set([
  'اصلي', 'نصلي', 'يصلي', 'تصلي',
  'اتوضا', 'نتوضا', 'يتوضا', 'تتوضا',
  'اغتسل', 'نغتسل', 'يغتسل', 'تغتسل',
  'اتيمم', 'نتيمم', 'يتيمم', 'تتيمم',
]);

const ESTATE_FRAME = set([
  'توفي', 'توفيت', 'مات', 'ماتت',
  'هلك', 'هلكت', 'ميت', 'متوفي',
  'تركه', 'ميراث', 'مواريث', 'ارث',
  'ورثه', 'فرائض',
]);
const DIVISION_ASK = set([
  'تقسم', 'يقسم', 'نقسم', 'قسمه',
  'تقسيم', 'نصيب', 'انصبه', 'حصه',
  'يرث', 'ترث', 'يرثه', 'يرثها', 'ورث',
]);
// Each heir word maps to its heir, so «ابن» and «ابنان» count once.
const HEIRS = new Map([
  ['zawj', ['زوج', 'زوجا', 'زوجها']],
  ['zawja', ['زوجه', 'زوجته', 'زوجتان', 'زوجتين', 'زوجات']],
  ['umm', ['ام', 'اما', 'امه', 'امها', 'امي']],
  ['ab', ['اب', 'ابا', 'ابوه', 'ابيه', 'ابوها', 'ابي']],
  ['ibn', ['ابن', 'ابنا', 'ابنان', 'ابنين', 'ابناء', 'اولاد', 'ابنه']],
  ['bint', ['بنت', 'بنتا', 'بنتان', 'بنتين', 'بنات', 'بنته']],
  ['akh', ['اخ', 'اخا', 'اخوان', 'اخوين', 'اخوه', 'اخوته']],
  ['ukht', ['اخت', 'اختا', 'اختان', 'اختين', 'اخوات']],
  ['jadd', ['جد', 'جدا']],
  ['jadda', ['جده', 'جدته']],
].map(([heir, words]) => [heir, set(words)]));

/** The forms a folded token may stand for: itself, and without و/ف, ب/ل/ك and ال («لل» read as «ال»). */
export function tokenBases(token) {
  const out = new Set([token]);
  let t = token;
  const add = (v) => { if (v && v.length >= 2) out.add(v); };
  if (/^[وف]./u.test(t)) { t = t.slice(1); add(t); }
  if (/^لل./u.test(t)) { add('ا' + t.slice(1)); add(t.slice(2)); }
  if (/^[بلك]./u.test(t)) { t = t.slice(1); add(t); }
  if (/^ال./u.test(t)) add(t.slice(2));
  return out;
}

const hasBase = (token, words) => [...tokenBases(token)].some((b) => words.has(b));

/** R1: does today's path answer this question from the bundled canonical stores? */
export function asksCanonicalStore(question) {
  const folded = normalizeArabic(String(question || ''));
  if (!folded) return false;
  const tokens = folded.split(' ');
  if (tokens.some((t) => hasBase(t, DHIKR_NOUNS)) || folded.includes(HISN)) return true;
  const exegesis = tokens.some((t) => hasBase(t, EXEGESIS));
  if (!exegesis) {
    if (folded.includes(KURSI)) return true;
    if (tokens.some((t) => hasBase(t, QURAN_VERBS)) && tokens.some((t) => hasBase(t, QURAN_NOUNS))) return true;
    if (tokens.some((t) => hasBase(t, new Set([KHAWATIM]))) && tokens.some((t) => hasBase(t, new Set([SURAH])))) return true;
  }
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    if (hasBase(tokens[i], MANNER_NOUNS) && hasBase(tokens[i + 1], WORSHIP_ACTS)) return true;
    if (tokens[i] === HOW && hasBase(tokens[i + 1], WORSHIP_VERBS)) return true;
  }
  return false;
}

/** R2: is this a request to divide an estate among named heirs? */
export function asksEstateDivision(question) {
  const folded = normalizeArabic(String(question || ''));
  if (!folded) return false;
  const tokens = folded.split(' ');
  if (!tokens.some((t) => hasBase(t, ESTATE_FRAME))) return false;
  if (tokens.some((t) => hasBase(t, DIVISION_ASK))) return true;
  const heirs = new Set();
  for (const t of tokens) for (const [heir, words] of HEIRS) if (hasBase(t, words)) heirs.add(heir);
  return heirs.size >= 2;
}

/**
 * The before-writing path's question-level exclusion: '' (none), 'canonical_store' or
 * 'estate_division'. A closed enum; beforeWritingV2Takes (lib/free-brain/flag.js) turns it into its
 * reason.
 */
export function bw2ScopeExclusion(question) {
  if (asksCanonicalStore(question)) return 'canonical_store';
  if (asksEstateDivision(question)) return 'estate_division';
  return '';
}

export const BW2_SCOPE_EXCLUSIONS = Object.freeze(['canonical_store', 'estate_division']);
