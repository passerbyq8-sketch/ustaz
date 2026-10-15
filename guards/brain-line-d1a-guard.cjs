// guards/brain-line-d1a-guard.cjs -- ITEM D1-A (136) -- 2026-10-15 brain-line
//
// THE FALSE ASCRIPTION: FRAMES AND PARENTHESES. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t136.md): the
// detector 0 on the five witness sentences; «(البخاري)» written by the model on Sufyan's saying left as it was;
// «وقد جاء في الحديث أن…» with no target at all.
//
// What this guard holds (the order, D1-A):
//   - the model's bare collection parentheses are stripped before the takhrij pass, so the only parenthesis left is
//     the server's;
//   - after the pass, a sentence with a Prophetic frame whose matn the pass did not source is removed whole;
//   - api/ask.js wires both at the free brain's takhrij seat, and lib/before-writing-v2.js strips before its lookup;
//   - prophet-ascription's untaggedQuotesAreMatns is on where the free brain calls the detector.
// The library is a fake lookup (no network): Sufyan's tafsir atom for «لن يغلب عسر يسرين»; an atom of al-Nasa'i
// (FC-000674, ladder row 9) for «إنما الأعمال بالنيات».
//
// Fixtures: WP04:7 and Q136a:6 verbatim from witness/136.md (04.md:7, Q136a.txt:6); «وقد جاء في الحديث أن الصيام جنة.»
// from tools/t136.mjs:18; the Nasa'i sentence and both atoms are COMPOSED.
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

// witness/136.md (04.md:7)
const WP04_7 = 'العسر الأول هو العسر الثاني، واليسر الأول غير اليسر الثاني، وقد جاء في الحديث: «لن يغلب عسر يسرين» (البخاري)؛ ووجه ذلك أن العسر معروف فهو واحد، لأنه ذلك المعرف بعينه، واليسر منكر، ولو كان اليسر الثاني هو الأول لتكرر وفيه الألف واللام ليعرف ذكره.';
// witness/136.md (Q136a.txt:6)
const Q136A_6 = 'وقد ورد أنّه كان ينامُ نصفَ الليلِ ثم يقومُ ثلثَه ثم ينامُ سدسَه، كما وصفتْ ذلك أمُّ المؤمنين عائشةُ رضيَ اللهُ عنها في صفةِ قيامِه بالليل.';
// tools/t136.mjs:18
const JA_BARE = 'وقد جاء في الحديث أن الصيام جنة.';
const NASAI = 'قال رسول الله ﷺ: «إنما الأعمال بالنيات» (النسائي).';
const lookup = async (matns) => matns.map((matn) => {
  if (/لن يغلب عسر يسرين/u.test(matn)) return { matn, subjectIds: ['FC-001150'], atoms: ['قال سفيان: لن يغلب عسر يسرين، يعني أن العسر معرف واليسر منكر.'] };
  if (/إنما الأعمال بالنيات/u.test(matn)) return { matn, subjectIds: ['FC-000674'], atoms: ['أخبرنا يحيى بن سعيد عن عمر بن الخطاب قال: قال رسول الله صلى الله عليه وسلم: «إنما الأعمال بالنيات»'] };
  return { matn, subjectIds: [], atoms: [] };
});

(async () => {
  const PC = await esm('lib/prophetic-claims.js').catch(() => null);
  const TK = await esm('lib/takhrij.js');
  ok('lib/prophetic-claims.js exists', !!PC);
  const strip = PC ? PC.stripModelCollectionParens : (t) => t;
  const drop = PC ? PC.dropUnconfirmedProphetic : (t) => ({ text: t, removed: 0 });
  const run = async (text) => {
    const pass = await TK.applyTakhrij(strip(text), { env: { TAKHRIJ_V1: 'on' }, lookup });
    return drop(pass.text, pass.entries).text;
  };

  console.log('-- 1. WP04:7 -- Sufyan\'s saying under «جاء في الحديث» with the model\'s «(البخاري)»');
  { const out = await run(WP04_7); ok('the sentence carrying the unsourced matn is removed, and no «(البخاري)» is left', !out.includes('لن يغلب') && !out.includes('(البخاري)'), JSON.stringify(out)); }
  console.log('-- 2. Q136a:6 -- «وقد ورد أنّه كان…»');
  { const out = await run(Q136A_6); ok('removed', !out.includes('ينامُ نصفَ الليلِ'), JSON.stringify(out)); }
  console.log('-- 3. «وقد جاء في الحديث أن الصيام جنة.» unconfirmed');
  { const out = await run(JA_BARE); ok('removed', !out.includes('الصيام جنة'), JSON.stringify(out)); }
  console.log('-- 4. the model\'s «(النسائي)» goes, and the server\'s parenthesis is the one left');
  {
    const out = await run(NASAI);
    ok('the confirmed matn stays', out.includes('إنما الأعمال بالنيات'), JSON.stringify(out));
    ok('exactly one parenthesis naming al-Nasa\'i, and it is not the bare model form', (out.match(/\(النسائي/gu) || []).length === 1 && !out.includes('(النسائي)'), JSON.stringify(out));
  }
  console.log('-- 5. the wiring');
  {
    const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('api/ask.js strips the model\'s parentheses before the free brain\'s takhrij pass', /if \(!streamedHead\) readerText = stripModelCollectionParens\(readerText\);\s*const pass = await applyTakhrij\(readerText, \{/.test(ask));
    ok('...and drops the unconfirmed Prophetic sentences after it', /readerText = dropUnconfirmedProphetic\(pass\.text, pass\.entries\)\.text;/.test(ask));
    const bw = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
    ok('lib/before-writing-v2.js strips them before its lookup', /const pass = await applyTakhrij\(stripModelCollectionParens\(text\), \{/.test(bw));
    const loop = fs.readFileSync(path.join(REPO, 'lib/free-brain/loop.js'), 'utf8');
    ok('the free brain calls the detector with untaggedQuotesAreMatns on', /untaggedQuotesAreMatns: true/.test(loop));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-d1a: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
