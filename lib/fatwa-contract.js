// The public fatwa service is a read-only corpus behind one fixed server-side origin.
// This file contains only its measured v1 contract: ids, counts and name aliases.  It
// performs no network I/O, so routing can recognise a named scholar before any request.

import { normalizeArabic } from './route-classify.js';

export const FATWA_BASE = 'https://ezik-fatwas-4k.vercel.app';
export const FATWA_SCHEMA = 'fatwa.api.v1';
export const FATWA_EXPECTED_SCHOLARS = 30;
export const FATWA_EXPECTED_TOTAL = 126269;
export const FATWA_EXPECTED_IBN_BAZ_TOTAL = 28504;

// `extra` carries the per-scholar STRINGS that used to be pinned inside adapter code — the
// formal name a source publishes under, and the name of that source. §9: data, not code, so one
// rule governs every scholar. lib/binothaimeen.js held «محمد بن صالح العثيمين» and «الموقع
// الرسمي للشيخ محمد بن صالح العثيمين» as module constants, which meant the ONE scholar with a
// bespoke adapter had a bespoke identity that no other scholar could acquire without a second
// adapter being written. Both are rows here now, and the adapter reads them.
//
// Absent for most scholars, and absence is meaningful: `formalName` falls back to `name`, and
// `officialPublisher` is empty when the scholar has no official site we publish under.
const row = (id, canonicalId, name, count, sourceDomain, aliases, extra = {}) => Object.freeze({
  id, canonicalId, name, count, sourceDomain,
  aliases: Object.freeze(aliases.map((value) => normalizeArabic(value))),
  formalName: extra.formalName || name,
  officialPublisher: extra.officialPublisher || '',
});

// TWO ROWS CARRY A CORRECTED DISPLAY NAME, AND BOTH KEEP THE OLD ONE AS AN ALIAS.
//
// `alathary` published as «النجدي الأثري» here with nothing in the corpus supporting it and six
// rows naming محمد الحمود النجدي; `salmajed` published as «سعد الماجد» with nothing supporting it
// and 398 rows addressing سليمان, across a shelf of 17,875 fatwas.
//
// THE OLD NAMES ARE NOT REMOVED, and that is the whole shape of this change. A name here is a
// KEY, not a label: resolveFatwaScholar() matches on `aliases` alone, so renaming a row would
// have silently stopped resolving every question that already asks by the old name. The aliases
// are therefore the UNION of both names, and the change to `name` is a display change only.
//
// `id` and `canonicalId` are deliberately untouched. They are served inside record uids
// (`salmajed:fatwa:salmajed:6184`) and prefix the `ids` of the reviewer registry; the
// aljasser ⟶ drmutlaq precedent is that moving one returns an empty dropdown with no error.
//
// WHAT THIS DOES NOT CHANGE: the name a reader SEES on a fatwa card. That is `shortName` on the
// record the fatwa service returns, and it lives in that separate service, not in this tree.
// Until the service is updated, cards still read «سعد الماجد» and «النجدي الأثري».
// Measured from GET /api/v1/scholars on 2026-09-09. Counts are deliberately
// pinned: a partial snapshot must degrade instead of masquerading as the full shelf.
export const FATWA_SCHOLARS = Object.freeze([
  row('binbaz', 'ibn-baz', 'ابن باز', 28504, 'binbaz.org.sa', ['ابن باز', 'بن باز', 'عبدالعزيز بن باز', 'عبد العزيز بن باز']),
  row('albarrak', 'al-barrak', 'عبدالرحمن البراك', 11707, 'sh-albarrak.com', ['البراك', 'عبدالرحمن البراك', 'عبد الرحمن البراك']),
  row('meshhoor', 'meshhoor-al-salman', 'مشهور آل سلمان', 4261, 'meshhoor.com', ['مشهور آل سلمان', 'مشهور بن حسن', 'مشهور حسن']),
  row('alkhathlan', 'saad-al-khathlan', 'سعد الخثلان', 1653, 'saadalkhathlan.com', ['سعد الخثلان', 'الخثلان']),
  row('aladawy', 'mostafa-aladwy', 'مصطفى العدوي', 1492, 'mostafaaladwy.com', ['مصطفى العدوي', 'مصطفي العدوي', 'العدوي']),
  row('almosleh', 'al-mosleh', 'خالد المصلح', 953, 'almosleh.com', ['خالد المصلح', 'المصلح']),
  row('almufti', 'abdulaziz-al-sheikh', 'المفتي عبدالعزيز آل الشيخ', 458, 'af.org.sa', ['عبدالعزيز آل الشيخ', 'عبد العزيز آل الشيخ', 'المفتي آل الشيخ']),
  row('othmanalkhamees', 'othman-alkhamees', 'عثمان الخميس', 441, 'othmanalkhamees.com', ['عثمان الخميس', 'الخميس']),
  row('alathary', 'al-najdi-al-athary', 'محمد الحمود النجدي', 393, 'al-athary.net', ['محمد الحمود النجدي', 'محمد النجدي', 'الحمود النجدي', 'عبدالله النجدي الأثري', 'عبد الله النجدي الاثري', 'النجدي الأثري']),
  row('shrajhi', 'abdulaziz-al-rajhi', 'عبدالعزيز الراجحي', 559, 'shrajhi.com.sa', ['عبدالعزيز الراجحي', 'عبد العزيز الراجحي', 'الراجحي']),
  row('kuwait_eftaa', 'eftaa-committee-kw', 'الإفتاء الكويتية', 252, 'eftaa.awqaf.gov.kw', ['إدارة الإفتاء الكويتية', 'الافتاء الكويتية', 'الإفتاء الكويتية']),
  row('alkhudair', 'al-khudayr', 'عبدالكريم الخضير', 1015, 'af.org.sa', ['عبدالكريم الخضير', 'عبد الكريم الخضير', 'الخضير']),
  row('alfawzan', 'al-fawzan', 'صالح الفوزان', 1543, 'af.org.sa', ['صالح الفوزان', 'الفوزان']),
  row('ibnjebreen', 'ibn-jebreen', 'ابن جبرين', 3377, 'fatwn.ibn-jebreen.com', ['ابن جبرين', 'بن جبرين', 'عبدالله بن جبرين', 'عبد الله بن جبرين']),
  row('ferkous', 'ferkous', 'محمد علي فركوس', 1611, 'ferkous.app', ['فركوس', 'محمد علي فركوس', 'الشيخ فركوس', 'أبو عبد المعز', 'أبي عبد المعز']),
  row('salmajed', 'saad-al-majed', 'سليمان الماجد', 17875, 'salmajed.com', ['سليمان بن عبدالله الماجد', 'سليمان بن عبد الله الماجد', 'سليمان الماجد', 'سعد الماجد', 'الماجد']),
  row('binothaimeen', 'ibn-uthaymeen', 'ابن عثيمين', 16254, 'binothaimeen.net', ['ابن عثيمين', 'بن عثيمين', 'العثيمين', 'محمد بن صالح العثيمين'], {
    formalName: 'محمد بن صالح العثيمين',
    officialPublisher: 'الموقع الرسمي للشيخ محمد بن صالح العثيمين',
  }),
  row('almunajjid', 'almunajjid', 'محمد صالح المنجد', 2774, 'islamqa.info', ['محمد صالح المنجد', 'محمد المنجد', 'المنجد']),
  row('aljasser', 'mutlaq-aljasir', 'مطلق الجاسر', 2215, 'youtube.com', ['مطلق الجاسر', 'مطلق جاسر', 'الجاسر']),
  // MERGE 4K (2026-10-19). The eleven rows below, and the merged counts above, are the stage C build
  // measurements (EZIK-CX-MERGE-4K-C H5-proposed-all-pins.csv), not yet a GET /api/v1/scholars reading.
  // `sourceDomain` is '' because the staged registry declares none for them. The aliases are the
  // staged display name and spellings this tree already uses for the same man; no single family
  // name is an alias (الشنقيطي, الفوزان, الرحيلي and السبت each name someone else here too).
  row('mohammad-alalbani', 'al-albani', 'الألباني', 24100, '', ['الألباني', 'ناصر الدين الالباني', 'محمد ناصر الدين الالباني']),
  row('salih-alalsheikh', 'saleh-al-sheikh', 'صالح آل الشيخ', 1643, '', ['صالح آل الشيخ', 'صالح ال الشيخ']),
  row('walid-alsaeedan', 'walid-al-saeedan', 'وليد السعيدان', 996, '', ['وليد السعيدان', 'وليد بن راشد السعيدان']),
  row('mohammad-alshinqiti', 'mohammad-al-mukhtar-al-shinqiti', 'محمد المختار الشنقيطي', 145, '', ['محمد المختار الشنقيطي', 'محمد بن محمد المختار الشنقيطي']),
  row('abdulsalam-al-shuwayer', 'abdulsalam-al-shuwayer', 'عبدالسلام الشويعر', 143, '', ['عبدالسلام الشويعر', 'عبد السلام الشويعر', 'عبدالسلام بن محمد الشويعر']),
  row('saad-alshathri', 'saad-al-shathri', 'سعد الشثري', 106, '', ['سعد الشثري', 'سعد بن ناصر الشثري']),
  row('abdulaziz-altarifi', 'abdulaziz-al-tarifi', 'عبدالعزيز الطريفي', 85, '', ['عبدالعزيز الطريفي', 'عبد العزيز الطريفي', 'عبدالعزيز بن مرزوق الطريفي']),
  row('abdullah-alfuzan', 'abdullah-al-fawzan', 'عبدالله الفوزان', 42, '', ['عبدالله الفوزان', 'عبد الله الفوزان']),
  row('khaled-alsabt', 'khaled-alsabt', 'خالد السبت', 3, '', ['خالد السبت']),
  row('sulaiman-alruhaily', 'sulaiman-al-ruhaily', 'سليمان الرحيلي', 3, '', ['سليمان الرحيلي', 'سليمان بن سليم الله الرحيلي']),
  row('lajna', 'lajnah-daimah', 'فتاوى اللجنة الدائمة', 1666, '', ['فتاوى اللجنة الدائمة', 'اللجنة الدائمة']),
]);

function containsWhole(haystack, needle) {
  if (!needle) return false;
  return (` ${haystack} `).includes(` ${needle} `);
}

/** Resolve only an unambiguous measured fatwa scholar. */
export function resolveFatwaScholar(value, canonicalId = '') {
  const id = String(canonicalId || '').trim();
  if (id) {
    const byCanonical = FATWA_SCHOLARS.filter((entry) => entry.canonicalId === id);
    if (byCanonical.length === 1) return byCanonical[0];
  }
  const folded = normalizeArabic(value);
  if (!folded) return null;
  const hits = FATWA_SCHOLARS.filter((entry) => entry.aliases.some((alias) =>
    folded === alias || (alias.split(' ').length >= 2 && containsWhole(folded, alias))));
  return hits.length === 1 ? hits[0] : null;
}

export function fatwaContractTotals() {
  return Object.freeze({
    scholars: FATWA_SCHOLARS.length,
    total: FATWA_SCHOLARS.reduce((sum, entry) => sum + entry.count, 0),
    ibnBaz: FATWA_SCHOLARS.find((entry) => entry.id === 'binbaz')?.count || 0,
  });
}
