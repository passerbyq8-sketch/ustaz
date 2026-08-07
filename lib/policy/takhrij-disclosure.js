// lib/policy/takhrij-disclosure.js
// WHEN THE READER ASKS FOR A GRADING AND WE HAVE NO PRIMARY SOURCE FOR ONE, WE SAY SO. D8.
//
// ── THE MEASURED STATE, AND IT IS NOT A CORNER CASE ──────────────────────────
// dorar.net was the ONLY hadith-grading source this app ever had, and it was deferred on
// 2026-08-05: HTTP 403 to every server-side request, including its own documented JSON API. It
// is on no band list, and lib/source-intent.js removed the intent that used to target it,
// recording plainly that there is «nothing to re-route to».
//
// So the honest description of today is not "sometimes we lack a takhrij source". It is: THERE
// IS NO PRIMARY TAKHRIJ SOURCE AT ALL, and every grading question is answered without one. The
// reader cannot see that, and nothing in the reply told them.
//
// ── WHAT THIS SAYS, AND WHAT IT REFUSES TO DO ────────────────────────────────
// One fixed sentence, appended once. It does NOT hedge the answer above it, apologise for it, or
// withdraw it — lib/policy/referral-tail.js states that rule for the referral and it is the same
// rule here: a tail that undermines the answer above it is worse than no tail, because the reader
// then trusts neither. What it does is narrower and factual: the grading you have just read was
// transmitted from a general source, not verified against a takhrij corpus, and a definitive
// verdict is looked up in one.
//
// IT IS NOT THE TAKHRIJ LOCK, AND IT DOES NOT WEAKEN IT. lib/takhrij-lock.js still refuses to
// emit any attribution or grade that is not present in the extracted text of a page actually
// fetched. Nothing unsourced gets through either way. This sentence is about the difference
// between «a grading that appeared on a page we read» and «a grading from a corpus built to
// answer that question», which is a distinction the lock cannot draw and the reader cannot see.
//
// NO I/O, NO MODEL CALL, NO STATE.

import { normalizeArabic } from '../route-classify.js';

// ── THE PRIMARY TAKHRIJ CORPORA, AND THE LIST IS EMPTY ───────────────────────
// A domain belongs here when it is a registered source whose PURPOSE is takhrij and grading —
// an encyclopedia of gradings, not a fatwa site that happens to mention one. dorar.net is the
// only candidate this app has ever had, and it is deferred and unreachable, so it is not here.
//
// The list is the switch. The day a primary adapter is admitted, adding its domain here turns
// the disclosure off for the questions it can answer, and nothing else has to change.
export const PRIMARY_TAKHRIJ_DOMAINS = Object.freeze([]);

// ── THE SENTENCE ─────────────────────────────────────────────────────────────
// Styled on REFERRAL_TAILS: states what the thing above it IS, then where the binding answer
// lives. It names no number, blames nothing on the reader, and does not say "I am unable" —
// the answer stands; its provenance is being described.
export const TAKHRIJ_DISCLOSURE =
  'وهذا النقلُ لدرجةِ الحديثِ من المصدرِ المذكور، لا من كتب التخريج نفسِها؛ '
  + 'ولتحقيقِ الدرجةِ بعينها فارجعْ إلى دواوين التخريج أو اسأل أهلَ الحديث.';

const N = (arr) => arr.map((s) => normalizeArabic(s)).filter(Boolean);

// ── IS THE READER ASKING FOR A VERDICT ON A HADITH? ──────────────────────────
// DECISIVE GRADING VOCABULARY ONLY, and this is the same distinction lib/source-purpose.js draws
// in its own comments: "is the reader asking for a GRADING?" is a narrower question than "is this
// a hadith question at all?". «اشرح حديث إنما الأعمال بالنيات» is a request for MEANING and gets
// no disclosure — there is no grading in the answer to describe the provenance of. Bare «حديث» is
// excluded for the reason that file records: it is also the ordinary adjective for "modern".
const GRADING_PHRASES = N([
  'درجه الحديث', 'ما درجه الحديث', 'درجه حديث', 'ما درجه حديث',
  'صحه الحديث', 'ما صحه الحديث', 'صحه حديث', 'ما صحه حديث',
  'هل يصح حديث', 'هل يصح الحديث', 'هل صح حديث', 'هل صح الحديث',
  'هل هذا الحديث صحيح', 'هل الحديث صحيح', 'هذا الحديث صحيح ام ضعيف',
  'حديث صحيح ام ضعيف', 'صحيح ام ضعيف', 'صحيح ام موضوع',
  'من خرجه', 'من اخرجه', 'من رواه', 'تخريج الحديث', 'تخريج حديث',
  // «خرّج» loses its shadda to normalizeArabic and becomes «خرج», which on its own is the
  // everyday verb "went out". So the pinned forms are the ones where a hadith is the object —
  // «من خرج هذا الحديث» — and never the bare verb.
  'من خرج هذا الحديث', 'من خرج الحديث', 'من خرج حديث',
  'من اخرج هذا الحديث', 'من اخرج الحديث', 'من روي هذا الحديث', 'من روي الحديث',
  'حكم الحديث', 'ما حكم الحديث', 'سند الحديث', 'اسناد الحديث',
]);
const GRADING_WORDS = N(['تخريج', 'خرجه', 'الاسناد', 'متواتر', 'موضوع', 'مرسل', 'موقوف', 'مرفوع', 'شاذ', 'منكر', 'معلول']);

/**
 * @param {string} raw the reader's message
 * @returns {boolean} true only for a request for a VERDICT on a report's authenticity
 */
export function asksForGrading(raw) {
  const cleaned = normalizeArabic(raw);
  if (!cleaned) return false;
  const padded = ' ' + cleaned + ' ';
  if (GRADING_PHRASES.some((p) => padded.includes(' ' + p + ' '))) return true;
  // The single words are decisive on their own — every one of them is a term of art in
  // ʿilm al-ḥadīth with no ordinary sense that could arrive by accident. They still require the
  // subject to be a report, so «موضوع» («topic», by far its commoner everyday sense) cannot fire
  // on «ما موضوع الدرس؟».
  const words = new Set(cleaned.split(' ').filter(Boolean));
  const hasHadithSubject = /حديث|الحديث|احاديث|روايه|الروايه/.test(cleaned);
  return hasHadithSubject && GRADING_WORDS.some((w) => words.has(w));
}

/** Was any page we actually read a primary takhrij corpus? */
export function hasPrimaryTakhrij(domains) {
  if (!Array.isArray(domains) || !PRIMARY_TAKHRIJ_DOMAINS.length) return false;
  const seen = new Set(domains.map((d) => String(d || '').toLowerCase().replace(/^www\./, '')));
  return PRIMARY_TAKHRIJ_DOMAINS.some((d) => seen.has(d));
}

/**
 * THE ONE ENTRY POINT.
 * @param {{question:string, sourceDomains?:string[]}} args
 * @returns {string} the sentence, or '' when it does not apply
 */
export function takhrijDisclosureFor({ question, sourceDomains } = {}) {
  if (!asksForGrading(question)) return '';
  if (hasPrimaryTakhrij(sourceDomains)) return '';
  return TAKHRIJ_DISCLOSURE;
}

/**
 * Appended once, whatever the exit. Same shape as referralOnce(): a function OF THE DRAFT, so
 * that a reply which already carries the sentence does not receive a second copy.
 */
export function takhrijDisclosureOnce(draft, disclosure) {
  if (!disclosure) return '';
  const d = String(draft == null ? '' : draft);
  if (d.includes(disclosure)) return '';
  // Its own distinguishing clause is enough to recognise a paraphrase the model may have drafted
  // on its own account; a second sentence saying the same thing is noise the reader stops reading.
  if (/دواوين التخريج|كتب التخريج/.test(d)) return '';
  return disclosure;
}
