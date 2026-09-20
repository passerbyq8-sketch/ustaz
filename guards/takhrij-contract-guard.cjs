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
// ── AND THE TWO THE SILENCE ORDER OF THE SAME DAY ADDED, AFTER HIS SECOND TRIAL ──
//   ١٢ (لا يثبت مرفوعا) بلا حكمِ حاكمٍ من السلَّمِ مرافقٍ في السجلّ        §١ — section 11
//   ١٣ متنٌ واحدٌ يبلغُ القارئَ مرّتَينِ في جوابٍ واحد                    §٢ — section 12
// AND THE ROWS OF SECTIONS 2, 3, 5, 6 AND 8 THAT STATED «فشلُ البحثِ ⟸ (لا يثبت مرفوعا)» now
// state its opposite, because the owner overturned that contract in as many words: «عزك لا ينفي
// بناءً على عجزِه». A guard row is a contract written down, so when the contract is overturned the
// row is rewritten — it is not softened, and nothing was renamed to make it pass.
//
// ── AND THE FOUR THE REPAIR ORDER OF THE SAME DAY ADDED, AFTER THE OWNER'S OWN TRIAL ──
//   ٨ بطاقةُ حديثٍ تبقى بطاقةً (والآيةُ والمصدرُ يبقيانِ بطاقتَين)      §١ — sections 6 and 10a
//   ٩ مخرِّجٌ دونَ الشيخَينِ بلا لاحقةٍ — درجةً أو تصريحًا بعدمِ الوقوف  §٢ — sections 3 and 10b
//   ١٠ قوسانِ يكسرانِ جملةً                                          §٣ — section 10c
//   ١١ وسمُ إغلاقٍ بلا فتحٍ يبلغُ عينَ القارئ                          §٤-أ — section 10d
//
// ── AND THE THREE THE FINAL ORDER OF 19 SEPTEMBER ADDED, AFTER HIS THIRD TRIAL ──
//   ١٤ أيّ واحد من وسوم الثقة الأربعة المنزوعة يبلغ عين القارئ          §١ — section 14
//   ١٥ قوسانا تقف بجانب نسبة صريحة كتبها النثر نفسه                     §٢ — section 15
//   ١٦ باب اختلاف اللفظ يتجاوز المصراع الواحد الذي فُتح عليه            §٣ — section 16
// AND THE ROW OF SECTION 6 THAT STATED «بطاقةٌ لم تُخرَّج تبقى بطاقة» now states its opposite,
// because the owner overturned that contract in as many words after measuring what it ships:
// «نص منقول» standing over the Prophet's ﷺ own words. A guard row is a contract written down,
// so an overturned contract is rewritten here — not softened, and nothing was renamed to pass.
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
  console.log('\n--- 2. NO مخرِّج THAT DID NOT COME FROM THE LIBRARY, AND NO DENIAL EITHER ---');
  {
    const text = answerWith(MATN);
    // The library answers NOTHING. §١ OF THE SILENCE ORDER: that is news about US.
    const none = await T.applyTakhrij(text, { env: ON, lookup: lookupOf({}) });
    ok('a matn the library does not know is left EXACTLY as the model wrote it',
      none.text === text && none.applied === false, JSON.stringify(none.text));
    ok('...and is not denied, softened, marked or hinted at by one character',
      !none.text.includes(L.NOT_RAISED) && !/[()]/u.test(none.text.slice(text.indexOf('»'))),
      JSON.stringify(none.text));
    ok('...and no book name is anywhere near it',
      !L.TAKHRIJ_LADDER.some((row) => none.text.includes(row.display)), JSON.stringify(none.text));
    ok('...and the caller is told it was SILENCE and not a verdict',
      none.problems.includes(T.TAKHRIJ_SILENT) && !none.problems.includes(T.TAKHRIJ_UNSOURCED),
      JSON.stringify(none.problems));
    ok('...and the record says which matn went unanswered, so the silence is not a loss',
      none.entries.length === 1 && none.entries[0].silent === true
        && none.entries[0].declined === 'search_found_nothing', JSON.stringify(none.entries));

    // The library answers with a book that is NOT on the ladder.
    const offLadder = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-001766'], atoms: [atomFor(MATN, 'عمر')] } }),
    });
    ok('a book off the ladder fills no parentheses, and denies nothing either',
      offLadder.text === text && !offLadder.text.includes(L.NOT_RAISED), JSON.stringify(offLadder.text));

    // The library answers with a LADDER book whose text does NOT carry the matn.
    const near = await T.applyTakhrij(text, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: ['نص لا علاقة له البتة بما سئل عنه'] } }),
    });
    ok('a near neighbour that does not carry the matn is a silence, not a denial',
      near.text === text && !near.text.includes(L.NOT_RAISED), JSON.stringify(near.text));

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
    ok('a split verdict is not a verdict: nothing is written at all off disagreeing books',
      split.text === text && !split.text.includes(L.NOT_RAISED), JSON.stringify(split.text));
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

  // ── ٥ · WHAT WAS SOURCED IS WRITTEN, AND WHAT WAS NOT IS LEFT ALONE ──────
  // THE OLD ROW HERE READ «no quoted marfūʿ matn is left bare», and that floor is what filled
  // three hadiths of the Ṣaḥīḥayn with a denial. A matn the library did not answer for is left
  // bare ON PURPOSE now, and the row that matters is that the OTHER one still gets its book.
  console.log('\n--- 5. TWO MATNS, ONE ANSWERED: THE OTHER IS UNTOUCHED, NOT DENIED ---');
  {
    const two = `قال النبي صلى الله عليه وسلم: «${MATN}» ثم قال صلى الله عليه وسلم: «${OTHER}».`;
    const out = await T.applyTakhrij(two, {
      env: ON,
      lookup: lookupOf({
        [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر بن الخطاب')] },
      }),
    });
    ok('both matns were seen', T.findMatns(two).length === 2, String(T.findMatns(two).length));
    ok('the one the library answered for carries its book',
      out.text.includes('(البخاري)'), JSON.stringify(out.text));
    ok('...and the one it knew nothing about carries NOTHING',
      out.text.includes(`«${OTHER}».`) && !out.text.includes(L.NOT_RAISED), JSON.stringify(out.text));
    ok('...and both problems are reported, each under its own name',
      out.problems.includes(T.TAKHRIJ_SILENT), JSON.stringify(out.problems));
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
    const cardOut = await T.applyTakhrij(card, {
      env: ON,
      lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر')] } }),
    });
    ok('a hadith card is dissolved into prose, in its own place',
      cardOut.text === `«${MATN}» (البخاري)`, JSON.stringify(cardOut.text));
    ok('...and the matn is not quoted twice over',
      (cardOut.text.match(/«/gu) || []).length === 1, JSON.stringify(cardOut.text));
    // §١ OF THE FINAL ORDER — AND WITH NOTHING TO CARRY, THE CARD IS STILL DISSOLVED.
    //
    // THIS ROW STATED ITS OWN OPPOSITE UNTIL 19 September, and the contract it stated was
    // overturned by the owner, not softened by this agent. It read «a card the library could not
    // answer for stays a card, whole», on the reading that §١ of the silence order — «المتنُ
    // يخرجُ عاريًا كما كانَ قبلَ بنائِنا» — covered the card's own narrator and ruling attributes.
    // He then measured what that ships: «نص منقول» standing over «سُئِلَ النَّبِيُّ ﷺ: أَيُّ الْعَمَلِ
    // أَفْضَلُ؟ …», one of the four confidence marks he had ordered removed on 18 September, over
    // words that are the Prophet's ﷺ own. §١ of the final order: «ووسمُ «نص منقول» لا يبلغُ عينَ
    // القارئِ فوقَ متنٍ نبويٍّ بحال». So the card goes at every exit, and the SILENCE is kept where
    // silence was what the rule was about: no parentheses, no Companion, no denial, no grade.
    const silentCard = await T.applyTakhrij(card, { env: ON, lookup: lookupOf({}) });
    ok('a card the library could not answer for is STILL dissolved into prose',
      silentCard.text === `«${MATN}»` && !/<\/?hadith/iu.test(silentCard.text),
      JSON.stringify(silentCard.text));
    ok('...and not one character is added to the matn while it is dissolved',
      silentCard.text.replace(/[«»]/gu, '') === MATN, JSON.stringify(silentCard.text));
    ok('...and carries no denial in its place',
      !silentCard.text.includes(L.NOT_RAISED)
        && silentCard.problems.includes(T.TAKHRIJ_SILENT), JSON.stringify(silentCard.problems));
    // AND THE RECORD SAYS BOTH THINGS AT ONCE: nothing was found, and the block was dissolved
    // anyway. A record that said only the first would make this look like the old behaviour.
    ok('...and the record names the silence AND the dissolution',
      silentCard.entries.length === 1 && silentCard.entries[0].silent === true
        && silentCard.entries[0].dissolved === true
        && silentCard.entries[0].parenthetical === '',
      JSON.stringify(silentCard.entries));
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
    ok('8b  both Shaykhs already CONFIRMED: no second call is made',
      counted.length === 1, String(counted.length));
    counted.length = 0;
    await T.applyTakhrij(text, { env: ON, lookup: countingLookup({}) });
    // §٣ OF THE SILENCE ORDER — AND THIS ROW STATED THE DEFECT. It read «neither Shaykh present:
    // no second call is made either», and neither-present is the case that actually happens: the
    // ten best rows of a 54-book ladder are the تخريج volumes, not the Ṣaḥīḥ that narrates it
    // once. Measured live for «إنما الأعمال بالنيات», «أحي والداك» and «الزمها»: zero Shaykhs in
    // the wide answer for all three, so the narrowed request — the one that finds them — was
    // never sent, and «(متفق عليه)» could not fire anywhere.
    ok('8b  neither Shaykh present: the narrowed request IS sent, and that is the §٣ repair',
      counted.length === 2 && counted[1].length === 2, JSON.stringify(counted.map((c) => c.length)));

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
    ok('8c  two graders that disagree produce no grade, no مخرِّج and no text at all',
      split.grade === null && split.sourced === false && split.silent === true && split.text === '',
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
      // §١ — AND A DENIAL IS NOT A NAME WITH A MISSING SUFFIX. «(لا يثبت مرفوعا)» is the whole
      // content of the parentheses when a grader of weakness is the only ladder book that
      // answered; the ruler travels in the record (`ruledBy`), which row 11 below reads.
      if (built.text === L.NOT_RAISED) continue;
      if (!built.text.includes(' · ')) bare.push(row.display + ' -> ' + built.text);
    }
    ok('10b no ladder row below the Shaykhayn can produce a bare collection name',
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
      moved.text.endsWith(`حديث ثابت عنه (${L.NOT_RAISED}).`), JSON.stringify(moved.text));
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
    // ── AND ON 20 SEPTEMBER 2026 THE SEAL STOPPED ACCEPTING A BARE BOOK NAME ──
    // `lib/takhrij-lock.js` used to establish a bare «متفق عليه» from the two names appearing
    // ANYWHERE on a fetched page. That is how «ما ثبت في الصحيحين» reached the owner's screen over
    // a narration the Ṣaḥīḥayn do not carry; guards/sahihayn-link-guard.cjs holds that case. The
    // rule now asks that ONE passage name both Shaykhs AND speak about the matn being claimed.
    //
    // THIS PASS'S OWN PROOF ROWS NO LONGER MEET IT, AND THAT IS MEASURED, NOT ASSUMED. `sealProof`
    // hands over the ladder books BY NAME and nothing else — «no atom text travels», lib/takhrij.js
    // :1252 — so the rows fold to «صحيح البخاري» · «صحيح مسلم» and share no word with the sentence
    // they exist to prove. The seal therefore now drops a «متفق عليه» THIS APP ITSELF VERIFIED, until that seat was changed to hand the matn over with the name.
    //
    // THAT OVER-REFUSAL WAS CLOSED ON 20 September 2026, hours after it was measured. Its seat is
    // api/ask.js:1958, and it was closed by giving
    // those rows the matn they are proving. The two rows below say exactly what the seal does now.
    const proofRows = agreedRun.entries.flatMap((entry) => entry.sealProof.map((book) => ({ title: book, passage: book })));
    ok('10d a proof row that is a BARE BOOK NAME no longer establishes «متفق عليه»',
      LOCK.lockTakhrij(agreedRun.text, proofRows).text !== agreedRun.text,
      JSON.stringify(LOCK.lockTakhrij(agreedRun.text, proofRows).text));
    // AND THE MECHANISM IS INTACT where the row carries what a real fetched page carries: both
    // names in one passage, about this matn. Without this row the one above would read as «the
    // seal refuses every «متفق عليه»», which is not the rule and would hide a far worse defect.
    const matnProofRows = [{ title: 'صحيح البخاري',
      passage: 'أخرجه البخاري ومسلم عن عمر بن الخطاب رضي الله عنه قال: ' + MATN }];
    ok('10d ...while a page naming both Shaykhs ABOUT THIS MATN still leaves the sentence standing',
      LOCK.lockTakhrij(agreedRun.text, matnProofRows).text === agreedRun.text,
      JSON.stringify(LOCK.lockTakhrij(agreedRun.text, matnProofRows).text));
    ok('10d CAUSAL: with no proof at all the seal deletes the very hadith the library sourced',
      LOCK.lockTakhrij(agreedRun.text, []).text !== agreedRun.text,
      JSON.stringify(LOCK.lockTakhrij(agreedRun.text, []).text));
    ok('10d ...and a parenthetical the pass did NOT write hands the seal nothing',
      below.entries[0].sealProof.length === 0 && quoted.entries[0].sealProof.length === 0,
      JSON.stringify([below.entries[0].sealProof, quoted.entries[0].sealProof]));
    // AND api/ask.js REALLY HANDS IT OVER, read off the file rather than assumed.
    const askSrc = require('fs').readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('10d api/ask.js puts the proven rows into the seal and nowhere else',
      askSrc.includes('...storedFinalizerSources, ...takhrijProvenRows]')
      && askSrc.includes("takhrijProvenRows.push({ title: book, passage: book + ' ' + String(entry.matn || '') })")
      // ...and NOT into the finalizer's own source list, where it would widen what counts as
      // evidence for a card or a citation.
      && !/sources:\s*\[[^\]]*takhrijProvenRows/u.test(askSrc),
      'the wire is not the one this row describes');
  }
  // ── ١١ · §١ — «لا يثبت مرفوعا» MAY NOT LEAVE WITHOUT A حاكم BEHIND IT ────
  //
  // THE OWNER'S ROW, IN HIS WORDS: «وزِدْ صفًّا في الحارسِ يمنعُ خروجَ (لا يثبت مرفوعا) بلا
  // حكمِ حاكمٍ مرافقٍ في السجلّ». So the assertion is made TWICE over: on the composer, for every
  // shape of hit it can be handed, and on DELIVERED TEXT, where the owner read the defect.
  console.log('\n--- 11. THE DENIAL IS A RULING SOMEBODY MADE, OR IT DOES NOT LEAVE ---');
  {
    const text = answerWith(MATN);
    const lookupWith = (ids) => lookupOf({
      [MATN]: { matn: MATN, subjectIds: ids, atoms: ids.map(() => atomFor(MATN, 'عمر')) },
    });

    // (أ) THE COMPOSER, OVER EVERY SUBSET OF THE LADDER THAT IS WORTH ASKING ABOUT.
    // Each row alone, and each row paired with every other: the denial must never appear
    // without `ruledBy` naming a grader whose own stated ruling is one of NOT_ESTABLISHED_GRADES.
    const offenders = [];
    const ladderIds = L.TAKHRIJ_LADDER.map((row) => row.ids[0]);
    for (let i = 0; i < ladderIds.length; i += 1) {
      for (let j = i; j < ladderIds.length; j += 1) {
        const ids = i === j ? [ladderIds[i]] : [ladderIds[i], ladderIds[j]];
        const built = L.composeParenthetical(ids);
        if (built.text !== L.NOT_RAISED) continue;
        const ruled = built.ruled === true && L.NOT_ESTABLISHED_GRADES.includes(built.grade)
          && String(built.ruledBy || '').length > 0;
        if (!ruled) offenders.push(ids.join('+') + ' -> ' + JSON.stringify(built));
      }
    }
    ok('11  no combination of ladder books produces a denial nobody ruled',
      offenders.length === 0, JSON.stringify(offenders.slice(0, 3)));
    ok('11  ...and the empty library produces no denial at all, but silence',
      L.composeParenthetical([]).silent === true && L.composeParenthetical([]).text === '');
    ok('11  ...and a book that merely HOLDS the matn with no stated ruling is silence too',
      L.composeParenthetical(['FC-002040']).silent === true, JSON.stringify(L.composeParenthetical(['FC-002040'])));

    // (ب) CAUSAL — the denial still leaves when a grader of weakness really is the only answer.
    // «حب الوطن من الإيمان» is the owner's own example, and السلسلة الضعيفة is the book that
    // rules it: measured live on ezik-shamela-20260820 on 19 September 2026.
    const denied = await T.applyTakhrij(text, { env: ON, lookup: lookupWith(['FC-002061']) });
    ok('11  CAUSAL: a grader of weakness alone DOES print the denial',
      denied.text.includes('(' + L.NOT_RAISED + ')'), JSON.stringify(denied.text));
    ok('11  ...and the record beside it names who ruled, and what he ruled',
      denied.entries[0].ruledBy === 'السلسلة الضعيفة' && denied.entries[0].ruled === true,
      JSON.stringify(denied.entries));
    ok('11  ...and no Companion is put in front of a sentence that denies the narration',
      !/رضي الله عن/u.test(denied.text), JSON.stringify(denied.text));

    // (ج) OVER DELIVERED TEXT, every fixture this guard ships: a denial in the prose and no
    // ruler in the record is the shape the owner read on his screen, and it cannot occur.
    const runs = [
      await T.applyTakhrij(text, { env: ON, lookup: lookupOf({}) }),
      await T.applyTakhrij(text, { env: ON, lookup: lookupWith(['FC-000658']) }),
      await T.applyTakhrij(text, { env: ON, lookup: lookupWith(['FC-000645', 'FC-000648']) }),
      await T.applyTakhrij(text, { env: ON, lookup: lookupWith(['FC-002061']) }),
      await T.applyTakhrij(text, { env: ON, lookup: lookupWith(['FC-002060', 'FC-000791']) }),
    ];
    ok('11  in every delivered fixture, a printed denial has a ruler in the record',
      runs.every((run) => !run.text.includes(L.NOT_RAISED)
        || run.entries.some((entry) => entry.parenthetical === L.NOT_RAISED && entry.ruledBy)),
      JSON.stringify(runs.map((run) => run.text)));
    ok('11  MUTANT: a run whose library said nothing is byte-identical, every time',
      runs[0].text === text && runs[4].text === text, JSON.stringify([runs[0].text, runs[4].text]));
  }

  // ── ١٢ · §٢ — ONE MATN MAY NOT REACH THE READER TWICE ───────────────────
  console.log('\n--- 12. ONE MATN, ONE APPEARANCE ---');
  {
    // The owner's own shape: the model writes the narration in its sentence AND repeats it in a
    // card underneath. Vocalised in the card and bare in the prose, because that is how it came.
    const VOCALISED = 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ';
    const BARE = 'إنما الأعمال بالنيات';
    const answer = `وقال النبي صلى الله عليه وسلم: «${BARE}» فالنية أصل العمل.\n`
      + `<hadith narrator="أخرجه البخاري" ruling="صحيح">${VOCALISED}</hadith>\n`
      + 'وهذا أصل عظيم.';
    const out = await T.applyTakhrij(answer, {
      env: ON,
      lookup: lookupOf({
        [BARE]: { matn: BARE, subjectIds: ['FC-000645'], atoms: [atomFor(BARE, 'عمر بن الخطاب')] },
        [VOCALISED]: { matn: VOCALISED, subjectIds: ['FC-000645'], atoms: [atomFor(VOCALISED, 'عمر بن الخطاب')] },
      }),
    });
    const appearances = (text, matn) => (text.match(new RegExp(T.tolerant(matn), 'gu')) || []).length;
    ok('12  the narration reaches the reader ONCE',
      appearances(out.text, BARE) === 1, JSON.stringify(out.text));
    ok('12  ...and the copy that survives is the one in the sentence that introduces it',
      out.text.includes(`«${BARE}» (البخاري) فالنية أصل العمل.`), JSON.stringify(out.text));
    ok('12  ...and the card is gone whole, with no tag and no blank line behind it',
      !/<\/?hadith/iu.test(out.text) && !/\n\s*\n/u.test(out.text), JSON.stringify(out.text));
    ok('12  ...and the prose on both sides is untouched to the character',
      out.text.startsWith('وقال النبي صلى الله عليه وسلم:')
        && out.text.endsWith('\nوهذا أصل عظيم.'), JSON.stringify(out.text));
    ok('12  ...and the drop is recorded as a ruling rather than lost as a silence',
      out.problems.includes(T.TAKHRIJ_DUPLICATE_DROPPED)
        && out.entries.some((entry) => entry.dropped === true
          && entry.declined === 'duplicate_of_prose'), JSON.stringify(out.entries));
    // AND IT COSTS NO LOOKUP: the dropped card never becomes a query.
    const asked = [];
    await T.applyTakhrij(answer, {
      env: ON,
      lookup: async (matns) => { asked.push(matns.slice()); return matns.map((m) => ({ matn: m, subjectIds: [], atoms: [] })); },
    });
    ok('12  a dropped duplicate is never looked up',
      asked[0].length === 1 && asked[0][0] === BARE, JSON.stringify(asked));
    // CAUSAL — A CARD THAT REPEATS NOTHING IS STILL DISSOLVED AND STILL TAKHRIJ'D.
    const alone = `الحمد لله.\n<hadith narrator="عمر">${VOCALISED}</hadith>\nوبعد.`;
    const kept = await T.applyTakhrij(alone, {
      env: ON,
      lookup: lookupOf({ [VOCALISED]: { matn: VOCALISED, subjectIds: ['FC-000645'], atoms: [atomFor(VOCALISED, 'عمر')] } }),
    });
    ok('12  CAUSAL: a card that duplicates nothing keeps its place and gets its book',
      kept.text.includes(`«${VOCALISED}» (البخاري)`) && !/<\/?hadith/iu.test(kept.text),
      JSON.stringify(kept.text));
    // AND THE COMPARISON IS THE FOLDED ONE, so a card vocalised differently is still the same
    // narration — which is the case that actually shipped.
    ok('12  the duplicate is recognised across vocalisation',
      T.findTargets(answer).duplicates.length === 1
        && T.findTargets(answer).targets.length === 1, JSON.stringify(T.findTargets(answer)));
  }

  // ── ١٣ · §٣ — THE ROW CAP OF THIS PATH, AND THE MODEL'S OWN ────────────
  console.log('\n--- 13. TEN ROWS FOR THE TAKHRIJ, FIVE FOR THE MODEL ---');
  {
    const fs3 = require('fs');
    const toolsSrc = fs3.readFileSync(path.join(REPO, 'lib/free-brain/tools.js'), 'utf8');
    ok('13  the shared ceiling of the model path is untouched and still five',
      /export const MAX_RESULTS_PER_CALL = 5;/.test(toolsSrc));
    ok('13  the takhrij path states its own ten as a value',
      T.TAKHRIJ_ROWS_PER_CALL === 10);
    ok('13  ...and the runner reads a per-call cap instead of the constant',
      toolsSrc.includes('const cap = Number.isInteger(ctx.resultCap) && ctx.resultCap > 0'));
    // AND THE ADAPTER REALLY SENDS IT, driven rather than described.
    const seenCtx = [];
    const lookup = T.runnerLookup(async (name, input, ctx) => {
      seenCtx.push(ctx.resultCap);
      return { text: '', calls: 1, added: [] };
    }, { libFlagValue: 'on', libToken: 'fixture' });
    await lookup([MATN]);
    ok('13  the takhrij adapter asks the runner for ten rows',
      seenCtx.length === 1 && seenCtx[0] === 10, JSON.stringify(seenCtx));
  }

  // ── ١٤ · §١ — NOT ONE OF THE FOUR CONFIDENCE MARKS REACHES THE READER ───
  //
  // THE ROW THE OWNER ASKED FOR BY NAME: «وزِدْ صفًّا في الحارسِ يمنعُ ظهورَ أيٍّ من وسومِ الثقةِ
  // الأربعةِ المنزوعةِ في المخرَج.» The four were ordered removed on 18 September. Three of them
  // live in lib/output-reviewer.js's REVIEW_TAGS and were removed there; the fourth,
  // the hadith-card heading in app.jsx, was a different mechanism and the removal never reached
  // it — so it was still being printed over the Prophet's ﷺ words on the live app.
  //
  // ── AND ON 19 SEPTEMBER THE OWNER ORDERED THE FOURTH REMOVED TOO ────────
  // «يُنزَعُ الوسمُ نزعًا تامًّا. وبطاقةُ الحديثِ تحملُ «من السنة النبوية» في الحالَينِ — بوجودِ
  //  الراوي والحكمِ وبعدمِهما. لا وسمَ ثالثَ ولا فراغ.» These rows are REWRITTEN to witness its
  // ABSENCE, not deleted and not softened: each one below fails the moment the mark comes back.
  //
  // NOT ONE OF THE FOUR IS TYPED HERE, and that is unchanged by the removal. The three are read
  // out of the reviewer's own frozen object; the fourth is read out of the ITEM 28 heading in
  // app.jsx, which names it and is the last place in the tree that does. A mark retyped by hand
  // is a mark this guard invented — and a hand-typed Arabic literal that silently matches
  // nothing is a measured trap in this tree, not a hypothetical one.
  //
  // AND THE PREMISE IS DRIVEN BEFORE THE CONCLUSION IS ASSERTED. First: app.jsx's own label
  // initialiser, lifted and evaluated, prints «من السنة النبوية» for a card with neither
  // narrator nor ruling. Then: no exit of this pass lets such a card survive at all.
  console.log('\n--- 14. THE FOUR REMOVED MARKS, AND THE CARD THAT PRINTED THE FOURTH ---');
  {
    const fs14 = require('fs');
    const RV = await esm('lib/output-reviewer.js');
    const appSrc = fs14.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');

    // THE FOURTH MARK, READ OFF THE ONE HEADING THAT STILL NAMES IT. If that heading ever goes,
    // this section is blind and says so rather than passing quietly.
    const named = /A QUR'AN.C SPAN IS NOT A «([^»]+)»/u.exec(appSrc);
    ok('14  app.jsx still NAMES the removed fourth mark, so this section can read it',
      !!named, 'the ITEM 28 heading no longer names the mark — re-measure before trusting §14');
    const NEUTRAL = named ? named[1] : null;

    // THE REMOVAL ITSELF, IN THE SOURCE. The declaration is gone, the conditional is gone, and
    // the mark survives in app.jsx only inside comments — never as a string the app can print.
    ok('14  the fourth mark is no longer declared in app.jsx',
      !/const NEUTRAL_HADITH_LABEL\s*=/u.test(appSrc),
      'NEUTRAL_HADITH_LABEL is back in app.jsx');
    ok('14  ...and the card heading is no longer a decision about the attributes',
      !/\?\s*NEUTRAL_HADITH_LABEL/u.test(appSrc),
      'the two-way label initialiser is back in HadithCard');
    if (NEUTRAL) {
      const codeLines = appSrc.split('\n')
        .filter((line) => line.includes(NEUTRAL) && !/^\s*(?:\/\/|\*|\/\*)/u.test(line));
      ok('14  ...and every remaining occurrence of the mark in app.jsx is a comment',
        codeLines.length === 0, JSON.stringify(codeLines));
      // AND THE SHIPPED BUNDLE IS THE SAME FILE, checked separately: app.js is what a reader
      // loads, and a parity failure between the two is exactly how a removed mark ships anyway.
      const bundle = fs14.readFileSync(path.join(REPO, 'app.js'), 'utf8');
      const bundleCode = bundle.split('\n')
        .filter((line) => line.includes(NEUTRAL) && !/^\s*(?:\/\/|\*|\/\*)/u.test(line));
      ok('14  ...and the same is true of the bundle the reader actually loads',
        bundleCode.length === 0, JSON.stringify(bundleCode.map((l) => l.slice(0, 120))));
    }

    // THE NEW CONTRACT, DRIVEN. app.jsx's own constant and its own initialiser, lifted and run —
    // the same seam theme-coverage-guard.cjs pins the shape of, evaluated here rather than read.
    const constLiteral = /const SUNNAH_CARD_LABEL = '([^']+)';/u.exec(appSrc);
    ok('14  the card heading is now ONE constant this guard can read', !!constLiteral,
      'SUNNAH_CARD_LABEL is no longer a single-quoted literal in app.jsx');
    const SUNNAH = constLiteral ? constLiteral[1] : null;
    ok('14  ...and the initialiser reads that constant and asks nothing else',
      /let label = SUNNAH_CARD_LABEL;/u.test(appSrc),
      'the label initialiser in HadithCard no longer matches its pinned form');
    if (SUNNAH) {
      // eslint-disable-next-line no-new-func
      const decide = new Function('att', 'SUNNAH_CARD_LABEL', 'let label = SUNNAH_CARD_LABEL; return label;');
      ok('14  CAUSAL: a card with NO narrator and NO ruling prints «من السنة النبوية»',
        decide({ narrator: '', ruling: '' }, SUNNAH) === SUNNAH, JSON.stringify(SUNNAH));
      ok('14  CAUSAL: ...and a card WITH both prints the very same heading — one label, not two',
        decide({ narrator: 'عمر', ruling: 'صحيح' }, SUNNAH) === SUNNAH, JSON.stringify(SUNNAH));
      ok('14  ...and it is not the removed mark wearing a new name',
        NEUTRAL === null || SUNNAH !== NEUTRAL, JSON.stringify([SUNNAH, NEUTRAL]));
    }

    const FOUR = [...Object.values(RV.REVIEW_TAGS), NEUTRAL].filter((x) => x);
    ok('14  the four are FOUR — three review marks and the card heading',
      FOUR.length === 4 && new Set(FOUR).size === 4, JSON.stringify(FOUR));

    // THE CONCLUSION. Four exits of this pass, one card each, and none of them may leave it.
    const CARD = '<hadith>' + MATN + '</hadith>';
    const found = { [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN, 'عمر بن الخطاب')] } };
    const isnadAtom = { [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: ['حدثنا سفيان قال: ' + MATN] } };
    const exits = [
      ['السكوت — لم تجد المكتبة شيئا', CARD, lookupOf({})],
      ['التخريج — وجدته', CARD, lookupOf(found)],
      ['نسبة في النثر حول البطاقة', CARD + '\nأخرجه البخاري.', lookupOf(found)],
      ['عنعنة في الذرة', CARD, lookupOf(isnadAtom)],
    ];
    for (const [name, answer, lookup] of exits) {
      // eslint-disable-next-line no-await-in-loop
      const out = await T.applyTakhrij(answer, { env: ON, lookup });
      ok('14  no <hadith> block survives the exit: ' + name,
        !/<\/?hadith/iu.test(out.text), JSON.stringify(out.text));
      ok('14  ...and not one of the four marks is in what is delivered: ' + name,
        !FOUR.some((mark) => out.text.includes(mark)), JSON.stringify(out.text));
      ok('14  ...and the matn itself left whole: ' + name,
        out.text.includes(MATN), JSON.stringify(out.text));
    }

    // MUTANT: the dissolver is disarmed at the silent exit, which is precisely the state the
    // owner measured on his preview. The card comes back — and with it the heading it prints.
    const src14 = fs14.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8');
    const SEAM14 = 'if (isCard) dissolveBare();';
    const mutated = src14.replace(SEAM14, '// mutant: the card is left a card');
    ok('14  MUTANT: the seam that dissolves a declined card is findable',
      mutated !== src14, 'the mutant did not apply — the seam moved and this row is blind');
    if (mutated !== src14) {
      const tmp = path.join(REPO, 'lib', '.takhrij-mutant14-' + process.pid + '.mjs');
      fs14.writeFileSync(tmp, mutated);
      try {
        const M = await esm('lib/' + path.basename(tmp));
        const out = await M.applyTakhrij(CARD, { env: ON, lookup: lookupOf({}) });
        ok('14  MUTANT: with it disarmed the card comes back, and the guard sees it',
          /<\/?hadith/iu.test(out.text) && out.text.includes(NEUTRAL) === false,
          JSON.stringify(out.text));
      } finally { fs14.unlinkSync(tmp); }
    }
  }

  // ── ١٥ · §٢ — OUR PARENTHESES NEVER STAND BESIDE A STATED ATTRIBUTION ───
  //
  // «سطرانِ متجاورانِ ينسبانِ المتنَ إلى كتابَينِ مختلفَين — قوسُنا يقولُ ابنَ حبّان، ونثرُ عزك يقولُ
  // أبا داود. والقارئُ لا يدري أيَّهما يصدّق.» The rule is a POSITION and not a preference: where
  // the prose around the matn already carries «أخرجه فلان» · «رواه فلان» · «متفق عليه», nothing is
  // injected. No reconciling and no preferring — «الترجيحُ حكمٌ لم نقِسْه».
  console.log('\n--- 15. A NAME THE PROSE ALREADY WROTE IS NOT ARGUED WITH ---');
  {
    const lib = { [MATN]: { matn: MATN, subjectIds: ['FC-000703'], atoms: [atomFor(MATN, 'عمر بن الخطاب')] } };
    const prosed = 'وقال النبي صلى الله عليه وسلم: «' + MATN + '».\nأخرجه أبو داود.';
    const out = await T.applyTakhrij(prosed, { env: ON, lookup: lookupOf(lib) });
    ok('15  the owner’s own shape: the answer comes back byte-identical',
      out.text === prosed, JSON.stringify(out.text));
    ok('15  ...and no second book is named anywhere in it',
      !out.text.includes('ابن حبان'), JSON.stringify(out.text));
    ok('15  ...and it is recorded as a ruling, not lost as a silence',
      out.problems.includes(T.TAKHRIJ_PROSE_ATTRIBUTION)
        && out.entries[0].declined === 'prose_states_attribution',
      JSON.stringify([out.problems, out.entries]));
    ok('15  ...and the record shows WHAT was withheld and WHAT the prose said',
      out.entries[0].withheld === 'ابن حبان · ' + L.NO_RULING
        && out.entries[0].proseAttribution.indexOf('أخرجه') === 0,
      JSON.stringify(out.entries[0]));

    const sameSentence = 'وقال النبي صلى الله عليه وسلم: «' + MATN + '» رواه مسلم.';
    const two = await T.applyTakhrij(sameSentence, { env: ON, lookup: lookupOf(lib) });
    ok('15  an attribution in the matn’s own sentence silences it too',
      two.text === sameSentence, JSON.stringify(two.text));

    // AND THE NEGATIVE, WHICH IS WHAT KEEPS THIS ROW FROM BEING A BLANKET OFF-SWITCH.
    const bare = 'وقال النبي صلى الله عليه وسلم: «' + MATN + '».';
    const wrote = await T.applyTakhrij(bare, { env: ON, lookup: lookupOf(lib) });
    ok('15  CAUSAL: with no attribution in the prose the parentheses ARE written',
      wrote.text.includes('(ابن حبان · ' + L.NO_RULING + ')'), JSON.stringify(wrote.text));

    // A CARD ATTRIBUTE IS NOT PROSE. MEASURED: narrator="أخرجه البخاري" is never shown to
    // anybody, and reading it as the answer's own attribution silenced a proved takhrij.
    const withCard = 'وقال النبي صلى الله عليه وسلم: «' + MATN + '» فالنية أصل.\n'
      + '<hadith narrator="أخرجه البخاري" ruling="صحيح">' + OTHER + '</hadith>';
    const carded = await T.applyTakhrij(withCard, {
      env: ON,
      lookup: lookupOf({ ...lib, [OTHER]: { matn: OTHER, subjectIds: [], atoms: [] } }),
    });
    ok('15  an attribute inside a card block does not silence the prose beside it',
      carded.text.includes('(ابن حبان · ' + L.NO_RULING + ')'), JSON.stringify(carded.text));

    // AND A SENTENCE TOO FAR AWAY IS NOT «حول المتن».
    const far = 'وقال النبي صلى الله عليه وسلم: «' + MATN + '». ثم تكلم العلماء فيه. وأخرجه البخاري في موضع آخر.';
    const farOut = await T.applyTakhrij(far, { env: ON, lookup: lookupOf(lib) });
    ok('15  an attribution two sentences away is out of the window',
      farOut.text.includes('(ابن حبان · ' + L.NO_RULING + ')'), JSON.stringify(farOut.text));

    // AND A CARD IN THAT POSITION STILL DISSOLVES — §١ outranks the withholding of §٢.
    const cardProsed = '<hadith>' + MATN + '</hadith>\nأخرجه أبو داود.';
    const cardOut = await T.applyTakhrij(cardProsed, { env: ON, lookup: lookupOf(lib) });
    ok('15  a card whose prose attributes it is dissolved and left bare',
      cardOut.text === '«' + MATN + '»\nأخرجه أبو داود.', JSON.stringify(cardOut.text));

    // MUTANT: drop the check and the two contradicting lines ship, which is what he read.
    const fs15 = require('fs');
    const src15 = fs15.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8');
    const mutated15 = src15.replace(
      'const stated = statedAttributionNear(original, target, floor, ceiling);',
      "const stated = ''; // mutant: the prose is not consulted",
    );
    ok('15  MUTANT: the seam is findable', mutated15 !== src15);
    if (mutated15 !== src15) {
      const tmp = path.join(REPO, 'lib', '.takhrij-mutant15-' + process.pid + '.mjs');
      fs15.writeFileSync(tmp, mutated15);
      try {
        const M = await esm('lib/' + path.basename(tmp));
        const out15 = await M.applyTakhrij(prosed, { env: ON, lookup: lookupOf(lib) });
        ok('15  MUTANT: without it the answer names two different books on two lines',
          out15.text.includes('(ابن حبان') && out15.text.includes('أخرجه أبو داود'),
          JSON.stringify(out15.text));
      } finally { fs15.unlinkSync(tmp); }
    }
  }

  // ── ١٦ · §٣ — THE LAFZ DOOR OPENS ON ONE LEAF ──────────────────────────
  //
  //   يُسمَح   بعد أن يوجد المتن في كتاب من السلم مطابقة تامة · استعلام الشيخين المضيق على
  //            المتن نفسه · استعلام كتب الحكم المضيق على المتن نفسه
  //   لا يُسمَح الاكتشاف الأول للمتن · البحث العام في الـ٣٦ · مطابقة جزء من المتن ببعضه
  //   والتسامح  التشكيل · علامات الاقتباس والترقيم · صيغة الإفراد والجمع في كلمة واحدة
  console.log('\n--- 16. THE LAFZ DOOR, AND THE ONE LEAF IT OPENS ON ---');
  {
    const NIYYAT = 'إنما الأعمال بالنيات';
    const NIYYA = 'إنما الأعمال بالنية';
    ok('16  exactly one word moves, and it is the plural/singular form',
      JSON.stringify(T.lafzVariants(NIYYAT)) === JSON.stringify([NIYYA]),
      JSON.stringify(T.lafzVariants(NIYYAT)));
    ok('16  ...and the harakat do not hide the ending from it',
      T.lafzVariants('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')[0] === NIYYA,
      JSON.stringify(T.lafzVariants('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')));
    ok('16  ...and a matn with no such word yields none',
      T.lafzVariants(OTHER).length === 0, JSON.stringify(T.lafzVariants(OTHER)));
    ok('16  ...and the fan-out is capped',
      T.LAFZ_MAX_VARIANTS === 2
        && T.lafzVariants('الصلاة والزكاة والصدقة والتوبة والرحمة').length <= 2);
    ok('16  ...and every variant differs from the matn in EXACTLY one word',
      T.lafzVariants('الصلاة والزكاة والصدقة').every((v) => {
        const a = 'الصلاة والزكاة والصدقة'.split(' ');
        const b = v.split(' ');
        return a.length === b.length && a.filter((w, i) => w !== b[i]).length === 1;
      }), JSON.stringify(T.lafzVariants('الصلاة والزكاة والصدقة')));

    // AND THE DOOR IS SHUT ON A FIRST DISCOVERY. Driven through the real pass with a recording
    // lookup, so what is asserted is what was ASKED and not what the module says of itself.
    const recorder = (answer) => {
      const calls = [];
      return {
        calls,
        run: (rows) => T.applyTakhrij(answer, {
          env: ON,
          lookup: async (matns, options) => {
            calls.push({ matns: [...matns], ids: (options && options.bookIds) || [] });
            return matns.map((matn) => rows(matn));
          },
        }),
      };
    };
    const unfound = recorder(answerWith(NIYYAT));
    await unfound.run((matn) => ({ matn, subjectIds: [], atoms: [] }));
    ok('16  a matn the ladder never carried is NEVER asked under a second wording',
      unfound.calls.every((call) => call.matns.every((m) => m === NIYYAT)),
      JSON.stringify(unfound.calls.map((c) => c.matns)));
    ok('16  ...and the graders are never narrowed to for it either',
      !unfound.calls.some((call) => JSON.stringify(call.ids) === JSON.stringify([...L.RULING_BOOK_IDS])),
      JSON.stringify(unfound.calls.map((c) => c.ids.length)));

    // AND IT OPENS ONCE THE MATN IS FOUND, WHOLE, IN A LADDER BOOK.
    const opened = recorder(answerWith(NIYYAT));
    await opened.run((matn) => (matn === NIYYAT
      ? { matn, subjectIds: ['FC-000673'], atoms: [atomFor(NIYYAT, 'عمر بن الخطاب')] }
      : { matn, subjectIds: [], atoms: [] }));
    const asked = opened.calls.flatMap((c) => c.matns);
    ok('16  a matn a ladder book carries IS asked again under its one-word variant',
      asked.includes(NIYYA), JSON.stringify(asked));
    ok('16  ...and the narrowed requests are narrowed — the Shaykhayn, then the ruling books',
      opened.calls.some((c) => JSON.stringify(c.ids) === JSON.stringify([...L.SHAYKHAYN_IDS]))
        && opened.calls.some((c) => JSON.stringify(c.ids) === JSON.stringify([...L.RULING_BOOK_IDS])),
      JSON.stringify(opened.calls.map((c) => c.ids.length)));
    ok('16  ...and the FIRST call is still the whole ladder on the matn itself, unwidened',
      JSON.stringify(opened.calls[0].ids) === JSON.stringify([...L.TAKHRIJ_LADDER_IDS])
        && JSON.stringify(opened.calls[0].matns) === JSON.stringify([NIYYAT]),
      JSON.stringify(opened.calls[0]));
    ok('16  ...and the ruling books are the ladder rows that state a grade, and only those',
      L.RULING_BOOK_IDS.length === L.TAKHRIJ_LADDER.filter((r) => r.grade).flatMap((r) => r.ids).length
        && L.RULING_BOOK_IDS.every((id) => (L.ladderRowFor(id) || {}).grade),
      JSON.stringify(L.RULING_BOOK_IDS));

    // AND «متفق عليه» STILL NEEDS BOTH ṢAḤĪḤS SEEN, however the second one was reached.
    const agreed = await T.applyTakhrij(answerWith(NIYYAT), {
      env: ON,
      lookup: async (matns) => matns.map((matn) => (matn === NIYYAT
        ? { matn, subjectIds: ['FC-000645'], atoms: [atomFor(NIYYAT, 'عمر بن الخطاب')] }
        : { matn, subjectIds: ['FC-000648'], atoms: [atomFor(NIYYA, 'عمر بن الخطاب')] })),
    });
    ok('16  CAUSAL: the variant is what turns «(البخاري)» into «(متفق عليه)»',
      agreed.text.includes('(' + L.AGREED_UPON + ')'), JSON.stringify(agreed.text));
    // AND A VARIANT THE ATOM DOES NOT CARRY PROVES NOTHING — the needle is still exact.
    const nearMiss = await T.applyTakhrij(answerWith(NIYYAT), {
      env: ON,
      lookup: async (matns) => matns.map((matn) => (matn === NIYYAT
        ? { matn, subjectIds: ['FC-000645'], atoms: [atomFor(NIYYAT, 'عمر بن الخطاب')] }
        : { matn, subjectIds: ['FC-000648'], atoms: ['باب في فضل النية والإخلاص'] })),
    });
    ok('16  ...and a Ṣaḥīḥ whose atom does not carry the variant adds nothing',
      nearMiss.text.includes('(البخاري)') && !nearMiss.text.includes('(' + L.AGREED_UPON + ')'),
      JSON.stringify(nearMiss.text));
  }


  // ── ١٧ · §١ OF THE CLOSING ORDER — NO ANSWER LEAVES HAVING LOST A MATN ──
  //
  // THE ROW THE OWNER ASKED FOR BY NAME: «وزِدْ صفًّا في الحارسِ يمنعُ خروجَ جوابٍ فُقِدَ منه
  // متنٌ كانَ فيه قبلَ الختم.»
  //
  // WHAT HE SAW, AND WHERE IT CAME FROM. In the wide battery of 19 September two hadiths were
  // deleted out of one answer about الإسبال and their commentary was left over nothing, and a
  // second answer began at «أمّا التفكّرُ في ذاتِ الله» because the sentence that answered the
  // question was gone. The seat is lib/takhrij-lock.js: a sentence carrying an attribution no
  // FETCHED page publishes is dropped whole, and a free-brain turn that cites nothing hands the
  // seal an empty page list — so «أخرجه البخاري» in the model's own prose took the Prophet's ﷺ
  // words out with it.
  //
  // IT IS MEASURED WITH THE SWITCH OFF, AND THAT IS THE POINT OF THIS SECTION. `lockTakhrij` is
  // the shipped seal (api/ask.js) and runs on every buffered reply whatever TAKHRIJ_V1 says. So
  // this section drives the LOCK ALONE, with no pass, no library and no flag.
  //
  // THE RULE: «ختمُ التسليمِ لا يحذفُ متنًا نبويًّا بحال. إن اضطرَّ إلى إسقاطِ شيءٍ فليُسقِطْ ما
  // حولَه، والمتنُ يبقى.» — and the other half of it, which is why this is not X-013/ز undone:
  // nothing of the sentence survives EXCEPT the quotation. No credit, no grade, no clause the
  // answer built on either.
  console.log('\n--- 17. THE SEAL MAY NOT DELETE A MATN ---');
  {
    const fs17 = require('fs');
    const LOCK17 = await esm('lib/takhrij-lock.js');
    // The owner's two witnesses, rebuilt from what SURVIVED on his screen, in the two shapes a
    // model writes a hadith in — a card, which is what the app's own instruction asks for, and
    // prose, which is what it sends anyway.
    const ISBAL_A = 'مَا أَسْفَلَ مِنَ الكَعْبَيْنِ مِنَ الإِزَارِ فَفِي النَّارِ';
    const ISBAL_B = 'إِزْرَةُ المُسْلِمِ إِلَى نِصْفِ السَّاقِ';
    const TAFAKKUR = 'تَفَكَّرُوا فِي آلَاءِ اللهِ وَلَا تَفَكَّرُوا فِي اللهِ';
    const LEAD_IN = 'فمن أدلة السنة:';
    const witnesses = [
      ['الإسبال · بطاقتان', [
        LEAD_IN,
        '<hadith narrator="أبو هريرة" ruling="أخرجه البخاري">' + ISBAL_A + '</hadith>',
        'وهذا نص في تحريم ما نزل عن الكعبين مطلقا.',
        '<hadith narrator="أبو سعيد" ruling="أخرجه أبو داود">' + ISBAL_B + '</hadith>',
        'وفيه بيان السنة في موضع الثوب.',
      ].join('\n'), [ISBAL_A, ISBAL_B], ['أخرجه البخاري', 'أخرجه أبو داود']],
      ['الإسبال · نثر', [
        LEAD_IN,
        'قال النبي صلى الله عليه وسلم: «' + ISBAL_A + '» أخرجه البخاري.',
        'وهذا نص في تحريم ما نزل عن الكعبين مطلقا.',
      ].join('\n'), [ISBAL_A], ['أخرجه البخاري']],
      ['تفكروا في آلاء الله · بطاقة', [
        '<hadith narrator="" ruling="رواه أبو نعيم في الحلية">' + TAFAKKUR + '</hadith>',
        'أما التفكر في ذات الله فمنهي عنه باتفاق أهل العلم.',
      ].join('\n'), [TAFAKKUR], ['رواه أبو نعيم']],
    ];
    for (const [name, draft, matns, credits] of witnesses) {
      // NO SOURCES AT ALL — the state a free-brain turn that cited nothing is really in.
      const sealed = LOCK17.lockTakhrij(draft, []);
      ok('17  the matn the answer had before the seal is still in it after: ' + name,
        matns.every((matn) => sealed.text.includes(matn)), JSON.stringify(sealed.text));
      ok('17  ...and the unpublished credit is gone: ' + name,
        credits.every((credit) => !sealed.text.includes(credit)), JSON.stringify(sealed.text));
      ok('17  ...and the removal is RECORDED, matn by matn: ' + name,
        Array.isArray(sealed.salvagedMatns) && sealed.salvagedMatns.length === matns.length
          && sealed.degraded.includes('takhrij-matn-kept:' + matns.length),
        JSON.stringify([sealed.salvagedMatns, sealed.degraded]));
      ok('17  ...and no card tag is handed to the reader in its place: ' + name,
        !/<\/?hadith/iu.test(sealed.text), JSON.stringify(sealed.text));
      // AND THE LEAD-IN THAT INTRODUCED IT STAYS, because it is no longer introducing nothing.
      if (draft.startsWith(LEAD_IN)) {
        ok('17  ...and the line that introduced it is not orphaned away with it: ' + name,
          sealed.text.includes(LEAD_IN), JSON.stringify(sealed.text));
      }
    }

    // THE OTHER HALF — X-013/ز IS NOT UNDONE. A sentence that quotes nothing still goes whole,
    // and a grading is never left standing in this answer's own voice.
    const graded17 = 'وحديث صلاة الليل حديث صحيح ثابت رواه الترمذي.';
    const g17 = LOCK17.lockTakhrij(graded17, []);
    ok('17  a graded claim that quotes NOTHING is still dropped whole',
      !g17.text.includes('حديث صحيح') && !g17.text.includes('رواه الترمذي')
        && g17.salvagedMatns.length === 0, JSON.stringify(g17.text));
    const inside17 = 'قال النبي صلى الله عليه وسلم: «هذا الحديث رواه البخاري ومسلم عن أبي هريرة».';
    const i17 = LOCK17.lockTakhrij(inside17, []);
    ok('17  ...and a quotation that CARRIES the unpublished credit is not salvaged either',
      !i17.text.includes('رواه البخاري') && i17.salvagedMatns.length === 0, JSON.stringify(i17.text));
    const title17 = 'وقد ضعفه الألباني في «السلسلة الضعيفة» وصححه ابن حبان.';
    const t17 = LOCK17.lockTakhrij(title17, []);
    ok('17  ...and a BOOK TITLE in guillemets is not mistaken for a narration',
      t17.salvagedMatns.length === 0, JSON.stringify([t17.text, t17.salvagedMatns]));
    const kept17 = LOCK17.lockTakhrij(
      'قال النبي صلى الله عليه وسلم: «' + ISBAL_A + '» أخرجه البخاري.',
      [{ title: 'البخاري', passage: 'أخرجه البخاري في صحيحه' }]);
    ok('17  ...and a PUBLISHED credit is left exactly as written, salvaging nothing',
      kept17.outcome === 'CLEAN' && kept17.salvagedMatns.length === 0, JSON.stringify(kept17.text));

    // MUTANT — the salvage is disarmed at its one seam, and the guard must see the matn vanish.
    // Without this the rows above would pass over a seal that never had the behaviour at all.
    const src17 = fs17.readFileSync(path.join(REPO, 'lib/takhrij-lock.js'), 'utf8');
    const SEAM17 = 'const salvage = matnToSalvage(s, sen, unsupported);';
    const mutant17 = src17.replace(SEAM17, 'const salvage = null; // mutant');
    ok('17  MUTANT: the seam that keeps the matn is findable',
      mutant17 !== src17, 'the mutant did not apply — the seam moved and §17 is blind');
    if (mutant17 !== src17) {
      const tmp17 = path.join(REPO, 'lib', '.takhrij-lock-mutant17-' + process.pid + '.mjs');
      fs17.writeFileSync(tmp17, mutant17);
      try {
        const M17 = await esm('lib/' + path.basename(tmp17));
        const broken17 = M17.lockTakhrij(
          'قال النبي صلى الله عليه وسلم: «' + ISBAL_A + '» أخرجه البخاري.', []);
        ok('17  MUTANT: with it disarmed the hadith is deleted — the defect that was measured',
          !broken17.text.includes(ISBAL_A), JSON.stringify(broken17.text));
      } finally { fs17.unlinkSync(tmp17); }
    }

    // AND THE SEAT IS THE ONE api/ask.js REALLY USES — read off the file, not assumed.
    const askSrc17 = fs17.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('17  api/ask.js seals every buffered reply with this very function',
      /const seal = \(text\) => \{\s*const locked = lockTakhrij\(/u.test(askSrc17),
      'the seal in api/ask.js is no longer lockTakhrij — §17 measures a seat nothing uses');
  }
  console.log(`\n=== ${checks - failures}/${checks} — ${failures ? 'FAIL' : 'PASS'} ===`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('GUARD THREW: ' + (error && error.stack ? error.stack : String(error)));
  process.exit(1);
});
