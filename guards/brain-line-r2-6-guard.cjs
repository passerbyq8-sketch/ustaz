// guards/brain-line-r2-6-guard.cjs -- ITEM r2-6 (C4 follow-up) -- 2026-10-17 brain-line R2
//
// THE ENCYCLOPEDIA TAIL AND ITS CARD ON ONE VERDICT. Measured on the preview of fa778c0e (sessions/side-brain-fix-2026-10-15/
// EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt lines 72-73 and 87, B1 «ما معنى قوله تعالى: إن مع العسر يسرا؟»): three book
// cards, no encyclopedia card, and the last line «المصدر: الموسوعة الفقهية الكويتية.»; in A2 and D2 (line 155) the tail came
// with the card. The tail stood on encyclopediaRowSupported over the delivered text, the card on the unit's own support and
// on the cards' caps (BW2_CARDS_PER_UNIT): a card owed and never sent left its tail behind.
//
// What this guard holds (the R2 order, item 6):
//   (1) BW2: a unit citing a fatwa and a supporting encyclopedia row -- one card per unit, the encyclopedia card owed and
//       never sent -> no tail (before: the tail was written);
//   (2) the same row with its card shown -> the tail (A2/D2 not broken);
//   (3) the free brain: pickEncyclopediaCards marks each cited encyclopedia row cardShown, and the tail names only a row
//       shown; with the switch off (no chip picked, nothing marked) it is decided as before; api/ask.js is not touched.
// The two rows are guards/brain-line-c4-guard.cjs's (from side-brain-line-2026-10-15/tools/axis-bw2.mjs lines 15-20).
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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 400);

// axis-bw2.mjs:19-20 (as in brain-line-c4-guard.cjs), ref 1
const FATWA = { ref: 1, kind: 'fatwa', publisher: 'ابن باز', scholarId: 'binbaz', recordId: '77', url: 'https://binbaz.org.sa/fatwas/77',
  title: 'حكم السفر', text: 'السفر الذي تقصر فيه الصلاة هو ما يسمى سفرا عرفا، وقدره بعض العلماء بنحو ثمانين كيلو.' };
// axis-bw2.mjs:15-16 (as in brain-line-c4-guard.cjs), ref 2 here
const ENC = { ref: 2, kind: 'encyclopedia', publisher: 'الموسوعة الفقهية الكويتية', part: 39, recordId: 'F-mass',
  title: 'مس الذكر', text: 'مس الذكر: ذهب الحنفية إلى أن مس الذكر لا ينقض الوضوء، وينقض الوضوء عند الحنابلة والشافعية إذا كان بباطن الكف من غير حائل.' };
const cards = { max: 3, encyclopediaCards: true, buildBookTag: (b) => ({ tag: '<book title="' + b.bookTitle + '"></book>' }), buildSourceTag: (r) => ({ tag: '<source url="' + r.url + '"></source>', url: r.url }) };
// composed from ENC (the C4 guard's supported sentence)
const SUPPORTED = 'وينقض الوضوء مس الذكر عند الحنابلة والشافعية إذا كان بباطن الكف من غير حائل';

(async () => {
  const U = await esm('lib/bw2-units.js');
  const BW = await esm('lib/before-writing-v2.js');
  const LOOP = await esm('lib/free-brain/loop.js');
  // the tail exactly as lib/before-writing-v2.js asks for it after the releaser
  const bwSrc = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
  const run = async (rows, stream) => {
    const sent = [];
    const rel = U.createBw2Releaser({ rows, mode: 'brief', emit: (p) => { sent.push(p); return true; }, cards, notCoveredSentence: BW.BW2_NOT_COVERED || '' });
    rel.push(stream);
    const sum = await rel.end();
    const text = String(sum.text || '');
    return { text, sent: sent.join(''), tail: LOOP.encyclopediaTail(sum.cited, text, sum.encyclopediaShown) };
  };
  console.log('-- 1. BW2: the card owed, never sent');
  {
    // the fatwa row carries the same ruling (composed: ENC's sentence), so both rows support the unit and the cap decides
    const FATWA_SAME = { ...FATWA, text: ENC.text.replace(/^مس الذكر: /u, '') };
    const r = await run([FATWA_SAME, ENC], SUPPORTED + ' [[1]][[2]]');
    ok('one card went out, the fatwa page; the encyclopedia card did not', r.sent.includes('<source') && !r.sent.includes('<book'), ascii(r.sent.slice(0, 200)));
    ok('...so no encyclopedia tail', !r.tail.includes('المصدر'), ascii(r.tail));
  }
  console.log('-- 2. BW2: the card shown');
  {
    const r = await run([ENC], SUPPORTED + ' [[1]]'.replace('1', '2'));
    ok('the encyclopedia card went out', r.sent.includes('<book'), ascii(r.sent.slice(0, 200)));
    ok('...and its tail with it (A2/D2)', r.tail.includes('المصدر: الموسوعة الفقهية الكويتية'), ascii(r.tail));
  }
  ok('before writing asks the tail with the shown cards', /encyclopediaTail\(summary\.cited, String\(wire\.sent \|\| ''\), summary\.encyclopediaShown\)/.test(bwSrc));
  console.log('-- 3. the free brain');
  {
    // api/ask.js, the switch on: pickEncyclopediaCards(out.cited, …) and then encyclopediaTail(out.cited) -- in that order
    const shown = { ...ENC, deliveredSupport: true };
    const chips = LOOP.pickEncyclopediaCards([shown], 3, cards.buildBookTag);
    ok('a chip made -> the tail', chips.length === 1 && LOOP.encyclopediaTail([shown]).includes('المصدر'));
    const noVolume = { ...ENC, part: undefined, deliveredSupport: true };
    const none = LOOP.pickEncyclopediaCards([noVolume], 3, cards.buildBookTag);
    ok('no chip made for the row (no volume) -> no tail', none.length === 0 && LOOP.encyclopediaTail([noVolume]) === '', ascii(LOOP.encyclopediaTail([noVolume])));
    const second = { ...ENC, ref: 3, recordId: 'F-mass-2', part: 40, deliveredSupport: true };
    const first = { ...ENC, deliveredSupport: true };
    LOOP.pickEncyclopediaCards([first, second], 1, cards.buildBookTag);
    ok('a row past the chips\' ceiling is marked not shown', first.cardShown === true && second.cardShown === false);
    const off = { ...ENC, deliveredSupport: true };
    ok('the switch off (no chip picked, nothing marked) -> the tail as before', LOOP.encyclopediaTail([off]).includes('المصدر'));
    const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('api/ask.js picks the chips before it asks the tail (its sealed footer line unchanged)',
      askSrc.indexOf('pickEncyclopediaCards(out.cited') > 0 && askSrc.indexOf('pickEncyclopediaCards(out.cited') < askSrc.indexOf('finalizerContext.readerSuffix = encyclopediaTail(out.cited);'));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-6: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
