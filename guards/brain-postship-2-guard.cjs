// guards/brain-postship-2-guard.cjs -- POSTSHIP ITEM 2 -- 2026-10-24 (row 3)
//
// «الجواب:» ONCE IN EVERY SERVER-OWNED FATWA BLOCK. Measured (sessions/side-brain-postship-2026-10-24/
// EZIK-CC-POSTSHIP-MEASURE-REPORT-2026-10-24.md, row 3; measure/r3-witness.out.txt): binothaimeen 6971 «حكم مس المصحف
// للمحدث» in the 2-4k store -- its question field reads «ما حكم مس المصحف للمحدث؟ الجواب: الصحيح أنه حرام…» and its
// answer field «السؤال: … الجواب: …», so lib/full-fatwa.js serverOwnedBlock printed the fatwa twice and «الجواب:»
// three times. Across both stores 8884 of 126269 blocks printed «الجواب:» more than once (measure/r3-scan.mjs).
//
// The order (item 2): normalise at serving, not in the stores. A question field that carries «الجواب:» keeps what is
// before it; an answer field that opens «السؤال: … الجواب:» or «الجواب:» loses the repeated headings. The block prints
// «السؤال:» once and «الجواب:» once, and the answer's own text is the same letter for letter.
//
// Fixture: guards/fixtures-postship-2-fatwas.json -- six rows copied verbatim from the stores (fix/item2/make-fixture.mjs).
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
const LABEL_A = /(?:ال)?جـ?ـ?واب\s*[:：]/gu;            // the scan's own count (measure/r3-scan.mjs countJawabAny)
const LABEL_Q = /(?:^|\n)(?:ال)?سؤال\s*[:：]/gu;
const count = (s, re) => (String(s).match(re) || []).length;
const strip = (s) => String(s).replace(LABEL_A, ' ').replace(/[ً-ْـ]/gu, '').replace(/\s+/gu, ' ').trim();
const answerPart = (block) => { const i = block.indexOf('\nالجواب:\n'); return i < 0 ? null : block.slice(i + '\nالجواب:\n'.length); };

(async () => {
  const FF = await esm('lib/full-fatwa.js');
  const FIX = require('./fixtures-postship-2-fatwas.json');
  const build = (r) => FF.buildFatwaRecord({ id: r.id, question: r.question, answer: r.answer, title: r.title, url: r.url, sourceKind: 'corpus', contentMode: 'written_fatwa' });
  // expected answer text per row (on the record as served): the stored answer, minus the repeated «السؤال: … الجواب:» opening where the row has one
  const EXPECT = {
    'binothaimeen:6971': (r) => r.answer.slice(r.answer.indexOf('الجواب:') + 'الجواب:'.length),
  };
  for (const r of FIX.rows) {
    const rec = build(r);
    const block = FF.serverOwnedBlock(rec, [], {});
    console.log('-- ' + r.id + ' (' + r.why.replace(/[^\x20-\x7e]/g, '.') + ')');
    ok(r.id + ': the block is printed in full', rec.displayPolicy === 'full' && block.startsWith('## نص الفتوى'));
    ok(r.id + ': «الجواب:» once in the block', count(block, LABEL_A) === 1, 'count ' + count(block, LABEL_A));
    ok(r.id + ': «السؤال:» once in the block', count(block, LABEL_Q) === 1, 'count ' + count(block, LABEL_Q));
    const printed = answerPart(block);
    const want = (EXPECT[r.id] || ((x) => x.answer))(rec);
    ok(r.id + ': the answer text is the stored one, letter for letter, once the headings are taken out',
      printed != null && strip(printed) === strip(want), printed == null ? 'no answer part' : 'printed ' + strip(printed).length + ' want ' + strip(want).length);
  }
  // the witness itself
  const W = FIX.rows.find((r) => r.id === 'binothaimeen:6971');
  const wb = FF.serverOwnedBlock(build(W), [], {});
  ok('witness 6971: «الجواب:» 3 -> 1', count(wb, LABEL_A) === 1, String(count(wb, LABEL_A)));
  ok('witness 6971: the question is printed once', count(wb, /ما حكم مس المصحف للمحدث/gu) === 1, String(count(wb, /ما حكم مس المصحف للمحدث/gu)));
  ok('witness 6971: the question line is what the question field holds before «الجواب:»', wb.includes('السؤال:\nما حكم مس المصحف للمحدث؟\n'));

  // controls (COMPOSED): a record with no headings prints byte for byte as before; the spans path is untouched
  const plain = FF.buildFatwaRecord({ id: 'x:1', question: 'ما حكم كذا؟', answer: 'الحمد لله، هذا جائز.\n\nوالله أعلم.', title: 't', url: 'https://binbaz.org.sa/fatwas/1', sourceKind: 'corpus' });
  ok('control: a record without headings prints exactly as before',
    FF.serverOwnedBlock(plain, [], {}) === ['## نص الفتوى', '', 'السؤال:', plain.question, '', 'الجواب:', plain.answer].join('\n'));
  const TXT = await esm('lib/fatwa-text.js');
  ok('control: the record itself is not rewritten -- only the printed block is normalised',
    build(W).answer === FF.cleanStructural(TXT.cleanFatwaText(W.answer)) && build(W).question === FF.cleanStructural(TXT.cleanFatwaText(W.question))
    && build(W).fullTextHash === FF.fullTextHash(build(W).question, build(W).answer));
  ok('control: young readers still get no block', FF.serverOwnedBlock(build(W), [], { band: 'young' }) === '');

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
