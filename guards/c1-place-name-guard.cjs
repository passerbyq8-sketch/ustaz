'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const places = JSON.parse(fs.readFileSync(path.join(root, 'places.json'), 'utf8'));
const jahra = places.p.find(r => r[0] === 285799);
assert.equal(jahra[2], '\u0627\u0644\u062c\u0647\u0631\u0627\u0621', 'Jahra uses its full Arabic name');
assert.ok(jahra[3].split('|').includes('\u062c\u0647\u0631\u0627'), 'the old name remains searchable');
assert.deepEqual(places.p.find(r => r[0] === 285839), [285839, 'Al Ahmadi', '\u0627\u0644\u0623\u062d\u0645\u062f\u064a', '\u0627\u0644\u0627\u062d\u0645\u062f\u064a', 'KW', 29.0769, 48.0839, 174, 637411], 'Ahmadi is unchanged');
console.log('PASS item 3c: Jahra name and alias; Ahmadi unchanged');

const vm = require('node:vm');
const jsx = fs.readFileSync(path.join(root, 'app.jsx'), 'utf8');
const start = jsx.indexOf('function readPrayerPlaceFor(lat, lng) {');
const end = jsx.indexOf('// A place chosen from the places list:', start);
assert.ok(start > 0 && end > start, 'exercise the actual saved-place reader');
const migrationStart = jsx.indexOf('function migrateSavedJahraPlace() {');
const migrationEnd = jsx.indexOf('// The offset the calculator is given for a civil day:', migrationStart);
assert.ok(migrationStart > 0 && migrationEnd > migrationStart, 'exercise the actual startup migration');
assert.ok(jsx.includes("migrateSavedJahraPlace();\n\nconst root = ReactDOM.createRoot"), 'migrate before the first React render');
let stored, writes;
const ctx = vm.createContext({ PRAYER_PLACE_KEY: 'ezik_prayer_place_v1',
  prayerZoneFmt(tz) { try { return new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { return null; } },
  localStorage: { getItem(key) { assert.equal(key, 'ezik_prayer_place_v1'); return stored; },
    setItem(key, value) { assert.equal(key, 'ezik_prayer_place_v1'); stored = value; writes++; } } });
vm.runInContext(jsx.slice(start, end), ctx);
vm.runInContext(jsx.slice(migrationStart, migrationEnd), ctx);
const old = { n: "Al Jahra'", a: '\u062c\u0647\u0631\u0627', cc: 'KW', tz: 'Asia/Kuwait', lat: 29.3375, lng: 47.6581 };
stored = JSON.stringify(old); writes = 0;
assert.equal(ctx.readPrayerPlaceFor(old.lat, old.lng).a, old.a, 'the saved-place reader alone stays pure');
assert.equal(writes, 0, 'reading never migrates or writes');
assert.equal(ctx.migrateSavedJahraPlace(), true, 'startup migrates the old saved name');
assert.equal(ctx.readPrayerPlaceFor(old.lat, old.lng).a, jahra[2], 'a saved legacy Jahra renders the corrected name');
assert.equal(writes, 1, 'migration persists once');
assert.deepEqual(JSON.parse(stored), { ...old, a: jahra[2] }, 'only the Arabic-name field changes');
const migrated = stored;
assert.equal(ctx.migrateSavedJahraPlace(), false, 'second migration is a no-op');
ctx.readPrayerPlaceFor(old.lat, old.lng);
assert.equal(writes, 1, 'second read is a no-op');
assert.equal(stored, migrated, 'second read preserves bytes');
for (const rec of [
  { ...old, a: jahra[2] }, { ...old, a: '\u0627\u0644\u0623\u062d\u0645\u062f\u064a', lat: 29.0769, lng: 48.0839 },
  { ...old, lat: old.lat + 0.011 }, { ...old, lng: old.lng - 0.011 },
  { ...old, a: '\u062c\u0647\u0631\u0627 ' }, { ...old, lat: String(old.lat) },
  { ...old, lat: null }, { ...old, tz: 'Invalid/Zone' }, { ...old, n: '' }
]) {
  stored = JSON.stringify(rec); writes = 0; const before = stored;
  assert.equal(ctx.migrateSavedJahraPlace(), false);
  ctx.readPrayerPlaceFor(rec.lat, rec.lng);
  assert.equal(writes, 0, 'unrelated, corrected or invalid records are untouched');
  assert.equal(stored, before);
}
for (const delta of [-0.009, 0.009]) {
  const rec = { ...old, lat: old.lat + delta, lng: old.lng + delta };
  stored = JSON.stringify(rec); writes = 0;
  assert.equal(ctx.migrateSavedJahraPlace(), true);
  assert.equal(ctx.readPrayerPlaceFor(rec.lat, rec.lng).a, jahra[2], 'legacy coordinates within the allowed tolerance migrate');
  assert.equal(writes, 1);
}
stored = JSON.stringify(old); writes = 0;
assert.equal(ctx.readPrayerPlaceFor(0, 0), null, 'a name not on the selected coordinates stays rejected');
assert.equal(writes, 0);
for (const malformed of ['{', 'null', '[]', 'false', '"invalid"']) {
  stored = malformed; writes = 0;
  assert.equal(ctx.migrateSavedJahraPlace(), false);
  assert.equal(writes, 0);
}
console.log('PASS item 3d: pure reader, startup migration, exact legacy shape, tolerance, unrelated records, persisted idempotence');
