import removedSources from './data/removed-sources.json' with { type: 'json' };
import { normalizeArabic } from './route-classify.js';
import { identitySubject } from './policy/name-presence.js';
import { TRIGGERS } from './bw2-scholar.js';

export const REMOVED_SOURCES = removedSources;
export const REMOVED_BOOK_IDS = new Set(removedSources.books || []);
export const REMOVED_ATOM_IDS = new Set(removedSources.atoms || []);

export function normalizeRemovedName(value) {
  return normalizeArabic(String(value == null ? '' : value)).replace(/\u06a9/g, '\u0643');
}

const PERSON_FORMS = (removedSources.persons || []).flatMap((person) =>
  (Array.isArray(person.forms) ? person.forms : []).map((form) => ({
    id: String(person.id || ''),
    name: String(person.canonical || form),
    words: normalizeRemovedName(form).split(' ').filter(Boolean),
  })),
);

/** Return the removed person only when a complete measured name and an attribution trigger co-occur. */
export function removedPersonIdentity(question) {
  const subject = identitySubject(question);
  if (!subject) return null;
  const normalized = normalizeRemovedName(subject);
  for (const person of PERSON_FORMS) {
    if (person.words.join(' ') === normalized) {
      return { id: person.id, name: person.name, form: normalized, role: 'removed_identity' };
    }
  }
  return null;
}

function identityNotePrefix() {
  return String.fromCodePoint(...'62a 646 628 64a 647 3a 20 644 64a 633 20 639 646 62f 64a 20 645 635 627 62f 631 20 645 646 20 643 62a 628 20'
    .split(' ').map((part) => parseInt(part, 16)));
}
export function removedPersonIdentityNote(identity) {
  if (!identity || identity.role !== 'removed_identity') return '';
  const person = (removedSources.persons || []).find((row) => String(row.id || '') === String(identity.id || '')
    && String(row.canonical || '') === String(identity.name || ''));
  return person ? identityNotePrefix() + person.canonical + '.' : '';
}
export function appendRemovedPersonIdentityNote(answer, identity) {
  const text = String(answer == null ? '' : answer);
  if (!text.trim()) return text;
  const note = removedPersonIdentityNote(identity);
  if (!note || text.includes(note)) return text;
  return text + '\n\n' + note;
}

export function removedPersonAttribution(question) {
  const words = normalizeRemovedName(question).split(' ').filter(Boolean);
  if (!words.length) return null;
  const hasTrigger = words.some((word) => {
    const withoutConjunction = /^[وفل]/u.test(word) ? word.slice(1) : word;
    return TRIGGERS.has(word) || TRIGGERS.has(withoutConjunction);
  });
  if (!hasTrigger) return null;
  for (const person of PERSON_FORMS) {
    if (!person.words.length || person.words.length > words.length) continue;
    for (let start = 0; start <= words.length - person.words.length; start += 1) {
      if (person.words.every((word, offset) => word === words[start + offset])) {
        return { id: person.id, name: person.name, form: person.words.join(' '), role: 'removed_person' };
      }
    }
  }
  return null;
}


const QUERY_FRAME_WORDS = new Set([
  ...TRIGGERS, '\u{645}\u{627}', '\u{645}\u{627}\u{630}\u{627}', '\u{643}\u{64a}\u{641}', '\u{647}\u{644}',
  '\u{641}\u{64a}', '\u{639}\u{646}', '\u{62d}\u{648}\u{644}', '\u{628}\u{634}\u{623}\u{646}',
  '\u{628}\u{62e}\u{635}\u{648}\u{635}', '\u{639}\u{644}\u{649}', '\u{625}\u{644}\u{649}',
  '\u{645}\u{646}', '\u{647}\u{630}\u{627}', '\u{647}\u{630}\u{647}', '\u{647}\u{648}', '\u{647}\u{64a}',
  '\u{627}\u{644}\u{634}\u{64a}\u{62e}', '\u{634}\u{64a}\u{62e}', '\u{627}\u{644}\u{62f}\u{643}\u{62a}\u{648}\u{631}',
  '\u{62f}\u{643}\u{62a}\u{648}\u{631}', '\u{64a}\u{631}\u{62c}\u{649}', '\u{641}\u{636}\u{644}\u{627}',
]);
function isAttributionTrigger(word) {
  const withoutConjunction = /^[\u{648}\u{641}\u{644}]/u.test(word) ? word.slice(1) : word;
  return TRIGGERS.has(word) || TRIGGERS.has(withoutConjunction);
}
export function stripRemovedPersonQuery(question, attribution = removedPersonAttribution(question)) {
  const words = normalizeRemovedName(question).split(' ').filter(Boolean);
  if (!attribution) return words.join(' ');
  const personWords = normalizeRemovedName(attribution.form || '').split(' ').filter(Boolean);
  const kept = [];
  for (let i = 0; i < words.length; i += 1) {
    if (personWords.length && personWords.every((word, offset) => words[i + offset] === word)) {
      i += personWords.length - 1;
      continue;
    }
    if (isAttributionTrigger(words[i]) || QUERY_FRAME_WORDS.has(words[i])) continue;
    kept.push(words[i]);
  }
  return kept.join(' ').trim();
}
export function removedPersonNoteForName(name) {
  const canonical = String(name || '').trim();
  const person = (removedSources.persons || []).find((row) => String(row.canonical || '').trim() === canonical);
  if (!person) return '';
  return '\u{62a}\u{646}\u{628}\u{64a}\u{647}\u{3a}\u{20}\u{644}\u{64a}\u{633}\u{20}\u{639}\u{646}\u{62f}\u{64a}\u{20}\u{645}\u{635}\u{627}\u{62f}\u{631}\u{20}\u{645}\u{646}\u{20}\u{643}\u{62a}\u{628}\u{20}' + person.canonical + '\u{60c}\u{20}\u{641}\u{645}\u{627}\u{20}\u{62a}\u{642}\u{62f}\u{64e}\u{651}\u{645}\u{20}\u{645}\u{623}\u{62e}\u{648}\u{630}\u{64c}\u{20}\u{645}\u{646}\u{20}\u{627}\u{644}\u{645}\u{635}\u{627}\u{62f}\u{631}\u{20}\u{627}\u{644}\u{645}\u{630}\u{643}\u{648}\u{631}\u{629}\u{60c}\u{20}\u{648}\u{644}\u{64a}\u{633}\u{20}\u{642}\u{648}\u{644}\u{64b}\u{627}\u{20}\u{645}\u{646}\u{633}\u{648}\u{628}\u{64b}\u{627}\u{20}\u{625}\u{644}\u{64a}\u{647}\u{2e}';
}
export function removedPersonAnswerNote(question) {
  const attribution = removedPersonAttribution(question);
  return attribution ? removedPersonNoteForName(attribution.name) : '';
}
export function appendRemovedPersonAnswerNote(answer, question, { blocked = false } = {}) {
  const text = String(answer == null ? '' : answer);
  if (blocked || !text.trim()) return text;
  const note = removedPersonAnswerNote(question);
  if (!note || text.includes(note)) return text;
  return text + '\n\n' + note;
}
export function shouldDropLibraryHit(hit, blockedBookIds = new Set()) {
  const source = hit && typeof hit === 'object' ? hit : {};
  const provenance = source.provenance && typeof source.provenance === 'object' ? source.provenance : {};
  const subjectId = String(source.subject_id || source.subjectId || provenance.subject_id || provenance.subjectId || '');
  const atomId = String(source.atom_id || source.atomId || provenance.atom_id || provenance.atomId || '');
  return REMOVED_BOOK_IDS.has(subjectId) || REMOVED_ATOM_IDS.has(atomId) || blockedBookIds.has(subjectId);
}
