// guards/brain-line-d2-guard.cjs -- ITEM D2 (133) -- 2026-10-15 brain-line
//
// THE POINTER TO A HELD MATN. Measured on 7ba44481 (side-brain-line-2026-10-15/items/133.md, side/axis-bw2.md 133-*):
// after «قال رسول الله ﷺ: «أعفوا اللحى وحفوا الشوارب».» was held (no row carries it), «والوارد في الحديث يدل على الإعفاء»,
// «وفي هذين الحديثين دلالة على الإعفاء» and «بناءً على هذه الأحاديث فالإعفاء واجب» were released -- pointing at a matn the
// reader never saw; the three «هذه الأحاديث…» units were held only for the shape of their opening.
//
// What this guard holds (the order, D2): a unit that speaks of a hadith or hadiths is held while no matn has gone
// out, whatever its opening; «بناءً على هذا/هذه/ما تقدم/ما سبق» points back; after a DISPLAYED matn the same units
// go out; and the free brain removes such a sentence once the matn it points at was removed.
//
// Fixtures: tools/axis-bw2.mjs HELD (:50), P133 (:51-52) and ROW133 (:53) verbatim; the displayed-matn row is COMPOSED.
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

// axis-bw2.mjs:50-53
const HELD = 'قال رسول الله ﷺ: «أعفوا اللحى وحفوا الشوارب».';
const P133 = ['والوارد في الحديث يدل على الإعفاء [[1]]', 'وفي هذين الحديثين دلالة على الإعفاء [[1]]', 'بناءً على هذه الأحاديث فالإعفاء واجب [[1]]',
  'هذه الأحاديث تدل على الإعفاء [[1]]', 'وهذه الأحاديث تدل على الإعفاء [[1]]', 'وفي هذه الأحاديث دلالة على الإعفاء [[1]]'];
const ROW133 = { ref: 1, kind: 'fatwa', publisher: 'ابن باز', scholarId: 'binbaz', recordId: '9', url: 'https://binbaz.org.sa/fatwas/9', title: 'اللحية', text: 'إعفاء اللحية واجب ولا يجوز حلقها ولا قصها، والإعفاء يدل على ترك الأخذ منها.' };
// COMPOSED: the same row also carrying the matn, so the matn is displayed
const ROW_CARRIES = { ...ROW133, recordId: '9b', text: ROW133.text + ' وقد قال رسول الله صلى الله عليه وسلم: «أعفوا اللحى وحفوا الشوارب».' };

(async () => {
  const U = await esm('lib/bw2-units.js');
  const PC = await esm('lib/prophetic-claims.js');
  const run = async (rows, stream) => {
    const rel = U.createBw2Releaser({ rows, mode: 'brief', emit: () => true });
    rel.push(stream);
    const sum = await rel.end();
    return { text: String(sum.text || ''), holds: sum.holds || {} };
  };
  console.log('-- 1. after a held matn: the six pointers are held');
  for (const [i, p] of P133.entries()) {
    const r = await run([ROW133], HELD + '\n\n' + p);
    ok('133-' + (i + 1) + 'a held', !r.text.includes('الإعفاء'), JSON.stringify(r));
  }
  console.log('-- 2. after a displayed matn: three pointers go out');
  for (const i of [0, 1, 2]) {
    const r = await run([ROW_CARRIES], 'قال رسول الله ﷺ: «أعفوا اللحى وحفوا الشوارب» [[1]].\n\n' + P133[i]);
    ok('control ' + (i + 1) + ' released after the displayed matn', r.text.includes('أعفوا اللحى') && r.text.includes('الإعفاء'), JSON.stringify(r));
  }
  console.log('-- 3. the reading');
  ok('mentionsHadith reads «الحديث», «الحديثين», «الأحاديث»', typeof U.mentionsHadith === 'function'
    && U.mentionsHadith('والوارد في الحديث') && U.mentionsHadith('هذين الحديثين') && U.mentionsHadith('هذه الأحاديث') && !U.mentionsHadith('والإعفاء واجب'));
  ok('«بناءً على ما تقدم» points back', U.pointsBackAtWords('بناءً على ما تقدم فالإعفاء واجب'));
  console.log('-- 4. the free brain');
  {
    ok('prophetic-claims exports dropHadithPointersWithoutMatn', typeof PC.dropHadithPointersWithoutMatn === 'function');
    if (typeof PC.dropHadithPointersWithoutMatn === 'function') {
      const out = PC.dropHadithPointersWithoutMatn('إعفاء اللحية واجب.\nوفي هذين الحديثين دلالة على الإعفاء.');
      ok('a sentence speaking of the removed hadiths goes, the ruling stays', out.removed === 1 && out.text === 'إعفاء اللحية واجب.', JSON.stringify(out));
      const keep = PC.dropHadithPointersWithoutMatn('قال رسول الله ﷺ: «أعفوا اللحى وحفوا الشوارب».\nوفي هذا الحديث دلالة على الإعفاء.');
      ok('with a matn still quoted, nothing goes', keep.removed === 0, JSON.stringify(keep));
    }
    const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('api/ask.js runs it after the drop', /readerText = dropped\.removed \? dropHadithPointersWithoutMatn\(dropped\.text\)\.text : dropped\.text;/.test(ask));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-d2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
