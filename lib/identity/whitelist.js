// lib/identity/whitelist.js — WHO IS THIS, AT ZERO COST AND WITH NO NETWORK.
//
// ── WHY A WHITELIST IS THE FIRST STAGE (قرار ٣) ──────────────────────────────
// The identity cascade exists to stop the app calling a singer «الشيخ». But the overwhelming
// majority of names a reader types ARE the scholars the app already searches, and paying a fetch
// — let alone a live search — to rediscover that ابن باز is a scholar would make the common case
// the expensive one. This stage answers those for free and never touches the network.
//
// ── BUILT FROM THE REGISTRY, NOT RETYPED ─────────────────────────────────────
// The scholar half is DERIVED from lib/source-registry.js's SCHOLAR_SITES at import time. That
// table already carries every spelling a reader actually types, and it is maintained because the
// search path depends on it. A second hand-typed list here would drift from it silently, and the
// drift would show up as the app failing to recognise a shaykh whose fatwas it can search — which
// is exactly the defect that went unnoticed for ابن عثيمين and مطلق الجاسر (see that file).
//
// ── AND A SECOND GROUP THAT OWNS NO DOMAIN ───────────────────────────────────
// The classical authorities recur throughout the retrieved pages and have no site to register:
// ابن حجر, ابن قدامة, النووي. They are listed explicitly because there is nowhere to derive them
// from. Each carries the same shape as a derived row, so nothing downstream can tell them apart.
//
// ── AMBIGUITY IS DATA, NOT AN ERROR ──────────────────────────────────────────
// «ابن حجر» is two men — العسقلاني the hadith master and الهيتمي the Shafi'i jurist — and a
// whitelist that silently picked one would attribute one man's words to the other. A key held by
// more than one person resolves to AMBIGUOUS, and the caller is told who the candidates are.

import { SCHOLAR_SITES } from '../source-registry.js';
import { normalizeArabic } from '../route-classify.js';

export const IDENTITY_KINDS = Object.freeze(['scholar', 'public_figure', 'ambiguous']);

/**
 * The key two spellings of one name must share. Never displayed, never reversed.
 *
 * normalizeArabic folds the diacritics, the tatweel and the hamza forms. It does NOT fold the
 * one variation that matters most for names: «عبد الله» and «عبدالله» are the same man written
 * two ways, and SCHOLAR_SITES carries both spellings for ابن باز and ابن جبرين precisely because
 * readers type both. MEASURED while building this: the two spellings produced two cache keys, so
 * one reader's look-up never served the other's — the cache worked and bought nothing.
 */
export function identityKey(name) {
  return normalizeArabic(String(name == null ? '' : name))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/عبد\s+(?=ال)/g, 'عبد');
}

// ── the classical authorities ────────────────────────────────────────────────
// `descriptor` is what the fact block will print. It states a role and a period, and it grants
// no ruling authority by itself — the source rules still decide what may be cited.
const CLASSICAL = Object.freeze([
  { display: 'ابن حجر العسقلاني', descriptor: 'حافظٌ ومحدِّثٌ شافعيّ (ت ٨٥٢هـ)، صاحب «فتح الباري»', aliases: ['ابن حجر العسقلاني', 'الحافظ ابن حجر', 'العسقلاني'] },
  { display: 'ابن حجر الهيتمي', descriptor: 'فقيهٌ شافعيّ (ت ٩٧٤هـ)، صاحب «تحفة المحتاج»', aliases: ['ابن حجر الهيتمي', 'الهيتمي'] },
  { display: 'ابن قدامة المقدسي', descriptor: 'فقيهٌ حنبليّ (ت ٦٢٠هـ)، صاحب «المغني»', aliases: ['ابن قدامة', 'ابن قدامه', 'الموفق ابن قدامة'] },
  { display: 'النووي', descriptor: 'فقيهٌ ومحدِّثٌ شافعيّ (ت ٦٧٦هـ)، صاحب «المجموع» و«رياض الصالحين»', aliases: ['النووي', 'يحيى النووي', 'الامام النووي'] },
  { display: 'ابن تيمية', descriptor: 'فقيهٌ حنبليّ (ت ٧٢٨هـ)، صاحب «مجموع الفتاوى»', aliases: ['ابن تيمية', 'ابن تيميه', 'شيخ الاسلام ابن تيمية'] },
  { display: 'ابن القيم', descriptor: 'فقيهٌ حنبليّ (ت ٧٥١هـ)، صاحب «زاد المعاد»', aliases: ['ابن القيم', 'ابن قيم الجوزية'] },
  { display: 'ابن كثير', descriptor: 'مفسِّرٌ ومؤرِّخٌ شافعيّ (ت ٧٧٤هـ)، صاحب «تفسير القرآن العظيم»', aliases: ['ابن كثير', 'اسماعيل بن كثير'] },
  { display: 'الألباني', descriptor: 'محدِّثٌ معاصر (ت ١٤٢٠هـ)', aliases: ['الالباني', 'ناصر الدين الالباني', 'محمد ناصر الدين الالباني'] },
  // «ابن حجر» BARE resolves to neither of the two above — it is the collision itself, and it is
  // registered as one so the caller is never handed a guess.
]);

// A key -> [entry, …]. More than one entry is a collision, and it is kept as one.
function build() {
  const byKey = new Map();
  const add = (aliasRaw, entry) => {
    const k = identityKey(aliasRaw);
    if (!k) return;
    const list = byKey.get(k) || [];
    // The same person reached through two aliases is still one person.
    if (!list.some((e) => e.display === entry.display)) list.push(entry);
    byKey.set(k, list);
  };

  // ── derived: the registry's own scholars ──────────────────────────────────
  for (const row of SCHOLAR_SITES) {
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    if (!aliases.length) continue;
    // The FIRST alias is the display form: the table lists the common name first.
    const entry = Object.freeze({
      kind: 'scholar',
      display: aliases[0],
      descriptor: 'عالِمٌ من أهل العلم، له موقعٌ في مصادر التطبيق',
      domain: row.domain,
      basis: 'registry',
    });
    for (const a of aliases) add(a, entry);
  }

  // ── declared: the classical authorities ───────────────────────────────────
  for (const c of CLASSICAL) {
    const entry = Object.freeze({
      kind: 'scholar', display: c.display, descriptor: c.descriptor, domain: '', basis: 'classical',
    });
    for (const a of c.aliases) add(a, entry);
  }

  // «ابن حجر» unqualified: BOTH men, deliberately.
  const bare = identityKey('ابن حجر');
  if (!byKey.has(bare)) {
    byKey.set(bare, CLASSICAL.filter((c) => c.display.startsWith('ابن حجر')).map((c) => Object.freeze({
      kind: 'scholar', display: c.display, descriptor: c.descriptor, domain: '', basis: 'classical',
    })));
  }
  return byKey;
}

let _index = null;
function index() {
  if (!_index) _index = build();
  return _index;
}

/** Test seam — lets a gate rebuild after mutating nothing, and keeps the lazy build honest. */
export function __resetWhitelist() { _index = null; }

/**
 * Look a name up at zero cost.
 *
 * @returns {null
 *   | {kind:'scholar', display:string, descriptor:string, domain:string, basis:string, source:'whitelist'}
 *   | {kind:'ambiguous', candidates:Array, source:'whitelist'}}
 */
export function whitelistLookup(nameRaw) {
  const k = identityKey(nameRaw);
  if (!k) return null;
  const hits = index().get(k);
  if (!hits || !hits.length) return null;
  if (hits.length === 1) return { ...hits[0], source: 'whitelist' };
  return { kind: 'ambiguous', candidates: hits.map((h) => ({ ...h })), source: 'whitelist' };
}

/** Every key the whitelist knows. For the gate, and for nothing at runtime. */
export function whitelistKeys() { return Array.from(index().keys()).sort(); }
