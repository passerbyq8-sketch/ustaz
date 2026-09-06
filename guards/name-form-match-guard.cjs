// guards/name-form-match-guard.cjs -- gate `nameform`: ع-٩٧, ONE MAN WRITTEN TWO WAYS.
//
// THE DEFECT THIS GATE PINS. lib/output-reviewer.js keeps an attribution over a library atom when
// the atom's AUTHOR is the man the sentence names. It decided "is the man" by `containsWholeWords`
// alone, which asks the claim to sit inside the author's name (or the author's inside the claim)
// as an ADJACENT RUN of whole words. That is right for «ابن قدامة» reaching «ابن قدامة المقدسي»,
// and it is silent for a man the shelf files under a DIFFERENT FORM of the same name: «ابن عباس»
// is «عبد الله بن عباس» on the shelf and neither string is a run inside the other, so a true
// credit was struck off a page the man actually wrote. Measured over the frozen بن باز corpus
// (first 3000 records, 254 distinct claimed names x 2911 shelf authors = 739,394 pairs):
// 27 pairs kept before, 44 after, +17 true men, ZERO wrong men, ZERO true attributions lost.
//
// WHAT IS DRIVEN AND WHAT IS ONLY READ. Sections B and C drive the SHIPPED reviewer end to end --
// `reviewAnswer` over rows built by lib/free-brain/loop.js's own `reviewerEvidence` -- and read
// KEEP/STRIP off the reviewer's own annotation and its own tag, never off a substring search for
// the name. Section A reads the table out of the shipped source and pins it row by row and form by
// form, because a closed list that nobody pins is a list that grows by accident. Section D is the
// only section that does NOT speak about product output, and its title says so in its first
// words: it evaluates the shipped mechanism ALONE, for the one fact the product path
// contradicts. Section E mutates the shipped file three times and each mutant flips exactly one
// row of the sections above; a mutant that flips nothing would be a hole reported as a pass.
//
// WHAT THIS GATE DOES NOT CLAIM, SAID OUT LOUD. `ع-١٠٠` -- «أبو ذر» credited to three different
// men -- IS STILL OPEN. The third licence can only ADD (it is the last clause of an `||`), so the
// unique-man condition inside it cannot withdraw what `containsWholeWords` granted before it, and
// «أبو ذر» is granted there. D1 below therefore says «the mechanism refuses him» and says in the
// same breath that the product still accepts him. No check in this file asserts that ع-١٠٠ is
// closed, because it is not.
//
// ZERO NETWORK, ZERO TOKEN, ZERO SERVER. Nothing here is fetched. Check LABELS name the Arabic
// forms under test, because a transliterated label cannot say WHICH form a row is pinning; the
// measured FAILURE DETAIL is transliterated to '?' before printing.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const REVIEWER_REL = 'lib/output-reviewer.js';
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

let checks = 0;
let failures = 0;
const ascii = (value) => String(value).replace(/[^\x20-\x7E]/g, '?');

function ok(name, condition, detail) {
  checks += 1;
  if (condition) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail === undefined ? '' : '\n        ' + ascii(detail)));
  return false;
}

function section(title) {
  console.log('\n-- ' + title + ' ' + '-'.repeat(Math.max(2, 70 - title.length)));
}

// ── THE NINE ROWS, ADJUDICATED MAN BY MAN, WRITTEN HERE SO THE SOURCE CAN BE PINNED AGAINST THEM ──
//
// This is not a copy kept in sympathy with the source; it is the OTHER HALF of section A, and A
// fails if the two ever differ by one letter. The list is CLOSED at nine men on purpose: there is
// no rule here that generalises to a tenth, and «ابن مفلح» and «الخطابي» were struck out by the
// owner before shipping -- the first because two men sit on the shelf under the same form and
// choosing between them would be a guess, the second because the two-word floor refuses him
// before the table is ever consulted, so a row for him would fake a coverage he never had.
const EXPECTED_ROWS = [
  { man: 'man-ibn-abd-al-barr', forms: ['ابن عبد البر', 'أبو عمر ابن عبدالبر'] },
  { man: 'man-ibn-masud', forms: ['عبد الله بن مسعود السني', 'ابن مسعود', 'له ابن مسعود', 'به ابنُ مسعودٍ'] },
  { man: 'man-ibn-al-athir', forms: ['ابن الأثير، أبو السعادات', 'أبو السعادات بن الأثير'] },
  { man: 'man-ibn-abbas', forms: ['عبد الله بن عباس', 'ابن عباس'] },
  { man: 'man-ibn-hazm', forms: ['ابن حزم', 'أبو محمد بن حزم الإمام المشهور'] },
  { man: 'man-ahmad', forms: ['أحمد بن حنبل', 'أحمد رحمه الله'] },
  { man: 'man-malik', forms: ['مالك بن أنس', 'مالك رحمه الله', 'مالك في مسائل قليلة'] },
  { man: 'man-ibn-taymiyya', forms: ['ابن تيمية', 'الشيخ تقي الدين أحمد بن تيمية رحمه الله ممن ينكر ذلك'] },
  { man: 'man-al-rajihi', forms: ['عبد العزيز الراجحي', 'عبدالعزيز الراجحي'] },
];

// ── THE MATN AND THE ROW SHAPE ──────────────────────────────────────────────
//
// The passage is one sentence and the atom's text is that same sentence, so `supportsSentence`
// -- the intersection test that still has to pass AFTER the name is licensed -- is satisfied for
// every pair below. That is deliberate and it is a CEILING, not a claim about production: these
// rows measure the name rule and nothing else, and a turn holding a page that does not support
// its sentence still loses the name at `supportsSentence` whatever this table says.
const MATN = 'الوضوءُ من لحمِ الإبلِ واجبٌ عندَ جمهورِ أهلِ الحديثِ، وقد ثبتَ فيه الأمرُ.';
const bookRow = (author, matn) => ({
  kind: 'lib_book', title: 'كتابُ الطهارة', url: '', publisher: author,
  text: matn, recordId: 'lib:nameform-1', bookTitle: 'كتابُ الطهارة',
  author, locator: '', matnCut: false, ref: 1,
});

// ONE ROW IS A RECORDED SENTENCE AND NOT THE FRAME, AND IT HAD TO BE. «قال X: ...» is a frame
// invented for this file, and the capture class -- frozen by order, untouched here -- does not
// record «قال الشيخ تقي الدين ... رحمه الله ...» as a claimed authority at all: measured, the
// framed form returns NEITHER, no attribution ever reaching the name rule. The sentence the man
// actually appears in does. So B12 drives record 1554 of the frozen بن باز corpus verbatim -- the
// sentence whose credit the reviewer REMOVED before this licence existed
// (action: removed-unsupported-attribution) -- rather than reporting a row the frame had silently
// emptied. Nothing is generalised from that: the other eleven rows keep the frame.
const RECORD_1554 = 'والشيخ تقي الدين أحمد بن تيمية رحمه الله ممن ينكر ذلك ويرى أنه بدعة.';

// ── THE MECHANISM, LIFTED OUT OF THE SHIPPED FILE RATHER THAN RETYPED ───────
//
// `sameManByNameForm` is INLINED in lib/output-reviewer.js and not exported -- that module is pure
// by contract (:48-50: its mutant harness copies the file ALONE into a temp directory, so a single
// relative specifier makes every mutant twin fail to resolve). So the block is cut out of the
// shipped source at its own two anchors and evaluated in a vm. It throws rather than returning ''
// when an anchor is gone: an extraction that can come back empty, handed to a negative assertion,
// is the exact shape guards/vacuous-assertion-guard.cjs exists to forbid.
function mechanismFrom(source) {
  const start = source.indexOf('const NAME_FORM_ROWS = Object.freeze([');
  if (start === -1) throw new Error('NAME_FORM_ROWS anchor is gone from ' + REVIEWER_REL);
  const fnAt = source.indexOf('function sameManByNameForm(', start);
  if (fnAt === -1) throw new Error('sameManByNameForm anchor is gone from ' + REVIEWER_REL);
  const end = source.indexOf('\n}\n', fnAt);
  if (end === -1) throw new Error('sameManByNameForm has no closing brace in ' + REVIEWER_REL);
  const block = source.slice(start, end + 3);
  const context = vm.createContext({});
  vm.runInContext(block + '\nglobalThis.__mech = { sameManByNameForm, nameFormMan, NAME_FORM_ROWS };',
    context, { filename: 'nameform-block.js' });
  return context.__mech;
}

// ── ONE MUTANT TWIN OF THE REVIEWER, AND IT REFUSES TO REPORT A MUTATION THAT DID NOT HAPPEN ──
//
// Two separate refusals, because they fail for different reasons: the seam no longer being in the
// source, and the mutated bytes not arriving on disk. Either one, silently tolerated, turns a
// mutant into a false PASS.
async function mutantReviewer(temp, name, mutate, probe) {
  const lf = read(REVIEWER_REL);
  const changed = mutate(lf);
  if (changed === lf) throw new Error('mutation seam moved: ' + name);
  if (/(\bfrom\s*')(\.\.?\/)/.test(changed)) throw new Error('the reviewer acquired a relative import');
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(REVIEWER_REL));
  fs.writeFileSync(file, changed, 'utf8');
  const written = fs.readFileSync(file, 'utf8');
  if (written.indexOf(probe) === -1 || lf.indexOf(probe) !== -1) {
    throw new Error('mutant not on disk (or its probe is not distinctive): ' + name);
  }
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

async function main() {
  console.log('=== name-form-match -- one man, two ways of writing his name (ع-97) ===');

  const source = read(REVIEWER_REL);
  const loop = await esm('lib/free-brain/loop.js');
  const reviewer = await esm(REVIEWER_REL);
  const STRIP_TAG = reviewer.REVIEW_TAGS.ATTRIBUTION_REMOVED;

  // KEEP / STRIP is read off the reviewer's own annotation and its own tag, never off a substring
  // search for the name: `generalizeAttribution` can leave a name standing in a sentence it also
  // marked, and «the name is still in the text» would have called that a keep.
  const verdictOn = (RV, sentence, author, matn) => {
    const out = RV.reviewAnswer({
      text: sentence,
      evidence: [bookRow(author, matn)].map(loop.reviewerEvidence),
      domain: 'fiqh',
    });
    const kept = out.annotations.some((a) => a.action === 'kept-sourced-attribution');
    const stripped = out.text.indexOf(STRIP_TAG) !== -1;
    return kept ? 'KEEP' : (stripped ? 'STRIP' : 'NEITHER');
  };
  const verdict = (RV, claimed, author) => verdictOn(RV, 'قال ' + claimed + ': ' + MATN, author, MATN);

  // ==========================================================================
  section('A. THE TABLE IS CLOSED, AND EVERY ROW OF IT IS PINNED HERE');
  // ==========================================================================

  const mech = mechanismFrom(source);
  const shipped = mech.NAME_FORM_ROWS.map((row) => ({ man: row.man, forms: [...row.forms] }));

  ok('A1  the shipped table holds exactly nine men -- a tenth row is a decision, not an edit',
    shipped.length === 9, 'shipped rows = ' + shipped.length);
  ok('A2  the men are the nine adjudicated, in order and by id',
    JSON.stringify(shipped.map((r) => r.man)) === JSON.stringify(EXPECTED_ROWS.map((r) => r.man)),
    'shipped: ' + shipped.map((r) => r.man).join(', '));

  for (const want of EXPECTED_ROWS) {
    const got = shipped.find((r) => r.man === want.man);
    ok('A3  every form of ' + want.man + ' is on the shelf and nothing else is',
      Boolean(got) && JSON.stringify(got.forms) === JSON.stringify(want.forms),
      got ? 'shipped forms = ' + got.forms.join(' | ') : 'row missing entirely');
  }

  ok('A4  no form is shared by two men -- a form on two rows would resolve to NOBODY at runtime',
    (() => {
      const seen = new Map();
      for (const row of shipped) for (const form of row.forms) {
        if (seen.has(form) && seen.get(form) !== row.man) return false;
        seen.set(form, row.man);
      }
      return true;
    })(), 'two rows carry the same form');

  ok('A5  the third licence is WIRED -- the reviewer consults the table where the name is decided',
    source.includes('      || containsWholeWords(claimed, author)\n'
      + '      || sameManByNameForm(item.author, attribution.claimed);'),
    'the licence line is not the last clause of the `named` expression');

  ok('A6  the licence can only ADD -- `supportsSentence` still has to pass after it',
    source.includes('    return named && supportsSentence(sentence, item);'),
    'the intersection test no longer gates the licensed name');

  ok('A7  the module stays pure by contract -- the mechanism is inlined, not imported',
    (source.match(/^import\s/gmu) || []).length === 0,
    'lib/output-reviewer.js acquired ' + (source.match(/^import\s/gmu) || []).length + ' import(s)');

  // ==========================================================================
  section('B. THE PRODUCT PATH, POSITIVE: the shelf form and the cited form are one man');
  // ==========================================================================
  //
  // All nine men reach the reader through this path. Eleven rows use the frame; B12 uses the
  // recorded sentence, for the reason measured beside RECORD_1554 above.

  const POSITIVE = [
    ['B1  Ibn Abd al-Barr: «أبو عمر...» cited, «ابن عبد البر» on the shelf',
      'أبو عمر ابن عبدالبر', 'ابن عبد البر'],
    ['B2  Ibn Masud: the kunya cited, the full name on the shelf',
      'ابن مسعود', 'عبد الله بن مسعود السني'],
    ['B3  Ibn Masud again, the capture carrying a leading preposition',
      'له ابن مسعود', 'عبد الله بن مسعود السني'],
    ['B4  Ibn Masud a third time, the capture carrying case marks',
      'به ابنُ مسعودٍ', 'عبد الله بن مسعود السني'],
    ['B5  Ibn al-Athir: the shelf writes the kunya after a comma, the citation before the nasab',
      'أبو السعادات بن الأثير', 'ابن الأثير، أبو السعادات'],
    ['B6  Ibn Abbas: the kunya cited, «عبد الله بن عباس» on the shelf',
      'ابن عباس', 'عبد الله بن عباس'],
    ['B7  Ibn Hazm: the citation carries his kunya and an epithet, the shelf carries neither',
      'أبو محمد بن حزم الإمام المشهور', 'ابن حزم'],
    ['B8  Ahmad: the citation carries the prayer, the shelf carries the nasab',
      'أحمد رحمه الله', 'أحمد بن حنبل'],
    ['B9  Malik: the citation carries the prayer, the shelf carries the nasab',
      'مالك رحمه الله', 'مالك بن أنس'],
    ['B10 Malik again, the capture running on into the clause around him',
      'مالك في مسائل قليلة', 'مالك بن أنس'],
    ['B11 al-Rajihi: the citation spells «عبدالعزيز» joined, the shelf splits it',
      'عبدالعزيز الراجحي', 'عبد العزيز الراجحي'],
  ];
  for (const [label, claimed, author] of POSITIVE) {
    const got = verdict(reviewer, claimed, author);
    ok(label + ' -> the name STANDS', got === 'KEEP',
      'got ' + got + ' for claimed=' + claimed + ' author=' + author);
  }

  ok('B12 Ibn Taymiyya, in the sentence he was actually struck out of (corpus record 1554)'
    + ' -> the name STANDS',
    verdictOn(reviewer, RECORD_1554, 'ابن تيمية', RECORD_1554) === 'KEEP',
    'got ' + verdictOn(reviewer, RECORD_1554, 'ابن تيمية', RECORD_1554));

  ok('B13 and NINE distinct men reach the reader this way -- not one man twelve times',
    new Set([...POSITIVE.map(([, claimed]) => claimed), 'الشيخ تقي الدين أحمد بن تيمية رحمه الله ممن ينكر ذلك']
      .map((claimed) => mech.nameFormMan(claimed))).size === 9,
    'distinct men over the positive rows = '
      + new Set([...POSITIVE.map(([, c]) => c), 'الشيخ تقي الدين أحمد بن تيمية رحمه الله ممن ينكر ذلك']
        .map((c) => mech.nameFormMan(c))).size);

  // ==========================================================================
  section('C. THE PRODUCT PATH, NEGATIVE: a name that looks like his and is another man');
  // ==========================================================================
  //
  // These four are the reason the table is a table and not a rule. Every one of them shares words
  // -- and in two cases shares the very nisba -- with a man in the table, and every one of them is
  // somebody else. They are refused before the licence and they stay refused after it.

  const NEGATIVE = [
    ['C1  «ابن باز» cited over a book by محمد عباس الباز',
      'ابن باز', 'محمد عباس الباز'],
    ['C2  «ابن عثيمين» cited over a book by عبد الله بن صالح العثيمين',
      'ابن عثيمين', 'عبد الله بن صالح العثيمين'],
    ['C3  «مطلق الجاسر» cited over a book by محمد بن عبدالله المطلق',
      'مطلق الجاسر', 'محمد بن عبدالله المطلق'],
    ['C4  «عبدالعزيز الراجحي» cited over a book by عبد العزيز بن فيصل الراجحي',
      'عبدالعزيز الراجحي', 'عبد العزيز بن فيصل الراجحي'],
  ];
  for (const [label, claimed, author] of NEGATIVE) {
    const got = verdict(reviewer, claimed, author);
    ok(label + ' -> the name COMES OFF', got === 'STRIP',
      'got ' + got + ' for claimed=' + claimed + ' author=' + author);
  }

  ok('C5  and a citation naming TWO men at once names NEITHER -- the unique-man condition',
    verdict(reviewer, 'ابن عباس و ابن مسعود', 'عبد الله بن مسعود السني') === 'STRIP',
    'a claim landing on two rows was credited to one of them');

  // ==========================================================================
  section('D. THE MECHANISM ALONE -- NOT A CLAIM ABOUT WHAT THE READER SEES');
  // ==========================================================================
  //
  // The check below evaluates `sameManByNameForm` on its own. It says NOTHING about the answer the
  // reader receives -- and it says the opposite out loud, because the reader still receives it.

  ok('D1  MECHANISM ONLY (not product output): the mechanism refuses «أبو ذر» because he is'
    + ' not in the table -- AND THE PRODUCT STILL CREDITS HIM, so ع-100 IS OPEN, not closed',
    mech.nameFormMan('أبو ذر') === ''
      && mech.sameManByNameForm('أبو ذر القلموني', 'أبو ذر') === false
      && verdict(reviewer, 'أبو ذر', 'أبو ذر القلموني') === 'KEEP',
    'the product verdict for «أبو ذر» moved -- if it now STRIPs, ع-100 closed and this'
      + ' check must be rewritten to say so');

  // ==========================================================================
  section('E. MUTANTS -- each one flips exactly one row above');
  // ==========================================================================

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-nameform-'));

  const mNoLicence = await mutantReviewer(temp, 'nameform-no-licence',
    (s) => s.replace('      || containsWholeWords(claimed, author)\n'
      + '      || sameManByNameForm(item.author, attribution.claimed);',
    '      || containsWholeWords(claimed, author);  // mutant-nameform-no-licence'),
    'mutant-nameform-no-licence');
  ok('E1  MUTANT KILLED: take the third licence away and the man loses the credit for his own page',
    verdict(mNoLicence, 'ابن عباس', 'عبد الله بن عباس') === 'STRIP'
      && verdict(mNoLicence, 'عبدالعزيز الراجحي', 'عبد العزيز الراجحي') === 'STRIP',
    'B6/B11 still KEEP without the licence, so they were never testing it');

  const mScattered = await mutantReviewer(temp, 'nameform-scattered',
    (s) => s.replace('      const partial = formWords.length >= NAME_FORM_MIN_FORM_WORDS'
      + ' && nameFormRun(nameWords, formWords);',
    '      const partial = formWords.length >= NAME_FORM_MIN_FORM_WORDS'
      + ' && formWords.every((w) => nameWords.includes(w));  // mutant-nameform-scattered'),
    'mutant-nameform-scattered');
  ok('E2  MUTANT KILLED: scatter the words of a form and «عبد العزيز الراجحي»'
    + ' reaches عبد العزيز بن فيصل الراجحي, who is another man',
    verdict(mScattered, 'عبدالعزيز الراجحي', 'عبد العزيز بن فيصل الراجحي') === 'KEEP'
      && verdict(mScattered, 'عبدالعزيز الراجحي', 'عبد العزيز الراجحي') === 'KEEP',
    'C4 did not flip, so the adjacent-run condition is not what is holding it');

  const mFirstHit = await mutantReviewer(temp, 'nameform-first-hit',
    (s) => s.replace("  return hits.size === 1 ? [...hits][0] : '';"
      + '   // A NAME SHARED BY TWO MEN NAMES NEITHER',
    "  return [...hits][0] || '';  // mutant-nameform-first-hit"),
    'mutant-nameform-first-hit');
  ok('E3  MUTANT KILLED: drop the unique-man condition and a citation naming two men credits one',
    verdict(mFirstHit, 'ابن عباس و ابن مسعود', 'عبد الله بن مسعود السني') === 'KEEP'
      && verdict(mFirstHit, 'ابن عباس', 'عبد الله بن عباس') === 'KEEP',
    'C5 did not flip, so the unique-man condition is not what is holding it');

  ok('E4  and the table itself is what the mutants left alone -- nine rows in every twin',
    mechanismFrom(read(REVIEWER_REL)).NAME_FORM_ROWS.length === 9,
    'the shipped table changed while this guard was running');

  try { fs.rmSync(temp, { recursive: true, force: true }); } catch (error) { /* scratch only */ }

  console.log('\n=== name-form-match: ' + (checks - failures) + '/' + checks
    + ' checks, ' + failures + ' failure(s) ===');
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.log('  FAIL  guard aborted: ' + ascii(error && error.stack ? error.stack : error));
  process.exitCode = 1;
});
