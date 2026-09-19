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
// ── AND THE THREE THE ROUTE (ب) ORDER OF THE SAME DAY ADDED (§٣) ─────────────
//   ٥ صدر صحابي لم تتفق عليه ذرتان من كتابين
//   ٦ (متفق عليه) بلا ظهور المعرفين معا
//   ٧ درجة عند اختلاف الحكام
// Section 8 below holds all three, and section 9 holds the wire they travel on.
//
// ── AND THE FOUR THE REPAIR ORDER OF THE SAME DAY ADDED, AFTER THE OWNER'S OWN TRIAL ──
//   ٨ بطاقةُ حديثٍ تبقى بطاقةً (والآيةُ والمصدرُ يبقيانِ بطاقتَين)      §١ — sections 6 and 10a
//   ٩ مخرِّجٌ دونَ الشيخَينِ بلا لاحقةٍ — درجةً أو تصريحًا بعدمِ الوقوف  §٢ — sections 3 and 10b
//   ١٠ قوسانِ يكسرانِ جملةً                                          §٣ — section 10c
//   ١١ وسمُ إغلاقٍ بلا فتحٍ يبلغُ عينَ القارئ                          §٤-أ — section 10d
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
    // TWO ladder books, because §٢-أ of the route (ب) order requires two before a Companion
    // may be written. البخاري fills the parentheses; الترمذي is the second witness to the name.
    const real = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({
        [MATN]: {
          matn: MATN,
          subjectIds: ['FC-000645', 'FC-000658'],
          atoms: [atomFor(MATN, 'عمر بن الخطاب'), atomFor(MATN, 'عمر بن الخطاب')],
        },
      }),
    });
    ok('CAUSAL: a ladder book that really carries it IS written',
      real.text.includes('(البخاري)'), JSON.stringify(real.text));
    ok('...and a Companion two books agree on is put at its head',
      real.text.includes('عن عمر بن الخطاب رضي الله عنه:'), JSON.stringify(real.text));
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
    // §٢ OF THE REPAIR ORDER — an outlet below the Shaykhayn invents no grade AND does not stand
    // bare either: it says out loud that no حاكم was found. «(البيهقي)» عارية تقول «ثابت» ولم تقلها.
    ok('an outlet with no grader beside it invents no grade',
      outletOnly.text.includes('(الترمذي · ' + L.NO_RULING + ')')
      && !GRADES.test(L.NO_RULING), JSON.stringify(outletOnly.text));
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
    // Two books, both handing back the full chain, so the row still asks the question it was
    // written to ask: when a name IS taken, does its isnad come with it?
    const CHAIN = 'حدثنا الحميدي حدثنا سفيان عن يحيى بن سعيد عن محمد بن إبراهيم عن علقمة عن عمر بن الخطاب رضي الله عنه قال: ' + MATN;
    const chained = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({
        [MATN]: {
          matn: MATN,
          subjectIds: ['FC-000645', 'FC-000658'],
          atoms: [CHAIN, CHAIN],
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
    // §١ OF THE REPAIR ORDER — THE HADITH CARD IS THE ONE CARD THAT IS NOT STEPPED OVER.
    // The owner measured «إنما الأعمال بالنيات» sitting inside a card with no takhrij at all, and
    // ruled in د-٨: «حديثٌ يُكتَبُ كاملًا وسطَ الكلامِ لا بطاقة … والبطاقاتُ الباقيةُ مثلَ ما هي».
    const card = `<hadith narrator="عمر">«${MATN}»</hadith>`;
    const cardOut = await T.applyTakhrij(card, { env: ON, lookup: lookupOf({}) });
    ok('a hadith card is dissolved into prose, in its own place',
      cardOut.text === `«${MATN}» (${L.NOT_RAISED})`, JSON.stringify(cardOut.text));
    ok('...and the matn is not quoted twice over',
      (cardOut.text.match(/«/gu) || []).length === 1, JSON.stringify(cardOut.text));
    for (const other of ['verse', 'source', 'surah', 'dhikr', 'worship', 'book', 'document']) {
      const block = `<${other} ref="x">«${MATN}»</${other}>`;
      // eslint-disable-next-line no-await-in-loop
      const kept = await T.applyTakhrij(block, { env: ON, lookup: lookupOf({}) });
      ok(`a <${other}> card is stepped over whole, with every button it has`,
        kept.text === block, JSON.stringify(kept.text));
    }
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

  // ── ٨ · THE THREE RULINGS OF THE ROUTE (ب) ORDER ─────────────────────────
  console.log('\n--- 8. THE COMPANION NEEDS TWO BOOKS, «متفق عليه» NEEDS BOTH IDS ---');
  {
    const text = answerWith(MATN);
    const two = (a, b, names) => lookupOf({
      [MATN]: { matn: MATN, subjectIds: [a, b], atoms: names.map((n) => atomFor(MATN, n)) },
    });

    // ٢-أ · ONE BOOK IS A WITNESS, NOT A PROOF.
    const lonely = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر بن الخطاب')] } }),
    });
    ok('8a  one book naming a Companion does NOT put him at the head',
      !/رضي الله عن/u.test(lonely.text), JSON.stringify(lonely.text));
    ok('8a  ...and the matn and its مخرِّج survive the loss — نقص أشرف من خطأ',
      lonely.text.includes('«' + MATN + '» (البخاري)'), JSON.stringify(lonely.text));
    ok('8a  ...and the caller is told it was a RULING and not an empty library',
      lonely.problems.includes(T.TAKHRIJ_COMPANION_UNCONFIRMED)
        && !lonely.problems.includes(T.TAKHRIJ_UNSOURCED), JSON.stringify(lonely.problems));

    // ٢-أ · TWO BOOKS THAT DISAGREE ARE NOT AN AGREEMENT.
    const clash = await T.applyTakhrij(text, {
      env: ON, lookup: two('FC-000645', 'FC-000658', ['عمر بن الخطاب', 'أبو هريرة']),
    });
    ok('8a  two books naming two different men name neither of them',
      !/رضي الله عن/u.test(clash.text), JSON.stringify(clash.text));

    // ٢-أ · AND TWO COPIES OF ONE BOOK ARE ONE BOOK. FC-000656 and FC-000657 are both أبو داود.
    const sameRow = await T.applyTakhrij(text, {
      env: ON, lookup: two('FC-000656', 'FC-000657', ['عمر بن الخطاب', 'عمر بن الخطاب']),
    });
    ok('8a  two ids of ONE ladder row are one witness, not two',
      !/رضي الله عن/u.test(sameRow.text), JSON.stringify(sameRow.text));
    ok('8a  CAUSAL: the same two names across two DIFFERENT rows do write him',
      (await T.applyTakhrij(text, {
        env: ON, lookup: two('FC-000656', 'FC-000658', ['عمر بن الخطاب', 'عمر بن الخطاب']),
      })).text.includes('عن عمر بن الخطاب رضي الله عنه:'));

    // The agreement function itself, driven directly so a mutant of it cannot hide behind
    // the pass that calls it.
    ok('8a  agreedCompanion: a candidate with no book behind it is no witness',
      T.agreedCompanion([{ name: 'عمر', prayer: 'عنه', book: '' },
        { name: 'عمر', prayer: 'عنه', book: '' }]).name === '');
    ok('8a  agreedCompanion: two spellings of one name are one witness twice, not two',
      T.agreedCompanion([{ name: 'أبو هريرة', prayer: 'عنه', book: '1|البخاري' },
        { name: 'ابو هريره', prayer: 'عنه', book: '1|البخاري' }]).name === '');
    ok('8a  agreedCompanion: and across two rows the SAME two spellings agree',
      T.agreedCompanion([{ name: 'أبو هريرة', prayer: 'عنه', book: '1|البخاري' },
        { name: 'ابو هريره', prayer: 'عنه', book: '13|الترمذي' }]).books === 2);
    ok('8a  the threshold is stated as a value, not buried in a comparison',
      T.COMPANION_MIN_BOOKS === 2);

    // ٢-ب · «متفق عليه» IS VERIFIED, NOT ASSUMED.
    // The fixture answers the WIDE call with البخاري alone and the NARROWED one with both,
    // which is precisely the measured case: ten globally-best rows are not ten rows per book.
    const seen = [];
    const narrowing = async (matns, options) => {
      seen.push({ matns: matns.slice(), bookIds: (options && options.bookIds) || [] });
      const both = seen.length > 1;
      return matns.map((matn) => ({
        matn,
        subjectIds: both ? ['FC-000645', 'FC-000648'] : ['FC-000645'],
        atoms: both ? [atomFor(matn, 'عمر بن الخطاب'), atomFor(matn, 'عمر بن الخطاب')]
          : [atomFor(matn, 'عمر بن الخطاب')],
      }));
    };
    const agreed = await T.applyTakhrij(text, { env: ON, lookup: narrowing });
    ok('8b  one Shaykh in the wide call is re-asked, and both make «متفق عليه»',
      agreed.text.includes('(متفق عليه)'), JSON.stringify(agreed.text));
    ok('8b  ...in exactly ONE extra call, and it is narrowed to the two Sahihs alone',
      seen.length === 2 && seen[1].bookIds.length === 2
        && seen[1].bookIds.includes('FC-000645') && seen[1].bookIds.includes('FC-000648'),
      JSON.stringify(seen.map((one) => one.bookIds.length)));
    ok('8b  ...and the wide call was narrowed to the ladder, never to nothing',
      seen[0].bookIds.length === L.TAKHRIJ_LADDER_IDS.length,
      String(seen[0].bookIds.length));

    // AND IT DOES NOT FIRE WHEN THERE IS NOTHING TO ASK.
    const counted = [];
    const countingLookup = (table) => async (matns, options) => {
      counted.push((options && options.bookIds) || []);
      return lookupOf(table)(matns);
    };
    await T.applyTakhrij(text, {
      env: ON,
      lookup: countingLookup({
        [MATN]: {
          matn: MATN,
          subjectIds: ['FC-000645', 'FC-000648'],
          atoms: [atomFor(MATN, 'عمر'), atomFor(MATN, 'عمر')],
        },
      }),
    });
    ok('8b  both Shaykhs already present: no second call is made',
      counted.length === 1, String(counted.length));
    counted.length = 0;
    await T.applyTakhrij(text, { env: ON, lookup: countingLookup({}) });
    ok('8b  neither Shaykh present: no second call is made either',
      counted.length === 1, String(counted.length));

    // AND IT IS READ ON THE RESULTS, NOT ON THE VERDICT — the owner’s «ظهر في النتائج».
    // The fixture hands back صحيح البخاري whose atom is the CHAPTER HEADING: the id IS in the
    // results and is NOT confirmed, which is the measured shape of the most established hadith
    // in the corpus. A trigger read on the confirmed set would not fire here, and the answer
    // would be «(لا يثبت مرفوعا)» about a hadith البخاري ومسلم both have.
    const heads = [];
    const headingFirst = async (matns, options) => {
      heads.push((options && options.bookIds) || []);
      const narrowed = heads.length > 1;
      return matns.map((matn) => ({
        matn,
        subjectIds: narrowed ? ['FC-000645', 'FC-000648'] : ['FC-000645'],
        atoms: narrowed
          ? [atomFor(matn, 'عمر بن الخطاب'), atomFor(matn, 'عمر بن الخطاب')]
          : ['باب: ' + matn],
      }));
    };
    const recovered = await T.applyTakhrij(text, { env: ON, lookup: headingFirst });
    ok('8b  a Shaykh that was RETURNED but not confirmed still triggers the recheck',
      heads.length === 2 && heads[1].length === 2, JSON.stringify(heads.map((h) => h.length)));
    ok('8b  ...and the hadith is rescued from a false «لا يثبت مرفوعا»',
      recovered.text.includes('(متفق عليه)') && !recovered.text.includes(L.NOT_RAISED),
      JSON.stringify(recovered.text));

    // AND A SECOND CALL THAT FINDS NOTHING NEW CHANGES NOTHING.
    const stubborn = await T.applyTakhrij(text, {
      env: ON,
      lookup: async (matns) => matns.map((matn) => ({
        matn, subjectIds: ['FC-000645', 'FC-000658'],
        atoms: [atomFor(matn, 'عمر بن الخطاب'), atomFor(matn, 'عمر بن الخطاب')],
      })),
    });
    ok('8b  a recheck that finds no مسلم leaves «(البخاري)» standing',
      stubborn.text.includes('(البخاري)') && !stubborn.text.includes('متفق عليه'),
      JSON.stringify(stubborn.text));

    // ٢-ج · A SPLIT RULING IS NOT A RULING — asserted on the composer itself, beside the
    // delivered-text witness section 3 already holds.
    const split = L.composeParenthetical(['FC-002060', 'FC-000791']);
    ok('8c  two graders that disagree produce no grade and no مخرِّج at all',
      split.grade === null && split.sourced === false && split.text === L.NOT_RAISED,
      JSON.stringify(split.text));
    ok('8c  CAUSAL: one grader alone still states its own ruling',
      L.composeParenthetical(['FC-000791']).grade === 'ضعيف');
  }

  // ── ٩ · THE WIRE IS ROUTE (ب): ONE DOOR, AND THE MODEL DOES NOT PICK IT ──
  console.log('\n--- 9. THE LIBRARY IS REACHED THROUGH ITS ONE DOOR ---');
  {
    const fs2 = require('fs');
    const src = (rel) => fs2.readFileSync(path.join(REPO, rel), 'utf8');
    // A7 of guards/lib-book-contract-guard.cjs, re-run here over the two files this item
    // touched. It is repeated rather than trusted so that THIS guard fails when the door is
    // opened, instead of a guard nobody thought to run.
    const CALL = /\bsearchLibrary\s*\(/;
    ok('9  lib/takhrij.js opens no second door to the library',
      !CALL.test(src('lib/takhrij.js')), 'searchLibrary( in lib/takhrij.js');
    ok('9  ...and neither does api/ask.js', !CALL.test(src('api/ask.js')));
    ok('9  ...and lib/takhrij.js holds no fetch and no service URL of its own',
      !/\bfetch\s*\(/.test(src('lib/takhrij.js')) && src('lib/takhrij.js').indexOf('lib.ezik.app') === -1);
    ok('9  the runner carries ctx.bookIds down to the service',
      src('lib/free-brain/tools.js').indexOf('bookIds: ctx.bookIds,') !== -1);
    ok('9  ...and copies the subject id onto the lib_book row',
      src('lib/free-brain/tools.js').indexOf("subjectId: String(prov.subject_id || ''),") !== -1);

    // AND THE ADAPTER IS DRIVEN, with a fake runner, so the shape it demands is asserted
    // rather than described: the tool it asks for, the ids it narrows to, and the two row
    // fields it reads back.
    const calls = [];
    const fakeRunTool = async (name, input, ctx) => {
      calls.push({ name, query: input.query, bookIds: ctx.bookIds, token: ctx.libToken });
      return {
        text: '', calls: 1,
        added: [{ kind: 'lib_book', subjectId: 'FC-000645', text: atomFor(input.query, 'عمر بن الخطاب') }],
      };
    };
    const ctx = { libFlagValue: 'on', libToken: 'fixture', table: null };
    const lookup = T.runnerLookup(fakeRunTool, ctx);
    const answers = await lookup([MATN]);
    ok('9  the adapter asks for search_library and nothing else',
      calls.length === 1 && calls[0].name === 'search_library' && calls[0].query === MATN,
      JSON.stringify(calls));
    ok('9  ...narrowed to the whole ladder by default',
      calls[0].bookIds.length === L.TAKHRIJ_LADDER_IDS.length);
    ok('9  ...and it passes the turn\u0027s own ctx through, never one of its own',
      calls[0].token === 'fixture');
    ok('9  ...and reads subjectId and text off the row',
      answers.length === 1 && answers[0].subjectIds[0] === 'FC-000645'
        && answers[0].atoms[0].includes(MATN), JSON.stringify(answers));
    const narrowed = await lookup([MATN], { bookIds: ['FC-000645', 'FC-000648'] });
    ok('9  ...and honours a narrowed request when the pass makes one',
      calls[1].bookIds.length === 2 && narrowed.length === 1);

    // THE WHOLE PASS, THROUGH THE WIRE. If the two ends ever stop fitting, this row is where
    // it shows: nothing here is stubbed except the runner itself.
    const end = await T.applyTakhrij(answerWith(MATN), {
      env: ON,
      lookup: T.runnerLookup(async (name, input) => ({
        text: '', calls: 1,
        added: [
          { subjectId: 'FC-000645', text: atomFor(input.query, 'عمر بن الخطاب') },
          { subjectId: 'FC-000658', text: atomFor(input.query, 'عمر بن الخطاب') },
        ],
      }), ctx),
    });
    ok('9  END TO END: the pass reaches the ladder through the runner and writes the shape',
      end.text.includes('عن عمر بن الخطاب رضي الله عنه: «' + MATN + '» (البخاري)'),
      JSON.stringify(end.text));

    // A RUNNER THAT THROWS IS NOT A TURN THAT DIES.
    const thrown = await T.runnerLookup(async () => { throw new Error('down'); }, ctx)([MATN]);
    ok('9  a runner that throws yields an unsourced matn, not an exception',
      thrown.length === 1 && thrown[0].subjectIds.length === 0);
  }
  // ── ١٠ · THE FOUR RULINGS OF THE REPAIR ORDER, AFTER THE OWNER'S OWN TRIAL ──
  console.log('\n--- 10. THE REPAIR ORDER: THE CARD, THE GRADE, THE SENTENCE, THE STRAY TAG ---');
  {
    const lookupWith = (ids, companion) => lookupOf({
      [MATN]: { matn: MATN, subjectIds: ids, atoms: ids.map(() => atomFor(MATN, companion || 'عمر')) },
    });

    // ١٠-أ · §١ — THE HADITH CARD BECOMES PROSE, AND THE MATN IS NOT TOUCHED BY A LETTER.
    // The card is written the way lib/system-prompt.js:817 tells the model to write one, with its
    // own remembered مخرِّج and درجة in the attributes, and vocalised as the answers ship.
    const VOCALISED = 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ';
    const answerCard = 'الحمد لله. النية أصل كل عمل.\n'
      + `<hadith narrator="أخرجه البخاري ومسلم" ruling="متفق عليه">${VOCALISED}</hadith>\n`
      + 'وهذا الحديث العظيم أصل في الإخلاص.';
    const dissolved = await T.applyTakhrij(answerCard, {
      env: ON,
      lookup: lookupOf({
        [VOCALISED]: {
          matn: VOCALISED,
          subjectIds: ['FC-000645', 'FC-000658'],
          atoms: [atomFor(VOCALISED, 'عمر بن الخطاب'), atomFor(VOCALISED, 'عمر بن الخطاب')],
        },
      }),
    });
    ok('10a the hadith card is gone and the matn stands in prose where it stood',
      !/<\/?hadith/iu.test(dissolved.text)
      && dissolved.text.includes('«' + VOCALISED + '» (البخاري)'), JSON.stringify(dissolved.text));
    ok('10a ...not one letter of the matn was added or taken away',
      dissolved.text.includes(VOCALISED), JSON.stringify(dissolved.text));
    ok('10a ...and the remembered مخرِّج and درجة of the card reach no reader',
      !dissolved.text.includes('أخرجه البخاري ومسلم') && !dissolved.text.includes('narrator'),
      JSON.stringify(dissolved.text));
    ok('10a ...and the prose around it is byte-identical',
      dissolved.text.startsWith('الحمد لله. النية أصل كل عمل.\n')
      && dissolved.text.endsWith('\nوهذا الحديث العظيم أصل في الإخلاص.'), JSON.stringify(dissolved.text));
    ok('10a the pass names where the matn came from, so this is read and not inferred',
      dissolved.entries.length === 1 && dissolved.entries[0].from === 'card',
      JSON.stringify(dissolved.entries));
    // AND A CARD AND A PROSE MATN IN ONE ANSWER ARE BOTH TAKHRIJ'D — §١/٣: «فيجتمع البابان».
    const both = await T.applyTakhrij(
      `قال النبي صلى الله عليه وسلم: «${OTHER}».\n<hadith>${MATN}</hadith>`,
      {
        env: ON,
        lookup: lookupOf({
          [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر')] },
          [OTHER]: { matn: OTHER, subjectIds: ['FC-000648'], atoms: [atomFor(OTHER, 'أبو هريرة')] },
        }),
      },
    );
    ok('10a a prose matn and a card in one answer are BOTH written, neither instead of the other',
      both.text.includes('«' + OTHER + '» (مسلم)') && both.text.includes('«' + MATN + '» (البخاري)')
      && !/<\/?hadith/iu.test(both.text), JSON.stringify(both.text));

    // ١٠-أ (٢) · §١/٤ — THE LENGTH FLOOR WAS A LOTTERY ON THE HARAKAT, AND IT IS CLOSED.
    // «الحمو الموت» reached the owner with no takhrij: 11 characters bare, 17 vocalised, and the
    // floor demanded 12. The floor is now two WORDS on the bare letters, so the same hadith is the
    // same hadith however the model spelled it — and «الحج عرفة», nine bare characters and a whole
    // narration, is inside it.
    const seenIn = (text) => T.findMatns(text).map((one) => one.matn);
    ok('10a a matn is not taken or dropped by whether the model vocalised it',
      seenIn('وقال النبي صلى الله عليه وسلم: «الحمو الموت».').length === 1
      && seenIn('وقال النبي صلى الله عليه وسلم: «الحَمْوُ المَوْتُ».').length === 1,
      JSON.stringify([seenIn('وقال النبي صلى الله عليه وسلم: «الحمو الموت».'),
        seenIn('وقال النبي صلى الله عليه وسلم: «الحَمْوُ المَوْتُ».')]));
    ok('10a ...and a two-word narration is a matn, nine bare letters and all',
      seenIn('وقال النبي صلى الله عليه وسلم: «الحج عرفة» فالوقوف ركن.').length === 1);
    ok('10a CAUSAL: one quoted word is a word being discussed, and is left alone',
      seenIn('وقال النبي صلى الله عليه وسلم: «الصبر» خير.').length === 0);

    // ١٠-ب · §٢ — NO مخرِّج BELOW THE SHAYKHAYN WITHOUT A SUFFIX. EVER.
    // Driven over the WHOLE ladder rather than over one fixture: every row that can be an outlet
    // is asked, and the row fails on the first one that would ship a bare name.
    const bare = [];
    for (const row of L.TAKHRIJ_LADDER) {
      if (row.shaykh) continue;
      const built = L.composeParenthetical(row.ids);
      if (!built.sourced) continue;
      if (!built.text.includes(' · ')) bare.push(row.display + ' -> ' + built.text);
    }
    ok('10b no ladder row below the Shaykhayn can produce a parenthetical with no suffix',
      bare.length === 0, JSON.stringify(bare));
    ok('10b ...and the suffix is the grade when a grader stated one',
      L.composeParenthetical(['FC-000658', 'FC-000788']).text === 'الترمذي · صحيح'
      && L.composeParenthetical(['FC-000658', 'FC-000788']).ruled === true);
    ok('10b ...and otherwise it says the ruling was not found, in those words',
      L.composeParenthetical(['FC-000760']).text === 'البيهقي · ' + L.NO_RULING
      && L.composeParenthetical(['FC-000760']).ruled === false);
    ok('10b CAUSAL: the two Ṣaḥīḥs are the only three strings that stand alone',
      L.composeParenthetical(['FC-000645']).text === 'البخاري'
      && L.composeParenthetical(['FC-000648']).text === 'مسلم'
      && L.composeParenthetical(['FC-000645', 'FC-000648']).text === L.AGREED_UPON);
    // AND OVER DELIVERED TEXT, because that is where the owner read «(البيهقي)».
    const below = await T.applyTakhrij(answerWith(MATN), { env: ON, lookup: lookupWith(['FC-000760']) });
    ok('10b a delivered answer never carries a collection alone below the Shaykhayn',
      below.text.includes('(البيهقي · ' + L.NO_RULING + ')') && !below.text.includes('(البيهقي)'),
      JSON.stringify(below.text));

    // ١٠-ج · §٣ — THE PARENTHESES MAY NOT CUT A SENTENCE IN HALF.
    // The owner's own sentence, which reached his screen broken.
    const CARRIED = 'اختلاف أمتي رحمة';
    const embedded = 'وقد اشتهر ما يروى عن النبي صلى الله عليه وسلم، لكن هذا لا يعني أن اللفظ '
      + `المشهور «${CARRIED}» حديث ثابت عنه.`;
    const moved = await T.applyTakhrij(embedded, {
      env: ON,
      lookup: lookupOf({ [CARRIED]: { matn: CARRIED, subjectIds: ['FC-000791'], atoms: [atomFor(CARRIED, 'عمر')] } }),
    });
    ok('10c a matn that is a مضاف إليه does NOT take the parentheses between it and its خبر',
      moved.text.includes(`«${CARRIED}» حديث ثابت عنه`), JSON.stringify(moved.text));
    ok('10c ...they stand at the end of the sentence instead, and the sentence reads whole',
      moved.text.endsWith('حديث ثابت عنه (ضعيف الجامع · ضعيف).'), JSON.stringify(moved.text));
    ok('10c ...and the pass says it deferred them rather than leaving it to be guessed',
      moved.entries.length === 1 && moved.entries[0].deferred === true,
      JSON.stringify(moved.entries));
    // CAUSAL: مقول القول — a colon in front of the quotation — still takes them immediately.
    const quoted = await T.applyTakhrij(answerWith(MATN), { env: ON, lookup: lookupWith(['FC-000645']) });
    ok('10c CAUSAL: a quotation introduced by a colon keeps its parentheses beside it',
      quoted.text.includes(`«${MATN}» (البخاري)`) && quoted.entries[0].deferred === false,
      JSON.stringify(quoted.text));
    // AND WHERE THERE IS NO SAFE POSITION, NOTHING IS WRITTEN AT ALL (§٣/٢).
    const noRoom = `وسبب ذلك ما ورد عن النبي صلى الله عليه وسلم أن «${MATN}» أصل`;
    const declined = await T.applyTakhrij(noRoom, { env: ON, lookup: lookupWith(['FC-000645']) });
    ok('10c with no full stop to defer to, not one character is injected',
      declined.text === noRoom, JSON.stringify(declined.text));
    ok('10c ...and it is recorded as a ruling, not lost as a silence',
      declined.problems.includes(T.TAKHRIJ_NO_SLOT)
      && declined.entries[0].declined === 'no_safe_slot', JSON.stringify(declined.problems));
    // THE ORDER'S OWN WORDING OF THE ROW: the parentheses are attached only where a closing mark
    // is followed by a stop, or at the end of the sentence. Asserted over every delivered fixture
    // above rather than over one.
    const readable = [dissolved, both, below, moved, quoted].map((run) => run.text);
    ok('10c in every delivered fixture the parentheses follow a closing mark or a sentence end',
      readable.every((text) => [...text.matchAll(/\(([^()]*)\)/gu)].every((hit) => {
        const before = text.slice(0, hit.index).replace(/\s+$/u, '');
        return /»$/u.test(before) || /[.!؟،؛:ء-ي]$/u.test(before);
      })) && readable.every((text) => !/»\s*\([^()]*\)\s*[ء-ي]+\s+(?:حديث|أصل)\b/u.test(text)),
      JSON.stringify(readable));

    // ١٠-د · §٤-أ — A CLOSING TAG WITH NO OPENING TAG REACHES NO READER.
    // The defect the owner saw, reproduced through the seat that caused it: the delivery seal at
    // api/ask.js:1049. `sentences()` used to cut inside a `<hadith>` block, drop the piece holding
    // the opening tag and its unpublished `ruling`, and leave `</hadith>` standing in the prose.
    const LOCK = await esm('lib/takhrij-lock.js');
    const CARD_ANSWER = '<hadith narrator="أخرجه مسلم" ruling="أخرجه مسلم (55)">'
      + 'الدِّينُ النَّصِيحَةُ. قُلْنَا: لِمَنْ يَا رَسُولَ اللهِ؟ قَالَ: لِلهِ وَلِكِتَابِهِ'
      + '</hadith>\nوهذا الحديث أصل عظيم في الدين.';
    const sealedCard = LOCK.lockTakhrij(CARD_ANSWER, []);
    ok('10d a card whose takhrij nobody published is dropped WHOLE, tag and all',
      !/<\/hadith>/iu.test(sealedCard.text) && !/<hadith\b/iu.test(sealedCard.text),
      JSON.stringify(sealedCard.text));
    ok('10d ...and the reader is never handed the tail of a hadith as the head of an answer',
      !sealedCard.text.trimStart().startsWith('قُلْنَا'), JSON.stringify(sealedCard.text));
    ok('10d CAUSAL: a card whose takhrij IS on a fetched page survives entire',
      /<hadith\b/iu.test(LOCK.lockTakhrij(CARD_ANSWER, [{ passage: 'أخرجه مسلم (55) في صحيحه', title: 'مسلم' }]).text),
      JSON.stringify(LOCK.lockTakhrij(CARD_ANSWER, [{ passage: 'أخرجه مسلم (55) في صحيحه', title: 'مسلم' }]).text));
    ok('10d and no delivered fixture of this guard carries a stray closing tag',
      readable.every((text) => !/<\/(?:hadith|verse|source|surah|dhikr|worship|book|document)\s*>/iu.test(text)));

    // AND THE ONE PHRASE THIS PASS WRITES THAT THE SEAL READS AS AN ATTRIBUTION.
    // «(متفق عليه)» is a takhrij span, and the seal drops the sentence carrying it unless a FETCHED
    // page publishes it. The pages that do are the ladder rows the library just confirmed, and the
    // pass hands them over in `sealProof`. Without them the takhrij deletes the hadith it sourced.
    const agreedRun = await T.applyTakhrij(answerWith(MATN), {
      env: ON, lookup: lookupWith(['FC-000645', 'FC-000648'], 'عمر بن الخطاب'),
    });
    ok('10d the pass writes «متفق عليه» and names the two books that proved it',
      agreedRun.text.includes('(' + L.AGREED_UPON + ')')
      && agreedRun.entries[0].sealProof.includes('البخاري')
      && agreedRun.entries[0].sealProof.includes('مسلم'), JSON.stringify(agreedRun.entries));
    const proofRows = agreedRun.entries.flatMap((entry) => entry.sealProof.map((book) => ({ title: book, passage: book })));
    ok('10d ...and with that proof in hand the seal leaves the sentence standing',
      LOCK.lockTakhrij(agreedRun.text, proofRows).text === agreedRun.text,
      JSON.stringify(LOCK.lockTakhrij(agreedRun.text, proofRows).text));
    ok('10d CAUSAL: without it the seal deletes the very hadith the library sourced',
      LOCK.lockTakhrij(agreedRun.text, []).text !== agreedRun.text,
      JSON.stringify(LOCK.lockTakhrij(agreedRun.text, []).text));
    ok('10d ...and a parenthetical the pass did NOT write hands the seal nothing',
      below.entries[0].sealProof.length === 0 && quoted.entries[0].sealProof.length === 0,
      JSON.stringify([below.entries[0].sealProof, quoted.entries[0].sealProof]));
    // AND api/ask.js REALLY HANDS IT OVER, read off the file rather than assumed.
    const askSrc = require('fs').readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('10d api/ask.js puts the proven rows into the seal and nowhere else',
      askSrc.includes('...storedFinalizerSources, ...takhrijProvenRows]')
      && askSrc.includes('takhrijProvenRows.push({ title: book, passage: book })')
      // ...and NOT into the finalizer's own source list, where it would widen what counts as
      // evidence for a card or a citation.
      && !/sources:\s*\[[^\]]*takhrijProvenRows/u.test(askSrc),
      'the wire is not the one this row describes');
  }
  console.log(`\n=== ${checks - failures}/${checks} — ${failures ? 'FAIL' : 'PASS'} ===`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('GUARD THREW: ' + (error && error.stack ? error.stack : String(error)));
  process.exit(1);
});
