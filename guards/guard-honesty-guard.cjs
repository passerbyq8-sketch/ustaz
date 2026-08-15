#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = 'd2c5828707b51a450826a03283f185baaba60829';
const REQUIRED_ITEMS = Object.freeze(['G-01', 'G-06', 'G-07', 'G-08', 'G-09']);
let checks = 0;
let failures = 0;

function ok(label, value, detail = '') {
  checks++;
  if (value) { console.log('  PASS  ' + label); return true; }
  failures++;
  console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
  return false;
}

function eq(label, actual, expected) {
  return ok(label, JSON.stringify(actual) === JSON.stringify(expected),
    'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

(async () => {
  console.log('=== guard-honesty-guard -- claims use independent repository evidence ===');
  const dir = path.join(__dirname, 'honesty');
  const files = fs.readdirSync(dir)
    .filter((name) => /^g\d\d-[a-z0-9-]+\.cjs$/.test(name))
    .sort();
  const modules = files.map((name) => require(path.join(dir, name)));
  const ids = modules.map((entry) => entry.id);
  eq('honesty witness roster is exact', ids, REQUIRED_ITEMS);
  ok('honesty witness ids are unique', new Set(ids).size === ids.length);

  const context = { root: ROOT, baseline: BASELINE, ok, eq };
  for (const entry of modules) {
    console.log('\n--- ' + entry.id + ' ---');
    ok(entry.id + ' exports a runnable witness', typeof entry.run === 'function');
    if (typeof entry.run === 'function') await entry.run(context);
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks
    + (failures ? '  FAIL ===' : '  PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('guard-honesty-guard CRASHED: ' + (error && error.stack || error));
  process.exit(1);
});
