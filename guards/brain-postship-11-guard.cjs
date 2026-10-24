// guards/brain-postship-11-guard.cjs -- POSTSHIP ITEM 11 -- 2026-10-24 (row 2, with D1-B)
//
// NO BRACKET WITHOUT A RAF' MARK, AND THE MAWQUF IS NOT BRACKETED AS THE PROPHET'S. Measured (sessions/side-brain-postship-
// 2026-10-24/EZIK-CC-POSTSHIP-MEASURE-REPORT-2026-10-24.md row 2; measure/r2-witness.mjs, r2-takhrij.mjs, r2-analyze2.mjs):
// «وقد جاء في الحديث: «لن يغلب عسر يسرين» (البخاري).» -- the bracket written from FC-000645:2595:002, where before the matn
// stands «…قال ابن عيينه…»: no isnad, no «ﷺ», no «رسول الله», no «النبي». The order (item 11): (a) no bracket except on an
// atom that carries a raf' mark -- in it, or in the part before it of the same hadith -- so a sound hadith whose mark is in an
// earlier part does not fall; (b) the mawquf as D1-B defines it is not bracketed as marfu'.
// Fixture: guards/fixtures-postship-11-raf.json -- the witness atom and the Muslim atom of «من سلك طريقا…», copied from the
// measurement's reads (fix/item11/make-fixture.mjs). The part-before and mawquf atoms below are COMPOSED around real matns.
'use strict';
const path = require('path');
const fs = require('fs');

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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, '.').slice(0, 160);

(async () => {
  const TK = await esm('lib/takhrij.js');
  const PC = await esm('lib/prophetic-claims.js');
  const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-postship-11-raf.json'), 'utf8'));
  // a lookup that answers every request with the given atoms (subject ids, texts, atom ids) -- the shape runnerLookup returns
  const lookupOf = (rows) => async (matns, options = {}) => matns.map((m) => {
    const ids = (options && options.bookIds) || [];
    const pick = ids.length ? rows.filter((r) => ids.includes(r.subject_id)) : rows;
    return { matn: m, subjectIds: pick.map((r) => r.subject_id), atoms: pick.map((r) => r.text), atomIds: pick.map((r) => r.atom_id) };
  });
  const run = async (sentence, rows) => {
    const stripped = PC.stripModelCollectionParens(sentence);
    const pass = await TK.applyTakhrij(stripped, { env: { TAKHRIJ_V1: 'on' }, lookup: lookupOf(rows) });
    return { pass, out: PC.dropUnconfirmedProphetic(pass.text, pass.entries) };
  };

  console.log('-- (a) the witness');
  const W = FIX.atoms['FC-000645:2595:002'];
  const w = await run('وقد جاء في الحديث: «لن يغلب عسر يسرين» (البخاري).', [{ atom_id: 'FC-000645:2595:002', ...W }]);
  ok('no «(البخاري)» after «لن يغلب عسر يسرين»', !/لن يغلب عسر يسرين» \(البخاري/u.test(w.out.text) && !/\(البخاري\)/u.test(w.out.text), ascii(w.out.text));
  ok('...and the unconfirmed Prophetic frame is removed (D1-A stands)', w.out.removed > 0, ascii(w.out.text));
  ok('...the matn is declined for want of a raf\' mark', (w.pass.entries[0] || {}).declined === 'no_raf_mark', JSON.stringify((w.pass.entries[0] || {}).declined));

  console.log('-- (a) a sound hadith whose mark stands far above the matn keeps its bracket');
  const M = FIX.atoms['FC-000648:1234:001'];
  const m = await run('قال رسول الله ﷺ: «' + M.matn + '».', [{ atom_id: 'FC-000648:1234:001', ...M }]);
  ok('«من سلك طريقا…» (Muslim) still «(مسلم)»', /\(مسلم/u.test(m.out.text), ascii(m.out.text));

  console.log('-- (a) the mark in the part before, of the same hadith (COMPOSED)');
  const MATN = 'الطهور شطر الإيمان والحمد لله تملأ الميزان';
  const part1 = 'حدثنا إسحاق بن منصور حدثنا حبان بن هلال حدثنا أبان حدثنا يحيى أن زيدا حدثه أن أبا سلام حدثه عن أبي مالك الأشعري قال: قال رسول الله صلى الله عليه وسلم: ';
  const part2 = 'وفي رواية أخرى بهذا الإسناد مثله وقال فيه ' + MATN + ' وسبحان الله والحمد لله تملآن ما بين السماوات والأرض.';
  const bothParts = [{ atom_id: 'FC-000648:0223:001', subject_id: 'FC-000648', text: part1 }, { atom_id: 'FC-000648:0223:002', subject_id: 'FC-000648', text: part2 }];
  const pb = await run('قال رسول الله ﷺ: «' + MATN + '».', bothParts);
  ok('the part before carries «رسول الله»: the bracket stands', /\(مسلم/u.test(pb.out.text), ascii(pb.out.text));
  const pb2 = await run('قال رسول الله ﷺ: «' + MATN + '».', [bothParts[1]]);
  ok('control: without the part before, the same unmarked part gives no bracket', !/\(مسلم/u.test(pb2.out.text), ascii(pb2.out.text));

  console.log('-- (b) the mawquf (D1-B; COMPOSED atom around WP06:41)');
  const MQ = 'يا أهل مكة لا تقصروا في أدنى من أربعة برد';
  const mqAtom = { atom_id: 'FC-000645:1086:001', subject_id: 'FC-000645', text: 'حدثنا مسدد حدثنا يحيى عن سفيان عن عطاء عن ابن عباس قال: ' + MQ + ' من مكة إلى عسفان.' };
  const mq = await run('وقال النبي صلى الله عليه وسلم: «' + MQ + '».', [mqAtom]);
  ok('a Companion\'s words (an isnad, no «رسول الله»/«النبي») are not bracketed as the Prophet\'s', !/\(البخاري/u.test(mq.out.text), ascii(mq.out.text));
  ok('...declined mawquf_as_marfu, on Ibn Abbas', (mq.pass.entries[0] || {}).declined === 'mawquf_as_marfu' && /عباس/u.test(String((mq.pass.entries[0] || {}).mawqufOn || '')), JSON.stringify(mq.pass.entries[0] || {}).replace(/[^\x20-\x7e]/g, '.').slice(0, 200));
  ok('the reader of the mawquf frame reads the whole hadith before the matn, not ninety characters', TK.mawqufNarrator(mqAtom.text, MQ).length > 0);

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
