// guards/brain-line-r2-8-guard.cjs -- ITEM r2-8 (the owner's decision c, 17 October) -- 2026-10-17 brain-line R2
//
// THE INLINE PARENTHESIS OF A VERSE QUOTED IN PART CARRIES NO FOOTNOTES. Measured on the preview of fa778c0e (sessions/
// side-brain-fix-2026-10-15/EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt line 328, G1, Urdu «خودکشی کا کیا حکم ہے؟»): the
// fragment «ولا تقتلوا أنفسكم إن الله كان بكم رحيما» inside Ibn Baz's fatwa was followed by a parenthesis carrying the whole
// verse's translation with its marks «[1]» «[2]» «[3]», the attribution «ترجمۂ قرآن 4:29 (پوری آیت): … QuranEnc.com …», and
// then «شائع شدہ حواشی: [1] … [2] … [3] …» -- three published footnotes in the middle of the prose. The owner: the whole
// verse stays; the footnotes do not enter the parenthesis.
//
// What this guard holds (the R2 order, item 8), on the real translateAnswer and the real Urdu QuranEnc snapshot:
//   (1) the inline parenthesis for 4:29: the whole verse, no «[n]» mark, no «شائع شدہ حواشی», the attribution line kept;
//   (2) the verse card (4:30) keeps tr= and trn= exactly as published -- the card is unchanged, the snapshot untouched.
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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 500);
const unb64 = (s) => Buffer.from(String(s || ''), 'base64').toString('utf8');

(async () => {
  const A = await esm('lib/lang/answer.js');
  const P = await esm('lib/lang/published.js');
  const v29 = P.quranTranslation('ur', 4, 29, 29);
  const v30 = P.quranTranslation('ur', 4, 30, 30);
  ok('the Urdu snapshot has 4:29 with published footnotes and marks in its text (the measured case)', !!v29 && !!v29.footnotes && /\[\d+\]/.test(v29.text));
  // report line 328: the fragment as the fatwa quoted it; the prose around it composed
  const AR = 'قال الله عز وجل: ﴿ولا تقتلوا أنفسكم إن الله كان بكم رحيما﴾ [النساء:29].\n\n<verse surah_num="4" ayah="30">وَمَن يَفْعَلْ ذَٰلِكَ عُدْوَٰنًا وَظُلْمًا فَسَوْفَ نُصْلِيهِ نَارًا</verse>';
  const fake = async ({ user }) => ({ ok: true, text: JSON.stringify(JSON.parse(String(user).split('INPUT:\n')[1]).map((s) => s.replace(/قال الله عز وجل:/u, 'اللہ عز و جل فرماتا ہے:').replace(/\[النساء:29\]/u, '[النساء:29]'))) });
  const r = await A.translateAnswer(AR, { lang: 'ur', translate: fake, budgetMs: 60000 });
  const prose = r.text.split("<verse")[0];
  const open = prose.indexOf('(“');
  const paren = open >= 0 ? prose.slice(open, prose.lastIndexOf(')') + 1) : '';
  console.log('-- 1. the inline parenthesis');
  ok('the fragment carries its parenthesis with the whole verse (pending the marks)', !!paren && !!v29 && paren.includes(v29.text.replace(/\s*\[\d+\]/g, '').slice(0, 30)), ascii(paren.slice(0, 200)));
  ok('no footnote mark [n] inside it', !!paren && !/\[\d+\]/.test(paren), ascii(paren));
  ok('no published footnotes inside it (the label nor their text)', !!paren && !paren.includes('شائع شدہ حواشی') && !!v29 && !paren.includes(v29.footnotes.slice(0, 20)), ascii(paren.slice(-200)));
  ok('the attribution line stays (QuranEnc, 4:29)', !!paren && paren.includes('QuranEnc') && paren.includes('4:29'), ascii(paren.slice(-160)));
  console.log('-- 2. the card');
  const card = /<verse([^>]*)>/.exec(r.text);
  const tr = card && (/ tr="([^"]+)"/.exec(card[1]) || [])[1];
  const trn = card && (/ trn="([^"]+)"/.exec(card[1]) || [])[1];
  ok('the 4:30 card keeps its published translation and footnotes (tr, trn) exactly', !!v30 && unb64(tr) === v30.text && (!v30.footnotes || unb64(trn) === v30.footnotes), ascii(card && card[1]));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-8: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
