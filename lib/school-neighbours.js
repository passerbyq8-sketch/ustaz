import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { LIB_BASE, LIB_MAX_JSON_BYTES } from './lib-contract.js';
import { normalizeLibRecord } from './lib-service.js';
import { libraryEvidenceRow } from './free-brain/tools.js';
import { schoolOfRow } from './madhhab-books.js';
import { shouldDropLibraryHit } from './removed-sources.js';

let manifest;
function bookNavigation(book) {
  manifest ??= JSON.parse(inflateSync(readFileSync(new URL('./data/school-navigation.bin', import.meta.url))));
  return manifest[book];
}

// The service navigates forward. For the preceding atom, use its own predecessor as cursor.
export function neighbourCursors(id) {
  const [book, section, suffix] = id.split(':');
  const info = bookNavigation(book);
  if (!info) return [];
  const n = Number(suffix), spans = info.spans;
  const i = spans.findIndex(([s, lo, hi]) => s === section && n >= lo && n <= hi);
  if (i < 0) return [];
  function at(offset) {
    let j = i, k = n + offset;
    while (j > 0 && k < spans[j][1]) { const steps = spans[j][1] - k; j--; k = spans[j][2] - steps + 1; }
    while (j + 1 < spans.length && k > spans[j][2]) { const steps = k - spans[j][2]; j++; k = spans[j][1] + steps - 1; }
    return k < spans[j][1] || k > spans[j][2] ? '' : book + ':' + spans[j][0] + ':' + String(k).padStart(3, '0');
  }
  return [-1, 1].map(offset => ({ id: at(offset), cursor: at(offset - 1) }))
    .filter(target => target.id).map(target => target.cursor ? target : { ...target, first: info.first });
}

async function readNeighbour(target, book, { token, signal, fetchImpl = fetch }) {
  if (target.first) return target.first;
  const response = await fetchImpl(LIB_BASE + '/next', {
    method: 'POST', redirect: 'error', signal,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ atom_id: target.cursor, unit: 'atom' }),
  });
  if (!response.ok || Number(response.headers.get('content-length')) > LIB_MAX_JSON_BYTES) return null;
  const body = await response.text();
  if (Buffer.byteLength(body) > LIB_MAX_JSON_BYTES) return null;
  const payload = JSON.parse(body);
  const atom = payload.atoms?.find(a => a.atom_id === target.id);
  return atom && payload.book_id === book ? { ...atom, subject_id: book, book_title: payload.title, author: payload.author } : null;
}

export async function keptSchoolNeighbours(rows, options) {
  const timeout = AbortSignal.timeout(1400);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const present = new Set(rows.map(row => row.recordId));
  const reads = new Map(), jobs = [];
  for (const row of rows) {
    const school = schoolOfRow(row);
    if (!school || !row.headingPath?.length) continue;
    const id = String(row.recordId || '').replace(/^lib:/u, '');
    const book = id.split(':')[0];
    for (const target of neighbourCursors(id)) {
      if (present.has('lib:' + target.id)) continue;
      if (!reads.has(target.id)) reads.set(target.id, readNeighbour(target, book, { ...options, signal }).catch(() => null));
      jobs.push(reads.get(target.id).then(hit => {
        if (!hit || JSON.stringify(hit.heading_path) !== JSON.stringify(row.headingPath) ||
            shouldDropLibraryHit(hit)) return null;
        const record = normalizeLibRecord(hit);
        return record ? { ...libraryEvidenceRow(record, { keepFullText: true }), madhhab: school } : null;
      }));
    }
  }
  const extra = [];
  for (const row of await Promise.all(jobs)) {
    if (row && !present.has(row.recordId)) { present.add(row.recordId); extra.push(row); }
  }
  return extra;
}
