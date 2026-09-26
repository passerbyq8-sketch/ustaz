// lib/takhrij.js — التخريجُ والحاشية (البند ٥٠). خلفَ مفتاحٍ مطفأ.
//
// ── WHY THIS EXISTS, IN ONE SENTENCE ───────────────────────────────────────
// So that a matn ezik quotes from the Prophet ﷺ carries the name of the book it was taken
// out of, and carries it ONLY when the library actually returned that book.
//
// ── AND WHY THE SWITCH IS OFF ──────────────────────────────────────────────
// The owner's §٢-أ: «لو نزل التخريج حيا وهو يكتب من رأس النموذج، لنسب عزك حديثا إلى مسلم
// وليس عنده — وهذه نسبة كاذبة إلى النبي ﷺ، أشد من غياب التخريج كله». So TAKHRIJ_V1 is OFF
// unless a deployment says otherwise, and with it off this module returns the text it was
// handed, byte for byte, having made no call.
//
// ── THE FOUR THINGS THIS FILE MAY NEVER DO ────────────────────────────────
//   1. write a مخرِّج the library did not return        (see composeParenthetical)
//   2. write a grade no ladder grader stated            (see lib/takhrij-ladder.js)
//   3. emit an isnad or an عنعنة                        (no atom text is ever copied out)
//   4. deny a hadith because THIS PASS could not find it (see `silent`, §١ of 19 September)
//
// ── AND THE FOURTH REPLACED ITS OWN OPPOSITE, WHICH IS THE LESSON OF THIS FILE ──
// It read «leave a quoted marfū‘ matn with no parentheses — NOT_RAISED is the floor» until the
// owner read «(لا يثبت مرفوعا)» under three hadiths of the Ṣaḥīḥayn and ruled: «عزك لا ينفي
// بناءً على عجزِه. فشلُ البحثِ خبرٌ عنّا، لا خبرٌ عن النبيِّ ﷺ». A floor that fills itself with a
// denial is not a floor. Where nothing was found, nothing is written and the matn leaves exactly
// as the model wrote it — card and all.
//
// ── WHAT IT DELIBERATELY LEAVES ALONE ──────────────────────────────────────
// §٢-ج: «والنص المنقول حرفيا لا يمس». A shaykh's fatwa or a lesson carried in someone
// else's words keeps his words even when they carry no takhrij. So a quotation whose nearest
// speaker is a named human rather than the Prophet ﷺ is left exactly as it arrived, and every
// card block is stepped over whole — WITH ONE EXCEPTION, ruled by the owner on 19 September and
// built at `hadithCards`: the `<hadith>` card is dissolved into prose in its own place and
// carries its takhrij there. `<verse>` keeps its buttons, `<source>` keeps its provenance, and
// nothing else in the answer moves.
//
// ── AND EVERY PATTERN HERE IS DIACRITIC-TOLERANT, WHICH IS NOT A REFINEMENT ─
// These answers ship vocalised and unvocalised in the same paragraph — «قَالَ النَّبِيُّ»
// and «قال النبي» are the same frame and must match the same way. Patterns are therefore
// BUILT from bare letters by `tolerant()` rather than typed with harakat, because a harakat
// sequence typed by hand is a sequence nobody measured.

import {
  AGREED_UPON, NOT_RAISED, NO_RULING, RULING_BOOK_IDS, SHAYKHAYN_IDS, TAKHRIJ_LADDER_IDS, composeParenthetical,
  isShaykhayn, ladderRowFor,
} from './takhrij-ladder.js';
import { classifyFrozenPhrase, containsFrozenRun } from './frozen-text.js';
import { TAKHRIJ_LADDER_HEAD, asksForGrading } from './policy/takhrij-disclosure.js';

// ── ١١١/٥ · وقيمتُه تُحسَمُ بالقياسِ لا باللفظ ──────────────────────────────
//
// FOUR WAS NEVER MEASURED. It was a ceiling chosen before there was anything to price it
// against, and until ١١١/٣ it was also invisible: the matns above it were dropped with no
// entry and no code. MEASURED on ezik-shamela-20260820, 20 September 2026, over the four
// cap-probe questions of the owner’s own battery (أ) — ٣ الصدقة · ٤ بر الوالدين · ٨ النميمة ·
// ١٠ فضل الجمعة — six matns each, twenty-four in all:
//
//   cap   matns examined   TRUE parentheses   FALSE   HTTP calls   request bytes
//    4          16                15            0          79         19,894
//    6          24                23            0         116         29,617
//    8          24                23            0         116         29,617
//   10          24                23            0         116         29,617
//
// ZERO FALSE PARENTHESES IN EVERY ROW, and that is not read off this module’s own state: each
// parenthetical was re-checked against the index by asking the book it names, ALONE, whether
// any row of it carries that matn. The one matn that stays silent at every value — «إن من أفضل
// أيامكم يوم الجمعة…» — is silent because the search found nothing, not because of the cap.
// That silence is the contract working: «عزك لا ينفي بناءً على عجزِه».
//
// SO SIX IS THE SMALLEST VALUE THE MEASUREMENT EARNS. It examines every matn these questions
// hold; eight and ten examine the same twenty-four, return the same twenty-three, spend the
// same 116 calls and the same 29,617 bytes. They buy nothing at all.
//
// AND THE TIME, WITH BOTH DENOMINATORS NAMED. The pass itself, 36 interleaved samples per
// value so no cap always ran on a warm cache:
//
//   cap    median ms   p95 ms   Δ median
//    4        1,078     1,171      —
//    6        1,332     1,820     +24%
//    8        1,348     1,822     +25%
//   10        1,330     1,819     +23%
//
// The adoption rule prices the increase against «زمنُ الجواب», and an answer is not this pass.
// Measured over the forty real turns of EZIK-RAW-CORPUS-2026-08-19, the median answer takes
// 22,302 ms and the p95 78,032 ms. The +254 ms this cap costs is **+1.1% of a median answer**,
// inside the +15% the rule allows. Both numbers are recorded because they are both true and
// they point different ways: on the pass’s own clock the cost is a quarter, on the reader’s it
// is one part in ninety.
//
// AND ONE PREMISE OF THE ORDER DID NOT SURVIVE MEASUREMENT, so it is corrected here rather
// than repeated: raising the cap DOES raise the number of requests. `runnerLookup` maps over
// the matns and issues one `search_library` per matn per phase, so the four answers went from
// 79 calls to 116 (+47%). The phases are still one round each for the whole answer; it is the
// runner underneath them that is per-matn.
/** At most this many matns are looked up for one answer. See `libraryLookup`. */
export const TAKHRIJ_MAX_MATNS = 6;

// ── AND HOW MANY ROWS OF ONE ANSWER ARE READ (§٣-٢ OF THE SILENCE ORDER) ───
//
// THE OWNER LIFTED THE DEFERRAL HIMSELF, for this path and for no other: «حدٌّ خاصٌّ بمسارِ
// التخريجِ يبلغُ ١٠ … والثابتُ المشترَكُ مع مسارِ النموذجِ يبقى ٥ لا يُمَسّ». Ten is not a
// number chosen here: it was what lib/lib-contract.js's `LIB_LIMIT_MAX` made the service return
// and what lib/free-brain/tools.js was throwing half of away. See the measurement at `cap` there.
// R1 (brain-night 2026-09-24): TEN CROWDED. One takhrij volume (إرواء الغليل ×7-8) filled the one
// ladder call and the highest book that narrates the matn never reached the rows — «(البيهقي · صحيح)»
// where مالك narrates it (H02), «(الضياء · صحيح)» where ابن خزيمة does (H04-b); six lower-book
// brackets in 43 graded answers. The service's own ceiling is 50 (EZIK-LIB service/src/contract.mjs
// MAX_LIMIT); thirty rows over ten distinct books were measured on the twin of the production index.
// Thirty, with LIB_LIMIT_MAX raised to let it through. The model's own five is untouched, and the
// ladder call is still ONE (§6-2).
/** How many library rows the takhrij path reads per call. The model's own five is untouched. */
export const TAKHRIJ_ROWS_PER_CALL = 30;

/** The problem codes, named once so a guard pins them rather than a wording. */
export const TAKHRIJ_UNSOURCED = 'TAKHRIJ_UNSOURCED';
export const TAKHRIJ_ISNAD_REFUSED = 'TAKHRIJ_ISNAD_REFUSED';
// A Companion WAS named by the library and was still not written, because only one book
// named him. It is a distinct code from «nothing was found»: the difference between the two
// is the difference between a silent library and a ruling this pass made on purpose.
export const TAKHRIJ_COMPANION_UNCONFIRMED = 'TAKHRIJ_COMPANION_UNCONFIRMED';
// §٣ — there was NO position in the sentence where the parentheses could stand without cutting
// it in half, so nothing at all was written and the matn stayed as the model wrote it. It is a
// ruling and not a failure: «جوابٌ لا يُقرَأُ أسوأُ من جوابٍ بلا تخريج».
export const TAKHRIJ_NO_SLOT = 'TAKHRIJ_NO_SLOT';
// §١ — THE SEARCH FAILED, SO NOTHING WAS WRITTEN. It is deliberately a DIFFERENT code from
// `TAKHRIJ_UNSOURCED`, which now means only «a ruling was found and it was a denial»: the two
// were one code while they were one behaviour, and telling them apart is the whole item.
export const TAKHRIJ_SILENT = 'TAKHRIJ_SILENT';
// §٢ — one matn stood twice in one answer, once inside the prose and once as a card of its own,
// and the card was dropped so the reader meets it once, in the sentence that introduces it.
export const TAKHRIJ_DUPLICATE_DROPPED = 'TAKHRIJ_DUPLICATE_DROPPED';
// §٢ of the final order — the prose around the matn already NAMES who published it, so
// nothing of ours is injected beside it. It is neither a failure nor a denial: the reader has an
// attribution, and a second one from us would only tell him two different books at once.
export const TAKHRIJ_PROSE_ATTRIBUTION = 'TAKHRIJ_PROSE_ATTRIBUTION';
// م٣-د (FULL_ANSWER_V1) — the bracket stood down because the prose beside its matn states a grade and
// the bracket could only have said «لم يوقف على حكم» against it.
export const TAKHRIJ_PROSE_GRADE = 'TAKHRIJ_PROSE_GRADE';
// B2 (FULL_ANSWER_V1) — a Companion the model wrote in front of a matn was taken out (no book named him there).
export const TAKHRIJ_MODEL_COMPANION_REMOVED = 'TAKHRIJ_MODEL_COMPANION_REMOVED';
// B2 — ...and one that was KEPT, because taking it out would not leave a whole frame. And then the
// book's own name is not written beside it either: one opener, never two.
export const TAKHRIJ_MODEL_COMPANION_KEPT = 'TAKHRIJ_MODEL_COMPANION_KEPT';
// D3A H1 — a direct-speech frame was not proved by a confirmed atom and became a narration frame.
export const TAKHRIJ_NARRATOR_FRAME = 'TAKHRIJ_NARRATOR_FRAME';
// The order-B review (D61) measured the removal breaking sentences: «وفي حديث X … أن النبي» became «وفي أن
// النبي», «روى مسلم عن X … قال: قال رسول الله» lost its verb's object, «وقد سئل عن الأمر فأجاب X …» lost
// words that were not the opener; and a pronoun left pointing at nobody («قال له»، «أخذ بمنكبه»، «قال لي»).
// So the opener leaves only where it stands at a clean left edge (the sentence's start, a colon, or after
// «ما جاء / ورد / روي / ذلك / ومنه») and what follows it, up to the matn, is nothing but the frame
// «(قال|أن|عن) رسول الله/النبي ﷺ (قال|يقول):». Anything else and the model's text stays as it is.
const B2_BEFORE_OPENER_RE = /(?:^|:|(?:^|\s)(?:جاء|ورد|روي|ذلك|ومنه))\s*$/u;
const B2_AFTER_OPENER_RE = /^\s*(?:و?قال|يقول|أن|عن)?\s*(?:رسول الله|النبي|الرسول)\s*(?:\uFDFA|صلى الله عليه وسلم|عليه الصلاة والسلام)?\s*(?:(?:و?قال|يقول)\s*)?[:：]?\s*[«"]?\s*$/u;
// A Companion with the prayer still standing in a matn's lead-in.
const B2_PRAYER_IN_LEAD_RE = /رضي\s*الله\s*(?:تعالى\s*)?عن(?:هما|هم|ها|ه)(?![\u0621-\u064A])/u;
// ١١١/٣ — THE CAP WAS REACHED, AND THE MATNS ABOVE IT WERE NEVER LOOKED UP. Until today this
// was the one exit of this pass that wrote NOTHING ANYWHERE: `targets.slice(0, TAKHRIJ_MAX_MATNS)`
// dropped the fifth matn of an answer with no entry, no problem code and no line of trace, so
// a reader who asked for six hadiths and got four takhrij could not be told apart from a reader
// whose library went quiet. It is a RULING and not a failure — the cap is deliberate — and a
// ruling nobody can see is indistinguishable from a bug.
export const TAKHRIJ_CAP_REACHED = 'TAKHRIJ_CAP_REACHED';
// ١١١/٣ — THE TURN WAS STREAMED, SO THE PASS STOOD DOWN. api/ask.js has always recorded this
// as `takhrij:inside_emitted_bytes`, borrowed from the ascription door; that name says WHERE the
// pass found itself and not WHAT happened to the takhrij. The code is declared here, with the
// other exits that write nothing, so the two can be counted together. The borrowed name is kept
// beside it and not replaced: three guards read it.
export const TAKHRIJ_SKIPPED_STREAMED = 'TAKHRIJ_SKIPPED_STREAMED';

// ── THE SWITCH ──────────────────────────────────────────────────────────────
//
// READ IT LIKE FREE_BRAIN_V1 AND STREAM_V1 (lib/free-brain/flag.js): an unrecognised value
// is OFF, never a guess, and there is no environment that opens it by default. This one
// guards a PATH whose output is a claim about the Prophet ﷺ; a typo must never be what
// turns that path on.
//
//   TAKHRIJ_V1=on|true|1     this deployment writes takhrij
//   TAKHRIJ_V1 anything else OFF, including unset
/**
 * @param {object} env  process.env, injectable so a test states the environment.
 * @returns {{enabled:boolean, reason:string}}  `reason` is telemetry only.
 */
export function takhrijDecision(env = process.env) {
  const raw = String((env && env.TAKHRIJ_V1) ?? '').trim().toLowerCase();
  if (raw === 'on' || raw === 'true' || raw === '1') return { enabled: true, reason: 'env_on' };
  if (raw === '') return { enabled: false, reason: 'unset_default_off' };
  if (raw === 'off' || raw === 'false' || raw === '0') return { enabled: false, reason: 'env_off' };
  return { enabled: false, reason: 'env_malformed' };
}

/** The default, stated as a value so a test asserts it rather than infers it. */
export const TAKHRIJ_V1_DEFAULT = false;

// ── READING THE ANSWER ──────────────────────────────────────────────────────

// The card vocabulary, written out rather than imported: this module must stay drivable by
// a guard with no reviewer in the process. It is the same list lib/output-reviewer.js:419
// holds and the same one app.jsx:14716 parses, plus `book`.
const CARD_NAMES = 'verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship|book';
const CARD_BLOCK_RE = new RegExp(`<(${CARD_NAMES})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>|<\\/?(?:${CARD_NAMES})\\b[^>]*>`, 'giu');

const DIACRITIC_CLASS = '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]';
const DIACRITICS_RE = new RegExp(DIACRITIC_CLASS, 'gu');

// ── AND PUNCTUATION IS NOT PART OF A MATN, WHICH COST THREE HADITHS ────────
//
// MEASURED on the live index (ezik-shamela-20260820) on 19 September 2026, and it is the second
// cause under §١'s three false denials. صحيح مسلم carries «أحي والداك» like this:
//
//     «أَحَيٌّ وَالِدَاكَ؟» قَالَ: نَعَمْ، قَالَ: «فَفِيهِمَا فَجَاهِدْ»
//
// with the book's own quotation marks INSIDE the narration, and the model writes it without
// them. `atomCarriesMatn` compares the two folded strings, so one «»» in the middle of مسلم's
// own wording was enough to make مسلم «not carry» a hadith that is in مسلم — and with البخاري
// failing the same way, a hadith of the Ṣaḥīḥayn came back unfound and was denied.
//
// SO THE MARKS GO, AND ONLY THEM. Every letter still has to match, in order, whole: this widens
// no claim and admits no near neighbour. The marks become a SPACE rather than nothing, so that
// «قال:نعم» can never be read as one word.
const PUNCTUATION_RE = /[.,،؛:!?؟"'()[\]{}«»”“‘’—–_/\\*#-]/gu;

// R2 (brain-night 2026-09-24) — THE HAMZA IS ONE LETTER ON THREE SEATS. ؤ was folded to و and ئ to
// ي, each on its own, so «المسؤول» in the model's rasm and «المسئول» as البخاري 50 and مسلم 9 print
// it never met, and «ما المسؤول عنها بأعلم من السائل» — a hadith of the Ṣaḥīḥayn — left as
// «(ابن حبان · لم يوقف على حكم)» (H03-b, reproduced on the twin of the production index). The seat
// of a hamza is orthography, not a letter: ء · ؤ · ئ fold to ONE class. A hamza that is missing
// altogether is still a different word, and ى → ي stays as it was. Comparison only, as before.
/** Diacritics, tatweel and punctuation off, alef/hamza/ya/ta-marbuta unified. Comparison only. */
export function foldArabic(value) {
  return String(value == null ? '' : value)
    .replace(DIACRITICS_RE, '')
    .replace(PUNCTUATION_RE, ' ')
    .replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627')
    .replace(/[\u0624\u0626]/gu, '\u0621')
    .replace(/\u0649/gu, '\u064A')
    .replace(/\u0629/gu, '\u0647')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Diacritics off only — the shape a NAME leaves this module in. */
export function bareArabic(value) {
  return String(value == null ? '' : value).replace(DIACRITICS_RE, '').replace(/\s+/gu, ' ').trim();
}

/**
 * A pattern source matching `plain` however it is vocalised: any harakat between any two
 * letters, and a run of whitespace wherever `plain` has a space. Alef and ya are accepted
 * in every spelling, because the answers mix them and a frame is not a spelling.
 */
export function tolerant(plain) {
  const chars = [...String(plain)];
  const out = [];
  for (const char of chars) {
    if (/\s/u.test(char)) { out.push('\\s+'); continue; }
    if ('\u0627\u0622\u0623\u0625\u0671'.includes(char)) { out.push('[\\u0627\\u0622\\u0623\\u0625\\u0671]'); }
    else if ('\u064A\u0649\u0626'.includes(char)) { out.push('[\\u064A\\u0649\\u0626]'); }
    else if ('\u0647\u0629'.includes(char)) { out.push('[\\u0647\\u0629]'); }
    else { out.push(char.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')); }
    out.push(DIACRITIC_CLASS + '*');
  }
  return out.join('');
}

const alternation = (words) => '(?:' + words.map(tolerant).join('|') + ')';

// THE PROPHET, NAMED THE WAY THE ANSWERS NAME HIM.
const PROPHET_WORDS = [
  'النبي', 'الرسول', 'رسول الله', 'صلى الله عليه وسلم', 'عليه الصلاة والسلام', 'صلعم',
];
const PROPHET_FRAME_RE = new RegExp('(?:' + alternation(PROPHET_WORDS) + '|\uFDFA)', 'gu');
// [b17] — «حديث» written straight before the quotation it names (see proseSpans).
const HADITH_WORD_FRAME_END_RE = new RegExp('(?:^|[^\\u0621-\\u064A])(?:[وفبل])?(?:' + tolerant('حديث') + '|' + tolerant('الحديث') + ')\\s*[:：]?\\s*$', 'u');

// A HUMAN SPEAKER WHO IS NOT HIM. When one of these stands between the prophetic frame and
// the quotation, the words belong to that man and §٢-ج forbids touching them.
const HUMAN_CREDIT_WORDS = [
  'قال الشيخ', 'قال الإمام', 'قال ابن', 'قال النووي', 'قال الألباني', 'قال العلامة',
  'قال الحافظ', 'وقال الشيخ', 'وقال ابن', 'يقول الشيخ', 'قال الدكتور', 'قال المفتي',
  'ونقل', 'وأفتت', 'قالت اللجنة',
];
// ── BATCH 4 [b43] · A PHRASE IS MATCHED AS WORDS, NEVER AS LETTERS INSIDE A WORD ─────────────
// MEASURED at 92d3c7d: «قال ابنُه» read as «قال ابن» — the son of the man in the sentence became a
// human speaker, and the Prophet's ﷺ words after it went untouched as his. r13's rule for a name
// is the rule for these phrases too: at most a «و» or «ف» in front, and no letter (and no harakat
// that would carry one) straight after.
const WORD_START = '(?<![\\u0621-\\u064A])[وف]?';
const WORD_END = '(?![\\u0621-\\u0652\\u0670])';
const HUMAN_CREDIT_RE = new RegExp(WORD_START + alternation(HUMAN_CREDIT_WORDS) + WORD_END, 'gu');

// The verb that introduces the matn, so the lead-in is replaced whole rather than left
// half-standing in front of the Companion's name.
const LEAD_VERB_WORDS = ['قال', 'وقال', 'فقال', 'يقول', 'روى', 'وروى', 'أخرج', 'وأخرج', 'عن', 'وعن', 'ففي', 'وفي'];
const LEAD_VERB_RE = new RegExp('(?:^|[\\s،؛:])(' + alternation(LEAD_VERB_WORDS) + ')(?=[\\s،؛:])', 'gu');

// «…» and “…”. A matn ezik writes is quoted; one it does not quote it is not asserting as a
// verbatim text, and §٢-ج scopes this whole contract to «كل مرفوع يُنقل بلفظه».
const QUOTE_RE = /\u00AB([^\u00AB\u00BB]{2,900})\u00BB|\u201C([^\u201C\u201D]{2,900})\u201D/gu;

// \u2500\u2500 AND THE FLOOR IS MEASURED ON THE BARE LETTERS, WHICH IS NOT A DETAIL \u2500\u2500\u2500\u2500
//
// MEASURED on 19 September 2026 against the owner's own trial. \u00AB\u0627\u0644\u062D\u0645\u0648 \u0627\u0644\u0645\u0648\u062A\u00BB went out with no
// takhrij at all, and the cause was this floor: the pattern used to demand 12 characters INSIDE
// the quotation marks, and that matn is 11 characters unvocalised \u2014 and 17 with its harakat. So
// the same hadith was takhrij'd or not depending on whether the model happened to vocalise it,
// which is a lottery and not a rule.
//
// AND A CHARACTER COUNT WAS THE WRONG UNIT EVEN FOLDED. \u00AB\u0627\u0644\u062D\u062C \u0639\u0631\u0641\u0629\u00BB \u2014 the matn he read as
// \u00AB(\u0627\u0644\u0628\u064A\u0647\u0642\u064A)\u00BB \u2014 is NINE bare characters, and it is a whole hadith. The unit a narration is
// measured in is WORDS: two words are a matn, one quoted word is a word being discussed. The
// character floor stays only to keep a fragment like \u00AB\u0627 \u0628\u00BB out of a library call.
//
// THIS IS NOT THE \u00A7\u0665-\u0665 ITEM of the design draft. That one is the SERVICE's difficulty in
// phrase-matching a two-word matn, and it is still open and still recorded.
const MIN_MATN_BARE_WORDS = 2;
const MIN_MATN_BARE_CHARS = 6;

/** Long enough to be a narration rather than a quoted word. Read on the bare letters. */
function longEnoughToBeAMatn(inner) {
  const bare = bareArabic(inner);
  if (bare.length < MIN_MATN_BARE_CHARS) return false;
  return bare.split(' ').filter(Boolean).length >= MIN_MATN_BARE_WORDS;
}

// ── [111-b4b-61] · A SHORT QUOTATION IS BRACKETED ONLY AS A WHOLE MATN ─────────────────────
//
// MEASURED at eca359e (production) with fixed drafts through this pass and the library twin, no
// model: «كان النبي ﷺ يوتر «كل ليلة»» left as «(مسلم)», and the atom that «proved» it is Muslim's
// chapter on dividing the nights between wives. Three words did no better: «إن الله يحب» took
// «(البخاري)» from an unrelated narration under a sentence about the weak hadith of itqān, «في
// الدنيا والآخرة» took «(مسلم)» from 2699 under a sentence about the parents, and «إلى يوم
// القيامة» took «(متفق عليه)» from the hadith of the horses under a sentence about repentance.
// `atomCarriesMatn` asks whether the atom CONTAINS the words, and a phrase this short is contained
// in narrations that are not the one the prose is quoting. None of the eleven quotations of four
// words or more measured beside them was bracketed off a narration it is not.
//
// CLAUDE'S RULING, with its floor raised as it directs («رُفِعَ الحدُّ فوقَ أطولِه»): a quotation
// under SHORT_QUOTE_WORDS words is bracketed only where the prose presents it as a hadith AND the
// atom's own quoted matn IS that quotation, whole — never an atom that merely holds it. The first
// half is `findMatns` as it stands (the Prophet ﷺ in its sentence, «حديث «…»» [b17], or the head
// matn [b25] that is put on the locked shape); this is the second half. At and above the floor
// nothing moves. It can only take a book away; the price is silence, and it is counted.
export const SHORT_QUOTE_WORDS = 4;
export function isShortQuote(matn) {
  return foldArabic(matn).split(' ').filter(Boolean).length < SHORT_QUOTE_WORDS;
}
// The atom's quoted spans — «…», “…” and "…" — folded; a short matn is proved by one that equals it
// AND that the atom gives to the Prophet ﷺ in the words just before it, or that opens a grader's
// entry. MEASURED on the twin: the one span in Ibn Abī Shayba that is exactly «الطهور شطر الإيمان»
// is ʿAlī's own saying («حدثنا علي أن «الطهور شطر الإيمان»»), and without this rule it replaced a
// true «(مسلم)» with that book.
const ATOM_QUOTE_RE = /\u00AB([^\u00AB\u00BB]+)\u00BB|\u201C([^\u201C\u201D]+)\u201D|"([^"]+)"/gu;
const ATOM_MARFU_WINDOW = 80;
const ATOM_MARFU_RE = /(?:^| )(?:رسول الله|النبي|صلي الله عليه وسلم)(?= |$)|\uFDFA/u;
export function atomMatnIs(atomText, matn) {
  const needle = foldArabic(matn);
  // R3 (brain-night 2026-09-24) — THE WINDOW IS MEASURED ON THE LETTERS, NOT THE VOWELS. The
  // eighty characters before a quotation were sliced off the atom as printed, and a fully vocalised
  // Ṣaḥīḥ spends half of them on tashkīl: in البخاري 1986 the frame before «أَصُمْتِ أَمْسِ» is 106
  // characters vocalised and 64 bare, so البخاري «did not present it as the Prophet's ﷺ» and the
  // bracket fell to النسائي (H04-b, reproduced on the twin). The diacritics come off the atom
  // first; the quotation marks, the folded comparison and the window's width are as they were.
  const atom = String(atomText || '').replace(DIACRITICS_RE, '');
  if (!needle) return false;
  ATOM_QUOTE_RE.lastIndex = 0;
  let q;
  while ((q = ATOM_QUOTE_RE.exec(atom)) !== null) {
    if (foldArabic(q[1] !== undefined ? q[1] : q[2] !== undefined ? q[2] : q[3]) !== needle) continue;
    const before = atom.slice(Math.max(0, q.index - ATOM_MARFU_WINDOW), q.index);
    // ...or a grader's entry: its number, then its matn («3913 - «…» . (صحيح)»، «36 - " … ". ضعيف»).
    if (ATOM_MARFU_RE.test(foldArabic(before)) || /(?:^|\s)\d+\s*-?\s*$/u.test(before)) return true;
  }
  return false;
}

/** A sentence boundary, so a frame from the PREVIOUS sentence cannot claim this quotation. */
const BOUNDARY_RE = /[.!؟\n]/gu;

function lastIndexOfPattern(haystack, re) {
  re.lastIndex = 0;
  let at = -1;
  let match;
  while ((match = re.exec(haystack)) !== null) {
    at = match.index;
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return at;
}

function firstMatchOfPattern(haystack, re) {
  re.lastIndex = 0;
  return re.exec(haystack);
}

// ── BATCH 4 [b25] · THE MATN AT THE HEAD OF THE ANSWER ───────────────────────────────────────
// MEASURED at 92d3c7d: an answer that opens on «الطهور شطر الإيمان». — the quotation alone on the
// first line, no «قال ﷺ» in front of it — gave ZERO targets and left with no parentheses, while the
// same matn behind «قال رسول الله صلى الله عليه وسلم:» gave «(مسلم)». The owner's
// contract: a matn opening the answer is framed on the locked shape with what the atom proves, and
// no speaker and no narrator is invented. So it becomes a target with its lead-in at its own opening
// mark: the Companion opener stands in front of it only where two books agree on him (the pass's own
// rule), the parentheses only what the library proved, and a failed search writes nothing.
// NARROW ON PURPOSE: the first thing in the answer, the whole of its line (an end mark at most after
// it), and holding no āyah and no known dhikr, nor any run of one — those carry their own proven
// attributions, and a verse quoted inside some hadith's atom is not that hadith.
const HEAD_LINE_REST_RE = /^[\s.!؟،]*?(?:\n|$)/u;
function opensTheAnswer(value, start, end, inner) {
  if (value.slice(0, start).trim()) return false;
  if (!HEAD_LINE_REST_RE.test(value.slice(end))) return false;
  return !classifyFrozenPhrase(inner) && !containsFrozenRun(inner);
}

/**
 * The spans of `text` that are prose — every card block stepped over whole.
 * @returns {Array<{start:number, end:number}>}
 */
export function proseSpans(text) {
  const value = String(text == null ? '' : text);
  const spans = [];
  let cursor = 0;
  CARD_BLOCK_RE.lastIndex = 0;
  let match;
  while ((match = CARD_BLOCK_RE.exec(value)) !== null) {
    if (match.index > cursor) spans.push({ start: cursor, end: match.index });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) spans.push({ start: cursor, end: value.length });
  return spans;
}

/**
 * Every quoted marfū‘ matn in the PROSE of an answer, in the order it appears.
 *
 * `leadStart` is where the lead-in that introduces the matn begins — «قال النبي ﷺ:» and the
 * like. It is offered so the composer can replace the lead-in when it has a Companion to put
 * in its place; with no Companion the lead-in must STAY, because deleting it would take the
 * ascription to the Prophet ﷺ away with it.
 *
 * @returns {Array<{matn:string, start:number, end:number, leadStart:number, quoted:string}>}
 */
export function findMatns(text) {
  const value = String(text == null ? '' : text);
  const out = [];
  for (const span of proseSpans(value)) {
    const chunk = value.slice(span.start, span.end);
    QUOTE_RE.lastIndex = 0;
    let match;
    while ((match = QUOTE_RE.exec(chunk)) !== null) {
      const inner = match[1] !== undefined ? match[1] : match[2];
      // The floor, on the bare letters — see longEnoughToBeAMatn.
      if (!longEnoughToBeAMatn(inner)) continue;
      // [111-b4b-50] — A QUOTATION THAT IS WHOLLY QUR'AN IS NO HADITH, WHATEVER STANDS BEFORE IT. MEASURED at
      // eca359e: «وقد أمر النبي ﷺ بالزكاة، قال الله تعالى: «وأقيموا الصلاة وآتوا الزكاة».» left as «(متفق
      // عليه)», and three more āyāt the same way, because the Prophet ﷺ named earlier in the sentence
      // made the verse a target. An āyah carries its own attribution and is frozen: never bracketed.
      const frozenWhole = classifyFrozenPhrase(inner);
      if (frozenWhole && frozenWhole.kind === 'quran') continue;
      const at = span.start + match.index;
      // The sentence this quotation stands in, and nothing before it.
      const before = chunk.slice(0, match.index);
      const boundary = lastIndexOfPattern(before, BOUNDARY_RE);
      const segment = before.slice(boundary + 1);
      const segmentAt = span.start + boundary + 1;

      // AND HE MUST BE THE LAST SPEAKER NAMED. A quotation introduced by «وقال ابن باز» in a
      // sentence that also mentions the Prophet ﷺ is that man's sentence, not a matn.
      // BATCH 4 [b17] — «حديث «…»» IS A MATN'S OWN FRAME. MEASURED at 2aaf987 and 92d3c7d (EZIK-CX-M111
      // row 17): «حديث «اطلبوا العلم ولو بالصين».»، «حديث «إنما الأعمال بالنيات».» and «حديث «من حسن
      // إسلام المرء…».» gave ZERO targets and left with no parentheses, while the same matns after
      // «قال رسول الله ﷺ:» gave one each. The owner's contract: «حديث «…»» is the form of a matn. The
      // word counts only where it stands IMMEDIATELY before the quotation («حديث»، «الحديث»،
      // «بحديث»، «لحديث»، «وحديث»، a colon allowed) — a «حديث» anywhere earlier in the sentence is a
      // word about a hadith, and a speaker named after it is still the last speaker named.
      // Its lead-in is never replaced: the words before «حديث» are the answer's own sentence
      // («واستدلوا بحديث «…»»), and replacing them would break it.
      const hadithFrame = HADITH_WORD_FRAME_END_RE.exec(segment);
      const lastFrame = hadithFrame ? segment.length - 1 : lastIndexOfPattern(segment, PROPHET_FRAME_RE);
      if (lastFrame < 0) {
        // BATCH 4 [b25] — the quotation that OPENS the answer, standing alone on its line.
        if (opensTheAnswer(value, at, at + match[0].length, inner)) {
          out.push({
            matn: inner.trim(), quoted: match[0], start: at, end: at + match[0].length, leadStart: at,
            kind: 'prose', head: true,
          });
        }
        continue;
      }
      const lastHuman = lastIndexOfPattern(segment, HUMAN_CREDIT_RE);
      if (lastHuman > lastFrame) continue;

      // The lead-in starts at the verb IMMEDIATELY in front of the frame — the LAST one at or
      // before it, never the first. MEASURED: taking the first swallowed a whole earlier
      // hadith when two stood in one sentence, and shipped the two spliced together.
      // Anything before that point is the answer's own prose and is untouched.
      let leadStart = hadithFrame ? at : segmentAt + lastFrame;
      LEAD_VERB_RE.lastIndex = 0;
      let verb;
      while (!hadithFrame && (verb = LEAD_VERB_RE.exec(segment)) !== null) {
        const verbAt = verb.index + verb[0].indexOf(verb[1]);
        if (verbAt <= lastFrame) leadStart = segmentAt + verbAt;
        if (verb.index === LEAD_VERB_RE.lastIndex) LEAD_VERB_RE.lastIndex += 1;
      }
      out.push({
        matn: inner.trim(), quoted: match[0], start: at, end: at + match[0].length, leadStart,
        kind: 'prose',
      });
    }
  }
  return out;
}

// ── THE HADITH CARD IS DISSOLVED INTO PROSE, AND IT IS THE ONLY ONE THAT IS ─
//
// THE OWNER'S OWN WORDS, د-٨, and they are not the ruling this file was first built on:
//
//   «حديثٌ يُكتَبُ كاملًا وسطَ الكلامِ لا بطاقة، وفي طرفِه … والبطاقاتُ الباقيةُ مثلَ ما هي.»
//
// The first revision read §٢-ج's «الحديث نثرا في المتن لا في بطاقة» as «takhrij the prose and step
// over the cards», and shipped exactly what the owner then measured with his finger: «إنما الأعمال
// بالنيات» and «الزمها فإن الجنة عند رجلها» both sat inside a `<hadith>` card and went out with no
// takhrij at all. The ruling is the other one: the CARD GOES and the hadith becomes prose in its
// own place, carrying its takhrij.
//
// AND EVERY OTHER CARD IS UNTOUCHED, WHICH IS HALF THE RULING. `<verse>` keeps its buttons — احفظ
// الآية، استمع للتلاوة — and `<source>` keeps its provenance. `proseSpans` above still steps over
// all of them whole; this function names the one exception and nothing more.
//
// ── IT IS A RENDERING AND NOT AN INVENTION (§١'S UNBREAKABLE CONSTRAINT) ────
// Not one letter is added to the matn and not one is taken out of it. The card's OWN attributes —
// `narrator` and `ruling` — are dropped rather than printed, because they are what the model
// remembered and the parentheses are what the library proved. That is the same rule the prose path
// already obeys, applied to a field instead of a sentence.
const HADITH_CARD_RE = /<hadith\b([^>]*)>([\s\S]*?)<\/hadith\s*>/giu;
const GUILLEMETS_RE = /^«([\s\S]*)»$/u;

/**
 * Every `<hadith>` card in an answer, as a takhrij target in the card's own offsets.
 *
 * `matn` is the card's body with nothing added and nothing removed; a body the model already
 * wrapped in «…» is not wrapped twice.
 *
 * @returns {Array<{matn:string, quoted:string, start:number, end:number, leadStart:number,
 *                  kind:'card', attrs:string}>}
 */
export function hadithCards(text) {
  const value = String(text == null ? '' : text);
  const out = [];
  HADITH_CARD_RE.lastIndex = 0;
  let match;
  while ((match = HADITH_CARD_RE.exec(value)) !== null) {
    const body = String(match[2]).trim();
    const inner = GUILLEMETS_RE.exec(body);
    const matn = (inner ? inner[1] : body).trim();
    if (!longEnoughToBeAMatn(matn)) continue;
    out.push({
      matn,
      quoted: match[0],
      start: match.index,
      end: match.index + match[0].length,
      // A card has no lead-in to replace: it IS the whole block, so the Companion's opener
      // stands where the card stood and takes nothing else with it.
      leadStart: match.index,
      kind: 'card',
      attrs: String(match[1] || ''),
    });
  }
  return out;
}

// ── AND ONE MATN MAY NOT REACH THE READER TWICE (§٢ OF THE SILENCE ORDER) ──
//
// WHAT THE OWNER SAW, on his own preview, with his own finger:
//
//     …فقال له: «الزمها، فإن الجنة عند رجليها» (لا يثبت مرفوعا).
//     «الزمها، فإن الجنة عند رجليها» (لا يثبت مرفوعا)
//
// HIS RULE WAS «قِسْها ولا تفترضْها», and the measurement is in `_probe\side50\08-before-silence`:
// the model wrote the narration in its sentence AND repeated it in a `<hadith>` card underneath,
// which is a shape lib/system-prompt.js positively asks for. While the card stayed a card the
// duplication was a card under a sentence; dissolving it into prose made it a naked second copy
// of the same line — so the defect is ours and it is closed here.
//
// THE SURVIVOR IS THE ONE IN THE SENTENCE, in his words: «ويكونُ الذي في سياقِ الجملةِ هو
// الباقي». The card is dropped whole, its offsets are recorded, and no prose is ever deleted.
/** The two matns are the same narration, compared on folded letters in either direction. */
function sameMatn(a, b) {
  const one = foldArabic(a);
  const two = foldArabic(b);
  if (!one || !two) return false;
  return one === two || one.includes(two) || two.includes(one);
}

/**
 * Every matn this pass may rewrite, in the order the reader meets it: the quoted marfū‘ matns of
 * the PROSE, and the `<hadith>` cards that become prose.
 *
 * A card whose narration the prose already carries is NOT among them: it is returned separately
 * so the caller can drop the block it stands in.
 *
 * @returns {{targets:Array<object>, duplicates:Array<object>}}
 */
export function findTargets(text) {
  const prose = findMatns(text);
  const targets = [...prose];
  const duplicates = [];
  for (const card of hadithCards(text)) {
    if (prose.some((one) => sameMatn(one.matn, card.matn))) duplicates.push(card);
    else targets.push(card);
  }
  targets.sort((a, b) => a.start - b.start);
  duplicates.sort((a, b) => a.start - b.start);
  return { targets, duplicates };
}

// ── AND THE PARENTHESES MAY NOT CUT A SENTENCE IN HALF (§٣) ─────────────────
//
// MEASURED ON THE OWNER'S SCREEN, 19 September 2026:
//
//   «…لكن هذا لا يعني أن اللفظ المشهور «اختلاف أمتي رحمة» (لا يثبت مرفوعا) حديث عن النبي…»
//
// The matn there is a مضاف إليه inside a sentence that keeps going, so the parentheses landed
// between a subject and its predicate and the sentence stopped being readable. His rule: «التخريج
// زيادة بيان لا نقص فهم. جوابٌ لا يُقرَأ أسوأ من جوابٍ بلا تخريج.»
//
// THE THREE CASES, IN THIS ORDER:
//   1. a stop already follows the closing mark      -> attach there, the clause is closed
//   2. the quotation is مقول القول — a colon or a verb of saying stands right in front of it —
//      so the quoted utterance is itself complete   -> attach there
//   3. anything else                                -> defer to the sentence's own first full
//      stop; and if there is none before the next matn, attach NOTHING AT ALL
//
// Case 3's floor is the owner's §٣/٢ in as many words: «فإن تعذّرَ موضعٌ سليمٌ ⟸ لا تحقنْ شيئًا
// ألبتّة. متنٌ بلا تخريجٍ أهونُ من جملةٍ مكسورة.»

/** A full stop: where a deferred parenthetical may be attached. */
const FULL_STOP_RE = /[.!؟\n]/u;
/** What may follow the closing mark for the parentheses to attach to it directly. */
const CLOSED_CLAUSE_RE = /^\s*(?:[.!؟\n،؛:)\]»”]|$)/u;
/** The colon of a quotation, and the verbs that introduce one. */
const SAYING_LEAD_RE = new RegExp(
  '(?:[:：]|' + alternation(['قال', 'وقال', 'فقال', 'يقول', 'ويقول', 'نصه', 'ولفظه', 'بلفظ'])
  + ')\\s*$', 'u',
);

/**
 * Where the parentheses of one matn may stand, or -1 when nowhere safe.
 *
 * @param {string} text     the answer
 * @param {{start:number,end:number}} target  the matn's quotation, in `text`'s offsets
 * @param {number} ceiling  the offset the next matn starts at, or -1 when this is the last one.
 *                          A deferred parenthetical may never cross it: it would land against
 *                          somebody else's matn.
 * @returns {{at:number, deferred:boolean}|null}
 */
export function parentheticalSlot(text, target, ceiling = -1, { afterQuote = false } = {}) {
  const value = String(text == null ? '' : text);
  const after = value.slice(target.end);
  if (CLOSED_CLAUSE_RE.test(after)) return { at: target.end, deferred: false };
  const before = value.slice(0, target.start).replace(/\s+$/u, '');
  if (SAYING_LEAD_RE.test(before)) return { at: target.end, deferred: false };
  const stop = after.search(FULL_STOP_RE);
  if (stop < 0) return null;
  const at = target.end + stop;
  if (ceiling >= 0 && at > ceiling) return null;
  // م٣-ب (FULL_ANSWER_V1) — «القوسُ الملتصقُ بضدِّه». MEASURED on the owner's b2 (03-answer/measure/
  // B-bracket.md §2): deferred to the sentence's end, «(الضياء في المختارة · صحيح)» landed against
  // «باطلٌ لا يصح، ولا يُبنى عليه حكمٌ شرعي», so the library's grade read as the model's verdict.
  // His order of 24 September: when the matn stands inside a governing sentence, the bracket goes
  // right after the closing mark. It is the same set of matns that today's rule defers, and it
  // still declines where today's rule declines (no stop, or the next matn in the way): only the
  // POSITION changes. `governed` records that this rule placed it.
  if (afterQuote) return { at: target.end, deferred: false, governed: true };
  return { at, deferred: true };
}

// ── AND OUR PARENTHESES MAY NOT CONTRADICT A NAME THE PROSE ALREADY WROTE ─
//
// MEASURED ON THE OWNER’S OWN PREVIEW, 19 September 2026, and it is §٢ of his final order:
//
//     «وإياكم ومحدثات الأمور؛ فإن كل محدثة بدعة، وكل بدعة ضلالة» (ابن حبان · لم يوقف على حكم)
//     أخرجه أبو داود.
//
// Two adjacent lines ascribing ONE matn to two different books — ours out of the library, the
// model’s out of its own prose — and a reader cannot tell which of them to believe.
//
// AND NEITHER SIDE IS PREFERRED OVER THE OTHER, which is the half of the ruling that decides the
// shape of this function: «ولا تحاولِ التوفيقَ بينهما ولا ترجيحَ أحدِهما. الترجيحُ حكمٌ لم نقِسْه.»
// So it reads a POSITION and never a name: it does not compare أبو داود with ابن حبان, it does not
// ask which of them is right, and it draws no conclusion from their disagreeing. It sees that an
// attribution is already standing beside this matn, and it stands down.
//
// THE WINDOW IS HIS «النثرُ حولَ المتن» AND IT IS BOUNDED BY THE NEIGHBOURS. It runs from the
// start of the matn’s own sentence to the end of the sentence AFTER it — «أخرجه أبو داود.» stood
// on a line of its own — and never crosses the previous matn’s end or the next matn’s lead-in,
// which are the same two fences the deferred parenthetical is already held inside. One hadith’s
// attribution may not silence another’s.
//
// AND THE MATN’S OWN WORDS ARE CUT OUT OF THE WINDOW BEFORE IT IS READ. A narration that quotes
// «رواه فلان» inside itself is a book’s sentence, not this answer’s attribution of it.
/** The verbs an answer attributes a narration with. A NAME must follow, or it is not one. */
const ATTRIBUTION_VERB_WORDS = [
  'أخرجه', 'أخرجها', 'أخرجاه', 'أخرجهما', 'خرجه', 'رواه', 'رواها', 'رواهما', 'روياه',
];
/** The attributions that name no book because the phrase IS the book — or both of them. */
const ATTRIBUTION_PHRASE_WORDS = ['متفق عليه', 'في الصحيحين', 'رواه الشيخان', 'أخرجه الشيخان'];
// BATCH 4 [b43] — as words (see WORD_START), and «متفق عليه عند الأئمة الأربعة» / «بين العلماء» is
// the jurists' agreement, not the two Shaykhs': it names no book and silences no takhrij. (Whether
// the agreement is true is the brain session's to measure, not this pass's.)
const JURISTS_AGREEMENT = '(?!\\s+' + alternation(['عند', 'بين']) + '\\s+'
  + alternation(['الأئمة', 'العلماء', 'الفقهاء', 'المذاهب', 'أهل العلم']) + ')';
const ATTRIBUTION_RE = new RegExp(
  WORD_START + '(?:(?:' + alternation(ATTRIBUTION_PHRASE_WORDS) + ')' + WORD_END + JURISTS_AGREEMENT
  + '|(?:' + alternation(ATTRIBUTION_VERB_WORDS) + ')\\s+[\\u0621-\\u063A\\u0641-\\u064A]+)',
  'u',
);

/**
 * The explicit attribution the prose around one matn already carries, or ’’.
 *
 * @param {string} text   the answer
 * @param {{start:number,end:number}} target  the matn, in `text`’s offsets
 * @param {number} floor    the previous matn’s end; the window never reaches behind it
 * @param {number} ceiling  the next matn’s lead-in, or -1; the window never reaches past it
 * @returns {string}  the matched attribution, for the record beside the answer
 */
export function statedAttributionNear(text, target, floor = 0, ceiling = -1) {
  const value = String(text == null ? '' : text);
  const head = value.slice(0, target.start);
  const boundary = lastIndexOfPattern(head, BOUNDARY_RE);
  const from = Math.max(boundary + 1, Number.isInteger(floor) ? floor : 0);
  // Forward through the rest of this sentence AND the whole of the next one.
  const tail = value.slice(target.end);
  let to = value.length;
  const first = tail.search(FULL_STOP_RE);
  if (first >= 0) {
    // AND PAST ANY RUN OF STOPS AND BLANK SPACE, WHICH IS NOT A REFINEMENT. MEASURED on the
    // owner's own case: «أخرجه أبو داود.» stood on a LINE OF ITS OWN, and `FULL_STOP_RE` counts
    // the newline. So the first revision of this window read «.» as the end of the matn's
    // sentence and «\n» as the whole of the next one — two characters, no attribution in them,
    // and the contradiction shipped. An empty span between two boundaries is not a sentence.
    let cursor = first;
    while (cursor < tail.length && /[.!؟\s]/u.test(tail[cursor])) cursor += 1;
    const rest = tail.slice(cursor);
    const second = rest.search(FULL_STOP_RE);
    to = target.end + cursor + (second >= 0 ? second + 1 : rest.length);
  }
  if (ceiling >= 0) to = Math.min(to, ceiling);
  if (to <= from) return '';
  const quoted = value.slice(target.start, target.end);
  // IT IS «النثرُ حولَ المتن» AND A CARD IS NOT PROSE, WHICH IS NOT A QUIBBLE. MEASURED against
  // the guard's own §٢ fixture: the sentence under the prose matn was a `<hadith>` card carrying
  // `narrator="أخرجه البخاري"` — an ATTRIBUTE, never shown to anybody, and about to be dropped as
  // a duplicate — and reading it as the answer's attribution silenced a takhrij the library had
  // proved. `proseSpans` draws this same line everywhere else in this module; the window draws it
  // here. The matn's own quotation goes with them, for the reason above.
  const scanned = value.slice(from, to)
    .replace(CARD_BLOCK_RE, ' ')
    .split(quoted).join(' ');
  const found = ATTRIBUTION_RE.exec(scanned);
  return found ? found[0].trim() : '';
}

// ── م٣-د · THE COLLECTOR'S OWN VERDICT, AND A GRADE THE PROSE STATES ─────────────
//
// Both read FOLDED text (foldArabic: no harakat, no punctuation), so «حسنٌ غريبٌ.» and «حسن غريب»
// are one string. The verdicts are the sound ones al-Tirmidhi writes, longest first; a lone «غريب»
// is a remark on the chain, not a grade (guards/takhrij-contract-guard.cjs B34 keeps it NO_RULING).
const COLLECTOR_VERDICT_RE = /(?:^| )(?:و?هذا حديث|حديث (?:[^ ]+ ){1,3}حديث) (حسن صحيح غريب|حسن صحيح|حسن غريب|صحيح غريب|حسن|صحيح)(?= |$)/u;
/** The verdict al-Tirmidhi writes in his own atom, or ''. */
export function collectorVerdict(atom) {
  const found = COLLECTOR_VERDICT_RE.exec(foldArabic(atom));
  return found ? found[1] : '';
}
// A grade the answer's prose states: «درجتُه/حكمُه (عند فلان): …», «قال الترمذي: حسن غريب»,
// «صحّحه/حسّنه/ضعّفه فلان», «وهو حديثٌ صحيح». The same closed words the ladder prints.
const PROSE_GRADE_WORD = '(?:حسن صحيح غريب|حسن صحيح|حسن غريب|صحيح غريب|صحيح|حسن|جيد|قوي|ثابت|صالح|لا باس به|ضعيف جدا|ضعيف|موضوع|منكر|لا يصح|لا يثبت)';
const PROSE_GRADE_RE = new RegExp('(?:^| )(?:'
  + '[فو]?(?:درجته|درجه الحديث|حكمه|حكم الحديث)(?: عند [^ ]+(?: [^ ]+)?)? ' + PROSE_GRADE_WORD
  + '|[فو]?قال (?:عنه |فيه )?(?:الترمذي|ابو داود|النسائي|ابن ماجه|احمد|الحاكم|الالباني|ابن حبان|البيهقي|الدارقطني|الذهبي)(?: هذا)?(?: حديث)? ' + PROSE_GRADE_WORD
  + '|[فو]?(?:صححه|حسنه|ضعفه) (?:[^ ]+ ){0,2}?(?:الترمذي|ابو داود|النسائي|ابن ماجه|احمد|الحاكم|الالباني|ابن حبان|البيهقي|الدارقطني|الذهبي)'
  + '|[فو]?(?:وهو|هو) حديث ' + PROSE_GRADE_WORD
  + '|[وفب]?(?:اسناد|اسناده|سند|سنده|حديث) ' + PROSE_GRADE_WORD
  + '|[وف]?هذا (?:حديث )?' + PROSE_GRADE_WORD
  + ')(?= |$)', 'u');
/**
 * The grade the prose states around one matn, in the same window `statedAttributionNear` reads:
 * this matn's sentence and the next one, fenced by the neighbouring matns, cards and the matn's
 * own words left out. '' when it states none.
 */
export function statedGradeNear(text, target, floor = 0, ceiling = -1) {
  const value = String(text == null ? '' : text);
  const head = value.slice(0, target.start);
  const boundary = lastIndexOfPattern(head, BOUNDARY_RE);
  let from = Math.max(boundary + 1, Number.isInteger(floor) ? floor : 0);
  if (target.kind === 'card') {
    const preceding = value.slice(floor, target.start).trimEnd();
    const line = preceding.slice(preceding.lastIndexOf('\n') + 1);
    const ownWords = foldArabic(target.matn).split(' ');
    const ending = ownWords.slice(-4).join(' ');
    // A grade before a card belongs to it only when that sentence repeats its own wording.
    if (ownWords.length >= 4 && foldArabic(line).includes(ending)) from = floor + preceding.lastIndexOf('\n') + 1;
  }
  const tail = value.slice(target.end);
  let to = value.length;
  const first = tail.search(FULL_STOP_RE);
  if (first >= 0) {
    let cursor = first;
    while (cursor < tail.length && /[.!؟\s]/u.test(tail[cursor])) cursor += 1;
    const rest = tail.slice(cursor);
    const second = rest.search(FULL_STOP_RE);
    to = target.end + cursor + (second >= 0 ? second + 1 : rest.length);
  }
  if (ceiling >= 0) to = Math.min(to, ceiling);
  if (to <= from) return '';
  const quoted = value.slice(target.start, target.end);
  const scanned = foldArabic(value.slice(from, to).replace(CARD_BLOCK_RE, ' ').split(quoted).join(' '));
  const found = PROSE_GRADE_RE.exec(scanned);
  return found ? found[0].trim() : '';
}

// ── THE COMPANION, TAKEN AND NEVER GUESSED ─────────────────────────────────
//
// §٢-ب/١: «الراوي = الصحابي يُصدَّر به الحديث نصا. ولا عنعنة ولا سند». So exactly one name
// is wanted, and the isnad it was standing in must not come with it.
//
// THE SIGNAL IS THE PRAYER, NOT A LIST OF NAMES. «رضي الله عنه» follows a Companion and
// effectively no one else in these books, so the one-to-four words before it are the name.
// A list of names would have to be written by hand, and a name written by hand is a name
// nobody measured — the very thing §٢-ب/٤ forbids for the مخرِّج.
const ARABIC_WORD = '[\\u0621-\\u063A\\u0641-\\u064A][\\u0621-\\u063A\\u0641-\\u064A]*';
// THE NAME IS ANCHORED ON BOTH SIDES, AND THAT IS WHAT MAKES IT A NAME.
// Left: the particle a narration actually uses to name its Companion. Right: the prayer,
// which must end a word — «عنه» is a prefix of «عنهم», and reading one as the other is how
// «كما أمرهم بذلك أئمتهم رضي الله عنهم» came back as a Companion on the first drive.
const COMPANION_ANCHORS = ['عن', 'وعن', 'قال', 'قالت', 'سمعت', 'أن'];
// The longer prayers come first so «عنهما» is never read as «عنه» with a tail left over.
const COMPANION_PRAYERS = ['عنهما', 'عنهم', 'عنها', 'عنه'];
const COMPANION_RE = new RegExp(
  '(?:^|[\\s،؛:])'
  + '(?:' + COMPANION_ANCHORS.map(tolerant).join('|') + ')'
  + '\\s+(' + ARABIC_WORD + '(?:\\s+' + ARABIC_WORD + '){0,4})\\s+'
  + tolerant('رضي') + '\\s*' + tolerant('الله') + '\\s*'
  + '(' + COMPANION_PRAYERS.map(tolerant).join('|') + ')'
  + '(?![\\u0621-\\u063A\\u0641-\\u064A])',
  'gu',
);

const COMPANION_STOP = new Set(['عن', 'قال', 'وقال', 'حدثنا', 'اخبرنا', 'ثنا', 'انا', 'عنه', 'به', 'ان', 'وعن', 'قالت', 'سمعت']);
// Words that no Companion's name contains. One of them in the span means the span is prose
// that happens to end in the prayer, not a name.
const NOT_A_NAME = new Set([
  'كما', 'بذلك', 'الذي', 'التي', 'هذا', 'هذه', 'ذلك', 'تلك', 'حين', 'حتي', 'ثم', 'قد',
  'لم', 'لا', 'ما', 'ان', 'اذا', 'كان', 'كانت', 'ائمتهم', 'اصحابه', 'الصحابه', 'اجمعين',
  'امرهم', 'عليهم', 'منهم', 'فيهم', 'لهم', 'بهم', 'وهم', 'هم', 'نحن', 'كلهم', 'جميعا',
]);

// ── THIRD ORDER, STEP 3 · A KINSHIP WORD WITH A PRONOUN IS NEVER A NAME ────────
//
// MEASURED on the owner's preview: «عن أبيه رضي الله عنه: «دعهما فإني أدخلتهما طاهرتين» (متفق
// عليه)». The atoms read «عن عروة بن المغيرة عن أبيه رضي الله عنه», so the last anchored run before
// the prayer was «أبيه», two books agreed on it, and a pronoun went out as a Companion's name. The
// man is المغيرة بن شعبة, but nothing in the atom SAYS so — «أبيه» points back at a name the atom
// gave for somebody else, and reading «المغيرة» out of «عروة بن المغيرة» is an inference, not a
// record. So an atom whose Companion is written as kinship-plus-pronoun names NO Companion, and
// the opener is dropped: «نقصٌ أشرفُ من خطأ». The list is folded as `foldArabic` folds.
const KINSHIP_WORDS = new Set([
  'أبيه', 'أبيها', 'أبيهما', 'أبيهم', 'أمه', 'أمها', 'أمهما', 'أمهم', 'جده', 'جدها', 'جدته', 'جدتها',
  'أخيه', 'أخيها', 'أخته', 'أختها', 'عمه', 'عمها', 'عمته', 'عمتها', 'خاله', 'خالها', 'خالته', 'خالتها',
  'ابنه', 'ابنها', 'ابنته', 'ابنتها', 'بنته', 'بنتها', 'زوجه', 'زوجها', 'زوجته', 'والده', 'والدها',
  'والدته', 'والدتها', 'أبويه', 'أبويها', 'مولاه', 'مولاها',
  // NOT the first-person forms: «أبي» is also the genitive of «أبو», and «عن أبي هريرة» is a name.
].map((word) => foldArabic(word)));

// How many occurrences of one matn inside one atom are worth trying. A مسند page can repeat
// a matn many times; the name that belongs to it is in the first few, never the fortieth.
const MAX_MATN_OCCURRENCES = 8;

/**
 * The Companion a narration names, or ''. Returned WITHOUT diacritics and without its chain.
 *
 * ── IT IS READ NEXT TO THE MATN, NOT AT THE HEAD OF THE ATOM ──
 * MEASURED: an atom often carries several narrations, and taking the first «عن فلان رضي الله
 * عنه» in it named a man who narrated the hadith BEFORE this one. So the atom is cut at the
 * matn and the LAST name before it is the one taken.
 *
 * @returns {{name:string, prayer:string}}  `prayer` is the honorific the source itself used,
 *          so a woman Companion is not shipped under a masculine pronoun.
 */
export function companionFrom(atomText, matn) {
  // Read on the BARE text so no harakat sequence has to be guessed, and so the matn's offset
  // inside the atom is an offset in the same string the name is read from.
  const bare = bareArabic(atomText);
  const needle = bareArabic(matn || '');
  // ── EVERY PLACE THE MATN STANDS, NOT ONLY THE FIRST ───────────────────
  // MEASURED on ezik-shamela-20260820, 19 September 2026, and it made the rule of §٢-أ
  // vacuous rather than strict: in صحيح البخاري the FIRST occurrence of a matn is the
  // CHAPTER HEADING — «باب: المسلم من سلم المسلمون من لسانه ويده» — which stands ABOVE the
  // isnad. Cutting the atom there left five characters of prefix and no name in them, so
  // the Companion came back empty for ten atoms out of ten that plainly named him. A
  // heading is not a narration; the narration under it is. So the occurrences are tried in
  // order and the first that has an anchored name in front of it is the one taken.
  const cuts = [];
  if (needle) {
    let at = bare.indexOf(needle);
    while (at > 0 && cuts.length < MAX_MATN_OCCURRENCES) {
      cuts.push(at);
      at = bare.indexOf(needle, at + 1);
    }
    if (!cuts.length) {
      // The quotation is often the matn's opening clause; anchor on its first words.
      const words = needle.split(' ').filter(Boolean);
      if (words.length >= 3) {
        const anchor = words.slice(0, 3).join(' ');
        let anchorAt = bare.indexOf(anchor);
        while (anchorAt > 0 && cuts.length < MAX_MATN_OCCURRENCES) {
          cuts.push(anchorAt);
          anchorAt = bare.indexOf(anchor, anchorAt + 1);
        }
      }
    }
  }
  if (!cuts.length) cuts.push(bare.length);
  for (const cut of cuts) {
    const found = nameBeforeCut(bare.slice(0, cut));
    // THIRD ORDER, STEP 3 — the narration named its Companion by kinship: no name, no guess.
    if (found.kinship) return { name: '', prayer: '' };
    if (found.name) return found;
  }
  return { name: '', prayer: '' };
}

/** The last anchored Companion name in a prefix of an atom, or none. */
function nameBeforeCut(prefix) {
  COMPANION_RE.lastIndex = 0;
  let match;
  let last = null;
  while ((match = COMPANION_RE.exec(prefix)) !== null) {
    last = match;
    if (match.index === COMPANION_RE.lastIndex) COMPANION_RE.lastIndex += 1;
  }
  if (!last) return { name: '', prayer: '' };
  // EVERY captured word that is not a chain particle. It is NOT trimmed to the last two or
  // three: «عبد الله بن عمرو» loses the man himself that way, and a Companion named wrong is
  // a narration ascribed to someone who did not narrate it.
  // THIRD ORDER, STEP 3 — AND ONLY THE WORDS AFTER THE LAST LINK OF THE CHAIN. «عن طاوس عن ابن عباس
  // رضي الله عنهما» fits the five-word window whole, and filtering the particle out fused two men
  // into «طاوس ابن عباس». The Companion is the name the prayer follows, so the run is cut at its last
  // chain particle first. It can only shorten a name, never lengthen or replace one.
  const run = String(last[1]).trim().split(/\s+/u);
  let link = -1;
  run.forEach((word, k) => { if (COMPANION_STOP.has(foldArabic(word))) link = k; });
  const words = run.slice(link + 1)
    .filter((word) => !COMPANION_STOP.has(foldArabic(word)));
  if (words.some((word) => KINSHIP_WORDS.has(foldArabic(word)))) return { name: '', prayer: '', kinship: true };
  if (!words.length || words.length > 5) return { name: '', prayer: '' };
  if (words.some((word) => NOT_A_NAME.has(foldArabic(word)))) return { name: '', prayer: '' };
  const name = words.join(' ').trim();
  if (name.length < 3) return { name: '', prayer: '' };
  return { name, prayer: String(last[2]).trim() };
}

// ── B2 (FULL_ANSWER_V1) · «يُسمّى الراوي الذي يلي النبيَّ ﷺ حينَ يذكرُه نصُّ الكتابِ المسترجَعِ نفسُه» ──────
// The owner's ruling of 25 September. The name is the one the prayer follows (COMPANION_RE, as above),
// and it counts only where NOTHING stands between that man and the Prophet ﷺ in the atom's own text: no
// further link of a chain («عن/سمعت/أن» + a man, «حدثنا/أخبرنا…») and no closing mark of an earlier
// narration. A mursal («عن سعيد بن المسيب قال: قال رسول الله ﷺ») has no prayer next to the Prophet ﷺ,
// so an earlier narration's Companion in the same atom is not borrowed for it.
const B2_PROPHET_RE = /(?:^| )(?:رسول الله|النبي|الرسول)(?= |$)|صلي الله عليه وسلم|\uFDFA/u;
// Read on the BARE gap (hamza kept), so «إنّ من قضاء…» is not «أنّ فلانًا…»; «أنه حدثه أن رسول الله» (the
// Companion telling his student) is not a further link.
// D61: «سمع» («أنه سمع عمر …») and «قال <a man>» («قال: قال عمر: قال رسول الله») are links too; «قال: قال
// رسول الله» and «قال: سمعت رسول الله» are not.
const B2_LINK_RE = /(?:^| )[وف]?(?:حدثنا|حدثني|[اأ]خبرنا|[اأ]خبرني|[اأ]نب[اأ]نا|ثنا|عن|سمعت|سمع|أن) (?!(?:رسول|النبي|الرسول)(?: |$)|\uFDFA)[^ ]+|(?:^| )[وف]?قال (?!(?:رسول|النبي|الرسول|قال|سمعت|حدثنا|حدثني|[اأ]خبرنا|[اأ]خبرني)(?: |$)|\uFDFA)[^ ]+/u;
// The Prophet ﷺ may be named in the gap («… قال: قال رسول الله ﷺ») or at the head of the matn itself
// («… قال: جعل رسول الله ﷺ …»، «كان النبي ﷺ …»): either way the man before him narrates from him.
function b2Adjacent(gapBare, headBare) {
  if (/[»”]/u.test(gapBare) || (gapBare.match(/"/gu) || []).length > 1) return false;
  const gap = foldArabic(gapBare);
  const head = foldArabic(headBare).split(' ').slice(0, 8).join(' ');
  const links = String(gapBare).replace(PUNCTUATION_RE, ' ').replace(/\s+/gu, ' ').trim();
  return (B2_PROPHET_RE.test(gap) || B2_PROPHET_RE.test(head)) && !B2_LINK_RE.test(links);
}
// «قال فلان رضي الله عنه:» in a book is its AUTHOR or a jurist speaking far more often than a link of the
// chain — measured: Ibn Hibban's «قال أبو حاتم رضي الله عنه: قوله ﷺ …» is Ibn Hibban himself. The chain
// names the Companion with «عن/سمعت/أن»; under B2 those are the anchors that count.
const B2_ANCHORS_REFUSED = new Set(['قال', 'قالت']);
// «قال أبو هريرة» and «سمعت أبا هريرة» name the man in the case of their verb; the opener is «عن …».
function b2Genitive(name) {
  return String(name).split(' ').map((w) => (/^(?:و)?(?:أبو|أبا)$/u.test(w) ? w.replace(/أب[وا]$/u, 'أبي')
    : /^(?:و)?(?:ابو|ابا)$/u.test(w) ? w.replace(/اب[وا]$/u, 'ابي')
      : /^(?:و)?(?:ذو|ذا)$/u.test(w) ? w.replace(/ذ[وا]$/u, 'ذي') : w)).join(' ');
}
/** The Companion next to the Prophet ﷺ in this atom, named with the prayer by the atom itself, or ''. */
export function companionAdjacent(atomText, matn) {
  const bare = bareArabic(atomText);
  const needle = bareArabic(matn || '');
  const cuts = [];
  if (needle) {
    for (let at = bare.indexOf(needle); at > 0 && cuts.length < MAX_MATN_OCCURRENCES; at = bare.indexOf(needle, at + 1)) cuts.push(at);
    if (!cuts.length) {
      const words = needle.split(' ').filter(Boolean);
      if (words.length >= 3) {
        const anchor = words.slice(0, 3).join(' ');
        for (let at = bare.indexOf(anchor); at > 0 && cuts.length < MAX_MATN_OCCURRENCES; at = bare.indexOf(anchor, at + 1)) cuts.push(at);
      }
    }
  }
  // No cut, no reading: the whole atom is not «the narration of this matn».
  for (const cut of cuts) {
    const prefix = bare.slice(0, cut);
    const found = nameBeforeCut(prefix);
    if (found.kinship) return { name: '', prayer: '' };
    if (!found.name) continue;
    COMPANION_RE.lastIndex = 0;
    let match; let last = null;
    while ((match = COMPANION_RE.exec(prefix)) !== null) {
      last = match;
      if (match.index === COMPANION_RE.lastIndex) COMPANION_RE.lastIndex += 1;
    }
    if (!last || B2_ANCHORS_REFUSED.has(foldArabic(last[0]).split(' ')[0])) return { name: '', prayer: '' };
    if (!b2Adjacent(prefix.slice(last.index + last[0].length), bare.slice(cut, cut + 120))) return { name: '', prayer: '' };
    return { name: b2Genitive(found.name), prayer: found.prayer };
  }
  return { name: '', prayer: '' };
}
/** How many ladder rows must carry the name under B2. The owner's words: «نصُّ الكتابِ … نفسُه» — one. */
export const B2_MIN_BOOKS = 1;
export const TAKHRIJ_COMPANION_CONFLICT = 'TAKHRIJ_COMPANION_CONFLICT';
export const TAKHRIJ_COMPANION_NO_LEADIN = 'TAKHRIJ_COMPANION_NO_LEADIN';
// ── ج٤ (order C, FULL_ANSWER_V1) · A COMPANION ONLY WHERE THE QUOTED WORDS ARE ONE HADITH ──────────────
//
// THE OWNER'S RULE (order C, ج٤): «لا يُسمّى صحابيٌّ إلّا إذا لم يطابقِ المقطعُ الذي اقتبسَه القارئُ في المكتبةِ
// إلّا حديثًا واحدًا — فإن طابقَ حديثين أو أكثرَ برواةٍ مختلفين لم يُسمَّ أحد». MEASURED (report B §6.1 row 8;
// again on 88c5a75 against lib-preview, 10-order-c/c4/measure/): «بينما نحن عند رسول الله ﷺ ذات يوم» — ʿUmar's
// opening of the Jibril hadith — is carried by atoms of five different hadiths: ʿUmar's (Muslim, al-Nasāʾī,
// al-Bayhaqī), Zayd b. Thābit's (Aḥmad), Abū Hurayra's and Abū Saʿīd's (al-Bukhārī), and a man's from his
// grandfather (al-Ṭabarānī). Only Abū Saʿīd's atom prints the prayer next to the Prophet ﷺ, so B2 named him.
//
// WHO NARRATES EACH ATOM. B2's own reading first (`companionAdjacent`, the prayer next to the Prophet ﷺ) — so
// B2's man is always one of the men counted — and where it reads nobody, a reading WITHOUT the prayer: the
// last link of the chain before the quoted words («عن / أن / حدثني / أخبرني / سمعت …») and a name of one to
// six words, then (in this order, each optional) the prayer and after it an aside of up to three words («على المنبر»),
// «أنه», and a verb of saying or hearing and/or the Prophet's ﷺ frame, then up to four words of aside («عام
// الفتح وهو بمكة») before the quoted words. It is read on the text with its punctuation, dashes and page
// marks taken out («- صلى الله عليه وسلم -», «[ص: 115]»), so a print's typography does not hide a man; no link
// word may stand inside the name or an aside, so an earlier link is never read as this one. A kinship word
// («جده»، «أبيه») names nobody; neither does a word no name has (a wording note «بلفظ»، «مرفوعا», a Lord's
// name). It decides only WHETHER to name: the name, when there is one, is still B2's.
const NARRATOR_NOISE_RE = /\[ص:\s*[0-9٠-٩]+\]|\(\s*[0-9٠-٩]+\s*\)|[،,؛;:："“”«»()[\]{}\-–—ـ.!؟?*]/gu;
const narratorPlain = (value) => bareArabic(String(value || '')).replace(NARRATOR_NOISE_RE, ' ').replace(/\s+/gu, ' ').trim();
// Regex alternatives, the alef of each tolerant of its hamza as prints differ («اخبرنا» / «أخبرنا»).
const NARRATOR_LINK_WORDS = ['عن', 'وعن', '[اأ]ن', 'و[اأ]ن', 'سمعت', 'سمع', 'حدثني', 'حدثنا', '[اأ]خبرني', '[اأ]خبرنا', '[اأ]نب[اأ]نا', 'ثنا'];
const NARRATOR_SAY_WORDS = ['قال', 'قالت', 'يقول', 'تقول', 'سمع', 'سمعت', 'يحدث', 'حدث'];
const NARRATOR_WORD = '(?!(?:' + [...NARRATOR_LINK_WORDS, ...NARRATOR_SAY_WORDS, 'رسول', 'النبي', 'الرسول', 'رضي', '[اأ]نه', '[اأ]نها'].join('|') + ')(?: |$))[\\u0621-\\u063A\\u0641-\\u064A]+';
const NARRATOR_PROPHET = '(?:(?:قال|[اأ]ن|عن|سمعت|سمع) )?(?:رسول الله|النبي|الرسول)(?: صلى الله عليه(?: وآله)? وسلم)?(?: (?:قال|يقول))?';
const NARRATOR_RE = new RegExp('(?:^| )(' + NARRATOR_LINK_WORDS.join('|') + ') (' + NARRATOR_WORD + '(?: ' + NARRATOR_WORD + '){0,5})'
  + '(?: رضي الله (?:عنهما|عنهم|عنها|عنه)(?: ' + NARRATOR_WORD + '){0,3}?)?(?: (?:[اأ]نه|[اأ]نها))?'
  + ' (?:(?:' + NARRATOR_SAY_WORDS.join('|') + ')(?: ' + NARRATOR_PROPHET + ')?|' + NARRATOR_PROPHET + ')'
  + '(?: ' + NARRATOR_WORD + '){0,4}(?: (?:يقول|قال))?$', 'u');
const NARRATOR_NOT_A_NAME = new Set(['بلفظ', 'مرفوعا', 'موقوفا', 'عنه', 'عنها', 'لكن', 'أي', 'فقال', 'وقال', 'ربه', 'تبارك',
  'وتعالى', 'تعالى', 'عز', 'وجل', 'مثله', 'نحوه', 'بمعناه', 'به', 'هذا', 'حديث']);
const NARRATOR_KIN_RE = /^(?:[اأ]بي|[اأ]بيه|أبيها|أبيهما|أبيهم|أمه|أمها|جده|جدها|جدته|جدتها|أخيه|أخيها|عمه|عمها|خاله|خالته|مولاه|مولاها)$/u;

/** The man next to the quoted words in this atom: `{name, link}`, `{name, kin:true}` or `{name:''}`. */
export function matnNarrator(atomText, matn) {
  const b2 = companionAdjacent(atomText, matn);
  if (b2 && b2.name) return { name: b2.name, link: 'b2' };
  const text = narratorPlain(atomText);
  const words = narratorPlain(matn).split(' ').filter(Boolean);
  if (!text || !words.length) return { name: '' };
  const anchor = words.slice(0, Math.min(3, words.length)).join(' ');
  let tried = 0;
  for (let at = text.indexOf(anchor); at > 0 && tried < MAX_MATN_OCCURRENCES; at = text.indexOf(anchor, at + 1)) {
    tried += 1;
    const m = NARRATOR_RE.exec(text.slice(Math.max(0, at - 220), at).trim());
    if (!m) continue;
    const name = m[2].trim().split(' ');
    // A conjoined word after the first («… وأبصرت عيناي»، «… وكانت له صحبة») is prose, not a name.
    if (name.some((w, k) => NARRATOR_NOT_A_NAME.has(w) || w.length < 2 || (k > 0 && /^و/u.test(w))) || name[0] === 'الله') continue;
    if (name.length === 1 && NARRATOR_KIN_RE.test(name[0])) return { name: name[0], kin: true };
    if (name.some((w, k) => k > 0 && NARRATOR_KIN_RE.test(w) && !/^[اأ]بي$/u.test(w))) return { name: name.join(' '), kin: true };
    return { name: name.join(' '), link: m[1] };
  }
  return { name: '' };
}

// ONE MAN WRITTEN MANY WAYS, MEASURED ON THE SAMPLE: «ابن عمر» / «عبد الله بن عمر» / «بن عمر» (Ibn Ḥibbān's
// print); «أنس» / «أنس بن مالك» / «أبي حمزة أنس بن مالك»; «العرباض بن سارية» / «عرباض بن سارية السلمي»; «أبا/أبي
// هريرة»; «أبي شريح الخزاعي / الكعبي / العدوي»; «عقبة بن عمرو أبي مسعود» / «أبي مسعود»; «حدثني أبي عمر بن الخطاب»
// («my father») / «عمر بن الخطاب». So a name is read as a KUNYA («أبي X») and an ISM (the rest, the kunya's
// case one, «ابن X» as «عبد الله بن X», a nisba — a word with the article that ends in «ي», after the first
// word — and «أمير المؤمنين» left out), and two names are one man when their kunyas are the same, or one ism is
// the other's opening words. «أبي X بن Y» is «my father X b. Y», not a kunya.
function narratorCore(name) {
  const raw = String(name).split(' ').filter(Boolean);
  const words = [];
  raw.forEach((w, k) => {
    const f = foldArabic(w);
    if (k > 0 && /^ال\S+ي$/u.test(f)) return; // a nisba
    if (f === 'امير' || f === 'المومنين' || f === 'المؤمنين') return;
    words.push(f.replace(/^ال(?=\S{2,})/u, '').replace(/^اب[وا]$/u, 'ابي').replace(/^ذ[وا]$/u, 'ذي'));
  });
  let w = words;
  if (w[0] === 'ابي' && w[2] === 'بن') w = w.slice(1); // «حدثني أبي عمر بن الخطاب»
  let kunya = '';
  const at = w.findIndex((x, k) => (x === 'ابي' || x === 'ام') && k + 1 < w.length);
  if (at >= 0) { kunya = w[at] + ' ' + w[at + 1]; w = [...w.slice(0, at), ...w.slice(at + 2)]; }
  if ((w[0] === 'ابن' || w[0] === 'بن') && w.length >= 2) w = ['عبد', 'له', 'بن', ...w.slice(1)];
  return { kunya, ism: w.map((x) => (x === 'الله' ? 'له' : x)) };
}
const narratorPrefix = (a, b) => a.length > 0 && a.length <= b.length && a.every((x, i) => x === b[i]);
function sameNarrator(a, b) {
  const x = narratorCore(a);
  const y = narratorCore(b);
  if (x.kunya && y.kunya) return x.kunya === y.kunya;
  return narratorPrefix(x.ism, y.ism) || narratorPrefix(y.ism, x.ism);
}
/**
 * The distinct men among the names read, each a list of the ways he was written. The longest names are placed
 * first; a name that fits two men already placed («عبد الله» beside «ابن عمر» and «ابن عباس») says nothing about
 * either and is set aside — it never joins two men into one.
 */
export function narratorGroups(names) {
  const groups = [];
  const size = (n) => narratorCore(n).ism.length + (narratorCore(n).kunya ? 2 : 0);
  for (const name of [...new Set((names || []).filter(Boolean))].sort((a, b) => size(b) - size(a))) {
    const hit = groups.filter((group) => group.some((other) => sameNarrator(other, name)));
    if (hit.length === 0) groups.push([name]);
    else if (hit.length === 1) hit[0].push(name);
  }
  return groups;
}
export const TAKHRIJ_COMPANION_MANY_HADITHS = 'TAKHRIJ_COMPANION_MANY_HADITHS';
// D3A H2 extends the same C4 ambiguity test to the parenthetical and its citation proof.
export const TAKHRIJ_PARENTHETICAL_MANY_HADITHS = 'TAKHRIJ_PARENTHETICAL_MANY_HADITHS';

/** One name from the books, or none: two different adjacent Companions for one matn name neither. */
export function bookCompanion(candidates, minBooks = B2_MIN_BOOKS) {
  const byName = new Map();
  for (const one of Array.isArray(candidates) ? candidates : []) {
    const name = String((one && one.name) || '').trim();
    const book = String((one && one.book) || '').trim();
    if (!name || !book) continue;
    const key = foldArabic(name);
    if (!byName.has(key)) byName.set(key, { name, prayer: String(one.prayer || ''), books: new Set() });
    byName.get(key).books.add(book);
  }
  if (byName.size > 1) return { name: '', prayer: '', books: 0, conflict: true };
  const slot = [...byName.values()][0];
  if (!slot || slot.books.size < minBooks) return { name: '', prayer: '', books: 0 };
  return { name: slot.name, prayer: slot.prayer, books: slot.books.size };
}
// «ولا تسميةَ من حفظِ النموذج» — the Companion the MODEL put in narrator position in front of this matn,
// in the two shapes whose removal leaves a whole frame: «(ف/و)عن X رضي الله عنه (قال:)» and «(من) حديث X
// رضي الله عنه» — each only where the Prophet ﷺ is named right after it («قال رسول الله»، «أن النبي»،
// «عن النبي»). Story and speaker shapes («عن أنس رضي الله عنه قال: كنا…») are not touched here.
const B2_NAME = '[\\u0621-\\u063A\\u0641-\\u064A\\u064B-\\u0652\\u0670]+(?:\\s+[\\u0621-\\u063A\\u0641-\\u064A\\u064B-\\u0652\\u0670]+){0,4}';
const B2_PRAYER = tolerant('رضي') + '\\s*' + tolerant('الله') + '\\s*(?:' + tolerant('تعالى') + '\\s*)?(?:' + COMPANION_PRAYERS.map(tolerant).join('|') + ')(?![\\u0621-\\u063A\\u0641-\\u064A])';
const B2_MODEL_OPENER_RE = new RegExp('(?:^|(?<=[\\s،؛:(]))(?:'
  + '(?:[فو]?' + tolerant('عن') + ')\\s+' + B2_NAME + '\\s+' + B2_PRAYER + '[\\s،,]*(?:(?:' + ['قال', 'قالت', 'قالا'].map(tolerant).join('|') + ')\\s*[:：]?\\s*)?'
  + '|(?:' + tolerant('من') + '\\s+)?(?:[وبل]?' + tolerant('حديث') + ')\\s+' + B2_NAME + '\\s+' + B2_PRAYER + '[\\s،,]*'
  + ')(?=(?:' + ['قال', 'وقال', 'أن', 'عن'].map(tolerant).join('|') + ')\\s+(?:' + ['رسول الله', 'النبي'].map(tolerant).join('|') + ')|(?:' + ['رسول الله', 'النبي'].map(tolerant).join('|') + ')\\s)', 'gu');
/** The model's own Companion opener inside [from, to) of `text`, as {start, end}, or null. */
export function modelCompanionOpener(text, from, to) {
  const window = String(text).slice(from, to);
  B2_MODEL_OPENER_RE.lastIndex = 0;
  let m; let last = null;
  while ((m = B2_MODEL_OPENER_RE.exec(window)) !== null) {
    last = m;
    if (m.index === B2_MODEL_OPENER_RE.lastIndex) B2_MODEL_OPENER_RE.lastIndex += 1;
  }
  return last ? { start: from + last.index, end: from + last.index + last[0].length } : null;
}

// ── AND ONE BOOK SAYING IT IS NOT ENOUGH TO SAY IT ─────────────────────────
//
// THE OWNER RULED IT ON 19 September, route (ب) §٢-أ, in these words: «لا يُكتَبُ عن فلانٍ
// رضي الله عنه إلّا إذا اتّفقتْ عليه ذرّتانِ من كتابَينِ مختلفَين».
//
// WHY THE RULE EXISTS, MEASURED. `companionFrom` above reads the LAST name before the matn
// inside ONE atom, which is far better than the first — but an atom that carries several
// narrations can still hand back the Companion of the narration BEFORE the one wanted. One
// atom is therefore a witness and not a proof, and a Companion named wrong is a narration
// ascribed to a man who did not narrate it: the same false ascription the parentheses exist
// to prevent, made one field to the left.
//
// AND WHEN THEY DO NOT AGREE, THE NAME GOES AND THE MATN STAYS. `composeHadith` already drops
// the opener when it is handed no name, so the reader gets «<المتن>» (البخاري) — less than the
// full shape and nothing in it invented. نقصٌ أشرفُ من خطأ.
//
// «TWO DIFFERENT BOOKS» IS READ AS TWO DIFFERENT LADDER ROWS, WHICH IS THE STRICTER READING.
// A row may hold several subject ids — أبو داود is FC-000656 and FC-000657, two copies of one
// book — and two copies of one book agreeing with themselves is one witness, not two. The
// looser reading would have counted that as two, so the ROW is the unit and not the id.
//
// WITH FULL_ANSWER_V1 OFF ONLY (order B, ب٢). The owner ruled again on 25 September: «يُسمّى الراوي
// الذي يلي النبيَّ ﷺ حينَ يذكرُه نصُّ الكتابِ المسترجَعِ نفسُه مقرونًا بـ«رضي الله عنه»…». Under the
// switch the one book is the book the parentheses name, and the witness problem above is closed by
// adjacency instead (`companionAdjacent`, `bookCompanion` above). With the switch off, this stands.
/** How many distinct ladder rows must name the same Companion before he is written. */
export const COMPANION_MIN_BOOKS = 2;

/**
 * The Companion two different ladder books agree on, or no Companion at all.
 *
 * @param {Array<{name:string, prayer:string, book:string}>} candidates  one per confirmed atom
 *        that named somebody; `book` is the ladder ROW the atom came out of.
 * @returns {{name:string, prayer:string, books:number}}  `books` is how many rows agreed, so a
 *          caller and a guard can tell «nobody was named» from «one book named him».
 */
export function agreedCompanion(candidates) {
  const byName = new Map();
  for (const one of Array.isArray(candidates) ? candidates : []) {
    const name = String((one && one.name) || '').trim();
    const book = String((one && one.book) || '').trim();
    // A candidate with no book behind it cannot be a second witness to anything.
    if (!name || !book) continue;
    // Folded for the comparison and never for the output: the same man arrives vocalised in
    // one book and bare in the next, and two spellings of one name are one witness twice.
    const key = foldArabic(name);
    if (!key) continue;
    let slot = byName.get(key);
    if (!slot) {
      slot = { name, prayer: String((one && one.prayer) || ''), books: new Set(), order: byName.size };
      byName.set(key, slot);
    }
    slot.books.add(book);
  }
  let best = null;
  for (const slot of byName.values()) {
    if (slot.books.size < COMPANION_MIN_BOOKS) continue;
    if (!best || slot.books.size > best.books.size
      || (slot.books.size === best.books.size && slot.order < best.order)) best = slot;
  }
  if (!best) return { name: '', prayer: '', books: 0 };
  return { name: best.name, prayer: best.prayer, books: best.books.size };
}

// D3A H1 — carrying the words proves the bracket, not their speaker. Read explicit speech in
// the confirmed narration only. Exact words immediately after its speech marker, or wholly inside
// a quotation immediately introduced by it, are proof; headings and a previous quote are not.
const speechPlain = (value) => foldArabic(String(value || '').replace(/\uFDFA/gu, ' صلى الله عليه وسلم '));
const SPEECH_PERSON = '(?:رسول الله|النبي|الرسول)(?: صلي الله عليه(?: واله)? وسلم| عليه الصلاه والسلام)?';
const SPEECH_MARKER = '(?:(?:قال|يقول|سمعت|سمع) ' + SPEECH_PERSON + '(?: (?:قال|يقول))?|'
  + SPEECH_PERSON + ' (?:انه )?(?:قال|يقول))';
const SPEECH_END_RE = new RegExp('(?:^| )' + SPEECH_MARKER + '$', 'u');
// A quoted excerpt crossing into another speaker's turn is not wholly his speech.
const SPEECH_TURN_RE = /(?:^| )(?:[وف]?قال(?:ت)?|[وف]?يقول)(?= |$)/u;
const NARRATOR_ASIDE_RE = /(?:^| )(?:[وف]?قال(?:ت)?|[وف]?يقول) الراوي(?= |$)/u;
const SPEECH_ISNAD_RE = new RegExp('(?<![\\u0621-\\u064A])' + alternation(['حدثنا', 'حدثني', 'أخبرنا', 'أخبرني', 'أنبأنا']) + '(?=\\s)', 'u');
export function atomProvesPropheticSpeech(atomText, matn) {
  let raw = String(atomText || '');
  if (narrationOf(raw) !== raw) {
    const at = raw.search(SPEECH_ISNAD_RE);
    raw = at < 0 ? '' : raw.slice(at);
  }
  const needle = speechPlain(matn);
  if (!raw || !needle) return false;
  // The unquoted spelling is frequent in the saved atoms. Full excerpt and word boundaries only:
  // the 60% bracket anchor cannot lend the uncarried remainder a speaker.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  // Keep quote boundaries in the unquoted path: its needle cannot cross from a saying into narration.
  const unquoted = speechPlain(raw.replace(/[«»“”"؟?!]/gu, ' \uE000 '));
  if (!SPEECH_TURN_RE.test(needle) && new RegExp('(?:^| )' + SPEECH_MARKER + ' ' + escaped + '(?= |$)', 'u').test(unquoted)) return true;
  for (const q of raw.matchAll(/«([^«»]+)»|“([^“”]+)”|"([^"]+)"/gu)) {
    if (!SPEECH_END_RE.test(speechPlain(raw.slice(0, q.index).replace(/[؟?!]/gu, ' \uE000 ')))) continue;
    const body = speechPlain(q[1] ?? q[2] ?? q[3]);
    const at = (' ' + body + ' ').indexOf(' ' + needle + ' ');
    if (at >= 0 && !NARRATOR_ASIDE_RE.test(body.slice(0, at + needle.length))) return true;
  }
  return false;
}

// C4's narrator name identifies a transmitter, not who speaks this excerpt. A negative voice
// needs the complete original excerpt immediately after that named narrator's own saying verb.
export function atomProvesNarratorSpeech(atomText, matn) {
  const narration = narrationOf(atomText);
  const reading = matnNarrator(narration, matn);
  if (!reading.name || reading.kin) return false;
  const hay = speechPlain(narration);
  const needle = speechPlain(matn);
  if (!needle) return false;
  const name = speechPlain(reading.name)
    .replace(/^ابي(?= )/u, '(?:ابي|ابو|ابا)');
  const end = new RegExp('(?:^| )' + name + '(?: رضي الله (?:عنهما|عنهم|عنها|عنه))?(?: انه)? (?:قال|قالت|يقول|تقول)$', 'u');
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    if ((at === 0 || hay[at - 1] === ' ') && (at + needle.length === hay.length || hay[at + needle.length] === ' ')
      && end.test(hay.slice(Math.max(0, at - 220), at).trim())) return true;
  }
  return false;
}

const D3A_PERSON = '(?:' + alternation(['رسول الله', 'النبي', 'الرسول']) + ')';
const D3A_PRAYER = '(?:\\uFDFA|' + alternation(['صلى الله عليه وسلم', 'صلى الله عليه وآله وسلم', 'عليه الصلاة والسلام']) + ')';
const D3A_NAMED = '(?:' + D3A_PERSON + '(?:\\s+' + D3A_PRAYER + ')?|' + D3A_PRAYER + ')';
const D3A_SAID = '(?:' + alternation(['قال', 'وقال', 'فقال', 'يقول', 'سمعت', 'وسمعت', 'فسمعت', 'سمعنا', 'سمع']) + ')';
const D3A_ADDRESSEE = '(?:\\s+(?:' + alternation(['لي', 'له', 'لها', 'لنا', 'لهم']) + '))?';
const D3A_FRAME_RE = new RegExp('(?<![\\u0621-\\u064A])(?:'
  + '(?<noun>' + tolerant('قول') + ')\\s+' + D3A_NAMED
  + '|(?<that>' + tolerant('أن') + ')\\s+' + D3A_NAMED + '\\s+' + D3A_SAID + D3A_ADDRESSEE
  + '|' + D3A_SAID + '\\s+' + D3A_NAMED + '(?:\\s+' + D3A_SAID + D3A_ADDRESSEE + ')?'
  + '|' + D3A_NAMED + '\\s+' + D3A_SAID + D3A_ADDRESSEE
  + ')\\s*[:：]?\\s*$', 'u');
function unprovedSpeechFrame(text, target, floor, proved = false) {
  const lead = String(text).slice(floor, target.start);
  const direct = D3A_FRAME_RE.exec(lead)
    || (proved ? new RegExp(D3A_SAID + '\\s+' + D3A_NAMED + D3A_ADDRESSEE
      + '(?:\\s+' + alternation(['يوما', 'ذات يوم']) + ')?\\s*[:：]\\s*$', 'u').exec(lead) : null);
  const match = direct || new RegExp(tolerant('نص الحديث') + '\\s*[:：]\\s*$', 'u').exec(lead);
  if (!match) return null;
  const connection = /^[وف](?:قال|سمعت)/u.exec(bareArabic(match[0]));
  const replacement = proved && direct ? match[0]
    : (connection ? connection[0][0] : '') + (proved ? 'قال رسول الله ﷺ: ' : 'نص الحديث: ');
  return { start: floor + match.index, end: target.start, replacement };
}

// ── THE SENTENCE THE READER GETS ───────────────────────────────────────────

/**
 * The owner's shape, and the only composer of it (§٢-ب):
 *   عن <الصحابي> رضي الله عنه: «<المتن>» (<المخرج> · <الدرجة>)
 * With no Companion in hand the opener is dropped rather than invented; the model's own
 * lead-in then stays in front of the quotation and only the parentheses are added, because
 * the parentheses are the part that must never be missing (§٢-ب/٤).
 */
export function composeHadith({ companion, prayer, matn, parenthetical }) {
  // An EMPTY parenthetical is the §٣ deferral, not a missing one: the matn is written here and its
  // parentheses are attached at the end of the sentence, where they break nothing. It is the only
  // way this function ever returns a quotation with no brackets behind it.
  const paren = String(parenthetical == null ? '' : parenthetical).trim();
  const body = paren ? `«${String(matn).trim()}» (${paren})` : `«${String(matn).trim()}»`;
  const name = String(companion || '').trim();
  if (!name) return body;
  // The honorific the SOURCE used, so a woman Companion is not shipped under a masculine
  // pronoun. The owner's shape writes the masculine because that is the common case, not
  // because a source that said otherwise should be overwritten.
  const said = String(prayer || '').trim() || 'عنه';
  return `عن ${name} رضي الله ${said}: ${body}`;
}

// ── THE LOOKUP: ONE CALL FOR THE ANSWER, NOT ONE PER HADITH ────────────────
//
// §٢-ج: «أحاديث الجواب تُخرَّج في نداء واحد للمكتبة لا نداء لكل حديث — الزمن يعالج بالبناء
// لا بتضييق النطاق». The seam IS that one call: `applyTakhrij` calls `input.lookup` exactly
// once per answer and hands it every matn at once.
//
// ── AND THE ADAPTER REACHES THE LIBRARY THROUGH ITS ONE DOOR ──────────────
//
// THE OWNER RULED ROUTE (ب) ON 19 SEPTEMBER, AND THIS IS IT. An earlier revision of this
// file called `lib/lib-service.js` itself, which turned guards/lib-book-contract-guard.cjs
// row A7 red — «searchLibrary has exactly ONE call site in the tree, and it is the gated
// runner» — and it was reverted rather than softened. The wire below reaches the SAME door
// by the SAME runner the model uses, so A7 never moves: there is still one call site, and
// this file holds no `fetch` and no service URL of its own.
//
// AND THE MODEL IS NOT A PARTY TO THE DECISION, WHICH IS THE WHOLE POINT. `applyTakhrij`
// calls the runner ITSELF, on prose that has already been written, with a query it built
// out of the quoted matn. Nothing here is offered to a model to choose; the tool is driven,
// not proposed. A takhrij the model chose to look up is a takhrij the model can decline to
// look up, and then the parentheses would be filled out of its head — §٢-أ in one line.
//
// THE SEARCH IS NARROWED TO THE LADDER, AND THAT IS NOT AN OPTIMISATION. MEASURED on
// ezik-shamela-20260820 on 2026-09-19: an unfiltered top-ten phrase search for «إنما الأعمال
// بالنيات» returns commentaries and fatwa pages and NOT ONE ladder book, so an unnarrowed
// lookup would answer «(لا يثبت مرفوعا)» for the single most established hadith in the
// corpus. The ladder rides in `ctx.bookIds`, which lib/free-brain/tools.js hands to
// `filters.book_ids`; the service takes up to 100 ids and the ladder is well inside that.
/**
 * @param {Function} runTool  lib/free-brain/tools.js's runner, injected. This module imports
 *                            nothing out of lib/free-brain/ — the caller owns that import, so
 *                            a guard can drive this whole contract with a fake runner.
 * @param {object} ctx        the runner context: table, degraded, spend, libFlagValue, libToken,
 *                            fetchImpl, signal. `bookIds` is set here, per call.
 * @returns {Function} lookup(matns, options) -> Promise<Array<{matn, subjectIds, atoms}>>
 */
/** A failed library call as the log prints it: an HTTP status where the reason carries one. */
function libraryFailure(codes) {
  const error = codes.map((code) => String(code)).join(',').slice(0, 120);
  const status = (error.match(/(?:^|\D)([1-5]\d\d)(?!\d)/u) || [])[1] || (error.split(':')[1] || 'unknown').slice(0, 40);
  return { status, error };
}

export function runnerLookup(runTool, ctx) {
  return async (matns, options = {}) => {
    const bookIds = Array.isArray(options.bookIds) && options.bookIds.length
      ? options.bookIds
      : TAKHRIJ_LADDER_IDS;
    return Promise.all((Array.isArray(matns) ? matns : []).map(async (matn) => {
      let out;
      // [111-log] — THE RUNNER RECORDS A FAILED CALL IN `degraded` AND RETURNS NO ROWS, so an
      // unreachable library and a matn nobody narrated looked the same from here. Each call now
      // writes into a list of its own, which is then handed on to the turn's list unchanged, and
      // a non-empty one is reported beside the answer as `failure`. No row is added or removed.
      const own = [];
      try {
        out = await runTool('search_library', { query: matn }, {
          ...ctx, degraded: own, bookIds, resultCap: TAKHRIJ_ROWS_PER_CALL,
        });
      } catch (error) {
        if (Array.isArray(ctx.degraded)) ctx.degraded.push(...own);
        // The runner is documented never to throw. If it ever does, an unsourced matn is the
        // honest answer and a thrown turn is not.
        return { matn, subjectIds: [], atoms: [], failure: libraryFailure(['threw:' + String((error && error.message) || error)]) };
      }
      if (Array.isArray(ctx.degraded)) ctx.degraded.push(...own);
      const rows = out && Array.isArray(out.added) ? out.added : [];
      return {
        matn,
        subjectIds: rows.map((row) => String((row && row.subjectId) || '')),
        atoms: rows.map((row) => String((row && row.text) || '')),
        ...(own.length ? { failure: libraryFailure(own) } : {}),
      };
    }));
  };
}

// ── AND THE ANSWER THE LIBRARY GAVE MUST BE ABOUT THIS MATN ────────────────
//
// FTS returns the best rows it has, not necessarily the right ones. A row whose text does
// not CONTAIN the matn is a near neighbour, and writing «(البخاري)» off a near neighbour is
// exactly the false ascription §٢-أ forbids. So every hit is re-read against the quoted
// words before its book is allowed near the parentheses.
const MIN_ANCHOR_WORDS = 4;

export function atomCarriesMatn(atomText, matn) {
  const haystack = foldArabic(atomText);
  const needle = foldArabic(matn);
  if (!haystack || !needle) return false;
  if (haystack.includes(needle)) return true;
  // A quotation is often the matn's opening clause. Anchor on its first words.
  const words = needle.split(' ').filter(Boolean);
  if (words.length < MIN_ANCHOR_WORDS) return false;
  const cut = Math.max(MIN_ANCHOR_WORDS, Math.ceil(words.length * 0.6));
  const anchor = words.slice(0, cut).join(' ');
  if (!haystack.includes(anchor)) return false;
  // BATCH 4 [b21] — A COMPANION'S WORDS ARE NOT THE BOOK'S BECAUSE THE PROPHET'S ARE. The anchor lets
  // a quotation differ from the book's wording after its first words; it does not let the answer
  // ADD another speaker there. Where the part the atom does not carry speaks in a Companion's voice
  // («…، قال عمر رضي الله عنه: …»، «وكان ابن عمر…»), the quotation mixes the marfūʿ with a saying
  // of a Companion, and the owner's contract is that such a mixture is credited to no book: the
  // atom does not carry THIS quotation, and the parentheses are not written off it.
  return !COMPANION_VOICE_RE.test(' ' + words.slice(cut).join(' ') + ' ');
}
// [b21] — the marks of a Companion speaking in the uncarried remainder of a quotation (folded).
const COMPANION_VOICE_RE = /(?:^| )(?:رضي الله عن(?:ه|ها|هما|هم)|قال(?:ت)? (?:ابن|ابو|عبد|عايشه|عائشه|انس|عمر|علي|جابر|معاذ|ابي)|(?:و|ف)?كان (?:ابن|ابو|عبد|عمر|انس)|قال الراوي|يقول (?:ابن|ابو|عبد))(?= |$)/u;

// ── م٣-ج (FULL_ANSWER_V1) · «المتنُ الطويل» — TWO SHORT ANCHORS, THE HEAD AND THE TAIL ─────────
//
// MEASURED (program-2026-09-24/03-answer/measure/B-bracket.md §7–§8): the one 60% anchor above breaks
// on a long matn at the first word the book prints that the answer does not. In Muslim that word is
// the printed «صلى الله عليه وسلم» after «رسول الله». The live witness H-N2 shipped «أن تشهدَ … سبيلًا»
// credited to «(ابن خزيمة · صحيح)» while Muslim 8 narrates exactly those words. The owner's fix plan
// (brain-night 06-fixplan R7) named the design: two short anchors instead of one. MEASURED on 894
// saved atoms and 135 matns, the four-word head and tail, in order, within 1.5× the matn's length,
// gain 13 carrier pairs on 4 matns with no cross-hadith match. Three anchor words admitted a
// different section of the Jibril hadith; four did not.
//
// THE BOUNDS ARE THE ONES MEASURED, AND [b21] STANDS: a Companion's voice in the words between the
// two anchors still refuses the carrier. THIS IS THE BRACKET'S EVIDENCE ONLY: `absorbAnswer` uses it
// with the switch on. `rulingWrittenFor` and the before-writing prophet check (loop.js) keep
// `atomCarriesMatn` exactly as it is.
const HEAD_TAIL_WORDS = 4;
const HEAD_TAIL_SPAN = 1.5;
const HEAD_TAIL_MIN_WORDS = 8;
export function atomCarriesMatnHeadTail(atomText, matn) {
  if (atomCarriesMatn(atomText, matn)) return true;
  const haystack = foldArabic(atomText);
  const needle = foldArabic(matn);
  if (!haystack || !needle) return false;
  const words = needle.split(' ').filter(Boolean);
  const n = words.length;
  if (n < Math.max(HEAD_TAIL_MIN_WORDS, 2 * HEAD_TAIL_WORDS)) return false;
  const head = words.slice(0, HEAD_TAIL_WORDS).join(' ');
  const tail = words.slice(n - HEAD_TAIL_WORDS).join(' ');
  const bound = Math.ceil(HEAD_TAIL_SPAN * needle.length);
  for (let from = 0; ;) {
    const h = haystack.indexOf(head, from);
    if (h < 0) return false;
    const t = haystack.indexOf(tail, h + head.length);
    if (t >= 0 && t + tail.length - h <= bound) {
      return !COMPANION_VOICE_RE.test(' ' + words.slice(HEAD_TAIL_WORDS, n - HEAD_TAIL_WORDS).join(' ') + ' ');
    }
    from = h + 1;
  }
}
// The matcher as it stands, under a second name, for the one caller that may choose between the two.
const STRICT_CARRIER = (atomText, matn) => atomCarriesMatn(atomText, matn);

// D3C T3: one attached letter in one word; every other folded letter must agree.
// No percentage anchor or pair of distant ends can establish the omitted middle.
export function atomCarriesMatnAttached(atomText, matn) {
  const canonical = value => foldArabic(String(value || '').replaceAll('ﷺ', 'صلى الله عليه وسلم'));
  const hay = canonical(atomText).split(' ').filter(Boolean);
  const words = canonical(matn).split(' ').filter(Boolean);
  if (!words.length) return false;
  for (let start = 0; start + words.length <= hay.length; start += 1) {
    let changes = 0;
    for (let i = 0; i < words.length; i += 1) {
      const a = hay[start + i], b = words[i];
      if (a === b) continue;
      if ((/^[بوفلك]/u.test(a) && a.slice(1) === b) || (/^[بوفلك]/u.test(b) && b.slice(1) === a)) changes += 1;
      else { changes = 2; break; }
      if (changes > 1) break;
    }
    if (changes <= 1) return true;
  }
  return false;
}

// ── §٣ · بابُ اختلافِ اللفظِ — ويُفتَحُ على مصراعٍ واحدٍ لا على مصراعَين ─────
//
// THE OWNER OPENED IT NARROW AND SAID WHY IN THE SAME BREATH: «الوكيلُ عرضَ بابَ اختلافِ
// اللفظِ ووصفَه بأنّه يوسّعُ ما يُعَدُّ حملًا للمتن. والتوسيعُ العامُّ يعيدُ خطرَ النسبةِ الكاذبةِ من بابٍ آخر.»
//
//   يُسمَح   بعد أن يوجد المتن في كتاب من السلم مطابقة تامة · استعلام الشيخين المضيّق
//            على المتن نفسه · استعلام كتب الحكم المضيّق على المتن نفسه
//   لا يُسمَح  الاكتشاف الأول للمتن · البحث العام في الـ٣٦ · مطابقة جزء من المتن ببعضه
//
// AND THE TOLERANCE IS THREE THINGS AND NOT A FOURTH. Two of them this module already folds away
// before it compares anything — التشكيل and علامات الاقتباس والترقيم, see `foldArabic`. The
// third is صيغة الإفراد والجمع في كلمة واحدة, and it is this function and nothing else in the tree.
//
// MEASURED on ezik-shamela-20260820 on 19 September 2026, and it is the whole reason the door is
// open at all: «إنما الأعمال بالنيات» narrowed to the two Ṣaḥīḥs returns البخاري twice and
// مسلم NOT AT ALL, because مسلم’s own wording is «إنما الأعمال بالنية». One word, singular
// against plural, and the most established hadith in the corpus was shipping as «(البخاري)».
// Asked with that one word switched, مسلم answers with the narration, and it is «(متفق عليه)».
//
// EXACTLY ONE WORD MOVES IN EACH VARIANT, and the rest of the matn is required letter for letter
// as it always was. This is not a looser comparison: it is a SECOND needle, tried only where the
// owner allowed one, and `atomCarriesMatn` is as strict about the variant as about the original.
/** How many one-word variants of a matn may be asked. A cap, so a long matn cannot fan out. */
export const LAFZ_MAX_VARIANTS = 2;

/**
 * The matn with the singular/plural form of ONE word switched — نيات ⇆ نية — bare of harakat.
 *
 * Built off `bareArabic` rather than the raw string because the ending a plural is recognised by
 * is buried under the model’s vocalisation: «بِالنِّيَّاتِ» does not end in «ات», and a rule that
 * cannot see that is a rule that fires on nothing.
 *
 * @returns {string[]}  at most LAFZ_MAX_VARIANTS strings, each differing in one word.
 */
// ── BATCH 4 [b28] · THE INTENDED WORD, INSIDE THE SAME RULE AND UNDER THE SAME CAP ──────────────
// MEASURED at 2aaf987 (EZIK-CX-M111 row 28) and unchanged at 92d3c7d: the walk took the FIRST words
// that end in «ة» or «ات», so «الصلاة على وقتها» became «الصلاات على وقتها» — a form no book writes —
// and in «النية والصدقة والأعمال بالنيات» the two variants the cap allows were spent on «النية» and
// «والصدقة» before «بالنيات», the word the door was opened for, was reached. The owner's ruling
// («موافق»): the function tries the INTENDED word inside its locked rule and under its cap. So the
// rule is the same one-word swap نيات ⇆ نية and the cap is still LAFZ_MAX_VARIANTS; what changed is
// which words are tried, and in what order:
//   · a word ending in «اة» is not tried: its «ة» sits on a long alif (الصلاة، الزكاة، الحياة) and
//     the swap writes «ااات», which is no plural at all — the measured «الصلاات»;
//   · a plural ending in «ات» is tried before any singular ending in «ة»: the plural read back to its
//     singular is the case the door was opened for (مسلم's «بالنية» against «بالنيات»), and a
//     singular's plural is the second needle, not the first;
//   · within each kind, in the order the words stand.
// Nothing about the comparison moved: each variant still differs in one word, and `atomCarriesMatn`
// holds a variant to every letter exactly as it holds the original.
function lafzSwap(word) {
  if (/ات$/u.test(word) && word.length > 3) return { kind: 0, swapped: word.slice(0, -2) + 'ة' };
  if (/ة$/u.test(word) && word.length > 2 && !/اة$/u.test(word)) return { kind: 1, swapped: word.slice(0, -1) + 'ات' };
  return null;
}
export function lafzVariants(matn) {
  const bare = bareArabic(matn);
  const words = bare.split(' ').filter(Boolean);
  const tries = [];
  for (let i = 0; i < words.length; i += 1) {
    const swap = lafzSwap(words[i]);
    if (swap) tries.push({ i, ...swap });
  }
  tries.sort((a, b) => a.kind - b.kind || a.i - b.i);
  const out = [];
  for (const t of tries) {
    if (out.length >= LAFZ_MAX_VARIANTS) break;
    const next = [...words];
    next[t.i] = t.swapped;
    const variant = next.join(' ');
    if (variant !== bare && !out.includes(variant)) out.push(variant);
  }
  return out;
}

// ── THE ISNAD DOOR ─────────────────────────────────────────────────────────
// Nothing in this module copies atom text into the answer, so an isnad cannot arrive by
// this path. The detector exists anyway, because a guard must be able to assert the
// property over DELIVERED text rather than over this file's good intentions.
const ISNAD_WORDS = ['حدثنا', 'أخبرنا', 'أنبأنا', 'ثنا', 'حدثني', 'أخبرني'];
const ISNAD_RE = new RegExp(alternation(ISNAD_WORDS), 'u');
// «عن فلان عن فلان» — two links of a chain standing together.
const ANANA_RE = new RegExp(
  '(?:^|\\s)' + tolerant('عن') + '\\s+\\S+\\s+' + tolerant('عن') + '\\s+\\S+', 'u',
);

/** True when a chain of transmission is showing. */
export function carriesIsnad(text) {
  const value = String(text == null ? '' : text);
  return ISNAD_RE.test(value) || ANANA_RE.test(value);
}

// ── THE PASS ───────────────────────────────────────────────────────────────

/**
 * Rewrite every quoted marfū‘ matn in an answer into the owner's shape.
 *
 * WITH THE SWITCH OFF THIS IS A NO-OP AND MAKES NO CALL — the text comes back identical and
 * `applied` is false. That is asserted by a guard rather than promised here.
 *
 * @param {string} text
 * @param {object} input
 * @param {Function} [input.lookup]  the ONE call; absent, nothing is looked up and every
 *                                   matn falls to (لا يثبت مرفوعا). §٢-د's «الوصل مطفأ» arm.
 * @param {object}  [input.env]
 * @returns {Promise<{text:string, applied:boolean, problems:string[], entries:object[]}>}
 */
export async function applyTakhrij(text, input = {}) {
  let original = String(text == null ? '' : text);
  const decision = takhrijDecision(input.env || process.env);
  if (!decision.enabled) {
    return { text: original, applied: false, problems: [], entries: [], reason: decision.reason };
  }
  // م٣-ب — FULL_ANSWER_V1, read from the same environment the pass's own switch is read from, so a
  // guard that states `env` states both. OFF unless exactly 'on'.
  const bracketAfterQuote = String((input.env || process.env).FULL_ANSWER_V1 || '').trim().toLowerCase() === 'on';

  // The prose matns AND the `<hadith>` cards, in the reader's own order — and separately, the
  // cards that repeat a matn the prose already carries (§٢).
  const found = findTargets(original);
  if (!found.targets.length && !found.duplicates.length) {
    if (bracketAfterQuote && asksGradeOrSource(input.question)) {
      const missing = 'لم أجد في المادة المسترجعة نص الحديث المسؤول عنه كاملًا للتحقق من لفظه وتخريجه وحكمه.';
      return { text: missing + '\n\n' + original, applied: true, problems: [], entries: [], reason: 'no_matn', gradingHead: missing };
    }
    return { text: original, applied: false, problems: [], entries: [], reason: 'no_matn' };
  }
  // The duplicates cost no lookup slot: they are dropped, not takhrij'd. So the ceiling is spent
  // on matns the reader will actually meet.
  let targets = found.targets.slice(0, TAKHRIJ_MAX_MATNS);
  // ١١١/٣ · AND EVERY MATN THE CAP DROPS LEAVES A RECORD. The records are built HERE, at the
  // line that drops them, and pushed onto `entries` at the end so the reader-facing walk below
  // is not disturbed by one character. Each one carries the matn’s own text exactly as the other
  // five `entries.push` sites do, and nothing else: no lookup was made for it, so there is
  // nothing else to say about it.
  const overCap = found.targets.slice(TAKHRIJ_MAX_MATNS).map((target) => ({
    matn: target.matn,
    parenthetical: '',
    companion: '',
    subjectIds: [],
    sourced: false,
    ruled: false,
    from: target.kind,
    rewritten: false,
    declined: 'over_matn_cap',
  }));
  let duplicates = found.duplicates;

  // ── THE TWO CALLS, AND WHY THERE ARE EXACTLY TWO ────────────────────────
  // §٢-ج: «أحاديث الجواب تُخرَّج في نداء واحد للمكتبة لا نداء لكل حديث». Phase one is that
  // one call: every matn of the answer goes down together, narrowed to the ladder.
  //
  // Phase two exists for one measured reason and fires for nothing else. MEASURED on
  // ezik-shamela-20260820: «إنما الأعمال بالنيات» came back with FC-000645 and WITHOUT
  // FC-000648, so the pass wrote «(البخاري)» — true, and less than the truth, because مسلم
  // has it too and the answer should read «(متفق عليه)». Ten globally-best rows are not ten
  // rows per book. So when exactly ONE of the two Shaykhs shows, and only then, the matns in
  // that position are asked again with the search narrowed to the two Sahihs alone.
  //
  // IT IS ONE EXTRA CALL FOR THE WHOLE ANSWER, NOT ONE PER HADITH. Every matn that needs the
  // recheck is collected first and they go down together, exactly as phase one does.
  // [111-log] — `call` still returns [] on every failure, exactly as it did; what it swallowed is
  // now kept in `callFailures` and returned beside the text, and api/ask.js prints it under
  // `[takhrij/call-fail]`. `n` is which call: 1 the ladder, 2 one Ṣaḥīḥ at a time, 3 the grade.
  // `q` is the matn asked for, the answer's own quotation, cut at 80 characters.
  const callFailures = [];
  const callOnce = async (matns, options, n, attempt) => {
    try {
      const answers = await input.lookup(matns, options);
      if (!Array.isArray(answers)) {
        callFailures.push({ call: n, attempt, status: 'not-a-list', error: typeof answers, q: String(matns[0] || '').slice(0, 80) });
        return null;
      }
      for (const answer of answers) {
        if (answer && answer.failure) {
          callFailures.push({ call: n, attempt, status: String(answer.failure.status), error: String(answer.failure.error), q: String(answer.matn || '').slice(0, 80) });
        }
      }
      return answers;
    } catch (error) {
      callFailures.push({ call: n, attempt, status: 'threw', error: String((error && error.message) || error).slice(0, 120), q: String(matns[0] || '').slice(0, 80) });
      return null;
    }
  };
  // ── BATCH 4 [b22] · A FAILED CALL IS ASKED ONCE MORE, AND NEVER SILENCES THE PARENTHESES ─────
  // MEASURED on the preview (EZIK-111-BATTERY-MEASURE §0-ط, T7; and «الطهور شطر الإيمان» at 92d3c7d):
  // the narrowed call added nothing and the reader got «(أبو داود · لم يوقف على حكم)» for «إنما الأعمال
  // بالنيات», or no parentheses at all — while on the twin the same code writes «(متفق عليه)» and
  // «(مسلم)». A call that failed was printed ([111-log]) and then taken as «the book has nothing».
  // The owner's contract: the failure is printed and asked AGAIN, once, and does not silence the
  // parentheses. So the matns whose answer failed (or the whole call, if it threw or answered no
  // list) are asked a second time with the same options; what the second attempt returns stands in
  // for the failed answer, and a second failure is printed too. Nothing else is retried.
  const call = async (matns, options, n) => {
    if (typeof input.lookup !== 'function' || !matns.length) return [];
    const first = await callOnce(matns, options, n, 1);
    if (first === null) return (await callOnce(matns, options, n, 2)) || [];
    const failed = first.filter((answer) => answer && answer.failure).map((answer) => answer.matn);
    if (!failed.length) return first;
    const again = await callOnce(failed, options, n, 2);
    if (!again) return first;
    const retried = new Map(again.filter((answer) => answer && !answer.failure).map((answer) => [answer.matn, answer]));
    return first.map((answer) => (answer && answer.failure && retried.has(answer.matn) ? retried.get(answer.matn) : answer));
  };
  const byMatn = (answers) => {
    const map = new Map();
    for (const answer of answers) {
      if (answer && typeof answer.matn === 'string') map.set(answer.matn, answer);
    }
    return map;
  };

  const first = byMatn(await call(targets.map((one) => one.matn), { bookIds: TAKHRIJ_LADDER_IDS }, 1));
  const states = targets.map((target) => {
    const state = { seen: [], confirmed: [], candidates: [], rulings: {} };
    // م٣-ج — the same switch as م٣-ب: with it on, this matn's bracket evidence may be carried by head and tail.
    if (bracketAfterQuote) state.headTail = true;
    // م٣-د — and the collector's own verdict, and the prose-grade stand-down, under the same switch.
    if (bracketAfterQuote) { state.fullAnswer = true; state.speechMatn = target.matn; }
    absorbAnswer(state, target.matn, first.get(target.matn));
    return state;
  });

  // ── AND A NARROWED REQUEST MAY CARRY ONE WORD'S VARIANT WITH IT (§٣) ───
  //
  // THE GATE IS THE FIRST ROW OF THE OWNER'S OWN TABLE: «بعدَ أن يُوجَدَ المتنُ في كتابٍ من السلَّمِ
  // مطابقةً تامّة». A matn no ladder book has been shown to carry gets NO variant and no second
  // wording — «الاكتشافُ الأوّلُ للمتن» is in the column he refused, because looking for an
  // unfound narration under a different lafz is the false-ascription door reopened from the side.
  // `state.confirmed` is exactly «found, completely, in a ladder book»: absorbAnswer only puts an
  // id there when the book's own atom carries the matn letter for letter.
  const variantsFor = (index) => (!bracketAfterQuote && states[index].confirmed.length
    ? lafzVariants(targets[index].matn) : []);
  const rechecking = [];
  for (let index = 0; index < targets.length; index += 1) {
    // ── THE TRIGGER WAS «ONE SHAYKH SHOWED», AND THAT IS WHY IT NEVER FIRED (§٣) ──
    //
    // The owner measured «إنما الأعمال بالنيات» leaving as «(البخاري)» when it is in both books,
    // and asked for the cause by the line. THIS IS THE LINE. The rule fired «متى ظهر أحد الشيخين
    // في النتائج ولم يظهر الآخر» — EXACTLY one of them among the returned rows — and the case it
    // was written for is not the case that happens.
    //
    // MEASURED on the live index on 19 September 2026, wide call, ladder-narrowed, top ten:
    //   «إنما الأعمال بالنيات»      -> six rows of إرواء الغليل, then البيهقي, فتح الباري,
    //                                   التلخيص ×2. NEITHER Shaykh in the ten.
    //   «أحي والداك؟…»              -> إرواء الغليل ×3, الطبراني ×2, النسائي ×2, البخاري (7th).
    //   «الزمها فإن الجنة…»         -> ابن أبي شيبة, السلسلة الضعيفة, أحمد… neither Shaykh.
    // Zero Shaykhs seen is not «one», so the narrowed request was never made — and the narrowed
    // request is the one that answers: asked for the two Ṣaḥīḥs ALONE it returns the narration
    // itself for «أحي والداك» from both books, which is «(متفق عليه)» and was «(لا يثبت مرفوعا)».
    //
    // SO IT FIRES WHENEVER BOTH ARE NOT ALREADY CONFIRMED, and it is still ONE extra call for the
    // whole answer, narrowed to two ids: everything it can add is a Shaykh, and a Shaykh is
    // exactly what «(متفق عليه)» needs proof of. Where both are already in hand it costs nothing.
    if (!shaykhaynIncomplete(states[index])) continue;
    rechecking.push({ index, query: targets[index].matn });
    // MEASURED on the live index, 19 September 2026: narrowed to the two Ṣaḥīḥs, «إنما الأعمال
    // بالنيات» returns البخاري twice and مسلم NOT AT ALL — مسلم's own wording is «بالنية». The
    // variant is the second needle and the ONLY tolerance in it is that one word's form.
    for (const query of variantsFor(index)) rechecking.push({ index, query });
  }
  // ── ١١١/٤ · AND THE NARROWED REQUEST IS ONE CALL PER BOOK, TEN ROWS EACH ─────
  //
  // THE ARGUMENT THIS PHASE ALREADY MAKES, CARRIED ONE STEP FURTHER. It exists because «ten
  // globally-best rows are not ten rows per book»: a matn book’s six copies of a narration push
  // a Shaykh off the page, so the ladder-wide call is asked again, narrowed. But narrowing to
  // the two Ṣaḥīḥs TOGETHER leaves exactly the same contest running between those two — ten
  // rows, best globally, shared. The fix for crowding is not a smaller field; it is one field
  // per book.
  //
  // MEASURED on ezik-shamela-20260820, 20 September 2026, narrowed and top ten:
  //
  //   «الصلاة على وقتها»   both books together   10 rows, ZERO carry the matn
  //                          البخاري alone         5 rows, TWO carry it
  //                          مسلم alone            10 rows, zero carry it
  //
  // Ten rows of مسلم that do not carry the matn were taking the page from five rows of
  // البخاري of which two do. The reader was told nothing about a hadith البخاري publishes.
  //
  // AND NOTHING ELSE MOVES. `atomCarriesMatn` is not touched by one character: what widened is
  // the number of CANDIDATES a book may put forward, never what counts as carrying the matn.
  // Phase one is untouched. The trigger is untouched — the calls are made only for matns where
  // `shaykhaynIncomplete` is still true. The matns still go down TOGETHER in the call for one
  // book, so this is one extra call for the whole answer and not one per hadith.
  //
  // MEASURED ON THE OTHER NINE, same index, same day: not one parenthetical changed to a
  // different book, and not one book already in hand was lost. `absorbAnswer` is additive by
  // construction — its own doc says so — so a second answer can only ADD witnesses.
  if (rechecking.length) {
    const queries = [...new Set(rechecking.map((one) => one.query))];
    for (const bookId of SHAYKHAYN_IDS) {
      const second = byMatn(await call(queries, { bookIds: [bookId] }, 2));
      // Absorbed against the QUERY that found it, never against the original: a row is confirmed
      // because its own text carries the words that were asked for, and asking for one thing while
      // checking for another is the near-neighbour mistake `atomCarriesMatn` exists to stop.
      for (const one of rechecking) absorbAnswer(states[one.index], one.query, second.get(one.query));
    }
  }

  // ── PHASE THREE · استعلامُ كتبِ الحكمِ المضيَّق (§٣) ────────────────────
  //
  // THE SECOND LEAF THE OWNER OPENED, and it stands on the same argument as the Shaykhayn
  // recheck: ten globally-best rows are not ten rows per book, so a grader that holds the matn
  // loses its place to six copies of a متن book and the reader is told «لم يوقف على حكم» about a
  // ruling that was there to be read. Narrowed to the graders alone, the grader gets its own ten.
  //
  // IT FIRES ON A NARROW STATE AND SPENDS NOTHING ANYWHERE ELSE — see `gradeStillOpen`: a matn
  // already published by a ladder متن book, below the two Ṣaḥīḥs (they need no grade), with no
  // stated ruling yet in hand. A matn nobody published is NOT asked, which is §٣'s first row
  // again; and because an outlet is already confirmed, nothing this phase can add is able to
  // reach «(لا يثبت مرفوعا)» — that branch of `composeParenthetical` is only for a matn with no
  // متن book at all.
  // ── ١١١/٤ · AND THIS PHASE IS *NOT* SPLIT PER BOOK, BECAUSE IT WAS MEASURED ────
  //
  // The same question was put to the five graders that the Ṣaḥīḥayn recheck answers yes to:
  // do a grader’s rows push another grader off the ten? MEASURED on ezik-shamela-20260820,
  // 20 September 2026, over ten matns — four established, four the owner’s own denial witnesses,
  // two silent:
  //
  //   graders found, all five asked together      23
  //   graders found, one call per grader          23      — ZERO gained, on every matn
  //
  // Not one row was crowded out, and the reason is visible in the counts: the graders answer
  // FEWER rows than the cap on these queries (one, two, five, seven) where the two Ṣaḥīḥs answer
  // ten. There is no contest for a page nobody fills. Splitting would multiply this phase’s
  // calls by five and buy nothing, so it is left exactly as it is.
  const ruling = [];
  for (let index = 0; index < targets.length; index += 1) {
    if (!gradeStillOpen(states[index])) continue;
    ruling.push({ index, query: targets[index].matn });
    for (const query of variantsFor(index)) ruling.push({ index, query });
  }
  if (ruling.length) {
    const third = byMatn(await call([...new Set(ruling.map((one) => one.query))],
      { bookIds: RULING_BOOK_IDS }, 3));
    for (const one of ruling) absorbAnswer(states[one.index], one.query, third.get(one.query));
  }

  const problems = [];
  const entries = [];
  // B2 (FULL_ANSWER_V1) — «ولا تسميةَ من حفظِ النموذج». A Companion the model named in front of a prose
  // matn leaves before anything is written; the book's own name, when it has one, is written below in the
  // lead-in that remains. The matns and their order do not move, so the looked-up states still line up.
  if (bracketAfterQuote) {
    const cuts = [];
    for (let index = 0; index < targets.length; index += 1) {
      const t = targets[index];
      if (t.kind !== 'prose') continue;
      const floorAt = index > 0 ? targets[index - 1].end : 0;
      const segAt = Math.max(floorAt, original.slice(0, t.start).search(/[^.!؟\n]*$/u));
      const opener = modelCompanionOpener(original, segAt, t.start);
      // ...but only where taking it out leaves a whole frame (B2_BEFORE_OPENER_RE, B2_AFTER_OPENER_RE):
      // otherwise the model's name stays, and the log says so.
      if (opener && (!B2_BEFORE_OPENER_RE.test(bareArabic(original.slice(segAt, opener.start)).trim())
        || !B2_AFTER_OPENER_RE.test(bareArabic(original.slice(opener.end, t.start))))) {
        problems.push(TAKHRIJ_MODEL_COMPANION_KEPT);
        continue;
      }
      if (opener) cuts.push(opener);
    }
    if (cuts.length) {
      let next = original;
      for (const c of cuts.sort((a, b) => b.start - a.start)) next = next.slice(0, c.start) + next.slice(c.end);
      const again = findTargets(next);
      const same = again.targets.length === found.targets.length
        && again.targets.every((t, k) => t.matn === found.targets[k].matn);
      if (same) {
        original = next;
        targets = again.targets.slice(0, TAKHRIJ_MAX_MATNS);
        duplicates = again.duplicates;
        problems.push(TAKHRIJ_MODEL_COMPANION_REMOVED);
      }
    }
  }
  // Rewritten back to front, so an earlier replacement cannot move a later offset. The dropped
  // duplicates travel in the SAME descending walk for that one reason: they are edits to the
  // same string, and a separate pass over them would be a pass over stale offsets.
  // Frame repairs are edits in the same descending walk, so every early output exit is covered.
  // If B2 replaces the whole lead itself, its narrator opener already settles this repair.
  const frameTargets = bracketAfterQuote ? findTargets(original).targets : targets;
  const provedSpeech = index => !!states[index]?.propheticSpeech && !states[index]?.narratorSpeech;
  const frameText = index => provedSpeech(index) ? 'قال رسول الله ﷺ: ' : 'نص الحديث: ';
  const frames = frameTargets.map((target, index) => bracketAfterQuote
    ? unprovedSpeechFrame(original, target, index > 0 ? frameTargets[index - 1].end : 0, provedSpeech(index)) : null);
  const consumedFrames = new Set();
  const edits = [
    ...frames.flatMap((frame, index) => frame ? [{ kind: 'frame', start: frame.start, frame, index }] : []),
    ...targets.map((target, index) => ({ kind: 'target', start: target.start, target, index })),
    ...duplicates.map((card) => ({ kind: 'duplicate', start: card.start, card })),
  ].sort((a, b) => a.start - b.start);
  let out = original;
  for (let step = edits.length - 1; step >= 0; step -= 1) {
    const edit = edits[step];
    if (edit.kind === 'frame') {
      if (!consumedFrames.has(edit.index) && edit.frame.replacement !== original.slice(edit.frame.start, edit.frame.end)) {
        out = out.slice(0, edit.frame.start) + edit.frame.replacement + out.slice(edit.frame.end);
        if (!provedSpeech(edit.index)) problems.push(TAKHRIJ_NARRATOR_FRAME);
        const entry = entries.findLast((one) => one.matn === frameTargets[edit.index].matn && !one.dropped)
          || overCap[edit.index - TAKHRIJ_MAX_MATNS];
        if (entry) { entry.frameRewritten = true; entry.frame = provedSpeech(edit.index) ? 'prophetic' : 'narration'; entry.rewritten = true; }
      }
      continue;
    }
    if (edit.kind === 'duplicate') {
      // §٢ — THE CARD GOES, AND WITH IT THE LINE IT STOOD ON. Its own newline is taken so the
      // answer does not keep a blank line where a repetition used to be; the prose on either
      // side is not touched by one character.
      const card = edit.card;
      if (bracketAfterQuote) {
        const index = targets.findIndex(target => sameMatn(target.matn, card.matn));
        const body = frameText(index) + composeHadith({ matn: card.matn, parenthetical: '' });
        out = out.slice(0, card.start) + body + out.slice(card.end);
        entries.push({ matn: card.matn, parenthetical: '', companion: '', from: 'card',
          rewritten: true, dissolved: true, dropped: false, declined: 'duplicate_kept_in_announcement' });
        continue;
      }
      let from = card.start;
      let to = card.end;
      if (out.slice(to, to + 1) === '\n') to += 1;
      else if (from > 0 && out.slice(from - 1, from) === '\n') from -= 1;
      out = out.slice(0, from) + out.slice(to);
      problems.push(TAKHRIJ_DUPLICATE_DROPPED);
      entries.push({
        matn: card.matn,
        parenthetical: '',
        companion: '',
        from: 'card',
        rewritten: false,
        dropped: true,
        declined: 'duplicate_of_prose',
      });
      continue;
    }
    const { index } = edit;
    const target = edit.target;
    const state = states[index];
    const parenthetical = composeParenthetical(state.confirmed, state.rulings);
    // م٣-د — the outlet is al-Tirmidhi, no grader ruled, and his own atom states his verdict: the
    // bracket names the verdict with its author, who is the outlet, so it cannot be misread.
    if (state.selfVerdict && parenthetical.text === `الترمذي · ${NO_RULING}`) {
      Object.assign(parenthetical, {
        text: `الترمذي · ${state.selfVerdict}`, grade: state.selfVerdict, ruled: true, ruledBy: 'سنن الترمذي',
      });
    }
    // THE TWO FENCES, HOISTED ABOVE EVERY EXIT. The deferred slot and §٢'s window are bounded by
    // the same two neighbours, and computing them once here is what lets an exit that writes NO
    // parentheses still dissolve a card across exactly the span the writing exits use.
    const floor = index > 0 ? targets[index - 1].end : 0;
    const ceiling = index + 1 < targets.length
      ? Math.max(target.end, targets[index + 1].leadStart) : -1;
    const isCard = target.kind === 'card';
    // ── §١ · THE CARD BECOMES PROSE AT EVERY EXIT, NOT ONLY AT THE ONE THAT WRITES ──
    //
    // WHAT THE OWNER READ ON HIS OWN PREVIEW ON 19 September, standing over the Prophet's words:
    //
    //     نص منقول
    //     سُئِلَ النَّبِيُّ صَلَّى اللهُ عَلَيْهِ وَسَلَّم: أَيُّ الْعَمَلِ أَفْضَلُ؟ قَالَ: الصَّلَاةُ عَلَى وَقْتِهَا…
    //
    // «نص منقول» is the fourth of the four confidence marks he ordered removed on 18 September,
    // and on 14 September he had already ruled by name that putting it over a hadith of the
    // Prophet ﷺ is an error in itself. It is written nowhere in this module: it is
    // `NEUTRAL_HADITH_LABEL` in app.jsx, the heading `HadithCard` prints whenever a SURVIVING
    // `<hadith>` card carries neither a narrator nor a ruling. So a card that survives this pass
    // is the whole of the defect, and the only place a card can survive is an exit that declines.
    //
    // AND THE PREVIOUS REVISION'S REASONING IS OVERTURNED HERE RATHER THAN SOFTENED. It read §١
    // of the silence order — «المتنُ يخرجُ عاريًا كما كانَ قبلَ بنائِنا» — as covering the card's own
    // `narrator` and `ruling` attributes too, and left the block standing in order to keep them.
    // The owner has now measured what that ships and ruled the other way: the mark may not reach
    // a reader's eye above a prophetic matn «بحال». The letters of the MATN are still untouched —
    // the block becomes «<المتن>» with nothing added to it and nothing taken out — which is the
    // half of «كما كانَ قبلَ بنائِنا» that was always about the narration rather than about a heading.
    const dissolveBare = () => {
      const body = (bracketAfterQuote && !frames[index] ? frameText(index) : '')
        + composeHadith({ companion: '', prayer: '', matn: target.matn, parenthetical: '' });
      out = out.slice(0, isCard ? Math.max(target.leadStart, floor) : target.start) + body + out.slice(target.end);
    };
    // D3A H2 — the C4 test is on all confirmed atoms, including those without B2's prayer.
    // An opening shared by different narrators cannot combine their books into one hadith's
    // parenthetical. Decline before proseProof too: that would lend the same mixed evidence to
    // an attribution the prose already states. H1's separate frame edit still runs afterwards.
    const hadithGroups = state.fullAnswer === true ? narratorGroups(state.narrators) : [];
    if (hadithGroups.length > 1) {
      const citedBooks = parenthetical.text === AGREED_UPON ? ['البخاري', 'مسلم'] : [String(parenthetical.text).split(' · ')[0]];
      const adjacent = bookCompanion((state.adjacent || []).filter((c) => citedBooks.includes(String(c.book).split('|').slice(1).join('|'))));
      if (adjacent.conflict) problems.push(TAKHRIJ_COMPANION_CONFLICT);
      problems.push(TAKHRIJ_COMPANION_MANY_HADITHS, TAKHRIJ_PARENTHETICAL_MANY_HADITHS);
      const separate = [...new Set(citedBooks)].filter(Boolean).map(book => {
        const ids = state.confirmed.filter(id => ladderRowFor(id)?.display === book);
        return composeParenthetical(ids, state.rulings).text;
      }).filter(Boolean);
      const body = (frames[index] ? '' : frameText(index))
        + composeHadith({ companion: '', prayer: '', matn: target.matn, parenthetical: '' })
        + separate.map(one => ` (${one})`).join('');
      out = out.slice(0, isCard ? Math.max(target.leadStart, floor) : target.start) + body + out.slice(target.end);
      entries.push({
        matn: target.matn,
        parenthetical: separate.join(') ('),
        withheld: parenthetical.text,
        companion: '',
        subjectIds: state.confirmed,
        narratorGroups: hadithGroups,
        separateCollectors: separate,
        sourced: separate.length > 0,
        ruled: separate.length > 0 && separate.every(one => one === 'البخاري' || one === 'مسلم'),
        from: target.kind,
        dissolved: isCard,
        rewritten: true,
        declined: 'combined_parenthetical_only',
      });
      continue;
    }
    // ── §١ · THE SEARCH FAILED, SO NOT ONE CHARACTER IS WRITTEN ───────────
    //
    // THE OWNER'S RULE, and it is the highest item of his order of 19 September: «وفشلُ البحثِ
    // ⟸ لا يُحقَنُ شيءٌ ألبتّة. المتنُ يخرجُ عاريًا كما كانَ قبلَ بنائِنا، ولا يُحذَفُ منه حرفٌ
    // ولا يُغيَّر.» Nothing is written HERE rather than something gentler being written: he
    // forbade the gentler wording too — «السكوتُ هو المطلوبُ بعينِه» — because any mark in this
    // position tells the reader something this pass did not measure.
    //
    // AND THE CARD STILL DISSOLVES HERE — `dissolveBare` above carries the ruling that overturned
    // the opposite reading. NOTHING IS WRITTEN: the block becomes the matn it already held, in
    // guillemets, with no parentheses, no Companion, and not one letter added or removed.
    if (parenthetical.silent) {
      problems.push(TAKHRIJ_SILENT);
      if (isCard || bracketAfterQuote) dissolveBare();
      entries.push({
        matn: target.matn,
        parenthetical: '',
        companion: '',
        subjectIds: state.confirmed,
        rulingsByBook: rulingsByBook(state),
        head: target.head === true,
        sourced: false,
        ruled: false,
        silent: true,
        from: target.kind,
        dissolved: isCard,
        rewritten: isCard,
        declined: 'search_found_nothing',
      });
      continue;
    }
    // ── §٢ · AND A NAME THE PROSE ALREADY WROTE IS NOT ARGUED WITH ────────
    // `statedAttributionNear` holds the whole of the reasoning. Here it costs the parentheses and
    // nothing else: a CARD still dissolves, because a reader who is owed the attribution his own
    // answer already gives him is owed it as prose and not under a «نص منقول» heading.
    const stated = statedAttributionNear(original, target, floor, ceiling);
    if (stated) {
      problems.push(TAKHRIJ_PROSE_ATTRIBUTION);
      if (isCard || bracketAfterQuote) dissolveBare();
      entries.push({
        matn: target.matn,
        parenthetical: '',
        // What WOULD have been written, so the record beside the answer shows the pass had an
        // answer and withheld it — and shows the two side by side for whoever reads the log.
        withheld: parenthetical.text,
        proseAttribution: stated,
        // [111-e55] — and what the library proved for THIS matn goes to the seal, so the prose's own
        // credit is kept as far as the atoms carry it and no further (see `proseProofFor`).
        proseProof: proseProofFor(state, parenthetical),
        companion: '',
        subjectIds: state.confirmed,
        sourced: false,
        ruled: false,
        from: target.kind,
        dissolved: isCard,
        rewritten: isCard,
        declined: 'prose_states_attribution',
      });
      continue;
    }
    // ── م٣-د · «ولا يناقضُ القوسُ النصّ» ──────────────────────────────────────
    // A bracket that can only say «لم يوقف على حكم» is not written beside a grade the prose states
    // for the same matn: the reader would read «no ruling was found» against «حسن غريب» two words
    // away. It stands down exactly as §٢'s attribution exit does, and what it would have written
    // stays in the record.
    if (state.fullAnswer === true && parenthetical.text.endsWith(' · ' + NO_RULING)) {
      const proseGrade = statedGradeNear(original, target, floor, ceiling);
      if (proseGrade) {
        problems.push(TAKHRIJ_PROSE_GRADE);
        if (isCard || bracketAfterQuote) dissolveBare();
        entries.push({
          matn: target.matn,
          parenthetical: '',
          withheld: parenthetical.text,
          proseGrade,
          companion: '',
          subjectIds: state.confirmed,
          sourced: false,
          ruled: false,
          from: target.kind,
          dissolved: isCard,
          rewritten: isCard,
          declined: 'prose_states_grade',
        });
        continue;
      }
    }
    // AND «(لا يثبت مرفوعا)» IS NOW A RULING THAT WAS FOUND, not a search that failed: it is
    // reached only through a ladder grader's stated ruling (lib/takhrij-ladder.js). The code
    // keeps its name because it names what the READER is told — «this is not established» —
    // and `TAKHRIJ_SILENT` above is the one that means «we found nothing».
    const denied = parenthetical.text === NOT_RAISED;
    if (denied) problems.push(TAKHRIJ_UNSOURCED);
    // ── THE COMPANION NEEDS TWO BOOKS, AND SAYS SO WHEN HE HAD ONE ───────
    const agreed = agreedCompanion(state.candidates);
    if (!agreed.name && state.candidates.length && state.fullAnswer !== true) problems.push(TAKHRIJ_COMPANION_UNCONFIRMED);
    // B2 (FULL_ANSWER_V1) — the name is the narrator next to the Prophet ﷺ as the book's own text gives him.
    // «نصُّ الكتابِ المسترجَعِ نفسُه» — the book the parentheses name: a Companion out of another book's
    // narration is not the narrator of the one being cited (measured: «لا ضرر ولا ضرار» (أحمد · صحيح) with
    // Abū Saʿīd out of al-Ḥākim's atom, where Aḥmad narrates it from Ibn ʿAbbās and ʿUbāda).
    const shown = parenthetical.text === AGREED_UPON ? ['البخاري', 'مسلم'] : [String(parenthetical.text).split(' · ')[0]];
    let b2 = state.fullAnswer === true
      ? bookCompanion((state.adjacent || []).filter((c) => shown.includes(String(c.book).split('|').slice(1).join('|'))))
      : null;
    if (b2 && b2.conflict) problems.push(TAKHRIJ_COMPANION_CONFLICT);
    // D3A H2 has already declined the C4 multiple-hadith case, including its Companion.
    // ...and it is written only where a verb of the lead-in gives it a place: «قول النبي ﷺ: «…»» keeps its
    // salutation and its sentence, and takes the parentheses alone.
    // ...and never a second opener: where a Companion with the prayer still stands in the matn's own
    // sentence (the model's, kept above), the book's name is not written beside it (D61).
    if (b2 && b2.name && !isCard && B2_PRAYER_IN_LEAD_RE.test(bareArabic(original.slice(
      Math.max(floor, original.slice(0, target.start).search(/[^.!؟\n]*$/u)), target.start)))) {
      if (!problems.includes(TAKHRIJ_MODEL_COMPANION_KEPT)) problems.push(TAKHRIJ_MODEL_COMPANION_KEPT);
      b2 = { name: '', prayer: '', books: 0 };
    }
    if (b2 && b2.name && !isCard) {
      const lead = original.slice(Math.max(target.leadStart, floor), target.start);
      if (lead.trim() && !new RegExp('^(?:' + alternation(LEAD_VERB_WORDS) + ')(?=[\\s،؛:])', 'u').test(lead)) {
        problems.push(TAKHRIJ_COMPANION_NO_LEADIN);
        b2 = { name: '', prayer: '', books: 0 };
      }
    }
    // ── A DENIAL TAKES NO COMPANION ────────────────────────────────────────
    // Putting a Companion in front of a sentence that says exactly «this is not established»
    // asserts a narration in the same breath as denying it. The name is dropped with it.
    const named = denied ? { name: '', prayer: '', books: 0 } : (b2 || agreed);
    let sentence = composeHadith({
      companion: named.name, prayer: named.prayer, matn: target.matn, parenthetical: parenthetical.text,
    });
    if (bracketAfterQuote && (named.name || !frames[index])) sentence = sentence.replace('«', frameText(index) + '«');
    if (carriesIsnad(sentence)) {
      // Refuse the rewrite rather than ship a chain — and a CARD still dissolves, because
      // dissolving adds no chain: the body written is the body the card already held. What is
      // refused is the Companion's opener and the parentheses, the only two things this pass
      // would have ADDED to it.
      problems.push(TAKHRIJ_ISNAD_REFUSED);
      if (isCard) dissolveBare();
      entries.push({
        matn: target.matn, parenthetical: parenthetical.text, companion: '',
        from: target.kind, dissolved: isCard, rewritten: isCard, declined: 'isnad_showing',
      });
      continue;
    }
    // ── WHERE THE PARENTHESES MAY STAND, BEFORE ANYTHING IS WRITTEN (§٣) ──
    // The ceiling is the next matn's own lead-in: a deferred parenthetical that crossed it would
    // attach itself to somebody else's hadith. It can never be earlier than this matn's end, so a
    // pair of matns inside one sentence declines rather than guesses. It is computed above now,
    // together with the floor, because §٢'s window is fenced by those very same two neighbours.
    const slot = parentheticalSlot(original, target, ceiling, { afterQuote: bracketAfterQuote });
    if (!slot) {
      // «متنٌ بلا تخريجٍ أهونُ من جملةٍ مكسورة» — the parentheses are declined and the matn stays
      // exactly as the model wrote it. A CARD still dissolves: a card is a block of its own and
      // has no running sentence to break, so §١'s ruling and this one never meet.
      problems.push(TAKHRIJ_NO_SLOT);
      if (isCard) dissolveBare();
      entries.push({
        matn: target.matn, parenthetical: parenthetical.text, companion: '',
        sourced: parenthetical.sourced, from: target.kind, dissolved: isCard,
        rewritten: isCard, declined: 'no_safe_slot',
      });
      continue;
    }
    // The lead-in goes ONLY when the Companion replaces it — and never further back than the
    // end of the matn before it, so two hadiths in one sentence cannot be spliced into one.
    // A CARD's `leadStart` is the card's own opening tag, so the block goes whole either way.
    const at = (named.name || isCard)
      ? Math.max(target.leadStart, floor) : target.start;
    // THIRD ORDER, STEP 4-أ — MEASURED on the preview: «…آخر عهده بالبيت»عن ابن عباس رضي الله
    // عنهما: «…» (متفق عليه)». The opener replaced a lead-in that sat flush against the matn before
    // it, and nothing put the space back. An opener that follows anything but whitespace or the
    // start of the text is written with one space in front of it — whitespace only, no letter.
    if (frames[index] && at <= frames[index].start) consumedFrames.add(index);
    else if (named.name && frames[index]) frames[index].replacement = '';
    const gap = named.name && at > 0 && !/\s/u.test(out[at - 1]) ? ' ' : '';
    if (slot.deferred) {
      // The parentheses first, because they stand AFTER the matn: inserting them cannot move the
      // offsets of the replacement below, while the replacement would move theirs.
      out = out.slice(0, slot.at) + ` (${parenthetical.text})` + out.slice(slot.at);
      let body = composeHadith({
        companion: named.name, prayer: named.prayer, matn: target.matn, parenthetical: '',
      });
      if (bracketAfterQuote && (named.name || !frames[index])) body = body.replace('«', frameText(index) + '«');
      out = out.slice(0, at) + gap + body + out.slice(target.end);
    } else {
      out = out.slice(0, at) + gap + sentence + out.slice(target.end);
    }
    // BATCH 4 [b23] — the form of weakening before a hadith the library just proved sound.
    const tamrid = strengthenTamrid(out, floor, at, parenthetical);
    if (tamrid.changed) out = tamrid.text;
    entries.push({
      tamridStrengthened: tamrid.changed,
      matn: target.matn,
      parenthetical: parenthetical.text,
      companion: named.name,
      companionBooks: named.books || 0,
      subjectIds: state.confirmed,
      sourced: parenthetical.sourced,
      ruled: parenthetical.ruled === true,
      // ── AND WHO RULED, WHEN THE READER IS TOLD «لا يثبت مرفوعا» (§١/٤) ───
      // The parentheses carry the RULING and never the ruler's name — the owner's shape has no
      // room for it there — so the record beside the answer carries him instead. A denial with
      // this field empty is a denial nobody made, which is precisely what the guard's new row
      // refuses to let out.
      ruledBy: String(parenthetical.ruledBy || ''),
      grade: parenthetical.grade || null,
      rulingsByBook: rulingsByBook(state),
      head: target.head === true,
      // Where the parentheses went, so a guard reads the ruling and not only its effect.
      from: target.kind,
      deferred: slot.deferred === true,
      // م٣-ب — true when FULL_ANSWER_V1 put a bracket the old rule would have deferred right after
      // its matn's closing mark.
      governed: slot.governed === true,
      // ── WHAT THE DELIVERY SEAL IS OWED (api/ask.js:1049) ─────────────────
      // «(متفق عليه)» is the ONE string this pass writes that lib/takhrij-lock.js reads as an
      // attribution, and that lock drops any sentence whose attribution no fetched page carries.
      // The pages that carry THIS one are the ladder rows the library just confirmed, so they are
      // handed over by name. Nothing else travels: no atom text, and no name for a parenthetical
      // this pass did not write.
      sealProof: parenthetical.text === AGREED_UPON
        ? state.confirmed.map((id) => (ladderRowFor(id) || {}).display).filter(Boolean)
        : [],
      rewritten: true,
    });
  }
  entries.reverse();
  if (bracketAfterQuote) {
    for (const entry of entries) {
      const ids = entry.subjectIds || [];
      const provenBooks = ids.map(ladderRowFor).filter(row => row && !row.grader).map(row => row.display);
      if (provenBooks.length && !entry.separateCollectors) entry.proseProof = [...new Set(provenBooks)];
      const grade = ids.some(isShaykhayn) ? 'صحيح' : entry.grade;
      if (provenBooks.length && grade) entry.authenticityProof = {
        matn: entry.matn, books: [...new Set(provenBooks)], grade, separate: !!entry.separateCollectors,
      };
    }
  }
  // ١١١/٣ · THE CAP’S OWN RECORDS, AND ITS CODE, ADDED AFTER THE WALK. `problems` is a list
  // of codes and `entries` a list of records; appending here rather than inside the walk keeps
  // the rewritten text byte-identical to what it was before this change, which is the whole
  // claim of ١١١/٣: three traces and ZERO behaviour.
  if (overCap.length) {
    problems.push(TAKHRIJ_CAP_REACHED);
    entries.push(...overCap);
  }
  // ── AND THE PASS COUNTS ITSELF, IN FOUR NUMBERS AND NOTHING ELSE ──────────
  // NO `console.log` IS ADDED TO THIS MODULE. It has none today and keeps none: the counts ride
  // back on the return value and api/ask.js prints them at the seat that already prints
  // `[takhrij]`. That is also what keeps them out of a guard’s way — the module stays drivable
  // with no logger in the process.
  //
  // AND NOT ONE OF THE FOUR IS DERIVED FROM ANYTHING THE READER TYPED. `found` is how many
  // quoted matns the ANSWER held, `examined` how many were looked up, `dropped` how many the cap
  // refused, `emitted` how many left this pass wearing parentheses. Four integers.
  const trace = {
    found: found.targets.length,
    examined: targets.length,
    dropped: overCap.length,
    emitted: entries.filter((entry) => entry.parenthetical).length,
  };
  // THIRD ORDER, STEP 4-ب — MEASURED on the preview: ««رفع القلم عن ثلاثة…»» and then a line
  // opening «، والعبد لا يلزمه الحج…». The reviewer sets a card on a line of its own; when this pass
  // dissolves the card into its matn, the clause that followed it keeps the comma it opened on.
  // A line or a sentence never opens on a comma: the comma rejoins the line before it, and after
  // an end mark it goes. Whitespace and that one separator only; no word is touched. Applied only
  // to what this pass changed, so an untouched answer stays byte-identical.
  if (out !== original) {
    out = out
      .replace(/\n[ \t]*[،,][ \t]*/gu, '، ')
      .replace(/([.؟!])[ \t]*[،,][ \t]*/gu, '$1 ');
  }
  // BATCH 4 [b27] — a question about the grade, the grader or the source is answered first.
  // [111-b27b] — and the head speaks of the text the reader asked about, and of nothing else.
  const head = await headForTheAskedText(input, entries, callFailures, gradingHead(input.question, entries, callFailures));
  if (head) out = head + '\n\n' + out;
  return { text: out, applied: out !== original, problems: [...new Set(problems)], entries, trace, callFailures, reason: 'applied', gradingHead: head };
}

// ── BATCH 4 [b27] · A QUESTION ABOUT THE GRADE AND THE SOURCE HAS A HEAD ──────────────────────
// MEASURED on the owner's battery (EZIK-SIDE-111-HANDOFF-2026-09-21-B row ٢٧): the ḥāʾiḍ question
// asked for the grade and came back with none; «طلب العلم» asked «ومن حكم عليه؟» and nobody was
// named; and at 92d3c7d «الطهور شطر الإيمان من رواه؟» was not answered. The parentheses were written
// beside the matn, deep in the answer, or not at all — and the question itself was never answered.
// The owner's contract: such a question is answered FIRST by what the library proved — the book,
// and the grade with the ladder grader who wrote it — or by saying plainly that the library did not
// prove it; never a denial that it exists; a split verdict is said split, with its graders, and
// nothing is preferred.
//
// THE HEAD IS BUILT ONLY FROM THIS PASS'S OWN RECORD of the one matn the answer carries: the text
// between its parentheses, the grade and the grader books the atoms wrote. It is written without a
// verb of transmission («أخرجه»، «رواه») because lib/takhrij-lock.js reads those as attributions to
// be proved by a page, and a head the seal deleted would be a head the reader never saw — the same
// reason the parentheses carry no verb. NARROW ON PURPOSE: one matn only (with several, each already
// carries its own parentheses and a head would have to choose), no head where the prose already
// states its own attribution or the pass declined to write, and no «not proved» head where a library
// call failed — a failure is not a search that found nothing.
const WHO_OR_GRADE_WORDS = ['من رواه', 'من أخرجه', 'من خرجه', 'من حكم عليه', 'من صححه', 'من ضعفه', 'درجته',
  'درجتها', 'درجة الحديث', 'تخريجه', 'تخريجها', 'ما صحته', 'ما صحتها', 'هل حديث', 'هل يصح', 'هل صح', 'هل ثبت',
  'هل يثبت'];
const WHO_OR_GRADE_RE = new RegExp('(?<![\\u0621-\\u064A])[وف]?' + alternation(WHO_OR_GRADE_WORDS) + '(?![\\u0621-\\u064A])', 'u');
export function asksGradeOrSource(question) {
  const q = String(question == null ? '' : question);
  return !!q.trim() && (asksForGrading(q) || WHO_OR_GRADE_RE.test(q));
}
function rulingsByBook(state) {
  const out = [];
  const rulings = state && state.rulings ? state.rulings : {};
  for (const id of (state && state.confirmed) || []) {
    const row = ladderRowFor(id);
    if (!row || !row.grader) continue;
    for (const word of Array.isArray(rulings[id]) ? rulings[id] : []) {
      if (!out.some((x) => x.by === row.display && x.word === String(word))) out.push({ by: row.display, word: String(word) });
    }
  }
  return out;
}
const books = (list) => list.join(' و');
// ── [111-e55] · THE PROSE'S CREDIT IS HELD TO WHAT THE LIBRARY PROVED ─────────────────────────
// MEASURED on the owner's battery (EZIK-111-FIXROUND-REPORT-2026-09-22, question 10): the whole answer
// was «حديث «الكلمة الطيبة صدقة» رواه البخاري ومسلم …». This pass found «البخاري» in the library and
// withheld its parentheses because the prose had already credited the matn (§٢ above); the seal found
// no page carrying «رواه البخاري ومسلم», condemned the sentence, and b26 took the matn with it — and
// the reader got nothing. Question 1 lost «رواه البخاري ومسلم» the same way and kept a bare matn.
// THE OWNER'S RULING (fix round 2, item ١): the books whose OWN atoms carried this matn travel to the
// seal, which keeps the prose's credit as far as they reach and cuts what goes beyond them. Nothing
// is added: no book the prose did not name, and no parentheses beside the prose. A grader is not a
// مخرّج and is not handed over; a matn the ladder ruled not raised hands over nothing.
function proseProofFor(state, parenthetical) {
  if (!parenthetical || parenthetical.text === NOT_RAISED) return [];
  const out = [];
  for (const id of (state && state.confirmed) || []) {
    const row = ladderRowFor(id);
    if (row && !row.grader && !out.includes(row.display)) out.push(row.display);
  }
  return out;
}
export const GRADING_HEAD_NOT_PROVED = 'لم تُثبت المكتبة تخريج هذا الحديث في كتب السنة التي بحثنا فيها، وليس في ذلك نفيٌ لوجوده.';
export function gradingHead(question, entries, callFailures = []) {
  if (!asksGradeOrSource(question)) return '';
  const own = (Array.isArray(entries) ? entries : []).filter((e) => e.declined !== 'over_matn_cap');
  if (own.length !== 1) return '';
  const e = own[0];
  const by = Array.isArray(e.rulingsByBook) ? e.rulingsByBook : [];
  const words = [...new Set(by.map((x) => x.word))];
  const split = words.length > 1
    ? 'والحكم عليه مختلف: ' + words.map((w) => w + ' في ' + books(by.filter((x) => x.word === w).map((x) => x.by))).join('، و')
    : '';
  if (e.silent) {
    if (split) return split.replace(/^و/u, '') + '.';
    return Array.isArray(callFailures) && callFailures.length ? '' : GRADING_HEAD_NOT_PROVED;
  }
  if (e.declined || !e.parenthetical) return '';
  const p = String(e.parenthetical);
  const graders = String(e.ruledBy || '').split('، ').filter(Boolean);
  // R5 — every head opens with TAKHRIJ_LADDER_HEAD (lib/policy/takhrij-disclosure.js), so the
  // disclosure tail can recognise a grade this pass proved and stand down instead of denying it.
  if (p === AGREED_UPON) return TAKHRIJ_LADDER_HEAD + 'البخاري ومسلم.';
  if (p === 'البخاري' || p === 'مسلم') return e.head ? '' : TAKHRIJ_LADDER_HEAD + p + '.';
  if (p === NOT_RAISED) {
    return 'الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم'
      + (graders.length && e.grade ? '، والحكم عليه في ' + books(graders) + ': ' + e.grade : '') + '.';
  }
  const [outlet, grade] = p.split(' · ');
  if (!outlet || !grade) return '';
  if (grade === NO_RULING) return TAKHRIJ_LADDER_HEAD + outlet + '، ' + (split || 'ولم تُثبت المكتبة حكمًا عليه') + '.';
  if (!graders.length) return '';
  return TAKHRIJ_LADDER_HEAD + outlet + '، والحكم عليه في ' + books(graders) + ': ' + grade + '.';
}

// ── [111-b27b] · THE HEAD SPEAKS OF THE TEXT THAT WAS ASKED ABOUT, AND OF NOTHING ELSE ─────────
// MEASURED on the owner's battery (the batch-4 preview 7f671f7, 22 Sep, question 2): «حديث «خير الأسماء ما
// حمد وعبد» هل له أصل؟» opened on «تخريج الحديث: أبو داود، ولم تثبت المكتبة حكما عليه.» The one matn in
// the answer was ANOTHER hadith («أحب الأسماء إلى الله عبد الله وعبد الرحمن…»), and b27 headed the answer
// with that matn's book — the asked text credited to a book that does not narrate it.
// THE OWNER'S CONTRACT: the head speaks of the text quoted in the question alone. Where the answer's one
// matn is that text by the rule this pass already matches two matns with (`sameMatn`), the head is
// b27's, byte for byte. Where it is not, the asked text is looked up on its own, through the same one
// lookup, and the head says what the library proves for it, or «لم تُثبت المكتبة هذا اللفظ…» — never a
// denial, and never the book of another matn. The other matn keeps its parentheses where they stand.
// A question that quotes nothing, and an answer whose head b27 did not write, are b27's exactly.
export const GRADING_HEAD_LAFZ_NOT_PROVED = 'لم تُثبت المكتبة هذا اللفظ في كتب السنة التي بحثنا فيها، وليس في ذلك نفيٌ لوجوده.';
function askedText(question) {
  const found = String(question == null ? '' : question).match(new RegExp(QUOTE_RE.source, 'u'));
  return found ? String(found[1] || found[2] || '').trim() : '';
}
// م٣-هـ (FULL_ANSWER_V1) — «المكتبة… بحثنا». Every «المكتبة/بحثنا» in 5,555 delivered sentences is one of
// the three sentences this pass composes (03-answer/measure/D-mechanism.md R6). With the switch on
// they are said in the answer's own voice, «لم أقف», and name no machinery. What they say is unchanged:
// nothing was found, and that denies nothing.
export const GRADING_HEAD_NOT_PROVED_OWN = 'لم أقف على تخريج هذا الحديث في كتب السنة المسندة، وليس في ذلك نفيٌ لوجوده.';
export const GRADING_HEAD_LAFZ_NOT_PROVED_OWN = 'لم أقف على هذا اللفظ في كتب السنة المسندة، وليس في ذلك نفيٌ لوجوده.';
const NO_RULING_HEAD_TAIL = 'ولم تُثبت المكتبة حكمًا عليه';
const NO_RULING_HEAD_TAIL_OWN = 'ولم أقف على حكمٍ عليه';
function headInOwnVoice(head) {
  if (head === GRADING_HEAD_NOT_PROVED) return GRADING_HEAD_NOT_PROVED_OWN;
  if (head === GRADING_HEAD_LAFZ_NOT_PROVED) return GRADING_HEAD_LAFZ_NOT_PROVED_OWN;
  return typeof head === 'string' ? head.split(NO_RULING_HEAD_TAIL).join(NO_RULING_HEAD_TAIL_OWN) : head;
}
async function headForTheAskedText(input, entries, callFailures, head) {
  const said = await headForTheAskedTextOnce(input, entries, callFailures, head);
  const on = String(((input && input.env) || process.env).FULL_ANSWER_V1 || '').trim().toLowerCase() === 'on';
  return on ? headInOwnVoice(said) : said;
}
async function headForTheAskedTextOnce(input, entries, callFailures, head) {
  if (!head) return head;
  const asked = askedText(input.question);
  if (!asked) return head;
  const own = (Array.isArray(entries) ? entries : []).filter((e) => e.declined !== 'over_matn_cap');
  if (own.length !== 1 || sameMatn(own[0].matn, asked)) return head;
  const alone = await applyTakhrij('قال رسول الله صلى الله عليه وسلم: «' + asked + '».', { env: input.env, lookup: input.lookup });
  for (const failure of alone.callFailures || []) callFailures.push({ ...failure, asked: true });
  const said = gradingHead(input.question, alone.entries || [], alone.callFailures || []);
  const full = String((input.env || process.env).FULL_ANSWER_V1 || '').trim().toLowerCase() === 'on';
  if (full && said === GRADING_HEAD_NOT_PROVED && own.some(entry => entry.sourced || entry.proseProof?.length)) {
    return head + '\n\n' + 'هذا تخريج اللفظ الوارد في الجواب؛ أما اللفظ المسؤول عنه فلم أجده كاملًا في المادة المسترجعة.';
  }
  return said === GRADING_HEAD_NOT_PROVED ? GRADING_HEAD_LAFZ_NOT_PROVED : said;
}

// ── م٣-و (FULL_ANSWER_V1) · «الحكمُ المكرّرُ في صدرِ «حب الوطن»» ─────────────────────────────
//
// MEASURED (program-2026-09-24/03-answer/measure/D-mechanism.md §3.1): the owner's answer opened
// «الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم، والحكم عليه في السلسلة الضعيفة: موضوع.» (this
// pass's head, byte for byte) and then «لا، هذا الكلام ليس حديثا نبويا صحيحا، بل هو موضوع…» (the
// model's own first sentence). One ruling, read twice. The head is what stands down, never the
// model's sentence: dropping that sentence would have cut content in 4 of 4 measured cases.
//
// THE RULE, AS MEASURED: the head goes when the answer's first PROSE sentence (not a line that opens
// on a quotation or a card) carries every verdict token the head carries, as whole words: the
// outlet (for «البخاري ومسلم» also «متفق عليه/الشيخان/الشيخين/الصحيحين»), and the grade it prints, both read
// off the head's own words: the head may speak of the ASKED text, whose entry is not the answer's. A head that
// states no verdict («لم يوقف…», «لم أقف…», «لم تُثبت…») never stands down. On the 21 delivered heads
// this took the owner's witness and 3 true restatements, and nothing else.
const RESTATED_AGREED = ['متفق عليه', 'الشيخان', 'الشيخين', 'الصحيحين', 'البخاري ومسلم'];
export function headRestatedBy(head, body) {
  const text = String(head || '').trim();
  if (!text || /لم تُثبت|لم تثبت|لم أقف|لم يوقف|مختلف/u.test(text)) return false;
  let tokens = null;
  const raised = /^الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم، والحكم عليه في .+?: (.+)\.$/u.exec(text);
  if (raised) tokens = [[raised[1]]];
  else if (text.startsWith(TAKHRIJ_LADDER_HEAD)) {
    const rest = text.slice(TAKHRIJ_LADDER_HEAD.length).replace(/\.$/u, '');
    const graded = /^(.+?)، والحكم عليه في .+?: (.+)$/u.exec(rest);
    if (graded) tokens = [[graded[1]], [graded[2]]];
    // A joint credit also repeats either collector's name. This suppresses a
    // redundant heading only; the seal still judges the joint credit itself.
    else if (!rest.includes('،')) tokens = [rest === 'البخاري ومسلم' ? RESTATED_AGREED
      : rest === 'البخاري' || rest === 'مسلم' ? [rest, ...RESTATED_AGREED] : [rest]];
  }
  if (!tokens) return false;
  const line = String(body || '').split('\n').map((l) => l.trim()).find((l) => l && !/^[«<"]/u.test(l)) || '';
  const sentence = (line.match(/^[^.؟!]*[.؟!]?/u) || [''])[0];
  const words = ' ' + foldArabic(sentence) + ' ';
  return tokens.every((alts) => alts.some((t) => words.includes(' ' + foldArabic(t) + ' ')));
}

// ── BATCH 4 [b23] · «رُوي» DOES NOT STAND BEFORE A SOUND HADITH ─────────────────────────────
// «رُوي»، «فيما رُوي»، «يُروى» are the muhaddithin's form of WEAKENING. Before a hadith this pass has
// just proved to be in the two Ṣaḥīḥs, or graded «صحيح/حسن» by a grader's written ruling, they
// tell the reader the opposite of what the library says. The owner's contract: they are replaced by
// the least that is true — «ثبت» — and are not touched before a weak one, or where nothing was
// proved. Only the passive forms are read: «روى» with its alif maqṣūra is the active verb («روى أبو
// هريرة»), a narrator named, and is none of this. The search runs from the previous matn's end to
// where this matn's lead-in begins, in the same sentence, and takes the LAST such form.
const TAMRID_RE = /(?<![ء-ي])([وف]?)(فيما\s+)?(?:رُو[ِ]?ي[َ]?|روي|يُرو[َ]?ى|يروى)(?![ء-يً-ْ])/gu;
const SOUND_PARENTHETICAL_GRADES = new Set(['صحيح', 'حسن', 'صحيح لغيره', 'حسن لغيره']);
function strengthenTamrid(text, floor, at, parenthetical) {
  const sound = parenthetical && (parenthetical.text === AGREED_UPON || parenthetical.text === 'البخاري'
    || parenthetical.text === 'مسلم' || SOUND_PARENTHETICAL_GRADES.has(parenthetical.grade));
  if (!sound || at <= 0) return { text, changed: false };
  const from = Math.max(0, floor || 0);
  const window = text.slice(from, at);
  const lastStop = Math.max(window.lastIndexOf('.'), window.lastIndexOf('؟'), window.lastIndexOf('!'), window.lastIndexOf('\n'));
  const scope = window.slice(lastStop + 1);
  let last = null;
  for (const m of scope.matchAll(TAMRID_RE)) last = m;
  if (!last) return { text, changed: false };
  const start = from + lastStop + 1 + last.index;
  const replacement = last[1] + (last[2] ? 'فيما ' : '') + 'ثبت';
  return { text: text.slice(0, start) + replacement + text.slice(start + last[0].length), changed: true };
}

// ── THE TWO HELPERS THE PASS LEANS ON, KEPT OUT OF ITS BODY ────────────────

// ── ١١١ SECOND ORDER · A CHAPTER HEADING IS NOT A NARRATION ──────────────────────
//
// MEASURED 21 September 2026 on ezik-shamela-20260820: «الدين النصيحة» left this pass as
// «(متفق عليه)». The al-Bukhari atom that «carried» it, FC-000645:0044:001, carries it in its
// CHAPTER HEADING only — «بَابُ قَوْلِ النَّبِيِّ ﷺ: الدِّينُ النَّصِيحَةُ…» — and the narrations under
// that heading are Jarir's pledge, not this matn. A heading is the compiler's words, not a
// transmission, and «رواه البخاري» over it is a false ascription. The hadith is Muslim's (55).
//
// So an atom that OPENS with its chapter heading is read from its first isnad onward, and one
// with no isnad at all carries no narration. `atomCarriesMatn` is not touched; only the text it
// is handed. This can take a book away from a matn and never add one, so it cannot make a
// bracket that a narration did not already prove. The Companion is still read off the whole
// atom, as before.
const ISNAD_OPENER_RE = /(?:^| )و?(?:حدثنا|حدثني|حدثنى|اخبرنا|اخبرني|انبانا|انبانى)(?= |$)/u;
export function narrationOf(atomText) {
  const folded = foldArabic(String(atomText || ''));
  if (!/^(?:\d+ )*باب(?= |$)/u.test(folded)) return atomText;
  const at = folded.search(ISNAD_OPENER_RE);
  return at < 0 ? '' : folded.slice(at);
}

// ── ١١١ SECOND ORDER · A HADITH THE SILSILA MENTIONS IS NOT A HADITH IT GRADES ─────────────
//
// MEASURED 21 September 2026 on ezik-shamela-20260820: «الصيام والقرآن يشفعان للعبد يوم القيامة»
// left this pass as «(أحمد · ضعيف)», ruled by السلسلة الضعيفة. The atom was entry 7129, where
// al-Albani cites it as an example of an AUTHENTIC merit — «مثل قوله ﷺ: الصيام والقرآن يشفعان…
// وهو مخرج في تمام المنة» — while judging a different hadith weak. The two Silsilas grade by their
// title (lib/takhrij-ladder.js rows 7 and 36) but DISCUSS many hadiths they do not grade, so a
// matn in their text is that book's ruling only where it opens an entry: its entry number, then
// the matn — «2491 اطلبوا العلم كل اثنين…», «36 حب الوطن من الإيمان». Anywhere else it is a
// quotation, and the title says nothing about it. The list books (صحيح الجامع, ضعيف الجامع) and
// al-Wadi'i are lists of entries and are not touched.
const ENTRY_GRADED_IDS = new Set(['FC-002060', 'FC-002061']);
function entryIsMatn(atomText, matn) {
  const hay = foldArabic(String(atomText || ''));
  const words = foldArabic(matn).split(' ').filter(Boolean);
  if (!hay || !words.length) return false;
  const needle = words.length < MIN_ANCHOR_WORDS ? words.join(' ')
    : words.slice(0, Math.max(MIN_ANCHOR_WORDS, Math.ceil(words.length * 0.6))).join(' ');
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    if (/(?:^| )\d+ $/u.test(hay.slice(Math.max(0, at - 8), at))) return true;
  }
  return false;
}

/** The ladder ROW a confirmed id belongs to, as the key two witnesses are counted by. */
const bookKeyOf = (row) => row.n + '|' + row.display;

/**
 * Fold one library answer into a matn state: the ladder ids whose own text really carries
 * the matn, and the Companion each of those atoms names. Called once in phase one and once
 * more in phase two, and it is additive both times — a second answer can only add witnesses.
 */
function absorbAnswer(state, matn, answer) {
  // م٣-ج — the carrier test for THIS caller only. With the switch on it also accepts the head and
  // the tail; off, it is `atomCarriesMatn` itself. The pinned line below reads the name unchanged.
  const atomCarriesMatn = state?.fullAnswer === true ? atomCarriesMatnAttached
    : state && state.headTail === true ? atomCarriesMatnHeadTail : STRICT_CARRIER;
  const atoms = answer && Array.isArray(answer.atoms) ? answer.atoms : [];
  const ids = answer && Array.isArray(answer.subjectIds) ? answer.subjectIds : [];
  for (let i = 0; i < ids.length; i += 1) {
    const atom = atoms[i] || '';
    // WHAT CAME BACK, BEFORE ANY OF IT IS BELIEVED. `seen` is the library's answer as it
    // arrived; `confirmed` is the part of it whose own text carries this matn. Only the
    // second ever reaches the parentheses — the first exists so the Shaykhayn recheck can be
    // asked the question the owner asked, on the results rather than on the verdict.
    if (!state.seen.includes(ids[i])) state.seen.push(ids[i]);
    if (!atomCarriesMatn(narrationOf(atom), matn)) continue;
    // [111-b4b-61] — a short matn is proved by an atom whose quoted matn IS it, never one holding it.
    if (isShortQuote(matn) && !atomMatnIs(atom, matn)) continue;
    const row = ladderRowFor(ids[i]);
    if (!row) continue;
    if (ENTRY_GRADED_IDS.has(ids[i]) && !entryIsMatn(atom, matn)) continue;
    if (!state.confirmed.includes(ids[i])) state.confirmed.push(ids[i]);
    // م٣-د — AL-TIRMIDHI GRADES HIS OWN HADITH, and the ladder had no seat for it (row 13 is not a
    // grader, lib/takhrij-ladder.js:85-87). The owner's witness: «(الترمذي · لم يوقف على حكم)» with
    // «حسن غريب» in the next line of the same answer, while Tirmidhi's own atom writes «هذا حديث
    // حسن غريب». With the switch on, that verdict is read from his CONFIRMED atom and kept apart
    // from `rulings` (a key there would close phase 3 and could split a grader's ruling). It fills
    // the bracket only where no grader spoke. A lone «غريب» is not a grade.
    if (state.fullAnswer === true && row.n === 13 && !state.selfVerdict) {
      const verdict = collectorVerdict(atom);
      if (verdict) state.selfVerdict = verdict;
    }
    // BATCH 4 [b34] — what a GRADER wrote about this matn in its own entry, and nothing else.
    if (state.rulings) {
      const word = row.grader ? rulingWrittenFor(atom, matn) : '';
      if (word) {
        const list = state.rulings[ids[i]] || (state.rulings[ids[i]] = []);
        if (!list.includes(word)) list.push(word);
      }
      // ...and the polarity of every judgement this atom writes beside the matn, whatever its row.
      const voices = state.rulings['#voices'] || (state.rulings['#voices'] = []);
      for (const v of judgementsNear(atom, matn)) if (!voices.includes(v)) voices.push(v);
    }
    const found = companionFrom(atom, matn);
    if (found.name) {
      state.candidates.push({ name: found.name, prayer: found.prayer, book: bookKeyOf(row) });
    }
    // B2 (FULL_ANSWER_V1) — the narrator next to the Prophet ﷺ, as this atom itself names him.
    if (state.fullAnswer === true) {
      const prophetic = atomProvesPropheticSpeech(atom, state.speechMatn);
      if (prophetic) state.propheticSpeech = true;
      const next = companionAdjacent(atom, matn);
      if (next.name) (state.adjacent || (state.adjacent = [])).push({ name: next.name, prayer: next.prayer, book: bookKeyOf(row) });
      // ج٤ (order C) — and who narrates it (B2's reading, else one without the prayer), for the one-hadith test.
      const reading = matnNarrator(atom, matn);
      if (!prophetic && atomProvesNarratorSpeech(atom, state.speechMatn)) state.narratorSpeech = true;
      if (reading.name && !reading.kin) (state.narrators || (state.narrators = [])).push(reading.name);
    }
  }
}

/** How many of the two Ṣaḥīḥs are in a list of ids, counted by ladder ROW and not by id. */
function shaykhRowsIn(ids) {
  const rows = new Set();
  for (const id of ids || []) {
    if (!isShaykhayn(id)) continue;
    const row = ladderRowFor(id);
    if (row) rows.add(row.n);
  }
  return rows.size;
}

/**
 * True while «(متفق عليه)» is still an open question for this matn — that is, while the pass
 * has NOT confirmed both Ṣaḥīḥs out of the library's own atoms.
 *
 * READ ON THE CONFIRMED SET, not on the returned one. A row whose text does not carry the matn
 * proves nothing, so a returned-but-unconfirmed البخاري leaves the question open exactly as an
 * absent one does — and the narrowed request is what closes it.
 */
function shaykhaynIncomplete(state) {
  return shaykhRowsIn(state && state.confirmed) < 2;
}

/**
 * True while a matn's GRADE is still an open question and asking the graders could close it.
 *
 * FOUR CONDITIONS, AND EVERY ONE OF THEM IS A REFUSAL TO SPEND A CALL ON NOTHING:
 *   * something was confirmed at all       — §٣ forbids a second wording for an unfound matn
 *   * no Ṣaḥīḥ among it                    — «(البخاري)» and «(متفق عليه)» carry no grade by rule
 *   * a متن book among it                  — a grader-only hit is composeParenthetical's own case
 *   * no stated ruling among it yet        — the answer is already in hand
 */
function gradeStillOpen(state) {
  const rows = ((state && state.confirmed) || []).map(ladderRowFor).filter(Boolean);
  if (!rows.length) return false;
  if (rows.some((row) => row.shaykh)) return false;
  if (!rows.some((row) => !row.grader)) return false;
  // BATCH 4 [b34] — «in hand» is a ruling a grader WROTE for this matn, not a title that states one.
  return !Object.entries((state && state.rulings) || {})
    .some(([id, words]) => id !== '#voices' && Array.isArray(words) && words.length);
}

// ── BATCH 4 [b34] · THE RULING A GRADER WROTE, READ WHERE IT WROTE IT ─────────────────────
// A grader's entry quotes the matn and writes its ruling right after the closing mark:
//   السلسلة الضعيفة 416   «" اطلبوا العلم ولو بالصين ". باطل. رواه ابن عدي …»
//   صحيح الجامع 4143      «العهد الذي بيننا وبينهم الصلاة … » . (صحيح) حم ت ن …»
// That position, and only that one, is read — the shape Codex measured over the corpus's grade
// atoms (EZIK-CX-M111-MEASURE §34). An entry that writes no word there (ضعيف الجامع 3625, 4937)
// has written no ruling, and nothing is read out of its title in its place. «وهو حسن» three words
// on is a discussion, not the entry's ruling, and is not read either.
const WRITTEN_RULING_RE = /^(صحيح(?: لغيره)?|حسن(?: لغيره)?|ضعيف(?: جدا)?|موضوع|باطل|منكر|لا اصل له)(?= |$)/u;
const RULING_QUOTE_RE = /["«“]([^"«»“”]+)["»”]/gu;
// ── AND A BOOK THAT WRITES THE OPPOSITE BESIDE THE SAME MATN SPLITS THE VERDICT ───────────
// MEASURED on ezik-shamela-20260820 for «طلب العلم فريضة على كل مسلم»: صحيح الجامع 3913 writes
// «(صحيح)»; كشف الخفاء writes «وهو حسن»; البزار writes «هذا كذب ليس له أصل … فغير صحيح»; مجمع
// الزوائد writes «ضعيف جدا» beside one of its routes. The owner names that verdict split («ابن باز
// حسنٌ بطرقه · الألبانيّ صحّحه · البزار غير صحيح») and a split verdict is no grade. So beside the
// written ruling, every confirmed atom is read for the words of judgement it writes right after
// the matn — up to its next numbered entry, 200 characters at most — as a polarity: sound or weak.
// A grade stands only where no confirmed atom writes the other polarity. Reading more can only
// silence a grade, never make one.
const SOUND_WORDS = new Set(['صحيح', 'حسن', 'ثابت']);
const WEAK_WORDS = new Set(['ضعيف', 'منكر', 'موضوع', 'باطل', 'كذب', 'واه', 'متروك']);
const WEAK_PHRASES = ['لا اصل له', 'ليس له اصل', 'غير صحيح', 'لا يصح', 'لا يثبت'];
export function judgementsNear(atomText, matn) {
  const hay = foldArabic(narrationOf(atomText) || atomText);
  const words = foldArabic(matn).split(' ').filter(Boolean);
  const out = new Set();
  if (!hay || !words.length) return out;
  const needle = words.length < MIN_ANCHOR_WORDS ? words.join(' ')
    : words.slice(0, Math.max(MIN_ANCHOR_WORDS, Math.ceil(words.length * 0.6))).join(' ');
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    let win = hay.slice(at + needle.length, at + needle.length + 200);
    const next = win.search(/ \d{1,5} (?=\D)/u);
    if (next > 0) win = win.slice(0, next);
    // The conjunction is folded off every word, so «فغير صحيح» reads as «غير صحيح».
    const toks = win.split(' ').map((t) => (/^[وف](?=غير$|لا$)/u.test(t) ? t.slice(1) : t));
    const padded = ' ' + toks.join(' ') + ' ';
    // Not a ruling on the hadith: a word about its MEANING («ومعناه صحيح»), or a grade word heading
    // a definite noun — a book or a phrase («صحيح البخاري»، «ضعيف الجامع»، «حسن العهد») — save
    // «… الإسناد», which is a ruling on the chain.
    const isRuling = (k) => {
      const prev = [toks[k - 1], toks[k - 2]].map((t) => String(t || '').replace(/^[وف]/u, ''));
      if (prev.includes('معناه') || prev.includes('معني')) return false;
      // «غير صحيح»، «لا يصح» are weak rulings, read below as phrases; the word inside is not «sound».
      if (toks[k - 1] === 'غير' || toks[k - 1] === 'لا') return false;
      const next = String(toks[k + 1] || '');
      return !(next.startsWith('ال') && !next.startsWith('الاسناد'));
    };
    if (toks.some((t, k) => SOUND_WORDS.has(t) && isRuling(k))) out.add('sound');
    if (toks.some((t, k) => WEAK_WORDS.has(t) && isRuling(k))
      || WEAK_PHRASES.some((p) => padded.includes(' ' + p + ' '))) out.add('weak');
  }
  return out;
}
export function rulingWrittenFor(atomText, matn) {
  const raw = String(atomText || '');
  for (const q of raw.matchAll(RULING_QUOTE_RE)) {
    if (!atomCarriesMatn(q[1], matn)) continue;
    const after = foldArabic(raw.slice(q.index + q[0].length, q.index + q[0].length + 40));
    const m = after.match(WRITTEN_RULING_RE);
    if (m) return m[1] === 'لا اصل له' ? 'لا أصل له' : m[1];
  }
  // An entry that opens on its number and the matn with no quotation marks: «7130 - <المتن>. ضعيف.»
  const hay = foldArabic(raw);
  const needle = foldArabic(matn);
  for (let at = needle ? hay.indexOf(needle) : -1; at >= 0; at = hay.indexOf(needle, at + 1)) {
    if (!/(?:^| )\d+ $/u.test(hay.slice(Math.max(0, at - 8), at))) continue;
    const m = hay.slice(at + needle.length).trim().match(WRITTEN_RULING_RE);
    if (m) return m[1] === 'لا اصل له' ? 'لا أصل له' : m[1];
  }
  return '';
}

export { NOT_RAISED };
