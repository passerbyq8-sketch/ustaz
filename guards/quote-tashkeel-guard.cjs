// guards/quote-tashkeel-guard.cjs -- a quotation from a book reaches the reader WITH its harakat.
//
// THE DEFECT (quote order, 24 September 2026). The owner asked «بداية المجتهد» ج1 ص140 and
// «الحاوي للفتاوي» ج1 ص413 on the sources preview and read both passages letter for letter --
// without a single haraka. Counted at every station, for both requests:
//
//   station                                         Q1 (بداية المجتهد)   Q2 (الحاوي)
//   the library's atom, for ezik's own request             468                401
//   the reply lib/lib-quote.js composes                    468                401
//   the raw wire of the preview (vercel curl)              468                401
//   what the chat bubble draws, toggle at its default        0                  0
//
// The server was right to the byte. The client's tashkeel toggle -- off by default, the owner's
// call for the TUTOR'S prose -- stripped the BOOK'S text too, because a quotation reply carries no
// tag: it is one prose segment, and stripTashkeelOutsideQuran spares only a Qur'anic span.
//
// WHAT THIS PINS, BY EXECUTING THE SHIPPED app.js (not by matching its source):
//   S. the server: lib/lib-quote.js composes the owner's two requests and seven real atoms into a
//      card line and a blockquote that IS the atom's text (its paragraph, for a modern book).
//   C. the client, toggle at its default: parseRichMessage makes the reply one prose segment, and
//      what MessageBubble hands EzikMarkdown -- and what the copy button puts on the clipboard --
//      carries every blockquote line byte for byte, harakat included.
//   K. nothing else moved: the card line, the tutor's prose, a model's own blockquote, a reply
//      that only resembles a quotation -- all still lose their harakat; a Qur'anic span keeps them.
//   M. a mutant of the exemption is killed.
//
// Usage: node guards/quote-tashkeel-guard.cjs [path/to/app.js]   (default: the repo's app.js)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { parseHTML } = require('linkedom');

const REPO = path.join(__dirname, '..');
const APP = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO, 'app.js');
const OWNER = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-quote-tashkeel.json'), 'utf8'));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lib-quote.json'), 'utf8'));

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const HARAKAT = /[ً-ٰٟ]/g;
const marks = (s) => (String(s).match(HARAKAT) || []).length;
const quoteLines = (t) => String(t).split('\n').filter((l) => l.startsWith('>')).join('\n');

// ---- the shipped bundle, booted the way theme-coverage-guard boots the app block ------------
function bootApp(code) {
  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  window.self = window.self || window;
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 };
  const EP = window.Element && window.Element.prototype;
  if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
  if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
  try { global.navigator = window.navigator; } catch (e) {}
  global.window = window; global.document = window.document;
  const ctx = vm.createContext(window);
  for (const f of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext('ReactDOM.createRoot=function(){return{render:function(){},unmount:function(){}};};', ctx);
  vm.runInContext(code, ctx, { filename: 'app.js' });
  return (expr) => vm.runInContext(expr, ctx);
}

// The strip function alone, cut from a bundle's source (for the mutant: no second app boot).
function cutStrip(code) {
  const a = code.indexOf('const QURAN_SPAN_RE');
  const b = code.indexOf('const miniBtnStyle', a);
  if (a < 0 || b < 0) return null;
  return new Function(code.slice(a, b) + '\nreturn stripTashkeelOutsideQuran;')();
}

(async () => {
  console.log('\n=== quote-tashkeel -- the book\'s harakat reach the reader (LIB_QUOTE_V1) ===');
  console.log('  app.js under test: ' + path.relative(REPO, APP).replace(/\\/g, '/'));
  const Q = await import(pathToFileURL(path.join(REPO, 'lib/lib-quote.js')).href);
  const T = await import(pathToFileURL(path.join(REPO, 'lib/free-brain/tools.js')).href);

  // ---- S. the server's replies -------------------------------------------------------------
  console.log('\n-- S. the server composes the atom\'s own text');
  const cases = [];
  for (const o of OWNER.requests) {
    const hit = o.response.hits[0];
    const fetchImpl = async () => ({ ok: true, status: 200, url: 'https://lib.ezik.app/search', redirected: false,
      headers: { get: (k) => (/content-type/i.test(k) ? 'application/json' : null) },
      text: async () => JSON.stringify(o.response), json: async () => o.response });
    const res = await Q.answerQuoteRequest(Q.detectQuoteRequest(o.q),
      { runTool: T.runTool, createEvidenceTable: T.createEvidenceTable, libFlagValue: 'on', libToken: 'tk-tashkeel', fetchImpl });
    const reply = res && res.text || '';
    ok(`S1  ${o.key}: the owner's request is quoted (${hit.atom_id})`, res && res.outcome === 'quoted', res && res.outcome);
    ok(`S2  ${o.key}: its blockquote IS the atom, ${marks(hit.text)} harakat`,
      quoteLines(reply) === Q.blockquote(hit.text.replace(/\r\n?/g, '\n').trim()) && marks(hit.text) > 0);
    cases.push({ key: o.key, reply, want: quoteLines(reply) });
  }
  for (const [key, v] of Object.entries(FIX.atoms)) {
    const hit = v.response.hits[0];
    const owner = Q.catalogBook(hit.subject_id);
    const reply = Q.composeQuoteReply(hit, owner.cls, { catalogAuto: owner.auto, topic: v.q || '' });
    const body = Q.quotedText(hit, owner.cls, v.q || '');
    const bare = body.replace(/ …$/, '');
    ok(`S3  ${key} (${owner.cls}): the blockquote is the atom's own characters`,
      quoteLines(reply) === Q.blockquote(body) && hit.text.replace(/\r\n?/g, '\n').includes(bare));
    if (marks(body) > 0) cases.push({ key, reply, want: quoteLines(reply) });
  }

  // ---- C. the client, toggle at its default ------------------------------------------------
  console.log('\n-- C. the chat bubble, with the tashkeel toggle at its default (off)');
  const code = fs.readFileSync(APP, 'utf8');
  const run = bootApp(code);
  run('globalThis.__qt = { parse: parseRichMessage, strip: stripTashkeelOutsideQuran, copy: REPLY_SERIALIZERS.text };');
  const app = run('__qt');
  for (const c of cases) {
    const segs = app.parse(c.reply, 30).segments;
    const one = segs.length === 1 && segs[0].type === 'text';
    ok(`C1  ${c.key}: the reply is ONE prose segment`, one, JSON.stringify(segs.map((s) => s.type)));
    if (!one) continue;
    const drawn = app.strip(segs[0].content);                        // MessageBubble's prose site
    const copied = app.copy(segs[0], { tashkeel: false });            // the copy button
    ok(`C2  ${c.key}: the drawn quotation is the book's, byte for byte (${marks(c.want)} harakat)`,
      quoteLines(drawn) === c.want, `drawn carries ${marks(quoteLines(drawn))} of ${marks(c.want)}`);
    ok(`C3  ${c.key}: ...and so is the copied one`, quoteLines(copied) === c.want,
      `copied carries ${marks(quoteLines(copied))} of ${marks(c.want)}`);
  }

  // ---- K. nothing else moved ----------------------------------------------------------------
  console.log('\n-- K. everything that is not a server quotation keeps the toggle\'s rule');
  const DAMMA_CARD = '\u{1F4D6} «بِدايةُ المجتهد» · ابنُ رُشْد · ج1 · ص140';
  const QUOTE = '> إِنَّ الْأَلِفَ، وَاللَّامَ الَّتِي لِلْحَصْرِ';
  const PROSE = 'قالَ العلماءُ: القنوتُ في الصبحِ مسألةُ خلافٍ.';
  const QURAN = 'قال تعالى: ﴿إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ﴾ وهذا دليلٌ.';
  const drawn1 = app.strip(DAMMA_CARD + '\n\n' + QUOTE);
  ok('K1  the card line of a quotation is prose: its harakat go', marks(drawn1.split('\n')[0]) === 0 && marks(DAMMA_CARD) > 0);
  ok('K2  the tutor\'s prose loses its harakat', marks(app.strip(PROSE)) === 0);
  ok('K3  a model\'s own blockquote (no card line) loses its harakat', marks(app.strip(QUOTE)) === 0);
  ok('K4  a card line followed by PROSE, not a blockquote, loses them all', marks(app.strip(DAMMA_CARD + '\n\n' + PROSE)) === 0);
  ok('K5  a quotation with the tutor\'s words after it is not a server quotation: all go',
    marks(app.strip(DAMMA_CARD + '\n\n' + QUOTE + '\n\n' + PROSE)) === 0);
  ok('K6  a quotation that does not OPEN the segment is not one: all go',
    marks(app.strip(PROSE + '\n\n' + DAMMA_CARD + '\n\n' + QUOTE)) === 0);
  const q = app.strip(QURAN);
  ok('K7  a Qur\'anic span keeps its harakat, and the prose around it does not',
    q.includes('﴿إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ﴾') && marks(q.replace(/﴿[\s\S]*?﴾/g, '')) === 0);
  ok('K8  with the toggle ON the prose site passes everything through (unchanged)',
    app.copy({ type: 'text', content: PROSE }, { tashkeel: true }) === PROSE);

  // ---- M. the mutant ------------------------------------------------------------------------
  console.log('\n-- M. a mutant of the exemption is killed');
  const seat = code.indexOf('BOOK_QUOTE_REPLY_RE.test(src)');
  ok('M0  the exemption is ONE named test inside stripTashkeelOutsideQuran', seat !== -1
    && code.indexOf('BOOK_QUOTE_REPLY_RE.test(src)', seat + 1) === -1);
  if (seat !== -1) {
    const mutant = cutStrip(code.replace('BOOK_QUOTE_REPLY_RE.test(src)', 'false'));
    const killed = cases.some((c) => quoteLines(mutant(c.reply)) !== c.want);
    ok('M1  with the exemption disabled the owner\'s quotations lose their harakat again', killed);
  }

  console.log(`\n${checks - failures}/${checks} passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('  FAIL  guard crashed: ' + String(e && e.stack || e).replace(/[^\x20-\x7e\n]/g, '?')); process.exit(1); });
