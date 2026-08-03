// lib/ledger/assemble.js
// THE LAST STEP, AND IT IS DETERMINISTIC. No model runs here.
//
// The reply is built from exactly two things: the sentences that survived Gate 3, and the
// source cards of the claims those sentences rest on. Nothing else may enter — not a
// transition phrase generated on the fly, not a source added for balance, not a hedge.
//
// ── HOW MANY CARDS ───────────────────────────────────────────────────────────
// One is the default and is what a single-issue question gets. Up to three when the question
// genuinely decomposed into several issues, one card per issue that produced surviving
// sentences. A card is never added because a reply "looks thin": a source that supports no
// surviving sentence is decoration, and decoration on a religious answer reads as evidence.
//
// ── WHAT THE READER NEVER SEES ───────────────────────────────────────────────
// Span ids, claim ids, view ids, trace ids, gate names, internal reason codes. The refusal
// wording below is short and true; the diagnostic version of the same refusal lives in the
// ledger's `rejections` and goes to telemetry, not to the reader.

import { REJECTION } from './schema.js';
import { NEUTRAL_DISAGREEMENT } from './views.js';
// REUSED, NOT REIMPLEMENTED. lib/claim-gate.js already owns "does this page address the
// expression the reader named", including the conservative dialect variants that made «تبطي»
// reachable from a page spelling it «تبطئ». A second copy here is exactly the drift that would
// let the two disagree about what counts as a match.
import { pageAddressesSubject } from '../claim-gate.js';

// ── the reader-facing lines ──────────────────────────────────────────────────
// None of these makes a religious claim. That is the property that lets them be emitted when
// verification failed: an absence of evidence is not evidence of either verdict.
export const READER = Object.freeze({
  NO_DIRECT_EVIDENCE:
    'لم أعثر ضمن المصادر المتاحة على نصٍّ مباشر يثبت هذه النسبة.',
  NO_EVIDENCE_GENERAL:
    'لم أعثر ضمن المصادر المتاحة على نصٍّ مباشر يجيب عن هذا السؤال، ولا أعطيك حكمًا بلا مصدر.',
  NEEDS_QUALIFIER:
    'أحتاج تفصيلًا قبل الجواب، لأن الحكم يختلف باختلافه:',
  ASK_A_SCHOLAR:
    'وللاطمئنان في حالتك بعينها، اسأل عالمًا موثوقًا.',
  PARTIAL_PREFIX:
    'أجبتك عمّا وجدت له نصًّا، وما لم أجد له نصًّا تركته:',
});

/**
 * A PUBLICATION DATE MAY BE STATED; A RECENCY MAY NOT BE INFERRED.
 *
 * «آخر فتوى» and «أحدث رأي» are claims about a corpus we did not survey — we saw the pages
 * Brave returned, which is not the same as everything he wrote. What IS sayable is the fact the
 * page itself published: "in a fatwa dated ...". `dateModified` is never that fact.
 */
export function dateClause(source) {
  if (!source || !source.dates) return '';
  const d = source.dates;
  if (!d.published || d.published === d.modified && !d.publishedIsAuthoritative) {
    // A modified timestamp on its own says when the page changed, not when the ruling issued.
    if (!d.published) return '';
  }
  return 'في فتوى منشورة بتاريخ ' + String(d.published);
}

const RECENCY_WORDS = ['أحدث', 'احدث', 'آخر فتوى', 'اخر فتوى', 'أخير', 'الأخيرة', 'الاخيرة', 'أحدث رأي'];

/** Sentences claiming recency are dropped in assembly even if Gate 3 let them through. */
export function assertsRecency(text) {
  const t = String(text || '');
  return RECENCY_WORDS.some((w) => t.includes(w));
}

// ── relevance ────────────────────────────────────────────────────────────────
/**
 * THREE DIFFERENT PROPERTIES, AND THEY ARE NOT THE SAME PROPERTY.
 *
 *   supported_by_source     — the source says it. Gate 2 decided this.
 *   relevant_to_user_question — the reader asked about it. Decided HERE.
 *   selected_for_answer     — it survives both AND is not merely adjacent.
 *
 * The failure this separates out: a fatwa about a miscarriage says something true about both
 * prayer and fasting. A reader who asked only about prayer gets told about fasting too — and
 * the detail is correct, sourced, verified, and unwanted. Worse, on a sensitive matter it is an
 * intrusion. So a claim earns its place by the SLOT it fills, not by being on the page.
 */
export function isRelevant(claim, issue, evidenceText) {
  if (!claim || !issue) return false;
  if (claim.issueId !== issue.issueId) return false;

  // ── A GENERAL SOURCE ESTABLISHES A GENERAL PRINCIPLE ONLY ──
  //
  // When the reader asked about a NAMED EXPRESSION — «ما حكم قول: يا معطي لا تبطي؟» — a page
  // that never mentions it cannot fill the ruling slot for it, however sound the page is and
  // however neatly the extractor labelled the claim. This is the reproduced production defect
  // in its exact shape: a verdict on that expression hung on a fatwa about supplicating God by
  // His names, which is a real, allow-listed, correctly-fetched page that rules on something
  // else. Slot-filling alone would let it back in through the front door.
  //
  // The test runs on the EVIDENCE, not on the claim text — a claim can echo the phrase because
  // the extractor copied it from the question. lib/claim-gate.js owns "does this page address
  // this expression", including the conservative dialect variants, and is reused rather than
  // re-implemented.
  if (issue.exactUserPhrases && issue.exactUserPhrases.length) {
    const hay = String(evidenceText == null ? '' : evidenceText);
    const addresses = issue.exactUserPhrases.some((p) => p && pageAddressesSubject(p, hay));
    if (!addresses) return false;
  }

  // A claim that fills a slot the reader's question declared is relevant by construction.
  if (claim.slot && issue.requiredSlots.includes(claim.slot)) return true;
  // Otherwise it must echo something the reader actually named.
  const hay = String(claim.text || '');
  const named = [...issue.protectedEntities, ...issue.exactUserPhrases, ...issue.coreTerms];
  return named.some((t) => t && hay.includes(t));
}

export function selectClaimsForAnswer(ledger, issue) {
  return ledger.verifiedClaims()
    .filter((c) => c.issueId === issue.issueId)
    .filter((c) => {
      const spans = (ledger.evidenceBundles.get(c.claimId) || []).map((id) => ledger.span(id)).filter(Boolean);
      const evidence = spans.map((s) => s.exactText).join(' ');
      return isRelevant(c, issue, evidence);
    });
}

// ── source cards ─────────────────────────────────────────────────────────────
export const MAX_CARDS = 3;

/**
 * One card per issue that produced a surviving sentence, in issue order, deduplicated by
 * canonical URL. Cards are built from the SOURCE ROW — registry and adapter data — never from
 * anything a model wrote.
 */
export function buildCards(ledger, survivingSentences) {
  const cards = [];
  const seen = new Set();
  const byIssue = new Map();
  for (const s of survivingSentences) {
    for (const cid of s.claimIds || []) {
      const c = ledger.claim(cid);
      if (!c) continue;
      if (!byIssue.has(c.issueId)) byIssue.set(c.issueId, []);
      byIssue.get(c.issueId).push(c);
    }
  }
  // ── ASSIGNMENT, NOT FIRST-COME ──
  // Two issues can both be supportable from one page — a fatwa portal often carries the general
  // ruling AND a named shaykh's own answer — while the SECOND issue frequently has only that one
  // page available to it. Assigning in issue order would let the flexible issue take the only
  // page the constrained one had, and the constrained issue would then get no card at all: the
  // reader would be told two things and shown one source, with no way to tell which was which.
  //
  // So the issue with the FEWEST candidate sources chooses first. Ties keep issue order, and the
  // cards are emitted in issue order regardless of the order they were assigned in.
  const order = ledger.issues
    .map((issue, idx) => {
      const claims = byIssue.get(issue.issueId) || [];
      const sources = new Set(claims.map((c) => ledger.source(c.sourceId)?.canonicalUrl).filter(Boolean));
      return { issue, idx, claims, choices: sources.size };
    })
    .filter((x) => x.claims.length)
    .sort((a, b) => a.choices - b.choices || a.idx - b.idx);

  const assigned = new Map();          // issueId -> source row
  for (const { issue, claims } of order) {
    if (assigned.size >= MAX_CARDS) break;
    // If every candidate is already carded, NO second card is added: a card that duplicates one
    // above it is decoration, and this reply already shows the page it rests on.
    const pick = claims.find((c) => {
      const s = ledger.source(c.sourceId);
      return s && s.canonicalUrl && !seen.has(s.canonicalUrl);
    });
    if (!pick) continue;
    const src = ledger.source(pick.sourceId);
    seen.add(src.canonicalUrl);
    assigned.set(issue.issueId, src);
  }

  for (const issue of ledger.issues) {
    const src = assigned.get(issue.issueId);
    if (!src) continue;
    cards.push({
      url: src.canonicalUrl,
      host: src.host,
      title: src.title || src.host,
      ownerId: src.ownerId,
      attributionType: src.attributionType || '',
    });
    if (cards.length >= MAX_CARDS) break;
  }
  return cards;
}

// ── the assembly ─────────────────────────────────────────────────────────────
/**
 * @returns {{outcome:'FULL'|'PARTIAL'|'SAFE_REJECTION', text:string, cards:Array, reasons:string[]}}
 *
 * The text is the surviving sentences joined in order, plus — for a compound question where
 * some issues were answered and some were not — an explicit statement of which part was left,
 * because dropping the whole answer because half of it is unsupported serves nobody.
 */
export function assemble(ledger, survivingSentences) {
  const reasons = ledger.rejections.map((r) => r.code);

  // An internally inconsistent ledger may never become an answer, whatever survived.
  const integrity = ledger.integrityProblems();
  if (integrity.length) {
    ledger.reject(REJECTION.GATE1_FAILED, 'integrity:' + integrity.slice(0, 3).join('; '));
    return { outcome: 'SAFE_REJECTION', text: READER.NO_EVIDENCE_GENERAL, cards: [], reasons: reasons.concat('ledger_integrity_failed') };
  }

  const kept = (survivingSentences || [])
    .filter((s) => s.verified)
    .filter((s) => !assertsRecency(s.text))
    .sort((a, b) => a.index - b.index);

  if (!kept.length) {
    const attributed = ledger.issues.some((i) => i.requestedAuthorityId);
    return {
      outcome: 'SAFE_REJECTION',
      text: attributed ? READER.NO_DIRECT_EVIDENCE : READER.NO_EVIDENCE_GENERAL,
      cards: [],
      reasons: reasons.length ? reasons : [REJECTION.NO_SUFFICIENT_DIRECT_EVIDENCE],
    };
  }

  const cards = buildCards(ledger, kept);
  const answeredIssues = new Set();
  for (const s of kept) {
    for (const cid of s.claimIds || []) {
      const c = ledger.claim(cid);
      if (c) answeredIssues.add(c.issueId);
    }
  }
  const unanswered = ledger.issues.filter((i) => !answeredIssues.has(i.issueId));

  // FULL MEANS EVERY PART OF THE QUESTION WAS ANSWERED, NOT "SOMETHING SURVIVED".
  // An issue can produce a verified, relevant, well-sourced sentence about the ruling and never
  // reach the reader's «وهل تصلي؟». Calling that FULL tells a reviewer the question was covered
  // when it was half covered, and it is exactly the shape of over-claim this engine exists to
  // remove. An answered issue with an unfilled required slot downgrades the whole reply.
  const shortIssues = ledger.issues
    .filter((i) => answeredIssues.has(i.issueId))
    .filter((i) => !ledger.issueComplete(i.issueId));
  for (const i of shortIssues) {
    const missing = ledger.slotsFor(i.issueId).filter((s) => s.status !== 'filled').map((s) => s.slot);
    ledger.reject(REJECTION.SLOT_UNFILLED, missing.join(','), i.issueId);
  }

  const parts = [kept.map((s) => s.text).join(' ')];

  // ── the disagreement line, when there is a real one ──
  if (ledger.conflictSets.length) parts.push(NEUTRAL_DISAGREEMENT);

  // ── the part we could not answer, named rather than hidden ──
  if (unanswered.length) {
    const attributed = unanswered.filter((i) => i.requestedAuthorityId);
    parts.push(attributed.length ? READER.NO_DIRECT_EVIDENCE : READER.NO_EVIDENCE_GENERAL);
  }

  return {
    outcome: (unanswered.length || shortIssues.length) ? 'PARTIAL' : 'FULL',
    text: parts.filter(Boolean).join('\n\n'),
    cards,
    reasons,
    unfilledSlots: shortIssues.flatMap((i) => ledger.slotsFor(i.issueId)
      .filter((s) => s.status !== 'filled').map((s) => i.issueId + ':' + s.slot)),
  };
}

/** The follow-up question, when the plan says a material qualifier is missing. */
export function followUpText(plan) {
  const qs = (plan && plan.missingQualifiers) || [];
  if (!qs.length) return READER.NEEDS_QUALIFIER;
  return READER.NEEDS_QUALIFIER + '\n' + qs.map((q) => '- ' + q).join('\n');
}
