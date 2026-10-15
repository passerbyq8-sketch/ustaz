// lib/named-books.js -- ITEM C5 (125 a; axis row 10) -- 2026-10-15 brain-line
//
// A BOOK NAMED IN THE ANSWER THAT THE ANSWER DID NOT RETRIEVE. Measured on 7ba44481
// (side-brain-line-2026-10-15/side/axis-bw2.md 10-1..10-4): on a single encyclopedia row, «جاء في المجموع للنووي…»,
// «وفي المغني لابن قدامة…», «قال النووي في المجموع:…» and «ونص صاحب بدائع الصنائع…» were all released, with the
// encyclopedia's tail under them. Nothing compared the book a sentence names with the books the answer stood on.
//
// THE INDEX. Every title the app knows a book by, folded by the router's normalizeArabic: the library catalogue
// (lib/data/lib-catalog.js, 7400 titles), the four school books (lib/madhhab-books.js), the takhrij ladder
// (lib/takhrij-ladder.js) and the short names a writer actually uses (SHORT_NAMES). A catalogue title is matched
// whole; a short name as written.
//
// THE DETECTOR. A sentence ATTRIBUTES to a book when a frame of attribution -- «جاء / ورد / نصّ / ذكر / قال … في»,
// «وفي», «صاحب» -- stands right before one of those names. A bare mention with no frame («كتاب المغني مطبوع») is not
// an attribution and is not read.
//
// WHAT THE CALLERS DO WITH IT. BW2 holds such a unit unless the book is among the answer's rows; the free brain
// removes the whole sentence (lib/free-brain/loop.js). Pure; no I/O; no model.
import { normalizeArabic } from './route-classify.js';
import { LIB_CATALOG } from './data/lib-catalog.js';
import { MADHHAB_BOOKS_PRIMARY } from './madhhab-books.js';
import { TAKHRIJ_LADDER } from './takhrij-ladder.js';

export const SHORT_NAMES = Object.freeze([
  'المجموع', 'المغني', 'بدائع الصنائع', 'الشرح الكبير', 'الموسوعة الفقهية الكويتية', 'الموسوعة الفقهية', 'الفتاوى الكبرى',
  'مجموع الفتاوى', 'زاد المعاد', 'فتح الباري', 'المدونة', 'بداية المجتهد', 'المحلى', 'الإنصاف', 'كشاف القناع',
  'حاشية ابن عابدين', 'رد المحتار', 'مغني المحتاج', 'نهاية المحتاج', 'الروض المربع', 'الشرح الممتع', 'نيل الأوطار',
  'سبل السلام', 'المبسوط', 'مواهب الجليل', 'روضة الطالبين', 'تفسير ابن كثير', 'تفسير الطبري', 'إعلام الموقعين',
  'الفروع', 'شرح صحيح مسلم', 'شرح النووي على مسلم', 'المنهاج', 'الأذكار', 'رياض الصالحين',
]);

const fold = (s) => normalizeArabic(String(s || '')).trim();
let INDEX = null;
/** The folded names, longest first, so «الموسوعة الفقهية الكويتية» wins over «الموسوعة الفقهية». */
export function namedBookIndex() {
  if (INDEX) return INDEX;
  const names = new Set();
  for (const n of SHORT_NAMES) names.add(fold(n));
  for (const row of LIB_CATALOG) {
    const t = fold(row[1]);
    if (t.split(' ').length >= 2 && t.length >= 8) names.add(t);
  }
  const catalogTitle = new Map(LIB_CATALOG.map((row) => [row[0], row[1]]));
  for (const b of MADHHAB_BOOKS_PRIMARY) { const t = fold(catalogTitle.get(b.bookId)); if (t) names.add(t); }
  for (const r of TAKHRIJ_LADDER) for (const id of r.ids) { const t = fold(catalogTitle.get(id)); if (t && t.split(' ').length >= 2) names.add(t); }
  INDEX = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  return INDEX;
}

let SHORT = null;
function shortNameIndex() {
  if (!SHORT) SHORT = [...new Set(SHORT_NAMES.map(fold))].sort((a, b) => b.length - a.length);
  return SHORT;
}

// the frames, on normalizeArabic's folding; the book is what follows them. A VERB frame («جاء/ورد/نص/ذكر/قال … في»,
// «صاحب», «كتاب») may stand before any known title. A BARE «في/وفي» stands before a short name only, and not before
// one that is also an ordinary phrase («في المجموع» is also «in all»): measured on the guard fixtures, a bare «في»
// before a catalogue title read «في صلاة الكسوف» and «في سجود السهو» as books.
const VERB_FRAME_RE = /(?:^|\s)(?:(?:و?(?:جاء|ورد|نص|ذكر|ذكره|قال|يقول|وقال)(?:\s+\S+){0,3}?\s+في)|صاحب|و?قال\s+صاحب|كتاب|كتابه)\s+(?:كتاب\s+|كتابه\s+)?/gu;
const BARE_FRAME_RE = /(?:^|\s)و?في\s+/gu;
const BARE_EXCLUDED = new Set(['المجموع', 'الفروع', 'المنهاج', 'الاذكار', 'المدونه'].map((n) => normalizeArabic(n)));

/** The folded names of the books this sentence attributes something to (each once, in order). */
export function attributedBooks(sentence) {
  const folded = fold(String(sentence || '').replace(/\[\[[^\]]*\]\]/gu, ' '));
  if (!folded) return [];
  const index = namedBookIndex();
  const shortNames = shortNameIndex();
  const out = [];
  const scan = (re, names) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(folded)) !== null) {
      const rest = folded.slice(m.index + m[0].length);
      const hit = names.find((name) => rest === name || rest.startsWith(name + ' ') || rest.startsWith(name + ':') || rest.startsWith(name + '،'));
      if (hit && !out.includes(hit)) out.push(hit);
      if (m[0].length === 0) re.lastIndex += 1;
    }
  };
  scan(VERB_FRAME_RE, index);
  scan(BARE_FRAME_RE, shortNames.filter((n) => !BARE_EXCLUDED.has(n)));
  return out;
}

/** Is a book (folded name) among these rows -- by the row's book title, title or publisher, either way contained? */
export function bookAmongRows(book, rows) {
  const b = fold(book);
  return (Array.isArray(rows) ? rows : []).some((row) => [row && row.bookTitle, row && row.title, row && row.publisher]
    .map(fold).filter((t) => t.length >= 3).some((t) => t.includes(b) || b.includes(t)));
}

/** The books a sentence attributes to that none of the rows carries. */
export function unretrievedBooks(sentence, rows) {
  return attributedBooks(sentence).filter((book) => !bookAmongRows(book, rows));
}
