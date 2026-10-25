// guards/brain-postship-14-guard.cjs -- POSTSHIP FIX2 ITEM 2 -- 2026-10-25 (completes POSTSHIP item 6)
//
// ONE «…» UNDER A CUT PASSAGE. Measured on the preview: the «فتاوى إسلامية» card in the answer to «ما فضل صيام ست من
// شوال؟» showed «… … بقيّةُ النصِّ لم تصلْ» under its passage. Read in the code: BookCard draws item 6's «…» for a
// passage that ends open, then the cut note, whose own text (BOOK_MATN_CUT_NOTE) begins with «…».
// The order (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-FIX2-DIRECTIVE-2026-10-25.md, item 2): when
// the cut note shows, no separate «…» -- the note carries it. Acceptance, on the card:
//   cut and open together -> one «…», before «بقيّةُ النصِّ لم تصلْ»;  open alone -> one «…»;  ending on a stop -> none.
// The card is the SHIPPED one: BookCard's source is cut out of app.js (the build of app.jsx the page loads), run with
// the repository's React, opened (its toggle state stubbed to open), and rendered to markup with react-dom/server.
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '.');
const ELL = '…';
const NOTE_WORDS = 'بقيّةُ النصِّ لم تصلْ';

const React = require(path.join(REPO, 'node_modules', 'react'));
const { renderToStaticMarkup } = require(path.join(REPO, 'node_modules', 'react-dom', 'server'));
const appJs = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
const appJsx = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
const at = appJs.indexOf('function BookCard(');
const end = appJs.indexOf('function FatwaFullText(', at);
const src = at >= 0 && end > at ? appJs.slice(at, end) : '';
const note = (/const BOOK_MATN_CUT_NOTE = '([^']*)';/.exec(appJsx) || [])[1] || '';

function card(props) {
  const ctx = {
    React, useState: () => [true, () => {}], s: new Proxy({}, { get: () => ({}) }),
    BOOK_MATN_LABEL: 'LABEL', BOOK_MATN_CUT_NOTE: note, ezikLibraryHref: () => null, BookLibraryLink: () => null,
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.__c = BookCard;', ctx);
  const html = renderToStaticMarkup(React.createElement(ctx.__c, { title: 'فتاوى إسلامية', where: 'ج2 ص166', ...props }));
  return html.replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/g, ' ');
}
// what the card shows after the passage itself
const after = (shown, matn) => { const i = shown.indexOf(matn); return i < 0 ? null : shown.slice(i + matn.length); };
const count = (s, x) => s.split(x).length - 1;

console.log('-- 0. the source');
ok('BookCard found in the shipped app.js', !!src);
ok('the cut note is the one the card draws, and it begins with «…» (it carries the mark)', note.startsWith(ELL) && note.includes(NOTE_WORDS), asc(note));

// the witness: the preview's «فتاوى إسلامية» passage, its last words as measured (a cut that fell mid-word)
const WITNESS = 'لا يجوز تقديم صيام ست شوال على صيام ا';
console.log('-- 1. cut and open together: one «…», before «' + 'the rest did not arrive' + '»');
{
  const t = after(card({ text: WITNESS, cut: true, open: true }), WITNESS);
  ok('the passage is shown letter for letter', t !== null);
  ok('exactly one «…» after the passage', t !== null && count(t, ELL) === 1, t === null ? 'no passage' : asc(t.trim()));
  ok('... and it stands right before the note\'s words', t !== null && /^\s*…\s*بقيّةُ النصِّ لم تصلْ\s*$/u.test(t), t === null ? '' : asc(t.trim()));
}
console.log('-- 2. open alone: one «…»');
{
  const m = 'قال الشيخ: من صام رمضان ثم أتبعه ستا من شوال كان كصيام';
  const t = after(card({ text: m, cut: false, open: true }), m);
  ok('exactly one «…», and no note', t !== null && count(t, ELL) === 1 && !t.includes(NOTE_WORDS), t === null ? '' : asc(t.trim()));
}
console.log('-- 3. ending on a stop mark: nothing');
{
  const m = 'قال الشيخ: من صام رمضان ثم أتبعه ستا من شوال كان كصيام الدهر.';
  const t = after(card({ text: m, cut: false, open: false }), m);
  ok('no «…» and no note', t !== null && count(t, ELL) === 0 && !t.includes(NOTE_WORDS), t === null ? '' : asc(t.trim()));
}
console.log('-- 4. cut on a stop mark: the note alone, its one «…»');
{
  const m = 'قال الشيخ: هذا جائز.';
  const t = after(card({ text: m, cut: true, open: false }), m);
  ok('one «…», the note\'s', t !== null && count(t, ELL) === 1 && t.includes(NOTE_WORDS), t === null ? '' : asc(t.trim()));
}
console.log('-- 5. the source of the build');
ok('app.jsx draws the separate «…» only when no cut note follows',
  appJsx.includes('{open && !cut ? <div style={{ opacity: 0.7, marginTop: -2 }}>…</div> : null}') && appJsx.includes('{cut ? <div style={s.bookMatnCut}>{BOOK_MATN_CUT_NOTE}</div> : null}'));

console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
