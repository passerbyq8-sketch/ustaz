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

// ── 2b · TERM FAMILIES: ONE SUBJECT, SEVERAL NAMES IN THE CORPUS ────────────
//
// WHY THIS EXISTS, MEASURED. The reader — or the model composing a tool query — asks about
// «النقاب». The corpus answers that question under titles that never use the word:
// «حكم تغطية المرأة وجهها»، «حكم ستر المرأة وجهها عن الأجانب»، «كشف المرأة وجهها وهي محرمة»،
// «لبس غطاء الوجه للمحرمة». lib/fatwa-service.js's relevance filter matches WHOLE CANONICAL
// TOKENS — deliberately, so «الجمعة» can never stand in for «الجمع» — so a query of «نقاب»
// shares no token with any of those titles, and every one of them was refused before ranking.
//
// Two separate gaps produced that, and both are measured:
//   * the SYNONYM gap: نقاب / برقع / لثام against تغطية / ستر / كشف / غطاء;
//   * the PREFIX gap: canonicalToken('وجهها') is «جهها», because stripPrefixes() removes a
//     leading و from a five-letter token. So even «تغطية الوجه» and «تغطية المرأة وجهها» fail to
//     meet on the face word itself.
//
// WHERE EVERY SURFACE BELOW CAME FROM. 126 real titles harvested from the live fatwa corpus
// (`/api/v1/fatwas/search`, nine probes, 2026-08-16), tokenised through normalizeArabic and
// counted. Nothing here comes from prose, from a fatwa BODY, or from anybody's idea of Arabic
// morphology: a surface is listed if and only if it was counted in a TITLE. The counts stay in
// the comments so the next reader re-measures instead of trusting this paragraph.
//
// AND THE FALSE FRIENDS ARE WHY THE MATCH IS WHOLE-TOKEN, NEVER SUBSTRING. The same harvest
// produced «زوجها» (5), «متزوجه» (1) and «ووجهت» (1) — her husband, married, she directed —
// each of which CONTAINS «وجه» and none of which is a face. They are absent below, and a
// substring test would have swept in all three.
//
// THIS TABLE ADMITS NOTHING BY ITSELF. It carries no ruling, no attribution and no topic
// admission; it only lets two names for one subject meet. The consumer decides what to do with
// that, and lib/fatwa-service.js uses it strictly ADDITIVELY — the precedent is 882eb29, where
// lowering a threshold was measured to BREAK existing matches, so the shorter reading was offered
// as an extra form rather than as a replacement.
//
// THE RULE THE CONSUMER APPLIES (stated here, executed there, because this module is data only):
// the family is present in a text when a `garment` surface appears, OR when an `act` surface and
// an `object` surface both appear. «حكم ستر المرأة يديها في الصلاة» carries the act and no face
// object, so it is correctly NOT a member.
export const TERM_FAMILIES = Object.freeze([
  Object.freeze({
    key: 'face-covering',
    // The garment names the subject on its own — a title carrying one of these is about it.
    // النقاب(21) البرقع(11) للنقاب(4) نقاب(3) للبرقع(2) برقعها(1) اللثام(1) تتلثم(1)
    garment: Object.freeze([
      'النقاب', 'نقاب', 'للنقاب', 'البرقع', 'برقع', 'للبرقع', 'برقعها', 'اللثام', 'لثام', 'تتلثم',
    ]),
    // Covering or uncovering. Alone it means nothing — «ستر العورة» and «كشف الحساب» are not this.
    // تغطيه(28) كشف(17) غطاء(8) ستر(7) كشفه(2) بتغطيه(2) وتغطيه(1) تغطيته(1) وتغطيته(1)
    // ستره(1) بكشف(1) فكشفته(1) تكشفه(1) فكشفت(1) بغطاء(1) الغطاء(1)
    act: Object.freeze([
      'تغطيه', 'بتغطيه', 'وتغطيه', 'تغطيته', 'وتغطيته',
      'ستر', 'ستره', 'كشف', 'كشفه', 'بكشف', 'فكشفت', 'فكشفته', 'تكشفه',
      'غطاء', 'بغطاء', 'الغطاء',
    ]),
    // ...of the face, and ONLY these measured surfaces of it.
    // وجهها(27) الوجه(25) لوجهها(8) للوجه(1) وجهه(1) ووجهه(1) — plus the bare «وجه», which is the
    // form a QUERY arrives in («تغطية الوجه» folds to it) even though titles prefer the possessive.
    object: Object.freeze([
      'وجهها', 'لوجهها', 'الوجه', 'للوجه', 'وجهه', 'ووجهه', 'وجه',
    ]),
  }),
  // ── THE SECOND FAMILY: EXCHANGING A RIBAWI METAL FOR ITS LIKE ──────────────
  //
  // MEASURED, and it is the §٥ item branch أ parked. The query «بيع الذهب بالذهب متفاضلا حكم»
  // returns TWO records from the real service and the acceptance test refuses BOTH — including
  // «شروط بيع الربوي بمثله», a fatwa on precisely that question, which matched all three topic
  // terms ["بيع","ذهب","متفاضلا"] and scored 32. It was refused by `directlyFramed`, not by
  // failing to match: بيع is in its title, متفاضل in its published question and ذهب in its
  // answer, so no two of the three sit inside ONE field and every proximity window is Infinity.
  //
  // WHY A FAMILY AND NOT A WIDER WINDOW. Widening `directlyFramed` lowers the acceptance
  // threshold for every record in the corpus — the move lib/fatwa-service.js declined at the head
  // of its own bridge, and 882eb29 declined before it. A family is additive by construction: it
  // is consulted ONLY when the ordinary test already refused, it pays no score, and it can admit
  // nothing the reader's own query did not also name.
  //
  // HARVESTED FROM 115 DISTINCT CORPUS TITLES pulled by thirteen probes against the real service
  // (بيع الذهب بالذهب · ربا الفضل · الصرف · مبادلة الذهب · استبدال الذهب · الربوي · بيع الربوي
  // بمثله · …). The counts below are occurrences among those titles.
  Object.freeze({
    key: 'ribawi-metal-exchange',
    // NOTHING NAMES THIS SUBJECT ON ITS OWN, and that is a measurement rather than an omission.
    // Every tempting single token failed: «الصرف»(11) also titles «حكم الصرف على المساجد من
    // الزكاة» and «حكم استخدام سحر الصرف لتغيير المنكر»; «الربوي»(12) also titles «حكم الاستقراض
    // من البنك الربوي» and «حكم القرض البنكي الربوي لبناء بيت». Either alone would let a ruling
    // about bank borrowing answer a question about swapping a gold set — the CX-03 shape
    // lib/fatwa-service.js spent a round learning to keep out. So this family fires only on the
    // conjunction: an exchange AND a ribawi metal.
    garment: Object.freeze([]),
    // The exchange itself.
    // بيع(23) الصرف(11) استبدال(7) شراء(6) صرف(5) مبادله(3) وشراء(2) بيعه(1) يبيع(1) لشراء(1)
    // ...plus «استبدل»/«استبدلت», the perfect forms the corpus uses when a title tells a story
    // («استبدل خاتم ذهب قديم بخاتم جديد مع دفع الفارق»), and «تبديل»/«بادل», the surfaces a
    // READER's query arrives in.
    act: Object.freeze([
      'بيع', 'يبيع', 'بيعه', 'باع', 'باعت', 'استبدال', 'استبدل', 'استبدلت', 'تبديل', 'بادل',
      'مبادله', 'شراء', 'وشراء', 'لشراء', 'صرف', 'الصرف',
    ]),
    // ...of a ribawi METAL, and only the measured surfaces of it.
    // الذهب(33) بالذهب(15) ذهب(13) الربوي(12) والفضه(7) حلي(7) الحلي(4) بالفضه(2) بذهب(1)
    // والذهب(1) الربويه(1) ربويه(1)
    //
    // CURRENCY IS DELIBERATELY ABSENT. «بعمله»(4) «العمله»(3) «عمله»(2) «نقدا»(2) «بالنقد»(1)
    // were all harvested and all left out: a family key is shared in BOTH directions, so adding
    // them would let «حكم استبدال العملة الورقية بعملة نقدية مع التفاضل» answer a question about
    // gold. Nothing in this round measured currency exchange, and an unmeasured widening is the
    // thing the family form exists to avoid. Food ribawi (قمح · شعير · تمر) is absent for the
    // same reason — and it is what keeps «حكم بيع القمح مؤجلاً بضعف قيمته», the OTHER record that
    // query returns and the higher-scoring one at 37, correctly refused.
    object: Object.freeze([
      'ذهب', 'الذهب', 'بالذهب', 'بذهب', 'والذهب', 'للذهب', 'ذهبا',
      'فضه', 'الفضه', 'بالفضه', 'والفضه',
      'حلي', 'الحلي', 'بحلي', 'مصوغات', 'المصوغات',
      'ربوي', 'الربوي', 'ربويه', 'الربويه', 'الربويين', 'الربويات',
    ]),
  }),
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
