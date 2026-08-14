// Domain-first, stored-fiqh retrieval. Candidate rank is never evidence: every record must pass
// the topical contract below, and every reader sentence is rebuilt from an exact support span in
// the accepted Evidence Pack. This module does no public search, fetch or source-adapter work.

import { planAsk } from './ask-plan.js';
import { isReligiousText, isShortFollowUp, normalizeArabic } from './route-classify.js';
import { ROSTER } from './policy/entities.js';
import { isFrozenWorshipQuestion } from './policy/referral-tail.js';
import { identitySubject, worldLookupAllowed } from './policy/name-presence.js';
import { takhrijSpans } from './takhrij-lock.js';
import { isStoredCorpusRecord, searchStoredCorpus } from './encyclopedia.js';

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

const MODE_PROFILES = Object.freeze({
  brief: Object.freeze({ id: 'brief', maxTokens: 900, claims: 1, length: 'اختر أقل عدد من المقاطع التي يكتمل بها الجواب الموجز.' }),
  normal: Object.freeze({ id: 'normal', maxTokens: 1500, claims: 2, length: 'اختر المقاطع اللازمة لجواب معتدل بلا تكرار.' }),
  deep: Object.freeze({ id: 'deep', maxTokens: 3000, claims: 3, length: 'اختر مقاطع أكثر تفصيلًا، ولا تتجاوز ما يثبته النص.' }),
  scholar: Object.freeze({ id: 'scholar', maxTokens: 4096, claims: 4, length: 'اختر مقاطع الدراسة والتفصيل المتاحة في النص، بلا إنشاء خلاف أو نسبة.' }),
});

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
const ADHKAR_REQUEST = /^(?:(?:ما\s+هي|اعطني|هات|اذكر\s+لي|اكتب)\s+)?(?:ال)?اذكار\s+(?:الصباح|المساء|النوم|الاستيقاظ)(?:\s+(?:كامله|مختصره))?$/u;
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

function stripPrefixes(value) {
  let token = String(value || '');
  if (/^(?:وال|فال|بال|كال|لل)/u.test(token) && token.length > 5) token = token.replace(/^(?:وال|فال|بال|كال|لل)/u, '');
  else if (/^ال/u.test(token) && token.length > 4) token = token.slice(2);
  else if (/^[وفبل]/u.test(token) && token.length > 4) token = token.slice(1);
  return token;
}

function canonicalToken(raw) {
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

function topicClause(value, person) {
  const cleaned = withoutPerson(value, person);
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

export function classifyReligiousRuntime(question, plan, lexicalRoute) {
  const folded = norm(question);
  const identity = identitySubject(question);
  if (identity && worldLookupAllowed(identity)) return 'GENERAL';
  if (lexicalRoute !== 'DEEN' && !isReligiousText(question)) return 'GENERAL';
  if (QURAN_REQUEST.test(folded)) return 'LOCAL_QURAN';
  if (ADHKAR_REQUEST.test(folded)) return 'LOCAL_ADHKAR';
  if (isFrozenWorshipQuestion(question)) return 'LOCAL_WORSHIP';
  if ((plan && plan.purpose === 'hadith')
    || /(?:صحه|تخريج|درجه|شرح|معني)\s+(?:هذا\s+)?(?:ال)?حديث|^\s*حديث(?:\s|$)/u.test(folded)) return 'HADITH';
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
  const currentPerson = ambiguousScholar
    ? { id: '', display: '', mentioned: false }
    : personFromPlan(plan);
  let resolvedScholar = currentPerson;
  let carried = false;
  let antecedent = '';
  let resolvedTopic = topicClause((plan && plan.topic) || currentQuestion, currentPerson) || topicClause(currentQuestion, currentPerson);
  let relation = relationFor(plan, currentPerson);

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
  const minimumMatches = keys.length === 1 ? 1 : 2;
  if (matched.length < minimumMatches || coverage < (2 / 3) || window > MAX_LOCAL_WINDOW) {
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
  const base = {
    context,
    searchQuery,
    storedCorpusCalls: searchQuery ? 1 : 0,
    candidateRecordIds: candidates.map((record) => record.id),
    evidencePackIds: accepted.map((entry) => entry.record.id),
    accepted,
    answerabilityEvaluatorCalls: selection.evaluatorCalls,
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
