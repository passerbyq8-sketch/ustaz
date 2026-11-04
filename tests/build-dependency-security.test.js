import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Fixed ranges: upstream GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g,
// and GHSA-w5vr-8v7q-w6rv, verified 2026-11-04. Keep this offline and deterministic.
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
function atLeast(version, floor) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const a = version.split('.').map(Number), b = floor.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
}
for (const [name, floor] of [['browserslist', '4.28.7'], ['baseline-browser-mapping', '2.11.0']]) {
  test(name + ' is patched everywhere in the lockfile', () => {
    const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith('/node_modules/' + name) || path === 'node_modules/' + name);
    assert.ok(entries.length > 0, name + ' absent: revisit the dependency contract');
    for (const [path, entry] of entries) {
      assert.ok(atLeast(entry.version, floor), path + ' contains an affected version');
      assert.equal(entry.dev, true, path + ' should remain build-only');
      assert.match(entry.integrity, /^sha512-/);
    }
  });
}
