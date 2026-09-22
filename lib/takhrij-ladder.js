// lib/takhrij-ladder.js — سلَّمُ التخريجِ: ٣٦ صفًّا، مقفلٌ ولا يُعادُ فتحُه (البند ٥٠ §٥).
//
// WHAT THIS FILE IS. The owner's closed ladder, and the ONE place that maps a library
// subject id to the name that may appear between the parentheses of a takhrij. Nothing
// else in this tree is allowed to name a مخرِّج, because a name written anywhere else is a
// name nobody measured.
//
// ── IT IMPORTS NOTHING, AND THAT IS A CONTRACT ─────────────────────────────
// Same rule lib/route-classify.js holds: a table a guard must be able to read without
// booting a service, a socket or an environment. Zero imports, zero process.env.
//
// ── EVERY ID BELOW WAS MEASURED, NOT COPIED ────────────────────────────────
// Read on 2026-09-19 out of the LIVE index's own `books` table — the index the service
// reports at GET https://lib.ezik.app/ready as `ezik-shamela-20260820` (atom_count
// 6796649), whose local twin is C:\EZIK-LIB\index\ezik-shamela-20260820.db (7400 books).
// The five ids the order pins in §٥ were checked first and all five are present; the
// remaining thirty-one were resolved BY INDEX TITLE, never by the ladder's own wording.
//
// ── AND THAT DISTINCTION IS THE WHOLE LESSON OF shamela-match-45.md ────────
// Matching on the ladder's phrasing returned ZERO for rows 7, 9, 29 and 36. All four are
// present under a different index title («سلسلة الأحاديث الصحيحة» is not «السلسلة
// الصحيحة»). So: match by id, else by the INDEX's title. Never by the ladder's.

// ── AND THIS SENTENCE IS A RULING, NOT A REPORT ABOUT OURSELVES (§١, ١٩ سبتمبر) ──
//
// THE OWNER READ IT ON HIS OWN SCREEN, under three hadiths that are IN THE TWO ṢAḤĪḤS:
// «الصلاة على وقتها…», «أحي والداك…», «الزمها فإن الجنة عند رجليها». It was printed because
// the FIRST revision of this file returned it whenever the library came back with nothing —
// and «the library came back with nothing» is news about US, not about the Prophet ﷺ.
//
//     بحثنا فوجدنا حاكما يقول: موضوع / لا أصل له   ⟸  (لا يثبت مرفوعا)
//     بحثنا فلم نجد شيئا                            ⟸  لا يُطبع شيء ألبتة
//
// So this string is now reachable ONLY through a stated ruling of a ladder GRADER — see
// `NOT_ESTABLISHED_GRADES` and the last branch of `composeParenthetical` — and a failed
// search returns `silent: true` with an EMPTY text, which the pass writes nowhere.
/** The inner text of the parentheses when a ladder grader ruled the matn unestablished. */
export const NOT_RAISED = 'لا يثبت مرفوعا';

/**
 * The stated rulings that mean «this does not stand as a saying of the Prophet ﷺ».
 *
 * It is a LIST AND NOT A TEST, and it is compared against `grade` fields written in this file
 * alone — never against text from a book. Two of the ladder's rows state such a ruling in their
 * own title (ضعيف الجامع, السلسلة الضعيفة); «موضوع» is here because a row that states it would
 * mean the same thing, and no row states it today.
 */
export const NOT_ESTABLISHED_GRADES = Object.freeze(['ضعيف', 'موضوع']);

/**
 * BATCH 4 [b34] — the rulings that, WRITTEN by a grader in its entry for a matn, mean «it does not
 * stand» whoever narrates it: «(لا يثبت مرفوعا)» (the owner's rule 34). And the weak rulings that
 * mean the same where no متن book narrates it at all (the ladder's «حاكم وحده بالضعف» row).
 */
export const FABRICATION_RULINGS = Object.freeze(['موضوع', 'باطل', 'لا أصل له']);
const WEAK_RULINGS = Object.freeze(['ضعيف جدا', 'منكر']);

/** The inner text when both Shaykhs carry it. */
export const AGREED_UPON = 'متفق عليه';

// ── AND THE SILENCE BELOW THE TWO SHAYKHS IS A CLAIM, SO IT IS FORBIDDEN ────
//
// THE OWNER MEASURED IT WITH HIS OWN FINGER on 19 September and ruled on it the same day
// (§٢ of the repair order): the answer carried
//
//     «الحج عرفة» (البيهقي)
//
// and البيهقي is BELOW the two Shaykhs. A collection named alone, with nothing after it, reads
// to a reader as «ثابت» — and no book said that. «والصمت في باب الحديث دعوى».
//
// SO: the two Ṣaḥīḥs may stand alone, because the name IS the ruling there — «(البخاري)»,
// «(مسلم)», «(متفق عليه)». Everything below them leaves with a suffix ALWAYS: the grade when a
// ladder grader stated one, and otherwise this sentence, which says in as many words that the
// ruling was not found rather than implying there was none to find.
//
// IT IS WRITTEN BARE, like NOT_RAISED above and for the same reason: a harakat sequence typed by
// hand is a sequence nobody measured, and these two strings are compared by guards byte for byte.
/** The suffix below the Shaykhayn when no ladder grader stated a ruling. */
export const NO_RULING = 'لم يوقف على حكم';

/**
 * The ladder. `display` is what may be written between the parentheses — the BOOK's or its
 * author's conventional short name, never the library's own name (§٢-ب/٥: الشاملةُ مستورة).
 *
 * `grade` is present ONLY on the rows whose own title states the ruling of everything inside
 * them. For every other grader the ruling is a judgement the book makes case by case, and
 * this file will not guess it — §٢-ب/٣: «عزك لا يخترع درجة أبدا».
 *
 * BATCH 4 [b34] — AND `grade` IS NO LONGER A GRADE. A title is not what a book wrote about a
 * matn: ضعيف الجامع's entry 3625 writes no ruling, السلسلة الضعيفة's entry 416 writes «باطل». The
 * field now names only which books the grade-narrowed call asks (`RULING_BOOK_IDS`); the grade
 * itself is read out of the entry (see `composeParenthetical`'s `rulings`).
 */
export const TAKHRIJ_LADDER = Object.freeze([
  { n: 1, ids: ['FC-000645'], display: 'البخاري', shaykh: true },
  { n: 2, ids: ['FC-000648'], display: 'مسلم', shaykh: true },
  { n: 3, ids: ['FC-000600', 'FC-000601'], display: 'مالك في الموطأ' },
  { n: 4, ids: ['FC-000684', 'FC-000685'], display: 'ابن خزيمة' },
  { n: 5, ids: ['FC-000774'], display: 'الضياء في المختارة' },
  { n: 6, ids: ['FC-000703', 'FC-000704'], display: 'ابن حبان' },
  { n: 7, ids: ['FC-002060'], display: 'السلسلة الصحيحة', grader: true, grade: 'صحيح' },
  { n: 8, ids: ['FC-002069'], display: 'الوادعي في الصحيح المسند', grader: true, grade: 'صحيح' },
  { n: 9, ids: ['FC-000674', 'FC-000673'], display: 'النسائي' },
  { n: 10, ids: ['FC-000656', 'FC-000657'], display: 'أبو داود' },
  { n: 11, ids: ['FC-000637'], display: 'الدارمي' },
  { n: 12, ids: ['FC-000630', 'FC-000629', 'FC-000631'], display: 'أحمد' },
  { n: 13, ids: ['FC-000658', 'FC-000659'], display: 'الترمذي' },
  { n: 14, ids: ['FC-000626'], display: 'ابن أبي شيبة' },
  { n: 15, ids: ['FC-000615'], display: 'عبد الرزاق' },
  { n: 16, ids: ['FC-000760', 'FC-000761'], display: 'البيهقي' },
  { n: 17, ids: ['FC-000652', 'FC-000653'], display: 'ابن ماجه' },
  { n: 18, ids: ['FC-001824'], display: 'ابن حجر في الفتح', grader: true },
  { n: 19, ids: ['FC-003857'], display: 'ابن حجر في بلوغ المرام', grader: true },
  { n: 20, ids: ['FC-002015', 'FC-002014'], display: 'التلخيص الحبير', grader: true },
  { n: 21, ids: ['FC-001994'], display: 'نصب الراية', grader: true },
  { n: 22, ids: ['FC-002053'], display: 'إرواء الغليل', grader: true },
  { n: 23, ids: ['FC-002017'], display: 'الدراية', grader: true },
  { n: 24, ids: ['FC-001978'], display: 'خلاصة الأحكام', grader: true },
  { n: 25, ids: ['FC-000788'], display: 'صحيح الجامع', grader: true, grade: 'صحيح' },
  { n: 25, ids: ['FC-000791'], display: 'ضعيف الجامع', grader: true, grade: 'ضعيف' },
  { n: 26, ids: ['FC-000735'], display: 'الحاكم' },
  { n: 27, ids: ['FC-000677'], display: 'أبو يعلى' },
  { n: 28, ids: ['FC-000668'], display: 'البزار' },
  { n: 29, ids: ['FC-002008', 'FC-002009'], display: 'مجمع الزوائد', grader: true },
  { n: 30, ids: ['FC-000728'], display: 'الدارقطني' },
  { n: 31, ids: ['FC-000709', 'FC-000710', 'FC-000711'], display: 'الطبراني في الكبير' },
  { n: 31, ids: ['FC-000707'], display: 'الطبراني في الأوسط' },
  { n: 31, ids: ['FC-000708'], display: 'الطبراني في الصغير' },
  { n: 32, ids: ['FC-002005'], display: 'العراقي في تخريج الإحياء', grader: true },
  { n: 33, ids: ['FC-001991'], display: 'المنار المنيف', grader: true },
  { n: 34, ids: ['FC-002027'], display: 'المقاصد الحسنة', grader: true },
  { n: 35, ids: ['FC-002040', 'FC-002041'], display: 'كشف الخفاء', grader: true },
  { n: 36, ids: ['FC-002061'], display: 'السلسلة الضعيفة', grader: true, grade: 'ضعيف' },
]);

/** The ladder is thirty-six ROWS; two of them (25, 31) are more than one book. */
export const TAKHRIJ_LADDER_ROWS = 36;

const BY_ID = new Map();
for (const row of TAKHRIJ_LADDER) for (const id of row.ids) BY_ID.set(id, row);

/** Every subject id the ladder knows, for a guard to count without retyping one. */
export const TAKHRIJ_LADDER_IDS = Object.freeze([...BY_ID.keys()]);

// ── AND THE BOOKS THAT STATE A RULING IN THEIR OWN TITLE, NAMED ONCE (§٣) ──
//
// THE OWNER OPENED «بابَ اختلافِ اللفظ» ON ONE LEAF on 19 September, and one of the two things it
// permits is «استعلامُ كتبِ الحكمِ» — a request narrowed to the graders alone, on a matn a ladder
// book has ALREADY been shown to carry. It is the same argument the Shaykhayn recheck stands on:
// ten globally-best rows are not ten rows per book, so a grader that holds the matn can lose its
// place to six copies of a متن book and the reader is told «لم يوقف على حكم» about a ruling that
// was there.
//
// IT IS THE ROWS WITH A STATED `grade` AND NO OTHER. A grader whose ruling is case by case —
// الفتح, التلخيص, الإرواء — states nothing by being returned, and `composeParenthetical` already
// refuses to read one. Narrowing a request to those books would buy nothing and spend a call.
/** The ladder rows whose own title states the ruling of everything inside them. */
export const RULING_BOOK_IDS = Object.freeze(
  TAKHRIJ_LADDER.filter((row) => row.grade).flatMap((row) => row.ids),
);

/** The two Shaykhs, named once so «متفق عليه» is never decided from a spelling. */
export const SHAYKHAYN_IDS = Object.freeze(TAKHRIJ_LADDER.filter((r) => r.shaykh).flatMap((r) => r.ids));

/**
 * The ladder row a library subject id belongs to, or null. A book OUTSIDE the ladder
 * resolves to null on purpose: it may be quoted as understanding, and it may never be
 * written between the parentheses of a takhrij.
 */
export function ladderRowFor(subjectId) {
  return BY_ID.get(String(subjectId || '')) || null;
}

/** True only for the two Shaykhs. */
export function isShaykhayn(subjectId) {
  return SHAYKHAYN_IDS.includes(String(subjectId || ''));
}

/**
 * THE PARENTHESES, AND THE ONLY FUNCTION ALLOWED TO BUILD THEM.
 *
 * @param {string[]} subjectIds  ids the LIBRARY returned for this matn. Anything not on the
 *                               ladder is dropped here rather than at the call site, so a
 *                               caller cannot widen the ladder by forgetting to filter.
 * @returns {{text:string, rows:object[], grade:string|null, sourced:boolean}}
 *
 * THE CASES ARE THE OWNER'S TABLE, IN HIS ORDER (§٢-ب, AND §١ OF THE SILENCE ORDER):
 *   both Shaykhs      -> (متفق عليه)
 *   one of them       -> (البخاري) · (مسلم)   — بلا درجة
 *   below them        -> (الترمذي · حسن)       — والدرجة واجبة
 *                     -> (البيهقي · لم يوقف على حكم)   — حيث لم يَنُصَّ عليها حاكم
 *   حاكم وحده بالضعف  -> (لا يثبت مرفوعا)      — حكمٌ عن عالم، لا عجزٌ عنّا
 *   لا شيء            -> `silent: true` ولا يُكتب حرف
 *
 * AND THE GRADE IS NEVER INVENTED. It appears only when a ladder GRADER carrying a stated
 * ruling was among the hits.
 *
 * ── AND ABSENT THAT, THE MISSING RULING IS SAID OUT LOUD (§٢ OF THE REPAIR ORDER) ──
 * The first revision of this function let the مخرِّج stand alone below the Shaykhayn, on the
 * reading that §٢-ب/٣ permits it. The owner measured what that ships — «(البيهقي)» — and ruled
 * that the bare name asserts a ثبوت nobody stated. So below the two Ṣaḥīḥs the parentheses now
 * ALWAYS carry a suffix: the grade a grader stated, or `NO_RULING`. `ruled` says which.
 */
export function composeParenthetical(subjectIds, rulings = null) {
  const ids = Array.isArray(subjectIds) ? subjectIds.map((v) => String(v || '')) : [];
  const rows = [];
  for (const id of ids) {
    const row = ladderRowFor(id);
    if (row && !rows.includes(row)) rows.push(row);
  }
  // ── THE LIBRARY SAID NOTHING, SO THIS PASS SAYS NOTHING (§١) ────────────
  // `silent` is the whole of the first repair: there is no text, there is nothing to write
  // beside the matn, and the caller is forbidden by its own contract to invent one. It is NOT
  // «(لا يثبت مرفوعا)» with an empty face — that sentence belongs to a حاكم and to no one else.
  if (!rows.length) {
    return { text: '', rows: [], grade: null, sourced: false, ruled: false, silent: true, ruledBy: '' };
  }

  const hasBukhari = rows.some((r) => r.n === 1);
  const hasMuslim = rows.some((r) => r.n === 2);
  // THE TWO ṢAḤĪḤS, AND THEY ARE THE ONLY THREE STRINGS THAT MAY STAND WITHOUT A SUFFIX.
  // `ruled: true` for them is not a grade: it records that the reader HAS been told where the
  // hadith stands, which is what the suffix exists to guarantee everywhere else.
  const spoken = (text) => ({
    text, rows, grade: null, sourced: true, ruled: true, silent: false, ruledBy: '',
  });
  if (hasBukhari && hasMuslim) return spoken(AGREED_UPON);
  if (hasBukhari) return spoken(rows.find((r) => r.n === 1).display);
  if (hasMuslim) return spoken(rows.find((r) => r.n === 2).display);

  // Below the Shaykhs. A متن book is the thing that «أخرجه»; a تخريج book supplies the
  // ruling. So the outlet is the lowest ladder number among the متون, and the grade is the
  // one the graders WRITE.
  const outlets = rows.filter((r) => !r.grader);

  // ── BATCH 4 [b34] · THE GRADE IS THE RULING WORD WRITTEN IN THE ATOM ──────────────────────
  // MEASURED at 2aaf987 and at 92d3c7d on ezik-shamela-20260820: «اطلبوا العلم ولو بالصين» left as
  // «(البزار · ضعيف)» while the atom that proved it, السلسلة الضعيفة entry 416, writes «باطل»; and
  // «طلب العلم فريضة على كل مسلم» left as «(ابن ماجه · ضعيف)» off ضعيف الجامع entry 3625, which
  // writes no ruling at all. The «ضعيف» came from the TITLE of the book (`grade` on its row), not
  // from anything the book said about this matn. THE OWNER'S RULE 34: the grade is the ruling word
  // written in the atom; «باطل»، «موضوع»، «لا أصل له» ⟸ «(لا يثبت مرفوعا)»; a split verdict is no
  // grade. So `rulings` — the words lib/takhrij.js read out of each grader's own entry, by id — is
  // the only thing a grade is taken from. A caller that hands none gets none: `NO_RULING`.
  const written = [];
  for (const row of rows) {
    if (!row.grader) continue;
    for (const id of row.ids) {
      if (!ids.includes(id)) continue;
      const words = rulings && Array.isArray(rulings[id]) ? rulings[id] : [];
      for (const word of words) written.push({ row, word: String(word) });
    }
  }
  const classOf = (word) => (FABRICATION_RULINGS.includes(word) ? '#fabricated' : word);
  // ── AND A SPLIT VERDICT IS NOT A VERDICT ────────────────────────────────
  // MEASURED on ezik-shamela-20260820, 2026-09-19: «اختلاف أمتي رحمة» answers from
  // ضعيف الجامع AND from السلسلة الصحيحة at once. When the written rulings disagree there is no
  // grade, and rule ٣ is explicit that a missing حاكم leaves the مخرِّج standing alone.
  const classes = [...new Set(written.map((x) => classOf(x.word)))];
  // ...and a book that writes the OPPOSITE polarity beside the same matn splits it too
  // (`rulings['#voices']`, read by lib/takhrij.js out of every confirmed atom, whatever its row).
  const voices = rulings && Array.isArray(rulings['#voices']) ? rulings['#voices'] : [];
  const polarityOf = (cls) => (cls === '#fabricated' || cls === 'ضعيف' || WEAK_RULINGS.includes(cls) ? 'weak' : 'sound');
  const unanimous = classes.length === 1 ? classes[0] : null;
  const agreed = unanimous && !voices.includes(polarityOf(unanimous) === 'weak' ? 'sound' : 'weak') ? unanimous : null;
  const grade = agreed === '#fabricated' ? written[0].word : agreed;
  const speaking = agreed ? [...new Set(written.filter((x) => classOf(x.word) === agreed).map((x) => x.row))] : [];
  const ruledBy = speaking.map((r) => r.display).join('، ');

  // «باطل»، «موضوع»، «لا أصل له» written by a grader: the matn is not established, whoever narrates
  // it. The narrator's name does not stand beside that ruling (rule 34).
  if (agreed === '#fabricated') {
    return { text: NOT_RAISED, rows, grade, sourced: true, ruled: true, silent: false, ruledBy };
  }

  if (outlets.length) {
    const outlet = outlets.reduce((a, b) => (a.n <= b.n ? a : b));
    // BELOW THE SHAYKHAYN NOTHING LEAVES BARE. Either the grade a grader wrote, or the sentence
    // that says no grader was found — never the collection's name on its own.
    return {
      text: `${outlet.display} · ${grade || NO_RULING}`,
      rows,
      grade,
      sourced: true,
      ruled: !!grade,
      silent: false,
      ruledBy,
    };
  }

  // NO متن ANSWERED. A grader may still be the outlet — but ONLY when it is the book whose written
  // ruling is being quoted, and only when that ruling is unanimous.
  // NOBODY SPOKE. Books held the matn for reasons this pass cannot read — a تخريج volume that
  // merely discusses it, two graders that disagree — and that is not a ruling in either
  // direction. It was «(لا يثبت مرفوعا)» until the owner's §١ of 19 September; it is silence now.
  if (!speaking.length) {
    return { text: '', rows, grade: null, sourced: false, ruled: false, silent: true, ruledBy: '' };
  }
  const outlet = speaking.reduce((a, b) => (a.n <= b.n ? a : b));
  // ── AND HERE «(لا يثبت مرفوعا)» COMES THROUGH FOR A WEAK RULING WITH NO NARRATOR (§١) ──────
  // No ladder متن book narrates this matn, and a ladder GRADER writes a ruling that means it does
  // not stand: «حاكم وحده بالضعف». The grader's own name does not go between the parentheses — his
  // RULING is the whole content of them — but it travels in `ruledBy`.
  if (NOT_ESTABLISHED_GRADES.includes(grade) || WEAK_RULINGS.includes(grade)) {
    return { text: NOT_RAISED, rows, grade, sourced: true, ruled: true, silent: false, ruledBy };
  }
  return { text: `${outlet.display} · ${grade}`, rows, grade, sourced: true, ruled: true, silent: false, ruledBy };
}
