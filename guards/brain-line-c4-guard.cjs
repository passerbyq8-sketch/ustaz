// guards/brain-line-c4-guard.cjs -- ITEM C4 (axis row 9) -- 2026-10-15 brain-line
//
// THE ENCYCLOPEDIA'S TAIL AND CARD STOOD ON A CITATION, NOT ON SUPPORT; AND «المصدر:» WAS THE MODEL'S TO WRITE.
// Measured on 7ba44481 (side-brain-line-2026-10-15/side/axis-bw2.md 9-1, 9-1b, 9-2): «يجب الوضوء من أكل لحم الإبل…
// [[1]]» cited to the row on touching the private part was released with the encyclopedia card AND «المصدر:
// الموسوعة الفقهية الكويتية.»; a writer's own «المصدر: الموسوعة…» line on a fatwa row was released.
//
// What this guard holds (the order, C4):
//   (1) the encyclopedia card and tail only when a released unit citing the row is SUPPORTED by the row's text
//       (the reviewer's supportsSentence test);
//   (2) every line the writer opens with «المصدر:» is stripped before review -- the server alone writes it;
//   (3) in the evidence handed to the model, the row's publisher is not labelled «المصدر:».
//
// Fixtures: axis-bw2.mjs ENC_MASS (:15-16), FATWA (:19-20) and the streams of 9-1 (:35), 9-1b (:36), 9-2 (:37),
// verbatim (sessions/side-brain-line-2026-10-15/tools/axis-bw2.mjs). The supported unit is COMPOSED from ENC_MASS.
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

// axis-bw2.mjs:15-16
const ENC_MASS = { ref: 1, kind: 'encyclopedia', publisher: 'الموسوعة الفقهية الكويتية', part: 39, recordId: 'F-mass',
  title: 'مس الذكر', text: 'مس الذكر: ذهب الحنفية إلى أن مس الذكر لا ينقض الوضوء، وينقض الوضوء عند الحنابلة والشافعية إذا كان بباطن الكف من غير حائل.' };
// axis-bw2.mjs:19-20
const FATWA = { ref: 1, kind: 'fatwa', publisher: 'ابن باز', scholarId: 'binbaz', recordId: '77', url: 'https://binbaz.org.sa/fatwas/77',
  title: 'حكم السفر', text: 'السفر الذي تقصر فيه الصلاة هو ما يسمى سفرا عرفا، وقدره بعض العلماء بنحو ثمانين كيلو.' };
const cards = { max: 3, encyclopediaCards: true, buildBookTag: (b) => ({ tag: '<book title="' + b.bookTitle + '"></book>' }), buildSourceTag: (r) => ({ tag: '<source url="' + r.url + '"></source>' }) };

(async () => {
  const U = await esm('lib/bw2-units.js');
  const BW = await esm('lib/before-writing-v2.js');
  const LOOP = await esm('lib/free-brain/loop.js');
  const TOOLS = await esm('lib/free-brain/tools.js');
  const run = async (rows, stream) => {
    const sent = [];
    const rel = U.createBw2Releaser({ rows, mode: 'brief', emit: (p) => { sent.push(p); return true; }, cards, notCoveredSentence: BW.BW2_NOT_COVERED || '' });
    rel.push(stream);
    const sum = await rel.end();
    const text = String(sum.text || '');
    return { text, tail: LOOP.encyclopediaTail(sum.cited, text), sent: sent.join('') };
  };

  console.log('-- 1. the card and the tail stand on support');
  for (const [id, stream] of [['9-1', 'يجب الوضوء من أكل لحم الإبل عند الحنابلة [[1]]'], ['9-1b', 'يجب الوضوء من أكل لحم الإبل [[1]]']]) {
    const r = await run([ENC_MASS], stream); // axis-bw2.mjs:35-36
    ok(id + ': no encyclopedia card for a row that does not support the unit', !r.sent.includes('<book'), r.sent.slice(0, 200));
    ok(id + ': no «المصدر: الموسوعة…» tail', !r.tail.includes('المصدر'), JSON.stringify(r.tail));
  }
  {
    const r = await run([ENC_MASS], 'وينقض الوضوء مس الذكر عند الحنابلة والشافعية إذا كان بباطن الكف من غير حائل [[1]]'); // COMPOSED from ENC_MASS
    ok('a supported unit keeps its encyclopedia card', r.sent.includes('<book'), r.sent.slice(0, 200));
    ok('...and its tail', r.tail.includes('المصدر: الموسوعة الفقهية الكويتية'), JSON.stringify(r.tail));
  }

  console.log('-- 2. «المصدر:» is the server\'s line');
  {
    const r = await run([FATWA], 'السفر ما يسمى سفرا في العرف [[1]]. المصدر: الموسوعة الفقهية الكويتية.'); // axis-bw2.mjs:37
    ok('9-2: the writer\'s «المصدر: الموسوعة…» on a fatwa row is stripped', !r.text.includes('المصدر'), JSON.stringify(r.text));
    ok('9-2: the sourced sentence before it stays', r.text.includes('سفرا في العرف'), JSON.stringify(r.text));
    const loopSrc = fs.readFileSync(path.join(REPO, 'lib/free-brain/loop.js'), 'utf8');
    ok('the free brain strips the writer\'s «المصدر:» lines before the review',
      /answer = withoutModelSourceLines\(answer\)/.test(loopSrc)
      && loopSrc.indexOf('answer = withoutModelSourceLines(answer)') < loopSrc.indexOf('let proposedRows = citedRefs.map'));
    ok('withoutModelSourceLines removes the line and keeps the rest',
      typeof LOOP.withoutModelSourceLines === 'function'
      && LOOP.withoutModelSourceLines('الجواب هنا [[1]].\nالمصدر: الموسوعة الفقهية الكويتية.') === 'الجواب هنا [[1]].');
    ok('the free brain marks its cited encyclopedia rows with the support of the delivered text',
      /markEncyclopediaSupport\(cited, deliveredText\);/.test(loopSrc));
    const rowsA = [{ ...ENC_MASS }];
    LOOP.markEncyclopediaSupport(rowsA, 'يجب الوضوء من أكل لحم الإبل');
    ok('a marked unsupported row gives no tail through api/ask.js\'s call (encyclopediaTail(out.cited))', LOOP.encyclopediaTail(rowsA) === '' && rowsA[0].deliveredSupport === false);
    const rowsB = [{ ...ENC_MASS }];
    LOOP.markEncyclopediaSupport(rowsB, 'وينقض الوضوء مس الذكر عند الحنابلة والشافعية إذا كان بباطن الكف');
    ok('a marked supported row keeps it', LOOP.encyclopediaTail(rowsB).includes('المصدر: الموسوعة الفقهية الكويتية'));
  }

  console.log('-- 3. the evidence the model reads does not say «المصدر:»');
  {
    const shown = TOOLS.renderRows([{ ref: 1, title: 'مس الذكر', publisher: 'الموسوعة الفقهية الكويتية', text: 'نص' }]);
    ok('renderRows labels the publisher without «المصدر:»', !shown.includes('المصدر:') && shown.includes('الموسوعة الفقهية الكويتية'), JSON.stringify(shown));
  }

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c4: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
