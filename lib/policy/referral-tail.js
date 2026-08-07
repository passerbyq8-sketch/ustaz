// lib/policy/referral-tail.js
// THE REFERRAL TO AHL AL-'ILM IS THE SERVER'S SENTENCE, NOT THE MODEL'S.
//
// ── WHY IT IS APPENDED RATHER THAN ASKED FOR ─────────────────────────────────
// «عزك ناقلٌ لا مفتٍ.» He transmits a ruling from a page, names the page, and points the reader at
// the people who actually issue rulings. The system prompt has always ASKED the model to do the
// last part, and an instruction is a request: the model omitted it most reliably on the answers
// that read most confidently, which are exactly the ones that needed it. So the server appends it.
//
// ── WHY THERE IS MORE THAN ONE WORDING ───────────────────────────────────────
// One sentence repeated verbatim under every answer is a sentence nobody reads. Banner blindness
// is not a hypothetical failure of a fixed footer; it is what a fixed footer is FOR the second
// week. The set is rotated on the conversation's own turn count, so two answers in a row do not
// end identically — deterministically, with no store and no model call.
//
// ── THE LINE THIS MAY NEVER CROSS ────────────────────────────────────────────
// The frozen acts of worship. The constitution is explicit:
//
//   «لا بيروقراطية فيها إطلاقًا: اتلُ القالب كاملًا كوحدة ثابتة، ولا تقطعه بسؤال ولا تذيّله به»
//
// A child following the steps of wudu must reach the end of them and stop. The steps are not a
// fatwa, there is nothing to refer, and a disclaimer bolted onto them teaches the reader that the
// app is unsure about how to wash his hands. This is checked BEFORE the topic class, because the
// classifier calls «كيف أتوضأ؟» a `sharia_ruling` and it is right to: the class is about the
// subject, and this rule is about the SHAPE of the answer.
//
// NOR IS EVERY RELIGIOUS ANSWER A FATWA. Reporting what a verse means, what a hadith says, or who
// a man was is transmission and not a ruling; a fatwa referral under it is noise, and noise is
// what makes the referral invisible where it matters.
//
// NO I/O, NO MODEL CALL, NO STATE.

import { fold } from './entities.js';

/**
 * THE WORDINGS THE SERVER OWNS.
 *
 * Each one says the same thing differently: this is transmitted, and a binding answer for YOUR
 * case comes from a person who can hear the case. None of them issues a ruling, hedges the one
 * just given, or apologises for it — a tail that undermines the answer above it is worse than no
 * tail, because the reader then trusts neither.
 */
export const REFERRAL_TAILS = Object.freeze([
  'وهذا نقلٌ عن المصدر المذكور؛ ولتفاصيل حالتك بعينها فاسأل أهل العلم عندك، فهم أقدر على تنزيل الحكم على واقعك.',
  'وللاطمئنان في مسألتك أنت، اعرِضْها على مفتٍ أو طالب علمٍ ثقة يعرف تفاصيلها كاملة.',
  'وما سبق منقولٌ من مصدره؛ والفتوى في النازلة المعيّنة مرجعها أهل العلم ودُور الإفتاء المعتمدة.',
  'وإن كان في مسألتك قيدٌ أو ملابسةٌ لم تُذكر هنا، فاسأل عنها أهل العلم مباشرةً قبل أن تعمل بها.',
  'وهذا بيانٌ لما في المصدر لا فتوى في عينِ مسألتك؛ وأهل العلم في بلدك أدرى بما يخصّك منها.',
]);

// ── THE FROZEN ACTS, AND ONLY THEIR MANNER ───────────────────────────────────
//
// TWO CONDITIONS, AND BOTH ARE NEEDED. «كيف أصلي؟» is a template to be recited whole; «هل تجب
// صلاة الجماعة على المسافر؟» is a fatwa about prayer and is entitled to the referral like any
// other. Testing the subject alone would silence every ruling that mentions prayer — which is a
// great many of them — and testing the shape alone would silence «كيف أستثمر مالي؟».
const FROZEN_SUBJECT = [
  'الصلاه', 'صلاه', 'اصلي', 'يصلي', 'نصلي', 'صلاتي', 'الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء',
  'الوضوء', 'وضوء', 'اتوضا', 'يتوضا', 'وضوئي',
  'الغسل', 'غسل', 'اغتسل', 'الاغتسال',
  'التيمم', 'تيمم', 'اتيمم',
  'الاذكار', 'اذكار', 'ذكر الصباح', 'اذكار الصباح', 'اذكار المساء', 'اذكار النوم',
];
// The reader is asking HOW IT IS DONE, or asking for the text itself. «ما هي أذكار الصباح؟» is a
// request for the adhkar — the template — as plainly as «كيف أتوضأ؟» is a request for the steps,
// and it carries none of the manner words. The bare-request shapes are safe here only because the
// SUBJECT test above has already narrowed this to the five frozen acts: «ما هي أحكام العدة؟»
// reaches none of it.
const MANNER_SHAPE = /(?:كيف|كيفيه|صفه|طريقه|علمني|علميني|اشرح لي|خطوات|عدد ركعات|كم ركعه|كم عدد ركعات|ما هي|ماهي|ما هو|ماهو|اعطني|هات|اذكر لي|اريد)/u;
// …and not what its RULING is. A ruling word in the sentence means a fatwa was asked for.
const RULING_SHAPE = /(?:ما حكم|حكم|يجب|تجب|واجبه|يجوز|لا يجوز|صحيح ام باطل|هل تصح|هل يصح|هل تجب|هل يجب|قضاء|كفاره|اثم)/u;

const AR_LETTER = /[ء-يٮ-ۓۮ-ۿ]/;
function hasWord(hay, w) {
  let from = 0;
  for (;;) {
    const at = hay.indexOf(w, from);
    if (at === -1) return false;
    from = at + 1;
    const before = at > 0 ? hay[at - 1] : ' ';
    const after = at + w.length < hay.length ? hay[at + w.length] : ' ';
    if (!AR_LETTER.test(before) && !AR_LETTER.test(after)) return true;
  }
}

/**
 * IS THIS A REQUEST FOR THE MANNER OF A FROZEN ACT OF WORSHIP?
 *
 * @param {string} question the reader's own words
 * @returns {boolean}
 */
export function isFrozenWorshipQuestion(question) {
  const t = fold(question || '');
  if (!t) return false;
  if (!FROZEN_SUBJECT.some((s) => hasWord(t, s))) return false;
  if (!MANNER_SHAPE.test(t)) return false;
  // «كم عدد ركعات صلاة الظهر وكيف أؤديها؟» is the template. «ما حكم من ترك الصلاة تكاسلًا؟» is a
  // fatwa. When a sentence carries both shapes, the RULING wins — an answer that states a ruling
  // is a ruling however it was phrased.
  if (RULING_SHAPE.test(t)) return false;
  return true;
}

// Every religious class that is a RULING. `sharia_ruling` covers the fatwa, the nazila, the
// financial transaction, the family matter and the creed question — the classifier does not split
// them, and this rule does not need it to. `scholar_position` is a ruling reported from a man.
const RULING_CLASSES = new Set(['sharia_ruling', 'scholar_position']);

// ── THE CONDITION IS A MEASURED REFERRAL, NOT A SUBJECT ──────────────────────
// (تكليفُ «شكلِ الجواب» — ٨ أغسطس ٢٠٢٦، البند ٣)
//
// WHAT CHANGED. Until this assignment the tail fired on the TOPIC CLASS alone: every
// `sharia_ruling` and every `scholar_position` answer ended with one of the five wordings above.
// That is precisely a fixed footer under every ordinary fiqh answer, and the owner ruled that
// shape out in as many words: «لا يذكر شي غير الاجابات، والمصادر اصلا مذيله في كل مره».
//
// WHAT DID NOT CHANGE. «عزك ناقلٌ لا مفتٍ» is untouched, because it was never this sentence: it
// is a MEASURED behaviour — every ruling is transmitted from a fetched page that ships its own
// source card, and the app adds no preference of its own. The SENTENCE was removed; the rule it
// described is enforced by retrieval and by lib/policy/source-attribution.js, which is where a
// property you can check lives. A disclaimer is not a safeguard, it is a description of one.
//
// SO THE TRIGGER IS THE SERVER'S OWN MEASURED REFERRAL OUTCOME, passed in by the caller and named
// here — never the subject of the question. The nine cases in referral-golden.json are what a
// referral IS in this app: distress, self-harm, a question above the reader's age, a sensitive
// personal matter. «ما حكم بيع الذهب بالتقسيط؟» is none of them.
//
// ⚠️ AND IT IS DORMANT ON TODAY'S LIVE PATHS, DELIBERATELY. The one exit in api/ask.js that
// reaches a REFER_ADULT outcome returns a warm template verbatim and never appends this block —
// and it must not start to, because those templates are class (ب) in this assignment's sort and
// their text may not gain a byte. The set is kept, named and reachable so that the day a measured
// referral surface carries a SOURCED answer, the wording is already the server's and already
// deduplicated. It is not kept in order to go on printing under fatwas.
export const MEASURED_REFERRAL_OUTCOMES = Object.freeze(['REFER_ADULT']);

/**
 * IS THIS A REFERRAL THE SERVER ACTUALLY MEASURED, rather than a subject it recognised?
 *
 * @param {string} outcome the age/safety policy outcome api/ask.js has already decided
 * @returns {boolean}
 */
export function isMeasuredReferralCase(outcome) {
  return MEASURED_REFERRAL_OUTCOMES.includes(String(outcome || ''));
}

// ── ONCE PER REPLY, WHATEVER THE EXIT ────────────────────────────────────────
//
// THE MEASURED DEFECT. «ما حكم بيع الذهب بالتقسيط؟» came back with the referral on the end of it
// TWICE. Not because two exits both appended — because the SYSTEM PROMPT still asks the model for
// a referral of its own, and the server appends its own on top. Two requests for the same sentence
// from two places produce two sentences, and a disclaimer that repeats itself reads as a stutter
// rather than as care.
//
// THE SERVER'S TAIL IS THE ONE THAT SURVIVES, and dropping it is the wrong repair: it is the one
// that is guaranteed to be there. So the rule is DEDUPLICATION, not omission — if the draft
// already ends the reader at ahl al-'ilm, in the model's words or in ours, the server adds nothing.
//
// Matched on the FOLDED text, so tashkeel and the hamza spellings cannot smuggle a second copy
// past it — the drafts are fully vocalised and «فَاسْأَلْ أَهْلَ الْعِلْمِ» must match «فاسال اهل العلم».
const ALREADY_REFERRED = [
  'اسال اهل العلم', 'فاسال اهل العلم', 'اسال اهل العلم', 'اهل العلم عندك', 'اهل العلم في بلدك',
  'اسال عالما', 'فاسال عالما', 'اسال عالما موثوقا', 'عالما موثوقا',
  'مفت او طالب علم', 'طالب علم ثقه', 'دور الافتاء', 'دار الافتاء المعتمده', 'دور الافتاء المعتمده',
  'مرجعها اهل العلم', 'اعرضها علي مفت', 'اسال عنها اهل العلم', 'راجع اهل العلم', 'فراجع اهل العلم',
  'يسال اهل العلم', 'تسال اهل العلم', 'استشر اهل العلم',
];

/**
 * DOES THIS DRAFT ALREADY SEND THE READER TO AHL AL-'ILM?
 *
 * @param {string} text the finished reply, or as much of it as has been produced
 * @returns {boolean}
 */
export function alreadyReferred(text) {
  const t = fold(text || '');
  if (!t) return false;
  for (const tail of REFERRAL_TAILS) {
    const f = fold(tail);
    // The first clause is enough of a fingerprint and survives the model paraphrasing the rest.
    if (f && t.includes(f.slice(0, 40))) return true;
  }
  return ALREADY_REFERRED.some((m) => t.includes(m));
}

/**
 * THE TAIL TO ACTUALLY APPEND TO THIS DRAFT — '' when one is already there.
 * Every exit in the handler goes through this, which is what makes "once" a property of the
 * REPLY rather than a property of whichever branch happened to produce it.
 *
 * @param {string} draft the reply about to go out
 * @param {string} tail  what referralTail() decided this question is owed
 * @returns {string} the tail with its leading separator, or ''
 */
export function referralOnce(draft, tail) {
  if (!tail) return '';
  if (alreadyReferred(draft)) return '';
  return '\n\n' + tail;
}

/**
 * THE TAIL FOR THIS ANSWER, or '' when there is none.
 *
 * @param {string} question        the reader's own words
 * @param {string} topicClass      what lib/policy/core.js classified the question as
 * @param {number} turn            how many answers this conversation has already produced
 * @param {string} referralOutcome the policy outcome the server measured for this question
 * @returns {string}
 */
export function referralTail(question, topicClass, turn = 0, referralOutcome = '') {
  // ── THE NAMED CONDITION, AND IT IS FIRST ────────────────────────────────────
  // A SUBJECT IS NOT A REFERRAL. Everything below this line narrows a tail that has already
  // been earned by a measured referral; nothing below it can earn one. See the block above
  // MEASURED_REFERRAL_OUTCOMES — this is the whole of البند ٣ of the 2026-08-08 assignment.
  if (!isMeasuredReferralCase(referralOutcome)) return '';
  // FIRST, AND ABOVE THE CLASS. «كيف أتوضأ؟» classifies as a ruling and is a template.
  if (isFrozenWorshipQuestion(question)) return '';
  if (!RULING_CLASSES.has(String(topicClass || ''))) return '';
  const n = REFERRAL_TAILS.length;
  // Any integer, including a negative or a nonsense one, lands inside the set.
  const i = Number.isFinite(turn) ? ((Math.trunc(turn) % n) + n) % n : 0;
  return REFERRAL_TAILS[i];
}
