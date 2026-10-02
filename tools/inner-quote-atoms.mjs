// tools/inner-quote-atoms.mjs — the library atoms that lie INSIDE a quotation, found by scanning the index (read only) and written as a data file.
//
// WHY THIS EXISTS (order EZIK-FOLLOWUP-49, item 9; the owner's decision 1). In a collection of fatwas the author quotes another man at length: «… ما نصه: … اه كلام فلان». The library cuts a book into
// atoms of about twelve hundred characters, so an atom in the MIDDLE of such a quotation holds somebody else's words and the reviewer used to give it the licence of the book's author («ابن باز يرى …»).
// The app sees one atom at a time and cannot know its neighbours, so the neighbours are read HERE, once, and what comes out is a data file the app imports (lib/data/inner-quote-atoms.js).
//
// THE RULE, AS NARROW AS THE OWNER DECIDED IT (the marks of the order's item 9, nothing wider):
//   · a quotation OPENS at the explicit words «ما نصه»;
//   · it CLOSES at «اه كلام(ه)» or «انتهى كلام(ه)» or «انتهى المقصود»;
//   · an INNER atom is one that has a neighbour inside the quotation on both sides: every atom strictly between the atom of the opening and the atom of the closing, in one section of one book.
// The atom of the opening and the atom of the closing carry the author's words as well as the quoted ones, so they are NOT inner and keep their licence.
// The books are the four the owner's decision measured (the three collections; the Permanent Committee's two volumes are one collection): they are named by their TITLE in the catalogue, and no atom id is
// written by hand anywhere — the ids come out of the scan.
//
// Usage:  node tools/inner-quote-atoms.mjs [--index <path to the .db>] [--write]      (without --write it prints the counts and writes nothing)
//         node tools/inner-quote-atoms.mjs --check                                      (re-derives the ids from the index and fails if lib/data/inner-quote-atoms.js differs)
// Needs the index file (read only) and node:sqlite (Node 22+).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// the four books, by catalogue title (the Committee's two volumes are «- 1» and «- 2»)
export const INNER_QUOTE_BOOK_TITLES = Object.freeze([
  'مجموع فتاوى ابن باز',
  'مجموع فتاوى ورسائل العثيمين',
  'فتاوى اللجنة الدائمة - 1',
  'فتاوى اللجنة الدائمة - 2',
]);

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu;
/** The text as the markers are read: marks and tatweel off, hamza/alef, alef-maqsura and ta-marbuta folded, everything that is not a letter or a digit a single space. */
export function foldForMarkers(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(/[إأآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}
export const OPEN_RE = /(?:^| )ما نصه(?= |$)/gu;
export const CLOSE_RE = /(?:^| )(?:اه كلامه?|انتهي كلامه?|انتهي المقصود)(?= |$)/gu;

const positions = (re, folded) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(folded)) !== null) { out.push(m.index); if (m.index === re.lastIndex) re.lastIndex += 1; } return out; };
const sectionOf = (id) => String(id).slice(0, String(id).lastIndexOf(':'));

/**
 * A closing mark closes the NEAREST explicit opening before it (in the same section): when an opening mark stands again before the closing one, the earlier opening had no closing of its own and
 * is dropped — the atoms between the two openings are not claimed to be inside anything (the safe side: they keep the author's licence). Marks are read in their order inside one atom, so an
 * atom may close one quotation and open the next.
 * @param {Array<{id:string,text:string}>} atoms  the atoms of ONE book, in the book's own order (atom id order)
 * @returns {{ranges:Array<{open:string,close:string,inner:string[]}>, inner:string[], unclosed:number}}
 */
export function findInnerQuoteAtoms(atoms) {
  const ranges = [];
  let unclosed = 0;
  let open = null; // {index, section} of the nearest opening mark not yet closed
  const folded = atoms.map((atom) => foldForMarkers(atom.text));
  for (let i = 0; i < atoms.length; i += 1) {
    if (open && sectionOf(atoms[i].id) !== open.section) { unclosed += 1; open = null; }
    const marks = [...positions(OPEN_RE, folded[i]).map((at) => ({ at, kind: 'open' })), ...positions(CLOSE_RE, folded[i]).map((at) => ({ at, kind: 'close' }))]
      .sort((a, b) => a.at - b.at);
    for (const mark of marks) {
      if (mark.kind === 'open') {
        if (open) unclosed += 1; // an opening that never found its own closing
        open = { index: i, section: sectionOf(atoms[i].id) };
      } else if (open) {
        ranges.push({ open: atoms[open.index].id, close: atoms[i].id, inner: atoms.slice(open.index + 1, i).map((atom) => atom.id) });
        open = null;
      }
    }
  }
  if (open) unclosed += 1;
  return { ranges, inner: ranges.flatMap((range) => range.inner), unclosed };
}

// ── the command line ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, '..', 'lib', 'data', 'inner-quote-atoms.js');

export function renderDataFile({ indexVersion, books, ranges, inner }) {
  const lines = [
    '// lib/data/inner-quote-atoms.js — GENERATED by tools/inner-quote-atoms.mjs from the library index; do not edit by hand (guards `libbook` and `taghonesty` read it, and `node tools/inner-quote-atoms.mjs --check` re-derives it).',
    '// The atoms that lie INSIDE a quotation («ما نصه» … «اه كلام»/«انتهى كلامه»/«انتهى المقصود») in the four collections of fatwas named in the tool: they hold somebody else\'s words, so the reviewer gives them no',
    "// licence of the book's author (order EZIK-FOLLOWUP-49 item 9, the owner's decision 1). The opening atom and the closing atom are not here: they carry the author's words too.",
    `export const INNER_QUOTE_INDEX_VERSION = ${JSON.stringify(indexVersion)};`,
    `export const INNER_QUOTE_BOOKS = Object.freeze(${JSON.stringify(books)});`,
    `export const INNER_QUOTE_RANGE_COUNT = ${ranges};`,
    'export const INNER_QUOTE_ATOMS = Object.freeze(new Set([',
    ...inner.map((id, i) => `  ${JSON.stringify(id)}${i + 1 < inner.length ? ',' : ''}`),
    ']));',
    '',
  ];
  return lines.join('\n');
}

async function scanIndex(indexPath) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(indexPath, { readOnly: true });
  const version = db.prepare('select index_version from index_meta').get().index_version;
  const books = [];
  const all = [];
  let rangeCount = 0;
  for (const title of INNER_QUOTE_BOOK_TITLES) {
    const book = db.prepare('select subject_id, book_title, author from books where book_title = ?').get(title);
    if (!book) throw new Error('book not in the catalogue: ' + title);
    const atoms = db.prepare('select atom_id, text from atoms where subject_id = ? order by atom_id').all(book.subject_id)
      .map((row) => ({ id: row.atom_id, text: zlib.inflateRawSync(row.text).toString('utf8') }));
    const found = findInnerQuoteAtoms(atoms);
    books.push({ title, subject_id: book.subject_id, atoms: atoms.length, ranges: found.ranges.length, rangesWithInner: found.ranges.filter((r) => r.inner.length).length, inner: found.inner.length, unclosed: found.unclosed });
    rangeCount += found.ranges.length;
    all.push(...found.inner);
  }
  db.close();
  return { indexVersion: version, books, ranges: rangeCount, inner: [...new Set(all)].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--index');
  const indexPath = at >= 0 ? args[at + 1] : 'C:\\EZIK-LIB\\index\\ezik-shamela-20260820.db';
  const scanned = await scanIndex(indexPath);
  for (const book of scanned.books) console.log(JSON.stringify(book));
  console.log('index ' + scanned.indexVersion + ' · ranges ' + scanned.ranges + ' · inner atoms ' + scanned.inner.length);
  const text = renderDataFile(scanned);
  if (args.includes('--write')) { fs.writeFileSync(DATA_FILE, text); console.log('wrote ' + DATA_FILE); }
  if (args.includes('--check')) {
    const now = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8').replace(/\r\n/g, '\n') : '';
    if (now !== text) { console.error('MISMATCH: lib/data/inner-quote-atoms.js is not what the scan gives'); process.exit(1); }
    console.log('MATCH');
  }
}
