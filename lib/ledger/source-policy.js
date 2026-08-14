// lib/ledger/source-policy.js
// THE MACHINE-READABLE SOURCE POLICY. One row per domain the ledger engine may reach, with
// per-capability eligibility, the adapter that reads it, and the page/date rules that decide
// whether a fetched URL is evidence at all.
//
// ── THE THREE THINGS THIS FILE MAY NOT DO ────────────────────────────────────
// 1. It may not ADD a domain. Its enabled+searchable set is asserted equal to
//    lib/source-registry.js's active domains by ledger-contract-guard.cjs. A domain that is
//    not already vetted, age-banded and page-gated by the shipped path cannot enter here.
// 2. It may not ACTIVATE a deferred or blocked source. shkhudheir.com stays disabled; the
//    audio-only corpora stay ineligible for the capabilities their recordings cannot support.
// 3. It may not RELAX a restriction the shipped code already enforces. It may TIGHTEN one —
//    and it does, in the places where `scopes` was too coarse to say what needed saying
//    (dorar.net is not a tafsir source; al-abbaad.com is not a fatwa source; a site being on
//    the list has never meant a scholar's opinion may be read off it).
//
// ── WHY ONE HOST IS HERE AND NOT ON THE SEARCH LIST ──────────────────────────
// binothaimeen.net carries `searchable: false`. It is the host lib/binothaimeen.js has always
// read through its own adapter, and it has never been in the Brave `site:` filter. Declaring
// it here does not put it there: every list this module hands to the query builder is filtered
// by `searchable`, and the guard proves the searchable set is exactly the registry's. What the
// row buys is the ability to say, in data, that a primary opinion of Ibn Uthaymeen has a
// registered adapter and a primary opinion of anyone else does not.

import { activeSources, blockedSources, normalizeDomain, findSource, resolveScholar } from '../source-registry.js';
import { policy, emptyPolicy, CAPABILITIES, isHealth } from './capability.js';

// ── tracking parameters ──────────────────────────────────────────────────────
// The ONLY query parameters that may be stripped when canonicalising a URL. Every one of
// these is a documented analytics tag that no server reads for content selection.
//
// `ref`, `page`, `id`, `q`, `p` and anything unrecognised are DELIBERATELY ABSENT. On these
// sites the query string frequently selects the content — tafsir.app and the fatwa portals
// both do it — so a canonicaliser that dropped an unknown parameter would fold two different
// pages into one and cite the wrong one. Only a per-domain adapter may declare a parameter
// non-functional, via `removableTrackingParams` on its row.
export const GLOBAL_TRACKING_PARAMS = Object.freeze([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'yclid', '_ga', '_gl',
]);

const EXTRACTION_SCHEMA_VERSION = 'span-v1';
export const SOURCE_POLICY_VERSION = 'ledger-policy-2026-08-03';

// A row constructor that fills in every field, so no consumer has to test for absence.
function R(row) {
  const domain = normalizeDomain(row.domain);
  if (!domain) throw new Error('unparseable domain: ' + row.domain);
  return Object.freeze({
    domain,
    ownerId: row.ownerId || null,
    adapterId: row.adapterId,
    adapterVersion: row.adapterVersion,
    health: row.health,
    searchable: row.searchable !== false,
    capabilityPolicy: row.health === 'enabled' ? policy(row.caps || {}) : emptyPolicy(),
    // URL shapes the site's OWN structure proves are indexes rather than answers. Kept as
    // data so the pre-fetch refusal and the post-fetch refusal read the same list.
    confirmedIndexPatterns: Object.freeze(row.confirmedIndexPatterns || []),
    softIndexPatterns: Object.freeze(row.softIndexPatterns || []),
    removableTrackingParams: Object.freeze(row.removableTrackingParams || []),
    pagePolicy: Object.freeze({
      minAnswerChars: row.minAnswerChars == null ? 300 : row.minAnswerChars,
      requiresTranscript: !!row.requiresTranscript,
      extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
      ...(row.pagePolicy || {}),
    }),
    // Dates. `sourceOfTruth` says which field the site actually publishes; nothing may be
    // presented as a publication date unless the site published one.
    datePolicy: Object.freeze({
      publishesDate: !!row.publishesDate,
      dateSource: row.dateSource || 'none',
      treatModifiedAsPublished: false,     // never. Not configurable; see gate 3's wording rules.
      ...(row.datePolicy || {}),
    }),
    note: row.note || '',
  });
}

// ── the table ────────────────────────────────────────────────────────────────
// Priorities are ORDERING ONLY and have no meaning across capabilities. Within one
// capability they say which source a question of that kind should meet first.
const ROWS = [
  // ── general fatwa portals ──────────────────────────────────────────────────
  R({
    domain: 'islamqa.info', ownerId: 'almunajjid', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', publishesDate: true, dateSource: 'published',
    caps: { fatwa: 92, tafsir: 55, hadith_text: 45, hadith_explanation: 45, hadith_grading: 35, general_article: 50 },
  }),
  R({
    domain: 'islamweb.net', ownerId: null, adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', publishesDate: true, dateSource: 'published',
    caps: { fatwa: 90, tafsir: 55, hadith_text: 45, hadith_explanation: 45, hadith_grading: 35, general_article: 50 },
  }),
  R({
    // COMMITTEE VS PERSON. The board's collective fatwas and Shaykh al-Kurdi's personal
    // answers sit on one site, and presenting either as the other is the misattribution the
    // page gates already refuse. So: fatwa YES, scholar_opinion_primary NO — a personal
    // opinion may not be read off this host even when the page carries a name.
    domain: 'eftaa.awqaf.gov.kw', ownerId: 'eftaa-committee-kw', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', publishesDate: false,
    caps: { fatwa: 85, general_article: 40 },
    note: 'فتوى الجهة/اللجنة تُفصل عن الجواب الشخصي؛ لا تُنسب فتوى اللجنة إلى شخص ولا العكس.',
  }),
  R({
    domain: 'iifa-aifi.org', ownerId: 'iifa', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', publishesDate: true, dateSource: 'published',
    caps: { fatwa: 95, general_article: 40 },
    note: 'قرارات مجمعية جماعية؛ ليست رأيًا شخصيًّا لعالم بعينه.',
  }),

  // ── scholars with their own sites ──────────────────────────────────────────
  R({
    // THE ONE OTHER PRIMARY-OPINION SOURCE. binbaz.org.sa is Ibn Baz's own official fatwa
    // archive, its /fatwas/{id} pages are single answers, and lib/source-registry.js already
    // resolves his name to it. That is what a registered direct adapter means here, and it is
    // why «ما رأي الشيخ ابن باز» can be answered while «ما رأي الشيخ عبدالمحسن العباد» cannot.
    domain: 'binbaz.org.sa', ownerId: 'ibn-baz', adapterId: 'binbaz-official', adapterVersion: 'v1',
    health: 'enabled', publishesDate: false,
    caps: { fatwa: 88, scholar_opinion_primary: 95, tafsir: 50, hadith_text: 40, hadith_explanation: 40, general_article: 45 },
  }),
  R({
    // ADAPTER-ONLY, AND NOT SEARCHABLE. lib/binothaimeen.js reads this host directly and has
    // never used Brave. `searchable: false` keeps it out of every site: filter this module
    // builds, so declaring it widens nothing.
    domain: 'binothaimeen.net', ownerId: 'ibn-uthaymeen', adapterId: 'binothaimeen', adapterVersion: 'v1',
    health: 'enabled', searchable: false, publishesDate: false,
    caps: { fatwa: 90, scholar_opinion_primary: 98, general_article: 30 },
    note: 'محول مباشر مسجل؛ لا يدخل قائمة البحث ولا يُطلب عبر Brave.',
  }),
  R({
    domain: 'sh-albarrak.com', ownerId: 'al-barrak', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', caps: { fatwa: 70, tafsir: 30, hadith_text: 25, general_article: 40 },
  }),
  R({
    domain: 'almosleh.com', ownerId: 'al-mosleh', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', caps: { fatwa: 70, tafsir: 30, hadith_text: 25, general_article: 40 },
  }),
  R({
    // ferkous.APP. MEASURED 2026-08-05: ferkous.com answers 302 to this domain on every path and
    // the redirect lands on HTTP, which canonical.js refuses. Same owner, same caps, live name.
    domain: 'ferkous.app', ownerId: 'ferkous', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', caps: { fatwa: 70, tafsir: 30, hadith_text: 25, general_article: 40 },
  }),
  R({
    // Text fatwas only, and only where the page gate confirms the page and the author.
    domain: 'ibn-jebreen.com', ownerId: 'ibn-jebreen', adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', minAnswerChars: 300,
    confirmedIndexPatterns: ['/textlibrary', '/indexs', '/objective', '/topicscontent'],
    caps: { fatwa: 75, tafsir: 30, hadith_text: 25, general_article: 40 },
  }),
  R({
    // MEASURED: fatwa pages exist whose answer field is empty while the raw page still yields
    // thousands of characters of chrome. The answer text must be proved, not inferred.
    domain: 'mostafaaladwy.com', ownerId: 'mostafa-aladwy', adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', minAnswerChars: 20,
    confirmedIndexPatterns: ['/fatwa-category', '/videos-category', '/books'],
    softIndexPatterns: ['/fatwa'],
    caps: { fatwa: 70, tafsir: 30, hadith_text: 30, general_article: 40 },
  }),
  R({
    // GENERAL ONLY, this batch. islamqa.info is his fatwa corpus and is already listed; this
    // host is lessons and articles and may not back a decisive ruling.
    domain: 'almunajjid.com', ownerId: 'almunajjid', adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', caps: { general_article: 40 },
    note: 'عام فقط؛ لا فتوى حاسمة في هذه الدفعة.',
  }),
  R({
    // AUDIO. The fatwas and khutbahs are .mp3 with no transcript page anywhere on the site, so
    // no capability that requires a ruling may be served from it. This is `enabled` with a
    // narrow policy rather than `deferred`, because its biography and news pages ARE text.
    domain: 'saleh.af.org.sa', ownerId: 'saleh-al-sheikh', adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', requiresTranscript: true, minAnswerChars: 400,
    confirmedIndexPatterns: ['/ar/ftawa', '/ar/khotab', '/ar/mohadrat', '/ar/news', '/ar/books', '/ar/droos'],
    caps: { general_article: 30 },
    note: 'الفتاوى والخطب صوتية بلا تفريغ؛ لا يُستشهد به في حكم.',
  }),
  R({
    domain: 'khaledalsabt.com', ownerId: 'khaled-alsabt', adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', minAnswerChars: 400,
    confirmedIndexPatterns: ['/interpretations/category', '/explanations/book'],
    caps: { tafsir: 80, general_article: 45 },
    note: 'تفسير وتدبر وشروح؛ ممنوع كمصدر فتوى أو حكم نازلة.',
  }),
  R({
    // HADITH AND ARTICLES, AND DELIBERATELY NOT HIS OPINION. He is a muhaddith and his single
    // article pages extract clean, but no adapter reads this site as a primary-opinion corpus,
    // so `scholar_opinion_primary` is refused — which is what makes «ما رأي الشيخ عبدالمحسن
    // العباد» a refusal before a search rather than a general article wearing his name.
    domain: 'al-abbaad.com', ownerId: 'al-abbaad', adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', requiresTranscript: true,
    confirmedIndexPatterns: ['/lecture', '/books', '/index'],
    caps: { hadith_text: 85, hadith_explanation: 85, general_article: 50 },
    note: 'صفحات المقالات المفردة فقط؛ لا فتوى ولا تفسير ولا رأي مباشر في هذه الدفعة.',
  }),
  R({
    domain: 'al-badr.net', ownerId: 'abdurrazzaq-albadr', adapterId: 'readability', adapterVersion: 'r1',
    health: 'deferred', searchable: false, caps: {},
    note: 'مؤجَّل 2026-08-14: نص واجهة ثابت بلا مادة قابلة للاقتباس؛ لا يُعاد حتى يُبنى محول خاص.',
  }),
  R({
    domain: 'othmanalkhamees.com', ownerId: 'othman-alkhamees', adapterId: 'readability', adapterVersion: 'r1',
    health: 'deferred', searchable: false, caps: {},
    note: 'مؤجَّل للبحث الحي 2026-08-14: raw-fallback يحتاج محدد نص؛ خدمة الفتاوى هي المحول المؤهل الحالي.',
  }),

  // ── subject-matter sources ─────────────────────────────────────────────────
  R({
    // HADITH, AND NOT EVERYTHING. The Durar encyclopedia is the grading reference and its fiqh
    // encyclopedia is a real fiqh source, but «on the list» has never meant «for any purpose»:
    // tafsir and primary opinions are somebody else's job.
    // DEFERRED 2026-08-05. Measured HTTP 403 for every server-side request on every path tried,
    // including its own documented /dorar_api.json. The row and its caps are kept as the record of
    // WHAT IS LOST — a hadith-grading reference at priority 95 — so re-admitting it the day access
    // is granted is a one-word change.  makes every capability ineligible.
    domain: 'dorar.net', ownerId: 'dorar', adapterId: 'readability', adapterVersion: 'r1',
    health: 'deferred', searchable: false,
    caps: {},
    note: 'مؤجَّل 2026-08-05: HTTP 403 لكل عميل خادميّ، بما فيه /dorar_api.json المنشور. كان يحمل تخريج الحديث ودرجته.',
  }),
  R({
    // DEFERRED 2026-08-05: 200 and ~150 KB with an EMPTY body — zero extractable characters from
    // Readability and from the raw fallback alike. tafsir.net below carries tafsir.
    domain: 'tafsir.app', ownerId: null, adapterId: 'readability', adapterVersion: 'r1',
    health: 'deferred', searchable: false, caps: {},
    note: 'مؤجَّل 2026-08-05: مُصيَّر بجافاسكربت، صفر حرف مستخرَج. يحمل التفسيرَ tafsir.net.',
  }),
  R({
    domain: 'tafsir.net', ownerId: 'tafsir-center', adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', publishesDate: true, dateSource: 'published',
    caps: { tafsir: 88, general_article: 45 },
    note: 'مركز بحوث قرآنية؛ لا فتوى ولا تخريج حديث.',
  }),
  R({
    // TEXT PAGES ONLY. The video post-type and the PDF-embed pages are refused: a page whose
    // visible body is a download button is not evidence however much chrome it yields.
    domain: 'dr-mutlaq.com', ownerId: 'mutlaq-aljasir', adapterId: 'mutlaq-entry-content', adapterVersion: 'm1',
    health: 'enabled', requiresTranscript: true, minAnswerChars: 400,
    confirmedIndexPatterns: ['/aiovg_videos', '/player-embed', '/user-videos'],
    caps: { fatwa: 40, tafsir: 40, hadith_text: 20, hadith_explanation: 20, general_article: 50 },
  }),
  R({
    domain: 'alukah.net', ownerId: null, adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled',
    caps: { general_article: 55, fatwa: 35, tafsir: 35, hadith_text: 30, hadith_explanation: 30 },
  }),
  R({
    domain: 'islamstory.com', ownerId: null, adapterId: 'readability', adapterVersion: 'r1',
    health: 'deferred', searchable: false, caps: {},
    note: 'مؤجَّل 2026-08-14: HTTP 521؛ تاريخ وسِيَر وليس مصدر حكم.',
  }),
  R({
    domain: 'khutabaa.com', ownerId: null, adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', confirmedIndexPatterns: ['/forums'],
    caps: { general_article: 30 },
    note: 'خطب ومواعظ فقط؛ لا فتوى ولا اختيار فقهي حاسم.',
  }),
  R({
    domain: 'salafcenter.org', ownerId: null, adapterId: 'page-gated', adapterVersion: 'g1',
    health: 'enabled', caps: { general_article: 40 },
    note: 'بحوث عقدية وفكرية؛ لا فتوى شخصية، ويُستبعد قسم مشاركات القرّاء.',
  }),

  // ── FETCHABLE, AND ELIGIBLE FOR NOTHING (قرار ٤) ───────────────────────────
  //
  // WHY IT IS HERE AT ALL. The identity line has to answer one worldly question — «is the person
  // named in this question a scholar, or somebody else entirely?» — before the reply calls anybody
  // «الشيخ». MEASURED 2026-08-08: safeFetch refuses ar.wikipedia.org with
  // `preflight:not-an-admissible-url`, because admissible() requires a row here and there was
  // none. So the app cited pages its own fetcher would not open.
  //
  // WHAT THIS ROW GRANTS, EXHAUSTIVELY: permission to be FETCHED through the existing safe path.
  // The SSRF defence is untouched — same preflight, same https-only rule, same redirect
  // re-admission check on every hop, same host allow-list afterwards.
  //
  // WHAT IT DOES NOT GRANT, and this is the point of the empty `caps`: Wikipedia may not back a
  // fatwa, a tafsir, a hadith text, a grading, an explanation, a scholar's primary opinion, or a
  // general article. `policy({})` marks every capability ineligible, so capabilityEligible()
  // returns false for all seven and no ruling can ever rest on it. `searchable: false` keeps it
  // out of domainsForCapability() as well, so it is never even offered as a place to look.
  //
  // It is a source for WHO SOMEBODY IS, and for nothing that has a ruling in it.
  R({
    domain: 'ar.wikipedia.org', ownerId: null, adapterId: 'readability', adapterVersion: 'r1',
    health: 'enabled', searchable: false, caps: {},
    note: 'للتعريف بالأشخاص فقط (قرار ٤). لا تصلح لفتوى ولا تفسير ولا حديث ولا قول عالِم — والقدرات فارغة عمدًا.',
  }),

  // ── declared and NOT usable ────────────────────────────────────────────────
  R({
    // Parked domain (GoDaddy lander) measured 2026-08-03. Kept so the decision is visible and
    // so the guard can prove it reaches nothing.
    domain: 'shkhudheir.com', ownerId: 'al-khudayr', adapterId: 'none', adapterVersion: 'none',
    health: 'disabled', searchable: false,
    note: 'نطاق مركون؛ لا يُفعّل حتى يعود الموقع بنص حقيقي.',
  }),
];

for (const r of ROWS) {
  if (!isHealth(r.health)) throw new Error('bad health on ' + r.domain);
}

export const POLICY_ROWS = Object.freeze(ROWS);

const BY_DOMAIN = new Map(ROWS.map((r) => [r.domain, r]));

/** The policy row for a host, URL or domain — following the sub-domain rule. */
export function policyFor(hostOrUrl) {
  const d = normalizeDomain(hostOrUrl);
  if (!d) return null;
  const exact = BY_DOMAIN.get(d);
  if (exact) return exact;
  for (const r of ROWS) if (d === r.domain || d.endsWith('.' + r.domain)) return r;
  return null;
}

/**
 * THE HARD GATE. May this domain supply evidence for this capability?
 *
 * An UNKNOWN domain returns false — the opposite of lib/source-registry.js's
 * sourceAllowsPurpose(), and deliberately so. There, an unknown domain has no restriction to
 * enforce and the host allow-list is the gate. Here the question is "may this page become a
 * cited claim", and the only safe answer for a domain nobody wrote a policy for is no.
 */
export function capabilityEligible(hostOrUrl, capability) {
  const r = policyFor(hostOrUrl);
  if (!r) return false;
  if (r.health !== 'enabled') return false;
  const p = r.capabilityPolicy[capability];
  return !!(p && p.eligible);
}

export function capabilityPriority(hostOrUrl, capability) {
  const r = policyFor(hostOrUrl);
  if (!r || r.health !== 'enabled') return 0;
  const p = r.capabilityPolicy[capability];
  return p && p.eligible ? p.priority : 0;
}

/** Every enabled, searchable domain eligible for `capability`, best priority first. */
export function domainsForCapability(capability) {
  return ROWS
    .filter((r) => r.health === 'enabled' && r.searchable && r.capabilityPolicy[capability]?.eligible)
    .sort((a, b) => b.capabilityPolicy[capability].priority - a.capabilityPolicy[capability].priority
      || a.domain.localeCompare(b.domain))
    .map((r) => r.domain);
}

/**
 * Narrow a caller's site list to those eligible for `capability`, ordered by priority.
 *
 * NOTE THE DIFFERENCE FROM lib/source-registry.js's filterSitesForPurpose(): that function
 * falls back to the unfiltered list when the filter would empty it, because an empty scope
 * filter there would turn a preference into an outage. Here an empty list is the CORRECT
 * answer — it means no vetted source may back this kind of claim, and the engine must refuse
 * rather than search something ineligible.
 */
export function eligibleSites(sites, capability) {
  const list = (Array.isArray(sites) ? sites : []).filter(Boolean);
  return list
    .filter((d) => {
      const r = policyFor(d);
      return !!(r && r.searchable && capabilityEligible(d, capability));
    })
    .sort((a, b) => capabilityPriority(b, capability) - capabilityPriority(a, capability)
      || a.localeCompare(b));
}

/** Is this scholar's primary opinion readable from a registered adapter? */
export function primaryOpinionAdapter(ownerId) {
  if (!ownerId) return null;
  const r = ROWS.find((x) => x.ownerId === ownerId
    && x.health === 'enabled'
    && x.capabilityPolicy.scholar_opinion_primary.eligible);
  return r ? { domain: r.domain, adapterId: r.adapterId, adapterVersion: r.adapterVersion, ownerId } : null;
}

/**
 * A reader's spelling of a scholar's name -> the owner id, via the shipped resolver.
 *
 * It goes through lib/source-registry.js's resolveScholar() rather than matching names here,
 * so the whole-word rule and the ambiguity refusal apply unchanged: «عبدالله» resolves nobody,
 * two matches resolve nobody, and only an unambiguous identification produces an id. A name
 * that resolves to a scholar with no primary-opinion adapter still produces an id — that is
 * the point, because "we know who he is and we cannot read him" is a different refusal from
 * "we do not know who he is".
 */
export function authorityIdForScholarName(name) {
  const r = resolveScholar(name);
  if (r.status !== 'resolved') return null;
  return ownerOf(r.domain);
}

/**
 * THE ADAPTER VERSION A URL WOULD BE EXTRACTED UNDER, decided BEFORE anything is read.
 *
 * This exists so the extraction cache can be addressed by the version that produced an entry.
 * The caller used to pass `adapterVersion: undefined`, which made the lookup a permanent miss
 * and — worse — made the specified invalidation rule untestable: a rule nothing can exercise is
 * a rule nobody knows is broken.
 *
 * Returns '' for a URL with no enabled policy row, and the caller must treat '' as a hard cache
 * MISS rather than as a wildcard. An unknown version is exactly the case where a stale
 * extraction is most dangerous: its span byte-offsets were computed by an adapter we cannot
 * name, and Gate 1 would reject them after the request had already paid for them.
 */
export function expectedAdapterVersion(hostOrUrl) {
  const r = policyFor(hostOrUrl);
  if (!r || r.health !== 'enabled') return '';
  return r.adapterId + '@' + r.adapterVersion;
}

/** Owner id for a domain, or null. Used to check "is this page by the man who was asked about". */
export function ownerOf(hostOrUrl) {
  const r = policyFor(hostOrUrl);
  return r ? r.ownerId : null;
}

/** Which tracking params may be stripped from this URL: the global set plus the row's own. */
export function removableParamsFor(hostOrUrl) {
  const r = policyFor(hostOrUrl);
  return GLOBAL_TRACKING_PARAMS.concat(r ? r.removableTrackingParams : []);
}

// ── conformance helpers (used by the guard, and cheap enough to call anywhere) ──

/** Domains this module would ever put in a search filter. */
export function searchableDomains() {
  return ROWS.filter((r) => r.health === 'enabled' && r.searchable).map((r) => r.domain);
}

/**
 * Problems that mean this table has drifted from the shipped registry. Returns strings so a
 * gate can print them. Empty array = conformant.
 */
export function conformanceProblems() {
  const problems = [];
  const registryActive = new Set(activeSources().map((s) => s.domain));
  const registryBlocked = new Set(blockedSources().map((s) => s.domain));
  const searchable = new Set(searchableDomains());

  for (const d of searchable) {
    if (!registryActive.has(d)) problems.push('searchable domain not active in source-registry: ' + d);
  }
  for (const d of registryActive) {
    if (!searchable.has(d)) problems.push('active registry domain missing from ledger policy: ' + d);
  }
  for (const d of registryBlocked) {
    const r = policyFor(d);
    if (r && r.health === 'enabled') problems.push('registry-blocked domain is enabled here: ' + d);
    if (r && r.searchable) problems.push('registry-blocked domain is searchable here: ' + d);
  }
  for (const r of ROWS) {
    if (r.health !== 'enabled') {
      for (const c of CAPABILITIES) {
        if (r.capabilityPolicy[c].eligible) problems.push('non-enabled row grants ' + c + ': ' + r.domain);
      }
    }
    // A restriction the shipped registry states must not be widened here.
    const reg = findSource(r.domain);
    if (reg && reg.status === 'active' && r.searchable) {
      const scopes = new Set(reg.scopes);
      if (!scopes.has('fatwa') && r.capabilityPolicy.fatwa.eligible) {
        problems.push('ledger grants fatwa where the registry withholds it: ' + r.domain);
      }
      if (!scopes.has('tafsir') && r.capabilityPolicy.tafsir.eligible) {
        problems.push('ledger grants tafsir where the registry withholds it: ' + r.domain);
      }
      const hadithHere = r.capabilityPolicy.hadith_text.eligible
        || r.capabilityPolicy.hadith_grading.eligible
        || r.capabilityPolicy.hadith_explanation.eligible;
      if (!scopes.has('hadith') && hadithHere) {
        problems.push('ledger grants a hadith capability where the registry withholds it: ' + r.domain);
      }
    }
  }
  return problems;
}
