// lib/policy/synonyms.js
// THE REVIEWED FIQH SYNONYM TABLE. Versioned, closed, and deliberately small.
//
// ── WHY A TABLE AND NOT A MODEL ──────────────────────────────────────────────
// Query expansion by generation is how «حكم بيع الذهب بالتقسيط» quietly becomes «حكم بيع الذهب
// بالتقسيط أو الربا في الصرف» — a different question, whose answer is then presented as the
// answer to the one that was asked. An expansion may widen HOW a page is found; it may never move
// the محل الحكم. So the pairs are enumerated, reviewed, and frozen, and the version is part of
// every search cache key so an entry filled under an older table is a miss.
//
// ── WHAT IS PROTECTED FROM EXPANSION ENTIRELY ────────────────────────────────
// A scholar's name, a madhhab's name, and the pivot words that decide which ruling is being asked
// about. Expanding «ابن باز» to «ابن باز أو ابن عثيمين» is not a wider search, it is a different
// attribution; expanding «نفاس» to «حيض» is not a wider search, it is a different ruling.
//
// ── ONE EXPANSION, ONCE ──────────────────────────────────────────────────────
// RFC v0.5-R2 §13: a query may be expanded once. Chained expansion compounds drift, and the
// second hop is always the one that changes the subject.

import { SYNONYM_TABLE_VERSION } from './version.js';
import { fold } from './entities.js';

export { SYNONYM_TABLE_VERSION };

// Terms that may never be substituted or added to. Checked BEFORE any expansion is considered.
export const PROTECTED = Object.freeze([
  // the pivots — each names a different ruling, not a different wording of one
  'نفاس', 'حيض', 'استحاضه', 'دم فساد',
  'فرض', 'واجب', 'سنه', 'مستحب', 'مكروه', 'حرام', 'مباح',
  'قضاء', 'اداء', 'كفاره', 'فديه',
  'طلاق', 'خلع', 'فسخ',
  'ربا', 'صرف', 'تقسيط', 'مرابحه',
  'عمد', 'خطا', 'سهو',
]);

// EQUIVALENT WORDINGS OF THE SAME QUESTION. Each pair was reviewed as "these two strings retrieve
// the same محل حكم"; nothing here changes what is being asked.
const PAIRS = Object.freeze([
  ['ما حكم', 'حكم'],
  ['هل يجوز', 'حكم'],
  ['هل يصح', 'صحه'],
  ['كيفيه', 'صفه'],
  ['طريقه', 'صفه'],
  ['الوضوء', 'الطهاره'],
  ['الميت', 'الجنازه'],
  ['المسافر', 'السفر'],
  ['الجمع بين الصلاتين', 'جمع الصلاه'],
  ['قصر الصلاه', 'القصر في السفر'],
  ['زكاه المال', 'الزكاه'],
  ['صيام التطوع', 'صوم النافله'],
  ['العقيقه', 'الذبح عن المولود'],
  ['تفسير', 'معني'],
  ['تخريج', 'درجه الحديث'],
  ['حكم الحديث', 'درجه الحديث'],
]);

const INDEX = new Map();
for (const [a, b] of PAIRS) {
  const fa = fold(a), fb = fold(b);
  if (!INDEX.has(fa)) INDEX.set(fa, new Set());
  if (!INDEX.has(fb)) INDEX.set(fb, new Set());
  INDEX.get(fa).add(fb);
  INDEX.get(fb).add(fa);
}

/** Is this term one the table refuses to touch? */
export function isProtected(term) {
  const t = fold(term);
  return PROTECTED.some((p) => t === fold(p) || t.includes(fold(p)));
}

/**
 * THE ONE PERMITTED EXPANSION OF A QUERY.
 *
 * @param {string} query
 * @param {{alreadyExpanded?:boolean, protectedTerms?:string[]}} opts
 * @returns {{query:string, expanded:boolean, added:string[], version:string}}
 *
 * Returns the query UNCHANGED when: it was already expanded once, it contains a protected term
 * that the substitution would touch, or no reviewed pair applies. An unchanged query is the
 * correct and common outcome — this table exists to be conservative.
 */
export function expandOnce(query, opts = {}) {
  const version = SYNONYM_TABLE_VERSION;
  const q = String(query == null ? '' : query);
  if (opts.alreadyExpanded) return { query: q, expanded: false, added: [], version };

  const folded = fold(q);
  const added = [];
  for (const [term, alts] of INDEX) {
    if (!folded.includes(term)) continue;
    if (isProtected(term)) continue;
    for (const alt of alts) {
      if (folded.includes(alt)) continue;
      if (isProtected(alt)) continue;
      added.push(alt);
      break;                                   // one alternative per matched term
    }
    if (added.length) break;                   // ONE expansion, once
  }
  // A caller's own protected list (the scholar's name, the pivot words the IR marked) is honoured
  // as strictly as the table's.
  const extra = (opts.protectedTerms || []).map(fold);
  const safe = added.filter((a) => !extra.some((p) => p && a.includes(p)));
  if (!safe.length) return { query: q, expanded: false, added: [], version };

  return { query: (q + ' ' + safe.join(' ')).trim(), expanded: true, added: safe, version };
}

/** Every pair, for the guard and for the report. */
export function table() {
  return PAIRS.map((p) => p.slice());
}
