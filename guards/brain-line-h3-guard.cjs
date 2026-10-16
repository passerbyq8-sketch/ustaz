// guards/brain-line-h3-guard.cjs -- ITEM H3 (74, m0) -- 2026-10-15 brain-line
//
// THE SILENT CUT, THE REPEATED NOTES AND THE LENGTH OF A TRANSLATION. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t74.md):
// settle() turned three sentences, the third copied back in Arabic, into two -- the third was gone; dropRepeatedNotes kept
// «(al-Bukhari: 52)» and cut «(al-Bukhari: 60)» as a repeat of its label; the speculator and the final translation each sent
// the glossary of a term afresh; and a translation of any length was taken.
//
// What this guard holds (the order, H3):
//   (1) the three sentences of t74 -> three: the first answer is refused (asked again), the second keeps the Arabic sentence;
//   (2) «الإسلام» is explained once across the speculator and the final translation (one glossary memory);
//   (3) a paragraph translated at more than 2.2 x its source is asked again with a note to be concise;
//   (4) «(al-Bukhari: 52)» then «(al-Bukhari: 60)» -> both kept (a repeat of 52 still dropped).
// Arabic copied from side-brain-line-2026-10-15/tools/t74.mjs lines 44-47 and side/t129-after.json line 6.
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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 300);

(async () => {
  const A = await esm('lib/lang/answer.js');
  const src3 = 'الصلاة واجبة على كل مسلم. والزكاة ركن من أركان الإسلام. والصيام فرض في شهر رمضان المبارك على المكلفين جميعا.';
  const out3 = 'Prayer is obligatory on every Muslim. Zakat is a pillar of Islam. والصيام فرض في شهر رمضان المبارك على المكلفين جميعا.';
  const B = 'والحديث لا يثبت لكنَّ معناه صحيحٌ ثابتٌ بأدلّةٍ أخرى، فالإسلامُ يأمر بالنظافة.';

  console.log('-- 1. the third sentence');
  ok('the first answer with a sentence back in Arabic and no translation beside it is refused (asked again)', A.settle(src3, out3, 'en') === null);
  ok('the second keeps it: three sentences, the third in Arabic', A.settle(src3, out3, 'en', { keepArabic: true }) === out3);
  let calls3 = 0;
  const stubborn = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); calls3 += 1; return { ok: true, text: JSON.stringify(arr.map((s) => (s === src3 ? out3 : 'EN ' + s.replace(/[ء-ي]/g, '')))) }; };
  const t1 = (await A.translateAnswer(src3, { lang: 'en', translate: stubborn, budgetMs: 20000 })).text;
  ok('end to end: asked again, then delivered with all three sentences (none cut)', calls3 >= 2 && t1.includes('Zakat is a pillar of Islam') && t1.includes('والصيام فرض في شهر رمضان'), ascii(JSON.stringify({ calls3, t1 })));

  console.log('-- 2. one glossary memory');
  const prompts = [];
  const echo = async ({ user }) => { prompts.push(String(user)); const arr = JSON.parse(String(user).split('INPUT:\n')[1]); return { ok: true, text: JSON.stringify(arr.map((s) => 'EN ' + s.replace(/[ء-ي]/g, ''))) }; };
  const spec = A.createSpeculator({ lang: 'en', translate: echo });
  spec.feed(src3 + '\n\n');
  const e = spec.take(src3);
  if (e && e.promise) await e.promise;
  // the second paragraph carries the same glossary term (t74.mjs line 44; the sentence of side/t129-after.json carries none)
  await A.translateAnswer(src3 + '\n\n' + 'بني الإسلام على خمس', { lang: 'en', translate: echo, spec, budgetMs: 20000 });
  const glossed = prompts.filter((u) => /^الإسلام =>/m.test(u)).length;
  const already = prompts.filter((u) => /ALREADY_EXPLAINED:.*الإسلام/.test(u)).length;
  ok('«الإسلام» is explained once across the speculator and the final translation', glossed === 1 && already >= 1, JSON.stringify({ glossed, already, n: prompts.length }));

  console.log('-- 3. a translation far longer than its source');
  let calls = 0;
  const wordy = async ({ user }) => {
    const arr = JSON.parse(String(user).split('INPUT:\n')[1]); calls += 1;
    const concise = /CONCISION NOTE/.test(String(user));
    return { ok: true, text: JSON.stringify(arr.map((s) => (calls === 1 && !concise ? 'EN ' + 'very long words '.repeat(30) : 'EN short'))) };
  };
  const t3 = await A.translateAnswer(B, { lang: 'en', translate: wordy, budgetMs: 20000 });
  ok('asked again, and the short translation is what is delivered', calls >= 2 && t3.text.includes('EN short') && !t3.text.includes('very long words'), ascii(JSON.stringify({ calls, t: t3.text })));
  ok('...the retry carries the note to be concise', A.LENGTH_FACTOR === 2.2);

  console.log('-- 4. two references of one book');
  const notes = A.dropRepeatedNotes('He narrated it (al-Bukhari: 52) and again (al-Bukhari: 52) and (al-Bukhari: 60).', new Set());
  ok('«(al-Bukhari: 52)» and «(al-Bukhari: 60)» both kept, the repeat of 52 dropped', notes === 'He narrated it (al-Bukhari: 52) and again and (al-Bukhari: 60).', notes);
  ok('a definition is still one per label («Salat: …»)', A.dropRepeatedNotes('Salat (Salat: a prayer) and salat (Salat: worship).', new Set()) === 'Salat (Salat: a prayer) and salat.');
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-h3: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
