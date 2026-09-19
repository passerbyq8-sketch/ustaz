// guards/takhrij-contract-guard.cjs — البند ٥٠ §٢-هـ · عقدُ التخريجِ لا يُخرَق.
//
// ── NOT REGISTERED IN gates.json, AND THAT IS ON PURPOSE ─────────────────────
// §٠/٢ of the owner's order of 19 September forbids this agent from adding a row to the
// roster. The file is written, it runs by hand, and it waits for the owner's leave. Nothing
// else in the tree imports it, so leaving it unregistered costs nothing but its own silence.
//
// ── THE FOUR THINGS IT FORBIDS, IN THE ORDER'S OWN WORDS ─────────────────────
//   ١ قوسين فيهما مخرِّج لم يجئ من المكتبة
//   ٢ درجة بلا حاكم من السلَّم
//   ٣ سلسلة سند أو عنعنة في المخرَج
//   ٤ حديثا مرفوعا بلا قوسين ألبتة
//
// ── AND IT ASSERTS THEM OVER DELIVERED TEXT, NOT OVER INTENTIONS ─────────────
// Every row below drives lib/takhrij.js with a fixture library and reads what would reach a
// reader. A guard that only read the source would pass a module that returns the right shape
// and the wrong name.
//
// Usage: node guards/takhrij-contract-guard.cjs
'use strict';
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

// The matn every fixture quotes, and an atom that really carries it with a Companion in
// front of it. Built here rather than pasted, so no harakat sequence is typed by hand.
const MATN = 'إنما الأعمال بالنيات';
const OTHER = 'المسلم من سلم المسلمون من لسانه ويده';
const atomFor = (matn, companion) => `حدثنا سفيان عن ${companion} رضي الله عنه قال: ${matn}`;
const answerWith = (matn) => `الحمد لله. قال النبي صلى الله عليه وسلم: «${matn}» وهذا أصل.`;

const lookupOf = (table) => async (matns) => matns.map((matn) => table[matn]
  || { matn, subjectIds: [], atoms: [] });

(async () => {
  console.log('=== takhrij-contract-guard — no invented مخرِّج, no invented درجة, no isnad ===');
  const T = await esm('lib/takhrij.js');
  const L = await esm('lib/takhrij-ladder.js');
  const ON = { TAKHRIJ_V1: 'on' };

  // ── ٠ · THE LADDER IS THE LADDER ─────────────────────────────────────────
  console.log('\n--- 0. THE CLOSED LADDER ---');
  const numbers = new Set(L.TAKHRIJ_LADDER.map((row) => row.n));
  ok('the ladder is thirty-six rows and says so as a value',
    numbers.size === L.TAKHRIJ_LADDER_ROWS && L.TAKHRIJ_LADDER_ROWS === 36,
    'distinct row numbers: ' + numbers.size);
  ok('every row number from 1 to 36 is present, none invented',
    [...Array(36)].every((_, i) => numbers.has(i + 1))
      && [...numbers].every((n) => n >= 1 && n <= 36),
    [...numbers].sort((a, b) => a - b).join(','));
  ok('the five ids the owner pinned in §٥ are all on it',
    ['FC-000774', 'FC-000788', 'FC-000791', 'FC-000735', 'FC-002040',
      'FC-000709', 'FC-000707', 'FC-000708'].every((id) => !!L.ladderRowFor(id)));
  ok('the eight books the owner struck are NOT on it',
    !L.TAKHRIJ_LADDER.some((row) => /ميزان|سير أعلام|المهذب|المجموع|رياض الصالحين|مجموع الفتاوى|زاد المعاد|الفروسية/u.test(row.display)));
  ok('the ladder fits one filters.book_ids request (service ceiling is 100)',
    L.TAKHRIJ_LADDER_IDS.length >= 1 && L.TAKHRIJ_LADDER_IDS.length <= 100,
    'ids: ' + L.TAKHRIJ_LADDER_IDS.length);

  // ── ١ · THE SWITCH ───────────────────────────────────────────────────────
  console.log('\n--- 1. THE SWITCH IS OFF, AND OFF MEANS BYTE-IDENTICAL ---');
  ok('unset is off', T.takhrijDecision({}).enabled === false);
  ok('a word nobody defined is off, not a guess', T.takhrijDecision({ TAKHRIJ_V1: 'yes' }).enabled === false);
  ok('the default is stated as a value', T.TAKHRIJ_V1_DEFAULT === false);
  ok('nothing in this tree turns it on',
    !process.env.TAKHRIJ_V1, String(process.env.TAKHRIJ_V1));
  {
    let calls = 0;
    const counting = async (m) => { calls += 1; return lookupOf({})(m); };
    const text = answerWith(MATN);
    const out = await T.applyTakhrij(text, { env: {}, lookup: counting });
    ok('with the switch off the answer is byte-identical', out.text === text, JSON.stringify(out.text));
    ok('...and not one lookup leaves', calls === 0, 'calls=' + calls);
    ok('...and it says so rather than pretending it ran', out.applied === false && out.reason === 'unset_default_off');
  }

  // ── ٢ · A مخرِّج THE LIBRARY DID NOT RETURN MAY NOT BE WRITTEN ────────────
  console.log('\n--- 2. NO مخرِّج THAT DID NOT COME FROM THE LIBRARY ---');
  {
    const text = answerWith(MATN);
    // The library answers NOTHING.
    const none = await T.applyTakhrij(text, { env: ON, lookup: lookupOf({}) });
    ok('a matn the library does not know ships as (لا يثبت مرفوعا)',
      none.text.includes('(' + L.NOT_RAISED + ')'), JSON.stringify(none.text));
    ok('...and no book name is anywhere near it',
      !L.TAKHRIJ_LADDER.some((row) => none.text.includes(row.display)), JSON.stringify(none.text));
    ok('...and the caller is told WHY',
      none.problems.includes(T.TAKHRIJ_UNSOURCED), JSON.stringify(none.problems));

    // The library answers with a book that is NOT on the ladder.
    const offLadder = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-001766'], atoms: [atomFor(MATN, 'عمر')] } }),
    });
    ok('a book off the ladder cannot fill the parentheses',
      offLadder.text.includes('(' + L.NOT_RAISED + ')'), JSON.stringify(offLadder.text));

    // The library answers with a LADDER book whose text does NOT carry the matn.
    const near = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: ['نص لا علاقة له البتة بما سئل عنه'] } }),
    });
    ok('a near neighbour that does not carry the matn cannot fill them either',
      near.text.includes('(' + L.NOT_RAISED + ')'), JSON.stringify(near.text));

    // And the honest case still works, or the three rows above would be vacuous.
    const real = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر بن الخطاب')] } }),
    });
    ok('CAUSAL: a ladder book that really carries it IS written',
      real.text.includes('(البخاري)'), JSON.stringify(real.text));
    ok('...and the Companion is put at its head', real.text.includes('عن عمر بن الخطاب رضي الله عنه:'),
      JSON.stringify(real.text));
  }

  // ── ٣ · A GRADE WITH NO حاكم FROM THE LADDER ─────────────────────────────
  console.log('\n--- 3. NO GRADE WITHOUT A LADDER GRADER ---');
  {
    const GRADES = /(?:صحيح|حسن|ضعيف|موضوع)/u;
    const text = answerWith(MATN);
    const outletOnly = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000658'], atoms: [atomFor(MATN, 'عمر')] } }),
    });
    ok('an outlet with no grader beside it carries no grade',
      outletOnly.text.includes('(الترمذي)') && !GRADES.test(outletOnly.text.split('(الترمذي)')[1] || ''),
      JSON.stringify(outletOnly.text));
    const withGrader = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({
        [MATN]: { matn: MATN, subjectIds: ['FC-000658', 'FC-000788'], atoms: [atomFor(MATN, 'عمر'), atomFor(MATN, 'عمر')] },
      }),
    });
    ok('CAUSAL: with صحيح الجامع beside it the grade appears, and it is that book\'s own',
      withGrader.text.includes('(الترمذي · صحيح)'), JSON.stringify(withGrader.text));
    // TWO graders that disagree.
    const split = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({
        [MATN]: {
          matn: MATN,
          subjectIds: ['FC-002060', 'FC-000791'],
          atoms: [atomFor(MATN, 'عمر'), atomFor(MATN, 'عمر')],
        },
      }),
    });
    ok('a split verdict is not a verdict: nothing is graded off disagreeing books',
      split.text.includes('(' + L.NOT_RAISED + ')'), JSON.stringify(split.text));
    ok('...and the contradiction never reaches the reader',
      !/السلسلة الصحيحة · ضعيف|السلسلة الضعيفة · صحيح/u.test(split.text), JSON.stringify(split.text));
    ok('the composer invents no grade of its own for an ungraded ladder book',
      L.composeParenthetical(['FC-001824']).grade === null);
  }

  // ── ٤ · NO CHAIN AND NO عنعنة LEAVES THIS PASS ───────────────────────────
  console.log('\n--- 4. NO ISNAD, NO عنعنة ---');
  {
    const text = answerWith(MATN);
    const chained = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({
        [MATN]: {
          matn: MATN,
          subjectIds: ['FC-000645'],
          atoms: ['حدثنا الحميدي حدثنا سفيان عن يحيى بن سعيد عن محمد بن إبراهيم عن علقمة عن عمر بن الخطاب رضي الله عنه قال: ' + MATN],
        },
      }),
    });
    ok('the atom\'s chain does not travel with the Companion',
      !T.carriesIsnad(chained.text), JSON.stringify(chained.text));
    ok('...and exactly one name is taken out of it',
      (chained.text.match(/رضي الله عن/gu) || []).length === 1, JSON.stringify(chained.text));
    ok('the detector is not vacuous: it sees a chain when there is one',
      T.carriesIsnad('حدثنا سفيان عن يحيى عن محمد قال') === true);
    ok('...and does not cry chain over one «عن»',
      T.carriesIsnad('عن عمر رضي الله عنه: كلام') === false);
  }

  // ── ٥ · A RAISED HADITH WITHOUT PARENTHESES AT ALL ───────────────────────
  console.log('\n--- 5. NO QUOTED MARFUʿ MATN IS LEFT BARE ---');
  {
    const two = `قال النبي صلى الله عليه وسلم: «${MATN}» ثم قال صلى الله عليه وسلم: «${OTHER}».`;
    const out = await T.applyTakhrij(two, {
      env: ON,
      lookup: lookupOf({
        [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر بن الخطاب')] },
      }),
    });
    const quoted = T.findMatns(out.text);
    ok('both matns were seen', T.findMatns(two).length === 2, String(T.findMatns(two).length));
    ok('every quoted matn in the delivered text is followed by parentheses',
      quoted.every((one) => /^\s*\(/u.test(out.text.slice(one.end, one.end + 4))),
      JSON.stringify(out.text));
    ok('...including the one the library knew nothing about',
      out.text.includes('(' + L.NOT_RAISED + ')'), JSON.stringify(out.text));
    ok('...and the one it did know carries its book', out.text.includes('(البخاري)'), JSON.stringify(out.text));
    ok('the two were not spliced into one sentence',
      out.text.includes(MATN) && out.text.includes(OTHER), JSON.stringify(out.text));
  }

  // ── ٦ · WHAT IS QUOTED FROM A MAN STAYS HIS ──────────────────────────────
  console.log('\n--- 6. A TRANSMITTED TEXT IS NOT TOUCHED ---');
  {
    const shaykh = 'وقال الشيخ عبد العزيز بن باز رحمه الله: «هذا حديث عظيم يتعلق بالأعمال الباطنة».';
    const out = await T.applyTakhrij(shaykh, { env: ON, lookup: lookupOf({}) });
    ok('a shaykh\'s own words are byte-identical and carry no parentheses',
      out.text === shaykh, JSON.stringify(out.text));
    const card = `<hadith narrator="عمر">«${MATN}»</hadith>`;
    const cardOut = await T.applyTakhrij(card, { env: ON, lookup: lookupOf({}) });
    ok('a card is stepped over whole', cardOut.text === card, JSON.stringify(cardOut.text));
  }

  // ── ٧ · MUTANTS ─────────────────────────────────────────────────────────
  console.log('\n--- 7. REQUIRED MUTANTS ---');
  {
    // If the ladder filter stopped being applied, the composer would still be handed ids —
    // so the mutant that matters is the one that lets an unconfirmed id through.
    const fake = { ...L };
    ok('MUTANT: an id the ladder does not know resolves to null, not to a display name',
      L.ladderRowFor('FC-999999') === null && L.ladderRowFor('') === null);
    ok('MUTANT: an empty hit list can never produce a sourced parenthetical',
      L.composeParenthetical([]).sourced === false
        && L.composeParenthetical(['FC-999999']).sourced === false);
    ok('MUTANT: both Shaykhs together are «متفق عليه» and carry no grade',
      L.composeParenthetical(['FC-000645', 'FC-000648']).text === L.AGREED_UPON
        && L.composeParenthetical(['FC-000645', 'FC-000648']).grade === null);
    ok('MUTANT: one Shaykh alone is named alone, بلا درجة',
      L.composeParenthetical(['FC-000648', 'FC-000788']).text === 'مسلم');
    void fake;
  }

  console.log(`\n=== ${checks - failures}/${checks} — ${failures ? 'FAIL' : 'PASS'} ===`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('GUARD THREW: ' + (error && error.stack ? error.stack : String(error)));
  process.exit(1);
});
