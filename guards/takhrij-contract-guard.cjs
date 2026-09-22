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
/** ١٩ — the same import, for a file written outside the repository tree. */
const esm19 = (abs) => import('file:///' + abs.replace(/\\/g, '/'));

// The matn every fixture quotes, and an atom that really carries it with a Companion in
// front of it. Built here rather than pasted, so no harakat sequence is typed by hand.
const MATN = 'إنما الأعمال بالنيات';
const OTHER = 'المسلم من سلم المسلمون من لسانه ويده';
const atomFor = (matn, companion) => `حدثنا سفيان عن ${companion} رضي الله عنه قال: ${matn}`;
// A SILSILA ATOM IS AN ENTRY, NOT A NARRATION. In ezik-shamela-20260820 an entry of the two
// Silsilas opens with its number and its matn («36 - حب الوطن من الإيمان…»), and the second order
// of item 111 (step 8) lets their title grade only such an entry. Fixtures that hand a Silsila an
// isnad-shaped atom now hand it the shape the index holds; what each row asserts is unchanged.
const SILSILA_ENTRY_IDS = new Set(['FC-002060', 'FC-002061']);
// BATCH 4 [b34] — AND AN ENTRY WRITES ITS RULING. A grade is now the ruling word the entry writes
// right after its matn («" حب الوطن من الإيمان ". موضوع.»، ««…» . (صحيح)»), never the book's title,
// so a fixture that stood the title in for the ruling hands the grader the entry the index holds:
// السلسلة الضعيفة writes «ضعيف», السلسلة الصحيحة «صحيح»; a list grader (صحيح الجامع، ضعيف الجامع) writes
// its ruling in brackets after the matn in «». What each row asserts is unchanged.
const rulingAtomFor = (matn, ruling) => '3913 - «' + matn + '» . (' + ruling + ') [حم] عن أنس.';
const SILSILA_RULING = { 'FC-002060': 'صحيح', 'FC-002061': 'ضعيف' };
const LIST_RULING = { 'FC-000788': 'صحيح', 'FC-000791': 'ضعيف' };
const shapedAtomFor = (id, matn, companion) => (SILSILA_ENTRY_IDS.has(id) ? '36 - " ' + matn + ' ". ' + SILSILA_RULING[id] + '. رواه ابن عدي.'
  : LIST_RULING[id] ? rulingAtomFor(matn, LIST_RULING[id]) : atomFor(matn, companion));

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
        // BATCH 4 [b34] — صحيح الجامع's entry writes «(صحيح)»; its title no longer grades.
        [MATN]: { matn: MATN, subjectIds: ['FC-000658', 'FC-000788'], atoms: [atomFor(MATN, 'عمر'), rulingAtomFor(MATN, 'صحيح')] },
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
          // BATCH 4 [b34] — both entries write their ruling, so the split is a split of written rulings.
          atoms: [shapedAtomFor('FC-002060', MATN, 'عمر'), rulingAtomFor(MATN, 'ضعيف')],
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
    // ١١١/٤ — ONE CALL PER ṢAḤĪH, TEN ROWS EACH. This row read «one extra call, narrowed to
    // the two Ṣaḥīḥs», and that narrowing left the same crowding running between those two:
    // measured on the live index, «الصلاة على وقتها» asked of both together returns ten rows
    // of which ZERO carry the matn, and asked of البخاري alone returns five of which TWO do. So
    // the row states the contract that replaced it — and the thing it was really protecting,
    // that this is one extra call FOR THE ANSWER and not one per hadith, is still asserted, by
    // the matn list going down whole in each.
    ok('8b  ...in one narrowed call PER Ṣaḥīḥ, each naming a single book',
      seen.length === 1 + L.SHAYKHAYN_IDS.length
        && seen.slice(1).every((one) => one.bookIds.length === 1)
        && L.SHAYKHAYN_IDS.every((id) => seen.slice(1).some((one) => one.bookIds[0] === id)),
      JSON.stringify(seen.map((one) => one.bookIds)));
    ok('8b  ...and each narrowed call carries ALL the matns, not one call per hadith',
      seen.slice(1).every((one) => JSON.stringify(one.matns) === JSON.stringify(seen[1].matns)),
      JSON.stringify(seen.map((one) => one.matns.length)));
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
      counted.length === 1 + L.SHAYKHAYN_IDS.length
        && counted.slice(1).every((c) => c.length === 1),
      JSON.stringify(counted.map((c) => c.length)));

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
      heads.length === 1 + L.SHAYKHAYN_IDS.length
        && heads.slice(1).every((h) => h.length === 1),
      JSON.stringify(heads.map((h) => h.length)));
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
    // BATCH 4 [b34] — the composer reads WRITTEN rulings (by id), no longer the row's title.
    const split = L.composeParenthetical(['FC-002060', 'FC-000791'], { 'FC-002060': ['صحيح'], 'FC-000791': ['ضعيف'] });
    ok('8c  two graders that disagree produce no grade, no مخرِّج and no text at all',
      split.grade === null && split.sourced === false && split.silent === true && split.text === '',
      JSON.stringify(split.text));
    ok('8c  CAUSAL: one grader alone still states its own ruling',
      L.composeParenthetical(['FC-000791'], { 'FC-000791': ['ضعيف'] }).grade === 'ضعيف');
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
      L.composeParenthetical(['FC-000658', 'FC-000788'], { 'FC-000788': ['صحيح'] }).text === 'الترمذي · صحيح'
      && L.composeParenthetical(['FC-000658', 'FC-000788'], { 'FC-000788': ['صحيح'] }).ruled === true);
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
      // BATCH 4 [b34] — ضعيف الجامع's entry writes «(ضعيف)».
      lookup: lookupOf({ [CARRIED]: { matn: CARRIED, subjectIds: ['FC-000791'], atoms: [rulingAtomFor(CARRIED, 'ضعيف')] } }),
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

    // ── ١١١ SECOND ORDER, STEP 1 — THE SEAT KEEPS WHAT THE SEAL KEPT ──────────
    // MEASURED 21 September 2026 on the twin, in three of four shapes (T14 T23 T25): the seal kept
    // «(متفق عليه)» over these rows, and lib/finalize-reader-text.js — locking a second time over
    // `sources` alone — deleted the sentence and salvaged the matn bare. The seat is now handed the
    // same rows as `takhrijProven`, for its lock and nothing else. This row falls the moment the
    // finalizer deletes a parenthetical the pass proved.
    const FIN = await esm('lib/finalize-reader-text.js');
    const askRows = agreedRun.entries.flatMap((entry) => entry.sealProof.map((book) => (
      { title: book, passage: book + ' ' + String(entry.matn || '') })));
    const sealedAgreed = LOCK.lockTakhrij(agreedRun.text, askRows).text;
    const seat1 = (text, extra) => FIN.finalizeReaderText({ kind: 'answer', text, sources: [], ...extra }).text;
    ok('111-S1 the seal keeps the proven «(متفق عليه)» over the rows api/ask.js builds',
      sealedAgreed === agreedRun.text, JSON.stringify(sealedAgreed));
    ok('111-S1 the finalizer handed the same rows keeps it too — parenthetical, frame and matn',
      seat1(sealedAgreed, { takhrijProven: askRows }) === sealedAgreed,
      JSON.stringify(seat1(sealedAgreed, { takhrijProven: askRows })));
    ok('111-S1 CAUSAL: without the rows the finalizer deletes the parenthetical the pass proved',
      !seat1(sealedAgreed).includes('(' + L.AGREED_UPON + ')'), JSON.stringify(seat1(sealedAgreed)));
    const modelAgreed = sealedAgreed + '\nقال رسول الله صلى الله عليه وسلم: «لا يدخل الجنة قتات» (متفق عليه).';
    const seatedBoth = seat1(modelAgreed, { takhrijProven: askRows });
    ok('111-S1 ...a «(متفق عليه)» the MODEL wrote over another matn still goes, the proven one stays',
      seatedBoth.includes(sealedAgreed.trim()) && seatedBoth.split('(' + L.AGREED_UPON + ')').length === 2,
      JSON.stringify(seatedBoth));
    ok('111-S1 api/ask.js hands the proven rows to the finalizer as `takhrijProven`, not as `sources`',
      askSrc.includes('takhrijProven: takhrijProvenRows,'), 'the finalizer context does not carry them');
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
      [MATN]: { matn: MATN, subjectIds: ids, atoms: ids.map((id) => shapedAtomFor(id, MATN, 'عمر')) },
    });

    // (أ) THE COMPOSER, OVER EVERY SUBSET OF THE LADDER THAT IS WORTH ASKING ABOUT.
    // Each row alone, and each row paired with every other: the denial must never appear
    // without `ruledBy` naming a grader whose own stated ruling is one of NOT_ESTABLISHED_GRADES.
    const offenders = [];
    const ladderIds = L.TAKHRIJ_LADDER.map((row) => row.ids[0]);
    for (let i = 0; i < ladderIds.length; i += 1) {
      for (let j = i; j < ladderIds.length; j += 1) {
        const ids = i === j ? [ladderIds[i]] : [ladderIds[i], ladderIds[j]];
        // BATCH 4 [b34] — each grader is handed the ruling its title states AS IF its entry wrote
        // it, so the denial door is still exercised over every subset; nothing else is handed.
        const written = {};
        for (const id of ids) { const row = L.ladderRowFor(id); if (row && row.grader && row.grade) written[id] = [row.grade]; }
        const built = L.composeParenthetical(ids, written);
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
    // ١١١/٤ — the Ṣaḥīḥayn request is now one call per book; the graders are still asked
    // together, because splitting them was measured and bought nothing.
    ok('16  ...and the narrowed requests are narrowed — each Shaykh alone, then the graders',
      L.SHAYKHAYN_IDS.every((id) => opened.calls.some((c) => JSON.stringify(c.ids) === JSON.stringify([id])))
        && opened.calls.some((c) => JSON.stringify(c.ids) === JSON.stringify([...L.RULING_BOOK_IDS])),
      JSON.stringify(opened.calls.map((c) => c.ids)));
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
      // BATCH 4 [b26] — a credit trailing a quotation in prose is now cut ALONE, so that matn never
      // leaves its sentence and there is nothing to salvage: the record is the credit-only cut. A
      // card's credit lives in its attributes and is still salvaged matn by matn.
      const creditOnly17 = !/<hadith/iu.test(draft);
      ok('17  ...and the removal is RECORDED, matn by matn: ' + name,
        creditOnly17
          ? sealed.degraded.includes('takhrij-credit-only:' + matns.length)
          : Array.isArray(sealed.salvagedMatns) && sealed.salvagedMatns.length === matns.length
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
    const SEAM17 = 'const salvage = matnToSalvage(s, sen, unsupported, { framed: true });';
    const mutant17 = src17.replace(SEAM17, 'const salvage = null; // mutant');
    ok('17  MUTANT: the seam that keeps the matn is findable',
      mutant17 !== src17, 'the mutant did not apply — the seam moved and §17 is blind');
    if (mutant17 !== src17) {
      const tmp17 = path.join(REPO, 'lib', '.takhrij-lock-mutant17-' + process.pid + '.mjs');
      fs17.writeFileSync(tmp17, mutant17);
      try {
        const M17 = await esm('lib/' + path.basename(tmp17));
        // BATCH 4 [b26] — a trailing credit is cut alone before the salvage is asked, so the
        // mutant is driven with a credit that does NOT stand apart (a narrator and a chapter follow
        // it), which the salvage alone keeps the matn from. [b12] — a trailing «، صححه الألباني» is
        // now a credit cut alone as well, so it could no longer be that witness.
        const broken17 = M17.lockTakhrij(
          'قال النبي صلى الله عليه وسلم: «' + ISBAL_A + '» رواه البخاري عن ابن عمر في كتاب اللباس.', []);
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

  // ── ١٨ · فقرةٌ كتبَها الجوابُ مرّةً لا تُكتَبُ مرّتَين ────────────────────
  //
  // MEASURED, turn F14 of EZIK-RAW-CORPUS-2026-08-19.jsonl driven on this tree: two rounds,
  // no stream, `end_turn`; round two was round one word for word with ONE «[1]» added, the
  // whitespace fold made neither contain the other, and `joinRoundTexts` wrote 533 characters
  // twice — a paragraph and two cards, delivered to the reader a second time.
  //
  // THE WITNESS IS BUILT HERE AND NOT READ FROM THE CORPUS. The corpus lives outside the
  // repository; a guard that needs it is a guard that is skipped on a fresh clone. What is
  // reproduced is its SHAPE, which is the whole of the defect: one part, and that part again
  // with a citation marker in it.
  {
    const FB18 = await esm('lib/free-brain/loop.js');
    const fs18 = require('fs');
    const fold18 = (v) => String(v).replace(/\s+/gu, ' ').trim();
    const longestRepeat18 = (text) => {
      const f = fold18(text);
      const twice = (len) => {
        if (len <= 0) return '';
        const seen = new Set();
        for (let i = 0; i + len <= f.length; i += 1) {
          const k = f.slice(i, i + len);
          if (seen.has(k)) return k;
          seen.add(k);
        }
        return '';
      };
      let lo = 1; let hi = Math.floor(f.length / 2); let best = '';
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const hit = twice(mid);
        if (hit) { best = hit; lo = mid + 1; } else hi = mid - 1;
      }
      return best;
    };
    const ROUND_A = [
      'الأضحية سنة وليست واجبة، وتُجزئُ الشاةُ الواحدةُ عن الرجل وأهل بيته إذا جمعهم بيتٌ واحد.',
      'أمّا إن كان الابنُ مستقلاً في بيتٍ آخرَ عن أبيه فلا تُجزئُه أضحيةُ والده، بل يُشرَعُ له أن يضحّي عن نفسه.',
    ].join(' ');
    // The same round again, with ONE citation marker added mid-paragraph. Nothing else moves.
    const ROUND_B = ROUND_A.replace('بيتٌ واحد.', 'بيتٌ واحد [1].');
    ok('18  the witness really is one part and that part again with a marker',
      ROUND_B !== ROUND_A && ROUND_B.length > ROUND_A.length,
      'the citation marker did not land — §18 is measuring nothing');

    const joined18 = FB18.joinRoundTexts([ROUND_A, ROUND_B]);
    const repeat18 = longestRepeat18(joined18);
    ok('18  a round that restates another modulo one citation marker is not shipped twice',
      repeat18.length < 60, 'longest run written twice: ' + repeat18.length + ' chars — ' + JSON.stringify(repeat18.slice(0, 80)));
    ok('18  ...and the part that CARRIES the citation is the one that survives',
      fold18(joined18) === fold18(ROUND_B), JSON.stringify(joined18.slice(0, 120)));
    ok('18  ...and the pinned join agrees, except that it keeps its head',
      longestRepeat18(FB18.joinRoundTextsHeadPinned([ROUND_B, ROUND_A])).length < 60,
      JSON.stringify(FB18.joinRoundTextsHeadPinned([ROUND_B, ROUND_A]).slice(0, 120)));

    // ── AND THE DROP IS A CONTAINMENT, NOT A RESEMBLANCE ───────────────────
    // The negative gate the order names by name: two DIFFERENT paragraphs that open alike are
    // both the reader’s, and a rule that deletes one of them is worse than the repetition.
    const NEAR_A = 'الصلاةُ ركنٌ من أركانِ الإسلام، وهي أوّلُ ما يُحاسَبُ عليه العبدُ يومَ القيامة.';
    const NEAR_B = 'الصلاةُ ركنٌ من أركانِ الإسلام، وتجبُ على كلِّ مسلمٍ بالغٍ عاقل، ولا تسقطُ بحال.';
    const near18 = FB18.joinRoundTexts([NEAR_A, NEAR_B]);
    ok('18  two different paragraphs that open alike are BOTH delivered',
      near18.includes(NEAR_A) && near18.includes(NEAR_B), JSON.stringify(near18));
    ok('18  ...and an exact repeat is still dropped, as it always was',
      FB18.joinRoundTexts([NEAR_A, NEAR_A]) === NEAR_A);
    ok('18  ...and a part that folds away to markers alone is not swallowed',
      FB18.joinRoundTexts([NEAR_A, '[1] [2]']).includes('[1] [2]'));

    // MUTANT — the fold is put back to whitespace alone, and the duplicate must return. Without
    // this the rows above would pass over a join that never had the behaviour at all.
    const loopPath18 = path.join(REPO, 'lib/free-brain/loop.js');
    const src18 = fs18.readFileSync(loopPath18, 'utf8');
    const SEAM18 = 'const fold = (value) => restateKey(value) || value.replace(';
    ok('18  MUTANT: the fold seam is findable', src18.includes(SEAM18),
      'the seam moved — §18 is blind and the duplicate can come back unseen');
    if (src18.includes(SEAM18)) {
      const mutant18 = src18.split(SEAM18).join('const fold = (value) => String(value).replace(');
      const tmp18 = path.join(REPO, 'lib', 'free-brain', '.loop-mutant18-' + process.pid + '.mjs');
      fs18.writeFileSync(tmp18, mutant18);
      try {
        const M18 = await esm('lib/free-brain/' + path.basename(tmp18));
        const broken18 = longestRepeat18(M18.joinRoundTexts([ROUND_A, ROUND_B]));
        ok('18  MUTANT: with the old fold the paragraph is written twice — the measured defect',
          broken18.length >= 60, 'the mutant shipped only ' + broken18.length + ' repeated chars');
      } finally { fs18.unlinkSync(tmp18); }
    }
  }

  // ── ١٩ · متنٌ يسقُطُ بالسقفِ يتركُ أثرًا، والجولةُ المبثوثةُ تقولُ ذلك ────────
  //
  // THREE EXITS OF THIS PASS WRITE NOTHING TO THE READER. Two of them said so —
  // `TAKHRIJ_SILENT` and `TAKHRIJ_UNSOURCED` — and the third, the matn cap, said nothing at
  // all: `targets.slice(0, TAKHRIJ_MAX_MATNS)` dropped the fifth matn of an answer with no
  // entry, no problem code and no line of trace. A reader who asked for six hadiths and was
  // given four takhrij could not be told apart from a reader whose library went quiet, and a
  // deliberate ruling nobody can see is indistinguishable from a bug.
  //
  // THE ROWS BELOW ASSERT THE RECORD AND, IN THE SAME BREATH, THAT IT COST NO BEHAVIOUR:
  // the text this pass ships is compared byte for byte against the SAME INPUTS run through
  // the same module with the records removed.
  {
    const fs19 = require('fs');
    const os19 = require('os');
    const T19 = await esm('lib/takhrij.js');
    const L19 = await esm('lib/takhrij-ladder.js');
    // ١١١/٥ — THE WITNESS IS BUILT FROM THE CAP, NOT FROM A NUMBER. A fixture written with six
    // matns stopped exceeding the cap the moment the cap became six, and §19 passed while
    // measuring nothing. The answer now always holds TWO more matns than the cap examines,
    // whatever the cap is, so the next round that moves it cannot blind this section.
    const POOL19 = [
      'انما الاعمال بالنيات وانما لكل امرئ ما نوى',
      'من غشنا فليس منا وهو حديث مشهور بين اهل العلم',
      'المسلم من سلم المسلمون من لسانه ويده في كل حال',
      'لا ضرر ولا ضرار في الاسلام على احد من الناس',
      'الصلاة على وقتها ثم بر الوالدين ثم الجهاد في سبيل الله',
      'الدين النصيحة قلنا لمن قال لله ولكتابه ولرسوله',
    ];
    const NEED19 = T19.TAKHRIJ_MAX_MATNS + 2;
    const MATNS19 = Array.from({ length: NEED19 }, (_unused, i19) => POOL19[i19 % POOL19.length]
      + (i19 < POOL19.length ? '' : ' وهذا لفظ آخر رقم ' + String(i19 + 1)));
    const ANSWER19 = MATNS19.map((m, i) => 'الوجه ' + (i + 1)
      + ': قال النبي صلى الله عليه وسلم: «' + m + '» وهذا أصل في الباب.').join('\n');
    const silent19 = async (matns) => matns.map((m) => ({ matn: m, subjectIds: [], atoms: [] }));
    const loud19 = async (matns, options) => matns.map((m) => {
      const ids = (options && options.bookIds) || L19.TAKHRIJ_LADDER_IDS;
      const use = ids.filter((id) => L19.SHAYKHAYN_IDS.includes(id));
      return {
        matn: m,
        subjectIds: use,
        atoms: use.map(() => 'عن ابي هريرة رضي الله عنه قال قال رسول الله صلى الله عليه وسلم ' + m),
      };
    });

    ok('19  precondition: the answer really holds more matns than the cap examines',
      T19.findTargets(ANSWER19).targets.length > T19.TAKHRIJ_MAX_MATNS,
      String(T19.findTargets(ANSWER19).targets.length) + ' vs cap ' + String(T19.TAKHRIJ_MAX_MATNS));

    for (const [name19, lookup19] of [['silent', silent19], ['loud', loud19]]) {
      const pass19 = await T19.applyTakhrij(ANSWER19, { env: ON, lookup: lookup19 });
      const tr19 = pass19.trace;
      ok('19  [' + name19 + '] the pass counts itself: found/examined/dropped/emitted',
        !!tr19 && [tr19.found, tr19.examined, tr19.dropped, tr19.emitted]
          .every((v) => Number.isInteger(v)), JSON.stringify(tr19));
      ok('19  [' + name19 + '] and the counts are the measurement, not a shape',
        tr19.found === MATNS19.length && tr19.examined === T19.TAKHRIJ_MAX_MATNS
          && tr19.dropped === MATNS19.length - T19.TAKHRIJ_MAX_MATNS, JSON.stringify(tr19));
      ok('19  [' + name19 + '] the cap names itself in `problems`',
        pass19.problems.includes(T19.TAKHRIJ_CAP_REACHED), JSON.stringify(pass19.problems));
      const over19 = pass19.entries.filter((e) => e.declined === 'over_matn_cap');
      ok('19  [' + name19 + '] every matn the cap dropped leaves an entry of its own',
        over19.length === MATNS19.length - T19.TAKHRIJ_MAX_MATNS,
        String(over19.length));
      ok('19  [' + name19 + '] ...and a dropped matn claims no source and wears no parentheses',
        over19.every((e) => e.parenthetical === '' && e.sourced === false && e.rewritten === false),
        JSON.stringify(over19));
      // THE RECORD IS COUNTS AND CODES. No question text, and nothing derived from one.
      ok('19  [' + name19 + '] the trace is four numbers and holds no text at all',
        Object.values(tr19).every((v) => typeof v === 'number'), JSON.stringify(tr19));
    }

    // ── AND IT COST NO BEHAVIOUR, PROVED AGAINST THE MODULE WITH THE RECORDS REMOVED ──
    // Not «the text looks the same»: the same module, with the two record-writing lines taken
    // out, driven on the same inputs, and the two outputs compared byte for byte.
    {
      const src19 = fs19.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8');
      const SEAM19 = '  if (overCap.length) {';
      ok('19  MUTANT: the seam that writes the record is findable', src19.includes(SEAM19),
        'the seam moved — §19 is blind and the cap can go silent again unseen');
      const noRecord = src19.replace(SEAM19, '  if (false) { // mutant');
      const dir19 = fs19.mkdtempSync(path.join(os19.tmpdir(), 'ustaz-n111-19-'));
      const file19 = path.join(dir19, 'takhrij-norecord.mjs');
      fs19.writeFileSync(file19, noRecord.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///'
          + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q));
      try {
        const M19 = await esm19(file19);
        const broken = await M19.applyTakhrij(ANSWER19, { env: ON, lookup: loud19 });
        ok('19  MUTANT: with the record removed the cap goes silent again — the measured defect',
          !broken.problems.includes('TAKHRIJ_CAP_REACHED')
            && broken.entries.every((e) => e.declined !== 'over_matn_cap'),
          JSON.stringify(broken.problems));
        // AND THE TEXT IS THE SAME EITHER WAY. This is the row that says the traces are free.
        const live = await T19.applyTakhrij(ANSWER19, { env: ON, lookup: loud19 });
        ok('19  the shipped text is byte-identical with the records and without them',
          live.text === broken.text, JSON.stringify([live.text.length, broken.text.length]));
        const liveS = await T19.applyTakhrij(ANSWER19, { env: ON, lookup: silent19 });
        const brokeS = await M19.applyTakhrij(ANSWER19, { env: ON, lookup: silent19 });
        ok('19  ...and on the silent path too', liveS.text === brokeS.text);
      } finally { try { fs19.rmSync(dir19, { recursive: true, force: true }); } catch { /* temp */ } }
    }

    // ── AND THE MODULE STILL HAS NO LOGGER OF ITS OWN ────────────────────
    // The counts ride back on the return value; the seat that already prints `[takhrij]` prints
    // them. That is what keeps this module drivable by a guard with no logger in the process.
    {
      const code19 = fs19.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8')
        .split(/\r?\n/u).filter((line) => !/^\s*(\/\/|\*|\/\*)/u.test(line)).join('\n');
      ok('19  lib/takhrij.js writes no log line of its own', !/console\s*\./u.test(code19));
      const ask19 = fs19.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
      ok('19  the four counts reach the seat that prints [takhrij]',
        ask19.includes('...(pass.trace || {}),'));
      ok('19  a streamed turn records the takhrij\'s OWN stand-down code',
        ask19.includes("out.degraded.push('takhrij:' + TAKHRIJ_SKIPPED_STREAMED);")
          && ask19.includes("import { takhrijDecision, TAKHRIJ_SKIPPED_STREAMED }"));
      // AND THE BORROWED NAME IS NOT REPLACED: three guards read `inside_emitted_bytes`.
      ok('19  ...and the ascription door\'s borrowed name is still beside it',
        ask19.includes("out.degraded.push('takhrij:inside_emitted_bytes');"));
    }
  }

  // ── ٢٠ · الطلبُ المضيَّقُ يحملُ معرِّفَ كتابٍ واحد ──────────────────────────
  //
  // Phase two exists because ten globally-best rows are not ten rows per book. Narrowing to the
  // two Ṣaḥīḥs TOGETHER left the same contest running between those two, and the measured cost
  // was a reader told nothing about a hadith البخاري publishes. ١١١/٤ splits it.
  //
  // THE ROWS BELOW DRIVE THE REAL PASS WITH A FIXTURE LIBRARY that answers a narrowed request
  // ONLY when it names exactly one book. A single call for both books gets nothing back — which
  // is the crowding-out, made deterministic — so a tree that merges the calls again cannot pass.
  {
    const fs20 = require('fs');
    const T20 = await esm('lib/takhrij.js');
    const L20 = await esm('lib/takhrij-ladder.js');
    const MATN20 = 'الصلاة على وقتها ثم بر الوالدين';
    const ANSWER20 = 'قال النبي صلى الله عليه وسلم: «' + MATN20 + '» وهذا أصل في الباب.';
    const BUKHARI20 = L20.SHAYKHAYN_IDS[0];
    const asked20 = [];
    // THE LIBRARY THAT ONLY ANSWERS A ONE-BOOK REQUEST. Everything else comes back empty, which
    // is the measured shape: the two books together return ten rows and none of them carry it.
    const lookup20 = async (matns, options) => {
      const ids = (options && options.bookIds) || [];
      asked20.push(ids.slice());
      const oneBook = ids.length === 1 && ids[0] === BUKHARI20;
      return matns.map((m) => (oneBook
        ? { matn: m, subjectIds: [BUKHARI20], atoms: ['حدثنا سفيان عن ابن مسعود رضي الله عنه قال: ' + m] }
        : { matn: m, subjectIds: [], atoms: [] }));
    };
    const pass20 = await T20.applyTakhrij(ANSWER20, { env: ON, lookup: lookup20 });

    const narrowed20 = asked20.filter((ids) => ids.length && ids.length < L20.TAKHRIJ_LADDER_IDS.length);
    ok('20  the narrowed request was made at all', narrowed20.length > 0,
      JSON.stringify(asked20.map((x) => x.length)));
    ok('20  and every narrowed Ṣaḥīḥayn request carries exactly ONE book id',
      asked20.filter((ids) => ids.some((id) => L20.SHAYKHAYN_IDS.includes(id))
        && ids.every((id) => L20.SHAYKHAYN_IDS.includes(id)))
        .every((ids) => ids.length === 1),
      JSON.stringify(asked20));
    ok('20  ...and BOTH Ṣaḥīḥs are still asked, one after the other',
      L20.SHAYKHAYN_IDS.every((id) => asked20.some((ids) => ids.length === 1 && ids[0] === id)),
      JSON.stringify(asked20));
    ok('20  the matns go down TOGETHER in the call for one book — not one call per hadith',
      asked20.filter((ids) => ids.length === 1).length === L20.SHAYKHAYN_IDS.length,
      String(asked20.filter((ids) => ids.length === 1).length));
    ok('20  and the book that only a one-book request could reach is named to the reader',
      pass20.text.includes('البخاري'), JSON.stringify(pass20.text));

    // ── AND WHAT COUNTS AS CARRYING THE MATN DID NOT MOVE ─────────────────
    // The one line the order locks: «ما اتّسعَ هو عددُ المرشّحينَ لا ما يُعَدُّ حملًا للمتن».
    // A guard that only counted calls would pass a tree that bought its extra witnesses by
    // loosening the test, which is the false-ascription door reopened from the side.
    const NEAR20 = 'حدثنا سفيان قال: الصلاة في أوّل الوقت أفضلُ الأعمال';
    ok('20  a near neighbour is still not a carrier',
      T20.atomCarriesMatn(NEAR20, MATN20) === false, JSON.stringify(NEAR20));
    ok('20  ...and an atom that really holds the matn still is one',
      T20.atomCarriesMatn('عن ابن مسعود قال: ' + MATN20, MATN20) === true);
    // AND THE ANCHOR RULE ITSELF, which is what the widening would have had to touch.
    const src20 = fs20.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8');
    ok('20  the anchor is still four words and six tenths, untouched by this step',
      src20.includes('const MIN_ANCHOR_WORDS = 4;')
        && src20.includes('Math.max(MIN_ANCHOR_WORDS, Math.ceil(words.length * 0.6))'));

    // MUTANT — the two books are merged back into one call, and the reader loses the book.
    ok('20  MUTANT: the per-book seam is findable',
      src20.includes('for (const bookId of SHAYKHAYN_IDS) {'),
      'the seam moved — §20 is blind and the calls can be merged again unseen');
    if (src20.includes('for (const bookId of SHAYKHAYN_IDS) {')) {
      const mutant20 = src20
        .replace('for (const bookId of SHAYKHAYN_IDS) {', 'for (const bookId of [SHAYKHAYN_IDS]) {');
      const tmp20 = path.join(REPO, 'lib', '.takhrij-mutant20-' + process.pid + '.mjs');
      fs20.writeFileSync(tmp20, mutant20);
      try {
        const M20 = await esm('lib/' + path.basename(tmp20));
        const broken20 = await M20.applyTakhrij(ANSWER20, { env: ON, lookup: lookup20 });
        ok('20  MUTANT: merged back into one call, the book goes unnamed — the measured defect',
          !broken20.text.includes('البخاري'), JSON.stringify(broken20.text));
      } finally { fs20.unlinkSync(tmp20); }
    }

    // ── AND PHASE THREE IS DELIBERATELY NOT SPLIT, WITH ITS MEASUREMENT WRITTEN DOWN ──
    // ١١١/٤ measured the same question on the five graders and found ZERO gained on ten matns,
    // so it is left alone. The row pins the DECISION and its reason, so a later round that
    // splits it is made to re-measure rather than to copy a pattern.
    ok('20  the narrowed grader request still names all the graders at once',
      src20.includes('{ bookIds: RULING_BOOK_IDS }'),
      'phase three was split — ١١١/٤ measured that it buys nothing; re-measure before changing it');
    ok('20  ...and the measurement that decided it is written where the code is',
      src20.includes('AND THIS PHASE IS *NOT* SPLIT PER BOOK, BECAUSE IT WAS MEASURED'));
  }
  // ── ١١١ SECOND ORDER · A CHAPTER HEADING IS NOT A NARRATION ──────────────────
  // MEASURED 21 September 2026 on ezik-shamela-20260820: «الدين النصيحة» left as «(متفق عليه)»
  // because al-Bukhari's atom FC-000645:0044:001 carries the matn in its CHAPTER HEADING only —
  // the narrations under it are Jarir's pledge. That bracket was a false ascription. An atom that
  // opens with «باب» is now read from its first isnad; this row falls the moment a heading proves
  // a book again.
  console.log('\n--- S8. A CHAPTER HEADING IS NOT A NARRATION ---');
  {
    const fsS8 = require('fs'); const osS8 = require('os');
    const MATN8 = 'الدين النصيحة';
    const HEADING_ONLY = 'بَابُ قَوْلِ النَّبِيِّ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ: " الدِّينُ النَّصِيحَةُ: لِلَّهِ وَلِرَسُولِهِ وَلِأَئِمَّةِ المُسْلِمِينَ وَعَامَّتِهِمْ "\n'
      + '57 - حَدَّثَنَا مُسَدَّدٌ، قَالَ: حَدَّثَنَا يَحْيَى، عَنْ إِسْمَاعِيلَ، قَالَ: حَدَّثَنِي قَيْسٌ، عَنْ جَرِيرِ بْنِ عَبْدِ اللَّهِ، قَالَ: بَايَعْتُ رَسُولَ اللَّهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ عَلَى إِقَامِ الصَّلاَةِ، وَالنُّصْحِ لِكُلِّ مُسْلِمٍ';
    const MUSLIM_NARRATION = '23 - بَابُ بَيَانِ أَنَّ الدِّينَ النَّصِيحَةُ\n95 - (55) حَدَّثَنَا مُحَمَّدُ بْنُ عَبَّادٍ، عَنْ تَمِيمٍ الدَّارِيِّ، أَنَّ النَّبِيَّ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ قَالَ: «الدِّينُ النَّصِيحَةُ» قُلْنَا: لِمَنْ؟';
    const HEADING_AND_NARRATION = HEADING_ONLY + '\n58 - حَدَّثَنَا فُلاَنٌ عَنْ تَمِيمٍ قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ: الدِّينُ النَّصِيحَةُ';
    const runWith = async (mod, bukhariAtom) => (await mod.applyTakhrij(answerWith(MATN8), {
      env: ON,
      lookup: lookupOf({ [MATN8]: { matn: MATN8, subjectIds: ['FC-000645', 'FC-000648'], atoms: [bukhariAtom, MUSLIM_NARRATION] } }),
    })).text;
    const headingOnly = await runWith(T, HEADING_ONLY);
    ok('S8 a matn al-Bukhari holds only in a chapter heading is NOT «(متفق عليه)»',
      !headingOnly.includes('(' + L.AGREED_UPON + ')'), JSON.stringify(headingOnly));
    ok('S8 ...it is Muslim\'s, and the bracket says so', headingOnly.includes('(مسلم)'), JSON.stringify(headingOnly));
    ok('S8 CAUSAL: where al-Bukhari narrates it under the heading, «(متفق عليه)» stands',
      (await runWith(T, HEADING_AND_NARRATION)).includes('(' + L.AGREED_UPON + ')'));
    ok('S8 an atom that does not open with a heading is handed over byte-identical',
      T.narrationOf(MUSLIM_NARRATION.split('\n')[1]) === MUSLIM_NARRATION.split('\n')[1]);
    ok('S8 ...and `atomCarriesMatn` itself did not move: the heading atom still reads as a carrier when asked directly',
      T.atomCarriesMatn(HEADING_ONLY, MATN8) === true);
    const srcS8 = fsS8.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8');
    const SEAM_S8 = 'if (!atomCarriesMatn(narrationOf(atom), matn)) continue;';
    const mutatedS8 = srcS8.split(SEAM_S8).join('if (!atomCarriesMatn(atom, matn)) continue;');
    ok('MUTANT S8 heading-proves-a-book seam applied', mutatedS8 !== srcS8);
    const dirS8 = fsS8.mkdtempSync(path.join(osS8.tmpdir(), 'ustaz-111-s8-mut-'));
    try {
      const libDir = path.join(REPO, 'lib');
      const fileS8 = path.join(dirS8, 'takhrij.mjs');
      fsS8.writeFileSync(fileS8, mutatedS8.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(libDir, spec).replace(/\\/g, '/') + q), 'utf8');
      const mutS8 = await import('file:///' + fileS8.replace(/\\/g, '/'));
      ok('MUTANT KILLED: with the heading counted, the false «(متفق عليه)» comes back',
        (await runWith(mutS8, HEADING_ONLY)).includes('(' + L.AGREED_UPON + ')'));
    } finally {
      try { fsS8.rmSync(dirS8, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── ١١١ SECOND ORDER · A HADITH THE SILSILA MENTIONS IS NOT A HADITH IT GRADES ──────────
  // MEASURED 21 September 2026: «الصيام والقرآن يشفعان للعبد يوم القيامة» left as «(أحمد · ضعيف)»
  // because السلسلة الضعيفة 7129 CITES it — as an authentic merit, «وهو مخرج في تمام المنة» — while
  // grading another hadith. A Silsila's title rules only the matn that opens an entry.
  console.log('\n--- S8b. THE SILSILA GRADES ITS ENTRIES, NOT ITS QUOTATIONS ---');
  {
    const fsB = require('fs'); const osB = require('os');
    const MATNB = 'الصيام والقرآن يشفعان للعبد يوم القيامة';
    const AHMAD = 'حدثنا موسى بن داود حدثنا ابن لهيعة عن حيي بن عبد الله عن عبد الله بن عمرو أن رسول الله صلى الله عليه وسلم قال: ' + MATNB;
    const CITED = 'نعم أنا لا أنكر أن لبعض الأعمال الصالحة فضائل خاصة بعد الموت مثل قوله صلى الله عليه وسلم: ' + MATNB + ' وهو مخرج في تمام المنة';
    const ENTRY = '7130 - ' + MATNB + '. ضعيف. رواه فلان عن فلان';
    const runB = async (mod, daifaAtom) => (await mod.applyTakhrij(answerWith(MATNB), {
      env: ON,
      lookup: lookupOf({ [MATNB]: { matn: MATNB, subjectIds: ['FC-000630', 'FC-002061'], atoms: [AHMAD, daifaAtom] } }),
    })).text;
    const cited = await runB(T, CITED);
    ok('S8b a matn السلسلة الضعيفة only quotes is not graded «ضعيف» by its title',
      !/ضعيف/u.test(cited) && cited.includes('(أحمد · ' + L.NO_RULING + ')'), JSON.stringify(cited));
    ok('S8b CAUSAL: a matn that opens an entry of السلسلة الضعيفة is graded by it, as before',
      (await runB(T, ENTRY)).includes('(أحمد · ضعيف)'), JSON.stringify(await runB(T, ENTRY)));
    const srcB = fsB.readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8');
    const SEAM_B = 'if (ENTRY_GRADED_IDS.has(ids[i]) && !entryIsMatn(atom, matn)) continue;';
    const mutatedB = srcB.split(SEAM_B).join('/* mutant: every quotation graded */');
    ok('MUTANT S8b quotation-graded seam applied', mutatedB !== srcB);
    const dirB = fsB.mkdtempSync(path.join(osB.tmpdir(), 'ustaz-111-s8b-mut-'));
    try {
      const libDir = path.join(REPO, 'lib');
      const fileB = path.join(dirB, 'takhrij.mjs');
      fsB.writeFileSync(fileB, mutatedB.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(libDir, spec).replace(/\\/g, '/') + q), 'utf8');
      const mutB = await import('file:///' + fileB.replace(/\\/g, '/'));
      // BATCH 4 [b34] — a quotation with no ruling written after it grades nothing under any
      // mutation now, so the mutant is shown a quotation the Silsila follows with a ruling word
      // outside an entry of its own: only the entry check keeps that word off the matn.
      const CITED_RULED = 'وقد سبق في الحديث الذي قبله: «' + MATNB + '» . ضعيف كما تقدم في موضعه';
      ok('MUTANT KILLED: with every quotation graded, the false «(أحمد · ضعيف)» comes back',
        (await runB(mutB, CITED_RULED)).includes('(أحمد · ضعيف)') && !(await runB(T, CITED_RULED)).includes('ضعيف'));
    } finally {
      try { fsB.rmSync(dirB, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  console.log('\n=== 111 THIRD ORDER · STEP 3 · A KINSHIP PRONOUN IS NEVER TAKEN FOR A COMPANION ===');
  {
    // MEASURED on the preview: «عن أبيه رضي الله عنه: «دعهما فإني أدخلتهما طاهرتين» (متفق عليه)».
    // The atoms say «عن عروة بن المغيرة عن أبيه», so the last anchored run was a pronoun.
    const T3k = await esm('lib/takhrij.js');
    const KHUFF = 'دعهما فإني أدخلتهما طاهرتين';
    const ATOM_KIN = 'حدثنا أبو نعيم قال حدثنا زكرياء عن عامر عن عروة بن المغيرة عن أبيه رضي الله عنه قال كنت مع النبي صلى الله عليه وسلم في سفر فأهويت لأنزع خفيه فقال ' + KHUFF + ' فمسح عليهما';
    const ATOM_OK = 'حدثنا سفيان عن سليمان عن طاوس عن ابن عباس رضي الله عنهما قال أمر الناس أن يكون آخر عهدهم بالبيت إلا أنه خفف عن الحائض';
    ok('111-T3 «عن أبيه رضي الله عنه» names no Companion — the opener is dropped, nothing inferred',
      T3k.companionFrom(ATOM_KIN, KHUFF).name === '', JSON.stringify(T3k.companionFrom(ATOM_KIN, KHUFF)));
    ok('111-T3 ...and «المغيرة» is not read out of «عروة بن المغيرة» either',
      !/المغيرة/u.test(T3k.companionFrom(ATOM_KIN, KHUFF).name));
    ok('111-T3 a Companion named by his name is taken, and he alone: «ابن عباس», never «طاوس ابن عباس» out of «عن طاوس عن ابن عباس»',
      T3k.companionFrom(ATOM_OK, 'أمر الناس أن يكون آخر عهدهم بالبيت').name === 'ابن عباس'
        && T3k.companionFrom(ATOM_OK, 'أمر الناس أن يكون آخر عهدهم بالبيت').prayer === 'عنهما');
    {
      // «أبي» is the genitive of «أبو» as well as «my father»: a kunya is a name and stays one.
      const ATOM_KUNYA = 'حدثنا عبد الله عن أبي صالح عن أبي هريرة رضي الله عنه قال قال رسول الله صلى الله عليه وسلم للصائم فرحتان فرحة عند فطره وفرحة عند لقاء ربه';
      ok('111-T3 ...and «عن أبي هريرة» is a kunya, not a kinship word: taken as «أبي هريرة»',
        T3k.companionFrom(ATOM_KUNYA, 'للصائم فرحتان').name === 'أبي هريرة', JSON.stringify(T3k.companionFrom(ATOM_KUNYA, 'للصائم فرحتان')));
    }
    for (const kin of ['أبيها', 'أمه', 'جده', 'أخيه', 'عمها', 'خاله', 'ابنه', 'زوجها']) {
      const atom = 'حدثنا فلان عن فلان عن ' + kin + ' رضي الله عنه قال سمعت رسول الله صلى الله عليه وسلم يقول إنما الأعمال بالنيات';
      ok('111-T3 «عن ' + kin + '» names no Companion', T3k.companionFrom(atom, 'إنما الأعمال بالنيات').name === '');
    }
    {
      const fs = require('fs'); const os = require('os');
      const src = fs.readFileSync(path.join(REPO, 'lib', 'takhrij.js'), 'utf8');
      const SEAM = "  if (words.some((word) => KINSHIP_WORDS.has(foldArabic(word)))) return { name: '', prayer: '', kinship: true };";
      const changed = src.split(SEAM).join('');
      ok('MUTANT 111-T3 kinship seam applied', changed !== src);
      const dir = path.dirname(path.join(REPO, 'lib', 'takhrij.js'));
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-111-t3-mut-'));
      try {
        const file = path.join(tmp, 'kin-blind.mjs');
        fs.writeFileSync(file, changed.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
          (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(dir, spec).replace(/\\/g, '/') + q), 'utf8');
        const mod = await import('file:///' + file.replace(/\\/g, '/'));
        ok('MUTANT KILLED: without the rule the pronoun ships as a name again',
          mod.companionFrom(ATOM_KIN, KHUFF).name !== '');
      } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
      }
    }
  }
  console.log('\n=== 111 THIRD ORDER · STEP 4 · NO GLUED OPENER, NO LINE THAT OPENS ON A COMMA ===');
  {
    const T4 = await esm('lib/takhrij.js');
    const two = { [MATN]: { matn: MATN, subjectIds: ['FC-000645', 'FC-000658'], atoms: [atomFor(MATN, 'عمر بن الخطاب'), atomFor(MATN, 'عمر بن الخطاب')] } };
    {
      // (أ) MEASURED on the preview: «…آخر عهده بالبيت»عن ابن عباس رضي الله عنهما: «…»».
      const glued = 'الحكم واجب، لقوله صلى الله عليه وسلم: «' + OTHER + '»«' + MATN + '».';
      const out = (await T4.applyTakhrij(glued, { env: ON, lookup: lookupOf(two) })).text;
      ok('111-T4a an opener after a closing guillemet is written with a space before it',
        out.includes('» عن عمر بن الخطاب') && !/»عن/u.test(out), JSON.stringify(out));
      const spaced = 'الحمد لله. قال النبي صلى الله عليه وسلم: «' + MATN + '» وهذا أصل.';
      const out2 = (await T4.applyTakhrij(spaced, { env: ON, lookup: lookupOf(two) })).text;
      ok('111-T4a ...and where whitespace already stands, no second space is added',
        !/  عن عمر/u.test(out2) && out2.includes('عن عمر بن الخطاب'), JSON.stringify(out2));
    }
    {
      // (ب) MEASURED on the preview: the dissolved card's matn on its own line, then «، والعبد…».
      const carded = 'شروط وجوب الحج خمسة.\n<hadith narrator="رواه أبو داود" ruling="صحيح">' + MATN + '</hadith>\n، والعبد لا يلزمه الحج حتى يعتق.';
      const out = (await T4.applyTakhrij(carded, { env: ON, lookup: lookupOf({}) })).text;
      ok('111-T4b a dissolved card leaves no line that opens on a comma',
        !/(^|\n)\s*[،,]/u.test(out) && out.includes('، والعبد لا يلزمه الحج حتى يعتق.'), JSON.stringify(out));
      ok('111-T4b ...and an answer the pass did not touch stays byte-identical, comma line and all',
        (await T4.applyTakhrij('نص.\n، ثم نص.', { env: ON, lookup: lookupOf({}) })).text === 'نص.\n، ثم نص.');
      const fs = require('fs'); const os = require('os');
      const src = fs.readFileSync(path.join(REPO, 'lib', 'takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
      const SEAM = "      .replace(/\\n[ \\t]*[،,][ \\t]*/gu, '، ')";
      const changed = src.split(SEAM).join('');
      ok('MUTANT 111-T4b comma-line seam applied', changed !== src);
      const dir = path.dirname(path.join(REPO, 'lib', 'takhrij.js'));
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-111-t4-mut-'));
      try {
        const file = path.join(tmp, 'comma-line.mjs');
        fs.writeFileSync(file, changed.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
          (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(dir, spec).replace(/\\/g, '/') + q), 'utf8');
        const mod = await import('file:///' + file.replace(/\\/g, '/'));
        ok('MUTANT KILLED: without the tidy the line opens on a comma again',
          /(^|\n)\s*[،,]/u.test((await mod.applyTakhrij(carded, { env: ON, lookup: lookupOf({}) })).text));
      } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
      }
    }
  }
  // ── BATCH 4 [b34] · THE GRADE IS THE RULING WORD WRITTEN IN THE ATOM ─────────────────────
  // The owner's rule 34: the grade is the ruling word written in the atom; «باطل»، «موضوع»، «لا أصل
  // له» ⟸ «(لا يثبت مرفوعا)»; a split verdict carries no grade. The atoms below are excerpts, letter
  // for letter, of what ezik-shamela-20260820 (the twin on :8799) returned on 22 September 2026 for
  // the order's three witnesses; at 92d3c7d they left as «(البزار · ضعيف)», «(الترمذي · ضعيف)» and
  // «(ابن ماجه · ضعيف)» — the «ضعيف» of a book's title, not of anything the book wrote.
  console.log('\n--- B34. THE GRADE IS WHAT THE ENTRY WRITES ---');
  {
    const T34 = await esm('lib/takhrij.js');
    const L34 = await esm('lib/takhrij-ladder.js');
    const A = {
      chinaSilsila: '416 - " اطلبوا العلم ولو بالصين ". باطل. رواه ابن عدي (207 / 2) وأبو نعيم في " أخبار أصبهان " (2 / 106)',
      chinaBazzar: '95 - وحديث أبي العاتكة: «اطلبوا العلم ولو بالصين» لا يعرف أبو العاتكة ولا يدرى من أين هو، فليس لهذا الحديث',
      chinaDj: '906 - (اطلبوا العلم ولو بالصين فإن) طلب العلم فريضة على كل مسلم (عد عق هب ابن عبد البر في العلم) عن أنس.',
      talabSj: '3913 - «طلب العلم فريضة على كل مسلم» . (صحيح) [عد هب] عن أنس [طص خط] عن الحسين بن علي',
      talabBazzar: 'حديث روي عن حماد بن سلمة، عن ثابت، عن أنس، عن النبي صلى الله عليه وسلم: «طلب العلم فريضة» هذا كذب ليس له أصل عن ثابت عن أنس فأما ما يذكر عن النبي صلى الله عليه وسلم أنه قال: «طلب العلم فريضة على كل مسلم» . فقد روي عن أنس من غير وجه، وكل ما يروى فيها عن أنس، فغير صحيح',
      talabIbnMajah: 'حدثنا كثير بن شنظير، عن محمد بن سيرين، عن أنس بن مالك قال: قال رسول الله صلى الله عليه وسلم: «طلب العلم فريضة على كل مسلم، وواضع العلم عند غير أهله كمقلد الخنازير الجوهر واللؤلؤ والذهب»',
      talabDj: '3625 - طلب العلم فريضة على كل مسلم والله يحب إغاثة اللهفان (هب ابن عبد البر) عن أنس.',
      laysaTirmidhi: 'فقال النبي صلى الله عليه وسلم: ليس منا من لم يرحم صغيرنا ويوقر كبيرنا. وفي الباب عن عبد الله بن عمرو، وأبي هريرة، وابن عباس، وأبي أمامة. هذا حديث غريب',
      laysaDj: '4938 - ليس منا من لم يرحم صغيرنا ويوقر كبيرنا ويأمر بالمعروف وينه عن المنكر (حم ت) عن ابن عباس.',
      ahdSj: '4143 - «العهد الذي بيننا وبينهم الصلاة فمن تركها فقد كفر» . (صحيح) حم ت ن حب ك عن بريدة.',
    };
    const CHINA = 'اطلبوا العلم ولو بالصين';
    const TALAB = 'طلب العلم فريضة على كل مسلم';
    const LAYSA = 'ليس منا من لم يرحم صغيرنا';
    const AHD = 'العهد الذي بيننا وبينهم الصلاة فمن تركها فقد كفر';
    const run34 = async (mod, matn, ids, atoms) => mod.applyTakhrij(answerWith(matn),
      { env: ON, lookup: lookupOf({ [matn]: { matn, subjectIds: ids, atoms } }) });
    const china = await run34(T34, CHINA, ['FC-000668', 'FC-000791', 'FC-002061'], [A.chinaBazzar, A.chinaDj, A.chinaSilsila]);
    ok('B34 «اطلبوا العلم ولو بالصين»: السلسلة الضعيفة writes «باطل» ⟸ «(لا يثبت مرفوعا)», not «ضعيف»',
      china.text.includes('(' + L34.NOT_RAISED + ')') && !/ضعيف\)/u.test(china.text), JSON.stringify(china.text));
    ok('B34 ...and the record names who wrote it, and what he wrote',
      china.entries[0].ruledBy === 'السلسلة الضعيفة', JSON.stringify(china.entries));
    const laysa = await run34(T34, LAYSA, ['FC-000658', 'FC-000791'], [A.laysaTirmidhi, A.laysaDj]);
    ok('B34 «ليس منا من لم يرحم صغيرنا»: an entry that writes no ruling grades nothing ⟸ no grade',
      laysa.text.includes('(الترمذي · ' + L34.NO_RULING + ')'), JSON.stringify(laysa.text));
    const talab = await run34(T34, TALAB, ['FC-000652', 'FC-000788', 'FC-000668', 'FC-000791'],
      [A.talabIbnMajah, A.talabSj, A.talabBazzar, A.talabDj]);
    ok('B34 «طلب العلم فريضة»: صحيح الجامع writes «(صحيح)», البزار writes «كذب … غير صحيح» ⟸ split, no grade',
      talab.text.includes('(ابن ماجه · ' + L34.NO_RULING + ')'), JSON.stringify(talab.text));
    const ahd = await run34(T34, AHD, ['FC-000703', 'FC-000788'], [atomFor(AHD, 'بريدة'), A.ahdSj]);
    ok('B34 control: an entry that writes «(صحيح)» with nobody writing otherwise still grades',
      ahd.text.includes('(ابن حبان · صحيح)'), JSON.stringify(ahd.text));
    ok('B34 sibling: «ومعناه صحيح» and a grade word heading a definite noun are no ruling',
      [...T34.judgementsNear('36 - حب الوطن من الإيمان. قال الصغاني: موضوع. وقال في المقاصد: لم أقف عليه، ومعناه صحيح.', 'حب الوطن من الإيمان')].join() === 'weak'
        && T34.judgementsNear('حب الوطن من الإيمان حسن العهد من الإيمان', 'حب الوطن من الإيمان').size === 0);
    ok('B34 sibling: the ruling is read where the entry writes it, and «وهو حسن» three words on is not',
      T34.rulingWrittenFor(A.talabSj, TALAB) === 'صحيح'
        && T34.rulingWrittenFor('بلفظ: "' + TALAB + '". وهو حسن. وقال المزي', TALAB) === ''
        && T34.rulingWrittenFor(A.chinaSilsila, CHINA) === 'باطل' && T34.rulingWrittenFor(A.talabDj, TALAB) === '');
    ok('B34 the composer handed no written ruling states no grade, whatever the title says',
      L34.composeParenthetical(['FC-000658', 'FC-000791']).text === 'الترمذي · ' + L34.NO_RULING);
    const read34 = (rel) => require('fs').readFileSync(path.join(REPO, rel), 'utf8');
    const src34 = read34('lib/takhrij-ladder.js').replace(/\r\n/g, '\n');
    const tmp34 = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b34-mut-'));
    try {
      const load34 = async (tag, from, to) => {
        const changed = src34.split(from).join(to);
        ok('MUTANT B34 ' + tag + ' seam applied', changed !== src34);
        const ladderFile = path.join(tmp34, tag + '-ladder.mjs');
        require('fs').writeFileSync(ladderFile, changed, 'utf8');
        const tsrc = read34('lib/takhrij.js').replace(/from\s+(['"])\.\/takhrij-ladder\.js\1/gu,
          (_a, q) => 'from ' + q + 'file:///' + ladderFile.replace(/\\/g, '/') + q)
          .replace(/from\s+(['"])(\.[^'"]*)\1/gu, (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q);
        const tfile = path.join(tmp34, tag + '-takhrij.mjs');
        require('fs').writeFileSync(tfile, tsrc, 'utf8');
        return import('file:///' + tfile.replace(/\\/g, '/'));
      };
      const title = await load34('title-grades-again',
        "      const words = rulings && Array.isArray(rulings[id]) ? rulings[id] : [];",
        "      const words = row.grade ? [row.grade] : []; // mutant");
      const back = await run34(title, CHINA, ['FC-000668', 'FC-000791', 'FC-002061'], [A.chinaBazzar, A.chinaDj, A.chinaSilsila]);
      ok('MUTANT KILLED: with the title grading again, «(البزار · ضعيف)» comes back',
        back.text.includes('(البزار · ضعيف)'), JSON.stringify(back.text));
      const deaf = await load34('split-unheard',
        "  const voices = rulings && Array.isArray(rulings['#voices']) ? rulings['#voices'] : [];",
        "  const voices = []; // mutant");
      const one = await run34(deaf, TALAB, ['FC-000652', 'FC-000788', 'FC-000668', 'FC-000791'],
        [A.talabIbnMajah, A.talabSj, A.talabBazzar, A.talabDj]);
      ok('MUTANT KILLED: with the other books unheard, «طلب العلم فريضة» is graded «صحيح» over البزار\'s «كذب»',
        one.text.includes('(ابن ماجه · صحيح)'), JSON.stringify(one.text));
    } finally {
      try { require('fs').rmSync(tmp34, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b17] · «حديث «…»» IS A MATN'S OWN FRAME ───────────────────────────────────
  // MEASURED at 2aaf987 and 92d3c7d (EZIK-CX-M111 row 17): the three matns written «حديث «…».» gave
  // zero targets and left with no parentheses; after «قال رسول الله ﷺ:» they gave one each.
  console.log('\n--- B17. «حديث «…»» IS THE FORM OF A MATN ---');
  {
    const T17 = await esm('lib/takhrij.js');
    for (const m of ['اطلبوا العلم ولو بالصين', 'إنما الأعمال بالنيات', 'من حسن إسلام المرء تركه ما لا يعنيه']) {
      ok('B17 «حديث «' + m + '».» is one target', T17.findTargets('حديث «' + m + '».').targets.length === 1);
    }
    const mid = 'واستدلوا بحديث «إنما الأعمال بالنيات» على اشتراط النية.';
    const t = T17.findTargets(mid).targets[0];
    ok('B17 «واستدلوا بحديث «…» على…» is a target whose lead-in is the quotation itself: the sentence is not broken',
      !!t && t.leadStart === mid.indexOf('«'), JSON.stringify(t));
    const run = await T17.applyTakhrij(mid, { env: ON, lookup: lookupOf({ 'إنما الأعمال بالنيات': { matn: 'إنما الأعمال بالنيات',
      subjectIds: ['FC-000645', 'FC-000658'], atoms: [atomFor('إنما الأعمال بالنيات', 'عمر بن الخطاب'), atomFor('إنما الأعمال بالنيات', 'عمر بن الخطاب')] } }) });
    ok('B17 ...and with the library behind it the sentence keeps its words and gains the parentheses',
      run.text.startsWith('واستدلوا بحديث') && run.text.includes('(البخاري)') && run.text.includes('على اشتراط النية'), JSON.stringify(run.text));
    ok('B17 control · «حديث» earlier in a sentence is a word about a hadith: the last speaker named is still a man',
      T17.findTargets('قال ابن باز: هذا حديث صحيح، وقال: «إنما الأعمال بالنيات».').targets.length === 0);
    ok('B17 control · a one-word quotation after «حديث» is still no matn', T17.findTargets('حديث «الإحسان».').targets.length === 0);
    const src17 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = '      const hadithFrame = HADITH_WORD_FRAME_END_RE.exec(segment);';
    const mutated = src17.split(seam).join('      const hadithFrame = null; // mutant');
    ok('MUTANT B17 hadith-frame seam applied', mutated !== src17);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b17-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b17] «حديث «…»» is no target again', mod.findTargets('حديث «إنما الأعمال بالنيات».').targets.length === 0);
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b21] · A COMPANION'S WORDS INSIDE A QUOTED HADITH ─────────────────────────
  // MEASURED at 92d3c7d on the twin: «إنما الأعمال بالنيات … فهجرته إلى الله ورسوله، قال عمر رضي الله
  // عنه: فسمعته يقول ذلك» left as «(أبو داود · لم يوقف على حكم)» — the atom carried the Prophet's
  // words (the anchor), and the Companion's sentence the answer added rode on it into the book.
  console.log('\n--- B21. THE MIXTURE OF THE MARFŪʿ AND A COMPANION IS CREDITED TO NO BOOK ---');
  {
    const T21 = await esm('lib/takhrij.js');
    const MARFU = 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله';
    const ATOM = 'حدثنا الحميدي حدثنا سفيان عن عمر بن الخطاب رضي الله عنه قال سمعت رسول الله صلى الله عليه وسلم يقول ' + MARFU + ' ومن كانت هجرته لدنيا يصيبها.';
    const MIXED = MARFU + '، قال عمر رضي الله عنه: فسمعته يقول ذلك';
    ok('B21 W · the atom carries the marfūʿ, not the Companion\'s sentence the quotation adds: it does not carry the quotation',
      T21.atomCarriesMatn(ATOM, MIXED) === false && T21.atomCarriesMatn(ATOM, MARFU) === true);
    const run = async (mod, matn) => mod.applyTakhrij('قال رسول الله صلى الله عليه وسلم: «' + matn + '».',
      { env: ON, lookup: lookupOf({ [matn]: { matn, subjectIds: ['FC-000645', 'FC-000656'], atoms: [ATOM, ATOM] } }) });
    const mixed = await run(T21, MIXED);
    ok('B21 W · ...so the mixture leaves with no parentheses at all', !/\(/u.test(mixed.text), JSON.stringify(mixed.text));
    const pure = await run(T21, MARFU);
    ok('B21 control · the marfūʿ alone still takes its parentheses', pure.text.includes('(البخاري)'), JSON.stringify(pure.text));
    ok('B21 control · a wording that differs after the anchor, with no second speaker, is still carried',
      T21.atomCarriesMatn('أمر الناس أن يكون آخر عهدهم بالبيت إلا أنه خفف عن المرأة الحائض', 'أمر الناس أن يكون آخر عهدهم بالبيت، إلا أنه خفف عن الحائض'));
    const src21 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = "  return !COMPANION_VOICE_RE.test(' ' + words.slice(cut).join(' ') + ' ');";
    const mutated = src21.split(seam).join('  return true; // mutant');
    ok('MUTANT B21 companion-voice seam applied', mutated !== src21);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b21-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b21] the mixture is credited to a book again', (await run(mod, MIXED)).text.includes('(البخاري)'));
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b22] · A FAILED CALL IS ASKED ONCE MORE ─────────────────────────────────────
  // MEASURED on the preview (T7, «إنما الأعمال بالنيات» → «(أبو داود · لم يوقف على حكم)»; «الطهور شطر
  // الإيمان» → no parentheses at 92d3c7d) while the twin writes «(متفق عليه)» and «(مسلم)»: a failed
  // call was printed and then read as «the book has nothing».
  console.log('\n--- B22. A FAILED CALL IS ASKED AGAIN, ONCE ---');
  {
    const T22 = await esm('lib/takhrij.js');
    const NIYYAT = 'إنما الأعمال بالنيات';
    const BUKHARI = atomFor(NIYYAT, 'عمر بن الخطاب');
    const MUSLIM = atomFor('إنما الأعمال بالنية', 'عمر بن الخطاب');
    // Call one: البخاري only. The مسلم-narrowed call fails the first time it is asked.
    const flaky = (failTimes) => {
      let muslimCalls = 0;
      return async (matns, options) => {
        const ids = (options && options.bookIds) || [];
        const muslim = ids.length === 1 && ids[0] === 'FC-000648';
        if (muslim) muslimCalls += 1; // one call, however many matns (the variant rides in it)
        return matns.map((matn) => {
          if (muslim) {
            if (muslimCalls <= failTimes) return { matn, subjectIds: [], atoms: [], failure: { status: '502', error: 'bad gateway' } };
            return { matn, subjectIds: ['FC-000648'], atoms: [MUSLIM] };
          }
          return { matn, subjectIds: ['FC-000645', 'FC-000658'], atoms: [BUKHARI, BUKHARI] };
        });
      };
    };
    const once = await T22.applyTakhrij(answerWith(NIYYAT), { env: ON, lookup: flaky(1) });
    ok('B22 W · the مسلم call failed once and was asked again: «(متفق عليه)», not «(البخاري)»',
      once.text.includes('(' + L.AGREED_UPON + ')'), JSON.stringify(once.text));
    ok('B22 ...and the failure is still recorded for the log, with its attempt',
      once.callFailures.some((f) => f.call === 2 && f.status === '502' && f.attempt === 1), JSON.stringify(once.callFailures));
    const twice = await T22.applyTakhrij(answerWith(NIYYAT), { env: ON, lookup: flaky(2) });
    ok('B22 control · a call that fails twice leaves the parentheses the library DID confirm, and both failures are printed',
      twice.text.includes('(البخاري)') && twice.callFailures.filter((f) => f.call === 2 && f.status === '502').length >= 2,
      JSON.stringify([twice.text, twice.callFailures]));
    const threw = async (matns) => { throw new Error('socket hang up'); };
    const dead = await T22.applyTakhrij(answerWith(NIYYAT), { env: ON, lookup: threw });
    ok('B22 control · a library that is down is asked twice and the matn stays as written — silence, no invented bracket',
      dead.text === answerWith(NIYYAT) && dead.callFailures.filter((f) => f.status === 'threw').length >= 2, JSON.stringify(dead.callFailures));
    const src22 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = '    const again = await callOnce(failed, options, n, 2);';
    const mutated = src22.split(seam).join('    const again = null; // mutant');
    ok('MUTANT B22 retry seam applied', mutated !== src22);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b22-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b22] one failed call reduces «(متفق عليه)» to «(البخاري)» again',
        (await mod.applyTakhrij(answerWith(NIYYAT), { env: ON, lookup: flaky(1) })).text.includes('(البخاري)'));
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b23] · «رُوي» DOES NOT STAND BEFORE A SOUND HADITH ──────────────────────────
  // The form of weakening («رُوي»، «فيما رُوي»، «يُروى») before a hadith the library proves to be in the
  // two Ṣaḥīḥs, or graded sound, tells the reader the opposite; it becomes «ثبت». Before a weak one,
  // or where nothing was proved, it is not touched.
  console.log('\n--- B23. THE FORM OF WEAKENING BEFORE A SOUND HADITH ---');
  {
    const T23 = await esm('lib/takhrij.js');
    const NIY = 'إنما الأعمال بالنيات';
    const agreed = lookupOf({ [NIY]: { matn: NIY, subjectIds: ['FC-000645', 'FC-000648'], atoms: ['حدثنا الحميدي حدثنا سفيان قال: ' + NIY, 'حدثنا عبد الله بن مسلمة قال: ' + NIY] } });
    const run = (mod, lead, lookup) => mod.applyTakhrij(lead + ' «' + NIY + '».', { env: ON, lookup });
    for (const [lead, want] of [
      ['ورُوي عن النبي صلى الله عليه وسلم أنه قال:', 'وثبت عن النبي صلى الله عليه وسلم أنه قال:'],
      ['وفيما رُوي عن رسول الله صلى الله عليه وسلم:', 'وفيما ثبت عن رسول الله صلى الله عليه وسلم:'],
      ['ويُروى عن النبي صلى الله عليه وسلم:', 'وثبت عن النبي صلى الله عليه وسلم:'],
    ]) {
      const out = (await run(T23, lead, agreed)).text;
      ok('B23 «' + lead.split(' ')[0] + '» before «(متفق عليه)» becomes «ثبت»', out.startsWith(want) && out.includes('(متفق عليه)'), JSON.stringify(out));
    }
    const weak = lookupOf({ [NIY]: { matn: NIY, subjectIds: ['FC-002061'], atoms: ['36 - " ' + NIY + ' ". ضعيف. رواه ابن عدي.'] } });
    const w = (await run(T23, 'ويُروى عن النبي صلى الله عليه وسلم:', weak)).text;
    ok('B23 control · before a weak one it is not touched', w.startsWith('ويُروى عن النبي'), JSON.stringify(w));
    const none = (await run(T23, 'ورُوي عن النبي صلى الله عليه وسلم:', lookupOf({}))).text;
    ok('B23 control · where the library proved nothing it is not touched', none.startsWith('ورُوي عن النبي'), JSON.stringify(none));
    const active = (await run(T23, 'وروى أبو هريرة أن النبي صلى الله عليه وسلم قال:', agreed)).text;
    ok('B23 control · «روى» with its alif maqṣūra is the active verb naming a narrator, and stays', active.startsWith('وروى أبو هريرة'), JSON.stringify(active));
    const src23 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = '    if (tamrid.changed) out = tamrid.text;';
    const mutated = src23.split(seam).join('    // mutant: the form of weakening kept');
    ok('MUTANT B23 tamrid seam applied', mutated !== src23);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b23-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b23] «رُوي» stands before «(متفق عليه)» again',
        (await run(mod, 'ورُوي عن النبي صلى الله عليه وسلم أنه قال:', agreed)).text.startsWith('ورُوي'));
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b25] · THE MATN AT THE HEAD OF THE ANSWER ─────────────────────────────────────
  // MEASURED at 92d3c7d: an answer opening on «الطهور شطر الإيمان». alone on its line gave zero
  // targets and no parentheses, while behind «قال رسول الله صلى الله عليه وسلم:» it gave «(مسلم)». The contract: framed with what the atom proves —
  // the parentheses the library proved, a Companion only where two books agree — and no speaker and
  // no narrator invented. A failed search writes nothing; an āyah or a dhikr is not a hadith target.
  console.log('\n--- B25. THE MATN AT THE HEAD OF THE ANSWER ---');
  {
    const T25 = await esm('lib/takhrij.js');
    const TUHUR = 'الطهور شطر الإيمان';
    const REST = '\n\nوالطهارة مفتاح الصلاة، ولا تصح الصلاة بغير طهارة.';
    const muslim = lookupOf({ [TUHUR]: { matn: TUHUR, subjectIds: ['FC-000648'], atoms: [atomFor(TUHUR, 'أبي مالك الأشعري')] } });
    const head = '«' + TUHUR + '».' + REST;
    const w = (await T25.applyTakhrij(head, { env: ON, lookup: muslim })).text;
    ok('B25 W · the matn opening the answer takes the parentheses the library proved', w === '«' + TUHUR + '» (مسلم).' + REST, JSON.stringify(w));
    ok('B25 ...and no speaker is invented in front of it', !/قال|رسول|النبي/u.test(w.split('\n')[0]), JSON.stringify(w));
    const two = lookupOf({ [TUHUR]: { matn: TUHUR, subjectIds: ['FC-000648', 'FC-000630'],
      atoms: [atomFor(TUHUR, 'أبي مالك الأشعري'), atomFor(TUHUR, 'أبي مالك الأشعري')] } });
    const named = (await T25.applyTakhrij(head, { env: ON, lookup: two })).text;
    ok('B25 sibling · where two books agree on the Companion he opens it, on the locked shape',
      /^عن أبي مالك الأشعري رضي الله عنه: «الطهور شطر الإيمان» \(مسلم\)\./u.test(named), JSON.stringify(named));
    const silent = (await T25.applyTakhrij(head, { env: ON, lookup: lookupOf({}) })).text;
    ok('B25 control · the library proved nothing: not one character is written', silent === head, JSON.stringify(silent));
    const VERSE = 'إن الصلاة كانت على المؤمنين كتابا موقوتا';
    const verseHead = '«' + VERSE + '».\n\nالصلاة فرض على كل مسلم بالغ عاقل.';
    const verseLookup = lookupOf({ [VERSE]: { matn: VERSE, subjectIds: ['FC-000648'], atoms: [atomFor(VERSE, 'ابن مسعود')] } });
    const verse = (await T25.applyTakhrij(verseHead, { env: ON, lookup: verseLookup })).text;
    ok('B25 control · an āyah at the head is not a hadith target, even where an atom quotes it', verse === verseHead, JSON.stringify(verse));
    const mid = 'والطهارة مفتاح الصلاة.\n«' + TUHUR + '».';
    ok('B25 control · an unframed quotation that does not open the answer is left as it was',
      (await T25.applyTakhrij(mid, { env: ON, lookup: muslim })).text === mid);
    const running = '«' + TUHUR + '» عبارة يكثر السؤال عنها.';
    ok('B25 control · a head quotation inside a running sentence is not a matn standing alone',
      (await T25.applyTakhrij(running, { env: ON, lookup: muslim })).text === running);
    const src25 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = '        if (opensTheAnswer(value, at, at + match[0].length, inner)) {';
    const mutated = src25.split(seam).join('        if (false) { // mutant');
    ok('MUTANT B25 head seam applied', mutated !== src25);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b25-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b25] the matn at the head leaves bare again',
        (await mod.applyTakhrij(head, { env: ON, lookup: muslim })).text === head);
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b27] · A QUESTION ABOUT THE GRADE AND THE SOURCE HAS A HEAD ────────────────────
  // MEASURED (the owner's battery; EZIK-SIDE-111-HANDOFF-2026-09-21-B row ٢٧; and «الطهور شطر الإيمان من
  // رواه؟» at 92d3c7d): the grade, the grader and the source were asked and not answered. The contract:
  // the answer opens with what the library proved — the book, the grade with its ladder grader — or
  // says plainly that the library did not prove it; never a denial; a split verdict is said split.
  console.log('\n--- B27. A QUESTION ABOUT THE GRADE AND THE SOURCE HAS A HEAD ---');
  {
    const T27 = await esm('lib/takhrij.js');
    const TUHUR = 'الطهور شطر الإيمان';
    const TALAB = 'طلب العلم فريضة على كل مسلم';
    const A_TUHUR = 'قال رسول الله صلى الله عليه وسلم: «' + TUHUR + '».\n\nومعناه أن الطهارة نصف الإيمان.';
    const A_TALAB = 'قال النبي صلى الله عليه وسلم: «' + TALAB + '».\n\nوالمقصود العلم الذي لا يسع المسلم جهله.';
    const muslim = lookupOf({ [TUHUR]: { matn: TUHUR, subjectIds: ['FC-000648'], atoms: [atomFor(TUHUR, 'أبي مالك الأشعري')] } });
    const run = async (mod, answer, question, lookup) => mod.applyTakhrij(answer, { env: ON, question, lookup });
    const w1 = (await run(T27, A_TUHUR, 'الطهور شطر الإيمان من رواه؟', muslim)).text;
    ok('B27 W · «من رواه؟» is answered first, from the library: «تخريج الحديث: مسلم.»',
      w1.startsWith('تخريج الحديث: مسلم.\n\n' + A_TUHUR.split('»')[0]), JSON.stringify(w1));
    const ruledLib = (rulings) => lookupOf({ [TALAB]: { matn: TALAB, subjectIds: ['FC-000652', ...Object.keys(rulings)],
      atoms: [atomFor(TALAB, 'أنس بن مالك'), ...Object.values(rulings).map((r) => rulingAtomFor(TALAB, r))] } });
    const w2 = (await run(T27, A_TALAB, 'ما صحة حديث «طلب العلم فريضة على كل مسلم»؟ اذكر تخريجه ومن حكم عليه', ruledLib({ 'FC-000788': 'صحيح' }))).text;
    ok('B27 W · «ومن حكم عليه؟» names the grader the atom proved, with his grade',
      w2.startsWith('تخريج الحديث: ابن ماجه، والحكم عليه في صحيح الجامع: صحيح.\n\n'), JSON.stringify(w2));
    const split = (await run(T27, A_TALAB, 'ما درجة هذا الحديث؟', ruledLib({ 'FC-000788': 'صحيح', 'FC-000791': 'ضعيف' }))).text;
    ok('B27 sibling · a split verdict is said split, with both graders, and nothing preferred',
      split.startsWith('تخريج الحديث: ابن ماجه، والحكم عليه مختلف: صحيح في صحيح الجامع، وضعيف في ضعيف الجامع.\n\n'), JSON.stringify(split));
    const WATAN = 'حب الوطن من الإيمان';
    const A_WATAN = 'قال رسول الله صلى الله عليه وسلم: «' + WATAN + '».\n\nوحب الوطن أمر فطري.';
    const fab = lookupOf({ [WATAN]: { matn: WATAN, subjectIds: ['FC-002061'], atoms: ['36 - " ' + WATAN + ' ". موضوع.'] } });
    const w3 = (await run(T27, A_WATAN, 'هل حديث حب الوطن من الإيمان صحيح؟', fab)).text;
    ok('B27 sibling · «(لا يثبت مرفوعا)» opens as a sentence naming the grader and his word',
      w3.startsWith('الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم، والحكم عليه في السلسلة الضعيفة: موضوع.\n\n'), JSON.stringify(w3));
    const none = (await run(T27, A_TUHUR, 'ما درجة هذا الحديث؟', lookupOf({}))).text;
    ok('B27 sibling · the library proved nothing: it says so, and denies nothing',
      none.startsWith(T27.GRADING_HEAD_NOT_PROVED + '\n\n') && !/لا أصل له|لا يثبت|موضوع/u.test(T27.GRADING_HEAD_NOT_PROVED), JSON.stringify(none));
    const threw = async () => { throw new Error('socket hang up'); };
    ok('B27 control · a library that failed is not «did not prove»: no head',
      (await run(T27, A_TUHUR, 'ما درجة هذا الحديث؟', threw)).text === A_TUHUR);
    ok('B27 control · a question that asks no grade and no source gets no head',
      !(await run(T27, A_TUHUR, 'ما حكم الوضوء قبل الصلاة؟', muslim)).text.startsWith('تخريج'));
    const TWO = A_TUHUR + '\n\nوقال صلى الله عليه وسلم: «إنما الأعمال بالنيات».';
    ok('B27 control · with two matns each keeps its own parentheses and no head chooses between them',
      !(await run(T27, TWO, 'ما درجة هذه الأحاديث؟', muslim)).text.startsWith('تخريج'));
    const STATED = 'قال رسول الله صلى الله عليه وسلم: «' + TUHUR + '» رواه البخاري.';
    ok('B27 control · where the prose already states its own attribution, no head argues with it',
      !(await run(T27, STATED, 'من رواه؟', muslim)).text.startsWith('تخريج'));
    ok('B27 wiring · api/ask.js hands the reader\'s question to the takhrij pass',
      /applyTakhrij\(readerText, \{[\s\S]{0,200}question: questionText,/u.test(require('fs').readFileSync(path.join(REPO, 'api/ask.js'), 'utf8')));
    const src27 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = "  if (head) out = head + '\\n\\n' + out;";
    const mutated = src27.split(seam).join('  // mutant: no head');
    ok('MUTANT B27 head seam applied', mutated !== src27);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b27-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b27] «من رواه؟» is left unanswered again',
        !(await run(mod, A_TUHUR, 'الطهور شطر الإيمان من رواه؟', muslim)).text.startsWith('تخريج'));
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── [111-b27b] · THE HEAD SPEAKS OF THE TEXT THAT WAS ASKED ABOUT, AND OF NOTHING ELSE ───────────
  // MEASURED on the owner's battery (the batch-4 preview 7f671f7, question 2): «حديث «خير الأسماء ما حمد
  // وعبد» هل له أصل؟» opened on «تخريج الحديث: أبو داود، …» — the book of ANOTHER matn in the answer. The
  // contract: the head is about the quoted text alone — what the library proves for it, or «لم تُثبت
  // المكتبة هذا اللفظ…» — never a denial and never another matn's book; that matn keeps its parentheses.
  console.log('\n--- B27b. THE HEAD SPEAKS OF THE TEXT THAT WAS ASKED ABOUT ---');
  {
    const T27b = await esm('lib/takhrij.js');
    const KHAYR = 'خير الأسماء ما حمد وعبد';
    const AHABB = 'أحب الأسماء إلى الله عبد الله وعبد الرحمن، وأصدقها حارث وهمام';
    const A_Q2 = 'ليس له أصل، وهو حديث موضوع لا تصح نسبته إلى النبي صلى الله عليه وسلم.\n\nوالثابت في هذا الباب قوله صلى الله عليه وسلم: «' + AHABB + '».\n\nفالتسمية بعبد الله وعبد الرحمن مستحبة.';
    const Q2 = 'حديث «' + KHAYR + '» هل له أصل؟';
    const TUHUR = 'الطهور شطر الإيمان';
    const WATAN = 'حب الوطن من الإيمان';
    const KALIMA = 'الكلمة الطيبة صدقة';
    const SULAMA = 'كل سلامى من الناس عليه صدقة، والكلمة الطيبة صدقة';
    const table = {
      [AHABB]: { matn: AHABB, subjectIds: ['FC-000656'], atoms: [atomFor(AHABB, 'أبي وهب الجشمي')] },
      [TUHUR]: { matn: TUHUR, subjectIds: ['FC-000648'], atoms: [atomFor(TUHUR, 'أبي مالك الأشعري')] },
      [WATAN]: { matn: WATAN, subjectIds: ['FC-002061'], atoms: ['36 - " ' + WATAN + ' ". موضوع.'] },
      [SULAMA]: { matn: SULAMA, subjectIds: ['FC-000648'], atoms: [atomFor(SULAMA, 'أبي هريرة')] },
    };
    const lib = lookupOf(table);
    const run = async (answer, question, lookup = lib) => (await T27b.applyTakhrij(answer, { env: ON, question, lookup })).text;
    const w = await run(A_Q2, Q2);
    ok('B27b W · question 2: the head does not credit the asked text to the other matn\'s book',
      w.startsWith(T27b.GRADING_HEAD_LAFZ_NOT_PROVED + '\n\n') && !w.split('\n')[0].includes('أبو داود'), JSON.stringify(w));
    ok('B27b W · ...it denies nothing, and the other matn keeps its parentheses where they stand',
      !/لا أصل له|موضوع|لا يثبت/u.test(T27b.GRADING_HEAD_LAFZ_NOT_PROVED) && w.includes('«' + AHABB + '» (أبو داود · لم يوقف على حكم)'), JSON.stringify(w));
    const graded = await run('قال رسول الله صلى الله عليه وسلم: «' + TUHUR + '».\n\nوالطهارة شطر.', 'ما درجة حديث «' + WATAN + '»؟');
    ok('B27b sibling · the asked text the library does prove is headed with ITS grader, not the answer\'s matn',
      graded.startsWith('الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم، والحكم عليه في السلسلة الضعيفة: موضوع.\n\n') && graded.includes('«' + TUHUR + '» (مسلم)'), JSON.stringify(graded));
    const near = await run('هذا اللفظ مشهور.\n\nوالثابت في الباب قوله صلى الله عليه وسلم: «' + TUHUR + '».', 'حديث «اختلاف أمتي رحمة» هل له أصل؟');
    ok('B27b sibling · no origin for the asked text, a sound hadith near it in the answer: «not this wording», and the sound one keeps «(مسلم)»',
      near.startsWith(T27b.GRADING_HEAD_LAFZ_NOT_PROVED + '\n\n') && near.includes('«' + TUHUR + '» (مسلم)'), JSON.stringify(near));
    const A_TUHUR = 'قال رسول الله صلى الله عليه وسلم: «' + TUHUR + '».\n\nومعناه أن الطهارة نصف الإيمان.';
    ok('B27b control · the answer\'s matn IS the asked text (question 9\'s shape): b27\'s head, byte for byte',
      (await run(A_TUHUR, 'حديث «' + TUHUR + '» من رواه؟')) === (await run(A_TUHUR, 'الطهور شطر الإيمان من رواه؟'))
        && (await run(A_TUHUR, 'حديث «' + TUHUR + '» من رواه؟')).startsWith('تخريج الحديث: مسلم.\n\n'));
    ok('B27b control · the asked text inside a longer matn of the answer is that matn: b27\'s head',
      (await run('قال رسول الله صلى الله عليه وسلم: «' + SULAMA + '».', 'حديث «' + KALIMA + '» من رواه؟')).startsWith('تخريج الحديث: مسلم.\n\n'));
    ok('B27b control · the asked text and another matn: two matns, no head, as b27',
      !(await run(A_TUHUR + '\n\nوقال صلى الله عليه وسلم: «' + AHABB + '».', 'حديث «' + TUHUR + '» من رواه؟')).startsWith('تخريج'));
    const threwForAsked = async (matns, options) => {
      if (matns.includes(KHAYR)) throw new Error('socket hang up');
      return lib(matns, options);
    };
    const failed = await run(A_Q2, Q2, threwForAsked);
    ok('B27b control · a failed lookup of the asked text is no «not proved»: no head at all',
      failed.startsWith('ليس له أصل') && !failed.includes('تخريج الحديث'), JSON.stringify(failed));
    const src = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = '  const head = await headForTheAskedText(input, entries, callFailures, gradingHead(input.question, entries, callFailures));';
    const mutated = src.split(seam).join('  const head = gradingHead(input.question, entries, callFailures); // mutant');
    ok('MUTANT B27b asked-text seam applied', mutated !== src);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b27b-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b27b] question 2 is headed with «أبو داود» again',
        (await mod.applyTakhrij(A_Q2, { env: ON, question: Q2, lookup: lib })).text.split('\n')[0].includes('أبو داود'));
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  // ── BATCH 4 [b28] · THE LAFZ FUNCTION TRIES THE INTENDED WORD ────────────────────────────────
  // MEASURED at 2aaf987 (EZIK-CX-M111 row 28), unchanged at 92d3c7d: «الصلاة على وقتها» → «الصلاات على
  // وقتها»، and in «النية والصدقة والأعمال بالنيات» the cap of two was spent before «بالنيات». The owner's
  // ruling: the intended word, inside the locked rule (one word, نيات ⇆ نية) and under its cap.
  console.log('\n--- B28. THE LAFZ FUNCTION TRIES THE INTENDED WORD ---');
  {
    const T28 = await esm('lib/takhrij.js');
    ok('B28 W · «الصلاة» is not swapped into «الصلاات», a form no book writes',
      JSON.stringify(T28.lafzVariants('الصلاة على وقتها')) === '[]', JSON.stringify(T28.lafzVariants('الصلاة على وقتها')));
    const MIX = 'النية والصدقة والأعمال بالنيات';
    ok('B28 W · the plural the door was opened for is tried first, before the cap is spent',
      T28.lafzVariants(MIX)[0] === 'النية والصدقة والأعمال بالنية', JSON.stringify(T28.lafzVariants(MIX)));
    ok('B28 sibling · a singular is still read to its plural when nothing else is there',
      JSON.stringify(T28.lafzVariants('إنما الأعمال بالنية')) === JSON.stringify(['إنما الأعمال بالنيات']));
    ok('B28 control · the cap and the one-word rule are the same',
      T28.LAFZ_MAX_VARIANTS === 2 && T28.lafzVariants(MIX).length === 2 && T28.lafzVariants(MIX).every((v) => {
        const a = MIX.split(' '); const b = v.split(' ');
        return a.length === b.length && a.filter((w, i) => w !== b[i]).length === 1;
      }));
    // Through the real pass: البخاري carries the matn as the answer writes it, مسلم only in the singular.
    const MUSLIM_WORDING = 'النية والصدقة والأعمال بالنية';
    const lookup28 = async (matns, options) => {
      const ids = (options && options.bookIds) || [];
      const muslim = ids.length === 1 && ids[0] === 'FC-000648';
      return matns.map((matn) => {
        if (muslim) return matn === MUSLIM_WORDING
          ? { matn, subjectIds: ['FC-000648'], atoms: [atomFor(MUSLIM_WORDING, 'عمر بن الخطاب')] } : { matn, subjectIds: [], atoms: [] };
        return matn === MIX ? { matn, subjectIds: ['FC-000645'], atoms: [atomFor(MIX, 'عمر بن الخطاب')] } : { matn, subjectIds: [], atoms: [] };
      });
    };
    const A28 = answerWith(MIX);
    const live = (await T28.applyTakhrij(A28, { env: ON, lookup: lookup28 })).text;
    ok('B28 W · through the pass: مسلم is asked in his own wording and the matn is «(متفق عليه)»',
      live.includes('(' + L.AGREED_UPON + ')'), JSON.stringify(live));
    const src28 = require('fs').readFileSync(path.join(REPO, 'lib/takhrij.js'), 'utf8').replace(/\r\n/g, '\n');
    const seam = '  tries.sort((a, b) => a.kind - b.kind || a.i - b.i);';
    const mutated = src28.split(seam).join('  // mutant: the words in the order they stand, as before');
    ok('MUTANT B28 order seam applied', mutated !== src28);
    const tmp = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'ustaz-b28-mut-'));
    try {
      const file = path.join(tmp, 'takhrij.mjs');
      require('fs').writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + 'file:///' + path.resolve(REPO, 'lib', spec).replace(/\\/g, '/') + q), 'utf8');
      const mod = await import('file:///' + file.replace(/\\/g, '/'));
      ok('MUTANT KILLED: without [b28] the cap is spent first and the matn leaves as «(البخاري)» again',
        (await mod.applyTakhrij(A28, { env: ON, lookup: lookup28 })).text.includes('(البخاري)'));
    } finally {
      try { require('fs').rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  console.log(`\n=== ${checks - failures}/${checks} — ${failures ? 'FAIL' : 'PASS'} ===`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('GUARD THREW: ' + (error && error.stack ? error.stack : String(error)));
  process.exit(1);
});
