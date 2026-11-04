'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', '--test', 'tests/article-input-security.test.cjs'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', windowsHide: true });
process.exitCode = result.status === null ? 1 : result.status;
