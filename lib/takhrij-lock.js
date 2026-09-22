// lib/takhrij-lock.js
// A TAKHRIJ NOBODY PUBLISHED IS NEVER EMITTED. Deterministic, pure, and it costs nothing.
//
// ── THE MEASURED FAILURE ─────────────────────────────────────────────────────
// Inside an ordinary fiqh answer about travelling alone, the app produced:
//     «نهى النبي ﷺ عن السفر وحده، وقال: الراكب شيطان والراكبان شيطانان والثلاثة ركب»
//     — رواه البخاري ومسلم / متفق عليه
// The matn is a real narration. The attribution is false — it is not in the Ṣaḥīḥayn — and it did
// not come from any page that was fetched. It came from the model's memory, and it arrived
// wearing the two names that end an argument in this subject.
//
// ── WHY NOTHING CAUGHT IT ────────────────────────────────────────────────────
// lib/policy/consistency-gate.js checks scholars' names and ruling verbs. Gate 2 and Gate 3 check
// entailment between a claim and its evidence — and «رواه البخاري ومسلم» entails perfectly well
// from a claim that also says it. Nothing anywhere asked the one question a takhrij turns on: is
// this attribution ON THE PAGE? So a grading and a collector attached from memory travelled
// through every gate the app has.
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
// Any ATTRIBUTION («رواه فلان»، «أخرجه فلان»، «متفق عليه»، «في الصحيحين») or GRADE («صححه فلان»،
// «حسّنه فلان»، «ضعّفه فلان») must be present in the extracted text of a page that was actually
// fetched. When it is not, THE WHOLE SENTENCE CARRYING IT IS DROPPED.
// Nothing is repaired, nothing is re-attributed, and no correct attribution is ever supplied from
// this module's own knowledge.
//
// And when that dropped sentence was a BLOCK some earlier line existed only to introduce, the
// introducing line goes with it — see `orphanedLeadInCuts`. Leaving it behind hands the reader a
// promise with nothing after it, which is the orphaned-lead-in defect of 974f6624 one phase later.
//
// ── X-013/ز: WHY THE SENTENCE, AND NOT JUST THE CREDIT ───────────────────────
// This module used to strip the attribution and let the matn stand, on the reasoning that "the
// narration is not the lie, the credit is". That reasoning does not survive contact with what the
// reader is left holding. Cut «رواه البخاري ومسلم» out of «والحديث صحيح رواه البخاري ومسلم» and
// the sentence does not become weaker — it becomes «والحديث صحيح», a grading now asserted in this
// answer's own voice, with the single attribution a reader could have gone and checked quietly
// deleted. That is a STRONGER and falser claim than the one that failed the check.
//
// So the sentence goes whole, and what remains is REBUILT from the sentences that survived; if
// nothing survives, the lock REFUSES explicitly. Either way it returns a `degraded` record, so no
// caller can ship a shortened answer without knowing it was shortened. hybrid-deen's §7 majority
// gate already reasons exactly this way about جمهور/ترجيح claims; this is that rule generalised.
//
// ── THE ONE EXEMPTION, SCOPED TO EXACTLY WHAT IT COVERS ──────────────────────
// The frozen texts — the worship cards, the adhkār and the āyāt — carry attributions pinned in
// their golden files and asserted by their own guards. They do not enter this check.
//
// It is applied to the FROZEN RUN, not to the whole sentence, and that scoping is deliberate.
// Exempting an entire sentence because it happens to quote an āyah would hand any unsourced
// takhrij a way through: quote a verse beside it and the check never runs. So a span is skipped
// only when it OVERLAPS the frozen text itself, which is what "the frozen text is not touched"
// actually means.

import { normalizeArabic } from './route-classify.js';
import { containsFrozenRun, MIN_WORDS as MIN_FROZEN_WORDS } from './frozen-text.js';
import { colonPreambles } from './colon-preamble.js';

const norm = (s) => normalizeArabic(String(s == null ? '' : s));

// ── Tokens, with their offsets in the ORIGINAL string ────────────────────────
// Matching happens on folded forms so that «صحَّحه» and «صححه» are one word; splicing happens on
// the original offsets so that the reply keeps its tashkīl. Doing either one alone is how a check
// like this either misses vocalised text or returns it stripped.
const WORD_RE = /[ء-ْٰٱـ]+/g;

function tokenize(text) {
  const toks = [];
  let m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    toks.push({ raw: m[0], bare: norm(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

// ── What a takhrij looks like ────────────────────────────────────────────────
// Folded forms, because that is what tokenize() produces.
const ATTRIB_VERBS = new Set(['رواه', 'رواها', 'رواهما', 'اخرجه', 'اخرجها', 'اخرجهما', 'خرجه', 'خرجهما', 'رواه', 'اورده']);
const GRADE_VERBS = new Set(['صححه', 'صححها', 'حسنه', 'حسنها', 'ضعفه', 'ضعفها', 'صححهما', 'جوده', 'وثقه']);
const SAHIH_BOOKS = new Set(['البخاري', 'مسلم', 'الترمذي', 'النساىي', 'ابوداود', 'داود', 'ابن ماجه', 'ماجه', 'احمد']);
// How many words after «رواه» may belong to the attribution. Three covers «البخاري ومسلم» and
// «ابن حبان في صحيحه»; more would start swallowing the sentence that follows.
const MAX_NAME_WORDS = 3;

// ── THIRD ORDER, STEP 2 · «روى» IS AN ATTRIBUTION TOO ─────────────────────────
//
// MEASURED at 030da4b: «ويحرم كذا، لما روى البخاري أن النبي ﷺ…» passed this lock with no page
// behind it, because the verb set above holds «رواه» and not «روى». The lock never saw the credit.
//
// «روى» FOLDS TO «روي», AND SO DOES THE PASSIVE «رُوي». «ورُوي عن ابن عمر» is 19 of the 26 folded
// «روي» in the tree and the corpus, and it names no collection — it is a different door, out of
// this order. «روى أبو هريرة» names a Companion, not a book. So the active verbs below open a span
// ONLY when the next word is a collector's name, and the span is the verb and the name alone.
// Measured over the forty real answers, their raw rounds and the 108 drafts: the real prose carries
// no «روى/أخرج + collector» at all; the drafts carry «روى البخاري» ×2 and «روى مسلم» ×2.
const ALSO_WORDS = new Set(['ايضا', 'أيضا', 'أيضًا'].map((w) => norm(w)));
const NARRATION_VERBS = new Set(['روي', 'روت', 'اخرج', 'خرج'].map((w) => norm(w)));
const COLLECTORS_ONE = new Set(['البخاري', 'مسلم', 'الترمذي', 'النسائي', 'احمد', 'مالك', 'الحاكم',
  'الطبراني', 'البيهقي', 'الدارقطني', 'الدارمي', 'الشيخان', 'الجماعة', 'الخمسة', 'الاربعة']
  .map((w) => norm(w)));
const COLLECTORS_TWO = [['ابو', 'داود'], ['ابن', 'ماجه'], ['ابن', 'حبان'], ['ابن', 'خزيمة'],
  ['ابن', 'ابي'], ['عبد', 'الرزاق'], ['الامام', 'احمد'], ['الامام', 'مسلم'], ['الامام', 'البخاري'],
  ['الامام', 'مالك'], ['اصحاب', 'السنن']].map((pair) => pair.map((w) => norm(w)));
/** How many tokens after `i` name a collector (0 when the next word is not one). */
function collectorAfter(toks, i) {
  const a = toks[i + 1] && toks[i + 1].bare;
  const b = toks[i + 2] && toks[i + 2].bare;
  if (a && COLLECTORS_ONE.has(a)) return 1;
  if (a && b && COLLECTORS_TWO.some(([x, y]) => x === a && y === b)) return 2;
  return 0;
}

/**
 * Every takhrij span in `text`, as {start, end, kind, phrase}.
 * `phrase` is the folded form — that is what gets looked for on the page.
 */
export function takhrijSpans(text) {
  const s = String(text == null ? '' : text);
  const toks = tokenize(s);
  const spans = [];

  const contiguous = (i, j) => {
    // Only whitespace may sit between the words of one attribution. A comma or a full stop ends
    // it, which is what stops «رواه البخاري، وهذا حديث عظيم» from swallowing the second clause.
    for (let k = i; k < j; k++) {
      if (/[^\s]/.test(s.slice(toks[k].end, toks[k + 1].start))) return false;
    }
    return true;
  };
  const push = (i, j, kind) => {
    const words = [];
    for (let k = i; k <= j; k++) words.push(toks[k].bare);
    spans.push({ start: toks[i].start, end: toks[j].end, kind, phrase: words.join(' ') });
  };

  for (let i = 0; i < toks.length; i++) {
    const b = toks[i].bare;

    // «متفق عليه»
    if (b === 'متفق' && toks[i + 1] && toks[i + 1].bare === 'عليه' && contiguous(i, i + 1)) {
      push(i, i + 1, 'attribution'); i += 1; continue;
    }
    // «في الصحيحين» / «الصحيحين»
    if (b === 'الصحيحين') {
      const from = (i > 0 && toks[i - 1].bare === 'في' && contiguous(i - 1, i)) ? i - 1 : i;
      push(from, i, 'attribution'); continue;
    }
    // «صحيح البخاري» / «صحيح مسلم» — the BOOK named as the source, not the grade word alone.
    if (b === 'صحيح' && toks[i + 1] && SAHIH_BOOKS.has(toks[i + 1].bare) && contiguous(i, i + 1)) {
      push(i, i + 1, 'attribution'); i += 1; continue;
    }
    // «رواه فلان» / «أخرجه فلان» and «صححه فلان» / «حسّنه فلان» / «ضعّفه فلان»
    // THIRD ORDER, STEP 2 — AND WITH THE «و» OR «ف» ARABIC WRITES JOINED TO THE VERB. MEASURED at
    // 030da4b: «ورواه أيضا أبو داود والترمذي والنسائي.» and «وأخرجه البخاري في صحيحه.» opened no
    // span at all — the token is «ورواه», not «رواه» — and shipped with no page behind them; the
    // first is the owner's own preview witness («الدين النصيحة»). The span starts after the
    // letter, so the conjunction stays with the sentence and only the credit is read.
    // ATTRIBUTION VERBS ONLY: a joined grade verb («وصححه بالشواهد») names nobody, and reading it as a
    // span would make dropUnsourcedGrades take it for the source standing beside a grade (AA-88).
    // ── BATCH 4 [b12] · AND A JOINED GRADE VERB THAT NAMES A GRADER IS A SPAN LIKE THE DIRECT ONE ──
    // MEASURED at 2aaf987 and 92d3c7d (EZIK-CX-M111 row 12): «فحسّنَه النوويُّ، وصحّحَه ابنُ حبّانَ
    // والألبانيُّ.» reached the reader with no page behind it, while «صحّحه ابن حبان.» was dropped.
    // The owner's ruling: the joined «وصحّحه/فحسّنه/وضعّفه» passes only by what passes the direct verb.
    // AA-88's case stays out: a joined grade verb followed by a preposition — «وصححه بالشواهد»،
    // «وحسّنه لغيره» — names nobody and is still no span.
    const namesAGrader = toks[i + 1] && contiguous(i, i + 1) && !/^[بلك]/u.test(toks[i + 1].bare);
    const joined = /^[وف]./u.test(b) && (ATTRIB_VERBS.has(b.slice(1)) || (GRADE_VERBS.has(b.slice(1)) && namesAGrader));
    const v = joined ? b.slice(1) : b;
    const isAttrib = ATTRIB_VERBS.has(v);
    const isGrade = GRADE_VERBS.has(v);
    if (isAttrib || isGrade) {
      let j = i;
      // [b12] — and a name ends where the next credit verb begins: «صحّحه ابن خزيمة وحسّنه الترمذي»
      // is two spans, each a phrase a page may carry, not one that swallows «وحسّنه».
      const verbAt = (k) => { const w = toks[k].bare; const u = /^[وف]./u.test(w) ? w.slice(1) : w; return ATTRIB_VERBS.has(u) || GRADE_VERBS.has(u); };
      while (j + 1 < toks.length && j - i < MAX_NAME_WORDS && contiguous(j, j + 1) && !verbAt(j + 1)) j++;
      if (j > i) {
        // THIRD ORDER, STEP 4-ج — «ورواه أيضا أبو داود» names أبو داود; «أيضا» points back at the
        // credit before it and is no part of the phrase a page has to carry, so it is read past.
        const also = toks[i + 1] && ALSO_WORDS.has(toks[i + 1].bare) && contiguous(i, i + 1);
        if (also) {
          j = i + 1;
          while (j + 1 < toks.length && j - i < MAX_NAME_WORDS + 1 && contiguous(j, j + 1)) j++;
          const words = [v];
          for (let k = i + 2; k <= j; k++) words.push(toks[k].bare);
          spans.push({ start: toks[i].start + (joined ? 1 : 0), end: toks[j].end, kind: isAttrib ? 'attribution' : 'grade', phrase: words.join(' ') });
        } else if (joined) {
          const words = [v];
          for (let k = i + 1; k <= j; k++) words.push(toks[k].bare);
          spans.push({ start: toks[i].start + 1, end: toks[j].end, kind: isAttrib ? 'attribution' : 'grade', phrase: words.join(' ') });
        } else push(i, j, isAttrib ? 'attribution' : 'grade');
        i = j;
      }
      continue;
    }
    // «روى البخاري» / «وأخرج مسلم» — the verb and the collector, nothing past the name.
    const verb = /^[وف]./u.test(b) && NARRATION_VERBS.has(b.slice(1)) ? b.slice(1) : b;
    if (NARRATION_VERBS.has(verb)) {
      const k = collectorAfter(toks, i);
      if (k && contiguous(i, i + k)) {
        const from = toks[i].start + (verb === b ? 0 : 1);
        const words = [verb];
        for (let q = i + 1; q <= i + k; q++) words.push(toks[q].bare);
        spans.push({ start: from, end: toks[i + k].end, kind: 'attribution', phrase: words.join(' ') });
        i += k;
      }
      continue;
    }
  }
  return spans;
}

// ── AA-83 · A GRADE STANDS ONLY WHERE A SOURCE STANDS WITH IT ───────────────
//
// MEASURED IN PRODUCTION, reported by the owner: the word for «authentic» printed under
// prophetic texts with no narrator and no source — three times in one answer about the merit of
// congregational prayer, and once under a text well known to be weak. And it FLUCTUATES: it
// appears in one mode and vanishes in another for the same question.
//
// THE FLUCTUATION IS NOT A MYSTERY, AND IT REPRODUCES FROM CODE. A grade written as the
// STRUCTURED field — `<hadith ruling="صحيح">` — is emptied on exactly one route, the anchored
// one, by `honestTakhrijInDraft` (lib/anchor/units.js:181, called at api/ask.js:3857). Every
// other exit reaches lib/finalize-reader-text.js instead, and nothing there looked at the field
// at all. Same question, two routes, two answers — which is the fluctuation, exactly.
//
// AND A GRADE WRITTEN AS PROSE WAS INVISIBLE EVERYWHERE. `takhrijSpans` above reads an
// attribution («رواه فلان») and a grade ATTRIBUTED TO A MAN («صححه فلان»). A BARE grade —
// «وهو حديثٌ صحيحٌ»، «إسنادُه صحيحٌ»، «صحيحُ الإسناد» — names nobody, so it opens no span, and
// the lock never saw it. That is the shape the owner received.
//
// THE RULE, AND ITS TWO HALVES ARE EQUALLY BINDING.
//   A grade may stand when a source stands with it. A grade with no source attached does not
//   reach the reader: THE GRADE GOES, THE TEXT STAYS.
// The prophetic text is NEVER removed. Deleting a hadith in order to delete its grade would be
// a far worse defect than the one being repaired, and it is why this rule cuts a WORD where the
// lock above cuts a SENTENCE: the lock removes a claim that is false, this removes a claim that
// is unsupported while leaving the narration the reader was entitled to.
//
// WHAT COUNTS AS A GRADE IS DELIBERATELY NARROW. «صحيح» is an ordinary Arabic word meaning
// «correct», and «هذا كلامٌ صحيحٌ» is not a grading. A word in GRADE_WORDS counts only when it
// is ADJACENT — nothing but whitespace between — to a word naming the thing graded: a matn noun
// («حديث»، «رواية»، «أثر») before it, or a chain noun («إسناده»، «السند») on either side. And
// «صحيح البخاري» is a BOOK, not a grade: the same exclusion `takhrijSpans` already makes.
//
// AND THE SOURCE IS LOOKED FOR IN THE BLOCK, NOT IN THE SENTENCE. «قال النبيُّ ﷺ: «…» رواه
// البخاريُّ. وهو حديثٌ صحيحٌ.» puts the grade in its own sentence and the collection in the one
// before it, and the source does stand with it there. Scoping to the sentence would cut that,
// which is the false positive this phase names as the whole risk. The block is the line, the
// same unit lib/colon-preamble.js reads, and the card a line introduces counts as its source.
const GRADE_WORDS = new Set([
  'صحيح', 'الصحيح', 'صحيحه', 'صحيحا', 'صحاح',
  'حسن', 'الحسن', 'حسنه', 'حسان',
  'ضعيف', 'الضعيف', 'ضعيفه', 'ضعاف',
  'موضوع', 'الموضوع', 'موضوعه',
  'منكر', 'المنكر', 'شاذ', 'الشاذ', 'متواتر', 'المتواتر', 'ثابت', 'الثابت',
]);
/** The thing a grade is a grade OF, when the text is what is graded. The noun survives. */
const MATN_NOUNS = new Set(['حديث', 'الحديث', 'حديثا', 'حديثان', 'احاديث', 'الاحاديث',
  'روايه', 'الروايه', 'اثر', 'الاثر', 'خبر', 'الخبر']);
/** ...and when the CHAIN is what is graded. «إسنادُه» alone is not a sentence, so both go. */
const CHAIN_NOUNS = new Set(['اسناده', 'اسنادها', 'اسنادهما', 'اسناد', 'الاسناد',
  'سنده', 'سندها', 'سند', 'السند']);
// «وحديثٌ صحيحٌ» and «وإسنادُه صحيحٌ» are the same two shapes with the conjunction attached: the
// tokenizer takes whole words, so «وحديث» is not «حديث» and the adjacency test missed them. The
// leading و/ف is stripped for the NOUN test only. It is not stripped for the grade word, where
// it would buy nothing and widen a list that is deliberately narrow.
const withoutConjunction = (bare) => (/^[وف]./u.test(bare) ? bare.slice(1) : bare);

// ── ١١١ STEP 5 · A VERDICT OF FABRICATION IS A WARNING, NOT A GRADING ─────────
//
// THE OWNER'S RULING (decision 1, face «أ»): the sentence that judges a hadith fabricated stays
// with its matn exactly as the model wrote it. It is a warning, not an authentication, so it
// manufactures no false ascription — and cutting it (a2c7442) left the matn itself leading the
// answer bare: «حب الوطن من الإيمان» and «اطلبوا العلم ولو بالصين» at the head of a reply
// that no longer said they are fabricated (W8, W9).
//
// THE CLASS. Only the grade words below, and only in the matn shape. «ضعيف» and «منكر» are
// OUTSIDE it: a weak hadith is still a grading, and stays on step 4's rule. «لا يصح منه»
// is the fiqh of validity («the Hajj of a disbeliever is not valid»), not a verdict on a text.
const FABRICATION_GRADES = new Set(['موضوع', 'الموضوع', 'موضوعه']);
/** A sentence that judges a text fabricated or baseless, on folded, conjunction-free words. */
const FABRICATION_VERDICT_RE = /(?:^| )(?:(?:ال)?موضوع(?:ه)?|مكذوب(?:ه)?|باطل|بالوضع)(?= |$)|لا اصل له|ليس بحديث|لا يصح(?! من| ان| الا)/u;
function carriesFabricationVerdict(text) {
  return FABRICATION_VERDICT_RE.test(tokenize(String(text || '')).map((t) => withoutConjunction(t.bare)).join(' '));
}
const foldMatn = (x) => tokenize(String(x || '')).map((t) => t.bare).join(' ');
// ── SECOND ORDER, STEP 3 · A BOOK OF FABRICATIONS OR OF WEAK NARRATIONS IS A VERDICT ──────
//
// «حديث «حب الوطن من الإيمان» أورده الصغاني في الموضوعات» carries no verdict word, and the matn
// was salvaged out of it bare and set at the head of the answer (W8b). A matn placed in such a
// book is a matn that book judges: it is never salvaged bare, exactly as step 5 treats a matn the
// answer calls fabricated.
//
// THE LIST IS MEASURED, NOT RECALLED: the `books` table of ezik-shamela-20260820 (7,400 rows),
// every title that names fabricated narrations, weak narrations or weak narrators — and the two
// ladder graders whose own title states a weak ruling (lib/takhrij-ladder.js rows 25 and 36). A
// title that sorts the sound from the weak (صحيح وضعيف …, المنار المنيف, المقاصد الحسنة, كشف
// الخفاء) is not a verdict and is not here. It is read only in the form «في [كتاب] <title>», so a
// passing mention of «كتب الموضوعات» does not condemn the quotation beside it.
const JUDGING_BOOK_TITLES = [
  // fabricated narrations — FC-002150 002153 002157 002158 002162 001725 002159 002161 002163
  // 002164 002165 002167 002168 002147 002148 002043 002154 001431
  'الموضوعات', 'موضوعات المستدرك', 'اللآلئ المصنوعة', 'اللآلىء المصنوعة', 'تنزيه الشريعة',
  'الأسرار المرفوعة', 'المصنوع', 'الفوائد الموضوعة', 'النخبة البهية', 'الآثار المرفوعة',
  'الأباطيل', 'العلل المتناهية', 'الفوائد المجموعة', 'غرر الفوائد المجموعة', 'الأربعون الودعانية',
  // weak narrations — FC-002061 000791 000790 000792 000793 000646 002064 002072 002180 002076
  'السلسلة الضعيفة', 'الضعيفة', 'الأحاديث الضعيفة', 'ضعيف الجامع', 'ضعيف أبي داود', 'ضعيف سنن',
  'ضعيف الترمذي', 'ضعيف ابن ماجه', 'ضعيف النسائي', 'ضعيف موارد الظمآن', 'ضعيف الأدب المفرد',
  'ضعيف الترغيب', 'تبييض الصحيفة', 'النافلة',
  // weak narrators — FC-002125 002131 006325 006326 006342 006380 006402 006446 006495 006501
  // 006367 006361 006384 006510 006565 006548 006553
  'الضعفاء', 'الضعفاء الكبير', 'الضعفاء والمتروكين', 'الضعفاء والمتروكون', 'المغني في الضعفاء',
  'ديوان الضعفاء', 'الكامل في ضعفاء الرجال', 'مختصر الكامل في الضعفاء', 'المجروحين',
  'تاريخ أسماء الضعفاء', 'ميزان الاعتدال', 'لسان الميزان', 'الكشف الحثيث',
];
// Folded WITHOUT `withoutConjunction`: that would read «في» as «ي». «وفي» is allowed below instead.
const foldTitle = (x) => tokenize(String(x || '')).map((t) => t.bare).join(' ');
const JUDGING_BOOK_RE = new RegExp('(?:^| )[وف]?في (?:كتاب |كتابه )?(?:'
  + [...new Set(JUDGING_BOOK_TITLES.map(foldTitle))].sort((a, b) => b.length - a.length).join('|')
  + ')(?= |$)', 'u');
/** Does this sentence place its text «في» a book whose title is a verdict on what it holds? */
function namesAJudgingBook(text) {
  return JUDGING_BOOK_RE.test(foldTitle(text));
}
/** Every quotation or card text of `text` that stands in a sentence judging it fabricated. */
function fabricatedMatnsOf(text) {
  const out = [];
  const s = String(text == null ? '' : text);
  for (const sen of sentences(s)) {
    const body = s.slice(sen.start, sen.end);
    if (!carriesFabricationVerdict(body) && !namesAJudgingBook(body)) continue;
    QUOTED_RUN_RE.lastIndex = 0;
    let q;
    while ((q = QUOTED_RUN_RE.exec(body)) !== null) {
      const folded = foldMatn(q[1]);
      if (folded.split(' ').filter(Boolean).length >= MIN_MATN_WORDS) out.push(folded);
    }
    QUOTED_RUN_RE.lastIndex = 0;
    const inner = [...body.matchAll(/<hadith\b[^>]*>([\s\S]*?)<\/hadith\s*>/giu)].map((m) => foldMatn(m[1]));
    for (const folded of inner) if (folded.split(' ').filter(Boolean).length >= MIN_MATN_WORDS) out.push(folded);
  }
  return out;
}
/**
 * May this matn be salvaged, bare in «…», out of the condemned sentence `body` of `text`?
 * Not when that sentence itself judges it fabricated, and not when the answer anywhere else
 * carries the same text under such a verdict: a fabricated matn never stands bare.
 */
function salvageIsFabricated(text, body, matn) {
  if (carriesFabricationVerdict(body)) return true;
  if (namesAJudgingBook(body)) return true;
  const m = foldMatn(matn);
  if (!m) return false;
  return fabricatedMatnsOf(text).some((v) => v.includes(m) || m.includes(v));
}

/** A word after a grade that makes it the title of a BOOK rather than a grading. */
const BOOK_AFTER_GRADE = new Set(['ابن', 'الجامع', 'السنن', 'المسند']);

/**
 * Every BARE grade in `text` — one that names nobody and opens no takhrij span.
 *
 * @returns {Array<{start:number,end:number,phrase:string,shape:string}>}
 *   shape 'matn'  — only the grade word is in the span; the noun before it stays.
 *   shape 'chain' — the chain noun is in the span too; «إسنادُه» with its grade removed is not
 *                   a sentence, and leaving it would be a fragment, not a repair.
 */
export function bareGradeSpans(text) {
  const s = String(text == null ? '' : text);
  const toks = tokenize(s);
  const out = [];
  const adjacent = (i, j) => i >= 0 && j < toks.length
    && !/[^\s]/u.test(s.slice(toks[i].end, toks[j].start));
  const push = (i, j, shape, attributive = false) => {
    const words = [];
    for (let k = i; k <= j; k += 1) words.push(toks[k].bare);
    out.push({ start: toks[i].start, end: toks[j].end, phrase: words.join(' '), shape, attributive });
  };
  for (let i = 0; i < toks.length; i += 1) {
    if (!GRADE_WORDS.has(toks[i].bare)) continue;
    const next = toks[i + 1];
    // «صحيح البخاري» / «صحيح ابن حبان» — the book, and `takhrijSpans` already reads it as one.
    if (next && adjacent(i, i + 1)
      && (SAHIH_BOOKS.has(next.bare) || BOOK_AFTER_GRADE.has(next.bare))) { i += 1; continue; }
    const prev = toks[i - 1];
    const before = prev && adjacent(i - 1, i) ? withoutConjunction(prev.bare) : null;
    const after = next && adjacent(i, i + 1) ? withoutConjunction(next.bare) : null;
    if (before && CHAIN_NOUNS.has(before)) { push(i - 1, i, 'chain'); continue; }
    // ١١١ · «الحديثُ الصحيحُ» — a DEFINITE noun and its DEFINITE adjective — is one name for a
    // text the answer points at, not a grading predicated of it. It is marked, so that the rule
    // below takes the word and leaves the sentence; «هو حديثٌ صحيحٌ» is not marked.
    if (before && MATN_NOUNS.has(before)) {
      push(i, i, 'matn', /^ال/u.test(before) && /^ال/u.test(toks[i].bare));
      continue;
    }
    if (after && CHAIN_NOUNS.has(after)) { push(i, i + 1, 'chain'); i += 1; }
  }
  return out;
}

/** A card, a link or a numbered citation — the shapes a source takes that are not a takhrij. */
const CARD_IN_BLOCK = /<\s*(?:hadith|source|book|verse|surah|document)\b/iu;
const LINK_IN_BLOCK = /https?:\/\//u;
/** «(البخاري ١٢٣)» — a citation is a bracket with a number in it. */
const CITATION_IN_BLOCK = /[(\uFF08][^)\uFF09]*[0-9\u0660-\u0669][^)\uFF09]*[)\uFF09]/u;

/** Does a source stand with anything in this block? */
function blockCarriesSource(block) {
  return takhrijSpans(block).length > 0
    || CARD_IN_BLOCK.test(block)
    || LINK_IN_BLOCK.test(block)
    || CITATION_IN_BLOCK.test(block);
}

/** The sentence of `block` that contains [start,end). */
function sentenceAround(block, start) {
  for (const sen of sentences(block)) if (start >= sen.start && start < sen.end) return sen;
  return { start: 0, end: block.length };
}

// ── AND THE SAME RULE ON THE STRUCTURED FIELD ───────────────────────────────
//
// «with no narrator and no source» is not only a prose shape. `<hadith ruling="صحيح">متن</hadith>`
// with no `narrator` is a grade with no chain, printed as a grade: index.html’s
// `resolveHadithAttribution` renders no «رَوَى …» line for an empty narrator and still prints the
// grade under the matn. `honestTakhrijInDraft` (lib/anchor/units.js:181) already empties such a
// field, but it is called from ONE route (api/ask.js:3857) and it needs the fetched pages to
// decide. This asks the narrower question that needs no pages at all: is there a chain or a
// source in the tag itself?
//
// AND THE TAG IS NEVER DROPPED. The attribute is emptied, exactly as `honestTakhrijInDraft`
// empties it and for the same stated reason: the matn survives. A ruling that IS a source
// («أخرجه البخاري (1) ومسلم (1907)», the frozen shape at lib/closed-deen.js:141) names a
// collection or carries a number, and is left exactly as it is.
const HADITH_TAG_RE = /<hadith\b([^>]*)>/giu;
const attrOf = (attrs, name) => {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'u').exec(attrs);
  return m ? m[1].trim() : '';
};
/** A ruling that is itself an attribution — a collection named, or a hadith number. */
const rulingIsItsOwnSource = (ruling) => takhrijSpans(ruling).length > 0
  || /[0-9\u0660-\u0669]/u.test(ruling);

/** @returns {{text:string, blanked:string[]}} */
export function blankChainlessRulings(textRaw) {
  const s = String(textRaw == null ? '' : textRaw);
  const blanked = [];
  HADITH_TAG_RE.lastIndex = 0;
  const out = s.replace(HADITH_TAG_RE, (whole, attrs) => {
    const ruling = attrOf(attrs, 'ruling');
    const narrator = attrOf(attrs, 'narrator');
    if (!ruling) return whole;
    if (narrator) return whole;
    if (rulingIsItsOwnSource(ruling)) return whole;
    blanked.push(ruling);
    return '<hadith' + attrs.replace(/ruling\s*=\s*"[^"]*"/u, 'ruling=""') + '>';
  });
  return { text: out, blanked };
}

// ── AA-88 · A SCHOLAR IS NOT LEFT HOLDING HALF A SENTENCE ────────────────────
//
// MEASURED (PRE-MERGE-AUDIT-2026-09-04.md §4/C4; the register's AA-88, which that report carries
// under its own §1.3 numbering). The branch below asks «is any Arabic letter left in this
// sentence?» before deciding whether to cut the grading word or the whole sentence. On
//
//     in   «قال ابن قدامة إن إسناده صحيح.»
//     out  «قال ابن قدامة إن.»                      30 bytes, shipped
//
// the letters that remained were the CREDIT FRAME — the scholar's name and the verb of saying —
// so it cut the word and left a truncated sentence in a named scholar's mouth. That is the class
// of defect the attribution door exists for, and it is worse than the grade it was removing.
//
// ── THE QUESTION IS NOT «ARE THERE LETTERS LEFT» BUT «IS THERE A STATEMENT LEFT» ──
// A credit frame with nothing behind it is not a statement. What a frame IS was measured before
// it was encoded, over 186,490 records — three books from each of the 71 categories of the
// classical library and the whole Ibn Bāz fatwa corpus:
//
//   blocks holding a bare grade                       7,991
//   ...gated out, a source stands with them           4,890   (never reach this decision)
//   sentences the word-cut branch touches             3,265
//   residues of those carrying a verb of saying       1,786
//   ...that declare where the quotation begins        1,632   (91.4%)
//
// Twelve of the shapes, verbatim, with what the branch leaves of each. They are the reason the
// lists below say what they say:
//
//   «قال: إسناده ضعيف.»                    →  «قال: .»
//   «قال الذهبي: «وإسنادها صحيح».»          →  «قال الذهبي: «».»
//   «وقال ابن حجر في التلخيص: إسناده حسن.»  →  «وقال ابن حجر في التلخيص: .»
//   «قَالَ التِّرْمِذِيُّ: حَدِيثٌ صَحِيحٌ.»            →  «قَالَ التِّرْمِذِيُّ: حَدِيثٌ .»
//   «قَالَ الْإِمَامُ أَحْمَدُ: حَدِيثٌ صَحِيحٌ.»        →  «قَالَ الْإِمَامُ أَحْمَدُ: حَدِيثٌ .»
//   «وقال الدارقطنى: حديث منكر.»            →  «وقال الدارقطنى: حديث .»
//   «قال أحمد: حديث منكر)»                 →  «قال أحمد: حديث )»
//   «فقال: هذا حديث منكر.»                 →  «فقال: هذا حديث .»
//   «قال أبي: هذا حديث منكر.»               →  «قال أبي: هذا حديث .»
//   «وقال الذهبى: هذا حديث منكر)»           →  «وقال الذهبى: هذا حديث )»
//   «وقال: هذِه أحاديث ضعاف.»               →  «وقال: هذِه أحاديث .»
//   «قلت: إنها أحاديث صحاح؟»               →  «قلت: إنها أحاديث ؟»
//
// EVERY WORD IN THE THREE SETS IS READ OFF THAT MEASUREMENT, none written from memory. The verbs
// are the words measured standing immediately before a credit's colon in those 3,265 sentences,
// ranked: قال 571 · وقال 118 · يقول 107 · فقال 77 · قالوا 32 · قالت 28 · قيل 26 · يقولون 23 ·
// قلت. The و/ف forms are the same verb wearing its conjunction and are folded off, exactly as the
// noun test above folds them. THE FILLERS are every word measured standing behind such a colon
// beside a matn or a chain noun and nothing else: هذا 20 · هو 3 · إنها 1 · له 1 · هذه 1.
// Everything else measured in that position — «كنز العمال», «غريب», «مقارب», «لغيره» — is left
// OUT on purpose: a word left out can only keep a sentence this branch keeps today.
//
// ── AND THE FRAME MUST SAY WHERE THE QUOTATION BEGINS ──
// The party credited is whatever stands between the verb and the introduction — a colon, or the
// complementizer «إنّ/أنّ/بأنّ» the audit's own witness uses. A sentence with no introduction at
// all is left exactly as it is today, because there is then no way to tell the party from the
// statement. 1,632 of the 1,786 measured residues declare one; the 154 that do not are a
// different shape («يقول النبي ﷺ في الحديث الصحيح..»), not a credit closing on its grade.
//
// ── AND THE DIRECTION OF ERROR IS CHOSEN, NOT ACCIDENTAL ──
// Every doubt resolves towards CUTTING LESS. Material standing before the verb is a statement and
// keeps the sentence; a name is never guessed at; a word on neither list is substance. A miss
// leaves the tree exactly as it is today — an over-reach deletes a sentence the reader was
// entitled to, and that is the direction this whole rule exists to avoid.

/** The verbs of saying, ranked by the measurement above. Folded, and the و/ف is folded off. */
const SAYING_VERBS = new Set(['قال', 'قالت', 'قالوا', 'قلت', 'يقول', 'يقولون', 'قيل']);
/** «قال فلان إنّ …» — the introduction when it is not a colon. */
const COMPLEMENTIZERS = new Set(['ان', 'انه', 'انها', 'بان', 'بانه', 'بانها']);
/** Measured standing behind a credit's colon beside a matn or chain noun and nothing else. */
const FRAME_FILLERS = new Set(['هذا', 'هذه', 'هو', 'له', 'انها']);
/** The two colons lib/colon-preamble.js names, and only those two. */
const INTRODUCTION_RE = /[:：]/u;

/** A word that is something PREDICATED, rather than the frame or the thing the grade graded. */
const isSubstantive = (bareRaw) => {
  const bare = withoutConjunction(bareRaw);
  return !MATN_NOUNS.has(bare) && !CHAIN_NOUNS.has(bare)
    && !GRADE_WORDS.has(bare) && !FRAME_FILLERS.has(bare);
};

/**
 * Is there a STATEMENT left in what removing the grade would leave behind, or only the frame
 * that credited it to somebody? Exported so a guard pins the question and not only its effect.
 *
 * ── IT NO LONGER DECIDES ANYTHING, AND THE MEASUREMENT IS WHY IT STAYS ────────
 * ١١١/٢ retired the branch this answered: every cut now ends at a sentence boundary or does
 * not happen, so there is no longer a case in which only the grading word goes. The function
 * and the 186,490-record measurement above it are kept because they are the EVIDENCE for that
 * ruling rather than an argument against it — they are what established that the residue of a
 * word-cut is a frame in 91.4% of the sentences this branch touches. Deleting them would
 * delete the reason the branch was retired, and a guard pins the question here so a later
 * round cannot quietly answer it the old way again.
 *
 * @param {string} restRaw  one sentence with its grade spans already taken out
 * @returns {boolean}  true — a statement stands
 *                     false — a credit frame stands alone
 */
export function leavesAStatement(restRaw) {
  const rest = String(restRaw == null ? '' : restRaw);
  if (!/[\u0621-\u064A]/u.test(rest)) return false;
  const toks = tokenize(rest);
  const verb = toks.findIndex((t) => SAYING_VERBS.has(withoutConjunction(t.bare)));
  if (verb < 0) return true;
  // What stands BEFORE the credit is a statement of its own, and it keeps the sentence.
  for (let i = 0; i < verb; i += 1) if (isSubstantive(toks[i].bare)) return true;
  // Where the quotation begins: the first colon after the verb, or the first complementizer,
  // whichever comes first. With neither, the party cannot be told from the statement.
  const colonAt = rest.slice(toks[verb].end).search(INTRODUCTION_RE);
  let intro = colonAt >= 0 ? toks[verb].end + colonAt + 1 : -1;
  for (let i = verb + 1; i < toks.length; i += 1) {
    if (!COMPLEMENTIZERS.has(withoutConjunction(toks[i].bare))) continue;
    if (intro < 0 || toks[i].end < intro) intro = toks[i].end;
    break;
  }
  if (intro < 0) return true;
  for (const t of toks) if (t.start >= intro && isSubstantive(t.bare)) return true;
  return false;
}

// ── ١١١ FOURTH ORDER [r41] · A GRADE IS A VERDICT ON ONE TEXT, AND A RULING NEVER PAYS FOR IT ──
//
// MEASURED (EZIK-111-BATTERY-MEASURE-REPORT-2026-09-21 §2, shapes A3 A4 B1 B2 B7 B8): the rule
// below read «كآية محكمة أو خبر متواتر» as a grade, called it a claim and took the Hanafi
// definition of fard whole — the answer began «أما الواجب عندهم…» with its head gone. And
// «8. إسلام الكافر، لحديث قيس…، وهو حديث صحيح.» lost the whole item, so «ثمانية» headed seven.
// `main` kept both with a hole. This branch traded the hole for the ruling; the owner's order is
// that a lost ruling is the worse harm of the two (البابُ الأوّل), and neither is allowed.
//
// ONE · A GENUS IS NOT GRADED. «أو خبر متواتر» in a definition names a KIND of report, not a
// report. A span is a grade only where its sentence points at one text: a quotation or a card, the
// Prophet ﷺ named (what he did or said is one narration), a chain with its pronoun («إسناده»), or a
// back-reference to one («وهو حديث…»، «وهذا الحديث…»). With none of those, and a word that
// classifies rather than judges — «متواتر», «الآحاد» beside it, or «كخبر…» / «كحديث…» giving an
// example — the sentence is a definition or a division, and the rule does not touch it by a letter.
//
// TWO · A RULING IS NEVER THE PRICE. Where the sentence carries a ruling — a list item, or a fiqh
// word before the grade — and the grade stands in a trailing clause that points back at its
// evidence («…، وهو حديث صحيح»، «… وإسناده حسن»), the CLAUSE goes and the sentence keeps its end
// mark. Nothing is left with a hole: the whole predicate goes with its subject pronoun.
//
// A sentence that is ONLY a grade («وهذا الحديث صحيح.») still goes whole; a verdict of
// fabrication still stays with its matn (step 5); step 8's evidence tail still runs first.
const GENUS_GRADE_WORDS = new Set(['متواتر', 'المتواتر', 'متواتره', 'المتواتره']);
const GENUS_NEIGHBOURS = new Set(['الاحاد', 'احاد', 'الاحاديه']);
const BACK_REFERENCES = new Set(['هو', 'هي', 'هذا', 'هذه', 'ذلك', 'ذاك', 'هما', 'فهو', 'وهو', 'وهي', 'فهي',
  'وهذا', 'فهذا', 'وهذه', 'فهذه', 'وذلك', 'فذلك', 'وهما']);
const CHAIN_WITH_PRONOUN = new Set(['اسناده', 'اسنادها', 'اسنادهما', 'سنده', 'سندها', 'سندهما']);
const PROPHET_NAMED_RE = /(?:^| )(?:النبي|رسول الله|المصطفي|صلي الله عليه وسلم)(?= |$)|ﷺ/u;
// The words a ruling is stated in, folded. A sentence holding one of these, before its grade, is a
// ruling and not a note on a hadith.
const RULING_WORDS = new Set(['يجب', 'وجب', 'تجب', 'واجب', 'واجبه', 'يجوز', 'تجوز', 'جائز', 'جايز', 'يحرم',
  'تحرم', 'حرام', 'محرم', 'يستحب', 'تستحب', 'مستحب', 'يسن', 'مسنون', 'مكروه', 'يكره', 'تكره', 'شرط', 'شروط',
  'يشترط', 'ينقض', 'تنقض', 'ناقض', 'نواقض', 'ينتقض', 'يبطل', 'تبطل', 'مبطل', 'مبطلات', 'فرض', 'فريضه', 'ركن',
  'اركان', 'يلزم', 'تلزم', 'لازم', 'موجب', 'موجبات', 'يصح', 'تصح', 'يباح', 'مباح', 'حلال', 'يفطر', 'مفطر',
  'يغتسل', 'الغسل', 'يتوضا', 'الوضوء']);

/** Does this sentence point at ONE text, so that a grade in it is a verdict on that text? */
function pointsAtOneText(body) {
  if (/[«»"“”]/u.test(body) || CARD_IN_BLOCK.test(body)) return true;
  if (PROPHET_NAMED_RE.test(' ' + norm(body) + ' ')) return true;
  const toks = tokenize(body).map((t) => t.bare);
  if (toks.some((w) => CHAIN_WITH_PRONOUN.has(withoutConjunction(w)))) return true;
  return toks.some((w) => BACK_REFERENCES.has(w));
}
/** Is every grade span of this sentence a word that names a KIND of report, in a sentence
 *  that points at no one report? Then it is a definition or a division, and is not graded. */
function describesAGenus(body, spansInBody) {
  if (!spansInBody.length || pointsAtOneText(body)) return false;
  const toks = tokenize(body);
  return spansInBody.every((sp) => {
    if (sp.shape !== 'matn') return false;
    const at = toks.findIndex((t) => t.start === sp.start);
    if (at < 0) return false;
    const word = toks[at].bare;
    const noun = at > 0 ? toks[at - 1].raw : '';
    const next = toks[at + 1] ? toks[at + 1].bare : '';
    return GENUS_GRADE_WORDS.has(word) || GENUS_NEIGHBOURS.has(next)
      || /^[وف]?ك/u.test(norm(noun)) && MATN_NOUNS.has(norm(noun).replace(/^[وف]?ك/u, ''));
  });
}
// ── ١١١ FIFTH ORDER [r42] · «الحديث الضعيف» SPOKEN OF AS A KIND IS NOT A GRADE ─────────────────
//
// MEASURED on the preview at 6119411 (21:13:31Z) and in the fourth order's run notes (٤): the rule
// below took «الضعيف» out of «يجوزُ ذكرُ الحديث الضعيف في الترغيب…» and out of «والحديث الضعيف لا
// يُعمَلُ به في الأحكام», and the reader got «والحديث لا يُعمَلُ به في الأحكام» — the OPPOSITE rule.
// In the language of usul «الحديث الضعيف» is not a verdict on a text: it is the NAME of a class,
// and the sentence states that class's rule — acting on it, mentioning it, narrating it, arguing
// from it. So a definite grade word («الضعيف»، «الصحيح»، «الحسن»، «الموضوع», singular or plural,
// after «الحديث/الأحاديث/الخبر/الرواية» or standing alone) is left untouched, by a letter, where
// its phrase is the object of one of those acts, or is followed by the rule itself («لا يُعمَلُ
// به»، «لا يُحتجُّ به»، «في الأحكام»، «في الفضائل»، «في الترغيب والترهيب»، «حجّة»، «يُعتمَد عليها»).
// «والحديث الصحيح في الباب يدلّ على ذلك» has neither and still loses its word, as r41 ruled: it
// means one text. An indefinite grade — «وهذا الحديث ضعيف»، «وهو حديث ضعيف» — is a verdict, and
// is not read here at all.
const GENUS_GRADE_FORMS = new Set(['الضعيف', 'الضعيفة', 'الصحيح', 'الصحيحة', 'الحسن', 'الحسنة',
  'الموضوع', 'الموضوعة'].map((w) => norm(w)));
const GENUS_TALK_NOUNS = new Set(['الحديث', 'الأحاديث', 'الخبر', 'الأخبار', 'الرواية', 'الروايات']
  .map((w) => norm(w)));
const GENUS_TALK_ACTS = new Set(['ذكر', 'يذكر', 'تذكر', 'ذكره', 'العمل', 'عمل', 'يعمل', 'تعمل', 'رواية',
  'يروى', 'يروي', 'الاحتجاج', 'يحتج', 'احتج', 'الاعتماد', 'يعتمد', 'قبول', 'يقبل', 'رد', 'يرد', 'الأخذ',
  'يؤخذ', 'يأخذ'].map((w) => norm(w)));
const GENUS_TALK_RULES = ['لا يعمل به', 'لا يحتج به', 'يعمل به', 'يحتج به', 'في الأحكام', 'في الفضائل',
  'في فضائل', 'في الترغيب', 'حجة', 'يعتمد عليه', 'يعتمد عليها', 'لا يعتمد'].map((w) => norm(w));
const withoutPreposition = (bare) => (/^[بل](?=ال)/u.test(bare) ? bare.slice(1) : bare);
/** Is this grade span the name of a CLASS of reports whose rule the sentence states? */
function speaksOfAGenus(block, sp) {
  const toks = tokenize(block);
  let k = -1;
  for (let j = 0; j < toks.length; j += 1) if (toks[j].start >= sp.start && toks[j].end <= sp.end) k = j;
  if (k < 0) return false;
  const word = withoutPreposition(withoutConjunction(toks[k].bare));
  if (!GENUS_GRADE_FORMS.has(word)) return false;
  const prev = k > 0 ? withoutPreposition(withoutConjunction(toks[k - 1].bare)) : '';
  const attributive = GENUS_TALK_NOUNS.has(prev);
  // Standing alone, the definite grade word is a class only as the object of an act on it.
  const head = attributive ? k - 1 : k;
  const act = head > 0 ? withoutConjunction(toks[head - 1].bare) : '';
  if (GENUS_TALK_ACTS.has(act) || GENUS_TALK_ACTS.has(act.replace(/ه$/u, ''))) return true;
  if (!attributive && !/^[وف]?[بل]ال/u.test(toks[k].bare)) return false;
  // The rule stated of it follows within four words: «لا يُعمَلُ به»، «حجّة في الأحكام».
  const near = ' ' + toks.slice(k + 1, k + 5).map((t) => t.bare).join(' ') + ' ';
  return GENUS_TALK_RULES.some((rule) => near.includes(' ' + rule + ' '));
}
/** Does this block's line carry an item of a list — marked, in <steps>, or under a colon head? */
function lineIsListItem(lines, i, body) {
  if (LIST_LINE_RE.test(lines[i]) || LIST_LINE_RE.test(body)) return true;
  for (let j = i - 1, seen = 0; j >= 0 && seen < 16; j -= 1) {
    const prev = lines[j].trim();
    if (!prev) continue;
    if (/^<\s*steps\b/iu.test(prev)) return true;
    if (/^<\/\s*steps\b/iu.test(prev)) return false;
    if (BARE_NUMERAL_LINE_RE.test(prev) && seen === 0) return true;
    if (/[:：]\s*$/u.test(prev)) return true;
    // A list's items are short lines of one statement each; a paragraph ends the search.
    if (prev.length > 220) return false;
    seen += 1;
  }
  return false;
}
/**
 * The trailing clause of a ruling sentence that holds every grade of it and points back at its
 * evidence, or null. `from` is the separator (or the space before a joined «وهو»), `to` the
 * end of the sentence's words, both `body`-relative; `mark` the end mark the ruling keeps.
 */
function trailingGradeClause(body, unsupported) {
  if (!unsupported.length) return null;
  const first = unsupported.reduce((lo, sp) => Math.min(lo, sp.start), body.length);
  const markM = body.match(/([.؟!]+)\s*$/u);
  const to = markM ? body.length - markM[0].length : body.length - (body.match(/\s*$/u) || [''])[0].length;
  const mark = markM ? markM[1] : '';
  const toks = tokenize(body);
  // The opener is the back-reference nearest before the first grade, with nothing but its own
  // noun between them: «وهو حديث صحيح»، «، وهذا الحديث صحيح»، «وإسناده حسن».
  let open = -1;
  for (let k = toks.length - 1; k >= 0; k -= 1) {
    if (toks[k].start > first) continue;
    const w = toks[k].bare;
    if (BACK_REFERENCES.has(w) || CHAIN_WITH_PRONOUN.has(withoutConjunction(w))) { open = k; break; }
    if (toks[k].start < first && !MATN_NOUNS.has(withoutConjunction(w))) return null;
  }
  if (open < 0) return null;
  const before = body.slice(0, toks[open].start);
  // A back-reference after an end mark opens a sentence of its own: that sentence IS the grade.
  if (/[.؟!]\s*$/u.test(before)) return null;
  const sep = before.match(/[،؛,]\s*$/u);
  const joined = /^[وف]/u.test(toks[open].bare);
  if (!sep && !joined) return null;
  const from = sep ? before.length - sep[0].length : before.replace(/\s+$/u, '').length;
  const head = tokenize(body.slice(0, from));
  if (head.length < 2) return null;
  if (DANGLING_HEAD_END.has(head[head.length - 1].bare)) return null;
  const headText = body.slice(0, from);
  if ((headText.match(/«/gu) || []).length !== (headText.match(/»/gu) || []).length) return null;
  const gone = body.slice(from, to);
  if (/[«»"“”﴿﴾]|<\s*hadith/iu.test(gone)) return null;
  if (unsupported.some((sp) => sp.start < from || sp.end > to)) return null;
  return { from, to, mark };
}
/** Does the head of this sentence, or its line's place in a list, carry a ruling? */
function carriesARuling(lines, i, body, from) {
  if (lineIsListItem(lines, i, body)) return true;
  return tokenize(body.slice(0, from)).some((t) => RULING_WORDS.has(withoutConjunction(t.bare)));
}

// ── BATCH 4 [b12] · A SPEAKER WITH NO NAME CARRIES NO GRADE ─────────────────────────────────
// MEASURED at 2aaf987 and 92d3c7d (EZIK-CX-M111 row 12): «قال الألباني: صحيح.» reached the reader
// as «وقال بعض أهل العلم: صحيح.» — the reviewer took the name for want of a source and left the
// grade standing behind the formula, a grading credited to nobody. The owner's ruling: under the
// general formula there is no grade; the grade goes and whatever else the sentence says stays,
// with no hole. So a sentence spoken by «بعض أهل العلم» or «من أهل العلم من يرى» loses every
// clause after the formula that is only a grade («صحيح»، «إسناده جيد»، «حديث حسن»، «لا بأس به»),
// and where that was all it said, the sentence goes. It is asked before any source is looked for:
// the name the grade was credited to is gone, so no page beside it can be its source.
const GENERAL_FRAMES = ['بعض أهل العلم', 'من أهل العلم من يرى'].map((f) => norm(f).split(' '));
const GRADE_CLAUSE_WORDS = new Set([...GRADE_WORDS, ...MATN_NOUNS, ...CHAIN_NOUNS, ...FRAME_FILLERS,
  ...['جيد', 'قوي', 'ثابت', 'لا', 'بأس', 'به', 'رجاله', 'ثقات', 'على', 'شرط', 'الشيخين', 'مسلم', 'البخاري',
    'لغيره', 'جدا', 'الحديث'].map((w) => norm(w))]);
const GRADE_CLAUSE_HEADS = new Set([...GRADE_WORDS, ...['جيد', 'قوي', 'ثقات', 'بأس'].map((w) => norm(w))]);
function isGradeClause(text) {
  const words = tokenize(text).map((t) => withoutConjunction(t.bare));
  return words.length > 0 && words.every((w) => GRADE_CLAUSE_WORDS.has(w)) && words.some((w) => GRADE_CLAUSE_HEADS.has(w));
}
/** The ranges of `line` a general speaker's grade occupies, as whole sentences or whole clauses. */
function generalSpeakerGradeCuts(line) {
  const cuts = [];
  for (const sen of sentences(line)) {
    const body = line.slice(sen.start, sen.end);
    const toks = tokenize(body);
    let frameEnd = -1;
    for (let k = 0; k < toks.length && frameEnd < 0; k += 1) {
      for (const f of GENERAL_FRAMES) {
        if (f.every((w, q) => toks[k + q] && toks[k + q].bare === w)) { frameEnd = toks[k + f.length - 1].end; break; }
      }
    }
    if (frameEnd < 0) continue;
    const colon = body.slice(frameEnd).match(/^\s*[:：]\s*/u);
    const restStart = frameEnd + (colon ? colon[0].length : body.slice(frameEnd).match(/^\s*/u)[0].length);
    const markM = body.match(/([.؟!]+)?\s*$/u);
    const restEnd = body.length - markM[0].length;
    if (restEnd <= restStart) continue;
    const rest = body.slice(restStart, restEnd);
    const parts = [];
    let from = 0;
    for (const c of topLevelCommas(rest)) { parts.push({ start: from, end: c }); from = c + 1; }
    parts.push({ start: from, end: rest.length });
    const graded = parts.map((p) => isGradeClause(rest.slice(p.start, p.end)));
    if (!graded.some(Boolean)) continue;
    if (graded.every(Boolean)) { cuts.push({ start: sen.start, end: sen.end, phrase: rest.trim() }); continue; }
    parts.forEach((p, n) => {
      if (!graded[n]) return;
      // The clause and ONE comma: the one after it when it opens the rest, else the one before it.
      const a = n === 0 ? p.start : p.start - 1;
      const b = n === 0 ? Math.min(rest.length, p.end + 1) : p.end;
      cuts.push({ start: sen.start + restStart + a, end: sen.start + restStart + b, phrase: rest.slice(p.start, p.end).trim() });
    });
  }
  return cuts;
}
/** Does this text hold a grade a general speaker carries? For the stream's hold (lib/sentence-stream.js). */
export function carriesGeneralSpeakerGrade(text) {
  return generalSpeakerGradeCuts(String(text == null ? '' : text)).length > 0;
}

/**
 * THE GRADE GOES, THE TEXT STAYS.
 *
 * @param {string} textRaw          the prose destined for the reader
 * @param {object} opts
 *   followedByCard  the writer still has a card to append after this text, so the LAST block
 *                   may have its source behind it on the wire and is left alone — the same
 *                   reasoning lib/finalize-reader-text.js applies to a dangling lead-in.
 * @returns {{text:string, removed:Array<{phrase:string,shape:string}>}}
 */
export function dropUnsourcedGrades(textRaw, { followedByCard = false } = {}) {
  const s = String(textRaw == null ? '' : textRaw);
  if (!s.trim()) return { text: s, removed: [] };
  // The structured field first, and unconditionally: a block holding a card counts as SOURCED
  // for the prose pass below, so asking about the tag afterwards would never happen.
  const structured = blankChainlessRulings(s);
  const removedStructured = structured.blanked.map((phrase) => ({ phrase, shape: 'tag-ruling' }));
  const lines = structured.text.split('\n');
  let lastNonEmpty = -1;
  for (let i = 0; i < lines.length; i += 1) if (lines[i].trim()) lastNonEmpty = i;
  const removed = [...removedStructured];
  const emptiedByGeneral = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    // BATCH 4 [b12] — a general speaker's grade goes first, sourced or not (see above).
    const general = generalSpeakerGradeCuts(lines[i]);
    if (general.length) {
      let edited = lines[i];
      for (const c of [...general].sort((a, b) => b.start - a.start)) {
        edited = edited.slice(0, c.start) + edited.slice(c.end);
        removed.push({ phrase: norm(c.phrase), shape: 'general-speaker' });
      }
      lines[i] = edited.replace(/[ \t]{2,}/gu, ' ').replace(/^[\s،؛,.؟!]+$/u, '').trimEnd();
      // A line that was only the general speaker's grade goes as a line, not as a blank one.
      if (!lines[i].trim()) emptiedByGeneral.add(i);
    }
    const block = lines[i];
    if (!block.trim()) continue;
    if (followedByCard && i === lastNonEmpty) continue;
    if (blockCarriesSource(block)) continue;
    // The card a line introduces is that line’s source, so the next block is consulted too.
    let next = '';
    for (let j = i + 1; j < lines.length; j += 1) if (lines[j].trim()) { next = lines[j]; break; }
    if (next && CARD_IN_BLOCK.test(next)) continue;
    const frozen = containsFrozenRun(block);
    const spans = bareGradeSpans(block)
      .filter((sp) => !(frozen && sp.start < frozen.end && sp.end > frozen.start))
      .filter((sp) => !speaksOfAGenus(block, sp)); // FIFTH ORDER [r42] — a class, not a verdict
    if (!spans.length) continue;
    // ── ١١١/٢ · A CUT ENDS AT A SENTENCE BOUNDARY OR IT DOES NOT HAPPEN ─────────
    //
    // WHAT THIS REPLACES, AND THE OWNER’S OWN WITNESS FOR IT. This branch used to ask
    // `leavesAStatement` whether a STATEMENT would be left behind and, when one would, cut the
    // grading WORD out of the middle of the sentence and ship the rest. Reproduced here in a
    // pure function, no network and no preview, on his measured sentence of 20 September:
    //
    //     in   «بل هو حديث موضوع جدا.»
    //     out  «بل هو حديث جدا.»                       shipped, in the «أنا مدينة العلم» answer
    //
    // `leavesAStatement` was not wrong about the letters: «بل هو حديث جدا» has a subject and a
    // predicate left in it. It is a sentence with a word torn out of its middle all the same,
    // and no test of what remains can tell the two apart, because the question was never
    // «is something left» — it was «is a word being taken out of the middle of a sentence».
    //
    // ── THE OWNER’S RULING, WHICH RETIRES THE QUESTION AND NOT ONLY ITS ANSWER ────
    // «ختمُ التسليمِ لا يحذفُ متنًا نبويًّا بحال. إن اضطرَّ إلى إسقاطِ شيءٍ فليُسقِطْ ما حولَه،
    //  والمتنُ يبقى.» — والجملةُ غيرُ المتن. الجملةُ التي يُحكَمُ عليها تذهبُ كاملةً،
    //  ولا يُنتزَعُ منها لفظٌ فتبقى واقفة. ولا ثالثَ.
    //
    // SO THE UNIT IS THE SENTENCE, EXACTLY AS IT IS FOR `lockTakhrij` ABOVE, and the two rules
    // now cut in one shape instead of two. The price is named rather than hidden: a true clause
    // standing in the same sentence as an unsourced grade goes with it — «قال: لا يثبت عندي؛
    // إسناده ضعيف.» loses its refusal along with its grade. That is «السكوتُ خسارةُ فائدة»,
    // and the shape it replaces was «جملةٌ ناقصةُ كلمةٍ» reaching a reader.
    //
    // ── AND THE MATN NEVER PAYS THAT PRICE ─────────────────────────────
    // The second half of the same ruling — «فليُسقِطْ ما حولَه، والمتنُ يبقى» — is already
    // written in this file as `matnToSalvage`, and it is the SAME function, called with the
    // same argument shape. A condemned sentence that carries a narration is replaced by that
    // narration alone: the grade goes, the commentary goes, the quotation stands.
    // ── ١١١ · THE GRADE AS A DESCRIPTION LOSES ITS WORD, THE GRADE AS A CLAIM ITS SENTENCE ──
    //
    // MEASURED (EZIK-111-CONTENT-LOSS-REPORT-2026-09-21, W4 and W5, both RAW). The sentence rule
    // above took «…الحديث الصحيح عن النبي ﷺ صريح: «لا تسافر امرأة إلا مع ذي محرم»، … وهذا هو
    // الذي رجّحه ابن باز وابن عثيمين: أنه لا يجوز للمرأة أن تسافر للحج بلا محرم…» — the
    // tarjih and the ruling with it, 277 characters — and «وقد ثبت في الحديث الصحيح أن النبي ﷺ
    // مسح على الجوربين…» took the proof of the masḥ. A fiqh ruling lost for a word that pointed
    // at a text.
    //
    // THE RULING (Claude's, replacing P1 of that report). «هو حديثٌ صحيحٌ» is PREDICATIVE: the
    // grade is the claim, and a sentence with its claim torn out is the hole a2c7442 closed,
    // so that sentence still goes whole. «الحديثُ الصحيحُ» is ATTRIBUTIVE — a definite noun and
    // its definite adjective, a name for a text inside a ruling — so the WORD goes and the
    // sentence stays: «الحديث عن النبي ﷺ صريح», exactly as main cut this shape. No «صحيح»
    // stands without a source either way, which is what AA-83 is for. A sentence holding
    // both shapes is a claim, and goes whole.
    const cuts = [];
    for (const sp of spans) {
      const sen = sentenceAround(block, sp.start);
      const inSentence = spans.filter((x) => x.start >= sen.start && x.end <= sen.end);
      // FOURTH ORDER [r41] ONE — a genus in a definition or a division is not graded (see above).
      if (describesAGenus(block.slice(sen.start, sen.end),
        inSentence.map((x) => ({ ...x, start: x.start - sen.start, end: x.end - sen.start })))) continue;
      // STEP 5 — every grade in the sentence is a verdict of fabrication: it stays whole, as
      // the model wrote it, and nothing is recorded as removed because nothing was.
      if (inSentence.every((x) => x.shape === 'matn'
        && FABRICATION_GRADES.has(String(x.phrase).split(' ').pop()))) continue;
      if (inSentence.every((x) => x.attributive)) {
        cuts.push({ start: sp.start, end: sp.end, insert: '' });
        removed.push({ phrase: sp.phrase, shape: sp.shape });
        continue;
      }
      const within = inSentence
        .map((x) => ({ start: x.start - sen.start, end: x.end - sen.start }));
      // ── ١١١ STEP 8 · THE SAME TAIL, WHEN THE UNSOURCED CLAIM IS A GRADE ─────────
      // MEASURED at the round's gate: «2- العقل: فلا يجب على المجنون، لقول النبي ﷺ: «رفع القلم
      // …» وهو حديث صحيح» lost its ruling — main kept it with a hole («وهو حديث»), and the
      // predicative rule above took the whole sentence to close that hole. The grade is the
      // evidence's, not the ruling's, and it stands in exactly the tail step 6 cuts for an
      // attribution: after a comma, opened by an evidence particle, to the sentence's end. So
      // the tail goes, the ruling keeps its end mark, and a quotation in the tail is salvaged
      // after it as its own sentence (step 5 applying). Same function, same limits.
      const tail = trailingEvidenceTail(block.slice(sen.start, sen.end), within);
      if (tail) {
        const inTail = matnToSalvage(block, sen, within);
        const matn = inTail && inTail.keep.start >= sen.start + tail.from
          && !salvageIsFabricated(s, block.slice(sen.start, sen.end), inTail.matn) ? inTail : null;
        cuts.push({ start: sen.start + tail.from, end: sen.start + tail.to,
          insert: matn ? (tail.mark || '.') + ' ' + matn.keep.insert : '' });
        removed.push({ phrase: sp.phrase, shape: sp.shape });
        continue;
      }
      // FOURTH ORDER [r41] TWO — a ruling keeps its sentence; the clause holding the grade goes.
      const clause = trailingGradeClause(block.slice(sen.start, sen.end), within);
      if (clause && carriesARuling(lines, i, block.slice(sen.start, sen.end), clause.from)) {
        cuts.push({ start: sen.start + clause.from, end: sen.start + clause.to, insert: '' });
        removed.push({ phrase: sp.phrase, shape: sp.shape });
        continue;
      }
      const salvage = matnToSalvage(block, sen, within, { framed: true });
      if (salvage && !salvageIsFabricated(s, block.slice(sen.start, sen.end), salvage.matn)) {
        // The sentence is replaced by its narration. Trailing whitespace is left where it
        // stood so the quotation keeps the line it was written on.
        const tail = block.slice(salvage.keep.end, sen.end);
        const tailEnd = sen.end - (tail.match(/\s*$/u) || [''])[0].length;
        cuts.push({ start: sen.start, end: Math.max(tailEnd, salvage.keep.end), insert: salvage.keep.insert });
      } else {
        cuts.push({ start: sen.start, end: sen.end, insert: '' });
      }
      removed.push({ phrase: sp.phrase, shape: sp.shape });
    }
    cuts.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const c of cuts) {
      const last = merged[merged.length - 1];
      // Two spans of ONE sentence produce the same range twice; only identical removals fold.
      // A replacement never folds into its neighbour, or the matn the fold was carrying is
      // the thing that gets deleted — the same rule `lockTakhrij` states at its own merge.
      if (last && !last.insert && !c.insert && c.start <= last.end) {
        last.end = Math.max(last.end, c.end);
        continue;
      }
      if (last && last.insert && c.insert === last.insert && c.start === last.start) continue;
      merged.push({ start: c.start, end: c.end, insert: c.insert || '' });
    }
    let out = block;
    for (let k = merged.length - 1; k >= 0; k -= 1) {
      out = out.slice(0, merged[k].start) + merged[k].insert + out.slice(merged[k].end);
    }
    // Whitespace and orphaned separators only. No word is ever added, and no word is moved.
    lines[i] = out
      .replace(/[ \t]{2,}/gu, ' ')
      .replace(/[ \t]+([،؛,.؟!])/gu, '$1')
      .replace(/([،؛,])\s*([.؟!])/gu, '$2')
      .replace(/^[\s،؛,.؟!]+$/u, '')
      .trimEnd();
  }
  // AND IT NEVER EMPTIES AN ANSWER. «إسنادُه صحيحٌ.» alone is a whole reply whose only substance
  // is the grade, and removing it would hand lib/finalized-sse-writer.js:467 an empty approval —
  // the same reasoning that stops the seat cutting a lead-in that is the whole answer. Where
  // nothing would be left, the text is returned exactly as it arrived and nothing is recorded.
  const out = lines.filter((line, i) => !emptiedByGeneral.has(i)).join('\n');
  if (!/[\u0621-\u064A]/u.test(out)) return { text: s, removed: [] };
  return { text: out, removed };
}
// The extracted text of every page that was actually fetched, as one folded haystack.
function haystack(sources) {
  return ' ' + (Array.isArray(sources) ? sources : [])
    .map((x) => (typeof x === 'string' ? x : norm(String((x && (x.passage || x.text || x.authorialText)) || '') + ' ' + String((x && x.title) || ''))))
    .map((x) => (typeof x === 'string' ? norm(x) : x))
    .join(' \n ') + ' ';
}

// ── THE BARE «الصحيحين» MUST BE ABOUT *THIS* MATN — 20 September 2026 ─────────
//
// MEASURED ON THE OWNER'S OWN SCREEN, in the answer to «هل يجوز صيام يوم السبت تطوعًا؟». The
// reply carried «ما ثبت في الصحيحين» over the hadith of fasting Saturday and Sunday — and that
// hadith is NOT in the Ṣaḥīḥayn. The lock read the span, judged it, and PASSED it.
//
// REPRODUCED LOCALLY, no network and no model, with the sentence above over three pages:
//     SPAN_COUNT=1 · SPAN | attribution | «في الصحيحين»
//     A page naming both Shaykhs anywhere       → CLEAN    removed=[]      ← the defect
//     B page naming neither                     → REFUSED  removed=[«في الصحيحين»]
//     C no sources at all                       → REFUSED  removed=[«في الصحيحين»]
//
// SO THE DEFECT IS THIS CONDITION, AND IT IS STRUCTURAL. It asked «are both names somewhere on
// the page?» and never «was THIS matn ascribed to them?». The Ibn Bāz page shown under that
// answer names al-Bukhārī and Muslim in other passages entirely, and that was enough to certify
// an ascription the page never made. Two names that end an argument in this subject are the
// last place a proximity heuristic belongs.
//
// THE RULE NOW: a bare ascription to the Ṣaḥīḥayn is established only where the page names both
// Shaykhs IN A CONTEXT THAT CARRIES THE MATN BEING CLAIMED — adjacency AND overlap together,
// never either alone.
//
// AND THE TWO NUMBERS BELOW ARE CHOSEN, NOT MEASURED. The 400-character window and the three
// shared words are thresholds picked to separate the owner's case from a genuine ascription on
// the same page; no corpus was measured to derive them. WHOEVER CHANGES EITHER ONE MUST MEASURE
// AGAIN — the guard `sahihaynlink` holds the five cases that say what they are worth.
const SAHIHAYN_WINDOW_CHARS = 400;
const SAHIHAYN_SHARED_WORDS = 3;
// Names and formulas that sit beside EVERY takhrij ever written, so sharing one proves nothing.
const SAHIHAYN_COMMON = new Set([
  'البخاري', 'مسلم', 'الصحيحين', 'متفق', 'عليه', 'رواه', 'أخرجه',
  'حديث', 'الله', 'رسول', 'النبي', 'صلى', 'وسلم',
].map((w) => norm(w)));

/** The words of a folded string that could distinguish one narration from another. */
function distinctiveWords(folded) {
  const out = new Set();
  for (const w of folded.split(' ')) {
    if (w.length >= 3 && !SAHIHAYN_COMMON.has(w)) out.add(w);
  }
  return out;
}

// ── ١١١ · A NAME IS MATCHED AS A WORD, NEVER AS LETTERS INSIDE ANOTHER WORD ────────
//
// MEASURED (EZIK-111-FOURTH-ORDER §٦): `occurrences(hay, 'مسلم')` found «مسلم» inside «المسلمين»,
// so a page that named al-Bukhārī beside «حقوق المسلمين» certified «(متفق عليه)». Every match of a
// collector's or a book's name in this file now asks for an Arabic word boundary on both sides:
//
//   BEFORE  the start, or a character that is not an Arabic letter — with an optional prefix of
//           «و» or «ف» and then «ل» or «ب». NEVER «لل»: that is «ل + ال», and «للمسلم» is not Muslim.
//   AFTER   the end, or a character that is not an Arabic letter (tashkil is already folded out
//           of the page and the sentence by `norm`, so «مسلمٌ» arrives as «مسلم»).
//
// THE ERROR IS ON THE SIDE OF REFUSAL. A name this reads as absent that was present costs a
// parenthetical; a name it reads as present that was absent is a false ascription.
const NAME_PREFIXES = new Set(['', 'و', 'ف', 'ل', 'ب', 'ول', 'وب', 'فل', 'فب']);
const ARABIC_LETTER_RE = /[\u0621-\u064A\u0671-\u06D3]/u;
/** Does `needle` stand at `i` in `hay` as a whole word (or words), by the rule above? */
function standsAsWord(hay, i, needle) {
  const endAt = i + needle.length;
  if (endAt < hay.length && ARABIC_LETTER_RE.test(hay[endAt])) return false;
  let from = i;
  while (from > 0 && ARABIC_LETTER_RE.test(hay[from - 1])) from -= 1;
  const prefix = hay.slice(from, i);
  if (!NAME_PREFIXES.has(prefix)) return false;
  // «للمسلم» and «بالمسلم» carry «لل» and «بال» in front of the name: neither is a prefix above.
  return true;
}
/** Every index at which `needle` occurs in `hay` as a word. */
function occurrences(hay, needle) {
  const out = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    if (standsAsWord(hay, i, needle)) out.push(i);
  }
  return out;
}
/** Does `needle` occur in `hay` as a word? */
function containsAsWord(hay, needle) {
  return occurrences(hay, needle).length > 0;
}

/**
 * Does any ONE passage of the page name both Shaykhs while talking about THIS sentence's matn?
 *
 * Both conditions, together: the two names fall within `SAHIHAYN_WINDOW_CHARS` of each other,
 * and the window they sit in shares at least `SAHIHAYN_SHARED_WORDS` distinctive words with the
 * sentence making the claim. The window is that many characters CENTRED on the pair, because the
 * matn may be published before the names as easily as after them.
 */
function sahihaynCarriesThisMatn(hay, body) {
  const claim = distinctiveWords(norm(body));
  if (claim.size < SAHIHAYN_SHARED_WORDS) return false;
  const B = norm('البخاري');
  const M = norm('مسلم');
  const half = Math.floor(SAHIHAYN_WINDOW_CHARS / 2);
  for (const b of occurrences(hay, B)) {
    for (const m of occurrences(hay, M)) {
      const lo = Math.min(b, m);
      const hi = Math.max(b + B.length, m + M.length);
      if (hi - lo > SAHIHAYN_WINDOW_CHARS) continue;
      const from = Math.max(0, Math.floor((lo + hi) / 2) - half);
      const shared = new Set();
      for (const w of hay.slice(from, from + SAHIHAYN_WINDOW_CHARS).split(' ')) {
        if (claim.has(w)) shared.add(w);
      }
      if (shared.size >= SAHIHAYN_SHARED_WORDS) return true;
    }
  }
  return false;
}

// A span counts as SUPPORTED when the page says the same thing. Both directions are allowed on
// purpose: the reply may write «رواه البخاري» where the page wrote «رواه البخاري ومسلم» (the page
// contains the reply's phrase), and the reply may write «رواه البخاري ومسلم» where the page wrote
// exactly that. What is never allowed is a phrase the page does not contain at all.
//
// `body` is the sentence the span was found in. It is optional so that no other caller breaks,
// and WHERE IT IS ABSENT THE BARE-ṢAḤĪḤAYN CASE FAILS CLOSED — the safer reading, never the wider.
function supported(phrase, hay, body = '') {
  const p = norm(phrase);
  if (!p) return true;
  // ١١١ · as a WORD: «رواه مسلم» is not in «رواه مسلمون» (see `standsAsWord`).
  if (containsAsWord(hay, p)) return true;
  // THIRD ORDER, STEP 4-ج — the span reads past «أيضا», so the page is read past it too.
  if (hay.indexOf(' ايضا ') !== -1 && containsAsWord(hay.split(' ايضا ').join(' '), p)) return true;
  // A bare «متفق عليه» is established by the page naming both Ṣaḥīḥs ABOUT THIS MATN. See above.
  if (p === 'متفق عليه' || p === 'في الصحيحين' || p === 'الصحيحين') {
    return sahihaynCarriesThisMatn(hay, body);
  }
  return false;
}

// ── A `<hadith>` BLOCK IS ONE SENTENCE, AND THAT IS A REPAIR, NOT A REFINEMENT ──
//
// MEASURED ON THE OWNER'S OWN SCREEN, 19 September 2026, in the answer to «الدين النصيحة». He was
// shown two defects, and they are ONE defect:
//
//     …وَلِأَئِمَّةِ المُسْلِمِينَ وَعَامَّتِهِمْ</hadith>        ← a closing tag with no opening tag
//     the answer began at «قُلْنَا: لِمَنْ يَا رَسُولَ اللهِ؟»    ← it began mid-hadith
//
// REPRODUCED EXACTLY. The reply arrived as
//   `<hadith narrator="أخرجه مسلم" ruling="أخرجه مسلم (55)">الدِّينُ النَّصِيحَةُ. قُلْنَا: …</hadith>`
// and the splitter below knew nothing about card blocks, so the matn's own full stop after
// «النَّصِيحَةُ» cut the block in two. The FIRST piece carried the opening tag and its attributes;
// `takhrijSpans` reads attribute text as prose, found «أخرجه مسلم» in it, no fetched page published
// it, and the rule below dropped that piece whole — taking the opening tag and the head of the
// hadith with it and leaving the closing tag standing in the reader's face.
//
// SO THE UNIT IS THE BLOCK. A card is indivisible here: either its attribution is published and the
// whole card stays, or it is not and the whole card goes — which is exactly what
// `orphanedLeadInCuts` below was already written to assume («the card's line»).
//
// AND IT IS SCOPED TO `<hadith>` ALONE, deliberately. `<document>` blocks run to thousands of
// characters and hold dozens of sentences; making one of those atomic would let a single
// unpublished takhrij delete an entire document. The card whose ATTRIBUTES carry a takhrij is the
// hadith card, and it is the only one this change touches.
const CARD_ATOM_RE = /<hadith\b[^>]*>[\s\S]*?<\/hadith\s*>/giu;

/** The ranges no sentence boundary may fall inside. */
function atomicRanges(s) {
  const out = [];
  CARD_ATOM_RE.lastIndex = 0;
  let m;
  while ((m = CARD_ATOM_RE.exec(s)) !== null) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

// Split into sentences, keeping each one's offsets so a whole sentence can be dropped.
function sentences(text) {
  const s = String(text == null ? '' : text);
  const atoms = atomicRanges(s);
  // A boundary INSIDE a card block is not a boundary. The end of the block is.
  const inAtom = (at) => atoms.find((a) => at >= a.start && at < a.end) || null;
  const out = [];
  let start = 0;
  // ١١١ · AN INLINE LIST MARKER IS A BOUNDARY TOO. «1- … 2- … 3- …» written on one line is
  // five items, not one sentence, and an unsourced grade or credit in one item used to take all
  // five with it (W1: the five conditions of Hajj, gone for a «وهو حديث صحيح» in item 2). The
  // boundary is the whitespace before a one- or two-digit number, Western or Eastern Arabic,
  // followed by «-», «.» or «)» and a space. It is here and nowhere else, so the lock and
  // `dropUnsourcedGrades` (through `sentenceAround`) take it together. MEASURED before it was
  // written: zero effect on the forty delivered answers of EZIK-RAW-CORPUS-2026-08-19.
  const re = /[.؟!\n]+|\s(?=(?:\d{1,2}|[\u0660-\u0669]{1,2})\s?[-.)]\s)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const held = inAtom(m.index);
    if (held) {
      // Resume scanning at the block's end, so the block and whatever closes its line stay whole.
      re.lastIndex = held.end;
      continue;
    }
    out.push({ start, end: m.index + m[0].length });
    start = m.index + m[0].length;
  }
  if (start < s.length) out.push({ start, end: s.length });
  return out;
}

// What is left of a sentence once its takhrij is gone. Below this, the sentence WAS the takhrij.
const MIN_WORDS_AFTER = 4;

/**
 * ── THE SENTENCE THAT LED INTO THE DROPPED BLOCK GOES WITH IT ────────────────
 *
 * MEASURED, turn F03 of EZIK-RAW-CORPUS-2026-08-19.jsonl. The reply reached this lock shaped like
 * this: a line ending in a colon, then the card that line existed to introduce, then the prose
 * that comments on it. The card was a `<hadith>` whose own `narrator` attribute carried a takhrij
 * no fetched page published, so the rule above dropped the card's line — correctly. The colon line
 * stayed. What the reader received was a promise («…is established by the text:») with nothing
 * behind it, followed by a sentence that says «and this is explicit in…» about a quotation that is
 * no longer there.
 *
 * IT IS THE ORPHANED-LEAD-IN FAMILY OF 974f6624, ONE PHASE LATER. That round fixed it inside
 * `deliverableText` (lib/free-brain/loop.js:932) by making the foreign-script rule stop eating card
 * lines. Here the deletion is not a mistake to be stopped — an unpublished takhrij must go — so the
 * repair is the other half: the sentence whose only job was to introduce the deleted block goes too.
 *
 * WHICH SENTENCE IS DECIDED BY THE DETECTOR THAT ALREADY EXISTS, AND BY NOTHING ELSE.
 * `colonPreambles` (lib/colon-preamble.js) is asked the same question twice — on the text as it
 * arrived, and on the text this lock's cut leaves. A preamble is removed ONLY when it was HEALTHY
 * before and is ORPHANED after. That difference IS the evidence that this cut is what orphaned it,
 * which is what keeps a preamble the model already wrote orphaned exactly where it was: this is not
 * a tidier, and it repairs nothing it did not break.
 *
 * NO VOCABULARY, NO WIDENING, NO SECOND OPINION ON THE CARD. The lead-in is identified by
 * structure; the whole LINE is taken and never a fragment of one; and the decision to drop the
 * card is the loop above's alone and is not consulted, weakened or extended here.
 *
 * @param {string} s        the text as it arrived
 * @param {Array}  cuts     the ranges the takhrij rule decided to remove
 * @returns {Array<{start:number,end:number}>} whole-line ranges, in `s`'s own offsets
 */
function orphanedLeadInCuts(s, cuts) {
  // The text the cuts leave, and where every surviving character landed in it.
  const dropped = new Uint8Array(s.length);
  // A CUT THAT PUTS A MATN BACK IS NOT A REMOVAL, AND THIS READING MUST SEE IT.
  // §١ of the closing order leaves the salvaged narration standing where the sentence around
  // it was taken out. A lead-in whose block still holds that narration was never orphaned —
  // and judging it against a text the reader will never receive is how «فمن أدلة السنة:» came
  // to be deleted beside a hadith that had survived.
  const insertAt = new Map();
  for (const c of cuts) {
    for (let k = Math.max(0, c.start); k < Math.min(s.length, c.end); k += 1) dropped[k] = 1;
    if (c.insert) insertAt.set(c.start, String(insertAt.get(c.start) || '') + c.insert);
  }
  let after = '';
  const moved = new Array(s.length + 1);
  for (let k = 0; k < s.length; k += 1) {
    if (insertAt.has(k)) after += insertAt.get(k);
    moved[k] = after.length;
    if (!dropped[k]) after += s[k];
  }
  moved[s.length] = after.length;

  // The two readings are correlated through the LINE each preamble sits on and not through its
  // text: a line whose tail was cut is still the same line, and `colonPreambles` reports a line
  // index. `lineStart` indexes the arriving text; `lineOf` the text the cut left.
  const lineStart = [0];
  for (let k = 0; k < s.length; k += 1) if (s[k] === '\n') lineStart.push(k + 1);
  const lineOf = [0];
  for (let k = 0; k < after.length; k += 1) lineOf.push(lineOf[k] + (after[k] === '\n' ? 1 : 0));

  // Healthy before, keyed by the line it occupies after. If a cut merged two lines and two healthy
  // preambles claim one key, the key is abandoned rather than guessed: this may only ever remove
  // what it can point at.
  const healthy = new Map();
  const ambiguous = new Set();
  for (const p of colonPreambles(s)) {
    if (p.orphaned) continue;
    const key = lineOf[moved[lineStart[p.index]]];
    if (healthy.has(key)) ambiguous.add(key); else healthy.set(key, p.index);
  }

  const out = [];
  for (const p of colonPreambles(after)) {
    if (!p.orphaned || ambiguous.has(p.index) || !healthy.has(p.index)) continue;
    const line = healthy.get(p.index);
    out.push({
      start: lineStart[line],
      end: line + 1 < lineStart.length ? lineStart[line + 1] : s.length,
    });
  }
  return out;
}

// ── §١ OF THE CLOSING ORDER · THE SEAL DOES NOT DELETE A MATN ────────────────
//
// MEASURED ON THE OWNER'S OWN SCREEN, 19 September 2026, in the wide battery, and REPRODUCED
// HERE WITH THE SWITCH OFF — so it is not this branch's doing and it is live today:
//
//     فمن أدلة السنة:
//                                            ← the two hadiths that stood here are gone
//     وهذا نص في تحريم ما نزل عن الكعبين مطلقا.
//     وفيه بيان السنة في موضع الثوب: ما بين الكعب ونصف الساق.
//
// The sentences carried «أخرجه البخاري» and «أخرجه أبو داود». No page in hand published either
// phrase — a free-brain turn that cites nothing hands this lock an EMPTY page list — so the rule
// above dropped both sentences WHOLE, and the Prophet's ﷺ words went out of the answer with the
// credit. The second witness is the same removal at the head: the reply began at «أمّا التفكّرُ
// في ذاتِ الله», because the sentence that answered the question had «رواه أبو نعيم» in it.
//
// ── THE OWNER'S RULING, WHICH SUPERSEDES X-013/ز ON THIS ONE POINT ───────────
// «ختمُ التسليمِ لا يحذفُ متنًا نبويًّا بحال. إن اضطرَّ إلى إسقاطِ شيءٍ فليُسقِطْ ما حولَه،
//  والمتنُ يبقى.» — and its reason: «السكوتُ نقصٌ يُحتمَل، والحذفُ إتلافٌ لا يُحتمَل.»
//
// AND IT DOES NOT REOPEN THE DEFECT X-013/ز CLOSED. That round's objection was never to keeping
// the matn — it was to keeping the ASSERTION the sentence made about it: cut «رواه البخاري ومسلم»
// out of «والحديث صحيح رواه البخاري ومسلم» and «والحديث صحيح» is left standing as this answer's
// own grading. So nothing of the sentence is kept here EXCEPT the quoted narration itself. The
// grading goes, the credit goes, the commentary goes; what remains is a quotation that asserts
// nothing about who published it and carries no grade — which is «كما كانَ قبلَ بنائِنا» exactly.
//
// ── WHAT COUNTS AS A MATN, AND WHY IT IS THESE THREE SHAPES AND NOT A GUESS ──
//   A. the inner text of a `<hadith>` card — the tag IS the claim that this is a narration, and
//      it is the shape the app's own instruction asks the model for;
//   B. a «…» run in a sentence that says whose words they are («قال النبي ﷺ», «عن النبي», «في
//      الحديث»), because a quotation frame plus a prophetic frame is a narration being reported;
//   C. a run introduced by a colon after that same prophetic frame, ending at the last separator
//      before the credit — the measured shape «وجاء في الحديث: … ، وقد صححه فلان.»
//
// A RUN THAT CARRIES THE UNSUPPORTED CREDIT INSIDE IT IS NOT SALVAGED. Keeping it would ship the
// very phrase this module exists to remove, wearing quotation marks.
//
// AND NO LETTER OF THE MATN IS ADDED OR DROPPED. Shapes A and C arrive without quotation marks
// and are given «», which is the mark that says «this is quoted and not ours» — the same thing
// lib/takhrij.js's own `dissolveBare` writes when it dissolves a card. Inner whitespace of a card
// is folded to single spaces so the salvaged matn stays on the line it stood on; no letter moves.

/** A quotation of fewer than this many words is a title or a phrase, not a narration. */
const MIN_MATN_WORDS = 4;
/** The frames that say the quoted words are the Prophet's ﷺ. Folded, as `tokenize` folds. */
const PROPHET_FRAME = [
  'النبي', 'نبينا', 'رسول الله', 'المصطفى',
  'صلى الله عليه وسلم', 'عليه الصلاة والسلام', 'عليه السلام',
  'الحديث', 'حديث', 'روي', 'ورد', 'جاء في',
  // THIRD ORDER, STEP 2 — «وأخرجه البخاري أيضا بلفظ: «…»» names the WORDING of a narration, and
  // the joined verb now condemns that sentence; its quotation is the matn and must survive it.
  'بلفظ', 'ولفظه', 'بلفظه',
];
const QUOTED_RUN_RE = /[«"“]([^«»"“”]+)[»"”]/gu;

function carriesProphetFrame(body) {
  const folded = norm(body);
  return PROPHET_FRAME.some((frame) => folded.indexOf(norm(frame)) !== -1);
}

const CARD_INNER_RE = /^<hadith\b[^>]*>([\s\S]*?)<\/hadith\s*>$/iu;

/**
 * The one run of a doomed sentence that must survive it, as an EDIT over `s`.
 *
 * @param {string} s           the whole arriving text
 * @param {{start:number,end:number}} sen   the sentence the takhrij rule has condemned
 * @param {Array} unsupported  the spans that condemned it, in `sen`-relative offsets
 * @returns {{keep:{start:number,end:number,insert:string}, matn:string}|null}
 */
// ── BATCH 4 [b26] · A QUOTATION STAYS WITH ITS FRAME, OR GOES WITH ITS CREDIT ──────────────
// MEASURED (T10 of the battery, «أجرة الحجام»): «ما رواه ابن حبان أنّ أبا محصن استأذن النبيَّ ﷺ… فلما
// أكثر عليه قال: "أطعمه رقيقك…"، ولو كان حرامًا…» was condemned for its credit and the reader got
// «"أطعمه رقيقك واعلفه ناضحك"» alone on a line — a matn with nobody saying it. And «8. إسلام
// الكافر: لحديث قيس… (رواه…» handed shape C a «run» that began with «لحديث» and ended on «(».
// THE OWNER'S RULING: the matn that is truly quoted stays WITH ITS FRAME or goes with its credit.
// So where a whole sentence is condemned (`framed`), shapes B and C keep the words that frame the
// quotation — from the sentence's start to the quotation's end — when that frame carries no
// condemned span and no grade of its own and names the Prophet ﷺ; otherwise the quotation goes
// with its sentence. A run opening on «لحديث»، «لما روى»، «لما ثبت» is a reference to evidence,
// not a matn, and a run holding a bracket is not a matn either. The card (shape A) is unchanged.
// The evidence-tail callers keep the unframed salvage: there the ruling stands in front of it.
const NOT_A_MATN_OPENERS = ['لحديث', 'لما روى', 'لما ثبت', 'لما رواه', 'لما في'].map((p) => norm(p));
const opensAsReference = (run) => {
  const f = ' ' + tokenize(run).map((t) => t.bare).join(' ') + ' ';
  return NOT_A_MATN_OPENERS.some((p) => f.startsWith(' ' + p + ' '));
};
function frameCarriesAGrade(frame) {
  return bareGradeSpans(frame).some((sp) => !speaksOfAGenus(frame, sp));
}
function matnToSalvage(s, sen, unsupported, { framed = false } = {}) {
  const body = s.slice(sen.start, sen.end);
  const clear = (from, to) => unsupported.every((sp) => sp.end <= from || sp.start >= to);
  const enough = (run) => run.trim().split(/\s+/u).filter(Boolean).length >= MIN_MATN_WORDS;
  const endMark = (body.match(/([.؟!]+)\s*$/u) || ['', ''])[1];
  // A quotation the draft itself opened its sentence with has no frame to keep: it stays as written.
  const frameOk = (at) => !/\S/u.test(body.slice(0, at)) || clear(0, at) && carriesProphetFrame(body.slice(0, at))
    && !frameCarriesAGrade(body.slice(0, at))
    && (body.slice(0, at).match(/«/gu) || []).length === (body.slice(0, at).match(/»/gu) || []).length;

  // A · the card. Its takhrij lives in the ATTRIBUTES, so the inner text is the narration.
  CARD_ATOM_RE.lastIndex = 0;
  let card;
  while ((card = CARD_ATOM_RE.exec(s)) !== null) {
    if (card.index < sen.start || card.index + card[0].length > sen.end) continue;
    const inner = (card[0].match(CARD_INNER_RE) || [])[1] || '';
    const matn = inner.replace(/\s+/gu, ' ').trim();
    const innerAt = card.index + card[0].indexOf(inner) - sen.start;
    if (!matn || !enough(matn) || !clear(innerAt, innerAt + inner.length)) continue;
    CARD_ATOM_RE.lastIndex = 0;
    return {
      keep: { start: card.index, end: card.index + card[0].length, insert: '«' + matn + '»' },
      matn,
    };
  }

  if (!carriesProphetFrame(body)) return null;

  // B · a quoted run, kept exactly as it stands, marks and all.
  QUOTED_RUN_RE.lastIndex = 0;
  let quoted;
  while ((quoted = QUOTED_RUN_RE.exec(body)) !== null) {
    const at = quoted.index;
    if (!enough(quoted[1]) || !clear(at, at + quoted[0].length)) continue;
    if (framed) {
      if (!frameOk(at)) continue;
      QUOTED_RUN_RE.lastIndex = 0;
      return {
        keep: { start: sen.start, end: sen.start + at + quoted[0].length,
          insert: body.slice(0, at) + quoted[0] + endMark },
        matn: quoted[1].trim(),
      };
    }
    QUOTED_RUN_RE.lastIndex = 0;
    return {
      keep: { start: sen.start + at, end: sen.start + at + quoted[0].length, insert: quoted[0] },
      matn: quoted[1].trim(),
    };
  }

  // C · «وجاء في الحديث: … ، وقد صححه فلان.» — after the colon, and it stops at the last
  // separator standing before the credit, so no clause of the answer's own travels with it.
  const colon = body.search(INTRODUCTION_RE);
  if (colon < 0) return null;
  const firstSpan = unsupported.reduce((lo, sp) => Math.min(lo, sp.start), body.length);
  if (firstSpan <= colon + 1) return null;
  const window = body.slice(colon + 1, firstSpan);
  const cut = Math.max(window.lastIndexOf('،'), window.lastIndexOf('؛'), window.lastIndexOf(','));
  const run = cut >= 0 ? window.slice(0, cut) : window;
  const lead = run.length - run.replace(/^\s+/u, '').length;
  const matn = run.trim();
  if (!matn || !enough(matn)) return null;
  const at = colon + 1 + lead;
  if (!clear(at, at + matn.length)) return null;
  // BATCH 4 [b26] — a reference to evidence is not a matn, and a matn holds no bracket.
  if (opensAsReference(matn) || /[()]/u.test(matn)) return null;
  if (framed) {
    if (!frameOk(at)) return null;
    return {
      keep: { start: sen.start, end: sen.start + at + matn.length,
        insert: body.slice(0, at) + '«' + matn + '»' + endMark },
      matn,
    };
  }
  return {
    keep: { start: sen.start + at, end: sen.start + at + matn.length, insert: '«' + matn + '»' },
    matn,
  };
}

// ── ١١١ STEP 6 · THE EVIDENCE TAIL GOES, THE RULING BEFORE IT STAYS ─────────────
//
// THE OWNER'S DECISION 2, CONDITIONAL ON A MEASURED ZERO. Chain A (d86f028) withdrew a false
// licence from «متفق عليه», and with it went a ruling whose only fault was the claim behind it:
//
//     «ويجب على المرأة أن لا تسافر بلا محرم، لما ثبت في الصحيحين من نهي النبي ﷺ عن ذلك.»
//
// When EVERY unsupported span of a sentence stands in a tail that opens after a comma with one
// of the particles below and runs to the sentence's end, that tail is cut and the ruling keeps
// its end mark: «ويجب على المرأة أن لا تسافر بلا محرم.» «في الصحيحين» goes and does not come
// back, so no licence is restored — the ruling simply stops claiming a source it cannot show.
// A quotation inside the tail is salvaged as the whole-sentence rule salvages it, and step 5
// applies to it. Anything else — a span before the comma, no particle, a head under three
// words or ending on a preposition or a conjunction, a frozen text in the tail — is the
// whole-sentence rule, unchanged.
// SECOND ORDER, STEP 2 — «لما رواه» / «كما أخرجه» are the same tail as «لما روى», with the
// narrator verb in the form `takhrijSpans` reads. Before step 2 a salutation beside them hid the
// credit from this lock; judged now, they must reach this rule and not the whole-sentence one.
const EVIDENCE_PARTICLES = ['لما ثبت', 'لما روى', 'لما في', 'لحديث', 'لقوله', 'لقول النبي',
  'كما في', 'كما ثبت', 'كما روى', 'كما جاء في', 'بدليل',
  'لما رواه', 'لما أخرجه', 'كما رواه', 'كما أخرجه',
  // THIRD ORDER, STEP 2 — the active verb, now that `takhrijSpans` reads it.
  'لما أخرج', 'كما أخرج', 'وقد روى',
  // SECOND ORDER, STEP 3 — the verbs that credit a VERDICT to somebody rather than a proof. «حديث
  // «…» حديث موضوع، أورده ابن الجوزي في الموضوعات.» loses the tail and keeps the verdict (the
  // owner's decision 1); what is left is then judged by the rules already in force — a verdict of
  // fabrication stays, a positive grade with no source takes its sentence (step 4).
  'أورده', 'ذكره', 'قاله', 'قال ذلك', 'حكم عليه', 'نص عليه', 'كما قال', 'كما ذكر'].map((p) => norm(p).split(' '));
const DANGLING_HEAD_END = new Set(['من', 'الى', 'الي', 'عن', 'على', 'علي', 'في', 'ب', 'ل', 'ك',
  'حتى', 'حتي', 'مع', 'عند', 'بعد', 'قبل', 'بين', 'دون', 'و', 'ف', 'ثم', 'او', 'ام', 'بل',
  'لكن', 'ان', 'لان', 'كما', 'لا', 'اذا', 'الا']);
/**
 * The evidence tail of one condemned sentence, or null.
 * @returns {{from:number,to:number,mark:string}|null}  `from` is the comma, `to` the end of
 *   the sentence's words, both `body`-relative; `mark` the end mark the ruling keeps.
 */
// FOURTH ORDER [r41] THREE — THE SAME RULE IN THE LOCK. Measured on the 154 drafts at 2aaf987:
// the only rulings this branch lost that `main` kept were three of step 6's own negatives —
// «ويجب الوضوء للصلاة، وهذا ثابت في الصحيحين.»، «ويحرم، لما ثبت في الصحيحين.» and «والصلاة واجبة
// على المسلم و، لما ثبت في الصحيحين.» — and `main` kept them only by licensing «في الصحيحين» off a
// page that names both Shaykhs elsewhere, the defect of 20 September. The claim must still go; the
// ruling need not go with it:
//   · a tail may open on a back-reference to the evidence («، وهذا ثابت في…») where the LOCK asks.
//     The lock's spans are `takhrijSpans` and carry a `kind`; the grade rule's carry a `shape`
//     and keep their own clause rule above, so the default is read off the spans and neither call
//     site changes (both are mutant seams in guards/takhrij-lock-guard.cjs). And only where no
//     separator stands between the back-reference and the credit: in RAW-F16 «، وهذا خلاف مشهور،
//     لكن …» points at the dispute, not at «كما رواه البخاري» three clauses later;
//   · a head of one or two words is a ruling when it holds a ruling word — «ويحرم» is a verb with
//     its subject in it, a whole sentence, not a hole; any other short head is refused as before;
//   · a lone conjunction the draft left before the comma («… المسلم و،») is not the ruling's last
//     word: the cut starts before it. A preposition there («يحافظ على،») is still refused whole.
const LONE_CONJUNCTIONS = new Set(['و', 'ف', 'ثم', 'او', 'ام']);
function trailingEvidenceTail(body, unsupported,
  { backReference = unsupported.every((sp) => typeof sp.kind === 'string') } = {}) {
  if (!unsupported.length) return null;
  const first = unsupported.reduce((lo, sp) => Math.min(lo, sp.start), body.length);
  const markM = body.match(/([.؟!]+)\s*$/u);
  const to = markM ? body.length - markM[0].length : body.length - (body.match(/\s*$/u) || [''])[0].length;
  const mark = markM ? markM[1] : '';
  for (let at = first - 1; at >= 0; at -= 1) {
    const ch = body[at];
    if (ch !== '،' && ch !== ',') continue;
    const lead = tokenize(body.slice(at + 1)).map((t) => t.bare);
    const opens = EVIDENCE_PARTICLES.some((p) => p.every((w, k) => lead[k] === w))
      || (backReference && BACK_REFERENCES.has(lead[0]) && !/[،؛,:]/u.test(body.slice(at + 1, first)));
    if (!opens) continue;
    const head = tokenize(body.slice(0, at));
    let from = at;
    if (head.length > 1 && LONE_CONJUNCTIONS.has(head[head.length - 1].bare)) {
      head.pop();
      from = head[head.length - 1].end;
    }
    const rulingHead = head.some((t) => RULING_WORDS.has(withoutConjunction(t.bare)));
    if (head.length < 3 && !(head.length && rulingHead)) return null;
    if (DANGLING_HEAD_END.has(head[head.length - 1].bare)) return null;
    if ((body.slice(0, at).match(/«/gu) || []).length !== (body.slice(0, at).match(/»/gu) || []).length) return null;
    // An āyah in the tail is never cut. The salutation «صلى الله عليه وسلم» is itself a frozen
    // dhikr run, so the test is for the Qur'an by kind and by its brackets, not for any run.
    const frozenInTail = containsFrozenRun(body.slice(at, to));
    if ((frozenInTail && frozenInTail.kind === 'quran') || /[﴾﴿]/u.test(body.slice(at, to))) return null;
    return { from, to, mark };
  }
  return null;
}

// ── ١١١ SECOND ORDER, STEP 2 · THE SALUTATION IS FROZEN, NOT A SHIELD ──────────────
//
// MEASURED on main and at a23a737 alike: «رواه البخاري أن النبي صلى الله عليه وسلم نهى عن ذلك…»
// passed this lock with no page behind it. «النبي صلى الله عليه وسلم» is a run of a known dhikr
// (lib/frozen-text.js), the attribution span reaches three words past «رواه» and overlaps it, and
// the exemption written for the adhkār and the āyāt waved the credit through. An unsourced
// ascription reached the reader because the Prophet was named with his salutation beside it.
//
// The freeze protects the LETTERS of the salutation; it never exempted an attribution from its
// proof. So a frozen run that is frozen ONLY because it holds «صلى الله عليه وسلم» — fewer than
// the three words that make a frozen run, once the salutation is taken out — is set aside and the
// sentence is searched again for a real frozen text; the rules below (the whole sentence, the
// evidence tail, the matn salvage) then apply exactly as they do to any other attribution. No
// letter of the salutation is ever edited: every cut in this file keeps or removes whole ranges.
const SALUTATION_WORDS = norm('صلى الله عليه وسلم').split(' ');
function isBareSalutationRun(phrase) {
  const words = norm(phrase).split(' ').filter(Boolean);
  for (let k = 0; k + SALUTATION_WORDS.length <= words.length; k += 1) {
    if (SALUTATION_WORDS.every((w, j) => words[k + j] === w)) {
      return words.length - SALUTATION_WORDS.length < MIN_FROZEN_WORDS;
    }
  }
  return false;
}
function frozenRunBesideSalutation(body) {
  let masked = String(body);
  for (let tries = 0; tries < 8; tries += 1) {
    const run = containsFrozenRun(masked);
    if (!run || !isBareSalutationRun(run.phrase)) return run;
    masked = masked.slice(0, run.start) + ' '.repeat(run.end - run.start) + masked.slice(run.end);
  }
  return null;
}

// ── THIRD ORDER, STEP 1-C · A LIST ITEM TAKES ITSELF, NOT THE LIST — AND ITS CREDIT, NOT ITS RULING ──
//
// MEASURED on the owner's preview: «نواقض الوضوء ثمانية عند أهل العلم…» and a card of FIVE items.
// The raw draft is not on disk, but the mechanism reproduces at 030da4b on the shapes the model
// writes: an item that carries an unproven credit — «- أكل لحم الإبل: لقوله ﷺ: «…» (متفق عليه)»,
// «- أكل لحم الإبل <hadith narrator="رواه مسلم">…</hadith>» — is a sentence to this lock, and the
// whole-sentence rule took the item WITH its ruling. And a one-line list («… والعقل والبلوغ لحديث
// «…» رواه أبو داود، والحرية، والاستطاعة …») is ONE sentence, so a single credit took every item.
//
// So inside a list item the unit is the ITEM, and inside the item only the credit goes:
//   * the credit is a bracket «(متفق عليه)» ⟶ the bracket goes;
//   * the credit is the attributes of a <hadith> card ⟶ the card dissolves into «its matn»;
//   * otherwise ⟶ from the credit to the end of the item goes.
// The ruling before it stays verbatim. Refused — and the rules below apply unchanged — where the
// item carries a GRADE (X-013/ز: a grading left in the answer's own voice), where the cut would
// take a matn or an āyah with it, or where nothing but a dangling word would be left in front.
const LIST_LINE_RE = /^[ \t]*(?:[-*•]|\d{1,2}[.)-]|[\u0660-\u0669]{1,2}[.)-])\s/u;
const BARE_NUMERAL_LINE_RE = /^[ \t]*(?:\d{1,2}|[\u0660-\u0669]{1,2})[.)-]?[ \t]*$/u;
function insideSteps(s, at) {
  const open = s.lastIndexOf('<steps', at);
  return open >= 0 && s.lastIndexOf('</steps', at) < open;
}
function isListItemLine(s, at) {
  const lineStart = s.lastIndexOf('\n', at - 1) + 1;
  const lineEnd = s.indexOf('\n', at) < 0 ? s.length : s.indexOf('\n', at);
  if (LIST_LINE_RE.test(s.slice(lineStart, lineEnd))) return true;
  if (insideSteps(s, at)) return true;
  // «7.» alone on its line, the item on the next — the shape deliverableText leaves a numbered list in.
  let prevEnd = lineStart - 1;
  while (prevEnd > 0) {
    const prevStart = s.lastIndexOf('\n', prevEnd - 1) + 1;
    const prev = s.slice(prevStart, prevEnd);
    if (prev.trim()) return BARE_NUMERAL_LINE_RE.test(prev);
    prevEnd = prevStart - 1;
  }
  return false;
}
/** Top-level «،» positions of a body: outside «…», ﴿…﴾, (…) and tags. */
function topLevelCommas(body) {
  const out = []; let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '«' || c === '﴿' || c === '(' || c === '<') depth += 1;
    else if ((c === '»' || c === '﴾' || c === ')' || c === '>') && depth > 0) depth -= 1;
    else if (depth === 0 && (c === '،' || c === ',')) out.push(i);
  }
  return out;
}
function listItemCut(s, sen, body, unsupported) {
  if (!unsupported.length || unsupported.some((sp) => sp.kind !== 'attribution')) return null;
  if (bareGradeSpans(body).length || takhrijSpans(body).some((sp) => sp.kind === 'grade')) return null;
  const lead = body.length - body.replace(/^\s+/u, '').length;
  const markM = body.match(/([.؟!]+)?\s*$/u);
  const bodyEnd = body.length - (markM ? markM[0].length : 0);
  let unit = null;
  if (isListItemLine(s, sen.start + lead)) unit = { from: lead, to: bodyEnd };
  else {
    const commas = topLevelCommas(body.slice(0, bodyEnd));
    if (commas.length >= 2) {
      const first = Math.min(...unsupported.map((sp) => sp.start));
      const last = Math.max(...unsupported.map((sp) => sp.end));
      const from = commas.filter((c) => c < first).pop();
      const to = commas.find((c) => c >= last);
      if (from !== undefined) unit = { from: from + 1, to: to === undefined ? bodyEnd : to };
    }
  }
  if (!unit) return null;
  if (unsupported.some((sp) => sp.start < unit.from || sp.end > unit.to)) return null;
  // a <hadith> card whose attributes carry every unsupported span: it dissolves into its matn.
  CARD_ATOM_RE.lastIndex = 0;
  let card;
  while ((card = CARD_ATOM_RE.exec(body)) !== null) {
    const openEnd = card.index + card[0].indexOf('>') + 1;
    if (!unsupported.every((sp) => sp.start >= card.index && sp.end <= openEnd)) continue;
    const inner = ((card[0].match(CARD_INNER_RE) || [])[1] || '').replace(/\s+/gu, ' ').trim();
    CARD_ATOM_RE.lastIndex = 0;
    if (!inner) return null;
    const pad = card.index > 0 && !/\s/u.test(body[card.index - 1]) ? ' ' : '';
    return { cuts: [{ start: sen.start + card.index, end: sen.start + card.index + card[0].length, insert: pad + '«' + inner + '»' }],
      matn: inner };
  }
  const first = Math.min(...unsupported.map((sp) => sp.start));
  let cutFrom = first; let cutTo = unit.to;
  // the credit is a whole bracket: the bracket goes, and only the bracket.
  const open = body.lastIndexOf('(', first);
  const close = body.indexOf(')', first);
  const lastEnd = Math.max(...unsupported.map((sp) => sp.end));
  if (open >= unit.from && close >= lastEnd && close < unit.to
    && !/\S/u.test(body.slice(open + 1, first)) && !/[^\s.،,]/u.test(body.slice(lastEnd, close))) {
    cutFrom = open; cutTo = close + 1;
  }
  while (cutFrom > unit.from && /[ \t]/u.test(body[cutFrom - 1])) cutFrom -= 1;
  const kept = body.slice(unit.from, cutFrom);
  const keptWords = tokenize(kept);
  if (!keptWords.length || DANGLING_HEAD_END.has(keptWords[keptWords.length - 1].bare)) return null;
  const gone = body.slice(cutFrom, cutTo);
  if (/[﴾﴿]|<hadith/iu.test(gone)) return null;
  QUOTED_RUN_RE.lastIndex = 0;
  let q;
  while ((q = QUOTED_RUN_RE.exec(gone)) !== null) {
    if (q[1].trim().split(/\s+/u).length >= MIN_MATN_WORDS) { QUOTED_RUN_RE.lastIndex = 0; return null; }
  }
  if ((kept.match(/«/gu) || []).length !== (kept.match(/»/gu) || []).length) return null;
  return { cuts: [{ start: sen.start + cutFrom, end: sen.start + cutTo, insert: '' }], matn: '' };
}

// ── ١١١ BATCH 4 [b26] · THE SEAL CUTS THE CREDIT AND NEVER EATS THE RULING ─────────────────
//
// MEASURED at 92d3c7d, in production today, on the 154 drafts and the owner's battery:
//   «والحج واجب على المستطيع، لقوله تعالى: ﴿…﴾ رواه البخاري.»   → the whole sentence went
//   «ويجب غسل الجمعة على كل محتلم (رواه البخاري).»              → the whole sentence went
//   «8. إسلام الكافر: لحديث قيس… بماء وسدر (رواه أبو داود…).»   → «8. «لحديث قيس… (»»
//   one-line <steps> of the five conditions of Hajj, «…» رواه أبو داود in item 2 → all five went
// The credit was the only thing false in each; the ruling paid for it.
//
// THE OWNER'S RULING: the unsourced credit goes ALONE, and the ruling stays a whole sentence with
// no hole. So before any whole-sentence rule, the credit is cut by itself where it can be cut by
// itself — and it can only where it stands APART from what it credits:
//   (a) it opens a bracket — «(رواه أبو داود والترمذي، وهو حديث صحيح)» — and the bracket goes,
//       with whatever grade it holds;
//   (b) it trails what it credits — after a separator, or after the closing mark of the quotation
//       or the āyah — and runs to the sentence's end, to a separator, or to an inline list marker,
//       with nothing after the verb but the collectors' names and the words a credit is written in.
// A credit that is the sentence's own verb («ما رواه ابن حبان أنّ…») is not apart from anything;
// the rules below take that sentence as they always did. Refused, and the rules below apply
// unchanged, where the word left in front of the cut dangles («يحافظ على،»), where «» would be
// left unbalanced, or where a grade would be left in the answer's own voice (X-013/ز) and it is
// not a trailing clause of a ruling that can go with the credit.
const CREDIT_TAIL_WORDS = new Set([...COLLECTORS_ONE, ...COLLECTORS_TWO.flat(),
  ...['في', 'صحيحه', 'صحيحيهما', 'سننه', 'مسنده', 'غيره', 'غيرهما', 'غيرهم', 'اللفظ', 'له', 'لمسلم',
    'للبخاري', 'وهو', 'حديث', 'صحيح', 'حسن', 'ماجه', 'داود', 'حبان', 'خزيمة', 'النسائي', 'ابو', 'ابن',
    // [b12] — the graders a grade credit names
    'الألباني', 'النووي', 'الذهبي', 'حجر', 'العراقي', 'المنذري', 'شاكر']
    .map((w) => norm(w))]);
// «أورده فلان في الموضوعات» credits a VERDICT, not a proof (second order, step 3): it is never
// cut alone, and neither is anything in a sentence judging its text fabricated — the verdict stays
// with its matn by the rules below.
const CREDIT_ONLY_VERBS = new Set([...ATTRIB_VERBS].filter((v) => v !== 'اورده'));
// BATCH 4 [b12] — and a grade credited to a named grader («، وصحّحه ابن حبان») is a credit too: it
// stands apart from the ruling it follows exactly as «، رواه أبو داود» does, and goes alone.
const isCreditSpan = (sp) => (sp.kind === 'attribution'
  && (CREDIT_ONLY_VERBS.has(String(sp.phrase).split(' ')[0]) || sp.phrase === 'متفق عليه'))
  || (sp.kind === 'grade' && GRADE_VERBS.has(String(sp.phrase).split(' ')[0]));
// A clause after the credit that points back at it, or speaks of soundness, leans on the credit:
// «متفق عليه، فهو في أعلى درجات الصحة» without its credit is a grading in the answer's own voice.
const LEANS_ON_CREDIT = new Set([...GRADE_WORDS,
  ...['الصحة', 'صحته', 'درجات', 'درجة', 'ثبوت', 'ثبوته', 'الشيخين', 'الشيخان', 'الصحيحين'].map((w) => norm(w))]);
function creditOnlyCut(s, sen, body, unsupported) {
  if (!unsupported.length || !unsupported.every(isCreditSpan)) return null;
  if (carriesFabricationVerdict(body) || namesAJudgingBook(body)) return null;
  // ...nor where its quotation is one the answer elsewhere judges fabricated (step 5).
  for (const q of body.matchAll(QUOTED_RUN_RE)) {
    if (q[1].trim().split(/\s+/u).length >= MIN_MATN_WORDS && salvageIsFabricated(s, body, q[1])) return null;
  }
  const ranges = [];
  for (const sp of unsupported) {
    // A credit inside a tag's attributes is the card's, and the card has its own rule (step 1-C).
    if (body.lastIndexOf('<', sp.start) > body.lastIndexOf('>', sp.start)) return null;
    // (a) the credit opens a bracket.
    const open = body.lastIndexOf('(', sp.start);
    if (open >= 0 && body.lastIndexOf(')', sp.start) < open && !/\S/u.test(body.slice(open + 1, sp.start))) {
      const close = body.indexOf(')', sp.end);
      if (close < 0) return null;
      const inner = body.slice(sp.end, close);
      if (/[«»"“”﴿﴾(<]/u.test(inner) || tokenize(inner).length > 8) return null;
      let from = open;
      while (from > 0 && /[ \t]/u.test(body[from - 1])) from -= 1;
      ranges.push({ from, to: close + 1 });
      continue;
    }
    // (b) the credit trails what it credits. A «و»/«ف» written onto the verb («، وصحّحه …»،
    // «، ورواه …») is the credit's own conjunction and goes with it.
    const glued = sp.start > 0 && /[وف]/u.test(body[sp.start - 1]) && (sp.start < 2 || !ARABIC_LETTER_RE.test(body[sp.start - 2]));
    const before = body.slice(0, glued ? sp.start - 1 : sp.start);
    const lead = before.match(/(?:([،,؛])|[»"”﴾])\s*$/u);
    if (!lead) return null;
    const rest = body.slice(sp.end);
    const stop = rest.match(/^[^«»"“”﴿﴾<()،,؛.؟!:\n]*?(?=\s+[-–•]\s|[،,؛.؟!\n]|\s*$)/u);
    if (!stop) return null;
    if (!tokenize(stop[0]).every((t) => CREDIT_TAIL_WORDS.has(withoutConjunction(t.bare)))) return null;
    const after = rest.slice(stop[0].length);
    if (/^\s+[-–•]\s/u.test(after) && !insideSteps(s, sen.start + sp.start)
      && !isListItemLine(s, sen.start + sp.start)) return null;
    if (/^\s*[،,؛]/u.test(after)) {
      const next = tokenize(after).map((t) => t.bare);
      if (next.length && (BACK_REFERENCES.has(next[0]) || BACK_REFERENCES.has(withoutConjunction(next[0])))) return null;
      if (next.some((w) => LEANS_ON_CREDIT.has(withoutConjunction(w)))) return null;
    }
    const from = lead[1] ? before.length - lead[0].length : before.replace(/\s+$/u, '').length;
    ranges.push({ from, to: sp.end + stop[0].length });
  }
  const merge = (list) => {
    const out = [];
    for (const r of [...list].sort((a, b) => a.from - b.from)) {
      const last = out[out.length - 1];
      if (last && r.from <= last.to) last.to = Math.max(last.to, r.to); else out.push({ ...r });
    }
    return out;
  };
  let merged = merge(ranges);
  const keptOf = (list) => {
    let kept = ''; const map = []; let k = 0;
    for (const r of list) { for (let q = k; q < r.from; q += 1) { map.push(q); kept += body[q]; } k = r.to; }
    for (let q = k; q < body.length; q += 1) { map.push(q); kept += body[q]; }
    return { kept, map };
  };
  for (const r of merged) {
    const words = tokenize(body.slice(0, r.from));
    if (words.length < 2 || DANGLING_HEAD_END.has(words[words.length - 1].bare)) return null;
  }
  let { kept, map } = keptOf(merged);
  if ((kept.match(/«/gu) || []).length !== (kept.match(/»/gu) || []).length) return null;
  // X-013/ز — the credit may not leave a grade standing in the answer's own voice. A verdict of
  // fabrication stays with its matn (step 5); a class named in usul talk is no grade (r42).
  const graded = bareGradeSpans(kept).filter((sp) => !sp.attributive
    && !(sp.shape === 'matn' && FABRICATION_GRADES.has(String(sp.phrase).split(' ').pop()))
    && !speaksOfAGenus(kept, sp));
  if (graded.length) {
    const clause = trailingGradeClause(kept, graded);
    const lines = s.split('\n');
    const li = s.slice(0, sen.start).split('\n').length - 1;
    if (!clause || !carriesARuling(lines, li, kept, clause.from)) return null;
    merged = merge([...merged, { from: map[clause.from], to: map[clause.to - 1] + 1 }]);
    ({ kept, map } = keptOf(merged));
  }
  if (!/[ء-ي]/u.test(kept)) return null;
  return merged.map((r) => ({ start: sen.start + r.from, end: sen.start + r.to, insert: '' }));
}

/**
 * THE LOCK.
 *
 * @param {string} text          the drafted reply, or one drafted sentence
 * @param {Array} sources        the retrieved pages ({passage|text|authorialText, title} or strings)
 * @returns {{text:string, removed:Array, droppedSentences:Array}}
 */
export function lockTakhrij(text, sources) {
  const s = String(text == null ? '' : text);
  if (!s.trim()) return { text: s, removed: [], droppedSentences: [], outcome: 'CLEAN', degraded: [], repairAttempted: false, salvagedMatns: [] };
  const hay = haystack(sources);

  const removed = [];
  const droppedSentences = [];
  // Every edit is collected as an offset range first and applied once, from the end backwards, so
  // that no edit can move the offsets of another.
  const cuts = [];
  // The ranges a salvaged matn occupies. Nothing else — least of all an orphaned lead-in, which
  // is a whole LINE — may be allowed to remove them afterwards.
  const keeps = [];
  const salvagedMatns = [];
  let evidenceTailCuts = 0;
  let listItemCuts = 0;
  let creditOnlyCuts = 0;
  const creditOnlyRanges = new Set();

  for (const sen of sentences(s)) {
    const body = s.slice(sen.start, sen.end);
    const spans = takhrijSpans(body);
    if (!spans.length) continue;

    // THE FROZEN EXEMPTION, scoped to the frozen run itself. A span overlapping an āyah or a
    // known dhikr is left exactly where it is — and the salutation alone is neither (see
    // `frozenRunBesideSalutation`): an attribution beside it is judged as if it were not there.
    const frozen = frozenRunBesideSalutation(body);
    const overlapsFrozen = (sp) => !!frozen && sp.start < frozen.end && sp.end > frozen.start;

    const unsupported = spans.filter((sp) => !overlapsFrozen(sp) && !supported(sp.phrase, hay, body));
    if (!unsupported.length) continue;

    // X-013/ز — THE WHOLE SENTENCE GOES, AND MID-SENTENCE SURGERY IS GONE WITH IT.
    // This used to ask whether the sentence would survive losing its takhrij, and if it would, cut
    // out the offending phrase and ship the remainder. That is the defect. «رواه الترمذيُّ» removed
    // from «وحديثُ صلاةِ الليلِ حديثٌ صحيحٌ ثابتٌ رواه الترمذيُّ» does not leave a weaker claim —
    // it leaves «وحديثُ صلاةِ الليلِ حديثٌ صحيحٌ ثابتٌ», a grading that now reads as this answer's
    // own settled position, with the one attribution a reader could have checked quietly deleted.
    // Stronger, and falser, than the claim that failed. hybrid-deen's §7 majority gate already
    // reasons this way and rebuilds its whole summary rather than deleting the offending clause;
    // this is that rule generalised. The sentence is dropped whole, and what remains is REBUILT.
    //
    // ── AND THE MATN IS TAKEN OUT OF THE SENTENCE BEFORE THE SENTENCE GOES ──
    // The owner's §١ of 19 September. See `matnToSalvage` above for which run is the matn and
    // why it is those three shapes. What survives is the quotation ALONE: the credit, the grade
    // and every clause the answer built on them go with the sentence, so X-013/ز's defect — a
    // grading left standing in this answer's own voice — cannot come back through this door.
    // BATCH 4 [b26] — the credit alone, where it stands apart from what it credits.
    const creditCuts = creditOnlyCut(s, sen, body, unsupported);
    if (creditCuts) {
      cuts.push(...creditCuts);
      for (const c of creditCuts) creditOnlyRanges.add(c);
      creditOnlyCuts += 1;
      droppedSentences.push({ text: body.trim(), spans: unsupported.map((x) => x.phrase), cut: 'credit-only' });
      for (const sp of unsupported) removed.push({ kind: sp.kind, phrase: sp.phrase });
      continue;
    }
    // STEP 6 — the evidence tail, when every unsupported span stands in one.
    const evidenceTail = trailingEvidenceTail(body, unsupported);
    if (evidenceTail) {
      const inTail = matnToSalvage(s, sen, unsupported);
      const matn = inTail && inTail.keep.start >= sen.start + evidenceTail.from
        && !salvageIsFabricated(s, body, inTail.matn) ? inTail : null;
      // The cut stops BEFORE the sentence's own end mark, so the ruling keeps it untouched. A
      // salvaged quotation is set after the ruling as a sentence of its own, never glued to it.
      const insert = matn ? (evidenceTail.mark || '.') + ' ' + matn.keep.insert : '';
      const cut = { start: sen.start + evidenceTail.from, end: sen.start + evidenceTail.to, insert };
      cuts.push(cut);
      keeps.push({ start: cut.start, end: cut.end });
      if (matn) salvagedMatns.push(matn.matn);
      evidenceTailCuts += 1;
      droppedSentences.push({ text: body.trim(), spans: unsupported.map((x) => x.phrase), cut: 'evidence-tail' });
      for (const sp of unsupported) removed.push({ kind: sp.kind, phrase: sp.phrase });
      continue;
    }
    // THIRD ORDER, STEP 1-C — a list item keeps its ruling; see `listItemCut`.
    const item = listItemCut(s, sen, body, unsupported);
    if (item) {
      for (const c of item.cuts) { cuts.push(c); keeps.push({ start: c.start, end: c.end }); }
      if (item.matn) salvagedMatns.push(item.matn);
      listItemCuts += 1;
      droppedSentences.push({ text: body.trim(), spans: unsupported.map((x) => x.phrase), cut: 'list-item' });
      for (const sp of unsupported) removed.push({ kind: sp.kind, phrase: sp.phrase });
      continue;
    }
    const salvage = matnToSalvage(s, sen, unsupported, { framed: true });
    // STEP 5 — W9's second bare copy came from HERE: «وقد رواه ابن عدي … بلفظ: «اطلبوا العلم ولو
    // بالصين…»» was condemned for its credit and its quotation salvaged, while the answer's own
    // first sentence says that text is fabricated. Such a matn goes with its sentence.
    if (salvage && !salvageIsFabricated(s, body, salvage.matn)) {
      const tail = s.slice(salvage.keep.end, sen.end);
      const tailEnd = sen.end - (tail.match(/\s*$/u) || [''])[0].length;
      if (salvage.keep.start > sen.start) cuts.push({ start: sen.start, end: salvage.keep.start, insert: '' });
      cuts.push({ ...salvage.keep });
      if (tailEnd > salvage.keep.end) cuts.push({ start: salvage.keep.end, end: tailEnd, insert: '' });
      keeps.push({ start: salvage.keep.start, end: salvage.keep.end });
      salvagedMatns.push(salvage.matn);
    } else {
      cuts.push({ start: sen.start, end: sen.end, insert: '' });
    }
    droppedSentences.push({ text: body.trim(), spans: unsupported.map((x) => x.phrase) });
    for (const sp of unsupported) removed.push({ kind: sp.kind, phrase: sp.phrase });
  }

  if (!cuts.length) {
    return { text: s, removed, droppedSentences, outcome: 'CLEAN', degraded: [], repairAttempted: false, salvagedMatns };
  }

  // ── THIRD ORDER, STEP 4-ج · «أيضا» DOES NOT OUTLIVE WHAT IT POINTED AT ───────────────
  // MEASURED on the preview, «الدين النصيحة»: «رواه مسلم» went with no page, and the sentence right
  // after it still read «ورواه أيضا أبو داود والترمذي والنسائي» — «also» after nothing. When a
  // sentence carrying an attribution is cut WHOLE and the very next sentence survives and opens on
  // a credit verb followed by «أيضا», that one word goes. Nowhere else is «أيضا» touched.
  const cutWhole = (sen) => {
    for (let k = sen.start; k < sen.end; k += 1) {
      if (/\s/u.test(s[k])) continue;
      if (!cuts.some((c) => c.start <= k && k < c.end)) return false;
    }
    return true;
  };
  const alsoCuts = [];
  const all = sentences(s);
  for (let k = 0; k + 1 < all.length; k += 1) {
    const here = all[k]; const next = all[k + 1];
    if (!takhrijSpans(s.slice(here.start, here.end)).length || !cutWhole(here)) continue;
    if (cuts.some((c) => c.start < next.end && c.end > next.start)) continue;
    const toks = tokenize(s.slice(next.start, next.end));
    if (toks.length < 2) continue;
    const first = toks[0].bare.replace(/^[وف](?=.)/u, '');
    if (!ATTRIB_VERBS.has(first) || !ALSO_WORDS.has(toks[1].bare)) continue;
    const from = next.start + toks[1].start;
    let to = next.start + toks[1].end;
    while (to < s.length && /[ \t]/u.test(s[to])) to += 1;
    alsoCuts.push({ start: from, end: to, insert: '' });
  }
  if (alsoCuts.length) { cuts.push(...alsoCuts); }

  // ── BATCH 4 [b26] · NO «فقال:» LEFT ANSWERING NOTHING ─────────────────────────────
  // MEASURED at 92d3c7d (S-W6a of the 154; «فقال:» يتيمة in the battery's T5): «أخرجه البخاري
  // ومسلم … أن رجلا سأل النبي ﷺ: أي المسلمين خير؟» went whole for its credit, and the reply after
  // it stayed — the answer opened on «فقال: «…»», a saying with no one saying it. When a sentence
  // carrying a credit is cut WHOLE and the very next sentence, untouched, opens on a verb of reply
  // and its colon with no subject between them («فقال:»، «قال له:»، «فقالت:»), that reply's frame
  // went with the sentence before it, so the reply goes too — the quotation goes with its credit.
  // Kept where the reply carries a ruling outside its quotation: the ruling is never the price.
  // Removed, not replaced: a sentence a salvage put back in its frame still frames its reply.
  const removedWhole = (sen) => {
    for (let k = sen.start; k < sen.end; k += 1) {
      if (/\s/u.test(s[k])) continue;
      if (!cuts.some((c) => !c.insert && c.start <= k && k < c.end)) return false;
    }
    return true;
  };
  const REPLY_VERBS = new Set(['قال', 'قالت', 'اجاب', 'اجابت', 'قيل'].map((w) => norm(w)));
  const ADDRESSEES = new Set(['له', 'لها', 'لهم', 'لهما']);
  let orphanReplies = 0;
  for (let k = 0; k + 1 < all.length; k += 1) {
    const here = all[k]; const next = all[k + 1];
    if (!takhrijSpans(s.slice(here.start, here.end)).length || !removedWhole(here)) continue;
    // The reply's own credit may have been cut alone; any other edit to it means it was judged.
    if (cuts.some((c) => !creditOnlyRanges.has(c) && c.start < next.end && c.end > next.start)) continue;
    const text = s.slice(next.start, next.end);
    const toks = tokenize(text);
    if (!toks.length || !REPLY_VERBS.has(withoutConjunction(toks[0].bare))) continue;
    const upTo = toks[1] && ADDRESSEES.has(toks[1].bare) ? toks[1].end : toks[0].end;
    if (!/^\s*[:：]/u.test(text.slice(upTo))) continue;
    const outside = text.replace(/[«"“][^«»"“”]*[»"”]/gu, ' ');
    if (tokenize(outside).some((t) => RULING_WORDS.has(withoutConjunction(t.bare)))) continue;
    cuts.push({ start: next.start, end: next.end, insert: '' });
    orphanReplies += 1;
  }

  // THE ONE MARKED REPAIR ATTEMPT: rebuild the reply from the sentences that survived. It is a
  // single deterministic pass, and whatever comes out of it is either sent WITH a degraded record
  // or refused outright — there is no third path where a shortened text leaves quietly.
  const degraded = [`takhrij-unsupported:${droppedSentences.length}`];
  // The lead-in of a block this cut removes goes with it — see `orphanedLeadInCuts`. It is added
  // AFTER the record above, because `takhrij-unsupported` counts unsupported takhrij and a lead-in
  // carries none: two different removals, counted separately, neither hidden inside the other.
  if (salvagedMatns.length) degraded.push(`takhrij-matn-kept:${salvagedMatns.length}`);
  if (evidenceTailCuts) degraded.push(`takhrij-evidence-tail:${evidenceTailCuts}`);
  if (listItemCuts) degraded.push(`takhrij-list-item:${listItemCuts}`);
  if (creditOnlyCuts) degraded.push(`takhrij-credit-only:${creditOnlyCuts}`);
  if (orphanReplies) degraded.push(`takhrij-orphan-reply:${orphanReplies}`);
  // A lead-in is orphaned by what the cut LEAVES, so it is asked of the text including every
  // salvaged matn — and a line still holding one was never orphaned, so it is never taken.
  const leadIns = orphanedLeadInCuts(s, cuts)
    .filter((cut) => keeps.every((k) => k.end <= cut.start || k.start >= cut.end));
  if (leadIns.length) {
    cuts.push(...leadIns.map((c) => ({ ...c, insert: '' })));
    degraded.push(`takhrij-orphaned-lead-in:${leadIns.length}`);
  }
  // Overlapping ranges are merged before a character is spliced. `sentences()` returns its ranges
  // disjoint, so for the takhrij cuts alone this is the same removal it always was; a lead-in cut
  // is a whole LINE and may contain one of them, and splicing the same characters twice would eat
  // the text that followed them.
  cuts.sort((a, b) => a.start - b.start);
  const spans = [];
  for (const c of cuts) {
    const last = spans[spans.length - 1];
    // Only REMOVALS merge. A salvaged matn is a replacement, and folding one into the removal
    // beside it would delete the matn the merge was supposed to carry.
    if (last && !last.insert && !c.insert && c.start <= last.end) {
      last.end = Math.max(last.end, c.end);
      continue;
    }
    spans.push({ start: c.start, end: c.end, insert: c.insert || '' });
  }
  let out = s;
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    out = out.slice(0, spans[i].start) + spans[i].insert + out.slice(spans[i].end);
  }
  // Tidy the punctuation the removal left behind — «… ركب»، .» is not a sentence a reader should
  // be shown. Whitespace and orphaned separators only; no word is ever added.
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    // A salvaged matn is spliced in where the prose that introduced it stood, so the quotation
    // can end up glued to the sentence beside it. WHITESPACE ONLY — the same licence the three
    // lines below already take, and no word, mark or letter is added by it.
    .replace(/([^\s])«/gu, '$1 «')
    .replace(/»([^\s،؛,.؟!:)\]»])/gu, '» $1')
    .replace(/\s+([،؛,.])/g, '$1')
    .replace(/([،؛,])\s*([.؟!])/g, '$2')
    .replace(/([،؛,])\s*$/gm, '.')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

  // AND THE EXPLICIT REFUSAL. If the rebuild left nothing a reader could call an answer, saying so
  // is the honest end of this path. Returning the stub would be the silent deletion in its last
  // and worst form: a reply that looks whole and has had its entire substance removed.
  // "Nothing substantive" means nothing at all. MIN_WORDS_AFTER is deliberately NOT reused here:
  // it measures what is left of ONE SENTENCE after an excision, and borrowing it as a whole-reply
  // floor refuses perfectly good short answers — «جوابٌ مفيد.» is two words and is an answer.
  if (!out.trim()) {
    degraded.push('takhrij-rebuild-empty');
    return { text: '', removed, droppedSentences, outcome: 'REFUSED', degraded, repairAttempted: true, salvagedMatns };
  }
  return { text: out, removed, droppedSentences, outcome: 'REBUILT', degraded, repairAttempted: true, salvagedMatns };
}
