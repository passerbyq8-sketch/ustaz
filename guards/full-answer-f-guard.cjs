// guards/full-answer-f-guard.cjs -- م٣-و (FULL_ANSWER_V1): one ruling is not read twice at the head of an
// answer. The takhrij head stands down when the answer's own first sentence already says it.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-و «سقوطُ الصدرِ وتكرارُ الفقرة — ومنه الحكمُ المكرّرُ في
// صدرِ «حب الوطن»»). MEASURED (03-answer/measure/D-mechanism.md §3.1): the head «الحديث لا يثبت مرفوعا
// إلى النبي صلى الله عليه وسلم، والحكم عليه في السلسلة الضعيفة: موضوع.» (reproduced byte for byte), then
// the model's «لا، هذا الكلام ليس حديثا نبويا صحيحا، بل هو موضوع…». On 21 delivered heads the rule
// took the witness and three true restatements, and nothing else. The dropped opening (G03) is not
// built: every measured fix tears a grade word out of a sentence, which the owner's standing ruling
// in lib/takhrij-lock.js forbids («ولا يُنتزَعُ منها لفظٌ فتبقى واقفة. ولا ثالثَ»). The repeated
// paragraph (T06) came from streamed rounds, which the order keeps out of reach (decisions D31–D32).
//
// WHAT THIS PINS:
//   R1  the owner's witness stands the head down;
//   R2  «تخريج الحديث: البخاري ومسلم.» over «…رواه الشيخان…» stands down; a graded head needs its
//       outlet AND its grade in the sentence;
//   R3  the controls: a head that states no verdict never stands down; «الموضوع» is not «موضوع»; a
//       line that opens on a quotation is not the first prose sentence;
//   R4  api/ask.js wires it under the switch, on the pass's own head, before `readerText` is taken.
// Red on the tree before this item: `node guards/full-answer-f-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}

async function main() {
  console.log('full-answer-f guard — root ' + REPO);
  const T = await esm('lib/takhrij.js');
  const R = typeof T.headRestatedBy === 'function' ? T.headRestatedBy : () => false;
  const WATAN = 'الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم، والحكم عليه في السلسلة الضعيفة: موضوع.';
  const BODY = 'لا، هذا الكلام ليس حديثا نبويا صحيحا، بل هو موضوع لا أصل له كما قال أهل العلم.\n\nومحبة الوطن فطرة.';
  ok('R1  the owner\'s «حب الوطن» head stands down under the model\'s own «بل هو موضوع»', R(WATAN, BODY) === true);

  const AGREED = 'تخريج الحديث: البخاري ومسلم.';
  const GRADED = 'تخريج الحديث: ابن ماجه، والحكم عليه في صحيح الجامع: صحيح.';
  ok('R2  «البخاري ومسلم» over «رواه الشيخان»; a graded head needs its outlet and its grade',
    R(AGREED, 'هذا الحديث صحيح ثابت، رواه الشيخان في صحيحيهما.') === true
    && R(GRADED, 'هذا حديث صحيح، أخرجه ابن ماجه في سننه.') === true
    && R(GRADED, 'هذا حديث صحيح ثابت.') === false);

  ok('R3  no verdict never stands down; «الموضوع» is not «موضوع»; a quotation line is skipped',
    R(T.GRADING_HEAD_NOT_PROVED, 'لم يثبت هذا الحديث.') === false
    && R('تخريج الحديث: أبو داود، ولم تُثبت المكتبة حكمًا عليه.', 'رواه أبو داود.') === false
    && R(WATAN, 'هذا الموضوع مهم جدا.') === false
    && R(WATAN, '«حب الوطن من الإيمان»\nبل هو كلام موضوع لا أصل له.') === true);

  const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8').replace(/\r\n/g, '\n');
  const at = ask.indexOf("if (fullAnswerValue === 'on' && pass.gradingHead && pass.text.startsWith(pass.gradingHead + '\\n\\n')");
  const call = ask.indexOf('headRestatedBy(pass.gradingHead, pass.text.slice(pass.gradingHead.length + 2))', at);
  const taken = ask.indexOf('readerText = pass.text;', at);
  ok('R4  api/ask.js stands the head down under the switch, before the pass\'s text becomes the reader\'s',
    at > 0 && call > at && taken > call && ask.slice(call, taken).includes("out.degraded.push('takhrij:head_restated');"),
    JSON.stringify({ at, call, taken }));

  console.log(`\n=== full-answer-f: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== full-answer-f: crashed ==='); process.exit(1); });
