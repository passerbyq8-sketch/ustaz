// guards/brain-line-c6-guard.cjs -- ITEM C6 (axis row 8; 125 row 4) -- 2026-10-15 brain-line
//
// THE KHILAF TAIL ON BARE WORDS. Measured on 7ba44481 (side-brain-line-2026-10-15/side/axis-khilaf.md): «صيام يوم
// عرفة مستحب بلا خلاف بين أهل العلم.», «اختلف المفسرون في معنى الصراط المستقيم على أقوال متقاربة.» and «ولا خلاف في
// ذلك.» each drew «وتراجع المسألة مع أهل العلم لظهور الخلاف فيها» (khilafTrigger 'prose'), by the word alone.
//
// What this guard holds (the order, C6): the tail (its text unchanged) comes from model prose only when the khilaf
// word stands in a sentence that states a RULING, is not negated («بلا خلاف», «لا خلاف», «باتفاق», «بإجماع»), and
// the topic is not tafsir, belief or sira.
//
// Fixtures: K1, K2, K3 of side/axis-khilaf.md:5-7 verbatim; WP04:7/:19/:25 of witness/136.md (the saved 04.md lines);
// the positive case is the order's own words (directive:119) completed with a ruling («أنه يجوز»: COMPOSED).
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

const NO_TAIL = [
  ['K1 (axis-khilaf.md:5)', 'صيام يوم عرفة مستحب بلا خلاف بين أهل العلم.', ''],
  ['K2 (axis-khilaf.md:6)', 'اختلف المفسرون في معنى الصراط المستقيم على أقوال متقاربة.', ''],
  ['K2 as tafsir (topic)', 'اختلف المفسرون في معنى الصراط المستقيم على أقوال متقاربة.', 'tafsir'],
  ['K3 (axis-khilaf.md:7)', 'ولا خلاف في ذلك.', ''],
  ['consensus (directive:119)', 'وجواز ذلك باتفاق أهل العلم، وهو مستحب.', ''],
  ['WP04 (witness/136.md 04.md:7,19,25)', 'العسر الأول هو العسر الثاني، واليسر الأول غير اليسر الثاني، وقد جاء في الحديث: «لن يغلب عسر يسرين» (البخاري)؛ ووجه ذلك أن العسر معروف فهو واحد، لأنه ذلك المعرف بعينه، واليسر منكر، ولو كان اليسر الثاني هو الأول لتكرر وفيه الألف واللام ليعرف ذكره.\nوقد خرج البزار في مسنده وابن أبي حاتم من حديث أنس عن النبي صلى الله عليه وسلم أنه قال: «لو جاء العسر فدخل هذا الجحر، لجاء اليسر حتى يدخل عليه فيخرجه» (الحاكم · لم يوقف على حكم)، فأنزل الله عز وجل هاتين الآيتين.\nوروى ابن جرير وغيره من حديث الحسن مرسلا نحوه، وفيه: فقال النبي صلى الله عليه وسلم: «لن يغلب عسر يسرين» (البخاري).', 'tafsir'],
  ['a ruling with khilaf, but the topic is sira', 'والمسألة فيها خلاف، والراجح أنه يجوز.', 'biography'],
];
const TAIL = [
  ['a ruling sentence with an open khilaf (directive:119 + COMPOSED)', 'والمسألة فيها خلاف، والراجح أنه يجوز.', ''],
  ['the same, fiqh topic', 'والمسألة فيها خلاف، والراجح أنه يجوز.', 'sharia_ruling'],
];

(async () => {
  const R = await esm('lib/output-reviewer.js');
  const trig = (text, topic) => R.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'brief', ...(topic ? { topic } : {}) }).verdict.khilafTrigger;
  console.log('-- 1. no tail');
  for (const [id, text, topic] of NO_TAIL) { const t = trig(text, topic); ok(id + ' -> no khilaf tail', !t, String(t)); }
  console.log('-- 2. the tail where it belongs');
  for (const [id, text, topic] of TAIL) { const t = trig(text, topic); ok(id + ' -> prose khilaf tail', t === 'prose', String(t)); }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c6: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
