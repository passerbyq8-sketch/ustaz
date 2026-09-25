// guards/lib-quote-author-book-guard.cjs -- ب٦ (order B, LIB_NAV_V1): a request to quote without the word
// «كتاب» is recognised when what follows «في» is a title of the index by an author named in the same
// question, and is not recognised without a named author.
//
// THE OWNER'S RULE (25 September): «يُعرَفُ طلبَ نقلٍ حينَ يطابقُ ما بعدَ «في» عنوانَ كتابٍ في الفهرسِ لمؤلّفٍ
// مذكورٍ في السؤالِ نفسِه، ولا يُعرَفُ بلا مؤلّفٍ مذكور». His negatives: «انقل لي كلام العلماء في حكم الغناء»
// and «انقل لي كلام ابن باز في حكم الأسهم» are not requests to quote from a book.
// MEASURED on c00e8f5 (program-2026-09-24/09-order-b/b5b6/measure/B5B6-MEASURE.md): a present book with a topic
// is recognised today without «كتاب»; his own example names a title and an author the index does not hold
// («فقه الزكاة», القرضاوي), so the rule cannot recognise it (decision D59).
//
// WHAT THIS PINS (lib/lib-quote.js, no library call):
//   K1  «نص كلام <X> في <his book>» with no topic: recognised with the switch on (his books alone, and the
//       reader asked for the topic); not recognised with it off, as before;
//   K2  a present book with a topic is recognised as before, switch on and off (report question 1);
//   K3  the owner's negatives as he wrote them, and their «نص» forms, are not recognised;
//   K4  an author found only among a title's words (a publisher «ط ابن الجوزي») does not make it his book;
//   K5  the owner's example: the index holds neither the title nor the author: not recognised, as today;
//   K6  the shapes without an author are untouched: «صحيح البخاري» and the owner's Q06 are quoted as sealed;
//   K7  the detector is untouched: `explicitBook` stays the lexical fact (false without «كتاب»).
// Red on the tree before this item: `node guards/lib-quote-author-book-guard.cjs --root <tree>`.
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
  console.log('lib-quote-author-book guard — root ' + REPO);
  const Q = await esm('lib/lib-quote.js');
  const plan = (s, form) => { const a = Q.detectQuoteRequest(s); return a ? Q.planQuote(a, { form }) : null; };
  const show = (p) => (p ? `${p.outcome}:${(p.books || []).map((b) => b.id).join('+')}` : 'null');

  // ── K1 ────────────────────────────────────────────────────────────────────────────────────────────
  const K1 = [
    ['انقل لي نص كلام مجاهد بن جبر في تفسير مجاهد', 'FC-000002', 'مجاهد بن جبر'],
    ['انقل لي نص كلام سفيان الثوري في تفسير سفيان الثوري', 'FC-000004', 'سفيان الثوري'],
    ['ما نص ما قاله سهل التستري في تفسير التستري', 'FC-000012', 'سهل التستري'],
  ];
  const k1 = K1.map(([s, id, author]) => ({ s, id, author, on: plan(s, true), off: plan(s, false) }));
  ok('K1  «نص كلام X في <his book>», no topic: recognised with the switch on (his books alone, the topic asked); off: not, as before',
    k1.every((x) => x.on && x.on.outcome === 'need_topic' && (x.on.books || []).some((b) => b.id === x.id)
      && (x.on.books || []).every((b) => b.author === x.author) && x.off === null),
    JSON.stringify(k1.map((x) => [x.s, show(x.on), show(x.off)])));

  // ── K2 ────────────────────────────────────────────────────────────────────────────────────────────
  const Q1 = 'انقل لي نص كلام ابن قدامة في المغني عن صلاة الخوف';
  const k2on = plan(Q1, true); const k2off = plan(Q1, false);
  ok('K2  a present book with a topic is recognised as before (report question 1), switch on and off',
    k2on && k2on.outcome === 'search' && show(k2on) === show(k2off) && show(k2on).includes('FC-003727'), show(k2on) + ' || ' + show(k2off));

  // ── K3 ────────────────────────────────────────────────────────────────────────────────────────────
  const NEG = ['انقل لي كلام العلماء في حكم الغناء', 'انقل لي كلام ابن باز في حكم الأسهم',
    'انقل لي نص كلام العلماء في حكم الغناء', 'انقل لي نص كلام ابن باز في حكم الأسهم'];
  const k3 = NEG.map((s) => [s, plan(s, true)]);
  ok('K3  the owner\'s negatives as he wrote them, and their «نص» forms, are not recognised',
    k3.every(([, p]) => p === null), JSON.stringify(k3.map(([s, p]) => [s, show(p)])));

  // ── K4 ────────────────────────────────────────────────────────────────────────────────────────────
  const k4 = plan('انقل لي نص كلام ابن الجوزي في الإيمان الأوسط', true);
  ok('K4  a name found only among a title\'s words («ط ابن الجوزي», a publisher) does not make it his book',
    k4 === null, show(k4));

  // ── K5 ────────────────────────────────────────────────────────────────────────────────────────────
  const OWNER = 'انقل لي نص كلام القرضاوي في فقه الزكاة عن زكاة الرواتب';
  ok('K5  the owner\'s example: the index holds neither «فقه الزكاة» nor القرضاوي: not recognised, as today',
    plan(OWNER, true) === null && plan(OWNER, false) === null, show(plan(OWNER, true)));

  // ── K6 ────────────────────────────────────────────────────────────────────────────────────────────
  const SEALED = ['انقل لي من صحيح البخاري ما جاء في فضل الصلاة', 'انقل لي بالنص ما في مجموع فتاوى ابن باز عن حج تارك الصلاة'];
  const k6 = SEALED.map((s) => [s, plan(s, true), plan(s, false)]);
  ok('K6  the shapes without an author are untouched: «صحيح البخاري» and the owner\'s Q06 are quoted as sealed',
    k6.every(([, on, off]) => on && on.outcome === 'search' && show(on) === show(off)), JSON.stringify(k6.map(([s, a, b]) => [s, show(a), show(b)])));

  // ── K7 ────────────────────────────────────────────────────────────────────────────────────────────
  const d = Q.detectQuoteRequest(K1[0][0]);
  ok('K7  the detector is untouched: `explicitBook` stays the lexical fact (false without «كتاب»)',
    d && d.explicitBook === false && d.shape === 'kalam', JSON.stringify(d && { shape: d.shape, explicitBook: d.explicitBook }));

  console.log(`\n=== lib-quote-author-book: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
