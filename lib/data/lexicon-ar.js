// lib/data/lexicon-ar.js — DATA ONLY. No logic, no branching, no question named anywhere.
//
// WHY A DATA MODULE AND NOT A .json. Vercel bundles this function from `vercel.json`'s
// `includeFiles`, which names exactly one artefact (the fiqh corpus). A raw `readFileSync` of a
// new .json would resolve locally and be ABSENT in production, which is the worst possible
// failure shape for a table the router consults on every turn. A statically imported module is
// followed by the bundler's tracer, so it ships wherever its importer ships.
//
// Everything below is a general linguistic statement about Arabic as this product's readers write
// it. Nothing here is keyed to a question, and nothing here carries a ruling.

// ── 1 · HOMOGRAPHS WHOSE SECULAR READING IS THE ORDINARY ONE ────────────────
//
// normalizeArabic() folds the short vowels, so a religious word and an unrelated everyday word
// can arrive at the router as the SAME string. Three such collisions were measured on the
// seventeen-question matrix, each of them routing a non-religious question into the fatwa path:
//
//   كفر   →  «كَفَر» the car tyre          vs  «كُفْر» disbelief
//   سنه   →  «السَّنَة» the calendar year   vs  «السُّنَّة» the Sunnah
//   عمره  →  «عُمْرُه» his age             vs  «عُمْرَة» the ʿumrah
//
// Membership is that general property and only it: after folding, the form is shared with a
// common secular word, and the secular reading is the one a reader of this product most often
// intends. No amount of tightening the MATCH can separate them — the strings are identical — so
// what separates them is COMPANY, in `isReligiousText`: these tokens establish the religious
// domain only when some other religious term stands beside them in the same turn. That keeps
// «ما حكم الكفر بالله؟» and «كم ركعة في سنة الفجر؟» exactly as religious as they were.
export const AMBIGUOUS_RELIGIOUS_TOKENS = Object.freeze([
  'كفر',
  'سنه',
  'عمره',
]);

// ── 2 · GULF SURFACE → MSA RETRIEVAL VOCABULARY ─────────────────────────────
//
// The stored corpus and the fatwa corpus are written in MSA. Readers write Gulf. Neither corpus
// is going to be rewritten, so the QUERY is normalised towards them instead. This is a retrieval
// vocabulary only: it is applied when topic terms and search keys are built, never to the text a
// reader is shown, and it carries no ruling, no attribution and no topic admission by itself.
//
// A pair earns its place by being a plain lexical equivalence — the same referent under two
// registers — not by being useful to one question. Each entry is written as
// [dialect surface, MSA equivalent], both already in `normalizeArabic` form (no hamza, ta-marbuta
// folded to ha, alef maqsura folded to ya), because that is the form the matcher sees.
export const DIALECT_TO_MSA = Object.freeze([
  // trade and craft
  ['صايغ', 'صائغ'],
  ['الصايغ', 'صائغ'],
  ['طقم', 'حلي'],
  ['المصنعيه', 'اجره الصياغه'],
  ['مصنعيه', 'اجره الصياغه'],
  ['بيعه', 'بيع'],
  ['هالبيعه', 'بيع'],
  // travel and place
  ['دريشه', 'نافذه'],
  ['طياره', 'طائره'],
  ['بالطياره', 'طائره'],
  // interrogatives and particles that carry no topic but block exact-token matching
  ['شنو', 'ما'],
  ['وش', 'ما'],
  ['ايش', 'ما'],
  ['شلون', 'كيف'],
  ['وين', 'اين'],
  ['ليش', 'لماذا'],
  ['حق', 'ل'],
  ['مال', 'ل'],
  ['هالشي', 'هذا'],
  ['زين', 'حسن'],
  ['يبي', 'يريد'],
  ['ابي', 'اريد'],
  ['عشان', 'لكي'],
  ['بس', 'لكن'],
  ['لازم', 'يجب'],
  ['رحت', 'ذهبت'],
  ['عطيت', 'اعطيت'],
  ['خذيت', 'اخذت'],
  ['اخذت', 'اخذت'],
  ['شفت', 'رايت'],
  ['تشوف', 'تري'],
  ['قاعد', ''],
  ['حيلك', ''],
]);
