// guards/brain-line-c7-guard.cjs -- ITEM C7 (131) -- 2026-10-15 brain-line
//
// «بالضبط» AND «نفس» IN THE FOLLOW-UP ABOUT THE SOURCE. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t131-before.txt
// and items/131.md): asksPreviousSource caught 1 of the 14 live forms; Q131b-e went to the model (5.0-7.0 s) instead
// of the server's reply from the previous answer's own cards.
//
// What this guard holds (the order, C7): the patch 131-oneline.diff, ظ folded to ض inside this unit's normaliser
// only, and the forms ابي/أبغى/عطني المصدر · ما الدليل · وين لقيته · هالجواب/هالكلام · «من نفس …» · منين/من وين.
// 21/21 source follow-ups are recognised and 0/10 controls.
//
// Fixtures: the 14 forms and the 5 controls of tools/t131.mjs:4-13 and its 7 added forms (:10-11), verbatim
// (sessions/side-brain-line-2026-10-15/tools/t131.mjs); the five new controls: «ما حكم المصدر الربوي؟» from the order
// (directive:120), four COMPOSED.
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

// t131.mjs:4-9 (14) + :10-11 (7)
const POS = [
  'من أي كتاب أو موقع جبت هذا الجواب بالضبط؟', 'من وين نقلت هالجواب بالضبط؟', 'هل الكلام هذا مأخوذ من نفس المرجع اللي ذكرته؟',
  'من أي كتاب أخذت هذا الجواب بالظبط؟', 'من أي مصدر أخذت هذا الجواب بالضبط؟', 'هل هذا من نفس المصدر؟', 'من نفس المصدر هذا الجواب؟',
  'هذا الجواب من نفس الكتاب؟', 'من أي كتاب أخذت هذا الجواب بالتحديد؟', 'من أي مصدر أخذت هذا الجواب تحديدًا؟',
  'من أي كتاب أخذت هذا الجواب بعينه؟', 'من وين نقلت هالكلام بالظبط؟', 'هل هذا الجواب من نفس المصدر اللي ذكرته؟', 'هذا الكلام من نفس الكتاب؟ وين لقيته بعينه؟',
  'ما مصدرك بالضبط؟', 'ابي المصدر', 'ما مصادرك؟ وهل هي موثوقة؟', 'ما الدليل؟',
  'ما مصدرك بالتحديد؟', 'ممكن المصدر؟', 'عطني المراجع',
];
// t131.mjs:13 (5) + directive:120 (1) + COMPOSED (4)
const NEG = [
  'ما حكم المسح على الخفين بالضبط؟', 'ما هذا الكتاب؟', 'ما المقصود بنفس الشيء؟', 'ما حكم الصلاة في نفس المكان بالتحديد؟', 'هل رجعت؟',
  'ما حكم المصدر الربوي؟', 'ما الدليل على وجوب صلاة الجماعة؟', 'ما هو مصدر التشريع الأول في الإسلام؟', 'وين لقيت المفتاح؟', 'هل يجوز الزواج من نفس العائلة؟',
];

(async () => {
  const SF = await esm('lib/source-followup.js');
  const RC = await esm('lib/route-classify.js');
  let p = 0;
  for (const q of POS) { const r = SF.asksPreviousSource(q); if (r) p += 1; ok('follow-up #' + POS.indexOf(q) + ' recognised', r === true); }
  let f = 0;
  for (const q of NEG) { const r = SF.asksPreviousSource(q); if (r) f += 1; ok('control #' + NEG.indexOf(q) + ' not a follow-up', r === false); }
  ok('21/21 and 0/10', p === 21 && f === 0, p + '/21 ' + f + '/10');
  ok('the ظ/ض fold is this unit\'s own: the router\'s normalizeArabic is unchanged', RC.normalizeArabic('بالظبط') !== RC.normalizeArabic('بالضبط'));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c7: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
