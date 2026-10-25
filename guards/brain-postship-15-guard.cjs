// guards/brain-postship-15-guard.cjs -- POSTSHIP FIX2 ITEM 3 -- 2026-10-25
//
// A BOOK PASSAGE DOES NOT STOP INSIDE A WORD. Measured on the preview: the «فتاوى إسلامية» card in the answer to «ما
// فضل صيام ست من شوال؟» ended «لا يجوز تقديم صيام ست شوال على صيام ا». Two cuts can make that end: ours
// (lib/free-brain/tools.js cleanPassage, at SNIPPET_CHARS = 1200, wherever it falls) and the service's (`truncated`).
// Measured (sessions/side-brain-postship-2026-10-24/fix2/item3/r3-midword.mjs, 456 real library texts): on the
// before-writing path (the service asked for 2000, and it cuts at a space) ours cut 198 and 134 of them ended inside a
// word; the service's cut none. The order (EZIK-CC-POSTSHIP-FIX2-DIRECTIVE-2026-10-25.md, item 3):
//   our cut that falls inside a word steps back to the last whole word; a passage the service cut loses its last word
//   unless it ends on a stop mark; the stored text does not change; what is before the cut is letter for letter;
//   `matnCut` keeps its rule.
// POSTSHIP FIX3 item 3 (2026-10-25) takes back the last-word rule (EZIK-CC-POSTSHIP-FIX3-DIRECTIVE-2026-10-25.md): the
// service cuts at a space, so it dropped a whole word in 196 of 198 samples. A service-cut passage is now shown as it
// arrived; the two checks of that rule below say so (guards/brain-postship-18-guard.cjs is that item's own gate).
// The texts: the witness's own last words in a passage built so the 1200 cap falls where it fell, and the 51 real
// library texts of guards/fixtures-postship-6-cards.json (POSTSHIP item 6's fixture, copied from the measure's reads).
// The service is the real wire shape (guards/fixtures-lib-search-16a.json), served by a stub through runTool.
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
// the reference fold (tools.js's own whitespace rule, retyped): what "letter for letter" is measured against
const fold = (v) => String(v == null ? '' : v).replace(/\s+/gu, (run) => ((run.match(/\n/gu) || []).length >= 2 ? '\n\n' : ' ')).trim();
// the service's cut (measure/server-src/contract.mjs truncationEnd, the server's own, retyped): back to a space
const serviceCut = (text, max) => {
  if (text.length <= max) return { text, truncated: false };
  let end = max;
  if (!/\s/u.test(text[end])) while (end > 0 && !/\s/u.test(text[end - 1])) end -= 1;
  while (end > 0 && /\s/u.test(text[end - 1])) end -= 1;
  return { text: text.slice(0, end), truncated: true };
};
const midWord = (shown, full) => shown.length < full.length && WORD.test(full[shown.length]) && WORD.test(shown[shown.length - 1] || '');

(async () => {
  const tools = await esm('lib/free-brain/tools.js');
  const ask = await esm('api/ask.js');
  const T = tools.__toolsTest;
  const WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lib-search-16a.json'), 'utf8'));
  const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-postship-6-cards.json'), 'utf8'));
  ok('the row passage rule is exposed for this guard (bookPassage)', typeof T.bookPassage === 'function');
  const bookPassage = typeof T.bookPassage === 'function' ? T.bookPassage : (t) => T.cleanPassage(t, 1200);

  // the witness: its last words, placed so the 1200 cap falls right after the «ا» of «الفرض»
  const TAIL = 'لا يجوز تقديم صيام ست شوال على صيام ';
  const unit = 'وقال أهل العلم في هذه المسألة قولا ';
  let pad = ''; while (pad.length + unit.length + TAIL.length < 1199) pad += unit;
  pad += 'و'.repeat(1199 - pad.length - TAIL.length - 1) + ' ';
  const WITNESS = pad + TAIL + 'الفرض لأن الفرض مقدم.';
  console.log('-- 1. the witness: our cap fell inside «الفرض»');
  ok('the cap falls inside the word, as on the preview', WITNESS.slice(0, 1200).endsWith('على صيام ا'), WITNESS.slice(1180, 1205));
  const w = T.cleanPassage(WITNESS, 1200);
  ok('our cut steps back to the last whole word', w.endsWith('على صيام') && !w.endsWith('صيام ا'), w.slice(-30));
  ok('... and what is before it is letter for letter', fold(WITNESS).startsWith(w));

  console.log('-- 2. the real texts, on the before-writing path (service 2000) and the default (service 1200)');
  const texts = [FIX.witness, ...FIX.pages, ...FIX.atoms].map((x) => String(x.text || '')).filter((t) => t.trim());
  for (const [name, cap] of [['bw2', 2000], ['default', 1200]]) {
    let mid = 0; let notPrefix = 0; let svcDropped = 0; let n = 0;
    for (const t of texts) {
      const svc = serviceCut(t, cap);
      const shown = bookPassage(svc.text, svc.truncated);
      const full = fold(t);
      n += 1;
      if (midWord(shown, full)) mid += 1;
      if (!full.startsWith(shown)) notPrefix += 1;
      // POSTSHIP FIX3 item 3 (2026-10-25): a service cut our cap did not reach is shown as it arrived -- the service cuts at
      // a space, so FIX2's rule (drop its last word unless it ends on a stop mark) dropped a whole word. Was: it lost it.
      if (svc.truncated && fold(svc.text).length <= 1200 && shown !== fold(svc.text)) svcDropped += 1;
    }
    ok(name + ': no passage ends inside a word (' + n + ' texts)', mid === 0, String(mid));
    ok(name + ': every passage is the text letter for letter up to its end', notPrefix === 0, String(notPrefix));
    ok(name + ': a service-cut passage is shown as it arrived, no whole word dropped', svcDropped === 0, String(svcDropped));
  }

  console.log('-- 3. through the runner: the row, the flag, the stored text, the card');
  const HIT = WIRE.hit_page_citable;
  const json = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  const rowFor = async (hit, extra = {}) => {
    const c = { table: tools.createEvidenceTable(), degraded: [], spend: [], injectionMarkers: [], band: 'adult',
      libFlagValue: 'on', libToken: 'tk-fix-9', fetchImpl: async () => json({ hits: [hit], total: 1 }), ...extra };
    const keep = { log: console.log, warn: console.warn, error: console.error };
    console.log = () => {}; console.warn = () => {}; console.error = () => {};
    try { const out = await tools.runTool('search_library', { query: 'صيام ست من شوال' }, c); return out.added[0] || null; }
    finally { Object.assign(console, keep); }
  };
  const long = await rowFor({ ...HIT, text: WITNESS, truncated: false }, { keepFullText: true });
  ok('a long passage: the row ends on the last whole word', !!long && long.text.endsWith('على صيام'), long ? long.text.slice(-30) : 'no row');
  ok('... matnCut on its rule (the passage is longer than the cap)', !!long && long.matnCut === true);
  ok('... the row\'s fullText is the whole passage, untouched', !!long && long.fullText === fold(WITNESS));
  const tag = long ? String(ask.buildBookTag(long).tag) : '';
  const matn = (/matn="([^"]+)"/.exec(tag) || [])[1];
  ok('... the card carries that passage, marked cut and open', !!matn && Buffer.from(matn, 'base64').toString('utf8') === long.text && / cut="1"/.test(tag) && / open="1"/.test(tag));
  const SVC_OPEN = 'قال الشيخ: لا يجوز تقديم صيام ست شوال على صيام ا';
  // POSTSHIP FIX3 item 3 (2026-10-25): a passage the service cut (at a space, as it does) ends open and is kept as it
  // arrived. Was: «the last word is dropped», on a service cut placed inside a word, which the service does not make.
  const SVC_CUT = 'قال الشيخ: لا يجوز تقديم صيام ست شوال على صيام';
  const so = await rowFor({ ...HIT, text: SVC_CUT, truncated: true });
  ok('the service cut it and it ends open: kept as it arrived, its last word too', !!so && so.text === SVC_CUT, so ? so.text.slice(-30) : 'no row');
  ok('... and matnCut is set (the service said truncated)', !!so && so.matnCut === true);
  const SVC_STOP = 'قال الشيخ: لا يجوز تقديم صيام ست شوال على صيام الفرض.';
  const ss = await rowFor({ ...HIT, text: SVC_STOP, truncated: true });
  ok('the service cut it on a stop mark: kept whole', !!ss && ss.text === SVC_STOP && ss.matnCut === true, ss ? ss.text.slice(-20) : 'no row');
  const whole = await rowFor({ ...HIT, text: SVC_OPEN, truncated: false });
  ok('a passage nobody cut keeps its last word (the page\'s own end)', !!whole && whole.text === SVC_OPEN && whole.matnCut === false);

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
