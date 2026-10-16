// kunuz-groups-guard.cjs -- the eight category groups are written in three places: KZC_GROUPS in quest-ghaws.html,
// KZC_GROUPS in quest-harb.html, and CATEGORY_GROUPS in Hanna Laha (packages/protocol/src/category-groups.ts).
// This gate compares them and turns red at the first difference (a name, a religious flag, an id, an order), so the
// pickers cannot drift apart. ASCII output only.
//
//   G1 the three Kunuz pages that pick categories (ghaws, harb, test, board) carry the same table, entry for entry
//   G2 that table equals guards/fixtures/hl-category-groups.json, the table Hanna Laha exported
//   G3 when the Hanna Laha repository is on this machine, its table (read now) equals the same file, so a change
//      there that was not exported here is red
//   G4 every id of the table is a category of the shared bank, and no id is named twice
//   G5 the gate bites: the same comparison run on a table with one id swapped, one flag flipped, one name changed and one
//      group dropped must fail each time
//
// usage: node guards/kunuz-groups-guard.cjs [--hl <Hanna Laha folder>]
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const HL = arg('hl', process.env.HL_REPO || 'C:/Users/passe/projects/hanna-laha');
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, '?');

let fails = 0;
function report(id, name, ok, info) {
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + id + ' ' + name + (info ? ' :: ' + ascii(info) : ''));
}

/** KZC_GROUPS of a page: [[name, 1|0, [ids]], ...] -> [{name, religious, ids}] */
function pageTable(file) {
  const t = fs.readFileSync(path.join(REPO, file), 'utf8');
  const a = t.indexOf('var KZC_GROUPS=[');
  if (a < 0) throw new Error(file + ' has no KZC_GROUPS');
  const b = t.indexOf('\n];', a);
  if (b < 0) throw new Error(file + ' KZC_GROUPS does not end');
  const raw = new Function(t.slice(a, b + 3).replace('var KZC_GROUPS=', 'return ').replace(/;\s*$/, ''))();
  return raw.map((x) => ({ name: x[0], religious: x[1] === 1, ids: x[2] }));
}

/** The differences between two tables, as short strings; empty = equal. */
function diff(a, b, la, lb) {
  const out = [];
  if (a.length !== b.length) out.push('group count ' + a.length + ' vs ' + b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x.name !== y.name) out.push('group ' + i + ' name differs');
    if (x.religious !== y.religious) out.push('group ' + i + ' religious flag differs');
    if (JSON.stringify(x.ids) !== JSON.stringify(y.ids)) out.push('group ' + i + ' ids differ (' + la + ' ' + x.ids.length + ', ' + lb + ' ' + y.ids.length + ')');
  }
  return out;
}

const ghaws = pageTable('quest-ghaws.html');
const harb = pageTable('quest-harb.html');
const test = pageTable('quest-test.html');   // KUNUZ-TEST (2026-10-16)
const board = pageTable('quest-board.html');   // KUNUZ-BOARD (2026-10-16)
const fixtureFile = path.join(__dirname, 'fixtures', 'hl-category-groups.json');
const fixture = JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));

// G1
{
  const d = diff(ghaws, harb, 'ghaws', 'harb').concat(diff(ghaws, test, 'ghaws', 'test')).concat(diff(ghaws, board, 'ghaws', 'board'));
  report('G1', 'quest-ghaws.html, quest-harb.html, quest-test.html and quest-board.html carry the same table', d.length === 0, 'groups=' + ghaws.length + ' diffs=' + d.length + (d.length ? ' ' + d.slice(0, 4).join('; ') : ''));
}
// G2
{
  const d = diff(harb, fixture, 'pages', 'hanna-laha');
  report('G2', 'the pages equal the table Hanna Laha exported (guards/fixtures/hl-category-groups.json)', d.length === 0, 'diffs=' + d.length + (d.length ? ' ' + d.slice(0, 4).join('; ') : ''));
}
// G3
{
  const exporter = path.join(HL, 'scripts', 'export-category-groups.mjs');
  if (!fs.existsSync(exporter)) {
    report('G3', 'Hanna Laha is not on this machine: the exported file stands alone', true, 'skipped (no ' + exporter + ')');
  } else {
    let live = null, err = '';
    try { live = JSON.parse(cp.execFileSync(process.execPath, [exporter, '--stdout'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
    catch (e) { err = String(e.message).split('\n')[0]; }
    if (live === null) report('G3', 'read the live table of Hanna Laha', false, err);
    else {
      const d = diff(live, fixture, 'hanna-laha-now', 'exported');
      report('G3', 'the live table of Hanna Laha equals the exported file', d.length === 0, 'diffs=' + d.length + (d.length ? ' ' + d.slice(0, 4).join('; ') + ' -- run: node scripts/export-category-groups.mjs in Hanna Laha' : ''));
    }
  }
}
// G4
{
  const bankText = fs.readFileSync(path.join(REPO, 'quest-data', 'kunuz-bank-3147.js'), 'utf8');
  const DATA = new Function(bankText + ';return DATA;')();
  const known = new Set(DATA.cats.map((c) => c[0]));
  const seen = new Set(), dup = [], unknown = [];
  harb.forEach((g) => g.ids.forEach((id) => { if (seen.has(id)) dup.push(id); seen.add(id); if (!known.has(id)) unknown.push(id); }));
  report('G4', 'every id is a category of the shared bank and appears once', !dup.length && !unknown.length, 'ids=' + seen.size + ' duplicates=' + dup.length + ' unknown=' + unknown.length + (unknown.length ? ' ' + unknown.slice(0, 3).join(',') : ''));
}
// G5
{
  const clone = () => JSON.parse(JSON.stringify(fixture));
  const mutants = [];
  { const m = clone(); const t = m[0].ids[0]; m[0].ids[0] = m[1].ids[0]; m[1].ids[0] = t; mutants.push(['an id swapped between two groups', m]); }
  { const m = clone(); m[2].religious = !m[2].religious; mutants.push(['a religious flag flipped', m]); }
  { const m = clone(); m[3].name = m[3].name + 'x'; mutants.push(['a group renamed', m]); }
  { const m = clone(); m.pop(); mutants.push(['a group dropped', m]); }
  { const m = clone(); m[4].ids.reverse(); mutants.push(['the order inside a group reversed', m]); }
  const missed = mutants.filter(([, m]) => diff(harb, m, 'pages', 'mutant').length === 0).map(([n]) => n);
  report('G5', 'the comparison bites: five mutated tables are all caught', missed.length === 0, 'mutants=' + mutants.length + ' missed=' + missed.length + (missed.length ? ' ' + missed.join(',') : ''));
}

console.log('SUMMARY ' + (fails ? 'FAILED ' + fails : 'all pass'));
process.exit(fails ? 1 : 0);
