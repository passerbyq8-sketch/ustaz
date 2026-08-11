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
import { stripEntityFromQuery } from './policy/entity-knowledge.js';
// THE SHARED POLICY CORE, consumed rather than copied. lib/policy/entities.js is the single
// place that decides whether a name is a person, a school or a coincidence, and both request
// paths read the SAME answer from it — which is what guards/policy-core-guard.cjs asserts.
import { readEntities, preSearchRejection, ROSTER } from './policy/entities.js';
import { provenanceCap } from './policy/attribution-grades.js';
import { POLICY_VERSION } from './policy/version.js';
import { normalizeArabic } from './route-classify.js';

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
function stripFrame(question, entity, attributionSpan = null) {
  const raw = String(question == null ? '' : question);
  if (entity) return stripEntityFromQuery(raw, entity, attributionSpan);
  let t = raw.trim();
  for (const re of FRAME) t = t.replace(re, '');
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

  // ── THE WORLD VERDICT THAT USED TO NARROW THIS IS GONE ────────────────────
  //
  // A caller could supply `entityWorldType`, and a confident `non_scholar` from a model call took
  // the attribution path away. It was removed with the call that produced it: only its «no» branch
  // was ever hardened, and the measured failure was a wrong «yes» that nothing doubted. What
  // decides an attribution now is the registry — below — and what decides who may be NAMED is
  // lib/policy/source-attribution.js, from the pages in hand.
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
  const selectedEntityKey = normalizeArabic(namedEntity || '');
  const authorityEntity = (ir.entities || []).find((entity) => entity
    && entity.role === 'authority' && entity.targetType === 'person'
    && normalizeArabic(entity.surface || '') === selectedEntityKey);

  // ── TWO RESOLVERS, AND THE NARROWER ONE WAS OVERWRITING THE OTHER ──────────
  //
  // MEASURED, batch 5: «ما رأي ابن حجر في هذه المسألة؟» was ANSWERED — a position credited to him
  // «في الفتح», footnoted «لم أقف على نصٍّ مباشر» — instead of asking which Ibn Hajar was meant.
  //
  // DIAGNOSIS. The entity layer reads it exactly right: canonicalId ibn-hajar, role authority,
  // resolutionStatus 'ambiguous', candidates [al-'Asqalani, al-Haytami], preSearchRejection
  // AMBIGUOUS_ENTITY. Every one of those facts was already true and already computed. But
  // `scholarStatus` was taken from resolveScholar() ALONE — the CONTEMPORARY registry, keyed by
  // official domain — and a man dead six centuries has no domain, so there he is 'unresolved'.
  // 'unresolved' is the branch that deliberately falls THROUGH to the search, so the clarification
  // was reachable in principle and unreached in fact. The name was caught; a second, narrower
  // resolver then threw the catch away.
  //
  // AMBIGUITY BETWEEN TWO REGISTERED MEN ALWAYS WINS. It is a stronger fact than "no contemporary
  // domain matches": there are two men we hold, and choosing between them is guessing. The
  // resolveScholar answer is kept for everything else — this only ever ADDS the ambiguous case,
  // and only when the reader asked for somebody's position.
  const ambiguousAuthority = authorityEntity && authorityEntity.resolutionStatus === 'ambiguous'
    ? authorityEntity : null;
  const entityAmbiguous = !!(ambiguousAuthority && (ambiguousAuthority.candidates || []).length > 1);

  const scholarStatus = mode === 'namedScholarOpinion' || mode === 'materialFromScholarSite'
    ? (entityAmbiguous ? 'ambiguous' : res.status) : 'n/a';
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
    requestedAuthorityId: authorityEntity && authorityEntity.resolutionStatus === 'resolved'
      ? (authorityEntity.canonicalId || null) : null,
    verbatimRequired: ir.verbatimRequired,
    quotedText: ir.quotedText,
    preSearchRejection: preSearchRejection(ir),
    scholarStatus,
    // NAMED, or the clarification is not a real choice. The registry's answer is a list of
    // domains; the roster's is a list of canonical ids. Both are resolved to display names by
    // ambiguousScholarPrompt, so whichever resolver spoke, the reader reads two men's names.
    scholarCandidates: entityAmbiguous ? ambiguousAuthority.candidates.slice()
      : res.status === 'ambiguous' ? res.candidates.slice() : [],
    needsScholarIdentity,
    purpose,
    attributionMode: mode,
    namedEntity,
    topic: stripFrame(question, namedEntity, attribution.attributionSpan) || question,
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

// ── THE TWO IDENTITY TEMPLATES ARE GONE, AND WHY ─────────────────────────────
//
// `NEEDS_SCHOLAR_IDENTITY` and `NEEDS_SCHOLAR_NAME` used to END the request: a name was read out
// of the question, no registry matched it, and the reader was asked for «اسمَه كاملًا أو رابطَ
// موقعِه» — before anything at all had been searched. Measured on the live service, that template
// was what «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا؟» got: a request for the official website of
// a man dead seven centuries, in place of a ruling that is written out on our own approved list.
//
// The defect was never the wording. It was the ORDER. Reading a name is the start of a more
// specific search, not a reason to stop; so the epistemic refusal moved to AFTER the search, where
// it can be true. What the reader now gets is either the documented answer at its own grade, or a
// refusal that says a search ran and came back empty — and lib/policy/slot-proof.js will not let
// that sentence be written unless it did.
//
// ── THE ONE CLARIFICATION THAT SURVIVES ──────────────────────────────────────
// Ambiguity between REGISTERED men is a different fact from ignorance. When «ابن حجر» matches two
// scholars we actually hold corpora for, picking one is guessing and searching both is answering a
// question nobody asked. Asking is then the honest move — and it is honest precisely because we
// can name the candidates. An UNKNOWN name never reaches this: nobody to choose between.
export const AMBIGUOUS_SCHOLAR =
  'هذا الاسم ينطبق على أكثر من عالِمٍ عندنا، ولا أختار أحدَهم بالظنّ. أيَّهما تقصد؟';

/**
 * The clarification, with the registered candidates NAMED so the choice is a real one.
 *
 * A CANDIDATE ARRIVES AS ONE OF TWO KINDS OF IDENTIFIER, because two registries can report an
 * ambiguity: a DOMAIN from lib/source-registry.js, and a canonical ID from the roster in
 * lib/policy/entities.js. Both are resolved to a human display name here. A raw `ibn-hajar-al-
 * haytami` shown to a reader is not a choice — it is our internal plumbing on his screen.
 */
export function ambiguousScholarPrompt(candidates) {
  const displayOf = (id) => {
    const e = ROSTER.find((r) => r.canonicalId === id);
    return e ? e.display : '';
  };
  const names = [...new Set((candidates || [])
    .map((d) => {
      const s = findSource(d);
      return (s && s.name) || displayOf(String(d || '')) || String(d || '');
    })
    .filter(Boolean))];
  return names.length ? AMBIGUOUS_SCHOLAR + '\n' + names.map((n) => '- ' + n).join('\n') : AMBIGUOUS_SCHOLAR;
}

// Asked when the question points at material — a clip, an article — that is not in the
// conversation. Nothing is searched for on a guess.
export const NEEDS_MATERIAL =
  'لم يصلْني نصُّ المقطع أو الكلام الذي تسأل عنه. أرسلْ لي نصَّه أو رابطَه لأنظرَ فيه، '
  + 'أو اذكرْ لي المسألةَ نفسَها فأبحثَ لك عن حكمها بمصدره.';
