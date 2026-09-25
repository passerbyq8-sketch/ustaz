// guards/lib-quote-glue-guard.cjs -- ب٥ (order B, LIB_NAV_V1): the author a reader glued to a title with a
// plain «ل» («تفسير مجاهد لمجاهد بن جبر») is separated from the title BY THE INDEX, not by the wording: only
// where the words before the «ل» are a title in the index and the words after it are that book's author.
//
// THE OWNER'S RULE (25 September): «والفصلُ بالفهرسِ لا باللفظ: لا يُفصَلُ إلّا إذا طابقَ ما قبلَ اللامِ عنوانًا
// وما بعدَها مؤلّفَه». His negative fixture: «لغات القبائل الواردة في القرآن الكريم» stays as it is.
// MEASURED on c00e8f5 (program-2026-09-24/09-order-b/b5b6/measure/B5B6-MEASURE.md): 1,939 of 3,074 books whose
// author a reader glues this way were answered «ليس عندي». His own example («في ظلال القرآن لسيد قطب») names a
// title and an author the index does not hold, so the rule cannot split it (decision D58).
//
// WHAT THIS PINS (lib/lib-quote.js, no library call):
//   N1  in-index books glued with a plain «ل»: split, and the reader's own book is searched (switch on);
//       with the switch off, «ليس عندي» as before;
//   N2  the owner's negative: «لغات القبائل الواردة في القرآن الكريم» is quoted as it was, switch on and off;
//   N3  a title that merely has a word beginning with «ل» and is not in the index is not split;
//   N4  the owner's own example: the index holds neither the title nor the author, so nothing is split
//       and the reply stays today's (the rule is the index's, not the wording's);
//   N5  every index title that holds a plain-ل word, typed verbatim, gets the same plan with the switch on;
//   N6  «لل/لا» are read as before (M4-d): «فقه الزكاة للقرضاوي» echoes the title and names the author.
// Red on the tree before this item: `node guards/lib-quote-glue-guard.cjs --root <tree>`.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
  return false;
}

async function main() {
  console.log('lib-quote-glue guard — root ' + REPO);
  const Q = await esm('lib/lib-quote.js');
  const { LIB_CATALOG } = await esm('lib/data/lib-catalog.js');
  const plan = (s, form) => { const a = Q.detectQuoteRequest(s); return a ? Q.planQuote(a, { form }) : null; };
  const ids = (p) => (p ? (p.books || []).map((b) => b.id).join('+') : '');
  const show = (p) => (p ? `${p.outcome}:${ids(p)}:«${p.titleText}»:${p.authorText || ''}` : 'null');

  // ── N1 ────────────────────────────────────────────────────────────────────────────────────────────
  const POS = [
    ['FC-000002', 'تفسير مجاهد', 'مجاهد بن جبر'],
    ['FC-000004', 'تفسير سفيان الثوري', 'سفيان الثوري'],
    ['FC-000012', 'تفسير التستري', 'سهل التستري'],
  ];
  const n1 = POS.map(([id, title, author]) => {
    const s = `انقل لي من كتاب ${title} ل${author} ما جاء في الصلاة`;
    return { id, on: plan(s, true), off: plan(s, false), title, author };
  });
  ok('N1  a book of the index glued to its author with a plain «ل»: split, and that very book is searched; off: as before',
    n1.every((x) => x.on && x.on.outcome === 'search' && ids(x.on) === x.id && x.on.titleText === x.title
      && x.off && x.off.outcome === 'no_book' && x.off.titleText === `${x.title} ل${x.author}`),
    JSON.stringify(n1.map((x) => [show(x.on), show(x.off)])));

  // ── N2 ────────────────────────────────────────────────────────────────────────────────────────────
  const NEG = 'انقل لي من كتاب لغات القبائل الواردة في القرآن الكريم ما ذكره في لغة هذيل';
  const n2on = plan(NEG, true); const n2off = plan(NEG, false);
  ok('N2  the owner\'s negative «لغات القبائل الواردة في القرآن الكريم» stays as it is (FC-000530), switch on and off',
    n2on && n2on.outcome === 'search' && ids(n2on) === 'FC-000530' && show(n2on) === show(n2off), show(n2on) + ' || ' + show(n2off));

  // ── N3 ────────────────────────────────────────────────────────────────────────────────────────────
  const absent = ['مختصر لسان العرب', 'رسالة لطالب العلم', 'نصيحة لكل مسلم'];
  const n3 = absent.map((t) => plan(`انقل لي من كتاب ${t} ما جاء في الصلاة`, true));
  ok('N3  a title that is not in the index and has a word beginning with «ل» is not split',
    n3.every((p, i) => p && p.outcome === 'no_book' && p.titleText === absent[i] && !p.authorText), JSON.stringify(n3.map(show)));

  // ── N4 ────────────────────────────────────────────────────────────────────────────────────────────
  const OWNER = 'انقل لي من كتاب في ظلال القرآن لسيد قطب كلامه عن الصبر';
  const n4on = plan(OWNER, true); const n4off = plan(OWNER, false);
  ok('N4  the owner\'s example: the index holds neither «في ظلال القرآن» nor سيد قطب, so nothing is split, as today',
    n4on && n4on.outcome === 'no_book' && n4on.titleText === 'في ظلال القرآن لسيد قطب' && show(n4on) === show(n4off),
    show(n4on) + ' || ' + show(n4off));

  // ── N5 ────────────────────────────────────────────────────────────────────────────────────────────
  let verbatim = 0; const moved = [];
  for (const row of LIB_CATALOG) {
    const [, title, , , , blocked] = row;
    if (blocked) continue;
    if (!String(title).split(/\s+/u).slice(1).some((w) => /^ل[^لا]/u.test(w))) continue;
    const s = `انقل لي من كتاب ${title} ما جاء في الصلاة`;
    const a = Q.detectQuoteRequest(s);
    if (!a) continue;
    verbatim += 1;
    const on = Q.planQuote(a, { form: true }); const off = Q.planQuote(a, { form: false });
    if (show(on) !== show(off)) moved.push(title);
  }
  ok(`N5  every index title holding a plain-ل word, typed verbatim (${verbatim}), gets the same plan with the switch on`,
    verbatim > 500 && moved.length === 0, moved.slice(0, 10).join(' | '));

  // ── N6 ────────────────────────────────────────────────────────────────────────────────────────────
  const n6 = plan('انقل لي من كتاب فقه الزكاة للقرضاوي ما جاء في زكاة الرواتب', true);
  ok('N6  «لل/لا» are read as before (M4-d): «فقه الزكاة» with القرضاوي named', n6 && n6.outcome === 'no_book'
    && n6.titleText === 'فقه الزكاة' && n6.authorText === 'القرضاوي', show(n6));

  console.log(`\n=== lib-quote-glue: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
