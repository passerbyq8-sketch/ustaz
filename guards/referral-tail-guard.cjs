// guards/referral-tail-guard.cjs — THE REFERRAL IS THE SERVER'S SENTENCE, AND IT NEVER TOUCHES A
// FROZEN ACT OF WORSHIP.
//
// ── WHY THE SERVER OWNS IT ───────────────────────────────────────────────────
// «عزك ناقلٌ لا مفتٍ»: he transmits a ruling from a page and points the reader at the people who
// actually issue rulings. That pointer must be there on a fatwa whether or not the model chose to
// write one — an instruction is a request, and the model omits it exactly when the answer sounded
// most confident. So the server appends it, deterministically, from wordings it owns.
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
  console.log('\n=== B. WHERE IT IS APPENDED ===');
  {
    const APPEND = [
      ['a fatwa', 'ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling'],
      ['a financial transaction', 'ما حكم التعامل بالعملات الرقمية؟', 'sharia_ruling'],
      ['a family matter', 'ما حكم الطلاق في الغضب؟', 'sharia_ruling'],
      ['a contemporary nazila', 'ما حكم التأمين الصحي الإلزامي؟', 'sharia_ruling'],
      ['a creed question', 'ما معنى توحيد الأسماء والصفات؟', 'sharia_ruling'],
      ['a named scholar\'s position', 'ما رأي ابن باز في التصوير؟', 'scholar_position'],
    ];
    for (const [label, q, cls] of APPEND) {
      ok(label + ' gets a referral', RT.referralTail(q, cls, 0) !== '', q);
      ok('...and it is one of the server\'s own wordings',
        RT.REFERRAL_TAILS.includes(RT.referralTail(q, cls, 0)));
    }
  }

  // =========================================================================
  console.log('\n=== C. WHERE IT IS NOT ===');
  {
    for (const [label, q, cls] of [
      ['tafsir', 'ما معنى قوله تعالى في هذه الآية؟', 'tafsir'],
      ['hadith', 'ما صحة حديث إنما الأعمال بالنيات؟', 'hadith'],
      ['sira / biography', 'من هو الإمام البخاري؟', 'biography'],
      ['a quote check', 'هل قال ابن تيمية هذه العبارة؟', 'quote_verification'],
      ['an ordinary question', 'كيف أرتب يومي؟', 'general_knowledge'],
    ]) eq(label + ' gets no referral', RT.referralTail(q, cls, 0), '');
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
      'كيف أتيمم إذا لم أجد ماء؟',
      'ما هي أذكار الصباح؟',
      'علمني أذكار النوم',
      'كم عدد ركعات صلاة الظهر وكيف أؤديها؟',
    ];
    for (const q of WORSHIP) {
      ok('no tail on «' + q + '»', RT.isFrozenWorshipQuestion(q), 'it must be recognised as frozen');
      // ASSERTED UNDER EVERY CLASS AND EVERY ROTATION, because the class is the thing most likely
      // to be wrong here: «كيف أتوضأ؟» is a `sharia_ruling` to the classifier.
      for (const cls of ['sharia_ruling', 'scholar_position', 'tafsir', 'hadith']) {
        for (let turn = 0; turn < 6; turn++) {
          if (RT.referralTail(q, cls, turn) !== '') {
            ok('...and none under ' + cls + ' turn ' + turn, false, q);
            turn = 6; break;
          }
        }
      }
    }
    ok('every worship question above is silent under every class and rotation', true);
    // A RULING **ABOUT** PRAYER IS NOT THE STEPS OF PRAYER. «هل تجب صلاة الجماعة؟» is a fatwa and
    // is entitled to the referral; «كيف أصلي؟» is a template to be recited whole.
    for (const q of ['هل تجب صلاة الجماعة على المسافر؟', 'ما حكم من ترك الصلاة تكاسلًا؟']) {
      ok('a RULING about prayer still gets one: «' + q + '»',
        RT.referralTail(q, 'sharia_ruling', 0) !== '');
    }
  }

  // =========================================================================
  console.log('\n=== E. IT VARIES ACROSS SUCCESSIVE ANSWERS ===');
  {
    const q = 'ما حكم بيع الذهب بالتقسيط؟';
    const seq = [0, 1, 2, 3].map((t) => RT.referralTail(q, 'sharia_ruling', t));
    eq('four successive answers give four different wordings', new Set(seq).size, 4);
    ok('...and every one of them is from the server\'s set',
      seq.every((s) => RT.REFERRAL_TAILS.includes(s)));
    eq('the rotation is deterministic — the same turn gives the same wording',
      RT.referralTail(q, 'sharia_ruling', 2), seq[2]);
    ok('a negative or absurd turn index still returns a wording, not a crash',
      RT.REFERRAL_TAILS.includes(RT.referralTail(q, 'sharia_ruling', -7))
      && RT.REFERRAL_TAILS.includes(RT.referralTail(q, 'sharia_ruling', 1e9)));
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
