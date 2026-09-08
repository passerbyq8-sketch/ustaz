// guards/asmaa-attribution-guard.cjs -- ITEM 26. A NAME'S CARD NAMES ITS BOOK, ITS AUTHOR AND
// ITS PRINTED PAGE, OR THE READER DOES NOT SEE IT.
//
// -- THE OWNER'S SENTENCE, WHICH IS THE WHOLE OF THIS GATE ---------------------
//   «كلُّ سجلٍّ من التسعةِ والتسعينَ فيه كتابٌ ومؤلِّفٌ وصفحةٌ في source، وكلُّ نصٍّ منقولٍ يحملُ
//    صفحتَه المطبوعةَ داخلَ entry_pages لسجلِّه. وما نقصَ منه شيءٌ فبطاقتُه لا تُعرَض، والبوّابةُ
//    تحمرُّ.»
//
// Two halves, and this gate measures both. The DATA half: the sheet in the tree satisfies the
// rule, record by record, field by field. The CLIENT half: the shipped application REFUSES to
// draw a record that does not -- and it is the shipped function that is driven here, sliced out
// of app.js, not a second copy of the rule written beside it and then measured against itself.
//
// -- WHY THE SECOND HALF IS THE LOAD-BEARING ONE ------------------------------
// A gate that only checked the file would pass forever on a file nobody edits while the screen
// quietly grew a path that draws an unsourced card. The rule has to live in the application, and
// the application's own copy of it has to be what goes red. So section C runs asmaaCardShowable
// -- the real one, from the real bundle -- over all ninety-nine records AND over nine deliberately
// broken ones, and section D breaks the shipped rule three ways to prove section C can fail.
//
// -- WHAT THIS GATE DOES NOT DO -----------------------------------------------
// It does not repair, normalise, re-order or rewrite either sheet, and it does not decide whether
// a religious text is correctly attributed -- it decides whether the attribution is THERE. Both
// files are the owner's own bytes and this guard compares them; it never writes them.
//
// Usage: node guards/asmaa-attribution-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const readBuf = (rel) => fs.readFileSync(path.join(REPO, rel));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  return ok(name, a === b, 'got ' + a + '\n        want ' + b);
}
const head = (t) => console.log('\n=== ' + t + ' ===');

console.log('=== asmaa-attribution-guard -- ITEM 26: no card without its book, its author and its page ===');

/* ================================================================== *
 * A. THE TWO SHEETS ARE THE OWNER'S BYTES
 * ================================================================== */
head('A. THE TWO SHEETS, BYTE FOR BYTE');
// Pinned from the order that handed them over. They were copied into the tree with
// fs.copyFileSync and not one byte of either was authored here; both are pinned `text eol=lf`
// in .gitattributes so a clone with core.autocrlf=true cannot make these two lines read false
// about files nobody touched.
const NAMES_REL = 'asmaa-dataset-final-r3.json';
const RULES_REL = 'asmaa-rules-page-r2.json';
const NAMES_SHA = '44d1c38c689bee81182e9d558b3a009b580707a264989173df03657808efedfe';
const RULES_SHA = '5b1dfbc9ace5c5b45040a8292e7442ae42a9ab7a36b3757d17e62ad3d791cec1';
const NAMES_BYTES = 153202;
const RULES_BYTES = 5931;

const namesBuf = readBuf(NAMES_REL), rulesBuf = readBuf(RULES_REL);
eq('the names sheet is the size it was handed over at', namesBuf.length, NAMES_BYTES);
eq('...and its fingerprint is unchanged', sha256(namesBuf), NAMES_SHA);
eq('the rules sheet is the size it was handed over at', rulesBuf.length, RULES_BYTES);
eq('...and its fingerprint is unchanged', sha256(rulesBuf), RULES_SHA);
// A CR anywhere in either file is the defect .gitattributes exists to stop, and it would move
// both fingerprints above -- stated separately so the reason is legible when it fires.
ok('neither sheet carries a CR', namesBuf.indexOf(13) === -1 && rulesBuf.indexOf(13) === -1);

let NAMES = null, RULES = null;
try { NAMES = JSON.parse(namesBuf.toString('utf8')); } catch (e) { ok('the names sheet parses', false, e.message); }
try { RULES = JSON.parse(rulesBuf.toString('utf8')); } catch (e) { ok('the rules sheet parses', false, e.message); }
ok('the names sheet is an array', Array.isArray(NAMES));
eq('...of ninety-nine records', Array.isArray(NAMES) ? NAMES.length : -1, 99);
eq('...numbered 1..99 with no gap and no repeat',
  Array.isArray(NAMES) ? NAMES.map((r) => r.n).filter((n, i) => n !== i + 1) : ['unreadable'], []);

/* ================================================================== *
 * B. THE ATTRIBUTION RULE, OVER EVERY RECORD AND EVERY QUOTED TEXT
 * ================================================================== */
head('B. EVERY RECORD NAMES ITS BOOK, ITS AUTHOR AND ITS PAGES');
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const PAGED = ['quote', 'ayah', 'hadith', 'grading_note'];

{
  const noBook = [], noAuthor = [], noPages = [], badRange = [], pagesDisagree = [];
  for (const r of (NAMES || [])) {
    const src = r.source;
    if (!src || !nonEmpty(src.book)) noBook.push(r.n);
    if (!src || !nonEmpty(src.author)) noAuthor.push(r.n);
    if (!src || !nonEmpty(src.pages)) noPages.push(r.n);
    const ep = r.entry_pages || {};
    if (!(typeof ep.from === 'number' && typeof ep.to === 'number' && ep.from >= 1 && ep.to >= ep.from)) badRange.push(r.n);
    // The two statements of the same range must agree, or one of them is decoration.
    else if (src && nonEmpty(src.pages)) {
      const parts = String(src.pages).split('-').map(Number);
      const from = parts[0], to = parts.length > 1 ? parts[1] : parts[0];
      if (from !== ep.from || to !== ep.to) pagesDisagree.push(r.n + ' ' + src.pages + ' vs ' + ep.from + '-' + ep.to);
    }
  }
  eq('every record names a book', noBook, []);
  eq('every record names an author', noAuthor, []);
  eq('every record names its pages', noPages, []);
  eq('every record carries a sane entry_pages range', badRange, []);
  eq('...and source.pages states the same range', pagesDisagree, []);
}

head('B2. EVERY QUOTED TEXT CARRIES ITS PRINTED PAGE, INSIDE THAT RECORD\'S RANGE');
// THE SHAPE ROSTER IS PART OF THE CLAIM. A field that quietly changed shape -- an object that
// became a string, a page that became a string of digits -- would slip past a check that only
// looked for "some page somewhere", so the shape is named and counted.
{
  const noPage = [], outside = [], emptyText = [], wrongShape = [];
  const stringGrading = [];
  for (const r of (NAMES || [])) {
    const ep = r.entry_pages || {};
    for (const f of PAGED) {
      const v = r[f];
      if (v == null) continue;
      if (f === 'grading_note' && typeof v === 'string') { stringGrading.push(r.n); if (!nonEmpty(v)) emptyText.push(r.n + '.' + f); continue; }
      if (typeof v !== 'object') { wrongShape.push(r.n + '.' + f + ' is ' + typeof v); continue; }
      if (!nonEmpty(v.text)) emptyText.push(r.n + '.' + f);
      if (typeof v.printed_page !== 'number') { noPage.push(r.n + '.' + f); continue; }
      if (!(v.printed_page >= ep.from && v.printed_page <= ep.to)) {
        outside.push(r.n + '.' + f + ' p' + v.printed_page + ' not in ' + ep.from + '-' + ep.to);
      }
    }
  }
  eq('no quoted text is an unexpected shape', wrongShape, []);
  eq('no quoted text is empty', emptyText, []);
  eq('every quoted text carries a printed page', noPage, []);
  eq('...and every printed page falls inside its record\'s entry_pages', outside, []);
  // 🔴 THE ONE ADMITTED EXCEPTION, PINNED BY NUMBER RATHER THAN BY KIND. n=60's grading_note is a
  // composed note citing an outside reference («وانظر: السلسلة الصحيحة»), not a sentence lifted
  // off a page of the book, so it carries no printed page and could not carry one. It is admitted
  // -- and it is admitted ONCE: a second unpaged quotation arriving behind it fails this line.
  eq('exactly one unpaged quoted field exists, and it is record 60\'s grading note', stringGrading, [60]);
}

head('B3. THE SOURCES ARE THE TWO BOOKS THE ORDER NAMED');
{
  const books = Array.from(new Set((NAMES || []).map((r) => r.source && r.source.book))).sort();
  const authors = Array.from(new Set((NAMES || []).map((r) => r.source && r.source.author))).sort();
  eq('two books and no third', books, ['فقه الأسماء الحسنى', 'القواعد المثلى في صفات الله وأسمائه الحسنى'].sort());
  eq('two authors and no third', authors, ['عبد الرزاق بن عبد المحسن البدر', 'محمد بن صالح العثيمين'].sort());
}

/* ================================================================== *
 * C. THE SHIPPED APPLICATION'S OWN COPY OF THE RULE
 * ================================================================== */
head('C. THE SHIPPED FILTER, DRIVEN OVER THE SHIPPED SHEET');
// SLICED OUT OF app.js -- the artefact that actually reaches a browser -- and not re-typed. The
// slice is asserted before it is used: an anchor that silently matched nothing would make every
// case below vacuous, which is the exact failure mode this repository has a guard for.
const APPJS = read('app.js');
// app.js is the COMPACTED output of the build, so every anchor below is the compact form. The
// gate `babel` already guarantees app.js is what app.jsx compiles to, so slicing the artefact
// that actually reaches a browser is the stronger of the two claims and not a shortcut past it.
const FN_ANCHOR = 'function asmaaCardShowable(rec){';
function sliceRule(source) {
  const at = source.indexOf('const ASMAA_PAGED_FIELDS');
  if (at === -1) return null;
  const fnAt = source.indexOf(FN_ANCHOR, at);
  if (fnAt === -1) return null;
  // brace-match the function body
  let i = source.indexOf('{', fnAt), depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return source.slice(at, i);
}
const RULE_SRC = sliceRule(APPJS);
ok('the shipped attribution filter was located in app.js', !!RULE_SRC);
ok('...and the slice is the whole function, not a prefix of it',
  !!RULE_SRC && RULE_SRC.indexOf(FN_ANCHOR) !== -1 && /\}\s*$/.test(RULE_SRC));
ok('...and it is long enough to be a rule rather than a stub', !!RULE_SRC && RULE_SRC.length > 600,
  RULE_SRC ? 'slice is ' + RULE_SRC.length + ' chars' : 'no slice');

// A bare context: the filter reads no store, makes no request and touches no DOM, so anything
// more than this would be scenery. If it ever needs more, THAT is the finding.
function runRule(source) {
  if (typeof source !== 'string' || source.indexOf(FN_ANCHOR) === -1) throw new Error('no rule source to run');
  const ctx = vm.createContext({});
  vm.runInContext(source + '\n', ctx, { filename: 'asmaa-rule.js' });
  return (rec) => vm.runInContext('asmaaCardShowable', ctx)(rec);
}
let showable = null;
try { showable = runRule(RULE_SRC); } catch (e) { ok('the shipped filter evaluates on its own', false, e.message); }
ok('the shipped filter evaluates on its own -- it needs no store, no DOM and no network', !!showable);

if (showable) {
  const refused = (NAMES || []).filter((r) => !showable(r)).map((r) => r.n);
  eq('the shipped filter draws all ninety-nine records in the shipped sheet', refused, []);

  // NINE BROKEN RECORDS, ONE DEFECT EACH. Every one of them is a card the owner said must not be
  // drawn, and every one is built by taking a real record and removing exactly one thing.
  const base = JSON.parse(JSON.stringify((NAMES || []).find((r) => r.n === 14) || {}));
  const strip = (fn) => { const c = JSON.parse(JSON.stringify(base)); fn(c); return c; };
  const BROKEN = [
    ['no book', strip((c) => { delete c.source.book; })],
    ['an empty book', strip((c) => { c.source.book = '   '; })],
    ['no author', strip((c) => { delete c.source.author; })],
    ['no pages', strip((c) => { delete c.source.pages; })],
    ['no source object at all', strip((c) => { delete c.source; })],
    ['no entry_pages', strip((c) => { delete c.entry_pages; })],
    ['a quote whose page is before the entry', strip((c) => { c.quote.printed_page = c.entry_pages.from - 1; })],
    ['a quote whose page is after the entry', strip((c) => { c.quote.printed_page = c.entry_pages.to + 1; })],
    ['a hadith with no printed page', strip((c) => { c.hadith = { text: 'نص', takhrij: null }; })],
  ];
  // The base must itself be drawable, or every line below passes for the wrong reason.
  ok('the record the nine are cut from is drawable before it is broken', showable(base));
  ok('...and it really carries the four fields the nine remove',
    !!(base.source && base.entry_pages && base.quote && base.hadith));
  const drawn = BROKEN.filter(([, rec]) => showable(rec)).map(([why]) => why);
  eq('the shipped filter refuses every record that cannot name its source', drawn, []);

  // AND ABSENCE IS NOT A DEFECT. 17 records carry no ayah and 41 no hadith; withholding those
  // cards would be this gate's rule eating the owner's own sheet.
  const noAyah = (NAMES || []).filter((r) => r.ayah == null);
  const noHadith = (NAMES || []).filter((r) => r.hadith == null);
  ok('a record with no ayah is still drawn', noAyah.length > 0 && noAyah.every(showable),
    'records without an ayah: ' + noAyah.length);
  ok('a record with no hadith is still drawn', noHadith.length > 0 && noHadith.every(showable),
    'records without a hadith: ' + noHadith.length);
}

/* ================================================================== *
 * D. AND IT CAN GO RED -- THREE MUTANTS ON THE SHIPPED RULE
 * ================================================================== */
head('D. THE MUTANTS');
// Each mutant is a way somebody could disarm the filter while the screen still looked right.
// The mutation is applied to the SHIPPED slice, it is asserted to have actually changed the
// text (a no-op mutant reports a false PASS), and then the nine broken records are pushed
// through it: a mutant that still refuses all nine has not been killed.
function mutantKilled(label, find, replace) {
  if (!RULE_SRC) { ok('mutant ' + label + ' -- killed', false, 'no slice to mutate'); return; }
  const hits = RULE_SRC.split(find).length - 1;
  if (hits !== 1) { ok('mutant ' + label + ' -- the seam it cuts exists exactly once', false, 'occurrences: ' + hits); return; }
  const mutated = RULE_SRC.replace(find, replace);
  if (mutated === RULE_SRC) { ok('mutant ' + label + ' -- the mutation actually applied', false, 'text unchanged'); return; }
  let f = null;
  try { f = runRule(mutated); } catch (e) { ok('mutant ' + label + ' -- killed (it no longer runs)', true); return; }
  const base = JSON.parse(JSON.stringify((NAMES || []).find((r) => r.n === 14) || {}));
  const strip = (fn) => { const c = JSON.parse(JSON.stringify(base)); fn(c); return c; };
  const cases = [
    strip((c) => { delete c.source.book; }),
    strip((c) => { delete c.source.author; }),
    strip((c) => { delete c.source.pages; }),
    strip((c) => { delete c.entry_pages; }),
    strip((c) => { c.quote.printed_page = c.entry_pages.to + 1; }),
    strip((c) => { c.hadith = { text: 'نص', takhrij: null }; }),
  ];
  const nowDrawn = cases.filter((c) => { try { return f(c); } catch (e) { return false; } }).length;
  ok('mutant ' + label + ' -- killed (a broken record becomes drawable)', nowDrawn > 0,
    'the mutant still refuses all ' + cases.length + ' broken records');
}
mutantKilled('م١: the filter always says yes', FN_ANCHOR, FN_ANCHOR + 'return true;');
mutantKilled('م٢: the page is no longer required to be inside the entry',
  'if(!(v.printed_page>=from&&v.printed_page<=to))return false;', '');
mutantKilled('م٣: the source object stops being checked',
  'if(!asmaaNonEmpty(src.book)||!asmaaNonEmpty(src.author)||!asmaaNonEmpty(src.pages))return false;', '');

/* ================================================================== *
 * E. THE SECTION DOES NOT TOUCH THE BRAIN
 * ================================================================== */
head('E. ZERO REACH FROM THE SECTION INTO THE MODEL, OR FROM THE MODEL INTO THE SECTION');
// «القسمُ لا يمسُّ مخَّ عزك ولا يُجلَبُ منه شيءٌ إليه — نصٌّ يُقرَأُ فقط.»
// Measured as a reference sweep over every server-side directory: the two sheets are named
// NOWHERE outside the client bundle and this guard. A retrieval layer that learned to read them
// would be naming one of these strings, and this is where that shows up.
{
  const NEEDLES = [NAMES_REL, RULES_REL, 'loadAsmaaNames', 'loadAsmaaRules', 'ASMAA_NAMES_URL', 'ASMAA_RULES_URL'];
  const ROOTS = ['lib', 'api'];
  const walk = (dir, out) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(js|mjs|cjs|json|ts)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const files = [];
  for (const r of ROOTS) walk(path.join(REPO, r), files);
  ok('the server-side sweep actually found files to read', files.length > 50, 'files scanned: ' + files.length);
  // The free-brain directory is named on its own line as well, because it is the one the order
  // singles out and a sweep that silently stopped covering it would still pass the line above.
  const brain = files.filter((p) => p.replace(/\\/g, '/').indexOf('/lib/free-brain/') !== -1);
  ok('...and lib/free-brain/ is inside that sweep', brain.length >= 5, 'free-brain files: ' + brain.length);
  const hits = [];
  for (const p of files) {
    let body = '';
    try { body = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    for (const n of NEEDLES) if (body.indexOf(n) !== -1) hits.push(path.relative(REPO, p) + ' names ' + n);
  }
  eq('no server file, retrieval layer or route names either sheet or either loader', hits, []);
  // AND THE SECTION ASKS NOTHING OF THE SERVER EITHER. The whole section's network surface is
  // the two GETs; a fetch to /api/ from inside it would be the same wall crossed the other way.
  const secAt = APPJS.indexOf('ITEM 26 -- أسماءُ اللهِ الحسنى');
  const secTo = APPJS.indexOf('ITEM 26 -- END OF أسماء الله الحسنى');
  ok('the section was located in the shipped bundle', secAt > 0 && secTo > secAt,
    'from ' + secAt + ' to ' + secTo);
  const SECTION = (secAt > 0 && secTo > secAt) ? APPJS.slice(secAt, secTo) : '';
  ok('...and the located region is the whole section', SECTION.length > 4000, 'region is ' + SECTION.length + ' chars');
  eq('the section calls no route and no model',
    ['/api/', 'aiFetch', 'sendMessage', 'EZIK_FATWA', 'runEngine', 'readAuthSession']
      .filter((w) => SECTION.indexOf(w) !== -1), []);
  eq('...and it opens no store', ['localStorage', 'sessionStorage', 'setItem', 'getItem']
    .filter((w) => SECTION.indexOf(w) !== -1), []);
}

/* ================================================================== *
 * F. THE TEXT IS FETCHED WHEN THE SECTION OPENS, NOT AT BOOT
 * ================================================================== */
head('F. THE LAZY LOAD');
// The proof the owner asked for, made checkable rather than narrated: the 153202 bytes are not
// inside what the browser downloads to boot. Five sentences are sampled from across the sheet --
// one string could be a coincidence, five spread over the file cannot be.
{
  const INDEX = read('index.html');
  const samples = [0, 24, 49, 74, 98].map((i) => (NAMES && NAMES[i] ? NAMES[i].quote.text.slice(0, 40) : null)).filter(Boolean);
  eq('five sentences were sampled from across the sheet', samples.length, 5);
  eq('not one of them is inside app.js', samples.filter((t) => APPJS.indexOf(t) !== -1), []);
  eq('...nor inside index.html', samples.filter((t) => INDEX.indexOf(t) !== -1), []);
  const rulesSample = (RULES && RULES.items && RULES.items[0]) ? RULES.items[0].quote.text.slice(0, 40) : '';
  ok('the rules text is not inside app.js either', !!rulesSample && APPJS.indexOf(rulesSample) === -1);
  // The fetch itself: two GETs, on the two URLs, made by the two loaders and by nothing else.
  ok('app.js fetches the names sheet by URL', APPJS.indexOf("fetch(ASMAA_NAMES_URL)") !== -1);
  ok('app.js fetches the rules sheet by URL', APPJS.indexOf("fetch(ASMAA_RULES_URL)") !== -1);
  eq('the names URL is the file at the origin root',
    (APPJS.match(/ASMAA_NAMES_URLs*=s*'([^']+)'/) || [, ''])[1], '/' + NAMES_REL);
  eq('the rules URL is the file at the origin root',
    (APPJS.match(/ASMAA_RULES_URLs*=s*'([^']+)'/) || [, ''])[1], '/' + RULES_REL);
  // AND NEITHER IS PRECACHED. A CORE entry would be fetched during install -- at boot, for every
  // reader, including the ones who never open the section -- which is the thing the order forbids.
  const SW = read('sw.js');
  const coreAt = SW.indexOf('const CORE = [');
  const CORE = coreAt === -1 ? '' : SW.slice(coreAt, SW.indexOf('];', coreAt));
  ok('the worker CORE list was located', CORE.length > 100);
  eq('neither sheet is in the worker\'s CORE', [NAMES_REL, RULES_REL].filter((f) => CORE.indexOf(f) !== -1), []);
  // The two files must still SHIP, or the fetch 404s in production.
  const VI = read('.vercelignore');
  eq('neither sheet is excluded from the deployment',
    [NAMES_REL, RULES_REL].filter((f) => new RegExp('^' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm').test(VI)), []);
}

/* ================================================================== *
 * G. THE SEVEN RULES ARE SEVEN
 * ================================================================== */
head('G. THE SEVEN RULES');
{
  const items = (RULES && Array.isArray(RULES.items)) ? RULES.items : null;
  ok('the rules sheet carries an items array', !!items);
  eq('seven items, no more and no fewer', items ? items.length : -1, 7);
  const src = RULES && RULES.source;
  ok('the rules sheet names its book, its author and its pages',
    !!(src && nonEmpty(src.book) && nonEmpty(src.author) && nonEmpty(src.pages)));
  const from = 6, to = 17;   // «القواعد المثلى» pages 6-17, as the sheet's own source states
  eq('...and that stated range is the one this gate measures against',
    src ? String(src.pages) : '', from + '-' + to);
  const bad = [];
  (items || []).forEach((it, i) => {
    if (!nonEmpty(it.title)) bad.push((i + 1) + ': no title');
    if (!nonEmpty(it.text)) bad.push((i + 1) + ': no text');
    if (!it.quote || !nonEmpty(it.quote.text)) bad.push((i + 1) + ': no quote');
    else if (typeof it.quote.printed_page !== 'number') bad.push((i + 1) + ': the quote carries no printed page');
    else if (!(it.quote.printed_page >= from && it.quote.printed_page <= to)) {
      bad.push((i + 1) + ': printed page ' + it.quote.printed_page + ' is outside ' + from + '-' + to);
    }
  });
  eq('every rule carries a title, a body and a quotation with its printed page', bad, []);
  // The screen maps this array once, so what the reader counts is what this line counts.
  ok('the shipped section maps the items array and does not filter it',
    APPJS.indexOf('doc.items.map(') !== -1 && APPJS.indexOf('doc.items.filter(') === -1);
}

console.log('\n' + (failures === 0 ? 'PASS' : 'FAIL') + '  ' + (checks - failures) + '/' + checks + ' checks');
process.exit(failures === 0 ? 0 : 1);
