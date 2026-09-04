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

  let SP = null, RT = null, ASK = null, CORE = null, IMP = null, TAKH = null, EA = null, LOOP = null;
  try {
    SP = await esm('lib/system-prompt.js');
    RT = await esm('lib/policy/referral-tail.js');
    CORE = await esm('lib/policy/core.js');
    IMP = await esm('lib/policy/impermissible-request.js');
    TAKH = await esm('lib/policy/takhrij-disclosure.js');
    EA = await esm('lib/empty-answer.js');
    LOOP = await esm('lib/free-brain/loop.js');
    ASK = await esm('api/ask.js');
  } catch (e) {
    ok('the real modules load', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }

  // =========================================================================
  console.log('\n=== A0. THE DELIVERED ANSWER ENDS AT ITS CONTENT ===');
  {
    const CONTENT = '\u{627}\u{644}\u{62C}\u{648}\u{627}\u{628} \u{64A}\u{628}\u{642}\u{649}.';
    const CLOSING = '\u{646}\u{639}\u{645}.';
    const OFFER = '\u{62A}\u{628}\u{63A}\u{649} \u{648}\u{627}\u{62D}\u{62F}\u{627} \u{622}\u{62E}\u{631}\u{61F}';
    const delivered = (value) => LOOP.deliverableText(value, []);

    eq('the measured final reader offer is removed', delivered(CONTENT + '\n\n' + OFFER), CONTENT);
    eq('the same words stay when their block is not last',
      delivered(CONTENT + '\n' + OFFER + '\n' + CLOSING), CONTENT + '\n' + OFFER + '\n' + CLOSING);
    eq('an offer standing alone cannot erase the answer', delivered(OFFER), OFFER);
    eq('a final question carrying a citation stays',
      delivered(CONTENT + '\n[[1]] ' + OFFER), CONTENT + '\n[[1]] ' + OFFER);
    eq('a final question carrying a card stays',
      delivered(CONTENT + '\n<source>proof</source> ' + OFFER),
      CONTENT + '\n<source>proof</source> ' + OFFER);
    eq('a final question carrying an ayah wrapper stays',
      delivered(CONTENT + '\n\u{FD3F}\u{646}\u{635}\u{FD3E} ' + OFFER),
      CONTENT + '\n\u{FD3F}\u{646}\u{635}\u{FD3E} ' + OFFER);
    eq('a final question carrying transmitted text stays',
      delivered(CONTENT + '\n\u{AB}\u{646}\u{635}\u{BB} ' + OFFER),
      CONTENT + '\n\u{AB}\u{646}\u{635}\u{BB} ' + OFFER);
    eq('a legitimate final question without the reader-offer token stays',
      delivered(CONTENT + '\n\u{647}\u{644} \u{647}\u{630}\u{627} \u{635}\u{62D}\u{64A}\u{62D}\u{61F}'),
      CONTENT + '\n\u{647}\u{644} \u{647}\u{630}\u{627} \u{635}\u{62D}\u{64A}\u{62D}\u{61F}');
    eq('an unclosed code fence protects its final line',
      delivered('```text\n' + OFFER), '```text\n' + OFFER);
  }

  // =========================================================================
  console.log('\n=== A0/AA-72. A LIST DOES NOT BEGIN AT THE SECOND ===');
  {
    // WHAT THIS DEFENDS, AND WHICH RULE PRODUCED IT. `deliverableText` removes a line of
    // machine narration whose script is not the reader's -- `isForeignScriptLine`, measured
    // at share 1.000 on the line below. When that line wore a list marker, the marker went
    // with it and items 2..n kept their numbers: the reader was handed a list beginning at
    // the second. The item may not live (it is exactly the class that rule was measured to
    // remove), so the numbering is renormalised instead.
    //
    // The three ordinary lists below are the other half of the claim: a run that lost
    // nothing is rewritten to the numbers it already carried, so it comes out byte for byte
    // identical -- which is what makes the renumbering safe to have at all.
    const delivered2 = (value) => LOOP.deliverableText(value, []);
    const EN_NARRATION = "I'll research each of these five questions in the authoritative sources.";
    const A = '\u0627\u0644\u062d\u0643\u0645 \u062c\u0627\u0626\u0632.';
    const B = '\u0627\u0644\u062f\u0644\u064a\u0644 \u0635\u062d\u064a\u062d.';
    const C = '\u0648\u0627\u0644\u062e\u0644\u0627\u0635\u0629 \u0645\u0633\u062a\u062d\u0628.';

    const BROKEN = '1. ' + EN_NARRATION + '\n2. ' + A + '\n3. ' + B;
    eq('the list whose first item was machine narration begins at ONE',
      delivered2(BROKEN), '1. ' + A + '\n2. ' + B);
    eq('...and an Arabic-Indic list stays Arabic-Indic',
      delivered2('\u0661. ' + EN_NARRATION + '\n\u0662. ' + A + '\n\u0663. ' + B),
      '\u0661. ' + A + '\n\u0662. ' + B);
    eq('...and a list the model deliberately began at three still begins at three',
      delivered2('3. ' + EN_NARRATION + '\n4. ' + A + '\n5. ' + B),
      '3. ' + A + '\n4. ' + B);

    // THE THREE ORDINARY LISTS. Nothing is removed, so nothing may move.
    const PLAIN_DOT = '1. ' + A + '\n2. ' + B + '\n3. ' + C;
    const PLAIN_PAREN = '1) ' + A + '\n2) ' + B + '\n3) ' + C;
    const PLAIN_TEN = Array.from({ length: 10 }, (_, i) => (i + 1) + '. ' + A).join('\n');
    eq('an ordinary numbered list is byte-identical', delivered2(PLAIN_DOT), PLAIN_DOT);
    eq('...with the other delimiter too', delivered2(PLAIN_PAREN), PLAIN_PAREN);
    eq('...and across the two-digit boundary', delivered2(PLAIN_TEN), PLAIN_TEN);

    // AND THE THINGS THAT ARE NOT LISTS.
    eq('a bulleted list is untouched', delivered2('- ' + A + '\n- ' + B), '- ' + A + '\n- ' + B);
    eq('two years at the head of two lines are not a run',
      delivered2('2026. ' + A + '\n' + EN_NARRATION + '\n2027. ' + B),
      '2026. ' + A + '\n\n2027. ' + B);
    eq('a repeated marker (1, 1, 1) is not a run and is not renumbered',
      delivered2('1. ' + A + '\n1. ' + EN_NARRATION + '\n1. ' + B),
      '1. ' + A + '\n\n1. ' + B);
  }

  // =========================================================================
  console.log('\n=== A0/AA-72 MUTANT ===');
  {
    // The twin carries the same source with the renumbering removed, its relative imports
    // rewritten to absolute file URLs so nothing in lib/ is touched -- the idiom
    // guards/truncated-tag-fallback-par-a-guard.cjs already uses.
    const os = require('os');
    const { pathToFileURL } = require('url');
    const REL = 'lib/free-brain/loop.js';
    const HOME = path.join(REPO, 'lib', 'free-brain');
    const original = read(REL);
    const SEAM = '  const renumbered = renumberBrokenRuns(lines, kept, prose);';
    const changed = original.replace(SEAM, '  const renumbered = kept; // mutant: the stale numbering stands');
    if (ok('AA-72 mutant seam applied', changed !== original, 'the seam moved: nothing was tested')) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-aa72-mut-'));
      const absolute = changed.replace(
        /from\s+(['"])(\.[^'"]*)\1/gu,
        (_all, quote, spec) => 'from ' + quote + pathToFileURL(path.resolve(HOME, spec)).href + quote,
      );
      const twin = path.join(dir, 'loop-aa72-mutant.mjs');
      fs.writeFileSync(twin, absolute, 'utf8');
      let alive = true;
      try {
        const M = await import(pathToFileURL(twin).href);
        const EN_NARRATION = "I'll research each of these five questions in the authoritative sources.";
        const A = '\u0627\u0644\u062d\u0643\u0645 \u062c\u0627\u0626\u0632.';
        const B = '\u0627\u0644\u062f\u0644\u064a\u0644 \u0635\u062d\u064a\u062d.';
        const out = M.deliverableText('1. ' + EN_NARRATION + '\n2. ' + A + '\n3. ' + B, []);
        alive = out === '1. ' + A + '\n2. ' + B;
      } catch (e) { alive = false; }
      finally { fs.rmSync(dir, { recursive: true, force: true }); }
      ok('MUTANT KILLED: without the renumbering the list begins at the second', !alive,
        'the mutant survived -- this property is not guarded');
    }
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
      // قرار ٩. The reply sent when the model streamed a clean 200 and said nothing. It is class
      // (ب) for the same reason as the rest of this list — the system declaring a limit rather
      // than answering — so the detector must stay silent on it too.
      ['EMPTY_ANSWER_APOLOGY', EA.EMPTY_ANSWER_APOLOGY],
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

  // =========================================================================
  console.log('\n=== H. AND THE CARDS CARRY NO FIXED SENTENCE EITHER (جولةُ الوسوم) ===');
  // Sections A–G police the PROSE of a reply. A card is the other half of the surface, and it
  // had the same defect in a place no prose detector could see: above every <steps> list the
  // client printed one unchanging heading, «خُطُوَاتٌ تُسَاعِدُك». The owner met it above a list
  // of أعذار شرعيّة — a heading that described nothing under it — and ruled: «ماله داعي الجمله
  // هذي اصلا، لازم تكون كلمه بديله حسب الصياغ وتتماشى معاه، وليست جمله تظهر في كل مره».
  //
  // Measured the same way as the rest of this gate: the client's own decision functions are
  // SPLICED OUT OF index.html AND RUN. A gate that grepped for the sentence would pass the day
  // someone re-introduced it under a different spelling.
  {
    // ITEM 32: the client is index.html + app.jsx since the JSX left the page.
    const html = require('../tools/babel-block.cjs').readShippedClient('index.html').replace(/\r\n/g, '\n');
    const cut = (from, to) => {
      const a = html.indexOf(from);
      if (a < 0) return null;
      const b = html.indexOf(to, a);
      return b < 0 ? null : html.slice(a, b + to.length);
    };
    const helpers = cut('const readStepsTitle =', 'return { narrator: n, ruling: r };\n};');
    let CL = null;
    if (ok('index.html still defines the shared card-attribution helpers', helpers !== null)) {
      const vm2 = require('vm');
      const box = {};
      vm2.createContext(box);
      try {
        vm2.runInContext(helpers + '\nthis.readStepsTitle = readStepsTitle;'
          + '\nthis.resolveHadithAttribution = resolveHadithAttribution;', box);
        CL = box;
      } catch (e) { ok('...and they evaluate', false, e.message); }
    }
    if (CL) {
      // ── البند ١: the heading comes from the answer, or there is none ──────
      eq('a <steps> tag with no title yields NO heading', CL.readStepsTitle(''), '');
      eq('a <steps title> yields exactly that title',
        CL.readStepsTitle(' title="أَعْذَارٌ شَرْعِيَّة"'), 'أَعْذَارٌ شَرْعِيَّة');
      // ── البند ٢: «رَوَى {a ruling}» is extinct ────────────────────────────
      // NEGATIVE witness — the exact input the owner's sample produced.
      eq('NEGATIVE: narrator="متفق عليه" ruling="متفق عليه" → the رَوَى line is dropped',
        CL.resolveHadithAttribution('متفق عليه', 'متفق عليه'),
        { narrator: '', ruling: 'متفق عليه' });
      // POSITIVE witness — a real مخرِّج is untouched, which is what stops an over-eager fix.
      eq('POSITIVE: narrator="البخاري" ruling="صحيح" → the usual shape survives',
        CL.resolveHadithAttribution('البخاري', 'صحيح'),
        { narrator: 'البخاري', ruling: 'صحيح' });
      eq('a ruling alone in narrator is PROMOTED, never lost',
        CL.resolveHadithAttribution('صحيح', ''), { narrator: '', ruling: 'صحيح' });
      eq('a مخرِّج whose name merely contains a ruling word survives',
        CL.resolveHadithAttribution('الحسن البصري', 'صحيح'),
        { narrator: 'الحسن البصري', ruling: 'صحيح' });
      // ── قرار ١١: the card prints «رَوَى {المخرِّج}», so a narrator that already carries
      // the verb printed it twice — «رَوَى رواه البخاري». The name alone is what belongs there.
      eq('«رواه البخاري» → the verb is stripped and the name kept',
        CL.resolveHadithAttribution('رواه البخاري', 'صحيح'),
        { narrator: 'البخاري', ruling: 'صحيح' });
      eq('«أخرجه مسلم» → the same, on the other verb',
        CL.resolveHadithAttribution('أخرجه مسلم', ''),
        { narrator: 'مسلم', ruling: '' });
      // Vocalised and shadda'd spellings are ONE case, because the model writes vocalised Arabic.
      eq('«رَوَاهُ البخاريُّ» → decided on the normalised form, cut from the raw one',
        CL.resolveHadithAttribution('رَوَاهُ البخاريُّ', ''),
        { narrator: 'البخاريُّ', ruling: '' });
      eq('«خرّجه الترمذي» → shadda is not a second verb',
        CL.resolveHadithAttribution('خرّجه الترمذي', ''),
        { narrator: 'الترمذي', ruling: '' });
      // THE ORDERING REGRESSION. «رواه الشيخان» is a RULING phrase already on the registered list;
      // stripping the prefix before testing for one would turn it into a narrator «الشيخان» and
      // silently retire a rule that predates this decision.
      eq('«رواه الشيخان» is still read as a ruling, not stripped into a name',
        CL.resolveHadithAttribution('رواه الشيخان', ''),
        { narrator: '', ruling: 'رواه الشيخان' });
      // A one-word narrator is never verb+name, and must not be emptied.
      eq('a bare «البخاري» is untouched', CL.resolveHadithAttribution('البخاري', ''),
        { narrator: 'البخاري', ruling: '' });
      // ...and a name that merely BEGINS like the verb is not a verb.
      eq('«رواد السنة» is not a narration verb', CL.resolveHadithAttribution('رواد السنة', ''),
        { narrator: 'رواد السنة', ruling: '' });
    }
    // ── every printer routes through the shared decision, none re-implements it ──
    // FOUR surfaces render a reply: the visible card, the voice, the parents' log, the clipboard.
    // Before this round each carried its OWN copy of the fixed heading — which is exactly why
    // removing it from the card alone would have left three of them still printing it.
    //
    // The two families reach the shared rule differently, and the difference is real:
    //   • hadith — all four printers call resolveHadithAttribution directly.
    //   • steps  — three surfaces parse the raw tag (parser / voice / log) and so call
    //     readStepsTitle; the card and the clipboard consume the title the PARSER already put on
    //     the segment. So the count is 3, and the last two are checked by their wiring instead.
    const HADITH_PRINTERS = (html.match(/resolveHadithAttribution\(/g) || []).length;
    ok('all four hadith printers route through the shared attribution rule',
      HADITH_PRINTERS === 4, 'found ' + HADITH_PRINTERS + ' call sites, expected 4');
    const STEPS_PARSERS = (html.match(/readStepsTitle\(/g) || []).length;
    ok('all three tag-reading surfaces take the steps title from the tag',
      STEPS_PARSERS === 3, 'found ' + STEPS_PARSERS + ' call sites, expected 3');
    ok('...the parser puts the title on the segment',
      /segments\.push\(\{ type: 'steps', items, title: readStepsTitle\(attrsStr\) \}\)/.test(html));
    ok('...the card is handed it rather than inventing one',
      /<StepsCard key=\{i\} items=\{seg\.items\} title=\{seg\.title\} \/>/.test(html));
    ok('...and the clipboard reads it too', /sg\.title \|\| ''\)\.trim\(\)/.test(html));
    // ── and the fixed sentences are gone as PRINTED text, in both spellings the file uses ──
    // index.html writes Arabic literally in most places and as \uXXXX escapes in the clipboard
    // serializers. A check that knew only one form would be blind to the other half of the file.
    const escapeOf = (s) => Array.from(s).map((c) => (c.codePointAt(0) < 128 ? c
      : String.fromCharCode(92) + 'u' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))).join('');
    for (const phrase of ['خُطُوَاتٌ تُسَاعِدُك', 'خُطُوَاتٌ تُسَاعِدُكِ']) {
      for (const form of [phrase, escapeOf(phrase)]) {
        const live = html.split('\n')
          .map((l, i) => [i + 1, l])
          .filter(([, l]) => l.includes(form) && !/^\s*(\/\/|\*|<!--)/.test(l));
        ok('no live print site for «' + phrase.slice(0, 12) + '…» ('
          + (form === phrase ? 'literal' : '\\u-escaped') + ')',
          live.length === 0, live.map(([n, l]) => n + ': ' + l.trim().slice(0, 120)).join('\n        '));
      }
    }
  }

  // =========================================================================
  console.log('\n=== I. AND THE GENERATOR IS TAUGHT ALL THREE, POSITIVELY ===');
  // Absence-only checks pass when the whole rule is deleted. These fail then.
  {
    const p = PROMPTS.get('adult / fiqh reader') || '';
    ok('the prompt teaches <steps title=…>', /<steps title="[^"]+">/u.test(p));
    ok('...and says an absent title means NO heading, not a fallback',
      /فاترك الخاصّيّةَ كلَّها/u.test(p));
    ok('...and forbids one recurring wording for it',
      /ولا صيغةً واحدةً تتكرّرُ في كلِّ ردّ/u.test(p));
    ok('the prompt forbids template headings by name («النصيحة الذهبية» and its kind)',
      /لا عناوينَ قالبيّةً ثابتة/u.test(p));
    ok('the prompt keeps narrator and ruling optional and in separate boxes',
      p.includes('خاصّيتا narrator وruling اختياريّتان')
        && p.includes('إذا أضفتَ الخاصّيتينِ فلا تتبادلان'));
    ok('...and binds each box to its own evidenced meaning instead of model memory',
      p.includes('narrator = **المُخرِّجُ حصرًا**')
        && p.includes('ruling = **الدرجةُ حصرًا**')
        && p.includes('لا تجعلْ ذاكرتَك مصدرًا لمُخرِّجٍ أو درجةٍ أو تخريج'));
    // البند ٣: the buttons stay, the BLIND mandate goes.
    ok('suggestions are conditional, not mandatory on every reply',
      /الاقتراحاتُ بحسبِ المقام لا بحكمِ العادة/u.test(p));
    ok('...and leaving them out is named as CORRECT, not as a shortfall',
      /ترْكُها حينئذٍ هو الصواب، لا نقصٌ في الرد/u.test(p));
    // ITEM 116: `p` falls back to '' when the prompt key is renamed, and '' contains no blind
    // checklist question either -- so this one absence check would pass while reading nothing
    // even though every positive check above it went red. It carries its own precondition.
    ok('...and the old blind checklist question is gone',
      p.length > 0 && !/هَلْ أَنْهَيْتُ رَدِّي بِاقْتِرَاحَاتٍ لِلْمُتَابَعَة؟ → يَجِبُ/u.test(p));
    // The BUTTONS themselves are untouched — the owner kept them.
    const html2 = require('../tools/babel-block.cjs').readShippedClient('index.html');
    ok('the <suggestions> printer is untouched — the buttons stay',
      /suggestions = items;/.test(html2) && /onSuggestionClick/.test(html2));
  }

  // =========================================================================
  console.log('\n=== J. AN ANSWER OF ZERO BYTES IS THE LAST SHAPE VIOLATION (قرار ٩) ===');
  // The shape rules above all police what surrounds the content. This one polices whether there
  // is any content at all: the model ends a stream having emitted no text, the request succeeds
  // at every layer, and the reader is shown an empty bubble.
  //
  // DRIVEN, NOT GREPPED. The guard is a response wrapper, so the witness is a response: a real
  // SSE stream is played into it and what comes out the other side is read back.
  {
    const mkRes = () => {
      const r = { writes: [], statusCode: 0, headers: {}, ended: 0 };
      r.status = (c) => { r.statusCode = c; return r; };
      r.setHeader = (k, v) => { r.headers[k] = v; return r; };
      r.flushHeaders = () => {};
      r.write = (s) => {
        r.writes.push(typeof s === 'string' ? s
          : Buffer.from(s.buffer || s, s.byteOffset || 0, s.byteLength || s.length).toString('utf8'));
        return true;
      };
      r.end = (s) => { if (s) r.writes.push(String(s)); r.ended += 1; return r; };
      return r;
    };
    const openSse = (r) => { r.status(200); r.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); };
    const delta = (t) => 'data: ' + JSON.stringify({
      type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t },
    }) + '\n\n';
    const STOP = 'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n';
    const body = (r) => r.writes.join('');
    const apologised = (r) => body(r).indexOf(EA.EMPTY_ANSWER_APOLOGY) !== -1;

    // THE WITNESS THE DECISION ASKS FOR: a stream that ends with zero text.
    {
      const r = EA.guardEmptyAnswer(mkRes(), 'witness');
      openSse(r); r.write(STOP); r.end();
      ok('an empty 200 stream is answered with the apology, not with silence', apologised(r));
      // ...and it arrives in the ONE frame shape the live client parses (index.html handleEvent),
      // which is what makes it visible rather than merely present.
      const frames = body(r).split('\n').filter((l) => l.startsWith('data:'))
        .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } }).filter(Boolean);
      ok('...as a content_block_delta/text_delta the client renders',
        frames.some((f) => f.type === 'content_block_delta' && f.delta
          && f.delta.type === 'text_delta' && f.delta.text === EA.EMPTY_ANSWER_APOLOGY));
    }
    // THE NEGATIVE. A gate that only proves the apology can appear would pass while it appeared
    // on every reply in the app.
    {
      const r = EA.guardEmptyAnswer(mkRes(), 'witness');
      openSse(r); r.write(delta('الوترُ سنّةٌ مؤكّدة.')); r.write(STOP); r.end();
      ok('a stream that DID say something is left exactly as it was', !apologised(r));
    }
    // An error stream already said something and has its own client handling.
    {
      const r = EA.guardEmptyAnswer(mkRes(), 'witness');
      openSse(r);
      r.write('data: ' + JSON.stringify({ type: 'error', error: { message: 'upstream 429' } }) + '\n\n');
      r.end();
      ok('an error stream is not overwritten with a generic apology', !apologised(r));
    }
    // A JSON refusal (429 day cap, 400 bad body) is not an event-stream and carries no delta.
    {
      const r = EA.guardEmptyAnswer(mkRes(), 'witness');
      r.status(429); r.setHeader('Content-Type', 'application/json; charset=utf-8');
      r.end(JSON.stringify({ error: 'day-cap-reached' }));
      ok('a non-SSE response is untouched', !apologised(r));
    }
    // Whitespace is not an answer.
    {
      const r = EA.guardEmptyAnswer(mkRes(), 'witness');
      openSse(r); r.write(delta('\n   \n')); r.write(STOP); r.end();
      ok('a stream carrying only whitespace counts as empty', apologised(r));
    }

    // ── AND ALL THREE ROUTES ACTUALLY INSTALL IT ──────────────────────────
    // The wrapper is only worth anything on a response that was wrapped.
    for (const rel of ['api/ask.js']) {
      const s = read(rel);
      ok(rel + ' installs the empty-answer guard',
        /import \{ guardEmptyAnswer \} from '\.\.\/lib\/empty-answer\.js';/.test(s)
        && /guardEmptyAnswer\(res, '/.test(s));
    }
    for (const rel of ['api/chat.js', 'api/chat-fast.js']) {
      const source = read(rel);
      ok(rel + ' cannot emit an empty answer because it is a 410 tombstone',
        /status\(410\)/.test(source)
        && /RETIRED_CHAT_REPLACEMENT = '\/api\/ask'/.test(source)
        && !/guardEmptyAnswer|getReader\(\)/.test(source));
    }
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
