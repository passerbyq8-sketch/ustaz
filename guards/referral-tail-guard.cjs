// guards/referral-tail-guard.cjs — THE REFERRAL IS THE SERVER'S SENTENCE, AND IT NEVER TOUCHES A
// FROZEN ACT OF WORSHIP.
//
// ── WHY THE SERVER OWNS IT ───────────────────────────────────────────────────
// «عزك ناقلٌ لا مفتٍ»: he transmits a ruling from a page and points the reader at the people who
// actually issue rulings. When that pointer is owed, it must be there whether or not the model
// chose to write one — an instruction is a request, and the model omits it exactly when the answer
// sounded most confident. So the server appends it, deterministically, from wordings it owns.
//
// ── AND WHEN IS IT OWED? A MEASURED REFERRAL, NEVER A SUBJECT ────────────────
// (تكليفُ «شكلِ الجواب» — ٨ أغسطس ٢٠٢٦، البند ٣)
//
// It used to be owed to a topic class, which meant every ordinary fiqh answer ended with a fixed
// footer. The owner ruled that shape out: «لا يذكر شي غير الاجابات، والمصادر اصلا مذيله في كل
// مره». So the trigger is now the server's own measured referral outcome, and this gate asserts
// the inversion in BOTH directions — a fatwa gets nothing, a measured referral still does.
//
// The transmitter-not-mufti rule did not move. It is a measured behaviour — a ruling comes from a
// fetched page carrying its own source card — not a sentence about itself.
//
// ── AND WHY IT VARIES ────────────────────────────────────────────────────────
// One sentence repeated at the bottom of every answer is a sentence nobody reads. The set is
// rotated so successive answers in one conversation do not end identically — banner blindness is
// the failure mode a fixed footer walks straight into.
//
// ── THE LINE IT MAY NEVER CROSS ──────────────────────────────────────────────
// The frozen acts of worship — الصلاة، الوضوء، الغُسل، التيمّم، الأذكار. The constitution is
// explicit and this gate is its enforcement:
//
//   «لا بيروقراطية فيها إطلاقًا: اتلُ القالب كاملًا كوحدة ثابتة، ولا تقطعه بسؤال ولا تذيّله به»
//
// A child following the steps of wudu must reach the end of them and stop, not be handed a
// disclaimer. Nor is تفسير، سيرة or حديث a fatwa: reporting what a verse means or what a hadith
// says is not issuing a ruling, and appending a fatwa referral to it is noise.
//
// Usage: node guards/referral-tail-guard.cjs
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

(async function main() {
  console.log('=== referral-tail-guard — the server\'s sentence, never on a frozen act of worship ===');

  let RT = null;
  try { RT = await esm('lib/policy/referral-tail.js'); }
  catch (e) {
    ok('lib/policy/referral-tail.js loads', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }

  // =========================================================================
  console.log('\n=== A. THE SET IS THE SERVER\'S, AND IT IS A SET ===');
  {
    ok('the wordings are declared as data', Array.isArray(RT.REFERRAL_TAILS));
    ok('...and there are enough of them to defeat banner blindness',
      RT.REFERRAL_TAILS.length >= 4, String(RT.REFERRAL_TAILS.length));
    ok('...and they are frozen', Object.isFrozen(RT.REFERRAL_TAILS));
    ok('every wording is distinct', new Set(RT.REFERRAL_TAILS).size === RT.REFERRAL_TAILS.length);
    ok('every wording refers the reader to people, and issues no ruling of its own',
      RT.REFERRAL_TAILS.every((t) => /أهل العلم|المفتي|دار الإفتاء|عالم|مفتٍ|اللجنة/.test(t))
      && RT.REFERRAL_TAILS.every((t) => !/يجوز|لا يجوز|حرام|واجب|الأحوط/.test(t)),
      JSON.stringify(RT.REFERRAL_TAILS));
    ok('the module makes no model call and no network call',
      !/fetch\(|ANTHROPIC|callModel/.test(read('lib/policy/referral-tail.js')));
  }

  // =========================================================================
  console.log('\n=== B. A SUBJECT IS NOT A REFERRAL — THE FATWA FOOTER IS GONE ===');
  {
    // THE WHOLE OF البند ٣. Every one of these used to end with one of the five wordings, on the
    // strength of its topic class alone. That is the fixed footer the owner removed, and the
    // measurement is here rather than in a live probe because a class is a pure function.
    const RULINGS = [
      ['a fatwa', 'ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling'],
      ['a financial transaction', 'ما حكم التعامل بالعملات الرقمية؟', 'sharia_ruling'],
      ['a family matter', 'ما حكم الطلاق في الغضب؟', 'sharia_ruling'],
      ['a contemporary nazila', 'ما حكم التأمين الصحي الإلزامي؟', 'sharia_ruling'],
      ['a creed question', 'ما معنى توحيد الأسماء والصفات؟', 'sharia_ruling'],
      ['a named scholar\'s position', 'ما رأي ابن باز في التصوير؟', 'scholar_position'],
      ['a ruling about prayer', 'هل تجب صلاة الجماعة على المسافر؟', 'sharia_ruling'],
      ['a ruling about abandoning prayer', 'ما حكم من ترك الصلاة تكاسلًا؟', 'sharia_ruling'],
    ];
    for (const [label, q, cls] of RULINGS) {
      // Asserted across the rotation: a footer that returned on turn 3 would be just as fixed.
      let leaked = '';
      for (let turn = 0; turn < 6; turn++) {
        const t = RT.referralTail(q, cls, turn);
        if (t) { leaked = 'turn ' + turn + ' → ' + t; break; }
      }
      eq(label + ' gets NO tail from its subject', leaked, '');
    }
    // ...AND NOT BECAUSE THE ARGUMENT IS MISSING. An omitted 4th argument and an outcome that is
    // simply not a referral must both be silent, or the gate would pass on a caller that forgot.
    for (const bogus of ['', 'ALLOW', 'ALLOW_LIMITED', 'SAFETY_REDIRECT', 'nonsense', null, undefined]) {
      eq('a non-referral outcome ' + JSON.stringify(bogus) + ' is silent',
        RT.referralTail('ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling', 0, bogus), '');
    }
  }

  // =========================================================================
  console.log('\n=== B2. AND A MEASURED REFERRAL STILL GETS ONE ===');
  {
    // The mechanism is scoped, not deleted. If this section ever goes quiet, the tail has become
    // dead code and the next reader should be told so rather than left to guess.
    ok('the measured outcomes are declared as data',
      Array.isArray(RT.MEASURED_REFERRAL_OUTCOMES) && RT.MEASURED_REFERRAL_OUTCOMES.length >= 1,
      JSON.stringify(RT.MEASURED_REFERRAL_OUTCOMES));
    ok('...and frozen', Object.isFrozen(RT.MEASURED_REFERRAL_OUTCOMES));
    ok('the condition is exported under an explicit name',
      typeof RT.isMeasuredReferralCase === 'function');
    for (const o of RT.MEASURED_REFERRAL_OUTCOMES) {
      ok('«' + o + '» is recognised as a measured referral', RT.isMeasuredReferralCase(o));
      const t = RT.referralTail('ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling', 0, o);
      ok('...and a ruling under it still gets the server\'s sentence', t !== '', o);
      ok('...and it is one of the server\'s own wordings', RT.REFERRAL_TAILS.includes(t));
    }
    ok('a subject the server did not measure is not a referral',
      !RT.isMeasuredReferralCase('sharia_ruling') && !RT.isMeasuredReferralCase(''));
    // THE CONDITION IS NAMED IN THE CODE AND POINTS AT THE ASSIGNMENT (البند ٣ asks for exactly
    // this, so that the next reader finds the reason and not just the behaviour).
    const src = read('lib/policy/referral-tail.js');
    ok('the module names the condition and records why it changed',
      /MEASURED_REFERRAL_OUTCOMES/.test(src) && /شكلِ الجواب/.test(src), 'missing the named condition or its note');
  }

  // =========================================================================
  console.log('\n=== C. WHERE IT IS NOT ===');
  {
    // MEASURED UNDER A REAL REFERRAL OUTCOME, or this section would pass on the outcome gate alone
    // and stop saying anything about the class exclusions it was written for.
    const REFERRED = RT.MEASURED_REFERRAL_OUTCOMES[0];
    for (const [label, q, cls] of [
      ['tafsir', 'ما معنى قوله تعالى في هذه الآية؟', 'tafsir'],
      ['hadith', 'ما صحة حديث إنما الأعمال بالنيات؟', 'hadith'],
      ['sira / biography', 'من هو الإمام البخاري؟', 'biography'],
      ['a quote check', 'هل قال ابن تيمية هذه العبارة؟', 'quote_verification'],
      ['an ordinary question', 'كيف أرتب يومي؟', 'general_knowledge'],
    ]) eq(label + ' gets no referral', RT.referralTail(q, cls, 0, REFERRED), '');
  }

  // =========================================================================
  console.log('\n=== D. AND NEVER, EVER, ON A FROZEN ACT OF WORSHIP ===');
  {
    // The constitution: «لا بيروقراطية فيها إطلاقًا … ولا تقطعه بسؤال ولا تذيّله به».
    const WORSHIP = [
      'كيف أتوضأ؟',
      'ما صفة الوضوء الصحيح؟',
      'علمني صفة الصلاة كاملة',
      'كيف أصلي الفجر؟',
      'ما هي صفة الغسل من الجنابة؟',
      'كيف أتيمم؟',
      'ما هي أذكار الصباح؟',
      'علمني أذكار النوم',
      'كم عدد ركعات صلاة الظهر وكيف أؤديها؟',
    ];
    // ASSERTED UNDER A REAL REFERRAL OUTCOME. Under a non-referral outcome every one of these is
    // silent for the outcome's sake, which would prove nothing about the worship exclusion — and
    // the worship exclusion is the one line in this file that is a constitutional guarantee.
    const REFERRED = RT.MEASURED_REFERRAL_OUTCOMES[0];
    for (const q of WORSHIP) {
      ok('no tail on «' + q + '»', RT.isFrozenWorshipQuestion(q), 'it must be recognised as frozen');
      // ASSERTED UNDER EVERY CLASS AND EVERY ROTATION, because the class is the thing most likely
      // to be wrong here: «كيف أتوضأ؟» is a `sharia_ruling` to the classifier.
      for (const cls of ['sharia_ruling', 'scholar_position', 'tafsir', 'hadith']) {
        for (let turn = 0; turn < 6; turn++) {
          if (RT.referralTail(q, cls, turn, REFERRED) !== '') {
            ok('...and none under ' + cls + ' turn ' + turn, false, q);
            turn = 6; break;
          }
        }
      }
    }
    ok('every worship question above is silent under every class and rotation', true);

    const CASE_QUALIFIED = [
      'كيف يصلي المريض الذي لا يستطيع القيام؟',
      'ما صفة صلاة الجنازة؟',
      'اذكر لي مبطلات الصلاة.',
      'هل يجوز أن أصلي جالسًا؟',
      'هل تصح صلاتي إذا نسيت ركعة؟',
      'ماذا يلزمني إذا نسيت ركعة من الصلاة؟',
    ];
    for (const q of CASE_QUALIFIED) {
      ok('D-2 qualified case is not a frozen general description: «' + q + '»',
        !RT.isFrozenWorshipQuestion(q));
      ok('D-2 qualified case continues through the ruling path: «' + q + '»',
        RT.REFERRAL_TAILS.includes(RT.referralTail(q, 'sharia_ruling', 0, REFERRED)));
    }
    ok('D-2 carries at least three independently derived negative witnesses', CASE_QUALIFIED.length >= 3);
  }

  // =========================================================================
  console.log('\n=== E. IT VARIES ACROSS SUCCESSIVE ANSWERS ===');
  {
    // Under a measured referral — the only place a tail exists at all now.
    const R = RT.MEASURED_REFERRAL_OUTCOMES[0];
    const q = 'ما حكم بيع الذهب بالتقسيط؟';
    const seq = [0, 1, 2, 3].map((t) => RT.referralTail(q, 'sharia_ruling', t, R));
    eq('four successive answers give four different wordings', new Set(seq).size, 4);
    ok('...and every one of them is from the server\'s set',
      seq.every((s) => RT.REFERRAL_TAILS.includes(s)));
    eq('the rotation is deterministic — the same turn gives the same wording',
      RT.referralTail(q, 'sharia_ruling', 2, R), seq[2]);
    ok('a negative or absurd turn index still returns a wording, not a crash',
      RT.REFERRAL_TAILS.includes(RT.referralTail(q, 'sharia_ruling', -7, R))
      && RT.REFERRAL_TAILS.includes(RT.referralTail(q, 'sharia_ruling', 1e9, R)));
  }

  // =========================================================================
  console.log('\n=== F. THE HANDLER APPENDS IT, THE MODEL DOES NOT WRITE IT ===');
  {
    const ask = read('api/ask.js');
    ok('the handler imports the server-owned set',
      /from '\.\.\/lib\/policy\/referral-tail\.js'/.test(ask));
    ok('...and computes the tail from the topic the server classified',
      /referralTail\(questionText, topicClass,/.test(ask));
    ok('...and rotates it on the conversation\'s own turn count',
      /referralTail\(questionText, topicClass, [A-Za-z]/.test(ask));
    // ...AND PASSES THE MEASURED OUTCOME. Without the 4th argument the tail is silent everywhere,
    // which LOOKS like compliance with البند ٣ while actually being a caller that forgot — and the
    // day a measured referral surface needs the sentence, nobody would find out why it never came.
    ok('...and passes the outcome the server measured, not the subject alone',
      /referralTail\(questionText, topicClass, [A-Za-z]\w*, [A-Za-z][\w.]*\)/.test(ask),
      'api/ask.js must call referralTail(question, class, turn, ageAccess.outcome)');
    // THE MODEL IS NEVER ASKED FOR IT. A prompt instruction is a request; this is an append.
    const code = ask.replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/(^|[^:])\/\/[^\r\n]*/, '$1')).join('\n');
    ok('no instruction asks the model to write a referral tail',
      !/اختمْ بإحالة|واختم الجواب بإحالة|أضف في آخر الجواب إحالة/.test(code));
    ok('the tail rides ahead of the source cards, never after them',
      /referralBlock[\s\S]{0,400}cards|referralBlock \+ /.test(ask)
      || /\+ referralBlock \+/.test(ask));
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
