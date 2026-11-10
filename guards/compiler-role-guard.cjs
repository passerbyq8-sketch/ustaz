// guards/compiler-role-guard.cjs -- brain35 A-3 (2026-11-06; DIAG 35.1): A COMPILER IS SHOWN AS A COMPILER, AND CREDITED WITH NOTHING.
//
// MEASURED (Q27, ezik.app 2026-11-06): the answer said «وقد أفتى بهذا جماعة من أهل العلم» beside the card
// <book author="محمد بن عبد العزيز المسند" book="FC-004540">فتاوى إسلامية</book>; the decoded passage ends with the Permanent
// Committee's signature «اللجنة الدائمة ***». The catalog carries one author field per book, the library tool copied it into
// the row, the writer saw it as «المؤلّف», the reviewer licensed a credit to it by book authorship, and the card printed it.
// The owner's ruling (contract section 5): «الجامع يظهر على إنه جامع، والفتوى اللي ما نعرف مفتيها تنسب للمجموعة، والمفتي
// ينذكر بس إذا فيه توقيع أو نقل».
//
// WHAT THIS PINS, offline, no model, no network:
//   1. lib/data/compiled-fatwa-books.json lists the measured compiled works (six ids, each a fatwa-kind row whose author is not
//      the mufti); lib/free-brain/compiled-fatwa-books.js maps a library record id to authorRole 'compiler' for them and
//      'author' for every other book (FC-003888, al-Albani's own compiled heritage, and the roster scholars' own books stay
//      'author'); lib/free-brain/tools.js runLibrary stamps the role on the row (source pin + the real row builder is not
//      drivable without the service, so the stamp line is pinned by text).
//   2. The reviewer: «قال محمد بن عبد العزيز المسند: …» over the FC-004540 row (the captured Q27 passage) is HELD when the row
//      carries authorRole 'compiler' and KEPT when the same row is 'author'; «قالت اللجنة الدائمة: …» over the compiler row is
//      KEPT (the signature inside the passage licenses the signer) and held over an 'author' row (no signature licence there).
//   3. api/ask.js buildBookTag writes author="جمعه: <name>" for a compiler row and the bare name otherwise.
//   4. The writer's labels: sourceLabel prints «جامعُ الكتاب (ليس المفتي): <name>» for a compiler row, «المؤلّف: <name>» otherwise;
//      the writer's rules carry rule 12 (the order's sentence, byte for byte, sha-pinned).
//   Mutants (temp twins with absolute imports, each killed): the role map answering 'author' for every id; the reviewer's
//   compiler refusal removed; the signature licence removed; the card's «جمعه:» prefix removed.
//
// Usage: node guards/compiler-role-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 400) : ''));
  return false;
};
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?compiler=' + Date.now());
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
/** A twin of a lib module with its relative imports made absolute, after `transform`; imported fresh. */
async function twin(rel, transform, tag) {
  const src = read(rel);
  const mutated = transform(src);
  if (mutated === src) return { changed: false };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-compiler-' + tag + '-'));
  const file = path.join(tmp, path.basename(rel).replace(/\.js$/u, '.mjs'));
  const dir = path.dirname(path.join(REPO, rel));
  fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu, (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(dir, spec)).href + q)
    .replace(/import\.meta\.url/gu, JSON.stringify(pathToFileURL(path.join(REPO, rel)).href)), 'utf8');
  try { return { changed: true, mod: await import(pathToFileURL(file).href + '?t=' + Date.now()), tmp }; } catch (e) { return { changed: true, error: String(e && e.message), tmp }; }
}
const clean = (t) => { try { if (t && t.tmp) fs.rmSync(t.tmp, { recursive: true, force: true }); } catch { /* temp only */ } };

(async () => {
  console.log('=== compiler-role-guard -- brain35 A-3: the compiler of a fatwa collection is shown as such and credited with nothing ===');
  const DATA = JSON.parse(read('lib/data/compiled-fatwa-books.json'));
  const ROLE = await esm('lib/free-brain/compiled-fatwa-books.js');
  const REV = await esm('lib/output-reviewer.js');
  const ASK = await esm('api/ask.js');
  const BW2 = await esm('lib/before-writing-v2.js');
  const CARDS = JSON.parse(read('fixtures/brain35-card-cases.json'));

  // ── 1. the data and the role map ──
  const ids = (DATA.books || []).map((b) => b.id);
  ok('1a the list holds the six measured compiled works, FC-004540 among them', ids.length === 6 && ids.includes('FC-004540') && typeof DATA.rule === 'string' && DATA.rule.length > 100, JSON.stringify(ids));
  const CATALOG = await esm('lib/data/lib-catalog.js');
  const byId = new Map(CATALOG.LIB_CATALOG.map((r) => [r[0], r]));
  ok('1b every listed id is a fatwa-kind catalog row whose author is the compiler the list names', ids.every((id) => byId.get(id) && byId.get(id)[3] === 'fatwa' && byId.get(id)[2] === DATA.books.find((b) => b.id === id).author));
  ok('1c every listed id maps to authorRole compiler, in the record-id shapes the library uses', ids.every((id) => ROLE.authorRoleOf('lib:' + id + ':0007') === 'compiler' && ROLE.authorRoleOf(id + ':0001:003') === 'compiler' && ROLE.authorRoleOf(id) === 'compiler'));
  ok('1d FC-003888 (al-Albani\'s compiled heritage under his own name), FC-004528 (Ibn Baz\'s majmu\') and FC-004542 (the Committee\'s own) stay author; an empty or foreign id is author',
    ['lib:FC-003888:0001', 'lib:FC-004528:0001', 'lib:FC-004542:0001', '', 'lib:0001', 'enc:12'].every((id) => ROLE.authorRoleOf(id) === 'author'));
  const toolsSrc = read('lib/free-brain/tools.js');
  ok('1e lib/free-brain/tools.js stamps the role on every library row (authorRole: authorRoleOf(record.id))',
    toolsSrc.includes("authorRole: authorRoleOf(record.id || ''),") && toolsSrc.includes("import { authorRoleOf } from './compiled-fatwa-books.js';"));
  const loopSrc = read('lib/free-brain/loop.js');
  ok('1f lib/free-brain/loop.js reviewerEvidence carries authorRole beside author (gated on the book kind)', loopSrc.includes("authorRole: row.kind === LIB_BOOK_KIND ? (row.authorRole || '') : '',"));

  // ── 2. the reviewer over the captured Q27 passage ──
  const q27 = CARDS.q27;
  const row = (role) => ({ id: 'lib:' + q27.bookId + ':0001', kind: 'lib_book', title: q27.bookTitle + ' · ج2 · ص238', bookTitle: q27.bookTitle, author: q27.author, authorRole: role, snippet: q27.passage, url: '' });
  const MUSNAD = 'قال محمد بن عبد العزيز المسند: يسقط شرط الطهارة من الحيض لدخول المسجد وللطواف للضرورة.';
  const LAJNA = 'قالت اللجنة الدائمة: يسقط شرط الطهارة من الحيض لدخول المسجد وللطواف للضرورة.';
  const judge = (mod, text, role) => { const r = mod.reviewAnswer({ text, evidence: [row(role)], domain: 'fiqh', mode: 'brief' }); return { kept: r.text === text, actions: r.annotations.map((a) => a.action) }; };
  ok('2a the passage is the captured one and carries the Committee\'s signature', q27.passage.length > 900 && q27.passage.includes('اللجنة الدائمة ***'));
  const mC = judge(REV, MUSNAD, 'compiler');
  ok('2b «قال محمد بن عبد العزيز المسند: …» over the compiler row is HELD (removed-unsupported-attribution)', !mC.kept && mC.actions.includes('removed-unsupported-attribution'), JSON.stringify(mC));
  const mA = judge(REV, MUSNAD, 'author');
  ok('2c ...and the same sentence over the same row as an author is kept-sourced (the role is what changed)', mA.kept && mA.actions.includes('kept-sourced-attribution'), JSON.stringify(mA));
  const lC = judge(REV, LAJNA, 'compiler');
  ok('2d «قالت اللجنة الدائمة: …» over the compiler row is KEPT: the signature in the passage licenses the signer', lC.kept && lC.actions.includes('kept-sourced-attribution'), JSON.stringify(lC));
  const lA = judge(REV, LAJNA, 'author');
  ok('2e ...and over an author row the Committee is not licensed by a signature (no compiler, no signature licence)', !lA.kept && lA.actions.includes('removed-unsupported-attribution'), JSON.stringify(lA));
  const unsigned = REV.reviewAnswer({ text: LAJNA, evidence: [{ ...row('compiler'), snippet: q27.passage.replace('اللجنة الدائمة ***', 'انتهى') }], domain: 'fiqh', mode: 'brief' });
  ok('2f a compiler row whose passage carries no signature licenses the Committee no more than the compiler', unsigned.text !== LAJNA, JSON.stringify(unsigned.annotations.map((a) => a.action)));

  // ── 3. the card and the writer's labels ──
  const tagC = ASK.buildBookTag({ bookTitle: q27.bookTitle, author: q27.author, authorRole: 'compiler', locator: 'ج2 · ص238', text: 'نص', recordId: 'lib:FC-004540:0001' });
  const tagA = ASK.buildBookTag({ bookTitle: q27.bookTitle, author: q27.author, authorRole: 'author', locator: 'ج2 · ص238', text: 'نص', recordId: 'lib:FC-004540:0001' });
  ok('3a buildBookTag writes author="جمعه: <name>" for a compiler row', !!tagC && tagC.tag.includes('author="جمعه: ' + q27.author + '"'), tagC && tagC.tag);
  ok('3b ...and the bare name for an author row', !!tagA && tagA.tag.includes('author="' + q27.author + '"') && !tagA.tag.includes('جمعه'), tagA && tagA.tag);
  const labelC = BW2.sourceLabel({ kind: 'lib_book', bookTitle: q27.bookTitle, author: q27.author, authorRole: 'compiler', locator: 'ج2 · ص238' });
  const labelA = BW2.sourceLabel({ kind: 'lib_book', bookTitle: q27.bookTitle, author: q27.author, authorRole: 'author', locator: 'ج2 · ص238' });
  ok('4a sourceLabel prints «جامعُ الكتاب (ليس المفتي): <name>» for a compiler row and «المؤلّف: <name>» otherwise',
    labelC.includes('جامعُ الكتاب (ليس المفتي): ' + q27.author) && !labelC.includes('المؤلّف') && labelA.includes('المؤلّف: ' + q27.author) && !labelA.includes('جامعُ'), labelC + ' | ' + labelA);
  // the sentence of EZIK-ORDER-BRAIN35-FIX-2026-11-06.md (A-3, writer rule), under its number: taken from the order file by code, never retyped
  const RULE12_SHA = '10dd55ce7fd7ae1a39dfa74b14babc01840cb36b7cb73562c656619da752a812';
  const rules = String(BW2.BW2_WRITE_RULES_BRAIN35 || '');
  const rule12 = rules.split('\n')[0]; // the brain35 rules: 12 (A-3), 13 (A-5) -- each line pinned by its own guard
  // re-cut 2026-11-09 (brain35-5g CR, R9): the owner's no-Ja'fari line (item J) follows the brain35 rules on every turn; the pin of
  // the assembled rules' tail moves to include it, read as speed-bw2 ORDER50-2c reads it -- nothing else of the row
  const NO_JAFARI_R9 = fs.readFileSync(path.join(REPO, 'lib/free-brain/instructions.js'), 'utf8').includes('export const NO_JAFARI_SCHOOL_RULE') ? (await esm('lib/free-brain/instructions.js')).NO_JAFARI_SCHOOL_RULE : '';
  ok('4b the writer\'s rules carry rule 12 (the order\'s sentence) on every turn, after the tenth', rule12.startsWith('١٢. ') && rule12.includes('ولا يُنسَبُ إلى جامعِه') && BW2.bw2RulesFor([], 'x', []).endsWith(rules + '\n' + NO_JAFARI_R9) && BW2.bw2RulesFor([], 'ما حكم المسح على الجوارب عند المذاهب الأربعة؟', []).includes(rules));
  ok('4c rule 12 is pinned by sha256 (the order\'s sentence, byte for byte)', sha(rule12) === RULE12_SHA, sha(rule12));

  // ── mutants ──
  const m1 = await twin('lib/free-brain/compiled-fatwa-books.js', (s) => s.replace("return COMPILED_FATWA_BOOK_IDS.has(bookIdOf(recordId)) ? 'compiler' : 'author';", "return 'author'; // mutant: nobody is a compiler"), 'role');
  ok('MUTANT role-map seam applied and loaded', m1.changed && m1.mod, m1.error);
  ok('MUTANT KILLED: with every book an author, FC-004540 is credited to its compiler again', m1.mod && m1.mod.authorRoleOf('lib:FC-004540:0001') !== 'compiler');
  clean(m1);
  const m2 = await twin('lib/output-reviewer.js', (s) => s.replace("    if (item.authorRole === 'compiler') return false; // ITEM A-3 (brain35, 2026-11-06; DIAG 35.1): a compiler's name licenses no ruling to him\n", ''), 'refusal');
  ok('MUTANT compiler-refusal seam applied and loaded', m2.changed && m2.mod, m2.error);
  ok('MUTANT KILLED: without the refusal the compiler\'s name is licensed by book authorship again', m2.mod && judge(m2.mod, MUSNAD, 'compiler').kept === true);
  clean(m2);
  const m3 = await twin('lib/output-reviewer.js', (s) => s.replace("    || signatureEvidenceFor(sentence, attribution, evidence) // ITEM A-3 (brain35): the signature inside a compiled work's passage\n", ''), 'signature');
  ok('MUTANT signature-licence seam applied and loaded', m3.changed && m3.mod, m3.error);
  ok('MUTANT KILLED: without the signature licence the Committee is held over its own signed passage', m3.mod && judge(m3.mod, LAJNA, 'compiler').kept === false);
  clean(m3);
  const askSrc = read('api/ask.js');
  const seam4 = "  const author = attr(row && row.author ? (row.authorRole === 'compiler' ? 'جمعه: ' + row.author : row.author) : '');";
  ok('MUTANT card seam present once', askSrc.split(seam4).length === 2);
  // api/ask.js is heavy to twin (its imports pull the whole app); the card builder is pure, so its seam is proved by text and by 3a/3b above.

  console.log('\n=== compiler-role: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
