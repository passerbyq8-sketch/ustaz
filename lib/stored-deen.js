// Domain-first, stored-fiqh retrieval. Candidate rank is never evidence: every record must pass
// the topical contract below, and every reader sentence is rebuilt from an exact support span in
// the accepted Evidence Pack. This module does no public search, fetch or source-adapter work.

import { planAsk } from './ask-plan.js';
import { isReligiousText, isShortFollowUp, normalizeArabic } from './route-classify.js';
import { ambiguousReligiousHits, foldAffixes, isRulingFrame, stripFormulas } from './route-classify.js';
import { DIALECT_TO_MSA, NARRATIVE_FRAME_TOKENS } from './data/lexicon-ar.js';
import { ROSTER } from './policy/entities.js';
import { isFrozenWorshipQuestion } from './policy/referral-tail.js';
import { identitySubject, worldLookupAllowed } from './policy/name-presence.js';
import { takhrijSpans } from './takhrij-lock.js';
import { isStoredCorpusRecord, searchStoredCorpus } from './encyclopedia.js';
import { resolveFatwaScholar } from './fatwa-contract.js';

export const NO_STORED_EVIDENCE =
  'لا يوجد في المصادر المخزنة لدي الآن نص كافٍ للإجابة عن هذا السؤال.';

export const STORED_DEEN_METRICS = Object.freeze({
  publicSourceSearchCalls: 0,
  publicSourceFetchCalls: 0,
  externalSourceAdapterCalls: 0,
});

const SOURCE_SITE = 'الموسوعة الفقهية الكويتية';
const MAX_CANDIDATES = 18;
const MAX_EVIDENCE_RECORDS = 3;
const MAX_SUPPORT_QUOTE = 900;
const MAX_LOCAL_WINDOW = 32;

// Looked up by a caller-supplied string, so the registry must not inherit. As a plain object
// literal it reached Object.prototype: MODE_PROFILES['constructor'] answered with a function and
// MODE_PROFILES['toString'] with a method, both truthy, so the || fallback below never fired and a
// poisoned depth returned a non-profile whose maxTokens and claims are undefined. The seal belongs
// in the record itself, not in a check at the one call site: a null-prototype record has nothing to
// inherit, so every bracket read is safe now and stays safe for any reader added later.
const MODE_PROFILES = Object.freeze(Object.assign(Object.create(null), {
  brief: Object.freeze({ id: 'brief', maxTokens: 900, claims: 1, length: 'اختر أقل عدد من المقاطع التي يكتمل بها الجواب الموجز.' }),
  normal: Object.freeze({ id: 'normal', maxTokens: 1500, claims: 2, length: 'اختر المقاطع اللازمة لجواب معتدل بلا تكرار.' }),
  deep: Object.freeze({ id: 'deep', maxTokens: 3000, claims: 3, length: 'اختر مقاطع أكثر تفصيلًا، ولا تتجاوز ما يثبته النص.' }),
  scholar: Object.freeze({ id: 'scholar', maxTokens: 4096, claims: 4, length: 'اختر مقاطع الدراسة والتفصيل المتاحة في النص، بلا إنشاء خلاف أو نسبة.' }),
}));

const STOP = new Set([
  'ما', 'ماذا', 'هو', 'هي', 'هل', 'من', 'في', 'عن', 'حول', 'علي', 'الى', 'الي',
  'مع', 'بين', 'عند', 'هذا', 'هذه', 'ذلك', 'تلك', 'ثم', 'او', 'و', 'ف', 'ب', 'ل',
  'راي', 'قول', 'قال', 'يقول', 'الشيخ', 'شيخ', 'العالم', 'الامام', 'الدكتور',
  'فتوي', 'حكم', 'احكام', 'الحكم', 'الدليل', 'دليل', 'المصدر', 'مصدر', 'المساله',
  'اقصد', 'اعني', 'اريد', 'يريد', 'ابي', 'فما', 'فهل', 'اذا', 'ان', 'انه', 'انها',
  'له', 'لها', 'به', 'بها', 'منه', 'منها', 'عنه', 'عنها', 'الذي', 'التي', 'الذين',
  'عام', 'عامه', 'فقط', 'الان', 'لدي', 'لديك',
]);

const QUESTION_FRAME = /^(?:(?:ما\s+(?:هو\s+)?(?:راي|قول))|(?:ماذا\s+(?:قال|يقول))|(?:هل\s+(?:قال|افتي))|(?:(?:اريد|ابي)\s+(?:راي|قول))|(?:راي|قول))\s+.{1,100}?\s+(?:في|فيمن|عن|حول)\s+(.+)$/u;
const QURAN_REQUEST = /(?:اكتب|اقرا|اقرأ|اتل|اعطني|هات|اذكر)\s+(?:(?:لي|لنا)\s+)?(?:ايه|الايه|سوره|السوره)|(?:ايه|الايه)\s+الكرسي\s+(?:كامله|كاملة)|(?:نص|تلاوه)\s+(?:ايه|سوره)/u;
const ADHKAR_REQUEST = /^(?:(?:ما\s+هي|اعطني|هات|اذكر\s+لي|اكتب|علمني|علميني)\s+)?(?:ال)?اذكار\s+(?:الصباح|المساء|النوم|الاستيقاظ)(?:\s+(?:كامله|مختصره))?$/u;
const URL_OR_SOURCE = /(?:<\/?source\b|https?:\/\/|www\.)/iu;
const INTERNAL_EXPLANATION = /(?:evidence\s*pack|record\s+attached|الملف\s+المرفق|المرشح\s+غير\s+موهل|اليه\s+الاسترجاع)/iu;

function textOf(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((block) => (block && block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .join(' ');
}

export function latestUserTurns(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && message.role === 'user')
    .map((message) => textOf(message).trim())
    .filter(Boolean)
    .slice(-2);
}

function norm(value) {
  return normalizeArabic(String(value == null ? '' : value));
}

// One bounded semantic family for the common names of the face-veil question. This changes only
// retrieval vocabulary; it contains no ruling and grants no candidate admission by itself.
export function isFaceVeilTopic(value) {
  const folded = norm(value);
  return /(?:^|\s)النقاب(?:\s|$)/u.test(folded)
    || /(?:تغطيه|ستر|كشف)\s+(?:وجه|الوجه)(?:\s+المراه)?/u.test(folded)
    || /(?:وجه|الوجه)\s+والكفين/u.test(folded);
}

export function canonicalStoredTopic(value) {
  return isFaceVeilTopic(value) ? 'هل النقاب واجب' : norm(value);
}

function stripPrefixes(value) {
  let token = String(value || '');
  if (/^(?:وال|فال|بال|كال|لل)/u.test(token) && token.length > 5) token = token.replace(/^(?:وال|فال|بال|كال|لل)/u, '');
  else if (/^ال/u.test(token) && token.length > 4) token = token.slice(2);
  else if (/^[وفبل]/u.test(token) && token.length > 4) token = token.slice(1);
  return token;
}

// ── A FOUR-LETTER ROOT BEHIND A ONE-LETTER PREFIX (أ-٤ · §٣) ────────────────
//
// stripPrefixes() removes a single-letter و/ف/ب/ل only from a token of five letters or more, so
// «فبيع»، «وبيع»، «ببيع» never fold to «بيع». The ruling sentence carrying one of them is then
// dropped from the relevance candidates BEFORE ranking runs — which is the measured ceiling on
// «خلاصة الحكم» that أ-٤ recorded and could not lift from inside its own item.
//
// The obvious repair — lower the threshold to four — is measured WRONG here, in two ways:
//   * it folds words whose و/ف/ب/ل is a radical, not a prefix: «وضوء» ⟶ «ضوء»، «واحد» ⟶ «احد»;
//   * and it does so ASYMMETRICALLY. «الوضوء» already folds to «وضوء» by the ال branch, so the
//     definite form and the bare form would stop meeting each other — the change would BREAK
//     matches that work today, not merely add doubtful ones.
//
// So the shorter reading is offered as an ADDITIONAL form, never as a replacement. A caller that
// matches on any form gains «فبيع» ↔ «بيع» and keeps «وضوء» ↔ «الوضوء» intact: this can only add
// matches, never remove one. The folding used for canonical identity is deliberately untouched.
export function canonicalTokenForms(raw) {
  const primary = canonicalToken(raw);
  const forms = [primary];
  const folded = norm(raw);
  // Exactly the gap stripPrefixes leaves: length 5+ already strips, length 3 or less has no
  // remaining word to strip to.
  if (folded.length === 4 && /^[وفبل]/u.test(folded)) {
    const shorter = canonicalToken(folded.slice(1));
    if (shorter && shorter !== primary) forms.push(shorter);
  }
  return forms;
}

export function canonicalToken(raw) {
  let token = stripPrefixes(norm(raw));
  if (token.endsWith('اتين') || token.endsWith('اتان')) token = token.slice(0, -4) + 'اه';
  else if (token.endsWith('وات')) token = token.slice(0, -3) + 'اه';
  else if (token.endsWith('ات') && token.length > 5) token = token.slice(0, -2) + 'اه';
  else if ((token.endsWith('ين') || token.endsWith('ون') || token.endsWith('ان')) && token.length > 5) token = token.slice(0, -2);
  return token;
}

function normalizedWords(value) {
  return norm(value).split(/\s+/u).map(stripPrefixes).filter(Boolean);
}

function safePersonName(value) {
  const clean = String(value || '').replace(/[<>\r\n]/gu, ' ').replace(/\s+/gu, ' ').trim();
  const words = clean.split(/\s+/u).filter(Boolean);
  return words.length > 0 && words.length <= 8 && clean.length <= 90 ? clean : '';
}

function displayForEntity(entity) {
  if (!entity) return '';
  const roster = ROSTER.find((entry) => entry.canonicalId === entity.canonicalId);
  return safePersonName((roster && roster.display) || entity.display || entity.surface || '');
}

function personFromPlan(plan) {
  const people = (plan && Array.isArray(plan.entities) ? plan.entities : [])
    .filter((entity) => entity && entity.targetType === 'person');
  const entity = people.find((item) => item.role === 'authority') || people[0];
  if (entity) {
    return {
      id: String(entity.canonicalId || ''),
      display: displayForEntity(entity),
      mentioned: true,
    };
  }
  const raw = plan && plan.attributionMode !== 'none'
    ? safePersonName(plan.attribution && plan.attribution.scholarName)
    : '';
  return raw ? { id: '', display: raw, mentioned: true } : { id: '', display: '', mentioned: false };
}

function hasAmbiguousCurrentPerson(plan) {
  if (plan && plan.scholarStatus === 'ambiguous') return true;
  const people = (plan && Array.isArray(plan.entities) ? plan.entities : [])
    .filter((entity) => entity && entity.targetType === 'person');
  const distinct = new Set(people.map((entity) => String(
    entity.canonicalId || displayForEntity(entity) || entity.surface || '',
  )).filter(Boolean));
  return distinct.size > 1;
}

function withoutPerson(value, person) {
  let out = norm(value);
  const surfaces = [];
  if (person && person.display) surfaces.push(norm(person.display));
  for (const surface of surfaces.sort((a, b) => b.length - a.length)) {
    if (surface) out = out.split(surface).join(' ');
  }
  return out.replace(/\s+/gu, ' ').trim();
}

// ── ONE NORMALISATION LAYER BEFORE SCORING AND BEFORE THE QUERY (أ-٥) ───────
//
// Both corpora are written in MSA; readers write Gulf. MEASURED on rows 12 and 13 of the matrix:
// «الصايغ», «طقم», «المصنعية», «دريشة» reach no stored text at all, while the material itself is
// there (61 admissible gold records measured). The matcher is exact-token by design — that is
// what stops «الجمعة» standing in for «الجمع» — so a dialect surface simply never matches, and no
// amount of loosening the matcher would fix it without breaking what the matcher is for.
//
// So the QUESTION is moved towards the corpora rather than the corpora towards the question. The
// pairs live in lib/data/lexicon-ar.js as data; nothing here is keyed to a question, and this
// touches retrieval vocabulary ONLY — never a single byte a reader is shown.
//
// The courtesy formulas go first, and that is not cosmetic. MEASURED on row 14: the reader opened
// with «السلام عليكم ورحمة الله وبركاته», and the stored path accepted the encyclopaedia article
// «سَلاَم» — the greeting outranked the question. The router has stripped these formulas since it
// was written, for exactly this reason; the retrieval side never did.
const DIALECT_MAP = new Map(DIALECT_TO_MSA);
const NARRATIVE_FRAME = new Set(NARRATIVE_FRAME_TOKENS);

export function normalizeQueryText(value) {
  const folded = stripFormulas(normalizeArabic(String(value == null ? '' : value)));
  if (!folded) return '';
  const out = [];
  for (const word of folded.split(/\s+/u)) {
    if (!word) continue;
    // The surface, then every prefix/suffix fold of it — the router's own foldAffixes, not a
    // second copy. Without this a table would have to carry «طقم», «طقمك», «الطقم», «وطقمي»…
    // separately: a list per inflection, which is exactly the shape this file exists to avoid.
    let mapped = word;
    for (const form of [word, ...foldAffixes(word), stripPrefixes(word)]) {
      if (DIALECT_MAP.has(form)) { mapped = DIALECT_MAP.get(form); break; }
    }
    if (mapped) out.push(mapped);
  }
  return out.join(' ').replace(/\s+/gu, ' ').trim();
}

function topicClause(value, person) {
  const cleaned = normalizeQueryText(withoutPerson(value, person));
  const framed = cleaned.match(QUESTION_FRAME);
  return (framed ? framed[1] : cleaned).replace(/\s+/gu, ' ').trim();
}

export function topicTerms(value, person = null) {
  const terms = [];
  const clause = topicClause(value, person);
  let words = normalizedWords(clause);
  // In a corrective turn, the requested act after «يريد» is the topic head; the words before it
  // are qualifications. Preserve all of them, but do not let «المسافر» outrank «الجمع» merely
  // because the reader stated the qualification first.
  if (/^(?:اقصد|اعني)(?:\s|$)/u.test(norm(clause))) {
    const pivot = words.findIndex((word) => word === 'يريد' || word === 'اريد');
    if (pivot >= 0 && pivot + 1 < words.length) words = [...words.slice(pivot + 1), ...words.slice(0, pivot)];
  }
  for (const raw of words) {
    const key = canonicalToken(raw);
    if (!key || key.length < 3 || STOP.has(raw) || STOP.has(key)) continue;
    // أ-٥ — the narration around the question is not the question. See NARRATIVE_FRAME_TOKENS.
    if (NARRATIVE_FRAME.has(raw) || NARRATIVE_FRAME.has(key)) continue;
    if (!terms.some((term) => term.key === key)) terms.push({ raw, key });
  }
  return terms;
}

function connectedContinuation(currentQuestion, previousQuestion, currentPerson, previousPerson) {
  if (!isShortFollowUp(currentQuestion) || !isReligiousText(previousQuestion)) return false;
  if (currentPerson.mentioned) return false;
  const current = topicTerms(currentQuestion, currentPerson);
  const previous = topicTerms(previousQuestion, previousPerson);
  const previousKeys = new Set(previous.map((term) => term.key));
  if (current.some((term) => previousKeys.has(term.key))) return true;
  const folded = norm(currentQuestion);
  if (/^(?:وماذا|ماذا)\s+(?:عنه|عنها|فيه|فيها)$/u.test(folded)) return true;
  // A corrective turn can consist only of qualifications. It remains attached only when it does
  // not introduce a fresh ruling frame; an independent «ما حكم …» is always a topic switch.
  return /^(?:اقصد|اعني)(?:\s|$)/u.test(folded)
    && !/^(?:اقصد|اعني)\s+ما\s+حكم(?:\s|$)/u.test(folded);
}

function relationFor(plan, person) {
  if (person && person.display && plan && plan.claimRelation === 'ABOUT_ENTITY') return 'PERSON_STANCE';
  if (person && person.display && (plan && (plan.claimRelation === 'BY_ENTITY' || plan.attributionMode === 'namedScholarOpinion'))) {
    return 'PERSON_OPINION';
  }
  return 'FIQH';
}

// ── AN ATTRIBUTED POSITION IS PROVED BY THE PLAN AND THE ROSTER (CX-01) ─────
//
// MEASURED on the seventeen-question matrix: «ما هو رأي الشيخ ابن عثيمين في وجوب تغطية وجه
// المرأة؟» and «رأي ابن باز في الجمع للمسافر» both returned GENERAL — asking a named muftī for
// his ruling was answered off the unsourced path, from the model's memory, because neither
// sentence happens to contain a word from the hand-written DEEN vocabulary («وجوب» is
// deliberately absent from it, and «الجمع» never was in it).
//
// The domain therefore cannot rest on a lexical coincidence. What actually makes those two
// questions religious is STRUCTURAL and is already computed twice over before this line: the
// planner typed the turn as a request for a person's POSITION, and the fatwa roster resolves that
// person to a muftī whose published fatwas this product carries. Neither half suffices — an
// opinion frame around an unregistered name is not a fatwa request, and a roster name mentioned
// with no position frame («من هو ابن باز؟») is an identity question. Together they are exactly
// the shape of «ما رأي فلان في كذا؟», whatever the topic vocabulary happens to be.
//
// The two frames are separate because the planner types them separately: the explicit opinion
// request («ما رأي فلان في …») arrives as namedScholarOpinion/BY_ENTITY, while the bare nominal
// («رأي فلان في …») arrives as ABOUT_ENTITY with the attribution record still marked attributed.
// Reading only the first is what lost row 16.
export function attributedFatwaScholar(question, plan) {
  if (!plan) return null;
  const attributed = plan.attributionMode === 'namedScholarOpinion'
    || plan.claimRelation === 'BY_ENTITY'
    || (plan.claimRelation === 'ABOUT_ENTITY' && !!(plan.attribution && plan.attribution.attributed));
  if (!attributed) return null;
  const person = (Array.isArray(plan.entities) ? plan.entities : [])
    .find((entity) => entity && entity.targetType === 'person');
  return resolveFatwaScholar(question, person && person.canonicalId) || null;
}

// ── THE CLOSED SURFACE ANSWERS THE PURE «HOW» AND NOTHING ELSE (CX-02) ──────
//
// LOCAL_WORSHIP prints a FROZEN TEMPLATE — the fixed steps of one act — and returns before any
// retrieval runs at all. That is exactly right for «كيف أصلي صلاة العصر؟» and exactly wrong for a
// question that merely happens to contain those words.
//
// MEASURED, XC-10: all nineteen derived case questions satisfied the former subject + manner
// condition and reached LOCAL_WORSHIP. Fifteen of them returned the 30-character salah tag.
// The shared predicate now accepts only a whole general-description grammar; a condition,
// exception, incident, specialised prayer, or ruling frame fails that grammar and continues.
// The router's ruling predicate remains a second independent veto at the decision point.

export function isPureMannerRequest(question) {
  const folded = norm(question);
  if (!folded) return false;
  return isFrozenWorshipQuestion(question) && !isRulingFrame(question);
}

// ── THE PLANNER'S PURPOSE, RE-ASKED WITHOUT THE HOMOGRAPH ───────────────────
//
// The planner carries its own religious-purpose detector, and it shares the router's homograph
// problem: MEASURED, `planAsk('كم شهر في السنة؟').purpose === 'fatwa'` — the calendar year read
// as the Sunnah, exactly as the router read it, from the same folded string. So on row 5 the
// lexical route was corrected while `plannedReligious` alone still carried the question into the
// fatwa path, and the two signals were never independent to begin with.
//
// Rather than copy the tier into a second place, ASK THE PLANNER AGAIN with the ambiguous tokens
// taken out. A purpose that survives their removal rests on something else and is real evidence;
// a purpose that collapses with them was only ever the homograph, and does not get a second vote.
// Questions containing no ambiguous token — the overwhelming majority — take neither the probe
// nor its cost, and reach the identical answer they did before.
// It takes the planner's verdict as an argument rather than re-deriving it, so the single line
// that computes that verdict stays where it has always been, in one piece, inside
// classifyReligiousRuntime. guards/stored-deen-sub-suite.cjs mutates that exact line to prove the
// domain rule is load-bearing, and a mutation seam is part of the code's contract with its guard:
// dissolving it would disarm a check without anybody deciding to.
function restsOnMoreThanAHomograph(question, planned, plan) {
  if (!planned) return false;
  const ambiguous = ambiguousReligiousHits(question);
  if (!ambiguous.length) return true;
  const withoutAmbiguous = String(question || '')
    .split(/\s+/u)
    .filter((word) => !ambiguousReligiousHits(word).length)
    .join(' ')
    .trim();
  if (!withoutAmbiguous) return false;
  const reprobed = planAsk([{ role: 'user', content: withoutAmbiguous }], { policyEnabled: true });
  return ['fatwa', 'tafsir', 'hadith'].includes(reprobed.purpose);
}

export function classifyReligiousRuntime(question, plan, lexicalRoute) {
  const folded = norm(question);
  if (QURAN_REQUEST.test(folded)) return 'LOCAL_QURAN';
  if (ADHKAR_REQUEST.test(folded)) return 'LOCAL_ADHKAR';
  // A manner word such as «أريد» must not turn a named-scholar ruling into a
  // frozen prayer template.  The current-turn attribution plan wins over the
  // generic manner detector; only a person-free request for the procedure is
  // eligible for the local worship surface.
  const namedOpinion = !!(plan && (plan.attributionMode === 'namedScholarOpinion'
    || plan.claimRelation === 'BY_ENTITY'));
  if (!namedOpinion && isPureMannerRequest(question)) return 'LOCAL_WORSHIP';
  if ((plan && plan.purpose === 'hadith')
    || /(?:صحه|تخريج|درجه|شرح|معني)\s+(?:هذا\s+)?(?:ال)?حديث|^\s*حديث(?:\s|$)/u.test(folded)) return 'HADITH';
  const plannedReligious = !!(plan && ['fatwa', 'tafsir', 'hadith'].includes(plan.purpose));
  const plannedProven = restsOnMoreThanAHomograph(question, plannedReligious, plan);
  const authority = (plan && Array.isArray(plan.entities) ? plan.entities : [])
    .find((entity) => entity && entity.targetType === 'person' && entity.role === 'authority');
  const fatwaScholar = resolveFatwaScholar(question, authority && authority.canonicalId);
  // A worldly opinion frame stays GENERAL even when the named person also happens to be a
  // registered scholar: «رأي ابن باز في هندسة الجسور» is still engineering.  Identity may
  // select a scholar only after the domain has independently been established as religious.
  // Sparse religious topics (النقاب، السقط قبل ثمانين يومًا) are covered by the lexical and
  // deterministic religious predicates, not by allowing a name to force the domain.
  const identity = identitySubject(question);
  if (!plannedProven && !authority && !fatwaScholar && identity && worldLookupAllowed(identity)) return 'GENERAL';
  // CX-01. The plan+roster proof above stands on its own: a request for a rostered muftī's
  // position reaches the attributed fatwa path even when no lexical term marks the topic. Where
  // his corpus holds nothing on the subject, that path refuses honestly by name — which is the
  // outcome this product owes a reader who asked a named shaykh, and strictly better than an
  // unsourced GEN answer written in his shadow.
  if (attributedFatwaScholar(question, plan)) return 'STORED_FIQH';
  if (lexicalRoute !== 'DEEN' && !isReligiousText(question) && !plannedProven) return 'GENERAL';
  return 'STORED_FIQH';
}

export function resolveStoredContext(messages, { currentPlan = null, lexicalRoute = '' } = {}) {
  const turns = latestUserTurns(messages);
  const currentQuestion = turns[turns.length - 1] || '';
  const previousQuestion = turns.length > 1 ? turns[0] : '';
  const plan = currentPlan || planAsk([{ role: 'user', content: currentQuestion }], { policyEnabled: true });
  // Never guess between two people in the current turn. The old path asked a deterministic menu;
  // this path instead fails closed before retrieval, without choosing either person or reviving an
  // older one from history.
  const ambiguousScholar = hasAmbiguousCurrentPerson(plan);
  let currentPerson = ambiguousScholar
    ? { id: '', display: '', mentioned: false }
    : personFromPlan(plan);
  // The fatwa corpus contains scholars whose sites are intentionally not live-search
  // sources. Its measured alias table may still identify them without turning their
  // domains into Brave targets.
  if (!ambiguousScholar && !currentPerson.mentioned) {
    const fatwaScholar = resolveFatwaScholar(currentQuestion);
    if (fatwaScholar) currentPerson = {
      id: fatwaScholar.canonicalId,
      display: fatwaScholar.name,
      mentioned: true,
    };
  }
  let resolvedScholar = currentPerson;
  let carried = false;
  let antecedent = '';
  let resolvedTopic = topicClause((plan && plan.topic) || currentQuestion, currentPerson) || topicClause(currentQuestion, currentPerson);
  let relation = relationFor(plan, currentPerson);
  if (currentPerson.mentioned && /(?:ما\s+(?:هو\s+)?(?:راي|قول)|ماذا\s+(?:قال|يقول)|هل\s+(?:قال|افتي))/u.test(norm(currentQuestion))) {
    relation = 'PERSON_OPINION';
  }
  // ABOUT_ENTITY asks about the person, so his name is part of the topic rather than
  // attribution boilerplate to strip. This is what keeps a previous Steve Jobs turn out
  // while preserving Ibn Taymiyyah in the current live-search query.
  if (plan && plan.claimRelation === 'ABOUT_ENTITY') {
    resolvedTopic = norm((plan && plan.topic) || currentQuestion);
  }

  if (previousQuestion && !ambiguousScholar && !currentPerson.mentioned && isShortFollowUp(currentQuestion)) {
    const previousPlan = planAsk([{ role: 'user', content: previousQuestion }], { policyEnabled: true });
    const previousPerson = personFromPlan(previousPlan);
    if (connectedContinuation(currentQuestion, previousQuestion, currentPerson, previousPerson)) {
      carried = true;
      resolvedScholar = previousPerson;
      relation = relationFor(previousPlan, previousPerson);
      const previousTopic = topicClause(previousPlan.topic || previousQuestion, previousPerson);
      const currentKeys = new Set(topicTerms(resolvedTopic, currentPerson).map((term) => term.key));
      const previousTerms = topicTerms(previousTopic, previousPerson);
      const overlaps = previousTerms.some((term) => currentKeys.has(term.key));
      if (!overlaps) {
        antecedent = previousTerms.slice(0, 4).map((term) => term.raw).join(' ');
        resolvedTopic = [previousTopic, resolvedTopic].filter(Boolean).join(' — ');
      }
    }
  }

  const runtime = classifyReligiousRuntime(currentQuestion, plan, lexicalRoute);
  resolvedTopic = canonicalStoredTopic(resolvedTopic);
  return {
    runtime,
    currentQuestion,
    resolvedDomain: runtime === 'GENERAL' ? 'GENERAL' : 'DEEN',
    resolvedScholar: resolvedScholar.display ? resolvedScholar : null,
    resolvedTopic,
    relation,
    carried,
    ambiguousScholar,
    antecedent,
    currentPlan: plan,
  };
}

export function buildStoredSearchQuery(context) {
  const tokens = [];
  if (context && context.antecedent) {
    for (const term of topicTerms(context.antecedent)) {
      for (const value of [term.raw, term.key]) {
        if (value && !tokens.includes(value)) tokens.push(value);
      }
    }
  }
  const current = topicTerms(context && context.resolvedTopic || context && context.currentQuestion || '', context && context.resolvedScholar);
  for (const term of current) {
    for (const value of [term.raw, term.key]) {
      if (value && !tokens.includes(value)) tokens.push(value);
    }
  }
  return tokens.slice(0, 24).join(' ');
}

function tokenOccurrences(value, wantedKeys) {
  const out = [];
  const words = normalizedWords(value);
  for (let index = 0; index < words.length; index++) {
    const key = canonicalToken(words[index]);
    if (wantedKeys.has(key)) out.push({ key, index });
  }
  return out;
}

function minimumWindow(occurrences, keys) {
  if (!keys.length) return Infinity;
  const counts = new Map();
  let held = 0;
  let left = 0;
  let best = Infinity;
  for (let right = 0; right < occurrences.length; right++) {
    const key = occurrences[right].key;
    const next = (counts.get(key) || 0) + 1;
    counts.set(key, next);
    if (next === 1) held++;
    while (held === keys.length && left <= right) {
      best = Math.min(best, occurrences[right].index - occurrences[left].index + 1);
      const leftKey = occurrences[left++].key;
      const remain = (counts.get(leftKey) || 0) - 1;
      counts.set(leftKey, remain);
      if (remain === 0) held--;
    }
  }
  return best;
}

function attributionMatches(record, scholar) {
  if (!record || !scholar || !scholar.display || !record.attributedTo) return false;
  const attributed = norm(record.attributedTo);
  return attributed === norm(scholar.display) || (scholar.id && attributed === norm(scholar.id));
}

export function assessStoredCandidate(record, context) {
  if (!isStoredCorpusRecord(record)) return { status: 'REJECT', reason: 'FORGED_RECORD' };
  const terms = topicTerms(context.resolvedTopic || context.currentQuestion, context.resolvedScholar);
  // The first three distinctive terms are the relation's core. Later terms are qualifications:
  // useful to ranking/evaluator prompts, but their absence must not erase a directly answering
  // article whose title and local clause establish the core.
  const keys = [...new Set(terms.map((term) => term.key))].slice(0, 3);
  if (!keys.length) return { status: 'REJECT', reason: 'NO_TOPIC' };
  if (context.relation === 'PERSON_STANCE' && !attributionMatches(record, context.resolvedScholar)) {
    return { status: 'REJECT', reason: 'ATTRIBUTION_REQUIRED' };
  }

  const wanted = new Set(keys);
  const occurrences = tokenOccurrences(`${record.term} ${record.text}`, wanted);
  const matched = keys.filter((key) => occurrences.some((item) => item.key === key));
  const coverage = matched.length / keys.length;
  const window = minimumWindow(occurrences.filter((item) => matched.includes(item.key)), matched);
  const titleKeys = new Set(normalizedWords(record.term).map(canonicalToken));
  const head = keys[0];
  const titleHeadMatch = titleKeys.has(head);
  // Every core term is load-bearing. Accepting two out of three made «بيع الأمانة»
  // evidence for «بيع الذهب بالتقسيط» merely because both contained بيع and ذهب in
  // unrelated clauses. Ranking may be fuzzy; admission may not be.
  const minimumMatches = keys.length;
  if (matched.length < minimumMatches || coverage < 1 || window > MAX_LOCAL_WINDOW) {
    return { status: 'REJECT', reason: 'TOPIC_MISMATCH', matched, coverage, window, titleHeadMatch };
  }
  if (keys.length === 1 && !titleHeadMatch) {
    return { status: 'REJECT', reason: 'SINGLE_BODY_TOKEN', matched, coverage, window, titleHeadMatch };
  }
  if (titleHeadMatch) {
    return { status: 'ACCEPT', reason: 'TITLE_AND_LOCAL_TOPIC', matched, coverage, window, titleHeadMatch };
  }
  return { status: 'BORDERLINE', reason: 'NEEDS_ANSWERABILITY', matched, coverage, window, titleHeadMatch };
}

function exactSupport(record, span) {
  const value = String(span || '').trim();
  if (!value || value.length > MAX_SUPPORT_QUOTE || URL_OR_SOURCE.test(value)) return '';
  const fields = [record.snippet, record.text].map((item) => String(item || ''));
  return fields.some((field) => field.includes(value)) ? value : '';
}

function quoteAddressesTopic(quote, context) {
  const keys = topicTerms(context.resolvedTopic || context.currentQuestion, context.resolvedScholar)
    .map((term) => term.key).filter((key, index, all) => all.indexOf(key) === index).slice(0, 3);
  if (!keys.length) return false;
  const occurrences = tokenOccurrences(quote, new Set(keys));
  const matched = [...new Set(occurrences.map((item) => item.key))];
  const need = keys.length === 1 ? 1 : Math.max(2, Math.ceil(keys.length * (2 / 3)));
  return matched.length >= need && minimumWindow(occurrences, matched) <= MAX_LOCAL_WINDOW;
}

async function acceptedEvidence(candidates, context, evaluator) {
  const accepted = [];
  const borderline = [];
  for (const record of candidates) {
    const relevance = assessStoredCandidate(record, context);
    if (relevance.status === 'ACCEPT') accepted.push({ record, relevance, answerabilitySpans: [] });
    else if (relevance.status === 'BORDERLINE') borderline.push({ record, relevance });
    if (accepted.length >= MAX_EVIDENCE_RECORDS) break;
  }
  let evaluatorCalls = 0;
  if (!accepted.length && borderline.length && typeof evaluator === 'function') {
    evaluatorCalls = 1;
    const candidate = borderline[0];
    let verdict = null;
    try {
      verdict = await evaluator({
        current_question: context.currentQuestion,
        resolved_domain: context.resolvedDomain,
        resolved_scholar: context.resolvedScholar,
        resolved_topic: context.resolvedTopic,
        relation: context.relation,
        candidate: {
          record_id: candidate.record.id,
          term: candidate.record.term,
          part: candidate.record.part,
          text: candidate.record.text,
          snippet: candidate.record.snippet,
          attributed_to: candidate.record.attributedTo,
        },
      });
    } catch {}
    const spans = verdict && verdict.answerable === true && Array.isArray(verdict.support_spans)
      ? verdict.support_spans.map((span) => exactSupport(candidate.record, span)).filter(Boolean)
      : [];
    if (spans.length && spans.every((span) => quoteAddressesTopic(span, context))) {
      accepted.push({ record: candidate.record, relevance: candidate.relevance, answerabilitySpans: spans });
    }
  }
  return { accepted, evaluatorCalls };
}

/** Retrieve and gate the 3,070-record local corpus without drafting an answer. */
export async function retrieveStoredFiqhEvidence(options = {}) {
  const context = options.context || {};
  if (context.ambiguousScholar) {
    return {
      context, searchQuery: '', storedCorpusCalls: 0, candidateRecordIds: [],
      evidencePackIds: [], accepted: [], answerabilityEvaluatorCalls: 0,
    };
  }
  const searchQuery = buildStoredSearchQuery(context);
  const retrieve = options.retrieve || searchStoredCorpus;
  const found = searchQuery
    ? await retrieve(searchQuery, { limit: MAX_CANDIDATES })
    : { records: [], recordCount: 0 };
  const candidates = Array.isArray(found && found.records)
    ? found.records.filter(isStoredCorpusRecord)
    : [];
  const selection = await acceptedEvidence(candidates, context, options.answerabilityEvaluator);
  const accepted = selection.accepted.slice(0, MAX_EVIDENCE_RECORDS);
  return {
    context,
    searchQuery,
    storedCorpusCalls: searchQuery ? 1 : 0,
    candidateRecordIds: candidates.map((record) => record.id),
    evidencePackIds: accepted.map((entry) => entry.record.id),
    accepted,
    answerabilityEvaluatorCalls: selection.evaluatorCalls,
  };
}

function evidencePack(accepted) {
  return accepted.map(({ record }) => ({
    record_id: record.id,
    source_type: record.sourceType,
    publisher: record.publisher,
    term: record.term,
    part: record.part,
    attributed_to: record.attributedTo,
    snippet: record.snippet,
    stored_text: record.text,
  }));
}

export function storedAnswerProfile(depth) {
  return MODE_PROFILES[depth] || MODE_PROFILES.normal;
}

export function buildStoredAnswerRequest(context, accepted, depth, { repair = false } = {}) {
  const profile = storedAnswerProfile(depth);
  const system = [
    'أنت منتقٍ لمقاطع دعم، لا مُنشئ فتوى. أعد JSON صالحًا فقط بهذا الشكل: {"claims":[{"record_id":"...","support_quote":"...","sentence":"..."}]}.',
    'support_quote يجب أن يكون مقتبسًا حرفيًّا متصلًا من stored_text أو snippet داخل السجل نفسه، وأن يجيب عن علاقة السؤال وقيده.',
    'لا تستخدم الذاكرة، ولا تضف حكمًا أو إجماعًا أو نسبة أو راوياً أو درجة أو تخريجًا غير موجود حرفيًّا في المقطع.',
    'لا تنشئ رابطًا أو وسم مصدر. sentence مسودة اختيارية؛ الخادم لن يرسلها، بل سيبني الجملة من support_quote المقبول.',
    profile.length,
    repair ? 'المحاولة السابقة لم تنتج مقطع دعم صالحًا. أصلح JSON مرة واحدة ولا تضف أي شرح.' : '',
  ].filter(Boolean).join('\n');
  return {
    profile,
    system,
    payload: {
      current_question: context.currentQuestion,
      resolved_domain: context.resolvedDomain,
      resolved_scholar: context.resolvedScholar
        ? { id: context.resolvedScholar.id || null, display: context.resolvedScholar.display }
        : null,
      resolved_topic: context.resolvedTopic,
      evidence_pack: evidencePack(accepted),
    },
  };
}

function parseClaims(raw) {
  let text = String(raw || '').trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last <= first) return [];
  text = text.slice(first, last + 1);
  let parsed;
  try { parsed = JSON.parse(text); } catch { return []; }
  return Array.isArray(parsed && parsed.claims) ? parsed.claims : [];
}

function unsupportedDraftSentence(sentence, record, context, quote) {
  const draft = String(sentence || '').trim();
  if (!draft) return false;
  if (URL_OR_SOURCE.test(draft) || INTERNAL_EXPLANATION.test(draft)) return true;
  if (context.resolvedScholar && /(?:قال|راي|افتي|نسب)(?:\s|$)/u.test(norm(draft))
    && !attributionMatches(record, context.resolvedScholar)) return true;
  const q = norm(quote);
  for (const span of takhrijSpans(draft)) {
    if (!q.includes(norm(span.phrase))) return true;
  }
  if (/(?:اجمع\s+العلماء|اجماع)/u.test(norm(draft)) && !/(?:اجمع\s+العلماء|اجماع)/u.test(q)) return true;
  return false;
}

export function validateStoredClaims(raw, accepted, context, depth) {
  const byId = new Map(accepted.map((entry) => [entry.record.id, entry]));
  const profile = storedAnswerProfile(depth);
  const valid = [];
  const rejectedDraftSentences = [];
  for (const claim of parseClaims(raw).slice(0, profile.claims)) {
    if (!claim || typeof claim !== 'object') continue;
    const entry = byId.get(String(claim.record_id || ''));
    if (!entry || !isStoredCorpusRecord(entry.record)) continue;
    const quote = exactSupport(entry.record, claim.support_quote);
    if (!quote || !quoteAddressesTopic(quote, context)) continue;
    if (context.relation === 'PERSON_STANCE' && !attributionMatches(entry.record, context.resolvedScholar)) continue;
    const badDraft = unsupportedDraftSentence(claim.sentence, entry.record, context, quote);
    if (badDraft) rejectedDraftSentences.push(String(claim.sentence || ''));
    if (!valid.some((item) => item.record.id === entry.record.id && item.quote === quote)) {
      valid.push({ record: entry.record, quote, draftRejected: badDraft });
    }
  }
  return { valid, rejectedDraftSentences };
}

function safeCardText(value, max = 180) {
  return String(value || '').replace(/[<>]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, max);
}

export function storedSourceCards(accepted, validatedUsedRecordIds) {
  const used = new Set(Array.isArray(validatedUsedRecordIds) ? validatedUsedRecordIds : []);
  const cards = [];
  for (const entry of accepted) {
    const record = entry && entry.record;
    if (!record || !used.has(record.id) || !isStoredCorpusRecord(record)) continue;
    if (record.sourceType !== 'stored_fiqh_encyclopedia_record' || !/^F\d{5}$/u.test(record.id)) continue;
    const id = safeCardText(record.id, 16).replace(/[^A-Z0-9]/gu, '');
    const term = safeCardText(record.term);
    const part = Number.isFinite(record.part) ? ` — الجزء ${record.part}` : '';
    cards.push({
      recordId: record.id,
      host: 'stored-fiqh-corpus',
      tag: `<source site="${SOURCE_SITE}" record="${id}">مادة ${term}${part}</source>`,
    });
  }
  return cards;
}

function scholarLead(scholar) {
  if (!scholar || !scholar.display) return '';
  const name = safePersonName(scholar.display);
  if (!name) return '';
  const preposition = norm(name).startsWith('ابن ') ? `ل${name}` : `لـ${name}`;
  return `لا يوجد في مصادري المخزنة نص منسوب ${preposition} في هذه المسألة، لكن الموجود في الموسوعة الفقهية المخزنة هو:`;
}

function sentenceFromSupport(record, quote) {
  const term = safeCardText(record.term, 120);
  const support = String(quote || '').trim();
  return `جاء في مادة «${term}» من الموسوعة الفقهية الكويتية: «${support}»`;
}

async function defaultGenerate(request, options, repair) {
  const response = await (options.fetchImpl || globalThis.fetch)(options.providerUrl, {
    method: 'POST',
    headers: options.headers,
    signal: options.signal,
    body: JSON.stringify({
      model: options.model,
      max_tokens: Math.min(request.profile.maxTokens, options.maxTokens || request.profile.maxTokens),
      ...(options.usePremium ? { output_config: { effort: options.effort === 'high' ? 'high' : 'medium' } } : {}),
      system: request.system,
      messages: [{ role: 'user', content: JSON.stringify(request.payload) }],
      stream: false,
    }),
  });
  if (!response || !response.ok) throw new Error(`upstream ${response && response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload && payload.content) ? payload.content : [])
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

export async function runStoredFiqhTurn(options = {}) {
  const context = options.context || {};
  if (context.ambiguousScholar) {
    return {
      context,
      searchQuery: '',
      storedCorpusCalls: 0,
      candidateRecordIds: [],
      evidencePackIds: [],
      accepted: [],
      answerabilityEvaluatorCalls: 0,
      ...STORED_DEEN_METRICS,
      outcome: 'NO_STORED_EVIDENCE',
      text: NO_STORED_EVIDENCE,
      cards: [],
      validatedUsedRecordIds: [],
      modelCallsForReligiousAnswer: 0,
    };
  }
  const local = await retrieveStoredFiqhEvidence(options);
  const { searchQuery, accepted } = local;
  const base = {
    context,
    searchQuery,
    storedCorpusCalls: local.storedCorpusCalls,
    candidateRecordIds: local.candidateRecordIds,
    evidencePackIds: local.evidencePackIds,
    accepted,
    answerabilityEvaluatorCalls: local.answerabilityEvaluatorCalls,
    ...STORED_DEEN_METRICS,
  };
  if (!accepted.length) {
    return {
      ...base,
      outcome: 'NO_STORED_EVIDENCE',
      text: NO_STORED_EVIDENCE,
      cards: [],
      validatedUsedRecordIds: [],
      modelCallsForReligiousAnswer: 0,
    };
  }

  const generate = typeof options.generate === 'function'
    ? options.generate
    : (request, meta) => defaultGenerate(request, options, meta.repair);
  let modelCalls = 0;
  let validation = { valid: [], rejectedDraftSentences: [] };
  let lastRaw = '';
  for (let attempt = 0; attempt < 2 && !validation.valid.length; attempt++) {
    const request = buildStoredAnswerRequest(context, accepted, options.depth, { repair: attempt === 1 });
    try {
      modelCalls++;
      lastRaw = await generate(request, { repair: attempt === 1, attempt });
      validation = validateStoredClaims(lastRaw, accepted, context, options.depth);
    } catch {
      break;
    }
    if (!String(lastRaw || '').trim()) break;
  }
  if (!validation.valid.length) {
    return {
      ...base,
      outcome: 'NO_STORED_EVIDENCE',
      text: NO_STORED_EVIDENCE,
      cards: [],
      validatedUsedRecordIds: [],
      rejectedDraftSentences: validation.rejectedDraftSentences,
      modelCallsForReligiousAnswer: modelCalls,
    };
  }

  const validatedUsedRecordIds = [...new Set(validation.valid.map((claim) => claim.record.id))];
  const body = validation.valid.map((claim) => sentenceFromSupport(claim.record, claim.quote)).join('\n\n');
  const attributed = context.resolvedScholar && accepted.some((entry) => attributionMatches(entry.record, context.resolvedScholar));
  const lead = context.resolvedScholar && !attributed ? scholarLead(context.resolvedScholar) : '';
  const text = [lead, body].filter(Boolean).join('\n\n').trim();
  const cards = storedSourceCards(accepted, validatedUsedRecordIds);
  if (!text || !cards.length) {
    return {
      ...base,
      outcome: 'NO_STORED_EVIDENCE',
      text: NO_STORED_EVIDENCE,
      cards: [],
      validatedUsedRecordIds: [],
      rejectedDraftSentences: validation.rejectedDraftSentences,
      modelCallsForReligiousAnswer: modelCalls,
    };
  }
  return {
    ...base,
    outcome: 'ANSWER',
    text,
    cards,
    validatedUsedRecordIds,
    rejectedDraftSentences: validation.rejectedDraftSentences,
    modelCallsForReligiousAnswer: modelCalls,
  };
}
