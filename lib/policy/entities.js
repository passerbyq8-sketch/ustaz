// lib/policy/entities.js
// WHO IS NAMED, WHAT ROLE THEY PLAY, AND WHAT IS BEING CLAIMED ABOUT THEM.
//
// ── THE DEFECT THIS FILE REPLACES ────────────────────────────────────────────
// The shipped classifier asked one question — "does a scholar's name appear?" — and answered it
// with a greedy capture: an honorific followed by up to four Arabic words. MEASURED against the
// shipped code at 2046114:
//
//   «هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟»  ->  name = «الاسلام ابن تيميه اهل»
//   «ذهب إلى المسجد فهل يصح؟»                              ->  name = «الي المسجد فهل يصح»
//   «ما حكم المسألة عند الحنابلة؟»                          ->  name = «الحنابله»
//
// None of those is a person. All three resolved to nobody, and the handler answered all three
// with «لم أتبيّنْ أيَّ شيخٍ تقصد» having searched nothing at all.
//
// ── THE RULE THAT REPLACES IT ────────────────────────────────────────────────
// AN ENTITY IS A LOOKUP, NEVER A CAPTURE. A span of Arabic becomes an entity only when it
// matches a REGISTERED alias — a historical scholar declared below, a madhhab, an institution,
// or a contemporary scholar the shipped source registry already resolves. Text that matches
// nothing is text, and a question containing no registered entity attributes nothing to anybody.
// That single change is what makes the mosque, the gold and the Hanbalis stop being scholars.
//
// ── ROLE IS NOT THE SAME AS PRESENCE ─────────────────────────────────────────
// «ما رأي ابن باز في ابن تيمية؟» names two men and asks about one position. Ibn Baz is the
// AUTHORITY (his view is requested) and Ibn Taymiyyah is the SUBJECT (the view is about him).
// Collapsing them — which the shipped classifier did by seeing only the first — is how a claim
// ABOUT a man becomes a claim BY him, which is the misattribution the whole gate exists to stop.
//
// ── WHAT THIS MODULE DOES NOT DO ─────────────────────────────────────────────
// It performs no I/O, decides no ruling, chooses no source, and never guesses. An ambiguous name
// stays ambiguous: there is no confidence score here and no "most likely" branch, because a
// probabilistic attribution is a wrong attribution that sounds careful.

import { resolveScholar } from '../source-registry.js';
import { NORMALIZATION_VERSION } from './version.js';

// ── normalisation ────────────────────────────────────────────────────────────
// Its own copy rather than route-classify's, for one reason: that one deletes ALL punctuation,
// and the quotation marks are load-bearing here — they are what tells a quote-verification
// request from an opinion request. So this folds orthography and keeps the quoting characters.
// Governed by NORMALIZATION_VERSION; a change here changes what counts as the same question.
const QUOTE_CHARS = '«»""\'“”‘’';
export function fold(s) {
  return String(s == null ? '' : s)
    .replace(/[ً-ْٰٟـؖ-ؚۖ-ۭ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}
export { NORMALIZATION_VERSION };

// ── the registered roster ────────────────────────────────────────────────────
//
// ERA IS DECLARED, NEVER INFERRED. A death date parsed out of prose would be a guess, and the
// era decides the provenance ceiling (lib/policy/attribution-grades.js): a historical scholar
// may be reported from an eligible summarising source at grade C, and a contemporary one may
// not be reported at all without a registered primary corpus. Getting that backwards is exactly
// the "قال الشيخ" from a third-party summary this RFC forbids.
//
// AMBIGUITY IS DECLARED TOO. «ابن حجر» is al-'Asqalani to a hadith reader and al-Haytami to a
// fiqh reader, and the app has no way to tell which one a sentence means. So the entry carries
// BOTH and resolves to neither.
const HISTORICAL = [
  {
    canonicalId: 'ibn-taymiyyah', display: 'ابن تيمية',
    // «شيخ الإسلام ابن تيمية» is deliberately NOT an alias of its own: «ابن تيميه» already
    // matches inside it, and a longer alias would drag the honorific into `surface` — which is
    // the shape of the very capture defect this module removes.
    aliases: ['ابن تيميه', 'ابن تيمية', 'بن تيميه', 'احمد بن عبدالحليم', 'ابن تيمه'],
  },
  {
    canonicalId: 'ibn-hajar', display: 'ابن حجر', ambiguous: true,
    candidates: ['ibn-hajar-al-asqalani', 'ibn-hajar-al-haytami'],
    aliases: ['ابن حجر', 'بن حجر'],
  },
  { canonicalId: 'ibn-hajar-al-asqalani', display: 'ابن حجر العسقلاني', aliases: ['ابن حجر العسقلاني', 'العسقلاني'] },
  { canonicalId: 'ibn-hajar-al-haytami', display: 'ابن حجر الهيتمي', aliases: ['ابن حجر الهيتمي', 'الهيتمي'] },
  { canonicalId: 'ibn-qayyim', display: 'ابن القيم', aliases: ['ابن القيم', 'بن القيم', 'ابن قيم الجوزيه'] },
  { canonicalId: 'al-nawawi', display: 'النووي', aliases: ['النووي', 'الامام النووي', 'يحيي بن شرف النووي'] },
  { canonicalId: 'ibn-kathir', display: 'ابن كثير', aliases: ['ابن كثير', 'بن كثير'] },
  { canonicalId: 'al-bukhari', display: 'البخاري', aliases: ['البخاري', 'الامام البخاري', 'محمد بن اسماعيل البخاري'] },
  { canonicalId: 'muslim', display: 'مسلم', aliases: ['مسلم بن الحجاج', 'الامام مسلم'] },
  { canonicalId: 'abu-hanifa', display: 'أبو حنيفة', aliases: ['ابو حنيفه', 'الامام ابو حنيفه', 'النعمان بن ثابت'] },
  { canonicalId: 'malik', display: 'مالك', aliases: ['مالك بن انس', 'الامام مالك'] },
  { canonicalId: 'al-shafii', display: 'الشافعي', aliases: ['الشافعي', 'الامام الشافعي', 'محمد بن ادريس الشافعي'] },
  { canonicalId: 'ahmad-ibn-hanbal', display: 'أحمد بن حنبل', aliases: ['احمد بن حنبل', 'الامام احمد'] },
  { canonicalId: 'al-ghazali', display: 'الغزالي', aliases: ['الغزالي', 'ابو حامد الغزالي'] },
  { canonicalId: 'al-shatibi', display: 'الشاطبي', aliases: ['الشاطبي'] },
  { canonicalId: 'ibn-abdilbarr', display: 'ابن عبد البر', aliases: ['ابن عبد البر', 'ابن عبدالبر'] },
  { canonicalId: 'ibn-rushd', display: 'ابن رشد', aliases: ['ابن رشد'] },
  { canonicalId: 'ibn-hazm', display: 'ابن حزم', aliases: ['ابن حزم'] },
].map((e) => Object.freeze({
  ...e, targetType: 'person', era: 'historical',
  aliases: Object.freeze(e.aliases.map(fold)),
  candidates: Object.freeze(e.candidates || []),
}));

// A SCHOOL IS NOT A MAN. «عند الحنابلة» asks what a madhhab holds, and the answer is a body of
// transmitted doctrine, not one person's fatwa — so it may never take a person-attribution
// template and may never be routed to somebody's official site.
const MADHHABS = [
  { canonicalId: 'hanbali', display: 'الحنابلة', aliases: ['الحنابله', 'الحنبليه', 'المذهب الحنبلي', 'الحنبلي'] },
  { canonicalId: 'hanafi', display: 'الحنفية', aliases: ['الحنفيه', 'الاحناف', 'المذهب الحنفي', 'الحنفي'] },
  { canonicalId: 'maliki', display: 'المالكية', aliases: ['المالكيه', 'المذهب المالكي', 'المالكي'] },
  { canonicalId: 'shafii', display: 'الشافعية', aliases: ['الشافعيه', 'المذهب الشافعي'] },
  { canonicalId: 'zahiri', display: 'الظاهرية', aliases: ['الظاهريه', 'المذهب الظاهري'] },
].map((e) => Object.freeze({
  ...e, targetType: 'madhhab', era: 'historical',
  aliases: Object.freeze(e.aliases.map(fold)), candidates: Object.freeze([]),
}));

// A COMMITTEE IS NOT A PERSON EITHER, and the reverse mistake — reading a board's collective
// fatwa as one man's opinion — is already refused by the ledger source policy for
// eftaa.awqaf.gov.kw. Naming institutions here lets the same distinction be made in the IR.
const INSTITUTIONS = [
  { canonicalId: 'iifa', display: 'مجمع الفقه الإسلامي', aliases: ['مجمع الفقه الاسلامي', 'المجمع الفقهي'] },
  { canonicalId: 'lajnah-daimah', display: 'اللجنة الدائمة', aliases: ['اللجنه الدايمه', 'اللجنه الدائمه'] },
  { canonicalId: 'eftaa-committee-kw', display: 'إدارة الإفتاء الكويتية', aliases: ['اداره الافتاء', 'الافتاء الكويتيه'] },
  { canonicalId: 'kibar-ulama', display: 'هيئة كبار العلماء', aliases: ['هيئه كبار العلماء', 'كبار العلماء'] },
].map((e) => Object.freeze({
  ...e, targetType: 'institution', era: 'contemporary',
  aliases: Object.freeze(e.aliases.map(fold)), candidates: Object.freeze([]),
}));

export const ROSTER = Object.freeze([...HISTORICAL, ...MADHHABS, ...INSTITUTIONS]);

// ── CONTEMPORARY SCHOLARS ARE NOT LISTED HERE AT ALL ─────────────────────────
//
// The first version of this module carried its own `DOMAIN_TO_OWNER` table naming fourteen
// domains and their owner ids. It was correct on the day it was written and it was a SECOND
// roster: `lib/source-registry.js` already resolves a reader's spelling to a domain, and
// `lib/ledger/source-policy.js` already declares that domain's `ownerId`. Two lists carrying
// `ibn-baz`, `ibn-uthaymeen` and `al-abbaad` is one list waiting to disagree with the other —
// and the disagreement would show up as a scholar whose era or cap depends on which module you
// asked, which is precisely the class of bug this RFC exists to remove.
//
// So the mapping is READ from the source policy. This module owns the HISTORICAL roster (nobody
// else has one, because none of those scholars has a site) and owns nothing else.
//
// LAYERING NOTE: `lib/policy/` importing `lib/ledger/source-policy.js` is a cross-layer edge, and
// it is acyclic — source-policy imports only the registry and the capability vocabulary. The
// alternative, duplicating its data, is the defect being fixed.
import { ownerOf, POLICY_ROWS } from '../ledger/source-policy.js';

// ── surface scan ─────────────────────────────────────────────────────────────
// LONGEST ALIAS WINS. «ابن حجر العسقلاني» must not be read as the ambiguous «ابن حجر» with a
// stray word after it, and «ابن حجر» must not be read as «ابن» plus noise.
const ALL_ALIASES = ROSTER
  .flatMap((e) => e.aliases.map((a) => ({ alias: a, entity: e })))
  .sort((a, b) => b.alias.length - a.alias.length);

// A registered alias only counts as an entity when it stands as its own word run. Arabic glues
// the article and prepositions on, so the boundary is "not an Arabic letter", which admits
// «للحنابلة» -> «الحنابلة» while refusing a match inside a longer unrelated word.
//
// LETTERS ONLY, NOT THE WHOLE ARABIC BLOCK. MEASURED while building this module: «؟» is U+061F,
// inside U+0600-U+06FF, so a class of «the Arabic block» made the question mark a letter — and
// every entity at the END of a question («... عند الحنابلة؟», «... في ابن تيمية؟») failed the
// boundary test and vanished. The block holds punctuation; the boundary wants letters.
const AR_LETTER = /[ء-يٮ-ۓۮ-ۿ]/;
function standsAlone(hay, at, len) {
  const before = at > 0 ? hay[at - 1] : '';
  const after = at + len < hay.length ? hay[at + len] : '';
  return !AR_LETTER.test(before || ' ') && !AR_LETTER.test(after || ' ');
}

// Honorifics, used ONLY to find where a contemporary name might start. They never become part
// of a name — that greedy inclusion is what produced «الاسلام ابن تيميه اهل».
const TITLE = 'الشيخ|الشيخ|شيخ|العلامه|الامام|الدكتور|الفقيه|المفتي|سماحه|فضيله|شيخ الاسلام';
const TITLE_RE = new RegExp('(?:' + TITLE + ')\\s+([\\u0600-\\u06FF]+(?:\\s+[\\u0600-\\u06FF]+){0,3})', 'gu');

// Words that cannot be part of a person's name; they end it.
//
// THE FRAME WORDS ARE IN HERE FOR A REASON. «ما رأي ابن باز في ابن تيمية؟» offers the registry
// the three-word run «راي ابن باز», which resolves — Ibn Baz is inside it — and the resulting
// entity then starts one word too early, so the text before it is «ما » and the «ما رأيُ فلان»
// frame no longer matches. Ibn Baz silently became a SUBJECT in a question that asks for his
// position. A run containing a frame word is not a name.
const NAME_STOP = new Set(['في', 'عن', 'علي', 'من', 'هل', 'ما', 'اذا', 'حول', 'بخصوص', 'يقول',
  'قال', 'رحمه', 'الله', 'تعالي', 'فيمن', 'لمن', 'ان', 'انه', 'الذي', 'التي', 'و', 'او',
  'اهل', 'السنه', 'والجماعه', 'الجماعه', 'بجواز', 'القول', 'كذا', 'ذلك', 'هذا', 'هذه',
  'راي', 'رايي', 'مذهب', 'اختيار', 'ترجيح', 'فتوي', 'كلام', 'تفصيل', 'حكم', 'المساله',
  'عند', 'حسب', 'بحسب', 'وفق', 'خالف', 'وافق', 'كان', 'ضعف', 'صحح', 'حسن', 'ذهب', 'يذهب',
  'ذكر', 'افتي', 'رجح', 'اختار', 'يري', 'يجيز', 'يمنع', 'نسب', 'منسوب', 'ينسب']);

function trimName(raw) {
  const out = [];
  for (const w of fold(raw).split(' ').filter(Boolean)) {
    if (NAME_STOP.has(w)) break;
    out.push(w);
    if (out.length >= 4) break;
  }
  return out.join(' ');
}

// ── relation shapes ──────────────────────────────────────────────────────────
//
// EACH OF THESE IS A FRAME AROUND AN ENTITY, NOT A KEYWORD. That distinction is the whole
// «ذهب»/«الذهب» lesson: the verb sense of «ذهب» only ever appears as «ذهب فلانٌ إلى القول», so
// the frame requires the person AND the «إلى». A bare «ذهب» is somebody walking, or gold.

// The reader wants THIS person's own position.
const BY_FRAMES = [
  /(?:ما|وما|ايش)\s*(?:هو|هي)?\s*(?:راي|قول|مذهب|اختيار|ترجيح|فتوي|كلام|تفصيل)\s*(?:الشيخ|الامام|العلامه|شيخ|الدكتور)?\s*$/u,
  /(?:قال|يقول|ذكر|افتي|رجح|اختار|نص|يري|يجيز|يمنع|ضعف|صحح|حسن)\s*(?:الشيخ|الامام|العلامه|شيخ|الدكتور)?\s*$/u,
  /(?:عند|حسب|بحسب|وفق|علي مذهب|في مذهب)\s*$/u,
  /(?:ينسب|منسوب|نسب)\s*(?:الي|ل)\s*$/u,
  /(?:ذهب|يذهب)\s*$/u,
];

// The reader is asking ABOUT this person — his conduct, his standing, his biography. His own
// position is not what was requested, and answering with one would be answering another question.
const ABOUT_FRAMES = [
  /(?:هل)\s*(?:خالف|وافق|كان|يعد|يعتبر|صح|ثبت|كفر|بدع|فسق|ضل|اخطا|اصاب)\s*(?:الشيخ|الامام|العلامه|شيخ|شيخ الاسلام|الدكتور)?\s*$/u,
  /(?:من هو|من هي|ترجمه|سيره|نبذه|متي ولد|متي توفي|وفاه|مولد)\s*(?:الشيخ|الامام|العلامه|شيخ|شيخ الاسلام)?\s*$/u,
  /(?:عقيده|منهج|مذهب)\s*$/u,
];

// ARABIC PUTS THE SUBJECT BEFORE THE VERB TOO. «ابن حجر ضعّف هذا الحديث» and «ابن تيمية يرى
// كذا» are requests for that man's position with nothing at all in front of his name, so a
// classifier that only ever reads leftwards records him as a passive subject and loses the
// attribution — the mirror image of the role collapse above. These read rightwards.
// The trailing `(?![ء-ي])` is doing the work `\b` cannot: JavaScript's \b is a transition
// between \w and non-\w, and \w is ASCII, so «ضعف» followed by a space has NO boundary between
// them and the pattern silently never fires. The lookahead says what was meant — the verb ends
// here — and keeps «ضعفاء» from matching «ضعف».
const AFTER_FRAMES = [
  /^\s*(?:قال|يقول|ذكر|افتي|رجح|اختار|يري|يجيز|يمنع|ضعف|صحح|حسن|نص|قرر|صرح)(?![ء-ي])/u,
  /^\s*(?:ذهب|يذهب)\s+(?:الي|إلى)/u,
];

// «ذهب فلانٌ إلى ...» — the verb sense needs its «إلى» within the clause.
function verbSenseSatisfied(text, afterIndex) {
  return /(?:الي|إلى)/u.test(text.slice(afterIndex, afterIndex + 60));
}

// A quotation being checked. The quoted run is what must be found verbatim or not at all.
const QUOTED = new RegExp('[«"“\'](.{2,200}?)[»"”\']', 'u');

/**
 * READ A QUESTION.
 *
 * @returns {{
 *   claimRelation:'ABOUT_ENTITY'|'BY_ENTITY'|'QUOTE_VERIFICATION'|'BY_MADHHAB'|'NONE',
 *   requestedAuthorityId:string|null,
 *   verbatimRequired:boolean,
 *   quotedText:string,
 *   entities:Array<{surface,canonicalId,targetType,role,era,resolutionStatus,candidates}>,
 *   attributionTargets:string[]
 * }}
 */
export function readEntities(questionRaw) {
  const raw = String(questionRaw == null ? '' : questionRaw);
  const hay = fold(raw);
  const found = [];      // { entity, at, len }
  const takenAt = [];

  const overlaps = (at, len) => takenAt.some(([s, e]) => at < e && (at + len) > s);

  // 1. REGISTERED ALIASES, longest first.
  for (const { alias, entity } of ALL_ALIASES) {
    let from = 0;
    for (;;) {
      const at = hay.indexOf(alias, from);
      if (at === -1) break;
      from = at + alias.length;
      if (!standsAlone(hay, at, alias.length)) continue;
      if (overlaps(at, alias.length)) continue;
      takenAt.push([at, at + alias.length]);
      found.push({ entity, at, len: alias.length, surface: alias });
      break;                                   // one occurrence per entity is enough
    }
  }

  // 2. CONTEMPORARY SCHOLARS, via the shipped registry — honorific-anchored, and also bare,
  //    because «ما رأي ابن باز» carries no honorific at all.
  const candidateNames = new Set();
  let m;
  TITLE_RE.lastIndex = 0;
  while ((m = TITLE_RE.exec(hay)) !== null) {
    const n = trimName(m[1]);
    if (n.length >= 4) candidateNames.add(n);
  }
  // Bare runs of 2-4 words are offered to the registry as well; the registry's own whole-word
  // rule is what refuses noise, so nothing is invented by trying.
  const words = hay.split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    for (let n = 2; n <= 4 && i + n <= words.length; n++) {
      const run = words.slice(i, i + n).join(' ');
      if (run.split(' ').some((w) => NAME_STOP.has(w))) continue;
      candidateNames.add(run);
    }
  }
  for (const name of candidateNames) {
    const r = resolveScholar(name);
    if (r.status !== 'resolved') continue;
    const ownerId = ownerOf(r.domain);
    if (!ownerId) continue;
    const at = hay.indexOf(name);
    if (at === -1 || overlaps(at, name.length)) continue;
    takenAt.push([at, at + name.length]);
    found.push({
      entity: Object.freeze({
        canonicalId: ownerId, display: name, targetType: 'person',
        era: 'contemporary', aliases: [], candidates: [],
      }),
      at, len: name.length, surface: name,
    });
  }

  // 3. AN HONORIFIC WITH A NAME NOBODY KNOWS. Recorded as unresolved rather than dropped: the
  //    legacy path still has to be able to ask which shaykh is meant.
  TITLE_RE.lastIndex = 0;
  while ((m = TITLE_RE.exec(hay)) !== null) {
    const n = trimName(m[1]);
    if (n.length < 4) continue;
    const at = hay.indexOf(n);
    if (at === -1 || overlaps(at, n.length)) continue;
    takenAt.push([at, at + n.length]);
    found.push({
      entity: Object.freeze({
        canonicalId: '', display: n, targetType: 'person',
        era: 'unknown', aliases: [], candidates: [],
      }),
      at, len: n.length, surface: n, unresolved: true,
    });
  }

  found.sort((a, b) => a.at - b.at);

  // ── QUOTE VERIFICATION ─────────────────────────────────────────────────────
  // «هل قال فلان: "..."». The quoted run is the thing to be found; a summarising source may
  // report that he held a view and still not establish that he said these words.
  const q = raw.match(QUOTED);
  const asksSaid = /(?:هل\s*(?:قال|صح عنه|ثبت عنه)|صحه\s*(?:نسبه|القول)|هذا القول منسوب)/u.test(hay);
  const isQuote = !!(q && q[1] && q[1].trim() && found.length && asksSaid);

  // ── ROLES ──────────────────────────────────────────────────────────────────
  let requestedAuthorityId = null;
  const entities = found.map((f) => {
    const before = hay.slice(0, f.at);
    const after = hay.slice(f.at + f.len);
    const isBy = BY_FRAMES.some((re, i) => {
      if (!re.test(before)) return false;
      // The «ذهب» frame is the last one and carries its own extra condition.
      if (i === BY_FRAMES.length - 1) return verbSenseSatisfied(hay, f.at + f.len);
      return true;
    }) || AFTER_FRAMES.some((re) => re.test(after));
    const isAbout = ABOUT_FRAMES.some((re) => re.test(before));

    // A MADHHAB IS NEVER AN AUTHORITY IN THE PERSON SENSE. It can be the target of «عند
    // الحنابلة», which is a doctrine lookup, not somebody's fatwa.
    let role = 'subject';
    if (f.entity.targetType === 'person' || f.entity.targetType === 'institution') {
      if (isBy && !isAbout) role = 'authority';
      else if (isAbout) role = 'subject';
      else role = 'subject';
    }

    const ambiguous = !!f.entity.ambiguous;
    const unresolved = !!f.unresolved;
    return Object.freeze({
      surface: f.surface,
      canonicalId: f.entity.canonicalId || '',
      targetType: f.entity.targetType,
      role,
      era: f.entity.era,
      resolutionStatus: ambiguous ? 'ambiguous' : unresolved ? 'unresolved' : 'resolved',
      candidates: Object.freeze((f.entity.candidates || []).slice()),
    });
  });

  // TWO SEPARATE FACTS, AND CONFLATING THEM LOSES A QUESTION.
  //
  //   "his position is what was asked for"  — decided by the FRAME, and true even when we have
  //                                            no idea who he is;
  //   "we know which man that is"           — decided by the REGISTRY.
  //
  // «ما رأي الشيخ فلان الفلاني؟» is unmistakably a request for somebody's position. Requiring the
  // name to resolve before admitting that would file it as a question ABOUT him instead — and
  // then the honest "which shaykh do you mean?" could never be asked, because nothing would know
  // a position had been requested at all. So the ROLE is recorded from the frame, and only the
  // authority ID waits on the registry. An ambiguous or unresolved name never becomes an id.
  const authEntity = entities.find((e) => e.role === 'authority' && e.targetType === 'person');
  const auth = authEntity && authEntity.resolutionStatus === 'resolved' ? authEntity : null;
  if (auth) requestedAuthorityId = auth.canonicalId;

  const madhhab = entities.find((e) => e.targetType === 'madhhab');

  let claimRelation = 'NONE';
  if (isQuote) claimRelation = 'QUOTE_VERIFICATION';
  else if (authEntity) claimRelation = 'BY_ENTITY';
  else if (madhhab && BY_FRAMES.some((re) => re.test(hay.slice(0, found.find((f) => f.entity.targetType === 'madhhab').at)))) {
    claimRelation = 'BY_MADHHAB';
  } else if (entities.some((e) => e.role === 'subject' && e.targetType === 'person')) {
    claimRelation = 'ABOUT_ENTITY';
  } else if (madhhab) claimRelation = 'BY_MADHHAB';

  // A quote request still names an authority — we need to know whose corpus to read.
  if (isQuote && !requestedAuthorityId) {
    const first = entities.find((e) => e.targetType === 'person' && e.resolutionStatus === 'resolved');
    if (first) requestedAuthorityId = first.canonicalId;
  }

  return Object.freeze({
    claimRelation,
    requestedAuthorityId,
    verbatimRequired: isQuote,
    quotedText: isQuote ? String(q[1]).trim() : '',
    entities: Object.freeze(entities),
    attributionTargets: Object.freeze(entities.filter((e) => e.role === 'authority').map((e) => e.canonicalId).filter(Boolean)),
  });
}

/**
 * MAY ANYTHING BE REFUSED BEFORE A SEARCH RUNS?
 *
 * Almost never, and that is the point of RFC v0.5-R2 §7. The shipped path refused three whole
 * classes of question before looking at anything, and every one of those refusals was wrong.
 * The only pre-search refusals that survive are the two where searching would be DISHONEST
 * rather than merely expensive:
 *
 *   * an ambiguous entity — we would be choosing which man the reader meant;
 *   * an unresolved name in an explicit opinion request — we would imply we knew who he was.
 *
 * A question ABOUT a scholar is never refused here. Neither is a madhhab, and neither is a
 * contemporary scholar with no primary adapter: that one now searches, finds the general ruling,
 * and attributes nothing to him (RFC §6).
 *
 * @returns {null|{code:string, entity:string}}
 */
export function preSearchRejection(ir) {
  if (!ir) return null;
  if (ir.claimRelation === 'ABOUT_ENTITY') return null;
  if (ir.claimRelation === 'BY_MADHHAB') return null;
  const amb = ir.entities.find((e) => e.resolutionStatus === 'ambiguous' && e.role === 'authority');
  if (amb) return { code: 'AMBIGUOUS_ENTITY', entity: amb.surface };
  if (ir.claimRelation === 'BY_ENTITY' || ir.claimRelation === 'QUOTE_VERIFICATION') {
    const un = ir.entities.find((e) => e.resolutionStatus === 'unresolved' && e.role === 'authority');
    if (un) return { code: 'UNRESOLVED_ENTITY', entity: un.surface };
  }
  return null;
}

/**
 * What to do when a name does not identify one person.
 *
 * ALWAYS THE SAME ANSWER, AND IT IS NOT A GUESS. Asking which Ibn Hajar is meant costs the
 * reader one line; picking one for him costs him a false attribution he has no way to detect.
 */
export function ambiguityOutcome(ir) {
  if (!ir) return 'NONE';
  const amb = ir.entities.find((e) => e.resolutionStatus === 'ambiguous');
  return amb ? 'CLARIFY_OR_SCOPE' : 'NONE';
}

/**
 * The era of an entity id, or 'unknown'. Used by the provenance ceiling.
 *
 * The historical roster is this module's own; every other owner id is looked up in the source
 * policy, so "is this man contemporary" has exactly one answer in the codebase.
 */
export function eraOf(canonicalId) {
  const e = ROSTER.find((x) => x.canonicalId === canonicalId);
  if (e) return e.era;
  return POLICY_ROWS.some((r) => r.ownerId === canonicalId) ? 'contemporary' : 'unknown';
}

/**
 * DO THE TWO ROSTERS AGREE?
 *
 * Returns problem strings; empty means conformant. Executable, because the failure it catches —
 * an owner id, an alias or an era that means one thing here and another in the registry — is
 * invisible to review and obvious to a comparison.
 *
 * WHAT IT DOES NOT DO: activate anything. An entity existing here confers no capability and no
 * searchability on any domain; that is decided entirely by lib/ledger/source-policy.js, and the
 * check below asserts this module has not silently introduced an owner the policy does not know.
 */
export function rosterDriftProblems() {
  const problems = [];

  // 1. No historical entry may collide with a registry-owned id. A scholar cannot be both a
  //    historical figure with no site and the owner of one.
  for (const e of ROSTER) {
    if (e.targetType !== 'person') continue;
    if (POLICY_ROWS.some((r) => r.ownerId === e.canonicalId)) {
      problems.push('historical roster claims an id the source policy owns: ' + e.canonicalId);
    }
  }

  // 2. Every id this module can produce for a contemporary must be one the source policy declares.
  for (const r of POLICY_ROWS) {
    if (!r.ownerId) continue;
    if (eraOf(r.ownerId) !== 'contemporary') {
      problems.push('registry owner is not contemporary here: ' + r.ownerId + ' -> ' + eraOf(r.ownerId));
    }
  }

  // 3. Resolving a registry alias must land on the SAME owner id the policy row declares.
  for (const r of POLICY_ROWS) {
    if (!r.ownerId || r.health !== 'enabled') continue;
    const back = ownerOf(r.domain);
    if (back !== r.ownerId) {
      problems.push('domain -> owner disagrees for ' + r.domain + ': ' + back + ' vs ' + r.ownerId);
    }
  }

  // 4. Aliases must be unambiguous WITHIN this module too: one surface, one entity.
  const seen = new Map();
  for (const e of ROSTER) {
    for (const a of e.aliases) {
      if (seen.has(a) && seen.get(a) !== e.canonicalId) {
        problems.push('alias "' + a + '" maps to both ' + seen.get(a) + ' and ' + e.canonicalId);
      }
      seen.set(a, e.canonicalId);
    }
  }
  return problems;
}
