import { MADHHAB_BOOKS_PRIMARY } from './before-writing.js';
import { normalizeArabic } from './route-classify.js';
import { renderBookLocator } from './free-brain/tools.js';

/** The exact material available to the writer, in preference to a retrieval snippet. */
export function writerReadMaterial(row) {
  for (const key of ['writerText', 'fullText', 'passage', 'text']) {
    if (typeof row?.[key] === 'string' && row[key].trim()) return row[key];
  }
  return '';
}

/** The seal can verify against all retrieved material, including sections beyond the writer's selection. */
export function fullSourceMaterial(row) {
  return typeof row?.fullText === 'string' && row.fullText.trim() ? row.fullText : writerReadMaterial(row);
}

const comparable = value => normalizeArabic(String(value || '')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const identity = row => String(row.subjectId || row.bookTitle || '') + '\0' + String(row.author || '');

function sharedPassage(a, b) {
  if (a.includes(b) || b.includes(a)) return true;
  const words = (a.length < b.length ? a : b).split(' ');
  const longer = a.length < b.length ? b : a;
  // Q7's two recorded representations share 36 consecutive words (185 letters).
  // Require a substantial verbatim run as well as the publication and volume identity.
  for (let start = 0; start + 20 <= words.length; start += 1) {
    const passage = words.slice(start, start + 20).join(' ');
    if (passage.length >= 80 && (' ' + longer + ' ').includes(' ' + passage + ' ')) return true;
  }
  return false;
}

/** A page can replace a pageless copy only when it actually carries that copy's text. */
export function pagedEncyclopediaCopy(row, cited, options = {}) {
  if (row?.kind !== 'encyclopedia') return null;
  const text = comparable(writerReadMaterial(row));
  if (!options.coalesce && text.length < 40) return null;
  return (cited || []).find(book => book?.kind === 'lib_book' && book.locatorSpan?.pageStart
    && (book.subjectId === 'FC-003910' || comparable(book.bookTitle) === comparable(row.publisher))
    && String(book.locatorSpan.volume) === String(row.part)
    && (options.coalesce === true || (() => {
      const paged = comparable(writerReadMaterial(book));
      return paged.length >= 40 && sharedPassage(paged, text);
    })())) || null;
}

function pageRange(row) {
  const s = row.locatorSpan;
  const start = Number(s?.pageStart), end = Number(s?.pageEnd || s?.pageStart);
  return s?.volume && start > 0 && end >= start ? { volume: String(s.volume), start, end } : null;
}

function overlaps(a, b) {
  const x = pageRange(a), y = pageRange(b);
  return !!x && !!y && x.volume === y.volume && x.start <= y.end && y.start <= x.end;
}

function absorb(target, row) {
  const material = writerReadMaterial(row);
  if (!target.writerText.includes(material)) target.writerText = material.includes(target.writerText)
    ? material : target.writerText + '\n\n' + material;
  const a = pageRange(target), b = pageRange(row);
  if (a && b && a.volume === b.volume) {
    target.locatorSpan = { ...target.locatorSpan, pageStart: String(Math.min(a.start, b.start)), pageEnd: String(Math.max(a.end, b.end)) };
    target.locator = renderBookLocator(target.locatorSpan);
  }
}

/** The cap counts books; each of their distinct locations retains its own card. */
export function locatedBookRows(cited, max, question = '', options = {}) {
  const groups = new Map();
  const merged = new Map();
  for (const row of cited || []) {
    // A mere same-volume match suppresses the pageless card without mislabelling its entire
    // article as this page. The older proven shared-text merge still keeps its material.
    const page = pagedEncyclopediaCopy(row, cited);
    if (page) merged.set(page, writerReadMaterial(row));
  }
  for (const row of cited || []) {
    if (row?.kind !== 'lib_book' || !row.bookTitle) continue;
    const key = identity(row);
    if (!groups.has(key)) groups.set(key, []);
    const locations = groups.get(key);
    const old = locations.find(one => options.coalesce === true
      ? overlaps(one, row) || (!!one.locator && one.locator === row.locator
        && String(one.locatorSpan?.volume || '') === String(row.locatorSpan?.volume || ''))
      : String(one.locator || '') === String(row.locator || ''));
    const material = merged.get(row) || writerReadMaterial(row);
    if (old) {
      if (options.coalesce === true) {
        absorb(old, { ...row, writerText: material });
        // A bridge range can connect two prior cards; coalesce to the full connected interval.
        for (let i = locations.length - 1; i >= 0; i--) {
          if (locations[i] !== old && overlaps(old, locations[i])) {
            absorb(old, locations[i]);
            locations.splice(i, 1);
          }
        }
        continue;
      }
      // Containment is lossless; unrelated passages at the same printed place stay separate paragraphs.
      if (!old.writerText.includes(material)) old.writerText = material.includes(old.writerText)
        ? material : old.writerText + '\n\n' + material;
    } else locations.push({ ...row, writerText: material, matnCut: false });
  }
  const norm = normalizeArabic(question);
  const all = /(?:المذاهب|الائمه)\s+الاربعه|كل مذهب/u.test(norm);
  const requested = MADHHAB_BOOKS_PRIMARY.filter(school => all || norm.includes(normalizeArabic(school.label))
    || (school.key === 'hanafi' && norm.includes('الاحناف'))).map(school => school.bookId);
  return [...groups.values()].flatMap((rows, index) => index < max || requested.includes(rows[0].subjectId) ? rows : []);
}
