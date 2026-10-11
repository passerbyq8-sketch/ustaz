// ez110-names-guard.cjs -- ITEM 110 ROUND 2 (§4-7): ONE NAME, ONE KEY, PER SECTION, ON EVERY SURFACE OF «ب».
//
// The owner's coherence rule 4: every section has one name and one icon wherever it appears. In «ب» the shown name
// of a section comes from ONE table, EZ110_SECTION_NAMES (id -> dictionary key), read through ez110Name(id). This
// guard pins that, NARROWLY -- it adds no permission anywhere:
//   N1  the table names exactly the sections below, each to one key, and no two sections share a key
//   N2  every key exists, non-empty, in both halves of the dictionary (ar, en)
//   N3  the three names the owner gave: «الصلاة», «الحاسبة الشرعية» and «كنوز المعرفة» (round 3, exactly)
//   N4  every surface of «ب» reads the table: the tiles, the bottom bar (its two chosen slots, round 3), the page titles of the
//       prayer, tasbih, calculator, adhkar and fatwa sections
//   N5  the dark design keeps its own names: each lit title above is a ternary whose dark branch is the old one
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const jsx = fs.readFileSync(path.join(ROOT, 'app.jsx'), 'utf8');
let fails = 0, passes = 0;
const pass = (m) => { passes++; console.log('PASS ' + m); };
const fail = (m) => { fails++; console.log('FAIL ' + m); };
const ok = (c, m) => (c ? pass(m) : fail(m));

const IDS = ['asmaa', 'articles', 'memorize', 'adhkar', 'sunan-day', 'arbaeen', 'mushaf', 'treasure', 'fatwa', 'lessons', 'library', 'prayer', 'women', 'tasbih', 'calc'];
const m = jsx.match(/const EZ110_SECTION_NAMES = (\{[\s\S]*?\});/);
let TABLE = null;
try { TABLE = m ? vm.runInNewContext('(' + m[1] + ')') : null; } catch (e) { TABLE = null; }
ok(!!TABLE, 'N1 the table EZ110_SECTION_NAMES is found and is a plain object literal');
if (TABLE) {
  ok(JSON.stringify(Object.keys(TABLE).slice().sort()) === JSON.stringify(IDS.slice().sort()), 'N1 it names exactly the ' + IDS.length + ' sections');
  const vals = Object.values(TABLE);
  ok(new Set(vals).size === vals.length, 'N1 no two sections share a key');
  ok(vals.every((v) => typeof v === 'string' && /^[a-z0-9.]+$/i.test(v)), 'N1 every value is a dictionary key');
}
// the dictionary halves
const dictSrc = (() => { const i = jsx.indexOf('const EZ_I18N = {'); const j = jsx.indexOf('\n};\n', i); return i < 0 || j < 0 ? '' : jsx.slice(i, j) + '\n};\n'; })();
let DI = null;
try { const ctx = vm.createContext({}); vm.runInContext(dictSrc + '\nthis.EZ_I18N = EZ_I18N;', ctx); DI = ctx.EZ_I18N; } catch (e) { DI = null; }
ok(!!DI, 'N2 the dictionary is readable');
if (TABLE && DI) {
  for (const [id, key] of Object.entries(TABLE)) {
    ok(typeof DI.ar[key] === 'string' && DI.ar[key].trim() && typeof DI.en[key] === 'string' && DI.en[key].trim(), `N2 ${id} -> ${key} exists in ar and en`);
  }
  ok(DI.ar[TABLE.prayer] === 'الصلاة', 'N3 the prayer is named «الصلاة» (owner)');
  ok(DI.ar[TABLE.calc] === 'الحاسبة الشرعية', 'N3 the calculator is named «الحاسبة الشرعية» (owner)');
  ok(DI.ar[TABLE.treasure] === 'كنوز المعرفة', 'N3 the treasure section is named «كنوز المعرفة» (owner, round 3)');
}
// the readers
const has = (s) => jsx.indexOf(s) !== -1;
ok(/function ez110Name\(id\) \{ return EZ110_SECTION_NAMES\[id\] \? ezT\(EZ110_SECTION_NAMES\[id\]\) : ''; \}/.test(jsx), 'N4 ez110Name reads the table and nothing else');
ok(has("function ez110BarName(id) { return ez110Name(id) || (id === 'wird' ? DW_CARD_TITLE : ''); }") && has('ids.map((id, i) => ({ k: id, slot: i, label: ez110BarName(id),'), 'N4 the bottom bar names its two chosen slots from the table (the wird keeps its one name, DW_CARD_TITLE)');
ok(has('byId[m.id] = ez110Name(m.id) ? { ...m, label: ez110Name(m.id) } : m;'), 'N4 the tiles of the menu take their names from the table');
const lit = [
  ["ez110.id ? ez110Name('prayer') : (EZ_LANG === 'ar' ? PRAYER_SHEET_TITLE : ezT('prayer.sheetTitle'))", 'prayer'],
  ["ez110ReadIdentity() ? ez110Name('tasbih') : ezT('tasbih.title')", 'tasbih'],
  ["ez110ReadIdentity() ? ez110Name('calc') : ezT('calc.title')", 'calc'],
  ["ez110ReadIdentity() ? ez110Name('adhkar') : A2_TITLE", 'adhkar'],
];
for (const [expr, id] of lit) ok(has(expr), `N4/N5 the ${id} page title reads the table lit and keeps its own name dark`);
ok(/ez110ReadIdentity\(\) \? \(\s*<span className="ezsh-brand">[\s\S]{0,140}\{ez110Name\('fatwa'\)\}[\s\S]{0,40}\) : <span aria-hidden="true" \/>/.test(jsx), 'N4/N5 the fatwa head names its section lit and stays empty dark');
console.log(`\nez110-names: PASS=${passes} FAIL=${fails}`);
process.exit(fails ? 1 : 0);
