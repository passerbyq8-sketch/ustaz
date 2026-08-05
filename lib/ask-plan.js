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
import { resolveScholar, findSource } from './source-registry.js';
// THE SHARED POLICY CORE, consumed rather than copied. lib/policy/entities.js is the single
// place that decides whether a name is a person, a school or a coincidence, and both request
// paths read the SAME answer from it — which is what guards/policy-core-guard.cjs asserts.
import { readEntities, preSearchRejection } from './policy/entities.js';
import { provenanceCap } from './policy/attribution-grades.js';
import { POLICY_VERSION } from './policy/version.js';

// ── Reason codes ─────────────────────────────────────────────────────────────
// FOR LOGS AND GATES ONLY. None of these ever reaches a reader: they are the vocabulary the
// tests use to say WHICH path a question took, so that "it answered" and "it answered for the
// right reason" can be told apart.
export const REASON = Object.freeze({
  SCHOLAR_RESOLVED: 'SCHOLAR_RESOLVED',
  SCHOLAR_IDENTITY_AMBIGUOUS: 'SCHOLAR_IDENTITY_AMBIGUOUS',
  SCHOLAR_IDENTITY_UNRESOLVED: 'SCHOLAR_IDENTITY_UNRESOLVED',
  DIRECT_CORPUS_SEARCHED_NO_EVIDENCE: 'DIRECT_CORPUS_SEARCHED_NO_EVIDENCE',
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
export function planAsk(messages, opts = {}) {
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

  // ── THE ENTITY IR NOW HAS A VETO OVER THE LEXICAL CAPTURE ──────────────────
  //
  // WHAT WENT WRONG WITHOUT IT. detectAttribution() finds a SHAPE and then captures up to four
  // Arabic words as the name. That is the right way to notice that somebody's opinion is being
  // sought and the wrong way to decide WHO — and MEASURED against the shipped code, three whole
  // classes of question were answered with «لم أتبيّنْ أيَّ شيخٍ تقصد» having searched nothing:
  //
  //   «هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟» -> captured «الاسلام ابن تيميه اهل»
  //   «ذهب إلى المسجد فهل يصح؟»                            -> captured «الي المسجد فهل يصح»
  //   «ما حكم المسألة عند الحنابلة؟»                        -> captured «الحنابله»
  //
  // A mosque, a preposition and a school of law. The IR reads the same sentence against a
  // REGISTERED roster, so it can say what the capture cannot: this is a question ABOUT a man,
  // this names no person at all, this names a madhhab.
  //
  // THE VETO ONLY EVER NARROWS. It can turn an attribution request into an ordinary question; it
  // can never turn an ordinary question into an attribution request, and it never widens what may
  // be credited to anybody. «ما رأي الشيخ عبدالمحسن العباد» is still namedScholarOpinion, still
  // fail-closed, and still answered only from a page of his.
  //
  // AND IT IS BEHIND A ROLLOUT FLAG. The veto changes what a reader is answered with, so it may
  // not go live merely because the branch was pushed. `policyEnabled` comes from
  // lib/legacy-policy-flag.js, which is default OFF and off on every failure to read it; with it
  // off, `mode` keeps exactly the value the shipped classifier produced and this whole block is
  // inert. The IR is still COMPUTED either way — it is pure, it costs nothing, and reporting it
  // lets the flag-off path be measured rather than guessed at.
  const ir = readEntities(question);
  const relation = ir.claimRelation;
  const policyEnabled = opts.policyEnabled === true;
  if (policyEnabled && mode === 'namedScholarOpinion'
    && relation !== 'BY_ENTITY' && relation !== 'QUOTE_VERIFICATION') {
    mode = 'none';
  }

  const namedEntity = mode === 'namedScholarOpinion' ? (attribution.scholarName || '')
    : mode === 'materialFromScholarSite' ? (attribution.entity || '')
      : '';

  // WHO IS THIS, EXACTLY? Three outcomes, and they are not interchangeable:
  //   resolved   — exactly one registered scholar matches, so his own site can be searched;
  //   ambiguous  — more than one matches, so choosing is guessing;
  //   unresolved — nobody matches, so there is no official corpus to search at all.
  const res = namedEntity ? resolveScholar(namedEntity) : { status: 'unresolved' };
  const scholarStatus = mode === 'namedScholarOpinion' || mode === 'materialFromScholarSite'
    ? res.status : 'n/a';
  const officialDomain = res.status === 'resolved' ? res.domain : '';

  // The one scholar with a purpose-built corpus adapter (lib/binothaimeen.js). Read off the
  // registry entry in lib/attribution.js so this file invents no roster of its own.
  const hasDirectAdapter = !!(attribution.scholar && attribution.scholar.key === 'ibn-uthaymeen');

  // TWO DIFFERENT FAILURES THAT MUST NOT SOUND THE SAME.
  //
  //   A. He is identified and his own corpus was searched and came up empty. Then the general
  //      ruling may stand in, with a note saying the search found no direct text of his. That
  //      note is TRUE: a search really happened.
  //
  //   B. He is not identified — the name is ambiguous, or nobody by it is registered. Saying
  //      "I found no text of his" here would be a false claim about work never done, and
  //      running a general search would quietly imply the identity was settled. So the honest
  //      move is to ask which shaykh is meant. Nothing is searched and nothing is implied.
  // ── A HISTORICAL SCHOLAR HAS NO OFFICIAL SITE, AND MUST NOT BE ASKED FOR ONE ──
  //
  // THE LEAK THIS CLOSES, MEASURED: «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا؟» is BY_ENTITY, and
  // the entity layer reads it correctly — ibn-taymiyyah, authority, historical, RESOLVED, with no
  // pre-search rejection. But `res` above is resolveScholar(), which is the CONTEMPORARY registry
  // keyed by official domain, and a man dead seven centuries is `unresolved` in it. So the reader
  // was asked for «رابط موقعه الرسمي» — a site that cannot exist — and nothing was ever searched.
  //
  // The contemporary rule is sound where it belongs: a living scholar's fatwa may not be credited
  // to him without his own corpus. It simply must not be applied to a man whose words survive in
  // the books, which is why the ceiling for a historical entity is already C rather than NONE
  // (lib/policy/attribution-grades.js) and why no primary adapter is required to reach it.
  //
  // THE VETO ONLY EVER NARROWS THE REFUSAL, NEVER WIDENS THE ATTRIBUTION. Dropping this template
  // does not license crediting him with anything: the grade cap stays C, C still may not assert a
  // verbatim quote, and a search that finds nothing still ends in a constrained refusal that says
  // so — after a search that actually ran.
  //
  // Behind the rollout flag with the rest, so with the flag off this expression is byte-for-byte
  // what shipped.
  const authorityEntity = ir.entities.find((e) => e.role === 'authority' && e.targetType === 'person');
  const historicalAuthority = !!(authorityEntity
    && authorityEntity.era === 'historical'
    && authorityEntity.resolutionStatus === 'resolved');

  const needsScholarIdentity = mode === 'namedScholarOpinion'
    && !hasDirectAdapter && res.status !== 'resolved'
    && !(policyEnabled && historicalAuthority);

  // The madhhab, when one was named. «عند الحنابلة» asks a school what it holds, and a school has
  // no official site, no adapter and no fatwa of its own to be refused for not having.
  const madhhab = ir.entities.find((e) => e.targetType === 'madhhab');

  return {
    // ── the shared IR, exposed so the handler branches on a decision rather than re-deriving one
    policyVersion: POLICY_VERSION,
    policyEnabled,
    claimRelation: relation,
    targetType: madhhab ? 'madhhab' : (ir.entities.find((e) => e.targetType === 'person') ? 'person' : ''),
    // ── WHAT MAY BE CREDITED, AND WHAT IT TAKES TO CREDIT IT ──────────────────
    // Reported rather than left to be re-derived downstream, because "is this man historical"
    // getting two different answers in two files is precisely the defect above.
    authorityEra: authorityEntity ? authorityEntity.era : '',
    // Historical: his words are in the books, so no corpus of his own is required — and the
    // ceiling is C either way. Contemporary or undeclared era: his own corpus is required.
    primaryAdapterNeeded: !!authorityEntity && !historicalAuthority,
    provenanceCap: provenanceCap({
      era: authorityEntity ? authorityEntity.era : '',
      hasPrimaryAdapter: hasDirectAdapter,
    }),
    entities: ir.entities,
    requestedAuthorityId: ir.requestedAuthorityId,
    verbatimRequired: ir.verbatimRequired,
    quotedText: ir.quotedText,
    preSearchRejection: preSearchRejection(ir),
    scholarStatus,
    scholarCandidates: res.status === 'ambiguous' ? res.candidates.slice() : [],
    needsScholarIdentity,
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

// Asked when a name WAS given but does not identify anybody we can search — ambiguous, or
// nobody registered by it. CRUCIALLY it does not say "I found nothing of his": no search was
// run, and claiming one would be a false statement about our own work.
export const NEEDS_SCHOLAR_IDENTITY =
  'لم أتبيّنْ أيَّ شيخٍ تقصد على وجه التحديد، ولم أبحثْ في مصدرٍ رسميٍّ له بعدُ. '
  + 'اذكرْ لي اسمَه كاملًا أو رابطَ موقعِه أو المادّةَ التي تقصدها لأنظرَ في نصِّه، '
  + 'أو اسألْني عن حكم المسألة نفسِها فأذكرَ لك الحكمَ العامَّ بمصدره.';

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
