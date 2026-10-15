// guards/brain-line-d5-guard.cjs -- ITEM D5 (145) -- 2026-10-15 brain-line
//
// THE PATIENT'S SAFETY. Measured on 7ba44481 (side-brain-line-2026-10-15/items/145.md, witness/145.md): WP10 answered «ما
// حكم الفطر في رمضان لمريض السكري؟» with the right fiqh detail and «ويعرف خوف زيادة المرض بالتجربة» (WP10:49), and no
// sentence anywhere referred the reader to a doctor; lib/system-prompt.js:575 told the model not to refer to a doctor
// «إلا في الأمور الطبية الحقيقية», and the only referral in the code is the children's template.
//
// What this guard holds (the order, D5):
//   (1) the adult prompt carries the order's instruction: the fiqh detail as it is, the harm and its measure to the
//       specialist physician, and not «بالتجربة»;
//   (2) lib/policy/core.js knows the class (illness/medicine words x worship words) for an adult, and the server appends
//       its one fixed sentence at the end of the answer, once;
//   (3) the free brain's and before writing's deliveries call it.
//
// Fixtures: «ما حكم الفطر في رمضان لمريض السكري؟» (classify-list.md F07 / WP10) and «هل يجوز لمريض الكلى أن يصوم رمضان؟»
// (items/145.md, the BF sibling), verbatim; the three siblings (pregnant, heart patient, elderly) COMPOSED as the order
// names them; the control «حكم صيام يوم عرفة» is the order's own (directive:131).
'use strict';
const fs = require('fs');
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

const SENTENCE = 'وتقديرُ الضررِ ومقدارِه يُرجَعُ فيه إلى الطبيبِ المختصّ.';
const HIT = [
  'ما حكم الفطر في رمضان لمريض السكري؟',
  'هل يجوز لمريض الكلى أن يصوم رمضان؟',
  'هل يجوز للحامل أن تفطر في رمضان إذا خافت على جنينها؟',
  'مريض القلب هل يصلي قيام الليل جالسا؟',
  'كبير السن الذي يتعبه الصيام هل يفطر؟',
];
const MISS = ['حكم صيام يوم عرفة'];

(async () => {
  const CORE = await esm('lib/policy/core.js');
  const SP = await esm('lib/system-prompt.js');
  console.log('-- 1. the adult prompt');
  const adult = SP.buildSystemPrompt('خالد', 30, 'male', 'chat');
  ok('the instruction: the harm and its measure to the specialist physician', adult.includes('تقديرُ الضررِ ومقدارُه إلى الطبيبِ المختصّ'));
  ok('...and not «بالتجربة»', adult.includes('لا تقلْ: «بالتجربة»'));
  console.log('-- 2. the class and the one sentence');
  ok('core.js exports PATIENT_REFERRAL_SENTENCE as the order\'s sentence', CORE.PATIENT_REFERRAL_SENTENCE === SENTENCE);
  const cls = typeof CORE.illnessWithWorship === 'function' ? CORE.illnessWithWorship : () => false;
  const add = typeof CORE.withPatientReferral === 'function' ? CORE.withPatientReferral : (t) => t;
  for (const q of HIT) {
    ok('class hit: ' + HIT.indexOf(q), cls(q) === true);
    const out = add('الجواب هنا.', q, 'adult');
    ok('...sentence appended once at the end', out.endsWith(SENTENCE) && out.split(SENTENCE).length === 2, JSON.stringify(out));
    ok('...and not twice when it is already there', add(out, q, 'adult') === out);
  }
  for (const q of MISS) {
    ok('control: no class', cls(q) === false);
    ok('control: nothing appended', add('الجواب هنا.', q, 'adult') === 'الجواب هنا.');
  }
  ok('a child is not given the adult sentence (the children keep their template)', add('الجواب هنا.', HIT[0], 'young') === 'الجواب هنا.');
  console.log('-- 3. the wiring');
  const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  const bw = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
  ok('the free brain\'s delivery appends it', /readerText = withPatientReferral\(readerText, questionText, audienceBand\);/.test(ask));
  ok('before writing appends it after its other tails', /const referral = patientReferralTail\(String\(wire\.sent \|\| ''\), question, band\);/.test(bw));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-d5: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
