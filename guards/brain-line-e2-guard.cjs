// guards/brain-line-e2-guard.cjs -- ITEM E2 (notes: the name in the prompt; the owner's decision (e)) -- 2026-10-15 brain-line
//
// THE READER'S NAME. Measured on 7ba44481 (side-brain-line-2026-10-15/items/notes.md): `${name}` in ten places of
// lib/system-prompt.js, for every band, and line 96 allowed calling the reader by name inside the answer -- against
// lib/sync/privacy-page.js («ولا يذكر اسمَك في الجواب»).
//
// What this guard holds (the order, E2): the name stays in the opening greeting alone (the «ابدأ المحادثة» block) and
// in the first line (age, gender, and the name the greeting needs); the allowance to call the reader by name inside the
// speech is gone and the prohibition «لا تذكرِ اسمَ القارئِ في متنِ أيِّ جواب» stands in its place; the same in the
// call prompt; and the privacy page still says what is now true.
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

const NAME = 'زيدونة';  // a name no prompt word contains
(async () => {
  const SP = await esm('lib/system-prompt.js');
  for (const [label, age, gender, mode] of [['adult chat', 30, 'female', 'chat'], ['child chat', 7, 'female', 'chat'], ['teen chat', 15, 'female', 'chat'], ['adult call', 30, 'female', 'call'], ['child call', 7, 'female', 'call']]) {
    const p = SP.buildSystemPrompt(NAME, age, gender, mode);
    const lines = p.split('\n');
    const start = lines.findIndex((l) => l.includes('═══ ابدأ المحادثة ═══'));
    const outside = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => !l.includes(' وعمره ') && (start < 0 || i <= start) && l.includes(NAME));
    ok(label + ': the name stands only in the profile line (اسم من ... وعمره) and in the opening block', start > 0 && outside.length === 0, outside.map((o) => o.i + 1).join(','));
    ok(label + ': the opening block still greets by name', start > 0 && lines.slice(start).join('\n').includes('يَا ' + NAME));
    ok(label + ': the prohibition is there', p.includes('لا تذكرِ اسمَ القارئِ في متنِ أيِّ جواب'));
    ok(label + ': the allowance to call by name inside the speech is gone', !p.includes('وَلَكَ أَنْ تُنَادِيَهُ بِاسْمِهِ دَاخِلَ الكَلَامِ'));
  }
  const privacy = fs.readFileSync(path.join(REPO, 'lib/sync/privacy-page.js'), 'utf8');
  ok('the privacy page still says the name is not in the answer', privacy.includes('ولا يذكر اسمَك في الجواب') && privacy.includes('It does not put your name in the answer'));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-e2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
