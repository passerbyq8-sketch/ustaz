// guards/brain-postship-6-guard.cjs -- POSTSHIP ITEM 6 -- 2026-10-24 (row 5)
//
// «…» AFTER A PASSAGE THAT STOPS MID-SENTENCE. Measured (sessions/side-brain-postship-2026-10-24/
// EZIK-CC-POSTSHIP-MEASURE-REPORT-2026-10-24.md, row 5; measure/r5-cards.mjs): the book card of FC-004534:2152:001
// (مجموع فتاوى ورسائل العثيمين ج16 ص143, 739 characters, cut false) ends «… فإنها تعدل ثلث» with no «…»; 150 of 198
// pages and 129 of 200 atoms end with no stop mark and no «…». The passage is the book's own words and app.jsx
// refuses to append to it on purpose, so the mark is drawn AFTER the passage, apart from it.
//
// The order (item 6): a card whose text does not end on a stop mark shows «…» after the text, not inside it; the
// quoted text stays letter for letter; for a length cut and for a page that ends mid-sentence alike.
// Fixture: guards/fixtures-postship-6-cards.json -- the witness atom's text and twenty sample texts copied from
// measure/out-r5w.json and measure/r5-samples.json (the measurement's own reads of the library, read-only).
'use strict';
const path = require('path');
const fs = require('fs');

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
// measure/r5-cards.mjs:15-16, copied: what counts as an ending
const STOP = /[.؟?!…:؛۔]$/u;
const trailing = /[\s»"”’'\)\]\}﴾﴿]+$/u;
const closed = (t) => STOP.test(String(t).replace(trailing, '')) || /(?:…|\.\.\.)\s*$/u.test(String(t));

(async () => {
  const ASK = await esm('api/ask.js');
  const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-postship-6-cards.json'), 'utf8'));
  const tagOf = (text, extra = {}) => ASK.buildBookTag({ bookTitle: 'كتاب', author: 'مؤلف', locator: 'ج1 · ص1', text, ...extra }).tag;
  const attrs = (tag) => {
    const m = /matn="([^"]+)"/.exec(tag);
    return { matn: m ? Buffer.from(m[1], 'base64').toString('utf8') : '', open: /\sopen="1"/.test(tag), cut: /\scut="1"/.test(tag) };
  };
  // what the reader is shown: the passage as carried, then the mark the card draws after it
  const shown = (a) => a.matn + (a.open ? '…' : '');

  console.log('-- 1. the witness');
  const W = FIX.witness;
  const wa = attrs(tagOf(W.text));
  ok('the witness passage is carried letter for letter', wa.matn === W.text.slice(0, wa.matn.length) && wa.matn.length === Math.min(W.text.length, 1200));
  ok('the witness ends mid-sentence, so the card says so (open)', wa.open === true);
  ok('the witness is shown with «…» after it', shown(wa).endsWith('ثلث…'), shown(wa).slice(-20).replace(/[^\x20-\x7e]/g, '.'));
  ok('the «…» is not inside the carried text', !wa.matn.endsWith('…'));

  console.log('-- 2. the samples (pages and atoms, as measured)');
  let pagesOpen = 0; let atomsOpen = 0; let altered = 0;
  for (const s of FIX.pages) { const a = attrs(tagOf(s.text)); if (a.matn && !closed(shown(a))) pagesOpen++; if (a.matn !== s.text.slice(0, a.matn.length)) altered++; }
  for (const s of FIX.atoms) { const a = attrs(tagOf(s.text)); if (a.matn && !closed(shown(a))) atomsOpen++; if (a.matn !== s.text.slice(0, a.matn.length)) altered++; }
  ok('pages shown with no ending: 0 (of ' + FIX.pages.length + ')', pagesOpen === 0, String(pagesOpen));
  ok('atoms shown with no ending: 0 (of ' + FIX.atoms.length + ')', atomsOpen === 0, String(atomsOpen));
  ok('no carried passage changed by a character', altered === 0, String(altered));

  console.log('-- 3. controls');
  const fullStop = attrs(tagOf('قال الشيخ: هذا جائز.'));
  ok('a passage ending on a stop mark is not marked', fullStop.open === false && shown(fullStop) === 'قال الشيخ: هذا جائز.');
  const quoted = attrs(tagOf('قال: «هذا جائز.»'));
  ok('a stop mark inside a closing quote counts as the end', quoted.open === false);
  const long = 'كلمة '.repeat(400) + 'نهاية.';
  const la = attrs(tagOf(long));
  ok('a length cut that falls mid-sentence is marked too', la.cut === true && la.open === true);

  console.log('-- 4. the client draws it after the text, apart from it');
  const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  ok('app.jsx reads the open attribute of a book tag', app.includes('const openMatch = attrsStr.replace(') && app.includes('open: !!openMatch,'));
  ok('app.jsx draws the mark in its own element after the passage', app.includes('<div style={s.bookMatnText}>{matn}</div>') && app.includes('{open ? <div style={{ opacity: 0.7, marginTop: -2 }}>…</div> : null}'));

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
