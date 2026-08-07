// guards/answer-shape-guard.cjs — THE ANSWER BEGINS AT THE CONTENT AND ENDS AT THE CONTENT.
//
// ── WHAT THE OWNER MEASURED (٨ أغسطس ٢٠٢٦) ───────────────────────────────────
//   «في بداية رده على السؤال يجاوب مباشرة ولا يكتب اي عبارات خاصه ولا يكتب السلام عليكم كما
//    يفعل الان … لا يكتب في بداية الجواب اي شي ابدا، فقط يجاوب، ولا في نهاية الجواب، لا يذكر
//    شي غير الاجابات، والمصادر اصلا مذيله في كل مره.»
//
// So: a fiqh answer starts at the first letter of the content, ends at the last letter of the
// content, and what follows is the source card alone. Zero fixed text before it, zero after it.
//
// ── WHAT THIS GATE DOES *NOT* TOUCH, AND THE DISTINCTION IS THE WHOLE DESIGN ──
// صنف (ب) — the messages that are NOT an answer. SAFETY_REDIRECT, IMPERMISSIBLE_REQUEST, the
// no-verified-source line, the takhrij provenance sentence, the unregistered-name line. These are
// the system saying it will not or cannot answer, and their text may not lose a byte. Section E
// runs the very same detector over the REAL constants, imported from their own modules, and
// requires it to stay silent. A gate that cannot tell an answer from a refusal would "fix" the
// child-safety surface by deleting it.
//
// 🩸 And the child-safety referral protocol — referral-golden.json's nine cases, harm_teen_01
// among them — is guarded by referral-guard.cjs and is untouched here by construction: nothing in
// this file asserts anything about it, and section E proves the detector cannot reach it.
//
// ── IT IS MEASURED BY WHAT IT IMPORTS, NOT BY WHAT IT IS CALLED (البند ٤) ────
// This gate does not grep a file for a sentence. It IMPORTS the real prompt builder and runs it
// over the measured range, and it IMPORTS the real composition functions and runs them. A gate
// that reads source text passes the day someone moves the text; a gate that runs the generator
// fails the day the generator's OUTPUT changes, which is the thing the reader actually meets.
//
// Usage: node guards/answer-shape-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── THE VOCABULARY OF A PREAMBLE ─────────────────────────────────────────────
// Both spellings of everything, because the prompt is written fully vocalised in places and bare
// in others, and a detector that only knew one of them would be blind to half the file.
const PREAMBLE_TOKEN = new RegExp([
  'تحيّة', 'تَحِيَّة', 'التحيّة', 'التَّحِيَّة',
  'ترحيب', 'تَرْحِيب', 'ترحيبي', 'تَرْحِيبِي', 'ترحيبيّة', 'ترحيبيّ',
  'أهلًا بك', 'أَهْلًا بِك', 'أهلاً بك', 'مرحبًا', 'مَرْحَبًا', 'حيّاك الله', 'حَيَّاكَ الله',
  'السلام عليكم', 'السَّلَامُ عَلَيْكُم', 'وعليكم السلام', 'وَعَلَيْكُمُ السَّلَام',
  'تمهيد', 'تَمْهِيد', 'التمهيد', 'التَّمْهِيد', 'مُمَهِّد',
  'ديباجة', 'دِيبَاجَة', 'بسملة', 'بَسْمَلَة',
  'سؤال جميل', 'سُؤَالٌ جَمِيل', 'سؤالٌ جميل',
].join('|'), 'u');

// The model being TOLD to compose something. A line that merely mentions a greeting (a rule about
// what age-simplification applies to, a ✗ example) carries no such verb and is not a mandate.
const MANDATE_VERB = new RegExp([
  'ابدأ', 'ابْدَأ', 'ابدأْ', 'ابدئي', 'اِبْدَأ',
  'اكتب', 'اكْتُب', 'اكتبْ',
  'رحّب', 'رَحِّب', 'رحب',
  'افتتح', 'اِفْتَتِح',
  'اختم', 'اخْتِم', 'اختمْ',
  'قدّم', 'قدِّم', 'تُقدِّم', 'تقدّم',
  'مَهِّد', 'مهّد',
].join('|'), 'u');

// A line that FORBIDS a preamble names one in order to forbid it. So does a ✗ counter-example.
const PROHIBITION = new RegExp([
  'ممنوع', 'مَمْنُوع', 'ممنوعة', 'مَمْنُوعَة',
  'لا تبدأ', 'لَا تَبْدَأ', 'لا تكتب', 'لَا تَكْتُب', 'لا تزد', 'لَا تَزِد',
  'لا تقل', 'لَا تَقُل', 'لا ترد', 'لَا تَرُدَّ', 'لا تجعل', 'لا تُمهّد', 'لا تُمهِّد',
  'بلا', 'بِلَا', 'دون', 'دُون', 'وَلَا', 'ولا ', 'لا يسري',
  '✗', '❌', 'خطأ', 'خَطَأ',
].join('|'), 'u');

// The ONE sanctioned greeting: the app's own first message, before the reader has asked anything.
// It is not a reply to a question, and the owner kept it.
const OPENER_EXCEPTION = new RegExp([
  'الافتتاح', 'الافْتِتَاح', 'افتتاح',
  'المبادرة', 'المُبَادَرَة', 'المبادأة', 'المُبَادَأَة', 'المبادِر', 'المُبَادِر',
  'تفتح أنت', 'تَفْتَحُ أَنْت', 'تبادر أنت', 'تُبَادِرُ أَنْت',
  'ابدأ المحادثة', 'استثناء', 'اسْتِثْنَاء',
].join('|'), 'u');

/**
 * EVERY LINE OF A GENERATED PROMPT THAT ASKS FOR A PREAMBLE.
 *
 * A mandate is: a preamble word + an imperative to compose + neither a prohibition nor the named
 * opener exception. Returns the offending lines VERBATIM — a gate that fires without naming the
 * line it tripped on sends the next reader to grep 900 lines by hand.
 *
 * @param {string} prompt the generator's own output
 * @returns {string[]}
 */
function preambleMandates(prompt) {
  const out = [];
  for (const raw of String(prompt || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (!PREAMBLE_TOKEN.test(line)) continue;
    if (!MANDATE_VERB.test(line)) continue;
    if (PROHIBITION.test(line)) continue;
    if (OPENER_EXCEPTION.test(line)) continue;
    out.push(line);
  }
  return out;
}

// ── AND THE SHAPE OF A FINISHED REPLY ────────────────────────────────────────
// Applied to a REPLY, not to the prompt. Anchored: a greeting is a defect when it OPENS the reply,
// and «وعليكم السلام» quoted in the middle of an answer about greeting etiquette is not a defect.
const OPENING_GREETING = /^\s*(?:\*\*)?\s*(?:وعليكم\s+السلام|وَعَلَيْكُمُ\s+السَّلَام|السلام\s+عليكم|السَّلَامُ\s+عَلَيْكُم|وعليك\s+السلام|وَعَلَيْكِ\s+السَّلَام|وَعَلَيْكَ\s+السَّلَام|أهلًا|أَهْلًا|أهلاً|مرحبًا|مَرْحَبًا|حيّاك\s+الله|حَيَّاكَ\s+الله)/u;
const OPENING_PRAISE = /^\s*(?:\*\*)?\s*(?:سؤالٌ?\s*(?:جميل|مهم|رائع|طيب)|سُؤَالٌ\s*(?:جَمِيل|مُهِمّ|رَائِع)|أحسنت\s+السؤال|أَحْسَنْتَ\s+السُّؤَال|بارك\s+الله\s+فيك|جزاك\s+الله)/u;
const OPENING_BASMALA = /^\s*(?:بسم\s+الله\s+الرحمن\s+الرحيم|بِسْمِ\s+اللَّهِ\s+الرَّحْمَنِ\s+الرَّحِيم|الحمد\s+لله\s+رب\s+العالمين|الْحَمْدُ\s+لِلَّهِ\s+رَبِّ\s+الْعَالَمِين)/u;
const OPENING_META = /^\s*(?:سأشرح|سَأَشْرَح|دعني\s+أ|دَعْنِي\s+أ|سأجيب|سَأُجِيب|سأبحث|قبل\s+أن\s+أجيب)/u;
// A fixed tail: a routine referral or a self-description bolted onto the end of a real answer.
const FIXED_TAIL = /(?:وهذا نقلٌ عن المصدر المذكور|فاسأل أهل العلم عندك|اعرِضْها على مفتٍ|مرجعها أهل العلم|أنا لا أفتي|لست مفتيًا|لَسْتُ مُفْتِيًا|هذا ليس فتوى|وأنا ذكاء اصطناعي)\s*[.،]?\s*$/u;

/**
 * THE VIOLATIONS IN A FINISHED صنف (أ) REPLY — each one named.
 * @param {string} reply the text the reader would actually see, cards excluded
 * @returns {string[]}
 */
function answerShapeViolations(reply) {
  const t = String(reply == null ? '' : reply).trim();
  if (!t) return [];
  const v = [];
  if (OPENING_GREETING.test(t)) v.push('opens with a greeting');
  if (OPENING_PRAISE.test(t)) v.push('opens by complimenting the question');
  if (OPENING_BASMALA.test(t)) v.push('opens with a fixed devotional formula');
  if (OPENING_META.test(t)) v.push('opens by describing what it is about to do');
  if (FIXED_TAIL.test(t)) v.push('ends with a fixed tail');
  return v;
}

(async function main() {
  console.log('=== answer-shape-guard — the answer starts at the content and ends at the content ===');

  let SP = null, RT = null, ASK = null, CORE = null, IMP = null, TAKH = null;
  try {
    SP = await esm('lib/system-prompt.js');
    RT = await esm('lib/policy/referral-tail.js');
    CORE = await esm('lib/policy/core.js');
    IMP = await esm('lib/policy/impermissible-request.js');
    TAKH = await esm('lib/policy/takhrij-disclosure.js');
    ASK = await esm('api/ask.js');
  } catch (e) {
    ok('the real modules load', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }

  // =========================================================================
  console.log('\n=== A. THE GENERATOR IS RUN, NOT READ ===');
  // The measured range the owner's readers actually span: adult/fiqh, teen, child — each in the
  // typed and the spoken mode, and both personas. If the fork ever emits a preamble for ONE band
  // only, a single-sample gate would miss it, and a child is exactly the band nobody re-checks.
  const SAMPLES = [
    ['adult / fiqh reader', 'خالد', 30, 'male', 'chat'],
    ['adult / female persona', 'هند', 30, 'female', 'chat'],
    ['teen', 'خالد', 15, 'male', 'chat'],
    ['teen / female persona', 'هند', 15, 'female', 'chat'],
    ['child', 'خالد', 7, 'male', 'chat'],
    ['child / female persona', 'هند', 7, 'female', 'chat'],
    ['adult / voice call', 'خالد', 30, 'male', 'call'],
    ['teen / voice call', 'هند', 15, 'female', 'call'],
    ['child / voice call', 'خالد', 7, 'male', 'call'],
  ];
  const PROMPTS = new Map();
  {
    ok('buildSystemPrompt is a function this gate can run',
      typeof SP.buildSystemPrompt === 'function');
    for (const [label, name, age, gender, mode] of SAMPLES) {
      const p = SP.buildSystemPrompt(name, age, gender, mode);
      PROMPTS.set(label, p);
      if (!ok(label + ': the generator produced a prompt', typeof p === 'string' && p.length > 5000,
        'length ' + (p || '').length)) continue;
      const mandates = preambleMandates(p);
      // THE LINE IS NAMED. This is the negative witness's output: put a preamble line back into
      // the generator and this is what tells you which one.
      ok(label + ': no line asks for a preamble',
        mandates.length === 0,
        mandates.length ? mandates.length + ' offending line(s):\n        - '
          + mandates.map((m) => m.slice(0, 220)).join('\n        - ') : '');
    }
  }

  // =========================================================================
  console.log('\n=== B. AND THE PROHIBITION IS ACTUALLY IN THE PROMPT ===');
  // Absence-only checks pass when the whole rule is deleted. These fail then.
  {
    for (const [label, p] of PROMPTS) {
      ok(label + ': the reply is forbidden to open with a greeting',
        /مَمْنُوعٌ مَنْعًا بَاتًّا أَنْ تَبْدَأَ رَدَّكَ بِتَحِيَّة/u.test(p));
      ok(label + ': ...and forbidden to open with any preamble',
        /وَمَمْنُوعٌ كَذَلِكَ أَيُّ تَمْهِيدٍ قَبْلَ المَضْمُون/u.test(p));
      ok(label + ': ...and forbidden to close with a fixed sentence',
        /وَلَا تَخْتِمْ بِعِبَارَةٍ ثَابِتَةٍ بَعْدَ المَضْمُون/u.test(p));
      ok(label + ': ...and told the salam is not returned in the answer',
        /وَلَا تَرُدَّ السَّلَامَ فِي صَدْرِ الجَوَاب/u.test(p));
    }
  }

  // =========================================================================
  console.log('\n=== C. THE OPENING MESSAGE IS THE ONE NAMED EXCEPTION ===');
  // The owner kept it: it is not a reply to a question. If it disappears the app stops greeting
  // anybody, which is a different bug and this gate should catch it too.
  {
    for (const [label, p] of PROMPTS) {
      ok(label + ': the app still opens the conversation with the salam',
        /السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُه، (?:تَفَضَّلْ|تَفَضَّلِي) يَا /u.test(p));
      ok(label + ': ...and it is marked an exception that does not carry into replies',
        /اسْتِثْنَاءٌ وَاحِدٌ لَا غَيْر — رِسَالَةُ الافْتِتَاح/u.test(p)
        && /وَلَا يَسْرِي عَلَى أَيِّ رَدٍّ بَعْدَه/u.test(p));
    }
  }

  // =========================================================================
  console.log('\n=== D. THE REPLY DETECTOR FIRES ON A REAL PREAMBLE ===');
  // A detector nobody proved on a positive case is a detector that returns [] forever.
  {
    const OFFENDING = [
      ['a returned salam', 'وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُه. زكاةُ الفطرِ تُخرَجُ طعامًا.', 'opens with a greeting'],
      ['an initiated salam', 'السلام عليكم. زكاةُ الفطرِ تُخرَجُ طعامًا عن كلِّ فرد.', 'opens with a greeting'],
      ['a welcome', 'أهلًا بك وبسؤالك الكريم. زكاةُ الفطرِ تُخرَجُ طعامًا.', 'opens with a greeting'],
      ['a compliment', 'سؤالٌ جميل! زكاةُ الفطرِ تُخرَجُ طعامًا عن كلِّ فرد.', 'opens by complimenting the question'],
      ['a basmala', 'بسم الله الرحمن الرحيم، زكاةُ الفطرِ تُخرَجُ طعامًا.', 'opens with a fixed devotional formula'],
      ['a stage direction', 'سأشرح لك المسألة. زكاةُ الفطرِ تُخرَجُ طعامًا.', 'opens by describing what it is about to do'],
      ['a routine referral tail', 'زكاةُ الفطرِ تُخرَجُ طعامًا. وهذا نقلٌ عن المصدر المذكور؛ ولتفاصيل حالتك بعينها فاسأل أهل العلم عندك.', 'ends with a fixed tail'],
      ['an "I do not issue fatwa" tail', 'زكاةُ الفطرِ تُخرَجُ طعامًا عن كلِّ فرد. أنا لا أفتي.', 'ends with a fixed tail'],
    ];
    for (const [label, reply, expected] of OFFENDING) {
      const v = answerShapeViolations(reply);
      ok('fires on ' + label, v.includes(expected), 'got ' + JSON.stringify(v));
    }
    // ...AND IS SILENT ON THE SHAPE THE OWNER ASKED FOR.
    const CLEAN = [
      'زكاةُ الفطرِ تُخرَجُ طعامًا عن كلِّ فردٍ من أهلِ البيت، صاعًا من غالبِ قوتِ البلد.',
      'الرَّاجِحُ عِنْدَ جُمْهُورِ الفُقَهَاءِ أَنَّهَا لَا تُجْزِئُ نَقْدًا، وَذَهَبَ الحَنَفِيَّةُ إِلَى إِجْزَائِهَا.',
      'تُخرَجُ قبلَ صلاةِ العيد. ومن أخّرها عنها فهي صدقةٌ من الصدقات.',
    ];
    for (const c of CLEAN) eq('silent on a clean sourced answer: «' + c.slice(0, 40) + '…»', answerShapeViolations(c), []);
    // A greeting DISCUSSED inside an answer is content, not a preamble — the anchor is the point.
    eq('silent when the greeting is the subject of the answer',
      answerShapeViolations('يُشرَعُ للمسلمِ أن يقولَ «وعليكم السلام ورحمة الله وبركاته» إذا سُلِّم عليه.'), []);
  }

  // =========================================================================
  console.log('\n=== E. AND IT NEVER FIRES ON صنف (ب) ===');
  // 🩸 THE LINE THIS GATE MAY NOT CROSS. These are the system declining or declaring a limit, not
  // answering. Imported from their own modules rather than retyped, so that rewording any of them
  // is measured here rather than silently diverging from a copy in a guard.
  {
    const CLASS_B = [
      ['WARM_SAFETY_REDIRECT', CORE.WARM_SAFETY_REDIRECT],
      ['WARM_HEALTH_REFERRAL', CORE.WARM_HEALTH_REFERRAL],
      ['WARM_ADULT_GUIDANCE', CORE.WARM_ADULT_GUIDANCE],
      ['WARM_PARENT_FOR_NEW_SUBSTANCE', CORE.WARM_PARENT_FOR_NEW_SUBSTANCE],
      ['TAKHRIJ_DISCLOSURE', TAKH.TAKHRIJ_DISCLOSURE],
    ];
    for (const [label, text] of CLASS_B) {
      if (!ok(label + ' is present to be measured', typeof text === 'string' && text.length > 20)) continue;
      eq(label + ' is untouched by the detector', answerShapeViolations(text), []);
    }
    // The impermissible-request message is COMPOSED per band, so the gate composes it — every
    // band, because the child wording and the adult wording are different strings and only one of
    // them would be measured otherwise.
    ok('impermissibleCounsel is a function this gate can run',
      typeof IMP.impermissibleCounsel === 'function');
    for (const band of ['young', 'teen', 'adult', 'unknown']) {
      const s = IMP.impermissibleCounsel(band);
      if (!ok('IMPERMISSIBLE_REQUEST (' + band + ') is present to be measured',
        typeof s === 'string' && s.length > 40, 'length ' + (s || '').length)) continue;
      eq('IMPERMISSIBLE_REQUEST (' + band + ') is untouched by the detector',
        answerShapeViolations(s), []);
    }
    // The server's own referral wordings, as WHOLE messages, are class (ب) shaped — the detector's
    // tail rule is anchored to the END of a reply, so a wording standing alone must not trip it.
    for (const t of RT.REFERRAL_TAILS) {
      eq('a referral wording standing alone is not an offence', answerShapeViolations(t), []);
    }
  }

  // =========================================================================
  console.log('\n=== F. THE COMPOSITION FUNCTIONS, RUN NOT READ ===');
  {
    // ── the tail ──────────────────────────────────────────────────────────
    ok('referralTail is a function this gate can run', typeof RT.referralTail === 'function');
    const FIQH = [
      'ما حكم إخراج زكاة الفطر نقدًا؟',
      'ما حكم بيع الذهب بالتقسيط؟',
      'ما حكم التأمين الصحي الإلزامي؟',
      'ما رأي ابن باز في التصوير؟',
    ];
    for (const q of FIQH) {
      let leaked = '';
      for (const cls of ['sharia_ruling', 'scholar_position']) {
        for (let turn = 0; turn < 6; turn++) {
          const t = RT.referralTail(q, cls, turn);
          if (t) { leaked = cls + ' turn ' + turn + ' → ' + t; break; }
        }
      }
      eq('«' + q + '» composes no tail', leaked, '');
    }
    // ...and the whole block a live exit would append is empty for a fiqh draft.
    const draft = 'زكاةُ الفطرِ تُخرَجُ طعامًا عن كلِّ فردٍ من أهلِ البيت.';
    eq('the appended block for a fiqh draft is empty',
      RT.referralOnce(draft, RT.referralTail(FIQH[0], 'sharia_ruling', 0)), '');
    eq('...so the finished reply still ends at its content',
      answerShapeViolations(draft + RT.referralOnce(draft, RT.referralTail(FIQH[0], 'sharia_ruling', 0))), []);

    // ── the depth instruction ─────────────────────────────────────────────
    ok('buildDepthInstruction is exported so it can be run',
      typeof ASK.buildDepthInstruction === 'function');
    if (typeof ASK.buildDepthInstruction === 'function') {
      eq('brief mode injects nothing at all', ASK.buildDepthInstruction('brief'), '');
      const deep = ASK.buildDepthInstruction('deep');
      ok('deep mode still asks for depth', typeof deep === 'string' && deep.length > 200);
      // THE MEASURED DEFECT: the مفصّل template opened every answer with a section literally
      // called «تمهيد». Depth is a property of the content, not a heading to fill in.
      ok('deep mode no longer mandates a «تمهيد» section',
        !/\*\*تمهيد:?\*\*/u.test(deep), deep.slice(0, 200));
      ok('...and mandates no fixed heading template at all',
        !/رتّبِ الجوابَ في هذه الأقسامِ بعناوينَ صريحةٍ/u.test(deep));
      ok('...and says so positively, so deleting the rule is caught too',
        /ولا تفرِضْ على الجوابِ قالبَ عناوينَ ثابتًا/u.test(deep));
      eq('deep mode asks for no preamble line', preambleMandates(deep), []);
      // scholar mode is a presentation mode, not a preamble, and must stay itself.
      const scholar = ASK.buildDepthInstruction('scholar');
      ok('scholar mode is still there', typeof scholar === 'string' && scholar.length > 200);
      eq('scholar mode asks for no preamble line', preambleMandates(scholar), []);
    }
  }

  // =========================================================================
  console.log('\n=== G. THE HANDLER STILL PASSES THE MEASURED OUTCOME ===');
  {
    // The one thing that cannot be proven by running a pure function: that the live handler feeds
    // it the outcome rather than the subject. Its full treatment is in referral-tail-guard.cjs.
    const ask = read('api/ask.js');
    ok('api/ask.js computes the tail from the outcome the server measured',
      /referralTail\(questionText, topicClass, [A-Za-z]\w*, [A-Za-z][\w.]*\)/.test(ask));
    ok('...and the source cards remain the last thing in the reply',
      /referralBlockFor/.test(ask));
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
