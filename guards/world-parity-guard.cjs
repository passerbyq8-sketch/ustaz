// guards/world-parity-guard.cjs — THE MAP IN THE PAGE IS THE MAP IN THE FILE.
//
// ── THE DEFECT, MEASURED ─────────────────────────────────────────────────────
// quest.html carries an embedded copy of the world map in `<script id="world">`, and
// quest-data/world.json carries the real one. They had drifted: THIRTEEN regions embedded
// against TWENTY-SEVEN in the file. Fourteen regions — الحديث، الخلفاء الراشدون، الأمويّة،
// العبّاسيّة، الأيّوبيّة، المماليك، العثمانيّة and more — existed in the data and could not be
// reached from the embedded copy.
//
// ── AND WHY NOBODY NOTICED ───────────────────────────────────────────────────
// `loadJSON(file, embedId)` tries the file and, on ANY failure, falls back to the embedded block
// and returns it — with no line in the console and no difference the player can see except that
// half his world is missing. A cached 404, an offline load, a path change: any of them silently
// halves the game. The embedded copy is a legitimate offline fallback; a fallback that is not the
// thing it falls back to is a second, worse product hiding behind the first.
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
// The embedded block must PARSE EQUAL to quest-data/world.json — deep equality, not a byte
// compare, because the file is pretty-printed and the block is minified. The file is the source
// of record; it is sealed by hash in quest-ux-guard.cjs and nothing here may edit it.
//
// Usage: node guards/world-parity-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/** Count every region across every world. */
function regionCount(w) {
  return (w.worlds || []).reduce((n, x) => n + ((x.regions || []).length), 0);
}

(function main() {
  console.log('=== world-parity-guard — the embedded map IS quest-data/world.json ===');

  const quest = read('quest.html');
  const m = quest.match(/<script id="world" type="application\/json">([\s\S]*?)<\/script>/);
  ok('quest.html carries an embedded world block', !!m);
  if (!m) { console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ==='); process.exit(1); }

  let embedded = null;
  try { embedded = JSON.parse(m[1]); }
  catch (e) { ok('the embedded block is valid JSON', false, e.message); }
  if (!embedded) { console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ==='); process.exit(1); }

  const file = JSON.parse(read('quest-data/world.json'));

  // THE COUNT FIRST, because it is the number that tells the story when this gate goes red.
  ok('the embedded map holds every region the file holds',
    regionCount(embedded) === regionCount(file),
    'embedded=' + regionCount(embedded) + ' file=' + regionCount(file));
  ok('...and every world',
    (embedded.worlds || []).length === (file.worlds || []).length,
    'embedded=' + (embedded.worlds || []).length + ' file=' + (file.worlds || []).length);

  // Then the whole document, so a renamed region or a moved unlock threshold is caught too.
  // Key order is irrelevant to a parsed object; JSON.stringify over sorted keys makes the
  // comparison independent of it.
  const canon = (v) => JSON.stringify(v, (k, val) =>
    (val && typeof val === 'object' && !Array.isArray(val))
      ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {})
      : val);
  const a = canon(embedded), b = canon(file);
  if (!ok('the embedded map is the file, key for key and value for value', a === b)) {
    // Say WHICH regions differ; a 60KB diff helps nobody.
    const ids = (w) => new Set((w.worlds || []).flatMap((x) => (x.regions || []).map((r) => x.id + '/' + r.id)));
    const ea = ids(embedded), fb = ids(file);
    const missing = [...fb].filter((x) => !ea.has(x));
    const extra = [...ea].filter((x) => !fb.has(x));
    if (missing.length) console.log('        missing from quest.html: ' + missing.join(', '));
    if (extra.length) console.log('        present only in quest.html: ' + extra.join(', '));
    if (!missing.length && !extra.length) console.log('        same regions, different contents');
  }

  // AND THE SILENT FALLBACK IS NO LONGER SILENT. Parity makes the fallback harmless; saying which
  // copy was used is what makes the NEXT drift visible on the first load rather than never.
  ok('loadJSON says which copy it ended up using',
    /\[quest\] .*embedded|embedded copy/.test(quest) && /console\.(warn|log)\(/.test(quest),
    'a fallback that leaves no trace is a defect that leaves no trace');

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})();
