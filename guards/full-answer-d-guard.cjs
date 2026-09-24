// guards/full-answer-d-guard.cjs -- م٣-د (FULL_ANSWER_V1): the bracket takes al-Tirmidhi's own verdict
// from his own atom, and never says «لم يوقف على حكم» beside a grade the prose states.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-د): «ولا يناقضُ القوسُ النصّ — شاهدُه الحيّ: «(الترمذي
// · لم يوقف على حكم)» والنصُّ «حسن غريب»». MEASURED before it was built
// (03-answer/measure/C-grade.md): a grade is read only from ladder rows flagged `grader`, row 13
// (الترمذي) is not one, so Tirmidhi's own «هذا حديث حسن غريب» was never read. Nothing compared the
// bracket with the prose beside it. The Dorar half of the item is not built: dorar.net refuses
// every server-side client, and the only request known to work impersonates a browser, which
// lib/user-agent.js forbids (decisions D29).
//
// WHAT THIS PINS:
//   V1  a confirmed Tirmidhi atom that writes «هذا حديث حسن غريب»: «(الترمذي · حسن غريب)»;
//       the switch off, «(الترمذي · لم يوقف على حكم)» as before;
//   V2  a lone «هذا حديث غريب» is not a grade: NO_RULING stays;
//   V3  a bracket that can only say NO_RULING beside a grade the prose states stands down
//       (TAKHRIJ_PROSE_GRADE, the would-be text kept as `withheld`); the switch off, today's bracket;
//   V4  a bracket that carries a book with no NO_RULING is not touched by the prose grade;
//   V5  the two readers on their own: `collectorVerdict` and `statedGradeNear`.
// Red on the tree before this item: `node guards/full-answer-d-guard.cjs --root <tree>`.
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
  console.log('full-answer-d guard — root ' + REPO);
  const T = await esm('lib/takhrij.js');
  const L = await esm('lib/takhrij-ladder.js');
  const ON = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' };
  const OFF = { TAKHRIJ_V1: 'on' };
  const MATN = 'تبسمك في وجه أخيك لك صدقة وأمرك بالمعروف ونهيك عن المنكر صدقة';
  const tirmidhi = (verdict) => 'حدثنا عباس بن عبد العظيم عن أبي ذر قال: قال رسول الله صلى الله عليه وسلم: «'
    + MATN + '». وفي الباب عن ابن مسعود وجابر.' + (verdict ? ' هذا حديث ' + verdict + '.' : '');
  const lookupWith = (atom) => async (matns) => matns.map((m) => (m === MATN
    ? { matn: m, subjectIds: ['FC-000658'], atoms: [atom] } : { matn: m, subjectIds: [], atoms: [] }));
  const plain = `قال النبي صلى الله عليه وسلم: «${MATN}».`;
  const graded = `قال النبي صلى الله عليه وسلم: «${MATN}»\nفدرجته عند الترمذي: حسن غريب.`;
  const NO = `الترمذي · ${L.NO_RULING}`;

  // ── V1 ────────────────────────────────────────────────────────────────────
  const v1on = await T.applyTakhrij(plain, { env: ON, lookup: lookupWith(tirmidhi('حسن غريب')) });
  const v1off = await T.applyTakhrij(plain, { env: OFF, lookup: lookupWith(tirmidhi('حسن غريب')) });
  ok('V1  Tirmidhi\'s own «هذا حديث حسن غريب» fills the bracket; the switch off, «لم يوقف على حكم»',
    v1on.text.includes(`«${MATN}» (الترمذي · حسن غريب)`) && v1off.text.includes(`(${NO})`),
    JSON.stringify({ on: v1on.text, off: v1off.text }));

  // ── V2 ────────────────────────────────────────────────────────────────────
  const v2 = await T.applyTakhrij(plain, { env: ON, lookup: lookupWith(tirmidhi('غريب')) });
  ok('V2  a lone «غريب» is not a grade: the bracket still says «لم يوقف على حكم»',
    v2.text.includes(`(${NO})`), JSON.stringify(v2.text));

  // ── V3 ────────────────────────────────────────────────────────────────────
  const v3on = await T.applyTakhrij(graded, { env: ON, lookup: lookupWith(tirmidhi('')) });
  const v3off = await T.applyTakhrij(graded, { env: OFF, lookup: lookupWith(tirmidhi('')) });
  const entry = (v3on.entries || [])[0] || {};
  ok('V3  beside a stated grade, a NO_RULING bracket stands down and the record keeps what it withheld',
    !v3on.text.includes(L.NO_RULING) && v3on.problems.includes(T.TAKHRIJ_PROSE_GRADE)
    && entry.declined === 'prose_states_grade' && entry.withheld === NO
    && v3off.text.includes(`(${NO})`),
    JSON.stringify({ on: v3on.text, entry, off: v3off.text }));

  // ── V4 ────────────────────────────────────────────────────────────────────
  const bukhariAtom = 'حدثنا الحميدي عن أبي ذر رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «' + MATN + '»';
  const v4 = await T.applyTakhrij(graded, {
    env: ON,
    lookup: async (matns) => matns.map((m) => (m === MATN
      ? { matn: m, subjectIds: ['FC-000645'], atoms: [bukhariAtom] } : { matn: m, subjectIds: [], atoms: [] })),
  });
  ok('V4  a bracket naming a book, with no «لم يوقف على حكم», is not touched by the prose grade',
    v4.text.includes('(البخاري)') && !v4.problems.includes(T.TAKHRIJ_PROSE_GRADE), JSON.stringify(v4.text));

  // ── V5 ────────────────────────────────────────────────────────────────────
  const cv = typeof T.collectorVerdict === 'function' ? T.collectorVerdict : () => '';
  const sg = typeof T.statedGradeNear === 'function' ? T.statedGradeNear : () => '';
  const target = { start: graded.indexOf('«'), end: graded.indexOf('»') + 1 };
  ok('V5  the readers: «حديث أبي ذر حديث حسن صحيح» and «هذا حديثٌ حسنٌ»; a stated grade read in its window',
    cv('حديث أبي ذر حديث حسن صحيح.') === 'حسن صحيح' && cv('هَذَا حَدِيثٌ حَسَنٌ.') === 'حسن' && cv('هذا حديث غريب.') === ''
    && /حسن غريب/u.test(sg(graded, target)) && sg(plain, { start: plain.indexOf('«'), end: plain.indexOf('»') + 1 }) === '',
    JSON.stringify({ a: cv('حديث أبي ذر حديث حسن صحيح.'), b: cv('هَذَا حَدِيثٌ حَسَنٌ.'), g: sg(graded, target) }));

  console.log(`\n=== full-answer-d: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== full-answer-d: crashed ==='); process.exit(1); });
