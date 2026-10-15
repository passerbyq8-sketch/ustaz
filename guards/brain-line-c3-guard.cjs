// guards/brain-line-c3-guard.cjs -- ITEM C3 (axis row 5; the owner's decision (a)) -- 2026-10-15 brain-line
//
// THE FREE BRAIN DELIVERED AN UNSOURCED RULING ON PURPOSE. lib/free-brain/instructions.js:328-331 recorded the
// earlier decision «withholding a ruling the reader asked for is a worse outcome than delivering it unsourced and
// marked as such»; the owner reversed it on 15 October: «الشرعي ممنوع يجيب بدون مصدر، ومستحيل في جواب شرعي ماله مصدر
// حتى لو اقتبس منه جزء».
//
// What this guard holds:
//   (1) the instruction comment carries the owner's words, not the reversed decision;
//   (2) after the citation retry, every sentence that states a ruling in a non-general answer with no [[n]] of a
//       cited row is removed; when no sourced ruling is left, the turn is marked notCovered and api/ask.js
//       appends the one server-owned sentence (BW2_NOT_COVERED) and sends the search offer (ezik_live_offer);
//   (3) a sourced ruling stays as it is, and a general answer is not touched.
// The provider's output is a fixed string (no model): withoutUnsourcedRulings is driven directly, and the
// wiring is read from the source at its two seats.
//
// Fixtures: COMPOSED (no saved free-brain draft carries [[n]] markers -- they are stripped before release).
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

const RULING_A = 'صيام يوم عرفة مستحب لغير الحاج.';
const RULING_B = 'ويحرم صوم يوم العيد.';
const ADAB = 'ومن حسن الخلق أن تبدأ أخاك بالسلام.';

(async () => {
  const LOOP = await esm('lib/free-brain/loop.js');
  const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

  console.log('-- 1. the instruction carries the owner\'s words');
  {
    const src = read('lib/free-brain/instructions.js');
    ok('the reversed decision is gone', !src.includes('worse outcome than delivering it unsourced'));
    ok('the owner\'s rule of 15 October is there', src.includes('الشرعي ممنوع يجيب بدون مصدر'));
  }

  console.log('-- 2. withoutUnsourcedRulings');
  const f = LOOP.withoutUnsourcedRulings;
  ok('lib/free-brain/loop.js exports withoutUnsourcedRulings', typeof f === 'function');
  if (typeof f === 'function') {
    const two = f(RULING_A + ' ' + RULING_B + '\n' + ADAB, []);
    ok('two uncited rulings are removed', two.removed === 2 && !two.text.includes('مستحب') && !two.text.includes('يحرم'), JSON.stringify(two));
    ok('the adab sentence stays', two.text.includes('بالسلام'), JSON.stringify(two));
    ok('no sourced ruling is left -> notCovered', two.notCovered === true, JSON.stringify(two));
    const cited = f(RULING_A.replace(/\.$/u, ' [[1]].') + ' ' + RULING_B, [1]);
    ok('a cited ruling stays with its marker; the uncited one goes', cited.text.includes('مستحب') && cited.text.includes('[[1]]') && !cited.text.includes('يحرم') && cited.notCovered === false, JSON.stringify(cited));
    const wrongRef = f(RULING_A.replace(/\.$/u, ' [[2]].'), [1]);
    ok('a marker of a row that was not cited does not source it', wrongRef.removed === 1 && wrongRef.notCovered === true, JSON.stringify(wrongRef));
    const none = f(ADAB, []);
    ok('an answer with no ruling at all is untouched', none.text === ADAB && none.removed === 0 && none.notCovered === false, JSON.stringify(none));
  }

  console.log('-- 3. the wiring');
  {
    const loop = read('lib/free-brain/loop.js');
    ok('the loop runs it after the citation retry, for a non-general domain, before the review',
      /if \(domain !== 'general' && !streamedThisTurn\) \{\s*const sourcing = withoutUnsourcedRulings\(answer, citedRefs\);/.test(loop)
      && loop.indexOf('withoutUnsourcedRulings(answer, citedRefs)') < loop.indexOf('let proposedRows = citedRefs.map'));
    const ask = read('api/ask.js');
    ok('api/ask.js appends BW2_NOT_COVERED and sends the search offer for a notCovered free-brain turn',
      /if \(out\.notCovered === true && !out\.streamedThisTurn\) \{[\s\S]{0,400}BW2_NOT_COVERED[\s\S]{0,300}ezik_live_offer/.test(ask));
  }

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c3: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
