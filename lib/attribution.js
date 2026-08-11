// lib/attribution.js
// THE ATTRIBUTION SAFETY GATE.
//
// THE RULE IT ENFORCES, in one line: an answer may not say that a named scholar held, chose,
// preferred or ruled anything unless a retrieved source BY THAT SCHOLAR, covering THAT question,
// is in hand — and unless the answer's own claims survive a comparison against it.
//
// WHY IT IS NOT ABOUT ONE SCHOLAR. It fires on the SHAPE of the question ("ما رأي فلان", "قال
// فلان", "هل أفتى فلان"), not on a name it recognises. A scholar the app has no source for is
// therefore refused, exactly like a scholar it does have one for but whose page does not answer
// the question. The registry below only decides WHERE to look first; it never decides whether the
// gate applies.
//
// WHY THE MODEL IS NOT TRUSTED WITH THIS. The defect this file exists to close was not a model
// that hedged badly — it was a model that produced a confident, fluent, and INVERTED fatwa for a
// named scholar with no source at all, on a question about whether a woman must abandon prayer
// and fasting. No prompt wording can be the guarantee there. The guarantee has to be code that
// refuses to emit the answer.

// ── NO CANNED REFUSAL LIVES HERE ANY MORE ────────────────────────────────────
// There used to be an exported constant on this line — one fixed sentence that became the
// answer to every attributed question the app could not immediately satisfy. It is DELETED,
// not merely unreferenced, because a ready-made fallback is an invitation: the next person to
// hit an awkward branch reaches for the string that is already there.
//
// What replaced it is in lib/ask-plan.js, and the difference is that neither replacement can
// ever be the whole reply:
//   * unattributedNote()   — one line appended AFTER a sourced answer, and only when a direct
//                            search of the scholar's own corpus actually ran and found nothing;
//   * NEEDS_SCHOLAR_NAME / NEEDS_MATERIAL — asked when nobody is identified, so no search has
//                            been performed and claiming one would be false.
// smart-retrieval-guard.cjs asserts the old string appears nowhere in the request path.
import { compareDurations, durationAcceptable } from './duration.js';
import {
  ATTRIBUTION_SPEECH_HEAD_ALT,
  isSacredAttributionCapture,
} from './policy/sacred-attribution.js';

// ── Normalisation ────────────────────────────────────────────────────────────
// Arabic punctuation lives inside the Arabic Unicode block, so it rides along on the last word:
// «هل أفتى الألباني بذلك؟» captured the name «الالباني بذلك؟». Strip it before anything else.
const AR_PUNCT = /[؀-؅،؛؞؟٪-٭۔۝«»]/g;
export function norm(s) {
  return String(s == null ? '' : s)
    .replace(AR_PUNCT, ' ')
    .replace(/[ً-ٰٟـۖ-ۭ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Who we can look up directly ──────────────────────────────────────────────
// A registry entry means "there is an official corpus for this scholar and it is the first place
// to look". Absence from this list does NOT exempt a question from the gate.
export const SCHOLARS = [
  {
    key: 'ibn-uthaymeen',
    display: 'محمد بن صالح العثيمين',
    host: 'binothaimeen.net',
    aliases: [
      'ابن عثيمين', 'بن عثيمين', 'العثيمين', 'عثيمين', 'ابن العثيمين',
      'محمد بن صالح العثيمين', 'محمد العثيمين', 'محمد بن صالح',
      'الشيخ ابن عثيمين', 'الشيخ العثيمين', 'ابن عثمين', 'ابن عثيمن',
    ].map(norm),
  },
];
export function lookupScholar(nameRaw) {
  const n = norm(nameRaw);
  if (!n) return null;
  for (const s of SCHOLARS) {
    for (const a of s.aliases) {
      if (n === a || n.includes(a)) return s;
    }
  }
  return null;
}

// ── Detection ────────────────────────────────────────────────────────────────
//
// ARABIC WORD BOUNDARIES, AND WHY \b CANNOT BE USED FOR THEM.
//
// JavaScript defines \b as a transition between \w and non-\w, and \w is [A-Za-z0-9_].
// Arabic letters are not in \w, so \b in an Arabic pattern marks the boundaries of the
// LATIN runs around the Arabic — which is to say it marks nothing useful and, worse, it
// reports a boundary in the middle of an Arabic word. Every trigger below was therefore
// matched as a bare substring.
//
// MEASURED ON PRODUCTION, 2026-08-03: «ما حكم بيع الذهب بالتقسيط؟» was answered with
// the attribution refusal of the day. The verb «ذهب» ("he went to the view that…")
// had matched INSIDE «الذهب» ("the gold"), so the question was read as asking what a
// scholar named «بالتقسيط» held. Every question about gold met the attribution refusal.
//
// It was never only «ذهب». «قال» sits inside «مقال» and «مقالة», «ذكر» inside «تذكر» and
// «مذكرة», «نص» inside «نصف» and «ينصح». The fix is one shared boundary, applied to each
// trigger: an Arabic letter may not sit immediately to the left of it, nor immediately to
// the right. Lookbehind and lookahead over the Arabic block do exactly that, and they say
// what is meant instead of borrowing a Latin approximation.
const AR = '\\u0600-\\u06FF';
// `W(x)` — x, standing as its own Arabic word.
const W = (alt) => '(?<![' + AR + '])(?:' + alt + ')(?![' + AR + '])';
// Attribution heads may be joined to the coordinating waw: «...، وقال ابن باز». The boundary
// belongs before that conjunction, not between it and the verb.
const AW = (alt) => '(?<![' + AR + '])(?:[وف])?(?:' + alt + ')(?![' + AR + '])';
// `WL(x)` — x with a LEFT boundary only. For triggers that legitimately glue to the word
// after them: «ينسب لابن تيمية» attaches the lām to the name, so a right boundary there
// would delete a real attribution rather than a false one.
const WL = (alt) => '(?<![' + AR + '])(?:' + alt + ')';

// Honorifics that introduce a person whose OPINION is being sought.
const TITLE_ALT = 'شيخ الاسلام|شيخ الإسلام|الشيخ|الشّيخ|شيخ|العلامه|العلامة|الامام|الإمام|الحافظ|الدكتور|د\\.|الفقيه|المفتي|سماحه|سماحة|فضيله|فضيلة';
const TITLE = WL(TITLE_ALT);
// Optional-title patterns can backtrack and hand the title itself to NAME (for example
// «قال الشيخ إن...»). Reuse the same title lexicon to reject that capture; the explicit
// BARE_TITLE branch below then classifies it as an unnamed attribution.
const BARE_TITLE_CAPTURE = new RegExp('^(?:' + TITLE_ALT + ')$', 'u');
// The same lexical heads drive both detection and the end of a capture. Without that shared
// boundary, a sacred first capture can consume «وقال ابن باز» and hide the second head.
const QUESTION_WORD_ALT = 'ما|ماهو|ماهي|وما|فما|ايش';
const OPINION_NOUN_ALT = 'راي|رأي|قول|مذهب|اختيار|ترجيح|فتوي|فتوى|كلام|تفصيل';
const JOINED_OPINION_ALT = 'ماقول|ماراي|مارأي|مامذهب|مافتوي|مافتوى|ماكلام|ماتفصيل|مااختيار|ماترجيح';
const SPEECH_HEAD_ALT = ATTRIBUTION_SPEECH_HEAD_ALT;
const YES_NO_HEAD_ALT = 'افتي|أفتى|افتى|قال|يري|يرى|يجيز|يمنع|ذهب';
const RELATION_HEAD_ALT = 'عند|حسب|بحسب|وفق|على مذهب|في مذهب';
const CAPTURE_BREAK_ALT = [
  QUESTION_WORD_ALT, OPINION_NOUN_ALT, JOINED_OPINION_ALT, SPEECH_HEAD_ALT,
  'ذهب|يذهب|هل', RELATION_HEAD_ALT, 'ينسب|منسوب|نسب',
  'في|عن|على|من|اذا|إذا|حول|بخصوص|رحمه|تعالي|فيمن|لمن|ان|انه|الذي|التي|او|قد|كذا',
].join('|');
// A name is one to four words, ending before the next attribution/question head. AW() supplies
// Arabic Unicode boundaries and also recognises a coordinating waw joined to the next head.
const NAME = '((?:(?!' + AW(CAPTURE_BREAK_ALT) + ')[\\u0600-\\u06FF\\.]+(?:\\s+|$)){1,4})';

// Each pattern captures the scholar phrase in group 1. They are matched against the NORMALISED
// question, so orthographic variation does not create a hole.
const PATTERNS = [
  // ما رأي / ما قول / ما مذهب / ما اختيار / ما فتوى  (+ optional title)
  new RegExp(W(QUESTION_WORD_ALT + '|ما\\s*هو|ما\\s*هي') + '\\s*(?:' + W('هو') + '\\s*)?' + W(OPINION_NOUN_ALT) + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // «ماقول فلان» / «مارأي فلان» — «ما» typed JOINED to the word after it, which is how it is
  // written in the Gulf. MEASURED: «ماقول عبدالله الرويشد في أحكام العقيقه» detected nothing at
  // all, because W('ما') demands a right-hand word boundary and there is no boundary inside
  // «ماقول». The name was not missed for want of normalisation — the whole shape was invisible.
  // Both boundaries are required on the joined form: «ماقولك في كذا» addresses the reader and
  // names nobody, and a left-only match there would capture «ك» as a person.
  new RegExp(W(JOINED_OPINION_ALT)
    + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // رأي فلان في كذا / فتوى فلان / قول فلان
  new RegExp(W(OPINION_NOUN_ALT) + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // قال الشيخ فلان / يقول فلان / ذكر فلان / أفتى فلان / رجّح فلان / اختار فلان
  //
  // «ذهب» IS NOT IN THIS LIST, and that is the second half of the gold fix. A word boundary
  // stops it matching inside «الذهب», but it cannot help with «هل شراء ذهبٍ بالتقسيط جائز؟»,
  // where «ذهب» is a whole word — and is the metal, not the verb. The two senses are the
  // same string, so the only honest discriminator is the SHAPE the verb sense always takes:
  // «ذهب فلانٌ إلى القول بكذا». It gets its own pattern below, which requires that «إلى».
  new RegExp(AW(SPEECH_HEAD_ALT) + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // ذهب فلانٌ إلى كذا — the verb sense only. Without a following «إلى» within the clause
  // this is the metal and the question is about buying it, not about anybody's view.
  new RegExp(W('ذهب|يذهب') + '\\s*(?=[^\\n]{0,40}(?:الي|إلى))(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // هل أفتى فلان / هل قال فلان / هل يرى فلان
  new RegExp(W('هل') + '\\s*' + W(YES_NO_HEAD_ALT) + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // عند الشيخ فلان / حسب فلان / بحسب فلان / وفق فلان
  new RegExp(W(RELATION_HEAD_ALT) + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // ينسب إلى فلان
  new RegExp(W('ينسب|منسوب|نسب') + '\\s*' + WL('الي|إلى|ل') + '\\s*(?:' + TITLE + '\\s*)?' + NAME, 'u'),
  // a bare honorific + name anywhere ("الشيخ ابن عثيمين ...") — the weakest signal, last.
  //
  // NAMING A SCHOLAR'S WEBSITE IS NOT ASKING FOR HIS OPINION. «حديث من موقع الشيخ عبدالمحسن
  // العباد» asks for material published ON a site; it does not ask what he held, and the
  // attribution refusal is the wrong answer to it. The lookbehind excludes exactly that
  // frame — «موقع» immediately before the honorific — and nothing else.
  //
  // This narrows ONLY the weakest of the seven patterns. A question that really does seek
  // his view still fires patterns 1-6 («ما رأي…», «قال…», «هل أفتى…», «عند…», «ينسب إلى…»),
  // which are untouched, so the gate that exists to stop an invented fatwa is not loosened:
  // «ما رأي الشيخ عبدالمحسن العباد في موقعه» still detects. Asserted in attribution-guard.
  new RegExp('(?<!موقع\\s)(?<!موقعه\\s)(?<!موقعي\\s)' + TITLE + '\\s+' + NAME, 'u'),
];

const ATTRIBUTION_INTENT = Object.freeze({
  DIRECT_OPINION_REQUEST: 'DIRECT_OPINION_REQUEST',
  REPORTED_ATTRIBUTION: 'REPORTED_ATTRIBUTION',
  MATERIAL_FROM_SITE: 'MATERIAL_FROM_SITE',
});

// Pattern priority is a lexical implementation detail, not reader intent.  A direct target in
// «فما رأي فلان؟» outranks a reported mention elsewhere; within one intent class the earliest
// valid capture wins deterministically.
const PATTERN_INTENTS = Object.freeze([
  ATTRIBUTION_INTENT.DIRECT_OPINION_REQUEST,
  ATTRIBUTION_INTENT.DIRECT_OPINION_REQUEST,
  ATTRIBUTION_INTENT.DIRECT_OPINION_REQUEST,
  ATTRIBUTION_INTENT.REPORTED_ATTRIBUTION,
  ATTRIBUTION_INTENT.REPORTED_ATTRIBUTION,
  ATTRIBUTION_INTENT.DIRECT_OPINION_REQUEST,
  ATTRIBUTION_INTENT.DIRECT_OPINION_REQUEST,
  ATTRIBUTION_INTENT.REPORTED_ATTRIBUTION,
  ATTRIBUTION_INTENT.REPORTED_ATTRIBUTION,
]);
const INTENT_RANK = Object.freeze({
  [ATTRIBUTION_INTENT.DIRECT_OPINION_REQUEST]: 0,
  [ATTRIBUTION_INTENT.REPORTED_ATTRIBUTION]: 1,
  [ATTRIBUTION_INTENT.MATERIAL_FROM_SITE]: 1,
});

const CLAUSE_SENTINEL = 'attributionclausesentinel';

function detectorNorm(raw) {
  // normalizeArabic intentionally erases punctuation. Attribution needs clause punctuation to
  // remain a hard capture boundary, so preserve only that structural fact with a detector-local
  // sentinel. It is never returned and is excluded from raw-word ordinal accounting below.
  return norm(String(raw == null ? '' : raw)
    .replace(/[،؛:؟!?…]+/gu, ' ' + CLAUSE_SENTINEL + ' '));
}

function wordOrdinalAt(text, index) {
  const before = String(text || '').slice(0, Math.max(0, index));
  const tokens = before.match(/[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}]*)/gu) || [];
  return tokens.filter((word) => word !== CLAUSE_SENTINEL).length;
}

function captureRecord(normalizedQuestion, match, priority, intent) {
  const raw = match[1] || '';
  const within = match[0].lastIndexOf(raw);
  const prefix = match[0].slice(0, Math.max(0, within));
  return {
    index: match.index,
    priority,
    intent,
    raw,
    frameText: match[0],
    frameWordStart: wordOrdinalAt(normalizedQuestion, match.index),
    nameWordStart: wordOrdinalAt(normalizedQuestion, match.index)
      + wordOrdinalAt(prefix, prefix.length),
  };
}

// A bare «قول يا ...» frame names the words being said, not a person whose view is sought.
// Direct opinion questions («ما قول الشيخ ...») use the stronger patterns above and are not
// affected. Keeping this distinction here means every caller sees the same attribution result.
function isVocativeUtteranceCapture(capture) {
  return capture.priority === 2 && /^قول\s+يا(?:\s|$)/u.test(norm(capture.frameText));
}

// Words that end a captured name: they belong to the question, not the person.
//
// THE FIRST-PERSON OPINION WORDS ARE HERE BECAUSE «حسب» IS A TRIGGER (pattern 6). MEASURED
// (حادثة ١٣): «على حسب علمي فهناك علماء اجازوا هذا الأمر» captured «علمي فهناك علماء اجازوا» as
// a scholar's name, and the reader was answered «لا أعرف هذا الاسم: علمي فهناك علماء اجازوا».
// «حسب علمي» is an idiom meaning "as far as I know" — the reader is disclaiming, not citing.
const NAME_STOP = new Set(['في', 'عن', 'على', 'من', 'هل', 'ما', 'اذا', 'حول', 'بخصوص', 'يقول',
  'قال', 'رحمه', 'الله', 'تعالي', 'فيمن', 'لمن', 'ان', 'انه', 'الذي', 'التي', 'و', 'او',
  'كذا', 'علمي', 'علمنا', 'رايي', 'راينا', 'ظني', 'اعتقادي', 'معرفتي', 'خبرتي']);
function cleanName(raw) {
  const words = norm(raw).split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // «الله» remains a stop word for sacred formulae, but not inside the personal-name compound
    // «عبد الله». «رحمه الله» still stops one word earlier at «رحمه».
    const inAbdAllah = w === 'الله' && out[out.length - 1] === 'عبد';
    if (NAME_STOP.has(w) && !inAbdAllah) break;
    out.push(w);
    if (out.length >= 4) break;
  }
  return out.join(' ').trim();
}

// The last user turn only. An attribution two questions ago is not what THIS answer claims.
export function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      return c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join(' ');
    }
  }
  return '';
}

// ── WHAT KIND OF REQUEST IS THIS? ────────────────────────────────────────────
//
// THIS FUNCTION DESCRIBES; IT DOES NOT DECIDE AND IT DOES NOT ANSWER. It reports whether the
// reader asked for somebody's OPINION, who that somebody is, and whether the mention is even
// about an opinion at all. What happens next — search the scholar's own corpus, fall back to
// the general ruling, ask for a name — belongs to the caller, and the moment this function
// was allowed to imply an outcome, "a name was detected" became "refuse", and a reader asking
// a perfectly ordinary question got a canned sentence instead of an answer.
//
// mode:
//   'none'                    — nobody's opinion is being sought
//   'namedScholarOpinion'     — «ما رأي الشيخ فلان في كذا؟»
//   'materialFromScholarSite' — «حديث من موقع الشيخ فلان» — material published BY a site, not
//                               a request for his view; the two are not the same request and
//                               must not get the same treatment
//   'unnamedScholarClaim'     — «قال الشيخ إن كذا» with no name given. Nobody is identified,
//                               so nothing may be attributed and nothing may be guessed.
export const ATTRIBUTION_MODES = Object.freeze(
  ['none', 'namedScholarOpinion', 'materialFromScholarSite', 'unnamedScholarClaim']);

// «من موقع الشيخ فلان» / «في موقع فلان» — the site as a PLACE material comes from.
const SITE_REQUEST = /(?:من|في|علي|علىٰ|عن)\s+موقع(?:ه|ها|هم)?\s*/u;
const SITE_PATTERN = new RegExp(SITE_REQUEST.source + '(?:' + TITLE + '\\s*)?' + NAME, 'u');
// A bare honorific with nothing after it that could be a name: «قال الشيخ إن...».
const BARE_TITLE = new RegExp('(?:^|\\s)' + TITLE_ALT.split('|').join('|') + '(?=\\s|$)', 'u');

// Returns { attributed, mode, scholarName, entity, scholar, question }.
export function detectAttribution(messages) {
  const question = lastUserText(messages);
  const n = detectorNorm(question);
  const none = { attributed: false, mode: 'none', scholarName: '', entity: '', scholar: null, question };
  if (!n) return none;

  // Gather every capture first. Reader intent—not regex array position or raw textual position—
  // decides which class wins; the detector-owned word ordinals ground later query shaping in the
  // exact selected frame without pretending normalized character offsets are raw UTF-16 offsets.
  const captures = [];
  PATTERNS.forEach((re, priority) => {
    const scan = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of n.matchAll(scan)) {
      captures.push(captureRecord(n, m, priority, PATTERN_INTENTS[priority]));
    }
  });
  const siteScan = new RegExp(SITE_PATTERN.source, SITE_PATTERN.flags.includes('g')
    ? SITE_PATTERN.flags : SITE_PATTERN.flags + 'g');
  for (const m of n.matchAll(siteScan)) {
    captures.push(captureRecord(n, m, PATTERNS.length, ATTRIBUTION_INTENT.MATERIAL_FROM_SITE));
  }
  captures.sort((a, b) => INTENT_RANK[a.intent] - INTENT_RANK[b.intent]
    || a.index - b.index || a.priority - b.priority);

  for (const capture of captures) {
    if (isVocativeUtteranceCapture(capture)) continue;
    const name = cleanName(capture.raw);
    // A capture of one very short word is noise ("قال لي", "عند الله"), not a person.
    if (!name || name.length < 4) continue;
    if (BARE_TITLE_CAPTURE.test(norm(name))) continue;
    if (isSacredAttributionCapture(capture.raw, name, {
      frameText: capture.frameText,
      question: n,
    })) continue;
    const attributionSpan = Object.freeze({
      frameWordStart: capture.frameWordStart,
      nameWordStart: capture.nameWordStart,
      nameWordCount: norm(name).split(' ').filter(Boolean).length,
      intent: capture.intent,
    });
    if (capture.intent === ATTRIBUTION_INTENT.MATERIAL_FROM_SITE) {
      return {
        attributed: false, mode: 'materialFromScholarSite',
        scholarName: '', entity: name, scholar: lookupScholar(name), question,
        attributionIntent: capture.intent, attributionSpan,
      };
    }
    return {
      attributed: true, mode: 'namedScholarOpinion',
      scholarName: name, entity: name, scholar: lookupScholar(name), question,
      attributionIntent: capture.intent, attributionSpan,
    };
  }

  // A claim credited to "the shaykh" with no shaykh named. This is NOT `none` — something is
  // being attributed — but there is nobody to attribute it to, so the only honest next step
  // is to ask who is meant. Guessing a scholar here is precisely the fabrication this whole
  // file exists to prevent.
  if (/(?:قال|يقول|ذكر|افتي|افتى|رجح|اختار|راي|رأي|فتوي|فتوى)/u.test(n) && BARE_TITLE.test(n)) {
    return { attributed: false, mode: 'unnamedScholarClaim', scholarName: '', entity: '', scholar: null, question };
  }
  return none;
}

// ── Verification of the generated answer ─────────────────────────────────────
// Decisive fiqh markers. For each, we ask the SOURCE and the ANSWER the same question — is this
// asserted or denied? — and refuse when they disagree. The list is short on purpose: these are
// the terms on which a woman decides whether to pray.
const MARKERS = [
  'نفاس', 'نفساء', 'حيض', 'دم فساد', 'تصلي', 'تصوم', 'تقضي', 'تترك الصلاه', 'تترك الصوم',
  'يجوز', 'حرام', 'واجب', 'باطل', 'صحيح',
];
const NEGATORS = ['ليس', 'ليست', 'لا', 'لم', 'لن', 'غير', 'بدون', 'ولا', 'وليس'];

// Is `marker` asserted or denied in `text`? Returns 'yes' | 'no' | null (absent).
//
// Arabic negation sits immediately before the thing negated ("ليس نفاساً", "لا يثبت"), so the
// window is short. It is also CUT AT THE CLAUSE BOUNDARY, and that is not a detail: the source
// sentence reads «ليس نفاساً ولا حيضاً، وإنما يسمى عند العلماء: دم فساد». A window that simply
// counted back six words from «دم فساد» reached the «ولا» of the previous clause and read the
// source as DENYING dam fasād — the exact opposite of what it says, which would then have
// refused a perfectly faithful answer. Negation does not cross a comma or a colon.
const CLAUSE_BREAK = /[،؛:.؟!\n]/;

// POLARITY NEEDS THE PUNCTUATION THAT norm() THROWS AWAY. norm() folds Arabic punctuation to
// spaces so that «يوم؟» and «يوم» are one word — right for matching, fatal here: without the
// commas the whole reply becomes a single clause, and one «ليس» at its start negates every marker
// to the end of the sentence. MEASURED: a perfectly faithful answer («ليس نفاساً… وإنما هو دم
// فساد، فتصوم وتصلي») was read as DENYING dam fasād, denying prayer and denying fasting, and was
// refused for contradicting the source it agreed with. So this normaliser keeps the boundaries.
function normClauses(s) {
  return String(s == null ? '' : s)
    .replace(/[ً-ٰٟـۖ-ۭ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

// One occurrence, read within its own clause. The negator may sit anywhere between the clause's
// start and the marker — «لا يمكن أن يكون الدم دم نفاس» puts six words between them — so the whole
// clause is searched, and the clause boundary is what stops the search from wandering into the
// previous sentence's negation.
function polarityAt(clause) {
  for (const w of clause.split(' ').filter(Boolean)) if (NEGATORS.includes(w)) return 'no';
  return 'yes';
}

// EVERY occurrence, not the first. A fatwa that states a CONDITIONAL — "if the form is
// distinguishable the blood is nifās, and if it is not it is not" — asserts and denies the same
// marker in the same page, and reading only the first occurrence turns that into a position the
// author never took. When a text says both, this function says nothing: an abstention is the
// honest reading, and the exclusion rule below is what still catches a reply that inverts it.
export function polarity(text, marker) {
  const t = ' ' + normClauses(text) + ' ';
  const mk = normClauses(marker);
  if (t.indexOf(mk) === -1) return null;
  const seen = new Set();
  let from = 0;
  for (;;) {
    const idx = t.indexOf(mk, from);
    if (idx === -1) break;
    const clause = (t.slice(0, idx).split(CLAUSE_BREAK).pop() || '');
    seen.add(polarityAt(clause));
    from = idx + mk.length;
    if (seen.size > 1) return null;                // conditional: the page takes both sides
  }
  return seen.size === 1 ? Array.from(seen)[0] : null;
}

// MUTUALLY EXCLUSIVE VERDICTS. Two rulings that cannot both be the answer to one case. This is
// the check that survives a conditional source: the eighty-day page never says "she does not
// leave the prayer" in so many words, but it does say the blood is دم فساد — and a reply that
// calls the same blood نفاس has contradicted it, whatever words it avoided using.
const EXCLUSIVE = [
  ['دم فساد', 'نفاس'],
  // «نفساء» is the woman, «نفاس» is the blood, and they are different strings — the inverted
  // production answer said «فهي نفساء» and never once wrote the word the check was looking for.
  ['دم فساد', 'نفساء'],
  // What the ruling MEANS for her, not only what it is called. A page that says the blood is دم
  // فساد has said she prays; a reply that tells her to stop praying has contradicted it, however
  // carefully it avoided the word.
  ['دم فساد', 'تترك الصلاه'],
  ['دم فساد', 'تترك الصوم'],
  ['تصلي', 'تترك الصلاه'],
  ['تصوم', 'تترك الصوم'],
  ['يجوز', 'لا يجوز'],
];

// Every number-with-a-unit in a text: "80 يوم", "ثمانين يوما", "أربعة أشهر", "40 يوماً".
const AR_NUM_WORDS = 'صفر|واحد|اثنين|ثلاث(?:ه|ين|مائه)?|اربع(?:ه|ين|مائه)?|خمس(?:ه|ين|مائه)?|ست(?:ه|ين|مائه)?|سبع(?:ه|ين|مائه)?|ثمان(?:يه|ين|مائه)?|تسع(?:ه|ين|مائه)?|عشر(?:ه|ين|ون)?|مائه|مئه|مية|الف';
const UNITS = 'يوم(?:ا|ان|ين)?|ايام|شهر(?:ا|ان|ين)?|اشهر|شهور|اسبوع(?:ا|ين)?|اسابيع|سنه|سنوات|ساعه|ساعات|ركعه|ركعات';
// Does the text speak about time AT ALL? Stems rather than whole words, because Arabic glues the
// article and the dual on: «الشهرين» and «شهرًا» must both count as talking about months.
const TIME_STEMS = ['يوم', 'ايام', 'اسبوع', 'اسابيع', 'شهر', 'اشهر', 'سنه', 'سنوات', 'عام', 'اعوام', 'ليل'];
export function mentionsTime(text) {
  const t = norm(text);
  if (/\d/.test(t)) return true;
  return TIME_STEMS.some((s) => t.includes(s));
}

export function durations(text) {
  const t = norm(text);
  const out = new Set();
  const re = new RegExp('(?:(\\d{1,4})|(' + AR_NUM_WORDS + '))\\s*(?:و\\s*(?:' + AR_NUM_WORDS + ')\\s*)?(' + UNITS + ')', 'gu');
  let m;
  while ((m = re.exec(t)) !== null) out.add((m[1] || m[2]) + ' ' + m[3]);
  return Array.from(out);
}

// Claims that decide this family of questions and must never be introduced by the model when the
// source is silent about them. Generic enough to be worth naming; the numeric check below is what
// catches the rest.
// The shapes an answer takes when it is narrating rather than reasoning. Each is checked against
// the retrieved page: present in the reply and absent from the source means the model supplied it.
const HADITH_MARKERS = ['قال رسول الله', 'قال النبي', 'عن النبي', 'عن رسول الله', 'صلى الله عليه وسلم',
  'رواه البخاري', 'رواه مسلم', 'متفق عليه', 'رواه أبو داود', 'رواه الترمذي', 'رواه النسائي',
  'رواه ابن ماجه', 'رواه أحمد', 'في الصحيحين', 'حديث صحيح', 'حديث حسن', 'حديث ضعيف', 'أخرجه'];
const DRIFT_TERMS = ['نفخ الروح', 'نفخت فيه الروح', 'مائه وعشرين', 'مئه وعشرين', '120',
  // Recognition criteria. A reply that tells a woman how to TELL the two bloods apart — by colour,
  // by thickness, by smell — has given her a test, and a test the source never gave is a test the
  // model invented. The forbidden formulation the brief names («دم الفساد يعرف بلونه وثخانته») is
  // exactly this shape.
  'بلونه', 'لون الدم', 'ثخانته', 'الثخانه', 'برايحته', 'رايحه الدم'];

// The verdict. `sources` are the unified objects the adapter returns (or [] when there are none).
export function verifyAttributedReply(reply, detection, sources) {
  const problems = [];
  const text = String(reply == null ? '' : reply);
  const list = Array.isArray(sources) ? sources : [];

  // 1. HARD REQUIREMENT — a source, and one that belongs to the scholar who was named.
  if (!list.length) {
    problems.push('no-source');
    return { ok: false, problems };
  }
  const named = detection && detection.scholarName ? norm(detection.scholarName) : '';
  const owned = list.filter((s) => {
    const who = norm(s && s.scholar);
    if (!who || !named) return false;
    // Either direction: "العثيمين" ⊂ "محمد بن صالح العثيمين", and the reverse for a full name.
    const last = named.split(' ').filter((w) => w.length > 3).pop() || named;
    return who.includes(named) || named.includes(who) || who.includes(last);
  });
  if (!owned.length) {
    problems.push('source-not-by-named-scholar');
    return { ok: false, problems };
  }
  const corpus = owned.map((s) => String(s.exactText || '')).join('\n');

  // 2. The answer must not assert the opposite of the source on any decisive marker.
  for (const mk of MARKERS) {
    const src = polarity(corpus, mk);
    const rep = polarity(text, mk);
    if (src && rep && src !== rep) problems.push('contradicts:' + mk + ' (source=' + src + ', reply=' + rep + ')');
  }

  // 2b. And the answer must not assert a ruling the source excludes.
  for (const [a, b] of EXCLUSIVE) {
    if (polarity(corpus, a) === 'yes' && polarity(text, b) === 'yes') problems.push('excludes:' + a + ' vs ' + b);
    if (polarity(corpus, b) === 'yes' && polarity(text, a) === 'yes') problems.push('excludes:' + b + ' vs ' + a);
  }

  // 3. Numbers and durations the answer states must be in the source. A period the source never
  //    named is a period the model supplied, and in this subject a period IS the ruling.
  const srcDur = new Set(durations(corpus));
  for (const d of durations(text)) {
    if (!srcDur.has(d)) problems.push('unsourced-duration:' + d);
  }

  // 4. Named drift: a criterion the source does not use may not appear as if it did.
  const nSrc = norm(corpus);
  const nRep = norm(text);
  for (const term of DRIFT_TERMS) {
    const t = norm(term);
    if (nRep.includes(t) && !nSrc.includes(t)) problems.push('unsourced-claim:' + term);
  }

  // 5. A QUESTION THAT FIXES A TIME MUST BE ANSWERED FROM A TEXT THAT FIXES A TIME.
  //
  //    This is the check that catches the most dangerous near-miss of all, and the one the other
  //    five cannot see. Suppose the reader asks about a miscarriage before eighty days, and what
  //    comes back is a genuine, correctly-attributed fatwa of the same scholar — about a
  //    miscarriage AFTER the ensoulment. Every check above is satisfied: the source is his, the
  //    answer is faithful to it, no polarity is inverted, no duration is invented, no criterion is
  //    unsourced. And the reader is told to stop praying when the Shaykh's ruling for her case is
  //    that she prays. The source is not wrong; it is about somebody else.
  //
  //    In this subject the period IS the ruling, so a period in the question with no period
  //    anywhere in the source is a mismatch of subject, whatever the words share.
  //    AND THE PERIODS MUST ACTUALLY MEET. The first version of this check asked only whether the
  //    source mentioned time at all, and that was too weak by half: a page about the sixth month
  //    "mentions time" as surely as a page about the second, so a reader asking about ninety days
  //    could be answered from either. lib/duration.js reads both sides as ranges of days and
  //    requires them to overlap — the source's TITLE first, because on a fatwa page the title is
  //    the case and the body may mention other periods while answering it.
  const asked = String((detection && detection.question) || '');
  for (const s of owned) {
    const cmp = compareDurations(asked, String(s.title || ''), String(s.exactText || ''));
    if (!durationAcceptable(cmp.verdict)) {
      // 'partial' is the one this rewrite exists to name: the source and the question meet, and
      // the source still does not cover her. 'unknown' means it fixes no period at all.
      problems.push('duration-' + cmp.verdict + ':' + ((cmp.question[0] || {}).text || '?')
        + (cmp.source.length ? (' vs ' + cmp.source.map((r) => r.text).slice(0, 3).join('/')) : ''));
    }
  }

  // 6. The link must be the specific page, never a home page.
  for (const s of owned) {
    const u = String(s.canonicalUrl || '');
    if (!/^https:\/\//.test(u)) { problems.push('bad-url'); continue; }
    try {
      const parsed = new URL(u);
      if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname.length < 8) problems.push('url-is-homepage');
    } catch { problems.push('bad-url'); }
  }

  // 7. NO HADITH THE SOURCE DOES NOT NARRATE.
  //
  //    "No verified source, no attributed text" is the same rule for a hadith as for a fatwa, and
  //    on this path the source in hand is the only verification there is. If the published fatwa
  //    does not narrate a hadith, then a hadith in the answer came from the model — and a
  //    fabricated wording, or a grading attached to a real wording by guesswork, is exactly the
  //    failure this whole gate exists to make impossible. The reply is dropped rather than
  //    trimmed: the app does not edit a scholar's answer down to the part it can support.
  //
  //    Takhrij against dorar.net remains the general path's job (it is already on both allow-lists
  //    in lib/retrieve.js). What is enforced HERE is narrower and absolute: an attributed answer
  //    may narrate only what the retrieved page narrates.
  for (const mk of HADITH_MARKERS) {
    const t = norm(mk);
    if (nRep.includes(t) && !nSrc.includes(t)) problems.push('unsourced-hadith:' + mk);
  }

  // 8. No markup may reach the reader through this path.
  if (/highLigated|<\s*\/?\s*(p|span|div|br)\b/i.test(text)) problems.push('raw-html');

  return { ok: problems.length === 0, problems, sources: owned };
}
