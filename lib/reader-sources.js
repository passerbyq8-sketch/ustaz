// The answer log counts only source units admitted by the route that delivered them.
export const READER_SOURCE_KINDS = Object.freeze(['card', 'fatwa', 'hadith', 'row', 'lesson', 'encyclopedia']);
const KINDS = READER_SOURCE_KINDS;
const ALL = Object.freeze([...KINDS]);

export const READER_SOURCE_GATES = Object.freeze({
  bw2: ALL,
  'free-brain': ALL,
  'legacy-gen': Object.freeze(['card']),
  'legacy-deen': ALL,
  stored: ALL,
  hybrid: ALL,
  ledger: Object.freeze(['card']),
  world: Object.freeze(['card']),
  closed: Object.freeze(['hadith', 'row']),
  canned: Object.freeze(['card', 'row']),
});

const ALIASES = new Map([
  ['source', 'card'], ['live', 'card'], ['live_open', 'card'], ['live_page', 'card'], ['page', 'card'],
  ['fatwa_service', 'fatwa'], ['fatwa_live', 'fatwa'],
  ['local_hadith_registry', 'hadith'], ['hadith_record', 'hadith'], ['hadith_proof', 'hadith'],
  ['fiqh', 'row'], ['local_fiqh', 'row'], ['stored_fiqh', 'row'], ['library', 'row'], ['lib_book', 'row'],
  ['comparative', 'row'], ['madhhab', 'row'], ['scholar', 'row'], ['book', 'row'],
  ['local_encyclopedia', 'encyclopedia'],
]);

function rowsFrom(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const fields = ['sources', 'cards', 'rows', 'fatwas', 'hadith', 'lessons', 'encyclopedia'];
  return fields.flatMap((field) => Array.isArray(value[field]) ? value[field] : []);
}

function kindOf(source) {
  if (!source || typeof source !== 'object') return '';
  const nested = source.record || source.localEntry?.record || source.evidence || null;
  const raw = String(source.kind || source.sourceKind || source.source_kind || source.type
    || nested?.kind || nested?.sourceKind || '').trim().toLowerCase();
  if (KINDS.includes(raw)) return raw;
  if (ALIASES.has(raw)) return ALIASES.get(raw);
  const tag = String(source.tag || '');
  if (/<source\b/iu.test(tag)) return 'card';
  if (/<book\b/iu.test(tag)) return 'row';
  if (/<hadith\b/iu.test(tag)) return 'hadith';
  if (source.subjectId || source.subject_id || source.bookId) return 'row';
  if (source.canonicalUrl || source.url) return 'card';
  return '';
}

function identityOf(source, kind, index) {
  const nested = source.record || source.localEntry?.record || source.evidence || null;
  const value = source.id ?? source.uid ?? source.recordId ?? source.evidenceId
    ?? source.sourceId ?? source.ref ?? source.tag ?? source.url ?? source.canonicalUrl
    ?? nested?.id ?? nested?.uid ?? nested?.url;
  return `${kind}:${value == null || value === '' ? `#${index}` : String(value)}`;
}

export function readerSourceMask(kinds) {
  const accepted = Array.isArray(kinds) ? new Set(kinds) : new Set();
  return KINDS.reduce((mask, kind, index) => accepted.has(kind) ? mask | (1 << index) : mask, 0);
}

export function readerSourceKindsFromMask(mask) {
  const value = Number(mask);
  if (!Number.isSafeInteger(value) || value < 0) return Object.freeze([]);
  return Object.freeze(KINDS.filter((kind, index) => (value & (1 << index)) !== 0));
}

/** Summarize distinct accepted source units after a route's source gate. */
export function readerSources(route, value) {
  const gate = READER_SOURCE_GATES[String(route || '')];
  if (!gate) return Object.freeze({ count: 0, kinds: Object.freeze([]) });
  const allowed = new Set(gate);
  const seen = new Set();
  const present = new Set();
  let count = 0;
  const rows = rowsFrom(value);
  rows.forEach((source, index) => {
    if (!source || typeof source !== 'object' || source.accepted === false
      || source.gateAccepted === false || source.rejected === true) return;
    const kind = kindOf(source);
    if (!kind || !allowed.has(kind)) return;
    const identity = identityOf(source, kind, index);
    if (seen.has(identity)) return;
    seen.add(identity);
    present.add(kind);
    count += 1;
  });
  return Object.freeze({
    count,
    kinds: Object.freeze(KINDS.filter((kind) => present.has(kind))),
  });
}
