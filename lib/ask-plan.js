// lib/ask-plan.js
// STAGE A — WHAT IS BEING ASKED. One structure, built from the classifiers this project
// already has, so that the route can be chosen from a description of the request instead of
// from a single boolean.
//
// THE DEFECT THIS REPLACES. The request path used to ask one question — "did a scholar's name
// appear?" — and treat the answer as final. A name meant: stop, do not search, emit a fixed
// sentence. That is wrong in both directions at once:
//
//   * «ما رأي الشيخ عبدالمحسن العباد في الطلاق في الغضب؟» got the canned refusal without a
//     single search having been made, when the general ruling was available and citable and
//     the honest answer was "here is the ruling, and it is not attributed to him";
//   * «حديث من موقع الشيخ عبدالمحسن العباد» got it too, though it asks for MATERIAL from a
//     site and never asks for anybody's opinion;
//   * and a transient failure of the Ibn Uthaymeen adapter produced the same sentence, hiding
//     a general ruling that was there to be found.
//
// The protection that matters — never invent a scholar's position — is untouched and is
// enforced where it belongs: on the retrieved page, in lib/attribution.js's verifier. What
// changes is that a NAME no longer ends the search; it starts a more specific one.
//
// NOTHING HERE IS A SECOND ENGINE. purpose comes from lib/source-purpose.js, the attribution
// shape from lib/attribution.js, the specific-expression subject from lib/claim-gate.js, and
// the scholar-to-domain mapping from lib/source-registry.js. This file composes them.

import { classifyPurpose } from './source-purpose.js';
import { detectAttribution } from './attribution.js';
import { detectSubjectInThread, subjectSwallowsName } from './claim-gate.js';
import { findScholarDomain, findSource } from './source-registry.js';

// ── Reason codes ─────────────────────────────────────────────────────────────
// FOR LOGS AND GATES ONLY. None of these ever reaches a reader: they are the vocabulary the
// tests use to say WHICH path a question took, so that "it answered" and "it answered for the
// right reason" can be told apart.
export const REASON = Object.freeze({
  DIRECT_ATTRIBUTION_CONFIRMED: 'DIRECT_ATTRIBUTION_CONFIRMED',
  DIRECT_ATTRIBUTION_NOT_FOUND: 'DIRECT_ATTRIBUTION_NOT_FOUND',
  GENERAL_RULING_SUBSTITUTED: 'GENERAL_RULING_SUBSTITUTED',
  SOURCE_ROLE_MISMATCH: 'SOURCE_ROLE_MISMATCH',
  PAGE_NOT_DIRECT_EVIDENCE: 'PAGE_NOT_DIRECT_EVIDENCE',
  NO_VERIFIED_SOURCE: 'NO_VERIFIED_SOURCE',
  SAFE_REFERRAL_REQUIRED: 'SAFE_REFERRAL_REQUIRED',
  CLARIFICATION_REQUIRED: 'CLARIFICATION_REQUIRED',
});

// What kind of evidence answers this purpose, and what a source has to BE to supply it.
// Both are descriptive: the enforcement is lib/source-registry.js's scope filter and
// lib/source-page-gates.js's page admission, neither of which this file duplicates.
const EVIDENCE = {
  fatwa: 'fatwa-text',
  tafsir: 'tafsir-text',
  hadith: 'hadith-text',
  general: 'article-text',
};
const ROLE = {
  fatwa: 'fatwa-authority',
  tafsir: 'quran-scholarship',
  hadith: 'hadith-scholarship',
  general: 'general-scholarship',
};

// The reader's own words with the framing removed, so the topic is what is searched rather
// than the request wrapper. Deliberately conservative: it strips only the attribution frame,
// never a condition, a period or a number.
const FRAME = [
  /^\s*(?:ما|وما|ماهو|ماهي)\s*(?:هو|هي)?\s*(?:راي|رأي|قول|مذهب|اختيار|ترجيح|فتوي|فتوى|كلام|تفصيل)\s*/u,
  /^\s*(?:الشيخ|الشّيخ|شيخ|العلامه|العلامة|الامام|الإمام|الدكتور|الفقيه|المفتي|سماحه|سماحة|فضيله|فضيلة)\s*/u,
];
function stripFrame(question, entity) {
  let t = String(question == null ? '' : question).trim();
  for (const re of FRAME) t = t.replace(re, '');
  if (entity) {
    for (const w of String(entity).split(/\s+/).filter((x) => x.length >= 3)) {
      t = t.split(w).join(' ');
    }
  }
  return t.replace(/^\s*(?:في|عن|حول|بخصوص)\s+/u, '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {Array} messages the conversation
 * @returns {{
 *   purpose:'fatwa'|'tafsir'|'hadith'|'general',
 *   attributionMode:'none'|'namedScholarOpinion'|'materialFromScholarSite'|'unnamedScholarClaim',
 *   namedEntity:string, topic:string, requiredEvidence:string, sourceRole:string,
 *   officialDomain:string, hasDirectAdapter:boolean, attribution:object, claimSubject:object,
 *   needsClarification:boolean
 * }}
 */
export function planAsk(messages) {
  const attribution = detectAttribution(messages);
  const claimSubject = detectSubjectInThread(messages);
  const question = attribution.question || '';
  const purpose = classifyPurpose(question);

  let mode = attribution.mode || 'none';

  // THE EXPRESSION BEING ASKED ABOUT IS NOT THE PERSON WHO RULED ON IT. «حكم قول يا معطي لا
  // تبطي» captures «يا معطي لا تبطي» under the ordinary «قول فلان» pattern. This is the same
  // correction api/ask.js used to apply inline; it belongs here, so every caller and every
  // test sees one answer rather than two.
  if (mode === 'namedScholarOpinion' && subjectSwallowsName(claimSubject, attribution.scholarName)) {
    mode = 'none';
  }

  const namedEntity = mode === 'namedScholarOpinion' ? (attribution.scholarName || '')
    : mode === 'materialFromScholarSite' ? (attribution.entity || '')
      : '';

  // Which approved domain publishes this person, if any. A scholar with no row resolves to
  // '' — which is NOT a refusal, only the absence of a shortcut.
  const resolved = namedEntity ? findScholarDomain(namedEntity) : null;
  const officialDomain = resolved ? resolved.domain : '';

  // The one scholar with a purpose-built corpus adapter (lib/binothaimeen.js). Read off the
  // registry entry in lib/attribution.js so this file invents no roster of its own.
  const hasDirectAdapter = !!(attribution.scholar && attribution.scholar.key === 'ibn-uthaymeen');

  return {
    purpose,
    attributionMode: mode,
    namedEntity,
    topic: stripFrame(question, namedEntity) || question,
    requiredEvidence: EVIDENCE[purpose] || 'article-text',
    sourceRole: ROLE[purpose] || 'general-scholarship',
    officialDomain,
    officialDomainRole: officialDomain ? (findSource(officialDomain) || {}).kind || '' : '',
    hasDirectAdapter,
    needsClarification: mode === 'unnamedScholarClaim',
    attribution,
    claimSubject,
  };
}

// ── The note, NOT the answer ─────────────────────────────────────────────────
// When a direct text by the named scholar could not be found, the reader still gets the
// documented general ruling; this sentence is appended to it so the reader knows exactly what
// is and is not being credited to him. It is ONE line at the end of a real, sourced answer —
// never the whole reply, and never emitted when no answer was produced.
export function unattributedNote(entity) {
  const who = String(entity || '').trim();
  return who
    ? 'تنبيه: لم أقف على نصٍّ مباشرٍ للشيخ ' + who + ' في هذه المسألة، فما تقدَّم هو الحكم العام من مصدره المذكور، لا قولًا منسوبًا إليه.'
    : 'تنبيه: ما تقدَّم هو الحكم العام من مصدره المذكور، وليس قولًا منسوبًا إلى شيخٍ بعينه.';
}

// Asked when a claim is credited to "the shaykh" with nobody named. Makes no religious claim
// and guesses at no scholar.
export const NEEDS_SCHOLAR_NAME =
  'لم يتّضح لي أيُّ شيخٍ تقصد. اذكرْ لي اسمَه لأبحثَ عن نصِّه في مصدره المعتمد، '
  + 'أو اسألْني عن حكم المسألة نفسها فأذكرَ لك الحكم العام بمصدره.';

// Asked when the question points at material — a clip, an article — that is not in the
// conversation. Nothing is searched for on a guess.
export const NEEDS_MATERIAL =
  'لم يصلْني نصُّ المقطع أو الكلام الذي تسأل عنه. أرسلْ لي نصَّه أو رابطَه لأنظرَ فيه، '
  + 'أو اذكرْ لي المسألةَ نفسَها فأبحثَ لك عن حكمها بمصدره.';
