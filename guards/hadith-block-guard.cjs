// guards/hadith-block-guard.cjs -- brain35 B-5 (2026-11-06; DIAG PKG-1): A «<hadith …>» BLOCK IS ONE QUOTATION.
//
// MEASURED OFFLINE (H4 case A, the smallest input that reproduces it): the legacy path's backup ruling filter
// (lib/free-brain/loop.js withoutUnsourcedRulings) judges a line sentence by sentence; its quote tracker skipped markup
// and opened no quotation for a card, so a hadith block was split at its own inner full stop, the piece carrying the
// ruling word («يكره») was removed, and what reached the reader was an INTACT card holding a PARTIAL matn. P3's rule
// («no partial matn») failed inside a block that looked whole.
//
// THE RULE NOW: the tracker opens on «<hadith …>» and closes on «</hadith>» (a card counter), so the filter judges the
// whole block and removes or keeps it WHOLE. The block is sourced by a [[n]] of its own or by the ruling attribute the
// takhrij pass wrote into its tag; with neither, the whole block goes and nothing of it is left behind.
//
// Usage: node guards/hadith-block-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300) : ''));
  return false;
};
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?hadithblock=' + Date.now());

(async () => {
  console.log('=== hadith-block-guard -- brain35 B-5: the backup ruling filter judges a hadith block whole ===');
  const L = await esm('lib/free-brain/loop.js');
  // the hadith of EXT-Q5 (Q38 on the battery), in the tagged form the legacy path writes
  const MATN = 'أتدرون ما الغيبة؟ قالوا: الله ورسوله أعلم. قال: ذكرك أخاك بما يكره.';
  const TAG_OPEN = '<hadith narrator="أبو هريرة">';
  const TAG_RULED = '<hadith narrator="أبو هريرة" ruling="رواه مسلم">';
  const LAST = 'ذكرك أخاك بما يكره';
  const whole = (text) => /<hadith/u.test(text) === /<\/hadith>/u.test(text);
  const gone = (text) => !/<hadith/u.test(text) && !/<\/hadith>/u.test(text) && !text.includes(LAST) && !text.includes('أتدرون ما الغيبة');

  // 1. neither a [[n]] nor a ruling attribute: the whole block goes
  const bare = L.withoutUnsourcedRulings(TAG_OPEN + MATN + '</hadith>', []);
  ok('1a a block with neither a [[n]] nor a ruling attribute is removed WHOLE', gone(bare.text) && bare.removed === 1, JSON.stringify(bare));
  ok('1b ...and nothing of its matn is left behind, nor an orphan tag', !bare.text.includes('الغيبة') && whole(bare.text), bare.text);
  // 2. a [[n]] after the closing tag: kept whole
  const cited = L.withoutUnsourcedRulings(TAG_OPEN + MATN + '</hadith> [[1]]', [1]);
  ok('2a a block cited by a [[n]] is kept WHOLE, its last sentence included',
    cited.removed === 0 && cited.text.includes(LAST) && whole(cited.text) && /<hadith/u.test(cited.text), JSON.stringify(cited));
  ok('2b ...and the turn is not marked not-covered', cited.notCovered === false && cited.sourcedRulings === 1, JSON.stringify(cited));
  // 3. the ruling attribute the takhrij pass wrote is a source of its own
  const ruled = L.withoutUnsourcedRulings(TAG_RULED + MATN + '</hadith>', []);
  ok('3 a block whose tag carries the takhrij pass\'s ruling attribute is kept whole',
    ruled.removed === 0 && ruled.text.includes(LAST) && ruled.sourcedRulings === 1, JSON.stringify(ruled));
  // 4. H4's own case A, in full
  const h4a = L.withoutUnsourcedRulings('الغيبة محرمة بالكتاب والسنة [[1]].\n' + TAG_RULED + MATN + '</hadith>\nوالغيبة من كبائر الذنوب [[1]].', [1]);
  ok('4 H4 case A: the block keeps its last sentence and both tags, and the prose around it stands',
    h4a.text.includes(LAST) && whole(h4a.text) && h4a.text.includes('الغيبة محرمة') && h4a.text.includes('كبائر الذنوب'), h4a.text);
  // 5. a <document> block is NOT bound by this tracker: only «<hadith>» is. Its sentences are judged one by one, exactly as
  // they were before the change (the ruling sentence goes, the rest stays) -- the proof that the binding is the card's alone.
  const doc = '<document>النص الأول. وهذا يكره عند أهل العلم. النص الثالث.</document>';
  const docOut = L.withoutUnsourcedRulings(doc, []);
  ok('5a a <document> block is not bound: its own ruling sentence is judged alone, as before',
    docOut.removed === 1 && !docOut.text.includes('يكره') && docOut.text.includes('النص الأول') && docOut.text.includes('النص الثالث'), docOut.text);
  const docClean = '<document>النص الأول. والنص الثاني من المصدر. النص الثالث.</document>';
  ok('5b ...and a <document> block that states no ruling is left exactly as it was',
    L.withoutUnsourcedRulings(docClean, []).text === docClean && L.withoutUnsourcedRulings(docClean, []).removed === 0);
  // 6. the ordinary quotation rule still holds (the guillemet form of the same hadith)
  const guill = L.withoutUnsourcedRulings('قال صلى الله عليه وسلم: «' + MATN + '»', []);
  ok('6 the same hadith in guillemets is still judged by the quotation rule, whole', guill.removed === 1 && !guill.text.includes(LAST), JSON.stringify(guill));

  // 7. the mutants
  const twin = async (transform, tag) => {
    const src = fs.readFileSync(path.join(REPO, 'lib/free-brain/loop.js'), 'utf8');
    const mutated = transform(src);
    if (mutated === src) return { changed: false };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-hadithblock-' + tag + '-'));
    const file = path.join(tmp, 'loop.mjs');
    fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
      (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib/free-brain', spec)).href + q), 'utf8');
    try { return { changed: true, mod: await import(pathToFileURL(file).href + '?t=' + Date.now()) }; } catch (e) { return { changed: true, error: String(e && e.message) }; } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  };
  const m1 = await twin((s) => s.replace('    get open() { return state.card > 0 ||', '    get open() { return false ||'), 'open');
  ok('7a MUTANT card-open seam applied and loaded', m1.changed && m1.mod, m1.error);
  ok('7a MUTANT KILLED: without the card counter the block is cut at its own full stop again',
    !!m1.mod && (() => { const r = m1.mod.withoutUnsourcedRulings(TAG_RULED + MATN + '</hadith>', []); return !r.text.includes(LAST) && /<hadith/u.test(r.text); })(), m1.error);
  const m2 = await twin((s) => s.replace('      if (HADITH_BLOCK_RULED_RE.test(part)) { sourcedRulings += 1; return false; }', '      // mutant: the ruling attribute says nothing'), 'ruled');
  ok('7b MUTANT ruling-attribute seam applied and loaded', m2.changed && m2.mod, m2.error);
  ok('7b MUTANT KILLED: without it a block the takhrij pass graded is removed whole',
    !!m2.mod && (() => { const r = m2.mod.withoutUnsourcedRulings(TAG_RULED + MATN + '</hadith>', []); return r.removed === 1 && !r.text.includes(LAST); })(), m2.error);

  console.log('\n=== hadith-block: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
