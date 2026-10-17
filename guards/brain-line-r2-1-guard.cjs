// guards/brain-line-r2-1-guard.cjs -- ITEM r2-1 (Z1 follow-up) -- 2026-10-17 brain-line R2
//
// THE MADHHAB FOLLOW-UP IS NOT A PART. Measured on the preview of fa778c0e (sessions/side-brain-fix-2026-10-15/
// EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt lines 147-148, D1): «ما حكم إخراج زكاة المال عروضا بدل النقود؟ وما أقوال المذاهب
// فيها؟» listed the madhhab views and then said «لم أقف على نص في مسألة «ما أقوال المذاهب فيها».» -- questionParts() cut
// at the second «؟» and the four-word follow-up ending in a pronoun was not joined to the part before it (the rule was <= 3).
//
// What this guard holds (the R2 order, item 1):
//   (1) a follow-up of <= 6 words ending in a returning pronoun joins the part before it; the question above is ONE question;
//   (2) a follow-up asking only the madhhabs of the same issue joins too, and the whole stays a madhhab question;
//   (3) the controls: the two-part fasting question (report line 164, both parts answered) stays two, the three-part
//       one three, «أين ورد حديث: الدين النصيحة؟ ومن رواه؟» one;
//   (4) the valve: no «لم أقف على نصٍّ في <part>» for a madhhab part when the delivered text names two schools or more, nor
//       for a part two of whose words stand in one delivered sentence; a part the text does not touch still gets it.
'use strict';
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 400);

// The questions, copied from the R2 order section 4 b1 (the D1 question is the report's, line 141-148 context; D3 line 164).
const D1 = 'ما حكم إخراج زكاة المال عروضا بدل النقود؟ وما أقوال المذاهب فيها؟';
const SIB = 'ما حكم زكاة الحلي المستعمل؟ وما قول الأئمة الأربعة فيه؟';
const SIB2 = 'ما حكم زكاة الحلي المستعمل؟ وما رأي المذاهب الأربعة في هذه المسألة؟';
const D3 = 'عندي سؤالان: ما حكم قطرة الأذن للصائم؟ وما حكم الحجامة للصائم؟';
const THREE = 'عندي ثلاثة أسئلة في الصيام: ما حكم المضمضة للصائم؟ وما حكم تذوق الطعام للصائم؟ وما حكم شم الطيب للصائم؟';
const HADITH = 'أين ورد حديث: الدين النصيحة؟ ومن رواه؟';

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  const qp = BW2.questionParts;
  console.log('-- 1/2. the splitter');
  ok('D1 (... and the madhhab views on it?) is one question', qp(D1).length === 0, ascii(JSON.stringify(qp(D1).map((p) => p.text))));
  ok('...and it is a madhhab question', BW2.isMadhhabQuestion(D1));
  ok('sibling (... and the four imams on it?) is one question', qp(SIB).length === 0, ascii(JSON.stringify(qp(SIB).map((p) => p.text))));
  ok('a madhhab-only follow-up without a pronoun (SIB2) joins too', qp(SIB2).length === 0,
    ascii(JSON.stringify(qp(SIB2).map((p) => p.text))));
  ok('...and the whole is a madhhab question', BW2.isMadhhabQuestion(SIB2));
  console.log('-- 3. the controls');
  ok('D3 two-part fasting question stays two (report line 164)', qp(D3).length === 2, ascii(JSON.stringify(qp(D3).map((p) => p.text))));
  ok('the three-part fasting question stays three', qp(THREE).length === 3, ascii(JSON.stringify(qp(THREE).map((p) => p.text))));
  ok('the hadith-source question with (and who narrated it?) stays one', qp(HADITH).length === 0);
  console.log('-- 4. the valve');
  const wanted = typeof BW2.partSentenceWanted === 'function' ? BW2.partSentenceWanted : () => true;
  const madhhabPart = { text: 'ما أقوال المذاهب فيها', title: 'مسألة «ما أقوال المذاهب فيها»' };
  const SENT = 'ذهب الحنفية إلى جواز إخراج القيمة في الزكاة. وذهب المالكية والشافعية والحنابلة إلى المنع إلا لحاجة.';
  ok('a madhhab part, the text names the four schools -> no not-found sentence', wanted(madhhabPart, SENT) === false);
  const cupping = { text: 'ما حكم الحجامة للصائم', title: 'حكم الحجامة للصائم' };
  ok('a part two of whose words stand in one sentence -> no sentence', wanted(cupping, 'وذهب الحنابلة إلى أن الحجامة يفطر بها الحاجم والمحجوم للصائم.') === false);
  ok('a part the text does not touch still gets its sentence', wanted(cupping, 'قطرة الأذن لا تفطر الصائم على الصحيح.') === true);
  ok('a madhhab part, the text names one school only -> the sentence stays', wanted(madhhabPart, 'ذهب الحنفية إلى جواز إخراج القيمة.') === true);
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
