'use strict';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bankContext = {};
const sidecarContext = {};
vm.runInNewContext(fs.readFileSync('quest-data/kunuz-bank-3147.js', 'utf8'), bankContext);
vm.runInNewContext(fs.readFileSync('quest-data/kunuz-levels-3147.js', 'utf8'), sidecarContext);
const rows = bankContext.DATA.qs;
const levels = sidecarContext.KUNUZ_LEVELS.levels;
let hash = 2166136261;
for (const q of rows) {
  const value = String(q.length > 8 ? q[8] : q[3]) + '\n';
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
}
const stamp = `${rows.length}-${hash.toString(16).padStart(8, '0')}`;
assert.equal(sidecarContext.KUNUZ_LEVELS.stamp, stamp, 'sidecar stamp must match browser seenStamp()');

const activeIds = new Set();
let activeCount = 0;
for (let i = 0; i < rows.length; i++) {
  const q = rows[i];
  assert.equal(q.length, 9, `bank row ${i + 1} must have nine positional fields`);
  if (q[2] === 0) continue;
  activeCount++;
  assert.equal(typeof q[8], 'string', `active bank row ${i + 1} must have an id at position 8`);
  assert.ok(q[8].length > 0, `active bank row ${i + 1} must have a nonempty id`);
  assert.ok(!activeIds.has(q[8]), `active bank id must be unique: ${q[8]}`);
  activeIds.add(q[8]);
  assert.ok([1, 2, 3].includes(levels[q[8]]), `active bank id must have level 1-3: ${q[8]}`);
}
console.log(`PASS kunuz-levels-stamp ${stamp} active=${activeCount}`);
