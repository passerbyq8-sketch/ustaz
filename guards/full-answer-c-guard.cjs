// guards/full-answer-c-guard.cjs -- م٣-ج (FULL_ANSWER_V1): a long matn is carried by its head and its
// tail when the book prints a word between them that the answer does not, and nothing wider.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-ج «المتنُ الطويل»; brain-night fix plan R7): the one
// 60% anchor breaks on a long matn at the first printed word the answer lacks. In Muslim 8 that is
// «صلى الله عليه وسلم» after «رسول الله», so the live witness H-N2 shipped «أن تشهدَ … سبيلًا» as
// «(ابن خزيمة · صحيح)» while Muslim narrates it. MEASURED before it was built
// (03-answer/measure/B-bracket.md §8): head and tail of four words, in order, within 1.5× the
// matn's length, gain 13 carrier pairs on 4 matns across 894 atoms, with no cross-hadith match.
//
// WHAT THIS PINS:
//   L1  the Muslim-shaped atom: today's matcher refuses it, head and tail carry it;
//   L2  the bounds: a different section of the same long hadith, a span past 1.5×, and a matn
//       under eight words are not carried;
//   L3  [b21] stands: a Companion's voice between the anchors refuses the carrier;
//   L4  end to end: the switch on, the answer's long matn takes «(مسلم)»; off, it stays bare;
//   L5  the other two callers keep today's matcher: `atomCarriesMatn` itself did not move.
// Red on the tree before this item (217c0fd): `node guards/full-answer-c-guard.cjs --root <tree>`.
'use strict';
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
  console.log('full-answer-c guard — root ' + REPO);
  const T = await esm('lib/takhrij.js');
  const HT = typeof T.atomCarriesMatnHeadTail === 'function' ? T.atomCarriesMatnHeadTail : () => false;
  // The answer's quotation, as the model wrote it, and Muslim's narration with the printed prayer.
  const MATN = 'أن تشهد أن لا إله إلا الله وأن محمدا رسول الله وتقيم الصلاة وتؤتي الزكاة وتصوم رمضان وتحج البيت إن استطعت إليه سبيلا';
  const MUSLIM = 'حدثني أبو خيثمة زهير بن حرب عن عمر بن الخطاب قال: بينما نحن عند رسول الله صلى الله عليه وسلم '
    + 'ذات يوم إذ طلع علينا رجل فقال: يا محمد أخبرني عن الإسلام، فقال رسول الله صلى الله عليه وسلم: '
    + '«الإسلام أن تشهد أن لا إله إلا الله وأن محمدا رسول الله صلى الله عليه وسلم، وتقيم الصلاة، '
    + 'وتؤتي الزكاة، وتصوم رمضان، وتحج البيت إن استطعت إليه سبيلا»، قال: صدقت.';

  // ── L1 ────────────────────────────────────────────────────────────────────
  ok('L1  the printed prayer breaks today\'s anchor; head and tail carry the narration',
    T.atomCarriesMatn(MUSLIM, MATN) === false && HT(MUSLIM, MATN) === true,
    JSON.stringify({ strict: T.atomCarriesMatn(MUSLIM, MATN), headTail: HT(MUSLIM, MATN) }));

  // ── L2 the bounds ─────────────────────────────────────────────────────────
  const IMAN = 'حدثنا عن عمر قال رسول الله صلى الله عليه وسلم: «الإيمان أن تؤمن بالله وملائكته وكتبه ورسله واليوم الآخر وتؤمن بالقدر خيره وشره»';
  const FAR = 'أن تشهد أن لا إله إلا الله ' + 'ثم ذكر كلاما طويلا في أبواب الطهارة والصلاة والصيام والحج والزكاة والبيوع والنكاح والطلاق والجنايات والحدود والأقضية والشهادات والأيمان والنذور '.repeat(2)
    + 'إن استطعت إليه سبيلا';
  const SHORT = 'الدين النصيحة لله ولرسوله';
  ok('L2  another section of the hadith, a span past 1.5×, and a matn under eight words are not carried',
    HT(IMAN, MATN) === false && HT(FAR, MATN) === false
    && HT('قال رسول الله: «الدين النصيحة قالوا لمن يا رسول الله قال لله ولرسوله»', SHORT) === false,
    JSON.stringify({ iman: HT(IMAN, MATN), far: HT(FAR, MATN) }));

  // ── L3 [b21] ──────────────────────────────────────────────────────────────
  const MIXED = 'أن تشهد أن لا إله إلا الله قال عمر رضي الله عنه وتحج البيت إن استطعت إليه سبيلا';
  const MIXED_ATOM = 'عن عمر: «أن تشهد أن لا إله إلا الله وأن محمدا رسول الله وتحج البيت إن استطعت إليه سبيلا»';
  ok('L3  a Companion\'s voice between the anchors still refuses the carrier',
    HT(MIXED_ATOM, MIXED) === false, String(HT(MIXED_ATOM, MIXED)));

  // ── L4 end to end ─────────────────────────────────────────────────────────
  const answer = `قال النبي صلى الله عليه وسلم في بيان الإسلام: «${MATN}».`;
  const lookup = async (matns) => matns.map((m) => (m === MATN
    ? { matn: m, subjectIds: ['FC-000648'], atoms: [MUSLIM] } : { matn: m, subjectIds: [], atoms: [] }));
  const on = await T.applyTakhrij(answer, { env: { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' }, lookup });
  const off = await T.applyTakhrij(answer, { env: { TAKHRIJ_V1: 'on' }, lookup });
  ok('L4  the switch on, the long matn takes «(مسلم)»; off, it stays as the model wrote it',
    on.text.includes(`«${MATN}» (مسلم)`) && !off.text.includes('(مسلم)'),
    JSON.stringify({ on: on.text, off: off.text, problems: off.problems }));

  // ── L5 the other callers ──────────────────────────────────────────────────
  ok('L5  `atomCarriesMatn` itself did not move (the grader\'s entry and the prophet check keep it)',
    T.atomCarriesMatn(MUSLIM, MATN) === false && T.atomCarriesMatn(MUSLIM, 'أن تشهد أن لا إله إلا الله وأن محمدا رسول الله') === true);

  console.log(`\n=== full-answer-c: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== full-answer-c: crashed ==='); process.exit(1); });
