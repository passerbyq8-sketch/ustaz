// lib/completion-ledger.js -- ITEM 35-D2 R5 (brain35-2 F2, 2026-11-07): THE COMPLETION LEDGER AND THE MADHHAB READERS, AS A LEAF.
//
// Moved out of lib/before-writing-v2.js byte for byte (the block that opened on MADHHAB_ASK_RE and closed on completionLedger:
// ITEM Z3's school readers, ITEM A-2's ledger). WHY A FILE OF ITS OWN: the ledger had one call site, the before-writing path's;
// DIAG2 R5 measured a legacy-path answer (P11) ending with no collector named and no sentence saying so. lib/free-brain/loop.js
// now runs the ledger too, and it cannot import lib/before-writing-v2.js: that module imports loop.js, and when
// lib/bw2-units.js is the first module entered, before-writing-v2.js evaluates while bw2-units.js is still in progress and
// reads one of its bindings at the top level (BW2_WRITE_RULES) -- measured, every entry order. This file reads its imports at
// call time only, so whichever module is entered first, it evaluates clean.
//
// Pure: no state, no I/O, no network. The sentences are the order's (EZIK-ORDER-BRAIN35-FIX-2026-11-06.md A-2), byte for byte.
import { normalizeArabic } from './route-classify.js';
import { MADHHAB_BOOKS_PRIMARY } from './madhhab-books.js';
import { askedHadithOf, asksHadithSource, schoolsNamed, collectionsNamed, narratorsNamed } from './bw2-units.js';

const MADHHAB_ASK_RE = /(?:^|\s)(?:[وفلب]?(?:ال)?مذاهب|(?:ال)?ايمه\s+(?:ال)?اربعه|حسب\s+(?:ال)?مذهب|كل\s+مذهب|عند\s+(?:ال)?فقهاء\s+(?:ال)?اربعه)(?:\s|$)/u;
const MADHHAB_NAME_RE = /(?:^|\s)[وفلب]?(?:ال)?(?:حنفيه|احناف|مالكيه|شافعيه|حنابله)(?=\s|$)/gu;
// ITEM Z3 (125 b) -- 2026-10-15 brain-line: ONE SCHOOL NAMED OPENS THE GATE TOO, AND ITS BOOK IS ASKED. MEASURED (side/t130.md, the 125
// table): «ما حكم مس الذكر عند الحنابلة؟» and «… في المذهب الحنبلي؟» were not madhhab questions, so no Hanbali book was
// asked. The schools a question asks: all four for «حسب المذاهب», «الأئمة الأربعة», «كل مذهب» or two schools named (as
// before); the one school for one named -- its plural (الحنابلة), its adjective (المذهب الحنبلي), Abu Hanifa, or Malik,
// al-Shafi'i, Ahmad in an attribution (عند / قول / مذهب / رأي …).
const MADHHAB_ONE_RE = Object.freeze({
  hanafi: /(?:^|\s)[وفلب]?(?:ال)?(?:حنفيه|احناف|حنفي)(?=\s|$)|(?:^|\s)اب[ويا]\s+حنيفه(?=\s|$)/u,
  maliki: /(?:^|\s)[وفلب]?(?:ال)?(?:مالكيه|مالكي)(?=\s|$)|(?:^|\s)[وف]?(?:عند|قول|مذهب|راي|قال)\s+(?:الامام\s+)?مالك(?=\s|$)/u,
  shafii: /(?:^|\s)[وفلب]?(?:ال)?(?:شافعيه|شافعي)(?=\s|$)/u,
  hanbali: /(?:^|\s)[وفلب]?(?:ال)?(?:حنابله|حنبلي)(?=\s|$)|(?:^|\s)[وف]?(?:عند|قول|مذهب|راي|قال)\s+(?:الامام\s+)?احمد(?=\s|$)/u,
});
export function madhhabsAsked(question) {
  const norm = ' ' + normalizeArabic(String(question || '')) + ' ';
  const all = MADHHAB_BOOKS_PRIMARY.map((m) => m.key);
  if (MADHHAB_ASK_RE.test(norm) || (norm.match(MADHHAB_NAME_RE) || []).length >= 2) return all;
  const named = all.filter((key) => MADHHAB_ONE_RE[key].test(norm));
  return named.length >= 2 ? all : named;
}
/** Does the reader ask about the madhhabs — «حسب المذاهب», «الأئمة الأربعة», two madhhabs named, or one (ITEM Z3)? */
export function isMadhhabQuestion(question) {
  return madhhabsAsked(question).length > 0;
}

// ── ITEM A-2 (brain35, 2026-11-06; DIAG 35.3 / 35.11): THE COMPLETION LEDGER ──────────────────────────────────────────
// What the question asked is checked AFTER release. The rules reached the writer as prose (madhhabRuleFor, rule 9) and nothing
// verified them: five four-school answers named one to three schools and no absence sentence appeared (Q04, Q07, Q08, Q09, Q25);
// three collector questions went unanswered or cut (Q31, Q32, Q33). The owner's targets (contract section 5): name the missing
// school and say it was not found in this search; distinguish narrator, collector and grader and say when the wording's collector
// cannot be confirmed. The sentences are the order's, byte for byte. A school written under its imam's name counts as named
// (schoolsNamed's canonical forms). A collector named by the library head, the direct block or a released unit counts as answered.
const LEDGER_SCHOOL_TEMPLATE = "لم أقفْ في هذا البحثِ على نصٍّ لمذهبِ <label> في هذه المسألة.";
export const LEDGER_COLLECTOR_SENTENCE = "وأما من خرّجه: فلم تُثبت المكتبة لهذا اللفظ مخرِّجًا في الكتب التي بُحث فيها.";
export const LEDGER_NARRATOR_SENTENCE = "وأما راويه: فلم أقف على اسم الصحابي لهذا اللفظ فيما بُحث فيه.";
export const LEDGER_GRADER_SENTENCE = "وأما الحكم عليه فلم أقف على من حكم عليه بعينه.";
export const ledgerSchoolSentence = (label) => LEDGER_SCHOOL_TEMPLATE.replace('<label>', String(label || ''));
// an absence sentence already covering the school, in the server's or the writer's wording
const carriesSchoolAbsence = (text, label) => new RegExp('لم\\s+أقف[^.؟!\\n]{0,80}' + label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).test(String(text || '').replace(ARABIC_MARKS_RE, ''));
const ARABIC_MARKS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
// the narrator asked by name: «من راويه», «ومن الصحابي الذي رواه», «من الراوي» (a collector question, «من رواه / من خرّجه», is asksHadithSource)
const NARRATOR_ASKED_RE = /(?:^|\s)[وف]?(?:من\s+)?(?:راويه|راوي|الراوي|الصحابي|صحابيه)(?=\s|$|[؟?،])/u;
export function asksNarratorName(question) { return NARRATOR_ASKED_RE.test(normalizeArabic(String(question || ''))); }
// the collector is asked by a collector word (خرّجه / أخرجه / في أي كتاب / مصدره / رواه) -- «من راويه» alone asks the narrator
const COLLECTOR_WORD_RE = /(?:^|\s)[وف]?(?:من\s+)?(?:خرجه|اخرجه|خرج|اخرج|رواه|مصدره|مصدر|كتاب|كتب|الكتب|المصدر)(?=\s|$|[؟?،])/u;
export function asksCollectorName(question) {
  if (!asksHadithSource(question)) return false;
  return !asksNarratorName(question) || COLLECTOR_WORD_RE.test(normalizeArabic(String(question || '')));
}
// the grade is asked by a grade word outside the matn («ما صحة», «ما درجة», «هل يصح», «هل ثابت», «ما حكم حديث»); «من روى» alone asks the source
const GRADE_WORD_RE = /(?:^|\s)[وف]?(?:ما\s+)?(?:صحه|صحيح|درجه|ضعيف|ضعف|موضوع|يصح|تصح|ثابت|يثبت|حكم|الحكم|صحته|درجته)(?=\s|$|[؟?،:])/u;
export function asksGradeWord(question) {
  const q = String(question || '');
  const matn = askedHadithOf(q);
  if (!matn) return false;
  return GRADE_WORD_RE.test(normalizeArabic(q.replace(matn, ' ')));
}
// a grader named: «ضعفه X», «صححه X», «قال X: صحيح», a takhrij bracket «(X · صحيح)», the head's «والحكم عليه في X: Y», a mufti over a graded block
// ITEM 35-D2 R3 (brain35-2 F5, 2026-11-07): the grade vocabulary, one alternation read in every place a grade is read here
// (the longer forms first): موضوع · لا أصل له · باطل · منكر · ضعيف جدا · ضعيف · حسن (لغيره) · صحيح (لغيره) · لا يصح · لا يثبت ·
// ليس بصحيح · ليس صحيحا.
const GRADE_VOCAB = '(?:موضوع|لا\\s+أصل\\s+له|باطل|منكر|ضعيف\\s+جدا|ضعيف|حسن(?:\\s+لغيره)?|صحيح(?:\\s+لغيره)?|لا\\s+يصح|لا\\s+يثبت|ليس\\s+بصحيح|ليس\\s+صحيحا)';
const GRADER_NAMED_RE = new RegExp('(?:ضعفه|صححه|حسنه|قواه|وضعه|أنكره|استنكره|جزم\\s+بضعفه|حكم\\s+عليه|حكم\\s+بصحته|حكم\\s+بضعفه)\\s+\\S+'
  + '|(?:قال|وقال|ذكر|وذكر)\\s+\\S+(?:\\s+\\S+){0,4}?\\s*:\\s*(?:هذا\\s+)?(?:حديث\\s+|إسناده\\s+|إسناد\\s+)?' + GRADE_VOCAB
  + '|\\([^()]{1,60}·\\s*(?:' + GRADE_VOCAB + '|لا\\s+يوقف)'
  + '|الحكم\\s+عليه\\s+في\\s+\\S+'
  + '|(?:عند|قول|رأي)\\s+\\S+(?:\\s+\\S+)?\\s*:?\\s*' + GRADE_VOCAB
  + '|(?:الألباني|الترمذي|الحاكم|ابن حجر|الذهبي|النووي|ابن حبان|الدارقطني|البيهقي|العراقي|الهيثمي|السخاوي|ابن الجوزي|ابن القيم|ابن تيمية|ابن باز|ابن عثيمين)\\s*:?\\s*' + GRADE_VOCAB, 'u');
// ITEM 35-D2 R3 (brain35-2 F5): the grader's verb with his name after it, and the «جزم / حكم / قال X بـ…» frame (A-5's
// verbGradeIn shapes, read here on the reader's side): «جزم الألباني بضعفه», «حكم عليه الألباني بالوضع», «قال الذهبي بوضعه».
const VERB_GRADE_NAMED_RE = /(?:^|\s)[وف]?(?:ضعف|صحح|حسن|وضع|قوا|أنكر|استنكر)(?:ه|ها|هما|وه|وها)\s+\S+|(?:^|\s)[وف]?(?:جزم|حكم|قال)\s+(?:\S+\s+){1,3}?ب(?:ضعف|صح|وضع|حسن|الضعف|الصح|الوضع|الحسن)\S*/u;
function verbGradeNamed(bare) {
  return VERB_GRADE_NAMED_RE.test(bare);
}
// ITEM 35-D2 R3 (brain35-2 F5): a grade the answer states in its own voice at its head. MEASURED (DIAG2 R3, P10): the writer's
// first unit «ليس صحيحا بل موضوع.» names no grader, and the ledger wrote «وأما الحكم عليه فلم أقف على من حكم عليه بعينه» under
// it. The first non-heading line (not «#», not a tag), within 80 characters before the grade word, counts as answered; the
// collector sentence is not touched by this.
// ITEM 35-D3 D2 (brain35-3 X2): a grade word closing a lead line («الحديث ضعيف:») is the head's own verdict (the order's row X2d)
const HEAD_VERDICT_RE = new RegExp('^[^.\\n؟!]{0,80}?' + GRADE_VOCAB + '(?=\\s|[.،؛:：]|$)', 'u');
export function gradeStatedAtHead(text) {
  // ITEM 35-D3 D2 (brain35-3 X2): a lead line (ends on «:» and carries no grade word -- the disagreement frame, «الجواب:») is not
  // the head; the line after it is.
  const lines = String(text || '').replace(ARABIC_MARKS_RE, '').split(/\n+/u).map((l) => l.trim()).filter((l) => l && !/^[#<]/u.test(l));
  const isLead = (l) => /[:：]$/u.test(l) && !new RegExp(GRADE_VOCAB, 'u').test(l);
  const first = lines.find((l) => !isLead(l)) || '';
  return HEAD_VERDICT_RE.test(first);
}
const LEDGER_IMAM_FORMS = Object.freeze({
  hanafi: /\sاب[ويا]\s+حنيفه\s|\s(?:ال)?حنفي(?:ون|ين)\s/u,
  maliki: /\s(?:الامام|عند|قول|مذهب|ذهب|راي|قال|وقال|عن)\s+(?:الامام\s+)?مالك\s|\s(?:ال)?مالكي(?:ون|ين)\s/u,
  shafii: /\s(?:الامام|عند|قول|مذهب|ذهب|راي|قال|وقال|عن)\s+(?:الامام\s+)?الشافعي\s|\s(?:ال)?شافعي(?:ون|ين)\s/u,
  hanbali: /\s(?:الامام|عند|قول|مذهب|ذهب|راي|قال|وقال|عن)\s+(?:الامام\s+)?احمد\s/u,
});
const MUFTI_GRADE_RE = new RegExp(GRADE_VOCAB, 'u'); // ITEM 35-D2 R3 (brain35-2 F5): the fifth place the vocabulary is read
export function graderNamed(text) {
  const bare = String(text || '').replace(ARABIC_MARKS_RE, '');
  if (GRADER_NAMED_RE.test(bare) || verbGradeNamed(bare)) return true; // ITEM 35-D2 R3 (brain35-2 F5): the verb shapes too
  // a shown fatwa whose answer grades the hadith: its mufti is the grader
  return /المفتي:\s*\S/u.test(bare) && MUFTI_GRADE_RE.test(bare);
}
// ITEM 35-D3 D3 (b) (brain35-3 X4; owner: choice 1, withhold): a released text that STATES a grade dispute («اختلفوا في درجته»,
// «اختلف … في حكمه», «خلاف … في صحته») has told the reader the grade is disputed; a shown hadith card whose ruling attribute
// carries a grade has told the reader the source's grade. In both the grader sentence is withheld, never reworded.
const GRADE_DISPUTE_RE = /(?:اختلف(?:وا|ت)?|خلاف)\s+(?:\S+\s+){0,6}?(?:في|حول)\s+(?:درجته|حكمه|صحته|تصحيحه|تضعيفه|درجة\s+(?:هذا\s+)?الحديث|حكم\s+(?:هذا\s+)?الحديث)/u;
const CARD_GRADE_RE = /<hadith\b[^>]*\sruling="\s*(?:صحيح|حسن|ضعيف|موضوع|جيد|لا يصح|لا يثبت)[^"]*"/u;
export function gradeDisputeStated(text) {
  return GRADE_DISPUTE_RE.test(String(text || '').replace(ARABIC_MARKS_RE, ''));
}
export function cardCarriesGrade(text) {
  return CARD_GRADE_RE.test(String(text || ''));
}
/**
 * The sentences the server appends after release for what the question asked and the answer did not carry: one per asked
 * school no released unit names (and no absence sentence covers), and one per asked role (collector / narrator / grader)
 * that neither a released unit, the direct block, the lead line nor the library head answered. Pure; the caller appends.
 */
export function completionLedger({ question = '', released = '', aboveText = '', leadLine = '' } = {}) {
  const out = [];
  const sent = String(released || '');
  const everywhere = [sent, String(aboveText || ''), String(leadLine || '')].filter(Boolean).join('\n');
  const named = schoolsNamed(sent);
  // a school written under its imam's name or its sound plural counts as named (the holder's canonical forms know the
  // plural-in-ta and the imam in an attribution; these are the remaining forms the order lists, read here only)
  const folded = ' ' + normalizeArabic(sent) + ' ';
  for (const [key, re] of Object.entries(LEDGER_IMAM_FORMS)) if (re.test(folded)) named.add(key);
  for (const key of madhhabsAsked(question)) {
    const school = MADHHAB_BOOKS_PRIMARY.find((m) => m.key === key);
    if (!school || named.has(key) || carriesSchoolAbsence(sent, school.label)) continue;
    out.push(ledgerSchoolSentence(school.label));
  }
  if (askedHadithOf(question)) {
    // ITEM 35-D3 D3 (a) (brain35-3 X3): the hadith card prints its matn and its ruling, never its narrator attribute (app.jsx
    // HadithCard), so a collector written there is not named to the reader; the ledger reads the visible text.
    const visible = everywhere.replace(/<hadith\b[^>]*>/gu, '<hadith>');
    const collections = [...collectionsNamed(visible), ...collectionsNamed(String(leadLine || ''), true)];
    if (asksCollectorName(question) && !collections.length && !sent.includes(LEDGER_COLLECTOR_SENTENCE)) out.push(LEDGER_COLLECTOR_SENTENCE);
    if (asksNarratorName(question) && !narratorsNamed(everywhere).length && !sent.includes(LEDGER_NARRATOR_SENTENCE)) out.push(LEDGER_NARRATOR_SENTENCE);
    // a hadith the two Sahihs carry needs no grader (the takhrij contract's own rule: the Shaykhayn are the grade)
    const sahihayn = collections.some((key) => key === normalizeArabic('البخاري') || key === normalizeArabic('مسلم'));
    // and a library head already speaks for the grade (it names the grading book or says the library proved none; A-4 reconciles it)
    // ITEM 35-D2 R3 (brain35-2 F5): and a grade the answer states at its own head counts as answered (gradeStatedAtHead)
    const gradeTold = graderNamed(everywhere) || gradeStatedAtHead(sent) || gradeDisputeStated(sent) || cardCarriesGrade(sent); // ITEM 35-D3 D3 (b) (brain35-3 X4)
    if (asksGradeWord(question) && !String(leadLine || '').trim() && !sahihayn && !gradeTold && !sent.includes(LEDGER_GRADER_SENTENCE)) out.push(LEDGER_GRADER_SENTENCE);
  }
  return out;
}

