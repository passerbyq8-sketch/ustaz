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

/** The inner text of the parentheses when the library knows nothing about the matn. */
export const NOT_RAISED = 'لا يثبت مرفوعا';

/** The inner text when both Shaykhs carry it. */
export const AGREED_UPON = 'متفق عليه';

/**
 * The ladder. `display` is what may be written between the parentheses — the BOOK's or its
 * author's conventional short name, never the library's own name (§٢-ب/٥: الشاملةُ مستورة).
 *
 * `grade` is present ONLY on the rows whose own title states the ruling of everything inside
 * them. For every other grader the ruling is a judgement the book makes case by case, and
 * this file will not guess it — §٢-ب/٣: «عزك لا يخترع درجة أبدا».
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
 * THE FOUR CASES ARE THE OWNER'S TABLE, IN HIS ORDER (§٢-ب):
 *   both Shaykhs -> (متفق عليه)
 *   one of them  -> (البخاري) · (مسلم)   — بلا درجة
 *   below them   -> (الترمذي · حسن)       — الدرجة حيث تُعرَف
 *   nothing      -> (لا يثبت مرفوعا)
 *
 * AND THE GRADE IS NEVER INVENTED. It appears only when a ladder GRADER carrying a stated
 * ruling was among the hits. Absent that, the parentheses hold the مخرِّج alone — which
 * §٢-ب/٣ permits in as many words.
 */
export function composeParenthetical(subjectIds) {
  const ids = Array.isArray(subjectIds) ? subjectIds.map((v) => String(v || '')) : [];
  const rows = [];
  for (const id of ids) {
    const row = ladderRowFor(id);
    if (row && !rows.includes(row)) rows.push(row);
  }
  if (!rows.length) return { text: NOT_RAISED, rows: [], grade: null, sourced: false };

  const hasBukhari = rows.some((r) => r.n === 1);
  const hasMuslim = rows.some((r) => r.n === 2);
  if (hasBukhari && hasMuslim) return { text: AGREED_UPON, rows, grade: null, sourced: true };
  if (hasBukhari) return { text: rows.find((r) => r.n === 1).display, rows, grade: null, sourced: true };
  if (hasMuslim) return { text: rows.find((r) => r.n === 2).display, rows, grade: null, sourced: true };

  // Below the Shaykhs. A متن book is the thing that «أخرجه»; a تخريج book supplies the
  // ruling. So the outlet is the lowest ladder number among the متون, and the grade is the
  // one the graders state.
  const outlets = rows.filter((r) => !r.grader);
  const stated = [...new Set(rows.filter((r) => r.grader && r.grade).map((r) => r.grade))];

  // ── AND A SPLIT VERDICT IS NOT A VERDICT ────────────────────────────────
  // MEASURED on ezik-shamela-20260820, 2026-09-19: «اختلاف أمتي رحمة» answers from
  // ضعيف الجامع AND from السلسلة الصحيحة at once — the second because the series DISCUSSES
  // it, not because it authenticated it. Reading «a grader holds it» as «that grader graded
  // it that way» produced «(السلسلة الصحيحة · ضعيف)», a sentence that contradicts itself and
  // tells the reader something no book said. When the stated rulings disagree there is no
  // grade, and rule ٣ is explicit that a missing حاكم leaves the مخرِّج standing alone.
  const grade = stated.length === 1 ? stated[0] : null;

  if (outlets.length) {
    const outlet = outlets.reduce((a, b) => (a.n <= b.n ? a : b));
    return { text: grade ? `${outlet.display} · ${grade}` : outlet.display, rows, grade, sourced: true };
  }

  // NO متن ANSWERED. A grader may still be the outlet — «(السلسلة الضعيفة · ضعيف)» is the
  // owner's own last row — but ONLY when it is the book whose ruling is being quoted, and
  // only when that ruling is unanimous. Anything else is a book holding a matn for reasons
  // this pass cannot read, and that is not a تخريج.
  const speaking = grade ? rows.filter((r) => r.grade === grade) : [];
  if (!speaking.length) return { text: NOT_RAISED, rows, grade: null, sourced: false };
  const outlet = speaking.reduce((a, b) => (a.n <= b.n ? a : b));
  return { text: `${outlet.display} · ${grade}`, rows, grade, sourced: true };
}
