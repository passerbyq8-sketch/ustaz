// lib/ledger/views.js
// A VIEW IS "WHO HOLDS THIS, ON WHAT EXACT QUESTION". A conflict is two views that genuinely
// disagree — and almost none of the pairs that LOOK like disagreement actually are.
//
// THE FAILURE THIS PREVENTS. Two fatwas, one saying يجوز and one saying لا يجوز, are not a
// disagreement if the first is about a traveller and the second about a resident, or if one
// permits with a condition the other assumes absent, or if they use one word for two things.
// Reporting that as «خلاف» invents a controversy, and then invites the drafter to resolve it —
// which is how a hybrid ruling that nobody holds gets written.
//
// SO A CONFLICT REQUIRES FOUR MATCHES AND ONE MISMATCH:
//   the SUBJECT matches, the CONDITIONS match, the EXCEPTIONS match, the TEMPORAL frame
//   matches — and the RULINGS differ. Any of the first four failing means these two claims are
//   about different questions, and the correct output is both, separately, not a conflict.
//
// AND THE WORDING IS NOT OURS TO CHOOSE. We do not say a disagreement is «معتبر» — that is a
// judgement about the standing of scholars, which this engine has no basis for and no business
// making. It says only what it observed.

import { normalizeArabic } from '../route-classify.js';

const norm = (s) => normalizeArabic(String(s == null ? '' : s));

// The neutral sentence. Deliberately descriptive: it reports what was found in the sources
// searched, and claims nothing about the weight of either position.
export const NEUTRAL_DISAGREEMENT =
  'وجدت في المصادر المعتمدة قولين مختلفين في هذه الصورة.';

// Verdict polarity, and only what a page can actually establish. A claim whose ruling text
// carries neither is 'unknown', and an unknown never enters a conflict.
const PERMIT = ['يجوز', 'جاىز', 'مباح', 'لا باس', 'لا حرج', 'يصح', 'مشروع', 'يستحب', 'مستحب', 'سنه'];
const FORBID = ['لا يجوز', 'يحرم', 'حرام', 'محرم', 'ممنوع', 'لا يصح', 'باطل', 'بدعه', 'منهي عنه', 'مكروه'];

export function rulingPolarity(text) {
  const t = ' ' + norm(text) + ' ';
  // Negations are checked first because «لا يجوز» contains «يجوز».
  if (FORBID.some((w) => t.includes(norm(w)))) return 'forbid';
  if (PERMIT.some((w) => t.includes(norm(w)))) return 'permit';
  return 'unknown';
}

function componentText(components, kind) {
  return components.filter((c) => c.kind === kind).map((c) => norm(c.text)).sort().join(' | ');
}

// Two component texts "match" when they are the same modulo Arabic normalisation, or when one
// is wholly contained in the other as words. Deliberately strict: the cost of calling two
// different conditions the same is a fabricated conflict, and the cost of calling two identical
// conditions different is merely two separate claims in the answer.
function sameish(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return (' ' + long + ' ').includes(' ' + short + ' ');
}

/**
 * Group verified claims into views. A view is (issue, owner) — the same man's position on the
 * same issue is one view however many pages it came from.
 */
export function buildViews(ledger) {
  const byKey = new Map();
  for (const c of ledger.verifiedClaims()) {
    const src = ledger.source(c.sourceId);
    const ownerId = (src && src.ownerId) || null;
    const key = c.issueId + '|' + (ownerId || 'anonymous:' + (src ? src.host || src.canonicalUrl : ''));
    if (!byKey.has(key)) {
      byKey.set(key, {
        viewId: 'v' + (byKey.size + 1),
        issueId: c.issueId,
        ownerId,
        sourceIds: [],
        claimIds: [],
      });
    }
    const v = byKey.get(key);
    v.claimIds.push(c.claimId);
    if (!v.sourceIds.includes(c.sourceId)) v.sourceIds.push(c.sourceId);
    c.viewId = v.viewId;
  }
  const views = Array.from(byKey.values());
  for (const v of views) ledger.addView(v);
  return views;
}

/**
 * Find genuine conflicts among the views of one issue.
 *
 * @returns {Array<{conflictSetId:string, issueId:string, viewIds:string[], claimIds:string[], basis:string}>}
 */
export function findConflicts(ledger, issueId) {
  const claims = ledger.verifiedClaims().filter((c) => c.issueId === issueId);
  const out = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i]; const b = claims[j];
      if (a.viewId && b.viewId && a.viewId === b.viewId) continue;    // one view cannot conflict with itself

      const ca = ledger.componentsOf(a.claimId);
      const cb = ledger.componentsOf(b.claimId);

      const pa = rulingPolarity(componentText(ca, 'ruling') || a.text);
      const pb = rulingPolarity(componentText(cb, 'ruling') || b.text);
      if (pa === 'unknown' || pb === 'unknown') continue;
      if (pa === pb) continue;                                         // same verdict: no conflict

      // The four matches. Any failure means these are different questions.
      if (!sameish(componentText(ca, 'subject'), componentText(cb, 'subject'))) continue;
      if (!sameish(componentText(ca, 'condition'), componentText(cb, 'condition'))) continue;
      if (!sameish(componentText(ca, 'exception'), componentText(cb, 'exception'))) continue;
      if (!sameish(componentText(ca, 'temporal'), componentText(cb, 'temporal'))) continue;

      out.push({
        conflictSetId: 'cf' + (out.length + 1),
        issueId,
        viewIds: [a.viewId, b.viewId].filter(Boolean),
        claimIds: [a.claimId, b.claimId],
        basis: 'same-subject-same-conditions-opposite-ruling',
      });
    }
  }
  for (const c of out) ledger.addConflictSet(c);
  return out;
}

/**
 * WHICH VIEW ANSWERS THE READER. When a specific authority was named, ONLY his own view may be
 * presented as his; a general view is presented as general or not at all.
 */
export function selectViewsForIssue(ledger, issue) {
  const views = ledger.views.filter((v) => v.issueId === issue.issueId);
  if (issue.requestedAuthorityId) {
    const his = views.filter((v) => v.ownerId === issue.requestedAuthorityId);
    return { attributed: his, general: views.filter((v) => v.ownerId !== issue.requestedAuthorityId) };
  }
  return { attributed: [], general: views };
}
