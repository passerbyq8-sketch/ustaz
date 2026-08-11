// lib/transfer/match.js — IS THE READER'S QUESTION THE QUESTION THIS PAGE ALREADY ANSWERED?
//
// ── WHAT TRANSFER MODE IS FOR (قرار ١) ───────────────────────────────────────
// The vetted sources publish tens of thousands of question-and-answer pages. When a reader types a
// question that IS one of them, generating a fresh answer is strictly worse than handing over the
// published one: the published one was written by the scholar whose name is on it, and the
// generated one is a paraphrase of it that nobody checked. Transfer mode moves the published text
// instead of re-writing it.
//
// ── AND WHY THE BAR IS SET WHERE IT IS ───────────────────────────────────────
// The whole risk lives in ONE failure: two questions that look alike and are not the same
// question. «ما حكم قصر الصلاة للمسافر؟» and «ما حكم قصر الصلاة للمقيم؟» differ by a single word
// and have opposite answers. Word-set similarity puts them at 0.9+. So similarity ALONE may never
// authorise a transfer, and the flip-token check below is not a refinement of it — it is a
// separate, mandatory veto that runs even at 1.0.
//
// ── FAIL CLOSED, EVERYWHERE ──────────────────────────────────────────────────
// Every uncertainty in this file resolves to NO TRANSFER. A page that is not transferred costs the
// reader nothing — the ordinary sourced answer runs exactly as it always did. A page transferred
// wrongly puts a scholar's name on an answer to a question he was not asked.

import { normalizeArabic } from '../route-classify.js';
import { QUALIFIER_GROUPS } from '../page-match.js';

// ── THE NAMED CONSTANTS (قرار ٢) ─────────────────────────────────────────────

/** At or above this, the two questions are the same question — subject to the flip-token veto. */
export const TRANSFER_MATCH = 0.97;

/** Below TRANSFER_MATCH and at or above this, a decisive judge is asked. Below it, no transfer. */
export const JUDGE_BAND = Object.freeze([0.85, 0.97]);

// A short question is a word-set of three or four tokens, where one differing word swings Jaccard
// by 0.25 and the measure stops discriminating. Levenshtein over the whole normalised string is
// the support for exactly that case, and it is a SUPPORT: it can lower a score and never raise it.
export const SHORT_QUESTION_WORDS = 6;

// ── THE FLIP TOKENS ──────────────────────────────────────────────────────────
//
// A word whose presence on ONE side and absence on the other changes what is being asked. Not a
// list of important words — a list of words that INVERT.
//
// THE ḤĀL FAMILIES ARE IMPORTED, NOT RETYPED. lib/page-match.js already owns the seven states of
// the actor (jahl, ʿamd, sahw, ikrāh, ʿajz, kasal, juḥūd) and its own gate asserts them; a second
// copy here would be a second list, and the one that goes stale is always the one nobody is
// looking at. What is added below is what those groups do not cover, grouped by the axis it flips.
const HAL_FAMILY_TOKENS = Object.values(QUALIFIER_GROUPS).flat();

// ── WHAT IS DELIBERATELY *NOT* A FLIP TOKEN ──────────────────────────────────
// A word earns a place below only if its presence on one side changes WHAT IS BEING ASKED. Words
// that merely change HOW it is asked are excluded, and the exclusions are measured:
//
//   «ما»      — interrogative and negative are the same string. «ما حكم كذا» is a question and
//               «ما فعل» is a negation, exactly the ambiguity lib/policy/name-presence.js split
//               «من» over. Listed as a negator it fired on «هل يجوز…» vs «ما حكم…» — the same
//               question asked twice — and transfer mode would have been dead on arrival.
//   يجوز/يجب  — the interrogative FRAME, not a qualifier. «هل يجوز بيع الذهب» and «ما حكم بيع
//               الذهب» are one question; a modal in the difference is a rephrasing, and only a
//               SUBSTITUTED modal («يجوز» against «يحرم») would be an inversion.
//   سنة       — folds to «سنه», which is also the word for «year». A grade token that fires on
//               «كم سنة» is a token that fires on arithmetic.
//   عند       — a preposition far more often than a time marker («عند الشيخ فلان»).
export const FLIP_GROUPS = Object.freeze({
  // Negation — the shortest and most complete inversion there is.
  negation: Object.freeze(['لا', 'ليس', 'ليست', 'غير', 'بدون', 'دون', 'لم', 'لن', 'عدم']),
  // Time — «قبل الفجر» and «بعد الفجر» are different rulings on the same act.
  time: Object.freeze(['قبل', 'بعد', 'اثناء', 'خلال']),
  // Travel — the measured pair this whole check exists for.
  travel: Object.freeze(['مسافر', 'المسافر', 'سفر', 'السفر', 'مقيم', 'المقيم', 'اقامه', 'حاضر', 'الحاضر']),
  // Sex of the questioner or the subject.
  sex: Object.freeze(['رجل', 'الرجل', 'رجال', 'امراه', 'المراه', 'نساء', 'ذكر', 'الذكر', 'انثي', 'الانثي', 'بنت', 'ولد']),
  // Age and legal capacity.
  age: Object.freeze(['صغير', 'الصغير', 'صبي', 'طفل', 'كبير', 'الكبير', 'بالغ', 'البالغ', 'قاصر', 'مميز']),
  // Alive or dead — «الصدقة عن الحي» is not «الصدقة عن الميت».
  life: Object.freeze(['حي', 'الحي', 'ميت', 'الميت', 'المتوفي', 'متوفي', 'موتي']),
  // The GRADE being asked about. «هل هو واجب» and «هل هو مستحب» are two questions.
  grade: Object.freeze(['واجب', 'الواجب', 'فرض', 'الفرض', 'مستحب', 'المستحب',
    'مباح', 'المباح', 'مكروه', 'المكروه', 'حرام', 'الحرام', 'باطل']),
  // Ritual state.
  purity: Object.freeze(['حائض', 'الحائض', 'نفساء', 'النفساء', 'جنب', 'طاهر', 'محدث', 'متوضي']),
  // Fasting / prayer state that changes the act's ruling.
  state: Object.freeze(['صائم', 'الصائم', 'مفطر', 'المفطر', 'محرم', 'المحرم', 'حلال']),
  // The seven ḥāl families, shared with lib/page-match.js.
  hal: Object.freeze(HAL_FAMILY_TOKENS),
});

/** Every flip token, flat and deduped. Printed in full by the gate, so the list is auditable. */
export const FLIP_TOKENS = Object.freeze(
  Array.from(new Set(Object.values(FLIP_GROUPS).flat().map((t) => normalizeArabic(t)))).sort()
);
const FLIP_SET = new Set(FLIP_TOKENS);

// ── normalisation and tokens ─────────────────────────────────────────────────
//
// normalizeArabic is REUSED rather than reimplemented. It already does exactly what قرار ٢ asks
// for — tashkeel, tatweel, hamza forms to ا, ة to ه, ى to ي, punctuation to space — and a second
// normaliser here would be a second answer to "are these the same string".

/** The violently normalised form. */
export const foldQuestion = (s) => normalizeArabic(String(s == null ? '' : s));

/** The word SET, which is what Jaccard is computed over. */
export function wordSet(s) {
  return new Set(foldQuestion(s).split(' ').filter(Boolean));
}

/** |A ∩ B| / |A ∪ B|. 1 when both are empty is FALSE here — two empty questions match nothing. */
export function jaccard(a, b) {
  const A = a instanceof Set ? a : wordSet(a);
  const B = b instanceof Set ? b : wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Normalised edit distance as a 0..1 similarity. Bounded so a long pair cannot cost quadratic. */
export function levenshteinRatio(aRaw, bRaw) {
  const a = foldQuestion(aRaw), b = foldQuestion(bRaw);
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const MAX = 400;
  if (a.length > MAX || b.length > MAX) return 0;   // not a short question; the support does not apply
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * The words present on one side and absent on the other — BOTH directions.
 *
 * The symmetric difference is the right set, not «what the page is missing»: a QUALIFIER the
 * reader did not write but the page did is exactly as disqualifying as the reverse. The page
 * answers «للمسافر» and the reader asked without it — that is not the reader's question.
 */
export function symmetricDifference(a, b) {
  const A = a instanceof Set ? a : wordSet(a);
  const B = b instanceof Set ? b : wordSet(b);
  const out = new Set();
  for (const w of A) if (!B.has(w)) out.add(w);
  for (const w of B) if (!A.has(w)) out.add(w);
  return out;
}

// ARABIC GLUES ITS FUNCTION WORDS TO THE FRONT OF THE NEXT ONE. «للمسافر» is «ل» + «المسافر»,
// and MEASURED on the very pair this check exists for — «قصر الصلاة للمسافر» against «قصر الصلاة
// للمقيم» — a whole-word test against the list found NOTHING, because neither «للمسافر» nor
// «للمقيم» is in it. The two questions have opposite answers and the veto stayed silent.
//
// So each differing word is also tried with its proclitics removed. Longest prefix first, and
// only ONE pass: «وبال» is not a word this needs to reach, and a loop here would eventually strip
// a real word down to a letter.
const PROCLITICS = ['وبال', 'فبال', 'وكال', 'بال', 'كال', 'فال', 'وال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل'];

function declitic(word) {
  for (const p of PROCLITICS) {
    if (word.length > p.length + 2 && word.startsWith(p)) return word.slice(p.length);
  }
  return word;
}

/**
 * Which flip tokens sit in the symmetric difference?
 *
 * SUBSTRING, NOT EQUALITY, for the ḥāl families — that is how lib/page-match.js matches them, and
 * for the same reason. The other groups are matched as whole words (bare and de-cliticised),
 * because they are short and a substring test on «لا» would fire inside half the vocabulary.
 */
export function flipTokensIn(diffSet) {
  const found = new Set();
  for (const w of diffSet) {
    const bare = declitic(w);
    if (FLIP_SET.has(w) || FLIP_SET.has(bare)) { found.add(w); continue; }
    for (const h of HAL_FAMILY_TOKENS) {
      const t = normalizeArabic(h);
      if (t && (w.indexOf(t) !== -1 || bare.indexOf(t) !== -1)) { found.add(w); break; }
    }
  }
  return found;
}

// ── the verdict ──────────────────────────────────────────────────────────────

export const TRANSFER = Object.freeze({
  TRANSFER: 'transfer',     // move the published answer
  JUDGE: 'judge',           // ask the decisive yes/no question first
  NO: 'no',                 // generate the ordinary sourced answer
});

/**
 * Compare the reader's question with a published one.
 *
 * @returns {{verdict:string, score:number, jaccard:number, lev:number,
 *            flips:string[], reason:string}}
 */
export function compareQuestions(readerRaw, publishedRaw) {
  const A = wordSet(readerRaw), B = wordSet(publishedRaw);
  const j = jaccard(A, B);
  const shortPair = A.size <= SHORT_QUESTION_WORDS || B.size <= SHORT_QUESTION_WORDS;
  const lev = shortPair ? levenshteinRatio(readerRaw, publishedRaw) : 1;
  // THE SUPPORT MAY ONLY LOWER. On a short pair Jaccard is coarse, so the edit distance is
  // allowed to veto — never to promote a pair Jaccard already doubted.
  const score = shortPair ? Math.min(j, lev) : j;

  const diff = symmetricDifference(A, B);
  const flips = Array.from(flipTokensIn(diff)).sort();

  // ── THE VETO, WHICH RUNS FIRST AND RUNS ALWAYS (قرار ٢ / P3-C) ────────────
  // Deliberately ABOVE the threshold test. «قصر الصلاة للمسافر» vs «قصر الصلاة للمقيم» scores
  // above 0.9 on any word measure, and a check that only ran below a threshold would never see
  // the one case it exists for. A flip token in the difference means the two questions differ in
  // a way the arithmetic cannot see — so the arithmetic does not get to decide.
  if (flips.length) {
    return {
      // A named scope-changing qualifier is already the answer to the judge's question. Asking a
      // one-way judge could only rescue the page-only direction; deterministic knowledge must
      // refuse both directions without spending a model call.
      verdict: TRANSFER.NO,
      score, jaccard: j, lev, flips,
      reason: 'flip-token in the difference: ' + flips.join(' '),
    };
  }

  if (score >= TRANSFER_MATCH) {
    return { verdict: TRANSFER.TRANSFER, score, jaccard: j, lev, flips, reason: 'identical after normalisation' };
  }
  if (score >= JUDGE_BAND[0]) {
    return { verdict: TRANSFER.JUDGE, score, jaccard: j, lev, flips, reason: 'inside the judge band' };
  }
  return { verdict: TRANSFER.NO, score, jaccard: j, lev, flips, reason: 'below the judge band' };
}

// ── THE DECISIVE JUDGE (P3-C) ────────────────────────────────────────────────
//
// ONE yes/no question to a fast model, and its wording is the whole design: it does not ask «are
// these the same?» — a model asked that says yes to anything that rhymes. It asks whether the
// EITHER question carries a fiqh qualifier the other does not, which is a symmetric question
// about a specific, checkable difference.
export const JUDGE_QUESTION = 'هل في أحد السؤالين قيدٌ فقهيٌّ ليس في الآخر؟';

export function buildJudgePrompt(readerQuestion, publishedQuestion) {
  return [
    'أجبْ بكلمةٍ واحدةٍ فقط: نعم أو لا.',
    JUDGE_QUESTION,
    '',
    'الأوّل: ' + String(readerQuestion || ''),
    'الثاني: ' + String(publishedQuestion || ''),
  ].join('\n');
}

/**
 * Read the judge's reply.
 *
 * ANY «نعم», AND ANY AMBIGUITY, IS A REFUSAL. The only reply that permits a transfer is an
 * unambiguous «لا». A model that hedged, explained, answered in English or returned nothing has
 * not said the two questions are the same, and the absence of a no is not a yes.
 */
export function judgeAllowsTransfer(replyRaw) {
  const t = foldQuestion(replyRaw);
  if (!t) return false;
  const words = t.split(' ').filter(Boolean);
  // Exactly the one word, or that word leading a short reply. Anything longer is an explanation,
  // and an explanation is a hedge.
  if (words[0] === 'لا' && words.length <= 3) return true;
  return false;
}
