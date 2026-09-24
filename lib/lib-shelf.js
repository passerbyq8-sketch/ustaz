// lib/lib-shelf.js — PROGRAM ORDER 2026-09-24, م٥ (LIB_NAV_V1): «المكتبة» — the shelf, answered from the
// catalogue on the server.
//
// THE OWNER'S ITEM: «قسمٌ جديدٌ اسمُه «المكتبة»: تصفّحُ الكتبِ بأقسامِها ومؤلّفيها (lib/data/lib-catalog.js) …
// قواعدُ النقلِ نفسُها … الممنوعُ لا يظهر.» MEASURED (program-2026-09-24/05-library/measure/C-catalog.md): the
// catalogue is 905 KB and must not reach the client; its six-field rows are pinned; the sections come from
// the census folders (lib/data/lib-sections.js, generated beside it).
//
// PURE: no environment, no socket. Every list leaves out the withheld books (the citation deny list), so
// the section cannot show what the conversation may not quote.
import { LIB_CATALOG } from './data/lib-catalog.js';
import { LIB_SECTIONS, LIB_SECTION_OF, LIB_SECTION_SPAN } from './data/lib-sections.js';
import { foldArabic } from './lib-quote.js';

export const SHELF_PAGE_SIZE = 40;

const ROW = { id: 0, title: 1, author: 2, cls: 3, auto: 4, blocked: 5 };

/** True when the sections file was generated from the same census order as the catalogue. */
export function sectionsAligned() {
  return LIB_SECTION_OF.length === LIB_CATALOG.length
    && LIB_SECTION_SPAN[2] === LIB_CATALOG.length
    && LIB_CATALOG[0][ROW.id] === LIB_SECTION_SPAN[0]
    && LIB_CATALOG[LIB_CATALOG.length - 1][ROW.id] === LIB_SECTION_SPAN[1];
}

const bookOf = (row, i) => ({
  id: row[ROW.id], title: row[ROW.title], author: row[ROW.author] === '-' ? '' : row[ROW.author],
  cls: row[ROW.cls], auto: row[ROW.auto] === 1, section: LIB_SECTION_OF[i],
});

let OPEN = null;
function openBooks() {
  if (OPEN) return OPEN;
  OPEN = [];
  LIB_CATALOG.forEach((row, i) => { if (row[ROW.blocked] !== 1) OPEN.push(bookOf(row, i)); });
  return OPEN;
}

const byTitle = (a, b) => foldArabic(a.title).localeCompare(foldArabic(b.title), 'ar');
const pageOf = (list, page) => {
  const pages = Math.max(1, Math.ceil(list.length / SHELF_PAGE_SIZE));
  const p = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), pages);
  return { items: list.slice((p - 1) * SHELF_PAGE_SIZE, p * SHELF_PAGE_SIZE), page: p, pages, total: list.length };
};

/** The sections, in the folder order, each with the number of books a reader may open. */
export function shelf() {
  const counts = new Array(LIB_SECTIONS.length).fill(0);
  for (const b of openBooks()) counts[b.section] += 1;
  return LIB_SECTIONS.map((name, id) => ({ id, name, count: counts[id] })).filter((s) => s.count > 0);
}

/** One section's books, by title, a page at a time. */
export function sectionBooks(section, page = 1) {
  if (!Number.isInteger(section) || section < 0 || section >= LIB_SECTIONS.length) return null;
  return { section: { id: section, name: LIB_SECTIONS[section] }, ...pageOf(openBooks().filter((b) => b.section === section).sort(byTitle), page) };
}

/** One section's authors, each with the number of his books there, by name. */
export function sectionAuthors(section) {
  if (!Number.isInteger(section) || section < 0 || section >= LIB_SECTIONS.length) return null;
  const counts = new Map();
  for (const b of openBooks()) if (b.section === section) counts.set(b.author || '', (counts.get(b.author || '') || 0) + 1);
  const authors = [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === '') - (b.name === '') || foldArabic(a.name).localeCompare(foldArabic(b.name), 'ar'));
  return { section: { id: section, name: LIB_SECTIONS[section] }, authors };
}

/** One author's books, in one section or everywhere, a page at a time. */
export function authorBooks(author, section = null, page = 1) {
  const name = String(author == null ? '' : author);
  if (name.length > 200) return null;
  const list = openBooks().filter((b) => b.author === name && (section === null || b.section === section)).sort(byTitle);
  return { author: name, ...pageOf(list, page) };
}

/** One book as the section shows it, or null (unknown, or withheld: a withheld book does not appear). */
export function shelfBook(id) {
  const i = LIB_CATALOG.findIndex((row) => row[ROW.id] === id);
  if (i === -1 || LIB_CATALOG[i][ROW.blocked] === 1) return null;
  const b = bookOf(LIB_CATALOG[i], i);
  return { ...b, sectionName: LIB_SECTIONS[b.section] };
}

/** Titles and authors that carry the reader's words, for the shelf's own search box. */
export function findBooks(query, page = 1) {
  const words = foldArabic(query).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return null;
  const list = openBooks().filter((b) => {
    const hay = ' ' + foldArabic(b.title + ' ' + b.author) + ' ';
    return words.every((w) => hay.includes(w));
  }).sort(byTitle);
  return { query: String(query).slice(0, 80), ...pageOf(list, page) };
}
