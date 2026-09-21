// lib/policy/takhrij-disclosure.js
// WHEN THE READER ASKS FOR A GRADING AND WE HAVE NO PRIMARY SOURCE FOR ONE, WE SAY SO. D8.
//
// ── THE MEASURED STATE, AND IT IS NOT A CORNER CASE ──────────────────────────
// dorar.net was the ONLY hadith-grading source this app ever had, and it was deferred on
// 2026-08-05: HTTP 403 to every server-side request, including its own documented JSON API. It
// is on no band list, and lib/source-intent.js removed the intent that used to target it,
// recording plainly that there is «nothing to re-route to».
//
// So the honest description of today is not "sometimes we lack a takhrij source". It is: THERE
// IS NO PRIMARY TAKHRIJ SOURCE AT ALL, and every grading question is answered without one. The
// reader cannot see that, and nothing in the reply told them.
//
// ── WHAT THIS SAYS, AND WHAT IT REFUSES TO DO ────────────────────────────────
// One fixed sentence, appended once. It does NOT hedge the answer above it, apologise for it, or
// withdraw it — lib/policy/referral-tail.js states that rule for the referral and it is the same
// rule here: a tail that undermines the answer above it is worse than no tail, because the reader
// then trusts neither. What it does is narrower and factual: the grading you have just read was
// transmitted from a general source, not verified against a takhrij corpus, and a definitive
// verdict is looked up in one.
//
// IT IS NOT THE TAKHRIJ LOCK, AND IT DOES NOT WEAKEN IT. lib/takhrij-lock.js still refuses to
// emit any attribution or grade that is not present in the extracted text of a page actually
// fetched. Nothing unsourced gets through either way. This sentence is about the difference
// between «a grading that appeared on a page we read» and «a grading from a corpus built to
// answer that question», which is a distinction the lock cannot draw and the reader cannot see.
//
// NO I/O, NO MODEL CALL, NO STATE.

import { normalizeArabic } from '../route-classify.js';
import { dropUnsourcedGrades } from '../takhrij-lock.js';

// ── THE PRIMARY TAKHRIJ CORPORA, AND THE LIST IS EMPTY ───────────────────────
// A domain belongs here when it is a registered source whose PURPOSE is takhrij and grading —
// an encyclopedia of gradings, not a fatwa site that happens to mention one. dorar.net is the
// only candidate this app has ever had, and it is deferred and unreachable, so it is not here.
//
// The list is the switch. The day a primary adapter is admitted, adding its domain here turns
// the disclosure off for the questions it can answer, and nothing else has to change.
export const PRIMARY_TAKHRIJ_DOMAINS = Object.freeze([]);

// ── THE SENTENCE ─────────────────────────────────────────────────────────────
// Styled on REFERRAL_TAILS: states what the thing above it IS, then where the binding answer
// lives. It names no number, blames nothing on the reader, and does not say "I am unable" —
// the answer stands; its provenance is being described.
export const TAKHRIJ_DISCLOSURE =
  'وهذا النقلُ لدرجةِ الحديثِ من المصدرِ المذكور، لا من كتب التخريج نفسِها؛ '
  + 'ولتحقيقِ الدرجةِ بعينها فارجعْ إلى دواوين التخريج أو اسأل أهلَ الحديث.';

// ── IS THE READER ASKING FOR A VERDICT ON A HADITH? ──────────────────────────
// ١١٣ · BY THE CLASS, NOT BY A PHRASE LIST. MEASURED 21 September 2026: the list that stood here
// knew «هل يصح حديث…؟» and missed thirteen ordinary ways of asking the same thing — «هل ثبت
// حديث…؟», «هل حديث… ثابت؟» (the owner's own W8 question, word for word), «هل حديث… صحيح؟»,
// «هل له أصل؟», «من روى حديث…؟» — while it FIRED on «ما حكم الحديث أثناء خطبة الجمعة؟» (talking
// during the khutba) and «ما موضوع حديث الشيخ اليوم؟» (the topic of a talk).
//
// SO THE QUESTION IS ASKED BY ITS TWO PARTS. The message must NAME a hadith — a quotation «…», the
// word «حديث» standing for a text (not «جهاز حديث», not «الحديث الضعيف» as a category, not «الحديث
// مع…» as talk), or the Prophet ﷺ named — AND it must ask about that text's STANDING: a verb of
// establishing or transmitting whose object is the text («هل ثبت حديث…», «هل صح عن النبي ﷺ…»,
// «من رواه»), a grade said OF the text («هل حديث… صحيح؟», «هل هو ضعيف؟»), or a noun of standing
// that belongs to it («درجة حديث…», «درجته», «له أصل», «تخريج كل حديث», «حكم الحديث»).
//
// THE NEGATIVE SIDE IS THE HARDER HALF, and it is held by the same two parts. «ما حكم النميمة؟»
// names no hadith. «هل روى ثابت البناني عن أنس؟» names none either — «ثابت» is a man. «هل صح
// صيامي؟» and «هل يصح بيع الذهب… مع حديث «…»؟» name something whose standing is not asked: the
// verb's object is the fast and the sale, not the text. The fixtures are guards/source-honesty-
// guard.cjs D2/D3 and the forty-three phrasings of ١١٣.
const n = (s) => normalizeArabic(s);
const setOf = (words) => new Set(words.map(n));
const HADITH_NOUNS = setOf(['حديث', 'الحديث', 'بحديث', 'لحديث', 'وحديث', 'فحديث', 'والحديث', 'حديثا',
  'أحاديث', 'الأحاديث', 'رواية', 'الرواية']);
const DEMONSTRATIVES = setOf(['هذا', 'هذه', 'ذلك', 'تلك']);
const PLURAL_NOUNS = setOf(['أحاديث', 'الأحاديث']);
// «حديث» followed by one of these is a CATEGORY («الحديث الضعيف») or TALK («الحديث أثناء الخطبة»).
const GENERIC_AFTER = setOf(['الضعيف', 'الصحيح', 'الحسن', 'الموضوع', 'المرسل', 'المتواتر', 'الموقوف',
  'المرفوع', 'الشاذ', 'المنكر', 'المعلول', 'الضعيفة', 'الصحيحة', 'الموضوعة', 'النبوي', 'القدسي']);
const TALK_AFTER = setOf(['أثناء', 'مع', 'بين', 'وقت', 'عند', 'خلال', 'حال', 'بالهاتف', 'بالجوال']);
const TALK_PLACES = setOf(['المسجد', 'الخطبة', 'الصلاة', 'الهاتف', 'الجوال', 'الطريق', 'الحمام', 'الخلاء',
  'المقبرة', 'المجلس']);
const STANDING_VERBS = setOf(['صح', 'يصح', 'تصح', 'ثبت', 'يثبت', 'تثبت', 'ورد', 'يرد', 'روى', 'يروى',
  'خرج', 'أخرج']);
const WHO_VERBS = setOf(['رواه', 'رواها', 'أخرجه', 'أخرجها', 'خرجه', 'خرجها', 'أخرجاه']);
const GRADES = setOf(['صحيح', 'صحيحة', 'ثابت', 'ثابتة', 'ضعيف', 'ضعيفة', 'موضوع', 'موضوعة', 'مكذوب',
  'مكذوبة', 'باطل', 'متواتر', 'مرسل', 'موقوف', 'موقوفة', 'مرفوع', 'مرفوعة', 'شاذ', 'منكر', 'معلول', 'واه']);
const STANDING_NOUNS = setOf(['درجة', 'صحة', 'أصل', 'تخريج', 'سند', 'إسناد', 'حكم']);
const OWNED_STANDING = setOf(['درجته', 'درجتها', 'صحته', 'صحتها', 'أصله', 'أصلها', 'تخريجه', 'تخريجها',
  'سنده', 'إسناده', 'إسنادها']);
const SKIP_AFTER = setOf(['هذا', 'هذه', 'ذلك', 'تلك', 'لي', 'لنا', 'كل']);
const ASL = n('أصل');

// The message as tokens, with three marks the normalizer would otherwise erase: `qq` for a
// quotation, `saw` for the salutation, `pp` for a clause boundary.
function gradingTokens(raw) {
  const marked = String(raw == null ? '' : raw)
    .replace(/«[^«»]{2,}»|"[^"]{2,}"|“[^”]{2,}”/gu, ' qq ')
    .replace(/ﷺ/gu, ' saw ')
    .replace(/[،,.؟?!؛;:\n]/gu, ' pp ');
  return (' ' + normalizeArabic(marked) + ' ')
    .replace(/ صلي الله عليه وسلم /gu, ' saw ')
    .split(' ').filter(Boolean);
}

/**
 * @param {string} raw the reader's message
 * @returns {boolean} true only for a request for a VERDICT on a report's authenticity
 */
export function asksForGrading(raw) {
  const t = gradingTokens(raw);
  if (!t.length) return false;
  const at = (i) => (i >= 0 && i < t.length ? t[i] : 'pp');
  const prophetAt = (i) => at(i) === 'saw' || at(i) === 'النبي' || (at(i) === 'رسول' && at(i + 1) === 'الله');
  const nounNamesText = (i) => {
    if (!HADITH_NOUNS.has(t[i])) return false;
    if (DEMONSTRATIVES.has(at(i - 1)) || at(i - 1) === 'كل') return true;
    const next = at(i + 1);
    if (next === 'qq') return true;
    if (next === 'pp' || GENERIC_AFTER.has(next)) return false;
    // TALK is a singular sense: «الحديث مع المخطوبة». «أحاديث مع تخريجها» is texts.
    if (TALK_AFTER.has(next) && !PLURAL_NOUNS.has(t[i])) return false;
    if (next === 'في' && TALK_PLACES.has(at(i + 2))) return false;
    if (next === 'عن' && !prophetAt(i + 2)) return false;
    return true;
  };
  // 1 · A HADITH IS NAMED, or there is nothing whose standing could be asked about.
  if (!t.some((w, i) => w === 'qq' || prophetAt(i) || nounNamesText(i))) return false;
  // 2 · ITS STANDING IS ASKED.
  const isText = (i) => at(i) === 'qq' || HADITH_NOUNS.has(at(i)) || prophetAt(i);
  const nextMeaningful = (i) => { let j = i + 1; while (SKIP_AFTER.has(at(j))) j += 1; return j; };
  for (let i = 0; i < t.length; i += 1) {
    const w = t[i];
    if (STANDING_VERBS.has(w)) {
      const j = nextMeaningful(i);
      if (isText(j)) return true;
      if ((at(j) === 'عن' || at(j) === 'ان' || at(j) === 'انه') && [1, 2, 3].some((k) => prophetAt(j + k))) return true;
      if (at(j) === 'pp' && at(i - 1) === 'هل') return true;
    } else if (WHO_VERBS.has(w)) {
      if (at(i - 1) === 'من') return true;
    } else if (GRADES.has(w)) {
      let p = i - 1;
      while (at(p) === 'هل' || at(p) === 'وهل') p -= 1;
      if (isText(p) && at(p) !== 'النبي' && at(p) !== 'saw') return true;
      if ((at(i - 1) === 'هو' || at(i - 1) === 'هي') && at(i - 2) === 'هل') return true;
      if (at(i + 1) === 'عن' && prophetAt(i + 2)) return true;
    } else if (STANDING_NOUNS.has(w)) {
      if (w === ASL && at(i - 1) === 'له') return true;
      const j = nextMeaningful(i);
      if (at(j) === 'qq' || HADITH_NOUNS.has(at(j))) return true;
    } else if (OWNED_STANDING.has(w)) {
      return true;
    } else if ((w === 'قال' && at(i - 1) === 'هل') || w === 'قاله') {
      if (prophetAt(i + 1)) return true;
    } else if (HADITH_NOUNS.has(w) && at(i - 1) === 'qq' && at(i + 1) === 'pp' && t.slice(0, i).includes('هل')) {
      return true;
    }
  }
  return false;
}

/** Was any page we actually read a primary takhrij corpus? */
export function hasPrimaryTakhrij(domains) {
  if (!Array.isArray(domains) || !PRIMARY_TAKHRIJ_DOMAINS.length) return false;
  const seen = new Set(domains.map((d) => String(d || '').toLowerCase().replace(/^www\./, '')));
  return PRIMARY_TAKHRIJ_DOMAINS.some((d) => seen.has(d));
}

/**
 * THE ONE ENTRY POINT.
 * @param {{question:string, sourceDomains?:string[]}} args
 * @returns {string} the sentence, or '' when it does not apply
 */
export function takhrijDisclosureFor({ question, sourceDomains } = {}) {
  if (!asksForGrading(question)) return '';
  if (hasPrimaryTakhrij(sourceDomains)) return '';
  return TAKHRIJ_DISCLOSURE;
}

/**
 * Appended once, whatever the exit. Same shape as referralOnce(): a function OF THE DRAFT, so
 * that a reply which already carries the sentence does not receive a second copy.
 */
// ── THIRD ORDER, STEP 5 · THE SENTENCE SPEAKS OF A GRADE, SO A GRADE MUST STILL STAND ──
//
// MEASURED on the owner's preview: «وهذا النقل لدرجة الحديث من المصدر المذكور…» under three answers
// that carried NO grade at all — «الدين النصيحة» (a credit, no grade), the hadith of Ibn Mas'ud, and
// «الصيام والقرآن يشفعان», whose «صحيح» went for want of a source and left no ruling behind it. A
// sentence about «the grade quoted above» with no grade above it describes nothing the reader has.
//
// So the question's own condition stays exactly as it is (`takhrijDisclosureFor`), and one more is
// asked OF THE TEXT: after the grade rule has run on it — `dropUnsourcedGrades`, the rule the
// reader seat runs, so a grade that seat is about to take does not count — does a grade still
// stand, in the prose or in a bracket? The words are the grades and the verdicts, and in the prose
// only beside the thing graded, because «أمر ثابت بنص القرآن» and «حسن الخلق» grade nothing.
// A book is not a grade: «صحيح البخاري»، «ضعيف الجامع» are titles and are read out first.
// Folded as foldLight folds (ة ⟶ ه), with the feminine and the plural: «أحاديث ثابتة» grades too.
const GRADE_WORD = '(?:صحيح|صحيحه|صحاح|حسن|حسنه|ضعيف|ضعيفه|ضعاف|موضوع|موضوعه|منكر|منكره|باطل|باطله|مكذوب|مكذوبه|شاذ|شاذه|متروك|واه|واهيه|ثابت|ثابته|مقبول|جيد)';
const GRADE_BOOK_RE = new RegExp('(?:صحيح|ضعيف|السلسله|سلسله)\\s+(?:البخاري|مسلم|ابن\\s+\\S+|ابي\\s+داود|الترمذي|النسايي|الجامع|الترغيب|سنن\\s+\\S+|الصحيحه|الضعيفه|الاحاديث\\s+\\S+)', 'gu');
const GRADE_IN_BRACKET_RE = new RegExp('[(\uFF08][^()\uFF08\uFF09]*(?:^|[^\\p{L}])[وف]?' + GRADE_WORD + '(?![\\p{L}])[^()\uFF08\uFF09]*[)\uFF09]', 'u');
const GRADE_IN_PROSE_RE = new RegExp('(?:^|[^\\p{L}])(?:[وف]?(?:حديث|الحديث|احاديث|الاحاديث|اسناده|اسنادها|اسناد|الاسناد|سنده|السند|روايه|الروايه|الاثر|اثر)(?:\\s+\\S+){0,2}?\\s+[وف]?' + GRADE_WORD + '|(?:وهو|فهو|هو)\\s+' + GRADE_WORD + '|لا\\s+يصح|لم\\s+يصح|لا\\s+يثبت|لم\\s+يثبت|لا\\s+اصل\\s+له|بالوضع|[وف]?(?:صححه|حسنه|ضعفه|صححها|حسنها|ضعفها))(?![\\p{L}])', 'u');
// The shared normalizer drops punctuation — brackets with it — so the fold here is marks and letter
// forms only.
const foldLight = (text) => String(text).replace(/[ً-ْٰـ]/gu, '')
  .replace(/[أإآ]/gu, 'ا').replace(/ة/gu, 'ه').replace(/[ىئ]/gu, 'ي');

/** Does a grade still stand in this text once the grade rule has run on it? */
export function gradeStandsIn(text) {
  const kept = dropUnsourcedGrades(String(text == null ? '' : text)).text;
  const folded = foldLight(kept).replace(GRADE_BOOK_RE, ' ');
  return GRADE_IN_BRACKET_RE.test(folded) || GRADE_IN_PROSE_RE.test(folded);
}

export function takhrijDisclosureOnce(draft, disclosure) {
  if (!disclosure) return '';
  const d = String(draft == null ? '' : draft);
  if (d.includes(disclosure)) return '';
  // Its own distinguishing clause is enough to recognise a paraphrase the model may have drafted
  // on its own account; a second sentence saying the same thing is noise the reader stops reading.
  if (/دواوين التخريج|كتب التخريج/.test(d)) return '';
  if (!gradeStandsIn(d)) return '';
  return disclosure;
}
