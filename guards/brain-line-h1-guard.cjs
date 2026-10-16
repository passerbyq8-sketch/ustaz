// guards/brain-line-h1-guard.cjs -- ITEM H1 (74, m0) -- 2026-10-15 brain-line
//
// THE FATWA'S ARABIC TEXT UNDER AN ATTRIBUTED HEADING. Measured on 7ba44481 (side-brain-line-2026-10-15/items/74-m0.md,
// tools/t74.mjs): lib/lang/answer.js FATWA_HEAD read only the bare «## نص الفتوى», so under the heading lib/hybrid-deen.js
// writes when an answer shows two fatwas or more («## نص الفتوى — ابن باز: حكم كذا», hybrid-deen.js:1236-1237) the
// scholar's text was translated as prose and its Arabic was lost -- in English and in Urdu alike.
//
// What this guard holds (the order, H1): both headings (bare and attributed) x (en, ur, fr, fa, id) -> the Arabic block is
// kept byte for byte and the card carries its translation (`tb`); the attributed heading's words after the dash travel to
// the card as they are (`tba`).
// The Arabic is copied from side-brain-line-2026-10-15/tools/t74.mjs lines 14-16 (the intro, the two headings, the body).
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
const b64d = (s) => Buffer.from(String(s || ''), 'base64').toString('utf8');

(async () => {
  const A = await esm('lib/lang/answer.js');
  // the stub translator of guards/lang-guard.cjs and t74.mjs: Arabic letters stripped, «EN» in front -- no model
  const echo = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); return { ok: true, text: JSON.stringify(arr.map((s) => 'EN ' + s.replace(/[ء-ي]/g, ''))) }; };
  const BODY = 'السؤال: ما حكم كذا؟\nالجواب: الحمد لله، هذا حكم الفتوى بنصها العربي كما هو.';
  const ATTR = 'ابن باز: حكم كذا';
  const CARD = '<source url="https://binbaz.org.sa/fatwas/1">حكم كذا</source>';
  for (const [k, head] of [['bare', '## نص الفتوى'], ['attributed', '## نص الفتوى — ' + ATTR]]) {
    for (const lang of ['en', 'ur', 'fr', 'fa', 'id']) {
      const ar = 'تمهيد قصير للجواب.\n\n' + head + '\n' + BODY + '\n\n' + CARD;
      const out = (await A.translateAnswer(ar, { lang, translate: echo, budgetMs: 20000 })).text;
      const card = (out.match(/<source\b[^>]*>/) || [''])[0];
      ok(k + ' heading, ' + lang + ': the Arabic block kept byte for byte', out.includes(BODY), ascii(out));
      ok(k + ' heading, ' + lang + ': the card carries the translation (tb)', / tb="/.test(card), ascii(card));
      if (k === 'attributed') ok(k + ' heading, ' + lang + ': the words after the dash travel to the card as they are (tba)', b64d((card.match(/ tba="([^"]*)"/) || [])[1]) === ATTR, ascii(card));
    }
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-h1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
