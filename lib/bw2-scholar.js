// lib/bw2-scholar.js -- SPEED PIPES2 fix 5 (order EZIK-SPEED-PIPES2-ORDER-2026-09-28, item 3): A SCHOLAR THE READER
// NAMES LEADS TO HIS OWN BOOKS.
//
// MEASURED (round 7, question 6, «ما رأي الإمام ابن قدامة في حكم صلاة الجماعة؟»): the library was asked the whole
// issue, «الامام ابن قدامه صلاه الجماعه», and answered with الشرح الممتع's pages on standing «قُدّامه» (in front of)
// the imam -- the name folded into another word -- and al-Mughni never came. Asked directly, al-Mughni (FC-003727)
// holds his own chapter on it (2:130-139, «الجماعة واجبة للصلوات الخمس»). The judge kept 2 of 17 candidates, the
// writer wrote the marker, and the old path answered with the schools and an offer to search al-Mughni.
//
// So when the question names a scholar after «رأي / قول / مذهب / اختيار / يرى / ترجيح / كلام / عند» (a title such as
// «الإمام» or «شيخ الإسلام» may stand between), his books are found in the repo's own catalogue (lib/data/lib-catalog.js,
// 7,400 books): the author field names him, or the title carries him («المغني لابن قدامة», «إثبات صفة العلو - ابن
// قدامة»). The caller asks those books the issue without his name. A name that resolves to no book is no scholar here.
// PURE apart from the catalogue, which is imported only when a question names somebody.

import { normalizeArabic } from './route-classify.js';

const TRIGGERS = new Set(['راي', 'قول', 'مذهب', 'اختيار', 'يري', 'ترجيح', 'كلام', 'عند', 'فتوي', 'فتاوي', 'موقف']);
const TITLES = new Set(['الامام', 'الشيخ', 'شيخ', 'الاسلام', 'العلامه', 'الحافظ', 'سماحه', 'فضيله', 'المحدث', 'الفقيه', 'الموفق']);
const NAME_END = new Set(['في', 'عن', 'من', 'حول', 'بشان', 'بخصوص', 'علي', 'الي', 'ان', 'رحمه', 'رضي', 'و', 'او']);
// Groups are not a scholar: the schools, the majority, the scholars at large.
const NOT_A_NAME = /^(?:ال)?(?:حنفيه|احناف|مالكيه|شافعيه|حنابله|جمهور|علماء|فقهاء|ائمه|مذاهب|اهل|سلف|صحابه|محدثين|مفسرين|اصحاب)$/u;

const unify = (w) => (w === 'ابن' ? 'بن' : w);
const bare = (w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w);

/** The scholar the question names, as folded words joined by one space, or ''. */
export function scholarNameOf(question) {
  const words = normalizeArabic(String(question || '')).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const w = /^[وفل]./u.test(words[i]) && TRIGGERS.has(words[i].slice(1)) ? words[i].slice(1) : words[i];
    if (!TRIGGERS.has(w)) continue;
    let k = i + 1;
    while (k < words.length && TITLES.has(words[k])) k += 1;
    const name = [];
    while (k < words.length && name.length < 3 && !NAME_END.has(words[k])) { name.push(words[k]); k += 1; }
    if (!name.length || NOT_A_NAME.test(name[0]) || !name.some((n) => n.length >= 3)) continue;
    return name.join(' ');
  }
  return '';
}

// The catalogue folded once per instance (about 40 ms for 7,400 rows), then reused.
const FOLDED = new WeakMap();
function foldedCatalog(catalog) {
  if (!FOLDED.has(catalog)) {
    FOLDED.set(catalog, catalog.filter((row) => Array.isArray(row) && row[5] !== 1).map((row) => ({
      row,
      hay: new Set(normalizeArabic(String(row[2] || '')).split(' ').filter(Boolean).flatMap((w) => [unify(w), bare(w)])),
      title: ' ' + normalizeArabic(String(row[1] || '')) + ' ',
    })));
  }
  return FOLDED.get(catalog);
}

/** The catalogue's books by that scholar (author field, or a title that carries him); at most `max` ids. */
export function scholarBookIds(name, catalog, max = 100) {
  const words = String(name || '').split(' ').filter(Boolean).map(unify);
  if (!words.length || !Array.isArray(catalog)) return [];
  const folded = String(name).split(' ').filter(Boolean);
  const possessive = folded[0] === 'ابن' ? 'لابن ' + folded.slice(1).join(' ')
    : folded[0].startsWith('ال') ? 'لل' + folded.join(' ').slice(2) : 'ل' + folded.join(' ');
  const found = [];
  for (const { row, hay, title } of foldedCatalog(catalog)) {
    const byAuthor = words.every((w) => hay.has(w) || hay.has(bare(w)));
    const carried = title.includes(' ' + possessive + ' ') || title.endsWith(' ' + folded.join(' ') + ' ');
    // His own books first (the author field), the classical and fatwa books before the modern; the service takes
    // at most 100 ids (lib/lib-service.js MAX_BOOK_IDS), and Ibn Taymiyya alone resolves to 126.
    if (byAuthor || carried) found.push({ id: String(row[0]), rank: (byAuthor ? 0 : 2) + (row[3] === 'modern' ? 1 : 0) });
  }
  return found.sort((x, y) => x.rank - y.rank).slice(0, max).map((x) => x.id);
}

/** The issue without the scholar's name and titles -- what his books are asked. */
export function withoutScholar(terms, name) {
  const drop = new Set(String(name || '').split(' ').filter(Boolean));
  return (Array.isArray(terms) ? terms : []).filter((t) => !drop.has(t) && !TITLES.has(t));
}

/** { name, bookIds } for a question that names a scholar with books here, else null. */
export async function scholarBooksOf(question, { catalog = null } = {}) {
  const name = scholarNameOf(question);
  if (!name) return null;
  const list = catalog || (await import('./data/lib-catalog.js')).LIB_CATALOG;
  const bookIds = scholarBookIds(name, list);
  return bookIds.length ? { name, bookIds } : null;
}
