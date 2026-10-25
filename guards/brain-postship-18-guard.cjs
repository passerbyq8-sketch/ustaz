// guards/brain-postship-18-guard.cjs -- POSTSHIP FIX3 ITEM 3 -- 2026-10-25 (takes back part of POSTSHIP FIX2 item 3)
//
// A PASSAGE THE SERVICE CUT KEEPS ITS LAST WORD, AND THE CARD'S OWN CEILING ENDS ON A WHOLE WORD. Measured (FIX2's report,
// sessions/side-brain-postship-2026-10-24/fix2/item3/r3-midword.mjs over 456 real library texts): the service cuts back
// to a space (measure/server-src/contract.mjs truncationEnd), so FIX2's rule -- drop the last word of a service-cut
// passage unless it ends on a stop mark -- dropped a whole word in 196 of 198 service-cut samples. And api/ask.js
// buildBookTag still cut `matn.slice(0, 1200)` wherever it fell, for a caller handing in a longer text.
// The order (EZIK-CC-POSTSHIP-FIX3-DIRECTIVE-2026-10-25.md, item 3):
//   (a) the last-word drop is taken out of bookPassage; our own cap keeps its rule (the last whole word);
//   (b) buildBookTag's slice takes the same whole-word rule.
// The texts: the 51 real library texts of guards/fixtures-postship-6-cards.json through the service's cut (retyped from
// contract.mjs, as guards/brain-postship-15-guard.cjs does) at the two caps a row is fetched with; the recorded wire
// shape (guards/fixtures-lib-search-16a.json) through runTool; and buildBookTag with texts longer than 1200.
'use strict';
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e]/g, '.') : ''));
  return false;
}
const WORD = /[\p{L}\p{M}\p{N}]/u;
const fold = (v) => String(v == null ? '' : v).replace(/\s+/gu, (run) => ((run.match(/\n/gu) || []).length >= 2 ? '\n\n' : ' ')).trim();
const serviceCut = (text, max) => {
  if (text.length <= max) return { text, truncated: false };
  let end = max;
  if (!/\s/u.test(text[end])) while (end > 0 && !/\s/u.test(text[end - 1])) end -= 1;
  while (end > 0 && /\s/u.test(text[end - 1])) end -= 1;
  return { text: text.slice(0, end), truncated: true };
};
const midWord = (shown, full) => shown.length < full.length && WORD.test(full[shown.length]) && WORD.test(shown[shown.length - 1] || '');
const b64d = (s) => Buffer.from(String(s || ''), 'base64').toString('utf8');

(async () => {
  const tools = await esm('lib/free-brain/tools.js');
  const ask = await esm('api/ask.js');
  const T = tools.__toolsTest;
  const WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lib-search-16a.json'), 'utf8'));
  const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-postship-6-cards.json'), 'utf8'));
  const texts = [FIX.witness, ...FIX.pages, ...FIX.atoms].map((x) => String(x.text || '')).filter((t) => t.trim());

  console.log('-- (a) a passage the service cut is shown as it arrived');
  for (const [name, cap] of [['bw2', 2000], ['default', 1200]]) {
    let n = 0; let svc = 0; let dropped = 0; let mid = 0; let notPrefix = 0;
    for (const t of texts) {
      const c = serviceCut(t, cap);
      const shown = T.bookPassage(c.text, c.truncated);
      const arrived = fold(c.text);
      n += 1;
      if (c.truncated && arrived.length <= 1200) { svc += 1; if (shown !== arrived) dropped += 1; }
      if (midWord(shown, fold(t))) mid += 1;
      if (!fold(t).startsWith(shown)) notPrefix += 1;
    }
    if (name === 'default') ok(name + ': the fixture has service-cut passages our cap does not reach', svc >= 10, String(svc));
    ok(name + ': no whole word dropped from a service-cut passage (' + svc + ' of ' + n + ')', dropped === 0, String(dropped));
    ok(name + ': no passage ends inside a word', mid === 0, String(mid));
    ok(name + ': every passage is the text letter for letter up to its end', notPrefix === 0, String(notPrefix));
  }
  {
    const HIT = WIRE.hit_page_citable;
    const json = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    const rowFor = async (hit) => {
      const c = { table: tools.createEvidenceTable(), degraded: [], spend: [], injectionMarkers: [], band: 'adult',
        libFlagValue: 'on', libToken: 'tk-fix-9', fetchImpl: async () => json({ hits: [hit], total: 1 }) };
      const keep = { log: console.log, warn: console.warn, error: console.error };
      console.log = () => {}; console.warn = () => {}; console.error = () => {};
      try { const out = await tools.runTool('search_library', { query: 'صيام ست من شوال' }, c); return out.added[0] || null; }
      finally { Object.assign(console, keep); }
    };
    const CUT = 'قال الشيخ: من صام رمضان ثم أتبعه ستا من شوال كان كصيام';
    const r = await rowFor({ ...HIT, text: CUT, truncated: true });
    ok('through runTool: a service-cut passage ending open keeps its last word', !!r && r.text === CUT, r ? r.text.slice(-24) : 'no row');
    ok('... matnCut still says the service cut it', !!r && r.matnCut === true);
    const tag = r ? String(ask.buildBookTag(r).tag) : '';
    ok('... the card carries it whole, cut and open', b64d((/matn="([^"]+)"/.exec(tag) || [])[1]) === CUT && / cut="1"/.test(tag) && / open="1"/.test(tag));
  }

  console.log('-- (b) buildBookTag: a text longer than 1200 is cut at its last whole word');
  const row = (text, extra = {}) => ({ bookTitle: 'فتاوى إسلامية', author: 'جمع', locator: 'ج2 ص166', text, ...extra });
  const matnOf = (r) => { const t = String(ask.buildBookTag(r).tag); return { tag: t, matn: b64d((/matn="([^"]+)"/.exec(t) || [])[1]) }; };
  // the witness's words, placed so the card's ceiling (1200) falls inside «الفرض»
  const TAIL = 'لا يجوز تقديم صيام ست شوال على صيام ';
  const unit = 'وقال أهل العلم في هذه المسألة قولا ';
  let pad = ''; while (pad.length + unit.length + TAIL.length < 1199) pad += unit;
  pad += 'و'.repeat(1199 - pad.length - TAIL.length - 1) + ' ';
  const LONG = pad + TAIL + 'الفرض لأن الفرض مقدم. ' + 'ثم قال: '.repeat(40);
  ok('the text is longer than 1200 and character 1200 is inside a word', LONG.length > 1200 && WORD.test(LONG[1200]) && WORD.test(LONG[1199]), LONG.slice(1190, 1206));
  {
    const { tag, matn } = matnOf(row(LONG));
    ok('the card ends on the last whole word', matn.endsWith('على صيام') && !matn.endsWith('صيام ا'), matn.slice(-24));
    ok('... what it carries is the text letter for letter up to there', LONG.startsWith(matn) && matn.length <= 1200, String(matn.length));
    ok('... and it is marked cut and open', / cut="1"/.test(tag) && / open="1"/.test(tag));
  }
  {
    const text = 'ب'.repeat(1500);
    const { matn, tag } = matnOf(row(text));
    ok('one word longer than the ceiling: the hard cut, as before', matn === text.slice(0, 1200) && / cut="1"/.test(tag));
  }
  {
    const text = pad + 'كلمة ' + 'أخرى '.repeat(80);
    const at = text.slice(0, 1200);
    const { matn } = matnOf(row(text));
    ok('a second text whose ceiling falls inside a word: the slice ends on a whole word, letter for letter',text.startsWith(matn) && !midWord(matn, text) && matn.length >= at.trimEnd().lastIndexOf(' '), String(matn.length));
  }
  {
    const short = 'قال الشيخ: هذا جائز.';
    const { matn, tag } = matnOf(row(short));
    ok('a text within the ceiling is carried whole, not marked cut', tag.length > 0 && matn === short && !/ cut="1"/.test(tag));
    const exact = 'ج'.repeat(1199) + '.';
    ok('a text of exactly 1200 is carried whole', matnOf(row(exact)).matn === exact);
  }
  ok('the slice rule is api/ask.js\'s own (bookMatnSlice)', typeof ask.bookMatnSlice === 'function');

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
