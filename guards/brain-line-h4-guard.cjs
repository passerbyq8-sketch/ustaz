// guards/brain-line-h4-guard.cjs -- ITEM H4 (74, m0; the owner's decision 10) -- 2026-10-15 brain-line
//
// THE DATE OF THE SNAPSHOT IN THE HADITH LINE. Measured on 7ba44481: the source line of a published hadith translation named
// HadeethEnc.com and not the day its text was taken, though every data file records it (meta.fetchedAt: 2026-10-06 for
// en/fr/fa, 2026-10-07 for ur/id); the 22 hadithSrc templates of lib/lang/table.js (23 rows; Arabic has none) had no slot for it.
//
// What this guard holds (the order, H4): every hadithSrc template carries {snapshot} after the encyclopedia's name; the line
// in en / fr / fa / ur / id carries HadeethEnc.com and that language's measured date; the snapshots are not touched.
// Arabic: «بني الإسلام على خمس», side-brain-line-2026-10-15/tools/t74.mjs line 44.
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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 300);

(async () => {
  const T = await esm('lib/lang/table.js');
  const A = await esm('lib/lang/answer.js');
  const table = fs.readFileSync(path.join(REPO, 'lib/lang/table.js'), 'utf8');
  const templates = table.match(/hadithSrc: '[^']*'/g) || [];
  ok('all 22 hadithSrc templates (the 23 rows less Arabic, which has no translation line) carry {snapshot} after the encyclopedia\'s name ({source})', templates.length === 22 && templates.every((t) => t.includes('{source}{snapshot}')), String(templates.length));
  const echo = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); return { ok: true, text: JSON.stringify(arr.map((s) => 'EN ' + s.replace(/[ء-ي]/g, ''))) }; };
  for (const [lang, date] of [['en', '2026-10-06'], ['fr', '2026-10-06'], ['fa', '2026-10-06'], ['ur', '2026-10-07'], ['id', '2026-10-07']]) {
    const out = (await A.translateAnswer('<hadith>بني الإسلام على خمس</hadith>', { lang, translate: echo, budgetMs: 20000 })).text;
    const trs = (out.match(/ trs="([^"]*)"/) || [])[1] || '';
    ok(lang + ': the hadith line names HadeethEnc.com and the snapshot of ' + date, trs.includes('HadeethEnc.com') && trs.includes(date) && trs.indexOf(date) > trs.indexOf('HadeethEnc.com'), ascii(trs));
    ok(lang + ': the data file\'s own date is that one (the snapshot untouched)', !!T.langRow(lang) && JSON.stringify(require('zlib').gunzipSync(fs.readFileSync(path.join(REPO, 'lib/data/translations', T.langRow(lang).hadith))).toString().slice(0, 400)).includes(date));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-h4: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
