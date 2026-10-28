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

const REMOVED_NAME_PREFIXES = new Set([0x648, 0x641, 0x644, 0x628].map((cp) => String.fromCodePoint(cp)));
const withoutOneRemovedNamePrefix = (word) => {
  const chars = Array.from(String(word || ''));
  return REMOVED_NAME_PREFIXES.has(chars[0]) ? chars.slice(1).join('') : String(word || '');
};
function removedNameMatchesAt(words, start, nameWords) {
  if (!nameWords.length || start + nameWords.length > words.length) return false;
  const first = words[start];
  if (first !== nameWords[0] && withoutOneRemovedNamePrefix(first) !== nameWords[0]) return false;
  return nameWords.slice(1).every((word, offset) => word === words[start + offset + 1]);
}
export function sentenceNamesRemovedPerson(sentence, attribution) {
  if (!attribution || attribution.role !== 'removed_person') return false;
  const rows = PERSON_FORMS.filter((person) => person.id === String(attribution.id || ''));
  const words = normalizeRemovedName(sentence).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/u).filter(Boolean);
  for (const person of rows) {
    for (let start = 0; start <= words.length - person.words.length; start += 1) {
      if (removedNameMatchesAt(words, start, person.words)) return true;
    }
  }
  return false;
}
const REMOVED_PERSON_SPEECH_VERBS = new Set([
  '\u{64a}\u{642}\u{648}\u{644}', '\u{642}\u{627}\u{644}', '\u{64a}\u{631}\u{649}', '\u{631}\u{623}\u{649}',
  '\u{64a}\u{641}\u{62a}\u{64a}', '\u{623}\u{641}\u{62a}\u{649}', '\u{64a}\u{630}\u{643}\u{631}', '\u{630}\u{643}\u{631}',
].map(normalizeRemovedName));
export function isRemovedPersonSpeechVerb(word) {
  const normalized = normalizeRemovedName(word);
  const withoutOnePrefix = normalized.replace(/^[\u{648}\u{641}\u{644}\u{628}]/u, '');
  return REMOVED_PERSON_SPEECH_VERBS.has(normalized) || REMOVED_PERSON_SPEECH_VERBS.has(withoutOnePrefix);
}

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
  const words = normalizeRemovedName(question).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/u).filter(Boolean);
  if (!words.length) return null;
  const hasTrigger = words.some((word) => {
    const withoutConjunction = /^[وفل]/u.test(word) ? word.slice(1) : word;
    return isRemovedPersonSpeechVerb(word) || TRIGGERS.has(word) || TRIGGERS.has(withoutConjunction);
  });
  if (!hasTrigger) return null;
  for (const person of PERSON_FORMS) {
    if (!person.words.length || person.words.length > words.length) continue;
    for (let start = 0; start <= words.length - person.words.length; start += 1) {
      if (removedNameMatchesAt(words, start, person.words)) {
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
  return isRemovedPersonSpeechVerb(word) || TRIGGERS.has(word) || TRIGGERS.has(withoutConjunction);
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
export function removedPersonAnswerNote(question, { hasReaderCard = true } = {}) {
  const attribution = removedPersonAttribution(question);
  if (!attribution) return '';
  return hasReaderCard ? removedPersonNoteForName(attribution.name)
    : removedPersonIdentityNote({ ...attribution, role: 'removed_identity' });
}
export function appendRemovedPersonAnswerNote(answer, question, { blocked = false, hasReaderCard = true } = {}) {
  const text = String(answer == null ? '' : answer);
  if (blocked || !text.trim()) return text;
  const note = removedPersonAnswerNote(question, { hasReaderCard });
  if (!note || text.includes(note)) return text;
  return text + '\n\n' + note;
}

// B4 P3-25: only notes already selected by a successful answer path move here.
// The finalizer runs after all server prose suffixes, and cards are attached
// afterward. Note-free text is returned byte-for-byte, and no answer is invented.
export function moveRemovedPersonNotesToEnd(answer) {
  const text = String(answer == null ? '' : answer);
  let body = text;
  const notes = [];
  for (const person of removedSources.persons || []) {
    const short = removedPersonIdentityNote({ id: person.id, name: person.canonical, role: 'removed_identity' });
    const long = removedPersonNoteForName(person.canonical);
    const hasLong = !!long && body.includes(long);
    const hasShort = !!short && body.includes(short);
    if (!hasLong && !hasShort) continue;
    for (const note of [long, short]) if (note) body = body.split(note).join('');
    notes.push(hasLong ? long : short);
  }
  if (!notes.length) return text;
  body = body.replace(/\n[\t ]+\n/gu, '\n\n').replace(/\n{3,}/gu, '\n\n').trim();
  return (body ? body + '\n\n' : '') + notes.join('\n\n');
}
export function shouldDropLibraryHit(hit, blockedBookIds = new Set()) {
  const source = hit && typeof hit === 'object' ? hit : {};
  const provenance = source.provenance && typeof source.provenance === 'object' ? source.provenance : {};
  const subjectId = String(source.subject_id || source.subjectId || provenance.subject_id || provenance.subjectId || '');
  const atomId = String(source.atom_id || source.atomId || provenance.atom_id || provenance.atomId || '');
  return REMOVED_BOOK_IDS.has(subjectId) || REMOVED_ATOM_IDS.has(atomId) || blockedBookIds.has(subjectId);
}
