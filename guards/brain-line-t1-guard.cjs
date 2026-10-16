// guards/brain-line-t1-guard.cjs -- ITEM T1 (141) -- 2026-10-15 brain-line
//
// THE FATWA TEXT AT SERVICE. Measured on 7ba44481 (side-brain-line-2026-10-15/side/141-inventory.md; measure-once-2026-10-05/
// side/m20-fatwa-symbols.md): stored fatwa texts carry private-use symbols of the sites' «arabisque» font in place of ﷺ and the
// other formulas (4,970 of 74,769 texts), presentation forms (FB50-FEFF) for whole words, bidi controls and zero-width marks, and
// empty «[]»; the service sent them as they were.
//
// The measuring step (session tools/t1-fonts.mjs, GET only; side/t1-fonts.md): al-Khathlan and al-Barrak serve one font, «AGA
// Arabesque» (17,360 bytes), whose post table names each private-use glyph. Only the names that state their text enter the
// map; the others (handhalt F049, radiya1 F074, radiya2 F079, jalla, akbar, sadaka, f20, f21, b1-b16) go to the owner.
//
// What this guard holds (the order, T1): a text with presentation forms, controls, «[]» and a proven symbol -> the service's
// text is clean; a symbol not proven -> kept as it is, and counted; the record, the excerpt and the proxy all pass the one rule.
// Arabic copied from side/141-inventory.md lines 14, 28 and m20-fatwa-symbols.md section 4 (rows 1, 2).
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
  let T = null;
  try { T = await esm('lib/fatwa-text.js'); } catch { T = null; }
  ok('lib/fatwa-text.js: the proven map is exactly the fonts\' named glyphs', !!T && JSON.stringify(Object.keys(T.FATWA_PUA_PROVEN || {}).map(Number).sort((a, b) => a - b)) === JSON.stringify([0xF050, 0xF051, 0xF055, 0xF065, 0xF072, 0xF075])
    && T.FATWA_PUA_PROVEN[0xF065] === 'ﷺ' && T.FATWA_PUA_PROVEN[0xF075] === 'عليه السلام' && T.FATWA_PUA_PROVEN[0xF055] === 'عزّ وجلّ');
  const clean = T ? T.cleanFatwaText : (t) => t;
  // the inventory's own samples (U+F065 after «النبي», m20 row 1; presentation forms, inventory line 28; RLM after «أثاما،»)
  const PROVEN = 'أول الثمر جاءوا به إلى النبي ، فإذا أ';
  const FORMS = 'يضاعف ﻟﻪ ﺍﻟﻌﺫﺍﺏ يوم ﺍﻟﻘﻴﺎمة';
  const CTRL = 'لك يلق أثاما،‏ يضاعف';
  const EMPTY = 'هذا كلام [] و ( ) هنا';
  const stats = {};
  const out = clean([PROVEN, FORMS, CTRL, EMPTY].join('\n'), stats);
  ok('a proven symbol becomes its text (ﷺ after «النبي»)', out.includes('النبي ﷺ،'), ascii(out));
  ok('presentation forms (FB50-FEFF) are their letters (NFKC)', !/[ﭐ-﷿ﹰ-﻿]/u.test(out.replace(/ﷺ/gu, '')) && out.includes('يضاعف له العذاب يوم القيامة'), ascii(out));
  ok('bidi controls and zero-width marks are gone', !/[​-‏‪-‮⁦-⁩⁠﻿]/u.test(out), ascii(out));
  ok('empty «[]» and «()» are gone', !/\[\s*\]|\(\s*\)/u.test(out), ascii(out));
  const UNPROVEN = 'فقد جاء في حديث أبي قتادة  أن النب';
  const s2 = {};
  const out2 = clean(UNPROVEN, s2);
  ok('a symbol not proven (F074, radiya1) is kept as it is, and counted', out2.includes('') && s2.puaKept === 1 && !s2.puaMapped, ascii(JSON.stringify({ out2, s2 })));
  ok('...and a proven one is counted as mapped', stats.puaMapped === 1);

  console.log('-- the one rule at every door');
  const FF = await esm('lib/full-fatwa.js');
  const rec = FF.buildFatwaRecord({ id: 'x', title: 'عنوان', question: FORMS, answer: PROVEN + '\n' + CTRL + '\n' + EMPTY, url: 'https://sh-albarrak.com/fatwas/24842', sourceKind: 'corpus' });
  ok('buildFatwaRecord: question and answer pass it', rec.answer.includes('النبي ﷺ،') && rec.question.includes('له العذاب') && !/[‏]/u.test(rec.answer), ascii(rec.answer));
  const src = require('fs').readFileSync(path.join(REPO, 'lib/fatwa-service.js'), 'utf8');
  ok('fatwa-service: the excerpt and the passage pass the same rule as the full text', /cleanFatwaText\(/.test(src) && /passage: \[question \? `السؤال المنشور: \$\{question\}` : '', `النص المنشور: \$\{answer\}`\]/.test(src) && /const answer = cleanFatwaText\(/.test(src));
  const PROXY = await esm('api/fatwa-proxy.js');
  const CONTRACT = await esm('lib/fatwa-contract.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ url: CONTRACT.FATWA_BASE + '/api/v1/fatwas/albarrak/1', headers: { get: (k) => (/type/i.test(k) ? 'application/json' : null) }, status: 200,
    arrayBuffer: async () => Buffer.from(JSON.stringify({ ok: true, fatwa: { content: { answer: PROVEN + ' ' + UNPROVEN, question: FORMS } } }), 'utf8') });
  let sent = null;
  const res = { headers: {}, status(c) { this.code = c; return this; }, setHeader(k, v) { this.headers[k] = v; }, send(b) { sent = Buffer.from(b).toString('utf8'); return this; }, json(o) { sent = JSON.stringify(o); return this; }, end() { return this; } };
  try { await PROXY.default({ method: 'GET', headers: {}, query: { path: 'fatwas/albarrak/1' } }, res); } finally { globalThis.fetch = realFetch; }
  ok('api/fatwa-proxy.js: what reaches the reader is clean, a symbol not proven kept', !!sent && sent.includes('النبي ﷺ،') && sent.includes('له العذاب') && JSON.parse(sent).fatwa.content.answer.includes(''), ascii(sent));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-t1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
