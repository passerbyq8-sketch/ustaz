// guards/brain-line-h2-guard.cjs -- ITEM H2 (74, m0) -- 2026-10-15 brain-line
//
// THE VERSE, THE SHORT HADITH AND THE LOST CARDS. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t74.md, tools/t74.mjs):
// a quoted whole verse stayed in the paragraph with its translation in parentheses; a verse card named by its surah
// («البقرة») got no translation; a self-closing <verse …/> swallowed the prose up to the next </verse>; «بني الإسلام على خمس»
// found no hadith (fewer than five words); and a unit whose translation lost a sacred item was accepted as it came.
//
// What this guard holds (the order, H2):
//   (1)+(2) a «…» that matches the mushaf is cut out even at two words, and one that is a whole verse is lifted to a card;
//   (3) <verse surah="البقرة" ayah="255"> carries the published translation;
//   (4) <verse …/> swallows nothing, on the server and in the client (app.jsx's tag pattern, app.js rebuilt);
//   (5) «بني الإسلام على خمس» (and «الدين النصيحة», «إنما الأعمال بالنيات») finds its hadith: card and translation;
//   (6) a unit whose translation comes back short of a sacred item is translated again once, then accepted.
// Arabic copied from side-brain-line-2026-10-15/tools/t74.mjs (lines 23, 31-33, 44); the two-word case is COMPOSED from words of
// line 24 («الله الصمد», 112:2 in part) because the order names it and no saved file holds one.
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
  const A = await esm('lib/lang/answer.js');
  const P = await esm('lib/lang/published.js');
  const calls = [];
  const echo = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); calls.push(arr); return { ok: true, text: JSON.stringify(arr.map((s) => 'EN ' + s.replace(/[ء-ي]/g, ''))) }; };
  const tr = async (ar, translate = echo) => (await A.translateAnswer(ar, { lang: 'en', translate, budgetMs: 20000 }));

  console.log('-- 1/2. the quoted verse');
  const four = (await tr('وقد قال تعالى «قل هو الله أحد» في السورة.')).text;
  ok('«قل هو الله أحد» (a whole verse, 112:1) is lifted out of the paragraph to a verse card', /<verse\b[^>]*surah_num="112"[^>]*ayah="1"/.test(four) && /<verse\b[^>]* tr="/.test(four), ascii(four));
  ok('...and the paragraph no longer carries it with a translation in parentheses', !/«قل هو الله أحد» \(/.test(four), ascii(four));
  calls.length = 0;
  const two = await tr('وقد قال تعالى «الله الصمد» في السورة.');   // COMPOSED (see the header)
  ok('a two-word quotation of the mushaf («الله الصمد») is cut out: the model never receives it', calls.flat().every((s) => !s.includes('الله الصمد')) && two.text.includes('الله الصمد'), ascii(JSON.stringify(calls)));

  console.log('-- 3. a verse card named by its surah');
  const named = (await tr('<verse surah="البقرة" ayah="255"></verse>\n\nوهذه آية الكرسي.')).text;
  ok('<verse surah="البقرة" ayah="255"> carries the published translation', / tr="/.test((named.match(/<verse\b[^>]*>/) || [''])[0]), ascii(named));

  console.log('-- 4. the self-closing tag');
  const selfc = (await tr('<verse surah_num="2" ayah="255"/>\n\nهذه فقرة تأتي بعد الآية وتشرحها.\n\n<verse surah_num="1" ayah="1"></verse>')).text;
  ok('the server: the prose after <verse …/> is translated (nothing swallowed) and both cards stand', /EN/.test(selfc.split('<verse surah_num="1"')[0] || '') && (selfc.match(/<verse\b/g) || []).length === 2, ascii(selfc));
  const parts = A.splitAnswer('<hadith/>نص<hadith attr="x"/>');
  ok('...splitAnswer reads <hadith …/> as a tag of its own', parts.filter((p) => p.type === 'tag' && p.name === 'hadith').length === 2);
  const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const built = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
  ok('the client: its tag pattern reads the self-closing <verse …/> and <hadith …/> (app.jsx), and app.js is rebuilt from it',
    app.includes("const tagPattern = new RegExp(`<(verse|hadith)\\\\b([^>]*?)\\\\s*\\\\/>|<(${KNOWN_TAGS})([^>]*)>([\\\\s\\\\S]*?)</\\\\3>`, 'g');")
    && built.includes('verse|hadith') && /tagName = match\[1\] \|\| match\[3\]/.test(app));

  console.log('-- 5. the short famous matn');
  for (const q of ['بني الإسلام على خمس', 'الدين النصيحة', 'إنما الأعمال بالنيات']) {
    const h = P.findHadith('en', q);
    ok('findHadith(en, ' + ascii(q) + ') finds the hadith', !!h && !!h.text, JSON.stringify(h && h.id));
  }
  ok('a phrase buried inside a long hadith is still not that hadith (the Throne Verse words)', P.findHadith('en', 'الله لا إله إلا هو الحي القيوم') === null);
  const card = (await tr('<hadith>بني الإسلام على خمس</hadith>')).text;
  ok('<hadith>بني الإسلام على خمس</hadith>: card and translation', / tr="/.test(card), ascii(card));

  console.log('-- 6. a unit short of a sacred item');
  let n = 0;
  const lossy = async ({ user }) => {
    const arr = JSON.parse(user.split('INPUT:\n')[1]); n += 1;
    // the first answer drops the <hadith> card a unit carries; every later one keeps it
    return { ok: true, text: JSON.stringify(arr.map((s) => (n === 1 ? s.replace(/<hadith[\s\S]*?<\/hadith>/g, '') : s).replace(/[ء-ي]/g, '').replace(/^/, 'EN '))) };
  };
  const BOARD = '<board>شرح: <hadith>بني الإسلام على خمس</hadith> هذا هو الحديث.</board>';
  const out6 = await tr(BOARD, lossy);
  ok('the unit is translated again (more than one call) and the card is in what is accepted', n >= 2 && /<hadith\b/.test(out6.text), ascii(JSON.stringify({ n, t: out6.text })));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-h2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
