// lib/policy/core.js
// THE SHARED, VERSIONED POLICY CORE. One table, two consumers.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// Until now the legacy route in api/ask.js and the ledger state machine in lib/ledger/ decided
// what a child may be told in two entirely different ways: the legacy route decided it in a
// prompt shipped inside index.html, and the ledger route did not decide it at all. A prompt is
// not a guarantee — it is a request, and the request is granted by the same model whose output
// it is meant to bound. So the DECISIONS move here, into data and pure functions, and both paths
// read them. What stays in the prompt is tone.
//
// ── WHAT MAY LIVE IN THIS MODULE, AND WHAT MAY NOT ───────────────────────────
// May: data tables, JSON-shaped schemas, pure deterministic evaluators, a stateless router.
// May NOT: an answer engine, a retrieval engine, drafting, ledger state, legacy RAG state. This
// module performs no I/O, holds no mutable state, and never sees a reader's identity.
//
// ── THE ONE RULE ABOUT REGEXES ───────────────────────────────────────────────
// A single keyword may never block a topic. «ما حكم قتل النمل؟» is a fiqh question that a child
// is entitled to an answer to, and a rule that blocked it on the word «قتل» would be a rule that
// makes the app useless and unsafe at the same time — unsafe because a blanket block teaches
// nobody anything and sends the child to a worse source. So the grave-hazard classes below are
// CONJUNCTIONS: an action AND a material AND, where it matters, an intent. Everything else is
// classified by what the question is about, not by a word it happens to contain.

import {
  POLICY_VERSION, SYNONYM_TABLE_VERSION, NORMALIZATION_VERSION, REGISTRY_VERSION, versions,
} from './version.js';
import { fold } from './entities.js';

export { POLICY_VERSION, SYNONYM_TABLE_VERSION, NORMALIZATION_VERSION, REGISTRY_VERSION, versions };

// ── the vocabularies ─────────────────────────────────────────────────────────

export const AUDIENCE_BANDS = Object.freeze(['young', 'teen', 'adult', 'unknown']);

export const AUDIENCE_SOURCES = Object.freeze(['account_profile', 'verified_session', 'unknown']);

export const TOPIC_CLASSES = Object.freeze([
  // religious
  'sharia_ruling', 'tafsir', 'hadith', 'scholar_position', 'quote_verification',
  'biography', 'polemic',
  // ordinary life
  'general_knowledge', 'simple_crafts', 'hygiene_habits', 'nature_animals',
  'general_manners', 'personal_care_low_risk', 'schoolwork',
  // health
  'health_general', 'health_dosage', 'health_symptoms',
  // bodies and growing up
  'puberty_education', 'sexual_explicit',
  // danger
  'hazardous_chemistry', 'self_harm', 'weapons_explosives',
  // the app itself
  'app',
]);

export const SOURCE_POLICIES = Object.freeze([
  'LOCAL_FROZEN', 'SHARIA_CLOSED_RAG', 'GENERAL_CHILD_BENIGN',
  'GENERAL_HEALTH_INTERIM', 'SAFETY_REDIRECT',
]);

// THE REVIEWED BENIGN LIST. Small, and it does not grow by itself. Every entry is a topic where
// a short, age-appropriate answer is both useful and low-consequence, and where being refused
// teaches a child that the app is not for them.
export const GENERAL_CHILD_BENIGN = Object.freeze([
  'simple_crafts',
  'hygiene_habits',
  'nature_animals',
  'general_manners',
  'personal_care_low_risk',
]);

// ── the topic x audience matrix ──────────────────────────────────────────────
//
// EVERY CELL IS WRITTEN OUT. A missing cell is an unreviewed decision, and the lookup below
// refuses rather than inventing one — `driftProblems()` fails the build if the table is not total.
//
// outcome:  ALLOW | ALLOW_LIMITED | SAFETY_REDIRECT | REFER_ADULT
// The floor and the rubric are applied AFTER a draft exists; this table decides only what may
// be attempted at all.
const A = (outcome, sourcePolicy, extra = {}) => Object.freeze({ outcome, sourcePolicy, ...extra });

const RELIGIOUS = {
  young: A('ALLOW', 'SHARIA_CLOSED_RAG'),
  teen: A('ALLOW', 'SHARIA_CLOSED_RAG'),
  adult: A('ALLOW', 'SHARIA_CLOSED_RAG'),
  unknown: A('ALLOW', 'SHARIA_CLOSED_RAG'),
};
const BENIGN = {
  young: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
  teen: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
  adult: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
  unknown: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
};
// A grave hazard is a redirect for EVERYBODY. An adult asking how to make chlorine gas at home
// is not a different question because he is an adult.
const HAZARD = {
  young: A('SAFETY_REDIRECT', 'SAFETY_REDIRECT', { beforeSearch: true }),
  teen: A('SAFETY_REDIRECT', 'SAFETY_REDIRECT', { beforeSearch: true }),
  adult: A('SAFETY_REDIRECT', 'SAFETY_REDIRECT', { beforeSearch: true }),
  unknown: A('SAFETY_REDIRECT', 'SAFETY_REDIRECT', { beforeSearch: true }),
};

const MATRIX = Object.freeze({
  sharia_ruling: RELIGIOUS,
  tafsir: RELIGIOUS,
  hadith: RELIGIOUS,
  scholar_position: RELIGIOUS,
  quote_verification: RELIGIOUS,
  biography: RELIGIOUS,
  // Polemic with a child is not a debate the child wins; it is a debate they did not ask to be in.
  polemic: {
    young: A('ALLOW_LIMITED', 'SHARIA_CLOSED_RAG', { requireAdultGuidance: true }),
    teen: A('ALLOW', 'SHARIA_CLOSED_RAG'),
    adult: A('ALLOW', 'SHARIA_CLOSED_RAG'),
    unknown: A('ALLOW', 'SHARIA_CLOSED_RAG'),
  },

  general_knowledge: {
    young: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
    teen: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
    adult: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
    unknown: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
  },
  simple_crafts: BENIGN,
  hygiene_habits: BENIGN,
  nature_animals: BENIGN,
  general_manners: BENIGN,
  personal_care_low_risk: BENIGN,
  schoolwork: BENIGN,

  // Health splits three ways, and the split is the whole point of the interim policy.
  health_general: {
    young: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM', { requireAdultGuidance: true }),
    teen: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM'),
    adult: A('ALLOW', 'GENERAL_HEALTH_INTERIM'),
    unknown: A('ALLOW', 'GENERAL_HEALTH_INTERIM'),
  },
  // THE HARD STOP IS CHILD-SCOPED, ON PURPOSE. RFC v0.5-R2 §10's interim health rule is written
  // about children — a dose for a child is the case where a wrong number does the most harm and
  // where the reader has the least ability to sanity-check it. Extending REFER_ADULT to adults
  // would change what an adult reader gets today, and "legacy adult regression = 0" is one of
  // this RFC's own success conditions. So an adult keeps the existing path; the deterministic
  // dosage ban in lib/policy/age.js still applies to the ANSWER on every health topic.
  health_dosage: {
    young: A('REFER_ADULT', 'GENERAL_HEALTH_INTERIM', { requireAdultGuidance: true }),
    teen: A('REFER_ADULT', 'GENERAL_HEALTH_INTERIM', { requireAdultGuidance: true }),
    adult: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM'),
    unknown: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM'),
  },
  health_symptoms: {
    young: A('REFER_ADULT', 'GENERAL_HEALTH_INTERIM', { requireAdultGuidance: true }),
    // A teenager describing symptoms gets a bounded answer and a person to tell, not a wall.
    teen: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM', { requireAdultGuidance: true }),
    adult: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM'),
    unknown: A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM'),
  },

  // A child who asks why their voice is changing has asked a biology question. Blocking it does
  // not keep them innocent; it sends them to a search engine.
  puberty_education: {
    young: A('ALLOW_LIMITED', 'GENERAL_CHILD_BENIGN', { requireAdultGuidance: true }),
    teen: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
    adult: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
    unknown: A('ALLOW', 'GENERAL_CHILD_BENIGN'),
  },
  sexual_explicit: {
    young: A('ALLOW_LIMITED', 'GENERAL_CHILD_BENIGN', { stripExplicit: true, requireAdultGuidance: true }),
    teen: A('ALLOW_LIMITED', 'SHARIA_CLOSED_RAG', { stripExplicit: true }),
    adult: A('ALLOW', 'SHARIA_CLOSED_RAG'),
    unknown: A('ALLOW', 'SHARIA_CLOSED_RAG'),
  },

  hazardous_chemistry: HAZARD,
  self_harm: HAZARD,
  weapons_explosives: HAZARD,

  app: {
    young: A('ALLOW', 'LOCAL_FROZEN'),
    teen: A('ALLOW', 'LOCAL_FROZEN'),
    adult: A('ALLOW', 'LOCAL_FROZEN'),
    unknown: A('ALLOW', 'LOCAL_FROZEN'),
  },
});

// DENY BY DEFAULT. An unknown topic class is a topic nobody reviewed, and the safe reading of
// "nobody reviewed this" is not "allow".
const UNKNOWN_CELL = A('ALLOW_LIMITED', 'GENERAL_HEALTH_INTERIM', { requireAdultGuidance: true, unreviewed: true });

/** The reviewed cell for a topic and a band. Never returns undefined. */
export function matrix(topicClass, audienceBand) {
  const row = MATRIX[topicClass];
  const band = AUDIENCE_BANDS.includes(audienceBand) ? audienceBand : 'unknown';
  if (!row) return UNKNOWN_CELL;
  return row[band] || UNKNOWN_CELL;
}

// ── the topic classifier ─────────────────────────────────────────────────────
//
// CONJUNCTIONS, NOT KEYWORDS. Each hazard rule needs an ACTION and a MATERIAL together. This is
// what lets «ما حكم قتل النمل؟» be a fiqh question and «كيف أخلط مواد التنظيف عشان تسوي فوران؟»
// be a redirect, without either decision resting on a single word.

const has = (t, list) => list.some((w) => t.includes(fold(w)));

const MIX_ACTIONS = ['اخلط', 'اخلطي', 'خلط', 'امزج', 'مزج', 'اسوي', 'تسوي', 'اصنع', 'تفاعل', 'حط مع'];
const HAZARD_MATERIALS = ['مواد التنظيف', 'كلور', 'الكلور', 'مبيض', 'كلوروكس', 'حمض', 'امونيا', 'نشادر',
  'ديتول', 'فلاش', 'مبيد', 'بنزين', 'كيروسين'];
const HAZARD_EFFECTS = ['فوران', 'انفجار', 'ينفجر', 'دخان', 'غاز', 'حريق', 'يشتعل'];

const WEAPON_WORDS = ['متفجر', 'قنبله', 'مسدس', 'بارود', 'ديناميت', 'سلاح ناري'];
const SELF_HARM = ['انتحر', 'الانتحار', 'اقتل نفسي', 'اؤذي نفسي', 'اجرح نفسي', 'اذيه نفسي'];

const DOSAGE_WORDS = ['كم حبه', 'كم حبة', 'جرعه', 'الجرعه', 'ملغم', 'ملجم', 'ملعقه دواء', 'كم مره اعطي', 'كم قرص'];
const MEDICINE_WORDS = ['بنادول', 'دواء', 'مضاد حيوي', 'شراب الحراره', 'حبوب', 'اقراص', 'ابر', 'مسكن'];
const SYMPTOM_WORDS = ['حراره', 'سخونه', 'يستفرغ', 'اسهال', 'الم في', 'طفح', 'كحه', 'تشنج'];
const HEALTH_GENERAL = ['صحه', 'تغذيه', 'اكل صحي', 'رياضه', 'نوم صحي', 'فيتامين'];

const PERSONAL_CARE = ['ماسك', 'مرطب', 'شفايف', 'الشفايف', 'شعري', 'بشرتي', 'اظافر', 'كريم', 'ترطيب', 'عنايه'];
const CRAFTS = ['اسوي شغل', 'اشغال يدويه', 'ورق ملون', 'صلصال', 'رسمه', 'اقص واصق', 'لعبه اسويها'];
const HYGIENE = ['اغسل يدي', 'نظافه', 'اسنان', 'استحمام', 'الوضوء الصحي', 'شعر نظيف'];
const NATURE = ['نمله', 'النمل', 'قطه', 'كلب', 'طيور', 'حيوان', 'شجره', 'نبات', 'بحر', 'سماء', 'نجوم'];
const MANNERS = ['اداب', 'احترام', 'اعتذار', 'الكذب', 'الصدق', 'اشارك', 'صديقي زعلان'];

const PUBERTY = ['يتغير صوت', 'صوت الولد', 'البلوغ', 'احتلام', 'الدوره الشهريه', 'شعر في جسمي', 'اطول واكبر'];
const SEX_EXPLICIT = ['العلاقه الجنسيه', 'الجنس', 'جماع', 'ممارسه', 'تفاصيل جنسيه'];
const EXPLICIT_DETAIL = ['بالتفصيل', 'تفاصيل', 'كيف تتم', 'اشرح لي كل'];

const SHARIA_MARKERS = ['ما حكم', 'حكم', 'يجوز', 'حرام', 'حلال', 'واجب', 'سنه', 'مكروه', 'فتوي', 'الشرع'];
const TAFSIR_MARKERS = ['معني قوله تعالي', 'تفسير', 'الايه', 'قوله تعالي'];
const HADITH_MARKERS = ['حديث', 'الحديث', 'رواه', 'صحيح البخاري', 'تخريج', 'اشرح حديث'];
const BIOGRAPHY = ['من هو', 'ترجمه', 'سيره', 'متي ولد', 'متي توفي'];
const POLEMIC = ['شبهه', 'الرد علي', 'خالف اهل السنه', 'مبتدع', 'تكفير'];
const APP_MARKERS = ['التطبيق', 'عزك', 'الاعدادات', 'كيف استخدم البرنامج'];

/**
 * WHAT IS THIS QUESTION ABOUT?
 *
 * Ordered most-dangerous-first, then most-specific-first. The religious classes are checked
 * BEFORE the ordinary-life ones so «ما حكم قتل النمل؟» is a ruling rather than an animal
 * question — the reader asked for a ruling and is entitled to one.
 *
 * @param {string} text the reader's own words
 * @param {object} [ir] optional entity IR, so a question that named a scholar is classified by
 *                      that fact rather than by its vocabulary
 * @returns {string} one of TOPIC_CLASSES
 */
export function classifyTopic(text, ir = null) {
  const t = fold(text);
  if (!t) return 'general_knowledge';

  // 1. GRAVE HAZARD — conjunctions only.
  if (has(t, SELF_HARM)) return 'self_harm';
  if (has(t, WEAPON_WORDS) && has(t, ['كيف', 'اسوي', 'اصنع', 'تركيب'])) return 'weapons_explosives';
  if (has(t, MIX_ACTIONS) && (has(t, HAZARD_MATERIALS) || has(t, HAZARD_EFFECTS))
    && (has(t, HAZARD_MATERIALS) || has(t, ['كيماوي', 'كيميائي']))) {
    return 'hazardous_chemistry';
  }

  // 2. THE IR WINS OVER VOCABULARY. A named authority makes this a scholar-position question
  //    whatever else the sentence contains.
  if (ir && ir.claimRelation === 'QUOTE_VERIFICATION') return 'quote_verification';
  if (ir && (ir.claimRelation === 'BY_ENTITY' || ir.claimRelation === 'BY_MADHHAB')) return 'scholar_position';
  if (ir && ir.claimRelation === 'ABOUT_ENTITY' && has(t, POLEMIC)) return 'polemic';
  if (ir && ir.claimRelation === 'ABOUT_ENTITY') return 'biography';

  // 3. HEALTH, most specific first. Dosage outranks everything else in health.
  if (has(t, DOSAGE_WORDS) || (has(t, MEDICINE_WORDS) && has(t, ['كم', 'اعطي', 'اخذ', 'جرعه']))) {
    return 'health_dosage';
  }
  if (has(t, SYMPTOM_WORDS) && has(t, ['ليش', 'ماذا افعل', 'ما السبب', 'عندي', 'عند اخوي', 'وش اسوي'])) {
    return 'health_symptoms';
  }

  // 4. RELIGIOUS.
  if (has(t, TAFSIR_MARKERS)) return 'tafsir';
  if (has(t, HADITH_MARKERS)) return 'hadith';
  if (has(t, POLEMIC)) return 'polemic';
  if (has(t, SHARIA_MARKERS)) return 'sharia_ruling';
  if (has(t, BIOGRAPHY)) return 'biography';

  // 5. GROWING UP.
  if (has(t, SEX_EXPLICIT)) {
    return has(t, EXPLICIT_DETAIL) ? 'sexual_explicit' : 'puberty_education';
  }
  if (has(t, PUBERTY)) return 'puberty_education';

  // 6. ORDINARY LIFE.
  if (has(t, PERSONAL_CARE)) return 'personal_care_low_risk';
  if (has(t, CRAFTS)) return 'simple_crafts';
  if (has(t, HYGIENE)) return 'hygiene_habits';
  if (has(t, NATURE)) return 'nature_animals';
  if (has(t, MANNERS)) return 'general_manners';
  if (has(t, HEALTH_GENERAL)) return 'health_general';
  if (has(t, APP_MARKERS)) return 'app';

  return 'general_knowledge';
}

// THE NARROW TRIAGE, AND WHY IT IS THE ONE THING ALLOWED BEFORE IR_BUILD.
//
// RFC v0.5-R2 §4 forbids AGE_ACCESS_POLICY from running before the question is understood. This
// is the deliberate exception, and it is kept narrow enough to be safe: it fires ONLY on the
// grave-hazard conjunctions above — an action AND a material, or an explicit self-harm phrase.
// It cannot fire on «قتل النمل», on «ماسك للشفايف», or on any question whose only offence is a
// word, because none of those satisfies a conjunction. If it returns '', nothing has been
// decided and the ordinary pipeline runs.
export function graveHazard(text) {
  const t = classifyTopic(text);
  return (t === 'self_harm' || t === 'weapons_explosives' || t === 'hazardous_chemistry') ? t : '';
}

// ── the child safety rubric ──────────────────────────────────────────────────
//
// APPLIED TO A DRAFT, DETERMINISTICALLY, AFTER THE MODEL HAS WRITTEN IT. The system prompt asks
// for a good answer; this decides whether it got one. Both are needed and neither is sufficient:
// a prompt cannot be a guarantee, and a rubric cannot make a cold answer warm.
export const CHILD_SAFETY_RUBRIC = Object.freeze({
  // Substances a child should not be told to put on their skin or in their mouth by an app.
  // Named because each is a MEASURED folk remedy that turns up in exactly these answers and each
  // one burns, sensitises or photosensitises.
  // Both the bare and the article-prefixed forms are listed. Arabic glues «ال» on, and the
  // matcher is whole-word, so «الزيوت العطرية» does NOT contain the token «زيوت عطريه» — the
  // article sits inside the phrase, not only in front of it.
  forbiddenSubstances: Object.freeze([
    'ليمون', 'الليمون', 'عصير ليمون', 'قرفه', 'القرفه',
    'زيت عطري', 'الزيت العطري', 'زيوت عطريه', 'الزيوت العطريه', 'زيوت العطريه',
    'خل', 'الخل', 'بيكربونات', 'صودا الخبز', 'ماء اكسجين', 'كحول', 'اسبرين',
  ]),
  // Actions that damage skin, especially a child's.
  forbiddenActions: Object.freeze([
    'افركي بقوه', 'افرك بقوه', 'السكر الخشن', 'فرشاه خشنه', 'ملح خشن', 'حكي بقوه',
  ]),
  // Anything that reads as a therapeutic instruction.
  dosagePatterns: Object.freeze([
    /\d+\s*(?:ملغم|ملجم|مل|حبه|حبات|قرص|اقراص|ملعقه|ملاعق)/u,
    /(?:مرتين|ثلاث مرات|اربع مرات|كل\s*\d+\s*ساعات?)\s*(?:يوميا|في اليوم)?/u,
    /(?:نصف|ربع|كامل)\s*(?:حبه|قرص)/u,
  ]),
  // A benign child answer carries no fiqh citation. A source card on "how do I make a lip balm"
  // dresses a craft tip as a religious verdict.
  forbiddenMarkup: Object.freeze([/<source\b/i, /<hadith\b/i, /<steps\b/i]),
  // What a good answer about putting something new on a body MUST contain.
  requiresAllergyCaution: Object.freeze(['حساسيه', 'حساسية', 'تحسس', 'جربي شوي', 'جرب شوي', 'جربيه على', 'اختبار بسيط']),
  requiresParentLoop: Object.freeze(['ماما', 'بابا', 'امك', 'ابوك', 'والدتك', 'والدك', 'اهلك', 'والديك']),
});

// ── the warm templates ───────────────────────────────────────────────────────
// A REDIRECT IS NOT A REFUSAL. Every one of these answers something, names why, and leaves the
// child with a next step that is a person rather than a wall.
export const WARM_HEALTH_REFERRAL =
  'أقدر أساعدك بمعلومة عامة، لكن الدواء ومقداره شيء يقرره الطبيب أو ماما وبابا، لأن كل جسم يختلف. '
  + 'قُل لماما أو بابا وهم يتصرفون، وإذا كان الوجع شديد أو مستمر فالدكتور هو الأصح.';

export const WARM_SAFETY_REDIRECT =
  'هذا شيء ما ينفع نجربه، لأن خلط بعض المواد يطلع منه غاز يأذي الصدر والعيون حتى لو ما بان شيء. '
  + 'إذا يعجبك التفاعل والفوران، في تجارب آمنة حلوة نسويها مع ماما أو بابا — أقدر أدلك على وحدة منها.';

export const WARM_ADULT_GUIDANCE =
  'هذا موضوع أحسن ما يكون شرحه من ماما أو بابا، لأنهم يعرفون كيف يشرحونه لك بالطريقة المناسبة لعمرك.';

export const WARM_PARENT_FOR_NEW_SUBSTANCE =
  'وقبل أي شيء جديد تحطينه على جسمك، خلي ماما تشوفه أول.';

// WHAT A CHILD GETS WHEN THE DRAFT IS DISCARDED. Not the chemistry redirect — that answers a
// question they did not ask and reads as an accusation — and not silence. It says the honest
// thing: this one needs a grown-up beside you, and here is what to ask them.
export const WARM_CHILD_FALLBACK =
  'خلّينا نسويها صح مع ماما أو بابا، لأن بعض الأشياء تحتاج أحد كبير يشوف المكونات معك أول. '
  + 'قُل لهم إنك تبغى شيء بسيط وآمن، وهم يساعدونك تختارونه سوا.';

export const WARM_TEMPLATES = Object.freeze({
  GENERAL_CHILD_BENIGN: WARM_CHILD_FALLBACK,
  GENERAL_HEALTH_INTERIM: WARM_HEALTH_REFERRAL,
  SAFETY_REDIRECT: WARM_SAFETY_REDIRECT,
  ADULT_GUIDANCE: WARM_ADULT_GUIDANCE,
  NEW_SUBSTANCE: WARM_PARENT_FOR_NEW_SUBSTANCE,
});

// ── living persons ───────────────────────────────────────────────────────────
//
// EZIK DOES NOT PASS A VERDICT ON A LIVING PERSON. Not takfīr, not tabdīʿ, not tafsīq, and not a
// reading of anybody's intentions. This is enforced in the claim, in the draft and in Gate 3 —
// not in a prompt — because a prompt-level ban on this is a ban the model may negotiate with.
export const LIVING_PERSON_VERDICTS = Object.freeze([
  'كافر', 'تكفير', 'مرتد', 'زنديق', 'مبتدع', 'تبديع', 'فاسق', 'تفسيق', 'ضال', 'منافق',
  'يقصد الشر', 'نيته', 'في قلبه',
]);

export const LIVING_PERSON_ALLOWED = Object.freeze([
  'general_principle',        // the rule, stated without applying it to him
  'his_own_words_primary',    // what he himself said, from a primary source
  'official_body_decision',   // a qualified body's decision, attributed to that body
  'refer_to_scholars',        // pointing the reader to people who may apply it
]);

/** Does this sentence pass a personal verdict on a named living person? */
export function violatesLivingPersonPolicy(text, { livingPersonNamed } = {}) {
  if (!livingPersonNamed) return false;
  const t = fold(text);
  return LIVING_PERSON_VERDICTS.some((w) => t.includes(fold(w)));
}

// ── drift ────────────────────────────────────────────────────────────────────
/**
 * Problems that mean this core is internally inconsistent or has drifted from its version
 * spine. Returns strings so a gate can print them; empty array = conformant.
 *
 * THIS IS EXECUTABLE, NOT A COMMENT. The failure it exists to catch — one consumer holding an
 * older copy of the matrix — is invisible to code review and obvious to a total-function check.
 */
export function driftProblems() {
  const problems = [];
  const v = versions();
  if (v.policyVersion !== POLICY_VERSION) problems.push('policy version disagrees with its own spine');
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== 'string' || !val) problems.push('version ' + k + ' is not declared');
  }
  // The matrix must be TOTAL over the declared vocabularies.
  for (const t of TOPIC_CLASSES) {
    if (!MATRIX[t]) { problems.push('topic class has no matrix row: ' + t); continue; }
    for (const b of AUDIENCE_BANDS) {
      const cell = MATRIX[t][b];
      if (!cell) problems.push('matrix cell missing: ' + t + ' x ' + b);
      else if (!SOURCE_POLICIES.includes(cell.sourcePolicy)) {
        problems.push('unknown source policy in ' + t + ' x ' + b + ': ' + cell.sourcePolicy);
      }
    }
  }
  // Every benign topic must exist and must actually be benign for a child.
  for (const t of GENERAL_CHILD_BENIGN) {
    if (!TOPIC_CLASSES.includes(t)) problems.push('benign list names an unknown topic: ' + t);
    else if (matrix(t, 'young').outcome !== 'ALLOW') problems.push('benign topic is not ALLOW for young: ' + t);
  }
  // A hazard must never be allowed to anybody.
  for (const t of ['hazardous_chemistry', 'self_harm', 'weapons_explosives']) {
    for (const b of AUDIENCE_BANDS) {
      if (matrix(t, b).outcome !== 'SAFETY_REDIRECT') problems.push('hazard is not redirected: ' + t + ' x ' + b);
    }
  }
  return problems;
}
