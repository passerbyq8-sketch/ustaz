// guards/brain-postship-16-guard.cjs -- POSTSHIP FIX3 ITEM 1 -- 2026-10-25 (completes POSTSHIP item 9)
//
// «النص الكامل» SHOWS ONE BLOCK, IN THE EXCERPT'S PLACE. Measured on the preview (brief answer, «حكم قراءة الحائض للقرآن دون
// مس المصحف»): before the press a 251-character excerpt closed by «…» and the button; after it the excerpt stayed and a second,
// whole block came under it, its first line the raw heading «## نص الفتوى» -- «السؤال:» twice and «الجواب:» twice. Read in the
// code: lib/full-fatwa.js sends the excerpt and then <fatwafull> carrying the whole block, heading included; app.jsx
// FatwaFullText drew that block as raw text in a pre-wrap div in the button's place, and the excerpt above it stayed.
// The order (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-FIX3-DIRECTIVE-2026-10-25.md, item 1): after the press
// one block, the full text where the excerpt was, drawn as the excerpt and the detailed block are drawn (a heading, «السؤال:»
// and «الجواب:» once, no «##»), the fatwa's text letter for letter as the detailed answer serves it; before the press nothing
// changes; the detailed and student depths as they are.
// How: the SHIPPED app.js runs in a linkedom window with the repository's React; a brief answer is built from real long
// fatwa records (guards/fixtures-postship-2-fatwas.json, copied from the stores by item 2) by lib/full-fatwa.js and laid out
// as lib/before-writing-v2.js emits it; parseRichMessage and ezikRenderSegments draw it. Before the press: react-dom/server.
// The press: react-dom/client in the same window, a click on the button.
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { parseHTML } = require('linkedom');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const firstDiff = (a, b) => { let k = 0; while (k < a.length && a[k] === b[k]) k++; return k + ': ' + asc(a.slice(k, k + 70)) + ' | ' + asc(b.slice(k, k + 70)); };
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '.');
const count = (s, x) => String(s).split(x).length - 1;

const React = require(path.join(REPO, 'node_modules', 'react'));
const { renderToStaticMarkup } = require(path.join(REPO, 'node_modules', 'react-dom', 'server'));
const ReactDOMClient = require(path.join(REPO, 'node_modules', 'react-dom', 'client'));
const { flushSync } = require(path.join(REPO, 'node_modules', 'react-dom'));

// the shipped client, in a window of its own; its root is not mounted
const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div><div id="t"></div></body></html>');
window.self = window.self || window;
window.window = window.window || window;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.scrollTo = window.scrollTo || (() => {});
{ const store = {}; window.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => {} }; }
window.React = React;
window.ReactDOM = { createRoot: () => ({ render() {}, unmount() {} }) };
window.console.error = () => {};   // linkedom's window is the process's own global: as markdown-guard does, the client's error lines are quiet
global.window = window;
global.document = window.document;
try { global.navigator = window.navigator; } catch (e) { /* node 21+ owns a read-only navigator */ }
const ctx = vm.createContext(window);
vm.runInContext(fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'), ctx, { filename: 'app.js' });
const api = vm.runInContext('({ parse: parseRichMessage, render: ezikRenderSegments, serialize: serializeReply, tts: formatForTTS })', ctx);

// what the reader reads: the markup's text, block elements on their own lines
const textOf = (html) => html.replace(/<(?:div|p|h[1-6]|li|br)\b[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const Sheet = ({ text }) => React.createElement('div', null, api.render(api.parse(text, 30).segments, { tashkeel: true, age: 30 }));
const serverDraw = (text) => renderToStaticMarkup(React.createElement(Sheet, { text }));
const host = window.document.getElementById('t');
function pressDraw(text) {
  const root = ReactDOMClient.createRoot(host);
  flushSync(() => root.render(React.createElement(Sheet, { text })));
  const before = host.innerHTML;
  const btn = Array.prototype.find.call(host.querySelectorAll('button'), (b) => b.textContent === 'النص الكامل');
  if (btn) flushSync(() => btn.dispatchEvent(new window.Event('click', { bubbles: true })));
  const after = host.innerHTML;
  root.unmount();
  return { before, after, pressed: !!btn };
}

(async () => {
  const FF = await esm('lib/full-fatwa.js');
  const BW = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
  const MUFTI = (/export const BW2_DIRECT_MUFTI = '([^']*)';/.exec(BW) || [])[1] || '';
  const FIX = require('./fixtures-postship-2-fatwas.json');
  const build = (r) => FF.buildFatwaRecord({ id: r.id, question: r.question, answer: r.answer, title: r.title, url: r.url, publisher: 'ابن باز', sourceKind: 'corpus', contentMode: 'written_fatwa' });
  // as lib/before-writing-v2.js emits it: the block, the mufti line, the source card, then the writer's prose
  const answerOf = (block, r) => block + '\n\n' + MUFTI + 'ابن باز\n' + '<source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/1">' + r.title + '</source>\n\n'
    + 'والخلاصة أن المسألة كما في الفتوى أعلاه، والله أعلم.';
  console.log('-- 0. the shipped client');
  ok('app.js runs, and parseRichMessage / ezikRenderSegments are reached', typeof api.parse === 'function' && typeof api.render === 'function');
  let long = 0;
  for (const r of FIX.rows) {
    const rec = build(r);
    const whole = FF.serverOwnedBlock(rec, [], {});
    if (whole.length <= FF.BRIEF_FATWA_MAX) continue;
    long += 1;
    const tag = asc(r.id) + ' (' + whole.length + ')';
    const brief = answerOf(FF.serverOwnedBlock(rec, [], { brief: true }), r);
    const detailed = answerOf(whole, r);
    console.log('-- ' + tag);
    const printed = FF.printedFatwaPair(rec);
    const detailedText = textOf(serverDraw(detailed));
    // before the press
    const pre = serverDraw(brief);
    const preText = textOf(pre);
    const exAt = preText.indexOf('نص الفتوى');
    const exEnd = preText.indexOf('…', exAt);
    const excerpt = exAt >= 0 && exEnd > exAt ? preText.slice(exAt, exEnd + 1) : '';
    ok(tag + ' before: an excerpt of 600 characters at most, closed by «…»', !!excerpt && excerpt.length <= 600, String(excerpt.length));
    ok(tag + ' before: then the button «النص الكامل»', /<button[^>]*>النص الكامل<\/button>/.test(pre) && count(pre, '<button') === 1);
    ok(tag + ' before: the heading is a heading (no «##» on screen)', !preText.includes('##') && /role="heading"[^>]*>نص الفتوى<\/div>/.test(pre));
    // the press
    const d = pressDraw(brief);
    // linkedom writes attributes in its own order, so the client's drawing is compared by what it reads and what it holds
    ok(tag + ' before (client): the same text and the same one button as the server draws', textOf(d.before) === preText && count(d.before, '<button') === 1, firstDiff(preText, textOf(d.before)));
    const postText = textOf(d.after);
    ok(tag + ' after: the button was pressed and is gone', d.pressed && !/<button/.test(d.after));
    ok(tag + ' after: one heading «نص الفتوى», and it is a heading', count(postText, 'نص الفتوى') === 1 && /role="heading"[^>]*>نص الفتوى<\/div>/.test(d.after), String(count(postText, 'نص الفتوى')));
    ok(tag + ' after: «السؤال:» once and «الجواب:» once', count(postText, 'السؤال:') === 1 && count(postText, 'الجواب:') === 1, count(postText, 'السؤال:') + ' ' + count(postText, 'الجواب:'));
    ok(tag + ' after: no «##» in the drawn text', !postText.includes('##'));
    ok(tag + ' after: no «…» left of the excerpt', count(postText, '…') === count(detailedText, '…'), count(postText, '…') + ' vs ' + count(detailedText, '…'));
    ok(tag + ' after: the question and the answer are the detailed block\'s, letter for letter', norm(postText).includes(norm(printed.question)) && norm(postText).includes(norm(printed.answer)));
    ok(tag + ' after: the whole sheet reads as the detailed answer reads', norm(postText) === norm(detailedText), asc(norm(postText).slice(-60)) + ' | ' + asc(norm(detailedText).slice(-60)));
    {
      // the fatwa's last words, then the mufti line, then the source card: the full text took the excerpt's place
      const flat = norm(postText); const endAt = flat.indexOf(norm(printed.answer).slice(-40)); const muftiAt = flat.lastIndexOf(MUFTI + 'ابن باز');
      ok(tag + ' after: the full text stands where the excerpt stood (before the mufti line and the card)', endAt >= 0 && endAt < muftiAt && muftiAt < flat.lastIndexOf(norm(r.title)), endAt + ' ' + muftiAt);
    }
    ok(tag + ' the detailed answer has no button', !/<button/.test(serverDraw(detailed)));
  }
  ok('the fixture holds long fatwas to test (at least two over 600)', long >= 2, String(long));

  // the reader who asked in another language: the answer goes through lib/lang/answer.js with a fake translator (no model)
  // that answers every string with a plain line of Latin letters. The block stays Arabic, its translation rides on the
  // source card (`tb`). Before this item the <fatwafull> tag stayed at the block's old place (the top of the answer) while
  // the Arabic block moved after its card, so the button stood apart from its excerpt.
  console.log('-- the reader in another language (en, fa, ur)');
  {
    const A = await esm('lib/lang/answer.js');
    const echo = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); return { ok: true, text: JSON.stringify(arr.map((s, k) => 'Translated text number ' + (k + 1) + '.')) }; };
    const r = FIX.rows.find((x) => x.id === 'alathary:53');
    const rec = build(r);
    for (const lang of ['en', 'fa', 'ur']) {
      const out = (await A.translateAnswer(answerOf(FF.serverOwnedBlock(rec, [], { brief: true }), r), { lang, translate: echo, budgetMs: 20000 })).text;
      const d = pressDraw(out);
      const preText = textOf(d.before); const postText = textOf(d.after);
      ok(lang + ': before, the Arabic excerpt closed by «…» and the button', d.pressed && count(preText, 'نص الفتوى') === 1 && preText.includes('…'));
      ok(lang + ': after, one block: one heading, «السؤال:» and «الجواب:» once, no «##»', !/<button/.test(d.after) && count(postText, 'نص الفتوى') === 1 && count(postText, 'السؤال:') === 1 && count(postText, 'الجواب:') === 1 && !postText.includes('##'));
      ok(lang + ': after, the fatwa\'s Arabic text whole', norm(postText).includes(norm(FF.printedFatwaPair(rec).answer)));
      ok(lang + ': the button stands right under its excerpt (the tag follows the block\'s «…»)', /…\s*<fatwafull matn="/.test(out));
      ok(lang + ': the translation still rides on the source card', /<source\b[^>]*\btb="/.test(out));
    }
  }

  console.log('-- the wiring');
  const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  ok('the full text is drawn by the one prose site (no pre-wrap div of raw text)', !/dir="auto">\{body\}<\/div>/.test(app)
    && /full=\{prose\(\{ type: 'text', content: brief\.content \}\)\}/.test(app));
  ok('the server still sends the excerpt, then the tag with the whole block (unchanged)', fs.readFileSync(path.join(REPO, 'lib/full-fatwa.js'), 'utf8').includes("return briefExcerpt(whole, BRIEF_FATWA_MAX) + '…\\n' + '<fatwafull matn=\"'"));

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
