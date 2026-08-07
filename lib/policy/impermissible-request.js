// lib/policy/impermissible-request.js
// A REQUEST FOR THE FORBIDDEN IS STOPPED AND COUNSELLED — pure, deterministic, no I/O.
//
// ── WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT ────────────────────────────
// س٦٫٤ of the owner's spec: the live-world path answers the weather and the price of a barrel
// from an open search, and its ONLY restraint is the sharia filter. A reader who asks that path
// for a song, a film or pornography is stopped and given counsel, for EVERY band.
//
// IT DOES NOT ISSUE A RULING, AND THAT IS THE HARDEST LINE IN THE FILE. «عزك ناقلٌ لا مفتٍ» is
// the constitution of this app: it transmits rulings from vetted pages and never pronounces one
// of its own. So this module may not say «هذا حرام» — that is a fatwa, from a regex, with no
// source behind it, which is precisely the failure every gate in this repository exists to
// prevent. What it says instead is a statement about ITSELF: this is not something I help with.
// And it hands the reader the ruling question back as a SEPARATE question the app can actually
// answer properly — from the approved sources, with a card. That is the same move
// buildWorldSearchInstruction() already makes when a world answer drifts towards a ruling
// («فإنِ انجرَّ السؤالُ إلى حكمٍ شرعيّ، فقلْ إنّ ذلك سؤالٌ مستقلٌّ…»), and it is deliberate that
// the two agree.
//
// ── THE TONE IS AN OWNER SPEC, NOT A CHOICE ──────────────────────────────────
// «بنفس أسلوب الرفض والنصح القائم في التطبيق (المالك جرّبه واستحسنه — ابنِ على قوالب lib/policy
// ولا تخترع نبرة جديدة)». So the wording below is built on the shape of WARM_SAFETY_REDIRECT in
// ./core.js, which is the template the owner tried and approved, and it keeps that template's
// three moves in that order:
//
//   1. a plain «this one we don't do», with no accusation and no lecture;
//   2. WHY, in one concrete clause — here, that the app transmits and does not rule;
//   3. an ALTERNATIVE that answers what the reader actually wanted, offered rather than withheld.
//
// core.js says it outright: «A REDIRECT IS NOT A REFUSAL. Every one of these answers something,
// names why, and leaves the child with a next step that is a person rather than a wall.» Move 3
// is not decoration; a bare «لا» is the thing lib/policy/age.js's `isColdRefusal` already treats
// as a DEFECT rather than as safety.
//
// ── AND IT IS A CONJUNCTION, LIKE EVERY OTHER RULE OF THIS KIND HERE ─────────
// core.js's one rule about regexes: a single keyword may never block a topic. «ما حكم الأغاني؟»
// is a fiqh question a reader is entitled to a sourced answer to, and a filter that fired on the
// word «أغاني» would take it away. MEASURED: classifyRoute() already separates the two — a
// REQUEST («ابغى أغنية حلوة», «رشح لي فلم») is GEN, while «ما حكم الأغاني؟» and «ما حكم مشاهدة
// الأفلام؟» are DEEN and never reach this path at all. This module holds that line a second time,
// in its own right, by requiring a REQUEST SHAPE and a FORBIDDEN OBJECT together.

import { fold } from './entities.js';

export const IMPERMISSIBLE_KINDS = Object.freeze(['pornography', 'music', 'film']);

const has = (t, list) => list.some((w) => t.includes(fold(w)));

// Whole-word matching with the proclitics Arabic glues on, the same helper core.js uses and for
// the same measured reason: a short stem matched as a substring turns up inside unrelated words.
const PROCLITICS = ['', 'و', 'ف', 'ب', 'ل', 'ال', 'وال', 'فال', 'بال', 'لل', 'ولل', 'وب', 'فب'];
const hasWord = (t, list) => {
  const toks = t.split(/[^\p{L}]+/u).filter(Boolean);
  const words = list.map(fold);
  return toks.some((tok) => words.some((w) => PROCLITICS.some((p) => tok === p + w)));
};

// ── (a) WHAT IS BEING ASKED FOR ──────────────────────────────────────────────
// The shapes a reader actually uses to ask for a thing, rather than to ask ABOUT it. «ما حكم…»,
// «ليش…», «هل يجوز…» are absent by construction: none of them is a request, and every one of
// them is a question this app answers from its sources.
const REQUEST_SHAPES = [
  'ابغي', 'ابغا', 'ابي', 'اريد', 'ودي', 'بغيت',
  'رشح لي', 'رشحلي', 'اقترح لي', 'اقترح علي', 'دلني', 'دليني',
  'عطني', 'اعطني', 'جيب لي', 'هات لي', 'ارسل لي', 'نزل لي', 'حمل لي',
  'شغل لي', 'سمعني', 'وريني', 'خلني اشوف', 'خلني اسمع',
  'وين الاقي', 'وين احصل', 'من وين اجيب', 'ابحث لي عن', 'دور لي على',
  'رابط', 'لينك', 'موقع فيه',
];

// ── (b) THE THING ASKED FOR ──────────────────────────────────────────────────
const MUSIC = ['اغنيه', 'اغنية', 'اغاني', 'اغنيات', 'موسيقي', 'موسيقا', 'كليب', 'مهرجانات', 'راب', 'طرب', 'شيله'];
const FILM = ['فيلم', 'افلام', 'مسلسل', 'مسلسلات', 'سينما', 'نتفلكس', 'netflix', 'انمي'];

// «فلم» IS THE KUWAITI SPELLING THE OWNER USED, AND IT IS ALSO A CLASSICAL WORD.
// «فلم أجد جوابًا» is «ف» + «لم» — "and I did not find" — and it tokenises to exactly «فلم». The
// conjunction alone does not save it: «أبغى كتابًا فلم أجده» carries a request shape and this
// token in one sentence. So the negation sense is excluded by the one thing that separates them
// reliably: what FOLLOWS. «لم» governs a jussive verb, which in Arabic begins with أ/ي/ت/ن —
// «فلم أجد»، «فلم يعجبني» — and a film is never described by a verb in that position
// («فلم حلو»، «فلم وثائقي»). Narrow, and both readings are tested in the gate.
//
// NO `\b` IN THIS PATTERN, AND THE FIRST VERSION HAD ONE. JavaScript's word boundary is defined
// on [A-Za-z0-9_] even under the `u` flag, so between a space and «ف» there are two non-word
// characters and NO boundary — `\bفلم` cannot match anywhere in Arabic text. MEASURED: with the
// `\b` in place the exclusion was entirely inert and «أبغى كتابًا فلم أجده في المكتبة» was
// classified as a request for a film. The boundary is spelled out as "start, or a non-letter".
const FILM_AMBIGUOUS = ['فلم'];
const FILM_AS_NEGATION = /(?:^|[^\p{L}])فلم\s+[ايتن]/u;

// ── (c) AND THE ONE THAT NEEDS NO REQUEST SHAPE ──────────────────────────────
// Pornography is not asked ABOUT on this path. «ما حكم الأفلام الإباحية؟» is a ruling question,
// it is DEEN by the router's own predicate, and it never arrives here — MEASURED, alongside the
// rest. What arrives here carrying this vocabulary is a request, and requiring a polite request
// shape before acting on it would be a filter defeated by dropping the please.
const PORNOGRAPHY = ['اباحي', 'اباحيه', 'اباحيات', 'الاباحيه', 'بورن', 'porn', 'سكس', 'xxx', 'خلاعه', 'عاهره', 'دعاره'];

/**
 * IS THIS A REQUEST FOR SOMETHING THE APP WILL NOT FETCH?
 *
 * @param {string} raw the reader's own words
 * @returns {{blocked:boolean, kind:string, matched:string}}
 *          `kind` is one of IMPERMISSIBLE_KINDS, or '' — it selects nothing in the counsel below
 *          and exists so a log line and a test can say WHICH rule fired.
 */
export function classifyImpermissibleRequest(raw) {
  const t = fold(raw || '');
  if (!t) return { blocked: false, kind: '', matched: '' };

  // Ordered most-serious-first, and the only one that stands without a request shape.
  if (has(t, PORNOGRAPHY) || hasWord(t, ['سكس'])) {
    return { blocked: true, kind: 'pornography', matched: 'pornography' };
  }

  const asking = has(t, REQUEST_SHAPES);
  if (!asking) return { blocked: false, kind: '', matched: '' };

  if (has(t, MUSIC)) return { blocked: true, kind: 'music', matched: 'request + music' };
  if (has(t, FILM)) return { blocked: true, kind: 'film', matched: 'request + film' };
  if (hasWord(t, FILM_AMBIGUOUS) && !FILM_AS_NEGATION.test(t)) {
    return { blocked: true, kind: 'film', matched: 'request + film' };
  }

  return { blocked: false, kind: '', matched: '' };
}

// ── THE COUNSEL ──────────────────────────────────────────────────────────────
//
// Move 1 and move 2 are the SAME SENTENCES for every band, and that is the owner's «لكل الأعمار»
// taken literally: an adult asking for this has not asked a different question by being an adult,
// which is the reasoning core.js already applies to the grave hazards. What varies is move 3,
// because the alternative is the part that has to fit the reader — WARM_SAFETY_REDIRECT ends a
// child at «مع ماما أو بابا», and ending an adult there would be the app talking down to him.

// 1 + 2: the plain statement, and why — a fact about this app, never a verdict on the reader.
const NOT_A_MUFTI =
  'هذا مما لا أُعين عليه، ولا هو من عمل هذا التطبيق. '
  + 'وأنا ناقلٌ لا مفتٍ، فلا أُطلق عليه حكمًا من عندي؛ '
  + 'فإن أردتَ حكمَه بعينه فذاك سؤالٌ مستقلٌّ، اسألْني إيّاه أنقلْ لك جوابَ أهل العلم من مصدره.';

// 3: what the reader actually wanted, offered rather than withheld.
const INSTEAD_CHILD =
  'وإذا كنت تدوّر شيئًا تقضي فيه وقتك، أقدر أدلّك على قصصٍ وسِيَرٍ وبرامجَ نافعة — '
  + 'قل لي وش يعجبك ونختار سوا، وخلّ ماما أو بابا يشوفونه معك.';

const INSTEAD_ADULT =
  'وإن كنت تبحث عمّا تقضي به وقتك، أقدر أدلّك على قراءاتٍ وسِيَرٍ وبرامجَ نافعة — '
  + 'قل لي ما الذي يعجبك ونختار.';

/**
 * THE SENTENCE THE SERVER SENDS. One string, composed here rather than at the call site, for the
 * same reason lib/policy/referral-tail.js composes its own: a wording assembled at five call
 * sites is a wording that drifts at four of them.
 *
 * @param {string} band the POLICY band — 'young' | 'teen' | 'adult' | 'unknown'
 * @returns {string}
 */
export function impermissibleCounsel(band) {
  const child = band === 'young' || band === 'teen';
  return NOT_A_MUFTI + '\n\n' + (child ? INSTEAD_CHILD : INSTEAD_ADULT);
}

/**
 * Problems that mean this module contradicts the doctrine it is written under. Executable, so a
 * gate can print them; empty array = conformant.
 */
export function counselProblems() {
  const problems = [];
  // IT MAY NOT PRONOUNCE A RULING. The whole reason this file is allowed to exist.
  const VERDICTS = ['حرام', 'محرم', 'لا يجوز', 'يحرم', 'اثم', 'معصيه', 'كبيره من الكبائر'];
  for (const b of ['young', 'teen', 'adult', 'unknown']) {
    const text = fold(impermissibleCounsel(b));
    for (const v of VERDICTS) {
      if (text.includes(fold(v))) problems.push('the counsel pronounces a ruling (' + v + ') for band ' + b);
    }
    // AND IT MAY NOT BE A BARE WALL. age.js's `isColdRefusal` treats a refusal with no next step
    // as a defect; this asserts the next step is actually there.
    if (!/أقدر أدلّك/.test(impermissibleCounsel(b))) {
      problems.push('the counsel offers no alternative for band ' + b);
    }
  }
  // A child is ended at a person; an adult is not handed a child's ending.
  if (!/ماما أو بابا/.test(impermissibleCounsel('young'))) problems.push('a child is not left with a person');
  if (/ماما أو بابا/.test(impermissibleCounsel('adult'))) problems.push('an adult is handed a child\'s ending');
  return problems;
}
