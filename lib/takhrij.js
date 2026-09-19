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
//   4. leave a quoted marfū‘ matn with no parentheses    (NOT_RAISED is the floor)
//
// ── WHAT IT DELIBERATELY LEAVES ALONE ──────────────────────────────────────
// §٢-ج: «والنص المنقول حرفيا لا يمس». A shaykh's fatwa or a lesson carried in someone
// else's words keeps his words even when they carry no takhrij. So this pass reads PROSE
// ONLY: every card block is stepped over whole, and a quotation whose nearest speaker is a
// named human rather than the Prophet ﷺ is left exactly as it arrived.
//
// ── AND EVERY PATTERN HERE IS DIACRITIC-TOLERANT, WHICH IS NOT A REFINEMENT ─
// These answers ship vocalised and unvocalised in the same paragraph — «قَالَ النَّبِيُّ»
// and «قال النبي» are the same frame and must match the same way. Patterns are therefore
// BUILT from bare letters by `tolerant()` rather than typed with harakat, because a harakat
// sequence typed by hand is a sequence nobody measured.

import {
  NOT_RAISED, composeParenthetical, ladderRowFor,
} from './takhrij-ladder.js';

/** At most this many matns are looked up for one answer. See `libraryLookup`. */
export const TAKHRIJ_MAX_MATNS = 4;

/** The problem codes, named once so a guard pins them rather than a wording. */
export const TAKHRIJ_UNSOURCED = 'TAKHRIJ_UNSOURCED';
export const TAKHRIJ_ISNAD_REFUSED = 'TAKHRIJ_ISNAD_REFUSED';

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

/** Diacritics and tatweel off, alef/ya/ta-marbuta unified. Comparison only — never output. */
export function foldArabic(value) {
  return String(value == null ? '' : value)
    .replace(DIACRITICS_RE, '')
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
const QUOTE_RE = /\u00AB([^\u00AB\u00BB]{12,900})\u00BB|\u201C([^\u201C\u201D]{12,900})\u201D/gu;

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
      });
    }
  }
  return out;
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
  let cut = bare.length;
  if (needle) {
    const at = bare.indexOf(needle);
    if (at > 0) cut = at;
    else {
      const words = needle.split(' ').filter(Boolean);
      if (words.length >= 3) {
        const anchor = words.slice(0, 3).join(' ');
        const anchorAt = bare.indexOf(anchor);
        if (anchorAt > 0) cut = anchorAt;
      }
    }
  }
  const prefix = bare.slice(0, cut);
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

// ── THE SENTENCE THE READER GETS ───────────────────────────────────────────

/**
 * The owner's shape, and the only composer of it (§٢-ب):
 *   عن <الصحابي> رضي الله عنه: «<المتن>» (<المخرج> · <الدرجة>)
 * With no Companion in hand the opener is dropped rather than invented; the model's own
 * lead-in then stays in front of the quotation and only the parentheses are added, because
 * the parentheses are the part that must never be missing (§٢-ب/٤).
 */
export function composeHadith({ companion, prayer, matn, parenthetical }) {
  const body = `«${String(matn).trim()}» (${String(parenthetical).trim()})`;
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
// ── AND THE ADAPTER THAT WOULD SPEAK TO THE LIBRARY IS NOT IN THIS FILE ────
//
// IT WAS, AND IT WAS TAKEN BACK OUT. `lib/lib-service.js` is the library's ONE door, and
// guards/lib-book-contract-guard.cjs row A7 says so in as many words: `searchLibrary` has
// exactly one call site in the tree and it is the gated runner in lib/free-brain/tools.js.
// Writing a second call here turned that row red. The guard's own comment on the other
// second door settles what to do about it — «wiring it up should be a decision the owner
// takes with this gate red, not a drift nobody notices» — so it is not taken here.
//
// WHAT THAT COSTS AND WHAT IT DOES NOT. It costs the wire, not the contract: every rule
// §٢-ب states is in this file and is driven by guards/takhrij-contract-guard.cjs against a
// fixture library. `lookup` is an injected function of (matns) -> [{matn, subjectIds, atoms}],
// and the report names the two ways to supply it on the day the owner opens the door:
// a second call site here, or `bookIds` carried through the existing runner's ctx.
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

  const found = findMatns(original);
  if (!found.length) {
    return { text: original, applied: false, problems: [], entries: [], reason: 'no_matn' };
  }
  const targets = found.slice(0, TAKHRIJ_MAX_MATNS);

  let answers = [];
  if (typeof input.lookup === 'function') {
    try {
      answers = await input.lookup(targets.map((one) => one.matn));
    } catch {
      answers = [];
    }
  }
  const byMatn = new Map();
  for (const answer of Array.isArray(answers) ? answers : []) {
    if (answer && typeof answer.matn === 'string') byMatn.set(answer.matn, answer);
  }

  const problems = [];
  const entries = [];
  // Rewritten back to front, so an earlier replacement cannot move a later offset.
  let out = original;
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    const answer = byMatn.get(target.matn) || { subjectIds: [], atoms: [] };
    // ONLY THE ROWS THAT REALLY CARRY THIS MATN, AND ONLY THE ONES ON THE LADDER.
    const confirmed = [];
    let companion = { name: '', prayer: '' };
    const atoms = Array.isArray(answer.atoms) ? answer.atoms : [];
    const ids = Array.isArray(answer.subjectIds) ? answer.subjectIds : [];
    for (let i = 0; i < ids.length; i += 1) {
      const atom = atoms[i] || '';
      if (!atomCarriesMatn(atom, target.matn)) continue;
      if (!ladderRowFor(ids[i])) continue;
      if (!confirmed.includes(ids[i])) confirmed.push(ids[i]);
      if (!companion.name) companion = companionFrom(atom, target.matn);
    }
    const parenthetical = composeParenthetical(confirmed);
    if (!parenthetical.sourced) problems.push(TAKHRIJ_UNSOURCED);
    // ── NO SOURCE, NO COMPANION ────────────────────────────────────────────
    // An unsourced matn ships as «(لا يثبت مرفوعا)», and putting a Companion in front of a
    // sentence that says exactly «this is not established» asserts a narration in the same
    // breath as denying it. The name is dropped with the source it came from.
    const named = parenthetical.sourced ? companion : { name: '', prayer: '' };
    const sentence = composeHadith({
      companion: named.name, prayer: named.prayer, matn: target.matn, parenthetical: parenthetical.text,
    });
    if (carriesIsnad(sentence)) {
      // Refuse the rewrite rather than ship a chain. The matn stays as the model wrote it.
      problems.push(TAKHRIJ_ISNAD_REFUSED);
      entries.push({ matn: target.matn, parenthetical: parenthetical.text, companion: '', rewritten: false });
      continue;
    }
    // The lead-in goes ONLY when the Companion replaces it — and never further back than the
    // end of the matn before it, so two hadiths in one sentence cannot be spliced into one.
    const floor = index > 0 ? targets[index - 1].end : 0;
    const from = named.name ? Math.max(target.leadStart, floor) : target.start;
    out = out.slice(0, from) + sentence + out.slice(target.end);
    entries.push({
      matn: target.matn,
      parenthetical: parenthetical.text,
      companion: named.name,
      subjectIds: confirmed,
      sourced: parenthetical.sourced,
      rewritten: true,
    });
  }
  entries.reverse();
  return { text: out, applied: out !== original, problems: [...new Set(problems)], entries, reason: 'applied' };
}

export { NOT_RAISED };
