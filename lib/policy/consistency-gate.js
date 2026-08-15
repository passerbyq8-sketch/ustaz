// lib/policy/consistency-gate.js
// ONE ANSWER UNIT MAY NOT BOTH CREDIT A MAN AND DISCLAIM HAVING FOUND HIM.
//
// ── THE FAILURE THIS EXISTS TO MAKE IMPOSSIBLE, MEASURED ON THE LIVE SERVICE ─
// «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟» was answered with: his position
// stated as fact, a quotation attributed to مجموع الفتاوى, the majority view, his view called
// weak, a recommendation to make up the prayer — and then, in the same reply:
//
//   «لم أقف على نصٍّ مباشرٍ للشيخ ابن تيميه»
//
// Both halves cannot be true. Either the text was found, in which case the disclaimer is false,
// or it was not, in which case the quotation and the attribution are unsupported. The reader has
// no way to tell which half to believe, and the half that reads as authoritative is the wrong one.
//
// ── WHY A PROMPT INSTRUCTION WAS NOT ENOUGH ─────────────────────────────────
// api/ask.js already TELLS the model, in as many words, not to attribute anything to him when his
// text was not found. The model attributed anyway. An instruction is a request; this is a gate.
//
// ── AND WHY A NEGATION NEEDS PROOF OF SEARCH ────────────────────────────────
// A historical scholar has no official domain and no adapter, so the attributed route never ran a
// search for him at all — and then said «لم أقف على نصٍّ مباشرٍ له». That is a claim about work
// that was never done. «I did not find» and «I did not look» are different statements, and only
// the first one may be made after actually looking.
//
// THIS MODULE DECIDES NOTHING ABOUT RELIGION. It reads a draft and reports which of these
// invariants it broke. What to do about that is the caller's, and in api/ask.js it is to drop the
// draft whole rather than edit it down.

import { fold, ROSTER } from './entities.js';
// THE PIVOT-TERM MACHINERY, READ AND NEVER RE-IMPLEMENTED. «Do the words of this sentence appear
// in this page?» is precisely the measurement lib/page-match.js already makes for a candidate
// page, down to the clitic folding and the ḥāl families. Re-deriving it here would be a second
// deterministic screen that can disagree with the first about the same two strings.
import { matchPage, MATCH_COVERAGE } from '../page-match.js';
// The frozen corpus decides what is frozen. A hand-written list of exempt phrases here would
// drift away from the file the exemption is actually about.
import { containsFrozenPhrase, containsFrozenRun } from '../frozen-text.js';
// The number words and the digit folding, read from the one module that owns them.
import { westernDigits, CARDINALS } from '../duration.js';
// THE SOURCE-CLASS RULE, READ AND NEVER RE-IMPLEMENTED. Which persons the pages in hand license
// is decided in one place (lib/policy/source-attribution.js) and consumed here, so the legacy
// screen and the ledger's Gate 3 cannot come to different conclusions about the same result set.
import { licensedSurfaces, allPersonSurfaces } from './source-attribution.js';

/** A positive attribution of speech: «قال فلان», «يقول الشيخ», «صرّح ابن تيمية». */
const SPEECH_VERBS = 'قال|يقول|صرح|نص|قرر|كتب|روي عنه';
/**
 * A positive attribution of a POSITION, which is weaker than speech and still an attribution.
 *
 * GRADING A HADITH IS A RULING TOO, and it was missing. «صحح الشيخ الألباني هذا الحديث» credits a
 * named man with a verdict on an isnad — the single most quoted kind of claim there is about him —
 * and matched neither list, so it passed a gate written to stop exactly this. `حسن` is deliberately
 * NOT here: it is an ordinary adjective («أمر حسن») and would refuse innocent prose.
 */
const POSITION_VERBS = 'يري|راي|ذهب|اختار|رجح|افتي|يفتي|مذهب|اجاز|منع|حرم|اوجب|صحح|ضعف|وثق|جرح|استحب|كره';

const TITLES = 'فضيله|سماحه|الشيخ|العلامه|الامام|الدكتور|الفقيه|المفتي|العالم|شيخ الاسلام|شيخ';

/** Every registered person, longest form first so a longer name is not eaten by a shorter one. */
function entityNameAlternation(extraNames = []) {
  const names = [...new Set([
    ...ROSTER.filter((e) => e.targetType === 'person').flatMap((e) => [...e.aliases, fold(e.display)]),
    ...extraNames.map((n) => fold(n)),
  ].filter(Boolean))].sort((a, b) => b.length - a.length);
  return names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

export const PROBLEM = Object.freeze({
  /** Speech credited to the entity while his text was not verified. */
  SPEECH_WITHOUT_EVIDENCE: 'SPEECH_WITHOUT_EVIDENCE',
  /** A position credited to the entity while his text was not verified. */
  POSITION_WITHOUT_EVIDENCE: 'POSITION_WITHOUT_EVIDENCE',
  /** A direct quotation in a sentence that names him, at a grade that cannot carry one. */
  QUOTE_WITHOUT_EVIDENCE: 'QUOTE_WITHOUT_EVIDENCE',
  /** «لم أقف» when no search was ever run for that slot. */
  NEGATION_WITHOUT_SEARCH: 'NEGATION_WITHOUT_SEARCH',
  /** A fact about WHO A NAMED MAN IS — dead, Saudi, a broadcaster — that no source supplied. */
  IDENTITY_WITHOUT_EVIDENCE: 'IDENTITY_WITHOUT_EVIDENCE',
  /** A صفة or a موقف credited to a man no page in hand licenses being named at all. */
  ATTRIBUTION_NOT_LICENSED: 'ATTRIBUTION_NOT_LICENSED',
  /** The app weighed the views itself: a ترجيح no retrieved page states and nobody is credited with. */
  TARJIH_WITHOUT_EVIDENCE: 'TARJIH_WITHOUT_EVIDENCE',
  /** A RULING whose subject matter appears on no page we fetched. The app legislated. */
  RULING_WITHOUT_SOURCE: 'RULING_WITHOUT_SOURCE',
  /** Two numbers in one sentence with a comparison between them that is simply false. */
  NUMERIC_CONTRADICTION: 'NUMERIC_CONTRADICTION',
  /** A frozen text introduced as something it is not — an āyah under «قال النبي». */
  FROZEN_TAG_MISMATCH: 'FROZEN_TAG_MISMATCH',
});

// ── THE TAG MUST MATCH THE TEXT IT INTRODUCES ────────────────────────────────
//
// MEASURED, batch 5: «قال النبي ﷺ:» followed by ﴾وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا﴿ —
// al-Baqara 275. The Book was published as the Prophet's speech.
//
// WHY NOTHING SAW IT. lib/takhrij-lock.js exempts a span that overlaps a frozen run, and that
// exemption is correct: an āyah is not a takhrij and demanding «رواه فلان» of it would refuse the
// Qur'an. So the span was skipped, rightly — and nothing then asked whether the words INTRODUCING
// it named it correctly. The tag is one rule's business and the text is another's, and the join
// between them belonged to neither.
//
// THE NEAREST TAG IS THE ONE THAT NAMES IT. «قال النبي ﷺ ما قال، ثم تلا قوله تعالى: ﴾…﴿» is
// ordinary, correct Arabic and must not be refused: the hadith tag is about the first clause and
// the āyah carries its own. So the last tag BEFORE the frozen run decides, not any tag anywhere.
const QURAN_TAGS = ['قال تعالي', 'قال الله تعالي', 'قال الله', 'قوله تعالي', 'قوله عز وجل',
  'يقول الله تعالي', 'يقول الله', 'في قوله تعالي', 'قال عز وجل', 'قال سبحانه'];
const HADITH_TAGS = ['قال النبي', 'قال رسول الله', 'عن النبي', 'عن رسول الله', 'قال المصطفي',
  'قال عليه الصلاه والسلام', 'روي عن النبي', 'في الحديث'];

/**
 * A frozen text introduced by a tag that names it as the other kind.
 *
 * Needs no evidence and no page — the frozen corpus already knows what each run IS — so it is
 * armed for every caller, exactly like the arithmetic check.
 */
// A TAG INTRODUCES WHAT COMES DIRECTLY AFTER IT. Anything further away is a tag on something
// else — «قال تعالى: ﴾…آية…﴿ رواه فلان عن النبي ﷺ» must not read the Qur'an tag as introducing
// the ṣalawāt at the far end of the sentence. Twenty-odd folded characters is «صلى الله عليه
// وسلم: », which is the longest thing that legitimately sits between a tag and its text.
const TAG_REACH = 30;

// Every frozen run in the text, not merely the longest one — and this is the whole reason the
// first attempt at this rule saw nothing. containsFrozenRun() reports the LONGEST run, and
// «قال رسول الله صلى الله عليه وسلم» is ITSELF an entry in the adhkār corpus, longer than the
// āyah it was introducing. So the honorific swallowed the verse and the verse was never judged.
const MAX_RUNS = 20;

function frozenTagMismatch(rawText) {
  const text = String(rawText || '');
  if (!text) return false;

  for (let offset = 0, n = 0; offset < text.length && n < MAX_RUNS; n++) {
    const run = containsFrozenRun(text.slice(offset));
    if (!run) break;
    const absStart = offset + run.start;
    // The tag is looked for in the WHOLE text before this run, not merely since the previous
    // one: the tag that names an āyah routinely sits in front of the honorific ahead of it.
    const before = fold(text.slice(0, absStart));
    offset += run.end;
    if (!before) continue;

    // The LAST tag of either kind. Longest match wins at the same position, so «قال الله تعالي»
    // is not read as the shorter «قال الله» sitting inside it.
    let bestAt = -1, bestKind = '', bestLen = 0;
    const scan = (tags, kind) => {
      for (const t of tags) {
        const at = before.lastIndexOf(t);
        if (at === -1) continue;
        if (at > bestAt || (at === bestAt && t.length > bestLen)) { bestAt = at; bestKind = kind; bestLen = t.length; }
      }
    };
    scan(QURAN_TAGS, 'quran');
    scan(HADITH_TAGS, 'hadith');
    if (!bestKind) continue;                                  // untagged: this rule says nothing
    if (before.length - (bestAt + bestLen) > TAG_REACH) continue;   // it introduces something else

    if (run.kind === 'quran' && bestKind === 'hadith') return true;
    // A dhikr that is not itself Qur'an may not be introduced as the Book. The many adhkār built
    // out of āyāt — āyat al-Kursī is dhikr #75 and is also 2:255 — are reported as `quran` by the
    // index, which tests the Book first, and never reach this line.
    if (run.kind === 'dhikr' && bestKind === 'quran') return true;
  }
  return false;
}

// ── ARITHMETIC NEEDS NO SOURCE ───────────────────────────────────────────────
//
// MEASURED, batch 5: «المسافة ١٥٠ كيلومترًا وهي لا تبلغ ٨٠ كيلومترًا». One sentence, two numbers,
// and a comparison between them that is false on its face — 150 does reach 80. Every other screen
// in this file asks where a claim CAME FROM. This one is refuted by reading it, and no page has to
// be fetched to do it, which is why it is armed for every caller rather than by `pageTexts`.
//
// THE NUMBERS ARE PARSED BY lib/duration.js's OWN TABLE, never by a second one written here: two
// tables are two answers to «what is ثمانين», and the wrong one is always the one nobody reads.
//
// UNITS ARE WHAT KEEPS IT HONEST. «صلى أربع ركعات ثم سافر أكثر من ٨٠ كيلومترًا» holds two numbers
// and a comparison, and 4 is not more than 80 — but the four is rak'ahs and the eighty is
// kilometres, and comparing them is the error, not the sentence. So two numbers are compared only
// when they are counting the SAME thing. A number that names no unit inherits the nearest unit
// before it, which is how «١٥٠ كيلومترًا … لا تبلغ ٨٠» is read the way a reader reads it.
// STRICT AND NON-STRICT ARE NOT THE SAME PHRASE, and reading them as one invents a contradiction
// at the boundary: «المسافة ٨٠ كيلومترًا وهي لا تزيد على ٨٠» is TRUE — eighty does not exceed
// eighty — while «٨٠ … لا تبلغ ٨٠» is false. Both are one word apart in Arabic and an arithmetic
// check that cannot tell them apart is a check that refuses correct sentences.
const LESS_STRICT = ['لا تبلغ', 'لا يبلغ', 'لم تبلغ', 'لم يبلغ', 'لا تصل الي', 'لا يصل الي',
  'اقل من', 'اصغر من', 'دون', 'تحت'];
const LESS_OR_EQUAL = ['لا تزيد علي', 'لا يزيد علي', 'لا تزيد عن', 'لا يزيد عن',
  'لا تتجاوز', 'لا يتجاوز'];
const MORE_STRICT = ['اكثر من', 'اكبر من', 'تزيد علي', 'يزيد علي', 'تزيد عن', 'يزيد عن',
  'تتجاوز', 'يتجاوز', 'فوق', 'تجاوزت', 'تجاوز'];

// The units this check knows how to compare. Each entry maps every spelling to ONE bucket, so
// «كيلومترا» and «كم» are the same thing and «ركعات» is not.
const UNIT_BUCKET = (() => {
  const groups = {
    distance: ['كيلومتر', 'كيلومترا', 'كيلومترات', 'كيلو', 'كم', 'ميل', 'اميال', 'متر', 'امتار'],
    day: ['يوم', 'يوما', 'ايام', 'يومين'],
    week: ['اسبوع', 'اسبوعا', 'اسابيع', 'اسبوعين'],
    month: ['شهر', 'شهرا', 'اشهر', 'شهور', 'شهرين'],
    year: ['سنه', 'سنوات', 'سنين', 'عام', 'اعوام', 'عاما', 'سنتين'],
    hour: ['ساعه', 'ساعات', 'ساعتين'],
    rakah: ['ركعه', 'ركعات', 'ركعتين'],
    money: ['ريال', 'ريالا', 'ريالات', 'درهم', 'دراهم', 'دينار', 'دنانير', 'جنيه', 'جنيهات'],
  };
  const out = new Map();
  for (const [bucket, words] of Object.entries(groups)) for (const w of words) out.set(w, bucket);
  return out;
})();

/**
 * Every number in the text, in order, with the unit bucket it counts.
 *
 * A number with no unit word after it inherits the nearest unit ALREADY SEEN, and null when there
 * is none. That is what makes «١٥٠ كيلومترًا وهي لا تبلغ ٨٠» comparable without inventing a unit
 * for the eighty.
 */
// PUNCTUATION IS NOT PART OF A WORD, and leaving it attached is not cosmetic: «٨٠.» at the end of
// a sentence is not a number, and «كيلومترًا.» is not a unit — so the eighty lost both its value
// and its unit and then inherited the unit of a number counting something else entirely. Same
// lesson lib/duration.js records for «يوم؟».
function tokensOf(foldedText) {
  return westernDigits(foldedText)
    .replace(/[^؀-ۿ0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function numbersWithUnits(foldedText) {
  const toks = tokensOf(foldedText);
  const out = [];
  let lastUnit = null;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const n = /^\d+$/.test(t) ? Number(t)
      : Object.prototype.hasOwnProperty.call(CARDINALS, t) ? CARDINALS[t] : null;
    if (n === null) continue;
    // The unit is the next token, when the next token is one.
    const nextUnit = UNIT_BUCKET.get(toks[i + 1] || '') || null;
    if (nextUnit) lastUnit = nextUnit;
    out.push({ value: n, unit: nextUnit || lastUnit, index: i });
  }
  return out;
}

/**
 * A comparison in this sentence that is false as arithmetic.
 *
 * ONLY WITHIN ONE SENTENCE, and only between two numbers counting the same thing. The comparand
 * is the number that FOLLOWS the comparison phrase; the subject is the nearest number before it
 * with the same unit. Anything that does not fit that shape is not judged at all — this check
 * refutes what it can read and stays silent about the rest.
 */
function numericContradiction(rawText) {
  const t = fold(rawText || '');
  if (!t) return false;
  if (containsFrozenPhrase(rawText)) return false;
  const nums = numbersWithUnits(t);
  if (nums.length < 2) return false;
  const toks = tokensOf(t);

  for (const [phrases, holds] of [
    [LESS_STRICT, (a, b) => a < b],
    [LESS_OR_EQUAL, (a, b) => a <= b],
    [MORE_STRICT, (a, b) => a > b],
  ]) {
    for (const phrase of phrases) {
      const words = phrase.split(' ');
      for (let i = 0; i + words.length <= toks.length; i++) {
        if (!words.every((w, k) => toks[i + k] === w)) continue;
        // NEGATION IN FRONT OF A POSITIVE PHRASE FLIPS IT, and the long forms above already carry
        // their own «لا». Skip a match whose own first word is preceded by «لا»/«لم», so
        // «لا تزيد على» is never also read as the bare «تزيد على».
        if (i > 0 && (toks[i - 1] === 'لا' || toks[i - 1] === 'لم')) continue;
        const after = nums.find((n) => n.index >= i + words.length);
        if (!after) continue;
        const before = [...nums].reverse().find((n) => n.index < i && n.unit && n.unit === after.unit);
        if (!before) continue;
        if (!holds(before.value, after.value)) return true;
      }
    }
  }
  return false;
}

// ── A RULING COMES FROM A PAGE, OR IT DOES NOT GO OUT ────────────────────────
//
// MEASURED. «ذهب إلى المسجد فهل يصح؟» was answered with «يجب الطهور قبل دخول المسجد» over one
// card whose page is about الحائض and carries no such clause. Nothing in this file saw it, and
// nothing was ever going to: it credits no man, so the source-class rule has no name to police;
// it quotes no hadith, so the takhrij lock is silent; it prefers no qawl, so the ترجيح rule is
// silent. Every guard we had asks about the SOURCE or about a NAME. This one asks the question
// none of them asked — does the page in hand actually say this? — and it is a whole class of
// failure, not one sentence.
//
// THE WORDS THAT MAKE A SENTENCE A RULING. Written in folded form, matched as substrings so a
// glued article or conjunction cannot hide one. This is the vocabulary of التكليف: obligation,
// prohibition, condition, validity and the five ahkām.
const RULING_MARKERS = [
  'يجب', 'وجب', 'واجب', 'وجوب', 'الوجوب', 'يلزم', 'يلزمه', 'عليه ان',
  'لا يجوز', 'لايجوز', 'يجوز', 'الجواز', 'يحرم', 'حرام', 'محرم', 'التحريم',
  'يشترط', 'بشرط', 'شرط صحه', 'من شروط',
  'لا يصح', 'لايصح', 'يصح', 'باطل', 'بطلت', 'صحيح ان يفعل',
  'مباح', 'الاباحه', 'مكروه', 'الكراهه', 'سنه موكده', 'مستحب', 'الاستحباب',
  'فرض', 'الفرض', 'ركن من', 'نافله',
];

/**
 * Does this sentence carry a ruling — a statement of what a reader must, may or may not do?
 *
 * PUBLIC because the wiring in api/ask.js and this file's own gate must agree about which
 * sentences are in scope, and because a guard has to be able to ask the question directly.
 */
export function carriesRuling(text) {
  return rulingWordIn(text) !== '';
}

/**
 * WHICH ruling this sentence pronounces — the longest marker it contains.
 *
 * LONGEST, and that is the whole point of returning it rather than a boolean. «لا يجوز» contains
 * «يجوز», and a page that says يجوز where the draft says لا يجوز has not sourced the draft; it has
 * contradicted it. Testing the longest form means an inverted ruling fails to find itself.
 */
function rulingWordIn(text) {
  const f = fold(text || '');
  if (!f) return '';
  let best = '';
  for (const m of RULING_MARKERS) {
    if (f.includes(m) && m.length > best.length) best = m;
  }
  return best;
}

/**
 * A RULING THE PAGES IN HAND DO NOT CARRY.
 *
 * ARMED BY THE CALLER SUPPLYING THE PAGES, exactly as the ترجيح rule is: an ABSENT `pageTexts`
 * means "this caller is not wired to the rule yet" and changes nothing; an EMPTY ARRAY means
 * "nothing was retrieved", under which no ruling can possibly be sourced and every one of them
 * is the application's own.
 *
 * TWO CONDITIONS, BOTH READ OFF THE EXISTING MACHINERY, and a ruling has to clear both.
 *
 *   1. IS THE PAGE EVEN ABOUT THIS? matchPage's own verdict and its own MATCH_COVERAGE — the
 *      same numbers that decide whether a candidate page may be a source at all. A `reject` or
 *      a coverage under the bar means the sentence and the page are about different things.
 *
 *   2. DOES THE PAGE OBLIGE, FORBID OR PERMIT ANYTHING? The ruling word itself must be on the
 *      page. This is the condition that catches the measured incident and a coverage threshold
 *      never could: «يجب الطهور قبل دخول المسجد» shares «المسجد» with a page about الحائض, and
 *      the page says يجب about nothing at all. A draft may only pronounce what its page pronounces.
 *
 * WHY NOT SIMPLY REQUIRE EVERY PIVOT TERM. Because a grade-C transmission names its publisher in
 * the sentence — «ذكر موقع الإسلام سؤال وجواب أنّ …» — and «ذكر» and «جواب» are, by construction,
 * words about the citation rather than words on the cited page. An all-terms rule refuses exactly
 * the sourced, correctly-framed transmission this project spent batch 3 building. MEASURED: that
 * draft scores 9/13 against its own page, and the invented clause scores 1/4 against its own.
 *
 * THE FROZEN TEXTS ARE OUTSIDE IT, WHOLLY. An āyah legislates; it is not held to a web page. The
 * adhkār and the description of the acts of worship are transmitted verbatim from the golden
 * file, and their attribution is pinned by their own guard — which is a stronger provenance than
 * any retrieval, not a weaker one.
 */
function rulingWithoutSource(rawText, ctx) {
  if (!Array.isArray(ctx.pageTexts)) return false;
  const ruling = rulingWordIn(rawText);
  if (!ruling) return false;
  if (containsFrozenPhrase(rawText)) return false;
  const pages = ctx.pageTexts.map((p) => String(p || '')).filter(Boolean).join('\n');
  const m = matchPage({ question: rawText, text: pages });
  // Nothing measurable in the sentence — no pivot term of its own — is not an offence. This
  // module removes claims it can prove unsupported; it does not invent refusals.
  if (!m.terms.length) return false;
  if (m.verdict === 'reject') return true;
  if (m.coverage < MATCH_COVERAGE) return true;
  return !fold(pages).includes(ruling);
}

// ── THE APP TRANSMITS; IT DOES NOT WEIGH ─────────────────────────────────────
//
// MEASURED. An answer about Ibn Taymiyyah went out carrying «**الراجح** أنّ من ترك الصلاة عمدًا وجب
// عليه قضاؤها». Nobody was credited with that preference and no retrieved page stated it: the
// application had chosen between the positions of the fuqahā' and announced the winner. «عزك ناقلٌ
// لا مفتٍ» is the governing rule of this project, and preferring one qawl over another is the
// single most fatwa-like act there is — more so than reporting a ruling, because reporting has a
// source and preferring has an author.
//
// TWO CONDITIONS, AND BOTH ARE REQUIRED, exactly as the brief states them: the ترجيح must be
// WRITTEN ON THE PAGE, and it must be ATTRIBUTED TO WHOEVER SAID IT. A page that says «والراجح عند
// الحنابلة» may be transmitted as such; the same word with nobody behind it may not.
//
// WHAT IS DELIBERATELY NOT HERE. Bare «الصحيح» and «صحيح» are absent: they are the ordinary
// vocabulary of hadith grading — «حديث صحيح», «إسناده صحيح» — and flagging them would refuse
// takhrij, which is transmission of the plainest kind. Only the compound forms that can only mean
// preference are listed.
const TARJIH_MARKERS = [
  'الراجح', 'والراجح', 'فالراجح', 'الارجح', 'والارجح',
  'الصواب', 'والصواب', 'فالصواب', 'الاصوب',
  'المختار', 'والمختار', 'الاقوي', 'والاقوي', 'الاولي والاقوي',
  'وهو الصحيح', 'والصحيح ان', 'والذي يظهر', 'الذي يظهر لي', 'الذي نرجحه',
  'نرجح', 'ارجح ان', 'ترجح لدي', 'ترجح عندي',
  'الاحوط', 'والاحوط', 'فالاحوط',
];

// Whom a ترجيح may be credited to. A person, a school, the body of scholars, or the publisher the
// transmission frame already names — every one of them is somebody a reader can go and check.
const TARJIH_SAYER = 'الجمهور|جمهور|جماهير|الحنفيه|المالكيه|الشافعيه|الحنابله|الظاهريه'
  + '|المذهب|مذهب|اهل العلم|العلماء|اللجنه الدائمه|هيئه كبار العلماء|دار الافتاء|المجمع الفقهي'
  + '|عند الحنفيه|عند المالكيه|عند الشافعيه|عند الحنابله|في المصدر|الموقع|موقع';

/**
 * A ترجيح THE APP HAD NO RIGHT TO MAKE.
 *
 * ARMED BY THE CALLER SUPPLYING THE PAGES, and not by their contents — the same convention
 * `sourceLicence` follows above. An ABSENT `pageTexts` means "this caller is not wired to the rule
 * yet" and changes nothing; an EMPTY ARRAY means "no page was retrieved", under which no ترجيح can
 * possibly be sourced and every one of them is the app's own.
 */
function tarjihWithoutEvidence(foldedText, ctx) {
  if (!Array.isArray(ctx.pageTexts)) return false;
  const marker = TARJIH_MARKERS.find((m) => foldedText.includes(m));
  if (!marker) return false;
  // 1. IS IT ON THE PAGE? Any retrieved page carrying any preference word is enough here; which
  //    sentence of the draft it belongs to is settled by condition 2.
  const onPage = ctx.pageTexts.some((p) => {
    const f = fold(String(p || ''));
    return f && TARJIH_MARKERS.some((m) => f.includes(m));
  });
  if (!onPage) return true;
  // 2. IS SOMEBODY CREDITED WITH IT? A named person, a school, or the source being transmitted
  //    from. Without one, the draft is still announcing a winner in its own voice.
  const named = entityNameAlternation(ctx.entity ? [ctx.entity] : []);
  const sayer = '(?:' + TARJIH_SAYER + '|' + TITLES + (named ? '|' + named : '') + ')';
  return !new RegExp(sayer, 'u').test(foldedText);
}

// ── WHAT MAY BE SAID ABOUT A MAN THE PAGES DO NOT NAME ───────────────────────
//
// MEASURED. «ما رأي طارق العلي في أحكام العدة؟» was answered with «داعية وخطيب كويتي معروف من أهل
// العلم … يتبنّى المذهب الحنفي» and four rulings credited to «رأيه» — over one card from
// alukah.net titled «أحكام العدة للمرأة (خطبة)», a page that does not contain his name anywhere.
// He is a Kuwaiti comic actor.
//
// EVERY CHECK ABOVE WAS SATISFIED. The draft attributed no speech to a scholar the roster knew,
// quoted nothing and negated nothing; it simply invented a man's profession, his standing, his
// madhhab and his positions, warmly, with a source card underneath that the reader has every
// reason to read as backing it.
//
// So the rule here is about THE SOURCE CLASS and nothing else: a sentence may credit a person with
// a صفة or a موقف only when a page in hand licenses naming him. What "licenses" means is decided
// entirely by lib/policy/source-attribution.js, and this file's only job is to find the sentences
// that break it.
//
// «صفة» — profession, nationality, death, country, madhhab, scholarly standing.
const RANK_MARKERS = 'من اهل العلم|من العلماء|من كبار العلماء|عالم دين|خطيب|واعظ|محدث|فقيه معاصر'
  + '|مفتي معاصر|طالب علم|شيخ معاصر|من المشايخ|من الدعاه|شيخ معروف|عالم معروف'
  + '|العالم المعروف|عالم مشهور|عالم جليل|داعيه مشهور|من العلماء المعاصرين';
const MADHHAB_ADOPTION = 'المذهب الحنفي|المذهب المالكي|المذهب الشافعي|المذهب الحنبلي|المذهب الظاهري'
  + '|مذهب الحنفيه|مذهب المالكيه|مذهب الشافعيه|مذهب الحنابله';
// «موقف» — and the alignment verbs the position list never carried. «اتفق ابن حجر مع الجمهور …
// في الفتح», over a page that never mentions him, matched neither SPEECH_VERBS nor POSITION_VERBS.
const ALIGNMENT_VERBS = 'اتفق|يتفق|وافق|يوافق|خالف|يخالف|تبني|يتبني|انتصر|ينتصر|تابع|يتابع';

// ── WHO SOMEBODY IS, IS ALSO A CLAIM ─────────────────────────────────────────
//
// MEASURED ON THE LIVE SERVICE, verbatim:
//
//   «الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم»
//
// He is alive. He is not a broadcaster. Not one word of that came from a page. Every check above
// was satisfied, because the sentence attributes no speech, states no position, quotes nothing
// and negates nothing — it simply invents a man's death, his nationality and his profession, in
// the app's own voice, in a warm and creditable tone.
//
// A false ruling can be argued with. A false obituary cannot: the reader has no reason to doubt
// it and no way to check it, and «رحمه الله» about a living man is the kind of thing that reaches
// his family. So a DESCRIPTION of a named person is held to the same standard as a fatwa of his —
// it comes from a source or it does not go out.
//
// THIS IS ADDITIONAL, NEVER A REPLACEMENT. It runs alongside the speech and position checks, and
// catches exactly what they were never shaped to see.
const DEATH_MARKERS = 'رحمه الله|رحمه اللة|المتوفي|توفي|رحمها الله|طيب الله ثراه|في ذمه الله|الراحل|المرحوم';
// Nationality and civil identity: a nisba the app has no way to know.
const NATIONALITY = 'سعودي|كويتي|مصري|سوري|اردني|عراقي|يمني|مغربي|جزائري|تونسي|ليبي|سوداني|لبناني|فلسطيني|اماراتي|قطري|بحريني|عماني|هندي|باكستاني';
// A profession or a scholarly rank asserted as a fact about him.
const PROFESSION = 'اعلامي|صحفي|ممثل|مطرب|فنان|لاعب|طبيب|مهندس|محامي|رجل اعمال|استاذ جامعي|داعيه|مفتي الديار|رئيس الهيئه|عضو هيئه كبار العلماء|من كبار العلماء|من علماء|عالم معاصر|شاعر';

/**
 * Does this sentence assert a biographical fact about a named person?
 *
 * The name must be there: «توفي رحمه الله» in a hadith narration is about somebody else entirely,
 * and a rule that fired on the words alone would refuse half of Islamic prose.
 */
function assertsIdentity(foldedText, namesAlternation) {
  if (!namesAlternation) return false;
  if (!new RegExp(namesAlternation, 'u').test(foldedText)) return false;
  return new RegExp('(?:' + DEATH_MARKERS + '|' + NATIONALITY + '|' + PROFESSION + ')', 'u').test(foldedText);
}

const RX = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Strong punctuation and explicit sequence/contrast open a new sentence. Commas are handled as
// local proposition boundaries by the source-licence scanner below: that lets it preserve the
// two real apposition shapes («ابن باز، عالم معروف» / «العالم المعروف، ابن باز»)
// without allowing a question or predicate about A to govern B on the other side of a comma.
const IDENTITY_CLAUSE_SPLIT = /(?<=[.!؟?؛;])\s+|\n+|\s+(?:ثم|لكن|بل)\s+/u;
const IDENTITY_ATTRIBUTE_PATTERN = fold(
  DEATH_MARKERS + '|' + NATIONALITY + '|' + PROFESSION + '|' + RANK_MARKERS + '|' + MADHHAB_ADOPTION,
);
const IDENTITY_AFTER_JOIN = '(?:\\s+(?:(?:و?هو|و?هي|فهو|فهي|فانه|فانها)\\s+)?'
  + '|[،,]\\s*(?:(?:و?هو|و?هي|فهو|فهي|فانه|فانها)\\s+)?'
  + '|\\s*[:؛;—–-]\\s*)';
const IDENTITY_BEFORE_JOIN = '\\s+';
const IDENTITY_NON_ASSERTION_HEAD =
  '(?:لا اعلم هل|لا ادري هل|لا استطيع القول(?:\\s+ان)?|لم اتحقق(?:\\s+من|\\s+مما)?|لم نقف علي ما يثبت|هل)';

/** Does a question/uncertainty frame govern this exact upcoming name occurrence? */
function nonAssertionBeforeName(left, verbs = '') {
  const predicate = verbs ? '(?:(?:' + verbs + ')\\s+)?' : '';
  // Anchored at the name edge: uncertainty about A cannot mask a later assertion about B. The
  // bounded predicate/title bridge covers both Arabic orders («هل يرى الشيخ فلان» / «هل فلان يرى»)
  // without treating a distant marker elsewhere in the clause as governing this proposition.
  return new RegExp('(?:^|\\s)' + IDENTITY_NON_ASSERTION_HEAD
    + '\\s+(?:ان\\s+)?' + predicate + '(?:(?:' + TITLES + ')\\s+)*$', 'u').test(left);
}

/**
 * Does prose make a positive identity, profession, or rank assertion about this exact entity?
 *
 * Unlike the older roster-wide co-occurrence check, this contract is intentionally local. The
 * entity and predicate must occupy the same sentence/contrast clause and be joined as a nominal
 * assertion. A fact about Ibn Baz in the next sentence cannot turn an unresolved reader-supplied
 * name into a known scholar. Explicit non-assertions and questions likewise say that verification
 * is missing; they do not assert the biography they mention.
 */
export function assertsUnverifiedIdentityAbout(text, entity) {
  const exact = fold(String(entity || '')).trim();
  if (!exact) return false;
  const entitySource = exact.split(/\s+/u).map(RX).join('\\s+');
  const entityPattern = '(?<![\\p{L}\\p{M}\\p{N}])(?:' + entitySource
    + ')(?![\\p{L}\\p{M}\\p{N}])';
  const entityMatches = new RegExp(entityPattern, 'gu');
  const after = new RegExp('^' + IDENTITY_AFTER_JOIN
    + '(?:' + IDENTITY_ATTRIBUTE_PATTERN + ')', 'u');
  const before = new RegExp('(?:' + IDENTITY_ATTRIBUTE_PATTERN + ')'
    + IDENTITY_BEFORE_JOIN + '$', 'u');

  return String(text || '').split(IDENTITY_CLAUSE_SPLIT).some((rawClause) => {
    const clause = fold(rawClause).trim();
    if (!clause) return false;
    for (const match of clause.matchAll(entityMatches)) {
      const left = clause.slice(0, match.index);
      const right = clause.slice(match.index + match[0].length);
      // A non-assertion governs this entity only when it occurs in the local prefix leading to
      // this exact occurrence. A previous comma/contrast is already a clause boundary above.
      if (nonAssertionBeforeName(left)) continue;
      if (after.test(right) || before.test(left)) return true;
    }
    return false;
  });
}

/**
 * THE NAMES THIS DRAFT MAY NOT CREDIT — every registered person plus the surface the reader wrote,
 * minus everybody the pages in hand license.
 *
 * A ONE-WORD SURFACE NEEDS AN HONORIFIC IN FRONT OF IT, and that is not fastidiousness. «مسلم» is
 * the display form of الإمام مسلم and it is also every Muslim; «مالك» is an imam and an owner;
 * «الخميس» is a shaykh and it is Thursday. Policing those words bare would drop «وكل مسلم مصري أو
 * سعودي عليه كذا» as a fabricated biography. Behind «الإمام» they are the man, and that is exactly
 * how a draft that meant the man would have to write him.
 *
 * @returns {string} a regex source matching a policed name, or '' when nobody is policed
 */
function policedNamePattern(ctx) {
  const licensed = licensedSurfaces(ctx.sourceLicence);
  // A full fetched world page may license the exact non-roster public figure
  // the reader typed (for example Einstein).  The caller supplies this only
  // after finding that whole surface in an admitted page; it never promotes a
  // fuzzy search hit or a provider snippet.
  for (const surface of Array.isArray(ctx.licensedEntitySurfaces) ? ctx.licensedEntitySurfaces : []) {
    const value = fold(String(surface || ''));
    if (value) licensed.add(value);
  }
  const multi = [];
  const single = [];
  const consider = (s) => {
    const f = fold(s || '');
    if (!f || licensed.has(f)) return;
    (f.includes(' ') ? multi : single).push(f);
  };
  for (const s of allPersonSurfaces()) consider(s);
  // The reader's own spelling. «طارق العلي» is in no roster — that is the whole point of the
  // incident — and a rule that only policed registered names would have let every word of it out.
  consider(ctx.entity);

  const order = (a, b) => b.length - a.length;
  const parts = [];
  // Arabic conjunction/preposition clitics attach to names. Preserve them outside the captured
  // personal surface so «وابن باز» and «فابن باز» are still the same unlicensed person.
  if (multi.length) parts.push('(?<![ء-ي])(?:[وفبكل])?(?:'
    + [...new Set(multi)].sort(order).map(RX).join('|') + ')(?![ء-ي])');
  if (single.length) parts.push('(?:' + TITLES + ')\\s+(?:' + [...new Set(single)].sort(order).map(RX).join('|') + ')(?![ء-ي])');
  return parts.length ? '(?:' + parts.join('|') + ')' : '';
}

/** Does this text credit a policed name with a صفة or a موقف? */
function creditsAPolicedName(foldedText, who) {
  if (!who) return false;
  const verbBody = '(?:' + SPEECH_VERBS + '|' + POSITION_VERBS + '|' + ALIGNMENT_VERBS + ')';
  const verbs = '(?:[وف])?' + verbBody;
  const nounClaims = '(?:قول|كلام|راي|موقف|فتوي|حكم)';
  const identity = '(?:' + IDENTITY_ATTRIBUTE_PATTERN + '|(?:عالم|عالما))';
  // A multi-word registered surface does not consume its preceding honorific. Permit a bounded
  // modifier/title bridge, but keep the predicate in this comma-delimited proposition.
  const verbBefore = new RegExp('(?:^|\\s)' + verbs + '\\s*(?:(?:[ء-ي]+)\\s+){0,2}$', 'u');
  const verbAfter = new RegExp('^\\s*' + verbs + '(?=\\s|$)', 'u');
  const attributeAfter = new RegExp('^' + IDENTITY_AFTER_JOIN
    + identity, 'u');
  const attributeBefore = new RegExp(identity
    + '(?:\\s*[:،,]\\s*|' + IDENTITY_BEFORE_JOIN + ')$', 'u');
  const nounBefore = new RegExp('(?:^|\\s)(?:هذا\\s+)?' + nounClaims + '\\s*$', 'u');
  const nounAfter = new RegExp('^\\s*(?:ف(?:هو|ان(?:ه)?)\\s*)?(?:هو\\s+)?(?:' + nounClaims + ')', 'u');
  const copulaBefore = /(?:^|\s)(?:وكان|فكان|كان)\s*(?:(?:[ء-ي]+)\s+){0,2}$/u;
  const appositiveCopula = '(?:(?:و?هو|و?هي|فهو|فهي|فانه|فانها)\\s+)?';
  const exactIdentity = new RegExp('^\\s*' + appositiveCopula + identity + '(?:\\s|$)', 'u');
  const exactIdentityTail = new RegExp('(?:^|\\s)' + identity + '\\s*$', 'u');
  const anyPolicedName = new RegExp(who, 'u');
  const questionOrNegation = new RegExp(
    '^(?:هل|ماذا|ما\\s+(?:' + verbBody + '|' + nounClaims + ')|لا\\s+(?:اعلم|ادري|استطيع)|لم\\s|ليس\\s|هذا\\s+ليس\\s)',
    'u',
  );

  // Bind every decision to one comma-delimited proposition. Adjacent propositions participate
  // only in the two explicit apposition shapes; questions about A therefore cannot license B,
  // and a licensed predicate about A cannot turn a neutral mention of B into a claim.
  return String(foldedText || '').split(IDENTITY_CLAUSE_SPLIT).some((rawSentence) => {
    const sentence = fold(rawSentence).trim();
    if (!sentence) return false;
    const wholeQuestion = /[؟?]\s*$/u.test(sentence);
    const units = sentence.split(/[،,]/u).map((part) => part.trim()).filter(Boolean);
    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
      const unit = units[unitIndex];
      const names = new RegExp(who, 'gu');
      for (const match of unit.matchAll(names)) {
        const left = unit.slice(0, match.index);
        const right = unit.slice(match.index + match[0].length);
        const localNonAssertion = wholeQuestion || questionOrNegation.test(unit)
          || nonAssertionBeforeName(left, verbs);
        if (localNonAssertion) continue;

        if (verbBefore.test(left) || verbAfter.test(right)
          || attributeAfter.test(right) || attributeBefore.test(left)
          || nounBefore.test(left) || nounAfter.test(right)
          || (copulaBefore.test(left) && exactIdentity.test(right))) return true;

        // Cross-comma apposition is safe only when the name-side unit contains no other content.
        // This is what distinguishes «ابن باز، عالم معروف» from «ابن باز عالم، فلان مذكور».
        const withoutName = (left + ' ' + right).trim()
          .replace(/^(?:و?اما)\s*/u, '')
          .replace(/[.!؟?؛;:—–-]+$/u, '')
          .trim();
        if (!withoutName) {
          const previous = units[unitIndex - 1] || '';
          const next = units[unitIndex + 1] || '';
          // A neighbouring unit containing a different policed person is a new proposition, not
          // an appositive. This is the exact F-007/F-031 boundary: licensed Ibn Baz on the left
          // cannot turn a neutral unknown target on the right into an attributed claim.
          const previousHasPerson = anyPolicedName.test(previous);
          anyPolicedName.lastIndex = 0;
          const nextHasPerson = anyPolicedName.test(next);
          anyPolicedName.lastIndex = 0;
          if (exactIdentityTail.test(previous)
            || (!nextHasPerson && exactIdentity.test(next))
            || verbAfter.test(next) || nounAfter.test(next)) return true;
        }
      }
    }
    return false;
  });
}

/** Arabic quotation marks and the ASCII pair a normal keyboard produces. */
const QUOTED = /[«"']([^«»"']{12,})[»"']/u;

/**
 * WHAT THIS DRAFT CLAIMS THAT ITS EVIDENCE DOES NOT SUPPORT.
 *
 * @param {string} text          the drafted reply, before the reader sees any of it
 * @param {object} ctx
 *   entity            string — the surface the reader named, added to the roster alternation
 *   notDirectlyVerified boolean — no text OF HIS was verified for THIS issue
 *   searchProven      boolean — a search actually ran for his own corpus
 *   allowSourcedPosition boolean — a grade-C transmission («ذكر المصدر أن رأيه…») is permitted
 * @returns {string[]} problem codes; empty means the draft may be sent
 */
export function consistencyProblems(text, ctx = {}) {
  const t = fold(text || '');
  if (!t) return [];
  const problems = [];
  const names = entityNameAlternation(ctx.entity ? [ctx.entity] : []);
  const who = '(?:' + TITLES + (names ? '|' + names : '') + ')';

  if (ctx.notDirectlyVerified) {
    // SPEECH is never allowed without a verified text of his — not even as a sourced transmission,
    // because «ذكر المصدر أن ابن تيمية قال» still asserts a wording nobody verified.
    // BOTH WORD ORDERS. Arabic puts the subject before the verb too — «ابن تيمية قال» is the same
    // claim as «قال ابن تيمية», and a checker that only knows one of them is a checker the model
    // walks straight past. lib/policy/entities.js records the same lesson for its own frames.
    if (new RegExp('(?:' + SPEECH_VERBS + ')\\s*' + who, 'u').test(t)
      || new RegExp(who + '\\s*(?:' + SPEECH_VERBS + ')', 'u').test(t)) {
      problems.push(PROBLEM.SPEECH_WITHOUT_EVIDENCE);
    }
    // A POSITION may be transmitted at grade C — «ذكر موقع إسلام ويب أن ابن تيمية يرى…» — but only
    // when the caller says a sourced transmission is on the table AND the sentence actually names
    // the source it is transmitting from. A bare «يرى ابن تيمية» is the app's own assertion.
    //
    // WHEN THE CALLER SUPPLIES THE PUBLISHERS IT ACTUALLY FETCHED, naming one of them is required
    // rather than merely encouraged: «ذكر بعض المواقع» is a transmission frame with nobody in it,
    // and a reader cannot check a source that was never named. This is what lets an encyclopedic
    // search REPORT a historical scholar's position instead of refusing to say anything about him
    // — which was the whole complaint: the app apologised where a documented transmission existed.
    const positional = new RegExp('(?:' + POSITION_VERBS + ')\\s*' + who, 'u').test(t)
      || new RegExp(who + '\\s*(?:' + POSITION_VERBS + ')', 'u').test(t);
    const transmitted = ctx.allowSourcedPosition && hasTransmissionFrame(t) && namesAPublisher(t, ctx);
    if (positional && !transmitted) {
      problems.push(PROBLEM.POSITION_WITHOUT_EVIDENCE);
    }
    // A QUOTATION is the strongest claim of all and needs a verified span. Only flagged when the
    // draft also names him, so quoting a Qur'anic verse or a hadith is untouched.
    if (QUOTED.test(t) && (names ? new RegExp(names, 'u').test(t) : false)) {
      problems.push(PROBLEM.QUOTE_WITHOUT_EVIDENCE);
    }
  }

  // WHO HE IS, WITHOUT A PAGE THAT SAYS SO. Deliberately OUTSIDE the `notDirectlyVerified` block:
  // a fabricated obituary is not a weaker form of attribution that a verified fatwa would excuse.
  // Having read a page of his rulings tells us nothing about whether he is alive, and the sentence
  // that killed him off is wrong either way. `identityVerified` is the only thing that licenses
  // it, and it means a source actually described him.
  const exactUnknownIdentity = ctx.identityStatus === 'unknown'
    && assertsUnverifiedIdentityAbout(text, ctx.entity);
  const generalIdentity = ctx.identityStatus === 'unknown' ? false : assertsIdentity(t, names);
  if (!ctx.identityVerified && (exactUnknownIdentity || generalIdentity)) {
    problems.push(PROBLEM.IDENTITY_WITHOUT_EVIDENCE);
  }

  // ── THE SOURCE-CLASS RULE ──────────────────────────────────────────────────
  //
  // ABSENCE IS NOT A LICENCE. `licensedSurfaces` already maps undefined, null, and malformed
  // values to the empty set; the claim detector below keeps ordinary prose untouched. Thus only
  // a real attributed claim is refused, while an unwired caller cannot silently license one.
  if (creditsAPolicedName(t, policedNamePattern(ctx))) {
    problems.push(PROBLEM.ATTRIBUTION_NOT_LICENSED);
  }

  // THE APP MAY NOT PREFER ONE QAWL OVER ANOTHER. Outside every other block on purpose: this is
  // not a claim about the named entity at all, so verifying HIS text excuses none of it. «الراجح
  // أنّ …» in the app's own voice is an act of ifta' whoever the question was about.
  if (tarjihWithoutEvidence(t, ctx)) {
    problems.push(PROBLEM.TARJIH_WITHOUT_EVIDENCE);
  }

  // A RULING NO PAGE IN HAND CARRIES. Outside every other block, and reading the RAW text rather
  // than the folded one because the frozen-text index and the pivot-term machinery do their own
  // normalisation and must see the original characters to do it.
  if (rulingWithoutSource(text, ctx)) {
    problems.push(PROBLEM.RULING_WITHOUT_SOURCE);
  }

  // ARITHMETIC. Armed for every caller, because refuting it takes no evidence — only reading.
  if (numericContradiction(text)) {
    problems.push(PROBLEM.NUMERIC_CONTRADICTION);
  }

  // THE TAG AND THE TEXT. Also evidence-free: the frozen corpus already knows what each run is.
  if (frozenTagMismatch(text)) {
    problems.push(PROBLEM.FROZEN_TAG_MISMATCH);
  }

  // «لم أقف» / «لم أجد» is a statement about work that was done. Without a search it is false.
  if (!ctx.searchProven && /لم اقف|لم اجد|لم اعثر|لا يوجد نص/u.test(t)) {
    problems.push(PROBLEM.NEGATION_WITHOUT_SEARCH);
  }
  return problems;
}

/** Does the sentence credit a SOURCE with the transmission, rather than asserting it outright? */
function hasTransmissionFrame(foldedText) {
  return /ذكر|نقل|ينقل|اورد|حكي|جاء في|ورد في|بحسب|وفق|افاد|وثق|منشور/u.test(foldedText);
}

/**
 * Is the intermediate source NAMED, so the reader can go and check it?
 *
 * When the caller passes no publisher list there is nothing to check against and a transmission
 * frame alone has to do. When it passes the publishers it actually fetched, one of them must
 * appear: a frame with no name in it — «ذكر بعض المواقع» — cites nothing.
 */
function namesAPublisher(foldedText, ctx) {
  const list = (ctx.transmissionPublishers || []).map((p) => fold(String(p || ''))).filter(Boolean);
  if (!list.length) return true;
  return list.some((p) => foldedText.includes(p));
}

/**
 * THE REPLACEMENT WHEN THE DRAFT IS DROPPED.
 *
 * It states exactly what is and is not available, makes no religious claim, and does NOT say we
 * found nothing of his — because in this branch nothing of his was searched.
 */
// IT MAKES NO CLAIM ABOUT WHAT EXISTS. It says what this reply may not do, which is a fact about
// us. Saying «لم أقف على نصٍّ له» here would be the very negation-without-search this module
// refuses, and a replacement that breaks the rule it enforces is not a replacement.
//
// ── AND IT NO LONGER CALLS ANYBODY «هذا العالِم» ──────────────────────────────
// MEASURED: this exact sentence was served for «ما رأي خالد عبدالرحمن في قصر الصلاة؟» — a singer —
// and for «ما رأي طارق العلي في أحكام العدة؟» — a comic actor. The refusal withheld the fatwa and
// granted the standing in the same breath, and the standing is the more consequential of the two:
// a reader who is told «I do not attribute a position to THIS SCHOLAR» has been told he is one.
//
// The subject of the sentence is now the ATTRIBUTION, which is a fact about this reply, instead of
// the man, which is a fact we did not establish. It therefore holds whatever the name turns out to
// be — registered scholar, unknown name, or a name no page anywhere carries — which is exactly why
// it may be emitted before any of that is known.
// ── AND IT NO LONGER OFFERS THE READER A CHOICE (ج٢) ─────────────────────────
// MEASURED: this sentence used to end «…وأستطيع أن أعرض لك حكمَ المسألة نفسِها من مصادرها
// الموثَّقة، أو أنقلَ ما تذكره المصادرُ عن هذا الاسم منسوبًا إليها لا إليه — فاختر ما تريد.»
// Served for «ما رأي الشيخ سالم المري العتيبي في صلاة الوتر»: the reader asked a ruling question,
// was told the name could not be attributed to, and was then handed a MENU — including an option
// («اعرض لي حكم المسألة») that is simply the answer he had already asked for.
//
// That is the clarifying question this codebase retired from the names path, wearing a different
// coat. Offering to do a thing costs the reader a turn to obtain what asking once should have
// produced, and the app can already do it: the ruling is answered from the retrieved sources on
// the same turn. So the offer retires and the sentence states the limit and stops.
export const NO_ATTRIBUTION_AVAILABLE =
  'لا أنسبُ قولًا في هذه المسألة إلى أحدٍ ما لم أتحقّقْ من نصٍّ له فيها، ولم يتحقّقْ لي ذلك في هذا الجواب.';

// ── THE GATE READS THE DRAFT, NOT THE PLAN ───────────────────────────────────
//
// `consistencyProblems` judges a whole reply, and the handler's answer to a problem was to drop
// the whole reply. That is right when the offending attribution IS the answer — the reader asked
// what Ibn Taymiyyah held, and a reply that credits him without evidence has nothing left once
// the credit is removed. It is far too blunt when the attribution is one incidental sentence in
// an otherwise sourced answer: the reader loses a correct ruling because of a clause.
//
// AND THE GATE WAS ARMED FROM THE WRONG PLACE. It ran only when the PLAN said this was an
// attribution request. A draft that names a scholar the reader never asked about — the model
// reaching for authority on its own — was not an attribution request by the plan and met no gate
// at all. What may be said about a man is a property of the TEXT GOING OUT, not of the question
// that prompted it.
const SENTENCE_SPLIT = /(?<=[.!؟?])\s+|\n+/u;

/**
 * Judge a draft sentence by sentence.
 *
 * @param {string} text the drafted reply
 * @param {object} ctx  as consistencyProblems, plus:
 *   subjectEntity  string — the man the READER asked about. An offence in a sentence naming him
 *                  is the substance of the answer, so the whole draft goes.
 * @returns {{text:string, problems:string[], droppedSentences:string[], dropWhole:boolean}}
 */
export function screenDraft(text, ctx = {}) {
  const raw = String(text || '');
  if (!raw.trim()) return { text: '', problems: [], droppedSentences: [], dropWhole: false, outcome: 'CLEAN', degraded: [], repairAttempted: false };

  const whole = consistencyProblems(raw, ctx);
  // NO EARLY RETURN ON A CLEAN WHOLE. Every other rule in this file is a regex OR over the text,
  // so a draft that offends in one sentence always offends as a whole and the shortcut was sound.
  // RULING_WITHOUT_SOURCE is a MEASUREMENT, and a measurement dilutes: a draft holding one
  // well-sourced ruling and one invented one scores well enough as a paragraph to clear the bar
  // that its invented sentence fails on its own. The shortcut would have hidden exactly the
  // sentence this rule exists to find, so the sentence pass now always runs.
  const sentences = raw.split(SENTENCE_SPLIT).filter((s) => s.trim());
  const subject = fold(String(ctx.subjectEntity || ''));
  const kept = [];
  const dropped = [];
  const problems = new Set();
  let dropWhole = false;
  // How much of the ANSWER survives, as opposed to how much of the TEXT. A reply that keeps its
  // framing and loses every ruling in it has not been trimmed; it has been emptied, and sending
  // the remainder would read as an answer that declined to answer.
  let rulingSentences = 0;
  let rulingsDropped = 0;

  for (const s of sentences) {
    const carries = carriesRuling(s);
    if (carries) rulingSentences++;
    const p = consistencyProblems(s, ctx);
    if (!p.length) { kept.push(s); continue; }
    if (carries) rulingsDropped++;
    p.forEach((x) => problems.add(x));
    dropped.push(s);
    // IS THIS THE ANSWER, OR AN ASIDE? If the offending sentence names the very man the reader
    // asked about, trimming it leaves a reply that answers a question nobody asked while quietly
    // dropping the one that was. That is not a repair; it is a different failure.
    // ...UNLESS THE CALLER HAS ALREADY DISCLAIMED THE ATTRIBUTION IN ITS OWN VOICE (ج٢).
    // Then the man is settled business — the reader has been told plainly that nothing will be
    // credited to him — and the RULING is the only question still standing. Dropping it too
    // answers nothing. The offending sentence is still trimmed; only the escalation is withheld.
    if (subject && fold(s).includes(subject) && !ctx.attributionDisclaimed) dropWhole = true;
  }

  // A CLEAN DRAFT IS RETURNED WHOLE AND UNTOUCHED — neither the paragraph nor any sentence in it
  // broke a rule. Stated here rather than as a shortcut above, because the sentence pass is what
  // establishes the second half of it.
  if (!whole.length && !dropped.length) {
    return { text: raw, problems: [], droppedSentences: [], dropWhole: false, rulingUnsourced: false, outcome: 'CLEAN', degraded: [], repairAttempted: false };
  }
  // A draft that offends as a WHOLE but in no single sentence is one where the attribution is
  // spread across sentences — «وقد أفتى في هذا. قال إن الأمر واسع.» Neither half is safe to keep.
  if (whole.length && !dropped.length) dropWhole = true;
  // Nothing survived, so there is nothing to send but the replacement.
  if (!kept.length) dropWhole = true;

  // EVERY RULING IN THE DRAFT WAS UNSOURCED. What is left is framing around an answer that is no
  // longer there, so the honest reply is the «no verified source» wording — which makes no
  // religious claim at all — and NOT the attribution replacement, which is a sentence about a
  // person, and in this class of failure there is no person in the question.
  //
  // AND IT IS THE FLAG OF LAST RESORT, not the first one read. A draft can break this rule AND
  // credit a man we never verified — «يرى الشيخ فلان أنّ القصر واجب» over nothing at all breaks
  // both at once. There the reader asked about a PERSON, and the attribution refusal is the
  // better answer to him by some distance: it says why no position is attributed and offers to
  // bring the ruling of the issue from its own sources. So this flag is raised only when the
  // unsourced ruling is the ONLY thing wrong — which is exactly the class batch 5 found
  // unguarded: a ruling with no name in it anywhere.
  const rulingUnsourced = rulingSentences > 0
    && rulingsDropped === rulingSentences
    && problems.has(PROBLEM.RULING_WITHOUT_SOURCE)
    && problems.size === 1;
  if (rulingUnsourced) dropWhole = true;

  // X-013/ز — SAYING SO IS PART OF THE CONTRACT. Trimming sentences and handing back the remainder
  // with nothing but a `problems` array the caller may or may not read is the silent deletion this
  // item exists to end. The sentence pass above IS the one repair attempt; what leaves here is
  // therefore either a REBUILT text or an explicit REFUSAL, and both carry a degraded record.
  const degraded = dropped.length || dropWhole
    ? [`consistency-dropped:${dropped.length}`, ...(dropWhole ? ['consistency-drop-whole'] : [])]
    : [];
  return {
    text: dropWhole ? '' : kept.join(' '),
    problems: [...problems].length ? [...problems] : whole,
    droppedSentences: dropped,
    dropWhole,
    rulingUnsourced,
    outcome: dropWhole ? 'REFUSED' : 'REBUILT',
    degraded,
    repairAttempted: true,
  };
}

/** The wording when the ceiling, not the evidence, is what stopped the search. */
export const SEARCH_NOT_COMPLETED =
  'تعذّر استكمالُ البحث ضمن الحدود التشغيلية لخدمة عزك، فلم أستوفِ هذه المسألة بحثًا. '
  + 'أعِدْ سؤالي عنها لاحقًا.';
