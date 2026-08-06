// lib/policy/consistency-gate.js
// ONE ANSWER UNIT MAY NOT BOTH CREDIT A MAN AND DISCLAIM HAVING FOUND HIM.
//
// ── THE FAILURE THIS EXISTS TO MAKE IMPOSSIBLE, MEASURED ON THE LIVE SERVICE ─
// «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟» was answered with: his position
// stated as fact, a quotation attributed to مجموع الفتاوى, the majority view, his view called
// weak, a recommendation to make up the prayer — and then, in the same reply:
//
//   «لم أقف على نصٍّ مباشرٍ للشيخ ابن تيميه»
//
// Both halves cannot be true. Either the text was found, in which case the disclaimer is false,
// or it was not, in which case the quotation and the attribution are unsupported. The reader has
// no way to tell which half to believe, and the half that reads as authoritative is the wrong one.
//
// ── WHY A PROMPT INSTRUCTION WAS NOT ENOUGH ─────────────────────────────────
// api/ask.js already TELLS the model, in as many words, not to attribute anything to him when his
// text was not found. The model attributed anyway. An instruction is a request; this is a gate.
//
// ── AND WHY A NEGATION NEEDS PROOF OF SEARCH ────────────────────────────────
// A historical scholar has no official domain and no adapter, so the attributed route never ran a
// search for him at all — and then said «لم أقف على نصٍّ مباشرٍ له». That is a claim about work
// that was never done. «I did not find» and «I did not look» are different statements, and only
// the first one may be made after actually looking.
//
// THIS MODULE DECIDES NOTHING ABOUT RELIGION. It reads a draft and reports which of these
// invariants it broke. What to do about that is the caller's, and in api/ask.js it is to drop the
// draft whole rather than edit it down.

import { fold, ROSTER } from './entities.js';
// THE SOURCE-CLASS RULE, READ AND NEVER RE-IMPLEMENTED. Which persons the pages in hand license
// is decided in one place (lib/policy/source-attribution.js) and consumed here, so the legacy
// screen and the ledger's Gate 3 cannot come to different conclusions about the same result set.
import { licensedSurfaces, allPersonSurfaces } from './source-attribution.js';

/** A positive attribution of speech: «قال فلان», «يقول الشيخ», «صرّح ابن تيمية». */
const SPEECH_VERBS = 'قال|يقول|صرح|نص|قرر|كتب|روي عنه';
/**
 * A positive attribution of a POSITION, which is weaker than speech and still an attribution.
 *
 * GRADING A HADITH IS A RULING TOO, and it was missing. «صحح الشيخ الألباني هذا الحديث» credits a
 * named man with a verdict on an isnad — the single most quoted kind of claim there is about him —
 * and matched neither list, so it passed a gate written to stop exactly this. `حسن` is deliberately
 * NOT here: it is an ordinary adjective («أمر حسن») and would refuse innocent prose.
 */
const POSITION_VERBS = 'يري|راي|ذهب|اختار|رجح|افتي|يفتي|مذهب|اجاز|منع|حرم|اوجب|صحح|ضعف|وثق|جرح|استحب|كره';

const TITLES = 'الشيخ|العلامه|الامام|الدكتور|الفقيه|المفتي|العالم|شيخ الاسلام|شيخ';

/** Every registered person, longest form first so a longer name is not eaten by a shorter one. */
function entityNameAlternation(extraNames = []) {
  const names = [...new Set([
    ...ROSTER.filter((e) => e.targetType === 'person').flatMap((e) => [...e.aliases, fold(e.display)]),
    ...extraNames.map((n) => fold(n)),
  ].filter(Boolean))].sort((a, b) => b.length - a.length);
  return names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

export const PROBLEM = Object.freeze({
  /** Speech credited to the entity while his text was not verified. */
  SPEECH_WITHOUT_EVIDENCE: 'SPEECH_WITHOUT_EVIDENCE',
  /** A position credited to the entity while his text was not verified. */
  POSITION_WITHOUT_EVIDENCE: 'POSITION_WITHOUT_EVIDENCE',
  /** A direct quotation in a sentence that names him, at a grade that cannot carry one. */
  QUOTE_WITHOUT_EVIDENCE: 'QUOTE_WITHOUT_EVIDENCE',
  /** «لم أقف» when no search was ever run for that slot. */
  NEGATION_WITHOUT_SEARCH: 'NEGATION_WITHOUT_SEARCH',
  /** A fact about WHO A NAMED MAN IS — dead, Saudi, a broadcaster — that no source supplied. */
  IDENTITY_WITHOUT_EVIDENCE: 'IDENTITY_WITHOUT_EVIDENCE',
  /** A صفة or a موقف credited to a man no page in hand licenses being named at all. */
  ATTRIBUTION_NOT_LICENSED: 'ATTRIBUTION_NOT_LICENSED',
  /** The app weighed the views itself: a ترجيح no retrieved page states and nobody is credited with. */
  TARJIH_WITHOUT_EVIDENCE: 'TARJIH_WITHOUT_EVIDENCE',
});

// ── THE APP TRANSMITS; IT DOES NOT WEIGH ─────────────────────────────────────
//
// MEASURED. An answer about Ibn Taymiyyah went out carrying «**الراجح** أنّ من ترك الصلاة عمدًا وجب
// عليه قضاؤها». Nobody was credited with that preference and no retrieved page stated it: the
// application had chosen between the positions of the fuqahā' and announced the winner. «عزك ناقلٌ
// لا مفتٍ» is the governing rule of this project, and preferring one qawl over another is the
// single most fatwa-like act there is — more so than reporting a ruling, because reporting has a
// source and preferring has an author.
//
// TWO CONDITIONS, AND BOTH ARE REQUIRED, exactly as the brief states them: the ترجيح must be
// WRITTEN ON THE PAGE, and it must be ATTRIBUTED TO WHOEVER SAID IT. A page that says «والراجح عند
// الحنابلة» may be transmitted as such; the same word with nobody behind it may not.
//
// WHAT IS DELIBERATELY NOT HERE. Bare «الصحيح» and «صحيح» are absent: they are the ordinary
// vocabulary of hadith grading — «حديث صحيح», «إسناده صحيح» — and flagging them would refuse
// takhrij, which is transmission of the plainest kind. Only the compound forms that can only mean
// preference are listed.
const TARJIH_MARKERS = [
  'الراجح', 'والراجح', 'فالراجح', 'الارجح', 'والارجح',
  'الصواب', 'والصواب', 'فالصواب', 'الاصوب',
  'المختار', 'والمختار', 'الاقوي', 'والاقوي', 'الاولي والاقوي',
  'وهو الصحيح', 'والصحيح ان', 'والذي يظهر', 'الذي يظهر لي', 'الذي نرجحه',
  'نرجح', 'ارجح ان', 'ترجح لدي', 'ترجح عندي',
  'الاحوط', 'والاحوط', 'فالاحوط',
];

// Whom a ترجيح may be credited to. A person, a school, the body of scholars, or the publisher the
// transmission frame already names — every one of them is somebody a reader can go and check.
const TARJIH_SAYER = 'الجمهور|جمهور|جماهير|الحنفيه|المالكيه|الشافعيه|الحنابله|الظاهريه'
  + '|المذهب|مذهب|اهل العلم|العلماء|اللجنه الدائمه|هيئه كبار العلماء|دار الافتاء|المجمع الفقهي'
  + '|عند الحنفيه|عند المالكيه|عند الشافعيه|عند الحنابله|في المصدر|الموقع|موقع';

/**
 * A ترجيح THE APP HAD NO RIGHT TO MAKE.
 *
 * ARMED BY THE CALLER SUPPLYING THE PAGES, and not by their contents — the same convention
 * `sourceLicence` follows above. An ABSENT `pageTexts` means "this caller is not wired to the rule
 * yet" and changes nothing; an EMPTY ARRAY means "no page was retrieved", under which no ترجيح can
 * possibly be sourced and every one of them is the app's own.
 */
function tarjihWithoutEvidence(foldedText, ctx) {
  if (!Array.isArray(ctx.pageTexts)) return false;
  const marker = TARJIH_MARKERS.find((m) => foldedText.includes(m));
  if (!marker) return false;
  // 1. IS IT ON THE PAGE? Any retrieved page carrying any preference word is enough here; which
  //    sentence of the draft it belongs to is settled by condition 2.
  const onPage = ctx.pageTexts.some((p) => {
    const f = fold(String(p || ''));
    return f && TARJIH_MARKERS.some((m) => f.includes(m));
  });
  if (!onPage) return true;
  // 2. IS SOMEBODY CREDITED WITH IT? A named person, a school, or the source being transmitted
  //    from. Without one, the draft is still announcing a winner in its own voice.
  const named = entityNameAlternation(ctx.entity ? [ctx.entity] : []);
  const sayer = '(?:' + TARJIH_SAYER + '|' + TITLES + (named ? '|' + named : '') + ')';
  return !new RegExp(sayer, 'u').test(foldedText);
}

// ── WHAT MAY BE SAID ABOUT A MAN THE PAGES DO NOT NAME ───────────────────────
//
// MEASURED. «ما رأي طارق العلي في أحكام العدة؟» was answered with «داعية وخطيب كويتي معروف من أهل
// العلم … يتبنّى المذهب الحنفي» and four rulings credited to «رأيه» — over one card from
// alukah.net titled «أحكام العدة للمرأة (خطبة)», a page that does not contain his name anywhere.
// He is a Kuwaiti comic actor.
//
// EVERY CHECK ABOVE WAS SATISFIED. The draft attributed no speech to a scholar the roster knew,
// quoted nothing and negated nothing; it simply invented a man's profession, his standing, his
// madhhab and his positions, warmly, with a source card underneath that the reader has every
// reason to read as backing it.
//
// So the rule here is about THE SOURCE CLASS and nothing else: a sentence may credit a person with
// a صفة or a موقف only when a page in hand licenses naming him. What "licenses" means is decided
// entirely by lib/policy/source-attribution.js, and this file's only job is to find the sentences
// that break it.
//
// «صفة» — profession, nationality, death, country, madhhab, scholarly standing.
const RANK_MARKERS = 'من اهل العلم|من العلماء|من كبار العلماء|عالم دين|خطيب|واعظ|محدث|فقيه معاصر'
  + '|مفتي معاصر|طالب علم|شيخ معاصر|من المشايخ|من الدعاه';
const MADHHAB_ADOPTION = 'المذهب الحنفي|المذهب المالكي|المذهب الشافعي|المذهب الحنبلي|المذهب الظاهري'
  + '|مذهب الحنفيه|مذهب المالكيه|مذهب الشافعيه|مذهب الحنابله';
// «موقف» — and the alignment verbs the position list never carried. «اتفق ابن حجر مع الجمهور …
// في الفتح», over a page that never mentions him, matched neither SPEECH_VERBS nor POSITION_VERBS.
const ALIGNMENT_VERBS = 'اتفق|يتفق|وافق|يوافق|خالف|يخالف|تبني|يتبني|انتصر|ينتصر|تابع|يتابع';

// ── WHO SOMEBODY IS, IS ALSO A CLAIM ─────────────────────────────────────────
//
// MEASURED ON THE LIVE SERVICE, verbatim:
//
//   «الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم»
//
// He is alive. He is not a broadcaster. Not one word of that came from a page. Every check above
// was satisfied, because the sentence attributes no speech, states no position, quotes nothing
// and negates nothing — it simply invents a man's death, his nationality and his profession, in
// the app's own voice, in a warm and creditable tone.
//
// A false ruling can be argued with. A false obituary cannot: the reader has no reason to doubt
// it and no way to check it, and «رحمه الله» about a living man is the kind of thing that reaches
// his family. So a DESCRIPTION of a named person is held to the same standard as a fatwa of his —
// it comes from a source or it does not go out.
//
// THIS IS ADDITIONAL, NEVER A REPLACEMENT. It runs alongside the speech and position checks, and
// catches exactly what they were never shaped to see.
const DEATH_MARKERS = 'رحمه الله|رحمه اللة|المتوفي|توفي|رحمها الله|طيب الله ثراه|في ذمه الله|الراحل|المرحوم';
// Nationality and civil identity: a nisba the app has no way to know.
const NATIONALITY = 'سعودي|كويتي|مصري|سوري|اردني|عراقي|يمني|مغربي|جزائري|تونسي|ليبي|سوداني|لبناني|فلسطيني|اماراتي|قطري|بحريني|عماني|هندي|باكستاني';
// A profession or a scholarly rank asserted as a fact about him.
const PROFESSION = 'اعلامي|صحفي|ممثل|مطرب|فنان|لاعب|طبيب|مهندس|محامي|رجل اعمال|استاذ جامعي|داعيه|مفتي الديار|رئيس الهيئه|عضو هيئه كبار العلماء|من كبار العلماء|من علماء|عالم معاصر|شاعر';

/**
 * Does this sentence assert a biographical fact about a named person?
 *
 * The name must be there: «توفي رحمه الله» in a hadith narration is about somebody else entirely,
 * and a rule that fired on the words alone would refuse half of Islamic prose.
 */
function assertsIdentity(foldedText, namesAlternation) {
  if (!namesAlternation) return false;
  if (!new RegExp(namesAlternation, 'u').test(foldedText)) return false;
  return new RegExp('(?:' + DEATH_MARKERS + '|' + NATIONALITY + '|' + PROFESSION + ')', 'u').test(foldedText);
}

const RX = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * THE NAMES THIS DRAFT MAY NOT CREDIT — every registered person plus the surface the reader wrote,
 * minus everybody the pages in hand license.
 *
 * A ONE-WORD SURFACE NEEDS AN HONORIFIC IN FRONT OF IT, and that is not fastidiousness. «مسلم» is
 * the display form of الإمام مسلم and it is also every Muslim; «مالك» is an imam and an owner;
 * «الخميس» is a shaykh and it is Thursday. Policing those words bare would drop «وكل مسلم مصري أو
 * سعودي عليه كذا» as a fabricated biography. Behind «الإمام» they are the man, and that is exactly
 * how a draft that meant the man would have to write him.
 *
 * @returns {string} a regex source matching a policed name, or '' when nobody is policed
 */
function policedNamePattern(ctx) {
  const licensed = licensedSurfaces(ctx.sourceLicence);
  const multi = [];
  const single = [];
  const consider = (s) => {
    const f = fold(s || '');
    if (!f || licensed.has(f)) return;
    (f.includes(' ') ? multi : single).push(f);
  };
  for (const s of allPersonSurfaces()) consider(s);
  // The reader's own spelling. «طارق العلي» is in no roster — that is the whole point of the
  // incident — and a rule that only policed registered names would have let every word of it out.
  consider(ctx.entity);

  const order = (a, b) => b.length - a.length;
  const parts = [];
  if (multi.length) parts.push('(?<![ء-ي])(?:' + [...new Set(multi)].sort(order).map(RX).join('|') + ')(?![ء-ي])');
  if (single.length) parts.push('(?:' + TITLES + ')\\s+(?:' + [...new Set(single)].sort(order).map(RX).join('|') + ')(?![ء-ي])');
  return parts.length ? '(?:' + parts.join('|') + ')' : '';
}

/** Does this text credit a policed name with a صفة or a موقف? */
function creditsAPolicedName(foldedText, who) {
  if (!who) return false;
  const present = new RegExp(who, 'u');
  if (!present.test(foldedText)) return false;
  const verbs = '(?:' + SPEECH_VERBS + '|' + POSITION_VERBS + '|' + ALIGNMENT_VERBS + ')';
  // Both word orders, for the reason recorded below: Arabic puts the subject before the verb too.
  if (new RegExp(verbs + '\\s*' + who, 'u').test(foldedText)) return true;
  if (new RegExp(who + '\\s*' + verbs, 'u').test(foldedText)) return true;
  // A صفة needs no verb at all — «طارق العلي داعية وخطيب كويتي معروف من أهل العلم» is a sentence
  // of pure assertion — so the name being there with an attribute in the same sentence is enough.
  return new RegExp('(?:' + DEATH_MARKERS + '|' + NATIONALITY + '|' + PROFESSION
    + '|' + RANK_MARKERS + '|' + MADHHAB_ADOPTION + ')', 'u').test(foldedText);
}

/** Arabic quotation marks and the ASCII pair a normal keyboard produces. */
const QUOTED = /[«"']([^«»"']{12,})[»"']/u;

/**
 * WHAT THIS DRAFT CLAIMS THAT ITS EVIDENCE DOES NOT SUPPORT.
 *
 * @param {string} text          the drafted reply, before the reader sees any of it
 * @param {object} ctx
 *   entity            string — the surface the reader named, added to the roster alternation
 *   notDirectlyVerified boolean — no text OF HIS was verified for THIS issue
 *   searchProven      boolean — a search actually ran for his own corpus
 *   allowSourcedPosition boolean — a grade-C transmission («ذكر المصدر أن رأيه…») is permitted
 * @returns {string[]} problem codes; empty means the draft may be sent
 */
export function consistencyProblems(text, ctx = {}) {
  const t = fold(text || '');
  if (!t) return [];
  const problems = [];
  const names = entityNameAlternation(ctx.entity ? [ctx.entity] : []);
  const who = '(?:' + TITLES + (names ? '|' + names : '') + ')';

  if (ctx.notDirectlyVerified) {
    // SPEECH is never allowed without a verified text of his — not even as a sourced transmission,
    // because «ذكر المصدر أن ابن تيمية قال» still asserts a wording nobody verified.
    // BOTH WORD ORDERS. Arabic puts the subject before the verb too — «ابن تيمية قال» is the same
    // claim as «قال ابن تيمية», and a checker that only knows one of them is a checker the model
    // walks straight past. lib/policy/entities.js records the same lesson for its own frames.
    if (new RegExp('(?:' + SPEECH_VERBS + ')\\s*' + who, 'u').test(t)
      || new RegExp(who + '\\s*(?:' + SPEECH_VERBS + ')', 'u').test(t)) {
      problems.push(PROBLEM.SPEECH_WITHOUT_EVIDENCE);
    }
    // A POSITION may be transmitted at grade C — «ذكر موقع إسلام ويب أن ابن تيمية يرى…» — but only
    // when the caller says a sourced transmission is on the table AND the sentence actually names
    // the source it is transmitting from. A bare «يرى ابن تيمية» is the app's own assertion.
    //
    // WHEN THE CALLER SUPPLIES THE PUBLISHERS IT ACTUALLY FETCHED, naming one of them is required
    // rather than merely encouraged: «ذكر بعض المواقع» is a transmission frame with nobody in it,
    // and a reader cannot check a source that was never named. This is what lets an encyclopedic
    // search REPORT a historical scholar's position instead of refusing to say anything about him
    // — which was the whole complaint: the app apologised where a documented transmission existed.
    const positional = new RegExp('(?:' + POSITION_VERBS + ')\\s*' + who, 'u').test(t)
      || new RegExp(who + '\\s*(?:' + POSITION_VERBS + ')', 'u').test(t);
    const transmitted = ctx.allowSourcedPosition && hasTransmissionFrame(t) && namesAPublisher(t, ctx);
    if (positional && !transmitted) {
      problems.push(PROBLEM.POSITION_WITHOUT_EVIDENCE);
    }
    // A QUOTATION is the strongest claim of all and needs a verified span. Only flagged when the
    // draft also names him, so quoting a Qur'anic verse or a hadith is untouched.
    if (QUOTED.test(t) && (names ? new RegExp(names, 'u').test(t) : false)) {
      problems.push(PROBLEM.QUOTE_WITHOUT_EVIDENCE);
    }
  }

  // WHO HE IS, WITHOUT A PAGE THAT SAYS SO. Deliberately OUTSIDE the `notDirectlyVerified` block:
  // a fabricated obituary is not a weaker form of attribution that a verified fatwa would excuse.
  // Having read a page of his rulings tells us nothing about whether he is alive, and the sentence
  // that killed him off is wrong either way. `identityVerified` is the only thing that licenses
  // it, and it means a source actually described him.
  if (!ctx.identityVerified && assertsIdentity(t, names)) {
    problems.push(PROBLEM.IDENTITY_WITHOUT_EVIDENCE);
  }

  // ── THE SOURCE-CLASS RULE ──────────────────────────────────────────────────
  //
  // ARMED BY THE CALLER SUPPLYING A LICENCE, AND NOT BY ITS CONTENTS. An ABSENT `sourceLicence`
  // means "this caller has not been wired to the rule yet"; an EMPTY ARRAY means "the pages in
  // hand license nobody", which is the Tariq al-Ali case and a real answer. Reading absence as
  // emptiness would refuse every existing caller's draft; reading emptiness as absence would
  // switch the rule off in exactly the case it was written for.
  if (Array.isArray(ctx.sourceLicence) && creditsAPolicedName(t, policedNamePattern(ctx))) {
    problems.push(PROBLEM.ATTRIBUTION_NOT_LICENSED);
  }

  // THE APP MAY NOT PREFER ONE QAWL OVER ANOTHER. Outside every other block on purpose: this is
  // not a claim about the named entity at all, so verifying HIS text excuses none of it. «الراجح
  // أنّ …» in the app's own voice is an act of ifta' whoever the question was about.
  if (tarjihWithoutEvidence(t, ctx)) {
    problems.push(PROBLEM.TARJIH_WITHOUT_EVIDENCE);
  }

  // «لم أقف» / «لم أجد» is a statement about work that was done. Without a search it is false.
  if (!ctx.searchProven && /لم اقف|لم اجد|لم اعثر|لا يوجد نص/u.test(t)) {
    problems.push(PROBLEM.NEGATION_WITHOUT_SEARCH);
  }
  return problems;
}

/** Does the sentence credit a SOURCE with the transmission, rather than asserting it outright? */
function hasTransmissionFrame(foldedText) {
  return /ذكر|نقل|ينقل|اورد|حكي|جاء في|ورد في|بحسب|وفق|افاد|وثق|منشور/u.test(foldedText);
}

/**
 * Is the intermediate source NAMED, so the reader can go and check it?
 *
 * When the caller passes no publisher list there is nothing to check against and a transmission
 * frame alone has to do. When it passes the publishers it actually fetched, one of them must
 * appear: a frame with no name in it — «ذكر بعض المواقع» — cites nothing.
 */
function namesAPublisher(foldedText, ctx) {
  const list = (ctx.transmissionPublishers || []).map((p) => fold(String(p || ''))).filter(Boolean);
  if (!list.length) return true;
  return list.some((p) => foldedText.includes(p));
}

/**
 * THE REPLACEMENT WHEN THE DRAFT IS DROPPED.
 *
 * It states exactly what is and is not available, makes no religious claim, and does NOT say we
 * found nothing of his — because in this branch nothing of his was searched.
 */
// IT MAKES NO CLAIM ABOUT WHAT EXISTS. It says what this reply may not do, which is a fact about
// us. Saying «لم أقف على نصٍّ له» here would be the very negation-without-search this module
// refuses, and a replacement that breaks the rule it enforces is not a replacement.
//
// ── AND IT NO LONGER CALLS ANYBODY «هذا العالِم» ──────────────────────────────
// MEASURED: this exact sentence was served for «ما رأي خالد عبدالرحمن في قصر الصلاة؟» — a singer —
// and for «ما رأي طارق العلي في أحكام العدة؟» — a comic actor. The refusal withheld the fatwa and
// granted the standing in the same breath, and the standing is the more consequential of the two:
// a reader who is told «I do not attribute a position to THIS SCHOLAR» has been told he is one.
//
// The subject of the sentence is now the ATTRIBUTION, which is a fact about this reply, instead of
// the man, which is a fact we did not establish. It therefore holds whatever the name turns out to
// be — registered scholar, unknown name, or a name no page anywhere carries — which is exactly why
// it may be emitted before any of that is known.
export const NO_ATTRIBUTION_AVAILABLE =
  'لا أنسبُ قولًا في هذه المسألة إلى أحدٍ ما لم أتحقّقْ من نصٍّ له فيها، ولم يتحقّقْ لي ذلك في هذا الجواب. '
  + 'وأستطيع أن أعرض لك حكمَ المسألة نفسِها من مصادرها الموثَّقة، أو أنقلَ ما تذكره المصادرُ عن هذا الاسم منسوبًا إليها لا إليه — فاختر ما تريد.';

// ── THE GATE READS THE DRAFT, NOT THE PLAN ───────────────────────────────────
//
// `consistencyProblems` judges a whole reply, and the handler's answer to a problem was to drop
// the whole reply. That is right when the offending attribution IS the answer — the reader asked
// what Ibn Taymiyyah held, and a reply that credits him without evidence has nothing left once
// the credit is removed. It is far too blunt when the attribution is one incidental sentence in
// an otherwise sourced answer: the reader loses a correct ruling because of a clause.
//
// AND THE GATE WAS ARMED FROM THE WRONG PLACE. It ran only when the PLAN said this was an
// attribution request. A draft that names a scholar the reader never asked about — the model
// reaching for authority on its own — was not an attribution request by the plan and met no gate
// at all. What may be said about a man is a property of the TEXT GOING OUT, not of the question
// that prompted it.
const SENTENCE_SPLIT = /(?<=[.!؟?])\s+|\n+/u;

/**
 * Judge a draft sentence by sentence.
 *
 * @param {string} text the drafted reply
 * @param {object} ctx  as consistencyProblems, plus:
 *   subjectEntity  string — the man the READER asked about. An offence in a sentence naming him
 *                  is the substance of the answer, so the whole draft goes.
 * @returns {{text:string, problems:string[], droppedSentences:string[], dropWhole:boolean}}
 */
export function screenDraft(text, ctx = {}) {
  const raw = String(text || '');
  if (!raw.trim()) return { text: '', problems: [], droppedSentences: [], dropWhole: false };

  const whole = consistencyProblems(raw, ctx);
  if (!whole.length) return { text: raw, problems: [], droppedSentences: [], dropWhole: false };

  const sentences = raw.split(SENTENCE_SPLIT).filter((s) => s.trim());
  const subject = fold(String(ctx.subjectEntity || ''));
  const kept = [];
  const dropped = [];
  const problems = new Set();
  let dropWhole = false;

  for (const s of sentences) {
    const p = consistencyProblems(s, ctx);
    if (!p.length) { kept.push(s); continue; }
    p.forEach((x) => problems.add(x));
    dropped.push(s);
    // IS THIS THE ANSWER, OR AN ASIDE? If the offending sentence names the very man the reader
    // asked about, trimming it leaves a reply that answers a question nobody asked while quietly
    // dropping the one that was. That is not a repair; it is a different failure.
    if (subject && fold(s).includes(subject)) dropWhole = true;
  }

  // A draft that offends as a WHOLE but in no single sentence is one where the attribution is
  // spread across sentences — «وقد أفتى في هذا. قال إن الأمر واسع.» Neither half is safe to keep.
  if (!dropped.length) dropWhole = true;
  // Nothing survived, so there is nothing to send but the replacement.
  if (!kept.length) dropWhole = true;

  return {
    text: dropWhole ? '' : kept.join(' '),
    problems: [...problems].length ? [...problems] : whole,
    droppedSentences: dropped,
    dropWhole,
  };
}

/** The wording when the ceiling, not the evidence, is what stopped the search. */
export const SEARCH_NOT_COMPLETED =
  'تعذّر استكمالُ البحث ضمن الحدود التشغيلية لخدمة عزك، فلم أستوفِ هذه المسألة بحثًا. '
  + 'أعِدْ سؤالي عنها لاحقًا.';
