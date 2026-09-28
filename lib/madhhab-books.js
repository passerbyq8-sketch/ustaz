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
// SPEED W6B B0, the boundary (owner, 28 Sep): «يُنسَبُ إلى المذهبِ بـ«عندنا» و«أصحابنا» و«مذهبنا» و«في المذهب»، وباسمِ الإمامِ
// ما لم يخالفْه أصحابُه في الموضعِ نفسِه. ولا يُنسَبُ بـ«من أصحابنا من» ولا «بعض أصحابنا» ولا برأيِ المصنّفِ لنفسِه.»
// Anywhere in a clause, only the school's collective name counts («والشافعية»); the imam's name counts only as the subject of
// «قال» / «عند» / «مذهب», and only where the row does not set his companions against him (AGAINST_IMAM below).
const NAMES_ALONE = Object.freeze({
  hanafi: phrases(['الحنفية', 'الأحناف']), maliki: phrases(['المالكية']), shafii: phrases(['الشافعية']), hanbali: phrases(['الحنابلة']),
});
// The author speaking for his school (the owner's words, and the order's): «عندنا», «أصحابنا», «مذهبنا», «عند أصحابنا»,
// «في المذهب».
const OWN_VOICE = phrases(['عندنا', 'أصحابنا', 'مذهبنا', 'في المذهب']);
// Who the author's own school is, as the subject of a verb of saying: «قال أصحابنا», «عند أصحابنا».
const OWN_SUBJECT = phrases(['أصحابنا']);
// The leads whose subject may be the imam himself: «قال الشافعي», «وعند أبي حنيفة», «ومذهب أحمد». («قول أبي حنيفة», «ذهب
// مالك», «روي عن أحمد» report him and do not count.)
const IMAM_LEADS = new Set(['قال', 'عند', 'مذهب'].map(fold));
// «قال المصنف» / «قول المصنف» is no lead of its own: the clause it opens counts only by its own words.
const AUTHOR = phrases(['المصنف']);
// The partitive names some of the school, not the school: «ومن أصحابنا من», «بعض أصحابنا», «قال بعض الأصحاب», «وجه لبعض
// الأصحاب». A clause it opens is a report.
const PARTITIVE = phrases(['من أصحابنا من', 'بعض أصحابنا', 'بعض الأصحاب']);
// The author's own personal view, not his school's: a clause it opens counts for nothing. «وأختار» (first person) folds to
// «واختار», which is also «and he chose» («واختار الشافعي», al-Mughni 3:84; «واختار الساعي», al-Dasuqi 1:434), so it is
// marked before folding, by its hamza.
const PERSONAL_MARK = 'xpersonalx';
const PERSONAL = phrases(['ولا أرى', 'عندي', 'والذي أراه', 'والذي يظهر لي', 'والمختار عندي', PERSONAL_MARK]);
const markPersonal = (s) => String(s || '').replace(/[\u064B-\u065F\u0670]/gu, '')
  .replace(/(^|[^\p{L}])(و?)أختار(?![\p{L}])/gu, (_, pre) => pre + ' ' + PERSONAL_MARK + ' ');
// His companions set against the imam in the same row: a lead whose subject is one of them («وقال أبو يوسف ومحمد», «وعند
// محمد», «وهو قول أبي يوسف», «وروي عن محمد»), or «خلافا لصاحبيه», «وعنه رواية أخرى», «روايتان», «وفيه وجه».
const COMPANIONS = Object.freeze({
  hanafi: phrases(['أبو يوسف', 'أبي يوسف', 'أبا يوسف', 'محمد', 'زفر', 'صاحباه', 'صاحبيه', 'الصاحبان', 'الصاحبين']),
  maliki: phrases(['ابن القاسم', 'أشهب', 'ابن الماجشون', 'ابن وهب', 'سحنون']),
  shafii: phrases(['المزني', 'البويطي']),
  hanbali: phrases(['القاضي', 'أبو الخطاب', 'أبي الخطاب', 'ابن حامد']),
});
const AGAINST_PHRASES = phrases(['خلافا لصاحبيه', 'خلافا لأصحابه', 'خلافا لهما', 'رواية أخرى', 'روايتان', 'فيه وجه', 'فيه وجهان', 'وجه آخر']);
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
 * Does the row set the imam's companions against him (SPEED W6B B0: «ما لم يخالفْه أصحابُه في الموضعِ نفسِه»)? A lead whose
 * subject is one of them («وقال محمد», «وهو قول أبي يوسف ومحمد», «وروي عن محمد»), or «خلافا لصاحبيه», «وعنه رواية أخرى»,
 * «روايتان», «وفيه وجه». Measured on the whole row, the place the owner means: the row is what a unit cites.
 */
function againstImam(tokens, school) {
  const companions = COMPANIONS[school] || [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (anyPhraseAt(tokens, i, AGAINST_PHRASES)) return true;
    if (!leadWord(tokens[i])) continue;
    if (anyPhraseAt(tokens, i + 1, companions)) return true;
    if (tokens[i + 1] === 'عن' && anyPhraseAt(tokens, i + 2, companions)) return true;
  }
  return false;
}

/**
 * The clauses of a row's text in which its author speaks for `school` in his own voice: each sentence (cut at . ! ? ؟ ؛ *)
 * is cut again before every lead of a report, every «(وأما)», every partitive and every clause of the author's personal
 * view. A clause led by a report of another («وقال الشافعي», «وعند مالك»), by a partitive («ومن أصحابنا من», «بعض
 * أصحابنا»), by the author's personal view («ولا أرى», «عندي», «وأختار»), or one that says «عندهم», is not his school's; of
 * the rest, one that says «عندنا», «أصحابنا», «مذهبنا», «في المذهب» or the school's collective name (NAMES_ALONE), or is led
 * by «قال أصحابنا» / «عند أصحابنا», or by «قال» / «عند» / «مذهب» + its own imam where the row does not set his companions
 * against him, is the author's own. «قال المصنف» / «قول المصنف» lead nothing of their own (SPEED W6B B0). Line breaks do not
 * cut (a library atom breaks lines where the page has spaces). Returns folded token arrays.
 */
export function ownVoiceClauses(text, school) {
  const own = NAMES[school];
  if (!own) return [];
  const marked = markPersonal(text);
  const imamStands = !againstImam(fold(marked).split(' ').filter(Boolean), school);
  const out = [];
  for (const sentence of marked.split(/[.!?؟؛*]+/u)) {
    const tokens = fold(sentence).split(' ').filter(Boolean);
    let clause = [];
    let kind = 'plain';
    const close = () => {
      if (clause.length && kind !== 'report' && kind !== 'personal' && !clause.some((t) => OTHERS_WORDS.has(t))
        && (kind === 'own' || hasPhrase(clause, OWN_VOICE) || hasPhrase(clause, NAMES_ALONE[school]))) out.push(clause);
      clause = [];
    };
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (BREAKS.has(t)) { close(); kind = 'plain'; continue; }
      if (anyPhraseAt(tokens, i, PERSONAL)) { close(); kind = 'personal'; }
      else if (anyPhraseAt(tokens, i, PARTITIVE)) { close(); kind = 'report'; }
      else {
        const lead = leadWord(t);
        if (lead && anyPhraseAt(tokens, i + 1, AUTHOR)) { close(); kind = 'plain'; }
        else if (lead) {
          const school_ = anyPhraseAt(tokens, i + 1, OWN_SUBJECT);
          const imam = anyPhraseAt(tokens, i + 1, own);
          if (SPEECH_LEADS.has(lead) || school_ || imam || anyPhraseAt(tokens, i + 1, OTHER_NAMES)
            || Object.entries(NAMES).some(([k, list]) => k !== school && anyPhraseAt(tokens, i + 1, list))) {
            close();
            kind = school_ || (imam && IMAM_LEADS.has(lead) && imamStands) ? 'own' : 'report';
          }
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
