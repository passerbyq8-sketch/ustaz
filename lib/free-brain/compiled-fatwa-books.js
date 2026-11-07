// lib/free-brain/compiled-fatwa-books.js -- ITEM A-3 (brain35, 2026-11-06; DIAG 35.1): WHICH FATWA BOOKS NAME THEIR COMPILER.
//
// The catalog carries one author field per book; for a compiled fatwa work that field names the man who gathered the
// fatwas, not the mufti who signed them (Q27: «فتاوى إسلامية» by al-Musnad, the passage signed «اللجنة الدائمة»). The list
// is measured data (lib/data/compiled-fatwa-books.json, the rule is written there); a library row from one of these books
// carries authorRole 'compiler', every other row 'author'. The prose may credit the signature inside the passage or «the
// book», never the compiler (writer rule 12); the reviewer gives a compiler's name no licence (bookAuthorEvidenceFor); the
// card writes «جمعه: <name>».
// A STATIC import, like lib/removed-sources.js's own data: a readFileSync at runtime is not traced into the deployed
// function (vercel.json names only the fiqh store in includeFiles), so the list would be absent in production and every
// row would read as 'author'. The file is small, and this way it ships with the code that needs it.
import DATA from '../data/compiled-fatwa-books.json' with { type: 'json' };
// ITEM 35-D2 R1 (brain35-2 F7, 2026-11-07): the catalogue's kind column (turath | fatwa | modern), read by the book id a
// library record carries; the catalogue is read here, never edited (lib/lib-quote.js and lib/named-books.js import it the
// same way). A roster scholar's own fatwa book (kind fatwa, its author field the scholar) is named by the scholar in a
// source mark (lib/bw2-units.js shortSourceMark), never by an edition title.
import { LIB_CATALOG } from '../data/lib-catalog.js';
let KIND_BY_ID = null;
/** The catalogue kind of the book a record id names ('turath' | 'fatwa' | 'modern'), or '' when the id is unknown. */
export function catalogKindOf(recordId) {
  const id = bookIdOf(recordId);
  if (!id) return '';
  if (!KIND_BY_ID) {
    KIND_BY_ID = new Map();
    for (const row of Array.isArray(LIB_CATALOG) ? LIB_CATALOG : []) KIND_BY_ID.set(String(row[0] || ''), String(row[3] || ''));
  }
  return KIND_BY_ID.get(id) || '';
}
/** Is this library row from a book of the catalogue's fatwa kind? */
export function isFatwaKindBook(row) {
  return catalogKindOf(row && row.recordId) === 'fatwa';
}
export const COMPILED_FATWA_BOOK_IDS = Object.freeze(new Set((DATA.books || []).map((b) => String(b.id || ''))));
/** The book id (FC-nnnnnn) a library record id carries, or ''. */
export function bookIdOf(recordId) {
  const m = /FC-\d{6}/u.exec(String(recordId == null ? '' : recordId));
  return m ? m[0] : '';
}
/** 'compiler' for a row from a compiled fatwa work, 'author' otherwise. */
export function authorRoleOf(recordId) {
  return COMPILED_FATWA_BOOK_IDS.has(bookIdOf(recordId)) ? 'compiler' : 'author';
}
