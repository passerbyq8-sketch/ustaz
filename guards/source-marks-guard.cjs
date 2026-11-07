// guards/source-marks-guard.cjs -- brain35 B-4 (2026-11-06; DIAG 35.10, AYAH-CARD): EVERY PARAGRAPH SAYS WHERE IT CAME FROM.
//
// MEASURED on the forty delivered answers. (1) Q28 lines 14-17: an Ibn Baz paraphrase stood between Ibn Baz's own card and
// Ibn al-Arabi's book card with nothing of its own, so a reader attributes it to the card that FOLLOWS it; cards are emitted
// after the unit that first cites a row, so a unit citing a row already shown, deferred or deduplicated gets none. (2) ten
// answers ended on «المصدر: الموسوعة الفقهية الكويتية.» while showing no encyclopedia card at all -- a source line for
// nothing visible. (3) Q33 quotes ﴿ولو أنا كتبنا عليهم﴾ at its fifth line and its verse card arrives at the fifteenth.
//
// WHAT THIS PINS, offline, no model, no network:
//   1. shortSourceMark: a page row by its publisher, a book row by its book title, a long name cut, an empty row silent;
//   2. the mark goes on a unit whose rows' cards are NOT about to follow it, once, inside the final punctuation, never
//      twice, never on a heading; a unit whose card follows it, or whose owed card will follow it, gets none;
//   3. one definition of the card-binding rule for the emitter and the mark (cardSupportsUnit);
//   4. the encyclopedia tail: the BW2 call site writes the global line only when the encyclopedia rows the answer leaned
//      on are not already named by a card or a mark;
//   5. the verse card waits for the unit that quotes its verse (the mushaf's own refs), goes out directly after it, and
//      goes out where the writer put it when no released unit quotes it;
//   6. four mutants, each killed.
//
// Usage: node guards/source-marks-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300) : ''));
  return false;
};
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?marks=' + Date.now());
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const ascii = (s) => String(s).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 200);

(async () => {
  console.log('=== source-marks-guard -- brain35 B-4: the paragraph names its source, and the verse card follows its verse ===');
  const U = await esm('lib/bw2-units.js');
  const IBN_BAZ = 'ابن باز';
  const PAGE_TEXT = 'الآية تنهى عن القول بلا علم وعن اتباع الظن في أمور الدين.';
  const BOOK_TEXT = 'وفي الآية دليل على المنع من القول بالظن في الأحكام.';
  const PAGE = { ref: 1, kind: 'fatwa', title: 'حكم القول بلا علم', url: 'https://binbaz.org.sa/fatwas/1', publisher: IBN_BAZ, scholarId: 'binbaz', recordId: '1', text: PAGE_TEXT, passage: PAGE_TEXT };
  const BOOK = { ref: 2, kind: 'lib_book', title: 'أحكام القرآن · ج1 · ص20', bookTitle: 'أحكام القرآن', author: 'ابن العربي', recordId: 'FC-000100:0001', text: BOOK_TEXT, passage: BOOK_TEXT };
  const cards = {
    buildSourceTag: (row) => ({ tag: '<source site="x" url="' + row.url + '">' + row.title + '</source>', url: row.url }),
    buildBookTag: (row) => ({ tag: '<book book="' + row.recordId + '">' + row.bookTitle + '</book>' }),
    max: 3,
  };
  const drive = async (mod, writer, rows, withCards = true) => {
    const out = [];
    const rel = mod.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; }, cards: withCards ? cards : null });
    rel.push(writer + '\n');
    const sum = await rel.end();
    return { pieces: out, text: out.join(''), sum };
  };

  // ── 1. the mark itself ──
  ok('1a a page row is named by its publisher, a book row by its book title',
    U.shortSourceMark(PAGE) === IBN_BAZ && U.shortSourceMark(BOOK) === 'أحكام القرآن');
  ok('1b a row with no name at all is silent', U.shortSourceMark({ kind: 'fatwa' }) === '' && U.shortSourceMark(null) === '');
  const longName = U.shortSourceMark({ kind: 'fatwa', publisher: 'اللجنة الدائمة للبحوث العلمية والإفتاء بالمملكة العربية السعودية' });
  ok('1c a long name is cut at a word and closed with «…»', longName.length <= 44 && longName.endsWith('…'), longName);  // ── brain35-2 F7 (2026-11-07; DIAG2 R1; owner: yes) · SOURCE MARKS: THE SCHOLAR'S NAME, EDITION TAILS, A SAFE CUT ──
  // MEASURED (DIAG2 R1): P5's paragraph ended «بعناية….» (FC-004526's catalogue title «فتاوى نور على الدرب لابن باز بعناية
  // الشويعر» cut at 40) and P19's «و….» (FC-004377's «… و الحج و الزيارة - حطيبة» cut after a bare conjunction). A fatwa /
  // page / source row is named by its publisher or scholar; a library book of the catalogue's fatwa kind whose author is a
  // roster scholar by the scholar; otherwise by its title with the edition tail stripped (« ت X», « بعناية X», « تحقيق X»,
  // « إعداد X», « جمع X», « جمعه X», « ترتيب X», « اعتنى به X», « - X»); the cut lands on a word and drops a trailing
  // connector; no mark at all under three letters, on a conjunction, or when the cut still carries بعناية / تحقيق / إعداد.
  const FC4526 = { kind: 'lib_book', title: 'فتاوى نور على الدرب لابن باز بعناية الشويعر · ج1 · ص12', bookTitle: 'فتاوى نور على الدرب لابن باز بعناية الشويعر', author: 'ابن باز', recordId: 'FC-004526:0012', authorRole: 'author' };
  const FC4377 = { kind: 'lib_book', title: 'شرح كتاب الجامع لأحكام العمرة و الحج و الزيارة - حطيبة · ج1 · ص12', bookTitle: 'شرح كتاب الجامع لأحكام العمرة و الحج و الزيارة - حطيبة', author: 'أحمد حطيبة', recordId: 'FC-004377:0012', authorRole: 'author' };
  const CONNECTOR_TAIL = /\s(?:و|ف|أو|في|على|عن|من|إلى|ل|ب|ك)…$/u;
  ok('F7a FC-004526 (the catalogue\'s fatwa kind, author «ابن باز», a roster scholar) is named by the scholar, never by its edition title',
    U.shortSourceMark(FC4526) === 'ابن باز', ascii(U.shortSourceMark(FC4526)));
  const m4377 = U.shortSourceMark(FC4377);
  ok('F7b FC-004377: the « - حطيبة» tail is stripped, the cut lands on a word and never ends on a connector',
    m4377 === 'شرح كتاب الجامع لأحكام العمرة و الحج…' && !CONNECTOR_TAIL.test(m4377) && !/[وف]\s*…$/u.test(m4377), ascii(m4377));
  ok('F7c a non-fatwa book «X بعناية Y» is named «X», and so are « تحقيق Y», « إعداد Y», « جمعه Y», « اعتنى به Y»',
    U.shortSourceMark({ kind: 'lib_book', bookTitle: 'جامع العلوم والحكم بعناية الأرنؤوط', author: 'ابن رجب', recordId: 'FC-000002:0001' }) === 'جامع العلوم والحكم'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'جامع العلوم والحكم تحقيق الأرنؤوط', author: 'ابن رجب', recordId: 'FC-000002:0001' }) === 'جامع العلوم والحكم'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'الفتاوى الكبرى إعداد عامر الجزار', author: 'ابن تيمية', recordId: 'FC-000002:0001' }) === 'الفتاوى الكبرى'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'مجموع الفتاوى جمعه ابن قاسم', author: 'ابن تيمية', recordId: 'FC-000002:0001' }) === 'مجموع الفتاوى'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'الأم اعتنى به رفعت فوزي', author: 'الشافعي', recordId: 'FC-000002:0001' }) === 'الأم');
  ok('F7c ...and a title that only STARTS with such a word keeps it («جمع الجوامع», «تخريج أحاديث الإحياء»)',
    U.shortSourceMark({ kind: 'lib_book', bookTitle: 'جمع الجوامع', author: 'السيوطي', recordId: 'FC-000002:0001' }) === 'جمع الجوامع'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'تخريج أحاديث الإحياء', author: 'العراقي', recordId: 'FC-000002:0001' }) === 'تخريج أحاديث الإحياء');
  ok('F7d a mark that would be under three letters is no mark; one that opens on a conjunction is none',
    U.shortSourceMark({ kind: 'lib_book', bookTitle: 'في', author: '', recordId: 'FC-000002:0001' }) === ''
    && U.shortSourceMark({ kind: 'fatwa', publisher: 'و' }) === '' && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'و كتاب', author: '', recordId: 'FC-000002:0001' }) === '');
  const keptEditorial = U.shortSourceMark({ kind: 'lib_book', bookTitle: 'فتاوى الشيخ بعناية محمد بن عبد الرحمن بن قاسم وآخرين من طلابه', author: 'الشيخ', recordId: 'FC-000002:0001' });
  ok('F7e a cut that still carries «بعناية» is no mark rather than a wrong one', keptEditorial === '', ascii(keptEditorial));
  ok('F7f a page row is named by its publisher, or by its scholar when it has no publisher; a long publisher is still cut',
    U.shortSourceMark(PAGE) === IBN_BAZ && U.shortSourceMark({ kind: 'fatwa', scholar: 'ابن عثيمين' }) === 'ابن عثيمين'
    && U.shortSourceMark({ kind: 'fatwa', publisher: 'اللجنة الدائمة للبحوث العلمية والإفتاء بالمملكة العربية السعودية' }).endsWith('…'));
  ok('F7g the catalogue kind is read by the record id: FC-004526 is the fatwa kind, FC-004377 is not, an unknown id is nothing',
    (await esm('lib/free-brain/compiled-fatwa-books.js')).isFatwaKindBook(FC4526) === true && (await esm('lib/free-brain/compiled-fatwa-books.js')).isFatwaKindBook(FC4377) === false
    && (await esm('lib/free-brain/compiled-fatwa-books.js')).catalogKindOf('FC-999999:0001') === '' && (await esm('lib/free-brain/compiled-fatwa-books.js')).catalogKindOf('') === '');
  ok('F7h a fatwa-kind book whose author is NOT a roster scholar keeps its title',
    U.shortSourceMark({ ...FC4526, author: 'لجنة الإفتاء' }) === 'فتاوى نور على الدرب لابن باز', ascii(U.shortSourceMark({ ...FC4526, author: 'لجنة الإفتاء' })));


  // ── 2. where the mark goes ──
  const first = await drive(U, PAGE_TEXT + ' [[1]].', [PAGE]);
  ok('2a a unit whose own card follows it gets NO mark', first.sum.sourceMarks === 0 && !first.text.includes('—') && first.sum.cardsSent === 1, ascii(first.text));
  const again = await drive(U, PAGE_TEXT + ' [[1]].\nوهي تنهى كذلك عن اتباع الظن [[1]].', [PAGE]);
  ok('2b a unit citing a row whose card is already shown ends on « — ابن باز», once',
    again.sum.sourceMarks === 1 && again.text.split('—').length === 2 && /— ابن باز\.?$/u.test(again.text.trim()), ascii(again.text));
  ok('2c ...and the mark sits inside the sentence\'s own full stop', /— ابن باز\./u.test(again.text), ascii(again.text));
  const owed = await drive(U, PAGE_TEXT + ' [[1, 2]].\n' + BOOK_TEXT + ' [[2]].', [PAGE, BOOK]);
  ok('2d a unit whose OWED card will follow it gets no mark (the card says it)', owed.sum.sourceMarks === 0 && owed.sum.cardsSent === 2, ascii(owed.text));
  const noCards = await drive(U, PAGE_TEXT + ' [[1]].\nوهي تنهى كذلك عن اتباع الظن [[1]].', [PAGE], false);
  ok('2e a turn that shows no cards at all writes no marks: the mark exists so a paragraph is not read as the neighbouring card\'s',
    noCards.sum.sourceMarks === 0 && !noCards.text.includes('—'), ascii(noCards.text));
  const alreadyMarked = await drive(U, PAGE_TEXT + ' [[1]].\nوهي تنهى كذلك عن اتباع الظن — ابن باز [[1]].', [PAGE]);
  ok('2f a unit that already ends on a mark is not marked twice', alreadyMarked.sum.sourceMarks === 0 && alreadyMarked.text.split('—').length === 2, ascii(alreadyMarked.text));
  const heading = await drive(U, PAGE_TEXT + ' [[1]].\n### المذهب الحنبلي\n' + BOOK_TEXT + ' [[1]].', [PAGE]);
  ok('2g a heading is never marked', !/###[^\n]*—/u.test(heading.text), ascii(heading.text));

  // ── 3. one rule for the emitter and the mark ──
  ok('3a cardBindableRow reads the page and book kinds and nothing else',
    U.cardBindableRow(PAGE) && U.cardBindableRow(BOOK) && !U.cardBindableRow({ kind: 'encyclopedia' }) && !U.cardBindableRow(null));
  ok('3b cardSupportsUnit is the test the cards use: the row\'s own text supports the sentence, or it does not',
    U.cardSupportsUnit(PAGE, PAGE_TEXT) === true && U.cardSupportsUnit(PAGE, 'ومدة المسح يوم وليلة للمقيم وثلاثة أيام للمسافر.') === false);
  ok('3c the emitter reads that one rule', read('lib/bw2-units.js').includes('const supportsCard = (row) => cardSupportsUnit(row, unitText);'));

  // ── 4. the encyclopedia tail at the BW2 call site ──
  const bw2Src = read('lib/before-writing-v2.js');
  ok('4a the call site writes the global line UNLESS the in-text mark already names every encyclopedia row the answer leaned on',
    bw2Src.includes('const encycNamedByMark = encycCited.length > 0 && encycCited.every((row) => encycMarked.includes(row));')
    && bw2Src.includes('const encyc = encycNamedByMark ? ' + String.fromCharCode(39, 39) + ' : encyclopediaTail(')
    // and it is the MARK that suppresses it, never the card: the suppression condition itself reads only the marks, so
    // an answer whose encyclopedia row carries no mark keeps its line, card or no card (postship3attributiontrigger).
    && !bw2Src.split(String.fromCharCode(10)).some((line) => line.includes("const encycNamedByMark") && line.includes("encyclopediaShown")));
  ok('4b the releaser hands it the rows its marks named', read('lib/bw2-units.js').includes('sourceMarks, markedRows: [...markedRows]'));
  const ENC = { ref: 1, kind: 'encyclopedia', title: 'الموسوعة الفقهية الكويتية — القول بلا علم', recordId: 'enc:1', text: PAGE_TEXT, passage: PAGE_TEXT, part: 1 };
  // the encyclopedia card is behind its own switch, so a turn can show cards and still show none of ITS rows: that unit
  // names the encyclopedia in its own line.
  const encCards = { ...cards, isEligible: (row) => row && row.kind !== 'encyclopedia' };
  const encOut = [];
  const encRel = U.createBw2Releaser({ rows: [ENC], emit: (p2) => { encOut.push(p2); return true; }, cards: encCards });
  encRel.push(PAGE_TEXT + ' [[1]].\nوهي تنهى كذلك عن اتباع الظن [[1]].' + '\n');
  const encRun = { pieces: encOut, text: encOut.join(''), sum: await encRel.end() };
  ok('4c an encyclopedia-cited unit with no card of its own carries a mark, and the rows it named are reported',
    encRun.sum.sourceMarks >= 1 && encRun.sum.markedRows.some((row) => row && row.kind === 'encyclopedia'), ascii(encRun.text));

  // ── 5. the verse card ──
  const AYAH = 'وَلَوْ أَنَّا كَتَبْنَا عَلَيْهِمْ أَنِ اقْتُلُوا أَنفُسَكُمْ';
  const VERSE = '<verse surah_num="4" ayah="66"></verse>';
  const QUOTING = 'واستدل بقوله تعالى: ﴿' + AYAH + '﴾ على أن حب الوطن غريزي';
  const VROW = { ref: 1, kind: 'fatwa', title: 'حب الوطن', url: 'https://x.invalid/1', publisher: 'العجلوني', scholarId: 'x', recordId: '1', text: QUOTING + ' في الإنسان.', passage: QUOTING + ' في الإنسان.' };
  ok('5a a verse unit is read by its surah and ayah, and the mushaf says which text quotes it',
    U.verseUnitRef(VERSE) === '4:66' && U.verseUnitRef('<verse surah_num="4"></verse>') === ''
    && U.textQuotesVerse('وقال تعالى: ﴿' + AYAH + '﴾', '4:66') === true && U.textQuotesVerse('كلام بلا آية', '4:66') === false);
  const early = await drive(U, VERSE + '\n' + QUOTING + ' [[1]].\nوهذا هو الصحيح في معناه [[1]].', [VROW], false);
  const earlyPieces = early.pieces.map((p) => (p.includes('<verse') ? 'VERSE' : 'PROSE'));
  ok('5b a verse card written BEFORE the sentence that quotes it goes out directly after that sentence',
    earlyPieces.join(',') === 'PROSE,VERSE,PROSE', JSON.stringify(earlyPieces) + ' ' + ascii(early.text));
  const late = await drive(U, QUOTING + ' [[1]].\n' + VERSE, [VROW], false);
  ok('5c a verse card written after it is left where it is', late.pieces.map((p) => (p.includes('<verse') ? 'VERSE' : 'PROSE')).join(',') === 'PROSE,VERSE');
  const never = await drive(U, 'حب الوطن غريزة في الإنسان لا يمدح بها ولا يذم [[1]].\n' + VERSE, [{ ...VROW, text: 'حب الوطن غريزة في الإنسان لا يمدح بها ولا يذم.', passage: 'حب الوطن غريزة في الإنسان لا يمدح بها ولا يذم.' }], false);
  ok('5d a verse card no released unit quotes is still sent, where the writer put it', never.text.includes('<verse'), ascii(never.text));

  // ── 6. the mutants ──
  const twin = async (transform, tag) => {
    const src = read('lib/bw2-units.js');
    const mutated = transform(src);
    if (mutated === src) return { changed: false };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-marks-' + tag + '-'));
    const file = path.join(tmp, 'bw2-units.mjs');
    fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
      (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib', spec)).href + q), 'utf8');
    try { return { changed: true, mod: await import(pathToFileURL(file).href + '?t=' + Date.now()) }; } catch (e) { return { changed: true, error: String(e && e.message) }; } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  };
  const m1 = await twin((s) => s.replace('          sourceMarks += 1;', '          sourceMarks += 0; value = value; // mutant: the mark is never written').replace(/value = tail \? value\.slice\(0, tail\.index\)[^\n]*\n/u, '          // mutant: no mark\n'), 'mark');
  ok('6a MUTANT mark seam applied and loaded', m1.changed && m1.mod, m1.error);
  ok('6a MUTANT KILLED: without the mark the second paragraph names nothing',
    !!m1.mod && (await drive(m1.mod, PAGE_TEXT + ' [[1]].\nوهي تنهى كذلك عن اتباع الظن [[1]].', [PAGE])).sum.sourceMarks === 0, m1.error);
  const m2 = await twin((s) => s.replace('      const owedWillShow = verdict.cited.some((row) => owedCards.has(row) && cardSupportsUnit(row, value));', '      const owedWillShow = false; // mutant: an owed card does not count as one that follows'), 'owed');
  ok('6b MUTANT owed seam applied and loaded', m2.changed && m2.mod, m2.error);
  ok('6b MUTANT KILLED: without it a unit gets a mark AND the card it stands in for',
    !!m2.mod && (await drive(m2.mod, PAGE_TEXT + ' [[1, 2]].\n' + BOOK_TEXT + ' [[2]].', [PAGE, BOOK])).sum.sourceMarks === 1, m2.error);
  const m3 = await twin((s) => s.replace('      if (ref && !textQuotesVerse(text, ref)) {', '      if (false) { // mutant: the verse card never waits'), 'verse');
  ok('6c MUTANT verse seam applied and loaded', m3.changed && m3.mod, m3.error);
  ok('6c MUTANT KILLED: without the wait the verse card goes out before the sentence that quotes it',
    !!m3.mod && (await drive(m3.mod, VERSE + '\n' + QUOTING + ' [[1]].', [VROW], false)).pieces.map((p) => (p.includes('<verse') ? 'VERSE' : 'PROSE')).join(',') === 'VERSE,PROSE', m3.error);

  // brain35-2 F7: the connector strip removed -> FC-004377's mark ends on «و…» again
  const m4 = await twin((s) => s.replace(".replace(/\\s+\\S*$/u, '').replace(CONNECTOR_END_RE, '') + '\\u2026' : mark;", ".replace(/\\s+\\S*$/u, '') + '\\u2026' : mark; // mutant: the connector stays"), 'connector');
  ok('F7 MUTANT connector seam applied and loaded', m4.changed && m4.mod, m4.error);
  ok('F7 MUTANT KILLED: without the connector strip FC-004377\'s mark ends on a bare «و» again',
    !!m4.mod && /\sو…$/u.test(m4.mod.shortSourceMark(FC4377)), m4.mod ? ascii(m4.mod.shortSourceMark(FC4377)) : m4.error);

  console.log('\n=== source-marks: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
