// lib/source-intent.js
// DETERMINISTIC intent classifier for RETRIEVAL TARGETING, run per search angle.
//
// WHAT THIS DECIDES, AND WHAT IT DOES NOT
// ---------------------------------------
// It answers exactly one question: "is this query the kind of question ONE specific
// vetted source is the right place to look first?" If yes, retrieve() runs a single
// site-scoped Brave search against that domain BEFORE the ordinary search. If that
// targeted pass comes back with a usable page, it wins; if it comes back empty for any
// reason, the ordinary search runs exactly as it does today and the answer is unaffected.
//
// It does NOT decide DEEN vs GEN (lib/route-classify.js owns that and is untouched), it
// does not change the model, the prompt, the effort, the token cap or the age bands, and
// it never REMOVES a source from the ordinary allow-list. A query that matches nothing --
// the overwhelming majority -- costs zero extra calls and behaves exactly as before.
//
// Pure, synchronous, no I/O. Same query always gives the same answer.
//
// Triggers are written in ORDINARY Arabic and normalised at module load with the same
// normaliser the query goes through, so a trigger can never silently fail to match
// because of a hamza, a ta-marbuta or a diacritic.

import { normalizeArabic } from './route-classify.js';

const N = (arr) => arr.map((s) => normalizeArabic(s)).filter(Boolean);

// Arabic attaches articles and pronouns to the word, so a plain padded-substring test is
// too strict: "إسناده" would not match the trigger "إسناد", and "أخرج" would not match
// "أخرجه". Fold each token the way lib/route-classify.js folds its own vocabulary --
// strip a leading article/conjunction and a trailing pronoun/plural -- and match a
// single-word trigger against ANY of a token's folded forms. Multi-word triggers stay a
// substring test, because a phrase already carries its own boundaries.
// Deliberately NOT a stemmer: bounded, reversible, and it never shortens a token below
// three characters, so 'سند' cannot start matching inside 'مسند'.
const PREFIXES = /^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/;
const SUFFIXES = ['هما', 'هم', 'هن', 'كم', 'ها', 'ات', 'ين', 'ون', 'نا', 'ه', 'ي', 'ك'];
function foldForms(tok) {
  const out = new Set([tok]);
  const bare = tok.replace(PREFIXES, '');
  if (bare && bare !== tok) out.add(bare);
  for (const base of [...out]) {
    for (const suf of SUFFIXES) {
      if (base.length > suf.length + 2 && base.endsWith(suf)) out.add(base.slice(0, -suf.length));
    }
  }
  return out;
}
// `words` is the folded token set for the whole query; `padded` the ' … ' wrapped text.
const hit = (padded, words, phrases) =>
  phrases.some((p) => (p.includes(' ') ? padded.includes(' ' + p + ' ') : words.has(p)));

// ── THE dorar.net TAKHRIJ INTENT IS GONE, AND WHAT WENT WITH IT ───────────────
//
// It targeted the Durar encyclopedia for «is this hadith sound, who graded it, who narrated
// it» — two rules, one on decisive takhrij terms and one on a hadith context plus a grading
// word, with a title-stripping helper so that NAMING «صحيح مسلم» was not read as ASKING about
// a verdict.
//
// IT WAS DEAD CODE, MEASURED. dorar.net was DEFERRED on 2026-08-05 (HTTP 403 on every path,
// including its documented JSON API) and is on NO band list: not SITES_MINOR, not
// SITES_MINOR_FALLBACK, not SITES_ADULT, not SITES_GENERAL, and on no purpose-filtered view of
// any of them. retrieve() checks the intent domain against the band's own list before acting on
// it, so the intent was emitted — nine times across the three bands in the probe — and discarded
// every single time. A branch that cannot be acted on is not a feature that is switched off; it
// is a claim in the source that the app does something it does not do.
//
// NOTHING WAS RE-ROUTED, because there is nothing to re-route to: the encyclopedia was the only
// hadith-grading source on the list (see lib/source-registry.js), so these questions already take
// the ordinary search, and that is unchanged by removing the intent they never travelled through.
// The day access is granted, this comes back with the domain — the triggers are in the history of
// this file, and re-admitting a source is a registry decision, not a classifier one.

// ── dr-mutlaq.com — ONLY what the site actually publishes AS TEXT ─────────────
// Vetted 2026-08-01 by walking the site's own post-sitemap once (70 posts, sequential,
// no bulk crawl): only 15 carry real HTML body text. The other 55 are PDF embeds, video
// posts or stubs whose visible "content" is a download button -- pages a citation must
// never point at, and which the text gate in retrieve.js now rejects outright.
//
// So these triggers are drawn from the 15 TEXT articles, not from the site's overall
// subject matter. Deliberately narrow and phrase-shaped: a source is only worth a
// detour when the page is specifically about the thing asked. Generic staples that this
// site covers but the big fatwa sites cover better (zakat al-fitr, laylat al-qadr,
// takbirat al-ihram) are intentionally NOT triggers on their own -- they would hijack an
// ordinary question, which the brief forbids.
const MUTLAQ_NAME = N([
  'مطلق الجاسر', 'د مطلق', 'الشيخ مطلق', 'دكتور مطلق', 'مطلق جاسر', 'الجاسر',
]);
const MUTLAQ_TOPICS = N([
  'مقاصد الشريعة في أول سورة النور', 'مقاصد سورة النور',
  'التهنئة بأعياد الكفار', 'تهنئة الكفار', 'أعياد الكفار', 'تهنئة غير المسلمين',
  'دراسة الفقه', 'المختصرات الفقهية', 'كيف أدرس الفقه', 'مختصرا فقهيا',
  'الغش في الدراسة', 'الغش في الامتحان', 'الغش في الاختبار',
  'إهداء الثواب', 'إهداء ثواب', 'مشروع خيري', 'ثواب الميت',
  'صلاة التراويح للمرأة', 'تراويح المرأة',
  'فقه الطبعات', 'حقوق الطبع', 'تصوير الكتب', 'بيع التلاخيص', 'التلاخيص',
  'آيات الصفات', 'عقيدة أهل السنة في الصفات',
  'كتاب ترياق', 'ترياق',
  'درة طالب العلم', 'إقرأ بأكثر من نية',
  // Named by the brief. The site's page for it is a PDF embed with no extractable text,
  // so this trigger currently always falls through to the ordinary search by design --
  // kept so it starts working the day that article is published as HTML.
  'نظرية تغير الفتوى', 'تغير الفتوى',
]);

// Build the padded text + folded token set a trigger list is matched against.
function lex(text) {
  const t = normalizeArabic(text);
  const w = new Set();
  for (const tok of t.split(' ')) if (tok) for (const f of foldForms(tok)) w.add(f);
  return { p: ' ' + t + ' ', w, empty: !t };
}

/**
 * Pick the ONE specialised source to try first, or null to use the ordinary search.
 *
 * @param {string} query   the search query the MODEL wrote for this angle
 * @param {{band?:string, depth?:string}} opts
 * @returns {{domain:string, reason:string}|null}
 */
export function classifySourceIntent(query, opts = {}) {
  const { p, w, empty } = lex(query);
  if (empty) return null;

  // 1) Hadith authentication had its branch here. See the note above: its only destination is
  //    deferred and on no list, so it is gone rather than dormant.

  // 2) Dr. Mutlaq al-Jasir. ADULT ONLY -- the domain is not on the minor allow-list, and
  // retrieve() re-checks that independently, so this is defence in depth rather than the
  // only gate. Naming the shaykh is decisive; otherwise the query must match one of the
  // topics he has actually published as text.
  if (opts.band === 'adult') {
    if (hit(p, w, MUTLAQ_NAME)) return { domain: 'dr-mutlaq.com', reason: 'names-the-shaykh' };
    if (hit(p, w, MUTLAQ_TOPICS)) return { domain: 'dr-mutlaq.com', reason: 'published-text-topic' };
  }

  return null;
}
