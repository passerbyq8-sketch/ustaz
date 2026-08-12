// lib/route-classify.js
// DETERMINISTIC server-side router for the TEXT channel (/api/ask) only.
//
// WHY A SECOND CLASSIFIER, AND WHY IT IS NOT A COPY OF THE VOICE ONE
// ------------------------------------------------------------------
// index.html's __classifyFast is a MODEL call (Haiku via /api/chat-fast) that decides
// which SYSTEM PROMPT + MODEL TIER a VOICE turn gets. It is client-side, it is not
// reproducible, and gate 9 (classifier-guard.cjs, check C3) pins it to `mode === 'call'`.
// It therefore cannot answer the question this module answers:
//
//   "must THIS text turn force a retrieval search, server-side, identically every time?"
//
// So this is a separate, purely lexical, side-effect-free function. It shares the voice
// classifier's ONE governing principle -- real doubt resolves to DEEN -- and nothing else.
// The voice path is untouched by this file.
//
// DEEN here means ONLY "force search_islamic_sources in round 1". It does NOT change the
// system prompt, the model, the effort, the token cap, the band or the allow-list, and
// GEN answers are produced with the very same guarded system prompt. So a message that
// lands on GEN keeps every safety instruction it has today; it just skips a web search
// it never needed.

// ── Arabic normalisation ────────────────────────────────────────────────────
// Diacritics, tatweel, alef/ya/ta-marbuta variants and punctuation are folded so that
// "الصَّلاة" / "الصلاه" / "صلاة" all reduce to the same token.
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const BIDI = /[‌-‏‪-‮⁦-⁩﻿]/g;

export function normalizeArabic(input) {
  return String(input == null ? '' : input)
    .replace(TASHKEEL, '')
    .replace(/ـ/g, '')                       // tatweel
    .replace(BIDI, '')
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي')                 // ى -> ي
    .replace(/ة/g, 'ه')                 // ة -> ه
    .replace(/ؤ/g, 'و')                 // ؤ -> و
    .replace(/ئ/g, 'ي')                 // ئ -> ي
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')            // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Courtesy formulas ───────────────────────────────────────────────────────
// Social/­devotional set-phrases that carry no question. They are removed BEFORE term
// matching so that "الله يعطيك العافية، كم يساوي ٧ في ٨؟" stays a maths question instead
// of being dragged into a fatwa search by the word الله.
// Order matters: longer phrases first, so a long form is consumed before its own prefix.
const FORMULA_DEFINITIONS = Object.freeze([
  ['صلي الله عليه وسلم', true], ['صلي الله عليه وعلي اله وسلم', true],
  ['رضي الله عنهم', false], ['رضي الله عنه', false],
  ['الله يجزاك خير', false], ['جزاك الله خيرا', false], ['جزاك الله خير', false],
  ['الله يعطيك العافيه', false], ['الله يبارك فيك', false], ['بارك الله فيك', false],
  ['الله يعافيك', false], ['الله يسلمك', false], ['الله يوفقك', false],
  ['الله يرحمه', false], ['يعطيك العافيه', false], ['ما شاء الله', false],
  ['ان شاء الله', false], ['الحمد لله', false], ['سبحان الله', false], ['بسم الله', false],
  ['عليه السلام', true],
  ['صباح الخير', false], ['مساء الخير', false],
  ['السلام عليكم ورحمه الله وبركاته', false], ['السلام عليكم ورحمه الله', false],
  ['السلام عليكم', false], ['وعليكم السلام', false], ['حياك الله', false],
  ['يا الله', false], ['يالله', false], ['والله', false], ['تسلم', false],
  ['مشكور', false], ['شكرا', false],
].map(([text, propheticHonorific]) => Object.freeze({ text, propheticHonorific })));

function stripDeclaredFormulas(normalized, accept) {
  let t = ' ' + normalized + ' ';
  for (const entry of FORMULA_DEFINITIONS) {
    if (!accept(entry)) continue;
    const f = entry.text;
    let i;
    while ((i = t.indexOf(' ' + f + ' ')) !== -1) t = t.slice(0, i) + ' ' + t.slice(i + f.length + 2);
  }
  return t.replace(/\s+/g, ' ').trim();
}

export function stripFormulas(normalized) {
  return stripDeclaredFormulas(normalized, () => true);
}

// Attribution may bridge punctuation only with a formula already classified here as a
// Prophetic honorific. Greetings and general devotional courtesies remain meaningful boundary
// content there even though the route classifier still strips them all in its original role.
export function stripPropheticHonorifics(normalized) {
  return stripDeclaredFormulas(normalized, (entry) => entry.propheticHonorific);
}

// ── Religious vocabulary ────────────────────────────────────────────────────
// Whole-word (after prefix/suffix folding) matches only. Deliberately excludes
// emotional-distress words: a child's "أخوي يضربني" must NOT be answered out of a fatwa
// search. Safety wording lives in the system prompt, which BOTH routes carry unchanged.
const DEEN_WORDS = new Set([
  // عبادات
  'صلاه', 'صلات', 'صلاتي', 'الصلاه', 'يصلي', 'اصلي', 'نصلي', 'مصلي', 'ركعه', 'ركعات',
  'ركوع', 'سجود', 'سجده', 'تشهد', 'قبله', 'اذان', 'اقامه', 'جماعه', 'جمعه', 'وتر',
  'نافله', 'فجر', 'ظهر', 'عصر', 'مغرب', 'عشاء', 'قنوت', 'سهو',
  'وضوء', 'اتوضا', 'يتوضا', 'وضوئي', 'غسل', 'تيمم', 'طهاره', 'نجاسه', 'جنابه', 'حيض',
  'استحاضه', 'نفاس',
  'صيام', 'صوم', 'اصوم', 'يصوم', 'صائم', 'افطار', 'رمضان', 'سحور', 'قضاء', 'كفاره',
  'زكاه', 'زكات', 'صدقه', 'نصاب', 'حج', 'عمره', 'احرام', 'طواف', 'سعي', 'عرفه', 'هدي',
  // قرآن وحديث
  'قران', 'مصحف', 'ايه', 'ايات', 'سوره', 'سور', 'تلاوه', 'تجويد', 'تفسير', 'حفظ',
  'حديث', 'احاديث', 'سنه', 'بخاري', 'مسلم', 'راوي', 'اسناد', 'تخريج', 'صحيح', 'ضعيف',
  // عقيدة
  'الله', 'رب', 'اسلام', 'مسلم', 'مسلمه', 'ايمان', 'عقيده', 'توحيد', 'شرك', 'كفر',
  'نبي', 'انبياء', 'رسول', 'محمد', 'صحابه', 'صحابي', 'ملائكه', 'ملك', 'جن', 'شيطان',
  'جنه', 'جهنم', 'اخره', 'قيامه', 'قبر', 'بعث', 'حساب', 'قدر', 'روح',
  // فقه وأحكام
  // NOTE: 'واجب' is deliberately ABSENT -- in Gulf usage it is the ordinary word for
  // school homework ("واجب الإنجليزي"), and a fiqh sense always arrives with a real
  // religious term beside it. 'دليل' is absent for the same reason: on its own it is a
  // topic-free follow-up ("شنو الدليل؟") that must INHERIT the thread, not force a search.
  'حلال', 'حرام', 'مكروه', 'مستحب', 'مباح', 'فرض', 'حكم', 'احكام', 'فتوي',
  'فتاوي', 'فقه', 'فقهي', 'شرعي', 'شرعا', 'شريعه', 'مذهب', 'اجماع',
  'اثم', 'ذنب', 'توبه', 'استغفار', 'عباده', 'نعبد', 'سيره', 'هجره', 'مسجد', 'عيد',
  'دعاء', 'ادعيه', 'ذكر', 'اذكار', 'تسبيح', 'رقيه',
  // ── التزكية والأخلاق: THE SUBJECTS THAT HAD NO WORD HERE AT ALL ───────────
  //
  // MEASURED, and it is the whole of defect §4. «ما معنى الإحسان؟» and «اشرح لي معنى التوكل» are
  // religious questions by any reading, and isReligiousText() returned FALSE for both — not
  // because the sentence was ambiguous, but because none of these nouns was on this list. The
  // router therefore called them GENERAL, the GEN branch runs with no tools and strips every
  // source tag, and the reader was answered about ihsan and tawakkul from the model's memory.
  // Adding the predicate to the route decision (api/ask.js) fixes nothing while the predicate
  // cannot name the subject: measured before this line, the wiring moved 0 of 8.
  //
  // WHY THESE AND NOT MORE. Every entry is a term whose ordinary Arabic use IS the religious one —
  // the stations of the heart and the named virtues and vices of the akhlaq literature. Words that
  // are religious only in context («أمانة», «صدق», «رحمة», «شكر») are deliberately left off: they
  // are the ordinary vocabulary of a child's day, and a router that claims them would send «صدق
  // وياي» to the fatwa sources. The bias here is the same one the whole file carries — doubt
  // resolves towards the sourced route — but it is not a licence to claim the language.
  'احسان', 'توكل', 'اخلاص', 'تقوي', 'ورع', 'زهد', 'استقامه', 'خشوع', 'يقين',
  'رياء', 'نفاق', 'غيبه', 'نميمه', 'حسد', 'كبر', 'تواضع', 'صبر', 'قناعه',
  'اليقين', 'تزكيه', 'محاسبه', 'مراقبه', 'خشيه', 'زهاده',
  // معاملات ذات حكم شرعي
  'ربا', 'فوائد', 'ميراث', 'ورث', 'طلاق', 'نكاح', 'مهر', 'عده', 'محرم', 'عوره', 'حجاب',
  'نيه', 'يجوز', 'تجوز', 'جائز',
]);

// Multi-word religious phrases checked on the joined normalised text.
const DEEN_PHRASES = [
  'ما حكم', 'ما هو حكم', 'هل يجوز', 'هل يحرم', 'هل يحل', 'ايش حكم', 'شنو حكم', 'وش حكم',
  'قوله تعالي', 'قال تعالي', 'قوله عز وجل', 'قال رسول', 'قال النبي',
  // Multi-word religious subjects, for the same measured reason as the tazkiyah block above:
  // neither word is claimable on its own, and together they name one thing and only one.
  'بر الوالدين', 'صله الرحم', 'حسن الخلق', 'سوء الخلق', 'عقوق الوالدين',
];

// Continuation OPENERS. A follow-up is recognised by how it STARTS, not merely by
// containing one of these: "كم يساوي ٧ × ٨؟" opens with a question word yet is a complete,
// self-contained maths question, whereas "شنو الدليل؟" is meaningless without the turn
// before it. Requiring the marker in FIRST position is what separates the two.
// Words that routinely open a stand-alone question (كم / متى / وين / من) are excluded.
const FOLLOWUP_OPENERS = new Set([
  'ليش', 'لماذا', 'ليه', 'وليش', 'ولماذا', 'كيف', 'وكيف', 'شلون', 'كيفيه',
  'شنو', 'ايش', 'وش', 'شنهو', 'ماذا', 'وماذا', 'ما',
  'طيب', 'زين', 'اوك', 'تمام', 'ثم', 'وبعدين', 'بعدين', 'وبعد',
  'اكمل', 'زدني', 'وضح', 'اشرح', 'مثال', 'يعني', 'صح', 'اكيد', 'نعم', 'لا',
  'ولو', 'واذا', 'اذا', 'لو', 'وان', 'وهل', 'هل',
]);
const MAX_FOLLOWUP_WORDS = 5;

function foldToken(tok) {
  const out = [tok];
  const stripped = tok.replace(/^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/, '');
  if (stripped && stripped !== tok) out.push(stripped);
  for (const base of [...out]) {
    for (const suf of ['هما', 'هم', 'هن', 'كم', 'ها', 'ات', 'ين', 'ون', 'نا', 'ه', 'ي', 'ك']) {
      if (base.length > suf.length + 2 && base.endsWith(suf)) out.push(base.slice(0, -suf.length));
    }
  }
  return out;
}

// Does this single message, on its own wording, name a religious subject?
export function isReligiousText(raw) {
  const cleaned = stripFormulas(normalizeArabic(raw));
  if (!cleaned) return false;
  for (const p of DEEN_PHRASES) if (cleaned.includes(p)) return true;
  for (const tok of cleaned.split(' ')) {
    for (const f of foldToken(tok)) if (DEEN_WORDS.has(f)) return true;
  }
  return false;
}

// Is this a short, topic-free continuation that must inherit the thread's subject?
export function isShortFollowUp(raw) {
  const cleaned = stripFormulas(normalizeArabic(raw));
  if (!cleaned) return true;                       // pure formula / empty -> inherit
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length > MAX_FOLLOWUP_WORDS) return false;
  return foldToken(words[0]).some((f) => FOLLOWUP_OPENERS.has(f));
}

function textOf(m) {
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join(' ');
  }
  return '';
}

// How many earlier USER turns establish the running topic. Assistant turns are ignored on
// purpose: in a religious app the assistant's prose is religiously flavoured even when it
// is answering a maths question, so using it would drag every follow-up to DEEN.
const CONTEXT_USER_TURNS = 3;

/**
 * The router. Pure, synchronous, no I/O, no model call -- the same messages always give
 * the same answer, which is the whole point.
 * @returns {'DEEN'|'GEN'}
 */
export function classifyRoute(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const users = list.filter((m) => m && m.role === 'user');
  if (users.length === 0) return 'DEEN';           // nothing to read -> fail closed

  const current = textOf(users[users.length - 1]);
  if (isReligiousText(current)) return 'DEEN';

  if (isShortFollowUp(current)) {
    const prior = users.slice(-1 - CONTEXT_USER_TURNS, -1);
    for (const m of prior) if (isReligiousText(textOf(m))) return 'DEEN';
  }
  return 'GEN';
}

// ── Streaming <source> filter (GEN path) ────────────────────────────────────
// GEN runs with NO tools, so retrieval never happens and EVERY <source> card the model
// might invent is unbacked. Branch (a) already strips those, but it can do it with a
// regex because it holds the whole answer. GEN streams, so the same removal has to work
// across arbitrary chunk and SSE-frame boundaries while holding back only a few bytes.
//
// CONTRACT (property-tested): for any input and ANY chunking,
//   concat(filter.push(chunk_i)) + filter.end()
// equals
//   text.replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '').replace(/<source\b[^>]*>?[\s\S]*$/i, '')
// i.e. byte-identical to what branch (a) produces today. Every non-source byte survives.
const OPEN = '<source';
const CLOSE = '</source>';
const isWordChar = (c) => /[A-Za-z0-9_]/.test(c);

// Longest suffix of `s` that is a proper prefix of `needle` (so a tag split across
// chunks is still recognised). Returns its length.
function danglingPrefixLen(s, needle) {
  const max = Math.min(needle.length - 1, s.length);
  for (let k = max; k > 0; k--) {
    if (s.slice(s.length - k).toLowerCase() === needle.slice(0, k)) return k;
  }
  return 0;
}

export function createSourceFilter() {
  let dropping = false;
  let buf = '';

  function step() {
    let out = '';
    for (;;) {
      if (dropping) {
        const i = buf.toLowerCase().indexOf(CLOSE);
        if (i === -1) {
          // Keep only enough tail to catch a </source> straddling the boundary.
          const keep = danglingPrefixLen(buf, CLOSE);
          buf = keep ? buf.slice(buf.length - keep) : '';
          return out;
        }
        buf = buf.slice(i + CLOSE.length);
        dropping = false;
        continue;
      }
      const i = buf.toLowerCase().indexOf(OPEN);
      if (i === -1) {
        const keep = danglingPrefixLen(buf, OPEN);
        out += keep ? buf.slice(0, buf.length - keep) : buf;
        buf = keep ? buf.slice(buf.length - keep) : '';
        return out;
      }
      const after = i + OPEN.length;
      if (after >= buf.length) {           // need one more char to apply \b
        out += buf.slice(0, i);
        buf = buf.slice(i);
        return out;
      }
      if (isWordChar(buf[after])) {        // <sourced ... > is not a source tag
        out += buf.slice(0, after);
        buf = buf.slice(after);
        continue;
      }
      out += buf.slice(0, i);              // real tag: emit before it, then drop
      buf = buf.slice(i);
      dropping = true;
      buf = buf.slice(OPEN.length);
    }
  }

  return {
    push(chunk) { buf += String(chunk == null ? '' : chunk); return step(); },
    // Unclosed '<source…' is dropped to end of text, exactly like branch (a)'s 2nd regex.
    end() {
      if (dropping) { buf = ''; return ''; }
      if (buf.toLowerCase() === OPEN) { buf = ''; return ''; }
      const rest = buf; buf = '';
      return rest;
    },
  };
}
