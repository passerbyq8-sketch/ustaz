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
  ok('F7c ...and a title that only STARTS with such a word keeps it («جمع الجوامع», «تخريج أحاديث الإحياء», «تحقيق رياض الصالحين»: 31 catalogue titles open on «تحقيق»)',
    U.shortSourceMark({ kind: 'lib_book', bookTitle: 'جمع الجوامع', author: 'السيوطي', recordId: 'FC-000002:0001' }) === 'جمع الجوامع'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'تخريج أحاديث الإحياء', author: 'العراقي', recordId: 'FC-000002:0001' }) === 'تخريج أحاديث الإحياء'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'تحقيق رياض الصالحين للألباني', author: 'النووي', recordId: 'FC-000778:0001' }) === 'تحقيق رياض الصالحين للألباني'
    && U.shortSourceMark({ kind: 'lib_book', bookTitle: 'التدمرية: تحقيق الإثبات للأسماء والصفات وحقيقة الجمع بين القدر والشرع', author: 'ابن تيمية', recordId: 'FC-002530:0001' }) === '');
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
  // re-cut 2026-11-07 (brain35-2 F9; owner decision R6, DIAG2): a SHOWN card names the row as a mark does; the line is written
  // only when some cited encyclopedia row is named by neither, and it is handed the unnamed rows only (never a shown one).
  // re-cut again 2026-11-07 (brain35-3 X5; owner decision D4, DIAG3): the reader sees a NAME, not a row -- the line only when the
  // encyclopedia is named NOWHERE (no marked row, no shown card, no released paragraph ending on its mark).
  ok('4a the call site writes the global line only when the encyclopedia is named nowhere (no marked row, no shown card, no mark in the text), and hands it the unnamed rows only (re-cut 2026-11-07 twice: owner decisions R6 and D4)',
    bw2Src.includes("const encycUnnamed = encycCited.filter((row) => !encycMarked.includes(row) && !encycShown.includes(row));")
    && bw2Src.includes("const encycNamedSomewhere = encycMarked.length > 0 || encycShown.length > 0 || / — الموسوعة الفقهية الكويتية\\.\\s*$/mu.test(String(wire.sent || ''));")
    && bw2Src.includes("const encyc = encycNamedSomewhere || !encycUnnamed.length ? '' : encyclopediaTail(encycUnnamed, String(wire.sent || ''), null)")
    && !bw2Src.includes('const encycNamedByMark'));
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

  // ── brain35-2 F9 (2026-11-07; DIAG2 R6) · A SHOWN CARD NAMES THE ROW; THE ENCYCLOPEDIA LINE ONLY FOR UNNAMED ROWS ──
  // MEASURED (DIAG2 R6, P18, HB2 round two): a row cited by ONE unit with its card under that unit got no mark (the card
  // was about to follow), so it was never in markedRows and the global line named what the card beside it had named; and
  // two articles under one repeated mark left the second unmarked, so the line came back. Now a row named by a shown card
  // or by a mark (a repeated mark names its rows too) draws no line; the line is written only when some cited encyclopedia
  // row is named by neither, and it is handed the unnamed rows only. Driven on the real turn (runBw2Turn), as DIAG2 HB2 did.
  {
    const BW2F9 = await esm('lib/before-writing-v2.js');
    const SSEF9 = await esm('lib/finalized-sse-writer.js');
    const TOOLSF9 = await esm('lib/free-brain/tools.js');
    const GLOBAL_LINE = /المصدر: الموسوعة الفقهية الكويتية\./u;
    const MASAH = 'يجوز المسح على الجوربين إذا لبسهما على طهارة، ومدته يوم وليلة للمقيم وثلاثة أيام بلياليها للمسافر، وهذا مذهب الحنابلة.';
    const ROW_A = { id: 'F99901', part: 37, term: 'مسح على الخفين', snippet: MASAH };
    const ROW_B = { id: 'F99902', part: 37, term: 'جورب', snippet: 'الجورب ما يلبس على القدم من صوف أو قطن، والمسح عليه كالمسح على الخف عند من أجازه من أهل العلم.' };
    const Q_F9 = 'ما حكم المسح على الجوارب؟';
    const framesOf = (target) => target.writes.join('').split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
    const deltasOf = (frames) => frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text);
    const chunk = (text) => { const o = []; let x = 7932; for (let i = 0; i < text.length;) { x = (x * 1103515245 + 12345) % 2147483648; const n = 1 + (x % 17); o.push(text.slice(i, i + n)); i += n; } return o; };
    const driveTurn = async (mod, { writerText, encyclopedia, encyclopediaCards }) => {
      const target = { writes: [], ended: 0, write(c) { this.writes.push(String(c)); return true; }, end(cb) { this.ended += 1; if (typeof cb === 'function') cb(); return this; }, status() { return this; }, setHeader() { return this; }, once() { return this; }, on() { return this; }, removeListener() { return this; } };
      const facade = SSEF9.createFinalizedSseResponse(target, { finalize: (i) => ({ ok: true, text: String(i.text || ''), problems: [], replaced: false, drops: [], degraded: [] }), context: () => ({ allowWireOwnedCards: true, sourceCards: [], readerCards: [], readerPrefix: '', readerSuffix: '' }), failureText: 'F9-FAILURE' });
      const wire = mod.createBw2Wire(facade);
      const deps = {
        runTool: async () => ({ text: '', added: [], calls: 1 }),
        searchStoredCorpus: async () => ({ records: encyclopedia }), warmEncyclopedia: async () => true, encyclopediaReady: () => true, encyclopediaRow: TOOLSF9.encyclopediaRow,
        ask: async ({ user }) => { const count = (user.match(/^\[\d+\] /gmu) || []).length; return JSON.stringify({ d: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i + 1), 1])) }); },
        callWriter: async ({ onText }) => { for (const piece of chunk(writerText)) onText(piece); return { usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn', content: [] }; },
        runnerLookup: () => async () => [],
      };
      const out = await mod.runBw2Turn({ question: Q_F9, messages: [{ role: 'user', content: Q_F9 }], mode: 'brief', band: 'adult', system: 'SYSTEM', model: 'writer-model', maxTokens: 4096, providerUrl: 'https://api.anthropic.invalid/v1/messages', headers: {}, libFlagValue: '', libToken: '', lessonsToken: '', onLessonRows: null, takhrijWired: false, wire, requestStartedAt: Date.now(), env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400' }, runtime: '', continueWhenNotCovered: false, deps,
        cards: { buildSourceTag: () => ({ tag: '<source url="https://example.invalid/f9"></source>' }), buildBookTag: (row) => ({ tag: '<book book="' + row.recordId + '">' + row.bookTitle + '</book>' }), encyclopediaCards, max: 3 } });
      const text = deltasOf(framesOf(target)).join('');
      return { out, text, cards: (text.match(/<(?:book|source)\b[^>]*>/gu) || []).length, line: GLOBAL_LINE.test(text), mark: / — الموسوعة الفقهية الكويتية/u.test(text) };
    };
    const one = await driveTurn(BW2F9, { writerText: 'يجوز المسح على الجوربين إذا لبسهما على طهارة [[1]].', encyclopedia: [ROW_A], encyclopediaCards: true });
    ok('4d one unit cites the encyclopedia row and its card follows it: the card names the row, no mark, NO global line',
      one.cards === 1 && !one.mark && !one.line && one.out.telemetry.unitsReleased === 1, ascii(one.text));
    const two = await driveTurn(BW2F9, { writerText: 'يجوز المسح على الجوربين إذا لبسهما على طهارة [[1]].\n\nومدته يوم وليلة للمقيم وثلاثة أيام بلياليها للمسافر [[1]].', encyclopedia: [ROW_A], encyclopediaCards: true });
    ok('4e two units cite it, the second marked (the card went out under the first): no global line (unchanged)', two.cards === 1 && two.mark && !two.line, ascii(two.text));
    // MEASURED here: with the encyclopedia card switch off, a row's FIRST citing unit gets neither a card (the switch blocks it)
    // nor a mark (cardEligible is a per-ref map, so the card is predicted); the row is unnamed and the line is right. (A
    // heading's citation never enters `cited`: the heading path registers no citation, so a heading cannot draw the line.)
    const unnamed = await driveTurn(BW2F9, { writerText: 'يجوز المسح على الجوربين إذا لبسهما على طهارة [[1]].', encyclopedia: [ROW_A], encyclopediaCards: false });
    ok('4f a cited encyclopedia row with no card (the switch off) and no mark: the line, once',
      unnamed.cards === 0 && !unnamed.mark && unnamed.line && (unnamed.text.match(GLOBAL_LINE) || []).length === 1, ascii(unnamed.text));
    const TWO_ARTICLES = 'يجوز المسح على الجوربين إذا لبسهما على طهارة [[1, 2]].\n\nومدته يوم وليلة للمقيم وثلاثة أيام بلياليها للمسافر [[1]].\n\nوالجورب ما يلبس على القدم من صوف أو قطن [[2]].';
    const twoArticles = await driveTurn(BW2F9, { writerText: TWO_ARTICLES, encyclopedia: [ROW_A, ROW_B], encyclopediaCards: false });
    ok('4g two articles under one mark (the switch off; both rows cited once before, so the second and third units reach the mark): the repeated mark names the second article too, no global line',
      twoArticles.cards === 0 && twoArticles.mark && !twoArticles.line && twoArticles.out.telemetry.unitsReleased === 3, ascii(twoArticles.text));
    // the mutants, on twins of the two modules (the before-writing twin imports the bw2-units twin for the repeated-mark seam)
    const twinPair = async (unitsFrom, unitsTo, bw2From, bw2To, tag) => {
      const unitsSrc = read('lib/bw2-units.js');
      const bw2Src = read('lib/before-writing-v2.js');
      // brain35-3 X5: a seam may be a list (one mutant that disarms the same fact in two places), and the units twin is handed back
      const list = (x) => x == null ? [] : Array.isArray(x) ? x : [x];
      const seams = (src, from) => list(from).every((one) => src.split(one).length === 2);
      const apply = (src, from, to) => list(from).reduce((acc, one, i) => acc.split(one).join(list(to)[i]), src);
      if (unitsFrom && !seams(unitsSrc, unitsFrom)) return { ok: false, reason: 'units seam' };
      if (bw2From && !seams(bw2Src, bw2From)) return { ok: false, reason: 'bw2 seam' };
      const abs = (src, dir) => src.replace(/from\s+(['"])(\.[^'"]*)\1/gu, (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, dir, spec)).href + q);
      const unitsTmp = path.join(REPO, 'lib', '.mut-f9-units-' + tag + '.mjs');
      const bw2Tmp = path.join(REPO, 'lib', '.mut-f9-bw2-' + tag + '.mjs');
      fs.writeFileSync(unitsTmp, abs(unitsFrom ? apply(unitsSrc, unitsFrom, unitsTo) : unitsSrc, 'lib'));
      fs.writeFileSync(bw2Tmp, abs(bw2From ? apply(bw2Src, bw2From, bw2To) : bw2Src, 'lib').split(pathToFileURL(path.join(REPO, 'lib', 'bw2-units.js')).href).join(pathToFileURL(unitsTmp).href));
      try { const units = await import(pathToFileURL(unitsTmp).href); return { ok: true, units, mod: await import(pathToFileURL(bw2Tmp).href + '?m=' + Date.now()) }; } catch (e) { return { ok: false, reason: String(e && e.message) }; } finally { fs.rmSync(unitsTmp, { force: true }); fs.rmSync(bw2Tmp, { force: true }); }
    };
    const m5 = await twinPair("        if (mark && mark === lastMark) { markedRows.push(...verdict.cited); /* ITEM 35-D2 R6 (brain35-2 F9): the paragraph above named the same source: these rows are named too */ } else if (mark) {",
      "        if (mark && mark === lastMark) { /* mutant: a repeated mark names nothing */ } else if (mark) {", null, null, 'repeat');
    ok('F9 MUTANT repeated-mark seam applied and loaded', m5.ok, m5.reason);
    // re-cut 2026-11-07 (brain35-3 X5; owner decision D4, DIAG3): the line no longer stands on WHICH rows are marked (one marked
    // row names the encyclopedia for the whole answer), so the push is read where it is made: the releaser's markedRows.
    const markedByRepeat = async (U2) => {
      const EA = { ref: 1, kind: 'encyclopedia', title: 'الموسوعة الفقهية الكويتية — مسح على الخفين', recordId: 'enc:A', text: MASAH, passage: MASAH, part: 37 };
      const EB = { ref: 2, kind: 'encyclopedia', title: 'الموسوعة الفقهية الكويتية — جورب', recordId: 'enc:B', text: ROW_B.snippet, passage: ROW_B.snippet, part: 37 };
      const rel = U2.createBw2Releaser({ rows: [EA, EB], emit: () => true, cards });
      rel.push(TWO_ARTICLES + '\n');
      const sum = await rel.end();
      return { a: sum.markedRows.includes(EA), b: sum.markedRows.includes(EB), marks: sum.sourceMarks };
    };
    const headMarked = await markedByRepeat(U);
    ok('F9 the repeated mark names the second article too: both rows in the releaser\'s markedRows under one mark (re-cut 2026-11-07, owner decision D4)', headMarked.a && headMarked.b && headMarked.marks === 1, JSON.stringify(headMarked));
    ok('F9 MUTANT KILLED: without the repeated-mark push the second article is not in markedRows',
      m5.ok && (await markedByRepeat(m5.units)).b === false, m5.ok ? JSON.stringify(await markedByRepeat(m5.units)) : m5.reason);
    // re-cut 2026-11-07 (brain35-3 X5; owner decision D4): a shown card is read in two places now (the F9 filter and the
    // named-somewhere test); one mutant disarms both, or the other keeps the line away and the row is vacuous.
    const m6 = await twinPair(null, null, [
      "  const encycUnnamed = encycCited.filter((row) => !encycMarked.includes(row) && !encycShown.includes(row)); // ITEM 35-D2 R6 (brain35-2 F9): named by a mark or by a shown card",
      "  const encycNamedSomewhere = encycMarked.length > 0 || encycShown.length > 0 || "], [
      "  const encycUnnamed = encycCited.filter((row) => !encycMarked.includes(row)); // mutant: a shown card names nothing",
      "  const encycNamedSomewhere = encycMarked.length > 0 || /* mutant: a shown card names nothing */ "], 'shown');
    ok('F9 MUTANT shown-card seam applied and loaded', m6.ok, m6.reason);
    ok('F9 MUTANT KILLED: with the shown card not counted as a name the one-unit answer carries the line beside its card again',
      m6.ok && (await driveTurn(m6.mod, { writerText: 'يجوز المسح على الجوربين إذا لبسهما على طهارة [[1]].', encyclopedia: [ROW_A], encyclopediaCards: true })).line === true, m6.reason);

    // ── brain35-3 X5 (2026-11-07; DIAG3 D4; owner decision 2026-11-07: yes) · THE LINE ONLY WHEN THE ENCYCLOPEDIA IS NAMED NOWHERE ──
    // MEASURED (DIAG3 H4b, preview Q3/Q6): a SECOND encyclopedia row cited by a released unit whose card the emitter refused
    // (its support test) and whose mark the mark site skipped (a card predicted) was in neither markedRows nor
    // encyclopediaShown, so the line was written under an answer that already carried a Mawsu'a card and a Mawsu'a mark.
    // The reader sees a NAME, not a row: the line is written only when no encyclopedia row is marked, none is shown and no
    // released paragraph ends on the mark. 4f (one unnamed row, nothing named) keeps its line; 4g (a marked row) keeps none.
    // Row B here supports the FIRST unit (so the tail test, which reads the whole answer, would name it) while the second
    // unit, which cites it, shares no word with it (so its card is refused) -- the Q3 Hanbali shape in miniature.
    const ROW_B2 = { id: 'F99903', part: 37, term: 'جورب', snippet: 'الجورب ما يلبس على القدم من صوف أو قطن، ويجوز المسح على الجوربين إذا لبسهما على طهارة عند من أجازه من أهل العلم.' };
    const CARDED_PLUS_UNNAMED = 'يجوز المسح على الجوربين إذا لبسهما على طهارة [[1]].\n\nوهذا الحكم مبني على التيسير ورفع الحرج [[2]].';
    const named = await driveTurn(BW2F9, { writerText: CARDED_PLUS_UNNAMED, encyclopedia: [ROW_A, ROW_B2], encyclopediaCards: true });
    ok('4h row A carded under the first unit, row B cited by the second (released, its card refused by the support test, no mark): NO global line (the card names the encyclopedia)',
      named.cards === 1 && !named.mark && !named.line && named.out.telemetry.unitsReleased === 2, ascii(named.text));
    const m7 = await twinPair(null, null, "  const encyc = encycNamedSomewhere || !encycUnnamed.length ? '' : encyclopediaTail(encycUnnamed, String(wire.sent || ''), null)",
      "  const encyc = !encycUnnamed.length ? '' : encyclopediaTail(encycUnnamed, String(wire.sent || ''), null) /* mutant: a named encyclopedia does not stop the line */", 'named');
    ok('X5 MUTANT named-somewhere seam applied and loaded', m7.ok, m7.reason);
    ok('X5 MUTANT KILLED: without encycNamedSomewhere the carded answer draws the line for its second row again',
      m7.ok && (await driveTurn(m7.mod, { writerText: CARDED_PLUS_UNNAMED, encyclopedia: [ROW_A, ROW_B2], encyclopediaCards: true })).line === true, m7.reason);
  }
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
