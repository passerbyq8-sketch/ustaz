// lib/free-brain/compiled-fatwa-books.js -- ITEM A-3 (brain35, 2026-11-06; DIAG 35.1): WHICH FATWA BOOKS NAME THEIR COMPILER.
//
// The catalog carries one author field per book; for a compiled fatwa work that field names the man who gathered the
// fatwas, not the mufti who signed them (Q27: «فتاوى إسلامية» by al-Musnad, the passage signed «اللجنة الدائمة»). The list
// is measured data (lib/data/compiled-fatwa-books.json, the rule is written there); a library row from one of these books
// carries authorRole 'compiler', every other row 'author'. The prose may credit the signature inside the passage or «the
// book», never the compiler (writer rule 12); the reviewer gives a compiler's name no licence (bookAuthorEvidenceFor); the
// card writes «جمعه: <name>».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'data', 'compiled-fatwa-books.json'), 'utf8'));
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
