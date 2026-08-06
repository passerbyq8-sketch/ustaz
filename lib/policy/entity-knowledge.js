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
 * AND IT READS THE LEXICAL CAPTURE, NOT THE FINAL MODE. The entity IR already vetoes «ما رأي خالد
 * عبدالرحمن في كذا» down to `none`, which stops the app hunting for his fatwa — and still leaves
 * his name in the query that goes to the provider. The capture survives the veto and is present on
 * both sides of the rollout flag, so it is what this reads.
 */
export function unregisteredNameInQuestion(plan) {
  if (!plan) return '';
  const at = plan.attribution || {};
  if (at.mode !== 'namedScholarOpinion') return '';
  const name = String(at.scholarName || '').trim();
  if (!name) return '';
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
 * Strip a person's name out of a search query.
 *
 * «ما رأي خالد عبدالرحمن في قصر الصلاة؟» must reach the provider as «قصر الصلاة»: the sources hold
 * the ruling, and nobody has published what an unregistered name thinks of it. Leaving the name in
 * spends a search on a query that cannot match and then reads the empty result as "no evidence".
 */
export function stripEntityFromQuery(query, name) {
  const q = String(query || '');
  const n = String(name || '').trim();
  if (!n) return q.trim();
  let out = q;
  // The whole name first, then its individual words, so a partial capture cannot leave a fragment.
  for (const part of [n, ...n.split(/\s+/)].filter((p) => p && p.length > 2)) {
    out = out.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
  }
  return out
    // The frame the name hung in is now empty too: «ما رأي  في قصر الصلاة» → «قصر الصلاة».
    .replace(/(?:^|\s)(?:ما|وما|ايش|ماذا)\s+(?:هو|هي)?\s*(?:رأي|راي|قول|رايك|قال|يقول)\s*/gu, ' ')
    .replace(/(?:^|\s)(?:الشيخ|الشيخة|العلامة|الإمام|الامام|الدكتور|الفقيه|المفتي)\s*/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // Whatever the frame left at the front is not part of the topic: a bare «رأي», or the
    // preposition that used to govern the name. «في قصر الصلاة» is a fragment; «قصر الصلاة» is a
    // query. Repeated because removing one can expose the next.
    .replace(/^(?:(?:رأي|راي|قول|عن|في|حول|بخصوص|بشأن)\s+)+/u, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s،,؟?.-]+|[\s،,؟?]+$/g, '')
    .trim();
}
