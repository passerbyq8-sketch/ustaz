// guards/brain-line-c5-guard.cjs -- ITEM C5 (125 a; axis row 10) -- 2026-10-15 brain-line
//
// A NAMED BOOK THE ANSWER DID NOT RETRIEVE. Measured on 7ba44481 (side-brain-line-2026-10-15/side/axis-bw2.md 10-1..10-4):
// on a single encyclopedia row the four sentences below were released with the encyclopedia's tail.
//
// What this guard holds (the order, C5):
//   - lib/named-books.js knows the books (catalogue + school books + takhrij ladder + short names) and reads a
//     sentence that attributes to one («جاء/ورد/نصّ/ذكر/قال … في <كتاب>», «وفي <كتاب>», «صاحب <كتاب>»);
//   - BW2 holds such a unit unless the book is among the answer's rows (reason unsupported_attribution: a new
//     reason name would add a telemetry field outside the text guard's closed list -- report §8);
//   - the free brain removes the whole sentence (withoutUnretrievedBooks, before the review);
//   - with the book among the rows, the same unit goes out.
//
// Fixtures: axis-bw2.mjs ENC_MASS (:15-16) and the streams 10-1..10-4 (:39-42), verbatim
// (sessions/side-brain-line-2026-10-15/tools/axis-bw2.mjs); the al-Majmu' row is COMPOSED.
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
// COMPOSED: a library row of al-Majmu' that carries the ruling
const MAJMU = { ref: 1, kind: 'lib_book', bookTitle: 'المجموع شرح المهذب', title: 'المجموع شرح المهذب', author: 'النووي', recordId: 'FC-majmu',
  text: 'مس الذكر ينقض الوضوء عند الشافعية إذا كان بباطن الكف.' };
// axis-bw2.mjs:39-42
const FOUR = [
  ['10-1', 'جاء في المجموع للنووي أن مس الذكر ينقض الوضوء [[1]]'],
  ['10-2', 'وفي المغني لابن قدامة أن مس الذكر ينقض الوضوء [[1]]'],
  ['10-3', 'قال النووي في المجموع: مس الذكر ينقض الوضوء [[1]]'],
  ['10-4', 'ونص صاحب بدائع الصنائع على أن مس الذكر لا ينقض الوضوء [[1]]'],
];
const cards = { max: 3, encyclopediaCards: true, buildBookTag: (b) => ({ tag: '<book title="' + b.bookTitle + '"></book>' }), buildSourceTag: (r) => ({ tag: '<source url="' + r.url + '"></source>' }) };

(async () => {
  const NB = await esm('lib/named-books.js');
  const U = await esm('lib/bw2-units.js');
  const BW = await esm('lib/before-writing-v2.js');
  const LOOP = await esm('lib/free-brain/loop.js');
  const run = async (rows, stream) => {
    const rel = U.createBw2Releaser({ rows, mode: 'brief', emit: () => true, cards, notCoveredSentence: BW.BW2_NOT_COVERED || '' });
    rel.push(stream);
    const sum = await rel.end();
    return { text: String(sum.text || ''), holds: sum.holds || {} };
  };

  console.log('-- 1. the index and the detector');
  ok('the index holds the catalogue and the short names', NB.namedBookIndex().length > 5000);
  for (const [id, s] of FOUR) ok(id + ' attributes to a book', NB.attributedBooks(s).length === 1, JSON.stringify(NB.attributedBooks(s)));
  ok('«وقد جاء في الحديث…» names no book', NB.attributedBooks('وقد جاء في الحديث أن الصيام جنة').length === 0);
  ok('the encyclopedia row carries «الموسوعة الفقهية الكويتية»', NB.unretrievedBooks('جاء في الموسوعة الفقهية الكويتية أن مس الذكر ينقض', [ENC_MASS]).length === 0);

  console.log('-- 2. BW2: held on the encyclopedia row alone, released when the book is among the rows');
  for (const [id, s] of FOUR) {
    const r = await run([ENC_MASS], s);
    ok(id + ' held on ENC_MASS alone', !r.text.includes('مس الذكر'), JSON.stringify(r));
  }
  {
    const r = await run([MAJMU], 'جاء في المجموع للنووي أن مس الذكر ينقض الوضوء [[1]]');
    ok('10-1 released when al-Majmu\' is among the rows', r.text.includes('المجموع'), JSON.stringify(r));
  }

  console.log('-- 3. the free brain removes the whole sentence');
  {
    ok('loop exports withoutUnretrievedBooks', typeof LOOP.withoutUnretrievedBooks === 'function');
    if (typeof LOOP.withoutUnretrievedBooks === 'function') {
      const all = FOUR.map(([, s]) => s + '.').join(' ') + '\nومن الأدب أن يتوضأ المسلم بعد ذلك.';
      const out = LOOP.withoutUnretrievedBooks(all, [ENC_MASS]);
      ok('the four sentences are removed whole', out.removed === 4 && !/المجموع|المغني|بدائع/u.test(out.text), JSON.stringify(out));
      ok('the sentence that names no book stays', out.text.includes('ومن الأدب'), JSON.stringify(out));
      const kept = LOOP.withoutUnretrievedBooks(FOUR[0][1] + '.', [MAJMU]);
      ok('with al-Majmu\' among the rows it stays', kept.removed === 0, JSON.stringify(kept));
    }
    const src = fs.readFileSync(path.join(REPO, 'lib/free-brain/loop.js'), 'utf8');
    ok('the loop runs it before the review',
      /answer = withoutUnretrievedBooks\(answer, table\.rows\)\.text;/.test(src)
      && src.indexOf('withoutUnretrievedBooks(answer, table.rows)') < src.indexOf('let proposedRows = citedRefs.map'));
  }

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c5: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
