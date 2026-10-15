// guards/brain-line-c2-guard.cjs -- ITEM C2 (axis rows 4 and 7) -- 2026-10-15 brain-line
//
// BEFORE WRITING STREAMED RULINGS AND MATNS WITH NO SOURCE. Measured on 7ba44481
// (side-brain-line-2026-10-15/side/axis-bw2.md, cases 4a-1..4a-4, 4c-1): with zero rows «وقد جاء في الحديث
// أن الصيام جنة…» and «المصدر: الموسوعة الفقهية الكويتية.» were released; «قال النبي ﷺ: من صام الدهر فلا
// صام ولا أفطر [[1]]» on a row about voluntary fasting that does not carry it was released with a card and
// the encyclopedia tail; and the three zero-row units together went out (130 chars, substantive 0) with the
// not-covered sentence appended under a ruling.
//
// What this guard holds (the order, C2 (2) and (3)):
//   (2) a unit with a Prophetic frame («قال النبي/رسول الله», «كان النبي», «جاء/ورد/ثبت/صحّ في الحديث», «في
//       الحديث الصحيح») is held unless a cited row carries the words it ascribes, by the same carry test the
//       quoted matn uses (rowCarriesMatn). The hold reason is unsupported_matn (see the report, §8: the name
//       unverified_prophetic would add a telemetry field the text guard's closed list does not hold).
//       A model-written «المصدر: …» unit with no cited row is held as an uncited attribution.
//   (3) the not-covered sentence is never appended under released text that states a ruling.
//   (1) BW2_HOLD_UNCITED_RULINGS is ON in code (only an explicit «off» turns it down), so «حكم صيام يوم عرفة
//       لغير الحاج أنه مستحب.» with zero rows is held under the default env (section 0). guards/speed-bw2-guard.cjs
//       R4e, which pinned the old default, is re-targeted by the owner's rule-12 amendment in the session.
//
// Fixtures: the writer streams are axis-bw2.mjs CASES 4a-2, 4a-3, 4a-4, 4c-1, 4c-2 verbatim
// (sessions/side-brain-line-2026-10-15/tools/axis-bw2.mjs:25-30) and its row ENC_PLAIN (:17-18); the
// carrying row is COMPOSED from the 4c matn.
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

// axis-bw2.mjs:17-18
const ENC_PLAIN = { ref: 1, kind: 'encyclopedia', publisher: 'الموسوعة الفقهية الكويتية', part: 28, recordId: 'F-saum',
  title: 'صوم التطوع', text: 'صوم التطوع: يستحب صيام أيام من السنة، ومن ذلك صيام الاثنين والخميس وصيام أيام البيض.' };
// COMPOSED: a row that carries the 4c matn
const ROW_CARRIES = { ref: 1, kind: 'fatwa', publisher: 'ابن باز', scholarId: 'binbaz', recordId: 'c2-carry', url: 'https://binbaz.org.sa/fatwas/c2',
  title: 'صيام الدهر', text: 'صيام الدهر منهي عنه، لقول النبي صلى الله عليه وسلم: من صام الدهر فلا صام ولا أفطر. رواه مسلم.' };
const cards = { max: 3, encyclopediaCards: true, buildBookTag: (b) => ({ tag: '<book title="' + b.bookTitle + '"></book>' }), buildSourceTag: (r) => ({ tag: '<source url="' + r.url + '"></source>' }) };

(async () => {
  const U = await esm('lib/bw2-units.js');
  const BW = await esm('lib/before-writing-v2.js');
  const run = async (rows, stream) => {
    const sent = [];
    const rel = U.createBw2Releaser({ rows, mode: 'brief', emit: (p) => { sent.push(p); return true; }, cards, notCoveredSentence: BW.BW2_NOT_COVERED || '' });
    rel.push(stream);
    const sum = await rel.end();
    return { text: String(sum.text || ''), holds: sum.holds || {}, substantive: sum.substantive };
  };

  console.log('-- 1. zero rows: nothing Prophetic and no source line goes out');
  {
    const r = await run([], 'وقد جاء في الحديث أن الصيام جنة يستجن بها العبد من النار.'); // axis-bw2.mjs:25
    ok('«وقد جاء في الحديث أن…» with zero rows is held', !r.text.includes('الصيام جنة'), JSON.stringify(r));
    const s = await run([], 'المصدر: الموسوعة الفقهية الكويتية.'); // axis-bw2.mjs:26
    ok('«المصدر: الموسوعة…» with zero rows is held', !s.text.includes('المصدر'), JSON.stringify(s));
    const all = await run([], 'حكم صيام يوم عرفة لغير الحاج أنه مستحب. وقد جاء في الحديث أن صيامه يكفر السنة الماضية والباقية. المصدر: الموسوعة الفقهية الكويتية.'); // :27
    ok('the three together: neither the hadith frame nor the source line goes out', !all.text.includes('جاء في الحديث') && !all.text.includes('المصدر'), JSON.stringify(all));
  }

  console.log('-- 0. the uncited-ruling hold is on in code');
  {
    const FL = await esm('lib/free-brain/flag.js');
    ok('BW2_HOLD_UNCITED_RULINGS_DEFAULT is true', FL.BW2_HOLD_UNCITED_RULINGS_DEFAULT === true);
    ok('unset -> on', FL.bw2HoldUncitedRulingsDecision({}).enabled === true);
    ok('an explicit off -> off (and false, 0)', ['off', 'false', '0'].every((v) => FL.bw2HoldUncitedRulingsDecision({ BW2_HOLD_UNCITED_RULINGS: v }).enabled === false));
    const sent = [];
    const rel = U.createBw2Releaser({ rows: [], mode: 'brief', emit: (p) => { sent.push(p); return true; }, cards, notCoveredSentence: BW.BW2_NOT_COVERED || '',
      holdUncitedRulings: FL.bw2HoldUncitedRulingsDecision({}).enabled });
    rel.push('حكم صيام يوم عرفة لغير الحاج أنه مستحب.'); // axis-bw2.mjs:23
    const sum = await rel.end();
    ok('«حكم صيام يوم عرفة لغير الحاج أنه مستحب.» with zero rows is held under the default', !String(sum.text || '').includes('مستحب'), JSON.stringify(sum.holds));
  }

  console.log('-- 2. an unquoted matn on a row that does not carry it is held; on a row that does, released');
  {
    const r = await run([ENC_PLAIN], 'قال النبي ﷺ: من صام الدهر فلا صام ولا أفطر [[1]]'); // axis-bw2.mjs:29
    ok('4c-1 (unquoted, unrelated row) is held', !r.text.includes('من صام الدهر'), JSON.stringify(r));
    const q = await run([ENC_PLAIN], 'قال النبي ﷺ: «من صام الدهر فلا صام ولا أفطر» [[1]]'); // axis-bw2.mjs:30
    ok('4c-2 (quoted, unrelated row) stays held', !q.text.includes('من صام الدهر'), JSON.stringify(q));
    const c = await run([ROW_CARRIES], 'قال النبي ﷺ: من صام الدهر فلا صام ولا أفطر [[1]]');
    ok('the same unquoted unit on a row that carries it is released', c.text.includes('من صام الدهر'), JSON.stringify(c));
    const cq = await run([ROW_CARRIES], 'قال النبي ﷺ: «من صام الدهر فلا صام ولا أفطر» [[1]]');
    ok('and quoted on the carrying row is released', cq.text.includes('من صام الدهر'), JSON.stringify(cq));
    const d = await run([ENC_PLAIN], 'وقد جاء في الحديث أن الصيام جنة [[1]]'); // axis-bw2.mjs:32
    ok('4d-1 «جاء في الحديث» cited to a row that does not carry it is held', !d.text.includes('الصيام جنة'), JSON.stringify(d));
  }

  console.log('-- 3. the not-covered sentence never stands under a released ruling');
  {
    ok('before-writing-v2 exports notCoveredMayFollow', typeof BW.notCoveredMayFollow === 'function');
    const may = typeof BW.notCoveredMayFollow === 'function' ? BW.notCoveredMayFollow : () => true;
    ok('under «حكم صيام يوم عرفة لغير الحاج أنه مستحب.» it may not follow', may('حكم صيام يوم عرفة لغير الحاج أنه مستحب.') === false);
    ok('under nothing it may follow', may('') === true);
    ok('under a sentence that states no ruling it may follow', may('هذا سؤال مهم.') === true);
  }

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
