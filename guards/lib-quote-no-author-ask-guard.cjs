// guards/lib-quote-no-author-ask-guard.cjs -- ج٥ (order C, LIB_NAV_V1): the owner's decision 1 of 25 September
// (D67): «ردُّ «ليس عندي» لا يسألُ عن اسمِ المؤلّفِ أبدًا: تُحذَفُ «أو كان عندك اسم مؤلفه» من كلِّ ردٍّ بأنّ الكتابَ ليس
// عندي، بطريقِ النقلِ وطريقِ الصفحةِ برقمِها، ويبقى «إن كان للكتاب اسم آخر يعرف به فاذكره لي»».
//
// MEASURED on the tree before this item (program-2026-09-24/10-order-c/c5/C5-MEASURE.md): after order B's addendum
// (D64) the reply still asked for the author whenever no author could be read off the title — «مختصر لسان العرب»,
// «الغواصين في البحار», and 920 of 2,533 named authors on the quote road and 1,430 on the page road (D65).
//
// WHAT THIS PINS (lib/lib-quote.js and lib/lib-nav.js, no library call):
//   A1  the quote road, a title the index does not hold and no author: not asked for, the rest byte for byte;
//   A2  ...a title whose «ل»-word is a word of the index's titles (it was still asked after D64);
//   A3  ...an author glued with a common first name (D65's witness «خلق المسلم لمحمد الغزالي»);
//   A4  ...an author named apart («للقرضاوي»): as before, not asked;
//   A5  the page road: a book by number the index does not hold: not asked for;
//   A6  the switch off: the quote road's replies are what they were, the author asked for (the page road
//       is reached only with the switch on).
// Red on the tree before this item: `node guards/lib-quote-no-author-ask-guard.cjs --root <tree>`.
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
const ASK = ' إن كان للكتاب اسم آخر يعرف به، أو كان عندك اسم مؤلفه، فاذكره لي.';
const NOASK = ' إن كان للكتاب اسم آخر يعرف به فاذكره لي.';

async function main() {
  console.log('lib-quote-no-author-ask guard — root ' + REPO);
  let Q = null, NAV = null;
  try { Q = await esm('lib/lib-quote.js'); NAV = await esm('lib/lib-nav.js'); } catch (e) { ok('A0  the modules load', false, e.message); }
  if (!Q || !NAV) { console.log(`\n=== lib-quote-no-author-ask: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('this guard makes no network call'); };
  const deps = (form) => ({ runTool: async () => ({ added: [] }), createEvidenceTable: () => ({}), libFlagValue: 'on', libToken: 'tk-c5', form });
  const reply = async (s, form) => { const a = Q.detectQuoteRequest(s); const r = a ? await Q.answerQuoteRequest(a, deps(form)) : null; return r ? r.text : ''; };
  const page = async (s, flag) => {
    const r = await NAV.answerPageRequest(s, { flagValue: flag, token: 'tk-c5', baseUrl: 'https://lib-preview.ezik.app' });
    return r ? r.text : '';
  };
  try {
    const a1 = await reply('انقل لي من كتاب الغواصين في البحار ما جاء في الصلاة', true);
    ok('A1  a title the index does not hold, no author: not asked for, and the rest of the reply byte for byte',
      a1 === `ليس عندي كتاب باسم «الغواصين في البحار».${NOASK}`, a1);
    const a2 = await reply('انقل لي من كتاب مختصر لسان العرب ما جاء في معنى الصبر', true);
    ok('A2  a title whose «ل»-word is a word of the index\'s titles: not asked for (it was, after D64)',
      a2 === `ليس عندي كتاب باسم «مختصر لسان العرب».${NOASK}`, a2);
    const a3 = await reply('انقل لي من كتاب خلق المسلم لمحمد الغزالي ما جاء في الصدق', true);
    ok('A3  an author glued with a common first name (D65\'s witness): not asked for',
      a3 === `ليس عندي كتاب باسم «خلق المسلم لمحمد الغزالي».${NOASK}`, a3);
    const a4 = await reply('انقل لي نص كلام القرضاوي في كتابه فقه الزكاة عن زكاة الرواتب', true);
    ok('A4  an author named apart: «للقرضاوي», not asked for, as before',
      a4 === `ليس عندي كتاب باسم «فقه الزكاة» للقرضاوي.${NOASK}`, a4);
    const a5 = await page('انقل لي نص الصفحة ١٠ من كتاب الغواصين في البحار', 'on');
    ok('A5  the page road: a book by number the index does not hold: not asked for',
      a5 === `ليس عندي كتاب باسم «الغواصين في البحار».${NOASK}`, a5);
    const off = [
      await reply('انقل لي من كتاب الغواصين في البحار ما جاء في الصلاة', false),
      await reply('انقل لي من كتاب مختصر لسان العرب ما جاء في معنى الصبر', false),
      await reply('انقل لي من كتاب خلق المسلم لمحمد الغزالي ما جاء في الصدق', false),
    ];
    // (The page road exists only with the switch on: api/ask.js calls lib/lib-nav.js under LIB_NAV_V1 alone.)
    ok('A6  the switch off: the quote road asks for the author exactly as it did',
      off.every((r) => r.endsWith(ASK)) && off[0] === `ليس عندي كتاب باسم «الغواصين في البحار».${ASK}`,
      JSON.stringify(off));
  } finally { globalThis.fetch = realFetch; }
  console.log(`\n=== lib-quote-no-author-ask: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
