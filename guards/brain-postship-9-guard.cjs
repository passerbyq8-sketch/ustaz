// guards/brain-postship-9-guard.cjs -- POSTSHIP ITEM 9 -- 2026-10-24
//
// THE BRIEF ANSWER SHOWS THE FATWA AS AN EXCERPT, AND THE FULL TEXT ON A BUTTON. Measured (sessions/side-brain-postship-2026-10-24/
// EZIK-EXT-ANSWER-LOG-WEEK-2026-10-24.txt, CHARS normal line 25): 189 of 1299 brief answers over 6000 characters, p90 6835, the
// longest 16958, six of the ten longest on the sources path -- the stored fatwa's text is served whole (T1, «١٤١»). The order
// (item 9): in the brief answer only, the server-owned fatwa block is an excerpt to a sentence's end within 600 characters,
// closed by «…» as in item 6, with a button «النص الكامل» that shows the full text in place; the detailed and student depths
// letter for letter as they are. No model: the block function itself, on real fatwa records -- the six stored rows of
// guards/fixtures-postship-2-fatwas.json (copied from the stores by item 2).
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
  const api = vm.runInContext('({ parse: parseRichMessage, render: ezikRenderSegments, serialize: serializeReply, makeFav: ezikMakeFav, favorite: FavoriteReplyBody, tts: formatForTTS,'
    + ' log: formatForLog, preview: formatForStreamPreview, previewSegs: ezikStreamPreviewSegments, fold: ezikFoldSegments,'
    + ' favSnippet: ezikFavSnippet, FOLD_MIN: EZIK_FOLD_MIN_CHARS, FOLD_HEAD: EZIK_FOLD_HEAD_CHARS })', ctx);
  api.window = window;
  return api;
}

// what the reader reads: the markup's text, block elements on their own lines
const textOf = (html) => html.replace(/<(?:div|p|h[1-6]|li|br)\b[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const drawSegs = (api, segs) => renderToStaticMarkup(React.createElement('div', null, api.render(segs, { tashkeel: true, age: 30 })));
function pressSegs(api, segs, favorite = false) {
  global.window = api.window; global.document = api.window.document;
  const host = api.window.document.getElementById('t');
  const root = ReactDOMClient.createRoot(host);
  flushSync(() => root.render((favorite ? React.createElement(api.favorite, { segments: segs, tashkeel: true, age: 30 }) : React.createElement('div', null, api.render(segs, { tashkeel: true, age: 30 })))));
  const before = host.innerHTML;
  const btn = Array.prototype.find.call(host.querySelectorAll('button'), (b) => b.textContent === 'النص الكامل');
  if (btn) flushSync(() => btn.dispatchEvent(new api.window.Event('click', { bubbles: true })));
  const after = host.innerHTML;
  root.unmount();
  return { before, after, pressed: !!btn };
}


// ORDER 15: position pairing, using the request's decoded strings exactly.
const PAIR_WORDS = JSON.parse("{\"heading\":\"## \\u0646\\u0635 \\u0627\\u0644\\u0641\\u062a\\u0648\\u0649\",\"answer_label\":\"\\u0627\\u0644\\u062c\\u0648\\u0627\\u0628 (\\u0645\\u062e\\u062a\\u0635\\u0631\\u064b\\u0627):\",\"ellipsis\":\"\\u2026\",\"full_text_button\":\"\\u0627\\u0644\\u0646\\u0635 \\u0627\\u0644\\u0643\\u0627\\u0645\\u0644\",\"tag\":\"fatwafull\",\"brain_branch\":\"side/brain35-20261106\",\"brain_head_reported\":\"4c3e49d6\"}");
function pairingChecks(src) {
  const api = boot(src), rows = [];
  const add = (name, cond) => rows.push({ name, cond: !!cond });
  const w = PAIR_WORDS;
  const question = 'Question: Where does the full text stand?';
  const answer = 'Answer: The full answer replaces the brief at its original position.';
  const full = w.heading + '\n\n' + question + '\n\n' + answer;
  const tag = '<' + w.tag + ' matn="' + Buffer.from(full).toString('base64') + '">' + w.full_text_button + '</' + w.tag + '>';
  const shapes = { prefix: full.slice(0, full.indexOf('original')) + w.ellipsis,
    answerFirst: w.heading + '\n\n' + w.answer_label + '\n' + answer.slice(0, 32) + w.ellipsis };
  for (const [shape, excerpt] of Object.entries(shapes)) {
    const brief = excerpt + '\n' + tag;
    const segs = api.parse(brief, 30).segments;
    const decoded = segs.find(s => s.type === 'fatwafull').text;
    add(shape + ': decoded payload equals full bytes', decoded === full);
    const saved = JSON.parse(JSON.stringify(api.makeFav(brief, 'fixture', 'fixture-chat', 0)));
    const favSegs = api.parse(saved.text, 30).segments;
    for (const [surface, ss, favorite] of [['chat', segs, false], ['favorite', favSegs, true]]) {
      const drawn = pressSegs(api, ss, favorite), text = textOf(drawn.after);
      add(shape + ' ' + surface + ': button pressed', drawn.pressed);
      add(shape + ' ' + surface + ': one heading, question and answer',
        text.split(w.heading.slice(3)).length === 2 && text.split(question).length === 2 && text.split(answer).length === 2);
      add(shape + ' ' + surface + ': no excerpt ellipsis', !text.includes(w.ellipsis));
      add(shape + ' ' + surface + ': sheet equals detailed drawing', text === textOf(drawSegs(api, api.parse(full, 30).segments)));
    }
    for (const [surface, ss] of [['copy', segs], ['share', segs], ['favorite copy', favSegs]]) {
      add(shape + ' ' + surface + ': decoded full text byte for byte', api.serialize(ss, { tashkeel: true, band: 'adult' }) === decoded);
    }
    const intro = 'Surrounding prose.\n\n';
    add(shape + ': preceding prose preserved', api.serialize(api.parse(intro + brief, 30).segments, { tashkeel: true, band: 'adult' }) === intro + full);
  }
  return rows;
}

(async () => {
  const FF = await esm('lib/full-fatwa.js');
  const FIX = require('./fixtures-postship-2-fatwas.json');
  const build = (r) => FF.buildFatwaRecord({ id: r.id, question: r.question, answer: r.answer, title: r.title, url: r.url, sourceKind: 'corpus', contentMode: 'written_fatwa' });
  const TAG_RE = /\n?<fatwafull matn="([^"]+)">النص الكامل<\/fatwafull>$/u;
  let long = 0;
  for (const r of FIX.rows) {
    const rec = build(r);
    const today = FF.serverOwnedBlock(rec, [], {});
    const brief = FF.serverOwnedBlock(rec, [], { brief: true });
    const tag = (r.id + ' (' + today.length + ' chars)').replace(/[^\x20-\x7e]/g, '.');
    if (today.length <= 600) {
      // re-cut 2026-11-07 (brain35-2 F8; owner decision R8, DIAG2): ONE brief shape whatever the length -- the heading, «الجواب (مختصرًا):»,
      // the whole answer (it fits the budget, so no «…»), and the button carrying the whole block as served today.
      const m0 = TAG_RE.exec(brief);
      const shown0 = m0 ? brief.slice(0, m0.index) : brief;
      const printed0 = FF.printedFatwaPair(rec);
      // re-cut 2026-11-08 (brain35-5c W1; the owner's delegation of 2026-11-08 16:22, Claude's ruling): the owner's decision of 14:06 (the
      // brief excerpt is the answer's BODY -- the opening formulas skipped, stopped before a speaker turn; lib/full-fatwa.js briefAnswerBody)
      // has no exception for short blocks, and the spirit of R8 is kept: the whole BODY is shown, no …. A body under MIN_ANSWER_WORDS
      // falls back to the whole answer, as serverOwnedBlock does (binothaimeen:6971: body = answer; aladawy:293: the hamdala is skipped).
      const trimmed0 = FF.briefAnswerBody(printed0.answer);
      const body0 = trimmed0.split(/\s+/u).filter(Boolean).length >= FF.MIN_ANSWER_WORDS ? trimmed0 : printed0.answer;
      ok(tag + ': a block of 600 or fewer is the answer-first shape too: the whole body of the answer, no «…», the whole block in the button (re-cut 2026-11-07, owner decision R8; re-cut 2026-11-08, brain35-5c W1, owner\'s delegation)',
        shown0 === '## ' + FF.HEADING_TEXT + '\n\n' + FF.BRIEF_ANSWER_HEAD + '\n' + body0 && !!m0 && Buffer.from(m0[1], 'base64').toString('utf8') === today,
        shown0.slice(0, 60).replace(/[^\x20-\x7e]/g, '.'));
      ok(tag + ': ...and the detailed depth is still the whole block', FF.serverOwnedBlock(rec, [], { band: 'adult' }) === today);
      continue;
    }
    long += 1;
    const m = TAG_RE.exec(brief);
    const visible = m ? brief.slice(0, m.index) : brief;
    ok(tag + ': the brief block shows 600 characters at most', visible.length <= 600, String(visible.length));
    ok(tag + ': ...ending at a sentence\'s end, closed by «…»', /[.؟!؛]…$|\n…$|…$/u.test(visible) && visible.endsWith('…'), visible.slice(-30).replace(/[^\x20-\x7e]/g, '.'));
    // ITEM B-1 (brain35, 2026-11-06) BY THE OWNER'S DECISION (DIAG B-1: the brief block must give the ANSWER): the brief
    // block is no longer the first 600 characters of the served sheet, because those characters were the QUESTION -- it is
    // the sheet's own heading, then «الجواب (مختصرًا):», then an excerpt of the ANSWER. So «an excerpt of the block as
    // served» is now read in two halves, and both are still letter for letter: the heading is the served block's own
    // opening, and the shown answer text appears verbatim inside the served block.
    ok(tag + ': ...the heading is the served block\'s own, and the shown answer is verbatim inside it',
      (() => {
        const parts = visible.split(FF.BRIEF_ANSWER_HEAD);
        if (parts.length !== 2) return false;
        const body = parts[1].replace(/^\s+/u, '').replace(/…\s*$/u, '');
        return today.startsWith(parts[0]) && body.length > 40 && today.includes(body);
      })(), visible.slice(0, 40).replace(/[^\x20-\x7e]/g, '.'));
    ok(tag + ': the button carries the full text, identical to what is served today', !!m && Buffer.from(m[1], 'base64').toString('utf8') === today);
    ok(tag + ': the detailed and student depths are as they are (no brief option)', FF.serverOwnedBlock(rec, [], { band: 'adult' }) === today);
  }
  ok('the fixture holds long fatwas to test (at least two over 600)', long >= 2, String(long));
  ok('the young band still gets no block', FF.serverOwnedBlock(build(FIX.rows[0]), [], { band: 'young', brief: true }) === '');

  console.log('-- the wiring');
  const bw = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
  ok('before writing asks for the excerpt in the brief answer only', bw.includes("serverOwnedBlock(directRow.fatwaRecord, [], { band, brief: mode !== 'deep' && mode !== 'scholar' })"));
  const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  ok('the client knows the tag and decodes its text', /'fatwafull',/u.test(app) && /tagName === 'fatwafull'/u.test(app) && /type: 'fatwafull', text: ezikDecodeMatn\(fullMatch\[1\]\)/u.test(app));
  // the label is written by the server inside the tag (FATWA_FULL_LABEL), so the client carries no Arabic literal of its own
  // POSTSHIP FIX3 item 1 (2026-10-25): "in place" is now the excerpt's place -- the pressed button draws the prose with the whole
  // block where the excerpt stood (guards/brain-postship-16-guard.cjs renders it); it was a pre-wrap div of raw text under it.
  ok('the button reads «النص الكامل» (the tag\'s own content) and shows the full text in place', /function FatwaFullText\(\{ label, shown, full \}\)/u.test(app)
    && FF.FATWA_FULL_LABEL === 'النص الكامل' && /label: content/u.test(app) && /if \(open\) return full;/u.test(app)
    && /<FatwaFullText key=\{i\} label=\{brief\.label\} shown=\{prose\(seg\)\} full=\{prose\(\{ type: 'text', content: brief\.content \}\)\} \/>/u.test(app));
  const lang = fs.readFileSync(path.join(REPO, 'lib/lang/answer.js'), 'utf8');
  ok('the translation step carries the tag untranslated', /'book', 'fatwafull'\]/u.test(lang));


  const shipped = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
  for (const row of pairingChecks(shipped)) ok(row.name, row.cond);
  ok('copy and share use the shared serializer', app.includes('const buildCopyText = () => serializeReply(segments, { tashkeel, band: deriveCaps(age).band });') && app.includes('<ShareReplyButton getText={buildCopyText} />') && app.includes('getText={buildCopyText} />'));
  ok('favorites save the original reply and copy parsed segments', app.includes('ezikMakeFav(text, favPk, chatIdRef.current, idx)') && app.includes('const parsed = parseRichMessage(f.text, age);') && app.includes('getText={() => serializeReply(parsed.segments, { tashkeel, band: deriveCaps(age).band })}'));
  const start = shipped.indexOf('function ezikFatwaBriefAt('), end = shipped.indexOf('function ezikRenderSegments(', start);
  const body = shipped.slice(start, end);
  for (const [name, from, to] of [
    ['prefix matching restored', 'return{label:next.label', 'if(!next.text.startsWith(body.slice(at,-1)))return null;return{label:next.label'],
    ['excerpt left in place', 'body.slice(0,at)+next.text', 'body+next.text']
  ]) {
    ok(name + ': mutation anchor present', body.includes(from));
    if (!body.includes(from)) continue;
    const mutant = shipped.slice(0,start) + body.replace(from,to) + shipped.slice(end);
    const failed = pairingChecks(mutant).filter(r => !r.cond);
    ok(name + ': crafted regression proof fails', failed.length > 0, failed.map(r => r.name).join('; '));
    console.log('  MUTATION ' + name + ': ' + failed.length + ' failed assertions: ' + failed.map(r => r.name).join('; '));
  }

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
