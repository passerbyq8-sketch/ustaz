// lib/policy/entity-knowledge.js
// A NAME THE REGISTRY DOES NOT KNOW IS A NAME THAT LEAVES THE QUERY.
//
// ── WHAT THIS FILE USED TO BE, AND WHY THAT IS GONE ──────────────────────────
//
// It asked a model «is this name a scholar?» — one call, open world knowledge, no source, no
// ledger, no check afterwards. It existed for a real defect: «ما رأي خالد عبدالرحمن في قصر
// الصلاة؟» is the shape of a fatwa request and the name of a singer, and no registry can answer
// "is this a scholar at all", because the people who are not scholars are everybody else.
//
// THE ROOT DEFECT WAS THE SHAPE OF THE ANSWER, NOT ITS ACCURACY. Only the «non_scholar» branch was
// ever hardened. When the call said, wrongly, «yes, he is a scholar», NOTHING doubted it — and
// that is the direction it was measured failing in:
//
//   «ما رأي طارق العلي في أحكام العدة؟»  ->  «داعية وخطيب كويتي معروف من أهل العلم … يتبنّى
//   المذهب الحنفي», with four positions credited to «رأيه», over an alukah.net khutbah page that
//   does not contain his name anywhere. He is a Kuwaiti comic actor.
//
// A yes/no oracle checked on only one of its two answers is not a safety mechanism, and the app's
// governing rule is «عزك ناقلٌ لا مفتٍ» — it transmits from a page and names the page. Deciding
// who somebody IS was never work it should have been doing.
//
// ── WHAT SURVIVED, AND WHY ───────────────────────────────────────────────────
// One half of the old behaviour was always deterministic and is still right: a name no registry
// knows must come OUT of the search query. «ما رأي خالد عبدالرحمن في قصر الصلاة؟» has to reach the
// provider as «قصر الصلاة» — the sources hold the ruling, nobody has published what an
// unregistered name thinks of it, and leaving the name in spends a search on a query that cannot
// match and then reads the empty result as an absence of evidence about the ruling itself.
//
// Whether anybody may then be NAMED in the reply is a different question, and it is answered by
// lib/policy/source-attribution.js from the pages actually in hand. Nothing here decides it.
//
// THIS MODULE MAKES NO NETWORK CALL AND NO MODEL CALL. That is asserted by its gate.

import { subjectSwallowsName } from '../claim-gate.js';
import { detectAttribution } from '../attribution.js';
import { normalizeArabic } from '../route-classify.js';
import { containsSacredSubject, isSacredAttributionCapture } from './sacred-attribution.js';

/**
 * THE NAME THIS QUESTION HANGS ON, WHEN NO REGISTRY KNOWS IT.
 *
 * Returns '' when there is nothing to strip, which is the common case.
 *
 * TAKES THE PLAN, NOT THE QUESTION. planAsk() does not simply echo detectAttribution() — the
 * entity IR vetoes it and the honorific frames feed it — so re-deriving the mode here from the raw
 * text produced a DIFFERENT answer from the one the handler acts on. Reading the decision the
 * handler already made is the only way the two cannot disagree.
 *
 * THE FINAL TYPED MODE WINS. A lexical capture that the entity IR vetoed is not a verified identity
 * span and is never promoted back into a person here. The separate rawQueryEntityInQuestion()
 * channel below may remove its exact surface from a provider query, but grants no reader trust.
 */
export function unregisteredNameInQuestion(plan) {
  if (!plan) return '';
  const at = plan.attribution || {};
  // The typed/IR decision is authoritative. A lexical capture vetoed to `none` is text, not a
  // confirmed identity span, and may neither be probed nor removed from a provider query.
  if (plan.attributionMode !== 'namedScholarOpinion') return '';
  if (at.mode !== 'namedScholarOpinion') return '';
  const name = String(at.scholarName || '').trim();
  if (!name) return '';
  if (isSacredAttributionCapture(at.scholarName || '', name)) return '';
  const nameKey = normalizeArabic(name);
  const typed = (plan.entities || []).some((e) => e && e.targetType === 'person'
    && e.role === 'authority' && e.resolutionStatus === 'unresolved'
    && normalizeArabic(e.surface || '') === nameKey);
  if (!typed) return '';
  // A CAPTURE THE PLANNER ALREADY DISOWNED IS NOT A NAME. «ما حكم قول يا معطي لا تبطي؟» yields the
  // "scholar" «يا معطي لا تبطي» — the subject of the question swallowed the capture whole, which is
  // exactly what subjectSwallowsName() exists to notice. Stripping that from the query would strip
  // the question. The same function the planner uses is reused here, so the two cannot disagree
  // about which captures are real.
  try { if (subjectSwallowsName(plan.claimSubject, name)) return ''; } catch { /* not fatal */ }
  // ── EVERY WAY OF BEING REGISTERED, AND THE NAME STAYS IN THE QUERY ────────
  // A purpose-built adapter; a registered contemporary with a corpus of his own; a registered
  // historical figure; any person the entity IR resolved even where the veto emptied
  // `namedEntity`. For all of them the name is what makes the search find HIS pages, which is
  // exactly what step 3 of this batch relies on.
  if (plan.hasDirectAdapter) return '';
  if (plan.scholarStatus === 'resolved') return '';
  if (plan.authorityEra === 'historical') return '';
  if ((plan.entities || []).some((e) => e.targetType === 'person' && e.resolutionStatus === 'resolved')) return '';
  // A SCHOOL IS NOT A PERSON. The lexical layer captures «الحنابلة» as a name; the IR knows better,
  // and the IR wins — stripping it would delete the thing the reader asked about.
  if (plan.targetType === 'madhhab') return '';
  if ((plan.entities || []).some((e) => e.targetType === 'madhhab')) return '';
  return name;
}

/**
 * A lexical attribution surface may still be useful for forming a search query after the typed
 * entity IR has declined to treat it as a reader-facing identity. This channel grants no trust:
 * callers may only use it with stripEntityFromQuery().
 */
export function rawQueryEntityInQuestion(plan) {
  if (!plan) return '';
  const at = plan.attribution || {};
  if (at.mode !== 'namedScholarOpinion') return '';
  const name = String(at.scholarName || '').trim();
  if (!name || isSacredAttributionCapture(at.scholarName || '', name)) return '';
  try { if (subjectSwallowsName(plan.claimSubject, name)) return ''; } catch { return ''; }
  if (plan.hasDirectAdapter || plan.scholarStatus === 'resolved' || plan.authorityEra === 'historical') return '';
  if (plan.requestedAuthorityId || plan.targetType === 'madhhab') return '';
  if ((plan.entities || []).some((e) => e && e.targetType === 'madhhab')) return '';
  const key = normalizeArabic(name);
  if ((plan.entities || []).some((e) => e && e.targetType === 'person'
    && e.resolutionStatus === 'resolved' && normalizeArabic(e.surface || '') === key)) return '';
  return name;
}

/** The typed authority surface that is permitted to influence reader-facing identity behavior. */
export function trustedReaderEntityInQuestion(plan) {
  if (!plan) return '';
  if (plan.attributionMode !== 'namedScholarOpinion') return '';
  const at = plan.attribution || {};
  const name = String(at.scholarName || '').trim();
  if (!name || at.mode !== 'namedScholarOpinion') return '';
  if (isSacredAttributionCapture(at.scholarName || '', name, { question: at.question || '' })) return '';
  const key = normalizeArabic(name);
  if (!key || normalizeArabic(plan.namedEntity || '') !== key) return '';
  const typed = (plan.entities || []).find((e) => e && e.targetType === 'person'
    && e.role === 'authority' && normalizeArabic(e.surface || '') === key);
  return typed ? name : '';
}

/** A reader clarification is licensed only by ambiguity on the final typed opinion target. */
export function typedAmbiguityInQuestion(plan) {
  if (!plan || plan.attributionMode !== 'namedScholarOpinion'
    || plan.scholarStatus !== 'ambiguous') return false;
  const at = plan.attribution || {};
  const name = String(at.scholarName || '').trim();
  const key = normalizeArabic(name);
  if (!key || at.mode !== 'namedScholarOpinion'
    || normalizeArabic(plan.namedEntity || '') !== key
    || isSacredAttributionCapture(at.scholarName || '', name, { question: at.question || '' })
    || !Array.isArray(plan.scholarCandidates) || plan.scholarCandidates.length < 2) return false;
  const entities = (plan.entities || []).filter((entity) => entity && entity.targetType === 'person');
  const direct = entities.some((entity) => entity.role === 'authority'
    && entity.resolutionStatus === 'ambiguous'
    && normalizeArabic(entity.surface || '') === key
    && Array.isArray(entity.candidates) && entity.candidates.length > 1);
  if (direct) return true;
  // Some typed questions name two already-resolved authorities in one attribution frame. The IR
  // represents those as two person entities rather than one synthetic ambiguous entity; that is
  // still typed ambiguity, provided both exact surfaces belong to the selected frame itself.
  const resolved = entities.filter((entity) => entity.resolutionStatus === 'resolved'
    && normalizeArabic(entity.surface || '')
    && (' ' + key + ' ').includes(' ' + normalizeArabic(entity.surface || '') + ' '));
  return resolved.length > 1 && resolved.some((entity) => entity.role === 'authority');
}

/**
 * Strip a person's name out of a search query.
 *
 * «ما رأي خالد عبدالرحمن في قصر الصلاة؟» must reach the provider as «قصر الصلاة»: the sources hold
 * the ruling, and nobody has published what an unregistered name thinks of it. Leaving the name in
 * spends a search on a query that cannot match and then reads the empty result as "no evidence".
 */
const WORD_TOKEN = /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}\u0640\u200c-\u200f\u202a-\u202e\u2066-\u2069\ufeff]*)/gu;

function tokenSpans(raw) {
  const spans = [];
  WORD_TOKEN.lastIndex = 0;
  let match;
  while ((match = WORD_TOKEN.exec(raw)) !== null) {
    const folded = normalizeArabic(match[0]);
    if (folded) spans.push({ start: match.index, end: match.index + match[0].length, folded });
  }
  return spans;
}

function wholeSurfaceCandidates(query, name) {
  const wanted = normalizeArabic(name).split(' ').filter(Boolean);
  if (!wanted.length) return [];
  const spans = tokenSpans(query);
  const candidates = [];
  for (let i = 0; i + wanted.length <= spans.length; i++) {
    const run = spans.slice(i, i + wanted.length);
    if (!run.every((span, at) => span.folded === wanted[at])) continue;
    let contiguous = true;
    for (let j = 1; j < run.length; j++) {
      // A multi-token name may contain whitespace, marks or tatweel between its words, but not
      // punctuation or another token. Thus «عبد الله» is one surface and «عبد، الله» is not.
      if (!/^[\s\p{M}\u0640\u200c-\u200f\u202a-\u202e\u2066-\u2069\ufeff]*$/u
        .test(query.slice(run[j - 1].end, run[j].start))) {
        contiguous = false;
        break;
      }
    }
    if (contiguous) candidates.push({ start: run[0].start, end: run.at(-1).end });
  }
  return candidates;
}

function selectedSurface(query, name, candidates, governedSpan) {
  let span = governedSpan;
  if (!span) {
    const detected = detectAttribution([{ role: 'user', content: query }]);
    if (normalizeArabic(detected.scholarName || detected.entity || '') !== normalizeArabic(name)) return null;
    span = detected.attributionSpan;
  }
  if (!span || !Number.isInteger(span.nameWordStart) || !Number.isInteger(span.nameWordCount)
    || !Number.isInteger(span.frameWordStart) || span.nameWordCount < 1
    || span.frameWordStart < 0 || span.nameWordStart < span.frameWordStart) return null;
  const all = tokenSpans(query);
  const startToken = all[span.nameWordStart];
  const endToken = all[span.nameWordStart + span.nameWordCount - 1];
  const frameToken = all[span.frameWordStart];
  if (!startToken || !endToken || !frameToken) return null;
  const candidate = candidates.find((item) => item.start === startToken.start && item.end === endToken.end);
  if (!candidate || normalizeArabic(query.slice(candidate.start, candidate.end)) !== normalizeArabic(name)) return null;
  return { ...candidate, frameStart: frameToken.start };
}

function locallyRemoveGovernedFrame(query, candidate) {
  let start = candidate.frameStart;
  let end = candidate.end;

  // The separator immediately introducing the selected clause belongs to this deletion seam.
  // Nothing before that local run is normalized or rewritten.
  const before = query.slice(0, start);
  const attachedLeft = before.match(/[\t \r\n]*$/u);
  if (attachedLeft) start -= attachedLeft[0].length;

  // Only syntax immediately governed by the removed name may extend the right edge: a closing
  // quote/punctuation and one topic preposition. Distant punctuation and whitespace stay exact.
  const after = query.slice(end);
  const rightMatch = after.match(/^[\t \r\n]*(?:[»›”"')\]]?[\t \r\n]*[،,؛;:\u061f?.-]?[\t \r\n]*)(?:(?:عن|في|حول|بخصوص|بشأن)(?=$|[^\p{L}\p{N}\p{M}])[\t \r\n]*)?/u);
  if (rightMatch) end += rightMatch[0].length;

  const left = query.slice(0, start);
  const right = query.slice(end);
  if (!left) return right;
  if (!right) return left.replace(/[\t \r\n]*[،,؛;:]+[\t \r\n]*$/u, '');
  const needsSpace = !/\s$/u.test(left) && !/^\s/u.test(right);
  return left + (needsSpace ? ' ' : '') + right;
}

export function stripEntityFromQuery(query, name, governedSpan = null) {
  const q = String(query || '');
  const n = String(name || '').trim();
  if (!n || containsSacredSubject(n)) return q;
  const candidate = selectedSurface(q, n, wholeSurfaceCandidates(q, n), governedSpan);
  if (!candidate) return q;
  return locallyRemoveGovernedFrame(q, candidate);
}
