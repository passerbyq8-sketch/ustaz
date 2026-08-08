// lib/identity/index.js — IS THE PERSON NAMED IN THIS QUESTION A SCHOLAR, OR SOMEBODY ELSE?
//
// ── THE MEASURED DEFECT (قرار ٣) ─────────────────────────────────────────────
// «ماقول عبدالله الرويشد في أحكام العقيقه» — the reader named a Kuwaiti SINGER. The app had no
// way to know that, so the reply discussed «الشيخ عبدالله الرويشد» and answered as though a
// scholar had been asked about. Nothing in the pipeline was wrong: the name was unregistered, the
// question was a ruling question, and the ruling was correct. The premise was false and nobody
// owned the question of whether it was true.
//
// ── THE RULE THAT DECIDES EVERY BRANCH ───────────────────────────────────────
// «الأصلُ في الأسماءِ الجهلُ حتى يثبتَ العلم» — a name is UNKNOWN until a source says otherwise,
// and «scholar» is never the fallback. A name we cannot place gets the strict opening; it does
// not get a title on the balance of probability. This is the same fail-closed shape the rest of
// the app uses for bands and for sources.
//
// ── THE THREE STAGES, CHEAPEST FIRST ─────────────────────────────────────────
//   1. the whitelist        — zero cost, no network. Answers ابن باز and the classical authorities.
//   2. ar.wikipedia.org     — one fetch through the EXISTING safe path (قرار ٤). Answers the
//                             singers, the actors, the footballers — everyone with an article.
//   3. one live search      — from the day's budget, and only when the first two came up empty.
// A stage that answers ends the cascade. Every result is cached by the normalised name.
//
// ── NOTHING HERE CALLS A MODEL ───────────────────────────────────────────────
// The identity question is answered by a page or it is not answered. The predecessor of this file
// asked a model «is this name a scholar?» with no source and no check, and the measured failure
// was a confident wrong «yes» (lib/policy/entity-knowledge.js records it). This is a replacement
// by evidence, not a return to that.

import { whitelistLookup, identityKey } from './whitelist.js';

export const IDENTITY_TTL_DAYS = 30;
export const IDENTITY_TTL_SECONDS = IDENTITY_TTL_DAYS * 24 * 60 * 60;

// The outcomes. `unknown` is the default and the safe one.
export const IDENTITY = Object.freeze({
  SCHOLAR: 'scholar',
  PUBLIC_FIGURE: 'public_figure',
  AMBIGUOUS: 'ambiguous',
  UNKNOWN: 'unknown',
});

// ── WHAT MAKES A DESCRIPTION A SCHOLAR'S? ────────────────────────────────────
// Read off the SOURCE's own words, never inferred from the fact that a page exists. A Wikipedia
// lead that does not say the man is a scholar is not evidence that he is one — and by the rule
// above, that means he is not treated as one.
const SCHOLAR_WORDS = [
  'عالم', 'العالم', 'عالم دين', 'فقيه', 'الفقيه', 'محدث', 'المحدث', 'مفسر', 'المفسر',
  'مفتي', 'المفتي', 'شيخ', 'الشيخ', 'داعية', 'الداعية', 'قاض', 'القاضي', 'اصولي',
  'عالم مسلم', 'رجل دين', 'امام', 'الامام', 'خطيب', 'استاذ الشريعه', 'كليه الشريعه',
];
// ...and the descriptions that are emphatically NOT. Listed because they are what the measured
// failures actually were, and because a lead can mention a religious word in passing.
const NON_SCHOLAR_WORDS = [
  'مطرب', 'مغن', 'مغني', 'فنان', 'ممثل', 'لاعب', 'لاعب كره', 'رياضي', 'اعلامي',
  'مذيع', 'صحفي', 'شاعر', 'كاتب', 'سياسي', 'رجل اعمال', 'مقدم برامج', 'ملحن',
];

const fold = (s) => String(s == null ? '' : s)
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ة/g, 'ه')
  .replace(/\s+/g, ' ').trim();

// WHOLE WORDS, BUT ARABIC WHOLE WORDS. The conjunction «و» is written joined to the word it
// coordinates, and a Wikipedia lead is a LIST of roles: «مطرب وملحن كويتي», «ممثل ومخرج». A plain
// space-delimited test sees «وملحن» and not «ملحن», so it reads the second role of every lead as
// absent. MEASURED while writing the gate for this file: «مطرب كويتي وداعية معروف» matched
// NEITHER list, and only reached the right answer through the fallback — which meant the rule
// under test was never exercised.
//
// Only the coordinating «و» is allowed as a prefix. The definite article is not folded here
// because both spellings are already listed explicitly, and stripping «ال» blindly would make
// «العالم» match inside «العالمي».
const hasWord = (haystack, list) => {
  const padded = ' ' + fold(haystack) + ' ';
  return list.some((w) => {
    const f = fold(w);
    return padded.includes(' ' + f + ' ') || padded.includes(' و' + f + ' ');
  });
};

/**
 * Classify a source's own description of a person.
 *
 * THE ORDER IS THE RULE. A non-scholar word DECIDES, even beside a religious one: «مطربٌ أنشد
 * في المولد النبوي» is a singer. Only a description that says scholar and does not say
 * otherwise is read as a scholar; everything else that exists at all is a public figure.
 */
export function classifyDescriptor(descriptor) {
  const d = fold(descriptor);
  if (!d) return IDENTITY.UNKNOWN;
  if (hasWord(d, NON_SCHOLAR_WORDS)) return IDENTITY.PUBLIC_FIGURE;
  if (hasWord(d, SCHOLAR_WORDS)) return IDENTITY.SCHOLAR;
  return IDENTITY.PUBLIC_FIGURE;   // a described person who is not described as a scholar
}

// ── ar.wikipedia.org ─────────────────────────────────────────────────────────

/**
 * The article URL for a name. https only; the safe path re-checks it anyway.
 *
 * THE HARAKĀT AND THE TATWEEL COME OFF FIRST, and this is not cosmetic. Wikipedia article titles
 * are written WITHOUT diacritics, so «عبدالله_الرُّويْشِد» is a 404 and «عبدالله_الرويشد» is the
 * article. The model writes vocalised Arabic, so the vocalised form is the common input and the
 * unvocalised one is the exception — a builder that passed the reader's bytes through would miss
 * the page for exactly the questions this path exists to answer.
 *
 * The HAMZA FORMS ARE KEPT. Titles do distinguish «أ» from «ا» («أحمد» is not «احمد»), so folding
 * them here would trade one miss for another.
 */
export function wikipediaUrlFor(name) {
  const n = String(name || '')
    .replace(/[ً-ْٰـ]/g, '')   // harakāt, dagger alif, tatweel
    .trim()
    .replace(/\s+/g, '_');
  if (!n) return '';
  return 'https://ar.wikipedia.org/wiki/' + encodeURIComponent(n);
}

// A disambiguation page is «صفحة توضيح» — it lists people rather than describing one, and
// قرار ٣ says those are IN SCOPE: a name that belongs to several people is exactly the case the
// dual reply exists for, and treating the page as a miss would lose that.
const DISAMBIGUATION_MARKS = ['صفحه توضيح', 'صفحة توضيح', 'توضيح (توضيح)', 'قد يقصد ب', 'قد يشير الي'];

export function isDisambiguation(text) {
  return hasWord(text, DISAMBIGUATION_MARKS)
    || DISAMBIGUATION_MARKS.some((m) => fold(text).includes(fold(m)));
}

/**
 * The one-sentence description a Wikipedia lead opens with.
 *
 * Deliberately the FIRST sentence only. The lead's later sentences are biography; the first is
 * the definition, and it is the only part that answers «who is this».
 */
export function leadDescriptor(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const cut = t.search(/[.。؟!]\s/);
  const first = (cut === -1 ? t : t.slice(0, cut + 1)).trim();
  return first.slice(0, 300).trim();
}

// ── the cascade ──────────────────────────────────────────────────────────────

/**
 * Who is this? Three stages, cheapest first, first answer wins.
 *
 * EVERY EXTERNAL EFFECT IS INJECTED. `fetchPage`, `search` and `cache` are parameters, not
 * imports, so guards drive the whole cascade with fixtures and NOTHING reaches the network —
 * which is the lesson of the rfcwiring round, applied before the gate was written rather than
 * after it failed.
 *
 * @param {string} nameRaw
 * @param {{fetchPage?:Function, search?:Function, cache?:{get:Function,put:Function}, allowLiveSearch?:boolean}} deps
 * @returns {Promise<{kind:string, display:string, descriptor:string, url:string, source:string,
 *                    candidates?:Array}>}
 */
export async function identityFor(nameRaw, deps = {}) {
  const name = String(nameRaw || '').trim();
  const key = identityKey(name);
  const unknown = { kind: IDENTITY.UNKNOWN, display: name, descriptor: '', url: '', source: 'none' };
  if (!key) return unknown;

  const { fetchPage = null, search = null, cache = null, allowLiveSearch = false } = deps;

  // ── stage 0: the cache ────────────────────────────────────────────────────
  // Keyed on the NORMALISED name, so two spellings of one person share an entry. A cached
  // `unknown` is cached too — re-searching a name we already failed to place, on every turn,
  // is how a cheap miss becomes an expensive one.
  if (cache && typeof cache.get === 'function') {
    try {
      const hit = await cache.get(key);
      if (hit && hit.kind) return { ...hit, source: hit.source + '+cache' };
    } catch { /* a cache that cannot be read is a cache that is not used */ }
  }

  const remember = async (result) => {
    if (cache && typeof cache.put === 'function') {
      try { await cache.put(key, result, IDENTITY_TTL_SECONDS); } catch { /* never fail on a write */ }
    }
    return result;
  };

  // ── stage 1: the whitelist (zero cost) ────────────────────────────────────
  const wl = whitelistLookup(name);
  if (wl && wl.kind === 'ambiguous') {
    return remember({
      kind: IDENTITY.AMBIGUOUS, display: name, descriptor: '', url: '',
      source: 'whitelist', candidates: wl.candidates,
    });
  }
  if (wl) {
    return remember({
      kind: IDENTITY.SCHOLAR, display: wl.display, descriptor: wl.descriptor,
      url: wl.domain ? 'https://' + wl.domain + '/' : '', source: 'whitelist',
    });
  }

  // ── stage 2: ar.wikipedia.org, through the safe path ──────────────────────
  if (typeof fetchPage === 'function') {
    const url = wikipediaUrlFor(name);
    let page = null;
    try { page = await fetchPage(url); } catch { page = null; }
    const text = (page && (page.text || page.passage)) || '';
    if (text) {
      if (isDisambiguation(text)) {
        // A name several people share. NOT a miss, and not a pick either.
        return remember({
          kind: IDENTITY.AMBIGUOUS, display: name, descriptor: leadDescriptor(text),
          url: (page && page.finalUrl) || url, source: 'wikipedia', candidates: [],
        });
      }
      const descriptor = leadDescriptor(text);
      if (descriptor) {
        return remember({
          kind: classifyDescriptor(descriptor), display: name, descriptor,
          url: (page && page.finalUrl) || url, source: 'wikipedia',
        });
      }
    }
  }

  // ── stage 3: one live search, from the day's budget ───────────────────────
  // Gated by an explicit flag as well as by the callback's presence: a caller that has a search
  // function but no budget left must be able to say so without pretending it has none.
  if (allowLiveSearch && typeof search === 'function') {
    let hits = null;
    try { hits = await search(name); } catch { hits = null; }
    const first = Array.isArray(hits) ? hits.find((h) => h && (h.description || h.title)) : null;
    if (first) {
      const descriptor = leadDescriptor(first.description || first.title || '');
      if (descriptor) {
        return remember({
          kind: classifyDescriptor(descriptor), display: name, descriptor,
          url: first.url || '', source: 'live-search',
        });
      }
    }
  }

  // ── nothing placed the name ───────────────────────────────────────────────
  return remember(unknown);
}

// ── THE FACT BLOCK (قرار ٣ / P2-D) ───────────────────────────────────────────
//
// Injected BEFORE generation, so the model drafts knowing who was named rather than being
// corrected afterwards. It states a fact and a source, and it gives the model its instruction for
// this one case — it does not argue, and it never says «الشيخ» about a person the source did not
// call one.

export const NO_IDENTITY_OPENING = 'لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم';

export function identityFactBlock(result, { question = '' } = {}) {
  const r = result || {};
  const who = String(r.display || '').trim();
  const lines = ['تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):'];

  if (r.kind === IDENTITY.SCHOLAR) {
    // The scholar path is UNCHANGED, and saying so is the point of this branch existing at all.
    lines.push('هويّةُ الاسمِ المذكور: «' + who + '» — ' + (r.descriptor || 'من أهل العلم')
      + (r.url ? ' — ' + r.url : ''));
    lines.push('- أجِبْ كما تُجيبُ في مسائلِ أهلِ العلم، ولا تُغيِّرْ شيئًا من أجلِ هذا التنبيه.');
    return lines.join('\n');
  }

  if (r.kind === IDENTITY.PUBLIC_FIGURE) {
    // THE PREMISE IS CORRECTED, AND THEN THE QUESTION IS STILL ANSWERED. A reply that only
    // corrects the reader has refused him an answer he was entitled to.
    lines.push('هويّةُ الاسمِ المذكور: «' + who + '» — ' + (r.descriptor || '')
      + (r.url ? ' — ' + r.url : ''));
    lines.push('- هذا الاسمُ ليس من أهلِ العلمِ بحسبِ المصدرِ أعلاه، فلا تصفْه بشيخٍ ولا عالِمٍ ولا مفتٍ.');
    lines.push('- صحِّحِ المقدّمةَ بإيجازٍ من بطاقتِه، ثمّ **أجِبْ عن المسألةِ نفسِها** من المصادرِ المعتمدة.');
    lines.push('- لا تنقلْ عنه قولًا في المسألة، ولا تحكمْ عليه، ولا تتحدّثْ عن دينِه أو نيّتِه.');
    return lines.join('\n');
  }

  if (r.kind === IDENTITY.AMBIGUOUS) {
    const names = (r.candidates || []).map((c) => c && c.display).filter(Boolean);
    lines.push('هويّةُ الاسمِ المذكور: «' + who + '» يحملُه أكثرُ من واحد'
      + (names.length ? ' — منهم: ' + names.join(' · ') : '') + (r.url ? ' — ' + r.url : ''));
    // P2-E: BOTH identities are injected, and the scholar branch may be printed ONLY with a
    // sourced statement behind it. The clarifying question is NOT asked here — قرار ٣ retires it
    // from the names path, because asking it costs the reader a turn to learn something the
    // sources could have said.
    lines.push('- اذكرِ الاحتمالين بإيجاز، ولا تختَرْ أحدَهما من عندِك.');
    lines.push('- ولا تكتبْ «وإن كنتَ تقصدُ الشيخَ فلانًا فقولُه كذا» إلّا إن كان قولُه في المصادرِ '
      + 'المرفقةِ فعلًا؛ وإلّا فقلْ: «لم أقفْ على قوله».');
    lines.push('- ثمّ أجِبْ عن المسألةِ نفسِها من المصادرِ المعتمدة.');
    return lines.join('\n');
  }

  // UNKNOWN — the default, and the strict opening.
  lines.push('هويّةُ الاسمِ المذكور: لا هويّةَ معروفة.');
  lines.push('- افتحِ الجوابَ بهذا المعنى نصًّا: «' + NO_IDENTITY_OPENING + '».');
  lines.push('- الأصلُ في الأسماءِ الجهلُ حتى يثبتَ العلم، فلا تصفْه بشيخٍ ولا عالِمٍ ولا فنّانٍ '
    + 'ولا بأيِّ صفةٍ، ولا تُخمِّنْ من اسمِه.');
  lines.push('- ثمّ أجِبْ عن المسألةِ نفسِها من المصادرِ المعتمدة.');
  return lines.join('\n');
}
