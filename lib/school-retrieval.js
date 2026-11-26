import { CATALOG_SCHOOL } from './data/madhhab-catalog.js';
import { comparativeBook, schoolOfRow } from './madhhab-books.js';

export function missingSchoolSearches(asked, kept, direct = []) {
  const present = new Set(kept.map(schoolOfRow));
  const comparative = [...direct, ...kept].find(row => comparativeBook(row) && row.headingPath?.at(-1)?.trim());
  if (!comparative) return [];
  const query = comparative.headingPath.at(-1).trim();
  const searches = [];
  for (const school of asked) {
    if (present.has(school)) continue;
    const ids = Object.keys(CATALOG_SCHOOL).filter(id => CATALOG_SCHOOL[id] === school);
    // The service accepts one hundred book IDs per request.
    for (let i = 0; i < ids.length; i += 100) searches.push({ school, query, bookIds: ids.slice(i, i + 100) });
  }
  return searches;
}
