// lib/madhhab-books.js -- the four madhhab books the before-writing path asks by name, and how each names its own school.
//
// SPEED W6A A1 (owner, 28 Sep): «إذا قال كتابٌ من كتبِ مذهبٍ «عندنا» أو «أصحابنا» أو «مذهبنا»، يُنسَبُ القولُ إلى ذلك
// المذهب، بشرطين: أن يكونَ الكتابُ موسومًا بمذهبِه في الفهرس، وأن تكونَ العبارةُ كلامَ مصنّفِه لا حكايةً عن غيرِه».
// MEASURED (CONNECT L2; WASL W6): a school's own book does not write the school's name -- Bada'i 2:73 writes «وهذا عندنا»,
// al-Majmu' 5:428 «قد ذكرنا أن مذهبنا» -- so the holder's school test, which asks a cited row for the name itself, held every
// unit that quoted a school from its own book, and the owner's madhhab question ended on the not-found sentence (W4-LIVE, 4).
// This module reads a row's text for the sentences in which its author speaks for his own school; lib/bw2-units.js decides.
import { normalizeArabic } from './route-classify.js';

// -- WHICH BOOKS (R, verbatim; moved here from lib/before-writing-v2.js, which re-exports it) ---------------------------
// The catalogue's madhhab tags: a book is tagged with a school when it is that school's member here, and no other book is.
export const MADHHAB_BOOKS_PRIMARY = Object.freeze([
  Object.freeze({ key: 'hanafi', label: 'الحنفية', bookId: 'FC-003532' }),
  Object.freeze({ key: 'maliki', label: 'المالكية', bookId: 'FC-003623' }),
  Object.freeze({ key: 'shafii', label: 'الشافعية', bookId: 'FC-003660' }),
  Object.freeze({ key: 'hanbali', label: 'الحنابلة', bookId: 'FC-003727' }),
]);

/** The school a row's book is tagged with in the catalogue, by the book id the row carries; '' for an untagged book. */
export function schoolOfRow(row) {
  const m = /FC-\d{6}/u.exec(String((row && (row.recordId || row.subjectId || row.bookId)) || ''));
  const book = m ? MADHHAB_BOOKS_PRIMARY.find((b) => b.bookId === m[0]) : null;
  return book ? book.key : '';
}

const fold = (s) => normalizeArabic(s);
const phrases = (list) => list.map((p) => fold(p).split(' '));

// How a unit names a school (lib/bw2-units.js SCHOOL_KEYS, folded) -> the school. «الجمهور» is no school.
const SCHOOL_OF_KEY = Object.freeze({ 'حنفيه': 'hanafi', 'احناف': 'hanafi', 'مالكيه': 'maliki', 'شافعيه': 'shafii', 'حنابله': 'hanbali' });
/** The school a folded school key of the holder names; '' for one that names no single school. */
export function schoolOfKey(key) { return SCHOOL_OF_KEY[key] || ''; }

// Each school's own name and its imam's, as its own book writes them.
const NAMES = Object.freeze({
  hanafi: phrases(['الحنفية', 'الأحناف', 'أبو حنيفة', 'أبي حنيفة', 'أبا حنيفة']),
  maliki: phrases(['المالكية', 'مالك', 'مالكا']),
  shafii: phrases(['الشافعية', 'الشافعي']),
  hanbali: phrases(['الحنابلة', 'أحمد']),
});
// Standing alone in a clause (not as the subject of «قال» / «عند»), «مالك» is also "the owner" and «أحمد» any Ahmad, so
// those two name their school only as a lead's subject.
const NAMES_ALONE = Object.freeze(Object.fromEntries(Object.entries(NAMES)
  .map(([k, list]) => [k, list.filter((p) => !['مالك', 'مالكا', 'احمد'].includes(p.join(' ')))])));
// The author speaking for his school (the owner's words, and the order's): «عندنا», «أصحابنا», «مذهبنا», «عند أصحابنا»,
// «في المذهب».
const OWN_VOICE = phrases(['عندنا', 'أصحابنا', 'مذهبنا', 'في المذهب']);
// Who the author's own school is, as the subject of a verb of saying: «قال أصحابنا», «قطع المصنف».
const OWN_SUBJECT = phrases(['أصحابنا', 'المصنف']);
// A report of another's view is led by a verb of saying or holding («وقال الشافعي», «وبه قال مالك», «وذهب أبو حنيفة»)...
const SPEECH_LEADS = new Set(['قال', 'قالت', 'قالوا', 'ذهب', 'ذهبت', 'ذهبوا', 'حكي', 'روي', 'نقل', 'يري', 'راي', 'يقول', 'يقولون'].map(fold));
// ...or by «عند» / «مذهب» / «قول» before a name («وعند مالك», «ومذهب أبي حنيفة»); before anything else («عند الإطلاق»)
// they lead nothing.
const NAMED_LEADS = new Set(['عند', 'مذهب', 'قول'].map(fold));
const OTHER_NAMES = phrases(['داود', 'الثوري', 'الأوزاعي', 'الليث', 'إسحاق', 'زفر', 'محمد', 'أبي', 'أبو', 'أبا', 'ابن', 'بعض', 'أهل',
  'الجمهور', 'جمهور', 'أكثر', 'عامة', 'الصاحبين', 'الظاهرية']);
// ...and a sentence that says «عندهم» (and the like) speaks of others.
const OTHERS_WORDS = new Set(['عندهم', 'عندهما', 'مذهبهم', 'قولهم', 'قالوا'].map(fold));
// Boundaries that lead nothing: «(وأما)» opens the next matter.
const BREAKS = new Set(['واما', 'اما']);

const CLITICS = ['و', 'ف', 'ب', 'ل', 'ك', 'وب', 'ول', 'فب', 'فل'];
// Does the folded word stand for `w`, bare or behind a clitic («والشافعي», «للشافعي», «وعند»)?
function wordIs(token, w) {
  if (token === w) return true;
  for (const c of CLITICS) {
    if (token === c + w) return true;
    if (c.endsWith('ل') && w.startsWith('ال') && token === c.slice(0, -1) + 'ل' + w.slice(1)) return true;
  }
  return false;
}
const phraseAt = (tokens, i, phrase) => phrase.every((w, k) => (k === 0 ? wordIs(tokens[i] || '', w) : tokens[i + k] === w));
const anyPhraseAt = (tokens, i, list) => list.some((p) => phraseAt(tokens, i, p));
const hasPhrase = (tokens, list) => tokens.some((_, i) => anyPhraseAt(tokens, i, list));
const leadWord = (token) => {
  for (const set of [SPEECH_LEADS, NAMED_LEADS]) {
    if (set.has(token)) return token;
    if (/^[وف]/u.test(token) && set.has(token.slice(1))) return token.slice(1);
  }
  return '';
};

/**
 * The clauses of a row's text in which its author speaks for `school` in his own voice: each sentence (cut at . ! ? ؟ ؛ *)
 * is cut again before every lead of a report and every «(وأما)»; a clause led by a report of another («وقال الشافعي»,
 * «وعند مالك») or one that says «عندهم» is another's; of the rest, one that says «عندنا», «أصحابنا», «مذهبنا», «في المذهب»,
 * or the school's or its imam's name (NAMES_ALONE), or is led by «قال أصحابنا» / «عند أصحابنا» / «قال مالك» in his own
 * school's book, is the author's own. Line breaks do not
 * cut (a library atom breaks lines where the page has spaces). Returns folded token arrays.
 */
export function ownVoiceClauses(text, school) {
  const own = NAMES[school];
  if (!own) return [];
  const ownSubject = [...OWN_SUBJECT, ...own];
  const out = [];
  for (const sentence of String(text || '').split(/[.!?؟؛*]+/u)) {
    const tokens = fold(sentence).split(' ').filter(Boolean);
    let clause = [];
    let kind = 'plain';
    const close = () => {
      if (clause.length && kind !== 'report' && !clause.some((t) => OTHERS_WORDS.has(t))
        && (kind === 'own' || hasPhrase(clause, OWN_VOICE) || hasPhrase(clause, NAMES_ALONE[school]))) out.push(clause);
      clause = [];
    };
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (BREAKS.has(t)) { close(); kind = 'plain'; continue; }
      const lead = leadWord(t);
      if (lead) {
        const ownNext = anyPhraseAt(tokens, i + 1, ownSubject);
        if (SPEECH_LEADS.has(lead) || ownNext || anyPhraseAt(tokens, i + 1, OTHER_NAMES)
          || Object.entries(NAMES).some(([k, list]) => k !== school && anyPhraseAt(tokens, i + 1, list))) {
          close();
          kind = ownNext ? 'own' : 'report';
        }
      }
      clause.push(t);
    }
    close();
  }
  return out;
}

// The words that state the ruling's direction, not its matter: a clause and a unit agree in matter by the other words.
const RULING_TOKENS = new Set(['يجوز', 'تجوز', 'جواز', 'الجواز', 'بجواز', 'يجزي', 'تجزي', 'اجزاء', 'الاجزاء', 'يصح', 'تصح', 'يجب', 'تجب',
  'واجب', 'حرام', 'يحرم', 'تحريم', 'مكروه', 'يكره', 'مستحب', 'يستحب', 'منع', 'المنع', 'يمنع', 'يمنعون', 'عدم', 'ذهب', 'ذهبوا', 'الي',
  'مذهب', 'قال', 'قول', 'عند', 'حكم', 'انه', 'انها', 'لانه', 'ذلك', 'هذا', 'وهذا', 'التي', 'الذي', 'كان', 'يكون'].map(fold));
// Negation of the ruling: a particle before a verb of the ruling («لا يجوز», «لم تجزئه», «فلا يصح») -- not any «لم» («وإن لم
// يكن» negates nothing of the ruling) -- or a word that is itself the negative ruling («عدم الجواز», «المنع», «يحرم»).
const NEG_PARTICLES = new Set(['لا', 'ولا', 'فلا', 'لم', 'ولم', 'فلم', 'لن', 'ليس', 'وليس', 'ليست'].map(fold));
const RULING_VERB = /^(?:[وف])?(?:يجو|تجو|يجز|تجز|يصح|تصح|يجب|تجب|يحل|تحل|يلزم|تلزم|يشرع|تشرع)/u;
const NEG_RULINGS = new Set(['عدم', 'وعدم', 'بعدم', 'يحرم', 'حرام', 'تحريم', 'بتحريم', 'منع', 'المنع', 'بالمنع', 'يمنع', 'يمنعون', 'منعوا'].map(fold));
const NEGATIONS = new Set([...NEG_PARTICLES, ...NEG_RULINGS]);
const allNames = Object.values(NAMES).flat().flat();
const stem = (w) => {
  let s = w;
  if (s.length > 3 && /^[وفبلك]/u.test(s)) s = s.slice(1);
  if (s.length > 4 && s.startsWith('ال')) s = s.slice(2);
  return s;
};
const matterOf = (tokens, drop = new Set()) => new Set(tokens
  .filter((t) => t.length >= 3 && !RULING_TOKENS.has(t) && !NEGATIONS.has(t) && !drop.has(t)
    && !OWN_VOICE.flat().includes(t) && !allNames.some((n) => wordIs(t, n)))
  .map(stem).filter((s) => s.length >= 3));
const negates = (tokens) => tokens.some((t, i) => NEG_RULINGS.has(t) || (NEG_PARTICLES.has(t) && RULING_VERB.test(tokens[i + 1] || '')));

/**
 * Does `row` license the unit's naming of `school` by its own book's voice? The row's book is tagged `school`, and one of
 * its own-voice clauses supports the unit's statement about that school: they share a word of the matter (not of the
 * ruling's direction, the names or the voice), and they agree on the direction (both negate the ruling, or neither does,
 * the unit read from the school's name to the next school it names).
 * @param {string} unitFolded   the unit, citations off, folded
 * @param {string} key          the folded school key the unit names (lib/bw2-units.js SCHOOL_KEYS)
 * @param {object} row          a candidate row (pinned text, record id)
 * @param {string} pinned       the row's pinned text
 * @param {Array<string>} schoolKeys every school key, to cut the unit's segment
 */
export function licensesOwnSchool(unitFolded, key, row, pinned, schoolKeys) {
  const school = schoolOfKey(key);
  if (!school || schoolOfRow(row) !== school) return false;
  const clauses = ownVoiceClauses(pinned, school);
  if (!clauses.length) return false;
  const unit = String(unitFolded || '').split(' ').filter(Boolean);
  const at = unit.findIndex((t) => t.includes(key));
  if (at < 0) return false;
  let end = unit.length;
  for (let i = at + 1; i < unit.length; i += 1) if (schoolKeys.some((k) => unit[i].includes(k))) { end = i; break; }
  const segmentNegates = negates(unit.slice(at, end));
  const matter = matterOf(unit);
  return clauses.some((clause) => negates(clause) === segmentNegates && [...matterOf(clause)].some((w) => matter.has(w)));
}
