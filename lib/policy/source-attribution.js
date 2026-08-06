// lib/policy/source-attribution.js
// WHICH PERSON MAY BE NAMED IN A REPLY DRAWN FROM THESE PAGES.
//
// ── THE THREE MEASURED FAILURES ──────────────────────────────────────────────
//
//   «ما رأي طارق العلي في أحكام العدة؟»  ->  «داعية وخطيب كويتي معروف من أهل العلم … يتبنّى
//   المذهب الحنفي», plus four rulings credited to «رأيه» — over one card from alukah.net titled
//   «أحكام العدة للمرأة (خطبة)», a page that does not contain his name anywhere. He is a Kuwaiti
//   comic actor.
//
//   «الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم.» He is alive and he is a scholar.
//
//   «اتفق ابن حجر مع الجمهور … في الفتح», over an إسلام ويب page that never mentions him.
//
// Not one of those sentences came from a page. Every one of them came from the model's
// recollection of a person, arriving in the app's own voice with a source card underneath it that
// the reader has every reason to read as backing it.
//
// ── THE RULE, AND WHY IT IS ABOUT THE SOURCE AND NOT ABOUT THE NAME ──────────
// «عزك ناقلٌ لا مفتٍ.» He transmits from a page and says whose page it was. So the question this
// module answers is never "is this man a scholar" — that is a question about the world, and the
// batch that removed the model call asking it is the same batch that added this file. The question
// is "does the page in hand license naming him", and it has four ordered answers:
//
//   1. EXTRACTED METADATA OUTRANKS EVERYTHING. A byline the page gate really pulled out of the
//      document names the author, even when the domain belongs to somebody else.
//   2. DOMAIN OWNERSHIP, when there is no byline — UNLESS the extracted text is transmitting
//      another registered entity («جاء في فتوى اللجنة الدائمة», «قال ابن تيمية», «سُئل الشيخ
//      فلان»), in which case the attribution drops to the SITE. A fatwa of the Standing Committee
//      quoted on Ibn Baz's archive is not a fatwa of Ibn Baz.
//   3. THE NAME IN THE TEXT, on an aggregator or a domain nobody owns. No name in the page, no
//      person in the reply.
//   4. OTHERWISE NOBODY. The ruling stays attributed to its page and the person disappears from
//      the sentence rather than the sentence disappearing from the answer.
//
// ── WHAT THIS MODULE DOES NOT DO ─────────────────────────────────────────────
// No I/O, no model call, no ruling, no source selection, and no guessing. It reads pages that have
// already been fetched and gated, and reports ids. Everything it can do is NARROW what a reply may
// claim; there is no branch here that adds an attribution to anything.

import { fold, ROSTER } from './entities.js';
import { ownerOf } from '../ledger/source-policy.js';
import { resolveScholar } from '../source-registry.js';

export const ATTRIBUTION_SOURCE_CLASS = Object.freeze({
  /** The page's own byline named him. */
  METADATA_AUTHOR: 'METADATA_AUTHOR',
  /** No byline, and the domain is his. */
  DOMAIN_OWNER: 'DOMAIN_OWNER',
  /** An aggregator, and his registered name is in the extracted text. */
  NAME_IN_TEXT: 'NAME_IN_TEXT',
  /** Nobody. The page may be cited; no person may be credited from it. */
  SITE_ONLY: 'SITE_ONLY',
});

const PERSONS = ROSTER.filter((e) => e.targetType === 'person');
const PERSON_BY_ID = new Map(PERSONS.map((e) => [e.canonicalId, e]));

/** Every folded surface an entity answers to: its aliases and its display form. */
function surfacesOf(e) {
  return [...new Set([...(e.aliases || []), fold(e.display || '')])].filter(Boolean);
}

// A registered alias only counts when it stands as its own word run. Arabic glues the article and
// the prepositions on, so the boundary is "not an Arabic letter" — which admits «للشيخ ابن باز»
// and refuses «العباد» inside «العبادات».
const AR_LETTER = /[ء-يٮ-ۓۮ-ۿ]/;
const TITLES = 'الشيخ|العلامه|الامام|الدكتور|الفقيه|المفتي|العالم|سماحه|فضيله|شيخ الاسلام|شيخ';

/**
 * Does `surface` occur in `hay` as a whole word run?
 *
 * A ONE-WORD SURFACE NEEDS AN HONORIFIC. «الخميس» is Thursday, «مسلم» is any Muslim and «مالك» is
 * an owner; a rule that licensed a person off those words alone would read a fatwa of Ibn Baz's
 * out of a page about fasting on Mondays and Thursdays. So a bare single word identifies nobody,
 * and the same word behind «الشيخ» or «الإمام» identifies him — which is exactly how the page
 * would have to write it to mean the man.
 */
function occursAsWord(hay, surface, { singleWordNeedsTitle = true } = {}) {
  if (!surface) return false;
  const multi = surface.includes(' ');
  let from = 0;
  for (;;) {
    const at = hay.indexOf(surface, from);
    if (at === -1) return false;
    from = at + 1;
    const before = at > 0 ? hay[at - 1] : ' ';
    const after = at + surface.length < hay.length ? hay[at + surface.length] : ' ';
    if (AR_LETTER.test(before) || AR_LETTER.test(after)) continue;
    if (multi || !singleWordNeedsTitle) return true;
    // A single word: an honorific must sit immediately in front of it.
    if (new RegExp('(?:' + TITLES + ')\\s+$', 'u').test(hay.slice(Math.max(0, at - 24), at))) return true;
  }
}

/** The registered persons whose names occur in this folded text. Roster order, deduplicated. */
function personsNamedIn(folded, opts) {
  const out = [];
  for (const e of PERSONS) {
    if (surfacesOf(e).some((s) => occursAsWord(folded, s, opts))) out.push(e.canonicalId);
  }
  return [...new Set(out)];
}

/**
 * The registered person a BYLINE names, or ''.
 *
 * The shipped resolver is asked first, because a byline is exactly the thing it was written for —
 * a name somebody typed — and its whole-word rule and its ambiguity refusal are the ones the rest
 * of the app already lives by. The roster is consulted after it, so a historical name in a byline
 * on an aggregator is not lost merely because he owns no domain.
 */
export function personFromByline(bylineRaw) {
  const raw = String(bylineRaw || '').trim();
  if (!raw) return '';
  try {
    const r = resolveScholar(raw);
    if (r.status === 'resolved') {
      const id = ownerOf(r.domain);
      if (id && PERSON_BY_ID.has(id)) return id;
    }
  } catch { /* the roster below is the fallback, not an error path */ }
  const f = fold(raw).replace(new RegExp('^(?:' + TITLES + ')\\s+', 'u'), '');
  // A byline is a name and not prose, so a single word standing ALONE identifies its man — but a
  // single word buried in a longer byline still does not.
  const named = PERSONS.filter((e) => surfacesOf(e).some((s) => s === f || occursAsWord(f, s)));
  return named.length === 1 ? named[0].canonicalId : '';
}

// A frame that credits somebody ELSE with what follows. `fold()` has already turned «سُئل» into
// «سيل» and «أورد» into «اورد», so these are the folded spellings.
//
// THE POSITION VERBS ARE IN HERE, and leaving them out cost the previous batch's whole
// encyclopedic transmission. «وقد ذهب شيخ الإسلام ابن تيمية رحمه الله إلى أن…» on islamqa.info is
// the single commonest shape of "this page is reporting somebody else", and it carries no
// quotation frame at all — so the page read as al-Munajjid's own answer and licensed him instead
// of the man it was actually about.
const TRANSMISSION_FRAME = 'ذكر|نقل|ينقل|اورد|حكي|جاء في|ورد في|بحسب|وفق|افاد|قال|يقول|سيل|اجاب'
  + '|روي عن|نقلا عن|فتوي|فتاوي|جواب|كلام|ذهب|يذهب|يري|راي|رجح|اختار|افتي|يفتي|مذهب|صحح|ضعف|قرر|نص';
// The frame and the name it frames may not be far apart, but «ذهب شيخ الإسلام ابن تيمية» puts a
// thirteen-character honorific between them and a tighter gap silently missed it.
const FRAME_WINDOW = 60;

/**
 * IS THIS PAGE TRANSMITTING SOMEBODY OTHER THAN ITS OWNER?
 *
 * A scholar's own archive republishes other people constantly — a committee's decision, an earlier
 * imam's words, a question put to a third shaykh. The domain says whose SITE it is; it does not
 * say whose WORDS these are, and reading the second off the first is how «فتوى اللجنة الدائمة»
 * became a fatwa of Ibn Baz's.
 */
function transmitsAnother(folded, ownerEntity) {
  const ownerSurfaces = new Set(ownerEntity ? surfacesOf(ownerEntity) : []);
  // BOTH SIDES OF THE NAME. Arabic puts the subject before the verb too, so «ابن تيمية يرى كذا»
  // is the same report as «يرى ابن تيمية كذا» — and a check that only reads leftwards is a check
  // the commoner of the two word orders walks straight past.
  const frameBefore = (at) => new RegExp('(?:' + TRANSMISSION_FRAME + ')[^\\n]{0,24}$', 'u')
    .test(folded.slice(Math.max(0, at - FRAME_WINDOW), at));
  const frameAfter = (end) => new RegExp('^[^\\n]{0,24}(?:' + TRANSMISSION_FRAME + ')', 'u')
    .test(folded.slice(end, end + FRAME_WINDOW));

  for (const e of ROSTER) {
    if (e.targetType !== 'person' && e.targetType !== 'institution') continue;
    if (ownerEntity && e.canonicalId === ownerEntity.canonicalId) continue;
    for (const s of surfacesOf(e)) {
      if (ownerSurfaces.has(s)) continue;
      let from = 0;
      for (;;) {
        const at = folded.indexOf(s, from);
        if (at === -1) break;
        from = at + 1;
        const before = at > 0 ? folded[at - 1] : ' ';
        const after = at + s.length < folded.length ? folded[at + s.length] : ' ';
        if (AR_LETTER.test(before) || AR_LETTER.test(after)) continue;
        if (!s.includes(' ')
          && !new RegExp('(?:' + TITLES + ')\\s+$', 'u').test(folded.slice(Math.max(0, at - 24), at))) continue;
        if (frameBefore(at) || frameAfter(at + s.length)) return true;
      }
    }
  }
  // «سُئل الشيخ فلان» — a man nobody has registered, put a question to and answered on somebody
  // else's site. He is not in any roster, so the loop above cannot see him; the SHAPE is what says
  // these are not the owner's words.
  //
  // AND THE SHAPE ALONE IS NOT ENOUGH, which cost the adapted corpus its owner while this was
  // being written. «سُئل فضيلة الشيخ عمّن أسقطت دون ثمانين يومًا فأجاب…» is the ORDINARY format of
  // a fatwa on a shaykh's own archive: the honorific is his, and what follows it is the question,
  // not somebody else's name. So the run behind the honorific must look like a personal name —
  // two or more words, none of them a question word, a supplication or an epithet — before this
  // may overrule the domain.
  const m = folded.match(new RegExp(
    '(?:' + TRANSMISSION_FRAME + ')\\s+(?:' + TITLES + ')\\s+([ء-ي]+(?:\\s+[ء-ي]+){0,3})', 'u'));
  if (m && m[1]) {
    const run = m[1].replace(new RegExp('^(?:(?:' + TITLES + ')\\s+)+', 'u'), '').trim();
    const words = run.split(' ').filter(Boolean);
    const nameLike = words.length >= 2 && words.every((w) => !NOT_A_NAME.has(w));
    if (nameLike && !ownerSurfaces.has(run) && ![...ownerSurfaces].some((s) => run.includes(s))) return true;
  }
  return false;
}

// Words that cannot be part of a person's name, so a run containing one is the question or a
// supplication rather than somebody being named.
const NOT_A_NAME = new Set([
  'عمن', 'عما', 'عن', 'في', 'من', 'هل', 'ما', 'اذا', 'حول', 'بخصوص', 'الي', 'علي', 'ان', 'انه',
  'رحمه', 'حفظه', 'ايده', 'وفقه', 'غفر', 'الله', 'تعالي', 'عليه', 'وسلم', 'الكريم', 'الفاضل',
  'الجليل', 'المحترم', 'السايل', 'السايله', 'التالي', 'هذا', 'هذه', 'ذلك', 'كذا', 'الذي', 'التي',
  'سيال', 'سوال', 'وقد', 'وهل', 'فقال', 'فاجاب', 'اجاب', 'قايلا', 'نصه', 'نصها',
]);

function hostOf(page) {
  const raw = String((page && (page.url || page.canonicalUrl || page.host)) || '').trim();
  if (!raw) return '';
  try { return new URL(raw).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return raw.toLowerCase().replace(/^www\./, '').split('/')[0]; }
}

function safeOwnerOf(host) {
  if (!host) return null;
  try { return ownerOf(host); } catch { return null; }
}

/**
 * WHO MAY BE NAMED OUT OF THIS ONE PAGE.
 *
 * @param {{url?:string, host?:string, author?:string, text?:string, passage?:string}} page
 * @returns {{class:string, personIds:string[], host:string, reason:string}}
 */
export function pageAttribution(page) {
  const p = page || {};
  const host = hostOf(p);
  const text = fold(String(p.text || p.passage || ''));

  // 1. THE BYLINE THE PAGE GATE ACTUALLY EXTRACTED. It outranks the domain, because a document
  //    that names its own author has answered the question the domain was only a proxy for.
  const byline = personFromByline(p.author);
  if (byline) {
    return { class: ATTRIBUTION_SOURCE_CLASS.METADATA_AUTHOR, personIds: [byline], host, reason: 'byline' };
  }

  // 2. WHOSE DOMAIN IS THIS. Only a PERSON's ownership can license naming a person: an institution
  //    owns eftaa.awqaf.gov.kw and iifa-aifi.org, and a board's collective decision is nobody's
  //    personal fatwa — which is what those rows say in their own notes.
  const ownerId = safeOwnerOf(host);
  if (ownerId) {
    const owner = PERSON_BY_ID.get(ownerId);
    if (!owner) {
      return { class: ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, personIds: [], host, reason: 'owner-not-a-person' };
    }
    if (transmitsAnother(text, owner)) {
      // ── WHAT «تنزل النسبة إلى الموقع» COSTS THE OWNER, AND ONLY HIM ───────
      //
      // The owner loses the page: it is not his answer, and that is the whole point of the
      // exception — a Standing Committee fatwa reproduced on binbaz.org.sa is not a fatwa of Ibn
      // Baz's, and after this branch he cannot be named from it whatever else it says.
      //
      // What the page does NOT stop being is a page, and it is now functioning as an aggregate
      // one. So it is read under tier 3 exactly as إسلام ويب would be, with the owner struck out.
      // MEASURED, and this is why the branch is here rather than a bare SITE_ONLY: islamqa.info
      // is owned by a person, so a page of it documenting «رأي ابن تيمية» transmits another and
      // fell to SITE_ONLY — which silently deleted the grade-C encyclopedic transmission the
      // previous batch built, on the one host that carries most of it. Refusing to name the owner
      // is the rule; refusing to name anybody is a different and much larger rule.
      const others = personsNamedIn(text).filter((id) => id !== ownerId);
      if (others.length) {
        return { class: ATTRIBUTION_SOURCE_CLASS.NAME_IN_TEXT, personIds: others, host, reason: 'transmits-another' };
      }
      return { class: ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, personIds: [], host, reason: 'transmits-another' };
    }
    return { class: ATTRIBUTION_SOURCE_CLASS.DOMAIN_OWNER, personIds: [ownerId], host, reason: 'domain-owner' };
  }

  // 3. AN AGGREGATOR, OR A DOMAIN NOBODY OWNS. Only a name the page really contains.
  const named = personsNamedIn(text);
  if (named.length) {
    return { class: ATTRIBUTION_SOURCE_CLASS.NAME_IN_TEXT, personIds: named, host, reason: 'name-in-text' };
  }

  // 4. NOBODY.
  return { class: ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, personIds: [], host, reason: 'no-person' };
}

/**
 * THE LICENCE A WHOLE RESULT SET GRANTS.
 *
 * The union, because the reply is drafted over all of the pages at once and a sentence resting on
 * the second card is as sourced as one resting on the first. An empty array in, an empty licence
 * out — and an empty licence is a real answer, not a missing one.
 *
 * @param {Array} pages
 * @returns {{personIds:string[], pages:Array<{host:string, class:string, personIds:string[]}>}}
 */
export function attributionLicence(pages) {
  const list = Array.isArray(pages) ? pages.filter(Boolean) : [];
  const ids = [];
  const rows = [];
  for (const p of list) {
    const a = pageAttribution(p);
    rows.push({ host: a.host, class: a.class, personIds: a.personIds });
    for (const id of a.personIds) if (!ids.includes(id)) ids.push(id);
  }
  return { personIds: ids, pages: rows };
}

/**
 * Every folded surface the licensed ids answer to — what the draft screen subtracts from the set
 * of names it polices. Exported so the two paths cannot compute it differently.
 */
export function licensedSurfaces(personIds) {
  const out = new Set();
  for (const id of Array.isArray(personIds) ? personIds : []) {
    const e = PERSON_BY_ID.get(id);
    if (!e) continue;
    for (const s of surfacesOf(e)) out.add(s);
  }
  return out;
}

/** Every folded surface of every registered person. The starting set the screen polices. */
export function allPersonSurfaces() {
  const out = new Set();
  for (const e of PERSONS) for (const s of surfacesOf(e)) out.add(s);
  return out;
}
