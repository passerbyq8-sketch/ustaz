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
  AGREED_UPON, NOT_RAISED, RULING_BOOK_IDS, SHAYKHAYN_IDS, TAKHRIJ_LADDER_IDS, composeParenthetical,
  isShaykhayn, ladderRowFor,
} from './takhrij-ladder.js';

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
// number chosen here: it is what lib/lib-contract.js's `LIB_LIMIT_MAX` makes the service return
// and what lib/free-brain/tools.js was throwing half of away. See the measurement at `cap` there.
/** How many library rows the takhrij path reads per call. The model's own five is untouched. */
export const TAKHRIJ_ROWS_PER_CALL = 10;

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

/** Diacritics, tatweel and punctuation off, alef/ya/ta-marbuta unified. Comparison only. */
export function foldArabic(value) {
  return String(value == null ? '' : value)
    .replace(DIACRITICS_RE, '')
    .replace(PUNCTUATION_RE, ' ')
    .replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627')
    .replace(/[\u0626\u0649]/gu, '\u064A')
    .replace(/\u0624/gu, '\u0648')
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

// A HUMAN SPEAKER WHO IS NOT HIM. When one of these stands between the prophetic frame and
// the quotation, the words belong to that man and §٢-ج forbids touching them.
const HUMAN_CREDIT_WORDS = [
  'قال الشيخ', 'قال الإمام', 'قال ابن', 'قال النووي', 'قال الألباني', 'قال العلامة',
  'قال الحافظ', 'وقال الشيخ', 'وقال ابن', 'يقول الشيخ', 'قال الدكتور', 'قال المفتي',
  'ونقل', 'وأفتت', 'قالت اللجنة',
];
const HUMAN_CREDIT_RE = new RegExp(alternation(HUMAN_CREDIT_WORDS), 'gu');

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
      const at = span.start + match.index;
      // The sentence this quotation stands in, and nothing before it.
      const before = chunk.slice(0, match.index);
      const boundary = lastIndexOfPattern(before, BOUNDARY_RE);
      const segment = before.slice(boundary + 1);
      const segmentAt = span.start + boundary + 1;

      // AND HE MUST BE THE LAST SPEAKER NAMED. A quotation introduced by «وقال ابن باز» in a
      // sentence that also mentions the Prophet ﷺ is that man's sentence, not a matn.
      const lastFrame = lastIndexOfPattern(segment, PROPHET_FRAME_RE);
      if (lastFrame < 0) continue;
      const lastHuman = lastIndexOfPattern(segment, HUMAN_CREDIT_RE);
      if (lastHuman > lastFrame) continue;

      // The lead-in starts at the verb IMMEDIATELY in front of the frame — the LAST one at or
      // before it, never the first. MEASURED: taking the first swallowed a whole earlier
      // hadith when two stood in one sentence, and shipped the two spliced together.
      // Anything before that point is the answer's own prose and is untouched.
      let leadStart = segmentAt + lastFrame;
      LEAD_VERB_RE.lastIndex = 0;
      let verb;
      while ((verb = LEAD_VERB_RE.exec(segment)) !== null) {
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
export function parentheticalSlot(text, target, ceiling = -1) {
  const value = String(text == null ? '' : text);
  const after = value.slice(target.end);
  if (CLOSED_CLAUSE_RE.test(after)) return { at: target.end, deferred: false };
  const before = value.slice(0, target.start).replace(/\s+$/u, '');
  if (SAYING_LEAD_RE.test(before)) return { at: target.end, deferred: false };
  const stop = after.search(FULL_STOP_RE);
  if (stop < 0) return null;
  const at = target.end + stop;
  if (ceiling >= 0 && at > ceiling) return null;
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
const ATTRIBUTION_RE = new RegExp(
  '(?:' + alternation(ATTRIBUTION_PHRASE_WORDS) + ')'
  + '|(?:' + alternation(ATTRIBUTION_VERB_WORDS) + ')\\s+[\\u0621-\\u063A\\u0641-\\u064A]+',
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
  const words = String(last[1]).trim().split(/\s+/u)
    .filter((word) => !COMPANION_STOP.has(foldArabic(word)));
  if (!words.length || words.length > 5) return { name: '', prayer: '' };
  if (words.some((word) => NOT_A_NAME.has(foldArabic(word)))) return { name: '', prayer: '' };
  const name = words.join(' ').trim();
  if (name.length < 3) return { name: '', prayer: '' };
  return { name, prayer: String(last[2]).trim() };
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
export function runnerLookup(runTool, ctx) {
  return async (matns, options = {}) => {
    const bookIds = Array.isArray(options.bookIds) && options.bookIds.length
      ? options.bookIds
      : TAKHRIJ_LADDER_IDS;
    return Promise.all((Array.isArray(matns) ? matns : []).map(async (matn) => {
      let out;
      try {
        out = await runTool('search_library', { query: matn }, {
          ...ctx, bookIds, resultCap: TAKHRIJ_ROWS_PER_CALL,
        });
      } catch {
        // The runner is documented never to throw. If it ever does, an unsourced matn is the
        // honest answer and a thrown turn is not.
        return { matn, subjectIds: [], atoms: [] };
      }
      const rows = out && Array.isArray(out.added) ? out.added : [];
      return {
        matn,
        subjectIds: rows.map((row) => String((row && row.subjectId) || '')),
        atoms: rows.map((row) => String((row && row.text) || '')),
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
  const anchor = words.slice(0, Math.max(MIN_ANCHOR_WORDS, Math.ceil(words.length * 0.6))).join(' ');
  return haystack.includes(anchor);
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
export function lafzVariants(matn) {
  const bare = bareArabic(matn);
  const words = bare.split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length && out.length < LAFZ_MAX_VARIANTS; i += 1) {
    const word = words[i];
    let swapped = '';
    // ات → ة : the sound feminine plural read back to its singular, and the other way round.
    if (/ات$/u.test(word) && word.length > 3) swapped = word.slice(0, -2) + 'ة';
    else if (/ة$/u.test(word) && word.length > 2) swapped = word.slice(0, -1) + 'ات';
    if (!swapped) continue;
    const next = [...words];
    next[i] = swapped;
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
  const original = String(text == null ? '' : text);
  const decision = takhrijDecision(input.env || process.env);
  if (!decision.enabled) {
    return { text: original, applied: false, problems: [], entries: [], reason: decision.reason };
  }

  // The prose matns AND the `<hadith>` cards, in the reader's own order — and separately, the
  // cards that repeat a matn the prose already carries (§٢).
  const found = findTargets(original);
  if (!found.targets.length && !found.duplicates.length) {
    return { text: original, applied: false, problems: [], entries: [], reason: 'no_matn' };
  }
  // The duplicates cost no lookup slot: they are dropped, not takhrij'd. So the ceiling is spent
  // on matns the reader will actually meet.
  const targets = found.targets.slice(0, TAKHRIJ_MAX_MATNS);
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
  const duplicates = found.duplicates;

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
  const call = async (matns, options) => {
    if (typeof input.lookup !== 'function' || !matns.length) return [];
    try {
      const answers = await input.lookup(matns, options);
      return Array.isArray(answers) ? answers : [];
    } catch {
      return [];
    }
  };
  const byMatn = (answers) => {
    const map = new Map();
    for (const answer of answers) {
      if (answer && typeof answer.matn === 'string') map.set(answer.matn, answer);
    }
    return map;
  };

  const first = byMatn(await call(targets.map((one) => one.matn), { bookIds: TAKHRIJ_LADDER_IDS }));
  const states = targets.map((target) => {
    const state = { seen: [], confirmed: [], candidates: [] };
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
  const variantsFor = (index) => (states[index].confirmed.length
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
      const second = byMatn(await call(queries, { bookIds: [bookId] }));
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
      { bookIds: RULING_BOOK_IDS }));
    for (const one of ruling) absorbAnswer(states[one.index], one.query, third.get(one.query));
  }

  const problems = [];
  const entries = [];
  // Rewritten back to front, so an earlier replacement cannot move a later offset. The dropped
  // duplicates travel in the SAME descending walk for that one reason: they are edits to the
  // same string, and a separate pass over them would be a pass over stale offsets.
  const edits = [
    ...targets.map((target, index) => ({ kind: 'target', start: target.start, target, index })),
    ...duplicates.map((card) => ({ kind: 'duplicate', start: card.start, card })),
  ].sort((a, b) => a.start - b.start);
  let out = original;
  for (let step = edits.length - 1; step >= 0; step -= 1) {
    const edit = edits[step];
    if (edit.kind === 'duplicate') {
      // §٢ — THE CARD GOES, AND WITH IT THE LINE IT STOOD ON. Its own newline is taken so the
      // answer does not keep a blank line where a repetition used to be; the prose on either
      // side is not touched by one character.
      const card = edit.card;
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
    const parenthetical = composeParenthetical(state.confirmed);
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
      const body = composeHadith({ companion: '', prayer: '', matn: target.matn, parenthetical: '' });
      out = out.slice(0, Math.max(target.leadStart, floor)) + body + out.slice(target.end);
    };
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
      if (isCard) dissolveBare();
      entries.push({
        matn: target.matn,
        parenthetical: '',
        companion: '',
        subjectIds: state.confirmed,
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
      if (isCard) dissolveBare();
      entries.push({
        matn: target.matn,
        parenthetical: '',
        // What WOULD have been written, so the record beside the answer shows the pass had an
        // answer and withheld it — and shows the two side by side for whoever reads the log.
        withheld: parenthetical.text,
        proseAttribution: stated,
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
    // AND «(لا يثبت مرفوعا)» IS NOW A RULING THAT WAS FOUND, not a search that failed: it is
    // reached only through a ladder grader's stated ruling (lib/takhrij-ladder.js). The code
    // keeps its name because it names what the READER is told — «this is not established» —
    // and `TAKHRIJ_SILENT` above is the one that means «we found nothing».
    const denied = parenthetical.text === NOT_RAISED;
    if (denied) problems.push(TAKHRIJ_UNSOURCED);
    // ── THE COMPANION NEEDS TWO BOOKS, AND SAYS SO WHEN HE HAD ONE ───────
    const agreed = agreedCompanion(state.candidates);
    if (!agreed.name && state.candidates.length) problems.push(TAKHRIJ_COMPANION_UNCONFIRMED);
    // ── A DENIAL TAKES NO COMPANION ────────────────────────────────────────
    // Putting a Companion in front of a sentence that says exactly «this is not established»
    // asserts a narration in the same breath as denying it. The name is dropped with it.
    const named = denied ? { name: '', prayer: '', books: 0 } : agreed;
    const sentence = composeHadith({
      companion: named.name, prayer: named.prayer, matn: target.matn, parenthetical: parenthetical.text,
    });
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
    const slot = parentheticalSlot(original, target, ceiling);
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
    if (slot.deferred) {
      // The parentheses first, because they stand AFTER the matn: inserting them cannot move the
      // offsets of the replacement below, while the replacement would move theirs.
      out = out.slice(0, slot.at) + ` (${parenthetical.text})` + out.slice(slot.at);
      const body = composeHadith({
        companion: named.name, prayer: named.prayer, matn: target.matn, parenthetical: '',
      });
      out = out.slice(0, at) + body + out.slice(target.end);
    } else {
      out = out.slice(0, at) + sentence + out.slice(target.end);
    }
    entries.push({
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
      // Where the parentheses went, so a guard reads the ruling and not only its effect.
      from: target.kind,
      deferred: slot.deferred === true,
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
  return { text: out, applied: out !== original, problems: [...new Set(problems)], entries, trace, reason: 'applied' };
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
    const row = ladderRowFor(ids[i]);
    if (!row) continue;
    if (ENTRY_GRADED_IDS.has(ids[i]) && !entryIsMatn(atom, matn)) continue;
    if (!state.confirmed.includes(ids[i])) state.confirmed.push(ids[i]);
    const found = companionFrom(atom, matn);
    if (found.name) {
      state.candidates.push({ name: found.name, prayer: found.prayer, book: bookKeyOf(row) });
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
  return !rows.some((row) => row.grade);
}

export { NOT_RAISED };
