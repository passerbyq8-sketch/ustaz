// guards/brain-postship-19-guard.cjs -- POSTSHIP FIX4 ITEM 1 -- 2026-10-25 (completes POSTSHIP item 9 and FIX3 item 1)
//
// EVERY SURFACE THAT READS THE ANSWER KNOWS THE <fatwafull> TAG. Measured on 456eed10 (FIX3 report, incidental defects):
// copying or sharing a brief fatwa answer carried «[fatwafull: not serialized]» in place of the full text, beside the excerpt
// alone (4 of 4 records); its voice read the tag's base64 matn and the button's label (alathary:53's brief answer spoke 17529
// characters against a 3893-character block); and in the folded view the fold could cut the excerpt, so the press drew the
// whole block under the cut preview.
// The order (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-FIX4-DIRECTIVE-2026-10-25.md, item 1):
//   - copy and share carry ONE fatwa block, the full text in the excerpt's place, letter for letter what the detailed answer
//     copies of the same block; no line for the tag, no button label, no excerpt twice;
//   - the voice reads the answer as it is drawn before the press, the excerpt alone: no button label, no character of the
//     tag's attributes;
//   - the stream preview and the parents' log carry neither the base64 nor the label;
//   - the folded view: the press shows one block in the excerpt's place;
//   - book's open="1" (POSTSHIP item 6) leaks to none of them; the reader in another language likewise;
//   - an answer with no tag: what every surface carries is the same before and after, byte for byte;
//   - a mutant per surface: its fix taken out, this guard goes red.
// How: the SHIPPED app.js runs in a linkedom window with the repository's React (as postship16); brief and detailed answers
// are built from the four long real records of guards/fixtures-postship-2-fatwas.json by lib/full-fatwa.js and laid out as
// lib/before-writing-v2.js emits them; the reader in another language goes through lib/lang/answer.js with a fake translator.
// No model, no network. POSTSHIP19_APP may name another app.js to test (the red run on the order's head).
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const { parseHTML } = require('linkedom');

const REPO = path.join(__dirname, '..');
const APP = process.env.POSTSHIP19_APP || path.join(REPO, 'app.js');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '.');
const count = (s, x) => String(s).split(x).length - 1;
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

const React = require(path.join(REPO, 'node_modules', 'react'));
const { renderToStaticMarkup } = require(path.join(REPO, 'node_modules', 'react-dom', 'server'));
const ReactDOMClient = require(path.join(REPO, 'node_modules', 'react-dom', 'client'));
const { flushSync } = require(path.join(REPO, 'node_modules', 'react-dom'));

// one build of the client, in a window of its own; its root is not mounted
function boot(src) {
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div><div id="t"></div></body></html>');
  window.self = window.self || window;
  window.window = window.window || window;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.scrollTo = window.scrollTo || (() => {});
  { const store = {}; window.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => {} }; }
  window.React = React;
  window.ReactDOM = { createRoot: () => ({ render() {}, unmount() {} }) };
  window.console.error = () => {};
  global.window = window;
  global.document = window.document;
  try { global.navigator = window.navigator; } catch (e) { /* node 21+ owns a read-only navigator */ }
  const ctx = vm.createContext(window);
  vm.runInContext(src, ctx, { filename: 'app.js' });
  const api = vm.runInContext('({ parse: parseRichMessage, render: ezikRenderSegments, serialize: serializeReply, tts: formatForTTS,'
    + ' log: formatForLog, preview: formatForStreamPreview, previewSegs: ezikStreamPreviewSegments, fold: ezikFoldSegments,'
    + ' favSnippet: ezikFavSnippet, FOLD_MIN: EZIK_FOLD_MIN_CHARS, FOLD_HEAD: EZIK_FOLD_HEAD_CHARS })', ctx);
  api.window = window;
  return api;
}

// what the reader reads: the markup's text, block elements on their own lines
const textOf = (html) => html.replace(/<(?:div|p|h[1-6]|li|br)\b[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const drawSegs = (api, segs) => renderToStaticMarkup(React.createElement('div', null, api.render(segs, { tashkeel: true, age: 30 })));
function pressSegs(api, segs) {
  global.window = api.window; global.document = api.window.document;
  const host = api.window.document.getElementById('t');
  const root = ReactDOMClient.createRoot(host);
  flushSync(() => root.render(React.createElement('div', null, api.render(segs, { tashkeel: true, age: 30 }))));
  const before = host.innerHTML;
  const btn = Array.prototype.find.call(host.querySelectorAll('button'), (b) => b.textContent === 'النص الكامل');
  if (btn) flushSync(() => btn.dispatchEvent(new api.window.Event('click', { bubbles: true })));
  const after = host.innerHTML;
  root.unmount();
  return { before, after, pressed: !!btn };
}

// a run of 40 or more characters of the tag's base64, wherever the surface put them: the surface's Latin letters read in order
// against the base64's (the voice turns digits and + / = into words, the log and the preview turn the brackets into spaces)
function b64Leak(out, b64) {
  const flat = String(out).replace(/[^A-Za-z]/g, '');
  const src = String(b64).replace(/[^A-Za-z]/g, '');
  if (flat.length < 40) return false;
  const grams = new Set();
  for (let k = 0; k + 40 <= src.length; k++) grams.add(src.slice(k, k + 40));
  for (let k = 0; k + 40 <= flat.length; k++) if (grams.has(flat.slice(k, k + 40))) return true;
  return false;
}
const LABEL = 'النص الكامل';

// THE CHECKS, per surface, for one build. `cases` are the tagged answers; each check is [surface, name, cond, detail].
function surfaceChecks(api, cases) {
  const out = [];
  const add = (surface, name, cond, detail) => out.push({ surface, name, cond: !!cond, detail: detail == null ? '' : String(detail) });
  for (const c of cases) {
    const segs = api.parse(c.brief, 30).segments;
    const dsegs = api.parse(c.detailed, 30).segments;
    // copy and share: both hand over buildCopyText = serializeReply(segments, { tashkeel, band }) (MessageBubble)
    for (const tashkeel of [true, false]) {
      const copy = api.serialize(segs, { tashkeel, band: 'adult' });
      const dcopy = api.serialize(dsegs, { tashkeel, band: 'adult' });
      const t = c.tag + (tashkeel ? '' : ' (no tashkeel)');
      add('copy', t + ' copy: «نص الفتوى», «السؤال:» and «الجواب:» once each', count(copy, 'نص الفتوى') === 1 && count(copy, 'السؤال:') === 1 && count(copy, 'الجواب:') === 1,
        count(copy, 'نص الفتوى') + ' ' + count(copy, 'السؤال:') + ' ' + count(copy, 'الجواب:'));
      add('copy', t + ' copy: no «[fatwafull» line and no button label', !copy.includes('[fatwafull') && !copy.includes(LABEL));
      // the block as the copy writes it (the same serializer, on the whole block lib/full-fatwa.js serves): the detailed
      // answer's copy holds it, and so does this one, once
      const blockCopy = api.serialize([{ type: 'text', content: c.whole }], { tashkeel, band: 'adult' });
      add('copy', t + ' copy: the block is the detailed answer\'s copy of it, letter for letter', dcopy.includes(blockCopy) && count(copy, blockCopy) === 1, blockCopy.length + ' ' + count(copy, blockCopy));
      add('copy', t + ' copy: no excerpt closed by «…» left', !copy.includes(c.excerptRaw));
      // in Arabic the brief and the detailed answers are laid out alike, so the whole copy is the detailed one; another
      // language's layout is lib/lang/answer.js's, which places the brief and the detailed blocks differently
      if (!c.translated) add('copy', t + ' copy: the whole copy is the detailed answer\'s copy', copy === dcopy, asc(copy.slice(0, 40)) + ' | ' + copy.length + ' vs ' + dcopy.length);
    }
    const snip = api.favSnippet(c.brief);
    add('copy', c.tag + ' the favourites line (same serializer): no «[fatwafull», no label', !snip.includes('[fatwafull') && !snip.includes(LABEL));
    // the voice: MessageListenButton hands message.content to speakReply, which speaks formatForTTS of it
    const voice = api.tts(c.brief);
    const voiceRef = api.tts(c.briefNoTag);
    add('voice', c.tag + ' voice: no run of 40 base64 characters of the tag', !b64Leak(voice, c.b64));
    add('voice', c.tag + ' voice: no button label', !voice.includes(LABEL));
    add('voice', c.tag + ' voice: no longer than the excerpt and what is around it', voice.length <= voiceRef.length, voice.length + ' vs ' + voiceRef.length);
    add('voice', c.tag + ' voice: the excerpt is spoken (its question)', norm(voice).includes(norm(c.questionHead)));
    // the stream preview: the live one (ezikStreamPreviewSegments, drawn), its text sibling, and the answer at every stage
    const stages = [];
    for (let k = 1; k <= 8; k++) stages.push(c.brief.slice(0, Math.round(c.brief.length * k / 8)));
    stages.push(c.brief.slice(0, c.brief.indexOf('<fatwafull') + 30), c.brief.slice(0, c.brief.indexOf('</fatwafull>') + 12));
    let pvBad = 0, pvTxtBad = 0, pvDetail = '';
    for (const st of stages) {
      const drawn = textOf(drawSegs(api, api.previewSegs(st, 30)));
      if (drawn.includes(LABEL) || b64Leak(drawn, c.b64)) { pvBad += 1; pvDetail = 'at ' + st.length; }
      const ptxt = api.preview(st);
      if (ptxt.includes(LABEL) || b64Leak(ptxt, c.b64)) pvTxtBad += 1;
    }
    add('preview', c.tag + ' stream preview (drawn, ' + stages.length + ' stages): no base64, no button label', pvBad === 0, pvBad + ' ' + pvDetail);
    add('previewText', c.tag + ' stream preview text (formatForStreamPreview): no base64, no button label', pvTxtBad === 0, String(pvTxtBad));
    const pvFull = textOf(drawSegs(api, api.previewSegs(c.brief, 30)));
    add('preview', c.tag + ' stream preview: the excerpt is drawn', norm(pvFull).includes(norm(c.questionHead)));
    // the parents' log
    const log = api.log(c.brief);
    add('log', c.tag + ' log: no base64, no button label', !b64Leak(log, c.b64) && !log.includes(LABEL), asc(log.slice(-60)));
    add('log', c.tag + ' log: the excerpt is there', norm(log).includes(norm(c.questionHead)));
    // the folded view (a restored reply opens folded): the press draws one block in the excerpt's place
    const fv = api.fold(segs, api.FOLD_MIN, api.FOLD_HEAD);
    add('fold', c.tag + ' fold: the long reply folds', !!fv);
    if (fv) {
      const d = pressSegs(api, fv);
      const preText = textOf(d.before), postText = textOf(d.after);
      add('fold', c.tag + ' fold: before the press, the button and the excerpt whole', d.pressed && count(preText, 'نص الفتوى') === 1 && norm(preText).includes(norm(c.excerpt)), asc(norm(preText).slice(0, 50)));
      add('fold', c.tag + ' fold: after the press, one block («نص الفتوى», «السؤال:», «الجواب:» once, no button)', !/<button[^>]*>النص الكامل/.test(d.after)
        && count(postText, 'نص الفتوى') === 1 && count(postText, 'السؤال:') === 1 && count(postText, 'الجواب:') === 1,
        count(postText, 'نص الفتوى') + ' ' + count(postText, 'السؤال:') + ' ' + count(postText, 'الجواب:'));
      add('fold', c.tag + ' fold: after the press, the fatwa whole, no excerpt left above it', norm(postText).includes(norm(c.answer)) && !norm(postText).includes(norm(c.excerpt)));
    }
  }
  return out;
}

// book's open="1" (POSTSHIP item 6), cut="1" and its matn, through the same surfaces
function bookChecks(api, tagText, b64) {
  const msg = 'قال أهل العلم في المسألة ما يلي.\n' + tagText + '\n\nوالله أعلم.';
  const segs = api.parse(msg, 30).segments;
  const leaks = (s) => /open|cut=|="1"|\b1\b/.test(String(s).replace(/[^\x20-\x7e]/g, ' ')) || b64Leak(s, b64);
  const rows = [];
  const add = (name, s) => rows.push({ surface: 'book', name: 'book open="1": ' + name + ' carries no attribute of the card', cond: !leaks(s), detail: asc(String(s).slice(0, 80)) });
  add('copy', api.serialize(segs, { tashkeel: true, band: 'adult' }));
  add('voice', api.tts(msg));
  add('log', api.log(msg));
  add('stream preview text', api.preview(msg));
  add('stream preview drawn (prose only)', textOf(drawSegs(api, api.previewSegs(msg, 30).filter((x) => x && x.type === 'text'))));
  add('favourites line', api.favSnippet(msg));
  rows.push({ surface: 'book', name: 'book open="1": the card is parsed with its passage and its mark', cond: segs.some((x) => x && x.type === 'book' && x.open === true && x.text.length > 0), detail: '' });
  return rows;
}

// what each surface carries for an answer with NO <fatwafull> tag, as one digest (pinned from 456eed10's app.js)
function untaggedDigest(api, msgs) {
  const h = crypto.createHash('sha256');
  for (const m of msgs) {
    const segs = api.parse(m, 30).segments;
    const fv = api.fold(segs, api.FOLD_MIN, api.FOLD_HEAD);
    const parts = [
      api.serialize(segs, { tashkeel: true, band: 'adult' }), api.serialize(segs, { tashkeel: false, band: 'young' }),
      api.tts(m), api.log(m), api.preview(m), JSON.stringify(api.previewSegs(m, 30)), JSON.stringify(fv), api.favSnippet(m),
      drawSegs(api, segs), fv ? drawSegs(api, fv) : '',
    ];
    for (const p of parts) h.update(String(p) + '\u0000');
  }
  return h.digest('hex');
}
const UNTAGGED_SHA256 = 'e3bc085683d153a4d02dd9094d24dcb7f7fe48ba29877c0bb424875a329cd34c';   // cut on 456eed10's app.js (POSTSHIP19_APP), 13 answers

// one mutant per surface: the fix taken out of the shipped build
const MUTANTS = [
  { surface: 'copy', anchor: 'const serializeReply=', from: "const copyBrief=sg&&sg.type==='text'?ezikFatwaBriefAt(segments,i):null;", to: 'const copyBrief=null;' },
  { surface: 'copy', anchor: 'const serializeReply=', from: "if(sg&&sg.type==='fatwafull'&&ezikFatwaBriefAt(segments,i-1))return;", to: '' },
  { surface: 'voice', anchor: 'const formatForTTS=', from: "t=t.replace(/<fatwafull[^>]*>[\\s\\S]*?<\\/fatwafull>/g,' ');", to: '' },
  { surface: 'log', anchor: 'const formatForLog=', from: "t=t.replace(/<fatwafull(?:\"[^\"]*\"|'[^']*'|[^>\"'])*>[\\s\\S]*?<\\/fatwafull>/g,' ');", to: '' },
  { surface: 'previewText', anchor: 'const formatForStreamPreview=', from: "t=t.replace(/<fatwafull[^>]*>[\\s\\S]*?<\\/fatwafull>/g,' ');", to: '' },
  { surface: 'preview', anchor: 'function ezikStreamPreviewSegments(', from: ".map(sg=>sg&&sg.type==='fatwafull'?{type:'fatwafull',text:'',label:''}:sg)", to: '' },
  { surface: 'fold', anchor: 'function ezikFoldSegments(', from: 'const foldBrief=ezikFatwaBriefAt(list,i);', to: 'const foldBrief=null;' },
];
function mutate(src, m) {
  const a = src.indexOf(m.anchor);
  const at = a < 0 ? -1 : src.indexOf(m.from, a);
  if (at < 0 || at - a > 20000) return null;
  return src.slice(0, at) + m.to + src.slice(at + m.from.length);
}

(async () => {
  let failures = 0, checks = 0;
  const ok = (name, cond, detail) => { checks += 1; if (cond) { console.log('  PASS  ' + name); return; } failures += 1; console.log('  FAIL  ' + name + (detail ? '\n        ' + asc(detail) : '')); };
  const FF = await esm('lib/full-fatwa.js');
  const A = await esm('lib/lang/answer.js');
  const BW = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
  const MUFTI = (/export const BW2_DIRECT_MUFTI = '([^']*)';/.exec(BW) || [])[1] || '';
  const FIX = require('./fixtures-postship-2-fatwas.json');
  const build = (r) => FF.buildFatwaRecord({ id: r.id, question: r.question, answer: r.answer, title: r.title, url: r.url, publisher: 'ابن باز', sourceKind: 'corpus', contentMode: 'written_fatwa' });
  // as lib/before-writing-v2.js emits it: the block, the mufti line, the source card, then the writer's prose -- long enough
  // that the reply folds (a restored reply opens folded)
  const PROSE = 'والخلاصة أن المسألة كما في الفتوى أعلاه، وأن العمل بما دلت عليه الأدلة هو الأحوط للمسلم في دينه. '
    + 'وعلى السائل أن يسأل أهل العلم في بلده إن أشكل عليه شيء من ذلك، فإن العلماء ورثة الأنبياء. '
    + 'ونسأل الله أن يوفقنا جميعا للعلم النافع والعمل الصالح، وأن يرزقنا الفقه في الدين. '
    + 'ومن ترك شيئا لله عوضه الله خيرا منه، والله أعلم وصلى الله على نبينا محمد وعلى آله وصحبه وسلم.';
  const answerOf = (block, r) => block + '\n\n' + MUFTI + 'ابن باز\n' + '<source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/1">' + r.title + '</source>\n\n' + PROSE + '\n\n' + PROSE;
  // the fake translator answers every string with a plain Latin line as long as the string, so the translated reply folds too
  const echo = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); return { ok: true, text: JSON.stringify(arr.map((s, k) => ('Translated text number ' + (k + 1) + ' ' + 'and so on '.repeat(Math.ceil(String(s).length / 10))).trim() + '.')) }; };

  const cases = [];
  const untagged = [];
  const addCase = (tag, brief, detailed, rec, translated) => {
    const m = /<fatwafull matn="([^"]+)">/.exec(brief);
    const printed = FF.printedFatwaPair(rec);
    const exStart = brief.indexOf('## ');
    const excerptRaw = brief.slice(exStart, brief.indexOf('…', exStart) + 1);
    const excerpt = excerptRaw.replace(/^## /, '');
    cases.push({
      tag, brief, detailed, translated: !!translated, whole: FF.serverOwnedBlock(rec, [], {}), excerptRaw,
      b64: m ? m[1] : '', answer: printed.answer, excerpt,
      briefNoTag: brief.replace(/<fatwafull[^>]*>[\s\S]*?<\/fatwafull>/, ''),
      questionHead: printed.question.slice(0, 40),
    });
    untagged.push(detailed);
  };
  for (const r of FIX.rows) {
    const rec = build(r);
    const whole = FF.serverOwnedBlock(rec, [], {});
    if (whole.length <= FF.BRIEF_FATWA_MAX) { untagged.push(answerOf(whole, r)); continue; }
    addCase(asc(r.id) + ' (' + whole.length + ')', answerOf(FF.serverOwnedBlock(rec, [], { brief: true }), r), answerOf(whole, r), rec);
  }
  {
    const r = FIX.rows.find((x) => x.id === 'alathary:53');
    const rec = build(r);
    for (const lang of ['en', 'fa', 'ur']) {
      const brief = (await A.translateAnswer(answerOf(FF.serverOwnedBlock(rec, [], { brief: true }), r), { lang, translate: echo, budgetMs: 20000 })).text;
      const detailed = (await A.translateAnswer(answerOf(FF.serverOwnedBlock(rec, [], {}), r), { lang, translate: echo, budgetMs: 20000 })).text;
      addCase(lang + ' alathary:53', brief, detailed, rec, true);
    }
  }
  // the untagged answers: the detailed ones above, the short fatwas, every other card, and the book with open="1"
  const BOOK_MATN = 'قال المصنف رحمه الله: ولا يجوز تقديم صيام ست شوال على صيام القضاء عند جماعة من أهل العلم، لأن';
  const BOOK_B64 = Buffer.from(BOOK_MATN, 'utf8').toString('base64');
  const BOOK_TAG = '<book author="ابن قدامة" ref="ج3 · ص120" book="FC-000123" vol="3" page="120" matn="' + BOOK_B64 + '" cut="1" open="1">المغني</book>';
  untagged.push(
    'قال أهل العلم في المسألة ما يلي.\n' + BOOK_TAG + '\n\nوالله أعلم.',
    'الحمد لله.\n<verse surah="الفاتحة" ayah="1"></verse>\n<hadith narrator="البخاري" ruling="صحيح">إنما الأعمال بالنيات</hadith>\n<steps title="الخطوات">\n- أولا\n- ثانيا\n</steps>\n<source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/2">عنوان</source>\n<suggestions>\n- سؤال\n</suggestions>',
    '## عنوان\n\n' + PROSE + '\n\n' + PROSE + '\n\n' + PROSE + '\n\n<board>x = 1</board>\n<dhikr id="27"></dhikr>\n<document title="مستند">متن</document>',
    'نص قصير بلا وسم، فيه «…» في آخره …');

  console.log('-- 0. the shipped client' + (process.env.POSTSHIP19_APP ? ' (POSTSHIP19_APP=' + asc(APP) + ')' : ''));
  const SRC = fs.readFileSync(APP, 'utf8');
  const api = boot(SRC);
  ok('app.js runs, and every surface is reached', ['parse', 'render', 'serialize', 'tts', 'log', 'preview', 'previewSegs', 'fold', 'favSnippet'].every((k) => typeof api[k] === 'function'));
  ok('the fixture gives four long Arabic records and three other-language answers', cases.length === 7, String(cases.length));
  ok('each tagged answer carries one <fatwafull> right after the excerpt\'s «…»', cases.every((c) => count(c.brief, '<fatwafull') === 1 && /…\s*<fatwafull matn="/.test(c.brief)));

  const results = surfaceChecks(api, cases).concat(bookChecks(api, BOOK_TAG, BOOK_B64));
  let surface = '';
  for (const r of results) { if (r.surface !== surface) { surface = r.surface; console.log('-- ' + surface); } ok(r.name, r.cond, r.detail); }

  console.log('-- an answer with no tag: every surface the same as on 456eed10');
  const dig = untaggedDigest(api, untagged);
  console.log('        untagged digest ' + dig + ' over ' + untagged.length + ' answers');
  ok('copy, share, voice, log, previews, fold and drawing of ' + untagged.length + ' untagged answers are byte-identical to 456eed10', dig === UNTAGGED_SHA256, dig);

  console.log('-- mutants: each surface\'s fix taken out of the shipped build');
  for (const m of MUTANTS) {
    const msrc = mutate(SRC, m);
    if (!msrc) { ok('mutant ' + m.surface + ': its site is in the build (' + asc(m.from.slice(0, 50)) + ')', false); continue; }
    const mapi = boot(msrc);
    const mres = surfaceChecks(mapi, cases).filter((r) => r.surface === m.surface);
    const red = mres.filter((r) => !r.cond).length;
    ok('mutant ' + m.surface + ' (' + asc(m.from.slice(0, 44)) + '...): red, ' + red + ' of ' + mres.length + ' of its checks fail', red > 0 && mres.length > 0);
  }

  console.log('-- the wiring');
  const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  ok('share and every export hand over the same buildCopyText the copy button does', /<ShareReplyButton getText=\{buildCopyText\} \/>/.test(app) && /<CopyReplyButton text=\{String\(message\.content \|\| ''\)\.trim\(\)\} getText=\{buildCopyText\} \/>/.test(app)
    && app.includes('const buildCopyText = () => serializeReply(segments, { tashkeel, band: deriveCaps(age).band });'));
  ok('the listen button speaks formatForTTS of the reply (fetchSpeechAudio)', app.includes('const ttsText = formatForTTS(rawText);'));
  ok('the server still sends the excerpt, then the tag with the whole block (unchanged)', fs.readFileSync(path.join(REPO, 'lib/full-fatwa.js'), 'utf8').includes("return briefExcerpt(whole, BRIEF_FATWA_MAX) + '…\\n' + '<fatwafull matn=\"'"));

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
