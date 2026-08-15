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

// (The homograph tier that used to live here now sits in lib/route-classify.js, beside the
// DEEN vocabulary it qualifies. That module must stay import-free: guards/stored-deen-sub-suite.cjs
// mutates it by copying the single file into a temp directory, and a relative import there makes
// the mutant unloadable — a check disarmed by accident.)

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
// NOTE ON FORM. Both halves of every pair are written in `normalizeArabic` output form — no
// hamza, ta-marbuta folded to ha, alef-maqsura folded to ya — because that is the only form the
// matcher ever sees. Writing «صائغ» on the right would be a no-op that merely looks like a
// mapping. And the lookup is tried on the folded word AND on its canonical (prefix/suffix
// stripped) form, so «طقمك» finds the «طقم» pair without the table having to carry every
// possessive.
export const DIALECT_TO_MSA = Object.freeze([
  // trade and craft
  ['صايغ', 'صياغه'],
  ['طقم', 'حلي'],
  ['مصنعيه', 'اجره صياغه'],
  ['بيعه', 'بيع'],
  // travel and place
  ['دريشه', 'نافذه'],
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

// ── 3 · NARRATIVE FRAME: THE STORY AROUND THE QUESTION ──────────────────────
//
// Readers of this product ask by telling a story: «رحت محل ذهب، وعطيت الصايغ طقمي، ودفعت ٥٠
// دينار… هل هالبيعة حلال؟». The subject of the fatwa is the last clause; everything before it is
// setting. But topic terms are taken IN ORDER, and the admission contract requires the first
// three of them, so the head terms became «ذهبت», «محل», «عطيت» — the narration — and an article
// the corpus really holds («صِيَاغَة», «صَرْف») could not be admitted for a question that was
// literally about goldsmithing.
//
// The general property, and the only one: these are first- and second-person NARRATIVE verbs and
// the deictics, connectives and units that frame a told event. None of them can ever be the
// subject of a ruling — no fatwa is about «رحت» or «جيبك» — so removing them from the topic head
// can never remove a topic. They are dropped from SCORING only; the reader's sentence and the
// text shown are untouched, and the ruling vocabulary («حلال», «يجوز», «حكم») is deliberately NOT
// here, because the existing STOP set already governs that and for different reasons.
export const NARRATIVE_FRAME_TOKENS = Object.freeze([
  // first/second-person narrative verbs (already folded)
  'رحت', 'ذهبت', 'عطيت', 'اعطيت', 'اخذت', 'خذيت', 'دفعت', 'شفت', 'رايت', 'دخلت', 'لقيت',
  'كبرت', 'سمعت', 'اعلم', 'كنت', 'صرت', 'قلت', 'سالت', 'جيت', 'وقفت', 'قمت', 'نزلت',
  'تشوف', 'تري', 'تلحق', 'تنزل', 'تكمل', 'تحتك', 'انت', 'انا', 'احنا', 'وانت', 'وانا',
  // deictics and connectives that carry no subject
  'اللي', 'الذي', 'التي', 'هالشي', 'هذي', 'هاي', 'ذاك', 'ضبط', 'بالضبط', 'زلت', 'لازال',
  'وحان', 'حان', 'بسرعه', 'سرعه', 'فورا', 'بعدين', 'ثم', 'ولا', 'اما', 'لكن', 'لكي', 'بسبب',
  // the containers and units a told event is measured in
  'محل', 'مكان', 'جيبك', 'جيبي', 'وزنه', 'وزن', 'جرام', 'كيلو', 'دينار', 'ريال', 'درهم',
  'قديم', 'جديد', 'موعد', 'وقت', 'ارتفاع', 'اضحه', 'واضحه', 'مدينه',
]);
