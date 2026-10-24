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
      ok(tag + ': a block of 600 or fewer is shown whole in the brief answer too', brief === today);
      continue;
    }
    long += 1;
    const m = TAG_RE.exec(brief);
    const visible = m ? brief.slice(0, m.index) : brief;
    ok(tag + ': the brief block shows 600 characters at most', visible.length <= 600, String(visible.length));
    ok(tag + ': ...ending at a sentence\'s end, closed by «…»', /[.؟!؛]…$|\n…$|…$/u.test(visible) && visible.endsWith('…'), visible.slice(-30).replace(/[^\x20-\x7e]/g, '.'));
    ok(tag + ': ...an excerpt of the block as served, letter for letter', today.startsWith(visible.slice(0, -1).replace(/\s+$/u, '')));
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
  ok('the button reads «النص الكامل» (the tag\'s own content) and shows the full text in place', /function FatwaFullText\(\{ text, label \}\)/u.test(app)
    && FF.FATWA_FULL_LABEL === 'النص الكامل' && /label: content/u.test(app) && /if \(shown\) return <div style=\{\{ whiteSpace: 'pre-wrap'/u.test(app));
  const lang = fs.readFileSync(path.join(REPO, 'lib/lang/answer.js'), 'utf8');
  ok('the translation step carries the tag untranslated', /'book', 'fatwafull'\]/u.test(lang));

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
