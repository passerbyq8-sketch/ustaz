// guards/brain-line-d3-guard.cjs -- ITEM D3 (129) -- 2026-10-15 brain-line
//
// THE GRADE RULE ON MAIN, AND THE DOUBLED GUILLEMETS. Measured on 7ba44481 (side-brain-line-2026-10-15/items/129.md,
// side/t129-compare.md): main's dropUnsourcedGrades takes a whole sentence for a leading grade clause and a ruling
// after its comma, and drops Q135b:21 and part of Q135d:5; the rule of the night branch (129-rule-on-main.diff,
// c49df305) keeps them. And «قال رسول الله ﷺ: «إنما الأعمال بالنيات» وهو حديث صحيح.» came out as «««إنما الأعمال بالنيات»
// وهو حديث».» (report §7).
//
// What this guard holds (the order, D3): the rule is on main with its guard (ROOTS-62 in takhrij-lock-guard, from
// c49df305); the eight witness shapes give the rule's column of t129-compare; Q135b:21 and Q135d:5 are kept; and path C
// neither wraps guillemets in guillemets nor leaves «وهو حديث» behind.
//
// Fixtures: tools/t129.mjs:5-12 (the eight shapes) and side/t129-compare.md:6-13 (their expected rule column), verbatim;
// Q135b.txt:21 and Q135d.txt:5 read from sessions/side-brain-15-2026-10-05/answers when present (else skipped, said);
// the guillemet sentence from the measure report §7.
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

// [id, input (t129.mjs:5-12), expected after the rule (t129-compare.md:6-13)]
const W = [
  ['shape1a_negated', 'وهذا الحكم ثابت عند الفقهاء، ولأنه لم يثبت عندهم في ذلك حديثٌ صحيحٌ صريح فقد توقفوا فيه.', null],
  ['shape1b_negated', 'وليس له إسنادٌ صحيحٌ ولا حسنٌ يُعتمَد؛ ولذلك لا يجوز نسبتُه إلى النبي ﷺ.', null],
  ['shape2_class', 'وفي الباب أحاديث صحيحة أخرى تُغني عنه وتدل على المعنى نفسه.', null],
  ['shape3_meaning', 'والحديث لا يثبت لكنَّ معناه صحيحٌ ثابتٌ بأدلّةٍ أخرى، فالإسلامُ يأمر بالنظافة.', null],
  ['shape4_lead_then_ruling', 'فهو حديثٌ حسنٌ يُعمل به، وقد استحبَّ العلماء قراءتها في الصلاة.', 'وقد استحبَّ العلماء قراءتها في الصلاة.'],
  ['shape4b', 'حديثٌ ثابتٌ معروفٌ عند أهل العلم، وقد بنى عليه الفقهاءُ استحبابَ ذلك.', 'وقد بنى عليه الفقهاءُ استحبابَ ذلك.'],
  ['ctl_bare_grade', 'وهذا الحديث صحيح وقد رواه الشيخان.', null],
  ['ctl_plain_ruling', 'وقد استحب العلماء قراءة الفاتحة في الصلاة الجهرية.', null],
];
const DOUBLE = 'قال رسول الله ﷺ: «إنما الأعمال بالنيات» وهو حديث صحيح.';

(async () => {
  const TL = await esm('lib/takhrij-lock.js');
  console.log('-- 1. the eight shapes give the rule\'s column');
  for (const [id, input, expected] of W) {
    const out = TL.dropUnsourcedGrades(input).text;
    ok(id, out === (expected === null ? input : expected), JSON.stringify(out));
  }
  console.log('-- 2. Q135b:21 and Q135d:5 are kept');
  {
    const dir = 'C:/Users/passe/projects/ustaz-archive/sessions/side-brain-15-2026-10-05/answers/';
    for (const [f, n] of [['Q135b.txt', 21], ['Q135d.txt', 5]]) {
      if (!fs.existsSync(dir + f)) { console.log('  SKIP  ' + f + ' not on this machine'); continue; }
      const line = fs.readFileSync(dir + f, 'utf8').split('\n')[n - 1];
      const out = TL.dropUnsourcedGrades(line).text;
      ok(f + ':' + n + ' kept whole', out.trim() === line.trim(), JSON.stringify(out).slice(0, 200));
    }
  }
  console.log('-- 3. no doubled guillemets and no stub «وهو حديث»');
  {
    const dropped = TL.dropUnsourcedGrades(DOUBLE).text;
    const locked = TL.lockTakhrij(dropped, []).text;
    for (const [name, t] of [['dropUnsourcedGrades', dropped], ['then lockTakhrij', locked]]) {
      ok(name + ': no «« and no »»', !/«[^»]*«|»[^«]*»/u.test(t.replace(/«[^«»]*»/gu, '')) && !t.includes('««') && !t.includes('»»'), JSON.stringify(t));
      ok(name + ': no «وهو حديث» left hanging', !/وهو حديث\s*[».]/u.test(t), JSON.stringify(t));
      ok(name + ': the matn stays, once', (t.match(/إنما الأعمال بالنيات/gu) || []).length === 1, JSON.stringify(t));
    }
  }
  console.log('-- 4. the rule\'s own guard is on main');
  ok('ROOTS-62 is in guards/takhrij-lock-guard.cjs', /ROOTS-62/.test(fs.readFileSync(path.join(REPO, 'guards/takhrij-lock-guard.cjs'), 'utf8')));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-d3: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
