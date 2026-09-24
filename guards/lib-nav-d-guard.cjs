// guards/lib-nav-d-guard.cjs -- م٤-د (LIB_NAV_V1): «ل» on a name as Arabic writes it, and no request for an
// author the reader already named.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٤-د): صيغةُ «لـ» («لـالقرضاوي» ⟵ «للقرضاوي» · «لـسيد قطب» ⟵
// «لسيد قطب») · وطلبُ اسمِ المؤلّفِ وقد ذُكر. MEASURED (04-quote/measure/D-form.md): both witnesses reproduced
// byte for byte; the only «لـ» writer on the quote path is one template, and the author request is a
// constant appended whatever the reader said.
//
// WHAT THIS PINS:
//   L1  the rules on the measured names: ال → لل, الل → لل (one lām merges), ابن keeps its alif, أبو → لأبي,
//       ذو → لذي, any other Arabic name attached with no tatweel, a Latin name keeps «لـ»;
//   L2  the owner's two witnesses with the switch on: «لسيد قطب», «للقرضاوي», and no «اسم مؤلفه»;
//   L3  the switch off: both witnesses byte for byte as they were (the pins libquote Dc2 and Dd1 hold);
//   L4  «فقه الزكاة للقرضاوي» glued in a «كتاب» title: the reading that names the author is echoed, the
//       title stops carrying «للقرضاوي», and the glued author reads «القرضاوي»;
//   L5  the «which one?» list writes «لابن الجوزي»; the page path uses the same form;
//   L6  api/ask.js hands the switch to the quote seat.
// Red on the tree before this item: `node guards/lib-nav-d-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
  return false;
}

async function main() {
  console.log('lib-nav-d guard — root ' + REPO);
  let L = null;
  try { L = await esm('lib/arabic-lam.js'); } catch { L = null; }
  const Q = await esm('lib/lib-quote.js');
  const lam = L ? L.withLam : () => '';

  // ── L1 ────────────────────────────────────────────────────────────────────
  const table = [
    ['القرضاوي', 'للقرضاوي'], ['الألباني', 'للألباني'], ['الليث بن سعد', 'لليث بن سعد'], ['اللالكائي', 'للالكائي'],
    ['ابن تيمية', 'لابن تيمية'], ['ابن باز', 'لابن باز'], ['أبو منصور الماتريدي', 'لأبي منصور الماتريدي'],
    ['ذو النون', 'لذي النون'], ['سيد قطب', 'لسيد قطب'], ['إبراهيم النخعي', 'لإبراهيم النخعي'], ['لقمان', 'للقمان'],
    ['binbaz.org.sa', 'لـbinbaz.org.sa'], ['الْجَعْبَري', 'للْجَعْبَري'],
  ];
  const got = table.map(([n]) => lam(n));
  ok('L1  the rules: ال → لل, الل, ابن, أبو → لأبي, ذو → لذي, attached with no tatweel, Latin keeps «لـ»',
    table.every(([, want], i) => got[i] === want), JSON.stringify(table.map(([n, w], i) => [n, w, got[i]]).filter((r) => r[1] !== r[2])));

  // ── L2 / L3 the two witnesses ─────────────────────────────────────────────
  const W1 = 'ما نص كلام سيد قطب في كتابه في ظلال القرآن عن الشورى؟';
  const W2 = 'اكتب لي نص كلام القرضاوي في كتابه فقه الزكاة عن زكاة الأسهم';
  const on1 = await Q.answerQuoteRequest(Q.detectQuoteRequest(W1), { form: true });
  const on2 = await Q.answerQuoteRequest(Q.detectQuoteRequest(W2), { form: true });
  const off1 = await Q.answerQuoteRequest(Q.detectQuoteRequest(W1), {});
  const off2 = await Q.answerQuoteRequest(Q.detectQuoteRequest(W2), {});
  ok('L2  the switch on: «لسيد قطب», «للقرضاوي», and no request for the author',
    on1 && on1.text === 'ليس عندي كتاب باسم «في ظلال القرآن» لسيد قطب. إن كان للكتاب اسم آخر يعرف به فاذكره لي.'
    && on2 && on2.text === 'ليس عندي كتاب باسم «فقه الزكاة» للقرضاوي. إن كان للكتاب اسم آخر يعرف به فاذكره لي.',
    JSON.stringify({ on1: on1 && on1.text, on2: on2 && on2.text }));
  ok('L3  the switch off: both witnesses as they were',
    off1 && off1.text === 'ليس عندي كتاب باسم «في ظلال القرآن» لـسيد قطب. إن كان للكتاب اسم آخر يعرف به، أو كان عندك اسم مؤلفه، فاذكره لي.'
    && off2 && off2.text === 'ليس عندي كتاب باسم «فقه الزكاة» لـالقرضاوي. إن كان للكتاب اسم آخر يعرف به، أو كان عندك اسم مؤلفه، فاذكره لي.',
    JSON.stringify({ off1: off1 && off1.text, off2: off2 && off2.text }));

  // ── L4 the glued author ───────────────────────────────────────────────────
  const G = 'انقل لي من كتاب فقه الزكاة للقرضاوي ما جاء في زكاة الأسهم';
  const ask = Q.detectQuoteRequest(G);
  const glued = ask && ask.candidates.find((c) => c.author);
  const g = await Q.answerQuoteRequest(ask, { form: true });
  ok('L4  a glued author in a «كتاب» title: echoed as the author, «القرضاوي», and not asked for',
    !!glued && glued.authorText === 'القرضاوي'
    && g && g.text === 'ليس عندي كتاب باسم «فقه الزكاة» للقرضاوي. إن كان للكتاب اسم آخر يعرف به فاذكره لي.',
    JSON.stringify({ glued, g: g && g.text }));

  // ── L5 the list, and the page path ────────────────────────────────────────
  const list = Q.askWhichReply([{ title: 'بر الوالدين', author: 'ابن الجوزي' }, { title: 'بر الوالدين', author: 'الطرطوشي' }], { form: true });
  const navSrc = read('lib/lib-nav.js');
  ok('L5  «which one?» writes «لابن الجوزي» and «للطرطوشي»; the page path uses the same form',
    list.includes('- «بر الوالدين» لابن الجوزي') && list.includes('- «بر الوالدين» للطرطوشي')
    && navSrc.includes("noBookReply(plan.titleText, plan.authorText || '', { form: true })")
    && navSrc.includes('askWhichReply(plan.books, { form: true })'),
    list);

  // ── L6 wiring ─────────────────────────────────────────────────────────────
  const ask6 = read('api/ask.js');
  ok('L6  api/ask.js hands the switch to the quote seat',
    /libQuote\.answerQuoteRequest\(quoteAsk, \{ runTool, createEvidenceTable, libFlagValue, libToken,\s*\n\s*\/\/[^\n]*\n\s*form: libNavValue === 'on' \}\)/u.test(ask6));

  console.log(`\n=== lib-nav-d: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== lib-nav-d: crashed ==='); process.exit(1); });
