// guards/brain-line-d4-guard.cjs -- ITEM D4 (147, temporary number) -- 2026-10-15 brain-line
//
// THE GRADE OF THE TWO SAHIHS. Measured on 7ba44481 (side-brain-line-2026-10-15/items/129.md row 2, witness/129.md):
// Abu Ayyub's hadith «من صام رمضان وأتبعه ستا من شوال كان كصيام الدهر» (Muslim 1164) left as «(النسائي · لم يوقف على حكم)»
// in all three modes, and as «(ابن ماجه · لم يوقف على حكم)» in one and «(ابن ماجه · صحيح)» in another: Muslim's atom is
// cut at the service's ceiling, so it no longer carries the matn letter for letter, and the matn falls to a lower book.
//
// What this guard holds (the order, D4):
//   (1) when no Sahih is confirmed and a lower book is, the narrowed Sahih request reads a Sahih atom with a wider
//       tolerance (half the matn's words, or its first four words) before any «لم يوقف»;
//   (2) no NO_RULING for such a matn: «(مسلم …)» is written, the lower collector after it;
//   (3) a takhrij memory per matn (folded, 24 h; in memory, and in Upstash tk:v1: when present): the same matn asked
//       twice gets one parenthetical, and the second ask makes no library call.
// The library is a fake lookup: Muslim's atom cut at 2000 characters (FC-000648), al-Nasa'i's whole (FC-000674).
//
// Fixtures: the matn of WP01:53 verbatim (witness/129.md:6, 01.md:53); the frame and both atoms are COMPOSED.
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

// witness/129.md:6 (01.md:53)
const MATN = 'من صام رمضان وأتبعه ستا من شوال كان كصيام الدهر';
const ANSWER = 'قال رسول الله ﷺ: «' + MATN + '».';
const MUSLIM = 'FC-000648';
const NASAI = 'FC-000674';
const filler = 'حدثنا يحيى بن أيوب وقتيبة بن سعيد وعلي بن حجر جميعا عن إسماعيل قال ابن أيوب حدثنا إسماعيل بن جعفر أخبرني سعد بن سعيد بن قيس عن عمر بن ثابت بن الحارث الخزرجي عن أبي أيوب الأنصاري رضي الله عنه ';
const MUSLIM_CUT = (filler.repeat(12) + 'أنه حدثه أن رسول الله صلى الله عليه وسلم قال: من صام رمضان ثم أتبعه ستا من').slice(-2000);
const NASAI_WHOLE = 'أخبرنا هشام بن عمار عن أبي أيوب عن النبي صلى الله عليه وسلم قال: من صام رمضان وأتبعه ستا من شوال كان كصيام الدهر';

(async () => {
  const TK = await esm('lib/takhrij.js');
  let calls = 0;
  const lookup = async (matns, options = {}) => {
    calls += 1;
    const ids = (options && options.bookIds) || [];
    return matns.map((matn) => {
      if (ids.length === 1 && ids[0] === MUSLIM) return { matn, subjectIds: [MUSLIM], atoms: [MUSLIM_CUT] };
      if (ids.length === 1) return { matn, subjectIds: [], atoms: [] };
      return { matn, subjectIds: [MUSLIM, NASAI], atoms: [MUSLIM_CUT, NASAI_WHOLE] };
    });
  };
  const memo = typeof TK.createTakhrijMemo === 'function' ? TK.createTakhrijMemo() : undefined;
  const first = await TK.applyTakhrij(ANSWER, { env: { TAKHRIJ_V1: 'on' }, lookup, memo });
  const callsFirst = calls;
  console.log('-- 1. the cut Muslim atom still confirms Muslim');
  ok('the parenthetical names Muslim', /\(مسلم/u.test(first.text), JSON.stringify(first.text));
  ok('...and never «لم يوقف على حكم»', !first.text.includes('لم يوقف على حكم'), JSON.stringify(first.text));
  ok('...and al-Nasa\'i is written after Muslim', /\(مسلم[^)]*النسائي[^)]*\)/u.test(first.text), JSON.stringify(first.text));
  console.log('-- 2. one parenthetical for one matn in a day');
  const second = await TK.applyTakhrij(ANSWER, { env: { TAKHRIJ_V1: 'on' }, lookup, memo });
  ok('the second ask gives the same text', second.text === first.text, JSON.stringify([first.text, second.text]));
  ok('...and makes no library call (the memory answered)', calls === callsFirst, String(calls - callsFirst));
  ok('the memory key is the folded matn, kept 24 h', typeof TK.TAKHRIJ_MEMO_TTL_SECONDS === 'number' && TK.TAKHRIJ_MEMO_TTL_SECONDS === 86400
    && typeof TK.takhrijMemoKey === 'function' && TK.takhrijMemoKey(MATN) === TK.takhrijMemoKey('مَن صامَ رمضانَ وأتبعَه ستًّا من شوّال كان كصيامِ الدهر'));
  console.log('-- 3. both modes are handed the server memory');
  {
    const fs = require('fs');
    const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    const bw = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
    const mem = fs.readFileSync(path.join(REPO, 'lib/takhrij-memo.js'), 'utf8');
    ok('the free brain\'s pass gets lib/takhrij-memo.js', /memo: \(await import\('\.\.\/lib\/takhrij-memo\.js'\)\)\.takhrijMemo,/.test(ask));
    ok('before writing\'s pass gets it too', /memo: takhrijMemo,/.test(bw) && /import \{ takhrijMemo \} from '\.\/takhrij-memo\.js';/.test(bw));
    ok('the server memory keeps tk:v1: keys in Upstash for a day', /redisSetex\(k, TAKHRIJ_MEMO_TTL_SECONDS,/.test(mem));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-d4: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
