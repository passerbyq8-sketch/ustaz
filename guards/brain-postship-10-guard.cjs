// guards/brain-postship-10-guard.cjs -- POSTSHIP ITEM 10 -- 2026-10-24 (D4, row 9)
//
// THE SAHIH BRACKET STANDS ON THE MATN. Measured (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-MEASURE-REPORT-2026-10-24.md
// row 9; measure/r9-d4.mjs, measure/r9-d4-tolerant.txt): lib/takhrij.js tolerantSahihCarries (half the matn's words, or its first
// four) confirmed a Sahih atom in the narrowed recheck, and 15 of the 17 Sahih brackets that came from it were wrong («لا ضرر ولا
// ضرار» ⟵ (مسلم، والبيهقي) …). The order (item 10): (a) the Sahih bracket only on a matn match -- the whole matn inside the atom,
// or all its words in order for a long matn; a matn under six words by the whole-matn match alone; (b) the three forms of D4
// (5107500a: «٣ تنويعات»), built as: as written · its joining words set aside · cut by the service at the atom's end.
// Fixture: guards/fixtures-postship-10-sahih.json -- the atoms the tolerant reading confirmed for those 17, and five strict ones,
// copied from the measurement's own library reads (fix/item10/make-fixture.mjs).
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

(async () => {
  const TK = await esm('lib/takhrij.js');
  const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-postship-10-sahih.json'), 'utf8'));
  console.log('-- (a) the seventeen the tolerant reading confirmed');
  let still = 0;
  for (const t of FIX.tolerant) for (const a of t.atoms) if (TK.tolerantSahihCarries(a.text, t.matn)) still += 1;
  const n = FIX.tolerant.reduce((k, t) => k + t.atoms.length, 0);
  ok('none of their ' + n + ' Sahih atoms carries the matn any more (the 15 wrong brackets lose their ground)', still === 0, still + ' still read as carrying');
  const lddr = FIX.tolerant.find((t) => t.matn === 'لا ضرر ولا ضرار');
  ok('«لا ضرر ولا ضرار» (three words) is read by the whole-matn match alone', !!lddr && lddr.atoms.every((a) => !TK.tolerantSahihCarries(a.text, lddr.matn)));
  // the bracket itself, through applyTakhrij with a lookup that answers as the library did: the lower collector that carries
  // the matn (strict) and the Sahih atoms; the narrowed recheck (one book id) answers that book's atoms only.
  const runOne = async (matn, sahihAtoms, lower = []) => {
    const all = [...lower, ...sahihAtoms];
    const lookup = async (matns, options = {}) => matns.map((m) => {
      const ids = (options && options.bookIds) || [];
      const pick = ids.length ? all.filter((a) => ids.includes(a.subject_id)) : all;
      return { matn: m, subjectIds: pick.map((a) => a.subject_id), atoms: pick.map((a) => a.text) };
    });
    return TK.applyTakhrij('قال رسول الله ﷺ: «' + matn + '».', { env: { TAKHRIJ_V1: 'on' }, lookup });
  };
  const out = await runOne(lddr.matn, lddr.atoms, lddr.lower);
  ok('...and the lower collector that carries it is what the bracket names', FIX.tolerant.every((t) => t.lower.length) && /\(/u.test(out.text), JSON.stringify(out.text).replace(/[^\x20-\x7e]/g, '.'));
  let wrongNow = 0;
  for (const t of FIX.tolerant) { const o = await runOne(t.matn, t.atoms, t.lower); if (/\((?:مسلم|البخاري|متفق عليه)/u.test(o.text)) wrongNow += 1; }
  ok('all seventeen through applyTakhrij: no Sahih bracket from those atoms (was 17, 15 of them wrong)', wrongNow === 0, wrongNow + '/17');
  ok('«لا ضرر ولا ضرار» with only those atoms: no «(مسلم» / «(البخاري» bracket', !/\((?:مسلم|البخاري|متفق عليه)/u.test(out.text), JSON.stringify(out.text).replace(/[^\x20-\x7e]/g, '.'));

  console.log('-- the strict Sahih brackets stay');
  for (const t of FIX.strict) {
    const o = await runOne(t.matn, t.atoms);
    ok('strict: «' + t.matn.slice(0, 24).replace(/[^\x20-\x7e]/g, '.') + '…» still names the Sahih', /\((?:مسلم|البخاري|متفق عليه)/u.test(o.text), JSON.stringify(o.text).replace(/[^\x20-\x7e]/g, '.').slice(0, 120));
  }

  console.log('-- (b) the three forms (COMPOSED atoms around a real matn)');
  const MATN = 'من صام رمضان وأتبعه ستا من شوال كان كصيام الدهر';   // guards/brain-line-d4-guard.cjs (witness/129.md:6)
  const isnad = 'حدثنا يحيى بن أيوب وقتيبة بن سعيد عن إسماعيل عن سعد بن سعيد عن عمر بن ثابت عن أبي أيوب أن رسول الله صلى الله عليه وسلم قال: ';
  ok('(1) as written', TK.tolerantSahihCarries(isnad + MATN + '.', MATN));
  ok('(2) its joining words set aside: «ثم أتبعه» for «وأتبعه»', TK.tolerantSahihCarries(isnad + 'من صام رمضان ثم أتبعه ستا من شوال كان كصيام الدهر.', MATN));
  ok('(2) but not its words scattered: half the matn in another hadith', !TK.tolerantSahihCarries(isnad + 'من صام يوما في سبيل الله باعد الله وجهه عن النار سبعين خريفا، ومن شوال إلى رمضان الدهر كله.', MATN));
  const cut = (isnad.repeat(12) + 'من صام رمضان ثم أتبعه ستا من').slice(-2000);
  ok('(3) cut by the service, ending on the matn\'s first six words', TK.tolerantSahihCarries(cut, MATN));
  ok('(3) but an uncut short atom ending on them is not enough', !TK.tolerantSahihCarries(isnad + 'من صام رمضان ثم أتبعه ستا من', MATN));
  ok('a matn under six words is matched whole or not at all', !TK.tolerantSahihCarries(isnad + 'لا ضرر في الإسلام ولا ضرار بين المسلمين.', 'لا ضرر ولا ضرار')
    && TK.tolerantSahihCarries(isnad + 'لا ضرر ولا ضرار.', 'لا ضرر ولا ضرار'));
  ok('the threshold is the order\'s: six words', TK.SAHIH_SHORT_MATN === 6);

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
