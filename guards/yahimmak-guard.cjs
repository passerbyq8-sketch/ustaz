// guards/yahimmak-guard.cjs -- «يهمّك». EVERY FACT OF THE SECTION STANDS ON THE BOOK'S OWN WORDS,
// ON THE PAGE IT NAMES, OR THE READER DOES NOT SEE IT; AND THE SECTION IS FREE.
//
// -- THE OWNER'S SENTENCE (26 October 2026), WHICH IS THE WHOLE OF THIS GATE ----------------------
//   «تأكد انك ماخذ المعلومات من الكتاب الرسمي وبنفس الطريقه البسيطه اللي سويتها نبي نطبقها ونضيفها
//    الحين كقسم جديد بعزك، وكيل واحد يضبط كل شيء ويضيفها وينشر، اسمه "يهمك" واكيد كل شي مجاني بعزك،
//    بس كنوز المعرفه»
//
// THE DATA half: yahimmak.json against yahimmak-book.json, the library's own pages of «الدروس المهمة
// لعامة الأمة» (lib.ezik.app book FC-004071). Every item, game answer and quiz answer carries
// witness: [{ page, text }], and the text must be found on that page under rule N -- harakat
// U+064B..U+065F and U+0670 removed, tatweel removed, whitespace collapsed, then a substring.
// THE CLIENT half: the shipped filter, sliced out of app.js and run here, refuses an item whose
// witness does not match; the section carries no purchase, trial or store symbol; and the
// section's one key is swept by «حذف كل بياناتي».
// THE MUTATIONS: the rule is broken three ways on in-memory copies, and each must turn this red.
// THE CORRECTION (FIX1, 27 October 2026): page 10 of the library copy read «ففد أشرك»; the collected works
// (مجموع فتاوى ابن باز، ج٣ ص٢٩٠, library book FC-004528) read «فقد أشرك». The page text carries the corrected
// letter, page 10 alone carries a note naming the correction and its source, the source note says so, and
// the client shows the note under its page. M5-M7 break it on in-memory copies.
//
// Usage: node guards/yahimmak-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const head = (t) => console.log('\n=== ' + t + ' ===');
console.log('=== yahimmak-guard -- «يهمّك»: from the book, on its page, and free ===');

const N = (s) => String(s == null ? '' : s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim();
const TYPES = ['reveal', 'split', 'match', 'flip', 'list', 'checklist', 'order', 'sort', 'truefalse', 'sequence', 'steps', 'stepper', 'reflect', 'moments'];
const AUDIO_HOSTS = ['othmanalkhamees.com'];

// The whole data check is one function of (data, book) returning the list of problems, so the
// mutations below run the very same check over broken copies.
function dataProblems(data, book) {
  const bad = [];
  const pages = {};
  if (!book || book.schema !== 'yahimmak-book/1' || !Array.isArray(book.pages) || !book.pages.length) bad.push('book file shape');
  (book && book.pages || []).forEach((p) => { if (Number.isInteger(p.page) && typeof p.text === 'string') pages[p.page] = p.text; else bad.push('book page shape'); });
  if (!data || data.schema !== 'yahimmak/1') { bad.push('data schema'); return bad; }
  if (!data.book || data.book.library_book_id !== book.library_book_id) bad.push('library_book_id differs between the two files');
  const L = Array.isArray(data.lessons) ? data.lessons : [];
  if (JSON.stringify(L.map((x) => x.n)) !== JSON.stringify(Array.from({ length: 18 }, (_, i) => i + 1))) bad.push('lessons are not 1..18 in order');
  const st = (data.stations || []).flatMap((s) => s.lessons || []);
  if (JSON.stringify(st) !== JSON.stringify(Array.from({ length: 18 }, (_, i) => i + 1))) bad.push('stations do not cover each lesson once, in order: ' + JSON.stringify(st));
  const byN = {}; L.forEach((x) => { byN[x.n] = x; });
  const inRange = (text, range) => {
    if (!Array.isArray(range)) return false;
    for (let p = range[0]; p <= range[1]; p++) if (pages[p] !== undefined && N(pages[p]).includes(N(text))) return true;
    return false;
  };
  const witnessOk = (w, lesson, where) => {
    if (!Array.isArray(w) || !w.length) { bad.push(where + ': no witness'); return; }
    w.forEach((x) => {
      const range = (byN[x.lesson || lesson] || {}).pages;
      if (!x || !Number.isInteger(x.page) || !N(x.text)) { bad.push(where + ': witness shape'); return; }
      if (!range || x.page < range[0] || x.page > range[1]) { bad.push(where + ': page ' + x.page + ' outside lesson ' + (x.lesson || lesson)); return; }
      if (pages[x.page] === undefined || !N(pages[x.page]).includes(N(x.text))) bad.push(where + ': witness not on page ' + x.page + ': ' + String(x.text).slice(0, 40));
    });
  };
  const itemOk = (it, n, where) => {
    if (!it || typeof it.label !== 'string' || !it.label.trim()) bad.push(where + ': no label');
    witnessOk(it && it.witness, n, where + (it && it.id ? ' ' + it.id : ''));
  };
  L.forEach((x) => {
    const w = 'lesson ' + x.n;
    if (!Array.isArray(x.pages) || x.pages.length !== 2) bad.push(w + ': pages');
    if (!inRange(x.book_heading || '', x.pages)) bad.push(w + ': book_heading not found');
    const sm = x.summary || {};
    if (typeof sm.text !== 'string' || sm.text.length > 110) bad.push(w + ': summary missing or over 110 characters');
    if (sm.kind === 'paraphrase') {
      if (!Array.isArray(sm.terms) || !sm.terms.length) bad.push(w + ': paraphrase with no terms');
      (sm.terms || []).forEach((t) => { if (!inRange(t, x.pages)) bad.push(w + ': term not found: ' + t); });
    } else if (sm.kind === 'verbatim') witnessOk(sm.witness, x.n, w + ' summary');
    else bad.push(w + ': summary kind');
    (x.cards || []).forEach((c) => {
      if (TYPES.indexOf(c.type) < 0) bad.push(w + ': card type ' + c.type);
      (c.items || []).forEach((it) => itemOk(it, x.n, w));
      (c.plain || []).forEach((it) => itemOk(it, x.n, w));
      (c.groups || []).forEach((g) => (g.items || []).forEach((it) => itemOk(it, x.n, w)));
      if (c.done) itemOk(c.done, x.n, w + ' done');
      if (c.note) itemOk(c.note, x.n, w + ' note');
    });
    (x.quiz || []).forEach((q) => { if (typeof q.q !== 'string' || typeof q.answer !== 'boolean') bad.push(w + ': quiz shape'); witnessOk(q.witness, x.n, w + ' ' + q.id); });
    (x.audio || []).forEach((a) => {
      let u = null, pu = null;
      try { u = new URL(a.src); pu = new URL(a.page_url); } catch (e) {}
      if (!u || u.protocol !== 'https:' || AUDIO_HOSTS.indexOf(u.hostname) < 0) bad.push(w + ': audio src not https on the measured host: ' + a.src);
      if (!pu || pu.protocol !== 'https:' || AUDIO_HOSTS.indexOf(pu.hostname) < 0) bad.push(w + ': audio page_url');
    });
  });
  // THE COUNTS THE BOOK GIVES
  const card = (n, pred) => ((byN[n] || {}).cards || []).find(pred) || { items: [] };
  const plainCount = (n, type) => card(n, (c) => c.type === type).items.filter((i) => !i.exception).length;
  const excCount = (n, type) => card(n, (c) => c.type === type).items.filter((i) => i.exception).length;
  const want = [
    ['lesson 2: five pillars', card(2, (c) => c.visual === 'pillars').items.length, 5],
    ['lesson 3: six pillars of faith', card(3, (c) => c.type === 'reveal').items.length, 6],
    ['lesson 6: nine conditions', card(6, (c) => c.type === 'checklist').items.length, 9],
    ['lesson 7: fourteen pillars', card(7, (c) => c.type === 'list').items.length, 14],
    ['lesson 8: eight obligations', card(8, (c) => c.type === 'list').items.length, 8],
    ['lesson 11: eight invalidators', plainCount(11, 'truefalse'), 8],
    ['lesson 11: its two exception cards', excCount(11, 'truefalse'), 2],
    ['lesson 12: ten conditions', card(12, (c) => c.type === 'checklist').items.length, 10],
    ['lesson 13: six obligations', card(13, (c) => c.type === 'list' && c.items.length >= 6).items.length, 6],
    ['lesson 14: six nullifiers', plainCount(14, 'truefalse'), 6],
    ['lesson 14: its two «لا ينقض» cards', excCount(14, 'truefalse'), 2],
    ['lesson 17: seven destroyers', card(17, (c) => c.type === 'reveal').items.length, 7],
  ];
  want.forEach(([what, got, n]) => { if (got !== n) bad.push(what + ': ' + got + ' (want ' + n + ')'); });
  // 2-2 OF THE ORDER: six unambiguous pairs; الانقياد and the eighth shown plain, unpaired
  const m = card(2, (c) => c.type === 'match');
  if (m.items.length !== 6 || m.items.some((i) => !i.pair)) bad.push('lesson 2: the match pairs exactly six');
  const plain = (m.plain || []).map((i) => N(i.label));
  if (plain.indexOf(N('الانقياد')) < 0 || plain.indexOf(N('الكفر بما يعبد من دون الله')) < 0) bad.push('lesson 2: الانقياد and the eighth condition are not shown plain');
  // THE PRAYER MAP
  const pm = data.prayer_map || {};
  const pos = (pm.positions || []).map((p) => p.id);
  const ents = pm.entries || [];
  ents.forEach((e) => { if (pos.indexOf(e.position) < 0) bad.push('map: unknown position ' + e.position); itemOk(e, e.lesson, 'map ' + e.item); });
  const uniq = (n) => new Set(ents.filter((e) => e.lesson === n).map((e) => e.item));
  if (uniq(7).size !== 14) bad.push('map: ' + uniq(7).size + ' unique arkan (want 14)');
  if (uniq(8).size !== 8) bad.push('map: ' + uniq(8).size + ' unique wajibat (want 8)');
  [7, 8].forEach((n) => card(n, (c) => c.type === 'list').items.forEach((it) => { if (!uniq(n).has(it.id)) bad.push('map: lesson ' + n + ' item ' + it.id + ' missing'); }));
  return bad;
}

head('A. THE DATA: every witness on its page, the book\'s counts, the map, the audio');
const DATA = JSON.parse(read('yahimmak.json'));
const BOOK = JSON.parse(read('yahimmak-book.json'));
const problems = dataProblems(DATA, BOOK);
ok('yahimmak.json stands on yahimmak-book.json (lessons, stations, headings, witnesses, terms, counts, map, audio)',
  problems.length === 0, problems.slice(0, 12).join('\n        '));
ok('the book file is the library\'s copy and names it', BOOK.library_book_id === 'FC-004071' && /lib\.ezik\.app/.test(BOOK.source_note || ''));
// THE CORRECTION ON PAGE 10 -- one function of the book, so M5-M7 run the very same check over broken copies.
const FIX1_NOTE = "صُحِّح في هذه الصفحة حرفٌ في الحديث: «ففد» إلى «فقد»، كما في مجموع فتاوى ابن باز، ج٣ ص٢٩٠.";
const FIX1_SENTENCE = "وصُحِّح فيه حرفٌ واحد في ص١٠، مبيَّنٌ تحتها.";
function correctionProblems(book) {
  const bad = [];
  const ps = (book && Array.isArray(book.pages)) ? book.pages : [];
  const p10 = ps.find((p) => p && p.page === 10);
  if (ps.some((p) => p && typeof p.text === 'string' && p.text.indexOf('ففد') !== -1)) bad.push('a page text holds «ففد»');
  if (!p10 || typeof p10.text !== 'string' || p10.text.indexOf('فقد أشرك') === -1) bad.push('page 10 does not read «فقد أشرك»');
  if (!p10 || p10.note !== FIX1_NOTE) bad.push('page 10 note is not the correction line');
  const noted = ps.filter((p) => p && p.note !== undefined).map((p) => p.page);
  if (JSON.stringify(noted) !== '[10]') bad.push('pages with a note: ' + JSON.stringify(noted) + ' (want [10])');
  if (typeof (book && book.source_note) !== 'string' || book.source_note.indexOf(FIX1_SENTENCE) === -1) bad.push('source_note lacks the correction sentence');
  if (!/lib\.ezik\.app/.test((book && book.source_note) || '')) bad.push('source_note no longer names lib.ezik.app');
  return bad;
}
const fixProblems = correctionProblems(BOOK);
ok('page 10 reads «فقد أشرك», no page text holds «ففد», page 10 alone carries the correction note, and the source note names the correction and lib.ezik.app',
  fixProblems.length === 0, fixProblems.join('\n        '));
const witnessCount = JSON.stringify(DATA).split('"witness":').length - 1;
ok('...and it is a real body of evidence, not a vacuous pass (witness entries: ' + witnessCount + ')', witnessCount > 300);
const SW = read('sw.js');
const audioSrcs = DATA.lessons.flatMap((x) => (x.audio || []).map((a) => a.src));
ok('no audio address appears in sw.js (the worker never stores the audio)', audioSrcs.length > 0 && audioSrcs.every((u) => SW.indexOf(u) === -1) && SW.indexOf('othmanalkhamees') === -1);
const idle = SW.slice(SW.indexOf('const IDLE = ['), SW.indexOf('];', SW.indexOf('const IDLE = [')));
const core = SW.slice(SW.indexOf('const CORE = ['), SW.indexOf('];', SW.indexOf('const CORE = [')));
ok('both files warm after the boot goes idle (IDLE), and neither rides the boot (CORE)',
  idle.indexOf("'/yahimmak.json'") !== -1 && idle.indexOf("'/yahimmak-book.json'") !== -1 && core.length > 0 && core.indexOf('yahimmak') === -1);

head('B. THE CLIENT: the shipped filter refuses an item whose witness does not match');
const APPJS = read('app.js');
const FN = 'function yahimmakItemShowable(';
function sliceRule(source) {
  const at = source.indexOf('const YAHIMMAK_N_RE');
  const fnAt = at === -1 ? -1 : source.indexOf(FN, at);
  if (fnAt === -1) return null;
  let i = source.indexOf('{', fnAt), depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return source.slice(at, i);
}
const RULE = sliceRule(APPJS);
ok('the shipped filter was located in app.js, whole', !!RULE && RULE.indexOf(FN) !== -1 && RULE.indexOf('function yahimmakWitnessOk(') !== -1 && /\}\s*$/.test(RULE));
function runRule(src) {
  const ctx = vm.createContext({});
  vm.runInContext(src + '\n;this.__f = yahimmakItemShowable;', ctx, { filename: 'yahimmak-rule.js' });
  return ctx.__f;
}
const PAGES = {}; BOOK.pages.forEach((p) => { PAGES[p.page] = p.text; });
const ALL = [];
DATA.lessons.forEach((x) => (x.cards || []).forEach((c) => (c.items || []).concat(c.plain || [], (c.groups || []).flatMap((g) => g.items)).forEach((it) => ALL.push(it))));
const real = ALL[7];
const BROKEN = [
  { ...real, witness: [{ page: real.witness[0].page, text: real.witness[0].text + ' كلمة لم يكتبها الكتاب' }] },
  { ...real, witness: [{ page: real.witness[0].page === 5 ? 6 : 5, text: 'نافيا جميع ما يعبد من دون الله والتسليمتان' }] },
  { ...real, witness: [] },
  { ...real, witness: undefined },
  { ...real, label: '' },
  { ...real, witness: [{ page: 999, text: real.witness[0].text }] },
];
let showable = null;
try { showable = runRule(RULE); } catch (e) { ok('the shipped filter runs on its own', false, e.message); }
if (showable) {
  ok('every item of the shipped file passes the shipped filter (' + ALL.length + ' items)', ALL.every((it) => showable(it, PAGES)));
  ok('...and every one of ' + BROKEN.length + ' broken items is refused (an altered witness, the wrong page, none, an empty label, a page the book lacks)',
    BROKEN.every((it) => showable(it, PAGES) === false), JSON.stringify(BROKEN.map((it) => showable(it, PAGES))));
  ok('the filter reads rule N: a witness written without its harakat still matches the page that has them',
    showable({ label: 'x', witness: [{ page: 23, text: 'وقتل النفس التي حرم الله إلا بالحق' }] }, PAGES) === true);
}
const SEC_AT = APPJS.indexOf('const YAHIMMAK_URL');
const SEC_TO = APPJS.indexOf('// YAHIMMAK -- END');
const SECTION = SEC_AT !== -1 && SEC_TO > SEC_AT ? APPJS.slice(SEC_AT, SEC_TO) : '';
ok('the section was located in app.js', SECTION.length > 10000 && SECTION.indexOf('function EzikYahimmakSection(') !== -1);
const PAID = /\bIAP\b|\biap[A-Z_]|[a-z]Iap\b|purchase|Purchase|\btrial\b|Trial|paywall|Paywall|entitle|Entitle|kunuz|Kunuz|KUNUZ|treasure|TREASURE|quest\.html|StoreKit|billing|Billing/;
const paidHit = SECTION.match(PAID);
ok('the section calls no purchase, trial, store or Kunuz symbol -- it is free', SECTION && !paidHit, paidHit ? 'found: ' + paidHit[0] : '');
const sweepAt = APPJS.indexOf("localStorage.removeItem('ezik_hide_women_v1')");
const sweep = sweepAt === -1 ? '' : APPJS.slice(Math.max(0, APPJS.lastIndexOf('const resetAll', sweepAt)), APPJS.indexOf('sessionStorage', sweepAt));
ok('the section\'s one key is ezik_yahimmak_v1', /const YAHIMMAK_KEY\s*=\s*['"]ezik_yahimmak_v1['"]/.test(APPJS));
ok('...and «حذف كل بياناتي» (the sweep that removes ezik_hide_women_v1) removes it', sweep.indexOf('localStorage.removeItem(YAHIMMAK_KEY)') !== -1);

function slicePrepare(source) {
  const at = source.indexOf('const YAHIMMAK_N_RE');
  const fnAt = at === -1 ? -1 : source.indexOf('function yahimmakPrepare(', at);
  if (fnAt === -1) return null;
  let i = source.indexOf('{', fnAt), depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return source.slice(at, i);
}
const PREP = slicePrepare(APPJS);
let prepared = null;
try { const ctx = vm.createContext({}); vm.runInContext(PREP + '\n;this.__p = yahimmakPrepare;', ctx, { filename: 'yahimmak-prepare.js' }); prepared = ctx.__p(DATA, BOOK); }
catch (e) { ok('the shipped yahimmakPrepare runs on its own', false, e && e.message); }
ok('the shipped yahimmakPrepare builds the notes map beside the pages map: exactly page 10, with its note',
  !!prepared && !!prepared.pages && JSON.stringify(prepared.notes) === JSON.stringify({ 10: FIX1_NOTE }), prepared ? JSON.stringify(prepared.notes) : 'not run');
ok('...and the «من نصّ الكتاب» sheet renders a page\'s note under its text, in the small line, kept from translation',
  /React\.createElement\("p",\{style:s\.yhPageText,"data-ez-keep":"1"\},P\.pages\[p\]\),P\.notes\[p\]\?\/\*#__PURE__\*\/React\.createElement\("div",\{style:s\.yhSubLine,"data-ez-keep":"1"\},P\.notes\[p\]\):null\)/.test(SECTION));

head('C. MUTATIONS: each break of the rule turns this gate red');
const clone = (o) => JSON.parse(JSON.stringify(o));
{
  const d = clone(DATA);
  d.lessons[1].cards[0].items[0].witness[0].text += ' زيادة';
  ok('M1 a witness that does not match is caught', dataProblems(d, BOOK).some((p) => /witness not on page/.test(p)));
  if (showable) ok('M1 ...and the shipped filter refuses that item', showable(d.lessons[1].cards[0].items[0], PAGES) === false);
}
{
  const d = clone(DATA);
  d.lessons[1].cards[0].items.pop();
  ok('M2 a dropped pillar is caught', dataProblems(d, BOOK).some((p) => /five pillars/.test(p)));
}
{
  const cut = APPJS.replace('localStorage.removeItem(YAHIMMAK_KEY)', 'void 0');
  const s2 = cut.slice(Math.max(0, cut.lastIndexOf('const resetAll', cut.indexOf("localStorage.removeItem('ezik_hide_women_v1')"))), cut.indexOf('sessionStorage', cut.indexOf("localStorage.removeItem('ezik_hide_women_v1')")));
  ok('M3 a missing sweep entry is caught', cut !== APPJS && s2.length > 0 && s2.indexOf('localStorage.removeItem(YAHIMMAK_KEY)') === -1);
}
{
  if (RULE) {
    const m = RULE.replace(FN + 'item,pages){', FN + 'item,pages){return true;');
    let f = null; try { f = runRule(m); } catch (e) {}
    ok('M4 a filter that always says yes is caught by the broken items', m !== RULE && !!f && BROKEN.some((it) => f(it, PAGES) === true));
  }
}
{
  const b = clone(BOOK);
  delete b.pages.find((p) => p.page === 10).note;
  ok('M5 the page-10 note removed is caught', correctionProblems(b).some((p) => /page 10 note/.test(p)));
}
{
  const b = clone(BOOK);
  const p = b.pages.find((x) => x.page === 10);
  p.text = p.text.replace('فقد أشرك', 'ففد أشرك');
  ok('M6 «ففد» put back in page 10 is caught', correctionProblems(b).some((x) => /«ففد»/.test(x)) && correctionProblems(b).some((x) => /does not read/.test(x)));
}
{
  const b = clone(BOOK);
  b.pages.find((p) => p.page === 11).note = FIX1_NOTE;
  ok('M7 a note added to another page is caught', correctionProblems(b).some((p) => /pages with a note/.test(p)));
}

console.log('\n' + (failures === 0 ? 'PASS' : 'FAIL') + '  ' + (checks - failures) + '/' + checks + ' checks');
process.exit(failures === 0 ? 0 : 1);
