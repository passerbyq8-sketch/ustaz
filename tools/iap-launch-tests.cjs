'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const suites = [
  { name: 'iap-g6', args: ['--test', 'tests/iap-g6.test.js'] },
  { name: 'iap-g-v2', args: ['--test', 'tests/iap-g-v2.test.js'] },
  { name: 'iap-rollout', args: ['--test', 'tests/iap-rollout.test.js'] },
  { name: 'iap-ios-purchase-visibility', args: ['tests/iap-ios-purchase-visibility.test.cjs'] },
];

let failed = false;
for (const suite of suites) {
  process.stdout.write(`\n=== ${suite.name} ===\n`);
  const result = spawnSync(process.execPath, suite.args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`${suite.name}: ${result.error.message}\n`);
    failed = true;
  } else if (result.status !== 0) {
    process.stderr.write(`${suite.name}: exit ${result.status}\n`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else process.stdout.write('\nPASS iap-launch gate\n');
