'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failures = 0;
let checks = 0;
function ok(name, cond) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name);
  return false;
}
(async () => {
  const { routeLogFields } = await import('file://' + path.join(ROOT, 'lib/route-log.js').replace(/\\/g, '/'));
  const rows = [
  [{ lexicalRuntime: 'STORED_FIQH', runtime: 'GENERAL', sorter: 'worldly' }, ['sorter:worldly', 'lex:STORED_FIQH', 'sorter_worldly']],
  [{ lexicalRuntime: 'HADITH', runtime: 'GENERAL', sorter: 'worldly' }, ['sorter:worldly', 'lex:HADITH', 'sorter_worldly']],
  [{ lexicalRuntime: 'STORED_FIQH', runtime: 'STORED_FIQH', sorter: 'religious' }, ['sorter:religious']],
  [{ lexicalRuntime: 'GENERAL', runtime: 'STORED_FIQH', sorter: 'religious' }, ['sorter:religious', 'lex:GENERAL']],
  [{ lexicalRuntime: 'GENERAL', runtime: 'STORED_FIQH', sorter: 'timeout' }, ['sorter:timeout', 'lex:GENERAL']],
  [{ lexicalRuntime: 'GENERAL', runtime: 'GENERAL', sorter: 'worldly' }, ['sorter:worldly']],
  [{ lexicalRuntime: 'STORED_FIQH', runtime: 'STORED_FIQH', sorter: 'ruling_cue' }, []],
  [{ lexicalRuntime: 'GENERAL', runtime: 'GENERAL', sorter: 'removed_identity' }, ['removed_identity']],
];
for (const [input, expected] of rows) ok('route log fields ' + JSON.stringify(input), JSON.stringify(routeLogFields(input)) === JSON.stringify(expected));
const ask = fs.readFileSync(path.join(ROOT, 'api/ask.js'), 'utf8');
ok('ask route logs the captured lexical runtime and final route tags', ask.includes('routeLogFields({') && ask.includes('lexicalRuntime: lexicalRuntimeOfRequest, runtime: finalRuntime, sorter: final.sorter || null') && ask.includes('flags: routeTags'));
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'gates.json'), 'utf8'));
ok('route log guard is registered once', roster.filter((x) => x.name === 'postship3routelog' && x.script === 'guards/brain-postship3-route-log-guard.cjs').length === 1);
// PRAYER REBUILD (2026-10-29): 216 -> 220 after side/prayer-20261029 merged on main 34b6278e (compassmath, locationauto, hijrievents, prayerlog).
ok('gate inventory count is 220', roster.length === 220);
const attrs = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
ok('route helper and guard are pinned to LF', /lib\/route-log\.js text eol=lf/.test(attrs) && /guards\/brain-postship3-route-log-guard\.cjs text eol=lf/.test(attrs));
console.log(String.fromCharCode(10) + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
